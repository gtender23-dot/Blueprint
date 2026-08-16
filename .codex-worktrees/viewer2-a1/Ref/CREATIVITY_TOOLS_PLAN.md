# Creativity Tools Program — plan (drafted 2026-08-11)

> **P1a KICKED OFF — 2026-08-13.** Pipeline proven end-to-end on the first concept.
> Two findings for whoever runs the rest:
> 1. **Verify a concept isn't already in the catalog under another name before authoring.**
>    Round-1's "Snag / triangle" is **already shipped as `Spot`** (the comment above the
>    `Spot` entry in `concepts.js` literally says "Snag triangle…"). Building "Snag" would
>    have been a duplicate. Genuinely-absent Round-1 holes confirmed: **Boot, Slip Screen,
>    Split-Zone, Yankee, Seam-Read Smash, Option Trap, Buck-sweep.**
> 2. **`Split-Zone` (run) shipped as the pipeline proof (16th run concept).** Authored the
>    `RUN_CONCEPTS` entry (`type run_inside`, `vsBox {loaded +.01, light +.03}` — a touch
>    better than Inside Zone vs a loaded box, worse vs light; carries the glance RPO;
>    renders on the inside-run resolver, no new viewer art), slotted into 5 run books
>    (Single Back / Spread / Trips-Bunch / Pistol-RPO / Flexbone). Gate: `playbook_build_probe`
>    PASS, called 273× / 40 games (healthy share), matched A/B ypc Δ −0.026, and
>    **`stat_realism` 26.2 pts/team — in-band, nothing new** (the −0.74 matched-A/B pts was
>    divergence noise from reshuffling the call pool, not a regression). The per-concept
>    recipe that worked: author the data object → slot into `FORMATION_PLAYBOOK` → build →
>    `playbook_build_probe` → matched A/B (ypc for runs) → `stat_realism` band check.
>
> **P1a progress — 3 concepts shipped (catalog 23p/15r → 25p/16r):** `Split-Zone` (run, above);
> `Yankee` (deep pass, `paNative`) — the two-man play-action MOF shot (post over a dig), kills
> single-high (`Cover 1 +.07 / Cover 3 +.05`), capped by two-high, distinct from PA Deep Cross,
> slotted into all 9 PA-Deep-Cross books, called 159×; `Seam-Read Smash` (medium) — Smash with a
> seam that reads the safety, trades a little C2 punch (`.09→.07`) for real life vs single-high
> (`Cover 3 −.04 → +.02`), slotted into all 8 Smash books, called 197×. Band check for both:
> `stat_realism` Points 25.9 / Pass yds 247 in-band, only the standing comp% flag (nothing new).
> **Remaining Round-1 holes:** Boot and Slip Screen need *mechanic* work (QB rollout; a 4th
> screen `kind`), not just a data object; Option Trap / Buck-sweep are data-shaped variants.
>
> **P1a batch B — 12 more concepts (catalog 25p/16r → 33p/20r; RUN TARGET HIT):**
> pass: `Spacing` (quads zone-spacing), `Double Slants` (man rub), `Hoss` (hitch-seam blitz
> answer), `Drive` (shallow+dig MOF), `Bench` (hitch-out sideline), `Stick-Nod` (stick+go),
> `Scissors` (post-corner switch), `Skinny Post` (bang-8 single-high killer). run:
> `Wham` (H-back trap vs loaded box), `Buck Sweep` (guards pull outside), `Pin-and-Pull`
> (perimeter OZ), `Dart` (tackle-pull inside). Slotted efficiently via two safe anchors
> (`Red-Zone Fade` → all formations for the WR/TE passes; `Toss` → the 8 run books for the
> runs). Gate: `playbook_build_probe` PASS, **all 12 called at healthy rates** (54–130 / 25
> games), `stat_realism` **Points 26.4 in-band, nothing new**. Pass sits at 33/≈40; ~7 more
> pass concepts to target, then the mechanic concepts + the P1/P2/P3/P4 editors.
>
> **P1a batch C — +7 pass → CATALOG TARGET HIT (40 pass / 20 run).** `Whip` (whip/return
> man beater), `Follow` (stacked-crosser rub), `Y-Option` (TE leverage option), `Deep Out`
> (arm sideline), `Comeback` (deep off-corner answer), `Corner-Post` (double-move man
> beater), `Deep Over` (single-high killer). `playbook_build_probe` PASS, all 7 called
> (59–80 / 25 games), `stat_realism` **Points 26.2 in-band, nothing new**.
>
> ## ✅ P1a CATALOG EXPANSION COMPLETE — 40 pass / 20 run, every concept band-clean.
> 19 concepts added across 3 batches (Split-Zone; Yankee + Seam-Read Smash; batch B ×12;
> batch C ×7). All validated `playbook_build_probe` + call-frequency + `stat_realism`. The
> remaining Creativity Tools work is **P1b Formation Variations**, the two mechanic-heavy
> concepts (**Boot** rollout, **Slip Screen** 4th screen kind), and the UI editors
> **P1 Playbook Builder → P2 Team Editor → P3 League Editor → P4 Custom Play Composer** —
> each its own focused build (the editors are real UI programs, not data passes).
>
> ## ✅ MECHANIC CONCEPTS DONE — Slip Screen + Boot (2026-08-13)
> - **Slip Screen** (4th screen kind): concept `screen:'slip'`; sim resolver routes 'slip'
>   to the WR target; viewer adds a `slip` screenKind (backside catch geometry + delay).
>   Player-callable like the other named screens; band-neutral (not AI-auto-selected).
> - **Boot** (play-action bootleg): `paNative + boot`; the viewer rolls the QB toward the
>   flood side (a designed `_flushX`, reusing the item-9 lateral-launch machinery). AI-
>   selectable — called 65× / 30 games, **100% play-action**, ~57% completion; `stat_realism`
>   Points 26.2 in-band, nothing new. vs-table is a single-high/man answer capped by two-high.
> - Both `playbook_build_probe` PASS. **The on-screen animations (slip backside, QB rollout)
>   need a browser eyeball — no viewer render in this sandbox.**
>
> **Now remaining: the four editor UIs.** Catalog concepts, both mechanics, AND P1b
> Formation Variations are complete (see below).
>
> ## ✅ P1b FORMATION VARIATIONS — engine layer DONE (2026-08-13)
> `FORMATION_VARIATIONS` in constants.js: **22 variations across all 11 formations**, each
> a SPARSE delta (never a copy) — `pkg` personnel override, `lean` passLean nudge,
> `matchup` per-front nudge, `situational` bucket nudge, `layout` viewer id.
> - **Inert-by-default (gate):** `resolvePersonnel` / `getMatchupEdge` / `getSituationalMod`
>   / `pickPlayType` all take an optional variation key; null ⇒ base is BYTE-IDENTICAL.
>   `stat_realism` default path reads 26.1 pts — unchanged — because AI never sets variations.
> - **Selection rides the gameplan formation entry's `.variation`** (`pickedVariation` reads
>   it back after the roll); a live human call can name it via `forcedCall.variation`. So a
>   saved gameplan and the P1 builder can carry one; this is why P1b runs BEFORE the builder.
> - **Q5 ruled: inherit-unchanged** — variations do NOT restrict the base play list (safe
>   default; restrictions can be added later if realism demands).
> - **Probe:** `formation_variation_probe` (core tier) — 393 checks PASS: inert-by-default,
>   every delta applied+clamped, varied package fields exactly 5 skill, `pickedVariation`.
> - **Band A/B:** all-formations-forced-variation stress lands ~24.3 pts (run-heavy low edge,
>   in real band); the player chose those looks. Default/AI path is untouched.
> - **DEFERRED to the browser gate:** the per-variation viewer alignment layouts
>   (`layout` ids → constants_field.js) and the gameplan/depth-chart/builder "Formation
>   (Variation)" picker UI. The `pkg` personnel-swap is fully live on the sim path
>   (`resolvePersonnel`); on the human field-assign path it awaits its variation layout.


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

## The four editors — WHERE THEY LIVE (owner-ruled 2026-08-13)

All four editors are reachable from the **Main Menu Creator hub**, and every
creation saves to a single **global, coach-and-tree-INDEPENDENT** library so it
loads into ANY new tree/world. The Playbook Builder and Play Composer ALSO mount
inside the in-dynasty **Game Plan** screen (as tabs), so you can build/edit mid-
career; the Team Editor and League Editor are Main-Menu-only (world-setup tools).
Both surfaces read/write the SAME store, so they can never disagree.

- ✅ **DONE — the store foundation (`js/engine/creator.js`, 2026-08-13):** a
  standalone `cfb-creator` localStorage store, separate from the per-coach
  `plans`/`teams` quick-saves in coachprofile.js. Shelves: `playbooks`, `plays`,
  `teams`, `leagues`. CRUD + rename + duplicate + export/import (a creation is a
  self-describing JSON string, so it's shareable) + caps + corruption tolerance.
  An entry's `data` binds to NOTHING (no coachId/treeId/worldId/schoolId) — that
  portability is the whole point. `creator_store_probe` (core) 46 checks PASS.
- ✅ **DONE — the world-source seam (`generateWorld(opts)`, 2026-08-13):** world-gen
  now accepts `opts.schools` / `opts.conferences`, both defaulting to the module
  globals, so `generateWorld()` and `generateWorld({})` are byte-identical to
  today (`creator_world_probe`, core, 9 checks, seeded 336-school snapshot diff).
  This is the single door custom teams (a modified schools array) and custom
  leagues (a replacement `{schools,conferences}` pair) enter a world. Injection is
  NOT wired — the shape gates the wiring.
- 📄 **PROPOSED — league-blueprint data shape (`Ref/LEAGUE_BLUEPRINT.md`, 2026-08-13):**
  what a `leagues` creation contains and how a new `compileLeague()` turns it into
  the two source tables the seam accepts. Two modes: `seed` (overlay custom teams
  onto a procedural world) and `replace` (full custom world). Awaiting owner review
  before the compiler is built.
- ✅ **DONE — customPlaybook shape (`js/engine/playbook.js`, 2026-08-13):** the
  Playbook Builder's data foundation. validate/apply/extract; `playbook_shape_probe`
  (core) 24 checks. See Pass 1 §1.
- ✅ **DONE — Play Composer Model A (`js/engine/customplay.js`, 2026-08-13):** the
  band-safe half — a custom play resolves to its base concept verbatim (all 62
  concepts grade-identical, `custom_play_probe` 221 checks), so it cannot move a
  band. The grade-authoring half (Model B) awaits an owner ruling — see
  `Ref/PLAY_COMPOSER.md`.
- **Engine foundations for all four editors are now complete and node-proven**
  (store, world seam + compileLeague, customPlaybook, customplay Model A). What
  remains is browser-gated: the four editor UIs, the Main-Menu Creator hub shell,
  the two Game-Plan tabs, and wiring `compileLeague` into the new-game flow. Plus
  the two owner decisions: the League-blueprint sign-off and the Play-Composer
  Model-B ruling.
- 📄 **ENTRANCES + WIZARD + SCHEME MODEL — DECIDED (`Ref/CREATOR_ENTRANCES.md`,
  2026-08-13).** How players reach/use the Creator (front door + in-context
  entrances + inline ＋Create→return), the modernized new-game wizard (optional-
  by-default spine + Quick Start), the unified SCHEME model (offense playbook+
  gameplan + defense playbook+gameplan + DERIVED DNA lean), and the offense/
  defense split (Creator/scheme-LAYER, runtime gameplan + save format UNCHANGED;
  `side` tag on shelves; defensive play-composer deferred). 12 decisions logged.
  Editors must be built as EMBEDDABLE components with a return context. This is
  the spec the UI build (and Codex) build against.

## Pass 1 — Playbook Builder

Player-facing tool: assemble a named playbook — pick formations, pick each
formation's concept list from the legal catalog, set situational tendencies — save it
to the **global Creator library** (`js/engine/creator.js`, kind `playbooks`),
load it into any gameplan, use it in dynasty and Play Now.

Scope (build order inside the pass):
1. **Data shape** — ✅ DONE (`js/engine/playbook.js`, 2026-08-13). A `customPlaybook`
   = name + `formations` (id/weight/variation, → `gameplan.offFormations`) +
   `sheets` (per-formation concept→weight, → `gameplan.formationPlaybooks`, the
   sheet the sim ALREADY consumes) + optional tendency/passDepth/rushInPct.
   `validatePlaybook` (concept legality vs `FORMATION_PLAYBOOK`, formation/variation
   existence, tendency — errors hard, warnings advisory), `applyPlaybookToGameplan`
   (clones, populates the fields, preserves defense/target-shares/situations, throws
   on a broken book), `playbookFromGameplan` (save current plan as a book),
   `legalConceptsForFormation`, `emptyPlaybook`. Stored on the `playbooks` Creator
   shelf. `playbook_shape_probe` (core) 24 checks PASS incl. a book driving a live
   sim. **The Builder UI is the only piece left here — browser-gated.**
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
