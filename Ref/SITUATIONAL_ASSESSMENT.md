# Situational & game management assessment — where the game matches real football, and where it doesn't

Subsystem 5 of the sim-realism roadmap. Checked against the Throw Deep Take-a-Knee
chart (#47), the opening-script / play-calling cluster (#25), the Throw Deep trick-play
guides (flea flicker, reverse, swinging gate), and — because the library sources are
qualitative on clock/4th-down math (owner-approved: seed numeric sources when the
library is thin) — the following numeric references, fetched one at a time:

- Advanced Football Analytics, "The 4th Down Study" (EP model: FG worth 2.3 EP net of
  the kickoff, TD 6.3 EP, 1st-and-10 EP surface by field position).
- Malter Analytics NFL 4th-down model (4th-and-3 ≈ 45% convert; own-42 4th-and-3: go
  EP +3.15 vs punt +1.65 → go beats punt; goal-to-go convert rate lower).
- American Football Database, "Running out the clock" / "Quarterback kneel" (three
  kneels drain ~120s off the game clock using the full 40-second play clock each,
  when the opponent is out of timeouts; victory formation viable at the 2-min warning
  with a lead + ball).

Grounded in the actual sim code: `js/engine/situations.js` (the whole file —
`resolveSituation`, `getEffectivePlan`, the 11 situation keys, tempo presets) and
`js/engine/sim.js` (`fourthDownDecision` ~2429, `pickPlayType` ~2363, the kneel/spike
block ~2581, the tempo/timeout/clock-elapsed block ~3553, `fourthDownIsMoment` ~4238).
Constants in `js/constants.js` (`CLOCK_RUN` 29s, `CLOCK_PASS` 23s, `TEMPO_MULT`
Chew 1.25/Hurry 0.72, `TIMEOUT_RUNOFF_SAVED` 25, `HALF_SECONDS` 1800, `TIMEOUTS_PER_HALF` 3).

No probe exists yet for this subsystem — `tendency_probe` covers play-calling lean only,
and `stat_realism` has **no situational split** (no plays/game, no clock-realism, no
4th-down or kneel metric). Naming the missing probe is part of each finding below.

## What the game gets RIGHT

- **Situation classification is real and shared.** `resolveSituation` sorts every snap
  into 11 keys (goal_line, backed_up, two_min_trail, four_min_lead, red_zone,
  third_short/medium/long, second_long, first_ten, base) from down/distance/field/margin/clock,
  and both offense and defense read the same field zone with the margin frame flipped.
- **Per-situation gameplans.** `getEffectivePlan` overlays a situation cell (formations,
  tendency, pass depth, tempo, blitz, coverage) on the base plan — a coach really can
  call the red zone differently from third-and-long. Old saves with no cells resolve
  identically (the `?? ` chain).
- **4th-down decision is genuinely modeled.** `fourthDownDecision` builds a go-probability
  from distance buckets (≤1yd 0.55 → 7+yd 0.04), modifies by field zone (midfield ×1.5,
  own-territory ×0.4, plus-territory ×1.4), a coach approach dial (Conservative 0.6× →
  Very Aggressive 1.6×), and game state (trailing+late ×2/×3, trailing+very-late floored
  ~0.85 on short yardage, leading+late ×0.35/×0.15), then picks FG (range-gated by kicker
  leg + maxFGDist) or punt. Fake punt/FG layer and a player "ask" path both exist.
- **Kneel and spike exist.** Victory-formation kneel (leading, 2nd half, `clock ≤ 42×(4−down)`)
  and the trailing-team spike (≤8 down, ≤25s, past midfield) are both implemented and logged.
- **Tempo is a real clock lever.** Chew (×1.25 runoff) / Normal / Hurry (×0.72), with
  `SMART_AUTO_TEMPO` auto-selecting Hurry when trailing in 2 min and Chew when leading in
  4 min. Hurry also drives fatigue.
- **Automatic timeouts.** A trailing team late (≤120s, 2nd half) burns a timeout to stop
  the clock on the opponent's runs; the player can also arm a manual timeout.
- **Play-calling shifts by situation.** `pickPlayType` adds +0.30 pass on 3rd-and-7+,
  −0.25 on 3rd-and-short, +pass trailing-big-late, −pass leading-big-late. `tendency_probe`
  confirms this is honored and monotonic.

## What the game UNDER-MODELS / gets WRONG (gap-first)

### 1. Clock-stopping events are NOT modeled — the clock drains the same on every play (biggest gap)
`sim.js:3579` computes elapsed as `randNorm(CLOCK_PASS.mean=23 | CLOCK_RUN.mean=29, sd) × tempoMult`
and subtracts it unconditionally at 3606. There is **no branch** for the three things that
actually govern endgame clock, all of which the sources center:
- an **incomplete pass stops the clock** (Take-a-Knee: incompletions "stop the clock,
  leaving an extra 40 seconds"). In the sim an incompletion still burns ~23s.
- a ball-carrier **out of bounds stops the clock**. Not modeled at all.
- the clock stops briefly on a **first down** (college rule) / on a change of possession.

Consequence: a two-minute drill in the sim drains real time on incompletions, so a hurry-up
offense can't actually preserve clock the way the tempo key implies, and a leading team's
clock math is too generous in the other direction. This is the single highest-leverage
situational gap because it's the mechanic every clock source describes.
**Probe: a new `clock_realism_probe`** — measure avg game seconds consumed per incompletion
vs completion-inbounds vs run, and plays-per-game, against the ~23s/pass–29s/run model.
**stat_realism risk: LOW-MODERATE.** Fewer seconds on incompletions ⇒ more plays/game and
possibly more points; must re-check plays/team (65-74 band) and points (22-32).

### 2. The kneel burns the wrong number of seconds
`sim.js:2584` burns `min(clock, 42)` per kneel and only kneels once
`clock ≤ 42×(4−down)`. The real number (AmFootballDB): a kneel drains the **full 40-second
play clock plus the ~1–2s snap**, and three kneels run off **~120s (~40s each)** when the
opponent has no timeouts. The sim's 42 is roughly right for the play-clock portion, but:
- it does not account for opponent **timeouts** — a defense with 3 TOs can stop the clock
  after each kneel, so three kneels then drain only ~4–6s each, not 42. The sim kneels as if
  the opponent can never stop it.
- the gate `42×(4−down)` assumes a clean 42/play with no stoppage, so a leading team enters
  victory formation too early against a team holding timeouts.
**Probe: extend `clock_realism_probe`** — kneel seconds burned vs opponent timeout count.
**stat_realism risk: NONE** (endgame-only; doesn't touch the aggregate bands).

### 3. Two-minute play-calling ignores the sideline / clock-conservation read
`pickPlayType` shifts pass RATE by score+time, but a real two-minute offense also biases
toward **routes that get out of bounds** to stop the clock, and the trailing team throws
underneath-and-out, not just "more pass." The sim has passDepth but no "sideline/OOB" bias
in `two_min_trail`, and (per gap #1) no OOB clock-stop to reward it even if it did.
**Probe: `clock_realism_probe`** OOB-rate split by situation (needs gap #1's OOB model first).
**stat_realism risk: LOW** (a depth/target-location nudge inside an already-in-band pass game).

### 4. The 4th-down aggression curve is close but not analytics-anchored
`fourthDownDecision`'s base go-rates (4th-and-1 0.55, and-2 0.40, and-3–4 0.22) sit *below*
the modern-analytics break-even: real 4th-and-3 converts ~45% and already beats a punt from
own-42 by EP (+3.15 vs +1.65). The sim's own-territory ×0.4 penalty compounds this — a
correct midfield 4th-and-short go is discounted twice. The curve is directionally right and
tuned for a college-realism feel, so this is a **calibration** question, not a dead system.
**Probe: a new `fourth_down_probe`** — go/FG/punt rate by (distance × field zone × margin ×
clock) vs the EP surface. **stat_realism risk: MODERATE.** More 4th-down gos ⇒ more
possessions extended ⇒ points/plays can drift; the aggregate bands are the veto.

### 5. FG range gate is a hard cliff, no situational stretch
`canFG = fgKickDist ≤ maxFGDist+17 && fieldPos ≥ 55`, `attemptFG` centers make-prob at
`46 + (leg−50)×0.22`. It's a clean model, but real teams **stretch the FG range when
trailing late** (kick the 55-yarder you'd never try in Q1) and shorten it into the wind.
No time/score stretch on `maxFGDist`. Lowest priority — the base model is sound.
**Probe: `fourth_down_probe`** FG-attempt distance split by margin/clock.
**stat_realism risk: NONE** (endgame-only).

### 6. Trick plays (flea flicker / reverse / swinging gate) are not situational calls
The three Throw Deep trick sources describe *when* these fire (flea flicker vs a run-committed
aggressive defense; reverse vs over-pursuit; swinging gate as a swing-for-it look). The sim
models fakes (fake punt/FG) but has no situational trick-play call tied to defensive
run-commit or pursuit. Genuinely optional / content-flavored, and it overlaps the playbook
backlog more than the realism loop. Flag, don't force.
**Probe: none proposed** (content feature, not a stat-band mover).
**stat_realism risk: N/A.**

## Recommended fixes (priority order — smallest-change-highest-impact first)

**A. Model clock-stopping events (gap #1).** In the elapsed calc, branch: incomplete pass →
small fixed elapsed (snap + spot, clock stopped ~ the ~5-8s to the next snap-ready, then the
40s play clock is the offense's to spend); ball-carrier OOB → clock stopped; keep the run/complete
model as-is. This is the foundation the two-minute drill and the kneel math both stand on.
Re-probe with a new `clock_realism_probe` AND stat_realism (plays/team + points are the veto).

**B. Fix the kneel seconds vs opponent timeouts (gap #2).** Make the per-kneel burn respect
the trailing team's remaining timeouts (full ~40s only when they can't stop it; ~4-6s when
they can), and gate victory formation on the timeout-aware time-to-burn, not a flat 42/play.
Endgame-only, zero aggregate risk. Pairs naturally with A.

**C. Analytics-anchor the 4th-down curve (gap #4).** Nudge the short-yardage base go-rates up
toward the EP break-even and soften the double-discount on midfield own-territory shorts,
keeping the coach approach dial and game-state multipliers. Gate hard on stat_realism —
this is the one fix that can move points/plays out of band.

**D. Two-minute sideline bias (gap #3).** Once A models the OOB clock-stop, bias `two_min_trail`
target selection toward out-breaking/sideline routes. Small, depends on A.

**E. Situational FG-range stretch (gap #5).** Let margin+clock stretch `maxFGDist` late.
Small, endgame-only.

**F. Trick plays as situational calls (gap #6).** Optional/content; defer to the playbook
backlog unless the owner wants it here.

**STOP — owner picks the fixes.** No sim code changed in this pass. Suggested build order if
several are chosen: A → B (they share the clock-elapsed block), then C (isolated, highest
stat_realism risk so probe it alone), then D (needs A), then E, then F.

---

# UPDATE — fixes implemented (A, B, C, D, E; F deferred as content/playbook)

Owner picked everything. All five are in and verified. Files touched: `js/engine/sim.js`
(the kneel block, the fourthDownDecision curve, the clock-elapsed block, one new export)
and `js/constants.js` (new clock-stop / OOB / two-min / FG-stretch constants + a
mean-preserving recalibration of CLOCK_PASS/CLOCK_RUN). Four new probes:
`clock_realism_probe.mjs`, `kneel_timeout_probe.mjs`, `fourth_down_probe.mjs`,
`situational_probe.mjs`.

**A. Clock-stopping events are now real.** An incomplete pass, and a modeled out-of-bounds
ball-carrier (OOB_RATE by play family — outside runs 24%, short throws 14%, inside runs 3%),
now STOP the clock: the between-play runoff is saved (CLOCK_STOP_SAVED=14, the same mechanic
a timeout already used). Crucial calibration: the old CLOCK_PASS.mean=23 had baked in the
fact that ~43% of passes fall incomplete and stop the clock, so it was a *blend*. With the
split now explicit, CLOCK_PASS was raised to its true clock-running value (23→30) and
CLOCK_RUN 29→31, so the league mean and plays/game hold while the split becomes real.
Probe `clock_realism_probe`: incompletions burn 16.7s vs completions 28.4s; OOB ~15s vs
inbounds ~30s; plays/team 71.2 (in the 65-72 band).

**B. The kneel is timeout-aware.** Victory formation now respects the trailing defense's
remaining timeouts. A kneel burns the full ~40s play clock only when the defense can't stop
it; if they hold a timeout they spend it and the kneel burns ~2s. The gate (when a leading
team can kneel it out) uses the same timeout-aware burnable-time, so it no longer enters
victory formation too early against a team holding three timeouts. Probe `kneel_timeout_probe`:
0-TO defense → three kneels burn exactly 120s (the 2-minute-warning rule), monotonic in
timeouts (120→82→44→6), and it no longer gates at the timeout-blind 126s vs a 3-TO defense.

**C. The 4th-down curve is analytics-anchored.** Base go-rates raised toward the modern
break-even (4th-and-1 0.55→0.68, and-2 0.40→0.52, and-3/4 0.22→0.34), and the own-territory
double-discount softened (the flat ×0.4 inside the 40 became ×0.6 from the 30-40 and ×0.4
only inside the 30), so a correct midfield short is no longer discounted twice. Probe
`fourth_down_probe`: midfield 4th-and-1 68%, plus-territory 4th-and-1 97%, 4th-and-3 ~34%
(near the ~45%-convert anchor), deep-own long stays rare (2%), and the coach dial still
swings it (Aggressive 97% vs Conservative 60%). This was the highest-risk fix and it held —
stat_realism points/plays stayed in band.

**D. Two-minute sideline bias.** A trailing two-minute offense now works the boundary — its
OOB rate is doubled (capped 0.55) in the two_min_trail situation, so it stops the clock more.
Rides on A's OOB model, no new clock path. Probe `situational_probe`: two_min_trail 15.2% OOB
vs 8.4% base.

**E. Situational FG-range stretch.** A team down by ≤3 in the final ~2:30 adds FG_LATE_STRETCH=7
yards to its normal range (half that inside ~5:00); attemptFG still prices the lower make-odds
at distance, this only permits the longer attempt. Probe `situational_probe`: range 42→49yd
when down 3 at 2:00, and correctly no stretch early, when leading, or down two scores.

**F. Trick plays as situational calls — DEFERRED.** Content/flavor that overlaps the playbook
backlog more than the realism loop; not a stat-band mover. Left for a future content pass.

## Verification chain (all green)
- `clock_realism_probe` PASS (incompletion & OOB clock-stops confirmed; plays/team 71.2 in band)
- `kneel_timeout_probe` ALL PASS (120s rule + timeout monotonicity)
- `fourth_down_probe` ALL PASS (surface anchored, coach dial preserved)
- `situational_probe` ALL PASS (D two-min OOB bias + E FG stretch gating)
- `stat_realism` N=380 A-E: Points 27.0 / Plays 71.8 / Pass 249.3 / ypa 7.10 / Sacks 2.17 /
  Turnovers 1.44 — ALL IN BAND. (Rush 143.4 / Comp% 57.4 / INT% 1.66 flagged "off" but these
  are the SAME pre-existing pristine-baseline flags documented in the YAC pass — baseline run
  was Rush 145.7 / Comp% 57.3 / INT% 1.74; not regressions.)
- `tree_probe` 79/79; sim.js import-sanity OK (22 exports); esbuild engine bundle clean.

## Note on delivery
The remote-devices bridge to the owner's computer dropped mid-pass, so the full dist/ build+boot
(needs the ui/ tree) and the device-commit could not run in-session. My changes are confined to
sim.js + constants.js (ui/ untouched), which the engine esbuild bundle + import-sanity + tree_probe
cover structurally. Changed files + the 4 new probes were delivered via chat; commit to device and
the dist/ build+boot remain to be done when the bridge is back. SOURCE_LIBRARY.md should also gain
the numeric anchors used (AmFootballDB kneel math, Advanced Football Analytics / Malter 4th-down).
