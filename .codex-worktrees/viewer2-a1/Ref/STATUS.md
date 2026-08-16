# ⚑ STATUS — where we actually are (living doc)

**Read this FIRST in any new chat. Update it whenever you finish a chunk.**
Last updated: **2026-08-14**.

---

## One-line state
Everything below is **built, converged, and running** in `dist/` and in the
`js/` working tree. The remaining work is a full local gate run + a couple of
small polish items. Nothing is half-broken.

## What's DONE (shipped into the working tree)
- **The Workshop (Creator tools)** — live, pixel-themed: Playbook Builder, Play
  Composer, Team Editor, Division Editor, Film Room. Reachable from the main menu
  and the in-dynasty Game Plan screen. Saves to a local library (`cfb-creator`).
- **Crest system polish** — real procedural shield crests everywhere (no emoji),
  editable crest letters, reroll crest/school, star prestige selectors,
  conference⇄team prestige coupling in the Division Editor.
- **Season Mode v2** — a one-off single season that IS the full dynasty
  (dashboard, schedule, standings, stats, team pages, game plan, coach/watch your
  games) **minus recruiting + coach's office**, **no preseason, no offseason**,
  ending at the playoff champion. Backed by `state.seasonMode`. See
  `Ref/SEASON_MODE_V2.md`.
- **Season Mode team picker** — setup reuses the Division Editor as a league
  customizer + team picker (tune the whole league, "Play as" any team, optional
  Save, then play). Great for trying a custom team.
- **Season Mode dedicated save + Resume** — its own IndexedDB slot `"season"`,
  separate from dynasty saves; "Resume Season" on the main menu. Autosaves during
  play, deleted on completion.
- **Season Mode polish** — team **search** in the picker (find a team by name
  across all conferences, no expanding needed); season-appropriate **inbox**
  wording (a "Season Kickoff" welcome instead of the dynasty scholarships note;
  championship notices drop the "recruiting budget" framing).
- **Viewer Act A + B + C + D (Codex)** — Act A animation, Act B replay/broadcast
  suite (Film Room playback, telestrator, still/WebM export), Act C four replay
  cameras (Broadcast / All-22 / Coach / Reverse), Act D End Zone camera +
  special-teams replay. A/B/C merged at `7d352de`; **D converged 2026-08-14 at
  tip `19681a5`** (D branched cleanly from `act-d-base`, so zero real conflicts).

## What's OPEN
1. **Full local gate** — run `node tools/_gate.mjs` (and `full`/`night`) on YOUR
   machine. The sandbox can't run the Playwright viewer probes or the boot check,
   and `stat_realism_harness` is slow there. A green local run is the real
   sign-off before any deploy. **Known flaky trio (now all `seedFlaky`, auto-retry
   once):** `size_fit_probe` (light-OLB tail on its 0.5% boundary),
   `play_fidelity_probe` (unseeded-RNG single-check miss ~1/9; 8/8 green on a
   clean tree), `playnow_smoke` (full-game Playwright walk on fixed timeouts).
   A lone flake clears on retry; a REAL regression fails both tries and still
   gates — if anything double-fails, it's real.
2. **Act base branches / the cadence** — each viewer act branches from the
   LATEST converged tip, never an old act branch, never two acts in parallel.
   Current base for the NEXT act: **`act-e-base`** (= tip `19681a5`, everything
   through Act D + all polish): `git checkout -b codex/viewer2-act-e act-e-base`.
   (`act-d-base` @ `3681db5` is spent — D already shipped from it.)
   Cadence: Codex ships act from `act-X-base` → handoff → I converge + cut
   `act-(X+1)-base` → next act.
3. **Pending post-gate reverse-sync** — the converged-with-D tree (`19681a5`)
   is committed in the clone but NOT yet written to this folder's WORKING TREE
   or `dist/` (held so the running gate keeps its stable build). After the gate:
   reverse-sync `19681a5` here + rebuild `dist/` so the local playable build
   includes Act D. Until then, the folder's playable build is pre-D (my polish,
   no End Zone camera yet).
3. **Git hygiene (see repo layout below)** — the working tree is converged but
   the folder's git history is on a divergent line with everything uncommitted.
   A clean checkpoint commit here (coordinated, not unilateral) would end the
   cross-repo confusion.
4. **Viewer next slice (Codex's suggestion, = Act D territory)** — perspective
   end-zone camera preset; unify special teams under the replay clock. Codex
   branches Act D from `act-d-base` (see item 2).

## Repo layout — READ THIS before any git action
There are **two repos with the same branch names**, which is the #1 cause of
confusion:
- **This folder (`C:\dev\Blueprint`)** — the shared working tree. Both Codex and
  the owner edit files here; Codex commits its `codex/viewer2-*` branches here.
  Its `source` branch is on a *different, minimal* lineage — do NOT assume its
  git log reflects the real feature history.
- **The build/commit clone (sandbox `/tmp/bpg`)** — holds the clean feature
  history (`source` tip `a3d0b79` → merge `7d352de`). Building + probes run here.

**Workflow that works (don't deviate):**
1. Edit source in THIS folder's `js/` + `style.css` (never a built file).
2. Build in the clone: it pulls this folder's `js/tools/style.css` in, runs
   `node tools/build.mjs`, then copies `dist/index.html` back here.
3. **Never sync the clone→folder direction blindly** — that clobbered Codex's
   viewer files once (the "Act A clobber"). When converging Codex work, merge in
   the clone, then reverse-sync the merged tree back to this folder.
4. Commit in the clone. **Do NOT push** unless the owner says so.
5. `git` in THIS folder is fragile — don't `git commit` here casually. If a task
   says "check on Codex's merge," that means READ the handoff docs and verify the
   code, NOT commit a doc.

## Coordination with Codex
Codex ships viewer work on `codex/viewer2-*` branches + a `Ref/CODEX_*_HANDOFF.md`
and `Ref/VIEWER_ACT_*` record per act. Convergence = merge that branch into the
feature line (base has been `e45c89b`), keep both sides (overlaps are only
`app.js` + `style.css`), verify, reverse-sync, and note it in `Ref/CONVERGED_*`.

## Key pointers
- `Ref/SEASON_MODE_V2.md` — Season Mode architecture (the seam, engine guards,
  save/resume).
- `Ref/CONVERGED_2026-08-14.md` — the Act B/C merge record.
- `Ref/CODEX_ACT_B_HANDOFF.md`, `Ref/CODEX_ACT_C_HANDOFF.md` — Codex's records.
- `CLAUDE.md` — build, deploy, verification, and the standing subsystem rules.
