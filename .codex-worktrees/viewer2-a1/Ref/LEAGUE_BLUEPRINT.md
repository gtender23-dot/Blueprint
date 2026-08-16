# League Blueprint — data shape (for owner review, 2026-08-13)

**Status: PROPOSED. Not wired.** The `generateWorld(opts)` seam is built and gated
(`creator_world_probe`, inert-by-default). This doc proposes what a saved
`leagues` creation actually *contains* and how it compiles into the two source
tables the seam already accepts. Nothing here touches world-gen until the shape
is signed off.

---

## What the seam consumes today

`generateWorld(opts)` reads exactly two optional source tables, both defaulting
to the module globals:

- `opts.schools` — an array shaped like `SCHOOL_DATA` (pre-roster; generateWorld
  adds roster/record/coach/lore/depthChart itself).
- `opts.conferences` — a map shaped like `CONFERENCES`.

So a league blueprint never talks to generateWorld directly. It is **compiled**
into `{ schools, conferences }` and handed to the seam. The blueprint is the
author-friendly shape; the source tables are the engine shape. One compile
function bridges them, and it's the only new engine surface custom leagues need.

```
leagues creation (.data)  ──compileLeague()──▶  { schools, conferences }  ──▶  generateWorld(opts)
   (author shape)                                    (engine shape)              (existing seam)
```

## The engine shapes we must produce (from the live tables)

**A school** (26 fields today). **Owner ruling (2026-08-13): EVERY field is
author-editable.** Only five are strictly *required*; every other field is
optional-with-override — if the author fills it, their value wins; if left blank,
the compiler supplies the auto value. So the "auto" column below is the
*fallback*, not a wall: the Team/League Editor surfaces all of these for editing.

| field | source | notes |
|---|---|---|
| `id` | **required** | unique slug, e.g. `"river_city_u"` |
| `name` | **required** | display name |
| `division` | **required** | `"D1" \| "D2" \| "D3"` |
| `conf` | **required** | must reference a conference id in the same blueprint |
| `prestige` | **required** | 1–`PRESTIGE_MAX[div]` (D1 6 / D2 4 / D3 3); drives roster talent |
| `nick` | editable → auto fallback | mascot; auto from a fallback pool if blank |
| `abbr` | editable → auto fallback | 2–4 letters. **Dedup ALWAYS runs, even on an author-set abbr** — on collision the compiler auto-suffixes and warns; two teams never share an abbr (the CAL-collision lesson) |
| `colors` | editable → auto fallback | `[hex, hex]`; auto from palette |
| `prestigeMin` / `prestigeMax` | editable → derived | default to the division band around `prestige` |
| `baseline` | editable → `= prestige` | historical anchor |
| `state` | **primary geo input** → centroid | see geo below; the one geo field an author gives |
| `lat` / `lng` | editable (future map-pin) → from state | precise override; pin UI is a later power-user nicety |
| `city` | editable → `""`/auto | cosmetic |
| `logo` | editable → `🏈` | emoji today |
| `facilities` | editable → from prestige | `{stadium,training,recruiting,medicine}` 1–5 |
| `stadium` | editable → auto | `{name, capacity}` |
| `type` / `control` / `enrollment` / `founded` | editable → auto | flavor; safe defaults |
| `staff` | editable → generated | `{oc, dc}`; generateWorld already handles absent staff |

### Geo — state center (owner-approved 2026-08-13)

For a custom/fictional school the ONE geo input an author supplies is a
**state/region**; the compiler places the school at that **state's centroid**
(`stateCentroid`), which is what drives rivalry distance. Tiers:

1. **(primary)** author picks a `state` → placed at its centroid (+ small jitter
   so no two schools share exact coords).
2. **(optional, future)** a `lat`/`lng` map-pin override for precise placement —
   documented as a power-user nicety; the pin UI is NOT built now.
3. **(fallback)** if no `state` is given, the compiler places the school
   sensibly *within its conference's footprint* (mean of its placed conf-mates,
   else the national centroid) so it still lands near plausible rivals.

Rivalries stay **auto-from-geography** for v1.

**A conference:**

```
"RIVER": { name: "River Valley Conference", short: "RVC",
           division: "D1", conferenceClass: "power" | "midmajor" | "lowmajor" }
```

## Proposed blueprint schema (the `leagues` creation `.data`)

```jsonc
{
  "schemaVersion": 1,
  "name": "My Custom League",
  "mode": "replace",            // "replace" = full custom world
                                // "seed"    = overlay onto the procedural world
  "conferences": [
    { "id": "RIVER", "name": "River Valley Conference", "short": "RVC",
      "division": "D1", "conferenceClass": "power" }
  ],
  "teams": [
    { "id": "river_city_u", "name": "River City University",
      "division": "D1", "conf": "RIVER", "prestige": 6,
      "nick": "Rapids", "colors": ["#0a3d62", "#f6b93b"], "state": "MO" }
    // ... only id/name/division/conf/prestige are required; rest auto-fills
  ]
}
```

### Two modes — the important fork

- **`"replace"`** — the blueprint IS the world. The compiler builds the complete
  `{schools, conferences}` from the blueprint alone; procedural SCHOOL_DATA is not
  used. The author owns every team and conference. Requires enough teams to field
  a season (see validation).
- **`"seed"`** — the blueprint OVERLAYS the procedural world. Its conferences are
  added; its teams REPLACE procedural teams of the same `division` (removing an
  equal count so division sizes stay sane), or slot into named conferences. This
  is how "drop my three custom teams into a normal world" works without authoring
  330 schools. Procedural teams fill everything the author didn't specify.

`seed` is almost certainly the mode most players use; `replace` is the
total-conversion power-user path. Both compile to the same source-table shape, so
the seam doesn't care which was used.

## The compile step (`compileLeague(blueprint) → {schools, conferences}`)

New pure function. **Home (decided at build 2026-08-13): `js/engine/world.js`**,
not a separate module — it reuses world-gen internals directly (`stateCentroid`,
`makeAbbr`, `facilitiesFor`, `makeFlavor`, `staffFor`, `prestigeClamp`,
`COLOR_PAIRS`, `REGION_CENTROIDS`), and co-locating avoids exporting a dozen
internal helpers just to re-import them. Responsibilities, in order:

1. **Validate** (below). Reject with a readable reason; never compile a broken
   world.
2. **Normalize conferences** — map array → `CONFERENCES`-shaped object.
3. **Fill team defaults** — every optional field gets its auto value; geo placed;
   `abbr` deduped across the WHOLE table (static-table CAL-collision lesson from
   RECONCILIATION — the compiler owns dedup so two teams never share an abbr).
4. **For `seed`** — merge onto a procedural base: add blueprint conferences,
   swap blueprint teams in by division, trim procedural teams to hold counts.
5. **Return** the two engine tables. generateWorld does the rest unchanged.

Because compile output is *just the source tables the seam already accepts and
the probe already proves inert*, wiring is: `generateWorld(compileLeague(bp))`.
No further world-gen change.

## Validation rules (compile-time, fail loud)

- Every `team.conf` resolves to a `conference.id` in the blueprint (or, in
  `seed` mode, an existing procedural conference).
- Every `conference.division` and `team.division` ∈ {D1,D2,D3}, and a team's
  division matches its conference's division.
- `id`s unique among teams; `id`s unique among conferences.
- `prestige` ∈ allowed band for the division.
- **`replace` mode minimums** — enough teams per division and per conference to
  build a schedule (propose: ≥ the current schedule generator's needs; measure
  against `generateSchedule` before locking a number). A conference with 1 team
  can't play a round-robin.
- Name/abbr length caps; abbr auto-deduped rather than rejected.

## Working defaults — ADOPTED 2026-08-13 (owner can still veto later)

1. **Mode default** = `seed` (drop-in teams onto a procedural world).
2. **`replace` minimum team count** = soft floor + warning; hard floor ONLY where
   the scheduler would actually crash (a conference with <2 teams can't play).
3. **Custom team ↔ custom league** = a single `teams`-shelf entry compiles as a
   one-team `seed` blueprint (its `conf` references an existing procedural conf),
   so "coach my custom team" needs no league at all. compileLeague accepts either
   a full blueprint or a one-team seed — same code path.
4. **Rivalries** = auto-from-geography for v1; explicit declaration is later.
5. **Rosters** = stay procedural (prestige-driven). Individual-player authoring is
   the Team Editor's job, not the league shape.

## What is NOT in this doc (deliberately)

- The compile function itself (next build, once shape is signed off).
- The League Editor UI (browser-gated).
- Custom-team injection wiring. The seam is ready; the shape gates the wiring.
