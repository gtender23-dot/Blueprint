# Help Voice Spec — the coach behind the manual, tooltips & context links

**Status: APPROVED — build from this. Garrett signed off Jul 29, 2026. (Was DRAFT.)**

**Locked decisions (Garrett, Jul 29 2026):**
1. **Voice** — ship the re-voiced samples *exactly as written*. That register (warm + deep,
   leads plain-English then goes deep, leak-safe ordinal claims) is the target for all 15 chapters.
2. **Coach** — approved: **Coach Earl "Book" Whitaker** + the legend as written.
3. **Per-position breakdowns** — **(b) + the tooltip half of (c)**: a dedicated "The Position Room"
   reference chapter (all 14 positions) *and* each position's one-liner as a tap-tooltip on the
   player card.
4. **Build order** — **spec order** (context links → tooltips → re-voice + Position Room). Rationale:
   context links build the shared "open-manual-at-id" entry point; tooltips reuse it for their
   `→ Chapter` deep-link; the Position Room's card nuggets *are* tooltips once that layer exists; the
   chapter-by-chapter re-voice is the slow, audit-gated long tail and runs last while nothing blocks
   on it.
5. **Still open (not blockers):** the screen↔chapter map (confirm once real screens are enumerated)
   and the tooltip term list (Claude drafts ~20–30, Garrett prunes). See end of file.

## What this is (and what it isn't)

Blueprint already has a good, deep manual (15 chapters under `js/ui/manual/`) that obeys a
strict "hide the numbers" rule, audited by `tools/manual_leak_audit.mjs`. This spec does NOT
rewrite what the manual *teaches* or change its structure — `Ref/MANUAL_SPEC.md` still governs
the chapter shape, the leak rule, the depth bar, and the football-analogy rule, and all of that
stays in force.

This spec changes one thing and adds two:

1. **Re-voice** the manual — every chapter, in one consistent author's voice: a just-retired
   Hall-of-Fame coach passing his knowledge to you.
2. **Tooltips** — short, tap-to-reveal notes in that same voice, a new content layer.
3. **Context links** — the `?` on each screen opens the manual to the *right* chapter; a tooltip
   tap opens the relevant short note. No hover anywhere — tap only (this is a phone game).

Explicitly **out of scope** (Garrett's call): guided first-season, "why did I lose this recruit"
factor breakdowns, an advisor / program-health report card, dynamic nags, smart notifications.
Not building those. The bet is simpler and truer to the game: the fun is figuring out how the
systems combine and playing them your way, so help's only job is to make a newcomer *fluent fast*
without ever handing over the absolutes.

---

## The author

A fixed persona — the same coach in every save (Garrett will layer Heir-start–specific touches on
later; the base voice is world-agnostic and names nobody in the fiction of a given save).

**Name + legend — APPROVED as-is (Garrett, Jul 29 2026):**
> **Coach Earl "Book" Whitaker.** Forty years on the sideline, retired with more wins than anyone
> who ever did it, and a reputation for winning everywhere he went with whatever he had. Players
> called him "Book" because he'd seen every situation twice and had an answer for it. He isn't
> selling you anything. He's handing you the notes.

Why a name + one line helps: it gives the voice a *person* to be — a specific old coach with
opinions — instead of a generic narrator. The manual can nod to him ("I ran this my whole career")
without ever citing a save's world. If you want a different name/era/style, this is the only place
it's set; change it here and the whole voice retunes.

**[RESOLVED — approved as written.]**

---

## The voice — how it changes

`MANUAL_SPEC.md` currently mandates an *impersonal* narrator: present tense, no persona, "do not
reference the developer," describe-don't-sell. Keep everything except the impersonality. The single
rule that flips:

- **OLD:** neutral, authorless description.
- **NEW:** a named veteran coach talking *to you*, the new hire, from experience — first-person
  "I / I'd / when I coached this" where it earns it, still second-person "you / your corner"
  throughout.

Everything else in `MANUAL_SPEC.md` **stays**:

- **Deep and technical.** The coach still explains the real mechanism, in order, including what the
  sim ignores. Folksy-but-empty is a failure. He's a HOF coach — he knows the *why*, not just the
  vibe.
- **The leak rule — unchanged and still audited.** No coefficient, threshold, rate, or constant,
  ever, even in the coach's mouth. He talks in ordinal / directional / shape / conditional claims:
  "speed carries most of a corner's coverage, agility next"; never a number. `manual_leak_audit.mjs`
  must still pass.
- **Football analogies, not engineering ones.** This gets *easier* in the coach voice — it's how he
  naturally talks.
- **Newbie-friendly (NEW emphasis).** `MANUAL_SPEC` says "assume football literacy, not game
  literacy." Hold that, but the coach's job is to bring a genuine newcomer up to speed fast — so he
  leads with the plain-English point, THEN goes deep. First sentence of a section should land for
  someone who's never played; the depth comes right after. Teach the lever and how it interacts with
  the others; never the exact value that turns learning into solving.

Tone rules that change or get added:

- First person is now allowed and encouraged, sparingly — the coach's earned authority. "I never
  chased a burner when a sure-handed kid was open." Don't overdo it; it seasons the prose, it isn't
  every sentence.
- Warmth and directness together: he's on your side, and he'll tell you the truth. He can be blunt
  ("that's a mistake, and here's why"), never mean.
- Still: present tense for how the game works; no exclamation marks; no emoji in body prose; short
  paragraphs (phone). The chapter's single icon stays in metadata.
- He never references code, the developer, versions, or "the sim." He talks about football as this
  world plays it — now as *his* game to hand down.

---

## Before → after (real chapter text, re-voiced)

These are transformations of text on disk, to calibrate the change. Same facts, same depth, same
no-numbers — new author.

**Reading a Player — "Overall is an opinion about a job"**

- *Now:* "A player's overall is not a measure of the athlete. It is a measure of how well his
  attributes fit the job his position asks him to do…"
- *Re-voiced:* "First thing I'll teach you: overall doesn't measure the athlete — it measures how
  well he fits the job you're asking him to do. Same body rates different depending on where you
  stand him. A quarterback gets graded on what he sees and how fast he sees it; his legs matter
  least. A corner? Speed first, then his eyes, then the hips to turn and run — the pop to finish a
  tackle is a footnote, which is why you'll watch a corner run a back down and bounce right off him.
  The number follows the job, not the man. Remember that and you'll never overpay for the wrong
  guy."

**Recruiting — "There is no bar to fill"**

- *Now:* "A recruit's interest in you does not climb because you spent enough. It climbs because you
  are winning the room."
- *Re-voiced:* "Get this out of your head early: there's no meter you fill by spending enough. A kid
  warms to you because you're *winning the room* — beating the other schools chasing him, that same
  week, head to head. Take more than your share and he leans your way. Take less and he drifts. Sit
  a week out entirely and you slide, because the room moved and you weren't in it. I lost a kid once
  going quiet for two weeks thinking I had him. Don't be me."

**The Pocket — "Who blocks whom"**

- *Now:* "Before anything is contested, bodies get matched. Edge rushers draw your tackles…"
- *Re-voiced:* "Before anybody wins anything, the bodies get matched up. Edge rushers are your
  tackles' problem; the interior guys belong to your guards and center. That's about where they
  line up, not how they play — a big fella heads-up outside is still your tackle's man, even if he'd
  rather run through him than around him. A called blitzer's the exception: he's coming free unless
  a back or tight end you kept home picks him up, and that's close to a coin flip. A blitz buys you
  an *unblocked* rusher some of the time — not a better one."

Note in all three: the mechanism is intact and just as deep, no number leaked, but a person is
saying it and a newcomer gets the point in the first sentence.

**These three are the approved calibration bar (Garrett, Jul 29 2026) — ship them as written.** All
15 chapters target this exact register: plain-English first sentence, then the real mechanism in
order, leak-safe ordinal/directional/conditional claims ("close to a coin flip," "some of the time"
— never a number), first-person sparingly to season the prose, warm and blunt but never mean, and a
"you'll see this on the field as…" hook tying the rating to visible behavior. Scar-stories (the "I
lost a kid once…" beat) are in — they teach through experience; keep them.

---

## Per-position attribute breakdowns (content expansion — Garrett)

A deliberate expansion of what the manual teaches: **how each attribute works for each position** —
what SPD actually does for a corner versus a guard, what AWR means for a QB versus a linebacker,
which attributes a position barely cares about. Right now *Reading a Player* explains the *concept*
(overall = fit for a job) with a few examples; this makes it exhaustive and reference-grade,
position by position.

**Written from:** `POS_WEIGHTS` in `constants.js` — it grades 14 positions (QB, RB, WR, TE, OL, FB,
DE, DT, LB, OLB, CB, S, K, P), each on its own attribute set (e.g. a corner is graded on SPD, AGI,
PWR, STR, JMP, HND, TEC, AWR). `ROLE_WEIGHTS` adds the role-fit variants (press corner, zone guard,
possession receiver, lead-blocking FB) already introduced in the chapter.

**Leak rule still binds — and this is where it's most tempting to break.** The weights are literally
a table of coefficients; the manual must convert them to **ordinal, football language**, never the
numbers:

- ✅ "For a corner, speed is the whole conversation — then the eyes to read the route, then the hips
  to flip and run. His strength barely registers; he's not there to win a wrestling match, he's
  there to not get beat."
- ✅ "A guard lives on power and the anchor to hold a bull rush; technique in his hands is next; a
  little awareness to pass off a stunt. Speed? He needs enough to pull, and not a step more."
- ❌ "SPD is 41% of corner overall, AGI 18%…" — forbidden. Same audit (`manual_leak_audit.mjs`).

**Where it lives — one decision for Garrett:**
- **(a) Expand *Reading a Player*** with a per-position pass (one tight paragraph per position, in
  the coach's voice). Keeps everything in one chapter; longer read.
- **(b) A new chapter, "The Position Room"** — a reference section that walks all 14 positions, each
  with: what it's graded on (ordinal), what it *ignores*, and the role-fit wrinkle. *Reading a
  Player* stays the concept; this is the lookup.
- **(c) Both surfaces:** the full treatment in a chapter, and each position's one-liner also
  available as a **tooltip** on the player card / depth chart, deep-linking the chapter.

**DECIDED (Garrett, Jul 29 2026): (b) + the tooltip half of (c)** — a dedicated "The Position Room"
reference chapter a newcomer can read start-to-finish, with each position's one-liner also reachable
as a tap-tooltip on the player card where he's actually looking at that player. *Reading a Player*
stays the concept; the Position Room is the lookup.

Depth to hit (per position): the ranked handful that matters, the one or two it *doesn't* (the most
useful thing a newcomer can learn is what to stop paying for), the role-fit twist, and a "you'll see
this on the field as…" line tying the rating to visible behavior — exactly the anatomy the existing
chapter uses for corners, applied to all fourteen.

## Tooltips — the new short-form layer

Tooltips are the same coach, compressed. They're for the term or control a newcomer is staring at
*right now*, and they buy a fast "oh, that's what that means" without opening the manual.

**Rules:**
- Same voice, same leak rule. Two or three sentences, hard cap — if it needs more, it's a manual
  chapter, and the tooltip should end with a link to it.
- Tap-to-reveal, never hover. A small `?`/underline affordance on the term; tap toggles a small
  popover; tap-away or a close control dismisses it. (Mount/teardown must not trap the tap — mirror
  how the existing overlays wire their close handlers.)
- Lead with the plain meaning, then one ordinal/directional nugget. Example, **Prestige**:
  > "Your name on the marquee — how much recruiting the program does for you before you say a word.
  > You win it (bowl games, titles) and you lose it losing. It's the first thing to go. → *Recruiting*"
- A tooltip may deep-link one manual chapter (the `→ *Chapter*` at the end). At most one link.
- Never a coefficient, never a threshold. "Steeper at first, flattens out" — never "+18%."

**Content shape (proposed registry, mirrors the chapter registry):**
```js
// js/ui/manual/tips.js  (new)
export const TIPS = {
  'prestige':   { term: 'Prestige',   body: `...`, chapter: 'recruiting' },
  'overall':    { term: 'Overall',    body: `...`, chapter: 'reading-a-player' },
  'role-fit':   { term: 'Role Fit',   body: `...`, chapter: 'reading-a-player' },
  // …one entry per term/control a newcomer meets on a screen
};
```
A screen tags a term with its tip id; the UI renders the affordance and the popover. One registry,
one voice, easy to add to — same ergonomics the chapter registry already has.

---

## Context links — the `?` that lands on the right page

Every screen with meaningful depth gets a `?` that opens the manual **to the chapter that explains
that screen**, not to page one. This is pure quality-of-life and cheap.

**Mapping (screen → chapter id):** depth chart → `the-depth-chart`; recruiting → `recruiting`;
portal → `the-portal`; game plan / play-call → `calling-a-game` (+ `defending-a-game`); the live
game → `anatomy-of-a-play`; roster/player card → `reading-a-player`; practice/development →
`building-a-player`; schedule/calendar → `the-year`; special teams → `special-teams`; career/office
→ `your-career`. **[VERIFY — Garrett: confirm the screen↔chapter map once we list the actual
screens.]**

**Mechanics:** the manual view already resolves a chapter by id (`chapterById` in `manual/index.js`).
The `?` just needs to open the manual view with that id preselected (and scroll to it). A tooltip's
`→ *Chapter*` uses the same path. No new manual plumbing — just a "open manual at id" entry point.

---

## Build order (when we go from spec → code)

1. **Context links first** — smallest, highest daily value: a `?` on each screen that opens the
   right chapter. Needs only an "open-manual-at-id" entry point + the screen→chapter map.
2. **Tooltip layer** — the `tips.js` registry, the tap affordance + popover, and a first pass of the
   ~20–30 terms a newcomer actually meets.
3. **Re-voice the manual** — chapter by chapter, transforming (not rewriting) each into the coach's
   voice. Run `manual_leak_audit.mjs` after every chapter; it must stay green.
4. **Per-position attribute breakdowns** — the new reference content (a/b/c above), written from
   `POS_WEIGHTS` / `ROLE_WEIGHTS`, ordinal-only, audited. Can land alongside the re-voice pass since
   both touch the same chapters.

Each step ships and gates on its own; the manual re-voice + position breakdowns are the long tail and
can go chapter by chapter without blocking the links/tooltips.

---

## Decisions & remaining open items

**Resolved (Garrett, Jul 29 2026):**
1. ~~The name/legend~~ → **APPROVED: "Coach Earl 'Book' Whitaker"** + the one-liner, as written.
2. ~~Voice calibration~~ → **APPROVED: ship the samples exactly as-is.** That's the bar for all 15.
3. ~~Per-position breakdowns~~ → **DECIDED: (b) + the tooltip half of (c)** — "The Position Room"
   chapter + per-position tap-tooltips on the card.
4. ~~Build order~~ → **DECIDED: spec order** (context links → tooltips → re-voice + Position Room).

**Still open — not blockers, resolved as the build reaches them:**
- **Screen↔chapter map** — confirm once we enumerate the real screens (the mapping in the Context
  Links section is the working draft; verify screen IDs against the actual UI before wiring).
- **Tooltip term list** — Claude drafts the ~20–30 terms a newcomer actually meets; Garrett prunes/
  adds. Surfaced for review as part of build step 2 (the tooltip layer), not before.
