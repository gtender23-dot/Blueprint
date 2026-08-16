// Phone roster regression: the locked POS column and every position badge
// must be fully opaque while the wide table scrolls underneath them.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SHOTS = join(ROOT, 'qa-shots');
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
await mkdir(SHOTS, { recursive:true });

const browser = await chromium.launch({ executablePath:process.env.PW_CHROMIUM || undefined, headless:true });
const page = await browser.newPage({ viewport:{ width:320, height:844 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let fails = 0;
const check = (ok, label, detail = '') => {
  if (!ok) fails++;
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
};

try {
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForTimeout(700);
  await page.evaluate(async () => {
    const { state, navigate } = await import('./js/state.js');
    const { generateWorld, generateSchedule } = await import('./js/engine/world.js');
    const world = generateWorld();
    const school = world.schools[0];
    const coach = school.coach || { id:'roster-sticky', schoolId:school.id };
    school.coach = coach;
    Object.assign(state, {
      initialized:true, season:1, day:8, playerSchoolId:school.id,
      playerCoach:coach, world, schedule:generateSchedule(world), playoffs:null,
    });
    navigate('roster');
  });
  await page.waitForTimeout(250);

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height:844 });
    await page.evaluate(() => { document.querySelector('.roster-table')?.parentElement?.scrollTo({ left:520 }); });
    await page.waitForTimeout(100);
    const report = await page.evaluate(() => {
      const alpha = color => {
        const rgba = color.match(/^rgba?\([^)]*[, ]([\d.]+)\)$/);
        if (color.startsWith('rgba(') && rgba) return Number(rgba[1]);
        const slash = color.match(/\/\s*([\d.]+)\s*\)$/);
        return slash ? Number(slash[1]) : 1;
      };
      const scroller = document.querySelector('.roster-table').parentElement;
      const sr = scroller.getBoundingClientRect();
      const cells = [...document.querySelectorAll('.roster-table th:first-child, .roster-table td:first-child')];
      const chips = [...document.querySelectorAll('.roster-table .pos-cell .pos-chip')];
      return {
        scrolled:scroller.scrollLeft > 300,
        cellsLocked:cells.every(cell => Math.abs(cell.getBoundingClientRect().left - sr.left) < 3),
        cellsOpaque:cells.every(cell => alpha(getComputedStyle(cell).backgroundColor) >= .999),
        chipsOpaque:chips.every(chip => alpha(getComputedStyle(chip).backgroundColor) >= .999),
        cellColors:[...new Set(cells.map(cell => getComputedStyle(cell).backgroundColor))],
        chipColors:[...new Set(chips.map(chip => getComputedStyle(chip).backgroundColor))],
        chipCount:chips.length,
        pageOverflow:document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    });
    check(report.scrolled && report.cellsLocked, `${width}px POS column remains locked while the roster pans`);
    check(report.cellsOpaque, `${width}px sticky POS header and cells are opaque`,
      report.cellsOpaque ? '' : report.cellColors.join(' | '));
    check(report.chipCount >= 20 && report.chipsOpaque, `${width}px every position badge has a solid background`,
      report.chipsOpaque ? `${report.chipCount} badges` : `${report.chipCount} badges — ${report.chipColors.join(' | ')}`);
    check(!report.pageOverflow, `${width}px scrolling stays inside the roster table`);
    await page.screenshot({ path:join(SHOTS, `roster_position_sticky_${width}.png`), fullPage:true });
  }

  await page.setViewportSize({ width:1280, height:900 });
  const desktop = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  check(desktop, 'desktop roster has no page overflow');
  check(errors.length === 0, 'zero page errors', errors.slice(0, 2).join(' | '));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log(fails ? `\nFAIL — ${fails} roster position check(s)` : '\nROSTER POSITION STICKY SMOKE PASS');
process.exit(fails ? 1 : 0);
