// kicking_model_probe.mjs — before/after for the K/P attribute model.
//
// Today: FG range and punt distance read STR only; accuracy/consistency read TEC only.
// PWR and AWR do nothing for specialists, and neither is RECRUIT_CORE, so kickers spawn
// PWR ~37 and AWR ~19 against STR/TEC ~50.
//
// Target model: distance = STR + PWR, accuracy = TEC + AWR.
//
// The trap this probe exists to catch: blending in two attributes that generate ~15-30
// points lower silently nerfs every kicker in the league. This measures FG% by distance
// and punt distance under both models so the change can be made balance-neutral rather
// than by eye.
//
// Real-world targets documented in sim.js: FBS kickers make ~72-77% overall, ~92% inside
// 30 yards. Punts average ~44 gross.
//
// Usage: node tools/kicking_model_probe.mjs [cohort]

import { createPlayer }              from '../js/engine/player.js';
import { attemptFG, puntDistance }  from '../js/engine/sim.js';

// These call the SHIPPED functions rather than re-implementing them. tools/kicker_check.mjs
// shows why that matters: it carries a private copy of the FG formula that drifted out of
// date (rangeCenter 38 + (str-50)*0.42 against the shipped 46 + (str-50)*0.22), so it has
// been grading its own arithmetic instead of the game.
const asDepth = p => [{ ...p, id: 'x' }];
const fgRate = (attrs, dist, n = 400) => {
  const roster = asDepth({ attributes: attrs });
  let makes = 0;
  for (let i = 0; i < n; i++) if (attemptFG(roster, { K: ['x'] }, dist)) makes++;
  return (makes / n) * 100;
};
const puntOf = (attrs, n = 400) => {
  const roster = asDepth({ attributes: attrs });
  return Array.from({ length: n }, () => puntDistance(roster, { P: ['x'] }));
};

// ── cohorts ──────────────────────────────────────────────────────────────────
const N = Number(process.argv[2] || 500);
const kickers = Array.from({ length: N }, () => createPlayer('K', 'JR', 1).attributes);
const punters = Array.from({ length: N }, () => createPlayer('P', 'JR', 1).attributes);

const mean = xs => xs.reduce((s, v) => s + v, 0) / (xs.length || 1);
const BUCKETS = [[18, 29, 'inside 30'], [30, 39, '30-39'], [40, 49, '40-49'], [50, 59, '50+']];

console.log(`K/P model, measured through the SHIPPED sim functions — ${N} specialists per position\n`);
for (const [label, c] of [['K', kickers], ['P', punters]]) {
  console.log(`  ${label}  STR ${mean(c.map(a => a.STR)).toFixed(1)}  PWR ${mean(c.map(a => a.PWR)).toFixed(1)}` +
              `  TEC ${mean(c.map(a => a.TEC)).toFixed(1)}  AWR ${mean(c.map(a => a.AWR)).toFixed(1)}`);
}

console.log('\nFIELD GOALS — make%, by true attempt distance (real target in brackets)');
const T = { 'inside 30': '~92%', '30-39': '~80%', '40-49': '~68%', '50+': '~45%' };
let allMakes = 0, allN = 0;
for (const [lo, hi, label] of BUCKETS) {
  let makes = 0, n = 0;
  for (const a of kickers) for (let d = lo; d <= hi; d += 3) { const r = fgRate(a, d, 60); makes += r; n++; allMakes += r; allN++; }
  console.log(`  ${label.padEnd(11)}${(makes / n).toFixed(1).padStart(7)}%      ${T[label]}`);
}
// OVERALL on the same basis the ~72-77% target is quoted on: a uniform spread of real
// attempt distances (20-55), NOT an unweighted average of the buckets above, which would
// over-represent 50-yarders relative to how often they're actually kicked.
let oMakes = 0, oN = 0;
for (const a of kickers) for (let d = 20; d <= 55; d += 3) { oMakes += fgRate(a, d, 60); oN++; }
console.log(`  ${'OVERALL'.padEnd(11)}${(oMakes / oN).toFixed(1).padStart(7)}%      ~72-77%  (uniform 20-55)`);

const ys = punters.flatMap(a => puntOf(a, 12));
const sorted = [...ys].sort((x, y) => x - y);
console.log(`\nPUNTING — mean ${mean(ys).toFixed(1)}   p10 ${sorted[Math.floor(ys.length * 0.1)]}   p90 ${sorted[Math.floor(ys.length * 0.9)]}   (real ~44 gross)`);
