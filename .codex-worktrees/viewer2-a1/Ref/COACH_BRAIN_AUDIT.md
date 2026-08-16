# COACH BRAIN AUDIT — full map + Madden-style play calling + the gap list
*2026-08-08. Audited: sim.js, ai.js, coach.js, coachprofile.js, situations.js, formations.js,
staff.js, concepts.js, season.js, world.js, ui/app.js, views/gameplan.js, views/playnow.js.*

**Verdict up front:** the coach brain is deep and almost fully wired — five layers
(gameplan → situation cell → weekly plan → live call → per-snap AI) all reach the sim.
Madden-style **offensive** every-snap calling already existed (`callMode:"all"`); the two
structural holes were the **defense** (hard-locked to key downs whatever the mode) and two
defensive dials the engine honored but the panel never offered. Both shipped this pass
(§4). Everything else found is in the gap list (§3).

---

## 1. THE BRAIN, MAPPED

### 1.1 Offensive snap pipeline (simulateDrive, sim.js:2876)

Order per snap: kneel/spike gates → 4th-down block → playcall ask → defcall ask →
pre-snap penalty → situation resolve → effective-plan build → formation roll →
check-with-me overlay → front select → `pickPlayType` → forced-call override →
personnel/coverage-family/disguise → QB kill call → shot-call memory → concept pick →
QB audible → unit strengths → mechanic rolls (option/RPO/jet/wildcat/draw) → resolver.

Key functions and what feeds them:

| Decision | Function | Inputs |
|---|---|---|
| Situation | `resolveSituation` situations.js:5 + `offSitWithOpeners` sim.js:156 | down/dist/field/margin/clock; openers cell owns drives 1–2 |
| Effective plan | `getEffectivePlan` situations.js:18 | precedence `weeklyPlan ?? cell ?? base ?? default`, per field |
| Formation | `rollFormation` formations.js:159, call site sim.js:3476 | weighted `offFormations`; a named concept narrows to formations that carry it (`FORMATION_PLAYBOOK`) |
| Run/pass | `pickPlayType` sim.js:2656 | `PASS_TENDENCY[tendency]` + formation lean ±, down/distance/score shifts (bypassed when a situation cell pins tendency), `passDepth` + `qbAggr` shading |
| Concept | `pickPassConcept`/`pickRunConcept` sim.js:111/128 | `conceptWeights` (situation-merged), coverage-family matchup `c.vs[fam]`, personnel `minWR`, `execSkill` of the actual roster, box state `c.vsBox` |
| Pre-snap | disguise sim.js:3613, kill call 3633, audible 3667, shot memory 3646 | QB AWR/TEC vs DC blitzDesign + safety AWR; `losFreedom` gates; `offCtx._covSeen` looks-memory |
| Mechanics | sim.js:3755–3818 | `optionRate/rpoRate/jetRate/drawRate/qbRunPct` × formation capability tables |

### 1.2 Defensive call pipeline

Front `selectDefFront` formations.js:210 (personnel-matching, `subPhilosophy`);
shell/style → `coverageFamily` sim.js:190; three-layer pressure model (aggression stop →
`pressureCallRate` sim.js:60 with down-leverage + DC blitzDesign timing → who-comes by
`pressureIdentity` with formation-tell scaling sim.js:1112); coverage detail
`assignCoverage` sim.js:748 (`coverageScheme` lock/bracket, `bracketWho` incl. `hot` off
in-game target memory); `robberCall`, `zoneStyle` (match-carry busts by zone-defender IQ),
`pressLevel`, `edgePlay`, `runCommit`, `spyQB`, `greenDog`, `optionKey`, `tackleStyle`.

Live-call plumbing: `applyDefCall` sim.js:166 overlays `defEff` **before** `defPlanEff` is
built (F1 law); check-with-me `formChecks` overlay sim.js:3484 applies only when no live
call (`{_ride}` lets checks through); live call outranks check.

### 1.3 In-game decision engine

| Decision | Where | Driver |
|---|---|---|
| 4th down | `fourthDownDecision` sim.js:2733 | distance/field bands × `fourthDown` approach × late-trailing multipliers; `maxFGDist` + `fgLateStretch`; riverboat DNA on conversion |
| 2-pt chase | sim.js:4440 | `patApproach` chart (kick/chart/aggressive margins) |
| ST fakes | sim.js:3034 | `stFakes` never/occasional/aggressive |
| Timeouts | sim.js:4049 (coach), 4056 (AI: trailing side, <2:00, run plays), 2919 (kneel response) | plus `_nextPlay` timeout-adjust overlay sim.js:3398 |
| Kneel/spike | sim.js:2902/2947 | timeout-aware burnable-clock math; one spike per drive |
| Tempo | situations.js:28 | weekly ?? cell ?? `SMART_AUTO_TEMPO` ?? base; `_liveTempo` wins everywhere |
| Onside | sim.js:4518 | desperation (<3:00 trailing) or armed `surpriseOnside` (one per game) |
| Punt | sim.js:3078 | `puntDef` block/safe economics, fair-catch, deep-snap safety |

### 1.4 Coach identity stack (who is calling this stuff)

- **DNA** (`coachprofile.js`): 13 axes; 11 reach the sim (groundPound, airAttack,
  pressure, ballHawk, ballSecurity, discipline, riverboat, roadWarrior, specialTeams +
  reads in §3's gaps). `adjustments` and `motivator` have **no sim read** (gap #4).
- **Coordinators** (`staff.js`): OC/DC ratings (blitzDesign → disguise/timing/hot-throw
  suppression; qbRunDesign; scheme IQ per formation → `coordIqMod` multiplier and penalty
  rate). Identity strings are display-only.
- **AI gameplan** (`ai.js:56 setAIGameplan`): roster-derived lean → tendency bucket,
  formations, concept weights (`aiConceptWeights`), situations (`buildAISituations`),
  fronts, tempo, 4th-down approach.
- **Weekly scouting** (`ai.js:270 aiSetWeeklyReaction`): **live** — called from
  season.js:746 for every AI team, `COACH_IQ` scaling vs the player from
  `settings.diffCoaching`. Shifts runCommit/blitz/shell/style/edge/optionKey, arms
  surprise onsides for underdog aggressives.
- **In-game learning** (sim.js:4259): `seenMemory` → `familiarityMult` (type/formation
  spam), `conceptSpamPen`, `_covSeen` offense-side, pre-game bracket/lock of a ≥28%-target
  receiver, `_tendencyKey` box bias vs extreme tendencies.
- **Halftime**: player 3-chip adjust (offlean/deflean/fresh, state.js:738) + AI
  `setAutoCounter` sim.js:4278 (top-formation counter, IQ-scaled in career).

### 1.5 The five control layers a snap resolves through

`gameplan defaults` → `situation cell` (12 keys incl. openers) → `weeklyPlan` →
`formChecks` (personnel-triggered) → `live headset call` (playcall/defcall pendings).
All verified reaching `*Eff` fields. This is more layers than Madden has.

---

## 2. MADDEN-STYLE PLAY CALLING — where it stands

Already there before this pass: **Every Snap mode** (`callMode:"all"`) for the offense —
kickoff modal option, mid-game switches, skip-to-break, live-watch integration, the full
call sheet (formation strip → 6 category tiles with favorites → concept drill-down with
play-art SVG, coaching notes, off-the-sheet reasons, PA/RPO/QB-run modifiers, ST block,
surprise-me). 4th-down prompts widen to `fourthDownIsCoachCall` in this mode. Exhibition
(Play Now) is hardwired to it.

**Was missing → shipped this pass (§4):**
- Defense was locked to key downs in every mode (`askDefCall` ignored `callMode`,
  sim.js:4388 + OT 4845) — now every snap in "all".
- `applyDefCall` honored `zoneStyle` and `runCommit` but the dc-panel never offered them —
  now ZONE RULES and BOX rows.

**Still open (gap list):** suggested-plays row (#5), repeat-last-call (#7). Hot routes /
individual audibles are the QB's job in this engine (AWR-gated audible/kill-call — that's
a design choice, not a hole: your QB's brain is a stat).

---

## 3. THE GAP LIST — what's in there that we don't have (or half-have)

Numbered for picking. ✅ = shipped this pass.

1. ✅ **Every-snap defensive headset in Every Snap mode.** Was key-downs-only by F1
   design; Madden mode is both sides of the ball. Key Downs mode unchanged.
2. ✅ **ZONE RULES + BOX rows on the defensive panel.** `applyDefCall` accepted
   `zoneStyle`/`runCommit` since P1/F2 but only `formChecks` could reach them. BOX chips
   send standing±8 (relative), clamped by the same ±25 law.
3. ✅ **Halftime "Protect the QB" and "Shadow their WR1" chips — orphaned engine reads.** Shipped in pass 3 (§7).
   `_h2Protect` (sim.js:1287, protection multiplier) and `_h2Shadow` (sim.js:1828,
   per-receiver separation tax) are read by the sim but **no writer exists anywhere** —
   the halftime feature that set them was removed when adjustments became the 3-chip set.
   `tools/h2_shadow_probe.mjs` still exists with an eff-sizing ladder. Cheapest
   high-flavor win in the file: two more halftime chips, plumbing already live.
4. ✅ **`dna.adjustments` axis has no sim read** — CORRECTION + shipped in pass 3 (§7): the career halftime path already scaled chip eff by the axis (season.js `1 + grade*0.1`); the new chips inherit it. (coachprofile.js:579 promises "halftime
   adjustment strength +N%"). Natural pairing with #3: scale halftime chip eff by the
   axis grade. `motivator` is documented identity-only — fine.
5. **Coach suggestions on the call sheet.** (Pass 2's formation page weight-orders
   every play, which is most of the way there; a cross-category "what the sheet would
   call HERE" row is what remains.)  Madden's "suggested plays": one row of the
   top-3 situation-weighted legal concepts (weights × `vs` family guess × exec skill),
   with the one-line why. All inputs already computed at ask time (`askEff`).
6. ✅ **AI ignores its own playbook carry rule.** Shipped in pass 2 — the carry gate is
   now always on (see §6); stat_realism re-checked, same three pre-existing flags.
7. **Repeat-last-call / recent-calls row.** The sheet has no "run it again" — Madden
   staple, trivially cheap (last 3 coach calls as one-tap chips on the sheet).
8. **Clock gamesmanship flavor:** no icing the kicker (defense TO before a FG), no squib
   kick, no take-a-delay-to-punt-room. Small dials, all fit the existing timeout/kick
   plumbing.
9. **4th-down brain is a static band table.** It ignores the actual kicker's leg beyond
   `maxFGDist` and the opponent's offense strength (a WP-flavored nudge — "your defense
   can't stop them anyway, go" — would use only numbers already on the token). Feel is
   fine today; this is polish.
10. **Defensive "openers" is a phantom.** `SITUATION_KEYS` includes it both sides but the
    defense never resolves to it (sim.js:3377) and the UI hides the tab — by design, but
    either wire scripted defensive openers or drop the key from the defense path.
11. **Dead fields generated every load:** `gp.pressureSource` (written by setAIGameplan,
    deleted by normalizeDefGameplan), `gp.clockMgmt` (deleted, no writer). Cleanup only.
12. **Exhibition auto-counter ignores difficulty.** state.js:744 calls `setAutoCounter`
    without the iq arg (always "varsity"); career path passes `settings.diffCoaching`
    correctly (season.js:893). One-line fix if exhibitions should respect difficulty.

*Corrections to earlier notes: `aiSetWeeklyReaction` and the career `setAutoCounter` IQ
are **not** dead — both live in season.js (746/893). The audit confirmed the weekly
scouting layer fires for every AI team.*

---

## 4. WHAT SHIPPED — PASS 1 (Madden mode: every-snap defense)

**Engine (`js/engine/sim.js`):**
- `askDefCall` in `playHalf` (and the OT twin) now mirrors the offensive ask: `callMode
  "all"` → ASK every opponent snap; `"keydowns"` → key downs (unchanged); comment updated.
  Same pending kind, same `{_ride}` sentinel, same save law — zero new machinery.
- The defcall `standing` pack now carries `zoneStyle` so the panel can label the new row.

**UI (`js/ui/app.js`):**
- `DEF_CALL_ROWS` + ZONE RULES (`spot`/`match`) and BOX (`−8`/`+8`) rows; `planLabel`
  entries for both (BOX shows the standing count as "+N committed / −N light / even box").
- `dc-send` converts a BOX pick to `standing.runCommit ± 8` before sending —
  `applyDefCall` clamps to ±25. All other rows unchanged.
- Kickoff-modal Every Snap copy: "every play on offense AND defense, plus the big
  4th-down calls."

**Harnesses:**
- `tools/coach_controls_probe.mjs`: +5 M1 checks — both modes drain, "all" asks defense
  on ordinary downs, "keydowns" never does, cadence actually widens, standing carries
  zoneStyle.
- `tools/playnow_smoke.mjs`: settle loops now ride dc-panel stops (`#dc-ride`), guarded
  the strict 4th-down click. (ui_playcall_smoke already rode them.)

**Not touched:** uncoached sims (asks only exist when `callMode` is set), Key Downs mode,
check-with-me, F1 live-call mechanics, saves (same pending kinds). stat_realism therefore
not re-run — no AI-sim path changed.

## 5. VERIFICATION (all green, 2026-08-08)

coach_controls_probe **13/13** (8 original + 5 new M1; every-snap def = 24 asks vs 7 in
key-downs, 14 on ordinary downs) · ui_playcall_smoke PASS · playnow_smoke PASS (harness
updated) · playnow_saved_multiplayer PASS · coach_mode_halftime PASS · watch_live PASS ·
midgame_save PASS · save_safety PASS · build 8/8 checks · boot PAGEERRORS 0.

---

## 6. WHAT SHIPPED — PASS 2 (formation-specific playbooks, "the full Madden model")
*Same day. Owner: Madden-style play calling = formation-specific playbooks, more robust
than the static carry table.*

Formation playbooks are now first-class, on all three layers:

**Engine (`js/engine/sim.js`):**
- **Carry gate always on.** `FORMATION_PLAYBOOK[formationId]` now gates concept selection
  on EVERY snap — AI included — not just coach-forced ones (closes gap #6). Both pick
  functions already fall back to the ungated pool if a formation/depth combo empties, so
  the gate can never brick a snap.
- **Authored per-formation sheets.** New gameplan field `gp.formationPlaybooks[fid] =
  {concept: weight}`. At pick time the formation's sheet OVERLAYS the situation-effective
  weights concept-by-concept: bench a play there (0) and it never runs from that
  formation whatever its global weight; feature one and it takes over those snaps.
  Absent — every existing save — behavior is byte-for-byte the old merged sheet
  (zero-migration law). The QB audible honors both the gate and the overlay.
- Playcall pendings + `callContext` carry `formationPlaybooks` so the panel shows the
  exact book the engine will pick from. `pickPassConcept`/`pickRunConcept` exported for
  the probe.

**Gameplan (`js/ui/views/gameplan.js`):** the Playbook tab gains a chip strip — GLOBAL
SHEET plus one chip per carried formation (with an authored-count badge). Picking a
formation shows *its* sheet: only the plays it carries, sliders showing the effective
weight, an "set here · tap to inherit" pill on authored plays (tap = back to inheriting
global), and a whole-sheet reset. Slider semantics identical to the global book (0 = cut).

**Call sheet (`js/ui/app.js`):** pin a formation and the six category tiles are replaced
by **that formation's playbook page** — every play it runs, grouped (runs / quick /
dropback / shots / gadgets), weight-ordered best-first, play-art tiles, one tap to call,
per-group Surprise me, INFO previews, and the OFF THE SHEET section with reasons. Auto
brings the category tiles back. Weights shown are the situation weights overlaid with the
pinned formation's authored sheet — exactly what the engine will use.

**Deliberately not done:** AI teams don't author per-formation sheets yet (they run their
global book through the carry gate). A cheap follow-up: `setAIGameplan` tilting option
formations toward option/PA and spread formations toward the spread pass — re-run
stat_realism if built.

### Pass-2 verification (all green, 2026-08-08)
- **formation_playbook_probe** (new): carry gate 0 escapes in 30k hostile-weight reps;
  impossible list falls back; roster-paired game arms — formation-benched Mesh 0/450
  (global weight 95), formation-featured Four Verts 7→48; AI stays inside Jumbo's book
  across 573 snaps.
- **formation_sheet_ui_smoke** (new): pin → formation page (31 tiles for Spread) →
  INFO → call → game resumes → Auto restores tiles. Zero page errors.
- **formation_playbook_ui_smoke** (new): full new-game wizard → Settings→advanced →
  Playbook tab → chips → author/inherit/reset cycle. Zero page errors.
- Regression: coach_controls 13/13 · tendency · playbook_build · save_migration ·
  ui_playcall_smoke · playnow_smoke · build 8/8 · boot 0 pageerrors.
- **stat_realism** re-run (the AI gate shifts pools): same three pre-existing flags only
  (rush 144.4, comp 57.5, INT 1.62 vs remembered 143/57.9/1.7) — no new flags, RB ypc
  4.74 in-band-adjacent as before.

---

## 7. WHAT SHIPPED — PASS 3 (the gap list: G3, G4, G5, G7, G8, G10, G11, G12)
*Same day. Owner: "do these" on the remaining gap list. (G6 had already shipped in pass 2.)*

**G3 — Protect the QB / Shadow their WR1 halftime chips.** The orphaned reads got their
writers back, in both game paths (career `resumeFromHalftime`, exhibition `resumeHalftime`):
- 🧱 **Protect the QB** → `_h2Protect {eff: 0.10}` — multiplies the pass-rush success term
  (`resolvePassRush` protectMult) down 10% for H2. Mechanism-gated in the probe: sacks
  ~4.0→3.5%, pressure ~35.6→33.5% per rep at the shipped multiplier.
- 🕶 **Shadow <their hot receiver>** → `_h2Shadow {id, eff: 0.07}` — the separation tax on
  the one man. The chip names the opponent's leading receiver at the half (the halftime UI
  already computed him) and rides his id through. Eff sized off `h2_shadow_probe`: 0.07 ≈
  −31% whole-game on his line ≈ 15-20% over an H2-only bracket — in the probe's own band.
- Both are graded post-game like the original three (protection: H1 vs H2 sacks allowed;
  shadow: H1 vs H2 receiving yards for the bracketed man) and feed the same
  `dna.adjustments` XP loop.

**G4 — correction, not a build.** The audit (and the earlier summary) called the
`adjustments` axis unread — wrong in the same way `aiSetWeeklyReaction` was: the read
lives in season.js (`strength = 1 + grade*0.1`, capped per chip), not sim.js. All five
chips now scale with it in career; exhibition stays at base eff (throwaway teams).

**G5 — COACH'S CALL row.** The call sheet's top strip now shows the three legal plays the
sheet leans hardest toward in the exact situation — situation weights, formation overlay,
carry, personnel and PA/RPO locks all applied — as one-tap ★ call buttons.

**G7 — RECENT row.** Your last three distinct real calls this game (still-legal ones) as
one-tap ↻ repeat chips. Both rows reuse the existing `data-cs-callconcept` wiring.

**G8 — clock gamesmanship.** Two automatic behaviors, both sides, no new dials:
- *Icing the kicker* — clutch FG (make ties/wins; H2 ≤3:00 or OT), defense holding a
  timeout: 55% chance it burns one pre-snap ("ices the kicker" in the log), and
  `C.ICE_KICKER_EFF` (4%) of would-be makes get shaken loose. Play stamped `iced`.
  Note: natural windows are rare in AI-vs-AI play (~1-2 kicks/60 games) because late
  trailing teams mostly GO — that's gap #9's territory, unchanged.
- *Squib kick* — leading with ≤12s in a half, the kickoff is squibbed: receivers start
  around their 28-48, zero return (and zero return-TD lottery). Play stamped `squib`.

**G10 —** documented at `SITUATION_KEYS`: openers is offense-only by design; defensive
fields in an openers cell are inert. **G11 —** `setAIGameplan` no longer generates the
dead `pressureSource` blob (the load-time delete stays as migration); `clockMgmt` had no
writer to remove. **G12 —** exhibition halftime `setAutoCounter` now passes
`settings.diffCoaching` like the career path.

### Pass-3 verification (all green, 2026-08-08)
- **gaplist_probe** (new), 3/3 consecutive clean runs: protect mechanism gate (30k reps,
  noise-free — the whole-game A/B flapped sign exactly as the probe-craft notes warn);
  iced kicks appear (natural + forced via rigged 2-point-deficit token games) and only in
  clutch spots; squibs appear at half-ends and are never returned for TDs.
- **coach_mode_halftime_smoke** extended: both new chips render, arm, and Shadow carries
  its target id. **formation_sheet_ui_smoke** extended: COACH'S CALL renders (3 picks);
  RECENT appears after a real call.
- Regression: coach_controls 13/13 · formation_playbook · ui_playcall · playnow E2E ·
  midgame_save · save_safety · tendency · save_migration · build 11/11 · boot 0.
- **stat_realism** (icing/squib touch AI games): same three pre-existing flags (rush
  145.1, comp 57.7, INT 1.67), sacks 2.16 in target — no new flags.

**Still open:** G9 (4th-down WP polish — the "trailing late teams almost never kick"
quirk is why icing windows are rare) and the pass-2 follow-up (AI-authored formation
sheets). Everything else on the list is closed.
