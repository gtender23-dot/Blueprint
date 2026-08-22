// checkdown_probe.mjs — QB PLAY Fix E (explicit checkdown rung).
//
// Claim (USA Football "Basic Knowledge About Reads"): the progression is
// #1 -> #2 -> checkdown to the back -> the QB runs. A heads-up QB keeps his outlet
// live even on deeper drops. Fix E makes the RB checkdown available on medium/deep
// dropbacks at an AWR-scaled rate (was a flat 35% on medium, never on deep).
//
// What this proves:
//   1. A high-AWR QB targets his checkdown back on medium/deep drops more than a
//      low-AWR QB (the outlet scales with awareness).
//   2. Turning the fix off (globalThis.__noCheckdown) shrinks that RB target share
//      on the deeper drops back toward the old flat behavior.
//
// Run: node tools/checkdown_probe.mjs [gamesPerCell]
import { createPlayer, refreshRatings } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

const GAMES = Number(process.argv[2] || 45);
const TIER = 1;

function roster(schoolId, awr) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], TIER);
      if (pos === 'QB' && i === 0) {
        for (const k of Object.keys(p.attributes)) p.attributes[k] = Math.min(99, p.attributes[k] + 12);
        p.attributes.AWR = awr;
        refreshRatings(p);
      }
      p.schoolId = schoolId;
      r.push(p);
    }
  }
  return r;
}

// Medium/deep-heavy so the checkdown rung is what's under test (no pure short game).
const gp = { offFormation:'Single Back', offFormations:[{id:'Single Back',weight:100}], tendency:'Balanced', rushInPct:35, passDepth:{short:0,medium:55,deep:45}, blitzPct:20, defFormation:'Balanced D', fourthDown:'Moderate', clockMgmt:'Normal', maxFGDist:42 };
const sH = { id:'H', name:'Home' }, sA = { id:'A', name:'Away' };

function measure(awr) {
  let rbTargets = 0, passPlays = 0;
  for (let i = 0; i < GAMES; i++) {
    const rH = roster('H', awr), rA = roster('A', awr);
    const cH = buildDepthChart(rH, gp), cA = buildDepthChart(rA, gp);
    const rbH = new Set([(cH.RB || [])[0]]), rbA = new Set([(cA.RB || [])[0]]);
    const res = simulateGame(sH, sA, rH, rA, cH, cA, gp, gp);
    // both teams share the same drives list; attribute by targetId membership
    for (const d of res.drives || []) for (const pl of d.plays || []) {
      const t = pl.type || '';
      if (t === 'pass_medium' || t === 'pass_deep') {
        passPlays++;
        if (pl.targetId && (rbH.has(pl.targetId) || rbA.has(pl.targetId))) rbTargets++;
      }
    }
  }
  return 100 * rbTargets / (passPlays || 1);
}

console.log(`=== CHECKDOWN (Fix E) — RB target share on medium/deep drops, ${GAMES} games/cell ===`);
globalThis.__noCheckdown = false;
const hiOn = measure(94);
const loOn = measure(62);
globalThis.__noCheckdown = true;
const hiOff = measure(94);
globalThis.__noCheckdown = false;

console.log(`  Fix E ON : high-AWR QB checkdown share ${hiOn.toFixed(2)}%  | low-AWR ${loOn.toFixed(2)}%`);
console.log(`  Fix E OFF: high-AWR QB checkdown share ${hiOff.toFixed(2)}%`);

const p1 = hiOn > loOn;          // awareness scales the outlet
const p2 = hiOn > hiOff;         // fix adds checkdown availability on deeper drops
const pass = p1 && p2;
console.log(`\n  [${p1?'PASS':'FAIL'}] high-AWR QB checks down more than low-AWR`);
console.log(`  [${p2?'PASS':'FAIL'}] fix raises checkdown share vs gated-off`);
console.log(pass ? '\nALL PASS ✅ — the back is a real rung of the progression' : '\n⚠ FAIL');
// 2026-08-21 (GATE TEETH): this file printed its verdict and exited 0, so a
// red here could never fail the gate — the same hole that let
// coverage_monotonicity_check print "INVERTED" for seven months of green runs.
process.exit(pass ? 0 : 1);
