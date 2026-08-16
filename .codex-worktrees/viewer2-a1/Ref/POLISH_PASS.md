# Polish Pass — working brief

**Status: brief for a full polish pass. Written Jul 2026 for a CC-in-VS-Code session, with
design/taste calls reviewed separately.**

This is the *ordered plan* for a polish pass. It does not restate the project's rules — those
live in `CLAUDE.md` and are authoritative. Read `CLAUDE.md` first. This file only adds: the
sequence to work in, the gates that must stay green, the consistency leads found in the
Jul 2026 UI/help work, and the line between mechanical work (do it) and taste calls (surface it).

---

## The gates — non-negotiable, run after every change

These are pass/fail, not suggestions. A change that reddens any of them is not done.

1. **Build + sanity checks.** `node tools/build.mjs` must finish with all 11 sanity checks
   PASS. The build is also the syntax gate (esbuild fails loudly on a parse error) and the
   only correct way to produce `dist/` and `blueprint-pages.zip`. Never hand-edit a built
   file; never hand-edit the `sw.js` cache hash. (CLAUDE.md → "The one command", "Two rules
   the service worker depends on".)
2. **Manual leak audit.** `node tools/manual_leak_audit.mjs` must print `clean`. Any manual
   or tooltip prose change re-runs this. It scans `js/ui/manual/*.js` (chapters + `tips.js`).
   Never a coefficient, threshold, or rate — ordinal/directional/conditional only.
3. **Boot clean.** Load `dist/index.html` in headless Chromium, assert **0** `pageerror`s.
   The render pipeline runs on load, so this catches a lot cheaply.
4. **Behavioural equivalence for anything that touches the sim or generation.**
   `node tools/_equiv_walk.mjs <built.html>` seeds `Math.random`, drives a real dynasty, and
   hashes the DOM at 34 checkpoints. Diff transcripts before/after. **A sim/balance/gen change
   without probe numbers does not ship** (CLAUDE.md → "Verifying a change").

> The probes import directly from `js/`. If you change a module a probe imports, run that
> probe. ~100 harnesses live in `tools/`.

---

## The sequence

Work top to bottom. Each phase ends with the gates above.

### Phase 1 — Verification sweep (pure mechanical value; start here)
Run the probe library and catalogue reality before changing anything.

- Run every `tools/*_probe.mjs`, `*_check.mjs`, `*_test.mjs`, `*_smoke.mjs`, `*_audit.mjs`,
  `*_harness.mjs`. Capture pass/fail + output for each.
- Cross-check failures against `Ref/RECONCILIATION_REPORT_2026-07-26.md`. **Three known
  failures are NOT regressions** and must not be "fixed" blindly (CLAUDE.md lists them):
  the `CAL` abbreviation collision (`Calhoun State` / `Calloway College`),
  `portal_balance_probe` + `recruit_assist_probe` (encode the *old* portal/recruiting economy),
  and `balance_probe`'s stale `heisman` row (key is now `legend`). Decide per-probe: fix the
  code, or update the probe's expectation — and say which.
- Known-good baseline to diff against: `worldgen_check`, `playcall_probe` (RUNG 6),
  `watchphys_probe` (RUNG 7A), `emergency_qb_probe`, `tendency_probe`,
  `recruit_tier_gate_probe`, `save_migration_check`, `balance_probe`.
- Deliverable: a short table — probe → pass/fail → real bug or stale expectation → action.

### Phase 2 — Consistency sweep (highest polish value for UI feel)
Two specific patterns were found and fixed on the depth-chart / help work this session. Both
almost certainly recur on other screens. Sweep for them repo-wide.

- **`rerender()`-on-every-tap.** A `+`/`−` stepper or dial that calls the global `rerender()`
  per tap rebuilds the whole screen, so controls shift under the finger and each tap has
  rebuild latency — this is what made the portrait dials feel "small and touchy." The fix
  pattern is in `js/ui/views/depthchart.js`: update the value **in place** (repaint just the
  affected readout nodes) instead of `rerender()`. The game-plan usage sliders and the
  target-share/blitz/RB-carry steppers already do this. **Audit every other screen** —
  recruiting, practice, coach office, scheduling, the halftime dials — for steppers/sliders
  that still full-rerender per interaction, and convert them to in-place updates.
  Grep lead: `rerender()` calls inside `addEventListener('click'|'input', …)` on `+/-`/slider
  controls.
- **Listener attached before the element exists.** The context-help `?` was injected into the
  DOM *after* `setupGlobalListeners()` ran, so a per-element `addEventListener` bound to
  nothing and the button was dead. Fixed with a **delegated** `document` listener (attached
  once). Sweep for other post-render-injected controls bound with per-element listeners rather
  than delegation.
- **Tap-target size on phones.** Portrait tap targets should be comfortable (the dials were
  26px; they're now tall ~40px split buttons). Spot-check other portrait controls for
  sub-~40px targets on cramped rows.

### Phase 3 — Dead code
- `node tools/deadcode_audit.mjs`. Review its output; remove what it flags **only** where you
  can confirm it's truly unreferenced (the audit is a lead, not a verdict). Re-run the gates.

### Phase 4 — Real end-to-end play (the bug class the probes can't see)
Probes import `js/` and test logic; they don't click. The `?`-was-dead bug and the Wishbone
freeze were both interaction bugs that only appear when you actually play. CC-in-editor can do
this properly with a local dev server + Playwright (the cloud session could not — version
mismatch + no localhost).

- Serve `dist/` over http (`npx serve dist`) — a service worker won't register on `file://`.
- Drive a full new-game → live game → offseason loop in a real browser. Assert 0 console
  errors across the whole flow, and actually exercise: every formation pick on the game plan
  (the Wishbone freeze was a formation-select bug), the `?` on every screen and in the live
  game, the depth-chart dials, tooltips, save/reload mid-season.
- `tools/_equiv_walk.mjs` and `tools/nav_back_smoke.mjs` are the scripted starting points; the
  manual play is what finds the rest.

### Phase 5 — Cross-cutting correctness (spot audits from CLAUDE.md invariants)
These are documented invariants worth re-verifying as a set:
- **Calendar display**: no screen prints `state.day`; all week text goes through
  `calendarWeek()`/`weekLabel()`/`weekShort()`. Grep for raw `state.day` in `js/ui/`.
- **Depth chart ↔ field ↔ sim agree**: `SHARED_POS` (picker) ⊆ `SLOT_ELIGIBLE_POS` (resolver),
  and every mesh spot is in `MESH_DEPTH_KEYS` (sim). `tools/fb_slot_probe.mjs` covers the FB/SLOT
  priority-switch case.
- **Save system**: a paused game is never serialized (`gamePauseIsLive()` gates all save
  paths). If `persistence.js` is touched, run `tools/save_migration_check.mjs` and
  `tools/midgame_save_probe.mjs`.

---

## Mechanical vs taste — the split for this pass

**Do it (mechanical):** run probes and fix red ones; convert full-rerender controls to in-place;
remove confirmed dead code; enlarge sub-40px phone targets; fix console errors found in E2E;
re-verify the documented invariants above.

**Surface it, don't just do it (taste / design):** anything that changes *what the game does*
or *how it reads* — balance/tuning values, manual or tooltip wording (voice is calibrated; see
`Ref/HELP_VOICE_SPEC.md`), navigation/IA changes, new UI affordances, renaming things a player
sees. These were conversations this session (the depth-chart TE/WR banding, the "Visibility"
wording being semantically wrong, the tab-bar vs sidebar nav split). Batch them into a short
"proposed, needs a call" list rather than committing them inside the mechanical pass.

## Cautions

- This codebase has load-bearing detail that looks like cruft: the leak-rule audit, the
  "eleven men always" sub-chain in `formations.js`, the fixed DOS date in `_zip.mjs` (for
  reproducible builds), the reconciliation tooling. **Don't "clean up" what you don't
  understand** — if a simplification would change bundle bytes or probe output, it's not a
  simplification, it's a change. Prove equivalence.
- Work from a **plain local path, not OneDrive** (CLAUDE.md → "Working environment" — a syncing
  folder reverted the bundle once).
- `npm install` once so esbuild 0.28.1 is local (the pinned version affects output bytes).
