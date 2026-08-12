# PLAYER IDENTITY SYSTEM — body, traits, attributes
### Design doc · brainstormed + owner-ratified 2026-08-08 · **STAGES 0–3 SHIPPED 2026-08-09 (Pass 4.5)**
### Stage 4 (earnable bridges + bulk/cut) defers into Pass 7 as planned · catalog v1.5 + Hook Rule added 2026-08-08 (§4e–4f)
### Owner ruling at build (2026-08-09): Conditioned / Big Stage / Durable stay OUT of v1.5
###
### AS-BUILT NOTES (2026-08-09):
### - Core module: js/engine/traits.js (catalog + windows + fit math + growth).
### - Schema: p.traits = { bridge, play:[{k,lv,xp}], flaws:[{k,lv,xp}], earned } —
###   new generations only; old saves null-guard everywhere, no SAVE_VERSION bump.
### - Frame flip in createRecruit (rollFrame first, soft attr priors from bulk).
###   Everyday weight σ kept TIGHT + a ~9% tweener kicker: weight feeds convex
###   hinges (broken-tackle weightOver etc.), so a wide everyday σ alone lifted
###   league rushing +11 yds/gm in the A/B before the two-regime roll fixed it.
### - Fit: effectiveRoleRating × sizeFitForRole (≤10% cap) + bridge dist-0;
###   picker (depthchart jobFitMult), resolver (fieldassign multOf + hand-pick
###   gate via new playerById param) and applyOutOfPos all honour bridges —
###   three-places law probed (traits_probe).
### - Growth rides applyPlayerGameStats (stat-line counters, works for cheap
###   sims); flaw coaching-down rides the in-season dev checkpoints + camp.
### - Gates: size_fit_probe 15 · traits_probe 24 · trait_growth_probe 14 ·
###   trait_band_ab three arms at N=400 HELD (live drift pts 0.03 rush 0.70
###   pass 2.33 comp% 0.34 sacks 0.02; saturation arm inside 2× envelope).
### - mug_probe run-split section converted to an amplified-dial plumbing gate
###   (the ±3% split sat below any probe-sized N's power; the identity pass's
###   legitimate generation change re-based the PRNG stream and exposed it).
###   covfam_probe default N 120→300 for the same reason.

## 1. The problem (owner's framing, kept verbatim in spirit)

Defense is the epitome of putting players in the best position to succeed, and
modern football has leaned into hybrid roles far past the old position model.
The game keeps the position model but now varies what every front asks of every
slot — yet with only 11 attributes, the cast for who can play what role feels
too general. Two 85-overall OLBs are interchangeable; nothing in the data makes
one of them Micah Parsons (a superstar in a stand-up odd front, a tweener in an
old-school 4-3), or 2010 Charles Woodson (a corner playing nickel-backer-blitzer
hybrid), or Brian Dawkins. On offense you can scheme around a player; on defense
**it has to be the player you recruited, playing the way you recruited him to
play.** The goal is NOT major sim impact — it is attachment, and anchors to
build a defensive player around. Anything built for defense gets an offense
mirror.

**Root cause, technically:** role ratings are weighted blends of a small
attribute set, and blends of few attributes are highly correlated — ranking
players across roles collapses into "who is better at football." The archetype
distance penalty is the only differentiator, but derived archetype is computed
FROM those same attributes, so it adds no new information. There is no place in
the data model to store *how a player plays* — only how well.

## 2. Prior art (what other games teach)

- **Blood Bowl** — the existence proof. ~4 stats, massive player identity,
  because identity lives in a sparse skill layer (Block, Dodge, Guard). Fewer
  attributes + traits beats more attributes. We have 11 stats; that is plenty.
- **Football Manager (player traits / PPMs)** — the attachment proof. Traits
  change what a player DOES ("cuts inside," "brings ball out of defense"), not
  how good he is. Sparse, visible on the card, learnable over a career. FM
  players form decade-long attachments to regens because of traits.
- **Madden X-Factors / abilities** — the cautionary tale. Drifted into stat
  boosts → power creep, less identity. EA CFB 25's tiered abilities are the
  middle ground. Lesson: traits should be identity and fit, not power.
- **OOTP** — two-layer model (tools vs. makeup) + scouting fog = attachment.

## 3. The design: a triangle — BODY · TRAITS · ATTRIBUTES

A player's identity is three legible things:
1. **Frame** — what jobs his body can hold (height fixed, weight mutable).
2. **Traits** — how he plays (sparse, visible, fit-and-situation only).
3. **Attributes** — how good he is (unchanged, all 11 as today).

Jobs (the slot layer that already exists: ROVER, JACK, JOKER, NB, WAR, SPUR,
MIKE…) ask for all three. Today they only ask for the third.

### Owner decisions (2026-08-08, all "recommended" options taken)
- **Trait power: fit + situational ONLY.** Zero flat stat boosts, ever.
- **Acquisition: innate + earnable.** Rolled at generation; a bridge trait can
  also be EARNED by logging real snaps at a job (couples to Pass 7 snap
  tracking, or a fielded-elevens proxy before that).
- **Size: full flip + body development.** Frame rolls first with fat tails;
  jobs get size windows in the fit math; offseason bulk/cut moves weight.

## 4. Traits — two tiers (owner refinement 2026-08-08)

**Owner call: traits are NOT rare.** The system is two-tier:
- **BRIDGE traits** — rare, scheme-defining (agreed to stay rare). A Space
  Backer changes what your defense can BE; scarcity is what makes him a
  recruiting prize. ~10% of players, tweener frames raise the odds.
- **PLAY traits** — a LARGE catalog of on-field style traits. Nearly every
  player rolls 1–3. Each has a tiny sim impact on exactly ONE existing
  mechanism, and each carries an **intensity level (I–III)** that can GROW
  through on-field events. Identity fabric, not power: any single trait at
  any level is nearly invisible in the bands; the roster-wide texture is the
  point. Includes FLAWS — negative traits that coaching can shrink.

### 4a. BRIDGE traits (rare — touch ONLY SLOT_ELIGIBILITY
### multipliers + ARCHETYPE_DISTANCE for a named job family)
| Trait | Who | What it unlocks (full-rate, no fit penalty) |
|---|---|---|
| Space Backer | OLB/LB | ROVER / WAR / big-nickel space jobs (the Parsons/tweener trait) |
| Slot Star | S/CB | NB slot at corner rate (2010 Woodson) |
| Box General | S | Walked-down jobs: 46 SS, 4-4 run duties (Dawkins) |
| Edge Bender | DE/OLB | JACK / EDGE / wide-9 stand-up rush jobs, both directions |
| Two-Gapper | DT/DE | NT / 4i jobs despite a penetrator profile |
| Pole Runner | LB | Deep-middle carry job (pre-wires the Tampa 2 in coverage pass) |
Offense mirror: **Move TE** (flex to slot at WR rate) · **Backfield Weapon**
(RB split wide) · **H-Back** (FB/TE bridge) · **Swing Tackle** (all five OL
spots) · **Wildcat Engine** (RB/QB).

### 4b. PLAY-trait catalog v1 (common — every trait names its existing code
### hook; effect per intensity level is TINY, e.g. low-single-digit % on that
### one mechanism, capped at level III)

DEFENSE — pursuit & tackling: **Wrap Tackler** (broken-tackle resistance,
finish layer) · **Open-Field Tackler** (yacgeo space tackles) · **Big Hitter**
(hit-power flavor on FF path) · **Strip Artist** (strip attempts) · **Motor**
(late-down pressure persistence) · **Trigger** (spill/force downhill fill).
Rush: **Bend** (speedPath edge corner) · **Power Move** (powerPath) · **Bat
Radar** (BAT_*) · **Green Dog** (blitz-convert vs staying backs) · **Gap
Shooter** (run-blitz penetration). Coverage: **Sticky** (sepgeo man
separation) · **Zone Eyes** (assignCoverage bust reduction in zone) · **Press
Jam** (press_jam machinery) · **Ball Hawk** (tipped-ball INTs) · **High
Point** (SIZE_MISMATCH jump balls) · **Spy Eyes** (QB scramble containment) ·
**Film Junkie** (disguise/PA recognition). Special teams: **Gunner**
(st_coverage) · **Return Vision** (return paths).

OFFENSE mirror: **Route Technician** (sepgeo) · **Contested Catch** · **YAC
Monster** (yacgeo) · **Home-Run Threat** (breakaway) · **Secure Bag** (fumble
resistance) · **Chain Mover** (3rd-down catch focus) · **Pocket Presence**
(sack-avoid) · **Scramble Drill** (off-schedule throws) · **Play-Action
Seller** · **Lead Blocker** · **People Mover** (OL drive blocks).

FLAWS (negative — the other half of attachment; PENALTY_CATALOG and two-sided
mechanics are the hooks): **Grabby** (DPI/hold rate) · **Jumpy** (offsides) ·
**Gambler** (INTs up AND burned-deep up — two-sided) · **Headhunter** (splash
hits + personal fouls) · **Freelancer** (busts up + splash plays up) ·
**Drops** (drop rate) · **Fumbler** · **Happy Feet** (pressure panic) ·
**Slow Starter** (early-game form dip). Flaw intensity SHRINKS with coaching
(practice plan / position coach), and can vanish — a development story.

### 4c. Intensity & growth (the on-field loop)
- Levels I–III, shown as pips on the trait chip. Generation rolls mostly
  level I; II uncommon; III rare (a recruit with a III is a hook in scouting).
- **Traits grow by DOING**: each play trait accumulates hidden progress when
  its own trigger fires successfully (Strip Artist counts forced fumbles;
  Sticky counts lockdown reps). Threshold → level-up moment surfaced in the
  weekly report — "Jenkins' Strip Artist hit level II." Low bookkeeping: one
  counter per trait instance, events the sim already logs.
- Flaws grow too if unaddressed (Grabby gets grabbier vs elite WRs) and
  shrink via practice emphasis — the coaching redemption arc.
- Caps: 1–3 play traits at generation, hard cap 4 per player ever (a career
  can ADD one earned play trait); bridge traits stay separate and rare.

### 4d. Earning a bridge trait (unchanged)
A season with meaningful snaps at an out-of-native job (threshold tunable;
proxy = fielded-eleven appearances until Pass 7 snap tracking lands) →
offseason event: "He's become a Rover." One earnable per career; the offseason
card is the attachment moment. Coach DNA / practice plan may accelerate later.

### 4e. Play-trait catalog v1.5 — the FULL-ENGINE sweep (owner-directed 2026-08-08)

Owner call: v1.5 looks at **everything already in the sim**, not just what the
passes added. Method: swept the shipped engine's mechanism inventory end to end
(resolvePassPlay / resolvePassRush / assignCoverage / catchResolution / sepgeo
routeDuel / run2geo runFit / yacgeo geoYAC / resolveOptionPlay / the ST suite /
PENALTY_CATALOG / fatigue / form / qbContactResult / seenMemory film layer) and
claimed every mechanism that reads as an on-field *style*. Same power law as v1:
each trait names exactly ONE existing mechanism, tiny per-level effect, its own
probe. Caps unchanged (1–3 at generation, 4 ever) — a bigger catalog buys
*variety across rooms*, not denser players. v1 traits all stand; these ADD.

**QB (was 2 traits — the most-watched room in the game):**
**Blitz Beater** (the hot-throw machinery: `hotChance` — sees the fired blitz,
finds the man it uncovered) · **Eye Manipulator** (the robber `lookoff` term —
moves the two-high safety off the in-breaker before throwing it) · **Field
General** (the LOS kill-call/audible machinery: `seeIt`/`pAud` — flips into the
right play) · **Rhythm Passer** (the `inRhythm` first-read bonus — the timing
game) · **Slides Early** (two-sided, `qbContactResult`/`qbSlid`: injury risk
down, yards left on the field — self-preservation as identity).

**RB:** **Pass-Pro Back** (blitzer `pickupProb` in resolvePassRush — picks up
the extra man) · **Chipper** (the §16.2 chip machinery — bumps the edge on his
way out) · **Patient Runner** (run2geo lane-commit timing — lets the hole
open) · **One-Cut** (runFit cut/`laneShift` quality — plants and goes).

**WR/TE:** **Release Artist** (the offense side of the press-jam contest —
beats the jam clean) · **Double-Move Artist** (sepgeo `dblLag` sell — the
sluggo is HIS play) · **Motion Weapon** (`motionGain` — separation from
movement) · **Deep Tracker** (`vdeep`/over-the-shoulder deep contested —
the vertical specialist) · **Blocking Receiver** (the Fix-D stalk-block
machinery — springs screens and edge runs).

**OL (was 2 traits for five bodies):** **Line General** (center only — the
`centerAwr` half-slide term in protectionFactor + the stunt-align counter: the
protection brain) · **Anchor** (blockRep `powerPath` resistance — stones the
bull) · **Mirror** (blockRep `speedPath`/OL mobility term — rides the edge
speed past the arc) · **Puller** (the run-concept `pulls` machinery — space
blocking on the move).

**Defense (claiming machinery v1 left unclaimed):** **Disguise Artist** (S/CB —
the `pDisguise`/shown-shell craft term: sells the wrong picture; the seller
side of the duel v1's Film Junkie reads) · **Pattern Matcher** (the zone-void
`awrSqueeze` — passes off the flood and shuts the void) · **Robber** (S — the
`robStrength` undercut itself, distinct from Ball Hawk's tipped-ball INTs) ·
**Screen Sniffer** (DL/LB — the screen `sniffChance` AWR term) · **Edge
Setter** (DE/OLB — the contain/`edgeTec` execution vs jets and outside runs) ·
**Option Sound** (DE/OLB/LB — the option-assignment read in
resolveOptionPlay — never takes the wrong man) · **Angles** (LB/S/CB — geoYAC
pursuit convergence — the breakaway dies at his angle).

**Special teams (a room v1 locked out entirely):** **Ice Veins** (K — the
pressure-kick context around `attemptFG`/`fgLateStretch`: unmoved when it
counts; situational, so legal under the power law) · **Coffin Corner** (P —
`puntResult` placement, kills it inside the 20) · **Hang Time** (P — the
`returnOutcome` coverage side: fair catches forced, returns strangled) ·
**Hands Team** (TE/LB — `onsideResult` recovery).

**New FLAWS (the sweep's other half):** **Telegraph** (QB — his eyes feed the
robber/forced-ball INT machinery — the break is given away) · **Hero Ball**
(QB — the covSack branch weights: won't throw it away; two-sided — occasional
escape splash, more disasters) · **Dancer** (RB — the One-Cut hook reversed:
bounces everything; TFLs up, occasional house call) · **Body Catcher** (WR —
the contested-catch term: fine in space, loses the tight ones) · **Bites
Hard** (LB/S — `paBite` discipline reversed + double-move victim: sells out
downhill, burned by the fake; two-sided) · **Lane Drifter** (DL — the
stunt/align gap-integrity machinery: loses his gap) · **Holding Habit** (OL —
his PENALTY_CATALOG "Offensive Holding" weight) · **Shanks** (K/P — pressure
variance on the kick roll) · **Muffs** (returners — the `muffP` machinery).

**Flagged for owner — real identity, but they brush the power law** (each is
availability/context rather than fit, so they need an explicit yes): 
**Conditioned** (fatigueMultiplier resistance — a motor axis, but more
effective snaps IS more player) · **Big Stage** (form/`applyFormPts` in
rivalry/playoff context — situational, but reads close to a stat boost) ·
**Durable** (injury-duration roll — pure availability). Default: OUT of v1.5
until ruled on.

### 4f. THE HOOK RULE (standing law, owner-ratified with v1.5)

**Every future pass that ships a new on-field mechanism must, at its plan-of-
record stage, either name the trait hook it creates or explicitly decline it
("no trait — reason").** Same standing force as the band rule (AI gains a
scheme → gated A/B). This is what keeps the catalog a living registry keyed to
the engine instead of a fixed list that rots: Pass 4's mug/bail and cross-dog
games, Pass 5's RPO conflict reads and choice routes, Pass 6's fakes and
Pass 7's snap engine are all trait surfaces — they should arrive with their
hooks named, not get retrofitted. (Applied retroactively by this very sweep:
Pass 2's call system contributed Disguise Artist's craft duel; Pass 3's
coverage families contributed the Robber hook and the already-designed Pole
Runner bridge.)

**Pass 4 honored the rule at plan-of-record (2026-08-08, owner-ratified):**
Green Dog's catalog mechanism is now LIVE (the refit convert in
resolvePassPlay — the trait reads the man-gate convert); **NEW play trait
"Games Runner"** (LB — the cross-dog pick-timing term in resolvePassRush;
offense counter is Line General's stunt-align read); the mug/amoeba
shown-picture lift is Disguise Artist's surface (its pDisguise craft term now
has two more sellers); mug interior pressure explicitly DECLINED (coordinator
scheme via Blitz Design, not a player style).

## 5. Size — the flip

- **Generation:** roll frame FIRST per position family with wider tails than
  today (real tweeners must exist: the 6'2" 226 safety, the 240 OLB who runs).
  Attributes then take soft priors FROM the frame (heavy → STR bias), inverting
  today's attribute→size skew.
- **Fit:** each job gets a size window (extend SIZE_BANDS to the job/slot
  layer: ROVER ~215–235, NT ≥ ~310, JOKER lean…). effectiveRoleRating gains a
  size-fit multiplier: 1.0 in-window, gentle falloff, hard cap ~8–10% penalty.
  Fit, not power — weight/height ALREADY act physically (block-shed
  BLOCK_SIZE_SCALE, broken tackles, jump balls, batted passes); do not
  double-count.
- **Body development:** offseason bulk/cut per player, ±5–12 lb/offseason
  within a frame-derived genetic range; small coupled attribute nudges (bulk:
  +STR/PWR, −SPD/AGI; cut reverse), zero-sum in spirit. Height never changes.
  The 218-lb tweener you signed becomes a 232-lb JACK by junior year — the
  literal "anchor to build a defensive player around." Couples to Pass 7
  position-convert flow.
- **Scouting/recruiting:** frame becomes the FIRST thing a recruit card says
  ("6'2" 226 — Rover frame"), with job-window chips; one scouted trait shown
  with fog. You recruit a body + trait for a job you already run.

## 6. Guardrails (band safety)

- No flat boosts anywhere. Bridge = fit math only. Play traits = existing
  mechanisms only, each with a mechanism-gate probe; per-level effects sized
  so a FULL ROSTER of level-III traits stays inside stat bands (the probe
  literally tests that saturation case).
- Global kill-switches in house style: `__noTraits`, `__noSizeFit` → matched
  A/B through stat_realism before ship (per the floor-hugging-band lesson).
- Size-fit penalty capped; windows generous; the sim's on-field selection
  already prefers in-window bodies via archetypes, so expect selection to
  shift more than outcomes.
- AI rosters get traits/frames by the same generation — verify portal/
  recruiting economy with scheme_role_probe extensions + portal probes.
- Top end guarded by independence, not compensation (Borderlands rule, §8):
  flaws roll independent of quality with tiny effects; class-quality probe
  verifies per-division attribute distributions are UNCHANGED by the trait
  system (attribute floors are a safety valve only).

## 7. Implementation phases (one pass, four stages + stage 0)

0. **THE DEFENSIVE JOB MESH (owner-ratified 2026-08-08 — the plumbing every
   later stage stands on).** Defensive unique jobs become MESH pools exactly
   like offense's SLOT/WING/WILDCAT spots. Today every defensive job slot is
   hard-typed to ONE roster position in DEF_FIELD_LAYOUTS (constants_field.js);
   SHARED_POS (depthchart.js), SLOT_ELIGIBLE_POS and MESH_AUTO_POOL
   (fieldassign.js) have zero defensive entries — the NB picker lists only
   CBs, JACK only OLBs. That contradicts this whole design: a Space Backer
   bridge can't give a body a home at ROVER if the picker won't list him.
   Ratified decisions:
   - **Pools.** Overhang/edge jobs (JACK, JOKER, CHAR, SPUR, BANDIT, EDGE):
     OLB/DE/LB. Stack/inside-backer jobs outside base 4-3 and 3-4 (STK, ILB,
     MIKE/WILL in stack and sub fronts): LB/OLB. Space-safety jobs (WAR,
     ROVER, the Dime DB): S/LB/CB. NB: CB/S. **Base 4-3 and 3-4 unchanged** —
     their jobs are their positions.
   - **Cost.** Out-of-native bodies pay the EXISTING machinery — the
     SLOT_ELIGIBILITY fit multiplier orders/prices the pool (picker sort and
     auto-tail), and the sim's applyOutOfPos attribute-keep already charges
     any body fielded in a bucket that isn't his listing. No new math. This
     is the exact surface stage-2 bridge traits waive and stage-1 size
     windows multiply.
   - **Depth chart goes JOB-FIRST per front.** The front's actual jobs are
     the containers/tabs (the per-front field sheet that already exists);
     each job's picker pools every eligible body sorted by job fit. Roster
     position stays what a player IS (Pass 1 "Option A" completed).
   - **Auto-fill stays native-position-first with the mesh as tail** (the
     offense MESH_AUTO_POOL override-first pattern): untouched plans and AI
     defenses resolve near-identically — hand-picks may cross positions,
     auto barely moves (the mesh tail only supplies when the native room
     runs dry, replacing the anyone-goes emergency fallback with an
     in-pool body).
   - **House laws.** Three-places-must-agree extended to defense with its
     own probe (picker offers ⊆ resolver accepts ⊆ sim receives); old-save
     law (fa.defense slot pins are per-front slot-id keys — no new save
     fields, legacy pins keep resolving); if auto-selection shifts at all,
     gated stat_realism A/B before ship.
1. **Size flip + job windows + size-fit term** (+ size_fit_probe: window sweet
   spots, cap respected, bands neutral under `__noSizeFit` A/B).
2. **Trait schema + generation + bridge math + player/recruit card UI**
   (traits persist on player objects; save-migration decision below).
3. **Play-trait catalog + intensity growth**, mechanism by mechanism, each
   with its probe; flaws + coaching-down loop ride with it.
4. **Earnable traits + bulk/cut offseason** (or defer this stage into Pass 7
   where snap tracking lands — sequencing call at build time).

## 8. Build-time decisions — RESOLVED by owner review (2026-08-08)
- **New generations only.** No retro-roll onto existing save rosters; frames
  and traits enter the world with the next recruiting class. (Simplest
  migration story; the system phases in over ~4 seasons of roster turnover.)
- **Scouting reveals everything.** Traits start hidden on recruits and the
  fog lifts FULLY through the normal scouting process — no permanent
  partial-reveal. Scouting effort is the price of seeing who a kid really is.
- **Yes — bridge traits widen the size window.** A Space Backer's acceptable
  ROVER/JACK window stretches around his actual frame: he "plays bigger than
  his size." Bridges bend both fit axes (archetype distance AND body).
- **Top end: the Borderlands rule (owner reframe, 2026-08-08).** Flaws and
  quality are INDEPENDENT axes, rolled separately — like Borderlands gun
  generation: an otherwise great gun with one flaw is still a great gun, and
  that is exactly what makes finding the perfect gun special. Concretely:
  (1) flaws roll independently of star level — elites get NO protection and
  NO compensation (no floor offsets tied to flaws, no compensating positive
  traits — either would re-flatten identity); (2) flaw effect sizes stay
  tiny by the play-trait power rule, so a flawed 5-star is still a 5-star —
  a signable, buildable, coachable story; (3) the GOD ROLL — high attributes
  + a bridge + strong play traits + zero flaws — is never manufactured, it
  emerges rarely from independent probabilities, and the recruiting UI
  should let you FEEL it when scouting uncovers one (a clean-sheet moment);
  (4) the per-division attribute floor (divisionBase / ATTR_FLOORS) is
  demoted to a safety valve — touched only if the class-quality probe shows
  per-division attribute distributions drifting after traits ship, which by
  construction they should not (traits never touch attributes). Enlarged
  recruit pools remain rejected (too expensive to sift).
