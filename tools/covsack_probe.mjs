// covsack_probe.mjs — Fix B PROTOTYPE (AWR-gated coverage sack / throwaway).
//
// When the read is covered under pressure (best-available separation below
// C.COVSACK_COVERED_SEP while the QB is hurried — the would-be hold/sack),
// awareness decides the outcome:
//   • High-AWR QB  → THROWS IT AWAY (clean incompletion; no sack, no INT).
//   • Low-AWR QB   → FORCES it: mostly a checkdown/short completion, a small
//                    residual coverage sack, and an occasional forced throw into
//                    coverage (which can be picked — that feeds INT%).
//
// What this proves:
//   1. A high-AWR QB throws it away MORE than a low-AWR QB (per pass play).
//   2. A low-AWR QB FORCES a larger share of covered-pressure situations
//      (checkdown + coverage sack) than a high-AWR QB.
//   3. The coverage sack is a small residual (fewer than forced checkdowns).
//   4. Gated off (globalThis.__noCovSack) nothing fires.
//
// The stat_realism harness is the actual veto; this only proves the AWR split.
//
// Run: node tools/covsack_probe.mjs [gamesPerArm]
import { createPlayer, refreshRatings } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

const GAMES = Number(process.argv[2] || 60);

function roster(id, edit) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], 1);
      p.schoolId = id;
      r.push(p);
    }
  }
  const qb = r.find((p) => p.position === 'QB');
  edit(qb.attributes);
  refreshRatings(qb);
  return r;
}

// Heavy blitz + medium/deep-heavy → plenty of covered-under-pressure snaps.
const gp = { offFormation: 'Single Back', offFormations: [{ id: 'Single Back', weight: 100 }], tendency: 'Balanced', rushInPct: 30, passDepth: { short: 25, medium: 40, deep: 35 }, blitzPct: 45, defFormation: 'Balanced D', fourthDown: 'Moderate', clockMgmt: 'Normal', maxFGDist: 42 };
const sH = { id: 'H' }, sA = { id: 'A' };

function measure(edit) {
  let pass = 0, ta = 0, fc = 0, cs = 0, esc = 0;
  for (let i = 0; i < GAMES; i++) {
    const rH = roster('H', edit), rA = roster('A', edit);
    const res = simulateGame(sH, sA, rH, rA, buildDepthChart(rH, gp), buildDepthChart(rA, gp), gp, gp);
    for (const d of res.drives || []) for (const pl of d.plays || []) {
      if ((pl.type || '').startsWith('pass')) pass++;
      if (pl.throwAway) ta++;
      if (pl.forcedCheckdown) fc++;
      if (pl.coverageSack) cs++;
      if (pl.covScramble) esc++;
    }
  }
  return { pass, ta, fc, cs, esc };
}

// AWR arms hold mobility ~natural; mobility arms hold AWR fixed at 62 to isolate legs.
const AWR = (v) => (a) => { a.AWR = v; };
const MOB = (spd, awr) => (a) => { a.SPD = spd; a.AGI = spd; a.AWR = awr; };

globalThis.__noCovSack = false;
const hi = measure(AWR(92));
const lo = measure(AWR(55));
const scrambler = measure(MOB(93, 62));
const statue = measure(MOB(57, 62));
globalThis.__noCovSack = true;
const off = measure(AWR(55));
globalThis.__noCovSack = false;

const rate = (x, m) => 100 * x / (m.pass || 1);
const forceShare = (m) => (m.ta + m.fc + m.cs) ? (m.fc + m.cs) / (m.ta + m.fc + m.cs) : 0;

console.log(`=== COVERAGE SACK / THROWAWAY + dual-threat escape (Fix B) — ${GAMES} games/arm ===`);
console.log(`  high-AWR(92): throwAway ${hi.ta} (${rate(hi.ta,hi).toFixed(2)}%)  checkdown ${hi.fc}  covSack ${hi.cs}   forceShare ${(100*forceShare(hi)).toFixed(0)}%`);
console.log(`  low-AWR (55): throwAway ${lo.ta} (${rate(lo.ta,lo).toFixed(2)}%)  checkdown ${lo.fc}  covSack ${lo.cs}   forceShare ${(100*forceShare(lo)).toFixed(0)}%`);
console.log(`  scrambler(SPD93,AWR62): escape ${scrambler.esc}  covSack ${scrambler.cs}`);
console.log(`  statue   (SPD57,AWR62): escape ${statue.esc}  covSack ${statue.cs}`);
console.log(`  gated OFF   : throwAway ${off.ta}  checkdown ${off.fc}  covSack ${off.cs}  escape ${off.esc}`);

const p1 = rate(hi.ta, hi) > rate(lo.ta, lo);
const p2 = forceShare(lo) > forceShare(hi);
const p3 = (hi.cs + lo.cs) < (hi.fc + lo.fc);
const p4 = off.ta === 0 && off.fc === 0 && off.cs === 0 && off.esc === 0;
const p5 = scrambler.esc > statue.esc;
const p6 = rate(scrambler.cs, scrambler) < rate(statue.cs, statue);
const pass = p1 && p2 && p3 && p4 && p5 && p6;
console.log(`\n  [${p1?'PASS':'FAIL'}] high-AWR throws it away more than low-AWR`);
console.log(`  [${p2?'PASS':'FAIL'}] low-AWR forces a larger share of covered-pressure snaps`);
console.log(`  [${p3?'PASS':'FAIL'}] coverage sack is a small residual (< forced checkdowns)`);
console.log(`  [${p4?'PASS':'FAIL'}] gated off, nothing fires (incl. escape)`);
console.log(`  [${p5?'PASS':'FAIL'}] a scrambler escapes the covered-pressure snap with his legs more than a statue`);
console.log(`  [${p6?'PASS':'FAIL'}] a scrambler eats fewer coverage sacks than a statue (same AWR)`);
console.log(pass ? '\nALL PASS ✅ — AWR split + dual-threat escape behave as designed' : '\n⚠ FAIL');
process.exit(pass ? 0 : 1);
