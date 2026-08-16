# Codex — next session (2026-08-13, post-convergence)

We're fully converged: viewer-2 + Creator engine + resilience are one line. Your
branch `codex/viewer2-a1` is at **`de73661`** and the CORE gate is green (52 OK).
Claude and Codex now run in parallel with zero file overlap.

## Your lane: keep advancing the Viewer

Next acts of the play-viewer. This is the right lane *and* the safe one — the
viewer lives entirely in its own files, so it never collides with Claude's
Creator/Season engine work. And it directly strengthens Season Mode, whose whole
pitch is "coach your games in the live viewer" (see `Ref/SEASON_MODE.md`).

**Base off the current tip `de73661`.** Don't branch off anything older.

## Files you OWN (Claude will not touch)

- `js/ui/watchphys.js` — the play viewer.
- `js/engine/sepgeo.js`, `run2geo.js`, `rushgeo.js`, `yacgeo.js` — viewer geometry.
- Your viewer probes (`viewer_duel_probe.mjs`, and any new ones) + viewer-specific
  CSS in `style.css`.

## Files Claude OWNS (please don't touch)

- `js/engine/creator.js`, `creatorrepair.js`, `playbook.js`, `customplay.js`,
  `playcompose.js`, and the Creator/Season parts of `world.js` (`compileLeague`,
  the division assembler) + a new `seasonmode.js`.
- Creator/Season probes (`creator_*`, `compile_league_probe`,
  `integration_creator_probe`, `custom_division_season`, etc.).

## Files to COORDINATE (both touch — keep edits additive)

- `tools/_gate_manifest.mjs` — both register probes. Add your lines in the viewer
  region; they merge cleanly (they have so far).
- `js/ui/app.js`, `style.css` — the one real collision zone, and it only matters
  in the **browser-UI phase** (Creator editors, Season Mode screens, Game Plan
  reorg). We are NOT there yet. When we are: Claude takes the Creator/Season
  screens, you stay on the viewer, and we agree who owns which chunk up front.
  Until then, neither of us blocks the other.

## Discipline (unchanged)

- `js/` + `style.css` only; never hand-edit built files (`dist/`, the bundle are
  outputs of `node tools/build.mjs`).
- Viewer work should be VISUAL-ONLY; if anything changes play *outcomes*, re-run
  `stat_realism_harness`.
- `node tools/_gate.mjs` (CORE) before you merge.
- We're converged now, so exchange work as **fast-forward** bundles on top of the
  shared tip — no more cherry-picking.

## Reference

Design is fully specced: `CREATOR_ENTRANCES.md`, `SEASON_MODE.md`,
`LEAGUE_BLUEPRINT.md`, `PLAY_COMPOSER.md`.
