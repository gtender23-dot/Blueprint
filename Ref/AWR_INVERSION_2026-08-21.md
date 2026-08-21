# The deep-zone awareness inversion — fixed 2026-08-21

The oldest confirmed sim defect in STATUS (Codex review #10, "fix pending in
sepgeo.js"). A defender with **higher zone awareness played deep coverage
looser**, in a straight line.

Measured on 40,000 duels per point, before:

```
zone/deep  AWR: 20→0.218  40→0.306  60→0.395  80→0.595  99→0.596
```

Separation *rises* with awareness. For reference, medium zone was already
correct: `20→0.722 … 99→0.434`.

## Why it survived seven months

**`coverage_monotonicity_check` never called `process.exit`.** It always
exited 0, so the gate always marked it OK — while printing
`HELPS THE RECEIVER (INVERTED)` on every single run. A probe that reports a
defect and cannot go red is a log line, not a gate. It was sitting in the full
tier reporting this defect the whole time, including in the 2026-08-21 sweep
where it appears in the OK column.

## The fix

A mean-neutral awareness term already existed from 2026-08-14 — the right idea
at roughly a fifth of the size it needed to be. It bent the curve by about
**0.15** across the AWR range against a raw inversion of **0.53**, so the net
still ran the wrong way.

The coefficient is now **0.0103**, and it is derived rather than guessed: it is
the value that gives deep zone the same awareness slope medium zone already
has.

| | slope across AWR 20→99 |
|---|---|
| zone/medium (reference) | −0.00365 |
| zone/deep, before | **+0.00478** |
| zone/deep, after | **−0.00362** |

After:

```
zone/deep  AWR: 20→0.470  40→0.390  60→0.311  80→0.343  99→0.184
```

Still exactly 0 at AWR 50, so the average defender is untouched and only the
spread moves — a heady deep safety gives up less, a raw one more.

## The A/B — no measurable league effect at this sample size

60 team-games per arm, matched RNG, sixteen front assignments. Run twice, once
at the standard 40/40/20 pass distribution and once at 35/40/25 to stress the
deep game:

| metric | standard: before → after | deep-heavy: before → after |
|---|---|---|
| comp% | 53.26 → 53.04 | 51.86 → 51.38 |
| ypa | 6.78 → 6.74 | 6.89 → 6.61 |
| pass yds/team | 227.1 → **236.3** | 234.1 → **219.9** |
| INT% | 2.78 → **2.38** | 3.24 → **3.66** |
| sacks/team | 2.15 → 2.32 | 2.43 → 2.45 |

**The two runs disagree in SIGN on pass yards and on INT%.** That is noise at
n=60, not signal, and it is the honest read: the change is mean-neutral by
construction and the league-wide effect depends only on how far the average
deep defender's AWR sits from 50. Only comp% (slightly down) and sacks
(slightly up) point the same way in both runs, and both by less than the spread
between the runs.

**`stat_realism` at N=500 on the owner machine is the gate.** Watch comp%
specifically: it is already a standing LOW flag, and both runs nudged it down.
If 500 says this pushes comp% out of band, the honest lever is the coefficient
— 0.0085 still fixes the direction at about half the slope.

## Honest limit

This corrects the direction and the slope, **not the mechanism.** The deep
duel's arming is positional — the defender triggers when the receiver reaches
his depth — and that is what washes his eyes out down the field. The middle of
the curve stays bumpy (AWR 80 sits slightly above AWR 60) because of it.
Fixing the arming is the real repair. This makes the football right while that
waits, and `coverage_monotonicity_check` will now prove it when someone does.

## Gate

`coverage_monotonicity_check` now exits non-zero when any sweep helps the
receiver, and carries a manifest note. Green today, so wiring it adds no red.

`time_to_throw_probe` has the SAME hole — no `process.exit`, and it printed
"⚠ FAIL" in the 2026-08-21 sweep while being counted OK. Left alone
deliberately: wiring it would add a red for a defect nobody has looked at yet.
It should be either fixed or honestly flagged, not left half-reporting.
