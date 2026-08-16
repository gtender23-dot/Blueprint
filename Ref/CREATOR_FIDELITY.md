# Creator fidelity — how honest is the picture? (2026-08-15)

Owner question: *"Can you say this is a 100% accurate representation of the engine —
and if not, how far, and is there drift between the UI accuracy and the engine?"*

Short answer: **no, it is not 100%, and the drift is layered.** The pre-snap statics
are genuinely 1:1. The play art is honest about a play's *identity* but does not show
the sim's *resolution*. And the formation-variation alignments the Creator now draws
have **no engine counterpart at all** — that's the gap to close first. The full map,
verified by tracing every table each layer reads:

## The fidelity map

| layer | what it draws from | engine truth | verdict |
|---|---|---|---|
| Base formation diagrams | `OFF_FIELD_LAYOUTS` slot x/y | the SAME table `resolveOffField` (fieldassign.js) resolves bodies from and the viewer fields | **1:1** |
| Defensive front diagrams | `DEF_FIELD_LAYOUTS` | same table `resolveDefField` uses | **1:1** |
| Variation alignment cards | a UI heuristic (`_variationLayout` in routeart.js) derived from personnel + the look's name | **nothing** — the `layout:` pointers in `FORMATION_VARIATIONS` ("air_empty", "power_big", …) are DANGLING: no code anywhere resolves them. The live viewer always fields the BASE alignment. A variation's real engine effect is passLean delta + matchup edges + situational mods | **invented** — the biggest drift |
| Variation personnel | `pkg` overrides (Power-I Big = 3 TE 0 WR) | applied ONLY on the `resolvePersonnel` fallback path (sim.js ~4807). When field assignments resolve (the normal case), personnel comes from the BASE layout — the pkg override never fires. Also: Air Raid "Empty" has NO pkg override, so the engine fields 1 RB in Empty | **engine-side inconsistency** (see below) |
| Concept play cards | `CONCEPT_ROUTES` hand-authored combos | the sim consumes a concept as `{depth, minWR, vs table, exec weights, playType}` — no route geometry exists in the outcome math. The combos are recognizable football pictures, not assignments | **identity-accurate, resolution-blind** (by design) |
| Run diagrams | run-type classified from the concept NAME | engine run = `{type, vsBox, rpo, exec}` — no gap geometry in outcomes; run2geo/rushgeo invent viewer geometry per play | same verdict |
| Composed play cards | the play's actual `parts`/`assigns`/`blocks` | grades derive from parts (band-clamped) — faithful. But `assigns` and `blocks` are DIAGRAM METADATA: the sim does not run "your slant on the X," and a drawn block does not change protection (protection = protIdentity + the OL model) | **data-faithful, sim-abstract** |
| The animated play (watchphys) | the play record + sepgeo/run2geo/yacgeo | its own geometry — a THIRD representation. A composed play's animation will not match its card receiver-for-receiver | visible to an attentive player |

## What was measured and fixed this pass

- Swept all 42 pass-concept arts against engine depth class: 19 flagged by the
  average-depth proxy; hand review → most are correct football pictures (Mesh's
  corner pulls the average up — the picture is right), but **5 were genuinely wrong
  and are fixed**: Bubble Screen and RB Screen were flipped (screen art always
  preferred a back; bubble now has its own outward-swing art on the slot, tunnel
  comes back inside — owner catch), Comeback drew as a hitch (now a deep-stem
  comeback), Deep Out drew shallow (now 18-yard break), Follow drew as two
  identical drags (now drag + dig behind it).
- **Air Raid Empty drew an HB next to the QB** (owner catch): the derived Empty
  shape now splits backs out as slot receivers — which is also the engine's truth,
  since Empty carries no pkg override and the RB stays on the field. Fixed for
  every empty-shaped variation.
- Run-name classification: all 20 run concepts classify to the correct run family;
  0 misclassifications; all diagrams in bounds at every card size.

## Engine-side findings (not UI) — need owner decisions

1. **Variation pkg is inconsistently consumed.** With live field assignments,
   `offField.personnel` comes from the base layout and the variation's pkg override
   never applies; without them, `resolvePersonnel(…, offVar)` applies it. Same
   gameplan, different personnel depending on an unrelated condition. Needs one
   truth (probably: variation pkg always wins) + a probe.
2. **"Empty" that isn't.** Air Raid Empty / similar looks with no pkg override field
   base personnel. If Empty should genuinely empty the backfield in the engine
   (personnel, short-yardage power, checkdown availability), it needs a pkg —
   that's a balance decision, not a UI one.
3. **The dangling `layout:` pointers** are the smoking gun that authored variation
   alignments were always intended. Wiring them is the single highest-value
   fidelity item (below).

## Distance to "commercial-grade flawless" (the Madden-fan designer)

The good news: the architecture is unusually well-positioned, because alignment is
already DATA (`OFF_FIELD_LAYOUTS` rows), legality is already a gate
(`SLOT_ELIGIBLE_POS`), balance safety is already a proven pattern (the composer's
band-clamped rulebook), and the sim already samples named defensive calls (PASS 2
call system). Staged honestly:

1. **Wire variation alignments end-to-end** — author the ~22 layouts the dangling
   pointers name; resolve them in `resolveOffField` + the viewer + the diagrams
   (one table, three readers, like base formations today). Closes the largest
   drift. *Medium effort, no balance change.*
2. **Resolve the pkg inconsistency + Empty personnel** (above). *Small engine fix +
   probe; pkg contents are balance calls.*
3. **Make composed plays animate as drawn** — thread `assigns` into the viewer's
   route generation (sepgeo is already parametric per route). Presentation-only, no
   outcome change — but it is THE "I drew it and watched it run" moment the
   Play-Now/Madden segment buys. *Large-ish, confined to watchphys/sepgeo.*
4. **Blocking assignments that matter** — let `blocks[]` nudge protection within a
   clamped band (the composer pattern: fixed rulebook, band-limited, AI-blind).
   *Medium; balance-sensitive, probe-gated.*
5. **Custom formation designer** — the formation registry is today ~6 parallel
   tables (`FORMATIONS`, `FORMATION_PACKAGES`, `FORMATION_PLAYBOOK`,
   `OFF_FIELD_LAYOUTS`, personnel classes, variations). Designer needs: one
   registry object, an alignment-legality validator (7 on the line, eligible
   numbering, backfield rules — "crazy but legal"), derived balance via a fixed
   rulebook, and the art comes free (the diagrams already draw any layout row).
   *The largest chunk; the moat feature.*
6. **Defensive play composer** — per-play front + coverage + pressure look built on
   the existing call-system seam, mirroring the offensive composer. *Medium.*

Cheap honesty wins available immediately: label variation cards "projected look"
until item 1 lands, and label concept thumbs as identity art. Recommended order is
as numbered — 1 and 2 are the "everything has to interact from the draw-up to the
whistle" foundation; 3 is the demo moment; 5 is the market wedge.
