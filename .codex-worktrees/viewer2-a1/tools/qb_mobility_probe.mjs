// qb_mobility_probe.mjs — verifies the QB rushing system:
//   1. QB-Scrambler (derived archetype) is genuinely mobile; QB-Pocket is not.
//      (Rewritten post-archetype-overhaul: .archetype is no longer stored on
//       players — derive live via derivedArchetype(). Old names QB-Pro/QB-Rush
//       matched nothing, so every prior run of this probe compared noise to noise.)
//   2. Mobility scales DIVISION-RELATIVE (a D3 dual-threat runs vs D3 defenses).
//   3. In a run scheme, a mobile QB out-rushes a pocket QB by a clear margin.
// Run from repo root: node qb_mobility_probe.mjs
import { createPlayer, refreshRatings, derivedArchetype } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

function genRoster(tier, schoolId, qbArch){
  const r=[];
  for(const [pos,count] of Object.entries(ROSTER_TARGETS)){
    for(let i=0;i<count;i++){
      let p=createPlayer(pos, CLASS_YEARS[i%4], tier);
      if(pos==='QB' && i===0){
        // HARD guarantee: the old 40-try cap silently gave up, leaving Pro QBs
        // in Rush cells (and vice versa) — the probe flipped PASS/FAIL run to
        // run purely on that pollution. 2000 tries always lands the archetype.
        // Roll until: derived archetype matches AND survives the starter lift.
        // (Depth charts sort by rating; an unlifted forced QB rode the bench
        // while a random QB1 took the snaps — the final noise layer in the old
        // probe. The lift is flat to preserve attribute shape, but the 99-cap
        // compresses high attrs unevenly, so verify the archetype held and
        // reroll if it flipped.)
        let ok=false;
        for(let t=0;t<4000 && !ok;t++){
          if(derivedArchetype(p)===qbArch){
            const lifted=JSON.parse(JSON.stringify(p));
            for(const k of Object.keys(lifted.attributes)) lifted.attributes[k]=Math.min(99,lifted.attributes[k]+20);
            if(derivedArchetype(lifted)===qbArch){ p=lifted; ok=true; break; }
          }
          p=createPlayer('QB',CLASS_YEARS[0],tier);
        }
        if(!ok) throw new Error(`could not roll a lift-stable ${qbArch} at tier ${tier} in 4000 tries`);
        refreshRatings(p);
      }
      p.schoolId=schoolId; r.push(p);
    }
  }
  return r;
}
const sH={id:'H',name:'Home'}, sA={id:'A',name:'Away'};
// qbRunPct:0 — designed keepers are archetype-independent and were swamping the
// scramble signal (the old 40 drowned it). offFormations must be ARRAY form —
// the old object form failed rollFormation's .length check and silently fell
// back to Single Back, so the 'Pistol/RPO scheme' in the banner never applied.
const gpRun={offFormation:'Pistol/RPO',offFormations:[{id:'Pistol/RPO',weight:100}],tendency:'Balanced',rushInPct:55,passDepth:{short:45,medium:35,deep:20},blitzPct:20,defFormation:'Balanced D',fourthDown:'Moderate',clockMgmt:'Normal',maxFGDist:42,qbRunPct:0};
const gpD={offFormation:'Pro-Set',tendency:'Balanced',rushInPct:60,passDepth:{short:40,medium:40,deep:20},blitzPct:20,defFormation:'Balanced D',fourthDown:'Moderate',clockMgmt:'Normal',maxFGDist:42};

console.log('=== QB MOBILITY (scramble isolation: Pistol/RPO, qbRunPct=0, run_scramble plays only) ===');
let allPass=true;
for(const tier of [3,2,1]){
  const label=tier===3?'D1':tier===2?'D2':'D3';
  const res={};
  for(const arch of ['QB-Pocket','QB-Scrambler']){
    let ry=0,ra=0,n=100;
    for(let i=0;i<n;i++){
      const rH=genRoster(tier,'H',arch), rA=genRoster(tier,'A','QB-Pocket');
      const dH=buildDepthChart(rH,gpRun);
      const qb1={id:(dH.QB||[])[0]};   // the STARTER — see genRoster note
      const r=simulateGame(sH,sA,rH,rA,dH,buildDepthChart(rA,gpD),gpRun,gpD);
      // Count SCRAMBLES only — rushYds/rushAtt also bank designed keepers and
      // sack carries (NCAA: sack = QB carry, negative yards), which buried the
      // archetype signal under archetype-independent noise.
      for(const d of r.drives||[]) for(const pl of d.plays||[]){
        if(pl.type==='run_scramble' && pl.rusherId===qb1.id){ra++;ry+=pl.yards||0;}
      }
    }
    res[arch]={yds:ry/n,att:ra/n};
  }
  // Guard: rush QB should clearly out-rush pocket QB. Threshold scales down at
  // lower divisions where the whole game is lower-explosion (D3 separation is
  // real but proportionally smaller — that's the division-relative design).
  const minYdGap = tier === 3 ? 5 : tier === 2 ? 4 : 3; // scramble-only yards, starter-guaranteed
  const pass = res['QB-Scrambler'].yds > res['QB-Pocket'].yds + minYdGap && res['QB-Scrambler'].att > res['QB-Pocket'].att + 0.6;
  if(!pass) allPass=false;
  console.log(`  ${label}: Pocket ${res['QB-Pocket'].yds.toFixed(1)}yd/${res['QB-Pocket'].att.toFixed(1)}att | Scrambler ${res['QB-Scrambler'].yds.toFixed(1)}yd/${res['QB-Scrambler'].att.toFixed(1)}att  ${pass?'PASS ✅':'FAIL ⚠'}`);
}
console.log(allPass ? '\nALL PASS ✅ — mobile QBs are a real, division-relative archetype' : '\n⚠ FAIL — QB mobility not separating from pocket passers');
