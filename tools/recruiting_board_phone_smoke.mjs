// Focused regression for recruiting Board cards on narrow phones.
// Metadata must wrap between complete football facts, never inside an
// archetype/rating/potential/distance label, and the interest meter must not
// squeeze the identity column.
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
    res.writeHead(200, { 'content-type': MIME[extname(rel)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(resolve => server.listen(0, resolve));
await mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let fails = 0;
const check = (ok, label, detail = '') => {
  if (!ok) fails++;
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
};

try {
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForTimeout(800);
  await page.evaluate(async () => {
    const { state, navigate } = await import('./js/state.js');
    const { generateWorld, generateRecruitPool, generateSchedule } = await import('./js/engine/world.js');
    const { createBoardEntry } = await import('./js/engine/recruiting.js');
    const world = generateWorld();
    world.recruits = generateRecruitPool(world);
    const school = world.schools[0];
    const recruits = world.recruits.slice(0, 3);
    const names = [
      ['Maximilian', 'Fitzpatrick-Washington'],
      ['Christopher', 'Montgomery-Anderson'],
      ['Alexander', 'Jefferson-Rodriguez'],
    ];
    recruits.forEach((recruit, i) => {
      recruit.name.first = names[i][0];
      recruit.name.last = names[i][1];
      recruit.committed = null;
    });
    const board = recruits.map((recruit, i) => ({
      ...createBoardEntry(recruit, school.id),
      interest: 78 - i * 13,
      spent: 12500 + i * 4000,
    }));
    const scouted = Object.fromEntries(recruits.map(recruit => [recruit.id, true]));
    const coach = {
      id:'rec-board-phone', schoolId:school.id, prestige:school.prestige,
      reputation:'C', budget:500000, scholarshipsAvailable:20,
      recruitBoard:board, scouted, budgetCarryover:0,
      seasonRecord:{ wins:0, losses:0 }, status:'employed',
    };
    school.coach = coach;
    Object.assign(state, {
      initialized:true, season:1, day:8, playerSchoolId:school.id,
      playerCoach:coach, world, schedule:generateSchedule(world), playoffs:null,
    });
    navigate('recruiting');
  });
  await page.locator('.rec-tab[data-tab="board"]').click();
  await page.waitForTimeout(250);

  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const report = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.board-card')].map(card => {
        const left = card.querySelector('.board-left').getBoundingClientRect();
        const right = card.querySelector('.board-right').getBoundingClientRect();
        const cr = card.getBoundingClientRect();
        const meter = card.querySelector('.interest-bar-track').getBoundingClientRect();
        const items = [...card.querySelectorAll('.board-meta-item')];
        return {
          stacked: right.top >= left.bottom - 1,
          meterWide: meter.width >= cr.width * .6,
          itemCount: items.length,
          itemsAtomic: items.every(item => {
            const cs = getComputedStyle(item);
            const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
            return cs.whiteSpace === 'nowrap' && item.getBoundingClientRect().height <= line * 1.5;
          }),
          inside: left.left >= cr.left - 1 && right.right <= cr.right + 1,
        };
      });
      return {
        cards,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    });
    check(report.cards.length === 3, `${width}px renders all Board cards`, `${report.cards.length} found`);
    check(!report.overflow, `${width}px Board has no page overflow`);
    check(report.cards.every(card => card.stacked && card.meterWide),
      `${width}px interest meter no longer squeezes recruit metadata`);
    check(report.cards.every(card => card.itemCount >= 4 && card.itemsAtomic),
      `${width}px archetype, ratings, and distance wrap only as complete items`);
    check(report.cards.every(card => card.inside), `${width}px Board content stays inside each card`);
    await page.screenshot({ path: join(SHOTS, `recruiting_board_phone_${width}.png`), fullPage:true });
  }

  await page.setViewportSize({ width:1280, height:900 });
  const desktop = await page.evaluate(() => [...document.querySelectorAll('.board-card')].every(card => {
    const left = card.querySelector('.board-left').getBoundingClientRect();
    const right = card.querySelector('.board-right').getBoundingClientRect();
    return right.left >= left.right - 1 && Math.abs(right.top - left.top) < 12;
  }));
  check(desktop, 'desktop Board retains its side-by-side header');
  check(errors.length === 0, 'zero page errors', errors.slice(0, 2).join(' | '));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log(fails ? `\nFAIL — ${fails} recruiting Board phone check(s)` : '\nRECRUITING BOARD PHONE SMOKE PASS');
process.exit(fails ? 1 : 0);
