// Written from: engine/player.js (rawComposite, posAdjust, roleRating, axisLean,
// ARCHETYPE_DERIVE, refreshRatings, generatePotential) and constants.js
// (POS_WEIGHTS, ROLE_WEIGHTS, OVR_POS_ADJ, ATTR_FLOORS).
// Aug 2026 slim pass: cut to a reference, persona removed. Claims unchanged.
var chapter = {
  id: 'reading-a-player',
  icon: '🔍',
  title: 'Reading a Player',
  blurb: 'What overall actually measures, why role fit disagrees with it, and what the testing sheet is really telling you.',
  sections: [
    {
      heading: 'Overall is an opinion about a job',
      body: `An <b>overall</b> measures how well a player fits the job his position asks of him, not the
      athlete underneath.

      A quarterback is graded first on what he sees and how fast; his arm matters, his legs least. A
      corner is speed first, then his eyes, then the hips to turn and run, with finishing a tackle a
      footnote — which is why a corner runs a back down and bounces off him. A guard is power and
      anchor, then hand technique, then awareness for a stunt. A receiver is hands, then speed.

      A safety built like a corner rates fine at corner; one who plays like a linebacker does not.`,
    },
    {
      heading: 'One scale across positions',
      body: `A straight average drifts toward the middle the more attributes it counts, and a tight end is
      graded on far more of them than a punter is.

      So every position is slid onto a common scale before you see a number, and a tight end and a
      corner at the same overall are comparable. Inside a position the order and the gaps are
      untouched; only the whole group shifts. Specialists sit furthest off that scale and take the
      largest correction — a kicker's overall is pulled down hardest.`,
    },
    {
      heading: 'Role fit asks a narrower question',
      body: `Overall asks how good a corner he is. A <b>role rating</b> asks how good a <i>press</i> corner
      he is — a <i>lead-blocking</i> fullback, a <i>zone</i> guard. Same arithmetic, different
      priorities, different answers.

      A receiver with rare hands but ordinary speed rates below a burner on overall and above him on
      the fade, which is about winning the ball at the top. Tap a depth-chart slot and the list
      sorts by fit for <i>that job</i>, not by overall; a lower-overall man at the top of it is the
      answer to the narrower question.`,
    },
    {
      heading: 'Why your number and the sport disagree',
      body: `A <b>program decides which jobs exist</b>. Your base front decides whether an edge player
      holds two gaps or runs the arc; your formation rotation decides whether a tight end digs out
      linebackers or splits wide. Every program grades against <i>its</i> list, so the sport's
      consensus number averages buildings that play different football.

      A man your football likes more than the sport does is a bargain: the programs ahead of you
      have no job for him. A man the sport likes more costs full freight and then needs a package
      built around him.

      It cuts both ways. A perfect fit becomes awkward the day you change your front, and he has not
      got worse — the job under him changed.`,
    },
    {
      heading: 'Archetype now, ceiling later',
      body: `An <b>archetype</b> — Scrambler, Mauler, Nose, Possession — is read off a player's current
      attributes, by comparing him <i>only to himself</i>: not whether his strength is high, but
      whether he is stronger than he is fast. Build up a receiver's hands and he quietly becomes a
      possession man, with nothing to flip. That reading is what the simulation uses to decide how
      he behaves on a snap.

      Every player also carries a ceiling that is never shown. <b>Work Ethic</b> is the visible gate
      on reaching it: a gifted, lazy player stalls well short, a grinder with a modest ceiling
      reaches all of it and early. Players out of smaller programs carry a cap on how far their raw
      tools can be built, and a relentless one earns room above it.`,
    },
    {
      heading: 'The testing sheet, and what it is not',
      body: `Every attribute is visible before you spend a dollar. What is hidden until you scout him is
      his <b>true rating</b> — how those attributes add up <i>for his position</i>.

      Underneath sit two numbers: his attributes taken flat, every column counted the same, and the
      same attributes weighted by the job. A flat average that outruns the weighted rating is a
      <b>workout warrior</b>, his best numbers in columns his position never asks about. A weighted
      rating that outruns the flat average is a <b>gamer</b> — nothing jumps off the sheet, but his
      tools are the ones the job demands.

      Neither tag hides anything you could not work out from the sheet yourself; an <i>Evaluator</i>
      does it for you. Development lands on attributes and the rating reads attributes, so
      recruiting the shape compounds — see <i>Building a Player</i>.`,
    },
  ],
};

export { chapter };
