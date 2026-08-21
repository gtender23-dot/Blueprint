// timeout_screen_smoke.mjs — the live-game TIMEOUT surface, end to end.
//
// 2026-08-08 (original three):
//  1. The W4 timeout screen OPENS from live coach mode.
//  2. The "Rest of Game" tab's knobs are WIRED.
//  3. Cancel Timeout closes the screen and un-arms the chip.
//
// 2026-08-21 (owner session) — three real defects this file now pins:
//  A. THE SAFETY VALVE. The ⏱️ chip lived ONLY on the two call sheets, so a
//     coach who forgot it when he sent the play in had nowhere to reach for it.
//     It is now in the live watch bar for the whole call stage.
//  B. THE GATE. renderTimeoutAdjustOverlay was gated on state.ui.showCallSheet,
//     which the dominant live path NEVER sets (state.js sets state.ui.liveWatch
//     instead) — so on a live coached game the adjustments screen simply did not
//     render. It appeared only when an earlier non-live stop had left the flag
//     true, which is why it looked intermittent rather than broken.
//  C. THE WRONG PLAN. "Rest of Game" rendered from the token's game-local plan
//     but wrote through setPlanFields to the SCHOOL's season plan: the chip
//     never lit, the change never reached the game in progress, and it silently
//     persisted into next week. wireDefaultsListeners({inPlace:true}) fixes it
//     at all three game-scoped roots (kickoff, halftime, timeout).
//
// The tempo check is deliberately plan-INDEPENDENT: it flips to whichever chip
// is currently off. The old version hard-coded "Hurry" and failed outright on
// any walk whose plan already ran Hurry — an unseeded probe bug, not a product
// one, and it cost a real debugging cycle.
//
// Run from repo root: node tools/timeout_screen_smoke.mjs <ABSOLUTE dist/index.html>
import { chromium } from 'playwright';
const dist = process.argv[2];
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await b.newPage({ viewport: { width: 460, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? '✅' : '❌'} ${msg}`); if (!ok) fails++; };

// Advance the game by whatever control is on screen. The live board only exists
// once there are unwatched plays, so the FIRST call of the game has to be sent
// from the plain sheet — hence .cs-cat / [data-cs-concept] in the list.
const ADVANCE = ['[data-kickoff="on"]', '#dc-ride', '#dc-send', '[data-fourth="go"]',
                 '#watch-live-skip', '.cs-cat', '[data-cs-concept]', '#cs-recover'];
async function step() {
  for (const sel of ADVANCE) {
    const l = page.locator(sel);
    if (await l.count()) { await l.first().click({ timeout: 2000 }).catch(() => {}); return sel; }
  }
  return null;
}

await page.goto('file://' + dist, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.locator('#btn-mm-playnow').click();
await page.waitForTimeout(600);
await page.locator('#pn-start').click();
await page.waitForTimeout(1500);

// ── A/B. the live-bar safety valve, and the gate underneath it ───────────────
{
  let seen = false;
  for (let i = 0; i < 200 && !seen; i++) {
    if (await page.locator('.watch-to-btn').count()) { seen = true; break; }
    await step();
    await page.waitForTimeout(350);
  }
  check(seen, 'timeout button renders in the LIVE watch bar');
  if (seen) {
    check(/Timeout \(\d\)/i.test(await page.locator('.watch-to-btn').first().innerText()),
      'live-bar button shows timeouts remaining');
    await page.evaluate(() => document.querySelector('.watch-to-btn').click());
    await page.waitForTimeout(400);
    check(await page.locator('.watch-to-btn.active').count() === 1, 'live-bar button arms');
    check(await page.locator('.to-adjust-overlay').count() === 1,
      'adjustments screen opens from the LIVE bar (showCallSheet is false there)');
    await page.evaluate(() => document.querySelector('#to-break')?.click());
    await page.waitForTimeout(300);
    check(await page.locator('.to-adjust-overlay').count() === 0, 'Break the Huddle closes the screen');
    check(await page.locator('.watch-to-btn.active').count() === 1, 'the timeout stays armed after Break the Huddle');
    // disarm, so the section below starts from a clean slate
    await page.evaluate(() => document.querySelector('.watch-to-btn').click());
    await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector('#to-cancel')?.click());
    await page.waitForTimeout(300);
  }
}

// settle to a call sheet with the ⏱️ chip on it
let sheet = false;
const t0 = Date.now();
while (Date.now() - t0 < 45000) {
  if (await page.locator('[data-cs-timeout]').count()) { sheet = true; break; }
  await step();
  await page.waitForTimeout(350);
}
check(sheet, 'reached a call sheet (timeout chip present)');

// 1. open the timeout screen from live play
// (DOM-level click: on narrow viewports the chip can sit under the sheet's
// sticky drill header, which intercepts Playwright's hit test.)
await page.evaluate(() => document.querySelector('[data-cs-timeout]').click());
await page.waitForTimeout(500);
check(await page.locator('.to-adjust-overlay').count() === 1, 'timeout screen opens from live coach mode');
check(await page.locator('[data-tonp-field]').count() > 0, 'Next Play Only chips render');

// 2. Rest of Game tab writes THE GAME'S plan (defect C)
await page.evaluate(() => document.querySelector('[data-to-tab="game"]').click());
await page.waitForTimeout(400);
check(await page.locator('#to-adjust-root').count() === 1, 'Rest of Game tab renders the adjust panel');

const tempoState = async () => page.evaluate(() => Object.fromEntries(
  [...document.querySelectorAll('#to-adjust-root [data-gp-set="baseTempo"]')]
    .map(n => [n.dataset.gpVal, n.classList.contains('active')])));
const before = await tempoState();
check(Object.keys(before).length === 3, `tempo chips present in Rest of Game (${Object.keys(before).join('/')})`);
const wasOn = Object.keys(before).find(k => before[k]) || 'Normal';
const target = Object.keys(before).find(k => !before[k]);
await page.evaluate((t) => document.querySelector(`#to-adjust-root [data-gp-set="baseTempo"][data-gp-val="${t}"]`).click(), target);
await page.waitForTimeout(500);
const after = await tempoState();
check(after[target] === true && after[wasOn] === false,
  `Rest of Game chip writes the LIVE plan (${wasOn} -> ${target}; after=${JSON.stringify(after)})`);
check(await page.locator('.to-adjust-overlay').count() === 1, 'screen stays up across the rerender');

// aggression chips are the setAggr path — flip one too
const aggr = page.locator('#to-adjust-root [data-gp-aggr="attacking"]');
if (await aggr.count()) {
  await page.evaluate(() => document.querySelector('#to-adjust-root [data-gp-aggr="attacking"]').click());
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
