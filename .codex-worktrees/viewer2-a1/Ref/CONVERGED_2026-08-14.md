# Convergence record — 2026-08-14

Merged **Codex Viewer Act B + Act C** with the **Creator + Season Mode** line.

## Converged tip
`7d352de` — a merge commit with two parents:
- `d3c6259` — Creator/Season line (Workshop editors, Season Mode v2 = real
  dynasty minus recruiting/coach's office, team picker, dedicated save + Resume).
- `e721238` — `codex/viewer2-act-c` (linear: `e45c89b` → `d191d0f` Act B →
  `e721238` Act C). Merge base was the shared `e45c89b`.

## The merge
Only two files overlapped; everything else was Codex-only or Creator-only.
- **`js/ui/app.js`** — auto-merged with **zero conflicts** (Codex's
  replay/broadcast/camera regions and the Season nav/chrome regions are
  disjoint).
- **`style.css`** — one conflict: both append a block at the tail. Resolved by
  keeping **both** (Creator/Season styles + the Act B/C viewer styles).
- Codex-only, no conflict: `js/ui/watchcamera.js` (new), `js/engine/highlights.js`,
  `js/ui/watchphys.js`, `tools/viewer_act_b_probe.mjs`,
  `tools/viewer_act_c_probe.mjs`, `tools/_gate_manifest.mjs` (+4 probe rows),
  `Ref/CODEX_ACT_B_HANDOFF.md`, `Ref/CODEX_ACT_C_HANDOFF.md`.

## Verified on the converged tree
- `node tools/build.mjs` + bundle syntax OK.
- Viewer modules (`watchcamera`, `highlights`, `watchphys`) import clean.
- `save_migration_check` + `save_backup_probe` — ALL PASS.
- Headless full Season Mode run — champion crowned, no offseason, no season-2
  roll, full slate (the one harness "seasonOver" miss is a harness artifact: it
  breaks on the event before `processEvents` sets the flag).
- **Live in Chrome (converged build):** boots clean (0 pageerrors); Season Mode
  Resume visible + season flow works; **Play Now → Watch** renders the live
  board with the **4 Act C cameras**; no JS errors.

## Owner-local (can't run in the cloud sandbox)
The viewer probes (`viewer_act_b_probe`, `viewer_act_c_probe`, the `_live`
probes) and the boot check are **Playwright** — run `node tools/_gate.mjs`
locally for the full gate. `stat_realism_harness` is unaffected (no sim/worldgen
/outcome path changed by either line; both are presentation/UI/storage only).

## For Codex
The converged tip `7d352de` is a descendant of `e721238` (`act-c`), so it
fast-forwards cleanly. The mount working tree + `dist/` are already the converged
build.
