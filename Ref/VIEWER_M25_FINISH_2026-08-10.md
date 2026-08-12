# Viewer M25 — finishing the open list (2026-08-10)

Authored against mainline `bb6b3441cf` (M24 + the coach-reload persistence
fix), per `Ref/M25_FINISH_SCOPE_2026-08-10.md`. The owner asked for the
M19–M24 program's deliberate OPEN list to be finished; play-clock urgency
was cut by the owner mid-scope and stays OPEN. Build hash: **`3ed938bd29`**.

## What shipped

**A. Turf spray and particles (viewer-only).** New `fx` kind `"turf"`:
`buildPlayScript` reads the CARRIER'S finished track for hard cuts (heading
change ≥ ~38° at real speed, sampled ±3 frames) and kicks a pellet burst
there, plus a bigger burst where the tackle lands. Deterministic — track
data plus the play's seeded stream, capped at 3 cut bursts + 1 tackle burst
per play ("effects kept restrained"). Rendered as one-shot CSS pellets (the
`wp-contact-dust` pattern, per-particle `--dx/--dy`); pellet color keys off
the board's weather (`data-weather` on the SVG): brown turf, white in snow,
dark mud in rain. Hidden under `.watch-lite`. Unknown fx kinds were already
ignored by the officials signal map — verified, no spurious signals.

**B. Weather and worn fields (viewer-only).** Per-GAME weather on the board
object (`watchBoardColors`): FNV-hashed from matchup + season + calendar
day, so every stage of one game (call/halftime/final) renders the same sky
— ~13% rain, late-season snow, clear otherwise. **The sim never reads it**
(weather-sensitive footing stays a goals-doc "later option"). One seeded
stream (`wxRnd`, seeded from the weather hash) draws every weather-touched
element at a fixed per-element rate, which gives the worn middle its law:
the Q4 field is the Q1 field plus MORE blotches — early wear never moves.
Precipitation is a fixed set of CSS-looped drops/flakes spanning the whole
world width (no per-frame JS; the camera pans inside the sheet), the group
ALWAYS present with a lawful kind (`data-wf-weather="clear|rain|snow"`) so
structure checks never depend on the sky. Rain adds a wet sheen, snow a
whitening veil that thickens with wear. Paused on `watch-panning`, hidden
under `.watch-lite`.

**C. Band and mascot set pieces (viewer-only).** A 16-man band block deep
in the home stands (inside the M23 `.wf-stadium-par` parallax group) and
one mascot per sideline beside his bench (field-locked, the bench
precedent). No new reaction system — they ride the M23 roar rails: the
band PLAYS on `watch-roar-home` (bounce + horn glint), each mascot goes
wild on his side's roar, both idle on the crowd bob otherwise.
`.watch-lite` freezes them (structure stays in the DOM).

**D. Player-ID lower thirds + drive summaries (viewer-only).** The M23
non-goal said this "needs name plumbing into the board" — it turned out the
plumbing already existed on the play record (`rusherId`/`receiverId`/
`intPickerId`/`sackerId`… + the slot stamps) and `playerNames` was already
built for the ticker; M25 just joined them. New `#watch-lower` DOM strip
(lower-LEFT, the banner owns center; safe-area, `.on` slide, live-only —
the replay path re-runs the board, never the reveal):
- **Play lower third** at the post-play reveal for the featured man
  (scorer → picker → sacker → 20+/15+ yard man): name, position, his
  running line for THIS game (accumulated from the plays already watched),
  and the on-screen jersey number — read off the RENDERED sprite via
  `slot → [data-wpa] → [data-jersey]`, so the strip can never disagree
  with the body on the field; omitted when the slot didn't translate.
  Tip-drill picks read "TIP-DRILL PICK".
- **Drive-summary lower third** at the drive result: plays, yards, clock
  consumed (from the plays' `clock` stamps), colored by the possession.

**E. Tip-drill interception chains — THE engine touch.** In the downfield
PBU arm only (`sim.js`, the `catchResult.pbu` branch): after the swat is
credited, the deep helper / robber — a real second man already on the play,
when he exists and isn't the tipper — rolls `C.TIP_DRILL_INT` (0.015,
ballHawk-scaled ×1.35/level) to pick the carom. Sets
`turnover/turnoverType/intPickerId/tipDrill`; **the tipper keeps `pbuId`**.
One play, two credits — PBU to the tipper, INT to the picker, `passInt` to
the QB — exactly how it's scored in real football. Gate:
`globalThis.__noTipDrill`. `ballSlots` already stamped `pbu` and `pick`
independently, and the PBP name walk already resolved both ids — zero new
plumbing. PBP and highlights got tip-drill strings ("tips it up …
snatches the carom"). Measured rate: **~0.1 per team-game** (one every ~5
games watched, ~13% of a defense's INTs — the real-football share).

**Viewer chain (watchphys).** The M21 guard made deflect+pick
unrepresentable (`!p.turnover`); M25 stages both: deflectCue on the tipper
at the catch point, a written carom arc, the stamped picker converging on
the carom and taking it +0.55s, then the normal pick-return rails. Two
wiring lessons the probe forced:
1. the picker's feasibility deadline is the CAROM, not the catch (+0.55s —
   a deep safety who can reach the carom is feasible);
2. the proximity fallback must EXCLUDE the tipper on tip plays, or the
   chain collapses back into one man (that was 2/36 staged; now 18/36,
   with the rest falling back to the single-event pick — the M21
   feasibility law, intact).

## Probes installed (manifest core tier, "newest surface" section)

- `tipdrill_probe.mjs` (node, deterministic — **pins Math.random**, NOT
  seedFlaky): amp arm (constant cranked to 0.5) — 40 chains, every one a
  canonical INT with tipper ≠ picker, ballSlots stamps both on 36/40, box
  score books tipper PBU + picker INT on 40/40, int-accounting ledgers
  EXACT (54 = 54 both sides); viewer stages tip-strictly-before-pick on
  18/36 stamped chains with the ball ending on the picker every time;
  deterministic rebuild clean; kill arm 0 chains; live arm rare by design.
- `tipdrill_ab.mjs` (node, **unseeded** — the band-A/B convention;
  seedFlaky): live-vs-kill, N=120/arm. A pinned LCG was tried first and
  phase-shifted the arms into DIFFERENT games (the one extra draw per
  breakup moves every downstream roll) — standing lesson, now in the probe
  header. Gates are 3-SE bands: INTs gained ≈ tips fired, PBU ledger
  unmoved (tip plays keep their pbuId), pts/comp%/plays flat.
- `presentation_live_probe.mjs` (pw, seedFlaky): structural laws — weather
  group with lawful kind, wear group, band (≥8), BOTH mascots on all 455
  field frames sampled; `#watch-lower` present; pre-snap residue law clean.
  Sightings: drive-summary lower thirds live (63 frames), turf spray live
  (79 frames), lite mode trips in this container (expected — slow box).

## Gate

- Full core gate on the final tree (LOCAL Windows box, first local gate for
  this project): **GATE PASSED — 32 OK, 1 flaky-cleared, 0 FAIL, 9.3 min.**
- The flaky-clear was `size_fit_probe`'s light-OLB fat-tail — the standing
  0.5%-boundary check, which turns out to sit at the boundary locally too
  (0.4-0.5% across runs, ~1/3 per-run fail rate → the retry double-fails
  about one gate in ten). Manifest note updated so nobody re-diagnoses it:
  a red on ONLY that check at 0.4-0.5% is the boundary; materially below
  0.4% is real.
- Two non-M25 fixes surfaced by the local runs, both shipped with this
  pass: `dead_surface_probe` crashed on Windows (`URL.pathname` → `C:\C:\`
  double-drive; now `fileURLToPath`), and `ui_playcall_smoke` crashed once
  under memory pressure mid-gate (this box has ~3 GB commit headroom —
  standing env note), green standalone and on the final gate.
- Boot: 0 pageerrors. `stat_realism_harness`: the 3 standing flags and
  NOTHING new. `tipdrill_probe` + `tipdrill_ab` + `presentation_live_probe`
  all green in-gate (turf spray sighted on 160 frames; lite mode trips on
  this box as designed).

## Env notes

- `stat_realism_harness`: the 3 standing flags and NOTHING new — the
  tip-drill INT drift stays inside the band at 0.015.
- The A/B is unseeded and marked seedFlaky; one retry is the contract.
- Weather is seeded per matchup — most probe runs see clear skies; the
  probe treats kind as a sighting and gates only lawfulness.

## The overnight full sweep (2026-08-11) — the first COMPLETE local full run

The owner asked for a deploy; policy owed a full + night run. Mid-evening a
SECOND working session (the D6 loyalty-ladder pass) landed `app.js` and the
gate manifest from pre-M25 copies — the M25 viewer code and probe
registrations were silently reverted and re-applied from this session (all
other files survived; the merged tree re-passed core). **Lesson: don't run
two sessions against this tree at once; one session owns the merge.**

The overnight run (keep-awake orchestrator — the machine slept through the
first attempt; `tools/_night_run.ps1` holds ES_SYSTEM_REQUIRED for the
duration): **core PASSED · night PASSED (h2_shadow + recruit_calendar,
42 min) · full 150 OK / 21 FAIL in 172 min.** Every FAIL was then triaged
to ground (`tools/_triage_run.ps1`, live + `__noTipDrill` kill arms via
`tools/_notip_wrapper.mjs`):

- **9 were the documented standing list**, now proven tree-state rather
  than cloud-env: rotation + size_fit + the six envKnown UI probes +
  new_world fail identically locally. envKnown means "documented", not
  "cloud-only".
- **6 cleared as unseeded noise or load**: covsack, run_scheme,
  pass4_band_ab, tree_advantage, dna_cards (all green standalone), robber
  (a 0.2pp comp%-parity boundary flip — now seedFlaky in the manifest).
- **4 were cloud-calibrated timeouts** too tight for this box: creeper
  644s/600, blitz_reality 401s/300, zone_void 392s/300, shell_identity
  404s/300 — manifest budgets raised with local measurements (zone_void
  and shell_identity also each have one seedFlaky-class marginal check).
- **2 were REAL, and both got mechanism fixes plus honest probe
  reconciliation:**
  1. `ball_truth` pick-identity retention had collapsed to ~19% — the
     Capstone helper/robber legs credit DEEP SAFETIES with picks, and from
     a static center-field alignment the credited man could never beat the
     ball, so he fell to a proximity stand-in (the old ≥50% gate was
     calibrated pre-Capstone on n≈10). Fixes: the credited deep man now
     SHADES to the passing strength pre-snap (bounded ±14u — safety
     rotation, wiring-time only, no mid-play jump) and BREAKS ON HIS READ
     ~0.9s before the release (the robber mechanism made visible). The
     probe's law now measures what it means: arrivable credited men must
     be kept (≥80%; measured 8/8), infeasible ones (batted-ball DL picks,
     crossfield safeties) fall back by design and are reported. Swat
     radius 3.0→4.2 (the capTrackSpeed-vs-pin tail at N=24).
  2. `contact_truth` pile-cap violations: the M20 ring runs at staging
     time, but the run-fit ENGAGEMENT constraints run later and drag an
     engaged lineman back inside the pile radius. The pile law now gets
     the FINAL WORD — re-enforced after every track mutation, blended over
     the last 8 frames (short enough to spare the staged break meeting,
     soft enough to stay clear of the RUNG 7A speed cap). contact_truth
     11/11, watchphys RUNG 7A stable across repeated runs.

Final tree: viewer set green (watchphys, tipdrill, ball_truth,
contact_truth, camera_plan, officials_plan, variety) — build
**`7565224b53`**.

## Open after M25

Play-clock urgency (owner cut, 2026-08-10) · weather-sensitive footing ·
mid-run arm switches · stadium architecture packages · injury body language
beyond `wp-injured` (minor, M24 note) · the standing-fail list above
(pre-existing; each documented in the manifest, none M25's).
