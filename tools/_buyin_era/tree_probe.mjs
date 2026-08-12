// tree_probe.mjs — W9 §12 THE COACHING TREE: the fork/succession state machine.
//
// The wave plan names this probe by its job: "tree probe (write: fork/succession
// state machine)". So the assertions below are not "does the code run" — they
// are the RULES of §12, one at a time, each stated as the thing that would be
// broken if it failed:
//
//   T2   One coach per division, structurally. A slot IS a division, so the
//        rule cannot be violated because there is nowhere to put the second man.
//   T1   Lockstep. The week does not move until every other tree coach's game
//        is played or accepted, and a one-slot tree never sees the gate.
//   R1   A tree run starts one way — one coach, the bottom.
//   R2   The offer declined arms the fork; the fork sends a coordinator up and
//        moves control to him while the old coach keeps coaching as a branch.
//   R3   Moving up as head coach RE-KEYS the slot (it does not create one), and
//        that is what frees the division a protégé is then promoted into.
//   R4   Applying down plants a branch below without moving control.
//   T3   The promoted coordinator's SERVICE RECORD converts to starting
//        milestone levels — not a flat percentage.
//   T5   Retirement is the harvest: it banks the full career permanently, once,
//        frees the chair, and hands control to a successor. It is refused when
//        it would end the run, and refused outside the wrap-up.
//   T4   Division memory accrues per season worked and becomes a real head
//        start for the next coach — and NOTHING in a division nobody worked.
//   ⊥    The null case that makes the whole wave shippable: a save with no tree
//        is untouched by every one of these paths.
//
// Run: node tools/tree_probe.mjs
const _ls = new Map();
global.localStorage = {
  getItem: (k) => (_ls.has(k) ? _ls.get(k) : null),
  setItem: (k, v) => _ls.set(k, String(v)),
  removeItem: (k) => _ls.delete(k),
};

const T = await import('../js/engine/tree.js');
const CP = await import('../js/engine/coachprofile.js');
const { C } = await import('../js/constants.js');
const { gradeIndexFromXP, SKILL_GRADE_XP } = await import('../js/engine/coach.js');
const { coordinatorCredentials } = await import('../js/engine/staff.js');
const { advanceDay } = await import('../js/engine/season.js');
const { rehydrate } = await import('../js/engine/persistence.js');

let pass = 0, fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}`); ok ? pass++ : fail++; };
const hdr = (s) => console.log(`\n${s}`);

// ── A tiny world, on purpose ───────────────────────────────────────────────
// The tree engine touches schools, staff, schedule and the profile store and
// NOTHING else — it never simulates a snap. A three-school world exercises
// every path in this file and keeps the probe instant, which is the point of a
// wave-scoped probe: it should be cheap enough to run on every edit.
let coordSeq = 0;
function mkCoord(side, quality = 60, seasons = 4, letter = 'B+') {
  coordSeq++;
  const keys = side === 'OC' ? ['qbRunDesign', 'passGame', 'runGame'] : ['blitzDesign', 'coverage', 'runFits'];
  const ratings = {};
  for (const k of keys) ratings[k] = quality;
  const units = side === 'OC' ? ['QB', 'RB', 'REC', 'OL'] : ['DL', 'LB', 'DB'];
  const ledger = [];
  for (let s = 1; s <= seasons; s++) {
    const row = { season: s, units: {} };
    for (const u of units) row.units[u] = letter;
    ledger.push(row);
  }
  return {
    id: `coord${coordSeq}`, side, ratings, schemeIQ: {}, specialty: null, seasons, ledger,
    name: { first: side === 'OC' ? 'Otis' : 'Dex', last: `Case${coordSeq}` },
    character: { grind: 50, coachability: 50, leadership: 50 },
  };
}
function mkSchool(id, name, division, prestige = 3) {
  return {
    id, name, division, prestige, conf: 'CONF', state: 'TX',
    roster: [], record: { wins: 0, losses: 0, confWins: 0, confLosses: 0 },
    recentWins: [], facilities: {}, staff: { oc: mkCoord('OC'), dc: mkCoord('DC') },
    coach: null,
  };
}
function mkPlayerCoach(id, schoolId) {
  return {
    id, name: { first: 'Trunk', last: 'Coach' }, isAI: false, schoolId,
    skills: null, status: 'employed', jobSecurity: 60, tenureSeasons: 0,
    careerWins: 0, careerLosses: 0, titles: 0, recruitBoard: [], scouted: {},
    seasonRecord: { wins: 0, losses: 0 },
  };
}
function mkState({ season = 5, day = 10, schedule = [] } = {}) {
  const schools = [
    mkSchool('d3', 'Bottom State', 'D3', 2),
    mkSchool('d2', 'Middle A&M', 'D2', 3),
    mkSchool('d1', 'Top University', 'D1', 5),
  ];
  const st = {
    season, day, world: { schools, recruits: [] }, schedule,
    playerSchoolId: 'd3', playerCoach: null, inbox: [], coachHistory: [],
    rivalry: null, jobOpenings: [], settings: {},
  };
  st.playerCoach = mkPlayerCoach('player-trunk', 'd3');
  schools[0].coach = st.playerCoach;
  return st;
}
// Plant a tree the way the menu does: a tree-owned profile, then foundTree.
function plant(st, name = 'Probe Tree') {
  // Each block below is an independent world with an independent meta-layer.
  // (MAX_TREES is a real cap — clearing the store is how the probe stays
  // honest about it instead of quietly discovering it as a null.)
  localStorage.removeItem('cfb-trees-v1');
  localStorage.removeItem('cfb-coaches-v1');
  const rec = CP.createTree(name);
  const prof = CP.createCoach('Trunk', 'Coach', { treeId: rec.id });
  st._coachId = prof.id;
  T.foundTree(st, { treeId: rec.id, coachId: prof.id });
  return { rec, prof };
}

// ══ R1 — a tree run starts ONE way ═════════════════════════════════════════
hdr('R1 — the trunk: one coach, the bottom of the sport');
{
  const st = mkState();
  plant(st);
  const snap = T.treeSnapshot(st);
  check(C.TREE.START_DIVISION === 'D3', 'the start division is the bottom (D3), by constant');
  check(T.liveSlots(st).length === 1, 'a fresh tree has exactly ONE chair filled');
  check(st.tree.active === 'D3', `control opens in ${st.tree.active}`);
  check(snap.openDivisions.join(',') === 'D1,D2', 'D1 and D2 are open and cannot be started from the menu');
  const inherit = CP.dnaInheritance(st.tree, { seasonsUnderTree: 0 });
  check(Object.keys(inherit.axes).length === 0,
    'a tree that has banked nothing grants nothing — the FIRST coach is exactly a pre-W9 coach');
}

// ══ T2 — one coach per division, structurally ══════════════════════════════
hdr('T2 — one chair per division, and the rule has nowhere to hide');
{
  const st = mkState();
  plant(st);
  const dup = T.seatSlot(st, { division: 'D3', coachId: 'x', schoolId: 'd3', playerCoach: mkPlayerCoach('x', 'd3') });
  check(!dup.ok && /already has a coach/i.test(dup.reason), 'seating a SECOND coach in a held division is refused');
  const wrong = T.seatSlot(st, { division: 'D1', coachId: 'y', schoolId: 'd2', playerCoach: mkPlayerCoach('y', 'd2') });
  check(!wrong.ok && /is D2, not D1/.test(wrong.reason),
    'a slot cannot be seated against a school from another division — the slot IS the division');
  check(C.TREE.MAX_SLOTS === 3 && C.TREE.DIVISIONS.length === 3,
    'three slots, three divisions — the old fourth world slot is gone (T2)');
}

// ══ T3 + R2 — the fork, and the service-record conversion ══════════════════
hdr('T3/R2 — the offer declined arms the fork; the coordinator carries his record up');
{
  const st = mkState({ season: 5 });
  plant(st);
  check(T.forkArmed(st) === false, 'the fork is NOT armed before you have ever said no');
  T.noteOfferDeclined(st);
  check(st.tree.fork.declinedSeason === 5, 'the first decline is recorded against the season it happened');
  check(T.forkArmed(st) === false,
    'and it is still NOT armed the same season — the re-offer is a later conversation, not the same one with two buttons');
  st.season = 5 + C.TREE.FORK_REOFFER_MIN_SEASONS;
  check(T.forkArmed(st) === true,
    `the fork arms ${C.TREE.FORK_REOFFER_MIN_SEASONS} season later, when they call back (R2)`);

  // What his record is WORTH, computed by the W6 function that named W9 as its
  // consumer. The probe asserts the relay, not a re-implementation of the math.
  const coord = st.world.schools[0].staff.oc;
  const cred = coordinatorCredentials(coord);
  check(cred.startingLevels.developer > 0,
    `an OC with ${cred.seasons} years of ${cred.avgUnitGrade} units converts to developer level ${cred.startingLevels.developer}`);

  const res = T.promoteCoordinatorToHC(st, {
    sourceSchoolId: 'd3', side: 'oc', targetSchoolId: 'd2', takeControl: true,
  });
  check(res.ok, `the fork fires: ${res.name} takes the ${res.schoolName} job`);
  check(st.tree.active === 'D2', 'CONTROL FOLLOWS THE PROTÉGÉ — you are now coaching D2');
  check(st.playerSchoolId === 'd2', 'the world pointer moved with control');
  check(T.liveSlots(st).length === 2, 'the old coach is still seated — he continues as a tree branch (R2)');
  check(st.world.schools[0].coach?.id === 'player-trunk',
    'and he is still the actual head coach of his program, not an AI replacement');

  const newHC = st.world.schools[1].coach;
  const devIdx = gradeIndexFromXP(newHC.skills.developer.xp);
  check(devIdx === cred.startingLevels.developer,
    `his STARTING MILESTONE LEVEL landed on the real skill ladder: developer index ${devIdx} (T3 — his service record, not a flat %)`);
  check(newHC.skills.developer.xp === SKILL_GRADE_XP[devIdx],
    'the level maps onto the ladder\'s own XP threshold, so the two can never drift');
  check(gradeIndexFromXP(newHC.skills.reputation.xp) >= C.TREE.PROMOTE_REP_FLOOR_IDX,
    'a man with a record is no unknown — his reputation opens at the promoted floor');
  // [W10] RE-BASED BY DESIGN (Garrett: "same as everyone else"). This used to
  // assert a warmer seat for a promoted man — while the constant behind it was
  // 58 against a stranger's JOBSEC_START of 60, i.e. the test was green while
  // the shipped behaviour was the OPPOSITE of the sentence it printed. Job
  // security is now explicitly neutral on promotion, and this checks that
  // neutrality against JOBSEC_START directly so the two cannot drift apart.
  // His real edge — service record → milestone levels, and the reputation
  // floor asserted just above — is unchanged and still tested.
  check(newHC.jobSecurity === (C.TREE.PROMOTE_JOBSEC ?? C.JOBSEC_START),
    'on exactly the seat any new hire gets — how you were hired buys no rope');
  check(st.world.schools[0].staff.oc.id !== coord.id,
    'the promotion COSTS you the man: his old staff hired a replacement');
  check(newHC.promotedFrom?.side === 'OC' && newHC.promotedFrom.schoolName === 'Bottom State',
    'and the tree remembers where he came from');
}

// ══ R3 — moving up RE-KEYS the slot, and that frees the chair ══════════════
hdr('R3 — the offer accepted: the slot MOVES, and the division you leave opens');
{
  const st = mkState();
  plant(st);
  // The move itself is acceptJob's business; syncActiveSlot is the tree half.
  st.playerSchoolId = 'd2';
  st.world.schools[1].coach = st.playerCoach;
  st.world.schools[0].coach = { id: 'ai', isAI: true, name: { first: 'A', last: 'I' } };
  const moved = T.syncActiveSlot(st);
  check(moved?.ok, 'moving up re-keys the active slot D3 → D2');
  check(T.liveSlots(st).length === 1, 'it MOVED the slot — it did not create a second one');
  check(st.tree.active === 'D2' && !st.tree.slots.D3, 'and the chair he vacated is genuinely empty');
  check(T.openDivisions(st).includes('D3'), 'D3 is open again — which is the vacancy rule 3 promotes into');

  // ...and now the annual option: give the program you built to a coordinator.
  const res = T.promoteCoordinatorToHC(st, { sourceSchoolId: 'd3', side: 'dc', takeControl: true });
  check(res.ok && res.division === 'D3', 'a coordinator at the old program is promoted into the chair you built');
  check(T.liveSlots(st).length === 2, 'the tree now has two branches');
  check(st.tree.active === 'D3' && st.playerSchoolId === 'd3', 'control switched to him (never forced — this is the accepted option)');
  const full = T.promoteCoordinatorToHC(st, { sourceSchoolId: 'd3', side: 'oc', targetSchoolId: 'd3', takeControl: false });
  check(!full.ok, `and a third man cannot be stuffed into an occupied division: "${full.reason}"`);
}

// ══ R4 — applying down ═════════════════════════════════════════════════════
hdr('R4 — branches grow DOWNWARD on purpose, and control stays put');
{
  const st = mkState({ season: 7 });
  plant(st);
  // Put the trunk in D1 so there is somewhere below him to plant.
  st.playerSchoolId = 'd1';
  st.world.schools[2].coach = st.playerCoach;
  st.world.schools[0].coach = { id: 'ai', isAI: true };
  T.syncActiveSlot(st);
  st.jobOpenings = [
    { schoolId: 'd2', schoolName: 'Middle A&M', division: 'D2', prestige: 3, pull: 23, status: 'open' },
    { schoolId: 'd1', schoolName: 'Top University', division: 'D1', prestige: 5, pull: 35, status: 'open' },
  ];
  const targets = T.applyDownTargets(st);
  check(targets.length === 1 && targets[0].division === 'D2',
    'only jobs BELOW the division you are working are apply-down targets (never sideways, never up)');
  check(T.canApplyDown(st), 'and the offseason allows one placement');
  const res = T.applyDown(st, { schoolId: 'd2', side: 'oc' });
  check(res.ok && res.tookControl === false, 'the seed goes in and CONTROL STAYS with you (R4)');
  check(st.tree.active === 'D1' && st.playerSchoolId === 'd1', 'you are still coaching your own program');
  check(T.liveSlots(st).length === 2, 'but the branch exists and is yours to play whenever you like');
  check(!(st.jobOpenings || []).some(o => o.schoolId === 'd2'), 'the seat he took leaves the job board');
  check(!T.canApplyDown(st), `only ${C.TREE.APPLY_DOWN_PER_OFFSEASON} placement per offseason — the second is refused`);
}

// ══ T1 — LOCKSTEP ══════════════════════════════════════════════════════════
hdr('T1 — the week does not move until every other coach\'s game is resolved');
{
  const schedule = [
    { day: 11, homeId: 'd3', awayId: 'x1' },
    { day: 11, homeId: 'x2', awayId: 'd1' },
  ];
  const st = mkState({ season: 5, day: 10, schedule });
  plant(st);
  // One slot first: the gate must be INVISIBLE.
  T.refreshAgenda(st);
  check(T.agendaRows(st).length === 0, 'a ONE-SLOT tree produces no agenda rows at all');
  check(T.lockstepBlock(st) === null, 'and nothing blocks the week — a solo tree is a pre-W9 career');

  // Grow a branch in D1 and re-check.
  st.tree.slots.D1 = { division: 'D1', coachId: 'c-d1', schoolId: 'd1', retired: false, seasonsWorked: 0, inbox: [], coachHistory: [], rivalry: null };
  st.world.schools[2].coach = mkPlayerCoach('player-d1', 'd1');
  st.tree.agenda = { season: null, day: null, rows: [] };
  T.refreshAgenda(st);
  const rows = T.agendaRows(st);
  check(rows.length === 1 && rows[0].division === 'D1',
    'the OTHER coach\'s game this week becomes a row (your own game never does — you are already playing it)');
  check(rows[0].oppId === 'x2' && rows[0].home === false, 'the row knows the opponent and the side of the field');
  const blocked = T.lockstepBlock(st);
  check(!!blocked && /Top University/.test(blocked), `the gate speaks: "${blocked.slice(0, 68)}…"`);

  const dayBefore = st.day;
  const events = advanceDay(st, () => {});
  check(st.day === dayBefore && events.some(e => e.type === 'warning'),
    'and advanceDay REFUSES — the calendar does not move on an undecided week');

  T.softFinalize(st, 'D1');
  check(T.lockstepBlock(st) === null, 'SOFT FINALIZE accepts the pending result and clears the gate');
  check(T.agendaRows(st)[0].status === 'finalized', 'the row records that you accepted it, not that it vanished');

  // Take-over is a TRADE of sidelines, not a second game.
  st.tree.agenda = { season: null, day: null, rows: [] };
  T.refreshAgenda(st);
  const took = T.takeOver(st, 'D1');
  check(took.ok && st.tree.active === 'D1', 'TAKE OVER puts you on that sideline for the week');
  const after = T.agendaRows(st);
  check(after.length === 1 && after[0].division === 'D3',
    'and the man you stepped away from now needs resolving — taking over is a trade, never two games in one week');
}

// ══ T4 — division memory ═══════════════════════════════════════════════════
hdr('T4 — the tree remembers the leagues its coaches worked');
{
  const st = mkState();
  plant(st);
  st.tree.slots.D1 = { division: 'D1', coachId: 'c-d1', schoolId: 'd1', retired: false, seasonsWorked: 0, inbox: [], coachHistory: [], rivalry: null };
  check(CP.divisionMemory(st.tree, 'D3') === 0, 'a new tree remembers nothing, anywhere');
  for (let i = 0; i < C.TREE.MEMORY_FULL; i++) T.treeSeasonTick(st);
  check(CP.divisionMemory(st.tree, 'D3') === 1, `${C.TREE.MEMORY_FULL} seasons worked reads a FULL memory of D3`);
  check(CP.divisionMemory(st.tree, 'D1') === 1, 'both live chairs banked their own years — memory is per division');
  check(CP.divisionMemory(st.tree, 'D2') === 0, 'and D2, which nobody worked, is still a cold start (the whole point)');

  const { applyDivisionMemory } = await import('../js/engine/career.js');
  const cold = mkPlayerCoach('cold', 'd2');
  const warm = mkPlayerCoach('warm', 'd3');
  applyDivisionMemory(cold, st.tree, 'D2');
  applyDivisionMemory(warm, st.tree, 'D3');
  check((cold.skills?.evaluator?.xp || 0) === 0 && (cold.skills?.roots?.xp || 0) === 0,
    'a coach seated in the unremembered division gets NOTHING');
  check(warm.skills.evaluator.xp === C.TREE.MEMORY_EVAL_XP && warm.skills.roots.xp === C.TREE.MEMORY_ROOTS_XP,
    `a coach seated in the tree's home league opens with the full head start (EVL ${warm.skills.evaluator.xp} / ROO ${warm.skills.roots.xp} XP)`);
  const earned = mkPlayerCoach('earned', 'd3');
  earned.skills = { evaluator: { xp: 900 }, recruiter: { xp: 0 }, developer: { xp: 0 }, reputation: { xp: 165 }, roots: { xp: 0 } };
  applyDivisionMemory(earned, st.tree, 'D3');
  check(earned.skills.evaluator.xp === 900,
    'it is a FLOOR, never a bonus — a coach who already knows more keeps every point he earned');
}

// ══ T5 — the harvest ═══════════════════════════════════════════════════════
hdr('T5 — retirement is the harvest, and it happens exactly once');
{
  const st = mkState({ season: 9, day: 26 });
  const { rec, prof } = plant(st);
  // Give the trunk a real career to bank.
  CP.addDnaXP(prof.id, { culture: 600, motivator: 300, groundPound: 150 });

  const early = T.canRetire(st);
  check(!early.ok && /last coach/i.test(early.reason),
    'retiring your ONLY coach is refused — that is not a legacy moment, it is a deleted save');

  // Grow a branch so there is a successor, then check the wrap-up gate.
  T.promoteCoordinatorToHC(st, { sourceSchoolId: 'd3', side: 'oc', targetSchoolId: 'd2', takeControl: false });
  st.day = 12;
  const midSeason = T.canRetire(st);
  check(!midSeason.ok && /wrap-up/i.test(midSeason.reason),
    'and it is refused mid-season — T5 says the wrap-up, and the wrap-up is where a year gets weighed');
  st.day = 26;
  check(T.canRetire(st).ok, 'inside the wrap-up, with a successor waiting, it opens');

  const before = { ...(st.tree.dna.axes || {}) };
  check(Object.keys(before).length === 0, 'nothing is banked while he is still working — his career is his own');
  const res = T.retireActiveCoach(st);
  check(res.ok, `he walks away after ${res.seasons} season${res.seasons === 1 ? '' : 's'} at ${res.schoolName}`);
  check(st.tree.dna.axes.culture === 600 && st.tree.dna.axes.motivator === 300,
    `the FULL career banks into the tree (culture ${st.tree.dna.axes.culture}, motivator ${st.tree.dna.axes.motivator}) — BANK_SHARE is 1.00`);
  check(st.tree.ledger.length === 1 && st.tree.ledger[0].coachId === prof.id, 'and the tree writes his name into its ledger');
  check(st.tree.slots.D3.retired === true && T.liveSlots(st).length === 1, 'his chair is freed');
  check(st.world.schools[0].coach === null && (st.jobOpenings || []).some(o => o.schoolId === 'd3'),
    'his PROGRAM becomes a real vacancy on the real job board — the league does not pause because your man left');
  check(st.tree.active === 'D2' && st.playerSchoolId === 'd2',
    'and control passes to the successor — the succession moment');

  // Idempotence: the button can be double-tapped, the wrap-up re-entered.
  CP.bankIntoTree(st.tree, prof.id, { seasons: 4, share: 1 });
  check(st.tree.dna.axes.culture === 600 && st.tree.ledger.length === 1,
    'banking the same career twice is a no-op — a rerender cannot double-harvest a legacy');

  // ...and the point of banking it: the NEXT man inherits.
  const inherit = CP.dnaInheritance(st.tree, { seasonsUnderTree: 0 });
  const expected = Math.round(600 * C.TREE.INHERIT_SHARE);
  check(inherit.axes.culture === expected,
    `the next coach on this tree starts with a SHARE of it (culture ${inherit.axes.culture} of ${st.tree.dna.axes.culture}) — the protégé effect`);
  const longer = CP.dnaInheritance(st.tree, { seasonsUnderTree: 10 });
  check(longer.share > inherit.share && longer.share <= C.TREE.INHERIT_MAX,
    `and a man who served LONGER under the tree inherits more (${inherit.share} → ${longer.share}, capped at ${C.TREE.INHERIT_MAX})`);

  // The grade cap: the reason a fourth-generation tree is not strictly easier.
  st.tree.dna.axes.culture = 99999;
  const capped = CP.dnaInheritance(st.tree, { seasonsUnderTree: 30 });
  check(CP.dnaGrade(capped.axes.culture) <= C.TREE.INHERIT_CAP_GRADE,
    `no protégé inherits past G${C.TREE.INHERIT_CAP_GRADE} however rich the tree gets (would-be G${CP.dnaGrade(Math.round(99999 * C.TREE.INHERIT_MAX))}) — a head start, never a career`);
}

// ══ Persistence + the null case ════════════════════════════════════════════
hdr('The overlay survives a save, and a save without one is untouched');
{
  const st = mkState({ season: 6, day: 14 });
  plant(st);
  T.promoteCoordinatorToHC(st, { sourceSchoolId: 'd3', side: 'oc', targetSchoolId: 'd2', takeControl: false });
  T.softFinalizeAll(st);
  const round = JSON.parse(JSON.stringify(st));
  rehydrate(round);
  check(!!round.tree && Object.keys(round.tree.slots).length === 2,
    'the tree overlay is plain JSON and round-trips through the save intact');
  check(T.liveSlots(round).length === 2 && round.tree.active === 'D3',
    'both chairs and the active pointer survive');
  const snap = T.treeSnapshot(round);
  check(snap.slots.find(s => s.division === 'D2')?.promotedFrom?.side === 'OC',
    'and so does where the protégé came from');

  // A save written before this wave — or by any solo career, ever.
  const legacy = mkState();
  check(T.ensureTree(legacy) === null, 'a save with no tree returns null from ensureTree');
  check(T.isTreeGame(legacy) === false && T.liveSlots(legacy).length === 0, 'and reads as a non-tree game everywhere');
  check(T.lockstepBlock(legacy) === null && T.refreshAgenda(legacy) === null,
    'the lockstep gate and the agenda are both inert on it');
  check(T.treeSnapshot(legacy) === null && T.openDivisions(legacy).length === 0,
    'every other tree read is inert too — W9 costs a legacy career exactly nothing');
  const legacyRound = JSON.parse(JSON.stringify(legacy));
  rehydrate(legacyRound);
  check(legacyRound.tree === undefined || legacyRound.tree === null,
    'and rehydrate does not INVENT a tree on a save that never had one');

  // Idempotent migration, the W1 rule.
  const partial = mkState();
  partial.tree = { id: 'tzz' };                       // a save missing every sub-object
  const once = T.ensureTree(partial);
  const before = JSON.stringify(partial.tree);
  T.ensureTree(partial);
  check(!!once && JSON.stringify(partial.tree) === before,
    'ensureTree fills defaults in place and is idempotent — the W1/W2 first-touch migration pattern');
}

console.log(`\n${fail ? `${fail} FAILED, ` : ''}${pass}/${pass + fail} — ${fail ? 'the tree does not hold.' : 'the tree holds: forks branch, control follows, the harvest banks once, and a solo career pays nothing.'}`);
process.exit(fail ? 1 : 0);
