// crossdog_probe.mjs — PASS 4: the cross-dog interior pick game.
// Run: node tools/crossdog_probe.mjs [gamesPerArm]
//
// Pins:
//   1. PLUMBING. A cross call's FIRED pressures run the game (pl.crossDog on
//      most fired dropbacks — the second dog is sent when the identity only
//      brought one), and the pick springs a crosser free (pl.crossFree > 0).
//   2. KILL-SWITCH (pinned PRNG): cross call ≡ plain control; live diverges.
//   3. PROTECTION READ. BOB's man rules are what the pick attacks; Quick gets
//      the ball out before it matters — the free-runner rate orders
//      bob > quick.
//   4. TEETH. On snaps where the pick springs (crossFree) the sack rate beats
//      fired cross snaps where the center passed it off.
//   5. THE PRICE. Both crossers in the wash = no underneath rally: on fired
//      snaps a short diet completes MORE vs the cross than vs plain heat.
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';

const N = parseInt(process.argv[2] || '120', 10);
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
const GP_OFF = {
  offFormation: 'Spread', tendency: 'Heavy Pass', rushInPct: 60,
  passDepth: { short: 34, medium: 33, deep: 33 }, blitzPct: 15,
  fourthDown: 'Moderate', clockMgmt: 'Normal', maxFGDist: 42,
};
const CALLS = {
  Cross: { aggression: 'attacking', dogGame: 'cross' },
  Ctrl:  { aggression: 'attacking' },
};
function runGame(callName, seed, offExtra = {}, kill = false) {
  Math.random = mulberry32(seed);
  globalThis.__noPressFlavors = kill;
  try {
    const rH = genRoster('H'), rA = genRoster('A');
    const gpH = { ...GP_OFF, ...offExtra };
    const gpA = { ...GP_OFF, defCalls: { [callName]: CALLS[callName] }, callSheet: sheetAll(callName) };
    const cH = buildDepthChart(rH, gpH), cA = buildDepthChart(rA, gpA);
    const res = simulateGame({ id: 'H' }, { id: 'A' }, rH, rA, cH, cA, gpH, gpA);
    const plays = [];
    for (const d of res.drives || []) {
      if (d.possession !== 'home') continue;
      for (const pl of d.plays || []) plays.push(pl);
    }
    return { plays, score: [res.homeScore, res.awayScore] };
  } finally {
    Math.random = realRandom;
    delete globalThis.__noPressFlavors;
  }
}
const passPlays = (plays) => plays.filter(pl => String(pl.type || '').startsWith('pass') && !pl.isScreen);

console.log(`— 1. plumbing (the game rides fired pressure) —\n`);
{
  let fired = 0, crossed = 0, free = 0;
  for (let i = 0; i < Math.min(N, 50); i++) {
    for (const pl of passPlays(runGame('Cross', 1000 + i).plays)) {
      if (!pl.blitzFired) continue;
      fired++;
      if (pl.crossDog) crossed++;
      if (pl.crossFree) free++;
    }
  }
  check('fired pressure runs the cross (≥70% of fired snaps)', fired > 0 && crossed / fired >= 0.7, `${crossed}/${fired}`);
  check('the pick springs a crosser free sometimes', free > 0 && free < crossed, `${free} free of ${crossed} crosses`);
}

console.log('\n— 2. kill-switch (pinned PRNG, byte-identical) —\n');
{
  const sig = (g) => JSON.stringify([g.score, g.plays.length, g.plays.reduce((s, p) => s + (p.yards || 0), 0)]);
  let identKill = 0, diverged = 0;
  for (const s of [11, 47, 1986]) {
    const ctrl = runGame('Ctrl', s);
    if (sig(ctrl) === sig(runGame('Cross', s, {}, true))) identKill++;
    if (sig(ctrl) !== sig(runGame('Cross', s))) diverged++;
  }
  check('__noPressFlavors: Cross ≡ plain-dials control (3 seeds)', identKill === 3, `${identKill}/3`);
  check('live Cross diverges from control (3 seeds)', diverged === 3, `${diverged}/3`);
}

console.log(`\n— 3. the protection read (bob > quick, ${N} games/arm) —\n`);
{
  const freeRate = (protIdentity, base) => {
    let crossed = 0, free = 0;
    for (let i = 0; i < N; i++) {
      for (const pl of passPlays(runGame('Cross', base + i, { protIdentity }).plays)) {
        if (!pl.crossDog) continue;
        crossed++; if (pl.crossFree) free++;
      }
    }
    return { rate: crossed ? 100 * free / crossed : 0, crossed };
  };
  const bob = freeRate('bob', 3000), quick = freeRate('quick', 4000);
  check('the pick breaks BOB more than Quick', bob.rate > quick.rate, `bob ${bob.rate.toFixed(1)}% (n=${bob.crossed}) vs quick ${quick.rate.toFixed(1)}% (n=${quick.crossed})`);
}

console.log(`\n— 4/5. teeth + the price (${N} games/arm) —\n`);
{
  let freeDb = 0, freeSk = 0, heldDb = 0, heldSk = 0;
  for (let i = 0; i < N; i++) {
    for (const pl of passPlays(runGame('Cross', 5000 + i).plays)) {
      if (!pl.crossDog) continue;
      if (pl.crossFree) { freeDb++; if (pl.sack) freeSk++; }
      else { heldDb++; if (pl.sack) heldSk++; }
    }
  }
  const fr = freeDb ? 100 * freeSk / freeDb : 0, hr = heldDb ? 100 * heldSk / heldDb : 0;
  check('a sprung crosser gets home (sack% free > passed-off)', fr > hr, `${fr.toFixed(2)}% (n=${freeDb}) vs ${hr.toFixed(2)}% (n=${heldDb})`);
  const SHORT = { passDepth: { short: 90, medium: 10, deep: 0 } };
  const shortArm = (call, base, wantCross) => {
    let att = 0, comp = 0;
    for (let i = 0; i < N; i++) {
      for (const pl of passPlays(runGame(call, base + i, SHORT).plays)) {
        if (!pl.blitzFired || pl.sack || pl.throwAway || pl.targetId == null) continue;
        if (wantCross && !pl.crossDog) continue;
        att++; if (pl.complete) comp++;
      }
    }
    return { comp: att ? 100 * comp / att : 0, att };
  };
  const cx = shortArm('Cross', 6000, true), ct = shortArm('Ctrl', 6000, false);
  check('the wash has no underneath rally (short comp% up vs fired cross)', cx.comp > ct.comp, `${cx.comp.toFixed(2)}% (n=${cx.att}) vs ${ct.comp.toFixed(2)}% (n=${ct.att})`);
}

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'}  (${pass} pass, ${fail} fail)`);
process.exit(fail ? 1 : 0);
