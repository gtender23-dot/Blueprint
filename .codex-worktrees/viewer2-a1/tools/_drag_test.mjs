// Verify tabbed FULL DEPTH + drag-to-reorder end to end.
import { chromium } from 'playwright';
import path from 'node:path';
const exe = process.env.PW_CHROMIUM || undefined;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('file://' + path.resolve('dist/index.html'));
await page.waitForTimeout(1500);
await page.click('#btn-mm-newtree'); await page.waitForTimeout(600);
await page.fill('#mm-nt-first', 'Test'); await page.fill('#mm-nt-last', 'Coach');
await page.click('#mm-nt-create');
async function clickIf(sel) {
  const el = await page.$(sel);
  if (el) { try { await el.click({ timeout: 2000 }); await page.waitForTimeout(350); return true; } catch (e) { return false; } }
  return false;
}
for (let i = 0; i < 60; i++) {
  const done = await page.evaluate(() => !document.querySelector('.ob-step') && !document.querySelector('.mm-screen') && !!document.querySelector('[data-nav="depthchart"]'));
  if (done) break;
  const adv = await page.$('[data-ob-gpmode="advanced"]:not(.active)');
  if (adv) { await adv.click(); await page.waitForTimeout(300); continue; }
  let advanced = false;
  for (const sel of ['#ob-next-0', '#ob-next-1', '#ob-next-2', '#ob-next-3', '#ob-next-4', '#ob-start', '#btn-start']) {
    const btn = await page.$(sel + ':not([disabled])');
    if (btn) { await btn.click(); await page.waitForTimeout(700); advanced = true; break; }
  }
  if (advanced) {
    for (let w = 0; w < 40; w++) {
      if (!(await page.$('.ob-generating'))) break;
      await page.waitForTimeout(500);
    }
    continue;
  }
  for (const grp of ['OC', 'DC']) {
    const active = await page.$(`[data-ob-staff^="${grp}:"].active`);
    if (!active) await clickIf(`[data-ob-staff^="${grp}:"]:not(.active)`);
  }
  for (const attr of ['data-ob-challenge', 'data-ob-div', 'data-ob-state', 'data-ob-school', 'data-ob-qb', 'data-ob-front']) {
    if (await page.$(`[${attr}].active`)) continue;
    if (await clickIf(`[${attr}]:not(.active)`)) break;
  }
}
await page.evaluate(() => document.querySelector('[data-nav="depthchart"]').click());
await page.waitForTimeout(800);

const tabInfo = await page.evaluate(() => [...document.querySelectorAll('[data-do-tab]')].map((b) => b.dataset.doTab));
console.log('TABS', JSON.stringify(tabInfo));

// switch to WR tab
await page.evaluate(() => { [...document.querySelectorAll('[data-do-tab]')].find((b) => b.dataset.doTab === 'offense:WR').click(); });
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/shots/tabs_wr.png', fullPage: true });

const namesBefore = await page.evaluate(() => [...document.querySelectorAll('[data-drag-list="pos:WR"] [data-pid] .do-name')].map((n) => n.textContent.trim()));
console.log('WR BEFORE', JSON.stringify(namesBefore.slice(0, 5)));

// drag row 3's handle up above row 1
const handles = await page.$$('[data-drag-list="pos:WR"] .do-drag');
const h3 = handles[2];
await h3.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
const box3 = await h3.boundingBox();
const rows = await page.$$('[data-drag-list="pos:WR"] [data-pid]');
const box1 = await rows[0].boundingBox();
await page.mouse.move(box3.x + box3.width / 2, box3.y + box3.height / 2);
await page.mouse.down();
await page.mouse.move(box3.x + box3.width / 2, box1.y + 2, { steps: 12 });
await page.waitForTimeout(150);
await page.screenshot({ path: '/tmp/shots/drag_mid.png', fullPage: false });
await page.mouse.up();
await page.waitForTimeout(600);

const namesAfter = await page.evaluate(() => [...document.querySelectorAll('[data-drag-list="pos:WR"] [data-pid] .do-name')].map((n) => n.textContent.trim()));
console.log('WR AFTER', JSON.stringify(namesAfter.slice(0, 5)));
console.log('DRAG-MOVED', namesAfter[0] === namesBefore[2] && namesAfter[1] === namesBefore[0] ? 'PASS' : 'FAIL');

// starter propagates to the field? WR X slot etc — check field slot names re-rendered
await page.screenshot({ path: '/tmp/shots/tabs_wr_after.png', fullPage: true });

// spots tab
await page.evaluate(() => { [...document.querySelectorAll('[data-do-tab]')].find((b) => b.dataset.doTab === 'offense:__spots').click(); });
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/shots/tabs_spots.png', fullPage: true });

// uniq drag: first group, drag row2 to top
const uh = await page.$$('[data-drag-list^="uniq:"] .do-drag');
if (uh.length > 1) {
  const ub = await uh[1].boundingBox();
  const firstRow = await page.$('[data-drag-list^="uniq:"] [data-pid]');
  const fb = await firstRow.boundingBox();
  const before = await page.evaluate(() => [...document.querySelector('[data-drag-list^="uniq:"]').querySelectorAll('.do-name')].map((n) => n.textContent.trim()));
  await page.mouse.move(ub.x + ub.width / 2, ub.y + ub.height / 2);
  await page.mouse.down();
  await page.mouse.move(ub.x + ub.width / 2, fb.y + 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => [...document.querySelector('[data-drag-list^="uniq:"]').querySelectorAll('.do-name')].map((n) => n.textContent.trim()));
  console.log('UNIQ', JSON.stringify(before.slice(0,2)), '->', JSON.stringify(after.slice(0,2)), after[0] === before[1] ? 'PASS' : 'FAIL');
}

// ST tab: RET drag
await page.evaluate(() => document.querySelector('[data-dtab="st"]').click());
await page.waitForTimeout(500);
const rh = await page.$$('[data-drag-list="ret"] .do-drag');
if (rh.length > 1) {
  const before = await page.evaluate(() => [...document.querySelectorAll('[data-drag-list="ret"] .depth-slot-name')].map((n) => n.textContent.trim()));
  const rb = await rh[1].boundingBox();
  const first = await page.$('[data-drag-list="ret"] [data-pid]');
  const fb2 = await first.boundingBox();
  await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2);
  await page.mouse.down();
  await page.mouse.move(rb.x + rb.width / 2, fb2.y + 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => [...document.querySelectorAll('[data-drag-list="ret"] .depth-slot-name')].map((n) => n.textContent.trim()));
  console.log('RET', JSON.stringify(before.slice(0,2)), '->', JSON.stringify(after.slice(0,2)), after[0] === before[1] ? 'PASS' : 'FAIL');
}
// K drag (st: branch rebuilds depthChart)
const kh = await page.$$('[data-drag-list="st:K"] .do-drag');
if (kh.length > 1) {
  const before = await page.evaluate(() => [...document.querySelectorAll('[data-drag-list="st:K"] .depth-slot-name')].map((n) => n.textContent.trim()));
  await kh[1].scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
  const kb = await kh[1].boundingBox();
  const kfirst = await page.$('[data-drag-list="st:K"] [data-pid]');
  const kfb = await kfirst.boundingBox();
  await page.mouse.move(kb.x + kb.width / 2, kb.y + kb.height / 2);
  await page.mouse.down();
  await page.mouse.move(kb.x + kb.width / 2, kfb.y + 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => [...document.querySelectorAll('[data-drag-list="st:K"] .depth-slot-name')].map((n) => n.textContent.trim()));
  console.log('K', JSON.stringify(before.slice(0,2)), '->', JSON.stringify(after.slice(0,2)), after[0] === before[1] ? 'PASS' : 'FAIL');
} else console.log('K SKIP (one kicker)');
await page.screenshot({ path: '/tmp/shots/tabs_st.png', fullPage: true });
console.log('PAGEERRORS', errors.length);
for (const e of errors.slice(0, 3)) console.log(e);
await browser.close();
