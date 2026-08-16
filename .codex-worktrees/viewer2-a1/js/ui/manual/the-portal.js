// Written from: engine/portal.js (the pitch scoring, caliber gate, round loop,
// projected path to play), engine/offseason.js (cut-day gate, walk-on tryouts),
// engine/player.js (walk-on creation), engine/development.js (graduation,
// automatic redshirts), engine/season.js (freshmen arriving), constants.js
// (roster limits and scholarship handling).
// Aug 2026: slim pass — persona and advice sections cut, mechanics kept.
var chapter14 = {
  id: 'the-portal',
  icon: '🔁',
  title: 'The Portal and the Roster',
  blurb: 'Every man in the portal wants a role, and that one fact decides who you sign, who you lose, and what a roster of walk-ons plays like.',
  sections: [
    {
      heading: 'Everybody here wants to play',
      body: `The portal is not a talent market. Every man in it is chasing a <b>role</b>: snaps.

      Three things put a man in it — he is buried on his depth chart, his coach walked, or his
      program collapsed. Nobody enters for a bigger stage, more money, or a better conference.
      Seniors do not enter. Players below a quality floor do not enter. A player redshirting this
      season does not enter.

      Your roster leaks the same way. Rivals never poach your starters; you lose a junior or senior
      of real quality stacked behind returning players with no path to the field. The deeper the
      logjam, the likelier he goes. It is capped, and each departure lands in your inbox by name.`,
    },
    {
      heading: 'Role beats money',
      body: `The pitch is scored on four things, and the first dominates the other three combined.

      <b>Role</b> is read off your depth chart. Nobody at his position better than him means a
      starting job; the two-deep means rotation; sitting again means nothing a playing-time seeker
      wants, at any price.

      Then <b>prestige</b>, then <b>home comfort</b> — closer is better, falling off with distance —
      then <b>money</b>, which has heavy diminishing returns. A small program with a genuine opening
      beats a rich program that would bury him, and without a hole you cannot buy your way into one.`,
    },
    {
      heading: 'What you are allowed to reach for',
      body: `A transfer is tiered by his <b>rating</b>, not by the division he is leaving, and a school
      reaches at most one tier above its own — never two.

      A small program lands a better player dropping down to start, but never an elite one at any
      price: he does not appear as an option, because the board is filtered to what you can sign.
      The portal skips a step in a rebuild, not the climb.`,
    },
    {
      heading: 'How the war runs',
      body: `It runs over several rounds. You pitch or raise; rivals react — programs with a real opening
      counter-raise, priced-out ones stop, and a player with a clearly best home commits early
      rather than waiting. Rivals only push where they have an opening of their own, so your
      competition is the set of programs shaped exactly like you.

      It is funded from <b>leftover recruiting budget</b>: money spent on high schoolers in the
      autumn is money you do not have in the winter.

      You buy a known quantity — no fog on the rating, no scouting, no potential band, no
      development wait, and a race that settles in rounds rather than across a season. What you
      cannot do is outspend a bad fit.`,
    },
    {
      heading: 'The roster math',
      body: `There is a hard roster limit. Seniors graduate at the end of the season, the only thing that
      clears space automatically.

      The offseason opens with cut day, and cut day <b>gates the portal</b>: you cannot shop while
      over the cap, counting the seniors about to leave. Your signed class arrives before camp and a
      program takes its whole class even over the limit, which is why the third week of camp is a
      second, harder cut day. Nothing is silently dropped; you decide.

      Scholarship slots are a separate constraint: an outstanding offer holds a slot until the
      recruit signs somewhere, and money does not substitute for one.`,
    },
    {
      heading: 'Walk-ons are the floor',
      body: `A walk-on is built like a low-division recruit and then pulled down across every attribute,
      topping out well below real talent. His potential band is ordinary, nothing about him is
      hidden, he sits at the bottom of the depth chart, and he is exempt from automatic redshirting.

      They stop a neglected roster falling below playable size — a floor on <i>headcount</i>,
      deliberately not on quality. Every contest is a smooth curve, as <i>Anatomy of a Play</i>
      covers, so a slightly worse player never fails visibly; he wins slightly less often, on every
      snap.

      The tryout stage only appears if you have scholarships going spare.`,
    },
  ],
};

export { chapter14 };
