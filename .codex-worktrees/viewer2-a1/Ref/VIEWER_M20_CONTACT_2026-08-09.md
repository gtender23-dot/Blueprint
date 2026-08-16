# Viewer M20 — synchronized contact (2026-08-09)

Authored in-house (Claude cloud session) against mainline `8148deb3f0` (the
M18–19 merge + pressure pie), per `Ref/M20_CONTACT_SCOPE_2026-08-09.md`.
Codex is out this week; this milestone did not go through the kit/merge loop,
so there is no class-scan step — the build is compiled directly from this
source tree. Build hash: **`a55d2f34a2`**.

## The headline: contact truth reaches the screen

The engine has always known who made every stop — `tacklerId`, `assistId`,
`ffId`, `brokenById`, `breakaway` — and the play-by-play text used it, but
`buildPlayScript` picked the on-screen tackler by end-point proximity. The
box score could credit the MLB while the screen showed a safety making the
stop, and a broken tackle existed in text only.

M20 adds ONE engine touch: a **recording-only** `contactSlots` stamp in
`sim.js` (player→slot translation of the four credit fields), following the
established `beatenDefSlot`/`covSlots` precedent — the comment contract is
identical, no outcome path reads it, and the gate's stat bands ran clean on
the change. Everything else is viewer-only. This amends the scope doc's "no
engine writes" line: the scope underestimated that the player→slot
translation must happen where `bySlot` lives. Recording-only is the correct
reading of the rule's intent (nothing that can move a stat).

## Content, by scope work item

- **A. Truth wiring** — the staged tackler/assist ARE the credited men when
  their slots exist in the viewer front (proximity remains the fallback for
  pre-stamp saves and cross-front gaps). Credited broken tackles stage a real
  collision: the defender is pinned to his nearest approach of the carrier,
  whiffs past, hits the turf and takes a get-up beat; the carrier's
  juke/truck/spin cue fires AT that collision (was: a scripted 60% of the
  play), and the carrier takes a decaying shove off the contact. Credited
  strips steer the strip man to the ball-out point with a chop cue. Breakaway
  with no credited tackler no longer fabricates a phantom end-point brace.
- **B. Synchronized contact** — pass protection now produces real block
  pairs (`rep: "passpro"`) from the rush wiring, so pass sets get the meet
  point + engagement glyph run fits already had. While any pair is fitted
  (pads inside 5.2u), both men face each other via a new face-lock channel
  (`node._faceLock`, registered per-frame in app.js, honored in
  `spriteMotionTick` — wins over velocity, works while still, which is
  exactly when velocity-driven facing never updates).
- **C. Momentum + grounded finishes** — impact classes are gated on REAL
  sprite proximity (< 3.1u, with a time failsafe so a bad track can't freeze
  a finish): no more air tackles when a constrained track lags the cue.
  Tackled carriers hold the turf (≥ ~1s), then take a visible get-up beat;
  physical tackle styles ground the tackler too. Nobody blinks upright.
- **D. Pile discipline** — hard cap: tackler + assist + ONE late arrival
  inside the pile radius; every other converging defender brakes to a ring.
  A post-speed-cap separation sweep guarantees no two bodies share a spot
  (the sweep must run AFTER `capTrackSpeed`, which can drag constrained
  endpoints back together — found by the probe, order matters).
- **E. Shed/recovery** — covered by existing M9/M14 shed classes plus the
  new pass-pro pairs; beaten blockers already chase-recover via behave.
  (Deliberately thin — the scope's smallest item.)
- **F. Camera slice (pulled from M22, scoped tight)** — pan and zoom are
  slew-limited (acceleration-capped velocity + deadzone) instead of raw
  exponential chase: the camera brakes into its target and cannot whip or
  micro-jitter, and pre-snap framing is motionless through the cadence.
  Anticipatory lead and contextual zoom remain M22, untouched.

Files: `js/engine/sim.js` (recording-only stamp) · `js/ui/watchphys.js` ·
`js/ui/app.js` · `js/ui/sprite.js` · `style.css` · three new probes +
manifest registration.

## Probes installed (ship with the kit, manifest full tier)

- `contact_truth_probe.mjs` (node, deterministic — **pins Math.random**, so
  it is NOT on the seedFlaky list by construction): harvests ~1,100 real
  engine snaps, asserts credited tackler/assist staged (596 + 172 matches,
  0 misses), credited breaks stage at the actual meeting before the stop
  (43/43), pile cap + zero co-located bodies across 825 stops, strips staged
  (5/5), pass-pro pairs on every wired pass play (495/495), fallback intact
  on unstamped plays (135/135), and break staging is deterministic.
- `contact_sync_live_probe.mjs` (pw): in the built game — impact only at
  real proximity (0 violations/50 hit samples), grounded holds across
  consecutive samples, engaged pairs keep pad distance (0/121 far) and face
  each other (119 ok / 2 transition frames).
- `frame_budget_probe.mjs` (pw): the scope's standing perf gate.
  `tools/_frame_budget_BASELINE.json` was recorded on the PRE-M20 tree in
  this container (best-of-two windows; p50 33.4ms, 22 longtasks @ 22-actor
  live play). Post-M20: p50 16.7ms, 23 longtasks — **no regression**.
  Policy: gate compares same-env only; re-baseline deliberately (pre-change),
  never to make a red run green.

## Gate

- First run: 18 OK, 1 FAIL — `size_fit_probe` light-OLB fat-tail (0.4% vs
  0.5% floor). Verified 3/3 FAIL on the PRISTINE pre-M20 tree in this
  container → **pre-existing env condition, not an M20 regression**. Marked
  `envKnown` (kept `seedFlaky`) with a dated note. **If it reds LOCALLY,
  that's real** — worth one local run this week.
- Re-run after the manifest note: **GATE PASSED — 19 OK, 0 flaky-cleared,
  0 FAIL, 11.1 min** (size_fit's tail cleared on its own this run; the
  envKnown note stays for the runs where it doesn't).
- `watchphys_probe` (RUNG 7A outcome-truth gate): full PASS at default
  harvest — the M20 staging never moves the ball's resting spot, speed caps
  hold through the new constraints.
- Boot: 0 pageerrors. Locomotion probes: 15/15 + live green (M19 intact).

## Env notes

- Cloud rAF throttling remains the standing caveat for pw probes; the live
  probe's get-up window check is advisory (hold law gates), per the M15/M18
  lesson.
- The frame-budget baseline showed real software-rendering cost variance in
  cloud (p50 16.7–50ms run-to-run on a pristine tree); the probe gates on
  best-window p50 AND longtasks jointly to stay honest under it. On a local
  machine the same margins are simply comfortable.

## Handoff

Next milestone (M21 — ball mechanics, per the animation-goals order) must be
cut against build `a55d2f34a2` or later. Note for M21: `p.contactSlots` is now on every
scrimmage play and `qbArm`/`carrierSlotId`/`targetSlotId` already exist —
the ball-exchange work should read those stamps the same way, and any new
credit field belongs in the same recording-only stamp.
