// seed_hygiene_probe.mjs — NO PROBE MAY PIN A BROKEN GENERATOR.
//
// 2026-08-21/22. The seeding idiom the probes copied from each other was:
//
//     s = (s * 1103515245 + 12345) & 0x7fffffff;  return s / 0x7fffffff;
//
// a textbook LCG written in a language that cannot hold it. `s` runs to 2^31,
// and 2^31 x 1103515245 ~ 2.4e18 — far past Number.MAX_SAFE_INTEGER (9.0e15) —
// so the multiply rounds away its low bits and the mask then keeps exactly the
// bits that were rounded away.
//
// Measured: the state falls into a cycle of length 10,466 FOR EVERY SEED TRIED.
// An N-game arm draws millions of values, so it replays that same short loop
// hundreds of times. "Deterministic by construction" was true and meaningless —
// reproducible, but reproducing the wrong thing. It is why time_to_throw's
// sack-neutrality gap read 2.09-vs-1.98 on one seed and 3.36-vs-0.99 on another.
//
// Eleven files carried it. This stops the twelfth.
//
// What is ALLOWED:
//   * tools/_seed.mjs (mulberry32, Math.imul throughout — nothing rounds);
//   * the Numerical Recipes constants (s * 1664525 + 1013904223) >>> 0, which
//     tops out at 7.1e15 and so stays exact — verified no repeat in 3e6 draws;
//   * inline mulberry32, which several probes already had and which is correct.
//
// Run from repo root: node tools/seed_hygiene_probe.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIRS = ['tools', 'js', 'js/ui', 'js/ui/views', 'js/engine'];
// The multiplier is the fingerprint: any 32-bit LCG whose product can exceed
// 2^53 is broken the same way. 1103515245 is the one that spread here.
const BROKEN = /1103515245/;
// Cosmetic, tiny-draw-count uses that are harmless and deliberately left alone.
// A few pellets of turf spray or a weather scatter never reaches 10,466 draws.
const ALLOW = {
  'js/ui/app.js': 'cosmetic scatter only — turf pellets (4-7 draws) and the weather layer; nowhere near the cycle, and reworking shipped visual output is not worth it',
  'tools/_seed.mjs': 'quotes the broken constant in the comment that explains it',
  'tools/seed_hygiene_probe.mjs': 'this file',
  'tools/_gate_manifest.mjs': 'quotes the broken constant in this probe\'s own note',
};

const hits = [];
for (const d of DIRS) {
  let names = [];
  try { names = readdirSync(d, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name); } catch { continue; }
  for (const n of names) {
    if (!/\.(mjs|js)$/.test(n)) continue;
    const rel = `${d}/${n}`;
    let src;
    try { src = readFileSync(join(d, n), 'utf8'); } catch { continue; }
    if (!BROKEN.test(src)) continue;
    hits.push({ rel, allowed: ALLOW[rel] || null });
  }
}

const flagged = hits.filter((h) => !h.allowed);
console.log(`=== SEED HYGIENE — ${hits.length} file(s) mention the broken multiplier ===\n`);
for (const h of hits.filter((x) => x.allowed)) console.log(`  ·  ${h.rel.padEnd(34)} allowed: ${h.allowed}`);
if (flagged.length) {
  console.log('\nTHESE PIN A GENERATOR THAT CYCLES EVERY 10,466 DRAWS:');
  for (const h of flagged) console.log(`  x  ${h.rel}`);
  console.log('\nFix: import { mulberry32, pinRandom, pinPageRandom } from tools/_seed.mjs.');
  console.log('If the use is genuinely cosmetic and draws only a handful of values,');
  console.log('add it to ALLOW above WITH a reason — not silently.');
}
console.log(flagged.length ? `\nSEED HYGIENE FAIL (${flagged.length})` : '\nSEED HYGIENE PASS');
process.exit(flagged.length ? 1 : 0);
