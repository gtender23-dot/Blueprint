# Kickoff prompt — start the Sim-Realism Research project in a fresh session

Paste this whole block as your first message in a NEW Claude (Cowork) session
with the folder `C:\Users\Thoms\OneDrive\Documents\Blueprint-pre-W1` connected.
It bootstraps the project from scratch — no prior-session context needed.

---

I want to run a standing project to make my football sim truer to how the game
is actually coached, using real coaching blogs/sources — but decided by my probe
suite, never by guesswork. The connected folder
`C:\Users\Thoms\OneDrive\Documents\Blueprint-pre-W1` is the game: split ES
modules under `js/`, built with `node tools/build.mjs`, tested by ~100 probes in
`tools/`.

Start by reading these, in order, and then give me your understanding of the
setup and how you'll run the project:

1. `CLAUDE.md` and `AGENTS.md` — the build, the rules, the source-of-truth
   (`js/` + `style.css`, never a built file), and the verification discipline.
2. `Ref/SIM_RESEARCH_PROJECT.md` — the project itself: the subsystem roadmap,
   the code + probe anchors each maps to, the loop, and the guardrails.
3. `Ref/SIM_RESEARCH_PROMPT.md` — the reusable per-subsystem pass prompt.
4. `Ref/BLITZ_MODEL_ASSESSMENT.md` — a WORKED EXAMPLE of one completed pass
   (the shape every findings doc should take) and the fixes it produced.

Non-negotiables you must internalize before touching anything:
- **Probes decide truth, blogs only generate hypotheses.** A fix ships only when
  a probe proves the new behavior AND `stat_realism_harness` proves it didn't
  push sacks/comp%/ypa/rush/INT%/turnovers out of band. `stat_realism` is the veto.
- Edit `js/`/`style.css` only, in the baseline's bundler-lowered idiom
  (`var x = {...}; export { x }`, double quotes, `clamp2`). Never hand-edit a
  built file. Exact-string edits.
- **Never touch Buy-In / Coaching-Points systems** (academics, grades, measures,
  practicepool, coachPts, buyIn, program buy-in). They were deliberately cut from
  this baseline. If a source or donor assumes one, STOP and ask.
- You fetch specific URLs one at a time — no crawling, no PDFs/paywalled content.
- Environment note: run builds/pushes from a plain local copy, not straight out
  of OneDrive (sync can revert a file mid-write).

Once you've read those and confirmed you understand the loop, propose which
subsystem to tackle first and wait for me to confirm before doing a pass. My
current pick is **Pass rush & protection** (the blitz LAYER is already done per
the assessment doc — extend it to the four-man rush, the pocket, stunts, and
protection schemes). For sources I'll seed some links and you'll web-search and
propose more for my approval.

---

(Everything above is self-contained; the four docs it names live in the repo.)
