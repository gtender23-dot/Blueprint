// st_net_probe.mjs — emergent special-teams field-position veto (subsystem 6).
// Runs whole games and measures what actually reaches the box score: punt NET (gross minus
// return), touchback/fair-catch/block shares, kickoff return average + house rate (traditional
// rules), and onside recovery rate. The isolated kicking_model_probe measures gross; THIS one is
// the check that returns/touchbacks land net punting ~40 and KO returns ~22. Usage: node tools/st_net_probe.mjs
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
function genRoster(tier,schoolId){const r=[];for(const [pos,count] of Object.entries(ROSTER_TARGETS)){for(let i=0;i<count;i++){const p=createPlayer(pos,CLASS_YEARS[i%4],tier);p.schoolId=schoolId;r.push(p);}}return r;}
const gp={offFormation:'Pro-Set',tendency:'Balanced',rushInPct:60,passDepth:{short:40,medium:40,deep:20},blitzPct:20,defFormation:'Balanced D',fourthDown:'Moderate',clockMgmt:'Normal',maxFGDist:42};
const sH={id:'H',name:'Home'},sA={id:'A',name:'Away'};
const N=400;
let gross=0,ret=0,punts=0,tb=0,blocked=0,fair=0,puntRetTD=0;
let koRet=0,koYds=0,koTD=0,koTB=0;
let onsideAtt=0,onsideRec=0;
for(let i=0;i<N;i++){
  const rH=genRoster(1,'H'),rA=genRoster(1,'A');
  const res=simulateGame(sH,sA,rH,rA,buildDepthChart(rH,gp),buildDepthChart(rA,gp),gp,gp);
  for(const d of res.drives){
    for(const p of (d.plays||[])){
      if(p.type==='punt'){
        if(p.blocked){blocked++;continue;}
        punts++; gross+=p.puntYds||0; ret+=p.returnYds||0;
        if(p.touchback)tb++;
        if(p.returnTD)puntRetTD++;
        if(!p.touchback && !(p.returnYds>0))fair++;
      }
      if(p.type==='kickoff'){
        if(p.onside){onsideAtt++; if(p.recovered)onsideRec++; continue;}
        if(p.touchback)koTB++; else {koRet++; koYds+=p.retYds||0; if(p.returnTD)koTD++;}
      }
    }
  }
}
const f=(x,d=1)=>x.toFixed(d);
console.log(`PUNTS n=${punts} (+${blocked} blocked)`);
console.log(`  gross avg      ${f(gross/punts)}   (real ~45-46)`);
console.log(`  return avg     ${f(ret/punts)}   net(gross-ret) ${f((gross-ret)/punts)}   (real net ~40-42)`);
console.log(`  touchback%     ${f(100*tb/punts)}   fair/downed%(no ret) ${f(100*fair/punts)}   (fair-catch const 0.45)`);
console.log(`  blocked%       ${f(100*blocked/(punts+blocked))}   puntRetTD/punt% ${f(100*puntRetTD/punts,2)}`);
console.log(`KICKOFFS returned=${koRet} tb=${koTB}  (traditional)`);
console.log(`  touchback%     ${f(100*koTB/(koRet+koTB))}   (KICKOFF_TOUCHBACK_BASE 0.62)`);
console.log(`  return avg     ${f(koYds/koRet)}   koRetTD/ret% ${f(100*koTD/koRet,2)}   (real KO ret ~20-22)`);
console.log(`ONSIDE att=${onsideAtt} rec=${onsideRec}  rate ${onsideAtt?f(100*onsideRec/onsideAtt):'-'}%   (flat 15%; real expected ~9-13%)`);

// ── PASS 6: return-scheme identity gates (direct, noise-free) ────────────────
import { returnOutcome } from '../js/engine/sim.js';
let pass=true;
const check=(ok,label)=>{console.log(`  [${ok?'PASS':'FAIL'}] ${label}`);if(!ok)pass=false;};
console.log('\nPASS 6 return-scheme gates (returnOutcome direct, N=50000/cell):');
function stats(scheme,retLv=0){
  const M=50000;let s=0,tds=0;
  for(let i=0;i<M;i++){const r=returnOutcome(60,55,3,19,scheme,retLv);s+=r.yards;if(r.td)tds++;}
  return {mean:s/M,tdPct:100*tds/M};
}
const bal=stats('balanced'),safe=stats('safe'),wall=stats('wall'),wallV=stats('wall',3);
check(wall.mean>bal.mean+0.7&&bal.mean>safe.mean+0.7,`means ordered: wall ${f(wall.mean)} > balanced ${f(bal.mean)} > safe ${f(safe.mean)}`);
check(wall.tdPct>safe.tdPct*2,`house calls: wall ${f(wall.tdPct,2)}% > 2× safe ${f(safe.tdPct,2)}%`);
check(wallV.mean>wall.mean+0.2,`returnVision matters more under wall: lv3 ${f(wallV.mean)} > lv0 ${f(wall.mean)}`);
globalThis.__noRetScheme=true;
const killWall=stats('wall'),killSafe=stats('safe');
delete globalThis.__noRetScheme;
check(Math.abs(killWall.mean-killSafe.mean)<0.35,`__noRetScheme flattens schemes: wall ${f(killWall.mean)} ≈ safe ${f(killSafe.mean)}`);
console.log(pass?'\nSCHEME GATES PASS ✅ (report above is the band check)':'\n⚠ SCHEME GATES FAIL');
process.exit(pass?0:1);
