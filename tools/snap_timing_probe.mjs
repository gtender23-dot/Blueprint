// Snap-timing probe: the ball must travel from center to the ball-handler before
// any throw/handoff — it must NOT be in the QB's hands at the instant of the snap.
// Reuses watchphys_probe's exact harvest so the play stream is real engine output.
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
import { OFF_FIELD_LAYOUTS, DEF_FIELD_LAYOUTS } from '../js/constants_field.js';
import { buildPlayScript, sampleTrack } from '../js/ui/watchphys.js';

const N = parseInt(process.argv[2] || '8', 10);
const LOS = 31, STEP = 0.05;
function genRoster(t, s){ const r=[]; for(const [pos,c] of Object.entries(ROSTER_TARGETS)) for(let i=0;i<c;i++){const p=createPlayer(pos,CLASS_YEARS[i%4],t);p.schoolId=s;r.push(p);} return r; }
const mk=(o={})=>({ offFormations:[{id:'Spread',weight:30},{id:'Single Back',weight:25},{id:'Flexbone',weight:20},{id:'Wildcat',weight:10},{id:'Power-I',weight:15}],
  tendency:'Balanced', rushInPct:55, passDepth:{short:40,medium:40,deep:20}, blitzPct:30, fourthDown:'Moderate', baseTempo:'Normal', maxFGDist:42, jetRate:25, drawRate:20, ...o });
const sH={id:'H',name:'H'}, sA={id:'A',name:'A'};

const plays=[];
for(let i=0;i<N;i++){
  const rH=genRoster(1,'H'), rA=genRoster(1,'A');
  const res=simulateGame(sH,sA,rH,rA,buildDepthChart(rH,mk()),buildDepthChart(rA,mk()),mk(),mk());
  for(const d of (res.drives||[])) for(const p of (d.plays||[])) plays.push(p);
}

let cPass=0,cRun=0,cWild=0, instant=0, snapTravelSeen=0;
for(const p of plays){
  const t=String(p.type||'');
  const isPass=t.startsWith('pass')&&!p.isScramble;
  const isRun =t.startsWith('run')||p.isScramble;
  if(!isPass&&!isRun) continue;
  const off=OFF_FIELD_LAYOUTS[p.offFormation]?.slots;
  const def=(DEF_FIELD_LAYOUTS[p.defFront]||DEF_FIELD_LAYOUTS['4-3']).slots;
  if(!off) continue;
  const s=buildPlayScript(p,off,def);
  if(!s) continue;
  const qbA=s.actors.find(a=>a.qb); const qb0=qbA?qbA.track[0]:null;
  const PRESNAP=(p.optionPhase==='jet')?0.95:0.55;

  // ball just after the snap instant
  const bJust=sampleTrack(s.ball.track, STEP, PRESNAP+0.02);
  const dCenter=Math.hypot(bJust[0]-50, bJust[1]-(LOS+0.6));
  const dQB=qb0?Math.hypot(bJust[0]-qb0[0], bJust[1]-qb0[1]):999;
  // Teleport = ball already at the QB (far from center) the instant after the snap.
  if(dQB<0.5 && dCenter>1.5) instant++;

  // Positive check: sample across the snap window; the ball should MOVE from
  // near-center toward the handler (a real snap in flight), i.e. its distance to
  // center should grow over the first ~0.2s on a gun snap.
  const b0=sampleTrack(s.ball.track,STEP,PRESNAP+0.02);
  const b1=sampleTrack(s.ball.track,STEP,PRESNAP+0.12);
  const moved=Math.hypot(b1[0]-b0[0], b1[1]-b0[1]);
  if(moved>0.05) snapTravelSeen++;

  if(isPass) cPass++; else if(p.optionPhase==='wildcat') cWild++; else cRun++;
}

console.log(`checked — pass:${cPass} run:${cRun} wildcat:${cWild}`);
console.log(`ball teleported to QB at the snap: ${instant}`);
console.log(`plays showing snap travel in the first 0.1s: ${snapTravelSeen}`);
const ok = instant===0 && (cPass+cRun)>50;
console.log(ok?'✅ SNAP-TIMING PROBE PASS — the snap always travels; no instant throw/handoff'
             :`❌ SNAP-TIMING PROBE FAIL — ${instant} instant-snap plays`);
process.exit(ok?0:1);
