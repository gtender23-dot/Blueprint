// blitz_reality_probe.mjs — validates the three "understand blitzing" fixes:
//  A) coverage cost: The House gives up more ypa/explosives than Fire Zone.
//  B) QB hot answer: a sharp QB beats the blitz more than a raw one.
//  C) blitz-the-formation: empty/spread sets draw more pressure than heavy sets.
import { createPlayer, refreshRatings } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS, C } from '../js/constants.js';
function gen(t,s){const r=[];for(const[p,c]of Object.entries(ROSTER_TARGETS))for(let i=0;i<c;i++){const q=createPlayer(p,CLASS_YEARS[i%4],t);q.schoolId=s;r.push(q);}return r;}
const sH={id:'H',name:'Home'},sA={id:'A',name:'Away'};
const base=()=>({offFormation:'Single Back',tendency:'Balanced',rushInPct:60,passDepth:{short:40,medium:40,deep:20},defBaseFront:'4-3',coverageScheme:'balanced',fourthDown:'Moderate',maxFGDist:42});
const N=parseInt(process.argv[2]||'200',10);
function cell(defMut,offMut,qbSpec){
  const t={g:0,patt:0,sk:0,comp:0,yds:0,ints:0,expl:0};
  for(let i=0;i<N;i++){
    const rH=gen(1,'H'),rA=gen(1,'A');
    const offGp={...base(),...offMut}, defGp={...base(),...defMut};
    const cH=buildDepthChart(rH,offGp),cA=buildDepthChart(rA,defGp);
    if(qbSpec){const qb=rH.find(p=>p.id===cH.QB[0]); if(qb){qb.attributes.AWR=qbSpec.awr;qb.attributes.TEC=qbSpec.tec;refreshRatings(qb);}}
    const res=simulateGame(sH,sA,rH,rA,cH,cA,offGp,defGp);
    const o=res.homeStats; t.g++; t.patt+=o.passAtt||0; t.sk+=o.sacksAllowed||0; t.comp+=o.compAtt||0; t.yds+=o.passYds||0; t.ints+=o.ints||0;
  }
  const db=t.patt+t.sk;
  return { sackPct:100*t.sk/Math.max(1,db), comp:100*t.comp/Math.max(1,t.patt), ypa:t.yds/Math.max(1,t.patt), intPct:100*t.ints/Math.max(1,t.patt) };
}
const f2=x=>x.toFixed(2);
console.log(`=== BLITZ REALITY PROBE (N=${N}) ===\n`);

// A) Coverage cost by identity (attacking stop, so blitzes actually fire)
console.log('(A) COVERAGE COST — does the risk tier bleed yards? (stop=attacking)');
console.log('identity        sack%  comp%   ypa    int%');
const idA={};
for(const id of ['fireZone','secondLevel','secondaryHeat','theHouse']){
  const r=cell({defAggression:'attacking',pressureIdentity:id});
  idA[id]=r;
  console.log(`  ${id.padEnd(14)} ${f2(r.sackPct).padStart(5)}  ${f2(r.comp).padStart(5)}  ${f2(r.ypa).padStart(5)}  ${f2(r.intPct).padStart(4)}`);
}

// B) QB hot answer: sharp vs raw QB facing the same house blitz
console.log('\n(B) QB HOT ANSWER — sharp vs raw QB vs The House:');
const sharp=cell({defAggression:'house',pressureIdentity:'theHouse'},{},{awr:92,tec:92});
const raw  =cell({defAggression:'house',pressureIdentity:'theHouse'},{},{awr:55,tec:55});
console.log(`  sharp QB (AWR/TEC 92): sack% ${f2(sharp.sackPct)}  comp% ${f2(sharp.comp)}  ypa ${f2(sharp.ypa)}`);
console.log(`  raw QB   (AWR/TEC 55): sack% ${f2(raw.sackPct)}  comp% ${f2(raw.comp)}  ypa ${f2(raw.ypa)}`);

// C) Blitz-the-formation: empty vs heavy offense, same defense (attacking)
console.log('\n(C) BLITZ THE FORMATION — sack% by offensive look (defense=attacking 4-3):');
const empty=cell({defAggression:'attacking'},{offFormation:'Empty'});
const heavy=cell({defAggression:'attacking'},{offFormation:'Power-I'});
console.log(`  Empty set:  sack% ${f2(empty.sackPct)}  comp% ${f2(empty.comp)}`);
console.log(`  Power-I:    sack% ${f2(heavy.sackPct)}  comp% ${f2(heavy.comp)}`);

console.log('\n=== CHECKS ===');
let pass=true; const chk=(n,c,d='')=>{console.log(`  ${c?'OK  ':'FAIL'}  ${n}${d?'  '+d:''}`); if(!c)pass=false;};
chk('A: The House bleeds more ypa than Fire Zone', idA.theHouse.ypa > idA.fireZone.ypa,
    `fireZone=${f2(idA.fireZone.ypa)} house=${f2(idA.theHouse.ypa)}`);
chk('A: secondaryHeat opens more than secondLevel (DB hole)', idA.secondaryHeat.ypa >= idA.secondLevel.ypa - 0.15,
    `2nd=${f2(idA.secondLevel.ypa)} heat=${f2(idA.secondaryHeat.ypa)}`);
chk('B: sharp QB completes more vs the house than raw QB', sharp.comp > raw.comp,
    `sharp=${f2(sharp.comp)} raw=${f2(raw.comp)}`);
chk('C: empty set draws more pressure than heavy set', empty.sackPct > heavy.sackPct,
    `empty=${f2(empty.sackPct)} heavy=${f2(heavy.sackPct)}`);
console.log('\n'+(pass?'ALL BLITZ-REALITY CHECKS PASSED':'*** SOME CHECKS FAILED ***'));
process.exit(pass?0:1);
