# Playbook Content Pass (F4) — 2026-08-06

The owner picked F4 ("deeper playbooks") off the controls audit, scoped in-session to:
promote the three orphaned concepts, add new pass concepts that express mechanics the sim
already models, add a Jumbo/goal-line formation, and make the call sheet legible. Rule
honored throughout: **see what's already there first** — every new play expresses an
existing engine mechanic; no new physics were invented.

## Discovery: the PLAYBOOK_SPEC build queue was already shipped

The 9-item queue in `Ref/PLAYBOOK_SPEC.md` (§Code action items) was executed in the
Jul 2026 build — `tools/playbook_build_probe.mjs` passes 5/5 against current source.
Two leftovers found and fixed here:

- **Bubble Screen Cover-2 tilt** was `-0.02`; the spec decision was **`-0.06`**
  (the hard flat corner is the universal bubble-killer). Fixed in `concepts.js`.
- **Live crash (Dime + chalk viewer):** `watchphys.js`'s shell-disguise block indexed
  the 2-entry `SHELL1/SHELL2` tables once per safety — the Dime front has **3**
  safeties, so `buildPlayScript` threw on any Dime play with a coverage stamped.
  Fixed: only the two deep safeties shift (`safeties.slice(0, 2)`).

## New concept tags — the sim now reads the play's design

Three optional fields on a `PASS_CONCEPTS` entry, wired in `sim.js` (`shapeFor` /
`schemeFor`); absent tags = behavior-identical baseline, so all 16 existing concepts
are untouched:

- **`routes: ["sharp","speed",...]`** — per-receiver route-shape override. Until now
  the shape came from receiver index parity; a concept had no say over its own routes.
- **`dbl: true`** — the called double move. The featured receiver (TEC ≥ 70) runs it
  at 55% instead of the baseline 5% lottery (TEC ≥ 84, medium only).
- **`breaks: "in" | "out"`** — wakes the dormant leverage system (`attack` was
  hardcoded 0 in live play since coverage Fix A). attack = breaks × leverage: in-cuts
  feast on an outside-leverage funnel and die into an inside-leverage wall. Man duels
  only; the sign flips with help, so the aggregate stays near neutral.

And one on `RUN_CONCEPTS`: **`qbCarry: true`** — forces the QB as carrier through the
normal run resolution (pulls included), unlike `qbSneak`'s push-pile special case.

## Five new callable plays

| Play | Group | Identity | Mechanic it expresses |
|---|---|---|---|
| **Spot** | quick game | snag triangle (corner/pivot/flat), zone-beater | `routes` tag; `pivot` shape's first home |
| **Sail** | dropback | 3-level boundary flood, C3-beater, no motion | `breaks:"out"` |
| **Levels** | dropback | two in-cuts high-lowing one defender, man/C2 | `breaks:"in"` + all-sharp `routes` |
| **Sluggo Seam** | shot plays | slant-and-go + seam + out-and-up | `dbl:true` — first called double move |
| **QB Power** | inside run | pulling guard, QB follows, extra hat | `qbCarry` + `pulls` together |

Sail/Levels/Spot had viewer art in `CONCEPT_ROUTES` since before the concept existed
("harmless if unused"); Sluggo Seam gives `sluggo` and `outandup` shapes their first
concept. All five: vs-rows/vsBox, exec weights, `FORMATION_PLAYBOOK` eligibility
(minWR-respecting), `CONCEPT_ROUTE_ART` call-sheet tiles, `CONCEPT_COACH` notes, and
`aiConceptWeights` bucket entries (QB Power keys on QB-Dual/QB-Scrambler archetypes).
`RUN_SCHEMES` gained QB Power (pull:lead) and a proper QB Sneak entry (was falling to
the generic lane).

## Jumbo — the eleventh formation

13 personnel: 3 TE (Y/U inline, W wing), FB + HB, no WR. The best short-yardage and
goal-line set on the sheet and a liability chasing points: SY 1.20 / red zone 1.14 /
third-long 0.72 / standard 0.97; feasts on sub packages (Nickel 1.13, Dime 1.18), gets
stonewalled by run walls (46/Bear 0.84, 5-2 0.82). 15-play run-heavy sheet including
QB Power; PA-heavy (0.40), near-zero motion/RPO. AI run-heavy templates carry it
10–12%. All 39 formation touchpoints from the integration audit were walked, including
the PA/MOTION rate tables that exist twice (sim.js + gameplan.js identity card) and the
depth-chart FADE/FB forms lists.

**Old-save safety:** coordinators generated before Jumbo have no `schemeIQ["Jumbo"]`.
`growStaffSchemeIQ` now backfills missing keys at the neutral 48 the rest of the code
assumes, then grows them with usage — no SAVE_VERSION bump, no migration.

## Call-sheet legibility ("benched" is now a visible install cut)

- Gameplan playbook header explains the two benchings in house voice: weight 0 is a
  cut (not a low number), and dropping every formation that carries a play cuts it too.
- A play none of your carried formations run now wears an **"off the sheet"** chip on
  its slider row.
- The live call sheet no longer silently filters: an **OFF THE SHEET** strip under each
  category shows the cut plays grayed out with the reason — "benched in your gameplan",
  "Jumbo doesn't carry it", "needs 3 receivers — this package has 2".
- The calling-a-game manual chapter states the zero-is-a-cut rule (within the 900-word
  probe ceiling).

## Verification

build ✓ (esbuild 0.28.1, dist + zip, SW stamp) · boot 0 pageerrors ✓ ·
playbook_build_probe 5/5 ✓ · auto_formation ✓ · fb_slot ✓ · tendency ✓ ·
watchphys RUNG 7A ✓ · emergency_qb ✓ · worldgen ✓ · save_migration ✓ ·
ui_playcall RUNG 6 ✓ · coach_mode_halftime ✓ · manual M3 ✓ ·
**stat_realism: no regression** — baseline vs modified on the same 1200-game sample:
comp% 57.7→57.9, ypa 7.23→7.24, sacks 2.13→2.09, INT% 1.65→1.72, points 27.0→26.9;
the three off-band flags (rush yds, comp%, INT%) are identical pre-existing ones.
yac_split holds the recorded stopping point (YAC/rec ≈ 4.4, air-share gap unchanged).
Jumbo smoke: 615 plays across 6 games, 0 viewer errors, run-heavy mix as designed.

### Known flaky / pre-existing failures (not from this pass)

- `leverage_probe` and `route_shape_probe` **flake on pristine source** (unseeded
  sampling near thresholds; verified 3× on an untouched copy). Worth seeding someday.
- `manual_render_probe` M5 expects ≥ 20 chapters; the manual has 17. Pre-existing.
- `tools/_buyin_era/playcall_probe.mjs` has a broken relative import from its
  `_buyin_era` move (`../js` resolves to `tools/js`). Pre-existing; ui_playcall_smoke
  covers the surface.

## Left on the table (deliberate, from the unsurfaced-content audit)

- **`optionOverride` is a generic gadget hook** — a Reverse/End-Around is ~20 lines
  mirroring `resolveJetSweep`, with `_seenJets` memory as the natural payoff.
- **"Pro Set" is a complete orphaned 11-man layout** behind a `FORMATION_ALIAS` —
  the cheapest possible twelfth formation.
- Per-concept protection (`prot: "maxProtect"`), the `vdeep` depth band, a fourth
  screen kind, and the half-wired FADE mesh position are all documented in the audit
  report (project memory) for future passes.
