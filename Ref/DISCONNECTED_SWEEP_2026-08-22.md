# What else isn't connected
**2026-08-22 · sweep for the front-mix bug class**

The recurring defect this project keeps producing: *a dial the coach can author,
that the UI shows and the book stores, which never reaches the field.* The
front-mix bug, `bringSeats` dropped by the headset's card copy, `writeDial`
writing the season plan from a live screen, two phase-label tables disagreeing.
This is a sweep for more of the same.

---

## 1. The offense had no equivalent of `def_stress_probe` — built

`off_stress_probe` (full tier, report-only, 23 arms) now A/Bs every offensive
dial in `PLAN_FIELD_SIDE` between its extremes over matched seeds, each measured
on the outcome it is supposed to move. **20 of 23 move the game.**

### Writing it found four of MY bugs before it found any of the game's

Worth recording, because every one of them would have been reported as a dead
dial, and because it is the same mistake `def_stress` made with the BOX arm:

| my bug | read as | actually |
|---|---|---|
| `chipHelp: 0 / 100` | dead dial | it is an **enum** (`"auto"` / `"chip"`) — sim.js reads `=== "chip"` |
| `losFreedom: 0 / 100` | dead dial | also an enum (`"never"` / `"auto"` / `"free"`) |
| `rbCarryShares: { RB1: 95 }` | dead dial | keyed by **player id** (`rbShares[id]`, sim.js:3421) — a literal slot name names nobody |
| top-share pooled across games | dead dial (9.9% vs 9.9%) | the roster regenerates every game, so pooling player ids dilutes any share to noise — measure **per game and average** |

Two more arms had bars stricter than the effect they measured (motion moved
0% → 9.5% against a 10-point bar; RPO is gated by formation so even
`rpoRate: 100` reaches only a few percent of snaps from a mixed book).

The probe now supports a patch that is a **function of the roster**, which is
what any player-keyed dial needs.

### Three standing leads

| dial | measured | note |
|---|---|---|
| **`rpoKeepPct` 0 vs 100** | `rpoKept` **0.0% in both arms** | the strongest lead. Over ~870 snaps with `rpoRate: 100` from a Spread-only book, 48–59 RPO snaps fired and **not one was stamped kept**; every read resolved `pull` or `wrongPull`. The QB appears to pull on every RPO, and the keep dial changes nothing. |
| **`chipHelp` auto vs chip** | pressure **32.6% vs 32.6%** | identical to the decimal on matched seeds, against a house-blitz defense. The values are right (`"auto"` / `"chip"`) and sim.js does read them, so this is worth tracing rather than dismissing. |
| **`protEmphasis` 0 vs 100** | sacks **7.0% vs 6.3%** | moves the right way, below the bar. Reads exist (`edgeRushMult` clamps ±0.2) — reads as weak, not dead. Either raise N or accept it is a fine-tuning dial. |

None of these is asserted as a bug — that is the rule the probe is written to.
They are the leads it surfaced on its first honest run.

## 2. `dead_surface_probe` cannot catch this class — presence is not effect

It statically extracts every key the UI writes and requires each to *appear* in
engine code. That catches a key nothing reads at all. It cannot catch:

- a key the engine reads but never acts on;
- a key dropped in transit — **`bringSeats` would have passed it**, because the
  name appears all over `sim.js`; what was broken was the headset's copy of the
  card into the per-snap pins.

Its green is worth having and is not the same green as "the dial works."

## 3. A false FLAT in `def_stress` — fixed

`box -25 vs +25` had been reporting **FLAT (4.30 vs 4.34 ypc, Δ 0.04)**. The
dial is fine; the arm was pointed at a neutral spread offense, and a box dial
can only be judged when somebody is running.

Re-pointed at a run offense (`RUN_OFF`, Power-I / Heavy Run / 70% inside), it
reads **4.30 vs 3.75, Δ 0.54** — a clean half-yard gradient, and monotonic
across the range at N=24: **4.49 / 4.31 / 4.22 / 4.16 / 3.99** for runCommit
−25 / −8 / 0 / +8 / +25.

A false FLAT is worse than no report: it trains you to skim the list. 26 arms,
now 23 moving.

## 4. Three FLAT arms remain, and two look like the same arm problem

| arm | reads | likely |
|---|---|---|
| `cushion press vs off` | comp% Δ 1.4pts | press hurts the **quick game** most; the arm uses a balanced-depth offense |
| `zone teaching spot vs match` | comp% Δ 1.3pts | match coverage earns its keep against **crossers and mesh**, not a neutral route mix |
| `option key dive vs pitch` | ypc Δ 0.05 | already tested vs `OPTION_OFF`, so this arm is *right* — this one may be a genuinely weak dial |

The first two want the same treatment the box arm just got: point the arm at the
offense that makes the dial matter. The third is a real lead into the option
engine.

## 5. Worth a look, not yet investigated

- **`runCommit`'s two halves scale differently.** Its *cost* — play-action bite
  (`commitAmp`), gadget bite, coverage separation (`RUNCOMMIT_COV_SCALE`), the
  trick-play call brain — scales continuously with the value. Its effect on the
  offense's concept grade goes through `boxState` (`sim.js:149`), which is
  **binary** at ±5: loaded / light / null. So +8 and +25 buy the same concept-
  level answer at different prices. The run-yardage gradient measured above is
  real, so this is not "the dial does nothing" — but the two mechanisms scale
  differently and nobody decided that on purpose.
