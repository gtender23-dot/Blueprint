# PLAYBOOK ↔ DIALS COHESION AUDIT — D10 (2026-08-18)

**The owner's question:** *"The playbooks aren't meshing yet. Find wherever there is
conflict with the old systems and dials and controls. The playbooks may also eliminate
the need for controls we used to have. I want maximum cohesion with the playbooks and
gameplan controls."*

**One-sentence verdict:** the books and the dials are not two systems fighting — they
are ONE flat bag (`school.gameplan`) written by **26 writer sites in 9 files**, none of
which uses the two verbs the architecture built for the job, overlaid by **five layers
whose precedence was never written down and is provably order-dependent** — and the
defensive card compiles through **three different vocabularies**, so one card means
three different defenses depending on which seam it reaches the sim through. Everything
below is evidenced file:line; the sharpest claims are pinned by a new CORE probe
(`tools/plan_cohesion_probe.mjs`, 44/0 ×3).

---

## OPEN DECISIONS (phone-first — each stands alone)

> **RATIFIED 2026-08-17 — owner returned a blanket YES to all twelve, each at its
> stated recommendation.** Per-OD dispositions marked below; recorded in
> `Ref/STATUS.md` (2026-08-18 ratification entry). All D-blocks blocked on ODs
> are now unblocked, subject to D11–D17's own dependency order.

**OD-1 · Who owns COVERAGE: the family card or the shell/style/cushion trio?**
**RATIFIED (a):** the family is the CALL grammar, the trio is the STANDING identity — a named family beats the dials on its snap, formalized.
PROVEN (probe §1): a card/call carrying `covFamily` overwrites `covShell`/`covStyle`
unconditionally (sim.js 200-208) and never touches `pressLevel`. The trio and the
family are two grammars for one quantity.
*Options:* (a) family is the CALL grammar, trio is the STANDING identity — formalize
"a named family always beats the dials on its snap"; (b) cards compile to dials only
(drop the covFamily pin, lose Tampa 2/Cover 6 as first-class calls); (c) keep both,
document precedence.
*Recommendation:* (a) — it's what the code already does on the snap; the defect is that
nothing says so and the CHK layer half-breaks it (OD-2).
*Cost of wrong:* coaches keep authoring dials the family silently discards.

**OD-2 · When a personnel CHECK and a sampled CALL both fire, who wins?**
**RATIFIED (a)+(c):** the check (more specific layer) wins — it clears/overrides `covFamily` when it writes shell/style — and the check vocabulary learns the coverage pictures.
PROVEN (probe §2): the check overwrites a plain-dials call's shell/style (CHK runs
after CALL on the same `defEff`, sim.js 4768→4776) — but the check **cannot clear
`defEff.covFamily`**, and the coverage pick (4958) short-circuits on the family. The
SAME check wins 100% against a dials call and is ignored 100% against a family call.
*Options:* (a) check wins — a check clears/overrides `covFamily` when it writes
shell/style; (b) call wins — checks skip snaps that sampled a call; (c) checks learn
to speak families themselves.
*Recommendation:* (a)+(c): the more specific layer (personnel) should win, and the
check vocabulary should include the coverage pictures (it's the DPB2 "answers" seam —
today `cardToFormCheck` DROPS the family coverages entirely, defbook.js 94-105).
*Cost of wrong:* the shipped starter books' vs-personnel answers already lose their
coverage on compile (Dime Tampa 2 as an answer checks the front but not the Tampa 2).

**OD-3 · The timeout `_nextPlay` overlay beats the live headset call. Intended?**
**RATIFIED:** the headset wins — `forcedCall`/`forcedDefCall` beat `_nextPlay` on overlapping keys.
`Object.assign(eff, plan._nextPlay)` (sim.js 4650-4658) runs AFTER the forced defcall
apply (4645) — so a Next-Play timeout adjustment silently overrides fields of the
coach's explicit headset call on that snap. Every prior doc says "your live headset
call still beats the sheet"; nothing says what beats the headset.
*Recommendation:* forcedCall/forcedDefCall win over `_nextPlay` on overlapping keys
(both are human, but the headset is the later, more specific intent).
*Cost of wrong:* rare, but it's the coach's own two hands fighting.

**OD-4 · The Box speaks two semantics and three magnitudes under one label.**
**RATIFIED:** DELTA at every overlay layer (call/check/headset), ABSOLUTE only on the standing dial; one overlay magnitude (±10); starter-card values restated on that scale.
A CALL's `runCommit` is ABSOLUTE (`clamp2(o.runCommit,-25,25)`, sim.js 196); a CHK's is
a DELTA (`defEff.runCommit + _chk.runCommit`, 4786); CALL-then-CHK stacks
absolute-then-delta (order-dependent by construction). UI: CALL_FIELDS ±10
(gameplan.js 2003), CHK_FIELDS ±8 (1987), headset ±8-relative (app.js 3288 +
2638-2643/2682-2687 conversion), standing slider ±25, cell slider ±20, starter cards
carry 1–3 in one book and 12–18 in another (defaultbooks.js 88 vs 261) while the
creator clamps 0–20 (creatordef.js 281). All labeled "Box".
*Recommendation:* one semantic — DELTA at every overlay layer (call/check/headset),
ABSOLUTE only on the standing dial; one overlay magnitude (±10); restate starter-card
values on that scale.
*Cost of wrong:* the same button moves the box by different amounts through different
doors, and nobody can tune it.

**OD-5 · `coverageScheme: aggressive / conservative` is a placebo.**
**RATIFIED (b):** narrow every writer and the picker to the three values the engine speaks; the book field keeps loading old data.
PROVEN (probe §5): `assignCoverage` branches only on `lockTop`/`bracketTop` (sim.js
1085, 1218, and the lockTop branch at 1046); "aggressive"/"conservative" resolve
exactly as "balanced". Yet the defbook picker offers all five AND claims "the five
coverage identities the sim honors" (comment corrected this session, defbook.js 117);
the shipped **Attack 3-4 starter carries "aggressive"** (defaultbooks.js 117); Simple
mode writes both values to gp and cells (gameplan.js 428/433/459/465).
*Options:* (a) give the two values a sim meaning; (b) narrow every writer to the three
the engine speaks (progressive disclosure — the book field keeps loading, the picker
stops offering placebos).
*Recommendation:* (b) now, (a) only if a pass wants it — a placebo control violates
"the player can see it work" (AUDIT_CONTROLS_GAPS test 4).
*Cost of wrong:* coaches "set" an identity that does nothing; the starter book teaches
them to.

**OD-6 · Unify the card's three compile vocabularies (the DPB2 1:1 claim is FALSE).**
**RATIFIED:** one exported CARD_VOCAB table read by all three compiles; sim call path gains the missing keys — ships band-gated via dispatch D12.
PROVEN (probe §4): one card through the three seams — `cardToDefCall` emits
`pressLevel` (dropped by pickDefCall's normalizer + applyDefCall — the headset ignores
a card's cushion) and carries `dogGame`; `cardToCell` honors `pressLevel` but drops
`dogGame`; `cardToFormCheck` drops `robberCall`/`zoneStyle`/`pressLevel`/`dogGame` AND
the family coverages' shell/style. A card's `greenDog` is read by none of the three
(the shipped "Dime Green Dog" card's green dog never compiles). Same card, three
defenses.
*Recommendation:* one exported CARD_VOCAB table; all three compiles read it; the sim's
call path gains the missing keys (`pressLevel` at minimum) — outcome-bearing, so it
ships band-gated after the owner ratifies the vocabulary table (dispatch D12).
*Cost of wrong:* the book's promise ("the card is a picture of data the engine already
speaks") stays false and every future card feature lands in one seam and not the others.

**OD-7 · Starter cards carry values the engine can't parse (nobody validates extras).**
**RATIFIED:** typo-reading per the audit — the zoneStyle values are `rotation` typos (sky/cloud/buzz-class), `robberCall: true` → `"rob"`; the fixing D-block also extends `validateDefBook` to the extras enums. Band-gated.
PROVEN (probe §5): `zoneStyle: "fire"/"soft"` (Pressure Everything),
`zoneStyle: "sky"/"cloud"/"quarterQuarterHalf"` (Coastal Cover 3 — these look like
they were meant for the `rotation` key, whose legal values are sky/cloud/buzz),
`robberCall: true` in six cards across three books (legal values auto/rob/overtop —
`true` behaves as auto, so "Dime Robber" and "Dime Rat Trap" rob nothing),
`greenDog: true` (never compiled). `validateDefBook` checks
name/front/coverage/bring/look/weight and nothing else (defbook.js 192-199).
*Recommendation:* owner states intent per card (most look like `rotation` typos and
`robberCall:"rob"`); a D-block fixes the data AND extends `validateDefBook` to the
extras enums so the class can't ship again. Outcome-bearing (a real robber call
activates a real mechanic) → band-gated.
*Cost of wrong:* the flagship starter books advertise defenses they don't play.

**OD-8 · `blitzPct`: finish the retirement.**
**RATIFIED:** every writer writes the stop (`setAggr`/`aggrStopFromBlitzPct` at write time); `blitzPct` becomes derived-only. Band-gated.
The stop (`defAggression`) is the dial; `blitzPct` is supposed to be its derived
mirror (sim.js 48 re-derives it unconditionally at every kickoff). But THREE writers
still author raw numbers: `ai.js:297` (15–35, discarded at first kickoff),
Simple-mode Defensive Posture (gameplan.js 458-474 — writes `blitzPct` 38/10/20
WITHOUT touching `defAggression`, so if a stop is already set the Simple dial is
silently discarded at kickoff), and Simple-mode situation cells (422-437, re-migrated
every game by sim.js 53-55).
*Recommendation:* every writer writes the stop (`setAggr` or `aggrStopFromBlitzPct`
at write time); `blitzPct` becomes derived-only. Near-neutral by construction (the
sim already quantizes), but band-gate it.
*Cost of wrong:* the Simple dial keeps losing arm-wrestles the player can't see.

**OD-9 · `pressureSource` is a zombie the book still carries.**
**RATIFIED:** progressive retirement — off the book editor's front page, old books keep loading, dropped at the next schema bump, stated in the release note.
Written by `defaultGameplan()` (world.js 1736), `applyDefBookToGameplan`
(defbook.js 234), the creator UI (creatordef.js 243); displayed by the Game Plan
identity card (gameplan.js 172); **deleted by the sim at every kickoff**
(sim.js 51, "pressureSource retired (G11)" per ai.js 298) and read by no mechanic.
The defensive book schema and UI ship a control that does nothing.
*Recommendation:* retire it from the book editor's front page (progressive
disclosure: keep loading old books, stop presenting the dead sliders), drop it at the
next schema bump. NOT a silent deletion — say it in the release note.
*Cost of wrong:* the book's most visual identity widget (the pressure pie) is a
placebo.

**OD-10 · Ratify the writer-graph collapse (Stage 3 for real).**
**RATIFIED:** dispatch D16's sequencing as written — writers routed through the verbs, `_equiv_walk` byte-gated per batch.
`assignBook` / `assignDefBook` / `setOverlay` (teamplan.js 299-318) have **ZERO
production callers** — only `playbook_root_probe` exercises them. 26 writer sites in
9 files write `school.gameplan` directly; 9 re-synthesize the books afterward
(gameplan→book, the INVERSE of the target flow); 17 don't re-synthesize at all. The
riskiest four: the wizard (`newgame.js:800-843`, runs AFTER `synthesizeLeaguePlans`,
leaving `school.book` a stale pre-book snapshot), every Game Plan dial
(`gameplan.js wireDefaultsListeners`, ~55 direct writes, no re-synth), the quick-plan
A/B/C slot swap (gameplan.js 2906, whole-plan `Object.assign`, no wipe, no re-synth),
and `applyIdentityToSchool` (world.js 926-936).
*Recommendation:* ratify dispatch D16's sequencing (route writers through the verbs,
`_equiv_walk` byte-gated per batch). This is the root cause of "the playbooks aren't
meshing": the books are derived FROM the bag, so nothing the book says can bind.
*Cost of wrong:* every future book feature keeps being a view over a bag that 26
writers scribble on.

**OD-11 · `PLAN_FIELD_SIDE` has gaps — a book swap doesn't own its whole side.**
**RATIFIED:** extend `PLAN_FIELD_SIDE` (data + probe update) AND the defbook compile rebuilds/clears `callSheet` (behavioral D-block).
The manifest carries 46 fields, but the sim also consumes standing fields that are
NOT in it and therefore live in the overlay: `screenRate`, `paRate`, `chipHelp`,
`wildcatPassRate`, `rpoKeepPct`, `rbCarryShares`, `runDirection` (offense);
`callSheet` (defense — `defCalls` is book-owned but the SHEET that weights them is
overlay); `stFakes`/`puntDef`/`retScheme`/`patApproach`/`surpriseOnside` (team,
arguably fine). Concrete symptom: loading a defensive book replaces `defCalls` but
keeps the old `callSheet`, whose rows name calls that no longer exist —
`pickDefCall` filters them (sim.js 260) so the matchup sheet **silently goes dead**.
*Recommendation:* extend the manifest (data + probe update — safe), and make the
defbook compile rebuild or clear `callSheet` (behavioral — D-block).
*Cost of wrong:* book swaps keep half-taking effect.

**OD-12 · The plan-report badge lists are wrong (small, but it lies to the coach).**
**RATIFIED:** derive the badge lists from PLAN_FIELD_SIDE ∩ cell-writable set — its own tiny D-block.
`PLAN_OFF_FIELDS`/`PLAN_DEF_FIELDS` (app.js 1662-1663) drive the CUSTOM/AUTO badge
(app.js 1745). `PLAN_DEF_FIELDS` lists `pressureIdentity`, which no situation cell
can carry (the SIT editor has no control for it; AI cells don't write it) — dead
entry. Both lists omit most of what the SIT panel DOES write (`covShell`, `covStyle`,
`pressLevel`, `edgePlay`, `optionKey`, `subPhilosophy`, `tackleStyle`, `optionRate`,
`jetRate`, `drawRate`, `protEmphasis`, `qbAggr`, `conceptWeights`) — a cell customized
via those reads AUTO.
*Recommendation:* derive the lists from PLAN_FIELD_SIDE ∩ cell-writable set. UI-only,
cheap, but it changes rendered DOM → its own tiny D-block, not Part C.

**Verify-first (could not fully prove here):** `tendency` enters `pickPlayType` by two
doors — the RAW base plan at sim.js 3594 and the cell-effective value passed as
`sitTendency` at 4805. Whether the double-read double-counts a cell tendency or is a
deliberate base-vs-cell contrast needs a dedicated read+probe before anyone touches it.

---

## THE OVERLAY PRECEDENCE CHAIN (as-built, from code — Part A3)

| # | Layer | Applied at | Mechanism | Notes |
|---|---|---|---|---|
| 1 | weeklyPlan | situations.js 18-82 | per-field ?? chain | weekly > cell > standing, only for the fields getEffectivePlan names |
| 2 | situation cell | situations.js 18-82 | same chain | cell dialect: `defFront`, `tempo`, `blitzPct`(legacy) |
| 3 | forcedDefCall (headset) | sim.js 4645 | `applyDefCall` merge onto defEff | **suppresses layers 5+6 entirely** (4768/4776 guards) unless `_ride` |
| 4 | `_nextPlay` (timeout) | sim.js 4650-4658 | `Object.assign(eff, np)` | **clobbers layer 3 on overlap** — OD-3 |
| 5 | defCalls × callSheet (CALL) | sim.js 4768-4775 | pickDefCall → applyDefCall → syncDefEff | merge-if-truthy; runCommit ABSOLUTE |
| 6 | formChecks (CHK) | sim.js 4776-4790 | applyDefCall → syncDefEff | merge; runCommit DELTA; **beats CALL dials, cannot clear covFamily** |
| 7 | front/coverage resolve | sim.js 4791-4801, 4958 | `defEff.defFront`, `covFam` short-circuit | family (if set) beats the dials the CHK just wrote |

Order-dependent snaps, proven: CALL(family)+CHK(dials) — check ignored at the name
layer (probe §2); CALL(abs box)+CHK(delta box) — final box depends on order by
construction. Also note `syncDefEff`'s fixed 18-key list (sim.js 224-244) is the only
bridge to `defPlanEff` — `defFront` is deliberately not in it, so the penalty stamp
(4531) reads the RAW plan's front while the field plays the called one.

## THE WRITER GRAPH (Part A2)

Target: two verbs. Reality: **26 writer sites, 9 files; the verbs have 0 production
callers** (grep: `assignBook`/`assignDefBook`/`setOverlay` appear only in
teamplan.js and playbook_root_probe). 9 sites re-synthesize (data flow gameplan→book,
inverse of target); 17 bypass with no re-synth. Full table lives in the census
(agents' evidence, reproduced in dispatch D16): highest-risk are newgame.js 800-843
(wizard, stale books), gameplan.js wireDefaultsListeners/wireSituationListeners
(every dial), gameplan.js 2906 (slot swap, no wipe), world.js 926-936
(applyIdentityToSchool), ai.js 270 (setAIGameplan, re-synth deferred to state.js 297),
season.js 2514 (coach-move carry), sim.js 34-58 (normalizeDefGameplan mutates the
LIVE plan at kickoff — deletes `clockMgmt`/`pressureSource`, rewrites `blitzPct` —
and the books never learn).

---

## THE DISPOSITION TABLE (the D8-item-4 map, evidenced)

Side per `PLAN_FIELD_SIDE` (teamplan.js 41-91). Owner-now = who actually writes it
today. REC = recommended owner: **BOOK** (off/def book), **WEEK** (controller:
cells/weekly/calls/checks/headset), **TEAM** (overlay), **RETIRE** (disclose, then
remove — never silently), **MERGE** (fold into another control). M/D = mechanical /
design call.

### Offense (manifest side 'off')

| field | owner now | REC | conflict? | evidence | M/D |
|---|---|---|---|---|---|
| offFormations | book+UI+AI+wizard+cells | BOOK (weights WEEK) | book vs UI edits un-synced | playbook.js 172; gameplan.js 1595-1607; ai.js 271 | D |
| formationPlaybooks | book+UI+AI | BOOK | UI edits un-synced | playbook.js 177; gameplan.js 1735; ai.js 277 | D |
| tendency | book+UI+AI+cells | BOOK base · WEEK cell | two doors into pickPlayType (verify-first) | sim.js 3594 vs 4805 | D |
| passDepth | book+UI+cells+weekly | BOOK base · WEEK cell/weekly | none | situations.js 26 | M |
| rushInPct | book+AI+default; **no UI control** | BOOK | player can't set it outside a book | sim.js 3609; gameplan.js: 0 writers | D |
| conceptWeights | UI+AI+cells | WEEK | none (per-concept cell merge is sound) | situations.js 81 | M |
| rpoRate/gadgetRate/qbRunPct/optionRate/optionMix/pitchAggr/jetRate/drawRate/motionRate | UI (+AI) | WEEK (BOOK may seed) | none | gameplan.js 1650-1689 | M |
| qbAggr/protEmphasis | UI+cells | WEEK | none | gameplan.js 1690-1699 | M |
| protIdentity | UI+cells | WEEK | none | situations.js 41 | M |
| losFreedom | UI+cells | TEAM (QB trait adjacent) | none | situations.js 75 | D |
| targetShares | UI+AI | WEEK | none | sim.js 2467 | M |
| **screenRate/paRate/chipHelp/wildcatPassRate/rpoKeepPct/rbCarryShares/runDirection** | UI/AI — **NOT in manifest** | add to manifest as off | book swap doesn't govern them | OD-11 | M (manifest) |

### Defense (manifest side 'def')

| field | owner now | REC | conflict? | evidence | M/D |
|---|---|---|---|---|---|
| defBaseFront | defbook+UI+world.applyIdentity | BOOK | name dialect (defFront/front/baseFront) | defbook.js 223; world.js 926 | D (naming) |
| defFrontMix | defbook+UI | BOOK | none | defbook.js 224 | M |
| defAggression | UI(setAggr)+defbook+calls/checks | BOOK identity · WEEK per-call | blitzPct writers bypass it (OD-8) | sim.js 47-48; gameplan.js 33-36 | D |
| **blitzPct** | ai.js 297 + Simple mode + mirrors | **RETIRE to derived-only** | stale pairs, discarded writes | OD-8 | D (band-gate) |
| pressureIdentity | UI+defbook+calls/checks | BOOK identity · WEEK per-call | book field named pressIdentity | defbook.js 232 | M (naming) |
| **pressureSource** | world+defbook+creator UI | **RETIRE (disclosed)** | sim deletes it at kickoff | sim.js 51; OD-9 | D |
| coverageScheme | UI+defbook+AI+cells | BOOK identity | **aggressive/conservative placebo** | OD-5; probe §5 | D |
| covShell/covStyle | UI+cells+weekly+calls+checks+**family implies** | WEEK (identity default BOOK) | **the OD-1/OD-2 collision** | probe §1-2 | D |
| pressLevel | UI+cells+cardToCell; **not call-settable** | WEEK | card's cushion dropped by call path | probe §4; OD-6 | D |
| covFamily (call-only) | calls/cards | WEEK (call grammar) | 3 copies of family→shell truth | sim.js 320+326; defbook.js 77 | M (unify table) |
| runCommit | UI+cells+calls+checks+`_tendencyKey` | WEEK | **two semantics, three magnitudes** | OD-4 | D |
| edgePlay/optionKey/robberCall/zoneStyle/tackleStyle/subPhilosophy/bracketWho | UI+cells(+calls some) | WEEK | zoneStyle label soup ("Zone Eyes"/"ZONE RULES"/"Zone Teaching") | name table | M (naming) |
| greenDog/spyQB | UI+defbook | BOOK identity | card greenDog never compiles; greenDog OR'd with dogGame at sim.js 1692 (name collision) | probe §4 | D |
| defCalls | defbook compile+UI+AI | BOOK (`defbook.calls` home exists, teamplan.js 240) | 12-call cap enforced in compile only | defbook.js 246 | M |
| **callSheet** | UI+AI — **NOT in manifest** | WEEK (def side) | goes stale on book swap (silently dead rows) | OD-11 | D |
| formChecks | UI+AI+defbook answers | WEEK (book seeds via answers) | answers lose coverage/robber/zone (OD-6) | probe §4 | D |

### Team (manifest side 'team') + carriers

| field | owner now | REC | conflict? | evidence | M/D |
|---|---|---|---|---|---|
| fourthDown/maxFGDist/baseTempo/situations | UI+AI+weekly | TEAM | baseTempo vs cell `tempo` dialect | situations.js 28 | M (naming) |
| stFakes/puntDef/retScheme/patApproach/surpriseOnside | UI+AI — not in manifest | TEAM (add to manifest) | none | OD-11 | M |
| weeklyPlan | ai.js+season.js — separate object | WEEK (formalize) | no UI surface; silently shifts dials | app.js census §7 | D |
| fieldAssignments | fieldassign.js 248 | TEAM (roster-bound) | none | — | M |
| **clockMgmt** | fixtures only | RETIRE (already dead — sim deletes) | none | sim.js 40 | M |
| **defFormation** | fixtures only — 0 readers | RETIRE from fixtures | none | grep: no js/ reader | M |
| **offFormation** (singular) | fixtures + legacy fallbacks | keep as legacy fallback until re-root purge | §5b purge item | sim.js 4444/4743 | D |
| **`_liveTempo`** | **NOBODY writes it** | RETIRE the reads (or build the control) | reader-without-writer | sim.js 5703/5718/5766 | D |
| `_tendencyKey` | sim clone only (5971-72) | keep (runtime), document | hidden ±10 box swing via situations.js 43 | census | D (document) |

---

## THE FOUR COLLISION CLASSES (ranked)

**1 · covFamily vs the shell/style/cushion trio — PROVEN, order-dependent.**
Answer to the charter's question: **overridden** (shell/style — unconditionally,
sim.js 202-204), **ignored** (pressLevel — no implies entry, no call branch), and
**order-dependent** when a check joins (probe §2: same check wins vs dials, loses vs
family). AUDIT_CONTROLS_GAPS rejected a coverage call sheet because it "overlaps
three existing dials" — it arrived as a card anyway, and the overlap is exactly the
proven collision. Dispositions: OD-1/OD-2. What the player experiences: authored
checks and standing dials that sometimes do nothing, with no feedback.

**2 · DPB2's 1:1 claim — REFUTED on five counts** (probe §3-§5):
(a) card `pressLevel` — emitted by `cardToDefCall`, dropped by the call seam;
(b) `dogGame` — call path yes, cell path no; (c) `cardToFormCheck` drops
robber/zone/cushion/dog AND family shell/style; (d) card `greenDog` read by nothing;
(e) Box ±8 (CHK, delta) vs ±10 (CALL, absolute) for the same quantity. Plus the
placebo enums (OD-5/OD-7) and THREE hand-copies of the family→shell truth (sim.js
326 `COV_FAMILY_IMPLIES`, sim.js 320 shell-only map — missing Cover 2-Man,
defbook.js 77 `_FAMILY_SHELL`). The defensive book is NOT a pure view; it is a
lossy, seam-dependent projection.

**3 · Dead, legacy and migration-only carriers.** Confirmed: `blitzPct` LIVE as a
derived mirror with three rogue raw writers (OD-8); `clockMgmt` dead (sim.js 40
delete; only fixture writes); `gp.pressIdentity` — **no writer remains**
(defbook.js 232-233 writes `pressureIdentity` and deletes the legacy key; the 08-15
fix holds); `renderSchemeProfile` — **deleted** (tombstone gameplan.js 480-482;
`schemeIdentityLine` survives words-only); `roomPoints`/`COACH_PT_DIALS` — zero hits
in js/ (fully inert, buy-in era archive only); `normalizeFormations` legacy map —
still aliasing (`FORMATION_ALIAS = {"Pro Set": "Single Back"}` constants.js 2654 +
the gameplan.js 2699 offFormation-singular normalizer; §5b purge still owed to the
re-root). NEW finds: `_liveTempo` (read 3×, written never), `pressureSource`
(zombie, OD-9), `defFormation` (written, read never), `callSheet` staleness (OD-11),
`PLAN_DEF_FIELDS.pressureIdentity` (badge entry that can never match, OD-12),
`coverageScheme` "aggressive"/"conservative" and the invalid card extras (OD-5/OD-7),
CHK_FIELDS has no `pressureIdentity` row yet sim reads `_chk.pressureIdentity`
(4784 — only defbook answers can populate it; asymmetric, not a bug).

**4 · Naming-dialect splits — THE CANONICAL NAME TABLE** (one row per concept; the
name §5b's "one name per concept" should keep is **bold**):

| concept | state key | cell/CHK dialect | CALL/card dialect | UI labels | canonical |
|---|---|---|---|---|---|
| the box | runCommit | `runCommit` (CHK ±8 delta) | `runCommit` (CALL ±10 abs) / card `runCommit` / "+15 IN THE BOX" | Box · BOX · Box (run commit) · Run Commit | **runCommit**, delta-at-overlay (OD-4) |
| base front | defBaseFront | `defFront` | `front` / card `front` / book `baseFront` | Base Front · Front · FRONT | **defFront** (unify at re-root) |
| aggression | defAggression | `defAggression` (label "Pressure") | `aggression` / card `bring` 3-6 | Aggression · Pressure · PRESSURE | **defAggression** |
| blitz rate | blitzPct (legacy) | cell `blitzPct` (migrated) | — | (hidden) | derived-only (OD-8) |
| pressure look | pressureIdentity | same | card `look` / book `pressIdentity` | Pressure Identity · Pressure Style · Heat · HEAT SHAPE | **pressureIdentity** |
| shell | covShell | same | same / card via `coverage` | Safety Shell · Shell · Single/Single-high/Single-High/1-High | **covShell** (single/two) |
| man-zone | covStyle | same | same | Coverage Style · Style · STYLE | **covStyle** |
| cushion | pressLevel | same | card coach-mode (dropped by call seam) | Cushion · press/off | **pressLevel** |
| zone rules | zoneStyle | same | same | Zone Teaching · Zone Style · Zone Eyes · ZONE RULES | **zoneStyle** (spot/match) |
| coverage picture | covFamily (call-only) | — (cells can't) | card `coverage` c1..prevent | Coverage · the 8 pictures | **covFamily** + ONE implies table |
| rotation | rotation (call-only) | — | `rotation` sky/cloud/buzz | Rotation | **rotation** (fix the zoneStyle:"sky" strays into it, OD-7) |
| dog games | greenDog (standing bool) + dogGame (call green/cross) | — | card `dogGame`; card `greenDog` dead | Green Dog · Dog | split them: **greenDog** identity, **dogGame** call flavor — document the OR at sim.js 1692 |
| tempo | baseTempo | cell `tempo` | — | Base Tempo · Tempo | **tempo** (unify at re-root) |
| the looks | offFormations (+legacy offFormation) | cell offFormations | book `formations` | Formation Package/Usage | **offFormations** |
| the sheets | formationPlaybooks | — | book `sheets` | formation call sheet | **sheets** (book-side name wins at re-root) |
| named calls | defCalls | — | defbook `calls` + shelves/cards | Named Calls | **defbook.calls** (the Stage-3 home, teamplan.js 240) |
| personnel answers | formChecks | CHK_CLASSES empty/spread/heavy/wildcat | book `answers` (6 classes: empty/10/11/12/heavy/option) | Check-with-me | **answers** — note the CLASS SETS DIFFER (4 UI classes vs 6 book classes vs PERS_COLS 7) |
| situations | situations | SIT keys | book `shelves` (5, mapped defbook.js 32-38) | Situational Plan | **situations** (shelves compile in) |

Also: `DEF_CALL_ROWS` (headset) covShell label "Single-high" is a fourth spelling;
`PERS_COLS` "BONE" vs answers "option" for the same class.

---

## WRITERS-WITHOUT-READERS · READERS-WITHOUT-WRITERS

**Written, never (or no longer) read by the sim:** `pressureSource` (deleted at
kickoff, sim.js 51); `defFormation` (fixtures only); `clockMgmt` (fixtures only;
deleted sim.js 40); card `greenDog` (no compile path); card `pressLevel` via the
call seam only; `coverageScheme` values aggressive/conservative; `zoneStyle` values
fire/soft/sky/cloud/quarterQuarterHalf; `robberCall` value `true`;
`PLAN_DEF_FIELDS[2]` = pressureIdentity (badge never matchable).

**Read, never written:** `_liveTempo` (sim.js 5703/5718/5766 — zero writers in js/
and tools/); `_chk.pressureIdentity` (sim.js 4784 — only defbook answers can write
it; the CHK UI can't).

**Written on the game clone only (fine, documented):** `_tendencyKey` (sim.js
5971-72 → situations.js 43 — an unadvertised ±3..±10 run-commit swing keyed on the
opponent's tendency; keep, but the help layer should own up to it in the house voice).

---

## PART C — WHAT SHIPPED (narrow, provably inert)

1. **`tools/plan_cohesion_probe.mjs`** (NEW, registered CORE in
   `tools/_gate_manifest.mjs`): 44 checks — the family-vs-dials override and the
   CHK-after-CALL split proven at sim level (100% rates, seeded); the box-semantics
   and vocabulary source pins; the card three-path asymmetry; the placebo enums.
   Pins CURRENT behavior including audited defects (tripwire convention). ×3 green.
2. **Comment-only corrections** in `js/engine/defbook.js`: the false "five coverage
   identities the sim honors" claim (117) now states the truth and points at the
   probe; `cardToDefCall` (64) carries the three-vocabularies warning. Zero behavior.
3. **Nothing else.** PLAN_FIELD_SIDE + plan_side_probe already exist (Stage-1
   addendum landed) — verified ×3 green, not re-implemented.

**Deliberately NOT touched, and why:** the starter-card invalid values (outcome-
bearing — a real `rotation:"sky"` or `robberCall:"rob"` activates real mechanics;
owner intent per card needed, OD-7); `applyDefCall` gaining `pressLevel` (sim path);
any precedence pick (OD-2/OD-3 are owner calls); `blitzPct` writer unification
(band-gate); `PLAN_OFF/DEF_FIELDS` badge fix (changes rendered DOM — kept out to
protect the byte-identity claim); deleting `clockMgmt`/`defFormation` fixture keys
(inert but zero-value churn inside probe fixtures); `_liveTempo`'s dead reads (in
sim.js — nothing in Part C touches sim.js by policy).

## GATES (this session)

| gate | result |
|---|---|
| `plan_side_probe` ×3 | PASS ×3 |
| `plan_cohesion_probe` ×3 (new) | ALL PASS 44/0 ×3 |
| `playbook_root_probe` | PASS |
| `defbook_probe` | PASS |
| `tendency_probe` | PASS |
| `play_fidelity_probe 4` | ALL GREEN 18 |
| `save_migration_check` | ALL PASS |
| `integration_creator_probe` | PASS |
| `playcall_probe` | **does not exist** — the playcall gate is `ui_playcall_smoke.mjs` (PW tier) → OWED-LOCAL |
| clean esbuild build + CSS parse | **OWED-LOCAL** — the sandbox VM's disk filled mid-session (a temp build copy; the VM then refused to boot a shell) |
| `_equiv_walk` byte-identical | **OWED-LOCAL** — same cause. Mitigation: the only `js/` change is comment-only (defbook.js) and esbuild strips comments, so the bundle should be byte-identical to a HEAD build BY CONSTRUCTION — verify with sha256 on the local machine; if it is NOT identical, treat per the gate's law |
| git commit | **OWED** — no shell; file list in STATUS |
