// defmesh_band_ab.mjs — Stage 0 band gate: pinned-seed AI-vs-AI games. Run the
// SAME script in the pristine tree and the mesh tree; identical per-game lines
// prove auto-selection did not move. Mesh-heavy base fronts forced to stress
// the mesh paths (Nickel / 3-3-5 / Big Nickel / Tite rotation).
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { setAIGameplan } from '../js/engine/ai.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
const N = Number(process.argv[2] ?? 200);
const mulberry32 = seed => { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let x = Math.imul(t ^ t >>> 15, 1 | t); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; }; };
const FRONTS = ['Nickel', '3-3-5', 'Big Nickel', 'Tite'];
const real = Math.random;
const acc = { pts: 0, rush: 0, pass: 0, comp: 0, att: 0, g: 0 };
const lines = [];
for (let i = 0; i < N; i++) {
  Math.random = mulberry32(7000 + i);
  const gen = s => { const r = []; for (const [pos, c] of Object.entries(ROSTER_TARGETS)) for (let j = 0; j < c; j++) { const p = createPlayer(pos, CLASS_YEARS[j % 4], 1); p.schoolId = s; r.push(p); } return r; };
  const rH = gen('H'), rA = gen('A');
  const sH = { roster: rH, coach: { personality: { aggression: 0.3 + 0.4 * ((i % 5) / 4) } }, staff: null };
  const sA = { roster: rA, coach: { personality: { aggression: 0.3 + 0.4 * (((i + 2) % 5) / 4) } }, staff: null };
  setAIGameplan(sH); setAIGameplan(sA);
  sH.gameplan.defBaseFront = FRONTS[i % FRONTS.length];
  sA.gameplan.defBaseFront = FRONTS[(i + 1) % FRONTS.length];
  const cH = buildDepthChart(rH, sH.gameplan), cA = buildDepthChart(rA, sA.gameplan);
  const res = simulateGame({ id: 'H', name: 'Home' }, { id: 'A', name: 'Away' }, rH, rA, cH, cA, sH.gameplan, sA.gameplan);
  const hs = res.homeStats || {}, as = res.awayStats || {};
  lines.push(`${i} ${res.homeScore}-${res.awayScore} r${(hs.rushYds||0)+(as.rushYds||0)} p${(hs.passYds||0)+(as.passYds||0)} c${(hs.compAtt||0)+(as.compAtt||0)}/${(hs.passAtt||0)+(as.passAtt||0)}`);
  acc.g++; acc.pts += res.homeScore + res.awayScore;
  acc.rush += (hs.rushYds||0)+(as.rushYds||0); acc.pass += (hs.passYds||0)+(as.passYds||0);
  acc.comp += (hs.compAtt||0)+(as.compAtt||0); acc.att += (hs.passAtt||0)+(as.passAtt||0);
}
Math.random = real;
console.log(lines.join('\n'));
console.log(`MEANS pts/g ${(acc.pts/acc.g).toFixed(2)} rush/g ${(acc.rush/acc.g).toFixed(1)} pass/g ${(acc.pass/acc.g).toFixed(1)} comp% ${(100*acc.comp/Math.max(1,acc.att)).toFixed(2)}`);
