# Plan of Record — Unifying Coaching Skills & DNA

**Status:** ~~Design approved in part; some items still open (flagged below). **No code written yet.**~~
> **STATUS UPDATE — 2026-08-13 (verified against code): SUBSTANTIALLY SHIPPED.** The "no code
> written yet" line is stale. `DNA_AXES` is now purely the on-field identity
> (groundPound, airAttack, pressure, ballHawk, ballSecurity, discipline, riverboat,
> roadWarrior, specialTeams, adjustments — `motivator` cut 2026-08-12), i.e. the two
> competing cards are un-confused. Decision #1 (evaluator → folded into Recruiting, OFF
> the DNA card) is live: `evaluator` runs in `recruiting.js` (`skillGradeIndex` /
> `addSkillXP`), not on the crest. `developer` and `recruiter` were explicitly cut from
> `DNA_AXES` and returned to the program tab (see the code comment in coachprofile.js).
> Any remaining open items are the fine-grained ones flagged inline below — verify each
> against code before treating it as work.

---

## The problem we're solving

The game currently has two overlapping identity systems that confuse the player:

- **Coaching Skills (5):** `evaluator, recruiter, developer, reputation, roots` — the
  program-building meta-game (scouting, recruiting, development, standing, territory).
  Earned from ~30 management triggers. None affect the on-field sim.
- **DNA (11 axes):** `groundPound … motivator` — the on-field identity, read directly by
  the simulation. Earned from per-game / per-season achievement badges (already
  milestone-shaped).

They *look* redundant on the two competing cards in the Coach's Office, but they're
mechanically opposite: "how good you are at running a program" vs. "what kind of football
your teams play." The goal is **one coherent identity system**, less confusion, without
breaking the sim's calibration.

---

## Decisions locked

### 1. Evaluator → folded into Recruiting (OFF the DNA card)
`evaluator`'s only real job is board-read accuracy before scouting (`displayedRating` in
recruiting.js: pulls your read toward a recruit's truth rating and shrinks the noise; also
unlocks see-without-scouting at grade ≥4). It is a recruiting attribute, not an on-field
identity trait, so it becomes a **recruiting stat living inside the recruiting system** —
not shown on the DNA/identity card at all. Its sim effect stays exactly as-is.

- **Its earn triggers move with it into recruiting:** scout a recruit (`XP_SCOUT`), scout a
  gem (`XP_SCOUT_GEM`), successful position conversion (`XP_CONVERT_HIT`).
- Net player-facing result: the recruiting screen owns "how well you read talent"; the
  DNA card stops carrying it.

### 2. DNA earning = the milestone/achievement model (already true, made consistent)
DNA XP already comes almost entirely from milestone-shaped achievements (per-game badges
like 200-yd rusher / 5-sack game / shutout; per-season badges like undefeated / conf champ
/ natty). **The one outlier is the `adjustments` axis**, which pays a flat per-game trickle
(+6 if the halftime adjustment worked, +1 if not) regardless of achievement.

- **Change:** convert `adjustments` to a milestone/achievement so *every* DNA axis earns the
  same way — by doing notable things, not passive drip. (Exact milestone definition TBD, e.g.
  "a halftime adjustment that flipped a game," rather than every-game payout.)

### 3. Named milestones follow their trait
Rule: **a named milestone moves to DNA iff the trait it feeds moves to DNA.**

| Named milestone system | Currently feeds | Under the plan → |
|---|---|---|
| `MILESTONES` (player stat marks) | developer skill | Moves to DNA **with Developer** (if Developer folds — see Open #1) |
| `awardDevelopmentXP` (raisers/finishers) | developer skill | Moves to DNA **with Developer** |
| `PROGRAM_MILESTONES` (career wins, titles, natty, perfect season) | reputation skill | **Stays with Reputation** (separate — not an on-field identity axis) |
| Evaluator scouting triggers | evaluator skill | Moves **into Recruiting** (decision #1) |

No milestone is orphaned; none double-counts. Each follows its trait.

### 4. Personal DNA pacing — UNCHANGED
Maxing a coach's signature (lead) axis should remain a full career:
- Focused-identity coach (~70 XP/yr on lead axis): identity forms (G3) ~4 seasons, G5 ~9,
  **MAX (G10) ~29 seasons**.
- Dominant, milestone-hitting coach (~110/yr): G3 ~3, G5 ~6, **MAX ~19 seasons**.
- A maxed axis = a two-decade legend who did one thing better than anyone. Keep as-is.

### 5. Shared tree DNA — live trickle raised to 20%
The shared pool (the family DNA) has two inflows:
- **Retirement (the harvest):** a coach banks his FULL career at once (`BANK_SHARE: 1.0`).
  Dominates the long-run fill — 3 retirements over 40 seasons max an axis on their own.
- **Live trickle:** a share of each active coach's NEW growth per season, read-only against
  him (never boosts an active coach's sim; only seeds promoted coordinators via inheritance).

**Change: `TRICKLE_SHARE` 5% → 20%.** Rationale from the dynasty model:
- At 5% the pool is a rounding error early — ~G0 after 10 seasons of a founding coach; the
  family DNA is invisible until the first retirement.
- At 20% the pool reaches ~G2 on the signature axis within a founding coach's career, so the
  first promoted coordinator feels a real head start **before** any retirement — the "family"
  mechanic works from the start.
- Still ~5× slower than personal DNA (coach earns 70/yr on his axis; pool gets 14/yr), so it
  stays "harder to fill than personal," honoring the original rule.
- Endgame unchanged: retirements still dominate the long-run fill and stay the big legacy
  moment.
- **Zero sim-balance risk** (pool never feeds active coaches' sims) — needs an inheritance
  probe, not the full sim-gate suite.

---

## Open items (need a decision before build)

### Open #1 — Does Developer fold into DNA as an axis?
Developer controls player-growth speed (a real sim consumer in development.js). It's a
genuine coaching trait, so it *can* become a DNA axis (its milestones would move with it, per
#3). But it's not an on-field *play-style* axis like the other 11 — it's a program-building
trait. Two options:
- **1a:** Fold Developer into DNA as an axis (one card holds play-style + developer). Its sim
  effect stays wired; milestones move with it.
- **1b:** Keep Developer as a program-building stat alongside Recruiter/Reputation/Roots (only
  the play-style axes live on the "DNA" card).

### Open #2 — Does Recruiter fold into DNA, or stay a recruiting stat like Evaluator?
Recruiter controls recruiting pull/contact. By the same logic as Evaluator (decision #1), it
may belong *inside recruiting* rather than on the DNA card. Options:
- **2a:** Recruiter → recruiting stat (mirrors Evaluator). Clean: recruiting owns evaluator +
  recruiter; DNA is identity only.
- **2b:** Recruiter → DNA axis.

### Open #3 — Where do Reputation and Roots live?
Both straddle the line (already flagged). Reputation is read in 4 places (recruiting pull,
gate revenue, hot-seat gate, tree promote-floor) and starts at grade C — it behaves like a
career meter, not a cultivated trait. Roots is a pure local-recruiting geography bonus.
Options previously laid out:
- **A (recommended earlier):** Keep Reputation + Roots as a small separate "Standing &
  Territory" pair. DNA card = identity traits only.
- **B:** Fold both into DNA as axes (truly one system, but they behave unlike the sim axes).
- **C:** Roots → DNA axis; Reputation stands alone as a single career meter.

### Open #4 — Earn-pacing for any folded skill axes
If Developer/Recruiter become DNA axes, their XP curves (13-step skill ladder) must reconcile
with the DNA 0–10 grade scale. Decision deferred: "decide after seeing the merge." The three
folded axes' displayed grade numbers will shift onto the DNA scale — the sim effects must be
proven identical afterward (progression/recruiting/stat-realism gates).

---

## Build sequence (once opens are closed)

1. **Evaluator → recruiting** (decision #1, low risk, self-contained). Move the stat + its
   earn triggers into the recruiting system; remove from the DNA/skills card.
2. **Trickle 5% → 20%** (decision #5, one constant + inheritance probe).
3. **Adjustments → milestone** (decision #2, replace the per-game drip with an achievement).
4. **Resolve Opens #1–#3**, then fold the agreed skills into DNA, moving their named
   milestones with them (decision #3).
5. **Reconcile ladders** (#4) and run the full gate suite (build, boot, tree_probe,
   trickle probe, w9_tree_smoke, worldgen/recruiting/progression/stat_realism) to prove the
   sim is unmoved.

---

## Verification gates (every step)
`node tools/build.mjs` · `_boot_check` · `tree_probe` (79/79) · `tree_trickle_probe` ·
`w9_tree_smoke` · then `worldgen_check` / `recruiting_check` / `progression_check` /
`stat_realism_harness` must stay unmoved for any change touching the sim.
