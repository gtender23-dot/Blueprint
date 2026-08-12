# Special teams model assessment — where the game matches real football, and where it doesn't

Checked against real FBS special-teams anchors (Sports-Reference / TeamRankings /
FootballDB / ESPN kicking + punting, NFL Football Operations & Harvard Sports Analysis
for onside), plus SOURCE_LIBRARY #44 (Bengals KO-return scheme). Grounded in the actual
sim code (`js/engine/sim.js` — `attemptFG`, `puntDistance`, `puntResult`, `coverageStrength`,
`returnOutcome`, `kickoffOutcome`, `onsideResult`, the XP/2-pt block, the safety paths) and
`js/constants.js`. Confirmed with `kicking_model_probe`, `st_coverage_probe`,
`special_teams_probe` (N=500 games), and a new `_st_net_probe` measuring emergent punt net,
kickoff, and onside numbers (N=400 games).

**Owner decision locked (2026-08-06): TRADITIONAL kickoff, not the 2024/25 dynamic kickoff.**
The coded kickoff (touchback→25, ~62% touchback, return base 23) is therefore already
rules-correct and is NOT being rebuilt — only validated, and trimmed where a probe says it
runs long.

## What the game gets RIGHT
- **FG attribute model is sound.** Range reads leg = ½STR+½PWR, accuracy = ½TEC+½AWR through a
  logistic; the DNA special-teams grade is a real lever. Overall FG% **75.3%** sits inside the
  ~72-77% band. A big-leg kicker stretches range, an accurate one makes the makeable ones.
- **Punt gross is right.** Isolated mean **45.0**, in-game **43.4** — real FBS gross is ~45-46
  (top punters 48-49, league ~45). No tuning needed on gross.
- **Kickoff (traditional) is right.** Touchback **59.1%** (base 0.62), touchback to the 25.
  Correct for the rules the owner chose.
- **Coverage / return duel is wired and pays off.** `coverageStrength` (LB/S/CB SPD+STR) feeds
  `returnOutcome`'s (returner − coverage) edge; the DNA ST grade measurably suppresses returns
  (st_coverage_probe: grade 10 = +10% coverage, −1.1 yd/ret, fewer housed). Punt blocks are
  modeled and scale with the rush unit's athleticism. Fair-catch/downed share **42%** (const 0.45).
- **The go/kick/punt 4th-down brain is already modern** (reworked in subsystem 5) — not re-scoped.
- **Onside is close.** Measured **13.6%** recovery vs the real *expected* onside rate of ~9-13%.

## What the game UNDER-MODELS / gets WRONG (biggest gap first)

### 1. FG make% curve is the wrong SHAPE — too easy short, too hard long (biggest gap)
The overall number is in band, but that hides a distance error the probe exposes cleanly:

| Distance | Sim (kicking_model_probe) | Real FBS anchor |
|---|---|---|
| inside 30 | **95.2%** | ~92-94% (slightly high) |
| 30-39 | 83.3% | ~80-83% (ok) |
| **40-49** | **62.0%** | **~66-70%** (too hard) |
| **50+** | **35.3%** | **~48-52%** (much too hard) |

The logistic falls off too steeply with distance: the sim over-rewards chip shots and badly
under-rewards the 45-55 yd kick that modern kickers hit. A 52-yarder that a real FBS leg makes
~half the time is a 35% coin-flip here. This is the most-attempted, most-visible ST event, so
the shape error shows up every game. **Probe: `kicking_model_probe`. stat_realism risk: points
and FG-rate — must reshape mean-preservingly (hold overall ~75%).**

### 2. Extra points are a FLAT constant that ignores the kicker
`C.PAT_RATE = 0.96` is applied to *every* XP regardless of who's kicking — a walk-on and an
elite specialist convert identically. Real FBS XP is ~95-97% league-wide but a shaky kicker is
meaningfully worse, and PATs are where a low-TEC kicker should quietly cost points. Right now
the kicker's accuracy attribute does nothing at the PAT. **MODELED BUT WRONG (no individuation).
Probe: extend `kicking_model_probe`. Low stat_realism risk (mean-preserving to ~0.96).**

### 3. Kickoff returns run a touch long
`_st_net_probe` measures **26.7 yd/return** against a real traditional KO-return average of
~20-22. Return base 23 plus strong returners pushes the mean high, so receiving teams start
a bit too far up the field. **MODELED BUT SLIGHTLY WRONG. Probe: `st_coverage_probe` /
`_st_net_probe`. stat_realism risk: starting field position → points; small trim only.**

### 4. Punt NET is a few yards low
Emergent net = gross 43.4 − return 5.8 = **37.6**, against a real net of ~40-42. The gap is
driven by in-game gross landing at 43.4 (worse field position, weaker punters) plus the return.
Real net trails gross by ~4-5; here it trails by ~6. Modest. **Probe: `_st_net_probe`.
stat_realism risk: field position — low-priority, easy to over-correct.**

### 5. Onside has no skill, variance, or surprise path
`onsideResult()` is a hardcoded 15% coin-flip: no kicker/hands-team attribute, no per-kick
variance, and no surprise-onside path (the sim only calls onside when trailing late, i.e. always
"expected"). Measured 13.6% is fine as a central value, but the event is identical for every team.
Real: expected ~9-13%, **surprise ~60%**. **DEAD detail. Low stakes (rare event).**

### 6. Safeties are ~10× too rare
Measured **~0.008/team/game** vs real ~0.05-0.15. Safeties fire only when a sack/loss pushes the
ball behind the offense's own goal; the sim has no intentional-grounding-in-the-end-zone,
holding-in-the-end-zone, or bad-snap/punt-block safety. **UNDER-MODELED. Larger lift (needs new
event paths), lower priority.**

### 7. No blocked-FG model
Punt blocks exist; FG blocks don't (a missed FG is only ever a "miss"). Real ~1-2% of FG attempts
are blocked and can be returned. **MISSING. Minor.**

## Recommended fixes (priority order — smallest change, highest impact first)
- **A. Reshape the FG distance curve.** Widen the logistic denominator (and/or nudge center) so
  40-49 → ~68% and 50+ → ~50%, holding overall ~75% and short kicks ~92-94%. Single-formula edit
  in `attemptFG`; `kicking_model_probe` is the veto, `stat_realism` guards points. **Highest impact.**
- **B. Make the PAT read the kicker.** Replace the flat `PAT_RATE` with a kicker-accuracy-scaled
  make prob centered on ~0.96 (a short logistic on ½TEC+½AWR). Tiny change, gives specialists real
  value, mean-preserving so league XP% holds. **Low risk.**
- **C. Trim the kickoff return mean** ~26.7 → ~22 (drop `KICKOFF_RETURN_BASE` 23→~19-20 or lift
  coverage weight), re-checking starting field position and points. **Small.**
- **D. Onside realism** — drop expected rate to ~0.11, add a small hands-team/attribute lever and
  per-kick variance; optionally a surprise path. **Small, rare-event.**
- **E. Punt net nudge / safety events / blocked FG** — optional polish; each is lower impact and
  net/safety carry field-position risk, so only if you want the completeness.

**STOP — owner picks the fixes.** No sim code changed in this pass.

---

# UPDATE — fixes implemented (all five, A–E)

Owner picked ALL of it (2026-08-06). All five shipped, probe-verified, and passed the full
verification chain. Kickoff kept TRADITIONAL per the owner. Files touched: `js/engine/sim.js`,
`js/constants.js`. New probes: `tools/st_net_probe.mjs` (emergent punt-net / KO / onside veto),
`tools/xp_probe.mjs` (PAT-reads-kicker veto).

**A. FG distance curve reshaped.** `attemptFG` rangeCenter base 46→48 and logistic denominator
8.5→10.5 — a flatter, correctly-centered falloff. Before → after (kicking_model_probe):
inside-30 95.2→93.2%, 30-39 83.3→82.4%, 40-49 **62.0→65.1%**, 50+ **35.3→43.0%**, overall
75.3→76.2% (held in the 72-77 band). The 50-yarder is no longer a 35% coin-flip; short kicks came
down slightly toward the ~92-94% real anchor.

**B. PAT now reads the kicker.** New `xpMakeProb(roster, depth)` centers make% on `PAT_RATE` at
accuracy `PAT_PIVOT` (55) and scales `PAT_ACC_SCALE` (0.045) per point of ½TEC+½AWR, clamped
[0.80, 0.997]. League mean XP% **95.7%** (was flat 96.0 — mean-preserving), but now a walk-on
(acc <45) makes ~92% and an elite (acc 65+) ~98%. xp_probe confirms the spread.

**C. Kickoff return mean trimmed.** `KICKOFF_RETURN_BASE` 23→19. In-game KO return average
**26.7 → 22.3** (real traditional ~20-22), and the house rate fell with it (0.79 → ~0.6%/return).
Isolated to kickoffs; punt returns untouched. Touchback rate held at ~59%.

**D. Onside made real.** Flat 0.15 → `onsideResult(surprise, stGrade)` reading `ONSIDE_EXPECTED`
(0.11) vs `ONSIDE_SURPRISE` (0.60), plus a small kicking-team ST-grade edge and the inherent
per-kick variance. The sim still only triggers the expected path (trailing, late); the surprise
path is plumbed for a future AI trigger. Measured recovery ~9-13% (was a flat 15%).

**E. Punt net + safeties + blocked FG.**
- E1 **punt net**: `puntDistance` base 38→39 and `PUNT_RETURN_BASE` 8→6. Emergent NET **37.6 →
  39.9** (gross ~44.7, real net ~40-42); returned punts no longer ride high.
- E2 **safeties**: added the one clean, real source a drive-level sim can carry — a bad-snap /
  punt-blocked-out-of-the-end-zone safety when punting from inside the own 8 (`PUNT_SAFETY_DEEP`
  0.18). It lifts the rate modestly. **The residual gap to the real ~0.05-0.10/team is a
  DELIBERATE STOP:** punts that deep are rare (~0.023/team-game) and the remaining real safeties
  come from mechanics this sim abstracts away (muffed snaps, end-zone strip-sacks); inflating a
  constant to fake them would violate the "probes decide truth" rule.
- E3 **blocked FG**: `FG_BLOCK_RATE` 0.02 — ~2% of attempts blocked (real ~1-2%), scored as a miss
  with the defense recovering a couple yards closer to the LOS than a normal miss.

**Verification chain (all green).** st_net_probe + xp_probe + kicking_model_probe + st_coverage_probe
+ special_teams_probe all confirm the behaviors. `stat_realism_harness` N=380: Points **26.6**,
Plays 71.6, Pass 248.1, ypa **7.12**, Sacks 2.17, Turnovers 1.45 — ALL IN BAND (Rush 144.1 / Comp%
57.5 / INT% 1.67 are the documented PRE-EXISTING pristine flags, unchanged from the 145.7/57.3/1.74
baseline — no new regression). tree_probe 79/79 · build 11/11 (cache cfb-dynasty-883aefca44) · boot
0 pageerrors · ui_playcall_smoke RUNG 6 PASS.

---

# PASS 2 — 2026-08-12 — a deeper sweep with the repaired kicker_check

Pass 1 (above) shipped A–E and stopped. This pass re-opened subsystem 6 to (a) re-validate
the pass-1 work against the newly-repaired `kicker_check` (it now Monte-Carlos the REAL
`attemptFG`/`puntDistance` instead of stale private copies, so it FAILS if the model
regresses), and (b) sweep for real ST mechanics pass 1 didn't reach. **First finding: the
pass-1 fixes are all intact** (constants + code markers present; `kicker_check` ALL-PASS;
FG% by band, XP-reads-kicker, punt-net 40, KO-return 22, onside 12% all still in range).
The system is far more mature than pass 1's doc implies — since then a "PASS 6" call-system
layer added real fake-punt/fake-FG resolvers, coffin-corner, hang-time, gunner, return-vision
and hands-team traits, return schemes (safe/wall/balanced), pressure-kick clutch (iceVeins/
shanks), squib kicks, surprise-onside, and icing. Every one of those was traced to a live call
site — **no dead-code gaps** (the thing this loop exists to catch). So pass 2 is a short list.

## Sources (pass 2)
Seed #44 (Bengals KO-return scheme — its wall/patient-track/stalk-block concepts are ALREADY
captured by the return-scheme identity system, so it validates rather than adds). Plus reputable
web anchors, fetched/searched one at a time: TeamRankings/ESPN FBS FG-by-distance; a 2024 FBS
kicking retrospective (50+ made **62.2%** league-wide); footballperspective's fumble-recovery
study (muff/fumble rates on punts & kickoffs); an EPA-based fake-punt/FG effectiveness note
(~55% short-yardage); Harvard/other onside expected-vs-surprise figures.

## Claims (tagged)
- **[testable]** FG make% falls too steeply at distance vs the modern game — 2024 FBS 50+ = 62.2%,
  the sim's 50+ population sat ~43%. *(Caveat: real 50+ attempts are self-selected to big legs.)*
- **[testable]** Muffed/fumbled punts are a real turnover: ~3.5% of returnable punts muffed, the
  kicking team recovers ~1/3 (~1.15% of ALL punts a turnover).
- **[testable]** Fumbled kickoff returns: ~3.1% of kickoffs fumbled, kicking team recovers ~1%.
- **[testable]** Short-yardage fake punt/FG converts ~55% (≈ a straight FG in EPA at midfield).
- **[vague]** Ball-security (a returner's hands) governs how often he muffs.
- **[opinion]** Whether to run the dynamic kickoff — owner locked TRADITIONAL (pass 1), skip.

## Diff vs code
**ALREADY MODELED (correct — validated, no change):** the FG attribute/logistic + clutch;
XP-reads-kicker; punt gross/net + coffin corner; touchback-tied-to-leg; missed-FG spot-of-kick
field position (LOS−7, block LOS−5); FG block (~2%) & punt block; punt-deep safety; return
coverage duel + ST-grade; return schemes; onside expected(0.11)/surprise(0.60)/hands-team;
squib; icing; **fake punt/FG resolvers converting ~53–55% short — dead-on the ~55% anchor.**
**MODELED BUT WRONG:** the FG long tail sat a hair low against the *new* 2024 anchor (43% vs the
pass-1 ~48-52 target). **DEAD / MISSING:** returns could not be lost — no muffed-punt or
fumbled-kickoff turnover path anywhere (returns were clean-or-fair-catch on both punts and KOs).
Onside is *fine* (the 0.11/0.60 split is right; the blended 23.8% college figure includes
surprises); safeties remain the pass-1 deliberate stop.

## Fixes shipped (F–H) — each probe-verified, each stat_realism-checked
- **F. Muffed punt.** A fielded (non-fair-catch) punt can be muffed at the catch; the returner's
  ball-security `0.5·HND+0.5·SEC` suppresses it (`returnMuff`). `MUFF_RECOVER_KICK` (0.33) of muffs
  are lost to the coverage team — the punting team KEEPS the ball (a new `muff_retain` drive-loop
  branch, no possession flip) and the return team is charged a lost fumble; the rest are recovered
  by the return team (dead ball, no return). Consts `PUNT_MUFF_BASE 0.035`, `MUFF_HND_PIVOT 55`,
  `MUFF_HND_SCALE 9e-4`. **`muff_probe`**: unit hands-monotonic (sure 0.5% < avg 3.5% < poor 4.8%),
  lost-share 34%≈0.33; emergent punt-muff **3.73% of returnable** (real ~3.5%), lost **1.18%** (real
  ~1.15%).
- **G. Fumbled kickoff return.** Same lever on returned kickoffs (`KO_MUFF_BASE 0.022`); a coverage
  recovery flips the ball to the kicking team near the return-team's own 20 (a short field), charged
  as a lost fumble. Emergent muff-lost **0.28% of all KOs / 0.74% of returned** — conservative vs the
  study's ~1% of all KOs (that figure is from a return-heavy era; the modern touchback-heavy game
  returns far fewer), documented as such.
- **H. FG long-tail lift.** `fgMakeProb` center 48→**48.5**, denom 10.5→**11.5** — a mean-preserving
  flatten. `kicking_model_probe`: inside-30 93.5→**92.5** (real ~92), 30-39 82.4→**81.9**, 40-49
  65.1→**65.9** (real ~68), 50+ **43.0→46.0** (real ~45), OVERALL 76.2→**76.1** (band 72-77).
  Deliberately does NOT chase 62%: the sim's 50+ population is average (desperation FG-late-stretch
  kicks), not self-selected big legs, so a lower make rate at that distance is correct here.

## Verification (pass 2)
Module import OK (34 exports). `kicker_check` ALL-PASS. `kicking_model_probe` as above.
`muff_probe` (new) ALL-PASS. `xp_probe`, `st_coverage_probe`, `st_net_probe` (all gates), 
`special_teams_probe` — green, ST bands held (punt net 40.0, KO return 22.1, touchback 58%,
onside ~12-14%, penalties/drive-mix in band). **`stat_realism_harness` — apples-to-apples vs a
reverted baseline (muffs off, FG reverted), 2 runs each N=500:** Turnovers 1.52→**1.60** (the muffs;
band 1.3-1.8), Points 26.0→**26.4** (band 24-30). **Rush (141 vs 141), Comp% (56.6 vs 56.6), ypa
(7.03 vs 7.02), INT% (~2.0) are STATISTICALLY IDENTICAL between baseline and current** — the
off-band Rush/Comp% are the standing PRE-EXISTING flags, provably NOT touched by this ST pass.
`build` 11/11 (cache cfb-dynasty-ff9a1421bd, built in a writable copy — the OneDrive mount blocks
the build's `dist/` unlink; owner builds from his clone). New probe: `tools/muff_probe.mjs`.
Files touched: `js/engine/sim.js`, `js/constants.js`. `returnMuff` exported for its unit probe.

## Not shipped / flagged for the owner
- **Boot check + UI smokes could not run in this sandbox** (headless Chromium won't install —
  network-restricted; an `envKnown`-class limitation). Substitutes are green (clean import + 11/11
  build sanity; edits are engine-logic, no render-pipeline touch). **Owner: run boot + `st_ui_smoke`
  in your clone before committing.**
- **`tree_probe` reads 76/79**, the 3 fails being a coaching-tree career-banking "motivator
  undefined" — **PRE-EXISTING and unrelated to ST: the reverted baseline shows the identical 3
  fails.** Not caused by this pass; flagged as a separate heads-up (pass-1 doc's "79/79" predates
  whatever tree drift introduced it).
- Kickoff-muff rate is intentionally conservative (see G). Safeties unchanged (pass-1 deliberate stop).
- Nothing was dropped by the veto — all three fixes cleared it.
