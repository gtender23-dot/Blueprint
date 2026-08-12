// balance_probe.mjs — how badly does a power-user gameplan beat AI staffs at
// EQUAL talent, and do the difficulty edges compensate sanely?
// Run: node tools/balance_probe.mjs [N]
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateFirstHalf, simulateSecondHalf } from '../js/engine/sim.js';
import { setAIGameplan } from '../js/engine/ai.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

const N = Number(process.argv[2] ?? 50);
function genRoster(t,s){const r=[];for(const [pos,c] of Object.entries(ROSTER_TARGETS)){for(let i=0;i<c;i++){const p=createPlayer(pos,CLASS_YEARS[i%4],t);p.schoolId=s;r.push(p);}}return r;}

// The power-user stack: committed identities, tuned depth mix, featured
// playbook, aggressive pressure package, every dial off its default.
const META = {
  offFormations: [{id:'Spread',weight:55},{id:'Trips/Bunch',weight:45}],
  tendency: 'Pass', rushInPct: 55,
  passDepth: { short: 45, medium: 35, deep: 20 },
  screenRate: 20, rpoRate: 25, protEmphasis: 60, qbAggr: 55, losFreedom: 'free',
  paRate: 130, motionRate: 140,
  conceptWeights: { 'Mesh': 85, 'Shallow Cross': 80, 'Slant-Flat': 70, 'Stick': 60,
    'Smash': 75, 'Flood': 70, 'Y-Cross': 65, 'Dagger': 60,
    'Four Verts': 55, 'Post-Wheel': 60, 'Inside Zone': 70, 'Power': 65, 'Counter': 70, 'Toss': 55 },
  targetShares: { WR1: 24, WR2: 20, WR3: 16, TE1: 14, RB1: 12 },
  defBaseFront: '4-3', blitzPct: 32, coverageScheme: 'lockTop',
  covShell: 'balanced', covStyle: 'man', pressLevel: 'press',
  tackleStyle: 'strip', greenDog: true, edgePlay: 'balanced', runCommit: 5,
  fourthDown: 'Aggressive', baseTempo: 'Normal', maxFGDist: 44,
};

function aiPlan(roster) {
  const school = { roster, coach: { personality: { aggression: 0.5 } }, staff: null };
  setAIGameplan(school);
  return school.gameplan;
}

function series(diff, n) {
  let wins = 0, margin = 0;
  for (let i = 0; i < n; i++) {
    const rMe = genRoster(1, 'ME'), rAI = genRoster(1, 'AI');
    const gpAI = aiPlan(rAI);
    const meHome = i % 2 === 0;
    const [hS, aS] = meHome ? [{id:'ME',name:'ME'},{id:'AI',name:'AI'}] : [{id:'AI',name:'AI'},{id:'ME',name:'ME'}];
    const [hR, aR] = meHome ? [rMe, rAI] : [rAI, rMe];
    const [hG, aG] = meHome ? [META, gpAI] : [gpAI, META];
    const tok = simulateFirstHalf(hS, aS, hR, aR,
      buildDepthChart(hR, hG), buildDepthChart(aR, aG), hG, aG,
      { playerSide: meHome ? 'home' : 'away', difficulty: diff });
    const r = simulateSecondHalf(tok);
    const my = meHome ? r.homeScore : r.awayScore, opp = meHome ? r.awayScore : r.homeScore;
    if (my > opp) wins++;
    margin += my - opp;
  }
  return { winPct: Math.round(100 * wins / n), margin: (margin / n).toFixed(1) };
}

console.log('meta stack vs AI staffs, equal talent:');
for (const d of ['freshman', 'varsity', 'allamerican', 'heisman']) {
  const s = series(d, N);
  console.log(`  ${d.padEnd(12)} win% ${String(s.winPct).padStart(3)}  avg margin ${s.margin}`);
}
