// fourth_down_probe.mjs — subsystem 5, fix C.
//
// Measures the 4th-down GO rate the decision model produces across the
// (distance x field position x game-state) surface, against the modern-analytics
// break-even. fourthDownDecision rolls Math.random() internally, so each scenario is
// sampled many times and the go-share reported.
//
// Anchors (from the sources): real 4th-and-3 converts ~45% and already beats a punt
// from midfield by expected points; short yardage on plus territory is a near-automatic
// go. The old curve (0.55/0.40/0.22 base) sat below this; fix C raises it toward
// break-even while KEEPING the coach dial and game-state multipliers as swings.
//
// Run: node tools/fourth_down_probe.mjs [samplesPerCell]
import { fourthDownDecision } from '../js/engine/sim.js';

const S = parseInt(process.argv[2] || '4000', 10);

// fieldPos = yards from own goal (so 60 = opponent 40). distFromGoal = 100 - fieldPos.
function goRate(fieldPos, distance, approach, scoreMargin, secsLeft, canFG) {
  const distFromGoal = 100 - fieldPos;
  const maxFG = 42 + 17;
  let go = 0;
  for (let i = 0; i < S; i++) {
    if (fourthDownDecision(fieldPos, distance, distFromGoal, maxFG, canFG, approach, scoreMargin, secsLeft) === 'go') go++;
  }
  return 100 * go / S;
}

const NEUTRAL = { approach: 'Moderate', margin: 0, secs: 9999 };
console.log(`4th-down GO% surface — ${S} samples/cell, Moderate approach, tied, early\n`);
console.log('field (own-yardline) | 4th&1 | 4th&2 | 4th&3 | 4th&5 | 4th&8');
console.log('---------------------|-------|-------|-------|-------|------');
for (const [label, fp, canFG] of [
  ['own 25            ', 25, false],
  ['own 45 (midfield) ', 45, false],
  ['opp 45            ', 55, false],
  ['opp 35 (FG range) ', 65, true],
  ['opp 20 (gimme FG) ', 80, true],
]) {
  const r = (d) => goRate(fp, d, NEUTRAL.approach, NEUTRAL.margin, NEUTRAL.secs, canFG).toFixed(0).padStart(4);
  console.log(`${label}   | ${r(1)}% | ${r(2)}% | ${r(3)}% | ${r(5)}% | ${r(8)}%`);
}

// Sanity reads the fix must satisfy (directional, analytics-anchored):
const midShort1 = goRate(45, 1, 'Moderate', 0, 9999, false);
const midShort3 = goRate(45, 3, 'Moderate', 0, 9999, false);
const plusShort1 = goRate(55, 1, 'Moderate', 0, 9999, false);
const ownDeepLong = goRate(15, 8, 'Moderate', 0, 9999, false);
const cons1 = goRate(55, 1, 'Conservative', 0, 9999, false);
const aggr1 = goRate(55, 1, 'Aggressive', 0, 9999, false);

console.log('\nReads:');
console.log(`• midfield (own 45) 4th-and-1 is now a strong go: ${midShort1.toFixed(0)}%  ${midShort1 >= 50 ? '✅' : '❌ (want >=50)'}`);
console.log(`• midfield 4th-and-3 near the ~45% convert anchor: ${midShort3.toFixed(0)}%  ${midShort3 >= 25 ? '✅' : '❌ (want >=25)'}`);
console.log(`• plus-territory 4th-and-1 near-automatic: ${plusShort1.toFixed(0)}%  ${plusShort1 >= 60 ? '✅' : '❌ (want >=60)'}`);
console.log(`• deep-own 4th-and-8 stays rare: ${ownDeepLong.toFixed(1)}%  ${ownDeepLong <= 5 ? '✅' : '❌ (want <=5)'}`);
console.log(`• coach dial still swings it (Aggr ${aggr1.toFixed(0)}% > Cons ${cons1.toFixed(0)}%): ${aggr1 > cons1 ? '✅' : '❌'}`);
const legacyOk = midShort1 >= 50 && midShort3 >= 25 && plusShort1 >= 60 && ownDeepLong <= 5 && aggr1 > cons1;

// ── PASS 6 (G9): WP-context gates ────────────────────────────────────────────
// fourthDownDecision now takes ctx = {fgProb, oppEdge}. These gates script the
// audit's named scenarios directly against the exported function.
function decideRate(want, fieldPos, distance, margin, secs, canFG, ctx) {
  const distFromGoal = 100 - fieldPos;
  let hit = 0;
  for (let i = 0; i < S; i++) {
    if (fourthDownDecision(fieldPos, distance, distFromGoal, 59, canFG, 'Moderate', margin, secs, ctx) === want) hit++;
  }
  return 100 * hit / S;
}
console.log('\nPASS 6 (G9) WP gates:');
// (a) down 2, 0:35, 4th-and-8 at the opp 20, makeable kick → KICK, not go.
const kickWins = decideRate('fg', 80, 8, -2, 35, true, { fgProb: 0.82, oppEdge: 0 });
// (b) same clock down 4, 4th-and-4 → the FG is worthless alone; the
//     forced-go floor (0.85 at makeable distance) stands.
const down4go = decideRate('go', 80, 4, -4, 35, true, { fgProb: 0.82, oppEdge: 0 });
// (b2) down 2, 0:35, 4th-and-4, makeable kick → kick (the tie is the WP play).
const down2kick4 = decideRate('fg', 80, 4, -2, 35, true, { fgProb: 0.82, oppEdge: 0 });
// (c) marginal leg vs elite leg on a long try, neutral game, 4th-and-2:
//     the weak leg pushes toward GO (no safety net), the elite leg kicks more.
const weakLegGo = decideRate('go', 62, 2, 0, 9999, true, { fgProb: 0.34, oppEdge: 0 });
const eliteLegGo = decideRate('go', 62, 2, 0, 9999, true, { fgProb: 0.80, oppEdge: 0 });
// (d) juggernaut opponent raises the midfield 4th-and-2 go-rate.
const jugGo = decideRate('go', 45, 2, 0, 9999, false, { fgProb: 0, oppEdge: 0.30 });
const evenGo = decideRate('go', 45, 2, 0, 9999, false, { fgProb: 0, oppEdge: 0 });
// (e) a sub-28% prayer is not a real option: long try, weak leg → not fg.
const prayerFG = decideRate('fg', 58, 9, 0, 9999, true, { fgProb: 0.20, oppEdge: 0 });
// (f) kill-switch reproduces the legacy mix (ctx ignored under __noWP4th).
globalThis.__noWP4th = true;
const killKick = decideRate('fg', 80, 8, -2, 35, true, { fgProb: 0.82, oppEdge: 0 });
delete globalThis.__noWP4th;
const legacyKick = decideRate('fg', 80, 8, -2, 35, true, null);

console.log(`• down 2, 0:35, opp 20, 4th-and-8 → kick: ${kickWins.toFixed(0)}%  ${kickWins >= 85 ? '✅' : '❌ (want >=85)'}`);
console.log(`• down 4, 0:35, 4th-and-4 → still go: ${down4go.toFixed(0)}%  ${down4go >= 80 ? '✅' : '❌ (want >=80)'}`);
console.log(`• down 2, 0:35, 4th-and-4 → kick: ${down2kick4.toFixed(0)}%  ${down2kick4 >= 70 ? '✅' : '❌ (want >=70)'}`);
console.log(`• weak leg goes more than elite leg (${weakLegGo.toFixed(0)}% vs ${eliteLegGo.toFixed(0)}%): ${weakLegGo - eliteLegGo >= 8 ? '✅' : '❌ (want gap >=8)'}`);
console.log(`• juggernaut opponent lifts go-rate (${jugGo.toFixed(0)}% vs ${evenGo.toFixed(0)}%): ${jugGo - evenGo >= 5 ? '✅' : '❌ (want gap >=5)'}`);
console.log(`• sub-28% prayer never kicked: ${prayerFG.toFixed(1)}%  ${prayerFG <= 1 ? '✅' : '❌ (want <=1)'}`);
console.log(`• __noWP4th ≈ legacy (${killKick.toFixed(0)}% vs ${legacyKick.toFixed(0)}%): ${Math.abs(killKick - legacyKick) <= 5 ? '✅' : '❌'}`);

const wpOk = kickWins >= 85 && down4go >= 80 && down2kick4 >= 70 && weakLegGo - eliteLegGo >= 8 && jugGo - evenGo >= 5 && prayerFG <= 1 && Math.abs(killKick - legacyKick) <= 5;
const ok = legacyOk && wpOk;
console.log(`\n${ok ? 'ALL PASS ✅' : 'FAIL ❌'}`);
process.exit(ok ? 0 : 1);
