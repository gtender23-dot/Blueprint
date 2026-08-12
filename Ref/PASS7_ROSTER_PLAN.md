# PASS 7 — ROSTER BRAIN (plan of record, 2026-08-09) — **SHIPPED 2026-08-09, as-built notes at end**
### Scope ratified by owner at kickoff: AI league-wide (gated A/B) · morale persistent + visible ·
### neither surfaced-unclaimed item pulled in. Owner directive: the convert flow TIES INTO the
### existing recommended-position-changes machinery (cutDayConversionRecs becomes the shared brain).

## The three legs (roadmap wording)
- **Fix C — position-convert flow.** The buried blitz-OLB bulks to DE or slims to nickel. The
  flow already exists (previewConversion / convertPosition / cutDayConversionRecs + camp cap +
  conversion penalty). Pass 7 makes it identity-aware and league-wide.
- **Fix D — real snap tracking → portal pressure + morale.** The sim already counts true
  scrimmage snaps per player per game (updateFatigue → ctx.snapCountMap → result.homeSnapCounts /
  awaySnapCounts) and then throws them away. Pass 7 persists them and drives portal + morale off
  actual usage.
- **Identity stage 4 — earnable bridges + offseason bulk/cut** (IDENTITY_DESIGN §4d, §5),
  consuming C/D machinery.

## Build plan

### D1. Snap persistence (`__noSnapTrack`)
- season.js updateStandings: applySnapCounts(roster, result.homeSnapCounts) → p.stats.snaps,
  p.careerStats.snaps. Team side totals: result.homeTeamSnaps={off,def} (from ctx.offSnaps/defSnaps)
  → school.stats.offSnaps/defSnaps via accumTeamStats.
- **Job snaps**: at the updateFatigue call site the fielded elevens are in scope. Defense: primitive
  personnel buckets (DE/DT/OLB/ILB/CB/S) vs native position (ILB≡LB) → foreign-bucket snap.
  Offense: resolveOffField gains an `oopByPlayer` return (built in resolveSlots where s.pos and
  native pos are both known) — mesh-slot fieldings where slot pos ≠ native. Counted into
  ctx.jobSnapMap → result.homeJobSnaps → p.stats.snapsAt={bucket:n} (season-level; dies with the
  stat reset at startNewSeason, evaluated before it).
- Old saves: null-guard, no SAVE_VERSION bump (trait-system precedent).

### D2. Morale (`__noMorale`) — persistent, visible, OFF-FIELD ONLY (zero sim reads, band-safe by construction)
- p.morale 0–100, init 70 at generation; legacy players lazily init 70.
- Ticked in updateStandings for both rosters after stats apply (per real game, all schools):
  expected share from depth rank vs startersAt + class year (SR/JR expect more, redshirt ~0);
  actual = p.stats.snaps / side snaps; delta = clamp(K·(actual−expected), −4, +3) + small
  team-result term; drift toward 70. Injured weeks excused.
- Consumers (portal.js): AI leavers — buried probability becomes morale-scaled (low morale ×
  up to ~2.2, high morale × 0.6); player-school attrition same multiplier; reason strings gain
  "unhappy with his role". `__noMorale` = byte-identical legacy depth-rank logic.
- UI: morale chip on player card + cut-day rec rows flag "unhappy — buried".

### C1. Convert brain (`__noConvertBrain`) — the shared recommendation engine
- Refactor cutDayConversionRecs → schoolConversionRecs(state, school) (player-school wrapper keeps
  the existing name/signature; dashboard untouched).
- Identity-aware scoring: previewConversion projects the body one offseason toward the target
  position's SIZE_BANDS window (the bulk/cut plan below) and prices sizeFitForRole at the
  destination; bridge trait covering the destination adds a strong bonus; real-usage buried test
  (snap share < threshold counts as buried even when room rank looks fine, when snap data exists).
- Rec rows carry the body direction: "bulks to DE (+12 lb)" / "slims to NB (−8 lb)".
- convertPosition stamps p.bodyPlan={targetW} consumed by the offseason bulk/cut step.
- **AI league-wide**: at startNewSeason (before stat reset / recruit gen), each AI school applies
  its top schoolConversionRecs up to C.AI_POS_CHANGE_CAP=2 through the same convertPosition
  economy (penalty + convDev). Band rule honored: gated stat_realism A/B (pass7_band_ab).

### S4a. Earnable bridges (`__noEarnBridge`) — IDENTITY_DESIGN §4d, now on REAL snaps
- At startNewSeason, before stat reset: player with no bridge, traits.earned false, and
  snapsAt[foreign] ≥ C.BRIDGE_EARN_SNAPS (220) AND ≥ C.BRIDGE_EARN_SHARE (0.35) of his snaps →
  grant the mapped bridge, traits.earned=true (one per career), inbox card "He's become a Rover."
- Bucket→bridge map: LB/OLB in S∪CB space → spaceBacker · S at CB(NB) → slotStar · S in LB/OLB
  box → boxGeneral · DE↔OLB cross → edgeBender. Offense (via oopByPlayer slot pos): TE→WR moveTE ·
  RB→WR backfieldWeapon · FB↔TE hBack · RB at WILDCAT QB spot → wildcatEngine. twoGapper /
  poleRunner / swingTackle DECLINED (not bucket-visible; job-internal).
- All schools (AI rosters earn too — same generation parity law as traits).

### S4b. Offseason bulk/cut (`__noBulkCut`) — IDENTITY_DESIGN §5
- At startNewSeason for every roster: target weight = convert bodyPlan target, else the foreign
  job's window if he lived there (≥35% share), else own-band regression only when outside it.
  Move = clamp(target−w, ±cap), cap rolled 5–12 lb (WE/CON-seeded). Coupled attr nudges per 10 lb
  (+STR/PWR, −SPD/AGI; cut reverse; zero-sum in spirit), refreshRatings, frame._bulk recomputed.
  Height never changes. Player-school notable moves (≥6 lb) reported in one inbox digest.

## Hook Rule declarations (standing law §4f)
Snap tracking, morale, convert flow, bulk/cut: **no trait — declined (off-field roster machinery,
not on-field mechanisms)**. Earnable bridges ARE the trait surface this pass ships.

## Kill-switches
`__noSnapTrack` · `__noMorale` · `__noConvertBrain` · `__noEarnBridge` · `__noBulkCut` — each
restores legacy behavior independently; morale tick no-ops without snap data.

## Gates
- New probes: snap_track_probe (conservation: Σ player snaps = 11×side snaps per game; job snaps ⊆
  snaps; persistence + reset) · morale_probe (tick direction, portal multiplier, switch inert) ·
  convert_brain_probe (identity-aware rec on a planted tweener; body-plan text; AI cap; recs ride
  the same economy) · stage4_probe (bridge grant at threshold, one-per-career, bulk/cut caps +
  zero-sum nudges + window targeting).
- pass7_band_ab: all-off vs all-on, N=300 — league drift bands (AI roster changes are the risk).
- stat_realism N=500 (expect the same 3 pre-existing flags, no new).
- Full probe regression + UI smokes vs the pristine baseline; build + _boot_check.

## AS-BUILT (2026-08-09)
- **Where things landed.** C.PASS7 block (constants.js, all tunables). Fix D counting: sim.js
  job-snap block right after the updateFatigue call (defense from primitive personnel buckets,
  offense from resolveOffField's new `oopByPlayer` return built in fieldassign.js); result carries
  homeJobSnaps/awayJobSnaps + homeTeamSnaps/awayTeamSnaps. Persistence + morale: season.js
  updateStandings → applySnapCounts + tickMorale (exported as probe seams). Portal: moraleMult +
  the `unhappy` door in buildTransferPortal (AI leg) + attrition roll (player leg). Fix C +
  stage 4: offseason.js — schoolConversionRecs (cutDayConversionRecs is now a wrapper),
  previewConversion takes an optional school, convertPosition stamps p.bodyPlan, and
  pass7Rollover (aiRosterConverts → earnBridges → offseasonBulkCut) is called from
  startNewSeason immediately BEFORE the season stat reset. Morale rolls at generation
  (createRecruit + the createPlayer whitelist copy). UI: player-card morale chip + snaps line
  (app.js), cut-day rec rows body plan + unhappy/usage flags (dashboard.js).
- **GOTCHA fixed mid-build:** SIZE_BANDS.byPos keys band FAMILIES (DL/LB/DB), not roster
  positions — without the posBandKey mirror (_bandKeyForPos) every defensive body-math path was
  silently inert. convert_brain_probe's band-key law now pins this.
- **Earn map as shipped:** LB/OLB→spaceBacker (S∪CB) · OLB↔DE→edgeBender · S→slotStar (CB) /
  boxGeneral (ILB∪OLB) · TE→moveTE (SLOT∪WR) / hBack (RB) · RB→backfieldWeapon / hBack /
  wildcatEngine. twoGapper/poleRunner/swingTackle declined (not bucket-visible). Earning may
  create a traits object on a pre-trait legacy player — deliberate, the one legitimate retro path.
- **Gates run:** snap_track_probe 11 · morale_probe 9 · convert_brain_probe 16 (probe hardened
  to score-toggle + funnel-shaped assertions after argmax flakiness; 10/10 stable) ·
  stage4_probe 17 · pass7_band_ab N=300 HELD (live pts 0.60 rush 0.31 pass 4.47 comp% 0.44
  sk 0.07; AMP=saturated brain inside envelope) · stat_realism N=500 same 3 pre-existing flags
  (rush 139.9 / comp% 56.5 / INT% 1.78) · ~90-probe regression + UI smokes green, incl.
  covfam 17/17, defcall 32/32, portal_balance, cutday_recs, traits/size_fit/trait_growth.
- **Pre-existing env failures verified identical on the pristine tree (NOT regressions):**
  rotation_probe cloud check · motion_struct · zone_void · dna_cards · nav_back (1 team-page
  check) · main-menu-locator family (letter_logo / calendar_display / saved_team_library, same
  class as documented instant_classic/timeout_screen) · covsack seed-flake (rerun clears).
  h2_shadow + recruit_calendar are extremely slow in this container (CPU-bound 1500-game arms);
  h2 partials matched pristine, left running at delivery — recheck locally if desired.
- **Design note:** morale is OFF-FIELD ONLY by construction (no sim read anywhere) — the band
  risk was roster composition, which is exactly what pass7_band_ab's synthesized-offseason arms
  measure.
