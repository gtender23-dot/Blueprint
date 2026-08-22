# Conference title games
**2026-08-22 · owner build · PLAYTEST_2026-08-12 item 17, option L**

That note listed three options for the empty day 19 and took S+M — truthful
labelling and moving the bracket build — while sizing L, real title games, as
"a genuinely new feature that touches schedule generation, standings, SOS,
seeding, the season rail and save migration; it deserves its own pass."

This is that pass. Saves were explicitly out of scope (owner: *"saves don't
matter yet"*).

---

## What day 19 was

`CONF_GAME_DAYS` ends at 18, so **no game was ever scheduled on day 19**.
Conference champions were picked by regular-season conference win pct, and the
prestige and budget bonuses were awarded on record alone. The week was named
*Selection Week* precisely because nothing was played in it — the season rail
even special-cased the day to suppress a "BYE" chip, i.e. the code knew the week
was empty.

## What it is now

Each conference splits into **two halves**, the half-leaders meet on day 19, and
the **winner is champion and takes the automatic playoff berth.** The loser drops
into the at-large pool and gets in on merit or not at all.

### The halves

`school.confDiv` — `"West"` / `"East"` — assigned in worldgen by longitude.

> **Read that field name twice.** `school.division` already exists and means
> **D1/D2/D3**. The conference half is `confDiv`. Confusing the two would be a
> very quiet bug, which is why the half is not called `division`.

Longitude was chosen because conferences are already built around a region, so
the halves come out geographically sensible with no new authored data, and a
custom league gets them for free. Conference sizes are forced even upstream
(`if (PER_CONF % 2 !== 0) PER_CONF++`), so the split is clean; ties break on
school id so a seeded world always splits the same way. Measured on a default
world: **29 conferences, every one 6/6.**

### The integration, which is the good part

The title games are appended to `state.schedule` as **ordinary game entries**, at
the top of the day-19 advance, before anything reads that day's slate.

That is the whole trick. The existing day loop sims them. The coached-week path
lets the player call his own. Standings, stats, SOS and records book themselves.
Nothing in schedule generation had to learn that day 19 exists, and there is no
parallel "title game" code path to keep in sync with the real one.

### Who plays, and who hosts

The same tiebreak ladder the champion pick has always used — conference win pct,
then overall wins, then head-to-head, then roster strength — now applied within
each half. Better record hosts.

### The champion

`buildPlayoffBracket` takes the title-game winner. It falls back to the old
best-conference-record pick only when no title game was played — a league too
small to field two halves, or a bracket rebuilt on a pre-title-game save.

---

## What it does to a season

Measured across 3 full seasons, 87 title games:

| | |
|---|---|
| upsets (the lower seed won) | **24 of 87 — 28%** |
| title-game losers who still made the field | 20 |
| **title-game losers left out entirely** | **67 — 77%** |

That 77% is arithmetic, not cruelty: a 16-team field with ~10 conferences per
division leaves ~6 at-large spots for every non-champion in the division. What
changed is that a team which would previously have been champion *by record* can
now lose one game and land in that scramble.

**This is the owner's choice working as specified** — "winner takes the auto
berth", chosen over "both still in". Flagging the number because 77% is a hard
edge and it is worth knowing before a playtest, not after.

---

## Naming

Day 19 is no longer a selection week, so it stopped being called one:

| where | was | now |
|---|---|---|
| `PHASES.CONFCHAMP.label` | Selection Week | **Championship Week** |
| `calendarWeek(19)` label / short | Selection Week / SEL | **Championship Week / CHAMP** |
| `getPhaseLabel()` (season phase) | Conf. Championship | **Championship Week** |
| `schedule.js` (a single GAME) | Selection Week | **Conference Championship** |
| dashboard next-game tag | Selection Week | **Conference Championship** |

Note the deliberate split: a **period of the season** and a **single game in it**
are different nouns. "Championship Week" is the week; "Conference Championship"
is the game. Do not unify those tables.

`getPhaseLabel` had also been quietly contradicting the engine before any of
this — it called day 19 "Conf. Championship" for a week with no game in it, so
the game announced a championship that did not exist, and it had "Conference"
and "Offseason/Jobs" where the engine said "Conference Play" and "Offseason".
Aligned (owner's call on both).

---

## Guarded by

`conf_title_probe` (core, drives a REAL season through `advanceDay`, ~600s):

- **A** every conference splits into two non-empty, balanced halves that sum to
  it, and the same seed splits the same way twice — the split must not become a
  second source of worldgen drift;
- **B** exactly one title game per conference on day 19, between the two
  half-leaders, never a team against itself;
- **C** the games were played *by the normal day loop* — which is the check that
  the "ordinary schedule entry" integration actually holds;
- **D** every champion won its title game;
- **E** no title-game loser is a champion.

19 pass / 0 fail: 29 conferences, 29 title games, 29 champions. Section F adds
the schedule laws — exact game count, everyone plays their whole half, no team
booked twice in a day, the slate is not identical two seasons running, and home
and away stay balanced (the old round robin's quiet guarantee, which a rewrite
is exactly the thing that would break it).

## The conference schedule now plays the halves

Shipped the same day, on the owner's call, because a half-leader that never
played its own half is a fiction — you could win your division without beating
anyone in it.

**The counts land exactly, which is why it was worth doing rather than
retuning anything.** `CONF_GAMES` is 8 across 9 day slots, and conferences are
10 or 12 teams (sizes forced even upstream), so halves are 5 or 6:

| half | intra | crossover | total | slots used |
|---|---|---|---|---|
| 6 | 5 rounds, you play all 5 | 3 rounds | **8** | 8 of 9 (one spare keeps the bye-week pick) |
| 5 | 5 rounds, one bye each → 4 games | 4 rounds | **8** | 9 of 9 |

Both hit `CONF_GAMES` on the nose. No constant moved.

**Season rotation moved to the crossovers**, which is the football-true place for
it: your division slate is fixed and you play it every year, while which teams
you draw from the other side rotates. Rounds are interleaved so a conference is
not five division weeks followed by three crossovers.

A conference whose halves are missing, empty or unequal falls back to the old
whole-conference round robin — a real fallback, not an error, and it agrees with
the title game's own fallback to champion-by-record.

### Measured against the old scheduler, same seed

| | old | new |
|---|---|---|
| conference games per team | 8 (all 340) | **8 (all 340)** |
| conference home games | 3/4/5, mean 4.00 | **3/4/5, mean 4.00** (fewer at the extremes: 31 vs 35) |
| slate-strength spread (sd) | 11.07 | **10.83** |
| S1→S2 matchup repeat | 84% | **83%** |
| teams booked twice in a day | 0 | **0** |
| teams missing someone in their own half | — | **0** |

Balance-neutral on every measure, marginally tighter on two, and it delivers the
property it was built for. Stat bands re-checked after: plays/team 71.7,
run% 52.7, sacks/team 2.06, yds/attempt 6.93, INT% 1.99, turnovers 1.49 — all
inside their real-football ranges, as expected, since this changes who plays
whom and not how a snap resolves.

## Still open
- **Small or hand-authored conferences.** One that cannot field two equal halves
  silently takes the old round robin and champion-by-record. No default world
  produces one; a custom league could.

## Verification
`conf_title_probe` 14/0 · `calendar_display_probe` PASS end to end (it was one of
the standing gate reds and is now green through the rename) · `season_mode_probe`
· `season_persist_probe` · `instant_classic_probe` · `multicoach_week_probe` 16/0
· `career_firing_probe` · `ceremony_probe` 28/0 · `tree_advantage_probe` 11/0 ·
`prestige_trajectory_probe` 9/0 · `hc_mastery_probe` 15/0 · `worldgen_check` ALL
CHECKS PASSED · `gate_teeth_probe` · `seed_hygiene_probe`.
