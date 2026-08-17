// Written from: js/ui/views/creator*.js (the Workshop hub screens),
// engine/creator.js (the library shelves), engine/bench.js (the test bench),
// engine/formcompose.js + playbook.js (the shared fits-function).
// D4/M2 (2026-08-16): the standing gaps-audit manual chapter for the Workshop.
// Normalized help language — plain words, football terms, no numbers.
var chapter18 = {
  id: 'the-workshop',
  icon: '🛠️',
  title: 'The Workshop',
  blurb: 'Where you build things that outlive one season: formations, plays, playbooks, defensive books — and the bench you prove them on.',
  sections: [
    {
      heading: 'What lives here',
      body: `The Workshop is your program's garage. Everything you build in it — a formation, a
      play, an offensive playbook, a defensive book, a division layout — is saved to your own
      library, outside any one save file. Start a new dynasty years from now and your library
      is still there, ready to load.

      Nothing you build here changes a game until you carry it into one: a playbook has to be
      loaded, a play has to be called. The AI never uses your creations. They are yours alone,
      which is also why they can never unbalance a league you're not playing in.`,
    },
    {
      heading: 'The Formation Designer',
      body: `Lay out your own alignment — where each body stands, who is on the line, how deep the
      backs sit. The Designer enforces real football law while you drag: a legal line, nobody
      out of bounds, a lawful eleven. Save a look and every play that fits its personnel is
      installed automatically, so you can walk straight to the bench and watch it run.

      Fit is decided by one shared rulebook — the same one the Playbook Builder and the bench
      use — so a look never offers a play its personnel can't run. An Empty set will not offer
      you a two-back play, and nothing with your name on it runs the Wildcat's private plays.`,
    },
    {
      heading: 'The Play Composer',
      body: `Build a play of your own. For a pass: pick the formation, then tell every receiver
      what to run — or tell him to stay home and block, which genuinely keeps him in the
      protection. For a run: pick where the ball is aimed, how the line blocks it — zone, a
      puller, a trap, a lead back — and whether the back or the quarterback carries it.

      You never type a rating or a grade. A fixed rulebook reads your design and derives how
      it plays, and everything it derives is held inside the range the shipped playbook already
      spans. Your play can be exactly as good as great design makes it, and no better — the
      composer builds plays, not exploits.`,
    },
    {
      heading: 'The Playbook Builder',
      body: `Assemble a system: pick the formations and looks you carry, choose each look's plays,
      weight how often each look shows up. Every card is drawn for the specific look you're
      editing, the ℹ corner opens the full assignment sheet — every man's job, line included —
      and the 🧪 corner runs any play on the bench before you commit to it.

      Start from a shipped scheme and edit, or build from a blank page. A saved book can be
      loaded into any world, and the Game Plan screen speaks the same language, so what you
      built in the garage is what you coach on Saturday.`,
    },
    {
      heading: 'The bench',
      body: `The test bench is the Workshop's proving ground: two even-matched practice squads, one
      play against one defensive look, as many reps as you want. Pick the front, the coverage
      picture, and how many rushers come. RUN AGAIN rolls a fresh rep; SAME ROLL AGAIN replays
      the identical rep so you can watch one moment twice.

      The bench is a play-design instrument, nothing more. The squads are even on purpose —
      you're testing the design, not the talent — and nothing that happens on the bench touches
      a save, a season, or a scouting report. Scouting lives in the scout page and the film room.`,
    },
  ],
};
export { chapter18 };
