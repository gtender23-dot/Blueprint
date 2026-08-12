// motion_read_probe.mjs — reading coverage off pre-snap motion, the way football does it.
//
// Motion makes the shell declare itself (man travels with the mover, zone passes him off).
// A DISCIPLINED secondary disguises the rotation, so the QB reads it wrong MORE often against
// a sharp secondary and LESS against a sloppy one; a sharper QB reads it better. Through
// Jul 2026 this was inverted (a sharp secondary was the EASIEST to read) and a misread had no
// throw-side consequence — it only changed a log label, so motion was near-free.
//
// The HARD GATE is on the misread-probability curve itself (motionMisreadProb, exported from
// sim.js): it must rise with secondary AWR and fall with QB AWR. Deterministic, noise-free.
// The end-to-end outcome table is INFORMATIONAL — motion fires on a minority of snaps and its
// whole-game completion signal sits inside sampling noise at any sane game count.
//
// Usage: node tools/motion_read_probe.mjs [games]   (games only affects the informational table)
import { motionMisreadProb } from '../js/engine/sim.js';

const qbAvg = 72;
const secTiers = [30, 45, 60, 75, 90];
console.log('Misread probability vs secondary AWR (QB AWR 72) — must RISE with a sharper secondary:');
const bySec = secTiers.map(a => ({ a, p: motionMisreadProb(a, qbAvg) }));
for (const { a, p } of bySec) console.log(`  secondary AWR ${String(a).padStart(2)}  ->  misread ${(p * 100).toFixed(1)}%`);

const secAvg = 72;
const qbTiers = [30, 45, 60, 75, 90];
console.log('\nMisread probability vs QB AWR (secondary AWR 72) — must FALL with a sharper QB:');
const byQb = qbTiers.map(a => ({ a, p: motionMisreadProb(secAvg, a) }));
for (const { a, p } of byQb) console.log(`  QB AWR ${String(a).padStart(2)}  ->  misread ${(p * 100).toFixed(1)}%`);

let fail = 0;
const secRises = bySec.every((c, i) => i === 0 || c.p >= bySec[i - 1].p) && bySec[bySec.length - 1].p > bySec[0].p;
const qbFalls  = byQb.every((c, i) => i === 0 || c.p <= byQb[i - 1].p) && byQb[byQb.length - 1].p < byQb[0].p;
if (!secRises) { fail++; console.log('\nFAIL - misread does not rise with secondary AWR; a disciplined secondary is not disguising the read.'); }
if (!qbFalls)  { fail++; console.log('FAIL - misread does not fall with QB AWR; a sharper processor is not reading better.'); }
if (!fail) console.log('\nPASS - a sharper secondary disguises the read; a sharper QB sees through it.');

const N = parseInt(process.argv[2] || '0', 10);
if (N > 0) {
  const { createPlayer, refreshRatings } = await import('../js/engine/player.js');
  const { buildDepthChart } = await import('../js/engine/world.js');
  const { simulateGame } = await import('../js/engine/sim.js');
  const { ROSTER_TARGETS, CLASS_YEARS } = await import('../js/constants.js');
  const genRoster = id => { const r = []; for (const [pos, c] of Object.entries(ROSTER_TARGETS)) for (let i = 0; i < c; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], 1); p.schoolId = id; r.push(p); } return r; };
  const pinSec = (r, awr) => { for (const p of r) if (['CB','S','FS','SS'].includes(p.position)) { p.attributes.AWR = awr; refreshRatings(p); } };
  const gp = m => ({ offFormation:'Pro-Set', tendency:'Balanced', rushInPct:45, passDepth:{short:40,medium:40,deep:20}, blitzPct:20, defFormation:'Balanced D', fourthDown:'Moderate', clockMgmt:'Normal', maxFGDist:42, motionRate:m });
  const sH = { id:'H', name:'Home' }, sA = { id:'A', name:'Away' };
  const arm = (awr, m) => { let att=0, comp=0; for (let i=0;i<N;i++){ const rH=genRoster('H'), rA=genRoster('A'); pinSec(rA,awr); const cH=buildDepthChart(rH,gp(m)), cA=buildDepthChart(rA,gp(20)); const st=simulateGame(sH,sA,rH,rA,cH,cA,gp(m),gp(20)).homeStats; att+=st.passAtt; comp+=st.compAtt; } return 100*comp/(att||1); };
  console.log(`\nInformational - motion payoff (Δcomp%, ${N} games/arm; noisy, not gated):`);
  for (const [l, a] of [['weak (55)',55],['elite (90)',90]]) {
    const d = arm(a,100) - arm(a,0);
    console.log(`  vs ${l.padEnd(10)}  dComp% ${(d>=0?'+':'')}${d.toFixed(2)}`);
  }
}
process.exit(fail ? 1 : 0);
