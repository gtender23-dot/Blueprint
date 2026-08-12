// Validates the new special-teams / penalty / scoring systems produce realistic
// per-game numbers, and that the 4th-down model actually goes for it sometimes.
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

function genRoster(tier, schoolId){const r=[];for(const [pos,count] of Object.entries(ROSTER_TARGETS)){for(let i=0;i<count;i++){const p=createPlayer(pos, CLASS_YEARS[i%4], tier);p.schoolId=schoolId;r.push(p);}}return r;}
const gp={offFormation:'Pro-Set',tendency:'Balanced',rushInPct:60,passDepth:{short:40,medium:40,deep:20},blitzPct:20,defFormation:'Balanced D',fourthDown:'Moderate',clockMgmt:'Normal',maxFGDist:42};
const sH={id:'H',name:'Home'}, sA={id:'A',name:'Away'};

const N=1500;
let pen=0, penYds=0, safeties=0, twoAtt=0, twoMade=0;
const resultCounts = {};
let games=0;
for(let i=0;i<N;i++){
  const rH=genRoster(1,'H'),rA=genRoster(1,'A');
  const res=simulateGame(sH,sA,rH,rA,buildDepthChart(rH,gp),buildDepthChart(rA,gp),gp,gp);
  for(const st of [res.homeStats,res.awayStats]){pen+=st.penalties;penYds+=st.penaltyYds;safeties+=st.safeties;twoAtt+=st.twoPtAtt;twoMade+=st.twoPtMade;}
  for(const d of res.drives){resultCounts[d.result]=(resultCounts[d.result]||0)+1;}
  games++;
}
const g=games*2;
const f=(x,d=1)=>x.toFixed(d);
const chk=(v,lo,hi)=>(v>=lo&&v<=hi)?'  OK':'  ⚠';
console.log('=== PENALTIES / SCORING / SPECIAL TEAMS (per team/game unless noted) ===');
console.log(`Penalties/team:   ${f(pen/g)}${chk(pen/g,4,8)}  [NCAA ~5-7]`);
console.log(`Penalty yds/team: ${f(penYds/g)}${chk(penYds/g,35,70)}  [NCAA ~45-60]`);
console.log(`Safeties (per game, both): ${f(safeties/games,3)}  [NCAA ~0.05-0.15/game/team]`);
console.log(`2pt attempts (per game):   ${f(twoAtt/games,3)}   made%: ${twoAtt?f(100*twoMade/twoAtt):'-'}`);
console.log('\n=== DRIVE OUTCOME MIX (total across ' + games + ' games) ===');
const total=Object.values(resultCounts).reduce((a,b)=>a+b,0);
for(const [k,v] of Object.entries(resultCounts).sort((a,b)=>b[1]-a[1])){
  console.log(`  ${k.padEnd(20)} ${String(v).padStart(6)}  (${f(100*v/total)}%)`);
}
console.log('\nturnover_on_downs should be present and non-trivial (4th-down go logic works).');

// ── QB usage guard: starter should play ~every snap (no phantom backup) ──────
let multiQB=0, tgames=0;
for(let i=0;i<400;i++){
  const rH=genRoster(1,'H'),rA=genRoster(1,'A');
  const res=simulateGame(sH,sA,rH,rA,buildDepthChart(rH,gp),buildDepthChart(rA,gp),gp,gp);
  const injured=new Set((res.qbInjuries||[]).map(q=>q.playerId));
  for(const [ps,roster] of [[res.homePlayerStats,rH],[res.awayPlayerStats,rA]]){
    const qbIds=roster.filter(p=>p.position==='QB').map(p=>p.id);
    const passers=qbIds.filter(id=>ps[id]&&ps[id].passAtt>0);
    // Only count as anomalous if 2+ QBs threw AND the starter wasn't injured.
    if(passers.length>1 && !injured.has(qbIds[0])) multiQB++;
    tgames++;
  }
}
console.log(`\n=== QB USAGE GUARD ===`);
console.log(`Team-games w/ backup QB throwing (no starter injury): ${(100*multiQB/tgames).toFixed(1)}%  ${(100*multiQB/tgames)<15?'OK':'⚠'}  [should be low — only blowouts]`);
