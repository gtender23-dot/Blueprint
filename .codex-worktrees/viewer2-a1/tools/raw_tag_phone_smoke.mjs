// RAW/GAMER badge phone regression. The badge may move as one unit when a
// name wraps, but its icon and label must never split across lines.
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
const inspectTags = () => page.evaluate(() => {
  const tags = [...document.querySelectorAll('.tag-raw')];
  return tags.map(tag => {
    const cs = getComputedStyle(tag);
    const rect = tag.getBoundingClientRect();
    const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
    return {
      text:(tag.textContent || '').trim(),
      display:cs.display,
      whiteSpace:cs.whiteSpace,
      rects:tag.getClientRects().length,
      oneLine:rect.height <= line * 1.6,
    };
  });
});

try {
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForTimeout(700);
  await page.evaluate(async () => {
    const { state, navigate } = await import('./js/state.js');
    const { generateWorld, generateRecruitPool, generateSchedule } = await import('./js/engine/world.js');
    const { createBoardEntry } = await import('./js/engine/recruiting.js');
    const world = generateWorld();
    world.recruits = generateRecruitPool(world);
    const school = world.schools[0];
    const recruit = world.recruits[0];
    recruit.name.first = 'Christopher-Maximilian';
    recruit.name.last = 'Fitzpatrick-Washington';
    recruit.position = 'QB';
    for (const key of ['SPD','AGI','PWR','STR','JMP']) recruit.attributes[key] = 99;
    for (const key of ['HND','SEC','TEC','AWR']) recruit.attributes[key] = 20;
    recruit.committed = null;
    const entry = { ...createBoardEntry(recruit, school.id), interest:71, spent:12000 };
    const coach = {
      id:'raw-phone', schoolId:school.id, prestige:school.prestige,
      reputation:'C', budget:500000, scholarshipsAvailable:20,
      recruitBoard:[entry], scouted:{ [recruit.id]:true }, budgetCarryover:0,
      seasonRecord:{ wins:0, losses:0 }, status:'employed',
    };
    school.coach = coach;
    Object.assign(state, {
      initialized:true, season:1, day:8, playerSchoolId:school.id,
      playerCoach:coach, world, schedule:generateSchedule(world), playoffs:null,
      settings:{ ...state.settings, revealScouting:true },
    });
    navigate('recruiting');
  });
  await page.waitForTimeout(250);

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height:844 });
    await page.locator('.rec-tab[data-tab="board"]').click();
    await page.waitForTimeout(150);
    const boardTags = await inspectTags();
    check(boardTags.length >= 1, `${width}px Board renders the RAW badge`);
    check(boardTags.every(tag => tag.display === 'inline-block' && tag.whiteSpace === 'nowrap'
      && tag.rects === 1 && tag.oneLine), `${width}px Board keeps RAW as one badge`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    check(!overflow, `${width}px RAW badge creates no page overflow`);
    await page.screenshot({ path:join(SHOTS, `raw_tag_board_${width}.png`), fullPage:true });
  }

  await page.locator('.rec-tab[data-tab="search"]').click();
  await page.waitForTimeout(180);
  const searchTags = await inspectTags();
  check(searchTags.length >= 1 && searchTags.every(tag => tag.whiteSpace === 'nowrap' && tag.oneLine),
    'Search table keeps RAW on one line');
  const rawRow = page.locator('.recruit-row:has(.tag-raw)').first();
  await rawRow.locator('.player-name-cell').click();
  await page.waitForTimeout(180);
  const profileTags = await inspectTags();
  check(profileTags.length === 1 && profileTags[0].whiteSpace === 'nowrap' && profileTags[0].oneLine,
    'Recruit profile keeps RAW on one line');
  check(errors.length === 0, 'zero page errors', errors.slice(0, 2).join(' | '));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log(fails ? `\nFAIL — ${fails} RAW badge phone check(s)` : '\nRAW TAG PHONE SMOKE PASS');
process.exit(fails ? 1 : 0);
