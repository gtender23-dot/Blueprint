// starter_hold_probe.mjs — PLAYTEST 2026-08-12 item 13: A NAMED STARTER STAYS
// THE STARTER.
//
// The owner started a 49-OVR QB over a 50 and reported that it "doesn't hold
// through a full season — inconsistent, and especially the coaching after
// halftime." That was four separate defects, and nothing in the 132-probe
// manifest asserted the law they all break. This probe is that law:
//
//   1. pinnedFirst promotes a named man to the front of his room, whatever the
//      ratings say.
//   2. beginSecondHalf preserves the pin. It used to assign raw
//      school.depthChart — which is compositeRating order — so the pinned QB led
//      for two quarters and the 50 took over in the third. This is the exact
//      "coaching after halftime" symptom.
//   3. beginSecondHalf still honours the pre-game dress: a man who was held out
//      (redshirt) cannot appear in the second half.
//   4. The three-places law holds — every offensive mesh key the resolver knows
//      is a key the sim reads (MESH_DEPTH_KEYS ⊇ the offensive MESH_AUTO_POOL),
//      which is what FADE was failing.
//
// Run: node tools/starter_hold_probe.mjs
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { pinnedFirst, simulateFirstHalf, simulateSecondHalf } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};

const gp = () => ({
  offFormation: 'Pro-Set', tendency: 'Balanced', rushInPct: 60,
  passDepth: { short: 40, medium: 40, deep: 20 }, blitzPct: 20,
  defFormation: 'Balanced D', fourthDown: 'Moderate', clockMgmt: 'Normal', maxFGDist: 42,
});

function genRoster(s) {
  const r = [];
  for (const [pos, c] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < c; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], 1); p.schoolId = s; r.push(p); }
  }
  return r;
}

// A room where the coach's man is measurably WORSE than the auto pick — the
// whole point of the report. 49 vs 50 is the owner's exact case.
function riggedQBs(roster) {
  const qbs = roster.filter((p) => p.position === 'QB');
  // Flatten the rest of the room so the ONLY question is 50 vs 49.
  for (const q of qbs) q.compositeRating = 30;
  qbs[0].compositeRating = 50;
  qbs[1].compositeRating = 49;
  return { auto: qbs[0], pinned: qbs[1] };
}

// ── 1. pinnedFirst promotes, regardless of rating ────────────────────────────
{
  const roster = genRoster('H');
  const { auto, pinned } = riggedQBs(roster);
  const chart = buildDepthChart(roster, gp());
  check('baseline chart is rating-ordered (the 50 leads)', chart.QB[0] === auto.id,
    `QB1=${chart.QB[0] === auto.id ? '50 ovr' : '?'}`);

  const plan = gp();
  plan.fieldAssignments = { offense: { 'Pro-Set': { slots: { QB: pinned.id }, shares: {} } }, defense: {} };
  const dressed = pinnedFirst(chart, plan);
  check('pinnedFirst puts the coach’s man first', dressed.QB[0] === pinned.id,
    `QB1 is the 49 (${pinned.id === dressed.QB[0]})`);
  check('pinnedFirst keeps everyone else, in order', dressed.QB.length === chart.QB.length && dressed.QB.includes(auto.id),
    `${dressed.QB.length} QBs, the 50 still on the chart`);
  check('pinnedFirst is inert with no pins', pinnedFirst(chart, gp()).QB[0] === chart.QB[0]);
}

// ── 2. THE HALFTIME LAW: the pin survives the break ──────────────────────────
{
  const rH = genRoster('H'), rA = genRoster('A');
  const { auto, pinned } = riggedQBs(rH);
  const gpH = gp(), gpA = gp();
  gpH.fieldAssignments = { offense: { 'Pro-Set': { slots: { QB: pinned.id }, shares: {} } }, defense: {} };

  const chartH = buildDepthChart(rH, gpH);
  const chartA = buildDepthChart(rA, gpA);
  // What season.js hands the sim at kickoff: the DRESSED depth, pins first.
  const dressedH = pinnedFirst(chartH, gpH);
  const homeSchool = { id: 'H', name: 'H', roster: rH, depthChart: chartH, gameplan: gpH };
  const awaySchool = { id: 'A', name: 'A', roster: rA, depthChart: chartA, gameplan: gpA };

  const token = simulateFirstHalf(homeSchool, awaySchool, rH, rA, dressedH, chartA, gpH, gpA);
  check('first half starts the coach’s man', token.homeTeam.depth.QB[0] === pinned.id);

  simulateSecondHalf(token);
  check('SECOND HALF still starts the coach’s man', token.homeTeam.depth.QB[0] === pinned.id,
    token.homeTeam.depth.QB[0] === pinned.id ? 'pin held through the break' : 'REVERTED to the rating order');
  check('the 50 did not take the job at halftime', token.homeTeam.depth.QB[0] !== auto.id);
}

// ── 3. The break must not un-hold a man who was held out ─────────────────────
{
  const rH = genRoster('H'), rA = genRoster('A');
  const { pinned } = riggedQBs(rH);
  const gpH = gp(), gpA = gp();
  gpH.fieldAssignments = { offense: { 'Pro-Set': { slots: { QB: pinned.id }, shares: {} } }, defense: {} };
  const chartH = buildDepthChart(rH, gpH);

  // One receiver is held out of this game entirely (the redshirt case).
  const heldOut = rH.find((p) => p.position === 'WR' && chartH.WR.indexOf(p.id) > 0);
  const dressedH = {};
  for (const [pos, ids] of Object.entries(pinnedFirst(chartH, gpH))) {
    dressedH[pos] = ids.filter((id) => id !== heldOut.id);
  }
  const homeSchool = { id: 'H', name: 'H', roster: rH, depthChart: chartH, gameplan: gpH };
  const awaySchool = { id: 'A', name: 'A', roster: rA, depthChart: buildDepthChart(rA, gpA), gameplan: gpA };

  const token = simulateFirstHalf(homeSchool, awaySchool, rH, rA, dressedH, awaySchool.depthChart, gpH, gpA);
  check('held-out man is not dressed in H1', !token.homeTeam.depth.WR.includes(heldOut.id));
  simulateSecondHalf(token);
  check('held-out man is STILL not dressed in H2', !token.homeTeam.depth.WR.includes(heldOut.id),
    'the break refreshes the chart without un-doing the pre-game dress');
  check('and the QB pin survived that refresh too', token.homeTeam.depth.QB[0] === pinned.id);
}

// ── 4. The three-places law, statically ──────────────────────────────────────
{
  const src = await import('node:fs').then((fs) => fs.readFileSync(new URL('../js/engine/sim.js', import.meta.url), 'utf8'));
  const m = src.match(/const MESH_DEPTH_KEYS = \[([^\]]*)\]/);
  const simKeys = m ? m[1].split(',').map((x) => x.trim().replace(/["']/g, '')).filter(Boolean) : [];
  const fa = await import('../js/engine/fieldassign.js');
  const pool = fa.MESH_AUTO_POOL || {};
  const offMesh = ['SLOT', 'WING', 'ABACK', 'WILDCAT', 'JETMAN', 'FADE'];
  const known = offMesh.filter((k) => Object.prototype.hasOwnProperty.call(pool, k));
  const missing = known.filter((k) => !simKeys.includes(k));
  check('sim reads every offensive mesh key the resolver accepts', missing.length === 0,
    missing.length ? `MISSING from MESH_DEPTH_KEYS: ${missing.join(', ')}` : `${known.length} keys agree`);
  check('FADE specifically is in MESH_DEPTH_KEYS', simKeys.includes('FADE'),
    'the picker offered it and the resolver accepted it while the sim ignored it');
}

console.log(`\n${fail === 0 ? 'ALL PASS ✅' : `${fail} FAILURES ❌`}  (${pass} pass, ${fail} fail)`);
process.exit(fail === 0 ? 0 : 1);
