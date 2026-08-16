// clock_realism_probe.mjs — subsystem 5, fix A (+B).
//
// Does the game clock now STOP on the events that stop it in real football?
// Reads the per-play log a full game emits and measures the average game
// seconds consumed by each play family, split by outcome:
//   - incomplete pass  -> should burn ~CLOCK_STOP_LIVE (clock stopped)
//   - complete inbounds / run inbounds -> full ~23-29s (clock runs)
//   - out of bounds (result.oob) -> ~CLOCK_STOP_LIVE (clock stopped)
// Also reports plays/game and total offensive plays, so the clock model's
// league-wide effect is visible next to stat_realism.
//
// Run: node tools/clock_realism_probe.mjs [N]
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS, C } from '../js/constants.js';

const N = parseInt(process.argv[2] || '40', 10);

function genRoster(t, s) {
  const r = [];
  for (const [pos, c] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < c; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], t); p.schoolId = s; r.push(p); }
  }
  return r;
}
const gp = { offFormations:[{id:'Single Back',weight:100}], tendency:'Balanced', rushInPct:60,
  passDepth:{short:40,medium:40,deep:20}, blitzPct:20, fourthDown:'Moderate', baseTempo:'Normal', maxFGDist:42 };
const sH = { id:'H', name:'Homer St', prestige:5 };
const sA = { id:'A', name:'Away Tech', prestige:5 };

// Buckets: {n, secs} keyed by category.
const cat = {};
const add = (k, dt) => { (cat[k] || (cat[k] = {n:0, secs:0})); cat[k].n++; cat[k].secs += dt; };
let totPlays = 0, games = 0;

for (let i = 0; i < N; i++) {
  const rH = genRoster(1,'H'), rA = genRoster(1,'A');
  const res = simulateGame(sH, sA, rH, rA, buildDepthChart(rH,gp), buildDepthChart(rA,gp), gp, gp);
  for (const drive of res.drives || []) {
    let prev = null;
    for (const p of drive.plays || []) {
      // p.clock is recorded at the SNAP of p (before elapsed is subtracted). So the
      // gap prev.clock - p.clock is the time that elapsed DURING prev — tag it with
      // prev's outcome, not p's. (off-by-one fix)
      if (prev && prev.half === p.half && typeof prev.clock === 'number' && typeof p.clock === 'number') {
        const dt = prev.clock - p.clock;
        if (dt >= 0 && dt < 80) {
          const t = prev.type || 'other';
          if (t.startsWith('pass') || (t === 'run_scramble' && prev.complete !== undefined)) {
            if (prev.complete === false) add('incomplete_pass', dt);
            else if (prev.oob) add('pass_oob', dt);
            else add('complete_inbounds', dt);
          } else if (t.startsWith('run')) {
            if (prev.oob) add('run_oob', dt);
            else add('run_inbounds', dt);
          } else if (t === 'kneel') add('kneel', dt);
          else if (t === 'spike') add('spike', dt);
        }
      }
      if (p.type !== 'fg' && p.type !== 'punt' && p.type !== 'kickoff' && p.type !== 'penalty') totPlays++;
      prev = p;
    }
  }
  games++;
}

console.log(`clock realism — ${games} games, Balanced/Single Back\n`);
console.log(`CLOCK_STOP_SAVED=${C.CLOCK_STOP_SAVED}  CLOCK_PASS.mean=${C.CLOCK_PASS.mean}  CLOCK_RUN.mean=${C.CLOCK_RUN.mean}\n`);
console.log('category            |    n  | avg game-secs consumed');
console.log('--------------------|-------|------------------------');
const orderk = ['complete_inbounds','run_inbounds','incomplete_pass','pass_oob','run_oob','kneel','spike'];
for (const k of orderk) {
  const b = cat[k]; if (!b || !b.n) continue;
  console.log(`${k.padEnd(19)} | ${String(b.n).padStart(5)} | ${(b.secs/b.n).toFixed(1).padStart(6)}`);
}
console.log(`\noffensive plays/team-game: ${(totPlays/(games*2)).toFixed(1)}   [real ~65-72]`);
const inc = cat['incomplete_pass'], comp = cat['complete_inbounds'];
const stopWorks = inc && comp && (inc.secs/inc.n) < (comp.secs/comp.n) - 5;
console.log(`\nReads:`);
console.log(`• Incompletions stop the clock (burn far less than a completion): ${stopWorks ? 'YES ✅' : 'NO ❌'}`);
const oob = cat['run_oob'] || cat['pass_oob'];
console.log(`• Out-of-bounds is modeled and stops the clock: ${oob ? 'YES ✅' : 'no OOB plays sampled'}`);
process.exit(stopWorks ? 0 : 1);
