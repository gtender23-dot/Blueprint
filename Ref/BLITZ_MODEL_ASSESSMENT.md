# Blitz model assessment — where the game matches real football, and where it doesn't

Checked against Throw Deep's beginner blitz guide and Blitzology's "Blitz the
Formation," grounded in the actual sim code (js/engine/sim.js blitz resolver,
js/constants.js PRESS_IDENTITY) and confirmed with the pressure probe (N=150/cell).

## What the game gets RIGHT
- Blitz = 5+ rushers; the count rises with the aggression stop.
- All four real blitz types named + dispatched correctly: Fire Zone (zone blitz —
  a lineman drops, a backer comes, and the dropped man really covers), Second
  Level (LB heat), Secondary Heat (safety/corner blitz), The House (zero blitz).
- Sack/pressure rises with aggression and with the hotter identity (probe:
  fireZone 2.03 -> theHouse 2.33 sacks/game).
- "Blitz the formation" partially: selectDefFront auto-subs the FRONT by offensive
  personnel; _defLev shapes the blitz RATE by down (Selective sits early, unloads
  on passing downs).
- Counters exist: quick game / max protect / RB protection lower sacks; screens
  jackpot vs pressure; greenDog sends a free LB when the back stays in.

## What the game UNDER-MODELS (the real gap)

### 1. The coverage COST of the blitz is barely simulated (biggest gap)
Both sources stress the bargain: "the more you send, the fewer you have to cover."
The game records this but doesn't pay it:
- deepRisk is a DEAD field. Each PRESS_IDENTITY carries a deepRisk (fireZone 1.0,
  secondaryHeat 1.15, theHouse 1.5) meant to scale the vacated deep middle — never
  read anywhere.
- zeroBehind is a DEAD field. The zero-blitz flag is set, never consumed.
- Probe: Fire Zone -> The House lifts ypa only 5.96 -> 6.16 (+0.20), comp% flat.
  A zero blitz that doesn't get home should bleed ypa and completion% far more.
- Only the single blitzing DB opens ONE receiver (+0.14 sep), identical whether
  it's a contained fire zone or an all-out zero blitz.

### 2. No hot-route / sight-adjust
The guide's #1 counter is the quick throw to the man the blitzer vacated. The sim
has greenDog + screens but no QB hot read that punishes an unsound blitz.

### 3. Blitz is a RATE, not a called PACKAGE vs the formation
Blitzology's point is a named pressure that checks on a formation tell. The game
blitzes by probability + identity and subs the FRONT by personnel, but never
checks a specific pressure at a specific look. Most advanced, least essential.

## Recommended fixes (priority order)
A. Wire up deepRisk + zeroBehind — make the coverage cost real. Highest impact,
   smallest change. Scale vacated separation by identity deepRisk; a zero blitz
   opens a second (deep) receiver. Re-probe to keep sacks in band while ypa /
   explosives separate by identity.
B. Add a QB hot answer vs the blitz (AWR/TEC gets a quick completion to the
   vacated man). Medium change.
C. Formation-checked pressure (Blitz-the-Formation). Optional/advanced; larger.

---

# UPDATE — fixes implemented (all three)

All three recommended fixes are in and verified (blitz_reality_probe.mjs +
pressure_probe.mjs, N=120-200):

**A. Coverage cost is now real.** `deepRisk` + `zeroBehind` are wired: a fired
blitz opens the vacated man scaled by the identity's risk tier, and The House
(zero blitz) opens a SECOND deep receiver — nobody's home. The identities now
separate by ypa (fireZone 6.20 → theHouse 6.53, and secondaryHeat opens the
deep hole more than a pure backer blitz), while sacks stay in band. A good
coordinator's Blitz Design still shrinks the window.

**B. QB hot answer.** On a fired blitz, a heads-up QB (AWR/TEC, helped by Quick
Game protection, fought by the DC's disguise) finds the vacated man and gets it
out on rhythm — beating the free rusher. Probe: vs The House, a sharp QB (92)
completes ~62% and takes fewer sacks; a raw QB (55) completes ~55%.

**C. Blitz the formation.** Empty/spread passing looks (empty backfield = no
protection help) draw more pressure — sharper when the front runs its own
signature blitz and the DC's Blitz Design is high. Probe: an Empty set draws
more sacks than a Power-I against the same attacking defense.

Verification: pressure_probe ALL PASS (bands held), blitz_reality_probe ALL PASS
(the three behaviors confirmed), tree_probe 79/79, ui_playcall_smoke PASS, boot
0 errors. Files touched: js/engine/sim.js (constants unchanged — deepRisk/
zeroBehind were already defined, just never read). New probe:
tools/blitz_reality_probe.mjs.
