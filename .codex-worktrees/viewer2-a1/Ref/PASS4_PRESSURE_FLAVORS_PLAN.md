# Pass 4 — Pressure Flavors · Plan of Record

**Status: SHIPPED 2026-08-08.** Gates run at ship: build 0 boot pageerrors ·
**mug_probe 8/8** (stamp 100% · both truths · kill byte-identical 3/3 ·
fired sack% up · bail short comp% −3.2pp · run splits both directions) ·
**greendog_probe 10/10** (man gate absolute: 0 zone dogs · every dog on a
kept-in back · standing toggle = same rule · kill restores OLD code path,
refit divergence proven 3/3 · kept-in sack% 9.09 vs 6.19) · **crossdog_probe
7/7** (≥70% of fired snaps run the game · pick breaks BOB 5.3% vs Quick 2.9%
· sprung crosser sacks 16.9% vs 10.2% passed-off · short comp% up vs the
wash) · **amoeba_probe 7/7** (fooled 13.4% vs 5.2% · kill-calls 2.1% vs 4.6%
· ypc up · unfired sack% down) · **pass4_band_ab N=400** (AI flavor live —
mug 35% / cross 16% / Psycho 23% of staffs): drift pts 0.01 · rush 2.61 ·
pass 1.36 · comp% 0.21 · sacks 0.04 — HELD · defcall_probe 32/32 · covfam 17
· rotation 5 · defmesh 20 · front_variants 53 · front_335 30 · 5-2 · fb_slot
· gaplist · scheme_role 22 · thin_roster 20 · pressure/blitz_reality/creeper
· press_jam/robber/zone_void/shell_identity/motion_struct/sep/tendency ·
worldgen/recruiting/progression/save_migration/midgame_save/cutday ·
stat_realism N=500 (pts 26.9 / rush 145.2☆ / pass 248.1 / comp 56.7 / INT
1.64 / sacks 2.19 — same band state as baseline; ☆ = the standing
pre-existing rush drift) · UI smokes: defcall_ui (+5 Pass-4 checks) /
headset / ui_playcall / playnow / _depth_shot / _drag_test / roster_sticky.

**Fixed en route (latent, Pass-3 era):** the F1 live-call path applied
`applyDefCall` but never ran `syncDefEff`, so call-only ingredients
(covFamilyEff / rotationEff / rush3Eff — and now pressLookEff / dogGameEff)
never reached the mechanics layer on F1-loaded calls: an F1-loaded Prevent
pinned the NAME but never cut the rush to three. One unconditional
`syncDefEff` after the defPlanEff build (idempotent for the sheet/formChecks
paths) fixes it for every ingredient, past and future.

**Flag raised (NOT touched, needs its own gated look):** align-to-win's
isolation edge (`rp.alignEdge = C.ALIGN_EDGE`, +0.4) feeds `blockRep`'s
contextBoost — which is BLOCKER-favoring by sign convention. The "schemed
1-on-1 edge for the standout rusher" may be helping the blocker instead.
Consistent with the standing seed-flaky align_probe check-1 flag (margin
off≈on). Suspected sign bug; band-relevant; do not flip casually.

**Engine lesson (recorded for future rush work):** in the pocket geometry
(rushgeo resolvePocket) a FREE blitzer's shed is SHED_FREE = 3.38s — slower
than a won rep (SHED_BASE 2.9 − margin), by design ("the hot throw beats
him"). Docking blitzer pickup odds therefore LOWERS sacks — it converts
fast picked-up-and-beat-the-RB reps into slow free reps. Interior heat must
be modeled as geometry (MUG_SHED discount — the dog starts in the gap), not
as pickup odds alone.

---

**Owner rulings (2026-08-08):**
1: AI adopts now, gated A/B (recommended). · 2: **REFIT the standing greenDog
toggle too** (beyond the recommendation — one model everywhere; the sanctioned
old-save/AI behavior change is covered by the gated A/B and greendog_probe).
· 3: no hard amoeba gate — cost polices it (recommended). · 4: Hook Rule table
as proposed (recommended).

Roadmap brief (roadmap.html): *Double-A-gap mug looks that bail · green dog
(blitz-if-your-man-blocks) · cross-dog interior games · amoeba/psycho
no-hands-down disguise.*

---

## What exists today (code-verified anchors)

The pressure surface is already deep — Pass 4 adds FLAVOR (presentation and
interior games), not a new rush engine:

```
blitz assembly           sim.js ~1188–1330 · passRushers built from the front,
                         blitzPct roll → identity picks who comes (PRESS_IDENTITY),
                         fire-zone drop, zeroBehind, phantom-blitz bookkeeping
resolvePassRush          sim.js 351 · per-rep block duels; blitzer pickupProb
                         (363, free-blocker count only), align-to-win (376),
                         CREEPER free-runner (402 — blitzDesign vs center AWR,
                         protection-identity redirect), chip, pocket collapse
protection identity      PROT_IDENTITY (constants) · protectionFactor + the
                         center's AWR half-slide term (_cAwr, 1411)
coverage cost            deepRisk/zeroBehind consumed at 2040 (primary hole by
                         identity, second man over the top on zero)
QB hot answer            2074 (hotChance: AWR/TEC vs Blitz Design disguise)
pre-snap duel            3886 (DISGUISE_SHOW / pDisguise / believedFam),
                         kill-calls (3913 boxScore·seeIt), audibles (3958)
green dog (partial)      sim.js 1356 · STANDING gameplan boolean (gp.greenDog,
                         AI rolls it 30%): any staying back converts one LB
                         rusher to blitzer — no man-coverage gate, no call form
call system              Pass 2/3 chain: pickDefCall → applyDefCall → syncDefEff;
                         CALL_FIELDS (gameplan.js 1852) + F1 headset chips
```

No stunt/twist machinery exists anywhere — cross-dog is the one genuinely new
mechanism. Everything else is presentation layered on existing levers.

---

## The design

**Two new optional ingredients on named calls** (Pass 3 law: call ingredients,
never standing dials):

```js
gp.defCalls["Stack Mug Zero"] = {
  ...existing dials,
  pressLook: null | "mug" | "amoeba",   // NEW · the pre-snap presentation
  dogGame:  null | "green" | "cross"    // NEW · the interior dog rule
}
```

Kill-switch **`__noPressFlavors`** — guard lives inside applyDefCall + AI
generation (Pass 3 precedent: one entry point, byte-identical fallback to the
call's plain dials). Old-save law: absent keys ⇒ nothing changes.

### 1. Mug (double-A mug that bails) — `pressLook: "mug"`

Both inside backers walk into the A-gaps and SHOW blitz on every snap of the
call. Whether they come rides the existing blitzPct roll — the look is the
flavor; the roll is unchanged:

- **The show fights the QB all snap.** The disguise term of `hotChance`
  strengthens (he can't tell which of six is real) and `pDisguise` rises —
  the mug is the classic pressure bluff.
- **Fired:** the heat comes through the middle — interior blitzer
  `pickupProb` docked (the protection is stressed at its core) and the
  center's half-slide AWR term muted this snap (his points are spent on the
  mug). The price is already real: the existing deepRisk "primary hole"
  machinery opens the vacated middle hook behind a backer blitz.
- **Bailed:** both backers sink into the low hole — short/medium **middle**
  targets −sep (the bluff bodies land exactly where the hot throw goes).
- **Run cost (honest):** vs run_inside the mugged backers are IN the gaps
  (+tiny defense); vs run_outside they're pinned inside, late to scrape
  (−tiny defense). Small, directional, probe-provable.

### 2. Green dog — `dogGame: "green"` (and the standing dial)

The real rule: MAN coverage, your man stays in to block ⇒ you become a
rusher. Owner ruling (decision 2): ONE model everywhere — both the call
ingredient AND the standing `gp.greenDog` toggle run the real rule: fires only
when the resolved coverage is man AND the back actually stays in (`!rbReleased`
— the old code keyed on the back's archetype and could fire with the back out
in a route); the converted dog is the back's own defender — he comes late but
the protection never counted him (small pickup dock on the convert). This
intentionally changes old saves and the ~30% of AI defenses that rolled
greenDog — sanctioned, covered by greendog_probe + the gated A/B.

### 3. Cross-dog interior game — `dogGame: "cross"`

Two interior backers cross behind the DL — a pick game aimed at the center.
New small mechanism in resolvePassRush (scheme arg gains `game`): P(one
crosser comes free) follows the CREEPER formula shape — base + Blitz Design
scale − center AWR scale, protection-identity redirect (BOB suffers most —
that's what the pick attacks; Quick beats it with the ball out). On a failed
pick (center passes it off) both crossers are absorbed — the pocket firms.
**Cost:** both backers are in the wash — no underneath rally: checkdown and
screen outcomes improve vs the call.

### 4. Amoeba / psycho — `pressLook: "amoeba"`

Nobody's hand is down; the front is a standing swarm. Pure presentation:

- `pDisguise` strongly up (the shown shell is scrambled), QB kill-call
  `seeIt` down (no box to read), `hotChance` down (no pressure origin to ID).
- **Cost:** no hands down = late fire-off. On snaps where no blitz fires the
  pocket is a touch BETTER for the offense (the front was standing up), and
  vs run the defense is docked this snap (they're not built to strike).
  Passing-down tool by nature — the call sheet's situational rows put it
  where it belongs (see open decision 3).

### 5. Live calling & UI

- Calls editor: two new CALL_FIELDS rows — **Look** (Mug / Amoeba) and
  **Dog** (Green / Cross). Same chip/editor pattern, sparse.
- F1 headset: loaded call's look/dog render as display chips on the CALL row
  (Pass 3 precedent — ingredients of calls, not new dials). Adjusting the
  HEAT SHAPE row (pressureIdentity) sheds a pinned look/dog (you overrode
  the pressure design).
- Standing gameplan Pressure section: unchanged (greenDog toggle stays).

### 6. AI coordinators

`buildAISignatureCalls` flavor, all gated `__noPressFlavors` at the data
layer: an aggressive DC (agg high) with a real interior LB room mugs his heat
call; a smart-design staff whose backers can run games gets cross-dog on the
heat call; a high-design aggressive staff authors a third_long "Psycho" look
(amoeba + attacking). Band rule: gated stat_realism A/B before ship
(pass4_band_ab, covfam_band_ab pattern).

---

## THE HOOK RULE (per IDENTITY_DESIGN §4f — named at plan-of-record stage)

| Mechanism | Trait hook |
|---|---|
| Green dog convert | **Green Dog** (already in v1 catalog — this IS its mechanism; the ingredient sharpens the hook it will read) |
| Cross-dog pick execution | **NEW play trait: "Games Runner"** (LB — the crosser's pick-timing term; offense counter already claimed by Line General's stunt-align read) |
| Mug bluff sell + amoeba show | Folded into **Disguise Artist** (v1.5 — the shown-shell craft term; the mug/amoeba pDisguise lift is exactly the surface it reads). No separate trait. |
| Mug interior pressure / bail squeeze | **Declined** — coordinator scheme (Blitz Design), not a player style; the bodies executing it are already priced by the blitz/coverage machinery. |

---

## Guardrails

- Kill-switch `__noPressFlavors`; old-save law (absent keys ⇒ unchanged).
- No new mechanisms where a lever exists — mug/amoeba are perturbations on
  pickupProb / _cAwr / pDisguise / hotChance / seeIt / sep; cross-dog is the
  one new term and it reuses the CREEPER formula shape.
- Every flavor carries an honest cost (bail squeeze vs vacated hook; pick
  free-runner vs checkdown/screen; disguise vs run softness).
- Probes decide truth: mug_probe, greendog_probe, crossdog_probe,
  amoeba_probe, defcall_probe extension (ingredients ride pickDefCall),
  defcall_ui_smoke rows, pressure_probe + blitz_reality_probe re-held,
  pass4_band_ab, stat_realism vs baseline (pts 26.5 / rush 144.4 / pass
  246.7 / comp 56.8 / INT% 1.69, 2026-08-08).

## Build sequence (each step gated: build · _boot_check · probes vs baseline)

1. Payload plumbing: pressLook/dogGame through pickDefCall / applyDefCall /
   syncDefEff; kill-switch; defcall_probe extension.
2. Mug mechanics + mug_probe.
3. Green dog ingredient + greendog_probe (standing dial untouched, proven).
4. Cross-dog mechanics in resolvePassRush + crossdog_probe.
5. Amoeba + amoeba_probe.
6. UI: CALL_FIELDS rows + headset chips + ui smoke extensions.
7. AI flavor + gated A/B.
8. Full gate suite + roadmap.html chip flip (Pass 4 → ✓, Pass 4.5 → ▶ NEXT).

---

## Open decisions (proposed, Pass-2/3 style — recommendation first)

1. **AI adoption now vs Pass 6.** Proposed: now — signature-call flavor only,
   zero new decision logic, gated A/B (Pass 1/2/3 precedent all held).
2. **Green dog scope.** Proposed: the ingredient gets the REAL rule
   (man-gate, late dog) while the standing toggle keeps its shipped behavior
   untouched. Alternative: also refit the standing toggle to the new
   mechanics — cleaner model, but silently changes every old save and AI
   defense that rolled greenDog.
3. **Amoeba reach.** Proposed: no hard down-gate — its run cost is real and
   the call sheet's situational rows naturally put it on passing downs.
   Alternative: hard-gate (ignored outside pass-leverage buckets).
4. **Hook Rule table above.** Proposed as written (one new trait "Games
   Runner", green dog claims its own, disguise work folds into Disguise
   Artist, mug pressure declined). Alternative: name more/fewer.
