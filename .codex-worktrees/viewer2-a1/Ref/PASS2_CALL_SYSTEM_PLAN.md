# Pass 2 — Defensive Call System · Plan of Record

**Status: SHIPPED 2026-08-08.** All four open decisions resolved by owner (each took the
recommended option — see §Open decisions). Gates run at ship: build · boot 0 pageerrors ·
defcall_probe (31/31) · defcall_ui_smoke · defcall_headset_smoke · defcall_band_ab
(AI-vs-AI drift: pts 0.00, rush 0.20, pass 0.40 — bands held) · worldgen / recruiting /
progression / save_migration / scheme_role / tendency / front_variants all pass.

Roadmap brief (roadmap.html): *Named calls — author packages (front + coverage + pressure +
rules, e.g. "Stack Buzz Dog") — weighted on a matchup call sheet: situation bucket × opponent
personnel class. Builds on formChecks + sitsets. Live calling shows your named calls. AI
coordinators author signature calls.*

---

## What exists today (code-verified anchors)

The defense is ~18 independent scalar dials resolved per snap through a 5-layer override
stack in `simulateDrive()` (`js/engine/sim.js`):

```
base gameplan → situation cell (gp.situations[sitKey]) → weeklyPlan   (getEffectivePlan, situations.js:18)
  → F1 live coach call            (applyDefCall, sim.js:3411)
  → timeout _nextPlay override    (sim.js:3416)
  → formation known               (offFormationId rolled, sim.js:3494)
  → F2 formChecks                 (formationCheckClass → applyDefCall, sim.js:3502-3522)
  → front chosen                  (defFront !== "auto" || selectDefFront + Front Mix, sim.js:3523)
  → coverage family derived       (coverageFamily, sim.js:3637) + disguise layer
  → pressure resolved at pass time (resolvePassPlay, sim.js:1109-1203)
```

Three facts make this pass cheap:

1. **The call payload already exists.** `applyDefCall(defEff, o, defSchool)` (sim.js:166)
   accepts exactly `{front, covShell, covStyle, edgePlay, pressureIdentity, robberCall,
   zoneStyle, aggression, runCommit}` and is idempotent + field-sparse. A named call is a
   saved instance of that object with a name on it. formChecks cells are the same shape.
2. **A call naming a front bypasses auto-selection for free** — the `defFront !== "auto"`
   ternary at sim.js:3523 already honors it; Front Mix only rolls when no call named a front.
3. **Persistence is free.** Saves serialize state wholesale (persistence.js:130); absent
   fields ⇒ byte-identical old behavior (the house old-save law). Migration is lazy at game
   entry (`normalizeDefGameplan`, sim.js:30), and the gameplan library (coachprofile.js:150)
   clones the whole object, so calls ride along.

**Pre-existing latent bug found while scoping** (report, worth fixing en route): the hand
re-sync of `*Eff` keys after formChecks (sim.js:3514-3520) misses `robberCallEff`,
`zoneStyleEff`, `pressLevelEff`, `bracketWhoEff` — a formChecks cell setting those updates
`defEff` but never reaches `defPlanEff`, so the sim ignores it. Not user-visible today only
because the checks UI (`CHK_FIELDS`, gameplan.js:1742) doesn't offer those fields. Fix =
factor a single `syncDefEff()` helper and use it for both formChecks and named calls.

---

## The design

### 1. Data model (two optional gameplan fields, absent by default)

```js
gp.defCalls  = {  // the call library — authored packages
  "Stack Buzz Dog": { front:"3-3-5", covShell:"single", covStyle:"zone",
                      pressureIdentity:"fireZone", aggression:"selective",
                      runCommit:0, edgePlay:null, robberCall:"buzz", zoneStyle:null },
  ...
}
gp.callSheet = {  // situation bucket × opponent personnel class → weighted call list
  third_long: { "10": [["Stack Buzz Dog",40],["Tite Mint",60]], "11": [...], any: [...] },
  base:       { "21": [...] },
  ...
}
```

Payload spellings normalized to the `applyDefCall` parameter names (the formChecks
`defFront`/`defAggression` renames at sim.js:3506-3512 get folded into the same normalizer).

### 2. Personnel classes (the sheet's column axis)

New `offPersonnelClass(formationId)` beside `offPersonnelOf` (formations.js:183), derived
entirely from `FORMATION_PACKAGES` (constants.js) — `backs digit + TE digit`:
**10 · 11 · 12 · 13 · 20 · 21+** (wishbone/flexbone/jumbo collapse into 21+ or 13; wildcat
stays its own check). Zero new data; the existing coarse `formationCheckClass` (empty/
spread/heavy/wildcat) remains as the formChecks key and the sheet's `any` fallback.
The defense already reads formation pre-snap free and perfect (sim.js:3494 before every
defensive decision) — motion/jet remains the intended punish, unchanged.

### 3. The per-snap sample

New `pickDefCall(callSheet, defCalls, defSit, persClass)` invoked between formation-known
(3494) and formChecks (3502): resolve cell `callSheet[sitKey][persClass] || [sitKey].any`,
weighted roll, feed through `applyDefCall`, re-sync via the new `syncDefEff()`.

**Priority chain (proposed, Open #1):**
`base gp → situation cell → weeklyPlan → NAMED CALL → formChecks → _nextPlay → F1 live call`
— a named call outranks the standing dials (it IS the call), formChecks stay as
check-with-me overrides on top (they're formation-triggered audibles), and the human live
call stays supreme. Empty cell / no sheet ⇒ everything behaves exactly as today.

### 4. Live calling (F1) shows named calls

`DEF_CALL_ROWS` (app.js:2527) gains a CALL row: pick one of your named calls by name instead
of setting nine dials; the nine dial rows remain below for ad-hoc adjustments (a picked call
pre-fills them, mirroring how the roadmap phrased "live calling shows your named calls").

### 5. AI coordinators author signature calls

`setAIGameplan` (ai.js:56) gets an archetype→signature-call generator: 2–4 named calls
rolled from the staff's existing lean math (frontLean/stackLean, aggression, DC blitzDesign
+ specialty front) + a small call sheet for the pass-lev situations. Same precedent as
`buildAISituations` (ai.js:244). This closes the roadmap's "half of AI formation sheets"
item. **Band rule applies:** the moment AI behavior changes, gated stat_realism A/B
(`__noDefCalls` kill-switch, house style).

---

## Guardrails

- **Kill-switch:** global `__noDefCalls` — sheet + AI calls ignored, byte-identical old
  path. Matched A/B through stat_realism before ship.
- **No new mechanisms.** Named calls only write dials the sim already reads. Distribution
  shifts come from selection, not new math — same philosophy as Front Mix.
- **Old-save law:** absent `defCalls`/`callSheet` ⇒ no behavior change; no retro-fill.
- **Probes:** extend `playcall_probe` + `tendency_probe` (both import sim/formations
  directly); new `defcall_probe` printing front/coverage/pressure distribution by situation
  × personnel with sheet on vs off vs `__noDefCalls`.

## Build sequence (each step gated: build · _boot_check · probes vs baseline)

1. **`syncDefEff()` refactor + latent-bug fix** (self-contained; formChecks-parity probe).
2. **`offPersonnelClass()`** + unit probe over all FORMATION_PACKAGES entries.
3. **Schema + `pickDefCall` + sim wiring under `__noDefCalls`** (defcall_probe A/B: switch
   off = byte-identical; sheet empty = byte-identical).
4. **Gameplan UI: "Calls" defSubTab** — call editor (library) + sheet grid (situation ×
   personnel), transplanting the formChecks renderer/listener pattern (gameplan.js:1750,
   1645-1672).
5. **Live-call CALL row** + `ui_playcall_smoke` extension.
6. **AI signature calls** + gated stat_realism A/B + `tendency_probe`.
7. Full gate suite + roadmap.html chip flip (Pass 2 → ✓, Pass 3 → ▶ NEXT).

Baseline (2026-08-08, pre-Pass-2, saved in the working session): build clean · boot 0
pageerrors · worldgen/recruiting/progression ALL PASS · balance_probe captured ·
stat_realism: points 26.7 OK, rush 145.2 (**the known pre-existing drift, on record —
Pass 2 diffs against this number, not the 150 floor**), pass 249.4 OK, comp% 57.3 low,
INT% 1.58 low (both pre-existing).

---

## Open decisions — RESOLVED by owner 2026-08-08 (recommended option taken on all four:
## call outranks weeklyPlan · sparse cells + any · cap 12 · formChecks kept as audibles)

1. **Named call vs weekly scouting reaction.** `getEffectivePlan` today puts `weeklyPlan`
   above the situation cell for covShell/covStyle/edgePlay/pressureIdentity. Proposed:
   named call outranks weeklyPlan (you called it, you own it), and the AI's weekly reaction
   instead nudges its own *sheet weights*. Alternative: weeklyPlan shifts apply on top of
   the sampled call.
2. **Sheet granularity.** Full 6-class personnel axis (10/11/12/13/20/21+) × 11 situation
   buckets is a big grid. Proposed: sheet cells are optional per situation with an `any`
   personnel column; UI shows only rows the coach adds (formChecks pattern — empty = auto).
3. **Call cap.** Proposed: max 12 named calls per gameplan (fits the library UI and keeps
   AI generation bounded). Any number is fine mechanically.
4. **formChecks fate.** Keep as-is alongside calls (proposed — they're audibles, calls are
   the menu), or fold the four check classes into sheet columns later in the pass.
