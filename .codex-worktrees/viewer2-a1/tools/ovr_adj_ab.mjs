// ovr_adj_ab.mjs — PLAYTEST 2026-08-12 item 3: the controlled A/B for the
// OVR_POS_ADJ re-derive.
//
// WHY THIS EXISTS. `compositeRating` is not a cosmetic number. It is read on the
// field (the route duel blends 15% of it into both sides at sim.js:720/724, the
// read-priority "threat" scales with it at :2133, and the unit-average matchup at
// :3872 compares an offense's mean to a defense's mean) and off it
// (avgTop22Composite drives the CHEAP game path that resolves most of the world's
// games, plus playoff seeding and bowl-selection tiebreaks). So changing the
// per-position offsets is a BALANCE change, not a display change, and the
// run-game lesson applies: A/B in-process with matched RNG, never compare two
// separate harness runs.
//
// The offsets move by different amounts per position (OL -5.4, CB -6.6, K/P
// +3.5), so offense and defense do NOT shift together. That asymmetry is exactly
// what this measures.
//
//   node tools/ovr_adj_ab.mjs [N]
//
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS, OVR_POS_ADJ } from '../js/constants.js';

const N = parseInt(process.argv[2] || '400', 10);

// The re-derived block, from `pos_ovr_census_probe --derive` over 3 worlds
// (~75k players — the same sample size the constant's own comment cites).
// NOTE ON K AND P. The census says both display ~3.5 low, but they are NOT
// re-derived here. Nothing in the game compares a kicker's overall to a corner's
// — the number exists to rank kickers against kickers — and their composite
// feeds a separately calibrated kicking model. The first A/B run proved the
// cost: pulling K/P onto the 58 scale was the ONLY thing that moved scoring
// (+1.5 pts/team, straight through the FG model), while every other position
// moved display-only. Comparability across the SKILL positions is what the
// owner reported; kicker inflation is not, so K and P keep their offsets.
const DERIVED = {
  QB: -3.2, RB: 5.3, FB: 7.7, WR: -3.9, TE: 5.1, OL: -6.7, DE: 0.0,
  DT: -1.1, OLB: 1.3, LB: 2.3, CB: -5.6, S: -3.1,
  K: OVR_POS_ADJ.K, P: OVR_POS_ADJ.P,
};
const BASELINE = { ...OVR_POS_ADJ };

// Seeded PRNG so both arms see the SAME rosters and the same game rolls. Without
// this the arms drift apart on generation alone and the comparison is noise.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const realRandom = Math.random;

const gp = { offFormation: 'Single Back', tendency: 'Balanced', rushInPct: 60, passDepth: { short: 40, medium: 40, deep: 20 }, blitzPct: 20, defFormation: 'Balanced D', fourthDown: 'Moderate', clockMgmt: 'Normal', maxFGDist: 42 };
const sH = { id: 'H', name: 'Home' }, sA = { id: 'A', name: 'Away' };

function genRoster(tier, schoolId) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], tier);
      p.schoolId = schoolId;
      r.push(p);
    }
  }
  return r;
}

function runArm(label, adj) {
  // Install the arm's offsets, then pin RNG to the same seed for both arms.
  for (const k of Object.keys(OVR_POS_ADJ)) OVR_POS_ADJ[k] = adj[k];
  Math.random = mulberry32(20260812);

  const t = { games: 0, rush: 0, pass: 0, patt: 0, ratt: 0, pcomp: 0, pints: 0, plays: 0, pts: 0, sacks: 0, fum: 0 };
  const ovr = {};
  for (let i = 0; i < N; i++) {
    const rH = genRoster(1, 'H'), rA = genRoster(1, 'A');
    for (const p of rH) (ovr[p.position] || (ovr[p.position] = [])).push(p.compositeRating);
    const cH = buildDepthChart(rH, gp), cA = buildDepthChart(rA, gp);
    const res = simulateGame(sH, sA, rH, rA, cH, cA, gp, gp);
    for (const st of [res.homeStats, res.awayStats]) {
      t.rush += st.rushYds; t.pass += st.passYds;
      t.patt += st.passAtt; t.pcomp += st.compAtt; t.pints += st.ints;
      t.ratt += st.rushAtt; t.plays += st.rushAtt + st.passAtt;
      t.sacks += st.sacksAllowed || 0; t.fum += st.fumbles || 0;
    }
    t.pts += res.homeScore + res.awayScore; t.games += 2;
  }
  Math.random = realRandom;

  const g = t.games;
  const meanOvr = {};
  for (const k of Object.keys(ovr)) meanOvr[k] = ovr[k].reduce((a, b) => a + b, 0) / ovr[k].length;
  return {
    label,
    pts: t.pts / g, rush: t.rush / g, pass: t.pass / g,
    comp: t.pcomp / t.patt * 100, ypa: t.pass / t.patt,
    intPct: t.pints / t.patt * 100, ypc: t.rush / t.ratt,
    sacks: t.sacks / g, fum: t.fum / g, plays: t.plays / g,
    meanOvr,
  };
}

console.log(`\n=== OVR_POS_ADJ A/B — ${N} games/arm, matched RNG ===`);
const A = runArm('baseline', BASELINE);
const B = runArm('re-derived', DERIVED);
// Leave the module in its shipped state.
for (const k of Object.keys(OVR_POS_ADJ)) OVR_POS_ADJ[k] = BASELINE[k];

const ROWS = [
  ['points/team', 'pts', 1], ['rush yds/team', 'rush', 1], ['pass yds/team', 'pass', 1],
  ['comp %', 'comp', 1], ['yds/att', 'ypa', 2], ['INT %', 'intPct', 2],
  ['yds/carry', 'ypc', 2], ['sacks/team', 'sacks', 2], ['fumbles/team', 'fum', 2],
  ['plays/team', 'plays', 1],
];
console.log('\n  metric            baseline   re-derived      delta');
for (const [label, key, dp] of ROWS) {
  const d = B[key] - A[key];
  console.log(`  ${label.padEnd(16)} ${A[key].toFixed(dp).padStart(8)} ${B[key].toFixed(dp).padStart(12)} ${((d >= 0 ? '+' : '') + d.toFixed(dp)).padStart(10)}`);
}

console.log('\n  mean displayed OVR by room (what the coach actually reads)');
console.log('  pos    baseline   re-derived      delta');
for (const pos of Object.keys(BASELINE)) {
  const a = A.meanOvr[pos], b = B.meanOvr[pos];
  if (a == null || b == null) continue;
  const d = b - a;
  console.log(`  ${pos.padEnd(5)} ${a.toFixed(1).padStart(9)} ${b.toFixed(1).padStart(12)} ${((d >= 0 ? '+' : '') + d.toFixed(1)).padStart(10)}`);
}

// The bar. A recalibration is supposed to change what the number SAYS, not how
// the game PLAYS — so on-field output should sit inside sampling noise.
let fail = 0;
const band = (label, delta, tol, unit = '') => {
  const ok = Math.abs(delta) <= tol;
  if (!ok) fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(30)} Δ ${(delta >= 0 ? '+' : '') + delta.toFixed(2)}${unit} (tol ±${tol})`);
};
console.log('\n  on-field output must not move:');
band('points/team', B.pts - A.pts, 1.5);
band('completion %', B.comp - A.comp, 1.5, '%');
band('yards/attempt', B.ypa - A.ypa, 0.35);
band('yards/carry', B.ypc - A.ypc, 0.2);
band('rush yds/team', B.rush - A.rush, 8);
band('sacks/team', B.sacks - A.sacks, 0.3);

console.log(`\n${fail === 0 ? 'ALL PASS ✅ — the numbers changed, the football did not' : `${fail} OUT OF BAND ❌ — the re-derive moves play, not just display`}`);
process.exit(fail === 0 ? 0 : 1);
