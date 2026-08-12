// trait_band_ab.mjs — Pass 4.5 band gate (IDENTITY_DESIGN §6). Three arms:
//   ARM 1  identity LIVE (rolled traits + size fit, as shipped)
//   ARM 2  __noTraits + __noSizeFit (the whole system killed)
//   ARM 3  SATURATION — every play trait and flaw forced to level III on
//          every player (the §6 guardrail literally tests this case)
// The gate: LIVE vs KILLED drift inside the pass4 noise thresholds, and the
// saturation arm still inside a wider (2×) envelope — any single trait is
// nearly invisible; even the impossible full-III league only breathes.
// Run: node tools/trait_band_ab.mjs [N-games-per-arm]   (default 300)
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { setAIGameplan } from '../js/engine/ai.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

const N = Number(process.argv[2] ?? 300);
function genRoster(s, saturate = false) {
  const r = [];
  for (const [pos, c] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < c; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], 1);
      p.schoolId = s;
      if (saturate && p.traits) {
        for (const t of p.traits.play) t.lv = 3;
        for (const t of p.traits.flaws) t.lv = 3;
      }
      r.push(p);
    }
  }
  return r;
}
function arm(kill, saturate = false) {
  if (kill) { globalThis.__noTraits = true; globalThis.__noSizeFit = true; }
  const acc = { g: 0, pts: 0, rush: 0, pass: 0, ints: 0, plays: 0, to: 0, comp: 0, att: 0, sacks: 0 };
  try {
    for (let i = 0; i < N; i++) {
      const rH = genRoster('H', saturate), rA = genRoster('A', saturate);
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
  } finally { delete globalThis.__noTraits; delete globalThis.__noSizeFit; }
  return acc;
}
const line = (l, a) => console.log(
  `${l.padEnd(26)} pts ${(a.pts / a.g).toFixed(1)}  rush ${(a.rush / a.g).toFixed(1)}  pass ${(a.pass / a.g).toFixed(1)}` +
  `  comp% ${(100 * a.comp / (a.att || 1)).toFixed(1)}  plays ${(a.plays / a.g).toFixed(1)}  INT ${(a.ints / a.g).toFixed(2)}  TO ${(a.to / a.g).toFixed(2)}  sk ${(a.sacks / a.g).toFixed(2)}`);
console.log(`AI vs AI, ${N} games per arm (per-team-game averages):`);
const live = arm(false);
line('identity LIVE', live);
const dead = arm(true);
line('__noTraits+__noSizeFit', dead);
const sat = arm(false, true);
line('SATURATION (all lv III)', sat);
const drift = (a, b, get) => Math.abs(get(a) - get(b));
const gates = [
  ['pts', (a) => a.pts / a.g, 2.0],
  ['rush', (a) => a.rush / a.g, 8],
  ['pass', (a) => a.pass / a.g, 10],
  ['comp%', (a) => 100 * a.comp / (a.att || 1), 1.5],
  ['sacks', (a) => a.sacks / a.g, 0.35]
];
let ok = true;
const fmt = (pairs) => pairs.map(([n, v]) => `${n} ${v.toFixed(2)}`).join('  ');
const liveDrift = gates.map(([n, g]) => [n, drift(live, dead, g)]);
const satDrift = gates.map(([n, g]) => [n, drift(sat, dead, g)]);
console.log(`\nLIVE vs KILLED drift:      ${fmt(liveDrift)}`);
console.log(`SATURATION vs KILLED drift: ${fmt(satDrift)}`);
for (let i = 0; i < gates.length; i++) {
  if (liveDrift[i][1] >= gates[i][2]) { ok = false; console.log(`GATE FAIL (live): ${gates[i][0]}`); }
  if (satDrift[i][1] >= gates[i][2] * 2) { ok = false; console.log(`GATE FAIL (saturation): ${gates[i][0]}`); }
}
console.log(ok ? 'BANDS HELD (live inside noise gates; saturation inside 2× envelope)' : 'BAND DRIFT — investigate before ship');
process.exit(ok ? 0 : 1);
