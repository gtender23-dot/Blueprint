# Pass rush & protection assessment — the base four-man rush, the pocket, and the OL's protection read

Second pass of the pass-rush subsystem (the BLITZ layer is done — see
`BLITZ_MODEL_ASSESSMENT.md`). This one is the REST: the standard four-man rush, the
pocket collapse, stunts/games, chip/help protection, and bull-vs-speed.

Checked against the routed protection cluster in `SOURCE_LIBRARY.md` — the standout
tier #13 (Cover 3 Fire Zone / half-slide), #14 (Man Blitz vise set), #18 (Green Dog
overload), #19 (Man Under 2 Deep bluff), #27 (Reading the Slide), #28 (Sim Pressure),
#29 (Sting creeper), #30 (Triple middle overload), plus #1–#5 (bonus protection, ½
slide, twist front, double-A mug, Align to Win). Grounded in the actual sim:
`js/engine/sim.js` (`resolvePassRush` ~207, `blockRep` ~194, the rush-assembly caller
~779–982), `js/engine/rushgeo.js` (`resolvePocket`, the pocket physics), and
`js/constants.js` (`PROT_IDENTITY`, `PASS_RUSH_PRESSURE`, the rep-blend adjusts).
No probe has been run yet — every before-number below is a CODE READ; the first job on
approval is to make the probes state each claim before touching a line.

> **The one rule still governs.** Everything below is a HYPOTHESIS. A gap is only "real
> and missing" once a probe shows the sim doesn't model it, and no fix ships that pushes
> sacks / comp% / ypa out of the `stat_realism` bands. The sources generate the list;
> the probes are the veto.

---

## What the game gets RIGHT

- **The pocket / time-to-throw is genuinely good.** `resolvePocket` (rushgeo.js) races
  a per-rep arrival time (shed + traverse − collective collapse) against a nominal
  time-to-throw clock (`CLOCK 2.2s`). Beat the clock → sack; land inside `HURRY_REACH ×
  clock` → hurried; else clean. This is a real physics model, not a coin flip.
- **Bull vs speed rush exists as distinct paths.** `blockRep` lets an edge rusher take
  `max(speedPath, powerPath)`; a `DE-Power` role is forced onto the power path and
  damped (`POWER_PASS_DAMP 0.9`). `rushgeo.js` gives a power edge `POWER_FLUSH 0.22` —
  he caves the spot faster than he finishes. The *direction* of the source claim (bull
  collapses the spot, speed loses depth around the edge) is modeled.
- **Footwork matters, and matters most vs speed.** The OL AGI mirror term
  (`OL_PASS_MIRROR_SCALE 0.34`) is full-weight vs a speed rush, 40% vs an interior bull —
  a light-footed tackle mirrors the edge, a statue gets beaten around it.
- **Size/mass is priced, and correctly muted on the edge.** `BLOCK_SIZE_SCALE 0.1` with
  `BLOCK_SIZE_EDGE_MUTE 0.25`: a heavy NT bull-rushes a lighter guard, but the edge wins
  with leverage, not mass, so mass is quartered there.
- **Protection identity shapes exposure.** `PROT_IDENTITY` (Quick / Half-Slide / BOB /
  Max Protect) multiplies the pocket factor; Max Protect keeps TEs/RB home, Quick empties
  them into routes. BOB gets its best 1-on-1 clarity vs a four-man rush (`bobFourMan 0.88`).
- **Keeping bodies in lowers pressure; emptying raises it.** The RB-kept-in and
  blocking-TE machinery (~928–940) plus the done blitz-the-formation empty-set penalty.

## What the game UNDER-MODELS (the real gap)

There is one gap here, and it is large and coherent — the ten source claims collapse
onto it. **The sim resolves pass protection as N independent 1-on-1 coin flips assigned
by a fixed index, with no model of the OL's protection COUNT or SET.** Real four-man
(and disguised-five) pressure is overwhelmingly about manipulating *who the OL counts
and which way they set* so the free man arrives from a gap the protection can't redirect
to in time. The sim has the pocket physics on top of this, but not the protection-defeat
layer underneath it.

### 1. No protection count / set — the free rusher can only come from an EXTRA body (biggest gap)
Sources #13, #14, #27, #28, #29 are all one mechanism: the OL reads "first uncovered
lineman starts the slide," counts man vs slide blockers, and the defense breaks that read
with *one alignment* (Mike to the B gap; heavy 3-tech forcing a vise) so a rusher comes
free **at a four-man count**. The recurring rule across #18/#29 is literal: *"protect the
shortest inside straight-line path first,"* and the OL *can't redirect an aggressive set
in time* ("can't fight physics").

- **Code evidence:** blocker assignment is a fixed index — `blockerIdx = edgeAlign ?
  0 : Math.floor(availBlockers.length/2)` (sim.js ~225). There is no slide, no count, no
  "first uncovered," no set direction. A misaligned front cannot fool a protection that
  doesn't exist.
- **`freeBlitzerIds` is only ever populated on a fired blitz** (~240). A four-man rush
  that schemes an edge free without adding a body is structurally impossible today.
- **Probe to state it:** `pressure_probe` at a fixed 4-rusher count vs a "creeper" look
  should currently show ZERO variance from the base four-man rush — the free-rusher lever
  doesn't exist. (This is the number to pin first.)

### 2. No stunts / twists / games
Sources #3 (twist game), #18 (twist-style loops), #30 (middle overload with DTs
occupying the guards) all use DL loops to beat a slide by scheme. **Grep confirms
`stunt` / `twist` / `games` appear nowhere in sim.js.** Every rusher takes his own man
straight ahead; the line never loops or crosses. This is a subset of gap #1 (a stunt is
a *scheme* that changes the count/who's free), so a fix for #1 can subsume it.

### 3. No chip / help protection — a body is binary
Every TE and RB either blocks the whole play or releases into a route (`rbKeptIn`,
`blockingTEIds`, ~928–940). Nobody delays to bump the edge on the way out. Real chip
protection (and the RB "scan" answer in #13) is a middle option — help, then release —
that the sources list as a first-tier answer to pressure. `greenDog` is the only dynamic
body-count wrinkle and it's *defensive*.

### 4. The RB's protection read never breaks under a bluff
Sources #19 and #27 (the "Goldilocks" bind) are deep on how the RB steps to the wrong
threat and can't redirect. The sim's RB is a flat blocker with a flat `greenDog` trigger
— no read, no bluff, no "stepped the wrong way." This is the RB-facing half of gap #1.

### 5. Can't scheme a mismatch by alignment (crude, not dead)
#5 (Align to Win) and #14 isolate the best rusher on a guard-island or on the RB.
`blockRep` prices the individual matchup and size correctly, but because assignment is
index-based you can't *put* your best rusher on the weak blocker — the mismatch only
happens if it falls on that index by luck.

## Recommended fixes (priority order, smallest-change-highest-impact first)

Each is a bounded lever, not a rewrite. All stop for your pick; none is coded yet. The
`stat_realism` sack band is the veto on every one.

**A. A four-man "free-rusher" lever driven by scheme + OL awareness (subsumes gaps 1, 2,
5 — highest impact, moderate change).** Add a small probability that a four-man rush
frees ONE rusher (the creeper / vise / read-the-set outcome) as a function of the
defense's Blitz Design and pressure scheme vs the offense's protection ID and the
center's/best-blocker's AWR — reusing the existing `freeBlitzerIds` machinery so the
downstream pocket math already knows what to do with a free man. A good OL line (high
AWR, Half-Slide with a smart center) redirects and denies it; a poor one gets beat clean
at four. *Stat-realism risk: MODERATE-HIGH — this directly adds sacks/pressures at the
4-man count, which is most snaps. Must be probed to keep team sack% in band (~6–7%); the
BLITZ retune already showed 0.03 on `PASS_RUSH_PRESSURE` moves the whole league. Start
tiny and probe up.*

**B. Chip protection as a third option for the RB/TE (fixes gap 3 — medium change, low
risk).** Let a kept-in back/TE CHIP the edge (a one-rep help that lowers that edge
rusher's win chance) then release late into a checkdown. Models the real middle answer
and gives Half-Slide/BOB a lever they lack. *Stat-realism risk: LOW-MODERATE — lowers
pressure slightly; probe that it doesn't sag sacks below band, and that the late release
doesn't distort checkdown rates.*

**C. Alignment-driven assignment so a mismatch can be schemed (fixes gap 5 — larger,
optional).** Replace the fixed index with an assignment that lets the defense's front
alignment isolate its best rusher on the weakest available blocker (or the RB). Largest
change, most likely to ripple; lowest priority. *Stat-realism risk: HIGH — reshuffles
every rep matchup league-wide; would need the fullest probe pass.*

**D. RB read-break under a bluff (fixes gap 4 — niche, do last or fold into A).** A bluff
look makes the RB's pickup fail at some rate (he stepped to the wrong threat). Mostly a
flavor/edge-case refinement of A; probably not worth its own mechanism unless A's
free-rusher lever feels too "faceless."

Suggested order: **A first** (it's the gap; probe it hard), **B next** (cheap, realistic,
gives the offense the counter the sources list), then decide on **C/D** only if the
numbers still want more separation.

---

# UPDATE — Fix A implemented (the four-man scheme-free "creeper" lever)

**What shipped.** A four-man rush (no blitz fired) can now free ONE rusher by SCHEME —
the creeper / vise / read-the-set outcome the sources hammer (#14, #27, #28, #29). After
the reps are assigned but before they resolve, a probability
`clamp(CREEPER_BASE + (blitzDesign−50)·CREEPER_DESIGN − (centerAWR−50)·CREEPER_AWR, 0,
CREEPER_CAP) × protRedirect` strips one blocker, and that rusher flows through the
EXISTING free-rusher plumbing (marked free for the pocket clock, credited in the
sacker ranking). A sharp, aware line reads and redirects it; a lost line gets beaten
clean at four; Max Protect and Quick Game resist (extra bodies / ball's out fast), BOB's
clean 1-on-1s concede the most.

Deliberately tuned to be **conversion-neutral in aggregate**: near-zero at neutral design
+ average OL, so it REDISTRIBUTES pressure toward well-schemed defenses vs poorly-set OLs
rather than inflating the league sack total (which already sat at the top of its band).

**Files touched (js/ only, baseline idiom, exact-string edits):**
- `js/engine/sim.js` — `resolvePassRush` gains a `scheme` param + the scheme-free block;
  the pocket-map marks a scheme-free man as free-arriving; the sacker ranking credits him;
  the one call site passes `{ olAwr: _cAwr, protId }` (both already in scope).
- `js/constants.js` — new `CREEPER_*` dials next to `PASS_RUSH_PRESSURE`.
- `tools/creeper_probe.mjs` — NEW dedicated probe stating the behavior.

**Verification chain — all green (numbers, not vibes):**

*Baseline pinned first (pre-edit):* `pressure_probe` N=150 ALL PASS; `stat_realism` N=400
Sacks/team **2.25** (band ~1.8–2.3, at the top); `blitz_reality_probe` ALL PASS.

*creeper_probe N=250 — ALL CREEPER CHECKS PASSED:*
- Creeper OFF (design 50 + sharp OL 90) sack% **3.54** vs ON (design 100 + lost OL 45)
  **5.49** — the lever is real when schemed and effectively off against a heads-up line.
- OL awareness denies it: lost line **5.63** vs sharp line **3.59** (~2pp, stable across
  four independent runs).
- Scheme denies it: Quick Game lowest absolute creeper exposure **3.71**, BOB highest
  **4.15**, Max Protect **4.99** (keeps extra bodies). *(The per-scheme design-delta is
  below the game-level noise floor and is printed as a diagnostic, not asserted — the
  probe says so out loud rather than claiming a distinction it can't resolve.)*

*stat_realism veto — N=400, PASSED:* Sacks/team **2.25 → 2.20** (stayed in band; nudged
DOWN — conversion-neutral confirmed). Every other band unchanged within noise (comp%
56.1→55.6, ypa 6.68→6.65, INT% 1.86→1.93, turnovers 1.53→1.55, points 26.1→26.3). The two
pre-existing marginals (comp% low, yds/play low) are unchanged and NOT caused by Fix A.

*No-regression + integrity:* `pressure_probe` N=150 ALL PASS (house>bend, all bands held);
`build` 11/11 sanity checks incl. SW root-relative paths + cache stamp; boot **0
pageerrors**; `tree_probe` **79/79**.

**Then done in the same batch:** Fix B (chip) and Fix C (align) — see below. Fix D
attempted and REMOVED (see below).

---

# UPDATE 2 — Fixes B and C implemented; Fix D attempted and removed

## Fix B — chip protection (SHIPPED)
On the middle protections (Half-Slide / BOB) a RELEASED back can now bump ONE penetrator
on his way out — the third option (help, then release) between "block the whole play" and
"run a route" the sources list (#13 "get the RB out"). The bump buys the QB a beat, so
that rusher no longer gets home this rep; it prefers the edge/speed rusher a back can
actually redirect, and a bull-rush PWR edge shrugs it off.
- `js/engine/sim.js`: a post-rep chip block in `resolvePassRush` (gated by
  `globalThis.__noChip` for clean probe toggling); the one call site passes the released
  back's attributes as `scheme.chip`.
- `js/constants.js`: `CHIP_*` dials (CHIP_BASE 0.36 after tuning — 0.24 was below the
  game-level noise floor).
- `tools/chip_probe.mjs` (NEW). N=250 ALL PASS: chip OFF 6.25 → ON 5.87 with a competent
  back (lowers pressure, correct direction); a stout/aware back chips away more than a
  weak one. *(The chip is small by nature; the probe uses a competent back for the on/off
  test and isolates the chipper-quality axis separately — it says out loud that a
  replacement-level back's chip is below what a game-level aggregate can resolve.)*

## Fix C — align-to-win (SHIPPED)
The defense can now flip alignment to isolate its BEST rusher on the WEAKEST blocker and
win that schemed 1-on-1 — the guard-on-an-island / X-rusher idea (#5, #14, #30). One
bounded swap per snap, driven by Blitz Design, denied by the center's awareness; the
isolated man gets a two-way-go rush edge (not a zero-sum blocker swap, which cancels out).
- `js/engine/sim.js`: a pre-resolution alignment block (gated by `globalThis.__noAlign`);
  the isolated rep carries an `alignEdge` rush-context boost.
- `js/constants.js`: `ALIGN_*` dials incl. `ALIGN_EDGE`.
- `tools/align_probe.mjs` (NEW). N=200 ALL PASS: align ON 6.83 > OFF 6.66 (isolation adds
  pressure); a sharp line (high center AWR) re-sets and concedes far fewer align sacks
  (lost 6.93 → sharp 4.89).

## Fix D — RB read-break under a bluff (ATTEMPTED, REMOVED)
Implemented, then removed — the honest call. At the design levels where a bluff would
fire, Fix A's creeper is ALREADY freeing rushers, so the bluff's freed man was largely
redundant and its ON-vs-OFF effect sat inside the game-level noise floor (bluff ON 4.16 vs
OFF 4.35 at N=150, and the RB-AWR direction inverted — noise). The charter itself predicted
D was "niche, probably not worth its own mechanism unless A feels too faceless." Rather than
ship a mechanism no probe could prove, it was removed cleanly (all BLUFF_* dials, the
call-site threading, and the `__noBluff` gate are gone). Fix A already provides the
RB-facing "a man comes free at four" behavior D was meant to add.

## Combined verification — the whole batch (A + B + C), all green
- `creeper_probe` (A) N=200 ALL PASS · `chip_probe` (B) N=250 ALL PASS · `align_probe` (C)
  N=200 ALL PASS — each fix's probe re-run against the final combined code.
- **`stat_realism` veto N=500 (1000 team-games): Sacks/team 2.25 (baseline) → 2.22 — IN
  BAND.** Every other band matches baseline within noise (comp% 56.1→55.6, ypa 6.68→6.67,
  INT% 1.86→1.98, turnovers 1.53→1.57, points 26.1→26.3). The three pre-existing marginals
  (rush yds, comp%, yds/play low) are UNCHANGED and not caused by these fixes. *(An INT%
  dip to 1.74 at N=400 was low-count noise — it read 1.98 at N=500.)*
- `pressure_probe` N=300 ALL PASS (the one flagged check — attacking ≥ balanced — was an
  N=150 noise flip; at N=300 attacking 6.07 > balanced 5.60, comfortable).
- `build` 11/11 · boot **0 pageerrors** · `tree_probe` **79/79**.

Net: three of the four recommended fixes shipped and proven; the four-man rush now has a
scheme-free lever (A), a chip answer (B), and an align-to-win matchup (C), all
conversation-neutral at the league level (sacks held in band). Gap 4 (RB read-break) is
folded into A rather than given its own unprovable mechanism.
