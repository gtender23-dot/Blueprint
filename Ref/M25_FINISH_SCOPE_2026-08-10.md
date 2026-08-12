# M25 scope — finishing the open list (2026-08-10)

Cut against mainline `bb6b3441cf` (M24 + the coach-reload persistence fix).
The animation-goals program (M19–M24) closed with a deliberate OPEN list in
`Ref/ANIMATION_GOALS_COVERAGE.md`; the owner has asked for it to be finished.
M25 takes five of the six items — play-clock urgency was cut from the pass by
the owner mid-scope (2026-08-10) and stays OPEN.

## Work items

**A. Turf spray and particles (viewer-only)**
1. New `fx` kind `"turf"`, pushed by `buildPlayScript` — deterministic, from
   `seeded(p)`: a burst at hard-tackle arrival (rides the tackle fx moment)
   and at the carrier's hard cuts (detected from the finished track: heading
   change ≥ ~40° at speed, capped per play so the field stays readable).
2. Render: `case "turf"` in `watchFxMarkup` — a few small pellet rects with
   per-particle `--dx/--dy` flight, the `wp-contact-dust` pattern exactly.
   Weather-aware fill (snow kicks white, rain kicks dark).
3. `.watch-lite` hides it (decorative-layer law).

**B. Weather and worn fields (viewer-only)**
4. Per-GAME weather, deterministic: hashed from the matchup identity + week
   in `watchBoardColors`' board object — `clear` most of the year; rain and
   (late-season) snow at modest rates. No engine field, no footing effect —
   the goals doc kept "weather-sensitive footing" a later option, and M25
   honors that: presentation only.
5. Precipitation layer in the board SVG: a fixed set of CSS-animated streaks
   (rain) or flakes (snow) in a `wf-weather` group; paused while
   `watch-panning`, hidden under `.watch-lite`.
6. Worn field: a `#wf-wear` blotch pattern between the hashes — intensity
   climbs with the game clock (Q1 light → Q4 chewed up), wetter games wear
   darker, snow games whiten the turf instead. Seeded per game so the
   blotches don't teleport between plays.

**C. Band and mascot set pieces (viewer-only)**
7. A band block (rowed figures behind the home end of the crowd, inside the
   `.wf-stadium-par` parallax group) and one mascot per sideline near each
   bench (field-locked, like the benches).
8. They live on the M23/M24 reaction rails, not a new system: the mascot
   bounces on `watch-roar-{side}` (the bench-men precedent), the band plays
   on the HOME roar (instrument flash + bounce). Idle: subtle bob.
   `.watch-lite` freezes both.

**D. Player-name lower thirds + drive summaries (viewer-only)**
9. New `#watch-lower` DOM sibling of `#watch-banner`, same slide-in/`.on`/
   timer pattern, safe-area constrained, live-only (never during replay).
10. Play lower third at the post-play reveal: the featured man of the play
    (scorer → picker → sacker → 20+ yard receiver/rusher), real name from
    `playerNames` (the ids are already on the play record: `rusherId`,
    `receiverId`, `intPickerId`, `sackerId`…), position, and his running
    line for THIS game accumulated from the drives already watched. Jersey
    number joined through the slot stamp → the rendered sprite's
    `data-jersey`, omitted when no slot translation exists.
11. Drive-summary lower third at the drive `result` seq item: plays, yards,
    clock consumed (from the plays' `clock` stamps), `formatDriveResult`.
12. No engine change: the name/slot plumbing the M23 non-goal asked for
    already exists on the play record — this pass just joins it.

**E. Tip-drill interception chains (THE engine touch + viewer)**
13. Engine: in the downfield PBU arm only — after the swat is credited, the
    deep helper / robber (a real second man already on the play, when one
    exists and isn't the tipper) rolls `C.TIP_DRILL_INT` (ballHawk-scaled)
    to pick the carom. Sets `turnover/turnoverType/intPickerId/tipDrill`;
    the tipper KEEPS `pbuId`. One play, two credits — PBU to the tipper,
    INT to the catcher, `passInt` to the QB — exactly how it's scored in
    real football. Gate: `globalThis.__noTipDrill` (the A/B arm).
14. `ballSlots` already stamps `pbu` and `pick` independently — a tip-drill
    play carries both with zero new plumbing. The name walk already
    resolves both ids for the log.
15. Viewer: `buildPlayScript` currently guards the deflection on
    `!p.turnover` (deflect+pick was unrepresentable). On `p.tipDrill` with
    both slots feasible: deflectCue at the catch point, the ball caroms
    (short seeded hop off the swat), the stamped picker converges on the
    carom and takes it ~0.55s after the tip, then the normal pick-return
    rails take over. Either slot infeasible → today's single-event
    fallback, untouched.
16. PBP + highlight text distinguish the chain ("tipped — INTERCEPTED").

## Probes (ship WITH the kit, registered in the manifest)

- `tipdrill_probe.mjs` (node, deterministic — pins Math.random, NOT
  seedFlaky): harvests chains under an amped `TIP_DRILL_INT` arm plus the
  live constant — asserts tipper ≠ picker, both ids stamped and
  slot-translated, stats book PBU+INT+passInt consistently (the
  int_accounting law on tip plays), `__noTipDrill` kills the chain dead,
  viewer script orders tip strictly before pick and the ball rides the
  picker after, deterministic rebuild.
- `tipdrill_ab.mjs` (node, seeded): live vs `__noTipDrill` kill — INTs may
  drift UP by the design amount (small), PBUs move by at most the INTs
  gained, completion% / points / plays stay flat. Prints the distributions;
  hard thresholds gate.
- `presentation_live_probe.mjs` (pw, seedFlaky): structural laws — weather
  group present with a lawful kind class, wear layer present, band + two
  mascots present, `#watch-lower` exists and is sighted `.on` during live
  play, turf fx nodes appear (sighting), no new class survives into a fresh
  play's pre-snap (the state-leakage law extended to M25 classes),
  `.watch-lite` present-and-hiding when tripped (structure stays).
- Standing regression: stat_realism (expect the 3 standing flags and
  NOTHING new), int_accounting, ball_truth, watchphys RUNG 7A, variety,
  variation_live, broadcast_live, frame_budget (idle container, no
  re-baseline).

## Exit criteria

1. All three new probes green; core gate green; no new stat_realism flag.
2. Tip-drill A/B drift inside its printed design band; INT accounting
   ledger exact on tip plays.
3. Every new decorative layer disappears under `.watch-lite` and no new
   class leaks between plays.
4. Frame budget: no regression vs the idle-container baseline.

## Non-goals (explicit)

Play-clock urgency (owner cut, 2026-08-10 — the viewer still has no play
clock) · weather-sensitive FOOTING (goals doc "later option" — weather is
presentation only) · mid-run arm switches (the other flagged engine
extension) · stadium architecture packages · element pooling (rejected by
the state-leakage law) · any second engine touch beyond item 13.
