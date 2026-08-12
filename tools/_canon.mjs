// _canon.mjs — normalizers for the bundle↔source reconciliation gate.
//
// The gate cannot be a textual diff. cfb_mobile.html is esbuild output that was then
// hand-edited, and hand-written text carries formatting esbuild will never re-emit from
// ANY source:
//
//   • trailing same-line comments        → esbuild moves them onto their own line
//   • `0.006`                            → esbuild always prints `6e-3`
//   • an array hand-wrapped 3-per-line   → esbuild is all-or-nothing
//   • `if (x) { y = 1; }` on one line    → esbuild always expands the block
//   • a one-line object in a data table  → esbuild expands or collapses by its own rules
//
// Two normalizers, used for two different jobs:
//
//   semantic()  — minify (whitespace + syntax), then pretty-print. Neutralizes ALL layout,
//                 including single-line vs multi-line literals and separate vs merged
//                 `var` declarations. THIS IS THE GATE: it answers "does the rebuilt game
//                 behave identically?", which is the only question that matters. Its
//                 downside is granularity — it merges top-level `var`s and puts whole data
//                 tables on one line, so its line counts are coarse.
//
//   readable()  — pretty-print only. Strips comments, re-spells number literals and
//                 expands one-line blocks, but keeps one statement per line. THIS IS WHAT
//                 WORKERS READ: its diffs point at the actual line to change.
//
// A module is done when semantic() diffs to zero. readable() drift with semantic() at zero
// means the bundle's layout differs from what a build emits — cosmetic, and not fixable
// from source.

import * as esbuild from 'esbuild';

const tx = (code, opts) => esbuild.transform(code, { ...opts, target: 'es2017', loader: 'js' });

// A chunk is a fragment of the bundle IIFE's body, so it does not parse on its own: the
// final chunk carries the IIFE's closing `})();` (and, on the authoritative side, the
// `_CFB.init().catch(...)` boot script that build.mjs appends in the HTML template, which
// is not bundle output at all), and any chunk may contain a bare `return`. Cut at the
// closer and wrap the rest in a function so esbuild will parse it. Applied identically to
// both sides, so nothing real is hidden.
function parseable(code) {
  const end = code.search(/^\}\)\(\);/m);
  const body = end === -1 ? code : code.slice(0, end);
  return `function __chunk() {\n${body}\n}`;
}

export async function readable(code) {
  return (await tx(parseable(code), {})).code;
}

export async function semantic(code) {
  const min = await tx(parseable(code), { minifyWhitespace: true, minifySyntax: true });
  return (await tx(min.code, {})).code;
}
