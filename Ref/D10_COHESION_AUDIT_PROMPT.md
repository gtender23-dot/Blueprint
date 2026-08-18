Read `C:\dev\Blueprint\CLAUDE.md` first. The Blueprint repo is connected to this
session as a folder on the device "thomson" at `C:\dev\Blueprint`. Use
device_list_dir / device_stage_files / device_commit_files (or device_bash, which
mounts the folder under $HOME/mnt/Blueprint) to read and write it. Deliverables must
be written back to the user's disk under `C:\dev\Blueprint\Ref\`, and also sent via
SendUserFile so they are readable on a phone.

The owner is at work and will not answer questions. Make no design calls; where a
decision is needed, put it in the OPEN DECISIONS list and continue. Work to
completion.

---

# D10 · PLAYBOOK↔DIALS COHESION AUDIT (report-first; mechanical fixes only)

Read `CLAUDE.md`, then `Ref/STATUS.md` (top dated section, and BUILD ORDER v2),
then `Ref/PLAYBOOK_ROOT_ARCHITECTURE.md` (the target model — §2, §3, §4b and the
Stage-1 addendum are the spine of this audit), then `Ref/DEFENSIVE_PLAYBOOK_V2.md`,
then `Ref/AUDIT_CONTROLS_GAPS.md`, `Ref/GAMEPLAN_TERMINOLOGY_AUDIT.md`,
`Ref/GAMEPLAN_PORT_SCOPING.md`. Then obey all of them.

This session is an AUDIT. Its deliverable is a report. It is scoped so it can run
unattended to completion without a single design call.

## The owner's question, stated exactly

*"The playbooks aren't meshing yet. Find wherever there is conflict with the old
systems and dials and controls. The playbooks may also eliminate the need for
controls we used to have. I want maximum cohesion with the playbooks and gameplan
controls."*

Restated as the three questions the report must answer, per control:

1. **CONFLICT** — where do the book (`TeamBook`/`TeamDefBook`, sheets, formations,
   `defbook.calls`, cards) and the old flat-gameplan dials disagree, double-write,
   fight for precedence, or set the same quantity by two different routes?
2. **REDUNDANCY** — which old dials does the book now make unnecessary, either
   because the book expresses the same thing better, or because a card sets it by
   implication?
3. **COHESION** — for every control that survives, is it BOOK-owned, WEEK-owned
   (the controller/overlay), or TEAM-level? D8 item 4 asks for exactly this map and
   defers it to owner sign-off. **This audit produces the evidence for that map.**

## Standing laws (unchanged, they bind here)

- Edit `js/` + `style.css` only, never a built file. No sim/outcome math changes
  in this session — none, at all.
- Node gates in-session; new probes registered in the CORE manifest.
- Browser verification is OWED — ledger it.
- Update `Ref/STATUS.md` (dated section at top). Put every owner-owed item under one
  **OWNER CHECKLIST** heading.
- Commit scoped to your own files via the `_to_delete` lock workaround if possible.
  **NEVER push.**
- The DPB2 hard requirement binds every recommendation you write: *"take NO control
  away from the player… Progressive disclosure, never removal."* A control being
  redundant is an argument for where it LIVES and how it is DISCLOSED — never an
  argument for silently deleting a player-facing capability. Say so explicitly when
  you recommend a retirement.

## PART A — BUILD THE GROUND TRUTH (mechanical, no judgment)

Do this first and do it exhaustively; every later claim cites it.

1. **THE FIELD CENSUS.** Enumerate EVERY field on `school.gameplan` and every field
   any consumer reads off the effective plan. Walk, at minimum: `js/ui/views/gameplan.js`,
   `getEffectivePlan` in `js/engine/situations.js`, `js/engine/teamplan.js`,
   `js/engine/playbook.js`, `js/engine/defbook.js`, `js/engine/defaultbooks.js`,
   `js/engine/ai.js` (`setAIGameplan`), `js/engine/sim.js` (every flat-field read),
   `js/ui/app.js` (`PLAN_OFF_FIELDS` / `PLAN_DEF_FIELDS`), `js/ui/views/creatorplaybook.js`,
   `js/ui/views/creatordef.js`. For each field record, as a table row:
   - field identifier (verbatim)
   - side: off / def / team — and by WHICH authority (`PLAN_FIELD_SIDE` manifest if it
     exists yet, else each hand-maintained list that claims it, noting disagreements)
   - every WRITER (file:line) — UI, preset, wizard, `pb:` load, `applyPlaybookToGameplan`,
     `applyDefBookToGameplan`, `setAIGameplan`, situation cells, `CALL_FIELDS`,
     `CHK_FIELDS`, book compile
   - every READER (file:line)
   - whether the BOOK also expresses this quantity, and how
   - user-facing label(s), and the raw enum(s) stored
2. **THE WRITER GRAPH.** §3 of the root architecture says five writers must collapse
   to two verbs (`assignBook`, `setOverlay`). Report the CURRENT count and list every
   writer still bypassing the compile seam.
3. **THE OVERLAY PRECEDENCE CHAIN.** There are now at least four keyed overlay systems
   over one plan — situations (down/distance/zone), `CHK_FIELDS` (offensive formation
   class), `CALL_FIELDS` (situation × personnel), DPB2 shelves/answers — plus the live
   headset `forcedCall`. Establish the ACTUAL resolution order by reading the code, not
   the prose. Prior docs record the precedence rule ONLY in prose ("your live headset
   call still beats the sheet"). Write the real order down as a table, and flag every
   place two overlays can both fire on one snap with the winner undefined or
   order-dependent.

## PART B — THE FOUR COLLISION CLASSES (the findings)

Work these in order; they are ranked by expected sharpness. For each finding give:
**what collides · file:line evidence on both sides · what the player experiences ·
disposition (BOOK / WEEK / TEAM / RETIRE / MERGE) · confidence · whether fixing it is
mechanical or a design call.**

1. **COVERAGE FAMILY vs THE SHELL/STYLE/CUSHION TRIO — the sharpest one.**
   `covFamily` + `COV_FAMILY_IMPLIES` (defbook card) sets by implication what
   `covShell`, `covStyle`, `pressLevel` set by hand. `AUDIT_CONTROLS_GAPS.md` explicitly
   REJECTED a coverage call sheet as a dial because it "overlaps three existing dials
   (shell, style, cushion)" — and then it arrived anyway as a card. Determine
   empirically: when a named coverage card is called, what happens to the three standing
   dials? Are they overridden, blended, ignored, or do they fight? Is the result
   order-dependent? Trace it through `applyDefCall` into the sim and prove the answer
   with a probe, not a read.
2. **DPB2's 1:1 CLAIM — TEST IT.** `DEFENSIVE_PLAYBOOK_V2.md` asserts "every element
   maps 1:1 to fields the sim already consumes… No new sim path; the card is a picture
   of data the engine already speaks." **If that holds, the defensive book is a pure
   view and nothing is redundant. Verify or refute it element by element** — every card
   element vs the field it claims to map to. Two known smells to chase: `Box` carries
   `±8` in `CHK_FIELDS` but `±10` in `CALL_FIELDS` for the same quantity, and `covFamily`
   implies three dials at once. Refuting this claim anywhere is a headline finding.
3. **DEAD, LEGACY, AND MIGRATION-ONLY CARRIERS.** Confirm status in live code for each,
   with file:line: `blitzPct` (superseded by the identity system; `aggrStopFromBlitzPct()`
   is a migration shim — is anything still WRITING it?), `clockMgmt` (deleted on
   normalize — verify it stays dead; do NOT resurrect), `gp.pressIdentity` (the dead
   field that silently ate every custom pressure look — verify no writer remains),
   `renderSchemeProfile` / the SCHEME PROFILE card (recommended for deletion by two
   separate docs), `roomPoints` / `C.COACH_PT_DIALS` (Buy-In-coupled — scoped out, verify
   it is inert here), and the `normalizeFormations` legacy-name map (§5b says PURGE while
   re-rooting, not alias). **Then hunt for NEW ones**: any field written by some writer and
   read by nobody, or read from a name nothing writes. That class of bug has shipped
   silently twice in this project. Grep both directions — writers without readers AND
   readers without writers — and report every hit.
4. **NAMING-DIALECT SPLITS.** One concept, up to four names: state key → UI label →
   `CALL_FIELDS`/`CHK_FIELDS` label → card annotation. Known: `runCommit`/`Box`/`Box
   Commit`/`+15 IN THE BOX`; `defBaseFront` vs `defFront`; `covShell` vs
   `Single-High`/`1-High`. Produce the CANONICAL NAME TABLE — one row per concept, every
   alias, and the one name §5b says should win. This table is the input to the
   `PLAN_FIELD_SIDE` manifest, so make it complete and machine-usable.

## PART C — SAFE MECHANICAL FIXES (owner-authorized, narrow)

The owner authorized fixing what needs no input. The bar is: **provably inert, or
provably a typo-class bug, with a probe or an exhaustive grep proving it.** Everything
else is reported, not fixed.

**IN SCOPE:**
- Delete truly dead fields — nothing reads them, proven by exhaustive grep across `js/`
  AND `tools/`. Show the grep in the report.
- Fix a writer targeting a misspelled/nonexistent key where the intended target is
  unambiguous (the `pressIdentity`/`pressureIdentity` bug class). This is a real
  behavior fix; call it out loudly in STATUS with before/after evidence.
- Add the `PLAN_FIELD_SIDE` manifest as PURE DATA plus the `plan_side_probe` if they do
  not exist yet — the root architecture's Stage-1 addendum specifies both. Adding the
  manifest and a probe that READS it changes no behavior. **Do not rewire any consumer
  to it in this session.** If the probe fails on existing fields, that is a FINDING —
  report it, do not "fix" the fields to make the probe green.
- Comment-only clarifications where a field's ownership is genuinely ambiguous.

**OUT OF SCOPE — REPORT ONLY, DO NOT TOUCH:**
- Anything that changes a sim outcome, a band, or a distribution.
- Moving any dial between book and controller (that is D8 item 4, and it is owner-signed).
- Retiring any player-facing control (DPB2: progressive disclosure, never removal).
- Renaming a user-facing label (that is the terminology pass, and `help_rule_probe` gates it).
- Unifying a naming dialect at the consumer level (that is a re-rooting change).
- Resolving any overlay precedence ambiguity by picking a winner. Report it; the owner picks.

If you are unsure whether a fix is in scope: **it is not.** Report it instead. A
report entry costs the owner thirty seconds; a wrong unattended edit to the plan
layer costs a debugging session.

## PART D — DELIVERABLES

1. **`Ref/COHESION_AUDIT_2026-08-18.md`** — the report. Structure:
   - **OPEN DECISIONS** first, cleanly listed for a phone read (the D5 convention).
     Each: the question, the options, your recommendation, the cost of getting it wrong.
   - The three-question verdict per control: conflict / redundancy / ownership.
   - **THE DISPOSITION TABLE** — every field, one row: `field · side · current owner ·
     recommended owner (BOOK/WEEK/TEAM/RETIRE/MERGE) · conflict? · evidence file:line ·
     mechanical or design call`. This table IS the D8-item-4 map, evidenced. Make it the
     centerpiece.
   - The four collision classes, findings ranked by severity.
   - The canonical name table.
   - Writers-without-readers and readers-without-writers.
   - What you fixed under Part C, with proof.
   - What you deliberately did not touch, and why.
2. **`Ref/COHESION_DISPATCH_2026-08-18.md`** — the remediation work as ready-to-paste
   D-blocks (D11, D12, …), in the exact format of `Ref/DISPATCH_PLAN_2026-08-17.md`:
   self-contained, tells the session what to read first, dependency table at the top,
   gates named per block. Sequence them so nothing outcome-bearing runs before the owner
   ratifies the disposition table. Note which blocks are parallel-safe with the existing
   D1–D9.
3. **`Ref/STATUS.md`** — dated section at top: what this audit covered, what shipped
   under Part C, gates run, browser-owed ledger, and the **OWNER CHECKLIST**.

## GATES

Clean esbuild bundle + CSS parse. `plan_side_probe` ×3 (new or existing). Re-run
`playbook_root_probe`, `defbook_probe`, `tendency_probe`, `playcall_probe`,
`play_fidelity_probe`, `save_migration_check`, `integration_creator_probe`.
**Because Part C touches no outcome math, `_equiv_walk` must come back byte-identical
against a pre-session build — run it and report the result. If it is NOT identical,
you changed behavior you did not intend to: revert that change and report it as a
finding.** Ledger anything unrunnable in this environment as OWED-LOCAL.

## THE STANDARD

Depth over breadth-with-hedging. A finding with file:line on both sides of the
collision and a probe behind it is worth more than ten "may conflict" bullets. Where
you cannot prove something, say so plainly and put it in OPEN DECISIONS — do not
soften it into a claim. The owner reads this on a phone at work: the OPEN DECISIONS
list and the disposition table must stand alone without the body.
