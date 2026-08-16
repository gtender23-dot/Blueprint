// tendency_probe.mjs — does the gameplan's run/pass TENDENCY still drive every
// snap end-to-end, and how much does a pass-heavy team still run?
//
// Motivated by: "I played an always-pass team that ran more than I thought."
// This measures the ACTUAL pass rate a team of each tendency produces over full
// games (situational football included), against the PASS_TENDENCY neutral
// target, so we can see (a) tendency is honored and monotonic, and (b) exactly
// how much even a pass team runs — and why (short yardage, goal line, closing
// out a lead all pull a passer onto the ground by design).
//
// Formation is pinned to Single Back (passLean ~0) so the number isolates tendency +
// situational logic, not formation lean. Run: node tools/tendency_probe.mjs [N]
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS, PASS_TENDENCY } from '../js/constants.js';

const N = parseInt(process.argv[2] || '40', 10);

function genRoster(t, s) {
  const r = [];
  for (const [pos, c] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < c; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], t); p.schoolId = s; r.push(p); }
  }
  return r;
}
// A neutral, situational-layer-free plan pinned to a passLean-0 formation, so
// the only thing steering run/pass is the tendency + the engine's built-in
// situational nudges (exactly what an AI opponent runs on).
const mk = (tendency) => ({
  offFormations: [{ id: 'Single Back', weight: 100 }],
  tendency, rushInPct: 60, passDepth: { short: 40, medium: 40, deep: 20 },
  blitzPct: 20, fourthDown: 'Moderate', baseTempo: 'Normal', maxFGDist: 42,
});

const TENDENCIES = ['Always Run', 'Heavy Run', 'Run', 'Balanced', 'Pass', 'Heavy Pass', 'Always Pass'];

console.log(`Tendency fidelity — ${N} games/cell, Single Back (passLean ~0), both teams same tendency\n`);
console.log('tendency      | neutral target | measured pass% | run% | pass plays  run plays');
console.log('--------------|----------------|----------------|------|----------------------');

const sH = { id: 'H', name: 'Homer St', prestige: 5 };
const sA = { id: 'A', name: 'Away Tech', prestige: 5 };
let prevPass = -1, monotonic = true;

for (const tendency of TENDENCIES) {
  let pass = 0, run = 0;
  for (let i = 0; i < N; i++) {
    const rH = genRoster(1, 'H'), rA = genRoster(1, 'A');
    const gp = mk(tendency);
    const res = simulateGame(sH, sA, rH, rA, buildDepthChart(rH, gp), buildDepthChart(rA, gp), gp, gp);
    for (const st of [res.homeStats, res.awayStats]) {
      // A sack is a called pass that never got off — count it as a pass PLAY.
      // (Scrambles get logged as rushAtt, so this marginally UNDER-counts pass
      //  calls — the real pass-call rate is a hair above what's printed.)
      pass += st.passAtt + (st.sacksAllowed || 0);
      run  += st.rushAtt;
    }
  }
  const total = pass + run;
  const passPct = 100 * pass / total;
  const runPct = 100 * run / total;
  const target = (PASS_TENDENCY[tendency] * 100).toFixed(0);
  if (passPct < prevPass - 0.5) monotonic = false;
  prevPass = passPct;
  console.log(`${tendency.padEnd(13)} |      ${String(target).padStart(3)}%       |     ${passPct.toFixed(1).padStart(5)}%     | ${runPct.toFixed(0).padStart(3)}% | ${String(pass).padStart(8)}  ${String(run).padStart(8)}`);
}

console.log('\nReads:');
console.log('• Monotonic (more pass-leaning tendency ⇒ higher measured pass%): ' + (monotonic ? 'YES ✅' : 'NO ❌'));
console.log('• A pass team still runs by design: goal line, short yardage, and closing out a');
console.log('  lead inject run tendencies; "Heavy/Always Pass" are 68%/82% neutral, not 100%.');
process.exit(monotonic ? 0 : 1);
