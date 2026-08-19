# PRESSURE REDESIGN — the blitzer list (design note, 2026-08-19)

**Supersedes the pressure pie** (`Ref/BLITZ_PIE_PLAN.md`) and rewrites OD-P1
through OD-P4 in `Ref/COHESION_AUDIT_PRESSURE_2026-08-19.md`. Design only —
nothing built. Owner-driven, arrived at by working the failure cases.

---

## Why the pie is being replaced

The owner's report: *"blitz share pie is clear when it's used properly. It's not
clear when someone sets 1 guy to 100% and then wants to bring the house, and
then has no calls in the playbook to accommodate it."*

The audit found the field means four different things at once:

| who | thinks `blitzShares` is |
|---|---|
| `BLITZ_PIE_PLAN.md` | one combined pie summing to 100 |
| the Depth Chart UI | not normalized at all (only OFFENSIVE shares are) |
| Simple mode | writes `100` to each of up to **three** slots |
| the sim | relative weights in a lottery for **one** rush seat |

So a coach who sets three men to 100 sees "all three blitz" and gets 33/33/33
for a single seat. The one-man-at-100 case is the same defect in miniature: it
does not mean "he comes", it means "if a blitz fires, he is the first extra".

**The deeper error: the pie was answering the wrong question.** "Who attacks the
QB" is mostly a PERSONNEL question and the Depth Chart already answers it — a
man in a DE slot rushes every down, and passing-down fronts exist to put your
best rushers on the field. The pie's real and much narrower job is *which
COVERAGE player abandons his coverage to come*. Those are two different
questions and one percentage widget was doing both.

---

## The model: three questions, one owner each

The system's core problem is that HOW OFTEN, HOW MANY and WHO were each split
across several surfaces. The redesign gives each exactly one owner.

| question | owner | surface |
|---|---|---|
| **How often** does pressure come? | the aggression stop | Game Plan ▸ Defense |
| **How many** come? | the card's `bring` (seats), else the identity | the playbook / posture |
| **Who** comes? | **the blitzer list** | Game Plan ▸ Defense |

### The blitzer list

A short list of names with a two-step frequency label. No percentages, no sum
constraint, no ordering, no dial — a chip you tap to cycle.

> **Often:** SAM · WILL
> **Sometimes:** STRONG SAFETY

- **Empty list = Auto.** The coordinator picks by grade — byte-identical to
  today. Every AI team and every casual coach lives here and never opens it.
- **Off-list players can still be sent occasionally** (owner call: a preference,
  not a law). Rate tied to the DC's **Blitz Design** — a sharp coordinator stays
  on script, a poor one improvises. Two reasons this is right rather than merely
  softer: an exclusive list BREAKS when its men are not on the field (Dime
  package, injury, fatigue rotation), and a fully deterministic list is fully
  scoutable by an opponent with memory.
- **Unranked, on purpose.** Ranking would put the first name in seat one every
  time, which destroys the rotation case below.

### The seat logic does the work

Seats = how many extra rushers this pressure sends. The list fills them.

| list vs seats | behaviour |
|---|---|
| more names than seats | **rotation** — nobody's tell is readable |
| names = seats | deterministic, the same men every time |
| one name, one seat | he comes on every pressure |

**Every owner case, checked:**

- *Two OLBs alternating* → both **Often**, one seat. They split it.
- *…plus a stud safety occasionally* → safety **Sometimes**. He shows up
  periodically without becoming a co-starter. **This case is why a flat
  unordered set was not enough and the two labels exist.**
- *Everyone evenly, to disguise* → list everyone **Often**. Uniform.
- *Bring the house* → a card with more seats; the list fills them all.

**Often : Sometimes weighting** ≈ 3:1 as a starting point, [TUNE] by watching
games — a probe reports the realized split rather than anyone asserting it.

---

## What else changes to go with it

The list is not a drop-in. Four further changes fall out, and skipping any of
them leaves the old incoherence in place.

### 1 · `bring` becomes SEATS, not an aggression stop *(rewrites OD-P1/P2)*

Today `DEF_CALL_BRING` maps bring 4/5/6 onto balanced/attacking/house, so
"Bring 5" sends four rushers on **64%** of snaps (measured, n=751). Under the
new model the three questions have separate owners, so the card can finally own
count honestly: **bring 5 = one extra seat, bring 6 = two.** The list fills
them. Rush 3 keeps its current absolute meaning; Rush 4 becomes a real
four-man rush instead of blitzing 23% of the time.

This resolves OD-P1 and OD-P2 together, and it is the change that makes a
called card mean what it says.

### 2 · HEAT retires *(dissolves OD-P3)*

Per-front HEAT is a SECOND owner of "how often", keyed to a front, silently
absent on 28% of passing downs, and it multiplies headset calls with no
"unless called" guard — the OD-P3 conflict. With the aggression stop as the
single owner of rate, heat has no job left. Retiring it removes the conflict
rather than adjudicating it.

Coaches who want front-specific rates already have the right tool: a
**situation** pinning a front and an aggression together.

### 3 · The 🛡 drop half of the pie retires with the ⚡ half

The combined pie also allocated fire-zone drop slices. Drops belong to the
pressure IDENTITY (`fireZone` already exists) and to tier-3 cards, not to a
standing per-front allocation. The everyday bail rate is unchanged.

### 4 · Identity and the list must not both own "who" *(new — not in the audit)*

`pressureIdentity` (fireZone / secondLevel / secondaryHeat / theHouse) is
partly a statement about WHO — backers versus defensive backs. The list now
owns who, so the two overlap. **Resolution:** identity is the AUTO answer to
"who" — used when the list is empty — and keeps owning the **coverage risk
tier** (`deepRisk`/`zeroBehind`, wired per BLITZ_MODEL_ASSESSMENT) and the
**fire-zone drop spec** in all cases. A non-empty list wins for who; identity
still sets what it costs you behind the call.

Without this, a coach with a list of safeties and an identity of `secondLevel`
would have two surfaces disagreeing about who is coming.

### 5 · OD-P4 dissolves

The list is attached to **players, not fronts**, so a pressure design no longer
evaporates when the defense auto-subs — the measured 28% of passing downs where
a dialed pie silently did nothing. This was the audit's largest item and the
redesign removes it rather than fixing it.

### 6 · Simple mode finally tells the truth

Simple mode writes `blitzShares[sid] = 100` three times today. Under the list it
writes its top rushers as **Often** — which is exactly what the screen then says.

### 7 · The AI stays on Auto (at first)

AI staffs never dialed a pie, so leaving them Auto keeps the byte-identical path
and zero band risk. Giving AI teams real blitzer lists — so a program has a
recognisable pressure man — is attractive and should be its OWN change with its
own A/B, not smuggled in here.

---

## Where it lives

**Game Plan ▸ Defense**, beside aggression and pressure style. That is the
cohesion fix in one line: all three pressure questions answered on ONE screen,
instead of two on Game Plan and the third buried in a Depth Chart panel. The
Depth Chart goes back to what it is good at — who is on the field and where they
line up.

## Migration

No faithful migration exists: per-front seat-shares and a player list are
genuinely different statements. A dialed pie is **dropped with a release note**.
Cheap in practice — the pie is opt-in and the AI never used it.

## Gates when built

`blitz_pie_probe` (rewritten for the list), `pressure_probe`,
`blitz_reality_probe`, `def_stress_probe`, `plan_cohesion_probe`,
`save_migration_check`, plus `stat_realism` bands. **Sacks/team is 2.07 against
a 1.8–2.3 target — little headroom, so every step wants its own A/B.**

The probe must pin the realized split (two **Often** + one **Sometimes** over N
pressures lands near 3:1:3), the rotation property, that an empty list is
byte-identical to today, and that a called `bring` produces exactly its seats.

## Open, for the owner

- **Often : Sometimes ratio** — 3:1 is a guess; set it by watching.
- **List length cap** — 4 names feels right; unbounded invites a 9-man list that
  means nothing.
- **A guaranteed man.** An unranked list cannot say "he always comes and the
  others rotate behind him". The cheap fix is a single optional marker on one
  name (one bit, not a rank, so percentages stay out). **Recommend deferring**
  until it is actually missed.
