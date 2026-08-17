// Written from: engine/playbook.js (looks, sheets, the inheritance resolver),
// engine/teamplan.js (the book vs the week), js/ui/views/creatorplaybook.js +
// gameplan.js (the editors).
// D4/M2 (2026-08-16): the missing manual chapter for books, looks and sheets.
// Normalized help language — plain words, no numbers.
var chapter20 = {
  id: 'books-and-looks',
  icon: '📖',
  title: 'Books, Looks & Sheets',
  blurb: 'The playbook is the system; a look is one way to line it up; the sheet is what you actually call from it.',
  sections: [
    {
      heading: 'The three words',
      body: `A BOOK is your offensive system: the formations you carry and the plays you trust from
      them. A LOOK is one specific way a formation dresses — its base alignment, or a
      variation like Trips or Empty, each with its own personnel on the grass. A SHEET is a
      look's menu of plays with how much you favor each one.

      The book is the durable thing. The game plan for a given week is a set of adjustments
      laid over it — the book persists, the week passes.`,
    },
    {
      heading: 'Looks inherit, then fork',
      body: `A new look starts life sharing its formation's base sheet — same plays, same weights,
      one page for the family. The first time you edit a look's own sheet, it takes its own
      copy and goes its own way. Base and siblings keep their pages untouched; the edited look
      owns its fork from then on.

      "Inherit base" hands the fork back and the look shares the family page again. This is
      why editing Trips no longer echoes into Empty: each look answers for its own sheet the
      moment you give it one, and not before.`,
    },
    {
      heading: 'Personnel is real',
      body: `A look's personnel package is what actually takes the field. Dress a look heavy and the
      extra tight ends genuinely play; call Empty and the back genuinely leaves — five
      receivers on the grass, no back to check down to. The card, the field, and the sim all
      read the same alignment table, so the picture you were shown is the football you get.

      Legality still runs through the formation: a look can never carry a play its formation
      doesn't run, and a play that needs bodies the look doesn't dress is flagged before you
      pick it.`,
    },
    {
      heading: 'Where the dials live',
      body: `Book things stay with the book: which looks you carry, how often each shows up, what's
      on each sheet. Week things stay with the week: tempo, aggression, situations, the
      opponent-specific lean. Load a saved plan and it applies onto whatever book you carry
      instead of dragging a frozen copy of an old one along.

      On the call sheet, pin a look and you're reading that look's sheet — its own fork if it
      has one, the family page if it doesn't. What you built is what you call.`,
    },
  ],
};
export { chapter20 };
