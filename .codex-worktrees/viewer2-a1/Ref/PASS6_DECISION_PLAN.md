
---

# AS-BUILT (shipped 2026-08-09, build 6190dbe9bb)

All five items + verification shipped as planned. Deviations & notes:

- **G9**: shipped per plan. `fgMakeProb` exported; `fourthDownDecision` gained
  the optional `ctx = {fgProb, oppEdge}` 9th arg (absent = legacy verbatim).
  The kickWins damp firmed to ×0.25 veryLate / ×0.6 late (the first cut's ×0.5
  left "down 2, 0:35, 4th-and-4" a 34% gamble — real coaches kick ~always).
  oppEdge computed per 4th-down block from both rosters' composites (QB/RB/WR/
  TE/OL vs front-seven+DBs), clamp [−.15,+.35], positive-only application.
- **Fakes**: shipped per plan + one pricing fix: the pass-fake style bar
  (punter acc ≥52 for the 40% roll) starved the INT branch entirely for median
  punters — softened to 15% below the bar (pricing still reads acc). In-game:
  aggressive ≈0.2-0.4 fakes/game, conversion ~57% (anchor 55-60). The fake
  play record is `type:"fakePunt"|"fakeFG"` with style/converted/yards/
  runnerId/throwerId/targetId/snifferId/int/fumble; converted fakes continue
  the drive (fresh set), clock −6-10s.
- **Return scheme**: shipped per plan (returnOutcome 5th/6th args scheme+retLv;
  kickoffOutcome 5th arg + touchback bias ±; punt fair-catch share ±12/−8).
  Direct gates: wall 21.8 > bal 20.2 > safe 18.0 mean yds; wall house ×~6 safe.
- **AI formation sheets**: shipped per plan (AI_SHEET_TILT, 10 formations,
  feature 65-85 / damp 28-40, never 0). NOTE: the player's school also passes
  through setAIGameplan at world-gen, so new careers start with the staff's
  authored book visible in the Playbook tab (consistent with rpoRate/gadgetRate
  arriving pre-set; tap-to-inherit clears any tilt). `_aiAuthoredSheets` stamp +
  read-time `__noAIFormSheets` gate — player-authored sheets never gated.
- **Trick brain**: shipped per plan; posture mult (shots: 1+runCommitEff·0.03,
  two-shell ×0.75; reverse: crash ×1.8 / contain ×0.5) + weekly `_gadgetWk`
  (re-rolled like surpriseOnside, IQ-scaled). Probe: 3.3× call-rate split
  crash-commit vs disciplined; flat under `__noTrickBrain`.
- **Audit closures #10-12**: ALREADY CLOSED pre-pass (G10 openers offense-only,
  G11 pressureSource retired, state.js:748 already passes diffCoaching) — the
  plan misread the audit's historical numbered list; its own closing note says
  only G9 + formation sheets remained. No code needed.
- **Probe-craft (PROBE LESSON, 3rd recurrence)**: covfam_probe's Cover 6
  cloud gate flapped again on stream re-base (identical 54.8/54.6 across
  reruns — paired-seed). Root cause found: the WR1-short debit is the
  famLive-branch literal, NOT the C3 rotation constant. Both hoisted to C
  (`C6_CLOUD_WR1_SHORT` 0.04, `ROT_CLOUD_SHORT` 0.03, defaults unchanged) and
  the gate now runs amplified (0.14, margin 1.5) — 51.4 vs 54.6, clean.
  covfam 17/17. gadget_probe similarly hardened: reverse-ypc gate (±1.5 on a
  SD~9 read) split into direction-only ypc + a sniff-RATE gate (binomial:
  contain ~35-50% vs crash ~10%); its pass-5 resolution arms now run under
  `__noTrickBrain` so the new call brain can't shrink their samples.
- **Growth**: gs.stFakeConvs (→gadgetAce ×2) / gs.stFakeSniffs (→filmJunkie);
  fake yardage books as real rush/pass/rec stats to the men who made it.

**Verification (all green, 2026-08-09):** fourth_down (5 legacy + 8 WP gates) ·
st_fake (6 direct + 6 game) · st_net report-in-band + 4 scheme gates ·
formation_playbook 9/9 · gadget (brain gates PASS; two pass-5 whole-game reads
— shot comp% margin, toss-back tax margin — remain in the seed-flaky family,
rerun clears) · pass6_band_ab N=300×3 LIVE drift pts 0.12 rush 0.99 pass 3.75
comp 0.06 sacks 0.03, AMP inside 2× · stat_realism N=500 same three
pre-existing flags, sacks 2.20 in target · covfam 17/17 · defcall 32 · mug 8 ·
amoeba 7 · defmesh 20 · traits 24 + growth 14 · rpo_conflict · choice_route ·
situational · kneel_timeout · coach_controls · save_migration · save_safety ·
midgame_save · playnow E2E · playnow multiplayer · ui_playcall · halftime ·
formation_sheet_ui · defcall_ui · st_ui (new) · build 6190dbe9bb · boot 0.

**Kill-switches added:** __noWP4th · __noSTFakes · __noRetScheme ·
__noAIFormSheets · __noTrickBrain.
