# BLITZ-DIAL NORMALIZATION — "the pressure pie" (plan of record, 2026-08-09)
### The last surfaced-unclaimed item from the Brain Expansion Roadmap, owner-claimed post-Pass-7.
### Owner calls at kickoff: pie controls WHO **and** HOW OFTEN · weighted lottery ·
### ONE COMBINED pie (⚡ blitz + 🛡 drop slots) for player clarity.

## The problem
The ⚡ dials are independent 0–100 weights that read like probabilities but act
as a grade nudge (+0.6×) in a deterministic pick — two slots at 100 doesn't
mean both come, and 60/40 vs 90/10 barely differ. The 🛡 dials are a separate
per-snap bail rate. Nothing sums to anything; players can't reason about it.

## The design — per-front PRESSURE panel, two controls
1. **HEAT (0–100, default null=neutral)** — how often pressure comes when this
   front is fielded. Multiplies the computed blitz rate by `0.5 + heat/100`
   (0 → ×0.5, 50 → ×1.0, 100 → ×1.5), inside the existing AGGRESSION.capRate
   clamp. Stored `fieldAssignments.defense[front].heat`.
2. **The 100% pie** — when the blitz fires, WHO/WHAT is it. One allocation
   across ⚡ slots and 🛡 slots together (same `blitzShares` map, UI keeps it
   summing to 100 via the carry-share rebalance math). Weighted lottery per
   fired blitz: an ⚡ slice = that man takes the first rush seat; a 🛡 slice =
   that lineman DROPS and the best backer comes behind him — a shield slice IS
   a fire-zone look (rides the existing droppedIds/fzBonus machinery).

## Integrity rules (zero-migration law)
- Undialed plans (all AI + untouched saves): byte-identical path — lottery and
  heat only engage when the plan has dialed weights / a heat value.
- The everyday 🛡 bail (default 18, any pass snap) is UNCHANGED for all plans;
  a dialed 🛡 slice adds the explicit fired-snap fire-zone look on top. If the
  sampled lineman already bailed naturally that snap, the look is identical —
  just send the backer.
- Legacy dialed plans translate at read time (relative weights → lottery); no
  save mutation, heat derives neutral (old dials never touched rate, so the
  migration doesn't either). The one behavior shift for legacy dialed plans:
  who-picks become lottery instead of grade-nudged — documented, gated.
- Identity interplay: the pie owns the FIRST rush seat (replacing the
  secondaryHeat/theHouse DB-first branch when a pie exists); identity keeps
  owning count, coverage risk, and the fire-zone drop spec for remaining seats.
- Pre-existing UI bug fixed en route: the ⚡/🛡 click handler wrote to
  `gp.defBaseFront` regardless of which front tab was being viewed — dials
  edited on the Nickel tab landed in the 4-3 entry. Now scoped to the rendered
  front.

## Kill-switch
`__noBlitzPie` — restores the grade+0.6-preference pick, ignores heat, ignores
🛡 pie slices. Undialed plans identical either way.

## Hook Rule
No trait — declined (control surface over existing pressure machinery; the
Green Dog / Games Runner / Disguise Artist hooks already cover the mechanics).

## Observability
Play records gain `blitzerIds` (who actually came) next to blitzFired —
needed by the probe, useful for any future film UI. fireZone already recorded.

## Gates
- `blitz_pie_probe.mjs`: (a) lottery honors the split (70/30 dial → ~70/30 of
  fired blitzes, whole-game N); (b) heat 100 vs 0 ≈ 3× fired-rate ratio;
  (c) a dialed 🛡 slice raises fire-zone rate on fired snaps; (d) `__noBlitzPie`
  kills heat + lottery; (e) undialed plans unaffected by the switch (bands
  identical within noise).
- Gate core tier (includes pass7_band_ab + stat_realism — proves undialed/AI
  neutrality since AI never dials) + defcall/pressure spot probes + UI smokes.
- Manifest entry added (core while fresh, demote later).
