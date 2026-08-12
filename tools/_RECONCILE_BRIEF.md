# Reconciliation worker brief

## The situation

`cfb_mobile.html` is the authoritative build of this game. It is esbuild output that was
then **hand-edited for weeks**, so the `js/` source tree it was originally built from is
stale by ~4,900 lines of code. Your job is to move the changes for **one module** back
into its source file, so that rebuilding from `js/` reproduces the authoritative bundle.

The authoritative bundle has been split into per-module chunks at `/tmp/split_AUTH/`
(e.g. `/tmp/split_AUTH/js~engine~player.js` is the authoritative output for
`js/engine/player.js`). Those chunks are **read-only reference**. Never edit them.

## Rules

1. **You own exactly ONE source file.** Do not edit any other file in the repo — other
   workers are editing theirs in parallel. Do not edit anything in `/tmp`, `tools/`,
   `cfb_mobile.html`, or `sw.js`.
2. **Do not change behaviour beyond what the diff shows.** You are transcribing existing,
   shipped, working code back into source. You are not improving it, renaming things,
   reformatting neighbouring code, or fixing bugs you notice. If you think something in
   the authoritative code is wrong, transcribe it faithfully and mention it in your report.
3. **Write real source syntax, not esbuild's lowered output.** See the transform table below.
4. **Never delete existing source code that the diff doesn't ask you to delete.**

## Your gate

```
cd /home/claude/cfb
node tools/_reconcile.mjs <YOUR_CHUNK_NAME> --tag=<YOUR_TAG> --diff
```

- `<YOUR_CHUNK_NAME>` is your chunk filename, e.g. `js~engine~player.js`.
- `<YOUR_TAG>` is a unique tag so parallel builds don't collide — use your module's short
  name, e.g. `--tag=player`.

Output looks like:

```
js~engine~player.js             +23   -11      (+40 / -12)
                                ^^^^^^^^^      ^^^^^^^^^^^
                                THE GATE       layout only — ignore
```

**You are done when the GATE (the first pair) reads `+0 -0`.** The second pair in
parentheses is layout-only difference and is NOT your problem — see below.

`--diff` prints the readable diff: **left side (`-`) is what your source currently
produces, right side (`+`) is what it must produce.** Other flags: `--sem` shows the
diff the gate actually scores (harder to read, useful when the readable diff looks
already-identical), `--raw` shows the untouched diff with comments.

Iterate: read diff → edit source → re-run. Don't stop while any hunk is unexplained.

## The gate scores semantics, not formatting

Both sides are minified and re-printed before scoring. So none of the following counts
as drift, and you must not chase any of it:

- comments of any kind, including trailing `// like this`
- `0.006` vs `6e-3` — esbuild always re-spells number literals
- an array hand-wrapped 3-per-line vs one-per-line
- `if (x) { y = 1; }` on one line vs expanded
- separate `var a; var b;` vs merged `var a, b;`

This matters because `cfb_mobile.html` was **hand-edited**, so it is full of formatting
that no source file can make esbuild re-emit. Chasing it is wasted effort. If the gate
says `+0 -0` you are done even if the layout column still shows hundreds of lines.

**Still copy the authoritative comments into your source anyway.** They're good
documentation and source is where they belong — they just aren't scored.

## When a hunk is genuinely impossible

A few hunks in the bundle cannot be produced by any source, because the hand-editor wrote
something esbuild would never emit. The known class is **identifier shadowing**: if the
bundle says `const chance` but a top-level `chance()` exists in another module, esbuild
is forced to emit `chance2`, so no source spelling matches.

Do not contort your source to force these. Write the correct source form, then report the
hunk with your reasoning. The coordinator maintains an allowlist
(`tools/_reconcile_accepted.json`) for exactly this.

Before you claim a hunk is impossible, prove it: construct the minimal source you think
should work, build, and show what esbuild actually emitted. "I couldn't get it to match"
is not the same as "it cannot match".

## esbuild transform table (source → bundle chunk)

Your source is ES modules; the chunk is the bundled IIFE. Read the chunk *through* these
rules — write the left-hand form in source, expect the right-hand form in the chunk.

| source | chunk |
|---|---|
| `import { x } from './y.js';` | *(gone)* — replaced by an `init_y();` call near the top of the chunk |
| `export function f() {}` | `function f() {}` |
| `export const K = 1;` | `var K;` at chunk top + `K = 1;` inside the `init_<mod>({...})` body |
| `export let v = null;` | `var v = null;` |
| `a?.b` | `a == null ? void 0 : a.b` (often with a `var _a, _b;` temp at the top of the function) |
| `a?.b?.c` | `(_a = a == null ? void 0 : a.b) == null ? void 0 : _a.c` |
| `a ?? b` | `a != null ? a : b` |
| `f?.(x)` | `f == null ? void 0 : f(x)` |
| `'single quotes'` | `"double quotes"` |
| a non-ASCII char (em dash, emoji, ★) | a `\uXXXX` / `\u{XXXXX}` escape **in string literals only** — in comments and template-literal text it stays literal |
| `function f(a) {` with a body using `?.` | `function f(a) {` then `var _a, _b;` inserted as the first line |
| top-level name colliding with another module's | renamed with a numeric suffix: `state` → `state2`, `clamp` → `clamp2` |

**The rename suffixes are not yours to choose.** If the chunk says `state2`, your source
still says `state` — esbuild adds the suffix. Never write `state2` in source. To see the
exact rename map for your module, compare your current chunk output
(`/tmp/split_CUR_<tag>/<chunk>`) against your source file.

Indentation inside the chunk is your source indentation + 2 (module body) or + 4
(inside an `init_*` wrapper). Don't try to match chunk indentation in source; write
normal source indentation and let the gate confirm.

## Things that will bite you

- **A declaration esbuild tree-shakes away.** If you add a module-level `let`/`const`
  that nothing in your module uses, esbuild drops it and your chunk won't match. That
  usually means the binding belongs in a *different* module in real source — report it
  rather than forcing it.
- **A missing import shows up as a missing `init_*()` call**, not as an error. If your
  chunk is missing an `init_something();` line near the top, you're missing an
  `import` from `./something.js`. Conversely an extra `init_*()` means an unused import.
- **You may need a symbol a sibling module doesn't export yet.** Do NOT edit the sibling.
  Add your `import` as if it existed, note it in your report, and if the build then fails
  with "No matching export", say so — the coordinator will sequence it.
- **Build fails with an error in a file you don't own.** That's another worker mid-write.
  Wait a moment and re-run. If it persists across several tries, report it.

## Your report back

Keep it short. State: (1) final gate result for your module, (2) what the change actually
was, in one or two sentences of substance — not a list of line numbers, (3) anything you
had to guess at, anything you couldn't resolve, and any new cross-module import you added.
