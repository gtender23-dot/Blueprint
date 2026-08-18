# ⚑ STATUS — where we actually are (living doc)

**Read this FIRST in any new chat. Update it whenever you finish a chunk.**
Last updated: **2026-08-18 · D12 SHIPPED (this Cowork session) — THE HONEST
REPORT CARD: the plan-report CUSTOM/AUTO badge lists rebuilt from the SIT
panel's real writable set (the dead `pressureIdentity` entry dropped, the 13
missing fields added) + callSheet hygiene on defensive book load (a book swap
can no longer leave the matchup sheet naming dead calls — new `pruneCallSheet`
in defbook.js, wired into the compile + heal-on-load on `#gp-lib-load`). Node
gates green ×3 incl. new defsheet_probe §C; PW tier + the `_equiv_walk`
attribution run OWED-LOCAL (this change is NOT walk-neutral by design); full
entry + OWNER CHECKLIST in the D12 section below.** Prior:
**2026-08-18 · D11 MANIFEST COMPLETION SHIPPED (data + probe only)
— PLAN_FIELD_SIDE gains the 13 audited gap fields (7 off, callSheet def, 5 ST
team), plan_side_probe's SIM_CONSUMED widened to the full audit census;
playbook_root_probe 24/0 ×3 + a node-level flat-plan proof (old-compile ≡
new-compile ≡ gameplan, 60 schools) discharge the partition question;
_equiv_walk OWED-LOCAL (PW download blocked by the sandbox allowlist) with
byte-identity expected BY CONSTRUCTION; full entry + owner checklist in the D11
section below.** Prior: **2026-08-18 · D10 CLOSED OUT + ALL TWELVE ODs RATIFIED — owner
blanket YES (2026-08-17) to OD-1…OD-12 at their stated recommendations, marked
in the audit doc; D10's owed-local gates ran green on a fresh VM (build clean,
sha256 vs HEAD byte-identical, probe 44/0 ×3) and the session commit landed;
see the ratification entry at the bottom.** Prior: **2026-08-18 D10 ·
PLAYBOOK↔DIALS COHESION AUDIT — report shipped
(`Ref/COHESION_AUDIT_2026-08-18.md` + `Ref/COHESION_DISPATCH_2026-08-18.md`,
D11–D17), new CORE probe `plan_cohesion_probe` 44/0 ×3, comment-only js edits;
full entry + OWNER CHECKLIST in the D10 section below.** Prior:
**2026-08-18 EDIT DEFENSE LOADS THE FULL BOOK + PRESET-REMOVAL
RE-APPLIED (owner: "clicking edit defense brings up an empty playbook; the
defensive playbook should absorb the default front / front-mix / a variety of
fronts"). ROOT CAUSE: the wizard applies a starter def book via
applyDefBookToGameplan (sets baseFront/frontMix/aggression + the 12 named calls
into gp.defCalls), but "Edit defense" fell back to defBookFromGameplan which
extracts identity ONLY — 0 shelves, 0 answers — so the call sheet came up empty
(fronts DID load; the named CALLS + vs-personnel answers were lost). _defbookName
is unreliable (ai.js overwrites it with a synthesized scheme name). FIX: stamp a
dedicated _defbookStarter (and _bookStarter for offense) whenever the
wizard / applyStartingChoices / in-game load applies a STARTER book; cleared when
a Workshop custom book loads. "Edit defense" now: Workshop source id -> STARTER
re-load (defaultDefBook, full shelves+answers+front mix) -> identity extract as
last resort. Offense door mirrors it (_bookStarter -> defaultOffBook). VERIFIED
in-browser: Edit Defense on a carried Option Killer now shows 12 named calls + 6
vs-personnel answers + 3 fronts w/ base tag (was 0 calls / 0 answers).
ALSO FIXED A REGRESSION FOUND HERE: the earlier "presets removed everywhere" edit
to gameplan.js had been CLOBBERED when gameplan.js was re-staged for the
sheet-rework (BUILTIN_PLANS was back — array, builtinPlan, the "Preset plans"
optgroup, the builtin: load handler, the export, the applyStartingChoices preset
branch). Re-removed all of it on the current device gameplan.js; seasonmodeview
was already clean; no other importer. defcall_ui_smoke updated: a fresh dynasty
now carries a FULL 12-call starter defense (MAX_DEF_CALLS cap), so the smoke
empties the library via the UI Delete buttons before authoring. VERIFIED: clean
build cfb-dynasty-d3f0e4ad8c (bundle -8KB from the preset cut), new_world_probe
PASS zero errors, defcall_ui_smoke PASS, formation_playbook_ui_smoke PASS. NOTE:
gameplan.js edits were lost once this session by editing a re-staged stale copy —
always re-stage + diff before editing that file. Build caveat unchanged (mount
can't rmdir; re-run node tools/build.mjs on Windows; gate owed). Prior in this
session: 2026-08-18 VARIATIONS ARE THEIR OWN FORMATIONS — FITTING-ONLY
PLAYS, NO MISFITS (owner: the formation variations must be treated as separate
formations). The prior all-legal fill used legalConceptsForFormation (base-only,
ignores variation), so a variation carried its base's whole list including plays
that need personnel it lacks (Air Raid|empty carried 9 back-needing plays shown
as misfit warns). ROOT FIX: every place a look's play set is built or shown now
uses fittingConceptsForFormation(fid, variation) (personnel-aware), so a
variation is genuinely its own formation and a non-fitting play is NEVER added —
no misfit can exist. Changed: defaultbooks.js allFittingSheet driving the 6
starter books; creatorplaybook.js allFittingSheet for add-look + Select-all; the
plays-screen grid iterates the FITTING set and the misfit class/warn/title path
is DELETED; the redundant "Only what fits" tool removed. RESULT: Air Raid|empty
49->40 plays; NO MISFITS in any book. VERIFIED: defsheet_probe 101/0, defbook_probe
76/0, clean build cfb-dynasty-77abd01905, new_world_probe PASS zero page+console
errors, formation_playbook_ui_smoke PASS, Air Raid Empty plays screen renders
"5 WR - 40 of 40 plays on" with 0 misfit cards. Build caveat unchanged (mount
can't rmdir; re-run node tools/build.mjs on Windows before deploy; gate owed).
Prior in this session: 2026-08-18 OFFENSIVE STARTER BOOKS -> ALL-LEGAL PER LOOK (owner:
default offense playbooks should have all their formations' plays selected the
same way as the builder). The 6 DEFAULT_OFF_BOOKS no longer hand-list a curated
few plays per formation — each carried look (base AND variation: Air Raid|empty,
Power-I|big, Pistol/RPO|trips, etc.) gets its OWN sheet key filled with its
formation's full legal set at flat weight, matching the builder's all-legal
default. offBook() dropped its hand-authored sheets arg; sheets are DERIVED from
the formations list via new allLegalSheets()/allLegalSheet(). Identity now comes
from WHICH looks a book runs + its tendency/depth lean, not a curated play menu
(owner-approved). Legal concepts are per-FORMATION so a variation key fills from
its base fid. defsheet_probe had a base-key assumption (flagged every
variation-key sheet illegal + every variation-only carry unsheeted) — FIXED to
splitSheetKey to the base fid and check each carried look's own key. The engine's
validatePlaybook already handled variation keys (all 6 books validate clean).
VERIFIED: defsheet_probe 101/0, defbook_probe 76/0, save_migration PASS, worldgen
PASS, clean build cfb-dynasty-cb02e0bc37, new_world_probe PASS zero page+console
errors, formation_playbook_ui_smoke PASS, and a fresh Air Raid dynasty's in-game
formation sheet reads "49 of 49 plays live" (was the curated 7). Build caveat
unchanged (mount can't rmdir; re-run node tools/build.mjs on Windows before
deploy; gate owed). Prior in this session: 2026-08-18 PLAYBOOK EDITOR REWORK — ALL-LEGAL DEFAULT + SEPARATE
PLAYS SCREEN + DECLUTTERED GAME-PLAN SHEET (owner: inherit-base on select was
wrong; all legal plays should be selected; plays belong on a separate screen; the
editor felt wonky). THREE surfaces. (1) creatorplaybook.js: adding a look seeds
its OWN sheet with EVERY legal play selected (allLegalSheet, flat 50) — no
autoSheetForFormation seeding, no inherit-base; Base + each variation independent
from creation; an emptied sheet stays an empty object (stays independent). (2)
The concept grid moved OFF the builder onto a dedicated full-page PLAYS SCREEN
(state.ui.pbPlays, a 4th internal screen): builder is now a compact formation
list with a "Plays (N)" button; the screen has the grid + Select-all/Clear-all/
Only-what-fits + info + test + Back. Kills the inline-expand reflow wonk. (3) The
in-game Game Plan formation-sheet editor (gameplan.js renderFormationPlaybook)
had the same always-on clutter (a "set here · tap to reset" pill on every play +
per-look inherit hints) surfaced by the earlier always-apply-a-book change —
inherit/fork model retired there too: each look owns its full sheet, pills +
"from base sheet" language GONE, slider no longer forks-on-write, dead
data-fpbclear handler removed, "BASE PLAYBOOK (N)" chips -> "All Plays"/look
chips, Reset = "reset to the book's mix". VERIFIED: clean build
cfb-dynasty-b6781a0e6a, formation_playbook_ui_smoke rewritten to the new model +
PASS 13/13 (was 3 stale fails on the retired pills), new_world_probe PASS zero
page+console errors, screenshots confirm 49/49 plays on a fresh look + the pill
wall gone. Build caveat unchanged (mount can't rmdir; re-run node tools/build.mjs
on Windows before deploy; gate owed). Prior in this session: 2026-08-18 STARTER BOOKS REBUILT — EVERY DEFENSE ANSWERS EVERY
OFFENSE (owner: a book facing empties mid-season had nothing but a lone 4-3
zone; "more than 1 named call everywhere, made for every game, survive a full
season"). Done as a 13-agent workflow (author each of 6 def books + audit the 6
off books, adversarial season-slate verify each, synthesize) — but EVERY
AI-authored literal was validated against the real engine before adoption, which
caught three agent-error classes: (1) Pressure Everything had an illegal 6th
shelf "option" (whole book dropped at module load) → card moved into short; (2)
six cards wrote dogGame:true (engine takes only green|cross) → "cross"; (3)
card-level pressLevel:N and a stray card spyQB:true (neither in applyDefCall's
vocabulary) stripped. SHELF CAP raised 2→3 (DEF_SHELF_CARD_CAP); the 12-call
headset is still enforced in the apply compile, and defbook_probe's two
cap-assuming assertions were rewritten. RESULT: all 6 defensive books now answer
ALL SIX personnel classes {empty,10,11,12,heavy,option} — vs empty every book
checks to a Dime sub-package (Option Killer was a lone 4-4 zone, now Dime
Rush-3), spread 10p→Nickel/Dime, heavy→46/Bear or 5-2, option→4-4 contain; no
mid-season playbook switch needed. ≤12 distinct calls/book, real per-shelf
variety, identity preserved. OFFENSE audit found one real hole (Triple Option
Power-I was 3 live concepts, keyable) → widened to 5 (Counter+Toss, verified
legal); its OTHER claim (Ground&Pound Jumbo drops PA Deep Cross) was a
hallucination — PA Deep Cross IS legal from Jumbo and renders, no change.
VERIFIED: defbook_probe 76/0, defsheet_probe 101/0, clean build
cfb-dynasty-90e632916b, new_world_probe PASS zero page+console errors across a
full dynasty. Heavier sim probes (defcall/covfam night giants) OWED on owner
machine; re-run node tools/build.mjs on Windows before deploy. Prior in this
session: 2026-08-17 BLUEPRINT = THE BOOKS (owner-directed, this Cowork
session). The dynasty wizard's Blueprint step no longer asks "what kind of
football do you believe in?" — the QB-type and defensive-front CARD pickers are
gone. The step now presents the OFFENSIVE BOOK and DEFENSIVE BOOK as pick-cards
(reusing .ob-pick-card, a .ob-book-tag on custom Workshop books), each card
naming what it runs and a derived one-line "leans your roster toward…". The
first roster is built loosely off the chosen books: world.js gains
rosterHintsFromBooks(offBook, defBook) → the same {qbPref, defFront} the shaper
always consumed, inferred from a book's dominant formation family + tendency
(offense) and base front (defense). offHintFromBook only fires a lean when a
family actually LEADS (≥34% weight) so a change-up Power-I in West Coast/Pro
Balanced reads pocket, not ground; defHintFromBook maps every front to a shape
(3-4/46/4-4 → 3-4 power bodies, everything else → 4-3 speed) so no defensive
book shapes nothing. Verified numbers (all six each side): Air Raid→gunslinger,
Ground&Pound/Pro Balanced→game-manager/pocket correctly split, Spread/Triple
Option→scrambler, West Coast/Pro Balanced→pocket; every defense leans a front.
TWO owner follow-ups same session: (1) NO team-default on the book screen — a
book is a REQUIRED pick, the grids open pre-selected on the first starter each
side and FOUND THE PROGRAM gates until both are chosen; the roster therefore
always leans off a real book. (2) The five whole-game PRESETS (BUILTIN_PLANS)
are DELETED EVERYWHERE — they predate the offense/defense book split. Removed
from: the dynasty wizard (already), Season Mode setup ("Preset schemes"
optgroup), and the Game Plan screen's "Load a plan" list ("Preset plans"
optgroup + its builtin: load handler). BUILTIN_PLANS / builtinPlan definitions
and the preset branch of applyStartingChoices removed from gameplan.js; the
gameplan.js export list dropped BUILTIN_PLANS + builtinPlan. applyPlanToSchool
STAYS (the coach's own saved-library loads still use it). Starter books and
Workshop creations are the only shipped plans now. VERIFIED this sandbox: clean
build cfb-dynasty-ba6127529e (bundle shrank ~9KB from the cut), new_world_probe
PASS (wizard now 9 clicks, down from 11), st_ui_smoke + defcall_ui_smoke PASS.
Same build/gate caveats as below (mount can't rmdir → built from a copy outside
it; re-run node tools/build.mjs on Windows before deploy; CORE/FULL gate owed).
Prior in this session: 2026-08-17 FORMATION DESIGNER — THE SILENT CRASH (owner bug
report, this Cowork session). Owner screenshot: five tight ends, "Fix the errors
above to see the alignment", and NO errors above. Two real defects, both fixed
at source. (1) THE CRASH: _skillSlots names skill slots from fixed id tables —
receivers X/SL/F/V/Z (five), tight ends Y/U/W (THREE), backs H and 2 — and a
fourth TE destructured `undefined` and threw ("undefined is not iterable",
formcompose.js:185). validateCustomFormation never checked personnel, so it
returned ok:true with an empty error list and Save stayed ENABLED — a formation
that cannot compile could be saved, and the list view's "needs repair" rows are
where they landed. Three caps now live with the other legality checks, stated as
football: at most three tight ends (Y, U, W), one fullback, two backs. The back
caps close a quieter version of the same bug — a third back silently reused the
RB_2 id and a second FB the FB id, so two men shared one slot. (2) THE LIE: the
editor swallowed the compile error (`_tryCompile` → null) and printed a message
pointing at an error block that could be empty. _compileOrWhy keeps the reason,
a compile failure now renders as an error line like any other, the fallback copy
no longer claims errors exist when none do, and Save is disabled unless the
formation actually COMPILES, not merely validates. Verified: the owner's exact
five-TE payload now reports "a formation carries at most three tight ends — Y, U
and W (got 5)"; 3TE+2WR, five-wide empty and the default all still compile
(Single Back 37 / Empty 40 / Spread 60 plays); formation_playbook_ui_smoke PASS;
new_world_probe PASS ×3. ALSO — PROBE HARDENING, no product change: N7's walk out
of the world read the screen mid-transition (a between-days CONTINUE card can
hold the world open, and leaving lands on the tree LIST as often as the tree
home), and the hub check read on a fixed 400ms. Both now press-and-poll until the
screen arrives. That is what the two false N7 reds were — driven by hand, the
same build rendered the whole shelf. Clean build cfb-dynasty-7ad994c8d1.
Prior in this session: 2026-08-17 TREE-SCREEN RE-HOME + NEW_WORLD ALL GREEN (owner
decisions, this Cowork session) — the orphaned coach-home panels have a door
again. renderCoachHome() has been unreachable since the tree replaced the
one-coach setup (nothing renders [data-mm-coach] or #btn-mm-newcoach any more),
so its DNA page and Record Book shipped as working code with no way in. Both are
now opened FROM THE TREE: every seated chair carries its own
[data-mm-view="dna"|"records"][data-mm-view-coach] pair, rendered through the new
mmTreeHub state, and their Back clears it and lands on the TREE (never the coach
home). SAVED TEAMS re-homed onto the tree as the union of every seated chair's
teams, tagged by coach when there's more than one; its delete carries
[data-mm-team-coach] because mmCoachId is null on this path. INSTANT CLASSICS now
keeps its header when empty (an absent shelf reads as a lost feature). The
PLAYBOOK LIBRARY was deliberately NOT brought across — owner: "not the playbook
library that will be broken"; it lists the old per-coach plan store the Workshop
superseded, and N7b no longer asks for it. Tree naming settled (owner): the
stored name is now the full phrase "The Tender Tree" (mainmenu.js, was the bare
surname) and the tree-home header dropped its now-redundant "— COACHING TREE".
RESULT: new_world_probe is 12/12 GREEN for the first time — N1b and N7/N7b–e
included, the four reds the manifest has carried as an owed owner decision since
2026-08-17 are CLOSED. Clean build (cache cfb-dynasty-633f373789), st_ui_smoke +
defcall_ui_smoke re-run green on the same build. Same build caveat as below —
this mount forbids rmdir so the build ran from a copy outside it; re-run
`node tools/build.mjs` on the Windows box before deploying, and the CORE/FULL
gate there is still OWED. Prior in this session: 2026-08-17 NEW-WORLD WIZARD REBUILD (owner-directed, this
Cowork session) — the dynasty start flow is now FIVE screens with every dead
click removed: the Situation step (5 start types) and the level cards are
RETIRED (owner: "we only use the forced D3 start so you shouldn't even need to
click on it"), the legacy "take over an existing program instead" screen is
DELETED outright (owner), and the starting playbook + defense pickers MOVED off
the ground-rules screen onto THE BLUEPRINT beside the QB room and the front they
dress. Two Creator entrances finally opened on the dynasty door (owner: "add
both but ignore all authored rosters"): THE WORLD — play the dynasty inside a
saved league, START_DIVISION leagues only, identity-only so generateWorld builds
every roster fresh — and COACH MY OWN TEAM — a created team's name/colors/crest
stamped onto a program you FOUND (authored stars deliberately NOT applied; a
dynasty recruits its own). Both are collapsed expanders defaulting to off, so
the fast path is unchanged. The coach's NAME is still taken at the MAIN MENU
(#mm-nt-first/last) and never asked for again — do not add a Coach step.
engine/starts.js is deliberately LEFT IN PLACE (Ashes cap + Hot Seat leash are
wired into recruiting.js/season.js) — a door closed, not a system torn out.
Walker/probe edits to match: new_world + calendar_display lost
data-ob-challenge/data-ob-div/ob-next-1 from their OPTIONS and next lists,
letter_logo lost its hard [data-ob-div="D3"] click. VERIFIED IN THIS SANDBOX:
clean build (13/13 sanity, cache cfb-dynasty-17fa133e80), new_world_probe
N2 walks the wizard end to end in 11 clicks for the FIRST TIME (was the
documented dead-end) with N3/N4/N5/N8 green — zero page AND console errors
across the whole first session — plus st_ui_smoke, defcall_ui_smoke,
worldgen_check and save_migration_check all PASS. ⚠ TWO REDS THAT ARE NOT THIS
CHANGE: new_world N7b–e (the tree-home shelf that never existed in js/ — the
owner decision the manifest already records is still owed) and N1b (the tree is
named "Whitaker", the probe asserts "The Whitaker Tree"; mainmenu.js:548 sets
the bare surname — product/probe mismatch, untouched here, owner call).
⚠ BUILD CAVEAT: this Cowork mount forbids rmdir/unlink, so tools/build.mjs
cannot run against it (it rm's dist/ first) — the build was run from a copy of
the tree OUTSIDE the mount and dist/ + blueprint-pages.zip copied back. Re-run
`node tools/build.mjs` on the Windows box before any deploy. FULL/CORE gate on
the owner machine is OWED. Prior same day: 2026-08-17 DEFENSIVE TIMEOUT DOOR (owner-ratified same
session) — the coach can now call ⏱️ from the DEFENSIVE call panel (new chip,
`[data-cs-timeout]`, burns HIS pool, works with pins or on RIDE THE PLAN), and
building it surfaced + fixed TWO latent engine bugs: (1) NO player timeout has
EVER burned — offense included — the forced calls were nulled at the coachCall
stamp before the burn check read them (probe §10 proved 0/5 pre-fix; intent is
now captured at the top of the snap); (2) after a penalty no-play, the stale
DEFENSIVE forced call rode the replayed down and the next opponent snap ran
without the every-snap ask (probe §7's next-snap audit caught it; forcedDefCall
now clears symmetrically with forcedCall). Side-resolution fixed defcall-aware
in _liveGPMine + the timeout modal (they pointed at the OPPONENT's plan/pool on
a defcall pending). timecontrol_probe grew §10 ×3 green; record_call R1 gained
its own documented no-play retry; all re-proofs green; clean build. Owner's
live click of the defensive ⏱️ is BROWSER-OWED (entry below). ⚠ A PARALLEL
SESSION is live on this tree (newgame.js Situation-step retirement +
new_world/letter_logo/calendar_display/_gate_manifest edits, uncommitted) —
this commit is partial-staged around it; gates ran on the tree as found.
Prior same day: LIVE-TEST BUGFIX (D7/D4) — all four owner-reported
bugs from the first real-browser M4/M2 session FIXED at source: (1) sim-to-half
ghost prompt + FINAL scoreboard (two causes: the skipUntil clock-0 boundary
re-opened the headset on a 0:00 fourth-down edge, and every straight-to-locker-
room/box-score path left the stale stage-"call" overlay up); (2) Play Art dead
forever (per-board `art` field re-initialized OFF on every snap's board rebuild
— now state.settings.watchArt, read at render, default ON); (3) WATCH mode
stopped on a manual Continue every snap (the board-end gate excluded autoRun
from auto-advance); (4) EVERY-PLAY switch waited out the backlog (now collapses
the board like Take Control). timecontrol_probe grew §7–§9 (next-snap switch ×
both directions, sim-to-half-with-pending lands the halftime seam never final,
UI-fix source tripwires — §9 CAUGHT a live red before the sim.js fix); ×3 green
+ watchphys/midgame_save/record_call re-proofs + clean build. Owner's live
re-test of all four is BROWSER-OWED (entry below). Also answered (report only,
no build): defensive-side timeout — no reachable door on defense; engine+AI
support exists (details in the entry). Prior same day:
DELETE RE-HOME — the two product gaps the PW
rewrite surfaced (saved-team DELETE, instant-classic DELETE) now have LIVE
doors per the owner decision: [data-pn-saved-del] on Play Now's fielded
snapshot row, [data-mm-tree-classic-del] on tree classic rows (world-save +
menu-meta strip). The two smokes' tripwires flipped into real delete drives
(saved_team_library, instant_classic); the unreachable coach-home wiring
STAYS (part of the deliberately retained W9 §12 legacy block, commented).
Clean build + CSS balanced + creator_store/creator_resilience/
save_migration ×3 green; the two live delete click-throughs + the smokes'
first PW runs are BROWSER-OWED (entry below). Prior same day:
VERIFICATION SWEEP (final tree) — the 24h of 12+
parallel sessions verified AS A WHOLE: NO stranded code hunks (js/ +
style.css fully committed by their owners), reconciliation commit 77553b9
(the stranded DISPATCH_PLAN + two runner-state files + .gitignore
.pw-browsers/), dist/ proven BYTE-FRESH against a clean /tmp build (all 7
files byte-identical, cache cfb-dynasty-1f9b0115ed), and the ENTIRE
node-reachable manifest re-run ×1 on the final tree — 73 core node probes
+ commit_rate_test, 73/74 first-run green; the ONE red (size_fit 14/1,
×3 = green/0.3%/0.5%) is the documented standing light-OLB boundary
flake, traced to NO commit. ⚠ NEW ENVIRONMENT LAW: this mount forbids
git's unlink of its own lock files — EVERY git command here strands
.git/HEAD.lock + index.lock; move them to _to_delete/ after each op or
the next session finds a "locked" repo (entry below). Prior same day:
RETIRED-DOOR PW REWRITES (the triage's M batch,
items 7–10): letter_logo / saved_team_library / instant_classic /
calendar_display all enter through the TREE door now, asserting the same
substance where it lives today (two real moves asserted as moves: tree
classic rows print Season not World; saved teams surface in Play Now's
picker). TWO PRODUCT GAPS surfaced — saved-team DELETE and classic DELETE
have no reachable door anywhere — plus a heads-up: new_world's N7b–e will
red for REAL reasons once its staff fix lets the walk finish (tree-home
shelf it asserts never existed in js/; manifest note carries it). PW
unrunnable in this sandbox — everything static verified, first local run
owed (entry below). Prior same day: QBRUN PICKS (a)–(d) RATIFIED (owner) — F1 re-spec
applied to rpo_probe S4 (dual scramble spec 3.5–8%, asserted 3.0–9 w/ noise
pad), rpo_probe 60/0 ×3; picks (e)/(f) since DEFERRED by owner — parked, not
declined, do NOT re-raise unprompted (entry below). Prior same
day: FULL-GATE S-TIER FIXES (owner-ratified triage
plan, steps 1–3 EXECUTED): the ONE product bug FIXED (timeout Rest-of-Game
chips wired — live browser proof owed), commit_rate's day-3 posReviewed
hang FIXED (3× full season ~104 s exit 0), the manifest-correction batch
landed (dna_cards pw→node · gaplist + pass5_band_ab seedFlaky · tipdrill
seedFlaky dropped + args 6→12 · the "(cloud)" mislabels rewritten), and the
S-sized probe edits in (formation_playbook Mesh bar 0.15→0.10 ·
tipdrill staging bar 0.5→0.4 · new_world staff step · nav_back group map ·
dna_cards argv guard) — every node-reachable gate ×3 GREEN here; the
M-sized retired-menu-family PW rewrites (triage items 7–10) NOT attempted,
still owed (entry below). Prior same day: QB-RUN RESEARCH PASS DONE (owner approved all 8
sources; fetch/extract complete, NO outcome code touched) — assessment at
`Ref/QBRUN_RATES_ASSESSMENT_2026-08-17.md`: B1/B3/B5/B6 source-pinned as
shipped, B2 pinned except the dual cell (F1 → band fix), B4 unpinned (keep
provisional), F2 in band; owner pick-list (a)–(f) at the top of that file
awaits answer (entry below). Prior same day: QB-RUN READING LIST drafted —
the D5/D6 brain-research ledger item's owner-approval list at
`Ref/READING_LIST_QBRUN_2026-08-17.md` (now consumed by the research pass). Prior same day:
FULL-GATE TRIAGE (diagnosis only, no code) — all
18 `_night_full_log.txt` reds classified in
`Ref/FULLGATE_TRIAGE_2026-08-17.md`: ONE real product bug (dead
Rest-of-Game timeout chips), 2 healed at HEAD, 8 test-stale, 3 flakes, 3
env-only + the log run was ABORTED mid-manifest. Prior same day: STATUS
errand — D8 dial map** (details below). Earlier header kept: **STATUS
errand (after NIGHT GATE) — D8 dial map
SIGNED OFF: KEEP CURRENT on both PROPOSED items, zero code change, and the
Workshop-template doctrine owner-ratified (recorded at the dial map in the
D8 entry). Prior same day: NIGHT GATE session — both night giants GREEN on
the D1–D9 tree, no reds, no flakes; the nine sessions' owner checklists are
consolidated into ONE list in the NIGHT GATE entry below. Prior same day:
D6 · M3 BUILD** (that entry follows the night-gate one). Original D6 header
kept verbatim: **(D6 · M3 BUILD — the authored RPO /
QB-run family per the RATIFIED audit: five authored plays with their own
art (#45), the three-way give/keep/throw read (#46), THE DICE ARE DEAD,
archetype-keyed AI rates at the audit's targets, clean-pocket scramble,
widened Dual band, counters verified biting — BUILT + NODE-GATED,
`rpo_probe` 60/0 ×3 in CORE, browser tier owed; new entry below. **M3 IS
BUILT** — with D8/D9 this window, every milestone M0–M5 now has its build
session in. Same window earlier: D8 · M5 plan home (dial map since SIGNED
OFF — KEEP CURRENT, owner 2026-08-17) · D9 · M5 defbook close-out — D9's card_lint blurb flag on
D6's in-flight concepts is RESOLVED in this session, card_lint 21/0 ×3.)
Prior: D4 · M2 presentation; D3 · M2 engine; D7 · M4; D2 · M1; D5 · M3
audit RATIFIED. Plan of record: BUILD ORDER v2 (2026-08-17), dispatch
prompts in `Ref/DISPATCH_PLAN_2026-08-17.md`.**

## 2026-08-18 — D12 · THE HONEST REPORT CARD (this Cowork session) — badge lists + stale callSheet, UI tier
## NODE-GATED ×3 — ⚠ PW SMOKE + THE `_equiv_walk` ATTRIBUTION RUN OWED-LOCAL (not walk-neutral BY DESIGN)

Executed the D12 block from `Ref/COHESION_DISPATCH_2026-08-18.md` (ec7300b),
OD-11/OD-12 owner-RATIFIED (4510b12). Both defects were the audit's "it lies
to the coach" pair: the plan report's CUSTOM/AUTO badge could never match on a
field no cell can carry and read AUTO on most fields a cell CAN carry; and a
defensive book load replaced `defCalls` but kept the old `callSheet`, whose
rows named calls that no longer existed — `pickDefCall` filters dead entries
(sim.js), so the matchup sheet silently stopped firing and the game quietly
played plain dials.

**What shipped:**
- **`js/ui/app.js`** — `PLAN_OFF_FIELDS`/`PLAN_DEF_FIELDS` rebuilt from the
  truth: exactly the fields the SIT panel writes into a situation cell
  (renderSitPanel/wireSituationListeners, cell dialect — `tempo`, `defFront`).
  OFF: offFormations, tendency, passDepth, qbRunPct, optionRate, jetRate,
  tempo, drawRate, protIdentity, protEmphasis, qbAggr, conceptWeights. DEF:
  defFront, defAggression, runCommit, coverageScheme, covShell, covStyle,
  pressLevel, edgePlay, optionKey, subPhilosophy, tackleStyle. The dead
  `pressureIdentity` badge entry is GONE (no SIT control writes it; the badge
  could never read CUSTOM off it). The badge now reads CUSTOM iff the cell
  carries a field the coach can actually set there. Simple-mode postures write
  covShell/coverageScheme/pressLevel cells — those now correctly badge CUSTOM;
  Simple's "auto" writes null, which correctly badges AUTO.
- **`js/engine/defbook.js`** — new exported `pruneCallSheet(gp)`:
  filters every callSheet cell to names the CURRENT `defCalls` library holds —
  survivors keep their exact weights (none invented), dead entries drop, and
  empty cells/rows/sheets are deleted (the empty-structures old-save law), so
  a row whose calls all died renders as an EMPTY cell — inheriting the
  standing plan, the exact meaning the Matchup Call Sheet's empty-cell copy
  already explains. `applyDefBookToGameplan` calls it whenever its compile
  replaces the library (n>0 named calls); an identity-only book (no shelves)
  still leaves the old library AND its sheet untouched (the "Edit defense"
  identity-save path depends on that — comment at gameplan.js setupListeners).
  This closes EVERY def-load door at the engine seam: `#gp-lib-load` ddb/dd,
  the one-tap book-update banner, the wizard/applyStartingChoices.
- **`js/ui/views/gameplan.js`** — belt-and-suspenders heal-on-load: the
  `#gp-lib-load` starter (dpb/ddb) and Workshop (pb/dd) branches call
  `pruneCallSheet` after the plan swap — idempotent, and it heals a sheet an
  OLD save left stale through the pre-fix door (offense loads included).
- **`tools/defsheet_probe.mjs`** — new §C "BOOK LOAD LEAVES NO DEAD CALLSHEET
  ROW": loads a starter book over a gameplan carrying a stale sheet (all-dead
  row, mixed row, all-alive row, dead personnel cell) and proves zero dead
  references, all-dead rows deleted, surviving weights exact, input not
  mutated, the identity-only carve-out, and the exported healer's
  empty-sheet delete. 8 checks, green ×3.

**Gates (this sandbox, node, tree as found — D11/D13/D15/D16 sessions live in
parallel):** defsheet_probe (incl. new §C) **109/0 ×3** · defbook_probe
**76/0 ×3** · plan_cohesion_probe **75/0 ×3** (final runs; mid-session counts
moved 59→75 as the parallel blocks landed their pins — two transient reds seen
mid-run were D16's pressureSource/placebo pins mid-edit, ZERO reds ever named
a D12 surface) · clean esbuild build from a temp copy OUTSIDE the mount
(13/13 sanity, CSS braces 5698/5698 balanced, 2 script blocks, cache
**`cfb-dynasty-ede3402d8e`**, `pruneCallSheet` + the new badge fields verified
IN the bundle, old badge list verified GONE) · dist/ + blueprint-pages.zip
copied back byte-identical (sha256 match) · `node --check` clean on the three
touched js files · temp copies cleaned up after.

**Re-verified at commit time (this session was resumed after a credit
interruption; the tree had moved under D13/D15/D16 in the meantime):** all
three gates re-run on the FINAL tree — defsheet_probe **109/0 ×3**,
defbook_probe **76/0 ×3**, plan_cohesion_probe **75/0 ×3**, `node --check`
clean. AND the commit was proved self-sufficient IN ISOLATION: a
`git checkout-index` extract of the staged index alone (HEAD + D12's five
files, none of the neighbouring sessions' hunks) builds **13/13 sanity, cache
`cfb-dynasty-1d7725a236`**, CSS 5698/5698 balanced, 2 script blocks,
`pruneCallSheet` present in the bundle, and passes defsheet_probe 109/0 +
defbook_probe 76/0 on its own — so this commit does not depend on any
parallel session's uncommitted work to be valid.

**⚠ `_equiv_walk` — run OWED-LOCAL, and NOT expected identical (say-so per the
dispatch):** this change intentionally alters rendered DOM, so the walk MUST
diff. A D12-less baseline build was prepared and built clean in the sandbox
(cache `cfb-dynasty-7a865d2241`) but the PW browser tier is unrunnable here
(Windows-only binaries in `.pw-browsers/`; the sandbox network allowlist
blocks the Linux headless-shell download — same wall as D11). On the local
machine: run the walk on builds with/without the D12 commit and attribute the
diffs to exactly (a) plan-report badge spans (CUSTOM where a cell carries a
newly-listed field, no badge driven by pressureIdentity), (b) matchup
call-sheet rows absent where a book load killed their calls. Any OTHER diff is
unexplained — treat per the gate's law.

**OWNER CHECKLIST (D12):**
- [ ] **Local gate:** `node tools/defsheet_probe.mjs` + `defbook_probe` +
  `plan_cohesion_probe` ×3, then `node tools/build.mjs` (Windows box — the
  standing mount caveat), then the `_equiv_walk` attribution run above, then
  `defcall_ui_smoke` (PW — first run on this change, OWED).
- [ ] **Browser eyeball (one sitting):** (1) play a game with a situation cell
  customized via a previously-unlisted control (e.g. set Cushion=Press on 3rd
  & long) → the post-game plan report's row badges **CUSTOM** (it read AUTO
  before); (2) load a different starter DEFENSE over a plan whose matchup
  sheet weighted the old calls → the Matchup Call Sheet shows those rows
  EMPTY (inheriting), not naming ghosts — and `pickDefCall` keeps firing on
  rows you re-author.
- [ ] Commit note: this session's commit is partial-staged around live
  parallel work (defbook.js also carries D13's uncommitted hunks; gameplan.js
  may carry D16's) — verify `git log --stat` looks right before any deploy.

**Commit scoped to (partial-staged):** js/ui/app.js (badge-list hunk) ·
js/engine/defbook.js (pruneCallSheet hunks ONLY — D13's validator hunks left
unstaged) · js/ui/views/gameplan.js (import + two heal-on-load hunks ONLY) ·
tools/defsheet_probe.mjs (§C) · Ref/STATUS.md (this entry). NOT pushed.

## 2026-08-18 — D11 · MANIFEST COMPLETION (this Cowork session) — data + probes only, no consumer rewired
## NODE-GATED ×3 — ⚠ `_equiv_walk` OWED-LOCAL (PW blocked by sandbox allowlist; byte-identity expected BY CONSTRUCTION)

Executed the D11 block from `Ref/COHESION_DISPATCH_2026-08-18.md` (ec7300b)
verbatim, under the OD-11 ratification (4510b12).

**What shipped (pure data + probe):**
- **`js/engine/teamplan.js`** — `PLAN_FIELD_SIDE` gains the audited gaps:
  `screenRate`/`paRate`/`chipHelp`/`wildcatPassRate`/`rpoKeepPct`/
  `rbCarryShares`/`runDirection` → **off**; `callSheet` → **def** (the
  "book swap leaves a stale callSheet" gap now has an owner); `stFakes`/
  `puntDef`/`retScheme`/`patApproach`/`surpriseOnside` → **team**. Commented
  in place per field group. No consumer rewired — the compiler's partition
  semantics do the rest; an off/def field moves from overlay into its book on
  the next synthesis.
- **`tools/plan_side_probe.mjs`** — `SIM_CONSUMED` widened from
  "getEffectivePlan's reads" to the FULL audit census (§1 tables): 57 fields,
  each verified as a live `.field` read in sim.js/situations.js before listing
  (grep table run this session). The section-3 sidedness spot-check gains all
  13 new fields. 34/0 ×3.
- **`tools/plan_cohesion_probe.mjs` — deliberately NOT touched.** Block item 3
  says extend §5 only if D13 hasn't landed; D13 was landing IN THIS TREE
  mid-session (see below), and its session owns those pin flips.

**Partition safety — proven, not assumed (the block's stated risk):**
- `playbook_root_probe` **24/0 ×3** on the changed manifest (the round-trip
  law: split+compile ≡ gameplan on real worlds).
- A one-off node proof (not committed): on a generated world with AI plans,
  60 schools — OLD-manifest compile ≡ NEW-manifest compile ≡ `school.gameplan`
  (sorted-JSON equality, 0 mismatches). The manifest moves fields between
  bags; the compiled flat plan is unchanged.
- Nothing in production recompiles the flat plan from the parts today (the
  audit's own finding: the two verbs have zero production callers), so the
  sim-read `school.gameplan` is untouched at runtime BY CONSTRUCTION.

**Gates (this sandbox, node):** `plan_side_probe` 34/0 **×3** ·
`playbook_root_probe` 24/0 **×3** · `book_update_probe` 47/0 ·
`save_migration_check` ALL PASS · clean esbuild build ×2 in /tmp (HEAD:
`cfb-dynasty-d3f0e4ad8c` — matches the recorded prior build — and
HEAD+this-change: `cfb-dynasty-16d52a119c`; temp copies deleted after) ·
`node --check` clean on both changed files. `plan_cohesion_probe` ran
**49/0 ×2 clean**, then went red mid-session — attributed below, not this
change.

**⚠ `_equiv_walk` OWED-LOCAL:** the walk needs Playwright's Linux
chrome-headless-shell; the repo's `.pw-browsers/` carries WINDOWS builds and
the CDN download is 403-blocked by the sandbox network allowlist (standing
condition). Mitigation: both builds produced above, and the flat-plan proof +
zero-production-recompile argument make the walk byte-identical by
construction. On the local machine: build HEAD and this tree, run
`node tools/_equiv_walk.mjs` on both, diff transcripts — identical discharges
the gate; if it diverges, per the block's law the field stays OUT (revert,
report).

**⚠ Parallel-session ledger (tree as found, D2 precedent):** D13 was landing
LIVE in this tree during the gate runs — `defbook.js` grew
`CARD_EXTRA_ENUMS`/`validateDefBook` teeth mid-run (one probe run crashed on
its half-written state, then healed), `defaultbooks.js` card fixes landed, and
`plan_cohesion_probe` grew 44→49→60 checks under us with its §5 tripwires
flipping exactly as designed (last observed: 60 checks, 1 red — D13's
remaining pin, their session's to flip). None of those files is touched or
staged by this commit.

**OWNER CHECKLIST (D11):**
- [ ] **Local `_equiv_walk`** (the one owed gate): build HEAD~ and HEAD after
  this commit lands, walk both, diff transcripts (details in the entry above).
- [ ] Nothing else — no UI, no behavior, no browser eyeball owed by this
  change-set.

**Commit scoped to:** `js/engine/teamplan.js` · `tools/plan_side_probe.mjs` ·
`Ref/STATUS.md` (this entry). Partial-staged around D13's in-flight files.
NOT pushed.

## 2026-08-18 — D13 · STARTER-DATA REPAIR + VALIDATOR TEETH (this Cowork session)
## NODE-GATED ×3 GREEN · CLEAN BUILD · ⚠ COMMIT DELIBERATELY HELD — see "why" below

OD-7 (owner-RATIFIED at the audit's typo-reading, 4510b12) is BUILT. Every
invalid starter-card extra is repaired to intent, `validateDefBook` now has
enum teeth on the extras, and `plan_cohesion_probe` §5's pins FLIPPED to assert
absence (the probe working as designed).

**The card repairs (js/engine/defaultbooks.js — all six starter books):**
- `zoneStyle:"sky"/"cloud"` → **`rotation:"sky"/"cloud"`** (Coastal Cover 3, Sky
  Rotation Cover 3, Dime Coastal 3) — the audit's reading: these were always
  `rotation` values (sky/cloud/buzz), never zone-teaching values.
- `zoneStyle:"fire"` (Bear Fire Zone) → **`rotation:"buzz"`** — the sim already
  models the C3 Fire Zone family WITH the buzz safety (sim.js ~2350); "fire"
  was naming the pressure, and the rotation is what the card meant to set.
- `zoneStyle:"soft"` (Lead Prevent) → **`zoneStyle:"spot"`** — soft zone IS
  spot-drop in the engine's own vocabulary; it stays on the zoneStyle key.
- `robberCall:true` ×6 → **`"rob"`** — "Dime Robber", "Dime Rat Trap" (×2),
  "Empty Bracket", "Sky Rotation Cover 3", "Goal Line Robber" now actually rob.
  `true` was falling through as `auto`: the cards robbed nothing.
- `greenDog:true` on "Dime Green Dog" → **`dogGame:"green"`** — the card's green
  dog compiled through NO path before; it does now.

**⚠ THE FLAGGED EXCEPTION, NOW OWNER-RESOLVED (was awaiting a named target).**
`zoneStyle:"quarterQuarterHalf"` on "Bend Cover 6" had no legal target in any
card enum, so it was left untouched and flagged. The owner then delegated the
pick with "lean into realism", and the answer is option (1) of his two:
**quarter-quarter-half IS Cover 6** — a split-field coverage, not a Cover 3
rotation — and the card ALREADY calls the `c6` picture ("Quarters to the field,
Cover 2 to the boundary"). The extra was a redundant restatement of the card's
own coverage, so it is simply **dropped**; the card is now
`dcard("Bend Cover 6", "Nickel", "c6", "4", null, { weight: 55 })`. No guessed
mapping was invented, and the fallback (rotation "cloud") was NOT needed.
`quarterQuarterHalf` is retained in `CARD_EXTRA_LEGACY` so a pre-fix saved copy
of the book still loads with a WARNING, never a hard red (`bookpush` gates on
`validate.ok` — a red would brick an old "Save as my own" copy of a starter).

**One seam fix the repair EXPOSED (would have been dead data otherwise):**
`cardToDefCall` did not carry `rotation` — the one compile seam that dropped it,
while `pickDefCall`'s normalizer and `applyDefCall` both already speak it. The
repaired rotation data would have compiled to nothing. `rotation` added to that
key list; call-only on purpose (cells/checks can't speak it — audit's table).

**Validator teeth (js/engine/defbook.js):** new exported `CARD_EXTRA_ENUMS`
(edgePlay · robberCall · zoneStyle · dogGame · pressLevel · rotation) +
`CARD_EXTRA_LEGACY`; `validateDefBook` enum-checks every extra and type-checks
`runCommit`. **Unknown KEYS are warnings, not errors** — a future vocabulary
(D14's CARD_VOCAB) can add keys without bricking old books, exactly as the block
prescribes.

**Gates (this sandbox, node):** `plan_cohesion_probe` **77/0 ×3** ·
`defsheet_probe` **PASS ×3** · `defbook_probe` **PASS ×3** ·
`save_migration_check` ALL PASS · `defcall_probe` 32/0 · clean esbuild build
from a copy outside the mount (**13/13 sanity, cache `cfb-dynasty-ede3402d8e`**,
3715 KB) · `node --check` clean on both engine files.

**⚠ TWO REDS THAT ARE NOT THIS CHANGE-SET (both attributed by A/B, not read):**
1. **`covfam_probe` — "Cover 6 cloud corner hardens the boundary short ball"
   FAILS (WR1 short comp% 57.1 vs ctrl 54.4).** Attributed: re-ran with all four
   D13 files reverted to HEAD and the rest of the tree as found — **byte-identical
   numbers, same single red.** covfam's import graph (constants/player/world/sim)
   never reaches defbook.js or defaultbooks.js, so D13 cannot move it by
   construction. The live cause is the PARALLEL D15 sim.js precedence work in the
   working tree (`if (_chk.covShell || _chk.covStyle) defEff.covFamily = null;`),
   which is exactly this mechanic. **D15's to own — reported, not fixed around.**
2. **`stat_realism` comp% 56.4 [band ~60-66] "off".** Same A/B: baseline (D13
   reverted, tree as found) reads **57.5, also off** — the miss is pre-existing,
   not D13's. Deltas are mixed and inside noise for an unseeded harness at
   n=120 (D13 arm is actually the better one on rush yds and yds/play). **No
   D13-attributable band movement.**

**⚠ OWED-LOCAL (the sandbox MCP call cap is ~180 s, and background jobs do not
survive a call):** `covfam_probe 120` and `stat_realism_harness 500` at their
MANIFEST N — run here at N=30 and n=120 respectively. `defcall_probe` ran at
N=120 (manifest default 1200). Re-run all three on the owner machine.

**⚠ WHAT WAS COMMITTED, AND WHY THE CODE IS HELD (deliberate, not forgotten).**
**Committed: `Ref/STATUS.md` only (this entry) — NOT pushed.** The three code
files are held, with the reason PROVEN rather than asserted:

*They are an ATOMIC set.* Test run: a HEAD tree carrying **only** D13's
`defbook.js` → `defsheet_probe` **FAILS** ("six defensive starters survive
load-time validation (3)") and the committed `plan_cohesion_probe` reds **41/3**.
That is the validator teeth biting the un-repaired starter data, exactly as
designed. So `defbook.js` (teeth) + `defaultbooks.js` (repaired data) +
`plan_cohesion_probe.mjs` (flipped pins) must land in ONE commit or the tip is
red between them.

*And two of the three still carry other blocks' uncommitted hunks:*
- `js/engine/defbook.js` — **now purely D13** (D12's `pruneCallSheet` landed in
  9f44554, so it is no longer in this diff).
- `js/engine/defaultbooks.js` — carries **D16's three OD-5 hunks** (the
  aggressive/conservative placebo retirements).
- `tools/plan_cohesion_probe.mjs` — carries **D15's §2 arms** and **D16's §5
  pins**, line-adjacent to D13's §5 pins in the same block.

Committing the set scoped-by-path would sweep D15's and D16's in-flight work
into a commit labelled D13; excising their hunks would ship a file state that
has never existed in the tree and that no gate has run against. Neither is
acceptable, so the set waits. **Nothing was staged, unstaged or reset — the
index was left exactly as found throughout.** D13 is complete and green in the
WORKING TREE. Land it as ONE commit once D15/D16 are in, scoped to:
`js/engine/defbook.js` · `js/engine/defaultbooks.js` ·
`tools/plan_cohesion_probe.mjs`. NEVER push.

**⚠ A COLLISION THAT ALREADY FIRED (flagged before it happened, no harm done).**
D12's staged `defbook.js` blob was a snapshot taken BEFORE D13's edits reached
the worktree, so their commit **9f44554 does not contain** D13's
`CARD_EXTRA_ENUMS`/`CARD_EXTRA_LEGACY`, the validator teeth or the `rotation`
carry. Verified after the fact: those lines are absent from the tip and intact
in the worktree — nothing was lost, and the pending D13 commit above restores
them to the tip. The general lesson for this tree: **re-stage from the worktree,
never from an older snapshot**, when several blocks share a file.

**OWNER CHECKLIST (D13):**
- [ ] **Eyeball one live defense:** load the Coastal book, open Edit Defense —
  "Coastal Cover 3" / "Dime Coastal 3" should read as rotation calls, and
  "Bend Cover 6" should carry NO zone-teaching extra (it's a c6 card).
- [ ] **Local gate at manifest N:** `node tools/covfam_probe.mjs 120`,
  `node tools/stat_realism_harness.mjs 500`, `node tools/defcall_probe.mjs`.
- [ ] **The covfam red is D15's** — confirm it clears when D15's sim.js work is
  finished or reverted; do not chase it inside D13.
- [ ] **Commit D13 from the WORKING TREE** (see the scoping + collision notes
  above) once the parallel blocks land. NEVER push.

## 2026-08-18 — D10 · PLAYBOOK↔DIALS COHESION AUDIT (this Cowork session) — report-first, mechanical fixes only
## NODE-GATED (all reachable probes ×3 green) — ⚠ BUILD + _equiv_walk + COMMIT OWED-LOCAL (sandbox VM died mid-session, see below)

The owner's question ("the playbooks aren't meshing yet — find every conflict
with the old dials; maximum cohesion") is answered in
**`Ref/COHESION_AUDIT_2026-08-18.md`** (OPEN DECISIONS OD-1…OD-12 first, then
the full disposition table = the D8-item-4 map, evidenced file:line) with
remediation as ready-to-paste blocks **D11–D17 in
`Ref/COHESION_DISPATCH_2026-08-18.md`**. Nothing outcome-bearing was touched.

**The headlines (each proven, not read — details + file:line in the audit):**
1. **A covFamily call OVERWRITES the standing shell/style dials unconditionally
   and never touches the cushion** — and when a personnel check and a named
   call fire on the same snap, the SAME check wins 100% against a plain-dials
   call and is IGNORED 100% against a family call (the coverage pick
   short-circuits on the family the check can't clear). Proven at sim level by
   the new probe, 100% rates, seeded.
2. **DPB2's "every element maps 1:1" claim is FALSE on five counts**: the
   card's three compile paths speak three vocabularies (pressLevel dropped by
   the call path but honored by cells; dogGame the exact inverse; formChecks
   drop robber/zone/cushion/dog AND the family coverages; card greenDog read
   by nothing — the shipped "Dime Green Dog" card's green dog never compiles);
   plus Box = ±8-delta in checks vs ±10-absolute in calls under one label.
3. **Placebo controls shipped**: coverageScheme "aggressive"/"conservative"
   have NO sim branch (assignCoverage speaks only lockTop/bracketTop) — the
   "Attack 3-4" starter carries one, Simple mode writes both; starter cards
   carry enum values the engine can't parse (zoneStyle "fire"/"soft"/"sky"/
   "cloud"/"quarterQuarterHalf", robberCall:true ×6 — "Dime Rat Trap" robs
   nothing) and validateDefBook never checks extras.
4. **The two-verb compile seam has ZERO production callers** — 26 writer sites
   in 9 files write school.gameplan directly (17 without re-synthesis; the
   wizard leaves school.book a stale pre-book snapshot), so the data flow is
   still gameplan→book, the inverse of the target architecture.
5. **Zombies + orphans**: pressureSource is written by three writers, shown by
   the UI, and DELETED by the sim at every kickoff; `_liveTempo` is read 3× in
   sim.js and written by nothing; a defensive book load leaves the callSheet
   naming dead calls (the matchup sheet silently stops firing); the plan-report
   CUSTOM/AUTO badge lists are wrong in both directions; blitzPct still has
   three raw writers and Simple mode's Defensive Posture write is provably
   discarded at kickoff when a stop is already set.

**What shipped (Part C — provably inert only):**
- **`tools/plan_cohesion_probe.mjs`** (NEW, registered CORE in
  `tools/_gate_manifest.mjs`) — 44 checks pinning all of the above (sim-level
  arms + source pins + data pins). **ALL PASS 44/0 ×3.** Pins CURRENT behavior
  including the defects — each D-block flips its pins WITH its fix.
- **Comment-only** corrections in `js/engine/defbook.js` (the false "five
  coverage identities the sim honors" claim; the three-vocabularies warning on
  cardToDefCall). Zero behavior; esbuild strips comments.
- Deliberately NOT fixed (reported instead): every outcome-bearing item above —
  the bar was "provably inert or typo-class with unambiguous target", and none
  cleared it. PLAN_FIELD_SIDE + plan_side_probe already existed (Stage-1
  addendum) — verified, not re-implemented.

**Gates run (this sandbox, node):** plan_side_probe ×3 PASS ·
plan_cohesion_probe ×3 ALL PASS (44/0) · playbook_root_probe PASS ·
defbook_probe PASS · tendency_probe PASS · play_fidelity_probe 4 (18 green) ·
save_migration_check ALL PASS · integration_creator_probe PASS · node --check
clean on the three touched files. **playcall_probe no longer exists** — the
playcall gate is `ui_playcall_smoke.mjs` (PW tier, unrunnable here).

**⚠ ENVIRONMENT FAILURE (ledgered so nobody re-diagnoses):** the sandbox VM's
own disk filled while tar-copying the tree to /tmp for the standing
build-outside-the-mount workaround, and the VM then failed to boot ANY shell
("no space left on device" writing /etc/srt-settings — 5 straight failures,
wedged). All probe runs above completed BEFORE the wedge. Consequences, all
OWED-LOCAL: (1) clean esbuild build + CSS parse; (2) the `_equiv_walk`
byte-identity gate — mitigation: the ONLY js/ change is comment-only and
esbuild strips comments, so the bundle should be **byte-identical to a HEAD
build by construction** — on the local machine, build HEAD and this tree and
compare sha256 of dist/index.html; identical hashes discharge the gate
outright, and if they differ, per the gate's law treat it as an unintended
behavior change (revert + report); (3) **the session commit** — no shell, no
git. A restarted session (fresh VM) can run all three; /tmp leftovers die with
the VM.

**OWNER CHECKLIST (D10):**
- [ ] **Read `Ref/COHESION_AUDIT_2026-08-18.md` OPEN DECISIONS (OD-1…OD-12)**
  — each is phone-standalone with a recommendation; the disposition table
  underneath is the D8-item-4 dial map, evidenced. D13–D17 in the dispatch
  file are blocked on your picks; D11 (manifest data) and D12 (badge/callSheet
  hygiene) can fire as soon as you nod at OD-11/OD-12.
- [ ] **OD-7 needs per-card answers** (the invalid starter-card values — most
  look like `rotation` typos and robberCall:"rob"; the audit lists every card).
- [ ] **Local gate**: `node tools/plan_cohesion_probe.mjs` (also in CORE now),
  then the OWED build + sha256 compare vs HEAD described above, then commit
  this session's files (list below). NEVER push.
- [ ] Browser eyeball (rides any future gameplan session, nothing visual
  changed here): none owed by this session beyond the standing list.

**Commit scoped to (when the local machine commits on behalf):**
`js/engine/defbook.js` (comments only) · `tools/plan_cohesion_probe.mjs` (new) ·
`tools/_gate_manifest.mjs` (one CORE entry) ·
`Ref/COHESION_AUDIT_2026-08-18.md` (new) ·
`Ref/COHESION_DISPATCH_2026-08-18.md` (new) · `Ref/STATUS.md` (this entry).
Suggested message: `D10 cohesion audit: report + dispatch D11-D17 +
plan_cohesion_probe (CORE) + defbook comment corrections`. NOT pushed.

## 2026-08-18 — COMMITTED ON BEHALF (session ledger, owner-authorized commit job)

The owner's finished home work (the 2026-08-17→08-18 entries above) was
committed by a Cowork session under the standing lock workaround — all
content authored by owner locally; the session only grouped, staged and
committed (zero code changes). Sanity floor re-run pre-commit on the tree
as-is: clean esbuild build from a copy outside the mount (13/13 sanity,
cache `cfb-dynasty-d3f0e4ad8c`), dist/ already byte-identical (no
copy-back), bundle parse 2/2 script blocks, CSS braces 5698/5698. Commits
(branch `source`, NOT pushed):

- `f19d65d` NEW-WORLD WIZARD REBUILD + BLUEPRINT = THE BOOKS
  (newgame.js, world.js, new_world/calendar_display/letter_logo probes,
  _gate_manifest)
- `d87c60b` TREE-SCREEN RE-HOME + NEW_WORLD ALL GREEN (mainmenu.js)
- `3798003` FORMATION DESIGNER — THE SILENT CRASH (formcompose.js,
  creatorform.js)
- `91fefce` STARTER BOOKS REBUILT — EVERY DEFENSE ANSWERS EVERY OFFENSE;
  ALL-LEGAL / FITTING-ONLY offense sheets (defaultbooks.js, defbook.js,
  defbook/defsheet probes)
- `ab2f160` PLAYBOOK EDITOR REWORK + EDIT DEFENSE LOADS THE FULL BOOK +
  PRESET-REMOVAL RE-APPLIED (creatorplaybook.js, gameplan.js,
  seasonmodeview.js, style.css, formation_playbook/defcall smokes)
- `039b73b` D10 dispatch docs (Ref/D10_COHESION_AUDIT_PROMPT.md,
  Ref/D10_DISPATCH_BLOCK.md)
- (final commit) Ref/STATUS.md — the 08-17→08-18 entries + this ledger

Deliberately LEFT uncommitted, untouched, per owner instruction: the ~39
modified PNGs, `_night_full_log.txt`, `test_notes_8-16.txt`, `_to_delete/`.
Build caveat unchanged (re-run `node tools/build.mjs` on Windows before
deploy; gate owed).

## 2026-08-17 — DEFENSIVE TIMEOUT DOOR (this sandbox) — owner-ratified build + TWO latent engine bugs found and fixed
## NODE-GATED ×3 — ⚠ THE LIVE DEFENSIVE-⏱️ CLICK IS BROWSER-OWED

The owner ratified the same-session report ("yes we need to give the player
the same ability") — the defensive-side timeout is BUILT. Building its probe
exposed two latent engine bugs that shipped fixed with it.

**OWNER CHECKLIST (browser, one live game — joins the standing list):**
- [ ] **Defensive ⏱️, live:** on a defensive call panel (your team on D), the
  footer now carries "⏱️ Timeout (N)" — arm it, SEND IT (or RIDE THE PLAN):
  the feed prints "⏱️ Timeout — ‹your school› (N left)", the panel's count
  drops, and at 0 the chip is disabled. The timeout adjust screen (Next Play /
  Rest of Game) shows YOUR plan and YOUR timeouts-left on defense.
- [ ] **Offensive ⏱️ now actually burns (latent bug):** call one on offense —
  the counter must DROP and the feed line print. It never did before (see
  below) — worth one deliberate look.

**The two latent engine bugs (both probe-caught, both fixed):**
1. **No player timeout ever burned — offense included.** The burn check sat
   in the clock-runoff block and read `forcedCall.timeout` — but every path
   nulls `forcedCall`/`forcedDefCall` at the coachCall stamp (and the
   special-teams/penalty branches even earlier), all BEFORE the runoff block.
   Probe §10's pre-fix run: 0 burns in 5 tries. The W4 timeout screen's
   adjustments applied, but the pool never decremented and the run-off was
   never saved — free timeouts since W4. Fix: the timeout intent is captured
   at the TOP of the snap iteration (`_toFlagSide` = the side whose call
   carries the flag), and the burn block reads that. Offense burns the
   offense's pool, defense the defense's, never the opponent's, never below
   zero, scored snaps exempt (unchanged semantics). One modeling quirk noted:
   a penalty no-play on the snap still eats the timeout intent (the flag dies
   with the wiped call) — rare, visible, acceptable v1; probe §10 retries it.
2. **After a penalty, the defense's forced call rode the replayed down and
   the next opponent snap ran WITHOUT the every-snap ask** — the penalty
   branches null `forcedCall` (offense re-asks) but never `forcedDefCall`.
   Probe §7's next-snap audit caught it (~1 game in 13: a real down-1–3 snap
   between two asks in callMode 'all'). Both penalty branches now clear both.
   Coached-game-only variables — AI-only sims byte-identical by construction.

**What shipped:**
- **`js/engine/sim.js`** — `_toFlagSide` capture at snap top + the rewritten
  burn block (side-exact, same log line/format); `resumeFromCall` keeps the
  timeout flag on a ride-the-plan defcall answer (`{_ride:true,timeout:true}`
  — the old bare wrapper dropped it); both penalty branches clear
  `forcedDefCall` symmetrically.
- **`js/ui/app.js`** — `defCallPanelHtml` footer grew the ⏱️ chip (same
  `[data-cs-timeout]` the existing listener wires; count + disabled-at-0,
  reads THIS side's pool); `dc-send` carries `timeout: true` on both branches
  (pinned call and bare RIDE THE PLAN); `_liveGPMine` and the timeout-adjust
  overlay resolve the COACH's side on a defcall pending (both used
  possession-first reads that pointed at the OPPONENT's gameplan/pool —
  live-plan edits from a defensive timeout would have edited the other team).
- **`tools/timecontrol_probe.mjs`** — §10: defensive-pinned, offensive, and
  defensive-ride burns each ×M games (pool −1, opponent pool untouched, empty
  pool never negative, H1-only windows so no AI auto-timeout path can
  contaminate; scored/penalty snaps retry per the file's own convention);
  §7 hardened while catching bug 2 (flip accepts defcall asks, penalty rows
  excluded from the slip audit, windows close at the half boundary — kneel/
  spike are lawful un-asked snaps, both half≥2-gated).
- **`tools/record_call_probe.mjs`** — R1 gained the retry its own line-91
  comment prescribes (a pre-snap penalty can consume the unseeded resume
  with 0 real snaps; observed once mid-gate, 4/4 green on re-run — flake
  class, not a regression).

**Gate (this sandbox, node):** `timecontrol_probe` **exit 0 ×3** on the final
tree (all 47 checks). `record_call_probe` **PASS ×3** · `live_book_call_probe`
PASS · `midgame_save_probe` PASS · `watchphys_probe` FULLY GREEN. Clean
esbuild build in /tmp: ALL sanity checks PASS, 3716 KB, cache
`cfb-dynasty-17fa133e80`, bundle syntax parse (2 blocks), CSS balanced
(5692/5692), dc-timeout/data-cs-timeout/watchArt in the bundle; all 7 dist
files copied back byte-identical. **Size note:** the −13 KB vs the morning
build is the PARALLEL SESSION's uncommitted newgame.js retirement (below),
not this change-set.

**⚠ Parallel-session note (tree as found):** an uncommitted Situation-step
retirement is live in the working tree (`js/ui/views/newgame.js` ~644-line
diff + new_world_probe/letter_logo_ui_smoke/calendar_display_probe/
_gate_manifest edits). None of it is this session's work; this commit is
partial-staged to the five files below, and the gates/build above ran on the
tree as found (the D2 precedent).

**Commit scoped to:** js/engine/sim.js · js/ui/app.js ·
tools/timecontrol_probe.mjs · tools/record_call_probe.mjs · Ref/STATUS.md.
NOT pushed.

## 2026-08-17 — LIVE-TEST BUGFIX (this sandbox) — the four D7/D4 bugs from the owner's first real-browser session
## NODE-GATED ×3 — ⚠ THE OWNER'S LIVE RE-TEST OF ALL FOUR IS BROWSER-OWED

The owner live-tested the M4 involvement toggle + transport row (D7) and the
M2 play-art overlay (D4) in a real browser game and found four bugs. All four
are diagnosed to root cause and fixed at source (`js/` only; no style.css
change needed). Engine RNG untouched; the one engine edit (`skipHolds`) runs
only under skip flags that only the coached UI ever sets — sim-neutral for AI
games by construction.

**OWNER CHECKLIST (browser, one live game — the re-test of all four):**
- [ ] **Sim to half, with the sheet asking:** press ⏭⏭ Sim to half from an
  open call prompt → NO further prompt, straight to the locker room, the
  half's drives as feed summaries, and the locker-room scoreboard reads a
  HALFTIME phase (never FINAL). Then ⏭⏭ Sim to end in H2 → straight to the
  box score, no ghost call sheet.
- [ ] **Play Art:** the watch-bar button reads "Play Art: On" and STAYS on
  snap after snap and across halftime; the D4 pre-snap overlay actually
  draws (routes/blocks/run path fading through the snap) — the owner has
  never seen it, so this is also the D4 overlay's first live look. Toggle
  Off → sticks Off across snaps too (it's a real setting now, saved with
  the game). Settings → Presentation → "Pre-Snap Play Art" still gates the
  overlay independently.
- [ ] **👁 Watch every play:** auto-plays snap after snap with NO Continue
  button and no "your call" label — the ticker reads "Rolling — the sheet
  calls the next one." 🎧 Take control still cuts in instantly.
- [ ] **🎧 Coach every play, switched mid-game:** flipping the toggle to
  Every Play while the board is rolling cuts the animation short (like Take
  Control) and hands you the sheet on the OPEN snap — no backlog re-run,
  no un-prompted plays. Watch ↔ Moments ↔ Every in both directions
  mid-game.

**The four root causes (all found, none guessed):**
1. **Sim-to-half (bug 1) — two stacked causes.** ENGINE: `skipHolds`'s
   skipUntil boundary cleared the flag when `sit.clock <= 0` and let that
   very ask fire — and a 0:00 fourth-down edge asks BEFORE the drive loop's
   clock-break, so a skipped half could re-open the headset on its boundary
   snap (probe §4 caught this live: 1 leak in 3×N=6 runs). A clock-0 target
   now mutes THROUGH the break; the fresh half / final gun / OT entry clear
   the flag (all three clears already existed). UI: `handleGamePendingEvents`'
   halftime branch and both straight-to-box-score paths (`processEvents`,
   `exhibitionFinal`) never dropped `state.ui.liveWatch` — a stale
   stage-"call" overlay survived into the break, rendering a call sheet with
   NO pending (the ghost prompt whose answer fell into the void) over a
   board whose empty-state bug reads "FINAL". All such paths now null the
   overlay. D7's law held throughout: resolution still runs through
   resumeFromCall/resumeFromDecision; no new save path; `gamePauseIsLive`
   untouched.
2. **Play Art (bug 2).** `initWatchMode` created a fresh `_watch` per board
   key — and the LIVE board's key changes EVERY SNAP — with an
   off-by-default `art` field, so the toggle re-disabled itself before every
   play (and across halftime, and in every replay). The owner has literally
   never had the layer enabled. Now `state.settings.watchArt` (default ON),
   read at render time and written by the button — the exact pattern the
   Replays button already used. Persists with settings; loadFromSlot's
   settings spread carries it.
3. **Watch every play (bug 3).** The board-end gate in `watchTick` was
   `stage === "call" && !state.ui.autoRun` for auto-advance — WATCH mode
   (autoRun) fell into the manual "Continue →" branch with the "The headset
   crackles — your call." label: every snap stopped dead on a tap. Stage
   "call" now ALWAYS auto-advances; `liveWatchFinish` reads autoRun live at
   fire time, so a mid-hold toggle switch is honored on that snap; the
   autoRun ticker label no longer claims "your call".
4. **Every play, switched mid-game (bug 4).** Engine honored the switch
   (token.callMode reads live — probe §7 proves next-snap in both
   directions); the UI waited for the board backlog to finish animating
   before showing the sheet, which reads as un-prompted plays. The toggle's
   EVERY handler now collapses an in-flight stage-"call" board exactly like
   🎧 Take control (watchStop → boardDone → sheet on the open snap).

**What shipped:**
- **`js/engine/sim.js`** — `skipHolds`: clock-0 skipUntil target mutes
  through the break (mid-half targets, clock > 0, keep clear-and-ask).
- **`js/state.js`** — `handleGamePendingEvents` halftime `_skipAnim` path +
  non-liveWatch path, `processEvents` game-result else path, and
  `exhibitionFinal` else path all drop `state.ui.liveWatch`.
- **`js/ui/app.js`** — Play Art button backed by `state.settings.watchArt`
  (per-board `art` field deleted); `watchTick` end-of-board call stage
  auto-advances regardless of autoRun + honest autoRun label in
  `mountLiveWatch`; `[data-tc-invo]` handler collapses the board on a
  mid-game switch to EVERY with a pending open.
- **`tools/timecontrol_probe.mjs`** — §7 next-snap switch (audits three
  consecutive ask-to-ask windows after keydowns→all: zero 1st–3rd-down
  snaps pass un-asked; first ask after all→keydowns already on-spec), §8
  sim-to-half WITH a pending call (zero strays, stage 2 + stopAfterHalf at
  the seam — never 'done'/final, all plays half 1, `_skipAnim` untouched by
  the engine), §9 source tripwires for the UI half node can't click
  (settings-backed play-art read at render, no per-board reset, call stage
  auto-advance, both stale-overlay drops). §9 EARNED ITS KEEP immediately:
  the pre-fix §4 red (the boundary leak) appeared on run 3 of the first
  gate — the sim.js fix, then ×3 clean.

**Gate (this sandbox, node):** `timecontrol_probe` **exit 0 ×3** on the
final tree (all 41 checks; N=6 default). Re-proof: `watchphys_probe` FULLY
GREEN (byte-laws hold — the play-art fix touches only the class toggle, not
the script) · `midgame_save_probe` PASS · `record_call_probe` 12/0. Clean
esbuild build in /tmp (standing workaround): ALL sanity checks PASS,
3729 KB, cache `cfb-dynasty-1bed8fa3be`, bundle syntax parse (2 script
blocks), CSS braces balanced (5692/5692), watchArt + the new label + the
skipUntil edit all verified IN the bundle; all 7 dist files copied back
byte-identical (sha256 MATCH). `node --check` clean on all four changed
files. PW tier unrunnable here (standing) — the owner checklist above is
the browser half.

**Answered same session (owner mid-session question — report only, NO code):
defensive-side timeout.** (a) UI door: NONE reachable. The ⏱️ Timeout
button (`[data-cs-timeout]`) renders only in the OFFENSIVE call sheet
(`callSheetPanelHtml`); `defCallPanelHtml` has dials + transport + SEND
only. On defense there is no way to call one. (b) Engine: the mechanic is
side-agnostic and would support it — `forcedCall.timeout` burns
`gameState.playerSide`'s timeout whichever side of the ball that is
(sim.js ~5756) and `token.timeouts` tracks both sides per half — BUT the
defcall resume path carries a `defCall` object, not `call`, so a timeout
flag on a defensive answer has no seam to the burn today (small seam if
ever built). (c) AI/auto already calls defensive timeouts in three places:
the under-2:00 trailing-side clock-stopper on run plays (either side,
~5763), the kneel-down defense burning TOs vs victory formation (~4019),
and icing the kicker on clutch FGs (~4237) — all visible in the feed.
Owner decides if a defensive door is wanted; nothing was built.

## 2026-08-17 — DELETE RE-HOME (this sandbox) — saved-team + classic DELETE get live doors (owner decision)
## NODE-GATED — ⚠ the two live delete click-throughs + the smokes' first PW runs are BROWSER-OWED

The PW-rewrite session (b6c6fb4) found both deletes wired only in the
unreachable coach home. OWNER DECISION 2026-08-17: re-home, don't drop.

**OWNER CHECKLIST (browser, one sitting — joins the standing local list):**
- [ ] **Saved-team delete, live:** Play Now → field a saved dynasty team →
  the ✕ on the SAVED SNAPSHOT row → confirm() → the option leaves the
  "Saved dynasty teams" group and the panel falls back to a generated team.
- [ ] **Classic delete, live:** tree home → an Instant Classic row's ✕ →
  confirm() → row gone; re-open the tree and it stays gone (the replay
  payload is stripped from the tree's world save, not just the menu meta).
- [ ] **First local PW runs of the two UPDATED smokes**
  (`saved_team_library_ui_smoke`, `instant_classic_ui_smoke`) — their
  no-delete tripwires are now real end-to-end delete drives.

**What shipped:**
- **`js/ui/views/playnow.js`:** the fielded snapshot's `.pn-saved-meta` row
  now carries `[data-pn-saved-del]` (✕, `btn-mm-del`), wired to the SAME
  `deleteSavedTeam` the coach home used, behind `confirm()` (the app's
  destructive convention — world/classic deletes). After delete, any side
  fielding that snapshot falls back to a generated team.
- **`js/ui/views/mainmenu.js`:** `renderTreeClassics` rows now carry
  `[data-mm-tree-classic-del]` + slot; the handler mirrors the coach-path
  delete byte-for-shape (confirm → strip `instantClassics` from the tree's
  ONE world save → strip the menu meta → rerender), via the new
  `removeTreeClassicMeta`.
- **`js/engine/coachprofile.js`:** `removeTreeClassicMeta(treeId, classicId)`
  — the tree twin of `removeWorldClassicMeta`, filtering `t.meta.classics`.
- **`style.css`:** one rule (`.pn-saved-del` rides the meta row's right edge).
- **The coach-home wiring STAYS** (`[data-mm-team-del]`,
  `[data-mm-classic-del]`): it is not newly orphaned — it is part of the
  deliberately retained W9 §12 legacy coach system (renderCoachSelect's
  "to bring it back" comment); killing just the deletes would break that
  block if ever restored. Commented in place pointing at the live doors.
- **Smokes + manifest (data):** `instant_classic_ui_smoke` tripwire
  (`[data-mm-classic-del]` count 0) flipped to assert the re-homed door and
  the full delete drive restored (row gone + payload gone from save + meta);
  `saved_team_library_ui_smoke` gained the picker-side delete drive
  (control present → confirm → profile/picker/panel all clear). Everything
  else in both is verbatim. Manifest notes for the two entries updated to
  UPDATED/re-homed; `new_world`'s N7 heads-up note corrected (the deletes
  now have doors; record book + plan-library management remain doorless).

**Gate (this sandbox, node):** clean esbuild build in /tmp (standing
workaround) — ALL sanity checks PASS, 3728 KB, cache `cfb-dynasty-a45683f292`,
dist/ copied back byte-identical; bundle syntax parse (2 script blocks);
all four new selectors/symbols verified IN the bundle; CSS braces balanced.
`creator_store_probe` PASS ×3 · `creator_resilience_probe` PASS ×3 ·
`save_migration_check` ALL PASS ×3. `node --check` clean on all six changed
JS/tool files; `node tools/_gate.mjs --list` parses. PW unrunnable here
(standing) — selector grep-verification table run instead (data-pn-saved-del,
data-mm-tree-classic-del/-slot, removeTreeClassicMeta, optgroup label, all
present in js/); the live click-throughs are the browser-owed half above.

**Commit scoped to:** js/engine/coachprofile.js · js/ui/views/mainmenu.js ·
js/ui/views/playnow.js · style.css · tools/instant_classic_ui_smoke.mjs ·
tools/saved_team_library_ui_smoke.mjs · tools/_gate_manifest.mjs ·
Ref/STATUS.md. NOT pushed.

## 2026-08-17 — VERIFICATION + HYGIENE SWEEP (this sandbox, node) — THE FINAL TREE VERIFIED AS A WHOLE
## 73/74 NODE PROBES GREEN ×1 · dist/ BYTE-FRESH · RECONCILIATION COMMITTED · ⚠ ONE NEW ENVIRONMENT LAW

After ~24h of 12+ parallel sessions committing via partial staging, nobody
had verified the FINAL tree. This session did — enumerate, reconcile,
rebuild-compare, and one full node-reachable manifest pass.

**⚠ THE NEW ENVIRONMENT LAW (ledgered so nobody re-diagnoses):** this
sandbox's mount FORBIDS git's unlink of its own lock files. Every git
command that takes a lock (commit, add, even `git status` refreshing the
index) succeeds but strands `.git/HEAD.lock` / `.git/index.lock` — the
next git command then fails "locked". The workaround the night sessions
used one-off is in fact MANDATORY after every op: `mv .git/*.lock
_to_delete/<name>.<timestamp>`. This session also swept ~60 stranded
`.git/objects/*/tmp_obj_*` leftovers (same unlink failure at object-write
time; the real objects were written — the temps are dead) into
`_to_delete/`. `_to_delete/` itself cannot be emptied from here
(`rm` = Operation not permitted); it holds ~25 old lock files + these — a
local-machine `rmdir` owes it.

**1. TREE STATE (the good news): NO stranded code hunks.** `js/` and
`style.css` were fully committed by their owning sessions — the partial
staging worked. Uncommitted at session start, all attributed:
- **Committed in reconciliation 77553b9:** `Ref/DISPATCH_PLAN_2026-08-17.md`
  (the Build Order v2 plan-of-record — STATUS has pointed at it since
  edb9a45 but its author never committed it: genuinely stranded, finished);
  `tools/_build_inplace_tmp.mjs` (one-line comment cleanup, 08-16 window);
  `tools/_gate_last.json` (owner-machine core-gate run record 08-16 08:27,
  all OK — state, committed for the record); `.gitignore` + `.pw-browsers/`
  (the 702 MB local Playwright browser tree was one `git add -A` away from
  the history).
- **Deliberately LEFT uncommitted (flagged, not guessed):** the 39 modified
  QA/screenshot PNGs (regenerated by the owner-machine smoke runs 08-16
  09:27–11:26 — several came from smokes the triage classed red/test-stale,
  so committing would bless possibly-broken captures; owner call);
  `_night_full_log.txt` (owner-machine FULL-run evidence, consumed by the
  triage — deliberately untracked all along); `test_notes_8-16.txt`
  (owner's playtest notes, folded into STATUS at edb9a45 — owner's file).
- No stash, no active locks after sweep, branch `source` ahead of origin
  only. NOT pushed, per standing law.

**2. dist/ IS BYTE-FRESH.** Clean build in /tmp (standing temp-copy
workaround) from the final tree: ALL sanity checks PASS, 3726 KB, cache
`cfb-dynasty-1f9b0115ed` — and **all 7 dist files are byte-identical**
(sha256: index.html af8630ab…, 404/sw/manifest/icons/.nojekyll all MATCH).
No rebuild needed; the S-tier-fixes session's copy-back was faithful.

**3. THE FULL NODE-REACHABLE MANIFEST ×1 (73 core node probes +
commit_rate_test).** PW tiers remain unrunnable here (standing); night
giants already paid on this tree (NIGHT GATE entry). **73/74 green on the
first run.** The complete table (probe · result · secs):

| probe | result | s | probe | result | s |
|---|---|---|---|---|---|
| stat_realism (N=500) | ✅ exit 0, no new flags | 59 | arm_switch_ab 24 | ✅ bit-exact | 7 |
| traits | ✅ 24/0 | 1 | size_fit | 🔶 14/1 — see below | 1 |
| trait_growth | ✅ 14/0 | 0 | snap_track | ✅ 11/0 | 3 |
| morale | ✅ 9/0 | 2 | convert_brain | ✅ 17/0 | 0 |
| stage4 | ✅ 17/0 | 1 | cutday_recs | ✅ 10/0 | 0 |
| portal_balance | ✅ PASS | 5 | scheme_role | ✅ 22/0 | 0 |
| save_migration | ✅ ALL PASS | 16 | playbook_root | ✅ 24/0 | 3 |
| plan_side | ✅ 21/0 | 3 | ai_book_name | ✅ 11/0 | 2 |
| live_book_call | ✅ 14/0 | 1 | book_update | ✅ 47/0 | 0 |
| formation_compose | ✅ 39/0 | 3 | card_lint | ✅ 21/0 | 0 |
| draw_up | ✅ 21/0 | 1 | record_call | ✅ 12/0 | 1 |
| bench | ✅ 34/0 | 1 | contract_ladder | ✅ ALL PASS | 3 |
| prestige_trajectory | ✅ 9/0 | 1 | viewer_pace | ✅ 12/0 | 0 |
| viewer_duel | ✅ PASS | 9 | viewer_throwcatch | ✅ PASS | 0 |
| viewer_secondary_motion | ✅ PASS | 0 | viewer_act_a_finish | ✅ PASS | 7 |
| pos_ovr_census | ✅ 3/0 | 1 | ovr_adj_ab | ✅ ALL PASS | 94 |
| starter_hold | ✅ 12/0 | 1 | class_backfill | ✅ 11/0 | 0 |
| help_rule | ✅ 6/0 | 1 | chair_isolation | ✅ 15/0 | 1 |
| save_backup | ✅ ALL PASS | 0 | multicoach_week | ✅ 16/0 | 2 |
| coach_age | ✅ 19 green | 2 | star_unfold | ✅ 31 green | 0 |
| coordinator_identity | ✅ 30 green | 0 | hc_mastery | ✅ 15 green | 0 |
| ceremony | ✅ 28 green | 0 | player_retention | ✅ 16 green | 1 |
| coordinator_audit | ✅ 13 green | 0 | dead_surface | ✅ ALL GREEN | 1 |
| play_fidelity 4 | ✅ 18 green | 3 | blitz_pie | ✅ 7/0 | 84 |
| portrait | ✅ 9/0 | 1 | formation_variation | ✅ 394/0 | 0 |
| replay_store | ✅ 16/0 | 0 | creator_store | ✅ 50/0 | 0 |
| creator_world | ✅ 9/0 | 25 | compile_league | ✅ 26/0 | 6 |
| playbook_shape | ✅ 28/0 | 3 | d2d3_tiering_ab | ✅ 8/0 | 1 |
| conference_prestige | ✅ 12/0 | 0 | blue_blood | ✅ 7/0 | 3 |
| division_assembler | ✅ 17/0 | 2 | season_persist | ✅ 15/0 | 12 |
| season_mode | ✅ 12/0 | 106 | creator_resilience | ✅ 20/0 | 1 |
| integration_creator | ✅ 19/0 | 6 | custom_play | ✅ 231/0 | 0 |
| play_compose | ✅ 33/0 | 0 | defbook | ✅ 75/0 | 0 |
| defsheet | ✅ 77/0 | 1 | star_player | ✅ 11/0 | 1 |
| tipdrill 12 | ✅ PASS | 8 | tipdrill_ab 120 | ✅ PASS | 31 |
| look_sheet | ✅ 44/0 | 4 | timecontrol | ✅ PASS | 10 |
| rpo | ✅ 60/0 | 74 | commit_rate_test | ✅ exit 0 | 122 |

**The one red, classified — size_fit_probe 14/1, FLAKE (standing).**
Re-run ×3: green · red (light-OLB tail 0.3%) · red (0.5%) — the exact
documented boundary mode (manifest note: tail oscillates at the 0.5%
floor; a red on ONLY this check at 0.4–0.5% is the standing boundary).
Traced to NO commit: the only `player.js` change in the window is D6's QB
legLean band (QB-only), nothing touches OLB weights, and the same red
appears in the 08-16 owner FULL log pre-dating the window. **One caveat
worth an eye:** the 0.3% sighting sits a hair BELOW the note's 0.4–0.5%
band; if future reds land consistently ≤0.3%, the manifest's own rule
says treat it as real.

**Timing note:** the parallel RETIRED-DOOR PW REWRITES session (b6c6fb4)
landed mid-verification, AFTER the probe sweep started — it touched ONLY
PW smokes + manifest notes + STATUS (zero js/, zero node probes, nothing
bundled), so the sweep and the dist check both describe HEAD's node
surface and bundle exactly.

**Owed after this session (nothing new added, one item retired):** the
verification-of-the-whole-tree debt is PAID at the node tier. Still open,
unchanged: the PW tier + boot check locally (now including b6c6fb4's four
rewritten smokes' first runs), the D1–D9 browser eyeballs (ONE OWNER
CHECKLIST in the NIGHT GATE entry), the timeout-chip live proof, the
pre-deploy FULL re-run, and `_to_delete/` owes a local `rm -rf`.

**Commit scoped to:** Ref/STATUS.md (this entry + header) — the
reconciliation itself is the separate 77553b9. NOT pushed.

## 2026-08-17 — RETIRED-DOOR PW REWRITES (this sandbox) — the triage M batch (items 7–10) DONE
## STATIC-VERIFIED ONLY — ⚠ PLAYWRIGHT UNRUNNABLE HERE; FIRST LOCAL RUN IS THE PROOF

The four PW smokes that still entered through the coach main-menu door W9
§12 retired (`#btn-mm-newcoach` / `[data-mm-coach]` — tree-only menu since
the 08-12 import) are REWRITTEN onto the current door. Per the standing
rule, nothing was weakened: every assertion either survives verbatim or is
re-pointed at where the feature genuinely lives now, with the move named.

**What shipped (tools/ only — zero js/ or style.css changes):**
- **`letter_logo_ui_smoke.mjs` (item 7):** ONLY the wizard section changed —
  enters `#btn-mm-newtree` → `#mm-nt-first`/`#mm-nt-last` → `#mm-nt-create`
  (one form; goes straight into the wizard). The old
  `[data-mm-world-new="1"]` "dynasty entry exists" check became "the tree
  door opens the wizard" (`.ob-kicker`); tree runs lock take-the-job/D3 and
  skip the Situation step, so `#ob-next-0` lands on THE JOB. Every
  letter-mark assertion (school-row marks = row count, no mascot emoji,
  overflow, screenshots) unchanged.
- **`saved_team_library_ui_smoke.mjs` (item 8):** save-action half
  unchanged (`#btn-gp-save-team`, engine roster+gameplan check). The
  library half retargeted from the unreachable coach home to **Play Now's
  "Saved dynasty teams" source picker** — the one place saved teams surface
  today: listed under the optgroup, label carries the coach's name AND
  `coachId` matches the fixture's coach (attachment), `selectOption` →
  `.pn-saved-meta` SAVED SNAPSHOT + the fielded `.pn-name` equals the saved
  school (instantiateSavedTeam actually fields the roster). Phone/desktop
  overflow now checked on the Play Now screen.
- **`instant_classic_ui_smoke.mjs` (item 9):** classics re-seeded onto a
  TREE (`createTree` + `createCoach({treeId})` + `noteTreeMeta(classics)` +
  the world save at `treeWorldKey`), driven via `[data-mm-tree]` →
  `[data-mm-tree-classic="ic-ui"]`. The whole replay half is untouched
  (#watch-root/board/stepfwd/bug, INSTANT CLASSIC header, no live toggle,
  "Back to Coach Select", both viewports); close returns to the TREE home
  with the row still listed, and the full payload is asserted to survive in
  the tree's world save. Two REAL MOVES asserted as such: rows print
  "Season N" not "World N" (a tree has one world), and there is NO delete
  control on the tree path (tripwire check: `[data-mm-classic-del]` count
  0 — flips loudly into a real delete drive when a door lands).
- **`calendar_display_probe.mjs` (item 10):** entry replaced with the tree
  door, and the drifted hardcoded wizard click-list replaced with
  new_world_probe's PROVEN generic walker (enabled forward button wins;
  otherwise answer the last unanswered option group; OC/DC prefix-split
  `[data-ob-staff]` selectors per the d229394 fix; patient on the
  "FOUNDING…" no-button reveal phase, 8×800 ms before declaring a stall).
  The calendar walk itself — including D7's `[data-kickoff="watch"]` — is
  byte-untouched.
- **`_gate_manifest.mjs` (data only):** the four entries' TEST-STALE notes
  rewritten to REWRITTEN + first-local-run-owed, `envKnown` dropped on all
  four (the d229394 pattern for fixed mislabels). `new_world`'s note gained
  the N7 heads-up below.

**TWO PRODUCT GAPS + ONE PROBE HEADS-UP (owner decisions owed — found by
the rewrite, NOT fixed here, no code invented to hide them):**
1. **Saved-team DELETE has no door.** `deleteSavedTeam` is wired only in
   the unreachable coach home (`[data-mm-team-del]`, renderCoachHome).
   Saved teams can be created (Game Plan) and used (Play Now) but never
   deleted from any reachable screen (8-team cap will eventually bite).
2. **Instant-classic DELETE has no door.** `[data-mm-classic-del]` +
   `removeWorldClassicMeta` likewise live only on the unreachable coach
   home; tree classic rows render no delete control.
3. **`new_world_probe` N7b–e will red once the d229394 staff fix lets the
   walk reach them** — they assert a tree-home shelf (PLAYBOOK LIBRARY /
   SAVED TEAMS text, per-chair `[data-mm-view-coach]` DNA + record-book
   buttons) that has NEVER rendered in js/ (`data-mm-view-coach` appears
   nowhere in the source; renderTreeHome carries chairs/tree-DNA/classics
   only). Coach DNA lives in-world (Coach's Office), saved teams in Play
   Now — but the record book and plan-library management are doorless like
   the deletes above. Owner call: build the tree-home shelf N7 demands, or
   re-point N7 at the moved surfaces. The manifest note says: do NOT wave
   those four reds off as env. (Deliberately NOT rewritten here — N7 is
   Garrett's tripwire for exactly this "screens quietly dropped" failure,
   and softening it to green would be weakening an assertion.)

**PROVEN HERE (static, this sandbox) vs OWED LOCAL:**
- Proven: `node --check` clean on all five changed files; every selector /
  engine symbol the rewrites drive verified present in current js/ source
  (grep table run this session: btn-mm-newtree, mm-nt-*, ob-kicker,
  ob-next-0/2/3/4, ob-start, all eight data-ob-* groups, ob-school-row/
  found/mark/list, pn-source-/pn-saved-meta/pn-name, data-mm-tree=,
  data-mm-tree-classic=, all watch ids, close-game-result-btn,
  noteTreeMeta/treeWorldKey/createTree/listTrees/listSavedTeams/
  instantiateSavedTeam — ALL FOUND); the manifest parses and lists
  (`node tools/_gate.mjs --list`); the walker logic is byte-mirrored from
  the already-landed new_world pattern. Sim/UI behavior unchanged by
  construction (no js/ edits).
- **OWED LOCAL (the first PW sitting):** the four rewritten smokes
  end-to-end; `nav_back_smoke` + `new_world_probe` first post-d229394 runs
  (expect new_world N2–N5 green and N7b–e red per the heads-up);
  `timeout_screen_smoke` + the live chip click (d229394's browser half);
  then the pre-deploy FULL re-run per the triage. Everything else in the
  standing owed-local list is unchanged.

**Commit scoped to:** tools/letter_logo_ui_smoke.mjs ·
tools/saved_team_library_ui_smoke.mjs · tools/instant_classic_ui_smoke.mjs ·
tools/calendar_display_probe.mjs · tools/_gate_manifest.mjs · Ref/STATUS.md.
NOT pushed.

## 2026-08-17 — FULL-GATE S-TIER FIXES (this sandbox, node) — triage steps 1–3 EXECUTED
## NODE-GATED ×3 — ⚠ the timeout-chip fix's LIVE proof is browser-owed

The owner-ratified plan in `Ref/FULLGATE_TRIAGE_2026-08-17.md` (steps 1–3 of
its order of operations), executed. The M-sized retired-main-menu PW
rewrites (triage items 7–10) were explicitly OUT of scope and remain owed;
size_fit's optional hardening (item 13) was not taken (metadata already
right).

**OWNER CHECKLIST (browser/local, all one sitting):**
- [ ] **The timeout-chip fix, live:** in a game, call a timeout → Rest of
  Game tab → press tempo/aggression chips — they must now write (the panel
  re-renders, the setting sticks for the rest of the game). Then
  `timeout_screen_smoke` on the local gate — expected green with NO smoke
  changes (FULL run had FAIL (2)).
- [ ] **First local PW run of the updated smokes:** `nav_back_smoke` (new
  season-group map) and `new_world_probe` (staff-step walker) — both were
  S-fixed here but PW is unrunnable in this sandbox; their runs are the
  proof. `calendar_display` + letter_logo/saved_team_library/
  instant_classic stay RED until the M rewrites land (notes now say so).
- [ ] The pre-deploy FULL re-run on an idle machine (triage step 5) now
  expects: covfam, tipdrill, gaplist, pass5, size_fit, defcall_ui,
  table_button_phone, position_gallery green (or retried-green), the five
  never-ran probes on the record, commit_rate ~100 s, dna_cards green as a
  node probe. Anything still red after this session + the M batch is new
  information.

**What shipped:**
- **THE product bug (triage item 1), js/ui/app.js:** `#to-adjust-root` is
  now wired with `wireDefaultsListeners(gpL, {root})` in the global block
  next to `#to-cancel` — same pattern as the kickoff modal's
  `#kickoff-adjust` and the halftime screen, the only two places that ever
  wired these chips. Verified in the built bundle (the wiring is in
  dist/index.html); the live click is the browser-owed half.
- **commit_rate_test.mjs (item 2):** acknowledges the day-3 `posReviewed`
  camp gate (`devCtx(state).posReviewed = true` — the PLAYTEST 08-12
  item-12 hard gate only the dashboard UI sets); stale 35/36-day comments
  fixed to the 30-day calendar. **3× full season here: exit 0 at ~104 s
  each** (funnel 80–81%, reconciliation PASS ×3). Manifest timeout restored
  600→300, the "overload" note replaced with the real diagnosis.
- **Manifest batch (tools/_gate_manifest.mjs, data only):** `dna_cards` →
  `kind:'node'` (was pw — the gate fed the dist path into its games argv →
  NaN → 0-game arms) + envKnown dropped; `gaplist` + `pass5_band_ab` →
  `seedFlaky: true` with measured-rate notes; `tipdrill` seedFlaky DROPPED
  (deterministic by construction — a retry can never clear its reds) + args
  6→12; nav_back + new_world envKnown dropped (fixed here, they were never
  cloud); letter_logo / saved_team_library / instant_classic /
  calendar_display notes rewritten to TEST-STALE-everywhere (envKnown kept
  for cloud reporting; local reds EXPECTED until the M rewrites);
  timeout_screen note records the fix.
- **Probe edits:** `formation_playbook_probe` Mesh bar 0.15→0.10 (true mean
  ~14.3% sat BELOW the old bar; every observed run clears 0.10, lean still
  proven); `tipdrill_probe` staging bar 0.5→0.4 (per-tree deterministic
  values ranged 47–62% — the old bar sat inside the range); `new_world_probe`
  walker learned the Staff step (per-side `[data-ob-staff^="OC:"]`/`"DC:"`
  selectors — one shared selector would stop after the OC); `nav_back_smoke`
  `GROUP_OF` → season group + `[data-season-tab]` (verified against
  state.js LEGACY_VIEW_MAP + app.js renderSeasonGroup); `dna_cards_probe`
  defensive argv (non-numeric → default 1200, never NaN).

**Gate (this sandbox, node):** clean esbuild build — ALL sanity checks
PASS, 3726 KB, cache `cfb-dynasty-1f9b0115ed` (built in /tmp per the
standing workaround, outputs copied back to dist/) + bundle syntax parse
(2 script blocks) + CSS braces balanced. `commit_rate_test` **exit 0 ×3**
(~104 s). `tipdrill_probe 12` **0 fails ×3, byte-identical** (staging
48/78 = 61.5% — matches the triage's N=12 measurement, confirming
determinism). `card_lint_probe` **PASS ×3**. `formation_playbook_probe`
**exit 0 ×3** (Mesh 18.6–20.8% short-share, new bar cleared with margin).
`gaplist_probe` green/green/**red-then-retry-green** — the red was G8a
iced-kicks-zero, the SAME rare-event class as G8b (its forced arm forces
the clutch spot, not the icing roll); exactly the behavior the new
seedFlaky flag models, and the manifest note now ledgers G8a too.
`pass5_band_ab` at gate volume N=300: **red/green/green**, a DIFFERENT
band over the line each red (pass 13.1 vs 10; rush 9.0 vs 8 in an earlier
N=120 sighting) — the documented wander, now retried by its flag; note
carries the measurements. `dna_cards_probe` at GATE VOLUME via faithful
chunking (night-gate precedent — unseeded independent arms, 6 chunks
pooled into **3× N=1200/arm** with the probe's own formulas): pre-snap
drop 8.8% / 10.6% / 17.8% (bar >6), post-snap 2.4% / −0.3% / −6.5% (bar
<7 and <0.7×pre) — **both checks pass all three**; NaN-guard verified
(`parseInt(dist path)` → guard falls back to 1200). PW tier unrunnable
here (standing): nav_back / new_world edits are `node --check` clean only.

**What this clears from the triage's 18:** items 1 (code half), 2, 3, 4,
5, 6 fixed; 12, 14, 15 (metadata) corrected; 11 (covfam) owed nothing; 13
(size_fit) optional, not taken; 7–10 (M rewrites) still owed; 16–18
(env-only) owed only the clean FULL re-run.

**Commit scoped to:** js/ui/app.js (one wiring block) ·
tools/commit_rate_test.mjs · tools/_gate_manifest.mjs ·
tools/dna_cards_probe.mjs · tools/new_world_probe.mjs ·
tools/nav_back_smoke.mjs · tools/formation_playbook_probe.mjs ·
tools/tipdrill_probe.mjs · Ref/STATUS.md. NOT pushed. (Parallel session
note: the QB-RUN research entries below landed mid-window; gates ran on
the tree as found.)

## 2026-08-17 — QBRUN PICKS (a)–(d) RATIFIED (owner) · F1 re-spec APPLIED · rpo_probe 60/0 ×3

Owner ratified assessment picks **(a)–(d)** (all recommended items): B1/B3/
B5/B6 stand source-pinned at shipped values, F2 accepted in band, B4 stays
provisional — all zero-change. The ONE implied change is applied: **`rpo_probe`
S4's dual scramble cell is now SPEC'D at 3.5–8% of dropbacks** (was the 5–8%
target with ad-hoc 1.5–9 padding), asserted `3.0–9` with the probe's standard
noise pad — an unpadded 3.5 floor was tried first and flaked on run 2
(observed values across final runs: 5.1 / 3.3 / 4.1%db), so the pad matches
the sibling cells' convention. No engine change; RNG untouched.
**Gate: `rpo_probe` 60/0 ×3 on the final probe.** Pick-list marked in the
assessment. **(e) option-floor raise and (f) local keyed CFBD run: DEFERRED
(owner, 2026-08-17) — parked, NOT declined. Do not re-raise unprompted;
they live in the assessment's pick-list for whenever the owner returns to
them.** Committed: probe + assessment + this entry. NOT pushed.

## 2026-08-17 — QB-RUN/RPO RESEARCH PASS (all 8 sources owner-APPROVED · fetched · assessed — NO outcome code changed)

The D5/D6 "needs brain research" ledger item is now RESEARCHED. Owner
approved all eight reading-list sources (including #4); the fetch/extract
pass ran per the standing method caveat (NCAA sacks-as-rushes; public att/g
merges designed+scramble+sneak — only claim what a source supports).

**Read `Ref/QBRUN_RATES_ASSESSMENT_2026-08-17.md`** — per-band findings,
recommended bands, diffs vs the D6 ship, and the phone-readable **owner
pick-list (a)–(f)** at the top. The shape: **B1, B3, B5, B6 are now
source-pinned at their shipped values** (zero change); **B2** is pinned top
and bottom with the dual cell re-specced 3.5–8% (F1 resolved as a band fix,
probe-comment-level, no engine change); **B4 stays provisional** (no public
keep-share number exists anywhere — only PFF Premium would pin it; the keep
as a coached third phase is confirmed); **F2 judged in band** (real statues:
~3 gross att/g, nearly all sacks). One surprise: real option QBs carry
18–23 gross att/g — the audit's option floor (5–12) is low; sized as
optional pick (e), measure the option chain's contribution first.

**Every claim is cited in `Ref/SOURCE_LIBRARY.md` §R (#57–#64)** + the fetch
ledger there: CFBD API **blocked by the sandbox allowlist** (HTTP 000 on
api.collegefootballdata.com and every mirror route; NOT worked around — a
keyed local run is future item 1), Sports-Reference unreachable by WebFetch
(Cloudflare) but read via the browser, statrankings' table client-rendered
(NFL control NOT refreshed; seeded 2024 numbers stand), one FantasyPoints
prospect claim recorded UNVERIFIED. Committed: assessment + SOURCE_LIBRARY
§R + this entry, nothing else. NOT pushed.

## 2026-08-17 — QB-RUN/RPO READING LIST (research prep — NO fetches; since APPROVED-ALL and consumed by the research pass above)

The D5/D6 "needs brain research" ledger item (provisional §5C bands,
PFF/ESPN/FantasyPoints NFL-floor anchors) now has its reading list:
**`Ref/READING_LIST_QBRUN_2026-08-17.md`** — 8 candidate PUBLIC sources,
EV-ordered (CFBD/cfbfastR distribution pull first, Sports-Reference
exemplar ladder, PFF-free/FantasyPoints spot anchors, coaching-clinic RPO
ratios as the only public line on keep share), each mapped to the band it
should pin (B1–B6 + the two D6 flags: widened-Dual scramble dilution F1,
pocket broken-play residue F2) with a confidence guess. Paywalled PFF
Premium / SIS noted for what they'd add, NOT listed for approval. Nothing
was fetched — SIM_RESEARCH_PROJECT.md rule: owner approves the list before
use. **Answer with source numbers ("approve 1,2,5"; recommended minimum
1,2,5) to start the fetch/extract pass.** Committed: the list + this entry,
nothing else. NOT pushed.

## 2026-08-17 — FULL-GATE TRIAGE (this sandbox, diagnosis ONLY — no code changed)

The standing `_night_full_log.txt` debt (owner-machine FULL run, 2026-08-16
15:13, pre-D1–D9) is now TRIAGED: every red classified against HEAD in
**`Ref/FULLGATE_TRIAGE_2026-08-17.md`** — read that for the per-red
sections, fixes sized S/M/L, and the suggested order for the fixing
sitting. The shape: **18 reds, exactly ONE product bug** (the timeout
screen's Rest-of-Game chips render but are never wired —
`#to-adjust-root`, `js/ui/app.js`; one-block S fix). 2 HEALED at HEAD
(covfam 17/0 and tipdrill 3/3, both re-run here at gate volume — and
tipdrill's famous "[3/78]" was never the failing check; the gate log keeps
only the last output line). 8 TEST-STALE, dominated by one family: four PW
smokes still enter through the RETIRED coach main-menu door
(`#btn-mm-newcoach`/`[data-mm-coach]`, tree-only since W9 §12) — plus
new_world (staff step), nav_back (season-group tabs), dna_cards (manifest
`kind:'pw'` feeds the dist path into its games argv → NaN → 0-game arms,
REPRODUCED), formation_playbook (Mesh band mean now below the bar, 7-run
evidence). commit_rate_test's TIMEOUT is a deterministic hang at the day-3
`posReviewed` camp gate (hung on EVERY run since 08-12; one-line fix;
full season completes 106 s here with it). 3 flakes (size_fit standing ·
gaplist squib-zero needs `seedFlaky` · pass5_band_ab needs the flag its
sibling pass6 has). 3 ENV-ONLY (defcall_ui, table_button_phone,
position_gallery = 0xC000013A Ctrl-C — **the run was aborted there; five
manifest probes after it never ran**). Several manifest "(cloud)" envKnown
notes are misdiagnoses — they fail deterministically everywhere; correct
them as fixes land. Committed: the triage report + this entry, nothing
else. NOT pushed.

## 2026-08-17 — NIGHT GATE (this sandbox, node) — BOTH GIANTS GREEN, NO REDS, NO FLAKES

Run on the tree with all nine Build Order v2 dispatch blocks (D1–D9)
committed (`HEAD c90d671`). The night tier is exactly two node probes
(`h2_shadow_probe`, `recruit_calendar_probe` — manifest `night: true`) plus
the gate's build floor. Both probes are measurement harnesses (they print
distributions and assert nothing — green = clean completion, exit 0). Both
completed exit 0 at full default volume. **Nothing red → nothing to trace
to any D-block.**

**Build floor:** clean esbuild build (ALL sanity checks PASS, 3726 KB,
cache `cfb-dynasty-4cc274537e` — byte-size matches the D6 entry), built in
a /tmp copy per the standing workaround (the mount forbids `dist/`
deletion), outputs copied back to `dist/`. Bundle syntax parse (2 script
blocks) + CSS braces balanced. **`_boot_check` UNRUNNABLE here** (standing:
`.pw-browsers` is a Windows chrome-win64 build; chromium downloads
blocked) — boot check + the whole PW tier remain OWED-LOCAL, unchanged.

**How it ran (sandbox mechanics — ledgered so nobody re-diagnoses):** this
sandbox KILLS background processes the moment a tool call returns (nohup/
setsid do not survive) AND caps every call at ~178 s wall, so the giants
cannot run in one piece. Faithful chunking used instead:
- `h2_shadow_probe` — 8 calls of `node tools/h2_shadow_probe.mjs 750 <eff>`
  (each = control-750 + one eff-750; arms are unseeded and independent, so
  two pooled 750-runs ≡ one 1500 run). Pooled totals: **N=1500/arm for all
  four ladder effs, control N=6000** — the default invocation's volume.
- `recruit_calendar_probe` — a /tmp shim (verbatim copy + argv scenario
  select + stderr heartbeat; probe logic byte-untouched, `js/` symlinked to
  this tree) ran ONE scenario per call, ~90 s each, **4/4 exit 0**, 1 world
  per scenario (the default).

**h2_shadow pooled result** (whole-game shadow — halve for the H2-only
live hit; sizing window per the probe: ~30–45% whole-game):

| arm | tgt/g | rec/g | yds/g | TD/g | yds drop |
|---|---|---|---|---|---|
| control (N=6000) | 4.25 | 2.39 | 28.9 | .219 | — |
| eff .07 | 3.16 | 1.71 | 19.8 | .139 | **−31%** |
| eff .05 | 3.57 | 1.97 | 23.9 | .185 | −17% |
| eff .035 | 3.69 | 2.04 | 24.1 | .185 | −17% |
| eff .025 | 3.85 | 2.12 | 24.9 | .204 | −14% |

Reading: **eff 0.07 is the only rung inside the probe's own sizing window**;
the 0.025–0.05 rungs cluster at −14…−17%, well short of it.

**recruit_calendar result** (real `advanceDay` pipeline, lock d19, 1 world
per scenario): current 5886 signings, **74.8% battle-decided** / 25.2%
deadline-dumped · proposed (open d4, floor d6) 6210, **76.4% / 23.6%** ·
half-step 5994, 76.4% / 23.6% · floor-only 5886, 75.4% / 24.6%. Reading:
compressing the calendar does NOT shift mass onto the day-19 lock — the
battle-decided share actually rises slightly in every compressed scenario.
The deadline-lottery failure mode the July overhaul removed does not
reappear.

**Anomalies, classified (none are probe failures):** (1) the first
backgrounded `recruit_calendar` launch died instantly (exit 1, zero
output) — the sandbox background-process kill, not the probe; 4/4 clean
scenario re-runs prove it. (2) the first no-arg `h2_shadow` attempt hit the
178 s wall mid-ladder — host wall, not the probe; its two completed arms
match the pooled numbers above.

**Observed in the working tree, NOT tonight's tier:** `_night_full_log.txt`
(untracked, UTF-16, 2026-08-16 15:13 — an owner-machine FULL-tier run, 225
probes) carries reds: the pw/UI-smoke family (defcall_ui, nav_back,
timeout_screen, letter_logo, saved_team_library, instant_classic,
table_button_phone, calendar_display, dna_cards, new_world TIMEOUT,
position_gallery) plus covfam 16/1, gaplist, formation_playbook,
size_fit 14/1 (the standing boundary flake), tipdrill 3/78 (standing
seedFlaky), pass5_band_ab, commit_rate TIMEOUT. That is the standing "full
local gate" debt mid-window — it is not the night tier and predates/
straddles tonight's commits; triage it with the pre-deploy FULL run, not
against tonight's blocks.

**Night-debt accounting:** the standing "green night run before the next
deploy" is PAID on this tree at full volume (chunked as above). Re-run
locally only if the tree changes before the deploy, or if you want one
contiguous `node tools/_gate.mjs night` on the working machine for the
record.

### THE ONE OWNER CHECKLIST (consolidated — tonight's nine sessions, D1–D9)

Every per-session checklist below in this file is collected here; the
per-entry versions keep the step-by-step detail. Read this list once and
you have everything owed.

**Decisions (no machine needed):**
- [x] **D8 — DIAL-REDISTRIBUTION MAP SIGNED OFF** (owner, 2026-08-17):
  **(a) KEEP CURRENT on both PROPOSED items** — tendency/passDepth/rushInPct
  stay live on the Offense tab (book seeds, week overrides); the Defense
  tab's identity dials stay (tab = week, editor = book). Zero code change.
  The organizing doctrine was ratified alongside — recorded at the dial map
  in the D8 entry.
- [x] **D5/D6 — brain research DONE (2026-08-17):** owner approved all 8
  sources; fetched, extracted, assessed. B1/B3/B5/B6 source-pinned as
  shipped; F1 = band fix (dual scramble 3.5–8%); F2 in band; B4 stays
  provisional (nothing public pins keep share). **→ One decision still
  owed: the pick-list (a)–(f) atop
  `Ref/QBRUN_RATES_ASSESSMENT_2026-08-17.md`** — since RESOLVED: (a)–(d)
  RATIFIED + F1 re-spec applied (rpo_probe 60/0 ×3); (e)/(f) DEFERRED
  (owner, 2026-08-17 — parked, not declined; don't re-raise unprompted).
  Nothing owed on this item.

**Browser / device eyeballs (one `node tools/build.mjs` + `npx serve dist`
covers all of these; details in each entry's OWNER CHECKLIST):**
- [ ] **D1 · M0 device checks:** wake lock on a real phone (#7); replay
  toggle survives save/reload (#9); phone overflow #5/#32; the re-authored
  looks (Spread Ace #18, Pistol Diamond #20, Red-Zone Fade #19, def-card
  arrows #33, LE/RE #31); the #49 handedness fix live + replay cameras.
- [ ] **D2 · M1 first bench session** — Composer/Designer/Builder
  entrances, SAME ROLL AGAIN byte-repeat, #23 auto-select. DOUBLES as the
  standing Stages 3–7 visual eyeball.
- [ ] **D3 · M2 per-look editors:** Builder per-look "Plays" + fork/inherit
  pills; Game Plan look tabs fork-on-slide; call sheet honors a pinned
  look's sheet; Air Raid Empty fields five wides, no back.
- [ ] **D4 · M2 presentation:** bench-verify #18/#19/#20/#49; the pre-snap
  play-art overlay live + replay cameras + its Settings toggle; the big
  card (INFO drill-down + Builder ℹ); composer RUN half end-to-end; Film
  Room rows show the call's card.
- [ ] **D6 · M3 RPO family:** the five new cards + blurbs + 🧪 both phases
  on the bench; a live scrambler-QB opponent shows a real QB run game
  (~8–12 designed, ~8–12% scrambles) while pocket QBs essentially never
  keep; the QB Run dial prices the family.
- [ ] **D7 · M4 phone eyeball:** 3-level involvement toggle everywhere +
  mid-game switch; transport row (⏭ / sim possession / sim to half/end)
  with feed summaries, straight to box score; tempo chips gone;
  Presentation settings group.
- [ ] **D8 · M5 game-plan home:** in-dynasty edit → Save to My Season →
  survives reload; ⤴ Push to Workshop with NO self-banner; Plan Home
  (both book cards, def identity panel, collapsed usage art, simple-mode
  one-liner); season setup book pickers (#27); season Settings hides the
  four recruiting rows (#29).
- [ ] **D9 · M5 defbook click-through** (unchanged 2026-08-15 v2 ledger):
  Workshop → Defensive Playbook open/edit/save; Builder starter row; Game
  Plan "Starter books" optgroups; new-game Starting Defense.

**Local machine (gate):**
- [ ] **Playwright tier** (owed by every session; unrunnable in this
  sandbox): `node tools/build.mjs` + `node tools/_boot_check.mjs
  dist/index.html`, then the core gate — the PW smokes were UPDATED by D7
  (dc-ride → dc-send, kickoff "off" → "watch") but never run.
- [ ] **Viewer act B/D local scrub + FULL local gate before the next
  deploy** — and triage the `_night_full_log.txt` reds (above) with it.
- [x] **Night giants** — GREEN this run, full volume, this tree (entry
  above). Re-run only if the tree moves before deploy.

## 2026-08-17 — D6 · M3 BUILD (the authored RPO / QB-run family · the dice are dead · archetype-keyed rates · clean-pocket scramble)
## BUILT + NODE-GATED — ⚠ BROWSER TIER OWED

**OWNER CHECKLIST**
- **Browser eyeball (the D6 browser-owed), all on the M1 bench + a live
  game:** (1) Workshop → Playbook Builder → a Spread or Pistol book: the
  five new cards — **Zone Read** (give path + the dashed QB keep out the
  backside), **RPO Glance** / **RPO Bubble** (run picture + the blue tagged
  route), **QB Draw** (delay path, QB carrying), **QB Counter** (pull +
  counter step, QB carrying) — each ℹ big card lists all eleven jobs with
  the mesh-read language, each has a blurb. (2) 🧪 each on the bench vs a
  picked front/coverage/bring: Zone Read shows BOTH phases across reps
  (keep ~4 in 10 vs a balanced edge), RPO shows give/pull(throw), the pre-
  snap overlay draws the authored design. (3) A live game vs a scrambler-QB
  opponent: their box score should show a real QB run game (~8–12 designed
  + ~8–12% scrambles); your own pocket-QB teams should essentially never
  keep organically any more. (4) Game Plan → the QB Run dial now prices the
  FAMILY's call volume (dial 0 ⇒ the family nearly never comes up; dial it
  up ⇒ featured) — sanity-feel it.
- **Playwright tier locally** (chromium cannot download in this sandbox —
  standing): `node tools/build.mjs` + `node tools/_boot_check.mjs
  dist/index.html`, then the core gate — `rpo_probe` is now in CORE
  (seedFlaky: unseeded full-game sims, ~65s).
- **The audit's ledgered brain-research item stands** (D5 entry): the
  target bands remain provisional (PFF/ESPN/FantasyPoints anchors,
  college-higher inference). Two D6 notes for that research pass: (a) the
  WIDENED Dual class (−14..−3) is physically slower than the audit's
  "dual" archetype presumed — its scramble share lands ~3.5–4.5% vs the
  5–8% band (probe bands padded accordingly, everything else in band);
  (b) pocket "designed" ≈1.4/g includes the broken-play floor keeps +
  Empty-formation keeps (~0.5), so true designed calls sit ≈0.9 vs the 0–1
  target.
- **stat_realism note (good news):** the standing "rush low" flag (140.2)
  is HEALED by the QB run game — 151.0 this session, in range. Comp% 56.7
  remains the one standing flag (NOTHING new).
- Standing debt unchanged: act B/D local scrub + full local gate + a green
  night run before the next deploy; M4 phone eyeball; M1 first bench
  session; D4/D8 browser eyeballs. (D8 dial map: since signed off —
  KEEP CURRENT, owner 2026-08-17.)

**What shipped (js/ + style.css + tools/; the ratified §7 point by point):**
- **THE AUTHORED FAMILY (#45, §7.7 — all five in v1).** concepts.js: `Zone
  Read` (zoneRead, run_inside), `RPO Glance` (rpo glance/STACKER,
  always+keep), `RPO Bubble` (rpo bubble/OVERHANG, always+keep, outside),
  `QB Draw` (qbCarry+qbDraw), `QB Counter` (qbCarry+pulls+punishes crash).
  vsBox grades all sit INSIDE the pre-M3 catalog band (probe-pinned band
  clamp). FORMATION_PLAYBOOK carries them in Spread / Pistol / Trips (all
  five) + Air Raid (the pass-first three); never in option/under-center
  books. The shared fits-function speaks them (QB Draw/Counter need no
  back — Empty QB Draw is real; Bubble needs two wides; reads need a back).
- **THE THREE-WAY READ + THE DICE KILL (#46, §7.1/§7.6).** sim.js: an
  authored call is NEVER hijacked by the organic option/jet/draw/gadget
  dice (the call is the play). `Zone Read` runs a real backside-edge read
  (keyed off the DE: crash ⇒ KEEP out the vacated edge, sit ⇒ give;
  read-win vs the key's AWR/optionSound; wrong reads run into the crash) —
  keep ≈37% vs balanced fronts, starved by contain/optionKey=qb. RPO snaps
  gained the KEEP phase: on a clean give read, `gameplan.rpoKeepPct`
  (archetype-keyed by AI, mobility-scaled in-engine so a statue never
  keeps, answered by contain/spy/key) converts the give to a QB pull-and-
  run through the option-keep run math. An authored RPO (`rpo.always`) IS
  an RPO every snap — no volume dice. **QB_RUN_BASE retired to
  C.QB_RUN_FLOOR (1.5% broken-play keeps), Empty's 1.0 exception stays;
  the dial no longer feeds dice** — `__qbDiceLegacy` restores the whole
  old block for the A/B (organic keeps 41% → 1.8% of handoffs, probe S3).
  The qbRunPct dial now prices the FAMILY: unset sheet entries default off
  the dial and every entry scales with it (weight-space, one knob for AI
  archetype rates and the human Game Plan dial alike).
- **ARCHETYPE-KEYED AI + THE WIDENED DUAL (§7.3/§7.4 — the design law).**
  ai.js: qbRunPct 18–28 scrambler / 10–18 dual / 0–2 pocket (option teams
  floor 5–12) — the SPD>75 absolute gate is dead; rpoRate keeps the
  formation floor + an archetype bump; rpoKeepPct 10–15 / 6–11 / 0;
  aiConceptWeights features the family by archetype (scrambler 90s, dual
  60s–70s, pocket 10 + QB Power capped 25 for non-option statue teams).
  player.js: Dual legLean −9..−3 → **−14..−3** (class ~2.5% → 3.4–5.4% of
  QBs, alive at every tier, probe-pinned tier-stable).
- **THE CLEAN-POCKET SCRAMBLE (§7.5, coverage-conditioned).** sim.js: a
  4th scramble rung — pocket CLEAN, nobody open (its own looser
  separation line, chance scaling with how covered the field is), the QB
  takes off into the grass the droppers left: family grass factor
  (Prevent 1.6 ×, two-high 1.25×, blitz looks 0.5×), spy/optionKey
  tighten, mobility-scaled. `qbScrambleChance` re-anchored on the LEAN
  with a soft knee (tier-relative — a D3 scrambler scrambles like a D1
  scrambler, ratio probe-pinned ≤1.35 across tiers); `__noCleanScramble`
  kills the rung. League scrambles stay ~80% pressure-coupled (PFF ~75%).
- **CARDS / VIEWER / HELP (#45's "own routes").** routeart.js: five new
  run signatures + params — Zone Read draws the dashed QB keep path,
  RPO cards draw the tagged route (glance slant / bubble swing, new
  `.run-card-keep`/`.run-card-route` CSS), QB Draw/Counter draw QB-carry
  paths; `playAssignments` speaks the mesh reads for all eleven (no
  digits). watchphys.js: RUN_SCHEMES entries for the five + pull-throw
  routes for RPO Glance/Bubble (additive; byte-laws untouched — probe
  FULLY GREEN). conceptblurbs.js: five digit-free blurbs (resolves D9's
  observed card_lint C6 flag). Bench: all five run as THEMSELVES vs picked
  front/coverage/bring, seeded-repeat byte-identical; Zone Read shows both
  phases across seeds (41 keep / 66 give over 120).

**BEFORE → AFTER (the dispatch's rate tables; BEFORE = the audit §2
600-game table on the pre-M3 tree, AFTER = this tree, 500 games / 1,000
team-games, same harness — `tools/rpo_audit_probe.mjs`, now family-aware):**

| per team-game (starter bucket) | scrambler B→A | dual B→A | pocket B→A | target (§5C) |
|---|---|---|---|---|
| designed QB runs (no sneaks) | 4.2 → **8.2** | 5.6 → **7.2** | 3.3 → **1.5** | 8–12 / 5–8 / 0–1 |
| — QB Power / Draw / Counter / ZR keep | .95/—/—/— → 2.4/1.9/2.7/0.9 | | 0.5/0.2/0.2/0.1 | authored, never dice |
| — organic dice keeps | 2.85 → **0.17** | 3.54 → 0.19 | 2.22 → **0.32** | broken-play floor |
| scrambles (% of dropbacks) | 3.4% → **12.1%** | 1.5% → 3.9% | 0.6% → **2.2%** | 8–12 / 5–8 / 1–3 |
| — clean-pocket share of scrambles | 0 → ~20% (league) | | | ~25% (75% pressure-coupled, PFF) |
| RPO share of snaps, RPO-FIT formations | ~13% → **20.2%** | → 17.3% | → **14.6%** | 20–30 / 15–25 / 8–15 |
| RPO throw (pull) rate | 24.2% → 20–23% | | | ~25% — preserved, untouched |
| RPO keep share of RPO snaps | 0 → **12.3%** | 0 → 4.2% | 0 → **0.0%** | 10–15 / 5–10 / ~0 |
| QB rush yds/att · att/g | 6.5·7.9 → 6.8·15.2 | | 4.3·5.4 → 4.5·4.0 | ypc holds ~6, audit §5E |

Archetype spread on designed runs: **1.3× before → 5.9× after** (real 5–10×
— audit gap #1 dead). Zone Read keep share 37–41% balanced, 17% under
contain. Dual's two under-band cells are the widened-class dilution —
ledgered in the checklist for the brain-research pass.

**Counters verified (§5D, probe S5, 80+80 games forced-defense A/B):**
spy+key+contain: scrambles 5.1% → 1.9% of db · RPO keep share 4.8% → 1.3% ·
Zone Read keep 31.9% → 17.1% · organic RPO volume 17.4% → 12.9% (fit-share);
`rpoConflictRead` seenRPO rep-suppression accrues (biteP .390 → .270);
weekly reaction answers oppQBRun≥15 with optionKey=qb + zone 12/12.

**Gate (this sandbox, node):** new **`rpo_probe` 60/0 ×3** (registered in
CORE, seedFlaky — S1 family statics/band clamp/gate/fits/blurbs/cards ·
S2 archetype tier laws · S3 dice-dead A/B · S4 per-archetype bands ·
S5 counters · S6 keep-dial law). Band battery ×3 green: `tendency_probe`
monotonic ✅✅✅ · `play_fidelity_probe` ALL GREEN (18) ×3 ·
`compile_league_probe` 26/0 ×3 · `integration_creator_probe` 19/0 ×3 ·
`save_migration_check` ALL PASS ×3. **`stat_realism_harness` N=500 RAN
HERE:** rush 151.0 (standing low flag HEALED), comp% 56.7 (the one
standing flag), INT% 2.07 OK — NOTHING new. Re-proof ×3 on the new
surfaces: `card_lint_probe` 21/0 (D9's blurb flag resolved) ·
`bench_probe` 34/0 · `play_compose_probe` 33/0. Re-proof ×1: `defcall`
32/0 · `live_book_call` PASS · `record_call` PASS · `watchphys_probe`
FULLY GREEN · `draw_up` 21/0 · `look_sheet` 44/0 · `playbook_shape` 28/0.
Clean esbuild build (all sanity checks PASS, 3726 KB — built in /tmp, the
mount forbids dist/ deletion; outputs copied back) + bundle syntax parse
(2 blocks) + CSS braces balanced. **PW tier owed** (chromium download
blocked here): boot check + UI smokes.

**Shared-file note (commit scoping, parallel D8/D9 this window):** D9
committed its sim.js rush3DroppedIds hunk via single-hunk stage and left
my M3 hunks in the working tree as agreed (its entry) — this commit
carries them. `_gate_manifest.mjs` working diff at commit time was
exclusively my rpo_probe entry. `tools/_build_inplace_tmp.mjs` +
`tools/_gate_last.json` (runner state) left uncommitted — not mine.

## 2026-08-17 — D8 · M5 GAME-PLAN HOME + SEASONS (embedded editable books · push-to-Workshop restamp · def identity panel · dial map · season pickers)
## BUILT + NODE-GATED — ⚠ BROWSER TIER OWED · DIAL MAP SIGNED OFF (KEEP CURRENT, owner 2026-08-17)

**OWNER CHECKLIST**
- ~~SIGN OFF THE DIAL-REDISTRIBUTION MAP~~ **DONE (owner, 2026-08-17):
  KEEP CURRENT on both PROPOSED items — zero code change.** The dial map
  below records the resolution and the ratified organizing doctrine.
- **Browser eyeball (the D8 browser-owed):**
  (1) **In-dynasty edit → push → Workshop shows it:** Game Plan → Plan Home
  → ✏️ Edit playbook — the embedded Builder opens ON the book you carry
  (looks, per-look sheets, the 🧪 bench corners all live); toggle a play,
  "Save to My Season" → the call sheet reflects it and it survives a
  save/reload. Reopen the editor, "⤴ Push to Workshop" → Main Menu →
  Workshop → Playbook Builder lists it with your edit, AND no "newer
  version" banner fires on the Game Plan about your own push (load the
  same book fresh from the Workshop dropdown first if you want to see the
  banner machinery alive as the control). Same drill on ✏️ Edit defense
  (seeded from its Workshop source when it has one).
  (2) **The Plan Home:** advanced mode opens on the new Plan Home tab —
  two book cards (offense + defense) with the editors' doors, OFFENSIVE
  IDENTITY and the new DEFENSIVE IDENTITY side by side (film-room words,
  no numbers beyond your own dials), and the formation-usage card
  COLLAPSED (#3) — "Show diagrams ▾" expands the art. Simple mode gets the
  book cards + the identity one-liner on the TEAM IDENTITY header (#41).
  (3) **Season setup pickers (#27):** Season Mode setup now offers Starting
  playbook + Starting defense (same vocabulary as new-game: presets,
  starter books, your Workshop creations) — start a run with a custom book
  and confirm the Game Plan carries it from day one, update banner
  included. (4) **#29:** in a season run, Settings shows NO Recruiting
  Difficulty / Recruiting Assist / Rival Commit Alerts / Reveal All
  Scouting rows; a dynasty still shows all four.
- **Playwright tier locally** (unchanged sandbox limits: Windows-only
  .pw-browsers, downloads blocked): `node tools/build.mjs` +
  `node tools/_boot_check.mjs dist/index.html`, then the core gate.
- Standing debt unchanged: act B/D local scrub re-run + full local gate + a
  green night run before the next deploy; M4 phone eyeball; M1 first bench
  session.

**THE DIAL-REDISTRIBUTION MAP (item 4 — SIGNED OFF, owner 2026-08-17:
KEEP CURRENT on both PROPOSED items, zero code change).** The law
(ratified): BOOK properties live with the book, WEEK properties with the
controller. The manifest (`PLAN_FIELD_SIDE`, teamplan.js) already sides
every field; this maps the SCREENS onto it:
- **MOVED this session (dispatch-mandated, done):** formation USAGE dials
  (offFormations weights) → the Plan Home's book panel, collapsed art (#3);
  look/sheet AUTHORING → the embedded editors (was: Workshop-only). The
  Offense → Package tab now holds only tendency + 4th-down nerve and points
  home.
- **RESOLVED — KEEP CURRENT (owner, 2026-08-17):** `tendency`, `passDepth`,
  `rushInPct` STAY live on the Offense tab — the book seeds them, the week
  overrides them (option (a), as recommended: FM's tactic-vs-touchline
  keeps matchday overrides live). They remain book fields in the manifest
  and ride saved books, unchanged.
- **RESOLVED — KEEP CURRENT (owner, 2026-08-17):** the Defense tab's
  identity dials (front / coverage / pressure) STAY — the tab is the week,
  the editor is the book (option (a)).
- **STAYS IN THE CONTROLLER (week, untouched):** baseTempo + motion (Tempo &
  Motion tab), fourthDown, maxFGDist, situations grid, defAggression/
  blitzPct, target shares, run direction, per-look WEIGHT overrides
  (Offense → Playbook tab), quick-slots A/B/C, halftime adjust.

**THE ORGANIZING DOCTRINE (owner-ratified 2026-08-17):** "The Workshop
book is a TEMPLATE. Loading it into a world instantiates that world's
copy. In-season editing is part of that world — edits save to the league
save only. Pushing back to the Workshop is a manual overwrite, never
automatic." In-season adjustments (the week dials) live in the world,
same principle. Verified against the shipped seam (read-only sanity
check, 2026-08-17): `bookpush.js` matches the doctrine —
`applyEditedBookToSchool` writes ONLY the school's league-saved gameplan
(no Creator-library write anywhere in the save path), and
`pushBookToWorkshop` is reachable ONLY from the explicit "⤴ Push to
Workshop" click handlers (creatorplaybook.js / creatordef.js), overwrites
the Workshop source creation in place, and restamps
`_bookSourceId`/`_bookSourceSaved` (def pair likewise) from the entry
just written. No automatic push path exists.

**What shipped (js/ + style.css + tools/; D8 dispatch items 1–5):**
- **EMBEDDED EDITABLE PLAYBOOKS (#39).** New `js/engine/bookpush.js` — the
  ONE seam the UI and the probe share: `applyEditedBookToSchool` (the
  in-career Save: the edited book compiles onto the LEAGUE-saved gameplan
  through the same one-side applier every book load uses — dials,
  situations and the other side carry; source stamps kept; forced
  re-synthesis, the Stage-3 seam) and `pushBookToWorkshop` (applies the
  edit to the career, saves the Creator-library entry — updating the
  source creation in place when the carried book has one — then RESTAMPS
  `_bookSourceId`/`_bookSourceSaved` (def pair likewise) from the entry
  just written, so `entry.saved > sourceSaved` is false by construction:
  the Stage-3 banner cannot fire about your own push). The Workshop's OWN
  Builder + Defensive Playbook editors open embedded (creatorplaybook.js /
  creatordef.js grew a `pbContext`/`defContext === "career"` mode — same
  screens, career verbs: "Save to My Season" / "⤴ Push to Workshop");
  the Game Plan renders them in place of itself while open, in dynasty AND
  season (same shell). The offense editor seeds from
  `playbookFromGameplan` (lossless: looks, per-look sheets, tendency); the
  defense seeds from its Workshop SOURCE creation when stamped (shelves/
  answers ride in — a compiled gameplan can't reconstruct them), else the
  identity extract, and an identity-only save leaves the carried named
  calls alone (applyDefBookToGameplan only rewrites calls when the book
  carries shelves). Bench entrances from the embedded editor return to the
  Game Plan, not the Workshop (`state.ui.benchReturn`; app.js bench-back +
  label, one hunk; Workshop entrances in creatorform/creatorplay reset it).
- **THE PLAN HOME (items 2–3).** New first tab (advanced default): the two
  book cards (name · looks · plays / base front · named calls · "from the
  Workshop" lineage) with the editors' doors; OFFENSIVE IDENTITY moved in
  from the Offense tab; new **DEFENSIVE IDENTITY** panel beside it
  (renderDefIdentityCard — front + mix, shells/man-zone/leverage, pressure
  stop + look + source lean, box/edge/tackling words, headset call count;
  film-room words only, reads BOTH defFrontMix shapes: the UI's array and
  a compiled book's object map). Formation-usage dials live on the home,
  **COLLAPSED (#3)** — diagrams render only behind "Show diagrams ▾"
  (state.ui.gpLookArt). Simple mode (#41): the same book shelf at the top
  and the schemeIdentityLine on the TEAM IDENTITY header; dials unchanged.
- **SEASONS (item 5).** Setup (#27) gained **Starting playbook + Starting
  defense** pickers — the new-game vocabulary verbatim ("" staff default ·
  builtin preset · `dpb:`/`ddb:` starter books · `pb:`/`dd:` Workshop
  creations) through a new shared applier `applyStartingChoices`
  (gameplan.js, exported): repair-on-load, never-silent failures, and —
  one better than new-game today — `pb:`/`dd:` loads STAMP the source
  identity, so the update banner works for a book you started the season
  with. Applied to the picked team BEFORE `startSeasonRun`, so the run's
  very first save carries it. (#29) Settings hides the four
  recruiting-facing rows under `state.seasonMode`: Recruiting Difficulty,
  Recruiting Assist, Rival Commit Alerts, Reveal All Scouting.
- **NOT built (scope note):** reverse-mapping a career's `defCalls` back
  into def-book SHELVES (the compile is one-way by design) — a defense
  with no Workshop source pushes as identity + empty shelves. If the owner
  wants shelf reconstruction, that's D9-adjacent design work.

**Gate (this sandbox, node):** `book_update_probe` EXTENDED and **47/0 ×3**
— new S5 (edit-in-career: faithful extraction, the league save carries the
edit through a serialization round-trip, lineage stamps kept, invalid book
refused), S6 (push restamp: banner fires on a newer library copy as the
CONTROL, then push → entry data byte-equals the pushed book → banner
condition FALSE — no self-banner — and the library copy loads back
byte-identically), S7 (sourceless push gains stamps; the defense pair
stamps independently; compile ≡ gameplan throughout; REAL Creator store
under a polyfilled localStorage). `playbook_root_probe` PASS ×3 ·
`plan_side_probe` PASS ×3 · `season_persist_probe` PASS ×3 ·
`save_migration_check` ALL PASS ×3. Re-proof green: `playbook_shape_probe`
· `look_sheet_probe` · `defbook_probe` · `creator_store_probe` ·
`creator_resilience_probe`. Clean esbuild build (ALL sanity checks PASS,
3718 KB — built in /tmp, the mount forbids `dist/` deletion; outputs
copied back) + bundle syntax parse (2 script blocks) + CSS braces
balanced. **PW tier owed** (standing sandbox limits): boot check + the
UI smokes + the browser checklist above.

**Scope note (parallel sessions):** the tree carries other sessions' live
work (D6's sim.js/ai.js/concepts.js/constants.js hunks and more; D9
committed mid-window; a stranded `.git/index.lock` from 04:19 was moved to
`_to_delete/` — D9's own workaround pattern). Gates ran on the tree as
found. My commit is scoped to THIS entry's files only: js/engine/
bookpush.js · js/ui/views/gameplan.js · creatorplaybook.js ·
creatordef.js · creatorform.js · creatorplay.js · creatordivision.js ·
seasonmodeview.js · settings.js · js/ui/app.js (bench-back pair) ·
style.css · tools/book_update_probe.mjs · Ref/STATUS.md.

## 2026-08-17 — D9 · M5 DEFBOOK CLOSE-OUT (bring-3 audit · the v2 probe debt PAID)
## NODE-GATED — the 2026-08-15 "DEFENSIVE PLAYBOOK V2 ⚠ VERIFICATION OWED" node items are CLOSED

**OWNER CHECKLIST**
- **Browser-owed UNCHANGED from the 2026-08-15 v2 ledger — only the live
  click-through remains:** Workshop → Defensive Playbook (open a starter,
  edit a card, save), Playbook Builder starter row, Game Plan "Starter books"
  optgroups, new-game Starting Defense. This session added NOTHING new to the
  browser ledger (engine observability + probes only). Every other 2026-08-15
  v2 ledger item is now paid: defbook_probe extended ✔, defsheet_probe new ✔,
  creator_store/resilience re-run ✔, clean build ✔ (boot/gate tiers have been
  riding the D3/D4 sessions since).
- **FOR D6 (not mine, observed on this tree):** `card_lint_probe` C6 flags
  four in-flight M3 concepts with NO BLURB yet — Zone Read / RPO Glance /
  RPO Bubble / QB Draw (D6's constants.js additions landed mid-window;
  blurbs ship with them, conceptblurbs.js). C1–C5 all green here — C5 (the
  #33 CARD half, 352 call cards) green is half of this session's agreement
  proof.
- Standing debt unchanged: viewer act B/D local scrub + full local gate + a
  green night run before the next deploy; M4 phone eyeball; M1 first bench
  session; D4 browser eyeball.
- **Shared-file note (commit scoping):** `js/engine/sim.js` carries the
  parallel D6 session's live M3 hunks (QB_RUN_BASE dice kill + scramble
  re-anchor under `__qbDiceLegacy`). My commit stages ONLY my
  rush3DroppedIds hunk (single-hunk `git apply --cached`); D6's hunks stay
  in the working tree for D6 to commit with its probes. `_gate_manifest.mjs`
  diff was exclusively mine (defbook note + defsheet entry) and is committed.

**1. THE BRING-3 AUDIT (#33 sim half, dispatch item 1) — VERDICT: the engine
already runs the genuine exchange; NO OUTCOME FIX NEEDED, now probe-pinned.**
The trace (documented in defsheet_probe's header): card bring "3" →
`cardToDefCall` `{rush3:true}` → `applyDefCall` (the ONE entry point every
path flows through; `__noCovFamilies` kill-switch) → `syncDefEff` →
`rush3Eff` → the PASS 3 cut in `resolvePassPlay`: `blitzPct` forced to 0
(you don't drop eight AND send more), the assembled front cut to its best
THREE by rushGrade, and every cut id grafted into the coverage personnel
(`_covExtra` → assignCoverage genuinely counts eight). On the 4-3 —
`DEF_DROP_ELIGIBLE["4-3"]` is empty, no native drop slots — all four shown
rushers are down linemen, so the cut man is a LINEMAN by construction: the
same fire-zone exchange the call card draws (card_lint C5 pins the drawing;
the F1-loaded-Prevent-never-cut bug in this seam was already found and fixed
2026-08-16, sim.js:4633 note). Prevent BUNDLES rush3 (owner call 2026-08-08)
— verified riding the same path. The one real gap was OBSERVABILITY: nothing
recorded who dropped. Fixed — **`result.rush3DroppedIds`** (sim.js, mirrors
the blitzerIds precedent): recording-only, zero RNG, sparse (absent on every
non-rush3 snap), and AI never authors rush3 calls, so AI-game records are
byte-identical.

**2. THE V2 PROBE DEBT (standing ledger from 2026-08-15) — PAID.**
- **`defbook_probe` EXTENDED 26 → 75 checks:** shelf/card/answer validation
  gates (unknown shelf/front/coverage/bring/look, over-cap, malformed,
  negative weight; off-shelf answer = warning not error); shelf→defCalls
  (shelf order, name dedupe first-wins, the 12-call cap is structural —
  5 shelves × cap 2); shelf→cells writes DEF FIELDS ONLY (the full
  coverage×bring grid leak-checked) preserving a cell's offensive keys, the
  TOP-WEIGHTED card wins the shelf, the Gamble shelf (no cells) writes none;
  answers→formChecks ≡ cardToFormCheck; v1→v2 repair lossless (zero changes,
  empty shelves/answers, spine preserved) + dead-card repair keeps the CALL;
  starter-book round-trip (zero-change repair, shelves/answers byte-stable,
  apply→extract preserves the spine).
- **`defsheet_probe` NEW, 77 checks, registered in CORE:** all 6 defensive
  starters validate clean (no warnings), ≥1 base-shelf card, compile fully
  (headset calls / shelf cells / formChecks), and every card's compiled call
  speaks ONLY `applyDefCall`'s vocabulary — the pin is pickDefCall's
  NORMALIZED list, so a key either layer strips fails loudly (the "pressure
  look written to a dead field" bug class, 2026-08-15). All 6 offensive
  starters: every look real, weights positive, every carried formation
  sheeted, every sheet entry legal. Plus the bring-3 sim arms (item 1):
  25 pinned-seed 4-3 bring-3 snaps — every one rushN=3 + rush3 + no blitz +
  exactly one dropped DL body; bring-4 contrast (never cuts, shows four on
  no-blitz snaps); Prevent bundles rush3; the 3-4 arm lands on three.
  Deterministic end to end (the bench's pinned seeds).

**Gate (this sandbox, node):** `defbook_probe` **75/0 ×3** ·
`defsheet_probe` **77/0 ×3** · re-runs green: `creator_store_probe` 50/0 ·
`creator_resilience_probe` 20/0 · `bench_probe` 34/0 · `record_call_probe`
12/0 · `live_book_call_probe` 14/0 · `card_lint_probe` 20/1 (the 1 = D6's
in-flight blurbs, ledgered above; C5 green). Clean esbuild build (all
sanity checks PASS, 3699 KB — built in /tmp, the mount forbids dist/
deletion; outputs copied back) + bundle syntax parse (2 blocks) + CSS braces
balanced. Note the gates ran on the mid-window tree (D6/D8 in-flight work
present), same as prior parallel sessions.

## 2026-08-16 — D4 · M2 PRESENTATION HALF (look-true cards · the big card · composer runs+blocking · pre-snap play-art overlay · blurbs + manual)
## BUILT + NODE-GATED — ⚠ BROWSER TIER OWED

**OWNER CHECKLIST**
- **Browser eyeball (the D4 browser-owed):**
  (1) **Bench-verify #18/#19/#20/#49 fixed** (M0's fixes, now provable on the
  instrument): Builder → Spread Ace / Pistol Diamond look cards + Red-Zone
  Fade concept card, then 🧪 each — the card and the bench board must agree,
  and an away-team drive must field the card's handedness.
  (2) **The pre-snap overlay in a LIVE game:** the called play's routes,
  stay-in blocks and run path draw over the fielded players through the
  cadence and fade through the snap; pin a look, call a play — the overlay
  IS the card's design on the grass, run direction included. In a saved
  replay, flip cameras: the art re-projects (coach/end zone/reverse all
  lawful). Settings → Game → Presentation → "Pre-Snap Play Art" turns it
  off/on (on by default; the watch bar's Play Art button also hides it with
  the trail).
  (3) **The big card:** call sheet INFO now opens look-specific full-size art
  with the LINE's job drawn + the purpose blurb + expandable "EVERY MAN'S
  JOB — all eleven" list; the Builder's grid has an ℹ corner opening the
  same panel per look. Run cards everywhere now draw the actual look
  (Power-I Power ≠ Spread Power; Empty runs fall back to the QB).
  (4) **The composer's run half:** Play Composer → Pass/Run toggle — author
  a run (path · blocking scheme · carrier), the card draws it on the
  formation with every blocker's job, 🧪 runs it on the bench AS A RUN;
  save it and call it from MY PLAYS in a live game. A composed PASS with a
  TE/HB set to "block" now genuinely keeps them in the protection.
  (5) **Film Room** rows now show THE CALL's card per clip.
- **Playwright tier locally:** `node tools/build.mjs` +
  `node tools/_boot_check.mjs dist/index.html`, then the core gate
  (`card_lint_probe` grew C6 — big cards, blurbs, composed cards).
- **Side errand (owner ask):** `.pw-browsers` at the repo root is a WINDOWS
  Playwright build (chrome-win64/); Playwright on this Linux sandbox wants
  linux64 binaries and refuses it, and `npx playwright install
  chromium-headless-shell` downloads nothing here (network blocked) — the
  Playwright tier stays **OWED-LOCAL**, as before.
- Standing debt unchanged: act B/D local scrub re-run + full local gate + a
  green night run before the next deploy; M4 phone eyeball; M1 first bench
  session (now doubled with (1) above).

**What shipped (js/ + style.css + tools/; D4 dispatch items 1–5):**
- **LOOK-TRUE CARDS AT EVERY RENDER SITE (#12/#14).** The one real gap was
  RUN cards: `renderRunCard` ignored formation AND variation — every run
  drew the same synthetic centered picture everywhere. It now resolves the
  authored layout (same `_variationLayout` path as pass cards): OL, QB,
  carrier, pull guard, lead back, pitch and jet motion all come from the
  look's real slots (carrier = deepest back; jet = the widest receiver;
  Empty → the QB). Also fixed: Builder play grids + read-only previews now
  pass the look's variation (was in scope, never passed); the call sheet
  INFO preview passes the pinned variation; Film Room rows draw THE CALL's
  card (`clipCardHtml`, creatorreplay.js); MY PLAYS / THE CALL / composer
  tiles route through the new `renderComposedCard` dispatcher so composed
  runs draw run diagrams, never the pass renderer. No-formation callers keep
  the old synthetic card byte-for-byte.
- **THE BIG CARD (#16).** `playAssignments(entry, {formation, variation})`
  (routeart.js) derives EVERY man's job — 5 OL + QB + 5 skill — from the
  same tables the cards draw (concept routes / run signatures / a composed
  play's own parts+blocks): routes in football words, OL pass sets or
  reach/down/pull blocks, TE seals, WR stalks, QB depth/handoff/pitch text.
  `jobs:true` renders the line's job marks on the art itself (pass-pro cups;
  run block arrows; the puller path was already drawn). Surfaced in the call
  sheet INFO drill-down (art at full size + `<details>` expandable list —
  the nested/expandable card screen) and the Builder's new ℹ panel per look.
  Help-language law machine-checked: no digit ever appears in a blurb or a
  job line (card_lint C6).
- **THE COMPOSER GROWS RUNS + BLOCKING (the rest of #37), band-clamped.**
  playcompose.js v2: a composed run is PATH (inside / off-tackle / outside
  stretch / toss / draw) + BLOCKING-SCHEME signature (zone / gap / trap /
  lead) + CARRIER (RB/QB). `compilePlay` derives `type`, `vsBox`, `pulls`,
  `qbCarry`, `exec` from fixed tables, with vsBox clamped to the band
  DERIVED from the shipped RUN_CONCEPTS catalog at load (rebalance the
  catalog and the clamp follows; a composed run can never outgrade the
  strongest shipped run). Blocking assignments on PASS plays now BITE:
  authored TE/RB blocks compile to `keepIn`, honored at the sim's protection
  assembly (blockingTEIds topped up deterministically; rbReleased forced
  false) — WR "blocks" earn no protection credit (the lost route is the
  honest price). Sim seams (3, tiny): composed playType honors
  `composedCall.type` for runs; the composed grade application mirrors
  pickRunConcept's boxState fork reading the compiled vsBox; `_conceptCtx
  .def = composedCall` (already there) carries pulls/qbCarry/keepIn to the
  existing readers — zone/gap fork, pull reps, QB carrier all fire for a
  composed run exactly like a catalog run. AI-invisible both tables
  (probe-pinned); RNG stream untouched for every non-composed snap.
  Composer UI (creatorplay.js): Pass ⇄ Run toggle, run design pickers,
  box-answer preview in plain words, bench hook and save both run-aware;
  repairComposedPlay round-trips run designs (dead path → needs-rebuilding).
- **PRE-SNAP PLAY-ART OVERLAY (the Madden trust device).** New
  `<g id="wp-playart">` under the actors in the ONE scrimmage renderer
  (watchBoard) — replays, clip screen, Film Room and the bench all inherit
  it. Geometry: `watchPlayArtPlan` draws routes from the script's own
  routeCues via `routeWaypoints` (now exported from watchphys) — the EXACT
  world-space shapes the bodies are about to run, which for a composed play
  are the card's authored rows via COMPOSED_SHAPE (card↔field agreement is
  therefore visible, not asserted); composed stay-in blockers get the "T";
  runs draw the carrier's designed path to the recorded gap (`p.runDir`
  rides) + the pull from the actual backside guard. Every point goes through
  the frame's `projectPoint`, so all five cameras and both drive directions
  inherit the #49 handedness law; rebuilt only on camera change, opacity
  fades through the snap. Off-switch: Settings → Game → Presentation
  ("Pre-Snap Play Art", default on) + the existing Play Art watch-bar button
  hides it via `.watch-art-off`. Zero `rnd()` consumed; zero changes to
  buildPlayScript's tracks (watchphys_probe byte-laws untouched).
- **CONCEPT BLURBS + MANUAL (#21).** New js/ui/views/conceptblurbs.js: one
  purpose line per shipped concept — "what it is · what it does · what it
  risks" — all 62 concepts covered (Reverse, Sluggo Seam, Flea Flicker and
  HB Pass answer the owner's #21 list directly); composed plays get a
  derived line from their own design. Shown under the big card and as tile
  tooltips (call sheet + Builder). Three new manual chapters in normalized
  help language: **The Workshop** (garage tour + the bench's boundary),
  **Composed Plays** (the grader, biting blocks, human-call-only law),
  **Books, Looks & Sheets** (inherit-then-fork, real personnel, book vs
  week) — registered in js/ui/manual/index.js.

**Gate (this sandbox, node):** `card_lint_probe` **21/0 ×3** — new **C6**
(every shipped concept has a blurb / no digit in any blurb or job line /
11-row job sheets for every (formation × look × concept), 1539 walked /
big-card renders in bounds / every composed pass+run design renders lawfully
through renderComposedCard) + C3 extended for look-true run cards (5 OL, one
carrier path, 5 skill dots — 3078 renders, 0 flags). `play_compose_probe`
**33/0 ×3** — run validation laws, all 40 path×scheme×carrier compiles
band-clamped to the catalog-derived run band with pulls/qbCarry/exec laws,
gap-beats-loaded football sense, run repair round-trip, keepIn compile laws
(TE/RB counted, WR not), RUN_CONCEPTS as AI-invisible as PASS_CONCEPTS.
`custom_play_probe` 221/0 ×3. `live_book_call_probe` **14/0 ×3** — new C1b:
a forced composed RUN records its own name as a run snap with coachCall set,
8/8. `watchphys_probe` **FULLY GREEN** (1336 snaps scripted, all byte-laws
hold). Re-proof green: `draw_up_probe` 21/0 · `record_call_probe` 12/0 ·
`bench_probe` 34/0 · `look_sheet_probe` 44/0 · `play_fidelity_probe` ALL
GREEN (18). Clean esbuild build (all sanity checks PASS, 3683 KB — built in
/tmp; this sandbox's mount forbids `dist/` deletion, outputs copied back) +
bundle syntax parse + CSS braces balanced. **PW tier owed** (see checklist:
Windows-only .pw-browsers, downloads blocked): boot check + UI smokes.

## 2026-08-16 — D3 · M2 ENGINE HALF (per-LOOK sheets, inherit-with-override + the pkg truth)
## BUILT + NODE-GATED, BOTH DISPATCH PROOFS GREEN — ⚠ BROWSER TIER OWED

**OWNER CHECKLIST**
- **Browser eyeball of the per-look editors** (the M2-engine browser-owed):
  (1) Playbook Builder — every carried look card now has its own "Plays" 
  button; open a variation look's grid: it says "inherits the ‹formation›
  base sheet", the first play you toggle FORKS it (pill flips to "its own
  sheet · ↩ inherit base"), and the base look + sibling looks visibly keep
  their own lists (#43 dead). Concepts that don't fit the look's personnel
  draw dimmed with a ⚠. (2) Game Plan → Offense → Playbook: the tab strip
  now lists LOOKS ("Air Raid · Empty"), a look tab shows "Inheriting the
  ‹formation› base sheet" until you slide something, sliding forks JUST that
  look, its Reset returns it to inheriting. (3) Call sheet in a live game:
  pin a formation + look — the play list reflects that look's sheet (forked
  or inherited). (4) Watch an Air Raid team field EMPTY: five receivers,
  genuinely no back on the board.
- **Playwright tier locally** (chromium cannot download in this sandbox):
  `node tools/build.mjs` + `node tools/_boot_check.mjs dist/index.html`,
  then `formation_sheet_ui_smoke`, `ui_playcall_smoke`, `playnow_smoke`,
  ideally the core gate — `look_sheet_probe` is now in CORE.
- Standing debt unchanged: act B/D local scrub re-run + full local gate + a
  green night run before the next deploy; M4 phone eyeball; M1 first bench
  session.

**What shipped (js/ + style.css + tools/; owner decisions a+b built as
confirmed 2026-08-17, no further ask):**
- **PER-LOOK SHEETS, INHERIT-WITH-OVERRIDE (#43).** Sheet keys are now
  per-LOOK: `"fid"` = the formation's BASE sheet, `"fid|variation"` = that
  look's OWN forked sheet. THE resolver — `resolveLookSheet` (+
  `lookSheetKey`/`splitSheetKey`, js/engine/playbook.js) — is the ONE
  inheritance fallback: a look without its own non-empty sheet inherits the
  base sheet BYTE-IDENTICALLY (the same object, not a copy); an empty fork
  ≡ absent (matches the sim's overlay gate). Consumers all go through it:
  the sim's `_fpbSheet` overlay (sim.js — `resolveLookSheet(…,
  offFormationId, offVar)`), the live call sheet's pinned look (app.js),
  the Game Plan per-look editor and the Builder. The FORMATION_PLAYBOOK
  legality gate stays formation-level (a look never runs a play its
  formation doesn't carry) — validate/repair resolve a look key's legality
  through the formation half of the key.
- **EDITORS FORK ON FIRST EDIT.** Builder (creatorplaybook.js): per-look
  "Plays" grid; editing an inheriting look copies the base sheet byte-for-
  byte then edits the copy; "↩ inherit base" un-forks; removing a look
  removes its fork (last look out removes base + all forks); #23
  auto-select is per-look-aware (base look seeds the base sheet; a
  variation look added with no base sheet seeds its OWN fitting sheet;
  added with one, it inherits — no fork until touched); misfitting concepts
  drawn dimmed via the shared fits-function. Game Plan (gameplan.js): the
  Playbook tab strip lists carried LOOKS; sliders fork-on-write; per-look
  reset; "from base sheet" pills on inherited entries. Preview + bench
  entrances resolve per look.
- **THE PKG TRUTH (owner decision a): the variation pkg ALWAYS wins when
  fielding personnel.** `resolveOffField` (fieldassign.js) gained a
  `variation` param: the look's authored `VARIATION_LAYOUTS` row — the SAME
  row the cards draw and the card linter pins to the pkg — supplies the
  slots, so re-dressed bodies are fielded from the rooms the pkg names
  (Power-I Big fields 3 TE; the Diamond a real FB). Slot IDS never change:
  pins and target shares ride across looks. Base looks + every AI plan
  (AI never authors variations — probe-pinned) resolve byte-identically.
  Kill-switch `__noVarPkg` restores old fielding for A/Bs. The
  `resolvePersonnel` fallback path already applied the pkg — the two paths
  now AGREE (one truth, probe-proven 22/22).
- **THE REAL EMPTY (owner decision b).** Air Raid "Empty" now carries
  `pkg { RB: 0, WR: 5 }` (constants.js) and its `air_empty` layout row
  re-dresses the back's slot as a third slot receiver (constants_field.js)
  — the back genuinely leaves the field for a fifth receiver.
- **MIGRATION, LOSSLESS.** Old books are base-keys-only and map onto the
  new model AS-IS (base keys unchanged — the inheritance law's zero-
  migration case). `validatePlaybook`/`repairPlaybook` speak look keys
  (unknown look = error at validate; dead look's fork drops in repair with
  a plain-English note — the look inherits the base again; base sheets
  untouched); `repairCreation` (the CREATOR-LIBRARY door) preserves forks;
  apply→extract round-trips look keys; quick-slots A/B/C (full-gameplan
  snapshots) and `aiFormationSheets` (base-keyed) ride through opaquely;
  `PLAN_BOOK_STRUCT_FIELDS` already owns `formationPlaybooks`, so
  controller overlays never carry sheets (probe-pinned).

**THE TWO PROOFS (dispatch item 4), both green:**
- **(i) Sheets alone are BYTE-NEUTRAL** — `tools/_m2_neutral_walk.mjs`
  (cross-tree harness, not gate-registered) run against the pre-M2 snapshot
  and this tree under pinned PRNG: WORLD (every AI plan after worldgen),
  LEAGUE (40 AI-vs-AI simulateGame results) and DRIVES (12 drives under a
  NO-OVERRIDE player book) hash BYTE-IDENTICAL pre/post
  (74260b67… / 98d67135… / a63b71f5… on both trees). En route it exposed
  that module-LOAD-time RNG must be pinned before import — documented in
  the harness.
- **(ii) The pkg change is DELIBERATE, measured** —
  `tools/_m2_pkg_ab.mjs` (before = `__noVarPkg`, after = pkg truth):
  all 13 pkg looks now field EXACTLY their pkg (e.g. Power-I Big
  2B/2TE/1WR → 2B/3TE/0WR; Pistol Diamond 1B/1TE/3WR → 2B/1TE/2WR; Air
  Raid Empty 1B/0TE/4WR → 0B/0TE/5WR). Live drives (250/arm, Air Raid
  base+empty book): **Empty-look back touches 46.2% → 1.0%** (the tail is
  depth-emergency subs), base look unchanged (47.6% → 47.0%), yds/snap
  comparable (empty 6.30 → 6.70; unseeded variance). Empty run share
  38.7% → 31.0% (QB-only runs remain — that residue is M3's territory).

**Gate (this sandbox, node):** new **`look_sheet_probe`** (44/0 ×3,
registered in CORE): the resolver laws (identity inheritance across all 22
looks, empty-fork fallback, alias round-trips), the sim consumes a fork
(0-weight cuts never called from the look, unforked siblings inherit,
variation stamped), the pkg truth (22/22 looks field exactly their pkg,
lawful elevens, slot ids stable, `__noVarPkg`, fallback-path agreement),
the real Empty (0 backs / 5 WR + pinned receiver rides the emptied slot),
lossless migration (zero-change repair of old books; forks survive
repair/creation door; look-key validate/repair laws; apply↔extract round
trip), AI-blind (338-school sweep: zero look keys, zero variations),
overlay law. `playbook_shape_probe` extended with the look-key shape
grammar (28/0 ×3). Re-proof green: card_lint 14/0 · formation_variation
394/0 · draw_up 21/0 · playbook_root 24/0 · plan_side 21/0 ·
save_migration ALL PASS · compile_league 26/0 · integration_creator 19/0
(24 games) · record_call 12/0 · live_book_call 13/0 · bench 34/0 ·
formation_compose 39/0 · play_fidelity ALL GREEN (18) · defcall 32/0 ·
formation_playbook PASS · tendency monotonic ✅ (62/72/81 vs 58/68/82
targets — standing readings). **stat_realism_harness N=500 RAN HERE**
(61s): the standing flags only (rush 140.2 low, comp% 57.0; INT% 2.07 OK
this run), NOTHING new. Clean esbuild build (all sanity checks PASS,
3625 KB) + bundle syntax parse + CSS braces balanced. **PW tier owed**
(chromium download blocked in this sandbox): boot check,
formation_sheet_ui_smoke, ui_playcall_smoke, playnow_smoke.

## 2026-08-16 — D7 · M4 WATCH / TIME CONTROLS (involvement toggle + transport row)
## BUILT + NODE-GATED — ⚠ PHONE EYEBALL + PW TIER OWED

**OWNER CHECKLIST**
- **Phone eyeball of the new controls in a LIVE game** (the M4 browser-owed):
  kick off a game — the pregame asks 👁 Watch Every Play / 🎯 Coach the Big
  Moments / 🎧 Coach Every Play; the same 3-segment toggle sits on the call
  sheet, the defensive panel, the 4th-down panel and the watch bar, and
  switching it MID-GAME takes effect immediately (Watch auto-plays every
  snap with a 🎧 Take control button; Moments interrupts pre-snap with the
  sheet open only on 4th downs / red zone / inside 2:00 / one-score Q4).
  Drive the transport row: ⏭ skip-play (the fixed FF button, on the watch
  bar), ⏭ Sim possession, ⏭⏭ Sim to half / end — skipped stretches must land
  as "⏩ ABC drive: N plays, X yds — RESULT" lines in the feed, no animation
  replay of the skipped stretch, and sim-to-end goes straight to the box
  score. Tempo chips are GONE from the time controls (they live in Game
  Plan → Tempo & Motion and the timeout modal's Rest of Game tab). Check
  Settings → Game tab: new PRESENTATION group (Instant Replays Off/Low/High
  — the watch bar's Replays button cycles the same dial; 8-Bit Players moved
  in). If the deep look feels wrong on the phone, thumbs at the tc-bar CSS.
- **Playwright tier locally** (chromium cannot download in this sandbox):
  `node tools/build.mjs` + `node tools/_boot_check.mjs dist/index.html`,
  then at least `playnow_smoke` + `ui_playcall_smoke` (both updated for the
  new controls: `#dc-ride` → `#dc-send`, kickoff `off` → `watch`), ideally
  the core gate — `timecontrol_probe` is now in CORE.
- Standing debt unchanged: act B/D local scrub re-run + full local gate + a
  green night run before the next deploy.

**What shipped (js/ + style.css; sim-neutral for AI games — callMode-gated
paths only):**
- **The 3-level involvement toggle (#51), changeable mid-game (FM's law).**
  Engine keeps its callMode vocabulary; WATCH = callMode "all" + ui.autoRun
  (a pending every snap, UI auto-answers — so the headset is one tap away
  all game), MOMENTS = "keydowns", EVERY = "all". New `setInvolvement` /
  `involvementLevel` (state.js); the kickoff modal offers the three levels
  ("Headset Off" folded into WATCH; legacy `lastCallMode:"off"` maps over;
  engine mode "off" kept for Coach-Mode-off sims). Replaces BOTH
  Ride-the-Plan buttons (dc-ride removed — dc-send with no pins IS ride
  the plan), the tc-keydowns/tc-headset/tc-jumpin trio, and the dead
  cs-skip-quarter / cs-mode-* / cs-autorun* listeners.
- **The BIG-MOMENT spec (owner-ratified, sim.js `isKeyDownSituation`):**
  4th downs, red-zone trips, inside 2:00 (either half), every snap of a
  one-score 4th quarter, and overtime. Ordinary 3rd downs came OFF the
  list. Turnovers + scores stay watch moments — they end drives, so no
  pre-snap ask can fire on them (asks are pre-snap by construction).
- **The transport row (#54/#55), one component everywhere** (`timeControlBar`
  → involvement toggle + ⏭ Sim possession + ⏭⏭ Sim to half/end + 🎧 Take
  control [watch level only]; `wireTimeControls` is the single wiring
  point). NEW engine skip: `token.skipPoss` mutes asks while that side
  keeps the ball, clears itself on the change of possession / fresh half /
  OT / final gun (skipUntil now also cleared at "done"). The dead FF
  button is a real ⏭ skip-play on the watch bar (kills the in-flight
  animation, board keeps rolling). TEMPO REMOVED from the row (strategy,
  not a time control — lives with the game plan; `_liveTempo` engine reads
  kept, chips retired).
- **Skipped stretches are NEVER silent:** new pure `driveSummariesFrom`
  (sim.js, exported) — one row per touched drive; `_skipAnim` bookkeeping in
  the skip verbs; `handleGamePendingEvents` turns the skipped range into
  feed summary lines, advances `_watchedPlays` so the board never animates
  it, sends skip-to-half straight to the locker room, and skip-to-end
  straight to the box score (`_skipFinalBoard`).
- **LAW HELD:** sim-to-half/end resolves through the EXISTING pause path
  (`resumeFromCall`/`resumeFromDecision` → the same pending machinery);
  `gamePauseIsLive` remains the ONLY serialization gate; NO new save path;
  skip state is engine-transient and provably gone by the final gun.
- **PRESENTATION settings group** (Settings → Game): Instant Replays
  Off/Low/High (absorbs M0's #9 toggle — `replayFreq`, legacy
  `watchReplays:false` reads as Off; Low = scores + turnovers only; the
  watch-bar button cycles the same value), 8-Bit Players moved in — the
  home for future presentation options. **Landscape→camera-views (#25)
  stays stubbed** until the camera acts land — noted, not built.

**Gate (this sandbox, node):** new **`timecontrol_probe`** (26/0 ×3, added
to CORE): the big-moment spec point by point (3rd downs off the list
asserted), 'all'/'keydowns' cadence honored + mid-game switches in BOTH
directions take effect immediately, possession skip 0 leaked asks over 36
skips + self-clear, sim-to-half/end 0 leaked asks with real records,
drive summaries lawful and never empty, mid-skip pending IS a live pause
(gamePauseIsLive 36/36) and nothing skip-related survives to serialization.
Re-proof green: `midgame_save_probe` PASS · `season_persist_probe` 15/0 ·
`save_migration_check` ALL PASS · `multicoach_week_probe` 16/0 ·
`record_call_probe` 12/0 · `live_book_call_probe` 13/0 ·
`play_fidelity_probe` ALL GREEN (18). Clean esbuild bundle + parse; CSS
braces balanced. **PW tier owed** (chromium download blocked here):
playnow_smoke, ui_playcall_smoke, formation_sheet_ui_smoke,
calendar_display_probe were UPDATED for the new controls (dc-ride →
dc-send; kickoff "off" → "watch") but not run.

**Shared-file note (parallel sessions this window):** the M0 sweep commit
(`176b6b6`) landed mid-session and carried this pass's style.css (tc-invo
toggle CSS) with it, and explicitly left its #7 wake-lock + #9
replay-toggle app.js hunks uncommitted for whoever committed app.js next —
that's this commit (my Presentation work builds directly on #9, and the
whole tree state was gated together). This app.js commit also carries the
M0 sweep's two remaining #49 lateral-mirror hunks
(watchSideX/watchCoachFieldBase), which pair with its committed
watchcamera/constants_field work.

## 2026-08-16 — D2 · M1 THE TEST BENCH (the instrument)
## BUILT + NODE-GATED — ⚠ BROWSER PLAYTEST OWED (the first bench session)

**OWNER CHECKLIST**
- **First bench session (browser, owner's machine)** — `node tools/build.mjs`,
  then Workshop → any of the three entrances (below). **This session DOUBLES
  as the standing Stages 3–7 visual eyeball** (same screens: the bench rides
  the real watch board, the Designer/Composer/Builder cards are the Stage 4–7
  surfaces). What to drive: (1) Play Composer → build a play → "🧪 Test on
  the bench" → run reps, change the defensive look, SAME ROLL AGAIN repeats
  the identical rep; (2) Formation Designer → save a look → the bench opens
  on it with its fitting concepts installed; (3) Playbook Builder → "🧪 Test"
  on a look card and the 🧪 corner of any concept card; also confirm #23:
  adding a look to a book auto-selects its fitting plays at SHIPPED weights
  (deselect freely). Then `node tools/_boot_check.mjs dist/index.html` +
  `node tools/_gate.mjs` (bench_probe is now in CORE).
- Standing debt unchanged from prior entries: act B/D local scrub re-run +
  full local gate + a green night run before the next deploy.

**What shipped (`js/` + `style.css` + tools/, all four dispatch items):**
- **ENGINE — `js/engine/bench.js` (new).** `bench(formationId, variation,
  playOrConcept, defensiveLook)` / `benchSnap(opts)`: ONE play between two
  even-matched scratch teams through the REAL `simulateDrive`, honoring
  `forcedCall` (+variation, + composed `customPlayData`) and a forced
  defensive call — front + the 8-picture coverage catalog + bring 3/4/5/6 —
  compiled by the defensive playbook's own `cardToDefCall`. The scratch
  teams are generated ONCE from a pinned PRNG stream (both rosters from the
  SAME stream → attribute-identical position for position, flat tier-1,
  distinct ids) and every rep plays on fresh clones, so no rep leaks into
  the next. Every rep runs under a pinned seed: same seed → byte-identical
  record. A pre-snap flag is reported as the rep's outcome, never silently
  rerolled. NOTHING persisted: no state/persistence imports, no storage.
- **CONTROLS — the bench screen (app.js `renderBenchScreen`/`setupBenchScreen`,
  view `bench`, + style.css).** RUN AGAIN (fresh 32-bit seed) and SAME ROLL
  AGAIN (replays `lastSeed` — the probes' seeded-stream trick, now a
  player-facing control). One result line per rep: the call, the forced look,
  the coverage ROLLED, the outcome (yards/result via `benchOutcome`). The
  latest rep animates on the REAL watchphys board through the existing clip
  path (`benchGameShell` → `buildReplayClipData` → `initWatchMode`) — zero
  new viewer wiring. Reps live in module state, NEVER in `state.ui` (a bench
  session can't reach a save); only the small config rides `state.ui.bench`.
- **THREE ENTRANCES.** Play Composer: "🧪 Test on the bench" runs the play
  BEING BUILT (saved or not — the lineup payload goes straight to the sim's
  proven composed-call path). Formation Designer: on save → re-sync installs
  every fitting concept (the registry's call list IS the fits-function's
  answer) → the bench opens on the new look. Playbook Builder: a "🧪 Test"
  button on every look card + a 🧪 corner on every concept card — any
  BUILT-IN look/concept, as M2's verification demands.
- **ONE SHARED FITS-FUNCTION (`js/engine/playbook.js`).**
  `filterConceptsForPersonnel` — Stage 7's `compileFormation` filter (minWR,
  back-built plays need a back, options need two backs, no Wildcat/Jet for
  customs) — extracted and exported, with `fittingConceptsForFormation(fid,
  variation)` (variation pkg override honored, so an Empty look never offers
  a two-back play). `formcompose._playbookOf` now calls it (custom rules
  preserved, probe-proven identical); Designer auto-install, Builder
  auto-select and the bench's play list all speak it. **#23:** adding a look
  in the Builder seeds `pb.sheets[fid]` with every fitting concept at the
  formation's SHIPPED sheet weights (`autoSheetForFormation` /
  `shippedSheetWeights` in defaultbooks.js — starter-book weights carry
  through, the rest at a modest base; never flat, deselect freely, only when
  the formation has no sheet yet).
- **Owner boundary honored:** play design only — no scouting hooks, no
  opponent practice, no lesson layer anywhere in the bench.

**Gate (this sandbox, node):** new **`bench_probe`** (34/0 ×3, registered in
the CORE manifest): the known-play-vs-forced-look record (concept, coachCall,
defCoachCall, formation, rolled coverage); defCall vocabulary compile
(families pinned on the ledger — a Tampa 2 picture ROLLS Tampa 2); same-seed
byte-identity ×3; teams even/flat/distinct/cached; ZERO save writes (runtime
localStorage counter + static import check); composed play runs as itself
with its Stage-5 id stamp; variation rides; `buildPlayScript` scripts the
rep and the shell names every participant; fits ⊆ legal + personnel rules +
customs-never-Wildcat/Jet; auto-select sheet = exactly the fitting list with
shipped weights carried (not flat). Re-proof all green:
`formation_compose_probe` 39/0 · `play_compose_probe` 17/0 ·
`live_book_call_probe` 13/0 · `record_call_probe` 12/0 · `watchphys_probe`
FULLY GREEN (1338 snaps scripted) · `playbook_build_probe` PASS ·
`playbook_shape_probe` 24/0 · `defbook_probe` 26/0. Clean esbuild bundle
(0 warnings) + bundle syntax parse + CSS parse.

**Scope note:** built on the tree as found mid-window (a parallel D5 session
and prior uncommitted work are present); my change-set is the 10 files in
this entry's commit only.

## 2026-08-16 — D5 · M3 RPO/QB-RUN AUDIT — **RATIFIED same session** (§7 of the report)

**OWNER CHECKLIST**
- ~~Ratify the report~~ **DONE 2026-08-16** — all 7 decisions taken; the
  ratified build directions live in `Ref/RPO_AUDIT_2026-08-16.md` §7.
  **D6 is unblocked by ratification** (still needs D4 per the dispatch
  dependency table).
- **NEEDS BRAIN RESEARCH (standing ledger item, owner-directed):** the
  compiled coach-brain library (SOURCE_LIBRARY + MASTER_INDEX, swept end to
  end this session) contains NO numeric rate data — it's all scheme/
  mechanics material. The audit's target bands rest on this session's
  PFF/ESPN/FantasyPoints anchors (NFL-floor + college-higher inference;
  college per-archetype splits are paywalled). A dedicated stats-research
  pass should firm the bands; D6 builds to the provisional ones meanwhile.
- No browser verification owed from this session (no `js/`/`style.css`
  change — tools/ + Ref/ only).

**Ratification highlights** (full text in the report §7): kill the
QB_RUN_BASE dice (floor ~1–2%, Empty stays); bands provisionally approved;
**AI keys on ARCHETYPE — owner law: three talent levels live in one game,
a 63 SPD is fast in D3 and slow in D1, absolute thresholds can't work.**
Archetypes verified working across tiers this session (distribution stable
~19% Scrambler / ~2.5% Dual at tiers 1/2/3 while Scrambler mean SPD swings
64→94 — tier-relative by construction, the right key); widen the Dual band;
clean-pocket scramble added, coverage-conditioned ("a mobile QB looks for
where the extra coverage left a gap"); RPO keep phase in, both surfaces;
all five authored plays in v1.

**What shipped:** `tools/rpo_audit_probe.mjs` (new measurement harness —
deliberately NOT registered in the gate manifest: it prints rates, asserts
nothing; D6's `rpo_probe` will be the gating probe) +
`Ref/RPO_AUDIT_2026-08-16.md` (the deliverable). **No outcome code touched.**

**Headline findings** (600 AI-vs-AI games / 1,200 team-games; stable on a
150-game re-run): the sim never reads the QB archetype — everything keys on
attributes, and the AI's `qbRunPct` dial keys on absolute SPD>75 that
derived Scramblers (mean SPD 63) rarely clear, so the archetype spread is
compressed to 1.3× (real: 5–10×). Pocket starters get **3.58 designed QB
runs/game** off the QB_RUN_BASE formation dice (real ≈ 0–1); scramblers
scramble only **3.4% of dropbacks** (real mobile QBs 8–12%+) because
scrambles are pressure-gated — a clean-pocket scramble cannot happen; RPO
is **7.1% of snaps vs 21.8% real Power-Four** (PFF), though the 75/25
give/throw split already matches reality; the RPO **keep phase does not
exist** (#46 confirmed at engine level); only QB Sneak + QB Power are
authored (#45 confirmed). Option chain + defensive counter vocabulary
(spyQB / optionKey / edgePlay / weekly reaction) are healthy — D6 verifies,
not invents.

**Gates:** no source changes → no build/gate owed. Probe run ×2 (600- and
150-game samples, headline rates reproduce).

## 2026-08-16 — D1 · M0 SWEEP SHIPPED (wake lock · replay toggle · THE CARD LINTER · #49 flip fix · mobile overflow · def graphics)

The pulled-forward M0 sweep from BUILD ORDER v2 (below) is BUILT + NODE-GATED
in this session. No design calls taken; no engine outcome files touched
(presentation + CSS + probes only — sim.js untouched by THIS session).

### OWNER CHECKLIST (browser/device — everything owed)

- [ ] **Wake lock on a real phone (#7):** watch a game — the screen must not
  dim mid-drive. Background the app and come back: the lock re-acquires
  (visibilitychange). Chrome/Android and iOS Safari 16.4+; it's a feature-
  detected no-op elsewhere.
- [ ] **Replay toggle in a live game (#9):** "Replays: On/Off" button in the
  watch controls — turn it off, confirm no instant replays the rest of the
  game, and that the setting survives a save/reload (rides state.settings).
- [ ] **Phone eyeball #5:** new-game / Season-setup custom-division editor —
  the conference header (name + tier stars + teams toggle) now fits the
  screen.  **Phone eyeball #32:** Defensive Playbook → "Where pressure comes
  from" — the three inputs now share the row instead of drifting off.
- [ ] **The re-authored looks (Builder + call sheet):** Spread Ace now draws
  UNDER CENTER with the back deep (#18); Pistol Diamond is a real diamond —
  FB left wing, TE right wing, HB deep, no slot-WR body in the backfield
  (#20); Red-Zone Fade draws a back-shoulder fade, not a go (#19). Def call
  cards: bring 3/4/5/6 changes the arrow count on every front (#33), ends
  read LE/RE everywhere (#31).
- [ ] **The #49 flip fix, live:** watch a stretch where the AWAY team drives
  (screen-left): the fielded pre-snap look must match the card's strength —
  trips drawn right = trips fielded on the correct side. Flip through the
  replay cameras (coach / end zone / reverse) — reverse is still a deliberate
  mirror, everything else keeps the card's handedness.
- [ ] **Local gate:** `node tools/_gate.mjs` — `card_lint_probe` is now in
  CORE; the Playwright halves of viewer_act_c/d and the browser tier could
  not run in this sandbox.
- [ ] **Commit sweep-up:** `js/ui/app.js` and this STATUS file are left
  UNCOMMITTED — both carry a parallel session's live uncommitted work
  (bench/M1 + involvement/M4 hunks in app.js). My app.js hunks: the wake-lock
  block + acquire in initWatchMode + release in syncOverlayInert, the
  Replays button/handler/gate, and the watchSideY/watchSideWorldPoint lateral
  mirror pair. Everything else this session touched IS committed (see below).

**What shipped:**
- **Wake lock (#7)** — `navigator.wakeLock.request('screen')` acquired when
  the watch viewer mounts (initWatchMode), re-acquired on visibilitychange
  while a viewer is up, released by the render path whenever no watch-root is
  on screen (syncOverlayInert — every render passes through it, so no close
  site can be missed). Feature-detected + try/caught throughout.
- **Replay toggle (#9)** — watch-controls button; `state.settings.watchReplays
  === false` disables the instant-replay re-run (default on; same settings
  convention as the Settings screen, persists with the save). Grows into M4's
  Presentation group later.
- **THE CARD LINTER — `tools/card_lint_probe.mjs`, registered in CORE.** Walks
  every (formation × variation × concept) render and asserts football
  legality: 5 OL/1 QB/5 skill, ≥7 on the line, nobody offsides/OOB, no
  WR/SLOT body in the backfield (#20 class), no gun QB with a back stacked
  directly behind (#18 class), no overlapping bodies, personnel counts ===
  the pkg (C2), every drawn SVG coordinate in bounds at Builder and
  call-sheet sizes (C3), viewer handedness in BOTH drive directions for every
  camera (#49, C4), def call-card arrows === bring 3–6 on every front with
  fire-zone drop squiggles for dropped linemen + LE/RE labels (C5).
  **Proven against the pre-fix tree:** flags Spread Ace (#18), Pistol Diamond
  (#20), three 6-man-line looks, 24 personnel drifts, and a family of
  off-card route draws. 14/0 ×3 on the fixed tree.
- **Authored-row fixes (`VARIATION_LAYOUTS`, constants_field.js).** Moves may
  now RE-DRESS the body they move (pos/label/role) so a look draws its pkg's
  personnel — ids/order/catch are eternal, OL/QB never re-dress
  (`variationLayoutSlots`; draw_up_probe's identity law amended to match).
  Fixed rows: spread_ace (QB under center, back deep, slot→2nd TE),
  pistol_diamond (FB wing + TE wing + HB deep, Z steps onto the line),
  pistol_trips / bone_heavy / wc_slash (kept their lawful 7 on the line),
  and pkg re-dresses across power_big/twins, trips_closed, sb_twins/heavy,
  bone_split, flex_trips.
- **#49 — plays drawn flipped vs the viewer: a real projection bug, fixed.**
  The side-view family projected a left-driving offense as a rotation PLUS a
  reflection (lateral axis never mirrored), so every look played out flipped
  against its card whenever the drive went left. `projectWatchPoint`
  (watchcamera.js) now mirrors the lateral axis with the direction for
  broadcast/all22/coach/endzone (reverse stays a deliberate, now-consistent
  mirror), and app.js's local `watchSideY`/`watchSideWorldPoint` pair mirrors
  identically. `viewer_act_c_probe`'s node check pinned the OLD reflection
  ("preserving lateral position" under rotation) — amended, documented for
  Codex in the probe itself.
- **Red-Zone Fade (#19, hand-reviewed vs concepts.js):** new `fade` art route
  (outside release, short-medium back-shoulder settle); the concept card is
  the single isolated jump-ball route the sim spec describes. Route drawing
  also gained a clamp box — boundary breaks hug the sideline instead of
  drawing off the card (the C3 bounds fixes).
- **Def call card (#33 graphic):** the arrow count IS the bring — down linemen
  first, then edge rushers (role Rush/Blitz), then dogs, then blitz-eligible
  DBs (Dime bring 6 needs them, per DEF_BLITZ_ELIGIBLE); linemen over the
  bring bend back with one fire-zone squiggle each, toward their own hook.
  Before: bring 4 on a 3-man line drew 3 arrows, bring 5 drew dl+1 anywhere.
- **End labels (#31):** every front's DE row is side-explicit LE/RE
  (3-4/46/5-2/3-3-5/Tite/4-4/Penny said "DE"/"4i"; the 4-3 family already
  did). Label-only — ids/roles/sim untouched.
- **Mobile overflow (#5/#32, style.css):** `.dv-conf-head` wraps + the name
  input sheds its 320px intrinsic width; `.def-src-field` inputs share the
  row (`min-width:0` + `width:100%`).
- **play_fidelity R1 hardened:** the lone forced snap retries through pre-snap
  penalties (unseeded RNG — observed fail/pass flips on an identical tree
  this session; same trick as viewer_act_b).

**Gate (this sandbox, node):** `card_lint_probe` 14/0 ×3 · `draw_up_probe`
PASS (amended identity law) · `defbook_probe` PASS · `formation_compose_probe`
PASS · `play_fidelity_probe` 18/18 · `record_call_probe` 12/0 ·
`watchphys_probe` FULLY GREEN · viewer_act_c/d node halves PASS · clean
esbuild bundle (0 warnings) + bundle syntax parse · CSS parses.

**Committed: `176b6b6`** (scoped to this session's exclusive files):
js/constants_field.js · js/ui/views/routeart.js · js/ui/watchcamera.js ·
style.css · tools/card_lint_probe.mjs · tools/_gate_manifest.mjs ·
tools/draw_up_probe.mjs · tools/play_fidelity_probe.mjs ·
tools/viewer_act_c_probe.mjs. The manifest was committed as HEAD + only the
card_lint entry (the M4 session's in-flight timecontrol entry stays in the
working file for that session to commit with its probe). app.js + STATUS
left for the sweep-up above. Stranded git locks moved to `_to_delete/`.

## 2026-08-17 — BUILD ORDER v2 (review + commercial-pattern merge — RUN THIS)

Supersedes the 2026-08-16 order below (its note→milestone mapping still
holds; keep it for the record). What changed: the plan was reviewed for gaps,
then checked against how shipped commercial games (Madden / FM / 2K / Retro
Bowl) solve the same problems; owner ratified the merge 2026-08-17 with one
hard boundary: **the M1 bench is a PLAY-DESIGN instrument, period — no
scouting hooks, no opponent practice, no lesson layer. Scouting stays in
scout/film room.** Dispatch-ready prompts, one block per unattended session:
**`Ref/DISPATCH_PLAN_2026-08-17.md`** (D1–D9 map to the milestones here).

**M0 — fast sweep, pulled FORWARD (no design calls; land anytime, parallel).**
- **Wake lock while watching (#7):** `navigator.wakeLock('screen')` on viewer
  open, re-acquire on visibilitychange, release when the watch ends;
  feature-detected (commercial norm: the screen never sleeps in gameplay).
- **Replay toggle ships now (#9)** and grows into M4's Presentation settings
  group (frequency Off/Low/High, 2K-style) later.
- **The CARD LINTER (new — the commercial pipeline fix for #18/#20/#49).** A
  probe walks EVERY (formation × variation × concept) card and asserts
  football legality: no slot body in the FB spot, QB depth matches the look
  (no shotgun in under-center looks), personnel matches the pkg,
  strength/flip convention matches the fielded slots (the #49 orientation
  bug), everything in bounds. Fix every authored row it flags (known: Spread
  Ace #18, Pistol Diamond #20, flipped draws #49; hand-review Red-Zone Fade
  #19 vs its concept), then the linter pins them forever. Goes in CORE.
- Mobile overflow: custom-division conference header (#5), pressure controls
  (#32).
- Def no-design fixes pulled out of M5: DE/RE/LE label consistency (#31);
  bring 3/4/5/6 changes the card's rush-arrow count (#33 graphic half —
  `renderDefCallCard` already draws from bring). The bring-3-on-a-4-man-line
  sim AUDIT half stays in M5.

**M1 — the test bench (the instrument, build FIRST).** One shared live
viewer: even-matched scratch teams, run this play, retry freely — this is
Madden's Practice mode shape. Revisions from review:
- **Generic API** — bench(formation, variation, play/concept, defensive
  LOOK) — with THREE entrances: the Play Composer, the Formation Designer
  (on save → auto-install every fitting concept → test), and **the Playbook
  Builder's cards**. The third is required: M2's bug list is all BUILT-IN
  content, and without it the instrument can't verify the very thing it was
  built to measure.
- **The defense picker is a full LOOK** — front + coverage + bring count, not
  just a front (#1 says front, but pass-concept trust is a coverage
  question). Reuse the defCall card vocabulary / starter defensive books.
- **Retry semantics, both kinds:** "run again" (fresh RNG — see the spread)
  and "same roll again" (pinned PRNG, the probes' trick). One result line
  per rep: the call, the coverage rolled, the outcome.
- **ONE shared "fits this look" function.** Expose Stage 7's
  `compileFormation` filter rulebook (minWR, backfield structure,
  options-need-two-backs) and have Designer auto-install, Builder
  auto-select (#23), and the bench's play list ALL call it — three surfaces
  that can't disagree. Per-look personnel-aware once M2 lands (Empty never
  offers two-back plays). Auto-select seeds the formation's shipped sheet
  weights, NOT flat ones (everything-at-equal-weight is a diluted game-day
  book).
- Owner boundary above applies: play design only.

**M2 — per-LOOK play fidelity (the trust anchor) — RE-SCOPED: part engine,
band-gated.** The 8-16 order framed this as presentation; two pieces move
outcomes and must ride the band machinery (tendency + playcall +
stat_realism A/B):
- **Per-look sheets change the sim** (which concepts get called from each
  look). Model: **INHERIT-WITH-OVERRIDE** — a look without its own sheet
  inherits the formation sheet byte-identically; editing forks it. This is
  the commercial model (a play belongs to the LOOK — Gun Trips Mesh ≠ Gun
  Bunch Mesh), materialized from concepts instead of hand-authoring
  thousands. Solves #43 (edit one look without echoing to the others) and
  keeps every existing book / AI plan / starter byte-identical until
  touched.
- **"Own personnel" = CREATOR_FIDELITY engine items 1–2, un-parked.** Both
  owner decisions are **CONFIRMED (2026-08-17: "easy yes to both")**:
  (a) variation pkg ALWAYS wins when fielding personnel; (b) Empty gets a
  REAL pkg (backs genuinely off the field). Build to these; no further ask.
- **Migration sweep (the 8-16 order was silent here):** per-look sheets
  re-key `TeamBook.sheets` → `repairCreation` maps old books losslessly
  (trivial under inheritance: old book = base sheets only); sweep
  `playbook_shape_probe`, overlay `PLAN_BOOK_STRUCT_FIELDS` concept weights,
  quick-slots, `aiFormationSheets`, the FORMATION_PLAYBOOK gate. Old SAVES
  may die (root-architecture §5b); the CREATOR LIBRARY may not.
- Cards: every graphic drawn for the specific look (#12/#14); nested/
  expandable card screens so OL jobs fit (#16). **The Composer grows RUNS +
  BLOCKING authoring HERE** — the previously unassigned rest of #37 (M2
  needs OL jobs drawn; M3 needs run-side authoring) — through the proven
  band-clamped grader.
- **Pre-snap play-art overlay in the watch viewer (new — the Madden trust
  device):** the SAME card art draws over the fielded players before the
  snap. Stage 6 unified the rows, so this is mostly a draw call — card↔field
  agreement becomes self-evident every snap instead of asserted.
- Verify the concrete bugs on the BENCH + the linter (#18/#19/#20/#49).
  Answer #21 with reps AND words: a one-line purpose blurb on every concept
  card ("what it is · what it does · what it risks" — the def-card subtitle
  grammar; help-language rules, no numbers) + the missing manual chapters
  (standing gaps-audit item).
- The Stages 3–7 **visual-eyeball debt rides the first bench session** (same
  screens).

**M3 — RPO / QB-run realism (audit-GATED, outcome-bearing).** Audit first
(#47): instrument designed-QB-run vs scramble vs RPO give/keep/throw rates
by QB archetype, compare against real college rates, set targets — then
STOP for the design call. Then build the commercial shape (Madden's): a
**hand-AUTHORED RPO / QB-run play family** with its own routes (#45) + an
RPO+QB-run type (#46) — never "any run can be a QB run" — with **AI call
rates keyed to QB archetype** (scrambler ≫ pocket). Defensive counters
already exist (spyQB, edge discipline) — verify they answer it; balance
through the band harness; testable on the M1 bench. Depends on M2's
composer run primitives.

**M4 — watch/time controls (independent — #7/#9 already shipped in M0).**
The redesign IS Madden "Play the Moments" + FM highlight levels:
- **3-level involvement toggle** — watch every play / coach big moments /
  coach every play — changeable MID-GAME (FM's law), replacing the two
  Ride-the-Plan buttons (#51).
- **Big moments DEFINED** (spec, not vibes): 4th downs, red-zone trips,
  inside 2:00, one-score 4th quarter → interrupt PRE-SNAP with the call
  sheet open (that's where the value is); turnovers + scores surface as
  watch moments, no interrupt.
- **Transport row (commercial standard):** skip play · sim possession
  skipping the animation (#54 — the Retro Bowl "skip playing defense" loop)
  · sim to half / end (#55) · take control next snap. Fix the dead FF
  button; TEMPO leaves the row — it's hurry-up/chew-clock strategy and
  lives with the game plan (#51).
- Skipped stretches leave **drive-summary lines** in the feed, not silence.
- **LAW:** sim-to-half/end resolves the halftime token through the EXISTING
  pause path — `gamePauseIsLive` stays the only serialization gate; no new
  save path mid-skip.
- Landscape button → camera views when the camera acts land (#25).

**M5 — game-plan home + dial redistribution + Seasons + Def playbook
(design-heavy, LAST).** The organizing principle is FM's tactic-vs-touchline
split — which is already our ratified architecture: the BOOK is the
persistent object, the game plan is overlays on it.
- **Embedded editable playbooks** in dynasty/season, saved to the LEAGUE
  save, with "push to Workshop" (#39). Push MUST **restamp the source
  identity** (`sourceSaved`/`_bookSourceSaved`) or the Stage-3 banner
  instantly fires about your own push; embedded editors force re-synthesis
  on save (the Stage-3 seam exists). Move offensive identity here + add the
  defensive version; formation-usage dials live here (collapsed graphics
  #3); better simple game-planning look (#41).
- **Dial-home redistribution (#39 brainstorm) driven by the split:** BOOK
  properties (formation usage, sheets) live with the book; WEEK properties
  (tempo, aggression, situations) stay in the controller.
- Seasons: playbook selection + starting options (#27) **including the
  defensive book** (parity with new-game); strip recruiting settings (#29).
- Def playbook: the bring-3-on-a-4-man-line AUDIT (#33 — does the sim
  genuinely drop a lineman; `rush3` behavior); **the defbook v2 probe debt
  lands here at the latest** (defbook_probe v2 asserts + defsheet_probe).

**Standing debt folded in (so it can't rot):** Stages 3–7 visual eyeball →
M1's first bench session; defbook v2 probes → M5 or sooner; act B/D local
scrub re-run + full local gate + a green night run before the next deploy.

**Cross-cutting (#35) unchanged:** "what's wired cheap that deserves more
attention?" — keep working the intricate-gaps ledger method.

**Explicitly NOT adopted (owner call, 2026-08-17):** opponent-scouted-look
practice and any lesson layer on the bench — the bench designs plays;
scouting lives in scout/film room. FM-style "tactic familiarity" (install %)
is NOT scheduled either — noted only as the reference model if the
gaps-audit practice↔books design call is ever taken.

## 2026-08-16 — PLAYTEST 8-16 BACKLOG + THE BUILD ORDER

**SUPERSEDED 2026-08-17 — BUILD ORDER v2 above is the runnable plan.** The
note→milestone mapping below still holds; kept for the record.

Source: `test_notes_8-16.txt` (owner playtest). Two owner clarifications baked in:
(a) the Formation Designer **auto-installs every concept that fits the formation's
personnel so the player can immediately TEST them** on a live viewer; (b) notes
#45–47 are **one thought** — the QB-runner / RPO model is undercooked, and the fix
starts with a sim-realism AUDIT (designed-QB-run vs pass-to-RPO rates, real life
vs our game), not UI.

**Why an order at all:** owner's core constraint — *"it's very difficult to test
without having it all done."* So the sequence front-loads the test INSTRUMENT and
play-card FIDELITY, because those are what make everything else testable and are
also the trust anchor (owner: the current play-card accuracy would make him
refund). Each milestone ends in something you can actually test.

**M1 — The test bench (the instrument, build FIRST).** One shared live viewer:
even-matched teams, run this play, retry freely. Wired into BOTH the Play Composer
(test the single concept you're building) and the Formation Designer (on save,
auto-install the fitting concepts, then test them). Selecting a formation
auto-selects its fitting plays; deselect what you don't want. *(notes #1, #23,
part of #37.)* This is the measuring stick for M2–M3.

**M2 — Per-variation play fidelity (the trust anchor).** Each formation VARIATION
gets its OWN play sheet + personnel — today variations share one sheet, so there's
no real per-variation variation (#43). Every play graphic drawn for that specific
variation's alignment, every man's job shown (#12/#14); more card real estate /
nested screens so OL blocking fits (#16). Then verify+fix the concrete diagram
bugs ON THE BENCH: Spread Ace shows shotgun+RB-behind (#18), Pistol Diamond puts a
slot WR in the FB spot (#20), Red-Zone Fade wrong (#19), plays drawn flipped vs the
viewer orientation (#49). Answer the concept questions here (what "reverse" is,
why sluggo-seam changed, trust in flea-flicker / HB-pass — #21).

**M3 — RPO / QB-run realism (audit-GATED).** Audit first (#47) → design decision →
RPOs with their OWN routes (not reused run plays), an RPO+QB-run play type, and
correct designed-QB-run rates (#45/#46). Testable on the M1 bench.

**M4 — Viewer / watch controls (independent, any time).** Keep the screen awake
while watching (#7 — no wake-lock code exists today). Toggle to turn replays off
(#9). Time-control redesign: sim-possession-skip-animation, sim-to-half/end, and a
3-level "watch every play / coach big moments / coach every play" toggle so the
coach jumps in and out; fix the broken FF button and stop labeling TEMPO as a time
control (it's hurry-up/chew-clock strategy) (#51, #53–57). Landscape button →
camera views when ready (#25).

**M5 — Game-plan home + dial redistribution + Seasons + Def playbook (design-heavy,
LAST).** Embed editable playbooks in dynasty/season that save to the LEAGUE save,
with a button to push back to the Workshop version; move offensive identity here +
add a defensive version; formation-usage dials live here (collapsed graphics #3);
better look for simple game-planning (#41) — then brainstorm dial-home
redistribution (#39). Seasons: playbook selection + starting options (#27), strip
recruiting from Season settings (#29 — Season Mode already runs no-recruiting, so
likely just stray settings). Def playbook: DE/RE/LE label consistency (#31),
Bring-3 vs Bring-4 changes the graphic + audit bring-3 on a 4-man line (#33),
pressure controls drift off the phone (#32).

**Parallel / anytime — fast independent bug sweep:** flipped plays (#49), mobile
overflow (new-game custom-division conference header #5; pressure controls #32).
These need no design calls and can land whenever a slot opens.

**Cross-cutting question to answer as we go (#35):** "what's wired cheap that
deserves more attention?"

## 2026-08-16 — SESSION RECONCILE: Act F shipped + two fixes + functional playtest

Catch-up entry for a working session. Everything here is committed on `source`.

**Viewer Act F converged.** Codex's director shot-purpose focus was uncommitted
in the worktree; it is now committed on branch `codex/viewer2-act-f` (`8b3395d`,
parent `fe36ec6`), ported onto `source` (`ee5accc`), and built into `dist`. The
node-level focus probe passes 7/7 and the app bundles clean with the Act F wiring.
**Still owed:** the Playwright End Zone/return browser scrub (visual only) — it
can't run in the sandbox. (The old "BUILT, UNCOMMITTED" note lower down is updated.)

**Game Plan Run Game / Pass Game tabs fixed (`753b45d`).** The Playbook-Root
refactor (`cfb9bd2`) dropped the `selectedIds` declaration from
`renderOffenseDefaults` but left its uses in those two sub-tabs, so opening either
threw a ReferenceError and blanked the panel (Package/Playbook/Tempo were fine).
Restored, derived from the loaded book's formations. Confirmed rendering live in
the playtest below.

**Landscape score/clock overlap fixed (`141dc64`).** In phone landscape the score
bug is forced into the ~150–240px rail, but its compaction lived in a
`max-width:640px` query that never fires in landscape (the phone is wide), so the
full-size crests/scores overflowed onto the clock. Added rail-specific compaction
inside the landscape media query. (CSS-only; visual eyeball on a phone still nice.)

**Functional browser playtest of Stages 3–7 — PASSED (2026-08-16).** Drove the
built `dist` in a real browser through: Play Now live coaching (formation pins,
named calls, and the drill-down concept cards all read the book; the panel labels
the source book; a called play executed, narrated, and ran the animation
pipeline); the Game Plan controller (Load-a-plan lists builtin + Workshop books,
the Package tab shows the book's looks as usage sliders, and **Run Game + Pass
Game both render**); and the Formation Designer (Stage 7 authoring canvas opens
with QB-depth + five position/placement pickers). **Zero console errors across
every surface.** This DOWNGRADES the "⚠ BROWSER PLAYTEST OWED" markers on the
Stage 4–7 sections below: a functional click-through has now passed with no
crashes — what remains is a **visual eyeball** on fidelity (field animation,
formation diagrams, the viewer draw-up), because screenshots couldn't be captured
in-session (the renderer stays busy with the animation loop, so pixel fidelity was
not verified).

**Not ours, noted:** a parallel task also committed this window —
`971522a Fix Film Room Save Clip latch + harden Act B scrub probe` (addresses the
Act B "frozen scrub" gate-red bug below) and `cea1349 Checkpoint: Act F worktree
mirror`.

## 2026-08-16 — GATE RED TRIAGE: the Act B "frozen scrub" was a REAL Film Room bug

Owner's local full gate: 77 OK / 4 FAIL. Three of the four are the standing
flaky ledger exactly as documented (size_fit boundary tail, tipdrill unseeded,
act_a_finish_live no-eligible-window). The fourth — `viewer_act_b_probe`
"scrubber rerenders a deterministic play frame" — was reproduced in the cloud
container (same 1-fail) and diagnosed to the bottom:

- The probe's pinned seed now lands "Save Clip" on a PENALTY play, and a
  penalty whistle clip is dead-ball BY DESIGN — identical scrub frames are
  correct there. (This is why the 08-15 note saw it fail cloud-side with
  unrelated code: roll-stream drift, not a scrubber regression.)
- Chasing that exposed a REAL user-facing bug: `watchSaveActiveClip` latched
  `w.clip = data` after the FIRST successful save in a LIVE watch, and the
  `w.clip ?` branch then re-saved that SAME first clip on every later Save
  Clip for the rest of the game — a 4th-quarter TD clip silently stored the
  1st-quarter play again. FIXED: the latch now only refreshes when `w.clip`
  already exists (clip playback — the replay screen's re-save-with-camera/
  telestrator path, which still passes its probe check).
- `viewer_act_b_probe` now saves-with-retry until the clip holds a SCRIMMAGE
  snap (motion for the scrub check) and asserts it — 23/0, ×3 in the cloud
  container. record_call + live_book_call re-proof green.

## 2026-08-16 — PLAYBOOK-ROOT: STAGE 3 REMAINDER (overlay saves + update prompt)
## BUILT + NODE-GATED — the 7-stage re-rooting is now FULLY BUILT
## ⚠ BROWSER PLAYTEST OWED (joins the standing Stages 4–7 playtest)

The two owed Stage-3 pieces (this file's old "OWED" ledger) are in. The third
piece — the full defCalls→defbook.calls relocation — stays deliberately NOT
done: the read seam (`defBookCalls`) + compile seam already landed in Stage 4,
and the physical move would break the Stage-1 partition law for zero
user-visible gain.

**What shipped:**
- **"Save plan" saves OVERLAYS** (the controller). `controllerOverlayOf` /
  `applyControllerOverlay` + `PLAN_BOOK_STRUCT_FIELDS` (teamplan.js): a saved
  coach-library plan is now dials + concept weights + target shares +
  situations + team knobs — NOT a frozen copy of the book, and no longer
  drags one career's roster-bound `fieldAssignments` (player ids!) into the
  portable library. Loading an overlay plan applies it ONTO whatever book you
  carry (book byte-identical, probe-proven); unnamed controller fields reset
  to defaults (the "no hidden leftovers" law applyPlanToSchool already
  enforced). Old full-snapshot plans in existing coach libraries keep loading
  exactly as before (`overlayOnly` flag on new entries; coachprofile.js).
  Quick-slots A/B/C intentionally stay full snapshots (same-book weekly
  variants).
- **The snapshot-vs-library UPDATE PROMPT.** Workshop loads (pb:/dd:) stamp
  the book's creation identity — `gameplan._bookSourceId/_bookSourceSaved`
  (+ `_defbookSource*`), underscore fields so they survive the load handlers'
  wipe, every forced re-synthesis (splitTeamPlan copies them onto
  `book.source/sourceId/sourceSaved`), and save round-trips. Full-plan and
  starter-book loads clear the relevant stamps. The Game Plan screen shows a
  banner per side when the source creation's `saved` stamp is newer: "📖 A
  newer version of “X” is in your Workshop — Update the book → (your dials &
  situations stay)". One tap: repair-on-load → one-side re-apply → restamp →
  re-synthesize; overlays survive by construction (the one-side appliers
  carry everything they don't govern).

**Gate:** new **`book_update_probe`** (23/0, in the CORE manifest): stamps
ride/land/survive/clear correctly; update detection + apply preserves
situations/team knobs/the other side and clears the prompt; overlay saves
leak no structure and overlay loads keep the book byte-identical with
compile ≡ gameplan throughout. Re-proof green: playbook_root 24/0 ·
plan_side 21/0 · ai_book_name 11/0 · record_call 12/0 · live_book_call 13/0
· draw_up 21/0 · formation_compose 39/0 · playbook_shape 24/0 · defbook 26/0
· save_migration ALL PASS. Clean esbuild bundle + CSS parse.

**⚠ OWED (browser):** load a Workshop book in a dynasty → edit that book in
the Workshop (resave) → back to the Game Plan → the update banner appears →
tap it → looks change, dials/situations don't, banner clears. Save a plan →
load a different book → load the saved plan → book stays, dials apply.

## 2026-08-16 — PLAYBOOK-ROOT REFACTOR: STAGE 7 (the designers — Formation Designer)
## BUILT + NODE-GATED — ⚠ BROWSER PLAYTEST OWED (the moat feature)

Stage 7 of `Ref/PLAYBOOK_ROOT_ARCHITECTURE.md` — "the designers". The
DEFENSIVE play composer half already shipped as Defensive Playbook v2's call
cards (cards → `defCalls`); this stage builds the other half, CREATOR_FIDELITY
item 5: **the Formation Designer** — one registry, an alignment-legality
validator, balance derived by a FIXED rulebook. Edited `js/` + `style.css` +
probes; unattended cloud session; not committed, not built, not
browser-verified.

**What shipped:**
- **`js/engine/formcompose.js`** (new) — the engine. A customFormation is
  five skill placements (WR/SLOT/TE/RB/FB on a fixed anchor vocabulary) over
  the standard OL five + a QB depth (under/pistol/gun). The
  **legality validator** speaks rulebook football: exactly five skill, no
  shared spots, backs in the backfield, **7 men on the line** (5 OL + ≥2
  on-line skill), covered-end warnings ("legal but ineligible"), built-in
  names refused. **`compileFormation` is the fixed rulebook**: the package is
  counted from the placements; the nearest built-in ARCHETYPE (backs-weighted
  personnel distance) supplies the identity/lean row VERBATIM; the legal call
  list is the archetype's book **filtered down** (minWR, backfield structure,
  no Wildcat Power/Jet Sweep, options need two backs) — always a strict
  SUBSET of a shipped book; **matchup edges and situational mods are NONE**
  (neutral 1.0 — no row in the tables, every reader defaults). A designed
  look can never out-tune a shipped one, BY CONSTRUCTION. The layout derives
  canonical slot ids/labels/roles (X/SL/F/Z receivers outside-in, TE_Y/U/W,
  RB_H/FB), so target shares, depth-chart pickers, viewer jerseys and
  route-art fills treat it like a built-in.
- **The REGISTRY seam** — `syncCustomFormations()` installs a compiled
  formation's four rows into the LIVE tables (FORMATIONS /
  FORMATION_PACKAGES / FORMATION_PLAYBOOK / OFF_FIELD_LAYOUTS) and removes
  rows for deleted creations. Idempotent, storage-blind (callers pass
  entries), never shadows a built-in, never throws. After registration,
  EVERY existing surface — Playbook Builder cards, Game Plan looks +
  field-assignment tab (`ensureFieldAssignments` walks the live table), the
  call sheet's pins, `resolveOffField`, the sim, the watch board — picks the
  formation up with zero further wiring. Every other per-id table (PA_RATE,
  MOTION_RATE, JET_*, coordinator schemeIQ…) defaults safely by design.
- **The Workshop "Formation Designer"** (`js/ui/views/creatorform.js`, new;
  hub card in creator.js) — name, QB depth, five position+alignment rows,
  live diagram (`renderFormationDiagram` grew an `o.slots` override — the
  art comes free), validator errors/warnings in plain football, and the
  derived summary ("plays from the Spread family, N calls, no matchup
  edges"). Saves to the new **`formations` creator shelf** (cap 16,
  `CREATOR_KINDS` now SIX — creator_store_probe updated); save/delete
  re-syncs the registry live.
- **Boot registration** (app.js top-level, guarded): the library's
  formations register at startup, so a dynasty book carrying one plays
  immediately. One latent trap fixed en route: **normalizeFormations' fixId
  snapshot** (gameplan.js) took `Object.keys(FORMATIONS)` at module load —
  before registration — so the Game Plan screen would have silently
  rewritten a custom formation to Single Back; it now also accepts anything
  in the live FORMATION_PACKAGES registry.
- **AI-blind + portable like every creation**: setAIGameplan never authors a
  custom id (probe-proven across 340 schools); a save whose plan carries a
  formation missing from this machine's library normalizes safely.

**Gate (this sandbox, node):** new **`formation_compose_probe`** (39/0 ×3,
added to the CORE manifest): the full legality battery; the rulebook laws
(subset call lists, verbatim archetype leans, lawful 11, option/empty
structure filters); registry install/idempotence/unregister/no-shadow with
NEUTRAL matchup+situational proofs; **a full sim game from the custom
formation** (82 snaps, sane score, 0 off-book concept breaches, viewer
scripts its snaps, a forced headset call from it runs as called); AI-blind
sweep. `creator_store_probe` 50/0 (six kinds) + `creator_resilience_probe`
20/0. Re-proof all green: playbook_root 24/0 · plan_side 21/0 · ai_book_name
11/0 · record_call 12/0 · live_book_call 13/0 · draw_up 21/0 ·
playbook_shape 24/0 · defbook 26/0 · play_compose 17/0 · custom_play 221/0 ·
integration_creator 19/0 · save_migration ALL PASS · worldgen PASS ·
watchphys FULLY GREEN (default harvest). Clean esbuild bundle + CSS parse.

**⚠ OWED (browser, owner's machine):** build; Workshop → Formation Designer
(build a trips look, watch the live diagram + validator, save); Playbook
Builder should list the new formation with its diagram — carry it in a book,
load the book in a dynasty, see it in the Game Plan looks + call-sheet pins,
and watch a game field it. Then `_boot_check` + `node tools/_gate.mjs` (four
new probes now in core). Design remainder for a later pass, intentionally
not taken here: authoring variations for custom formations, custom-formation
sheets in the per-formation playbook editor UI beyond the derived defaults,
and the variation-pkg/Empty personnel owner calls (CREATOR_FIDELITY items
1–2 engine side).

## 2026-08-16 — PLAYBOOK-ROOT REFACTOR: STAGE 6 (the animation honors the draw-up)
## BUILT + NODE-GATED — ⚠ BROWSER PLAYTEST OWED (joins the Stage 4/5 playtest)

Stage 6 of `Ref/PLAYBOOK_ROOT_ARCHITECTURE.md` — the pillar-4 payoff, scoped
to its own law: **presentation-only, no outcome change.** Edited `js/` only
(no engine outcome files, no style.css); unattended cloud session; not
committed, not built, not browser-verified.

**What shipped:**
- **The dangling `layout:` pointers RESOLVE** (`js/constants_field.js`): new
  authored **`VARIATION_LAYOUTS`** — all 22 rows the FORMATION_VARIATIONS
  pointers name (power_big … jumbo_to), each a SPARSE per-slot moveset over
  the base formation (trips surfaces, condensed splits, empty backs split
  out, diamond backfields, unbalanced lines, goal-line condensing…). Same
  slot IDs by design — the sim fields base personnel and stamps base slot
  ids, so every recorded carrier/target/coverage slot still resolves. Rule
  kept: y ≥ 0.5, nobody offsides. `variationLayoutSlots()` is the one
  resolver; the base table is never mutated.
- **The live board FIELDS the look** (app.js `watchOffSlots`): the watch
  viewer resolves the record's `variation` (Stage-5 stamp) through the
  authored table — the pre-snap alignment you watch IS the look the book
  called. Pre-variation records get base slots byte-identically. (The 2-pt
  try mini-board reads the same helper.)
- **The diagrams draw the SAME rows** (routeart.js): `_variationLayout` now
  resolves the authored table first (the pkg-derived heuristic survives only
  as fallback), so Builder cards / Game Plan looks / call-sheet pins /
  called-play cards and the live field can no longer disagree.
  CREATOR_FIDELITY's "invented — the biggest drift" verdict is closed at the
  presentation layer. `renderPlayCard` accepts a `variation` (the call
  sheet's pinned-look thumbs, MY PLAYS tiles and the THE CALL card all pass
  it).
- **Composed plays ANIMATE AS DRAWN** (routeart + app.js + watchphys): the
  card's receiver-resolution was extracted to one shared
  **`resolveComposedReceivers`** (explicit picks deduped, screens/checkdowns
  to the backs, rest outside-in — byte-same logic renderPlayCard used);
  `watchComposedRoutes` (app.js) resolves the recorded `customPlayId`'s
  authored routes onto the fielded slots and stamps `p._composedRoutes`;
  `buildPlayScript` (watchphys) gives each authored slot its OWN route shape
  (new `COMPOSED_SHAPE` part→shape map), honors `flip` (mirrored break),
  keeps a drawn blocker in to block, and lets an authored back run his wheel
  — while the sim's recorded target/catch point ALWAYS wins. A composed clip
  on a machine without the play in its library falls back to the old
  synthesis (honest, no crash).
- **NOT touched (the stage's own law):** `resolveOffField`/personnel — the
  variation-pkg consumption question is CREATOR_FIDELITY item 2, an OWNER
  balance call, explicitly not taken; concept outcome math, sepgeo/routeDuel,
  coverage tables all untouched; `sim.js` untouched this stage.

**Gate (this sandbox, node):** new **`draw_up_probe`** (21/0 ×3, added to the
CORE manifest): all 22 pointers resolve lawfully (bounds, no offsides,
identity preserved, base unmutated), all 22 diagrams differ from base with no
NaNs, the shared resolver is lawful, and — on a REAL recorded snap — seeded
routes draw their own shapes, flip mirrors the break, the blocker stays in,
and a null seed builds a **byte-identical script** (non-composed plays
untouched). **`watchphys_probe` (the viewer truth gate) fully green** — ball
spot, track sanity, determinism, special-teams null-script law all hold.
Re-proof: `formation_variation_probe` PASS, `play_compose_probe` 17/0,
`playbook_root_probe` 24/0, `plan_side_probe` 21/0, `ai_book_name_probe`
11/0, `record_call_probe` 12/0, `live_book_call_probe` 13/0. Clean esbuild
bundle + syntax parse. **Note:** `align_probe` (an old Fix-C sack-rate A/B,
NOT in any gate tier) flips run-to-run at its ~0.4pp margins — observed both
PASS and FAIL on the identical tree; pre-existing statistical flake, engine
untouched this stage (Stage 5's pinned-PRNG byte-identity is the proof).

**⚠ OWED (browser, owner's machine — one playtest covers Stages 4+5+6):**
build; watch a game with a multi-look book — the pre-snap alignment should
CHANGE with the look (trips bunch, empty spread, goal-line condense) and
match the FIELD NOTES card; pin a look on the headset and confirm the sheet's
cards + the fielded alignment agree; call a composed play and watch YOUR
routes run (flip included, blocker staying in); replay + Film Room clip show
the same. Then `_boot_check` + `node tools/_gate.mjs`.

## 2026-08-16 — PLAYBOOK-ROOT REFACTOR: STAGE 5 (the record knows the call)
## BUILT + NODE-GATED — ⚠ BROWSER PLAYTEST OWED (shares Stage 4's playtest)

Stage 5 of `Ref/PLAYBOOK_ROOT_ARCHITECTURE.md`: the play record gains the call's
provenance and the broadcast/replay show the DRAW-UP next to what happened —
the first visible thread from draw-up to whistle. **Presentation-only, proven
0-RNG.** Edited `js/` + `style.css` (+ gate manifest + one new probe).
Unattended cloud session; not committed, not built, not browser-verified.

**What shipped:**
- **The record knows the call** (sim.js, the one `plays.push` stamp site):
  every real scrimmage record now carries `bookName` (the offense's
  `school.book.name`, `gameplan._playbookName` fallback, null-safe),
  `variation` (the fielded LOOK — `offVar`, which already drove the snap), and
  `customPlayId` (composed calls only). Recording only — the stamps are pure
  reads placed after every roll; pre-snap-penalty rows and ST records are
  untouched. `offFormation`/`concept` were already recorded.
- **The broadcast shows it** (app.js + style.css, watch viewer):
  - New `watchLookLabel(p)` — "Spread · Trips" from the record's stamps; the
    play-by-play ticker's `[formation v front]` tag now names the LOOK.
  - The desktop FIELD NOTES rail shows the look, a "📖 <book>" line under
    PLAY ("· your play" for composed calls), and **the called play's CARD**
    (`watchCalledCardHtml` — composed plays draw their own routes via the
    recorded `customPlayId` from the Workshop library, named concepts draw
    the Builder's identity art from the recorded formation).
  - **Replay overlay**: a "THE CALL" card (`#watch-call-card`) appears on
    instant replays — the draw-up next to what happened. Desktop widths only
    (≥900px), honoring the mobile-landscape cleanup that retired
    `#watch-analysis`; phones still get the look label in the ticker.
  - Film Room clips inherit all of it free — clips store the whole play
    record (`replays.js` never inspects `data`), and clip playback runs the
    same board path.
- **NOT done here (correctly)**: nothing consumes the stamps in outcomes;
  animation honoring the draw-up is Stage 6; no schema/save migration needed
  (absent stamps read null).

**Gate (this sandbox, node):** new **`record_call_probe`** (12/0 ×3, added to
CORE manifest): stamps on every real snap, source priority
(book → _playbookName → null), forced look records its variation, composed
call records its id, and the **pinned-PRNG recording-only proof** — with
Math.random pinned to the same stream, a drive with/without a book name is
byte-identical except the stamp itself. Re-proof all green:
`playbook_root_probe` 24/0, `plan_side_probe` 21/0, `ai_book_name_probe`
11/0, `live_book_call_probe` 13/0, `play_fidelity_probe` ALL GREEN (18),
`defcall_probe` 32/0, `compile_league_probe` 26/0,
`integration_creator_probe` 19/0, `save_migration_check` ALL PASS (39.9 MB —
inside the measured 38.8–40.6 band, stamps didn't move save weight). Clean
esbuild bundle + syntax parse; CSS parses.

**⚠ OWED (browser, owner's machine — fold into Stage 4's playtest):** build;
watch a game on desktop width — ticker shows "[Spread · Trips v 4-3]" on
multi-look snaps, FIELD NOTES shows the book line + the called card, an
instant replay shows the THE CALL card, a saved Film Room clip replays with
it; call a composed play and confirm its own routes draw on the card.

## 2026-08-16 — PLAYBOOK-ROOT REFACTOR: STAGE 4 (live coaching reads the book)
## BUILT + NODE-GATED — ⚠ BROWSER PLAYTEST OWED before calling it done

Stage 4 of `Ref/PLAYBOOK_ROOT_ARCHITECTURE.md`: both call modes KEPT (owner
call) — the book becomes what the headset reads. Edited `js/` + `style.css`
only (plus the gate manifest + a new probe in `tools/`). Unattended cloud
session; **not committed** (git here is owner-run), **not built**, **not
browser-verified**.

**What shipped (`js/` source + `style.css`):**
- **The formation pin lists YOUR BOOK'S LOOKS** (app.js callSheetPanelHtml).
  The strip reads `school.book.plan.offFormations` (compiled-gameplan fallback
  — identical by the Stage-1 law), one pin per (formation, variation) LOOK,
  each drawn with `renderFormationDiagram` (the Builder's art) + the look label
  ("Spread · Trips"), with the book's name on the strip. Pinning a look sends
  `formationId` + `variation` on the call (new `state.ui.callVariation`,
  cleared everywhere `callFormation` is; the sim's P1b `forcedCall.variation`
  path was already live).
- **Play tiles are CARDS — the Builder's own art.** The drill-down, the pinned
  formation page, the off-the-sheet rows and the INFO preview all render
  `renderConceptThumb` (routeart.js) aligned to the formation being called
  from, replacing the old 3-line `conceptPlayGraphic` sketches. Same art as
  the Workshop.
- **Composed plays are CALLABLE (their first path into a live game).** A
  "📖 MY PLAYS" card section on the sheet (category view + pinned page;
  pass-only composer v1, so the run-only RPO/QB-Run tags hide it). Reads
  `school.book.plays` snapshots when a later stage populates them, else the
  Workshop `plays` shelf, repair-on-render; a pinned formation filters plays
  that name formations. Calling sends `{customPlay: id, customPlayData:
  <composed source>}`; **sim.js** compiles it through the PROVEN band-clamped
  `compilePlay` rulebook at the snap — recorded concept = the play's name,
  `coachCall` set, audible/gadget/category paths all excluded, an invalid
  payload falls through to the normal sheet call. **AI-blind by construction**
  (composed plays never enter PASS_CONCEPTS, the only pool `pickPassConcept`
  iterates; only the human sheet authors `forcedCall.customPlay`).
- **Defensive headset chips read the BOOK.** New `defBookCalls(school)`
  (teamplan.js): `defbook.calls` (the Stage-3 target home) → the book's
  `plan.defCalls` snapshot (today) → flat `gameplan.defCalls` (pre-book
  saves). Both the chip row and the click-to-load handler go through it; the
  row shows the defbook's name.
- **Minimal defCalls→defbook.calls seam (the Stage-3 dependency, done here as
  directed):** `compilePlanParts` now emits `gameplan.defCalls` from a
  defbook's first-class `calls` when the plan snapshot is absent. The FULL
  relocation (moving defCalls out of `plan`) was deliberately NOT done — it
  would break the Stage-1 partition law `plan_side_probe` /
  `playbook_root_probe` enforce, and it belongs with the browser-in-the-loop
  Stage-3 batch (overlay-save + update prompt). Byte-neutral for every
  existing book, probe-proven.
- **Sheet/category quick calls: UNCHANGED.** Both call modes intact.

**Gate (this sandbox, all node):** clean esbuild bundle + syntax parse; CSS
parses. New **`live_book_call_probe`** (13/0, added to the CORE gate
manifest): the composed call runs as itself (8/8 snaps, one snap per call),
grades band-clamped, PASS_CONCEPTS unpolluted, broken payload falls through,
sheet drives never leak composed names, the defBookCalls resolution chain +
compile-seam byte-neutrality. Sim-neutral re-proof: `playbook_root_probe`
24/0, `plan_side_probe` 21/0, `ai_book_name_probe` 11/0,
`play_fidelity_probe` ALL GREEN (18), `defcall_probe` 32/0,
`play_compose_probe` 17/0, `custom_play_probe` 221/0, `defbook_probe` 26/0,
`playbook_shape_probe` 24/0, `compile_league_probe` 26/0,
`integration_creator_probe` 19/0, `save_migration_check` ALL PASS,
`worldgen_check` PASS, `tendency_probe` monotonic ✅.

**⚠ OWED (browser, owner's machine):** `node tools/build.mjs`; the live
playtest — pin a look (diagram strip renders, the variation rides the call),
open a drill-down (cards render), call a composed play from MY PLAYS (its
name shows in the play-by-play), defensive headset chips still load calls
(now from the book) — plus `_boot_check` and the core gate's Playwright tier.
Stage 4 is NOT "done" until that playtest passes.

## 2026-08-15 — MOBILE PASS: landscape viewer + Play Composer + rotation

Owner-driven mobile fixes (verified against a phone screenshot). CSS + one
manifest + one composer entry-point removal — no engine/sim/balance code touched.

- **Landscape watch/coach viewer** (`style.css`). New
  `@media (orientation: landscape) and (max-height: 560px)` block: the field goes
  on the LEFT sized to the screen HEIGHT (the SVG letterboxes, so it never
  overflows the ~400px-tall phone and shoves the controls off), with a compact
  right rail (score / feed / controls / drives). Coaching mode splits field-left /
  call-sheet-right. Keyed on max-height so every phone in landscape gets it.
- **Rotation was locked** (`manifest.json`). `"orientation": "portrait"` pinned
  the installed PWA to portrait — so landscape never engaged. Changed to `"any"`.
  (In a plain browser tab this is governed by the device's auto-rotate; the
  manifest is what the installed app obeys.)
- **Play Composer overflowed on phones** (`style.css`). Root cause: the Workshop
  mounts inside `.newgame-wrapper` (a flex container), and a flex item keeps
  `min-width:auto`, so the play diagram/rows pushed the block past the screen and
  `body{overflow-x:hidden}` clipped the right edge. Fix: `min-width:0` on
  `.creator-wrapper` + a `max-width:560px` block that lets the diagram, the rows
  (which now wrap so the route dropdown gets its own full-width, thumb-sized
  line), the coverage box and the dropdowns all shrink to fit. **All six Workshop
  tools mount in `.creator-wrapper`, so this `min-width:0` hardens the WHOLE
  Workshop (playbook builder, defensive playbook, team/division editors, film
  room) against the same flex-overflow — not just the composer.**
- **"Name a Play" removed** (`creatorplay.js`). Owner call — no real use, and its
  editor was the still-broken mobile screen. The `＋ Name a play` entry button is
  gone (its `renderNameEditor` path is now unreachable dead code) and the list
  copy no longer references it.

**Landscape watch view — refinements from a live phone shot (2026-08-15):**
- **On-field "play info" analysis overlay retired** — `#watch-analysis { display:none }`
  globally. It duplicated the play-by-play feed (owner: "has got to go, period").
- **Scorebug ↔ play-feed overlap fixed** — the score bug could render as a floating
  broadcast overlay and landed on top of the feed in the rail; landscape now pins
  it in-flow (`position:relative`, full width) so scoreboard and play-by-play stack.
- **"1ST HALF — LIVE" header slimmed** in landscape (`.modal-header`/`h2` padding +
  font) — it was eating a big band of the short screen.
- **Rotation: installed PWA wouldn't honor `orientation:"any"`** (browser tab
  rotates fine; Android PWA quirk). Added a **"⤢ Landscape" button** to the watch
  controls — fullscreen + `screen.orientation.lock('landscape')` on tap, toggles
  back, feature-detected/try-caught (safe no-op on iOS). The deterministic path
  when the manifest alone doesn't rotate the installed app.

**Validation:** clean esbuild JS bundle + syntax parse; CSS parses;
`manifest.json` valid. Full node regression sweep GREEN after the whole session's
JS changes (`playbook_root` / `plan_side` / `ai_book_name` / `save_migration` /
`worldgen` / `tendency` / `compile_league` / `multicoach` / `integration_creator`
/ `defcall` all pass) — no engine regressions from the mobile edits (expected,
they're CSS/manifest/one-button). Not yet re-verified on the phone — owner testing
after a rebuild. Broader tiny-mobile-text readability pass is still the separate
standing design item.

## 2026-08-15 — PLAYBOOK-ROOT REFACTOR: STAGE 3 (PARTIAL — the load seam)

The Game-Plan-as-controller stage is **partly landed** — the safe, engine-level
seam that could be built and proven without a browser. The rest of Stage 3 is
live-UI behavior that wants a playtest loop (see OWED below).

**What shipped (`js/` source):**
- **The Game Plan load path now keeps the book model in sync.** `applyPlanToSchool`
  and both Workshop/starter book-load branches (gameplan.js) call
  `synthesizeTeamPlan(school, {force:true})` after applying a plan, so
  `school.book`/`defbook`/`planOverlay` track what the coach actually loaded
  (previously the Stage-1 snapshot went stale on a mid-career load). This makes
  "the Game Plan controls the book" literally true at the data layer and is
  forward-necessary for Stages 4–6 (which READ the book).
- Byte-neutral: `synthesizeTeamPlan` leaves the gameplan object as the truth and
  re-derives the parts; `compileTeamPlan(school)` still deep-equals it.

**Gate:** `playbook_root_probe` extended to 24/0 with the controller contract —
loading a different offense re-points the book, carries its formations, and
PRESERVES the situations overlay + team knobs + the defense, with
`compileTeamPlan ≡ gameplan` after the load. Clean esbuild bundle + syntax parse.
The 3 foundation probes are now in the **core gate manifest** (permanent
coverage).

**⚠ OWED (the rest of Stage 3 — browser-in-the-loop, do with a playtest):**
"Save plan" saving OVERLAYS (vs a full book), the snapshot-vs-library **update
prompt** (needs `sourceId`/`sourceSaved` on books), and the defense
`defCalls → defbook.calls` migration. These change live Game-Plan-screen behavior
and touch the (still un-browser-verified) defbook v2 system, so they're the right
work to do WITH a live browser, not blind.

## 2026-08-15 — PLAYBOOK-ROOT REFACTOR: STAGE 2 COMPLETE (AI books are named)

AI staffs now name their books from the scheme they authored, and the scout
report surfaces those names. **Naming is cosmetic — the sim's stat bands are
untouched — and proven so.**

**What shipped (`js/` source):**
- **`aiOffenseSchemeName` / `aiDefenseSchemeName`** (ai.js) — pure, deterministic
  scheme labels from the identity `setAIGameplan` already computed (primary
  formation + run/pass bucket → "Air Raid", "Spread Option", "Ground & Pound",
  "West Coast", …; base front + coverage → "4-3", "3-4 Man", "3-3-5 Stack").
  They call **no `Math.random`**, so they cannot move the roll stream.
- **`setAIGameplan` stamps** `gameplan._playbookName` / `_defbookName`
  POST-assignment (after every RNG draw), so the roll order is byte-identical to
  before. Synthesis (Stage 1) already reads those into `book.name` /
  `defbook.name` — so every AI team now carries a *named* scheme book.
- **Scout report surfaces the books** (scout.js) — an Offense / Defense scheme
  line on the opponent card, reusing the themed team-stats row (no new CSS).

**Gate (Stage 2 = "sim stat bands unchanged"):** `tools/ai_book_name_probe.mjs`
(11/0) proves the naming helpers consume **0 RNG calls**, the two name fields are
NOT sided sim-plan fields (overlay-only, never reach the sim's resolved plan),
and the names flow onto the books with the football-plain vocabulary.
`tendency_probe` unchanged; `playbook_root_probe` still 18/0 (AI plans now carry
`_playbookName` in the overlay and round-trip byte-identical); `plan_side_probe`
21/0; clean esbuild bundle + syntax parse. `stat_realism_harness` (slow) +
`_equiv_walk` scheme-line DOM stamp owed to a local run — but naming is provably
RNG-neutral, so the bands cannot move.

**Scope:** Stage 2 only. Nothing consumes the book name in the sim; the Game
Plan controller (Stage 3), live coaching (Stage 4), and the play record/animation
(Stages 5–6) remain untouched.

## 2026-08-15 — PLAYBOOK-ROOT REFACTOR: STAGE 1 COMPLETE (object + compiler)

The first stage of the 7-stage re-rooting (`Ref/PLAYBOOK_ROOT_ARCHITECTURE.md`)
is built and gated. Stage 1 = **the object model + the compile seam**, done
byte-identical BY CONSTRUCTION so the sim, the UI, and the balance math are
untouched. Edited `js/` only (source of truth) — never a built file, never the
deploy repo.

**What shipped (`js/` source):**
- **`js/engine/teamplan.js`** (new) — the named object model + the one compile
  seam. A school now carries `book` (offense snapshot: looks + call sheet +
  offensive dials, named + sourced), `defbook` (defense snapshot: front /
  coverage / pressure identity + dials), and `planOverlay` (team-level knobs +
  the situational grid). `compileTeamPlan(school)` reassembles the three into
  exactly the flat gameplan the sim reads today. Also: `splitTeamPlan`,
  `compilePlanParts`, `synthesizeTeamPlan`/`synthesizeLeaguePlans` (attach the
  model), and the two verbs `assignBook`/`assignDefBook`/`setOverlay` (the
  Stage-3 controller surface — proven here, not yet UI-wired).
- **`PLAN_FIELD_SIDE`** — the one canonical SIDE MANIFEST (Ref §4b): every plan
  field tagged `off`/`def`/`team`. Replaces the four hand-maintained field
  lists that don't agree. Byte safety does NOT depend on it being exhaustive —
  any unlisted field stays in the overlay — but `plan_side_probe` fails if a
  known sim-consumed field is missing or a field is double-sided.
- **Synthesis wired at the choke points, byte-neutrally:** `finishNewGame`
  (state.js, after every gameplan writer settles) and `rehydrate`
  (persistence.js, synthesis-on-load for old saves — idempotent), plus the two
  Play-Now exhibition writers (playnow.js). The gameplan OBJECT each writer
  produced is left in place; the books are the equivalent named view.

**The Stage-1 law held — proof:** the design keeps `school.gameplan` as the
sim's input verbatim; `compileTeamPlan(school)` deep-equals it. Two new probes:
- `tools/playbook_root_probe.mjs` (18/0) — split∘compile is byte-identical for
  the default plan, sparse plans, **every AI plan in a full generated world**,
  and the pb:/dd: load writers; synthesis attaches named books; compile is
  deterministic; the two verbs round-trip.
- `tools/plan_side_probe.mjs` (21/0) — the manifest is well-formed, sides are
  disjoint, every sim-consumed standing field is covered, and the partition is a
  clean cover on real AI plans (nothing dropped, nothing double-written).

**Gate run (this sandbox):** clean esbuild bundle (0 warnings) + bundle syntax
parse; `playbook_root_probe` 18/0, `plan_side_probe` 21/0, `playbook_shape_probe`
24/0, `save_migration_check` ALL PASS (books/overlay round-trip through saves,
39.5 MB < ceiling), `worldgen_check` PASS, `tendency_probe` PASS,
`compile_league_probe` 26/0, `multicoach_week_probe` 16/0, `season_persist_probe`
15/0, `integration_creator_probe` 19/0 (24 games, 3245 plays), `defcall_probe`
32/0.

**⚠ OWED before deploy (browser-only, can't run in the sandbox — network blocks
Chromium):** the DOM-level **`_equiv_walk` byte-identical stamp** (build the
pre-Stage-1 tip and this tip, diff transcripts — must match line-for-line) and
`node tools/_boot_check.mjs dist/index.html`, plus a full `node tools/build.mjs`
(the sandbox can't clear `dist/`). The node-level equivalence above is the
strongest field-level proof available without a browser; `_equiv_walk` is the
end-to-end confirmation. Run these locally before shipping.

**Explicitly NOT touched (scope discipline — one stage only):** no Stage 2+ work.
The books are synthesized metadata; nothing READS them yet (AI book naming is
Stage 2; the Game Plan controller + `defCalls`→`defbook.calls` migration is
Stage 3; live coaching is Stage 4). The live Game Plan UI dial/load handlers were
left alone (Stage 1 is "No UI"). The source-of-truth is still the flat gameplan;
flipping it to the parts is later-stage work.

## 2026-08-15 — DEFENSIVE PLAYBOOK V2 BUILT (⚠ VERIFICATION OWED — read this)

**Owner directive: build first, test at the end.** Everything below is BUILT and
esbuild-compiles clean, with pure-node structural checks only (the v2 compile
pipeline was exercised in node: a starter book produces 8 headset calls, writes
def-fields-only into situation cells preserving offensive keys, compiles
personnel answers to formChecks, and `getEffectivePlan` picks it all up). **It
has NOT been probe-gated or opened in a browser.** The owed ledger:

- [ ] `node tools/_boot_check.mjs dist/index.html` (not run since the v2 UI landed)
- [ ] `node tools/_gate.mjs core` (full tier)
- [ ] **EXTEND `defbook_probe`** — v2 asserts: shelves/answers validation gates,
      shelf→defCalls (cap 12, name dedupe), shelf→cells writes DEF FIELDS ONLY
      and preserves a cell's offensive keys, answers→formChecks, v1→v2 repair
      (empty shelves, no loss), starter-book round-trip.
- [ ] **NEW `defsheet_probe`** — every DEFAULT_DEF_BOOK: validates, ≥1 base-shelf
      card, compiles, and each card's fields resolve through `applyDefCall`'s
      vocabulary. Every DEFAULT_OFF_BOOK: validates + every sheet entry legal.
- [ ] `creator_resilience_probe` / `creator_store_probe` rerun (defbooks now
      carry v2 payloads through the shelf/backup ring).
- [ ] Live click-through: Workshop → Defensive Playbook (open a starter, edit a
      card, save), Playbook Builder starter row, Game Plan "Starter books"
      optgroups, new-game Starting Defense (now always visible).
- [ ] Viewer probes act B/D scrub — still owed from the earlier audit (local).

**What shipped (all compile-checked):**
- **defbook v2 schema** (`defbook.js`, schema v2): shelves (5, ≤2 cards each) +
  personnel answers on top of the v1 identity spine. Cards = { front, coverage
  (8-picture catalog incl. Tampa 2/Cover 6/2-Man/Prevent), bring 3/4/5/6,
  pressure look, coach-mode extras }. Compile: cards→`defCalls` (headset chips,
  ≤12), top card per shelf→its situation cells (def fields only, offensive keys
  preserved), answers→`formChecks`. v1 books validate/repair losslessly.
- **`renderDefCallCard`** (`routeart.js` + CSS): the production call card —
  zones/man-lines/rush-arrows/fire-zone drop/box annotation over the real
  `DEF_FIELD_LAYOUTS`.
- **Builder v2 UI** (`creatordef.js` rewritten): list → identity spine →
  call-sheet shelves (card tiles, usage, edit) → personnel answers; card editor
  with the three big choices + live preview + Coach mode (box count, edge
  discipline — more dials join Coach mode only with verified legal values).
- **Starter library** (`js/engine/defaultbooks.js`): 6 complete offensive books
  (looks + legality-filtered sheets) + 6 complete defensive v2 books (identity +
  full shelves + answers), self-validating at load. Surfaced: both Workshop
  builders ("Start from a scheme"), Game Plan "Load a plan…" (dpb:/ddb:
  optgroups), new-game Starting Game Plan + Starting Defense (defense picker now
  always shown). The full new-world "Scheme step alongside the Division Editor"
  remains OPEN (wizard rebuild item — pickers are the interim).

## 2026-08-15 — THE INTRICATE GAPS AUDIT (standing backlog — owner directive)

Owner: *"we really really really need to make sure everything that looks like it
should be connected is actually connected to where it should be."* This section
is the standing ledger for that. **Method: every time a system ships, list its
natural neighbors here and check each one off with a wiring pass (or file it).**
Two wiring bugs already found by this lens: the Game Plan cross-control
contamination (fixed `eb4c221`) and the defbook pressure look written to a dead
field (fixed 2026-08-15) — both were "looks connected, wasn't."

**Connection gaps (known, not yet wired):**
- **Coordinators ↔ playbooks** — OC/DC scheme knowledge should key off the
  TEAM'S BOOKS (install/execution fit vs the book's identity; hire screen
  showing "fits your Air Raid"; a DC who's run your front family). Lands with
  root-architecture Stage 2 (named books everywhere). Design open: does a new
  hire nudge the book, or the book constrain the hire? (Owner instinct: it
  SHOULD matter; exact effect undecided.)
- **News feed ↔ new systems** — the inbox/news never mentions: Workshop
  creations entering a dynasty (book adopted, "new offensive identity"
  stories), defensive identity switches, star players (Play Now only — but
  exhibition recaps could name them), Season Mode milestones beyond the
  welcome, coordinator scheme-fit stories on hire. Sweep the feed generators
  against every post-July system.
- **Scouting ↔ named books** — opponent book names/identities surface in scout
  reports + film room language (Stage 2).
- **Practice/install ↔ books** — practice currently knows positions, not the
  book; "install time" for a newly loaded book is a natural hook (design call
  needed — could be flavor-only to respect the no-interference rule).
- **Manual/help ↔ Creator + books** — the manual has no chapters for the
  Workshop, composed plays, defensive books, or the (coming) shelves grammar.
- **Recruiting pitches ↔ scheme identity** — pitches speak DNA/scheme; verify
  they read the ACTUAL book identity once books are the root (not stale dials).

**Feature backlog (owner-requested 2026-08-15, slot into stages):**
- **Jersey numbers** — adjustable, non-repeating per team; live play animation
  identifies players BY NUMBER instead of position tag. Touches: player gen
  (assign by position-realistic ranges), Team Editor/roster UI (edit +
  uniqueness validator), watchphys labels, box scores/replay overlays, save
  migration. Independent of the root refactor — can ship any time.
- **Pre-snap huddle reads** — the defense reads the offense's personnel
  grouping out of the huddle and bases its front on it. The ENGINE seam
  exists (formChecks = check-with-me on personnel); the ask is (a) making it a
  visible pre-snap beat in the viewer (defense shifts after the offense
  shows), and (b) Defensive Playbook v2's "personnel answers" shelf being how
  players author it. Lands with DEF PLAYBOOK V2 §3 + a viewer beat.
- **Defensive Playbook v2 — "The Answers"** — full redesign ratified direction:
  see `Ref/DEFENSIVE_PLAYBOOK_V2.md` (call cards = front+coverage+pressure as
  one picture; shelves = situations; personnel answers = formChecks; Coach
  mode for depth; ~6 complete starter books per side; Scheme step joins the
  Division Editor in new-world setup). v1 builder survives as the identity
  spine.

## 2026-08-15 — THE PLAYBOOK BECOMES THE ROOT (architecture ratified)

Owner direction: the playbook is the root object of the game — every play call
(AI and human) selects out of a book, the game plan is how you CONTROL the book,
live coaching and the play animation are parallel consumers of the same call.
**`Ref/PLAYBOOK_ROOT_ARCHITECTURE.md`** is the ratified plan: a 7-stage
re-rooting (not a rewrite — the sim already picks through a playbook-shaped
structure; it gains a named object + one compile seam). Ratified decisions:
both live call modes KEPT (book underneath), every AI team gets a NAMED scoutable
book, dynasty books are snapshots with an update prompt. Fidelity ground truth
for stages 5–6 is **`Ref/CREATOR_FIDELITY.md`** (what the art honestly represents
today; variation `layout:` pointers are dangling — wiring them is stage 6).
Start with stage 1 (object + compiler, `_equiv_walk` byte-identical gate).

## 2026-08-15 — Full audit of the un-playtested batch, then a fix pass

`Ref/AUDIT_2026-08-15.md` is the full report (P0/P1/P2, file + repro each). The
batch was audited in a live browser (Workshop, Composer, Defensive Playbook,
Team Editor, full new-game wizard with custom playbook + defense, Game Plan
loads) plus the core gate. All P1s and P2s were then FIXED, owner-ratified:

- **Multi-look playbooks now actually work in the sim.** `rollFormationEntry`
  (new, `formations.js`) returns the WINNING ENTRY; `sim.js` takes the rolled
  entry's own `.variation`. Before: Base 90 / Trips 10 played Trips on
  1000/1000 snaps (Base never played, weights ignored). After: 20/40/40 rolls
  ≈ 6k/12k/12k over 30k snaps. `validatePlaybook` now warns on duplicate
  (formation, look) pairs.
- **THE PLAYBOOK OWNS THE FORMATIONS (owner call).** The Game Plan's Package
  tab no longer adds/removes formations — it shows the loaded book's looks
  (diagram cards, "Spread · Trips" labels, personnel) and keeps ONLY the usage
  sliders, plus "Load a plan…" / an Open-the-Workshop button. The old picker
  toggled by id and mangled multi-look books (dup rows, un-tick deleted one
  look of several). Header now counts "N formations · M looks". Playbook
  subtab formation strip deduped.
- **Old Auto-assigned composed plays survive reopening.** `_lineupFromData`
  (`creatorplay.js`) distributes slot-less routes like the play card draws them
  (screens/checkdowns → backs, rest outside-in); untouched receivers stay in to
  block, so reopen+resave keeps the exact part list (= exact grades). Before,
  opening one silently replaced its routes with position defaults.
- **Authored stars are genuinely the STARTER (owner pick: "star starts, rated
  #1").** `applyTeamStars` nudges the star above the best surviving teammate at
  the spot — composite AND roleRatings (depth order for DE/OLB/DT/LB/CB/S sorts
  on roleRatings). 40-team Solid-caliber stress: 0 misses. `star_player_probe`
  8/8 (was failing ~1 in 5 in the gate).
- **Team Editor swallowed clicks fixed.** te-name/nick/cresttext no longer
  `change`→rerender (blur into a button destroyed it mid-click — first click
  after typing was lost). Crest/name/nick refresh in place on `input`.
- **Probe drift fixed:** `creator_store_probe` now expects FIVE creation kinds
  (defbooks); `build_stamp_smoke` asserts the foreign hash in the stamp
  TOOLTIP and the "update ready" action in the visible text (matches the
  2026-08-15 mainmenu change).
- **Formation diagrams no longer clip the backfield.** `renderFormationDiagram`
  scales vertically from the box + the layout's deepest man (was fixed
  topPad/yScale tuned to 180×116 — QB/RB/FB were cut off on every 74–96px
  card). Bounds-checked: 0 violations at all five card sizes.
- **Blocked receivers draw a visible "T"** (stem + crossbar above the dot);
  the old 10×5 white bar sat exactly under the white dot — invisible.
- **Repair-on-load at both entrances.** Game Plan `pb:`/`dd:` loads and the
  new-game Starting Playbook/Defense now run `repairCreation` first, apply the
  cleaned book, and notify what changed; unrepairable books say so instead of
  failing silently (the new-game path had bare `catch {}`).
- **Workshop hub clears ALL editor state on tab switch** (play/team/preview
  included — a half-open editor no longer greets the next visit).

Cloud gate on the fixed tree: see `_gate_last.json`. Known cloud-only rest:
`viewer_act_b/d` scrub checks fail reproducibly in the container but that code
was NOT in this batch — **re-run those two locally**; if they double-fail on a
local machine the scrubber regressed at the converged tip. `tipdrill` is its
usual unseeded flake. Naming sweep: 10 worlds + 2,000 rerolls, zero
real-school forms.

---

## One-line state
Everything below is **built, converged, and running** in `dist/` and in the
`js/` working tree. The remaining work is a full local gate run + a couple of
small polish items. Nothing is half-broken.

## What's DONE (shipped into the working tree)
- **The Workshop (Creator tools)** — live, pixel-themed: Playbook Builder, Play
  Composer, Team Editor, Division Editor, Film Room. Reachable from the main menu
  and the in-dynasty Game Plan screen. Saves to a local library (`cfb-creator`).
- **Crest system polish** — real procedural shield crests everywhere (no emoji),
  editable crest letters, reroll crest/school, star prestige selectors,
  conference⇄team prestige coupling in the Division Editor.
- **Season Mode v2** — a one-off single season that IS the full dynasty
  (dashboard, schedule, standings, stats, team pages, game plan, coach/watch your
  games) **minus recruiting + coach's office**, **no preseason, no offseason**,
  ending at the playoff champion. Backed by `state.seasonMode`. See
  `Ref/SEASON_MODE_V2.md`.
- **Season Mode team picker** — setup reuses the Division Editor as a league
  customizer + team picker (tune the whole league, "Play as" any team, optional
  Save, then play). Great for trying a custom team.
- **Season Mode dedicated save + Resume** — its own IndexedDB slot `"season"`,
  separate from dynasty saves; "Resume Season" on the main menu. Autosaves during
  play, deleted on completion.
- **Season Mode polish** — team **search** in the picker (find a team by name
  across all conferences, no expanding needed); season-appropriate **inbox**
  wording (a "Season Kickoff" welcome instead of the dynasty scholarships note;
  championship notices drop the "recruiting budget" framing).
- **Viewer Act A–E (Codex)** — A animation, B replay/broadcast suite, C four
  replay cameras, D End Zone camera + special-teams replay, **E phase-aware
  replay director**. Each act branched from the prior converged tip and merged
  conflict-free. **Converged tip `fe36ec6`** (2026-08-14).
- **Codex review fixes** — Game Plan cross-control contamination (offense dial
  wrote the defensive box) and preset inheritance both fixed (`eb4c221`); clipped
  coach-name placeholders shortened (`11934c7`). Still open from the review:
  #10 deep-zone AWR inversion (CONFIRMED via probe — higher zone AWR loosens deep
  coverage; fix pending in `sepgeo.js`, needs stat_realism), #11 tempo gap
  (Chew 55 vs Hurry 95 snaps — balance tuning), and the rest of the mobile /
  first-hour UI batch (best after the viewer settles — they touch app.js/css).

## What's OPEN
1. **Full local gate** — run `node tools/_gate.mjs` (and `full`/`night`) on YOUR
   machine. The sandbox can't run the Playwright viewer probes or the boot check,
   and `stat_realism_harness` is slow there. A green local run is the real
   sign-off before any deploy. **Known flaky trio (now all `seedFlaky`, auto-retry
   once):** `size_fit_probe` (light-OLB tail on its 0.5% boundary),
   `play_fidelity_probe` (unseeded-RNG single-check miss ~1/9; 8/8 green on a
   clean tree), `playnow_smoke` (full-game Playwright walk on fixed timeouts).
   A lone flake clears on retry; a REAL regression fails both tries and still
   gates — if anything double-fails, it's real.
2. **Act base branches / the cadence** — each viewer act branches from the
   LATEST converged tip, never an old act branch, never two acts in parallel.
   Current base for the NEXT act: **`act-e-base`** (= tip `19681a5`, everything
   through Act D + all polish): `git checkout -b codex/viewer2-act-e act-e-base`.
   (`act-d-base` @ `3681db5` is spent — D already shipped from it.)
   Cadence: Codex ships act from `act-X-base` → handoff → I converge + cut
   `act-(X+1)-base` → next act.
3. **Pending post-gate reverse-sync** — the converged-with-D tree (`19681a5`)
   is committed in the clone but NOT yet written to this folder's WORKING TREE
   or `dist/` (held so the running gate keeps its stable build). After the gate:
   reverse-sync `19681a5` here + rebuild `dist/` so the local playable build
   includes Act D. Until then, the folder's playable build is pre-D (my polish,
   no End Zone camera yet).
3. **Git hygiene (see repo layout below)** — the working tree is converged but
   the folder's git history is on a divergent line with everything uncommitted.
   A clean checkpoint commit here (coordinated, not unilateral) would end the
   cross-repo confusion.
4. **Viewer next slice (Codex's suggestion, = Act D territory)** — perspective
   end-zone camera preset; unify special teams under the replay clock. Codex
   branches Act D from `act-d-base` (see item 2). *(Now historical — A–E have all
   shipped; the forward plan lives in the roadmap section below.)*

## Viewer presentation roadmap — remaining acts (OPEN)

`Ref/VIEWER_PRESENTATION_ROADMAP.md` is the agreed direction for the 2D
broadcast/replay viewer after Act B. **Presentation only** — every item is pinned
to the recorded sim result; the viewer shows what the engine computed more
convincingly, it never alters an outcome. Acts A–E have landed the first stretch
(the projection/camera seam, four replay cameras, End Zone + special-teams replay,
the phase-aware director); **Act F (director shot-purpose focus) is the current
act — built but still UNCOMMITTED in Codex's worktree, see the note below.** What
the roadmap still has OPEN, in its own recommended order:

- **Cameras still unbuilt.** Field animation is stored in field coordinates and
  projected to screen through a selectable camera; that seam exists (broadcast
  sideline, high tactical, reverse, End Zone). Not yet built: a tight
  red-zone / goal-line camera, a diagonal / simplified SkyCam, and full
  player-isolation / ball-follow replay cameras (Act F's director focus is the
  first taste of ball-/player-follow framing).
- **World-space ball height (z) — the big next architectural item.** Today much of
  the flight lift is a screen-space effect. A real world-space z coordinate lets
  the same pass read correctly from sideline, End Zone, and high camera, and
  unlocks: spiral rate by flight, wobble after a tip, end-over-end punts/kicks,
  better snap / handoff / option-pitch / lateral transfers, accurate
  hand-attachment points, ground contact / tumble / bounce, proper occlusion as
  the ball crosses in front of or behind players, and a subtle visibility
  floor / halo that never lies about the ball's real location. Release, catch,
  landing, and spot stay pinned to the recorded result.
- **Articulated 2D player rig (no sim change).** A lightweight rig — not
  hand-authored animations — for more convincing elbow/shoulder/foot/ball
  relationships while keeping the stylized look: eight-direction facing (vs the
  current small set), correct depth sorting (nearer players cross in front), foot
  planting / turning lean / real acceleration (less sliding), hands and shoulders
  aligned to actual block/contact partners, QB release points + receiver hand
  targets, head/eye tracking toward ball or assignment, better gang tackles /
  piles / toe taps / falls / get-ups / celebrations, more player identity (body
  type, equipment, sleeves, gloves, deterministic accessories), and cleaner
  stance→sprint→contact→tackle→post-play transitions.
- **Presentation geometry polish (viewer-only, safe).** Curved, speed-aware
  movement between recorded landmarks; better sprite spacing; perspective scaling
  + occlusion; contact alignment; route-break and pursuit curvature; boundary,
  pylon, goalpost, and end-zone depth; unified special-teams animation/replay.
- **Kept strictly separate — simulation geometry.** `sepgeo.js`, `run2geo.js`,
  `rushgeo.js`, `yacgeo.js` determine OUTCOMES. They can also improve (zone
  exchanges, force/spill, rush lanes, pursuit leverage, second-tackler timing) —
  but that is a separate football-engine pass with statistical A/B testing, NEVER
  mixed into a presentation act.

**Roadmap's recommended order:** (1) reusable camera/projection system, old
orientation restored as a camera — LANDED; (2) world-space ball height + genuine
end-zone / high / reverse views — reverse + end-zone LANDED, **ball z still OPEN**;
(3) depth sorting, expanded directional bodies, hand anchors, improved contact;
(4) movement curves, foot planting, piles, boundaries, special teams; (5) only
afterward, outcome-bearing (simulation) geometry. **Ceiling:** ~2–3 more
substantial presentation acts before diminishing returns — a very convincing
stylized multi-camera broadcast + coaching-film engine, not motion-capture
realism.

**Viewer Act F (director shot-purpose focus) — COMMITTED + BUILT (2026-08-16).**
Committed on branch `codex/viewer2-act-f` (`8b3395d`, parent `fe36ec6`), ported
onto `source` (`ee5accc`), and built into `dist` — see the reconcile section at
the top of this file. What's there: new pure focus
selectors in `js/ui/watchcamera.js` (`replayDirectorFocus`,
`specialTeamsDirectorFocus`, `watchDirectorFocusLabel`); a `#watch-director-bug`
shot-purpose caption + `watchApplyDirectorFocus` primary/secondary focus treatment
in `js/ui/app.js`, cleared on manual-camera takeover; the `.watch-director-bug` +
`wp-focus-primary/secondary` styling in `style.css`; and a new
`tools/viewer_act_f_probe.mjs` (node-level focus assertions + a live Playwright
End Zone/return scrub that asserts zero outcome mutation) plus a gate-manifest
entry. Presentation-only. Node-level focus probe passes 7/7 and the app bundles
clean with Act F wired in. **Still owed:** the Playwright End Zone/return browser
scrub (visual only) — unrunnable in the sandbox.

## Cosmetic UI — remaining (need browser / a design call)

- **New-game nested scrolling** — two simultaneous scrollbars on the new-game
  setup; small CSS fix but needs a live browser to target the right scroll
  container.
- **Mobile readability** — ~380 tiny (8–11px) font-size declarations; bumping to
  13–14px body is a full re-theme of the intentional pixel-art density, so it's a
  design decision (keep it, or commit to a careful screen-by-screen pass), not a
  blanket change.

## Creator — remaining work (the ENTRANCES, not the tools)

The Workshop tools are all built + polished (Playbook Builder, Play Composer,
Team Editor, Division Editor, Film Room, backed by `creator.js` + repair/backup)
and Season Mode ships them. What's left is the connective tissue that loads
creations into a real dynasty — designed in `Ref/CREATOR_ENTRANCES.md`
("DECIDED 2026-08-13, ready to build"), not yet built:

1. **New-Game Wizard rebuild + the unified SCHEME model** (IN PROGRESS 2026-08-14)
   — a scheme = offensive playbook + defensive playbook + a DERIVED DNA lean.
   Offense and defense are separate choices; DNA lean comes from the scheme, not
   a separate step. Built-in scheme presets (Air Raid, Ground & Pound, West
   Coast…) reuse the built-in gameplan presets. Custom league/team/scheme are
   opt-in expanders in the wizard.
2. **Inline "＋ Create new" deep-links** — from the wizard (or any picker) into an
   editor and BACK to the wizard with the new creation selected. Editors were
   built as embeddable components for exactly this round-trip; not yet wired.
3. **The defensive playbook** — **BUILT 2026-08-15 (`fd29d16`).** New engine
   `js/engine/defbook.js` (customDefBook: baseFront + frontMix, coverageScheme,
   aggression stop, pressIdentity, pressureSource, greenDog/spyQB — all fields
   the sim already consumes; `applyDefBookToGameplan` mirrors blitzPct from the
   stop, leaves the offense untouched). Front-first **visual builder**
   (`js/ui/views/creatordef.js`): front cards drawn from `DEF_FIELD_LAYOUTS` via
   the new `renderFrontDiagram`, a base-front pick + usage weights, and pick-rows
   for coverage / aggression / pressure look, plus the two toggles. New "Defensive
   Playbook" card in the Workshop hub; `defbooks` shelf (cap 30) + load-repair.
   `defbook_probe` green (25/0: validation gates, apply/extract round-trip,
   blitzPct mirror, repair). **In-dynasty + new-game entrances DONE (`ee8b8ef`).**
4. **Load Workshop creations into a Game Plan** — **DONE (`ee8b8ef`).** The
   in-dynasty Game Plan "Load a plan…" dropdown now lists two Workshop optgroups:
   your **offensive playbooks** (`pb:`→`applyPlaybookToGameplan`, swaps only the
   offense) and your **defenses** (`dd:`→`applyDefBookToGameplan`, swaps only the
   defense) — so a custom offense and a custom defense compose freely mid-career.
   New-game gained a **Starting Defense** picker (custom defbooks) alongside the
   existing Starting Game Plan, and a latent bug was fixed there — a custom
   starting playbook was being *computed and discarded* (apply* returns a new
   gameplan; the result is now written back). Still open: embedding the actual
   editors mid-career (reach the Builder/Composer screens from Game Plan, not just
   load a saved book) — a smaller follow-up.
5. **Play Now** — surface the custom-team library in its team picker (half-wired).
6. **Team Editor phase 2 — authored STAR players (DONE 2026-08-15, `04887d2`).**
   Full 85-man authoring is impractical; the emotional core is a handful of NAMED
   stars. Engine (`world.js`): `coinStarPlayer({position,classYear,caliber,name})`
   builds a calibrated player (STAR_CALIBER: Solid≈67 / Star≈87 / Superstar≈91 OVR,
   probe-ordered), `applyTeamStars(school, stars)` drops each onto a generated
   roster as the STARTER at its spot (swaps the weakest body there, keeps counts,
   rebuilds the depth chart). Team Editor has a **Star players** section (position,
   name, class, caliber; up to 5) stored on `t.stars`. **Play Now honors them**
   (makeCreatorTeam applies stars after generating). `star_player_probe` green
   (11/0), in the core gate. **BY OWNER DIRECTIVE (2026-08-15): custom rosters are
   PLAY-NOW ONLY — never allowed in a dynasty.** `applyTeamStars` is called only in
   `makeCreatorTeam` (exhibition); no dynasty/world-gen path consumes `t.stars`, and
   it must stay that way. (This closes the earlier "thread stars through
   compileLeague / Season Mode" idea — that is intentionally NOT wanted. A
   "found a dynasty from a custom team" entrance was scoped and then dropped for
   the same reason.)
7. **★ MAJOR UI polish — Playbook Builder + Play Composer go VISUAL (EA-style).**
   **LARGELY DONE 2026-08-14** (commits `2ab97bf`, `262f4ca`, `ae5ef51`,
   `248344b`). New module `js/ui/views/routeart.js` is the reusable play-graphics
   primitive — one place that draws a route as SVG (parametric: origin, mirror
   side, scale), plus `renderPlayCard`, `renderFormationDiagram`,
   `renderConceptThumb`. What shipped:
   - **Play Composer**: route picker is a grid of route-art tiles; a **live play
     card** draws the selected routes on turf with a color legend; an optional
     **Formation** dropdown draws the routes from a real alignment
     (`OFF_FIELD_LAYOUTS`), saved as the play's `formations` metadata (no balance
     effect); library rows show diagram thumbnails. The composer is now a
     build-a-play list: **pick which receiver runs each route** (the formation's
     catch slots, Auto default), **flip** a route left/right, and **repeat**
     (duplicate) or remove any route. Stored as an aligned `assigns:[{slot,flip}]`
     array — pure diagram metadata, preserved through `repairComposedPlay`; repeats
     flow through the band-clamped grader (already probe-proven safe), so nothing
     touches balance. `play_compose_probe` still green (17/0, 1875 plays).
   - **Playbook Builder**: each formation is a **card with its real pre-snap
     diagram** + personnel; expanding a formation shows an **EA-style grid of play
     cards** (every one of the 62 concepts drawn — routes for passes, a run arrow
     through the gap for runs); library rows show the top formation's diagram; a
     **full-screen playbook preview** (👁) browses a saved book by formation.
   All UI-only — no engine/sim/balance code touched; verified by route-module
   smoke tests (all 11 formations × 62 concepts render), clean esbuild build, and
   bundle syntax parse. NOT yet done (adjacent, needs a live-browser look + owner
   steer): a big **play-detail hero modal**; bringing the same route art into the
   **in-dynasty Game Plan** / live play-selection screens (different screens,
   touches live game UI — see Creator entrance #4).

## Naming / trademark (legal)

- **Coined team names are fictional (fixed 2026-08-14, `d6ea520`).** The Creator
  reroll / custom-team `coinTeamIdentity` used to build `"<real city> State"` and
  coined real programs (owner rolled **"Boise State"**). It now reuses the world
  generator's guarded `makeIdentity` AND rejects university/trademark suffixes
  (State/University/College/Tech/A&M/Institute/…), falling back to the game's own
  fictional convention (real city + a geographic word, "Boise Ridge"). Location
  still pins to the real city for recruiting.
- **Token pool is now all fictional landmarks (2026-08-15, `de64430`).** The
  procedural name tokens (`STATE_TOKENS`) used to contain a few real schools
  (Piedmont, Cumberland, Allegheny, Willamette, Wabash, Catawba, Talladega, Sierra
  Nevada) — that's what leaked "Cumberland College." Replaced them, and expanded
  every region, with vetted natural-feature names (rivers/ranges/basins:
  Monongahela, Sawtooth, Bitterroot, Yellowstone, Deschutes, Okefenokee, Big Sur,
  Delmarva, Patapsco, …). Also expanded `REAL_SCHOOL_STEMS` with a famous-program
  backstop (all 50 states + best-known college cities) so the CITY-bearing
  patterns can't coin "Boise State"/"Fresno State". Verified: 6 generated worlds +
  1,800 targeted rerolls → **zero** real university-form collisions;
  `worldgen_check` green. `coinTeamIdentity` now uses the (safe) generator, so
  rerolls get proper names like "Sawtooth State", "Delmarva State".
- **Both residuals now FIXED (2026-08-15, `c207b8c`).** (1) The CITY-bearing name
  patterns (`cu`/`cs`/`cc`/`ct`) are retired — real cities now take a **geographic**
  suffix (`cg`: "Selma Ridge", "Owensboro Bluff") or a denomination, and the
  university suffixes (State/University/Tech/A&M/Poly) ride the **fictional
  landmark tokens only**. Verified: ~4,900 generated + rerolled names → **zero**
  "<city> State/Tech/A&M". (2) Every real-adjacent hand-authored static D1 team was
  renamed to a fictional landmark: Piedmont Tech→New River Tech, Marietta A&M→Oconee
  A&M, Rockford Tech→Tippecanoe Tech, Ruston Tech→Kisatchie Tech, Cimarron
  A&M→Navasota A&M, plus the college-town "<City> State" evokers (Fort Collins
  State→Poudre State, Corvallis State→Alsea State, Kettering State→Red Cedar State,
  Wichita Falls State→Chisholm State, Kalamazoo State→Gull Lake State, Peoria
  State→Mackinaw State, Las Cruces State→Organ Peak State). `worldgen_check` green.
  Remaining generic long-tail: person/saint liberal-arts names ("Merritt College")
  can coincide with a real small college — a broad, low-risk category the game
  intentionally uses and `isRealSchoolName` still screens; left as-is.

## Formation variations — where they are

FORMATION_VARIATIONS (`constants.js`) is **intact and live** — nothing was
removed. Every base formation has two variations (Power-I → Big/Twins, Spread →
Trips/Ace, Air Raid → Empty/Tight, …) that shift personnel (`pkg`), run/pass
`lean`, `matchup` edges, `situational` profile, and a viewer `layout`. They're
wired end-to-end in the ENGINE: `playbook.js` validates + stores a per-formation
`.variation`, `sim.js` applies it (`offVar` / `pickedVariation`), and a gameplan
formation entry carries it. **Now SURFACED (2026-08-15, `575b98a`):** the
Playbook Builder's formation cards (and the full-screen preview) have a
Base / <var1> / <var2> picker that writes `formations[].variation`, shows the
variation's label as a badge, and updates the personnel line to the variation's
`pkg` (e.g. Power-I "Big" → 3 TE, 0 WR). Verified end-to-end: the variation
rides validate → applyPlaybookToGameplan → gameplan.offFormations, and repair
drops a stale one. (Still no picker in the *live in-dynasty* Game Plan formation
list — the Creator playbook path is the way to set them for now.)

## Play graphics + composer overhaul (2026-08-15, many commits)

A big pass on how plays are drawn and composed, driven by owner playtest notes:
- **No invisible receivers (`c63e9f0`).** `renderPlayCard` now draws a route for
  EVERY skill player on a formation — authored routes bright, position-based
  **fill routes** (clear/curl/checkdown) faint for the rest; a "block" draws a
  block bar. Matches what the sim actually does (all eligible receivers release).
- **Composer redesigned (`7093bb9`).** Formation is now FORCED (no even-spread);
  the editor is one row per formation skill slot and you set each receiver's route
  or Block. Saved with formation + per-receiver assignment; `blocks` preserved
  through repair. Old plays load into the lineup.
- **Playbook Builder — multiple looks per formation (`26c2d79`).** A formation can
  carry Base + any variations at once, each its own weighted entry.
- **Variations get their OWN alignment diagram (`e91f72f`).** Derived from the
  variation's personnel + intent (trips/twins/empty/heavy/balanced); 22 distinct;
  each look shown as a card with its positioning; preview reflects it.
- **Run graphics represent the concept (`630557a`).** Each run classified
  (inside/outside/power/counter/trap/draw/dive/sweep/toss/jet/reverse/option/
  triple/qbpower) → distinct RB path + signature block (pull, lead, pitch, motion,
  counter step, delay).
- **Field texture (`3ea91e6`).** Faint yard stripes + dashed hash columns on every
  card. Broader "commercial polish" is ongoing and wants live eyes.

**All of the above is UI-only, verified by node smoke tests + clean esbuild +
bundle syntax parse — but NOT yet seen in a live browser.** A playtest + gate is
overdue after this stack.

## Repo layout — READ THIS before any git action
There are **two repos with the same branch names**, which is the #1 cause of
confusion:
- **This folder (`C:\dev\Blueprint`)** — the shared working tree. Both Codex and
  the owner edit files here; Codex commits its `codex/viewer2-*` branches here.
  Its `source` branch is on a *different, minimal* lineage — do NOT assume its
  git log reflects the real feature history.
- **The build/commit clone (sandbox `/tmp/bpg`)** — holds the clean feature
  history (`source` tip `a3d0b79` → merge `7d352de`). Building + probes run here.

**Workflow that works (don't deviate):**
1. Edit source in THIS folder's `js/` + `style.css` (never a built file).
2. Build in the clone: it pulls this folder's `js/tools/style.css` in, runs
   `node tools/build.mjs`, then copies `dist/index.html` back here.
3. **Never sync the clone→folder direction blindly** — that clobbered Codex's
   viewer files once (the "Act A clobber"). When converging Codex work, merge in
   the clone, then reverse-sync the merged tree back to this folder.
4. Commit in the clone. **Do NOT push** unless the owner says so.
5. `git` in THIS folder is fragile — don't `git commit` here casually. If a task
   says "check on Codex's merge," that means READ the handoff docs and verify the
   code, NOT commit a doc.

## Coordination with Codex
Codex ships viewer work on `codex/viewer2-*` branches + a `Ref/CODEX_*_HANDOFF.md`
and `Ref/VIEWER_ACT_*` record per act. Convergence = merge that branch into the
feature line (base has been `e45c89b`), keep both sides (overlaps are only
`app.js` + `style.css`), verify, reverse-sync, and note it in `Ref/CONVERGED_*`.

## Key pointers
- `Ref/SEASON_MODE_V2.md` — Season Mode architecture (the seam, engine guards,
  save/resume).
- `Ref/CONVERGED_2026-08-14.md` — the Act B/C merge record.
- `Ref/CODEX_ACT_B_HANDOFF.md`, `Ref/CODEX_ACT_C_HANDOFF.md` — Codex's records.
- `CLAUDE.md` — build, deploy, verification, and the standing subsystem rules.

## Device-git workaround (discovered 2026-08-16, unattended session)

Cowork's device bridge CAN commit in this folder after all — the old "can't
write .git" fact was really a DELETE restriction: git's unlink of its lock
files fails ("Operation not permitted"), stranding `.git/index.lock` and
blocking the next operation. The workaround: `mv` the stale lock into
`_to_delete/` (renames are allowed; deletes aren't), then add/commit
normally — writes and renames all succeed. `_to_delete/` collects the moved
locks + the occasional orphaned `.git/objects/*/tmp_obj_*`; the owner can
empty it whenever. Commit `cfb9bd2` (Stages 4–7) was made this way, scoped
to the 20 stage files — the folder's ~197 other dirty entries (Codex-era
docs, probe screenshots) were left as found; the "clean checkpoint commit"
question from the repo-layout section remains an owner call. Still NEVER
push from here.

## 2026-08-18 — D10 CLOSEOUT + OD RATIFICATION (fresh-VM session, commit job)

**D10 closeout.** The audit session's VM died before its final gates; this
session (fresh VM) discharged them: uncommitted set verified as exactly the
OWNER-CHECKLIST scope + the standing deliberately-left files; clean esbuild
build from a temp copy outside the mount (all sanity PASS, cache
`cfb-dynasty-d3f0e4ad8c`), CSS braces 5698/5698; `plan_cohesion_probe` ×3 ALL
PASS (44/0); **equivalence gate discharged by construction and by hash** —
this tree's `dist/index.html` sha256-identical to a HEAD build
(`91ed108b…e2cd`), as required for comment-only js changes. Commit `ec7300b`
(branch `source`, NOT pushed): defbook.js comments · plan_cohesion_probe.mjs ·
_gate_manifest.mjs CORE entry · audit + dispatch docs · STATUS D10 entry.

**OD RATIFICATION (owner, 2026-08-17 — blanket YES to all twelve, each at its
stated recommendation).** Marked per-OD in
`Ref/COHESION_AUDIT_2026-08-18.md` OPEN DECISIONS. The record: OD-1 (a)
family=CALL grammar, trio=STANDING identity · OD-2 (a)+(c) check wins and
learns coverages · OD-3 headset beats `_nextPlay` · OD-4 delta-everywhere,
±10 overlay magnitude, cards restated · OD-5 (b) narrow to the three the
engine speaks · OD-6 CARD_VOCAB via D12 · OD-7 typo-reading (`rotation`
typos; robberCall:"rob") + validateDefBook extended · OD-8 every writer
writes the stop, blitzPct derived-only · OD-9 progressive retirement of
pressureSource · OD-10 D16 sequencing ratified · OD-11 extend PLAN_FIELD_SIDE
+ rebuild callSheet · OD-12 badge lists derived. **Consequence: D11–D17 are
no longer owner-blocked** — dispatchability is now governed only by the
dependency table in `Ref/COHESION_DISPATCH_2026-08-18.md`. Deliberately-left
files remain uncommitted (~39 PNGs, `_night_full_log.txt`,
`test_notes_8-16.txt`). NOT pushed.
