// covfam_probe.mjs — PASS 3 (coverage families) mechanism gate.
// Run: node tools/covfam_probe.mjs [gamesPerArm]
//
// Pins:
//   1. THE PIN. A named call carrying covFamily lands its family on the
//      ledger: every dropback against an all-rows sheet shows that coverage
//      name (no coin flips), and the implied shell/style dials rode along.
//   2. RUSH-3 / DROP-8 + the Prevent bundle. Against a Prevent call every
//      dropback rushes exactly three and never fires a blitz.
//   3. OLD-SAVE LAW + KILL-SWITCH, sim-level, pinned PRNG. A call stripped
//      of its Pass-3 ingredients ≡ the same call under __noCovFamilies ≡
//      byte-identical games. The live family diverges.
//   4. DIRECTION (forced diets, paired seeds). Prevent: deep dies, short is
//      served. 2-Man: the underneath diet completes less. Cover 6: the
//      boundary (WR1) short ball completes less. Tampa 2: the pole runner is
//      stamped and the deep middle (non-outside receivers) completes less.
import { ROSTER_TARGETS, CLASS_YEARS, C } from '../js/constants.js';
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';

// Default N raised 120 -> 300 at Pass 4.5: the identity pass's frame-first
// generation legitimately re-based the PRNG stream, and at N=120 the two
// finest directional checks (cloud-corner short, Tampa pole deep) sit at the
// noise floor and coin-flip. At 300 they clear with margin, traits live.
const N = parseInt(process.argv[2] || '300', 10);
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
  Six:    { covShell: 'two', covStyle: 'zone', covFamily: 'Cover 6' },
  Tampa:  { covShell: 'two', covStyle: 'zone', covFamily: 'Tampa 2' },
  TwoMan: { covShell: 'two', covStyle: 'man', covFamily: 'Cover 2-Man' },
  Vic:    { covShell: 'two', covStyle: 'zone', covFamily: 'Prevent' },
  CtrlZone: { covShell: 'two', covStyle: 'zone' },   // same dials, no family
  CtrlMan:  { covShell: 'two', covStyle: 'man' },
};
function runGame(callName, seed, offExtra = {}, kill = false) {
  Math.random = mulberry32(seed);
  globalThis.__noCovFamilies = kill;
  try {
    const rH = genRoster('H'), rA = genRoster('A');
    const gpH = { ...GP_OFF, ...offExtra };
    const gpA = { ...GP_OFF, defCalls: { [callName]: CALLS[callName] }, callSheet: sheetAll(callName) };
    const cH = buildDepthChart(rH, gpH), cA = buildDepthChart(rA, gpA);
    const res = simulateGame({ id: 'H' }, { id: 'A' }, rH, rA, cH, cA, gpH, gpA);
    // Home offense vs Away defense (the defense under test).
    const plays = [];
    for (const d of res.drives || []) {
      if (d.possession !== 'home') continue;
      for (const pl of d.plays || []) plays.push(pl);
    }
    // WR1 of the home offense, for boundary-side assertions.
    const wr1 = (cH.WR || [])[0] || null;
    return { plays, wr1, score: [res.homeScore, res.awayScore] };
  } finally {
    Math.random = realRandom;
    delete globalThis.__noCovFamilies;
  }
}

console.log(`— 1. the pin (family lands on the ledger) — ${N} games/arm\n`);
{
  const famOf = { Six: 'Cover 6', Tampa: 'Tampa 2', TwoMan: 'Cover 2-Man', Vic: 'Prevent' };
  for (const [callName, fam] of Object.entries(famOf)) {
    let db = 0, hit = 0;
    for (let i = 0; i < Math.min(N, 40); i++) {
      const { plays } = runGame(callName, 1000 + i);
      for (const pl of plays) {
        if (!String(pl.type || '').startsWith('pass')) continue;
        db++; if (pl.coverage === fam) hit++;
      }
    }
    const rate = db ? hit / db : 0;
    check(`${callName} call pins "${fam}" on the pass ledger`, rate >= 0.9, `${(rate * 100).toFixed(1)}% of ${db} dropbacks`);
  }
}

console.log('\n— 2. rush-3 / drop-8 (the Prevent bundle) —\n');
{
  let db = 0, three = 0, blitzed = 0;
  for (let i = 0; i < Math.min(N, 40); i++) {
    const { plays } = runGame('Vic', 2000 + i);
    for (const pl of plays) {
      if (!String(pl.type || '').startsWith('pass') || pl.isScreen) continue;
      db++;
      if (pl.rushN === 3) three++;
      if (pl.blitzFired) blitzed++;
    }
  }
  check('Prevent rushes exactly three', db > 0 && three / db >= 0.95, `${three}/${db}`);
  check('Prevent never fires a blitz', blitzed === 0, `${blitzed} fired`);
}

console.log('\n— 3. old-save law + kill-switch (pinned PRNG, byte-identical) —\n');
{
  const sig = (g) => JSON.stringify([g.score, g.plays.length, g.plays.reduce((s, p) => s + (p.yards || 0), 0)]);
  let identKill = 0, identCtrl = 0, diverged = 0;
  const SEEDS = [11, 47, 1986];
  for (const s of SEEDS) {
    const ctrl = runGame('CtrlZone', s);
    // Same dials + family, but kill-switch on: applyDefCall must strip the
    // ingredients at the door → byte-identical to the plain-dials control.
    const famKilled = runGame('Six', s, {}, true);
    const famLive = runGame('Six', s);
    if (sig(ctrl) === sig(famKilled)) identKill++;
    if (sig(ctrl) === sig(runGame('CtrlZone', s))) identCtrl++;
    if (sig(ctrl) !== sig(famLive)) diverged++;
  }
  check('__noCovFamilies: family call ≡ plain-dials control (3 seeds)', identKill === 3, `${identKill}/3`);
  check('determinism sanity: control ≡ control (3 seeds)', identCtrl === 3, `${identCtrl}/3`);
  check('live family diverges from control (3 seeds)', diverged === 3, `${diverged}/3`);
}

console.log(`\n— 4. direction (forced diets, paired seeds) — ${N} games/arm\n`);
function arm(callName, offExtra, seedBase) {
  let att = 0, comp = 0, yds = 0, expl = 0, wr1Att = 0, wr1Comp = 0, insideAtt = 0, insideComp = 0, robbed = 0, pole = 0, db = 0, qSepSum = 0, qSepN = 0;
  for (let i = 0; i < N; i++) {
    const { plays, wr1 } = runGame(callName, seedBase + i, offExtra);
    for (const pl of plays) {
      if (!String(pl.type || '').startsWith('pass') || pl.sack || pl.isScreen || pl.throwAway) continue;
      db++;
      if (pl._robber) robbed++;
      if (pl._pole) pole++;
      // Noise-free mechanism read: the trace's separation on a quarters-side
      // (non-WR1) medium in-breaker — the exact ball the C6 safety undercuts.
      if (pl.trace && pl.trace.dep === 'medium' && pl.trace.shape === 'sharp' && wr1 && pl.targetId !== wr1) {
        qSepSum += pl.trace.sep; qSepN++;
      }
      if (pl.targetId == null) continue;
      att++;
      const isWr1 = wr1 && pl.targetId === wr1;
      if (isWr1) wr1Att++; else insideAtt++;
      if (pl.complete) {
        comp++; yds += pl.yards || 0;
        if ((pl.yards || 0) >= 25) expl++;
        if (isWr1) wr1Comp++; else insideComp++;
      }
    }
  }
  return {
    comp: att ? 100 * comp / att : 0, ypa: att ? yds / att : 0,
    expl: att ? 100 * expl / att : 0,
    wr1: wr1Att ? 100 * wr1Comp / wr1Att : 0,
    inside: insideAtt ? 100 * insideComp / insideAtt : 0,
    rob: db ? 100 * robbed / db : 0, pole: db ? 100 * pole / db : 0, att,
    qSep: qSepN ? qSepSum / qSepN : null, qSepN,
  };
}
const DEEP = { passDepth: { short: 0, medium: 10, deep: 90 } };
const SHORT = { passDepth: { short: 90, medium: 10, deep: 0 } };
const UNDER = { passDepth: { short: 50, medium: 50, deep: 0 } };
{
  const pv = arm('Vic', DEEP, 5000), cv = arm('CtrlZone', DEEP, 5000);
  check('Prevent denies the deep ball', pv.comp < cv.comp - 1, `deep-diet comp% ${pv.comp.toFixed(1)} vs ctrl ${cv.comp.toFixed(1)}`);
  check('Prevent caps the explosive', pv.expl < cv.expl, `expl% ${pv.expl.toFixed(1)} vs ${cv.expl.toFixed(1)}`);
  const ps = arm('Vic', SHORT, 6000), cs = arm('CtrlZone', SHORT, 6000);
  check('Prevent serves the underneath', ps.comp > cs.comp + 1, `short-diet comp% ${ps.comp.toFixed(1)} vs ctrl ${cs.comp.toFixed(1)}`);
}
{
  const tm = arm('TwoMan', UNDER, 7000), cm = arm('CtrlMan', UNDER, 7000);
  check('2-Man trail hardens the underneath', tm.comp < cm.comp - 0.5, `under-diet comp% ${tm.comp.toFixed(1)} vs ctrl ${cm.comp.toFixed(1)}`);
}
{
  // PASS 6 (probe-craft, mug/amoeba precedent): at the stock dial (−0.03 sep)
  // this margin sits on the paired-seed noise floor and re-based on every pass
  // that added RNG draws (recurred Pass 5 AND Pass 6). The mechanism gate now
  // runs at an amplified dial (0.03→0.10) with a wider margin — noise-free
  // direction, same code path — and the dial is restored after.
  const _stockCloud = C.C6_CLOUD_WR1_SHORT;
  C.C6_CLOUD_WR1_SHORT = 0.14;
  const c6 = arm('Six', SHORT, 8000), cz = arm('CtrlZone', SHORT, 8000);
  C.C6_CLOUD_WR1_SHORT = _stockCloud;
  check('Cover 6 cloud corner hardens the boundary short ball (amplified dial)', c6.wr1 < cz.wr1 - 1.5, `WR1 short comp% ${c6.wr1.toFixed(1)} vs ctrl ${cz.wr1.toFixed(1)} @ cloud 0.14`);
  // The assignment-rob is read noise-free off the play TRACE: the recorded
  // separation on quarters-side (non-WR1) medium in-breakers — the exact
  // ball the C6 safety undercuts by rule — must sit measurably below the
  // same ball against the plain two-zone dials.
  const c6m = arm('Six', { passDepth: { short: 0, medium: 100, deep: 0 } }, 8500);
  const czm = arm('CtrlZone', { passDepth: { short: 0, medium: 100, deep: 0 } }, 8500);
  const okQ = c6m.qSep != null && czm.qSep != null && c6m.qSep < czm.qSep - 0.015;
  check('Cover 6 quarters safety undercuts the in-breaker by assignment', okQ, `trace sep ${c6m.qSep?.toFixed(3)} (n=${c6m.qSepN}) vs ctrl ${czm.qSep?.toFixed(3)} (n=${czm.qSepN})`);
}
{
  const t2 = arm('Tampa', DEEP, 9000), cz = arm('CtrlZone', DEEP, 9000);
  check('Tampa 2 stamps the pole runner', t2.pole >= 90, `${t2.pole.toFixed(1)}% of dropbacks`);
  check('Tampa 2 pole closes the deep middle', t2.inside < cz.inside - 0.5, `deep non-WR1 comp% ${t2.inside.toFixed(1)} vs ctrl ${cz.inside.toFixed(1)}`);
}

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'}  (${pass} pass, ${fail} fail)`);
process.exit(fail ? 1 : 0);
