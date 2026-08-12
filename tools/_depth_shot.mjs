// Drive the built game to the depth chart screen and screenshot it.
// Usage: node tools/_depth_shot.mjs <dist/index.html> <outdir> [prefix]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const target = process.argv[2];
const outdir = process.argv[3] || '/tmp/shots';
const prefix = process.argv[4] || 'depth';
fs.mkdirSync(outdir, { recursive: true });

const exe = process.env.PW_CHROMIUM || undefined;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const VW = parseInt(process.env.SHOT_W || '430', 10), VH = parseInt(process.env.SHOT_H || '932', 10);
const page = await browser.newPage({ viewport: { width: VW, height: VH } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('file://' + path.resolve(target));
await page.waitForTimeout(1200);

async function clickIf(sel) {
  const el = await page.$(sel);
  if (el) { try { await el.click({ timeout: 2000 }); await page.waitForTimeout(350); return true; } catch (e) { return false; } }
  return false;
}

// main menu -> "+ START A DYNASTY" reveals the collapsed name+START form
await clickIf('#btn-mm-newtree');
await page.waitForTimeout(600);
const mmFirst = await page.$('#mm-nt-first');
if (mmFirst) {
  await mmFirst.fill('Test');
  const mmLast = await page.$('#mm-nt-last');
  if (mmLast) await mmLast.fill('Coach');
  await clickIf('#mm-nt-create');
  await page.waitForTimeout(1500);
}
// wait out world generation
for (let w = 0; w < 120; w++) {
  const busy = await page.$('.ob-generating, .mm-generating');
  const menuGone = await page.evaluate(() => !document.querySelector('#mm-nt-create'));
  if (!busy && menuGone) break;
  await page.waitForTimeout(500);
}

// wizard loop
for (let i = 0; i < 60; i++) {
  // ensure Advanced game planning on step 0 (unlocks all starts; full depth-chart UI)
  const adv = await page.$('[data-ob-gpmode="advanced"]:not(.active)');
  if (adv) { await adv.click(); await page.waitForTimeout(300); continue; }

  // fill names if inputs exist
  const f = await page.$('#ob-first');
  if (f) { await f.fill('Test'); const l = await page.$('#ob-last'); if (l) await l.fill('Coach'); }

  // enabled next buttons
  let advanced = false;
  for (const sel of ['#ob-next-0', '#ob-next-1', '#ob-next-2', '#ob-next-3', '#ob-next-4', '#ob-start', '#btn-start']) {
    const btn = await page.$(sel + ':not([disabled])');
    if (btn) { await btn.click(); await page.waitForTimeout(700); advanced = true; break; }
  }
  if (advanced) {
    // wait out generation screens
    for (let w = 0; w < 40; w++) {
      const gen = await page.$('.ob-generating');
      if (!gen) break;
      await page.waitForTimeout(500);
    }
    // done? dashboard present
    if (await page.$('[data-nav="depthchart"], .bottom-nav, #topbar')) {
      const done = await page.evaluate(() => !document.querySelector('.ob-step') && !document.querySelector('.mm-screen'));
      if (done) break;
    }
    continue;
  }

  // otherwise pick things: challenge card, division, state, school, qb, front, staff
  const pickSels = [
    '[data-ob-challenge]:not(.active)',
    '[data-ob-div]:not(.active)',
    '[data-ob-state]:not(.active)',
    '[data-ob-school]:not(.active)',
    '[data-ob-qb]:not(.active)',
    '[data-ob-front]:not(.active)',
  ];
  // staff step: one pick per group
  for (const grp of ['OC', 'DC']) {
    const active = await page.$(`[data-ob-staff^="${grp}:"].active`);
    if (!active) await clickIf(`[data-ob-staff^="${grp}:"]:not(.active)`);
  }
  let picked = false;
  for (const sel of pickSels) {
    // only pick if no active sibling of the same kind exists
    const attr = sel.match(/data-ob-[a-z-]*/)[0];
    const hasActive = await page.$(`[${attr}].active`);
    if (hasActive) continue;
    if (await clickIf(sel)) { picked = true; break; }
  }
  if (!picked) {
    // staff step may need two picks (oc + dc) — click any unpicked staff card
    if (await clickIf('[data-ob-staff^="DC:"]:not(.active)')) continue;
    await page.waitForTimeout(400);
  }
}

// screenshot whatever we're on for debug
await page.screenshot({ path: path.join(outdir, prefix + '_afterwizard.png'), fullPage: false });

// navigate to depth chart
await page.evaluate(() => { const el = document.querySelector('[data-nav="depthchart"]'); if (el) el.click(); });
await page.waitForTimeout(800);
if (!(await page.$('.view-depthchart'))) {
  // try nav via hamburger/menu
  await clickIf('[data-nav="depthchart"]');
  await page.waitForTimeout(600);
}

async function shootTab(tab, name) {
  if (tab) {
    await page.evaluate((t) => {
      const btn = document.querySelector(`[data-dtab="${t}"]`);
      if (btn) btn.click();
    }, tab);
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: path.join(outdir, `${prefix}_${name}.png`), fullPage: true });
}

await shootTab(null, 'offense');
// flip to the RB tab (carry dials) then the SPOTS tab, shooting each
for (const [tab, name] of [['offense:RB', 'offense_rb'], ['offense:__spots', 'offense_spots']]) {
  await page.evaluate((t) => {
    const btn = [...document.querySelectorAll('[data-do-tab]')].find((b) => b.dataset.doTab === t);
    if (btn) btn.click();
  }, tab);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outdir, `${prefix}_${name}.png`), fullPage: true });
}
await shootTab('defense', 'defense');
await shootTab('st', 'st');

// picker overlay shot (offense)
await page.evaluate(() => { const b = document.querySelector('[data-dtab="offense"]'); if (b) b.click(); });
await page.waitForTimeout(500);
const slot = await page.$('.field-slot [data-open-picker]');
if (slot) { await slot.click(); await page.waitForTimeout(500); await page.screenshot({ path: path.join(outdir, `${prefix}_picker.png`), fullPage: false }); }

console.log('PAGEERRORS', errors.length);
for (const e of errors.slice(0, 5)) console.log(e);
await browser.close();
