// Written from: engine/sim.js (simulateDrive's per-snap loop, pickPlayType,
// repWin, blockRep, resolvePassPlay, resolveRunPlay, resolvePassRush,
// runOutcome, pickTackler), engine/contests.js (CONTESTS, BLENDS, contestGap),
// engine/situations.js (resolveSituation, getEffectivePlan).
// Aug 2026 slim pass: cut to a reference, persona removed. Claims unchanged.
var chapter3 = {
  id: 'anatomy-of-a-play',
  icon: '🎬',
  title: 'Anatomy of a Play',
  blurb: 'One snap, start to finish: what gets decided, in what order, and why the play is usually over before the ball is.',
  sections: [
    {
      heading: 'Before the huddle breaks',
      body: `Down, distance, field position, score margin and clock collapse into one label at the snap.
      Each sideline labels it from its own bench: same ball, separate scoreboards.

      The sheets stack: base plan is the floor, the <b>situation</b> cell overwrites what it
      touches, the <b>weekly</b> plan for this opponent overwrites last and wins ties. Pass lean,
      blitz rate and run commit never overwrite; they are <b>shifts</b> added to what came from
      below. Weekly overrides fire even if you never open the situational editor, and smart-auto
      tempo fills in each situation.`,
    },
    {
      heading: 'Run or pass, then narrower',
      body: `The formation is on the grass before the call and it leans: some personnel groupings throw,
      some do not.

      Set a tendency and situational reasoning is discarded: your call is the whole answer, an
      extreme stays extreme. Otherwise an automatic layer reads down and scoreboard alone: long
      third and fourth downs tilt pass, short ones run, trailing badly late in a half pass, leading
      comfortably run. Not your personnel, not the defense, not that it is losing.

      The call then narrows: left, middle and right dials pick the side a run attacks, your depth
      mix picks short, intermediate or deep, and quarterback aggression shifts it deeper or
      shallower than you asked. The concept comes last, drawn against the coverage family the
      defense sits in. See <i>Calling a Game</i>.`,
    },
    {
      heading: 'The shape of every contest',
      body: `Nearly every one-on-one is one object: two men, two blended attributes, the difference bent
      through a smooth curve into a probability. No gap makes a rep automatic — a small edge is
      invisible on one snap, undeniable over a season.

      Your roster's strength against his is figured once and dropped onto that curve as a small
      nudge, every rep, same direction — the <b>only</b> place unit strength touches a matchup.`,
    },
    {
      heading: 'The trenches resolve first',
      body: `The line goes first. On a pass rushers are matched to blockers, edges to the tackles and
      interior rushers to the guards and center; a designated blitzer comes clean unless a back or
      tight end in protection picks him up. On a run each lineman is matched by gap; reps at the
      point of attack count far more than reps away.

      The pocket holds, wobbles or collapses; the lane is clean, muddy, or has a defender already in
      the backfield.`,
    },
    {
      heading: 'The skill contest and the aftermath',
      body: `On a pass each receiver runs a live duel against his coverage; their distance at the throw is
      the separation everything feeds on. The quarterback reads those numbers imperfectly and in no
      fixed order, then lets it go; the ball in the air is its own contest of catch, break-up and
      pick. On a run the line's verdict turns physical at the mesh point, and the carrier comes
      loose against linebackers and safeties.

      The aftermath: yards after contact, yards after the catch, the tackle. Tackle credit is drawn
      by pursuit — closing speed, angles, finishing — so your best pursuers lead the team without
      one taking every stop. A carrier escapes by making the man miss or running through him,
      whichever is his better path.`,
    },
    {
      heading: 'What it does not model',
      body: `Passes live in three depth bands, not at a measured yard line; runs attack a side, not a
      numbered gap. Pressure has two states, clean or hurried: nothing between them forces a
      checkdown, and when the rush gets home it is a sack and the read never happens.

      Penalties are not pinned on individual reps: they roll against team discipline across the
      drive, with pre-snap fouls driven by how well your coordinator knows the package just called.

      Your prepared plan takes nothing about the opponent into account: built against a
      <i>situation</i>, not read off the defense. The pre-snap read is not blind: <i>Defending a
      Game</i>.`,
    },
  ],
};

export { chapter3 };
