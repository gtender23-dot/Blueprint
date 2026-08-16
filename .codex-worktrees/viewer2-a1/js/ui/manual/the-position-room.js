// Written from: constants.js (the per-position grading orders and the role
// variants that reshuffle them). Reference chapter — reached from card tooltips,
// so every position stays covered.
// Aug 2026: slim pass — persona and illustrative scenes cut, every grading
// order, role variant and cross-reference preserved.
// Second pass Aug 2026 — sentence-level compression; orders and variants intact.
var chapter16 = {
  id: 'the-position-room',
  icon: '🧠',
  title: 'The Position Room',
  blurb: 'The lookup for what each of the fourteen jobs grades on, in order, and what each one barely cares about.',
  sections: [
    {
      heading: 'Before You Sit Down',
      body: `An overall is how well a body fits the job asked of it; <i>Reading a Player</i> lays out the
      idea. Fourteen spots follow, each grading a different thing first; the bottom of each order
      is what you stop paying for.

      Within a spot, the <b>role</b> reshuffles the middle without changing what leads.`
    },
    {
      heading: 'Quarterback',
      body: `<b>Awareness</b> leads: the coverage read, the outlet found before the rush gets home.
      Then throwing mechanics, arm strength to drive it, care of the football, then the legs: speed,
      then agility. Raw power last.

      <b>Pocket</b> and <b>Game-Manager</b> lean on head and mechanics; <b>Dual</b>, <b>Scrambler</b>
      and <b>Gunslinger</b> pull legs and arm up the list.`
    },
    {
      heading: 'Running Back',
      body: `<b>Speed</b>, then agility: get to the edge, then make a man miss. Then awareness to find
      the crease, hands out of the backfield, technique, power to finish runs, ball security, and
      strength last: the classic overpay, a back avoids wrestling matches rather than winning them.

      <b>Power</b> and <b>Workhorse</b> pull finishing traits up; <b>Scat</b>, <b>Elusive</b> and
      <b>Speed</b> live on the top-two burst and cut.`
    },
    {
      heading: 'Wide Receiver',
      body: `<b>Hands</b> lead. Then speed and agility to separate, route technique, leaping over a corner,
      awareness, ball security, and power and strength at the bottom: nobody asks him to
      block a defensive end.

      <b>Deep</b> and <b>Fade</b> on speed and leaping, <b>Poss</b>ession and <b>Slot</b> on hands
      and route work, <b>Physical</b> borrows that bottom-of-the-list strength for contested balls.`
    },
    {
      heading: 'Tight End',
      body: `<b>Hands</b>, then technique: he catches and he blocks, both graded high. Then awareness,
      speed, power to hold up in-line, then agility, strength and leaping at the tail: leaping sits low,
      so this is no spot for a high-point specialist.

      <b>Receiving</b> and <b>Move</b> pull hands and speed up, <b>Blocking</b> on technique and power, <b>Hybrid</b> asks for both.`
    },
    {
      heading: 'Offensive Line',
      body: `<b>Strength</b> leads, then power, technique, the awareness to pass off a stunt or pick up
      a blitz, agility, and speed dead last, the least of what this job asks.

      <b>Mauler</b> on strength and power in the run game, <b>PassPro</b> tackles on technique
      and the feet-and-eyes side, <b>Balanced</b> and <b>Athletic</b> split the difference.`
    },
    {
      heading: 'Fullback',
      body: `<b>Power</b> leads, then awareness to find the right man to hit, technique, strength,
      hands, ball security, and speed and agility at the bottom: he is clearing a path, not
      winning a footrace.

      <b>Lead</b> is power and aim, <b>HBack</b> pulls hands and awareness up, moved around and
      asked to catch, <b>Hybrid</b> wants a taste of both.`
    },
    {
      heading: 'Defensive End',
      body: `<b>Strength</b> leads, then speed to win the corner, power to convert it into a bull rush,
      pass-rush technique, awareness, with agility and leaping at the bottom — the overpays,
      leaping most, on a job that never covers.

      <b>Speed</b> pulls get-off toward the top, <b>Power</b> leans on strength and the bull rush,
      <b>Base</b> sets a hard edge against the run first.`
    },
    {
      heading: 'Defensive Tackle',
      body: `The end's shape, nearer the anchor. <b>Strength</b> first, then power, technique
      to shed a block, awareness, then speed, agility and leaping at the bottom: occupying blockers and collapsing a
      pocket, not chasing.

      <b>NT</b> (nose tackle) is strength and power to two-gap and eat double teams, a
      three-technique wants penetration so quickness and technique climb, <b>Balanced</b> and
      <b>Quick</b> sit between.`
    },
    {
      heading: 'Linebacker',
      body: `A chase-and-diagnose job, sideline to sideline. <b>Speed</b> leads, then awareness to read
      the play, agility to redirect, technique, then strength and power to take on blocks, with leaping
      and hands at the bottom: the odd interception is not the paycheck.

      <b>Thumper</b> stacks and sheds on strength and power, <b>Cover</b> and <b>Sideline</b> on speed
      and agility, <b>Blitzer</b> on get-off and technique, <b>Hybrid</b> a bit of everything.`
    },
    {
      heading: 'Outside Linebacker',
      body: `A linebacker with more twitch. <b>Speed</b> first, then agility, awareness, technique,
      then strength and power for taking on the edge, with leaping and hands last: as inside, the
      overpays.

      <b>Rush</b> bends the edge on speed and get-off, <b>Cover</b> pulls agility and awareness up to
      run with backs and tight ends, <b>Blitz</b> wants first-step quickness and technique.`
    },
    {
      heading: 'Cornerback',
      body: `<b>Speed</b> leads, then awareness to read route and quarterback, agility to flip
      and mirror, technique, leaping to contest, with strength, hands and power at the bottom: he runs
      and covers rather than wrestles, so strength barely registers and power sits near dead last.

      <b>Press</b> jams on technique and a little of that low-list strength, <b>Zone</b> on awareness,
      <b>Slot</b> on agility in tight space, <b>Ball</b> pulls awareness and leaping up.`
    },
    {
      heading: 'Safety',
      body: `A corner with a bigger map. <b>Speed</b> first, then awareness, agility, technique,
      leaping, with strength, power and hands at the bottom; the picks come from being in the right
      place, the awareness talking, not the hands.

      <b>Free</b> on speed and awareness deep, <b>Strong</b> pulls strength and technique up for run and
      box, <b>Nickel</b> on agility for the slot, <b>Ball</b> and <b>Hybrid</b> toward range and
      take-away.`
    },
    {
      heading: 'Kicker',
      body: `The simplest shape on the roster: <b>Power</b> leads, the range has to be there, then
      the strength and frame behind that leg, technique to keep it true, and awareness dead last.

      <b>Accuracy</b> leans harder on technique; <b>Power</b> sells out for range.`
    },
    {
      heading: 'Punter',
      body: `The kicker's shape. <b>Power</b> first for the leg, then the strength and frame behind it,
      technique for the drop and the spin, and awareness last.

      <b>Distance</b> flips the field on power; <b>Directional</b> drops it at the sideline on technique
      to pin them deep.`
    }
  ]
};

export { chapter16 };
