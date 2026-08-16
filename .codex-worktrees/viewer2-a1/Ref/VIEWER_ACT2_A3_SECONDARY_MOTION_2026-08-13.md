# Viewer Act 2 A3 — secondary motion and weight (2026-08-13)

## Outcome

A3 gives the existing SVG puppets more weight without changing where any player
or ball travels. The watch loop now translates the locomotion controller's cached
speed, acceleration, lateral motion and cut state into four small presentation
cues: responsive drop shadows, top-speed shoulder compression, a gather-step on
plants/hard braking, and a carrier head-check toward the nearest pursuer.

## Truth boundary

- `spriteMotionTick` remains the sole owner of speed, acceleration, gait, facing
  and lean. A3 reads its `_wsm` cache; it does not resample tracks.
- `selectSecondaryMotion` is DOM-free and deterministic. It returns class/variable
  choices only and cannot move an actor, ball, contact point or clock.
- Head-checks require the active stamped `carryCue`, football speed and a nearby
  defender with meaningful lateral separation. They never transfer possession.
- Shadow scale, opacity and skew are clamped so an extreme motion sample cannot
  distort the field or expand SVG work without a bound.
- Every A3 class is removed in the watch loop's existing per-frame sweep, including
  pre-snap/reset frames.

## Files

- `js/ui/watchphys.js` — pure secondary-motion selector.
- `js/ui/app.js` — consumes cached locomotion state and nearest-pursuer geometry.
- `style.css` — bounded shadow, gather, sprint and head accents.
- `tools/viewer_secondary_motion_probe.mjs` — deterministic/source contract.
- `tools/viewer_secondary_motion_live_probe.mjs` — 22-man live DOM/state gate.
- `tools/_gate_manifest.mjs` — both A3 probes run in CORE.

## Verification contract

The focused suite covers selector boundaries and determinism, unchanged track
ownership, pre-snap cleanup, full-cast live sightings, carrier-only head-checks,
and bounded shadow variables. Because A3 adds work for every actor every frame,
the standing frame-budget probe is run twice before CORE. The standard Viewer Act
2 regressions and the complete CORE gate remain required before the commit is
handed off.

## Verification result

- A3 deterministic probe: PASS.
- A3 live probe: PASS with a full 22-man cast, zero pre-snap residue, gather and
  sprint sightings, bounded shadow values, and carrier-only head-checks.
- Standing watchphys, ball, camera, officials, contact and locomotion regressions:
  PASS. The isolated worktree initially lacked the gallery probe's hard-coded
  esbuild binary; the unchanged probe passed after temporarily linking the
  repository's pinned installed dependencies.
- Frame budget, two independent runs: PASS. Local-Windows best-window p50 was
  16.7 ms and 83.3 ms respectively; both runs had 22 actors and zero page errors.
  The stored baseline is from the cloud container, so the cross-environment
  comparison is informational as the probe documents.
- `node tools/_gate.mjs`: **57 passed, 0 failed, 0 retries, 0 skips** in 15.8
  minutes. Stat realism and the current matched A/B both passed.
