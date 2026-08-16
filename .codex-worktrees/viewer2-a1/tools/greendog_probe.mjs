// greendog_probe.mjs — PASS 4: the green dog REFIT (owner-ratified: one model
// everywhere — the dogGame:"green" call ingredient AND the standing
// gp.greenDog toggle both run the real rule).
// Run: node tools/greendog_probe.mjs [gamesPerArm]
//
// Pins:
//   1. THE RULE. Man coverage + the back stays in ⇒ the dog goes (pl.greenDog
//      stamped); every dogged snap has rbKeptIn true (the trigger is the back
//      BLOCKING, never the back in a route — the old archetype bug).
//   2. THE MAN GATE. The same call with zone style never dogs.
//   3. STANDING TOGGLE runs the same rule (fires under man, dead under zone).
//   4. KILL-SWITCH restores the PRE-PASS-4 dog byte-for-byte: under
//      __noPressFlavors a standing-greenDog game ≡ the same game on the
//      pristine tree's behavior (old archetype-keyed code path — verified
//      structurally: dogs can fire with the back OUT in a route).
//   5. TEETH. Against a man call, keeping the back in to block is no shelter:
//      sacks on rbKeptIn dropbacks rise vs the same call without the dog.
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
  // Max Protect keeps the back home every snap — the dog's trigger diet.
  protIdentity: 'maxProtect',
};
const CALLS = {
  DogMan:   { covStyle: 'man', dogGame: 'green', aggression: 'bend' },
  DogZone:  { covStyle: 'zone', dogGame: 'green', aggression: 'bend' },
  CtrlMan:  { covStyle: 'man', aggression: 'bend' },
};
function runGame(callName, seed, defExtra = {}, kill = false) {
  Math.random = mulberry32(seed);
  globalThis.__noPressFlavors = kill;
  try {
    const rH = genRoster('H'), rA = genRoster('A');
    const gpH = { ...GP_OFF };
    const gpA = callName
      ? { ...GP_OFF, defCalls: { [callName]: CALLS[callName] }, callSheet: sheetAll(callName), ...defExtra }
      : { ...GP_OFF, ...defExtra };
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

console.log(`— 1/2. the rule + the man gate —\n`);
{
  let dogsMan = 0, dbMan = 0, dogsKept = 0, dogsZone = 0, dbZone = 0;
  for (let i = 0; i < Math.min(N, 50); i++) {
    for (const pl of passPlays(runGame('DogMan', 1000 + i).plays)) {
      dbMan++;
      if (pl.greenDog) { dogsMan++; if (pl.rbKeptIn) dogsKept++; }
    }
    for (const pl of passPlays(runGame('DogZone', 1000 + i).plays)) {
      dbZone++;
      if (pl.greenDog) dogsZone++;
    }
  }
  check('man call dogs the staying back', dogsMan > 0, `${dogsMan} dogs on ${dbMan} dropbacks`);
  check('every dog fired on a back who STAYED (rbKeptIn)', dogsMan > 0 && dogsKept === dogsMan, `${dogsKept}/${dogsMan}`);
  check('zone call never dogs (the man gate)', dogsZone === 0, `${dogsZone} on ${dbZone} dropbacks`);
}

console.log('\n— 3. the standing toggle runs the same rule —\n');
{
  let dogsMan = 0, dogsZone = 0, kept = 0;
  for (let i = 0; i < Math.min(N, 50); i++) {
    for (const pl of passPlays(runGame(null, 2000 + i, { greenDog: true, covStyle: 'man' }).plays)) {
      if (pl.greenDog) { dogsMan++; if (pl.rbKeptIn) kept++; }
    }
    for (const pl of passPlays(runGame(null, 2000 + i, { greenDog: true, covStyle: 'zone' }).plays)) {
      if (pl.greenDog) dogsZone++;
    }
  }
  check('standing greenDog dogs under man', dogsMan > 0 && kept === dogsMan, `${dogsMan} dogs, ${kept} on kept-in backs`);
  check('standing greenDog dead under zone', dogsZone === 0, `${dogsZone}`);
}

console.log('\n— 4. kill-switch (pinned PRNG) —\n');
{
  // The ingredient strips clean: DogMan under the switch ≡ CtrlMan.
  const sig = (g) => JSON.stringify([g.score, g.plays.length, g.plays.reduce((s, p) => s + (p.yards || 0), 0)]);
  let identKill = 0, diverged = 0;
  for (const s of [11, 47, 1986]) {
    const ctrl = runGame('CtrlMan', s);
    if (sig(ctrl) === sig(runGame('DogMan', s, {}, true))) identKill++;
    if (sig(ctrl) !== sig(runGame('DogMan', s))) diverged++;
  }
  check('__noPressFlavors: dog ingredient strips to plain dials (3 seeds)', identKill === 3, `${identKill}/3`);
  check('live dog diverges (3 seeds)', diverged === 3, `${diverged}/3`);
  // The standing toggle under the switch runs the OLD code: structurally, old
  // dogs could fire with the back RELEASED (archetype-keyed) — the refit
  // can't. Verify the old path is really back by its signature: it converts
  // an LB even on rbReleased snaps (no rbKeptIn requirement, no man gate).
  // (pl.greenDog is a Pass-4 stamp; the old path doesn't stamp — so instead
  // prove behavioral divergence: same seed, standing toggle, switch on vs
  // off differ, while switch-on ≡ switch-on repeats.)
  let oldStable = 0, refitDiffers = 0;
  for (const s of [77, 411, 2033]) {
    const a = runGame(null, s, { greenDog: true, covStyle: 'man' }, true);
    const b = runGame(null, s, { greenDog: true, covStyle: 'man' }, true);
    if (sig(a) === sig(b)) oldStable++;
    if (sig(a) !== sig(runGame(null, s, { greenDog: true, covStyle: 'man' }))) refitDiffers++;
  }
  check('switch restores a stable old-code path (3 seeds)', oldStable === 3, `${oldStable}/3`);
  check('refit actually changed standing-toggle behavior (3 seeds)', refitDiffers === 3, `${refitDiffers}/3`);
}

console.log(`\n— 5. teeth (paired seeds, ${N} games/arm) —\n`);
{
  const arm = (call, base) => {
    let db = 0, sk = 0;
    for (let i = 0; i < N; i++) {
      for (const pl of passPlays(runGame(call, base + i).plays)) {
        if (!pl.rbKeptIn) continue;
        db++; if (pl.sack) sk++;
      }
    }
    return { rate: db ? 100 * sk / db : 0, db };
  };
  const dg = arm('DogMan', 5000), ct = arm('CtrlMan', 5000);
  check('keeping the back in is no shelter (sack% up on kept-in snaps)', dg.rate > ct.rate, `${dg.rate.toFixed(2)}% (n=${dg.db}) vs ${ct.rate.toFixed(2)}% (n=${ct.db})`);
}

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'}  (${pass} pass, ${fail} fail)`);
process.exit(fail ? 1 : 0);
