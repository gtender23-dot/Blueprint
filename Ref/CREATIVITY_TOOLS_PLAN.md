# Creativity Tools Program — plan (drafted 2026-08-11)

**Owner ruling 2026-08-11: this program runs NEXT, ahead of the DNA/tree rework**
(tree rework stays ratified and queued behind it; `Ref/DNA_TREE_DESIGN.md` unchanged).
Pass order (updated by owner rulings 2026-08-11): **P1a Catalog Expansion → P1b
Formation Variations → P1 Playbook Builder → P2 Team Editor → P3 League Editor →
P4 Custom Play Composer.**
Strategic frame: player-creation tools are one of the four levers that justify the
$24.99 ceiling (see `Ref/RELEASE_PUNCH_LIST_2026-08-10.md` and the readiness review) —
the others being the watchable game (animation program CLOSED at M24), the
coaching-family hook (tree rework, queued), and platform maturity (punch list P2/P3).

## Why this is cheaper than it looks — the machinery that already exists

- **Play content is data, not code.** `js/concepts.js` defines every pass/run concept
  (depth, vs-coverage grades, exec weights, motion/choice flags); `FORMATION_PLAYBOOK`
  in `js/constants.js` maps each of 11 formations to its legal concept list. The sim
  consumes these tables — a custom playbook is a new table, not a new engine.
- **A library layer already ships.** `coachprofile.js` has per-coach saved gameplans
  (`saveGameplanToLibrary`, MAX 10) and saved teams (`saveTeamToLibrary`, MAX 8, field
  whitelist `SAVED_TEAM_FIELDS`, instantiable into Play Now). Persistence, naming,
  overwrite and delete flows all exist.
- **Identity is procedural and parameterized.** School name/nick/town/stadium/colors,
  logo generation (`logo.js` + letter marks), uniform/color identity — all data on the
  school object; `worldgen` composes it. An editor is a UI over existing fields.
- **Formation playbooks + call sheets are live systems** (coach-brain passes, F4
  content pass), so a custom playbook has a full downstream consumer: AI calling,
  live calling, tendency sheets, the trace viewer.

## Pass 1a — Catalog Expansion: THE BUILD SHEET (added 2026-08-11)

Current catalog: 23 pass + 15 run concepts, 289 formation-play combos (baseline
snapshot: the play-catalog-grid artifact, 2026-08-11). Target ≈40 pass / ≈20 run
(≈450+ combos). Pipeline per concept = the F4 checklist (concept object w/
vs-table + exec + routes hints, FORMATION_PLAYBOOK slotting, tag wiring, viewer
route shape, playbook_build_probe legality, band A/B). Thin books get priority
slotting: **Jumbo 15, Wishbone 19, Wildcat 19**.

### Round 1 — build from ALREADY-READ sources (no fetching, no approval gate)
Source-to-concept mapping, verified against SOURCE_LIBRARY.md 2026-08-11:
- **Snag / triangle family** ← #11 (3x1 bunch interior triangle: Chase/Dig-read/
  Drive-read, man-vs-zone settle rules, empty adjustments). Biggest single hole
  in the quick game.
- **Seam-Read Smash (2x2)** ← #10 (smash w/ seam-read + vertical-peel, MOF read).
  Variant/upgrade path for the existing Smash.
- **Yankee-family PA shot** ← #24 (Post/Climb/Pearl high-low off play action).
  The catalog's PA Deep Cross is the crosser family; this is the two-man
  MOF-killer shot.
- **Boot / sprint-out package** ← #41 (Run & Shoot pylon high-low + sit triangle,
  job-swap boot, GT-counter boot). Boot action = genuine catalog hole; also a
  red-zone identity piece.
- **Slip screen (jet action)** ← #42. Third screen family (currently tunnel/
  bubble/RB only).
- **Split-zone** ← #40 (read-the-Mike, motion-to-heavy). Distinct from Inside
  Zone; the modern staple missing from the run game.
- **Option Trap** ← #43 + #15 (trap timing off option fake). Feeds the option
  books (Wishbone/Flexbone/Wildcat — all thin).
- **Buck-sweep Reverse / misdirection tier** ← #43 (trick-play wing).
- **GL power-read hybrid** ← #12 (goal-line package; pairs with Jumbo's thin book).
- **Bunch Counter** ← #16 (counter from compressed 3x1 — lets Trips/Bunch carry
  a gap-scheme identity).

### Round 2 — UNREAD but already indexed (propose list → OWNER APPROVES → fetch
one at a time, per charter rules). All in THROWDEEP_GLOSSARY_INDEX.md, direct URLs:
- Pass concepts w/ dedicated guides: **Drive**, **Yankee** (confirm/deepen the
  round-1 builds), plus PA complete guide.
- Run schemes NOT in the game, each with a full guide: **Buck Sweep**,
  **Pin-and-Pull**, **Wham**, **Midline Option**.
- **The coverage-beater set — read ALL FIVE before authoring any vs-table:**
  "Five Plays that Beat Cover 0 / Cover 1 / Cover 2 / Cover 3 / Quarters."
  These are vs-coverage grades in prose — the authoring reference for every new
  concept's vs-table in P1a AND the rule seed for the P4 deriver.
- Optional sideways growth (formations, separate owner call): Wing-T, Single
  Wing system guides.

### Round 3 — genuine library gaps (needs a NEW web-search round, propose first)
Air Raid staples beyond the current book (Y-Corner, Shakes, 6/NCAA variants),
RPO route pairings (glance/slide/bubble off zone reads — ties to the known RPO
STOP from the rungame pass), Dart/counter-read runs.

### Standing notes for the pass
- #46 routes glossary (16 primitives: hitch, slant, quick out, stick, flat, whip,
  option, go, seam, corner, post, post-corner, square-in/dig, comeback, wheel,
  screen-family) = the P4 composer's route-primitive library — keep its taxonomy
  as the naming standard for `routes` hints NOW so P4 inherits clean data.
- Provenance: "SOURCE_LIBRARY #51–53" in older status logs is a numbering slip
  (library runs #1–48 then #54–56); the pass-concept seeds are #46/#10/#11/#24
  (owner-confirmed, per QB_PLAY_ASSESSMENT.md).
- Blitzology back-catalog labels (`Pass Protection`, `RPO`, `Fire Zone`, …) are
  still unpaged — defensive-leaning, low priority for P1a.

## Pass 1b — Formation Variations (added by owner ruling 2026-08-11)

A **variation tag layer**: each formation carries 2–3 named variations ("Trips/Bunch
— Closed", "Single Back — Ace Twins", "Power-I — Big"), where a variation = the base
formation plus a small DELTA, not a copy. Runs BEFORE the builder on purpose — the
builder's formation-first UI is designed around variations existing (entries read
"Formation (Variation) — Play"), never bolted on after.

Why it's one pass, not a program: a formation in this engine is already a bundle of
small data tables — FORMATIONS identity/lean, FORMATION_PACKAGES personnel,
FORMATION_PLAYBOOK play list, MATCHUP_MATRIX row, FORMATION_SITUATIONAL weights,
constants_field.js layout. A variation is a sparse override of that bundle.
Proven-cost comps: fronts wave 2 (4 fronts + FRONT MIX, one pass), the July
offensive expansion (5 formations, one batch).

Scope:
1. **Data model**: `FORMATION_VARIATIONS[formation] = { key: { label, deltas } }`
   — allowed deltas: personnel swap (e.g. TE↔slot WR), runIn/runOut lean nudge,
   matchup-edge adjustments vs specific front families, situational weight nudges,
   viewer layout id. Base formation with no variation stays BYTE-IDENTICAL in
   behavior (gate).
2. **Resolution hooks**: where personnel/matchup/situational resolve
   (formations.js `resolvePersonnel` / `getMatchupEdge` / `getSituationalMod` and
   the sim's formation stamps) accept an optional variation and apply deltas;
   absent variation ≡ today (inert-by-default, the run-scheme pattern).
3. **Viewer**: one alignment layout per variation in constants_field.js (this IS
   Tier-1 visual variety, absorbed here); exchange-window audit for any variation
   that moves the backfield (M21 gotcha #1 — mesh/snap windows scale with real gap).
4. **Surfaces**: gameplan formation picker, depth-chart packages, live calling,
   playbook builder (P1) all show "Formation (Variation)". AI usage OFF by default;
   if enabled for AI identities, it takes the standing band gate.
5. **Starter set**: 2–3 variations per formation, thin books first (Jumbo,
   Wishbone, Wildcat get personnel-flavor variants that widen what they can carry).
- Probes: `formation_variation_probe` (node: no-variation ≡ baseline bit-exact
  where feasible; each delta provably applied; personnel legality vs depth chart),
  viewer alignment probe extension (all variation layouts render, 22-actor law,
  no exchange-window smear), band A/B (matchup deltas move outcomes → full
  stat_realism gate).
- Store-page math: 11 formations × ~2.5 variations ≈ 28 formation looks; combined
  with P1a's play expansion the Madden-count lands ~4-digit combos.
- Open question (Q5, decide at build): do variations get their OWN play-list
  restrictions (a Closed bunch can't run Four Verts?) or inherit the base
  formation's list unchanged? Inherit-unchanged is the safe default; restrictions
  add realism but multiply the legality surface the builder must validate.

## Pass 1 — Playbook Builder

Player-facing tool: assemble a named playbook — pick formations, pick each
formation's concept list from the legal catalog, set situational tendencies — save it
to the library, load it into any gameplan, use it in dynasty and Play Now.

Scope (build order inside the pass):
1. **Data shape**: a `customPlaybook` object = name + formation list + per-formation
   concept subset (validated against `FORMATION_PLAYBOOK` legality) + optional
   situational weight overrides (reuse sitsets/tendency shapes). Rides the existing
   gameplan-library persistence; version-stamped like saves.
2. **Builder UI** — **RULED 2026-08-11: formation-first presentation (Madden-style).**
   The player picks formations, then flips through each formation choosing from ITS
   legal play list; every entry displays as "Formation — Play" with its diagram.
   Concepts stay the single engine truth underneath (one Mesh); the UI never exposes
   the concept-reuse model. Rationale: matches every mainstream football game's
   mental model; the data is already stored formation-first (FORMATION_PLAYBOOK);
   the trace viewer draws any concept from any formation so per-combo art is free.
   Madden-math baseline: 38 concepts × 11 formations = 289 legal combos today
   (see the play-catalog-grid artifact / 2026-08-11 snapshot); expansion target
   ≈450+. Known thin books = cheapest expansion wins: Jumbo 15, Wishbone 19,
   Wildcat 19. Universal plays today: QB Sneak, Draw, Slant-Flat, Stick,
   Red-Zone Fade. New screen off Game Plan — formation picker, concept picker with
   the concept's existing scouting language surfaced (depth tier, best/worst vs
   coverage families in normalized plain language — no coefficients, per the
   unchanged help rules), live count/legality feedback, save/name/duplicate/delete.
3. **Consumption**: gameplan selects a custom playbook; the call brain restricts to
   its formations/concepts; live calling + call sheet + openers show it; trace viewer
   needs nothing (concepts unchanged).
4. **Export/import**: playbook as a small JSON file (same pattern as save
   export/import) — the seed of sharing/modding.
- Probes: `playbook_builder_probe` (node: legality — no illegal formation/concept
  pair can be saved or called; empty/degenerate books refused; round-trip through
  library + export/import), a `pw` smoke for the builder UI, and a band A/B proving a
  vanilla-equivalent custom book ≡ default behavior (mean-neutral by construction).
- Design rulings (owner, 2026-08-11):
  - **Q1 depth — RULED: larger catalog + custom plays, feasibility-checked.**
    Owner wants (a) a bigger concept catalog and asked (b) whether custom play
    design is handleable. Source-verified answer: the sim resolves route
    CHARACTER (depth tier, sharp/speed shape, break direction, leverage attack —
    `routeDuel` in sepgeo.js; concepts carry per-receiver `routes` hints), not
    drawn geometry — so freehand route DRAWING has no resolver and stays out of
    scope. But a **route-primitive composer** is genuinely achievable: the player
    assigns each eligible receiver a route from a primitive library (slant, drag,
    curl, out, dig, post, corner, wheel, seam, go, screen…), and the game DERIVES
    the play's vs-coverage profile from coverage-beating rules (hi-lo vs zone,
    crossers vs man, three-level stretches, etc.). Validation gate: the deriver,
    run on an EXISTING concept's route set, must approximate that concept's
    hand-authored vs-table — the current catalog is the answer key. Catalog
    expansion slots as **P1a** (current catalog: 23 pass + 15 run; target ≈40
    pass / ≈20 run; sources #51–53 — samfleener/playbookgamer concept catalogs —
    already seeded; F4 proved the add-a-concept pipeline). The composer is its
    own pass — see P4 below.
  - **Q2 AI use — RULED: player-only for now.** Band-safe by construction; AI
    adoption revisited later behind a stat_realism gate.

## Pass 2 — Team Editor

Edit school identity and roster: name, nick, town, stadium name/size, colors, logo
(procedural parameters + letter marks), uniforms; roster names/numbers/appearance;
optionally attribute editing.
- Foundation: `SAVED_TEAM_FIELDS`, saved-team library, identity fields on the school
  object, procedural logo/uniform systems.
- The hard design line is **competitive integrity**: renaming/recoloring is cosmetic
  and safe anywhere; *attribute/roster* editing inside a live dynasty is a cheat
  lever. Options: (a) cosmetic edits anywhere, stat edits only in Play Now/saved
  teams; (b) full editing anywhere with a "modified world" badge on the save; (c)
  full editing only at world creation. **Owner decision needed** (Q3).
- Probes: field-whitelist round-trip (edits survive save/load and never leak into
  other schools), worldgen dedup respected (renames can't collide abbrs — note the
  known CAL abbr issue), pw smoke for the editor UI.

## Pass 3 — League Editor

Structure the world at creation: conference/division composition, membership,
custom team import (from Pass 2 saved teams), sizes. Later: schedule rules.
- Foundation: `generateWorld`/`generateSchedule` already parameterize composition
  internally; this exposes a creation-time config + injects saved teams.
- Most new work of the three; also the base for any future workshop/mod support.
- Probes: worldgen_check against custom configs (roster coherence per division,
  schedule validity, rankings/postseason integrity with non-standard conference
  counts), save round-trip of a custom world.
- Open question (Q4): minimum viable = conference renaming/membership shuffle +
  team injection at creation. Full custom sizes (e.g. 6-team divisions) touch
  scheduling/playoff code — decide after seeing P1/P2 cost.

## Pass 4 — Custom Play Composer (added by owner ruling 2026-08-11)

Build plays from route primitives; the matchup profile is DERIVED, never
player-authored (a player must not be able to hand himself a play that grades +10
vs everything). Scope: route-primitive library (each primitive = depth tier, break
direction, shape class, screen/motion flags) → per-formation slot assignment UI →
deriver that composes the concept object (depth, `routes` hints, vs-coverage table
from coverage-beating rules, exec weights from the primitives' demands) → the
composed play drops into the SAME custom-playbook container as P1, so builder,
gameplan, live calling and the trace viewer consume it with no new plumbing.
Probes: deriver-vs-answer-key (existing concepts' authored tables reproduced within
tolerance), legality (no degenerate spacing/duplicate-slot books), band A/B
(player-only, but composed plays still route through the shared resolution path).
Placement note: sequenced after P3 by default (the deriver is the one
research-grade piece in this program); owner may pull it earlier.

## Non-goals (this program)
Freehand route DRAWING (no resolver for arbitrary geometry — see Q1 ruling; the
route-primitive composer is the supported form). Workshop/online sharing infrastructure
(export/import files are the P1 primitive; hosting is a platform question). Uniform
*drawing* tools beyond the procedural parameter space. In-dynasty world restructuring
(league edits are creation-time in P3).

## Standing constraints (inherited)
Normalized help language for all builder copy (the stylized "help voice" was retired
2026-08-11; the underlying rules are unchanged — never print a coefficient, weight
table, or threshold; explain the real mechanism plainly).
Never touch Buy-In/Coaching-Points remnants. Exact-string edits in the lowered idiom.
Every pass: probe → (band A/B if the sim can feel it) → build → boot → core gate →
device commit + doc UPDATE. New surfaces register in `_gate_manifest.mjs` core, demote
to full once settled.
