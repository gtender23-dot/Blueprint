# COACHING TREE ROGUELITE — DNA, coordinators, careers as runs
### Design doc · brainstormed 2026-08-10 · **RATIFIED 2026-08-10 — ALL DECISION POINTS RULED (§10)**
### STATUS: **BUILT (verified 2026-08-13).** The header below is stale — this shipped.
### Every system specified is live and gated by its own CORE probe: age (coach_age_probe),
### star ladder (star_unfold_probe), HC formation mastery (hc_mastery_probe), coordinator
### identity (coordinator_identity_probe), ceremony/succession (ceremony_probe), player
### retention (player_retention_probe), plus the tree slots / careers-as-runs and DNA crest.
### The multi-coach playtest work (2026-08-12) drove tree slots, coordinators and hcMastery
### directly. Original build-order note kept below for the record.
### (was: ready to build on owner's "go". Build order §11, pass 1 = age system.)
### Companion memories: dna_tree_rework.md, longevity_brainstorm.md (project memory)
### House laws inherited: probes decide truth · stat_realism is the veto · exact-string
### edits in bundler idiom · no Buy-In/Coaching-Points · zero-migration on old saves

## 0. The idea in one line

Careers are **runs**; the shared tree is the **meta-build** the player grows across
them. Tree rewards **compress time — they never raise ceilings** — so a maxed tree
turns a five-year rebuild into a two-year one but never wins a title for the player.
Same law the owner already ratified for player traits (IDENTITY_DESIGN: "fit +
situational only, never stat-sticks"), applied one level up.

**Standing owner laws (2026-08-10, non-negotiable):**
1. **Nothing is ever locked behind this system.** All football content available to
   everyone; lineage buys speed and familiarity only.
2. Max tree rewards must never overshadow actual skill in building a team.
3. Rewards are floors, reveals, access, and speed; the few outcome-touching pieces
   (HC formation mastery) are small, capped, and band-gated.
4. **Money is the only currency in the coordinator system** (retention AND the
   succession promise). No exotic penalty mechanics.

## 1. The problem (owner's framing)

Football sims go loose after 30–50 years — teams and AI break down. This game targets
50+ year worlds (200+ RNG schools, 120 static D1, all with backstories) and wants the
complaint inverted into the pitch: **the world's memory compounds instead of decaying,
and decades 3–5 are where the biggest stories live.** The tree is what the player
builds *outside* the actual teams — the reason to come back for another career.

Current DNA fails this brief: 13 XP bars accumulating small outcome multipliers,
harvested into a pool, inherited as a diluted percentage. A savings account, not
heredity. Nothing is ever *passed down* — just averaged — and multiplier rewards
compound with player skill, which is exactly the overshadow failure the owner forbids.

## 2. Prior art (what other games teach)

- **Hades** — the two-layer split: permanent progression (mirror) + a per-run choice
  (keepsakes). Our crest = mirror; our coordinator hire = keepsake.
- **Slay the Spire** — meta-progression as unlocked *options*, near-zero power. The
  skill-respecting existence proof.
- **Rogue Legacy** — the cautionary tale: spendable permanent stat upgrades = power
  creep that eventually trivializes skill. Rejected shape.
- **Real coaching trees** — the football grounding: what actually passes down a tree
  is scheme, territory, and people — not +3% charisma.

## 3. The four layers (as ruled)

| Layer | What | Ruling |
|---|---|---|
| 1 | Permanent crest — DNA axes on a ★/★★/★★★/💎 ladder | **Pure XP, all tiers (D1/D2)** |
| 2 | Per-run loadout — hiring/retaining/mentoring coordinators | **Build (§5)** |
| 3 | Run seeds — contracts | **PARKED (D6) — not in this build; old system stands** |
| 4 | Post-run payoff — the retirement ceremony | **Build (§7)** |

Plus one prerequisite system (§8): **coach age** — the run clock. Also fixes the
carousel's tenure-reset immortal-journeymen bug.

## 4. Layer 1 — the crest: current axes, star ladder

**Keep the DNA axes** (coachprofile.js DNA_AXES) minus the two that move out (below).
Recut the 0–10 `dnaGrade` ladder to four tiers: **★ / ★★ / ★★★ / 💎**. Owner's
mapping: ★★★ ≈ old grade 9, 💎 = the old grade-10 (max) bonus. Effect ceiling
unchanged; the ladder underneath becomes chunky — every tier is an event. Existing XP
re-buckets through a new `dnaGrade` curve; display + bonus lookup change; no save
migration beyond the function.

**RULED (D1/D2): all tiers including 💎 are pure XP.** No deed gating anywhere.

**Inheritance in star terms:** a protégé inherits chosen axes at up to **★★, never
★★★/💎** (replaces C.TREE.INHERIT_CAP_GRADE semantics; strength still scales with
seasons served via existing `dnaInheritance`). Those he earns himself — the roguelite
loop in one sentence.

**RULED (D3): recruiter + developer LEAVE the DNA crest and return to the skills
system** — back alongside Roots and Reputation on the old F–A+ skill ladder. This is
an un-fold, not a new build: `SKILL_KEYS` in coach.js still contains
`["evaluator","recruiter","developer","reputation","roots"]` and `freshSkills()`
still initializes them — the fold only re-pointed player-facing effects at
`_dnaGrades`. Reverse that pointer. **Owner's overriding constraint: "just don't let
them break anything."** Build rules:
- Effects re-point to skill grades at the OLD coefficients (the fold's comment
  preserved them: developer maxed 12·0.015=0.18, recruiter maxed 12·0.025=0.30).
- Earned DNA XP in those two axes folds back into skill XP by a floor mapping (a man
  keeps what he earned — same law as the culture→motivator migration).
- The two axes leave DNA_AXES/the crest card; `migrateDna`'s retired-axis machinery
  is the template. Null-guard everything; old saves byte-safe; tree banking of those
  axes stops (banked history in existing trees is left untouched, simply unread —
  owner will revisit later if wanted).
- Any deeper redesign of recruiter/developer (pipelines/alumni/finishing ideas from
  the brainstorm) is EXPLICITLY DEFERRED — owner: "I'll figure the rest out later."

## 5. Layer 2 — the coordinator IS the keepsake

### 5a. What already exists (extend, do NOT rebuild — staff.js)
- Per-formation **schemeIQ**: rolled baseline (center 34+q·0.28 ±10), specialty +15
  (`generateCoordinator`), **grows with actual usage** (`growStaffSchemeIQ`, ceiling
  from ratings), **affects outcomes** via `coordIqMod` (FORMATION_IQ_BASE +
  SCALE·iq) and `coordPackageIQ`.
- `coordinatorCredentials` + `coordStreak` read a per-season unit-grade **ledger that
  has no writer** — half-built scaffold; natural home for the identity upgrade.
- `deriveSchemeIdentity` — display label. `rollCoordinatorPoach` — the threat that
  retention answers (currently salary is the only counter).

### 5b. What gets built
1. **Rust.** SchemeIQ decays toward its baseline floor when a formation goes unused
   (owner: skill "reacts +/- based on actual usage"). Floor = his rolled baseline.
   A coordinator's sheet becomes a living record of how he's actually been used —
   which is what makes him worth retaining and inheriting. AI coordinators rust too,
   but AI usage is stable, so expected band impact ~0 — verify.
2. **Player HC formation mastery.** The player coach gets his own per-formation
   sheet: baseline (numbers at build, D9), grows with real calls, rusts on disuse,
   **small effect on play outcomes of that formation**. STACKING LAW REQUIRED: HC
   mastery combines with `coordIqMod` under a hard cap so the total formation-IQ
   envelope stays inside today's range — the one outcome-touching piece of the
   rework; it faces stat_realism.
3. **Identity card, in star language.** Coordinator card = formation sheet rendered
   as stars, specialty highlighted, **age**, one ambition trait (**Climber** — wants
   a head job, will leave / **Lifer** — stays if respected), lineage (mentorId — who
   shaped his sheet). Write the unit-grade ledger each season so credentials/streak
   go live.
4. **Hire-time surfacing.** `generateCandidates` already rolls the data; the hiring
   screen shows the sheets so hiring becomes *casting*: find the guy who runs YOUR
   formations. This is the per-run loadout choice.
5. **Retention — RULED (D4).** Trigger: ONLY when a coordinator **gets a job offer
   and is about to leave** (the `rollCoordinatorPoach` event — no standing upkeep,
   no other trigger). The player may then pay to keep him: **10%, deducted from NEXT
   season's recruiting budget.** Plumb exactly like `pendingScheduleGuarantee` in
   `initBudget` (recruiting.js:311) — a `pendingRetentionCost` applied at next
   season init. *Build-time confirm (one line for owner): base of the 10% — the
   division allocation `C.ECON.BASE[div]` (owner's first phrasing, fixed per
   division) vs. 10% of next season's computed budget (second phrasing). Default to
   `C.ECON.BASE[div]` unless owner says otherwise.*
6. **The succession promise — RULED (D5): money only, and it costs.** The promise is
   important enough to be paid for — same single-currency law as retention (price
   sized at build alongside the 10% rule; no non-monetary penalty machinery). Made:
   the Climber stays, mentors toward the seat, becomes the ceremony's centerpiece.
   Seasons served drives inheritance strength (existing `dnaInheritance`); the
   promise makes it a chosen relationship instead of silent math.

## 6. Layer 3 — contracts: RULED (D6, revised 2026-08-11) — the loyalty ladder

Original D6 (2026-08-10) parked contracts ("old system — ignore it"). **Revised by
owner 2026-08-11** after the run-seed contract concept was rejected as not fitting
the roguelite: contracts are NOT run seeds, mandates, negotiations, or bonus
catalogs. They are a thin, visible wrapper on the ALREADY-SHIPPED player-retention
economy (the 10%-per-declined-call / cap 100% / forfeit-on-climb system,
player_retention_probe):

- **Arrival**: the player starts EVERY school at the base division allocation
  (C.ECON.BASE[div]) — no carryover; climbing/moving forfeits the ladder (matches
  the shipped forfeit-on-climb rule).
- **Renewal**: every follow-up contract at the same school = **+10% budget bump**,
  **capping at +100%** (2× base).
- **Rejected outside offer, outside a contract year**: declining another school's
  offer mid-contract adds **+1 year to the current contract length AND the +10%
  bump** (same cap). This folds the shipped declined-call bump into contract terms.
- Nothing else: no salary trade, no bonus clauses, no buyouts. The harvest shares
  (D8: quit ~0.6) already price leaving; money stays this system's single currency
  (D5).

**UPDATE 2026-08-11 (same day): the delta SHIPPED, build eb3d1edfcf.** Owner ruled
"replace the bonus structure" — done: getExtensionOffer/acceptExtension
(offseason.js) drop recruitBonus + juice entirely; the re-up money is one loyalty
stack (+10% of division base via the shipped retentionStacks revenue line, same
cap, same forfeit-on-climb). Prove-It/Market/Max survive as length/job-security
terms only. declineOffersWithLeverage now also adds +1 year to the current deal
when declined OUTSIDE a contract year (final year / no paper = stack only).
Legacy contracts keep their recruitBonus and season.js keeps honoring it — zero
migration. UI: dashboard contractBody + coachoffice ledger/notify reworded.
Proof: `contract_ladder_probe` 17/17 (offer shape, renewal stack, mid-contract
+1yr vs final-year no-extend, revenue 3-stack ≈ 30% of base + 12≡10 cap, legacy
paper untouched), player_retention 16/16, coordinator_identity 30/30, tree 79/79,
save_migration ALL PASS, build 13/13, boot 0 pageerrors. Registered core tier.
NOTE: this pass also RE-APPLIED the 2026-08-10 release hardening (a11y names,
overlay inert, save backup ring + both probes) which had been lost when a
parallel session's working copy overwrote app.js/persistence.js/mainmenu.js/
newgame.js — re-verified green in this build.

Original build notes (corrected 2026-08-11 after code verification): the campaign ALREADY
SHIPPED most of this — loyalty raises live in recruiting.js (`retentionStacks`,
+10% of C.ECON.BASE[div] per declined call, cap 100%, forfeited on climb in
season.js) and a full extension system lives in offseason.js (`getExtensionOffer`:
Prove-It/Market/Max terms, per-signing recruitBonus, juice multipliers,
Contract & Signing Day stage). The REMAINING DELTA of this ruling is small:
(1) tie the +10% bump to contract RENEWALS too, not only declined calls;
(2) a declined outside offer outside a contract year also adds +1 YEAR to the
current contract; (3) decide at build whether the simple ladder REPLACES the
recruitBonus/juice term structure or sits beside it (owner call when the offer
sheet is on screen). Sanity check: bumps × D4 retention cost through the
class-quality probe.

## 7. Layer 4 — the retirement ceremony

One modal sequence at career end; every beat backed by an existing system:

1. **The Record** — career line; epitaph from `dnaTitle` (becomes his tree-ledger
   title — already the ledger's shape).
2. **The Deeds** — stars/💎 reached this career (pure-XP tiers, per D1/D2).
3. **The Games** — 3–5 career-defining games; `instantclassics.js` + `highlights.js`
   already identify and store these.
4. **The Harvest — RULED (D8): retire 1.0 / quit ~0.6 / fired ~0.4** (exact values
   tuned at build). `bankIntoTree` **already takes `opts.share`** (and
   C.TREE.BANK_SHARE exists at the handoff path, tree.js:678) — a real reason to
   survive the hot seat.
5. **The Succession** — the one interactive beat: seat the next man from your
   mentored coordinators (sheets + seasons-served inheritance shown; the promise
   shapes who stands there and how they feel). Pick inherited axes up to ★★.
6. **The World Responds** — retirement WRITES LORE-FORMAT EVENTS (the longevity
   program's living-ledger thread, owner loves): a qualifying tenure appends a legend
   era in the exact `generateProgramLore` event shape; long-enough legends get the
   field named; news feed carries it. His career becomes indistinguishable from the
   generated backstory — the 50-year thesis in one screen.

## 8. Prerequisite: the age system

Coaches (HC + coordinators, player + AI) get ages rolled at generation and a
retirement window (curve at build, D9). Gives runs a natural clock, the ceremony a
trigger, and fixes a real carousel bug: retirement currently checks `tenureSeasons`,
which `cascadeCarousel` **resets to 0 on every poach** (season.js ~2197) — hot
coaches can never retire. Age-based retirement replaces tenure-based. Ride-along from
the longevity list (cheap, same files): unify the AI-HC name pool (world.js
`generateAICoach` uses 10×10 names; lore.js/staff.js pools are 75+) with world-scoped
dedup — 50-year worlds currently guarantee duplicate Mike Smiths.

## 9. Guardrails + probes

- **tree_advantage_probe (new, the enforcement of the one law):** scripted
  equal-decision careers, max tree vs no tree; the win-rate delta must decay toward
  ~0 by season N. Run it whenever any tree reward changes.
- stat_realism A/B required for: HC mastery outcome effect (+ stacking cap), rust
  (AI-side), aging carousel changes, and the D3 skill un-fold (effects re-point).
- **AI retention symmetry — RULED (D7): add ONLY if the sim needs it.** Decide
  empirically: if carousel churn / band health degrades with player-side retention
  live and no AI counterpart, add the simple prob rule; otherwise skip. Default:
  skip.
- Class-quality probe for the retention budget deduction (budget moves classes).
- Save migration law: existing tree DNA re-buckets through the new grade curve;
  recruiter/developer DNA XP folds back to skills via floor mapping (§4);
  coordinator schemeIQ untouched; null-guards everywhere; no SAVE_VERSION bump.

## 10. RULINGS (owner, 2026-08-10 — complete)

- **D1.** Stars: **pure XP.** No deed gating.
- **D2.** 💎: **pure XP.** No signature-deed requirement.
- **D3.** Recruiter + developer: **return to the old skills system** alongside Roots
  and Reputation. Overriding constraint: don't break anything. Deeper redesign
  deferred — owner will figure the rest out later.
- **D4.** Retention: **triggered only by a job offer** (poach event). Player may pay
  **10% off next season's recruiting budget** to keep him. (Base-of-10% one-line
  confirm at build — §5b.5.)
- **D5.** Succession promise: **money only — this system's single currency — and the
  promise is important enough to cost.**
- **D6.** Contracts (revised 2026-08-11): **the loyalty ladder** — base division
  allocation at every school; each renewal +10% budget, cap +100%; a rejected
  outside offer mid-contract = +1 contract year + the 10% bump. A visible wrapper
  on the shipped retention economy; no mandates/bonuses/buyouts (run-seed concept
  rejected — doesn't fit the roguelite). See §6.
- **D7.** AI retention: **only if the sim needs it** (probe-decided); default skip.
- **D8.** Harvest shares: **approved** (retire 1.0 / quit ~0.6 / fired ~0.4, tuned
  at build).
- **D9.** All numeric tuning (age curves, rust rate/floor, HC-mastery baseline +
  stacking cap, star XP thresholds, promise price): **set at build, probe-verified.**
- **D10.** Sequencing: **tree rework first.** Owner confirms the brain-expansion
  queue ahead of it is done; one final viewer update (owner's own, tonight) precedes
  the "go."

## 11. Build order (each pass = probe → stat_realism → build → boot, house loop)

1. **Age system + carousel tenure-fix + name-pool unification** (prerequisite,
   self-contained)
2. **Star ladder recut + crest UI** + **D3 skill un-fold** (recruiter/developer back
   to skills; migration mapping; nothing breaks)
3. **Coordinator identity: ledger writer, card, hire surfacing, rust, Climber/Lifer,
   retention (D4 rule) + succession promise (D5)**
4. **HC formation mastery + stacking cap** (the one outcome-touching piece; gated)
5. **Succession + ceremony + lore-format world writes**

Contracts (D6, revised 2026-08-11): the loyalty-ladder wrapper builds inside or
beside pass 3 (see §6). Deferred: recruiter/developer deeper redesign (D3), AI
retention symmetry unless probes demand it (D7).
