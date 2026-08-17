// _gate_manifest.mjs — the probe registry _gate.mjs runs. DATA ONLY; edit this
// file, not the runner. Established 2026-08-09 (post-Pass-7, all runtimes
// measured in the cloud container unless noted).
//
// Fields per entry:
//   name       tools/ filename
//   tier       'core' — runs on every change-set gate (the per-pass minimum)
//              'full' — deploy-level sweep (full ⊇ core)
//   kind       'node'      plain engine probe, no args beyond `args`
//              'pw'        playwright smoke — needs PW_CHROMIUM, takes the
//                          ABSOLUTE dist/index.html path as argv[2]
//              'pw-dist'   playwright, takes the dist DIRECTORY as argv[2]
//              'pw-noarg'  playwright, no path arg (bundles from js/ itself —
//                          the Codex viewer probes)
//   args       extra argv AFTER the path arg (N overrides etc.)
//   timeoutSec kill after this long (measured runtime + headroom)
//   seedFlaky  true — unseeded RNG; ONE automatic retry before it counts as
//              a failure (standing list from the project flags)
//   envKnown   true — fails in the CLOUD container identically on a pristine
//              baseline (verified 2026-08-09); reported separately and never
//              fails the gate THERE. On a local machine it IS gating — the
//              runner treats envKnown as informational only when it detects
//              the cloud chromium path.
//   localOnly  true — too slow for the cloud container (CPU-bound multi-
//              thousand-game arms); skipped there with a note, runs locally.
//   night      true — deferred CPU giant: excluded from core AND full (full
//              shows it as deferred); runs only via `node tools/_gate.mjs
//              night` or --only. Owner request 2026-08-10.
//   note       why the flag / what to swap per pass
//
// PER-PASS SWAP POINT: keep exactly one *_band_ab entry in core — the CURRENT
// pass's A/B. Older band A/Bs stay in full as regression.

export const MANIFEST = [
  // ── core: bands + realism (the non-negotiables) ────────────────────────────
  { name: 'stat_realism_harness.mjs', tier: 'core', kind: 'node', args: ['500'], timeoutSec: 600,
    note: 'N=500; expect the 3 standing flags (rush low / comp% / INT%) and NOTHING new' },
  { name: 'arm_switch_ab.mjs', tier: 'core', kind: 'node', args: ['24'], timeoutSec: 600,
    note: 'CURRENT pass A/B — Viewer Act 2 A4 recording stamp: live-vs-kill scores, yards, turnovers, volume, and every play outcome are bit-exact after stripping the presentation-only armSwitch field.' },

  // ── core: identity + roster brain (the newest, least-settled surface) ──────
  { name: 'traits_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 240 },
  { name: 'size_fit_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 240, seedFlaky: true, envKnown: true,
    note: 'fat-tail check on the standing flaky list. 2026-08-09 (M20 gate): light-OLB tail (0.4% vs 0.5% floor) failed 3/3 on the PRISTINE pre-M20 tree in the cloud container — envKnown there. 2026-08-10 (M25 gate, first LOCAL-Windows run): the tail sits AT the boundary locally too — 0.4-0.5% across runs, ~1/3 fail rate, so the retry double-fails roughly one gate in ten. A red on ONLY this check at 0.4-0.5% is the standing boundary, not a regression; a red materially below 0.4% is real.' },
  { name: 'trait_growth_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 240 },
  { name: 'snap_track_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 300 },
  { name: 'morale_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 300 },
  { name: 'convert_brain_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 300 },
  { name: 'stage4_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 300 },
  { name: 'cutday_recs_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 240, seedFlaky: true, note: 'unseeded balanced-roster volume tail; immediate retry clears it' },
  { name: 'portal_balance_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 240 },
  { name: 'scheme_role_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 240 },
  { name: 'save_migration_check.mjs', tier: 'core', kind: 'node', timeoutSec: 240, note: 'always — cheap and saves are sacred' },
  // ── core: Playbook-Root refactor foundation (Stages 1–2, 2026-08-15) ───────
  { name: 'playbook_root_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 180,
    note: 'Stage 1 equivalence proof: split∘compile of a team plan is byte-identical to the gameplan the sim reads, across a full generated world of AI plans + the pb:/dd: load writers. The node-level stand-in for _equiv_walk on the plan object; a red here means the compile seam changed sim inputs.' },
  { name: 'plan_side_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 180,
    note: 'Stage 1 side-manifest guard (PLAN_FIELD_SIDE): sides disjoint, every sim-consumed standing field covered, partition is a clean cover on real AI plans. Catches the next dead-field or cross-side write.' },
  { name: 'ai_book_name_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 180,
    note: 'Stage 2 cosmetic-naming guard: the AI book-naming helpers consume 0 RNG (cannot move the stat bands), the name fields are overlay-only (never reach the sim plan), and the names flow onto book/defbook.' },
  { name: 'live_book_call_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 240,
    note: 'Stage 4 live-coaching-reads-the-book guard: a composed play forced from the headset runs AS ITSELF (name recorded, coachCall set, one snap per call) with grades from the band-clamped compilePlay rulebook; PASS_CONCEPTS never polluted (AI-blind by construction); a broken payload falls through to the sheet; defBookCalls resolves the defensive chips through the defbook, with the defbook.calls compile seam byte-neutral for every existing book.' },
  { name: 'book_update_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 120,
    note: 'Stage 3 completion guard: Workshop loads stamp book sourceId/sourceSaved (ride the gameplan as _fields, survive re-synthesis + save round-trips, clear on full-plan loads); the one-tap book update preserves situations/team knobs/the other side and refreshes the stamp; controllerOverlayOf saves the CONTROLLER only (no book structure, no roster-bound fieldAssignments, no _internals); applyControllerOverlay loads onto any book with the book byte-identical and compile ≡ gameplan throughout.' },
  { name: 'formation_compose_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 420,
    note: 'Stage 7 Formation-Designer guard: legality validator (five skill, no shared spots, backs in the backfield, 7 on the line, covered-end warnings, built-in names refused); the FIXED rulebook (package counted, archetype identity inherited verbatim, call list a strict SUBSET of the archetype book, structure filters, lawful 11 in bounds); the registry (all four rows installed, matchup/situational NEUTRAL, idempotent re-sync, clean unregister, built-ins never shadowed); a full sim game plays the custom formation sanely with its derived book respected and the viewer scripting its snaps; the AI never authors it.' },
  { name: 'draw_up_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 300,
    note: 'Stage 6 the-animation-honors-the-draw-up guard: every FORMATION_VARIATIONS layout: pointer resolves to an authored VARIATION_LAYOUTS row (real slot ids, in bounds, never offsides, identity preserved, base unmutated); the diagrams draw the authored look; resolveComposedReceivers is lawful (one route per body, explicit picks, screens to backs); on a real recorded snap a seeded composed play animates its own route shapes, flip mirrors the break, a drawn blocker stays in; a null seed builds a byte-identical script (non-composed plays untouched).' },
  { name: 'record_call_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 240,
    note: 'Stage 5 the-record-knows-the-call guard: every real snap carries bookName/variation/customPlayId stamps (school.book first, _playbookName fallback, null-safe); pinned-PRNG proof the stamps are recording-only (byte-identical records with the stamp stripped); a forced look records its variation; a composed call records its customPlayId.' },
  { name: 'bench_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 240,
    note: 'M1 test-bench guard (2026-08-17): a known play vs a forced defensive look (front + 8-picture coverage + bring 3/4/5/6) runs through the real sim with the concept, coachCall/defCoachCall and rolled coverage on the record; SAME ROLL AGAIN is byte-identical under the pinned seed; the scratch teams are attribute-even, flat-caliber, distinct-id, cached; ZERO save writes (no state/persistence imports, no localStorage); a composed play runs as itself; the forced variation rides; watchphys scripts the rep; the ONE shared fits-function (fitting ⊆ legal, personnel rules, customs never offer Wildcat/Jet); Builder auto-select seeds SHIPPED sheet weights, not flat ones.' },
  { name: 'contract_ladder_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 180,
    note: 'D6 loyalty-ladder contracts (owner 2026-08-11): renewals mint a +10% stack, mid-contract declines extend the paper +1yr, cap holds, legacy recruitBonus paper honored. Extended 2026-08-12 (playtest item 20): the AD sets the length, one term on the table, acceptExtension ignores termId. Demote to full once settled.' },
  { name: 'prestige_trajectory_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 240,
    note: 'playtest item 18 — winning moves a program. At the old PRESTIGE_W_WIN a 1-star that went 11-1 gained +0.025 and entered the next August still a 1-star (the owner\'s exact report). Gates the trajectory in both directions, that .500 is stable, that the division cap holds, and that 30 seasons of zero-sum football does not inflate the league. The prestige→talent coupling (item 18\'s second half) is REPORTED not gated — widening it is a worldgen change needing its own A/B.' },
  { name: 'viewer_pace_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 180,
    note: 'playtest items 9 + 9c — the viewer shows the play that happened, at the speed it happened. Ball has ONE latched release point (it used to re-read the live QB every frame, so a moving passer dragged the arc and the bow sign could flip mid-flight); long runs can REACH their endpoint (stepAgent clamped y to 2 while endY allows -60, so anything over ~34 yds pinned and stalled); ballcarrier hits a real running speed. Floors are distance-aware — short runs are acceleration-limited in real football too.' },
  { name: 'viewer_duel_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 240,
    note: 'Viewer Act 2 A1 — deterministic lawful move/tackle variants, unchanged actor+ball tracks, capped gang-tackle cast, landmark dives, and Slip/Boot geometry.' },
  { name: 'viewer_throwcatch_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 120,
    note: 'Viewer Act 2 A2 — geometry-lawful catch variants, moving-QB releases, semantic trench postures, deterministic presentation-only cues, and M21 ball-to-hands truth.' },
  { name: 'viewer_throwcatch_live_probe.mjs', tier: 'core', kind: 'pw', timeoutSec: 120,
    note: 'Viewer Act 2 A2 live law — one catch/release style at a time, ball attachment, paired trench silhouettes, and zero pre-snap A2 state residue.' },
  { name: 'viewer_secondary_motion_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 120,
    note: 'Viewer Act 2 A3 — deterministic motion-state mapping, bounded shadow weight, gather/top-speed cues, lawful pursuit head-checks, and no track ownership.' },
  { name: 'viewer_secondary_motion_live_probe.mjs', tier: 'core', kind: 'pw', timeoutSec: 120,
    note: 'Viewer Act 2 A3 live law — full cast, bounded per-frame accents, gather/sprint sightings, carrier-only head-checks, and zero pre-snap A3 state residue.' },
  { name: 'viewer_act_a_finish_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 240,
    note: 'Viewer Act 2 A4+A5 — lawful outside-arm stamps, real height/weight on every fielded slot, bounded body families that weight presentation choices, and unchanged actor+ball tracks.' },
  { name: 'viewer_act_a_finish_live_probe.mjs', tier: 'core', kind: 'pw', timeoutSec: 180, seedFlaky: true,
    note: 'Viewer Act 2 A4+A5 live law over local HTTP — full 22-man real-body scrimmage cast (M18 synthetic ST and 11-actor 2pt/kneel mini-boards keep their own contracts), multiple frame families, carrier-owned arm exchange, and zero pre-snap residue. One retry: a random exhibition can contain no eligible 6+-yard outside-arm opportunity in the sampled live window.' },
  { name: 'viewer_act_b_probe.mjs', tier: 'core', kind: 'pw', timeoutSec: 180,
    note: 'Viewer Act B — real-play clip capture, Film Room playback hook, trace-language broadcast analysis, scrub/slow-mo, rendered-transform camera + All-22, actor cards, paused telestrator, annotated stills, compact replay persistence, and short-video capability.' },
  { name: 'viewer_act_c_probe.mjs', tier: 'core', kind: 'pw', timeoutSec: 180,
    note: 'Viewer Act C - pure world-to-screen projection contract plus live Broadcast/All-22/Coach/End Zone/Reverse replay walk: 22 actors preserved, old coach orientation restored, depth ordering, front/back bodies, presentation ball height, clean field-layer swaps, and recorded play/outcome immutability.' },
  { name: 'viewer_act_d_probe.mjs', tier: 'core', kind: 'pw', timeoutSec: 180,
    note: 'Viewer Act D - true perspective End Zone projection plus replay-clock parity for punts, kickoffs, field goals and PATs: pause/scrub/rate/camera/export controls, complete 22-man special-teams casts, projected football height, and presentation-only geometry.' },
  { name: 'viewer_act_e_probe.mjs', tier: 'core', kind: 'pw', timeoutSec: 180,
    note: 'Viewer Act E - deterministic phase-aware replay director across scrimmage and special teams, End Zone/Coach label decluttering that preserves featured players, grounded projection-height football shadows, manual camera takeover, and recorded-outcome immutability.' },
  { name: 'viewer_act_f_probe.mjs', tier: 'core', kind: 'pw', timeoutSec: 180,
    note: 'Viewer Act F - football-purpose shot labels and restrained principal focus: quarterback/rusher, target/coverage/ball, carrier/tacklers, and special-teams operation/return pairs; manual camera takeover clears the treatment and outcomes remain immutable.' },
  { name: 'pos_ovr_census_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 300,
    note: 'playtest item 3 — every position (K/P exempt) averages 58 ± 1.6 OVR. OVR_POS_ADJ claims to BE this measurement; it rotted when AWR joined the CB/DE cores after the Jul 2026 census and nobody re-ran it, leaving corners +6.2 over safeties. Fails loudly the next time a core list, weight row or attribute band moves without a re-derive. `--derive` prints a corrected block.' },
  { name: 'ovr_adj_ab.mjs', tier: 'core', kind: 'node', timeoutSec: 600,
    note: 'playtest item 3 — matched-RNG A/B proving an OVR_POS_ADJ change is display-only: compositeRating is read on the field (route duel blends 15%) and off it (avgTop22Composite drives the cheap-sim path + playoff seeding), so a recalibration is a balance change until measured. Also the record of WHY K/P are exempt: re-deriving them was the one thing that moved scoring.' },
  // ── Playtest pass 2026-08-12 — two laws nothing in this manifest asserted ──
  { name: 'starter_hold_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 180,
    note: 'playtest item 13 — A NAMED STARTER STAYS THE STARTER. pinnedFirst promotes over rating; beginSecondHalf preserves the pin (it used to assign raw depthChart, so the coach\'s 49-ovr QB lost the job in the 3rd quarter); the break keeps the pre-game dress; MESH_DEPTH_KEYS covers every offensive mesh key the resolver accepts (this is what FADE was failing).' },
  { name: 'class_backfill_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 180,
    note: 'playtest item 27 — AI signing-day backfill respects need, not just ROSTER_POS_MAX. The "7 DE with 0 need" class came from fillRemainingSlots asking only "am I at max?" while sorting by distance. Discriminating case: nearest board is all one no-need position while two rooms are gutted.' },
  { name: 'help_rule_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 60,
    note: 'playtest item 33 — CLAUDE.md help rule 3 ("never print a coefficient, a weight table, or a threshold") had been written down for months and breached in nineteen places on the Game Plan screen, because nothing checked it. Scans static help copy only (tip bodies + the manual TIPS tables), unescapes \\uXXXX and blanks ${} first, so a live readout of the coach\'s OWN dials still passes while documented constants fail. Self-tested both ways: the ten strings that shipped this morning must all trip it, and six legitimate readouts must not.' },
  { name: 'chair_isolation_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 120,
    note: 'playtest follow-up — ONE CHAIR\'S WEEK IS NOT ANOTHER CHAIR\'S. Two defects, same mistake (treating state.playerSchoolId as the only program the player runs): the preseason lived at state.preseason, ONE object shared by every chair (focus, position changes, camp report, spring result, redshirt review), and startNewSeason handed pendingRedshirts only to whoever was active at rollover while every other tree school got autoRedshirtFreshmen like an AI program — so the second chair opened to "Redshirts finalized" for a window it was never offered. Gates per-school context, the old-save migration (active chair adopts the global, others start clean), and that the coached-school set covers every live chair and no AI program.' },
  { name: 'save_backup_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 120,
    note: 'release hardening 2026-08-10: rolling backup ring rotates in one tx, loadGame walks it on a missing primary, version gate holds on recovery, .bak keys hidden + deleted with slot. Cheap (fake IDB, no worldgen).' },
  { name: 'multicoach_week_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 150,
    note: 'playtest follow-up — COACH EACH OF YOUR PROGRAMS. A multi-coach (tree) week surfaces every one of the player\'s programs\' games one at a time before the league day advances; each can be coached (halftime pause) or simmed. Gates: single-coach no-ops (classic active pause unchanged), both games surfaced and neither skipped, standings applied exactly once per coached school, the day advances only after all are resolved, the originally-active chair is restored, and the "let the sim handle it" path resolves without a pause. NOTE: the interactive halftime UI + the pw game-flow smokes must still be run on a machine with a browser — this probe drives the engine sequencing headlessly, not the DOM.' },
  { name: 'a11y_overlay_probe.mjs', tier: 'core', kind: 'pw', timeoutSec: 200,
    note: 'release hardening 2026-08-10: overlay containment (base view inert+aria-hidden under any modal — the readiness-review exhibition repro) + accessible names on every visited control' },
  // ── core: DNA Tree roguelite campaign (2026-08-10, passes 1–9) — newest,
  //    least-settled surface; demote to full once settled a few passes ──────
  { name: 'coach_age_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 240, note: 'age system + carousel tenure-reset fix + name dedup' },
  { name: 'star_unfold_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 240, note: 'star ladder recut + D3 skill un-fold; effective-grade units are the sim contract' },
  { name: 'coordinator_identity_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 240, note: 'rust/ledger/ambition + doubling retention (owner ruling) + promise' },
  { name: 'hc_mastery_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 240, note: 'the ONE outcome-touching piece — full-grid stacking-cap proof, AI bit-exactness' },
  { name: 'ceremony_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 240, note: 'D8 exit shares, lore-shape world writes, succession pick, never-delete law' },
  { name: 'player_retention_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 240, note: 'dynasty vs ladder (owner ruling): 10%/declined call, cap 100%, forfeit on climb' },
  { name: 'coordinator_audit_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 240, note: 'coordinator field contract + hire-card completeness' },
  { name: 'dead_surface_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 120, note: 'static: every UI-writable key has an engine reader (coverageScheme-class bug killer)' },
  { name: 'play_fidelity_probe.mjs', tier: 'core', kind: 'node', args: ['4'], timeoutSec: 300, seedFlaky: true, note: 'THE CALL IS THE PLAY (owner mandate): gate=runnable, 1156-snap zero-miss fidelity, def deployment, gadget signatures, re-prompt pin. Killed the QB-audibles-out-of-coach-calls bug. seedFlaky 2026-08-14: unseeded RNG in the forced-snap walk (penalty re-prompt count + drive-handback tally vary run to run) trips a single check ~1 in 9; verified 8/8 green on a clean converged tree. A REAL fidelity regression fails both tries and still gates.' },
  { name: 'tree_advantage_probe.mjs', tier: 'full', kind: 'node', args: ['400'], timeoutSec: 1800,
    note: '§9 enforcement — 2,000 identical-roster game arms at N=400; point-diff gates. localOnly LIFTED 2026-08-11: measured 10 min at N=800 (2,800 games) on a 1-core cloud container, so N=400 costs full ~5 min — cheap enough to gate every deploy sweep instead of being skipped in the cloud and owed. POWER FLOOR: E5 gates on mean > 2·se, so it is underpowered and reds spuriously below about N=300 — never smoke this probe at a small N and read the E5 red as a regression. Tight-CI pre-deploy version stays `node tools/tree_advantage_probe.mjs 800`.' },
  { name: 'blitz_pie_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 400, note: 'pressure pie (2026-08-09) — demote to full once it has settled a few passes' },
  { name: 'portrait_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 240, note: 'painted portraits (2026-08-09) — fast; demote once settled' },
  { name: 'formation_variation_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 120, note: 'Creativity Tools P1b (2026-08-13) — static+deterministic: no-variation ≡ baseline at every hook (inert-by-default), every declared delta applied+clamped, varied package fields 5 skill. Demote to full once settled. NOTE: the P1b band A/B is an all-formations-forced-variation stress (lands ~24 pts, run-heavy low edge, in-band); AI never sets variations so the standing stat_realism reads identical.' },
  { name: 'replay_store_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 120, note: 'Creativity Tools / Viewer (2026-08-13) — the dedicated replay-clip store (js/engine/replays.js), the home Codex saves clips to. CRUD/cap/deep-clone/backup-ring-recovery, and ISOLATED from cfb-creator so big clips never crowd out playbooks/teams. Clip data shape is the viewer\'s; the store never inspects it. Demote to full once settled.' },
  { name: 'creator_store_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 120, note: 'Creativity Tools (2026-08-13) — the GLOBAL Creator library (js/engine/creator.js): CRUD/caps/overwrite-vs-edit/export-import/corruption for player creations. Deterministic, own localStorage polyfill. The store is coach/tree-independent on purpose (creations load into any world). Demote to full once settled. Grows as the four editor UIs land on top of it.' },
  { name: 'creator_world_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 150, note: 'Creativity Tools (2026-08-13) — the generateWorld(opts) source seam: under a seeded RNG, no-opts / {} / undefined / explicit-global-sources all byte-identical (inert-by-default); different-seed arm proves the snapshot is sensitive. The single door custom teams/leagues enter a world; injection NOT wired yet (league-blueprint shape spec first). Demote to full once settled.' },
  { name: 'compile_league_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 150, note: 'Creativity Tools (2026-08-13) — compileLeague(blueprint)→{schools,conferences} in world.js: loud required-field validation, seed blueprint builds a coherent world through generateWorld(compileLeague(bp)), abbr dedup even on author-set abbrs, state-centroid geo lands, replace mode stands up a full custom world, no-custom path inert. Ref/LEAGUE_BLUEPRINT.md is the shape. Demote to full once settled.' },
  { name: 'playbook_shape_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 120, note: 'Creativity Tools (2026-08-13) — the customPlaybook foundation (js/engine/playbook.js): concept-legality validation vs FORMATION_PLAYBOOK, formation/variation existence, apply→gameplan populates offFormations+formationPlaybooks and preserves the rest without mutating input, extract∘apply round-trip, and a built book drives simulateGame. The Playbook Builder UI mounts on this. Demote to full once settled.' },
  { name: 'd2d3_tiering_ab.mjs', tier: 'core', kind: 'node', timeoutSec: 60, seedFlaky: true, note: 'Season Mode Part B (2026-08-13) — the DEFAULT world now tiers its D2/D3 conferences (a per-conf prestige offset averaging ~0/division). Gates TEXTURE (between-conf variance >>flat baseline) + MEAN NEUTRALITY (division prestige mean preserved -> talent/balance unchanged; pos_ovr_census + stat_realism verified unmoved). Single unseeded gen so seedFlaky (one retry); bounds loose. Baselines: var D2 ~0.07/D3 ~0.03 pre, ~0.38/~0.23 post; mean D2 2.13/D3 1.61 held.' },
  { name: 'conference_prestige_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 120, note: 'Season Mode / Division Editor (2026-08-13) — conference PRESTIGE TIER distributes member-school prestige at compile (compileLeague): high tier -> strong schools, low -> strugglers, in the division band, for ALL divisions (gives D2/D3 the hierarchy they lack). Team prestige now OPTIONAL (distributed from tier if absent; explicit still wins). Editor/custom-content path only — the default procedural world (SCHOOL_DATA) is untouched, so no default-balance move. (Part B — making the DEFAULT world tier D2/D3 confs — is a separate balance-gated pass owing an A/B.)' },
  { name: 'blue_blood_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 120, note: 'Season Mode / Division Editor (2026-08-13) — the D1 blue-blood toggle in updatePrestige (season.js), knobs BLUE_BLOOD_FLOOR_DROP/DECLINE_MULT in C. INERT BY DEFAULT: no procedural school is flagged, so prestige_trajectory_probe stays green (verified). When flagged: floors near the top of the band, declines slower, still climbs, respects the cap. Recruiting edge is emergent (recruiting keys off prestige). Balance only moves when the editor sets flags (player-authored).' },
  { name: 'division_assembler_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 180, note: 'Season Mode / division-scoped leagues (2026-08-13) — assembleWorldSources(world.js): composes a world from per-division slots (static or a custom division blueprint) into the {schools,conferences} the generateWorld seam accepts. One slot = Season Mode single-division world; three = dynasty; mix custom+static per division. All-static reproduces the real division populations; abbrs deduped globally across divisions. Demote to full once settled.' },
  { name: 'season_persist_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 120, note: 'Season Mode (2026-08-13) — resumable persistence (seasonmode.js serialize/deserialize + localStorage wrappers): play part of a season, save, load into a fresh session, standings + results + progress cursor survive, and the restored session plays the rest to a champion. Corrupt save -> null. NOTE: full-D1 saves may need the IndexedDB path; serialize/deserialize is storage-agnostic. Demote to full once settled.' },
  { name: 'season_mode_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 200, note: 'Season Mode (2026-08-13) — the isolated single-season engine (js/engine/seasonmode.js): build a division -> generateWorld -> full regular season -> playoff -> champion, standings balance, reuses generateSchedule+simulateGame+updateStandings but NOT advanceDay/recruiting/offseason. NO-CAP arm: a 20-team conf + a 2-team conf + odd sizes still schedules and crowns a champion (verifies Ref/SEASON_MODE.md no-cap claim). Demote to full once settled.' },
  { name: 'creator_resilience_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 120, note: 'Creativity Tools gaps #1+#2 (2026-08-13) — LOAD-TIME REPAIR (creatorrepair.js: a creation authored against older game data gets removed formations/concepts/variations/route-parts/dead-bases dropped with a plain-English change list, clean creations untouched) + the cfb-creator BACKUP RING (creator.js: two-generation ring recovers the library from a corrupt primary). Deterministic, own localStorage polyfill. Demote to full once settled.' },
  { name: 'integration_creator_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 180, note: 'Creativity Tools (2026-08-13) — the full DRESS REHEARSAL: chains every Creator module through the pipeline a player uses — custom league -> library save/load -> compileLeague -> generateWorld -> custom playbook -> library save/load -> applyPlaybookToGameplan -> simulateGame (24 games), plus custom/composed play round-trips. Catches SEAM bugs the per-module unit probes miss. Demote to full once settled.' },
  { name: 'custom_play_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 120, note: 'Creativity Tools (2026-08-13) — the band-safe Play Composer Model A (js/engine/customplay.js): a custom play resolves to its base concept VERBATIM (all 62 concepts verified vs/exec-identical) so it is balance-identical by construction and cannot move a stat_realism band. Model B (grade authoring) is deferred pending owner ruling — Ref/PLAY_COMPOSER.md. Demote to full once settled.' },
  { name: 'play_compose_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 150, note: 'Creativity Tools (2026-08-13) — Play Composer Model B-i (js/engine/playcompose.js): the parts→grade rulebook. Owner-ruled B-i. Proves BAND (all ~1875 buildable 2/3-part plays + heaviest 5-stacks clamp into [BAND_LO,BAND_HI]), AI-INVISIBLE (compiling never writes PASS_CONCEPTS → human-call-only by construction), exec validity, and football-sense of the derivation. The parts vocabulary/coefficients ARE a balancing artifact — retune here, re-run this. Demote to full once settled.' },
  { name: 'defbook_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 60, note: 'Creativity Tools (2026-08-15) — Defensive Playbook engine (js/engine/defbook.js). Proves the customDefBook is a safe, lossless bundle of the defensive gameplan dials the sim already reads: validation gates every field vs DEF_FRONTS/AGGRESSION/PRESS_IDENTITY/coverage set; applyDefBookToGameplan writes exactly those fields, mirrors blitzPct from the aggression stop, and leaves the OFFENSE untouched; apply→extract round-trips; repair drops stale fronts/schemes. Pure-logic, no sim. Demote to full once settled.' },
  { name: 'star_player_probe.mjs', tier: 'core', kind: 'node', timeoutSec: 90, note: 'Creativity Tools (2026-08-15) — Team Editor phase 2 authored stars (coinStarPlayer/applyTeamStars in world.js). Proves calibers are ordered (Solid<Star<Superstar by compositeRating) and superstar is genuinely elite; identity (pos/class/name) honored + unknown pos falls back safely; applyTeamStars drops a named star onto a generated roster as the STARTER at its spot WITHOUT changing roster/position counts (swaps the weakest body), rebuilds the depth chart; empty/null is a no-op. If the talent scale or createPlayer shifts, recalibrate STAR_CALIBER here.' },

  // ── core: M25 finish-the-open-list (2026-08-10) — newest surface; demote
  //    to full once settled a few passes ──────────────────────────────────────
  { name: 'tipdrill_probe.mjs', tier: 'core', kind: 'node', args: ['6'], timeoutSec: 400, seedFlaky: true,
    note: 'M25 tip-drill INT chain — the chain checks pin Math.random and are deterministic, but the closing "live rate stays rare" check samples 4 UNSEEDED games and sits on its rarity boundary (observed 3/78 fail → clean pass on rerun, 2026-08-15) — hence seedFlaky. A REAL rate shift fails both tries and still gates.' },
  { name: 'tipdrill_ab.mjs', tier: 'core', kind: 'node', args: ['120'], timeoutSec: 900, seedFlaky: true,
    note: 'M25 feature A/B (NOT the per-pass swap A/B): INT drift up-and-small, PBU bounded by INTs gained, pts/comp%/plays flat. UNSEEDED (a pinned LCG phase-shifts the arms into different games) — hence seedFlaky.' },
  { name: 'presentation_live_probe.mjs', tier: 'core', kind: 'pw', timeoutSec: 500, seedFlaky: true,
    note: 'M25 structure laws: weather group + lawful kind, wear, band, both mascots, #watch-lower, state-leak law. Weather kind / lower-third content are sightings (seeded per matchup).' },

  // ── core: UI trio + build stamp ────────────────────────────────────────────
  { name: 'st_ui_smoke.mjs', tier: 'core', kind: 'pw', timeoutSec: 200 },
  { name: 'ui_playcall_smoke.mjs', tier: 'core', kind: 'pw', timeoutSec: 300 },
  { name: 'playnow_smoke.mjs', tier: 'core', kind: 'pw', timeoutSec: 300, seedFlaky: true, note: 'seedFlaky 2026-08-14: a full-game Playwright walk on fixed waitForTimeout delays — a modal occasionally lands outside its wait window and trips one check. Play Now verified working live on the converged tree; a REAL break fails both tries and still gates.' },
  { name: 'build_stamp_smoke.mjs', tier: 'core', kind: 'pw-dist', timeoutSec: 200 },

  // ── full: defensive call chain (passes 1–4) ────────────────────────────────
  { name: 'pass7_band_ab.mjs', tier: 'full', kind: 'node', args: ['300'], timeoutSec: 600,
    note: 'Prior-pass band A/B retained as deploy regression; Viewer Act 2 A4 now owns the CURRENT core swap slot.' },
  { name: 'defcall_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 400 },
  { name: 'covfam_probe.mjs', tier: 'full', kind: 'node', args: ['120'], timeoutSec: 600,
    note: 'N=120 for regression (~5 min); run default N=300 (~12 min cloud) only when coverage code changed' },
  { name: 'defmesh_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 400 },
  { name: 'rotation_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 400, envKnown: true,
    note: 'the "cloud:" WR1-short-share check is a STANDING TREE-STATE FAIL, not env: verified 2026-08-10 locally — deterministic (probe pins RNG), fails at 4.3% vs ctrl 4.9%, and STILL fails (4.7% vs 5.3%) with __noTipDrill restoring the exact pre-M25 stream. Expect exactly this one red in a local full run until the corner-force mechanism is retuned; any OTHER check reding here is real.' },
  { name: 'front_335_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 400 },
  { name: 'front_variants_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 400 },
  { name: 'front_5_2_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'gaplist_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'mug_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 400 },
  { name: 'greendog_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 400 },
  { name: 'crossdog_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 400 },
  { name: 'amoeba_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 400 },
  { name: 'creeper_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 600 },
  { name: 'pressure_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 900, note: '~10 min in cloud' },
  { name: 'blitz_reality_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'covsack_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 400, seedFlaky: true },
  { name: 'robber_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 400 },
  { name: 'zone_void_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300, envKnown: true, seedFlaky: true },
  { name: 'motion_struct_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300, envKnown: true, seedFlaky: true },
  { name: 'shell_identity_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300, seedFlaky: true },
  { name: 'leverage_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300, seedFlaky: true },
  { name: 'route_shape_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300, seedFlaky: true },
  { name: 'press_jam_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'coverage_monotonicity_check.mjs', tier: 'full', kind: 'node', timeoutSec: 240 },

  // ── full: offense engine (pass 5) + QB play ────────────────────────────────
  { name: 'rpo_conflict_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 400 },
  { name: 'choice_route_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 400 },
  { name: 'gadget_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 400, seedFlaky: true, note: 'pass-5 whole-game reads on the standing flaky list' },
  { name: 'checkdown_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'read_conflict_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'scramble_style_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'time_to_throw_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'qb_mobility_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'qb_power_rush_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'emergency_qb_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'run_scheme_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 400 },
  { name: 'yac_split_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'broken_tackle_check.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'snap_timing_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 240 },
  { name: 'int_accounting_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },

  // ── full: decision brain (pass 6) + situations + clock ─────────────────────
  { name: 'fourth_down_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 400 },
  { name: 'st_fake_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 400 },
  { name: 'st_net_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 400 },
  { name: 'st_coverage_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'special_teams_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 600 },
  { name: 'kicker_check.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'kicking_model_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'situational_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'kneel_timeout_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'clock_realism_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'formation_playbook_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 400, seedFlaky: true, note: 'seedFlaky 2026-08-14: the "control arm leans on the globally-featured play" check is a small-sample count (Mesh ~21-28 of ~150 short-game snaps) that flips run to run; verified flaky (21 FAIL / 25 / 28 PASS on a clean tree). A REAL playbook break fails both tries.' },
  { name: 'auto_formation_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 240 },
  { name: 'tendency_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'play_trace_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300, seedFlaky: true },
  { name: 'pass4_band_ab.mjs', tier: 'full', kind: 'node', timeoutSec: 600 },
  { name: 'pass5_band_ab.mjs', tier: 'full', kind: 'node', timeoutSec: 600 },
  { name: 'pass6_band_ab.mjs', tier: 'full', kind: 'node', timeoutSec: 600, seedFlaky: true, note: 'seedFlaky 2026-08-14: an amplified-vs-baseline passing-envelope A/B — the LIVE line drifts run to run (pts/comp%/plays all wander a point), so "AMPLIFIED INSIDE 2x ENVELOPE" is a boundary flake. A REAL band break fails both tries.' },

  // ── full: world / season / saves / career ──────────────────────────────────
  { name: 'worldgen_check.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'thin_roster_check.mjs', tier: 'full', kind: 'node', timeoutSec: 300, note: 'FIXED 2026-08-14: the old "best avail: 92 vs filler 90" red was a PROBE bug, not a game bug — its bestAvail counted players already assigned to another slot (a 92 TE playing TE) and specialists (K/P, which Pass 3 rightly excludes from an emergency QB fill). Corrected to compare against the best UNUSED non-specialist. Now 20/20. Game backfill logic unchanged.' },
  { name: 'recruiting_check.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'recruit_assist_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'recruit_tier_gate_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'tier_talent_check.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'commit_rate_test.mjs', tier: 'full', kind: 'node', timeoutSec: 600, note: 'timeout bumped 300->600 (2026-08-14): TIMED OUT on the 125-min overloaded full run (the Playwright-not-installed probes were each hanging to their own timeout, starving the box). With PW installed the run is normal-length; 600s is comfortable headroom.' },
  { name: 'funnel_test.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'progression_check.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'spring_dev_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'practice_career_impact.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'practice_weight_audit.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'career_firing_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'xp_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 240 },
  { name: 'balance_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'tree_trickle_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'midgame_save_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'save_safety_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 240 },
  { name: 'save_weight_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'warchest_serialization_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 240 },
  { name: 'fb_slot_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'instant_classic_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 300 },
  { name: 'coach_controls_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 400 },
  { name: 'part1_controls_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 400 },

  // ── full: UI smokes (playwright) ───────────────────────────────────────────
  { name: 'defcall_ui_smoke.mjs', tier: 'full', kind: 'pw', timeoutSec: 200 },
  { name: 'defcall_headset_smoke.mjs', tier: 'full', kind: 'pw', timeoutSec: 300 },
  { name: 'formation_playbook_ui_smoke.mjs', tier: 'full', kind: 'pw', timeoutSec: 200 },
  { name: 'formation_sheet_ui_smoke.mjs', tier: 'full', kind: 'pw', timeoutSec: 200 },
  { name: 'coach_mode_halftime_smoke.mjs', tier: 'full', kind: 'pw', timeoutSec: 300 },
  { name: 'polish_ui_smoke.mjs', tier: 'full', kind: 'pw', timeoutSec: 300 },
  { name: 'roster_position_sticky_smoke.mjs', tier: 'full', kind: 'pw', timeoutSec: 200 },
  { name: 'schedule_phone_smoke.mjs', tier: 'full', kind: 'pw', timeoutSec: 200 },
  { name: 'table_button_phone_smoke.mjs', tier: 'full', kind: 'pw', timeoutSec: 200 },
  { name: 'recruiting_board_phone_smoke.mjs', tier: 'full', kind: 'pw', timeoutSec: 200 },
  { name: 'phone_dial_guard_smoke.mjs', tier: 'full', kind: 'pw', timeoutSec: 200 },
  { name: 'raw_tag_phone_smoke.mjs', tier: 'full', kind: 'pw', timeoutSec: 200 },
  { name: 'playnow_saved_multiplayer_smoke.mjs', tier: 'full', kind: 'pw', timeoutSec: 300 },
  { name: 'playnow_spectator_smoke.mjs', tier: 'full', kind: 'pw', timeoutSec: 300 },
  { name: 'nav_back_smoke.mjs', tier: 'full', kind: 'pw', timeoutSec: 300, envKnown: true, note: 'one team-page back-nav check fails identically on pristine in cloud' },
  { name: 'letter_logo_ui_smoke.mjs', tier: 'full', kind: 'pw', timeoutSec: 300, envKnown: true, note: 'main-menu coach locator family (cloud)' },
  { name: 'saved_team_library_ui_smoke.mjs', tier: 'full', kind: 'pw', timeoutSec: 300, envKnown: true, note: 'main-menu coach locator family (cloud)' },
  { name: 'instant_classic_ui_smoke.mjs', tier: 'full', kind: 'pw', timeoutSec: 300, envKnown: true, note: 'main-menu coach locator family (cloud, documented pre-Pass-7)' },
  { name: 'timeout_screen_smoke.mjs', tier: 'full', kind: 'pw', timeoutSec: 300, envKnown: true, note: 'chip-write checks fail EARLIER on pristine (cloud, documented)' },
  { name: 'calendar_display_probe.mjs', tier: 'full', kind: 'pw', timeoutSec: 300, envKnown: true, note: 'wizard stalls at #btn-mm-newcoach in cloud' },
  { name: 'dna_cards_probe.mjs', tier: 'full', kind: 'pw', timeoutSec: 300, envKnown: true, note: 'discipline-flag checks fail identically on pristine in cloud' },
  { name: 'new_world_probe.mjs', tier: 'full', kind: 'pw-dist', timeoutSec: 400, envKnown: true, note: 'pre-existing wizard-walk failure in cloud (documented)' },

  // ── full: viewer (Codex M1–6; bundle from js/, no dist arg) ───────────────
  { name: 'position_gallery.mjs', tier: 'full', kind: 'pw-noarg', timeoutSec: 300 },
  { name: 'stadium_audio_probe.mjs', tier: 'full', kind: 'pw-noarg', timeoutSec: 300 },
  { name: 'action_animation_probe.mjs', tier: 'full', kind: 'pw-noarg', timeoutSec: 300 },
  { name: 'rb_anatomy_probe.mjs', tier: 'full', kind: 'pw-noarg', timeoutSec: 300 },
  { name: 'watchphys_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 400 },
  { name: 'watch_live_probe.mjs', tier: 'full', kind: 'pw', timeoutSec: 400, note: 'm14 version takes the built html arg' },

  // ── full: viewer M7–17 (Codex college-presentation chain, merged 2026-08-09)
  // galleries build their own bundle from js/ (no arg); *_live probes drive a
  // real PLAY NOW game on dist and are timing-flaky in the slow cloud box.
  { name: 'uniform_identity_probe.mjs', tier: 'full', kind: 'pw-noarg', timeoutSec: 300 },
  { name: 'presnap_stance_probe.mjs', tier: 'full', kind: 'pw-noarg', timeoutSec: 300 },
  { name: 'contact_authenticity_probe.mjs', tier: 'full', kind: 'pw-noarg', timeoutSec: 300 },
  { name: 'scheme_block_gallery.mjs', tier: 'full', kind: 'pw-noarg', timeoutSec: 300 },
  { name: 'pocket_protection_probe.mjs', tier: 'full', kind: 'pw-noarg', timeoutSec: 300 },
  { name: 'route_coverage_probe.mjs', tier: 'full', kind: 'pw-noarg', timeoutSec: 300 },
  { name: 'qb_mechanics_probe.mjs', tier: 'full', kind: 'pw-noarg', timeoutSec: 300 },
  { name: 'tackle_setup_probe.mjs', tier: 'full', kind: 'pw-noarg', timeoutSec: 300 },
  { name: 'st_mechanics_probe.mjs', tier: 'full', kind: 'pw-noarg', timeoutSec: 300,
    note: 'Codex shipped this named special_teams_probe — renamed to avoid clobbering the ENGINE st stats probe' },
  { name: 'kickoff_orientation_probe.mjs', tier: 'full', kind: 'pw-noarg', timeoutSec: 300 },
  { name: 'defensive_alignment_probe.mjs', tier: 'full', kind: 'pw-noarg', timeoutSec: 300 },
  // viewer M18–19 (merged 2026-08-09): full-unit ST + possession fix + locomotion
  { name: 'special_teams_animation_contract.mjs', tier: 'full', kind: 'node', timeoutSec: 240, note: 'fast source contract — M18 11-v-11 ST markup' },
  { name: 'live_score_kickoff_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 400, note: 'M18 possession-integrity fix (engine-adjacent — keep green)' },
  { name: 'locomotion_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 240, note: 'M19 deterministic controller contract' },
  { name: 'locomotion_live_probe.mjs', tier: 'full', kind: 'pw', timeoutSec: 400, seedFlaky: true },

  // viewer M20 (2026-08-09): contact truth wiring + synchronized contact
  { name: 'contact_truth_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 400,
    note: 'M20 sim-truth staging contract (tackler/assist/break/strip/pile) — pins Math.random, deterministic by construction' },
  { name: 'contact_sync_live_probe.mjs', tier: 'full', kind: 'pw', timeoutSec: 500, seedFlaky: true,
    note: 'M20 live contact laws: proximity-gated impact, grounded holds, engaged pairs meet + face' },
  { name: 'frame_budget_probe.mjs', tier: 'full', kind: 'pw', timeoutSec: 500, seedFlaky: true,
    note: 'M20 standing perf gate vs tools/_frame_budget_BASELINE.json (baseline recorded pre-M20, same-env comparisons gate; re-baseline deliberately, never casually)' },

  // viewer M21 (2026-08-09): ball ownership + flight (ball truth wiring)
  { name: 'ball_truth_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 400,
    note: 'M21 ball-ownership contract (snap/mesh/PA fake/PBU deflection/pick truth/fumble bounce) — pins Math.random, deterministic by construction' },
  { name: 'ball_flight_live_probe.mjs', tier: 'full', kind: 'pw', timeoutSec: 500, seedFlaky: true,
    note: 'M21 live ball laws: hands meet ball at the catch point (KEY check), carried ball in the hands band, aim noses along the flight. Phase absence under throttled rAF is reported, never failed.' },

  // viewer M22 (2026-08-10): broadcast camera + replay presentation
  { name: 'camera_plan_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 400,
    note: 'M22 camera-plan contract (pinned pre-snap / leading anchors / contextual zoom / turnover settle / TD hold / budget-neutral replay warp) — pins Math.random, deterministic by construction' },
  { name: 'camera_live_probe.mjs', tier: 'full', kind: 'pw', timeoutSec: 500, seedFlaky: true,
    note: 'M22 live framing laws: motionless cadence, no pan whips, ball containment, ST band. Replay/ST phase absence under throttled rAF is reported, never failed.' },

  // viewer M23 (2026-08-10): stadium life + broadcast presentation
  { name: 'officials_plan_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 400,
    note: 'M23 officials contract (3-man crew / stand-off law / sideline LJ / signals / 22-actor cast untouched) — pins Math.random, deterministic by construction' },
  { name: 'broadcast_live_probe.mjs', tier: 'full', kind: 'pw', timeoutSec: 500, seedFlaky: true,
    note: 'M23 live stadium laws: officials present + never inside the play, legal down box, fan sections, goalposts, parallax correlation. Banner/roar/wipe/net-shake are sightings — absence under throttled rAF never fails.' },

  // viewer M24 (2026-08-10): variation + optimization (program close)
  { name: 'variety_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 400,
    note: 'M24 variety contract (situation-lawful celebrations / real variety / mob ids / winded law + timing) — pins Math.random, deterministic by construction' },
  { name: 'variation_live_probe.mjs', tier: 'full', kind: 'pw', timeoutSec: 500, seedFlaky: true,
    note: 'M24 regression laws from the goals doc: NO animation-state leakage into a fresh play (gated), both orientations, end-zone stability. Variant/panning/lite are sightings — absence under throttled rAF never fails.' },
  { name: 'pocket_live_probe.mjs', tier: 'full', kind: 'pw', timeoutSec: 400, seedFlaky: true },
  { name: 'route_live_probe.mjs', tier: 'full', kind: 'pw', timeoutSec: 400, seedFlaky: true, note: 'needs a pass-heavy game; retries clear it' },
  { name: 'qb_live_probe.mjs', tier: 'full', kind: 'pw', timeoutSec: 400, seedFlaky: true },
  { name: 'tackle_live_probe.mjs', tier: 'full', kind: 'pw', timeoutSec: 400, seedFlaky: true },
  { name: 'special_teams_live_probe.mjs', tier: 'full', kind: 'pw', timeoutSec: 400, seedFlaky: true, envKnown: true,
    note: 'M18 narrowed kick-phase windows (±0.13t); throttled cloud rAF jumps them — each phase verified individually in cloud, all four together verified on a local machine 2026-08-09' },
  { name: 'field_state_live_probe.mjs', tier: 'full', kind: 'pw', timeoutSec: 400, seedFlaky: true },

  // ── night tier: the CPU giants, deferred by owner request (2026-08-10 —
  //    they were crawling the working machine mid-day). NOT run by core or
  //    full; full lists them as deferred. Run `node tools/_gate.mjs night`
  //    when the machine is free (end of day), and before a deploy. localOnly
  //    still marks them unrunnable in the cloud container. ────────────────────
  { name: 'h2_shadow_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 3600, localOnly: true, night: true,
    note: '1500-game arms; 40+ min even solo in cloud — run on a real machine, at night' },
  { name: 'recruit_calendar_probe.mjs', tier: 'full', kind: 'node', timeoutSec: 1800, localOnly: true, night: true,
    note: 'whole-season sims; CPU-bound — run at night' },
];
