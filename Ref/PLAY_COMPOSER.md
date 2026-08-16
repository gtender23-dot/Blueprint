# Custom Play Composer — data shape + the balance fork (for owner review, 2026-08-13)

**Status: v1 FOUNDATION shipped (band-safe Model A). Model B awaits owner sign-off.**

The Play Composer is the one editor whose value can touch the balance bands — a
play's strength IS its `vs` table (coverage → grade, the ~−0.06..+0.09 numbers)
and its `exec` weights. The other three editors move nothing in the sim's
league-wide stat distribution; this one can. So it splits into a band-safe half
that's already built and a balance-authoring half that needs a methodology and a
ruling before it ships.

## What a play is, in the engine

```
PASS_CONCEPTS["Mesh"] = {
  depth: "short", minWR: 2, motion: true,
  vs:   { "Cover 0": 0.09, "Cover 1": 0.08, ... "Cover 3": -0.04, ... },  // BALANCE
  exec: { QB: { AWR: 0.5, TEC: 0.5 }, WR: { TEC: 0.6, AGI: 0.4 } }        // BALANCE
}
RUN_CONCEPTS["Inside Zone"] = { type:"run_inside", vsBox:{loaded:-0.02,light:0.04}, rpo:{...}, exec:{...} }
```

`vs` / `vsBox` and `exec` are the balance-bearing fields. Everything else
(name, depth, minWR, motion, screen kind, formation assignment) is cosmetic or
structural and safe to author freely.

## The fork

### Model A — variant over a base concept (BAND-SAFE — shipped as v1)

A custom play NAMES an existing base concept and may override only the non-grade
dimensions. For the sim it **resolves to the base concept verbatim** — same
`vs`, same `exec` — so it is band-identical *by construction*: it literally plays
as the base. What the author gets:

- a **custom name** ("Coach's Mesh") shown in the UI and playbook,
- **formation assignment** — which formations carry it (feeds playbook sheets;
  legality still gated by `FORMATION_PLAYBOOK`),
- safe structural toggles already expressible on a concept (motion on/off),
- an optional **note**.

Delivered by `js/engine/customplay.js`: `validateCustomPlay`, `resolveToConcept`
(returns the base concept's exact grades under the custom name), `emptyCustomPlay`,
`baseConceptsForKind`. Stored on the `plays` Creator shelf; a custom play drops
into a playbook sheet like any concept. `custom_play_probe` proves the resolved
grades EQUAL the base — band-neutral, no stat_realism movement possible.

This is genuinely useful stacked with the Playbook Builder (name + save + assign
your own versions of the catalog), and it ships today with zero balance risk.

### Model B — authored grades (NEEDS A METHODOLOGY + RULING — not built)

The "real" composer: the author designs a play's strengths — sets (or shapes)
the `vs` table so the play beats some coverages and loses to others. Two ways to
make that safe, either of which needs your call:

- **B-i — derived grades from route parts (recommended).** The author assembles
  a play from ROUTE PARTS (e.g. 2 verticals + a crosser + a checkdown); a fixed,
  non-editable **parts→grade rulebook** DERIVES the `vs`/`exec` from those parts.
  The author never types a coefficient — grades come from a balanced rulebook, so
  the play is realistic AND can't be tuned into an exploit. Most work (the
  rulebook is a real balancing artifact), most payoff, safest.
- **B-ii — free authoring, human-call-only + clamped.** The author edits the
  `vs` grades directly, but (1) values are CLAMPED to the catalog's observed range
  (~[−0.08, +0.10]) and (2) custom plays are **human-call-only** — the AI never
  selects them, exactly like named screens / Slip Screen. Because the standing
  `stat_realism` bands are league-wide AI sims, a human-only play cannot move
  them; a slightly-strong custom play only affects the author's own games, which
  is a sandbox creator's prerogative. Much simpler than B-i; less "designed."

**Recommendation:** ship Model A now (done), then build **B-i** (derived grades)
as the headline Composer, keeping the **human-call-only** rule from B-ii as an
additional safety belt so even a mis-tuned rulebook can never touch league bands.
Reserve raw free-grade authoring for a later "advanced" toggle, if ever.

## Open questions for the owner

1. **Model B path** — B-i (derived from parts, recommended), B-ii (clamped free
   authoring, human-only), or both behind a difficulty/advanced toggle?
2. **AI selection** — should any custom play EVER be AI-selectable? Recommend NO
   for v1 (human-call-only), which is what keeps the bands untouchable.
3. **Route-part vocabulary** (only if B-i) — the part list and the parts→grade
   rulebook are a balancing pass in their own right; that's a measured,
   probe-gated project like the P1a catalog expansion, not a quick data add.
4. **Run plays** — does the Composer cover runs (`vsBox`) in v1 or passes first?
   Recommend passes first; runs are a smaller surface to add after.

## What is shipped vs pending

- ✅ **Model A** — `js/engine/customplay.js` + `custom_play_probe` (band-safe;
  resolves to base concept verbatim). The `plays` Creator shelf + playbook
  integration ride this.
- ✅ **Model B-i — RULED & BUILT (2026-08-13)** — `js/engine/playcompose.js` + `play_compose_probe`.
  A 12-part route vocabulary (go/post/corner/dig/out/curl/slant/drag/flat/wheel/
  screen/checkdown) with a fixed parts→grade rulebook. `compilePlay(parts)` sums
  each part's per-coverage tendency, adds real-design combo bonuses (vertical
  stretch / man-rub / flood), then **clamps every grade into the catalog band** —
  so no composed play can out-grade the strongest shipped concept. Derives depth,
  minWR, and valid exec weights from the part mix. Two proven guarantees: BAND
  (all ~1,875 buildable 2/3-part plays + heaviest 5-stacks in-band) and
  AI-INVISIBLE (never writes `PASS_CONCEPTS`, so the AI can't pick it —
  human-call-only by construction, the B-ii safety belt kept). v1 is passes; runs
  are a later add (Q4).
- ⏳ **Sim forced-call wiring** — making a compiled play callable by a human
  (the forced-call path resolves a composed play's grades). Browser-gated; the
  band + AI-invisibility guarantees are already proven so this is safe plumbing.
- ⏳ **Composer UI** — browser-gated, on top of Model B-i.
