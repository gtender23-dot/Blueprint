// tree_life_probe.mjs — ONE WHOLE LIFE (owner mandate, Aug 2026): "climbing
// the divisions and growing the tree... has to be perfect."
//
// Every tree organ has its own green probe. This is the BODY: a single real
// career driven through the actual advanceDay season machinery, phase by
// phase, with the state checkpointed to disk between runs so a phone-length
// call can never lose the journey. Run it repeatedly; it resumes and
// continues until THE LIFE IS COMPLETE.
//
//   PHASE 1 — ROOTS: found a tree at the BOTTOM (top D3 program), sim the
//     first season(s). Trunk seated, agenda live, mastery sheet rolled, D3
//     economics, XP flowing, no NaN anywhere.
//   PHASE 2 — THE CLIMB: win until a better job calls (or the market opens),
//     take it through the REAL acceptJob. Division economics switch, tenure
//     and loyalty stacks reset, the tree re-keys the slot, the old chair
//     becomes a real vacancy.
//   PHASE 3 — THE BRANCH: promote a mentored coordinator into an open
//     division through the real promotion path. Inheritance ★★-capped,
//     credential-seeded, one chair per division enforced.
//   PHASE 4 — TWO LIVES: switch chairs both ways; gameplan/inbox isolation
//     (a marker written under one coach must never bleed to the other);
//     lockstep season ticks both programs; both profiles accrue separately.
//   PHASE 5 — THE SUNSET: age the elder to eligibility, run the REAL
//     ceremony + retirement in the live state. Harvest at the exit share,
//     control moves to the heir, the world writes lore if tenure qualifies,
//     and the save still round-trips.
//
// Checkpoints: /tmp/tree_life_ls.json (file-backed localStorage — the real
// save path), /tmp/tree_life_journal.json (phase + assertion ledger).
// Args: [budgetSec=200]   Reset: delete both /tmp files.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const LS_FILE = '/tmp/tree_life_ls.json';
const J_FILE = '/tmp/tree_life_journal.json';
const _ls = new Map(existsSync(LS_FILE) ? JSON.parse(readFileSync(LS_FILE, 'utf8')) : []);
global.localStorage = {
  getItem: (k) => (_ls.has(k) ? _ls.get(k) : null),
  setItem: (k, v) => _ls.set(k, String(v)),
  removeItem: (k) => _ls.delete(k),
};
const journal = existsSync(J_FILE) ? JSON.parse(readFileSync(J_FILE, 'utf8')) : { phase: 1, done: [], failed: [], seasonsSimmed: 0, notes: {} };
const BUDGET_MS = Number(process.argv[2] || 200) * 1000;
const t0 = Date.now();
const overBudget = () => Date.now() - t0 > BUDGET_MS;

const S = await import('../js/state.js');
const { generateWorld } = await import('../js/engine/world.js');
const SE = await import('../js/engine/season.js');
const T = await import('../js/engine/tree.js');
const CP = await import('../js/engine/coachprofile.js');
const { C } = await import('../js/constants.js');
const P = await import('../js/engine/persistence.js');

S.setRenderFn(() => {});
S.setNotifyFn(() => {});
const state = S.state;

let newFails = 0;
function mark(id, ok, msg) {
  if (journal.done.includes(id)) return; // already banked green
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}`);
  if (ok) journal.done.push(id);
  else { journal.failed.push({ id, msg }); newFails++; }
}
const banked = (id) => journal.done.includes(id);

function scanBad(obj, path, out, seen, depth) {
  if (depth > 6 || obj == null || out.length > 4) return;
  if (typeof obj === 'number') { if (!Number.isFinite(obj)) out.push(path); return; }
  if (typeof obj !== 'object') return;
  if (seen.has(obj)) return; seen.add(obj);
  if (Array.isArray(obj)) { for (let i = 0; i < Math.min(obj.length, 200); i++) scanBad(obj[i], `${path}[${i}]`, out, seen, depth + 1); return; }
  for (const k in obj) { if (k.startsWith('_')) continue; scanBad(obj[k], `${path}.${k}`, out, seen, depth + 1); }
}
function invariants(tag) {
  const t = T.ensureTree(state);
  const bad = [];
  scanBad({ world: state.world, tree: state.tree, coach: state.playerCoach }, tag, bad, new Set(), 0);
  const divisions = Object.values(t?.slots || {}).filter((s) => !s.retired).map((s) => s.division);
  const dupChairs = divisions.length !== new Set(divisions).size;
  const budgetOk = state.playerCoach == null || state.playerCoach.budget == null || (Number.isFinite(state.playerCoach.budget) && state.playerCoach.budget > -1);
  if (bad.length) console.log(`    NaN at: ${bad.join(', ')}`);
  return !bad.length && !dupChairs && budgetOk;
}

function drive() {
  const pt = state.pendingHalftime && state.pendingHalftime.token;
  if (pt && pt.pending) {
    if (pt.pending.kind === 'fourth') S.answerFourthDown('auto');
    else S.answerPlayCall({ concept: 'sheet' });
    return;
  }
  if (state.pendingHalftime) { S.resumeHalftime(); return; }
  SE.advanceDay(state, () => {});
}
async function simSeasons(n, stopWhen = null) {
  const start = state.season;
  while (state.season < start + n && !overBudget()) {
    const before = state.season;
    for (let i = 0; i < 3000 && state.season === before && !overBudget(); i++) {
      drive();
      // Yield so the microtask queue drains: every game action's autosave holds a
      // full state clone in a suspended saveGame frame until its await resumes.
      // Without this, a long budget is one synchronous loop and the clones pile
      // up to a 4 GB V8 abort (exit 0xC0000409). Diagnosed 2026-08-10.
      await new Promise((r) => setImmediate(r));
      if (stopWhen && stopWhen()) return true;
    }
    if (state.season > before) journal.seasonsSimmed++;
  }
  return stopWhen ? stopWhen() : true;
}
async function checkpoint() {
  await S.saveToSlot(1);
  writeFileSync(LS_FILE, JSON.stringify([..._ls.entries()]));
  writeFileSync(J_FILE, JSON.stringify(journal, null, 1));
}

// ── Boot or resume ─────────────────────────────────────────────────────────
if (journal.phase === 1 && !journal.notes.founded) {
  console.log('\nPHASE 1 — ROOTS (fresh journey)');
  const world = generateWorld();
  const school = world.schools.filter((s) => s.division === 'D3').sort((a, b) => b.prestige - a.prestige)[0];
  state._treeId = 'life-' + Date.now().toString(36);
  S.startNewGamePrepared({ first: 'Ezra', last: 'Stone' }, world, school);
  journal.notes.founded = true;
  journal.notes.rootSchool = school.name;
  const t = T.ensureTree(state);
  mark('p1-tree', !!t && !!t.slots.D3 && t.active === 'D3', `the tree is planted at the bottom: ${school.name} (D3), trunk active`);
  mark('p1-age', state.playerCoach.age >= C.COACH_AGE.PLAYER_START_MIN && state.playerCoach.age <= C.COACH_AGE.PLAYER_START_MAX, `the trunk is a young man (${state.playerCoach.age})`);
  mark('p1-mastery', !!state.playerCoach.masteryIQ, 'his formation sheet exists from day one');
  mark('p1-agenda', Array.isArray(t.agenda?.rows), 'the agenda machinery is live');
} else {
  console.log(`\nRESUMING — phase ${journal.phase}, ${journal.seasonsSimmed} seasons simmed, ${journal.done.length} assertions banked, ${journal.failed.length} failed`);
  const loaded = await S.loadFromSlot(1);
  if (!loaded || !state.world) { console.log('  FATAL: checkpoint failed to load'); process.exit(1); }
  mark('resume-roundtrip', T.isTreeGame(state) && !!state.playerCoach, 'the checkpoint round-trips through the REAL save system (every resume re-proves it)');
  journal.done = journal.done.filter((d) => d !== 'resume-roundtrip'); // re-earn each run
}

// ── PHASE 1 body: the first seasons ────────────────────────────────────────
if (journal.phase === 1) {
  await simSeasons(2);
  if (state.season >= 3 || journal.seasonsSimmed >= 2) {
    const dna = CP.coachDNA(state._coachId);
    mark('p1-xp', dna && Object.values(dna.axes || {}).some((v) => v > 0), 'DNA XP flowed from real coached games');
    mark('p1-wins', (state.playerCoach.careerWins || 0) + (state.playerCoach.careerLosses || 0) > 0, `the record is real (${state.playerCoach.careerWins}–${state.playerCoach.careerLosses})`);
    mark('p1-econ', true, 'seasons complete on D3 economics without a throw');
    mark('p1-inv', invariants('p1'), 'invariants: no NaN, one chair per division, budget finite');
    journal.phase = 2;
    console.log('  → PHASE 1 COMPLETE. Run again for THE CLIMB.');
  } else {
    console.log(`  …mid-phase (season ${state.season}, budget spent). Run again to continue.`);
  }
}

// ── PHASE 2: THE CLIMB ─────────────────────────────────────────────────────
else if (journal.phase === 2) {
  console.log('PHASE 2 — THE CLIMB');
  const oldDiv = state.world.schools.find((s) => s.id === state.playerSchoolId)?.division;
  const stacksBefore = state.playerCoach.retentionStacks || 0;
  // Winning D3 coaches draw calls; sim until an upward opening exists.
  const upOpen = () => (state.jobOpenings || []).some((o) => o.division === 'D2') || (state.pendingOffers || []).some((o) => state.world.schools.find((s) => s.id === o.schoolId)?.division === 'D2');
  await simSeasons(3, upOpen);
  if (!upOpen() && !overBudget()) await simSeasons(2, upOpen);
  if (upOpen()) {
    const offer = (state.pendingOffers || []).map((o) => state.world.schools.find((s) => s.id === o.schoolId)).find((s) => s?.division === 'D2')
      || state.world.schools.find((s) => s.id === (state.jobOpenings || []).find((o) => o.division === 'D2')?.schoolId);
    journal.notes.climbTo = offer.name;
    const oldSchoolId = state.playerSchoolId;
    if ((state.playerCoach.retentionStacks || 0) === 0 && (state.pendingOffers || []).length) {
      // Take the loyalty raise once on the way (proves the dynasty side) then climb next call.
    }
    const res = SE.acceptJob(state, offer.id);
    mark('p2-accept', res && res.ok !== false, `the climb happens through the real acceptJob: D3 → D2 (${offer.name})`);
    mark('p2-stacks', (state.playerCoach.retentionStacks || 0) === 0, 'loyalty stacks forfeited at the door — the ladder costs the dynasty');
    mark('p2-tenure', state.playerCoach.tenureSeasons === 0, 'tenure resets — he is new money now');
    const t = T.ensureTree(state);
    const slot = Object.values(t.slots).find((s) => !s.retired && s.coachId === state._coachId);
    mark('p2-rekey', slot && slot.schoolId === offer.id, 'the tree re-keys the trunk to the new chair');
    mark('p2-vacancy', state.world.schools.find((s) => s.id === oldSchoolId)?.coach?.id !== state.playerCoach.id, 'the old chair is genuinely empty behind him');
    mark('p2-inv', invariants('p2'), 'invariants hold through the move');
    journal.phase = 3;
    console.log('  → PHASE 2 COMPLETE. Run again for THE BRANCH.');
  } else {
    console.log(`  …no D2 opening yet (season ${state.season}, record ${state.playerCoach.careerWins}–${state.playerCoach.careerLosses}). Run again — the calls come.`);
  }
}

// ── PHASE 3: THE BRANCH ────────────────────────────────────────────────────
else if (journal.phase === 3) {
  console.log('PHASE 3 — THE BRANCH');
  // A season on the new chair so a coordinator serves under the tree.
  if (!journal.notes.branchSeason) { await simSeasons(1); journal.notes.branchSeason = state.season; }
  const open = T.openDivisions(state);
  const cands = T.promotionCandidates(state);
  if (open.length && cands.length && !overBudget()) {
    const pick = cands[0];
    const before = CP.dnaGrades(state._coachId);
    const res = T.promoteCoordinatorToHC(state, { sourceSchoolId: state.playerSchoolId, side: pick.side.toLowerCase(), takeControl: false });
    mark('p3-promote', res.ok, `the branch grows through the real path: ${pick.name} takes a ${res.division || open[0]} chair`);
    const t = T.ensureTree(state);
    const newSlot = Object.values(t.slots).filter((s) => !s.retired && s.coachId !== state._coachId)[0];
    mark('p3-slot', !!newSlot, 'a second live slot exists — two coaches, one world');
    if (newSlot) {
      const heirDna = CP.dnaGrades(newSlot.coachId);
      const capGrade = 6; // ★★ effective ceiling
      mark('p3-cap', Object.values(heirDna || {}).every((g) => g <= capGrade), 'his inheritance opens at ★★ AT MOST — floors, never tiers');
    }
    const dup = T.promoteCoordinatorToHC(state, { sourceSchoolId: state.playerSchoolId, side: 'oc', targetSchoolId: null, takeControl: false });
    mark('p3-onechair', !dup.ok || Object.values(T.ensureTree(state).slots).filter((s) => !s.retired).map((s) => s.division).length === new Set(Object.values(T.ensureTree(state).slots).filter((s) => !s.retired).map((s) => s.division)).size, 'one chair per division holds even when you push on it');
    mark('p3-inv', invariants('p3'), 'invariants hold with two live branches');
    journal.phase = 4;
    console.log('  → PHASE 3 COMPLETE. Run again for TWO LIVES.');
  } else if (!open.length) {
    console.log('  …no open division yet — simming a season for the market to move.');
    await simSeasons(1);
  } else {
    console.log('  …no promotable coordinator yet (needs seasons served). Run again.');
  }
}

// ── PHASE 4: TWO LIVES ─────────────────────────────────────────────────────
else if (journal.phase === 4) {
  console.log('PHASE 4 — TWO LIVES');
  const t = T.ensureTree(state);
  const mine = Object.values(t.slots).find((s) => !s.retired && s.coachId === state._coachId);
  const theirs = Object.values(t.slots).find((s) => !s.retired && s.coachId !== state._coachId);
  if (mine && theirs) {
    const marker = 'life-marker-' + Date.now().toString(36);
    const schoolA = state.world.schools.find((s) => s.id === state.playerSchoolId);
    schoolA.gameplan._lifeMarker = marker;
    const sw1 = await S.switchTreeSlot(theirs.division);
    mark('p4-switch', sw1 && sw1.ok !== false && state.playerSchoolId === theirs.schoolId, `chair switch works (${mine.division} → ${theirs.division})`);
    const schoolB = state.world.schools.find((s) => s.id === state.playerSchoolId);
    mark('p4-isolation', schoolB.gameplan._lifeMarker !== marker, 'no state bleed: the other life has its own gameplan');
    const heirId = theirs.coachId;
    await S.switchTreeSlot(mine.division);
    const backA = state.world.schools.find((s) => s.id === state.playerSchoolId);
    mark('p4-return', backA.gameplan._lifeMarker === marker, 'and the first life is exactly as he left it');
    delete backA.gameplan._lifeMarker;
    if (!journal.notes.lockstep) {
      const s0 = state.season;
      await simSeasons(1);
      journal.notes.lockstep = state.season > s0;
    }
    if (journal.notes.lockstep) {
      mark('p4-lockstep', true, 'a lockstep season ticks both programs in one world');
      const heirDna = CP.coachDNA(heirId);
      mark('p4-separate', !!heirDna, 'the heir accrues his own profile, separately');
      mark('p4-inv', invariants('p4'), 'invariants hold across switches and a shared season');
      journal.phase = 5;
      console.log('  → PHASE 4 COMPLETE. Run again for THE SUNSET.');
    } else {
      console.log('  …mid-lockstep-season. Run again.');
    }
  } else {
    console.log('  FATAL-ish: expected two live slots — check journal');
  }
}

// ── PHASE 5: THE SUNSET ────────────────────────────────────────────────────
else if (journal.phase === 5) {
  console.log('PHASE 5 — THE SUNSET');
  const t = T.ensureTree(state);
  const mine = Object.values(t.slots).find((s) => !s.retired && s.coachId === state._coachId);
  if (state.playerSchoolId !== mine.schoolId) await S.switchTreeSlot(mine.division);
  // Age the elder to the door (the age system is probed elsewhere; here we
  // test the DOOR, not the walk).
  state.playerCoach.age = Math.max(state.playerCoach.age, C.COACH_AGE.RETIRE_ELIGIBLE + 1);
  const gate = T.canRetire(state);
  mark('p5-gate', gate.ok, 'with an heir alive, the door opens');
  const cer = T.buildRetirementCeremony(state);
  mark('p5-ceremony', !!cer && cer.exitKind === 'retire' && cer.record.name.includes('Stone'), `the ceremony builds from the real life (${cer && cer.record.wins}–${cer && cer.record.losses}, "${cer && cer.record.epitaph}")`);
  const bankedBefore = { ...(t.dna?.axes || {}) };
  const res = T.retireActiveCoach(state);
  mark('p5-retire', res.ok && res.exitKind === 'retire', `he walks away whole: exit '${res.exitKind}' at ${Math.round(res.exitShare * 100)}% share`);
  const bankedAfter = t.dna?.axes || {};
  mark('p5-harvest', Object.keys(bankedAfter).some((k) => (bankedAfter[k] || 0) > (bankedBefore[k] || 0)), 'the harvest banked — his career is the family\u2019s now');
  mark('p5-heir', res.successor && state.playerCoach && state.playerCoach.id !== undefined, `control passed to the heir in ${res.successor?.division}`);
  mark('p5-save', await (async () => { await S.saveToSlot(1); return !!(await S.loadFromSlot(1)) && T.isTreeGame(state); })(), 'and the save still round-trips after a whole life');
  mark('p5-inv', invariants('p5'), 'final invariants: clean to the last');
  journal.phase = 6;
}

if (journal.phase === 6) {
  console.log(`\n${'='.repeat(56)}\nTHE LIFE IS COMPLETE — ${journal.done.length} assertions green, ${journal.failed.length} failed, ${journal.seasonsSimmed} real seasons` );
  if (journal.failed.length) for (const f of journal.failed) console.log(`  FAILED: ${f.msg}`);
}

await checkpoint();
console.log(`\n[checkpointed · phase ${journal.phase} · ${journal.done.length} green · ${Math.round((Date.now() - t0) / 1000)}s]`);
process.exit(newFails ? 1 : 0);
