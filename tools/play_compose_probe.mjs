// play_compose_probe — Creativity Tools, the Play Composer Model B-i rulebook.
// Proves the two safety guarantees + that the parts→grade derivation is
// football-sensible: (1) BAND — every derived grade of every buildable play sits
// in the catalog band [BAND_LO, BAND_HI]; (2) AI-INVISIBLE — compiling never
// touches PASS_CONCEPTS, so the AI can't select composed plays (human-call-only
// by construction); (3) exec weights are valid (sum to 1); (4) the rulebook maps
// route parts to the right coverage answers (verticals beat single-high & lose to
// two-deep; crossers beat man; curls sit in zone; screens beat the blitz).
import { PLAYCOMPOSE_SCHEMA_VERSION, BAND_LO, BAND_HI, COVERAGES, ROUTE_PARTS, routePartList, emptyComposedPlay, validateComposedPlay, compilePlay } from '../js/engine/playcompose.js';
import { PASS_CONCEPTS } from '../js/concepts.js';

let pass = 0, fail = 0;
const bad = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; bad.push(msg); } }

const PART_IDS = Object.keys(ROUTE_PARTS);

// ── snapshot PASS_CONCEPTS to prove AI-invisibility later ───────────────────
const conceptKeysBefore = JSON.stringify(Object.keys(PASS_CONCEPTS).sort());

// ── validation ──────────────────────────────────────────────────────────────
ok(validateComposedPlay({ name: 'Smash-ish', kind: 'pass', parts: ['corner', 'flat'] }).ok, 'valid 2-part play');
ok(!validateComposedPlay({ name: 'x', parts: ['go'] }).ok, 'too few parts rejected (<2)');
ok(!validateComposedPlay({ name: 'x', parts: ['go', 'go', 'go', 'go', 'go', 'go'] }).ok, 'too many parts rejected (>5)');
ok(!validateComposedPlay({ name: 'x', parts: ['go', 'notaroute'] }).ok, 'unknown route part rejected');
ok(!validateComposedPlay({ name: 'x', kind: 'run', parts: ['go', 'flat'] }).ok, 'kind=run rejected (v1 passes only)');
ok(!validateComposedPlay({ name: 'x', parts: ['go', 'flat'], formations: ['Nope'] }).ok, 'unknown formation rejected');
let vv = validateComposedPlay({ name: 'x', parts: ['screen', 'checkdown'] });
ok(vv.ok && vv.warnings.some((w) => w.includes('never threatens downfield')), 'all-behind-LOS play warns (no wide routes)');
ok(emptyComposedPlay('Blank').schemaVersion === PLAYCOMPOSE_SCHEMA_VERSION && routePartList().length === PART_IDS.length, 'empty + part list helpers');

// ── (1) BAND: exhaustively build every 2- and 3-part play, assert in-band ───
let built = 0;
function checkPlay(parts) {
  const c = compilePlay({ name: 'T', kind: 'pass', parts });
  built++;
  for (const cov of COVERAGES) {
    const g = c.vs[cov];
    if (!(g >= BAND_LO - 1e-9 && g <= BAND_HI + 1e-9)) { ok(false, `[${parts.join('+')}] ${cov}=${g} OUT OF BAND`); return; }
  }
  // exec valid: each position sums to 1
  for (const [posn, w] of Object.entries(c.exec)) {
    const s = Object.values(w).reduce((a, b) => a + b, 0);
    if (Math.abs(s - 1) > 0.005) { ok(false, `[${parts.join('+')}] exec ${posn} sums ${s}`); return; }
  }
  if (!['short', 'medium', 'deep'].includes(c.depth)) { ok(false, `[${parts.join('+')}] bad depth ${c.depth}`); return; }
  if (!(c.minWR >= 1 && c.minWR <= 4)) { ok(false, `[${parts.join('+')}] bad minWR ${c.minWR}`); return; }
}
for (let i = 0; i < PART_IDS.length; i++)
  for (let j = 0; j < PART_IDS.length; j++) {
    checkPlay([PART_IDS[i], PART_IDS[j]]);
    for (let k = 0; k < PART_IDS.length; k++) checkPlay([PART_IDS[i], PART_IDS[j], PART_IDS[k]]);
  }
// plus the heaviest stacks — 5 of the strongest single-coverage part, to prove
// the clamp holds even when everything piles onto one coverage
checkPlay(['drag', 'drag', 'drag', 'slant', 'slant']); // max man pressure
checkPlay(['go', 'go', 'post', 'post', 'wheel']);       // max vertical
checkPlay(['screen', 'screen', 'slant', 'flat', 'drag']); // max blitz-beat
ok(true, `band+shape held across ${built} generated plays`);

// ── (2) AI-INVISIBLE: PASS_CONCEPTS untouched by any of the above ───────────
ok(JSON.stringify(Object.keys(PASS_CONCEPTS).sort()) === conceptKeysBefore, 'compiling never added a composed play to PASS_CONCEPTS (AI cannot select it)');

// ── (4) football-sense of the rulebook ──────────────────────────────────────
const fourVerts = compilePlay({ name: '4V', kind: 'pass', parts: ['go', 'go', 'go', 'post'] });
ok(fourVerts.vs['Cover 1'] > 0.03 && fourVerts.vs['Cover 4'] < 0, 'all-vertical: beats single-high (C1+), loses to quarters (C4-)');
ok(fourVerts.depth === 'deep' && fourVerts.minWR === 4, 'all-vertical is a deep, 4-WR play');

const mesh = compilePlay({ name: 'Mesh-ish', kind: 'pass', parts: ['drag', 'drag', 'corner'] });
ok(mesh.vs['Cover 0'] > 0.03 && mesh.vs['Cover 1'] > 0.03, 'double-crosser: strong man-beater (C0/C1+)');

const smash = compilePlay({ name: 'Smash-ish', kind: 'pass', parts: ['corner', 'flat'] });
ok(smash.vs['Cover 2'] > 0 && smash.vs['Cover 3'] > 0, 'corner+flat high-low: beats Cover 2 and Cover 3');

const fireBeat = compilePlay({ name: 'Quick', kind: 'pass', parts: ['slant', 'flat', 'screen'] });
ok(fireBeat.vs['C3 Fire Zone'] > 0 && fireBeat.vs['Cover 0'] > 0, 'quick game beats the fire-zone blitz and Cover 0');

const shots = compilePlay({ name: 'Shot', kind: 'pass', parts: ['go', 'post', 'curl'] });
ok(shots.vs['Prevent'] < 0, 'deep shot play loses to Prevent (deep umbrella)');

// high-low (deep + underneath) stresses a two-deep zone MORE than two verticals,
// which the two deep safeties simply cap — the vertical-stretch bonus at work.
const highLow = compilePlay({ name: 'HL', kind: 'pass', parts: ['go', 'flat'] });
const twoVert = compilePlay({ name: '2V', kind: 'pass', parts: ['go', 'go'] });
ok(highLow.vs['Cover 2'] > twoVert.vs['Cover 2'], 'high-low (deep+under) beats Cover 2 better than two verticals');

console.log(`PLAY COMPOSE PROBE — ${pass} pass, ${fail} fail  (${built} generated plays band-checked)`);
if (fail) { console.log('  FAILURES:'); bad.slice(0, 20).forEach((m) => console.log('   -', m)); }
console.log(fail ? 'PLAY COMPOSE PROBE FAIL' : 'PLAY COMPOSE PROBE PASS');
process.exit(fail ? 1 : 0);
