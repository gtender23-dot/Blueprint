# M23 scope — stadium and broadcast (2026-08-10)

Base build: cut against **`a0650ce12d`** or later (M22 camera), per the M22
handoff. Files expected to change: `js/ui/watchphys.js` (a pure officials
plan), `js/ui/app.js`, `style.css`, new probes in `tools/`. **Zero engine
writes** — presentation only.

## Source goals

From `Ref/animation goals.txt` — "Stadium life", "Field polish" and
"Broadcast graphics", scoped to what the audit found actually missing.

## What already exists (verified in `watchFieldBase` + shell, 2026-08-10)

Crowd pattern + 118 animated fans (`wf-fan-motion`, per-fan phase), stadium
ribbons in team colors, benches (7 men per side in team fills), chain crew +
first-down disc at the stick, down box with the live down number, goal-line
pylons, team end zones with correctly rotated lettering, midfield shield,
mow strips/hashes/numbers both sidelines, `stadiumReact` (AUDIO only),
scorebug + drive chrome DOM-outside the SVG, `watch-flash` overlay, REPLAY
bugs, and the M22 camera plan hooks (`hold`, `settle`, `warpSegs`).

## The gaps M23 fills

1. **Officials — there are none.** No referee anywhere on the field.
2. Crowd reactions are audio-only; fans never visually react, and no
   section identity (home fans vs visiting fans) is expressed in motion.
3. The crowd band pans 1:1 with the field — no depth (parallax).
4. No goalposts on any board — field goals sail through empty air.
5. The chain crew and down box never move (goals: "chain crew and down
   marker movement").
6. No scoring/turnover presentation beyond the in-field fx text; no replay
   wipe (M22 left the hooks).

## Work items

**A. Officials (pure plan + light render)**
1. `buildOfficialsPlan(script, p)` in watchphys.js — DOM-free,
   deterministic, NOT part of `script.actors` (the 22-actor law is
   untouched): a 3-man crew (R near-side backfield, U far side, LJ riding
   the near sideline at the sticks) whose positions derive from the ball
   track with per-official lag/trail, a hard minimum stand-off from the
   ball (officials NEVER inside the play), board clamps, and a signals
   list mapped from the play's fx (touchdown arms, incomplete wave, first
   down point, sack/tackle spot, penalty).
2. Render: 3 lightweight zebra sprites (`wp-official`, striped torso, cap)
   placed per frame from the plan; signal poses are CSS classes fired at
   the fx moments. Flag toss stays the existing fx.

**B. Crowd life**
3. Section identity: fans get `wf-fan-home/away/neutral` classes (fills
   already team-colored).
4. Visual reactions beside the audio: board-level `watch-roar-home`,
   `watch-roar-away`, `watch-groan-*` classes fired at the same tick sites
   as `stadiumReact` — the SCORING side's sections bounce, the other side
   sags; turnovers flip it (defense's crowd erupts).
5. Parallax: the crowd band (background pattern + ribbons + fans — nothing
   field-registered) wraps in one group translated by a fraction of the
   camera pan each frame, on the scrimmage AND both ST boards. Benches,
   chains and everything aligned to yard lines stay field-locked.

**C. Chain crew and down marker movement**
6. On the first-down fx the crew and the down box WALK to the new spot
   (CSS-transitioned group translate to the dead-ball x) and the box flips
   with a pulse — the sticks visibly reset when the chains move.

**D. Goalposts (+ net reaction)**
7. Top-down goalpost forks at both end lines in `watchFieldBase` (all
   boards inherit). On a made FG/PAT the target fork shakes
   (`watch-net-shake`) at the ball's arrival — the net reaction, scoped to
   the FG board where the kick actually arrives.

**E. Broadcast presentation**
8. Scoring/turnover banner: a DOM strip in the board wrap (over the crowd
   band, OUTSIDE the playable field — the M22 safe-area rule), slides in
   on live TD / INT / fumble-lost with the team identity, auto-hides.
   Replays don't re-banner.
9. Replay wipe: a one-shot diagonal wipe overlay when a replay board
   starts, alongside the existing REPLAY bugs (the M22 handoff's hook).

## Engine data — non-needs

Nothing. Down, distance, possession, td/turnover, made kicks and every fx
moment are already on the play object and the script.

## Probes (ship WITH the kit, manifest full tier)

- `officials_plan_probe.mjs` (node, deterministic — **pins Math.random**,
  NOT seedFlaky): over harvested real scripts — every scrimmage script
  yields a 3-man plan; positions finite/on-board at all sampled times;
  pre-snap static; the stand-off law holds at EVERY sampled t (no official
  ever closer to the ball than the minimum); officials move smoothly (no
  teleports between samples); the LJ stays in the sideline band; the
  signals list matches the play's headline fx (td/fd/inc/sack/penalty);
  plan is deterministic on rebuild; `script.actors` remains exactly 22.
- `broadcast_live_probe.mjs` (pw): in the built game — 3 officials
  rendered on scrimmage plays and never within the stand-off of the ball
  (sampled); the down box shows a legal down; fans carry section classes;
  goalpost forks present; the crowd-band parallax transform actually moves
  while the camera pans. Banner, roar classes, chain walk, wipe and net
  shake are SIGHTING-reported (per the M15/M18 lesson: phase absence under
  throttled rAF never fails; the structural laws gate).
- `frame_budget_probe` (standing): before/after on an IDLE container (the
  M22 lesson), no re-baseline.

## Exit criteria

1. Both new probes green; full core gate green; watchphys (22-actor law +
   outcome law), ball, contact, camera, locomotion probes untouched-green.
2. Officials on every scrimmage play, never inside the play, signaling
   results.
3. Crowd visually reacts by section; parallax live on all three boards.
4. Frame budget: no regression (idle measurement).

## Non-goals (explicit)

Band/mascot/student-section set pieces, stadium architecture packages,
weather/worn-field variants (goals doc: "eventually") · player-ID lower
thirds and drive-summary graphics (needs name plumbing into the board —
future pass) · play-clock urgency (no play clock exists in the viewer) ·
alternate camera angles · any engine work.
