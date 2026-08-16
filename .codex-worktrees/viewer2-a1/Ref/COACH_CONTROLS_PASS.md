# Coach Controls Pass — F1, F2, F3 (2026-08-06)

The three Part-2 proposals from `Ref/AUDIT_CONTROLS_GAPS.md`, built in one pass.
Shipping law held throughout: every default equals the pre-pass auto behavior exactly
(no cell / no checks / no live call = byte-identical game), old saves migrate by doing
nothing, and each feature carries probe coverage in the new
`tools/coach_controls_probe.mjs`.

## F1 — Defensive live calling (the biggest feel upgrade)

When your team is on **defense** in a watched game, the headset now stops the game on
the opponent's **key downs** (3rd/4th down, red zone, final two minutes) — whichever
offensive call mode is on. Every-snap defensive stops were deliberately rejected: they
double the pause cadence for little coaching value; key downs are where the pin/house
calls live.

The panel (`dc-panel` in `ui/app.js`) shows the **standing call** — what the sheet
would do — and lets you pin any of six dials for that snap only: front, aggression
stop, shell, style, edge, heat shape. Anything untouched rides the plan. "Ride the
plan" resumes with a `{_ride}` sentinel — it marks the snap answered without changing
anything (the bug class where riding re-asked the same snap forever is pinned in the
probe).

**The save law is inherited, not re-implemented:** the defcall pending lives on the
same `token.pending` under `state.pendingHalftime`, so `gamePauseIsLive()` already
gates every save path. `midgame_save_probe` passes unchanged. No fourth save path
exists.

Engine: `opts.askDefCall` in `simulateDrive` (mirrors `askCall`), `applyDefCall`
overlays the effective plan before `defPlanEff` is built, `resumeFromCall` generalized
to both kinds, `resumeFromPlayCall` accepts both. A play answered with a real call is
stamped `defCoachCall`. If a coach controls both sides (saved multiplayer), the
offensive ask keeps the headset.

## F2 — Check-with-me (calls keyed on their personnel)

New **Checks** sub-tab on the gameplan Defense card. Four personnel classes — Empty,
Spread (3+ WR sets), Heavy (2-back/multi-TE incl. Jumbo), Wildcat — each accepts the
same fields a situation cell holds: front pin, aggression, shell, style, edge, and a
box shift (±8 runCommit). When the offense breaks the huddle in a checked class, the
check overlays the standing call for that snap (`formationCheckClass` +
`applyDefCall` after the formation is known, mirrored onto every `*Eff` field). The
coach's live F1 call outranks any standing check.

The punish side was already modeled and is the reason over-checking costs: motion and
jet mechanics are exactly the real-football answer to a defense that declares off the
first look.

**AI symmetry:** every AI plan now carries the light table a real DC does — box −8 vs
Empty, box +8 vs Heavy, edge set vs Wildcat. Measured at scale (150 games/arm,
checks-on-everyone vs none, heavy-skewed formation mix): ypc vs checked classes
4.06 → 3.94, run share unchanged, points −0.9 (≈noise). Right-signed and mild.

## F3 — The opening script ("Openers")

Source #25 finally used. A new **Openers (Drives 1–2)** cell sits at the top of the
situations grid — offense only (the defense sub-tab hides for it). If the cell is
customized, it owns every ordinary snap of your first two drives of the game, then
hands off to the normal sheet. The emergency cells always win: goal line, backed up,
both clock situations, and the red zone pull the game off the script.

Engine: per-side drive counters live on the token (`token._dnums`, resume-safe; stale
tokens read 99 so the script can never mis-fire on an old save), and
`offSitWithOpeners` maps the resolved situation onto the `openers` key. AUTO cell =
the key never fires = today exactly. AI plans never carry the cell.

Probe: an "Always Run" script produced 69% run over drives 1–2 vs 46% after the
handoff, same game, same plan.

## Verification

`coach_controls_probe` (new, 9 checks) PASS · `midgame_save_probe` PASS (the save
law) · `save_safety_probe` · `save_migration_check` · `tendency_probe` ·
`situational_probe` · `playbook_build_probe` · `ui_playcall_smoke` (extended: rides
through defensive stops, dc-chips count as tiles) · `coach_mode_halftime_smoke` ·
`watch_live_probe` · build + boot 0 pageerrors · **stat_realism no regression**
(comp 57.8 / ypa 7.20 / sacks 2.08 / INT 1.72 / pts 26.9 — all deltas vs the playbook
pass within noise, same three pre-existing off-band flags).

## Deliberately not built (from the audit's "considered and NOT proposed")

Coverage call sheet (solved-dial risk — revisit only if F1 creates demand for named
families), custom formations (playbook backlog), editable vs-tilts (never — answer
key). Part 1's five sim-mechanic controls (onside, robber, match-vs-spot, chip,
checkdown) remain unpicked and pair naturally with F1's panel when built.
