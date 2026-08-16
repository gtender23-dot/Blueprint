# The Manual — writing spec

The in-game reference for Blueprint: College Football Dynasty. This is the brief every
chapter is written against. Read it fully before writing a word.

## What this is

The owner's brief, verbatim:

> "a contained super in depth and technical but still vague enough to hide the actual
> formulas behind everything uses more football analogies to explain how everything works.
> its based off realism so should be understandable"

Unpacked into the four rules the whole thing lives by:

**1. Contained.** It lives inside the game, on its own screen, and it is complete. A coach
never has to go looking anywhere else to understand why something happened. There is no
wiki, no README, no "see the community guide."

**2. Deep and technical.** Do not write marketing copy. Do not write a tooltip. Explain the
actual mechanism: what the simulation is weighing, in what order, what changes the answer,
and what it does *not* care about. If a chapter could have been written by someone who
never read the code, it is not deep enough. The test: does it tell a coach something he
could not have worked out by staring at the UI for an hour?

**3. Vague about the numbers — on purpose.** Never print a coefficient, a weight, a
threshold, a rate, or a constant. Solving the game from the manual ruins the game. See
"The leak rule" below; it is the one rule with a mechanical audit behind it.

**4. Football analogies, not engineering ones.** The model is built off real football, so
real football language should already describe it correctly. Say "the corner is playing
with his back to the quarterback, so he's reacting to the receiver's hips, not the ball" —
not "the coverage function samples the receiver's velocity vector." If a mechanic can only
be explained in code terms, that is a signal the mechanic is unrealistic, not that the
manual needs a diagram. Flag it back rather than writing engineering prose.

## The leak rule

**Never write a number that came out of the source.** Specifically forbidden:

- attribute weights, in any form (`SPD 0.41`, "speed is 41% of coverage", "speed is worth
  about four times agility")
- thresholds and cutoffs ("above 85 overall", "at 25% target share", "after the third week")
- rates, chances and multipliers ("a 6% chance", "1.4x", "roughly one in twelve")
- constant names, function names, file names, variable names
- tuning values of any kind, even rounded, even approximated, even "roughly"

**Allowed, and encouraged:**

- ordinal claims — "speed carries most of a corner's coverage; agility is next; technique
  and awareness matter but they are the smaller half"
- directional claims — "push tempo and you get more snaps, and a thinner rotation by the
  fourth quarter"
- shape claims — "it pays off steeply at first and flattens out; the last few points cost
  far more than the first few"
- conditional claims — "awareness only cashes in when he is already in position to use it;
  a corner who is beaten deep has nothing to be aware of"
- mechanism, order of operations, and what is *ignored* — all of this is fair game and is
  most of what makes a chapter worth reading

Numbers that are part of the RULES rather than the tuning are fine: eleven players, four
downs, a hundred-yard field, four preseason weeks, a sixteen-team playoff. If it would be
in a rulebook, it can be in the manual. If it would be in a spreadsheet, it cannot.

There is a mechanical audit at the end (`tools/manual_leak_audit.mjs`). Assume every number
you write will be looked at.

## Voice

**[GARRETT, Aug 2026 — THE SLIM PASS.]** The manual was originally written in a veteran
coach's first-person voice: anecdotes, asides, "here's the line I'd tattoo on a new coach",
"I've watched it happen". It was good writing and it was far too much reading. The manual is
a reference, not a memoir. Every chapter was rewritten against the rules below. Do not put
the persona back.

- **No narrator.** There is no wise old coach talking to you. Nobody in the manual has
  watched anything happen, has advice, or wants you to really understand something. Delete
  every "here's the part that matters", "get this straight early", "my honest advice",
  "I'd tattoo this on a new coach", "trust me", "the thing nobody tells a new coach".
- **Second person only for the coach's own actions.** "Push tempo and you get more snaps"
  is fine — that is the reader doing a thing. "You didn't take this job to run a study hall"
  is not; that is the narrator characterising the reader.
- Present tense. Confident. No hedging, no "may", no "can sometimes".
- **Lead with the mechanism.** The first sentence of a section states what the thing is or
  what it does. No setup, no throat-clearing, no rhetorical question, no scene.
- **Say it once.** The old chapters restated their thesis at the top of a section, in the
  middle, and again as a closing line. Say it in the strongest place and move on.
- No exclamation marks, no emoji in body prose (the chapter's single icon is set in metadata).
- Short paragraphs — two to four sentences, and no more than four per section. This is read
  on a phone.
- Assume football literacy, not game literacy. The reader knows what a Cover 3 is. He does
  not know what this game does with it.
- Never apologise for the simulation and never oversell it. Describe it.
- Do not reference the code, the developer, versions, or updates. The manual describes
  football as this world plays it.

What survives the cut, always: the mechanism, the order of operations, what a system
ignores, and the non-obvious consequence. Those are the reason anyone opens the manual. What
gets cut: the anecdote that illustrates a point already made plainly, the paragraph that
sets up the paragraph after it, and the closing line that repeats the opening one.

## Accuracy

Every claim must be traceable to something you actually read in the source. This matters
more than coverage: **a chapter that says less and is right beats a chapter that says more
and is wrong.** A confidently wrong manual is worse than no manual, because it teaches
coaches to play against a model that does not exist.

If you cannot determine how something works from the source, leave it out and say so in
your handback. Do not infer, do not assume the obvious implementation, and do not describe
what the system *should* do.

## Chapter module format

Write your chapter to `js/ui/manual/<id>.js`, exporting one object:

```js
// One-line note on which modules this chapter was written from.
export const chapter = {
  id: 'route-duel',
  icon: '🏹',
  title: 'The Route Duel',
  blurb: 'How separation is won and lost, and why a corner who is beaten stays beaten.',
  sections: [
    { heading: 'The release', body: `Prose. HTML allowed: <b>, <i>, <em>.` },
    { heading: 'Leverage', body: `...` },
  ],
};
```

- `blurb` is one sentence, shown in the table of contents. Make it earn a tap.
- `sections` — aim for four to seven. Each is a real idea, not a paragraph break.
- `body` is an HTML string. Use `<b>` for the first appearance of a term of art. Do not use
  headings inside a body; that is what `heading` is for.
- No `<script>`, no inline styles, no classes. The screen styles it.
- Escape nothing else — these are trusted, authored strings.

Length: **roughly 300–500 words per chapter** (was 700–1200 before the Aug 2026 slim pass).
Four to seven sections, each two to four short paragraphs. A chapter should be readable in
about a minute and re-findable in about ten seconds. If a chapter cannot fit, the material
belongs in two chapters — not in a longer one.

## Cross-references

Write them as plain prose — "covered in *Building a Player*" — with the chapter title in
`<i>`. Do not write links; the editing pass wires them.

## The chapters

| id | title | written from |
|---|---|---|
| `reading-a-player` | Reading a Player | `player.js`, `constants.js` (POS_WEIGHTS / ROLE_WEIGHTS / archetypes), scouting in `recruiting.js` |
| `the-year` | The Year | `season.js` (PHASES), `offseason.js`, `world.js` schedule generation |
| `anatomy-of-a-play` | Anatomy of a Play | `sim.js` — the play resolution spine |
| `the-pre-snap-read` | The Pre-Snap Read | `sim.js` pre-snap layer, kill calls, audibles, disguise |
| `the-route-duel` | The Route Duel | `sepgeo.js`, `contests.js`, the catch resolution in `sim.js` |
| `the-pocket` | The Pocket | `sim.js` pass rush / protection / sack / scramble |
| `the-run-fit` | The Run Fit | `sim.js` run blocking, gaps, second level, broken tackles |
| `calling-a-game` | Calling a Game | `gameplan` handling in `sim.js`, `situations.js`, `concepts.js` |
| `defending-a-game` | Defending a Game | fronts/coverage/blitz in `sim.js`, `ai.js`, halftime adjustment scoring |
| `the-depth-chart` | The Depth Chart | `fieldassign.js`, `constants_field.js`, rotation and fatigue in `sim.js` |
| `special-teams` | Special Teams | kicking, punting, returns in `sim.js` |
| `building-a-player` | Building a Player | `development.js`, practice plans, `offseason.js` dev camp |
| `recruiting` | Recruiting | `recruiting.js` — the funnel, interest, offers, budget, distance |
| `the-portal` | The Portal and the Roster | `portal.js`, roster/scholarship handling in `offseason.js` |
| `your-career` | Your Career | `career.js`, `coach.js`, `coachprofile.js`, program pedigree in `world.js` |

## Your handback

When you finish, report:

1. The file you wrote and the chapter's section headings.
2. **Anything you could not determine from the source** — this is the most useful thing you
   can hand back, because it is where the manual would otherwise be wrong.
3. Anything you found that looks like a bug or a contradiction between systems. You are
   reading these modules more carefully than anyone has in a while. Say what you saw.
4. Any place you had to get close to the leak line, so the audit knows where to look.
