var PASS_CONCEPTS, RUN_CONCEPTS;

PASS_CONCEPTS = {
  // ── Quick game (short) ──
  "Mesh": {
    depth: "short",
    minWR: 2,
    motion: true,
    vs: { "Cover 0": 0.09, "Cover 1": 0.08, "Cover 2-Man": 0.06, "Cover 2": -0.02, "Cover 3": -0.04, "Cover 4": -0.04, "C3 Fire Zone": -0.01 },
    exec: { QB: { AWR: 0.5, TEC: 0.5 }, WR: { TEC: 0.6, AGI: 0.4 } }
  },
  "Slant-Flat": {
    depth: "short",
    choice: true,
    vs: { "Cover 0": 0.06, "Cover 1": 0.04, "Cover 2-Man": 0.02, "Cover 2": -0.01, "Cover 3": 0.03, "Cover 4": -0.03, "C3 Fire Zone": -0.05 },
    exec: { QB: { TEC: 0.6, AWR: 0.4 }, WR: { TEC: 0.5, SPD: 0.5 } }
  },
  "Stick": {
    depth: "short",
    choice: true,
    vs: { "Cover 0": 0.03, "Cover 1": 0.02, "Cover 2-Man": 0.02, "Cover 2": 0.04, "Cover 3": 0.02, "Cover 4": -0.02, "C3 Fire Zone": -0.05 },
    exec: { QB: { AWR: 0.7, TEC: 0.3 }, TE: { AWR: 0.5, TEC: 0.5 } }
  },
  "Shallow Cross": {
    depth: "short",
    minWR: 2,
    motion: true,
    vs: { "Cover 0": 0.07, "Cover 1": 0.06, "Cover 2-Man": 0.05, "Cover 2": -0.02, "Cover 3": -0.02, "Cover 4": -0.03, "C3 Fire Zone": -0.04 },
    exec: { QB: { AWR: 0.6, TEC: 0.4 }, WR: { SPD: 0.5, TEC: 0.5 } }
  },
  // Snag triangle: corner over a settling snag/pivot with the flat underneath —
  // a spacing zone-beater that finds the soft spot vs C2/C3; the pivot is the
  // man answer. (Viewer art existed before the concept did — "Spot" in
  // CONCEPT_ROUTES.) `routes` hints the sim's route-shape duel per receiver.
  "Spot": {
    depth: "short",
    choice: true,
    minWR: 2,
    routes: ["sharp", "sharp", "speed", "speed"],
    vs: { "Cover 0": 0.03, "Cover 1": 0.02, "Cover 2-Man": 0.02, "Cover 2": 0.04, "Cover 3": 0.05, "Cover 4": -0.01, "C3 Fire Zone": -0.02 },
    exec: { QB: { AWR: 0.6, TEC: 0.4 }, WR: { TEC: 0.6, AGI: 0.4 } }
  },
  // ── Screens (short, callable — they force the screen mechanic) ──
  "Bubble Screen": {
    depth: "short",
    minWR: 2,
    screen: "bubble",
    // perimeter now-screen: cashes in when they blitz or press. Cover 2's hard
    // flat corner is the universal bubble-killer (spec decision: -0.06).
    vs: { "Cover 0": 0.08, "Cover 1": 0.05, "Cover 2-Man": 0.03, "Cover 2": -0.06, "Cover 3": 0.02, "Cover 4": -0.03, "C3 Fire Zone": 0.06 },
    exec: { QB: { TEC: 0.6, AWR: 0.4 }, WR: { AGI: 0.6, SPD: 0.4 } }
  },
  "Tunnel Screen": {
    depth: "short",
    minWR: 2,
    screen: "tunnel",
    // WR screen back inside behind blockers — best vs soft, upfield rush
    vs: { "Cover 0": 0.04, "Cover 1": 0.03, "Cover 2-Man": 0.02, "Cover 2": 0.03, "Cover 3": 0.05, "Cover 4": 0.04, "C3 Fire Zone": 0.03 },
    exec: { QB: { TEC: 0.5, AWR: 0.5 }, WR: { AGI: 0.5, SPD: 0.5 } }
  },
  "RB Screen": {
    depth: "short",
    screen: "rb",
    // classic back screen — punishes a heavy rush
    vs: { "Cover 0": 0.07, "Cover 1": 0.05, "Cover 2-Man": 0.03, "Cover 2": -0.01, "Cover 3": 0.01, "Cover 4": -0.02, "C3 Fire Zone": 0.07 },
    exec: { QB: { AWR: 0.6, TEC: 0.4 }, RB: { AGI: 0.5, HND: 0.5 } }
  },
  // [Creativity Tools P1a MECHANIC, 2026-08-13] Slip Screen — a receiver slips
  // behind the line on the BACKSIDE of jet/sweep action, outnumbering the defense
  // away from the flow. A 4th screen kind (sim: WR target; viewer: backside slip
  // geometry). Cashes in on over-pursuit and blitz; a disciplined C2 flat kills it.
  "Slip Screen": {
    depth: "short",
    screen: "slip",
    vs: { "Cover 0": 0.06, "Cover 1": 0.04, "Cover 2-Man": 0.03, "Cover 2": -0.02, "Cover 3": 0.02, "Cover 4": -0.02, "C3 Fire Zone": 0.06 },
    exec: { QB: { AWR: 0.6, TEC: 0.4 }, WR: { AGI: 0.6, SPD: 0.4 } }
  },
  // ── Dropback (medium) ──
  "Smash": {
    depth: "medium",
    vs: { "Cover 2": 0.09, "Cover 2-Man": 0.04, "Cover 0": 0.01, "Cover 1": -0.01, "Cover 3": -0.04, "Cover 4": -0.05, "C3 Fire Zone": -0.02 },
    exec: { QB: { AWR: 0.6, TEC: 0.4 }, WR: { TEC: 0.6, JMP: 0.4 } }
  },
  // [Creativity Tools P1a, 2026-08-13] Seam-Read Smash — Smash with the #2 running
  // a seam that READS the safety (peel behind a rotating single-high, bend on
  // two-high). Trades a little of base Smash's pure Cover-2 punch for real life
  // vs single-high: Smash dies vs C3 (-0.04), this one is +0.02 there. The smarter,
  // more coverage-neutral version.
  "Seam-Read Smash": {
    depth: "medium",
    minWR: 2,
    vs: { "Cover 2": 0.07, "Cover 2-Man": 0.04, "Cover 3": 0.02, "Cover 1": 0.01, "Cover 0": 0.01, "Cover 4": -0.04, "C3 Fire Zone": -0.03 },
    exec: { QB: { AWR: 0.6, TEC: 0.4 }, WR: { TEC: 0.6, JMP: 0.4 } }
  },
  // [Creativity Tools P1a MECHANIC, 2026-08-13] Boot — play-action bootleg: the QB
  // fakes the run, rolls to one side, and throws a flood/high-low on the move. The
  // rollout gets him off the interior rush and holds the flat/curl defenders with
  // the run fake — a man/single-high answer, capped by a disciplined two-high flat.
  // The `boot` flag drives the viewer's designed QB rollout (reuses the lateral
  // launch machinery); paNative shows the fake. Band-neutral: a normal vs-table.
  "Boot": {
    depth: "medium",
    paNative: true,
    boot: true,
    vs: { "Cover 0": 0.04, "Cover 1": 0.05, "Cover 2-Man": 0.03, "Cover 2": -0.01, "Cover 3": 0.05, "Cover 4": -0.03, "C3 Fire Zone": 0.00 },
    exec: { QB: { AWR: 0.5, TEC: 0.5 }, WR: { TEC: 0.5, SPD: 0.5 } }
  },
  "Curl-Flat": {
    depth: "medium",
    choice: true,
    vs: { "Cover 3": 0.06, "Cover 1": 0.02, "Cover 0": 0.02, "Cover 2": -0.02, "Cover 2-Man": -0.01, "Cover 4": -0.03, "C3 Fire Zone": -0.02 },
    exec: { QB: { TEC: 0.5, AWR: 0.5 }, WR: { TEC: 0.7, AGI: 0.3 } }
  },
  "Flood": {
    depth: "medium",
    minWR: 2,
    motion: true,
    vs: { "Cover 3": 0.08, "C3 Fire Zone": 0.05, "Cover 2": 0.02, "Cover 0": -0.02, "Cover 1": -0.03, "Cover 2-Man": -0.04, "Cover 4": -0.04 },
    exec: { QB: { AWR: 0.7, TEC: 0.3 }, TE: { SPD: 0.4, TEC: 0.6 } }
  },
  "Y-Cross": {
    depth: "medium",
    motion: true,
    vs: { "Cover 1": 0.05, "Cover 3": 0.04, "Cover 0": 0.03, "Cover 2": -0.02, "Cover 2-Man": 0.01, "Cover 4": -0.05, "C3 Fire Zone": -0.04 },
    exec: { QB: { AWR: 0.5, TEC: 0.5 }, TE: { SPD: 0.6, TEC: 0.4 } }
  },
  "Dagger": {
    depth: "medium",
    minWR: 2,
    vs: { "Cover 3": 0.06, "Cover 1": 0.03, "Cover 4": 0.02, "Cover 2": -0.03, "Cover 0": -0.02, "Cover 2-Man": -0.02, "C3 Fire Zone": -0.03 },
    exec: { QB: { AWR: 0.6, TEC: 0.4 }, WR: { SPD: 0.6, TEC: 0.4 } }
  },
  // Three-level boundary flood off the corner route (go clears, sail/out at
  // 12, flat under) — stretches a 3-deep zone vertically without needing
  // motion the way Flood does. `breaks: "out"` tells the duel these routes
  // break to the boundary, so they attack a defender leaning the other way.
  "Sail": {
    depth: "medium",
    minWR: 2,
    breaks: "out",
    vs: { "Cover 3": 0.07, "C3 Fire Zone": 0.04, "Cover 2": 0.03, "Cover 4": -0.02, "Cover 0": -0.03, "Cover 1": -0.03, "Cover 2-Man": -0.04 },
    exec: { QB: { AWR: 0.6, TEC: 0.4 }, WR: { TEC: 0.5, SPD: 0.5 } }
  },
  // Two in-cuts at different depths high-lowing the same underneath defender —
  // the classic man/Cover-2 answer. All hard plants (`routes` all-sharp), all
  // breaking inside (`breaks: "in"`): great when the leverage concedes the
  // middle, walled off when a defender sits inside without help.
  "Levels": {
    depth: "medium",
    minWR: 2,
    breaks: "in",
    routes: ["sharp", "sharp", "sharp", "speed"],
    vs: { "Cover 0": 0.05, "Cover 1": 0.05, "Cover 2-Man": 0.04, "Cover 2": 0.03, "Cover 3": -0.02, "Cover 4": 0.02, "C3 Fire Zone": -0.03 },
    exec: { QB: { AWR: 0.7, TEC: 0.3 }, WR: { TEC: 0.6, AGI: 0.4 } }
  },
  // ── Shot plays (deep) ──
  "Four Verts": {
    depth: "deep",
    minWR: 3,
    vs: { "Cover 3": 0.07, "Cover 2": 0.05, "Cover 0": 0.04, "Cover 1": -0.02, "Cover 2-Man": -0.02, "Cover 4": -0.07, "C3 Fire Zone": -0.03 },
    exec: { QB: { TEC: 0.5, AWR: 0.5 }, WR: { SPD: 0.7, TEC: 0.3 } }
  },
  "Post-Wheel": {
    depth: "deep",
    minWR: 2,
    motion: true,
    vs: { "Cover 2-Man": 0.06, "Cover 1": 0.05, "Cover 0": 0.05, "Cover 2": -0.01, "Cover 3": -0.03, "Cover 4": -0.06, "C3 Fire Zone": -0.04 },
    exec: { QB: { AWR: 0.5, TEC: 0.5 }, WR: { SPD: 0.6, AGI: 0.4 } }
  },
  "PA Deep Cross": {
    depth: "deep",
    paNative: true,
    vs: { "Cover 1": 0.06, "Cover 3": 0.05, "Cover 0": -0.02, "Cover 2": -0.01, "Cover 2-Man": 0.01, "Cover 4": -0.05, "C3 Fire Zone": -0.02 },
    exec: { QB: { TEC: 0.6, AWR: 0.4 }, WR: { SPD: 0.5, TEC: 0.5 } }
  },
  // [Creativity Tools P1a, 2026-08-13] Yankee — the two-man play-action MOF shot:
  // a deep post over a dig/climb, built to kill single-high coverage (the post
  // holds the one deep safety, the dig sits behind the run-frozen linebackers).
  // Where PA Deep Cross is the crosser, this is the vertical post shot. Deadly vs
  // C1/C3, capped by two-high safeties (C4).
  "Yankee": {
    depth: "deep",
    paNative: true,
    minWR: 2,
    vs: { "Cover 1": 0.07, "Cover 3": 0.05, "Cover 2": 0.02, "Cover 0": 0.02, "Cover 2-Man": 0.01, "Cover 4": -0.05, "C3 Fire Zone": -0.02 },
    exec: { QB: { AWR: 0.5, TEC: 0.5 }, WR: { SPD: 0.5, TEC: 0.5 } }
  },
  "Mills (Post-Dig)": {
    depth: "deep",
    minWR: 2,
    vs: { "Cover 4": 0.07, "Cover 2": 0.03, "Cover 1": 0.01, "Cover 3": -0.03, "Cover 0": -0.01, "Cover 2-Man": -0.02, "C3 Fire Zone": -0.03 },
    exec: { QB: { AWR: 0.7, TEC: 0.3 }, WR: { TEC: 0.5, SPD: 0.5 } }
  },
  // The called double move: sluggo (slant-and-go) outside with a seam behind
  // it, out-and-up on the backside. `dbl: true` features the double move on
  // the primary read — the aggressive man corner who jumps the slant is the
  // whole point; a disciplined two-high defense doesn't bite.
  "Sluggo Seam": {
    depth: "deep",
    minWR: 2,
    dbl: true,
    vs: { "Cover 0": 0.06, "Cover 1": 0.06, "Cover 2-Man": 0.04, "Cover 3": 0.03, "Cover 2": -0.02, "Cover 4": -0.06, "C3 Fire Zone": -0.02 },
    exec: { QB: { TEC: 0.5, AWR: 0.5 }, WR: { SPD: 0.5, TEC: 0.5 } }
  },
  // Back-shoulder / red-zone jump ball to your designated FADE target (a WR/TE
  // mesh bucket in the depth chart). Wins on man/press, dies vs zone help.
  // Red-Zone Fade (CORRECTED Jul 2026 per playbook spec): a SHORT–MEDIUM
  // back-shoulder jump ball to an OUTSIDE receiver — a single isolated route to
  // your best jump-ball WR, not a deep shot. (The DEEP back-shoulder fade lives
  // on Four Verts' outside routes.) Wins 1-on-1 on man/press; dies vs zone help.
  "Red-Zone Fade": {
    depth: "medium",
    fade: true,
    fadeOutside: true,
    vs: { "Cover 0": 0.1, "Cover 1": 0.08, "Cover 2-Man": 0.06, "Cover 2": -0.02, "Cover 3": -0.03, "Cover 4": -0.05, "C3 Fire Zone": 0.02 },
    exec: { QB: { TEC: 0.6, AWR: 0.4 }, WR: { JMP: 0.5, HND: 0.5 } }
  },
  // ── PASS 5: trick-play tier (bespoke resolvers — never picked by the
  // generic concept roll; the gadget dial / call sheet fires them) ──
  // Flea Flicker: RB tosses back to the QB; the fake-block receivers release
  // deep. Cashes in vs a run-committed look; the toss-back eats the clock, so
  // the pocket exposure is real (paBite driven NEGATIVE into the rush).
  "Flea Flicker": {
    depth: "deep",
    resolver: "fleaflicker",
    exec: { QB: { TEC: 0.5, AWR: 0.5 }, WR: { SPD: 0.6, TEC: 0.4 } }
  },
  // HB Pass: sweep action, then the halfback pulls up and throws deep. The
  // back IS the thrower — his TEC/AWR price the arm; the run bite buys the
  // separation.
  "HB Pass": {
    depth: "deep",
    resolver: "hbpass",
    exec: { RB: { TEC: 0.6, AWR: 0.4 }, WR: { SPD: 0.6, TEC: 0.4 } }
  },
  // ── [Creativity Tools P1a, 2026-08-13] catalog expansion (batch B) ──────────
  // Short quick game
  "Spacing": {
    depth: "short",
    minWR: 3,
    // hitches at spaced landmarks — sit in the zone holes; a man team just walls it
    vs: { "Cover 0": -0.02, "Cover 1": -0.02, "Cover 2-Man": -0.03, "Cover 2": 0.04, "Cover 3": 0.05, "Cover 4": 0.03, "C3 Fire Zone": -0.01 },
    exec: { QB: { AWR: 0.6, TEC: 0.4 }, WR: { TEC: 0.6, AWR: 0.4 } }
  },
  "Double Slants": {
    depth: "short",
    // quick rub — a man-coverage killer; zone hook/curl defenders sit in the throw
    vs: { "Cover 0": 0.06, "Cover 1": 0.05, "Cover 2-Man": 0.05, "Cover 2": -0.02, "Cover 3": -0.02, "Cover 4": -0.03, "C3 Fire Zone": -0.03 },
    exec: { QB: { TEC: 0.6, AWR: 0.4 }, WR: { AGI: 0.5, SPD: 0.5 } }
  },
  "Hoss": {
    depth: "short",
    // hitch-seam: the seam beats man, the hitch is the blitz-hot answer
    vs: { "Cover 0": 0.05, "Cover 1": 0.04, "Cover 2-Man": 0.03, "Cover 2": 0.01, "Cover 3": -0.01, "Cover 4": -0.03, "C3 Fire Zone": 0.03 },
    exec: { QB: { TEC: 0.5, AWR: 0.5 }, WR: { TEC: 0.5, SPD: 0.5 } }
  },
  // Medium dropback
  "Drive": {
    depth: "medium",
    motion: true,
    // shallow + dig behind it — a middle-of-field man beater with a zone answer
    vs: { "Cover 0": 0.03, "Cover 1": 0.05, "Cover 2-Man": 0.03, "Cover 2": 0.00, "Cover 3": 0.03, "Cover 4": -0.02, "C3 Fire Zone": -0.03 },
    exec: { QB: { AWR: 0.6, TEC: 0.4 }, WR: { TEC: 0.6, AGI: 0.4 } }
  },
  "Bench": {
    depth: "medium",
    // hitch-and-out at the numbers — punishes soft corners and spot-drop zone
    vs: { "Cover 0": -0.02, "Cover 1": -0.02, "Cover 2-Man": -0.02, "Cover 2": 0.03, "Cover 3": 0.05, "Cover 4": 0.02, "C3 Fire Zone": -0.02 },
    exec: { QB: { TEC: 0.6, AWR: 0.4 }, WR: { TEC: 0.6, SPD: 0.4 } }
  },
  "Stick-Nod": {
    depth: "medium",
    // stick with a go tag — burns a flat/curl defender who jumps the stick
    vs: { "Cover 0": 0.02, "Cover 1": 0.02, "Cover 2-Man": 0.02, "Cover 2": 0.05, "Cover 3": 0.03, "Cover 4": -0.03, "C3 Fire Zone": -0.02 },
    exec: { QB: { AWR: 0.6, TEC: 0.4 }, TE: { TEC: 0.5, SPD: 0.5 } }
  },
  // Deep shots
  "Scissors": {
    depth: "deep",
    // post-corner switch release — a man-coverage deep beater
    vs: { "Cover 0": 0.04, "Cover 1": 0.05, "Cover 2-Man": 0.04, "Cover 2": -0.02, "Cover 3": -0.01, "Cover 4": -0.03, "C3 Fire Zone": -0.03 },
    exec: { QB: { TEC: 0.5, AWR: 0.5 }, WR: { SPD: 0.5, AGI: 0.5 } }
  },
  "Skinny Post": {
    depth: "deep",
    // bang-8: a quick skinny post threaded between the single-high safety and the
    // hash — the single-high killer, dead vs two capping safeties (quarters)
    vs: { "Cover 0": 0.02, "Cover 1": 0.05, "Cover 2-Man": 0.01, "Cover 2": 0.01, "Cover 3": 0.05, "Cover 4": -0.04, "C3 Fire Zone": -0.02 },
    exec: { QB: { STR: 0.5, AWR: 0.5 }, WR: { SPD: 0.6, TEC: 0.4 } }
  },
  // ── [Creativity Tools P1a, 2026-08-13] catalog expansion (batch C → ≈40) ────
  "Whip": {
    depth: "short",
    // whip/return: sell in, break out (or vice versa) — a quick man-coverage beater
    vs: { "Cover 0": 0.05, "Cover 1": 0.05, "Cover 2-Man": 0.04, "Cover 2": -0.01, "Cover 3": 0.00, "Cover 4": -0.02, "C3 Fire Zone": 0.02 },
    exec: { QB: { TEC: 0.5, AWR: 0.5 }, WR: { AGI: 0.6, TEC: 0.4 } }
  },
  "Follow": {
    depth: "medium",
    motion: true,
    // two stacked crossers, one following the other — a man-coverage rub/pick
    vs: { "Cover 0": 0.05, "Cover 1": 0.04, "Cover 2-Man": 0.04, "Cover 2": -0.01, "Cover 3": -0.02, "Cover 4": -0.03, "C3 Fire Zone": -0.02 },
    exec: { QB: { AWR: 0.6, TEC: 0.4 }, WR: { AGI: 0.5, SPD: 0.5 } }
  },
  "Y-Option": {
    depth: "medium",
    choice: true,
    // the tight end reads the defender's leverage and breaks to grass — coverage-neutral
    vs: { "Cover 0": 0.04, "Cover 1": 0.04, "Cover 2-Man": 0.03, "Cover 2": 0.02, "Cover 3": 0.02, "Cover 4": -0.02, "C3 Fire Zone": -0.03 },
    exec: { QB: { AWR: 0.6, TEC: 0.4 }, TE: { AWR: 0.5, TEC: 0.5 } }
  },
  "Deep Out": {
    depth: "medium",
    // 15-yard out at the numbers — an arm throw that carves soft/off zone
    vs: { "Cover 0": -0.01, "Cover 1": 0.01, "Cover 2-Man": 0.02, "Cover 2": 0.02, "Cover 3": 0.04, "Cover 4": 0.01, "C3 Fire Zone": -0.03 },
    exec: { QB: { STR: 0.6, TEC: 0.4 }, WR: { TEC: 0.6, SPD: 0.4 } }
  },
  "Comeback": {
    depth: "deep",
    // deep comeback — the answer to a corner giving cushion; needs arm and timing
    vs: { "Cover 0": -0.01, "Cover 1": 0.02, "Cover 2-Man": 0.02, "Cover 2": 0.02, "Cover 3": 0.05, "Cover 4": 0.03, "C3 Fire Zone": -0.03 },
    exec: { QB: { STR: 0.6, TEC: 0.4 }, WR: { TEC: 0.6, AGI: 0.4 } }
  },
  "Corner-Post": {
    depth: "deep",
    // double move: stem the corner, break back to the post — a deep man beater
    vs: { "Cover 0": 0.04, "Cover 1": 0.05, "Cover 2-Man": 0.04, "Cover 2": 0.00, "Cover 3": -0.01, "Cover 4": -0.03, "C3 Fire Zone": -0.03 },
    exec: { QB: { STR: 0.5, AWR: 0.5 }, WR: { SPD: 0.5, TEC: 0.5 } }
  },
  "Deep Over": {
    depth: "deep",
    motion: true,
    // a backside receiver runs the deep over behind the coverage drop — single-high killer
    vs: { "Cover 1": 0.05, "Cover 3": 0.04, "Cover 2": 0.02, "Cover 0": 0.02, "Cover 2-Man": 0.02, "Cover 4": -0.04, "C3 Fire Zone": -0.03 },
    exec: { QB: { AWR: 0.6, TEC: 0.4 }, WR: { SPD: 0.6, TEC: 0.4 } }
  }
};
RUN_CONCEPTS = {
  // vsBox: tilt vs (loaded | light) boxes; existing mechanics (option, jet,
  // draw, wildcat) keep their own resolvers and take concept NAMES only.
  "Inside Zone": {
    type: "run_inside",
    vsBox: { loaded: -0.02, light: 0.04 },
    // PASS 5: RPO tag — the glance/pop off inside zone reads the box backer
    // (STACKER mesh). tag = the quick throw; conflict = the mesh role read.
    rpo: { tag: "glance", conflict: "STACKER" },
    exec: { OL: { TEC: 0.6, AGI: 0.4 }, RB: { AWR: 0.5, AGI: 0.5 } }
  },
  // [Creativity Tools P1a, 2026-08-13] Split-Zone — inside zone with a backside
  // "split" block (an H-back/TE kicks the backside edge). That cutoff handles the
  // extra loaded-box defender inside zone can't, and opens the cutback — so it is
  // the same family but a touch better against a loaded box, worse against a light
  // one (fewer bodies to widen). Reads the Mike; carries the same glance RPO.
  // Renders on the inside-run resolver (type run_inside) — no new viewer art.
  "Split-Zone": {
    type: "run_inside",
    vsBox: { loaded: 0.01, light: 0.03 },
    rpo: { tag: "glance", conflict: "STACKER" },
    exec: { OL: { TEC: 0.6, AGI: 0.4 }, RB: { AWR: 0.5, AGI: 0.5 } }
  },
  // one-cut vision
  "Power": {
    type: "run_inside",
    pulls: true,
    vsBox: { loaded: 0.02, light: 0.01 },
    // PASS 5: RPO tag — the backside slant off power reads the box backer.
    rpo: { tag: "slant", conflict: "STACKER" },
    exec: { OL: { STR: 0.6, TEC: 0.4 }, RB: { STR: 0.5, AWR: 0.5 } }
  },
  "Iso": {
    type: "run_inside",
    vsBox: { loaded: -0.01, light: 0.02 },
    exec: { FB: { STR: 0.6, TEC: 0.4 }, RB: { STR: 0.6, AWR: 0.4 } }
  },
  "Trap": {
    type: "run_inside",
    pulls: true,
    vsBox: { loaded: 0.03, light: -0.01 },
    exec: { OL: { AGI: 0.5, TEC: 0.5 }, RB: { AWR: 0.6, AGI: 0.4 } }
  },
  // punishes upfield DTs
  "Outside Zone": {
    type: "run_outside",
    vsBox: { loaded: -0.01, light: 0.03 },
    // PASS 5: RPO tag — the bubble off wide zone reads the overhang.
    rpo: { tag: "bubble", conflict: "OVERHANG" },
    exec: { OL: { AGI: 0.6, TEC: 0.4 }, RB: { AWR: 0.6, SPD: 0.4 } }
  },
  "Counter": {
    type: "run_outside",
    pulls: true,
    vsBox: { loaded: 0.02, light: 0.01 },
    punishes: "crash",
    // eats crash edges
    exec: { OL: { STR: 0.5, AGI: 0.5 }, RB: { AWR: 0.5, AGI: 0.5 } }
  },
  "Toss": {
    type: "run_outside",
    vsBox: { loaded: -0.02, light: 0.04 },
    // PASS 5: RPO tag — the bubble off toss action reads the overhang.
    rpo: { tag: "bubble", conflict: "OVERHANG" },
    exec: { QB: { TEC: 1 }, RB: { SPD: 0.7, AGI: 0.3 } }
  },
  // QB sneak — the QB keeps it behind the center's push. Short-yardage / goal-line
  // hammer; forces the QB as the carrier (see _forceQBRun handling in the run resolver).
  "QB Sneak": {
    type: "run_inside",
    qbSneak: true,
    vsBox: { loaded: 0.01, light: 0.02 },
    exec: { OL: { STR: 0.7, TEC: 0.3 }, QB: { STR: 0.6, AWR: 0.4 } }
  },
  // QB Power — the first designed QB run that isn't a sneak: backside guard
  // pulls, QB follows him downhill with an extra hat in the box (the RB is a
  // lead blocker now, not a carrier the defense can key). `qbCarry` forces the
  // QB as the ball carrier through the normal run resolution (pulls and all),
  // unlike qbSneak's push-pile special case.
  "QB Power": {
    type: "run_inside",
    pulls: true,
    qbCarry: true,
    vsBox: { loaded: 0.02, light: 0.02 },
    exec: { OL: { STR: 0.6, TEC: 0.4 }, QB: { STR: 0.5, AGI: 0.5 } }
  },
  // ── M3 (D6, 2026-08-17): the authored RPO / QB-run family (#45/#46) ────────
  // Ratified in Ref/RPO_AUDIT_2026-08-16.md §7. These five are REAL plays with
  // their own art, blurbs and resolution seams — never "any run becomes a QB
  // run" (the QB_RUN_BASE dice are retired to a broken-play floor in sim.js).
  //
  // Zone Read — the RPO+QB-run type's designed keep (#46): inside-zone give
  // with the backside edge read. `zoneRead` routes the snap through the edge-
  // key read in simulateDrive: give = IZ to the back, keep = the QB out the
  // backside where the crashing end vacated. edgePlay contain / optionKey=qb
  // starve the keep; crash feeds it.
  "Zone Read": {
    type: "run_inside",
    zoneRead: true,
    vsBox: { loaded: -0.01, light: 0.04 },
    exec: { OL: { TEC: 0.6, AGI: 0.4 }, QB: { AWR: 0.6, SPD: 0.4 }, RB: { AWR: 0.5, AGI: 0.5 } }
  },
  // RPO Glance / RPO Bubble — the authored versions of the old bolt-on tags,
  // with their own cards/routes. `rpo.always` makes the CALL an RPO every
  // snap (no volume dice); the conflict read prices give/throw, and the M3
  // keep phase (gameplan.rpoKeepPct, mobility-scaled) prices the QB pull-and-
  // run — the three-way read of #46.
  "RPO Glance": {
    type: "run_inside",
    rpo: { tag: "glance", conflict: "STACKER", always: true, keep: true },
    vsBox: { loaded: -0.01, light: 0.03 },
    exec: { QB: { AWR: 0.6, TEC: 0.4 }, OL: { TEC: 0.6, AGI: 0.4 }, RB: { AWR: 0.5, AGI: 0.5 } }
  },
  "RPO Bubble": {
    type: "run_outside",
    rpo: { tag: "bubble", conflict: "OVERHANG", always: true, keep: true },
    vsBox: { loaded: -0.02, light: 0.04 },
    exec: { QB: { TEC: 0.6, AWR: 0.4 }, WR: { AGI: 0.6, SPD: 0.4 }, RB: { AWR: 0.5, SPD: 0.5 } }
  },
  // QB Draw — a designed QB run off a pass look: the line shows pass set and
  // turns it into run blocking, the QB slips out late. `qbDraw` routes it
  // through the draw sniff/caught-blitz machinery with the QB as the carrier.
  "QB Draw": {
    type: "run_inside",
    qbCarry: true,
    qbDraw: true,
    vsBox: { loaded: -0.01, light: 0.04 },
    exec: { OL: { TEC: 0.6, AGI: 0.4 }, QB: { SPD: 0.5, AGI: 0.5 } }
  },
  // QB Counter — the gap-scheme designed QB run (counter bash): backside
  // guard pulls, the QB follows the kick-out off tackle. Rides the same
  // qbCarry+pulls machinery QB Power proved.
  "QB Counter": {
    type: "run_outside",
    pulls: true,
    qbCarry: true,
    punishes: "crash",
    vsBox: { loaded: 0.02, light: 0.01 },
    exec: { OL: { STR: 0.5, AGI: 0.5 }, QB: { AGI: 0.5, AWR: 0.5 } }
  },
  // PASS 5: true trick plays (bespoke resolvers, gadget tier). Reverse is a
  // run gadget; Flea Flicker / HB Pass live in PASS_CONCEPTS below.
  "Reverse": { resolver: "reverse" },
  // Named pointers to existing mechanics (resolver: unchanged):
  "Triple Option": { resolver: "option" },
  "Speed Option": { resolver: "option-speed" },
  "Jet Sweep": { resolver: "jet" },
  "Draw": { resolver: "draw" },
  "Wildcat Power": { resolver: "wildcat" },
  // ── [Creativity Tools P1a, 2026-08-13] catalog expansion (batch B) ──────────
  "Wham": {
    type: "run_inside",
    // an interior DT left free, then washed by an H-back/FB "wham" block — turns
    // a penetrating, loaded box against itself; less to work with vs a light one.
    vsBox: { loaded: 0.03, light: -0.01 },
    exec: { OL: { TEC: 0.5, AGI: 0.5 }, RB: { AWR: 0.6, AGI: 0.4 } }
  },
  "Buck Sweep": {
    type: "run_outside",
    pulls: true,
    // both guards pull to lead outside — classic wing-T power on the perimeter
    vsBox: { loaded: 0.01, light: 0.03 },
    exec: { OL: { AGI: 0.6, STR: 0.4 }, RB: { SPD: 0.5, AWR: 0.5 } }
  },
  "Pin-and-Pull": {
    type: "run_outside",
    pulls: true,
    // outside zone with pin-and-pull blocking — a perimeter runner that loves a
    // light box and space to get the edge
    vsBox: { loaded: -0.01, light: 0.04 },
    exec: { OL: { AGI: 0.6, TEC: 0.4 }, RB: { SPD: 0.6, AGI: 0.4 } }
  },
  "Dart": {
    type: "run_inside",
    pulls: true,
    // backside tackle pulls through for the down-block gap run — a Power cousin
    vsBox: { loaded: 0.02, light: 0.02 },
    exec: { OL: { STR: 0.5, AGI: 0.5 }, RB: { AWR: 0.5, AGI: 0.5 } }
  }
};

// ── PASS 3 (Aug 2026): vs columns for the called coverage families ──────────
// Derived, not hand-rolled per concept, because each new family IS a stated
// combination of families the tables already price:
//   Cover 6  = quarters to the field + cloud to the boundary → the mean of the
//              Cover 4 and Cover 2 columns (split field, split answer).
//   Tampa 2  = the Cover 2 column with the pole runner closing the deep middle
//              (seam/middle-shot concepts lose their C2 edge) and the vacated
//              hook sweetening the shallow middle game.
//   Prevent  = depth is the whole story: deep shots die, everything underneath
//              is served — by design, that's the trade the call makes.
//   2-Man    already has its own hand-authored column ("Cover 2-Man").
// Per-concept exceptions live in the two Sets, visible and editable.
var TAMPA_SEAM = /* @__PURE__ */ new Set(["Four Verts", "Dagger", "PA Deep Cross", "Mills (Post-Dig)", "Sluggo Seam", "Y-Cross"]);
var TAMPA_HOOK = /* @__PURE__ */ new Set(["Mesh", "Shallow Cross", "Stick", "Spot", "Levels"]);
for (const [nm, c] of Object.entries(PASS_CONCEPTS)) {
  if (!c.vs) continue;
  const v = c.vs;
  const r2 = (x) => Math.round(x * 100) / 100;
  const c2 = v["Cover 2"] != null ? v["Cover 2"] : 0;
  const c4 = v["Cover 4"] != null ? v["Cover 4"] : 0;
  if (v["Cover 6"] == null) v["Cover 6"] = r2((c2 + c4) / 2);
  if (v["Tampa 2"] == null) v["Tampa 2"] = r2(c2 + (TAMPA_SEAM.has(nm) ? -0.05 : 0) + (TAMPA_HOOK.has(nm) ? 0.03 : 0));
  if (v["Prevent"] == null) v["Prevent"] = c.depth === "deep" ? -0.1 : c.depth === "medium" ? 0.02 : 0.06;
}

export { PASS_CONCEPTS, RUN_CONCEPTS };
