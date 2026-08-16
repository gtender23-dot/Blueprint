# Full Sim Audit — Charter (run this in a FRESH session tomorrow)

Purpose: now that the coach brain is deep (`Ref/MASTER_INDEX.md` + its source files), run a
**full audit** diffing what the game ACTUALLY does in code against that knowledge — subsystem by
subsystem — AND check where new controls are needed, AND confirm the foundational systems (player
generation, recruiting) still work. This is the project loop finally running at full power.

**Read `Ref/PROJECT_CHARTER.md` first** — it has the non-negotiables, the loop, and the
subsystem→code-anchor map. This charter EXTENDS it for a full audit; it does not replace it.

---

## The prime directive (unchanged, non-negotiable)

**Blogs generate HYPOTHESES. Probes decide TRUTH. `stat_realism_harness` is the veto.**
This audit produces FINDINGS DOCS, not code changes. No sim code is edited during the audit.
Owner picks fixes afterward, and each fix ships only when a probe proves it AND stat_realism holds.

## Hard boundaries (re-confirmed for this audit)

- Edit nothing during the audit — it is READ + DIFF + WRITE-FINDINGS only.
- **Never touch Buy-In / Coaching-Points systems** (academics, grades, measures, practicepool,
  coachPts, buyIn). If a source or a "add a control" idea assumes one, STOP and flag it. This
  applies to the player/recruiting checks too — do not reintroduce cut systems.
- Edit `js/`/`style.css` only (when fixes eventually happen), baseline idiom, exact-string.
- Fetch specific URLs one at a time; no crawling/PDFs.

---

## STEP 0 — Read the code first (the whole point; do this before any brain diffing)

The audit is worthless without a real read of the current code. Before opening the coach brain,
read and write a plain-English baseline of what the sim does now. Anchors (from PROJECT_CHARTER
roadmap — verify line numbers, they may have drifted):

- **Pass rush & protection:** `sim.js` resolvePassRush / protectionFactor / pressureCallRate;
  `rushgeo.js` resolvePocket; `contests.js` contestGap.
- **Coverage:** `sepgeo.js`; `sim.js` assignCoverage / qbRead / catchResolution; man/zone/press/shell dials.
- **Run game:** `run2geo.js`, `rushgeo.js`, `sim.js` resolveRunPlay.
- **YAC:** `yacgeo.js`, broken-tackle logic.
- **Situational:** `situations.js`, 4th-down/clock/tempo in `sim.js`.
- **Special teams:** kicking/return/coverage in `sim.js` + `season.js`.
- **QB play:** qbRead, scramble.
- **Player generation & recruiting:** find the modules that generate players and run recruiting
  (search for generate/roster/recruit/rating/attribute). Read how a player's attributes are created
  and what the ratings vocabulary is.
- **The probe suite** (`tools/`) and **`stat_realism_harness`** — know what each probe measures and
  what bands the harness enforces BEFORE diffing, so findings can name the right probe.

Deliverable of Step 0: `Ref/AUDIT_00_CODE_BASELINE.md` — what the sim currently does, per area,
in plain terms. Everything else builds on this.

---

## STEP 1 — Per-subsystem code-vs-brain diff (7 findings docs)

For EACH subsystem, run the standard pass (per `SIM_RESEARCH_PROMPT.md`): pull that subsystem's
sources from `MASTER_INDEX.md` (the ⧉ tags + routing table point to them), extract testable claims,
and diff against the code baseline. Sort each claim: ALREADY MODELED (correct) / MODELED BUT WRONG
/ DEAD or MISSING. Name the probe that would validate each. Flag stat_realism band risk.

Write one `Ref/<SUBSYSTEM>_ASSESSMENT.md` per subsystem, in the `BLITZ_MODEL_ASSESSMENT.md` shape.
Suggested order (deepest-sourced first, so the strongest diffs come early):
1. Pass rush & protection (deepest brain: B1-5,13,14,18-22,27-30, backlog ★, Saban/Kirby fronts)
2. Coverage & route duel (Saban Coverages ★★, Kirby, TD shells+beaters+concepts, B-coverage)
3. Run game & run fits (Radar, Run Blitz, TD run plays, Sports Treatise fronts)
4. QB play & RPO (RPO framework B45, routes, TD QB guide)
5. Situational & game mgmt (clock/4th-down/kneel/2-min — now sourced; §9)
6. YAC / ball carrier (THIN — expect "sources needed" as a finding)
7. Special teams (THIN — KO returns only; expect "sources needed")

## STEP 2 — "Where to add controls" lens (cross-cutting)

Separate from "is X modeled right," ask: **what does the coaching knowledge imply the sim should
let the user/AI CONTROL that it currently can't?** For each subsystem's brain material, list
concepts the sim has NO knob for at all (e.g. pattern-match coverage checks, protection slide
direction, sim/creeper pressure, formation-checked blitz, 4th-down aggressiveness, tempo). For each:
- Is it a missing DIAL on an existing system (cheap) or a missing SYSTEM (big, architectural)?
- Does adding it risk a stat_realism band? Does it assume a cut Buy-In concept? (If yes → STOP/flag.)
Deliverable: `Ref/AUDIT_CONTROLS_GAPS.md` — a prioritized "controls we don't have" list,
smallest-change-highest-impact first. This is a proposal list; owner decides what's in scope.

## STEP 3 — Foundational integrity check (does the base still work?)

Before ANY of the above changes get contemplated, confirm the foundation is sound now, and define
what must NOT regress. Three parts:

**3a. Player generation integrity** — Read the generation code. Does it produce players with sane
attribute distributions per position? Run whatever probe/harness exists for it (or note that none
does — that itself is a finding). Compare generated player traits against the §13 position guides:
do QBs get QB traits, edge rushers get rush traits, etc., in believable ranges? Record a BEFORE
baseline so any later change can be checked against it.

**3b. Recruiting integrity** — Read the recruiting code. Does it run end-to-end (classes, ratings,
commits/signings) without error? Does it depend on anything the contemplated changes would touch?
Record what recruiting reads from the player/ratings model so we know the blast radius of any
ratings change. Confirm it does NOT depend on cut Buy-In/Coaching-Points systems.

**3c. Ratings ↔ new-concept fit** — The pivotal question for "adding controls." Can the sim's
CURRENT ratings vocabulary even express the new concepts the brain implies? E.g.: is there an
attribute that governs a center's protection ID, a DB's pattern-match discipline, a rusher's
counter/win rate, a QB's pre-snap read? For each major new concept the audit surfaces, mark:
EXPRESSIBLE with existing ratings / NEEDS A NEW RATING / NEEDS A NEW SYSTEM. A new rating means
player generation AND recruiting must learn about it — so this section links directly to 3a/3b.
Deliverable: `Ref/AUDIT_FOUNDATION.md` covering 3a/3b/3c, with explicit before-baselines and a
"blast radius" note for any ratings change.

## STEP 4 — Synthesis

`Ref/AUDIT_SUMMARY.md` — the top of the stack:
- The biggest, highest-confidence gaps across all subsystems (probe-grounded).
- The "add a control" shortlist (from Step 2), tagged expressible / needs-rating / needs-system.
- Foundational status: player-gen OK?, recruiting OK?, ratings expressive enough? — with the
  regression baselines any future change must hold.
- A recommended ORDER of fix-passes for the owner to approve — smallest-change-highest-impact,
  and explicitly flagging anything that would ripple into player generation or recruiting (those
  go last / need the most care).
- Where the brain is THIN and needs more sources before its pass (YAC, special teams, 2-pt chart).

STOP at findings. Owner picks the fix-passes. Then the normal loop runs each fix with probe +
stat_realism proof.

---

## What tonight's prep leaves ready for you
- `Ref/MASTER_INDEX.md` — the coach brain (131 summarized sources + position guides + metrics).
- `Ref/SOURCE_LIBRARY.md` — blitzology provenance (48 full entries).
- `Ref/BLITZOLOGY_BACKLOG.md` — ~85 more blitzology links, fetch-on-demand, ★-flagged.
- `Ref/THROWDEEP_GLOSSARY_INDEX.md` — the Throw Deep link index.
- `Ref/PROJECT_CHARTER.md` — the loop + code anchors + guardrails.
- This file — the audit plan.

## Kickoff line for tomorrow's session
"Run the full sim audit per `Ref/AUDIT_CHARTER.md`. Start with Step 0 — read the code and write
the baseline — before touching the coach brain. Show me the baseline and your proposed subsystem
order before you start diffing."
