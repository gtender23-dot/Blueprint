// refit_qmap.mjs — rebuild sepgeo.js's QMAP against the in-world fixture, retiring
// PRESS_RECENTER. The QMAP is a per-bucket quantile map: raw duel distance (dq) → the retired
// formula's separation (sq); qsep adds SEP_RECENTER on top, so sq is the raw ref marginal.
//
// It is fit on EXACTLY what tools/sep_probe.mjs evaluates: the 600 fixture pairs per bucket,
// dueled with pressHot=false (the probe's call shape). For each pair we sample the pre-QMAP
// `dist` (via routeDuel's trace) REPS times and take refSep once; dq = quantiles of the pooled
// dists, sq = quantiles of the per-pair refs. Because the map is fit on the same population the
// gate checks, the marginal lands on ref+SEP_RECENTER without any hand offset — press included.
//
// Usage: node tools/refit_qmap.mjs   → writes /tmp/new_qmap.js
import { routeDuel } from '../js/engine/sepgeo.js';
import { clamp } from '../js/utils.js';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const K = 25, REPS = 30;
const BUCKETS = [];
for (const d of ['short', 'medium', 'deep']) for (const t of ['press', 'offman', 'zone']) BUCKETS.push(`${d}/${t}`);
const FIX = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'sep_pairs_fixture.json'), 'utf8'));
const ATTRS = ['SPD', 'AGI', 'TEC', 'AWR', 'HND', 'JMP', 'STR'];
const unpack = row => ({ compositeRating: row[7], attributes: Object.fromEntries(ATTRS.map((a, i) => [a, row[i]])) });

// The frozen reference (identical to sep_probe's refSep / sim.js's _refSepAB).
function refSep(receiver, defender, passDepth, coverageType) {
  if (!defender) return coverageType === 'zone' ? 0.84 : 1.0;
  const r = receiver.attributes, d = defender.attributes;
  let recVal;
  if (passDepth === 'short') recVal = r.SPD*0.25 + r.AGI*0.30 + r.HND*0.15 + r.TEC*0.20 + r.AWR*0.10 + 2.9;
  else if (passDepth === 'medium') recVal = r.SPD*0.40 + r.AGI*0.25 + r.TEC*0.20 + r.AWR*0.15 + 3.7;
  else recVal = r.SPD*0.60 + r.AGI*0.20 + r.TEC*0.10 + r.JMP*0.10 + 3.8;
  recVal = recVal*0.85 + receiver.compositeRating*0.15;
  let defVal;
  if (coverageType === 'zone') defVal = d.AWR*0.40 + d.TEC*0.26 + d.SPD*0.20 + d.AGI*0.14 + 1.3;
  else defVal = d.SPD*0.40 + d.AGI*0.31 + d.AWR*0.14 + d.TEC*0.15 + 2.6;
  defVal = defVal*0.85 + defender.compositeRating*0.15;
  if (coverageType === 'offman') defVal += passDepth === 'short' ? -6 : passDepth === 'deep' ? +4 : 0;
  if (coverageType === 'press') {
    const jam = d.STR*0.40 + d.TEC*0.35 + d.AGI*0.25 + 1;
    const release = r.AGI*0.40 + r.TEC*0.35 + r.STR*0.25;
    const jamGap = jam - release;
    if (passDepth === 'short') defVal += 4 + jamGap*0.22;
    else if (passDepth === 'medium') defVal += jamGap*0.16;
    else defVal += -3 + jamGap*0.12;
  }
  if (coverageType === 'zone' && passDepth === 'deep') defVal += 4;
  const dtw = passDepth === 'short' ? 1.0 : passDepth === 'medium' ? 0.7 : 0.35;
  return clamp(0.5 + (recVal - defVal)/80 + (r.TEC - d.TEC)*dtw*0.0020, 0, 1);
}

const rnd = (x, n = 4) => Math.round(x * 10 ** n) / 10 ** n;
// Quantile levels span [TRIM, 1-TRIM] rather than [0,1]: the extreme endpoints are
// single-sample and noisy, and anchoring the map on a lone max-separation outlier
// steepens its top end (which over-drove the zone-reader gradient). Winsorizing the
// 1.5% tails smooths the map without moving the bulk marginal the gate checks.
const TRIM = 0.005;
function quantiles(arr, k) {
  const s = arr.slice().sort((a, b) => a - b), n = s.length, out = [];
  for (let i = 0; i < k; i++) {
    const p = TRIM + (i / (k - 1)) * (1 - 2 * TRIM);
    const idx = p * (n - 1), lo = Math.floor(idx), hi = Math.ceil(idx), w = idx - lo;
    out.push(rnd(s[lo]*(1 - w) + s[hi]*w));
  }
  return out;
}

const QMAP = {};
for (const b of BUCKETS) {
  const [depth, type] = b.split('/');
  const dists = [], refs = [];
  for (const [rRow, dRow] of FIX[b]) {
    const r = unpack(rRow), d = unpack(dRow);
    refs.push(refSep(r, d, depth, type));
    const tr = {};
    for (let k = 0; k < REPS; k++) { routeDuel(r, d, depth, type, false, tr); dists.push(tr.dist); }
  }
  QMAP[b] = { dq: quantiles(dists, K), sq: quantiles(refs, K) };
}

const ORDER = ['deep/offman','deep/press','deep/zone','medium/offman','medium/press','medium/zone','short/offman','short/press','short/zone'];
let out = 'const QMAP = {\n';
for (const b of ORDER) out += `  '${b}':`.padEnd(18) + ` { dq: [${QMAP[b].dq.join(', ')}], sq: [${QMAP[b].sq.join(', ')}] },\n`;
out += '};\n';
writeFileSync('/tmp/new_qmap.js', out);
console.log('WROTE /tmp/new_qmap.js (fit on fixture pairs, pressHot=false, REPS=' + REPS + ')');
