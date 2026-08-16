# Capstone Phase 1 — Render the REAL Play (2026-08-06)

The coach-mode capstone from `Ref/SIM_RESEARCH_PROJECT.md`: the chalk viewer now shows
what the sim actually computed, not a plausible re-enactment. Every mechanic the realism
passes added — separation, leverage, robbers, voids, double moves, coverage assignments —
was being thrown away after the yard count. Now it's recorded and rendered.

## The trace (sim side — pure recording, zero behavior change)

`resolvePassPlay` stamps `result.trace` **before** the catch resolves, so incompletions
and interceptions carry it too (an incompletion is still a real throw to a real man):

| key | meaning |
|---|---|
| `sep` | the chosen throw's separation (0–1), post-rhythm/robber adjustments |
| `shape` | the chosen route's shape (`sharp`/`speed`) |
| `dbl` | the chosen man ran the called double move |
| `vd` | he came open in a zone void |
| `ct` | man or zone on the chosen throw |
| `rob` | the Quarters robber who jumped it (player id), if one fired |
| `covPos` | the covering defender's position (stamped at the play-push site) |

Plus `targetSlotId` at the top level (exact off-field slot, mirroring `carrierSlotId`).
The assigned-coverage entries now also carry `routeDbl` (recording), and the zone-void
block's existing `voided` flag rides through to the chosen target.

Cost: ~60 bytes/play, next to the already-stored `covAssign`/`covSlots`;
`save_weight_probe` shows play data is nowhere near the save's weight (rosters are 57%).

## The render (viewer side — trace preferred, synthesis fallback)

`buildPlayScript` stays decoupled: no imports from sim, and every play without a trace
(old saves, penalties, edge paths) renders exactly as before — the probe strips traces
from 120 plays and all 120 still build.

With a trace:

- **The ball goes to the real target.** `targetSlotId` overrides the synthetic
  target pick (screens included). Probe: 100% of trace renders end with the ball in
  that slot's hands, at the sim's actual yardage.
- **The cover man is the recorded one, at the recorded cushion.** The existing
  `covSlots` man-pair machinery picks the body; the trace's separation now sets his
  trail distance — a blanket at 0.2 sep, beaten by steps at 0.7 (probe: tight-sep
  median ~4u vs open-sep ~11u at the throw). He breaks for the **catch point** on the
  throw instead of chasing the ball in flight — that's the contest/breakup you watch on
  incompletions. Zone-covered targets get the same anticipation from the stamped zone
  body. `script.covId` names him for the probe and any future matchup-highlight UI.
- **The double move is drawn when it fired.** `DBL_SHAPE` maps each base route to its
  double-move twin (slant→sluggo, post→post-corner, out→out-and-up…), applied to the
  target's route when `trace.dbl`.
- **The robber breaks on the throw.** When the sim's Quarters robber fired, the nearer
  free safety abandons his zone at the release and undercuts the catch point.

## Found and fixed along the way

The **called double move was dead code**: the F4 pass gated it on TEC ≥ 70, but tier-1
rosters top out around 68 — Sluggo Seam never actually ran its sluggo. The gate is
gone: on a called double-move concept the featured man always runs it (a receiver
doesn't refuse the play; he sells it worse), and `sepgeo`'s existing `dblLag` — scaled
by his TEC vs the defender's AWR, floored at zero — prices the craft. stat_realism is
unmoved (comp% 57.8, ypa 7.19, all deltas noise; same three pre-existing off-band flags).

## Verification

New `tools/play_trace_probe.mjs` (7 checks): trace coverage >85% of pass plays ·
ball-in-hands 100% · yardage 100% · cushion-follows-separation · defender-on-ball on
incompletions · fallback 120/120 · double moves recorded. Plus: playbook_build_probe ·
watchphys_probe (RUNG 7A, incl. same-play-same-film determinism) · watch_live_probe ·
coach_mode_halftime_smoke · save_weight_probe · stat_realism (no regression) · build +
boot 0 pageerrors.

## What remains of the capstone

**Phase 2 (8-bit art)** is largely delivered by the sprite pass (directional bodies,
odometer legs, side-view skeleton). **Phase 3 (play-mode — steer the QB, aim the
throw)** stays open and optional; it's the fork in identity, and Phase 1 was its
prerequisite. Natural Phase-1 follow-ons when wanted: a matchup-highlight UI using
`script.covId`, and run-side trace flourishes (the run render already uses the real
carrier, option phase, and direction).
