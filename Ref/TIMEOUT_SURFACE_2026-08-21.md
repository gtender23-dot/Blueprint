# The live timeout surface — three defects under one 08-17 fix
**2026-08-21 · owner session · all three fixed, pinned by `timeout_screen_smoke` (now core)**

The coach reported: *"I still am not even seeing the timeout [adjustments] screen."*
He was right, and the reason was not the one the 08-17 triage had already fixed.

---

## What 08-17 fixed, and why it wasn't enough

FULLGATE_TRIAGE item 1 found that `#to-adjust-root` rendered but nothing wired
its chips, and wired `wireDefaultsListeners` onto it. That was real. But it left
three separate defects standing, each of which independently made the screen
look broken.

---

## A — the chip had no door on the live screen  *(owner ask)*

`[data-cs-timeout]` existed on exactly two surfaces: the offensive call sheet
(and only inside `formStrip`, so a book with no looks had none at all) and the
defensive headset. Once the play was sent there was no way to reach a timeout —
the coach sat and watched the clock run.

**Fix.** The same chip now renders in the **live watch bar** for the whole call
stage (`renderLiveWatchOverlay`, next to Skip). It carries the same
`data-cs-timeout` hook and reads the same `state.ui.callTimeout`, so the bar
button and the sheet chip are one control shown twice and cannot disagree. It
shows timeouts remaining, greys out at zero, and lights amber when armed.

**When it fires:** at the whistle of the snap it is armed for. That is what the
engine already does with the flag — `_toFlagSide` is captured at the top of the
snap and spent in the clock-runoff block *after* the play
(`sim.js`, `C.TIMEOUT_RUNOFF_SAVED`). Note the honest limit: a snap that has
already been simulated cannot have a timeout applied to it retroactively, so
arming mid-board attaches to the **next** snap, automatically, with nothing else
for the coach to remember.

---

## B — the adjustments screen was gated on a flag the live path never sets

```js
// before
if (!state.ui.showCallSheet || !state.ui.callTimeout || !state.ui.timeoutAdjust) return "";
```

`state.ui.showCallSheet` is written in exactly one place (`state.js`), and the
dominant live path does **not** write it — `state.js:613` sets
`state.ui.liveWatch = { stage: "call", boardDone: false }` instead. So on a live
coached game the chip armed, the flag rode the call, and the adjustments overlay
**never rendered**.

It appeared only when an earlier non-live stop had left `showCallSheet` true and
nothing had reset it — which is exactly why it read as intermittent rather than
broken, and why it survived a fix pass.

```js
// after
const _onCallSurface = state.ui.showCallSheet || state.ui.liveWatch?.stage === "call";
if (!_onCallSurface || !state.ui.callTimeout || !state.ui.timeoutAdjust) return "";
```

---

## C — "Rest of Game" wrote next week's plan, not this game's

The worst of the three, because it was silent in both directions.

`wireDefaultsListeners`'s `writeDial` always routed through
`setPlanFields(getPlayerSchool(), patch)` — the **school's season plan**. But
three screens render from a **game-local** plan:

| root | renders from | wrote to (before) |
|---|---|---|
| kickoff modal (`#kickoff-adjust`) | `state._pregamePlan` | school.gameplan |
| halftime (`#halftime-screen`) | `token.homeGP` / `token.awayGP` | school.gameplan |
| timeout overlay (`#to-adjust-root`) | `token.homeGP` / `token.awayGP` | school.gameplan |

Proved live: clicking Hurry gave `school "Hurry" / token "Chew" / sameObject: false`.

Three consequences, all invisible:
1. the chip never lit — the render re-read the game-local copy, unchanged;
2. the change never reached the game in progress;
3. it **persisted into next week's plan** without the coach ever asking.

**Fix.** `wireDefaultsListeners(gp, { root, inPlace: true })` writes the object
the screen actually renders from. `undefined` deletes, matching `setPlanFields`
(the old detached fallback was a bare `Object.assign`, which would have stored
the undefined). Passed at all three roots; the kickoff one is conditional on
`state._pregamePlan` actually being in play.

---

## Tempo is the offense's

`PLAN_FIELD_SIDE.baseTempo` moved `"team"` → `"off"` (owner call: *"tempo
shouldn't be a defensive option, it's totally up to the offense"*).

- Save-compatible: old saves keep the value in the overlay and still compile
  correctly — compile layers overlay → book → defbook, and an absent book field
  does not mask the overlay's. The first new write moves it home.
- An offensive playbook now **carries its own tempo**, which is what a
  "hurry-up spread" book ought to mean.
- Pins updated in `plan_side_probe` (`baseTempo` moved into the offense census).

Owner note on defaults, recorded for the situational layer: *"it's a coach's
choice — most teams play normal tempo all game until the last 2 min of a half."*

**Explicitly rejected:** filtering the timeout adjustments by side. The screen
shows both sides of the ball, deliberately.

---

## Probe work

`timeout_screen_smoke` promoted **full → core**, `envKnown` dropped (it walks and
passes cleanly in the cloud sandbox), and extended to pin A and B as well as C.

Its tempo check was itself broken: it hard-coded "Hurry" and asserted a
false→true transition, so it failed outright on any walk whose plan already ran
Hurry — roughly two runs in three here. That is an unseeded probe bug, not a
product one, and it cost a real debugging cycle before I spotted it. It now
flips to whichever chip is currently **off** and asserts both that the new one
lights and the old one goes dark.

### Still open
`watch_live_probe` failed once in four runs on this branch
("scheme-specific blocker execution observed live") and passed three for three
on unmodified source, then three for three on the change once re-run — an
unseeded live-observation check, not a regression. Worth a seeding pass with the
rest of the noisy set (`blitz_reality`, `run_scheme`, `robber`, `gadget`,
`covsack`, `qb_live`), using `tipdrill_probe` as the in-repo template.

## Verification run
`timeout_screen_smoke` ×5 green · `plan_side_probe` · `plan_cohesion_probe` (97) ·
`playbook_root_probe` (47) · `book_update_probe` (47) · `defbook_probe` (76) ·
`playbook_shape_probe` (28) · `integration_creator_probe` (19) ·
`live_book_call_probe` (14) · `stage4_probe` (17) · `season_persist_probe` (15) ·
`card_lint_probe` (36) · `defcard_fidelity_probe` (56) · `timecontrol_probe` ·
`kneel_timeout_probe` · `coach_mode_halftime_smoke` · `coach_controls_probe` ·
`midgame_save_probe` · `save_migration_check` · `situational_probe` ·
`tendency_probe` · `phone_dial_guard_smoke` · `dead_surface_probe` — all green.
