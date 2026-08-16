# Viewer M24 — variation and optimization (2026-08-10)

Authored in-house (Claude cloud session) against mainline `3dc35a2328` (the
M23 stadium build), per `Ref/M24_VARIATION_SCOPE_2026-08-10.md`. Compiled
directly from this source tree. Build hash: **`77479ac27d`**.

**This closes the animation-goals milestone order (M19–M24).** The
program-wide map of goals → milestones → probes is
`Ref/ANIMATION_GOALS_COVERAGE.md`.

## The headline: no two moments look the same — and a fresh play starts clean

The audit found much of the "variety" block already shipped by earlier
passes (per-player gait, equipment variation, catch/tackle alternates,
build silhouettes). M24 added what was truly missing and made the goals
doc's regression list — including the never-probed state-leakage rule — law.
**Zero engine touches.**

## Content, by scope work item

- **A. Celebration variants** — `celebrateCue.style`, seeded and
  situation-lawful: short-yardage TDs spike or flex (never a leap from the
  1), bombs leap or flex (never a spike on a 60-yarder), everything else
  mixes spike/bounce/flex. The two nearest teammates at the end frame mob
  the celebrant (`mobIds`, render-only class — tracks untouched).
- **B. Exhaustion** — `windedCue` on long non-TD plays (25+ yards or
  5.2s+): the carrier and the tackler bend over and breathe through the
  linger, timed at end+1.6s so the M20 grounded/get-up window finishes
  first (probe-pinned).
- **C. Heads to the ball** — defenders within range of the catch point take
  a slight eyes-up back-lean while the pass is in the air, composed into
  the M19 `--wsp-lean` variable (no animation conflicts) and cleared by the
  per-frame class sweep.
- **D. The bench joins its crowd** — bench men carry home/away classes and
  bounce on the M23 roar classes.
- **E. Optimization** — `watch-panning` pauses crowd micro-animations while
  the camera pans hard (cheaper frames exactly when the renderer is
  busiest); `watch-lite` is a sticky auto-quality flag that trips when the
  frame-time EMA stays slow — crowd-life hides, ribbon/fan animations stop,
  structure stays in the DOM so every probe and reaction keeps working. In
  the cloud container (software rendering) lite mode trips as designed —
  live-sighted by the probe.

Files: `js/ui/watchphys.js` (cues — additive) · `js/ui/app.js` ·
`style.css` · two new probes + manifest · `Ref/ANIMATION_GOALS_COVERAGE.md`.
**No engine files touched.**

## Probes installed (manifest full tier)

- `variety_probe.mjs` (node, deterministic — **pins Math.random**, NOT
  seedFlaky): 557 snaps/4 games — 21 TDs all situation-lawful, all FOUR
  styles observed (variety is real, not a constant), mob ids clean, winded
  on 118/118 long plays and 0/326 routine ones, winded timing clears the
  grounded window, deterministic rebuild.
- `variation_live_probe.mjs` (pw): **the state-leakage law** — 43 pre-snap
  samples, ZERO residue classes on any actor and a clean ball on every
  fresh play; both field orientations rendered; end zones stable with
  owners + lettering on 354/354 field samples. Ball-watch, panning and
  lite all sighted live; celebration/winded variants are deterministic-
  probed and sighting-reported.

## Gate

- Full core gate on the final tree: **GATE PASSED — 19 OK, 0
  flaky-cleared, 0 FAIL, 7.8 min.**
- Regression: watchphys RUNG 7A full PASS · ball_truth 11/11 · camera_plan
  14/14 · officials_plan 8/8 · contact_truth 11/11 · locomotion green ·
  camera_live 6/6 · ball_flight_live 5/5 · broadcast_live 7/7 ·
  contact_sync_live 7/7.
- One probe hardening while regressing: `broadcast_live_probe` now gates
  its structural checks on the REAL 22-actor scrimmage board — the
  two-point-try/kneel mini-boards toggle `watch-in-play` but run their own
  tiny pipeline with no officials/sticks/posts by design (pre-existing
  blind spot, surfaced when a sampling window finally caught a 2pt try).
- `frame_budget_probe` (idle container, two runs): p50 16.7ms both — equal
  to the pre-M21/M22/M23 reference; longtasks 35/38 within the documented
  variance band (p50 is the stable axis; the probe gates on both).
  Baseline untouched.
- Boot: 0 pageerrors.

## Env notes

- `watch-lite` WILL trip in the cloud container (it is genuinely slow) —
  that is the feature working. Structure-based probe checks are immune by
  design; anything visual added later must not assume the crowd-life fans
  are visible in cloud screenshots.
- Longtask counts vary ±10 run-to-run on this box even idle; p50 of the
  best window is the number to compare (standing lesson, reconfirmed).

## Handoff — the animation-goals program is complete

M19 locomotion → M20 contact → M21 ball → M22 camera/replay → M23 stadium
→ M24 variation/optimization, each cut against the previous build, every
milestone shipping its probes into the manifest full tier. Later work in
the viewer should be cut against **`77479ac27d`** or later.

Deliberately OPEN (each flagged in its milestone's non-goals, none started):
turf spray/particles and weather/worn fields ("eventually" per the goals
doc), band/mascot set pieces, player-ID lower thirds + drive summaries
(needs name plumbing into the board), play-clock urgency (no play clock in
the viewer), tip-drill INT chains and mid-run arm switches (engine
extensions with full stat A/B if ever wanted). The coverage matrix is the
front door for whoever picks any of these up.
