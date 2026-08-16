# UI_OVERHAUL_PLAN.md — Commercial-Grade UI (drafted Aug 10, 2026, mobile session)

> **STATUS UPDATE — 2026-08-13 (verified against code):** The Broadcast Package was
> not just ratified, it was **BUILT**. `style.css` carries the ratified tokens
> (`--bg-page #0A1626`, `--bg-card #13253C`, `--gold #F5B942`, the `Archivo` display
> font, `--bc-gold`, ~41 broadcast-token references) and `app.js` has the scorebug /
> broadcast chrome. The theme ships. What may remain is **per-view signature polish**
> (the "angled lower-third tab on every card header" and clipped-corner ribbon applied
> uniformly across all ~20 views) — a QA/consistency sweep, not the overhaul itself.
> The original ratification note below is kept for the record.

Status: ART DIRECTION RATIFIED (Aug 10) — **A: BROADCAST PACKAGE**, chosen
from three live mocks ("#1 by far. Love it"). Editorial and Modern-App
rejected; dark-terminal rejected earlier by name. Direction seed tokens:
deep-navy field #0E1B2C / panel #13253C, broadcast gold #F5B942, crimson tab
#B33A3A, ink #EAF0F7 / muted #8FA6C2; display type Archivo (wide/black,
uppercase) + tabular numerals; signature elements: the clipped-corner
scorebug ribbon (record chip), angled lower-third tabs on every card header,
gold gate/accent bars. Every Phase 1 token derives from the A mock
(blueprint-ui-mocks.html, kept as the reference artifact).
Framework fork: Option A (vanilla, systematized) stands as the working
ruling unless the owner overrules at the PC — Phase 0 has no remaining
blockers.
Standing context: engine untouched throughout; UI work rides the same house
loop (probe → stat_realism no-touch → build → boot → per-screen smokes).

---

## §1 Where we are

- ~20 views in `js/ui/views/`, vanilla template-string rendering, full
  `rerender()` model, data-attribute listeners, one `style.css`, esbuild →
  single ~3 MB index.html on GitHub Pages. Phone-first.
- 51 playwright smokes + frame_budget probe + screenshot idioms
  (_sprite_shot/_depth_shot) already exist — the QA substrate for a visual
  overhaul is half-built.
- Known UI debts: app.js monolith (~2.8k lines), density/consistency drift
  across views, the gadget plays "looking off" in the viewer (engine proven
  clean by play_fidelity_probe — the issue is drawing-side), no design
  tokens, no motion system.

## §2 THE FORK — owner ruling required

**Option A — Vanilla, systematized (recommended).** Keep template-string
rendering as the substrate; do a true design-system overhaul on top: tokens,
a component kit, view contracts, split app.js, targeted section rerenders
where full rerender janks. Zero framework risk, all 51 smokes stay valid,
every pass is exact-string-editable, and nothing about "commercial grade"
(art direction, density, motion, ergonomics) actually requires a framework.

**Option B — Preact + signals.** Real component model, partial updates for
free, ~11 KB runtime, esbuild-native, static-deploy fine. Cost: every view
rewritten, listener model replaced wholesale, smokes need selector triage,
months of churn before it looks different. Right call only if we want
app-like interactivity (drag depth charts, live-updating watch overlays)
beyond what targeted rerenders give.

**Option C — Svelte/Solid.** Fastest runtime, but adds a compiler beyond
esbuild and fights the exact-string-edit workflow. Not recommended for this
codebase's build style.

Recommendation: **A**, with B held as a per-screen escape hatch (a single
view can adopt Preact later without converting the world if one screen truly
needs it).

## §3 The phases (each = passes with the full house loop)

**Phase 0 — Foundation & direction (1 session)**
- UI inventory: every view, every component-shaped repetition, screenshot
  baseline of all 20 screens via the playwright screenshot idiom.
- Frame-budget baseline per screen (probe exists).
- Viewer gadget-drawing audit (the "gadgets look off" lead): CONCEPT_ROUTES /
  RUN_ALIAS coverage vs the 8 gadgets — likely missing/aliased art.
- ART DIRECTION: I produce 3 candidate directions as real HTML mock screens
  (same dashboard, three skins) for an owner ruling. Broadcast-package /
  clean-editorial / dark-terminal are the starting candidates.
- OWNER RULINGS: the §2 fork; the art direction; density philosophy
  (information-dense sheets vs. progressive disclosure).

**Phase 1 — The design system (1–2 sessions)**
- `js/ui/tokens.css`: color (semantic, color-blind-safe for grades/stars),
  type scale, spacing grid, radius, elevation, motion durations/easings.
- `js/ui/kit.js`: the component kit — buttons, cards, tables (sortable,
  sticky-header, virtualized for 300-school lists), tabs, modals, toasts,
  chips (star/grade/badge), stat rows, progress bars, empty states.
- style.css rebuilt on tokens; old class names aliased during migration.
- Gate: kit render smoke + screenshot visual-regression probe (pixel-diff
  against approved baselines — new tool, _screens_probe.mjs).

**Phase 2 — Screen recomposition, priority order (1 screen ≈ 1 pass)**
1. Game Day / watch + headset call sheet (the product's face; includes the
   gadget drawing fixes)
2. Dashboard
3. Recruiting (hardest tables)
4. Gameplan (densest controls)
5. Roster / Depth Chart
6. Coach Office / Tree / Ceremony
7. Standings / Stats / History / Awards
8. Main menu, new-game flow, onboarding
Each screen: recompose on the kit, its playwright smoke stays green, frame
budget ≤ baseline, screenshot baseline re-approved.

**Phase 3 — Motion & feedback (1 session)**
Transitions between views, play-result feedback beats, tap feedback,
skeletons, the toasts/notify system restyled. Reduced-motion setting.

**Phase 4 — Ergonomics (1 session)**
Thumb-zone action placement, safe-area insets, text-scale audit, one-hand
reach on the call sheet, table row heights for fat thumbs.

**Phase 5 — Hardening (1 session)**
All 51 smokes + new screenshot probes green, frame budgets locked as gates,
device matrix pass (owner's phone + a small/old device profile), deploy.

## §4 New permanent tooling this creates
- _screens_probe.mjs — screenshot visual regression, per-screen baselines.
- kit_smoke.mjs — the component kit renders every component variant.
- Frame-budget per-screen entries in the gate manifest.

## §5 Explicitly out of scope here
Engine, sim, balance, saves. The manual/help system gets restyled (Phase 2
item 8's sibling) but not rewritten.
