# Blueprint — manual QA checklist (browser walkthrough)

For the things the headless audit could NOT verify: live rendering, layout/readability, feel,
audio, and the full-season endgame. Serve the build (`npx serve dist`) and, ideally, also open
it on a phone. Check a box only when it looks right, not just "didn't crash." ✅ / ⚠ / ❌.

## 1. First launch & onboarding
- [ ] Cold start (no saves): main menu renders, "Start a Dynasty" is obvious and works.
- [ ] Build a coach: every wizard step is readable, Back/Continue always work, no dead step.
- [ ] Author playbook + gameplan: sliders/toggles respond; the sheet reads clearly.
- [ ] Pick each division (D1 / D2 / D3) at least once: starting roster + depth chart look full
      and sensible; ratings/names/positions all render (no blanks, no "undefined").
- [ ] Progress dots: cosmetic — in the tree flow the step-1 dot shows "done" while on step 2
      (known, harmless).

## 2. Play Now (exhibition)
- [ ] Start a one-off game; it runs start → final with a valid scoreboard.
- [ ] Box score tab: passing/rushing/receiving/defense all populate; **TDs show up next to the
      right players** (this was just fixed — confirm QBs/RBs/WRs get their TDs, not 0s).
- [ ] Play-by-play reads coherently.

## 3. Watch mode (LIVE) — highest-priority visual pass (recent fixes here)
- [ ] Turn "Watch my games LIVE" on and watch a full game.
- [ ] **It plays at a steady pace and does NOT skip around** — you should see the large majority
      of plays, not ~25% flashing by. (Just fixed; confirm it's smooth.)
- [ ] **Kickoffs show the correct game clock/quarter** (not a time from later in the game). (Fixed.)
- [ ] **Jet sweep**: the motion man runs one continuous direction across the formation — he does
      NOT motion in then reverse back the way he came. (Fixed.)
- [ ] **Coverage-sack / throwaway plays**: the ball path looks sane. A throwaway should sail out
      toward the sideline (nobody catches it); a coverage sack keeps the ball with the QB. No
      wild/looping/teleporting ball. (Fixed — confirm on a few pressured dropbacks.)
- [ ] Normal pass/run/sack/scramble animations look right; players don't jitter or stack.
- [ ] Speed controls (½× / 1× / 2×), pause, step, drive-jump all work in replay mode.
- [ ] Overtime: if you can force/encounter a tie at the end of regulation, confirm OT plays and
      resolves cleanly (implemented but not force-tested headless).

## 4. A FULL season to completion — the biggest unverified path
- [ ] Sim/coach a whole season to the end (watch the perceived speed of "advance" — flag if
      simming to your next game lags several seconds; see report §Issue 4).
- [ ] **Standings** populate correctly all year and read cleanly (records, ranking, conference).
- [ ] **Playoff bracket** seeds sensibly and resolves round by round to a champion.
- [ ] **Awards / banquet** screen: award winners compute and display (no blanks/NaN).
- [ ] **Season leaders** board: passing/rushing/receiving/defensive leaders show real numbers.
- [ ] Schedule screen is coherent all season (opponents, results, weeks).

## 5. Offseason → dynasty roll (do this across ~3 seasons)
- [ ] Graduation/aging: seniors leave, freshmen arrive, roster stays full and sensible.
- [ ] Recruiting flow: board, contact, funnel, signings — usable and readable; class lands.
- [ ] Development/practice screens work; player growth feels reasonable over years.
- [ ] Coach DNA accrues over the season; retiring/leaving a coach banks it; a NEW coach starts
      with the tree head-start. Confirm the half-DNA (Season mode) vs full-DNA (Dynasty) feel.
- [ ] Hot seat: a bad season threatens your job; you're never fired with zero warning.

## 6. Save / load (in-app)
- [ ] Save mid-dynasty, fully quit/reload the tab, load — everything is exactly where you left
      it (roster, standings, recruiting, coach, week).
- [ ] Do this once **late** in a long dynasty and confirm it still saves/loads fast (watch for
      save-size slowness on a phone; see report §Issue 3).
- [ ] Export/import a save file if that UI exists.

## 7. Layout / readability / feel (desktop AND phone)
- [ ] Every screen fits and is readable on a phone (no cut-off tables, no overlap, tap targets
      big enough). Tables that were called out for phone (roster, schedule, recruiting board,
      stats) — scroll/scan cleanly.
- [ ] Team colors/crests render; text contrast is fine in both light and dark.
- [ ] Nothing shows raw "undefined", "NaN", "[object Object]", or an empty box where data
      should be — spot-check the data-heavy screens (stats, scout, history, awards).
- [ ] Navigation feels complete: every screen has a way back; the tab bar / menu is consistent.

## 8. Audio (if any)
- [ ] Any sounds/music play when expected, aren't jarring, and can be muted.

## 9. General "does it feel like a finished product"
- [ ] 30–60 minutes of real play: does anything feel stubbed, thin, placeholder, or broken?
- [ ] First-time-user clarity: could a stranger figure out what to do without help?

---
**If everything in §3 and §4 checks out, the two things the headless audit couldn't reach are
covered and the game is in strong shape to sell.** Log anything with a ⚠/❌ and send it back.
