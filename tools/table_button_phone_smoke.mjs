// Phone table-action regression: every action uses its complete table cell.
// Covers Recruiting Search, Recruiting Board table, and position conversions.
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
const inspectActionCells = async selector => page.evaluate(selector => {
  return [...document.querySelectorAll(selector)].filter(cell => cell.querySelector('button')).map(cell => {
    const cr = cell.getBoundingClientRect();
    const buttons = [...cell.querySelectorAll(':scope > button')].map(button => {
      const br = button.getBoundingClientRect();
      return { left:br.left, right:br.right, top:br.top, bottom:br.bottom, width:br.width, height:br.height };
    });
    return {
      width:cr.width, height:cr.height, left:cr.left, right:cr.right,
      paddingLeft:parseFloat(getComputedStyle(cell).paddingLeft),
      paddingRight:parseFloat(getComputedStyle(cell).paddingRight),
      buttons,
    };
  });
}, selector);
const cellsFill = cells => cells.length > 0 && cells.every(cell => {
  const buttons = cell.buttons;
  if (!buttons.length || buttons.some(button => button.height < 40)) return false;
  const edgeFill = Math.abs(buttons[0].left - cell.left) <= 1.5
    && Math.abs(buttons[buttons.length - 1].right - cell.right) <= 1.5;
  if (!edgeFill) return false;
  if (buttons.length === 1) return Math.abs(buttons[0].width - cell.width) <= 2;
  const joined = buttons.every((button, index) =>
    index === 0 || Math.abs(button.left - buttons[index - 1].right) <= 1.5);
  const even = Math.max(...buttons.map(button => button.width)) - Math.min(...buttons.map(button => button.width)) <= 2;
  return joined && even;
});

try {
  await page.goto('http://127.0.0.1:' + server.address().port + '/index.html');
  await page.waitForTimeout(650);
  await page.evaluate(async () => {
    const { state, navigate } = await import('./js/state.js');
    const { generateWorld, generateRecruitPool, generateSchedule } = await import('./js/engine/world.js');
    const { createBoardEntry } = await import('./js/engine/recruiting.js');
    const world = generateWorld();
    world.recruits = generateRecruitPool(world);
    const school = world.schools[0];
    const recruits = world.recruits.slice(0, 4);
    recruits.forEach(recruit => { recruit.committed = null; });
    const board = recruits.slice(0, 3).map((recruit, index) => ({
      ...createBoardEntry(recruit, school.id),
      interest:82 - index * 11,
      spent:12000 + index * 3000,
    }));
    const coach = {
      id:'table-button-phone', schoolId:school.id, prestige:school.prestige,
      reputation:'C', budget:500000, scholarshipsAvailable:20,
      recruitBoard:board, scouted:{}, budgetCarryover:0,
      seasonRecord:{ wins:0, losses:0 }, status:'employed',
    };
    school.coach = coach;
    Object.assign(state, {
      initialized:true, season:1, day:8, playerSchoolId:school.id, playerCoach:coach,
      world, schedule:generateSchedule(world), playoffs:null,
    });
    navigate('recruiting');
  });
  await page.waitForTimeout(250);

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height:844 });
    await page.locator('.rec-tab[data-tab="search"]').click();
    await page.waitForTimeout(120);
    const searchCells = await inspectActionCells('.view-recruiting .recruit-table .table-action-cell');
    check(cellsFill(searchCells), width + 'px Search actions fill their cells', searchCells.length + ' action rows');
    await page.locator('.view-recruiting .table-action-cell button').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path:join(SHOTS, 'table_buttons_search_' + width + '.png') });

    await page.locator('.rec-tab[data-tab="board"]').click();
    await page.locator('[data-boardview="table"]').click();
    await page.waitForTimeout(140);
    const boardCells = await inspectActionCells('.view-recruiting .board-table-actions.table-action-cell');
    check(cellsFill(boardCells), width + 'px Board View/Drop buttons split the full cell', boardCells.length + ' action rows');
    check(boardCells.every(cell => cell.buttons.length === 2), width + 'px Board action cells retain both actions');
    await page.locator('.board-table-actions button').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path:join(SHOTS, 'table_buttons_board_' + width + '.png') });
  }

  await page.evaluate(async () => {
    const { state, navigate } = await import('./js/state.js');
    state.day = 3;
    state.preseason = {
      devFocus:'balanced', devDone:false, posChanges:[], campReport:null,
      campAvgGain:0, springResult:null, openerPrep:false,
    };
    navigate('dashboard');
  });
  await page.waitForTimeout(180);
  await page.locator('#btn-conv-toggle').click();
  await page.locator('[data-conv-target="QB"]').click();
  await page.waitForTimeout(140);
  const conversionCells = await inspectActionCells('.conv-board .table-action-cell');
  check(cellsFill(conversionCells), 'phone Convert buttons fill their table cells', conversionCells.length + ' action rows');
  await page.locator('.conv-board .table-action-cell button').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path:join(SHOTS, 'table_buttons_conversion_390.png') });

  await page.setViewportSize({ width:1200, height:900 });
  await page.evaluate(async () => {
    const { state, navigate } = await import('./js/state.js');
    state.day = 8;
    navigate('recruiting');
  });
  await page.waitForTimeout(150);
  const desktopCells = await inspectActionCells('.view-recruiting .recruit-table .table-action-cell');
  check(desktopCells.length > 0 && desktopCells.some(cell =>
    cell.paddingLeft > 0 && cell.buttons[0].width < cell.width - 2 && cell.buttons[0].height < 40),
    'desktop retains compact table buttons');
  check(errors.length === 0, 'zero console/page errors', errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log(fails ? '\nFAIL — ' + fails + ' table-button phone check(s)' : '\nTABLE BUTTON PHONE SMOKE PASS');
process.exit(fails ? 1 : 0);