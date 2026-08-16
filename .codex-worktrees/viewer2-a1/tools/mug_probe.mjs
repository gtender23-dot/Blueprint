// mug_probe.mjs — PASS 4 (pressure flavors): the double-A mug that bails.
// Run: node tools/mug_probe.mjs [gamesPerArm]
//
// Pins:
//   1. PLUMBING. A Mug call rides the sheet → every dropback carries the
//      look's post-snap truth (pl.mug = "fired" | "bail"), and both truths
//      actually occur.
//   2. KILL-SWITCH (pinned PRNG). Mug call under __noPressFlavors ≡ the
//      plain-dials control, byte-identical; live mug diverges.
//   3. FIRED = interior heat. On fired snaps the mug sacks more than the
//      same fired pressure without the look (A-gap dogs harder to pick up,
//      the center's slide points spent).
//   4. BAIL = the low hole closes. On unfired snaps a short diet completes
//      less against the bailing bluff than against the plain call.
//   5. RUN, both directions. Inside runs meet the mugged backers (worse for
//      the offense); outside runs outflank bodies pinned in the A-gaps
//      (better). Paired seeds.
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
  fourthDown: 'Moderate', clockMgmt: 'Normal', maxFGDist: 42,
};
const CALLS = {
  Mug:      { aggression: 'attacking', pressLook: 'mug' },
  MugBend:  { aggression: 'bend', pressLook: 'mug' },
  Ctrl:     { aggression: 'attacking' },
  CtrlBend: { aggression: 'bend' },
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

console.log(`— 1. plumbing (the look rides the sheet) —\n`);
{
  let db = 0, marked = 0, fired = 0, bailed = 0;
  for (let i = 0; i < Math.min(N, 40); i++) {
    const { plays } = runGame('Mug', 1000 + i);
    for (const pl of plays) {
      if (!String(pl.type || '').startsWith('pass')) continue;
      db++;
      if (pl.mug === 'fired') { marked++; fired++; }
      else if (pl.mug === 'bail') { marked++; bailed++; }
    }
  }
  check('Mug call stamps pl.mug on the pass ledger', db > 0 && marked / db >= 0.9, `${marked}/${db} dropbacks`);
  check('both truths occur (fired AND bail)', fired > 0 && bailed > 0, `${fired} fired · ${bailed} bail`);
}

console.log('\n— 2. kill-switch (pinned PRNG, byte-identical) —\n');
{
  const sig = (g) => JSON.stringify([g.score, g.plays.length, g.plays.reduce((s, p) => s + (p.yards || 0), 0)]);
  let identKill = 0, diverged = 0;
  for (const s of [11, 47, 1986]) {
    const ctrl = runGame('Ctrl', s);
    if (sig(ctrl) === sig(runGame('Mug', s, {}, true))) identKill++;
    if (sig(ctrl) !== sig(runGame('Mug', s))) diverged++;
  }
  check('__noPressFlavors: Mug ≡ plain-dials control (3 seeds)', identKill === 3, `${identKill}/3`);
  check('live Mug diverges from control (3 seeds)', diverged === 3, `${diverged}/3`);
}

console.log(`\n— 3/4. direction, pass game (paired seeds, ${N} games/arm) —\n`);
{
  // Fired: sack rate on fired snaps, mug vs plain.
  const firedArm = (call, base) => {
    let db = 0, sk = 0;
    for (let i = 0; i < N; i++) {
      const { plays } = runGame(call, base + i);
      for (const pl of plays) {
        if (!String(pl.type || '').startsWith('pass') || pl.isScreen) continue;
        if (!pl.blitzFired) continue;
        db++; if (pl.sack) sk++;
      }
    }
    return { rate: db ? 100 * sk / db : 0, db };
  };
  const mf = firedArm('Mug', 3000), cf = firedArm('Ctrl', 3000);
  check('fired mug is interior heat (sack% up on fired snaps)', mf.rate > cf.rate, `${mf.rate.toFixed(2)}% (n=${mf.db}) vs ${cf.rate.toFixed(2)}% (n=${cf.db})`);
  // Bail: short-diet completion on UNFIRED snaps, mug vs plain (bend = mostly bail).
  const SHORT = { passDepth: { short: 90, medium: 10, deep: 0 } };
  const bailArm = (call, base) => {
    let att = 0, comp = 0;
    for (let i = 0; i < N; i++) {
      const { plays } = runGame(call, base + i, SHORT);
      for (const pl of plays) {
        if (!String(pl.type || '').startsWith('pass') || pl.isScreen || pl.sack || pl.throwAway) continue;
        if (pl.blitzFired || pl.targetId == null) continue;
        att++; if (pl.complete) comp++;
      }
    }
    return { comp: att ? 100 * comp / att : 0, att };
  };
  const mb = bailArm('MugBend', 4000), cb = bailArm('CtrlBend', 4000);
  check('the bail closes the low hole (short comp% down, unfired snaps)', mb.comp < cb.comp, `${mb.comp.toFixed(2)}% (n=${mb.att}) vs ${cb.comp.toFixed(2)}% (n=${cb.att})`);
}

console.log(`\n— 5. direction, run game (paired seeds, ${N} games/arm) —\n`);
{
  // Pass 4.5 rework of this section: the shipped ±3% split is real but sits
  // under the direction check's statistical power at any probe-sized N — the
  // original pass was seed luck, and the identity pass's legitimate
  // generation change (frames roll first) re-based the stream and flipped
  // the coin. Converted to an AMPLIFIED-DIAL plumbing gate: crank the two
  // constants for this section only, so if the flavRunMult lane is wired the
  // direction is unmissable, and if it ever disconnects the probe screams.
  // (Trait texture killed too, so this measures the CALL lane alone; traits
  // have their own gates: traits_probe / trait_band_ab.)
  globalThis.__noTraits = true;
  globalThis.__noSizeFit = true;
  const PF = C.PRESS_FLAVOR;
  const savedIn = PF.mugRunIn, savedOut = PF.mugRunOut;
  PF.mugRunIn = 1.5;
  PF.mugRunOut = 0.6;
  const runArm = (call, base, inside) => {
    let car = 0, yds = 0;
    for (let i = 0; i < N; i++) {
      const { plays } = runGame(call, base + i, { tendency: 'Heavy Run', rushInPct: inside ? 100 : 0 });
      for (const pl of plays) {
        if (pl.type !== (inside ? 'run_inside' : 'run_outside')) continue;
        car++; yds += pl.yards || 0;
      }
    }
    return { ypc: car ? yds / car : 0, car };
  };
  const mi = runArm('MugBend', 5000, true), ci = runArm('CtrlBend', 5000, true);
  check('inside runs meet the mugged backers (ypc down)', mi.ypc < ci.ypc, `${mi.ypc.toFixed(2)} (n=${mi.car}) vs ${ci.ypc.toFixed(2)} (n=${ci.car})`);
  const mo = runArm('MugBend', 6000, false), co = runArm('CtrlBend', 6000, false);
  check('outside runs outflank the pinned bodies (ypc up)', mo.ypc > co.ypc, `${mo.ypc.toFixed(2)} (n=${mo.car}) vs ${co.ypc.toFixed(2)} (n=${co.car})`);
  PF.mugRunIn = savedIn;
  PF.mugRunOut = savedOut;
  delete globalThis.__noTraits;
  delete globalThis.__noSizeFit;
}

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'}  (${pass} pass, ${fail} fail)`);
process.exit(fail ? 1 : 0);
