# Viewer Presentation Roadmap — Act C and beyond

**Status:** captured 2026-08-14. This is the agreed direction for the 2D
broadcast/replay viewer after Act B. It is a presentation plan, not a simulation
change. Every item here is pinned to the recorded sim result — the viewer's job
is to *show* what the engine computed more convincingly, never to alter an
outcome.

## Where Act B leaves the viewer

Act B leaves the game with a strong, coherent 2D broadcast and replay system: 22
animated players, event-aware football movement, ball ownership and flight,
broadcast framing, All-22 zoom, replay scrubbing, telestration, highlights, and
video export. It is now beyond a moving diagram — but it is not near the
presentation ceiling.

The biggest remaining limitation: every camera still uses essentially the same
sideline projection. The current "All-22" shows more field, but it is not yet a
genuinely different viewing angle.

## The core architectural principle

Play animation is stored in **field coordinates**, independently of where it
appears on screen. That separation is what unlocks everything below. The plan
does NOT rotate the finished SVG picture (that would rotate players, labels,
footballs, and overlays incorrectly). Instead, introduce a **projection layer**:

    field position -> selected camera projection -> screen position

That layer also controls apparent size, facing direction, depth order, camera
boundaries, and ball height. The original orientation becomes a selectable
camera preset rather than a discarded implementation.

## Multiple camera angles

One play (stored in field coordinates) can support many cameras:

- Current broadcast sideline
- Original high tactical / coach view
- Reverse sideline
- True end-zone coaching film
- Tight red-zone / goal-line camera
- Diagonal or simplified SkyCam
- Player-isolation and ball-follow replay cameras

## Players

Substantial room to improve without changing simulation results. Approach: a
**lightweight articulated 2D player rig** — not dozens of hand-authored
animations — preserving the stylized look while giving elbows, shoulders, feet,
and the football more convincing relationships. Targets:

- Eight-direction player facing instead of the current small directional set
- Correct depth sorting so nearer players cross in front of farther players
- Foot planting, turning lean, acceleration, less sliding
- Hands and shoulders aligned to actual blocking/contact partners
- QB release points and receiver hand targets
- Head and eye tracking toward the ball or assignment
- Better gang tackles, piles, toe taps, falls, get-ups, celebrations
- More player identity: body type, equipment, sleeves, gloves, deterministic accessories
- Cleaner transitions between stance, sprint, contact, tackle, post-play

## Football

The ball is already tied to ownership, releases, catches, tips, arm switches,
and loose-ball events. Its next architectural improvement is a **real height (z)
coordinate**. Today much of the flight lift is a screen-space effect; a
world-space z lets the same pass look correct from sideline, end zone, and high
camera. Then:

- Spiral rate based on flight
- Wobble after a tip
- End-over-end punts and kicks
- Better snap, handoff, option-pitch, and lateral transfers
- Accurate hand attachment points
- Ground contact, tumble, bounce
- Proper occlusion as the ball passes in front of or behind players
- A subtle visibility floor or halo without lying about its actual location

The ball's release, catch, landing, and spot stay pinned to the recorded result.

## Geometry — two kinds, kept separate

**Presentation geometry** can safely improve considerably (viewer-only, no
outcome change):

- Curved, speed-aware movement between recorded landmarks
- Better spacing so sprites do not occupy the same visual space
- Perspective scaling and occlusion
- Contact alignment
- Route-break and pursuit curvature
- Boundary, pylon, goalpost, and end-zone depth
- Unified special-teams animation and replay behavior

**Simulation geometry** (`sepgeo.js`, `run2geo.js`, `rushgeo.js`, `yacgeo.js`)
determines outcomes. It can also improve — zone exchanges, force/spill rules,
rush lanes, pursuit leverage, second-tackler timing — but that is a SEPARATE
football-engine pass with statistical A/B testing, never mixed into a
presentation act.

## The sensible next order

1. Build the reusable camera/projection system; restore the old orientation as a camera.
2. Add world-space ball height and genuine end-zone / high / reverse views.
3. Add depth sorting, expanded directional bodies, hand anchors, improved contact.
4. Polish movement curves, foot planting, piles, boundaries, special teams.
5. Only afterward consider outcome-bearing (simulation) geometry changes.

## The ceiling

Another two or three substantial presentation acts before diminishing returns.
The realistic ceiling is not Madden-style motion capture — it is a very
convincing **stylized multi-camera football broadcast and coaching-film
engine**, considerably beyond where it is now.
