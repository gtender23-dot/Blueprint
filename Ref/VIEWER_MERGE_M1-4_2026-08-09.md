# Codex viewer milestones M1–M4 — reconciliation into the mainline (2026-08-09)

Codex built four "college presentation" milestones on a **stale viewer branch**
forked mid-Aug-8 (post the sprite lean/escape fixes, pre trait chips). The kits
shipped patches + finished files for 4 production files only; everything else
(engine, gameplan, saves) untouched by construction. This session merged the
whole line onto the Pass-6 mainline.

## What each milestone was

- **M1** — position anatomy: 5 builds (QB/runner/skill/power/line), modern
  helmets, open/reinforced masks, tapered torsos, glove/visor variation, new
  college-stripe football. Files: `sprite.js`, `style.css`.
- **M2** — "football contact presentation" (carrier/tackle/block readability)
  + the broadcast pass (field-first framing, crest score bug, camera/replay
  bugs, per-play instant replay). *No kit survived* — the M2 zip was only a
  stale preview build — but M2's content is embedded in the M3/M4 finished
  files, so nothing was lost.
- **M3** — procedural stadium audio (Web Audio, no samples): crowd bed,
  situational intensity, snap/contact/whistle cues, event reactions, replay
  cue suppression, Settings-sound-toggle respected. Files: `app.js`,
  `sound.js`.
- **M4** — action animation vocabulary: 7 catch families, 8 movement states,
  8 carrier finishes, 5 blocker-loss (shed) reactions, position-aware
  amplitude. Files: `app.js`, `style.css`.

## How it merged (per file)

- **sound.js** — our file was byte-identical to their fork base → their M3
  file adopted wholesale (superset; keeps the `cue` export).
- **sprite.js** — their M1 file already carried our Aug-8 bug-hunt fixes
  (#20 dead lean, #24 tag escaping) verbatim → adopted wholesale. Exports
  unchanged (`spriteMarkup, ballMarkup, spriteMotionTick, wspPlace`).
- **app.js** — the watch region (`renderLiveWatchOverlay` → EOF) is a
  contiguous tail block in both files. Merged = **our header** (keeps trait
  chips + all Pass 4.5–6 UI) + **their watch region** (replay system, camera
  bug, redesigned scoreboard, sprite palette, M3 audio wiring, M4 cue
  classification) + their `stadium*` import.
- **style.css** — their M4-final file adopted + our Pass-4.5 trait-chip block
  re-appended (the only post-fork CSS ours had that theirs lacked; our simple
  ball CSS was superseded by their new football).

Their probes installed: `tools/position_gallery.mjs`,
`tools/stadium_audio_probe.mjs`, `tools/action_animation_probe.mjs` (all take
PW_CHROMIUM, no dist arg — they bundle from `js/` directly).

## Verification (merged tree, all green 2026-08-09)

position_gallery (5 profiles, modern anatomy ×36, masks ×104) ·
stadium_audio (context running, ambience active, cues, mute law) ·
action_animation (35/35 states; 7/8/8/5 families distinct) ·
sprite_gallery (incl. computed-transform lean check) · watch_live ·
watchphys 7A · play_trace · playnow E2E · ui_playcall · coach_mode_halftime ·
midgame_save · st_ui · build + boot 0 pageerrors.

**Pre-existing, NOT merge regressions** (fail identically on the pre-merge
tree in this cloud env; both are wizard-flow smokes): `timeout_screen_smoke`
(2 chip-write checks; fails at an *earlier* step on the pre-Pass-6 pristine
tree — env-sensitive clicking) · `instant_classic_ui_smoke` (main-menu coach
card locator timeout). Recheck on a local run; neither involves the four
merged files' regions.

## Standing guidance

**Future viewer milestones must be built against the merged files shipped
today** — give Codex the current `js/ui/app.js`, `js/ui/sprite.js`,
`js/ui/sound.js`, `style.css` as the new base. The stale-branch fork is
retired; a kit cut against today's tree will apply cleanly.

---

# M5 + M6 (merged same day, later session)

- **M5 — reference-driven RB anatomy** (kit): patch applied CLEAN first try —
  the stale-branch retirement worked; our sprite.js was byte-identical to
  their M4 base. Files: sprite.js (RB alternate geometry + pose selection),
  style.css (.wsp-prototype-rb proportion block). `tools/rb_anatomy_probe.mjs`
  installed.
- **M6 — reference anatomy league-wide** (BUNDLE-ONLY, no kit — recovered from
  the "pages playable staging" build via bundle archaeology with _canon.mjs):
  the M5 reference body was promoted to ALL players. `spriteMarkup`: rb leg
  chains unconditional (class renamed `wsp-rb-leg-chain` →
  `wsp-reference-leg-chain`), reference two-joint arms on every side pose
  (sBlock/sCatch/sThrow/sTackle/sStiff/sIdle/sCarryArm), new front
  `referenceThrowPose`/`referenceTacklePose`, root gains
  `wsp-reference-athlete`. CSS: per-profile proportion retunes + new
  `--wsp-side-torso-x` / `--wsp-elbow-scale` vars + the `.wsp-vs .wsp-torso`
  side-torso rule. **app.js/sound.js had NO M6 changes** (all candidate diffs
  proved cosmetic under `_canon.readable()`; "stadiumCapacity" was a false
  alarm — it's our own world.js worldgen). Our extracted `spriteMarkup` is
  canonically IDENTICAL to the M6 bundle's; style.css equals the bundle's
  inlined CSS + our trait tail.
- `rb_anatomy_probe` updated for the M6 class rename (accepts both chains).

Verification (all green): rb_anatomy 5/5 (chains=100) · action_animation
35/35, 7/8/8/5 distinct · position_gallery · sprite_gallery (lean check) ·
watch_live · stadium_audio · playnow E2E · build + boot 0.

**Codex's next base = the files shipped after THIS session** (M6-complete
mainline). The M6 staging bundle is fully absorbed; nothing pending.
