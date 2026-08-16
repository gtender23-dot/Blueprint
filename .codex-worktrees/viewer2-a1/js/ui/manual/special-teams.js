// Written from: engine/sim.js (field goal attempts and the true attempt
// distance, the range comfort cap, the spot of a missed kick, punt distance and
// result, returner selection, coverage strength, return and kickoff outcomes,
// the fourth-down decision), constants.js (the kicking, kickoff and return
// constants).
// Aug 2026: slim pass — persona removed, cut to reference length.
var chapter11 = {
  id: 'special-teams',
  icon: '🦵',
  title: 'Special Teams',
  blurb: 'The third of the team nobody looks at, and the one place a single roster spot decides games.',
  sections: [
    {
      heading: 'A kicker is really two players',
      body: `A kicker has a <b>leg</b> and a <b>hand</b>. The leg comes from strength and power and sets
      the distance he is comfortable to — the centre of his range. The hand comes from technique and
      awareness and shifts his whole curve up or down at every distance.

      The falloff past his comfortable range is smooth: no wall, just a chance that gets steadily
      worse the further out you send him. Even a chip shot never reaches certainty.

      So a big leg with no accuracy is a long-range coin flip, and a precise leg with no power is
      money inside his range and nothing outside it.`,
    },
    {
      heading: 'The distance that actually matters',
      body: `Your range setting is a <b>comfort cap</b> you impose, not a report on what your kicker can
      do, and it is read in <b>spot</b> terms — the farthest yard line, measured from the goal, that
      you will let him try from.

      It is not the length of the kick. The real kick always travels farther, because the snap and
      hold spot the ball back and the end zone sits beyond the goal on top of it, and the attempt is
      measured from where the ball is struck rather than from where you lined up.

      Set the cap by the yard line you trust him from; set it to his true kicking distance and you
      have ordered attempts past it.`,
    },
    {
      heading: 'Why a long miss is worse than a punt',
      body: `Miss and the defense takes over at the <b>spot of the kick</b> — behind your line of
      scrimmage, not at it. A punt from that same spot flips the field; a missed long field goal
      hands the opponent a short one in your territory with a fresh set of downs.

      There is also a floor on which attempts are considered at all: the ball has to be genuinely
      across midfield, wherever you set your cap.`,
    },
    {
      heading: 'A punter is not a kicker',
      body: `The split looks the same — leg from strength and power, accuracy from technique and awareness
      — but for a kicker accuracy raises the chance the ball goes through the uprights, while for a
      punter it <b>reduces variance</b>.

      A big-legged, low-technique punter booms some and shanks others. His worst is floored, since a
      shank still travels a fair way, so the damage is field position bled on the short ones, not a
      ball going nowhere.

      His leg is capped from above anyway: a punt into the end zone is a touchback and every yard
      past that is thrown away. The shanks are not capped.`,
    },
    {
      heading: 'Kickoffs, coverage and returns',
      body: `Most kickoffs are touchbacks, and a touchback comes from raw <b>strength</b> and <b>placement
      technique</b> — not the same leg that drives field goals and punts. It is mostly a good thing:
      a known outcome that wipes the return off the board.

      On a return the value is a <b>gap</b>: the returner against the kicking team's coverage unit,
      so a dangerous returner meeting a fast, sure-tackling cover team gets next to nothing. House
      calls are rare.

      Coverage strength reads straight off the speed and tackling of your linebackers, safeties and
      corners, and there is no separate special-teams roster — so a back seven of big slow thumpers
      bleeds field position on every change of possession, and none of it shows on a stat sheet.
      Your returner is picked from backs, receivers and defensive backs by return fit unless you
      name one, and the automatic pick takes no view on whether you want that man taking hits.`,
    },
    {
      heading: 'How fourth down is decided',
      body: `Distance sets a base willingness to go: short yardage is a real decision, long yardage almost
      never is. Field zone bends it from there. In no-man's-land — past your own territory, still
      out of kicking range — going up gets <i>more</i> attractive, because a punt from there nets
      little. Deep in your own end it is suppressed hard. Goal-to-go pushes it back up.

      Game state dominates everything else. Trailing late multiplies it sharply and a wider deficit
      further; leading late suppresses it, and leading comfortably more.

      Your nerve setting scales that whole curve rather than bolting on exceptions, and a weekly
      one-game call outranks your standing philosophy. The kick is taken when it is available and
      going was not chosen, with one exception: trailing by more than a score in the final minutes,
      the game stops settling for three.`,
    },
  ],
};

export { chapter11 };
