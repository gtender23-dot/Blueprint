// Viewer Act D gate: perspective projection plus special-teams replay parity.
// Usage: node tools/viewer_act_d_probe.mjs <built.html>
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectWatchPoint, watchProjectionScale } from '../js/ui/watchcamera.js';

let pass = 0, fail = 0;
const check = (ok, label, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? `  [${detail}]` : ''}`);
  if (ok) pass++; else fail++;
};

const opts = { direction: 1, fieldTop: 8, fieldHeight: 42, longitudinal: 1.35 };
const near = projectWatchPoint('endzone', 10, 42, opts);
const far = projectWatchPoint('endzone', 10, 6, opts);
const nearCenter = projectWatchPoint('endzone', 50, 42, opts);
const farCenter = projectWatchPoint('endzone', 50, 6, opts);
check(Math.abs(far[0] - farCenter[0]) < Math.abs(near[0] - nearCenter[0]), 'End Zone lens converges toward the far hash');
check(watchProjectionScale('endzone', 50, 6, opts) < watchProjectionScale('endzone', 50, 42, opts), 'End Zone depth shrinks distant players');
const grounded = projectWatchPoint('endzone', 50, 20, opts);
const airborne = projectWatchPoint('endzone', 50, 20, { ...opts, z: 8 });
check(airborne[1] < grounded[1], 'End Zone lens projects football height independently of field position');

const target = process.argv[2];
if (!target) {
  console.error('usage: node tools/viewer_act_d_probe.mjs <built.html>');
  process.exit(1);
}
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(pathToFileURL(path.resolve(target)).href, { waitUntil: 'load' });
await page.waitForTimeout(500);

const openSpecial = async (play) => {
  await page.evaluate((p) => window.__playReplayClip({
    kind: 'blueprint-viewer-replay',
    schema: 2,
    camera: 'broadcast',
    annotations: [],
    game: {
      drives: [{ possession: 'home', plays: [p] }],
      homeSchool: { id: 'H', name: 'Blueprint State', abbr: 'BPS', colors: ['#245d99', '#f1c34b'] },
      awaySchool: { id: 'A', name: 'Gridiron Tech', abbr: 'GIT', colors: ['#8c2633', '#f4f0d8'] },
      homeScore: 21,
      awayScore: 17,
      playerNames: {}
    }
  }), play);
  await page.waitForSelector('#watch-replay-tools.on', { timeout: 10_000 });
  await page.waitForSelector('#watch-board [data-wpk]', { timeout: 10_000 });
  await page.click('#replay-play');
};

const scrubTo = async (value) => {
  const scrub = page.locator('#replay-scrub');
  await scrub.evaluate((el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
  await page.waitForTimeout(80);
};
const specialSnap = () => page.evaluate(() => {
  const svg = document.querySelector('#watch-board');
  const actors = [...svg.querySelectorAll('[data-wpk]')];
  return {
    camera: svg.dataset.camera,
    label: document.querySelector('#replay-camera')?.textContent,
    actors: actors.length,
    transforms: actors.map((el) => el.getAttribute('transform')).join('|'),
    ball: svg.querySelector('#wp-ball')?.getAttribute('transform'),
    ballZ: Number(svg.querySelector('#wp-ball')?.dataset.worldZ),
    endzoneDisplay: getComputedStyle(svg.querySelector('[data-watch-camera-layer="endzone"]')).display,
    viewBox: svg.getAttribute('viewBox')
  };
});

const plays = [
  { type: 'punt', fieldPos: 44, puntYds: 46, returnerId: 'PR', returnYds: 12, half: 1, clock: 720 },
  { type: 'fg', fieldPos: 68, fgDist: 49, made: true, half: 2, clock: 190 },
  { type: 'pat', fieldPos: 98, made: true, half: 2, clock: 84 },
  { type: 'kickoff', fieldPos: 35, retYds: 24, half: 1, clock: 1800 }
];

for (const play of plays) {
  await openSpecial(play);
  await scrubTo(180);
  const early = await specialSnap();
  await scrubTo(780);
  const late = await specialSnap();
  check(early.actors === 22, `${play.type} replay fields a complete 22-player unit`, String(early.actors));
  check(early.transforms !== late.transforms || early.ball !== late.ball, `${play.type} scrub deterministically moves the special-teams play`);
  await page.click('#replay-camera');
  await page.click('#replay-camera');
  await page.click('#replay-camera');
  await page.waitForTimeout(100);
  const endzone = await specialSnap();
  check(endzone.camera === 'endzone' && endzone.label === 'End Zone' && endzone.endzoneDisplay !== 'none', `${play.type} replay uses the shared End Zone camera`);
  check(endzone.transforms !== late.transforms && endzone.viewBox === '0 0 100 56', `${play.type} actors are reprojected inside the fixed perspective frame`);
  if (play.type !== 'punt') check(Number.isFinite(endzone.ballZ) && endzone.ballZ >= 0, `${play.type} exposes replay-safe football height`, String(endzone.ballZ));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(300);
}

check(errors.length === 0, 'zero page errors', errors.slice(0, 4).join(' | '));
console.log(`VIEWER ACT D PROBE — ${pass} pass, ${fail} fail`);
await browser.close();
process.exit(fail ? 1 : 0);
