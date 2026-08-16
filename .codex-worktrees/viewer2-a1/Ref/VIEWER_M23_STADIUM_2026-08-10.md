# Viewer M23 — stadium and broadcast (2026-08-10)

Authored in-house (Claude cloud session) against mainline `a0650ce12d` (the
M22 camera build), per `Ref/M23_STADIUM_SCOPE_2026-08-10.md`. Same situation
as M20–M22: no kit/merge loop, compiled directly from this source tree.
Build hash: **`3dc35a2328`**.

## The headline: the game gets its officials — and a stadium that reacts

The field had a rich static stage (crowd, benches, chain crew, pylons, team
end zones) but nobody officiating, no visual crowd response, no goalposts,
and no broadcast presentation beyond in-field fx text. M23 fills exactly
those gaps. **Zero engine touches.**

## Content, by scope work item

- **A. Officials** — `buildOfficialsPlan(script, p)` in `watchphys.js`:
  pure, DOM-free, deterministic, and NEVER part of `script.actors` (the
  22-actor law is probe-pinned). A 3-man crew — R in the near-side
  backfield, U on the far side, LJ riding the near sideline — whose tracks
  are precomputed at the script's step: speed-capped target chasing (no
  teleports when the ideal spot jumps) plus a HARD stand-off vs the current
  ball, so the crew is smooth AND never inside the play. The LJ's lane is
  fixed; his stand-off slides him ALONG the sideline. Signals map the
  play's fx to poses: touchdown arms, first-down point (LJ), incomplete
  wave, spot signal, change-of-possession roll, flag. Rendered as three
  lightweight zebras placed per frame.
- **B. Crowd life** — fans carry section classes (home/away/neutral); on a
  live TD the scoring side's sections ERUPT (fast tall bounce) while the
  other side sags (`watch-roar-*`/`watch-groan-*`, fired beside the
  existing `stadiumReact` audio); turnovers flip it to the defense's crowd.
  The crowd band (pattern + ribbons + fans — nothing field-registered)
  parallaxes at 0.12× the camera pan on the scrimmage AND both ST boards.
- **C. Chains move** — on the first-down fx the chain crew and the down box
  WALK to the new spot (1.4s eased translate + hustle bob): the sticks
  visibly reset.
- **D. Goalposts** — top-down forks at both end lines in `watchFieldBase`
  (every board inherits); on a made FG/PAT the target fork takes a net
  shake at the ball's arrival.
- **E. Broadcast presentation** — TOUCHDOWN / INTERCEPTED! / FUMBLE! banner
  (DOM strip over the crowd band, team-colored, OUTSIDE the playable field
  per the M22 safe-area rule; live only, replays never re-present) and a
  one-shot diagonal replay WIPE when a replay board takes over (the M22
  handoff's hook).

Files: `js/ui/watchphys.js` (buildOfficialsPlan — additive) · `js/ui/app.js`
· `style.css` · two new probes + manifest registration. **No engine files
touched.**

## Probes installed (manifest full tier)

- `officials_plan_probe.mjs` (node, deterministic — **pins Math.random**,
  NOT seedFlaky): 526 plans/4 games — 3-man crew on every script, cast
  stays exactly 22, pre-snap static, **stand-off law min 4.20u (0
  violations)**, no teleports (max 2.15u per 0.1s — the first cut pushed
  radially and jumped 8.9u; the track rewrite fixed it), LJ pinned to the
  sideline, signals cover all 677 fx checks, deterministic rebuild.
- `broadcast_live_probe.mjs` (pw): 332 scrimmage samples — 3 officials on
  every one, rendered stand-off min 4.14u (0 near), legal down box 332/332,
  fan sections present, goalpost forks 332/332, parallax correlation 17/17
  once the baseline invalidates across sampling gaps (an rAF gap orphans
  the pre-snap baseline — probe lesson, documented in-file). Roar, banner,
  chain-walk, wipe, net-shake and four signal kinds all SIGHTED live across
  runs; sightings are reported, never gated (M15/M18 lesson).

## Gate

- Full core gate on the final tree: **GATE PASSED — 18 OK, 1 flaky-cleared
  (size_fit, the standing documented entry), 0 FAIL, 7.7 min.**
- Regression: watchphys RUNG 7A full PASS (22-actor + outcome laws
  untouched) · ball_truth 11/11 · camera_plan 14/14 · contact_truth 11/11 ·
  camera_live 6/6 · ball_flight_live 5/5 · contact_sync_live 7/7.
- `frame_budget_probe` (idle container): p50 16.7ms / 29 longtasks vs
  reference 16.7 / 31 — **no regression** (three zebras + a parallax
  transform are noise); baseline untouched.
- Boot: 0 pageerrors.

## Env notes

- The parallax correlation check must invalidate its baseline whenever the
  sampling stream gaps (ST plays, board dispatches) — under throttled rAF
  the next pre-snap can be skipped entirely and a stale baseline reads as a
  false mismatch. The probe now requires a fresh pre-snap after any gap.
- Sightings vary per window (one run saw roar+banner+wipe+net-shake, the
  next saw chain-walk+flag-signal instead) — exactly why they report
  instead of gate.

## Handoff

Next milestone (**M24 — variation and optimization**, per the
animation-goals order: equipment/body variety, alternate catch/tackle
outcomes, celebration variants, exhaustion body language, 60 FPS, full
regression coverage) must be cut against build **`3dc35a2328`** or later.
Notes for M24:

- The signal system (`wpo-sig-*`) and crowd reaction classes are natural
  variation points (celebration variants per position/situation can ride
  the same fx→class pattern the officials use).
- Officials are 3 extra per-frame transforms + the parallax write; if M24's
  optimization pass builds a per-frame cost budget per layer, they belong
  in the "stadium" bucket.
- The animation-goals "visual regression testing" block (screenshots per
  formation, mirrored-equipment checks, foot-sliding measurement) is
  M24's probe workload — the plan-probe pattern (pure builder + node
  contract + pw sighting split) is the house template by now.
