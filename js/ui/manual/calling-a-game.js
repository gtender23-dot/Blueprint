// Written from: engine/situations.js (the situation ladder, effective plan, weekly
// presets and defaults), concepts.js (the pass concepts and their design laws),
// engine/sim.js (play-type and concept selection, execution, the repetition penalty,
// tempo clock scaling), ui/app.js (the live plan report).
// Slimmed Aug 2026 — persona removed, cut to reference length.
// Second pass Aug 2026 — sentence-level compression; every claim retained.
var chapter8 = {
  id: 'calling-a-game',
  icon: '📋',
  title: 'Calling a Game',
  blurb: 'Every dial on the sheet and what it costs — including the ones that look free.',
  sections: [
    {
      heading: 'One situation, and only one',
      body: `Every snap lands in exactly one situation: a fixed ladder walked from the top, stopping at the
      first match — goal line, backed up, two-minute and trailing, four-minute and leading, red
      zone, third and short, medium, long, second and long, first down, base.

      The order is the mechanic: <b>field zone outranks down and distance</b>, so third and long
      inside the red zone runs on the red zone plan and a carefully built third-down package fires
      less often than it looks.

      Each sideline resolves from its own frame: one snap, one team in two-minute mode and its
      opponent in four-minute.`,
    },
    {
      heading: 'Three sheets, two ways of stacking',
      body: `The base plan is the standing call. A situation cell overrides it for that situation only and
      inherits the base wherever it is left alone: a patch, not a new sheet.

      The weekly plan works two ways. Pass lean, blitz rate and run commit are <b>shifts</b>
      stacking on what the situational plan produced; coverage, pass depth and tempo are
      <b>overrides</b> replacing the standing call for the week. No weekly front dial exists; fronts
      stay situational, set per cell.

      A weekly coverage call therefore ignores every cell's coverage, while a weekly blitz shift
      respects them all and nudges each.`,
    },
    {
      heading: 'Tendency, and the cost of an extreme',
      body: `Leave a cell's tendency alone and it runs on the engine's own situational sense: pass on third
      and long, run on third and short, chase points when trailing late, drain the clock when
      leading late. Set it yourself and those nudges are gone, replaced.

      Extremes stay extreme by design: an offense told always to throw throws on third and inches.`,
    },
    {
      heading: 'The rest of the offensive sheet',
      body: `<b>Pass depth</b> is a weight, not a percentage: the sliders need not add up, and the mix
      comes off their relative sizes. <b>Quarterback aggression</b> then shifts that mix underneath
      you: a gunslinger swaps short for deep past what was drawn up and pays in tighter windows and
      interceptions.

      <b>Run direction</b> picks the side the ball attacks and is worth real yards, since
      point-of-attack reps dominate the lane; see <i>The Run Fit</i>.

      <b>Protection emphasis</b> governs the tight ends and the <i>back</i>. Up: a hybrid tight end
      blocks instead of releasing, the back stays home, a calmer pocket, fewer men in the route.
      Down: the back leaks out as a live outlet, a hotter pocket, more sacks. <b>Play-action
      rate</b> and <b>motion rate</b> multiply what the formation already does rather than setting
      it.`,
    },
    {
      heading: 'What a formation changes',
      body: `The formation puts specific bodies on the field, deciding who can be thrown to or handed to at
      all. It carries a natural pass lean on every snap out of it, sets the baseline rate of the
      designed keeper, the play-action and the motion, and changes how unit strength is computed per
      play type.

      It also gates the call sheet: a concept needing multiple receivers is unavailable from a heavy
      set, and a coach-called play is confined to what that formation carries. The formation mix is
      a large part of the play calling, made once on another screen.`,
    },
    {
      heading: 'Concepts tilt; they do not carry',
      body: `Every pass and run concept has an opinion about each coverage family: a small edge against
      some, a small disadvantage against others. The edges are <b>small</b> — personnel does the
      heavy lifting, and a perfectly chosen concept against exactly the wrong coverage is a nudge.

      Edges and disadvantages roughly cancel across the families, so calling everything evenly is
      the baseline. A concept sheet is <i>redistribution</i>, not free yards: weight it toward
      beating single-high and the team struggles against two-high.

      Zero is not a low weight — it is a <b>cut</b>: the play leaves the install and the sheet
      renormalizes around what remains. Formations bench from the other direction: a play only
      lives in the formations that carry it.

      Execution scales the tilt both directions. Each concept asks specific attributes of the men
      running it: executed well it gives more than it is drawn to give, executed badly, less.`,
    },
    {
      heading: 'Repetition, tempo, and reading the sheet',
      body: `Defenses remember what they have been shown <i>this game</i>: lean on one play type past what
      a normal offense runs, live in one formation, or repeat a concept, and they meet it harder.
      The penalty is small and capped, scaled by the awareness of the defenders on the field, needs
      a real sample to engage, and resets at every kickoff.

      Tempo scales the clock each snap burns, changing possessions for <b>both</b> teams: hurry and
      the opponent gets more drives, chew and the game's sample size shrinks, which is what an
      underdog wants. An automatic layer hurries a trailing team late in a half and chews for a
      leading one; explicit cell tempo or a weekly call beats it. The fourth-down approach scales
      one curve rather than adding special cases; see <i>Special Teams</i>.

      The plan report aggregates every snap by the situation it actually resolved to — how you find
      supposed third-and-long snaps running on the red zone cell. The dials interact and the weekly
      plan overrides part of them: change one at a time.`,
    },
  ],
};

export { chapter8 };
