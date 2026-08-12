// kicker_check.mjs — FG make% + punt distribution by kicker type.
//
// Fixed Aug 2026: this used to carry PRIVATE copies of the FG/punt formulas that
// had drifted out of date (rangeCenter 38 + (str-50)*0.42 vs the shipped
// 48 + (leg-50)*0.22), so every number it printed described code that wasn't
// shipping. It now Monte-Carlos the REAL exported attemptFG() / puntDistance(),
// and asserts a few shipped-behavior invariants so it FAILS if the kicking model
// regresses.
//
// Run: node tools/kicker_check.mjs [trials]
import { attemptFG, puntDistance } from '../js/engine/sim.js';

const TRIALS = Number(process.argv[2] || 20000);

// Minimal roster/depth carrying one specialist. leg = 0.5*STR+0.5*PWR,
// acc = 0.5*TEC+0.5*AWR — so set STR=PWR=str and TEC=AWR=tech to hit a clean
// (leg=str, acc=tech) point.
function unit(str, tech) {
  const roster = [{ id: 'K1', attributes: { STR: str, PWR: str, TEC: tech, AWR: tech } }];
  const depth = { K: ['K1'], P: ['K1'] };
  return { roster, depth };
}
function fgProb(str, tech, distance, n = TRIALS) {
  const { roster, depth } = unit(str, tech);
  let made = 0;
  for (let i = 0; i < n; i++) if (attemptFG(roster, depth, distance, 0)) made++;
  return made / n;
}
function samplePunt(str, tech, n = TRIALS) {
  const { roster, depth } = unit(str, tech);
  const vals = Array.from({ length: n }, () => puntDistance(roster, depth));
  const avg = vals.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - avg) ** 2, 0) / n);
  return { avg, sd };
}

const DISTANCES = [25, 32, 38, 42, 47, 52, 57];
const KICKERS = [
  { label: 'Avg     STR60/TECH60', str: 60, tech: 60 },
  { label: 'Accurate STR60/TECH95', str: 60, tech: 95 },
  { label: 'Big-leg  STR90/TECH50', str: 90, tech: 50 },
  { label: 'Elite    STR85/TECH90', str: 85, tech: 90 },
];

console.log('\n=== FG MAKE% BY DISTANCE & KICKER TYPE (real attemptFG, n=' + TRIALS + ') ===');
const distHeader = DISTANCES.map(d => String(d).padStart(6)).join('');
console.log(`  ${'Kicker'.padEnd(24)} ${distHeader}`);
const fgTable = {};
for (const k of KICKERS) {
  const row = DISTANCES.map(d => fgProb(k.str, k.tech, d));
  fgTable[k.label] = row;
  console.log(`  ${k.label.padEnd(24)} ${row.map(p => (p * 100).toFixed(0).padStart(6)).join('')}`);
}

const PUNTERS = [
  { label: 'Avg     STR60/TECH50', str: 60, tech: 50 },
  { label: 'Accurate STR60/TECH95', str: 60, tech: 95 },
  { label: 'Big-leg  STR90/TECH50', str: 90, tech: 50 },
];
console.log('\n=== PUNT DISTANCE DISTRIBUTION (real puntDistance, n=' + TRIALS + ' each) ===');
console.log(`  ${'Punter'.padEnd(24)}  avg_dist   σ`);
const punt = {};
for (const p of PUNTERS) {
  punt[p.label] = samplePunt(p.str, p.tech);
  console.log(`  ${p.label.padEnd(24)}  ${punt[p.label].avg.toFixed(1).padStart(6)}   ${punt[p.label].sd.toFixed(1)}`);
}

// ── teeth: shipped-behavior invariants (fail if the model regresses) ──────────
let fails = 0;
const chk = (cond, msg) => { if (!cond) fails++; console.log(`  ${cond ? 'PASS' : 'FAIL'} ${msg}`); };
console.log('\n=== INVARIANTS ===');
const avgRow = fgTable['Avg     STR60/TECH60'];
const monotonic = avgRow.every((v, i) => i === 0 || v <= avgRow[i - 1] + 1e-9);
chk(monotonic, 'FG make% is non-increasing with distance');
const iLong = DISTANCES.indexOf(52);
chk(fgTable['Big-leg  STR90/TECH50'][iLong] > avgRow[iLong], 'a bigger leg makes more 52-yarders than an average leg');
const iMid = DISTANCES.indexOf(42);
chk(fgTable['Elite    STR85/TECH90'][iMid] >= avgRow[iMid], 'an elite kicker is at least as good as average at 42');
chk(punt['Big-leg  STR90/TECH50'].avg > punt['Avg     STR60/TECH50'].avg, 'a bigger leg punts farther on average');
chk(punt['Accurate STR60/TECH95'].sd < punt['Big-leg  STR90/TECH50'].sd, 'a more accurate punter has tighter spread');

console.log(fails ? `\n⚠ FAIL — ${fails} invariant(s) broke` : '\nALL PASS ✅ — kicking model behaves as shipped');
process.exit(fails ? 1 : 0);
