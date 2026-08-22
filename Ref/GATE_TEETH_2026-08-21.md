# The gate had no teeth, and the dice were loaded
**2026-08-21 · owner session · follow-on from the timeout work**

Two problems, found one after the other, that between them meant a green FULL
gate did not mean what it looked like it meant.

---

## 1. Probes that could not fail

`_gate.mjs` judges a probe by its **exit code and nothing else**. A probe that
prints `⚠ FAIL` and then falls off the end of the file exits 0. It is a log,
not a gate.

Two were caught by eye within days of each other:

- **`coverage_monotonicity_check`** — printed *"HELPS THE RECEIVER (INVERTED)"*
  and exited 0. The deep-zone AWR inversion it was built to catch survived
  seven months of green runs. (Fixed earlier this session.)
- **`time_to_throw_probe`** — printed `⚠ FAIL` and exited 0. Its
  sack-neutrality check *had been failing*, and nobody could have known.

Catching these by reading them is not a system, so `tools/gate_teeth_probe.mjs`
now sweeps every manifest entry for the shape: a file that can reach a failure
conclusion without reaching a non-zero exit.

**Its first honest run found eight more.**

| verdict | probes |
|---|---|
| real gates missing their exit — wired, all green on the first honest run | `checkdown_probe`, `read_conflict_probe`, `scramble_style_probe`, `qb_mobility_probe` |
| genuine reports, now excused **by name with a reason** | `def_stress_probe`, `broken_tackle_check`, `commit_rate_test`, `recruit_calendar_probe` |

The ALLOW map is the point. A probe that legitimately cannot fail — a gallery,
a calibration table, a census — is fine. What is not fine is that being an
accident nobody noticed. Now it is a line somebody wrote, with a reason next to
it, and anything new that drifts into the shape goes red.

`gate_teeth_probe` is registered **core**, runs in under a second, and is
purely static.

---

## 2. The seeding template was broken

Every seeded probe copied this from `tipdrill_probe`:

```js
let _s = 20260810;
Math.random = () => { _s = (_s * 1103515245 + 12345) & 0x7fffffff; return _s / 0x7fffffff; };
```

That is a textbook LCG written in a language that cannot hold it. `_s` runs to
2³¹; 2³¹ × 1103515245 ≈ 2.4e18, far past `Number.MAX_SAFE_INTEGER` (9e15). The
multiply rounds away its low bits — and `& 0x7fffffff` then keeps **exactly the
bits that were rounded away**.

Measured state cycle: **10,466 draws. For every seed tried** (20260810,
20260821, 7, 991 — all 10466, entering after 170–4004 steps). A 120-game arm
draws millions of values, so it replays that same ten-thousand-value loop
hundreds of times.

So "deterministic by construction" was true and meaningless: reproducible, but
reproducing the wrong thing. The visible symptom was `time_to_throw`'s sack gap
reading **2.09 vs 1.98 on one seed and 3.36 vs 0.99 on another** — a swing no
240-game sample could produce.

`tools/_seed.mjs` replaces it with mulberry32 (`Math.imul` throughout, nothing
rounded, no state repeat within 5,000,000 draws at any seed tried) and is now
the one way a probe pins `Math.random`. `pinRandom()` returns a `reseed` that
each arm calls, which makes every A/B a **matched-RNG** comparison — the only
difference between two arms is the code path. `BP_SEED=<n>` sweeps.

Seeded onto it: `blitz_reality`, `run_scheme`, `robber`, `gadget`, `covsack`,
`time_to_throw`, and `tipdrill` itself.

`qb_live_probe` and `watch_live_probe` needed a second mechanism — their
randomness lives inside the browser page, not this process — and got one the
same day (`pinPageRandom`, below).

---

## What pinning the dice then exposed

### `blitz_reality` check C was real, and it was red — now retired

With the seed pinned, *"empty set draws more pressure than heavy set"* failed
**deterministically, on every seed tried**:

| seed | Empty sack% | Power-I sack% |
|---|---|---|
| 20260821 | 5.84 | 5.96 |
| 7 | 5.69 | 5.72 |
| 991 | 5.87 | 6.07 |

The heavy set draws *equal or more* pressure than empty, every time. This was
the check I had earlier proved flapped across runs on byte-identical code — the
flapping was hiding a consistent zero.

I checked the obvious probe-side explanation first, because this repo has been
bitten by it before (the front-mix bug): does the probe's `offFormation` setting
actually reach the field, or is it a dial that goes nowhere? **It reaches** —
406 Empty snaps vs 404 Power-I over six games, verified directly off the play
stamps. So this was the engine, not the probe.

**Owner ruling (2026-08-21): the game is fine as it plays.** The claim goes, not
the behaviour. Check C is now a reported line, so the number stays visible if
the pass rush is ever reworked, and it never fails a build. A and B still gate,
and the file is green.

### The scrambler coverage-sack law: retired too

*"A scrambler eats fewer coverage sacks than a statue at the same awareness"*
split 4-of-5 seeds. Real but small, with a plain football reason it stays small:
a quarterback who escapes more also holds the ball longer, so the two effects
fight each other.

**Owner ruling: not a law the game owes us.** Demoted to a reported number.

That freed `covsack` completely — with the check demoted and N at 150, it is
clean on five seeds (default, 7, 991, 4242, 31337), zero failures, so
`seedFlaky` is **dropped**. It is a real gate again.

### `gadget` was the opposite problem: under-sampled, not absent

Worth writing down because it is the mirror image of the blitz case, and telling
them apart is the whole reason for pinning the dice.

The flea-flicker completion check reads the gap between a run-committed front
and a two-deep shell. At the shipped `GAMES=40` it measured **−1.4pp** on one
seed — apparently the wrong direction, exactly like the blitz result. At
`GAMES=130` it measures **+9.7 / +8.7 / +1.7 pp** across three seeds: always the
right sign. The effect was never missing. There simply were not enough trick
plays in forty games to see it.

Two fixes, one of them embarrassing:

- N raised 40 → 130 (~110s/seed), timeout raised to match.
- **The label lied.** It printed `A% > B%` while the check quietly required a
  **+3pp margin**, so a run reading `52.3% > 50.6%` printed `FAIL` and looked
  like a broken probe. It now states the bar and the measured gap. I nearly lost
  a cycle to this myself.

`seedFlaky` stays on `gadget` for one reason only: that +3 bar still clips the
low tail (seed 991 landed +1.7). Either raise N again or rule the bar too fine —
**the effect itself is not in doubt.**

### One bar re-centered on measurement

`time_to_throw`'s sack-neutrality bar moved **0.15 → 0.50** on a seven-seed
measurement (gaps 0.06 0.26 0.01 0.02 0.34 0.06 0.06 sacks/team at GAMES=120).
The old bar sat *inside* that spread, so two seeds in seven failed on nothing
but which games got played. 0.50 still catches a real break: Fix A moves the
hurry rate by 15–28 percentage points, so a version of it that leaked into
sacks would blow past 0.50, not creep a tenth over it.

---

## Also changed

- `blitz_reality` timeout 300 → 600 (measured 3m18s at N=200 here; the old
  ceiling was inside the noise).
- `covsack` args `['150']`, timeout 400 → 600 (measured 1m48s), `seedFlaky` off.
- `gadget` args `['130']`, timeout 400 → 900 (~110s/seed), `seedFlaky` kept.
- `qb_live` / `watch_live` page-seeded; `qb_live` `seedFlaky` off.

## The two browser probes: done, and proven

`qb_live_probe` and `watch_live_probe` were the two this pass could not reach at
first. They compute nothing here — they boot the built game in a real browser
and watch a play happen, checking things like whether the quarterback's arm
comes back before the ball leaves, or whether blockers execute the scheme the
record says they ran. **The dice live inside the page**, so pinning
`Math.random` in the probe process reached nothing.

`pinPageRandom(page)` in `tools/_seed.mjs` uses Playwright's `addInitScript`,
which runs before *any* page script on every navigation — so the bundle sees a
pinned `Math.random` from its very first call, including module top-level work
that happens before the probe can touch anything.

**Proven, not assumed.** Counting green runs proves nothing here: `watch_live`
was 3-for-3 clean on the run *before* it failed. So `tools/_pagedet.mjs` boots
the same seed twice and diffs what the broadcast actually says:

```
run A  … Baltimore Bluff 0 · Q1 15:00 · 1st & 10 OWN 25 · Pistol/RPO — Trap …
       … RPO read — kept the handoff: t. Richardson picks up 8 (D. Wilson) …
run B  … identical, all eight samples
```

Same teams, same play calls, same yardage, at the same game clock. Seed 7 gives
a completely different matchup (Petit Jean State vs Snake River) and is likewise
identical to itself. The seed drives the game and each seed reproduces.

After: `watch_live` 10 clean runs (it was 1-in-4 failing before), `qb_live` 5
clean runs and `seedFlaky` dropped.

**One caveat worth knowing.** A pinned page plays *one specific game*. If a
check needs a situation that game never creates, it will now fail every time
instead of sometimes. The fix then is to pick a seed whose game contains the
situation **and write down why in the manifest note** — never to widen the
check. That is the trade: flakiness swapped for a choice somebody has to make
in the open.

## Verification
`gate_teeth_probe` green · `tipdrill_probe` green on the fixed generator ·
`checkdown` / `read_conflict` / `scramble_style` / `qb_mobility` green on their
first honest run · `run_scheme` / `robber` green seeded · `time_to_throw` green
seeded at N=120, all seven sweep seeds inside the re-centered bar ·
`blitz_reality` green with C reported · `covsack` clean on five seeds at N=150 ·
`plan_side_probe` green · `watch_live` 10/10 and `qb_live` 5/5 page-seeded,
with `_pagedet` proving the page replays the identical game.
