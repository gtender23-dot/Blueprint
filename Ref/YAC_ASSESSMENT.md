# YAC model assessment — where the game matches real football, and where it doesn't

Checked against three YAC-analytics sources — PFF's "YAC determined by factors
before the catch" (`SOURCE_LIBRARY` #47), the NFL Next Gen expected-YAC input
spec (#48), and the air-yards split anchor (#49) — plus a WR-blocking source for
the perimeter lever (#50, Shakin The Southland "A Few Wide Receiver Blocking
Techniques", after the seeded jcfb forum thread proved JS-walled). Grounded in the
actual sim code (`js/engine/yacgeo.js` `geoYAC`, the pass resolver's catch path in
`js/engine/sim.js` ~1725-1740, the screen resolver ~1214-1264, `paBite` ~1543-1545,
`PASS_YARDS` in `js/constants.js`). Confirmed with an ad-hoc measurement probe
(geoYAC in isolation, N=4000/cell + a 60k-completion split run + a 3-scenario
sensitivity check).

**Framing (from the seed, and confirmed in code):** the broken-tackle / finish
layer is already probe-verified in-band (run-game pass, `broken_tackle_check`
targets 3-5 breaks/game). So this is NOT a "break more tackles" pass. The two real
questions are: (1) does YAC key on the right PRE-CATCH inputs, and (2) is the
air/YAC split realistic. Both have clear, measurable answers below.

## What the game gets RIGHT

- **YAC is a real after-catch physics sim, not a dice roll.** `geoYAC` spawns the
  receiver as a moving ball-carrier and up to ~8 pursuers (the beaten covering man,
  an LB/DB rally, two safety "backstops", a late "cavalry" wave at t≥1.4s), each
  with speed/accel/reaction/tackle attributes, and steps them on a 0.1s tick until a
  tackle is made. The runner reads the nearest threat and cuts. This is a genuinely
  good bones.
- **Separation at the catch is wired as the covering defender's head-start** — the
  single most important pre-catch input per PFF. `geoYAC(receiver, coveringDef,
  pursuitDefs, sep)` passes catch-point `sep`, and inside, the covering man starts
  at `y = -(0.4 + sep*3.2)`. More open → defender further behind → more room. The
  DIRECTION matches the #1 real-world finding.
- **Air and YAC are structurally SEPARATE.** Completion yards = `routeYds` (air,
  drawn from `PASS_YARDS` by depth band) + `yacYds` (geoYAC). So the ~43% anchor is
  a checkable quantity — the pieces exist.
- **Play-action does raise the YAC input.** `paBite` adds to *separation*
  (`a.separation += paBite*0.075`), which then feeds `sep` → geoYAC. So a credible
  fake → more open → more YAC. The mechanism the PFF study describes is present
  (indirectly).
- **Screens have a dedicated resolver** keying on blitz ("jackpot" vs a fired
  blitz), edge-play call, DL awareness (sniff-out), and the target's AGI + a
  tackle-break check. Screens-punish-pressure is modeled.

## What the game UNDER-MODELS / gets WRONG

### 1. The air/YAC split is far too air-heavy — YAC is ~half of what it should be (biggest gap)
The calibration anchor (#49) is **~57% air / ~43% YAC**; league-average real YAC is
**4.4 yds/reception** (#47). Measured on the actual `geoYAC`:

| assumption (sep-at-catch) | YAC / completion | YAC share of total |
|---|---|---|
| mid openness (sep~0.5) | **2.58 yd** | **20.5%** |
| every receiver wide-open (sep~0.7) | 3.28 yd | 24.7% |
| tight coverage (sep~0.3) | 1.96 yd | 16.4% |

Even under the most generous assumption the sim clears only ~25% YAC and ~3.3
yd/reception — well short of 43% / 4.4. This is robust to the sep mapping I assumed
(the whole point of the 3-scenario sweep). The pursuit geometry simply doesn't let a
runner accumulate real-world YAC. **Probe gap:** `stat_realism_harness` reports pass
yds / comp% / ypa / WR yds — but **never segments air vs YAC**, so this anchor is
currently UNMEASURABLE by the shipped suite. Any fix here needs a new split probe
first.

### 2. Separation's effect on YAC is too weak AND saturates early
PFF: wide-open receivers "spike" (big-YAC plays); tightly-covered ones "almost never
get more than three yards." The sim gets the floor roughly right but has almost no
ceiling. Measured mean YAC by separation (N=4000/cell):

| sep | mean YAC | p90 | share > 10 yd |
|---|---|---|---|
| 0.10 | 1.71 | 4 | 0.6% |
| 0.25 | 1.69 | 4 | 0.4% |
| 0.40 | 2.21 | 4 | 0.5% |
| 0.55 | 3.19 | 5 | 0.4% |
| 0.70 | 3.40 | 5 | 0.6% |
| 0.90 | 3.43 | 6 | 0.5% |

Two problems: (a) the whole range spans just 1.7 → 3.4 yards, and (b) it **flatlines
above sep ~0.55** (3.19 → 3.40 → 3.43). The "share > 10 yd" — the explosive-YAC
plays PFF says separation unlocks — is a flat ~0.5% at EVERY separation. A wide-open
receiver in space should occasionally house it; here p90 caps at 6 yards. The lever
is directionally right but far too small and clips early.

### 3. Catch depth / air yards is NOT a geoYAC input (2 of 5 expected-YAC inputs are dead)
The Next Gen spec (#48) names five inputs: nearest-defender distance ✓ (via sep),
receiver speed/momentum ✓ (SPD), **catch depth / air yards ✗**, **defenders-between-
receiver-and-end-zone ✗ (partial)**, field position/direction ✗. `geoYAC` gets the
same generic rally geometry whether the ball was caught 2 yards downfield (screen-
like, blockers ahead, defense flowing) or 25 yards downfield (converging safeties,
open grass). Real YAC is HIGHER on shallow catches (room + blockers ahead) and lower
on deep ones — the sim is blind to it. The rally pool is passed but its geometry
isn't shaped by catch depth.

### 4. Screen YAC ignores separation AND has no blocking lever
PFF: screens generate the MOST YAC (except a red-zone dropoff, target yd > 80). The
screen resolver instead draws an all-in-one `randNorm(4.5, 4)` (or `9.5, 6.5` on a
blitz "jackpot") + one tackle-break — it never runs geoYAC, never keys on catch-
point separation, and has **no downfield/stalk-blocking term**. Source #50 (and
#48's aside that "downfield blocking inflates" expected YAC) says a good stalk/crack
block springs the perimeter runner and determines his cut side ("RBs cut off the
blocker's butt on the seal side"; a crack block "eliminates a playside tackler").
The offense's WR-blocking quality is a dead lever on exactly the plays (screens,
sweeps, RPO/perimeter) where it matters most.

### 5. No shallow/screen red-zone dropoff, no PA-vs-box amplification
Minor: PFF flags a red-zone YAC collapse on screens (compressed field, no grass) and
that PA raises the YAC ceiling *especially vs a 7-8 man box*. Neither is modeled —
`paBite` is box-agnostic and screen YAC is field-position-agnostic. Least essential.

## Recommended fixes (priority order)

**A. Add a YAC-split probe FIRST (prerequisite — no code change to the sim).**
Extend `stat_realism_harness` (or a new `yac_split_probe`) to accumulate air vs YAC
per completion and report YAC/reception + YAC share. Without this, every fix below is
un-veto-able — we can't prove we moved toward 43% without breaking ypa. Smallest,
highest-leverage step. Zero stat_realism risk (measurement only).

**B. Raise the YAC ceiling and un-saturate the separation lever.** Rework the geoYAC
pursuit so an open runner in space can break contain: widen the rally's initial
spacing as a function of sep (open → pursuers start further/wider), and don't let the
separation head-start clip at midrange. Target: mean YAC ~4.4 and a live explosive
tail (share > 10 yd climbing with sep). **stat_realism risk: HIGH** — this lifts
total pass yards and ypa directly. Must re-run the split probe AND the ypa/pass-yds
bands together; likely pairs with trimming `PASS_YARDS` air means slightly so ypa
holds while the *composition* shifts toward YAC (that's the whole realism point).

**C. Feed catch depth into geoYAC.** Pass `passDepthKey` (or air yards) so shallow
catches get more room/blockers-ahead and deep catches get converging help. Makes
inputs 3-4 of the expected-YAC spec live. **stat_realism risk: MEDIUM** — shifts YAC
by depth band; net ypa effect depends on calibration, re-probe required.

**D. Give screens a real separation + blocking lever.** Route screen YAC through (or
toward) the geoYAC model, keyed on catch-point openness, and add a WR-blocking term
(offense WR STR/AWR/TEC vs the force defender) that springs perimeter YAC and can set
the cut side. Add the red-zone dropoff. **stat_realism risk: MEDIUM** — screens are
a minority of attempts, but a blocking multiplier can add explosives; re-probe.

**E. PA-vs-box + red-zone polish.** Amplify `paBite`'s YAC contribution vs a loaded
box; compress screen YAC inside the 20. Smallest impact, do last. **Low risk.**

> Note per charter: fixes B-E each need a probe proving the new behavior AND a
> `stat_realism` run (with the new split metric from A) proving ypa / pass-yds /
> comp% stay in band. Blogs describe the ideal; the probe is the veto.

---

# UPDATE — all five fixes implemented (owner: "all of it", 2026-08-05/06)

All of A–E are in and verified. New probe `tools/yac_split_probe.mjs` is the veto
instrument (Fix A); it decomposes each completion's yardage into air vs YAC **without
changing how the game books stats** — `result.yards` is still `air + YAC` and every
yard still counts as passing/receiving yardage (the sim records `play.yards` whole).
The probe only reads read-only `result.airYds` / `result.yacYds` instrumentation
attached at each completion site.

**The number that mattered — YAC/reception:**

| metric | baseline | after A–E | real anchor |
|---|---|---|---|
| YAC / completion | 3.30 | **4.39** | ~4.4 (PFF) ✓ |
| YAC share of pass yds | 25.4% | **32.8%** | ~43% (see note) |
| explosive tail (YAC > 10) | 2.1% | **4.1%** | ~8–12% (see note) |
| by-band YAC/comp | flat ~3 | short 4.86 / med 4.10 / deep 3.90 | shallow > deep ✓ |
| screen YAC/comp | 6.44 | 6.29, + live blocking lever | highest ✓ |

**A. YAC-split probe.** Added. Baseline captured (25.4% / 3.30), used to veto B–E.

**B. YAC ceiling + un-saturated separation (`yacgeo.js`).** Openness at the catch now
sets the runner's daylight, not just the beaten corner's head-start: the rally spawns
downfield in proportion to `open`, the runner brakes only for a threat genuinely in his
PATH (not any nearby man, which was the saturation), a missed tackle in space barely
slows him, a trailing pursuer can actually lose the race, and a **breakaway gate**
(open grass + a speed edge + finish) removes the corralling cavalry so the explosive
tail can form. Plus a small `PASS_YARDS` air trim (medium 10→9, deep 20→19, vdeep
38→37) so the *composition* shifts toward YAC while ypa holds. Result: YAC/comp
3.30→4.39, tail 2.1%→4.1%, and the body of the distribution matches real football
(median 4). **Veto: ypa 7.14, pass yds 256.6, sacks 2.19 — all in band.**

**C. Catch depth into geoYAC.** `passDepthKey` now passed in; shallow catches get a
runway (blockers ahead, defense flowing), deep catches get converging help. The
depth gradient is now real: short 4.86 > medium 4.10 > deep 3.90 YAC/comp. Veto held.

**D. Screen separation + blocking lever + RZ dropoff (`sim.js`).** The screen resolver
now grades the blocking receivers (WR/TE STR/TEC/AWR vs the force defenders) and adds
perimeter yards for a good stalk/crack block — verified: elite WR blocking lifts screen
yards 6.00 → 6.78. Red-zone screens (fieldPos ≥ 80) collapse per PFF (field compressed,
no grass). `fieldPos` threaded to `resolvePassPlay` via one defaulted param. Veto held.

**E. PA vs a loaded box (`sim.js`).** Play-action's separation boost now scales with the
defense's run commitment — verified: vs a loaded box (runCommit +20) the fake buys ~30%
more separation (`boxBite` avg 1.30 / max 1.60), and is correctly dormant (1.00) vs a
neutral/two-high look. Veto held.

**The 43% / 8–12% note (deliberate stopping point).** YAC/reception hit its ~4.4 target
and the *body* of the distribution is now realistic. The remaining gap to a 43% share
and an 8–12% explosive tail is bounded by the ypa veto: the sim's total pass yardage is
already correct and ypa sits mid-band, so closing that last gap purely by cutting air
yards would push ypa **below** its 7.0 floor — trading a passing band that's correct for
a composition number with no in-game consequence. The YAC *yardage* is what gameplay
feels, and it's now right. Chasing the last points of share/tail is left as a future
knob if the ypa floor is ever revisited.

**Full verification chain:** `yac_split_probe` (YAC 4.39, all in band) · `stat_realism`
(ypa 7.14 / pass yds 256.6 / sacks 2.19 / pts 28.1 / TO 1.40 — all in band; Comp% 57.0,
Rush 147.6, INT% 1.63 flagged but **pre-existing, not regressions** — pristine baseline
shows identical) · build 11/11 sanity PASS · boot 0 pageerrors · tree_probe 79/79 ·
ui_playcall_smoke RUNG 6 PASS · watchphys_probe + coverage_monotonicity flags confirmed
pre-existing on unmodified code.

**Files touched:** `js/engine/yacgeo.js` (Fix B+C), `js/engine/sim.js` (instrumentation +
Fix D+E + fieldPos param), `js/constants.js` (PASS_YARDS air trim). New probe:
`tools/yac_split_probe.mjs`.
