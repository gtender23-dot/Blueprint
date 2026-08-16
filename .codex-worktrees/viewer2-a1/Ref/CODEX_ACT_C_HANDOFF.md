# Viewer Act C handoff

Branch: `codex/viewer2-act-c`
Base: Viewer Act B tip `d191d0f`

## What shipped

- A pure world-to-screen projection module in `js/ui/watchcamera.js`. Recorded
  actor tracks, ball tracks, event times, catch/tackle points, and final spots
  remain the authority; cameras only change presentation.
- Four deterministic replay cameras: **Broadcast**, **All-22**, **Coach**, and
  **Reverse**. Coach restores the vertical coaching-film orientation instead
  of rotating the completed SVG; Reverse mirrors the sideline projection.
- Coach owns a dedicated field layer with correct LOS, first-down line, hashes,
  yard lines, end-zone identity, and possession-upfield orientation.
- All 22 player nodes survive every projection. Players are depth-sorted each
  frame, and Coach uses the existing front/back bodies through north/south
  facing rather than adding fake animation frames.
- Pass height is exposed as presentation-only `data-world-z` and projected in
  Coach view. Ball-to-hand offsets scale with the camera, while the recorded
  x/y flight and outcome remain untouched.
- Telestrator strokes are camera-aware. Old strokes without a camera remain
  backward compatible; new strokes render/export only in the angle where they
  were drawn.
- Replay clips remain `blueprint-viewer-replay` version 2. Older Broadcast and
  All-22 clips load unchanged; new camera ids safely normalize on load.

## Files

- `js/ui/watchcamera.js` — pure camera order, labels, projection, scale, depth.
- `js/ui/app.js` — camera controls, field layers, reprojection, depth order,
  ball height, hand anchors, and camera-aware ink.
- `style.css` — Coach field and height/depth presentation.
- `tools/viewer_act_c_probe.mjs` — pure projection checks plus a live four-angle
  replay walk and play/outcome immutability check.
- `tools/_gate_manifest.mjs` — Act C probe registered in CORE.

## Verification

- `node tools/build.mjs`
- `node tools/viewer_act_c_probe.mjs dist/index.html` — 20/20
- `node tools/viewer_act_b_probe.mjs <absolute dist/index.html>` — 22/22,
  including a real non-empty WebM and phone layout
- Existing Act A finish, camera-plan, ball-truth, and replay-store probes pass.
- `node tools/_gate.mjs` — **68/68, 0 retries, 0 skips, 0 failures**

All changes are presentation/storage-schema-compatible only. The CORE run also
passed `stat_realism_harness`; no simulation or play outcome path changed.

## Best next presentation slice

Add a perspective end-zone preset on the same projection contract, then unify
special-teams boards under the replay clock so punts, kickoffs, and place kicks
can use every camera and the same world-height football law.
