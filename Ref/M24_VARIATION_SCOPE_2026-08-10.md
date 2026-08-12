# M24 scope — variation and optimization (2026-08-10)

Base build: cut against **`3dc35a2328`** or later (M23 stadium), per the M23
handoff. The LAST milestone of the animation-goals program. Files expected
to change: `js/ui/watchphys.js`, `js/ui/app.js`, `style.css`, new probes in
`tools/`, plus the program-closing coverage matrix in `Ref/`. **Zero engine
writes.**

## What the audit found already done (no work needed)

Per-player run-cycle timing (`--gait` from a player hash), equipment
variation (gloves/visor/sleeves/knee brace classes), three stance profiles,
height/build silhouettes (skill/line/prototype-RB scales), alternate catch
outcomes (hi/low/extend/toe-tap/contested — M12/M20) and six tackle styles
(M20). The goals' "procedural individuality" block is substantially shipped
by earlier passes.

## The gaps M24 fills

1. ONE celebration (a generic bounce) regardless of position or situation.
2. No exhaustion body language after long plays.
3. Nobody looks at the ball in flight unless they're covering it.
4. The bench stays frozen during crowd roars (M23 animated the fans only).
5. No performance degradation path: every effect runs at full price no
   matter how the machine is doing or how fast the camera is moving.
6. The goals' "animation-state leakage between plays" has never been a law.

## Work items

**A. Celebration variants (script-level, seeded, probed)**
1. `celebrateCue.style` picked deterministically from situation + the
   play's seeded rnd: short-yardage TDs spike or flex (never a leap), deep
   TDs leap or flex (never a spike), everything else mixes spike/bounce/
   flex. CSS variants ride the existing celebrate machinery.
2. `celebrateCue.mobIds`: the two nearest teammates at the end frame join
   the celebration (render-only class — tracks untouched).

**B. Exhaustion (script-level, probed)**
3. `windedCue` on long non-TD plays (25+ yards or 5.2s+): the carrier and
   the tackler bend over and breathe through the linger — timed AFTER the
   grounded/get-up window so the M20 finish laws are untouched.

**C. Heads to the ball (render-only)**
4. While the pass is in the air, defenders near the catch point take a
   slight eyes-up back-lean (composed into the M19 lean variable — no
   animation conflicts). Cleared every frame by the class sweep.

**D. Sideline joins the stadium (CSS)**
5. Bench men get home/away classes and bounce with their crowd on the M23
   roar classes.

**E. Optimization — the goals' perf block, honestly scoped**
6. `watch-panning`: while the camera pans fast, crowd micro-animations
   pause (cheaper frames exactly when the renderer is busiest).
7. `watch-lite` auto quality: a sticky per-session flag flips on when the
   frame-time EMA stays slow — crowd-life hides, ribbons stop animating.
   Structure stays in the DOM (probes and reactions keep working); only
   the decoration price drops. 60 FPS on a modern machine was already met
   (p50 16.7ms in a SOFTWARE-rendered container); lite mode is the "weaker
   computers" answer.

**F. Full regression coverage — the program-closing deliverable**
8. `Ref/ANIMATION_GOALS_COVERAGE.md`: every line of the goals doc's
   "visual regression testing" block (and the milestone order) mapped to
   the milestone that shipped it and the probe that guards it — including
   the two new laws below.

## Engine data — non-needs

Nothing. Situation (yards, td, duration) and geometry are on the play and
the script.

## Probes (ship WITH the kit, manifest full tier)

- `variety_probe.mjs` (node, deterministic — **pins Math.random**, NOT
  seedFlaky): celebration styles are legal for their situation (no leaps
  from the 1, no spikes on bombs), at least 3 distinct styles appear across
  the harvest (variety is real, not a constant), mob ids are real
  teammates and never the celebrant, windedCue fires on long plays and
  never on routine ones, winded timing clears the grounded window, plan is
  deterministic on rebuild.
- `variation_live_probe.mjs` (pw): **the state-leakage law** — at every
  scrimmage pre-snap sample, NO actor carries a residue class (tackled/
  down/get-up/celebrating/winded/broke-tackle/grounded/sacked/ball-watch)
  and the ball carries no flight/loose state: a fresh play starts clean.
  Plus: both field orientations seen across the window, end-zone groups
  stable with owners and lettering. Variant sightings (celeb styles,
  winded, ball-watch, bench roar, panning/lite) are reported, never gated
  (M15/M18 lesson).
- `frame_budget_probe` (standing): before/after on an idle container.

## Exit criteria

1. Both new probes green; full core gate green; every standing viewer
   probe (watchphys/ball/camera/contact/officials/locomotion) untouched-
   green.
2. A fresh play NEVER inherits animation state (law, live-verified).
3. Distinct celebrations verifiably situation-lawful and varied.
4. Frame budget: no regression; lite/panning modes never fire during an
   idle-container measurement window (they require sustained slowness).
5. The coverage matrix accounts for every goals-doc regression line.

## Non-goals (explicit)

Injury body language beyond the existing `wp-injured`/hurt fx · weather/
worn-field variants ("eventually" in the goals doc — not part of M19–M24)
· band/mascot set pieces (M23 non-goal, unchanged) · element pooling
across plays (per-play innerHTML rebuild measured fine; pooling risks
state leakage — the exact thing this milestone makes a law) · any engine
work.
