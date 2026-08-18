## D10 · PLAYBOOK↔DIALS COHESION AUDIT (report-first; mechanical fixes only)

Read CLAUDE.md, then Ref/STATUS.md (top dated section + BUILD ORDER v2), then
Ref/PLAYBOOK_ROOT_ARCHITECTURE.md (the target model — §2, §3, §4b and the Stage-1
addendum are this audit's spine), then Ref/DEFENSIVE_PLAYBOOK_V2.md,
Ref/AUDIT_CONTROLS_GAPS.md, Ref/GAMEPLAN_TERMINOLOGY_AUDIT.md,
Ref/GAMEPLAN_PORT_SCOPING.md. Then obey all of them.

This session is an AUDIT. Its deliverable is a report. It is scoped to run to
completion without a single design call — where a decision is needed, list it under
OPEN DECISIONS and keep going. Do not stop to ask.

### The owner's question, verbatim

*"The playbooks aren't meshing yet. Find wherever there is conflict with the old
systems and dials and controls. The playbooks may also eliminate the need for
controls we used to have. I want maximum cohesion with the playbooks and gameplan
controls."*

Three questions the report answers, per control:

1. **CONFLICT** — where do the book (`TeamBook`/`TeamDefBook`, sheets, formations,
   `defbook.calls`, cards) and the old flat-gameplan dials disagree, double-write,
   fight for precedence, or set the same quantity by two routes?
2. **REDUNDANCY** — which old dials does the book make unnecessary, either because
   the book expresses the same thing better or because a card sets it by implication?
3. **COHESION** — for every surviving control: BOOK-owned, WEEK-owned (the
   controller/overlay), or TEAM-level? D8 item 4 asks for exactly this map and defers
   it to owner sign-off. **This audit produces the evidence for that map.**

### Standing laws (they bind here)

- Edit `js/` + `style.css` only, never a built file. **No sim/outcome math changes
  in this session — none, at all.**
- Node gates in-session; new probes registered in the CORE manifest.
- Browser verification is OWED — ledger it.
- Update `Ref/STATUS.md` (dated section at top). Every owner-owed item under one
  **OWNER CHECKLIST** heading.
- Commit scoped to your own files via the `_to_delete` lock workaround if possible.
  **NEVER push.**
- DPB2's hard requirement binds every recommendation: *"take NO control away from the
  player… Progressive disclosure, never removal."* Redundancy is an argument about
  where a control LIVES and how it is DISCLOSED — never for silently deleting a
  player-facing capability. Say so explicitly whenever you recommend a retirement.

### PART A — GROUND TRUTH (mechanical, no judgment)

Do this first, exhaustively; every later claim cites it.

1. **THE FIELD CENSUS.** Enumerate EVERY field on `school.gameplan` and every field
   any consumer reads off the effective plan. Walk at minimum:
   `js/ui/views/gameplan.js`, `getEffectivePlan` in `js/engine/situations.js`,
   `js/engine/teamplan.js`, `js/engine/playbook.js`, `js/engine/defbook.js`,
   `js/engine/defaultbooks.js`, `js/engine/ai.js` (`setAIGameplan`),
   `js/engine/sim.js` (every flat-field read), `js/ui/app.js`
   (`PLAN_OFF_FIELDS`/`PLAN_DEF_FIELDS`), `js/ui/views/creatorplaybook.js`,
   `js/ui/views/creatordef.js`. Per field, one row:
   - identifier (verbatim)
   - side off/def/team — and by WHICH authority (`PLAN_FIELD_SIDE` if it exists yet,
     else every hand-maintained list claiming it, noting disagreements)
   - every WRITER (file:line): UI, preset, wizard, `pb:` load,
     `applyPlaybookToGameplan`, `applyDefBookToGameplan`, `setAIGameplan`, situation
     cells, `CALL_FIELDS`, `CHK_FIELDS`, book compile
   - every READER (file:line)
   - whether the BOOK also expresses this quantity, and how
   - user-facing label(s) and the raw enum(s) stored
2. **THE WRITER GRAPH.** §3 says five writers must collapse to two verbs
   (`assignBook`, `setOverlay`). Report the CURRENT count and every writer still
   bypassing the compile seam.
3. **THE OVERLAY PRECEDENCE CHAIN.** At least four keyed overlays now sit over one
   plan — situations (down/distance/zone), `CHK_FIELDS` (offensive formation class),
   `CALL_FIELDS` (situation × personnel), DPB2 shelves/answers — plus the live
   headset `forcedCall`. Establish the ACTUAL resolution order by reading code, not
   prose (prior docs record it ONLY in prose: *"your live headset call still beats
   the sheet"*). Write the real order as a table, and flag every place two overlays
   can both fire on one snap with the winner undefined or order-dependent.

### PART B — THE FOUR COLLISION CLASSES (the findings)

Ranked by expected sharpness. Each finding gives: **what collides · file:line on BOTH
sides · what the player experiences · disposition (BOOK/WEEK/TEAM/RETIRE/MERGE) ·
confidence · mechanical or design call.**

1. **COVERAGE FAMILY vs THE SHELL/STYLE/CUSHION TRIO — the sharpest.** `covFamily` +
   `COV_FAMILY_IMPLIES` (defbook card) sets by implication what `covShell`,
   `covStyle`, `pressLevel` set by hand. `AUDIT_CONTROLS_GAPS.md` explicitly REJECTED
   a coverage call sheet as a dial because it *"overlaps three existing dials (shell,
   style, cushion)"* — then it arrived anyway as a card. Determine empirically: when
   a named coverage card is called, what happens to the three standing dials —
   overridden, blended, ignored, or fighting? Is the result order-dependent? Trace
   `applyDefCall` into the sim and **prove the answer with a probe, not a read.**
2. **DPB2's 1:1 CLAIM — TEST IT.** `DEFENSIVE_PLAYBOOK_V2.md` asserts *"every element
   maps 1:1 to fields the sim already consumes… No new sim path; the card is a
   picture of data the engine already speaks."* If that holds, the defensive book is
   a pure view and nothing is redundant. **Verify or refute element by element.** Two
   known smells: `Box` carries `±8` in `CHK_FIELDS` but `±10` in `CALL_FIELDS` for
   the same quantity; `covFamily` implies three dials at once. Refuting this claim
   anywhere is a headline finding.
3. **DEAD, LEGACY, AND MIGRATION-ONLY CARRIERS.** Confirm live status with file:line
   for each: `blitzPct` (superseded by the identity system, `aggrStopFromBlitzPct()`
   is a migration shim — is anything still WRITING it?), `clockMgmt` (deleted on
   normalize — verify it stays dead, do NOT resurrect), `gp.pressIdentity` (the dead
   field that silently ate every custom pressure look — verify no writer remains),
   `renderSchemeProfile` / the SCHEME PROFILE card (two docs recommend deletion),
   `roomPoints`/`C.COACH_PT_DIALS` (Buy-In-coupled, scoped out — verify inert), the
   `normalizeFormations` legacy-name map (§5b says PURGE while re-rooting, not
   alias). **Then hunt NEW ones**: any field written and read by nobody, or read from
   a name nothing writes. That bug class has shipped silently twice here. Grep BOTH
   directions and report every hit.
4. **NAMING-DIALECT SPLITS.** One concept, up to four names: state key → UI label →
   `CALL_FIELDS`/`CHK_FIELDS` label → card annotation. Known:
   `runCommit`/`Box`/`Box Commit`/`+15 IN THE BOX`; `defBaseFront` vs `defFront`;
   `covShell` vs `Single-High`/`1-High`. Produce the **CANONICAL NAME TABLE** — one
   row per concept, every alias, and the one name §5b says should win. This feeds the
   `PLAN_FIELD_SIDE` manifest, so make it complete and machine-usable.

### PART C — SAFE MECHANICAL FIXES (owner-authorized, narrow)

Owner authorized fixing what needs no input. Bar: **provably inert, or provably a
typo-class bug, with a probe or exhaustive grep proving it.** Everything else is
reported, not fixed.

**IN SCOPE**
- Delete truly dead fields — nothing reads them, proven by exhaustive grep across
  `js/` AND `tools/`. Show the grep in the report.
- Fix a writer targeting a misspelled/nonexistent key where the intended target is
  unambiguous (the `pressIdentity`/`pressureIdentity` class). This is a real behavior
  fix — call it out loudly in STATUS with before/after evidence.
- Add the `PLAN_FIELD_SIDE` manifest as PURE DATA + the `plan_side_probe` if they
  don't exist yet (Stage-1 addendum specifies both). Manifest + a probe that READS it
  changes no behavior. **Do not rewire any consumer to it this session.** If the
  probe fails on existing fields, that is a FINDING — report it; do NOT "fix" the
  fields to make it green.
- Comment-only clarifications where ownership is genuinely ambiguous.

**OUT OF SCOPE — REPORT ONLY, DO NOT TOUCH**
- Anything changing a sim outcome, a band, or a distribution.
- Moving any dial between book and controller (that's D8 item 4, owner-signed).
- Retiring any player-facing control (progressive disclosure, never removal).
- Renaming a user-facing label (terminology pass; `help_rule_probe` gates it).
- Unifying a naming dialect at the consumer level (that's a re-rooting change).
- Resolving any overlay precedence ambiguity by picking a winner. Report it.

**If you are unsure whether a fix is in scope: it is not.** Report it instead. A
report entry costs the owner thirty seconds; a wrong unattended edit to the plan
layer costs a debugging session.

### PART D — DELIVERABLES

1. **`Ref/COHESION_AUDIT_2026-08-18.md`**
   - **OPEN DECISIONS first**, clean for a phone read (D5 convention): the question,
     the options, your recommendation, the cost of getting it wrong.
   - Three-question verdict per control: conflict / redundancy / ownership.
   - **THE DISPOSITION TABLE** (centerpiece) — every field, one row: `field · side ·
     current owner · recommended owner (BOOK/WEEK/TEAM/RETIRE/MERGE) · conflict? ·
     evidence file:line · mechanical or design call`. This table IS the D8-item-4
     map, evidenced.
   - The four collision classes, ranked by severity.
   - The canonical name table.
   - Writers-without-readers and readers-without-writers.
   - What you fixed under Part C, with proof.
   - What you deliberately did not touch, and why.
2. **`Ref/COHESION_DISPATCH_2026-08-18.md`** — remediation as ready-to-paste D-blocks
   (D11, D12, …) in the exact format of `Ref/DISPATCH_PLAN_2026-08-17.md`:
   self-contained, says what to read first, dependency table at top, gates named per
   block. Sequence so nothing outcome-bearing runs before the owner ratifies the
   disposition table. Note which blocks are parallel-safe with D1–D9.
3. **`Ref/STATUS.md`** — dated section at top: what this audit covered, what shipped
   under Part C, gates run, browser-owed ledger, **OWNER CHECKLIST**.

### GATES

Clean esbuild bundle + CSS parse. `plan_side_probe` ×3 (new or existing). Re-run
`playbook_root_probe`, `defbook_probe`, `tendency_probe`, `playcall_probe`,
`play_fidelity_probe`, `save_migration_check`, `integration_creator_probe`.
**Part C touches no outcome math, so `_equiv_walk` must come back byte-identical
against a pre-session build — run it and report the result. If it is NOT identical
you changed behavior you did not intend to: revert that change and report it as a
finding.** Ledger anything unrunnable here as OWED-LOCAL.

### THE STANDARD

Depth over breadth-with-hedging. One finding with file:line on both sides of the
collision and a probe behind it beats ten "may conflict" bullets. Where you cannot
prove something, say so plainly and put it in OPEN DECISIONS — do not soften it into
a claim. The owner reads this on a phone: OPEN DECISIONS and the disposition table
must stand alone without the body.
