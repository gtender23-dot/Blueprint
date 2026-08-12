# Viewer Act 2 — roadmap (drafted 2026-08-11)

**North star, owner-ratified 2026-08-11: "the best-animated stylized 2D football
ever made."** Expressive, truthful, weighty puppets — never photorealism. Two
permanent walls define the lane: (1) animation only expresses what the sim stamps
(animations never lie — this is a FEATURE and a differentiator; keep it a law), and
(2) 22 actors at 60fps in SVG — every pass keeps frame_budget green (idle best-window
p50 16.7ms baseline, held M20→M24) and watch-lite degradation working.

Status context: Act 1 (animation-goals program, M19–M24) CLOSED 2026-08-10 at build
77479ac27d — coverage map in `Ref/ANIMATION_GOALS_COVERAGE.md`. The M24 parked
flavor list (weather/worn fields, particles, band/mascot, play-clock urgency, etc.)
was **completed by the owner in a separate session 2026-08-11** — the first Act 2
pass must fetch the CURRENT repo state, read that pass's doc/build id, and cut
against it (do NOT trust any earlier snapshot; check what of the parked list —
e.g. tip-drill chains — it did or didn't cover).

Queue position: after the creativity-tools program by default. Exception: **B3 clip
export may be pulled forward** whenever the store page becomes real — it produces
the marketing GIFs the release punch list requires anyway.

House template per pass (proven M19–M24): pure-builder in watchphys (DOM-free,
deterministic, seeded) → node contract probe → pw live-sighting probe → regression
suite (watchphys 7A, ball, camera, officials, contact, locomotion) → frame_budget
idle ×2 → core gate → device commit + Ref doc + memory.

---

## Act A — animation (the north-star work)

### A1 — Motion vocabulary I: the ball-carrier duel
The sim already resolves broken tackles, contact physics computes momentum, and the
celebration system proved the seeded, situation-lawful style-picker pattern. Extend
it to the plays that decide games:
- Broken-tackle MOVE STYLES: juke / spin / stiff-arm / hurdle, picked lawfully
  (seeded by momentum, defender approach angle, carrier attributes if stamped —
  else situation-only; style choice NEVER alters the track or the outcome).
- Tackle variety: wrap / big-hit / drag-down / shoestring, keyed off the contact
  cues' relative momentum. Big hits pair with the existing crowd-reaction layer.
- Gang tackles: 2nd/3rd arriving defenders join the pile (render-only mob, the
  celebration-mob pattern; contactSlots contract already names who's engaged).
- Pylon/marker dives on scoring and sideline plays where the track's endpoint and
  speed justify it.
- Probes: style-variety probe (all styles seen, lawful selection, deterministic),
  live state-leakage law (M24's zero-residue standard), contact truth unchanged.

### A2 — Motion vocabulary II: the throw and the catch
- Catch variants by arrival geometry (data already in the flight/arrival cues):
  toe-tap on sideline completions, layout dive on low/far balls, high-point on
  jump balls, one-hander (rare, seeded), contested-catch battle when the PBU duel
  was close (pbu cue already stamps the contest).
- QB variants: off-platform / on-the-run sidearm when throwing from a moving
  track, escape-the-pocket resets, distinct PA fake carry-through polish.
- OL/DL postures: pass-set kick-slide vs run-block drive as distinct silhouettes;
  bull vs speed rush reads on the edge (rush lanes are in the trace).
- Probes: arrival-geometry → variant mapping contract; ball-attachment regression
  (M21 hand rules must survive every new catch pose).

### A3 — Secondary motion and weight
The cheap pass that makes puppets read as heavy: lean into cuts, momentum tilt at
top speed, a gather-step before sharp breaks, drop shadows, carrier head-checks
toward pursuit (extends M24's ball-watch head tracking). Mostly CSS + per-frame
transforms on data already computed. Frame-budget risk is the watch item here —
this pass touches every actor every frame.

### A4 — Engine-coupled truth items (the expensive kind — flagged in Act 1)
- Mid-run arm switches (ball swapped to outside arm): needs an engine stamp +
  stat-realism A/B (Act 1 explicitly deferred it as engine + band work).
- Tip-drill INT chains (tipped ball → second defender): engine event + animation
  chain — VERIFY FIRST whether the owner's 2026-08-11 flavor pass already did it.
- Both follow the full sim-research loop (probe → band veto), not the viewer loop.

### A5 — Body expression (tied to the identity system; build WHEN identity ships)
The identity design (Ref/IDENTITY_DESIGN.md, on hold) gives players real body
types. This pass makes the skeleton wear them: proportions, gait timing, and
motion-style weighting by body (the 340-lb NT moves like a refrigerator, the
172-lb slot like a dart). Do not build before identity does; design the A1/A2
style-pickers so body inputs can slot in later without rework.

---

## Act B — presentation (the show around the bodies)

### B1 — Broadcast package
Player-name lower thirds + drive summaries (needs the known name-plumbing job),
stat overlays, halftime/postgame highlight reel stitched from the engine's existing
highlights/instant-classic flags, and **trace-driven text commentary** — the crown
jewel: the trace knows why plays worked (pressure, coverage, the read), so
commentary can be specific and TRUE. Normalized help language rules apply (no
coefficients). Likely 2 passes (graphics; then commentary).

### B2 — Replay interactivity
User-controlled scrub/slow-mo (tracks are deterministic — architecturally cheap),
all-22 vs broadcast camera toggle, click-a-player-for-card, and a TELESTRATOR
(draw on a paused replay, save annotated stills) — a creativity tool wearing a
viewer costume. M22's warp machinery is the timing substrate; the M22 note that a
replay camera must read the RENDERED transform (not script.ball.track) applies to
any scrubber.

### B3 — Clip export (pull-forwardable)
Render any play/replay to GIF/short video via headless re-run + capture. Feeds
players (share your dynasty's moments), the store page (gameplay GIFs from the
punch list), and community marketing in one pass.

---

## Standing laws for the whole act
- Truth law: no animation may contradict the track/contact/ball cues; style is
  presentation ON truth, never instead of it.
- Perf law: frame_budget idle best-window p50 must not regress; watch-lite hides
  decoration, never structure; probes assert structure, not visibility (cloud
  containers trip watch-lite by design — M24 gotcha).
- Cast law: live probes gating on scrimmage require cast===22 [data-wpa] (the
  2pt/kneel mini-boards run their own tiny pipeline — M24 gotcha).
- Determinism: every style picker is seeded; variety probes assert lawfulness and
  determinism, and the state-leakage law (zero pre-snap residue) holds per pass.
