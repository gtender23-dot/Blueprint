# Season Mode + Division Editor + Prestige model (DECIDED 2026-08-13)

**Status: decided, ready to build against.** Extends the Creator work. Engine
pieces are node-testable now; all UI is browser-gated. Sits on the converged line
(viewer-2 + Creator engine, tip `de73661`).

## Season Mode — a focused, resumable single-season showcase

A lighter mode than dynasty, and the showcase for the three things we control
best: the sim, the live viewer, and the Creator. It's also where a player *feels*
whether a creation is any good, by playing/simming a whole season with it.

- **Flow:** pick a division level (D1 / D2 / D3) → get that **full division** for
  **one full season with playoffs** → choose your team via the onboarding **state
  picker** or **coach your own** custom team → coach your games in the live
  viewer, sim the rest, chase the playoff to a champion.
- **Team pick:** state-picker or coach-my-own. **No team reroll** — reuse the
  existing **logo reroll** from the team flow (no new mechanic).
- **Resumable**, with its own lightweight save, fully **separate from dynasty**
  saves.
- **Pure sandbox:** NO DNA / career progression — your scheme is your scheme.
- **Lives on the Main Menu**, sibling to *Play Now* and *Start Dynasty*.
- **Engine:** reuses `generateWorld(assembled division)` + `generateSchedule` +
  `simulateGame` + standings + the existing 16-team playoff bracket, with a thin
  week-by-week orchestrator. It deliberately does NOT touch `advanceDay`,
  recruiting, the offseason, or the gate stack — which keeps it clean and
  sidesteps things like the day-3 camp gate.
- **Monetization framing (owner floated):** a natural demo/showcase. Design
  implication only: keep the loop tight, self-contained, and impressive — a
  stranger should generate a division, coach a game in the viewer, and sim to a
  champion without touching dynasty systems. Pricing is the owner's call.

## Division-scoped league model (refines LEAGUE_BLUEPRINT.md)

Everything is **division-scoped, all divisions separate, mix-and-match anywhere.**

- A world = **three division slots** (D1 / D2 / D3). Each slot's source is either
  the **static/real** division or a **saved custom division**.
- A league creation holds **1–3 division blueprints** (build just a D1, or all
  three). World assembly references a **(creation, division)** per slot — so
  "custom D1 from League A + procedural D2 + custom D3 from League B" is three
  independent picks.
- **Season Mode = one slot** (the chosen level: static or your custom division).
- **Default is the static/real division** — you edit from the existing world, not
  a blank page. This collapses the old "seed vs replace" modes: edit one team or
  rebuild every conference, it's the same flow, and you save the whole division.
- Engine: a thin **assembler** composes the three per-division sources into the
  `{schools, conferences}` the `generateWorld(opts)` seam already accepts. This
  extends `compileLeague` (which already validates + builds by division), it does
  not replace it.

## The Division Editor (MERGES the League Editor + Team Editor)

One screen, not two. Pick a division → it loads the **full real division** (every
conference and team, the static version) → edit from there.

- **Main screen:** conference rows (name + **prestige** editable inline) and team
  rows with the quick edits — name, mascot, color (**reroll or load logo**),
  **prestige**, and **reroll the whole school** (fresh procedural team) if you
  just want to randomize one. Prestige is on the MAIN screen for both schools and
  conferences.
- **School card:** the deeper edits — prestige, conference, home city/state,
  stadium, colors, logo (load-logo can live here if it's cramped on the list),
  and **roster (phase 2)**.
- **Scale is handled bulk-first:** you never hand-edit 120 teams. Conference
  prestige distributes school prestige in bulk, reroll fills the noise, and you
  hand-tune only the handful you care about.
- **Realignment v1:** rename conferences + set conference prestige + **reassign
  teams between conferences**, with the division's total population fixed.
  **Add/remove entire conferences is deferred** (it changes the conference count,
  the thing that most stresses schedule + bracket).
- **No size cap** — verified below.

## Prestige model

- **D2 / D3 — conference prestige is a WORLD-GEN SEED only.** The conference tier
  distributes its schools' starting prestige at generation; after that it's fully
  fluid — winning/losing move prestige season to season, so powerhouses rise and
  fall. The tier is a starting condition, not a permanent label. (This gives D2/D3
  the intra-division hierarchy they currently lack.)
- **D1 — a per-school BLUE-BLOOD TOGGLE.** The persistent, player-controlled elite
  designation. Mechanically: a **prestige floor near the top of the power band +
  slower decline + a recruiting edge**, so a blue blood stays relevant across
  seasons even after down years. **D1 prestige still moves within the major /
  mid-major bands** (the existing clamps) — the toggle pins the giants; every
  program still breathes inside its conference's band.
- Reuses the existing power/mid-major **band clamps**; conference prestige
  generalizes today's D1-only `conferenceClass` to all three divisions.
- ✅ **Part B DONE (2026-08-13)** — the DEFAULT procedural world now tiers its
  D2/D3 conferences (a per-conference prestige offset averaging ~0 per division),
  so strong and weak conferences emerge. Verified **mean-neutral**: D2 mean
  2.13→2.16, D3 1.61→1.62 (within noise), while between-conference variance jumped
  ~6× (D2 0.07→0.38, D3 0.03→0.23). Balance held: `pos_ovr_census` unchanged,
  `stat_realism` Points 26.0 in-band, `worldgen_check` clean. Gated by
  `d2d3_tiering_ab`.

## No-cap guarantee (verified against the code, 2026-08-13)

Both systems degrade gracefully at any conference size and count, so **no cap is
needed** — full player control:

- **Schedule** (`scheduleConference`): builds a round-robin capped by the fixed
  number of conference game-days. A 30-team superconference plays a *partial*
  round-robin; a 4-team conference plays fewer games; `n < 2` = no conference
  slate (plays non-conference only). Nothing overflows or stalls.
- **Playoff** (`buildAllBrackets`): a 16-team field — one champion per conference
  then at-large by record, bracket auto-sized to the next power of two with byes.
  >16 conferences → only the top 16 champions get in; <2 division teams → no
  playoff. Any field 2–16 builds a valid bracket.
- **Soft warnings only** (never blocks): a 1-team conference has no conference
  games; >16 conferences means not every champion makes the bracket.
- **Proof:** a `custom_division_season` probe (extends the integration dress
  rehearsal) will restructure a division into odd sizes/counts and run a full
  season + playoffs to a champion — verifying no-cap, not assuming it.

## Dynasty cleanups folded into this update (all owner-approved 2026-08-13)

1. **Unify the two "my teams" libraries.** The Creator's global teams shelf is the
   one home; Play Now + Season Mode read from it; migrate the old per-coach
   `saveTeamToLibrary` store. (Persistence unify + small migration.)
2. **Consolidate the onboarding start-flow.** The overlapping challenge
   (rebuild/powerhouse/take-a-job) + lore start + state picker + retired custom
   sliders collapse: "powerhouse vs rebuild" is just picking a high/low-prestige
   team now that prestige is visible; state-picker + coach-my-own covers the rest.
   Fold the challenge framing into the team pick; drop the retired sliders. (Part
   of the wizard redesign.)
3. **Reorganize Game Plan around offense/defense schemes.** The live Game Plan
   screen is the last place offense and defense are tangled in one blob; split it
   into an offense side and a defense side, matching the scheme model + the
   defensive few-choices picker. (Browser UI — editor session.)
4. **Unify the prestige knobs.** `conferenceClass` + the prestige-weight table +
   the min/max band clamps encode the same hierarchy in three tables that have
   drifted before; unify them around the now first-class **conference prestige**
   value (drives distribution AND band). **Balance-gated — needs its own before/
   after A/B before shipping**, not a casual edit.
5. **Audit the advance-week gate stack.** Advancing runs a gauntlet of hard blocks
   (unemployed, halftime, multi-coach week, tree lockstep, offseason stages, the
   day-3 camp gate). The camp gate is what silently hung the season probe — a hard
   wall a headless driver can't pass. Audit which must be hard stops; consider
   making the camp gate a **soft confirm** rather than a wall.

## Build order (what's node-testable now vs browser-gated)

**Node-testable now (sandbox):**
- The division **assembler** (compose per-division sources → `generateWorld`).
- The **Season loop** engine (week play/sim → standings → playoff → champion),
  isolated from `advanceDay`.
- `custom_division_season` probe (restructured division, full season, no-cap).
- The **blue-blood toggle** mechanic (prestige floor / slower decay / recruiting
  edge) — balance-gated (A/B).
- Cleanup #1 (team-library unify) + its migration; cleanup #4 groundwork (A/B).

**Browser-gated (owner's machine / editor session):**
- The **Division Editor** UI, the **Season Mode** screens, the Main-Menu entry.
- Cleanup #2 (onboarding consolidation) and #3 (Game Plan reorg) — UI.
- The Creator editor UIs from CREATOR_ENTRANCES.md.
