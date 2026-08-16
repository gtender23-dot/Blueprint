# Codex viewer merge — college-presentation M7–M17 (2026-08-09)

## Shape of the drop

Unlike the M1–6 era (stale branch, bundle archaeology), this chain was CLEAN:
Codex cut m7 directly against the shipped mainline `0f9a46a0ad` (exactly our
tree at the M6 merge) and each kit is INCREMENTAL on the previous milestone
build: m7 `7502649d56` → m8 `79cc53cceb` → m9 `66ecb3fb9d` → m10 `1f415adb9d`
→ m11 `c4b56a478a` → m12 `39bba9582e` → m13 `313310461c` → m14 `59468641df`
→ m15 `7746b7aae8` → m16 `bf2a96ca7e` → m17 `a7acfdfd9d`. Every kit ships a
git patch + complete finished copies + its own probes. The handoff rule from
the M1–6 report (next milestones must be cut against current mainline) was
honored — keep requiring it.

## What the milestones are

M7 uniform identity (numeric jerseys, stripes, forearms, equipment variety) ·
M8 position-authentic pre-snap stances + snap release · M9 contact sequencing
(strike/drive/re-fit line play, tackle-arrival window) · M10 presentation CSS
pass · M11 pocket presentation · M12 route/coverage phase cues · M13 QB
mechanics · M14 tackle setup · M15 special-teams mechanics (kick phases,
holder, returner, coverage lanes) · M16 field-state integrity (possession
direction, end zones fixed, kickoff roles/colors, scorebug possession) · M17
defensive alignment realism (position-aware pre-snap depths, watchphys.js).

Files touched across the chain: `js/ui/app.js`, `js/ui/sprite.js`,
`js/ui/watchphys.js`, `style.css`. **Engine untouched** (each kit's notes
assert it; patches confirm) → no stat A/B needed, per the viewer precedent.

## How it merged (post-Pass-7 tree)

Codex's base predates Pass 7, but Pass 7's only overlap is app.js in a
DIFFERENT region (player card / statBits, not the watch viewer). All 11
patches applied clean in order with `git apply` — zero conflicts. Verified:

- `watchphys.js`, `sprite.js`, `style.css` — byte-identical to Codex finals.
- `app.js` — identical to the m16 final EXCEPT exactly Pass 7's two blocks
  (snaps stat line + morale chip), confirmed by diff.
- Class-scan (the standing lesson): our built bundle vs `Blueprint-M17-
  playable.html` — 0 classes present in theirs and missing in ours; ours has
  19 extra (Pass 7 UI). Nothing unshipped is hiding in their staging build.

Merged build: `0d7a4975bd` (boot check 0 pageerrors).

## Probes installed (kits ship their own; latest version of each name taken)

Galleries (pw-noarg, build their own bundle from js/): uniform_identity ·
presnap_stance · contact_authenticity · scheme_block_gallery ·
pocket_protection · route_coverage · qb_mechanics · tackle_setup ·
st_mechanics (**RENAMED — Codex shipped it as `special_teams_probe.mjs`,
which would have CLOBBERED the engine's ST stats probe of the same name;
watch for name collisions in future kits**) · kickoff_orientation ·
defensive_alignment. Live E2E (take the built html arg, drive a real PLAY
NOW game): pocket_live · route_live · qb_live · tackle_live ·
special_teams_live · field_state_live. Also updated: sprite_gallery (m7,
Windows/esbuild path fixes) and watch_live_probe (m14 — NOW TAKES the built
html as argv, it used to be no-arg).

All registered in tools/_gate_manifest.mjs (full tier). The *_live probes are
timing-flaky in the slow cloud container (they need the right play mix inside
their watch window) — marked seedFlaky; route_live needed retries here and
then passed 12/12.

## Gate results

4 established viewer probes green (position_gallery / stadium_audio /
action_animation / rb_anatomy) · all 11 galleries green · all 6 live probes
green (route_live on retry) · gate run green: build + boot + watchphys_probe
(RUNG 7A) + st_ui / ui_playcall / playnow smokes + build_stamp. Engine suite
not re-run (engine byte-untouched by the chain).
