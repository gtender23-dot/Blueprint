// pass4_band_ab.mjs — PASS 4 band gate: AI-vs-AI league stats with pressure
// flavors LIVE vs KILLED (__noPressFlavors). Band rule (roadmap): the moment
// AI gains a new scheme layer — here the mug/cross flavor on signature heat
// calls, the third-and-long Psycho (amoeba), AND the sanctioned green-dog
// refit (the standing toggle ~30% of AI defenses roll) — prove the stat
// bands didn't move. The switch is data-layer clean (buildAISignatureCalls
// gates generation) AND code-path clean (the kill-switch restores the
// pre-Pass-4 standing green dog byte-for-byte), so this measures the WHOLE
// pass. covfam_band_ab precedent, same thresholds.
// Run: node tools/pass4_band_ab.mjs [N-games-per-arm]   (default 300)
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { setAIGameplan } from '../js/engine/ai.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

const N = Number(process.argv[2] ?? 300);
function genRoster(s) {
  const r = [];
  for (const [pos, c] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < c; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], 1); p.schoolId = s; r.push(p); }
  }
  return r;
}
function arm(kill) {
  globalThis.__noPressFlavors = kill;
  const acc = { g: 0, pts: 0, rush: 0, pass: 0, ints: 0, plays: 0, to: 0, comp: 0, att: 0, sacks: 0 };
  try {
    for (let i = 0; i < N; i++) {
      const rH = genRoster('H'), rA = genRoster('A');
      const sH = { roster: rH, coach: { personality: { aggression: Math.random() } }, staff: null };
      const sA = { roster: rA, coach: { personality: { aggression: Math.random() } }, staff: null };
      setAIGameplan(sH); setAIGameplan(sA);
      const cH = buildDepthChart(rH, sH.gameplan), cA = buildDepthChart(rA, sA.gameplan);
      const res = simulateGame({ id: 'H', name: 'H' }, { id: 'A', name: 'A' }, rH, rA, cH, cA, sH.gameplan, sA.gameplan);
      for (const [st, score] of [[res.homeStats, res.homeScore], [res.awayStats, res.awayScore]]) {
        acc.g++; acc.pts += score ?? 0; acc.rush += st.rushYds ?? 0; acc.pass += st.passYds ?? 0;
        acc.ints += st.ints ?? 0; acc.plays += (st.rushAtt ?? 0) + (st.passAtt ?? 0); acc.to += (st.ints ?? 0) + (st.fumbles ?? 0);
        acc.comp += st.compAtt ?? 0; acc.att += st.passAtt ?? 0; acc.sacks += st.sacksAllowed ?? 0;
      }
    }
  } finally { delete globalThis.__noPressFlavors; }
  return acc;
}
const line = (l, a) => console.log(
  `${l.padEnd(24)} pts ${(a.pts / a.g).toFixed(1)}  rush ${(a.rush / a.g).toFixed(1)}  pass ${(a.pass / a.g).toFixed(1)}` +
  `  comp% ${(100 * a.comp / (a.att || 1)).toFixed(1)}  plays ${(a.plays / a.g).toFixed(1)}  INT ${(a.ints / a.g).toFixed(2)}  TO ${(a.to / a.g).toFixed(2)}  sk ${(a.sacks / a.g).toFixed(2)}`);
console.log(`AI vs AI, ${N} games per arm (per-team-game averages):`);
const live = arm(false);
line('pressure flavors LIVE', live);
const dead = arm(true);
line('__noPressFlavors KILLED', dead);
const drift = (get) => Math.abs(get(live) - get(dead));
const pts = drift((a) => a.pts / a.g), rush = drift((a) => a.rush / a.g), pass = drift((a) => a.pass / a.g), comp = drift((a) => 100 * a.comp / (a.att || 1)), sk = drift((a) => a.sacks / a.g);
console.log(`\ndrift: pts ${pts.toFixed(2)}  rush ${rush.toFixed(2)}  pass ${pass.toFixed(2)}  comp% ${comp.toFixed(2)}  sacks ${sk.toFixed(2)}`);
const ok = pts < 2.0 && rush < 8 && pass < 10 && comp < 1.5 && sk < 0.35;
console.log(ok ? 'BANDS HELD (drift within noise gates)' : 'BAND DRIFT — investigate before ship');
process.exit(ok ? 0 : 1);
