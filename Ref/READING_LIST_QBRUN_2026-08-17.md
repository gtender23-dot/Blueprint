# Reading List — QB-run / RPO / scramble rate research (2026-08-17)

**STATUS: DRAFTED, AWAITING OWNER APPROVAL. NOTHING HAS BEEN FETCHED.**
Per `Ref/SIM_RESEARCH_PROJECT.md` ("owner approves before use"), this is the
proposal only. Answer with source numbers (approval list at the bottom) and
the fetch/extract pass runs on exactly those.

Purpose: firm the D5 audit's provisional target bands
(`Ref/RPO_AUDIT_2026-08-16.md` §3/§5C — PFF/ESPN/FantasyPoints NFL-floor +
"college is higher" inference) with real college rate statistics. Truth is
still decided by the probes (`rpo_probe`, `stat_realism_harness`); this pass
only retunes the bands the probes assert.

---

## What needs pinning (the bands, and the two D6 flags)

| id | band (scrambler / dual / pocket) | current basis |
|----|----------------------------------|---------------|
| B1 | designed QB runs/g: 8–12 / 5–8 / 0–1 (+sneaks; option floor 5–12) | ESPN "47 FBS QBs ≥50 designed runs" |
| B2 | scrambles % of dropbacks: 8–12 / 5–8 / 1–3; college league avg > NFL ~4% | FantasyPoints/statrankings, NFL |
| B3 | RPO share of snaps, RPO-fit formations: 20–30 / 15–25 / 8–15 | PFF 21.8% of ALL P4 plays |
| B4 | RPO keep share of RPO snaps: 10–15 / 5–10 / ~0 | pure inference — NO source yet |
| B5 | RPO throw (pull) rate ~25% | PFF, NFL seasons |
| B6 | scrambles ~75% pressure-coupled (clean-pocket ~25%) | PFF, NFL charting |
| F1 | **D6 flag (a):** widened Dual (legLean −14..−3) scrambles 3.5–4.5% vs the 5–8% band — is the BAND wrong for the physically slower class, or the rate low? Needs scramble rate vs mobility as a gradient, not a binary. | probe observation |
| F2 | **D6 flag (b):** pocket "designed" ≈1.4/g includes ~0.5 broken-play/Empty floor keeps (true designed ≈0.9 vs 0–1). Needs a real pocket-QB carry floor (ex-sneak, ex-scramble) to judge the residue. | probe observation |

**Method caveat that applies to every official-stats source:** NCAA rushing
counts sacks as negative rushing attempts, and public att/g mixes designed
runs + scrambles + sneaks. So official tables give an UPPER bound / joint
constraint on B1+B2 after a sack add-back — the split still has to come from
charting sources or the play-text mine (#1).

---

## Candidate sources, ordered by expected value

1. **CollegeFootballData.com API (+ cfbfastR / cfbfastR-data mirrors)** —
   collegefootballdata.com; free key-gated API; FBS play-by-play + player
   game logs, the cfbfastR ecosystem mirrors it as flat files.
   *Pins:* the per-QB rushing att/g DISTRIBUTION across all FBS starters
   (sack-corrected) → **B1** all three cells + **F2** (the real pocket-QB
   carry floor); a play-text mine for "scramble"/keep phrasing to test
   whether **B2** is computable from public pbp at all (feasibility check,
   promised to nobody). Also the reusable harness for every later re-check.
   *Confidence:* HIGH the att/g distribution is there; LOW-MED the scramble
   split (ESPN pbp text tags scrambles inconsistently).

2. **Sports-Reference CFB player tables** — sports-reference.com/cfb.
   *Pins:* a named-exemplar att/g ladder across the mobility spectrum —
   service-academy option QBs (the 5–12 option floor), known scramblers,
   known statues — with the sack add-back from the passing tables →
   **B1** band edges, **F1** (mid-mobility "dual" QBs' real volume),
   option floor. Archetype labeling is ours, and that's fine: exemplars
   anchor band EDGES, the #1 distribution anchors the middles.
   *Confidence:* HIGH the data is there.

3. **PFF free college content** — pff.com news/draft articles: the
   scrambling series ("Components of Quarterback Play: Scrambling" —
   already seeded §3), college RPO pieces (the 21.8% P4 anchor), and draft
   profiles that quote designed-run/scramble counts for college seasons.
   *Pins:* college scramble-rate leaders + any quoted league mean →
   **B2** top band + league average; whether the ~75% pressure-coupled
   figure (**B6**) is ever stated for COLLEGE rather than NFL.
   *Confidence:* MED — leaders yes, the per-archetype distribution is
   Premium (paywall note below).

4. **Fantasy Points prospect/college pieces** — fantasypoints.com
   ("Statistically Significant" seeded §3 for NFL; their draft-prospect
   work often splits college designed runs vs scrambles per QB).
   *Pins:* per-prospect college designed/scramble splits → **B1/B2**
   scrambler-cell exemplars; occasionally RPO usage notes.
   *Confidence:* MED.

5. **Coaching-clinic RPO material (the library's home turf)** — X&O Labs
   free reports, Surface To Air System (Hargitt) articles, USA Football
   RPO pieces — same genre as SOURCE_LIBRARY #45's taxonomy.
   *Pins:* coach-charted give/throw/keep ratios and whether a KEEP is even
   tagged as a distinct phase → **B4** (the ONLY public line on keep share
   anywhere), **B5** confirmation, **B3** call-share targets. Hypothesis-
   grade by the project rule (blogs generate hypotheses, probes decide) —
   but B4 currently rests on nothing at all, so a coach's target ratio is
   strictly better than our inference.
   *Confidence:* MED that usable ratios exist ("60/30/10"-style lines are
   common clinic material).

6. **Existing CFBD-based public studies** — Game on Paper
   (gameonpaper.com), cfbfastR blog posts / GitHub notebooks; someone may
   already have done #1's scramble text-mine or an RPO proxy study.
   *Pins:* any published college scramble-rate estimate → **B2** league
   average + distribution, saving #1's mining effort if it exists.
   *Confidence:* LOW-MED — search-first item; list what turns up before
   fetching deep.

7. **ESPN analytics** — QBR methodology pages (QBR internally separates
   scrambles from designed runs) + follow-ups to "How running QBs changed
   the NFL" (seeded §3).
   *Pins:* any published college scramble/designed split from the QBR
   team → **B1/B2** cross-check.
   *Confidence:* LOW — the methodology is public, per-QB splits rarely are.

8. **statrankings.com scramble boards** (seeded §3) — re-pull only as the
   NFL floor CONTROL for **B2** (college must land above it).
   *Confidence:* HIGH for NFL, ZERO college content. Low priority; approve
   only if the fetch pass wants the control refreshed.

## Paywalled — noted for what they'd add, NOT listed for approval

- **PFF Premium Stats** — per-college-QB scramble %, designed-run counts,
  RPO snaps/reads. Would pin **B1–B6 outright**; this whole list is a
  public approximation of that one dataset.
- **SIS Rookie Handbook** (book) — per-prospect college charting incl.
  designed runs / scrambles / RPO involvement.
- **The Athletic** draft charting — occasional per-prospect splits.

---

## ⚑ APPROVAL (phone-readable — answer with numbers)

1. CFBD/cfbfastR distribution pull (B1, F2; B2 feasibility)
2. Sports-Reference exemplar ladder (B1 edges, F1, option floor)
3. PFF free college articles (B2 top/avg, B6)
4. Fantasy Points prospect splits (B1/B2 exemplars)
5. Clinic RPO ratios — X&O Labs / S2A / USA Football (B4, B5, B3)
6. Existing CFBD-based studies (B2, may shortcut #1)
7. ESPN QBR splits (B1/B2 cross-check)
8. statrankings NFL control refresh (B2 floor)

Recommended minimum: **1, 2, 5** (the distribution, the edges, and the only
B4 line). Reply e.g. "approve 1,2,5".
