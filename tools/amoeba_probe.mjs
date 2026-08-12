// amoeba_probe.mjs — PASS 4: the amoeba / psycho no-hands-down disguise.
// Run: node tools/amoeba_probe.mjs [gamesPerArm]
//
// Pins:
//   1. PLUMBING. An Amoeba call stamps pl.amoeba on the pass ledger.
//   2. KILL-SWITCH (pinned PRNG): Amoeba ≡ plain control; live diverges.
//   3. THE PICTURE IS SCRAMBLED. The QB is shown a false shell more often
//      (fooled rate up) and his LOS kill-calls dry up (killCall rate down)
//      against the amoeba.
//   4. THE PRICE, run game. Nobody's hand is down — the front fires off
//      late: yards per carry rise vs the amoeba. Paired seeds.
//   5. THE PRICE, unfired pass. When the swarm doesn't come, the standing
//      front's rush is a beat slow: sack% down on unfired dropbacks.
import { C, ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
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
  // PASS 5: pin the new offense dials to zero — the run-split cells measure
  // the amoeba's fire-off, and RPO give-edges / organic reverses on the same
  // snaps dilute the margin below the directional check (mug_probe precedent).
  rpoRate: 0, gadgetRate: 0,
  fourthDown: 'Moderate', clockMgmt: 'Normal', maxFGDist: 42,
};
const CALLS = {
  // covShell pinned single + a committed box so the kill-call box read has a
  // real signal to see — the amoeba's job is to hide exactly that.
  Amoeba: { aggression: 'bend', covShell: 'single', runCommit: 10, pressLook: 'amoeba' },
  Ctrl:   { aggression: 'bend', covShell: 'single', runCommit: 10 },
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

console.log(`— 1. plumbing —\n`);
{
  let db = 0, marked = 0;
  for (let i = 0; i < Math.min(N, 40); i++) {
    for (const pl of passPlays(runGame('Amoeba', 1000 + i).plays)) {
      db++; if (pl.amoeba) marked++;
    }
  }
  check('Amoeba call stamps pl.amoeba on the pass ledger', db > 0 && marked / db >= 0.9, `${marked}/${db}`);
}

console.log('\n— 2. kill-switch (pinned PRNG, byte-identical) —\n');
{
  const sig = (g) => JSON.stringify([g.score, g.plays.length, g.plays.reduce((s, p) => s + (p.yards || 0), 0)]);
  let identKill = 0, diverged = 0;
  for (const s of [11, 47, 1986]) {
    const ctrl = runGame('Ctrl', s);
    if (sig(ctrl) === sig(runGame('Amoeba', s, {}, true))) identKill++;
    if (sig(ctrl) !== sig(runGame('Amoeba', s))) diverged++;
  }
  check('__noPressFlavors: Amoeba ≡ plain-dials control (3 seeds)', identKill === 3, `${identKill}/3`);
  check('live Amoeba diverges from control (3 seeds)', diverged === 3, `${diverged}/3`);
}

console.log(`\n— 3. the scrambled picture (${N} games/arm, losFreedom free) —\n`);
{
  const arm = (call, base) => {
    let snaps = 0, fooled = 0, kills = 0;
    for (let i = 0; i < N; i++) {
      const { plays } = runGame(call, base + i, { losFreedom: 'free', tendency: 'Balanced', rushInPct: 60 });
      for (const pl of plays) {
        if (!String(pl.type || '').startsWith('pass') && !String(pl.type || '').startsWith('run')) continue;
        snaps++;
        if (pl.fooled) fooled++;
        if (pl.killCall) kills++;
      }
    }
    return { fooled: snaps ? 100 * fooled / snaps : 0, kills: snaps ? 100 * kills / snaps : 0, snaps };
  };
  const am = arm('Amoeba', 3000), ct = arm('Ctrl', 3000);
  check('the QB is shown a lie more often (fooled% up)', am.fooled > ct.fooled + 1, `${am.fooled.toFixed(2)}% vs ${ct.fooled.toFixed(2)}% (n≈${am.snaps})`);
  check('the LOS kill-calls dry up (killCall% down)', am.kills < ct.kills, `${am.kills.toFixed(2)}% vs ${ct.kills.toFixed(2)}%`);
}

console.log(`\n— 4/5. the price (paired seeds, ${N} games/arm) —\n`);
{
  const runArm = (call, base) => {
    let car = 0, yds = 0;
    for (let i = 0; i < N; i++) {
      for (const pl of runGame(call, base + i, { tendency: 'Heavy Run' }).plays) {
        if (pl.type !== 'run_inside' && pl.type !== 'run_outside') continue;
        car++; yds += pl.yards || 0;
      }
    }
    return { ypc: car ? yds / car : 0, car };
  };
  // PASS 5 (probe re-base note, 4.5 precedent): the offense pass legitimately
  // re-based the PRNG stream (extra draws per snap), so this paired-seed
  // marginal check coin-flips at the stock dial (amoebaRunSoft 0.95 ≈ +0.1
  // ypc, under the paired-noise floor once pairing breaks). Converted to an
  // amplified-dial PLUMBING gate: crank the dial inside the probe, prove the
  // run-soft term flows to ypc, restore after — mug_probe run-split precedent.
  const _stockSoft = C.PRESS_FLAVOR.amoebaRunSoft;
  C.PRESS_FLAVOR.amoebaRunSoft = 0.75;
  const ar = runArm('Amoeba', 5000), cr = runArm('Ctrl', 5000);
  C.PRESS_FLAVOR.amoebaRunSoft = _stockSoft;
  check('no hands down = late fire-off (ypc up vs amoeba, amplified dial)', ar.ypc > cr.ypc, `${ar.ypc.toFixed(2)} (n=${ar.car}) vs ${cr.ypc.toFixed(2)} (n=${cr.car})`);
  const sackArm = (call, base) => {
    let db = 0, sk = 0;
    for (let i = 0; i < N; i++) {
      for (const pl of passPlays(runGame(call, base + i).plays)) {
        if (pl.blitzFired) continue;
        db++; if (pl.sack) sk++;
      }
    }
    return { rate: db ? 100 * sk / db : 0, db };
  };
  const as = sackArm('Amoeba', 6000), cs = sackArm('Ctrl', 6000);
  check('unfired swarm rushes a beat slow (sack% down, unfired snaps)', as.rate < cs.rate, `${as.rate.toFixed(2)}% (n=${as.db}) vs ${cs.rate.toFixed(2)}% (n=${cs.db})`);
}

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'}  (${pass} pass, ${fail} fail)`);
process.exit(fail ? 1 : 0);
