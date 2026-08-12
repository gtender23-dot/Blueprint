# M20 scope — synchronized contact (2026-08-09)

Base build: cut against **`8148deb3f0`** or later (M19 merge + pressure pie),
per the M18–19 handoff. Files expected to change: `js/ui/sprite.js`,
`js/ui/watchphys.js`, `js/ui/app.js`, `style.css`, new probes in `tools/`.
**No engine writes are required for this milestone** (see "Engine data" below)
— target a viewer-only kit so the merge rides the viewer precedent (no stat
A/B), with the full gate run as usual.

## Source goals

From `Ref/animation goals.txt` — the "Football-contact system" block, plus two
carry-ins from other sections that belong to contact:

- Blocker and defender meet at one synchronized contact point.
- Hands attach visually to shoulder pads instead of passing through bodies.
- Drive blocks, reach blocks, double teams, pulls and pass sets.
- Rush moves, shed direction and realistic blocker recovery.
- Wrap tackles, shoulder tackles, diving tackles and gang tackles.
- Broken tackles that begin from the actual collision.
- Fallen players remain grounded briefly instead of instantly disappearing.
- Small piles without turning players into one unreadable mass.
- (carry-in) Momentum continuing through catches, hits, and whistles.
- (carry-in) Direction-specific tackling and blocking.

## What already exists (M9 / M14 / M19 baseline)

- `watchphys.js` builds `blocks[]` with `engageAt`/`releaseAt`, meet points
  (`meetX`/`meetY`), wash/drive targets, and rep types (chip, pickup, drive,
  second-level, combo); `rushCues` carry win/lose + shed timing (`shedT`).
- `tackleCue` has six styles (form, wrap, drag, collision, shoestring,
  goalline) + gang assist + sack, and app.js phases it:
  approach → breakdown → brace → impact → finish, with carrier hit/down
  classes and engagement glyphs.
- `missCues` flash near-miss defenders (proximity-scanned, max 2).
- M19 gives every sprite real `v`, `accel`, plant-foot state, and
  `--wsp-speed`/`--wsp-accel` custom props — contact can now read momentum
  instead of inventing it.
- `watchphys` randomness is already seeded per play (`seeded(p)`); all new
  randomness MUST go through that `rnd()`.

## The headline defect M20 fixes

The engine already resolves contact truth per play — `p.tacklerId`,
`p.assistId`, `p.tflId`, `p.ffId`, `p.brokenById`, `p.breakaway`, fall-forward
— and app.js's *text* layer uses it (play description credits the right man).
But `buildPlayScript` **ignores all of it** and picks the on-screen tackler by
end-point proximity. The box score and the picture can disagree: the play log
says the MLB made the stop while the screen shows a safety doing it, and a
broken tackle exists in text only. Wiring these fields through is the single
biggest realism win available, and it is pure viewer plumbing.

## Work items

**A. Contact truth wiring (viewer-only; data already on `p`)**
1. Tackler = `p.tacklerId` when the actor exists in the script; steer his
   track to the end point (current proximity pick becomes the fallback when
   the id is absent/off-screen, e.g. no-trace plays).
2. Assist = `p.assistId` (same fallback rule). `p.tflId` may style a TFL
   finish (backfield swarm) later; record it on the cue now.
3. Broken tackle: when `p.brokenById` exists, stage a real collision on the
   carrier's track at the nearest approach of that defender — carrier stumble
   (loco `start` re-entry) + defender miss-and-ground — instead of a generic
   missCue flash. The break must originate at the collision point.
4. Forced fumble: when `p.ffId` is set, the strip animation belongs to that
   defender at the fumble point (fum fx already exists).
5. Breakaway (`p.breakaway`): suppress the tackle fit entirely — no phantom
   pursuit brace at the end point.
6. Fall-forward: carrier finish falls THROUGH the contact point along his
   momentum vector, not standing-stop-then-drop.

**B. One synchronized contact point**
7. Pass sets: give pass-pro `blocks[]` real meet points like the run game has
   (currently chip/pickup only have times). Blocker and rusher converge on the
   same point; neither passes through the other.
8. Hands-to-pads: contact poses keyed by relative position + facing so the
   block/tackle arm groups land on the opponent's torso band, both facings,
   both teams (no mirrored-arm pass-throughs).
9. Mutual engagement facing: both actors face each other while engaged
   (M19 facing hysteresis holds combat facing; engagement pins it).

**C. Tackle mechanics on real momentum**
10. Impact gating: the hit fires when the two sprites are actually within
    contact radius, reconciled against cue time (clamp cue to first frame of
    real proximity) — kills early/late "air tackles."
11. Carrier momentum through contact: read `--wsp-speed`/accel at impact;
    high-speed collision styles carry the pair along the momentum vector,
    wrap/drag styles decelerate over the finish window.
12. Grounded finishes: tackled carrier and tackler stay down through a hold
    window (≥0.6s), then a get-up beat before celebrate/next-play advance.
    Fallen players never blink upright.

**D. Pile discipline (hard caps, probed)**
13. Gang tackles cap at **3 defenders + carrier** (constant in one place).
14. Separation: no two actors share coordinates at the pile; stack with the
    existing depth sort so the pile stays readable (goals doc: "small piles,"
    restraint is a feature).

**E. Shed and recovery polish**
15. Beaten blockers get a recovery step + re-fit attempt (they currently
    trail toward a midpoint); shed direction matches the rusher's move side
    (`rushCues.move` already encodes it).

**F. Minimal camera slice (pulled forward from M22 — scoped tight)**
16. Stable framing at the snap (no drift during cadence) and smooth
    acceleration/braking of the follow camera. NOTHING else from M22 —
    no anticipatory lead, no contextual zoom. Rationale: M20/M21 visual QA
    happens through this camera; judging contact through a jittery one hides
    exactly the defects this milestone exists to fix.

## Engine data — tags and non-needs

Every field item A consumes already rides the play object into the viewer
(app.js text layer proves it). **M20 makes no engine writes.** Two known gaps
are explicitly deferred, not worked around:

- Sim resolves contact *outcomes*, not a timeline; the viewer continues to own
  contact timing. Acceptable — the script already invents plausible timing.
- Multi-break runs: sim emits a single `brokenById`. If we later want chained
  broken tackles, that is an engine extension (new milestone, full stat A/B).

## Probes (ship WITH the kit, seeded, registered in the manifest full tier)

- `contact_truth_probe` (deterministic, node): over N seeded plays —
  on-screen tackler id === `p.tacklerId` whenever present; assist matches;
  `brokenById' plays stage a collision-origin break; breakaway plays have no
  tackle fit; pile participants ≤ cap; no two pile actors within ε of
  identical coordinates; grounded hold ≥ minimum before get-up.
- `contact_sync_live_probe` (pw): impact class only toggles while sprite
  separation < contact radius; block pairs converge to one meet point (both
  facings, home/away); hands-band overlap check on engaged pairs.
- `frame_budget_probe` (pw): scripted 22-actor scrum play; per-frame script
  time and long-task count under budget on the throttled headless rAF —
  budget set from an M19-baseline measurement BEFORE contact work starts,
  gate = no regression beyond an agreed margin (this probe becomes the
  standing perf gate for M21–M24).
- Cloud-env caution (standing lesson from M15/M18): any check windowed on
  normalized play time gets per-phase fallback verification, or it will flake
  on throttled rAF and eat a seedFlaky slot.

## Exit criteria

1. All new probes green locally; gate core green on the merged tree.
2. Box-score/screen agreement: zero mismatched tackler identities across the
   probe corpus (fallback plays exempt and counted).
3. No air tackles: impact requires proximity, verified live.
4. Grounded holds and pile caps verified; no unreadable mass at any seed.
5. Frame budget: no regression vs the pre-M20 baseline measurement.
6. Class-scan vs kit finals (standing merge lesson) before declaring merged.

## Non-goals (explicit)

Ball flight/exchanges (M21) · anticipatory camera + zoom + replay (M22) ·
turf spray on tackles and all particles (M23, per goals doc "turf
interaction") · exhaustion/variety body language (M24) · any engine timeline
work (future milestone if ever).
