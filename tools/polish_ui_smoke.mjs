// Focused UI regression for shared-surface and copy polish.
// Exercises desktop + phone layouts without changing simulation state.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SHOTS = join(ROOT, 'qa-shots');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const body = await readFile(join(ROOT, rel));
    res.writeHead(200, { 'content-type': MIME[extname(rel)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(resolve => server.listen(0, resolve));
await mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource/i.test(message.text())) errors.push(message.text()); });
let fails = 0;
const check = (ok, label, detail = '') => {
  if (!ok) fails++;
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const openView = async (view, params = {}) => {
  await page.evaluate(async ({ view, params }) => {
    const { navigate } = await import('./js/state.js');
    navigate(view, params);
  }, { view, params });
  await page.waitForTimeout(250);
};
const noHorizontalOverflow = () => page.evaluate(() =>
  document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

try {
  await page.goto(`http://localhost:${server.address().port}/index.html`);
  await page.waitForTimeout(1000);
  const menuFlat = await page.evaluate(() => ({
    screen: getComputedStyle(document.querySelector('.mainmenu-screen')).backgroundImage,
    grid: getComputedStyle(document.querySelector('.mm-bg-grid')).display,
  }));
  check(menuFlat.screen === 'none' && menuFlat.grid === 'none', 'desktop main-menu background is flat');
  await page.screenshot({ path: join(SHOTS, 'polish_desktop_menu.png'), fullPage: true });

  await page.evaluate(async () => {
    const { state, rerender } = await import('./js/state.js');
    const { generateWorld, generateSchedule, generateRecruitPool } = await import('./js/engine/world.js');
    const { initBudget } = await import('./js/engine/recruiting.js');
    const { C } = await import('./js/constants.js');
    const world = generateWorld();
    world.recruits = generateRecruitPool(world);
    for (const school of world.schools) {
      if (!school.coach) continue;
      const seniors = school.roster.filter(player => player.classYear === 'SR').length;
      initBudget(school.coach, Math.max(0, C.ROSTER_SIZE - school.roster.length) + seniors);
    }
    const school = world.schools[0];
    Object.assign(state, {
      initialized: true, season: 1, day: 8, playerSchoolId: school.id,
      playerCoach: { id: 'polish-smoke', schoolId: school.id, prestige: school.prestige,
        reputation: 'C', budget: 500000, scholarshipsAvailable: 20, recruitBoard: [],
        scouted: {}, budgetCarryover: 0, seasonRecord: { wins: 0, losses: 0 }, status: 'employed' },
      world, schedule: generateSchedule(world), playoffs: null,
    });
    school.coach = state.playerCoach;
    state.ui.view = 'dashboard';
    rerender();
  });
  await page.waitForTimeout(300);

  const flatShell = await page.evaluate(() => ({
    body: getComputedStyle(document.body).backgroundImage,
    accent: getComputedStyle(document.body, '::before').backgroundImage,
    content: getComputedStyle(document.querySelector('.main-content')).backgroundImage,
    card: getComputedStyle(document.querySelector('.card')).backgroundImage,
  }));
  check(Object.values(flatShell).every(value => value === 'none'), 'desktop shell and card backgrounds are flat', JSON.stringify(flatShell));

  await openView('recruiting');
  const recruitingText = await page.locator('.view-recruiting').innerText();
  check(await page.locator('#sf-thenby').count() === 0 && !recruitingText.includes('THEN BY'), 'Recruiting has no secondary sort control');
  check(await page.locator('#sf-sort').count() === 1, 'Recruiting retains one primary Order By control');
  check(!recruitingText.includes('FUNNEL'), 'Recruiting has no player-facing Funnel label');
  check(!/\b(?:DAY|Day|D)\s*\d+\b/.test(recruitingText) && !/advance a day/i.test(recruitingText),
    'Recruiting uses week labels instead of engine days');
  check(await noHorizontalOverflow(), 'Recruiting fits desktop width');
  await page.screenshot({ path: join(SHOTS, 'polish_desktop_recruiting.png'), fullPage: true });

  await openView('practice');
  const practiceText = await page.locator('.view-practice').innerText();
  check(practiceText.includes('regular-season Weeks 4, 9, 14'), 'Practice shows calendar-correct checkpoint weeks');
  check(!practiceText.includes('weeks 8, 13, 18'), 'Practice removes stale engine-day wording');
  check(await noHorizontalOverflow(), 'Practice fits desktop width');
  await page.screenshot({ path: join(SHOTS, 'polish_desktop_practice.png'), fullPage: true });

  await openView('manual', { chapter: 'the-year' });
  const manualText = await page.locator('.manual-chapter').innerText();
  // [GARRETT, Aug 2026] Was: the manual must literally print "regular-season
  // Weeks 4, 9 and 14". The Aug 2026 slim pass correctly stripped that — naming
  // the checkpoint weeks is a tuning leak, and the leak audit forbids it. The
  // Practice SCREEN still prints them (checked above, and it should — that is a
  // control the coach is looking at). What the manual owes is the MECHANISM, so
  // that is what is asserted now, plus the stale wording still being gone.
  check(/checkpoint/i.test(manualText) && /fixed in-season weeks/i.test(manualText),
    'Manual describes the practice checkpoints without naming the weeks');
  check(!/weeks 8, 13, 18/i.test(manualText), 'Manual carries no stale engine-day checkpoints');
  check(!/advance a day|recruiting day|final day of the window/i.test(manualText),
    'Calendar help consistently describes week advances');

  await openView('depthchart');
  const depthHtml = await page.locator('.view-depthchart').textContent();
  check(!/funnels the ball/i.test(depthHtml || ''), 'Depth Chart removes old Funnel wording');

  await page.setViewportSize({ width: 390, height: 844 });
  await openView('recruiting');
  check(await noHorizontalOverflow(), 'Recruiting fits phone width');
  await page.screenshot({ path: join(SHOTS, 'polish_phone_recruiting.png'), fullPage: true });
  await openView('practice');
  check(await noHorizontalOverflow(), 'Practice fits phone width');
  await page.screenshot({ path: join(SHOTS, 'polish_phone_practice.png'), fullPage: true });

  check(errors.length === 0, 'zero console/page errors', errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log(fails ? `\nFAIL — ${fails} polish UI check(s)` : '\nPOLISH UI SMOKE PASS');
process.exit(fails ? 1 : 0);
