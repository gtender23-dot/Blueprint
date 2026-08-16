# Pass 3 — Coverage Families · Plan of Record

**Status: SHIPPED 2026-08-08.** All four open decisions resolved by owner (each took
the recommended option: AI adoption now, gated A/B · headset = display chips only,
shell/style adjust clears the pin · Prevent bundles rush-3 · rotations bite on
single-high zone only).

Gates run at ship: build 11/11 · boot 0 pageerrors · **covfam_probe 17/17** (pin
100% on all four families · Prevent rushes 3 on 1890/1890 dropbacks, 0 blitzes ·
kill-switch byte-identical 3/3 seeds · all eight directional checks) ·
**rotation_probe 5/5** (sky/cloud/buzz directional, two-high inert, kill clean) ·
**covfam_band_ab** (AI A/B drift: pts 0.30, rush 1.92, pass 0.83, comp% 0.74 —
bands held) · defcall_probe 32/32 (extended: Victory call + kill-clock row) ·
defcall_ui_smoke incl. 4 new ingredient-row checks · defcall_headset_smoke ·
defcall_band_ab re-held (pts 0.37, rush 3.83, pass 9.04) · worldgen / recruiting /
progression / save_migration / scheme_role / tendency / front_variants /
coverage_monotonicity / press_jam / robber / zone_void / shell_identity /
motion_struct / sep gate ALL PASS · stat_realism N=500: pts 26.5, rush 144.4 (the
standing pre-existing drift), pass 246.7, comp 56.8, INT% 1.69 — same band state as
the pre-pass baseline (pts 27.4 / rush 146.6 / pass 252.9 / comp 57.3 / INT 1.59),
and the paired A/B above is the authoritative no-drift read.

⚠ Standing flag discovered at gate time: `leverage_probe` and `route_shape_probe`
are seed-flaky at their margins (no pinned PRNG; the pristine pre-Pass-3 tree fails
them intermittently too — sepgeo.js untouched by this pass). Worth pinning their
PRNG someday; not a Pass 3 regression.

Roadmap brief (roadmap.html): *Split-field Cover 6 (quarters/cloud by half) · Tampa 2
(Mike pole runner) · 2-Man · Sky/Cloud/Buzz run-support rotations · drop-8 / rush-3 ·
prevent. All become ingredients of named calls — not new dials.*

---

## What exists today (code-verified anchors)

The coverage the sim actually plays is derived per snap, then consumed in two layers:

```
defEff.covShell (single/two) + defEff.covStyle (man/zone)
  → coverageFamily(shell, style, sAwr)         (sim.js:247)
      single: man → Cover 1 · zone → Cover 3
      two:    man → Cover 2-Man · zone → sAwr≥55 ? Cover 4 : Cover 2
      "balanced" on either axis is a per-snap coin flip (55/45 shell, 50/50 style)
  → covFam feeds the NAME layer: concept vs tables (concepts.js vs{}), the QB's
      disguise/believedFam duel (DISGUISE_SHOW, sim.js:3705), kill-calls (shellSeen,
      3727), shot-call memory (covMem, 3741), zone landmarks (zoneLandmark, 801),
      post-play accounting (playResult.coverage, 4023 — fireZone/Cover 0 refits)
  → the MECHANICS layer reads the DIALS, not the family: covShellEff/covStyleEff
      drive assignCoverage press/zone typing (805), the shell separation adj (1788),
      PA shellBite (1128), the Fix-D robber (2047), deep two-high help (2064),
      isZoneHeavy (1632), scramble mults, motion mults
```

Facts that shape the pass:

1. **The call plumbing is done.** Pass 2's `applyDefCall` → `syncDefEff` →
   `pickDefCall` chain (sim.js:166–238) is field-sparse and idempotent; a new
   ingredient is one more optional key riding the same path. UI editors
   (`CALL_FIELDS`, gameplan.js:1852; `DEF_CALL_ROWS`, app.js:2557) are data-driven
   row tables.
2. **2-Man already exists as a family** ("Cover 2-Man" — shell two × style man) with
   vs-table columns, disguise entries and landmarks. What's missing is (a) calling it
   deterministically and (b) its trail-technique mechanics (hard underneath, soft to
   the scramble).
3. **Half the coverage assessment's fixes are natural hosts.** Fix D's robber
   (two-high #2-read) is the quarters half of Cover 6; the LB-Cover sort in
   assignCoverage (821) already ranks the pole-runner candidate for Tampa 2; the
   landmark/void system (Fix C) gives rotations something real to rotate.
4. **The defense's sitKey resolves from its own margin** (sim.js:3452;
   `four_min_lead` = defense up 11+ inside 5:00) — so an AI Prevent call needs zero
   new decision logic: it's a sheet weight on an existing row (Pass 6 owns real
   win-probability polish).
5. **Drop-8 has a sibling.** `spyQB` already pops a rusher out of `passRushers`
   (1310); rush-3 is the same manipulation with the popped bodies added to the
   coverage pool so `excess`/`helpBoost` (869) see them.

**Pre-existing latent bug found while scoping** (fix en route, Pass 2 precedent):
`assignCoverage` reads `_conceptCtx.shell` for Fix E's shell-wide press/off identity
(954) and the leverage help-rule (881), but `_conceptCtx` is only ever assigned
`{name, def, fam, edgePlay}` (3802) — **`shell` is never set, so Fix E never fires in
live play** and the leverage "help = two-high" contribution is dead. The
shell_identity_probe passes because its checks are mean-neutrality checks — true
whether the mechanism fires or not. Fix = stamp the resolved family's shell (and the
family itself) into `_conceptCtx`; re-run shell_identity_probe + leverage_probe +
stat_realism (band risk real but small — the probe measured the live conversion at
sub-noise when forced).

---

## The design

**One new optional ingredient set on a named call** (and nothing else — no standing
gameplan dial, no formChecks field, no weeklyPlan key):

```js
gp.defCalls["Tampa Mike"] = {
  front: "4-3", covShell: "two", covStyle: "zone",           // existing dials
  covFamily: "Tampa 2",   // NEW · null | "Cover 6" | "Tampa 2" | "Cover 2-Man" | "Prevent"
  rotation: null,          // NEW · null | "sky" | "cloud" | "buzz"  (single-high zone only)
  rush3: false             // NEW · true = rush 3 / drop 8
}
```

### 1. Family pin (the name layer)

`covFamily` set ⇒ `coverageFamily()` is bypassed: the family IS the call, and the
implied dials are forced for every shell/style-keyed mechanic so both layers agree
(Cover 6 / Tampa 2 / Prevent ⇒ shell "two" + style "zone"; Cover 2-Man ⇒ "two" +
"man"). New concepts.js vs columns for "Cover 6", "Tampa 2", "Prevent" (2-Man's
column exists): Cover 6 ≈ quarters vs the field, cloud vs the boundary (Flood/Smash
find the cloud flat, verts stress the quarters half less); Tampa 2 = the Cover 2
column with the seam/post edge removed (the pole) and the underneath middle sweetened
(vacated hook); Prevent = deep concepts hammered, everything short feasts.
DISGUISE_SHOW, shellSeen's two-high list, and zoneLandmark each gain the new names.

### 2. Family mechanics (the dial layer — each a gated perturbation, zero when absent)

- **Cover 6 (split-field).** The boundary receiver (WR1 side) is defended cloud:
  short −sep (hard corner in the flat), deep −sep (half over top). Field-side
  receivers are defended quarters: deep −sep, and the Fix-D robber arms on the
  quarters half without needing the #2-vertical trigger (the safety's whole job).
  The honest cost: field-side flat/out-breakers +sep (nobody buzzes that flat).
- **Tampa 2 (Mike pole runner).** Base Cover 2 plus: the best LB-Cover body runs the
  pole — deep-middle targets (deep balls whose landmark is the safeties' seam) get
  −sep scaled by his SPD/AWR (a slow Mike leaves the classic Tampa hole open). Cost:
  the hook/curl he vacated — medium middle +sep. Run side untouched (honest scope:
  the Mike bailing is a pass-snap event here).
- **2-Man (trail).** Deterministic Cover 2-Man plus trail technique: short/medium
  −sep (hard underneath leverage, halves over top), and the price real 2-Man pays —
  backs to the QB: scramble escape mult up beyond man's existing 1.1, and completed
  balls get a YAC bump (trailers tackle late).
- **Prevent.** Implies rush3 (below) + the umbrella: deep −sep hard, vdeep explosive
  capped, short/medium +sep (the underneath is conceded by design). Clock is the
  offense's payment: completions stay inbounds-biased (existing YAC/pursuit math
  already handles the tackle-in-front shape via deep pursuit bodies).
- **Sky / Cloud / Buzz.** Only bites when the resolved family is single-high zone
  (Cover 3 / C3 Fire Zone); ignored otherwise. Sky = safety force: run_outside
  defense bonus, strong-flat −sep, post window +tiny (he's down). Cloud = corner
  force: screens/flats killed (screen sniff +, bubble/flat −sep), boundary deep
  third +tiny. Buzz = safety to the hook: medium in-breakers −sep, PA bite −
  (his eyes are inside), deep post +tiny. All three are small, directional,
  probe-provable.
- **rush3 / drop-8.** In resolvePassPlay: the blitz roll is skipped, `passRushers`
  is cut to the best 3 (dropped linemen join the coverage pool → `excess`/
  `helpBoost` and the checkdown/void math see 8 in coverage). Pressure falls out
  naturally through resolvePassRush with 3 rushers — no new sack math.

### 3. Live calling & UI

- Calls editor (defSubTab "Calls"): three new `CALL_FIELDS` rows — Coverage
  (family), Rotation, Rush (rush-3 toggle) — same chip/editor pattern, sparse.
- F1 headset: the CALL row already loads the package; the loaded call's
  family/rotation/rush render as **display chips on the row** — no standalone
  dial rows for them (ingredients of calls, not new dials). The nine dial rows
  below still adjust on top; adjusting shell/style clears a pinned family
  (you overrode the call).
- The sheet grid, cap 12, ANY fallback, kill-switch UI: unchanged.

### 4. AI coordinators (Open #1)

`buildAISignatureCalls` (ai.js:253) gains family flavor by roster strength: a
zone-lean DC's coverage call upgrades to Cover 6 (safeties strong) or Tampa 2
(a rangy LB-Cover on the roster); a man-lean DC's Lockdown call may become 2-Man
(corners strong AND safeties adequate). Every AI defense gets a "Victory" Prevent
call weighted onto the `four_min_lead` row (defense up 11+ late — the sitKey
already resolves from the defense's margin). Band rule: gated stat_realism A/B
(`__noCovFamilies` off/on) before ship, defcall_band_ab precedent.

---

## Guardrails

- **Kill-switch:** `__noCovFamilies` — families/rotations/rush3 ignored everywhere
  (calls fall back to their plain dials), byte-identical Pass-2 behavior. AI stops
  authoring them under the switch too.
- **Old-save law:** absent keys ⇒ nothing changes; no retro-fill. Calls authored
  before Pass 3 have no `covFamily` and play exactly as shipped.
- **No new mechanisms where a dial exists.** Every family effect routes through
  the existing separation/robber/landmark/rush plumbing — selection and small
  perturbations, not new math.
- **Band watch:** comp% 57.3 / INT% 1.58 / pass 249.4 / rush 145.2 / pts 26.7
  (2026-08-08 baseline). Prevent/drop-8 are situational so aggregate drift should
  be sub-noise until AI adoption — the A/B decides.
- **Probes decide truth.** New: `covfam_probe` (family pin + per-family separation
  signature on forced diets), `tampa2_probe` (pole runner denies the seam, scales
  with Mike speed, vacates the hook), `cover6_probe` (split-field asymmetry),
  `rotation_probe` (sky/cloud/buzz directional effects), `rush3_probe` (3-man rush:
  sack/pressure down, 8 in coverage, checkdowns live), `prevent_probe` (deep
  denied, underneath conceded, explosives capped). Extended: defcall_probe (new
  ingredients ride pickDefCall), shell_identity_probe (now proves the live
  conversion actually fires), ui smokes.

## Build sequence (each step gated: build · _boot_check · probes vs baseline)

1. **`_conceptCtx.shell`/`fam` stamp + Fix-E live fix** (self-contained;
   shell_identity_probe sharpened to catch the dead path; stat_realism re-veto).
2. **Payload plumbing**: covFamily/rotation/rush3 through applyDefCall / syncDefEff
   / pickDefCall + family pin at the coverageFamily site, implied dials forced;
   `covfam_probe` (pin works, `__noCovFamilies` = byte-identical).
3. **rush3 / Prevent mechanics** + `rush3_probe` / `prevent_probe`.
4. **Cover 6 + Tampa 2 + 2-Man mechanics** + their probes; concepts.js vs columns;
   DISGUISE_SHOW/shellSeen/zoneLandmark names.
5. **Sky/Cloud/Buzz** + `rotation_probe`.
6. **UI**: CALL_FIELDS rows + F1 display chips + defcall_ui_smoke /
   defcall_headset_smoke extensions.
7. **AI signature families + Victory call** + gated stat_realism A/B.
8. Full gate suite + roadmap.html chip flip (Pass 3 → ✓, Pass 4 → ▶ NEXT).

---

## Open decisions (proposed, Pass-2 style — recommendation first)

1. **AI adoption now vs Pass 6.** Proposed: yes now — signature-call flavor +
   the Victory/Prevent sheet row (zero new decision logic, band-gated). Alternative:
   player-only until Pass 6's decision brain (Pass 1 fronts precedent).
2. **Live headset exposure.** Proposed: family/rotation/rush appear as display
   chips on the loaded CALL row only; adjusting shell/style clears the pin.
   Alternative: full standalone F1 rows for them (more control, but they'd be
   de-facto new dials).
3. **Prevent bundling.** Proposed: Prevent implies rush-3 + umbrella as ONE
   ingredient. Alternative: keep them orthogonal and let coaches combine by hand.
4. **Rotation reach.** Proposed: Sky/Cloud/Buzz only bite on single-high zone
   (real football; ignored elsewhere). Alternative: let them apply loosely to any
   zone call.
