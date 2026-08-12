// M18 gate: every live-mode score hands the kickoff and next offense to the
// correct side, even though every snap pauses at the call sheet.
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateFirstHalf, resumeFromCall, resumeFromDecision } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

const GAMES = Number(process.argv[2] || 60);
const gp = () => ({
  offFormations: [{ id: 'Spread', weight: 50 }, { id: 'Single Back', weight: 50 }],
  tendency: 'Balanced', rushInPct: 55,
  passDepth: { short: 40, medium: 40, deep: 20 },
  blitzPct: 30, fourthDown: 'Moderate', baseTempo: 'Normal', maxFGDist: 42
});
const roster = (tier, schoolId) => Object.entries(ROSTER_TARGETS).flatMap(([pos, count]) =>
  Array.from({ length: count }, (_, i) => {
    const p = createPlayer(pos, CLASS_YEARS[i % 4], tier);
    p.schoolId = schoolId;
    return p;
  })
);

let scoringTransitions = 0;
let kickoffVisibleAtPause = 0;
let ordinaryHandoffs = 0;
let wrong = 0;
let malformed = 0;
const samples = [];

for (let game = 0; game < GAMES; game++) {
  const homeRoster = roster(1, 'H');
  const awayRoster = roster(1, 'A');
  const homeGP = gp();
  const awayGP = gp();
  const token = simulateFirstHalf(
    { id: 'H', name: 'Home' }, { id: 'A', name: 'Away' },
    homeRoster, awayRoster,
    buildDepthChart(homeRoster, homeGP), buildDepthChart(awayRoster, awayGP),
    homeGP, awayGP,
    { playerSide: 'home', controlledSides: ['home', 'away'], callMode: 'all' }
  );
  let seenDrives = 0;
  let guard = 0;
  while (token.stage === 1 && token.pending && guard++ < 700) {
    if (token.pending.kind === 'fourth') resumeFromDecision(token, 'auto');
    else resumeFromCall(token, { concept: 'sheet' });

    while (seenDrives < token.drives.length) {
      const drive = token.drives[seenDrives++];
      if (!['touchdown', 'field_goal'].includes(drive.result)) continue;
      if (!token.pending || token.pending.half !== 1) continue; // score ended the half
      scoringTransitions++;
      const nextSide = token.pending.possession;
      const plays = token.pending.drive?.plays || [];
      const kicks = plays.filter(p => p.type === 'kickoff');
      if (kicks.length) kickoffVisibleAtPause++;
      const recovered = kicks.some(k => k.onside && k.recovered);
      const returnTD = kicks.some(k => k.returnTD);
      const ordinary = !recovered && !returnTD;
      if (ordinary) {
        ordinaryHandoffs++;
        if (nextSide === drive.possession) wrong++;
      }
      const metaOK = kicks.length > 0 && kicks.every(k =>
        (k.kickingSide === 'home' || k.kickingSide === 'away') &&
        (k.receivingSide === 'home' || k.receivingSide === 'away') &&
        k.kickingSide !== k.receivingSide
      );
      if (!metaOK) malformed++;
      if (samples.length < 4) samples.push({ scorer: drive.possession, nextSide, result: drive.result, kicks: kicks.map(k => ({ kickingSide: k.kickingSide, receivingSide: k.receivingSide, onside: !!k.onside, recovered: !!k.recovered, returnTD: !!k.returnTD })) });
    }
  }
}

const checks = [
  ['scoring transitions exercised', scoringTransitions >= GAMES * 2, `count=${scoringTransitions}`],
  ['kickoff is already visible at the next live pause', kickoffVisibleAtPause === scoringTransitions, `${kickoffVisibleAtPause}/${scoringTransitions}`],
  ['ordinary scores always give the opponent the next offense', wrong === 0, `wrong=${wrong}/${ordinaryHandoffs}`],
  ['every live kickoff identifies kicking and receiving sides', malformed === 0, `malformed=${malformed}`]
];
let fail = false;
for (const [name, ok, detail] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}  [${detail}]`);
  if (!ok) fail = true;
}
console.log('samples: ' + JSON.stringify(samples));
process.exit(fail ? 1 : 0);
