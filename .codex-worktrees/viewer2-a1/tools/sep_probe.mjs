// sep_probe.mjs — Rung 7 Phase D gate: EMERGENT SEPARATION holds the
// retired formula's anchors. routeVsCoverage's attribute blend lives HERE
// as the frozen reference; routeDuel must match it per depth×technique
// bucket over the ENGINE-MEASURED population — and the tolerance is the
// tightest of any phase, because catchResolution multiplies sep ×5 (±0.01
// of bucket mean is ±1.2% completion). The calibration-cliff rope.
// Run from repo root: node tools/sep_probe.mjs [N]
import { routeDuel } from '../js/engine/sepgeo.js';
import { clamp, randNorm } from '../js/utils.js';

const N = parseInt(process.argv[2] || '20000', 10);

// ── FROZEN REFERENCE: routeVsCoverage as it shipped (Jul 2026) ────────────
// All constants inlined (ROUTE_TECH_SCALE = 0.0020). Never track live code.
function refSep(receiver, defender, passDepth, coverageType, pressHot = false) {
  if (!defender) return coverageType === 'zone' ? 0.84 : 1.0;
  const r = receiver.attributes, d = defender.attributes;
  let recVal;
  if (passDepth === 'short') {
    recVal = r.SPD * 0.25 + r.AGI * 0.30 + r.HND * 0.15 + r.TEC * 0.20 + r.AWR * 0.10 + 2.9;
  } else if (passDepth === 'medium') {
    recVal = r.SPD * 0.40 + r.AGI * 0.25 + r.TEC * 0.20 + r.AWR * 0.15 + 3.7;
  } else {
    recVal = r.SPD * 0.60 + r.AGI * 0.20 + r.TEC * 0.10 + r.JMP * 0.10 + 3.8;
  }
  recVal = recVal * 0.85 + receiver.compositeRating * 0.15;
  let defVal;
  if (coverageType === 'zone') {
    defVal = d.AWR * 0.40 + d.TEC * 0.26 + d.SPD * 0.20 + d.AGI * 0.14 + 1.3;
  } else {
    defVal = d.SPD * 0.40 + d.AGI * 0.31 + d.AWR * 0.14 + d.TEC * 0.15 + 2.6;
  }
  defVal = defVal * 0.85 + defender.compositeRating * 0.15;
  if (coverageType === 'offman') {
    defVal += passDepth === 'short' ? -6 : passDepth === 'deep' ? +4 : 0;
  }
  if (coverageType === 'press') {
    const hot = pressHot ? 1.08 : 1;
    const jam = d.STR * 0.40 + d.TEC * 0.35 + d.AGI * 0.25 + 1;
    const release = r.AGI * 0.40 + r.TEC * 0.35 + r.STR * 0.25;
    const jamGap = jam - release;
    if (passDepth === 'short')       defVal += (4 + jamGap * 0.22) * hot;
    else if (passDepth === 'medium') defVal += (jamGap * 0.16) * hot;
    else                             defVal += -3 + jamGap * 0.12;
  }
  if (coverageType === 'zone' && passDepth === 'deep') defVal += 4;
  const depthTechWeight = passDepth === 'short' ? 1.0 : passDepth === 'medium' ? 0.7 : 0.35;
  const techGap = (r.TEC - d.TEC) * depthTechWeight * 0.0020;
  return clamp(0.5 + (recVal - defVal) / 80 + techGap, 0.0, 1.0);
}

// ── Population measured FROM THE LIVE ENGINE (10-game instrument, Jul 2026):
// receivers WR 67% / TE 21% / RB 12% (SPD ~54 AGI ~53 TEC ~51, comp ~52);
// defenders CB 54% / S 37% / LB 7% (SPD ~60.5 AGI ~48 AWR ~57, comp ~52);
// uncovered ~0%. Buckets and their live shares drive the sampling below.
const A = (mu, sd = 12) => clamp(Math.round(randNorm(mu, sd)), 30, 95);
const mkRec = () => {
  const roll = Math.random();
  const pos = roll < 0.67 ? 'WR' : roll < 0.88 ? 'TE' : 'RB';
  const base = pos === 'WR' ? 56 : 50;
  return { position: pos, compositeRating: A(52, 8),
    attributes: { SPD: A(base, 11), AGI: A(base - 1, 11), TEC: A(51, 11), AWR: A(51, 11),
                  HND: A(52, 11), JMP: A(52, 11), STR: A(48, 10) } };
};
const mkDef = () => {
  const roll = Math.random();
  const pos = roll < 0.54 ? 'CB' : roll < 0.91 ? 'S' : 'LB';
  return { position: pos, compositeRating: A(52, 8),
    attributes: { SPD: A(pos === 'CB' ? 63 : 57, 10), AGI: A(48, 10), TEC: A(50, 11),
                  AWR: A(57, 11), STR: A(pos === 'LB' ? 62 : 50, 10) } };
};

const BUCKETS = [];
for (const d of ['short', 'medium', 'deep']) for (const t of ['press', 'offman', 'zone']) BUCKETS.push(`${d}/${t}`);

let fail = 0;
const g = (nm, ok, det) => { if (!ok) fail++; console.log(`${ok ? '✅' : '❌'} ${nm} — ${det}`); };
const stats = arr => {
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return { m, sd: Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length) };
};

// ── 1. Per-bucket A/B over the FROZEN IN-WORLD FIXTURE ────────────────────
// 600 real pairs per bucket, captured from live world-probe games (the
// synthetic population lied by up to 0.23 on deep/zone — the in-world A/B
// caught it). Each pair duels several times to average the route noise, so
// this section is near-deterministic: no sampling flake by construction.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const FIX = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'sep_pairs_fixture.json'), 'utf8'));
const ATTRS = ['SPD', 'AGI', 'TEC', 'AWR', 'HND', 'JMP', 'STR'];
const unpack = row => ({ compositeRating: row[7],
  attributes: Object.fromEntries(ATTRS.map((a, i) => [a, row[i]])) });
const REPS = Math.max(2, Math.round(N / 9 / 600));
const t0 = Date.now();
let worstMean = 0, worstSd = 0, calls = 0;
const bmean = {};                       // per-bucket fixture means (shape guard reads these)
for (const bucket of BUCKETS) {
  const [depth, type] = bucket.split('/');
  const ref = [], geo = [];
  for (const [rRow, dRow] of FIX[bucket]) {
    const r = unpack(rRow), d = unpack(dRow);
    ref.push(refSep(r, d, depth, type));
    let g = 0;
    for (let k = 0; k < REPS; k++) { g += routeDuel(r, d, depth, type); calls++; }
    geo.push(g / REPS);
  }
  const sr = stats(ref), sg = stats(geo);
  bmean[bucket] = { ref: sr.m, geo: sg.m };
  // The marginal is pinned at ref + SEP_RECENTER (+0.015): the measured
  // joint-structure cost of duel re-ordering (see sepgeo.js) — 6 paired
  // worlds showed matched marginals still ran −1.8pp completion, and the
  // world anchor is the higher law.
  const dm = Math.abs(sg.m - (sr.m + 0.015)), ds = Math.abs(sg.sd - sr.sd);
  worstMean = Math.max(worstMean, dm); worstSd = Math.max(worstSd, ds);
  console.log(`${bucket.padEnd(14)} ref ${sr.m.toFixed(3)}±${sr.sd.toFixed(3)}  geo ${sg.m.toFixed(3)}±${sg.sd.toFixed(3)}  Δm ${(sg.m - sr.m >= 0 ? '+' : '')}${(sg.m - sr.m).toFixed(3)}`);
}
const simMs = Date.now() - t0;
g('every bucket mean within ±0.010 (the sigmoid law)', worstMean <= 0.010, `worst Δ ${worstMean.toFixed(4)}`);
// (rep-averaging shaves ~0.01 of duel noise off geo's sd — tolerance notes it)
g('every bucket sd within ±0.040', worstSd <= 0.040, `worst Δ ${worstSd.toFixed(4)}`);
g('fast enough (5 duels/dropback — <15µs each)', (simMs / calls) * 1000 / 2 < 15, `${((simMs / calls) * 1000 / 2).toFixed(1)}µs`);

// ── 2. Sensitivities: the retired dials, not the geometry's appetite ──────
function meanFor(fn, depth, type, n = 50000) {
  let s = 0; for (let i = 0; i < n; i++) { const [r, d] = fn(); s += routeDuel(r, d, depth, type); }
  return s / n;
}
function meanRef(fn, depth, type, n = 50000) {
  let s = 0; for (let i = 0; i < n; i++) { const [r, d] = fn(); s += refSep(r, d, depth, type); }
  return s / n;
}
{
  const burner = () => { const r = mkRec(); r.attributes.SPD = 88; return [r, mkDef()]; };
  const slowR  = () => { const r = mkRec(); r.attributes.SPD = 42; return [r, mkDef()]; };
  const gD = meanFor(burner, 'deep', 'press') - meanFor(slowR, 'deep', 'press');
  const rD = meanRef(burner, 'deep', 'press') - meanRef(slowR, 'deep', 'press');
  g('deep speed premium ≈ the old dial (±0.035)', Math.abs(gD - rD) <= 0.035,
    `geo Δ${gD.toFixed(3)} vs ref Δ${rD.toFixed(3)}`);
}
{
  const tech = () => { const r = mkRec(); r.attributes.TEC = 86; return [r, mkDef()]; };
  const raw  = () => { const r = mkRec(); r.attributes.TEC = 40; return [r, mkDef()]; };
  const gS = meanFor(tech, 'short', 'press') - meanFor(raw, 'short', 'press');
  const rS = meanRef(tech, 'short', 'press') - meanRef(raw, 'short', 'press');
  g('short-route technician premium ≈ the old dial (±0.035)', Math.abs(gS - rS) <= 0.035,
    `geo Δ${gS.toFixed(3)} vs ref Δ${rS.toFixed(3)}`);
}
{
  const reader = () => { const d = mkDef(); d.attributes.AWR = 85; return [mkRec(), d]; };
  const blind  = () => { const d = mkDef(); d.attributes.AWR = 40; return [mkRec(), d]; };
  const gZ = meanFor(reader, 'medium', 'zone') - meanFor(blind, 'medium', 'zone');
  const rZ = meanRef(reader, 'medium', 'zone') - meanRef(blind, 'medium', 'zone');
  // Two-tier guard: the synthetic EXTREME (85 vs 40) runs ~20% hot and the
  // marginal-matched map locks it there (±0.055 catches sign flips and 2x);
  // the LEAGUE-SPREAD tier (68 vs 46, ≈±1sd) binds tight — that's the range
  // the world actually plays in, and the in-world A/B owns the comp% anchor.
  g('the zone READER suppresses separation ≈ the old dial (extremes ±0.055)', Math.abs(gZ - rZ) <= 0.055,
    `geo Δ${gZ.toFixed(3)} vs ref Δ${rZ.toFixed(3)}`);
  const reader1 = () => { const d = mkDef(); d.attributes.AWR = 68; return [mkRec(), d]; };
  const blind1  = () => { const d = mkDef(); d.attributes.AWR = 46; return [mkRec(), d]; };
  const gL = meanFor(reader1, 'medium', 'zone') - meanFor(blind1, 'medium', 'zone');
  const rL = meanRef(reader1, 'medium', 'zone') - meanRef(blind1, 'medium', 'zone');
  g('…and at LEAGUE spreads it is the old dial (±0.020)', Math.abs(gL - rL) <= 0.020,
    `geo Δ${gL.toFixed(3)} vs ref Δ${rL.toFixed(3)}`);
}
// ── 3. Structural laws ────────────────────────────────────────────────────
{
  // press structure: the jam helps underneath and is a gamble deep (relative
  // to off-man's lid) — the retired formula's signature shape, measured on
  // the REAL fixture populations (a shared synthetic pop distorts cross-
  // bucket gaps once the maps are fitted to each bucket's true matchups).
  const gShort = bmean['short/press'].geo - bmean['short/offman'].geo;
  const rShort = bmean['short/press'].ref - bmean['short/offman'].ref;
  const gDeep  = bmean['deep/press'].geo - bmean['deep/offman'].geo;
  const rDeep  = bmean['deep/press'].ref - bmean['deep/offman'].ref;
  g('press vs cushion keeps its shape (short & deep gaps ±0.025 of ref)',
    Math.abs(gShort - rShort) <= 0.025 && Math.abs(gDeep - rDeep) <= 0.025,
    `short geo ${gShort.toFixed(3)}/ref ${rShort.toFixed(3)}, deep geo ${gDeep.toFixed(3)}/ref ${rDeep.toFixed(3)}`);
}
{
  const un1 = routeDuel(mkRec(), null, 'medium', 'press');
  const un2 = routeDuel(mkRec(), null, 'medium', 'zone');
  g('uncovered branch verbatim (1.0 man / 0.84 zone)', un1 === 1.0 && un2 === 0.84, `${un1}/${un2}`);
}
{
  // Determinism budget: the duel's play-to-play noise for a FIXED pair must
  // stay small — the retired formula was deterministic, and target-read
  // ordering (chooseTarget sorts by sep) lives on that stability.
  const r = mkRec(), d = mkDef();
  let worstN = 0;
  for (const [dep, ty] of [['medium', 'press'], ['short', 'zone'], ['deep', 'zone']]) {
    const reps = [];
    for (let i = 0; i < 400; i++) reps.push(routeDuel(r, d, dep, ty));
    worstN = Math.max(worstN, stats(reps).sd);
  }
  g('fixed-pair noise stays small everywhere (sd ≤ 0.055)', worstN <= 0.055, `worst sd ${worstN.toFixed(3)}`);
}
{
  let bad = 0;
  for (let i = 0; i < 3000; i++) {
    const v = routeDuel(mkRec(), mkDef(),
      ['short', 'medium', 'deep'][i % 3], ['press', 'offman', 'zone'][(i / 3 | 0) % 3]);
    if (!(v >= 0 && v <= 1) || !Number.isFinite(v)) bad++;
  }
  g('sep always in [0,1]', bad === 0, `${bad} violations`);
}

console.log(fail ? `❌ ${fail} FAILED` : '✅ RUNG 7D SEPARATION GATE PASS');
process.exit(fail ? 1 : 0);
