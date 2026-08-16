# Pass 5 — Offense Engine · Plan of Record

**Status: SHIPPED 2026-08-09.** Gates at ship: build 0 boot pageerrors ·
**rpo_conflict_probe 10/10** (runCommit→bite · def AWR→bite&read down · QB
quality→read up · rpoSound/conflictReader/bitesHard monotone · outcome map
exact · 180 live RPO snaps all named, 5 outcome kinds · kill restores legacy) ·
**gadget_probe 7/7** (all three fire at 4% gadget-rare · reverse 5.2 ypc vs
crash > 3.5 vs contain · exchange fumbles real · gadget shot comp% 57 vs 47
by run-commit · toss-back sack tax 10.0 vs 7.2 · HB thrower is the back on
all throws · kill = 0 gadgets) · **choice_route_probe 6/6** (all read kinds
incl. zone settle · conversion 26→51% by receiver AWR/TEC · leverageReader
+11pp · miscommunication real (choice-man targeted 1% on mis vs 16%) ·
comp% mean-neutral |Δ|<2.5pp · kill clean) · **pass5_band_ab N=300 ×3 arms**:
live drift pts 0.96 rush 1.79 pass 9.31 comp% 0.08 sacks 0.02 — HELD;
amplified (rpo60/gad12) inside 2× envelope · formation_playbook (organic
gadget rolls playbook-gated after a caught escape) · traits 24 ·
trait_growth 14 · defcall 32 · defmesh 20 · covfam 17 · front_variants 53 ·
scheme_role 22 · mug 8 · greendog 10 · crossdog 7 · amoeba 7 (run-split
converted to amplified-dial gate — see probe note) · robber · zone_void ·
shell_identity · press_jam · sep/tendency/balance/run_scheme/motion_struct/
situational · read_conflict · time_to_throw · covsack · scramble_style ·
qb_mobility · rush/pressure/checkdown · int_accounting · yac_split ·
worldgen/recruiting/progression/save_migration/midgame_save/cutday ·
stat_realism N=500 (pts 26.3 / rush 139.0☆ / pass 246.5 / comp 56.4 / INT
1.77 / sacks 2.33 — same band state as pristine 26.6/144.5☆/245.8/56.8/1.75/
2.21; within-tree kill A/B is the controlled read: rush drift 1.79) · UI:
playnow / ui_playcall / defcall_ui / part1_controls / _qa_fast 60-game batch.

**Probe re-base note (4.5 lesson, recurred):** the extra per-snap PRNG draws
(RPO roll, gadget roll) re-based paired-seed streams; amoeba_probe's marginal
run-split coin-flipped at the stock ±0.05-ypc dial and was converted to an
amplified-dial plumbing gate (crank amoebaRunSoft 0.95→0.75 inside the probe,
restore after — mug_probe precedent). size_fit fat-tail, route_shape medium,
sep technician, shell_identity, leverage remain the standing seed-flakes
(fail↔pass on rerun, pristine behaves identically).

**Owner rulings (2026-08-09):** full pass in one run · trait hooks for RPO +
choice routes AND a gadget trait · AI adopts at low identity-scaled rates
behind the Band-rule gated A/B.

---

## A. RPO conflict reads (replaces sim.js ~4386 crude branch)

**What's wrong today.** The RPO branch has no defender in conflict: `committed`
is `runCommit > 0 || 30% coin flip` (team dial), the read is priced against a
flat **average of all LBs**, safeties never considered, and a flip converts to
a generic `pass_short` while `_conceptCtx` still carries the RUN concept
(latent bug — coverage reads run-concept tags on RPO passes).

**The build.** A named **conflict defender** and a four-outcome post-snap read,
modeled on `resolveOptionPlay`'s `readWinP` (per-defender) and the PA
`credibility × (1 − discipline)` structure:

1. **Concept RPO tags.** Run concepts gain `rpo: { tag, conflict }`:
   Inside Zone `{tag:"glance", conflict:"STACKER"}` · Power `{tag:"slant",
   conflict:"STACKER"}` · Outside Zone `{tag:"bubble", conflict:"OVERHANG"}` ·
   Toss `{tag:"bubble", conflict:"OVERHANG"}`. Untagged run concepts default by
   run type (inside→glance/STACKER, outside→bubble/OVERHANG) so the dial keeps
   working sheet-wide. The tag names the quick throw; `conflict` names the mesh
   role read.
2. **Conflict defender selection.** `composedFrontRoles(defFrontId)` zipped
   against `defPersonnel` (the existing positional-index convention), filtered
   by `constants_field` mesh key (`STACKER` = box LB, `OVERHANG` = edge/nickel
   overhang; `SPACE`/S fallback, then any LB). Highest-AWR match is the read.
3. **The bite (does he trigger on the run fake?).**
   `biteP = clamp(0.34 + runCommitEff·0.02 + runLean·0.25 − (AWR−50)·5e-3
   − 0.02·traitLv(def,"rpoSound") + 0.03·flawLv(def,"bitesHard")
   + seenRPO memory dock, 0.10, 0.85)` — same discipline currency as paBite,
   flipped to a per-man roll.
4. **The QB read (does he see it?).**
   `readP = clamp(0.55 + (qbRead − defAWR − 2·traitLv(def,"rpoSound"))·6e-3
   + 0.02·traitLv(qb,"conflictReader"), 0.25, 0.88)` with
   `qbRead = AWR·0.65 + TEC·0.35` (the option-read currency).
5. **Four outcomes.**
   - bite + read → **pull**: `effPlayType = "pass_short"`, `_conceptCtx`
     restamped to the RPO tag (fixes the latent bug), throw biased to the
     tagged quick game with a vacated-zone separation credit replacing the old
     flat `_rpoFlip` +0.07 (scaled by how hard the defender bit, capped).
   - bite + no-read → **wrong give**: run into the defender triggering
     downhill — `_rpoCtx.giveEdge` negative (he's an extra fitter).
   - no-bite + read → **give**: clean handoff, small hesitation credit
     (`_rpoCtx.giveEdge` positive, the conflict defender froze).
   - no-bite + no-read → **wrong pull**: throw into a sitting defender —
     completion docked / PBU-risk raised via the RPO separation credit going
     NEGATIVE (the flat defender never left).
   Mean-neutrality is tuned so the four cells offset near the dial default;
   the probe holds the aggregate while proving each cell's sign.
6. **Plumbing.** `_rpoCtx` module-global (house `_conceptCtx`/`_passCtx`
   convention) carries `{giveEdge}` into `resolveRunPlay`'s laneQuality and
   `{pullEdge, tag}` into `resolvePassPlay`'s separation block (replacing the
   `_rpoFlip` flat credit; `_rpoFlip` stays as the trigger flag). Defensive
   memory: `oppMem.rpo` seen-counter mirrors `_seenJets`.
7. **Results/stats.** `playResult.rpo` (kept) + `playResult.rpoRead ∈
   {pull, give, wrongPull, wrongGive}` + `rpoConflictId`. New player-game-stat
   counters: `rpoReadWins` (QB, correct pull/give), `rpoDefused` (conflict
   defender on wrongPull/wrongGive snaps).
8. **Kill-switch `__noRPOConflict`** — restores the legacy crude branch
   byte-for-byte in behavior (team-dial committed + LB-average read + flat
   +0.07 flip credit), so the A/B isolates exactly the new machinery.

**Trait hooks (Hook Rule, named now).**
- QB **`conflictReader`** — "Conflict Reader", pos [QB], hook: "RPO post-snap
  readP (off side)". Growth: `credit("conflictReader", gs.rpoReadWins)`.
- LB/S/OLB **`rpoSound`** — "RPO Sound", pos [LB, OLB, S], hook: "RPO biteP
  discipline + readP resistance (def side)". Growth:
  `credit("rpoSound", gs.rpoDefused)`.
- Existing flaw **`bitesHard`** gains its RPO side (same one mechanism —
  discipline — new call site, consistent with its two-sided PA wording).

## B. True trick plays (gadget tier)

All three ride the existing gadget wiring: `RUN_CONCEPTS`/`PASS_CONCEPTS`
entries with `resolver:`, cases in the forced-call switch, dispatch arms next
to jet/option/draw, `FORMATION_PLAYBOOK` homes, `conceptGroups()` pickup for
the UI gadget tab, and an `oppMem`-style seen-counter. Frequencies are
gadget-rare; a `gp.gadgetRate` dial (0–12, default 4) gates organic rolls, and
each play is coach-callable from the sheet.

1. **Reverse** (`RUN_CONCEPTS.Reverse = {resolver:"reverse"}`) — ~20-line
   sibling of `resolveJetSweep`: WR/slot carrier from JET_SLOTS speed order,
   second exchange against the grain. Punishes over-pursuit: `sniffP` from the
   backside edge's AWR + `edgeSetter` + contain call; UN-sniffed vs a crashing
   /over-pursuing edge (`edgePlayEff==="crash"` or `runCommitEff>0`) gets a
   big laneShift (the whole defense ran the wrong way); sniffed = the edge
   stayed home, forced penetrator + deep negative laneShift. Extra exchange =
   small fumble bump through the existing pitch-muff pricing. High variance by
   construction.
2. **Flea Flicker** (`PASS_CONCEPTS["Flea Flicker"] = {depth:"deep",
   resolver:"fleaflicker"}`) — resolves through `resolvePassPlay` with a
   forced deep shot and a gadget bite: credibility from the DEFENSE's
   run-commit and the fake handoff (paBite-style, amplified vs
   `runCommitEff>0`, near-zero vs a two-shell that never bit). Cost: the
   toss-back eats clock — extra pocket exposure via the PA-clock argument
   driven NEGATIVE (a real sack/grounding risk under pressure), so it's a
   boom/bust shot, not a free deep ball.
3. **HB Pass** (`PASS_CONCEPTS["HB Pass"] = {depth:"deep",
   resolver:"hbpass"}`) — `resolvePassPlay` with the **RB as the thrower**
   (`result.throwerId` already supports a non-QB): sweep action, then the
   halfback pulls up and throws deep off the run bite. The RB's THR-poor
   attribute line prices the risk naturally (comp% low, INT up); the bite
   credit mirrors the flea-flicker's but keys off outside run credibility.

**Trait hook (owner: add one).** RB/WR **`gadgetAce`** — "Gadget Ace", pos
[RB, WR], hook: "gadget resolver exchange/sell craft (reverse laneShift, flea/
HB-pass bite)". One mechanism: the gadget craft term. Growth:
`credit("gadgetAce", gs.gadgetSnaps)` (touches/throws on gadget plays).

**Kill-switch `__noGadgets`** — the three new resolvers refuse (concepts fall
back to their nearest vanilla cousin: Reverse→Jet Sweep behavior, Flea Flicker/
HB Pass→plain deep pass with no bite/no penalty), organic rolls never fire.

## C. Choice / option routes (leverage reads)

**Where.** `schemeFor` (sim.js ~1056) — the documented seam. Today `attack` is
static concept `breaks × leverage`; leverage exists only in man and the
aggregate is mean-neutral by the leverage_probe contract.

**The build.** Pass concepts gain `choice: true` (featured receiver, index 0 —
the same index-0 convention as `dbl`). Slant-Flat, Stick, Spot, and Curl-Flat
get the tag (the quick game is where choice routes live). On a choice snap in
a MAN duel:
- **Conversion roll:** `convP = clamp(0.35 + (recAWR·0.6 + recTEC·0.4 −
  defAWR)·5e-3 + 0.04·traitLv(rec,"leverageReader"), 0.15, 0.80)`. Success →
  `attack = +1` (he breaks away from the defender's leverage) and the scheme
  records `choiceConverted`.
- **Miscommunication branch:** on conversion, the QB must agree —
  `misP = clamp(0.10 − qbAWR·6e-4 − 0.02·traitLv(rec,"leverageReader")
  − 0.02·traitLv(qb,"conflictReader"), 0.02, 0.15)`; a miss marks the target
  `busted` (the existing wrong-place mechanic — ball where the receiver
  isn't). This is the mean-neutrality lever: conversion gains are paid for by
  real interception-shaped downside, tuned flat at league scale.
- **Failed conversion** → `attack = −1` half the time (he broke into the
  wall), else 0 — a choice route run by a low-AWR receiver is worse than a
  called break, which is the real-football truth.
- **Zone:** leverage stays 0 (unchanged contract); a choice snap in zone
  instead lets the receiver settle: tiny `zoneSettle` separation credit at
  short depth only, gated small enough that sep_probe stays frozen.

**Trait hook (Hook Rule, named now).** WR/TE **`leverageReader`** — "Leverage
Reader", pos [WR, TE], hook: "choice-route convP + misP (schemeFor)". Growth:
`credit("leverageReader", gs.choiceConversions)` (new counter on completed
choice-converted targets).

**Kill-switch `__noChoiceRoutes`** — choice tags read as absent; schemeFor
returns baseline; byte-identical to pre-pass behavior.

## D. AI adoption (Band rule)

`setAIGameplan` (ai.js): staff-identity-scaled `rpoRate` already exists; add
low `gadgetRate` (0–6 by aggression/identity) and choice-tagged concepts enter
`aiConceptWeights` at modest weights. The moment AI gains the schemes →
**pass5_band_ab** (3 arms, N=400, pass4_band_ab template): baseline (all three
kill-switches on) vs live vs amplified (dials cranked). Bands must HOLD:
pts / rush / pass / comp% / INT / sacks inside the standing envelopes
(rush judged against its pre-existing ~144-150 drift, not blamed on Pass 5).

## E. Gates

- New probes: **rpo_conflict_probe** (four-cell sign test on the exported
  read fn · named-defender identity · trait/flaw monotonicity · kill-switch
  restores legacy within noise · game-level flag counts + rpoRead mix) ·
  **gadget_probe** (reverse beats over-pursuit A/B and dies vs contain ·
  flea/HB bite scales with runCommit and costs sacks under pressure · HB pass
  thrower is the RB and comp%/INT price his arm · frequencies gadget-rare ·
  kill-switch) · **choice_route_probe** (convP monotone in AWR/trait ·
  busted-target miscommunication real · league sep mean-neutral vs
  __noChoiceRoutes · zone settle bounded).
- Existing suite vs baseline: read_conflict, leverage, route_shape, sep,
  tendency, balance, run_scheme, rush, situational, motion_struct, covfam,
  defcall, playnow/ui smokes, worldgen/recruiting/progression/save_migration,
  traits_probe + trait_growth_probe (extended for the three new traits),
  stat_realism N=500.
- Build + _boot_check 0 pageerrors; dist + blueprint-pages.zip same run.

## F. Deliberately out / deferred

- Swinging gate / fake punt / fake FG — Pass 6 (decision brain owns fakes).
- Situational trick-play auto-calls tied to defensive tendencies (the
  SITUATIONAL_ASSESSMENT §6 item) — Pass 6; this pass ships the plays and the
  dial, the brain learns *when* later.
- Per-gap run fits — surfaced, unclaimed (roadmap).
- MOFO/MOFOC full-progression QB read — stays the qbRead separation-proxy
  model; the conflict read added here is the RPO-specific piece only.
