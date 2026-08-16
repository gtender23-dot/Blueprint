// press_jam_probe.mjs — does winning the jam actually help the corner?
//
// It didn't. Shipped through Jul 2026, `routeDuel` delayed the RECEIVER on a won jam and
// left the DEFENDER free-running, so a corner who won the rep spent the jam in pure pursuit
// of a man standing still: he closed on him, overshot back toward the line carrying
// momentum the wrong way, and rebuilt all of it downfield. Separation allowed rose
// monotonically with every jam attribute, at every depth. Press coverage was inverted, and
// nothing in the game surfaced it — the number is consumed three layers down by the read,
// the catch and the interception, and a corner being quietly bad at his own technique looks
// like variance.
//
// Two things are checked, and the second is the one that caught the first fix:
//
//   1. MONOTONICITY — separation allowed must FALL as the defender's jam improves. This is
//      the inversion test.
//   2. MAGNITUDE — it must fall by enough to matter. Holding both men for the same beat
//      fixes the sign and produces a dead flat response, because a shared delay shifts both
//      men equally along the same path and cancels. The jam has to degrade the release, not
//      postpone it.
//
// Usage: node tools/press_jam_probe.mjs [duelsPerCell]
import { routeDuel }   from '../js/engine/sepgeo.js';
import { createPlayer } from '../js/engine/player.js';

const N      = Number(process.argv[2] || 6000);
const DEPTHS = ['short', 'medium', 'deep'];

// One fixed receiver pool, reused across every cell in the same order, so the only thing
// that differs between rows is the defender. Random receivers per cell buried the effect
// under population noise the first time this was run.
const RECS = Array.from({ length: 120 }, () => createPlayer('WR', 'JR', 3));
const BASE = createPlayer('CB', 'JR', 3);

const sepFor = (attrs, depth) => {
  const d = { attributes: attrs, compositeRating: BASE.compositeRating };
  let s = 0;
  for (let i = 0; i < N; i++) s += routeDuel(RECS[i % RECS.length], d, depth, 'press', true);
  return s / N;
};

// The jam blend is strength-led, technique next, agility last. Sweeping all three together
// is the honest test: a corner is not press-capable because of one attribute.
const LEVELS = [
  ['overmatched', { STR: 30, TEC: 30, AGI: 35 }],
  ['weak',        { STR: 45, TEC: 45, AGI: 45 }],
  ['average',     { STR: 60, TEC: 60, AGI: 60 }],
  ['good',        { STR: 75, TEC: 75, AGI: 72 }],
  ['elite',       { STR: 90, TEC: 90, AGI: 85 }],
];

console.log(`Press jam — ${N} duels per cell, one fixed receiver pool, defender swept\n`);
console.log('jam profile     ' + DEPTHS.map(d => d.padStart(9)).join(''));

const rows = [];
for (const [label, over] of LEVELS) {
  const attrs = { ...BASE.attributes, ...over };
  const row = DEPTHS.map(d => sepFor(attrs, d));
  rows.push({ label, row });
  console.log(label.padEnd(16) + row.map(v => v.toFixed(3).padStart(9)).join(''));
}

console.log('\n(separation allowed — LOWER is better coverage)\n');

let fails = 0;
DEPTHS.forEach((depth, di) => {
  const col = rows.map(r => r.row[di]);
  const swing = col[0] - col[col.length - 1];       // overmatched minus elite
  // Monotonicity is checked end-to-end rather than step-by-step: adjacent cells sit inside
  // each other's noise at any sane sample size, and demanding a strict ladder would make
  // this probe flap.
  const inverted = swing < 0;
  const flat     = Math.abs(swing) < 0.02;
  if (inverted) { fails++; console.log(`  ${depth.padEnd(7)} INVERTED — elite corners allow ${(-swing).toFixed(3)} MORE than overmatched ones`); }
  else if (flat) { fails++; console.log(`  ${depth.padEnd(7)} FLAT — jam swing ${swing.toFixed(3)}; winning the rep buys essentially nothing`); }
  else           { console.log(`  ${depth.padEnd(7)} ok — elite corners allow ${swing.toFixed(3)} less than overmatched ones`); }
});

console.log(fails
  ? `\nFAIL — ${fails} depth(s). The jam is not paying off.`
  : '\nPASS — winning the jam reduces separation at every depth, by a margin that matters.');
process.exit(fails ? 1 : 0);
