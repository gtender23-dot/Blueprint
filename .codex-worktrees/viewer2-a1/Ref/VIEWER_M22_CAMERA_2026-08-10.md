# Viewer M22 — camera and replay (2026-08-10)

Authored in-house (Claude cloud session) against mainline `b849355765` (the
M21 ball build), per `Ref/M22_CAMERA_SCOPE_2026-08-10.md`. Same situation as
M20/M21: no kit/merge loop, compiled directly from this source tree.
Build hash: **`a0650ce12d`**.

## The headline: the camera leads, it doesn't chase

The broadcast camera was reactive — it centered whatever the ball was doing
right now, whipped when possession flipped, ran the two ST boards on a raw
exponential chase, and replays were just the same film at 0.68×. M22 makes
the camera read the play the way the script already knows it: **zero engine
touches** — every anchor it needs (catch point, end point, turnover moment,
celebrant) was already in the script's cues.

## Content, by scope work item

- **A. The camera plan (pure, probed)** — `buildCameraPlan(script, p)` in
  `watchphys.js`: DOM-free, deterministic, node-testable. Exports leading
  anchors, zoom-height targets, the turnover settle window, the celebration
  hold and the replay time-warp. The board's tick consumes the plan; the
  M20 slew integrator still owns smoothness, so framing can never whip.
- **B. Anticipatory tracking** — passes: from the QB's windup the anchor
  eases toward the KNOWN catch point (deepening through the flight); runs
  and YAC: the anchor leads the ball toward the play's known end point
  (capped lead). Pre-snap the anchor is pinned — and the probe caught the
  camera CREEPING through the cadence (latent since M20: it initialized on
  the generic LOS constant, 0.8u off the real anchor, and slowly panned).
  It now initializes on the anchor; the cadence is genuinely motionless.
- **C. Contextual zoom** — wide pre-snap; deep flights widen to hold launch
  + destination; tightens through catch and tackle; the low red zone
  (fieldPos ≥ 92) holds the tight frame; replay frames never looser than
  live. The two ST boards get the slew-limited pan (raw chase deleted) and
  a gentle return-phase tighten (56 → 47) — kick flights stay wide, the
  runback reads closer. ST timing/classes untouched.
- **D. Turnovers + celebration** — for 0.8s after an INT/fumble the anchor
  holds the turnover spot and pan velocity is halved: the direction flip is
  a controlled cut. TDs park the camera tight on the celebrant from the
  celebrate cue through the linger — the short hold before advancing, with
  no scheduler change (the hold lives inside `dur`).
- **E. Replay presentation** — replay playback time is WARPED: ~0.45× slow
  windows around the catch, the tackle impact, the staged break and the
  strip, compensated (≤1.35×) outside so the integral is EXACTLY `dur` —
  the watch loop's replay wall-time budget (`scriptDur/(speed·0.68)+1050ms`)
  holds to the frame. Live playback is the plain clock, untouched.
- **F. Overlays in the frame** — fx cards and result texts (flag detail, TD
  banner, INT/SACK/FUM calls) clamp inside the CURRENT camera view at
  spawn: no banner is ever bisected by the frame edge. The scorebug was
  already DOM-outside the field.

Files: `js/ui/watchphys.js` (buildCameraPlan — additive; scripts and tracks
byte-identical) · `js/ui/app.js` · two new probes + manifest registration.
`style.css` unchanged. **No engine files touched.**

## Probes installed (manifest full tier)

- `camera_plan_probe.mjs` (node, deterministic — **pins Math.random**, NOT
  seedFlaky): 552 plans/4 games — pre-snap pinned (0 moved), pass anchors
  lead to the catch point (232/232), run anchors lead to the end point
  (253/253), zoom bounded + wide pre-snap + replay ≤ live (0 bad), tightens
  at catch (232/232) and tackle (436/436), red zone holds tight (34/34),
  turnover settle windows (16/16), TD holds (24/24), warp covers the
  contact cues (543/543), rates sane, **budget-neutral to ±0.03s** on every
  play, deterministic rebuild (40/40).
- `camera_live_probe.mjs` (pw): pre-snap viewBox motionless (26 pairs, 0
  moved — after the init fix), no pan whips (272 pairs, worst 18.4u/80ms,
  bound 26), rendered ball framed on 100% of in-play samples (0/256 out),
  zoom inside the contextual band (46.7–56.0), ST framing lawful (0 bad, 0
  jumps), replay + special teams both sighted live. Phase absence under
  throttled rAF is reported, never failed.

## Gate

- Full core gate on the final tree: **GATE PASSED — 19 OK, 0 flaky-cleared,
  0 env-known, 0 FAIL, 8.6 min.**
- M21 regression: `ball_truth_probe` 11/11 · `ball_flight_live_probe` 5/5
  (8/8 catches aligned, worst 0.62u). One probe-robustness tweak while
  regressing: the M21 live aim check's sample MINIMUM dropped 10→4 (a
  run-heavy throttled window landed only 5 flight samples, all correct —
  the ratio is the law, scarcity must not red a correct board).
- M20/M19 regression: `contact_truth_probe` 11/11, `contact_sync_live`
  clean (84 hit samples, 0 far), watchphys RUNG 7A full PASS (the plan is
  additive — scripts and tracks unchanged), locomotion green.
- `frame_budget_probe` (idle container, post-gate): p50 16.7ms / 30
  longtasks vs pre-M22 reference 16.7ms / 31 — **no regression**; baseline
  file untouched. (A mid-gate run read p50 350ms from CPU contention —
  disregarded; gate the probe on an idle container only.)
- Boot: 0 pageerrors.

## Env notes

- Frame-budget runs are only meaningful on an idle container — running them
  concurrently with the gate produces contention numbers (documented above
  so nobody chases a phantom regression).
- The live probe saw a replay in-window this time; when the rAF throttle
  hides one, the sighting line reports it and the framing laws still gate.

## Handoff

Next milestone (**M23 — stadium and broadcast**, per the animation-goals
order: officials, sidelines, crowd life, field polish and graphics) must be
cut against build **`a0650ce12d`** or later. Notes for M23:

- Broadcast graphics (scorebug hierarchy, possession indicator, drive
  summaries, lower thirds, replay wipe) should respect the M22 rule: clamp
  into the live camera frame via the `cam` argument to `watchFxMarkup`, or
  live DOM-outside the SVG like the scorebug.
- The camera plan is the hook for presentation timing: `warpSegs` are the
  moments worth a replay wipe; `hold` is where a scoring banner belongs;
  `settle` is where a turnover graphic lands.
- ST boards now zoom (viewBox height 47–56) — any stadium/crowd layers on
  those boards must tolerate the moving viewBox, same as the scrimmage
  board's layers already do.
