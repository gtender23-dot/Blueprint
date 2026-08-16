# Viewer Act 2 A2 — Throw, Catch, and Trench Vocabulary

Base: `de73661` (`codex/viewer2-a1`, post Viewer 2 + Creator resilience convergence).

## Shipped

- Catch presentation is selected in `watchphys.js` from the recorded arrival:
  secure, toe-tap, layout, high-point, one-hand, contested battle, breakup,
  or interception. The resolved target/picker owns the pose; proximity is only
  a fallback for legacy recordings without an owner stamp.
- Moving quarterbacks now distinguish set, play-action carry-through,
  sidearm, on-the-run, and off-platform releases. Escape resets and designed
  Boot rollouts retain their established tracks and release points.
- Pass-rush pairs expose semantic silhouettes: edge speed versus kick-slide,
  bull rush versus anchor, and counter versus redirect. Existing M11 tracks
  and engagement timing remain untouched.
- The browser renderer consumes the pure cues, clears every A2 class each
  frame, and preserves the M21 ball-ownership/attachment channel.

## Permanent gates

- `viewer_throwcatch_probe.mjs` covers selector law, determinism, stamped
  ownership, unchanged tracks, exact catch-frame attachment, Boot/escape
  releases, trench pairing, and source contracts.
- `viewer_throwcatch_live_probe.mjs` drives the built game and verifies zero
  page errors, zero pre-snap A2 residue, one live catch/release style at a time,
  secured ball attachment, and paired blocker/rusher silhouettes.
- Both probes are registered in CORE beside `viewer_duel_probe.mjs`.

## Focused verification

- Build sanity checks: PASS.
- `watchphys_probe`, `ball_truth_probe`, `contact_truth_probe`,
  `viewer_duel_probe`, `viewer_pace_probe`, `camera_plan_probe`,
  `officials_plan_probe`, `locomotion_probe`, `viewer_fix_probe`, and
  `tipdrill_probe`: PASS.
- Frame-budget gate, two runs: PASS. Full 22-man cast; p50 33.3 ms then
  16.7 ms, with no combined pacing/long-task regression.
- Live A2 sighting: catch gap 2.21 units at the rendered hand offset,
  zero state leakage, all three trench families sighted.
