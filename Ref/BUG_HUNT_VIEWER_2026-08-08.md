# Viewer / play-caller bug hunt — 2026-08-08

Scope: the watch viewer (`watchphys.js`, `sprite.js`, the `app.js` watch loop and
boards, sprite CSS) and the play caller (live call sheet, timeout screen, tempo bar,
`gameplan.js` dials, `playnow` flows). Owner directive: **fix as found**; anything
judgment-based or stat-affecting is reported, not touched. **No engine files were
modified** — `sim.js`, `situations.js`, and all of `js/engine/` are byte-identical,
so every stat band stands untouched by construction.

Severity legend: **critical** · **likely-bug** · **smell** · **nit**.

---

## FIXED (24) — shipped, verified, built

### Play caller

1. **critical — Timeout screen unreachable in live coach mode** (`app.js`
   `renderTimeoutAdjustOverlay`). Gated on `state.ui.showCallSheet`, which is false on
   the dominant Every-Snap live path — tapping "⏱️ Timeout" armed and burned the
   timeout but the W4 screen (Next Play Only / Rest of Game / Cancel) never opened.
   Gate now keys on `callTimeout && timeoutAdjust`. `answerPlayCall` also clears
   `timeoutAdjust` (it used to linger).
2. **critical — "Rest of Game" timeout tab totally unwired** (`app.js`). Nothing ever
   called `wireDefaultsListeners` on `#to-adjust-root`, so every knob in the tab was
   dead. Wired in the global listener pass. New gate: `tools/timeout_screen_smoke.mjs`.
3. **critical — Simple "Defensive Posture" dial's aggression core was dead**
   (`gameplan.js` `applySimpleDial`). It wrote legacy `gp.blitzPct`, but the engine
   resolves the `defAggression` stop first and `normalizeDefGameplan` re-mirrors
   `blitzPct` from the stop every game — so the posture never changed pressure and the
   dial's own display sprang back after one game. Now writes the stop via `setAggr`
   (attack→attacking, bend→bend).
4. **critical — Simple Situations defensive lever stuck after the first sim'd game**
   (`gameplan.js` `applySimpleSit`). Same mechanism per-cell, worse: the engine
   *deletes* `cell.blitzPct` after converting it, so Attack-once froze "attacking"
   into the cell and Protect/Auto could never undo it. Now writes/deletes
   `cell.defAggression`; readers (`currentSimpleSit`/`currentSimpleDial`) are
   stop-first.
5. **likely-bug — Simple "Offensive Identity" wrote the defensive box** — `runCommit`
   (a defense-only lever) was set by the offense dial and silently fought the
   Defensive Posture dial's own `runCommit`. Removed from the offense dial.
6. **likely-bug — invalid `coverageScheme` enums** — simple mode wrote
   "aggressive"/"conservative", which the engine ignores (only lockTop/bracketTop are
   real) and the advanced tab rendered as a literal "undefined" tip; it also disabled
   the engine's auto lock/bracket answer (requires "balanced"). Simple mode now writes
   "balanced"/deletes; `setupListeners` coerces old saved values on sight.
7. **likely-bug — plan slots A/B/C and library "Load…" merged instead of replaced**
   (`Object.assign`) — deletable keys (`formChecks`, `defAggression`, `_nextPlay`…)
   from the outgoing plan survived into the newly-activated one (Plan B silently ran
   Plan A's personnel checks). Now replace-in-place, preserving object identity.
8. **likely-bug — "both teams" exhibitions: live tempo always edited Team 1's plan**
   (`timeControlBar` + its handler resolved by `playerSchoolId`, which stays pinned
   to home). Now resolves by possession/`playerSide` in both-mode, matching every
   other panel.
9. **likely-bug — halftime "Take Dive" option-key chip was a dead value** — engine
   only tests "qb"/"pitch". Chip removed (matches the base/situation panels).
10. **smell — sit-panel "Run Commit" lied about AUTO** — label said "0 (neutral box)"
    but AUTO inherits the base Box dial (±25); Take Over seeded 0 instead of the base
    value. Label + seed fixed.
11. **smell — Power-I hidden from THE OPTION GAME section** — engine runs Power-I
    option at 0.55 of run calls when the dial is unset (`OPTION_CAPABLE`), but the UI
    only showed the section for Wishbone/Flexbone/spread. Power-I added to the gate.
12. **smell — simple-Auto left null-valued keys → advanced grid flagged phantom
    CUSTOM cells**. Auto now deletes keys (and empty cells); `cellIsCustom` counts
    non-null values only.
13. **smell — inherit-label lies**: two-minute/four-minute Tempo cells now say
    "Hurry/Chew (smart auto)" (engine `SMART_AUTO_TEMPO` outranks baseTempo); Option
    Rate AUTO shows "formation's natural mix" when the base dial is unset (not 70%).
14. **nit — `state.ui.callSheetFormation` rename residue** (3 writes + init, never
    read; live key is `callFormation`) and **invalid `halftimeTab: "offense"`**
    (valid tabs: adjust/situations/boxscore) — both corrected in `state.js`.

### Watch viewer — mechanism

15. **likely-bug — INT returns: ball frozen at the pick spot** (`watchphys.js`). On a
    pass INT `carrier` is null, so `constrainTrack` pinned every post-catch ball frame
    to the catch point — the picker ran his return while the ball hovered behind him
    (the picker-follow branch of `ballPlan` was dead code, overwritten every frame).
    The ball's late track now copies the picked defender's track.
16. **likely-bug — RB checkdowns caught by nobody** (`watchphys.js`). The
    trace-target wiring only covered `catchers`; a non-screen back target kept the
    generic 14-unit swing while ball + catch fx played at a phantom spot (and the
    zone defender broke to it). Backs that are the trace target now release to the
    real catch point, then to the end spot — same contract as wideouts.
17. **likely-bug — screen flavor keyed off a dead comparison** (`watchphys.js`
    `screenKind`). `backs.some(b.id === p.targetId)` compared a slot id to a roster
    player id — never true — so organically-rolled RB screens (~72% of screens with a
    back on the field) animated as WR bubbles. `screenKind` now follows the recorded
    `targetSlotId` (back → rb, wideout → bubble/tunnel), fallbacks unchanged.
18. **likely-bug — `p.isRPO` vs `p.rpo`** — sim stamps `rpo`; the viewer read the
    never-set `isRPO`, so RPO throws animated a full dropback instead of the quick
    set. One-word fix. New gate for 15–18: `tools/viewer_fix_probe.mjs` (INT
    ball-follow 22/22, RB-target meet 78/78, back-screen geometry 95/95, cue timing).
19. **nit — move cues (juke/spin/dive) could fire before the catch** on short-YAC
    screens — now clamped to ≥ catch time on pass plays. Plus two dead-code cleanups
    (unreachable jet-motion guard, unreachable `p.td` arm in the goalline tackle
    pick).

### Watch viewer — presentation

20. **critical — body lean was completely dead** (`sprite.js`). The sprite's own
    inline `--wsp-lean:0deg` shadowed the value `spriteMotionTick` sets on the
    `.wp-actor` ancestor (an element's inline custom property beats inherited), so
    sprites never pitched into the run. Inline declaration removed; verified by
    computed-transform check (the old gallery "lean" check read the CSS var, which is
    why it green-lit the dead feature).
21. **likely-bug — kick plays rendered in stale/fallback jerseys** (`app.js`
    `watchBoard`). The team-color block sat *after* the kick-board early returns, so
    the opening kickoff (and any kick after a possession flip) missed it. Colors now
    stamp before dispatch.
22. **likely-bug — INT return arms** (`app.js` + CSS). The carrier scan was
    offense-only, so on turnovers the nearest offensive *chaser* got `wp-near-ball`
    (carry pose + carrier ring) while the return man ran with pumping arms.
    Defenders join the scan on turnover plays; CSS gives `wp-team-def.wp-near-ball`
    the carry pose.
23. **likely-bug — pose CSS gaps**: sacked QB rendered *armless* until his smoothed
    velocity decayed (no pose visible under `.wp-sacked`); tackled carriers kept
    pumping run arms mid-fall; side-view arm chains kept scrubbing over frozen legs;
    a blocked defender given a tackle cue showed four arms. Fixed with idle-pose
    display rules for sacked/tackled, arm-chain freezes, and
    `.wp-tackling .wsp-pose-block { display:none }`.
24. **likely-bug — assorted board/loop issues** (`app.js`, `sprite.js`):
    - Kickoff returner teleported onto the ball's mid-air arc 0.2s before landing —
      he now settles under it on the ground (mirrors the punt board).
    - Velocity estimator divided the full-`dt` displacement by the 80ms-clamped
      `idt`, so any frame hitch read as a speed spike that whipped held facings
      (backpedaling DBs spun around after a heavy sim frame). Now divides by real
      `dt`; smoothing constant keeps the clamp.
    - Final frame of every play now stamps `wsp-still` — actors moving at the whistle
      no longer bob/pump forever through the result-card linger.
    - Sprite name tag now HTML-escaped (the number already was).

### Watch loop / chrome

25. **likely-bug — Play-by-Play tab printed literal `<span>` markup** — the coverage
    note was appended as raw HTML into `desc.text`, then escaped at render. The note
    is now built separately and escaped on its own.
26. **likely-bug — paused viewer consumed plays on any rerender** — the remount
    resume compensation excluded the paused case, so pause + help open/close (or a
    tempo tap) silently advanced and animated plays behind the overlay. Compensation
    now applies whenever `idx > 0`.
27. **likely-bug — playback speed and Play Art reset every snap in live coach mode**
    (fresh `call-…-<total>` key per snap). Speed/art now carry across snaps of the
    same game; pause state still resets. Pause/speed buttons also re-sync their
    labels on remount (they used to show ⏸/1× regardless).
28. **smell — halftime replay rerender wiped the drive chart** — the halftime mount
    re-based `_watchedPlays` on every render; now guarded by the same key idiom as
    the call stage.
29. **smell — OT chrome** — score bug said "1st HALF" and clocks said "Q4" during
    overtime (`half: 3`); both now say OT.
30. **smell — D2/D3 slow-motion desync** — hold/reveal timing ignored the divisional
    `divMult` the animation runs at, so result text landed before the play finished
    at ½× in lower divisions. Timing now uses the same effective speed.
31. **smell — defensive call panel header unstyled** — `cs-head`/`cs-head-sit`/
    `cs-head-score` had no CSS; now styled like the offensive strip.

### Probes

32. **playnow_smoke drift + toothless checks** — it predated defensive live calling,
    so the first ask (a defense panel) stalled it into a bogus fail; it now answers
    `#dc-ride`/`#dc-send`. Its two unconditional `check(true, …)` passes (flagged in
    the 08-07 hunt) now assert the panel actually closed. Suite green end-to-end.

---

## REPORTED, NOT TOUCHED (owner's call)

- **Playbook formation gate is live-call-only** (`sim.js:3664`): on auto-called
  snaps `allowed` is null, so "off the sheet — no formation carries it" plays are
  still called at their slider weight. Enforcing it on auto snaps changes call
  distributions → stat-band review needed before shipping.
- **All-zero concept group falls back to uniform random** (`sim.js` ~102): benching
  every play in a depth bucket contradicts "0 is a cut" — engine-side, same reason.
- **covSlots are stamped from the BASE front** (`sim.js:3602`) while the viewer's
  bodies come from the per-down front — on Nickel/Dime snaps the slot ids can miss,
  and the man pair falls back to proximity while the zone-anticipation body silently
  vanishes. `trace.covPos` was stamped as the degradation backstop but is consumed by
  nobody. Right fix is emitting viewer covSlots against `defFrontId` (or wiring the
  covPos fallback inside `wireCoverage`) — touches trace emission, wants its own pass.
- **Non-live call-sheet path has no escape hatches**: six listeners reference ids
  (`cs-sheet-call`, `cs-skip-quarter`, `cs-mode-everycall`, `fourth-auto`,
  `cs-autorun`, `cs-autorun-stop`) that no template renders — the "let the sheet
  decide"/mode-switch UI they belonged to doesn't exist on that path. Feature
  decision, not a wiring fix.
- **"Headset off" survives halftime** — deliberate-looking, but a coach who left
  auto-run on in Q2 restarts H2 as a spectator without a fresh cue. UX call.
- **part1_controls_probe MATCH-bust check is threshold-flaky** (0.3% vs 0.4% gate on
  one run, 0.9% on rerun; engine untouched by this pass). Same family as the known
  leverage_probe flakiness — wants seed-pairing or a threshold review.
- `initWatchMode`'s dead `isHome` param; unstyled `.wa-ball` rules in CSS (markup
  uses `wab-*`); `wp-rep-*` classes other than `cut` are inert hooks — cosmetic
  residue, left.

## Verification

build 11/11 · boot 0 pageerrors · watch_live · sprite_gallery (incl. computed-
transform lean check) · watchphys 7A · play_trace · ui_playcall (rung 6) ·
coach_mode_halftime · coach_controls · playnow (fixed) · playnow_spectator ·
playnow_saved_multiplayer · part1_controls (pass on rerun; one pre-existing flaky
gate, see above) · equiv_walk 0 pageerrors · **NEW** viewer_fix_probe ·
**NEW** timeout_screen_smoke. Engine untouched → stat bands unaffected.
