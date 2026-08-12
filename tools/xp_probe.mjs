// xp_probe.mjs — proves the PAT reads the kicker (subsystem 6, fix B). Measures league-mean XP%
// (must hold ~0.96, the old flat PAT_RATE) and the make% spread by kicker accuracy bucket, so a
// walk-on misses more and an elite kicker is near-automatic without moving the league rate.
// Usage: node tools/xp_probe.mjs
import { createPlayer } from '../js/engine/player.js';
import { xpMakeProb } from '../js/engine/sim.js';
const N=4000;
const ks=Array.from({length:N},()=>createPlayer('K','JR',1));
const asDepth=p=>({K:[p.id]});
let sum=0; const buckets={'<45':[],'45-55':[],'55-65':[],'65+':[]};
for(const k of ks){
  const acc=0.5*k.attributes.TEC+0.5*k.attributes.AWR;
  const p=xpMakeProb([k],asDepth(k)); sum+=p;
  const b=acc<45?'<45':acc<55?'45-55':acc<65?'55-65':'65+'; buckets[b].push(p);
}
const mean=a=>a.reduce((x,y)=>x+y,0)/(a.length||1);
console.log(`XP make% — league mean ${(100*sum/N).toFixed(2)}%  (target ~96, flat was 96.0)`);
for(const [b,a] of Object.entries(buckets)) console.log(`  acc ${b.padEnd(6)} n=${String(a.length).padStart(4)}  mean ${(100*mean(a)).toFixed(1)}%`);
