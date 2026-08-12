# Part 1 Controls Pass — the five sim-mechanic dials (2026-08-06)

The last unpicked work from `Ref/AUDIT_CONTROLS_GAPS.md`: five controls over mechanics
the realism passes built. The shipping law held for all five — every default equals the
pre-dial game exactly (zero-migration saves and AI), each dial carries an AI policy for
symmetry, and the new `tools/part1_controls_probe.mjs` proves every dial AND its cost
(5 consecutive clean runs; arms are roster-paired to kill generation luck).

## 1. Surprise onside — `gp.surpriseOnside` (never / armed)

`onsideResult(surprise)` (~60% recovery, plumbed in the special-teams pass and never
called) finally has a caller. ARMED springs **one** surprise onside per game on a
post-score kickoff outside the trailing-late desperation window; the per-game spend is
tracked on the token (`_surpriseUsed`, resume-safe). ST-section toggle; AI: a heavy
underdog with a gambler coach (prestige gap ≥2, aggression >0.62) arms it ~15% of
weeks, re-rolled weekly. Probe: armed ≈1 attempt/game recovering ~40-60%; default
attempts only in desperation.

## 2. Robber call — `gp.robberCall` (auto / rob / overtop)

The two-high safety's leash, cell-overridable and a **row on the F1 defensive
headset**. ROB frees him: strength ×1.6 and the vertical-hold requirement is waived (a
told robber hunts by assignment, which is why the tax is unconditional while it's on).
The NEW cost the audit demanded: with rob on, deep throws into two-high gain +0.06
separation — the helper cheating down isn't capping the shot. OVERTOP: no robber,
ever, and deep balls lose 0.03 — the glued lid. Probe: overtop robs 0.0% (exact);
deep-ball separation vs rob > vs overtop (measured on trace-chosen deep throws — the
play-type filter was diluted by checkdowns until the trace gained `dep`). AI: ballhawk
staffs rob ~25%, timid ones sit over top ~20%, most stay auto.

## 3. Zone teaching style — `gp.zoneStyle` (spot / balanced / match)

The audit's biggest-identity, highest-risk dial, built as a real triangle:

- **MATCH** squeezes floods (void gain ×0.55) — but a zone defender without the head
  for it (AWR-led IQ < 50, technique secondary — the Step-3c answer) loses his route
  mid-pattern: a **BUST**, +0.22 separation, the new chunk-play branch. Recorded in
  the trace (`bust`) so the sim-research loop can see them.
- **SPOT-DROP** never busts and sits in the short throwing lanes (−0.02 short-zone
  sep) — but a flood outnumbers grass every time (void gain ×1.45).
- **BALANCED** is the pre-dial engine, bit for bit.

Probe: busts fire only under match (~1% of throws with an average back seven, 0.0%
otherwise — exact); the void edge over each arm's own baseline is smaller under match
than spot (within-arm contrast — raw cross-arm means drift with game luck). AI: smart
secondaries teach match (~35% when S+CB strong), weak ones spot-drop, most balanced.

## 4. Chip help — `gp.chipHelp` (auto / chip the edge)

The CALLED chip designs the bump: the released back **hunts their best penetrator**
(composite-sorted, not first-edge-shown) and lands it more reliably (bump ×1.35 under
the same cap). The cost the audit named is now mechanically true: the chip is thrown
by the **released** back — so on ~45% of called-chip snaps he never enters the
pattern, and the outlet thins exactly when the heat is on. (First cut gated the starve
on the kept-in back — dead code, the released back throws the chip; caught by the
probe.) Mechanism hard gate per house rule: `resolvePassRush` (now exported) run 30k
reps head-to-head, chipCalled on < off in pressure; the outlet starve is game-level
and real (RB-target share drops with chip on, roster-paired). Protection-section
dial; AI: weak lines (~45%) call it.

## 5. Checkdown emphasis — no new dial, by design

The audit's conclusion held: the existing QB leash (`qbAggr`) now shades the kept-in
back's late leak into the flat (×1.35 at full-conservative, ×0.65 at full-aggressive,
exactly 1.0 at the 50 default). Conservative QBs live on the outlet; aggressive ones
stare past it. Probe: conservative RB-target share > aggressive on medium/deep throws.

## Verification

part1_controls_probe (12 checks, roster-paired arms, 5/5 clean runs) · regression:
robber_probe · zone_void_probe · chip_probe · checkdown_probe · play_trace_probe ·
special_teams_probe · st_net_probe · coach_controls_probe · situational_probe ·
midgame_save_probe · ui_playcall_smoke · watch_live_probe · build + boot 0 pageerrors ·
**stat_realism: no regression** (27.2 / 143.4 / 57.9 / 7.21 / 2.12 / 1.71 — all deltas
vs the capstone baseline within noise; the same three pre-existing off-band flags).

## Probe craft notes (why this probe looks the way it does)

Whole-game deltas for per-rep mechanics sit inside sampling noise (the robber_probe
lesson). This probe pairs rosters across arms, unit-gates the chip at the mechanism,
contrasts void throws against each arm's own baseline, and filters robber checks on
the trace's chosen-route depth. The raw game-level orderings it replaced flapped sign
run to run; every gate that remains passed five consecutive runs.

## The audit is closed

All nine proposals from `Ref/AUDIT_CONTROLS_GAPS.md` are now shipped: Part 1's five
dials (this pass), F1–F3 (`Ref/COACH_CONTROLS_PASS.md`), and F4
(`Ref/PLAYBOOK_CONTENT_PASS.md`). The robber call is the first Part-1 dial live on the
F1 headset — the "considered and NOT proposed" list (coverage call sheet, custom
formations, editable vs-tilts) stands.
