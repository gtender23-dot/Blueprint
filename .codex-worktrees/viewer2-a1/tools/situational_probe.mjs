// situational_probe.mjs — subsystem 5, fixes D + E.
//
// D (two-minute sideline bias): a TRAILING two-minute offense reaches the sideline
//    (goes out of bounds) more often than the same offense in a base situation, so it
//    stops the clock more. Measured in-game by comparing OOB share of plays flagged in
//    two_min_trail vs the rest of the game.
// E (situational FG-range stretch): a team down by <=3 in the final ~2:30 will attempt
//    a FG beyond its normal range. Unit-checked against the shipped stretch formula.
//
// Run: node tools/situational_probe.mjs [N]
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame, fgLateStretch } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS, C } from '../js/constants.js';

const N = parseInt(process.argv[2] || '120', 10);
function genRoster(t, s) {
  const r = [];
  for (const [pos, c] of Object.entries(ROSTER_TARGETS))
    for (let i = 0; i < c; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], t); p.schoolId = s; r.push(p); }
  return r;
}
const gp = { offFormations:[{id:'Single Back',weight:100}], tendency:'Balanced', rushInPct:60,
  passDepth:{short:40,medium:40,deep:20}, blitzPct:20, fourthDown:'Moderate', baseTempo:'Normal', maxFGDist:42 };
const sH = { id:'H', name:'Homer St', prestige:5 }, sA = { id:'A', name:'Away Tech', prestige:5 };

// ---- D: OOB share by situation ----
let twoMinPlays = 0, twoMinOOB = 0, basePlays = 0, baseOOB = 0;
for (let i = 0; i < N; i++) {
  const rH = genRoster(1,'H'), rA = genRoster(1,'A');
  const res = simulateGame(sH, sA, rH, rA, buildDepthChart(rH,gp), buildDepthChart(rA,gp), gp, gp);
  for (const drive of res.drives || [])
    for (const p of drive.plays || []) {
      if (!(p.type && (p.type.startsWith('pass') || p.type.startsWith('run')))) continue;
      if (p.offSit === 'two_min_trail') { twoMinPlays++; if (p.oob) twoMinOOB++; }
      else { basePlays++; if (p.oob) baseOOB++; }
    }
}
const twoMinOOBpct = twoMinPlays ? 100*twoMinOOB/twoMinPlays : 0;
const baseOOBpct = basePlays ? 100*baseOOB/basePlays : 0;

console.log(`situational fixes D+E — ${N} games\n`);
console.log('=== D: out-of-bounds share by situation ===');
console.log(`two_min_trail:  ${twoMinOOBpct.toFixed(1)}% OOB   (n=${twoMinPlays})`);
console.log(`other/base:     ${baseOOBpct.toFixed(1)}% OOB   (n=${basePlays})`);
const dPass = twoMinPlays > 30 && twoMinOOBpct > baseOOBpct * 1.3;
console.log(`• trailing two-minute offense hits the sideline more (clock-stop bias): ${dPass ? 'YES ✅' : (twoMinPlays<=30?'thin sample':'NO ❌')}`);

// ---- E: FG stretch permission — tests the REAL shipped fgLateStretch() from
// sim.js (single source of truth; the inline drive-loop computation was extracted
// into that exported helper). If the shipped formula drifts, this probe fails.
function maxFGYd(baseMaxFGDist, scoreMargin, secsLeft) {
  return baseMaxFGDist + fgLateStretch(scoreMargin, secsLeft); // pre +17 snap/hold
}
console.log('\n=== E: FG range by game state (base maxFGDist 42) ===');
const rows = [
  ['tied, early',            0,   9999],
  ['down 3, 4:00 left',     -3,   240],
  ['down 3, 2:00 left',     -3,   120],
  ['down 10, 2:00 left',   -10,   120],
  ['up 3, 2:00 left',        3,   120],
];
for (const [label, m, s] of rows) console.log(`${label.padEnd(22)} -> range ${maxFGYd(42, m, s)} yd`);
const eEarly = maxFGYd(42, 0, 9999) === 42;
const eLate = maxFGYd(42, -3, 120) === 42 + C.FG_LATE_STRETCH;
const eMid = maxFGYd(42, -3, 240) === 42 + Math.round(C.FG_LATE_STRETCH/2);
const eTwoScore = maxFGYd(42, -10, 120) === 42;  // down two scores: not a 1-kick game, no stretch
const ePass = eEarly && eLate && eMid && eTwoScore;
console.log(`• stretch only fires down<=3 & late, not early / not two-score: ${ePass ? 'PASS ✅' : 'FAIL ❌'}`);

const ok = dPass && ePass;
console.log(`\n${ok ? 'ALL PASS ✅' : (dPass? 'E ok, D thin/failed':'see reads')}`);
process.exit(ok ? 0 : 1);
