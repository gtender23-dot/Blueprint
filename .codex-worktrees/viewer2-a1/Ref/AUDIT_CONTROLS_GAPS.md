# Controls audit — what stays automatic vs. what the coach should get to call

Step-2 lens of `Ref/AUDIT_CHARTER.md`, scoped to the content shipped in the seven
sim-realism passes (pass rush & protection, coverage, run game, YAC, situational,
special teams, QB play). Question answered here: **of everything the sim now does, what
should keep happening on its own, and where does the coaching knowledge imply a knob the
player doesn't have?**

Grounded in the actual control surface: the gameplan screen currently exposes ~45 fields
(`js/ui/views/gameplan.js` → `getEffectivePlan` in `js/engine/situations.js`), including
covShell / covStyle / pressLevel / edgePlay / runCommit / bracketWho / spyQB / greenDog /
pressureIdentity / protIdentity / protEmphasis / qbAggr / passDepth / fourthDown /
maxFGDist / patApproach / puntDef / stFakes / tempo / situations cells. Each shipped
mechanic below was traced to its live inputs in `sim.js` / `run2geo.js` / `sepgeo.js` /
`yacgeo.js`.

This is a proposal list — owner decides what's in scope. **No code was edited.**

---

## The sorting principle (four tests for "should this be a control?")

A shipped mechanic earns a knob only if it passes all four; otherwise it stays automatic.

1. **Real coaches call it by name, game to game.** A robber call, a surprise onside, a
   chip help — these are decisions on a real call sheet. A back's vision or a corner's
   pattern-match discipline is *taught and recruited*, not called — that belongs to
   attributes and staff, not a dial.
2. **The sim already computes the lever.** Cheapest controls are the ones where the code
   path exists and a dial just biases it (the surprise-onside branch is literally plumbed
   and waiting).
3. **There's a real cost in both directions.** A dial with a dominant setting is a solved
   dial — every player and every AI staff converges on it, and the league mean drifts.
   Every proposal below names its cost. If a cost can't be named, the control shouldn't
   ship.
4. **The player can see it work.** A control whose effect is invisible in the box score,
   the drive log, or the watch view is indistinguishable from a placebo. (This is also
   the capstone-trace argument — several of these get much more legible once the viewer
   renders the real play.)

Two standing guardrails inherited from the passes:

- **Mean-neutral mechanics become mean-movers once dialed.** Most shipped fixes were
  deliberately redistributive (conversion-neutral creeper, mean-neutral climb, symmetric
  box count). A dial lets one team push off-center — that's fine, that's what blitzPct
  already does — but the **AI distribution of any new dial must keep the league mean in
  band**. Every new control ships with: default = today's exact auto behavior (so old
  saves and AI staffs resolve identically with zero migration), an `ai.js` policy, and a
  stat_realism run at the AI's settings mix.
- **Nothing here touches Buy-In / Coaching-Points.** All proposals are gameplan-screen
  dials or situation-cell fields; none assumes practice allocation, grades, or any cut
  system.

---

## Bucket 1 — Already controlled: new mechanics that landed on existing dials

No action needed. This is the good news of the audit: a large share of the new depth is
already in the player's hands because the passes deliberately wired new mechanisms to
dials that existed.

| New mechanic (pass) | Existing control that drives it |
|---|---|
| Force/spill edge fits (run C) | **Edge Discipline** (contain/crash) sets the spill sign |
| Box-count stuff/spring (run D) | **Box Commit** slider (runCommit) loads/lightens the box |
| Zone climb vs. gap pullers (run B) | Concept weights / edgePlay stamp the run scheme context |
| Press/off shell identity (cov E) | **Cushion** (pressLevel) + **Safety Shell** (covShell) |
| Scramble-to-throw style (QB D) | **QB Aggression** sets conservative vs. aggressive scramble style |
| Time-to-throw exposure (QB A) | **Pass Depth** + **Quick** protection identity shape the hurry profile |
| Creeper/align pressure craft (rush A/C) | **Pressure Identity** feeds the design bonus; the DC's blitzDesign rating carries it |
| Chip context (rush B) | **Protection Identity** (Half-Slide/BOB) decides whether a back is there to chip |
| PA-vs-loaded-box separation (YAC E) | **PA rate** × the *opponent's* box commit — emergent counterplay |
| Screen perimeter blocking (YAC D) | **Screen rate** controls exposure; blocking grade is talent |
| Modern 4th-down curve (sit C) | **Fourth Down** dial still swings the curve (97% vs 60% at the extremes) |
| Late FG stretch (sit E) | **Max FG Distance** still prices the attempt |
| PAT reads the kicker (ST B) | **PAT Approach** (chart/kick/aggressive) unchanged, now talent-aware |

The one real gap in this bucket is **legibility, not control** — see Bucket 4.

---

## Bucket 2 — Stays automatic, on purpose

These should never grow a dial. Listing them explicitly so a future "add options" pass
doesn't relitigate them.

- **The back's read** (run A, AWR-pivot vision). This is why you recruit a back with
  vision. A dial would let a coach buy what the roster lacks — it's the *player's*
  mechanic. Same logic: **read-conflict/take-what's-open** (QB C), **double-move
  timing** (cov B, rec TEC vs. DB AWR), **zone-void squeeze by AWR** (cov C's awrSqueeze),
  **motion-read misdirection** (cov F), **broken tackles / breakaway gate** (YAC B).
  These are the attribute economy working as designed — they're what separation on the
  depth chart and the recruiting board *mean* now.
- **Leverage-to-help** (cov A). The auto rule — leverage outside when help is inside,
  and vice versa — *is* the coaching point. Defaulting to anything else is coached
  malpractice, so a dial's off-default settings would be strictly worse: fails test 3.
  (The narrow good version of this idea is the robber/funnel *call*, Bucket 3.)
- **Kneel-out and clock-stop arithmetic** (sit A/B). Rules of football, not strategy.
  The timeout-aware kneel gate already does the only smart thing. Note `clockMgmt` was
  a legacy field the engine now deletes on normalize — that removal was correct; don't
  bring it back.
- **Two-minute sideline bias** (sit D). This is execution every trailing team attempts;
  a "don't work the sideline" setting has no football meaning. The existing situations
  panel (two_min_trail cell) already lets a coach shade tendency/depth there.
- **FG/punt/KO physics, blocked kicks, deep-punt safety** (ST A/C/E). Talent and
  variance. `maxFGDist`, `puntDef`, and `stFakes` already cover the decisions that are
  real decisions.
- **Creeper and align-to-win rates** (rush A/C). These ride the DC's blitzDesign rating
  vs. the center's AWR — pressure *craft* as a staff attribute. The hiring market is the
  control. Adding a player dial on top would double-count the DC and hand a bad staff a
  free simulated coordinator.
- **Checkdown rung** (QB E). Keep automatic, but see the small refinement in Bucket 3
  (#5) — it should *listen* to an existing dial, not get a new one.

---

## Bucket 3 — Recommended new controls (priority order, smallest-change-highest-impact)

### 1. Surprise onside kick — the call exists in the engine and nobody can make it
- **What:** `onsideResult(surprise, stGrade)` shipped with a ~60% surprise path
  explicitly "plumbed for a future AI trigger" — the sim only ever passes `false`. Add
  the call: a situations-panel toggle (or a per-game "steal a possession" setting under
  Special Teams, next to Fakes, which it resembles in spirit: a standing green light,
  not a scripted play).
- **Cost both ways:** burn the surprise and it's just a short kick conceded (~40% fail =
  gifted field position); never use it and you leave the analytics edge unclaimed.
  Frequency must decay with use (opponents' ST scout memo could price it, same shape as
  the existing audible-memory read).
- **Size / risk:** smallest item on this list — the resolver is done; this is UI + an
  `ai.js` trigger (desperate-underdog profile) + `st_net_probe` extension. Onside volume
  is tiny, so stat_realism risk ≈ nil; the AI trigger must stay rare or late-game scoring
  variance climbs.

### 2. Robber / trap call — the one shipped coverage mechanic that is a *call* in real life
- **What:** the Quarters robber (cov D) auto-fires off two-high + a vertical #2 + helper
  AWR. In real football "Cover 1 Robber" / "quarters trap" is a named call a coach dials
  up against in-breaking teams. Add a coverage-group option (a `bracketWho`-style row:
  Auto / Rob the middle / Stay over the top) that scales willingness — `robStrength` is
  already computed and capped, so the dial biases an existing quantity.
- **Cost both ways:** rob aggressively and the helper vacates deep help — the post/seam
  over his head must get *more* live (this deep-shot tax needs to be real, and it's the
  small piece of new code here). Stay over the top and you concede the dig/slant window
  the pass just taught the sim to close.
- **Size / risk:** small-medium. `robber_probe` extends naturally (dial up → more robbed
  in-breakers AND more deep completions behind it; Auto must equal today's numbers
  exactly). Comp%/INT% move in opposite directions by design — the probe proves the
  tradeoff, stat_realism proves the AI mix holds the band. AI: keyed off opponent
  tendency memory (heavy in-breaking offense → rob).

### 3. Zone teaching style: spot-drop vs. pattern-match — the scheme-identity dial the coverage pass implies
- **What:** the zone-void fix made void-squeeze a pure function of defender AWR. Real
  defenses *choose* to teach match (Saban) or spot-drop — a scheme identity with a real
  tradeoff, currently unexpressible. A Coverage-group option (Spot-drop / Balanced /
  Match) fits beside covStyle: Match squeezes voids harder (raises the awrSqueeze
  effectiveness) but introduces a bust branch when AWR is low or motion/bunch stresses
  the rules; Spot-drop is floor-safe and leaks the overload voids the pass modeled.
- **Cost both ways:** built into the definition — Match with a smart, recruited-for-AWR
  secondary is the ceiling; Match with a dumb one busts coverages (big plays), which is
  exactly the realism the sources describe. Spot-drop caps both tails.
- **Size / risk:** medium — the bust branch is new code, and it's the item most likely
  to fight the comp%/ypa bands (a bust is a chunk play). But it's also the highest
  *identity* value on this list: it makes secondary-AWR a thing you build a scheme
  around, which feeds recruiting priorities — the good kind of ripple. Probe:
  `zone_void_probe` extension (Match > Balanced > Spot on squeeze; bust rate ordered the
  other way; low-AWR Match < Spot net). Flag: this is the one Step-3c should check for
  ratings-vocabulary fit (is AWR alone the right gate, or is this over-loading one stat?).
- **Note:** does NOT reopen cov E/F — those stay attribute-gated; this is only the void/
  match layer.

### 4. Chip help — name the protection answer to their best rusher
- **What:** chip (rush B) auto-fires when the protection leaves a back available. Real
  protections *declare* chip help on a specific edge. Add a Protection-group option
  (Auto / Chip the edge) that raises chip rate and lets it target the opponent's best
  rusher (the sim already prefers edge/speed rushers as chip targets).
- **Cost both ways:** the chipping back releases late — his checkdown/screen availability
  drops. This cost is *newly meaningful* because the QB pass made the RB outlet a real
  progression rung: Chip-the-edge should visibly starve the checkdown share
  `checkdown_probe` measures. That interaction is what elevates this from flavor to
  strategy.
- **Size / risk:** small-medium. `chip_probe` extends; the CHIP_* constants exist. Watch
  sacks (chip was shipped conversion-neutral; the dial should trade sack risk against
  checkdown/screen yardage, not lower league sacks).

### 5. Checkdown emphasis — a refinement, not a new dial
- **What:** the checkdown rung (QB E) scales only with QB AWR. Coaches also *coach* it
  ("take the check"). Rather than a new control, let the existing **QB Aggression** dial
  shade it: conservative → slightly higher checkdown willingness, aggressive → slightly
  lower. Zero new UI; makes an existing dial more honest (it already sets scramble style
  and INT tax).
- **Cost both ways:** already priced by qbAggr's existing tradeoffs (conservative gives
  up the deep tail it avoids in INTs).
- **Size / risk:** tiny. `checkdown_probe` gains one contrast. Comp% moves slightly with
  the dial — fine per-team, AI default unchanged. Do this whenever sim.js is next open.

### Deliberately NOT proposed
- **Leverage/funnel call** — fails test 3 today (auto = correct football; see Bucket 2).
  Revisit only if a bracket/funnel system ever becomes a per-receiver plan, where it
  would merge into `bracketWho` rather than stand alone.
- **Route/double-move/concept controls** — this is the **better-playbooks backlog**, not
  a dial. The coverage pass's individuated routes are exactly what a playbook pass will
  express; a "double-move rate" slider now would be a stopgap that playbooks obsolete.
- **Two-minute / clock-management dial** — execution, not identity (Bucket 2).
- **Anything touching Buy-In/Coaching-Points** — none of the above does.

---

## Bucket 4 — Surface, don't dial: the legibility gap

The passes added counterplay the player can already control but can't *see*. These are
help-manual/scouting items (and, later, capstone-trace items), zero sim risk — arguably
the highest value-per-effort in this whole doc, because an invisible mechanic might as
well not exist from the coach's chair:

- **PA feasts on loaded boxes** (YAC E): the PA dial's payoff now depends on the
  opponent's run commit. The manual's play-action page and the scout report should say
  so (in the vague-about-numbers house voice).
- **Deep drops get hurried; quick game buys time** (QB A): Pass Depth and the Quick
  protection identity now have a pressure consequence. The pocket/pre-snap-read manual
  pages should teach it.
- **Protection identity vs. pressure craft** (rush A/B/C): Half-Slide/BOB invite the
  chip context; max-protect redirects creepers. The scout memo on an opponent DC's
  blitzDesign is the counterpart.
- **Checkdowns, robbers, throwaway-less forced throws** (QB C/E, cov D): the drive log
  and (eventually) the play trace should show *who* the QB took and *why* the window was
  there. This is the capstone's Phase-1 case in miniature — several controls above only
  become fun once the play viewer can show the robber jumping the dig.

---

## Suggested order if the owner green-lights

1 (onside — trivial, immediate fun) → 5 (checkdown-into-qbAggr — trivial) → 2 (robber
call) → 4 (chip help) → 3 (match-vs-spot — biggest, gate on Step-3c ratings check).
Each ships per the standard loop: gated, default-equals-today, probe extension proving
the dial AND its cost, AI policy in `ai.js`, stat_realism at the AI mix, build → boot →
tree_probe.

---

# PART 2 — Formations & plays (owner follow-up)

Same four tests, applied to the formation/playcall layer. Traced through
`FORMATIONS` / `FORMATION_PLAYBOOK` / `FORMATION_PACKAGES` (constants.js),
`concepts.js` (30 concepts with vs-coverage tilts + exec weights), `pickPlayType` /
`conceptGroups` / the `askCall` live-call machinery in `sim.js`, and the gameplan
screen's package/call-sheet/situations sections.

## What the coach already holds here — more than any other layer

This is worth stating plainly, because half the obvious "add a control" ideas for plays
turn out to already exist:

- **The formation menu is a weighted identity.** Up to a mix of the 10 offensive
  formations with % weights, overridable per situation cell. The formation picked on a
  snap decides the personnel package on the field AND the legal call sheet
  (`FORMATION_PLAYBOOK` — Empty has no Power; Wishbone has no Four Verts).
- **The call sheet is a real playbook install.** Every one of the 30 concepts has a
  0–100 weight, global and per-situation — and **0 = "benched," which is a de facto
  playbook cut.** A coach can already run a 12-concept offense. Family dials (PA, RPO,
  screens, draws, jet, option mix/key, wildcat, QB run, pass depth, run direction,
  target shares) shade the rest.
- **Live play-calling already exists.** In a watched game (call mode: all downs or key
  downs) the game pauses and the coach picks a formation from his menu and a concept by
  name — or a category, or rides the sheet — with play-action / RPO / QB-run modifiers,
  plus the 4th-down ask and FG/punt. The concept-vs-coverage tilts then price the call.
- **Defense has scheme-level calls**: base front (4-3 / 3-4 / Nickel) with automatic
  situational sub-packages, a per-situation front pin, WR1 treatment (lock / bracket),
  shell / style / cushion, the aggression stops, pressure identity, edge, spy, green
  dog.

## Stays automatic, on purpose

- **The per-snap formation draw** from the weighted menu. Weights *are* the control;
  scripting individual snaps is what live mode is for.
- **Concept-vs-coverage pricing** (the `vs:` tilts). That's the sim's football
  knowledge, now specced play-by-play in `Ref/PLAYBOOK_SPEC.md`. The coach's control is
  *choosing the matchup*, never editing the numbers — same principle as the help-voice
  rule (vague about the coefficients, on purpose).
- **Defensive personnel matching** (auto-subs to Nickel/Dime/46/5-2). Assignment-sound
  by default, and the situation cell can already pin a front when the coach wants to
  overrule it.
- **QB audibles** — the LOS Freedom dial plus opponent memory already govern this; it's
  the QB's AWR economy, not a coach call.

## The gaps (proposals, priority order)

### F1. Defensive live calling — the biggest asymmetry in the game
The pause-and-ask machinery (`askCall` → the "playcall" pending) exists **only for the
coach's offense**. On defense, a watched game rides the gameplan with no per-snap voice
— but calling the defense every snap is exactly what a real DC does, and it's where the
shipped content (shells, robber, pressure identities, the aggression stops) would
become *felt* instead of configured. Proposal: the symmetric defensive ask — on the
opponent's key downs (or all downs), pause and take a one-snap override: front pin,
shell/style lean, aggression stop, pressure identity, plus whatever Part-1 calls ship
(robber, match). Cost: medium — a second pending kind and its sheet UI; the engine
already resolves everything from an effective plan, so the override is a one-snap
overlay. League risk: none (player-only). One hard rule: the pending token must stay
un-serialized exactly like the offensive one — `gamePauseIsLive()` already gates every
save path, and this must ride the same gate, not add a new path.

### F2. Check-with-me: calls keyed on opponent personnel, not just down-and-distance
The situations panel keys on down/distance/field zone. Real defensive call sheets also
key on **personnel/formation**: "vs Empty, bring The House"; "vs 2-back heavy, base
front, commit the box." The charter's Step-2 list called this one out
(formation-checked blitz). The sim already knows the offense's formation before the
defense resolves, so this is an overlay on `getEffectivePlan` keyed by formation
class (empty / spread / heavy / wildcat), settable to the same fields a situation cell
holds. Cost: small-medium. Cost-in-both-directions is inherent: a check spends the
cell's identity on a guess about what the formation means — motion/wildcat wrinkles
punish over-checking (the motion-read and jet mechanics already model the punish side).
AI: a light default check table for AI DCs keeps symmetry without new balance surface.

### F3. Opening script — the one call-sheet idea the source library already endorses
Source #25 (opening script / tendency management) is sitting unused: coaches script the
first 10–15 plays to probe the defense and bank tendency capital. Proposal: an
"Openers" pseudo-situation — a small ordered list (or just a weight-set) that governs
the first two drives, then hands off to the normal sheet. Cheap, flavorful, and it
feeds the tendency/memory system the sim already runs (scripted downs could seed
misdirection credit later — that hook can wait). Default = off, AI unchanged.

### F4. Deeper playbooks — content, not a control (stays in the backlog)
More concepts, crisper route trees, screens that draw like screens, throw timing keyed
to route breaks — that's `Ref/PLAYBOOK_SPEC.md` and the better-playbooks backlog, with
its own build queue, and it pairs with the capstone viewer. Nothing in Part 2 should
pre-empt it: benching + weights already give install control; what playbooks add is
*what the plays are*, and no dial substitutes for that. Flagged here only so the
controls list and the backlog don't double-ship the same ground.

### Considered and NOT proposed
- **A coverage call sheet** (per-family weights: this much Cover 2, this much Cover 3…).
  Overlaps three existing dials (shell, style, cushion) plus Part-1 #3 (match/spot),
  and it's the closest thing on either list to a solved dial — every coach would tune
  it per opponent into the same optimum the AI can't follow. The coarser identity dials
  are the safer expression of the same intent. Revisit only if F1 ships and per-snap
  coverage calls create demand for named families.
- **Custom formations / formation editor** — playbook-backlog territory at best;
  massive surface (personnel legality, role overrides, viewer geometry) for marginal
  identity gain over the 10-formation weighted mix.
- **Editing concept matchup tilts** — never. That's handing the coach the sim's answer
  key; it fails the help-voice principle outright.

## One legibility note (free win)

"0 = benched" is a real playbook install and almost invisible — a slider at zero reads
as "slider at zero," not "this play is out of the gameplan." The call-sheet header
and the calling-a-game manual page should say it in the house voice. Same for the
formation→call-sheet coupling (why Four Verts vanishes when the Wishbone weight is
100).

## Combined suggested order (Parts 1 + 2)

Trivial tier: **1 onside**, **5 checkdown-into-qbAggr**, the legibility notes.
Medium tier: **2 robber call**, **4 chip help**, **F3 openers**, **F2 checks**.
Large tier: **3 match-vs-spot** (gate on Step-3c), **F1 defensive live calling** (the
biggest single upgrade to how the game *feels* to coach, and the one that makes the
Part-1 calls worth calling).
