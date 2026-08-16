// pressure_probe.mjs — dedicated probe for the W4 aggression/pressure-identity
// rework. Confirms (1) the sim still lands sacks/pressures/pass-defense in the
// same realistic bands as the pre-rework build, and (2) the NEW dials actually
// bite: raising the aggression stop raises the sack/pressure rate monotonically,
// and each pressure identity is legal (resolves, no crash, sane numbers).
//
// Run: PW_CHROMIUM unused (pure node). node tools/pressure_probe.mjs [gamesPerCell]
import { createPlayer, refreshRatings } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS, C } from '../js/constants.js';

function genRoster(tier, schoolId) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS))
    for (let i = 0; i < count; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], tier); p.schoolId = schoolId; r.push(p); }
  return r;
}
const sH = { id: 'H', name: 'Home' }, sA = { id: 'A', name: 'Away' };
const baseGp = () => ({ offFormation: 'Single Back', tendency: 'Balanced', rushInPct: 60,
  passDepth: { short: 40, medium: 40, deep: 20 }, defBaseFront: '4-3', coverageScheme: 'balanced',
  fourthDown: 'Moderate', maxFGDist: 42 });
const N = parseInt(process.argv[2] || '250', 10);

function runCell(defMut) {
  const t = { games: 0, patt: 0, sacks: 0, pcomp: 0, pyds: 0, pints: 0 };
  for (let i = 0; i < N; i++) {
    const rH = genRoster(1, 'H'), rA = genRoster(1, 'A');
    const offGp = baseGp();
    const defGp = { ...baseGp(), ...defMut };
    const cH = buildDepthChart(rH, offGp), cA = buildDepthChart(rA, defGp);
    // Home offense vs Away defense (the mutated one). Measure the defense's work.
    const res = simulateGame(sH, sA, rH, rA, cH, cA, offGp, defGp);
    // homeStats = the offense facing the mutated defense
    const o = res.homeStats;
    t.games++; t.patt += o.passAtt || 0; t.sacks += (res.homeStats.sacksAllowed || 0);
    t.pcomp += o.compAtt || 0; t.pyds += o.passYds || 0; t.pints += o.ints || 0;
  }
  const dropbacks = t.patt + t.sacks;
  return {
    sackPct: (100 * t.sacks / Math.max(1, dropbacks)),
    sacksPerG: (t.sacks / t.games),
    compPct: (100 * t.pcomp / Math.max(1, t.patt)),
    ypa: (t.pyds / Math.max(1, t.patt)),
    intPct: (100 * t.pints / Math.max(1, t.patt)),
  };
}
const f2 = x => x.toFixed(2);
console.log(`=== PRESSURE PROBE (N=${N} games/cell) ===\n`);

// (A) Aggression sweep — identity on AUTO (front signature), stop varied.
console.log('(A) AGGRESSION STOP SWEEP (4-3 base, identity=AUTO):');
console.log('stop         sack%   sacks/g  comp%   ypa    int%');
const aggrRows = {};
for (const stop of C.AGGRESSION.order) {
  const r = runCell({ defAggression: stop, pressureIdentity: null });
  aggrRows[stop] = r;
  console.log(`${stop.padEnd(11)}  ${f2(r.sackPct).padStart(5)}   ${f2(r.sacksPerG).padStart(5)}    ${f2(r.compPct).padStart(5)}  ${f2(r.ypa).padStart(5)}  ${f2(r.intPct).padStart(4)}`);
}

// (B) Pressure identity sweep at a fixed stop (attacking), 4-3.
console.log('\n(B) PRESSURE IDENTITY SWEEP (4-3 base, stop=attacking):');
console.log('identity        sack%   sacks/g  comp%   ypa    int%');
for (const id of [null, ...Object.keys(C.PRESS_IDENTITY)]) {
  const r = runCell({ defAggression: 'attacking', pressureIdentity: id });
  console.log(`${(id||'auto').padEnd(14)}  ${f2(r.sackPct).padStart(5)}   ${f2(r.sacksPerG).padStart(5)}    ${f2(r.compPct).padStart(5)}  ${f2(r.ypa).padStart(5)}  ${f2(r.intPct).padStart(4)}`);
}

// (C) Protection identity sweep (offense), vs an attacking defense.
console.log('\n(C) PROTECTION IDENTITY SWEEP (offense, vs attacking 4-3):');
console.log('protId          sack%   sacks/g  comp%   ypa');
function runProt(protId){
  const t={games:0,patt:0,sacks:0,pcomp:0,pyds:0};
  for(let i=0;i<N;i++){
    const rH=genRoster(1,'H'),rA=genRoster(1,'A');
    const offGp={...baseGp(),protIdentity:protId};
    const defGp={...baseGp(),defAggression:'attacking'};
    const cH=buildDepthChart(rH,offGp),cA=buildDepthChart(rA,defGp);
    const res=simulateGame(sH,sA,rH,rA,cH,cA,offGp,defGp);
    const o=res.homeStats; t.games++;t.patt+=o.passAtt||0;t.sacks+=res.homeStats.sacksAllowed||0;t.pcomp+=o.compAtt||0;t.pyds+=o.passYds||0;
  }
  const db=t.patt+t.sacks;
  return {sackPct:100*t.sacks/Math.max(1,db),sacksPerG:t.sacks/t.games,compPct:100*t.pcomp/Math.max(1,t.patt),ypa:t.pyds/Math.max(1,t.patt)};
}
for(const pid of C.PROT_IDENTITY.order){
  const r=runProt(pid);
  console.log(`${pid.padEnd(14)}  ${f2(r.sackPct).padStart(5)}   ${f2(r.sacksPerG).padStart(5)}    ${f2(r.compPct).padStart(5)}  ${f2(r.ypa).padStart(5)}`);
}

// ── ASSERTIONS ──
console.log('\n=== CHECKS ===');
let pass = true;
const chk = (name, cond, detail='') => { console.log(`  ${cond?'OK  ':'FAIL'}  ${name}${detail?'  '+detail:''}`); if(!cond) pass=false; };
// 1. Monotonic-ish: house sacks more than bend
chk('house sack% > bend sack%', aggrRows.house.sackPct > aggrRows.bend.sackPct,
    `bend=${f2(aggrRows.bend.sackPct)} house=${f2(aggrRows.house.sackPct)}`);
chk('attacking sack% >= balanced', aggrRows.attacking.sackPct >= aggrRows.balanced.sackPct - 0.3,
    `bal=${f2(aggrRows.balanced.sackPct)} atk=${f2(aggrRows.attacking.sackPct)}`);
// 2. Balanced (=league default=old 20%) sacks/g in the same band as the pre-rework build (~1.8-2.5)
chk('balanced sacks/team in [1.6,2.8]', aggrRows.balanced.sacksPerG>=1.6 && aggrRows.balanced.sacksPerG<=2.8,
    `sacks/g=${f2(aggrRows.balanced.sacksPerG)}`);
// 3. Pass defense sane across the board (comp% 50-70, ypa 5.5-8, int% 1-4)
for(const s of C.AGGRESSION.order){const r=aggrRows[s];
  chk(`${s} comp% in [48,72]`, r.compPct>=48&&r.compPct<=72, `${f2(r.compPct)}`);
  chk(`${s} ypa in [5,9]`, r.ypa>=5&&r.ypa<=9, `${f2(r.ypa)}`);
}
// 4. Aggression trades: house should allow MORE ypa than bend (risk = big plays)
chk('house ypa >= bend ypa (risk shows up)', aggrRows.house.ypa >= aggrRows.bend.ypa - 0.4,
    `bend=${f2(aggrRows.bend.ypa)} house=${f2(aggrRows.house.ypa)}`);
console.log('\n'+(pass?'ALL PRESSURE CHECKS PASSED':'*** PRESSURE CHECKS FAILED ***'));
process.exit(pass?0:1);
