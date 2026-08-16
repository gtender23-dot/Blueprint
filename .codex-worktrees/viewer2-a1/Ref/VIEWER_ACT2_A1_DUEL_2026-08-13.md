# Viewer Act 2 A1 — Ball-Carrier Duel

Base: `4a17f58` (`source` from `blueprint-source-full.bundle`).

## Shipped

- Broken-tackle presentation now selects juke, spin, stiff-arm, hurdle, or
  truck from the recorded outcome plus carrier speed/agility and the defender's
  approach geometry. The selector is seeded and never changes a track.
- Finishing tackles read as wrap, big hit, drag-down, shoestring, or goal-line
  contact. A credited assist and at most one truthful late arriver can join the
  pile; every other defender stays on the established separation ring.
- Fast boundary finishes can use pylon or first-down-marker dives without
  moving the recorded endpoint.
- Slip Screen has its own jab-and-slip route shape.
- Boot rolls toward the target/flood side, reaches the launch point before the
  release, and carries rollout-specific body poses through the throw.
- On completed passes, possession is the final timing authority for a move cue;
  a legacy early break stamp can no longer animate a move before the catch.

## Permanent gate

`tools/viewer_duel_probe.mjs` checks lawful selection, determinism, unchanged
actor and ball tracks, gang-tackle cast limits, landmark-dive gates, Slip/Boot
geometry, and the render-layer contracts. It is registered in CORE.

## Verification

- `node tools/build.mjs` — PASS
- `viewer_duel_probe`, `watchphys_probe`, `contact_truth_probe`,
  `ball_truth_probe`, `camera_plan_probe`, `officials_plan_probe`,
  `locomotion_probe`, `viewer_fix_probe`, `viewer_pace_probe`, and
  `tipdrill_probe` — PASS
- `node tools/_gate.mjs` — PASS: 50 clean, one flaky-cleared, zero failures
  (14.6 minutes). The gate's stat-realism harness and live UI trio passed.
