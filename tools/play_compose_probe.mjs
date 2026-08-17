// play_compose_probe — Creativity Tools, the Play Composer Model B-i rulebook.
// Proves the two safety guarantees + that the parts→grade derivation is
// football-sensible: (1) BAND — every derived grade of every buildable play sits
// in the catalog band [BAND_LO, BAND_HI]; (2) AI-INVISIBLE — compiling never
// touches PASS_CONCEPTS, so the AI can't select composed plays (human-call-only
// by construction); (3) exec weights are valid (sum to 1); (4) the rulebook maps
// route parts to the right coverage answers (verticals beat single-high & lose to
// two-deep; crossers beat man; curls sit in zone; screens beat the blitz).
// D4/M2 (2026-08-16): the composer grew RUNS + biting pass blocking. New pins:
// (5) every path × scheme × carrier compiles with vsBox clamped to the band
// DERIVED from the shipped RUN_CONCEPTS catalog, pulls fires exactly for the
// pulling schemes, qbCarry exactly for the QB carrier; (6) RUN_CONCEPTS is as
// AI-invisible as PASS_CONCEPTS; (7) authored pass blocks compile to keepIn
// counting only tight ends and backs (a WR "block" is only the lost route).
import { PLAYCOMPOSE_SCHEMA_VERSION, BAND_LO, BAND_HI, COVERAGES, ROUTE_PARTS, routePartList, emptyComposedPlay, validateComposedPlay, compilePlay, repairComposedPlay, RUN_PATHS, RUN_SCHEMES, RUN_CARRIERS, RUN_BAND_LO, RUN_BAND_HI } from '../js/engine/playcompose.js';
import { PASS_CONCEPTS, RUN_CONCEPTS } from '../js/concepts.js';

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
// D4/M2: runs are legal now — but only as a real design (path + scheme), and
// never carrying route parts.
ok(validateComposedPlay({ name: 'x', kind: 'run', run: { path: 'inside', scheme: 'zone', carrier: 'RB' }, parts: [] }).ok, 'kind=run with a valid design validates');
ok(!validateComposedPlay({ name: 'x', kind: 'run', parts: [] }).ok, 'run without a design (cp.run) rejected');
ok(!validateComposedPlay({ name: 'x', kind: 'run', run: { path: 'nope', scheme: 'zone' }, parts: [] }).ok, 'unknown run path rejected');
ok(!validateComposedPlay({ name: 'x', kind: 'run', run: { path: 'inside', scheme: 'nope' }, parts: [] }).ok, 'unknown blocking scheme rejected');
ok(!validateComposedPlay({ name: 'x', kind: 'run', run: { path: 'inside', scheme: 'zone', carrier: 'WR' }, parts: [] }).ok, 'unknown carrier rejected');
ok(!validateComposedPlay({ name: 'x', kind: 'run', run: { path: 'inside', scheme: 'zone' }, parts: ['go', 'flat'] }).ok, 'run carrying route parts rejected');
ok(!validateComposedPlay({ name: 'x', kind: 'wildcatnado', parts: ['go', 'flat'] }).ok, 'unknown kind rejected');
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

// ── (5) RUNS: every path × scheme × carrier, band-clamped + flag laws ───────
const runKeysBefore = JSON.stringify(Object.keys(RUN_CONCEPTS).sort());
{
  // the run band is DERIVED from the shipped catalog — assert that fact first
  let lo = 0, hi = 0;
  for (const c of Object.values(RUN_CONCEPTS)) {
    if (!c.vsBox) continue;
    for (const v of [c.vsBox.loaded || 0, c.vsBox.light || 0]) { if (v < lo) lo = v; if (v > hi) hi = v; }
  }
  ok(RUN_BAND_LO === lo && RUN_BAND_HI === hi, `run band is the catalog's observed range (${lo}..${hi})`);
  let runsBuilt = 0, runsOk = true;
  for (const path of Object.keys(RUN_PATHS)) for (const scheme of Object.keys(RUN_SCHEMES)) for (const carrier of RUN_CARRIERS) {
    const c = compilePlay({ name: 'R', kind: 'run', run: { path, scheme, carrier }, parts: [] });
    runsBuilt++;
    const id = `${path}/${scheme}/${carrier}`;
    if (!(c.type === 'run_inside' || c.type === 'run_outside')) { ok(false, `[${id}] bad type ${c.type}`); runsOk = false; continue; }
    for (const b of ['loaded', 'light']) {
      const g = c.vsBox[b];
      if (!(g >= RUN_BAND_LO - 1e-9 && g <= RUN_BAND_HI + 1e-9)) { ok(false, `[${id}] vsBox.${b}=${g} OUT OF BAND`); runsOk = false; }
    }
    const wantPulls = !!RUN_SCHEMES[scheme].pulls;
    if (!!c.pulls !== wantPulls) { ok(false, `[${id}] pulls=${!!c.pulls}, scheme says ${wantPulls}`); runsOk = false; }
    if (!!c.qbCarry !== (carrier === 'QB')) { ok(false, `[${id}] qbCarry=${!!c.qbCarry} for carrier ${carrier}`); runsOk = false; }
    for (const [posn, w] of Object.entries(c.exec)) {
      const s = Object.values(w).reduce((a, b) => a + b, 0);
      if (Math.abs(s - 1) > 0.005) { ok(false, `[${id}] exec ${posn} sums ${s}`); runsOk = false; }
    }
    if (!c._composedRun || c._composedRun.path !== path) { ok(false, `[${id}] missing _composedRun stamp`); runsOk = false; }
  }
  ok(runsOk, `every path × scheme × carrier compiles lawfully (${runsBuilt} runs)`);
  // football sense: the gap scheme answers a loaded box better than zone does
  const gapC = compilePlay({ name: 'g', kind: 'run', run: { path: 'inside', scheme: 'gap', carrier: 'RB' }, parts: [] });
  const zoneC = compilePlay({ name: 'z', kind: 'run', run: { path: 'inside', scheme: 'zone', carrier: 'RB' }, parts: [] });
  ok(gapC.vsBox.loaded > zoneC.vsBox.loaded, 'gap (a pulled hat) answers a loaded box better than zone');
  ok(zoneC.vsBox.light >= gapC.vsBox.light, 'zone keeps the light-box edge');
  // run repair: a live design round-trips; a dead path is unrepairable
  const rr1 = repairComposedPlay({ name: 'R', kind: 'run', run: { path: 'toss', scheme: 'gap', carrier: 'QB' }, formations: ['Spread'] });
  ok(rr1.ok && rr1.cp.kind === 'run' && rr1.cp.run.path === 'toss' && rr1.cp.run.carrier === 'QB', 'run design survives repair');
  const rr2 = repairComposedPlay({ name: 'R', kind: 'run', run: { path: 'gone', scheme: 'zone' } });
  ok(!rr2.ok && rr2.changes.length > 0, 'dead run path repairs to needs-rebuilding');
}

// ── (7) pass blocking BITES: authored blocks compile to keepIn ──────────────
{
  // Power-I carries a FB (role FB) + HB + TE — block the TE and the HB and the
  // compile counts them; a WR told to block earns no keepIn credit.
  const layoutMod = await import('../js/constants_field.js');
  const slots = layoutMod.OFF_FIELD_LAYOUTS['Power-I'].slots;
  const te = slots.find((s) => s.pos === 'TE');
  const rb = slots.filter((s) => s.pos === 'RB' || s.pos === 'WING' || s.pos === 'ABACK');
  const wr = slots.find((s) => s.pos === 'WR' || s.pos === 'SLOT');
  const cpB = { name: 'Max', kind: 'pass', parts: ['go', 'post'], assigns: [], blocks: [te.id, rb[0].id, wr.id], formations: ['Power-I'] };
  const cB = compilePlay(cpB);
  ok(cB.keepIn && cB.keepIn.TE === 1 && cB.keepIn.RB === 1, `authored blocks compile to keepIn {TE:1, RB:1} (got ${JSON.stringify(cB.keepIn)})`);
  const cpN = { name: 'NoB', kind: 'pass', parts: ['go', 'post'], assigns: [], blocks: [wr.id], formations: ['Power-I'] };
  ok(!compilePlay(cpN).keepIn, 'a WR block alone earns no keepIn (only the lost route)');
  const cpZ = { name: 'Zero', kind: 'pass', parts: ['go', 'post'], assigns: [], blocks: [], formations: ['Power-I'] };
  ok(!compilePlay(cpZ).keepIn, 'no blocks → no keepIn field at all');
}

// ── (2) AI-INVISIBLE: PASS_CONCEPTS + RUN_CONCEPTS untouched by any of the above
ok(JSON.stringify(Object.keys(PASS_CONCEPTS).sort()) === conceptKeysBefore, 'compiling never added a composed play to PASS_CONCEPTS (AI cannot select it)');
ok(JSON.stringify(Object.keys(RUN_CONCEPTS).sort()) === runKeysBefore, 'compiling never added a composed run to RUN_CONCEPTS (AI cannot select it)');

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
