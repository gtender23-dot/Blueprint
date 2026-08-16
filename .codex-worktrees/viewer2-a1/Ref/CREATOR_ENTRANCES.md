# Creator Entrances & New-Game Wizard — design (DECIDED 2026-08-13)

**Status: decided, ready to build against.** The engine foundations already exist
(store, world seam + compileLeague, offensive playbook, Play Composer B-i). This
doc fixes *how players reach and use* the Creator system, and the new-game wizard
redesign, BEFORE any UI is written — so entrances are designed in, not bolted on.
All UI here is browser-gated (sandbox can't render).

## Core principle — one loop, not four screens

Every creation follows the same path: **create it anywhere → it lands in the
global library → it's offered at every point where you'd use it.** The library
(`js/engine/creator.js`) is the connective tissue and is already built. Three
sanity tests every entrance must pass: you can always find it, you can always get
back out of it, and you never have to abandon what you're doing to make something.

## Entrance map — the four real surfaces

- **Main Menu → "Creator" front door** (working name; rename freely). A top-level
  entry next to *Start Dynasty* and *Play Now*, visible from first launch — not
  buried in settings. It's the workshop: all editors + the library, usable with
  NO world loaded. The *destination* entrance.
- **New Game wizard → the load-into-world entrance.** Custom league, custom team,
  and starting scheme are opt-in expanders in the wizard (see wizard section).
  Each picker carries a **"＋ Create new"** that deep-links into the editor and
  **returns you to the wizard with the new creation selected.**
- **Game Plan (in-dynasty) → the in-context entrance.** Tabs: *Call Sheet |
  Playbook | Play Composer* — reach the play-level tools mid-career without
  leaving the game. (Team/League editors are NOT here — you don't rebuild the
  league mid-season.)
- **Play Now (exhibition) → already half-wired.** Saved-team support exists; the
  custom-team library just needs to surface in its team picker.

## Build-shaping rule (the whole point of deciding first)

Editors are **embeddable components with a return context**, never hard-wired
screens. Each opens either standalone (in the hub) OR as a deep-link that hands
control back (from the wizard's "＋ Create"). Building them this way from day one
is what makes the inline create-and-return round-trip native instead of retrofit.

## The unified SCHEME model

A **scheme** is one bundle: **an offensive side + a defensive side + a derived DNA
lean.** Any side optional.

- **Offensive side** = an offensive playbook (formations + concepts — already
  built in `playbook.js`) + offensive dials (tendency, run/pass, pass depth,
  target shares, tempo).
- **Defensive side** = a defensive playbook (the fronts, coverages, and pressure
  packages the defense carries) + defensive dials (base front, coverage identity,
  blitz rate, pressure source, spy/green-dog, aggression).
- **DNA lean is DERIVED from the scheme**, not chosen separately — your style IS
  your DNA. Derived across whichever sides are present (off book's run/pass
  balance, def book's aggression/coverage). Custom-scheme lean = derived, with an
  optional author override.

A default scheme fills both sides. A custom scheme can be offense-only,
defense-only, or both — so "Air Raid + 3-4" is literally picking two half-schemes.

**Default scheme set (approved, trim at build):** Air Raid, Spread Option, Pro
Style, Ground & Pound, West Coast / balanced — each = a built-in gameplan preset
paired with a matching default playbook + a declared lean.

## The offense/defense split — where it lives

**Decided: the split is a Creator/scheme-LAYER concept, NOT a runtime-object
refactor.** Offensive and defensive bundles are saved and mixed separately, but
when loaded they apply onto the single gameplan object the sim already reads —
offense bundle sets the offense fields, defense bundle sets the defense fields.

- Full mix-and-match with **zero change to the sim or the save format** (both
  load-bearing and probe-guarded).
- `playbook.js`'s `applyPlaybookToGameplan` already touches only offensive fields
  and preserves defensive ones — it IS the offensive half; the defensive
  counterpart applies the defensive fields the same way.
- **Library organization:** a `side: "offense" | "defense"` tag on playbooks and
  plays; the library filters by side rather than doubling the number of shelves.
- **A playbook optionally ties a gameplan.** No gameplan tied ⇒ loading it sets
  only its side's play fields and leaves the rest of your dials alone (this is
  what makes the tie genuinely optional). Gameplan tied ⇒ it's a full side of a
  scheme.
- **Defensive playbook v1 scope:** "which fronts, coverages, and pressures this
  defense carries," chosen from the systems that already exist. A full *defensive
  play-composer* (authoring custom blitzes/coverages, the defensive analog of
  Play Composer B-i) is DEFERRED.

## New-Game Wizard redesign

**Out of date today:** the scheme step is a shadow of the real formation/coverage/
playbook depth; no DNA acknowledgment; its only "custom" is a thin prestige/
job-security/budget sandbox that predates the Creator; zero custom-content
entrances.

**Principle: optional is the default STATE, not a mode you opt into.** A short
required spine, with everything else as collapsed, sensibly-defaulted expanders.
Next-Next-Start yields a great game and never shows a custom-content control. Plus
a **Quick Start escape hatch** on screen one — one click takes every default (auto
coach, program, scheme) straight to Kickoff.

**Flow (six beats, modernized):**

1. **Coach** — name only. **No separate DNA picker** (lean comes from the scheme).
2. **World** — *Default procedural* by default; optional **"Use my custom league ▾"**
   (reads the league library; ＋Create → returns here). ← *Creator entrance #1*
3. **Job** — pick a level; the game finds the program whose history fits. Optional
   **"Coach my own team ▾"** drops a custom team into that slot. ← *entrance #2*
4. **Scheme** — the single meaningful identity choice. Each default scheme card
   shows the three things it sets at once (book style, gameplan tendencies, DNA
   lean). Pick one bundled full scheme by default; optional **"swap the defensive
   side ▾"** for mix-and-matchers; optional **"custom scheme ▾"** points at your
   library. ← *entrance #3*
5. **Staff** — OC/DC, auto-suggested so the default is "accept."
6. **Kickoff** — reveal + start.

Every Creator entrance defaults to "Default," sits collapsed, and is skipped by
the fast path — the wizard gets *richer* without getting *longer* for someone who
doesn't want the depth.

## Decisions log (all owner-approved 2026-08-13)

1. Entrance shape (loop + four-surface map + inline ＋Create→return + discovery
   nudges) — approved.
2. Quick Start escape hatch — YES.
3. Progressive disclosure (collapsed expanders) instead of a hard Simple/Advanced
   mode — YES.
4. Old custom-difficulty sliders — retire into the Creator (real custom content
   replaces the thin sandbox).
5. Scheme = playbook + optional gameplan + DNA lean; DNA lean derived from scheme,
   not a separate step — YES.
6. Playbook with no tied gameplan applies only its side's play fields, leaves the
   rest as-is — YES.
7. Custom-scheme DNA lean = derived (with optional override) — YES.
8. Default scheme list kept as proposed — YES.
9. Offense/defense are separate playbooks + gameplans, split at the Creator/scheme
   layer, runtime gameplan stays one object — YES.
10. `side: offense/defense` tag on playbooks/plays (not double the shelves) — YES.
11. Defensive playbook v1 = carry existing fronts/coverages/pressures; full
    defensive play-composer deferred — YES.
12. Wizard scheme step = one bundled full scheme by default + optional swap-defense
    expander — YES.

## Season Mode + Division Editor + prestige model

See **`Ref/SEASON_MODE.md`** (decided 2026-08-13): a focused resumable single-
season showcase; the division-scoped league model (three slots, mix-and-match);
the **Division Editor that MERGES the League + Team editors** into one screen; the
prestige model (D2/D3 conference-tier seed + fluctuation, D1 blue-blood toggle
within the major/mid-major bands); the verified **no-cap** guarantee; and five
dynasty cleanups folded into this update (team-library unify, onboarding
consolidation, Game Plan offense/defense reorg, prestige-knob unify [balance-
gated], advance-week gate audit).

## Resilience & remaining gap decisions (2026-08-13)

From the "overlooked gaps" review; owner calls recorded:

- **#1 Stale creations — DONE.** `js/engine/creatorrepair.js` `repairCreation(kind,
  data)` validates a loaded creation against CURRENT game data, drops what no
  longer fits (removed formations/concepts/variations/route-parts/dead bases),
  returns `{ data, changes, ok }` with a plain-English change list; `ok:false`
  means it can't be auto-rebuilt and should be opened in its editor. The UI calls
  this on load. `creator_resilience_probe` (core) covers it.
- **#2 Backup — DONE (owner: "yes back up").** `cfb-creator` now has a
  two-generation backup ring (creator.js), mirroring the save ring — a corrupt
  primary recovers the last good library instead of wiping it. Same probe.
- **#5 Sharing transport — DECIDED (owner deferred → my call): copy/paste a text
  code.** `exportCreation` already emits a self-describing JSON string;
  `importCreation` validates + files it. v1 UI = "Copy share code" / "Paste share
  code" (clipboard). No file/URL transport in v1. UI is browser-gated.
- **#6 Team Editor scope — owner WANTS full roster/player authoring.** v1 ships
  **identity-only** (name/colors/prestige/conference; procedural rosters) because
  it's cleaner and unblocks the wizard's "coach my own team." **Full player/roster
  authoring is a planned follow-up, explicitly NOT cut** — just phase 2 of the
  Team Editor. Noted per owner ("just note it").

## Deferred / out of scope (recorded so it isn't lost)

- Full **defensive play-composer** (custom blitzes/coverages).
- Map-pin lat/lng geo override for custom schools (state-centroid is v1).
- Explicit rivalry authoring (auto-from-geography is v1).
- Any change to the runtime gameplan object or the save format.

## How this sits on the built foundations

- `creator.js` — the global library; add the `side` tag to `playbooks`/`plays`.
- `playbook.js` — IS the offensive playbook; extend with an optional tied
  gameplan; build the defensive-playbook counterpart alongside.
- `playcompose.js` (B-i) — the offensive play composer; defensive analog deferred.
- `world.js` `compileLeague` + `generateWorld(opts)` — the custom-league/team
  entrance the wizard's World/Job steps call.
- All UI (hub, wizard, Game-Plan tabs, deep-link return path) — browser-gated,
  built as embeddable components per the build-shaping rule above.
