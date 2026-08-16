// Written from: engine/season.js (PHASES, RECRUITING_OPEN, calendarWeek, the
// advanceDay ordering, INSEASON_DEV_WEEKS, addFreshmenToRosters, updatePrestige,
// the job market), engine/offseason.js (OFFSEASON_STAGES, initPreseason,
// preseasonAdvanceHook, the cut-day gate), engine/world.js (generateSchedule).
// Aug 2026 slim pass: cut to a reference, persona removed. Claims unchanged.
var chapter2 = {
  id: 'the-year',
  icon: '🗓️',
  title: 'The Year',
  blurb: 'The full calendar, the order things resolve in when you advance a week, and the deadlines that will not wait on you.',
  sections: [
    {
      heading: 'The shape of a year',
      body: `Six phases, in this order: <b>preseason</b> — four weeks before anyone plays a down — then
      <b>non-conference</b>, <b>conference play</b>, the <b>conference championship</b>, the
      <b>playoffs</b>, and the <b>offseason</b>.

      Recruiting cuts across them: it opens in the preseason with a dedicated week before you have
      played a snap, and closes at the end of championship week — undecided recruits resolve without
      you, money left in the pool buys nothing.`,
    },
    {
      heading: 'What each preseason week is for',
      body: `Each week has a job, and its door shuts behind it. <b>Week one is expectations</b>: the
      athletic director's mandate locks and does not budge, whatever happens to your roster. <b>Week
      two is recruiting</b> — scout and offer on the Search side, or set a strategy and let your
      staff do the legwork under Assist.

      <b>Week three is the spring game.</b> Development camp runs first, shaped by your practice
      plan — focus group hot, everyone else cool — and the game plays on the post-camp ratings.
      Position changes lock when it runs; a conversion is a preseason decision.

      <b>Week four is redshirt finalization.</b> There is no preseason cut gate; the roster-limit
      call was made at the offseason's <b>Cut Day</b>. Any redshirt you have not confirmed is
      applied when the first game week arrives.`,
    },
    {
      heading: 'What happens when you advance a week',
      body: `The order is fixed. Recruiting settles first, every contested recruit's week resolving across
      all suitors at once; then redshirt and roster bookkeeping; then injuries heal league-wide;
      then every roster develops on the practice checkpoints. <b>Last</b>, the games are played — a
      layoff ticks down before that week's game, so a man due back this week plays this week.

      Practice ticks on a few fixed in-season weeks and nowhere else, on whatever plan is set then;
      a plan changed after a checkpoint and changed back before the next never trains anybody. See
      <i>Building a Player</i>.

      When the offseason opens, records finalize first, then prestige and reputation, then the job
      market sizes anybody up. Seniors graduate and your finishers bank experience at the very end,
      but the development tick does <i>not</i> run there — it runs at next season's spring-game
      week.`,
    },
    {
      heading: 'Building the schedule',
      body: `Conference games are generated, not chosen. In a large conference opponents rotate, so the
      same membership produces a different slate each year; where the slate already reaches
      everybody, only the order shifts.

      Non-conference games are yours, picked in the offseason. One never crosses divisions, and the
      same two teams do not meet twice.

      Scheduling up or down carries a guarantee against <i>next</i> year's recruiting pool, set by
      the <b>star gap</b> between you and the opponent, not by who hosts: up is a credit, buying a
      soft opponent below you is a charge. Your rivalry game does not come out of that allowance.`,
    },
    {
      heading: 'The offseason is a sequence',
      body: `The offseason is a fixed order of stages, each closing behind you. The coaching carousel comes
      first — whether you are still employed, and who is courting you. Then awards, then departures.

      Then the decisions, in order: cut day, the transfer portal, your own contract, coordinator
      hires, one skill clinic, walk-on tryouts if you have scholarships spare, and finally
      scheduling.

      <b>Cut day gates the portal.</b> You cannot shop for transfers while over the cap; arrive
      bloated and that stage goes on trimming instead of shopping.`,
    },
    {
      heading: 'What the year does to your program',
      body: `Prestige updates once a season against your results, moves slowly, and sits inside a band set
      by your division.

      It is load-bearing in three places: what the athletic director expects of you (<i>Your
      Career</i>), what your recruiting dollars are worth (<i>Recruiting</i>), and attendance, which
      is where next year's recruiting pool comes from. A good season pays three times over, a year
      late.`,
    },
  ],
};

export { chapter2 };
