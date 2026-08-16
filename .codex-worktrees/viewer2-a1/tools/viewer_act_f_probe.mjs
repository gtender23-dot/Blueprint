// Viewer Act F gate: football-purpose shot labels and deterministic principal
// focus across scrimmage and special-teams replays. Presentation only.
// Usage: node tools/viewer_act_f_probe.mjs <built.html>
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  replayDirectorFocus,
  specialTeamsDirectorFocus,
  watchDirectorFocusLabel
} from '../js/ui/watchcamera.js';

let pass = 0, fail = 0;
const check = (ok, label, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? `  [${detail}]` : ''}`);
  if (ok) pass++; else fail++;
};

const actors = [
  { id: 'QB' }, { id: 'X' }, { id: 'D_CB1' }, { id: 'D_DE1' },
  { id: 'D_FS' }, { id: 'RB_1' }
];
const script = {
  actors,
  covId: 'D_CB1',
  pickId: 'D_FS',
  carryCue: { id: 'X' },
  rushCues: [{ id: 'D_DE1', win: true }],
  tackleCue: { id: 'D_FS', assistId: 'D_CB1', carrierId: 'X' }
};
const play = { targetSlotId: 'X', carrierSlotId: 'RB_1' };

const pocket = replayDirectorFocus(script, play, 'pocket');
check(pocket.primary.join(',') === 'QB' && pocket.secondary.join(',') === 'D_DE1',
  'pocket shot isolates the quarterback and winning rusher', JSON.stringify(pocket));
const flight = replayDirectorFocus(script, play, 'flight');
check(flight.primary.join(',') === 'X' && flight.secondary.join(',') === 'D_CB1' && flight.ball,
  'flight shot follows the target, coverage, and football', JSON.stringify(flight));
const contact = replayDirectorFocus(script, play, 'contact');
check(contact.primary.join(',') === 'RB_1' && contact.secondary.join(',') === 'D_FS,D_CB1' && !contact.ball,
  'contact shot isolates the carrier and credited tackle bodies', JSON.stringify(contact));
const turnover = replayDirectorFocus(script, play, 'change-of-possession');
check(turnover.primary.join(',') === 'D_FS' && turnover.ball,
  'possession-change shot follows the interceptor and football');
check(watchDirectorFocusLabel('run-after-catch') === 'RUN AFTER CATCH' && watchDirectorFocusLabel('new-phase') === 'NEW PHASE',
  'shot labels use stable football language with a safe fallback');

const specialists = ['K', 'H', 'LS', 'PR', 'KR2'].map((id) => ({ id }));
const kickFocus = specialTeamsDirectorFocus(specialists, 'kick');
const returnFocus = specialTeamsDirectorFocus(specialists, 'return');
check(kickFocus.primary.join(',') === 'K' && kickFocus.secondary.join(',') === 'H,LS,PR' && kickFocus.ball,
  'kick shot follows the operation and airborne football');
check(returnFocus.primary.join(',') === 'PR' && returnFocus.secondary.join(',') === 'KR2' && !returnFocus.ball,
  'return shot transfers focus to the return pair');

const target = process.argv[2];
if (!target) {
  console.error('usage: node tools/viewer_act_f_probe.mjs <built.html>');
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
    kind: 'blueprint-viewer-replay', schema: 2, camera: 'broadcast', annotations: [],
    game: {
      drives: [{ possession: 'home', plays: [play] }],
      homeSchool: { id: 'H', name: 'Blueprint State', abbr: 'BPS', colors: ['#245d99', '#f1c34b'] },
      awaySchool: { id: 'A', name: 'Gridiron Tech', abbr: 'GIT', colors: ['#8c2633', '#f4f0d8'] },
      homeScore: 21, awayScore: 17, playerNames: {}
    }
  };
  window.__actFClip = clip;
  window.__actFBefore = JSON.stringify(play);
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
  const bug = document.querySelector('#watch-director-bug');
  return {
    camera: svg.dataset.camera,
    reason: svg.dataset.directorReason,
    focus: svg.dataset.directorFocus,
    bug: bug?.textContent,
    bugOn: bug?.classList.contains('on') && getComputedStyle(bug).display !== 'none',
    primary: [...svg.querySelectorAll('[data-wpk].wp-focus-primary')].map((el) => el.dataset.wpk),
    secondary: [...svg.querySelectorAll('[data-wpk].wp-focus-secondary')].map((el) => el.dataset.wpk),
    ballFocus: svg.classList.contains('watch-focus-ball'),
    director: document.querySelector('#replay-director')?.classList.contains('active')
  };
});

await scrubTo(350);
const kick = await snap();
check(kick.camera === 'endzone' && kick.reason === 'kick' && kick.focus === 'kick' && kick.bug === 'KICK FLIGHT' && kick.bugOn,
  'live Director exposes the football purpose of the End Zone kick shot', JSON.stringify(kick));
check(kick.primary.join(',') === 'K' && kick.secondary.includes('LS') && kick.secondary.includes('PR') && kick.ballFocus,
  'live kick frame marks only the operation principals and football');

await scrubTo(850);
const returning = await snap();
check(returning.camera === 'reverse' && returning.bug === 'RETURN' && returning.primary.join(',') === 'PR' && !returning.ballFocus,
  'live return cut transfers the visual hierarchy to the returner', JSON.stringify(returning));

await page.click('#replay-camera');
await page.waitForTimeout(100);
const manual = await snap();
check(!manual.director && !manual.bugOn && !manual.focus && manual.primary.length === 0 && manual.secondary.length === 0 && !manual.ballFocus,
  'manual camera takeover clears every Director-only focus treatment', JSON.stringify(manual));
const after = await page.evaluate(() => JSON.stringify(window.__actFClip.game.drives[0].plays[0]));
check(after === await page.evaluate(() => window.__actFBefore),
  'Act F focus presentation does not mutate the recorded outcome');
check(errors.length === 0, 'zero page errors', errors.slice(0, 4).join(' | '));

console.log(`VIEWER ACT F PROBE — ${pass} pass, ${fail} fail`);
await browser.close();
process.exit(fail ? 1 : 0);
