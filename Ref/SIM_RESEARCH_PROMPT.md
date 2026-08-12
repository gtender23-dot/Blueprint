# Reusable prompt — one sim-realism research pass

Paste this and fill in the two blanks. It runs ONE subsystem end to end, the
same disciplined way every time. Assumes the repo at
`C:\Users\Thoms\OneDrive\Documents\Blueprint-pre-W1` and the workflow in
`Ref/SIM_RESEARCH_PROJECT.md`.

---

**Run a sim-realism research pass on the `<SUBSYSTEM>` subsystem.**

Trusted sources I'm seeding: `<LINKS, or "none — you propose them">`.

Follow `Ref/SIM_RESEARCH_PROJECT.md` exactly. Specifically:

1. **Read the code first.** Open the code anchors for `<SUBSYSTEM>` from the
   roadmap and tell me, in plain terms, what the sim currently does — before
   reading any blog. I want your read of the mechanism, so we both know the
   baseline.

2. **Sources.** Use my seeded links. Then web-search reputable coaching sources
   (coach blogs, clinic notes, coaching-clinic write-ups, respected analysts) on
   this subsystem and PROPOSE a short reading list with one line each on why.
   **Wait for my approval before fetching anything I didn't seed.**

3. **Extract claims.** Fetch each approved URL one at a time. Produce a numbered
   claims list. Tag each: `testable` / `vague` / `opinion`, with the source.
   Keep only football relationships — ignore history, drills, motivation.

4. **Diff vs the code.** For every `testable` claim, check the actual module and
   sort it: **ALREADY MODELED** (and correct) · **MODELED BUT WRONG** ·
   **DEAD/MISSING**. Name the exact probe that would validate each. Flag any
   claim that, if implemented, would push a `stat_realism` band out of range.

5. **Write the findings doc** `Ref/<SUBSYSTEM>_ASSESSMENT.md` in the SAME shape
   as `Ref/BLITZ_MODEL_ASSESSMENT.md`: what the game gets right, what it gets
   wrong / under-models (with probe-grounded evidence), and a prioritized fix
   list (smallest-change-highest-impact first). **Stop here and let me pick the
   fixes** — do not change sim code in this step.

Hard rules: probes decide truth, not the blogs; `stat_realism_harness` is the
veto on any fix; edit only `js/`/`style.css` in baseline idiom; never touch
Buy-In/Coaching-Points systems; fetch specific URLs only (no crawling/PDFs).
If a blog assumes a concept the sim doesn't have, STOP and flag it — don't
invent a substitute.

When I pick fixes, implement each with: exact-string edits, a probe that proves
the new behavior, a `stat_realism` run proving no regression, then
build → boot → tree_probe, and device-commit the changed files + the findings
doc. Report before/after numbers with reasoning, distinguishing "moved on
purpose" from "regression."

---

### Fill-in reference (subsystem → what to put)
- `Pass rush & protection` — anchors: sim.js resolvePassRush/protectionFactor/
  pressureCallRate, rushgeo.js resolvePocket, contests.js contestGap. Probes:
  pressure_probe, blitz_reality_probe.
- `Coverage & the route duel` — anchors: sepgeo.js, sim.js assignCoverage/
  qbRead/catchResolution. Probes: sep_probe, coverage_blend_sensitivity,
  coverage_monotonicity_check, press_jam_probe, motion_read_probe.
- `Run game & run fits` — anchors: run2geo.js, rushgeo.js, resolveRunPlay.
  Probes: run_lane_probe, rush_probe, broken_tackle_check.
- `Situational & game management` — anchors: situations.js, 4th-down logic.
  Probes: tendency_probe, stat_realism situational splits.
- `Special teams` — Probes: kicking_model_probe, special_teams_probe,
  st_coverage_probe, kicker_check.
- `QB play` — anchors: qbRead, scramble. Probes: qb_mobility_probe,
  qb_power_rush_probe.
