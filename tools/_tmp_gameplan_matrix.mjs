import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

const N = parseInt(process.argv[2] || '60', 10);
const realRandom = Math.random;
const rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
};
function gen(tier, schoolId) {
  const out = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], tier);
      p.schoolId = schoolId;
      out.push(p);
    }
  }
  return out;
}
const base = (o = {}) => ({
  offFormations: [{ id: 'Single Back', weight: 100 }], tendency: 'Balanced',
  rushInPct: 60, passDepth: { short: 40, medium: 40, deep: 20 },
  qbAggr: 50, baseTempo: 'Normal', fourthDown: 'Moderate', maxFGDist: 42,
  defBaseFront: '4-3', blitzPct: 20, coverageScheme: 'balanced',
  covShell: 'balanced', pressLevel: 'balanced', runCommit: 0, situations: {}, ...o
});
const schools = [{ id: 'H', name: 'Home' }, { id: 'A', name: 'Away' }];
const pool = [];
for (let i = 0; i < N; i++) {
  Math.random = rng(1000 + i);
  pool.push([gen(1, 'H'), gen(1, 'A')]);
}

function freshMetric() {
  return { games: 0, score: 0, pass: 0, run: 0, ydsPass: 0, passAtt: 0,
    ydsRun: 0, rushAtt: 0, sacks: 0, db: 0, blitz: 0, explosive: 0,
    sitPass: 0, sitRun: 0, targets: {}, forms: {}, snaps: 0 };
}
function absorb(m, res, side = 'home', sit = null) {
  m.games++;
  m.score += side === 'home' ? res.homeScore : res.awayScore;
  const st = side === 'home' ? res.homeStats : res.awayStats;
  m.ydsPass += st.passYds || 0; m.passAtt += st.passAtt || 0;
  m.ydsRun += st.rushYds || 0; m.rushAtt += st.rushAtt || 0;
  m.sacks += st.sacksAllowed || 0;
  for (const d of res.drives || []) if (d.possession === side) {
    for (const p of d.plays || []) {
      const isPass = String(p.type).startsWith('pass');
      const isRun = String(p.type).startsWith('run');
      if (!isPass && !isRun) continue;
      m.snaps++; if (isPass) m.pass++; else m.run++;
      m.forms[p.offFormation || '?'] = (m.forms[p.offFormation || '?'] || 0) + 1;
      if (isPass) {
        m.db++;
        if (p.blitzFired) m.blitz++;
        if ((p.yards || 0) >= 20) m.explosive++;
        if (p.targetSlotId) m.targets[p.targetSlotId] = (m.targets[p.targetSlotId] || 0) + 1;
      }
      if (sit && p.offSit === sit) isPass ? m.sitPass++ : m.sitRun++;
    }
  }
}
function runArm(offFn, defFn, side = 'home', sit = null, bothSame = false) {
  const m = freshMetric();
  for (let i = 0; i < pool.length; i++) {
    const rH = structuredClone(pool[i][0]), rA = structuredClone(pool[i][1]);
    const gpH = offFn(), gpA = bothSame ? offFn() : defFn();
    Math.random = rng(500000 + i);
    const res = simulateGame(schools[0], schools[1], rH, rA,
      buildDepthChart(rH, gpH), buildDepthChart(rA, gpA), gpH, gpA);
    absorb(m, res, side, sit);
  }
  return m;
}
const pct = (a, b) => 100 * a / Math.max(1, b);
const f = (x, n = 1) => Number(x).toFixed(n);
const line = (name, m) => console.log(`${name.padEnd(19)} pass ${f(pct(m.pass,m.pass+m.run))}% | pts ${f(m.score/m.games)} | YPA ${f(m.ydsPass/m.passAtt,2)} | YPC ${f(m.ydsRun/m.rushAtt,2)} | sacks ${f(pct(m.sacks,m.db),2)}% | blitz ${f(pct(m.blitz,m.db),1)}%`);
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails++; };

console.log(`GAME PLAN EXTREME MATRIX — ${N} matched games per arm\n`);

console.log('A. SIMPLE OFFENSIVE IDENTITY (neutral defense)');
const runId = runArm(() => base({ tendency:'Heavy Run', passDepth:{short:50,medium:38,deep:12} }), () => base());
const passId = runArm(() => base({ tendency:'Heavy Pass', passDepth:{short:30,medium:40,deep:30} }), () => base());
line('RUN FIRST', runId); line('PASS FIRST', passId);
check(pct(passId.pass,passId.pass+passId.run) > pct(runId.pass,runId.pass+runId.run) + 20, 'identity creates a large run/pass separation');

console.log('\nB. SIMPLE DEFENSIVE POSTURE (same neutral offense)');
const attack = runArm(() => base(), () => base({ blitzPct:38,coverageScheme:'aggressive',covShell:'single',pressLevel:'press',runCommit:8 }));
const bend = runArm(() => base(), () => base({ blitzPct:10,coverageScheme:'conservative',covShell:'two',pressLevel:'off',runCommit:-6 }));
line('vs ATTACK', attack); line('vs BEND', bend);
check(pct(attack.blitz,attack.db) > pct(bend.blitz,bend.db) + 12, 'attack posture produces materially more fired blitzes');
check(attack.ydsRun/attack.rushAtt < bend.ydsRun/bend.rushAtt, 'attack posture is stouter against the run');

console.log('\nC. TEMPO (both teams use the same tempo)');
const chew = runArm(() => base({ baseTempo:'Chew' }), () => base(), 'home', null, true);
const hurry = runArm(() => base({ baseTempo:'Hurry' }), () => base(), 'home', null, true);
console.log(`CHEW  ${f(chew.snaps/chew.games)} offensive snaps/team | HURRY ${f(hurry.snaps/hurry.games)} offensive snaps/team`);
check(hurry.snaps/hurry.games > chew.snaps/chew.games + 5, 'hurry creates substantially more offensive snaps than chew');

console.log('\nD. THIRD-AND-LONG OVERRIDE (same balanced base)');
const sitRun = runArm(() => base({ situations:{ third_long:{ tendency:'Heavy Run' } } }), () => base(), 'home', 'third_long');
const sitPass = runArm(() => base({ situations:{ third_long:{ tendency:'Heavy Pass' } } }), () => base(), 'home', 'third_long');
const sitRunRate = pct(sitRun.sitPass, sitRun.sitPass+sitRun.sitRun), sitPassRate = pct(sitPass.sitPass, sitPass.sitPass+sitPass.sitRun);
console.log(`RUN MORE ${f(sitRunRate)}% pass (n=${sitRun.sitPass+sitRun.sitRun}) | PASS MORE ${f(sitPassRate)}% pass (n=${sitPass.sitPass+sitPass.sitRun})`);
check(sitPassRate > sitRunRate + 15, 'third-and-long offense override changes the call mix');

console.log('\nE. FORMATION EXTREMES (actual recorded on-field formation)');
const empty = runArm(() => base({ offFormations:[{id:'Empty',weight:100}] }), () => base());
const power = runArm(() => base({ offFormations:[{id:'Power-I',weight:100}] }), () => base());
line('EMPTY', empty); line('POWER-I', power);
console.log(`formation fidelity: Empty ${empty.forms.Empty||0}/${empty.snaps}, Power-I ${power.forms['Power-I']||0}/${power.snaps}`);
check((empty.forms.Empty||0) === empty.snaps && (power.forms['Power-I']||0) === power.snaps, '100% formation pins reach the field without leakage');
check(pct(empty.pass,empty.pass+empty.run) > pct(power.pass,power.pass+power.run) + 8, 'Empty leans more pass-heavy than Power-I under the same tendency');

console.log('\nF. DEFAULT TARGET SHARE EXTREMES');
const wr = runArm(() => base({ tendency:'Heavy Pass', targetShares:{WR1:40,WR2:0,WR3:0,TE1:0,RB1:0} }), () => base());
const te = runArm(() => base({ tendency:'Heavy Pass', targetShares:{WR1:0,WR2:0,WR3:0,TE1:40,RB1:0} }), () => base());
const wrShare = pct(wr.targets.WR1||0, Object.values(wr.targets).reduce((a,b)=>a+b,0));
const teShare = pct(te.targets.TE1||0, Object.values(te.targets).reduce((a,b)=>a+b,0));
console.log(`WR1 FEATURE: WR1 gets ${f(wrShare)}% of logged targets | TE FEATURE: TE1 gets ${f(teShare)}%`);
check(wrShare > 30 && teShare > 25, 'extreme target-share plans visibly feature the requested eligible receiver');

Math.random = realRandom;
console.log(`\n${fails ? `GAME PLAN MATRIX: ${fails} FAIL` : 'GAME PLAN MATRIX PASS'}`);
process.exit(fails ? 1 : 0);
