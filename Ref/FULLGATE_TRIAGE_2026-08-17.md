# FULL-GATE TRIAGE — the `_night_full_log.txt` reds (owner-machine run, 2026-08-16 15:13)

Diagnosis-only session, 2026-08-17. No code was changed. Log tree = `c6f6e93`
(pre-D1–D9); triage tree = HEAD `ec69459` (all nine D-blocks + night gate +
dial-map sign-off in). Node-reachable probes were re-run in this sandbox to
confirm classifications; Playwright cannot run here (Windows-only
`.pw-browsers`, downloads blocked), so PW verdicts are code-reading-level and
say so.

## ☎ PHONE SUMMARY

18 reds. **Only ONE is a product bug**: the timeout screen's Rest-of-Game
chips are dead — rendered but never wired (`#to-adjust-root`,
`js/ui/app.js`). One-block fix, S.

Everything else is test-side or environmental:

- **2 HEALED at HEAD** (verified by re-run): covfam (17/0 at N=120) and
  tipdrill (3/3 green — and its logged "[3/78]" was never the failing
  check; the gate log only keeps the LAST output line).
- **8 TEST-STALE**: a whole family of PW smokes still enters through the
  RETIRED coach main-menu door (`#btn-mm-newcoach` / `[data-mm-coach]` —
  tree-only menu since the W9 §12 change, in the repo since the 08-12
  import): letter_logo, saved_team_library, instant_classic,
  calendar_display. Plus new_world (wizard walker doesn't know the Staff
  step), nav_back (asserts the pre-season-group tab layout), dna_cards
  (manifest registers a NODE probe as `pw`, so it parses the dist path as
  its games count → NaN → 0-game arms — reproduced here), and
  formation_playbook (its Mesh band's true mean now sits BELOW the bar).
- **1 probe hang misdiagnosed as timeout**: commit_rate_test spins forever
  at the day-3 "confirm positions" camp gate (`posReviewed`) — it has hung
  on EVERY run since 08-12. One-line fix; season then completes in ~106 s
  even in this slow sandbox.
- **3 flakes**: size_fit (the standing boundary flake, metadata already
  right), gaplist (squib-kick rare-event zero, ~13%/run — needs the
  `seedFlaky` retry it doesn't have), pass5_band_ab (LIVE-arm band graze;
  its sibling pass6 already carries `seedFlaky` for the identical mode).
- **3 ENV-ONLY**: defcall_ui + table_button_phone (locator flake/timeouts
  on a demonstrably overloaded box), position_gallery (exit 0xC000013A =
  console Ctrl-C — **the run was aborted here**, and the five probes after
  it in the manifest never ran: stadium_audio, action_animation,
  rb_anatomy, watchphys, watch_live).

**Bottom line for the sitting**: fix the one wiring bug + ~9 small
test/manifest edits, then one clean FULL re-run on an idle machine. Order
of operations at the end.

---

## REAL-BUG

### 1. `timeout_screen_smoke.mjs` — FAIL (2) → REAL-BUG (product), present at HEAD — fix S

The two failures are the chip-WRITE checks, and the chips are genuinely
dead. The timeout overlay's Rest-of-Game tab renders
`<div id="to-adjust-root">${renderHalftimeAdjust(gp)}</div>`
(`js/ui/app.js:2994`), but `data-gp-set`/`data-gp-aggr`/`data-gp-boolset`
clicks are handled only by `wireDefaultsListeners`
(`js/ui/views/gameplan.js:1559`), which is invoked in exactly two places:
the halftime screen (`app.js:2209`) and the kickoff modal's
`#kickoff-adjust` (`app.js:2424–2426`). Nothing ever wires
`#to-adjust-root`. A fossil corroborates the intent: `SCROLL_SELECTORS`
includes `.to-adjust-body` with a comment about chip presses re-rendering
(`app.js:487–489`). The smoke shipped green 2026-08-08; the wiring was
already missing at the 08-12 git import — plausibly two-repo-drift
collateral, not any D-block.

Not test-stale despite D7: D7 removed TEMPO from the transport row, but the
Rest-of-Game panel is `renderHalftimeAdjust`, which still renders the
`baseTempo` and `data-gp-aggr` chips in both modes (`gameplan.js:1084,
1100, 1110`); the smoke's settle loop also survives D7 (`#dc-ride` falls
through to `#dc-send`). The manifest's envKnown note ("chip-write checks
fail EARLIER on pristine in cloud") describes a different, earlier cloud
stall — the local FAIL (2) is the genuine bug.

**Fix (S)**: in the global wiring block next to `#to-cancel`
(`app.js:~2512`), wire the root the same way the kickoff modal does:

```js
const root = document.getElementById("to-adjust-root");
const gpL = _liveGPMine();          // app.js:3017 — same GP the overlay renders
if (root && gpL) wireDefaultsListeners(gpL, { root });
```

The smoke then needs no changes. (Code-reading confidence — PW not
runnable here; the trace accounts for exactly 2 failures.)

---

## TEST-STALE

### 2. `commit_rate_test.mjs` — TIMEOUT → deterministic probe hang (NOT overload, NOT a perf regression) — fix S

Runtime-confirmed here. `advanceDay` refuses to pass day 3 until positions
are confirmed before camp (`js/engine/offseason.js:917`, the PLAYTEST
08-12 item-12 gate); `posReviewed` is only set by the dashboard UI
(`js/ui/views/dashboard.js:1904–1913`). The probe's loop
(`tools/commit_rate_test.mjs:46–50`) handles halftime pauses but not
advance-refusals, so it spins at day 3 forever, printing nothing (hence
the empty log tail). Reproduced: `day 3 -> 3 … repeated until killed`.
With one added line — `devCtx(state).posReviewed = true` — the full season
completes in **106 s in this sandbox** (slower than the owner box), well
inside even the original 300 s.

`git log -S posReviewed` shows the gate present since the repo import
(08-12): the probe has hung on every run since, including the 08-14 run
whose timeout was booked as machine overload. The manifest note at
`_gate_manifest.mjs:254` (timeout bumped 300→600 for overload) treats the
wrong disease.

**Fix (S)**: add the `posReviewed = true` acknowledgment to the probe
(comment citing the day-3 camp gate); correct the manifest note; the
600 s timeout can go back to 300. The probe's day-numbering comments
(1–35/36) also predate the 30-day calendar.

### 3. `new_world_probe.mjs` — TIMEOUT, "N3 … -1 node(s), 0 chars" → walker doesn't know the Staff step — fix S

The probe's tree-path entry is current, but its wizard walker's `OPTIONS`
list (`tools/new_world_probe.mjs:71–72`) knows only
`data-ob-challenge|state|div|school|qb|front`. The current wizard's step 4
is `stepStaff()` (`js/ui/views/newgame.js:91–133`): OC and DC must each be
picked via `data-ob-staff="OC:id"`/"DC:id"` before `#ob-next-4` enables.
The walker dead-ends there → N2 fails → N3 reads a nonexistent root →
"-1 node(s), 0 chars, 0 card(s)" — byte-for-byte the logged line. The
staff step predates the 08-12 import; the probe was never updated — this
fails everywhere, so the manifest's "cloud" note is a mislabel. (The 08-15
Starting Defense `<select>` is NOT the blocker — it doesn't gate the next
button.) **Fix (S)**: teach `advanceWizard` the staff step — two selectors
(`'[data-ob-staff^="OC:"]'`, `'[data-ob-staff^="DC:"]'`), since both card
sets share `[data-ob-staff]` and the "skip group if any active" guard
would otherwise stop after the OC.

### 4. `dna_cards_probe.mjs` — "2 FAILED" → manifest misregistration, runtime-REPRODUCED — fix S

The manifest registers this pure-Node sim probe as `kind: 'pw'`
(`_gate_manifest.mjs:294`), and the gate appends the dist path for pw kinds
(`_gate.mjs:87`). The probe does `parseInt(process.argv[2] || '1200')`
(`tools/dna_cards_probe.mjs:22`) → `parseInt('…dist/index.html')` = NaN →
**0 games per arm → both discipline checks fail deterministically**.
Reproduced verbatim in this sandbox ("NaN games/arm … 2 FAILED", exit 1) —
which also explains "fails identically on pristine in cloud" with no env
story. The engine mechanism is healthy (`js/engine/sim.js:4522`
`drilledAway` on pre-snap flags; a real N=150 run cut pre-snap −9%).
**Fix (S)**: manifest entry → `kind: 'node'` (data-only, per gate policy),
plus defensive argv parsing in the probe.

### 5. `formation_playbook_probe.mjs` — 1 FAIL → band mis-centered; true mean now BELOW the bar — fix S

Re-run 7× at HEAD: 2 pass / 5 fail, always the known check
(`formation_playbook_probe.mjs:67`, Mesh share of short-game snaps
`> 0.15`). Observed 11.5–19.9%, pooled 157/1100 = **14.3% — the expected
value sits below the 15% bar**, so only upward fluctuations pass. Pre-D
control (4 runs at `141dc64`): pooled 14.5%, statistically
indistinguishable — D6 didn't detectably move it; the manifest's "~1 in 3,
counts 21–28" (2026-08-14) no longer describes reality, and a double-fail
through the seedFlaky retry is now roughly a coin flip per FULL gate. The
mechanism itself is healthy (all other checks 7/7; Mesh still ~2.5× its
neutral share). **Fix (S)**: re-center the bar to `> 0.10` (every observed
run clears it; still proves the lean) and update the manifest note. Do NOT
just raise N — with the mean below the bar, more samples fails always.

### 6. `nav_back_smoke.mjs` — 1 failure → stale group map; the product's back-nav is CORRECT — fix S

The failing check is the team-page one, deterministic — which is why it
fails "identically on pristine in cloud" AND locally: not env, stale. The
smoke's `GROUP_OF` (`tools/nav_back_smoke.mjs:129–134`) still expects
`standings`/`schedule` in the `program` group and asserts
`[data-program-tab]`; current `LEGACY_VIEW_MAP` maps them to the `season`
group (`js/state.js:1432–1433`), rendered with `[data-season-tab]`
(`js/ui/app.js:180–189`). The product side was verified correct in code:
`navSnapshot()` captures `seasonGroupTab`, `openSchool()` pushes it,
`navigateBack()` restores view + tab (`state.js:69,108–116,133–135`). The
regrouping predates the 08-12 import. **Fix (S)**: update `GROUP_OF` +
the tab assertion; drop the entry's `envKnown` flag.

### 7–9. The retired-main-menu family: `letter_logo_ui_smoke`, `saved_team_library_ui_smoke`, `instant_classic_ui_smoke` — crash tails → TEST-STALE — fix M each

One shared root cause. Since W9 §12 (in the repo at the 08-12 import), the
tree is the ONLY start path: `renderCoachSelect()`
(`js/ui/views/mainmenu.js:121–137`) intentionally renders no
`#btn-mm-newcoach`, `[data-mm-coach]`, or (via the unreachable
`renderCoachHome`) `[data-mm-classic]` rows. The listeners still exist as
optional-chained no-ops, so nothing errors in the app — but each smoke
`.click()`s a locator that never renders, Playwright auto-waits 30 s,
throws TimeoutError uncaught → the bare "Node.js v22.14.0" crash tails in
the log. Machine-independent; the manifest's "(cloud)" attributions are
mislabels. None are healed at HEAD.

- `letter_logo_ui_smoke.mjs:32` — `#btn-mm-newcoach`. **Fix (M)**: rewrite
  the wizard section onto the tree path (`#btn-mm-newtree` →
  `#mm-nt-first/last` → `#mm-nt-create`); note tree runs lock to
  D3/take-the-job and skip the Situation step.
- `saved_team_library_ui_smoke.mjs:37` — `[data-mm-coach]`. The coach-home
  saved-team library screen it tests is now unreachable UI. **Fix (M)**:
  retarget to wherever saved teams surface in the tree flow, or retire the
  smoke with owner sign-off.
- `instant_classic_ui_smoke.mjs:26` — `[data-mm-coach="…"]`. The tree home
  has its own classics UI (`[data-mm-tree-classic]`,
  `mainmenu.js:332–342`); all watch-viewer ids the probe uses afterward
  still exist. **Fix (M)**: re-seed classics onto a tree and drive the
  tree selector; the replay half survives nearly intact.

### 10. `calendar_display_probe.mjs` — crash tail → TEST-STALE (same family), NOT healed by D7 — fix S/M

Same dead entry: its wizard script starts `['click', '#btn-mm-newcoach']`
(`tools/calendar_display_probe.mjs:22`); a missing element yields the
clean "wizard stalled at #btn-mm-newcoach" exit — verbatim the manifest
note. The D7 update (`git diff 44af774^ 44af774`) changed exactly one
LATER line — `[data-kickoff="off"]` → `"watch"` — necessary once the probe
runs again, but it never reaches it, so this is NOT HEALED-SINCE. (If the
local tail really was a raw crash rather than the stall message, the only
candidate is `playwright` import/launch failing under load — an env
overlay on the deterministic staleness.) **Fix (S/M)**: replace the
WIZARD's first four steps with the tree entry; the rest of the walk is
selector-generic.

---

## HEALED-SINCE

### 11. `covfam_probe.mjs` — 16/1 → HEALED at HEAD (verified at the gate's exact N=120)

The failing check was reconstructed by re-running the gate-era tree
(`c6f6e93`) at N=120 in a /tmp clone: `FAIL Tampa 2 pole closes the deep
middle [deep non-WR1 comp% 60.3 vs ctrl 59.8]` (needs ctrl −0.5;
`covfam_probe.mjs:217`) — exactly 16/1, matching the log. At HEAD, N=120:
**17/0**, margin 1.6. Root cause is the probe's documented recurrence
mode: the finest directional checks sit at the paired-seed noise floor at
N=120 (header + the Pass-6 comment, lines 195–199, "recurred Pass 5 AND
Pass 6"); D6's heavy RNG-draw changes re-based the stream and the margin
landed back on the passing side. The Tampa-2 pole mechanism
(`js/engine/sim.js:2400–2421`) is present and working on both trees.
**Nothing owed for the gate.** Optional hardening (S): convert the check
to one of the file's own noise-free patterns (trace-read like the C6 qSep
check, or amplify-the-dial like the cloud check) so it stops recurring on
every RNG re-base.

### 12. `tipdrill_probe.mjs` — logged "[3/78]" → HEALED at HEAD; the logged tail was never the failing check

The gate stores only the LAST output line (`_gate.mjs:134`), and
tipdrill's last line is the PASSING live-rate report — "[3/78]" got
misfiled into STATUS and the manifest as the red. The real red,
reproduced twice identically on the pre-D tree: `FAIL viewer stages the
chain on most stamped plays [18/38]` (47.4% vs the `>= 0.5` bar,
`tipdrill_probe.mjs:131`). The probe is exactly what its header claims —
deterministic by construction (PRNG re-pinned per arm) — so the seedFlaky
retry necessarily double-failed; the manifest note (`seedFlaky`, "live
games unseeded") is wrong on both counts. At HEAD: **3/3 byte-identical
PASS** (staging 19/36 = 52.8%) — the D3/D6 play-population changes moved
the deterministic outcome back over the bar, by only 2.8 points.
**Fix (S)**: re-center the staging bar to `>= 0.4` (observed per-tree
values 47–62%) and/or raise gate args `['6']`→`['12']` (61.5% with real
margin, ~4 s cost); correct the manifest note and reconsider its
`seedFlaky` flag (a retry can never clear a deterministic red).

---

## KNOWN-FLAKE (gate-metadata work only)

### 13. `size_fit_probe.mjs` — 14/1 → the standing boundary flake, CONFIRMED, metadata already right

3 runs at HEAD: PASS / FAIL / PASS, always the same check — "fat tails:
light OLBs exist (≤218 lbs, >0.5%)" at 0.4–0.6% observed
(`size_fit_probe.mjs:27–29`: N=4000 unseeded recruits, true rate ~0.5%,
±4.5 Poisson noise straddling the floor). Matches the manifest note
(~1/3 fail; the logged red is a double-fail through the retry, ~1-in-10
gates). No regression signal. **Fix (S, optional)**: pin the probe's RNG
(as tipdrill does) or re-center the floor to `> 0.0025` — tail existence
is still proven and every observed run clears it.

### 14. `gaplist_probe.mjs` — 1 FAIL → rare-event flake with NO retry flag — fix S

Near-certain red: `G8b squib kicks happen (0 across 60 games)`
(`gaplist_probe.mjs:103`). The probe is unseeded and the squib trigger
(score while leading, ≤12 s left in a half — `js/engine/sim.js:6328`) is
rare: six 60-game batches at HEAD gave squib counts 3, 2, 0, 1, 3, 4
(λ≈2.2 → P(zero) ≈ 11–15% per run — one of the six batches would have
failed). Passed on first HEAD re-run (squibs=1) — the coin landing heads,
not a heal. The manifest entry (`_gate_manifest.mjs:193`) carries no
`seedFlaky`, so the gate gave it no retry. **Fix (S)**: add
`seedFlaky: true` (drops gate-failure rate to ~1.7%). **M (proper)**: add
a forced-squib arm mirroring the probe's own G8a iced-kick forcing
pattern, making the "happens" check deterministic.

### 15. `pass5_band_ab.mjs` — FAIL(1), tail "AMPLIFIED INSIDE 2x ENVELOPE" → LIVE-arm boundary flake; missing the seedFlaky flag its sibling has — fix S

The tail is the AMPLIFIED verdict; the probe prints the LIVE verdict on
the line above (discarded by the gate) and exits
`okLive && okAmp` (`pass5_band_ab.mjs:70–72`) — so the LIVE drift bands
failed (one of pts<2.0 / rush<8 / pass<10 / comp%<1.5 / sk<0.35; which
one is unrecoverable from the log). NOT D6 and NOT a stale band: the run
predates D6 by ~14 h, and the probe gates DIFFERENTIAL drift between a
LIVE and a KILL arm whose switches (`__noRPOConflict/__noGadgets/
__noChoiceRoutes`) don't touch D6's `__qbDiceLegacy` — D6's rush shift is
live in both arms and cancels (confirmed: rush ≈150/g in BOTH arms at
HEAD). 3/3 green at HEAD (N=120), but run 2 grazed two bands (rush 7.18
vs 8, sacks 0.31 vs 0.35) — unseeded arms wander to the thresholds, the
exact failure mode the manifest already documents for `pass6_band_ab`
(`_gate_manifest.mjs:245`, seedFlaky, "a REAL band break fails both
tries"). `pass5`'s entry (`:244`) has no such flag, so one bad roll gated
red. **Fix (S)**: add `seedFlaky: true` + a mirroring note (consider
`pass4` too). No band re-centering.

---

## ENV-ONLY

### 16. `defcall_ui_smoke.mjs` — 1 FAILED → probable flake under load; selectors fully current — re-run

Every selector verified present and byte-identical `c6f6e93` → HEAD:
wizard ids, `data-gpsection="defense"`, the defense sub-tab list, the
whole Calls-tab surface (`#new-call-name`, chip vocab, `data-dcs-*`,
delete/purge wiring) — of the 324 lines D3/D8 changed in `gameplan.js`,
zero touch this markup; D9 changed engine internals only. The one live
bug at log time (the Run/Pass-tab ReferenceError, fixed 9 min after the
log by `753b45d`) is not on this smoke's path. Best fit for exactly 1/25:
a 450 ms fixed settle window losing a race on the overloaded box.
**Action**: clean re-run idle; if it reds again, make the probe print the
failed check names on its last line (the gate keeps only the tail).

### 17. `table_button_phone_smoke.mjs` — crash tail → probable locator timeout under load — re-run

All driven selectors exist unchanged since the 08-12 import;
`git diff c6f6e93..HEAD` on `recruiting.js`/`dashboard.js` is empty (M0's
mobile-overflow work was CSS-only). Several 30 s-default calls
(`scrollIntoViewIfNeeded`, the first post-worldgen click) can time out
under this run's documented load. Same family as the other crashes this
run. **Action**: re-run; if it recurs, capture stderr so the named
locator survives into the log.

### 18. `position_gallery.mjs` — exit 3221225786 → the run was ABORTED here (certain)

`0xC000013A` = Windows STATUS_CONTROL_C_EXIT (console Ctrl-C/close). The
log physically corroborates: `position_gallery` is the final line, and
the five manifest entries after it (`stadium_audio`, `action_animation`,
`rb_anatomy`, `watchphys`, `watch_live` — `_gate_manifest.mjs:299–303`)
never ran. Nothing in the probe can produce that code itself. **Action**:
none owed to this probe; the pre-deploy FULL re-run covers it AND the
five never-ran probes.

---

## CROSS-CUTTING GATE FINDINGS (surfaced by this triage)

1. **The gate's one-line tail hides the failing check** (`_gate.mjs:134`
   keeps only the last stdout line) — it misfiled tipdrill's "[3/78]"
   into STATUS and the manifest. Fix (M, one file): store the last
   FAIL-prefixed line (or all FAIL lines) as the tail.
2. **Several envKnown "(cloud)" notes are misdiagnoses**: nav_back,
   letter_logo, saved_team_library, instant_classic, calendar_display,
   dna_cards, new_world all fail deterministically EVERYWHERE for
   test-side reasons. Correct the notes as each fix lands, or the next
   local red gets waved off as cloud noise again.
3. **The 08-16 FULL run was genuinely distressed AND aborted**: two
   TIMEOUTs, five crash-tails, one Ctrl-C, five probes never ran. Its
   green results stand, but its reds needed exactly this triage — and the
   commit_rate "overload" story from 08-14 turned out to be a
   deterministic hang hiding inside that noise.

## SUGGESTED ORDER OF OPERATIONS (the owner's sitting)

1. **The product fix**: wire `#to-adjust-root` (item 1, S). Re-run
   `timeout_screen_smoke` to green.
2. **Data-only manifest batch** (S, one file, ~15 min):
   `dna_cards` → `kind:'node'` · `gaplist` + `pass5_band_ab` →
   `seedFlaky: true` · correct the stale notes (tipdrill, commit_rate,
   formation_playbook counts, the mislabeled "(cloud)" envKnowns).
3. **Small probe fixes** (S each): commit_rate `posReviewed` line ·
   formation_playbook bar `0.15`→`0.10` · new_world staff-step selectors ·
   nav_back `GROUP_OF`/tab assertion · tipdrill bar `0.5`→`0.4` or args
   `6`→`12` · (optional) size_fit floor or RNG pin.
4. **The M batch, as time allows**: the three retired-main-menu smoke
   rewrites + calendar_display's tree entry (items 7–10). These are the
   only reds that will STILL be red after steps 1–3; if the sitting runs
   short, they are also the safest to defer — they test real features
   through a dead door, not dead features.
5. **One clean FULL gate on an idle machine** — no other load. Expected:
   covfam, tipdrill, gaplist, pass5, size_fit, defcall_ui,
   table_button_phone, position_gallery green (or retried-green);
   the five never-ran probes finally on the record; anything still red
   after steps 1–4 is new information.
6. The night tier is already PAID on this tree (2026-08-17 entry) —
   re-run only if the tree moves before deploy.
