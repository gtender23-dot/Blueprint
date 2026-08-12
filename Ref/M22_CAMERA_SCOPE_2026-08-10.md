# M22 scope — camera and replay (2026-08-10)

Base build: cut against **`b849355765`** or later (M21 ball mechanics), per
the M21 handoff. Files expected to change: `js/ui/watchphys.js` (a pure,
node-testable camera plan), `js/ui/app.js`, `style.css` (minor), new probes
in `tools/`. **Zero engine writes** — M22 is presentation only; there is no
recording-only stamp this time because every anchor the camera needs
(catch point, end point, turnover moment, celebration) is already in the
script's cues.

## Source goals

From `Ref/animation goals.txt` — "Broadcast-quality camera":

- Anticipatory tracking that leads the play instead of chasing it.
- Smooth acceleration and braking. *(M20 slice — scrimmage only; the two ST
  boards still raw-chase)*
- Contextual zoom for deep throws, returns and goal-line plays.
- Stable framing at the snap. *(M20 — must survive unchanged)*
- Controlled camera movement during turnovers.
- Short celebration hold before advancing.
- Replay camera with cleaner framing and slower contact moments.
- Scoreboard and overlays permanently constrained outside playable space.

## What already exists (M20/M21 baseline)

- Scrimmage board: slew-limited pan/zoom (accel caps + deadzone), static
  pre-snap framing, reactive focus (ball → catch window → tackle window),
  zoom tightening at catch/tackle, `opts.replay` = tighter frame + uniform
  0.68× speed. Camera/replay bugs ("LIVE"/"REPLAY", "INSTANT REPLAY") exist.
- The replay scheduler (`replayWorthy` in the watch loop) budgets wall time
  as `scriptDur/(speed*0.68) + 1050ms` — any replay timing change must stay
  inside that budget.
- Both ST boards pan with a raw `camX += (target-camX)*0.1` exponential
  chase at fixed zoom.
- fx cards (flag detail, TD banner) are placed at play coordinates and can
  straddle the frame edge; the scorebug/chrome is DOM outside the SVG.
- The M21 ball block renders the ball off its own transform — a camera that
  frames the ball must read the RENDERED transform (per the M21 handoff).

## Work items

**A. The camera plan — pure and probed (watchphys.js)**
1. `buildCameraPlan(script, p, opts)` — a deterministic, DOM-free plan built
   from the script's own cues, exporting `anchorAt(t)` (world anchor incl.
   anticipatory lead), `hAt(t, ctx)` (zoom-height target), `settle`
   (turnover window), `hold` (celebration window), and `warpAt(t)` +
   `warpSegs` (replay time-warp). The app's tick consumes the plan; the node
   probe asserts on it directly. The M20 slew integrator stays in app.js and
   still owns smoothness.

**B. Anticipatory tracking (lead, not chase)**
2. Passes: from the QB's windup (`throwCue.start`), the anchor eases toward
   the KNOWN catch point (the script has it before the ball is thrown) —
   the camera frames the throw's destination like a broadcast camera reading
   the QB's eyes. During flight the lead deepens; at the catch the anchor is
   the catch point.
3. Runs and YAC: the anchor leads the ball toward the play's KNOWN end point
   (capped lead along the travel direction) instead of centering the ball.
4. Pre-snap: anchor pinned to the LOS spot — the M20 motionless-snap law is
   preserved by construction.

**C. Contextual zoom**
5. Deep throws: widen with ball↔destination spread (keeps both in frame),
   tighten through the catch. Goal-line: when the play lives inside the low
   red zone, hold the tight frame. Both from the plan, slew-limited as ever.
6. Returns: the two ST boards get the M20 slew-limited pan (replacing the
   raw chase) and a gentle return-phase tighten — kick flight stays wide,
   the runback reads closer. No ST timing/classes touched.

**D. Turnovers + celebration**
7. Turnover settle: for ~0.8s after an INT/fumble the anchor holds at the
   turnover spot and pan velocity is halved — the direction flip becomes a
   controlled cut, not a whip. Then normal tracking of the return.
8. TD celebration hold: from the celebrate cue the anchor parks on the
   celebrant with a tight frame through the linger — a short hold before the
   next play advances (no scheduler change; the hold lives inside `dur`).

**E. Replay presentation**
9. Slower contact moments: in replay mode playback time is WARPED — slow
   (≈0.45×) windows around the catch, the tackle impact, the staged broken
   tackle and the strip; compensated (slightly faster) outside the windows
   so the TOTAL replay duration is unchanged and the scheduler's wall-time
   budget still holds exactly. Live playback is untouched (warp ≡ 1).
10. Cleaner framing: replays already tighten; the plan's catch/tackle
    anchors + warp give the replay its "hang on the moment" read.

**F. Overlays outside playable space**
11. fx cards and result texts clamp INSIDE the current camera frame at
    spawn (cards fully visible, never bisected by the frame edge, never on
    top of the far sideline chrome). The scorebug is already DOM-outside.

## Engine data — non-needs

Nothing. Catch point, end point, turnover time, celebrant, break/strip
moments are all already in the script (`fx`, `throwCue`, `tackleCue`,
`celebrateCue`, `breakCue`, `stripCue`, `ballCue`). If a future milestone
wants camera hints the sim alone knows (e.g. "this was a designed shot
play"), that is a recording-only stamp then — not needed now.

## Probes (ship WITH the kit, manifest full tier)

- `camera_plan_probe.mjs` (node, deterministic — **pins Math.random**, NOT
  seedFlaky): over harvested real plays — pre-snap anchor static (M20 law);
  the anchor LEADS (during flight it sits between ball and catch point and
  converges on the catch point; on runs it sits ahead of the ball toward the
  end point, never behind the play); zoom heights bounded and tighter at
  catch/tackle/goal-line than the wide base; turnover plays carry a settle
  window at the turnover moment; TD plays hold the celebrant; replay warp
  integrates to `dur` (±0.02s — budget-neutral) and its slow segments cover
  the contact cues; plan is deterministic on rebuild.
- `camera_live_probe.mjs` (pw): in the built game — viewBox motionless
  through the cadence; per-frame pan/zoom deltas bounded (slew law, no
  whip/jitter — including across a turnover if one is seen); the RENDERED
  ball stays inside the viewBox with margin on ≥97% of in-play samples (the
  point of tracking); ST boards' viewBox deltas also bounded. Replay
  sightings (slow-mo active, REPLAY bug on) are reported informationally —
  per the M15/M18 lesson, phase absence under throttled rAF never fails.
- `frame_budget_probe` (standing): before/after, no re-baseline.

## Exit criteria

1. Both new probes green; full core gate green; watchphys/ball/contact/
   locomotion probes untouched-green (plan is additive; tracks unchanged).
2. Snap framing motionless; no whip at turnovers; ball containment ≥97%.
3. Replay wall-time budget-neutral (warp integral = dur), verified
   deterministically.
4. Frame budget: no regression vs the pre-M22 measurement in this container.

## Non-goals (explicit)

Replay wipes/indicator graphics beyond the existing bugs, drive summaries,
scoring banners, lower thirds (M23 broadcast graphics) · officials/crowd/
stadium life (M23) · alternate angles or true multi-camera cuts (out of
scope entirely — one broadcast side view is the game's language) · any
engine work.
