# COHESION DISPATCH — remediation D-blocks (2026-08-18)

One block per unattended session, format of `Ref/DISPATCH_PLAN_2026-08-17.md`.
Paste a block VERBATIM. **Nothing outcome-bearing runs before the owner ratifies
the OPEN DECISIONS + disposition table in `Ref/COHESION_AUDIT_2026-08-18.md`** —
the dependency column enforces that. OD-n references are that file's decisions.

Dependency order:

| block | needs | parallel-ok with |
|---|---|---|
| D11 (manifest + probe extension, data-only) | nothing | anything, incl. D1–D9 |
| D12 (badge lists + callSheet hygiene, UI-tier) | OD-11/OD-12 ratified | D1–D9, D11 |
| D13 (starter-data repair + validator) | **OD-7 answered per card** | D11 |
| D14 (card vocabulary unification) | **OD-6 table ratified + D13** | — |
| D15 (precedence ratification) | **OD-1/OD-2/OD-3 picked** | D13 |
| D16 (blitzPct retirement + placebo enums + zombie retirements) | **OD-5/OD-8/OD-9** | D13 |
| D17 (writer-graph collapse, Stage-3-for-real) | **OD-10 + D11** (D12–D16 landed or explicitly deferred) | — |

Standing laws baked into every block: edit `js/` + `style.css` only; node gates
in-session (named probes ×3; new/changed probes registered in CORE); browser
verification OWED — ledger it; STATUS dated section with ONE OWNER CHECKLIST;
commit scoped via the `_to_delete` lock workaround, NEVER push; DPB2's law — no
player-facing control is silently removed, ever: retire = disclose, relocate, then
remove.

---

## D11 · MANIFEST COMPLETION (data + probes only — no consumer rewired)

Read CLAUDE.md, Ref/STATUS.md (top), Ref/COHESION_AUDIT_2026-08-18.md (OD-11 +
disposition table), js/engine/teamplan.js. Then:

1. Extend `PLAN_FIELD_SIDE` with the audited gaps: `screenRate`, `paRate`,
   `chipHelp`, `wildcatPassRate`, `rpoKeepPct`, `rbCarryShares`, `runDirection`
   → `off`; `callSheet` → `def`; `stFakes`, `puntDef`, `retScheme`,
   `patApproach`, `surpriseOnside` → `team`. PURE DATA — the compiler's
   partition semantics do the rest (an off/def field moves from overlay into its
   book on next synthesis; `splitTeamPlan` is lossless by construction, but PROVE
   it: `playbook_root_probe` must stay green, and if it reds, the field stays
   OUT and the red is reported, not fixed around).
2. Extend `plan_side_probe`'s SIM_CONSUMED list to cover every field the audit's
   census shows sim.js reading (the §1 tables) so the next gap can't ship.
3. Extend `plan_cohesion_probe` §5 if D13 has not landed yet (keep the pins
   current with the tree).

Gates: `plan_side_probe` ×3, `playbook_root_probe` ×3, `plan_cohesion_probe` ×3,
`book_update_probe`, `save_migration_check`, clean build. `_equiv_walk`
byte-identical (manifest data changes book/overlay PARTITION, not the compiled
flat plan — if the walk diverges, a partition bug exists: revert, report).

---

## D12 · THE HONEST REPORT CARD (UI tier — badge lists + stale callSheet)

Read CLAUDE.md, Ref/STATUS.md, Ref/COHESION_AUDIT_2026-08-18.md (OD-11/OD-12),
js/ui/app.js 1662-1760, js/ui/views/gameplan.js 2934-3015,
js/engine/defbook.js applyDefBookToGameplan. Owner has ratified OD-11/OD-12. Then:

1. Rebuild `PLAN_OFF_FIELDS`/`PLAN_DEF_FIELDS` from the truth: the set of fields
   the SIT panel can actually write (audit census §8), minus never-cell fields.
   Drop the dead `pressureIdentity` entry. The badge must read CUSTOM iff the
   cell differs from the standing plan on a field the coach can set there.
2. callSheet hygiene on defensive book load: when `applyDefBookToGameplan`
   replaces `defCalls`, rebuild `callSheet` rows to reference only surviving
   call names (drop dead rows; do NOT invent new weights). Same on the
   `#gp-lib-load` dpb/ddb/dd branches. The UI cleanup handlers
   (gameplan.js 2036-2057) already purge on edit — this closes the load door.
3. Surface it: the Matchup Call Sheet's empty-cell copy already explains
   inheritance; a row whose calls all died should render as empty, not linger.

Gates: clean build + CSS; `defbook_probe` ×3; `defcall_ui_smoke` (PW — OWED if
unrunnable); `plan_cohesion_probe` ×3; a NEW section in `defsheet_probe` or
`plan_cohesion_probe` proving book-load leaves no dead callSheet row. NOT
`_equiv_walk`-neutral (UI DOM changes) — say so in STATUS, run the walk anyway
and attribute the diffs.

---

## D13 · STARTER-DATA REPAIR + VALIDATOR TEETH (outcome-bearing, owner-itemized)

Read CLAUDE.md, Ref/STATUS.md, Ref/COHESION_AUDIT_2026-08-18.md (OD-7 — the
owner's per-card intent answers are REQUIRED input), js/engine/defaultbooks.js,
js/engine/defbook.js validateDefBook. Then:

1. Fix every invalid card extra to the owner-stated intent. Audit's findings:
   `zoneStyle:"sky"/"cloud"` (Coastal Cover 3 — almost certainly `rotation`),
   `zoneStyle:"quarterQuarterHalf"` (no legal target — owner names one),
   `zoneStyle:"fire"/"soft"` (Pressure Everything), `robberCall:true` ×6
   (presumably `"rob"`), `greenDog:true` on "Dime Green Dog" (either
   `dogGame:"green"` or wait for D14's vocabulary). Every change is a REAL
   behavior change — band-gate it.
2. Give `validateDefBook` teeth on the extras: enum-check `runCommit` (number),
   `edgePlay` (contain/balanced/crash), `robberCall` (auto/rob/overtop),
   `zoneStyle` (spot/balanced/match), `dogGame` (green/cross), `pressLevel`
   (press/balanced/off), `rotation` (sky/cloud/buzz) — warnings for unknown
   keys so a future vocabulary can add keys without bricking old books.
3. Update `plan_cohesion_probe` §5: the invalid-values pins FLIP (they assert
   absence now) — that is the probe working as designed.

Gates: `defbook_probe` ×3, `defsheet_probe` ×3, `plan_cohesion_probe` ×3
(updated), `covfam_probe 120`, `defcall_probe`, clean build. Band check:
`stat_realism` at AI mix if any AI-reachable book changed (the six starters are
player-pickable AND AI-visible via defaults — run it).

---

## D14 · ONE CARD, ONE VOCABULARY (the DPB2 1:1 claim made true)

Read CLAUDE.md, Ref/STATUS.md, Ref/COHESION_AUDIT_2026-08-18.md (OD-6 ratified
vocabulary table + collision class 2), js/engine/defbook.js 60-105,
js/engine/sim.js applyDefCall (182-218) + pickDefCall (246-290). Then:

1. Export ONE `CARD_VOCAB` table (defbook.js): every card element, its legal
   values, and which of the three seams (call / cell / check) consumes it.
   `cardToDefCall` / `cardToCell` / `cardToFormCheck` all derive from it.
2. Close the ratified gaps — expected shape (owner may amend): the call seam
   gains `pressLevel` (pickDefCall normalizer + applyDefCall branch + syncDefEff
   already carries pressLevelEff); the cell seam gains nothing (cells can't
   speak dogGame — document); the check seam gains the family coverages
   (translate through the ONE implies table) + robberCall/zoneStyle if ratified.
3. Unify the THREE family→shell copies (sim.js 320, 326; defbook.js 77) into one
   exported table; fix the sim.js:320 copy's missing Cover 2-Man as part of the
   merge (verify it was shell-only cosmetic first — report what it changed).
4. `card_lint_probe` + `defsheet_probe` vocabulary pins updated WITH the change.

Gates: `plan_cohesion_probe` (rewritten pins) ×3, `defsheet_probe` ×3,
`defbook_probe` ×3, `covfam_probe 120`, `defcall_band_ab`, clean build,
`stat_realism` at AI mix (pressLevel entering the call path moves coverage
math — this is the band-gated block). NOT before D13.

---

## D15 · PRECEDENCE, RATIFIED AND WRITTEN DOWN (sim seam)

Read CLAUDE.md, Ref/STATUS.md, Ref/COHESION_AUDIT_2026-08-18.md (precedence
table + OD-1/OD-2/OD-3 — the owner's picks are REQUIRED input),
js/engine/sim.js 4639-4801. Then, per the picks:

1. Implement the ratified winners (expected: check clears/overrides covFamily
   when it writes shell/style; forcedDefCall beats `_nextPlay` on overlap).
   Smallest possible edits at the apply sites; NO reordering beyond the picks.
2. Write the precedence down as a comment block at 4639 (the table from the
   audit) — the first time it exists anywhere but prose.
3. Extend `plan_cohesion_probe` §2 with the ratified-winner arms (the current
   arms flip from pinning the defect to pinning the fix).

Gates: `plan_cohesion_probe` ×3, `covfam_probe 120`, `defcall_probe`,
`timecontrol_probe` (the `_nextPlay` seam), `record_call_probe`, clean build,
`stat_realism` at AI mix if AI plans can hit the changed path (AI has both
callSheet and formChecks — they can: run it).

---

## D16 · RETIREMENTS, DISCLOSED (blitzPct writers · placebo enums · zombies)

Read CLAUDE.md, Ref/STATUS.md, Ref/COHESION_AUDIT_2026-08-18.md
(OD-5/OD-8/OD-9 + collision class 3), js/engine/ai.js 297,
js/ui/views/gameplan.js 411-478, js/engine/defbook.js DEF_COVERAGE_SCHEMES,
js/engine/world.js 1736. DPB2 law applies to every item: disclose, never
silently delete. Then:

1. blitzPct → derived-only: `ai.js:297` writes `defAggression` (stop chosen from
   its aggression roll) instead of a raw number; Simple-mode Defensive Posture
   writes the stop via `setAggr` (fixing the proven stale-pair discard);
   Simple-mode cells write `defAggression`, not `cell.blitzPct`. The sim's
   normalize/migration shims STAY (old saves).
2. coverageScheme placebos per OD-5's pick: narrow every PICKER to
   balanced/lockTop/bracketTop (books carrying the old values still load and
   resolve as balanced — exactly as today, now honestly); Simple mode maps
   attack/protect to real fields it already sets. Labels say what changed.
3. pressureSource per OD-9: the creator's pressure-pie moves behind a
   "does nothing yet" disclosure or is removed from the editor surface (owner's
   pick); schema keeps the field (old books load); `defaultGameplan()` stops
   shipping it.
4. `_liveTempo` dead reads: either delete the `_liveTempo ||` fallbacks
   (sim.js 5703/5718/5766) or build the live-tempo control they imply — owner's
   pick; deleting is behavior-neutral by construction (never written).
5. Fixture hygiene ride-along: drop `clockMgmt`/`defFormation` from
   js/engine/bench.js fixtures (inert; tools/ fixtures untouched).

Gates: `plan_cohesion_probe` ×3 (pins updated), `defbook_probe`,
`save_migration_check` ×3, clean build, `stat_realism` at AI mix (item 1 moves
AI aggression distribution — THE band risk of this block; if it reds, item 1
ships alone with its own tuning pass). `_equiv_walk` for items 4-5 only if
shipped separately.

---

## D17 · THE WRITER-GRAPH COLLAPSE (Stage 3 for real — the big one)

Read CLAUDE.md, Ref/STATUS.md, Ref/PLAYBOOK_ROOT_ARCHITECTURE.md §3,
Ref/COHESION_AUDIT_2026-08-18.md (OD-10 + writer graph), js/engine/teamplan.js.
Owner has ratified OD-10. Batched — each batch `_equiv_walk` byte-gated:

1. Batch A (loads — lowest risk): gameplan.js load handlers (2934-3039),
   `applyStartingChoices`, `bookpush.js`, the wizard (`newgame.js 800-843` —
   THE stale-book bug: it currently runs after synthesizeLeaguePlans and never
   re-synthesizes) → `assignBook`/`assignDefBook`/`setOverlay`. Delete the
   wipe-and-Object.assign idiom per site as it converts.
2. Batch B (AI): `setAIGameplan` builds a BOOK + overlay and assigns them
   (ai.js 270's wholesale write retired); `ensureAISituations`/
   `aiSetWeeklyReaction` → `setOverlay`. state.js 297's trailing
   `synthesizeLeaguePlans` becomes a no-op guard, kept one release.
3. Batch C (dials): `wireDefaultsListeners`/`wireSituationListeners` write
   through `setOverlay` (or a thin `setPlanField(school, k, v)` that routes by
   PLAN_FIELD_SIDE — book fields update the book, overlay fields the overlay).
   This is where gameplan→book inversion actually flips.
4. Batch D (stragglers): quick-plan slots (2906), `applyIdentityToSchool`
   (world.js 926), season.js 2514 coach-move carry, fieldassign.js 248.
5. `playbook_root_probe` gains a WRITER-EQUIVALENCE section: for each converted
   writer, old-path vs new-path plans deep-equal on a generated world.

Gates per batch: `playbook_root_probe` ×3, `plan_side_probe` ×3,
`book_update_probe`, `save_migration_check` ×3, `plan_cohesion_probe` ×3, clean
build, **`_equiv_walk` byte-identical vs pre-batch build** (this refactor is
DEFINED by that gate, Ref §3). PW smokes owed per batch. Do not start before
D11; land after (or explicitly deferring) D12–D16 so the graph you're collapsing
is the ratified one.
