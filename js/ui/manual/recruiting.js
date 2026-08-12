// Written from: engine/recruiting.js (resolveRooms, effectiveSpend,
// calcGain, applyWeeklyContact, takeAction, rollWants,
// wantSatisfaction, classNeedMod, ptMod, commitThreshold, checkCommitments,
// computeSeasonRevenue, initBudget, facility handling, distanceTier),
// engine/portal.js (projectedPathToPlay), engine/season.js (the recruiting
// window and the day-19 lock).
// [GARRETT, Aug 2026] Slim pass — persona removed, length cut hard; every
// mechanic the old chapter named is still named.
// [GARRETT, Aug 2026] Second pass — sentence-level compression only. Same
// mechanics, fewer words.
var chapter13 = {
  id: 'recruiting',
  icon: '🎯',
  title: 'Recruiting',
  blurb: 'A fight against the other schools rather than a bar to fill: what builds a lead, what an offer really is, and where the money comes from.',
  sections: [
    {
      heading: 'There is no bar to fill',
      body: `A recruit warms because you are <b>beating the other schools chasing him</b>, not because you spent enough: every
      week every suitor's bid settles against every other at once.

      Take more than an even share and his interest rises, take less and it <i>falls</i>; outbid by
      a rival, your meter drops what his climbs.

      No cap to bump into, and an uncontested recruit settles quickly — a modest budget on a kid
      nobody wants climbs fast. Money burns; a lost race refunds nothing.`,
    },
    {
      heading: 'What your dollars are worth',
      body: `Before it reaches the recruit your money is multiplied by fit.

      <b>Distance</b> — close is worth more and costs less. <b>Prestige.</b> Your <b>recruiter</b>
      grade, biggest of the coach multipliers. Your <b>reputation</b>. Your <b>roots</b> grade —
      only inside your home radius, only for you, and inside it the single biggest lever in the
      game. Whether the position fills a real hole in <b>this class</b>.

      They multiply rather than add: a small program steals one from a rich one when they stack.`,
    },
    {
      heading: 'What he wants',
      body: `Most recruits carry a hidden want or two, visible only once you scout: <b>development</b>
      reads your developer grade, <b>pedigree</b> your reputation, a big <b>program</b> your
      prestige against your division's ceiling. Hit a want and it multiplies your money, miss it and
      it divides; dead center does neither.

      <b>Playing time</b> is a want too, and heavier than the rest: it reads how many returning
      players sit ahead of his projected peak; graduating seniors don't count. A clean path pulls
      hard, a logjam shoves just as hard, and money does not fix it.`,
    },
    {
      heading: 'The actions, and the order to take them',
      body: `<b>Scout</b> first: his true rating, potential band and wants, privately — a rival scouting
      the same recruit learns nothing off you. It pays evaluator experience once per recruit, more
      when the man is better than he looks on paper — the only action that makes you permanently
      better.

      Then <b>visits</b> — campus, home and game; campus visits are capped per recruit. Then the
      <b>offer</b>.

      Weekly standing contact has no per-dollar diminishing term; repeated visits and scouting
      diminish with use.`,
    },
    {
      heading: 'What an offer is, and how he commits',
      body: `An offer is a gate: no recruit commits without one. It holds a scholarship slot until he
      commits elsewhere.

      He accepts when four hold at once: you lead his race, you hold an offer, his interest is past
      his personal bar, and you lead second by a real margin. In the window's final week the margin
      drops and every recruit whose leader is offered and past the bar commits.

      The bar moves: work ethic lowers it, and it falls as the field narrows — a wide scramble needs
      an enormous number, a race down to two far less.`,
    },
    {
      heading: 'Where the money comes from',
      body: `Your recruiting pool is the athletic department's operating surplus, computed not handed over:
      a base by division, plus ticket revenue, plus carryover, less facility upkeep and staff
      salaries. Ticket revenue is effective capacity, times how full the stadium gets, times ticket
      price, times your program's share — and how full it gets rises with prestige and <b>last
      season's wins</b>.

      Winning therefore pays for recruiting a year late, and twice: attendance, and prestige. If a
      year's revenue can't cover upkeep, your biggest facility loses a level.`,
    },
    {
      heading: 'What to spend it on',
      body: `Every facility comes out of the same pool: an upgrade is recruiting money you didn't spend.
      Training multiplies development. Recruiting multiplies visits. Medicine shortens injuries. The
      stadium raises effective capacity and next year's pool — the only one that pays itself back.
      Scheduling guarantees too: being somebody's road opponent credits next year's pool, a bought
      soft schedule charges it.

      Scholarship slots are the one hard limit money doesn't touch — the corner a program on
      probation is in, and the only way out is developing who you have.`,
    },
  ],
};

export { chapter13 };
