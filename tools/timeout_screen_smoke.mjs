// timeout_screen_smoke.mjs — gates for the 2026-08-08 play-caller fixes:
//  1. The W4 timeout screen OPENS from live coach mode (it was gated behind
//     state.ui.showCallSheet, which is false on the dominant live path).
//  2. The "Rest of Game" tab's knobs are WIRED (chips actually write the plan —
//     the active highlight only appears via a state-driven rerender).
//  3. Cancel Timeout closes the screen and un-arms the chip.
// Run from repo root: node tools/timeout_screen_smoke.mjs <ABSOLUTE dist/index.html>
import { chromium } from 'playwright';
const dist = process.argv[2];
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await b.newPage({ viewport: { width: 460, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? '✅' : '❌'} ${msg}`); if (!ok) fails++; };

await page.goto('file://' + dist, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.locator('#btn-mm-playnow').click();
await page.waitForTimeout(600);
await page.locator('#pn-start').click();
await page.waitForTimeout(1500);

// settle to an OFFENSIVE call sheet (answer defense asks / skip broadcast)
let sheet = false;
const t0 = Date.now();
while (Date.now() - t0 < 45000) {
  if (await page.locator('[data-cs-timeout]').count()) { sheet = true; break; }
  const ride = page.locator('#dc-ride');
  if (await ride.count()) { await ride.click().catch(() => {}); await page.waitForTimeout(600); continue; }
  const dcSend = page.locator('#dc-send');
  if (await dcSend.count()) { await dcSend.click().catch(() => {}); await page.waitForTimeout(600); continue; }
  const fourth = page.locator('[data-fourth="go"]');
  if (await fourth.count()) { await fourth.first().click().catch(() => {}); await page.waitForTimeout(600); continue; }
  const skip = page.locator('#watch-live-skip');
  if (await skip.count()) await skip.click().catch(() => {});
  await page.waitForTimeout(400);
}
check(sheet, 'reached an offensive call sheet (timeout chip present)');

// 1. open the timeout screen from live play
// (DOM-level click: on narrow viewports the chip can sit under the sheet's
// sticky drill header, which intercepts Playwright's hit test.)
await page.evaluate(() => document.querySelector('[data-cs-timeout]').click());
await page.waitForTimeout(500);
check(await page.locator('.to-adjust-overlay').count() === 1, 'timeout screen opens from live coach mode');
check(await page.locator('[data-tonp-field]').count() > 0, 'Next Play Only chips render');

// 2. Rest of Game tab is wired
await page.evaluate(() => document.querySelector('[data-to-tab=\"game\"]').click());
await page.waitForTimeout(400);
check(await page.locator('#to-adjust-root').count() === 1, 'Rest of Game tab renders the adjust panel');
const tempoChip = page.locator('#to-adjust-root [data-gp-set="baseTempo"][data-gp-val="Hurry"]');
check(await tempoChip.count() === 1, 'tempo chip present in Rest of Game');
const wasActive = await tempoChip.evaluate(n => n.classList.contains('active')).catch(() => true);
await page.evaluate(() => document.querySelector('#to-adjust-root [data-gp-set=\"baseTempo\"][data-gp-val=\"Hurry\"]').click());
await page.waitForTimeout(500);
const nowActive = await page.locator('#to-adjust-root [data-gp-set="baseTempo"][data-gp-val="Hurry"]')
  .evaluate(n => n.classList.contains('active')).catch(() => false);
check(!wasActive && nowActive, 'Rest of Game chip writes the plan (Hurry goes active via rerender)');
check(await page.locator('.to-adjust-overlay').count() === 1, 'screen stays up across the rerender');

// aggression chips are the setAggr path — flip one too
const aggr = page.locator('#to-adjust-root [data-gp-aggr="attacking"]');
if (await aggr.count()) {
  await page.evaluate(() => document.querySelector('#to-adjust-root [data-gp-aggr=\"attacking\"]').click());
  await page.waitForTimeout(500);
  check(await page.locator('#to-adjust-root [data-gp-aggr="attacking"]').evaluate(n => n.classList.contains('active')).catch(() => false),
    'aggression stop chip wired too');
}

// 3. cancel closes and un-arms
await page.evaluate(() => document.querySelector('#to-cancel')?.click());
await page.waitForTimeout(500);
check(await page.locator('.to-adjust-overlay').count() === 0, 'Cancel Timeout closes the screen');
check(errs.length === 0, `zero page errors (${errs.length})`);
await b.close();
console.log(fails ? `\n❌ TIMEOUT SCREEN SMOKE FAIL (${fails})` : '\nTIMEOUT SCREEN SMOKE PASS');
process.exit(fails ? 1 : 0);
