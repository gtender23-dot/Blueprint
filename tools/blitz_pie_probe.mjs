// blitz_pie_probe.mjs — TOMBSTONE (2026-08-19).
//
// The pressure pie this probe used to gate NO LONGER EXISTS. It was replaced by
// the BLITZER LIST in pressure batch 3 — see `Ref/PRESSURE_REDESIGN_2026-08-19.md`
// and section P5 of `tools/pressure_cohesion_probe.mjs`, which is now the live
// gate for "who comes".
//
// WHY THE PIE WENT (owner, 2026-08-19): "blitz share pie is clear when it's used
// properly. It's not clear when someone sets 1 guy to 100% and then wants to
// bring the house, and then has no calls in the playbook to accommodate it."
// The audit found the field meant four different things at once — the plan doc
// called it a 100% pie, the UI never normalized it, Simple mode wrote 100 to
// each of THREE slots, and the sim read relative weights for ONE rush seat. A
// coach who set three men to 100 got 33/33/33 of a single seat.
//
// The three checks that died with it, kept here as the record of what the pie
// promised, so nobody resurrects the mechanism without knowing what it cost:
//   1. "70/30 LB/S pie puts the safety on ~30% of heat" — the seat-1 lottery.
//   2. "undialed control keeps the identity pick" — the control arm for (1).
//   3. "heat 100 vs 0 ≈ 3× the fired rate" — the per-front HEAT dial, retired
//      because it was a SECOND owner of "how often", silently absent on 28% of
//      passing downs, and it muted headset calls (contradicting OD-3).
//
// One check from the old probe DID survive the transition and is worth
// remembering: "undialed plans: switch is a no-op" passed throughout the
// rewrite, which is the byte-identical property the redesign preserves — an
// empty list consumes no RNG and every AI plan takes the old path exactly.
//
// This file remains as a GUARD: the pie must stay retired. If someone reintroduces
// the fields the sim once read, this goes red and points them at the design note.
//
// Run: node tools/blitz_pie_probe.mjs
import { readFileSync } from 'fs';

let pass = 0, fail = 0;
const check = (ok, msg, detail = '') => {
  if (ok) pass++; else fail++;
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}${detail ? `  [${detail}]` : ''}`);
};
const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

console.log('\nTHE PRESSURE PIE IS RETIRED — this probe is a tombstone guard');
{
  const sim = src('js/engine/sim.js');
  check(!/_pieHeat/.test(sim),
    'the per-front HEAT dial is gone from the sim — the aggression stop is the single owner of "how often"');
  check(!/pieUsed/.test(sim),
    'the seat-1 pie lottery is gone — the blitzer list fills seats now');
  check(!/BLITZ PIE \(Ref\/BLITZ_PIE_PLAN/.test(sim),
    'no pie block remains in the rush resolver');
  check(/defPlan\.blitzers/.test(sim),
    'and the replacement IS wired — the resolver reads the blitzer list',
    'gated in detail by tools/pressure_cohesion_probe.mjs section P5');
}

console.log(`\nBLITZ PIE TOMBSTONE — ${pass} pass, ${fail} fail`);
console.log(fail ? 'BLITZ PIE TOMBSTONE FAIL (the pie has been resurrected — read Ref/PRESSURE_REDESIGN_2026-08-19.md)' : 'BLITZ PIE TOMBSTONE PASS');
process.exit(fail ? 1 : 0);
