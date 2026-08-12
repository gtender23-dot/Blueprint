# Release punch list — verified against source 2026-08-10

Companion to `Ref/RELEASE_READINESS_2026-08-08.md` (the external readiness review).
Every technical claim in that review was checked against the actual `js/` source on
2026-08-10. This doc records the verdicts, then turns the surviving blockers into a
prioritized action list. Items marked **SHIPPED 2026-08-10** were fixed the same day
(see the UPDATE section at the bottom).

---

## Part 1 — claim verdicts

### REFUTED (no action needed)

**R1. "Build ID ≠ service-worker cache name is a bug."**
`tools/build.mjs` derives both from one sha256 of every shipped byte, and build check
#7 asserts `index.html ≡ sw.js build id` — an artifact cannot ship mismatched.
`js/ui/views/mainmenu.js` reads the Cache Storage key as an *independent witness*
precisely because a stale build self-certifies; a disagreement means the device is
mixing builds (fresh HTML + not-yet-activated worker) and the ⚠ badge reports it.
The reviewer observed the diagnostic *catching* a real mid-deploy skew, resolved by one
reload. `build_stamp_smoke.mjs` covers this. Working as designed.

**R2. "2.58 MB monolithic index.html is maintenance debt."**
`dist/index.html` is generated output. Source = 81 ES modules under `js/` + `style.css`,
bundled by esbuild (pinned 0.28.1). Single-file output is a deliberate PWA decision
(one content-hashed file to cache; documented in CLAUDE.md). Not debt.

### CONFIRMED (actionable)

**C1. Placeholder-only text inputs.** `mm-nt-first/last`, `mm-tc-first/last`
(mainmenu.js), `ob-first/last` (newgame.js) have `placeholder` but no programmatic
label. → **SHIPPED 2026-08-10** (aria-labels).

**C2. Icon-only controls lack accessible names.** 💾 `btn-save`, ⌂ `btn-main-menu`,
✉ `btn-inbox`/`btn-inbox-top`, ← `btn-back-top` (app.js); 🗑 tree delete, ✕
world/team/replay deletes (mainmenu.js). All `title=` only. → **SHIPPED 2026-08-10**
(aria-labels; `title` kept for sighted tooltips).

**C3. Background stays in the accessibility tree under modals.** Broader than the
review's exhibition example: ALL overlays (`.modal-overlay`, kickoff, call-sheet,
live-watch) render above the retained base view with no `inert`/`aria-hidden`, and no
focus trap. → **SHIPPED 2026-08-10** (generic post-render pass: while any overlay is
open, non-overlay top-level children of `#app` get `inert` + `aria-hidden`, which also
yields keyboard containment for free).

**C4. Three product identities.** Wordmark "BLUEPRINT" (mainmenu), built page/PWA title
"Dynasty CFB" (build.mjs shell + manifest.json), dev-shell title "Blueprint: College
Football Dynasty" (root index.html), cache prefix `cfb-dynasty-`, deployed repo path
`/Blueprint/`. → OWNER DECISION (P1 below). One build-day mechanical pass unifies it
once a name is chosen.

**C5. No public footprint** (README, description, releases, store assets). Unverifiable
from the container but consistent with the repo contents (no README.md at root). →
OWNER-GATED (P1/P2 below).

### PARTIALLY REFUTED (narrower gap than reviewed)

**P-A. Save durability (review scored 4.5/10).** Already shipped and working:
IndexedDB primary store + localStorage dual-write on *every* save + legacy localStorage
fallback; **auto + 4 named slots** with school/season/week + timestamp shown in the
save modal; save-version gate (`SAVE_VERSION = 16`) that refuses rather than corrupts;
JSON export/import; `save_migration_check.mjs` (round-trip, version gate, size ceiling),
`_qa_saveload.mjs`, `midgame_save_probe.mjs`. The REAL remaining gaps:
  1. No rolling backups — each slot holds exactly one snapshot; auto overwrites every
     advance. A bad write or bad state at save time has no previous-good to fall back
     to. → **SHIPPED 2026-08-10** (auto-slot backup ring, depth 2 + load fallback).
  2. Refuse-not-migrate on version bump: every pre-v16 career is already unloadable.
     Policy decision needed — either write migrations from N-1 forward, or publicly
     commit to "saves survive within an Early Access major version." (P2)
  3. No cloud sync — inherent to browser distribution; a desktop-package question. (P3)

**P-B. Long-horizon balance proof (review scored 3/10).** Underrates existing
verification: ~230 probe harnesses, a tiered gate (`_gate.mjs` core/full), stat_realism
band harness with matched-RNG A/B vetoes, boot/equivalence checks. What genuinely does
NOT exist: a multi-decade soak harness (25–50+ seasons) tracking the review's league-
health metrics (recruiting equilibrium, carousel, talent concentration, championship
diversity, budget inflation). This is a new harness on proven infra, not a from-scratch
build — and it doubles as the "publishable tuning methodology." (P2, biggest
engineering item.)

---

## Part 2 — prioritized actions

### P0 — shipped 2026-08-10 (this pass)
- [x] C1 aria-labels on name inputs
- [x] C2 aria-labels on icon-only controls
- [x] C3 background `inert`/`aria-hidden` while any overlay is open
- [x] P-A.1 rolling auto-save backup ring (depth 2) + corrupted/missing-auto fallback
      on load + backups cleaned on world delete

### P1 — owner decisions (no code until decided)
- [ ] **Name.** Pick the final title; then one mechanical pass unifies wordmark, PWA
      title/manifest, dev shell, cache prefix, repo/Pages path. The review's argument
      (EA "Dynasty Blueprint" owns the search space) deserves a real naming session
      centered on the coaching-family hook.
- [ ] **Release posture.** Public beta (free) now vs quiet hardening. The review's
      "call it a public beta, don't charge yet" is consistent with the state of P2.
- [ ] **Save-compatibility policy** (see P-A.2): migrate-forward vs versioned-branch
      promise. Affects how SAVE_VERSION is handled from now on.

### P2 — engineering before any paid release
- [ ] **Soak harness** (`tools/league_soak_probe.mjs`): sim 25–50 seasons headless;
      report per-division scoring/yardage/turnovers, recruiting class quality spread,
      portal volume, progression curves, talent concentration (Gini over prestige),
      carousel throughput, championship diversity. Gate: no metric drifts monotonically
      season-over-season. Reuse worldgen + season loop the way save_migration_check does.
- [ ] Save migrations (or the public policy) per P1 decision.
- [ ] Keyboard-only + screen-reader + zoom pass across the full product (C1–C3 fixed
      the found defects; a systematic pass hasn't happened).
- [ ] README + changelog + known-issues + bug-report channel (an hour of writing once
      the name exists; the game is dramatically better than its public footprint).

### P3 — paid-1.0 horizon
- [ ] Desktop packaging (Tauri/Electron wrapper is natural for a single-file PWA) +
      Steam Cloud saves.
- [ ] Store assets: trailer, GIFs, screenshots, capsule art, positioning statement.
- [ ] Crash reporting / support channel.
- [ ] Price ladder per the review ($14.99 EA → $19.99 1.0) — revisit against comps at
      launch time.

---

## UPDATE 2026-08-10 — P0 implementation

See `js/ui/app.js` (accessible names, `syncOverlayInert()`), `js/ui/views/mainmenu.js`
(delete-control names, input labels), `js/ui/views/newgame.js` (input labels),
`js/engine/persistence.js` (auto backup ring: on every auto save the previous auto
record rotates to `auto.bak1` → `auto.bak2` inside the same IndexedDB transaction;
`loadGame("auto")` falls back to the newest readable backup when the primary is missing
or version-incompatible; backup slots are hidden from `listSaves` and removed by
`deleteSlotData`). Verification chain in the session log: build 11/11 → boot 0
pageerrors → `_qa_saveload` → `_qa_onboarding` → `save_migration_check` →
`midgame_save_probe` → `build_stamp_smoke` → `tree_probe`.
