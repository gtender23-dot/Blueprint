# Blueprint: College Football Dynasty — project notes for Claude

> ## ⚑ START HERE
> **Before doing anything, read `Ref/STATUS.md`** — it is the living record of
> where the project actually is right now (what's done, what's open) and, most
> importantly, the **two-repo layout** that trips up fresh sessions. This file
> (`CLAUDE.md`) is the *stable* architecture/build reference; `Ref/STATUS.md` is
> the *current* state. If a request is vague ("check on the merge", "where are
> we"), `Ref/STATUS.md` is the answer. Keep it updated as you finish work.

## Source of truth: `js/` and `style.css`

The game is written as split ES modules under `js/`, plus `style.css`. **That is the
source. Edit it.** Everything else is generated.

This used to be the other way round — a single 2 MB `cfb_mobile.html` was edited by hand
and the `js/` tree rotted. That drift was reconciled on 2026-07-26 (see
`Ref/RECONCILIATION_REPORT_2026-07-26.md`); ~4,900 lines of code that existed only in the
bundle now live in the modules. **Do not go back to hand-editing a built file.** There is
no longer a `cfb_mobile.html` in the project root, on purpose — the build writes to
`dist/`, so there is nothing at the top level that looks editable but isn't.

## The one command

```
node tools/build.mjs
```

That is the whole build. It:

1. bundles `js/` into one IIFE with esbuild (pinned to 0.28.1 — the version affects the
   output bytes) and inlines it plus `style.css` into a single self-contained HTML file;
2. stamps `sw.js` with the bundle's content hash;
3. writes `dist/` — the seven files GitHub Pages needs;
4. writes `blueprint-pages.zip` — those same seven files, ready to drop on the Pages repo.

The zip can never be stale relative to the bundle, because the same run produces both.

## Deploying

The site is a GitHub Pages **project site** at `https://gtender23-dot.github.io/Blueprint/`
— note it's served from a subpath, not the domain root, so every path in the deployed
files must be relative (`./…`), never absolute (`/…`).

1. `node tools/build.mjs`
2. Extract `blueprint-pages.zip` over the local clone of the Pages repo
3. Commit and push

The seven files are:

| file | what it is |
|---|---|
| `index.html` | the entire game, one file |
| `404.html` | identical bytes, so any deep link still serves the app |
| `sw.js` | service worker, cache name stamped with the build hash |
| `manifest.json` | PWA manifest |
| `icon-192.png`, `icon-512.png` | icons |
| `.nojekyll` | stops GitHub running Jekyll over the files |

To check the phone experience before pushing, serve `dist/` over http — a service worker
will not register on `file://`:

```
npx serve dist
```

## Why the single-file bundle still exists

GitHub Pages would happily serve `index.html` + the `js/` folder directly; ES modules work
fine over https. The bundle exists for the phone: the service worker has to cache the app
for offline use, and caching **one** file with a content hash is trivial and reliable,
whereas enumerating ~57 module files is fragile and silently breaks when one is missed. It
also costs one HTTP round-trip on cellular instead of 57.

So the bundle is output, not source. Nobody edits it.

## Two rules the service worker depends on

Both of these were real bugs found on 2026-07-26, and both were silent failures.

**1. Paths in `sw.js` and `manifest.json` must be root-relative (`./`), never a filename.**
The bundle is served as `index.html` on Pages, so an entry like `'./cfb_mobile.html'`
404s — and because `cache.addAll()` rejects if *any* entry fails, one bad path kills the
whole install. The result is no service worker at all: no offline support, and the
cache-busting mechanism never runs. Verified empirically — with the old paths the SW got
0 registrations and an empty cache; with `'./'` it registers, caches four URLs, and an
offline reload serves the game. `tools/build.mjs` has a sanity check for this.

**2. The cache name must change every build.** It does, automatically —
`tools/build.mjs` stamps `sw.js` with the bundle's sha256 prefix. `sw.js` in the project
root holds the literal placeholder `cfb-dynasty-__BUILD_HASH__`; the stamped copy only
exists in `dist/`. **Never edit that hash by hand.** Without a new cache name, an already-
installed phone keeps serving the old build forever (network-first on HTML helps online
users, but the cache name is what forces installed PWAs to refresh).

## Verifying a change

### The one command (added 2026-08-09, after Pass 7)

```
node tools/_gate.mjs            # core tier — the per-change-set gate (~10 min local)
node tools/_gate.mjs full       # deploy-level sweep (full ⊇ core, minus the night giants)
node tools/_gate.mjs night      # the deferred CPU giants — run when the machine is free
node tools/_gate.mjs --list     # see what runs and why
```

The gate runs the build + boot check, then the probe registry in
`tools/_gate_manifest.mjs`. **Policy:** every change-set runs CORE before it
ships (stat bands + the current pass's A/B + the newest-surface probes + the
UI trio). FULL runs before a deploy, or when a change touches an old
subsystem. Don't hand-pick probes ad hoc — if the tiers are wrong, edit the
manifest (data only, commented) so the fix is permanent.

The manifest encodes the hard-won environment knowledge, so nobody re-diagnoses
it: `seedFlaky` entries retry once (unseeded RNG — the standing flaky list);
`envKnown` entries fail identically on a pristine tree in the cloud container
(verified 2026-08-09) and are informational THERE but gating on a local
machine; `night` entries (h2_shadow, recruit_calendar — the CPU giants) are
deferred out of core AND full by owner request (2026-08-10: they crawled the
working machine mid-day) — full lists them as deferred, and
`node tools/_gate.mjs night` runs them when the machine is free; a deploy
still owes a green night run. They also carry `localOnly` (unrunnable in the
cloud container). N overrides live in
the manifest too (covfam regression N=120; use its default N=300 only when
coverage code changed). When a pass ships a new band A/B, swap it into the
core entry marked "CURRENT pass A/B" and demote the old one to full.

The sections below describe the individual layers the gate is made of — still
the right tools when working on ONE mechanism.

**Syntax.** The bundle is one large IIFE. Extract the `<script>` blocks and run
`new Function(src)` on each.

**Boot.** Headless Chromium, load `dist/index.html`, assert 0 `pageerror`s — the render
pipeline runs on load, so this catches a lot.

**Behavioural equivalence.** `node tools/_equiv_walk.mjs <built.html>` pins `Math.random`
to a seeded PRNG, drives the real new-game wizard to a live dynasty, then visits every game
screen, hashing the rendered DOM at each step. Run it against two builds and diff the
transcripts — identical output means identical behaviour. This is how the reconciliation was
proved: 34 checkpoints, byte-identical.

**Sim / generation / balance changes: always get numbers.** `tools/` holds ~100 probe
harnesses that import directly from `js/`. Write or run one and print before/after
distributions. Do not ship a balance change without them.

> This is the whole reason the reconciliation mattered. 11 of 16 sampled probes import from
> `../js/`, so while the source was stale **every number they produced described code that
> wasn't shipping.** They work now — keep them working. If you change a module a probe
> imports, run that probe.

Known-good after reconciliation: `worldgen_check`, `playcall_probe` (RUNG 6 PASS),
`watchphys_probe` (RUNG 7A PASS), `emergency_qb_probe`, `tendency_probe`,
`recruit_tier_gate_probe`, `save_migration_check`, `balance_probe`.

Three probes fail against current code, and **none is a regression** — they encode
pre-rework expectations, plus one real bug. See the reconciliation report. In short:
`Calhoun State` and `Calloway College` both take the abbr `CAL` in every world (the static
D1 table is registered outside the procedural dedup pass); `portal_balance_probe` and
`recruit_assist_probe` assert the old portal economy and old needs-only recruiting;
`balance_probe` still prints a `heisman` row for a key now called `legend`.

## Reconciliation tooling (still in `tools/`)

- `_reconcile.mjs` — compares a build from `js/` against a reference bundle, semantically
  rather than textually. It needs the reference chunks in `/tmp/split_AUTH`, so it is only
  live during a reconciliation session. Kept for the record and in case the two ever drift
  again.
- `_canon.mjs` — the normalizers, and *why* a textual diff can't work: esbuild strips
  comments, re-spells `0.006` as `6e-3`, and re-wraps literals, so hand-edited output can
  never be reproduced byte-for-byte.
- `_reconcile_accepted.json` — 19 hunks in the old bundle that no valid ES-module source
  can produce, each with evidence.
- `_RECONCILE_BRIEF.md` — the esbuild source→bundle transform table. Useful any time you
  need to read bundle output and reason back to source.
- `_zip.mjs` — dependency-free ZIP writer (Windows has no `zip` command).

## The help system — normalized help language (voice retired 2026-08-11)

**Owner update 2026-08-11: the stylized "help voice" is retired — help copy is
written in normalized, plain language. The rules below are unchanged and still
bind.** (Original 2026-07-26 brief, kept for the record: "a contained super in
depth and technical but still vague enough to hide the actual formulas behind
everything uses more football analogies to explain how everything works. its based
off realism so should be understandable.")

The four rules, unchanged:

1. **Contained.** Help lives inside the game, not in an external wiki or a README. One
   place a coach can open mid-dynasty.
2. **Deep and technical.** Don't write marketing copy. Explain the actual mechanism —
   what the sim is weighing, in what order, and what changes the answer.
3. **Vague about the numbers, on purpose.** Never print a coefficient, a weight table, or
   a threshold. "Speed carries most of a corner's coverage, agility next" — never
   `SPD 0.41`. Solving the game from the help screen ruins it.
4. **Football analogies, not engineering ones.** The model is built off real football, so
   real-football language should already describe it correctly. If a mechanic can only be
   explained in code terms, that's a signal the mechanic is unrealistic, not that the help
   text needs a diagram.

## Displaying the calendar — days vs weeks

`state.day` is a flat 1–30 counter and that is the engine's business. **No screen prints
`state.day` directly.** Everything user-facing goes through `calendarWeek()` /
`weekLabel()` / `weekShort()` in `js/engine/season.js`, which translates to how football
actually talks: camp is Preseason Week 1–4, the regular season restarts at Week 1 on the
first game day, the playoffs are rounds, and the offseason is just "Offseason". One
translation point means the dashboard, topbar, schedule, scout page and save slots can't
disagree with each other. If you add a screen that shows a week, import the helper.

## Depth chart ↔ field ↔ sim: the three places that must agree

A hand-picked player has to survive three hops, and each one has broken independently:

1. **The picker offers** — `SHARED_POS` in `depthchart.js` decides who's listed for a slot.
2. **The resolver accepts** — `SLOT_ELIGIBLE_POS` in `fieldassign.js` is the gate. The
   picker must never offer a body the gate refuses, or the UI promises a lineup the field
   silently declines.
3. **The sim receives** — `sim.js` copies the coach's `depthOrder` overrides for the mesh
   spots into the depth it hands the resolver. `MESH_DEPTH_KEYS` is that list. If a spot is
   missing from it, the depth-chart screen shows your pick and the game plays someone else.
   That was true of every mesh spot except SLOT until Jul 2026.

Naming a man is also the priority switch, for SLOT and FB alike: name a joker and SLOT
resolves before the receiver rooms; name a fullback and the RB group (which owns the FB
slot) resolves before the rooms that would otherwise claim him. Leave either on Auto and
the natural-position default holds. `tools/fb_slot_probe.mjs` covers this.

## Save system

Saves are local: IndexedDB, with a synchronous `localStorage` flush on
`pagehide`/`beforeunload` and a 30-second autosave. No server-side saves. If you touch
`js/engine/persistence.js`, run `tools/save_migration_check.mjs`.

**A paused game is never serialized.** `gamePauseIsLive()` in `persistence.js` gates every
save path — the manual button, the 30s autosave, and the pagehide/visibilitychange flush.
Do not add a fourth path that skips it. The reason (proved by
`tools/midgame_save_probe.mjs`): `pendingHalftime.game` and the schedule's entry for that
game are **one object**. `JSON.stringify` splits them into two. The reloaded save then
plays the game onto the orphan, the schedule's copy keeps `result` unset forever, and
`advanceDay` only ever looks at today — so that game is never played again. The coach sits
at 0-0 while the league racks up wins and the weeks roll by. This shipped for a while and is
what the Jul 2026 "closed the chalk viewer and it broke the season" report was.

Two things clean up after it, and both should stay:

- `rehydrate()` drops a serialized pause on load. An old save can still carry one, and it
  is not resumable — the token's ask closures are gone.
- `resolveStaleGames()` in `season.js` plays any regular-season game the calendar walked
  past. It normally finds nothing. It credits the standings only when a school's record is
  actually behind the games its schedule shows (`recordIsShort`) — the orphan may already
  have banked the result, and counting it twice invents a game.

## Working environment

Keep the repo in a **plain local path, not inside OneDrive or any auto-syncing folder.**
Frequent writes to a synced file reverted the bundle once already. Push to GitHub from a
normal working directory.

Run `npm install` once so the pinned esbuild is local; the build falls back to
`npx esbuild@0.28.1` if it isn't, which works but is slower.
