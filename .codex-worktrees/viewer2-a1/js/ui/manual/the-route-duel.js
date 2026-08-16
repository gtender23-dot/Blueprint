// Written from: engine/sepgeo.js (the tick-level duel, technique setups, the plant,
// the sell), engine/sim.js (route vs coverage, coverage assignment, the read, catch
// resolution), engine/contests.js (the coverage blend, the interception chain, the
// contested catch). Slimmed Aug 2026 — persona removed, cut to reference length.
var chapter5 = {
  id: 'the-route-duel',
  icon: '🏹',
  title: 'The Route Duel',
  blurb: 'How separation is won and lost, and why the throw is decided before the ball leaves the quarterback’s hand.',
  sections: [
    {
      heading: 'Separation is played, not looked up',
      body: `The receiver and his cover man play the route out — stem, break, recovery — several times a
      second until the throw; their distance then is the <b>separation</b>.

      Attributes enter as physics, not as a number on a card.`,
    },
    {
      heading: 'The break',
      body: `At full speed a man cannot swerve: he plants, kills most of his momentum, redirects and
      rebuilds — a polished route runner keeps more speed through that plant than a raw one. A deep
      route has no break, only a lean and a footrace with a head start; raw speed takes over.

      Craft freezes the defender at the break; it is a <i>gap</i>, so a savvy corner reads a raw
      receiver's tell and jumps early.`,
    },
    {
      heading: 'The four techniques',
      body: `<b>Press</b> starts with a jam: strength, technique and agility against the receiver's
      agility, technique and strength. Win it and his release is laboured — rebuilding speed instead
      of accelerating, breaking late and shallow — by how badly the rep went, not route depth.

      <b>Man</b> is pure pursuit: the defender runs where the receiver <i>is</i>, not where he is
      going, and the lag turns speed into yards. It is never faced on its own: press if he crowds
      the line, off-man if he plays off.

      <b>Off-man</b> concedes the underneath route and takes away the deep one. <b>Zone</b> defends
      grass, idle until the break, then triggering and driving; awareness is that trigger.`,
    },
    {
      heading: 'What wins coverage',
      body: `Speed carries most of a cover man's value, agility next, then technique, then awareness —
      smallest in the aggregate, largest where it pays, which is zone.

      Strength enters coverage only at the press jam; after that he is running, and running is a
      speed problem. It cashes in on tackling.

      Separation allowed falls steadily as a cover man improves in <i>every</i> technique: technique
      changes which throws he gives up, not whether.`,
    },
    {
      heading: 'The read',
      body: `The quarterback ranks his targets by separation and throws to one, usually but not reliably
      the most open: a raw one tunnel-visions on his first read, a sharp one works the field and
      spreads the ball. A bracketed receiver is demoted unseen; one with no separation is not
      eligible at all — unless nobody is open, when the ball goes into coverage anyway. Pressure
      collapses the progression to the front of the list and penalises the throw.

      Target share is a thumb on the scale a sharp quarterback refuses when the man is covered, a
      raw one forces. An uncovered receiver is very open in zone, free in man — the payoff for a
      <b>blitz that emptied a zone</b>. Motion does not produce one; the receiver stays assigned.`,
    },
    {
      heading: 'The ball in the air',
      body: `Separation drives the catch, steeply: small changes swing a contested window hard; at either
      extreme it flattens. The quarterback adds execution — accuracy and processing — with real
      diminishing returns above a good starter's level. His arm is two things: velocity into a
      closing window underneath, distance on the deep ball.

      On tight windows at intermediate and deep range, and only there, the ball is a contest at its
      apex: height, leaping and hands against height, leaping and the defender's read.`,
    },
    {
      heading: 'The interception',
      body: `A pick is a chain, every link holding: read the quarterback, close on the throw, finish at the
      catch point — awareness leads, closing speed follows, leaping and hands finish.

      What makes a throw contested makes it more interceptable: deep balls far more than short,
      forced throws into coverage more again, a weak arm hanging the deep ball. Zone defenders play
      the quarterback with their eyes and intercept more; man defenders play the receiver's back,
      and man's tighter windows do not make up for it.

      An accurate, smart quarterback suppresses picks independent of all of it — not by throwing it
      away but by not putting it where it can be taken.`,
    },
  ],
};

export { chapter5 };
