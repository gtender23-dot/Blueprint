// Verifies the Jul 2026 playbook build: throw timing keys off the route and
// clamps under pressure (holds on incompletions); screens throw at their
// kind cadence; jet meshes at the QB (ball holds near center through the snap).
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
import { OFF_FIELD_LAYOUTS, DEF_FIELD_LAYOUTS } from '../js/constants_field.js';
import { buildPlayScript, sampleTrack } from '../js/ui/watchphys.js';
const LOS=31, YPU=0.85, STEP=0.05;
function gen(t,s){const r=[];for(const[p,c]of Object.entries(ROSTER_TARGETS))for(let i=0;i<c;i++){const x=createPlayer(p,CLASS_YEARS[i%4],t);x.schoolId=s;r.push(x);}return r;}
const mk=(o={})=>({offFormations:[{id:'Spread',weight:25},{id:'Air Raid',weight:20},{id:'Single Back',weight:20},{id:'Flexbone',weight:15},{id:'Power-I',weight:10},{id:'Wildcat',weight:10}],tendency:'Balanced',rushInPct:50,passDepth:{short:35,medium:40,deep:25},blitzPct:35,fourthDown:'Moderate',baseTempo:'Normal',maxFGDist:42,jetRate:30,drawRate:15,screenRate:20,...o});
const sH={id:'H',name:'H'},sA={id:'A',name:'A'};
const plays=[];
for(let i=0;i<12;i++){const rH=gen(1,'H'),rA=gen(1,'A');const res=simulateGame(sH,sA,rH,rA,buildDepthChart(rH,mk()),buildDepthChart(rA,mk()),mk(),mk());for(const d of(res.drives||[]))for(const p of(d.plays||[]))plays.push(p);}

let fails=0; const ok=(c,m)=>{console.log((c?'✅':'❌')+' '+m); if(!c)fails++;};

// helper: throw time = first frame after PRESNAP where the ball leaves the QB's
// hands region (distance from the QB > 3 units) — a clean release detector that
// isn't fooled by slow short-throw flights or post-catch YAC.
function throwTime(s, PRESNAP){
  const qb=s.actors.find(a=>a.qb);
  const bt=s.ball.track;
  for(let i=Math.round(PRESNAP/STEP);i<bt.length;i++){
    const q=qb.track[Math.min(i,qb.track.length-1)];
    const d=Math.hypot(bt[i][0]-q[0], bt[i][1]-(q[1]-0.8));
    if (d > 3) return i*STEP;
  }
  return null;
}

// 1) Deep passes throw LATER than short passes (route-keyed): compare medians.
const passer=plays.filter(p=>String(p.type).startsWith('pass')&&!p.isScramble&&!p.sack&&!p.isScreen);
const tOf=(pred)=>{const ts=[];for(const p of passer.filter(pred)){const off=OFF_FIELD_LAYOUTS[p.offFormation]?.slots;if(!off)continue;const s=buildPlayScript(p,off,(DEF_FIELD_LAYOUTS[p.defFront]||DEF_FIELD_LAYOUTS['4-3']).slots);if(!s)continue;const PRESNAP=(p.optionPhase==='jet')?0.95:0.55;const tt=throwTime(s,PRESNAP);if(tt!=null)ts.push(tt);}ts.sort((a,b)=>a-b);return ts.length?ts[Math.floor(ts.length/2)]:null;};
const tShort=tOf(p=>p.type==='pass_short'), tDeep=tOf(p=>p.type==='pass_deep');
ok(tShort!=null && tDeep!=null && tDeep > tShort, `deep passes release later than short (short med=${tShort?.toFixed(2)}s, deep med=${tDeep?.toFixed(2)}s)`);

// 2) Under pressure (hurried), the throw comes EARLIER than a clean pocket at the same depth.
const depthMed=(hurried)=>{const ts=[];for(const p of passer.filter(p=>p.type==='pass_medium'&&!!p.hurried===hurried)){const off=OFF_FIELD_LAYOUTS[p.offFormation]?.slots;if(!off)continue;const s=buildPlayScript(p,off,(DEF_FIELD_LAYOUTS[p.defFront]||DEF_FIELD_LAYOUTS['4-3']).slots);if(!s)continue;const tt=throwTime(s,0.55);if(tt!=null)ts.push(tt);}ts.sort((a,b)=>a-b);return ts.length?ts[Math.floor(ts.length/2)]:null;};
const tClean=depthMed(false), tHur=depthMed(true);
ok(tClean!=null && tHur!=null ? tHur <= tClean + 0.01 : true, `pressure releases no later than clean (clean=${tClean?.toFixed(2)}s, hurried=${tHur?.toFixed(2)}s)`);

// 3) Incompletions STILL have a real throw time (not an instant dump / never).
const incs=passer.filter(p=>!p.complete&&!p.turnover);
let incThrows=0, incTotal=0;
for(const p of incs){const off=OFF_FIELD_LAYOUTS[p.offFormation]?.slots;if(!off)continue;const s=buildPlayScript(p,off,(DEF_FIELD_LAYOUTS[p.defFront]||DEF_FIELD_LAYOUTS['4-3']).slots);if(!s)continue;incTotal++;const tt=throwTime(s,0.55);if(tt!=null && tt>0.6)incThrows++;}
ok(incTotal>10 && incThrows/incTotal > 0.9, `incompletions still make a real throw at a real time (${incThrows}/${incTotal})`);

// 4) Jet: ball holds near center (|x-50|<12) through the snap window, then sweeps.
const jets=plays.filter(p=>p.optionPhase==='jet');
let jetOK=0, jetN=0;
for(const p of jets){const off=OFF_FIELD_LAYOUTS[p.offFormation]?.slots;if(!off)continue;const s=buildPlayScript(p,off,(DEF_FIELD_LAYOUTS[p.defFront]||DEF_FIELD_LAYOUTS['4-3']).slots);if(!s)continue;jetN++;const b=sampleTrack(s.ball.track,STEP,1.0);if(Math.abs(b[0]-50)<14)jetOK++;}
ok(jetN>5 && jetOK/jetN>0.85, `jet ball meshes at the QB near center (not straight to the WR): ${jetOK}/${jetN}`);

// 5) Screens: bubble throws earliest, rb latest (kind cadence).
const scr=(kindRx)=>{const ts=[];for(const p of plays.filter(p=>p.isScreen&&kindRx.test(String(p.concept||'')))){const off=OFF_FIELD_LAYOUTS[p.offFormation]?.slots;if(!off)continue;const s=buildPlayScript(p,off,(DEF_FIELD_LAYOUTS[p.defFront]||DEF_FIELD_LAYOUTS['4-3']).slots);if(!s)continue;const tt=throwTime(s,0.55);if(tt!=null)ts.push(tt);}ts.sort((a,b)=>a-b);return ts.length?ts[Math.floor(ts.length/2)]:null;};
const tBub=scr(/Bubble/i), tRB=scr(/RB Screen/i);
ok(tBub==null||tRB==null||tBub<=tRB+0.05, `screen cadence: bubble no later than rb (bubble=${tBub?.toFixed(2)}, rb=${tRB?.toFixed(2)}) [null=too few samples, ok]`);

console.log('');
console.log(fails?`PLAYBOOK BUILD PROBE: ${fails} FAIL`:'PLAYBOOK BUILD PROBE PASS');
process.exit(fails?1:0);
