# Sim-Realism Research — Project Charter (start here)

**This is the front door.** If you're starting a fresh session (or a project), read
THIS first, then the two docs it points at. It exists so a new session inherits the
loop, the rules, and the sources without re-explaining them.

The substance lives in two files already in `Ref/` — this charter does not repeat them:

- **`Ref/SIM_RESEARCH_PROJECT.md`** — the home base: the loop (7 steps), the guardrails,
  and the subsystem roadmap with exact code anchors + probe names for each. **This is the
  authority.** If this charter and that doc ever disagree, that doc wins.
- **`Ref/SIM_RESEARCH_PROMPT.md`** — the reusable per-pass prompt. Paste it, fill in the
  subsystem, and run one pass.

And the worked example that defines the output shape:

- **`Ref/BLITZ_MODEL_ASSESSMENT.md`** — one completed pass. Every findings doc copies its
  shape (see "Findings-doc shape" below).

---

## The one rule (do not lose this)

**Coaching blogs generate HYPOTHESES. The probes decide TRUTH.
`stat_realism_harness` is the veto.**

A source claim is only "real and missing" when a probe shows the sim doesn't model it.
A fix only ships when a probe proves the new behavior AND `stat_realism` proves it did
not push sacks / comp% / ypa / rush / INT% / turnovers out of band. No exceptions, no
"but the blog is clearly right."

## Hard boundaries (from the kickoff — internalize before touching anything)

- Edit `js/` + `style.css` only, in the baseline's bundler-lowered idiom
  (`var x = {...}; export { x }`, double quotes, `clamp2`). **Never hand-edit a built file.**
  Exact-string edits.
- **Never touch Buy-In / Coaching-Points systems** (academics, grades, measures,
  practicepool, coachPts, buyIn, program buy-in) — deliberately cut from this baseline.
  If a source assumes one, **STOP and ask.**
- If a blog assumes a concept the sim does not have, **STOP and flag it** — don't invent
  a substitute.
- Fetch specific URLs one at a time. No crawling, no PDFs/paywalled content.
- Build/push from a plain local copy, not straight out of OneDrive (sync can revert a
  file mid-write).

---

## The sources — where they live and how they were gathered

**`Ref/SOURCE_LIBRARY.md`** is the catalog: 45 distinct coaching articles (all from
blitzology.com so far), deduped and tagged by topic, each with a one-line concept summary.
It is the raw material — **not** slotted into a single subsystem. The routing below maps
its topic clusters onto the subsystem roadmap.

Note on fetching: blitzology label pages (`/search/label/...`) are blocked for the WebFetch
tool by robots.txt; they were read via the browser (Claude-in-Chrome). Direct article URLs
(`/YYYY/MM/slug.html`) fetch fine. Many label pages only surfaced their *newest* post — the
broad ones (`Pass Protection`, `Blitz Technique`, `4-3 Defense`, `RPO`, `Fire Zone`) still
have back-catalog worth paging through when a pass needs more depth.

## Source → subsystem routing (which library entries feed which pass)

Numbers are `SOURCE_LIBRARY.md` entry IDs. A source can feed more than one pass.

| Roadmap subsystem | Best library sources | Notes |
|---|---|---|
| **1. Pass rush & protection** (FIRST) | #1–5, #13, #14, #18–22, #27, #28, #29, #30 | Richest cluster. Top tier: #13, #14, #18, #19, #27, #28, #29 — protection rules + how a rush/sim/bluff manipulates the RB read and the OL's set. |
| **2. Coverage & the route duel** | #6, #9, #17, #20, #23, #31, #32, #33, #34, **#46** (+ offense-side #10, #11, #24) | #33 (trips adj) and #34 (DB Manual, Cover 1) are rep-level rule sets. #46 (Throw Deep routes guide) is the receiver/route-tree side — feeds sepgeo/catchResolution; also secondary to #7. |
| **3. Run game & run fits** | #7, #8, #15, #16, #22, #35, #36, #37, #38, #39 | #35 (Radar) and #36 (Run Blitz) are full fit rule systems. |
| **4. YAC & ball carrier** | (thin) #36, #43 touch broken-tackle/leverage | Weakest coverage in the library — seed more sources when this pass comes up. |
| **5. Situational & game management** | #25 (opening script), #12, #26, **#47** | #25 is play-calling/tendency logic. #47 (take-a-knee) is victory-formation clock logic but CONCEPTUAL ONLY — the actual kneel math is in a download it doesn't expose; seed a numeric source if the math matters. |
| **6. Special teams** | #44 (Bengals KO return) | Only ST source so far — seed more before the pass. |
| **7. QB play & decision-making** | #10, #11, #45 (RPO conflict), #24, #46 (secondary — route reads) | #45 is the definitive run/pass-conflict taxonomy — but check the sim even models RPO before leaning on it (possible STOP). |

---

## Running one pass (the checklist)

Follow `SIM_RESEARCH_PROMPT.md` verbatim; this is the quick version.

1. **Read the code first.** Open the subsystem's anchors from the roadmap. Write, in plain
   terms, what the sim does now — BEFORE reading a blog. Share that read.
2. **Sources.** Start from the routing table above. Web-search for more reputable coaching
   sources and propose a short reading list. **Wait for owner approval before fetching
   anything not already in the library.**
3. **Extract claims.** Numbered list. Tag each `testable` / `vague` / `opinion`, sourced.
   Keep only football relationships.
4. **Diff vs code.** For each `testable` claim: ALREADY MODELED (correct) · MODELED BUT
   WRONG · DEAD/MISSING. Name the exact probe that would validate it. Flag any that would
   push a `stat_realism` band out of range.
5. **Write `Ref/<SUBSYSTEM>_ASSESSMENT.md`** in the blitz-doc shape. **STOP — owner picks
   the fixes.** No sim code changes in this step.
6. **On approval, implement each fix:** exact-string edit → a probe that proves the new
   behavior → a `stat_realism` run proving no regression → build → boot → tree_probe →
   device-commit changed files + the findings doc.
7. **Report before/after numbers**, distinguishing "moved on purpose" from "regression."

## Findings-doc shape (copy `BLITZ_MODEL_ASSESSMENT.md`)

1. **Header** — what it was checked against (sources), grounded in which modules, confirmed
   with which probe (state N).
2. **What the game gets RIGHT** — bullet list.
3. **What the game UNDER-MODELS / gets WRONG** — the real gaps, each with probe-grounded
   evidence (actual before-numbers, dead fields named, etc.), ordered biggest-gap-first.
4. **Recommended fixes (priority order)** — smallest-change-highest-impact first; note the
   stat-realism risk of each.
5. **(after fixes) UPDATE section** — what was implemented, the probe results proving each
   behavior, and the full verification chain (probe → stat_realism → tree_probe → boot).

---

## Status

- **2026-08:** Pass-rush BLITZ layer done (`BLITZ_MODEL_ASSESSMENT.md`). Source library
  built to 45 articles (`SOURCE_LIBRARY.md`). **Next pass: Pass rush & protection** — the
  four-man rush, the pocket, stunts/games, and protection schemes (the blitz layer is
  already done; this is the rest).
