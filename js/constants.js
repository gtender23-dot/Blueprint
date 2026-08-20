var SAVE_VERSION, C, OVR_POS_ADJ, POS_WEIGHTS, ROLE_WEIGHTS, FRONT_ROLES, OUT_OF_POS, SUB_ADJACENT, SLOT_ELIGIBILITY, ARCHETYPE_DISTANCE, OFF_ROLE_BY_PLAY, FORMATION_ROLE_OVERRIDE, OFF_WEIGHTS, DEF_WEIGHTS, FORMATION_PACKAGES, FORMATION_WEIGHTS, DEF_FRONTS, DEF_FRONT_WEIGHTS, MATCHUP_MATRIX, FORMATION_SITUATIONAL, PRACTICE_SECONDARY, PRACTICE_TOOLS, DEFAULT_PRACTICE, PASS_TENDENCY, POSITIONS, ATTRIBUTES, MEASURED_ATTRS, ATTR_LABELS, attrLabel, PENALTY_CATALOG, CLASS_YEARS, ROSTER_TARGETS, STARTER_COUNTS, ROSTER_POS_MIN, ROSTER_POS_MAX, DEF_FRONT_COUNTS, FORMATIONS, FORMATION_ALIAS, aliasFormation, ATTR_FLOORS, RECRUIT_CORE, SIZE_BANDS, FORMATION_PLAYBOOK, FORMATION_VARIATIONS;

SAVE_VERSION = 16;
C = {
  // ── Division / world structure ────────────────────────────────────────────
  PRESTIGE_MAX: { D3: 3, D2: 4, D1: 6 },
  // G8 (Aug 2026): icing the kicker — share of would-be clutch makes shaken
  // loose by a pre-kick timeout. Real-world studies put icing between nothing
  // and a few points of accuracy; we sit at the modest end. [TUNE]
  ICE_KICKER_EFF: 0.04,
  // Share of AUTO goal-line snaps (ball inside the 5) that go to the team's
  // derived goal-line package; the rest splits among the standing looks by
  // weight. Deliberately not 100% — even at the 1 a staff shows its base
  // offense some of the time, and a coach who wants the heavy set on every
  // snap can pin it in the Situations editor, which still outranks this.
  // Applied at the SITUATIONS layer, never through FORMATION_SITUATIONAL:
  // that table is an EFFICIENCY multiplier, and letting it drive call rate too
  // would double-count (called more often AND better, compounding). [TUNE]
  GOAL_LINE_HEAVY_SHARE: 0.6,
  // ── THE BLITZER LIST (2026-08-19, replaces the pressure pie) ──────────────
  // A coach names a few men and tags each Often or Sometimes. No percentages,
  // no sum constraint, no ordering — the SEAT COUNT does the work: more names
  // than seats gives rotation, names equal to seats gives determinism.
  // RELATIVE weights only; nothing has to add up to anything. [TUNE: 3:1 is a
  // starting point, to be set by watching games — the probe reports the
  // realized split rather than anyone asserting it.]
  BLITZER_WEIGHT: { often: 3, sometimes: 1 },
  // The list is a PREFERENCE, not a law (owner call). Chosen over an exclusive
  // list for two concrete reasons: an exclusive list BREAKS when its men are
  // not on the field (Dime package, injury, fatigue rotation), and a fully
  // deterministic list is fully scoutable by an opponent with memory.
  // A sharp coordinator stays on script; a poor one improvises — so the leak
  // is highest at Blitz Design 0 and shrinks as the DC gets better. [TUNE]
  BLITZ_OFFLIST_MAX: 0.3,
  // Where a route is CENTRED as a share of the room to the back of the end
  // zone. The catch point sits in front of the boundary — a fade goes to the
  // pylon, not to the back line. Only binds near the goal line; at midfield the
  // room dwarfs every route band and the draw is untouched. [TUNE]
  REDZONE_ROUTE_CEIL: 0.7,
  // The over-the-shoulder deep ball needs grass behind the defender. Inside
  // this much room there is none, so the vdeep band cannot open. [TUNE]
  VDEEP_MIN_ROOM: 30,
  // Coverage side of the shrinking field. With no grass behind them defenders
  // squat on everything underneath, so separation collapses as the ball nears
  // the end zone. Ramps in from COVER_COMPRESS_START yards out — the vertical
  // threat is already dying well before the goal line, which is the owner's
  // "can't take the top off from 15 yards out anymore". [TUNE]
  COVER_COMPRESS_START: 20,
  COVER_COMPRESS: 0.11,

  // per-division prestige ceiling (Chunk 5 rescale)
  // Tier-based talent generation (tier: 1=D3, 2=D2, 3=D1)
  // Arrival rebalance: players START ~7 lower than before while POTENTIAL_BAND
  // widens +7, so ceilings are untouched — value moves from arrival to growth.
  // Freshmen now enter below the starter line and grow into it (growth is
  // headroom-proportional, so the wider gap accelerates development for free).
  DIV_BASE_BY_TIER: { 1: 19, 2: 33, 3: 49 },
  // attr base mean per tier [TUNE]
  CORE_CAP_BY_TIER: { 1: 78, 2: 88, 3: 95 },
  // core-attr mean ceiling per tier [TUNE]
  PHYS_CAP_BY_TIER: { 1: 70, 2: 84, 3: 99 },
  // BASE ceiling on POTENTIAL for every attribute EXCEPT the intangibles WE & CON
  // (see CAPPED_ATTRS), per tier (1=D3,2=D2,3=D1). This is the ceiling he develops
  // toward, NOT where he spawns. Elite D3 tops out ~70; D2 ~84; D1 uncapped. This is
  // a SOFT cap — a high-work-ethic grinder can push a little past it (see CAP_WE_OVERAGE).
  CAPPED_ATTRS: ["SPD", "AGI", "PWR", "STR", "JMP", "HND", "SEC", "TEC", "AWR"],
  // every attribute the division ceiling applies to (all but WE & CON)
  CAP_WE_OVERAGE: { pivot: 55, step: 0.22, max: 7 },
  // Archetype cap tilt: the division ceiling is not a flat wall on every attribute.
  // At generation it tilts UPWARD toward the player's archetype — the attributes it
  // leans on hardest earn headroom ABOVE the base division cap (a D3 burner can be
  // genuinely fast), while everything else stays exactly AT the cap. Nothing is ever
  // capped below the division line; the cap is a floor a signature trait can break.
  // Bigger = more headroom on signature traits, and a higher roster ceiling.
  PHYS_CAP_ARCH_SPREAD: 6,
  // Work ethic bends the cap: a grinder outworks his measurables. WE above `pivot`
  // adds `step` per point to the POTENTIAL ceiling of the capped attrs, up to `max`.
  // WE 80 in D3 → +~6 (a 70 base becomes ~76); WE 50 → +0 (stays 70). This is what
  // makes the cap feel natural — effort earns a little headroom past the division line.
  PHYS_SPAWN_HEADROOM_BY_TIER: { 1: 10, 2: 8, 3: 0 },
  // On generation, a lower-division player's starting physical attribute is held
  // this far BELOW the potential cap (freshmen especially), so there's real room
  // for camp/development to grow him UP toward the ceiling over his career. D1 is
  // already near his ceiling on arrival (0 headroom); D3 arrives raw and develops.
  // The RAS gate: elite athleticism can't roll in a lower division — a 90+ speed
  // athlete only exists in D1, an 83+ only in D2 or above. Applied AFTER the freak-
  // athlete roll + archetype boosts so those can't blow past the division band.
  // This is what makes D1 look faster than D2 look faster than D3 on film.
  STAR_RATE_BY_TIER: { 1: 0.1, 2: 0.18, 3: 0.3 },
  // elevated-recruit fraction per tier [TUNE]
  PRESTIGE_STAR_W: 0.02,
  // star-roll prob shift per prestigeBonus pt. [playtest item 18, 2026-08-12]
  // 0.01→0.02 so prestige moves the roster within a division; the coupling bonus
  // is now division-relative (prestigeTalentBonus) — see js/engine/world.js.
  PRESTIGE_BAND_W: 0.02,
  // great+sky band mass shift per prestigeBonus pt [playtest item 18: 0.01→0.02]
  // Randomized conf sizes — mix produces ~100 schools/div organically (spec §B.2).
  // Ranges chosen as even-only (world.js snaps odd draws up) so the circle-method
  // scheduler never needs a dummy-bye — every team gets exactly CONF_GAMES games.
  D1_POWER_CONF_SIZE: [10, 12],
  // [TUNE] 4 power confs → 40–48 D1 power schools
  D1_MIDMAJOR_CONF_SIZE: [10, 12],
  // [TUNE] 5 mid-major confs → 50–60 D1 mid-major schools
  D2_CONF_SIZE: [10, 12],
  // [TUNE] 10 D2 confs → 100–120 D2 schools
  D3_CONF_SIZE: [10, 12],
  // [TUNE] 8 D3 confs → 80–96 D3 schools
  CHEAP_SPREAD: 6,
  // [TUNE] logistic denominator for cheapSimGame strength comparison
  CHEAP_MARGIN_SD: 14,
  // [TUNE] score margin std-dev in cheapSimGame
  CHEAP_HOME_EDGE: 2.2,
  // [TUNE] composite-rating home advantage pts in cheapSimGame
  BOWL_TOP_N: 50,
  // [TUNE] D1 bowl eligibility cutoff (top-N non-playoff D1 teams)
  BOWL_COUNT: 16,
  // [TUNE] number of D1 bowl games per season
  // ── Matchup engine rep constants ─────────────────────────────────────────
  // K_CONTEXT: primary favorite-win-rate knob.  Higher = weaker per-rep talent
  // edge (offUnit−defUnit has less effect per rep).  Lower = more deterministic.
  K_CONTEXT: 145,
  // REP_SCALE: spread of the per-rep sigmoid.  Lower = individual attributes
  // matter more per 1v1 matchup.  24 gives ~56% block win at +6 attr gap.
  REP_SCALE: 24,
  // Run outcome constants
  QB_CARRIER_BONUS: 0.9,
  // yard/carry offset for QB carriers (RB-tuned anchors sit above QB attrs)
  CARRY_FUMBLE_BASE: 0.01,
  // per-carry fumble risk on non-QB runs (risk parity vs passing)
  // Pass outcome constants
  // Run Commit (situational box bias, −25..+25). Positive = sell out vs run:
  // defense plays stronger on run snaps but every receiver gains separation.
  // RUN_SCALE multiplies defUnit on run plays; COV_SCALE shifts separation/pt.
  // ── Batted passes (Jul 2026: JMP gets a job in the box) ──────────────────
  // A rusher who can't get home gets his hands up. Real football event we
  // never modeled: ~1.5% of throws, driven by JMP + AWR + height, and it's
  // the ONLY place a DL's leaping ability matters. Batted = incompletion,
  // with a small tip-drill INT chance behind it.
  BAT_BASE: 4e-3,
  // per-DL bat chance — rolled for each lineman
  // still at the line, so 3-4 rolls compound into
  // the ~1.5/gm team rate.
  BAT_JMP_SCALE: 3e-4,
  // per point of JMP over 50 (the star term)
  BAT_AWR_SCALE: 22e-5,
  // hands up = reading the QB's eyes
  BAT_HEIGHT_SCALE: 16e-4,
  // per inch over 74" (6'2")
  BAT_CAP: 0.045,
  // a freak DL tops out here
  BAT_SHORT_MULT: 1.35,
  // quick game = ball in the DL's window
  BAT_DEEP_MULT: 0.45,
  // deep drops clear the line
  BAT_TIP_INT: 0.11,
  // batted balls that become tip-drill picks
  // ── Downfield tip-drill (M25) ────────────────────────────────────────────
  // A broken-up ball is briefly live: if a second defender (the deep helper /
  // robber — a real man already reading the throw) is on the play, he can
  // snatch the carom. The tipper keeps his PBU, the catcher books the INT —
  // one play, two credits, exactly how a tip-drill pick is scored in real
  // football. Kept rare: most swats hit the turf.
  TIP_DRILL_INT: 0.015,
  // per-PBU chance the helper wins the carom (ballHawk-scaled). Measured
  // (tipdrill_ab, 2026-08-10): ~0.1 per team-game — one tip-drill roughly
  // every 5 games watched, ~13% of a defense's INTs. The real-football
  // share, and small enough that the INT% band barely moves.
  RUNCOMMIT_RUN_SCALE: 0.028,
  RUNCOMMIT_COV_SCALE: 12e-4,
  // Tempo: scales seconds-per-play. Hurry adds possessions for BOTH teams but
  // taxes fatigue (offense can't rotate, defense can't sub) — not a free lunch.
  // [TUNE 2026-08-14] Narrowed the spread: the old 1.25/0.72 gave a 1.74x snap
  // ratio (~55 Chew vs ~95 Hurry), which made Hurry a stat/development exploit.
  // 1.18/0.86 = ~1.37x (~61 vs ~84) — Hurry is still clearly the fastest tempo
  // without doubling anyone's reps. Only affects games where a team PICKS a
  // tempo; the default is Normal (=1), so stat_realism/AI baselines are untouched.
  TEMPO_MULT: { Chew: 1.18, Normal: 1, Hurry: 0.86 },
  TEMPO_FATIGUE_OFF: 1.6,
  // on-field fatigue gain multiplier on Hurry snaps (offense) [TUNE Jul 2026: 1.35→1.60 — slower base clock means fewer Hurry snaps, tax needed a bump to stay visible]
  TEMPO_FATIGUE_DEF: 1.38,
  // same for the defense stuck on the field [TUNE Jul 2026: 1.20→1.38, same reason]
  // from a 0.008 experiment that over-cooled the average
  // passing game without fixing elite-pass win%.)
  // [Jul 2026] Superseded in catchResolution by the
  // COMP_QB_EXEC_* blend below; kept for reference.
  // ── Execution texture (Jul 2026) — the "D3 looks like D1" fix ──────────
  // Both mechanics add an ABSOLUTE skill term to contests that were purely
  // relative, so lower divisions (and bad units inside a division) play
  // messier instead of being pixel-identical to elite ones.
  // Pass-pro execution: protections are assignments, not just 1-on-1 reps.
  // Low-craft blockers bust slides/stunt pickups beyond the head-to-head
  // margin. Applied to PASS sets only (run blocking is simpler execution and
  // D3 run YPC was already below real). Center = D1 starter pass-blend (~93).
  TRENCH_EXEC_CENTER: 93,
  TRENCH_EXEC_SCALE: 0.15,
  // margin pts per blkVal pt below center (D3 starters ~63 → −4.5 margin → ~+1.5-2.5 sack%/dropback)
  // QB execution: completion% now keys on a TEC+AWR blend with a real slope,
  // recentered at the D1 starter blend (~91) with a flat recenter so D1 stays
  // ~62%. D3 QBs (~61 blend) land ~57-58%, elite spread compresses to real.
  COMP_QB_EXEC_CENTER: 91,
  COMP_QB_EXEC_SCALE: 0.0184,
  COMP_QB_EXEC_CAP: 0.06,
  // positive excursion cap above COMP_RECENTER — accuracy has a ceiling (elite QB comp% band 68-72)
  // QB arm: the zip/reach behind the throw. PWR drives a short ball into a tight
  // window, STR carries a deep shot, medium blends the two. Centered at 50 (average
  // arm neutral); ~+0.24 on the completion logit for a 90-armed QB, ~-0.12 for a 30.
  COMP_ARM_SCALE: 6e-3,
  // A weak arm hangs a deep ball — underthrown shots get picked. On DEEP throws this
  // scales INT rate off STR: a 30-STR QB ~+1.16x picks, a strong arm slightly fewer.
  INT_ARM_SCALE: 8e-3,
  COMP_RECENTER: 0.32,
  // [TUNE Jul 2026: 0.37→0.32 — Phase-2 AI plans (fitted target shares/formations) added ~2 comp% league-wide; recentered back to D1 ~62-64]
  // Breakaway pursuit relief: slow chase speed lowers the effective SPD floor.
  // REF ≈ D1 pursuit blend (deep DBs + LBs); relief 0 at/above REF, so D1 is
  // untouched. D3 pursuit (~60) hits the cap → a 60-SPD D3 back can break away.
  // Pursuit execution: absolute rally/angle quality of the chase defense
  // (SPD/TKL/AWR blend). Below center, the run mean gets yards back — the
  // defensive mirror of TRENCH_EXEC. Zero at/above the D1 pursuit blend.
  // as a depth-weighted TECH-GAP (recTECH − defTECH) to
  // separation. NET ZERO at equal TECH (calibration-safe).
  // At a 25-pt TECH edge on a short route: +0.05 sep
  // (~a 4-pt edge in the main blend). Deep routes get
  // ~1/3 weight — technique yields to the footrace.
  SIZE_MISMATCH_SCALE: 0.04,
  // Contested-catch height advantage. (WR heightInches −
  // DB heightInches) shifts catch prob on CONTESTED throws
  // only (low sep) at medium/deep depth — the jump-ball /
  // high-point mechanic. Net-zero at equal height: only a
  // height MISMATCH tips the ball. Gated by (1 − sep) so
  // it vanishes on wide-open throws and peaks on tight-
  // window 50/50s. A 6" edge (6'5" WR over 5'11" DB) on
  // a 50/50 ball adds ~+3.5pp catch%; net-zero across
  // symmetric rosters (protects calibration).
  HURRY_PENALTY: 0.22,
  // catch prob reduction when hurried
  DROP_BASE: 0.065,
  // dropProb = DROP_BASE − HND × DROP_HND_SCALE
  DROP_HND_SCALE: 8e-4,
  INT_READ_SCALE: 0.066,
  // lowered: overall INT level was ~3.7%, target ~2.3% [TUNE Jul 2026: 0.072→0.066 — comp% recalibration meant more incomplete branches reaching the INT roll, pushing team INT% to 2.75; this restores ~2.3-2.5]
  INT_QB_SUPPRESS: 0.018,
  // QB GI/TECH suppression slope for INT rate (centered at 75)
  PASS_RUSH_PRESSURE: 0.45,
  // sack conversion: P(sack)=collapseFrac^2 × this. Higher = more sacks + pass risk. [TUNE Jul 2026: 0.32→0.48 — sacks were ~1.5-1.7/team-game (~4.4%) vs real ~6-7%. RETUNE Rung 3: 0.48→0.45 — the phantom-blitz fix means AI blitz downs finally SEND the extra man; with real free rushers league-wide, 0.48 pushed sack% past 7 (and 0.42 sagged to 5.1). Same real blitzes, honest conversion.]
  // ── Creeper / four-man scheme-free lever (Fix A, pass-rush pass 2) ─────────
  // A four-man rush (NO blitz fired) can still free ONE rusher by SCHEME — the
  // creeper/vise/read-the-set outcome the sources hammer: the defense sets the
  // protection the wrong way and a rusher comes clean without adding a body.
  // P(free) = clamp(CREEPER_BASE + (blitzDesign−50)·CREEPER_DESIGN
  //                   − (centerAWR−50)·CREEPER_AWR, 0, CREEPER_CAP) × protRedirect.
  // Deliberately near-zero at neutral design + average OL so it REDISTRIBUTES
  // pressure toward well-schemed defenses vs poorly-set OLs rather than inflating
  // the league sack total (which already sits at the top of its band). Tuned by
  // tools/creeper_probe.mjs + stat_realism (sacks/team must stay ≤ ~2.3).
  CREEPER_BASE: 0.02,
  // floor free-rate at neutral (design 50) vs an average-AWR line
  CREEPER_DESIGN: 0.0024,
  // per pt of Blitz Design above 50: a sharp DC schemes it, a poor one doesn't
  CREEPER_AWR: 0.0018,
  // per pt of center/interior AWR above 50: a heads-up line reads & redirects it
  CREEPER_CAP: 0.14,
  // ceiling: even the best-schemed pressure vs a lost OL frees a man ~1 in 7
  CREEPER_PROT_MAX: 0.5,
  // Max Protect: extra bodies + no one released — hardest to fool
  CREEPER_PROT_BOB: 1.1,
  // BOB man protection: cleanest 1-on-1s but a wrong-set man loses cleanly
  CREEPER_PROT_QUICK: 0.6,
  // Quick game: ball's out before the free man arrives — the built-in answer
  // ── Chip protection (Fix B, pass-rush pass 2) ─────────────────────────────
  // A released back on Half-Slide/BOB can bump ONE edge penetrator on his way
  // out — the bump buys the QB the beat he needs, so that rusher no longer gets
  // home this rep. P(chip absorbs the edge) = clamp(CHIP_BASE + (chipper STR/AWR
  // − 50)·CHIP_SKILL − (rusher PWR − 50)·CHIP_VS_PWR, 0, CHIP_CAP). Prefers the
  // speed/edge rusher (who a back can actually redirect); a bull-rush PWR edge
  // shrugs the chip. Lowers edge pressure slightly — must NOT sag sacks below
  // band. Tuned by tools/chip_probe.mjs + stat_realism.
  CHIP_BASE: 0.36,
  // floor chance a released back's chip takes the primary rusher out of the rush
  // for the beat the QB needs. A firm bump on the man who's winning really does
  // buy that beat a meaningful share of the time; [TUNE: 0.24→0.36 — at 0.24 the
  // effect was below the game-level noise floor, chip_probe couldn't resolve it].
  CHIP_SKILL: 0.006,
  // per pt of the chipper's (STR+AWR)/2 above 50: a stout, aware back chips well
  CHIP_VS_PWR: 0.004,
  // per pt of the rusher's PWR above 50: a bull-rusher runs through the chip
  CHIP_CAP: 0.6,
  // ceiling: a chip is a bump, never a full block
  // ── Align-to-win: schemed matchup (Fix C, pass-rush pass 2) ───────────────
  // The defense flips alignment to put its BEST rusher on the WEAKEST blocker
  // (or the RB) — the "guard-on-an-island" / X-rusher idea (#5, #14, #30).
  // With prob = clamp(ALIGN_BASE + (blitzDesign−50)·ALIGN_DESIGN − (centerAWR−50)
  // ·ALIGN_AWR, 0, ALIGN_CAP), swap so the top rush-grade rusher faces the low
  // block-grade blocker. Bounded to ONE swap; the reps still resolve through the
  // same blockRep, so this only re-pairs — it doesn't add pressure directly.
  // A heads-up line re-sets and denies it. Highest stat-realism risk of the four
  // fixes (touches matchup quality league-wide) — tuned by tools/align_probe.mjs
  // + stat_realism, kept small so the mean sack level holds.
  ALIGN_BASE: 0.14,
  // floor chance the defense wins the alignment chess vs an average line
  ALIGN_DESIGN: 0.004,
  // per pt of Blitz Design above 50: a sharp DC schemes the isolation
  ALIGN_AWR: 0.003,
  // per pt of center AWR above 50: an aware line re-identifies and re-sets
  ALIGN_CAP: 0.45,
  // ceiling: even a great scheme vs a lost line wins the matchup < half the time
  ALIGN_EDGE: 0.4,
  // the isolated standout's two-way-go advantage: a rush-context boost on his
  // one rep (added to the pre-sigmoid margin — a firm but not automatic edge)
  STRIP_SACK_RATE: 0.45,
  // fraction of sacks that force a fumble (then 40% def recovery).
  FUMBLE_HND_SCALE: 7e-3,
  // HND ball-security lever (raised from 0.0035, which
  // was below the noise floor). At HND 88 → 0.73x fumble
  // chance; HND 42 → 1.06x; rating extremes hit the
  // widened clamp below. Produces ~2x+ spread between
  // sure-handed and fumble-prone carriers, matching real CFB.
  // ── Broken-tackle mechanic (Gap 2) ──────────────────────────────────────
  BROKEN_TKL_SCALE: 0.016,
  // ELU-vs-TKL: each net point (carrier ELU − defender
  // TKL) shifts broken-tackle chance by this much. At a
  // +20 ELU edge → ~12% to break the first attempt.
  BROKEN_TKL_BASE: 0.03,
  // floor break chance at equal ELU/TKL (even great
  // tacklers whiff occasionally).
  PASSPRO_CENTER_ADJ: 11.5,
  // recenters the pass-set blend (PWR/STR added, PWR mean runs low) [parity-probed]
  RUNBLOCK_CENTER_ADJ: 10.7,
  // Phase 1a: run blend runs ~2.7 below the old BLK blend — recentered to hold [measured]
  OL_MOBILITY_PIVOT: 20,
  // OL AGI/SPD population mean (measured ~19.7/19.8) — the mobility term is neutral for an average-footed lineman.
  OL_MOBILITY_SCALE: 0.7,
  // MOBILITY for the athletic blocks: a lineman who can move seals the reach on an outside run and arrives square on a pull; a statue gets there late and off-balance. AGI/SPD above the OL mean add, below subtract. Applies ONLY to the reach POA reps on outside runs and the puller's kick-out — general drive/pass blocking has no AGI term (removed in Phase 1a by design).
  OL_PASS_MIRROR_SCALE: 0.34,
  // FEET in pass pro: a light-footed tackle mirrors the edge and stays in front; a statue gets beaten around it. AGI above the OL mean helps, below hurts — biggest vs a speed rush (kick-slide/redirect), 40% as much vs an interior bull. Centered at the OL AGI mean so the mean pass set is unchanged; only the spread by footwork moves.
  RUSH_SPEED_CENTER_ADJ: -5.5,
  // finesse-path recenter; tuned to land sacks ~2.1 in the BLK+TKL-retired trench [150g probed]
  RUSH_POWER_CENTER_ADJ: -3.5,
  // Phase 2a-i: empirically tuned with speed path [probed]
  SHED_CENTER_ADJ: 4.6,
  // Phase 2a-i: holds run ceiling; shed ran ~2.7 low once TKL→AWR [measured]
  RUSH_S2P_CENTER_ADJ: 2.3,
  // recenters max(speed,power) for speed-aligned reps [parity-probed]   // recenters PWR+STR power path [parity-probed]
  JUMP_BALL_SCALE: 0.01,
  // JMP gap → catch logit on tight windows (Phase 3) [TUNE]
  BROKEN_TKL_CENTER_ADJ: 8,
  // recenters max(evade,truck); raised 5→8 when the def tackle rows went 46% measured (def means fell ~3) [TUNE via tools/broken_tackle_check.mjs]
  BROKEN_TKL_CAP: 0.4,
  // ceiling: nobody breaks more than 40% of attempts.
  BROKEN_TKL_WEIGHT_SCALE: 15e-4,
  // heavier back is harder to bring down: each lb
  BROKEN_TKL_AWR_SCALE: 18e-4,
  // VISION setup: a back who read the field makes the defender arrive off-angle, so he slips more attempts. Centered at the ~41 natural carrier AWR mean (league-neutral); a 90-AWR back ≈ +0.09 break chance.
  // of carrier weight above 210 adds to break chance.
  WEIGHT_FF_SCALE: 3e-3,
  // ball-security weight term: a heavier back is harder
  // to strip. Centered at 210 lb (no adjustment); each lb
  // above reduces forced-fumble chance, each lb below
  // raises it. Secondary to DUR — a ~±8% nudge at the
  // wings of the RB weight range (185 scat ↔ 235 power),
  // clamped so it modifies rather than dominates the strip.
  // ── Run scheme identity (subsystem 3: the read, the scheme, the fit) ─────
  // All four levers are REDISTRIBUTIVE — they add matchup/scheme/read variance
  // and are centered so the pool-average case is unchanged (the run game already
  // sits in-band: RB YPC top-of-band, team rush at the floor, so a mean-lift is a
  // veto risk on sight). Each is gated (globalThis.__noRead/__noScheme/__noSpill/
  // __noBoxCount) for clean probe on/off toggling.
  READ_VISION_PIVOT: 41,
  // carrier AWR mean (matches the natural ~41 carrier-AWR the broken-tackle AWR
  // term is centered on) — the read is neutral for an average-vision back.
  READ_CUT_GAIN: 0.9,
  // Fix A: the back's dive/bounce/cutback read. On a zone concept, a back who
  // reads the playside penetrator's side correctly sharpens his LOS bend toward
  // the open cut; a poor read bends the wrong way. Scales the existing see-radius
  // bend by (AWR-pivot); centered so the mean back's bend is unchanged — pure
  // variance around today's YPC, not a lift.
  READ_CUT_CAP: 0.35,
  // clamp on the read's bend multiplier so a genius back can't teleport laterally.
  SCHEME_CLIMB_GAIN: 0.14,
  // Fix B: zone identity. A won zone rep sends the combo blocker CLIMBING to the
  // second level - the near LB is harder to reach clean (higher blockedP) but,
  // when reached, the back is already past the first level. Gap concepts skip
  // this (down-block + pull make a cleaner but narrower POA, handled by the puller
  // path + SPILL_EDGE below). Mean-neutral: it moves WHERE the yards come from.
  SCHEME_GAP_POA: 0.05,
  // Fix B: gap identity. A pulled concept (Power/Trap/Counter) tightens the POA -
  // the down-block wall + puller give the back a cleaner first read (lower LB
  // interference at the point) - but leaves a defined edge the defense can spill
  // (SPILL_EDGE). Small, and offset by the spill risk so the pair is neutral.
  SPILL_EDGE: 0.16,
  // Fix C: a CRASHING edge spills the run outside into unblocked pursuit. Raises
  // the penetrator's outside-leverage (more TFLs when the spill is sound) AND, if
  // the back bounces it clean, opens the perimeter (more breakaways when the fit
  // is wrong). A CONTAIN edge boxes it back inside (opposite sign). The two tails
  // net out - it is a TRADEOFF (variance), not a mean move.
  SPILL_TFL_SHARE: 0.55,
  // of the spilled reps, this share arrive as a stop-for-loss; the rest leak
  // outside as a bounce. Tuned so the spill is genuinely two-sided.
  BOXCOUNT_PEN_GAIN: 0.06,
  // Fix D: box-count integrity. Each defender in the box beyond the blocker count
  // (the "plus-one" fitter) raises the inside-run penetrator odds by this much -
  // stacking the box actually stuffs the inside run. This is the ONE lever that
  // CAN move the mean, so it is tuned directly against the 150-200 rush / 4.2-4.6
  // YPC bands, not just neutrality. Applies to inside runs only; the vacated edge
  // is already handled by the pass/edge model.
  BOXCOUNT_CAP: 0.18,
  // ceiling on the loaded-box penalty so an 8-in-the-box look stuffs but doesn't
  // erase the inside run.
  // ── Trench size reps (BLK realism) ──────────────────────────────────────
  BLOCK_SIZE_SCALE: 0.1,
  // weight-gap term in blockRep. (blocker − rusher) lbs
  // shifts the rep: a heavier interior rusher (big NT)
  // anchors/bull-rushes through a lighter blocker; a
  // heavier blocker walls off a lighter one. Net-zero at
  // equal weight (protects run ceiling). Added to the
  // pre-sigmoid (blkVal − rushVal), so a +13 lb NT edge
  // moves blocker-hold ~−0.8pp, a +44 lb mismatch ~−2.7pp.
  BLOCK_SIZE_EDGE_MUTE: 0.25,
  // on edge reps, size matters far less — the edge wins
  // with speed/leverage around the block, not mass, and
  // tackles already outweigh edge rushers. Mutes the size
  // term to a quarter on edge reps so it doesn't wrongly
  // hand every speed rush to the heavier tackle.
  VDEEP_SEP_THRESHOLD: 0.74,
  // separation needed to enter vdeep band
  VDEEP_PROB: 0.44,
  // chance of vdeep yards given separation > threshold
  PAT_RATE: 0.96,
  // Subsystem 6 (special teams, Aug 2026): the PAT is no longer a flat league constant —
  // it reads the kicker. xpMakeProb centers make% on PAT_RATE at PAT_PIVOT accuracy
  // (0.5*TEC+0.5*AWR) and scales each point off it, so a shaky kicker misses more XPs and
  // an elite one is near-automatic, mean-preserving to the ~0.96 league rate.
  PAT_PIVOT: 55,
  PAT_ACC_SCALE: 0.045,
  HOME_EDGE: 1.1,
  // ── Game-day form (Jul 2026) — the upset mechanic ────────────────────────
  // One roll per team per game, applied as a symmetric unit-strength
  // multiplier exactly like HOME_EDGE: a flat team is worse on offense AND
  // easier to move the ball on. This is the correlated noise real football
  // has (emotional flatness, matchup prep, injury niggles) that per-play
  // dice can't produce — it's what lets a 3-touchdown underdog actually win.
  // Tuned via calibration_harness strong-vs-weak (target 80-90%).
  FORM_SIGMA: 0.08,
  // sd of the per-team form multiplier (1.0 = normal day)
  FORM_CLAMP: 0.2,
  // hard cap: no team plays >±15% off its true level
  FORM_ATTR_SCALE: 45,
  // form → attribute points: (form−1)×45, so a −1σ day ≈ −2.7 pts on every on-field player. This is the channel with real upset leverage — the unit multiplier alone couldn't reach the per-rep contests where talent lives.
  // Penalties (drive-level model). Per-play flag probability, split into offensive
  // (mostly pre-snap: false start / holding → replay the down with yards lost) and
  // defensive (offside / DPI / holding → auto first down or spot foul). Tuned so a
  // team draws ~5–7 flags / ~50–60 yards per game across ~75 plays.
  PENALTY_PER_PLAY: 0.075,
  // chance any given snap draws a flag
  PENALTY_OFF_SHARE: 0.55,
  // fraction of flags that are on the offense
  // Discipline weighting: a player's flag likelihood scales with (85 − attr)/40,
  // clamped — an undisciplined 45-GI lineman draws flags ~2x as often as an 85.
  PENALTY_DISC_PIVOT: 85,
  PENALTY_DISC_DIV: 40,
  // Team-level flag-rate scaling: a less-disciplined team (lower avg GI/TECH)
  // commits more penalties overall. Gentle and hard-clamped so GI's wide range
  // can't blow the rate up — D1 ~0.86x, D2 ~1.0x, D3 ~1.11x the base rate.
  PENALTY_TEAM_PIVOT: 50,
  // league-average team discipline → 1.0x
  PENALTY_TEAM_DIV: 120,
  // larger = gentler slope
  PENALTY_TEAM_MIN: 0.8,
  // hard floor (most-disciplined team)
  PENALTY_TEAM_MAX: 1.3,
  // hard ceiling (least-disciplined team) — the safety rail
  // Formation-IQ pre-snap penalty scaling (Chunk 12) [TUNE]. Offense-only — a
  // staff unfamiliar with its formation package (a new OC, a scheme switch)
  // draws more false starts / illegal motion / delay of game. A well-drilled
  // one (IQ at/above the pivot) sees no change.
  // The IQ here is the OC's weighted package familiarity (staff.js
  // coordPackageIQ; unknown schemes read 48), so the pivot sits at the
  // fresh-hire baseline — familiarity grown over seasons buys flags off.
  PENALTY_IQ_PIVOT: 45,
  // familiarity IQ at/above which no extra flags (~1.0x)
  PENALTY_IQ_DIV: 50,
  // divisor: how fast low IQ ramps the multiplier
  PENALTY_IQ_MAX: 1.6,
  // cap: worst-case familiarity = up to +60% pre-snap flags
  // ── Return game ────────────────────────────────────────────────────────
  // Returner is the best 'Returner'-role player among RB/WR/CB/S. Return yards
  // scale with (returner rating − coverage strength); a rare breakaway can take
  // it to the house (~1-2% of returns for a good returner).
  KICKOFF_TOUCHBACK_BASE: 0.62,
  // baseline touchback fraction (modern deep kicks)
  KICKOFF_RETURN_BASE: 19,
  // [TUNE subsystem 6 Aug 2026: 23->19] in-game KO return mean measured 26.7 (returner-vs-
  // coverage edge + spread rides above base); real traditional KO return avg ~20-22. Base 19
  // lands the mean ~22. Isolated to kickoffs (punt returns use PUNT_RETURN_BASE).
  // avg kickoff return yards at neutral matchup
  KICKOFF_START: 25,
  // touchback / dead-ball start line
  PUNT_RETURN_BASE: 6,
  // [TUNE subsystem 6 Aug 2026: 8->6] returned punts were averaging ~9.6 (real ~8); with the
  // punt base at 39, this lands punt NET ~40 (gross ~44 minus return), real net ~40-42.
  // avg punt return yards at neutral matchup
  RETURN_EDGE_DIV: 7,
  // rating-gap → yards divisor
  RETURN_SPREAD: 13,
  // PASS 6 (probe-craft): the Cloud rotation's boundary-short separation debit,
  // hoisted from a sim.js literal so covfam_probe can run its Cover 6 gate at
  // an amplified dial (mug/amoeba precedent — the stock-dial margin sits on the
  // paired-seed noise floor and re-bases every time a pass adds RNG draws).
  ROT_CLOUD_SHORT: 0.03,
  // PASS 6 (probe-craft): Cover 6's cloud-corner boundary-short debit (the
  // famLive branch, distinct from the C3 rotation above) — the actual lever
  // under covfam_probe's flapping WR1-short gate.
  C6_CLOUD_WR1_SHORT: 0.04,
  // return-yardage variance (±)
  RETURN_TD_DIV: 1e3,
  // breakaway-chance divisor (higher = rarer) [TUNE Jul 2026: 650→1000 — once the probe was un-broken, TDs measured ~1 per 7 games; real is ~1 in 25+]
  RETURN_TD_MAX: 0.04,
  // per-return breakaway ceiling [TUNE Jul 2026: 0.06→0.04]
  PUNT_FAIR_CATCH: 0.45,
  // fraction of returnable punts fair-caught/downed (no return)
  // Subsystem 6 PASS 2 (Aug 2026): muffed/fumbled returns — a real ST turnover source the
  // pass-1 model left out (returns were clean-or-fair-catch, no way to lose the ball). Sources
  // (footballperspective fumble study): of ~30.8k punts, ~3.5% were muffed/fumbled by the return
  // team and the kicking team fell on ~1/3 of those (~1.15% of ALL punts became turnovers);
  // ~3.1% of kickoffs were fumbled with the kicking team recovering ~1%. The returner's
  // ball-security (0.5*HND+0.5*SEC) suppresses the muff, so a sure-handed returner rarely bobbles
  // and a poor one is a live risk. Turnover-band-safe (adds ~0.05/team-game each).
  PUNT_MUFF_BASE: 0.035,
  // fraction of FIELDED (non-fair-catch) punts muffed at the catch
  KO_MUFF_BASE: 0.022,
  // fraction of RETURNED kickoffs fumbled/muffed
  MUFF_RECOVER_KICK: 0.33,
  // share of muffs the kicking/coverage team falls on -> the return team loses possession
  MUFF_HND_PIVOT: 55,
  // returner ball-security (0.5*HND+0.5*SEC) at which the base muff rate holds
  MUFF_HND_SCALE: 9e-4,
  // per-point security shift in muff prob around the pivot (±30 pts ≈ ∓0.027)
  PAT2_RATE: 0.47,
  // Subsystem 6 (Aug 2026): onside recovery is no longer a flat 0.15. Expected onside
  // (hands team out, everyone knows it is coming) recovers ~11%; a surprise onside ~60%.
  ONSIDE_EXPECTED: 0.11,
  ONSIDE_SURPRISE: 0.6,
  // 2-point conversion success (when attempted)
  QB_SCRAMBLE_SCALE: 0.4,
  // steepness of the division-relative QB scramble curve (legacy A/B path only
  // since M3 — the live curve uses the three constants below)
  // ── M3 (D6, 2026-08-17): the scramble curve re-anchored on the LEAN ──
  // Ratified law (§7.3): archetype is tier-relative, absolute speed is not.
  // The curve now weights the mobility LEAN (the archetype's own axis) over
  // absolute mobility so a D3 scrambler scrambles like a D1 scrambler.
  QB_SCRAMBLE_BASE: 0.1,
  // the curve's floor-anchor — a full statue (lean at the knee) sits here
  QB_SCRAMBLE_LEAN: 0.34,
  // across the knee-to-scrambler span ((lean+12)/24): the archetype axis
  QB_SCRAMBLE_ABS: 0.08,
  // per absMob unit: the small absolute-speed residue (a burner breaks longer)
  QB_SCRAMBLE_FLOOR: 0.03,
  QB_SCRAMBLE_CAP: 0.5,
  // ── M3: the clean-pocket take-off (audit §7.5, coverage-conditioned) ──
  // When nobody is open and the pocket is CLEAN, a mobile QB looks for the
  // grass the coverage droppers left behind. Chance = qbScrambleChance * this
  // * the coverage-grass factor (more droppers = fewer rushers = bigger
  // lanes). Tuned so ~75% of all scrambles stay pressure-coupled (PFF).
  CLEAN_SCRAMBLE_MULT: 1.1,
  CLEAN_COVERED_SEP: 0.62,
  // the clean-pocket rung's own "nothing open" line — looser than the
  // under-pressure trigger (a QB with time waits longer before deciding
  // nobody is open), and the chance scales with how covered the field is.
  // ── M3: the QB_RUN_BASE dice are DEAD (audit §7.1) ──
  // A handoff concept becomes a QB keep only at this broken-play floor now
  // (bad mesh, bumped exchange). Empty keeps its 1.0 exception (no back to
  // hand to). The authored family owns designed QB runs.
  QB_RUN_FLOOR: 0.015,
  TTT_DEEP: 0.34,
  // time-to-throw: deep-drop pocket-exposure tax (escalates pressure a tier), cut by QB mobility/AWR + quick game
  TTT_SHORT: 0.2,
  // time-to-throw: quick-game relief (de-escalates pressure a tier) so the depth reshape holds the league sack rate
  // ── Fix B prototype (AWR-gated coverage sack / throwaway) ──
  // Fires when the read collapses under pressure (nobody above minSep and the QB is
  // hurried — the would-be hold/sack). High-AWR throws it away; low-AWR forces it.
  COVSACK_AWR_PIVOT: 70,
  // AWR at which the throwaway probability is 50%; higher AWR = more likely to throw it away
  COVSACK_AWR_SCALE: 0.022,
  // throwaway-prob slope per AWR point above/below the pivot
  COVSACK_FORCE_SACK: 0.15,
  // of the low-AWR force branch: fraction that becomes an actual coverage sack (small residual)
  COVSACK_FORCE_SHORT: 0.6,
  // of the low-AWR force branch: fraction re-aimed at the checkdown/shortest outlet (safe completion);
  // the remainder (1 - SACK - SHORT) is a forced throw into coverage (can be intercepted)
  COVSACK_COVERED_SEP: 0.46,
  // "the field is covered": the most-open receiver's separation is below this. The sim's
  // separations sit higher than the qbRead minSep (0.28), which literally never collapses,
  // so this tunable defines the covered-under-pressure trigger instead.
  COVSACK_SCRAMBLE_MULT: 0.8,
  // dual-threat escape: a mobile QB flushed onto a covered field takes off rather than
  // eating the coverage sack. Escape prob = qbScrambleChance(qb) * this (a second,
  // covered-conditioned scramble look). 0 disables the escape; mobility-scaled, so a
  // statue almost never uses it.
  QB_RUSH_LEAN: 12,
  // QB-Rush: target SPD/AGI lean above passing baseline
  QB_RUSH_LEAN_SD: 7,
  // spread of that lean → a range from moderate to elite mobility
  FG_TECH_SCALE: 0.045,
  // kicker accuracy: each TECH point above 50 shifts
  // FG make% via logistic. TECH 99 vs 40 ≈ +0.47 logit
  // (~45%→92% make at 42yd). STR = leg/range;
  // TECH = whether he makes the makeable ones.
  PUNT_TECH_SCALE: 0.06,
  // punter consistency: higher TECH reduces shank
  // variance (tighter distribution) and adds a small
  // directional/hang bonus.
  FORMATION_IQ_BASE: 0.92,
  FORMATION_IQ_SCALE: 16e-4,
  // ── HC formation mastery (DNA TREE §5b.2, D9) — the ONE outcome-touching
  // piece of the tree rework, band-gated. The PLAYER coach carries his own
  // per-formation sheet: rolled baseline, grows with real calls, rusts on
  // disuse. Its bonus stacks with coordIqMod under a HARD CAP equal to
  // today's envelope maximum, so a maxed coordinator + maxed HC reads exactly
  // what a maxed coordinator reads today — mastery fills the envelope, never
  // raises it. AI schools carry no sheet; their mod is bit-identical.
  HC_MASTERY: {
    BASE_MIN: 28,
    BASE_MAX: 40,
    GROW_PER_SEASON: 4,
    RUST_PER_SEASON: 2,
    CEILING: 85,
    // Effect scale: max sheet (85) adds +0.021 — about 13 coordinator IQ
    // points, roughly a fifth of the coordinator envelope span. Small.
    SCALE: 2.5e-4,
    // FORMATION_IQ_BASE + FORMATION_IQ_SCALE·92 (the max rolled coordinator
    // sheet) = 1.0672. The stacking law's ceiling.
    ENVELOPE_MAX: 1.0672
  },
  SCHEME_FIT_MOD: 0.08,
  POWER_PASS_DAMP: 0.9,
  // 5-tech (DE-Power) PASS-rep efficiency vs his run anchor — bull rush is real but edges finish [TUNE]
  CLOCK_RUN: { mean: 31, sd: 6 },
  // Subsystem 5 (Aug 2026): run 29 -> 31, pass 23 -> 30. The old means were BLENDS —
  // clock-running plays and clock-stopped ones (incompletions, out-of-bounds) averaged
  // together. With clock-stops now modeled explicitly (CLOCK_STOP_SAVED subtracted on
  // the plays that stop it: ~43% incomplete passes + OOB_RATE runs/passes), these are
  // the true clock-RUNNING values, raised so the BLENDED mean lands back where it was
  // and plays/team holds in band. A completed pass now (correctly) keeps more clock
  // moving than an incompletion, and an inside run more than an outside run to the boundary.
  CLOCK_PASS: { mean: 30, sd: 8 },
  // [TUNE Jul 2026] 30/24 held ~69 plays w/ rush light; 29/23 (+ Balanced run-rate 0.44) lifts to ~71 plays so rush att/yds reach the real band, pass/sacks/points still in-band
  HALF_SECONDS: 1800,
  TIMEOUTS_PER_HALF: 3,
  // each team gets 3 timeouts per half to stop the clock late in a half/game
  TIMEOUTS_OT: 1,
  // each team gets 1 timeout per overtime possession
  TIMEOUT_RUNOFF_SAVED: 25,
  // ~seconds of between-play runoff a timeout prevents (a run's clock is ~30, so
  // stopping it saves most of that). Trailing team uses them to get the ball back;
  // leading team uses them to preserve time on a scoring drive.
  // Subsystem 5 (situational, Aug 2026): clock-STOPPING events. An incompletion or
  // an out-of-bounds ball-carrier stops the game clock at the whistle, so the
  // between-play runoff that would otherwise keep the clock moving is saved (same
  // mechanic as a timeout — see TIMEOUT_RUNOFF_SAVED). CRUCIAL calibration: the old
  // CLOCK_PASS.mean=23 already BAKED IN the fact that ~43% of passes fall incomplete
  // and (in real football) stop the clock — the 23 was a blend of clock-running
  // completions and clock-stopped incompletions. Now that the split is EXPLICIT,
  // CLOCK_PASS.mean is raised to the true clock-running (completion) value below, and
  // the saving is subtracted back out only on the plays that actually stop the clock,
  // so the league-wide mean (and plays/game) is preserved while the SPLIT becomes
  // real — which is what the two-minute drill and the kneel math stand on.
  CLOCK_STOP_SAVED: 14,
  // Modeled out-of-bounds rate by play family (no per-play sideline geometry exists,
  // so this is the share of plays whose ball-carrier goes OOB and stops the clock).
  // Outside runs and short throws hit the boundary most; inside runs almost never.
  OOB_RATE: { run_outside: 0.24, run_inside: 0.03, pass_short: 0.14, pass_medium: 0.1, pass_deep: 0.06 },
  // Subsystem 5 fix D (Aug 2026): a trailing two-minute offense works the sideline to
  // stop the clock, so its ball-carriers go out of bounds far more often. Multiplies
  // the OOB rate above, but ONLY in the two_min_trail situation (capped at 0.55).
  OOB_TWO_MIN_MULT: 2.0,
  // Subsystem 5 fix E (Aug 2026): yards a team down by <=3 in the final ~2:30 will add
  // to its normal FG range (half that inside ~5:00). attemptFG still prices the lower
  // make-odds at distance; this only permits the longer attempt when it's win-or-lose.
  FG_LATE_STRETCH: 7,
  // Subsystem 6 (Aug 2026): ~2% of FG attempts are blocked (real ~1-2%). A block is a miss
  // where the defense recovers a couple yards closer to the LOS than a normal miss spot.
  FG_BLOCK_RATE: 0.02,
  // Subsystem 6 (Aug 2026): a punt from inside the own 8 can end in a safety (snap over the
  // punter head / punt blocked out of the back of the end zone). This is the one CLEAN, real
  // safety source this drive-level sim can add; punts that deep are rare (~0.023/team-game),
  // so it lifts the safety rate modestly. The residual gap to the real ~0.05-0.10 is a
  // deliberate stop: the rest come from mechanics the sim abstracts away (muffed snaps,
  // end-zone strip-sacks) and faking them with an inflated constant would be dishonest.
  PUNT_SAFETY_DEEP: 0.18,
  // Legacy (kept for non-rep parts: kicking, punting, OT fallback)
  SCALE_PLAY: 28,
  SCALE_PASS: 30,
  PASS_YARDS: {
    short: { mean: 5, sd: 2 },
    medium: { mean: 9, sd: 3.4 },
    deep: { mean: 19, sd: 6.5 },
    vdeep: { mean: 37, sd: 13 }
  },
  // Development (§5)
  // ── Route depth by SLOT (Jul 2026) ──────────────────────────────────────
  // Every receiver used to run the play's depth: on a pass_medium call, the X,
  // the slot and the Z all ran mediums. So the slot's role — WR-Deep at X in
  // Pistol, WR-Poss at X in Trips — was pure decoration: the card's number
  // moved between formations while the sim ran the identical contest.
  // Now the spot he lines up in shifts WHERE he works. A split end labelled
  // WR-Deep pushes vertical (SPD/JMP, routeDeep); the slot works underneath
  // (AGI/TEC/HND, routeShort). The play call still sets the team's baseline —
  // this tilts each man around it, which is what a route concept actually is.
  // ── RPO is a PLAY TYPE, not a formation (Jul 2026) ──────────────────────
  // It used to be hardcoded `offFormationId === 'Pistol/RPO'`, so the read
  // existed in exactly one formation and the rpoRate dial was dead everywhere
  // else. Real football doesn't work that way — you can run an RPO from almost
  // anything, and what changes is how well the QB can execute the mesh read.
  //
  // What actually gates it is whether the QB can SEE the conflict defender at
  // the mesh point:
  //   Pistol   — the platform built for it (Ault, Nevada '05): deep enough to
  //              read the whole field, but the back still runs downhill. Best.
  //   Spread   — shotgun; the most common real RPO home (Briles, Meyer). Nearly
  //              as good; the back is beside him rather than behind.
  //   Trips    — works, but the formation declares your intent pre-snap and the
  //              conflict defender is already leaning.
  //   Air Raid — a drop-back system; RPOs exist in it but aren't its language,
  //              and with no back in the box there's little run to threaten.
  //   Power-I — under center. The QB turns his back to the box at the
  //              mesh: he physically cannot read the defender he's optioning.
  //              Not zero (a rare peek play), but close to it.
  RPO_FIT: {
    "Pistol/RPO": 1,
    "Spread": 0.85,
    "Trips/Bunch": 0.7,
    "Air Raid": 0.45,
    "Power-I": 0.05,
    // Expansion five: Single Back is under center (peek plays only). Empty
    // has no back to option — the "R" in RPO doesn't exist. The 'bone and
    // flexbone read defenders all day, but down the LOS with a pitch phase —
    // that's the triple option, not a mesh-point RPO; QB_RUN_BASE carries
    // their read game instead. Wildcat's snap goes straight to the back:
    // there is no QB at the mesh to do any reading at all.
    "Single Back": 0.3,
    "Empty": 0.1,
    "Wishbone": 0.05,
    "Flexbone": 0.08,
    "Wildcat": 0.02,
    // Jumbo: under center behind three tight ends — nothing to read.
    "Jumbo": 0.03
  },
  ROUTE_TILT: {
    "WR-Deep": 1,
    // push him a level deeper
    "WR-Slot": -1,
    // work underneath
    "WR-Poss": -1,
    "WR-Physical": 0,
    "TE-Receiving": 0,
    "TE-Blocking": -1,
    "RB-Scat": -1
  },
  ROUTE_TILT_CHANCE: 0.55,
  // not every snap — concepts vary, and the QB reads
  VIS_CENTRE: 7.5,
  // see visionRating — closes the raw-vs-weighted average bias
  GROWTH_BASE: 48,
  // [TUNE]
  // ── Three-channel development (Jul 2026 rebuild) ─────────────────────────
  // 1. PRACTICE: the coach's targeted channel — ticks in-season at three
  //    checkpoints using the CURRENT plan (mid-season changes finally matter).
  // 2. POTENTIAL+PERFORMANCE: the season-end tick — talent rises toward its
  //    ceiling whether it played or not (WE gates it hard: the lazy phenom
  //    busts), and production feeds the attributes it exercised.
  // 3. CAMP: the offseason focus lever — plan-shaped, focus-multiplied.
  INSEASON_DEV_WEEKS: [8, 13, 18],
  // engine days; UI displays regular-season Weeks 4, 9, 14
  INSEASON_DEV_MULT: 0.15,
  // each checkpoint = 15% of a classic full tick
  CAMP_DEV_MULT: 0.3,
  // dev camp share of the classic tick
  POT_GROWTH: 30,
  // potential-channel base (plan-independent)
  WE_POT_EXP: 1.6,
  // WE gates talent hard: lazy sky-high = bust risk
  PERF_DIVISORS: {
    // production per +1 point of perf credit
    passComp: 12,
    rushAtt: 28,
    brokenTackles: 4,
    recComp: 9,
    contestedRec: 3,
    tackles: 16,
    pressures: 11,
    sacks: 2.5,
    ballhawk: 3
  },
  PERF_ATTR_CAP: 3,
  // max perf-channel points per attribute/season
  // Boys becoming men (Jul 2026): this is COLLEGE — growth RAMPS, it doesn't
  // taper. The body transforms hardest late (the weight room compounds:
  // JR/SR years are when a kid becomes a man), while craft grows steady with
  // reps from day one. Career totals match the old curve (~4.6-4.8) so the
  // league doesn't inflate; the SHAPE moves late. A senior year is now a
  // player's biggest physical leap — "finally put it together" is real.
  AGE_CURVE_MEASURED: { FR: 0.8, SO: 1.1, JR: 1.4, SR: 1.5 },
  // SPD/AGI/PWR/STR/JMP
  AGE_CURVE_COACHED: { FR: 1.2, SO: 1.2, JR: 1.15, SR: 1.1 },
  // HND/SEC/TEC/AWR + meta
  WE_DEV_MIN: 0.7,
  WE_DEV_SCALE: 0.8,
  // [TUNE]
  HEADROOM_DIV: 32,
  // [TUNE]
  POTENTIAL_BAND: { average: 15, good: 23, great: 33, sky: 47 },
  // +7 vs pre-rebalance: same ceilings, lower floors

  // ═══ W9 (§12 coaching tree) — THE TREE ═════════════════════════════════════
  // The architecture is an INVERSION, not a rewrite. A coach owns up to four
  // worlds; the tree owns ONE world and up to three coaches — one per division
  // (T2), which is also why a slot IS a division. Every number below is sized so
  // a SINGLE-slot tree behaves exactly like the pre-W9 career it replaces: one
  // coach, one world, no agenda to resolve, no inheritance to grant. The tree
  // only starts paying once you actually grow one.
  TREE: {
    // T2: three slots, one per division. START is where every run begins
    // (growth rule 1: take a job, one coach slot, the bottom).
    DIVISIONS: ["D1", "D2", "D3"],
    START_DIVISION: "D3",
    MAX_SLOTS: 3,

    // THE HARVEST (T5): retirement commits the career in one lump, permanently.
    // Active coaches carry their own DNA; only walking away deposits it.
    // Cut from 1.0 (2026-08): at full share a ~10-season career (~550 XP on
    // its signature axis) saturated the G5 inheritance cap in 2–3 retirements,
    // and every retirement after that changed nothing a protégé felt. Pacing
    // math at 0.4: cap XP 617 ÷ typical inherit share ~0.4 ≈ 1,540 pool
    // needed; 550 × 0.4 = 220 banked per career ≈ 6–7 retirements to fill.
    // The family legacy is a dynasty-long build, not a two-coach sprint.
    BANK_SHARE: 0.4,

    // [DNA TREE §7.4 D8] THE HARVEST SHARES by how the career ended: retire
    // full, quit (walking away young) partial, fired least — a real reason to
    // survive the hot seat. Multiplies BANK_SHARE at the retirement.
    EXIT_SHARE: { retire: 1, quit: 0.6, fired: 0.4 },
    // [DNA TREE §7.6, D9] The World Responds: a tenure this long at the final
    // school writes a legend era in the generateProgramLore event shape...
    LEGEND_MIN_SEASONS: 8,
    // ...and a tenure this long gets the field named after him.
    FIELD_NAME_MIN_SEASONS: 14,
    // [DNA TREE §7.3] Career-defining games shown at the ceremony (3–5).
    CEREMONY_GAMES: 4,
    // [DNA TREE §7.5, D9] The succession pick: choose up to this many banked
    // axes for the next man to inherit (each still capped at ★★).
    INHERIT_PICK_MAX: 4,

    // THE LIVE TRICKLE: each season, a SMALL share of the growth a working coach
    // added to his OWN DNA that year is also deposited into the tree's shared
    // pool. One-way: the pool is read ONLY when seeding a promoted coordinator
    // (dnaInheritance) and NEVER feeds back into any active coach's sim. Sized
    // far below a coach's own DNA growth on purpose — a personal identity forms
    // in a season or two, but the family legacy is a slow, multi-coach accrual.
    // Retirement still banks the full career on top of whatever trickled.
    TRICKLE_SHARE: 0.05,

    // THE PROTÉGÉ EFFECT: a coach minted from the tree starts with a share of
    // what the tree has banked, weighted by seasons served, capped by SHARE (a
    // head start, never a career) and by GRADE (no protégé above a man who
    // earned it). A tree that banked nothing grants nothing.
    INHERIT_SHARE: 0.28,
    INHERIT_PER_SEASON: 0.02,
    INHERIT_MAX: 0.55,
    // [DNA TREE §4] Replaces INHERIT_CAP_GRADE: inheritance opens at up to ★★
    // (star tier 2), never ★★★/💎 — those a protégé earns himself.
    INHERIT_CAP_STAR: 2,

    // DIVISION MEMORY (T4): the tree remembers divisions its coaches worked —
    // scouting/recruiting head starts there, cold starts elsewhere. One point
    // per season a tree coach works a division; MEMORY_FULL reads a full 1.0.
    MEMORY_FULL: 12,
    MEMORY_EVAL_XP: 300,
    MEMORY_ROOTS_XP: 220,

    // LOCKSTEP (T1): the world advances week-by-week and advancing requires
    // resolving every other tree coach's game that week. A one-slot tree never
    // produces a row, so the gate is invisible until you grow a branch.
    AGENDA_STATES: ["pending", "finalized"],

    // THE OFFER FORK (growth rules 2–4).
    FORK_REOFFER_MIN_SEASONS: 1,
    PROMOTE_OFFER_EVERY: 1,
    APPLY_DOWN_PER_OFFSEASON: 1,

    // THE PROMOTED COORDINATOR: his service record converts to starting
    // milestone levels (coordinatorCredentials owns that math). These are the
    // sizing knobs on top: a promoted man opens on a warmer seat than a stranger.
    PROMOTE_JOBSEC: 58,
    PROMOTE_REP_FLOOR_IDX: 4,
  },

  // Injury (§5.6)
  INJURY_BASE: 0.04,
  INJURY_DUR_MOD: 3e-4,
  INJURY_MIN: 2e-3,
  INJURY_MAX: 0.05,
  // Per-carry QB injury probability (before avoidance/durability scaling). Tuned
  // so a pocket QB is hurt ~once per ~40 games and a run-heavy mobile QB ~once
  // per ~13 games — realistic, and low enough that the backup isn't constantly
  // pressed into games. The old hardcoded 0.020 gave 12%/game (48% run-heavy),
  // which surfaced as "multiple QBs every game" once the mobility system raised
  // QB carry volume.
  QB_INJURY_PER_CARRY: 3e-3,
  // Recruiting (§7)
  BUDGET_PER_SCHOLARSHIP: 3e3,
  // legacy formula (superseded by ECON revenue below; kept for reference)
  // Per-division value of one scholarship, proportional to each division's
  // economy (D3 anchor = the legacy $3k). Drives scheduling guarantees and the
  // rivalry-win reward, so both scale with a program's real war chest.
  SCHOLARSHIP_VALUE: { D1: 8500, D2: 4500, D3: 3e3 },
  // Non-conf scheduling guarantee = star-gap × your division's scholarship
  // value. Play DOWN (weaker opp) → you pay them; play UP → you get paid; equal
  // is free. Charged/credited to NEXT season's budget. Rivalry game is exempt.
  RIVALRY_REWARD_SCHOLARSHIPS: 1.5,
  // rivalry win pays 1.5 scholarships (D3 $4.5k, D2 $6.75k, D1 $12.75k)
  // ── Athletic-department economy (Phase 1: the pool) ──────────────────────
  // One pool, funded annually: base allocation + gate revenue + carryover
  // (title bonuses land in-season and roll through carryover). Legible by
  // design — the ledger shows this exact formula. Division averages: D3 ~$52k
  // (matches the legacy recruiting economy), D2 ~$75k, D1 ~$148k. Recruiting
  // parity within a division holds because every program inflates together.
  ECON: {
    BASE: { D1: 2e5, D2: 12e4, D3: 6e4 },
    // guaranteed allocation — the death-spiral floor. Sized so NET pools (after typical upkeep + staff salaries) beat the legacy 54k-per-school recruiting budget at every division: recruiting prices didn't change, so the pool must cover the new expense lines AND a full class.
    TICKET_PRICE: { D1: 18, D2: 12, D3: 9 },
    // average ticket
    PROGRAM_SHARE: { D1: 0.1, D2: 0.4, D3: 0.8 },
    // % of gate that reaches football ops
    FILL_BASE: 0.42,
    FILL_PER_PRESTIGE: 0.05,
    FILL_PER_WIN: 0.02,
    FILL_MIN: 0.35,
    FILL_MAX: 1
  },
  // ── Facilities (Phase 2) — four tracks, levels 1–5, one pool ─────────────
  // Level 2 is the neutral baseline (all effects ×1.0 there). Upgrades cost
  // UPGRADE_BASE × target level; upkeep charges per level above 1 every
  // season, straight off the top of the pool. Can't cover upkeep? The
  // highest facility decays a level. Effects per level above/below 2:
  //   stadium   +10% effective capacity   (gate revenue)
  //   training  +6% development minutes   (players grow faster)
  //   recruiting+10% visit interest gains (the tour sells itself)
  //   medicine  −8% injury duration       (money buys fewer lost weeks)
  // AD bonus-goal payouts (Phase 4): cash into the pool per goal hit.
  GOAL_BONUS: { D1: 15e3, D2: 7e3, D3: 4e3 },
  FACILITIES: {
    TRACKS: ["stadium", "training", "recruiting", "medicine"],
    LABELS: { stadium: "Stadium", training: "Training Complex", recruiting: "Recruiting Center", medicine: "Sports Medicine" },
    UPGRADE_BASE: { D1: 3e4, D2: 12e3, D3: 8e3 },
    UPKEEP_PER_LEVEL: { D1: 3e3, D2: 1200, D3: 600 },
    MAX_LEVEL: 5,
    STADIUM_CAP_PER_LVL: 0.1,
    TRAINING_PER_LVL: 0.06,
    RECRUITING_PER_LVL: 0.1,
    MEDICINE_PER_LVL: 0.08
  },
  // ── Performance recruiting-budget bonuses ────────────────────────────────
  // Winning pays: credited straight to coach.budget the moment they're earned
  // (initBudget carries the full balance across rollover, so playoff money is
  // spendable in the next recruiting cycle). Applies to EVERY school — AI
  // programs that win get richer too, which is how the rich stay rich.
  BONUS_CONF_CHAMP: 2e4,
  // win your conference (playoff auto-bid)
  BONUS_PLAYOFF_BERTH: 1e4,
  // make the 16-team field
  BONUS_PLAYOFF_WIN: 1e4,
  // each playoff win before the final
  BONUS_NC_LOSS: 25e3,
  // reach the title game and lose
  BONUS_NC_WIN: 5e4,
  // win it all
  // ── Transfer portal ───────────────────────────────────────────────────────
  // Offseason stage after Departures. AI players enter when buried on the
  // depth chart, when their coach left, or when the program is collapsing.
  // Player roster is immune (for now). Immediate eligibility — class year
  // travels with them. AI schools sign portal players with LEFTOVER recruiting
  // budgets, so the unspent late-cycle money finally goes somewhere real.
  PORTAL_BURIED_DEPTH: 2,
  // depth rank beyond this at your position = buried
  PORTAL_BURIED_PROB: 0.22,
  // buried player enters with this probability
  PORTAL_COACH_LEFT_PROB: 0.1,
  // any non-SR may follow a departed coach out
  PORTAL_COLLAPSE_WINS: 3,
  // team at/below this many wins = collapsing
  PORTAL_COLLAPSE_PROB: 0.08,
  // collapse exodus chance per eligible player
  PORTAL_MIN_RATING: 45,
  // below this nobody would pursue them anyway
  PORTAL_CAP_PER_DIV: 40,
  // hard cap on entrants per division
  // ── PLAYER roster attrition (transfer OUT) — deliberately NARROW ──
  // Your own players can leave for the portal, but ONLY the buried-backup case,
  // and rarely. Rules (locked): JR/SR only, buried on the depth chart, no star-
  // raiding — this is a quality backup with no path to the field seeking playing
  // time, not blue-bloods poaching your best. Feeds the same portal pool.
  PLAYER_ATTRITION_DEPTH: 2,
  // buried = depth rank ≥ this (3rd string or deeper) at his position
  PLAYER_ATTRITION_PROB: 0.14,
  // per eligible buried JR/SR — kept low so it rarely fires (NOT a churn engine)
  PLAYER_ATTRITION_MIN_RATING: 68,
  // only a genuinely good backup leaves (the "77 QB behind an 80" case); scrubs stay
  PLAYER_ATTRITION_MAX_PER_YEAR: 2,
  // at most this many of your players leave in a single offseason
  PLAYER_ATTRITION_BURIED_STEP: 0.5,
  // each extra body stacked ahead of him (beyond the buried cutoff) raises his
  // leave odds by this much — a deep logjam is a real flight risk
  PLAYER_ATTRITION_BURIED_MAX: 2.5,
  // ...capped: even a totally blocked guy tops out at 2.5× the base 14% (~35%)
  // Cost anchor (Jul 2026 balance): a transfer should cost ≈ 5/3 of a freshman
  // scholarship (BUDGET_PER_SCHOLARSHIP $3000 → ~$5000 average), so the portal
  // isn't a cheap roster-stacking exploit. The base is that anchor and the
  // rating premium scales the ~$4000 floor up toward ~$6–7k for blue-chippers.
  // Same formula in every division — the caliber gate, not price, tiers who's
  // reachable. Signings also consume a scholarship (see portal.js), so what you
  // can do in the portal scales with your OPEN SLOTS and WAR CHEST, not a cap:
  // an established program 10 years in, senior-heavy and rich, can do damage.
  PORTAL_PITCH_COST_BASE: 2e3,
  // pitch cost = base + a PROGRESSIVE (tax-bracket) rating premium. Base $2k
  // floor for a min-rating (45) transfer; then each band above its threshold
  // charges its own $/pt, so elite transfers get steep while everyday guys stay
  // cheap. 60 OVR ≈ $3.35k, 75 ≈ $5.2k, 90 ≈ $7.75k. Same in every division.
  PORTAL_PITCH_COST_PER_PT: 90,
  // ...per rating point from PORTAL_MIN_RATING (45) up to the next tier
  PORTAL_PITCH_TIERS: [
    { over: 65, per: 140 },
    { over: 79, per: 180 }
  ],
  // progressive brackets: points above each threshold cost that band's $/pt
  PORTAL_AI_MAX_SIGNINGS: 3,
  // per AI school per window
  // ── Auction rebuild (Jul 2026): the portal is a multi-round bidding WAR.
  // Everyone in the pool is a PLAYING-TIME seeker (buried / cratered) looking to
  // go somewhere he can START — nobody rises for a bigger stage. Depth-chart FIT
  // (the role you can offer him) is the dominant pull, not money, so a small
  // program with an open job beats a rich one that would bury him.
  PORTAL_ROUNDS: 3,
  // bidding rounds ("weeks") in the window
  // Caliber gate: tier a transfer by his RATING (not the division he left) and
  // let a school reach at most ONE caliber tier above itself, never two. Kills
  // "D3 signs a D1 star" while keeping "D3 lands a D2-caliber guy dropping down".
  PORTAL_TIER_HI: 66,
  // rating ≥ this = caliber tier 3 (D1-caliber)
  PORTAL_TIER_MID: 50,
  // rating ≥ this = tier 2 (D2); below = tier 1 (D3)
  // Adjusted-offer weights. Role DOMINATES; money is real but diminishing.
  PORTAL_ROLE_STARTER: 120,
  // you'd hand him the job (clear starter)
  PORTAL_ROLE_ROTATION: 55,
  // cracks the two-deep / rotation
  PORTAL_ROLE_BURIED: 3,
  // he'd sit again — a playing-time seeker won't
  PORTAL_W_PRESTIGE: 7,
  // per prestige star (bigger stage, modest)
  PORTAL_W_DIST: 12,
  // same-region comfort
  PORTAL_W_MONEY: 0.75,
  // × sqrt(spend) — diminishing, never dominant.
  // Halved alongside the ~6× cost bump so ROLE
  // still dominates money (sqrt(5000)·0.75 ≈ the
  // old sqrt(800)·1.4) — a war chest helps, but an
  // open starting job still beats a fat wallet.
  PORTAL_RAISE_STEP: 1e3,
  // one raise adds this to your standing bid
  PORTAL_BLOWOUT: 45,
  // if the top adjusted offer beats the field by
  // more than this mid-window, he commits EARLY
  PORTAL_AI_VAL_BASE: 4500,
  // AI willingness to spend = base + need/rating scale
  // (scaled with the cost bump so the AI still
  // contests bids into the ~$5–8k range on starters)
  PORTAL_AI_VAL_PER_PT: 250,
  // ...per rating point above PORTAL_MIN_RATING, ×role
  RECRUIT_ACTION_BASE: {
    scout: 3,
    game_visit: 14,
    home_visit: 22,
    campus_visit: 34
    // visits RAISED [TUNE]
  },
  RECRUIT_ACTION_COST: {
    // Visit costs back at Chunk 9 levels (owner call: recruiting is hard
    // enough post-reprice — visits stay the player's affordable edge).
    scout_local: 175,
    scout_near: 375,
    scout_mid: 600,
    scout_far: 850,
    game_visit_local: 150,
    game_visit_near: 300,
    game_visit_mid: 500,
    game_visit_far: 725,
    home_visit_local: 250,
    home_visit_near: 500,
    home_visit_mid: 800,
    home_visit_far: 1050,
    campus_visit_local: 450,
    campus_visit_near: 850,
    campus_visit_mid: 1400,
    campus_visit_far: 2200,
    offer: 100
  },
  PRESTIGE_MULT_MIN: 0.5,
  PRESTIGE_MULT_SCALE: 0.15,
  DISTANCE_MOD: { local: 1.25, near: 1, mid: 0.7, far: 0.45 },
  DISTANCE_THRESHOLDS: { local: 180, near: 359, mid: 700 },
  // ── Long-haul recruiting (Jul 2026) ──────────────────────────────────────
  // The tier table above bottoms out at 'far' (700+ mi) and STOPS — so a kid
  // 701 miles away and a kid 4,500 miles away cost exactly the same. That's
  // why an island program wasn't hard: Hawaii paid the same tax as a program
  // recruiting two states over.
  // These extend the tail PAST the far threshold and leave every mainland
  // distance untouched (surgical by design — smoothing the mainland tiers
  // would silently rebalance the geography of recruiting for all ~324
  // schools, which is a separate decision).
  LONGHAUL_START: 700,
  // = DISTANCE_THRESHOLDS.mid; the tail starts here
  LONGHAUL_DECAY_K: 1800,
  // effective spend: mod ÷ (1 + (miles−700)/K)
  LONGHAUL_COST_K: 1100,
  // visits/scouting: cost × (1 + (miles−700)/K)
  LONGHAUL_COST_CAP: 6,
  // a charter flight is expensive, not infinite
  DIMINISH_K: 3e3,
  // was 5000 (Chunk 9 Phase 1) — paired with the lower $/point below; see deliverable table
  // ── Standing contact allocation (Chunk 6) [TUNE] ──
  CONTACT_DOLLARS_PER_POINT: 22,
  // repriced (was 8): one slot's budget (~$3k) now funds ~one strong pursuit (~90 pts with diminishing returns), so both player and AI must choose battles
  CONTACT_WEEKLY_CAP: 4e3,
  // max $/week per recruit — SHARE-OF-ROOM era:
  // no more filling a private bar, you're
  // outbidding a room. High ceiling so a war
  // chest is a real weapon in a real fight.
  // ── Share-of-room recruiting (Jul 2026 rebuild) ──────────────────────────
  // Interest is no longer a private meter money fills at a fixed rate: each
  // week every suitor's EFFECTIVE spend (dollars × fit × distance × prestige
  // × skills) is measured against the whole room. You gain on your SHARE.
  // Consequences: spending always means something (there's no ceiling to hit,
  // only rivals to beat), a fought-over five-star is expensive by definition,
  // and the kid nobody else wants is cheap — walking away and redeploying is
  // now the core decision. Money burns: no refunds on a lost race.
  SHARE_GAIN_MAX: 26,
  // pts/wk for a lone (uncontested) suitor, ×SHARE_QUIET_BONUS
  // (legacy) how sharply share converted to gain — kept for reference
  SHARE_SWING: 48,
  // PARITY-RELATIVE swing: pts/wk = SHARE_SWING × (yourShare − fairShare).
  // 2-school total domination ≈ +24 winner / −24 loser (symmetric). The meter
  // now moves DOWN when you're losing the room, not just up when you spend.
  SHARE_DECAY: 2.2,
  // pts/wk a suitor sheds when it stops bidding entirely (goes silent)
  NEED_PULL_MAX: 0.35,
  // team-needs pull: a real class hole adds up to +35% effective spend (capped
  // so money/fit still lead); a fully-stocked position pulls slightly less.
  SHARE_QUIET_BONUS: 1.35,
  // uncontested rooms close faster (find the kid nobody's on)
  CONTACT_ALLOC_STEP: 100,
  // UI increment for setting the allocation
  // ── Coach skill effect steps (Chunk 3) ── per grade index (0..12) [TUNE]
  SKILL_RECRUITER_STEP: 0.025,
  // A+ ≈ ×1.30 recruiting pull
  SKILL_REP_STEP: 0.01,
  // A+ ≈ ×1.12 recruiting pull
  SKILL_ROOTS_STEP: 0.03,
  // A+ ≈ ×1.36 pull on in-radius recruits
  SKILL_DEVELOPER_STEP: 0.015,
  // A+ ≈ ×1.18 growth + formation IQ
  // ── DNA-axis effect steps (per DNA grade 0..10) for the PLAYER's folded
  // developer/recruiter axes. Sized so a maxed G10 reproduces the old maxed
  // skill effect exactly: 10×0.018=0.18 (dev), 10×0.030=0.30 (rec). AI coaches
  // keep the SKILL_*_STEP values above.
  // [DNA TREE §4 D3] SUPERSEDED by the un-fold — recruiter/developer read the
  // skill ladder again (SKILL_*_STEP above). Kept for reference only.
  DNA_DEVELOPER_PER: 0.018,
  DNA_RECRUITER_PER: 0.03,
  // Coordinator quality by division (Jul 2026 audit): the best minds work
  // where the money and the stage are. A D1 job commands a genuinely better
  // market than a D3 job at the same prestige — which is what the 4.7× salary
  // was already (wrongly) charging for.
  STAFF_DIV_QUALITY: { D1: 14, D2: 6, D3: 0 },
  // Division FLOOR on coordinator quality (Jul 2026 fix #2): the lift above
  // moved the average but the slate spread (±16) and the per-rating roll (±14)
  // are division-blind, so a D1 market still offered 40-rated guys at $10k —
  // worse than a D3 school's best hire at $3k. A D1 program does not
  // interview a coordinator a D3 program would pass on. The floor is the
  // weight class; prestige and the slate spread play out ABOVE it.
  STAFF_DIV_FLOOR: { D1: 55, D2: 40, D3: 22 },
  ROOTS_RADIUS_MI: 300,
  // flat home-market radius (independent of dist tiers)
  // Evaluator perception (player-facing fog softening) [TUNE]
  EVAL_LERP_STEP: 0.0458,
  // ×12 ≈ 0.55 max lerp vision→truth
  EVAL_NOISE_SD_BASE: 10,
  // F noise stdev
  EVAL_NOISE_SD_STEP: 0.583,
  // ×12 ≈ 7 → A+ noise stdev ≈ 3
  // ── Coach XP feeds (Chunk 4) [TUNE] ──
  GEM_GAP: 12,
  // truth − vision to count as a gem
  CONTESTED_MARGIN: 10,
  // #1 vs #2 interest gap ≤ this = contested
  PUNCH_UP_PRESTIGE_MAX: 3,
  // prestige ≤ this + high/mid recruit = punching up
  XP_SIGN_BASE: 1,
  XP_CONTESTED: 5,
  XP_FLIP: 8,
  XP_GEM_SIGN: 6,
  XP_PUNCH_UP: 4,
  XP_LONG_RANGE: 4,
  XP_CLEAN_SWEEP: 10,
  XP_ROOTS_SIGN: 2,
  // was 3 (Chunk 10: tried 5 and 3, dialed back — see deliverable table)
  XP_ROOTS_GEM: 3,
  // ── Evaluator XP (Chunk 10 — was unwired) [TUNE] ──
  XP_SCOUT: 2,
  // per unique recruit scouted — the core Evaluator feed
  XP_SCOUT_GEM: 2,
  // bonus for scouting a gem (truth − vision ≥ GEM_GAP)
  // ── Roots thickening (Chunk 10) [TUNE] ──
  XP_ROOTS_CHEAP: 2,
  // landed a local recruit for ≤ ROOTS_CHEAP_THRESHOLD spend
  ROOTS_CHEAP_THRESHOLD: 800,
  // $ spent-on-recruit at/under which the sign counts as "cheap"
  XP_ROOTS_LOCAL_CLASS: 3,
  // season bonus: ≥ half the class was in-radius
  ROOTS_LOCAL_CLASS_SHARE: 0.5,
  // ── Roots from RESULTS (winning thickens roots, losing thins them) ──
  // Roots is now a two-way regional-standing meter: it grows with wins & titles
  // and shrinks with losses. Combined with the sign-based feeds above, roots is
  // much easier to build for a winning program. XP never goes below 0.
  ROOTS_XP_PER_WIN: 2,
  // each regular-season/playoff win adds to roots
  ROOTS_XP_PER_LOSS: 2,
  // each loss thins roots (symmetric with wins; net-positive only if you win)
  ROOTS_XP_PLAYOFF: 6,
  // made the playoff field
  ROOTS_XP_CONF_CHAMP: 12,
  // won the conference (supersedes the playoff bonus)
  ROOTS_XP_NATTY: 30,
  // national title — the town belongs to you (supersedes lesser bonuses)
  // ── Roots retention on a job change (no longer a hard geographic reset) ──
  ROOTS_MOVE_RETENTION: 0.4,
  // keep 40% of roots XP when you take a new job (was effectively 0%)
  XP_MILESTONE: 4,
  RAISER_GAIN: 8,
  XP_RAISER: 3,
  FINISHER_GAIN: 15,
  XP_FINISHER: 10,
  XP_WEEKLY_AWARD: 3,
  // conference-wide O/D Player of the Week (Chunk 2 — was 1 as an own-roster gimme) [TUNE]
  XP_PROGRAM_MILESTONE: 10,
  // Reputation XP per program milestone (career wins, first title...) [TUNE]
  // ── Offseason Chunk 3: roster stages [TUNE] ──
  REDSHIRT_MAX_GAMES: 4,
  // games a redshirt can play and keep the year (league rule)
  WALKON_POOL_EXTRA_MIN: 2,
  // tryout candidates beyond open scholarships (min) — always a real choice
  WALKON_POOL_EXTRA_MAX: 4,
  // tryout candidates beyond open scholarships (max)
  WALKON_POOL_FLOOR: 5,
  // never fewer candidates than this
  WALKON_POOL_CAP: 12,
  // never more than this
  // ── Job applications (contract-stage job board) [TUNE] ──
  APPLICATIONS_MAX: 3,
  // applications per offseason
  APPLY_BASE_ODDS: 0.12,
  // baseline chance before rep-vs-pull adjustment
  APPLY_ODDS_SLOPE: 0.035,
  // odds gained per point of (repScore − pull + slack)
  // ── Offseason Chunk 4: career stages [TUNE] ──
  CLINIC_XP: 15,
  // one directed skill retreat per offseason (~5 weekly awards)
  OFFER_LEVERAGE_JS: 8,
  // [OWNER RULING, Aug 2026 — dynasty vs ladder] PLAYER RETENTION. Every year
  // the player holds another job offer and stays, the AD raises the
  // recruiting pool by 10% of the division's base allocation — permanently,
  // stacking, CAPPED at 100% of that allocation (10 declined calls = double
  // money). Taking ANY new job forfeits the whole stack: that is the choice.
  PLAYER_RETENTION: {
    PCT_PER_OFFER: 0.1,
    CAP_PCT: 1
  },
  // jobSecurity bump for declining outside offers in hand
  GOAL_JS_DELTA: 6,
  // jobSecurity per AD goal hit (+) / missed (−)
  // [PLAYTEST 2026-08-12 item 20] The deal every coach signs in preseason year 1.
  PROVE_IT_YEARS: 2,
  EXTENSION_JS_MIN: 55,
  // extension offered at/above this meter (or expectations met)
  EXTENSION_STABILITY_JS: 4,
  // small seat-stability bump for signing an extension
  RECRUIT_BONUS_BASE: { D3: 300, D2: 500, midMajor: 800, power: 1200 },
  // $/signee by class
  // ── Offseason Chunk 5: development stages [TUNE] ──
  POS_CHANGE_CAP: 3,
  // position conversions per offseason
  POS_CHANGE_PENALTY: 0.08,
  // composite penalty for one season, Developer-reduced
  POS_CHANGE_DEV_SEASONS: 2,
  // seasons a converted player develops slower at the new spot
  POS_CHANGE_DEV_MULT: 0.75,
  // growth multiplier while learning the new position
  SIMPLE_QBRUN_PCT: 12,
  // simple-mode "QB Involved in run game" maps to this qbRunPct (designed QB runs)
  XP_CONVERT_HIT: 6,
  // Evaluator XP when a converted player starts next season
  // ── PASS 7 (Aug 2026): roster brain — snap tracking · morale · convert
  // brain · identity stage 4. All OFF-FIELD machinery (zero sim reads — the
  // bands can only move through roster composition, gated by pass7_band_ab).
  // Kill-switches: __noSnapTrack / __noMorale / __noConvertBrain /
  // __noEarnBridge / __noBulkCut. Plan: Ref/PASS7_ROSTER_PLAN.md.
  PASS7: {
    // Fix D — morale (persistent, visible, portal-only effects)
    moraleInit: 70,
    // baseline; ticks drift back toward it
    moraleGainCap: 3,
    moraleLossCap: 4,
    // per-game clamp on the usage delta
    moraleUsageK: 22,
    // pts of morale swing per 1.0 of (actual − expected) snap share
    moraleDrift: 0.6,
    // per-game pull back toward the baseline
    moraleTeamW: 0.5,
    // per-game team-result term (+win / −loss)
    moraleLowBar: 40,
    moraleMidBar: 55,
    moraleHighBar: 80,
    moraleLowMult: 2.2,
    moraleMidMult: 1.4,
    moraleHighMult: 0.6,
    // portal-probability multipliers by morale bucket
    moraleShareFloor: 0.15,
    // real snap share below this counts as buried for the convert brain
    // Fix C — convert brain
    aiPosChangeCap: 2,
    // AI converts per school per offseason (player school keeps POS_CHANGE_CAP)
    convertBridgeBonus: 3,
    // rec-score bonus when a bridge trait covers the destination
    convertSizeW: 8,
    // rec-score weight on the projected size-fit gain at the destination
    // Stage 4a — earnable bridges (real snaps at a foreign job)
    bridgeEarnSnaps: 220,
    bridgeEarnShare: 0.35,
    // Stage 4b — offseason bulk/cut
    bulkMin: 5,
    bulkMax: 12,
    // per-offseason weight-move cap, WE/CON-seeded within [min,max]
    bulkAttrPer10: { STR: 2, PWR: 1.5, SPD: -2, AGI: -1.5 },
    // coupled attribute nudges per +10 lb (cut = reverse), zero-sum in spirit
    bulkJobShare: 0.35,
    // foreign-job share that makes that job's window the body target
    bulkReportMin: 6
    // player-school inbox digest lists moves at/above this many lb
  },
  DEV_FOCUS_MULT: 1.5,
  // Stage-5 focus group development multiplier
  DEV_NONFOCUS_MULT: 0.9,
  // everyone else when a focus is set
  // ── Offseason Chunk 6: rivalry [TUNE] ──
  XP_RIVALRY: 8,
  // Reputation XP for winning the trophy game
  RIVALRY_DAY: 8,
  // reserved nonconf slot (last one — rivalry week)
  // ── AI recruiting rebuild [TUNE] ──
  // (COMMIT_WINDOWS removed Jul 2026 — the pre-rolled commit calendar it drove was
  //  replaced by battle-decided signing in resolveFunnel. See RECRUITING_LOCK_DAY,
  //  RECRUITING_EARLY_FLOOR and the COMMIT_HOLD_* family, which are the live knobs.)
  AI_TARGETS_PER_SLOT: 5,
  // board depth per open scholarship — schools board FAR more than they can
  // sign because they lose most head-to-head battles; a thin board leaves open
  // slots when targets pick rivals. [rebuild: 3→5 so classes actually fill]
  AI_BOARD_CAP: 48,
  // max targets per AI school
  AI_SUITORS_CAP: 10,
  // max AI schools pursuing one recruit
  AI_SUITORS_MIN: 2,
  // every recruit gets at least this many suitors
  AI_STEAL_CHANCE: 0.03,
  // per school per season: plant a flag on ONE elite
  // reach-down kid (top RECRUIT_REACH_DOWN slice of the
  // tier below). Fit-sorted boards never reach down on
  // their own — own-tier supply always fills the board —
  // so this is the only AI path for the sanctioned steal.
  // ~3% × ~100 schools/division ≈ 2-3 signed poaches a
  // season league-wide (owner spec: 0-4), never two tiers.
  // [TUNE Jul 2026: 0.12→0.03 — 0.12 landed 6-8/season]
  // ── AI spending economy (recruiting rebuild phase 2) ────────────────────
  // AI schools spend their real coach.budget on board targets through the same
  // $/point economics as the player. They pace spending across the cycle,
  // concentrate on their top live targets, and BOW OUT of races where closing
  // the gap would burn too much of what's left — then redeploy that money.
  AI_PRIORITY_TOP: 12,
  // weekly wallet concentrates on this many live targets (deeper board needs
  // wider weekly coverage so lower-priority slots still get pursued)
  AI_BOWOUT_GAP: 20,
  // trailing the leader by this much triggers the cost check
  AI_BOWOUT_BUDGET_FRAC: 0.12,
  // bow out if closing would cost more than this share of remaining budget
  AI_BOWOUT_HOPELESS_LEAD: 85,
  // leader at/above this...
  AI_BOWOUT_HOPELESS_GAP: 35,
  // ...while trailing by this much = race over, withdraw
  AI_SPEND_AGGRO: 1,
  // multiplier on the paced weekly wallet [TUNE]
  // ── AI aggression + war-chest (rebuilt) ──────────────────────────────────
  // Each AI school earmarks extra spend for its top-priority (must-have)
  // targets and will overpay to win them; cheap depth pieces it's losing are
  // conceded. War-chest intensity rides on top of the difficulty multiplier.
  AI_WARCHEST_TARGETS: 3,
  // how many top-priority targets get war-chest treatment
  AI_WARCHEST_MULT: 2.4,
  // a war-chest target can draw up to this many × its fair wallet slice [TUNE]
  AI_PRIORITY_SPEND_POW: 1.6,
  // higher = wallet skews harder toward high-priority targets [TUNE]
  AI_AGGRO_WALLET_MIN: 0.55,
  // aggression's floor effect on the weekly wallet (weak programs pace slower)
  // ── AI endgame (fill the class, don't hoard) ─────────────────────────────
  // As signing day nears with open slots, schools bail losing races and spend
  // their reserve on winnable kids. Prevents ending with open slots + cash.
  AI_ENDGAME_WEEKS: 7,
  // urgency ramps over the final N weeks
  AI_ENDGAME_SPEND: 0.85,
  // at full urgency, deploy this fraction of the reserve above the paced wallet
  AI_ENDGAME_WINNABLE: 1.6,
  // extra weight on winnable targets at full urgency
  // ── Early commitments ────────────────────────────────────────────────────
  // The EARLY_COMMIT_* and SEAL_COMMIT_* families were removed Jul 2026 along with the
  // scheduled-commit-date system they gated. Signing is now purely emergent: a leader
  // closes when he clears commitThreshold() and holds a lead for COMMIT_HOLD_* weeks,
  // when the field collapses, or at the RECRUITING_LOCK_DAY hard lock. See resolveFunnel.
  AI_GAIN_BASE: 0.45,
  // weekly interest gain floor per pursuing school
  AI_GAIN_FIT: 0.85,
  // × fit score (prestige match × need × distance)
  AI_SHARE_MAX: 2,
  // pressure concentration cap as a board empties
  AI_DIST_FIT: { local: 1.3, near: 1.1, mid: 0.9, far: 0.7 },
  // AI prefers local
  // ── Preseason program [TUNE] ──
  SPRING_DEV_MULT: 0.15,
  // spring-game "game reps": share of a camp's minutes, whole roster
  // ── Per-position award XP (Chunk 7) — rarity scales value [TUNE] ──
  // ~26 conf awards + ~13 division awards per season is far more XP inflow
  // than the old flat OPOY/DPOY, so per-award values come down hard.
  XP_ALLCONF_POS: 2,
  // best at position in a conference — small trophy
  XP_ALLDIV_POS: 6,
  // best at position in the whole division — real prize
  XP_MVP_DEV: 12,
  XP_MVP_REP: 10,
  XP_COY: 12,
  XP_DIV_COY: 20,
  XP_CONF_TITLE: 8,
  XP_DIV_TITLE: 15,
  XP_UNDEFEATED: 10,
  // Reputation economy (Chunk 5 rebalance) [TUNE]
  // (legacy) overperformance gap → rep xp; superseded by the grade-driven feed
  // ── Reputation driven by the season coach grade (roots treatment) ──
  REP_GRADE_SCALE: 90,
  // grade score above/below 0.5 × this → rep xp. An A season (~0.9) = +36, an
  // exactly-met-expectation B- (~0.62) = +11, a bad D season (~0.25) = −22. Easier
  // to build than the old thin overperf-only bump; a losing season now costs rep.
  REP_GRADE_NATTY: 40,
  // national title: a huge rep spike on top of the grade score
  REP_GRADE_CONF: 15,
  // conference title: a solid rep bump on top of the grade score
  REP_ANNUAL_DECAY: 0.025,
  // 2.5% of current rep xp erodes each offseason (was 4% — lightened so a strong
  // résumé holds; pairs with the bigger grade-driven gains, the roots treatment)
  REP_DECAY_FLOOR: 12,
  // decay never drops rep below this xp (keeps a baseline name)
  // ── Recruit wants (Chunk 5) [TUNE] ──
  WANT_CHANCE: 0.45,
  // per-roll chance, rolled twice → 0–2 wants
  WANT_TYPES: ["DEVELOPMENT", "PEDIGREE", "PROGRAM"],
  // wantMod applied per satisfied/unsatisfied want in calcGain:
  // Share-of-room era: FIT IS THE LEVER. These were timid (1.15/0.85) when
  // wants were a small faucet into a private bar. Now they decide what your
  // dollars are WORTH against the room — the way a D3 program with a good
  // read beats a war chest with a bad one. A 3-want recruit who loves
  // everything you are: 1.9x. One who wants everything you are not: 0.34x.
  WANT_MOD_SATISFIED: 1.24,
  WANT_MOD_UNSATISFIED: 0.7,
  // ── Playing-time want (path-to-play, Jul 2026) ──────────────────────────
  // A 4th want with IMPORTANCE (unlike the other three). The recruit weighs his
  // projected path to the field at YOUR school: a wide-open depth chart pulls him,
  // a logjam pushes him away — even against a bigger program. Scouting reveals it.
  PT_WANT_CHANCE: 0.62,
  // chance a recruit cares about playing time at all (has the want)
  PT_HIGH_SHARE: 0.34,
  // of those, ~1/3 weigh it HIGH; rest split med/low
  PT_MED_SHARE: 0.4,
  // next ~40% medium; remainder low
  PT_IMPORTANCE: { low: 0.5, med: 1, high: 1.8 },
  // importance multiplier on the path swing
  PT_SWING: 0.4,
  // max ±: a HIGH-importance recruit sees up to ~1 + 1.8×0.4 = 1.72× on a day-one
  // path, down to ~1 − 1.8×0.4 = 0.28× in a logjam. Med/low scale down from there.
  // satisfaction grade thresholds (grade index 0..12): B− = idx 7, D+ = idx 3
  WANT_SATISFY_IDX: 7,
  // coach grade ≥ this (or prestige ratio ≥ hi) = satisfied
  WANT_UNSATISFY_IDX: 3,
  // coach grade ≤ this (or prestige ratio ≤ lo) = unsatisfied
  // PROGRAM want reads prestige ÷ division cap:
  WANT_PROGRAM_HI: 0.75,
  // ratio ≥ this = satisfied
  WANT_PROGRAM_LO: 0.4,
  // ratio ≤ this = unsatisfied
  // Multi-year performance window for prestige movement (recentWins[0..2]).
  PRESTIGE_WINDOW_WEIGHTS: [0.5, 0.3, 0.2],
  // [TUNE]
  // ── Career / job security (Chunk 8) [TUNE] ──
  EXPECT_BASE: 0.3,
  EXPECT_PRESTIGE_STEP: 0.1,
  // expectedWinPct = base + prestige*step
  JOBSEC_START: 60,
  // new-hire hot-seat meter start (0–100)
  // ── Lore-driven starts (Jul 2026) ────────────────────────────────────────
  // Each start re-points a system that already exists at a program's real
  // generated history. No flavor-only modes: every number here is consumed.
  ASHES_SCHOLARSHIP_CAP: 14,
  // probation: signable slots (vs ~25 normal)
  ASHES_PROBATION_YEARS: 3,
  // seasons the reduction runs
  ASHES_JOBSEC_START: 82,
  // the AD knows what he handed you — long leash
  ASHES_LEASH_BLEED: 0.35,
  // while on probation, losses cost 35% of normal
  HOTSEAT_JOBSEC_START: 34,
  // banners on the wall, patience gone
  HOTSEAT_EXPECT_PER_TROPHY: 6e-3,
  // the town measures you against the trophy case
  HOTSEAT_EXPECT_MAX: 0.12,
  // +12% expected win rate at most (a real cliff)
  HEIR_STAFF_PREMIUM: 1.45,
  // the legend's assistants, at the legend's price
  HEIR_JOBSEC_START: 58,
  // fine for now. For now.
  HEIR_MANDATE_PREMIUM: 0.6,
  // the town wants his numbers AND change
  JOBSEC_PER_DELTA: 12,
  // meter move per win of (actual − expected)
  JOBSEC_PRESTIGE_STABILITY: 3,
  // per prestige star: blue-bloods get more rope
  JOBSEC_WARM: 50,
  JOBSEC_HOT: 25,
  // meter thresholds for warm/hot seat
  JOBSEC_FIRE_FLOOR: 0,
  // meter at/below this = fired
  JOBSEC_FIRE_STREAK_DELTA: -3,
  // delta this bad two seasons running = fired
  JOBSEC_GRACE_SEASONS: 1,
  // new hires can't be fired for this many seasons
  OFFER_SLACK: 4,
  // how far below a school's pull a coach's rep can be and still get an offer [TUNE]
  OFFER_MAX: 4,
  // max offers / shortlist size
  // ── AI coaching carousel (real openings) ──────────────────────────────
  // Churn target is a fraction of each division's schools per season (real CFB
  // turns over ~15-20% of a division's seats a year). Applied per division so a
  // big division churns proportionally more than a small one.
  CAROUSEL_CHURN_MIN: 0.1,
  // floor: at least this fraction of a division changes
  CAROUSEL_CHURN_MAX: 0.2,
  // ceiling: at most this fraction of a division changes
  CAROUSEL_FIRE_PROB: 0.5,
  // chance a fire-eligible AI coach is actually let go
  CAROUSEL_FIRE_DELTA: -3,
  // must be this many wins below expectation (a bad year, not just below avg)
  CAROUSEL_LAPSE_PROB: 0.4,
  // chance an expiring underwhelming deal isn't renewed
  CAROUSEL_RETIRE_TENURE: 8,
  // seasons of tenure before retirement becomes possible
  // [DNA TREE §8] SUPERSEDED by COACH_AGE below — retirement now keys on age,
  // not tenure, because cascadeCarousel resets tenure on every poach and hot
  // journeymen could never retire. Kept for reference only.
  CAROUSEL_RETIRE_PROB: 0.1,
  // per-season retirement chance once eligible (superseded, see above)
  // ── Coach age — the run clock (DNA TREE §8, tuning per D9) ─────────────
  // Every coach (player + AI HC + coordinators) carries an age rolled at
  // generation. Retirement becomes possible at RETIRE_ELIGIBLE with a hazard
  // that ramps per year, and nobody coaches past RETIRE_FORCE. Age never
  // resets on a poach — that is the whole point.
  COACH_AGE: {
    HC_MIN: 38,
    HC_MAX: 58,
    // AI head-coach hire-age roll
    COORD_MIN: 31,
    COORD_MAX: 52,
    // coordinator generation roll
    PLAYER_START_MIN: 34,
    PLAYER_START_MAX: 38,
    // a fresh career starts young — the runway IS the run
    RETIRE_ELIGIBLE: 62,
    // retirement possible from this birthday
    RETIRE_BASE: 0.08,
    // hazard at the eligible birthday itself
    RETIRE_RAMP: 0.055,
    // hazard grows this much per year past eligible
    RETIRE_FORCE: 74
    // the wall: nobody starts a season at or past this age
  },
  CAROUSEL_POACH_PROB: 0.35,
  // chance a strong small-school AI coach is hired away
  CAROUSEL_PROMOTE_MIN: 2,
  // min "hot score" (overperformance + streak + rep) for an AI coach to be
  // promotion-eligible in the cascade. Keeps promotions earned, not random.
  COORD_HC_MAX_PRESTIGE: 3,
  // a coordinator can only leap straight to HEAD COACH at a program this prestige
  // or lower (a realistic first-HC-job rung — coordinators don't jump to blue-bloods)
  COORD_HC_MIN_RATING: 78,
  // min coordinator rating average to be a head-coach candidate — only standouts
  // ── Coordinator identity (DNA TREE §5b, tuning per D9) ─────────────────
  STAFF_ID: {
    // Rust: schemeIQ decays toward his ROLLED baseline floor when a formation
    // goes unused. Slower than growth (up to 6/season concentrated), so a
    // season of real calls outruns ~3 seasons of shelf time.
    RUST_PER_SEASON: 2,
    // Star bands for a formation sheet (schemeIQ 25–92): ★/★★/★★★/💎.
    STAR_IQ: [45, 60, 75, 88],
    // Ambition: Climber (wants a head job, will leave) vs Lifer (stays if
    // respected). Better coordinators are hungrier.
    CLIMBER_BASE: 0.2,
    CLIMBER_PER_QUALITY: 8e-3,
    CLIMBER_MIN: 0.12,
    CLIMBER_MAX: 0.55,
    // Poach appetite by ambition: a Climber answers the phone, a Lifer
    // mostly doesn't.
    POACH_MULT_CLIMBER: 1.25,
    POACH_MULT_LIFER: 0.5,
    // D4 — retention: ONLY on a live job offer, the player may pay this share
    // of the division's fixed base allocation (C.ECON.BASE[div]) to keep him,
    // deducted from NEXT season's budget (pendingScheduleGuarantee plumbing).
    // [OWNER RULING, Aug 2026] It is NOT one-time: every time a suitor comes
    // back for the same man, the price DOUBLES (10% → 20% → 40% → ...).
    // Eventually you can't afford him — he leaves, or you promise a Climber
    // the seat and end the auction. RETENTION_ESCALATION is the doubling base.
    RETENTION_PCT: 0.1,
    RETENTION_ESCALATION: 2,
    // D5 — the succession promise: money only, and it costs MORE than a
    // retention because it is a seat, not a raise. Same next-season plumbing.
    PROMISE_PCT: 0.2,
    // Per-season unit-grade ledger cap (save diet).
    LEDGER_CAP: 12
  },
  OFFER_CALL_PROB: 0.5,
  // chance a genuine opening you qualify for actually calls you [TUNE]
  // ── Promotion gate: sustained dominance, not a single good year (Chunk 9 §3) ──
  DOMINANCE_DELTA: 3,
  // wins over expectation that count as a "dominant" season [TUNE]
  OFFER_COOLDOWN: 1,
  // seasons between offer waves if declined (prevents standing menu) [TUNE]
  // Commit threshold (§7.3). Spec intent: high Work Ethic commits FASTER (lower
  // bar). threshold = BASE − WE × WE_MOD, clamped to [FLOOR, CEIL]. With these
  // values a WE-0 recruit needs 85 interest, a WE-99 recruit needs ~45 — both
  // reachable against the 100 interest ceiling, so recruiting actually resolves.
  COMMIT_THRESHOLD_BASE: 85,
  COMMIT_WE_MOD: 0.4,
  COMMIT_THRESHOLD_FLOOR: 28,
  COMMIT_THRESHOLD_CEIL: 90,
  // Field-narrowing relief: how far the commit bar drops when the field has
  // narrowed to a near-final race (fewer active suitors = lower bar to commit).
  COMMIT_FIELD_RELIEF: 34,
  // max points shaved off when down to a lone/two-horse race
  COMMIT_FIELD_CAP: 5,
  // suitors-above-one at which relief fully phases out
  SEPARATION: 15,
  MAX_CAMPUS_VISITS: 5,
  // ── Battle-decided signing (rebuilt) ─────────────────────────────────────
  // Timing is emergent from the weekly contact battle — no pre-rolled calendar.
  // Final recruiting day; any still-open recruit hard-locks to its leader here.
  RECRUITING_LOCK_DAY: 19,
  // A leader over the recruit's commit threshold signs once it has HELD a lead
  // over #2 for the required number of consecutive weeks. Bigger margins need
  // fewer weeks (a blowout resolves fast; a dogfight grinds and can flip).
  RECRUITING_EARLY_FLOOR: 8,
  // no battle-driven commit before this day (field can still tighten); avoids a day-5 pile-up
  COMMIT_BLOWOUT_GAP: 30,
  // runaway lead
  COMMIT_CLEAR_GAP: 16,
  // clear, comfortable lead
  COMMIT_HOLD_BLOWOUT: 2,
  // weeks to hold a blowout gap
  COMMIT_HOLD_CLEAR: 3,
  // weeks to hold a clear gap
  COMMIT_HOLD_UNCONTESTED: 3,
  // weeks when essentially alone
  COMMIT_HOLD_CONTESTED: 4,
  // weeks to hold a narrow lead in a real fight
  // Live funnel narrowing (presentation): trim to top-N by interest on/after
  // these days. Cuts trailing suitors; never triggers a commit itself.
  FUNNEL_TOP8_DAY: 8,
  FUNNEL_TOP5_DAY: 12,
  FUNNEL_TOP3_DAY: 15,
  // Funnel core (Phase 1 SP recruiting — §3)
  FUNNEL_SIZE: { top8: 8, top5: 5, top3: 3 },
  // Starting interest range for seeded rivals, by recruit visibility tier.
  RIVAL_INTEREST: { low: [5, 18], mid: [15, 30], high: [25, 42] },
  // Per-week interest drift range for rivals, by visibility tier.
  // Distance multiplier applied to rival drift each week (far rivals apply more pressure).
  RIVAL_DRIFT_DIST_MULT: { local: 0.7, near: 1, mid: 1.4, far: 2 },
  // visionRating thresholds that set a recruit's expectation tier.
  FUNNEL_TIER_MID: 45,
  FUNNEL_TIER_HIGH: 65,
  // Caliber-visibility overlap at division boundaries (search filter)      [TUNE]
  // ── Caliber walls (Jul 2026) ─────────────────────────────────────────────
  // Divisions recruit different players, period. A D3 coach never sees (and
  // never loses) a kid D2 actually wants — the upset isn't prevented by a
  // rule, it's structurally impossible, which is what makes every fight on
  // your board a fight worth having and every $600 real money.
  // The blur bands are the ONLY overlap: the tweeners at each boundary, where
  // a real cross-tier scrap can happen. Enforced identically for AI boards
  // (buildAIRecruiting) so class quality per division comes out by
  // construction and the ecosystem stays honest.
  RECRUIT_REACH_DOWN: 0,
  // 0 = STRICT tier gating (Jul 2026): no cross-tier
  // overlap. Set >0 to reopen the top X% of the tier
  // below as steal-eligible (0.13 = the old 13% band).
  RECRUIT_REACH_UP: 0,
  // 0 = strict. Set >0 to let a division see the
  // bottom X% of the tier above (0.12 = old band).
  // ── AI talent perception (Phase 1 battle brain) ──────────────────────────
  // Each AI coach perceives a recruit's TRUE rating through a lens set by its
  // talentEval (0-1). perceived = star + talentEval × (true − star) + noise.
  // talentEval 1.0 ≈ sees truth; 0.0 ≈ sees only the public star rating. The
  // noise keeps even sharp staffs from being perfect oracles. Perception is
  // cached per board entry so a coach's opinion of a kid stays stable (legible
  // behavior) instead of jittering every cycle.
  PERCEPTION_NOISE_SD: 6,
  // stdev of the perception noise term
  PERCEPTION_INTEREST_GATE: 18,
  // AI won't pursue a kid it perceives below this
  // Vision (§6)
  VISION_W: [4, 2, 1],
  // Reputation (§10.1)
  REP_WIN: 2,
  REP_TITLE: 8,
  REP_BROKEN: 5,
  REP_VIOLATION: 10,
  REP_RESCIND: 3,
  // Prestige (§12)
  // [PLAYTEST 2026-08-12 item 18] Re-tuned. At 0.12 a 1-star program that went
  // 11-1 gained +0.025 prestige — it entered the next August still a 1-star,
  // which is the owner's exact report. The theoretical ceiling from winning was
  // +0.06/season, so a full star took 3-4 undefeated title years while a 12%
  // baseline creep dragged you back toward where you started. Prestige was
  // effectively static. Measured before/after by tools/prestige_trajectory_probe.
  PRESTIGE_W_WIN: 0.4,
  // Winning big is worth more than winning. Above SURGE_AT the gain goes
  // super-linear, and below SLUMP_AT the fall does the same — so a program that
  // is genuinely great (or genuinely collapsing) moves at the pace people expect,
  // while an ordinary winning season still only nudges.
  PRESTIGE_SURGE_AT: 0.7,
  PRESTIGE_W_SURGE: 0.6,
  PRESTIGE_SLUMP_AT: 0.3,
  PRESTIGE_W_SLUMP: 0.6,
  PRESTIGE_W_TITLE: 0.15,
  PRESTIGE_W_BOWL: 0.04,
  PRESTIGE_W_CONF: 0.08,
  // conference title bump (was designed, never wired)
  PRESTIGE_W_DECAY: 0.02,
  // Program building (the Boise State arc): a band stretched by sustained
  // overperformance drags the BASELINE itself — slow, permanent, symmetric.
  // ~0.08 of the gap per season: a decade of +1★ form ≈ +0.6★ of permanent
  // pedigree. Fading powers sink the same way. Division caps still bound it.
  // [PLAYTEST 2026-08-12 item 18] 0.12 → 0.05. The baseline is what prestige
  // decays TOWARD, so a fast creep normalised a hot streak almost as quickly as
  // it was earned. A run should take a few years to become who you are.
  PRESTIGE_BASELINE_CREEP: 0.05,
  // [Season Mode / Division Editor, 2026-08-13] The D1 BLUE-BLOOD toggle. A
  // per-school flag (school.blueBlood) the Division Editor sets — INERT by
  // default (no procedural school is flagged, so the standing world is
  // untouched). A blue blood (a) floors near the top of its band —
  // prestigeMax − BLUE_BLOOD_FLOOR_DROP — so it never sinks to a mid-major, and
  // (b) declines at BLUE_BLOOD_DECLINE_MULT of the normal rate, so a couple of
  // down years don't erase the brand. It still MOVES within the major band and
  // can still climb; the recruiting edge falls out for free (recruiting keys off
  // prestige, and a blue blood stays high). D2/D3 don't use this — their
  // powerhouses churn.
  BLUE_BLOOD_FLOOR_DROP: 1,
  BLUE_BLOOD_DECLINE_MULT: 0.5,
  // Job market (§10.2)
  JOB_REP_W: 0.5,
  JOB_WIN_W: 0.35,
  JOB_TIER_W: 0.15,
  // Roster
  ROSTER_SIZE: 75,
  SEASON_CUT_CAP: 5,
  // voluntary roster cuts per season (over-cap trims exempt — the cutdown week must always be completable)
  // Season (§15) — 12 games per team: 4 nonconf + 8 conf.
  // Partial conference schedule (not round-robin): any conf size 9–13 works with 9 conf-day slots.
  NONCONF_GAMES: 4,
  // [TUNE] non-conf games per team (weeks 5–8)
  CONF_GAMES: 8,
  // [TUNE] conference games per team (partial, rotating — spec §B.3)
  // §17 Fatigue & Snap-% Rotation
  // Accumulation per snap on field:  gain = PER_SNAP × (STA_PIVOT / player.STA)
  // Recovery per snap on bench:      rec  = RECOVERY × (player.STA / STA_PIVOT)
  // Bench threshold raised to 82 so avg-STA players don't gas mid-game;
  // the snap-% cap is the binding control, fatigue is the performance cost.
  FATIGUE_PER_SNAP: 1.2,
  // gain at STA = pivot
  FATIGUE_STA_PIVOT: 75,
  // STA value where gain = base
  FATIGUE_RECOVERY_RATE: 1.2,
  // recovery per sitting snap at STA = pivot
  FATIGUE_BENCH_THRESHOLD: 82,
  // bench when fatigue ≥ this
  FATIGUE_RETURN_THRESHOLD: 40,
  // re-enter when fatigue ≤ this (hysteresis gap = 42)
  FATIGUE_DEGRADE_ONSET: 45,
  // no degradation below this level
  FATIGUE_DEGRADE_FLOOR: 0.82,
  // min physical-attr multiplier at fatigue 100
  // ═══ W4 (Aggression Defense §2 / Protection Identity §16.2 / clock #6) ═══
  // The numeric blitz layer dies: the coach picks an AGGRESSION stop (how much
  // risk) and a PRESSURE IDENTITY (what the heat looks like); the SIM owns the
  // translation — stop × identity × situation × the front's signature package
  // → per-snap call rate, who comes, and the coverage behind it. Old saves
  // migrate blitzPct → nearest stop; 'balanced' at the old 20% default keeps
  // the untouched league where it was. [TUNE W10]
  AGGRESSION: {
    order: ["bend", "selective", "balanced", "attacking", "house"],
    labels: { bend: "Bend", selective: "Selective", balanced: "Balanced",
              attacking: "Attacking", house: "Bring the House" },
    // Stop → base pressure-call rate (%, kept mirrored onto gp.blitzPct so
    // every legacy reader — scout memos, DNA XP, the draw's caught-blitz roll —
    // keeps telling the truth about the new dial).
    rate: { bend: 8, selective: 14, balanced: 20, attacking: 32, house: 45 },
    // Situation shaping (sim-owned): SELECTIVE is a personality, not a low
    // number — he sits on early downs and UNLOADS on the obvious passing down.
    // The house doesn't care what down it is.
    passDownMult: { bend: 0.8, selective: 2.4, balanced: 1.25, attacking: 1.35, house: 1.1 },
    earlyDownMult: { bend: 0.8, selective: 0.5, balanced: 0.95, attacking: 1, house: 1 },
    // DC quality shifts WHEN (§2): Blitz Design above 50 concentrates the
    // calls into leverage downs; below 50 they come at random moments.
    timingSpan: 0.5,
    extraHouse: 1,
    // 'Bring the House' adds one more hat to every fired call
    capRate: 0.8,
    minCoverBodies: 4
    // never rush past this many LB+DB left behind the call
  },
  // The four identities (§2): who the extra hats ARE, and the risk tier —
  // fire zone (low) < second level < safety/CB heat (hole behind) < zero (max).
  // deepRisk scales the vacated-deep-middle boost when a DB is in the rush.
  PRESS_IDENTITY: {
    fireZone: { label: "Fire Zone", extra: 1, drop: true, db: false, zero: false, deepRisk: 1 },
    secondLevel: { label: "Second Level", extra: 1, drop: false, db: false, zero: false, deepRisk: 1 },
    secondaryHeat: { label: "Secondary Heat", extra: 1, drop: false, db: true, zero: false, deepRisk: 1.15 },
    theHouse: { label: "The House", extra: 2, drop: false, db: true, zero: true, deepRisk: 1.5 }
  },
  PRESS_SIG_BONUS: 10,
  // Blitz Design lift when the identity IS the front's signature package
  PRESS_SIG_DOCK: 6,
  // ...and the dock for asking a front to run someone else's blitz
  FZ_DROP_RATE: 0.8,
  // [PLAYTEST 2026-08-12 item 4B] How often a drop-eligible edge bails out of a
  // shown rush on his own, with no dial set. This lived as a bare `?? 18` inline
  // in sim.js while every other pressure number lives here — and the depth-chart
  // tooltip hard-coded the same 18 in prose, so the two were free to drift apart.
  FZ_NATIVE_DROP_PCT: 18,
  // non-3-4 fire zone: odds the shown rusher actually bails
  // ── PASS 4 (Aug 2026): pressure flavors — call ingredients only ────────────
  // pressLook ("mug"/"amoeba") and dogGame ("green"/"cross") ride defCalls
  // payloads through applyDefCall→syncDefEff→pickDefCall. Kill-switch:
  // globalThis.__noPressFlavors. Every term below is a perturbation on an
  // existing lever — no new rush engine. Gates: mug/greendog/crossdog/amoeba
  // probes + pass4_band_ab.
  PRESS_FLAVOR: {
    // Double-A mug: fired = interior heat (A-gap dogs harder to pick up, the
    // center's half-slide points are spent on the mug); bailed = the bluff
    // bodies sink into the low hole; the show fights the hot read all snap.
    mugPickupDock: 0.15,
    mugCawrMute: 0.5,
    // center AWR pulled this fraction toward 50 on fired mugs
    mugHotDisg: 0.08,
    mugDisguise: 0.08,
    mugBailSqueeze: 0.06,
    // −sep on the most-open short/med target when the mug bails (half on #2)
    mugRunIn: 1.03,
    mugRunOut: 0.97,
    // Green dog (refit, owner call): man coverage + the back stays in ⇒ his
    // defender converts, late — the protection never counted him, but a late
    // dog is picked up a shade less often than a called blitzer... he IS the
    // free man more often (dock multiplies pickup odds DOWN).
    dogLatePickup: 0.75,
    // Cross-dog: the two-backer pick game aimed at the center. CREEPER-shaped
    // free-runner odds; BOB's man-rules are what the pick attacks, Quick beats
    // it with the ball out. Failed pick = both crossers absorbed in the wash.
    crossBase: 0.1,
    crossDesign: 3e-3,
    crossAwr: 35e-4,
    crossCap: 0.3,
    crossBob: 1.3,
    crossQuick: 0.55,
    crossMaxProt: 0.8,
    crossAbsorb: 0.35,
    // block-rep context shift (blocker-favoring, ALIGN_EDGE scale) on both
    // crossers when the center passes the game off — absorbed in the wash
    crossCheckdown: 0.05,
    // the wash has no underneath rally: checkdown +sep vs a run cross
    // Amoeba: nobody's hand down. Pure presentation — disguise way up, the
    // QB's box read and hot ID degraded; the price is a standing front (run
    // softness, slower fire-off on unfired snaps).
    amoebaDisguise: 0.2,
    amoebaDisguiseCap: 0.6,
    amoebaSeeIt: 0.5,
    amoebaHot: 0.12,
    amoebaUnfiredPocket: 0.94,
    amoebaRunSoft: 0.95
  },
  // Protection identity (§16.2) — the offense's mirror. halfSlide = the modern
  // default = the pre-W4 engine. Factors multiply protectMult (sack/pressure
  // odds): >1 = the pocket is worse, <1 = better. tilt applies only on FIRED
  // pressure snaps (pressure identity × protection identity — the matchup
  // table); base applies by protection alone.
  PROT_IDENTITY: {
    order: ["quick", "halfSlide", "bob", "maxProtect"],
    labels: { quick: "Quick Game", halfSlide: "Half-Slide", bob: "Big-on-Big", maxProtect: "Max Protect" },
    base: {
      quickShort: 0.62,
      // ball out on rhythm: sacks nearly impossible on schedule
      quickDeep: 1.18,
      // ...but five men and a deep drop is exposed air
      bobFourMan: 0.88,
      // trust your five: best 1-on-1 clarity vs a four-man rush
      slideAwr: 0.0015
      // half-slide: the CENTER's AWR sets the slide (per pt off 50)
    },
    tilt: {
      quick: { fireZone: 0.92, secondLevel: 0.92, secondaryHeat: 0.82, theHouse: 0.72 },
      halfSlide: { fireZone: 1, secondLevel: 1, secondaryHeat: 1, theHouse: 1 },
      bob: { fireZone: 1.25, secondLevel: 0.9, secondaryHeat: 1, theHouse: 1 },
      maxProtect: { fireZone: 1, secondLevel: 0.95, secondaryHeat: 0.85, theHouse: 0.85 }
    },
    // Quick game caps depth: this share of the deep bucket moves to short.
    quickDeepShift: 0.5,
    // TE/RB dial overrides (§16.2): Max Protect keeps everyone home; Quick
    // Game empties the backfield into routes. (halfSlide/bob leave the
    // protEmphasis machinery exactly as it was.)
    maxProtectTE: 1,
    quickTE: 0.08,
    quickRelease: 0.75,
    bobRelease: 0.65
  }
};
OVR_POS_ADJ = {
  // Each value is (58 − that position's raw mean), so every position averages
  // ~58 and OVR stays comparable across the roster.
  //
  // RE-DERIVED 2026-08-12 (playtest item 3 — "corners overall too high").
  // The Jul 2026 values were correct when they were sampled and then rotted:
  // AWR was added to the CB and DE cores AFTER that census, and a core
  // attribute spawns ~0.6×its threshold above base, so every corner silently
  // gained ~3.7 raw OVR and every end ~2.1 — with the offset never re-derived
  // to absorb it. Corners had drifted to a mean of 65.1 against a target of 58,
  // sitting +6.2 over safeties and +7.6 over quarterbacks. The census also
  // caught a second offender nobody had reported: offensive linemen at +5.9.
  //
  // Measured by `tools/pos_ovr_census_probe.mjs --derive` over 3 generated
  // worlds (~75k players — the same sample shape the original comment cites),
  // and A/B'd in-process with matched RNG by `tools/ovr_adj_ab.mjs`: comp%
  // +0.10, yds/att +0.04, yds/carry +0.04, sacks −0.09. The numbers changed;
  // the football did not.
  //
  // K AND P ARE DELIBERATELY NOT RE-DERIVED. The census says both read ~3.5
  // low, but nothing in the game compares a kicker's overall to a corner's —
  // the number exists to rank kickers against kickers — and their composite
  // feeds a separately calibrated kicking model. The A/B proved the cost:
  // pulling K/P onto the 58 scale was the ONLY change that moved scoring
  // (+1.5 pts/team, straight through the FG model). Specialists keep their
  // own scale on purpose; `pos_ovr_census_probe` exempts them for this reason.
  QB: -3.2,
  RB: 5.3,
  FB: 7.7,
  WR: -3.9,
  TE: 5.1,
  OL: -6.7,
  DE: 0,
  DT: -1.1,
  OLB: 1.3,
  LB: 2.3,
  CB: -5.6,
  S: -3.1,
  K: -8.9,
  P: -14.6
};
POS_WEIGHTS = {
  // GENERATED from the contest table (average of each position's archetype
  // roles) — edit tools/roleweights_from_contests.mjs, not this block.
  CB: { SPD: 31, AGI: 19, PWR: 2, STR: 3, JMP: 8, HND: 3, TEC: 12, AWR: 22 },
  DE: { SPD: 17, AGI: 12, PWR: 16, STR: 22, JMP: 3, TEC: 16, AWR: 14 },
  DT: { SPD: 11, AGI: 6, PWR: 22, STR: 26, JMP: 3, TEC: 17, AWR: 15 },
  FB: { SPD: 3, AGI: 3, PWR: 23, STR: 14, HND: 13, SEC: 10, TEC: 16, AWR: 18 },
  K: { PWR: 25, STR: 25, TEC: 25, AWR: 25 },
  LB: { SPD: 29, AGI: 17, PWR: 7, STR: 11, JMP: 2, HND: 1, TEC: 12, AWR: 21 },
  OL: { SPD: 2, AGI: 3, PWR: 24, STR: 25, TEC: 23, AWR: 23 },
  OLB: { SPD: 27, AGI: 22, PWR: 6, STR: 12, JMP: 3, HND: 1, TEC: 14, AWR: 15 },
  P: { PWR: 25, STR: 25, TEC: 25, AWR: 25 },
  QB: { SPD: 7, AGI: 7, PWR: 2, STR: 17, SEC: 8, TEC: 25, AWR: 34 },
  RB: { SPD: 19, AGI: 17, PWR: 10, STR: 5, HND: 12, SEC: 10, TEC: 12, AWR: 15 },
  S: { SPD: 29, AGI: 16, PWR: 4, STR: 5, JMP: 6, HND: 3, TEC: 12, AWR: 25 },
  TE: { SPD: 10, AGI: 9, PWR: 10, STR: 8, JMP: 7, HND: 26, TEC: 15, AWR: 15 },
  WR: { SPD: 19, AGI: 12, PWR: 2, STR: 1, JMP: 10, HND: 30, SEC: 6, TEC: 12, AWR: 8 }
};
ROLE_WEIGHTS = {
  // GENERATED from the contest table — edit tools/roleweights_from_contests.mjs, not this block.
  "Returner": { SPD: 39, AGI: 15, PWR: 4, STR: 2, SEC: 13, TEC: 9, AWR: 18 },
  "QB-Pocket": { SPD: 3, AGI: 3, PWR: 1, STR: 19, SEC: 9, TEC: 27, AWR: 38 },
  "QB-Dual": { SPD: 12, AGI: 12, PWR: 3, STR: 14, SEC: 6, TEC: 23, AWR: 30 },
  "QB-Gunslinger": { SPD: 3, AGI: 3, PWR: 1, STR: 29, SEC: 6, TEC: 24, AWR: 34 },
  "QB-Game-Manager": { SPD: 2, AGI: 2, PWR: 1, STR: 11, SEC: 12, TEC: 31, AWR: 41 },
  "QB-Scrambler": { SPD: 15, AGI: 15, PWR: 4, STR: 12, SEC: 8, TEC: 20, AWR: 26 },
  "TE-Receiving": { SPD: 13, AGI: 11, PWR: 3, STR: 3, JMP: 9, HND: 36, TEC: 13, AWR: 12 },
  "TE-Blocking": { SPD: 3, AGI: 4, PWR: 19, STR: 16, JMP: 4, HND: 16, TEC: 18, AWR: 20 },
  "TE-Hybrid": { SPD: 10, AGI: 8, PWR: 10, STR: 8, JMP: 7, HND: 27, TEC: 15, AWR: 15 },
  "TE-Move": { SPD: 14, AGI: 14, PWR: 9, STR: 6, JMP: 6, HND: 24, TEC: 15, AWR: 12 },
  "RB-Power": { SPD: 8, AGI: 5, PWR: 26, STR: 13, HND: 6, SEC: 12, TEC: 13, AWR: 17 },
  "RB-Scat": { SPD: 26, AGI: 22, PWR: 3, STR: 1, HND: 21, SEC: 7, TEC: 11, AWR: 9 },
  "RB-Elusive": { SPD: 21, AGI: 27, PWR: 2, STR: 1, HND: 12, SEC: 9, TEC: 12, AWR: 16 },
  "RB-Workhorse": { SPD: 15, AGI: 11, PWR: 14, STR: 7, HND: 9, SEC: 14, TEC: 11, AWR: 19 },
  "RB-Speed": { SPD: 27, AGI: 22, PWR: 4, STR: 2, HND: 11, SEC: 9, TEC: 11, AWR: 14 },
  "WR-Deep": { SPD: 44, AGI: 10, JMP: 10, HND: 21, SEC: 4, TEC: 8, AWR: 3 },
  "WR-Poss": { SPD: 13, AGI: 12, JMP: 8, HND: 39, SEC: 8, TEC: 12, AWR: 8 },
  "WR-Slot": { SPD: 20, AGI: 23, PWR: 3, STR: 1, HND: 26, SEC: 6, TEC: 15, AWR: 6 },
  "WR-Physical": { SPD: 10, AGI: 8, PWR: 4, STR: 3, JMP: 13, HND: 31, SEC: 6, TEC: 13, AWR: 12 },
  "WR-Fade": { SPD: 6, AGI: 5, PWR: 2, STR: 1, JMP: 21, HND: 38, SEC: 4, TEC: 11, AWR: 12 },
  "DE-Speed": { SPD: 23, AGI: 20, PWR: 7, STR: 18, JMP: 4, TEC: 16, AWR: 12 },
  "DE-Power": { SPD: 11, AGI: 4, PWR: 24, STR: 27, JMP: 2, TEC: 16, AWR: 16 },
  "DE-Base": { SPD: 17, AGI: 11, PWR: 16, STR: 24, JMP: 3, TEC: 16, AWR: 13 },
  "OLB-Rush": { SPD: 25, AGI: 22, PWR: 6, STR: 15, JMP: 4, TEC: 15, AWR: 13 },
  "OLB-Cover": { SPD: 33, AGI: 22, PWR: 4, STR: 6, JMP: 2, HND: 2, TEC: 12, AWR: 19 },
  "OLB-Blitz": { SPD: 26, AGI: 21, PWR: 7, STR: 15, JMP: 3, TEC: 14, AWR: 14 },
  "DT-3tech": { SPD: 10, AGI: 3, PWR: 25, STR: 27, JMP: 3, TEC: 17, AWR: 15 },
  "DT-NT": { SPD: 6, AGI: 2, PWR: 25, STR: 30, JMP: 2, TEC: 17, AWR: 18 },
  "DT-Balanced": { SPD: 10, AGI: 6, PWR: 22, STR: 29, JMP: 3, TEC: 17, AWR: 13 },
  "DT-Quick": { SPD: 17, AGI: 12, PWR: 15, STR: 22, JMP: 4, TEC: 17, AWR: 13 },
  "LB-Thumper": { SPD: 21, AGI: 12, PWR: 12, STR: 18, JMP: 1, HND: 1, TEC: 12, AWR: 23 },
  "LB-Cover": { SPD: 33, AGI: 20, PWR: 4, STR: 5, JMP: 2, HND: 2, TEC: 12, AWR: 22 },
  "LB-Hybrid": { SPD: 27, AGI: 16, PWR: 8, STR: 12, JMP: 1, HND: 1, TEC: 12, AWR: 23 },
  "LB-Blitzer": { SPD: 25, AGI: 19, PWR: 8, STR: 15, JMP: 3, TEC: 14, AWR: 16 },
  "LB-Sideline": { SPD: 33, AGI: 20, PWR: 5, STR: 6, JMP: 1, HND: 1, TEC: 11, AWR: 23 },
  "CB-Press": { SPD: 31, AGI: 20, PWR: 2, STR: 3, JMP: 8, HND: 2, TEC: 13, AWR: 21 },
  "CB-Slot": { SPD: 31, AGI: 21, PWR: 3, STR: 4, JMP: 6, HND: 2, TEC: 12, AWR: 21 },
  // The nickelback (Aug 2026, realistic-fronts wave): the 4-2-5's fifth DB is
  // its own JOB, not a third outside corner — he covers the slot in space
  // (AGI over long speed) AND holds the edge vs the run, so tackling matters
  // in a way it never does on the boundary (PWR/STR real weight, JMP nearly
  // none — nobody fades a nickelback).
  "CB-Nickel": { SPD: 24, AGI: 24, PWR: 6, STR: 7, JMP: 2, HND: 2, TEC: 14, AWR: 21 },
  "CB-Zone": { SPD: 32, AGI: 19, PWR: 2, STR: 3, JMP: 7, HND: 3, TEC: 12, AWR: 22 },
  "CB-Ball": { SPD: 30, AGI: 15, PWR: 1, STR: 2, JMP: 11, HND: 4, TEC: 12, AWR: 25 },
  "S-Free": { SPD: 30, AGI: 15, PWR: 2, STR: 3, JMP: 8, HND: 4, TEC: 12, AWR: 26 },
  "S-Strong": { SPD: 25, AGI: 16, PWR: 8, STR: 11, JMP: 2, HND: 2, TEC: 12, AWR: 24 },
  "S-Ball": { SPD: 28, AGI: 13, PWR: 1, STR: 2, JMP: 11, HND: 5, TEC: 12, AWR: 28 },
  "S-Hybrid": { SPD: 29, AGI: 17, PWR: 4, STR: 6, JMP: 6, HND: 2, TEC: 12, AWR: 24 },
  "S-Nickel": { SPD: 31, AGI: 19, PWR: 4, STR: 5, JMP: 5, HND: 2, TEC: 12, AWR: 22 },
  "OL-Mauler": { PWR: 28, STR: 24, TEC: 22, AWR: 26 },
  "OL-PassPro": { PWR: 24, STR: 28, TEC: 26, AWR: 22 },
  "OL-Balanced": { PWR: 26, STR: 26, TEC: 24, AWR: 24 },
  "OL-Athletic": { SPD: 9, AGI: 13, PWR: 20, STR: 20, TEC: 19, AWR: 19 },
  "FB-Lead": { PWR: 27, STR: 18, SEC: 10, TEC: 17, AWR: 28 },
  "FB-HBack": { SPD: 5, AGI: 6, PWR: 17, STR: 11, HND: 24, SEC: 10, TEC: 15, AWR: 12 },
  "FB-Hybrid": { SPD: 3, AGI: 4, PWR: 23, STR: 14, HND: 16, SEC: 10, TEC: 16, AWR: 14 },
  "K-Accuracy": { PWR: 16, STR: 16, TEC: 34, AWR: 34 },
  "K-Power": { PWR: 34, STR: 34, TEC: 16, AWR: 16 },
  "K-Balanced": { PWR: 25, STR: 25, TEC: 25, AWR: 25 },
  "P-Directional": { PWR: 17, STR: 17, TEC: 33, AWR: 33 },
  "P-Distance": { PWR: 33, STR: 33, TEC: 17, AWR: 17 },
  "P-Balanced": { PWR: 25, STR: 25, TEC: 25, AWR: 25 }
};
Object.assign(ROLE_WEIGHTS, {
  "OL-T": { STR: 28, TEC: 26, PWR: 18, AWR: 16, AGI: 12 },
  "OL-IOL": { PWR: 30, STR: 26, AWR: 22, TEC: 22 },
  "OL-C": { AWR: 32, STR: 24, PWR: 22, TEC: 22 }
});
FRONT_ROLES = {
  // Each front deploys REAL body types per slot (Aug 2026 audit): the 4-3
  // Over pairs a 3-tech with a 1-tech nose shade (it fielded two 3-techs —
  // its own layout labels the second slot NT); sub-package interiors are
  // DT-Quick penetrators (pass-rush specialists), not base-down anchors.
  "4-3": { DE: ["DE-Speed", "DE-Power"], DT: ["DT-3tech", "DT-NT"], OLB: ["OLB-Blitz", "OLB-Cover"], LB: ["LB-Thumper"], CB: ["CB-Press", "CB-Press"], S: ["S-Free", "S-Strong"] },
  "3-4": { DE: ["DE-Power", "DE-Power"], DT: ["DT-NT"], OLB: ["OLB-Rush", "OLB-Cover"], LB: ["LB-Thumper", "LB-Cover"], CB: ["CB-Press", "CB-Press"], S: ["S-Free", "S-Strong"] },
  "Nickel": { DE: ["DE-Speed", "DE-Power"], DT: ["DT-3tech", "DT-Quick"], OLB: ["OLB-Cover"], LB: ["LB-Cover"], CB: ["CB-Press", "CB-Press", "CB-Nickel"], S: ["S-Free", "S-Strong"] },
  "Dime": { DE: ["DE-Speed", "DE-Speed"], DT: ["DT-Quick", "DT-Quick"], OLB: [], LB: ["LB-Cover"], CB: ["CB-Press", "CB-Press", "CB-Nickel"], S: ["S-Free", "S-Strong", "S-Ball"] },
  // [BUGFIX Aug 2026] The 46 fielded TEN men — one safety, no free safety on
  // every 3rd-and-short in the sport. The real 46 walks the STRONG safety into
  // the box and keeps the free safety as the lone deep centerfielder: S is two.
  "46/Bear": { DE: ["DE-Power", "DE-Power"], DT: ["DT-NT", "DT-3tech"], OLB: ["OLB-Blitz", "OLB-Blitz"], LB: ["LB-Thumper"], CB: ["CB-Press", "CB-Press"], S: ["S-Strong", "S-Free"] },
  // The true 5-2 (Aug 2026, realistic-fronts wave): FIVE down linemen — 5-tech
  // ends, 3-tech tackles, 0-tech nose (the article's Bear front) — behind them
  // two inside backers. The goal-line/power answer; dies in space vs spread.
  "5-2": { DE: ["DE-Power", "DE-Power"], DT: ["DT-3tech", "DT-NT", "DT-3tech"], OLB: [], LB: ["LB-Thumper", "LB-Hybrid"], CB: ["CB-Press", "CB-Press"], S: ["S-Strong", "S-Free"] },
  // The odd stack (Aug 2026): two-gap ends over a nose, stack OLBs split
  // cover/heat (the ambiguity IS the scheme), and the third safety is the
  // hybrid Warrior/Aztec body the 3-3-5 was invented around.
  "3-3-5": { DE: ["DE-Power", "DE-Power"], DT: ["DT-NT"], OLB: ["OLB-Cover", "OLB-Blitz"], LB: ["LB-Thumper"], CB: ["CB-Press", "CB-Press"], S: ["S-Free", "S-Strong", "S-Hybrid"] },
  // Fronts wave 2 (Aug 2026): Tite wants two-gap 4i ends and space-backers;
  // the 4-4 wants downhill bodies everywhere and one rangy centerfielder;
  // Big Nickel's ROVER is a hybrid safety who tackles like a backer; Penny's
  // EDGEs are true stand-up rushers over a nose.
  "Tite": { DE: ["DE-Power", "DE-Power"], DT: ["DT-NT"], OLB: ["OLB-Cover", "OLB-Blitz"], LB: ["LB-Thumper", "LB-Cover"], CB: ["CB-Press", "CB-Press"], S: ["S-Free", "S-Strong"] },
  "4-4": { DE: ["DE-Speed", "DE-Power"], DT: ["DT-3tech", "DT-NT"], OLB: ["OLB-Blitz", "OLB-Cover"], LB: ["LB-Thumper", "LB-Hybrid"], CB: ["CB-Press", "CB-Press"], S: ["S-Free"] },
  "Big Nickel": { DE: ["DE-Speed", "DE-Power"], DT: ["DT-3tech", "DT-Quick"], OLB: ["OLB-Cover"], LB: ["LB-Cover"], CB: ["CB-Press", "CB-Press"], S: ["S-Free", "S-Strong", "S-Hybrid"] },
  "Penny": { DE: ["DE-Power", "DE-Power"], DT: ["DT-NT"], OLB: ["OLB-Rush", "OLB-Cover"], LB: ["LB-Thumper"], CB: ["CB-Press", "CB-Press", "CB-Nickel"], S: ["S-Free", "S-Strong"] }
};
OUT_OF_POS = {
  MEASURED_KEEP: 0.94,
  // your legs still work
  COACHED_KEEP: 0.55,
  // your technique does not travel
  ADJACENT_BONUS: 0.28
  // ...unless it's a near-neighbor (see SUB_ADJACENT)
};
SUB_ADJACENT = {
  RB: ["TE"],
  WR: ["TE"],
  TE: ["WR", "OL"],
  OL: ["TE"],
  DE: ["OLB", "DT"],
  DT: ["DE"],
  OLB: ["DE", "LB"],
  LB: ["OLB"],
  CB: ["S"],
  S: ["CB"],
  K: ["P"],
  P: ["K"],
  QB: []
};
SLOT_ELIGIBILITY = {
  DE: { DE: 1, OLB: 0.85, DT: 0.8 },
  OLB: { OLB: 1, DE: 0.85, LB: 0.9, S: 0.7 },
  DT: { DT: 1, DE: 0.85, OL: 0.65 },
  LB: { LB: 1, OLB: 0.9, S: 0.75, DE: 0.7 },
  CB: { CB: 1, S: 0.8, WR: 0.55 },
  S: { S: 1, CB: 0.85, LB: 0.7 }
};
ARCHETYPE_DISTANCE = {
  DE: {
    "DE-Speed": { "DE-Speed": 0, "DE-Power": 2, "DE-Base": 1 },
    "DE-Power": { "DE-Speed": 2, "DE-Power": 0, "DE-Base": 1 },
    "DE-Base": { "DE-Speed": 1, "DE-Power": 1, "DE-Base": 0 }
  },
  OLB: {
    "OLB-Rush": { "OLB-Rush": 0, "OLB-Cover": 2, "OLB-Blitz": 1 },
    "OLB-Cover": { "OLB-Rush": 2, "OLB-Cover": 0, "OLB-Blitz": 1 },
    "OLB-Blitz": { "OLB-Rush": 1, "OLB-Cover": 1, "OLB-Blitz": 0 }
  }
};
OFF_ROLE_BY_PLAY = {
  run_inside: { RB: "RB-Power", QB: "QB-Pocket", TE: "TE-Blocking" },
  run_outside: { RB: "RB-Scat", QB: "QB-Dual", TE: "TE-Blocking", WR: "WR-Poss" },
  pass_short: { WR: "WR-Poss", QB: "QB-Pocket", TE: "TE-Receiving", RB: "RB-Scat" },
  pass_medium: { WR: "WR-Poss", QB: "QB-Pocket", TE: "TE-Receiving" },
  pass_deep: { WR: "WR-Deep", QB: "QB-Pocket", TE: "TE-Receiving" }
};
FORMATION_ROLE_OVERRIDE = {
  "Power-I": { run_inside: { RB: "RB-Power" }, run_outside: { RB: "RB-Power" } },
  "Air Raid": { pass_medium: { WR: "WR-Deep" }, pass_deep: { WR: "WR-Deep" }, run_inside: { RB: "RB-Scat" } },
  "Spread": { run_inside: { RB: "RB-Scat" }, pass_medium: { WR: "WR-Deep" } },
  "Pistol/RPO": { run_inside: { QB: "QB-Dual" }, run_outside: { QB: "QB-Dual" } },
  "Trips/Bunch": { pass_medium: { WR: "WR-Poss" }, pass_deep: { WR: "WR-Poss" } },
  // Expansion five: option formations want a dual-threat QB on every run;
  // Empty's "runs" are all QB keepers; Wildcat feeds a power back downhill.
  "Empty": { run_inside: { QB: "QB-Dual" }, run_outside: { QB: "QB-Dual" } },
  "Wishbone": { run_inside: { QB: "QB-Dual", RB: "RB-Power" }, run_outside: { QB: "QB-Dual" } },
  "Flexbone": { run_inside: { QB: "QB-Dual" }, run_outside: { QB: "QB-Dual", RB: "RB-Scat" } },
  "Wildcat": { run_inside: { RB: "RB-Power" } }
};
OFF_WEIGHTS = {
  run_inside: { OL: 0.45, RB: 0.3, TE: 0.1, FB: 0.1, QB: 0.05 },
  run_outside: { OL: 0.3, RB: 0.35, WR: 0.1, TE: 0.1, QB: 0.15 },
  pass_short: { QB: 0.4, OL: 0.2, WR: 0.2, TE: 0.1, RB: 0.1 },
  pass_medium: { QB: 0.45, WR: 0.3, OL: 0.15, TE: 0.1 },
  pass_deep: { QB: 0.4, WR: 0.4, OL: 0.2 }
};
DEF_WEIGHTS = {
  run_inside: { DL: 0.5, LB: 0.35, DB: 0.15 },
  run_outside: { DL: 0.3, LB: 0.4, DB: 0.3 },
  pass_short: { LB: 0.35, DB: 0.45, DL: 0.2 },
  pass_medium: { DB: 0.5, LB: 0.25, DL: 0.25 },
  pass_deep: { DB: 0.6, DL: 0.25, LB: 0.15 }
};
FORMATION_PACKAGES = {
  "Power-I": { RB: 1, FB: 1, TE: 2, WR: 1 },
  "Spread": { RB: 1, FB: 0, TE: 1, WR: 3 },
  "Air Raid": { RB: 1, FB: 0, TE: 0, WR: 4 },
  "Pistol/RPO": { RB: 1, FB: 0, TE: 1, WR: 3 },
  "Trips/Bunch": { RB: 1, FB: 0, TE: 1, WR: 3 },
  // ── Expansion five (Jul 2026) ──────────────────────────────────────────
  "Single Back": { RB: 1, FB: 0, TE: 2, WR: 2 },
  // Ace: 12 personnel, one back
  "Empty": { RB: 0, FB: 0, TE: 1, WR: 4 },
  // no backfield — QB is the only runner
  "Wishbone": { RB: 2, FB: 1, TE: 1, WR: 1 },
  // FB + 2 halfbacks, triple-option DNA
  "Flexbone": { RB: 2, FB: 1, TE: 0, WR: 2 },
  // B-back + 2 A-back slots, option + motion
  "Wildcat": { RB: 2, FB: 1, TE: 2, WR: 0 },
  // direct snap to the back; QB split wide
  "Jumbo": { RB: 1, FB: 1, TE: 3, WR: 0 }
  // 13 heavy: three tight ends, two backs, nobody split
};
FORMATION_WEIGHTS = {
  "Power-I": {
    run_inside: { OL: 0.38, RB: 0.34, FB: 0.16, TE: 0.08, QB: 0.04 },
    run_outside: { OL: 0.34, RB: 0.28, FB: 0.12, TE: 0.1, WR: 0.08, QB: 0.08 },
    pass_short: { QB: 0.38, OL: 0.2, TE: 0.16, WR: 0.14, RB: 0.08, FB: 0.04 },
    pass_medium: { QB: 0.42, WR: 0.28, OL: 0.15, TE: 0.12, RB: 0.03 },
    pass_deep: { QB: 0.38, WR: 0.38, OL: 0.2, TE: 0.04 }
  },
  "Spread": {
    run_inside: { OL: 0.48, RB: 0.34, TE: 0.08, QB: 0.1 },
    run_outside: { OL: 0.28, RB: 0.32, WR: 0.18, TE: 0.08, QB: 0.14 },
    pass_short: { QB: 0.38, WR: 0.26, OL: 0.18, TE: 0.1, RB: 0.08 },
    pass_medium: { QB: 0.44, WR: 0.34, OL: 0.14, TE: 0.08 },
    pass_deep: { QB: 0.4, WR: 0.42, OL: 0.18 }
  },
  "Air Raid": {
    run_inside: { OL: 0.5, RB: 0.38, QB: 0.12 },
    run_outside: { OL: 0.34, RB: 0.36, WR: 0.18, QB: 0.12 },
    pass_short: { QB: 0.36, WR: 0.34, OL: 0.18, RB: 0.12 },
    pass_medium: { QB: 0.44, WR: 0.4, OL: 0.16 },
    pass_deep: { QB: 0.42, WR: 0.46, OL: 0.12 }
  },
  "Pistol/RPO": {
    run_inside: { OL: 0.46, RB: 0.32, TE: 0.1, QB: 0.12 },
    run_outside: { OL: 0.28, RB: 0.32, WR: 0.16, TE: 0.1, QB: 0.14 },
    pass_short: { QB: 0.4, WR: 0.24, OL: 0.18, TE: 0.1, RB: 0.08 },
    pass_medium: { QB: 0.44, WR: 0.32, OL: 0.14, TE: 0.1 },
    pass_deep: { QB: 0.4, WR: 0.42, OL: 0.18 }
  },
  "Trips/Bunch": {
    run_inside: { OL: 0.48, RB: 0.32, TE: 0.1, QB: 0.1 },
    run_outside: { OL: 0.26, RB: 0.3, WR: 0.22, TE: 0.08, QB: 0.14 },
    pass_short: { QB: 0.38, WR: 0.3, OL: 0.16, TE: 0.1, RB: 0.06 },
    pass_medium: { QB: 0.42, WR: 0.38, OL: 0.14, TE: 0.06 },
    pass_deep: { QB: 0.38, WR: 0.46, OL: 0.16 }
  },
  // ── Expansion five (Jul 2026) ──────────────────────────────────────────
  "Single Back": {
    run_inside: { OL: 0.46, RB: 0.32, TE: 0.14, QB: 0.08 },
    run_outside: { OL: 0.3, RB: 0.32, TE: 0.14, WR: 0.14, QB: 0.1 },
    pass_short: { QB: 0.38, OL: 0.2, WR: 0.2, TE: 0.14, RB: 0.08 },
    pass_medium: { QB: 0.44, WR: 0.28, OL: 0.15, TE: 0.13 },
    pass_deep: { QB: 0.4, WR: 0.38, OL: 0.18, TE: 0.04 }
  },
  "Empty": {
    // No backfield: every "run" is a QB draw/keeper, so QB carries the run
    // weight an RB normally would. Quick-game protection leans on the QB
    // getting it out, not a 7-man wall — OL weight runs light on passes.
    run_inside: { OL: 0.5, QB: 0.4, TE: 0.1 },
    run_outside: { OL: 0.3, QB: 0.45, WR: 0.17, TE: 0.08 },
    pass_short: { QB: 0.38, WR: 0.32, OL: 0.16, TE: 0.14 },
    pass_medium: { QB: 0.44, WR: 0.38, OL: 0.12, TE: 0.06 },
    pass_deep: { QB: 0.42, WR: 0.44, OL: 0.14 }
  },
  "Wishbone": {
    // FB dive is the base note; the QB weight on outside runs is the keep/
    // pitch phase of the option. Deep passes are rare but the PA shot off the
    // dive is the whole point of throwing from this thing.
    run_inside: { OL: 0.36, RB: 0.26, FB: 0.2, QB: 0.1, TE: 0.08 },
    run_outside: { OL: 0.28, RB: 0.34, FB: 0.1, QB: 0.18, TE: 0.06, WR: 0.04 },
    pass_short: { QB: 0.4, OL: 0.18, TE: 0.18, RB: 0.14, WR: 0.1 },
    pass_medium: { QB: 0.46, WR: 0.26, TE: 0.14, OL: 0.14 },
    pass_deep: { QB: 0.42, WR: 0.4, OL: 0.14, TE: 0.04 }
  },
  "Flexbone": {
    // Dive to the B-back inside; pitch to an A-back with the QB stressing the
    // edge outside. Perimeter speed matters more than in the 'bone.
    run_inside: { OL: 0.38, FB: 0.28, RB: 0.16, QB: 0.12, WR: 0.06 },
    run_outside: { OL: 0.24, RB: 0.36, QB: 0.22, WR: 0.12, FB: 0.06 },
    pass_short: { QB: 0.4, WR: 0.24, OL: 0.2, RB: 0.16 },
    pass_medium: { QB: 0.46, WR: 0.32, OL: 0.14, RB: 0.08 },
    pass_deep: { QB: 0.42, WR: 0.44, OL: 0.14 }
  },
  "Wildcat": {
    // Direct snap: the back IS the play, the QB is split wide as a decoy.
    // No QB weight on runs (he's 20 yards from the ball); pass weights keep
    // him because the rare wildcat throw comes back through his hands.
    run_inside: { OL: 0.4, RB: 0.34, FB: 0.14, TE: 0.12 },
    run_outside: { OL: 0.3, RB: 0.42, FB: 0.1, TE: 0.18 },
    pass_short: { QB: 0.36, TE: 0.28, RB: 0.18, OL: 0.18 },
    pass_medium: { QB: 0.42, TE: 0.3, OL: 0.16, RB: 0.12 },
    pass_deep: { QB: 0.44, TE: 0.32, OL: 0.24 }
  },
  // ── Jumbo (Aug 2026) ─────────────────────────────────────────────────────
  // Everything runs through the line and the tight ends; the rare pass is a
  // TE leak or a back out of the flat — there is no receiver to weight.
  "Jumbo": {
    run_inside: { OL: 0.38, RB: 0.3, FB: 0.14, TE: 0.14, QB: 0.04 },
    run_outside: { OL: 0.34, RB: 0.28, FB: 0.12, TE: 0.14, QB: 0.12 },
    pass_short: { QB: 0.38, TE: 0.24, OL: 0.2, RB: 0.1, FB: 0.08 },
    pass_medium: { QB: 0.44, TE: 0.26, OL: 0.18, RB: 0.12 },
    pass_deep: { QB: 0.42, TE: 0.34, OL: 0.24 }
  }
};
DEF_FRONTS = {
  "4-3": { DL: 4, LB: 3, DB: 4 },
  "3-4": { DL: 3, LB: 4, DB: 4 },
  "Nickel": { DL: 4, LB: 2, DB: 5 },
  "Dime": { DL: 4, LB: 1, DB: 6 },
  "46/Bear": { DL: 4, LB: 3, DB: 4 },
  // 8 in the box: 4 DL + 3 LB + SS down; FS lone deep
  "5-2": { DL: 5, LB: 2, DB: 4 },
  // five on the line of scrimmage, two ILBs
  "3-3-5": { DL: 3, LB: 3, DB: 5 },
  // the odd stack: three down, three stacked backers, five DBs
  "Tite": { DL: 3, LB: 4, DB: 4 },
  "4-4": { DL: 4, LB: 4, DB: 3 },
  "Big Nickel": { DL: 4, LB: 2, DB: 5 },
  "Penny": { DL: 5, LB: 1, DB: 5 }
};
DEF_FRONT_WEIGHTS = {
  "4-3": {
    run_inside: { DL: 0.5, LB: 0.35, DB: 0.15 },
    run_outside: { DL: 0.3, LB: 0.4, DB: 0.3 },
    pass_short: { LB: 0.35, DB: 0.45, DL: 0.2 },
    pass_medium: { DB: 0.5, LB: 0.25, DL: 0.25 },
    pass_deep: { DB: 0.6, DL: 0.25, LB: 0.15 }
  },
  "3-4": {
    run_inside: { DL: 0.45, LB: 0.4, DB: 0.15 },
    run_outside: { DL: 0.28, LB: 0.42, DB: 0.3 },
    pass_short: { LB: 0.38, DB: 0.42, DL: 0.2 },
    pass_medium: { DB: 0.48, LB: 0.28, DL: 0.24 },
    pass_deep: { DB: 0.58, DL: 0.22, LB: 0.2 }
  },
  "Nickel": {
    run_inside: { DL: 0.5, LB: 0.28, DB: 0.22 },
    run_outside: { DL: 0.3, LB: 0.32, DB: 0.38 },
    pass_short: { LB: 0.28, DB: 0.52, DL: 0.2 },
    pass_medium: { DB: 0.55, LB: 0.2, DL: 0.25 },
    pass_deep: { DB: 0.65, DL: 0.22, LB: 0.13 }
  },
  "Dime": {
    run_inside: { DL: 0.52, LB: 0.2, DB: 0.28 },
    run_outside: { DL: 0.32, LB: 0.22, DB: 0.46 },
    pass_short: { LB: 0.18, DB: 0.62, DL: 0.2 },
    pass_medium: { DB: 0.62, LB: 0.14, DL: 0.24 },
    pass_deep: { DB: 0.72, DL: 0.2, LB: 0.08 }
  },
  "46/Bear": {
    run_inside: { DL: 0.48, LB: 0.42, DB: 0.1 },
    run_outside: { DL: 0.35, LB: 0.45, DB: 0.2 },
    pass_short: { LB: 0.4, DB: 0.38, DL: 0.22 },
    pass_medium: { DB: 0.44, LB: 0.32, DL: 0.24 },
    pass_deep: { DB: 0.52, DL: 0.28, LB: 0.2 }
  },
  // 5-2: the five-man line carries the run fit almost alone (every interior
  // gap has a body), the two ILBs clean up; on passing downs the same wall is
  // the whole rush and the four DBs are on an island.
  "5-2": {
    run_inside: { DL: 0.58, LB: 0.3, DB: 0.12 },
    run_outside: { DL: 0.4, LB: 0.35, DB: 0.25 },
    pass_short: { LB: 0.3, DB: 0.44, DL: 0.26 },
    pass_medium: { DB: 0.46, LB: 0.24, DL: 0.3 },
    pass_deep: { DB: 0.54, DL: 0.3, LB: 0.16 }
  },
  // 3-3-5: only three down bodies, so the run fit lives on flowing backers
  // and safeties triggering downhill; in coverage it plays like a nickel with
  // an extra hat in the middle of the field.
  "3-3-5": {
    run_inside: { DL: 0.42, LB: 0.38, DB: 0.2 },
    run_outside: { DL: 0.26, LB: 0.4, DB: 0.34 },
    pass_short: { LB: 0.34, DB: 0.48, DL: 0.18 },
    pass_medium: { DB: 0.54, LB: 0.24, DL: 0.22 },
    pass_deep: { DB: 0.64, DL: 0.22, LB: 0.14 }
  },
  // Tite: B-gaps die at the line (DL carries inside runs); everything wide
  // is spilled to overhangs and safeties.
  "Tite": {
    run_inside: { DL: 0.5, LB: 0.34, DB: 0.16 },
    run_outside: { DL: 0.24, LB: 0.42, DB: 0.34 },
    pass_short: { LB: 0.36, DB: 0.44, DL: 0.2 },
    pass_medium: { DB: 0.5, LB: 0.26, DL: 0.24 },
    pass_deep: { DB: 0.6, DL: 0.22, LB: 0.18 }
  },
  // 4-4: eight hats in the box own the run; one deep safety owns (and can
  // lose) everything over the top.
  "4-4": {
    run_inside: { DL: 0.52, LB: 0.38, DB: 0.1 },
    run_outside: { DL: 0.32, LB: 0.46, DB: 0.22 },
    pass_short: { LB: 0.42, DB: 0.36, DL: 0.22 },
    pass_medium: { DB: 0.42, LB: 0.32, DL: 0.26 },
    pass_deep: { DB: 0.5, DL: 0.28, LB: 0.22 }
  },
  // Big Nickel: nickel structure with a ROVER instead of a slot corner —
  // sturdier run fits than the 4-2-5, a shade less slot speed.
  "Big Nickel": {
    run_inside: { DL: 0.5, LB: 0.3, DB: 0.2 },
    run_outside: { DL: 0.3, LB: 0.34, DB: 0.36 },
    pass_short: { LB: 0.3, DB: 0.5, DL: 0.2 },
    pass_medium: { DB: 0.54, LB: 0.21, DL: 0.25 },
    pass_deep: { DB: 0.64, LB: 0.13, DL: 0.23 }
  },
  // Penny: the five-man light wall handles the run so the lone MIKE can
  // stay clean; on pass downs it's a nickel shell behind a 5-man look.
  "Penny": {
    run_inside: { DL: 0.54, LB: 0.26, DB: 0.2 },
    run_outside: { DL: 0.36, LB: 0.28, DB: 0.36 },
    pass_short: { LB: 0.22, DB: 0.54, DL: 0.24 },
    pass_medium: { DB: 0.55, LB: 0.16, DL: 0.29 },
    pass_deep: { DB: 0.64, LB: 0.1, DL: 0.26 }
  }
};
MATCHUP_MATRIX = {
  "Power-I": { "4-3": 0.99, "3-4": 1, "Nickel": 1.1, "Dime": 1.15, "46/Bear": 0.88, "5-2": 0.85 , "3-3-5": 1.08, "Tite": 1.04, "4-4": 0.9, "Big Nickel": 1.06, "Penny": 1.09},
  "Spread": { "4-3": 1.05, "3-4": 1.04, "Nickel": 0.98, "Dime": 0.95, "46/Bear": 1.08, "5-2": 1.12 , "3-3-5": 0.97, "Tite": 0.95, "4-4": 1.06, "Big Nickel": 0.99, "Penny": 0.96},
  "Air Raid": { "4-3": 1.08, "3-4": 1.06, "Nickel": 0.96, "Dime": 0.93, "46/Bear": 1.12, "5-2": 1.16 , "3-3-5": 0.96, "Tite": 0.97, "4-4": 1.1, "Big Nickel": 0.98, "Penny": 0.97},
  "Pistol/RPO": { "4-3": 1, "3-4": 1, "Nickel": 1.01, "Dime": 1.02, "46/Bear": 1.01, "5-2": 1.04 , "3-3-5": 0.97, "Tite": 0.94, "4-4": 1.0, "Big Nickel": 0.99, "Penny": 0.94},
  "Trips/Bunch": { "4-3": 1.04, "3-4": 1.03, "Nickel": 0.98, "Dime": 0.96, "46/Bear": 1.06, "5-2": 1.1 , "3-3-5": 0.97, "Tite": 0.98, "4-4": 1.05, "Big Nickel": 0.99, "Penny": 0.98},
  // Expansion five: heavy sets punish sub packages and get smothered by Bear;
  // Empty is the mirror image, more extreme than Air Raid on both ends. The
  // 5-2 is the extreme end of the same axis — the best run wall in the game,
  // the worst thing you can be caught in against an empty set.
  "Single Back": { "4-3": 1.01, "3-4": 1.01, "Nickel": 1, "Dime": 1, "46/Bear": 0.97, "5-2": 0.96 , "3-3-5": 1.0, "Tite": 0.99, "4-4": 0.98, "Big Nickel": 0.98, "Penny": 0.99},
  "Empty": { "4-3": 1.1, "3-4": 1.08, "Nickel": 0.97, "Dime": 0.92, "46/Bear": 1.14, "5-2": 1.18 , "3-3-5": 0.95, "Tite": 0.98, "4-4": 1.12, "Big Nickel": 0.97, "Penny": 0.96},
  "Wishbone": { "4-3": 0.98, "3-4": 1, "Nickel": 1.12, "Dime": 1.16, "46/Bear": 0.86, "5-2": 0.83 , "3-3-5": 1.04, "Tite": 1.02, "4-4": 0.88, "Big Nickel": 1.08, "Penny": 1.06},
  "Flexbone": { "4-3": 1, "3-4": 1.02, "Nickel": 1.09, "Dime": 1.13, "46/Bear": 0.9, "5-2": 0.87 , "3-3-5": 1.0, "Tite": 0.98, "4-4": 0.9, "Big Nickel": 1.06, "Penny": 1.02},
  "Wildcat": { "4-3": 0.98, "3-4": 0.99, "Nickel": 1.09, "Dime": 1.13, "46/Bear": 0.85, "5-2": 0.83 , "3-3-5": 1.05, "Tite": 1.02, "4-4": 0.87, "Big Nickel": 1.06, "Penny": 1.08},
  // Jumbo is the heaviest set in the game: it feasts on sub packages that
  // stay on the field and gets stonewalled by the run-wall fronts.
  "Jumbo": { "4-3": 0.97, "3-4": 0.99, "Nickel": 1.13, "Dime": 1.18, "46/Bear": 0.84, "5-2": 0.82 , "3-3-5": 1.1, "Tite": 1.08, "4-4": 0.86, "Big Nickel": 1.1, "Penny": 1.14}
};
FORMATION_SITUATIONAL = {
  "Power-I": { shortYardage: 1.14, thirdLong: 0.86, twoMinute: 0.88, redZone: 1.08, standard: 1 },
  "Spread": { shortYardage: 0.95, thirdLong: 1.05, twoMinute: 1.06, redZone: 0.97, standard: 1 },
  "Air Raid": { shortYardage: 0.88, thirdLong: 1.1, twoMinute: 1.08, redZone: 0.94, standard: 1 },
  "Pistol/RPO": { shortYardage: 1, thirdLong: 1, twoMinute: 1.01, redZone: 1, standard: 1 },
  "Trips/Bunch": { shortYardage: 0.96, thirdLong: 1.04, twoMinute: 1.03, redZone: 1.02, standard: 1 },
  // Expansion five
  "Single Back": { shortYardage: 1.04, thirdLong: 0.99, twoMinute: 0.99, redZone: 1.03, standard: 1 },
  "Empty": { shortYardage: 0.85, thirdLong: 1.09, twoMinute: 1.1, redZone: 0.93, standard: 1 },
  "Wishbone": { shortYardage: 1.15, thirdLong: 0.82, twoMinute: 0.84, redZone: 1.09, standard: 1 },
  "Flexbone": { shortYardage: 1.1, thirdLong: 0.86, twoMinute: 0.87, redZone: 1.05, standard: 1 },
  "Wildcat": { shortYardage: 1.16, thirdLong: 0.78, twoMinute: 0.82, redZone: 1.1, standard: 1 },
  // Jumbo is a situational hammer, not a base offense: the best short-yardage
  // and goal-line set on the sheet, a liability chasing points or distance.
  "Jumbo": { shortYardage: 1.2, thirdLong: 0.72, twoMinute: 0.78, redZone: 1.14, standard: 0.97 }
};
PRACTICE_SECONDARY = 0.5;
PRACTICE_TOOLS = {
  SPD: { SPD: 1, CON: PRACTICE_SECONDARY },
  AGI: { AGI: 1, CON: PRACTICE_SECONDARY },
  PWR: { PWR: 1, CON: PRACTICE_SECONDARY },
  STR: { STR: 1, CON: PRACTICE_SECONDARY },
  JMP: { JMP: 1, CON: PRACTICE_SECONDARY },
  HND: { HND: 1, SEC: PRACTICE_SECONDARY },
  SEC: { SEC: 1, HND: PRACTICE_SECONDARY },
  TEC: { TEC: 1, WE: PRACTICE_SECONDARY },
  AWR: { AWR: 1, WE: PRACTICE_SECONDARY }
};
DEFAULT_PRACTICE = {
  SPD: 10,
  AGI: 11,
  PWR: 11,
  STR: 13,
  JMP: 5,
  HND: 9,
  SEC: 6,
  TEC: 17,
  AWR: 18
};
PASS_TENDENCY = {
  "Always Pass": 0.82,
  "Heavy Pass": 0.68,
  "Pass": 0.58,
  "Balanced": 0.44,
  "Run": 0.41,
  "Heavy Run": 0.32,
  "Always Run": 0.18
  // Balanced 0.44 (run ~56%): college skews run; lifts rush att into the real band while pass holds
};
POSITIONS = ["QB", "RB", "WR", "TE", "OL", "DE", "DT", "OLB", "LB", "CB", "S", "K", "P"];
ATTRIBUTES = ["SPD", "AGI", "PWR", "STR", "JMP", "HND", "SEC", "TEC", "AWR", "CON", "WE"];
MEASURED_ATTRS = ["SPD", "AGI", "PWR", "STR", "JMP"];
ATTR_LABELS = {};
attrLabel = (a) => ATTR_LABELS[a] || a;
PENALTY_CATALOG = [
  // Offense
  { name: "False Start", side: "offense", yards: 5, posGroup: ["OL", "TE"], attr: "AWR", preSnap: true, weight: 26 },
  { name: "Offensive Holding", side: "offense", yards: 10, posGroup: ["OL"], attr: "TEC", preSnap: false, weight: 24 },
  { name: "Illegal Formation", side: "offense", yards: 5, posGroup: ["OL", "WR"], attr: "AWR", preSnap: true, weight: 6 },
  { name: "Offensive Pass Interference", side: "offense", yards: 15, posGroup: ["WR", "TE"], attr: "TEC", preSnap: false, weight: 6 },
  { name: "Illegal Block in the Back", side: "offense", yards: 10, posGroup: ["WR", "RB"], attr: "TEC", preSnap: false, weight: 6 },
  { name: "Chop Block", side: "offense", yards: 15, posGroup: ["OL"], attr: "AWR", preSnap: false, weight: 2 },
  // Defense
  { name: "Offside", side: "defense", yards: 5, posGroup: ["DE", "OLB", "DT"], attr: "AWR", preSnap: true, autoFirst: false, weight: 20 },
  { name: "Defensive Holding", side: "defense", yards: 5, posGroup: ["CB", "S", "LB"], attr: "TEC", preSnap: false, autoFirst: true, weight: 16 },
  { name: "Pass Interference", side: "defense", yards: 15, posGroup: ["CB", "S"], attr: "TEC", preSnap: false, autoFirst: true, weight: 16 },
  { name: "Facemask", side: "defense", yards: 15, posGroup: ["DE", "OLB", "DT", "LB"], attr: "AWR", preSnap: false, autoFirst: true, weight: 5 },
  { name: "Roughing the Passer", side: "defense", yards: 15, posGroup: ["DE", "OLB", "DT"], attr: "AWR", preSnap: false, autoFirst: true, weight: 5 },
  { name: "Encroachment", side: "defense", yards: 5, posGroup: ["DT", "DE"], attr: "AWR", preSnap: true, autoFirst: false, weight: 6 }
];
CLASS_YEARS = ["FR", "SO", "JR", "SR"];
ROSTER_TARGETS = {
  QB: 4,
  RB: 7,
  WR: 10,
  TE: 4,
  OL: 15,
  DE: 5,
  DT: 5,
  OLB: 5,
  LB: 5,
  CB: 7,
  S: 5,
  K: 2,
  P: 1
};
STARTER_COUNTS = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  OL: 5,
  DE: 2,
  DT: 2,
  OLB: 2,
  LB: 1,
  CB: 2,
  S: 2,
  K: 1,
  P: 1
};
ROSTER_POS_MIN = { QB: 2, RB: 4, WR: 6, TE: 2, OL: 9, DE: 3, DT: 3, OLB: 3, LB: 3, CB: 4, S: 3, K: 1, P: 1 };
ROSTER_POS_MAX = { QB: 5, RB: 9, WR: 13, TE: 6, OL: 19, DE: 7, DT: 7, OLB: 7, LB: 7, CB: 9, S: 7, K: 3, P: 2 };
// What each front actually fields, per defensive position (Aug 2026,
// scheme-aware-roles pass). Single source of truth — resolveDefPersonnel in
// formations.js consumes this same table, so "who plays" and "who counts as a
// starter" can never disagree. [BUGFIX Aug 2026] 46/Bear S was 1 here (ten men
// on the field) — the FRONT_ROLES fix that put the free safety back as the
// lone deep centerfielder never reached the counts table. S is two.
DEF_FRONT_COUNTS = {
  "4-3": { DE: 2, DT: 2, OLB: 2, LB: 1, CB: 2, S: 2 },
  // SAM/WILL are OLBs, MIKE is the LB
  "3-4": { DE: 2, DT: 1, OLB: 2, LB: 2, CB: 2, S: 2 },
  // 5-tech DEs, NT, edge OLBs, 2 ILB
  "Nickel": { DE: 2, DT: 2, OLB: 1, LB: 1, CB: 3, S: 2 },
  "Dime": { DE: 2, DT: 2, OLB: 0, LB: 1, CB: 3, S: 3 },
  "46/Bear": { DE: 2, DT: 2, OLB: 2, LB: 1, CB: 2, S: 2 },
  // Five-man wall + two inside backers (matches FRONT_ROLES["5-2"] / DEF_FRONT_WEIGHTS 5-2)
  "5-2": { DE: 2, DT: 3, OLB: 0, LB: 2, CB: 2, S: 2 },
  // The odd stack (Aug 2026): NT + two 4i ends, two stack OLBs + a Mike
  // mirrored behind them, five DBs with a third hybrid safety. The 3-3-5 is
  // the odd-front nickel that KEEPS the outside backers on the field.
  "3-3-5": { DE: 2, DT: 1, OLB: 2, LB: 1, CB: 2, S: 3 },
  // Fronts wave 2 (Aug 2026, brain-expansion pass 1):
  // Tite (4i-0-4i): the modern anti-spread odd front — B-gaps closed by
  // alignment, JACK/JOKER overhangs play space, backers run free.
  "Tite": { DE: 2, DT: 1, OLB: 2, LB: 2, CB: 2, S: 2 },
  // 4-4 stack: the eight-man front — SPUR/BANDIT outside, twin ILBs, one
  // lone deep safety. Run-stuffing identity, exposed over the top.
  "4-4": { DE: 2, DT: 2, OLB: 2, LB: 2, CB: 2, S: 1 },
  // Big Nickel: 4-2-5 with a third SAFETY (the ROVER) instead of a slot
  // corner — the 12-personnel/TE answer that still defends the pass.
  "Big Nickel": { DE: 2, DT: 2, OLB: 1, LB: 1, CB: 2, S: 3 },
  // Penny: the 5-1 light box — five on the LOS (stand-up EDGEs flank the
  // three down bodies), one MIKE, nickel back end. The spread-run answer.
  "Penny": { DE: 2, DT: 1, OLB: 2, LB: 1, CB: 3, S: 2 }
};
// Scheme-aware roles (Aug 2026). Two ways a program lives in a sub package:
// hard-pick a front on the gameplan (the dial bypasses selectDefFront — EVERY
// snap is that front), or set a sub front as the BASE and let Auto blend in
// the situational answers (5-2/46 short yardage, Dime on 3rd-and-long) — the
// real-life "nickel-base" team. Either way, "starter" at each defensive
// position is what the identity front fields, not the base-4-3 table: a
// Nickel program starts one OLB and three corners, and its second OLB is a
// short-yardage part-timer. Classic 4-3/3-4 bases keep the static table, and
// AI staffs only ever base 4-3/3-4 with defFront on "auto" — so every helper
// below is a no-op for them: zero drift in the league-wide portal/recruiting
// economy.
function schoolSchemeFront(school) {
  const gp = school == null ? void 0 : school.gameplan;
  const f = gp == null ? void 0 : gp.defFront;
  if (f && f !== "auto" && DEF_FRONT_COUNTS[f]) return f;
  const b = gp == null ? void 0 : gp.defBaseFront;
  if (b && b !== "4-3" && b !== "3-4" && DEF_FRONT_COUNTS[b]) return b;
  return null;
}
function schemeStarterCounts(school) {
  const f = schoolSchemeFront(school);
  if (!f) return STARTER_COUNTS;
  return Object.assign({}, STARTER_COUNTS, DEF_FRONT_COUNTS[f]);
}
// Returns the front's starter count for a defensive position when it DIFFERS
// from the static table, else null — lets callers that keep their own starter
// tables (portal.js) override only the scheme-driven positions.
function schemeStarterOverride(school, pos) {
  const f = schoolSchemeFront(school);
  if (!f) return null;
  const n = DEF_FRONT_COUNTS[f][pos];
  return n != null && n !== STARTER_COUNTS[pos] ? n : null;
}
// Roster targets under the scheme: each starting spot gained/lost swings the
// target by two bodies (a starter plus his backup), clamped to the position
// floor/ceiling so special teams and injury cover never vanish — a Dime
// program still carries three OLBs, it just stops signing five.
function schemeRosterTargets(school) {
  const f = schoolSchemeFront(school);
  if (!f) return ROSTER_TARGETS;
  const fc = DEF_FRONT_COUNTS[f];
  const out = Object.assign({}, ROSTER_TARGETS);
  for (const pos of ["DE", "DT", "OLB", "LB", "CB", "S"]) {
    const delta = (fc[pos] || 0) - (STARTER_COUNTS[pos] || 0);
    if (!delta) continue;
    const lo = ROSTER_POS_MIN[pos] != null ? ROSTER_POS_MIN[pos] : 1;
    const hi = ROSTER_POS_MAX[pos] != null ? ROSTER_POS_MAX[pos] : 99;
    out[pos] = Math.min(hi, Math.max(lo, ROSTER_TARGETS[pos] + delta * 2));
  }
  return out;
}
FORMATIONS = {
  "Power-I": { passLean: -0.15, runIn: 0.75, runOut: 0.25, identity: "run_inside", label: "Power-I", desc: "Power run \u2014 FB, 2 TE, 1 WR" },
  "Spread": { passLean: 0.15, runIn: 0.4, runOut: 0.6, identity: "pass_medium", label: "Spread", desc: "Pass-lean \u2014 1 TE, 3 WR, tempo" },
  "Air Raid": { passLean: 0.3, runIn: 0.3, runOut: 0.7, identity: "pass_deep", label: "Air Raid", desc: "Heavy pass \u2014 4 WR, no TE" },
  "Pistol/RPO": { passLean: 0.05, runIn: 0.5, runOut: 0.5, identity: "balanced", label: "Pistol/RPO", desc: "Balanced \u2014 QB read option" },
  "Trips/Bunch": { passLean: 0.1, runIn: 0.45, runOut: 0.55, identity: "pass_short", label: "Trips/Bunch", desc: "Timing routes \u2014 3 WR trips" },
  // ── Expansion five (Jul 2026) ──────────────────────────────────────────
  "Single Back": { passLean: 0.05, runIn: 0.5, runOut: 0.5, identity: "balanced", label: "Single Back", desc: "Ace \u2014 1 RB, 2 TE, 2 WR" },
  "Empty": { passLean: 0.35, runIn: 0.4, runOut: 0.6, identity: "pass_short", label: "Empty", desc: "No backs \u2014 4 WR + TE, QB draws only" },
  "Wishbone": { passLean: -0.3, runIn: 0.65, runOut: 0.35, identity: "run_inside", label: "Wishbone", desc: "Triple option \u2014 FB + 2 HB" },
  "Flexbone": { passLean: -0.25, runIn: 0.45, runOut: 0.55, identity: "run_inside", label: "Flexbone", desc: "Option + motion \u2014 FB, 2 slotbacks" },
  "Wildcat": { passLean: -0.35, runIn: 0.6, runOut: 0.4, identity: "run_inside", label: "Wildcat", desc: "Direct snap \u2014 QB split wide" },
  // ── Jumbo (Aug 2026) ───────────────────────────────────────────────────
  "Jumbo": { passLean: -0.4, runIn: 0.8, runOut: 0.2, identity: "run_inside", label: "Jumbo", desc: "Goal line \u2014 3 TE, FB + HB, no WR" }
};
// ── Formation Variations (Creativity Tools P1b, Aug 2026) ─────────────────
// A variation = the base formation plus a SPARSE delta, never a copy. Allowed
// deltas: `pkg` (absolute override of the listed personnel counts — must keep
// five skill players on the field), `lean` (additive nudge to
// passLean/runIn/runOut, renormalized), `matchup` (additive per-front nudge to
// the MATCHUP_MATRIX row, clamped), `situational` (additive nudge to the
// FORMATION_SITUATIONAL profile, clamped), `layout` (viewer alignment id —
// consumed by constants_field.js, wired on the browser gate). A formation with
// NO variation selected stays byte-identical (inert-by-default, the run-scheme
// pattern). Selection rides the gameplan formation entry's `.variation` field,
// so a saved gameplan or the P1 builder can carry one; AI never sets it.
FORMATION_VARIATIONS = {
  "Power-I": {
    "big": { label: "Big", pkg: { TE: 3, WR: 0 }, lean: { runIn: 0.05 }, matchup: { "46/Bear": -0.03, "5-2": -0.03, "Nickel": 0.03, "Dime": 0.04 }, situational: { shortYardage: 0.04, thirdLong: -0.03 }, layout: "power_big" },
    "twins": { label: "Twins", pkg: { TE: 1, WR: 2 }, lean: { passLean: 0.06, runIn: -0.05 }, matchup: { "Nickel": -0.03, "Dime": -0.02, "46/Bear": 0.03 }, situational: { thirdLong: 0.03, twoMinute: 0.03, shortYardage: -0.03 }, layout: "power_twins" }
  },
  "Spread": {
    "trips": { label: "Trips", lean: { passLean: 0.03 }, matchup: { "Nickel": -0.02, "3-3-5": -0.02 }, situational: { thirdLong: 0.02 }, layout: "spread_trips" },
    "ace": { label: "Ace", pkg: { TE: 2, WR: 2 }, lean: { passLean: -0.05, runIn: 0.05 }, matchup: { "46/Bear": -0.02, "5-2": -0.02, "Nickel": 0.02 }, situational: { shortYardage: 0.03, redZone: 0.03 }, layout: "spread_ace" }
  },
  "Air Raid": {
    // M2 (owner decision b, 2026-08-17): Empty gets a REAL empty pkg — the
    // back genuinely leaves the field for a fifth receiver. Before this the
    // look had no pkg, so the engine fielded 1 RB in "Empty" (CREATOR_FIDELITY
    // engine item 2, "the Empty that isn't").
    "empty": { label: "Empty", pkg: { RB: 0, WR: 5 }, lean: { passLean: 0.05 }, matchup: { "Nickel": -0.02, "Dime": -0.03, "46/Bear": 0.03 }, situational: { thirdLong: 0.03, twoMinute: 0.03, shortYardage: -0.04 }, layout: "air_empty" },
    "tight": { label: "Tight", lean: { passLean: -0.03 }, matchup: { "5-2": -0.03, "46/Bear": -0.03 }, situational: { shortYardage: 0.02 }, layout: "air_tight" }
  },
  "Pistol/RPO": {
    "diamond": { label: "Diamond", pkg: { FB: 1, TE: 1, WR: 2, RB: 1 }, lean: { runIn: 0.06, passLean: -0.06 }, matchup: { "46/Bear": -0.03, "5-2": -0.02, "Nickel": 0.03 }, situational: { shortYardage: 0.04, redZone: 0.03 }, layout: "pistol_diamond" },
    "trips": { label: "Trips", pkg: { TE: 0, WR: 4 }, lean: { passLean: 0.06 }, matchup: { "Nickel": -0.03, "Dime": -0.02, "46/Bear": 0.03 }, situational: { thirdLong: 0.03 }, layout: "pistol_trips" }
  },
  "Trips/Bunch": {
    "closed": { label: "Closed", pkg: { TE: 2, WR: 2 }, lean: { runIn: 0.05, passLean: -0.05 }, matchup: { "46/Bear": -0.04, "5-2": -0.03, "Nickel": 0.03 }, situational: { shortYardage: 0.04, redZone: 0.03, thirdLong: -0.03 }, layout: "trips_closed" },
    "open": { label: "Open", lean: { passLean: 0.05 }, matchup: { "Nickel": -0.03, "Dime": -0.03, "46/Bear": 0.03 }, situational: { thirdLong: 0.04, twoMinute: 0.03, shortYardage: -0.03 }, layout: "trips_open" }
  },
  "Single Back": {
    "twins": { label: "Ace Twins", pkg: { TE: 1, WR: 3 }, lean: { passLean: 0.05, runIn: -0.04 }, matchup: { "Nickel": -0.03, "46/Bear": 0.03 }, situational: { thirdLong: 0.03, twoMinute: 0.03 }, layout: "sb_twins" },
    "heavy": { label: "Heavy", pkg: { TE: 3, WR: 1 }, lean: { runIn: 0.05, passLean: -0.05 }, matchup: { "46/Bear": -0.03, "5-2": -0.03, "Nickel": 0.03, "Dime": 0.03 }, situational: { shortYardage: 0.04, redZone: 0.03 }, layout: "sb_heavy" }
  },
  "Empty": {
    "trey": { label: "Trey", lean: { passLean: -0.03 }, matchup: { "46/Bear": -0.03, "5-2": -0.03 }, situational: { shortYardage: 0.03 }, layout: "empty_trey" },
    "wide": { label: "Wide", lean: { passLean: 0.04 }, matchup: { "Nickel": -0.03, "Dime": -0.03, "46/Bear": 0.03 }, situational: { thirdLong: 0.03, twoMinute: 0.03 }, layout: "empty_wide" }
  },
  "Wishbone": {
    "heavy": { label: "Heavy", pkg: { TE: 2, WR: 0 }, lean: { runIn: 0.05 }, matchup: { "46/Bear": -0.03, "5-2": -0.03, "Nickel": 0.03, "Dime": 0.04 }, situational: { shortYardage: 0.05, redZone: 0.04, thirdLong: -0.03 }, layout: "bone_heavy" },
    "split": { label: "Split", pkg: { TE: 0, WR: 2 }, lean: { runOut: 0.05, passLean: 0.04 }, matchup: { "Nickel": -0.03, "46/Bear": 0.03 }, situational: { thirdLong: 0.03, twoMinute: 0.03 }, layout: "bone_split" }
  },
  "Flexbone": {
    "twirl": { label: "Twirl", lean: { runOut: 0.05 }, matchup: { "Nickel": -0.02, "46/Bear": 0.02 }, situational: { twoMinute: 0.03 }, layout: "flex_twirl" },
    "trips": { label: "Trips", pkg: { RB: 1, WR: 3 }, lean: { passLean: 0.05, runIn: -0.04 }, matchup: { "Nickel": -0.03, "Dime": -0.03 }, situational: { thirdLong: 0.03 }, layout: "flex_trips" }
  },
  "Wildcat": {
    "unbalanced": { label: "Unbalanced", lean: { runOut: 0.05 }, matchup: { "46/Bear": -0.03, "5-2": -0.03, "Nickel": 0.04 }, situational: { shortYardage: 0.05, redZone: 0.04 }, layout: "wc_unbal" },
    "slash": { label: "Slash", pkg: { TE: 1, WR: 1 }, lean: { passLean: 0.05 }, matchup: { "Nickel": -0.03, "Dime": -0.02 }, situational: { thirdLong: 0.03 }, layout: "wc_slash" }
  },
  "Jumbo": {
    "goalline": { label: "Goal Line", lean: { runIn: 0.03 }, matchup: { "46/Bear": -0.03, "5-2": -0.03 }, situational: { shortYardage: 0.05, redZone: 0.05, thirdLong: -0.04 }, layout: "jumbo_gl" },
    "tackleover": { label: "Tackle Over", lean: { runOut: 0.06 }, matchup: { "5-2": -0.03, "Nickel": 0.03 }, situational: { shortYardage: 0.04 }, layout: "jumbo_to" }
  }
};
FORMATION_ALIAS = { "Pro Set": "Single Back" };
aliasFormation = (id) => FORMATION_ALIAS[id] || id;
ATTR_FLOORS = {
  QB: { SPD: 22, STR: 30 },
  RB: { SPD: 34, AGI: 32, PWR: 22 },
  FB: { SPD: 24, STR: 34, PWR: 28 },
  WR: { SPD: 36, AGI: 32 },
  TE: { SPD: 26, STR: 30, PWR: 20 },
  OL: { STR: 34, PWR: 26 },
  DE: { SPD: 26, STR: 30, PWR: 26 },
  DT: { STR: 36, PWR: 30 },
  OLB: { SPD: 30, AGI: 26 },
  LB: { SPD: 26, STR: 26 },
  CB: { SPD: 36, AGI: 32 },
  S: { SPD: 32, AGI: 28 },
  K: { STR: 30, PWR: 30 },
  P: { STR: 30, PWR: 30 }
};
RECRUIT_CORE = {
  QB: { core: ["STR", "AWR", "TEC"], solid: [30, 35, 35], star: [40, 50, 40] },
  RB: { core: ["AGI", "SPD", "STR", "SEC", "TEC"], solid: [40, 35, 25, 26, 26], star: [55, 55, 35, 36, 36] },
  FB: { core: ["PWR", "STR", "TEC"], solid: [35, 35, 30], star: [45, 45, 40] },
  WR: { core: ["HND", "SPD", "AWR", "AGI", "TEC", "JMP"], solid: [40, 35, 25, 30, 26, 24], star: [55, 45, 35, 40, 36, 34] },
  TE: { core: ["STR", "PWR", "AWR", "TEC", "JMP"], solid: [35, 40, 30, 26, 22], star: [45, 50, 40, 36, 32] },
  OL: { core: ["STR", "PWR", "AWR", "TEC"], solid: [40, 45, 25, 34], star: [50, 50, 35, 44] },
  // [Stress-lab census, Jul 2026] AWR added to DE and CB cores: both rolled
  // AWR as junk (means 28 / 37) while the sim now reads it everywhere —
  // option keys, edge discipline, jet/draw/screen sniffing, zone coverage.
  // Without this, zone corners and assignment-sound ends don't exist to recruit.
  DE: { core: ["SPD", "STR", "TEC", "JMP", "AWR"], solid: [35, 35, 30, 22, 25], star: [50, 45, 40, 34, 35] },
  OLB: { core: ["SPD", "AWR", "TEC"], solid: [35, 28, 28], star: [48, 40, 38] },
  DT: { core: ["STR", "AWR", "TEC", "JMP"], solid: [45, 15, 30, 22], star: [55, 30, 40, 34] },
  LB: { core: ["STR", "AWR", "TEC"], solid: [35, 30, 26], star: [45, 45, 36] },
  CB: { core: ["SPD", "AGI", "HND", "TEC", "JMP", "AWR"], solid: [40, 35, 25, 30, 24, 28], star: [55, 45, 40, 40, 34, 38] },
  S: { core: ["SPD", "AWR", "TEC", "JMP"], solid: [35, 35, 26, 22], star: [50, 45, 36, 32] },
  // PWR and AWR are core for specialists because the kicking model reads them. Leave
  // them non-core and they spawn ~15-30 points below STR/TEC, which drops league FG%
  // from ~74% to ~62% (tools/kicking_model_probe.mjs).
  K: { core: ["STR", "PWR", "TEC", "AWR"], solid: [40, 40, 40, 40], star: [50, 50, 50, 50] },
  P: { core: ["STR", "PWR", "TEC", "AWR"], solid: [40, 40, 40, 40], star: [50, 50, 50, 50] }
};
SIZE_BANDS = {
  // pos-level defaults (used when no archetype, e.g. FB/OL/K/P, or as fallback)
  byPos: {
    QB: [73, 77, 205, 235],
    // 6'1"–6'5", 205–235
    RB: [68, 72, 195, 225],
    // 5'8"–6'0"
    FB: [70, 73, 235, 260],
    // 5'10"–6'1", fullback
    WR: [70, 75, 175, 215],
    // 5'10"–6'3"
    TE: [75, 79, 240, 265],
    // 6'3"–6'7"
    OL: [75, 79, 290, 330],
    // 6'3"–6'7", 290–330
    DL: [74, 78, 270, 315],
    // 6'2"–6'6"
    LB: [72, 76, 225, 250],
    // 6'0"–6'4"
    DB: [69, 73, 180, 205],
    // 5'9"–6'1"
    K: [70, 75, 175, 210],
    P: [71, 76, 185, 220]
  },
  // archetype overrides (taller/heavier or shorter/leaner than pos default)
  byArchetype: {
    // QB (Chunk 16: QB-Pocket/QB-Dual are the renamed QB-Pro/QB-Rush)
    "QB-Pocket": [74, 78, 215, 240],
    // taller pocket passer
    "QB-Dual": [72, 75, 200, 225],
    // shorter, leaner dual-threat
    "QB-Gunslinger": [74, 78, 210, 235],
    "QB-Game-Manager": [73, 76, 205, 230],
    "QB-Scrambler": [71, 74, 195, 220],
    // RB
    "RB-Power": [70, 73, 215, 240],
    // bigger bruiser
    "RB-Scat": [67, 70, 185, 205],
    // shorter, lower CoG, lighter
    "RB-Elusive": [67, 70, 185, 200],
    "RB-Workhorse": [70, 73, 210, 235],
    "RB-Speed": [68, 71, 185, 205],
    // WR
    "WR-Deep": [72, 76, 185, 210],
    // taller burner
    "WR-Poss": [69, 73, 195, 220],
    // stockier chain-mover
    "WR-Slot": [68, 71, 175, 195],
    "WR-Physical": [72, 76, 205, 225],
    // TE (Chunk 16: TE-Receiving/TE-Blocking are the renamed TE-Rec/TE-Blk)
    "TE-Receiving": [74, 77, 235, 255],
    // leaner move TE
    "TE-Blocking": [76, 79, 255, 275],
    // heavier in-line blocker
    "TE-Hybrid": [75, 78, 245, 265],
    "TE-Move": [74, 77, 230, 250],
    "DE-Speed": [75, 78, 250, 272],
    "DE-Power": [75, 78, 262, 288],
    "DE-Base": [75, 78, 255, 280],
    "OLB-Rush": [73, 77, 235, 255],
    "OLB-Cover": [73, 76, 225, 245],
    "OLB-Blitz": [73, 77, 232, 252],
    "DT-3tech": [74, 77, 285, 305],
    "DT-NT": [74, 77, 305, 335],
    "DT-Balanced": [74, 77, 295, 315],
    "DT-Quick": [73, 76, 275, 295],
    "LB-Thumper": [72, 75, 235, 255],
    "LB-Cover": [71, 74, 220, 240],
    "LB-Hybrid": [72, 75, 225, 245],
    "LB-Blitzer": [72, 75, 225, 245],
    "LB-Sideline": [71, 74, 215, 235],
    "CB-Press": [70, 73, 185, 205],
    "CB-Slot": [69, 72, 180, 198],
    "CB-Zone": [70, 73, 182, 202],
    "CB-Ball": [69, 72, 180, 200],
    "S-Free": [70, 73, 190, 208],
    "S-Strong": [71, 74, 200, 220],
    "S-Ball": [70, 73, 188, 206],
    "S-Hybrid": [70, 73, 194, 212],
    "S-Nickel": [69, 72, 185, 203],
    "OL-Mauler": [75, 79, 305, 335],
    "OL-PassPro": [76, 80, 290, 315],
    "OL-Balanced": [75, 79, 295, 325],
    "OL-Athletic": [75, 79, 285, 310],
    "FB-Lead": [70, 73, 240, 262],
    "FB-HBack": [72, 75, 228, 248],
    "FB-Hybrid": [71, 74, 234, 254],
    "K-Accuracy": [70, 74, 175, 200],
    "K-Power": [72, 76, 195, 220],
    "K-Balanced": [71, 75, 185, 210],
    "P-Directional": [71, 75, 185, 208],
    "P-Distance": [73, 77, 200, 225],
    "P-Balanced": [72, 76, 192, 216]
  }
};
FORMATION_PLAYBOOK = {
  "Single Back": ["Inside Zone", "Split-Zone", "Power", "Boot", "Trap", "QB Sneak", "Outside Zone", "Counter", "Toss", "Wham", "Buck Sweep", "Pin-and-Pull", "Dart", "Jet Sweep", "Draw", "Speed Option", "Slant-Flat", "Stick", "Mesh", "Shallow Cross", "Bubble Screen", "RB Screen", "Tunnel Screen", "Slip Screen", "Smash", "Seam-Read Smash", "Curl-Flat", "Y-Cross", "Flood", "PA Deep Cross", "Yankee", "Post-Wheel", "Mills (Post-Dig)", "Red-Zone Fade", "Whip", "Follow", "Y-Option", "Deep Out", "Comeback", "Corner-Post", "Deep Over", "Double Slants", "Hoss", "Drive", "Bench", "Stick-Nod", "Scissors", "Skinny Post", "Spot", "Sail", "Levels", "Sluggo Seam", "Reverse", "Flea Flicker", "HB Pass"],
  "Power-I": ["Inside Zone", "Power", "Boot", "Iso", "Trap", "QB Sneak", "Counter", "Toss", "Wham", "Buck Sweep", "Pin-and-Pull", "Dart", "Jet Sweep", "Draw", "Speed Option", "Triple Option", "Midline Option", "Slant-Flat", "Stick", "RB Screen", "Smash", "Curl-Flat", "Y-Cross", "PA Deep Cross", "Red-Zone Fade", "Whip", "Follow", "Y-Option", "Deep Out", "Comeback", "Corner-Post", "Deep Over", "Double Slants", "Hoss", "Drive", "Bench", "Stick-Nod", "Scissors", "Skinny Post", "QB Power", "Flea Flicker", "HB Pass"],
  "Wishbone": ["Inside Zone", "Power", "Boot", "Iso", "Trap", "QB Sneak", "Counter", "Toss", "Wham", "Buck Sweep", "Pin-and-Pull", "Dart", "Jet Sweep", "Draw", "Speed Option", "Triple Option", "Midline Option", "Slant-Flat", "Stick", "RB Screen", "Curl-Flat", "Y-Cross", "PA Deep Cross", "Red-Zone Fade", "Whip", "Follow", "Y-Option", "Deep Out", "Comeback", "Corner-Post", "Deep Over", "Double Slants", "Hoss", "Drive", "Bench", "Stick-Nod", "Scissors", "Skinny Post", "QB Power"],
  "Flexbone": ["Inside Zone", "Split-Zone", "Power", "Boot", "Iso", "Trap", "QB Sneak", "Outside Zone", "Counter", "Toss", "Wham", "Buck Sweep", "Pin-and-Pull", "Dart", "Jet Sweep", "Draw", "Speed Option", "Triple Option", "Midline Option", "Slant-Flat", "Stick", "Mesh", "Shallow Cross", "Bubble Screen", "RB Screen", "Tunnel Screen", "Slip Screen", "Smash", "Seam-Read Smash", "Curl-Flat", "Y-Cross", "Flood", "PA Deep Cross", "Yankee", "Post-Wheel", "Mills (Post-Dig)", "Red-Zone Fade", "Whip", "Follow", "Y-Option", "Deep Out", "Comeback", "Corner-Post", "Deep Over", "Double Slants", "Hoss", "Drive", "Bench", "Stick-Nod", "Scissors", "Skinny Post", "Spot", "Sail", "Levels", "Sluggo Seam", "QB Power", "Reverse"],
  "Wildcat": ["Inside Zone", "Power", "Boot", "Iso", "Trap", "QB Sneak", "Counter", "Toss", "Wham", "Buck Sweep", "Pin-and-Pull", "Dart", "Jet Sweep", "Draw", "Speed Option", "Triple Option", "Wildcat Power", "Slant-Flat", "Stick", "RB Screen", "Y-Cross", "PA Deep Cross", "Red-Zone Fade", "Whip", "Follow", "Y-Option", "Deep Out", "Comeback", "Corner-Post", "Deep Over", "Double Slants", "Hoss", "Drive", "Bench", "Stick-Nod", "Scissors", "Skinny Post", "QB Power"],
  "Spread": ["Inside Zone", "Split-Zone", "Power", "Boot", "Trap", "QB Sneak", "Outside Zone", "Counter", "Toss", "Wham", "Buck Sweep", "Pin-and-Pull", "Dart", "Jet Sweep", "Draw", "Speed Option", "Zone Read", "RPO Glance", "RPO Bubble", "QB Draw", "QB Counter", "Slant-Flat", "Stick", "Mesh", "Shallow Cross", "Bubble Screen", "RB Screen", "Tunnel Screen", "Slip Screen", "Smash", "Seam-Read Smash", "Curl-Flat", "Y-Cross", "Flood", "Dagger", "Post-Wheel", "Mills (Post-Dig)", "Four Verts", "Red-Zone Fade", "Whip", "Follow", "Y-Option", "Deep Out", "Comeback", "Corner-Post", "Deep Over", "Spacing", "Double Slants", "Hoss", "Drive", "Bench", "Stick-Nod", "Scissors", "Skinny Post", "Spot", "Sail", "Levels", "Sluggo Seam", "QB Power", "Reverse", "HB Pass", "Flea Flicker"],
  "Trips/Bunch": ["Inside Zone", "Split-Zone", "Power", "Boot", "QB Sneak", "Outside Zone", "Toss", "Wham", "Buck Sweep", "Pin-and-Pull", "Dart", "Jet Sweep", "Draw", "Speed Option", "Zone Read", "RPO Glance", "RPO Bubble", "QB Draw", "QB Counter", "Slant-Flat", "Stick", "Mesh", "Shallow Cross", "Bubble Screen", "RB Screen", "Tunnel Screen", "Slip Screen", "Smash", "Seam-Read Smash", "Curl-Flat", "Y-Cross", "Flood", "Dagger", "PA Deep Cross", "Yankee", "Post-Wheel", "Mills (Post-Dig)", "Four Verts", "Red-Zone Fade", "Whip", "Follow", "Y-Option", "Deep Out", "Comeback", "Corner-Post", "Deep Over", "Spacing", "Double Slants", "Hoss", "Drive", "Bench", "Stick-Nod", "Scissors", "Skinny Post", "Spot", "Sail", "Levels", "Sluggo Seam", "Reverse", "HB Pass", "Flea Flicker"],
  "Pistol/RPO": ["Inside Zone", "Split-Zone", "Power", "Boot", "Trap", "QB Sneak", "Outside Zone", "Counter", "Jet Sweep", "Draw", "Speed Option", "Zone Read", "RPO Glance", "RPO Bubble", "QB Draw", "QB Counter", "Slant-Flat", "Stick", "Mesh", "Shallow Cross", "Bubble Screen", "RB Screen", "Tunnel Screen", "Slip Screen", "Smash", "Seam-Read Smash", "Curl-Flat", "Flood", "Dagger", "Post-Wheel", "Mills (Post-Dig)", "Four Verts", "Red-Zone Fade", "Whip", "Follow", "Y-Option", "Deep Out", "Comeback", "Corner-Post", "Deep Over", "Spacing", "Double Slants", "Hoss", "Drive", "Bench", "Stick-Nod", "Scissors", "Skinny Post", "Spot", "Sail", "Levels", "Sluggo Seam", "QB Power", "Reverse", "Flea Flicker"],
  "Air Raid": ["Inside Zone", "QB Sneak", "Outside Zone", "Jet Sweep", "Draw", "Speed Option", "RPO Glance", "RPO Bubble", "QB Draw", "Slant-Flat", "Stick", "Mesh", "Shallow Cross", "Bubble Screen", "RB Screen", "Tunnel Screen", "Slip Screen", "Smash", "Seam-Read Smash", "Curl-Flat", "Y-Cross", "Flood", "Dagger", "PA Deep Cross", "Yankee", "Post-Wheel", "Mills (Post-Dig)", "Four Verts", "Red-Zone Fade", "Whip", "Follow", "Y-Option", "Deep Out", "Comeback", "Corner-Post", "Deep Over", "Spacing", "Double Slants", "Hoss", "Drive", "Bench", "Stick-Nod", "Scissors", "Skinny Post", "Spot", "Sail", "Levels", "Sluggo Seam", "Reverse"],
  "Jumbo": ["Inside Zone", "Power", "Boot", "Iso", "Trap", "QB Sneak", "QB Power", "Counter", "Toss", "Wham", "Buck Sweep", "Pin-and-Pull", "Dart", "Draw", "RB Screen", "Slant-Flat", "Stick", "Y-Cross", "PA Deep Cross", "Red-Zone Fade", "Whip", "Follow", "Y-Option", "Deep Out", "Comeback", "Corner-Post", "Deep Over", "Double Slants", "Hoss", "Drive", "Bench", "Stick-Nod", "Scissors", "Skinny Post"],
  "Empty": ["QB Sneak", "Jet Sweep", "Draw", "Slant-Flat", "Stick", "Mesh", "Shallow Cross", "Bubble Screen", "Tunnel Screen", "Smash", "Seam-Read Smash", "Curl-Flat", "Y-Cross", "Flood", "Dagger", "PA Deep Cross", "Yankee", "Post-Wheel", "Mills (Post-Dig)", "Four Verts", "Red-Zone Fade", "Whip", "Follow", "Y-Option", "Deep Out", "Comeback", "Corner-Post", "Deep Over", "Spacing", "Double Slants", "Hoss", "Drive", "Bench", "Stick-Nod", "Scissors", "Skinny Post", "Spot", "Sail", "Levels", "Sluggo Seam", "QB Power"]
};

// ── D14 (OD-6, 2026-08-18): THE ONE COVERAGE-FAMILY TABLE ───────────────────
// The family→shell truth used to live in THREE hand-kept copies (sim.js
// FAMILY_SHELL and COV_FAMILY_IMPLIES, defbook.js _FAMILY_SHELL). They agreed,
// but nothing made them agree — the next family added to one was a silent
// disagreement waiting to happen. This is now the single source; all three
// derive from it.
//
//   shell / style — what the picture IS structurally. `style` is what the
//     coverage pick would read off the dials if the same picture were dialed
//     up by hand, so a family and its hand-dialed twin can't drift apart.
//   callable — can a CALL pin this family by name? Only the four pictures a
//     card can select (2-Man / Tampa 2 / Cover 6 / Prevent) force their dials
//     through applyDefCall. The rest are OUTPUT names — what the coverage pick
//     produces from shell+style — and pinning one by name has never been a
//     thing a call could do. Keeping the distinction is load-bearing: making
//     every family callable would let a stray covFamily:"Cover 2" start
//     overwriting the dials, which is a behavior change, not a cleanup.
//
// AUDIT NOTE (D14): the cohesion audit recorded the shell-only copy as
// "missing Cover 2-Man". It is NOT and never was — the entry has been present
// since before the audit commit (verified at ec7300b). Nothing was fixed here;
// this merge is a pure de-duplication and changes no behavior.
var COV_FAMILY = {
  "Cover 0":       { shell: "single", style: "man",  callable: false },
  "Cover 1":       { shell: "single", style: "man",  callable: false },
  "Cover 3":       { shell: "single", style: "zone", callable: false },
  "C3 Fire Zone":  { shell: "single", style: "zone", callable: false },
  "Cover 2":       { shell: "two",    style: "zone", callable: false },
  "Cover 4":       { shell: "two",    style: "zone", callable: false },
  "Cover 2-Man":   { shell: "two",    style: "man",  callable: true },
  "Cover 6":       { shell: "two",    style: "zone", callable: true },
  "Tampa 2":       { shell: "two",    style: "zone", callable: true },
  "Prevent":       { shell: "two",    style: "zone", callable: true }
};
// W4 (§2): legacy migration — map an old numeric blitzPct to its nearest
// AGGRESSION stop. Used by the UI, the sim and old-save normalization so a
// plan authored before the aggression dial existed keeps behaving the same.
function aggrStopFromBlitzPct(pct) {
  const p = pct != null ? pct : 20;
  if (p <= 10) return "bend";
  if (p <= 16) return "selective";
  if (p <= 25) return "balanced";
  if (p <= 38) return "attacking";
  return "house";
}

export { COV_FAMILY, ARCHETYPE_DISTANCE, ATTRIBUTES, ATTR_FLOORS, C, CLASS_YEARS, DEFAULT_PRACTICE, DEF_FRONTS, DEF_FRONT_COUNTS, DEF_FRONT_WEIGHTS, DEF_WEIGHTS, FORMATIONS, FORMATION_PACKAGES, FORMATION_PLAYBOOK, FORMATION_VARIATIONS, FORMATION_ROLE_OVERRIDE, FORMATION_SITUATIONAL, FORMATION_WEIGHTS, FRONT_ROLES, MATCHUP_MATRIX, MEASURED_ATTRS, OFF_ROLE_BY_PLAY, OFF_WEIGHTS, OUT_OF_POS, OVR_POS_ADJ, PASS_TENDENCY, PENALTY_CATALOG, POSITIONS, POS_WEIGHTS, PRACTICE_TOOLS, RECRUIT_CORE, ROLE_WEIGHTS, ROSTER_POS_MAX, ROSTER_POS_MIN, ROSTER_TARGETS, SAVE_VERSION, SIZE_BANDS, SLOT_ELIGIBILITY, STARTER_COUNTS, SUB_ADJACENT, aggrStopFromBlitzPct, aliasFormation, attrLabel, schemeRosterTargets, schemeStarterCounts, schemeStarterOverride, schoolSchemeFront };
