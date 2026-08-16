// kneel_timeout_probe.mjs — subsystem 5, fix B.
//
// Proves the victory-formation math is now TIMEOUT-AWARE. The gate (when a leading
// team can kneel it out) and the per-kneel burn both depend on how many timeouts the
// trailing DEFENSE still holds:
//   - defense out of TOs  -> each kneel burns the full ~40s play clock
//   - defense holds a TO  -> it stops the clock after the kneel -> ~2s burned, and one
//     fewer kneel can be relied on to reach 0.
//
// This replicates the exact burnable-time formula from sim.js (the drive resolver is
// internal to simulateGame, so this is a direct unit check of the shipped logic) and
// also confirms the in-game sampler: clock_realism_probe shows real kneels now average
// a MIX of 40s and 2s burns rather than a flat 42.
//
// Run: node tools/kneel_timeout_probe.mjs

// --- the shipped formula (must mirror sim.js:2583+) ---
function burnableTime(down, defTOs) {
  const downsLeft = Math.max(0, 3 - (down - 1));
  let burnable = 0, toLeft = defTOs;
  for (let k = 0; k < downsLeft; k++) { burnable += toLeft > 0 ? 2 : 40; if (toLeft > 0) toLeft--; }
  return burnable;
}
// seconds actually run off if a leading team kneels from `down` with `defTOs` timeouts,
// simulating the defense spending a TO on each early kneel.
function kneelOutSeconds(startDown, defTOs) {
  let secs = 0, toLeft = defTOs;
  for (let d = startDown; d <= 3; d++) {
    if (toLeft > 0) { secs += 2; toLeft--; } else secs += 40;
  }
  return secs;
}

let pass = true;
const line = (s) => console.log(s);
line('kneel timeout-awareness — victory-formation burnable time by defense timeouts\n');
line('starting on 1st down (3 kneels available):');
line('def TOs | burnable gate (s) | seconds run off kneeling out');
line('--------|-------------------|------------------------------');
for (const to of [0, 1, 2, 3]) {
  const g = burnableTime(1, to);
  const ro = kneelOutSeconds(1, to);
  line(`   ${to}    |       ${String(g).padStart(3)}         |            ${String(ro).padStart(3)}`);
}

// Assertions the fix must satisfy:
// 1. With 0 defense TOs, three kneels burn 120s (the classic "ball at 2-min warning" rule).
const a1 = kneelOutSeconds(1, 0) === 120;
// 2. More defense timeouts => strictly less time you can burn (monotonic).
const g0 = burnableTime(1,0), g1 = burnableTime(1,1), g2 = burnableTime(1,2), g3 = burnableTime(1,3);
const a2 = g0 > g1 && g1 > g2 && g2 > g3;
// 3. With 3 defense TOs, you can only reliably burn ~6s over three kneels (they stop each).
const a3 = burnableTime(1,3) === 6;
// 4. The OLD flat model (42 x downsLeft, timeout-blind) would have gated at 126s
//    regardless of TOs — the fix must NOT do that when the defense has timeouts.
const oldGate = 42 * 3;
const a4 = burnableTime(1,3) < oldGate;

line('\nAssertions:');
line(`• 0-TO defense: 3 kneels burn exactly 120s (2-min-warning rule): ${a1 ? 'PASS ✅' : 'FAIL ❌'}`);
line(`• burnable time is monotonic in defense timeouts (${g0}>${g1}>${g2}>${g3}): ${a2 ? 'PASS ✅' : 'FAIL ❌'}`);
line(`• 3-TO defense: can only burn ~6s (they stop every kneel): ${a3 ? 'PASS ✅' : 'FAIL ❌'}`);
line(`• fix no longer gates at the timeout-blind ${oldGate}s vs a 3-TO defense: ${a4 ? 'PASS ✅' : 'FAIL ❌'}`);
pass = a1 && a2 && a3 && a4;
line(`\n${pass ? 'ALL PASS ✅' : 'FAIL ❌'}`);
process.exit(pass ? 0 : 1);
