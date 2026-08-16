# Animation goals — coverage matrix (2026-08-10)

The program-closing map: every block of `Ref/animation goals.txt` → the
milestone that shipped it → the probe that guards it. M19–M24 are COMPLETE;
each milestone's full detail lives in its `VIEWER_M*` report. Items the
goals doc itself deferred ("eventually", "later option") are marked OPEN.

**M25 update (2026-08-10):** the owner asked for the OPEN list to be
finished. M25 shipped turf spray, weather/worn fields, band/mascot set
pieces, player-ID lower thirds + drive summaries, and tip-drill INT chains
(see `Ref/VIEWER_M25_FINISH_2026-08-10.md`). Play-clock urgency was cut by
the owner mid-scope and stays OPEN. The per-block OPEN notes below are
annotated where M25 closed them.

## Milestone chain (each cut against the previous build)

| M | Milestone | Report | Final build |
|---|---|---|---|
| M19 | Locomotion | VIEWER_MERGE_M18-19_2026-08-09.md (Codex) | 8148deb3f0 |
| M20 | Contact | VIEWER_M20_CONTACT_2026-08-09.md | a55d2f34a2 |
| M21 | Ball mechanics | VIEWER_M21_BALL_2026-08-10.md | b849355765 |
| M22 | Camera + replay | VIEWER_M22_CAMERA_2026-08-10.md | a0650ce12d |
| M23 | Stadium + broadcast | VIEWER_M23_STADIUM_2026-08-10.md | 3dc35a2328 |
| M24 | Variation + optimization | VIEWER_M24_VARIATION_2026-08-10.md | 77479ac27d |
| M25 | Finish the open list | VIEWER_M25_FINISH_2026-08-10.md | (this pass) |

## Goals blocks → coverage

**True locomotion system** — M19 (Codex). Guard: `locomotion_probe` (15
controller contracts) + `locomotion_live_probe`.

**Directional animation coverage** — sprite passes + M19 facing hysteresis.
Guard: `locomotion_probe`, `sprite_gallery` (tool), `uniform_identity_probe`.

**Position-specific movement** — M13 QB mechanics, M19 profiles, M20 sets.
Guard: `qb_mechanics_probe`, `qb_live_probe`, `presnap_stance_probe`.

**Football-contact system** — M20. Guard: `contact_truth_probe` (truth
staging, pile caps, breaks) + `contact_sync_live_probe` (proximity-gated
impact, grounded holds, engagement facing).

**Ball ownership and flight** — M21. Guard: `ball_truth_probe` (snap/mesh/
PA/deflection/pick truth/fumble bounce) + `ball_flight_live_probe`
(hands-meet-ball, hands-band carry, flight aim). M25: tip-drill INT chains
— the M21-flagged engine extension, shipped: the deep helper/robber can
pick a swatted ball (`C.TIP_DRILL_INT`, `__noTipDrill` gate); tipper keeps
the PBU, picker books the INT, and the viewer stages tip → carom → pick.
Guard: `tipdrill_probe` (deterministic) + `tipdrill_ab` (stat A/B).

**Broadcast-quality camera** — M22 (+ M20 slice). Guard:
`camera_plan_probe` (lead/zoom/settle/hold/warp laws) + `camera_live_probe`
(motionless cadence, no whips, containment). Replay slow-contact = the
budget-neutral warp.

**Depth and layering** — sprite passes (front-to-back sort, ball z-order,
shadows). Guard: `sprite_gallery`, `watch_live_probe`; ball layering in
`ball_flight_live_probe`.

**Turf interaction** — M25: turf spray on hard cuts (read off the finished
carrier track) and tackle landings, deterministic and capped ("kept
restrained" honored — max 3 cut bursts + 1 tackle burst per play), weather-
aware pellet color, hidden under `.watch-lite`. Guard:
`presentation_live_probe` (sighting) + the fx pattern is `wp-contact-dust`'s.
Contact dust pre-existing.

**More animation variety** — M24: celebration variants by situation +
teammate mob, exhaustion (winded), heads-to-the-ball, bench reactions.
Pre-existing: alternate catch outcomes (M12/M20), tackle styles (M20),
idle stances by profile. Guard: `variety_probe` + `variation_live_probe`.
Injury body language beyond `wp-injured`: OPEN (minor).

**Stadium life** — M23: officials + signals, chain crew movement, crowd
sections + reactions, parallax, goalpost net reaction, benches (M23/M24).
Guard: `officials_plan_probe` + `broadcast_live_probe`. M25: band block in
the home stands (parallax group, plays on the home roar) + one mascot per
sideline (field-locked, wild on his side's roar) — the M23 reaction rails,
no new system. Guard: `presentation_live_probe` (structural). Stadium
architecture packages: OPEN.

**Field polish** — pre-existing (team end zones, rotated lettering,
pylons, hashes/numbers, midfield mark) + M23 goalposts. Guard:
`variation_live_probe` (end-zone stability), `broadcast_live_probe`
(forks, down box). M25: per-game deterministic weather (clear/rain/snow,
hashed from matchup + calendar day — presentation only, the sim never
reads it) with CSS-looped precipitation, wet sheen / snow veil, and a worn
middle that ages with the game clock off one seeded stream (Q4 = Q1 + more
wear, nothing teleports). Guard: `presentation_live_probe` (structural).
Weather-sensitive FOOTING stays OPEN (goals doc: "later option").

**Broadcast graphics** — scorebug/possession (pre-existing DOM), M23
banners + replay wipe, M22 safe-area clamps. Guard: `broadcast_live_probe`
sightings + `camera_live_probe` containment. M25: player-ID lower thirds
(the featured man of a big moment — name, position, on-screen jersey via
the slot stamp → `data-jersey` join, his running line for the game) and
drive-summary lower thirds (plays/yards/clock consumed) in `#watch-lower`,
safe-area, live-only. The "name plumbing" the M23 non-goal wanted already
existed on the play record — M25 just joined it. Guard:
`presentation_live_probe`. Play-clock urgency: OPEN (owner cut,
2026-08-10 — still no play clock in the viewer).

**Audio synchronized to graphics** — pre-existing `stadiumReact` at fx
moments (M23 added the visual side). Guard: `stadium_audio_probe`.

**Player-model improvements** — sprite passes (anatomy, uniforms,
equipment variation, builds). Guard: `sprite_gallery`, `portrait_probe`,
`uniform_identity_probe`, `size_fit_probe`.

**Animation state controller** — M19 (loco states) + the cue system
(M9–M24). Guard: `locomotion_probe` mutual-exclusion contract.

**Path smoothing** — watchphys constraints + separation + M20 sweeps.
Guard: `watchphys_probe` (teleport law), `contact_truth_probe` (no
co-located bodies).

**Frame pacing and performance** — M20 standing gate + M24 panning pause
and auto-lite. p50 16.7ms at 22 actors in a SOFTWARE-rendered container
(≈60 FPS budget met with margin on real hardware). Guard:
`frame_budget_probe` vs `_frame_budget_BASELINE.json` (idle-container
measurements only — the M22 lesson). Element pooling across plays:
REJECTED by design (state-leakage law beats reuse).

## The goals doc's "visual regression testing" list, itemized

| Item | Guard |
|---|---|
| Screenshots per formation/play family | `sprite_gallery`, `scheme_block_gallery`, `position_gallery` (tools) + live-probe shots per milestone |
| Missing limbs / wrong colors / mirrored equipment | `sprite_gallery` + `uniform_identity_probe` |
| Foot-sliding measurement | `locomotion_probe` (odometer/ground-phase contract) |
| Ball-to-hand alignment | `ball_flight_live_probe` (KEY check) |
| Contact-distance checks | `contact_sync_live_probe` |
| Camera + scoreboard safe-area | `camera_live_probe` + M22/M23 clamps |
| Home/away + left/right orientation | `variation_live_probe` (both directions gated) |
| End-zone color and lettering stability | `variation_live_probe` (gated) |
| Animation-state leakage between plays | `variation_live_probe` (THE LAW, gated) |

All registered in `tools/_gate_manifest.mjs` (full tier); the deterministic
node probes pin `Math.random` and never sit on the seedFlaky list.
