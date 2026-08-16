# Blueprint Playbook Spec — what every play actually IS

**Status: REVIEW COMPLETE — every play corrected/confirmed, every question answered. Jul 2026.**
Corrections marked **(CORRECTED per Garrett)**; the full decisions + the ordered build queue are
collected at the bottom. Ready to build against.

## Why this file exists

The code currently "knows" a play as a row of stat-tilts (`concepts.js`) plus some
route/scheme geometry in the viewer (`watchphys.js`). Nothing says, in one place, *what the
play actually is in football* — who does what, where the ball goes, and why it wins or loses.
That gap is why the chalk viewer draws some plays wrong (a bubble screen looks like a generic
short catch) and why the sim's tilts are sometimes guesses.

This spec is the **source of truth for football meaning.** Both the sim (`concepts.js`,
`sim.js`) and the viewer (`watchphys.js`) should be built to match it. When they disagree with
this file, the file is right and the code is a bug — same relationship the other `Ref/` specs
have to their systems.

**How to read/correct it:** every play has a plain-English block (that's the part to check for
"is this actually how this play works?") and a structured block (the fields the code needs). If
the plain-English is wrong, fix that first — I'll re-derive the fields. Anything marked
**[VERIFY]** is where I'm least sure and most want your eye.

---

## Conventions used below

**Personnel / roles.** The offense is: QB, RB (and FB in 2-back sets), the 5 OL (LT LG C RG RT),
and the eligible receivers — outside WRs (X = weakside/split end, Z = strongside/flanker), SLOT
receivers, and TE (Y/U). "Backfield" = QB + RB/FB. Formations decide who's present (Air Raid has
4 WR and no TE; Wishbone has 3 backs and 1 WR, etc.).

**Where the ball starts.** Snapped from center to the QB (or, on a direct snap like Wildcat,
straight to the back). The QB has to *secure the snap* before he can throw or hand off — the
viewer now animates that (Jul 2026 snap-travel fix).

**Coverage families the sim uses** (7): Cover 0 (no deep safety, all-out man/blitz), Cover 1
(man with one deep free safety), Cover 2-Man (man under, 2 deep safeties), Cover 2 (zone, 2 deep
/ 5 under), Cover 3 (zone, 3 deep / 4 under), Cover 4 (quarters, 4 deep), C3 Fire Zone (3-deep
zone behind a 5-man pressure). "Man" families = Cover 0/1/2-Man. "Zone" families = the rest.

**"Beats / loses to."** Every concept is designed to attack a *specific* coverage weakness and
has a coverage that erases it. In the sim these are the `vs:` tilts (±10% max — small nudges;
personnel does the heavy lifting). This spec states the football *reason* behind each tilt so the
numbers can be checked against intent, not just vibes.

**Depths** are in yards from the line of scrimmage (LOS), the way routes are taught. The viewer
converts yards → board units.

---

## THE TWO BIG TAKEAWAYS (Garrett, review pass 1)

These are the through-lines behind most of the corrections below, and the priorities for the
work that follows:

1. **Crisper route trees.** The individual route shapes need to look like the real thing — clean
   stems and sharp breaks at taught depths, and the *right* route on the *right* man for each
   concept. Several concepts currently share fuzzy or generic geometry. A viewer that draws a
   recognizable route tree is the goal.

2. **Smarter throw timing — even on incompletions.** The QB should not release on a fixed clock
   that ignores how the route develops. The throw should time up with the route reaching its
   break/landmark — and this has to hold **even when the pass falls incomplete** (an incompletion
   is still a real throw to a real spot at a real moment, not an early dump). Right now throw
   timing is a flat per-depth constant; it should key off the target route's break time.

---

## PART 1 — SCREENS (the red-flag group)

Screens are the clearest example of the gap: the code tags them `screen: bubble|tunnel|rb` but
draws them as generic short routes. A screen is really a *designed give-up-of-the-rush*: let the
defense come, then throw behind or around them to a blocker convoy. The three are different plays
and should look and resolve differently.

### Bubble Screen  `screen: 'bubble'`  — depth: short, minWR 2

**What it is (plain English).**
A now-screen to the *perimeter*. At the snap, the SLOT receiver (or the inside man of a 2+
receiver surface) immediately runs a shallow arc *backward and toward the sideline* — the
"bubble" path — and the QB catches the snap and throws it to him almost immediately, at or behind
the LOS. It's essentially a *run play thrown outside*: the outside WR(s) on that side turn and
**block** the corner/flat defender. Success is about numbers and blocking on the edge, not the
throw. It's a built-in answer to press coverage and blitzes — if they crowd the box or bring
pressure, you've got a free man running to grass with a blocker in front.

**Assignments.**
- **Bubble man** (slot / inside receiver, playside): at the snap, open the hips to the sideline,
  drift *flat or slightly backward* (loses ~1 yd of depth), belly out ~4–6 yds wide, catch on the
  move heading toward the numbers, then turn upfield behind the WR block.
- **Outside WR(s) playside**: this is the whole play — release and **stalk-block the boundary
  CORNER** (Garrett's call: standard rules). The slot's bubble arc naturally leverages him outside
  the overhang/flat LB; the WR walls the corner from the ball.
- **QB**: catch snap, quick-game footwork, throw the bubble *now* (fastest release on the sheet).
  Ball travels laterally/slightly back — a soft, flat toss, not downfield.
- **Backside receivers / RB / OL**: OL blocks like a quick pass; backside WRs run off their men
  (clear-outs) or just occupy. RB fills protection or runs a token route.

**Where the ball goes / timing.** Thrown at ~the snap+secure (earliest throw of any pass). Catch
point is *behind the LOS*, ~4–8 yds outside the original slot alignment, ~1 yd deep. Then all
yardage is YAC on the perimeter.

**Beats / loses to.**
- **Beats:** press man (the WR block seals a corner playing tight), Cover 0 / blitz (numbers —
  they vacated the perimeter), single-high looks with a soft corner. This is why the current tilt
  is +Cover 0 / +C3 Fire Zone (blitz) — that's correct in spirit.
- **Loses to:** a corner playing soft zone (Cover 2/4) who reads it and rallies downhill — he's
  unblocked-in-leverage and tackles for a short gain; also a fast flat defender in Cover 2.
- **vs-row (RESOLVED):** set **Cover 2 to `−0.06`** (Garrett — the hard flat corner is the universal
  bubble-killer). Rest of the row stays: `C0 +.08, C1 +.05, C2-Man +.03, C2 −.06, C3 +.02, C4 −.03,
  Fire +.06`.

**Viewer geometry (what watchphys must draw).**
- New route shape `bubble`: from the slot's spot, `[{d:-1, w:+3}, {d:-1.5, w:+7}]` (× playside
  sign) — a flat/backward belly to the sideline. (Today it has NO entry and falls to generic short
  routes — this is the visible bug.)
- Ball plan: QB→bubble man as a flat lateral at ~snap+secure+0.15s, not a downfield arc.
- Playside outside WR gets a **block** behavior: move to the nearest DB and stay between him and
  the catch point (a short "engage" like the run-blocking OL already do).

### Tunnel Screen  `screen: 'tunnel'`  — depth: short, minWR 2

**What it is.** The mirror of the bubble: instead of throwing *out*, the outside WR comes *back
inside* (tunnels under) behind a wall of blockers — usually 1–2 interior OL who release downfield.
Best against a soft, hard-upfield pass rush and off-coverage — you let the DL fly past, then throw
underneath into the alley the linemen build inside.

**Assignments.**
- **Tunnel man** (outside WR playside): at the snap, take a slight jab upfield to sell a route,
  then settle/come back *inside* toward the numbers-to-hash alley; catch facing the QB, follow the
  blockers.
- **Release blockers**: 1–2 interior OL (or slot) leak out and lead up the alley inside.
- **QB**: catch snap, one-hitch, throw back inside to the settling WR (slightly later than the
  bubble — the blockers need a beat to release).
- **Rest**: sell pass pro briefly, backside clears.

**Where the ball goes / timing.** Later than bubble (~snap+secure+0.55s — blockers must release).
Catch ~at the LOS, *inside* of the WR's alignment. YAC up the middle alley behind the wall.

**Beats / loses to.**
- **Beats:** an aggressive upfield rush (they take themselves out), Cover 3/4 soft zones (the
  underneath is open) — current tilt is uniformly small-positive, which fits "good vs most soft
  looks."
- **Loses to:** disciplined rush lanes / a spy, tight man that carries the WR through the tunnel.
- **RESOLVED (Garrett):** leave the vs-row as-is (all mild-positive) — no tuning needed.

**Viewer geometry.**
- New shape `tunnel`: `[{d:2, w:0}, {d:1, w:-6}, {d:1, w:-12}]` (jab up, then back inside; × sign
  so it comes toward the middle). Distinct from the bubble's outward belly.
- 1–2 OL get a downfield "lead block" behavior up the inside alley.
- Ball: QB→tunnel man, a short inside throw at snap+secure+~0.55s.

### RB Screen  `screen: 'rb'`  — depth: short

**What it is.** The classic slip screen to the running back. The OL show pass, let the rushers
come, then release to set up a wall in the flat; the RB slips out *behind* the rush after a beat
and catches it with blockers in front. Punishes an all-out rush hardest — the more they send, the
better it is.

**Assignments.**
- **RB**: chip/fake protection briefly, then leak out to the flat (playside), turn, catch facing
  the QB, follow the OL convoy.
- **Release blockers**: 2–3 OL release late and set the wall in the flat / just past the LOS.
- **QB**: catch snap, drop as if a real pass, let the rush come, then throw *over/around* it to
  the RB (latest-developing of the three screens).
- **Receivers**: clear out their defenders deep to empty the flat.

**Where the ball goes / timing.** Latest screen (~snap+secure+0.6–0.7s). Catch in the flat behind
the LOS, then YAC behind the OL wall.

**Beats / loses to.**
- **Beats:** heavy rush / Cover 0 / fire zones (they've committed rushers, DBs are turned and
  running) — current +C0, +Fire fits.
- **Loses to:** a rush that stays in lanes and a LB/spy who reads the back; zone eyes on the QB.

**Viewer geometry.**
- Shape `rbscreen`: RB path `[{d:-0.5, w:-4}, {d:0, w:-10}]` to the flat behind the LOS.
- 2–3 OL release with a delayed "wall" lead behavior.
- Ball: QB→RB in the flat at snap+secure+~0.6s.

---

## PART 2 — QUICK GAME (short pass, non-screen)

These are fast, rhythm throws off a 1–3 step drop. They punish soft coverage and blitzes by
getting the ball out before the rush arrives.

### Mesh  — short, minWR 2, motion
**What it is.** Two crossers from opposite sides run shallow ~5 yds and "mesh" (rub) just over the
ball, dragging man defenders into a natural pick. A high-percentage man-beater; the QB reads the
crossers on the move with a corner route on top and a checkdown underneath.
**Assignments.** Two inside receivers cross shallow (~5 yds) in opposite directions, passing close
enough to rub. One outside receiver runs a corner (the high hole vs zone). RB/TE checkdown to the
flat. QB reads the drag away from leverage.
**Beats/loses.** Beats man (C0/C1/2-Man — the rub springs a crosser); soft vs zone (small negative
vs C2/3/4). Current tilt matches. Motion often sets the mesh.
**Viewer.** `CONCEPT_ROUTES` today: `['cross','cross','corner','arrow']` — **correct.** Keep.

### Slant-Flat  — short
**What it is.** A two-man quick combo: outside receiver slants in, inside receiver (or back) to the
flat — a classic high-low on the flat defender. Snap-and-throw vs press/blitz.
**Assignments.** Outside WR: slant (3 steps, break in). Inside/RB: flat/arrow. QB reads the flat
defender: he jumps the flat → throw the slant; he sinks → throw the flat.
**Beats/loses.** Beats C0/C1 and, notably, **Cover 3** (slant hits the void between the flat and
hook zone) — current row has +C3 .03, good. Loses to Cover 4 / fire zone that walls the slant.
**Viewer.** `['slant','flat','slant','arrow']` — **correct.**

### Stick  — short
**What it is.** A spacing/stick concept: an inside receiver (often TE) runs to ~5 yds and "sticks"
(sits vs zone, or breaks out vs man) while a receiver clears behind and a back runs the flat.
Answer to off-zone; easy completion.
**Assignments.** TE/inside: stick at 5 (settle vs zone, out vs man). Outside: clear (out/seam).
Back: flat. QB: stick-or-flat off the flat defender.
**Beats/loses.** Best vs **zone** (C2/C3 — it finds the soft spot); current has +C2 .04. Slightly
negative vs C4 / fire zone. Reasonable.
**Viewer (RESOLVED per Garrett).** Outside man → **clearout `go`** (or deep seam), NOT an `out`: a
vertical carries the corner away and frees the stick; an out would crowd the same boundary space.
So: `['go','stick','seam','flat']`.

### Shallow Cross  — short, minWR 2, motion
**What it is.** One receiver runs a shallow cross (drag) all the way across; a dig behind it builds
a high-low over the middle. A man-beater and a zone-mover; the drag is the outlet, the dig is the
answer vs zone.
**Assignments.** Shallow drag across (~3–5 yds). Dig behind at ~10–12. A post/clearout on top.
Back: flat/checkdown. QB works drag→dig→check.
**Beats/loses.** Beats man (C0/C1/2-Man); small negative vs zone. Current row matches.
**Viewer.** `['cross','dig','post','flat']` — **correct.**

---

## PART 3 — DROPBACK (medium pass)

Full drop (5–7 step), routes break at ~10–15 yds. These are coverage-specific answers.

### Smash  — medium
**What it is.** The quintessential **Cover 2 beater**: a hitch/quick underneath by the outside
receiver *under* a corner route by the inside receiver — high-low on the corner. If he sinks to
the corner, throw the hitch; if he sits on the hitch, throw the corner over him.
**Assignments.** Outside: hitch at ~6. Inside (slot/TE): corner at ~12–15 breaking to the sideline.
Backside: cross/dig. Back: flat. QB reads the flat-corner defender.
**Beats/loses.** **Big vs Cover 2** (+.09 — the whole point); dies vs Cover 3/4 (deep defenders
erase the corner). Current row is exactly right.
**Viewer.** `['hitch','corner','cross','flat']` — **correct.**

### Curl-Flat  — medium
**What it is.** Curl by the outside receiver with a flat underneath — a **Cover 3 beater** working
the curl-to-flat void the underneath defender can't cover both of.
**Assignments.** Outside: curl at ~12 (come back to grass). Inside/RB: flat. Backside: dig.
QB reads the curl-flat defender.
**Beats/loses.** Best vs Cover 3 (+.06); flat vs man. Current matches.
**Viewer.** `['curl','flat','dig','arrow']` — **correct.**

### Flood  — medium, minWR 2, motion
**What it is.** A 3-level flood to one side (deep-intermediate-flat) that **stretches zone
vertically** — a Cover 3 / sail beater. Someone is always open at the level the defender vacates.
**Assignments.** Playside: deep (go/corner), intermediate (out at ~10–12), flat (back/TE). Often
built off play-action or a roll. QB reads high-to-low on the flood side.
**Beats/loses.** Big vs Cover 3 (+.08) and fire zone (+.05); negative vs man. Current matches.
**Viewer.** `['go','out','flat','cross']` — **correct** (deep-int-flat stretch).

### Y-Cross  — medium, motion
**What it is.** The TE (Y) runs a deep crosser (~15+) behind clearing verticals — a rhythm shot
over the middle that hits man and single-high void.
**Assignments.** Y: deep cross ~15. Outside: go clearouts. Backside: comeback/dig. Back: flat.
QB times the crosser into the middle.
**Beats/loses.** Beats C1/C3 (voids over the middle); negative vs Cover 4. Current matches.
**Viewer.** `['go','deepcross','comeback','flat']` — **correct.**

### Dagger  — medium, minWR 2
**What it is.** A dig (in-cut) under a clearing seam — the seam runs off the deep-middle/hook
defender so the dig comes open behind him at ~12–15. A Cover 3 / single-high beater.
**Assignments.** Inside: seam vertical (clearout). Outside: dig at ~12–15 behind it. Backside:
go/comeback. Back: check. QB reads the seam's effect, throws the dig.
**Beats/loses.** Beats Cover 3 (+.06) and C1; negative vs Cover 2. Current matches.
**Viewer.** `['seam','dig','go','arrow']` — **correct.**

---

## PART 4 — SHOT PLAYS (deep)

### Four Verts  — deep, minWR 3
**What it is.** Four vertical routes that stress every deep zone; vs 3-deep the seams win, vs 2-deep
the inside seams "bend" to the post over the safeties. All-purpose shot with built-in answers.
**Assignments.** Outside WRs: go/**deep fade** — see below. Inside (2): seams (bend to post vs
2-high). QB reads the safeties and hits the seam they can't reach. Check to back if covered.
**Beats/loses.** Beats Cover 3 (+.07 — 4 verticals vs 3 deep) and Cover 2; dies vs Cover 4
(−.07, four deep defenders). Current is right.
**Viewer (CORRECTED per Garrett).** The **outside** verticals aren't plain streaks — they're
**deep FADE routes with a back-shoulder throw** (the true deep fade). So on a Four Verts shot to an
outside man, draw the deep-fade route and the back-shoulder ball, the same throw mechanic as the
red-zone fade but *deep*. Inside pair stays seams. So: outside = `fade` (deep), inside = `seam`.
**[This is the home of the real deep back-shoulder shot — the red-zone "fade" is a different,
shorter play, see below.]**

### Post-Wheel  — deep, minWR 2, motion
**What it is.** A post-and-wheel combo (often off motion): inside man posts to clear, outside/back
runs the wheel up the sideline behind it — a man-coverage/rub deep shot.
**Assignments.** Post to clear the safety; wheel up the sideline underneath. QB times the wheel.
**Beats/loses.** Beats man (2-Man/C1/C0 — the rub); dies vs Cover 4. Current matches.
**Viewer.** `['post','wheel','cross','flat']` — **correct.**

### PA Deep Cross  — deep, paNative (built on play-action)
**What it is.** Play-action deep crosser: the run fake sucks the linebackers/safety, a receiver
runs a deep cross into the vacated middle. Best when the run game has earned respect.
**Assignments.** Full run fake (QB rides the mesh), TE/WR deep cross ~18, go clearouts, back checks.
The fake IS the concept — LBs must bite.
**Beats/loses.** Beats C1/C3 (bite + void); dies vs Cover 4. Current matches. `paNative` = the play
action is intrinsic, not a toggle.
**Viewer.** `['go','deepcross','post','flat']` + the QB must show the fake first — **[VERIFY]** the
viewer should ride a visible run fake before the drop on paNative concepts.

### Mills (Post-Dig)  — deep, minWR 2
**What it is.** A post and a dig on the same side — a **Cover 4 (quarters) beater**: the dig holds
the safety's eyes/drives him down, the post runs behind him. A high-safety hole shot.
**Assignments.** Post (deep, behind the safety) + dig (~12–15, drives the safety down). QB reads
the safety: he sits on the dig → throw the post.
**Beats/loses.** Beats Cover 4 (+.07) and Cover 2; dies vs Cover 3. Current is right.
**Viewer.** `['post','dig','go','arrow']` — **correct.**

### Red-Zone Fade  — depth: SHORT–MEDIUM (CORRECTED), fade
**What it is (CORRECTED per Garrett).** NOT a deep pass. It's a **back-shoulder jump ball to an
OUTSIDE receiver, thrown short-to-medium** (roughly goal line out to ~15 yds). It's really a
**single designed route** — the rest of the play runs normally — that isolates your **best jump-ball
receiver** on his man and lets him win a contested ball. Wins on size / JMP / HND on a 1-on-1; the
back-shoulder placement beats tight man/press because only the receiver can play it.
**Assignments.** The FADE target (best jump-ball WR, aligned **OUTSIDE**) runs a short/medium fade
or back-shoulder toward the sideline. The other four run the normal complementary routes of the
call — this is ONE featured route, not a full concept. QB throws to the outside/back shoulder.
**Beats/loses.** Beats C0/C1/2-Man (1-on-1, no help); dies vs zone (corner sits, safety help over
the top). Tilts (+.10/.08/.06 man) still fit.
**Viewer (CORRECTED).** Target is the **outside** WR (not a slot/mesh bucket). Route is a
**SHORT–MEDIUM** fade breaking toward the sideline (~8–14 yds), and the ball is a **back-shoulder**
throw (placed to the receiver's back/outside shoulder, short of the defender) — NOT a deep lob to
the pylon. Change `depth` from `deep`. **[VERIFY — I'll set it to `medium` unless you want
`short`.]**

> **The distinction Garrett drew:** the true **deep back-shoulder FADE** is a different, deeper shot
> — and that deep version is what the **Four Verts outside receivers** run (see Four Verts above).
> Same throw mechanic (back-shoulder), different depth: red-zone fade = short/med to an outside WR;
> four-verts fade = the deep shot.

---

## PART 5 — RUN CONCEPTS

Runs tilt vs **box count** (loaded = extra defenders in the box; light = fewer), not coverage
family. `vsBox` in `concepts.js`. Geometry lives in `RUN_SCHEMES` in the viewer.

### Inside Zone  — run_inside
**What it is.** The OL steps playside in unison, doubles to the backside LB, RB reads the first
down lineman and makes ONE cut off it (bang/bend/bounce). The bread-and-butter run; vision play.
**Geometry.** `gap:6, stretch:.35, press:3` — modest lateral press, quick vertical cut. **Correct.**
**Beats/loses.** Better vs light boxes (+.04). Loaded box (−.02).

### Power  — run_inside, pulls (lead)
**What it is.** Down-blocks playside, backside guard **pulls** to lead through the hole, a
lead blocker (FB/H) kicks the edge. Gap/power scheme — bully ball. `gap:9, pull:lead`.
**Beats/loses.** Roughly neutral vs box (it's a hammer either way). Current +.02/+.01.

### Iso  — run_inside (lead)
**What it is.** Isolation: FB leads straight through the hole onto the MIKE, RB follows. Simplest
downhill run. `gap:5, lead:true`.
**Beats/loses.** Slightly better vs light box.

### Trap  — run_inside, pulls (trap)
**What it is.** Invite an interior DT upfield (leave him unblocked), then **trap** him with a
pulling guard from the side — punishes an aggressive, penetrating DT. `gap:5, pull:trap`.
**Beats/loses.** Better vs a loaded/attacking box (+.03) — that's the trap bait. Current right.

### Outside Zone  — run_outside
**What it is.** The whole OL flows laterally to stretch the defense to the sideline; RB presses
the edge and cuts up off the first crease (reach-and-run). `gap:16, stretch:1, wide:true`.
**Beats/loses.** Better vs light/spread-out boxes (+.03).

### Counter  — run_outside, pulls (lead), misdir
**What it is.** Misdirection gap scheme: backfield shows one way, two pullers (guard + tackle/H)
lead back the other. **Eats crashing edges** (`punishes:'crash'`). `gap:11, misdir:true`.
**Beats/loses.** Neutral-ish vs box; its edge is vs aggressive/crashing fronts.

### Toss  — run_outside
**What it is.** Quick pitch to the RB to beat the defense to the edge with a convoy of blockers.
Speed to the perimeter. `gap:22, pitch:true, wide:true`.
**RESOLVED (Garrett):** keep Toss **tighter than Jet** — it's a deeper pitch from the RB's
**backfield alignment** (so pullers/FB can lead through the edge), whereas Jet uses presnap WR
momentum from a full-speed motion man. The two must read as distinct plays, not share geometry.
**Beats/loses.** Better vs light box (+.04).

### QB Sneak  — run_inside, qbSneak
**What it is.** QB follows the center's push for a yard — short-yardage/goal-line. Forces the QB
as carrier.
**Beats/loses.** Small positive both boxes — it just needs a yard.

### Triple Option  — resolver: option (CORRECTED per Garrett — give it REAL geometry)
**Formation eligibility (CORRECTED).** **Remove from Spread.** Belongs in **I-Formation-type / full-
house sets** (and the option formations — Flexbone/Wishbone/Pistol). *(Action item: drop Spread from
`OPTION_CAPABLE` for Triple Option.)*
**What it is (CORRECTED — Garrett's mechanic).** Three ball-carriers, one play:
- The **FB runs the Inside Zone path** (the dive) — this is the first "give" read.
- The **RB runs outside**, and the **QB runs that same outside path but SHALLOWER, shadowing the
  RB** — the QB and RB stay in a pitch relationship down the line.
- **It initially looks exactly like an RPO to the FB.** But instead of the QB pulling to look for a
  *pass*, he pulls and **runs outside with the RB**. Whether he keeps or pitches depends on **who
  has the cleaner path** and **what the RB's assigned defender does**: if that defender stays home /
  sticks to the RB, the QB keeps; if he turns in to tackle the QB, that **opens the pitch window** to
  the RB.
**Viewer geometry (real, not aliased).** Draw all three: FB on the inside-zone dive track; QB down
the line on a shallow outside path with the RB shadowing just outside/behind him (the pitch phase).
Which phase to *show* is **inferred from the engine's result** (per Garrett's pick): FB credited =
give (dive); QB credited = keep (QB runs it); pitch man credited = pitch (ball flips to the RB at
the pitch point). No engine change needed — read `carrierSlotId` + yards.

### Speed Option  — resolver: option-speed (CORRECTED per Garrett)
**What it is (CORRECTED).** **Same as the Triple Option's QB/RB outside run — just WITHOUT the FB
dive.** The QB and RB attack the edge in a pitch relationship (QB shallower, shadowing / RB outside);
keep-or-pitch turns on the pitch key exactly as above, there's simply no give phase. Two carriers,
not three.
**Viewer geometry.** The QB-down-the-line + RB-pitch phase of the triple, minus the FB dive. Phase
(keep vs pitch) inferred from the result (QB credited = keep; RB credited = pitch).

### Jet Sweep  — resolver: jet  (CORRECTED per Garrett)
**What it is (CORRECTED).** A **WR in full-speed presnap motion** takes the ball across the formation
and attacks the edge before the defense adjusts. The carrier is the motion man (the `carrierSlotId`
fix). `gap:26, stretch:1`. **Beats/loses:** better vs light box; a leverage/speed play.

**TWO CORRECTIONS from Garrett:**

1. **The snap does NOT go directly to the WR.** (This is a real bug from the Jul 2026 snap-timing
   work — I made Jet a direct snap.) The correct sequence: the WR is **already in presnap motion**,
   the ball is **snapped to the QB**, and the motion man **meets the QB in the backfield just after
   the snap to take the handoff**, then bends to the edge. So the viewer must: (a) show the WR's
   presnap motion, (b) snap center → QB, (c) hand QB → motion man at the mesh in the backfield, (d)
   sweep. NOT center → WR. *(Action item: Jet must not use the `directSnap` path; it's a QB-mesh
   handoff, timed after the snap secure.)*

2. **Jet should NOT be limited to a specific player/formation.** In any formation that can run it,
   the jet **always comes from a WR motioning presnap** — don't restrict it to sets that have a
   dedicated JETMAN slot. Any eligible WR can be the motion man. *(Action item: the jet carrier
   should be "the WR put in motion," selected generally, not gated to formations with a specific
   slot.)*

### Draw  — resolver: draw
**What it is.** Show pass (OL sets, QB drops), then hand to the RB up the middle after the rush
commits upfield — a pass-rush punisher. `optionPhase:'draw'`, later mesh.
**Beats/loses.** Best when they're pinning their ears back to rush.

### Wildcat Power  — resolver: wildcat (direct snap, aliases Power)
**What it is.** Direct snap to the back (QB split wide as a decoy); it's Power blocking with an
extra hat (the QB removed from the box math but the defense must honor him). Only in Wildcat.
**Geometry.** Direct snap → the back, Power scheme. The Jul 2026 snap fix draws the direct snap
correctly now.

---

## PART 6 — FORMATION → PLAY, and what the code must respect

Each formation carries a subset of these plays (`FORMATION_PLAYBOOK` in constants.js) and dictates
personnel (`FORMATION_PACKAGES`). Key football truths the code should honor:

- **minWR gates** are personnel truth: Four Verts needs 3 WR, screens/mesh need 2, etc. A
  formation without the bodies shouldn't offer the play (the Auto-formation gate now enforces
  which formations carry which plays).
- **Wildcat Power lives only in Wildcat** (the one true direct-snap play). Correct today.
- **Option plays** want option-capable formations — **I-Formation/full-house + Flexbone/Wishbone/
  Pistol. NOT Spread** (Garrett — remove Spread from Triple Option's `OPTION_CAPABLE`).
- **Jet** is a **WR presnap-motion handoff from the QB** (NOT a direct snap, NOT slot-gated). Any
  eligible WR can be the motion man in any formation that carries the play — don't require a
  dedicated JETMAN slot. See the Jet Sweep section for the corrected sequence.

---

## RESOLVED by Garrett — the review is COMPLETE. Everything below is decided.

Every play is corrected or confirmed and every open question is answered. This section is the
full set of decisions; the next section turns them into the ordered build queue.

**Football corrections (what the play IS):**
- **Red-Zone Fade** — short/medium, to an **outside** WR, a single back-shoulder route (not deep,
  not a slot/mesh bucket). *(Setting `depth: medium` unless you say `short`.)*
- **Four Verts** — the **outside** receivers run the **deep FADE / back-shoulder** (this is the home
  of the real deep fade), inside pair stay seams.
- **Triple Option** — remove from **Spread**; real geometry (FB inside-zone dive + QB/RB outside
  pitch relationship, QB shadowing shallower); give/keep/pitch inferred from the engine result.
- **Speed Option** — the triple's QB/RB outside run **without the FB dive**.
- **Jet Sweep** — NOT a direct snap: WR motions presnap, ball snaps to QB, **motion man takes the
  handoff in the backfield**, then sweeps. **Not slot/formation-gated** — any WR in motion.

**Tuning / detail calls (Garrett's answers to the [VERIFY] list):**
- **Bubble Screen blocking** — outside WR **stalk-blocks the boundary CORNER** (standard); the
  slot's arc naturally leverages him outside the overhang/flat LB.
- **Bubble Screen vs Cover 2** — make it **more negative: `−0.06`**. Cover 2's hard corner sits in
  the flat reading the QB/slot's eyes — the universal "bubble-screen killer."
- **Stick outside man** — a **clearout `go`** (or deep seam), NOT an `out`. An out cuts into the same
  boundary space the stick/flat wants; a vertical carries the corner away and frees the stick.
- **Tunnel / RB screen** vs-rows — leave as-is.
- **Toss stays tighter than Jet** — Toss is a **deeper pitch from the RB's backfield alignment** so
  pullers/FB can lead through the edge; Jet uses presnap WR momentum. Keep the geometry distinct.

**Cross-cutting (the two big takeaways up top):**
- **Crisper route trees** — right route on the right man, clean stems and sharp breaks.
- **Throw timing keys off the route** — replace the flat per-depth clock; hold true on incompletions.

## Code action items — the ordered build queue

1. **Screens** (bubble / tunnel / rb): add `bubble` / `tunnel` / `rbscreen` route shapes + blocker
   behaviors + correct ball timing (Part 1). Bubble: outside WR blocks the **corner**; set the
   Cover-2 tilt to **−0.06**.
2. **Jet Sweep** (live bug): remove from the `directSnap` path and the JETMAN-slot gate — make it a
   presnap-motion WR who takes a **QB-mesh handoff in the backfield**, selectable in any formation
   that carries it. **Mind risk A:** hold the motion man at the mesh point until `meshAt` and
   transfer the ball at the exact intersection — no reach-before-arrive.
3. **Triple Option**: drop Spread from `OPTION_CAPABLE`; build real dive + QB/RB-pitch geometry;
   **read `p.optionPhase` directly** (`dive`/`keep`/`pitch`) — do NOT infer from `carrierSlotId`
   (risk C: the engine already stamps the phase and survives pitch fumbles).
4. **Speed Option**: the triple's QB/RB outside run minus the FB dive (same `optionPhase` read).
5. **Red-Zone Fade**: retarget to the outside WR, short/med back-shoulder; change `depth`.
6. **Four Verts**: outside routes → deep fade + back-shoulder ball.
7. **Stick**: outside man → clearout `go` (not `out`).
8. **Toss**: keep it a tighter backfield pitch, distinct from Jet's motion sweep.
9. **Throw timing**: replace the flat per-depth `throwAt` constant with timing that keys off the
   target route's break time. **Mind risk B:** `throwAt = min(routeBreak, pocketBreakdown)` — the
   ball still targets the route landmark but releases early under pressure (off-target / throwaway),
   and never waits past the pocket's collapse. Holds on incompletions.

No open questions remain — this spec is ready to build against. Verified integration risks
(A/B/C) are documented in the section above so the build doesn't re-introduce them.

---

## Integration risks — VERIFIED against the code (build-time traps to avoid)

Three high-risk integration points were raised (Garrett via Gemini) and checked against the
actual source. All three are real; the fixes are recorded here so the build doesn't re-introduce
them. Where the code already handles a case, that's noted so we don't over-engineer.

### A. Jet Sweep handoff mesh & timing collision  → REAL, must fix (build item 2)
**The trap:** the motion WR crosses the QB at the snap. Today the motion arrives at the QB at
`PRESNAP` (0.95s) but the ball doesn't transfer until `meshAt` (`SNAP_END + 0.28`), and after
PRESNAP the motion man's behavior immediately routes him toward the hole. Result: the WR is already
sprinting to the edge while the ball is still drawn in the QB's hands — a phantom handoff / a WR
that clips through the QB.
**Fix:** compute an explicit mesh point `[qbSlot.bx, qbSlot.by]` and **hold the motion man at that
mesh point** from his arrival until `meshAt`; transfer the ball to him AT `meshAt` at that exact
intersection, THEN release him to the edge. The snap-to-QB and the motion arrival must line up at
the QB's depth (~1.5–2 yds behind center) so there's no reach-before-arrive gap. (Jet must also
leave the `directSnap` path and the JETMAN-slot gate — same build item.)

### B. Throw timing keyed to route breaks — pressure/sack collision  → REAL, guard when building item 9
**The trap:** build item 9 makes `throwAt` key off the target route's break. But a deep break at
~1.5s with pressure/sack arriving earlier would animate a throw AFTER the QB was hit, or wait on a
landmark a sacked QB never reaches. Today `throwAt` is a flat constant and the sack is a totally
separate branch (`tSack = PRESNAP + 1.45`), so nothing clamps the throw against pressure.
**Fix (bake into item 9):**
`throwAt = min(routeBreakTime, pocketBreakdownTime)`.
If pressure forces it early, the ball still **targets the intended route landmark** but is released
early — which reads as an off-target throw / throwaway / rushed pick, exactly what should happen.
Never let the throw event wait past the pocket's collapse. (The engine already stamps `p.sack`,
`p.hurried`, `p.pressureIds` — use those to derive `pocketBreakdownTime`.)

### C. Option pitch phase from carrierSlotId — fumble breaks inference  → ALREADY SOLVED, don't infer
**The concern:** inferring give/keep/pitch from `carrierSlotId` + yards could misread a pitch
**fumble** (the ball may end with a defender). **Verified in the engine:** this is already handled —
`sim.js` writes an explicit `result.optionPhase` of `'dive' | 'keep' | 'pitch'` (line ~2621), and
even a **muffed pitch** stamps `optionPhase: 'pitch'` + `pitchMuffed: true` while keeping `rusherId`
as the intended carrier (line ~2255). **So the viewer should read `optionPhase` DIRECTLY — do NOT
infer the phase from who ended up with the ball.** The `carrierSlotId`-inference idea from the
earlier note is superseded: the explicit flag Gemini recommended already exists. Build item 3 uses
`p.optionPhase` (and can show a fumble at the pitch point when `pitchMuffed`).
