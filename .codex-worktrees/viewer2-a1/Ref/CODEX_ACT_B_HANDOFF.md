# Viewer Act B handoff

Branch: `codex/viewer2-act-b`
Base: converged Act A + Creator/Season tip `e45c89b`

## What shipped

### B1 — broadcast package

- `buildBroadcastCommentary()` translates only recorded play/trace stamps into football language. It never recomputes a result and never prints trace fields, thresholds, or coefficients.
- The live/replay board carries a safe-area film-analysis panel alongside the existing player lower thirds, per-game player lines, drive summaries, score bug, and field-notes panel.
- Halftime/postgame highlights are playable. Each moment opens directly in the replay lab; **Play Reel** stitches the three selected moments into one broadcast sequence.

### B2 — interactive replay

- Film Room playback is registered at `window.__playReplayClip(data)`.
- Replays support pause/play, timeline scrubbing, 1x/half/quarter speed, broadcast/All-22 cameras, click/keyboard player cards, and a paused telestrator with undo.
- Broadcast replay framing reads the rendered ball transform after the frame is drawn. It does not peek ahead into `script.ball.track` while scrubbing.
- **Still** downloads an SVG carrying the current board plus telestrator strokes.
- **Film Room** saves the compact recorded-play payload, current camera, and annotation paths through the existing resilient replay-store API.

### B3 — clip export

- **Video** deterministically reruns the replay, rasterizes the SVG board to a capture canvas, records a short WebM with `MediaRecorder`, and downloads it.
- The permanent Chromium probe verifies a real non-empty WebM download (roughly 0.35–0.5 MB in sampled runs), not merely feature detection.

## Clip contract

`blueprint-viewer-replay`, version 2:

- one recorded play and its drive context;
- compact home/away identity, score, player-name table, and original board palette/weather;
- camera mode and normalized telestrator paths;
- no stored animation frames and no outcome-bearing derived values.

Typical clips are 13–15 KB. The player sees them in Workshop → Film Room. Existing Creator storage remains untouched; clips use `js/engine/replays.js`.

## Files

- `js/ui/watchphys.js` — pure trace-to-commentary builder.
- `js/ui/app.js` — clip schema, replay route/hook, controls, camera law, telestrator, still/video export, playable highlight reel.
- `js/engine/highlights.js` — additive drive/play indices so a text highlight can open the exact recorded snap.
- `style.css` — isolated Act B replay/broadcast styles.
- `tools/viewer_act_b_probe.mjs` — live save → Film Room → replay → scrub/camera/card/ink/still/WebM gate.
- `tools/_gate_manifest.mjs` — Act B probe in CORE.

## Verification

- `node tools/build.mjs`
- `node tools/viewer_act_b_probe.mjs dist/index.html`
- Existing Act A truth probes and `replay_store_probe` remain green.
- `node tools/_gate.mjs` is the ship gate.

All changes are presentation/storage only. No simulation, play-selection, stat, or outcome path changed.
