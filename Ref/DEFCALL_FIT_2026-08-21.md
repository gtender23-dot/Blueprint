# Step 3 — a call knows which fronts can run it (2026-08-21)

The defensive twin of `fittingConceptsForFormation`. An offensive playbook only
offers a play from a formation whose personnel can run it. The defensive book
had no equivalent: a call was pinned to the single front it named, and nothing
ever checked the front could play it.

## The rule

`callFitsFront(card, front)` in `js/engine/defbook.js`.

The binding constraint is the SHELL. A two-high coverage needs two safeties to
be two-high, and exactly one shipped front does not have them — **the 4-4
fields one free safety between two corners.** So Cover 2, 2-Man, Tampa 2,
Cover 6 and Prevent are not things a 4-4 can run, whatever a card says.
Single-high shells (Cover 1, Cover 3) and the identity default fit all eleven.

Rush count is deliberately NOT a constraint. The engine already caps extra
rushers at `coverBodies - AGGRESSION.minCoverBodies`, and the widest call any
front can make — a 5-2 bringing two, seven rushers — leaves exactly the four
cover bodies that cap allows. A second rule here would only restate it.

## What it found immediately

**Option Killer / "Split 44" called Cover 6 from a 4-4.** Cover 6 is quarters
to the field and Cover 2 to the boundary — a split-field two-high coverage —
and the 4-4 has one safety. A shipped starter book advertising a defense it
cannot play: the same class as the robber cards that robbed nothing (OD-7).

**RESOLVED — moved to the 4-3, renamed "Split 43".** The 4-3 was already in
this book's front mix at 25 and no call in the book was using it, so the fix
closes two things at once. Football: this card is the vs-12-personnel answer,
and against two tight ends both seams are threatened, so you come OUT of the
4-4's eight-man box into a two-high look with real safety help. The name
follows the front, as every other call in this book does. `answers["12"]`
updated with it.

## Front-agnostic calls — where the capacity comes from

A call that NAMES a front belongs to that front. A call that names none is
front-agnostic: it belongs to every front that can run it, and the card draws
it in whichever front you are tabbed to. One authored answer, every legal
picture.

| coverage | fronts it fits |
|---|---|
| Cover 1, Cover 3, identity | 11 of 11 |
| Cover 2, 2-Man, Tampa 2, Cover 6, Prevent | 10 of 11 (not the 4-4) |

**All 71 shipped calls name a front today, so this changes nothing on screen
right now.** It is capability for authoring, not a migration. A book that wants
one "Tampa 2" answer instead of five front-specific ones can now have it.

## Capacity

| | was | now |
|---|---|---|
| `DEF_SHELF_CARD_CAP` | 3 | **10** |
| headset library (`MAX_HEADSET_CALLS`) | 12 | **40** |

Twelve was right for a paper call sheet and wrong for a grid you tab by front —
twelve calls across six fronts is two per tab. `defbook_probe` pinned the 12 as
a literal and went red; it now reads the constants instead, which is what went
stale.

## NEW FINDING — Prevent's shell and Prevent's picture disagree

`COV_FAMILY["Prevent"] = { shell: "two" }`, so the engine plays it two-high.
The card draws it as **three deep thirds** — deliberately, since a 2026-08-18
change gave Prevent its own art precisely because it had been rendering
byte-identical to Cover 3.

Both cannot be right. Real prevent defenses are played 3-deep, 4-deep and
2-deep depending on the staff, so this is a football choice, not an obvious
bug:

- **Change the art to two deep halves** — cosmetic, zero balance risk, makes
  the picture match what the game plays.
- **Change `COV_FAMILY` to a single/three-deep shell** — matches the drawing
  and arguably matches how most people picture a prevent, but it is a live
  coverage change and wants its own A/B.

**RESOLVED — owner chose the art.** Prevent now draws two deep halves pushed
back with six underneath: rush three, drop eight, on the two-high shell the
engine actually plays. Cosmetic only, no coverage behaviour touched, so no A/B
needed. The `prevent` treatment the thirds branch already had (deeper zones,
more underneath) is now on the halves branch too.

Pinned as check E in `defcard_fidelity_probe`. Check C2 could never have caught
this: it tests man versus zone, and both sides agreed Prevent is zone.

## Gate

`defcard_fidelity_probe` — **56 pass, 0 fail.** Green: `card_lint`, `defbook`,
`defsheet`, `defcall`, `bench`, `front_335`, `front_variants`, `front_5_2`.
Alignment sweep clean at every card size. Build clean.

Every shipped call now fits the front it names.
