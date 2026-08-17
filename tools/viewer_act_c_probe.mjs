// Viewer Act C gate: projection math plus a live replay camera walk.
// Usage: node tools/viewer_act_c_probe.mjs <built.html>
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  normalizeWatchCamera,
  nextWatchCamera,
  watchCameraLabel,
  projectWatchPoint,
  watchProjectionScale
} from '../js/ui/watchcamera.js';

let pass = 0, fail = 0;
const check = (ok, label, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? `  [${detail}]` : ''}`);
  if (ok) pass++; else fail++;
};

check(normalizeWatchCamera('garbage') === 'broadcast', 'unknown stored camera safely falls back to Broadcast');
let mode = 'broadcast';
const cycle = [];
for (let i = 0; i < 5; i++) { mode = nextWatchCamera(mode); cycle.push(mode); }
check(cycle.join(',') === 'all22,coach,endzone,reverse,broadcast', 'camera cycle is deterministic', cycle.join(' -> '));
check(watchCameraLabel('coach') === 'Coach' && watchCameraLabel('reverse') === 'Reverse', 'camera labels are stable replay UI language');

const opts = { direction: 1, fieldTop: 8, fieldHeight: 42, longitudinal: 1.35 };
const world = [72, 19];
const broadcast = projectWatchPoint('broadcast', ...world, opts);
const all22 = projectWatchPoint('all22', ...world, opts);
const coach = projectWatchPoint('coach', ...world, opts);
const reverse = projectWatchPoint('reverse', ...world, opts);
check(JSON.stringify(broadcast) === JSON.stringify(all22), 'All-22 changes framing, not recorded world geometry');
check(Math.abs((broadcast[1] + reverse[1]) - 58) < 1e-9 && broadcast[0] === reverse[0], 'Reverse camera mirrors only the sideline projection');
check(coach[0] !== broadcast[0] && coach[1] !== broadcast[1], 'Coach camera genuinely re-projects the world');
const coachAway = projectWatchPoint('coach', ...world, { ...opts, direction: -1 });
// Amended for #49 (M0 card linter, 2026-08-16): a 180° possession rotation
// that PRESERVES screen-lateral position is a reflection — every look played
// out mirror-flipped against its card whenever the drive direction was left.
// The lateral axis now mirrors WITH the direction (x sums to 100 across the
// two directions, i.e. 16 + 84 at 0.84 scale), so handedness survives the
// rotation. card_lint_probe C4 pins the chirality invariant for every camera.
check(Math.abs(coach[0] + coachAway[0] - 100) < 1e-9 && Math.abs(coach[1] + coachAway[1] - 62) < 1e-9, 'Coach view rotates with possession, mirroring the lateral axis with it (#49)');
check(watchProjectionScale('coach', ...world, opts) < watchProjectionScale('broadcast', ...world, opts), 'high coach view uses a presentation-only player scale');

const target = process.argv[2];
if (!target) {
  console.error('usage: node tools/viewer_act_c_probe.mjs <built.html>');
  process.exit(1);
}
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.addInitScript(() => {
  let seed = 0x0ac7c031;
  Math.random = () => {
    seed = Math.imul(seed, 1664525) + 1013904223 >>> 0;
    return seed / 4294967296;
  };
});
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(pathToFileURL(path.resolve(target)).href, { waitUntil: 'load' });
await page.waitForTimeout(650);
await page.click('#btn-mm-playnow');
await page.waitForTimeout(300);
await page.click('[data-pn-mode="watch"]');
await page.click('#pn-start');
await page.waitForSelector('#watch-board [data-wpa]', { timeout: 25_000 });
await page.waitForSelector('#watch-save-clip', { timeout: 5_000 });
await page.click('#watch-save-clip');
await page.waitForTimeout(180);
const beforeClip = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('cfb-replays') || '[]')[0]?.data?.game?.drives?.[0]?.plays?.[0] || null));
await page.evaluate(() => window.__playReplayClip(JSON.parse(localStorage.getItem('cfb-replays'))[0].data));
await page.waitForSelector('.replay-screen #watch-board [data-wpa]', { timeout: 10_000 });
await page.waitForSelector('#watch-replay-tools.on', { timeout: 5_000 });
await page.click('#replay-play');
const scrub = page.locator('#replay-scrub');
await scrub.evaluate((el) => { el.value = '620'; el.dispatchEvent(new Event('input', { bubbles: true })); });
await page.waitForTimeout(120);

const snap = () => page.evaluate(() => {
  const svg = document.querySelector('#watch-board');
  const actors = [...svg.querySelectorAll('#wp-actors > [data-wpa]')];
  const point = (el) => {
    const m = String(el.getAttribute('transform') || '').match(/translate\(([-\d.]+)[ ,]([-\d.]+)\)/);
    return m ? [Number(m[1]), Number(m[2])] : [NaN, NaN];
  };
  const ys = actors.map((el) => point(el)[1]);
  return {
    camera: svg.dataset.camera,
    label: document.querySelector('#replay-camera')?.textContent,
    viewBox: svg.getAttribute('viewBox'),
    actors: actors.length,
    transforms: actors.map((el) => el.getAttribute('transform')).join('|'),
    faces: [...new Set(actors.flatMap((el) => [...el.classList].filter((c) => c.startsWith('wsp-face-'))))],
    depthSorted: ys.every((y, i) => i === 0 || ys[i - 1] <= y + 0.001),
    sideDisplay: getComputedStyle(svg.querySelector('[data-watch-camera-layer="side"]')).display,
    coachDisplay: getComputedStyle(svg.querySelector('[data-watch-camera-layer="coach"]')).display,
    endzoneDisplay: getComputedStyle(svg.querySelector('[data-watch-camera-layer="endzone"]')).display,
    ballZ: Number(svg.querySelector('#wp-ball')?.dataset.worldZ)
  };
});

const b0 = await snap();
check(b0.camera === 'broadcast' && b0.actors === 22, 'Broadcast begins with the complete 22-player cast', JSON.stringify({ camera: b0.camera, actors: b0.actors }));

await page.click('#replay-camera');
await page.waitForTimeout(100);
const a22 = await snap();
check(a22.camera === 'all22' && a22.label === 'All-22' && /\s100(?:\.00)?\s56(?:\.00)?$/.test(a22.viewBox || ''), 'All-22 remains a full-field framing preset');

await page.click('#replay-camera');
await page.waitForTimeout(100);
const high = await snap();
check(high.camera === 'coach' && high.label === 'Coach', 'Coach camera is selectable in the replay lab');
check(high.sideDisplay === 'none' && high.coachDisplay !== 'none', 'Coach camera swaps to its own field geometry', `${high.sideDisplay}/${high.coachDisplay}`);
check(high.actors === 22 && high.transforms !== a22.transforms && high.depthSorted, 'Coach camera reprojects and depth-sorts all 22 players');
check(high.faces.includes('wsp-face-n') && high.faces.includes('wsp-face-s'), 'Coach camera unlocks front/back player bodies', high.faces.join(','));
check(Number.isFinite(high.ballZ) && high.ballZ >= 0, 'football exposes presentation height independently of x/y', String(high.ballZ));

await page.click('#replay-camera');
await page.waitForTimeout(100);
const endzone = await snap();
check(endzone.camera === 'endzone' && endzone.label === 'End Zone', 'End Zone camera is selectable in the replay lab');
check(endzone.sideDisplay === 'none' && endzone.coachDisplay === 'none' && endzone.endzoneDisplay !== 'none', 'End Zone camera swaps to perspective field geometry');
check(endzone.actors === 22 && endzone.transforms !== high.transforms, 'End Zone camera reprojects all 22 players');

await page.click('#replay-camera');
await page.waitForTimeout(100);
const rev = await snap();
check(rev.camera === 'reverse' && rev.label === 'Reverse' && rev.transforms !== high.transforms, 'Reverse sideline is a distinct camera projection');
check(rev.sideDisplay !== 'none' && rev.coachDisplay === 'none', 'Reverse camera restores broadcast field geometry');

await page.click('#replay-camera');
await page.waitForTimeout(100);
const roundTrip = await snap();
check(roundTrip.camera === 'broadcast' && roundTrip.label === 'Broadcast', 'camera cycle returns cleanly to Broadcast');
const afterClip = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('cfb-replays') || '[]')[0]?.data?.game?.drives?.[0]?.plays?.[0] || null));
check(beforeClip === afterClip, 'camera changes do not mutate the recorded play or its outcome');
check(errors.length === 0, 'zero page errors', errors.slice(0, 3).join(' | '));

console.log(`VIEWER ACT C PROBE — ${pass} pass, ${fail} fail`);
await browser.close();
process.exit(fail ? 1 : 0);
