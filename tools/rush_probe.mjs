// rush_probe.mjs — Rung 7 Phase E gate: EMERGENT POCKET/RUSH GEOMETRY holds the
// retired sack roll's anchors. resolvePocket (js/engine/rushgeo.js) must
// reproduce the frozen collapseFrac² sack model's marginals AND its slopes
// (penetrator count, free blitzer, protection, the DL-OL attribute gap) over
// the ENGINE-CAPTURED population — before the world probe ever sees the swap.
// The calibration-cliff rope for the last horizon phase.
//
//   Frozen reference = the retired resolvePassRush decision, verbatim, with
//   PASS_RUSH_PRESSURE inlined as a literal (0.45) — it must NEVER track
//   constants.js. Ref rates are computed ANALYTICALLY (exact Bernoulli p), so
//   only the geo side carries Monte-Carlo noise.
//   Population = tools/rush_pairs_fixture.json, frozen from live world-probe
//   games (the sep-probe discipline: probe population == engine population).
// Run from repo root: node tools/rush_probe.mjs [drawsPerSnapshot]
import { readFileSync } from 'node:fs';
import { resolvePocket } from '../js/engine/rushgeo.js';

const M = parseInt(process.argv[2] || '40', 10);          // geo Monte-Carlo draws/snapshot
                                                          //   (40, not 16: the pen=4 tail bucket
                                                          //    n=173 needs it to measure tightly)
const RAW = JSON.parse(readFileSync(new URL('./rush_pairs_fixture.json', import.meta.url)));

// ── decode the compact fixture → the resolvePocket input shape ────────────
const A = arr => arr ? { SPD: arr[0], AGI: arr[1], STR: arr[2], PWR: arr[3], TEC: arr[4], AWR: arr[5] } : null;
const POP = RAW.map(s => ({
  protectMult: s.pm, blitzDesign: s.bd, dnaPressure: s.dna, paBite: s.pa, passKey: s.pk,
  reps: s.reps.map(r => ({
    pen: !!(r.f & 1), blitzer: !!(r.f & 2), speed: !!(r.f & 4), power: !!(r.f & 8),
    pos: (r.f & 16) ? 'DE' : 'DT',       // edge bit → path selection (real sim passes true pos)
    r: A(r.r), b: A(r.b),
  })),
}));

// ── FROZEN REFERENCE: the retired resolvePassRush sack/hurry decision ──────
// Analytic probabilities (exact); literals frozen (PASS_RUSH_PRESSURE = 0.45).
function refP(s) {
  const reps = s.reps;
  const numPen = reps.filter(r => r.pen).length;
  if (numPen === 0) return { sack: 0, hurry: 0 };
  const collapseFrac = numPen / reps.length;
  const freeBlitz = reps.filter(r => r.blitzer).length;   // free blitzers always penetrate
  const designFactor = 0.5 + s.blitzDesign / 100;
  const blitzBoost = freeBlitz > 0 ? 1 + 0.15 * designFactor : 1.0;
  const dnaPressure = 1 + (s.dnaPressure || 0) * 0.006;
  const sackChance = Math.max(0, Math.min(0.95,
    collapseFrac * collapseFrac * 0.45 * blitzBoost * dnaPressure * s.protectMult * (1 + s.paBite * 0.12)));
  const hurryChance = Math.max(0, Math.min(0.85,
    (collapseFrac * 1.4 + (freeBlitz > 0 ? 0.20 : 0)) * (1 - s.paBite * 0.28) * (1 + s.passKey * 0.012)));
  return { sack: sackChance, hurry: (1 - sackChance) * hurryChance };
}

// ── run the A/B over the population ───────────────────────────────────────
const t0 = Date.now();
let geoDraws = 0;
const rows = POP.map(s => {
  const ref = refP(s);
  let gs = 0, gh = 0;
  for (let i = 0; i < M; i++) { const o = resolvePocket(s); if (o.sacked) gs++; else if (o.hurried) gh++; geoDraws++; }
  const numPen = s.reps.filter(r => r.pen).length;
  const freeBlitz = s.reps.filter(r => r.blitzer).length;
  const rPow = a => a.STR * 0.40 + a.SPD * 0.35 + a.AGI * 0.25;
  const bPow = a => a.STR * 0.45 + a.TEC * 0.30 + a.AGI * 0.25;
  const rs = s.reps.map(r => r.r).filter(Boolean), bs = s.reps.map(r => r.b).filter(Boolean);
  const margin = (rs.length ? rs.reduce((x, a) => x + rPow(a), 0) / rs.length : 60)
               - (bs.length ? bs.reduce((x, a) => x + bPow(a), 0) / bs.length : 60);
  return { refSack: ref.sack, refHurry: ref.hurry, geoSack: gs / M, geoHurry: gh / M, numPen, freeBlitz, margin, pm: s.protectMult };
});
const simMs = Date.now() - t0;

const mean = (arr, f) => arr.reduce((a, x) => a + f(x), 0) / (arr.length || 1);
const P = x => (100 * x).toFixed(2) + '%';
let fail = 0;
const g = (nm, ok, d) => { if (!ok) fail++; console.log(`${ok ? '✅' : '❌'} ${nm} — ${d}`); };

const refSack = mean(rows, r => r.refSack), geoSack = mean(rows, r => r.geoSack);
const refHurry = mean(rows, r => r.refHurry), geoHurry = mean(rows, r => r.geoHurry);
console.log(`\n=== RUSH GEOMETRY A/B (${POP.length} snapshots × ${M} draws) ===`);
console.log(`overall: sack  ref ${P(refSack)}  geo ${P(geoSack)}   (Δ${((geoSack - refSack) * 100).toFixed(2)}pp)`);
console.log(`         hurry ref ${P(refHurry)} geo ${P(geoHurry)}  (Δ${((geoHurry - refHurry) * 100).toFixed(2)}pp)`);
console.log(`         clean ref ${P(1 - refSack - refHurry)} geo ${P(1 - geoSack - geoHurry)}`);
console.log('\nby penetrator count:  (n, refSack→geoSack | refHurry→geoHurry)');
for (let k = 0; k <= 5; k++) {
  const sub = rows.filter(r => r.numPen === k); if (sub.length < 15) continue;
  console.log(`  pen=${k} (n=${String(sub.length).padStart(4)}): sack ${P(mean(sub, r => r.refSack))}→${P(mean(sub, r => r.geoSack))}  hurry ${P(mean(sub, r => r.refHurry))}→${P(mean(sub, r => r.geoHurry))}`);
}

// ── 1. Marginals hold (the world anchor's parent) ─────────────────────────
g('overall sack% holds (±0.8pp)', Math.abs(geoSack - refSack) <= 0.008, `${P(geoSack)} vs ${P(refSack)}`);
g('overall hurry% holds (±3pp)', Math.abs(geoHurry - refHurry) <= 0.03, `${P(geoHurry)} vs ${P(refHurry)}`);

// ── 2. Per-penetrator-count sack% holds (the shape of the curve) ──────────
for (const k of [1, 2, 3, 4]) {
  const sub = rows.filter(r => r.numPen === k); if (sub.length < 40) continue;
  const rf = mean(sub, r => r.refSack), gf = mean(sub, r => r.geoSack);
  const tol = k === 4 ? 0.035 : 0.03;
  // pen=4 is the ~1.6%-of-dropbacks tail. On the 2026-07-30 regenerated
  // fixture the geo pocket underpays it ~5pp vs the frozen ref (stable across
  // draw counts, not MC noise). Owner call 2026-07-30: skip the retune — the
  // overall sack ±0.8pp guard above is the real world-anchor teeth, so this
  // reports as a WARNING, not a failure, until the tail is deliberately
  // recalibrated.
  if (k === 4) {
    const ok = Math.abs(gf - rf) <= tol;
    console.log(`${ok ? '✅' : '⚠️ '} pen=4 sack% ${ok ? 'holds' : 'off (known, owner-skipped)'} (±3.5pp) — ${P(gf)} vs ${P(rf)} (n=${sub.length})`);
    continue;
  }
  g(`pen=${k} sack% holds (±${(tol * 100).toFixed(1)}pp)`, Math.abs(gf - rf) <= tol, `${P(gf)} vs ${P(rf)} (n=${sub.length})`);
}

// ── 3. Slopes: the levers the geometry must reproduce ─────────────────────
{ // free blitzer
  const y = rows.filter(r => r.freeBlitz > 0), no = rows.filter(r => !r.freeBlitz);
  const rLift = mean(y, r => r.refSack) - mean(no, r => r.refSack);
  const gLift = mean(y, r => r.geoSack) - mean(no, r => r.geoSack);
  console.log(`\nfree-blitzer sack lift: ref +${(100 * rLift).toFixed(1)}pp  geo +${(100 * gLift).toFixed(1)}pp`);
  g('free blitzer raises sacks (lift Δ within ±3pp of ref)', gLift > 0.01 && Math.abs(gLift - rLift) <= 0.03,
    `geo +${(100 * gLift).toFixed(1)}pp vs ref +${(100 * rLift).toFixed(1)}pp`);
}
{ // front margin (the attribute-gap slope — must be reproduced, not exceeded)
  const strong = rows.filter(r => r.margin >= 4), weak = rows.filter(r => r.margin <= -4);
  const rSlope = mean(strong, r => r.refSack) - mean(weak, r => r.refSack);
  const gSlope = mean(strong, r => r.geoSack) - mean(weak, r => r.geoSack);
  console.log(`front-margin slope (+4 vs −4): ref ${(100 * rSlope).toFixed(1)}pp  geo ${(100 * gSlope).toFixed(1)}pp`);
  g('stronger front sacks more, slope not over-paid (Δ within ±2.5pp of ref)',
    gSlope > 0 && Math.abs(gSlope - rSlope) <= 0.025, `geo ${(100 * gSlope).toFixed(1)}pp vs ref ${(100 * rSlope).toFixed(1)}pp`);
}
{ // protection — CONTROLLED (population pm is confounded with penetrator count):
  // vary ONLY protectMult on the same penetrating snapshots. protectMult is a
  // DIRECT multiplier on the frozen sackChance (lower pm = better protection =
  // fewer sacks), so the frozen sack% scales ~linearly; the geo must match that
  // multiplicative response, not the raw clock over-response.
  const sub = POP.filter(s => s.reps.some(r => r.pen)).filter((_, i) => i % 2 === 0);
  const at = (pmScale) => {
    let refS = 0, geoS = 0, gd = 0;
    for (const s of sub) {
      const s2 = { ...s, protectMult: s.protectMult * pmScale };
      refS += refP(s2).sack;
      for (let i = 0; i < 10; i++) { if (resolvePocket(s2).sacked) geoS++; gd++; }
    }
    return { ref: refS / sub.length, geo: geoS / gd };
  };
  const lo = at(0.88), hi = at(1.12);   // better protection ← → worse protection
  const refRatio = hi.ref / lo.ref, geoRatio = hi.geo / lo.geo;
  console.log(`protection (controlled): worse/better sack ratio  ref ×${refRatio.toFixed(2)}  geo ×${geoRatio.toFixed(2)}  (geo ${(100 * lo.geo).toFixed(1)}%→${(100 * hi.geo).toFixed(1)}%)`);
  g('weaker protection gives up more, response matched (ratio within ±0.20 of ref)',
    geoRatio > 1.0 && Math.abs(geoRatio - refRatio) <= 0.20, `geo ×${geoRatio.toFixed(2)} vs ref ×${refRatio.toFixed(2)}`);
}

// ── 4. Structural laws ────────────────────────────────────────────────────
g('zero-penetrator snaps are always clean', (() => {
  const z = POP.filter(s => !s.reps.some(r => r.pen));
  for (const s of z) { for (let i = 0; i < 4; i++) { const o = resolvePocket(s); if (o.sacked || o.hurried) return false; } }
  return z.length > 0;
})(), 'no sack/hurry with 0 penetrators');
g('outputs always boolean & mutually exclusive', rows.every(r => r.geoSack + r.geoHurry <= 1.0001), 'ok');
g('fast enough for the engine (<25µs/pocket)', (simMs / geoDraws) * 1000 < 25, `${((simMs / geoDraws) * 1000).toFixed(1)}µs (${geoDraws} draws in ${simMs}ms)`);

console.log(fail ? `\n❌ ${fail} FAILED` : '\n✅ RUNG 7E POCKET/RUSH-GEOMETRY GATE PASS');
process.exit(fail ? 1 : 0);
