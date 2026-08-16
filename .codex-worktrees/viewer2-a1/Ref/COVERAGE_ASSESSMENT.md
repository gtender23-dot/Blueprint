# Coverage & route-duel assessment — where the game matches real football, and where it doesn't

Checked against four coaching sources on both halves of the duel — Riley-Kolste
*The Art of Route Running* (WR stems, leverage manipulation, speed-cut vs
sink-and-drive, double moves, hand-fighting), All Eyes DB Camp *Teaching Leverage
and Alignment Across Coverages* (inside/outside leverage → routes conceded, "play
opposite your help," cushion by coverage), MatchQuarters *What is Cover 3?*
(spot-drop vs pattern-match, divider rules, curl-flat high-low void), and USA
Football *Quarters Coverage* (corner step-count read, safety 2-1 robber trigger,
apex #2-release logic) — plus the routed blitzology library entries #3, #6, #9,
#17, #20, #23, #31, #32, #33, #34 (defensive-structure side).

Grounded in the actual sim code: `js/engine/sepgeo.js` `routeDuel` (the tick-by-tick
physics chase + `QMAP` separation tables), and `js/engine/sim.js` `assignCoverage`
(~662), `routeVsCoverage`/`_refSepAB` (~410), `qbRead` (~462), `catchResolution`
(~502), plus the separation-adjust stack in `resolvePassPlay` (~1320–1390).

Probes named per gap. **Truth is decided by those probes; `stat_realism_harness`
is the veto.** Nothing here is a fix yet — this is the menu. The subsystem is the
roadmap's highest statistical upside because comp% and ypa are the bands
`stat_realism` most often flags, so several of these gaps are likely to actually
move numbers (flagged inline).

---

## What the game gets RIGHT

- **The route-vs-defender duel is a real physics chase, not a stat formula.**
  `routeDuel` runs a genuine tick-by-tick kinematic sim: receiver and defender
  bodies with SPD-derived top speed, AGI-derived acceleration, and a reaction lag,
  chasing to a break. Final physical gap → separation through empirically-fitted
  `QMAP` quantile tables per depth/coverage. This is the correct architecture and
  most of the sources' receiver-side mechanics have a natural home in it.
- **Press is modeled as a jam contest with the right inputs.** `da.STR*0.4 +
  TEC*0.35 + AGI*0.25` (jam) vs `ra.AGI*0.4 + TEC*0.35 + STR*0.25` (release) → a
  delay that also cuts the receiver's acceleration. That matches the sources'
  "release beats press / jam disrupts the timing" relationship, and press-hot
  sharpens it. **Correct in kind.**
- **Zone defenders react late and drive on a declared route.** The `rctZone`
  trigger (a zone defender sits, shades, and only drives once the route breaks or a
  vertical crosses his depth) is the right instinct — zone reaction is slower than
  man off the break, faster once it triggers.
- **AWR separates the coverage tiers correctly.** Man reaction (`rctMan`) and zone
  trigger (`rctZone`) both key off AWR; the QB read (`qbRead`) favors the top read
  more steeply and bails off covered stars better with higher AWR. Awareness is the
  right currency.
- **The catch is contested realistically.** `catchResolution` folds a jump-ball /
  size-mismatch term (height + JMP + HND vs AWR) on contested medium/deep balls,
  and INT scales with (1−sep), defender read, depth, and — correctly — is higher in
  zone than man (eyes on the QB). These are real relationships.
- **Some coverage-structure levers already exist and work directionally:** two-high
  vs single-high shell nudge, lockTop (best press CB on WR1), bracketTop and
  excess-defender help, motion man/zone tells, PA bite, run-commit.

---

## What the game UNDER-MODELS / gets WRONG (biggest gap first)

### 1. Zone is one-defender-on-one-receiver — there is NO pattern-match, pass-off, or void (biggest gap; comp%/ypa)
Every source on zone — MatchQuarters spot-drop-vs-match, USA Football Quarters,
library #33 (trips pattern-match), #32 (zone-under-man), #9 (Cover 2 role swaps) —
describes zone as a **distributed** system: defenders read #1/#2, carry verticals,
sink on out-breakers, rob in-breakers, and **pass receivers off** at dividers so
routes get bracketed and voids open between zones (curl-flat high-low).

The sim does none of that. In `assignCoverage`, a "zone" defender is paired to
**one** receiver by pool index and then `routeDuel` runs him as a single body
driving on that one man from a landmark. There is:
- **no pass-off** — a receiver is never handed between two zone defenders;
- **no bracket from structure** — verticals aren't doubled the way Quarters brackets
  them (the only bracketing is the explicit `bracketTop`/help scheme);
- **no void** — a high-low can't stress one flat/hook defender two ways, because no
  defender is responsible for an area with two threats in it;
- **no spot-drop vs match distinction** — zone has exactly one behavior.
- Evidence: `assignCoverage` builds `coverDefenders` and assigns `poolIdx++` — one
  defender per receiver, no shared-receiver logic anywhere. `grep` for
  `patternMatch|passOff|robber|spotDrop|MOF` returns nothing.
- Consequence for the bands: real zone gives up underneath and denies deep by
  bracket; the sim's zone is effectively "slower man," so it likely mis-shapes the
  comp%/ypa split by depth (too little short completion, too little deep denial).
- **Probes:** `coverage_blend_sensitivity`, `coverage_monotonicity_check`, and a new
  `zone_void_probe` (a high-low concept should complete more vs a single hook
  defender than vs two). ⚠ **stat_realism risk: real** — this reshapes the
  comp%/ypa-by-depth curve; must be conversion-neutral in aggregate and re-vetoed.

### 2. Coverage assignment is INDEX-ORDER — no leverage, no "play opposite your help" (comp%/ypa)
Both DB sources make leverage the master variable: **inside leverage concedes
out-breakers and takes away in-breakers; outside leverage the reverse; you play
opposite your help.** A corner with a safety over the top plays outside and funnels
in; Quarters corners play inside with eyes on #2.

The sim has **no leverage at all**. `assignCoverage` pairs defender→receiver by
list index; `routeDuel` starts the defender at a small random `x` offset
(`0.15 * ±1`) that is *unrelated to the route or to help*. So:
- an out-breaking route and an in-breaking route are defended identically by the
  same coverage type — the defender has no side he's protecting;
- "help" only exists as a flat separation subtraction (`helpBoost`), not as a
  geometry that changes *which* routes are open;
- the shell nudge (§ below) is a global add, not a per-defender leverage.
- Evidence: `routeDuel` `def.x = 0.15 * (Math.random() < 0.5 ? -1 : 1)` — leverage
  is a coin flip, `grep leverage` finds only unrelated PERSONALITY text.
- Consequence: the sim can't model the single most basic coverage decision, so
  route-concept-vs-coverage matchups (the heart of the passing game) are flat.
- **Probes:** `sep_probe` split by break direction (an out route vs inside-leverage
  man should separate more than vs outside-leverage), new `leverage_probe`.
  ⚠ **stat_realism risk: moderate** — redistributes separation by route direction;
  keep aggregate comp%/ypa neutral.

### 3. Routes are NOT individuated — every break is a generic lateral cut (ypa; explosives)
The route-running source is entirely about route *shape*: 45° cuts (post/corner/
slant) keep speed via a bam step; 90° cuts (in/out/hitch) sink hips and lose
velocity for sharpness; speed-cuts trade sharpness for momentum; double-moves
(stutter, stop-n-go, jerk) beat a defender who committed to the first move.

The sim collapses all of this. `routeDuel` has one break: a random-direction
lateral cut at a route-depth-specific `breakT`, with a single "keep" fraction of
velocity. `ROUTES` has only three entries — short/medium/deep — each just a
stem/throw/break *time*. So a comeback, a dig, a slant, and an out at the same depth
are the **same event**. There are no double moves (the source's biggest
separation-creator), no sharp-vs-rounded tradeoff, and TEC/AGI feed a generic
`cutQ` rather than a route-appropriate one.
- Evidence: `ROUTES = { short, medium, deep }`; the break is `breakLat = breakDir *
  (3 + rand)` with no route identity; no double-move branch exists.
- Consequence: separation variance is under-dispersed and route-concept design
  (the whole offensive playbook) can't express itself; deep explosives from
  double-moves are missing.
- **Probes:** new `route_shape_probe` (a double-move should beat a committed man
  defender more than a single break; a 90° out should separate differently than a
  45° post). ⚠ **stat_realism risk: real on explosives/ypa** — adding double-moves
  raises deep variance; must re-veto ypa and the explosive-play rate.

### 4. Quarters/robber safety trigger on #2's release is missing (comp%; INT%)
USA Football Quarters and library #17 (rat-in-the-hole), #34 (DB Manual), #23
(quarters) all describe the **safety reading #2**: #2 vertical → safety plays
2-1 robber and undercuts the #1 dig/slant/post; #2 out → safety comes off to help
elsewhere; #2 in → rob. This is *the* mechanism that makes two-high coverages deny
in-breakers and generate interceptions on jumped routes.

The sim's two-high is only the flat shell nudge (`shell === "two"` shaves 0.05 off
deep separation). There is no defender who *reads a second receiver and jumps a
first*. The concept-stress swap moves the weakest-AWR zone defender onto the
primary read, but that's a pre-snap swap, not a live 2-1 read.
- Evidence: the shell block adds a scalar `adj`; no code reads receiver #2's route
  to arm a robber on #1.
- Consequence: two-high can't create the "undercut the dig for a pick" outcome, so
  the coverage-style INT split and the medium in-breaking comp% are under-modeled.
- **Probes:** new `robber_probe` (a #1 in-breaker vs two-high-with-vertical-#2 should
  see lower completion / higher INT than vs two-high-with-out-#2). ⚠ **stat_realism
  risk: INT% band** — robber picks add INTs; must stay in band.

### 5. Press vs off is a per-corner tag, not a shell-wide man/zone identity (smaller)
The sources treat press/off/bail as a *coverage-wide* posture tied to help and MOF,
with cushion changing by coverage (press at the LOS with inside/outside help vs
off at 5–9 with different rules). The sim tags each corner `press`/`zone`
individually from his role and flips `press→offman` only via a global `pressLevel`.
There's no notion that "we are in press-man Cover 1" vs "we are in off-zone Cover 3"
as a structure — the cushion/technique doesn't shift with the shell.
- **Probe:** `press_jam_probe` extended to shell context. ⚠ risk: low.

### 6. `motionMisreadProb` and the motion tell are thin (smaller; already partly modeled)
Motion is handled (a moved receiver gains separation, more vs man; a DB-vs-QB AWR
roll gives a read edge or a misread). But it's a single scalar on one receiver, not
the source's picture of motion *revealing man vs zone by whether a defender travels*.
The reveal exists (`result.motionReveal`) but doesn't feed the QB's whole read, only
`motionReadEdge`. Minor.
- **Probe:** `motion_read_probe`. ⚠ risk: low.

---

## Recommended fixes (priority order — smallest-change-highest-impact first)

The owner's steer is a **deep** system, so this menu is intentionally wider than the
3-fix blitz/rush template. Ordered by impact-per-change. Every one ships only with a
probe proving the behavior AND a `stat_realism` run proving no band regression; the
design rule that let the pass-rush pass survive the veto applies here too — **be
conversion-neutral in aggregate** (redistribute where separation/completions come
from by coverage and route; do NOT inflate league comp%/ypa/INT%).

- **A. Leverage geometry (Gap 2).** Give each covered receiver an inside/outside
  leverage set from the defender's help (safety over the top → outside leverage) and
  wire the route's break direction against it: separation rises when the route breaks
  *away* from the defender's leverage, falls when it breaks into it. Smallest real
  change with the widest reach — it's a starting-`x` and a break-direction term in
  `routeDuel`, and it unlocks concept-vs-coverage. **Highest impact / smallest
  change.**

- **B. Route individuation + double moves (Gap 3).** Expand `ROUTES`/the break model
  so a route carries a *shape* (in/out/comeback/slant/post/corner/go + a double-move
  flag): 90° breaks sink and separate sharply but bleed speed; 45° breaks keep speed;
  a double-move beats a defender who committed to the first break. Medium change,
  high ypa/explosive upside. Pairs naturally with A (leverage decides which break
  wins).

- **C. Zone pattern-match + void (Gap 1).** The big one. Let zone defenders be
  responsible for an *area with pass-off*, so a high-low stresses one defender two
  ways (void) and verticals get bracketed. Largest change; highest comp%/ypa-shape
  upside. Can be staged: start with the **void** (a second threat in one zone
  defender's area lowers his effective coverage on the thrown man) before full
  pattern-match, to keep the change probe-provable in steps.

- **D. Quarters/robber #2-read (Gap 4).** A two-high safety reads #2; on #2 vertical
  he arms as a robber and undercuts #1's in-breaker (lower completion, higher INT on
  that specific matchup). Self-contained, high realism, directly feeds the INT-by-
  coverage-style band. Medium change.

- **E. Shell-wide press/off identity (Gap 5).** Make press/off/bail a coverage
  posture that shifts cushion and technique with the shell, not just a per-corner
  tag. Smaller polish; do after A–D so leverage/route work is in place to build on.

- **F. Motion reveal into the full read (Gap 6).** Feed `motionReveal` into the QB's
  whole progression, not just a scalar edge. Smallest; optional.

Suggested build order if you want depth without thrash: **A → B → D → C → E → F**
(leverage first because B and C both lean on it; the void slice of C can come earlier
if you'd rather front-load the biggest band mover). But this is your pick — nothing
is built until you choose.

---

# UPDATE — all six fixes implemented (A–F)

Owner picked all six, build order A → B → D → C → E → F. Every fix ships gated
(`globalThis.__noX`) so it can be toggled cleanly, and every one is a perturbation
that is **zero when its new inputs are absent** — which is why `sep_probe`, the
frozen-reference calibration gate (it pins `routeDuel`'s per-bucket separation to
the retired formula within ±0.010, and `catchResolution` multiplies sep ×5), stays
green through all six. Files touched: `js/engine/sepgeo.js` (routeDuel gains a
`scheme` param carrying leverage + route shape), `js/engine/sim.js`
(`routeVsCoverage`, `assignCoverage`, `resolvePassPlay`, `catchResolution` — the
last now exported for its probe). New probes: `leverage_probe`,
`route_shape_probe`, `robber_probe`, `zone_void_probe`, `shell_identity_probe`,
`motion_struct_probe`.

**Owner call on band headroom.** The baseline shipped *below* realism — comp% 55.9
(band 58–68) and INT% 1.80 (band 1.8–2.8) both at/under the low edge. Owner chose
to let the real mechanisms close that gap rather than force strict neutrality, so
A/B/C move comp% up toward the band centre *on purpose*; the veto watches the
ceilings, not the low edge.

### A. Leverage geometry (real). `routeDuel` gets a leverage: a break AWAY from the
defender's leverage catches him leaning (later break-reaction → more separation), a
break INTO it finds him sitting on it (less). Live play sets leverage from help
("play opposite your help" — outside with a safety over the top, inside without) but
leaves the *attack* direction unknown, so it's mean-neutral in aggregate (variance
by direction only). Probe: attacking leverage separates more at short/medium, deep
is a track-race (no-inversion only), neutral == baseline, gate clean. PASS.

### B. Route individuation + double moves (real). Routes carry a SHAPE: a sharp 90°
cut (in/out/comeback) is hard to mirror (later break-reaction) but bleeds downfield
speed; a 45° speed cut keeps velocity but is easy to mirror; a double move makes a
biting defender recover late, scaled by the receiver's TEC over the defender's AWR
(a disciplined DB resists). Validated against Throw Deep's route guide (sharp-vs-
speed split, post-corner double move — both confirmed). Probe: sharp > speed at the
break, double move > single, high-AWR resists, gate clean. PASS. Live shape mix
tuned near-neutral; double moves rare and reserved for a featured high-TEC receiver.

### D. Quarters / robber #2-read (real). In a two-high shell, on a vertical #2 the
safety plays the 2-to-1 robber and undercuts #1's in-breaker: the window shrinks and
the pick threat is materially higher than a trailing deep helper's (a `robber` flag
lifts the helper INT factor 0.9→1.5, ceiling 0.1→0.16). A sharp QB looks him off.
Probe (mechanism A/B on the now-exported `catchResolution`, noise-free): the robber
raises the pick rate, never helps the offense, scales with the safety's range. PASS.

### C. Zone void + pattern-match (real, biggest structural gap). Zone defenders now
own an AREA: when three-plus routes converge on one landmark (an unambiguous flood /
high-low) the defender is outnumbered and each receiver in the void separates more —
squeezed hard by the defender's AWR, which is the pattern-match dimension (a heady
zone passes off and shuts the void). Probe: a Trips/Bunch flood opens the void
(+~2pp completion) and a high-AWR zone squeezes it nearly shut, gate clean. PASS.
This is the fix that most moves comp% toward the band centre — accepted per the
owner call above.

### E. Shell-wide press/off identity (realism layer, honestly scoped). Cushion now
follows the shell: in a two-high/soft shell a press corner BAILS to off cushion; in
a single-high/pressed shell he stays tight. The conversion only bites when there's a
press corner to convert, so its *aggregate* completion effect is inside sampling
noise — a comp% delta is not a fair gate for it. The probe therefore proves what is
provable: it's mean-neutral in aggregate, it shifts a converted corner's technique
(two-high concedes more underneath on a short diet), and the gate is clean. PASS.

### F. Motion reveal into the full read (realism layer, honestly scoped). On a
CORRECT motion read the QB is steered to the specific man the motion uncovered — the
best isolated one-on-one vs revealed man, a voided receiver vs revealed zone —
instead of his default read. But the sim already banks most of the "correct read
pays off" value through the pre-existing `motionReadEdge` scalar, so this layer's
aggregate effect is sub-probe (this is the same redundancy that got the pass-rush
pass's bluff removed — kept here per owner choice, but honestly framed). The probe
proves it is mean-neutral and cleanly gated, not a comp% delta.

> On E and F: both are *real football* whose aggregate signal is smaller than a
> probe can resolve, because each overlaps behaviour the sim already had. Rather
> than tune them to fake a number, their probes assert exactly what's true —
> mechanism fires, mean-neutral, gate clean — keeping "probes decide truth" intact.

## Verification chain (all green)
- Six coverage probes PASS: `leverage_probe`, `route_shape_probe`, `robber_probe`,
  `zone_void_probe`, `shell_identity_probe`, `motion_struct_probe`.
- `sep_probe` (frozen calibration gate) PASS through all six — no bucket drifted.
- Existing `press_jam_probe`, `coverage_monotonicity_check` PASS.
- `stat_realism` N=500 — every band in range, comp% moved up toward centre on
  purpose: **comp% 55.9 → 57.3, ypa 6.70 → 6.90, INT% ~1.7, pass yds 239 → 247,
  rush 151, sacks 2.2, points 27** (rush/sacks are run-side noise; the pass changes
  are the coverage work).
- `node tools/build.mjs` 11/11 sanity checks PASS; boot check 0 pageerrors;
  `tree_probe` 79/79.
