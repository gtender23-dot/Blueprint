// coverage_blend_sensitivity.mjs — derive the effective coverage blend by measurement.
//
// BLENDS.coverage in js/engine/contests.js still describes the attribute-blend formula
// that was RETIRED in July 2026 (Rung 7 Phase D). Separation now comes from
// js/engine/sepgeo.js routeDuel(): an emergent 10 Hz route duel where the defender's
// attributes enter as physics, not as coefficients —
//
//     SPD -> top speed        AGI -> acceleration       AWR -> reaction / zone trigger
//     TEC -> the sell + jam   STR -> the press jam only
//
// So there is no coefficient in the live path to copy into BLENDS, and the drift checker
// in tools/roleweights_from_contests.mjs greps sim.js for `SPD * 0.33`, which now only
// exists in _refSepAB — a frozen debug reference, not live code.
//
// This measures the blend instead: perturb one defender attribute at a time, observe the
// change in separation allowed, and normalize. A NEGATIVE dSep means raising the attribute
// reduces the receiver's separation, i.e. it makes the defender better — that's the sign we
// want, and its magnitude is the attribute's real weight in coverage.
//
// Usage: node tools/coverage_blend_sensitivity.mjs [repsPerCell]

import { routeDuel } from '../js/engine/sepgeo.js';

const REPS   = Number(process.argv[2] || 20000);
const ATTRS  = ['SPD', 'AGI', 'AWR', 'TEC', 'STR'];
const DEPTHS = ['short', 'medium', 'deep'];
// Rough live mix: man and zone carry most snaps, press and off-man the rest.
const COVERAGES = [['press', 0.22], ['man', 0.28], ['zone', 0.36], ['offman', 0.14]];

const player = attrs => ({
  attributes: { SPD: 50, AGI: 50, AWR: 50, TEC: 50, STR: 50, JMP: 50, HND: 50, ...attrs },
  compositeRating: 50,
});

function meanSep(defAttrs, depth, cov, reps) {
  const rec = player({});
  const def = player(defAttrs);
  let s = 0;
  for (let i = 0; i < reps; i++) s += routeDuel(rec, def, depth, cov, cov === 'press');
  return s / reps;
}

console.log(`Coverage sensitivity — ${REPS} route duels per cell`);
console.log('dSep = change in separation (yards) per +10 attribute points.');
console.log('Negative is good defense: less separation allowed.\n');

const overall = {};
for (const [cov, share] of COVERAGES) {
  console.log(`── ${cov}  (${(share * 100).toFixed(0)}% of snaps)`);
  console.log('   attr    short    medium     deep     mean');
  for (const a of ATTRS) {
    const per = DEPTHS.map(d => {
      const lo = meanSep({ [a]: 40 }, d, cov, REPS);
      const hi = meanSep({ [a]: 60 }, d, cov, REPS);
      return (hi - lo) / 2;                   // per +10 points
    });
    const m = per.reduce((s, v) => s + v, 0) / per.length;
    overall[a] = (overall[a] || 0) + m * share;
    console.log(`   ${a.padEnd(6)}${per.map(v => v.toFixed(3).padStart(9)).join('')}${m.toFixed(3).padStart(9)}`);
  }
  console.log('');
}

console.log('='.repeat(56));
console.log('\nSnap-weighted sensitivity (yards of separation per +10 pts):');
for (const a of ATTRS) console.log(`  ${a}  ${overall[a].toFixed(4)}`);

// Effective blend: only attributes that HELP coverage (negative dSep) earn weight.
const helping = ATTRS.filter(a => overall[a] < 0);
const mass = helping.reduce((s, a) => s + Math.abs(overall[a]), 0);
console.log('\nEffective coverage blend, normalized to 1.0:');
const blend = {};
for (const a of helping) blend[a] = Math.abs(overall[a]) / mass;
for (const a of helping) console.log(`  ${a}: ${blend[a].toFixed(2)}`);
const ignored = ATTRS.filter(a => overall[a] >= 0);
if (ignored.length) console.log(`  (no coverage value: ${ignored.join(', ')})`);

console.log('\nSuggested BLENDS.coverage row:');
console.log('  coverage: { ' + helping.sort((a, b) => blend[b] - blend[a])
  .map(a => `${a}: ${blend[a].toFixed(2)}`).join(', ') + ' },');
console.log('\nCurrent row in contests.js:');
console.log('  coverage: { SPD: 0.33, AGI: 0.28, AWR: 0.24, TEC: 0.15 }   <- describes the retired formula');
