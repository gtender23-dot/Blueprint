// Written from: engine/fieldassign.js (slot resolution — the ordering law, the
// joker and named-fullback rules, slot eligibility, the two passes),
// constants_field.js (the field layouts and slot descriptors), engine/sim.js
// (active depth, snap caps, fatigue and its effects, out-of-position grading,
// target share and the running back committee).
// Aug 2026: slim pass — persona removed, cut to reference length.
var chapter10 = {
  id: 'the-depth-chart',
  icon: '📊',
  title: 'The Depth Chart',
  blurb: 'How eleven men get onto the field, why naming a man changes the order everything resolves in, and what happens to a receiver you feed too often.',
  sections: [
    {
      heading: 'A formation is a list of jobs',
      body: `A formation is a set of numbered jobs — a split end, a flanker, a Y tight end, a lead back, a
      slot. Each expects a certain position, lines up in a certain place, and plays a certain role.

      Two passes fill them, and the order is the mechanic. Anybody you hand-picked is placed first,
      and a man can hold only one spot. The rest auto-fill with the best remaining man for the job.`,
    },
    {
      heading: 'The mesh spots',
      body: `Most spots pull from their own position room. A handful pull from several at once.

      The <b>slot</b> is the joker — your best inside weapon from the receivers, tight ends or
      backs. The <b>fullback</b> draws from backs and tight ends; the <b>A-back</b> adds receivers;
      the <b>wing</b> is a power body, backs and tight ends only. The <b>wildcat back</b> takes a
      direct snap, the <b>jet man</b> is pure speed from receiver or back, and the <b>fade</b> spot
      wants a tall, sure-handed receiver or tight end.

      What the field refuses is a back at split end or flanker — receiver spots, by hand as well as
      automatically — and a corner does not play guard.`,
    },
    {
      heading: 'Naming a man is the switch',
      body: `Leave the slot alone and it resolves <b>last</b>: your top two receivers take the outside, the
      next man goes inside.

      Name a joker and it resolves <b>first</b>. He claims the spot and everyone else slides up to
      fill what he left, which is how a tight end plays inside while your third receiver is bumped
      into a starting job. It cannot happen unless you name him.

      The fullback is the same switch. By default the running spots claim from the back room first
      and the lead-blocking spot takes whoever is left; name a fullback and he goes first, even if
      he is also your best back.`,
    },
    {
      heading: 'Out of position',
      body: `A man lined up where he does not belong gets worse, and how much worse depends on what the job
      asks of him. Measured physical tools travel <i>almost</i> intact — speed is nearly speed
      wherever he stands, though even that takes a small haircut. Coached skill mostly does not
      travel, being specific to a job nobody coached him for. Motor and conditioning come along
      untouched.

      Adjacent positions soften the blow considerably: a safety at corner is a different proposition
      from a safety at guard.`,
    },
    {
      heading: 'Feeding a man',
      body: `A target share is a thumb on the scale in your quarterback's progression. He looks that way
      more often; the read is still driven by who is open.

      Carry share is a draw instead. Dialed shares are rolled between plays, so the rotation happens
      regardless of who was there last snap. What you do not allocate falls back to a default —
      fullback inside, lead back outside — and dialing one back the whole budget wipes that default
      out, short-yardage fullback work included.

      Overfeed a receiver and two things push back. A smart passer reads the coverage on a bracketed
      man and bails to somebody open, so the boost is damped in proportion to how sharp he is; a raw
      passer forces it and pays in interceptions. And the defense <b>keys</b> a featured man: the
      bracket and the lock land on him, so he gets less open as your quarterback gets more likely to
      force it.`,
    },
    {
      heading: 'Rotation and fatigue',
      body: `Snap caps run off depth-chart order. Starters play nearly all of them, the next man down a
      substantial share, the one after him spot duty; running backs are capped deliberately lower so
      a second back gets real work, and quarterbacks, kickers and punters never rotate. There is no
      per-player dial — the lever is the order, and how close the next man's rating sits behind the
      starter's.

      Fatigue builds with snaps and bleeds off on the bench, and conditioning governs both
      directions, so a well-conditioned man compounds his edge across a game rather than adding it
      up. It takes physical attributes only: speed, strength, agility, power, leaping. Instincts and
      technique do not budge, and hands hold up better than the rest.

      A man comes off past a point of fatigue and goes back in only once he has recovered well clear
      of it. That gap keeps the rotation from flickering him on and off every other snap.`,
    },
  ],
};

export { chapter10 };
