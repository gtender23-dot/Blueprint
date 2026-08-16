// Phone-only tap-to-edit regression for sliders and depth-chart steppers.
// A first tap unlocks without changing the value; the next deliberate action edits.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SHOTS = join(ROOT, 'qa-shots');
await mkdir(SHOTS, { recursive:true });
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.png':'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const body = await readFile(join(ROOT, rel));
    res.writeHead(200, { 'content-type':MIME[extname(rel)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(resolve => server.listen(0, resolve));

const browser = await chromium.launch({ executablePath:process.env.PW_CHROMIUM || undefined, headless:true });
const page = await browser.newPage({ viewport:{ width:390, height:844 } });
const errors = [];
page.on('pageerror', error => errors.push('pageerror: ' + error.message));
page.on('console', message => {
  if (message.type() === 'error' && !/Failed to load resource/i.test(message.text())) errors.push(message.text());
});
let fails = 0;
const check = (ok, label, detail = '') => {
  if (!ok) fails++;
  console.log((ok ? '✅' : '❌') + ' ' + label + (detail ? ' — ' + detail : ''));
};
const openView = async view => {
  await page.evaluate(async view => {
    const { navigate } = await import('./js/state.js');
    navigate(view);
  }, view);
  await page.waitForTimeout(220);
};
const center = async locator => {
  const box = await locator.boundingBox();
  if (!box) throw new Error('control has no bounding box');
  return { x:box.x + box.width / 2, y:box.y + box.height / 2 };
};

try {
  await page.goto('http://127.0.0.1:' + server.address().port + '/index.html');
  await page.waitForTimeout(650);
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
    const coach = {
      id:'dial-guard-smoke', schoolId:school.id, prestige:school.prestige,
      reputation:'C', budget:500000, scholarshipsAvailable:20, recruitBoard:[],
      scouted:{}, budgetCarryover:0, seasonRecord:{ wins:0, losses:0 }, status:'employed',
    };
    school.coach = coach;
    Object.assign(state, {
      initialized:true, season:1, day:8, playerSchoolId:school.id, playerCoach:coach,
      world, schedule:generateSchedule(world), playoffs:null,
      settings:{ ...state.settings, gameplanMode:'advanced' },
    });
    state.ui.view = 'gameplan';
    rerender();
  });
  await page.waitForTimeout(250);

  const gameplanRanges = page.locator('#view-root input[type="range"]');
  check(await gameplanRanges.count() > 0, 'advanced game plan renders its existing sliders');
  const gpInput = page.locator('#view-root input[type="range"]:visible').first();
  await gpInput.scrollIntoViewIfNeeded();
  const gpStart = await gpInput.inputValue();
  const gpPoint = await center(gpInput);
  await page.mouse.click(gpPoint.x, gpPoint.y);
  await page.waitForTimeout(80);
  check(await gpInput.inputValue() === gpStart, 'first slider tap unlocks without changing strategy');
  check(await gpInput.evaluate(el => el.parentElement.classList.contains('is-editing')),
    'unlocked slider shows an editing state');
  await page.screenshot({ path:join(SHOTS, 'phone_dial_gameplan.png') });
  const gpBox = await gpInput.boundingBox();
  await page.mouse.click(gpBox.x + gpBox.width * 0.9, gpBox.y + gpBox.height / 2);
  await page.waitForTimeout(80);
  check(await gpInput.inputValue() !== gpStart, 'second deliberate slider tap changes the value');
  await page.locator('.view-title').click();
  check(await gpInput.getAttribute('aria-disabled') === 'true', 'tap outside relocks the slider');

  const closedDetails = page.locator('details.gp-section:not([open])').first();
  if (await closedDetails.count()) {
    await closedDetails.locator('summary').click();
    await page.waitForTimeout(80);
    const openedOverlay = closedDetails.locator('.phone-dial-unlock:visible').first();
    check(await openedOverlay.count() === 1, 'slider lock repositions when a game-plan section opens');
    if (await openedOverlay.count()) {
      const overlayBox = await openedOverlay.boundingBox();
      check(overlayBox && overlayBox.width > 30 && overlayBox.height >= 30,
        'newly revealed slider has a full-size tap target');
    }
  }

  await openView('depthchart');
  const stepper = page.locator('#view-root .fs-share:visible, #view-root .fs-blitz:visible, #view-root .do-carry:visible').first();
  check(await stepper.count() === 1, 'depth chart renders a guarded +/- dial');
  if (await stepper.count()) {
    await stepper.scrollIntoViewIfNeeded();
    await page.screenshot({ path:join(SHOTS, 'phone_dial_depthchart.png') });
    const valueEl = stepper.locator('.fs-share-pct, .fs-blitz-val, .do-carry-pct').first();
    const plus = stepper.locator('button[data-share-step="1"], button[data-blitz-step="1"], button[data-rbshare-step="1"]').first();
    const stepStart = await valueEl.textContent();
    await plus.scrollIntoViewIfNeeded();
    const plusPoint = await center(plus);
    await page.mouse.click(plusPoint.x, plusPoint.y);
    await page.waitForTimeout(80);
    check((await valueEl.textContent()) === stepStart, 'first +/- tap unlocks without changing the assignment');
    check(await stepper.evaluate(el => el.classList.contains('is-editing')), 'depth-chart dial enters editing state');
    await page.mouse.click(plusPoint.x, plusPoint.y);
    await page.waitForTimeout(80);
    check((await valueEl.textContent()) !== stepStart, 'second +/- tap changes the assignment');
  }

  await openView('practice');
  const practiceRange = page.locator('#view-root .practice-slider:visible').first();
  check(await practiceRange.count() === 1, 'practice workload slider is guarded on phone');
  if (await practiceRange.count()) {
    await practiceRange.scrollIntoViewIfNeeded();
    await page.screenshot({ path:join(SHOTS, 'phone_dial_practice.png') });
    const practiceStart = await practiceRange.inputValue();
    const practicePoint = await center(practiceRange);
    await page.mouse.click(practicePoint.x, practicePoint.y);
    await page.waitForTimeout(80);
    check(await practiceRange.inputValue() === practiceStart, 'practice slider also requires a deliberate unlock tap');
  }

  await page.setViewportSize({ width:1200, height:900 });
  await openView('gameplan');
  check(await page.locator('.phone-dial-unlock').count() === 0, 'desktop keeps direct dial editing with no guard layer');
  const desktopRange = page.locator('#view-root input[type="range"]:visible').first();
  check(await desktopRange.getAttribute('aria-disabled') === null, 'desktop slider remains enabled');
  check(errors.length === 0, 'zero console/page errors', errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log(fails ? '\nFAIL — ' + fails + ' phone dial guard check(s)' : '\nPHONE DIAL GUARD SMOKE PASS');
process.exit(fails ? 1 : 0);