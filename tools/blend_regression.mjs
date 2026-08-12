// blend_regression.mjs — derive a contest blend from a REALISTIC population.
//
// Why this exists. tools/coverage_blend_sensitivity.mjs measures one attribute at a time
// with everything else pinned at 50. That method is wrong in two ways that matter:
//
//   1. It samples a corner of the space no real player occupies. A 99-TEC corner with
//      50 speed does not exist, and the duel's emergent geometry behaves strangely there —
//      that method reported press TEC and deep-zone AWR as INVERTED, which real generated
//      corners flatly contradict (separation allowed falls monotonically with overall in
//      every technique).
//   2. It cannot see conditional value. AWR is the reaction beat: it pays off only when the
//      defender is otherwise in position to use it. Held at 50-everything, its contribution
//      measures as zero, and a generator fed that number would strip AWR out of every
//      coverage role.
//
// The method here instead takes REAL generated players as baselines and adds INDEPENDENT
// random jitter to each attribute. Independent jitter breaks the correlation between
// attributes (a real corner who is fast is usually also agile, which makes plain regression
// on unperturbed players unstable), while the baseline keeps the operating point realistic.
// Then it fits ordinary least squares of outcome on attributes. The coefficients are each
// attribute's real marginal value in the region where players actually live.
//
// Usage: node tools/blend_regression.mjs [samples] [dueksPerSample]

import { routeDuel }   from '../js/engine/sepgeo.js';
import { createPlayer } from '../js/engine/player.js';

const SAMPLES = Number(process.argv[2] || 500);
const DUELS   = Number(process.argv[3] || 300);
const ATTRS   = ['SPD', 'AGI', 'AWR', 'TEC', 'STR'];
const JITTER  = 14;                       // ± points of independent noise per attribute
const DEPTHS  = ['short', 'medium', 'deep'];
const COVERAGES = [['press', 0.22], ['man', 0.28], ['zone', 0.36], ['offman', 0.14]];

// ── ordinary least squares via normal equations ─────────────────────────────
// X is n x (k+1) with a leading intercept column. Solves (X'X)b = X'y by
// Gauss-Jordan with partial pivoting. k is 5 here, so this is plenty.
function ols(X, y) {
  const n = X.length, k = X[0].length;
  const A = Array.from({ length: k }, () => new Float64Array(k + 1));
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) { let s = 0; for (let r = 0; r < n; r++) s += X[r][i] * X[r][j]; A[i][j] = s; }
    let s = 0; for (let r = 0; r < n; r++) s += X[r][i] * y[r]; A[i][k] = s;
  }
  for (let c = 0; c < k; c++) {
    let piv = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    const d = A[c][c] || 1e-12;
    for (let j = c; j <= k; j++) A[c][j] /= d;
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = A[r][c];
      for (let j = c; j <= k; j++) A[r][j] -= f * A[c][j];
    }
  }
  return Array.from({ length: k }, (_, i) => A[i][k]);
}

const clamp99 = v => Math.max(1, Math.min(99, Math.round(v)));
const receivers = Array.from({ length: 120 }, () => createPlayer('WR', 'JR', 3));

function fit(cov) {
  const X = [], y = [];
  for (let s = 0; s < SAMPLES; s++) {
    // Realistic baseline, then independent jitter on every attribute.
    const base = createPlayer('CB', 'JR', 3);
    const attrs = { ...base.attributes };
    for (const a of ATTRS) attrs[a] = clamp99((attrs[a] ?? 50) + (Math.random() * 2 - 1) * JITTER);
    const def = { attributes: attrs, compositeRating: base.compositeRating };

    let sep = 0;
    for (let i = 0; i < DUELS; i++) {
      const rec = receivers[(s * 31 + i) % receivers.length];
      sep += routeDuel(rec, def, DEPTHS[i % DEPTHS.length], cov, cov === 'press');
    }
    X.push([1, ...ATTRS.map(a => attrs[a])]);
    y.push(sep / DUELS);
  }
  const b = ols(X, y);
  return Object.fromEntries(ATTRS.map((a, i) => [a, b[i + 1]]));
}

console.log(`Blend regression — ${SAMPLES} jittered real corners x ${DUELS} duels each, per technique`);
console.log(`baseline: real generated CBs (JR, D1); jitter +/-${JITTER} independent per attribute`);
console.log('coef = yards of separation allowed per +1 attribute point (negative = better coverage)\n');

const weighted = Object.fromEntries(ATTRS.map(a => [a, 0]));
for (const [cov, share] of COVERAGES) {
  const c = fit(cov);
  console.log(`  ${cov.padEnd(7)} ` + ATTRS.map(a => `${a} ${(c[a] * 1000).toFixed(2).padStart(7)}`).join('  ') + '   (x1000)');
  for (const a of ATTRS) weighted[a] += c[a] * share;
}

console.log('\nsnap-weighted coefficients (x1000):');
for (const a of ATTRS) console.log(`  ${a}  ${(weighted[a] * 1000).toFixed(2)}`);

const helping = ATTRS.filter(a => weighted[a] < 0);
const mass = helping.reduce((s, a) => s + Math.abs(weighted[a]), 0);
console.log('\nEffective coverage blend (attributes that reduce separation, normalized):');
const blend = {};
for (const a of helping) blend[a] = Math.abs(weighted[a]) / mass;
for (const a of helping.sort((x, z) => blend[z] - blend[x])) console.log(`  ${a}: ${blend[a].toFixed(2)}`);
const none = ATTRS.filter(a => weighted[a] >= 0);
if (none.length) console.log(`  (no measurable coverage value: ${none.join(', ')})`);

console.log('\n  coverage: { ' + helping.sort((x, z) => blend[z] - blend[x])
  .map(a => `${a}: ${blend[a].toFixed(2)}`).join(', ') + ' },');
console.log('\nfor comparison:');
console.log('  one-at-a-time at 50 : { SPD: 0.55, AGI: 0.24, TEC: 0.21 }   (AWR measured as worthless)');
console.log('  pre-July declared   : { SPD: 0.33, AGI: 0.28, AWR: 0.24, TEC: 0.15 }');
