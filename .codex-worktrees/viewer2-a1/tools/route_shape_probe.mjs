// route_shape_probe.mjs — do individuated ROUTE SHAPES behave like real routes?
//
// Fix B (coverage pass, Aug 2026). Before this, every break was one generic
// lateral cut: a slant, a dig, a comeback and an out at the same depth were the
// same event. Now a route carries a shape:
//   • sharp (90°: in/out/comeback) — sinks the hips, separates SHARPLY at the
//     cut but bleeds speed out of it.
//   • speed (45°: slant/post/corner) — keeps velocity, softer window.
//   • dbl (double move) — sells a first break; a defender who bites recovers
//     late on the real one, more so the better the receiver's TEC vs his AWR.
//
// Checks:
//   1. SHARP > SPEED at the break — the 90° cut wins more separation than the
//      rounded 45° one (its whole trade: sharpness for speed).
//   2. DOUBLE MOVE beats the single break — a double move separates MORE than
//      the same route without it.
//   3. DISCIPLINE — a high-AWR defender is fooled LESS by the double move than
//      a low-AWR one (the bite scales with TEC−AWR).
//   4. NEUTRAL — with no shape supplied, mean matches baseline (sep_probe-safe;
//      re-asserted here so the probe itself proves zero-neutrality).
//
// Usage: node tools/route_shape_probe.mjs [duelsPerCell]
import { routeDuel }   from '../js/engine/sepgeo.js';
import { createPlayer } from '../js/engine/player.js';

const N = Number(process.argv[2] || 8000);
const RECS = Array.from({ length: 120 }, () => createPlayer('WR', 'JR', 3));
const DEF  = createPlayer('CB', 'JR', 3);

const mean = (depth, type, scheme, def = DEF) => {
  let s = 0;
  for (let i = 0; i < N; i++) s += routeDuel(RECS[i % RECS.length], def, depth, type, false, null, scheme);
  return s / N;
};

let fails = 0;
const chk = (cond, msg) => { if (!cond) fails++; console.log(`  ${cond ? 'ok ' : 'BAD'} ${msg}`); };

console.log(`Route shapes — ${N} duels per cell, fixed pair\n`);

// ── 1. sharp vs speed at the break (medium in-breaker territory) ────────────
for (const depth of ['short', 'medium']) {
  const base  = mean(depth, 'offman', null);
  const sharp = mean(depth, 'offman', { route: { shape: 'sharp' } });
  const speed = mean(depth, 'offman', { route: { shape: 'speed' } });
  console.log(`${depth}: base ${base.toFixed(3)}  sharp ${sharp.toFixed(3)}  speed ${speed.toFixed(3)}`);
  chk(sharp > speed + 0.02, `${depth}: sharp cut separates more than speed cut at the break (Δ ${(sharp - speed).toFixed(3)})`);
  chk(Math.abs(base - mean(depth, 'offman', { route: { shape: '' } })) <= 0.015, `${depth}: empty shape is neutral`);
}

// ── 2. double move beats the single break ───────────────────────────────────
{
  const single = mean('medium', 'offman', { route: { shape: 'sharp' } });
  const dbl    = mean('medium', 'offman', { route: { shape: 'sharp', dbl: true } });
  console.log(`\ndouble move: single ${single.toFixed(3)}  dbl ${dbl.toFixed(3)}  Δ ${(dbl - single).toFixed(3)}`);
  chk(dbl > single + 0.02, `a double move separates more than the same route without it`);
}

// ── 3. discipline: high-AWR DB bites less ───────────────────────────────────
{
  const dumbDB  = { attributes: { ...DEF.attributes, AWR: 40 }, compositeRating: DEF.compositeRating };
  const smartDB = { attributes: { ...DEF.attributes, AWR: 90 }, compositeRating: DEF.compositeRating };
  const single  = (def) => mean('medium', 'offman', { route: { shape: 'sharp' } }, def);
  const dbl     = (def) => mean('medium', 'offman', { route: { shape: 'sharp', dbl: true } }, def);
  const gainDumb  = dbl(dumbDB)  - single(dumbDB);
  const gainSmart = dbl(smartDB) - single(smartDB);
  console.log(`\ndiscipline: dumb-DB double-move gain ${gainDumb.toFixed(3)}  smart-DB gain ${gainSmart.toFixed(3)}`);
  chk(gainDumb > gainSmart, `a disciplined (high-AWR) defender is fooled less by the double move`);
}

// ── 4. gate ─────────────────────────────────────────────────────────────────
{
  globalThis.__noRoute = true;
  const off = mean('medium', 'offman', { route: { shape: 'sharp', dbl: true } });
  globalThis.__noRoute = false;
  const base = mean('medium', 'offman', null);
  chk(Math.abs(off - base) <= 0.015, `__noRoute gate collapses shape to baseline (Δ ${(off - base).toFixed(3)})`);
}

console.log(fails
  ? `\nFAIL — ${fails} check(s).`
  : '\nPASS — sharp cuts out-separate speed cuts at the break, double moves beat single breaks, and discipline resists them.');
process.exit(fails ? 1 : 0);
