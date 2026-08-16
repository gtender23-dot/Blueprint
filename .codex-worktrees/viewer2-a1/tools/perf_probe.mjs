// perf_probe.mjs — how FAST is it, and does it grow?
//
// Written Aug 2026. Every other tool in here asks whether the game is CORRECT.
// Nothing asked whether it's usable, on a project that ships as one ~2.8 MB
// file and gets tested on a phone. Correctness probes are all green on a build
// that takes nine seconds to boot.
//
// Four budgets, each one a thing a player actually feels:
//   1. WEIGHT     bundle bytes + how long the browser needs to parse/eval it.
//   2. BOOT       cold load → the app is on screen and interactive.
//   3. SIM        games per second, and what one full league week costs. This
//                 is the number that decides whether ADVANCE WEEK feels instant
//                 or feels broken.
//   4. HEAP       memory after simulating seasons. The point is the SLOPE, not
//                 the level: a world that grows without bound is a save that
//                 eventually won't load, and the 40 MB save ceiling is already
//                 close enough to bite (save_migration_check runs ~39.5).
//
// A phone is roughly 3-4x slower than this machine on JS, so the budgets are
// set against a desktop run with that headroom baked in — they are DESKTOP
// numbers chosen so the phone still lands somewhere tolerable.
//
// Budgets are declared here, in one block, on purpose: when one fails you want
// to argue with the number, and you can't argue with a number you can't find.
//
// Run from repo root, after a build:
//   node tools/perf_probe.mjs                 # full run
//   node tools/perf_probe.mjs --seasons 5     # deeper heap slope
//   node tools/perf_probe.mjs --no-browser    # engine only, no playwright
import { readFileSync, existsSync } from 'fs';
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SEASONS = parseInt(arg('--seasons', '3'), 10);
const NO_BROWSER = process.argv.includes('--no-browser');
const DIST = 'dist/index.html';

// ── the budgets ──────────────────────────────────────────────────────────────
const BUDGET = {
  bundleMB:     3.5,   // one file, cached by the service worker after first visit
  parseMs:      900,   // script evaluation alone
  bootMs:      4000,   // cold file:// load → interactive. Phone: assume ~3x.
  gamesPerSec:    8,   // headless FULL-sim throughput
  weekMs:      12000,  // one week of player-division games at the above rate
  heapSlopeMB:  12,    // per simulated season. Flat-ish is the pass; linear is the flag.
};

const results = [];
const rec = (name, value, unit, budget, lowerIsBetter = true) => {
  const ok = budget == null ? null : (lowerIsBetter ? value <= budget : value >= budget);
  results.push({ name, value, unit, budget, ok, lowerIsBetter });
  const mark = ok == null ? '  ' : ok ? '✅' : '❌';
  const b = budget == null ? '' : `   (budget ${lowerIsBetter ? '≤' : '≥'} ${budget}${unit})`;
  console.log(`${mark} ${name.padEnd(34)} ${String(value).padStart(9)}${unit}${b}`);
};

// ── 1 · WEIGHT ───────────────────────────────────────────────────────────────
console.log('\n── WEIGHT ─────────────────────────────────────────────────────');
if (existsSync(DIST)) {
  const bytes = readFileSync(DIST).length;
  rec('bundle size', +(bytes / 1048576).toFixed(2), 'MB', BUDGET.bundleMB);
} else {
  console.log('   dist/index.html missing — run node tools/build.mjs first');
}

// ── 3 · SIM THROUGHPUT ───────────────────────────────────────────────────────
// Deliberately before the browser section: it needs no playwright, so a
// --no-browser run still produces the number that matters most day to day.
console.log('\n── SIM ────────────────────────────────────────────────────────');
function genRoster(talent, schoolId) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS))
    for (let i = 0; i < count; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], talent);
      p.schoolId = schoolId; r.push(p);
    }
  return r;
}
const plan = () => ({
  offFormations: [{ id: 'Spread', weight: 50 }, { id: 'Single Back', weight: 50 }],
  tendency: 'Balanced', rushInPct: 60, passDepth: { short: 40, medium: 40, deep: 20 },
  blitzPct: 20, fourthDown: 'Moderate', baseTempo: 'Normal', maxFGDist: 42,
});
// simulateGame takes EIGHT arguments — schools, rosters, depth charts and
// gameplans as separate parameters. Passing two fat team objects instead hits
// the empty-roster forfeit guard, which returns 21-0 instantly: the first
// version of this probe did exactly that and reported 275,000 games/sec off a
// branch that never runs a snap. If this number ever looks too good, check that
// a result actually has yards in it before believing it.
const rosterH = genRoster(72, 'H'), rosterA = genRoster(68, 'A');
const schoolH = { id: 'H', name: 'Home', prestige: 3 };
const schoolA = { id: 'A', name: 'Away', prestige: 3 };
const depthH = buildDepthChart(rosterH), depthA = buildDepthChart(rosterA);
const gp = plan();
const runGame = () => simulateGame(schoolH, schoolA, rosterH, rosterA, depthH, depthA, gp, gp);

// Prove the instrument before trusting it: a real game has plays in it.
const probe = runGame();
const totalYds = (probe.homeStats?.totalYds ?? 0) + (probe.awayStats?.totalYds ?? 0);
if (!totalYds) {
  console.log('\n❌ INSTRUMENT BROKEN — simulateGame returned no yardage; the timings below');
  console.log('   would be measuring the forfeit guard, not the sim. Check the call signature.');
  process.exit(2);
}
console.log(`   instrument check: ${probe.homeScore}-${probe.awayScore}, ${totalYds} total yards — live`);

for (let i = 0; i < 20; i++) runGame();   // let the JIT settle

const N = 240;
let t0 = performance.now();
for (let i = 0; i < N; i++) runGame();
let elapsed = performance.now() - t0;
const gps = Math.round(N / (elapsed / 1000));
rec('games per second', gps, '/s', BUDGET.gamesPerSec, false);
// IMPORTANT: the league does NOT pay full price for every game. season.js runs
// the real sim only for the PLAYER'S division and a cheap logistic model for
// the others, so the week's cost is the player division's game count — not the
// whole world's. Override with --div-games if your worldgen sizing changes.
const DIV_GAMES = parseInt(arg('--div-games', '64'), 10);
const weekMs = Math.round(DIV_GAMES / gps * 1000);
rec(`one week (${DIV_GAMES} full-sim games)`, weekMs, 'ms', BUDGET.weekMs);
console.log(`   the other divisions use the cheap sim and cost near nothing`);
console.log(`   phone estimate (~3x): ADVANCE WEEK ≈ ${(weekMs * 3 / 1000).toFixed(1)}s`);
rec('single game', +(elapsed / N).toFixed(2), 'ms', null);

// ── 4 · HEAP SLOPE ───────────────────────────────────────────────────────────
// Simulate season-sized batches and watch the resident heap between them. A
// flat line means the sim isn't retaining per-game objects; a clean upward
// slope means something is being kept that shouldn't be.
console.log('\n── HEAP ───────────────────────────────────────────────────────');
const gcish = () => { if (global.gc) global.gc(); };
const heapMB = () => +(process.memoryUsage().heapUsed / 1048576).toFixed(1);
gcish();
const marks = [heapMB()];
for (let s = 0; s < SEASONS; s++) {
  for (let g = 0; g < 165; g++) runGame();
  gcish(); marks.push(heapMB());
}
const slope = +((marks[marks.length - 1] - marks[0]) / SEASONS).toFixed(1);
console.log(`   heap after each season: ${marks.join(' → ')} MB`);
rec(`heap growth per season`, slope, 'MB', BUDGET.heapSlopeMB);
if (!global.gc) console.log('   (run with --expose-gc for a cleaner slope: node --expose-gc tools/perf_probe.mjs)');

// ── 2 · BOOT ─────────────────────────────────────────────────────────────────
if (!NO_BROWSER && existsSync(DIST)) {
  console.log('\n── BOOT ───────────────────────────────────────────────────────');
  const { chromium } = await import('playwright');
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
  const page = await b.newPage();
  const url = 'file://' + process.cwd() + '/' + DIST;
  const start = Date.now();
  await page.goto(url, { waitUntil: 'load' });
  // "Interactive" = the app has mounted something a thumb can hit, not merely
  // that the document fired load. Falls back to a fixed wait if the shell never
  // appears, so a regression reads as a slow boot rather than a hang.
  await page.waitForSelector('button, .view-header', { timeout: 15000 }).catch(() => {});
  const bootMs = Date.now() - start;
  rec('cold boot → interactive', bootMs, 'ms', BUDGET.bootMs);
  const timing = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0] || {};
    return { parse: Math.round((n.domContentLoadedEventEnd || 0) - (n.responseEnd || 0)),
             dom:   Math.round(n.domContentLoadedEventEnd || 0) };
  });
  rec('script parse + eval', timing.parse, 'ms', BUDGET.parseMs);
  const mem = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);
  if (mem != null) rec('browser heap after boot', mem, 'MB', null);
  await b.close();
  console.log(`   phone estimate (~3x): boot ≈ ${(bootMs * 3 / 1000).toFixed(1)}s`);
}

// ── verdict ──────────────────────────────────────────────────────────────────
const failed = results.filter(r => r.ok === false);
console.log('\n───────────────────────────────────────────────────────────────');
if (failed.length) {
  console.log(`PERF PROBE — ${failed.length} over budget:`);
  for (const f of failed) console.log(`  ${f.name}: ${f.value}${f.unit} vs ${f.budget}${f.unit}`);
  console.log('\nA budget is a decision, not a law. If one of these is wrong for the');
  console.log('game you want, change it in BUDGET at the top of this file and say why.');
} else {
  console.log('PERF PROBE PASS — everything inside budget.');
}
process.exit(failed.length ? 1 : 0);
