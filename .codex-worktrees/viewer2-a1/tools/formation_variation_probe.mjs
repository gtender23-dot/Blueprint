// formation_variation_probe — Creativity Tools P1b.
// Proves: (1) no-variation ≡ baseline, byte-for-byte at every hook (inert-by-
// default); (2) every declared delta is actually applied (pkg / matchup /
// situational / passLean); (3) personnel legality — a varied package still
// fields exactly five skill players; (4) pickedVariation reads the gameplan
// entry back. Imports straight from js/ so it describes the shipping code.
import { FORMATION_VARIATIONS, FORMATION_PACKAGES, FORMATION_SITUATIONAL, MATCHUP_MATRIX, FORMATIONS, aliasFormation } from '../js/constants.js';
import { getMatchupEdge, getSituationalMod, resolvePersonnel, variedPackage, variationPassLeanDelta, pickedVariation, formationVariation } from '../js/engine/formations.js';

let pass = 0, fail = 0;
const bad = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; bad.push(msg); } }

const FRONTS = Object.keys(MATCHUP_MATRIX[Object.keys(MATCHUP_MATRIX)[0]]);
const SIT_ARGS = { // (down, distance, clock, fieldPos) that lands in each bucket
  redZone: [1, 10, 800, 97],
  shortYardage: [3, 1, 800, 50],
  thirdLong: [3, 9, 800, 50],
  twoMinute: [1, 10, 60, 50],
  standard: [1, 10, 800, 50]
};

// ── 1. Inert-by-default: null varKey === base everywhere ──────────────────
for (const fid of Object.keys(FORMATION_PACKAGES)) {
  for (const def of FRONTS) {
    ok(getMatchupEdge(fid, def, null) === (MATCHUP_MATRIX[fid]?.[def] ?? 1),
      `inert matchup ${fid} vs ${def}`);
  }
  for (const [bucket, a] of Object.entries(SIT_ARGS)) {
    ok(getSituationalMod(fid, a[0], a[1], a[2], a[3], null) === (FORMATION_SITUATIONAL[fid]?.[bucket] ?? 1),
      `inert situational ${fid} ${bucket}`);
  }
  ok(variationPassLeanDelta(fid, null) === 0, `inert passLean ${fid}`);
  ok(JSON.stringify(variedPackage(fid, null)) === JSON.stringify(FORMATION_PACKAGES[aliasFormation(fid)] || FORMATION_PACKAGES['Single Back']),
    `inert package ${fid}`);
}

// ── 2/3. Each variation: deltas applied + personnel legality ──────────────
let varCount = 0;
for (const [fid, set] of Object.entries(FORMATION_VARIATIONS)) {
  ok(!!FORMATION_PACKAGES[fid], `base formation exists for ${fid}`);
  for (const [key, v] of Object.entries(set)) {
    varCount++;
    // pkg legality: exactly 5 skill players (RB+FB+TE+WR), OL/QB untouched
    const pkg = variedPackage(fid, key);
    const skill = (pkg.RB || 0) + (pkg.FB || 0) + (pkg.TE || 0) + (pkg.WR || 0);
    ok(skill === 5, `${fid} (${key}) fields 5 skill, got ${skill}`);
    // matchup deltas applied + clamped to [0.75,1.25]
    if (v.matchup) for (const [def, d] of Object.entries(v.matchup)) {
      const base = MATCHUP_MATRIX[fid]?.[def] ?? 1;
      const exp = Math.max(0.75, Math.min(1.25, base + d));
      ok(Math.abs(getMatchupEdge(fid, def, key) - exp) < 1e-9, `${fid} (${key}) matchup vs ${def}`);
    }
    // situational deltas applied + clamped to [0.6,1.35]
    if (v.situational) for (const [bucket, d] of Object.entries(v.situational)) {
      const a = SIT_ARGS[bucket];
      const base = FORMATION_SITUATIONAL[fid]?.[bucket] ?? 1;
      const exp = Math.max(0.6, Math.min(1.35, base + d));
      ok(Math.abs(getSituationalMod(fid, a[0], a[1], a[2], a[3], key) - exp) < 1e-9, `${fid} (${key}) situational ${bucket}`);
    }
    // passLean delta returned exactly
    ok(variationPassLeanDelta(fid, key) === (v.lean?.passLean || 0), `${fid} (${key}) passLean delta`);
    // pkg override actually changed something OR it's an alignment-only variant
    if (v.pkg) {
      const basePkg = FORMATION_PACKAGES[fid];
      const changed = Object.entries(v.pkg).some(([p, n]) => (basePkg[p] || 0) !== n);
      ok(changed, `${fid} (${key}) pkg override is a real delta`);
    }
    // resolvePersonnel with a real depth chart honors the varied package counts
    const depth = { OL: ['o1','o2','o3','o4','o5'], QB: ['q1'], RB: ['r1','r2','r3'], FB: [], TE: ['t1','t2','t3'], WR: ['w1','w2','w3','w4'] };
    const per = resolvePersonnel(fid, depth, key);
    const filled = (per.RB.length) + (per.FB.length) + (per.TE.length) + (per.WR.length);
    ok(filled === 5, `${fid} (${key}) resolvePersonnel fields 5 skill, got ${filled}`);
  }
}

// ── 4. pickedVariation reads the gameplan entry ───────────────────────────
ok(pickedVariation([{ id: 'Trips/Bunch', variation: 'closed', weight: 30 }], 'Trips/Bunch') === 'closed', 'pickedVariation finds entry');
ok(pickedVariation([{ id: 'Trips/Bunch', weight: 30 }], 'Trips/Bunch') === null, 'pickedVariation null when absent');
ok(pickedVariation([{ id: 'Spread', variation: 'ace', weight: 30 }], 'Trips/Bunch') === null, 'pickedVariation only matches chosen id');
ok(formationVariation('Trips/Bunch', 'closed')?.label === 'Closed', 'formationVariation resolves label');
ok(formationVariation('Trips/Bunch', 'nope') === null, 'formationVariation null on unknown key');

console.log(`FORMATION VARIATION PROBE — ${varCount} variations across ${Object.keys(FORMATION_VARIATIONS).length} formations`);
console.log(`  checks: ${pass} pass, ${fail} fail`);
if (fail) { console.log('  FAILURES:'); bad.slice(0, 20).forEach((m) => console.log('   -', m)); }
console.log(fail ? 'FORMATION VARIATION PROBE FAIL' : 'FORMATION VARIATION PROBE PASS');
process.exit(fail ? 1 : 0);
