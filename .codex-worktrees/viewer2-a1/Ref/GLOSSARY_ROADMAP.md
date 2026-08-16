# Glossary Realism Roadmap — Throw Deep Publishing sweep (Aug 2026)

All 64 articles from throwdeeppublishing.com/blogs/football-glossary cataloged; 45 deep-read.
Each item below is mapped to a Blueprint action. Groups: **A** validated (no work),
**B** calibration corrections (small, high-value), **C** new content to add,
**D** the 2b gap-model spec, **E** bigger projects for the brainstorm queue, **F** not applicable.

---

## A. VALIDATED — Blueprint already models this correctly

- **Iso, Draw, Counter, Trap, Power, Toss** — all in RUN_CONCEPTS with correct pull/exec identities.
  Articles add: Power/Counter "pull right hit right" wrap mechanics, Counter = longest-developing gap run,
  spill technique is the defensive answer (feeds D below).
- **Mesh, Stick, Smash, Shallow Cross, Y-Cross, Flood, Curl-Flat, Dagger, Four Verts, Post-Wheel** —
  vs-coverage tables broadly agree with the five "beaters" articles (Smash beats C2 ✓, Dagger beats C3 ✓,
  Four Verts overloads two-high ✓, Post-Wheel beats man ✓, Mesh beats C0/C1 ✓).
- **4-3 / 3-4 / 4-2-5 fronts** (incl. the Aug 2026 realistic-fronts wave) — article detail matches:
  4-2-5 keeps a 6-man box with a hybrid star/nickel ✓ (CB-Nickel), 3-4 two-gap NT wants size/STR ✓,
  4-3 one-gap 3-tech is the interior rush star ✓ (DT-3tech/DT-Quick split).
- **QB archetypes** — article's Field General / Gunslinger / Athletic maps to Game-Manager / Gunslinger /
  Dual-Scrambler, including the arm-vs-mind attribute splits shipped Aug 2026.
- **FB modern role** (lead block, short yardage, flat outlet; 235–250 lb thick build) — matches the
  FB molding + FB-Lead/HBack/Hybrid work. **TE inline vs H-back** = TE-Blocking vs TE-Move ✓.
- **OL** — guard pulling = lateral athleticism, LT premium on the edge, center = line-call IQ:
  matches OL-T/OL-IOL/OL-C fit grades (OL-C AWR 32 ✓).
- **K/P** — leg vs accuracy tradeoff ✓ (K-Power/K-Accuracy); NFL baseline ~80% FG / ~90% XP is a
  calibration reference for kicking_model_probe.
- **Cover 0/2/3 structure** — matches coverage families; C3 Fire Zone already modeled (3-4 drops).
- **Kneel-out** — the chart's two inputs (40s play clock, opponent timeouts) match the shipped
  kneel/spike end-game logic. Worth a one-time audit against the rule: kneels burn play clock only
  when the opponent is out of timeouts.

## B. CALIBRATION CORRECTIONS — small edits, real realism wins

1. **PA vs Quarters is backwards.** Article: play-action is THE Cover-4 beater (run-aggressive,
   #2-attached safeties bite). Our `PA Deep Cross` has vs 'Cover 4': **−.05** — should be positive
   (~+.05), rebalanced within the row-sums-≈0 law.
2. **Quarters' other holes**: flats and deep middle. `Stick`/`Curl-Flat` vs C4 could tilt up slightly;
   `Mills (Post-Dig)` vs C4 +.07 already correct.
3. **Cover 0 counters**: draws and QB scrambles should get a success bonus vs Cover 0 (upfield rush,
   nobody spies). Check the draw resolver + scramble math for a C0 branch.
4. **PA credibility vs Cover 0** ≈ zero (no time for the fake to matter) — paRate effect should gate
   on coverage, not just run credibility. Benchmark: heavy PA teams ≈ 30–40% of dropbacks.
5. **Blocked punt ≈ 90% loss correlation** — flavor stat for a future LS/snap model (see E).

## C. NEW CONTENT — concepts/gadgets the library lacks (all fit existing wiring)

| Add | Type | Identity | Beats / dies vs |
|---|---|---|---|
| **Midline Option** | option resolver variant | QB reads the INTERIOR DL (3-tech), FB dive up the A-gap, QB keep into the B-gap; rugged QB + downhill FB | punishes upfield DT-Quick penetrators; eaten by a disciplined two-gap NT |
| **Pin and Pull** | run_outside, pulls | down-block the front, both guards pull to lead; needs athletic guards (OL AGI/TEC exec) + one-cut speed back | exploits aggressive edges; dies without quality pullers |
| **Buck Sweep** | run_outside, pulls, misdir | TWO pulling guards, trap fake, off-tackle crease or bounce; Wing-T staple | beats over-flow; timing-fragile (high TEC demand) |
| **Wham** | run_inside | FB/TE kickout on the first DL outside center (trap with a heavier body); STR/weight gate on the wham blocker | punishes penetrating DTs; low-frequency changeup |
| **Yankee** | pass deep, PA-native, 2-man | X dig 15yd + Z post over the top | beats C1/C3 (any 1-high); dies vs C2/C4 |
| **Drive** | pass short/medium | shallow cross 3-4yd under a 10-12yd dig; triangle read | beats man + C4; dies vs C2/C3 (4-5 under) |
| **Reverse** | gadget | second exchange against the grain; punishes over-pursuit | high variance: TD or big loss |
| **Flea Flicker** | gadget pass | RB tosses back to QB; receivers fake-block then release | bonus vs run-committed fronts; grounding risk under pressure |

Playbook homes: Midline → Flexbone/Wishbone/Pistol; Buck Sweep → Flexbone/Wishbone/Power-I/Single Back;
Pin and Pull → Single Back/Spread/Trips; Wham → Power-I/Single Back/Pistol; Yankee/Drive → dropback sets;
Reverse/Flea Flicker → gadget dial.

## D. THE 2B GAP MODEL — run fits, spec'd from the articles

1. **Spacing type per front**: even (bubble = B-gap): 4-3, Nickel, Dime, 46; odd (bubble = C-gap):
   3-4, 5-2. Inside runs find the bubble; the front's structure — not just its weights — decides
   where the crease lives (feeds `runFit` lane quality + penetrator selection).
2. **One-gap vs two-gap**: 4-3/sub fronts penetrate (DT-Quick/3-tech AGI shines → more TFL, more
   boom/bust); 3-4/5-2 two-gap absorb (NT STR shines → fewer TFLs, consistent short gains).
3. **Box count vs personnel**: spread 2x2 shrinks a 7-man box to ~5 — light-box run bonus already
   partially modeled via matchup matrix; formalize with the run-commit dial.
4. **Spill vs box on gap runs**: vs Power/Counter/Buck/Pin-Pull, the edge defender either SPILLS
   (forces bounce into pursuit — LB AWR/TEC read) or BOXES (forces cutback). Resolves puller-vs-edge
   as a real duel instead of generic blocking.
5. **Backside penetration tax** on the longest-developing gap runs (Counter, Buck Sweep) — the
   vacated guard's gap leaks vs quick interior DL.
6. **Block vocabulary** (reach/down/kickout/log/wrap/scoop/crack) → watch-mode cue vocabulary for
   the pulls that already animate; log-vs-kickout decides which way the hole opens.

## E. BIGGER PROJECTS — brainstorm queue

- **3-3-5 stack** as a seventh front: 3 DL/3 LB/5 DB, 1-high disguise shell, interchangeable
  stack-blitz angles (Sam blitz / SAW 5-man Bear pressure), weak edges vs pullers, 5-man box vs
  trips. Natural sequel to the fronts wave — pairs with the blitz overhaul.
- **Blitz taxonomy** (feeds the player-control brainstorm): risk tiers — zone/fire-zone (low) <
  safety/corner blitz (med, hole behind) < zero blitz (max, short-yardage only) + the Cover-0 "Rat"
  spy variant. The 4-2-5's 6-man cover-0 identity and the 3-3-5's stack pressures give each front
  a signature pressure package.
- **Wing-T formation family** (buck sweep series + waggle boot) — a real formation add with
  series-deception identity (lookalike plays boost each other).
- **Long snapper / holder micro-model**: snap-quality roll feeding FG/punt block odds (a blocked
  punt correlates with ~90% loss rate); holder derived from backup QB/P quality.
- **Route-tree labels** for watch-mode/broadcast polish (hitch 5-6, dig 10-12, arrow 3-4 etc.).

## G. OFFENSE AUDIT (Aug 2026, footballcoachinghub.com — post-defense-waves check)

Verdict: the concept LIBRARY holds up well (pass: 11 of the site's 13 covered or already
planned; run: 4 of 5). The structural gap is that Blueprint has plays but no BLOCKING SCHEME
identity — the layer underneath the plays.

**Missing pass concepts:**
- **Snag** — the biggest single omission: football's most-called quick triangle (corner + snag/
  spot + arrow), beats man AND zone, classic R4 rhythm-read. Belongs in nearly every playbook.
- **Levels** — shallow drag under a deep cross with a clear-out; low-to-high zone stresser.
- **Double China** — vertical-stem dig pairing; man/zone quick-intermediate.
- (Drive already queued in §C from the glossary sweep.)

**Missing run concept:**
- **Wide Zone** as DISTINCT from Outside Zone — the Shanahan "train": full edge commitment,
  everyone moving laterally in unison, PA credibility engine. Outside Zone stretches and cuts
  back; Wide Zone commits. Candidate: run_outside, no pulls, OL AGI-heavy exec, paNative synergy
  (running it boosts PA effectiveness — the site says it explicitly).

**THE STRUCTURAL GAP — blocking scheme identity (gap ↔ zone ↔ man):**
Blueprint's run concepts carry exec weights + a pulls flag, but the team has no scheme
identity underneath them. The site's frame: GAP (down blocks + pullers, physicality, G.O.B.)
vs ZONE (area blocking, lateral unison, athletic OL) vs MAN (assignment). Proposal:
- A team **blocking-scheme lean** (gap ↔ balanced ↔ zone) on the offensive gameplan.
- OL archetypes finally get scheme meaning: Maulers/PWR-STR execute gap runs at full value,
  Athletic/AGI-TEC lines execute zone runs — mis-scheme = discount (mirror of the defensive
  scheme-fit penalty that already exists).
- Feeds 2b directly: gap runs resolve through the spill/box puller duel; zone runs resolve
  through reach-block flow + cutback lanes.
- Feeds contextual OVR (§9 of the brainstorm doc): an OL recruit's number on YOUR board reads
  through your scheme lean.
**Pass protection scheme** (slide / half-slide / BOB / max protect): Blueprint has protEmphasis
+ rbKeptIn + chip animations but no protection identity. Natural home: the OFFENSIVE mirror of
the aggression system (brainstorm open question #1) — protection identity answers pressure
identity.

**Cross-reference — offense items from the Throw Deep sweep (§C/§E) that complete this audit:**
- Run game: Midline Option, Pin & Pull, Buck Sweep, Wham (§C) + Wide Zone (above) = the full
  missing-run list. Pin & Pull / Buck Sweep are GAP-family, Wide Zone is ZONE-family — the
  blocking-scheme lean makes them a coherent set instead of five more menu items.
- Pass game: Yankee + Drive (§C) + Snag, Levels, Double China (above) = the full missing-pass
  list. **Waggle** (Wing-T PA boot off buck-sweep action, from the Wing-T article) is one more
  candidate — Blueprint has no named boot/sprint-out concept; pairs with Buck Sweep the way the
  site pairs Wide Zone with PA.
- Gadgets: Reverse + Flea Flicker (§C) round out the trick family.
- Blocks list (§D item 6) is the shared vocabulary both the 2b gap model and the blocking-scheme
  lean will speak (reach/down/kickout/log/scoop = the zone-vs-gap techniques by name).
- Formations: Throw Deep's formation guide vs our ten — real families we lack are Wing-T (§E,
  queued) and Split Backs / Double Wing / T (niche; skip unless the Wing-T lands and wants
  cousins). I-Form = our Power-I ✓, Bunch/Trips ✓, Ace = Single Back ✓, Quads folds into Empty.
- Route-tree labels (§E) — cosmetic layer for whichever concepts land here.

**WR page findings:**
- X (on-LOS, eats press) vs Z (off-LOS, motion-eligible) distinction: cheap, real mechanic —
  X slots face press-jam exposure more; Z gets the motion eligibility. Layout labels exist.
- "Blocking is non-negotiable" — direct validation of the WR run-block coaching-point dial
  (the founding example of the WE buy-in law).
- Release techniques (win leverage, not just speed) — already modeled by the press-jam duel
  (TEC vs STR/AGI); no gap.

## F. NOT APPLICABLE

Field dimensions, "simple questions," offensive-positions overview, single wing (Wildcat already
carries the direct-snap identity), swinging gate (trick PAT — out of scope), Emory & Henry.
