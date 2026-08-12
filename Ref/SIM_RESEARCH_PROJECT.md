# Blueprint Sim-Realism Research Project

A standing effort to make the football simulation truer to how the game is
actually coached — driven by real coaching sources, **decided by the probe
suite**, never by vibes. This doc is the home base: the subsystems, the code +
probe anchors each maps to, the workflow, and the source rules.

## The one rule that makes this safe

Coaching blogs generate HYPOTHESES. The probes decide TRUTH. A blog tells you
*that* press man struggles against motion; it never tells you it's worth 0.14
separation vs 0.20. So every research pass ends at numbers: a claim is only
"real and missing" if a probe can show the sim doesn't model it, and a fix only
ships if a probe proves it moved the right band without breaking `stat_realism`.

This is exactly how the blitz pass worked (see `Ref/BLITZ_MODEL_ASSESSMENT.md`):
blogs → claims → found `deepRisk`/`zeroBehind` were dead code → wired them →
`blitz_reality_probe` + `pressure_probe` proved it, `stat_realism` proved no
regression.

## The loop (one subsystem at a time)

1. **Scope.** Pick a subsystem below. Read its code anchors so you know what the
   sim currently does.
2. **Source.** Owner seeds trusted links; assistant web-searches reputable
   coaching sources and proposes a reading list; **owner approves before use.**
3. **Extract claims.** Fetch each approved URL. Produce a claims list — each
   claim tagged: `testable` (a relationship a probe can check), `vague`
   (directional, no number), or `opinion` (skip). One line each, sourced.
4. **Diff vs code.** For each testable claim, check the actual module. Sort into:
   ALREADY MODELED (correct) · MODELED BUT WRONG · DEAD/MISSING.
5. **Findings doc.** Write `Ref/<subsystem>_ASSESSMENT.md` (same shape as the
   blitz one). Owner picks which gaps to fix.
6. **Fix + probe.** Each fix ships with a probe proving the behavior AND a
   `stat_realism` run proving no league-wide regression. Exact-string edits,
   baseline idiom (bundler-lowered `var`, double quotes).
7. **Verify + deliver.** build → boot → subsystem probe → stat_realism →
   tree_probe → device-commit changed files + the findings doc.

## Guardrails (always)

- **`stat_realism_harness` is the veto.** A change that improves one thing but
  pushes sacks / comp% / ypa / rush / INT% / turnovers out of their bands is a
  regression, no matter how "realistic" it feels. Bands live in that harness.
- Blogs describe the NFL/college IDEAL; the sim targets specific bands. Some
  "truths" won't apply — the probe says so.
- Blogs contradict each other. Disagreement = a real TRADEOFF to model, not a
  side to pick.
- Never edit a built file; edit `js/` + `style.css`. Never touch Buy-In /
  Coaching-Points systems (academics, grades, measures, coachPts, buyIn).
- I fetch specific URLs one at a time — no crawling, no PDFs/paywalled content.

## Subsystem roadmap

Each maps to code anchors and the probes that judge it.

### 1. Pass rush & protection  ← FIRST PASS
- Code: `sim.js` `resolvePassRush` (~207), `protectionFactor` (~72),
  `pressureCallRate` (~60); `rushgeo.js` `resolvePocket` (the shed/collapse
  pocket physics); `contests.js` `contestGap` (rush win).
- Probes: `pressure_probe`, `blitz_reality_probe`, sacks in `stat_realism`.
- Open questions for the blogs: four-man-rush win rates, stunts/games, the
  bull rush vs speed rush, how the pocket collapses, chip/help protection,
  the time-to-throw clock. (Blitz LAYER already done — this is the rest.)

### 2. Coverage & the route duel
- Code: `sepgeo.js` (route separation), `sim.js` `assignCoverage` (~601),
  `qbRead` (~401), `catchResolution` (~441); man/zone/press/shell dials.
- Probes: `sep_probe`, `coverage_blend_sensitivity`,
  `coverage_monotonicity_check`, `press_jam_probe`, `motion_read_probe`.
- Highest statistical upside — comp% and ypa are the bands most often flagged.

### 3. The run game & run fits
- Code: `run2geo.js`, `rushgeo.js`, `sim.js` `resolveRunPlay`; run-commit,
  edge discipline, gaps, second-level, broken tackles.
- Probes: `run_lane_probe`, `rush_probe`, `broken_tackle_check`.

### 4. Yards after catch & ball carrier
- Code: `yacgeo.js`, broken-tackle logic.
- Probes: `broken_tackle_check`, YAC splits in `stat_realism`.

### 5. Situational & game management
- Code: `situations.js`, 4th-down logic in `sim.js`, tempo/clock.
- Probes: `tendency_probe`, situational splits in `stat_realism`.

### 6. Special teams
- Code: kicking / return / coverage in `sim.js` + `season.js`.
- Probes: `kicking_model_probe`, `special_teams_probe`, `st_coverage_probe`,
  `kicker_check`.

### 7. QB play & decision-making
- Code: `qbRead`, scramble logic, `qb_mobility` / `qb_power_rush`.
- Probes: `qb_mobility_probe`, `qb_power_rush_probe`, INT% buckets in
  `stat_realism`.

## Capstone (after the subsystems): render the REAL play — "8-bit Madden"

The subsystem passes above make the *simulation* true. This capstone makes the
game *show* what the sim actually computed — the natural end state once the
engine is deep. It is deliberately last: every route/coverage/rush mechanic the
passes add is something this can then put on screen.

**The gap it closes.** `js/ui/watchphys.js` is already a full 2D animated play
renderer (~1,700 lines: 22 actors with velocity/accel/steering/separation, motion
trails, a rendered field, seeded so a play replays identically). But it is
DECOUPLED from the sim — it imports nothing from `sim.js`; `buildPlayScript(p,
offSlots, defSlots)` takes only a play's OUTCOME (`type`, `yards`, `td`,
formations, attrs) and SYNTHESIZES a plausible path to that yardage. So today you
watch a plausible re-enactment, not the real play: the chosen target, the covering
defender, the actual separation, the leverage, whether the robber/void fired —
all computed in `resolvePassPlay` and then thrown away after the yard count.

**Phase 1 — Coach-mode: watch the real sim in pixels (do FIRST; cheapest, highest
value; prerequisite for everything below).** Additive, low-risk, in-stack:
1. Have the resolvers (`resolvePassPlay`, run resolver) emit an optional compact
   TRACE of what happened — chosen target, covering defender id, separation,
   coverage type, and the coverage events we now model (leverage side, robber
   fired, void opened, route shape / double-move). The sim already knows all of
   this mid-play; it just discards it.
2. Give `buildPlayScript` an optional trace arg; when present it renders the REAL
   play, when absent it falls back to today's synthesis. Viewer stays decoupled
   (prefers trace, degrades gracefully) — same gated, verifiable discipline as the
   sim passes.
3. Verify: a trace-driven render must end at the sim's actual yardage/outcome and
   put the ball in the sim's actual target's hands. New `play_trace_probe`.

**Phase 2 — the 8-bit art pass (cheap, independent, any time).** A STYLE layer on
the canvas the viewer already draws: sprite/blocky players, pixel field, retro
palette + font, chunky motion. Pure canvas/CSS; fully separable from the sim.

**Phase 3 — Play-mode: throw it yourself (optional; a FORK IN IDENTITY).** A
real-time input loop where the coach steers the QB / aims the throw and the sim
resolves around the input. Reuses the viewer's rendering + physics; needs an input
layer and a "live" resolution path. This turns Blueprint from a COACH'S game (call
it, watch it) into a PLAYER'S game (play it) — a design decision as much as code,
which is why it's optional and last. Phase 1 is its prerequisite (can't throw to a
receiver until the real routes are on screen).

**Why NOT Unity (decided 2026-08-05).** The value here is the simulation, which is
pure JS number-crunching a game engine buys nothing for; the play visualizer
already exists in-browser; and the whole game ships as one self-contained
offline-capable PWA. Porting to Unity/C# would rewrite the engine AND the UI and
throw away that deployment story for a game that would look/feel roughly the same.
Retro Bowl (the "8-bit football" touchstone, a solo Unity game by New Star Games'
Simon Read) is deliberately THIN sim + great feel; Blueprint is the opposite —
DEEP sim + (currently) schematic presentation. This capstone closes the
presentation gap without abandoning the stack. Every phase above is browser/JS.

## Status log
- 2026-08: Pass rush BLITZ layer done (`Ref/BLITZ_MODEL_ASSESSMENT.md`).
- 2026-08: Pass rush & protection (four-man rush / creeper / chip / align) done
  (`Ref/PASS_RUSH_PROTECTION_ASSESSMENT.md`).
- 2026-08-05: Coverage & route duel done — all 6 fixes A–F (leverage, route
  individuation + double-moves, Quarters robber, zone void + pattern-match,
  shell press/off identity, motion read) shipped + probe-verified + committed
  (`Ref/COVERAGE_ASSESSMENT.md`).
- 2026-08-06: YAC & ball carrier (subsystem 4) done — all 5 fixes A–E (split
  probe; YAC-ceiling/un-saturated separation + breakaway gate; catch-depth into
  geoYAC; screen blocking lever + RZ dropoff; PA-vs-loaded-box) shipped +
  probe-verified + committed (`Ref/YAC_ASSESSMENT.md`). YAC/reception 3.30→4.39
  (real ~4.4); all passing bands held (ypa 7.14). New probe `yac_split_probe.mjs`
  is the air/YAC-split veto. The 43%-share / 8-12%-tail gap is a deliberate
  stopping point — bounded by the ypa floor (cutting more air would push ypa OOB).
- 2026-08-06: Situational & game management (subsystem 5) done — all 5 fixes A–E
  (clock-stops, timeout-aware kneel, modern 4th-down curve, two-minute sideline,
  late FG-range stretch) shipped + probe-verified + committed
  (`Ref/SITUATIONAL_ASSESSMENT.md`).
- 2026-08-06: Special teams (subsystem 6) done — all 5 fixes A–E (FG distance-curve
  reshape, PAT reads the kicker, kickoff-return trim, onside realism, punt-net +
  deep-punt safety + blocked FG) shipped + probe-verified + committed
  (`Ref/SPECIAL_TEAMS_ASSESSMENT.md`). Owner kept TRADITIONAL kickoff. New probes
  `st_net_probe.mjs` + `xp_probe.mjs`. Safety residual is a deliberate stop.
- 2026-08-12: Special teams (subsystem 6) PASS 2 — a deeper autonomous sweep with the
  repaired `kicker_check`. Confirmed the A–E work is intact and the ST system is mature
  (fakes, coffin-corner, return schemes, icing, squib, surprise-onside all live — no dead
  code). 3 fixes shipped (F muffed punt, G fumbled kickoff return — both new `returnMuff`
  ball-security lever, kicking team recovers ~1/3 → a real ST turnover; H FG long-tail lift
  center 48→48.5 / denom 10.5→11.5, 50+ 43→46% toward the modern anchor, overall FG% held
  76.1). New probe `tools/muff_probe.mjs`; `returnMuff` exported. **stat_realism proven clean
  vs a reverted baseline** — Turnovers 1.52→1.60 (muffs, in band), Points in band, Rush/Comp%/
  ypa/INT% statistically identical (the off-band Rush/Comp% are the standing pre-existing flags,
  NOT this pass). Nothing dropped by the veto. Onside + safeties left as pass-1 deliberate stops.
  **STAGED, NOT COMMITTED** — owner commits from his clone after review; owner to run boot +
  `st_ui_smoke` there (headless Chromium unavailable in the work sandbox). `tree_probe` 76/79 is a
  PRE-EXISTING unrelated coaching-tree flag (identical on the reverted baseline). Files:
  `js/engine/sim.js`, `js/constants.js`, `Ref/SPECIAL_TEAMS_ASSESSMENT.md`, `tools/muff_probe.mjs`.
- 2026-08-06: QB play & decision-making (subsystem 7) done — 4 of 5 fixes shipped
  (A time-to-throw clock [sack-neutral hurry reshape], C read-conflict/take-what's-open,
  D scramble-to-throw + style, E checkdown rung) + probe-verified; **fix B (coverage
  sack + throwaway) DROPPED by the veto** — it pushes already-low comp%/INT%/rush the
  wrong way; the calibration has no headroom (`Ref/QB_PLAY_ASSESSMENT.md`). comp% moved
  into band (57.4→58.5); sacks/ypa/points/TO held; rush + INT% unchanged at their
  pre-existing off-band values. New probes: `time_to_throw_probe`, `read_conflict_probe`,
  `scramble_style_probe`, `checkdown_probe`. `qbRead` now exported for its unit probe.
  Sources: seed #46/#10/#11/#24 + USA Football reads, Sharp/SIS timing, PFF scrambling
  (smartfootball.com dropped — domain hijacked to spam; the "#51-53" seed label was a
  numbering slip for #46/#10/#11/#24).
- 2026-08-06: CAPSTONE PHASE 1 (coach-mode) done — the viewer renders the REAL
  play. resolvePassPlay emits a compact trace (chosen separation, route
  shape/double-move, coverage type, robber, zone-void, cover position) +
  targetSlotId; buildPlayScript consumes it: real target slot, cover cushion
  scaled by the sim's separation, the target's cover man anticipates the catch
  point, robber breaks on the throw, double-move routes drawn when they fired.
  Falls back to synthesis when absent (viewer stays decoupled). New
  `tools/play_trace_probe.mjs`: ball in the actual target's hands 100%, render
  at sim yardage 100%, cushion tracks separation (tight ~4u vs open ~11u).
  Found+fixed: the called double move's TEC≥70 gate was dead code (tier-1
  rosters top out ~68) — the featured man now always runs the called dbl and
  sepgeo's TEC-vs-AWR pricing is the gate. Phase 2 (8-bit art) largely covered
  by the sprite pass; Phase 3 (play-mode) still open.
- Capstone (after subsystems, or Phase 1 any time): render the real play — see
  section above.

## Backlog / future updates (keep an eye out — not a sim-realism pass)
- **Better playbooks (owner request 2026-08-05).** Deepen the playbook system —
  more concepts, better tags/rules, richer offensive + defensive call sheets.
  There is already a `Ref/PLAYBOOK_SPEC.md` and a `tools/playbook_build_probe.mjs`
  in the repo; start there. This is a game-feature/content pass, distinct from the
  sim-realism loop, but it PAIRS naturally with the coverage work just shipped
  (individuated routes, leverage, zone concepts give playbook concepts something
  real to express) and with the capstone visualizer (a richer playbook is more
  worth watching). Slot it whenever the owner wants a content/design update rather
  than a realism pass.
