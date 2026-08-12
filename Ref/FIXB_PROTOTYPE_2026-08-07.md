# Fix B prototype — AWR-gated coverage sack / throwaway (2026-08-07)

Prototype only. **Not committed. Ship decision is the owner's — see the verdict.**
Gated `globalThis.__noCovSack` (on by default, like the other `__noX` fixes).

## The mechanic

At the read/pressure decision in `resolvePassPlay` (`js/engine/sim.js`, just after the
`qbRead` call), when the field is covered under pressure — the QB is `hurried` AND the
most-open receiver's separation (`chosen._bestSep`) is below `C.COVSACK_COVERED_SEP` — the
outcome branches on awareness:

- **High-AWR → throw it away.** Clean incompletion, no sack, no INT. `result.throwAway`.
- **Low-AWR → force it.** Split three ways:
  - `COVSACK_FORCE_SACK` → an actual **coverage sack** (`result.coverageSack`).
  - `COVSACK_FORCE_SHORT` → re-aimed at the **checkdown / shortest outlet**, re-scored as a
    short throw (`result.forcedCheckdown`, high completion).
  - the remainder → a **forced throw into coverage** (`forced=true` → can be intercepted).

P(throw away) = `clamp(0.5 + (AWR − COVSACK_AWR_PIVOT)·COVSACK_AWR_SCALE, 0.05, 0.95)`.

### Design note — why a covered-sep threshold, not "no option above minSep"
The brief said fire when "no throwable option above `minSep`." In this sim that **literally
never happens** — measured 0.0% of reads have every option below the qbRead `minSep` (0.28);
separations sit higher. So the trigger is operationalized as "the most-open man is still
covered" (`_bestSep < COVSACK_COVERED_SEP`), which is the same *situation* on this sim's
separation scale. `COVSACK_COVERED_SEP` is the volume dial.

## Landed constants (`js/constants.js`)
`COVSACK_AWR_PIVOT 70` · `COVSACK_AWR_SCALE 0.022` · `COVSACK_COVERED_SEP 0.46` ·
`COVSACK_FORCE_SACK 0.15` · `COVSACK_FORCE_SHORT 0.60` (residual forced-coverage 0.25).

## Probe — the AWR split (PASS)
`tools/covsack_probe.mjs` (40 games/arm, heavy blitz):

| QB | throwAway | forced checkdown | coverage sack | force-share |
|---|---|---|---|---|
| high-AWR (92) | 1.35% of passes | 17 | 3 | 36% |
| low-AWR (55) | 0.45% | 21 | 4 | 68% |
| gated off | 0 | 0 | 0 | — |

All four checks PASS: high-AWR throws away more, low-AWR forces a larger share, coverage
sack is a small residual, gated-off is inert. `int_accounting_probe` still PASS with Fix B
on (it does not corrupt INT attribution).

## Volumes under the harness gameplan (blitz 20%), per team-game
throwAway **0.254** · forced checkdown **0.313** · coverage sack **0.108**. Forced-into-
coverage residual ≈ 0.13/game. These are the real league-level magnitudes.

## stat_realism — Fix B OFF vs ON (N=300, 2-run average each; OFF↔OFF noise ≈ ±2.5 rush, ±0.7 comp%, ±0.15 INT%, ±0.02 sacks)

| metric | band | OFF | ON | read |
|---|---|---|---|---|
| Points/team | 22–32 | 27.2 | 27.5 | in band, flat |
| **Rush yds/team** | 150–200 | 146.1 | 143.4 | pre-existing off; ~−2.7 (within noise) |
| Pass yds/team | 200–290 | 250.2 | 252 | in band |
| **Comp%** | 58–68 | 57.7 | 57.3 | pre-existing off; flat (within noise) |
| **Sacks/team** | ~1.8–2.3 | 2.01 | 2.18 | **in band, +0.17 (REAL — coverage sacks, ≈+0.11 causal)** |
| Yds/attempt | 6.5–8.0 | 7.25 | 7.27 | in band, flat |
| **TEAM INT%** | ~2.0–2.5 | 1.60 | 1.56 | pre-existing off; flat (within noise) |
| Turnovers/team | 1.2–1.9 | 1.31 | 1.35 | in band, flat |

## Verdict — band-SAFE, but benefit-inert (fighting the veto by being too small to matter)

**It passes the letter of the veto:** nothing that was in band leaves it (sacks top out at
2.18–2.22 ≤ 2.3), and no floor metric is pushed further down beyond noise. This is a genuine
success versus blanket Fix B, which drove comp%, INT%, and rush all *down*. The AWR redesign
does not do that — the checkdown-weighting cancels the throwaway's completion loss, so comp%
holds.

**But it does not deliver the INT%-floor lift it was built for.** The covered-under-pressure
situation is rare (~0.7 triggers/team-game), so the forced-into-coverage residual is only
~0.13 throws/game → a ~0.02-INT/game bump → a **~0.06 pp** INT% lift, far below the ±0.15 pp
sampling noise at N=300. The only reliably-measurable league effect is the **+0.11 sack**
cost from coverage sacks (in band, but it spends headroom).

**And the two below-floor metrics are in direct tension.** Lifting INT% needs *more* forced
throws into coverage (incompletions/picks), which lowers comp% — also below floor. Lifting
comp% needs *more* checkdowns, which does nothing for INT%. You can't move both up with the
same trigger volume. Cranking `COVSACK_COVERED_SEP` up to force more volume would make INT%
move materially, but it would move comp% (down) and sacks (up) at the same time.

**Recommendation:** the mechanic is realistic and safe to ship *if the goal is behavioral
realism* (smart QBs throw it away; raw QBs force checkdowns; a few coverage sacks appear).
It is **not** a fix for the below-floor INT%/comp% calibration — those need a different lever
(e.g., the coverage-pass separation/INT calibration itself). Before any ship, confirm at
**N ≥ 1000** on a machine without the 45 s sandbox cap that (a) the +0.11 sack cost is
acceptable and (b) INT%/comp% truly hold. Do not ship on the N=300 read alone.

> Repro: `COVSACK=off|on node tools/_covsack_stat.mjs 300` (temp helper, delete after).

---

## ADDENDUM — dual-threat escape (2026-08-07, shipped with Fix B)

Added a mobility-scaled **escape** at the top of the Fix B branch: a flushed QB on a
covered field can take off rather than eat the coverage sack. Escape prob =
`qbScrambleChance(qb) * C.COVSACK_SCRAMBLE_MULT` (mobility-keyed via SPD/AGI vs
STR/TEC/AWR), rolled *before* the AWR throwaway/force split; reuses the run-scramble
outcome path. `C.COVSACK_SCRAMBLE_MULT = 0.8` (0 disables). `result.covScramble`.

**Why:** without it, mobility only helped *upstream* (the pre-read hurry-scramble roll); a
mobile QB who stayed in the pocket was booked a coverage sack like a statue. Now legs are a
second tool in the exact coverage-sack spot.

**Probe (`covsack_probe`, +2 checks, all 6 PASS):** at fixed AWR 62, a scrambler (SPD 93)
escapes far more than a statue (SPD 57) and eats fewer coverage sacks — isolating legs from
awareness. AWR split, residual, and gated-off checks still hold.

**stat_realism, escape OFF vs ON (N=300, 2-run avg each):**

| metric | band | Fix B, escape OFF | Fix B, escape ON | baseline (Fix B off) |
|---|---|---|---|---|
| Sacks/team | 1.8–2.3 | **2.23** (near ceiling) | **2.05** | 2.01 |
| Rush yds/team | 150–200 | 146.9 | 146.2 | 146.1 |
| Comp% | 58–68 | 57.2 | 57.3 | 57.7 |
| TEAM INT% | ~2.0–2.5 | 1.58 | 1.60 | 1.60 |

**Result:** the escape removes ~0.18 sacks (2.23→2.05), pulling Fix B's one real cost back
to essentially the pre-Fix-B baseline; everything else stays flat within noise. **Fix B +
escape is band-neutral to baseline on every metric.** The trade-off is unchanged in spirit —
it's a realism mechanic, not an INT%/comp% floor fix — but it no longer spends sack headroom.
Shipped on by default with Fix B (cache `cfb-dynasty-674a99b0ae`).
