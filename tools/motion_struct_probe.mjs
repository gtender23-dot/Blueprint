// motion_struct_probe.mjs — the motion STRUCTURAL read (Fix F), honestly scoped.
//
// Fix F (coverage pass, Aug 2026). A correct motion read tells the QB the
// STRUCTURE, so Fix F steers him toward the specific man the motion uncovered
// (reveal=man → the best isolated one-on-one; reveal=zone → a voided receiver /
// the softest zone) instead of his default read.
//
// HONEST SCOPE: the sim ALREADY banks most of the "correct read pays off" value
// through the pre-existing motionReadEdge scalar, so Fix F's effect on aggregate
// completion is inside sampling noise — a comp% delta is NOT a fair gate for it
// (see the pass-rush pass, which removed a similarly-redundant mechanism). What
// IS provable, and what this probe gates, is:
//   1. IT FIRES — with motion forced, the structural read triggers on the large
//      majority of motion snaps (the branch is live, not dead code).
//   2. IT IS MEAN-NEUTRAL — turning it on does not move league completion % (it
//      redistributes WHICH man is thrown to, it doesn't inflate the rate). This
//      is the stat_realism-aligned guarantee, checked here directly.
//   3. GATE — __noMotionRead cleanly disables it.
// Firing is measured by a temporary counter the harness installs on globalThis.
//
// Usage: node tools/motion_struct_probe.mjs [games]
import { createPlayer, refreshRatings } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

const N = parseInt(process.argv[2] || '300', 10);
const sH = { id:'H' }, sA = { id:'A' };
const gen = (id, qbAwr) => {
  const r = [];
  for (const [p,c] of Object.entries(ROSTER_TARGETS)) for (let i=0;i<c;i++){ const q=createPlayer(p,CLASS_YEARS[i%4],1); q.schoolId=id; r.push(q);}
  if (qbAwr != null) { const qb = r.find(p => p.position === 'QB'); if (qb) { qb.attributes.AWR = qbAwr; refreshRatings(qb); } }
  return r;
};
const gpO = { offFormation:'Trips/Bunch', tendency:'Balanced', rushInPct:40, passDepth:{short:40,medium:40,deep:20}, blitzPct:15, defFormation:'Balanced D', fourthDown:'Moderate', clockMgmt:'Normal', maxFGDist:42, motionRate:100, _forceMotion:true };

// Measures completion % AND — via the per-play result field the Fix F block
// attaches (result._motionStructRead = "iso"/"void") — how often the structural
// read actually fires on a motion snap. No harness-installed global needed; the
// signal rides on the play itself.
function measure(qbAwr) {
  let att = 0, c = 0, motion = 0, fires = 0;
  for (let i = 0; i < N; i++) {
    const rH = gen('H', qbAwr), rA = gen('A');
    const cH = buildDepthChart(rH, gpO), cA = buildDepthChart(rA, gpO);
    const res = simulateGame(sH, sA, rH, rA, cH, cA, gpO, gpO);
    att += res.homeStats.passAtt; c += res.homeStats.compAtt;
    for (const d of res.drives || []) for (const pl of d.plays || []) {
      if (!(pl.type || '').startsWith('pass')) continue;
      if (pl.motion) motion++;
      if (pl._motionStructRead) fires++;
    }
  }
  return { comp: 100 * c / (att || 1), motion, fires };
}

let fails = 0;
const chk = (cond, msg) => { if (!cond) fails++; console.log(`  ${cond ? 'ok ' : 'BAD'} ${msg}`); };

console.log(`Motion structural read (Fix F) — ${N} games/arm, motion forced\n`);

// 1. IT FIRES — the structural read triggers on the large majority of motion
//    snaps when on, and NEVER when gated off (the branch is live and gated).
globalThis.__noMotionRead = false; const on  = measure(92);
globalThis.__noMotionRead = true;  const off = measure(92);
const fireRate = 100 * on.fires / (on.motion || 1);
console.log(`fires:  read ON ${on.fires}/${on.motion} motion snaps (${fireRate.toFixed(1)}%)   read OFF ${off.fires}/${off.motion}`);
chk(on.fires > 0 && fireRate >= 70, `structural read FIRES on the majority of motion snaps (${fireRate.toFixed(1)}%)`);
chk(off.fires === 0, `gated off, the structural read never fires (${off.fires})`);

// 2. mean-neutral on completion
console.log(`comp%:  read OFF ${off.comp.toFixed(1)}   read ON ${on.comp.toFixed(1)}   Δ ${(on.comp-off.comp>=0?'+':'')}${(on.comp-off.comp).toFixed(2)}`);
chk(Math.abs(on.comp - off.comp) <= 0.9, `mean-neutral — the structural read does not move league completion % (Δ ${(on.comp-off.comp).toFixed(2)})`);

// 3. gate stability
globalThis.__noMotionRead = true; const g1 = measure(92).comp; const g2 = measure(92).comp; globalThis.__noMotionRead = false;
chk(Math.abs(g1 - g2) < 1.2, `__noMotionRead gate stable (Δ ${(g1-g2).toFixed(2)})`);

console.log(fails
  ? `\nFAIL — ${fails} check(s).`
  : '\nPASS — the structural read fires on the majority of motion snaps, is mean-neutral, and cleanly gated.');
process.exit(fails ? 1 : 0);
