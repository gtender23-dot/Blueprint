// read_conflict_probe.mjs — QB PLAY Fix C (read-conflict / take-what's-open).
//
// Claim (USA Football reads; #10/#11/#24 progressions): a QB reads a defender and
// throws the man he leaves — he takes what's open rather than forcing the featured
// star. Fix C adds an AWR-scaled "find the open man" term to qbRead: a heady QB
// up-weights a clearly-open secondary over a featured-but-covered primary; a raw QB
// stares down the star.
//
// Unit test on the exported qbRead: present a two-man conflict (an OPEN outlet vs a
// COVERED featured receiver) and measure how often the QB takes the open man.
//   1. A high-AWR QB takes the open man more than a low-AWR QB.
//   2. Turning the fix off (globalThis.__noReadConflict) shrinks that AWR gap.
//
// Run: node tools/read_conflict_probe.mjs [trials]
import { qbRead } from '../js/engine/sim.js';

const N = Number(process.argv[2] || 40000);

function targets() {
  return [
    { receiverId: 'open', receiver: { id: 'open' }, separation: 0.60, shareWeight: 15, bracketed: false, passDepth: 'medium' },
    { receiverId: 'cov', receiver: { id: 'cov' }, separation: 0.30, shareWeight: 34, bracketed: false, passDepth: 'medium' }
  ];
}

function openRate(awr) {
  let open = 0;
  const qb = { attributes: { AWR: awr } };
  for (let i = 0; i < N; i++) {
    const pick = qbRead(targets(), 0, qb, 0);
    if (pick && pick.receiverId === 'open') open++;
  }
  return 100 * open / N;
}

console.log(`=== READ-CONFLICT (Fix C) — open-man pick rate in a covered-star conflict, N=${N} ===`);
globalThis.__noReadConflict = false;
const hiOn = openRate(95), loOn = openRate(60);
globalThis.__noReadConflict = true;
const hiOff = openRate(95), loOff = openRate(60);
globalThis.__noReadConflict = false;

console.log(`  Fix C ON : high-AWR takes open ${hiOn.toFixed(1)}%  | low-AWR ${loOn.toFixed(1)}%  (gap ${(hiOn-loOn).toFixed(1)}pp)`);
console.log(`  Fix C OFF: high-AWR takes open ${hiOff.toFixed(1)}%  | low-AWR ${loOff.toFixed(1)}%  (gap ${(hiOff-loOff).toFixed(1)}pp)`);

const p1 = hiOn > loOn;                          // awareness finds the open man
const p2 = (hiOn - loOn) > (hiOff - loOff) + 1;  // the fix is what widens the AWR gap
const pass = p1 && p2;
console.log(`\n  [${p1?'PASS':'FAIL'}] high-AWR QB takes the open man more than low-AWR`);
console.log(`  [${p2?'PASS':'FAIL'}] the fix widens the awareness gap vs gated-off`);
console.log(pass ? '\nALL PASS ✅ — the QB reads the open man, not just the star' : '\n⚠ FAIL');
