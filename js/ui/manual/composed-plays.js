// Written from: engine/playcompose.js (the composed-play rulebook),
// engine/customplay.js (name-a-play), engine/sim.js (the composed-call seam),
// js/ui/views/creatorplay.js (the composer screens).
// D4/M2 (2026-08-16): the missing manual chapter for composed plays.
// Normalized help language — the mechanism, never the numbers.
var chapter19 = {
  id: 'composed-plays',
  icon: '✏️',
  title: 'Composed Plays',
  blurb: 'How a play you built yourself gets graded, called, and drawn — and why it can be great but never broken.',
  sections: [
    {
      heading: 'Two ways to make a play',
      body: `NAME A PLAY takes a play that already exists and puts your name on it. It plays
      identically to the original — same grades, same behavior — so it's a labeling tool: your
      terminology on the call sheet, no balance question at all.

      COMPOSE A PLAY builds a new one. A pass is a formation plus an assignment for every
      receiver — a route, or stay in and block. A run is a path for the ball, a blocking
      scheme for the line, and a carrier. Your design is the whole input; the game derives
      the rest.`,
    },
    {
      heading: 'The grader',
      body: `When you save a composed play, a fixed rulebook reads the design and writes the grades:
      which coverages a route package stresses, which box counts a run design likes, what kind
      of players execute it best. Real football logic drives it — crossers trouble man
      coverage, a deep shot needs time, a puller adds a hat at the point of attack, an
      outside path wants speed.

      Every grade it writes is clamped inside the range the shipped playbook already spans. A
      brilliant design earns the top of the range; nothing you stack can push past it. That's
      the deal that makes composing safe: your play competes with the catalog, it never
      escapes it.`,
    },
    {
      heading: 'Blocking that means it',
      body: `A receiver you mark as a blocker isn't decoration. On a pass, a tight end or a back you
      keep home is genuinely kept in the protection — the line's dice are overruled by your
      call — and the price is honest too: he is not in the route, so your progression is one
      man shorter. On a run, the scheme you chose is the scheme the line runs: a gap design
      pulls a guard, zone reaches and climbs, a trap invites the rusher in and punishes him.`,
    },
    {
      heading: 'Calling it, watching it',
      body: `Your composed plays appear on the call sheet under MY PLAYS, drawn on the look you've
      pinned. Call one and it fires as designed — the quarterback doesn't check out of your
      play, because the call is the play. Before the snap, the viewer draws your design over
      the fielded players; what you authored is what the bodies run, route for route.

      The defense is not told anything. Your play is new to them the way a new install is new
      to a real defense — they read the formation, the personnel, and what you put on film,
      exactly as they would for any shipped play.`,
    },
    {
      heading: 'Only you can call it',
      body: `Composed plays are human-call-only, by construction. The AI's play-caller draws from the
      shipped catalog and never sees your library, so a composed play can never leak into an
      opponent's game plan or an unattended sim. Your plays are your edge, called from your
      headset, and nowhere else.`,
    },
  ],
};
export { chapter19 };
