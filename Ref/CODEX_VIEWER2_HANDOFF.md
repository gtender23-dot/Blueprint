# Handoff to Codex — Viewer 2 update (2026-08-13)

You (Codex) are taking the **play-viewer v2** update. Claude is building the
Creator editor tools in parallel. This note keeps the two from colliding.

## Base

Branch from the current `source` tip: **`a812992`** ("Fix recruit_calendar_probe
night-gate hang"). Work on your OWN branch and merge back before Claude starts
the Creator UIs. Do not commit straight onto shared `source` while both agents
are live.

## Files you OWN (Claude will not touch these)

- `js/ui/watchphys.js` — the play viewer (QB/receiver movement, ball flight,
  screen geometry). This is the heart of viewer 2.
- `js/engine/sepgeo.js`, `js/engine/run2geo.js`, `js/engine/rushgeo.js`,
  `js/engine/yacgeo.js` — the separation / run / rush / yards-after-catch
  geometry helpers the viewer draws from.
- Viewer-specific CSS blocks in `style.css` (the field, players, ball, trails).

## Files to COORDINATE (both surfaces add here) — avoid concurrent edits

- `js/ui/app.js` — screen routing. The Creator UIs will add routes/nav; the
  viewer generally shouldn't need to. If you must touch it, tell Claude.
- `style.css` — shared stylesheet. Keep viewer styles in their own section so a
  merge is a clean append, not an overlap.

Claude is NOT touching any of the above until the Creator-UI browser session, so
if you go first there's no conflict — just merge before that session.

## ⚠️ Recent, UN-VALIDATED viewer changes already in `watchphys.js`

Claude added two viewer effects this session that have **not been eyeballed in a
browser yet** (sandbox has no renderer). Build on them; don't assume the file is
untouched. Feel free to fix/tune them while you're in here:

1. **Slip Screen** — a 4th screen kind, `"slip"`, alongside bubble/tunnel/rb:
   - `screenKind` derivation adds `/Slip/i.test(_cn) ? "slip"` on both the trace
     and name paths — **line ~623**.
   - `catchPt` for `screenKind === "slip"` → a backside catch point behind the
     LOS — **line ~632**.
   - `_screenDelay` for slip = `0.5` — **line ~649**.
2. **Boot** (play-action bootleg / designed QB rollout):
   - `const _isBoot = !screen && /Boot/i.test(_cn);` — **line ~676**.
   - `const _flushX = _isBoot ? (side > 50 ? 1 : -1) * clamp6(5 + rnd()*2, 5, 7)
     : …` — the QB rolls toward the flood side, reusing the item-9 lateral-launch
     machinery (`_flushX` also feeds the QB set-point at lines ~682, 722–723).

Both concepts are DATA-defined in `js/concepts.js` (`"Slip Screen"`, `"Boot"`)
and are already sim-validated (band-clean). The engine/sim side is done — only
the on-screen animation needs your eye.

## Rules of the road (from CLAUDE.md — unchanged)

- Edit `js/` + `style.css` only. Never hand-edit built files; `dist/` and the
  bundle are outputs of `node tools/build.mjs`.
- **Viewer 2 should be VISUAL-ONLY.** If you change anything that affects play
  *outcomes* (not just how they're drawn — e.g. sim math in the geo helpers that
  feeds results), you MUST re-run `node tools/stat_realism_harness.mjs` and keep
  the bands in place. A pure draw-layer change moves no bands.
- Gate before you call it done: `node tools/_gate.mjs` (CORE). The viewer probes
  live there (watchphys/playcall/UI smokes). Boot/screen viewer probes are
  Playwright — run them on a real machine (the sandbox can't render).
- There's now a **stall guard** in `recruit_calendar_probe` — if a headless
  advance loop ever hangs, it throws loudly instead of timing out. If you touch
  the season/advance path (you shouldn't for a viewer update), that's your safety
  net.

## Merge / re-sync

When you finish: rebase your viewer branch on the latest `source` tip, run the
CORE gate, and merge. Claude will pull the merged viewer in before opening the
Creator UI files, so the two never edit `app.js`/`style.css` at the same time.
