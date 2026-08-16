# Season Mode — the dynasty-backed rebuild (2026-08-14)

**What it is.** Season Mode is a one-off single-season run that reuses the ENTIRE
dynasty — the same dashboard, schedule, standings, statistics, team pages, game
plan, and the exact coach-or-watch-your-game flow — minus recruiting and the
coach's office, with no preseason and no offseason. It ends at the playoff
champion.

**Why this shape.** The earlier version (`js/engine/seasonmode.js` +
`seasonmodeview.js`) was an *isolated* single-season loop with its own bare hub
UI. It looked nothing like the game. Rather than rebuild every screen, Season
Mode now IS a dynasty with a flag. Every in-season screen is a pure render
function over `state.world` / `state.playerSchoolId`, and Dynasty's own
`advanceDay` already sims each day, coaches your game, and runs
standings/rankings/playoff/awards without freezing — so we get all of it for
free.

## The seam: `state.seasonMode`

Set only by `startSeasonRun(world, school)` (state.js). Never set in normal
dynasty play or in any probe, so the default world is byte-for-byte unaffected —
every guard below is `!seasonMode` on the dynasty side.

- **`startSeasonRun`** (state.js) — reuses `finishNewGame` for the full setup (a
  real coach shell, schedule, AI gameplans), sets `seasonMode = true`, and
  `state.day = 4` so the first CONTINUE advances straight into Week 1 (no
  preseason camp). No coach profile / tree is founded.
- **`exitSeasonRun`** (state.js) — clears the flag + backing world and returns to
  the menu, so a later dynasty never inherits `seasonMode`.
- **`autosave`** (state.js) — no-ops in season mode (no dynasty-slot pollution).
  Season Mode does not persist across reloads in v1.

## The two engine guards (`js/engine/season.js`)

1. **Recruiting off** — `if (isRecruitingDay(day) && !state2.seasonMode)`. No
   board, no commits, no signing day, no recruiting inbox. (Recruiting only ever
   shaped *next* season's rosters, so the current run is unaffected either way —
   this just removes the noise.)
2. **Preseason off** — the days 1–4 `preseasonAdvanceHook` block is
   `&& !state2.seasonMode`. Combined with the day-4 start, camp is skipped.
3. **Stop at the champion** — inside the day-24 `JOBS` block, right after
   `finalizeSeasonRecords` + `computeSeasonAwards` + `attachSeasonRecap` and
   BEFORE `updateJobSecurity` / `runJobMarket` / `initOffseason`: if `seasonMode`,
   push `{type:"season-complete", division, champion}` and `return`. Records and
   season awards are in; no firing, no carousel, no offseason, no season 2.
   (Firing can only happen in this same day-24 block, so a season run can never be
   fired mid-year.)

`processEvents` (state.js) turns `season-complete` into
`state.ui.seasonComplete = {division, champion}`; app.js renders the champion
takeover (`renderSeasonCompleteOverlay`) from it.

## The UI filter (`js/ui/app.js`, dashboard.js)

- `navItemsFor()` / `tabbarItemsFor()` drop **Recruiting** and **Coach's Office**
  (and swap Recruits → Standings on the tab bar) when `seasonMode`.
- Team group drops the **Practice** tab; Statistics group drops **History**.
- Sidebar hides **Budget/Scholarships** and the **dynasty Save** button; the
  home button becomes **Exit Season** → `exitSeasonRun`.
- Dashboard always shows the game-week card (never preseason/jobs takeovers) and
  skips the opener-prep / redshirt-burn / empty-board advance gates.

## Entry + team picker (2026-08-14)

Setup is two steps in `seasonmodeview.js`:

1. **Pick a division + starting world** — the real division, or one of your saved
   custom leagues (`leagues` shelf).
2. **Customize & pick your team** — this REUSES the Division Editor
   (`creatordivision.js`) as the league customizer + team picker, gated by
   `state.ui.divContext === "season"`. In that mode the editor gains a per-team
   **Play as** control (`state.ui.divPick`), a "Playing as …" banner, and a
   footer of **Start Season → / Save League / ← Back** instead of Save/Cancel.
   You can tune the whole league (conferences, prestige, crests, rerolls — all
   the Workshop tools), optionally **Save League** (stays in place, doesn't kick
   you out like the Workshop does), then **Start Season** builds the world from
   the edited-in-memory blueprint (`blueprintFromEditor` → `assembleWorldSources`
   → `generateWorld`), finds your picked team by id, and hands to
   `startSeasonRun`. This is the path for taking a **custom team** for a spin.

Shared helpers exported from `creatordivision.js`: `renderDivisionEditor`,
`divisionsListeners`, `loadStaticDivision`, `leagueToEditor`. The Workshop's
Division Editor is unchanged (season context never set there).

## Verified

`_season_mode_check.mjs` (adapted from `_qa_dynasty.mjs`) drove a full headless
D1 run: starts day 4, coaches a full 12-game slate, reaches `season-complete`
with a resolved champion, never starts an offseason, never fires the coach,
never rolls to season 2, empty recruit board, zero signings. Live in Chrome:
nav filtered correctly, every screen renders, preseason skipped, the
coach-your-game prompt fires on advance.

## Dedicated save + resume (2026-08-14)

Season Mode has its OWN save, completely separate from the dynasty slots, in a
fixed IndexedDB slot key **`"season"`** (reusing `saveGame`/`loadGame`/
`deleteSlotData` + the backup ring). It never touches `auto`/`slot1-4`.

- **Write paths** (all in `state.js` / `app.js`, gated on `state.seasonMode &&
  !state.seasonOver`, always slot `"season"`, never `"auto"`):
  `autosave()` branch; the `installSaveGuards` pagehide/visibility flush and 30s
  timer (both made season-aware); plus an **immediate** `saveGame(state,
  "season")` at the end of `startSeasonRun` so the run is resumable from the
  very first screen (autosave otherwise waits for the first completed week, and a
  live game blocks saves via `gamePauseIsLive`). The season flags are set BEFORE
  `finishNewGame` so nothing during setup can land in `"auto"`.
- **`state.seasonOver`** — set true by the `season-complete` handler in
  `processEvents`, which also `deleteSlotData("season")`. This (a) stops all
  season writes, so a finished run leaves no save, and (b) `advanceDay2` gets a
  top guard: if `seasonMode && seasonOver` it re-shows the champion instead of
  advancing (which would otherwise roll day 24 → 25 → … → season 2). Reset by
  `startSeasonRun`/`exitSeasonRun`.
- **Resume door** — `mainmenu.js` reads `listSaves()` for a `"season"` record
  (`renderMainMenu` → `renderCoachSelect(autoSave, seasonSave)`) and shows a
  **↺ RESUME SEASON — <school> · W-L** button above SEASON MODE when present.
  Click → `loadFromSlot("season")`, whose `Object.assign(state, saved)` restores
  `seasonMode`, so its `navigate("dashboard")` lands straight back in the season
  chrome. The `"season"` slot is invisible to the dynasty load/save modals
  because those iterate the fixed `ALL_SLOTS2` (`auto`/`slot1-4`).
- **Exit vs finish** — `exitSeasonRun` (Exit Season) LEAVES an in-progress save
  intact (that's what Resume loads); a finished season already deleted its save,
  so Resume won't offer it.

Verified live: only `season`/`season.bak*` keys after start (no `auto` leak);
reload → Resume Season appears with team+record → resumes as the same team in
the season chrome; Exit Season keeps the save. Save probes pass.

## Known follow-ups

- Minor wording: the day-19 selection-week / budget-bonus inbox lines still use
  dynasty phrasing.
- A live game blocks saves (`gamePauseIsLive`), so closing mid-game resumes to
  the start of that week (replays it) — acceptable, matches dynasty.
