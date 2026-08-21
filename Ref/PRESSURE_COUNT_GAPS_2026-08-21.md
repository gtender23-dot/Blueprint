# The called rush count — 2026-08-21

Found by `tools/defcard_fidelity_probe.mjs`, which renders a defensive call
card and plays that exact call through the bench to see whether the drawing
and the game agree.

**CLOSED 2026-08-21. Two bugs fixed, one earlier claim retracted, and the
design question answered by the owner. `defcard_fidelity_probe` reads 48/0 and
is registered in the CORE gate.**

---

## FIXED — the fire-zone drop was an exchange on one path and a subtraction on the other

`sim.js` states the rule at the 3-4's native drop site:

> A FIRE ZONE IS AN EXCHANGE, NOT A SUBTRACTION. … letting him bail unanswered
> would drop the front to a three-man rush on 16% of snaps (measured) — which
> is not a fire zone, it is just fewer rushers. The rusher drops and a backer
> comes behind him.

That exchange was implemented for the OLB drop path only. The generic
fire-zone path every other front runs spliced a rusher out and sent nobody, so
the called count was lost.

Measured on the bench before the fix, Cover 3, 40 measurable snaps per cell:

| call | delivered |
|---|---|
| 3-4 bring 5 | **4** on 27/40 |
| 3-4 bring 6 | **5** |
| Penny bring 5 | **4** |
| Penny bring 6 | **5** |

Fix: choose the replacement BEFORE committing the drop, so a front with nobody
left to send does not drop at all and the count can never come out short.
Body-neutral by construction — one man leaves the rush for coverage, one leaves
coverage for the rush.

After: **eight of eleven fronts deliver exactly the called count at every
bring** (4-3, Nickel, Dime, 46/Bear, 4-4, Big Nickel, 3-4, Penny).

### The A/B

Neutral league-representative slate, 60 team-games per arm, matched RNG,
default plans across sixteen front assignments:

| | sacks/team | comp% | ypa | rush yds | ypc |
|---|---|---|---|---|---|
| before | 2.167 | 53.49 | 6.83 | 155.9 | 3.96 |
| after | **2.150** | 53.26 | 6.78 | 153.4 | 3.95 |

No detectable league-wide movement, and slightly DOWN rather than up — the
replacement is a second-level body, a worse pure rusher than the end who
dropped, so the rush is numerically restored and marginally weaker. Sacks/team
sits at 2.15 against the 1.8–2.3 target.

On a deliberately stressed slate (every defense attacking + fire zone across
the seven affected fronts) the same change is worth about +0.45 sacks/game, so
the league-wide null is a mix effect, not an absence of mechanism.

**n=60 team-games is modest.** The real gate is `stat_realism` at N=500 on the
owner machine. This is a green light to run it, not a substitute.

---

## RETRACTED — "Tite has no rush backer and the Jack fix never reached it"

The earlier version of this document called Tite's three-man rush an oversight
and proposed giving it a Jack. **That was wrong.** The three-man rush is
deliberate, documented, and probe-pinned:

- `formations.js`: *"3-3-5: a three-man rush baseline — the stack backers
  cover; the heat comes from the blitz machinery (any of six second-level
  hats)."* and *"Tite/4-4 overhangs play space."*
- `front_335_probe` asserts "rush unit is the three down bodies" and a
  three-man coverage-backer group.
- `front_variants_probe` asserts "Tite overhangs cover (DL=3, LB group=4)".

Seating a Jack on either front was tried and reverted: it broke both probes and
contradicted the stated design. `FRONT_ROLES` is byte-identical to before.

---

## RESOLVED — `bring` names the seat, not the man

`bringSeats` always meant extra rushers BEYOND the front's own rush, but the
labels named absolute numbers, which is only true for fronts that rush four:

| front | base rush | old "Rush 4" gave | old "Bring 5" gave |
|---|---|---|---|
| Tite | 3 by design | 3 | 4 |
| 3-3-5 | 3 by design | 3 | 4 |
| 5-2 | 5 by design | 5 | 6 |

Owner's call, and it is the right one: **rename rather than re-engineer.**

- `Rush 4` → **Base Rush** — whatever the front rushes, and nobody else
- `Bring 5` → **Bring One** — the front, plus one from the second level
- `Bring the House` → **Bring Two**
- `Rush 3` unchanged: `rush3` is genuinely absolute and measures true on all
  eleven fronts

The card then had to count the same way or the rename would just move the lie,
so its arrows now derive from the front's own down linemen + its rush-backer
seat + the seats the call buys.

**Result: 44 of 44 front × bring combinations match the sim.** No front's
identity changed, no engine behaviour changed, so this carries zero balance
risk and the A/B above still stands.

## FIXED — the card drew one half of the fire zone

A fire zone bails a shown rusher and sends a body behind him. The sim does
both. The card arrowed every man in the rush group, so a 3-4 fire zone drew the
end rushing when he drops on 86% of snaps, and drew no replacement.

The card now draws the exchange — the end bending back into a hook, a
second-level body coming behind him — gated on the call actually buying a seat,
because that is when the sim's fire-zone drop fires. At Base Rush only the
3-4's native 18% bail applies, which is a tendency, not a picture.

## Also fixed while finding these (outcome-neutral, already applied)

**The film stamps went blank on any called front.** `covSlots`,
`beatenDefSlot` and `contactSlots` read `defBaseField.bySlot`, which is null
whenever the snap's front differs from the team's base front and no depth pins
force a resolve — so who covered whom, who got beaten and who made the tackle
were absent on exactly the snaps a named call was used for. Measured: present
on 33/37 base-front snaps, **0/37** Nickel and 0/37 3-4. They now use
`_defViewerSlots`, the front-aware fallback built ten lines above and already
trusted by the viewer. Nickel went 0 → 34.

**`RUSH_SLOTS` was a hand-maintained duplicate.** The comment above it claims
all three restatements of "who rushes from this front" now derive from
`FRONT_ROLES`; two did, this one did not, and it is the copy the sim fields
from when the called front differs from the base. Now derived — it reproduces
all eleven prior entries exactly, and the next front added gets the right
answer for free.

**New recording fields**, nothing reads them for outcomes: `rusherIds` /
`rushSlots` (the whole rush group — `blitzerIds` carried only the extra men)
and `droppedRushIds` / `dropSlots` (both drop kinds under one key). Neutrality:
40 matched-RNG games byte-identical with the recording fields excluded.

---

## Probe status

`defcard_fidelity_probe` reads **48 pass / 0 fail** and is now registered in
the CORE tier (`args: ['40']`, ~8s).

Two probes were updated because the rules they pinned genuinely changed, not
because they were wrong: `card_lint` asserted `arrows === bring` (the
assumption retired above) and counted drop squiggles without the fire-zone
exchange. It now imports `rushOlbCount` and `FRONT_PRESSURE_SIGNATURE` rather
than restating either, so it cannot drift from the engine the way `RUSH_SLOTS`
had.

All pre-existing probes green: `front_335`, `front_variants`, `front_5_2`,
`defsheet`, `defcall`, `card_lint`.
