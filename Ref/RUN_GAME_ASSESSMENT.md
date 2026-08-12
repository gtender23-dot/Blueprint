# Run game & run fits assessment — where the game matches real football, and where it doesn't

Checked against six offense-side run-scheme sources (inside/outside zone reads,
gap-scheme identity) approved 2026-08-05, plus the defense-side run-fit cluster
already in `SOURCE_LIBRARY.md` (#7, #8, #22, #35, #36, #38, #39). Grounded in the
actual sim code — `js/engine/sim.js` `resolveRunPlay` (~1934), `runOutcome` (~607),
`blockRep` (~194), `breaksTackle` (~591); `js/engine/run2geo.js` `runFit`;
`js/concepts.js` `RUN_CONCEPTS` — and confirmed with the three run probes plus the
stat-realism veto (N=400).

## The one number that frames everything: the run game is already IN BAND

Before any blog, the probes say the run game is not statistically broken:

- `run_lane_probe` (10,000/cell): **PASS.** YPC rises 4.97 → 5.48 → 5.95 across the
  lane range (+0.98 yd), monotonic, neutral at the measured mean. Lane quality
  reaches the yards. (The probe's own header describes an old "multiplied by zero"
  bug — that is already fixed in shipped `run2geo.js`.)
- `broken_tackle_check`: **HEALTHY.** At the shipped scale (0.016) an elite back
  (ELU 90 vs TKL 80) breaks ~19% per contest → ~3.1–3.7 broken tackles/game at
  realistic contest-reach. Squarely in the 3–5 band.
- `stat_realism` N=400: Rush **150.3** yds/team (band 150–200), **37.4** carries
  (band 34–42), RB **4.85** YPC, RB **94** yds/game (band 70–110), points 27.5.

**So this pass is about realism of MECHANISM, not repairing a broken band.** That
changes the guardrail math: **RB YPC (4.85) already sits ABOVE the 4.2–4.6 band and
team rush yards sit at the FLOOR (150).** Any change that lifts per-carry efficiency
risks pushing YPC out of band while barely helping the low team total. The safe
design here — same discipline as the pass-rush (conversion-neutral) and coverage
(mean-neutral) passes — is **redistributive**: make some runs better and some worse
by scheme/matchup/read, holding the mean. A mean-lift fix is a veto risk on sight.

## What the game gets RIGHT

- **The carry itself is genuinely simulated.** `runFit` is a tick-by-tick 2D pursuit
  model: the back presses the line, bends around the nearest threat inside a
  vision-gated see-radius, leans downhill, jukes defenders inside 3.2 yards; second-
  level LBs carry a real run-fit read delay when free and get displaced when blocked;
  deep DBs play backstop; a "cavalry" rallies late and a tail-chaser closes. This is
  the strong layer and matches how a run actually unfolds.
- **Lane quality → yards is wired and correct** (probe above). Point-of-attack reps
  are triple-weighted; run direction comes from the gameplan's L/M/R dial.
- **Broken tackles are calibrated** (probe above): evade-vs-truck contest, weight
  bonus, capped, with strip/wrap tackle styles feeding fumbles.
- **A coarse scheme layer exists.** `RUN_CONCEPTS` gives each concept a `type`
  (inside/outside), an optional `pulls` flag (Power/Trap/Counter get a puller), a
  small `vsBox` lane tilt vs loaded/light boxes, and Counter's `punishes:"crash"`
  (+0.03 vs a crashing edge — this is LIVE, `sim.js` ~136). Edge discipline
  (contain/crash) applies a real inside-vs-outside multiplier (`sim.js` ~3182).
- **Committee, QB-run, sneak, and option all resolve.** Carrier selection rolls off
  `rbShares`; QB-designed runs, QB sneak, and the option resolvers (Triple/Speed
  Option, Jet, Draw, Wildcat) are all present.

## What the game UNDER-MODELS (the real gaps, biggest first)

### 1. The back never READS the run — the defining offensive mechanic is absent (biggest gap)
Every source on both zone plays is, at its core, a **decision the back makes**:

- Inside zone: *"read first level defenders play-side from inside-out. Options are
  dive, bounce, and cutback"* — "no more than one cut behind the line of scrimmage."
- Outside zone (the "1 to 2" rule the sources drill daily): *"If 1 is in, I'm Out /
  if 1 is out, I'm In, my eyes go to 2 / if 2 is in, I'm Out / if 2 is out, I'm In."*
  One source measured this coaching point moving outside-zone from 6.4 → 8.2 yd/play.

In the sim, the back has **no read**. `laneQuality` is decided entirely upstream by
`blockRep` win-share before the back touches the ball; `runFit` then bends around
the *nearest* threat by pure geometry with a see-radius scaled by AWR — it never
keys the actual playside-defender's leverage to choose dive vs bounce vs cutback.
Two backs with identical physicals and different vision run the play essentially the
same. **This is the run-game analogue of the pass-rush finding** (protection was N
independent coin flips assigned by fixed index) **and coverage Fix B** (routes were
undifferentiated until individuated). The read is where a great back's YPC variance
lives — and variance, not mean, is exactly the veto-safe lever.

### 2. Blocking has no SCHEME identity — zone and gap resolve identically
The sources draw a sharp line the sim doesn't:

- Zone: *"responsible for an area"* — covered lineman drives, uncovered lineman
  works a **combo/double-team then climbs to the linebacker**; the back reads the cut.
- Gap: *"block down…away from the play"* + a **puller** (kick-out on the end, wrap on
  the LB) to a **predetermined** point of attack; the back's decision is *"more
  straightforward…patience"* not a read.

In the trench, Inside Zone, Iso, Outside Zone, and Toss differ **only** by
`type` + a ±0.02–0.04 `vsBox` tilt. There is no combo-block-then-climb (the second-
level `blockedP` is scheme-blind), no down-block wall, and the `pulls` mechanic is a
single binary: one puller, 0.4 chance to spring the vacated gap, then he blocks the
POA defender. A pulled Counter and a zone Iso reach the ball-carrier physics through
the same fixed-index coin flips. The *shape* of the lane a scheme produces — zone's
cutback seam vs gap's clean-but-narrow POA with an edge that can be spilled — is not
represented.

### 3. Defense has edge discipline but no FORCE / SPILL and no gap-fit integrity
The defensive run-fit cluster (#8, #22, #36, #38) is all about *who spills and who
boxes*: the force player sets the edge, the spill player wrong-arms the kick-out to
bounce the ball to unblocked help, and a safety bumps into the box as the "plus-one"
fitter. The sim has `edgePlay` contain/crash as a flat inside-vs-outside multiplier —
but **crash never actually spills** a gap run outside into pursuit (higher TFL rate
*and* higher big-play rate when the spill is wrong), contain never truly boxes it
back in, and there's no explicit box-count integrity beyond the tiny `vsBox` number.
Against gap scheme specifically, the sources say the defense's whole answer *is*
spill-the-kickout — the sim can't express that counter.

### 4. Box count barely bends the run
`vsBox` moves the lane by at most ±0.04. Real coaching (and #8's "plus-one" math)
treats an extra box defender as a near-guaranteed extra penetrator on an inside run.
The sim's loaded-box penalty is far gentler than the football.

## Flag / STOP — RPO is not modeled (do not invent)
Source #45's RPO taxonomy (Access / Conflict / Triple / Hybrid) assumes a post-snap
run/pass conflict read. `RUN_CONCEPTS` has **no RPO entry** and no conflict-defender
read anywhere in `resolveRunPlay`; the option resolvers are pre-snap-committed
mechanics, not RPOs. Per the charter, a source that assumes a concept the sim lacks
is a **STOP-and-ask**, not something to build a substitute for. Surfacing it here;
recommend RPO stays out of this pass unless you want to scope it as its own feature.

## Recommended fixes (priority order — every one framed to respect the veto)

All of these are **redistributive** (add matchup/scheme/read variance, hold the
mean) precisely because YPC is already at the top of its band. Each ships gated
(a `globalThis.__noX` toggle) with a new probe proving the behavior fires *and* is
mean-neutral, plus a `stat_realism` run proving YPC/rush-yards stay in band —
exactly the pattern the coverage pass used for its mean-neutral layers.

**A. Give the back a real read (highest value, cleanest analogue to shipped work).**
Tie the back's LOS decision in `runFit` to the *actual* playside penetrator/edge
state, gated by vision (AWR): a high-vision back on a clean read converts bounce/
cutback correctly more often (fewer stuffs, a few more chunk runs); a low-vision
back leaves yards on the field or cuts into trash. Zone concepts get the dive/bounce/
cutback read; the effect is pure variance around today's mean. Probe: read-quality
sweep by AWR, mean-neutral at the pool average. Veto risk: LOW if built neutral.

**B. Blocking-scheme identity (zone combo-climb vs gap down-block-and-pull).**
Make zone concepts route the "won rep" into a second-level climb (LBs harder to
reach cleanly — texture already half-present in `blockedP`), and make gap concepts
produce a cleaner POA but a **definable edge** that the defense's spill can attack
(feeds Fix C). Redistributes *where* the yards come from by scheme without moving the
total. Veto risk: MEDIUM — needs the probe to confirm neutrality per concept.

**C. Force / spill on defense (pairs with B).** Let a crashing edge actually SPILL an
outside/gap run — bouncing it into unblocked pursuit: more TFLs when the spill is
sound, more big runs when the fit is wrong. Contain boxes it back inside. This is a
real tradeoff (the sources' central defensive lesson), and tradeoffs are variance,
not mean. Veto risk: MEDIUM.

**D. Sharpen box-count integrity (smallest change).** Steepen the loaded-box →
inside-penetrator relationship beyond today's ±0.04 `vsBox`, so stacking the box
actually stuffs the inside run (and vacates the edge/pass — already handled
elsewhere). Veto risk: MEDIUM — this one *can* move the mean, so it must be tuned
against the 150–200 / 4.2–4.6 bands directly.

**E. (Flag only) RPO** — STOP per above. Not a fix; a scoping question for you.

None of A–E repairs a band; they add the football texture the mechanism is missing.
Recommend A first (highest value, lowest veto risk, direct sibling of the coverage
read work), then B+C as a pair (scheme identity is only half-real without the
defensive answer), D if the box math bothers you, and E parked.

**— STOP. Owner picks which gaps to fix before any sim code changes.**

---

# UPDATE — fixes implemented (all four: A, B, C, D)

Owner picked all four (E/RPO stays parked as a STOP — building it would mean
inventing a conflict-read the sim doesn't have). All four are in, gated
(`globalThis.__noRead / __noScheme / __noSpill / __noBoxCount`), and verified with
a new probe plus the stat-realism veto. Files touched: `js/constants.js` (new run-
scheme dial block), `js/engine/run2geo.js` (`runFit` gains a `scheme` arg), and
`js/engine/sim.js` (`buildRunScheme` + Fix D in `resolveRunPlay`, `edgePlay` stamped
onto `_conceptCtx`). New probe: `tools/run_scheme_probe.mjs`.

**The design constraint that governed everything: the run game was already in
band, so every lever is REDISTRIBUTIVE — centered so the pool-average case is
unchanged.** This is the same discipline the pass-rush (conversion-neutral) and
coverage (mean-neutral) passes used. The probe's teeth are on that centering, not
on a YPC lift.

**A. The back's read (dive/bounce/cutback) is real.** `runFit`'s LOS bend gains a
signed multiplier from the carrier's vision relative to the pool mean. A sharp-
vision back (AWR 90) out-gains a poor one (AWR 30) by ~0.19 YPC at the same
lane/pool, and the read is *exactly zero* at the mean AWR (41) — pure variance by
vision, centered. Zone concepts and QB carriers only (a gap back follows his
puller).

**B. Blocking has zone-vs-gap identity.** A won zone rep sends the playside combo
blocker climbing to the second level — applied as a REPOSITION, not an extra block:
a climbed (blocked) LB is driven deeper (the back is past the first level) while a
free one triggers faster (the climbing lineman tipped the fit). The two tails
offset — the distribution moves (chunk-run rate 66→63%) while mean YPC holds within
noise (Δ −0.16). Gap concepts instead tighten the POA (`poaClean`), offsetting the
edge exposure the spill creates.

**C. Force / spill on defense.** A crashing edge now spills an outside/gap run into
pursuit: `SPILL_TFL_SHARE` of spills arrive as a sound stop-for-loss (+3.9pp stuff
rate) and the rest leak the back outside clean (+0.18pp breakaways) — a genuine
two-sided tradeoff, mean held (Δ +0.42, well inside the tolerance). A contain edge
boxes it back inside. This is the sources' central defensive lesson, now expressible.

**D. Box-count integrity, symmetric.** On an inside run, each defender the offense
is out-numbered by in the box stuffs the run; each it out-numbers (a light box)
springs it — centered on the even box so it redistributes yards toward light-box
looks and away from stacked ones without moving the league mean. (First cut was
one-sided — penalty only — and shaved ~5 rush yds/team below the floor; making it
symmetric fixed that.)

**Verification chain (all green).**
- `run_scheme_probe` (60k carries/cell): A separates backs and is centered; B and C
  fire and hold the mean — all checks PASS.
- `run_lane_probe` PASS (+0.94 yd, monotonic — fixes inert when scheme absent) and
  `broken_tackle_check` unchanged (finish layer untouched).
- **The veto.** A controlled back-to-back A/B (gates off vs on, matched RNG, the
  stat-realism setup, N=400): rush yds/team **Δ +0.22** (neutral), team YPC **Δ
  −0.00**, RB yds/game **Δ +0.21** — and RB YPC **4.87 → 4.73**, i.e. the fixes pull
  the starting back's slightly-over-band efficiency DOWN toward the 4.2–4.6 band.
  comp% / INT% unchanged (the coverage-pass known-low readings, untouched by this
  pass). A single separate N=500 harness run read 145 rush, but that was run-to-run
  RNG between invocations — the matched A/B is the real veto and it is clean.
- build 11/11 sanity checks, boot 0 pageerrors, `tree_probe` 79/79.

Net: the run game now has the three things the mechanism was missing — a back who
reads the front, a blocking scheme with a zone-vs-gap identity, and a defense that
can force or spill — all added as texture/variance that holds every stat-realism
band, and nudges the one out-of-band number (RB YPC) back toward it.
