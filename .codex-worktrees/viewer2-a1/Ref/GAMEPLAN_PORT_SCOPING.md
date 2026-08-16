# Gameplan Port Scoping — what the Buy-In update did to the gameplan

**Status:** Inventory complete. NO code written. Decision pending (owner said "hold, think about it").
**One decision pre-made:** when we do port, include the **46/Bear fix** (owner confirmed — the
baseline's 46/Bear effectively fields the wrong number of defenders; the donor treats it as a bug).

The user noticed the defensive-front picker only offers 4-3 / 3-4 (no Nickel). Investigation
(donor `Blueprint-College_Football_Dynasty` vs baseline `work/`) shows that's the visible tip of a
larger defensive-gameplan rework in the Buy-In update.

---

## What the baseline is MISSING (donor has, baseline doesn't)

### Tier 1 — Fronts & data (CLEAN, no Buy-In, low risk, no sim logic changes)
The sim already reads these tables generically, so adding entries needs no engine surgery.
- **Nickel as a selectable BASE front.** Baseline offers only `['4-3','3-4']` as pickable base
  identities (`gameplan.js` DEF_FRONTS2). Donor offers `['4-3','3-4','Nickel']`. **This is the
  reported symptom.**
- **New `5-2` front** (5 DL / 2 LB / 4 DB — goal-line wall). Needs: `DEF_FRONTS` entry,
  `DEF_FRONT_WEIGHTS['5-2']`, `MATCHUP_MATRIX` 5-2 column (12 offensive-formation rows),
  `FRONT_ROLES['5-2']`, and 5-2 entries in `PIN_FRONTS`/`FRONT_PRESSURE_SIGNATURE`/`FRONT_SIG_LABEL`.
- **46/Bear recompose** — donor `4/3/4` (baseline `4/4/3`) + updated weights. Behavior change to an
  existing front, treated as a bugfix. **Owner: include this.**
- Front desc/needs text for Nickel (`DEF_FRONT_DESCS`, `DEF_FRONT_NEEDS`).

### Tier 2 — The pressure / protection rework (CLEAN of Buy-In, but a real sim.js rewrite)
The update **replaced** the baseline's numeric blitz-% slider with an identity system.
- **Defensive pressure identity** — `C.PRESS_IDENTITY` (fireZone / secondLevel / secondaryHeat /
  theHouse), `C.AGGRESSION` (5 stops: bend→house), `FRONT_PRESSURE_SIGNATURE`, `pressureCallRate()`,
  `aggrStopFromBlitzPct()` (legacy migration). Rewrites the blitz resolver in `sim.js:1503-1560`.
  Reads raw player SPD/PWR/AWR + roles — NO DNA/facet/wants/academics tie.
- **Offensive protection identity** — `C.PROT_IDENTITY` (quick / halfSlide / bob / maxProtect),
  `protectionFactor()`, `gp.protIdentity` UI. The offensive half of the same rework.
- Replaces (not augments) the baseline `blitzPct` path + `renderSchemeProfile` radar card.

### Tier 3 — Archetype (CLEAN but ripples beyond gameplan)
- **`CB-Nickel` cornerback archetype** — new. Self-contained data but touches `player.js`,
  `constants_field.js`, size/attr tables, not just gameplan.

### NOT PORTABLE — Buy-In coupled
- **Coaching Points** — `C.COACH_PT_DIALS` (6 per-room dials), `gp.roomPoints`, `p.coachPts`,
  `coachPtEffect()`. Reads `p.buyIn` + `plan._programBuyIn` (academics/measures substrate). Would
  drag in the Buy-In systems deliberately left out. **Skip.**

## What is NOT missing (identical in both trees — nothing to do)
- Offensive `FORMATIONS`, `FORMATION_PACKAGES`, `FORMATION_WEIGHTS`, `FORMATION_SITUATIONAL`,
  `FORMATION_PLAYBOOK`, `FORMATION_ALIAS` — same 10 formations.
- Coverage options (`COV_OPTIONS`), `covShell`, `pressLevel`, `coverageScheme` — identical.
- `SITUATION_KEYS`, `SIT_DESCS`, `SIT_NUDGE`, `SIT_TIPS`, `SIMPLE_DIALS`, `SIMPLE_SITS` — identical.
- `getMatchupEdge` logic — identical (only the 5-2 data column differs).

---

## The three scope tiers (pick when ready)
- **Tier 1 — Fronts only:** Nickel selectable + 5-2 + 46/Bear fix + matchup/role data. Small, safe,
  fixes the reported symptom. Gates should stay green (data-only).
- **Tier 2 — Fronts + pressure/protection rework:** adds the aggression/pressure-identity system
  (replaces blitz% slider) + offensive protection identity. Substantial sim.js surgery; full sim
  re-verification (progression/recruiting/stat_realism + a new pressure probe).
- **Tier 3 — Everything portable:** Tier 2 + CB-Nickel archetype. Leaves out only Coaching Points.

## Verification (whichever tier)
Tier 1: build/boot/tree_probe + confirm gameplan UI renders the new fronts, sim still resolves them.
Tier 2/3: all of the above PLUS stat_realism + a dedicated pressure/sack-rate probe, since the blitz
model changes — must confirm sacks/pressure/pass-defense land in the same bands.
