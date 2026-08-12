// pass6_band_ab.mjs — PASS 6 band gate: AI-vs-AI league stats with the whole
// decision-brain pass LIVE vs KILLED. Band rule (roadmap): the moment AI gains
// a new scheme layer — here the WP 4th-down brain, real fake punt/FG paths
// (every staff carries an aggression-scaled stFakes), return-scheme identity
// (talent+aggression-scaled retScheme), AI-authored formation sheets, and the
// trick-play auto-call brain — prove the stat bands didn't move. Third
// AMPLIFIED arm (every staff aggressive-fakes + wall returns + gadget 12) is
// the saturation guard from trait_band_ab precedent.
// Kill arm: __noWP4th + __noSTFakes + __noRetScheme + __noAIFormSheets +
// __noTrickBrain. pass4/pass5_band_ab thresholds.
// Run: node tools/pass6_band_ab.mjs [N-games-per-arm]   (default 300)
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { setAIGameplan } from '../js/engine/ai.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

const N = Number(process.argv[2] ?? 300);
const SWITCHES = ['__noWP4th', '__noSTFakes', '__noRetScheme', '__noAIFormSheets', '__noTrickBrain'];
function genRoster(s) {
  const r = [];
  for (const [pos, c] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < c; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], 1); p.schoolId = s; r.push(p); }
  }
  return r;
}
function arm(mode) {
  // mode: 'live' | 'kill' | 'amp'
  for (const k of SWITCHES) globalThis[k] = mode === 'kill';
  const acc = { g: 0, pts: 0, rush: 0, pass: 0, ints: 0, plays: 0, to: 0, comp: 0, att: 0, sacks: 0 };
  try {
    for (let i = 0; i < N; i++) {
      const rH = genRoster('H'), rA = genRoster('A');
      const sH = { roster: rH, coach: { personality: { aggression: Math.random() } }, staff: null };
      const sA = { roster: rA, coach: { personality: { aggression: Math.random() } }, staff: null };
      setAIGameplan(sH); setAIGameplan(sA);
      if (mode === 'amp') {
        for (const s of [sH, sA]) { s.gameplan.stFakes = 'aggressive'; s.gameplan.retScheme = 'wall'; s.gameplan.gadgetRate = 12; s.gameplan._gadgetWk = 4; }
      }
      const cH = buildDepthChart(rH, sH.gameplan), cA = buildDepthChart(rA, sA.gameplan);
      const res = simulateGame({ id: 'H', name: 'H' }, { id: 'A', name: 'A' }, rH, rA, cH, cA, sH.gameplan, sA.gameplan);
      for (const [st, score] of [[res.homeStats, res.homeScore], [res.awayStats, res.awayScore]]) {
        acc.g++; acc.pts += score ?? 0; acc.rush += st.rushYds ?? 0; acc.pass += st.passYds ?? 0;
        acc.ints += st.ints ?? 0; acc.plays += (st.rushAtt ?? 0) + (st.passAtt ?? 0); acc.to += (st.ints ?? 0) + (st.fumbles ?? 0);
        acc.comp += st.compAtt ?? 0; acc.att += st.passAtt ?? 0; acc.sacks += st.sacksAllowed ?? 0;
      }
    }
  } finally { for (const k of SWITCHES) delete globalThis[k]; }
  return acc;
}
const line = (l, a) => console.log(
  `${l.padEnd(24)} pts ${(a.pts / a.g).toFixed(1)}  rush ${(a.rush / a.g).toFixed(1)}  pass ${(a.pass / a.g).toFixed(1)}` +
  `  comp% ${(100 * a.comp / (a.att || 1)).toFixed(1)}  plays ${(a.plays / a.g).toFixed(1)}  INT ${(a.ints / a.g).toFixed(2)}  TO ${(a.to / a.g).toFixed(2)}  sk ${(a.sacks / a.g).toFixed(2)}`);
console.log(`AI vs AI, ${N} games per arm (per-team-game averages):`);
const live = arm('live');
line('Pass 6 LIVE', live);
const dead = arm('kill');
line('Pass 6 KILLED', dead);
const amp = arm('amp');
line('AMPLIFIED (fakes/wall)', amp);
const driftOf = (a, b, get) => Math.abs(get(a) - get(b));
const gets = { pts: (a) => a.pts / a.g, rush: (a) => a.rush / a.g, pass: (a) => a.pass / a.g, comp: (a) => 100 * a.comp / (a.att || 1), sk: (a) => a.sacks / a.g };
const d = Object.fromEntries(Object.entries(gets).map(([k, f]) => [k, driftOf(live, dead, f)]));
const da = Object.fromEntries(Object.entries(gets).map(([k, f]) => [k, driftOf(amp, dead, f)]));
console.log(`\nlive drift: pts ${d.pts.toFixed(2)}  rush ${d.rush.toFixed(2)}  pass ${d.pass.toFixed(2)}  comp% ${d.comp.toFixed(2)}  sacks ${d.sk.toFixed(2)}`);
console.log(`amp  drift: pts ${da.pts.toFixed(2)}  rush ${da.rush.toFixed(2)}  pass ${da.pass.toFixed(2)}  comp% ${da.comp.toFixed(2)}  sacks ${da.sk.toFixed(2)}`);
const okLive = d.pts < 2.0 && d.rush < 8 && d.pass < 10 && d.comp < 1.5 && d.sk < 0.35;
const okAmp = da.pts < 4.0 && da.rush < 16 && da.pass < 20 && da.comp < 3.0 && da.sk < 0.7;
console.log(okLive ? 'LIVE BANDS HELD' : 'LIVE BAND DRIFT — investigate before ship');
console.log(okAmp ? 'AMPLIFIED INSIDE 2x ENVELOPE' : 'AMPLIFIED BEYOND 2x ENVELOPE — investigate');
process.exit(okLive && okAmp ? 0 : 1);
