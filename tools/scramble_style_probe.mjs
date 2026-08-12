// scramble_style_probe.mjs — QB PLAY Fix D (scramble-to-throw + style).
//
// Claim (PFF "Components of QB Play: Scrambling"): a "true scramble" is often a
// scramble-to-THROW, not just a run; scramble outcomes have a much wider distribution
// than structured plays, and QBs split into conservative vs aggressive scramble styles.
// Fix D lets a scramble sometimes become a downfield throw, scaled by the QB's
// awareness and the plan's QB aggression.
//
// What this proves:
//   1. Scrambles sometimes become throws (isScrambleThrow > 0) with Fix D on, and
//      never with globalThis.__noScrThrow.
//   2. An aggressive plan produces more scramble-throws than a conservative one.
//   3. Those throws carry real downfield yards (the wide-distribution tail).
//
// Run: node tools/scramble_style_probe.mjs [gamesPerCell]
import { createPlayer, refreshRatings } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

const GAMES = Number(process.argv[2] || 70);
const TIER = 1;

// Mobile QB + heavy blitz = lots of sack/scramble situations to sample from.
function roster(schoolId) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], TIER);
      if (pos === 'QB' && i === 0) {
        for (const k of Object.keys(p.attributes)) p.attributes[k] = Math.min(99, p.attributes[k] + 12);
        p.attributes.SPD = 95; p.attributes.AGI = 95; p.attributes.AWR = 88;
        refreshRatings(p);
      }
      p.schoolId = schoolId;
      r.push(p);
    }
  }
  return r;
}

const sH = { id:'H', name:'Home' }, sA = { id:'A', name:'Away' };
function plan(aggr) {
  return { offFormation:'Single Back', offFormations:[{id:'Single Back',weight:100}], tendency:'Balanced', rushInPct:35, passDepth:{short:30,medium:40,deep:30}, blitzPct:40, defFormation:'Balanced D', fourthDown:'Moderate', clockMgmt:'Normal', maxFGDist:42, qbAggr:aggr };
}

function measure(aggr) {
  let throws = 0, throwYds = 0, throwComp = 0, throwInt = 0, big = 0;
  const gp = plan(aggr);
  for (let i = 0; i < GAMES; i++) {
    const rH = roster('H'), rA = roster('A');
    const cH = buildDepthChart(rH, gp), cA = buildDepthChart(rA, gp);
    const res = simulateGame(sH, sA, rH, rA, cH, cA, gp, gp);
    for (const d of res.drives || []) for (const pl of d.plays || []) {
      if (pl.isScrambleThrow) {
        throws++;
        if (pl.complete) { throwComp++; throwYds += pl.yards || 0; if ((pl.yards || 0) >= 25) big++; }
        if (pl.turnover && pl.turnoverType === 'interception') throwInt++;
      }
    }
  }
  return { throws, throwComp, throwYds, throwInt, big };
}

console.log(`=== SCRAMBLE-TO-THROW (Fix D) — ${GAMES} games/cell, mobile QB, heavy blitz ===`);
globalThis.__noScrThrow = false;
const aggro = measure(85);
const cons = measure(20);
globalThis.__noScrThrow = true;
const off = measure(85);
globalThis.__noScrThrow = false;

const ay = aggro.throwComp ? aggro.throwYds / aggro.throwComp : 0;
console.log(`  aggressive plan: ${aggro.throws} scramble-throws, ${aggro.throwComp} comp, ${ay.toFixed(1)} yds/comp, ${aggro.big} 25+ , ${aggro.throwInt} INT`);
console.log(`  conservative  : ${cons.throws} scramble-throws, ${cons.throwComp} comp`);
console.log(`  Fix D OFF     : ${off.throws} scramble-throws (must be 0)`);

const p1 = aggro.throws > 0 && off.throws === 0;
const p2 = aggro.throws > cons.throws;
const p3 = ay > 8;   // real downfield yards on completed scramble-throws
const pass = p1 && p2 && p3;
console.log(`\n  [${p1?'PASS':'FAIL'}] scrambles become throws (on), never when gated off`);
console.log(`  [${p2?'PASS':'FAIL'}] aggressive plan throws more than conservative`);
console.log(`  [${p3?'PASS':'FAIL'}] completed scramble-throws carry downfield yards`);
console.log(pass ? '\nALL PASS ✅ — the scramble can become a throw now' : '\n⚠ FAIL');
