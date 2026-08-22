# The defensive headset was showing you one call and sending another
**2026-08-22 · owner-reported · fixed, with the disagreement now gated**

> *"this still isnt sane for combining plays and dials. I dont even understand
> whats going on here… why can i send different heat than the play shows"*

He was right, and the screen was worse than it looked.

---

## What was actually happening

Tapping a card did not call it. It **copied the card's settings down into the
dial rows and then forgot the card existed.** The highlight stayed lit, but
nothing connected it to the snap any more — the dials were the only truth, and
they were free to contradict the picture.

From the screenshot he sent: the Lockdown card was drawn as a 3-4, two-high,
2-man. What was queued to snap was **Big Nickel, bend, single-high, man**. Two
different defenses, one of them a picture of a call he was no longer making.

Three more defects sat underneath that:

**The button counted knobs and called them calls.** `SEND IT (4 calls)` was
reading the number of *pinned dials*. One card up and four dials touched
reported as four calls.

**The FRONT row offered all eleven fronts in the game** from a hardcoded list
that never asked the playbook — the same defect he caught on the card preview
days earlier, fixed there and missed here.

**The copy was lossy, and this is the one that stung.** It was a hand-kept list
of fourteen field names, and it had forgotten `bringSeats` — the extra rushers.
Measured across the six shipped books: **29 of 71 calls drew five or six men
coming on the card and sent a base four at the snap.** That is "different heat
than the play shows" in the most literal sense available, and no test could have
caught it, because the explode lived inside a 400-line render function with
nothing importable in it.

---

## The shape he chose

> *"the card plus live picture with a quick call button that calls what the sim
> would if you weren't coaching"*

**A SENDING card, drawn from the live pins, every render.** It sits between the
call grid and the dials, so whichever you are using it is in view. Touch a dial
and the art redraws. Contradict the card you tapped and its name goes to
*"Lockdown (edited)"* with a line underneath saying *"You've changed the call.
This is what goes out."* Tap nothing and it draws your standing plan for this
down, and says so.

There is no second copy of the truth left to drift: the SEND button's label is
built from the same live pins as the picture.

**The button names the defense** — `SEND — Big Nickel · Cover 1 · Bring One` —
instead of counting knobs.

**FRONT offers what the book carries**: its front mix in the order it weights
them, then any front one of its own calls reaches, so situational packages (a
Dime, a goal-line 46) stay reachable without being authored into the base-down
mix. Handles both shapes `defFrontMix` ships in — the `{front: weight}` map a
book stores and the `[{id, weight}]` array the slider hands back — because
reading only the map would have put array indices in the row as front names.

**Coordinator's call**: one tap, whatever the staff would have sent if he
weren't on the headset. It deliberately ignores anything pinned, and its tooltip
says so, so it can never be mistaken for SEND. The timeout still rides, because
arming a timeout and then letting the staff call it is a real thing a coach does.

### The blitzer list, since he asked

The SENDING card resolves his **named blitzers onto real slots** through the
same `resolveDefField` the sim uses, so the arrows are his men and not a generic
"who is eligible from this front" order.

Honest about what that is: the list is a **preference, not an assignment.** The
sim draws from it by weight (Often 3, Sometimes 1), the DC's Blitz Design rating
sets how often he goes off-script, and an unavailable man falls through to the
identity picking by pass-rush grade. So the card draws *the men you named, where
they line up* — the likeliest blitz, not a promise. The hover note says exactly
that rather than implying certainty.

---

## What now guards it

**`js/ui/defcallpins.js`** — the explode lifted out of the render function, DOM
free, so it can be run. It copies the **whole call** now. A list somebody has to
remember to update is how `bringSeats` went missing; copying cannot drift.

**`defcall_explode_probe`** (core, <1s) — every shipped call × four standing
boxes, 924 assertions:

- **A** every stored field survives the round trip;
- **B** the BOX converts both ways (a card's `runCommit` is absolute, the panel
  chip is a shove relative to the standing plan, `dc-send` re-adds it);
- **C** *the rush count the card DRAWS equals the rush count the pins CARRY* —
  the owner's complaint written as an equation;
- **D** a fresh explode never reads as "edited".

**Verified to have teeth**: reverting `defcallpins` to the old field list turns
it red on exactly the `bringSeats` calls.

**`defcall_headset_smoke`** gained the invariant in browser form — *every card,
tapped, must send itself*: for each card in the book, the SENDING line must
equal that card's own tile line. The tile is read from the stored call, SENDING
from the exploded pins; if the explode ever drops a field again, they disagree
here.

It also now pins that the SENDING card and the SEND button agree, that editing a
dial marks the call edited **and** moves the button, that FRONT offers fewer
than eleven fronts, and that Coordinator's call is present. Its old assertion —
`SEND counts the pre-filled pins` — is gone; it was pinning the bug.

### One test bug worth recording
The first run of "every card sends itself" went red on Bear Down: tile said
*Cover 1*, sending said *Match the identity*. That was the **test**, not the
product — re-tapping a live card clears it rather than selecting it, so the loop
was measuring the previous card's pins. Fixed by clearing first. Worth writing
down because the instinct on a red like that is to go change the product.

## Verification
`defcall_explode_probe` 924/0 · `defcall_headset_smoke` (20 checks) ·
`defcall_ui_smoke` · `defcard_fidelity_probe` 56/0 · `card_lint_probe` 36/0 ·
`defbook_probe` 76/0 · `defsheet_probe` · `gate_teeth_probe` · zero page errors ·
visually confirmed in a real browser: flipping STYLE to Man redraws the SENDING
card from Cover 3 zones to Cover 1 man and renames it "4-3 Dog (edited)".
