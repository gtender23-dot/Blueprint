// emergency_qb_probe.mjs — when a team's QB depth list is stranded empty (a
// redshirted QB1 atop the chart, injuries, etc.), the emergency-QB fallback in
// sim.js must put an actual QB under center if one is on the roster — NOT the
// "best receiver by awareness". Reproduces the stranded room by emptying the
// home depth chart's QB slot while a healthy QB still sits on the roster, then
// checks WHO throws. Run: node tools/emergency_qb_probe.mjs [games]
import { createPlayer, refreshRatings } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

function genRoster(schoolId) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], 1);
      p.schoolId = schoolId;
      r.push(p);
    }
  }
  return r;
}

const gp = { offFormation:'Pro-Set', tendency:'Balanced', rushInPct:60, passDepth:{short:40,medium:40,deep:20},
             blitzPct:20, defFormation:'Balanced D', fourthDown:'Moderate', clockMgmt:'Normal', maxFGDist:42 };
const sH = { id:'H', name:'Home' }, sA = { id:'A', name:'Away' };
const N = parseInt(process.argv[2] || '200', 10);

let fail = 0;
const g = (n, ok, d = '') => { if (!ok) fail++; console.log(`${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`); };

let qbSnaps = 0, nonQbSnaps = 0, gamesWithPass = 0;
let topWasQB = 0, topWasBestQB = 0;
const posCount = {};

for (let i = 0; i < N; i++) {
  const rH = genRoster('H'), rA = genRoster('A');
  const cH = buildDepthChart(rH, gp), cA = buildDepthChart(rA, gp);
  // STRAND the home QB room: the depth list is empty (redshirt atop / injuries),
  // but every QB is STILL on the roster and healthy. The emergency fallback is
  // the only thing that decides who throws.
  const rosterQBs = rH.filter(p => p.position === 'QB' && (p.injuryGamesOut || 0) === 0);
  cH.QB = [];
  // The QB the CORRECT fallback should pick: best healthy QB by AWR+TEC.
  const bestQB = rosterQBs.slice().sort((a, b) =>
    ((b.attributes.AWR||0)+(b.attributes.TEC||0)) - ((a.attributes.AWR||0)+(a.attributes.TEC||0)))[0];

  const res = simulateGame(sH, sA, rH, rA, cH, cA, gp, gp);

  // Home's primary passer this game.
  let topId = null, topAtt = -1;
  for (const id in res.homePlayerStats) {
    const a = res.homePlayerStats[id].passAtt || 0;
    if (a > topAtt) { topAtt = a; topId = id; }
  }
  if (topAtt <= 0) continue;
  gamesWithPass++;
  const passer = rH.find(p => p.id === topId);
  posCount[passer.position] = (posCount[passer.position] || 0) + 1;
  if (passer.position === 'QB') topWasQB++;
  if (bestQB && topId === bestQB.id) topWasBestQB++;

  // Share of ALL home pass attempts thrown by a QB vs a non-QB.
  for (const id in res.homePlayerStats) {
    const att = res.homePlayerStats[id].passAtt || 0;
    if (!att) continue;
    const p = rH.find(x => x.id === id);
    if (p?.position === 'QB') qbSnaps += att; else nonQbSnaps += att;
  }
}

const total = qbSnaps + nonQbSnaps;
console.log(`\nStranded-room home team over ${gamesWithPass} games with pass attempts:`);
console.log(`  primary passer position mix: ${JSON.stringify(posCount)}`);
console.log(`  pass attempts by a QB:     ${qbSnaps} (${(100*qbSnaps/total).toFixed(1)}%)`);
console.log(`  pass attempts by a non-QB: ${nonQbSnaps} (${(100*nonQbSnaps/total).toFixed(1)}%)\n`);

g('the emergency passer is an actual QB, not a skill player', topWasQB === gamesWithPass,
  `${topWasQB}/${gamesWithPass} games had a QB as primary passer`);
// The lead passer is the best healthy QB in the vast majority of games; fatigue
// can occasionally rotate the snap to QB3 within a game (the fallback re-picks
// the best HEALTHY QB each snap), which is acceptable — a QB still throws.
g('the emergency passer is (almost always) the best healthy QB', topWasBestQB / gamesWithPass > 0.9,
  `${topWasBestQB}/${gamesWithPass}`);
g('essentially all attempts go to a QB', total > 0 && qbSnaps / total > 0.98,
  `${(100*qbSnaps/total).toFixed(1)}%`);

console.log(fail ? `\n❌ ${fail} EMERGENCY-QB PROBE FAILURES` : `\n✅ EMERGENCY-QB PROBE PASS`);
process.exit(fail ? 1 : 0);
