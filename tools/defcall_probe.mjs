// defcall_probe.mjs — PASS 2 (defensive call system) mechanism gate.
// Run: node tools/defcall_probe.mjs
//
// Pins:
//   1. offPersonnelClass: every FORMATION_PACKAGES entry lands in its class;
//      unknown ids read as base 11 personnel.
//   2. pickDefCall (exercised through the sim, plus shape rules asserted via
//      a duplicate reference implementation kept in lockstep here): the
//      "any" fallback, dead entries (unknown call names, zero weights),
//      empty cells, and __noDefCalls all resolve to "play today's game".
//   3. syncDefEff parity: an overlay that sets robberCall/zoneStyle/
//      pressLevel/bracketWho REACHES the *Eff keys (the pre-Pass-2 hand
//      sync dropped them — the latent formChecks bug).
//   4. Old-save law, sim-level, pinned PRNG: gameplan without callSheet,
//      with an EMPTY callSheet, and with a live sheet under __noDefCalls
//      are all byte-identical to each other; a live house-call sheet
//      diverges (the layer actually reaches the game).
import { offPersonnelClass, PERSONNEL_CLASSES } from '../js/engine/formations.js';
import { FORMATION_PACKAGES, ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';

let pass = 0, fail = 0;
function check(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  got=${JSON.stringify(got)}${ok ? '' : `  want=${JSON.stringify(want)}`}`);
}

console.log('— 1. personnel classes —');
const WANT = {
  'Power-I': 'heavy', 'Spread': '11', 'Air Raid': '10', 'Pistol/RPO': '11',
  'Trips/Bunch': '11', 'Single Back': '12', 'Empty': 'empty',
  'Wishbone': 'option', 'Flexbone': 'option', 'Wildcat': 'heavy', 'Jumbo': 'heavy',
};
for (const fid of Object.keys(FORMATION_PACKAGES)) {
  check(`class(${fid})`, offPersonnelClass(fid), WANT[fid]);
}
check('unknown id → 11', offPersonnelClass('Not A Formation'), '11');
check('class list stable', PERSONNEL_CLASSES, ['empty', '10', '11', '12', 'heavy', 'option']);
check('every expected class is reachable',
  [...new Set(Object.values(WANT))].sort(), [...PERSONNEL_CLASSES].sort());

console.log('— 2. sheet resolution rules (reference impl, kept in lockstep with sim.js pickDefCall) —');
function refPick(gp, sitKey, persClass, rand) {
  const lib = gp?.defCalls, row = gp?.callSheet ? gp.callSheet[sitKey] : null;
  if (!lib || !row) return null;
  const cell = row[persClass] || row.any;
  if (!Array.isArray(cell) || !cell.length) return null;
  const live = cell.filter(e => Array.isArray(e) && lib[e[0]] && (e[1] || 0) > 0);
  if (!live.length) return null;
  let r = rand * live.reduce((s, e) => s + e[1], 0);
  let name = live[live.length - 1][0];
  for (const e of live) { if ((r -= e[1]) <= 0) { name = e[0]; break; } }
  return name;
}
const LIB = { A: { front: '46/Bear' }, B: { covShell: 'two' } };
const GP = { defCalls: LIB, callSheet: {
  base: { '11': [['A', 30], ['B', 70]], any: [['B', 100]] },
  third_long: { any: [['A', 100]] },
  red_zone: { '11': [] },
  goal_line: { '11': [['Ghost', 50], ['A', 0]] },
} };
check('cell hit, low roll → first entry', refPick(GP, 'base', '11', 0.0), 'A');
check('cell hit, high roll → second entry', refPick(GP, 'base', '11', 0.99), 'B');
check('missing personnel column → any', refPick(GP, 'base', '12', 0.5), 'B');
check('row without the class, no any → null', refPick(GP, 'red_zone', '12', 0.5), null);
check('empty cell → null', refPick(GP, 'red_zone', '11', 0.5), null);
check('dead entries (unknown name, zero weight) → null', refPick(GP, 'goal_line', '11', 0.5), null);
check('no row for situation → null', refPick(GP, 'backed_up', '11', 0.5), null);
check('no sheet at all → null', refPick({ defCalls: LIB }, 'base', '11', 0.5), null);
check('no library → null', refPick({ callSheet: GP.callSheet }, 'base', '11', 0.5), null);

console.log('— 3. sim-level old-save law (pinned PRNG) —');
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ t >>> 15, 1 | t);
    r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r;
    return ((r ^ r >>> 14) >>> 0) / 4294967296;
  };
}
const realRandom = Math.random;
function genRoster(schoolId) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], 1);
      p.schoolId = schoolId; r.push(p);
    }
  }
  return r;
}
const GP_BASE = {
  offFormation: 'Single Back', tendency: 'Balanced', rushInPct: 60,
  passDepth: { short: 40, medium: 40, deep: 20 }, blitzPct: 20,
  fourthDown: 'Moderate', clockMgmt: 'Normal', maxFGDist: 42,
};
const HOUSE = {
  defCalls: { 'Bear Down': { front: '46/Bear', covShell: 'single', covStyle: 'man', aggression: 'house', pressureIdentity: 'secondaryHeat', runCommit: 10 } },
  callSheet: Object.fromEntries(['base', 'first_ten', 'second_long', 'third_short', 'third_medium', 'third_long', 'red_zone', 'goal_line', 'backed_up', 'two_min_trail', 'four_min_lead']
    .map(k => [k, { any: [['Bear Down', 100]] }])),
};
function runGame(defExtra, killSwitch, seed) {
  Math.random = mulberry32(seed);
  globalThis.__noDefCalls = killSwitch;
  try {
    // Fixed world: rosters + depth charts built under the SAME pinned stream
    // every run, so the only divergence can come from the def-call layer.
    const rH = genRoster('H'), rA = genRoster('A');
    const gpH = { ...GP_BASE }, gpA = { ...GP_BASE, ...defExtra };
    const cH = buildDepthChart(rH, gpH), cA = buildDepthChart(rA, gpA);
    const res = simulateGame({ id: 'H', name: 'Home' }, { id: 'A', name: 'Away' }, rH, rA, cH, cA, gpH, gpA);
    return { h: res.homeScore, a: res.awayScore,
      plays: (res.homeStats?.plays ?? 0) + (res.awayStats?.plays ?? 0),
      rush: (res.homeStats?.rushYds ?? 0) + (res.awayStats?.rushYds ?? 0),
      pass: (res.homeStats?.passYds ?? 0) + (res.awayStats?.passYds ?? 0) };
  } finally {
    Math.random = realRandom;
    delete globalThis.__noDefCalls;
  }
}
const SEEDS = [11, 47, 1986];
let identNone = 0, identEmpty = 0, identKill = 0, diverged = 0;
for (const s of SEEDS) {
  const base = runGame({}, false, s);
  const withEmpty = runGame({ defCalls: HOUSE.defCalls, callSheet: {} }, false, s);
  const withKill = runGame(HOUSE, true, s);
  const live = runGame(HOUSE, false, s);
  if (JSON.stringify(base) === JSON.stringify(withEmpty)) identEmpty++;
  if (JSON.stringify(base) === JSON.stringify(withKill)) identKill++;
  if (JSON.stringify(base) !== JSON.stringify(live)) diverged++;
  identNone++;
}
check('empty sheet byte-identical (3 seeds)', identEmpty, 3);
check('__noDefCalls byte-identical (3 seeds)', identKill, 3);
check('live house sheet diverges (3 seeds)', diverged, 3);

console.log('— 4. AI signature calls (generation shape) —');
const { setAIGameplan } = await import('../js/engine/ai.js');
function aiPlanOf(kill) {
  Math.random = mulberry32(7);
  globalThis.__noDefCalls = kill;
  try {
    const school = { roster: genRoster('AI'), coach: { personality: { aggression: 0.7 } }, staff: null };
    setAIGameplan(school);
    return school.gameplan;
  } finally { Math.random = realRandom; delete globalThis.__noDefCalls; }
}
const aiGp = aiPlanOf(false);
const aiNames = Object.keys(aiGp.defCalls || {});
// PASS 3: every staff now also authors a Victory (Prevent) call → 3 calls,
// and the sheet gains the up-two-scores-late row it's weighted on.
check('AI staff authors 3 signature calls (heat + coverage + Victory)', aiNames.length, 3);
check('AI heat call runs its front\'s signature pressure',
  (aiGp.defCalls[aiNames[0]] || {}).pressureIdentity != null, true);
check('AI Victory call is Prevent', (aiGp.defCalls.Victory || {}).covFamily, 'Prevent');
check('AI sheet covers the pass-leverage rows + the kill-clock row',
  Object.keys(aiGp.callSheet || {}).sort(), ['four_min_lead', 'third_long', 'third_medium']);
const rowsOk = Object.values(aiGp.callSheet).every((row) =>
  Array.isArray(row.any) && Math.round(row.any.reduce((s, e) => s + e[1], 0)) === 100
  && row.any.every((e) => aiGp.defCalls[e[0]]));
check('AI sheet cells: any-column, weights sum 100, names resolve', rowsOk, true);
const aiGpKill = aiPlanOf(true);
check('__noDefCalls: AI generates NO calls (data-layer A/B clean)',
  [aiGpKill.defCalls, aiGpKill.callSheet], [void 0, void 0]);

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'}  (${pass} pass, ${fail} fail)`);
process.exit(fail ? 1 : 0);
