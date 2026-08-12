// zone_void_probe.mjs — does a zone defender get STRESSED by a high-low / flood?
//
// Fix C (coverage pass, Aug 2026). A zone defender owns an area, not a man. The
// old model paired every receiver to his own defender by index, so two receivers
// flooding one zone were covered as cleanly as a spread-out set — a high-low
// couldn't stress anyone and the void never opened. Now, when two or more
// zone-covered receivers share a landmark, the defender is outnumbered and each
// receiver in that void separates more; a heady (high-AWR) zone defender passes
// off / squeezes the window, so the void shrinks against good zone play (the
// pattern-match dimension).
//
// assignCoverage isn't exported, so this drives full games with the defense
// pinned to zone and A/Bs the mechanism with globalThis.__noVoid off vs on. A
// flood set (bunched, same-depth receivers) is used so voids actually form.
// Checks:
//   1. VOID OPENS — completion % RISES with the void on vs off (a flooded zone
//      gives up more).
//   2. PATTERN-MATCH — a high-AWR secondary gives up LESS void than a low-AWR
//      one (the squeeze term).
//   3. GATE — with __noVoid the on/off numbers coincide.
//
// Usage: node tools/zone_void_probe.mjs [games]
import { createPlayer, refreshRatings } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

const N = parseInt(process.argv[2] || '250', 10);
const sH = { id:'H' }, sA = { id:'A' };

const gen = id => { const r = []; for (const [p,c] of Object.entries(ROSTER_TARGETS)) for (let i=0;i<c;i++){ const q=createPlayer(p,CLASS_YEARS[i%4],1); q.schoolId=id; r.push(q);} return r; };
const pinLBDB = (r, awr) => { for (const p of r) if (['CB','S','FS','SS','LB','MLB','OLB'].includes(p.position)) { p.attributes.AWR = awr; refreshRatings(p); } };

// Trips/Bunch to flood a side, medium-heavy so several routes land in one
// landmark; defense pinned to zone so the void logic is live.
const gpO = { offFormation:'Trips/Bunch', tendency:'Pass', rushInPct:35, passDepth:{short:35,medium:45,deep:20}, blitzPct:10, defFormation:'Balanced D', fourthDown:'Moderate', clockMgmt:'Normal', maxFGDist:42 };
const dP  = { ...gpO, covShellEff:'balanced', covStyleEff:'zone' };

function comp(awr) {
  let att = 0, c = 0;
  for (let i = 0; i < N; i++) {
    const rH = gen('H'), rA = gen('A'); pinLBDB(rA, awr);
    const cH = buildDepthChart(rH, gpO), cA = buildDepthChart(rA, dP);
    const st = simulateGame(sH, sA, rH, rA, cH, cA, gpO, dP).homeStats;
    att += st.passAtt; c += st.compAtt;
  }
  return 100 * c / (att || 1);
}

let fails = 0;
const chk = (cond, msg) => { if (!cond) fails++; console.log(`  ${cond ? 'ok ' : 'BAD'} ${msg}`); };

console.log(`Zone void — ${N} games/arm, Trips/Bunch vs pinned zone\n`);

// 1. void opens (average-AWR zone)
globalThis.__noVoid = true;  const off = comp(60);
globalThis.__noVoid = false; const on  = comp(60);
console.log(`avg zone (AWR60):  void OFF comp ${off.toFixed(1)}%   void ON comp ${on.toFixed(1)}%   Δ ${(on-off>=0?'+':'')}${(on-off).toFixed(2)}`);
chk(on > off + 0.3, `the void opens — a flooded zone gives up more completion`);

// 2. pattern-match: sharp zone gives up less void than sloppy zone
globalThis.__noVoid = false;
const onSharp = comp(90);
const offSharp = (globalThis.__noVoid = true, comp(90));
globalThis.__noVoid = false;
const voidDumb  = on - off;
const voidSharp = onSharp - offSharp;
console.log(`\nvoid conceded:  sloppy zone (AWR60) +${voidDumb.toFixed(2)}pp   sharp zone (AWR90) +${voidSharp.toFixed(2)}pp`);
chk(voidSharp < voidDumb, `a heady (high-AWR) zone squeezes the void — pattern-match denies more`);

// 3. gate
globalThis.__noVoid = true; const g1 = comp(60); const g2 = comp(60); globalThis.__noVoid = false;
chk(Math.abs(g1 - g2) < 1.2, `__noVoid gate stable (Δ ${(g1-g2).toFixed(2)})`);

console.log(fails
  ? `\nFAIL — ${fails} check(s).`
  : '\nPASS — a high-low floods the zone and opens the void, and a disciplined zone squeezes it shut.');
process.exit(fails ? 1 : 0);
