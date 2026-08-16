// Viewer Act 2 / A4 matched A/B: LIVE recording-only outside-arm stamps vs
// KILL (__noArmSwitch). With no new RNG and no outcome reader, football must be
// bit-exact while only the presentation stamp count changes.
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

const N = Number.parseInt(process.argv[2] || '24', 10);
let seed = 0;
const reseed = () => { seed = 20260814; };
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
function roster(tier, schoolId) {
  const out = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) for (let i = 0; i < count; i++) {
    const p = createPlayer(pos, CLASS_YEARS[i % 4], tier); p.schoolId = schoolId; out.push(p);
  }
  return out;
}
const gp = () => ({ offFormations: [{ id: 'Spread', weight: 45 }, { id: 'Single Back', weight: 35 }, { id: 'Flexbone', weight: 20 }],
  tendency: 'Balanced', rushInPct: 52, passDepth: { short: 35, medium: 45, deep: 20 }, blitzPct: 28,
  fourthDown: 'Moderate', baseTempo: 'Normal', maxFGDist: 44, runDirection: { left: 40, middle: 20, right: 40 } });

function arm(kill) {
  reseed();
  if (kill) globalThis.__noArmSwitch = true;
  const out = { stamps: 0, points: 0, yards: 0, turnovers: 0, plays: 0, signatures: [] };
  for (let i = 0; i < N; i++) {
    const rh = roster(1, 'H'), ra = roster(1, 'A'), gh = gp(), ga = gp();
    const res = simulateGame({ id: 'H', name: 'H' }, { id: 'A', name: 'A' }, rh, ra,
      buildDepthChart(rh, gh), buildDepthChart(ra, ga), gh, ga);
    out.points += (res.homeScore || 0) + (res.awayScore || 0);
    for (const d of res.drives || []) for (const p of d.plays || []) {
      out.plays++;
      out.yards += p.yards || 0;
      if (p.turnover) out.turnovers++;
      if (p.armSwitch) out.stamps++;
      const { armSwitch, ...football } = p;
      out.signatures.push(football);
    }
  }
  if (kill) delete globalThis.__noArmSwitch;
  return out;
}
const live = arm(false), kill = arm(true);
let pass = true;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `  [${detail}]` : ''}`);
  if (!ok) pass = false;
};
check('outside-arm stamps fire live and disappear under the kill switch', live.stamps >= N * 2 && kill.stamps === 0,
  `live=${live.stamps} kill=${kill.stamps}`);
check('scores, yards, turnovers and play volume are bit-exact',
  live.points === kill.points && live.yards === kill.yards && live.turnovers === kill.turnovers && live.plays === kill.plays,
  `pts ${live.points}/${kill.points} yds ${live.yards}/${kill.yards} TO ${live.turnovers}/${kill.turnovers} plays ${live.plays}/${kill.plays}`);
check('every recorded football outcome is bit-exact after removing the presentation stamp',
  JSON.stringify(live.signatures) === JSON.stringify(kill.signatures), `plays=${live.signatures.length}`);
console.log(pass ? '\nARM SWITCH A/B PASS — the film changed, the football did not' : '\nARM SWITCH A/B FAIL');
process.exit(pass ? 0 : 1);
