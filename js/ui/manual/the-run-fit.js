// Written from: engine/sim.js (carrier committee, gap-based direction, pulling
// schemes, lane quality, run outcome, broken tackles, fumbles, tackler selection),
// engine/run2geo.js (the crease, the backstop law, the breakaway),
// engine/contests.js (evade, truck, fall forward, tackling, pursuit).
// Slimmed Aug 2026 — persona removed, cut to reference length.
// Second pass Aug 2026 — sentence-level compression; every claim retained.
var chapter7 = {
  id: 'the-run-fit',
  icon: '🏃',
  title: 'The Run Fit',
  blurb: 'The line buys a crease and the back spends it — where the yards come from, and what a broken tackle actually is.',
  sections: [
    {
      heading: 'Who is carrying it',
      body: `The quarterback carries at a rate set by the formation plus whatever is dialed on top; an
      empty backfield overrides both and he carries regardless.

      Otherwise the committee has it: dialed shares spread across the running back depth, drawn
      between plays, so backs rotate freely. Unallocated carries fall to a default — fullback
      inside, lead back outside — which disappears when a back is dialed the full budget,
      short-yardage fullback carries included.`,
    },
    {
      heading: 'The lane',
      body: `Defensive linemen are matched to blockers by gap and the reps resolve into one verdict, the
      <b>lane</b> — not a flat average, since point-of-attack reps count for far more than reps
      away.

      The left, middle and right dials buy that: running behind the best linemen pays real yards,
      running at the best defender costs them, a line with one good side and one bad does not
      average out, and leaving it undirected hands carries to the bad side.

      Anyone who won his rep is a <b>penetrator</b>, in the backfield at the handoff; that is where
      tackles for loss come from.`,
    },
    {
      heading: 'Pulling',
      body: `On a directional run with a pulling scheme the backside guard leaves his gap for the point of
      attack, an extra hat where it is worth most. The cost sits behind the play: the defender in
      the vacated gap is unblocked, but chases from the backside rather than filling downhill, and
      mostly does not get there.

      Runs up the middle take a scheme's tilt without any of this; there is no backside to leave.`,
    },
    {
      heading: 'The crease becomes physical',
      body: `The lane sets a size and a speed. Clean: the linemen reached the second level, the box
      linebackers blocked late and displaced, the back hitting the hole with a head of steam. Muddy:
      the fillers sit free in the hole and the back arrives slowly into a crowd.

      Against second-level defenders that entry speed is most of the fight. From there it is a live
      chase; none of the yardage is drawn from a table.`,
    },
    {
      heading: 'The backstop law',
      body: `Safeties do not attack a runner in space: square and downhill, mirroring, giving ground
      slowly, breaking down late. The second level concedes chunks and almost never concedes the
      game.

      No contain man works the alley, so a back through the second level races the whole deep net
      rather than one edge defender. Linemen chase from behind, making a cutback a risk rather than
      a free lane, and the sideline never misses.

      Pursuit runs on a compressed scale by design — angles and recognition far more than raw speed
      — so fast and slow defenses sit closer together than their timed speeds do.`,
    },
    {
      heading: 'The broken tackle',
      body: `The carrier takes the better of two ways out: make him miss, on agility with speed and craft
      behind, or run through him, on power with strength and pad level behind. The defender needs
      speed and agility to close and break down in space, then strength and power to finish; a
      corner who arrives in the open field and cannot finish gets run through.

      Because the back takes his better path, the big back with no wiggle breaks tackles, the small
      back with no power breaks tackles, the back with neither breaks none, and the overall shows
      none of it. Weight adds a little above a normal frame; power is the mechanism.

      A broken tackle redistributes the stop: the beaten man is charged with the miss and the next
      in the picture has to make the play. Where there is no next man, a long run.`,
    },
    {
      heading: 'Contact, the ball, and the tackle sheet',
      body: `Every made tackle also settles where the pile ends up: a punishing runner falls forward, a
      thumping tackler drives him back, at equal ratings a wash. Never many yards, but it decides
      third and one.

      Fumbles live on the short-gain tackles, where contact is hardest. Strength and reliable form
      force them; ball security and a heavier frame resist them. Tackling style is a live dial on
      both: <b>strip</b> hunts the ball, forcing more fumbles and conceding more broken tackles to
      carriers who were going down; <b>wrap</b> mirrors it.

      A breakaway is not a separate roll, only the carrier clearing the last man at a speed nobody
      behind can close — top-end speed is worth little in the box and an enormous amount once the
      picture opens.

      Tackle credit is drawn by pursuit — closing speed first, then angles and recognition, then
      finishing — and spreads across the rotation. Linebackers lead the run-tackle count by
      geometry, not a thumb on the scale: they are the box fitters, where most runs are met. A high
      tackle total says a man was on the field and around the ball, not that the defense was good.`,
    },
  ],
};

export { chapter7 };
