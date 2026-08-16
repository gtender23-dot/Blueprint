import { C } from '../constants.js';
import {
  getTree, updateTree, createCoach, dnaGrades, dnaInheritance,
  bankIntoTree, trickleIntoTree, noteDivisionMemory, divisionMemory, treeWorldKey, coachDNA, dnaTitle,
  DNA_AXES, dnaStarLabel, dnaStarTier,
} from './coachprofile.js';
import { freshSkills, ensureSkills, SKILL_GRADE_XP } from './coach.js';
import { ensureCareerFields, applyDivisionMemory, seedPromotedReputation, schoolPull } from './career.js';
import { coordinatorCredentials, staffFor, ensureStaffProfile, ensureHCMastery } from './staff.js';

// ═══ W9 §12 — THE COACHING TREE ════════════════════════════════════════════
//
// §12's verdict, verbatim: "the architecture is an INVERSION, not a rewrite."
// coachprofile.js already said the thing out loud — "The coach is the
// persistent entity; worlds are slots underneath" — and the tree flips exactly
// that one sentence:
//
//   TODAY:  coach → up to 4 worlds.
//   TREE:   tree  → ONE world → up to 3 coaches (slots), one per division.
//
// Everything else in the game is untouched by that flip, because everything
// else already reads state.playerSchoolId and school.coach. A tree is
// therefore not a parallel game mode; it is a THIRD thing sitting above the
// two that already exist, and switching which coach you are is a swap of five
// fields plus a school pointer. That is the whole trick, and it is why this
// wave is a data-layer wave with a UI on top rather than an engine rewrite.
//
// ── The three laws this file enforces ─────────────────────────────────────
//  T1  LOCKSTEP. The world advances week by week, and it does not advance
//      until every OTHER tree coach's game this week is resolved — played
//      (TAKE OVER) or accepted (SOFT FINALIZE). One clock, one truth, no
//      coach drifting into a future the others haven't lived.
//  T2  ONE COACH PER DIVISION. Which is why a slot IS a division: the rule
//      can't be violated because there is nowhere to put the second man.
//  T5  RETIREMENT IS THE HARVEST. An active coach's DNA is his own. Walking
//      away is what commits it to the tree, permanently, for the next man.
//
// ── What is deliberately NOT here ────────────────────────────────────────
// AI schools have no idea the tree exists, and shouldn't: your other coach's
// program is a real program in a real league that happens to be steered by
// you on alternate weeks. No new sim path, no new valuation, no balance
// surface. The standing rule holds — a ONE-SLOT tree is byte-for-byte the
// pre-W9 career, because a one-slot tree produces no agenda rows, banks no
// DNA, and remembers no divisions.

const DIVS = C.TREE.DIVISIONS;

// ── The overlay ────────────────────────────────────────────────────────────
// Everything that is "which coach am I" rather than "what is this world".
// The heavy things (the roster, the schedule, the season, the clock) are the
// WORLD's and are shared by every slot — that is the whole point of one world.
// The light things below are the man's, and they park when you switch.
//
// school.coach stays attached to the school the entire time, for both the
// active slot and the parked ones. That is not laziness: it is the reason no
// sim code needed to change. Your other coach's program is coached by a real
// coach object with real skills and a real hot seat, every week, whether you
// are looking at it or not.
function blankOverlay(division, coachId, schoolId, extra = {}) {
  return {
    division, coachId, schoolId,
    seatedSeason: extra.seatedSeason ?? null,
    mentorCoachId: extra.mentorCoachId ?? null,
    credentials: extra.credentials ?? null,
    seasonsWorked: 0,
    retired: false,
    inbox: [],
    coachHistory: [],
    rivalry: null,
    ...extra,
  };
}

// ── Lazy defaulting, the W1/W2 pattern ─────────────────────────────────────
// Every wave in this update migrates on FIRST TOUCH rather than on a version
// bump, so a save written yesterday behaves identically the moment it loads.
// A non-tree save returns null here forever and pays nothing.
export function ensureTree(state) {
  const t = state?.tree;
  if (!t || !t.id) return null;
  if (!t.slots) t.slots = {};
  if (!t.dna) t.dna = { axes: {} };
  if (!t.memory) t.memory = {};
  if (!Array.isArray(t.ledger)) t.ledger = [];
  if (!t.fork) t.fork = { declinedSeason: null, offerSeason: null, lastPromoteSeason: null, appliedDownSeason: null };
  if (!t.agenda) t.agenda = { season: null, day: null, rows: [] };
  if (!t.active || !t.slots[t.active]) {
    const first = DIVS.find(d => t.slots[d] && !t.slots[d].retired);
    t.active = first || null;
  }
  return t;
}

export function isTreeGame(state) { return !!ensureTree(state); }

export function activeSlot(state) {
  const t = ensureTree(state);
  return t && t.active ? t.slots[t.active] || null : null;
}

// Live (non-retired) slots, in division order — the order the tree screen reads.
export function liveSlots(state) {
  const t = ensureTree(state);
  if (!t) return [];
  return DIVS.map(d => t.slots[d]).filter(s => s && !s.retired);
}

// T2 made queryable: which divisions could take a new branch right now.
export function openDivisions(state) {
  const t = ensureTree(state);
  if (!t) return [];
  return DIVS.filter(d => !t.slots[d] || t.slots[d].retired);
}

export function slotSchool(state, slot) {
  if (!slot) return null;
  return state.world?.schools.find(s => s.id === slot.schoolId) || null;
}

// ── Seating a slot ─────────────────────────────────────────────────────────
// The one write path that puts a coach in a chair. Everything that creates a
// tree coach — founding the trunk, the offer fork, the annual promotion,
// applying down — comes through here, so the T2 rule and the division-memory
// head start can only ever be applied once and in one place.
export function seatSlot(state, { division, coachId, schoolId, playerCoach, mentorCoachId = null, credentials = null }) {
  const t = ensureTree(state);
  if (!t) return { ok: false, reason: 'Not a tree game.' };
  if (!DIVS.includes(division)) return { ok: false, reason: `Unknown division ${division}.` };
  const held = t.slots[division];
  if (held && !held.retired) {
    return { ok: false, reason: `This tree already has a coach in ${division}. One coach per division.` };
  }
  const school = state.world?.schools.find(s => s.id === schoolId);
  if (!school) return { ok: false, reason: 'School not found.' };
  if (school.division !== division) {
    return { ok: false, reason: `${school.name} is ${school.division}, not ${division}.` };
  }
  if (playerCoach) {
    school.coach = playerCoach;
    ensureCareerFields(playerCoach);
    ensureSkills(playerCoach);
    // T4: what the tree remembers about this league, spent on the two skills
    // that ARE knowing a place. A floor, never a bonus — see career.js.
    applyDivisionMemory(playerCoach, t, division);
  }
  t.slots[division] = blankOverlay(division, coachId, schoolId, {
    seatedSeason: state.season, mentorCoachId, credentials,
  });
  if (!t.active) t.active = division;
  // The menu's index gets the same news the world just got.
  syncTreeRecord(state);
  return { ok: true, division, schoolName: school.name };
}

// ── Switching control ──────────────────────────────────────────────────────
// Park the man you are, install the man you're becoming. Five fields and a
// school pointer — no world state moves, because there is only one world and
// it belongs to all of them.
export function activateSlot(state, division) {
  const t = ensureTree(state);
  if (!t) return { ok: false, reason: 'Not a tree game.' };
  const next = t.slots[division];
  if (!next || next.retired) return { ok: false, reason: 'No coach in that chair.' };
  // "Already there" has to mean the WORLD POINTER agrees, not just the tree's
  // own bookkeeping. ensureTree heals a dangling `active` (after a retirement,
  // or a save written mid-switch) by naming the first live chair — which sets
  // the label without moving playerSchoolId. Returning early on the label alone
  // left the coach labelled D2 while still holding D3's program and mail.
  if (t.active === division && state.playerSchoolId === next.schoolId) {
    return { ok: true, division, unchanged: true };
  }
  // ...and only park when we are genuinely leaving a chair. Parking during a
  // heal would write the CURRENT coach's inbox onto the overlay we're about to
  // install, which is the same bug wearing the other shoe.
  if (t.active !== division) parkActive(state);
  t.active = division;
  const school = slotSchool(state, next);
  state.playerSchoolId = next.schoolId;
  state.playerCoach = school?.coach || null;
  state.inbox = next.inbox || [];
  state.coachHistory = next.coachHistory || [];
  state.rivalry = next.rivalry || null;
  state._coachId = next.coachId;
  // Offers and shortlists belong to whoever was on the clock. Carrying them
  // across would let one coach accept another man's job.
  state.pendingOffers = null;
  state.forcedShortlist = null;
  if (school && next.coachId) {
    try { school._dnaGrades = dnaGrades(next.coachId); } catch { /* profile store off */ }
  }
  syncTreeRecord(state);
  return { ok: true, division, schoolName: school?.name || null };
}

function parkActive(state) {
  const t = ensureTree(state);
  const cur = t && t.active ? t.slots[t.active] : null;
  if (!cur) return;
  cur.schoolId = state.playerSchoolId || cur.schoolId;
  cur.inbox = state.inbox || [];
  cur.coachHistory = state.coachHistory || [];
  cur.rivalry = state.rivalry || null;
}

// A tree coach who takes a job in another division has MOVED HIS SLOT, not
// created one. acceptJob() moves the school pointer; this re-keys the slot to
// match, which is what frees the division he left for a protégé (§12 growth
// rule 3 — "he's promoted to HC of the program you built").
export function syncActiveSlot(state) {
  const t = ensureTree(state);
  if (!t || !t.active) return null;
  const slot = t.slots[t.active];
  if (!slot) return null;
  const school = state.world?.schools.find(s => s.id === state.playerSchoolId);
  if (!school) return null;
  slot.schoolId = school.id;
  const div = school.division;
  if (div === slot.division) return null;
  if (t.slots[div] && !t.slots[div].retired) {
    // Should be unreachable (offers are filtered by openDivisions), but a slot
    // collision would silently delete a coach — refuse loudly instead.
    return { ok: false, reason: `A tree coach already holds ${div}.` };
  }
  delete t.slots[slot.division];
  slot.division = div;
  t.slots[div] = slot;
  t.active = div;
  syncTreeRecord(state);
  return { ok: true, from: slot.division, to: div };
}

// ═══ T1 — LOCKSTEP ═════════════════════════════════════════════════════════
// "Your other coaches' games appear in the weekly agenda as links — TAKE OVER
// (play it) or SOFT FINALIZE (accept the pending result), and once every tree
// coach's week is soft-finalized or played, the user advances the week."
//
// The rows are rebuilt whenever the clock moves, so they can never describe a
// week that has already been played. A row exists only for a slot that is NOT
// the one you're steering and that actually has a game today: a bye week costs
// nothing, and a one-slot tree never produces a row at all.
// The agenda describes the week that is ABOUT to be played, not the one just
// finished — the whole point is that you get the choice before the snap, and
// advanceDay plays state.day + 1. Idempotent: the view calls it on every
// render, the engine calls it on every advance, and it rebuilds only when the
// clock has actually moved (so a soft-finalize survives a rerender).
export function refreshAgenda(state) {
  const t = ensureTree(state);
  if (!t) return null;
  const day = (state.day || 0) + 1;
  const a = t.agenda;
  if (a.season === state.season && a.day === day) return a;
  const dayGames = (state.schedule || []).filter(g => g.day === day && !g.result);
  const rows = [];
  for (const div of DIVS) {
    const slot = t.slots[div];
    if (!slot || slot.retired || div === t.active) continue;
    const game = dayGames.find(g => g.homeId === slot.schoolId || g.awayId === slot.schoolId);
    if (!game) continue;
    const home = game.homeId === slot.schoolId;
    rows.push({
      division: div,
      schoolId: slot.schoolId,
      oppId: home ? game.awayId : game.homeId,
      home,
      status: 'pending',
    });
  }
  t.agenda = { season: state.season, day, rows };
  return t.agenda;
}

export function agendaRows(state) { return ensureTree(state)?.agenda?.rows || []; }
export function agendaPending(state) { return agendaRows(state).filter(r => r.status === 'pending'); }

// The gate itself. Returns a sentence when the week cannot advance, null when
// it can — so callers read as `const block = lockstepBlock(state); if (block)`.
export function lockstepBlock(state) {
  const pending = agendaPending(state);
  if (!pending.length) return null;
  const names = pending.map(r => {
    const s = state.world?.schools.find(x => x.id === r.schoolId);
    return `${s?.name || r.division} (${r.division})`;
  });
  return `Your other program${pending.length > 1 ? 's play' : ' plays'} this week: ${names.join(', ')}. `
    + `Take the game over or accept the result before the week moves.`;
}

export function softFinalize(state, division) {
  const row = agendaRows(state).find(r => r.division === division);
  if (!row) return { ok: false, reason: 'Nothing pending for that coach.' };
  row.status = 'finalized';
  return { ok: true };
}
export function softFinalizeAll(state) {
  let n = 0;
  for (const row of agendaPending(state)) { row.status = 'finalized'; n++; }
  return n;
}

// TAKE OVER: you are that coach now, and the row resolves because the game is
// no longer somebody else's — it's yours, and the week's normal machinery
// plays it. The coach you left behind picks up a row of his own next week.
// TAKE OVER: you are that coach now, and his row resolves because the game
// stopped being somebody else's. The honest consequence, which the lockstep
// rule demands: the man you just STEPPED AWAY FROM has a game this week too,
// and it becomes a row. Taking over is a trade of which sideline you're on,
// never a way to coach two games in one week. Statuses already decided are
// carried across so a soft-finalize is not undone by a switch.
export function takeOver(state, division) {
  const t = ensureTree(state);
  if (!t) return { ok: false, reason: 'Not a tree game.' };
  const prior = new Map(agendaRows(state).map(r => [r.division, r.status]));
  const res = activateSlot(state, division);
  if (!res.ok) return res;
  t.agenda = { season: null, day: null, rows: [] };
  refreshAgenda(state);
  for (const row of t.agenda.rows) {
    if (prior.get(row.division)) row.status = prior.get(row.division);
  }
  return res;
}

// ═══ THE SEASON TICK ═══════════════════════════════════════════════════════
// One call per season rollover, from season.js. Two jobs: bank the year of
// division service every live coach just put in (T4's memory), and clear the
// per-season fork flags so this year's offers are this year's.
export function treeSeasonTick(state) {
  const t = ensureTree(state);
  if (!t) return null;
  const worked = [];
  const trickled = {};
  for (const div of DIVS) {
    const slot = t.slots[div];
    if (!slot || slot.retired) continue;
    slot.seasonsWorked = (slot.seasonsWorked || 0) + 1;
    noteDivisionMemory(t, div, 1);
    worked.push(div);
    // THE LIVE TRICKLE. A small share of this coach's NEW personal DNA growth
    // this season is deposited into the shared pool — read-only against him, so
    // his sim is never touched. slot.trickleSnapshot remembers what he's already
    // contributed, so this can't double-deposit on a re-fired tick.
    if (slot.coachId) {
      const res = trickleIntoTree(t, slot.coachId, {
        share: C.TREE.TRICKLE_SHARE, prev: slot.trickleSnapshot || {},
      });
      slot.trickleSnapshot = res.snapshot;
      if (Object.keys(res.deposited).length) trickled[div] = res.deposited;
    }
  }
  t.fork.appliedDownSeason = null;
  // The move-up handoff is a right-away offer — the season turning is what
  // closes it for good (pendingHandoff also self-expires on its own season
  // check, so an old save can't reopen a stale window).
  if (t.fork.handoff) delete t.fork.handoff;
  syncTreeRecord(state);
  return { worked, memory: { ...t.memory }, trickled };
}

// ═══ THE OFFER FORK (§12 growth rules 2–4) ═════════════════════════════════
//
// Rule 2 — THE OFFER, DECLINED. Turn down the move up the first year it comes,
//   and the RE-OFFER carries a fork: move up yourself, or send a coordinator
//   and follow him. Declining is therefore not a dead end that costs you a
//   year; it is the branch point that makes the tree a tree.
// Rule 3 — THE OFFER, ACCEPTED. Move up as head coach and you are offered,
//   that year and every year after, the option to promote one of your former
//   coordinators into the chair you vacated and switch control to him. Never
//   forced — §12 is explicit about that, and a tree you're compelled to grow
//   would just be a rotation.
// Rule 4 — APPLYING DOWN. In the offseason you may plant a coordinator in a
//   LOWER division with an open slot. Branches grow downward on purpose, not
//   only upward on success.

// Called when the coach dismisses this season's offers (the Stay button).
// The FIRST decline is the one that arms the fork.
export function noteOfferDeclined(state) {
  const t = ensureTree(state);
  if (!t) return null;
  if (t.fork.declinedSeason == null) t.fork.declinedSeason = state.season;
  syncTreeRecord(state);
  return t.fork;
}

// Is this offer a FORKED one — i.e. a re-offer after a decline? The fork opens
// FORK_REOFFER_MIN_SEASONS after the year you said no, so the re-offer is a
// later conversation and not the same one with two buttons.
export function forkArmed(state) {
  const t = ensureTree(state);
  if (!t) return false;
  const declined = t.fork.declinedSeason;
  if (declined == null) return false;
  return (state.season - declined) >= C.TREE.FORK_REOFFER_MIN_SEASONS;
}

// Coordinators eligible to be handed a program. Both sides of the ball, from
// any school this tree currently coaches — a promoted man is somebody you
// actually worked with, which is the entire flavour of a coaching tree.
export function promotionCandidates(state, { schoolId = null } = {}) {
  const t = ensureTree(state);
  if (!t) return [];
  const out = [];
  const schools = schoolId
    ? [state.world?.schools.find(s => s.id === schoolId)].filter(Boolean)
    : liveSlots(state).map(s => slotSchool(state, s)).filter(Boolean);
  for (const school of schools) {
    for (const side of ['oc', 'dc']) {
      const coord = school.staff?.[side];
      if (!coord) continue;
      ensureStaffProfile(coord);
      out.push({
        side, coord, schoolId: school.id, schoolName: school.name,
        credentials: coordinatorCredentials(coord),
      });
    }
  }
  return out;
}

// ── The conversion (§12 T3, answered structurally) ────────────────────────
// "The promoted coordinator's stats convert into STARTING MILESTONE LEVELS in
// their respective areas — your OC's development record becomes his day-one
// credentials. (Inheritance = his actual service record, not a flat %.)"
//
// staff.js::coordinatorCredentials owns that math and has since W6, which named
// W9 as its consumer — the same relay W7's measures ran to W8's wants. This
// function is the consumer: it turns levels into XP on the real skill ladder,
// stacks the tree's protégé inheritance on his DNA, and hands him a chair.
export function promoteCoordinatorToHC(state, { sourceSchoolId, side, targetSchoolId = null, takeControl = true, pickAxes = null }) {
  const t = ensureTree(state);
  if (!t) return { ok: false, reason: 'Not a tree game.' };
  const source = state.world?.schools.find(s => s.id === sourceSchoolId);
  const target = state.world?.schools.find(s => s.id === (targetSchoolId || sourceSchoolId));
  if (!source || !target) return { ok: false, reason: 'School not found.' };
  const coord = source.staff?.[side];
  if (!coord) return { ok: false, reason: `No ${String(side).toUpperCase()} on that staff.` };
  const division = target.division;
  if (t.slots[division] && !t.slots[division].retired) {
    return { ok: false, reason: `This tree already coaches ${division}. One coach per division.` };
  }
  if (liveSlots(state).length >= C.TREE.MAX_SLOTS) {
    return { ok: false, reason: 'All three chairs are full.' };
  }

  const credentials = coordinatorCredentials(coord);
  const mentorId = state._coachId || null;
  const mentorSeasons = activeSlot(state)?.seasonsWorked || 0;

  // The protégé's profile. Born tree-owned (it never eats a legacy coach slot)
  // and born with a share of what the tree has BANKED — never a share of a man
  // who is still working, because an active career is his own.
  // [DNA TREE §7.5] The ceremony's pick, if one was made, decides which axes
  // the next man inherits — one-shot, consumed here.
  const _picked = pickAxes || (Array.isArray(t.successionPicks) && t.successionPicks.length ? t.successionPicks : null);
  const inherit = dnaInheritance(t, { seasonsUnderTree: mentorSeasons, pickAxes: _picked });
  if (_picked && !pickAxes) delete t.successionPicks;
  const profile = createCoach(coord.name?.first || 'Coach', coord.name?.last || '', {
    treeId: t.id, mentorId, dna: inherit,
  });

  // His service record, converted. `startingLevels` is indexed on the 13-step
  // skill ladder, so a level maps straight onto its XP threshold — the ladder
  // is the shared language, which is why the numbers can't drift apart.
  const skills = freshSkills();
  for (const [key, level] of Object.entries(credentials.startingLevels || {})) {
    if (!skills[key]) continue;
    const idx = Math.max(0, Math.min(SKILL_GRADE_XP.length - 1, Math.round(level)));
    skills[key] = { xp: Math.max(skills[key].xp || 0, SKILL_GRADE_XP[idx]) };
  }

  const playerCoach = {
    id: 'player-' + (profile?.id || Math.random().toString(36).slice(2, 8)),
    name: { first: coord.name?.first || 'Coach', last: coord.name?.last || '' },
    isAI: false,
    // The run clock (DNA TREE §8): a promoted coordinator brings his OWN age
    // to the head job — his years as your OC were real years. Null-guarded
    // for old-save coordinators that never carried one.
    age: coord.age != null ? coord.age : C.COACH_AGE.COORD_MIN + Math.floor(Math.random() * (C.COACH_AGE.COORD_MAX - C.COACH_AGE.COORD_MIN + 1)),
    schoolId: target.id,
    prestige: target.prestige,
    reputation: 'C',
    loyalty: 'B-',
    skills,
    budget: 0,
    budgetCarryover: 0,
    scholarshipsAvailable: 0,
    recruitBoard: [],
    scouted: {},
    practiceMinutes: { ...(source.coach?.practiceMinutes || {}) },
    promises: [],
    seasonRecord: { wins: 0, losses: 0 },
    careerWins: 0, careerLosses: 0, titles: 0,
    // A man the program already knows opens warmer than a stranger would.
    jobSecurity: C.TREE.PROMOTE_JOBSEC,
    status: 'employed',
    tenureSeasons: 0,
    lastDelta: null,
    dominanceStreak: 0,
    lastOfferSeason: null,
    // Where he came from — the tree's own lore, and what the staff page reads.
    promotedFrom: { side: String(side).toUpperCase(), schoolId: source.id, schoolName: source.name, credentials },
  };
  seedPromotedReputation(playerCoach);
  // [DNA TREE §5b.2] A promoted man's own formation sheet, rolled cold — his
  // coordinator schemeIQ was the UNIT's sheet, not the head coach's.
  try { ensureHCMastery(playerCoach); } catch { /* sheet seeds lazily at first wrap-up */ }

  // He took the job, so he is off the old staff. The program he left hires a
  // replacement at its own weight class — a promotion COSTS you the man, which
  // is what stops "promote everyone" from being free.
  //
  // [PLAYTEST 2026-08-12 item 23] …but when the program he left is YOURS, that
  // replacement used to be rolled silently from the same prestige-anchored
  // distribution and dropped into the chair with no screen and no choice, which
  // read as "the name changed and nothing else did". Your own vacancy is now a
  // real vacancy: the chair empties and pendingCoordHire forces the hire.
  // The forced hire applies when the vacancy is at the program you will still be
  // coaching after the move — i.e. the "give him this program" path, where target
  // and source are the same school. On a fork you leave that program behind, so
  // it hires its own replacement as before.
  let backfill = null;
  if (source.id === target.id && source.id === state.playerSchoolId) {
    source.staff = { ...(source.staff || {}), [side]: null };
    state.pendingCoordHire = { schoolId: source.id, side, reason: "promotion" };
  } else {
    const bench = staffFor(source.prestige, source.division);
    backfill = bench[side] || bench.oc;
    source.staff = { ...(source.staff || {}), [side]: backfill };
  }

  const seated = seatSlot(state, {
    division, coachId: profile?.id || null, schoolId: target.id, playerCoach,
    mentorCoachId: mentorId, credentials,
  });
  if (!seated.ok) return seated;

  t.fork.lastPromoteSeason = state.season;
  if (takeControl) activateSlot(state, division);
  syncTreeRecord(state);
  return {
    ok: true, division, schoolName: target.name, coachId: profile?.id || null,
    name: `${playerCoach.name.first} ${playerCoach.name.last}`.trim(),
    credentials, inherit, tookControl: !!takeControl, replacedBy: backfill ? backfill.name : null, chairOpen: !backfill,
  };
}

// Rule 4 — where a seed can be planted. LOWER than the division you are
// currently working, with an open slot, and a job actually sitting vacant.
// state.jobOpenings is the offseason board the application system already
// builds, so applying down reads the same market everything else does.
export function applyDownTargets(state) {
  const t = ensureTree(state);
  if (!t) return [];
  // While the move-up handoff is open, the old school is the ONLY program a
  // coordinator can be sent to — the general board waits its turn.
  if (pendingHandoff(state)) return [];
  const rank = { D3: 0, D2: 1, D1: 2 };
  const here = rank[t.active] ?? 0;
  const open = new Set(openDivisions(state));
  return (state.jobOpenings || [])
    .filter(o => open.has(o.division) && (rank[o.division] ?? 0) < here)
    .sort((a, b) => (b.pull || 0) - (a.pull || 0));
}

export function canApplyDown(state) {
  const t = ensureTree(state);
  if (!t) return false;
  if (t.fork.appliedDownSeason === state.season) return false;
  return applyDownTargets(state).length > 0 && promotionCandidates(state).length > 0;
}

export function applyDown(state, { schoolId, side }) {
  const t = ensureTree(state);
  if (!t) return { ok: false, reason: 'Not a tree game.' };
  // The exclusivity rule, enforced where it can't be dodged: while the move-up
  // handoff is open, the old school is the only program on offer — and it goes
  // through executeHandoff, not here.
  if (pendingHandoff(state)) {
    return { ok: false, reason: 'Settle the handoff at your old school first — right now that is the only program you can send a coordinator to.' };
  }
  if (t.fork.appliedDownSeason === state.season) {
    return { ok: false, reason: 'You have already placed a coordinator this offseason.' };
  }
  const target = state.world?.schools.find(s => s.id === schoolId);
  if (!target) return { ok: false, reason: 'School not found.' };
  const res = promoteCoordinatorToHC(state, {
    sourceSchoolId: state.playerSchoolId, side, targetSchoolId: schoolId, takeControl: false,
  });
  if (!res.ok) return res;
  t.fork.appliedDownSeason = state.season;
  // The seat is filled, so it leaves the board.
  state.jobOpenings = (state.jobOpenings || []).filter(o => o.schoolId !== schoolId);
  syncTreeRecord(state);
  return res;
}

// ═══ THE MOVE-UP HANDOFF (§12 Rule 3, the moment itself) ═══════════════════
// "Move up as head coach and you are offered the option to promote one of
// your former coordinators into the chair you vacated." The owner's ruling on
// the timing (2026-08-08): the offer is RIGHT AWAY and ONLY right away — the
// offseason you accept the move, take it or leave it — and the men on offer
// are the staff you actually left behind, not the strangers you just met.
// An interim AI coach holds the seat in the meantime (acceptJob seats him),
// so the world never has a coachless program; handing off simply replaces him.
//
// Armed by acceptJob AFTER the slot re-key, because the window only exists if
// the division the coach walked out of is now genuinely open to the tree.
export function noteMoveUpHandoff(state, oldSchoolId) {
  const t = ensureTree(state);
  if (!t) return null;
  const school = state.world?.schools.find(s => s.id === oldSchoolId);
  if (!school) return null;
  const div = school.division;
  if (t.slots[div] && !t.slots[div].retired) return null; // moved inside the division — nothing opened
  if (liveSlots(state).length >= C.TREE.MAX_SLOTS) return null; // no chair to hand
  if (!promotionCandidates(state, { schoolId: oldSchoolId }).length) return null; // nobody to send
  t.fork.handoff = { schoolId: oldSchoolId, schoolName: school.name, division: div, season: state.season };
  syncTreeRecord(state);
  return t.fork.handoff;
}

// The open window, or null. Self-healing: it expires when the season turns,
// and dies early if the division filled or the old staff emptied meanwhile.
export function pendingHandoff(state) {
  const t = ensureTree(state);
  const h = t?.fork?.handoff;
  if (!h) return null;
  const close = () => { delete t.fork.handoff; return null; };
  if (h.season !== state.season) return close();
  if (t.slots[h.division] && !t.slots[h.division].retired) return close();
  const school = state.world?.schools.find(s => s.id === h.schoolId);
  if (!school) return close();
  if (!promotionCandidates(state, { schoolId: h.schoolId }).length) return close();
  return h;
}

// The men on offer — the OC/DC still on the old school's staff, i.e. the
// coordinators the departed coach actually worked with there.
export function handoffCandidates(state) {
  const h = pendingHandoff(state);
  if (!h) return [];
  return promotionCandidates(state, { schoolId: h.schoolId });
}

// Send him down. Same conversion as every promotion (his service record is
// his day-one credentials), control stays with the job you just took — the
// old program becomes a branch you can switch to whenever you like. Counts as
// the offseason's one coordinator placement, so the general board can't be
// double-dipped afterwards.
export function executeHandoff(state, side) {
  const h = pendingHandoff(state);
  if (!h) return { ok: false, reason: 'No handoff window open.' };
  const res = promoteCoordinatorToHC(state, {
    sourceSchoolId: h.schoolId, side, targetSchoolId: h.schoolId, takeControl: false,
  });
  if (!res.ok) return res;
  const t = ensureTree(state);
  delete t.fork.handoff;
  t.fork.appliedDownSeason = state.season;
  syncTreeRecord(state);
  return res;
}

// Pass on it. The interim coach keeps the program and the moment is gone —
// which is the point: the chair was yours to hand over exactly once.
export function declineHandoff(state) {
  const t = ensureTree(state);
  if (!t?.fork?.handoff) return { ok: false, reason: 'No handoff window open.' };
  const h = t.fork.handoff;
  delete t.fork.handoff;
  syncTreeRecord(state);
  return { ok: true, schoolName: h.schoolName };
}

// ═══ T5 — RETIREMENT, THE HARVEST ══════════════════════════════════════════
// "Retirement lives in the SEASON WRAP-UP only. Retiring COMMITS the coach's
// DNA to the TREE DNA permanently — the tree gains his experience for good."
//
// The gate is the wrap-up, not the calendar generally, and that gate is real:
// a man does not walk out mid-season, and the decision has to land where the
// year is being weighed. It also has to be refused when it would end the run —
// retiring your last coach with no chair to move into is not a legacy moment,
// it is a deleted save.
export function canRetire(state) {
  const t = ensureTree(state);
  if (!t || !t.active) return { ok: false, reason: 'No active coach.' };
  const inWrapUp = !!state.offseason || (state.day >= 24 && state.day <= 30);
  if (!inWrapUp) return { ok: false, reason: 'Retiring is a wrap-up decision — it opens when the season is over.' };
  if (liveSlots(state).length <= 1) {
    return { ok: false, reason: 'This is your last coach. Grow a branch first — a tree with nobody in it has nowhere to send you.' };
  }
  return { ok: true };
}

// [DNA TREE §7.4 D8] How the career is ENDING sets the harvest share: a man
// walking away fired banks least, one quitting young banks partial, a full
// retirement banks everything BANK_SHARE allows. Age draws the quit/retire
// line — leave before the game says you're done and the tree feels it.
export function exitKindFor(state) {
  const pc = state.playerCoach;
  if (!pc) return 'retire';
  if (pc._pendingFire || pc.status === 'unemployed') return 'fired';
  if (pc.age != null && pc.age < C.COACH_AGE.RETIRE_ELIGIBLE) return 'quit';
  return 'retire';
}

// [DNA TREE §7] THE CEREMONY PAYLOAD — every beat backed by an existing
// system, assembled read-only so the UI can show the whole sequence before
// the one irreversible click.
export function buildRetirementCeremony(state) {
  const t = ensureTree(state);
  if (!t || !t.active) return null;
  const slot = t.slots[t.active];
  const school = slotSchool(state, slot);
  const pc = state.playerCoach;
  const coachId = slot.coachId;
  let dna = null, title = 'Building an Identity';
  try { dna = coachDNA(coachId); title = dnaTitle(dna); } catch { /* profile store off */ }
  // Beat 2 — THE DEEDS: every axis that reached a star this career, told in
  // star language (pure-XP tiers, D1/D2).
  const deeds = [];
  if (dna && dna.axes) {
    for (const [axis, xp] of Object.entries(dna.axes)) {
      const meta = DNA_AXES[axis];
      if (!meta) continue;
      const tier = dnaStarTier(xp);
      if (tier > 0) deeds.push({ axis, label: meta.label, icon: meta.icon, tier, stars: dnaStarLabel(tier) });
    }
    deeds.sort((a, b) => b.tier - a.tier);
  }
  // Beat 3 — THE GAMES: instantclassics already identified and stored them.
  const games = (state.instantClassics || [])
    .slice()
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, C.TREE.CEREMONY_GAMES)
    .map((g) => ({ season: g.season, week: g.week, id: g.id, score: g.score, title: g.title || g.headline || null }));
  // Beat 4 — THE HARVEST at the D8 share.
  const exitKind = exitKindFor(state);
  const exitShare = (C.TREE.EXIT_SHARE && C.TREE.EXIT_SHARE[exitKind]) != null ? C.TREE.EXIT_SHARE[exitKind] : 1;
  const share = C.TREE.BANK_SHARE * exitShare;
  // Beat 5 — THE SUCCESSION: who could stand there. The promise shapes who
  // does and how they feel; sheets + seasons-served inheritance shown.
  const staff = school && school.staff || {};
  const mentored = [];
  for (const side of ['oc', 'dc']) {
    const co = staff[side];
    if (!co) continue;
    mentored.push({
      side: side.toUpperCase(),
      name: `${co.name?.first || ''} ${co.name?.last || ''}`.trim(),
      age: co.age ?? null,
      ambition: co.ambition || null,
      promised: !!co.promisedSuccession,
      specialty: co.specialty || null,
      seasons: co.seasons || 0,
    });
  }
  mentored.sort((a, b) => (b.promised ? 1 : 0) - (a.promised ? 1 : 0));
  const inheritPreview = dnaInheritance(t, { seasonsUnderTree: slot.seasonsWorked || 0 });
  const bankedAxes = Object.entries(t.dna?.axes || {})
    .filter(([k, xp]) => DNA_AXES[k] && xp > 0)
    .map(([k, xp]) => ({ axis: k, label: DNA_AXES[k].label, icon: DNA_AXES[k].icon, banked: xp }))
    .sort((a, b) => b.banked - a.banked);
  // Beat 6 preview — THE WORLD RESPONDS: what the tenure has earned.
  const tenure = pc?.tenureSeasons || 0;
  return {
    record: {
      name: `${pc?.name?.first || 'Coach'} ${pc?.name?.last || ''}`.trim(),
      age: pc?.age ?? null,
      wins: pc?.careerWins || 0,
      losses: pc?.careerLosses || 0,
      titles: pc?.titles || 0,
      seasons: slot.seasonsWorked || 0,
      tenureHere: tenure,
      schoolName: school?.name || null,
      epitaph: title,
    },
    deeds,
    games,
    exitKind,
    exitShare,
    harvestShare: share,
    succession: {
      nextSlot: liveSlots(state).filter((s) => s !== slot)[0]?.division || null,
      mentored,
      inheritShare: inheritPreview.share,
      pickMax: C.TREE.INHERIT_PICK_MAX,
      bankedAxes,
    },
    world: {
      qualifiesLegend: tenure >= C.TREE.LEGEND_MIN_SEASONS,
      qualifiesField: tenure >= C.TREE.FIELD_NAME_MIN_SEASONS,
      schoolName: school?.name || null,
    },
  };
}

export function retireActiveCoach(state) {
  const t = ensureTree(state);
  const gate = canRetire(state);
  if (!gate.ok) return gate;
  const slot = t.slots[t.active];
  const school = slotSchool(state, slot);
  const coachId = slot.coachId;
  const seasons = slot.seasonsWorked || 0;
  const pc = state.playerCoach;
  // [D8] The exit sets the share — computed BEFORE parkActive clears anything.
  const exitKind = exitKindFor(state);
  const exitShare = (C.TREE.EXIT_SHARE && C.TREE.EXIT_SHARE[exitKind]) != null ? C.TREE.EXIT_SHARE[exitKind] : 1;
  const tenureHere = pc?.tenureSeasons || 0;
  const coachName = `${pc?.name?.first || 'Coach'} ${pc?.name?.last || ''}`.trim();
  const coachLast = pc?.name?.last || 'Coach';
  const careerWins = pc?.careerWins || 0;
  const careerLosses = pc?.careerLosses || 0;

  parkActive(state);
  // THE HARVEST. Idempotent by ledger check inside bankIntoTree, so a double
  // tap on the button cannot bank a career twice. The D8 share scales what
  // the tree receives by how the career ended.
  if (coachId) bankIntoTree(t, coachId, { seasons, share: C.TREE.BANK_SHARE * exitShare });
  slot.retired = true;
  slot.retiredSeason = state.season;

  // [DNA TREE §7.6] THE WORLD RESPONDS. A qualifying tenure appends a legend
  // era in the EXACT generateProgramLore event shape ({year, kind, text}), so
  // his career becomes indistinguishable from the generated backstory. Long
  // enough, and the field takes his name. Seasons map onto the lore calendar
  // (season 1 = 2026, the worldgen anchor).
  if (school && tenureHere >= C.TREE.LEGEND_MIN_SEASONS) {
    if (!school.lore) school.lore = { footballSince: 2026, titles: [], confTitles: [], postseasons: 0, legend: null, tradition: '', events: [], allTime: { wins: 0, losses: 0, ties: 0 } };
    if (!Array.isArray(school.lore.events)) school.lore.events = [];
    const fromSeason = Math.max(1, state.season - tenureHere + 1);
    const fromYr = 2025 + fromSeason;
    const toYr = 2025 + state.season;
    const pct = careerWins + careerLosses > 0 ? careerWins / (careerWins + careerLosses) : 0;
    const note = pct >= 0.72 ? 'won and won and would not stop winning'
      : pct >= 0.58 ? 'made the program matter every single November'
      : pct >= 0.45 ? 'fought the sport to a draw and taught it manners'
      : 'kept the lights on when nobody else would take the job';
    const legend = { name: coachName, from: fromYr, to: toYr, note, wins: careerWins, losses: careerLosses };
    if (!school.lore.legend || (school.lore.legend.to - school.lore.legend.from) < (toYr - fromYr)) {
      school.lore.legend = legend;
    }
    school.lore.events.push({ year: fromYr, kind: 'era', text: `${coachName} arrives. The ${fromYr}\u2013${toYr} teams ${note}.` });
    school.lore.events.sort((a, b) => a.year - b.year);
    if (tenureHere >= C.TREE.FIELD_NAME_MIN_SEASONS && school.stadium && school.stadium.indexOf(' Field at ') < 0) {
      school.stadium = `${coachLast} Field at ${school.stadium}`;
    }
  }

  // The chair he leaves is a real vacancy in a real league. The carousel fills
  // it exactly the way it fills any other — the program does not pause because
  // your man walked away.
  if (school) {
    school.coach = null;
    state.jobOpenings = [
      ...(state.jobOpenings || []),
      { schoolId: school.id, schoolName: school.name, division: school.division,
        prestige: school.prestige, pull: schoolPull(school), status: 'open', reason: 'retirement' },
    ];
  }

  // Control moves to whoever is left — the succession moment.
  const next = liveSlots(state)[0];
  t.active = null;
  if (next) activateSlot(state, next.division);
  // [DNA TREE §7.6] The news lands AFTER succession, in the LIVE inbox — the
  // heir opens his mail to read that an era ended. (activateSlot swaps
  // state.inbox to the successor's parked mail; writing earlier would strand
  // the letter on the retired man's parked copy.)
  if (school && tenureHere >= C.TREE.LEGEND_MIN_SEASONS && Array.isArray(state.inbox)) {
    const fromYr2 = 2025 + Math.max(1, state.season - tenureHere + 1);
    const toYr2 = 2025 + state.season;
    state.inbox.unshift({
      id: 'retire-' + Date.now().toString(36),
      day: state.day || 1,
      subject: `An era ends at ${school.name}`,
      body: `${school.name} \u2014 ${coachName} has retired after ${tenureHere} seasons (${fromYr2}\u2013${toYr2}). His record: ${careerWins}\u2013${careerLosses}.${tenureHere >= C.TREE.FIELD_NAME_MIN_SEASONS ? ` The program will play its home games on ${coachLast} Field.` : ''}`,
      read: false,
    });
    if (state.inbox.length > 50) state.inbox = state.inbox.slice(0, 50);
  }
  syncTreeRecord(state);
  return {
    ok: true,
    retired: coachId,
    seasons,
    exitKind,
    exitShare,
    schoolName: school?.name || null,
    banked: { ...(t.dna?.axes || {}) },
    successor: next ? { division: next.division, schoolId: next.schoolId } : null,
  };
}

// ═══ THE MENU INDEX ════════════════════════════════════════════════════════
// The world save is the TRUTH for a live tree; the localStorage record is the
// snapshot the main menu draws without opening a 40 MB world. Same relationship
// noteWorldMeta already has with a legacy world slot, and the same one-way
// direction: the world writes the record, never the reverse.
export function syncTreeRecord(state) {
  const t = ensureTree(state);
  if (!t) return null;
  return updateTree(t.id, rec => {
    rec.dna = { axes: { ...(t.dna?.axes || {}) } };
    rec.memory = { ...(t.memory || {}) };
    rec.ledger = (t.ledger || []).slice(-24);
    rec.slots = {};
    for (const div of DIVS) {
      const slot = t.slots[div];
      if (!slot || slot.retired) continue;
      const school = slotSchool(state, slot);
      rec.slots[div] = {
        coachId: slot.coachId,
        schoolId: slot.schoolId,
        schoolName: school?.name || null,
        seatedSeason: slot.seatedSeason,
        seasonsWorked: slot.seasonsWorked || 0,
        active: t.active === div,
      };
    }
  });
}

// ── The tree screen's read model ───────────────────────────────────────────
// One object with everything a view needs, so the coach's office, the main menu
// and the probe all read the same shape and can never disagree about what the
// tree currently IS.
export function treeSnapshot(state) {
  const t = ensureTree(state);
  if (!t) return null;
  const rec = getTree(t.id);
  return {
    id: t.id,
    name: rec?.name || 'The Tree',
    active: t.active,
    slots: DIVS.map(div => {
      const slot = t.slots[div];
      if (!slot || slot.retired) return { division: div, empty: true, memory: divisionMemory(t, div) };
      const school = slotSchool(state, slot);
      const coach = school?.coach;
      return {
        division: div,
        empty: false,
        active: t.active === div,
        coachId: slot.coachId,
        name: coach ? `${coach.name?.first || 'Coach'} ${coach.name?.last || ''}`.trim() : 'Coach',
        title: slot.coachId ? dnaTitle(coachDNA(slot.coachId)) : 'Building an Identity',
        schoolId: slot.schoolId,
        schoolName: school?.name || '—',
        prestige: school?.prestige ?? null,
        record: school?.record ? { ...school.record } : null,
        seasonsWorked: slot.seasonsWorked || 0,
        promotedFrom: coach?.promotedFrom || null,
        mentorCoachId: slot.mentorCoachId || null,
        memory: divisionMemory(t, div),
      };
    }),
    banked: { ...(t.dna?.axes || {}) },
    memory: { ...(t.memory || {}) },
    ledger: (t.ledger || []).slice().reverse(),
    fork: { ...t.fork },
    forkArmed: forkArmed(state),
    agenda: agendaRows(state),
    openDivisions: openDivisions(state),
  };
}

// ── Founding a tree, from the world side ───────────────────────────────────
// §12 growth rule 1: "A tree run starts ONE way: take a job, one coach slot,
// the bottom (D3)." The wizard enforces the division; this attaches the tree
// record to the freshly-founded world and seats the trunk.
export function foundTree(state, { treeId, coachId }) {
  const school = state.world?.schools.find(s => s.id === state.playerSchoolId);
  if (!school) return { ok: false, reason: 'No program.' };
  state.tree = {
    id: treeId, active: null, slots: {}, dna: { axes: {} }, memory: {},
    ledger: [], fork: { declinedSeason: null, offerSeason: null, lastPromoteSeason: null, appliedDownSeason: null },
    agenda: { season: null, day: null, rows: [] },
  };
  ensureTree(state);
  const t = state.tree;
  t.slots[school.division] = blankOverlay(school.division, coachId, school.id, { seatedSeason: state.season });
  t.active = school.division;
  state._coachId = coachId;
  syncTreeRecord(state);
  return { ok: true, division: school.division, schoolName: school.name };
}

export { treeWorldKey };
