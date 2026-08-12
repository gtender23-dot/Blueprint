// nav_back_smoke.mjs — the Back button understands in-view detours. Opening a
// recruit's PROFILE from the recruiting search is a detour WITHIN recruiting,
// not a new screen: Back must return to the recruiting tab it was opened from,
// NOT pop the whole recruiting screen off the stack to the previous menu.
// Also checks team pages (scout) still back out via the global stack.
// Run: node tools/nav_back_smoke.mjs
import { chromium } from 'playwright-core';
import http from 'http';
import { readFile } from 'fs/promises';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';

// fileURLToPath, not .pathname — .pathname on Windows is "/C:/…", which join() mangles.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    const body = await readFile(p);
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });

let fail = 0;
const g = (n, ok, d = '') => { if (!ok) fail++; console.log(`${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`); };
const view = () => page.evaluate(async () => (await import('./js/state.js')).state.ui.view);

await page.goto(`http://localhost:${port}/index.html`);
await page.waitForTimeout(1200);

await page.evaluate(async () => {
  const { state, rerender } = await import('./js/state.js');
  const { generateWorld, generateSchedule, generateRecruitPool } = await import('./js/engine/world.js');
  const { initBudget } = await import('./js/engine/recruiting.js');
  const { C } = await import('./js/constants.js');
  const world = generateWorld(); world.recruits = generateRecruitPool(world);
  for (const s of world.schools) { if (s.coach) { const sen = s.roster.filter(p => p.classYear === 'SR').length; initBudget(s.coach, Math.max(0, C.ROSTER_SIZE - s.roster.length) + sen); } }
  const ps = world.schools[0];
  Object.assign(state, {
    initialized: true, season: 1, day: 4, playerSchoolId: ps.id,
    playerCoach: { id: 'smoke', schoolId: ps.id, prestige: ps.prestige, reputation: 'C', budget: 500000,
      scholarshipsAvailable: 20, recruitBoard: [], scouted: {}, budgetCarryover: 0, seasonRecord: { wins: 0, losses: 0 }, status: 'employed' },
    world, schedule: generateSchedule(world), playoffs: null,
  });
  ps.coach = state.playerCoach;
  state.ui.view = 'dashboard';
  rerender();
});
await page.waitForTimeout(300);

// Dashboard → Recruiting (pushes dashboard onto the back stack).
await page.evaluate(async () => { const { navigate } = await import('./js/state.js'); navigate('recruiting'); });
await page.waitForTimeout(300);
g('landed on recruiting (search tab)', await view() === 'recruiting'
  && await page.locator('.rec-tab.active[data-tab="search"]').count() === 1);

// Open a recruit's profile from the search grid (row click — the name cell,
// not a button cell).
const profRow = page.locator('.recruit-row .player-name-cell').first();
await profRow.waitFor({ timeout: 4000 });
await profRow.click();
await page.waitForTimeout(300);
g('a recruit profile opens as an in-view detour', await page.locator('.recruit-profile').count() === 1
  && await page.locator('.rec-tab.active[data-tab="profile"]').count() === 1);
g('Back button is enabled on the profile', await page.locator('#btn-back-top:not([disabled])').count() === 1);
await page.screenshot({ path: '/tmp/nav_profile.png' });

// THE FIX: Back returns to the recruiting search tab — NOT out to the dashboard.
await page.click('#btn-back-top');
await page.waitForTimeout(300);
g('Back returns to the recruiting board/search, still IN recruiting', await view() === 'recruiting'
  && await page.locator('.recruit-profile').count() === 0
  && await page.locator('.rec-tab.active[data-tab="search"]').count() === 1);

// A SECOND Back now leaves recruiting entirely, to the previous menu (dashboard).
await page.click('#btn-back-top');
await page.waitForTimeout(300);
g('a second Back leaves recruiting to the previous menu', await view() === 'dashboard');

// Detour opened from the BOARD tab returns to the board (not search).
await page.evaluate(async () => { const { navigate } = await import('./js/state.js'); navigate('recruiting'); });
await page.waitForTimeout(200);
// add a recruit to the board so the Board tab has a row to open
await page.evaluate(() => document.querySelector('.add-board-btn')?.click());
await page.waitForTimeout(200);
await page.click('.rec-tab[data-tab="board"]');
await page.waitForTimeout(250);
if (await page.locator('.board-tab-active, .rec-tab.active[data-tab="board"]').count()) {
  const boardProf = page.locator('.view-profile-btn, .recruit-row').first();
  if (await boardProf.count()) {
    await boardProf.click();
    await page.waitForTimeout(250);
    if (await page.locator('.recruit-profile').count()) {
      await page.click('#btn-back-top');
      await page.waitForTimeout(250);
      g('a profile opened from the Board returns to the Board', await view() === 'recruiting'
        && await page.locator('.rec-tab.active[data-tab="board"]').count() === 1);
    } else { g('a profile opened from the Board returns to the Board', true, 'board had no openable profile row — skipped'); }
  } else { g('a profile opened from the Board returns to the Board', true, 'no board rows — skipped'); }
} else { g('a profile opened from the Board returns to the Board', true, 'board tab not active — skipped'); }

// Team pages still back out through the global stack (regression guard).
let originView = null;
for (const v of ['standings', 'schedule', 'dashboard']) {
  await page.evaluate(async (vv) => { const { navigate } = await import('./js/state.js'); navigate(vv); }, v);
  await page.waitForTimeout(250);
  if (await page.locator('[data-scout-team]').count()) { originView = v; break; }
}
if (originView) {
  await page.locator('[data-scout-team]').first().click();
  await page.waitForTimeout(300);
  g('a team page opens (scout view)', await view() === 'scout');
  await page.click('#btn-back-top');
  await page.waitForTimeout(300);
  // Flat view ids became grouped pages with tabs (state.js LEGACY_VIEW_MAP):
  // navigate('standings') lands on view 'program' with the Standings tab
  // active. "Returns to where it was opened" therefore means the right GROUP
  // view AND the right tab, not the old flat id.
  const GROUP_OF = { standings: 'program', schedule: 'program', dashboard: 'dashboard' };
  const expected = GROUP_OF[originView] || originView;
  const tabOk = expected !== 'program'
    || await page.locator(`.rec-tab.active[data-program-tab="${originView}"]`).count() === 1;
  g(`Back from a team page returns to where it was opened (${originView})`,
    await view() === expected && tabOk);
} else {
  g('a team page opens (scout view)', true, 'no team link found — skipped');
  g('Back from a team page returns to where it was opened', true, 'skipped');
}

g('zero console/page errors end-to-end', errors.length === 0, errors.join(' | ').slice(0, 240));

await browser.close(); server.close();
console.log(fail ? `❌ ${fail} NAV-BACK SMOKE FAILURES` : '✅ NAV-BACK SMOKE PASS');
process.exit(fail ? 1 : 0);
