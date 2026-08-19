# PRESSURE COHESION AUDIT — 2026-08-19

> ## ⚠ ODs SUPERSEDED — read `Ref/PRESSURE_REDESIGN_2026-08-19.md` first
> The owner reviewed these findings and rejected the pie as the right shape for
> the problem, so **OD-P1 through OD-P4 are no longer the live questions.** The
> redesign replaces the pie with a player-level BLITZER LIST and gives each of
> the three pressure questions (how often / how many / who) exactly one owner.
> P1+P2 are answered by `bring` becoming SEATS; P3 dissolves because HEAT
> retires; P4 dissolves because the list is attached to players, not fronts.
> **The MEASUREMENTS below remain valid and are the evidence base for the
> redesign** — keep reading them, ignore the recommendations.


**Scope (owner):** "Depth chart blitz share vs the game plan's aggression and
pressure style vs the defbook's — how many come and where it comes from."

**Method:** the standing law — sources set the shape, **probes decide truth**.
Every number below is measured on this tree, not reasoned from the code.

**Prior art honoured, not re-derived.** `Ref/BLITZ_MODEL_ASSESSMENT.md` (deepRisk
+ zeroBehind wired, QB hot answer, blitz-the-formation — all three implemented
and verified), `Ref/BLITZ_PIE_PLAN.md` (the pie's design and integrity rules),
and the D10 audit's **OD-8** (blitzPct derived-only) and **OD-9** (pressureSource
retired). This pass audits the SEAMS BETWEEN those surfaces, which nothing has
looked at end to end.

---

## The four surfaces, and what each actually owns

| surface | where the coach sets it | field | what it really controls |
|---|---|---|---|
| **Depth chart — pressure pie** | Depth Chart ▸ Defense ▸ a front's ⚡/🛡 dials | `fieldAssignments.defense[front].blitzShares` | WHO takes the first rush seat when a blitz fires |
| **Depth chart — HEAT** | same panel | `fieldAssignments.defense[front].heat` | a ×0.5–×1.5 multiplier on HOW OFTEN |
| **Game Plan — aggression** | Game Plan ▸ Defense | `defAggression` (stop) | the base call RATE (bend 8% → house 45%) |
| **Game Plan — pressure style** | same | `pressureIdentity` | WHO the extra hats are + the coverage risk tier |
| **Defbook — a card's `bring`** | Playbook ▸ defensive call | `card.bring` | **see P1 — not a count** |

The rate spine, `sim.js:1551`:

```
blitzPct = pressureCallRate({ stop, lev, design, rate }) × formTell × pieHeatMult
```

capped at `AGGRESSION.capRate`. Aggression and HEAT **compose** — they multiply,
they do not fight. That part is sound.

---

## P1 · `bring` is a RATE SELECTOR, not a rusher count *(the headline)*

`DEF_CALL_BRING` (defbook.js 59) does not set a count. It sets the aggression
stop:

| card | what it compiles to |
|---|---|
| Rush 3 | `rush3: true` — a genuine count instruction |
| Rush 4 | `aggression: "balanced"` |
| Bring 5 | `aggression: "attacking"` |
| Bring the House | `aggression: "house"` |

So "Bring 5" means *"use the attacking rate on this snap"*, and whether five
actually come is then a dice roll. **Measured** (bench, Spread/Four Verts vs
4-3 Cover 3, n=751 per cell):

| the card says | blitz fired | rushers who actually came |
|---|---|---|
| Rush 3 | 0% | **3 → 100%** ✓ |
| Rush 4 | 23% | 4 → 77%, **5 → 23%** |
| Bring 5 | 36% | **4 → 64%**, 5 → 36% |
| Bring the House | 51% | **4 → 49%**, 6 → 51% |

Read the middle two rows again. **"Bring 5" sends four rushers on 64% of snaps —
the majority outcome is the opposite of the name.** "Bring the House — no help,
get there or get beat" is a coin flip. When the call *does* fire the count is
right (5 and 6 respectively); the defect is that firing is probabilistic at all
on an explicitly called pressure.

This is the pressure twin of the defect class this project keeps finding: a
surface that states a fact and delivers a tendency.

> **OD-P1 — what does a called `bring` promise?**
> **(a) A COUNT (recommended).** A called card is a play call, not a posture: if
> the coach calls Bring 5, five come. `bring` sets the rusher count directly and
> the aggression stop stops being its proxy. Standing/AI pressure is untouched
> (they never call cards), so the bands should barely move — but this IS a
> balance change and needs its own A/B.
> **(b) Keep it a rate, rename the cards.** "Attacking look" / "Max pressure
> look" instead of counts. Cheapest, honest, but loses the count vocabulary real
> coaches use.
> **(c) A count with a bust chance** — five are *sent*, protection may still
> pick one up. Most realistic; largest change (needs a pickup model).

## P2 · "Rush 4" blitzes on 23% of snaps

Fallout of P1 but worth its own line, because it is the card a coach picks when
he explicitly does **not** want to blitz. `bring:"4"` compiles to
`aggression: "balanced"` = a 20% base rate, so the four-man call sends a fifth
rusher nearly a quarter of the time. There is no way to call a plain four-man
rush; only Rush 3 can say "do not blitz".

> **OD-P2 — does Rush 4 mean "exactly four"?** Recommended **yes**, and it falls
> out of OD-P1(a) for free. If OD-P1(b) is chosen instead, Rush 4 still needs a
> "no blitz" semantic or the card is unusable for its one purpose.

## P3 · A depth-chart dial silently mutes a headset call

`_pieHeatMult` (sim.js 1550) is applied to `blitzPct` **unconditionally** —
there is no "unless this snap was called" guard. A coach who set HEAT to 0 on
his Nickel front, then calls Bring the House from the headset, gets
45% × 0.5 = **22.5%**. His explicit in-game call is halved by a slider he moved
on a different screen weeks earlier, with nothing on either screen saying so.

This contradicts the order the owner already ratified for the equivalent
offensive seam — **OD-3: the headset beats the standing plan.**

> **OD-P3 — does HEAT apply to a CALLED pressure?**
> **(a) No (recommended).** HEAT shapes the AUTO rate — how often the
> coordinator dials one up on his own. An explicit call is the coach overriding
> his coordinator and should fire at the called rate. Consistent with OD-3.
> **(b) Yes, disclosed.** Keep it, and say so on the card ("your Nickel heat
> dial is muting this call") — defensible as "your personnel aren't built for
> it", but it makes a called play conditional on a forgotten slider.

## P4 · The pie and HEAT are keyed to the front FIELDED, not the front you dialed

`defFA = fieldAssignments.defense[defFrontId]` (sim.js 5107) — the front that
actually took the field, chosen by `selectDefFront`'s auto-sub. Dial your pie on
your base front and it is simply **absent** on every snap the defense subs.

**Measured** (base front 4-3, 8,824 snaps):

| | base front fielded |
|---|---|
| all snaps | 75% |
| **pass snaps** | **72%** |

Fronts actually fielded: 4-3 75% · 46/Bear 11% · Nickel 6% · Dime 5% · 5-2 2%.

So a dialed pressure pie is inactive on **28% of passing downs** — and they are
not random snaps, they are the obvious-pressure downs (Nickel/Dime on third and
long) plus, since today's goal-line work, most snaps inside the 5. The coach's
pressure design goes missing precisely when he most wants it.

Note this is *defensible as designed* — a pie is per-front because who blitzes
from a Dime look genuinely differs from a 4-3. The defect is that **nothing
tells the coach**, and there is no way to express "this is my pressure identity
whatever front is on the field".

> **OD-P4 — how should a dialed pie survive an auto-sub?**
> **(a) Inherit from the base front (recommended).** An undialed front falls back
> to the base front's pie, mapped by ROLE (the ⚡ on your MIKE stays on the MIKE).
> Preserves per-front dialing for anyone who wants it, stops the silent gap.
> **(b) Show the gap.** Keep the behaviour, mark undialed fronts on the Depth
> Chart ("no pressure design — inherits nothing"). Cheapest, honest, still leaves
> 28% of passing downs undesigned.
> **(c) Nothing.** Defensible, but then the Depth Chart should stop implying the
> dial is a team-wide pressure identity.

---

## What is SOUND (checked, no action)

- **Aggression × HEAT compose.** They multiply inside the cap. No conflict.
- **`rush3` is honoured absolutely** — 3 rushers, 100%, and it zeroes the blitz
  roll. The one card that means what it says.
- **The coverage cost of a blitz is real** — `deepRisk`/`zeroBehind` were wired
  per BLITZ_MODEL_ASSESSMENT and the identities separate by ypa.
- **`blitzPct` is a derived mirror** (OD-8 discharged in D16); the three rogue
  raw writers are gone.
- **`pressureSource`** retired per OD-9.
- **The pie only engages when dialed** — every AI plan and untouched save takes
  the byte-identical path, per the pie plan's zero-migration law.

## Dispatch order once ratified

1. **OD-P1 + OD-P2 together** (same code, one A/B) — they are one change.
2. **OD-P3** — small, and it is a correctness fix against an already-ratified
   principle (OD-3), so it may not need its own OD if the owner reads it that way.
3. **OD-P4** — largest; (a) needs a role-mapping between fronts.

**Gates for any of them:** `blitz_pie_probe`, `pressure_probe`,
`blitz_reality_probe`, `def_stress_probe`, `plan_cohesion_probe`, plus
`stat_realism` bands — pressure drives sacks, and sacks/team is at 2.07 against
a 1.8–2.3 target with little headroom.

**Nothing in this document has been changed in code.** Audit only, per the
standing pattern: findings first, owner ratifies, then dispatch.
