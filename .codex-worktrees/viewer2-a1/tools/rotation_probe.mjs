// rotation_probe.mjs — PASS 3 Sky/Cloud/Buzz rotation gate.
// Run: node tools/rotation_probe.mjs [gamesPerArm]
//
// The rotations are Cover 3's run-support force rules, expressed on the pass
// side as small separation redistributions. All assertions are read off the
// play TRACE (the sim's recorded separation on the chosen throw) — noise-free
// relative to completion sampling. Pins:
//   sky   — the safety drops onto the strong flat: non-boundary short sep down.
//   cloud — the corner is the force: boundary (WR1) short sep down.
//   buzz  — the safety buzzes the hook: medium in-breaker sep down.
//   scope — a rotation on a TWO-HIGH call is inert (owner call: single-high
//           zone only), and __noCovFamilies kills it dead.
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';

const N = parseInt(process.argv[2] || '80', 10);
let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
};
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ t >>> 15, 1 | t);
    r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r;
    return ((r ^ r >>> 14) >>> 0) / 4294967296;
  };
}
const realRandom = Math.random;
function genRoster(schoolId) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], 1);
      p.schoolId = schoolId; r.push(p);
    }
  }
  return r;
}
const ALL_ROWS = ['base', 'first_ten', 'second_long', 'third_short', 'third_medium', 'third_long', 'red_zone', 'goal_line', 'backed_up', 'two_min_trail', 'four_min_lead'];
const sheetAll = (name) => Object.fromEntries(ALL_ROWS.map(k => [k, { any: [[name, 100]] }]));
const CALLS = {
  Sky:   { covShell: 'single', covStyle: 'zone', rotation: 'sky' },
  Cloud: { covShell: 'single', covStyle: 'zone', rotation: 'cloud' },
  Buzz:  { covShell: 'single', covStyle: 'zone', rotation: 'buzz' },
  Ctrl:  { covShell: 'single', covStyle: 'zone' },
  CloudTwo: { covShell: 'two', covStyle: 'zone', rotation: 'cloud' },
  CtrlTwo:  { covShell: 'two', covStyle: 'zone' },
};
function arm(callName, depth, seedBase, kill = false) {
  const GP = {
    offFormation: 'Spread', tendency: 'Heavy Pass', rushInPct: 60,
    passDepth: depth, blitzPct: 15, fourthDown: 'Moderate', clockMgmt: 'Normal', maxFGDist: 42,
  };
  const acc = { wr1Sep: [0, 0], otherSep: [0, 0], inSep: [0, 0] };
  for (let i = 0; i < N; i++) {
    Math.random = mulberry32(seedBase + i);
    globalThis.__noCovFamilies = kill;
    try {
      const rH = genRoster('H'), rA = genRoster('A');
      const gpA = { ...GP, defCalls: { [callName]: CALLS[callName] }, callSheet: sheetAll(callName) };
      const cH = buildDepthChart(rH, GP), cA = buildDepthChart(rA, gpA);
      const res = simulateGame({ id: 'H' }, { id: 'A' }, rH, rA, cH, cA, GP, gpA);
      const wr1 = (cH.WR || [])[0] || null;
      for (const d of res.drives || []) {
        if (d.possession !== 'home') continue;
        for (const pl of d.plays || []) {
          if (!pl.trace || !String(pl.type || '').startsWith('pass') || pl.isScreen) continue;
          const t = pl.trace;
          if (t.dep === 'short' && wr1) {
            const b = pl.targetId === wr1 ? acc.wr1Sep : acc.otherSep;
            b[0] += t.sep; b[1]++;
          }
          if (t.dep === 'medium' && t.shape === 'sharp') {
            acc.inSep[0] += t.sep; acc.inSep[1]++;
          }
        }
      }
    } finally {
      Math.random = realRandom;
      delete globalThis.__noCovFamilies;
    }
  }
  return {
    wr1: acc.wr1Sep[1] ? acc.wr1Sep[0] / acc.wr1Sep[1] : null,
    other: acc.otherSep[1] ? acc.otherSep[0] / acc.otherSep[1] : null,
    inb: acc.inSep[1] ? acc.inSep[0] / acc.inSep[1] : null,
    n: { wr1: acc.wr1Sep[1], other: acc.otherSep[1], inb: acc.inSep[1] },
  };
}
const SHORT = { short: 90, medium: 10, deep: 0 };
const MED = { short: 0, medium: 100, deep: 0 };

console.log(`Sky/Cloud/Buzz rotations — ${N} games/arm, trace-level reads\n`);
const ctrlS = arm('Ctrl', SHORT, 100);
const sky = arm('Sky', SHORT, 100);
check('sky: safety force hardens the strong flat (non-WR1 short)',
  sky.other != null && ctrlS.other != null && sky.other < ctrlS.other - 0.008,
  `sep ${sky.other?.toFixed(3)} vs ctrl ${ctrlS.other?.toFixed(3)} (n=${sky.n.other}/${ctrlS.n.other})`);
const cloud = arm('Cloud', SHORT, 100);
// Selection bias makes conditional-on-chosen sep a bad read here: the shave
// pushes WR1 down the progression, so the throws still taken are the
// unusually-open ones. The honest signal is AVOIDANCE — the QB stops
// throwing the boundary flat the corner is squatting in.
const shareOf = (a) => a.n.wr1 / Math.max(1, a.n.wr1 + a.n.other);
check('cloud: corner force takes the boundary flat away (WR1 short share)',
  shareOf(cloud) < shareOf(ctrlS) * 0.8,
  `WR1 short-target share ${(100 * shareOf(cloud)).toFixed(1)}% vs ctrl ${(100 * shareOf(ctrlS)).toFixed(1)}%`);
const ctrlM = arm('Ctrl', MED, 200);
const buzz = arm('Buzz', MED, 200);
check('buzz: the hook defender sits under the in-breaker (medium sharp)',
  buzz.inb != null && ctrlM.inb != null && buzz.inb < ctrlM.inb - 0.012,
  `sep ${buzz.inb?.toFixed(3)} vs ctrl ${ctrlM.inb?.toFixed(3)} (n=${buzz.n.inb}/${ctrlM.n.inb})`);
const cloudTwo = arm('CloudTwo', SHORT, 300);
const ctrlTwo = arm('CtrlTwo', SHORT, 300);
check('scope: a rotation on a two-high call is inert',
  cloudTwo.wr1 != null && ctrlTwo.wr1 != null && Math.abs(cloudTwo.wr1 - ctrlTwo.wr1) < 0.012,
  `sep ${cloudTwo.wr1?.toFixed(3)} vs two-high ctrl ${ctrlTwo.wr1?.toFixed(3)}`);
const cloudKill = arm('Cloud', SHORT, 100, true);
check('kill-switch: __noCovFamilies zeroes the rotation',
  cloudKill.wr1 != null && ctrlS.wr1 != null && Math.abs(cloudKill.wr1 - ctrlS.wr1) < 0.006,
  `sep ${cloudKill.wr1?.toFixed(3)} vs ctrl ${ctrlS.wr1?.toFixed(3)}`);

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'}  (${pass} pass, ${fail} fail)`);
process.exit(fail ? 1 : 0);
