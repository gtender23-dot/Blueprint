// Viewer Act E gate: deterministic replay direction, label decluttering,
// and grounded projection-height footballs. Presentation only.
// Usage: node tools/viewer_act_e_probe.mjs <built.html>
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  buildReplayDirectorPlan,
  buildSpecialTeamsDirectorPlan,
  selectWatchLabels
} from '../js/ui/watchcamera.js';

let pass = 0, fail = 0;
const check = (ok, label, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? `  [${detail}]` : ''}`);
  if (ok) pass++; else fail++;
};

const passScript = {
  presnap: 0.6,
  dur: 4.8,
  throwCue: { release: 1.75 },
  tackleCue: { t: 4.1 },
  fx: [{ kind: 'catch', t: 3.05 }]
};
const passPlan = buildReplayDirectorPlan(passScript, {});
check(passPlan.cuts.map((cut) => cut.camera).join(',') === 'all22,broadcast,endzone,broadcast,endzone',
  'pass director follows formation, snap, pocket, flight, and catch phases',
  passPlan.cuts.map((cut) => `${cut.reason}:${cut.camera}`).join(' -> '));
check(passPlan.at(1.45).reason === 'pocket' && passPlan.at(2.1).reason === 'flight',
  'director lookup is deterministic at arbitrary replay times');

const turnoverPlan = buildReplayDirectorPlan({
  presnap: 0.5,
  dur: 5,
  throwCue: { release: 1.6 },
  fx: [{ kind: 'int', t: 2.8 }]
}, {});
check(turnoverPlan.cuts.some((cut) => cut.camera === 'reverse' && cut.reason === 'change-of-possession'),
  'turnover director preserves the possession-flip cut');

const specialPlan = buildSpecialTeamsDirectorPlan({ returnerId: 'PR' }, {
  contact: 0.82,
  landing: 2.32,
  duration: 4.17,
  returnDuration: 1.5
});
check(specialPlan.cuts.map((cut) => cut.camera).join(',') === 'all22,endzone,reverse',
  'special-teams director moves from alignment to kick to return');

const crowded = Array.from({ length: 22 }, (_, i) => ({
  id: `P${i}`,
  x: 48 + i % 4 * 0.7,
  y: 22 + Math.floor(i / 4) * 0.5,
  priority: i < 2 ? 3 : 0
}));
const labelsA = selectWatchLabels(crowded, { camera: 'endzone' });
const labelsB = selectWatchLabels(crowded, { camera: 'endzone' });
check(labelsA.includes('P0') && labelsA.includes('P1') && labelsA.length <= 10,
  'End Zone labels keep featured players while bounding visual clutter', labelsA.join(','));
check(JSON.stringify(labelsA) === JSON.stringify(labelsB), 'label decluttering is deterministic');
check(selectWatchLabels(crowded, { camera: 'broadcast' }).length === 22,
  'sideline cameras preserve the existing complete label set');

const target = process.argv[2];
if (!target) {
  console.error('usage: node tools/viewer_act_e_probe.mjs <built.html>');
  process.exit(1);
}

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
await page.goto(pathToFileURL(path.resolve(target)).href, { waitUntil: 'load' });
await page.waitForTimeout(450);

await page.evaluate(() => {
  const play = { type: 'punt', fieldPos: 44, puntYds: 46, returnerId: 'PR', returnYds: 12, half: 1, clock: 720 };
  const clip = {
    kind: 'blueprint-viewer-replay',
    schema: 2,
    camera: 'broadcast',
    annotations: [],
    game: {
      drives: [{ possession: 'home', plays: [play] }],
      homeSchool: { id: 'H', name: 'Blueprint State', abbr: 'BPS', colors: ['#245d99', '#f1c34b'] },
      awaySchool: { id: 'A', name: 'Gridiron Tech', abbr: 'GIT', colors: ['#8c2633', '#f4f0d8'] },
      homeScore: 21,
      awayScore: 17,
      playerNames: {}
    }
  };
  window.__actEClip = clip;
  window.__actEBefore = JSON.stringify(play);
  window.__playReplayClip(clip, play);
});
await page.waitForSelector('#watch-replay-tools.on', { timeout: 10_000 });
await page.waitForSelector('#watch-board [data-wpk]', { timeout: 10_000 });
await page.click('#replay-play');
await page.click('#replay-director');

const scrubTo = async (value) => {
  await page.locator('#replay-scrub').evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  await page.waitForTimeout(100);
};
const snap = () => page.evaluate(() => {
  const svg = document.querySelector('#watch-board');
  const ball = svg.querySelector('#wp-ball');
  const shadow = svg.querySelector('#wp-ball-ground-shadow');
  const translate = (el) => {
    const match = String(el?.getAttribute('transform') || '').match(/translate\(([-\d.]+)[ ,]([-\d.]+)\)/);
    return match ? [Number(match[1]), Number(match[2])] : [NaN, NaN];
  };
  return {
    camera: svg.dataset.camera,
    reason: svg.dataset.directorReason,
    directorText: document.querySelector('#replay-director')?.textContent,
    directorActive: document.querySelector('#replay-director')?.classList.contains('active'),
    actors: svg.querySelectorAll('[data-wpk]').length,
    muted: svg.querySelectorAll('[data-wpk].wp-label-muted').length,
    featuredMuted: svg.querySelectorAll('[data-wpk].wp-label-featured.wp-label-muted').length,
    ballZ: Number(ball?.dataset.worldZ),
    ballPoint: translate(ball),
    shadowPoint: translate(shadow),
    shadowVisible: getComputedStyle(shadow).display !== 'none' && shadow.classList.contains('on')
  };
});

await scrubTo(350);
const kick = await snap();
check(kick.camera === 'endzone' && kick.reason === 'kick' && kick.directorText === 'Auto' && kick.directorActive,
  'Director button automatically selects the End Zone kick phase', JSON.stringify(kick));
check(kick.actors === 22 && kick.muted > 0 && kick.featuredMuted === 0,
  'End Zone replay declutters labels without hiding featured specialists', `${kick.actors}/${kick.muted}/${kick.featuredMuted}`);
check(kick.ballZ > 0 && kick.shadowVisible && kick.ballPoint[1] < kick.shadowPoint[1],
  'airborne football separates from a visible turf shadow in projection view', JSON.stringify({ z: kick.ballZ, ball: kick.ballPoint, shadow: kick.shadowPoint }));

await scrubTo(850);
const returning = await snap();
check(returning.camera === 'reverse' && returning.reason === 'return',
  'Director automatically flips behind the return');

await page.click('#replay-camera');
await page.waitForTimeout(80);
const manual = await snap();
check(!manual.directorActive && manual.directorText === 'Director' && !manual.reason,
  'manual camera choice cleanly takes control from the director');
const after = await page.evaluate(() => JSON.stringify(window.__actEClip.game.drives[0].plays[0]));
check(after === await page.evaluate(() => window.__actEBefore),
  'Act E presentation controls do not mutate the recorded outcome');
check(errors.length === 0, 'zero page errors', errors.slice(0, 4).join(' | '));

console.log(`VIEWER ACT E PROBE — ${pass} pass, ${fail} fail`);
await browser.close();
process.exit(fail ? 1 : 0);
