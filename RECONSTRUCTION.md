# Source reconstruction — build `8aaad114d1` (pre-W1)

This `js/` tree was reconstructed from the deployed single-file build
`8aaad114d1` (GitHub commit `38f3103e…`, Aug 2 2026 09:37) — the last state of the
game before the Buy-In update (W1) began. No pre-W1 source existed anywhere: the
Pages repo only ever tracked build output.

## Why this is trustworthy

The deployed build was unminified esbuild output with its `// js/…` module
boundaries intact, so the split is mechanical rather than a guess. The rebuilt
bundle was diffed line-for-line against the original:

    original bundle   36,351 normalised lines
    rebuilt bundle    36,354 normalised lines
    difference        the esbuild spread helpers ONLY (see below)

Every line of game code is identical. Nothing was inferred, rewritten or dropped.

Scope analysis over the tree: 77 modules, 1,477 top-level symbols, **0 name
conflicts**, and every unresolved identifier is a browser or JS global
(`document`, `Math`, `indexedDB`, …). No dangling references.

## What differs from the source you originally wrote

The bundler is lossy in ways that don't change behaviour but do change how the
code reads. In rough order of how often you'll notice:

1. **Optional chaining and `??` are lowered** — `a?.b` became
   `a == null ? void 0 : a.b`. ~1,425 occurrences. Ugly, valid, harmless.
2. **Object spread is lowered** to `__spreadValues` / `__spreadProps` calls.
   Those helpers now live in `js/_spread.js` — that file is the *only*
   difference between the two bundles, and it exists so the spread calls resolve.
   If you'd rather have `{...a, ...b}` back, it can be converted later.
3. **Module-level `const` became `var … ;` + assignment.** esbuild hoists
   declarations; the reconstruction keeps that shape rather than guessing which
   were `const` and which were `let`.
4. **A few dozen symbols carry collision suffixes** — `clamp2`, `ordinal2`,
   `advanceDay2`. esbuild renames when two modules declare the same name. They
   are consistent across the tree and safe to rename back when you touch a file.
5. **Imports are mechanically derived**, one line per source module, alphabetical.
   Correct, but not how you'd have grouped them.
6. **Some comments were stripped.** 1,259 comment lines survived — the big design
   headers in `constants.js` are intact — but esbuild drops some, so expect gaps.

## Verified

- `node tools/build.mjs` → clean, 7 files in `dist/`, stamp matches cache name.
- Rebuilt from this tree: `dist/index.html` at 2,472,023 bytes vs the original's
  2,484,867. The 12.8 KB delta is esbuild's per-module `__esm` lazy-init wrappers,
  which real ESM ordering doesn't need.

**Not verified: a browser boot.** There is no Chromium in the environment this
was reconstructed in, so `tools/_boot_check.mjs` never ran. Run it — and play a
game — before you build anything on top of this.

## About `tools/`

`tools/` was copied from the W12 tree because that's the only copy that exists.
`build.mjs` and `_zip.mjs` are what you need. Most of the probes were written
against W1–W12 systems that don't exist in this code and will fail on import —
that's expected, not a defect in the tree. Prune them as you decide what the new
direction actually needs.

---

# Merge from the W12 working tree (second pass)

Everything below was brought in from your current working folder so this tree is
a complete environment, with Buy-In update content left out.

## Added

- `tools/` — 90 probes, harnesses and smokes that resolve against this baseline
- `CLAUDE.md`, `AGENTS.md` — workflow rules (checked: no Buy-In references)
- `Blueprint_Sim_Formulas.html` — formula reference (clean)
- `Ref/MANUAL_SPEC.md`, `PLAYBOOK_SPEC.md`, `HELP_VOICE_SPEC.md`,
  `GLOSSARY_ROADMAP.md`, `POLISH_PASS.md` — specs that predate the update
- `package-lock.json`

## Deliberately left out

- `Ref/BUYIN_WAVE_PLAN.md`, `Ref/WE_OVERHAUL_BRAINSTORM.md` — the update itself
- `NEXT_CHAT_SIMPLIFY.md`, `NEXT_SESSION_PROMPT.md`, `CONTINUE_HERE.md`,
  `DRIFT_REPORT_*.md`, `RECONCILIATION_REPORT_*.md` — session state from the update
- `node_modules/` — the copy in your zip has platform-specific esbuild binaries.
  Run `npm install`.
- `dist/`, `blueprint-pages.zip`, `404.html` — build output

One thing to know: `Ref/GLOSSARY_ROADMAP.md` line 152 mentions "the WE buy-in law"
in passing. It predates the update and describes the old work-ethic behaviour, not
the Buy-In system, but it's the one place the phrase survives.

## `tools/_buyin_era/` — 18 quarantined probes

Moved rather than deleted, in case you want to mine them. Every one either
imports a module this baseline doesn't have (`academics.js`, `tree.js`,
`grades.js`, `measures.js`, `practicepool.js`) or reads fields the pre-W1 player
object doesn't carry:

    aggression_probe        depth_auto_probe        dial_tradeoff_probe
    grade_honesty_probe     playcall_probe          roleweights_from_contests
    economy_probe           education_swing_probe   tree_probe
    w6_loop_smoke           w7_economy_smoke        w9_tree_smoke
    wants_probe             buyin_equilibrium       character_dynamics_probe
    character_profile_probe drift_probe             w8_wants_smoke

`playcall_probe` is the one worth noting — it was a mandatory gate for you, and it
misses by a single symbol (`stepToken` in `sim.js`, added after this baseline).
Cheap to repair if you want that gate back.

## Exports added for the probes

The reconstruction could only recover the exports the *app* used, since tool
imports were never in the bundle. 23 symbols across 11 modules were re-exported so
the probe suite links: they were already declared in those files, just not exposed.
Confirmed no effect on output — the bundle is byte-for-byte the same size before
and after, since esbuild tree-shakes unused exports.

## Runtime validation

Static equivalence was proven earlier. These ran green against this tree:

    worldgen_check          ALL CHECKS PASSED (1 warning)
    tier_talent_check       ALL PASS
    progression_check       ALL PASS
    recruiting_check        ALL CHECKS PASSED
    stat_realism_harness    full multi-season run, sane output

The harness reports sacks 2.06/team, plays 73.0, INT% 2.00, rush att 37.2 — all
inside your usual targets. It flags completion % at 55.0 against a 60–66 band.
That is the pre-W1 build's own calibration state, not a reconstruction artifact:
the code is identical line-for-line to what was deployed.
