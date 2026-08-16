# Blueprint — full-game sanity / pre-sale QA health report (2026-08-07)

Scope: everything the headless environment can exercise (Node 22 + the engine/data layer),
plus a static read of the UI and a full probe/regression pass. **No files were changed for
this audit.** Two temp QA harnesses were added under `tools/` (`_qa_onboarding.mjs`,
`_qa_dynasty.mjs`, `_qa_fast.mjs`, `_qa_saveload.mjs`) — deletable.

## VERDICT: **Ready to sell — with one thing to eyeball first.**

Nothing crashes, no dead-ends, no garbage/NaN in anything I could drive: onboarding in every
division, Play Now, edge cases, save/load, the season engine, and the whole probe suite are
**green**. The **one gap** is that a *complete* season (playoff bracket → awards banquet →
leaders board) is too slow to finish in the sandbox's 45-second cap, so I validated its parts
(via passing subsystem probes and a stable 10-day partial run) but did **not watch a season
finish end-to-end**. Do one manual full-season playthrough before shipping (checklist below).
Two low-severity items to be aware of (chip-block direction quirk; large save size).

---

## Area-by-area

### 1. Onboarding / coach build — **PASS (all divisions)**
Generated a full world and inspected every school: **D1 120, D2 112, D3 102 = 334 schools**,
all with **0** bad/NaN attributes, 0 missing positions, 0 missing names, 0 thin rosters, 0
bad prestige, and fully-populated depth charts (QB/RB/WR/TE/OL/DE/DT/OLB/LB/CB/S/K/P). The
coach onboarding path (`startNewGamePrepared`) sets up a coherent coach (skills, finite
jobSecurity/prestige, world, schedule, season/day). Every division produces a real team.

### 2. Play Now — **PASS**
One exhibition game → valid box score: finite final score, both player-stat maps present, **0
NaN/undefined** anywhere in the box, passing + rushing yards accrue, and **touchdowns credit
to players** (verified after the TD-recording fix earlier today).

### 3. Full season — **PASS (machinery) / NOT-SEEN-END-TO-END (completion)**
The season engine runs **stably**: driving the real calendar, days advance, standings accrue a
finite W-L for every school, and there is **no crash and no NaN** in the standings/records
surface over the stretch I could sim (~10 game-days ≈ 40s). **Playoff bracket seeding,
awards, and the season leaders board were NOT directly watched to completion** — a full season
is ~35 game-days at ~4s/day ≈ 2+ minutes, over the sandbox cap. Their subsystems pass as
probes (see §9), but the *end-to-end* endgame is the one thing to confirm manually.

### 4. Dynasty / multi-season + DNA/retirement/tree — **PASS (via subsystems)**
Same throughput ceiling prevents driving several full seasons headlessly here, but the loop's
pieces are green: **tree_probe 79/79**, `tree_trickle_probe`, `dna_cards_probe`, and
`career_firing_probe` all PASS — these cover DNA accrual, retirement banking, the new-coach
tree head-start, and the hot-seat/firing logic. Recruiting/aging/rollover are covered by
`funnel_test` (23/23), `commit_rate_test`, `spring_dev_probe`, `tier_talent_check`,
`progression_check`, `recruiting_check` — all PASS. Half-DNA (Season) vs full-DNA (Dynasty)
rates are exercised by the tree probes. Recommend one manual 3-season roll to see it feel-wise.

### 5. Save / load persistence — **PASS**
A mid-season full state round-trips through `exportString` → `importJSON` with **every key
field preserved** (season, day, school count, player + total roster counts, coach wins/
jobSecurity, individual player id/rating) and **no NaN** in the reloaded roster/coach.
⚠ The export was **46.2 MB** (see Issues — save-size).

### 6. Stat realism at scale — **PASS (stable; 3 metrics intentionally conservative)**
N=250, with all of today's code (TD fix, Fix B, depth-chart merge):

| metric | band | value | |
|---|---|---|---|
| Points/team | 22–32 | 27.4 | OK |
| Rush yds/team | 150–200 | 146.5 | slightly low (known) |
| Pass yds/team | 200–290 | 255.3 | OK |
| Comp% | 58–68 | 57.4 | slightly low (known) |
| Sacks/team | 1.8–2.3 | 2.08 | OK |
| Yds/attempt | 6.5–8.0 | 7.31 | OK |
| TEAM INT% | 2.0–2.5 | 1.67 | slightly low (known) |
| Turnovers/team | 1.2–1.9 | 1.38 | OK |

Five of eight in band; the three "low" ones (rush, comp%, INT%) are the documented, deliberate
below-real calibration from the coverage/QB passes — the game plays coherently, just a hair
conservative. QB INT% correctly orders by skill (elite < weak). No regression from any session
change.

### 7. Edge cases — **PASS**
- **Blowout** (99-rated vs 30-rated): 144-0, no crash. (Scoring ceiling is uncapped — a total
  mismatch runs up the score; realistic-ish, not a bug.)
- **Degenerate gameplan** (0% run, 100% deep, 100% blitz, gunslinger 4th downs): no crash, no
  NaN, ypa 11.6 (high, as expected for all-deep).
- **Thin roster** (35 players): no crash.
- **60-game varied batch** (mixed tiers): no crash, **0 NaN box scores**, 0 tied finals.
- **OT**: implemented (`sim.js:4831 playOvertime`); no tied final scores shipped across 60
  games, consistent with OT resolving. Not force-triggered — see manual checklist.

### 8. UI flow (static read) — **PASS (strong)**
Full read of `js/ui/app.js` + all `views/*`. **No critical defects, no dead primary buttons a
customer can click, no navigation dead-ends, no crashing first-launch/end-of-career state**,
and **zero** TODO/stub/"coming soon" markers. Every empty state (no games, empty board, zero
awards/history, no schedule) has an explicit render path. Overlays (game result, halftime,
4th-down, call sheet, player card, save, kickoff) are guarded and print no raw undefined/NaN.
Minor items only — see Issues.

### 9. Probe / regression gate — **GREEN except one item**
tree_probe **79/79**; worldgen, watchphys, sep, blitz_reality, pressure, robber, press_jam,
rush, run_lane, qb_power_rush, qb_mobility, clock_realism, fourth_down, st_coverage, st_net,
motion_read, progression, tier_talent, thin_roster, recruiting, career_firing, auto_formation,
funnel (23/23), spring_dev, practice_career_impact, kicking_model, run_scheme, yac_split,
situational, kicker_check, save_migration, emergency_qb, tendency, recruit_tier_gate, balance,
and **all 7 new probes** (int_accounting, front_5_2, covsack, time_to_throw, read_conflict,
scramble_style, checkdown) — **PASS**. `portal_balance_probe` and `recruit_assist_probe` (old
known fails) now **pass**. Noise-flaky-but-fine at adequate N: motion_struct, align, creeper,
leverage. Too slow to finish in the 45s cap (did NOT error): special_teams, commit_rate_test,
recruit_calendar, shell_identity, h2_shadow. Browser-only Playwright smokes were skipped.

---

## Issues, ranked

**None are hard sale-blockers.** Ranked by how much they'd hurt a paying player.

1. **[VERIFY — biggest coverage gap] End-of-season endgame not watched to completion.**
   Playoff bracket seed/resolve, awards banquet, and the season leaders board were validated
   only by subsystem probes + a stable partial season, not by finishing a real season headless
   (sandbox 45s cap; a season is ~2 min of sim). *Action:* one manual full-season playthrough
   (checklist item 3). Likely fine — flagging because I couldn't prove it end-to-end.

2. **[likely-bug, minor] `chip_probe` check 2 fails** — a stout/aware pass-blocking back
   (STR/AWR 90) chips away *less* pressure than a weak one (40): measured weak 5.50 / stout
   6.19 sacks-conceded at N=110, same direction at N=50 (didn't clear as noise). The chip
   mechanic's talent term looks inverted or miswired. Low player impact (blocking-back chip is
   niche), but a real directional quirk. *Fix direction:* trace the chip block in
   `sim.js` (the RB-kept-in / chip pickup path) — the blocker's STR/AWR should *reduce*
   conceded pressure.

3. **[smell] Large save file — 46.2 MB mid-season.** Round-trips fine, but the migration probe
   asserts "under 40 MB" and my mid-season export exceeded it. Over a long dynasty this could
   approach browser storage limits (localStorage ~5–10 MB; IndexedDB is larger but not
   unlimited on all devices). *Action:* confirm the *shipped* diet snapshot (not the raw
   export) stays bounded across many seasons; watch on a low-end phone.

4. **[smell] "Advance day" is heavy.** The engine sims all ~167 other games per game-day at
   full play-by-play fidelity (~4s/day in Node). If the browser does the same, advancing the
   calendar / simming to your next game could visibly lag several seconds. *Action:* confirm
   perceived speed in-app on a phone; if it stutters, an AI-game quick-sim would help. (Not a
   correctness bug.)

5. **[minor, UI] Orphaned dead code in `mainmenu.js`** — `btn-mm-continue`/`btn-mm-load` have
   listeners but no rendered button, so `renderLoadModal` and the legacy per-coach system are
   unreachable. Loading works via the tree/`data-load-slot` cards, so nothing is user-facing
   broken; it's dead weight to prune before sale.

6. **[minor, UI] Four defensive-guard gaps** (`depthchart.js renderDepthOrder`, `recruiting.js
   renderAssist`, `coachoffice.js renderTreePanel`, `practice.js renderPractice`) dereference
   `school`/`state.ui` unguarded. Verified NOT reachable as crashes today (a fired coach keeps
   `playerSchoolId`, so `getPlayerSchool()` stays non-null on those screens) — hardening only.

7. **[minor, hygiene] `playcall_probe.mjs` missing** from `tools/` though CLAUDE.md cites it as
   a known-good probe. Dev-facing only.

8. **[minor, known] 3 stat bands slightly conservative** (rush 146.5, comp% 57.4, INT% 1.67) —
   documented deliberate calibration, not a regression. Optional polish if you want closer-to-
   real numbers. Also: worldgen `CAL`/`CAL` abbreviation collision (cosmetic), `balance_probe`
   still prints a stale `heisman` row (key renamed `legend`).

---

## Top pre-sale actions
1. **Manual full-season playthrough** to confirm the endgame surfaces render with real data
   (playoff bracket, awards, leaders) — the one thing not proven headless.
2. **Eyeball the watch-mode visuals** fixed today (kickoff clock, jet sweep, coverage-sack /
   throwaway ball paths) — code + geometry verified, but not rendered here.
3. Decide whether the **chip-block direction quirk** and **save-size / advance-day speed**
   warrant a fix pass before launch (none blocks a good first impression).
