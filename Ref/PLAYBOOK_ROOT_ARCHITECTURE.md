# The Playbook as the root of the game — architecture (2026-08-15)

Owner direction: *"From the beginning every play should have been selected out of one
of these custom playbooks and the game plan should have been how you control the
playbook. Playbook pillar + game plan pillar = live coaching pillar + play animation
pillar, built parallel, layer by layer. We didn't do that — structure the game this
way."*

Owner-ratified decisions (2026-08-15): live coaching KEEPS both existing call modes
(sheet/quick-category AND drill-down) — the book becomes what they read from, not a
new screen; EVERY AI team carries a real named playbook (scoutable); dynasty books
are SNAPSHOTS with an update prompt when the Workshop source changes.

## 0. The one honest sentence about where we are

The game already selects every snap through a playbook-shaped structure — it just
isn't named, owned, or shared. `gameplan.offFormations` (weighted looks) +
`gameplan.formationPlaybooks` (per-formation sheets) + the always-on
`FORMATION_PLAYBOOK` legality gate (sim.js ~4894) **is** a playbook, compiled by
hand into gameplan fields by five different writers (AI `setAIGameplan`, presets,
the wizard, `pb:` loads, the Game Plan UI). The refactor is therefore a
**re-rooting, not a rewrite**: introduce the named object, make the five writers
one, and leave the sim's math alone.

## 1. The as-built map (verified reads, this codebase)

- **Sim call path** (sim.js): `rollFormationEntry` on `offEff.offFormations` →
  `_pbGate = FORMATION_PLAYBOOK[formationId]` (always on) → `_fpbSheet =
  offPlan.formationPlaybooks[formationId]` overlays weights → `pickPass/RunConcept`.
  `forcedCall` (headset) outranks; situations overlay `offEff` per cell.
- **Live coaching** (app.js ~2400): sheet call (`{concept:"sheet"}`), category
  chips, drill-down to named concepts (`data-cs-callconcept`), a formation pin
  (`state.ui.callFormation`), PA/RPO/QB-run decorations; defense = named calls from
  `gameplan.defCalls` + per-field chips.
- **Game plan**: dials + situations + (since today) read-only book looks + usage
  sliders. Loading a Workshop book = field copy (`applyPlaybookToGameplan`).
- **AI**: `setAIGameplan` authors `offFormations` + `aiFormationSheets` — an
  implicit, nameless book per team, regenerated, never surfaced.
- **Animation**: the play record → watchphys + sepgeo/run2geo/yacgeo. The record
  does not carry which BOOK/LOOK/CARD produced the call.
- **Creator**: `customPlaybook` / `customDefBook` / composed plays live in the
  `cfb-creator` library, portable by construction, applied by copy.

## 2. Target object model

```
TeamBook (offense)                      TeamDefBook (defense)
{ name, source,                         { name, source,
  sourceId, sourceSaved,   ← update-prompt identity (creator id + saved stamp)
  formations: [{id, weight, variation?}],   ← the LOOKS
  sheets: {fid: {concept: weight}},         ← the CALL SHEET per formation
  plays: [customPlayId…],                   ← composed plays carried by this book
}                                         baseFront, frontMix, coverageScheme,
                                          aggression, pressIdentity, pressureSource,
                                          greenDog, spyQB,
                                          calls: {name: defCall…} }  ← defCalls move HOME
```

- `school.book` / `school.defbook` — SNAPSHOTS (save-stable), with
  `sourceId/sourceSaved` so the Game Plan can show "a newer version of this book
  exists — pull the update?" (one tap; overlays survive).
- `source`: `"builtin:Air Raid"` | `"creator:<id>"` | `"staff"` (AI-authored).
- **The game plan stops storing book fields and becomes the CONTROLLER:** usage
  weights (per look), tendency/depth/tempo dials, target shares, situations —
  overlays on the book. The situational-control system the project accidentally
  gained is exactly the control layer the target architecture wants; it stays,
  formalized as overlays.

## 3. The compile seam (the one new mechanism)

`compileTeamPlan(school)` = book snapshot + gameplan overlays → **exactly the
fields the sim reads today** (`offFormations`, `formationPlaybooks`, tendency, …).
The sim, the situations engine, and every probe keep their current inputs.

- **Zero-migration law:** a save with no `school.book` synthesizes one on load
  from its existing gameplan fields (`playbookFromGameplan` already does this) —
  named "«School» Offense", source `"staff"`. Every old save keeps working; the
  first compile must be byte-identical to today (prove with `_equiv_walk`).
- All five writers collapse to two verbs: `assignBook(school, book)` and
  `setOverlay(school, …)`. Presets become builtin books + overlay bundles.

## 4. The staged build (each stage ships green on its own)

**Stage 1 — the object + compiler (foundation).** Add `school.book`/`defbook`,
synthesis-on-load, `compileTeamPlan`, route the five writers through it. No UI, no
sim, no balance change. *Gate: `_equiv_walk` byte-identical vs pre-stage build on
empty overlays; `save_migration_check`; new `playbook_root_probe` (synthesis,
compile determinism, writer equivalence).*

**Stage 2 — AI teams get named books.** `setAIGameplan` → `buildAIBook` (name from
its scheme bucket: "Air Raid", "Power Spread"…, plus its authored sheets — the
code already writes these, it gains a name and the object shape). Scouting/team
pages surface the book name; film room language can reference it. *Gate: sim stat
bands unchanged (`stat_realism_harness`, `playcall_probe`) — naming must be
cosmetic.*

**Stage 3 — the Game Plan is the controller everywhere.** Finish what the Package
tab started today: every offense surface reads the compiled view and labels the
book ("from *Audit Book*"); "Save plan" saves OVERLAYS; swapping books keeps
overlays; the update prompt (snapshot vs library `sourceSaved`) lands here.
Defense: `defCalls` migrate into `defbook.calls` (synthesis keeps old saves).

**Stage 4 — live coaching reads the book (both modes kept, owner call).** The
formation pin lists YOUR book's looks with their diagrams; the concept drill-down
shows YOUR book's plays as CARDS (`renderPlayCard` — same art as the Builder);
composed plays in the book become callable (`forcedCall {customPlay: id}` through
the proven `compilePlay` band-clamp — human-call-only stays by construction).
Sheet/category quick calls unchanged. Defensive headset's named-call chips read
`defbook.calls`. *This is the "calling plays in Madden" moment — same screens,
the book underneath.*

**Stage 5 — the record knows the call, the broadcast shows it.** The play record
gains `{bookName, formationId, variation, concept | customPlayId}`. Drive log +
replay overlay can show the play card of what was called next to what happened —
the first visible thread from draw-up to whistle. *Presentation-only.*

**Stage 6 — the animation honors the draw-up.** Variation alignments wired
end-to-end (the dangling `layout:` pointers — see `Ref/CREATOR_FIDELITY.md` items
1–2), then composed-play `assigns` seed sepgeo's route generation so YOUR play
animates receiver-for-receiver as drawn. *Presentation-only, no outcome change —
the pillar-4 payoff.*

**Stage 7 — the designers.** Formation composer (one formation registry object +
alignment-legality validator + fixed-rulebook balance derivation) and the
defensive play composer (builds `defbook.calls` entries). These slot in cleanly
ONLY once stages 1–4 exist, because then there is exactly one place a new
formation or call plugs into.

## 4b. Offense/defense separation — the honest audit (owner question, 2026-08-15)

*"They need to be completely separate entities bottom to top on the same team —
is that what we have?"* **No. Consumption is two-sided; storage is one bag.**

- **One flat bag.** `school.gameplan` holds ~40 fields with offense
  (`offFormations`, `tendency`, `passDepth`, `targetShares`, `protIdentity`,
  `formationPlaybooks`, `motionRate`, `qbAggr`, `losFreedom`, …), defense
  (`defBaseFront`, `defFrontMix`, `defAggression`, `blitzPct`,
  `pressureIdentity`, `pressureSource`, `coverageScheme`, `covShell/covStyle`,
  `runCommit`, `edgePlay`, `defCalls`, `formChecks`, …) and team-level
  (`fourthDown`, `maxFGDist`, `baseTempo`, `situations`) as flat siblings.
- **Separation is enforced only by hand-maintained field lists that don't
  agree**: `applyPlaybookToGameplan`'s offense list, `applyDefBookToGameplan`'s
  defense list, app.js `PLAN_OFF_FIELDS`/`PLAN_DEF_FIELDS` (a different
  dialect), the Game Plan UI's tab wiring, and `getEffectivePlan` (which
  resolves BOTH sides into one mixed object). Situation cells and the weekly
  plan carry both sides in one cell — with special-case law where that hurts
  ("openers" is offense-only by convention, defensive fields written there are
  inert).
- **Two naming dialects** for the same defensive concepts: standing fields
  (`defBaseFront`, `blitzPct`) vs cell/effective fields (`defFront`,
  `runCommit`).
- **The failure mode is not hypothetical.** Two shipped bugs came straight from
  this: the Codex-review "offense dial wrote the defensive box" contamination
  (fixed `eb4c221`), and — found by this audit — the Defensive Playbook wrote
  its pressure look to `gp.pressIdentity`, a dead field, while the whole engine
  reads `pressureIdentity`: every custom defense's pressure look was silently
  lost (fixed 2026-08-15; `defbook_probe` now asserts the look reaches
  `getEffectivePlan`).
- What IS cleanly separated: the sim resolves each team's plan per side and
  never reads the offense's dials for defense except by name collision; the
  roster/depth chart is deliberately shared (one squad, two-way players);
  OC/DC are separate; `TeamBook` vs `TeamDefBook` sources are strictly sided.

**Stage-1 addendum (the fix): one canonical SIDE MANIFEST.** A single exported
map — `PLAN_FIELD_SIDE = { field: 'off' | 'def' | 'team' }` — that the compiler,
both appliers, the Game Plan UI, quick-plan/preset copies, and a new
`plan_side_probe` all read. The probe walks every field the sim/situations layer
consumes and fails if a field is missing from the manifest or written by the
wrong side's writer — so the next dead-field or cross-write can't ship. The
compiled output stays flat (zero sim change); sided-ness lives in the manifest
and the source objects, which is all four pillars need.

## 5. What deliberately does NOT change

- Concept outcome math, coverage tables, exec weights — untouched at every stage.
- Band safety: composed plays stay clamped and AI-invisible; blocking assignments
  stay diagram-only until a separately-gated band-limited protection hook.
- The save law (`gamePauseIsLive`, rehydrate) and the situations engine.
- The headset's two call modes (owner: "we have both and i like those").

## 5b. Addendum (owner, 2026-08-15): old saves do NOT need to survive

This relaxes less than it sounds like, because the compile seam was never
really about saves — it's about NOT rewriting the sim (hundreds of flat-field
reads), keeping the probe/A-B infrastructure meaningful, and keeping the five
writers converging on one output. **The architecture's shape is unchanged.**
What the relaxation actually buys, take all of it:

- **No save-migration work at any stage.** Synthesis-on-load shrinks from a
  guarded migration path to one line (`playbookFromGameplan` on any school
  without a book) or nothing — a fresh world is acceptable. The
  `save_migration_check` scope stops growing with this project.
- **Purge the legacy dialects while re-rooting**: the `normalizeFormations`
  legacy-name map, dead fields (e.g. the old `gp.pressIdentity`), and the
  standing/cell field-name splits (`defBaseFront` vs `defFront`) can be
  UNIFIED in the side manifest instead of aliased — one name per concept.
- **The `_equiv_walk` byte-identical gate stays** — not for saves, but as the
  proof that re-rooting didn't change sim behavior for identical inputs.
- **Keep `repairCreation` and the snapshot/update-prompt semantics** — those
  protect the CREATOR LIBRARY (portable by design, meant to outlive builds),
  which is a different promise from save compatibility and still wanted.
- v1 defbooks in the library still repair-load (already built, costs nothing).

## 6. Order and effort

1 and 2 are one focused pass each (1 is the risky one — gate it hard). 3 is
mostly done-in-spirit after today's Package-tab change. 4 is UI work on proven
surfaces. 5 is small. 6 is the big presentation lift (variation layouts are ~22
authored rows; sepgeo seeding is confined). 7 is the moat and should not start
before 4 ships. Recommended: 1 → 2 → 3 → 4 ship together as "the playbook
update"; 5 → 6 as "see your play run"; 7 as its own arc.
