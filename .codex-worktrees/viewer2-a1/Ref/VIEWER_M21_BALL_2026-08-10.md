# Viewer M21 — ball mechanics (2026-08-10)

Authored in-house (Claude cloud session) against mainline `a55d2f34a2` (the
M20 contact build), per `Ref/M21_BALL_SCOPE_2026-08-09.md`. Same situation as
M20: no kit/merge loop, the build is compiled directly from this source tree.
Build hash: **`b849355765`**.

## The headline: the ball is an owned object

Before M21 the ball was a tracked icon — it rode the CENTER of whoever "had"
it (visually at the sprite's feet), flew as an unoriented wobble, landed
wherever the receiver's steering left him, never reacted when a defender
played it, and fumbles wiggled on a sine. The engine already recorded who
tipped and who picked every pass; the viewer ignored both.

M21 adds ONE engine touch: a **recording-only** `ballSlots = { pbu, pick }`
stamp in `sim.js` (player→slot translation of `pbuId`/`intPickerId`), in the
same `plays.push` block and under the same comment contract as
`contactSlots` — no outcome path reads it, and the gate's stat bands ran
clean. Everything else is viewer-only.

## Content, by scope work item

- **A. Possession rendering** — new `ballCue` (phase labels: snap window,
  QB hold, mesh window, PA fake, release, catch) and `carryCue` (who carries,
  from when, which arm — sideline-protection rule). The render layer attaches
  the ball to the possessing sprite's HANDS: QB chest during the hold,
  throwing shoulder during `wp-qb-load` (windup), facing-aware carry-arm
  offset for carriers, low beside the body once tackled-down. Attachment is
  render-only with a proximity guard (snaps feet→hands, never yanks across
  the screen); the ball TRACK is untouched, so the outcome law reads the
  same script.
- **B. Exchanges** — gun snaps tumble (`wp-ball-snap`); PA fakes extend the
  ball toward the faking back and withdraw it (sine ease in `ballPlan`);
  **the exchange window now scales with the real gap at the mesh/pitch
  frame** — a back in the hip pocket keeps the 0.14s belly handoff, a wide
  carrier (Flexbone/Power-I wings) gets a pitch-length flight the ball can
  cover. The old fixed windows teleported the ball 20+ units and the speed
  cap smeared it backward through the pre-snap frames (probe-found; same
  class of defect fixed for wildcat-formation snaps via a lateral term in
  `SNAP_T`, and for the deepest crossfield throws via a flight-time floor at
  47u/s).
- **C. Flight** — new `wab-aim` group in `ballMarkup`, JS-rotated per frame
  so the nose tracks the RENDERED motion (lift included): nose-up on the
  climb, nose-over on the descent. `wp-ball-air` is a tight spiral (fast
  roll + lace/highlight shimmer) instead of the ±9° wobble. Release and
  arrival BLEND: the ball leaves the QB's hand (first ~14% of flight) and
  lands in the catcher's hands (last ~15%) — no pop at either end.
- **D. Ball truth** — a stamped PBU stages the credited defender's swat
  (reuses the M20 strip pose) and BREAKS the trajectory: seeded tumble off
  the catch point to the turf (`wp-ball-tipped`). A stamped pick is made by
  the credited slot actor. Both are gated by an arrivability rule (drift ≤
  0.28u/frame from the snap): a credited man who can't plausibly arrive from
  this front's alignment falls back to the old behavior rather than
  teleporting — the same graceful degradation as a slot missing from the
  front. The pin spans reach back to the snap so `capTrackSpeed` can't drag
  the swat off the ball (the M20 order lesson, re-learned by probe).
- **E. Fumbles** — `tumbleLoose()`: seeded erratic decaying hops (both run
  fumbles and strip-sacks) that die back EXACTLY at the engine's spot — run
  fumbles stay inside the outcome law, verified.
- **F. Kicks (CSS only)** — the punt now SPIRALS (nose precession + roll)
  instead of tumbling end-over-end; place kicks/kickoffs keep their correct
  end-over-end, onside keeps the erratic tumble. No ST board JS touched.

Files: `js/engine/sim.js` (recording-only stamp) · `js/ui/watchphys.js` ·
`js/ui/app.js` · `js/ui/sprite.js` (wab-aim group) · `style.css` · two new
probes + manifest registration.

## Probes installed (manifest full tier)

- `ball_truth_probe.mjs` (node, deterministic — **pins Math.random**, NOT
  seedFlaky by construction): ~550 real engine snaps/4 games — ballCue on
  every script (553/553), snap flight reaches the taker (553 checked, 0
  bad), handoff hold/ride continuity (187 checked, 0 bad), no ball teleport
  (max 2.50u/frame), PA fakes keep the ball with the QB (38/38), stamped
  PBUs stage the credited swat on arrivable fronts (33/49 staged, 0
  misplaced; the rest fall back by the arrivability rule), tipped balls
  scatter + rest (33/33), pick rider owns the ball with credited man kept
  when arrivable (3/5 kept, 0 ride misses), run fumbles bounce and die at
  the engine spot (5/5), deterministic rebuild (0 mismatches/73).
- `ball_flight_live_probe.mjs` (pw): in the built game — **hands meet ball
  at the catch point** (7/9 catches closed to ≤2.6u of the hands band),
  carried ball rides the hands band never the feet (0 violations/130
  samples), airborne ball noses along its own flight (17 ok / 0 bad), plus
  phase reporting (air, snap tumble, tipped, punt spin all observed live).
  Nothing is windowed on normalized play time; phase absence is reported,
  never failed (M15/M18 lesson).

## Gate

- Full core gate on the final tree: **GATE PASSED — 19 OK, 0 flaky-cleared,
  0 env-known, 0 FAIL, 8.3 min** (includes stat_realism 500 — the
  `ballSlots` stamp is band-clean — plus pass7_band_ab 300 and the UI trio).
- `watchphys_probe` (RUNG 7A outcome-truth law): **full PASS** — 812 snaps,
  the ball dies where the engine said on every one (±0.12u), no teleports
  (p99 9.9 u/s), deterministic.
- M20 regression: `contact_truth_probe` 11/11 (596 tackler + 172 assist
  matches, 43/43 breaks, 495/495 pass-pro) and `contact_sync_live_probe`
  all PASS. M19: `locomotion_probe` + `locomotion_live_probe` green.
- `frame_budget_probe`: pre-M21 reference in this container p50 16.7ms / 31
  longtasks; post-M21 **p50 16.7ms / 31 longtasks — no regression** (the
  recorded pre-M20 baseline file is untouched).
- Boot: 0 pageerrors.

## Env notes

- Cloud rAF throttling remains the standing caveat for pw probes; the live
  probe samples states opportunistically and its two alignment laws gate
  while phase sightings are informational.
- The probe corpus surfaced three PRE-EXISTING track-smear defects (wide-
  carrier mesh, wildcat snap, max-range throw) that only became visible once
  a probe asserted ball continuity — all three fixed at the source (scaled
  windows), not papered over in the probe.

## Handoff

Next milestone (**M22 — camera and replay**, per the animation-goals order)
must be cut against build **`b849355765`** or later. Notes for M22:

- The M20 camera slice (slew-limited pan/zoom, stable snap framing) is the
  base; M22 adds anticipatory lead, contextual zoom and replay presentation
  on top of it — the constants live at the top of `watchBoardScrimmage`.
- The ball's rendered position now diverges from `script.ball.track` inside
  possession phases (hand attachment + flight blending, all inside the
  M21 ball block in app.js `tick`). A replay camera that frames the ball
  should read the RENDERED transform, not the raw track sample.
- `script.ballCue` phase labels (snap/hold/mesh/fake/release/catch) are
  exactly the beats a broadcast camera wants to anticipate; `carryCue.from`
  is the moment the new ball-carrier becomes the story.
