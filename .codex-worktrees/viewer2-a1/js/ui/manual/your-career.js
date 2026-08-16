// Written from: engine/career.js (expected wins, mandate text, seat state,
// school pull, coach reputation), engine/coach.js (the five skills and the
// grade ladder), engine/coachprofile.js (the DNA axes and their bonuses),
// engine/season.js (job-security update, hot score, carousel cascade, prestige
// update), engine/recruiting.js and engine/development.js for where each skill
// is consumed.
// Aug 2026: slim pass — persona and advice sections cut, mechanics kept.
// Aug 2026: second pass — sentence-level compression only. Same mechanics,
// fewer words.
var chapter15 = {
  id: 'your-career',
  icon: '💼',
  title: 'Your Career',
  blurb: 'What the athletic director is grading you on, how the seat under you warms, and which of your own marks are worth chasing.',
  sections: [
    {
      heading: 'You are measured against the banners, not the roster',
      body: `Your win total comes from the <b>program's prestige</b> and nothing else — not last season,
      not the players you inherited, not the schedule: a base number of wins, plus a step up per
      point of prestige.

      At a fallen power the expectation carries a bonus built from what the place <i>used to be</i>:
      the prestige decayed through the losing years, the athletic director's memory did not.

      Your mandate locks in the fourth week of camp; nothing after the games start moves it.`,
    },
    {
      heading: 'The seat',
      body: `Each season your wins are laid next to that expectation and the gap moves your job-security
      meter; prestige has a thumb on it too — a proud program's drifts up on its own, a poor one's
      down, regardless of results.

      A new coach cannot be fired during a grace period. After that two things end a tenure: the
      meter bottoming out, or missing badly two years running — the second gets you while the meter
      still looks healthy.

      The warning comes first either way — a warm seat gets a note about improving, a hot seat an
      ultimatum.`,
    },
    {
      heading: 'The five grades that are yours',
      body: `Five grades on a letter ladder, each rung dearer in experience than the last. Four travel with
      you; roots does not.

      <b>Evaluator</b> closes the gap between what a recruit looks like and what he is, grown by
      scouting — once per recruit, extra for a kid the market has misjudged. <b>Recruiter</b>
      multiplies your interest gain and what your dollars are worth — the biggest of the recruiting
      multipliers.

      <b>Developer</b> multiplies both development channels for every player every season, cheapens
      a position move, and satisfies recruits who came to get better, so it compounds hardest.
      <b>Reputation</b> multiplies recruiting a little and satisfies recruits chasing pedigree.

      <b>Roots</b> touches only recruits inside your home radius, only for you, and inside it is the
      biggest multiplier in the game. Switching schools burns most of what you banked.`,
    },
    {
      heading: 'Coach DNA',
      body: `Separate from the grades, an <b>identity</b> builds across eleven axes, earned by coaching a
      certain way and carried across your whole career.

      Most hand you a small Saturday edge. Grinding teams down: carriers tire slower late, more
      short yardage converted. Downfield attack: a sharper deep ball. Living in the backfield:
      blitzes cost fewer big plays. Ball hawk: takeaways on contested throws. Ball security: fewer
      giveaways. Discipline: fewer pre-snap penalties. Road-tested: softer hostile buildings.
      Riverboat: more of what you go for cashes. Special teams: kicking range and coverage.
      Adjustments: halftime changes bite harder, and more chances across a season to speak to the room.

      One does not work on Saturday. Motivator raises what your men can eventually <i>become</i> and
      grows work ethic across the roster. It compounds on every player you get.

      No Saturday axis is large by itself, and playing every style a little earns nothing. It is
      yours while you work and passes on only when you retire — covered in <i>The Coaching Tree</i>.`,
    },
    {
      heading: 'How the market sees you',
      body: `The market reads one number off you: your <b>reputation</b> grade, lifted slowly by winning
      across a career. It is what a hiring program stacks you against — not last year's record, not
      a hot streak.

      There is no dominance-streak gate. The phone rings only when three things line up in the same
      offseason: a seat <b>opens</b>, your reputation <b>clears that program's bar</b>, and their
      search <b>lands on you</b>. A title winner can get no offers because nobody good got fired.

      Which job is worth chasing runs the other way: division rules everything, prestige is the
      lever inside it, and any job a division up outranks nearly any below it.`,
    },
    {
      heading: 'The carousel',
      body: `Open seats fill from the most attractive job on down. The top seat takes the hottest available
      coach at a less attractive program; the moment he leaves, his old seat drops back into the
      queue, cascading until the board runs dry.

      Modest jobs have another option: promote a strong coordinator into the chair instead of
      poaching a sitting head coach. That is where new names enter the profession.`,
    },
    {
      heading: 'What prestige actually does',
      body: `Prestige updates once a season against your results, moves slowly, and stays inside a band
      your division sets. It cannot be spiked in a year or crashed in one.

      It reaches four things: what you are expected to win, your seat, what every recruiting dollar
      is worth, and attendance — where next season's recruiting money comes from.

      So lifting a program is a spiral turning both ways — while the expectation you are measured
      against does not fall as fast as the program does.`,
    },
  ],
};

export { chapter15 };
