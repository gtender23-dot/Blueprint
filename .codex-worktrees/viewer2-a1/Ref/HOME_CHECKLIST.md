# HOME_CHECKLIST.md — the at-the-PC list (Aug 10, 2026)

## 1. The local gate (one command, ~60–90 min)
    node tools/_gate.mjs full --local
Covers everything the cloud container can't judge:
- rotation_probe (envKnown: WR1 short share — gates locally, informational in cloud)
- size_fit_probe (envKnown: light-OLB tail)
- h2_shadow_probe, recruit_calendar_probe (localOnly giants)
- tree_advantage_probe — run as `node tools/tree_advantage_probe.mjs 800`
  for the tight-CI version before any deploy.
  **UPDATE 2026-08-11: no longer a local-only item.** Ran the tight-CI N=800
  in the cloud container in ~10 min, ALL GREEN 11/11 — E3 protégé 54.5% /
  +2.06 pts (se 0.57), E4 −0.78 pts vs tolerance ±2.33 (THE LAW holds),
  E5 +3.20 pts (se 0.76). All three land on their calibrated values. The
  `localOnly` flag is lifted in `_gate_manifest.mjs`, so the registered
  N=400 config (~5 min) now runs inside every `full` sweep rather than
  being skipped in the cloud and owed. Note the E5 power floor: it gates on
  mean > 2·se and reds spuriously below ~N=300, so a small-N smoke red is
  not a regression.

## 2. The cloud slow queue (can also be chunked in future phone sessions)
~46 heavy statistical probes deferred at phone-safe caps — every one that
got cut off was showing PASS mid-run. Named so far: mug, amoeba, creeper,
zone_void, motion_struct, shell_identity, choice_route, gadget,
scramble_style, time_to_throw, qb_mobility, qb_power_rush, covfam (full
N=120), + the remaining band A/Bs. All in /tmp batch files idiom —
regenerate via the gate manifest if the container reset.

**UPDATE 2026-08-11 — the named list is RETIRED, all 13 run to completion
in the cloud container at their registered caps, zero real reds:**
covfam N=120 (17/0) · mug (8/0) · amoeba (7/0) · creeper · motion_struct ·
shell_identity · choice_route · scramble_style · time_to_throw ·
qb_mobility · qb_power_rush — all OK. Two non-reds, both predicted by
their own registry flags: `zone_void` came back ENV (its `envKnown` cloud
failure — this one still gates on a real machine, so it is the ONLY
member of this batch worth re-running locally), and `gadget` went
FLAKY→pass on the automatic retry exactly as its `seedFlaky` flag says.
The three regression band A/Bs also ran green: pass4 BANDS HELD, pass5
and pass6 both AMPLIFIED INSIDE 2× ENVELOPE.

Container notes for the next phone session: batches survive as
`setsid nohup node tools/_gate.mjs --no-build --only <names> > /tmp/x.txt`,
but a long batch can still get reaped before it writes its summary —
the per-probe lines are already on disk, so re-run only the stragglers
rather than the whole batch. `node_modules/@esbuild/linux-x64/bin/esbuild`
loses its exec bit through a zip round-trip (chmod +x before build.mjs),
and `_boot_check.mjs` needs `PW_CHROMIUM=/opt/pw-browsers/chromium-1194/
chrome-linux/chrome` when invoked outside the gate runner.

## 3. NEW PASS — the coach brain (roster-conditioned playbooks)
Ratified direction from the Aug 10 audit:
- Build coach_brain_probe.mjs: authored-coverage per formation, sheet
  legality (book-respecting), distinctness across team identities, in-game
  selection bend (the __noAIFormSheets A/B), per-formation sufficiency table.
- OWNER RULING NEEDED: Single Back has no AI_SHEET_TILT entry (the one
  formation with no authored identity) — intentional balance or a hole?
- THE UPGRADE: roster-condition the formation sheets — feature Four Verts
  only if the QB can throw it; damp what the roster can't execute. Touches
  ai.js → full house loop incl. stat_realism + style_balance_harness.

## 4. UI overhaul kickoff
Ref/UI_OVERHAUL_PLAN.md — Phase 0 needs two owner rulings (the framework
fork §2, art direction from 3 HTML mocks) before any code moves.
The viewer gadget-drawing audit (why gadgets "looked off" — engine proven
clean, 120/120 signatures) is Phase 0 work.

## 5. Standing green (no action, for the record)
- Play-call fidelity: THE CALL IS THE PLAY enforced — 1,156 snaps, 0 misses,
  QB-audibles-out-of-coach-calls bug killed, probe registered core.
- 11 core campaign probes + fidelity green; deadcode audit spotless;
  save-export ceiling recalibrated (44 MB); dead-surface gate live.
