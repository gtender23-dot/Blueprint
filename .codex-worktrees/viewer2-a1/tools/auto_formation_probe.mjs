// Auto-formation constraint probe: "pick the play, sim picks a formation that runs it."
import { rollFormation } from '../js/engine/formations.js';
import { FORMATION_PLAYBOOK } from '../js/constants.js';

let fails = 0;
const ok = (c,msg)=>{ console.log((c?'✅':'❌')+' '+msg); if(!c) fails++; };
const eligFor = (play)=> (id)=> (FORMATION_PLAYBOOK[id]||[]).includes(play);
const roll = (forms, play)=> rollFormation(forms, play?eligFor(play):null);
const dist = (forms, play, n=4000)=>{ const c={}; for(let i=0;i<n;i++){const f=roll(forms,play); c[f]=(c[f]||0)+1;} return c; };

// carried set that INCLUDES Wildcat
const carriedWithWC = [
  {id:'Spread',weight:40},{id:'Wildcat',weight:20},{id:'Trips/Bunch',weight:20},
  {id:'Air Raid',weight:10},{id:'Empty',weight:10},
];
// carried set that does NOT include Wildcat
const carriedNoWC = [
  {id:'Spread',weight:40},{id:'Trips/Bunch',weight:30},{id:'Air Raid',weight:20},{id:'Empty',weight:10},
];

// 1) Wildcat Power + carrying Wildcat -> ALWAYS Wildcat
{
  const d = dist(carriedWithWC, 'Wildcat Power');
  const keys = Object.keys(d);
  ok(keys.length===1 && keys[0]==='Wildcat', `Wildcat Power w/ Wildcat carried → always Wildcat (got ${JSON.stringify(d)})`);
}
// 2) Wildcat Power + NOT carrying Wildcat -> graceful fallback (a carried formation, never crash/Single Back injection)
{
  const d = dist(carriedNoWC, 'Wildcat Power');
  const carriedIds = new Set(carriedNoWC.map(f=>f.id));
  const allCarried = Object.keys(d).every(k=>carriedIds.has(k));
  ok(allCarried, `Wildcat Power w/o Wildcat → falls back to carried formations only (got ${JSON.stringify(d)})`);
}
// 3) 'Iso' -> only formations that carry Iso AND are carried
{
  const isoForms = Object.keys(FORMATION_PLAYBOOK).filter(f=>FORMATION_PLAYBOOK[f].includes('Iso'));
  const carried = [{id:'Spread',weight:30},{id:'Power-I',weight:30},{id:'Wishbone',weight:20},{id:'Empty',weight:20}];
  const carriedIsoCapable = carried.map(f=>f.id).filter(id=>isoForms.includes(id));
  const d = dist(carried, 'Iso');
  const only = Object.keys(d).every(k=>carriedIsoCapable.includes(k));
  ok(carriedIsoCapable.length>0 && only, `Iso → only carried Iso-capable formations ${JSON.stringify(carriedIsoCapable)} (got ${JSON.stringify(d)})`);
}
// 4) No named play -> unconstrained, hits every carried formation over many rolls
{
  const d = dist(carriedWithWC, null);
  const hitAll = carriedWithWC.every(f=>d[f.id]>0);
  ok(hitAll, `no named play → unconstrained roll reaches every carried formation (got ${JSON.stringify(d)})`);
}
// 5) universal play (Draw) imposes no constraint
{
  const d = dist(carriedWithWC, 'Draw');
  const hitAll = carriedWithWC.every(f=>d[f.id]>0);
  ok(hitAll, `universal play (Draw) → no narrowing, reaches every carried formation (got ${JSON.stringify(d)})`);
}
// 6) weights still respected within the eligible set (Wildcat gets the lion's share when it's the only eligible)
console.log('');
console.log(fails? `AUTO-FORMATION PROBE: ${fails} FAIL` : 'AUTO-FORMATION PROBE PASS');
process.exit(fails?1:0);
