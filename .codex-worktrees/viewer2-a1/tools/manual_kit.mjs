// manual_kit.mjs — assemble the handoff kit for writing The Manual elsewhere.
//
// The problem this solves: the manual has to be accurate, and accuracy lives in the source.
// Hand an outside model the whole js/ tree (57 files, ~40k lines) and it will skim, then
// write fluent prose about systems it inferred from their names. That is the one failure
// mode worse than no manual — it teaches a coach to play against a model that doesn't
// exist. So the kit is curated: the spec, the full source for cross-referencing, and one
// card per chapter naming exactly which files to read, which symbols to find in them, and
// which questions the chapter has to answer.
//
// Output: manual-kit.zip
//
// Usage: node tools/manual_kit.mjs
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, rmSync, cpSync } from 'fs';
import { join, dirname, relative }                                                      from 'path';
import { fileURLToPath }                                                                from 'url';
import { writeZip }                                                                     from './_zip.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT  = join(ROOT, '.manual-kit');

// ── the chapters ────────────────────────────────────────────────────────────
// `read` is the reading list, in the order it should be read. `find` names the symbols or
// section banners to search for — sim.js alone is 5,000 lines and nobody should read it end
// to end for one chapter. `answer` is the chapter's actual job: if the draft doesn't answer
// these, it isn't finished.
const CHAPTERS = [
  {
    id: 'reading-a-player', icon: '🔍', title: 'Reading a Player',
    blurb: 'What overall actually measures, why role fit disagrees with it, and what the testing sheet is really telling you.',
    read: ['js/engine/player.js', 'js/constants.js'],
    find: ['POS_WEIGHTS', 'ROLE_WEIGHTS', 'roleRating', 'compositeRating', 'refreshRatings',
           'ARCHETYPE_DERIVE', 'derivedArchetype', 'axisLean', 'generatePotential', 'ATTR_FLOORS'],
    answer: [
      'What does a position’s overall actually weigh, and how does that differ between, say, a corner and a guard? Give the ORDER of what matters, never the weights.',
      'How does a role rating differ from overall, and when should a coach trust one over the other? Why can a lower-overall player be the better fit for a job?',
      'How is an archetype derived? It is a description of the player as he is now, not a label he was born with — explain what that means in practice.',
      'What is potential, what gates a player reaching it, and what is genuinely hidden from the coach until he scouts?',
      'What do the combine/testing numbers measure, and what is the relationship between testing well and playing well? Explain the raw/gamer distinction as a scout would.',
    ],
  },
  {
    id: 'the-year', icon: '🗓️', title: 'The Year',
    blurb: 'The shape of a season, what each week is actually for, and the deadlines that do not move.',
    read: ['js/engine/season.js', 'js/engine/offseason.js', 'js/engine/world.js'],
    find: ['PHASES', 'RECRUITING_OPEN', 'calendarWeek', 'advanceDay', 'PRESEASON_WEEKS',
           'initOffseason', 'advanceOffseasonStage', 'generateSchedule'],
    answer: [
      'What is the full shape of a year, phase by phase, and what is each preseason week FOR?',
      'What happens on a day the coach advances — in what order do recruiting, injuries, development, games and bookkeeping resolve? The order matters and is not obvious.',
      'Which deadlines are hard, and what happens to a coach who reaches one unprepared?',
      'How is the schedule built — what is fixed, what is the coach’s to choose, and when does he choose it?',
      'What does the offseason actually walk through, stage by stage?',
    ],
  },
  {
    id: 'anatomy-of-a-play', icon: '🎬', title: 'Anatomy of a Play',
    blurb: 'One snap, start to finish: what gets decided, in what order, and where the play is usually won.',
    read: ['js/engine/sim.js'],
    find: ['simulateDrive', 'pickPlayType', 'resolvePassPlay', 'resolveRunPlay', 'repSigmoid',
           '── Rep sigmoid', '── Drive simulation'],
    answer: [
      'Walk one snap end to end: what is decided before it, during it, and after it. This is the spine chapter — every other on-field chapter hangs off it.',
      'How does a matchup between two players resolve, in general? There is a shared shape to nearly every contest in the game — describe that shape and what it means (why a big edge is not a guarantee, why a small edge still shows up over a season).',
      'What decides run versus pass on a given snap, and how much of that is the coach versus the situation?',
      'Where is a play most often decided? Be specific and honest.',
      'What does the simulation deliberately NOT model? Saying so builds more trust than pretending it models everything.',
    ],
  },
  {
    id: 'the-pre-snap-read', icon: '👁️', title: 'The Pre-Snap Read',
    blurb: 'What the quarterback sees at the line, what he can do about it, and what the defense can hide.',
    read: ['js/engine/sim.js'],
    find: ['── Rung 4', 'PRE-SNAP', 'kill', 'audible', 'disguise', 'box', 'coverageAssignment',
           '── Coverage assignment'],
    answer: [
      'What is actually visible to the quarterback before the snap, and what is not?',
      'What is a kill call — when does the offense get out of a bad play, and what does it get into?',
      'How does a defense disguise, and what gives a disguise away?',
      'Which attributes decide whether a quarterback wins the pre-snap phase? Order, not weights.',
      'How does this interact with tempo — what does a coach give up by playing fast?',
    ],
  },
  {
    id: 'the-route-duel', icon: '🏹', title: 'The Route Duel',
    blurb: 'How separation is won and lost, why technique beats speed at the line and loses to it downfield.',
    read: ['js/engine/sepgeo.js', 'js/engine/contests.js', 'js/engine/sim.js'],
    find: ['routeDuel', '── Route vs coverage', '── Catch resolution', 'CONTESTS', 'BLENDS',
           'coverage', 'contested'],
    answer: [
      'How is separation produced? This is a moment-to-moment duel, not a single dice roll — explain what that means and why it makes coverage feel the way it does.',
      'How do press, off-man, zone and deep coverage differ in what they ask of a defender? A press corner and a deep-zone safety are not doing the same job.',
      'Which attributes matter for coverage, in what order, and — importantly — which ones only pay off CONDITIONALLY (awareness is worth nothing to a corner already beaten deep).',
      'How does a contested catch resolve, and what separates a receiver who wins them from one who does not?',
      'Why does route depth change which attributes matter?',
    ],
  },
  {
    id: 'the-pocket', icon: '🛡️', title: 'The Pocket',
    blurb: 'Rush against protection, and what a quarterback does when it breaks down.',
    read: ['js/engine/sim.js'],
    find: ['── Pass rush sub-resolution', '── Blocker vs rusher', '── QB read under pressure',
           'sack', 'pressure', 'scramble', 'blitz'],
    answer: [
      'How does a rusher beat a blocker, and what does the offensive line do as a unit versus as five individuals?',
      'What is the difference between pressure and a sack in this game — what does pressure alone cost the offense?',
      'What does a quarterback do under pressure, and which attributes decide whether that goes well?',
      'How does a blitz change the math on both sides? What does the defense give up?',
      'How does protection interact with the called concept and with tempo?',
    ],
  },
  {
    id: 'the-run-fit', icon: '🏃', title: 'The Run Fit',
    blurb: 'Where a run goes, who is there to meet it, and what turns two yards into twenty.',
    read: ['js/engine/sim.js'],
    find: ['── Run outcome', 'resolveRunPlay', '── Weighted tackler selection', 'brokenTackle',
           'gap', 'secondLevel', 'triple', 'jet'],
    answer: [
      'How is a run play resolved — from the blocking up front to the yardage on the ground?',
      'How does run DIRECTION interact with the offensive line? A coach who knows his line is strong on one side should know what to do with that.',
      'Who makes the tackle, and why is it not always the nearest defender?',
      'What produces a broken tackle and what produces a long run? They are not the same thing.',
      'How do the option and jet-sweep looks differ mechanically from a straight handoff?',
    ],
  },
  {
    id: 'calling-a-game', icon: '📋', title: 'Calling a Game',
    blurb: 'Your identity, your situations, and what every dial on the game plan actually costs.',
    read: ['js/engine/situations.js', 'js/concepts.js', 'js/engine/sim.js', 'js/ui/app.js'],
    find: ['SITUATION_KEYS', 'defaultWeeklyPlan', 'PASS_CONCEPTS', 'tendency', 'tempo',
           'playAction', 'screen', 'rpo', 'motion', 'FORMATION_PLAYBOOK'],
    answer: [
      'What does each dial on the game plan actually do, and what does it COST? Every one should have a real trade-off named.',
      'How do situations override defaults, and what fires when more than one could apply?',
      'How does formation mix work, and what does a formation actually change about a play?',
      'Play action, screens, RPOs and motion — what makes each work, and what makes each fail? Play action in particular depends on something the coach may not realise.',
      'What is the Plan Report telling a coach, and how should he act on it?',
    ],
  },
  {
    id: 'defending-a-game', icon: '🧱', title: 'Defending a Game',
    blurb: 'Fronts, shells, pressure, and the adjustments that decide second halves.',
    read: ['js/engine/sim.js', 'js/engine/ai.js', 'js/engine/season.js'],
    find: ['defBaseFront', 'coverage', 'blitzRate', 'aiSetWeeklyReaction', 'midGameReport',
           'setAutoCounter', 'halftime', 'adjustment'],
    answer: [
      'What does a front actually change, and what does a coverage shell actually change? Answer them separately.',
      'How does pressure rate trade against coverage — what is a coach buying and selling?',
      'What does the opposing staff do to a coach during a game and between games? Be specific about what it reads.',
      'What do the halftime adjustments actually do, and how is an adjustment judged to have worked?',
      'How does difficulty change the opposition — and what does it deliberately NOT touch?',
    ],
  },
  {
    id: 'the-depth-chart', icon: '📊', title: 'The Depth Chart',
    blurb: 'Who is on the field, how the game decides that, and the jobs that do not match a position.',
    read: ['js/engine/fieldassign.js', 'js/constants_field.js', 'js/engine/sim.js'],
    find: ['resolveSlots', 'SLOT_ELIGIBLE_POS', 'MESH_AUTO_POOL', 'OFF_FIELD_LAYOUTS',
           'targetShare', 'carry', 'fatigue', 'snapCap', 'rotation'],
    answer: [
      'How does the game decide who fills each spot in a formation? There is a real order of operations and it is worth knowing.',
      'What is a mesh spot (the slot, the fullback, the wing, the wildcat back)? Why do these exist and how does naming a man for one change things?',
      'What do target share and carry share actually do, and what happens to a receiver who is fed too much?',
      'How does rotation work — fatigue, snap caps, and next-man-up on an injury?',
      'What does the coach’s depth ORDER control that the starting lineup does not?',
    ],
  },
  {
    id: 'special-teams', icon: '🦵', title: 'Special Teams',
    blurb: 'Kicks, punts and returns — the third of the game most coaches ignore until it costs them.',
    read: ['js/engine/sim.js', 'js/constants.js'],
    find: ['── Kicking', 'attemptFG', 'puntDistance', '── Return game', '── 4th-down decision model',
           'K-Power', 'P-'],
    answer: [
      'What decides whether a field goal goes in? Distance and accuracy come from different places — say what each is built from, in order.',
      'What makes a good punter different from a good kicker?',
      'How does the return game resolve, and what makes a returner dangerous?',
      'How does the game think about fourth down, and what does the coach’s nerve setting change?',
      'What should a coach actually do differently after reading this?',
    ],
  },
  {
    id: 'building-a-player', icon: '📈', title: 'Building a Player',
    blurb: 'Three ways a player improves, what you control, and why the gifted sometimes stall.',
    read: ['js/engine/development.js', 'js/engine/offseason.js', 'js/ui/views/practice.js'],
    find: ['runSeasonDevelopment', 'developPlayer', 'getEffectivePracticePlan', 'planFromWeights',
           'workEthic', 'WE', 'runDevCamp', 'applyRedshirt', 'convertPosition'],
    answer: [
      'What are the channels a player grows through, what does each one respond to, and which does the coach actually aim?',
      'How does a practice plan work — what does emphasising something do, and what is the cost of emphasising it?',
      'Why does work ethic matter so much, and what does a high-potential low-work-ethic player actually look like over four years?',
      'Does production feed development? If so, how — and what does that mean for how a coach uses his bench?',
      'Redshirts, dev camp and position changes: what does each one buy and what does it cost?',
    ],
  },
  {
    id: 'recruiting', icon: '🎯', title: 'Recruiting',
    blurb: 'A race you win by out-working the field, not by waiting for a deadline.',
    read: ['js/engine/recruiting.js', 'js/engine/season.js'],
    find: ['resolveFunnel', 'takeAction', 'applyWeeklyContact', 'commitThreshold', 'initBudget',
           'distanceTier', 'buildFunnelPool', 'RECRUITING_LOCK_DAY', 'scout'],
    answer: [
      'How does a recruit actually decide? This is a contested race resolved by who is winning — explain what builds a lead and what a lead does once you have one.',
      'What does each action a coach can take actually do, and what is the sensible order to do them in?',
      'What does an offer mean, mechanically, and why is interest without one worth less than it looks?',
      'How does money work — where the budget comes from, what it buys, and what winning does to next year’s.',
      'What does distance change? And what does a coach’s reputation and program pedigree change?',
      'What is genuinely hidden until a recruit is scouted, and what is visible all along?',
    ],
  },
  {
    id: 'the-portal', icon: '🔁', title: 'The Portal and the Roster',
    blurb: 'Transfers in and out, the walk-ons who fill the gaps, and the scholarship math underneath.',
    read: ['js/engine/portal.js', 'js/engine/offseason.js', 'js/constants.js'],
    find: ['portal', 'transfer', 'createWalkOn', 'ROSTER_TARGETS', 'ROSTER_SIZE', 'scholarship',
           'runGraduation', 'attrition'],
    answer: [
      'Who enters the portal and why — what makes one of your own players leave?',
      'How does bringing a transfer in differ from signing a recruit? What is easier and what is harder?',
      'What is the roster math — scholarships, the cap, graduation, attrition — and when does it bite?',
      'What are walk-ons for, and what does a roster full of them actually play like?',
      'How should a coach think about roster construction across positions over several years?',
    ],
  },
  {
    id: 'your-career', icon: '💼', title: 'Your Career',
    blurb: 'You are the coach, not the school — job security, the market, and what a program becomes under you.',
    read: ['js/engine/career.js', 'js/engine/coach.js', 'js/engine/coachprofile.js', 'js/engine/world.js', 'js/engine/offseason.js'],
    find: ['expectedWins', 'seatState', 'schoolPull', 'coachRepScore', 'addSkillXP', 'SKILL_KEYS',
           'coachDNA', 'addDnaXP', 'prestige', 'pedigree', 'getJobOpenings'],
    answer: [
      'How is a coach judged? Expectations against results — explain what sets the expectation and what happens as the seat warms.',
      'What are the coach skills, how does each grow, and what does each actually change?',
      'What is Coach DNA tracking, and what do the grades and badges do?',
      'How does the job market work — what makes a program want you, and what makes you want it?',
      'Can a coach permanently change a program? Explain what builds and what fades, and over what kind of time.',
    ],
  },
];

// ── assemble ────────────────────────────────────────────────────────────────
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'chapters'), { recursive: true });

// Full source, for cross-referencing. The cards are the reading list; this is the library.
cpSync(join(ROOT, 'js'), join(OUT, 'src'), { recursive: true });
writeFileSync(join(OUT, 'MANUAL_SPEC.md'), readFileSync(join(ROOT, 'Ref/MANUAL_SPEC.md')));

// A finished chapter, written in-house from the source. A worked example settles questions
// a spec cannot — how long, how technical, how to gesture at a weighting without printing
// one, how to sound like a coach rather than a manual. Whoever writes the rest matches this.
mkdirSync(join(OUT, 'example'), { recursive: true });
cpSync(join(ROOT, 'js/ui/manual/reading-a-player.js'), join(OUT, 'example/reading-a-player.js'));
cpSync(join(ROOT, 'tools/manual_leak_audit.mjs'), join(OUT, 'example/manual_leak_audit.mjs'));

const card = (c, i) => `# Chapter ${i + 1} of ${CHAPTERS.length} — ${c.title}

Read \`MANUAL_SPEC.md\` first. It is not optional: it carries the voice, and the rule about
never printing a number, which has an automated audit behind it.

- **id**: \`${c.id}\`
- **icon**: ${c.icon}
- **blurb** (starting point — improve it if you can): ${c.blurb}

## Read these, in this order

${c.read.map(f => `- \`src/${f.replace(/^js\//, '')}\``).join('\n')}

Some of these files are large. Rather than reading end to end, find these:

${c.find.map(s => `- \`${s}\``).join('\n')}

Read the comments as carefully as the code. This codebase explains its own reasoning in
comments, often including why an earlier approach was wrong — that is exactly the material
that makes a chapter worth reading, and you will not find it in the logic alone.

## Questions this chapter must answer

${c.answer.map((q, n) => `${n + 1}. ${q}`).join('\n\n')}

Answer them in whatever order reads best. These are the chapter's job, not its outline.

## Output

Write \`${c.id}.js\` in the format given in the spec. Then list, separately:

- anything you could NOT determine from the source (most valuable thing you can report)
- anything that looks like a bug or a contradiction between systems
- any place you came close to the no-numbers line
`;

CHAPTERS.forEach((c, i) => {
  const n = String(i + 1).padStart(2, '0');
  writeFileSync(join(OUT, 'chapters', `${n}-${c.id}.md`), card(c, i));
});

writeFileSync(join(OUT, 'README.md'), `# The Manual — writing kit

Everything needed to write the in-game manual for **Blueprint: College Football Dynasty**,
without access to the running game.

## What's here

| path | what it is |
|---|---|
| \`MANUAL_SPEC.md\` | **Read first.** Voice, the no-numbers rule, the module format, what to hand back. |
| \`chapters/\` | One card per chapter: the reading list, the symbols to find, the questions it must answer. |
| \`src/\` | The complete game source. The cards say what to read; this is here for cross-referencing. |
| \`example/\` | **Chapter 1, finished.** Match it. Plus the leak audit that will be run over your drafts. |

## Start here

Read \`MANUAL_SPEC.md\`, then read \`example/reading-a-player.js\` — it is chapter 1,
written from the source, and it is the target. It settles in two minutes what a spec argues
about for a page: how long a chapter runs, how technical it gets, how to convey that one
attribute outweighs another without ever printing what either is worth, and how to sound
like a coach explaining the game rather than a manual describing a menu.

\`example/manual_leak_audit.mjs\` is the lint that gets run over every draft. Reading it
tells you exactly where the line is.

## How to work

One chapter at a time, in the order the cards are numbered — the early ones establish
vocabulary the later ones lean on. For each: read the spec, read the card, read the source
it names, then write the chapter module.

Do not write from the name of a system. Every claim has to come from something you actually
read. **A chapter that says less and is right beats one that says more and is wrong** — a
confidently wrong manual teaches a coach to play against a model that does not exist, which
is worse than having no manual at all. When you cannot tell how something works, leave it
out and say so in the handback.

## The one rule that has teeth

No coefficients, no thresholds, no rates, no constant names. Ordinal and directional claims
only — "speed carries most of a corner's coverage, agility next" is right; "speed is 41% of
coverage" is not. The spec has the full list and the reasoning. Every number in every draft
gets audited.

## Handing it back

${CHAPTERS.length} files named \`<id>.js\`, plus the three notes each card asks for. They
drop straight into the game.
`);

const files = [];
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else files.push({ name: relative(OUT, p).replace(/\\/g, '/'), data: readFileSync(p) });
  }
};
walk(OUT);

writeZip(join(ROOT, 'manual-kit.zip'), files);
rmSync(OUT, { recursive: true, force: true });

const kb = (statSync(join(ROOT, 'manual-kit.zip')).size / 1024).toFixed(0);
console.log(`manual-kit.zip  ${files.length} files, ${kb} KB`);
console.log(`  MANUAL_SPEC.md`);
console.log(`  README.md`);
console.log(`  chapters/    ${CHAPTERS.length} cards`);
console.log(`  src/         ${files.filter(f => f.name.startsWith('src/')).length} source files`);
