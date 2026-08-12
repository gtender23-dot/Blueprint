# Gameplan screen — terminology audit (item 33)

Filed 2026-08-12 as part of `Ref/PLAYTEST_2026-08-12.md`. Owner's report: *"audit gameplan
screen for terminology. the players are not real coaches and wont understand things like
protection scheme options."*

All line numbers are `js/ui/views/gameplan.js` unless stated, against the tree at build
`7565224b53`.

Severity key: **[H]** a football fan will not know what this means · **[M]** guessable but
coach-speak · **[R]** breaks the never-print-coefficients rule (CLAUDE.md help rule 3).

**Ship order:** the `[R]` rows first, as their own hunk — they are a standing rule breach,
not a taste question. Then the non-football renames. Then the `tipTerm()` wrapping pass.

---

### 6.0 Rule violations to fix regardless of wording

| Line | Exact string | Why |
|---|---|---|
| 402 | `<b style="min-width:26px;text-align:right">${val}</b>` (the four SCHEME PROFILE meters) | **[R]** prints raw 0–100 derived scores |
| 411–414 | `"⚔️ Aggression"`, `"⏱️ Tempo"`, `"🎯 Air ↔ Ground"`, `"🃏 Deception"` with numeric values | **[R]** + **[H]** |
| 477 | `${paWord} <b>(${paCred.toFixed(2)})</b> · ~${…}% of med/deep` | **[R]** prints a raw 2-decimal coefficient |
| 503 | `L <b>${L}</b> · M <b>${M}</b> · R <b>${R}</b> — ${contWord} (${cont}/10)` | **[R]** prints an internal composite and a 0–10 continuity score |
| 661 | `"…Pistol is what the concept was built for (100% of the dial); Spread is nearly as good (85%); Trips telegraphs it (70%); Air Raid is a drop-back system (45%). Under center — Power-I (5%)…"` | **[R]** a printed weight table |
| 829 | `"MAX PROTECT keeps the TE (and backs) in — ~20% fewer sacks…"` | **[R]** |
| 856 | `"…more interceptions (up to +25%)."` | **[R]** |
| 1228 | `"STRIP HUNT punches at the ball on every contact — +50% forced fumbles…"` | **[R]** |
| 1299 | `"…living that close to the edge draws flags (+12% defensive penalties)."` | **[R]** |
| 2218 | `"Hurry here burns legs (+35%/+20% fatigue)…"` | **[R]** |
| 2324 | `"+20 stuffs the run (~0.6 fewer yds/carry) but leaves every receiver more open (~+3–4% completions against)."` | **[R]** |
| 874 | `"Calling one concept on 30%+ of its snaps gets it jumped…"` | **[R]** printed threshold |
| 1116 | `"The sim keys their FEATURED man (highest target share)…"` | **[M]** mechanism leak |

### 6.1 Top-level chrome (`renderGameplan`, lines 28–81)

| Line | Exact string | Sev |
|---|---|---|
| 40 | `Simple mode — set your identity, the sim handles the scheme. Want every knob? Settings › Game › Game Plan Detail.` | M ("scheme", "knob") |
| 58 | `Plan by situation — anything left on AUTO inherits your defaults. Too many dials? Settings › Game › Game Plan Detail.` | M ("inherits", "defaults") |
| 63 | `Offense Defaults` | M |
| 64 | `Defense Defaults` | M |
| 65 | `Situations` | — |
| 2612 | `PLAN` (A/B/C slot row) | M (unlabeled slots) |

### 6.2 SCHEME PROFILE card (lines 347–416) — recommend deletion (see item 1)

| Line | Exact string | Sev |
|---|---|---|
| 407 | `SCHEME PROFILE` | **H** |
| 408 | `every dial + formation weight, scored` | **H** |
| 409 | `🧭 Identity` | M |
| 387–391 | generated identity string, e.g. `pass-first`, `ground-based`, `clock-controlling`, `bend-don't-break`, `even-keeled`, `, multiple looks`, `, vanilla` | M |
| 411 | `⚔️ Aggression` / `Ball-control` / `All-out` | M |
| 412 | `⏱️ Tempo` / `Grind clock` / `No-huddle` | M |
| 413 | `🎯 Air ↔ Ground` / `Run-heavy` / `Pass-heavy` | M |
| 414 | `🃏 Deception` / `Vanilla` / `Multiple` | **H** |

### 6.3 OFFENSIVE IDENTITY card (`renderIdentityCard`, lines 417–520)

| Line | Exact string | Sev |
|---|---|---|
| 474 | `OFFENSIVE IDENTITY` | M |
| 475 | `what their film room sees` | M |
| 476–477 | `🎭 Play action` + `sells hard` / `credible` / `thin` / `nobody bites` (line 427) + `~X% of med/deep` | **H** ("med/deep") |
| 478 | `🔥 Screens` — `~X% of short throws — jackpot vs the blitz` | M |
| 479 | `🔄 RPO` — `~X% of run calls carry the option` | **H** (RPO never expanded) |
| 491 | `🔱 Option` — `~X% of run calls (triple + speed option) · lean 40/30/30 dive/keep/pitch` | **H** (dive/keep/pitch) |
| 498 | `🚀 Jet sweeps` — `~X% of outside runs hit the motion man` | M |
| 500 | `🏃 Motion` — `~X% of dropbacks` | M ("dropbacks") |
| 501 | `🎩 Draws` — `~X% of inside runs come off a pass look` | M |
| 502–503 | `🧱 Your line` — `L … M … R … — in lockstep / settled / gelling / strangers (n/10)` | **H** + **[R]** |
| 515 | `⭐ Featured` — `<name> at X% — expect brackets and shadows` | **H** ("brackets", "shadows") |
| 517–518 | `🎯 Run plan` — `X% left · X% mid · X% right — running away from your strength?` | — |

### 6.4 OFFENSIVE DEFAULTS (`renderOffenseDefaults`, lines 521–917)

Section chrome:

| Line | Exact string | Sev |
|---|---|---|
| 529 | `OFFENSIVE DEFAULTS` | M |
| 530 | `${n}/5 formations selected` | — |
| 534 | `Set your identity once — the sim runs it on every snap. The IDENTITY card above shows what your choices add up to…` | — |
| 537 | subtabs `Package` · `Run Game` · `Pass Game` · `Playbook` · `Tempo & Motion` | M (`Package`) |
| 543 | `THE BASICS` / `formations & run/pass balance` | — |
| 624 | `THE RUN GAME` / `where & who` | — |
| 709 | `THE OPTION GAME` / `dive · keep · pitch` / `speed option — keep · pitch` | **H** |
| 758 | `THE PASS GAME` / `depth & targets` | — |
| 873 | `THE PLAYBOOK` / `concept weights — your call sheet` | **H** ("concept weights") |
| 891 | `TEMPO` / `clock & legs` | — |

Controls — Package:

| Line | Exact string | Sev |
|---|---|---|
| 546 (and 181) | `Formation Package` + hint `(pick 1–5)` | M |
| 560 | personnel string from `formatPersonnel(pkg)` (e.g. `11`, `12`, `21`) | **H** — personnel-number code with no gloss |
| 571 (and 199) | `Usage Weights` | **H** |
| 591 | `Play Tendency` | M |
| 593–595 | option labels are the raw `PASS_TENDENCY` keys: `Heavy Run`, `Balanced`, `Heavy Pass` etc. | — |
| 604–605 | `RUN X%` / `PASS X%` | — |
| 608 | `This is your biggest lever. Run-heavy teams sell play action — the fake only works if the run is real…` | — (good model copy) |
| 611 | `Fourth Down Approach` + options `Very Conservative` / `Conservative` / `Moderate` / `Aggressive` / `Very Aggressive` | — |
| 618 | `…this sets the nerve. Aggressive wins games and loses jobs. (Weekly plans and ST fakes layer on top.)` | M (`ST`) |

Controls — Run Game:

| Line | Exact string | Sev |
|---|---|---|
| 627 | `Run Direction` (+ `LEFT`/`MIDDLE`/`RIGHT`, line 633) | — |
| 639 | `…blocks at the point of attack count triple — run behind your best linemen…` | M |
| 643 | `QB Run Tendency` | — |
| 650 | `…Best with Pistol/RPO and a fast QB (SPD/AGI). A statue QB…` | **H** (attribute codes) |
| 654 | `RPO Rate` + hint `(Pistol/RPO runs carrying the option)` | **H** |
| 661 | `…whether your QB can read the mesh… more mesh reads: a smart QB (AWR) pulls it against a crashing box for the free slant.` | **H** ("mesh", "crashing box", AWR) |
| 665 | `Gadget Rate` + hint `(reverses, flea flickers, HB passes)` | M |
| 672 | `PASS 5 trick tier — the dial is how often…` | **H** — internal release codename leaked to the player |
| 677 | `Jet Sweep Rate` + hint `(outside runs to your motion man)` | M |
| 684 | `…the slot joker (Spread/Trips/Air Raid/Empty/Pistol), an A-back (Flexbone), the JET spot (Wildcat), or your flanker/wing in pro sets… a sniffed one (edge AWR, loaded boxes) is a TFL waiting in the alley.` | **H** (`A-back`, `flanker/wing`, `TFL`, `edge AWR`) |
| 688 | `Draw Rate` + hint `(inside runs from a pass look)` | M |
| 695 | `…A disciplined MIKE sits in it for nothing.` | **H** (`MIKE`) |

Controls — Option Game:

| Line | Exact string | Sev |
|---|---|---|
| 710 | `…this is the SPEED option — no dive back, the QB attacks the edge and reads only the force defender: keep or pitch.` | **H** (`force defender`) |
| 713 | `Option Rate` + hint `(run calls that are true triple option · in spread sets it scales your speed-option changeup instead, 70 = its natural rate)` | **H** + **[R]** (prints the "70" anchor) |
| 720 | `…reads the dive key (give or pull), then the force defender… His AWR and TEC make the reads…` | **H** |
| 724 | `Option Mix` + hint `(a 100% split — where you lean when the read is a coin flip)` | M |
| 729 | option labels `Dive (FB)` · `QB Keep` · `Pitch` | **H** (`FB` unexpanded) |
| 738 | `…Dive-heavy grinds behind the B-back; pitch-heavy hunts the edge with your fastest wing.` | **H** (`B-back`, `wing`) |
| 742 | `Pitch Aggressiveness` + `Safe` / `Loose` | M |
| 749 | `…Your QB's TEC throws the pitch; the wing's hands catch it.` | **H** (`TEC`) |
| 752 | `Your pitch man is whoever holds the wing spots on the Depth Chart's field view — the A-back (Flexbone) slots mesh RB/WR/TE/FB and the halfback (Wishbone) slots mesh RB/FB/TE, so a fast receiver or an H-back type can be your pitch back.` | **H** — worst offender in the file (`slots mesh`, `A-back`, `H-back`) |

Controls — Pass Game:

| Line | Exact string | Sev |
|---|---|---|
| 761 | `Pass Depth Distribution` (+ `SHORT`/`MEDIUM`/`DEEP`) | M |
| 774 | `…Your QB's arm (STR) and your receivers' SPD decide whether deep is a weapon or a donation.` | **H** (attribute codes) |
| 778 | `Screen Rate` + hint `(% of short throws)` | — |
| 789 | `Play Action Usage` + hint `(× your formations' natural rate)` | M |
| 796 | `100% is your formations' DNA (Power-I fakes a third of the time, Air Raid barely bothers)…` | M ("DNA") |
| 800 | `Wildcat Trick Pass` + hint `(pass rate from the Wildcat)` | M |
| 807 | `…Your WC-spot taker is set on the Depth Chart's field view (RB, WR — or a runner QB).` | **H** (`WC-spot taker`) |
| 811 | `Chip Help` + hint `(the back bumps the edge)` | **H** |
| 813 | options `Auto` · `Chip the edge` | **H** |
| 818 | `CHIP THE EDGE designs the bump: on the middle protections your releasing back hunts their best rusher… your outlet thins exactly when the heat is on.` | **H** (`middle protections`, `outlet`) |
| 822 | **`Protection Emphasis`** + hint `(routes vs blockers)` + `Max Routes` / `Max Protect` | **H** — *named in the bug report* |
| 833 | **`Protection Identity`** + hint `(how the pocket is built)` | **H** — *named in the bug report* |
| 837 | option labels from `C.PROT_IDENTITY.labels` (`js/constants.js` **line 1795**): `Quick Game`, **`Half-Slide`**, **`BOB`**, `Max Protect` | **H** — `BOB` is an unexplained acronym in a button |
| 841 | `QUICK GAME — five-man protection, ball out on rhythm. The house can't sack what's already thrown…` | **H** (`the house`) |
| 842 | `HALF-SLIDE — the modern default: man side, zone slide side… your CENTER's awareness sets the slide…` | **H** |
| 843 | `BOB — big-on-big: trust your five one-on-one, backs scan the backers… fire zones bend its angles wrong, and that's exactly what a 3-4 wants to hear.` | **H** (`BOB`, `fire zones`, `3-4`) |
| 844 | `MAX PROTECT — TE and back stay home, seven block. The deep-shot answer to secondary heat… Against a defense that just drops eight, you've blocked nobody with everybody.` | **H** (`secondary heat`, `drops eight`) |
| 849 | `QB Aggression` + hint `(protect it vs push it)` + `Protect` / `Push it` | — |
| 856 | `The gunslinger dial. PUSH IT hunts depth beyond your called mix… a high-AWR passer earns the right to push` | M |
| 860 | **`LOS Freedom`** + hint `(audibles & kill calls)` | **H** — `LOS` never expanded; `kill calls` is pure coach-speak |
| 862 | options `Run the Call` · `Auto` · `Full Freedom` | M |
| 867 | `…He can kill a run into the quick game against a loaded box, check a pass into a run against a light one… AUTO scales with his AWR… DCs disguise a checking QB harder.` | **H** (`kill`, `check`, `DCs`) |

Controls — Playbook:

| Line | Exact string | Sev |
|---|---|---|
| 874 | `Every snap the sim now calls a real CONCEPT — this is where you weight them. 50 is a balanced call sheet…` | **H** + **[R]** |
| 884 | `Madden-style formation sheets: pick a formation to author ITS playbook.` | **H** — names a competitor product; `author` |
| 881 | `GLOBAL SHEET` | **H** ("global" is engineering-speak) |
| 2758–2761 | `This is <fid>'s own call sheet — N plays it actually runs… inherits the global sheet. 0 is still a cut…` / `Nothing authored yet — this formation runs the global book.` | **H** (`authored`, `global book`) |
| 2762 | `Reset ${fid} to the global sheet` | M |
| 2768/2795–2799 | group headers `QUICK GAME`, `DROPBACK` (`medium passes`), `SHOT PLAYS` (`deep passes`), `INSIDE RUN GAME`, `PERIMETER RUN GAME` | M (`DROPBACK`, `PERIMETER`) |
| 2776 | `set here · tap to inherit` + title `Authored for ${fid} — tap to go back to inheriting the global weight` | **H** |
| 2779/2781/2782 | slider ends `bench` / `feature`, value `benched` / `≈X%` | — (good) |
| 2811 | `Reset to balanced (all 50)` | **[R]** prints the internal midpoint |
| 2812–2815 | `Weights set the mix inside each group — and 0 is a cut, not a low number: a benched play is out of the install…` | M (`the install`) |
| 2831 | `off the sheet — no formation carries it` | M |

Controls — Tempo:

| Line | Exact string | Sev |
|---|---|---|
| 894 | `Base Tempo` + options `Chew` · `Normal` · `Hurry` | **H** — `Chew` (for "chew clock") is opaque as a bare button |
| 904 | `Motion Usage` + hint `(× your formations' natural rate)` + `Static` / `2×` | M |
| 911 | `Pre-snap movement buys separation and forces the defense to show its hand — smart DBs (AWR) give less away.` | M |

### 6.5 DEFENSE DEFAULTS (`renderDefenseDefaults`, lines 1109–1387)

| Line | Exact string | Sev |
|---|---|---|
| 1120 | `DEFENSE DEFAULTS` | M |
| 1125 | subtabs `Front` · `Coverage` · `Pressure` · `Calls` · `Checks` | **H** (`Front`, `Checks`) |
| 1132 | `THE FRONT` / `bodies & the box` | **H** ("the box") |
| 1234 | `COVERAGE` / `shells & eyes` | **H** ("shells") |
| 1320 | `PRESSURE` / `bringing the heat` | — |
| 1135 | `Base Front` + options `4-3` `3-4` `Tite` `Nickel` `Big Nickel` `3-3-5` `4-4` (`DEF_FRONTS2`, line 2894) | **H** (`Tite`, `3-3-5`, `Penny`) |
| 1141 / 2895–2904 | `DEF_FRONT_DESCS`, e.g. `"3 DL · 4 LB · 4 DB — 4i-0-4i odd front: B-gaps closed by alignment, backers run free"` (Tite, 2900); `"4 DL · 4 LB · 3 DB — the eight-man front: SPUR/BANDIT outside, one deep safety"` (4-4, 2901); `"5 on the LOS · 1 LB · 5 DB — the light-box spread-run answer"` (Penny, 2903) | **H** — `4i-0-4i`, `B-gaps`, `SPUR/BANDIT`, `LOS`, `light-box` |
| 1146 | `Your default look — the sim auto-subs Nickel and Dime on passing downs and 46/Bear in short yardage…` | **H** (`46/Bear`, `Dime`) |
| 1149 / 2905–2914 | `Scheme fit:` + `DEF_FRONT_NEEDS`, e.g. `"Wants 3-tech DTs, pass-rush DEs, a thumper MLB and rangy cover LBs."` (2906); `"Wants a two-gap nose tackle, edge-rush OLBs and downhill inside LBs."` (2907); `"Wants two-gap 4i ends, a stout nose and rangy space-backers at JACK/JOKER."` (2910); `"Wants a ROVER — a hybrid safety who covers TEs and tackles like a backer."` (2912) | **H** — `3-tech`, `two-gap`, `4i`, `JACK/JOKER`, `ROVER`; also the literal word `Scheme fit` |
| 1154 | `Front Mix` + hint `(standard downs — pick up to 5)` | **H** (`standard downs`) |
| 1173 | `Empty = you line up in your base front every standard down… the defensive mirror of your offensive formation weights. Short-yardage walls and obvious-pass subs still override on top.` | M |
| 1177 | **`Box`** + hint `(run commit)` + `Light` / `Loaded` | **H** — both label and hint are jargon |
| 1184 | `Your most interesting lever. LOADED stuffs the run… a rush with its ears pinned… Zero is honest.` | M |
| 1188 | `Option Assignment` + hint `(vs triple-option offenses)` + options `Balanced` · `Contain QB` · `Take Pitch` | **H** |
| 1195 | `Assignment football, against ANY read offense… it dampens RPO pulls, designed QB keepers, and scrambles… the assigned edge meets the runner…` | **H** |
| 1199 | `Edge Discipline` + hint `(contain vs crash)` + options `Contain` · `Balanced` · `Crash` | **H** |
| 1206 | `What your edges do at the snap. CONTAIN sets the edge… CRASH pins ears back — more sacks, better dive-stuffing…` | **H** |
| 1210 | `Sub Philosophy` + hint `(answering their personnel)` + options `Match` · `Auto` · `Stay Base` | **H** |
| 1217 | `MATCH answers spread sets with the nickel and dime on ANY down… exposed when their slot man draws your MIKE. AUTO subs by down and distance like everyone's coordinator.` | **H** (`MIKE`) |
| 1221 | `Tackling` + hint `(wrap vs strip)` + options `Wrap Up` · `Balanced` · `Strip Hunt` | — |
| 1228 | `…Turnover margin vs yardage allowed: pick your religion.` | — |
| 1237 | **`Robber Call`** + hint `(the two-high safety's leash)` + options `Auto` · `Rob the middle` · `Stay over top` | **H** — "robber" is film-room-only |
| 1244 | `Two-high shells only. ROB THE MIDDLE turns the safety's read loose — he undercuts the in-breakers harder… the post over his head knows it… Also callable per-snap from the defensive headset.` | **H** (`in-breakers`, `the post`) |
| 1248 | **`Zone Teaching`** + hint `(spot-drop vs match)` + options `Spot-drop` · `Balanced` · `Match` | **H** |
| 1255 | `How your zones are coached. MATCH travels with routes — floods and high-lows find far less grass… SPOT-DROP sits in the throwing lanes… it's the pre-dial game.` | **H** (`floods`, `high-lows`, `pre-dial`) |
| 1259 | **`Coverage Scheme`** + options `Balanced` · `Lock WR1` · `Bracket WR1` (also `COV_OPTIONS`, line 2892) | **H** — `WR1`, `Lock`, `Bracket` |
| 1116 | `Your best corner follows their best receiver everywhere… The sim keys their FEATURED man (highest target share), not just the depth-chart WR1.` | **H** |
| 1117 | `Two defenders on their star — which means someone else is running free underneath. Great against feed-the-man offenses…` | M |
| 1270 | `Safety Shell` + hint `(the deep math)` + options `Single-High` · `Balanced` · `Two-High` | **H** |
| 1277 | `The central bargain of modern defense. SINGLE-HIGH drops the eighth man into the box… one deep safety means the post and the go ball are live.` | **H** (`the post`, `the go ball`) |
| 1281 | `Coverage Style` + hint `(man vs zone)` + options `Man` · `Mixed` · `Zone` | — |
| 1288 | `MAN presses the quick game and travels with receivers… man grades your DBs on speed and mirror agility; zone grades them on awareness and technique.` | M |
| 1292 | **`Cushion`** + hint `(press vs off — man calls only)` + options `Press` · `Balanced` · `Off / Soft` | **H** |
| 1299 | `PRESS jams at the line — timing routes die in the receiver's stem…` | **H** (`stem`) |
| 1303 | **`Bracket Target`** + hint `(who Lock/Bracket keys on)` + options `Auto (top threat)` · `Their TE` · `Their Slot` · `Hot Man` | **H** |
| 1310 | `Only matters when Coverage Scheme is Lock or Bracket… THEIR TE erases the security blanket; THEIR SLOT takes away the inside quick game. HOT MAN reads the game as it happens…` | **H** |
| 1323 | `Aggression` + hint `(how much you risk)`; options from `C.AGGRESSION.labels` (`constants.js` **1704–1705**): `Bend` · `Selective` · `Balanced` · `Attacking` · `Bring the House` | **H** (`Bend`, `Bring the House` unglossed on the button) |
| 1331–1335 | tips `BEND — rush four…`, `SELECTIVE — a spot-picker's defense… Your coordinator's blitz design decides how well those spots are picked.`, `ATTACKING — the pressure IS the identity…`, `BRING THE HOUSE — heat on almost every dropback, an extra hat in every call… The max-risk religion.` | **H** (`an extra hat`, `blitz design`) |
| 1340 | **`Pressure Identity`** + hint `(what the heat looks like)` | **H** |
| 1343 | `Auto — ${front's signature label}` / fallback literal `front's signature` | **H** |
| 1346 / constants 1728–1731 | option labels `Fire Zone` · `Second Level` · `Secondary Heat` · `The House` | **H** — all four |
| 1350 | `AUTO runs your front's signature package — ${FRONT_SIG_LABEL[…]}… borrow another front's heat and the angles come out a step late.` | **H** |
| 1351 | `FIRE ZONE — show pressure, drop a shown rusher, bring a backer behind it. Same number of rushers, wrong angles for the protection: the low-risk lie. The 3-4 speaks this natively…` | **H** |
| 1352 | `SECOND LEVEL — linebackers downhill through the gaps… the middle of the field just lost its readers.` | **H** |
| 1353 | `SECONDARY HEAT — the strong safety or slot corner comes screaming off the edge…` | **H** |
| 1354 | `THE HOUSE — six coming, everyone else manned up with no help: the zero…` | **H** (`the zero`) |
| 1356 | `Who carries it: your ⚡ shares on the Depth Chart field still name the preferred hitman inside the package — the identity decides the shape, your dial decides the man.` | **H** |
| 1360 | **`Green Dog`** + hint `(rush when your man stays in)` + `Off` / `On` | **H** |
| 1367 | `The check-blitz: when their back stays in to pass-protect, your linebacker has nobody to cover…` | **H** (`check-blitz`) |
| 1371 | `QB Spy` + hint `(a defender mirrors the QB)` | M |
| 1378 | `…Stacks with Contain QB (the Front tab's option assignment) for a full anti-runner plan.` | M |

### 6.6 NAMED CALLS + MATCHUP CALL SHEET (`renderDefCallsSection`, lines 1944–2029)

| Line | Exact string | Sev |
|---|---|---|
| 1957 | `NAMED CALLS` / `your call library — packages, not dials` | **H** |
| 1958 | `A named call is a whole defense in one word — front, shell, heat and rules saved together, the way a real sheet speaks ("Stack Buzz Dog"). Author up to 12 below, then weight them on the matchup sheet. Any dial a call leaves INHERIT rides your standing plan for that snap.` | **H** (`Stack Buzz Dog`, `INHERIT`, `standing plan`) |
| 1966 | `nothing set — pure inherit` | **H** |
| 1977 / 2047 | button label `inherit` | **H** |
| 1983 | `Library full — 12 calls is a real sheet. Delete one to author another.` | M |
| 1986 | placeholder `Name a call… (e.g. Stack Buzz Dog)` | **H** |
| 1993 | `MATCHUP CALL SHEET` / `situation × their personnel` | **H** (`personnel`) |
| 1994 | `The sheet answers one question per snap: THIS situation, THEIR personnel — what do I call?… your live headset call still beats the sheet.` | **H** |
| 2002 | `Their personnel` | **H** |
| 1903–1911 (`PERS_COLS`) | column labels + titles: `ANY` / `every look this row doesn't name`; `EMPTY` / `no backs`; `10` / `1 back · 0 TE — Air Raid`; `11` / `1 back · 1 TE — Spread family`; `12` / `1 back · 2 TE — Ace`; `HEAVY` / `2+ backs / multi-TE`; `BONE` / `3-back option looks` | **H** — `10`/`11`/`12` as bare buttons, `Ace`, `BONE` |
| 1880–1901 (`CALL_FIELDS`) | field labels `Front`, `Pressure`, `Heat`, `Shell`, `Style`, `Edge`, `Robber`, `Zone Eyes`, `Box`, `Coverage`, `Rotation`, `Rush`, `Look`, `Dog`; option labels `Set it`, `Overtop`, `Spot`, `Match`, `Lighten −10`, `Commit +10`, `Cover 6`, `Tampa 2`, `2-Man`, `Prevent`, `Sky`, `Cloud`, `Buzz`, `Rush 3 / Drop 8`, `Double-A Mug`, `Amoeba`, `Green Dog`, `Cross Dog` | **H** — the densest jargon block in the file; `Sky`/`Cloud`/`Buzz`, `Double-A Mug`, `Amoeba`, `Cross Dog`, `Zone Eyes` all appear as bare buttons with no tip |
| 2012 | `Author a named call above first — the sheet weights calls, it doesn't invent them.` | M |
| 2024 | `The weights are the mix — the sim rolls this cell's calls at these shares every time the moment comes up.` | M |
| 2026 | `Empty cell — the standing plan (and any formation check) plays this moment exactly as today.` | **H** |

### 6.7 CHECK-WITH-ME (`renderFormChecksSection`, lines 2030–2054)

| Line | Exact string | Sev |
|---|---|---|
| 2034 | **`CHECK-WITH-ME`** / `calls keyed on their personnel` | **H** — the heading itself is unintelligible outside a staff meeting |
| 2035 | `The situation cells key on down-and-distance; a real call sheet also keys on PERSONNEL — "vs Empty, bring the house." When the offense breaks the huddle in a class below, your check overlays the standing call for that snap. Anything left inherit rides the plan. Over-check at your peril…` | **H** (`class`, `overlays`, `inherit`, `over-check`) |
| 1860–1864 (`CHK_CLASSES`) | `VS EMPTY` / `no backs — 4-5 wide, QB alone`; `VS SPREAD` / `3+ receivers — Spread, Air Raid, Trips, Pistol`; `VS HEAVY` / `2-back / multi-TE — Power-I, 'bone, Flexbone, Jumbo`; `VS WILDCAT` / `direct snap — QB split wide` | M–H (`'bone`) |
| 1866–1873 (`CHK_FIELDS`) | `Front`, `Pressure`, `Shell`, `Style`, `Edge`, `Box`; options `Single`, `Two-high`, `Set it`, `Crash`, `Lighten −8`, `Commit +8` | **H** + **[R]** (the ±8 is a raw internal number) |
| 2041 | `Reset — no check` | M |

### 6.8 SITUATIONAL PLAN (`renderSituationsSection` / `renderSitPanel`, lines 2055–2364)

| Line | Exact string | Sev |
|---|---|---|
| 2060 | `SITUATIONAL PLAN` | — |
| 2061 | `${n} custom · rest AUTO` / `all AUTO` | M (`AUTO` as a state name) |
| 2064 | `Every snap resolves to exactly one situation below (top of the list wins). This IS your game plan: AUTO cells run your defaults… plus the coordinator's built-in adjustments. Take over a cell and your call replaces the coordinator's…` | **H** (`cells`, `resolves`) |
| 2072 | badges `CUSTOM` / `AUTO` | M |
| 2857–2870 (`SIT_DESCS`) | `Your scripted first two drives of the game`; `Ball inside the 5 — score or stop`; `Ball inside the offense's own 5`; `Under 5:00 in the half, down 11+`; `Under 5:00 in the half, up 11+`; `Ball inside the 20`; `3rd or 4th down, 2 or less`; `3rd or 4th down, 3–6 to go`; `3rd or 4th down, 7+ to go`; `2nd down, 8+ to go`; `Every 1st down`; `Everything else (2nd & short/medium)` | — (these are good; keep as the model) |
| 2871–2876 (`SIT_NUDGE`) | `calls +30% more pass here`, `calls −25% pass (leans run) here`, `calls +20% more pass here`, `calls −25% pass (milks it) here` | **[R]** — printed coefficients, surfaced at line 2142 |
| 2877–2889 (`SIT_TIPS`) | e.g. `The opening script: coaches script the first drives to probe the defense and bank tendency capital…` (2878); `A Power-I pin with a QB-keep dial is the classic offensive build; 46/Bear + run commit the defensive one.` (2879); `AUTO leans run by 25% here (also covers 4th-and-short goes)…` (2884, **[R]**); `The true coin-flip down. No AUTO adjustment — whatever edge you build here is pure scheme.` (2885) | **H** (`tendency capital`, `pin`, `46/Bear`) |
| 2097–2098 | `Make Default` / `Reset to AUTO` / `Take Over` | M |
| 2101 | `AUTO — …` inherit strings throughout (2119, 2142, 2154, 2173, 2186, 2199, 2212, 2225, 2238, 2251, 2264, 2277, 2290, 2304, 2317, 2332, 2354) | M |
| 2116 | `Formation Package` | M |
| 2139 | `Tendency` | M |
| 2151/2154 | `Pass Depth` + `AUTO — 40 / 40 / 20 (short/med/deep)` | **[R]** |
| 2170 | `QB Run Tendency` | — |
| 2183 | `Option Rate` | **H** |
| 2196 | `Jet Sweep Rate` | M |
| 2209 | `Tempo` (+ `Chew`/`Normal`/`Hurry`) | **H** |
| 2222 | `Draw Rate` | M |
| 2235 | `Protection Identity` | **H** |
| 2244 | `How the pocket is built HERE: Quick Game beats the house on 3rd & medium, Max Protect buys the 2nd-and-long shot play, BOB trusts your five on the money down.` | **H** (`the house`, `BOB`, `money down`) |
| 2248 | `Protection Emphasis` + `Routes` / `Protect` | **H** |
| 2261 | `QB Aggression` + `Protect` / `Push it` | — |
| 2274 | `Playbook — Concept Weights` | **H** |
| 2278 | `The wizard grid: THIS situation's sheet. Weights overlay your base playbook per concept — bench the fades at the goal line, feature Power on 3rd & short. The call sheet's ≈% follow it live.` | **H** (`wizard grid`, `overlay`, `per concept`) |
| 2287/2290 | `Front` + `AUTO — your default 4-3; auto-subs by personnel + down: Nickel/Dime vs spread, 46/Bear on short-yardage, a 5-2 wall inside the 1` | **H** |
| 2296 | `Pinned: this front takes EVERY snap in this situation — no auto-subs.` | **H** (`Pinned`) |
| 2301 | `Aggression` | **H** |
| 2310 | `This situation gets its own aggression stop — SELECTIVE unloads here, BEND sits back. Who comes is still your front's identity + your Depth Chart blitz shares.` | **H** — `aggression stop` is an internal engine term (`aggrStopFromBlitzPct`) leaking into user copy |
| 2314/2317 | `Run Commit` + `AUTO — 0 (neutral box)` | **H** + **[R]** |
| 2329 | `Coverage Scheme` | **H** |
| 2341–2347 | `Safety Shell` (`Single-High`/`Two-High`), `Coverage Style`, `Cushion` (`Press`/`Off`), `Edge Discipline` (`Contain`/`Crash`), `Option Assignment` (`Contain QB`/`Take Pitch`), `Sub Philosophy` (`Match`/`Stay Base`), `Tackling` (`Wrap`/`Strip`) | **H** |
| 2354 | `AUTO — ${raw gp[field] value}` — prints internal enum values like `halfSlide`, `bracketTop`, `lockTop`, `spot` | **H** — raw camelCase state keys shown to the player |

### 6.9 HALFTIME / IN-GAME ADJUSTMENTS (`renderHalftimeAdjust`, lines 918–1107)

| Line | Exact string | Sev |
|---|---|---|
| 959–960 | `ADJUSTMENTS` / `the big knobs · switch to Advanced for full control` | M |
| 984–985 | `HALFTIME ADJUSTMENTS` / `big knobs only · fine detail lives on Situations & Depth` | M |
| 961/973/987/1043 | column headers `OFFENSE` / `DEFENSE` | — |
| 962/988 | `Play Tendency` + readout `RUN 45 / 55 PASS` | — |
| 963/989 | `Tempo` (`Chew`/`Normal`/`Hurry`) | **H** |
| 965 | `Protection` (labels `Quick Game`/`Half-Slide`/`BOB`/`Max Protect`) | **H** |
| 946 | 4th-down short labels `V.Cons` · `Cons` · `Mod` · `Aggr` · `V.Aggr` | **H** — truncated to near-unreadable |
| 951/1000 | `Passing Attack` (`Quick Game`/`Balanced`/`Attack Deep`) + readout `${short}/${medium}/${deep}` | **[R]** |
| 974/1044 | `Safety Shell` (`1-High`/`Mix`/`2-High`) | **H** |
| 975/1050 | `Coverage Style` (`Man`/`Mix`/`Zone`) | — |
| 976/1056 | `Cushion` (`Press`/`Mix`/`Off`) | **H** |
| 977 | `QB Spy` | M |
| 978 | `Green Dog` | **H** |
| 979/1096-ish | `Aggression` (`Bend`…`Bring the House`) | **H** |
| 1009 | `QB Designed Runs` | — |
| 1016 | `Protection Emphasis` (raw 0–100 value in `.ht-adj-cur`, line 1017) | **H** + **[R]** |
| 1023 | `QB Aggression` (raw 0–100 value, line 1024) | **[R]** |
| 1030 | `Screens` | — |
| 1036 | `LOS Freedom` (`Run the Call`/`Auto`/`Full Freedom`) | **H** |
| 1063 | `Edge Discipline` (`Crash`/`Balanced`/`Contain`) | **H** |
| 1069 | `Coverage Scheme` (`Lock WR1`/`Bracket WR1`) | **H** |
| 1075 | `Option / QB Key` (`Take Dive`/`Contain QB`/`Take Pitch`) | **H** |

### 6.10 Simple mode + special teams (lines 82–280, 2915–2954)

These are the file's **best** copy and should be the style target for the rewrite.

| Line | Exact string | Sev |
|---|---|---|
| 2918–2946 (`SIMPLE_DIALS`) | `Offensive Identity` (`Run-heavy`/`Balanced`/`Pass-heavy`), `Offensive Aggression` (`Play it safe`/`Aggressive`), `Defensive Posture` (`Bend, don't break`/`Attack`), `Tempo` (`Ball control`/`Normal`/`Fast`) with plain tips | — model copy |
| 2950–2953 (`SIMPLE_SITS`) | `3rd Down`, `Red Zone`, `When Trailing Late`, `When Leading Late` | — model copy |
| 219 | `TEAM IDENTITY` / `the sim handles the rest` | — |
| 233 | `These few dials set your whole scheme behind the scenes. Want the full control panel? Switch to Advanced up top.` | M (`scheme`) |
| 252 | `SITUATIONS` / `optional — leave on Auto and the sim decides` | — |
| 98 | `Return Scheme` + hint `(kickoffs & punts)` + options `Safe Hands`/`Balanced`/`Set the Wall` | M (`Scheme`) |
| 131 | `Punt Defense` + hint `(rush it or set the return)` + `Safe Return`/`Balanced`/`Go For Block` | — |
| 120 | `PAT Approach` + hint `(after touchdowns)` + `Kick It`/`By the Chart`/`Aggressive` | **H** (`PAT` unexpanded) |
| 127 | `AGGRESSIVE opens the full analytics card in the second half — up 1, down 9, down 16 —…` | M |
| 138 | `SAFE RETURN puts every body in the wall: +15% return yardage, no block threat.` | **[R]** |
| 142 | `Max FG Distance` | M (`FG`) |
| 109 | `Surprise Onside` + hint `(steal a possession)` + `Never`/`Armed — once per game` | — |

**Recommended rewrite strategy:** the file already has the right tool for this — `tipTerm(tipId, displayText)` from `js/ui/manual/tips.js` (used at lines 181, 546, 591, 789, 1281). For every **[H]** button label above, keep the real football term as the label but wrap it in `tipTerm()` and add a `TIPS` entry, rather than dumbing the term down — that matches CLAUDE.md rule 4 (real-football language is correct language) while giving the fan a one-tap gloss. Reserve outright renames for the terms that are *not* real football (`Zone Teaching`, `Sub Philosophy`, `Protection Identity`, `Pressure Identity`, `Usage Weights`, `Concept Weights`, `GLOBAL SHEET`, `inherit`, `author`, `Madden-style`, `PASS 5 trick tier`, `aggression stop`, `wizard grid`) and for the raw enum leak at line 2354. The **[R]** rows are non-negotiable — they breach the printed rule.

**Effort: L** (~150 strings across 10 sections; the `[R]` subset alone is **S–M** and should ship first).

---

---

## SHIPPED 2026-08-12 — the `[R]` hunk (rule violations)

Every `[R]` row above is closed, plus one the audit missed and two it
over-flagged. The distinction that settled every case:

> **Whose number is it?** A control the coach turns may show its own value, and a
> readout derived from his dials may show what it computes — that is the point of
> a scouting card. What may not be printed is what the SIM does with those
> values: effect sizes, weight tables, thresholds.

### Rewritten
| was | now |
|---|---|
| `play action: credible (0.62)` | `play action: credible` — the raw credibility coefficient is gone |
| `L 71 · M 68 · R 64 — settled (7/10)` | `left stout · middle solid · right gettable — settled, best behind the left` |
| `~20% fewer sacks` | `your QB gets his back foot down clean far more often` |
| `more interceptions (up to +25%)` | `a real jump in interceptions` |
| `+50% forced fumbles` | `far more balls on the ground` |
| `draws flags (+12% defensive penalties)` | `draws flags` |
| `burns legs (+35%/+20% fatigue)` | `burns legs on both sides of the ball` |
| `+20 stuffs the run (~0.6 fewer yds/carry) … (~+3–4% completions against)` | `crowd the box and the ground game dies, but every receiver runs free against a thinner secondary` |
| `SAFE RETURN … +15% return yardage` | `your best returns of the year come from this call` |
| `Pistol (100% of the dial); Spread (85%); Trips (70%); Air Raid (45%); Power-I (5%)` | ranked in words — built for Pistol, nearly as good from Spread, buys less from Trips or Air Raid, barely exists under center |
| `calling one concept on 30%+ of its snaps gets it jumped` | `ride one concept hard enough and it starts getting jumped` |
| `AUTO leans run by 25% here` / `AUTO passes 30% more often here` | `AUTO leans on the run here` / `AUTO already treats this as a passing down` |
| SIT_NUDGE `calls +30% more pass here` etc. | `throws here more than it normally would`, `leans on the run here`, `opens it up here`, `milks the clock here` |
| `Lighten −8` / `Commit +8` (and the ±10 pair) | `Lighten the box` / `Commit to the run` |
| `Reset to balanced (all 50)` | `Reset to an even call sheet` |
| `AUTO — 0 (neutral box)` | `AUTO — neutral box` |
| Option Rate hint `…70 = its natural rate` | hint ends at the mechanic |

### Missed by the audit, found by the probe
`js/ui/views/depthchart.js` — both the section tip and the per-slot
`title=` printed the featured-target threshold (`25%+ = featured`). The UI
**already** renders a ★ the moment a man crosses it, so the copy now points at
the badge instead of the number.

### Over-flagged — deliberately left alone
- **`AUTO — 40 / 40 / 20 (short/med/deep)`** on the situation sheet. Those three
  numbers are `gp.passDepth` — the coach's own standing sliders, echoed back as
  the baseline this cell would override. Showing a man his own setting is not
  leaking the model.
- **`Protection Emphasis` / `QB Aggression` raw 0–100 readouts.** That is a
  slider displaying its position. Hiding it would make the control unusable.

### The actual fix — `tools/help_rule_probe.mjs` (CORE)
Rewriting nineteen strings does not stop the twentieth. The rule now has a gate:
it scans static help copy (tip bodies plus the manual's TIPS tables), unescapes
`\uXXXX` and blanks `${…}` so live readouts are exempt by construction, and fails
on effect sizes, weight tables and thresholds. It is self-tested in both
directions — the ten strings that were live this morning must all trip it, and
six legitimate readouts must not — because a scanner that matches nothing looks
exactly like a clean codebase.

**Still open from this audit:** the `[H]`/`[M]` rename and `tipTerm()` wrapping
pass (~130 strings). Unchanged by this hunk.
