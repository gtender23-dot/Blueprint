# Viewer Act 2 — Act A complete (2026-08-13)

## Outcome

Viewer Act 2's animation act is complete. A1–A5 now give the 22-player SVG
cast a lawful duel vocabulary, throw/catch vocabulary, secondary weight,
engine-stamped outside-arm exchanges, and real roster-driven body expression.
Every layer remains presentation on top of the recorded football rather than a
second source of football truth.

## Shipped sequence

- **A1 — ball-carrier duel** (`4da43c8`): lawful juke/spin/stiff-arm/hurdle,
  tackle variants, bounded gang-tackle cast, marker dives, and the first body
  input seam in the pure style pickers.
- **A2 — throw and catch** (`810061c`): arrival-lawful catch vocabulary,
  moving-QB release styles, trench silhouettes, and unchanged M21 ball-to-hand
  attachment.
- **A3 — secondary motion and weight** (`eb69997`): bounded shadows, sprint
  compression, gather steps, and carrier-owned pursuit head-checks.
- **A4 — engine-coupled truth**: the M25 tip-drill chain was already shipped
  and CORE-gated before Viewer Act 2, so it was verified rather than duplicated.
  Mid-run outside-arm exchanges now use one post-outcome `armSwitch` stamp. The
  stamp consumes no RNG, is never read by an outcome path, requires at least six
  visible open-field yards, respects the formation side and remaining runway,
  and names the exact live carrier.
- **A5 — body expression**: the shipped identity system's real `heightInches`
  and `weight` now ride the existing compact per-slot viewer maps. Bounded
  lean/balanced/power/massive frames alter proportions, gait timing, lean, and
  presentation-style weighting. They never alter an actor track, ball track,
  contact point, result, or clock. Old unstamped film keeps the legacy frame.

## Truth and performance boundaries

- The simulation owns outcomes. A4 records after resolution; A5 reads identity
  already present on the fielded roster.
- `watchphys.js` owns deterministic, DOM-free presentation selectors and cue
  builders. `sprite.js`, `app.js`, and viewer CSS consume them.
- Actor and ball tracks are regression-compared with the A4 stamp removed and
  A5 body fields stripped; they must remain identical.
- Every scrimmage actor receives exactly one bounded body family. Scheme-fit
  defensive sub-fronts retain their historical 55/55 viewer motion factors
  while gaining the real bodies actually fielded on that snap. M18's full-unit
  kick boards use synthetic role actors rather than roster slot ids and remain
  governed by their separate special-teams animation contract; 11-actor
  2-point/kneel mini-boards likewise retain their own tiny pipeline.
- All arm/body classes are cleared in the existing per-frame sweep. The live
  gate requires zero pre-snap residue.
- The standing two-run `frame_budget_probe` remains the performance veto because
  A5 touches every actor every frame.

## Permanent verification contract

- `tools/arm_switch_ab.mjs` is the CURRENT pass A/B in CORE. Live versus kill
  must be bit-exact for scores, yards, turnovers, play volume, and every recorded
  play after removing only the presentation stamp.
- `tools/viewer_act_a_finish_probe.mjs` gates stamp law, real size identity on
  every fielded slot, body/style coupling, cue construction, and track ownership.
- `tools/viewer_act_a_finish_live_probe.mjs` gates a real locally served build:
  full 22-man scrimmage cast, multiple body families, carrier-owned arm exchange,
  bounded identity values, zero page errors, and zero pre-snap residue.
- The already-shipped `tipdrill_probe.mjs` and `tipdrill_ab.mjs` remain in CORE.
- The A1, A2, and A3 deterministic/live probes remain in CORE as regressions.

## Focused verification at completion

- Act A deterministic finish probe: PASS (191 legal stamps in 826 sampled plays;
  zero stamp, body, cue, or track violations).
- Matched A4 smoke A/B: PASS (1,038 paired plays exact at N=6); the final gate
  runs N=24.
- Canonical Play Now spectator smoke: PASS through both halves and final result,
  with zero page errors.
- Act A live probe: PASS (415 full-cast frames, four body families, six live arm
  exchange samples, zero bad ownership, and 52 clean pre-snap samples).

## Final-tree verification

- Viewer house suite: **12/12 PASS** in 4.9 minutes (watch physics, contact
  authenticity/truth/live sync, locomotion node/live, ball truth/live flight,
  camera plan/live, and officials/broadcast).
- Frame-budget veto: **PASS twice**, with a full 22-player cast and zero page
  errors. Local-Windows p50 was 16.7 ms and 83.4 ms; both stayed inside the
  probe's documented 85 ms allowance. Cross-environment long-task counts remain
  informational, as the stored baseline is from the cloud container.
- CORE product result: **58/59 PASS** in 13.0 minutes. Stat realism, N=24 A4
  matched A/B, all A1–A5 deterministic/live gates, tip-drill feature/A/B, full
  Creator integration/resilience, saves, and the UI trio were green.
- The sole CORE red was the manifest's documented standing `size_fit_probe`
  light-OLB fat-tail boundary, unrelated to Viewer code. Its permitted retry
  double-missed at 0.4–0.5%. Five direct samples measured 0.4%, 0.7%, 0.4%,
  0.5%, and 0.4%: exactly the documented boundary, never materially below it;
  one sample passed all 15 checks. No size-generation or outcome code changed.
