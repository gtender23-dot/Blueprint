# DISPATCH PLAN — Build Order v2 (2026-08-17)

One block per unattended session. Paste a block VERBATIM as the session's
prompt (each is self-contained and tells the session what to read first).
Milestone map: D1=M0 · D2=M1 · D3+D4=M2 · D5+D6=M3 · D7=M4 · D8+D9=M5.

Dependency order:

| block | needs | parallel-ok with |
|---|---|---|
| D1 (M0 sweep) | nothing | anything |
| D2 (M1 bench) | nothing | D1, D7 |
| D3 (M2 engine) | — (D1's linter is nice-to-have first) | D2 |
| D4 (M2 cards) | **D3** | — |
| D5 (M3 audit, report-only) | nothing | anything |
| D6 (M3 build) | **D5 ratified by owner + D4** | — |
| D7 (M4 controls) | nothing | D1, D2 |
| D8 (M5 plan home + Seasons) | **D3/D4** (book schema settled) | D7 |
| D9 (M5 defbook close-out) | D8 (or alongside) | — |

Owner-machine work does NOT block dispatching — every D-block is cloud-safe,
so keep firing them even when the machine is hours away. The local steps
batch into ONE sitting whenever the owner is next at the machine: full local
gate, the act B/D local scrub, the Stages 3–7 visual eyeball (rides the
FIRST D2 bench session), and kick off `node tools/_gate.mjs night` on the
way out the door — it's built to run while the machine is free. Nothing
DEPLOYS before that sitting; everything else proceeds. Sessions: put every
owner-owed item under one **OWNER CHECKLIST** heading at the top of your
STATUS entry, so the backlog reads as a single list at that sitting instead
of being scattered per-section.

Standing laws baked into every block (sessions must obey): edit `js/` +
`style.css` only, never a built file; node gates in-session (clean esbuild
bundle + named probes ×3; new probes registered in the CORE manifest);
browser verification is OWED to the owner — ledger it; update `Ref/STATUS.md`
(dated section at top: what shipped, gates run, browser-owed); commit scoped
to your own files via the `_to_delete` lock workaround if possible, NEVER
push. The M1 bench is a PLAY-DESIGN instrument — no scouting hooks, no
opponent practice, no lesson layer (owner boundary 2026-08-17).

---

## D1 · M0 SWEEP (no design calls)

Read CLAUDE.md, then Ref/STATUS.md (BUILD ORDER v2 → M0), then obey both.
Ship the pulled-forward sweep:

1. Screen WAKE LOCK while watching a game (#7): `navigator.wakeLock('screen')`
   acquired when the watch viewer opens, re-acquired on visibilitychange,
   released when the viewer closes. Feature-detect + try/catch (safe no-op
   where unsupported). No wake-lock code exists today.
2. Replay ON/OFF toggle in the watch controls (#9), persisted setting,
   default on.
3. THE CARD LINTER (new probe, `tools/card_lint_probe.mjs`, register in
   CORE): walk EVERY (formation × variation × concept) card render and
   assert football legality — no slot body in the FB spot, QB depth matches
   the look's under/pistol/gun, personnel count matches the pkg,
   strength/flip convention matches the fielded slots (viewer orientation,
   #49), every element in bounds. Then FIX every authored row it flags —
   known offenders: Spread Ace draws shotgun+RB-behind (#18), Pistol Diamond
   puts a slot WR in the FB spot (#20), plays drawn flipped vs the viewer
   (#49). Hand-review Red-Zone Fade art vs its concept definition (#19).
4. Mobile overflow: new-game custom-division conference header (#5);
   Defensive Playbook pressure controls (#32).
5. Defensive graphics, no-design half only: DE/RE/LE label consistency
   across front diagrams (#31); bring 3/4/5/6 changes the def call card's
   rush-arrow count (#33 graphic half — `renderDefCallCard` already draws
   from bring). Do NOT touch sim rush behavior — the bring-3-on-a-4-man-line
   audit is D9.

Gates: clean esbuild + CSS parse; `card_lint_probe` ×3 green; re-run
`draw_up_probe`, `formation_compose_probe`, `defbook_probe`,
`play_fidelity_probe`. Update STATUS. Browser-owed ledger: phone eyeball on
#5/#32, wake lock on a real phone, replay toggle in a live game.

---

## D2 · M1 THE TEST BENCH (the instrument)

Read CLAUDE.md, then Ref/STATUS.md (BUILD ORDER v2 → M1), then obey both.
Owner boundary: the bench is a PLAY-DESIGN instrument ONLY — no scouting, no
opponent hooks, no lessons. Build:

1. ENGINE: `bench(formationId, variation, playOrConcept, defensiveLook)` runs
   ONE play between two even-matched scratch teams (deterministic generated
   rosters, flat caliber; NOTHING persisted to any save) through the real sim
   + the real watchphys viewer, honoring `forcedCall` (+ variation) on
   offense and a forced defensive call — front + coverage (the 8-picture
   catalog) + bring 3/4/5/6 — via the existing defCall vocabulary.
2. CONTROLS: "RUN AGAIN" (fresh RNG) and "SAME ROLL AGAIN" (pinned PRNG —
   the probes' seeded-stream trick). One result line per rep: the call, the
   coverage rolled, the outcome (yards / result).
3. THREE ENTRANCES: the Play Composer (test the play being built); the
   Formation Designer (on save, auto-install every fitting concept, then
   open the bench on it); the Playbook Builder's formation/play cards (test
   any BUILT-IN look/concept — required so M2's fidelity fixes can be
   verified on the bench).
4. ONE SHARED FITS-FUNCTION: extract Stage 7's `compileFormation` call-list
   filter (minWR, backfield structure, options-need-two-backs, no
   Wildcat/Jet for customs) into one exported helper. Designer auto-install,
   Builder auto-select (#23: selecting a formation auto-selects its fitting
   plays, deselect freely), and the bench's play list ALL call it.
   Auto-select seeds the formation's shipped sheet weights, NOT flat ones.

Gates: clean esbuild + CSS; new `bench_probe` ×3 (a known play vs a forced
look runs, deterministic under the pinned seed, zero save writes, teams
even); re-run `formation_compose_probe`, `play_compose_probe`,
`live_book_call_probe`, `record_call_probe`, `watchphys_probe`. Update
STATUS. Browser-owed: the owner's first bench session doubles as the
Stages 3–7 visual eyeball — say so in the ledger.

---

## D3 · M2 ENGINE HALF (per-look sheets — BAND-GATED)

Read CLAUDE.md, then Ref/STATUS.md (BUILD ORDER v2 → M2), then obey both.
OWNER DECISIONS — CONFIRMED 2026-08-17, build to these, no further ask:
(a) variation pkg ALWAYS wins when fielding personnel;
(b) Empty looks get a REAL empty pkg (backs genuinely off the field).

1. PER-LOOK SHEETS, INHERIT-WITH-OVERRIDE: a (formation, variation) look
   without its own sheet inherits the formation sheet BYTE-IDENTICALLY;
   editing forks it. Re-key `TeamBook.sheets` accordingly; the sim's
   `_fpbSheet` overlay + FORMATION_PLAYBOOK legality resolution go through
   one resolver with the inheritance fallback. Builder UI: editing a look's
   plays edits THAT look (#43 — today one edit echoes into every variant).
2. PERSONNEL: implement decisions (a) and (b) — one truth for pkg
   consumption (CREATOR_FIDELITY engine items 1–2), probe-proven.
3. MIGRATION SWEEP: `repairCreation` maps existing books losslessly (old
   book = base sheets only — trivial under inheritance); sweep
   `playbook_shape_probe`, overlay `PLAN_BOOK_STRUCT_FIELDS` concept
   weights, quick-slots A/B/C, `aiFormationSheets`, the FORMATION_PLAYBOOK
   gate. Old SAVES may die (root-architecture §5b); the CREATOR LIBRARY may
   not.
4. TWO PROOFS, SEPARATED: (i) sheets alone are byte-neutral — a no-override
   book under pinned PRNG plays byte-identical pre/post (inheritance law);
   (ii) the pkg change is a DELIBERATE behavior change — measure it with
   before/after distributions (personnel fielded per look, Empty snaps), not
   a byte proof.

Gates (this is outcome-bearing — the full band battery): `tendency_probe`,
`playcall_probe`, `play_fidelity_probe`, `playbook_root_probe`,
`plan_side_probe`, `defcall_probe`, `compile_league_probe`,
`save_migration_check`, `integration_creator_probe`, plus a new/extended
per-look probe ×3 covering inheritance, forking, repair, and the pkg truth.
Run `stat_realism_harness` if this environment can; else ledger it
OWED-LOCAL. Update STATUS with before/after numbers for the pkg change.

---

## D4 · M2 PRESENTATION HALF (cards + overlay + composer runs) — needs D3

Read CLAUDE.md, then Ref/STATUS.md (BUILD ORDER v2 → M2), then obey both.

1. Every card render site draws the SPECIFIC look being called (#12/#14):
   call sheet pins + drill-down + INFO, Builder cards, Game Plan looks, MY
   PLAYS, THE CALL card, Film Room.
2. REAL ESTATE: nested/expandable play-card screens so every man's job fits,
   OL blocking included (#16) — big card view with full assignments.
3. THE COMPOSER GROWS RUNS + BLOCKING authoring (the rest of #37): run play
   type with path + blocking-scheme signature, blocking assignments on pass
   plays; all through the proven band-clamped `compilePlay` grader — extend
   `play_compose_probe` / `custom_play_probe`.
4. PRE-SNAP PLAY-ART OVERLAY in the watch viewer (the Madden trust device):
   the called play's card art draws over the fielded players before the
   snap — same authored rows as the cards (Stage 6 tables), so card↔field
   agreement is visible every snap. Replays + Film Room inherit.
5. CONCEPT BLURBS: one purpose line per concept card — "what it is · what it
   does · what it risks" (the def-card subtitle grammar). Help-language
   rules bind: football words, NO numbers/weights. Covers #21 (what Reverse
   is, the sluggo-seam change, flea-flicker, HB pass) + add the missing
   manual chapters for the Workshop / composed plays / books.

Gates: clean esbuild + CSS; `card_lint_probe` ×3 (now covering the new
sites), `draw_up_probe`, `watchphys_probe` FULLY GREEN, `record_call_probe`,
`live_book_call_probe`, extended compose probes ×3. Update STATUS.
Browser-owed: bench-verify #18/#19/#20/#49 fixed; overlay eyeball in a live
game.

---

## D5 · M3 AUDIT (report-only — STOPS for owner)

Read CLAUDE.md, then Ref/STATUS.md (BUILD ORDER v2 → M3), then obey both.
NO outcome-code changes in this session. Deliverable is a report.

1. INSTRUMENT the sim: per QB archetype (scrambler / dual / pocket — map
   what the engine actually distinguishes), count designed QB runs,
   scrambles, and RPO give/keep/throw per game across a multi-season simmed
   sample. First map what the concept vocabulary even distinguishes today —
   that mapping is a finding on its own.
2. REFERENCE RATES: compile real college rates (start from
   `Ref/SOURCE_LIBRARY.md`; cite anything added; if network research is
   unavailable here, ledger it).
3. REPORT `Ref/RPO_AUDIT_2026-08-<day>.md`: our rates vs real, the gap, and
   a recommended design — a hand-AUTHORED RPO/QB-run play family with its
   own routes (#45), an RPO+QB-run type (#46), AI call rates keyed to QB
   archetype, defensive counters (spyQB / edge discipline) verified to
   answer it — with an estimated band impact. End the report with the open
   design decisions, cleanly listed for a phone read.

Then STOP. D6 does not dispatch until the owner ratifies the report.

---

## D6 · M3 BUILD (needs D5 ratified + D4)

Read CLAUDE.md, then Ref/STATUS.md (BUILD ORDER v2 → M3), then
`Ref/RPO_AUDIT_*.md` (the ratified design), then obey all three. Build the
authored RPO / QB-run family exactly per the ratified audit: own routes
(#45), RPO+QB-run play type (#46), designed-QB-run + RPO rates keyed to QB
archetype at the audit's targets, defensive counters verified (spyQB /
edgePlay respond). Never "any run play becomes a QB run." Full band battery
like D3 (tendency, playcall, play_fidelity, compile_league, integration,
save_migration; stat_realism or ledger OWED-LOCAL) + a new `rpo_probe`
(rates hit targets by archetype, counters bite, band clamps hold) ×3.
Bench-testable: the family runs on the M1 bench vs picked fronts/coverages.
Update STATUS with before/after rate tables.

---

## D7 · M4 WATCH / TIME CONTROLS

Read CLAUDE.md, then Ref/STATUS.md (BUILD ORDER v2 → M4), then obey both.

1. 3-LEVEL INVOLVEMENT TOGGLE — watch every play / coach big moments /
   coach every play — changeable MID-GAME; replaces the two Ride-the-Plan
   buttons (#51). Big-moment SPEC (interrupt PRE-SNAP with the call sheet
   open): 4th downs, red-zone trips, inside 2:00, one-score 4th quarter.
   Turnovers + scores are watch moments only, no interrupt.
2. TRANSPORT ROW: skip play · sim possession skipping the animation (#54) ·
   sim to half / sim to end (#55) · take control next snap. Fix the dead FF
   button; REMOVE Tempo from the time controls — it's hurry-up/chew-clock
   strategy and lives with the game plan (#51).
3. Skipped stretches emit DRIVE-SUMMARY lines into the play-by-play feed —
   never silence.
4. LAW: sim-to-half/end resolves the halftime token through the EXISTING
   pause path; `gamePauseIsLive` remains the ONLY serialization gate; add NO
   new save path (see CLAUDE.md save-system section — this shipped broken
   once).
5. PRESENTATION settings group: replay frequency Off/Low/High (absorbs the
   D1 toggle), home for future presentation options. Landscape→camera-views
   (#25) stays stubbed until the camera acts land — note it, don't build it.

Gates: clean esbuild + CSS; new `timecontrol_probe` ×3 (toggle levels
honored; sim-possession/half/end land the correct game state + records;
pause law asserted — no serialized pause); `midgame_save_probe`,
`season_persist_probe`, `playnow_smoke` if runnable here (else ledger).
Update STATUS. Browser-owed: phone eyeball of the new controls in a live
game.

---

## D8 · M5 GAME-PLAN HOME + SEASONS (needs D3/D4)

Read CLAUDE.md, then Ref/STATUS.md (BUILD ORDER v2 → M5), then obey both.
Organizing principle (ratified): the BOOK is the persistent object; the game
plan is overlays on it (FM tactic-vs-touchline).

1. EMBEDDED EDITABLE PLAYBOOKS in dynasty + season (#39): edit the carried
   book in-career; edits save to the LEAGUE save; a "push to Workshop"
   button copies back to the library AND RESTAMPS the source identity
   (`sourceSaved` / `_bookSourceSaved`) so the Stage-3 update banner cannot
   fire about your own push; editors force re-synthesis on save (the
   Stage-3 seam exists).
2. Move OFFENSIVE IDENTITY into the plan home; add the DEFENSIVE identity
   panel beside it.
3. Formation-usage dials live here; COLLAPSED graphics (#3); better simple
   game-planning look (#41).
4. DIAL REDISTRIBUTION (#39 brainstorm made concrete): BOOK properties
   (formation usage, sheets) live with the book; WEEK properties (tempo,
   aggression, situations) stay in the controller. Write the resulting map
   into STATUS for owner sign-off before moving anything contentious.
5. SEASONS: playbook + DEFENSIVE book + starting options at setup (#27 —
   parity with new-game's pickers); strip recruiting settings from Season
   Mode (#29 — it already runs no-recruiting; likely stray settings only).

Gates: clean esbuild + CSS; `book_update_probe` EXTENDED (push restamp
asserted: push → no self-banner; edit-in-career → league save carries it;
round-trip) ×3; `playbook_root_probe`, `plan_side_probe`,
`season_persist_probe`, `save_migration_check`. Update STATUS.
Browser-owed: in-dynasty edit → push → Workshop shows it; season setup
pickers.

---

## D9 · M5 DEFBOOK CLOSE-OUT (with or after D8)

Read CLAUDE.md, then Ref/STATUS.md (BUILD ORDER v2 → M5), then obey both.

1. BRING-3 AUDIT (#33, the sim half): with a 4-man front and bring 3, does
   the engine genuinely drop a lineman (fire-zone exchange — `rush3` path)?
   Trace `applyDefCall` → sim; fix if not; the card must show the same
   exchange the sim runs. Probe it.
2. PAY THE DEFBOOK V2 PROBE DEBT (standing ledger from 2026-08-15): EXTEND
   `defbook_probe` with the v2 asserts — shelves/answers validation gates,
   shelf→defCalls (cap 12, name dedupe), shelf→cells writes DEF FIELDS ONLY
   preserving a cell's offensive keys, answers→formChecks, v1→v2 repair
   (no loss), starter-book round-trip. NEW `defsheet_probe` — every
   DEFAULT_DEF_BOOK validates, has ≥1 base-shelf card, compiles, and each
   card's fields resolve through `applyDefCall`'s vocabulary; every
   DEFAULT_OFF_BOOK validates + every sheet entry legal. Re-run
   `creator_store_probe` + `creator_resilience_probe`.

Gates: the two probes ×3 green + the re-runs; clean esbuild + CSS. Update
STATUS (this closes the "DEFENSIVE PLAYBOOK V2 ⚠ VERIFICATION OWED" ledger
items that node can reach; the live click-through stays browser-owed).
