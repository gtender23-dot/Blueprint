# Defensive Playbook v2 — "The Answers" (design, 2026-08-15)

**RATIFIED 2026-08-15:** the Answers grammar (card = front+coverage+pressure as one
picture; shelves = situations; personnel answers = formChecks) is the build
direction. Coordinators connect via **execution fit** (a DC who knows your front
family runs the same book better — visible scheme-fit grade at hire + staff page;
no control taken, mirrors player scheme-fit). Build order in §6.

Owner brief: v1 (front cards + dial rows) is a fine simple version but a swing and
a miss for the real thing — "ugly and overwhelming," and the overwhelm is
multiplied because most fans understand offense but are lost on defense. Madden's
defensive book is pretty but not fun to call. Hard requirements: **take NO control
away from the player; help the player succeed with the tools, with NO sim
interference.** The playbook creator joins the Division Editor in new-world/new-
season setup, so this must be figured out now. Mock: `qa-shots`/chat image
`31-defcard-mock.png`; prototype renderer `tools/_defcard_mock.mjs`.

## 1. The core insight — defense speaks a different grammar

The offensive book is legible because it speaks in PLAYS: "here's a picture of
what we'll do." Madden's mistake (and v1's) is presenting defense in either
offense's grammar (formation → play names that mean nothing to a novice) or in
engineer's grammar (a wall of dials). Real defensive coordinators organize a call
sheet as **ANSWERS to questions**: what do we do on base downs, what gets us off
the field on 3rd & long, what do we do when they go heavy, what's our gamble.
That grammar is the one fans already have — even a novice knows the QUESTIONS
("they keep throwing deep on us") long before they know the tools. So:

> **A defensive play is one CARD: front + coverage + pressure, drawn as one
> picture. The defensive playbook is a SHELF of answers: each game situation
> holds the 1–3 cards you trust there.**

## 2. The card (presentation = the offense's equal)

One SVG card per call, drawn over the real `DEF_FIELD_LAYOUTS` alignment
(same source the sim resolves bodies from — fidelity rule holds):

- **Zone drops** = translucent areas with plain labels (DEEP ⅓, FLAT, HOOK,
  "RUN THE POLE" for Tampa 2's mike). Blue = deep, green = underneath.
- **Man assignments** = dashed yellow lines to ghost receivers.
- **Rush** = red arrows converging on a ghost QB; a **dog/green-dog** = yellow
  arrow (a second-level player coming); a **fire-zone drop** = a lineman's blue
  arrow bending back into a hook zone. The exchange is VISIBLE — that's the
  whole idea of a fire zone, and no dial ever taught it.
- **Run commitment** = "▼ +15 IN THE BOX" annotation, not a slider readout.
- Ghost offense (gray OL + QB) for orientation; the LOS dashed like play cards.
- The card's subtitle is its PURPOSE in plain football, always in the shape
  *"vs X · what it does · what it risks"*: "vs 3RD & LONG · everything in
  front · gives up the checkdown." That line IS the help system here (deep,
  technical, no numbers — the standing help rules apply).

Engine truth: every element maps 1:1 to fields the sim already consumes —
front (`defFront`), coverage family (`covFamily` → shell/style via
`COV_FAMILY_IMPLIES`), pressure (`pressureIdentity`, `dogGame`, `pressLook`,
`rush3`), box (`runCommit`), robber/edge/zoneStyle. **A call card is a named
`defCall` — the PASS-2 call system already samples these in-game.** No new sim
path; the card is a picture of data the engine already speaks.

## 3. The book (structure = spine + shelves)

```
TeamDefBook v2
├─ IDENTITY (v1 survives as the spine — who we are every snap)
│    baseFront + frontMix, coverage identity, aggression stop,
│    pressure identity, pressureSource, greenDog/spyQB
├─ SHELVES (the call sheet — 1–3 weighted CARDS each)
│    BASE DOWNS · PASSING DOWNS (3rd&long, 2-min) · SHORT YARDAGE & GOAL LINE
│    · THE GAMBLE (pressure package) · PROTECT (prevent / 4-min lead)
└─ PERSONNEL ANSWERS ("when they show it, we check to…")
     vs 10/Empty · vs 11 · vs 12 · vs Heavy · vs Option
     — this is the existing formChecks seam, given cards and a home; it is
     also where the future pre-snap huddle-read feature plugs in (the
     defense's read of the offense's personnel is what triggers the check).
```

Consumption: identity compiles to the standing plan (exactly v1's fields);
shelves compile to situation cells + the defCall library; personnel answers
compile to formChecks. All three seams exist and are probe-covered today.

## 4. Killing the overwhelm WITHOUT killing control (the hard requirement)

- **Progressive disclosure, never removal.** A card's editor shows three big
  choices — FRONT (diagram cards), COVERAGE (family cards with their zone
  picture), PRESSURE (bring 3/4/5/6 + where from) — and everything else
  (robber, zone style, edge, press level, dog games, bracket) sits behind one
  **"Coach mode"** expander per card, pre-filled from the identity. Every dial
  the player has today remains reachable; none is required.
- **Nothing auto-overrides the player.** Help is defaults, labels, pictures,
  and previews — the sim never second-guesses a saved book (the QB-audible
  layer is a player trait, already separately owner-ratified, untouched).
- **The starter books do the teaching.** A new player never faces an empty
  book: they pick a complete default and edit it (below).
- **The preview is the exam answer sheet**: the read-only book view shows the
  shelf grid — "here is this book's answer to every situation" — the same way
  the offensive preview flips through formations.

## 5. Default books — the overhauled library (offense AND defense)

New-world / new-season setup gains a **Scheme step alongside the Division
Editor**: pick one offensive book and one defensive book; open either in its
Builder, edit, and "Save as my own" into the Workshop library (source stamps +
update prompts per the root architecture). Proposed starter shelves — each a
COMPLETE book (identity + every shelf filled), name-flavored, ~6 a side:

- **Offense:** Air Raid · Ground & Pound · West Coast · Spread Option · Pro
  Balanced · Triple Option (reuse/expand the current preset plans into full
  books with looks + sheets).
- **Defense:** Balanced Pro (4-3, Sky 3 base) · Attack 3-4 (fire zones) ·
  Bend-Don't-Break (quarters/Tampa, rush 4) · Pressure Everything (46/Bear,
  Cover 1/0) · Coastal Cover 3 (Nickel pattern-match flavor) · Option Killer
  (assignment football, vs-option shelf loaded).

## 6. Build order (fits the root architecture stages)

1. **Card renderer** (`renderDefCallCard` in routeart.js — productionize the
   mock; the zone/man/rush geometry is ~150 lines and reuses front layouts).
2. **defbook v2 schema** (identity + shelves + personnel answers; v1 books
   repair-load into identity-only v2 with empty shelves — zero loss).
3. **Builder v2 UI** (shelf-first screen; card editor with Coach mode).
4. **Compile seams** (shelves → situations/defCalls, answers → formChecks) —
   goes through the Stage-1 compiler and side manifest by construction.
5. **Starter book library** (both sides) + the new-world Scheme step next to
   the Division Editor.
6. Live-coaching headset chips read the book's shelf for the current situation
   (root architecture Stage 4 already plans this for offense; defense mirrors).

Verification: defbook_probe extends per stage; a new `defsheet_probe` proves
shelf→cell/formCheck compilation; band probes unchanged (no new sim math).
