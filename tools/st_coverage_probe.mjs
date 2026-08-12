// st_coverage_probe.mjs — the coverage half of the Special Teams card.
//
// The card promises "FG range & coverage +g%". FG range was wired (attemptFG); the COVERAGE
// half — winning the hidden-yardage battle on kick and punt returns — had no consumer at all.
// Now the kicking team's grade boosts coverageStrength, which feeds returnOutcome's
// (retRating − cov) edge, so a graded staff surrenders fewer return yards and fewer housed
// returns. Grade is player-coach only, so league play is untouched.
//
// Two deterministic checks (low noise — the yardage core is Monte-Carlo'd, not whole games):
//   1. the grade actually reaches coverage: coverageStrength(roster, 10) ≈ +10% over grade 0
//   2. that extra coverage cuts the return: fewer mean return yards AND fewer housed returns
//
// Usage: node tools/st_coverage_probe.mjs [samples]
import { coverageStrength, returnOutcome } from '../js/engine/sim.js';
import { createPlayer } from '../js/engine/player.js';
import { C } from '../js/constants.js';

const S = parseInt(process.argv[2] || '200000', 10);

// A representative coverage unit.
const roster = [];
for (const pos of ['LB','LB','LB','S','S','CB','CB','CB']) roster.push(createPlayer(pos, 'JR', 2));

const cov0  = coverageStrength(roster, 0);
const cov10 = coverageStrength(roster, 10);
console.log('Special Teams — coverage half of the card\n');
console.log(`coverageStrength  grade 0 : ${cov0.toFixed(2)}`);
console.log(`coverageStrength  grade 10: ${cov10.toFixed(2)}   (+${(100*(cov10/cov0-1)).toFixed(1)}%)`);

// A strong returner so there is something to suppress.
const RET = 78, START = 3, BASE = C.KICKOFF_RETURN_BASE;
function sample(cov) {
  let yds = 0, tds = 0;
  for (let i = 0; i < S; i++) { const r = returnOutcome(RET, cov, START, BASE); yds += r.yards; if (r.td) tds++; }
  return { avg: yds / S, tdRate: 100 * tds / S };
}
const r0 = sample(cov0), r10 = sample(cov10);
console.log(`\nreturn allowed  grade 0 : ${r0.avg.toFixed(2)} yds/ret   ${r0.tdRate.toFixed(2)}% housed`);
console.log(`return allowed  grade 10: ${r10.avg.toFixed(2)} yds/ret   ${r10.tdRate.toFixed(2)}% housed`);
console.log(`Δ ${(r10.avg-r0.avg).toFixed(2)} yds/ret   Δ ${(r10.tdRate-r0.tdRate).toFixed(2)}% housed`);

let fail = 0;
if (cov10 > cov0 * 1.05) console.log('\nreach: PASS — the grade lifts coverage strength.');
else { fail++; console.log('\nreach: FAIL — the grade did not reach coverageStrength.'); }
if (r10.avg < r0.avg && r10.tdRate < r0.tdRate) console.log('effect: PASS — graded coverage surrenders fewer return yards and fewer housed returns.');
else { fail++; console.log('effect: FAIL — coverage grade did not suppress returns.'); }

console.log(fail ? `\n${fail} FAILED` : `\nPASS — the coverage half of Special Teams now wins hidden yardage.`);
process.exit(fail ? 1 : 0);
