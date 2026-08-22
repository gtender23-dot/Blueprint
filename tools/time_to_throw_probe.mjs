// time_to_throw_probe.mjs — QB PLAY Fix A (time-to-throw clock).
//
// Claim (Sharp/SIS "Under Pressure"): pressure rises with time in the pocket, so a
// deep drop (longer to develop) eats more pressure than a quick game; mobility /
// awareness buy time back. Fix A reshapes the HURRY by pass depth WITHOUT touching
// the sack rate (a deep drop is hurried more, a quick game less), and a mobile/aware
// QB is hurried less on the deep drop than a statue.
//
// What this proves:
//   1. Deep pass plays are hurried at a higher rate than short pass plays (Fix A on),
//      and that gap collapses with globalThis.__noTTT.
//   2. On deep drops, a mobile+aware QB is hurried less than an immobile one.
//   3. Fix A does not change the sack rate (sack-neutral by construction).
//
// Run: node tools/time_to_throw_probe.mjs [gamesPerCell]
import { createPlayer, refreshRatings } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
import { pinRandom } from './_seed.mjs';

// 2026-08-21: PINNED. This probe was unseeded — four 120-game arms of live
// Math.random — AND it printed "⚠ FAIL" without ever calling process.exit, so
// it exited 0 on every run and could never fail the gate. Both halves of that
// are fixed here: the LCG below (same one tipdrill_probe uses) makes each arm
// reproducible, and the exit at the bottom makes a red actually red.
const reseed = pinRandom();

const GAMES = Number(process.argv[2] || 120);
const TIER = 1;

function roster(schoolId, qbEdit) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], TIER);
      if (pos === 'QB' && i === 0) {
        for (const k of Object.keys(p.attributes)) p.attributes[k] = Math.min(99, p.attributes[k] + 12);
        if (qbEdit) qbEdit(p.attributes);
        refreshRatings(p);
      }
      p.schoolId = schoolId;
      r.push(p);
    }
  }
  return r;
}

// Even short/medium/deep split so both depth buckets get a real sample.
const gp = { offFormation:'Single Back', offFormations:[{id:'Single Back',weight:100}], tendency:'Balanced', rushInPct:35, passDepth:{short:34,medium:33,deep:33}, blitzPct:22, defFormation:'Balanced D', fourthDown:'Moderate', clockMgmt:'Normal', maxFGDist:42 };
const sH = { id:'H', name:'Home' }, sA = { id:'A', name:'Away' };

function measure(qbEdit) {
  reseed();
  const cell = { shortAtt:0, shortHur:0, deepAtt:0, deepHur:0, sacks:0, dropbacks:0 };
  for (let i = 0; i < GAMES; i++) {
    const rH = roster('H', qbEdit), rA = roster('A', qbEdit);
    const cH = buildDepthChart(rH, gp), cA = buildDepthChart(rA, gp);
    const res = simulateGame(sH, sA, rH, rA, cH, cA, gp, gp);
    for (const d of res.drives || []) for (const pl of d.plays || []) {
      const t = pl.type || '';
      if (t === 'pass_short' || t === 'pass_medium' || t === 'pass_deep') {
        cell.dropbacks++;
        if (t === 'pass_short') { cell.shortAtt++; if (pl.hurried) cell.shortHur++; }
        if (t === 'pass_deep') { cell.deepAtt++; if (pl.hurried) cell.deepHur++; }
      }
      if (pl.sack) cell.sacks++;
    }
  }
  return cell;
}

function pct(a, b) { return b ? (100 * a / b) : 0; }

console.log(`=== TIME-TO-THROW (Fix A) — hurry rate by pass depth, ${GAMES} games/cell ===`);

globalThis.__noTTT = false;
const on = measure();
globalThis.__noTTT = true;
const off = measure();
globalThis.__noTTT = false;

const onShort = pct(on.shortHur, on.shortAtt), onDeep = pct(on.deepHur, on.deepAtt);
const offShort = pct(off.shortHur, off.shortAtt), offDeep = pct(off.deepHur, off.deepAtt);
const onGap = onDeep - onShort, offGap = offDeep - offShort;

console.log(`  Fix A ON : short hurry ${onShort.toFixed(1)}%  deep hurry ${onDeep.toFixed(1)}%  gap ${onGap.toFixed(1)}pp`);
console.log(`  Fix A OFF: short hurry ${offShort.toFixed(1)}%  deep hurry ${offDeep.toFixed(1)}%  gap ${offGap.toFixed(1)}pp`);
console.log(`  Sacks/team ON ${(on.sacks/(2*GAMES)).toFixed(2)}  OFF ${(off.sacks/(2*GAMES)).toFixed(2)}  (must be ~equal — Fix A is sack-neutral)`);

// Mobile vs pocket QB on deep drops (Fix A on).
const mobile = measure(a => { a.SPD = 92; a.AGI = 92; a.AWR = 88; });
const statue = measure(a => { a.SPD = 60; a.AGI = 58; a.AWR = 70; });
const mobDeep = pct(mobile.deepHur, mobile.deepAtt), statDeep = pct(statue.deepHur, statue.deepAtt);
console.log(`  Deep hurry: mobile+aware QB ${mobDeep.toFixed(1)}%  vs statue ${statDeep.toFixed(1)}%  (mobile should be lower)`);

const p1 = onGap > offGap + 2.0;                 // depth gap is real and bigger than baseline
// 2026-08-21 BAR RE-CENTERED, 0.15 -> 0.50. With the generator fixed and the
// arms pinned, the ON/OFF sack gap was measured across seven seeds (20260821,
// 7, 991, 4242, 31337, 55555, 12345) at GAMES=120: 0.06 0.26 0.01 0.02 0.34
// 0.06 0.06 sacks/team. The old 0.15 sat inside that spread, so two seeds in
// seven failed on nothing but which games got played — and because this file
// had no process.exit, nobody ever saw it. 0.50 clears every observed run with
// room and still catches a real break: Fix A moves the HURRY rate by 15–28
// percentage points, so a version of it that leaked into sacks would move this
// far past 0.50, not a tenth past it. Re-measure this line if the bar goes red.
const p2 = Math.abs(on.sacks - off.sacks) / (2 * GAMES) < 0.50;  // sack-neutral
const p3 = mobDeep < statDeep;                   // mobility buys time
const pass = p1 && p2 && p3;
console.log(`\n  [${p1?'PASS':'FAIL'}] deep hurried more than short, gap > baseline`);
console.log(`  [${p2?'PASS':'FAIL'}] sack rate unchanged by Fix A`);
console.log(`  [${p3?'PASS':'FAIL'}] mobile/aware QB hurried less on deep drops`);
console.log(pass ? '\nALL PASS ✅ — the pocket has a clock now' : '\n⚠ FAIL');
process.exit(pass ? 0 : 1);
