// Madden pass 2 (Aug 2026) UI smoke: the formation-first call sheet.
// Exhibition → first offensive call panel → pin a formation → the panel becomes
// that formation's playbook page (grouped, art, one-tap call) → INFO preview
// opens and calls → the game continues. Auto returns the category tiles.
import { chromium } from 'playwright';
const dist = process.argv[2];
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await b.newPage({ viewport: { width: 460, height: 900 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? '✅' : '❌'} ${msg}`); if (!ok) fails++; };

await page.goto('file://' + dist, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.locator('#btn-mm-playnow').click();
await page.waitForTimeout(600);
await page.locator('#pn-start').click();
await page.waitForTimeout(1200);

// settle to the OFFENSIVE call panel (ride defcalls, skip broadcasts, answer 4ths)
async function settleToSheet(maxMs = 45000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    if (await page.locator('.cs-form-strip').count() && await page.locator('[data-cs-drill], [data-cs-callconcept]').count()) return true;
    const ride = page.locator('#dc-ride');
    if (await ride.count()) { await ride.click().catch(() => {}); await page.waitForTimeout(500); continue; }
    const fourth = page.locator('[data-fourth="go"]');
    if (await fourth.count()) { await fourth.first().click().catch(() => {}); await page.waitForTimeout(500); continue; }
    const skip = page.locator('#watch-live-skip');
    if (await skip.count()) await skip.click().catch(() => {});
    const cont = page.locator('#watch-continue');
    if (await cont.count()) await cont.click().catch(() => {});
    await page.waitForTimeout(400);
  }
  return false;
}
check(await settleToSheet(), 'offensive call sheet is up');
check(await page.locator('.cs-cats .cs-cat').count() >= 4, 'Auto shows the category tiles');

// G5 (Aug 2026): the COACH'S CALL suggestion row — three one-tap situation picks.
const sugBtns = await page.locator('.cs-suggest-row [data-cs-callconcept]').count();
check(sugBtns >= 1 && sugBtns <= 6, `COACH'S CALL suggestions render (${sugBtns} one-tap picks)`);

// pin the first real formation
const formBtn = page.locator('.cs-form-btn:not([data-cs-form="__auto"])').first();
const formName = (await formBtn.textContent() || '').trim();
await formBtn.click();
await page.waitForTimeout(600);
check(await page.locator('.cs-cats').count() === 0, 'category tiles are replaced when a formation is pinned');
const title = await page.locator('.cs-drill-title').first().textContent().catch(() => '');
check((title || '').includes('PLAYBOOK'), `formation page is up (${(title || '').trim().slice(0, 40)}…)`);
const tileCount = await page.locator('[data-cs-callconcept]').count();
check(tileCount >= 5, `formation page lists its plays with art (${tileCount} tiles for ${formName})`);
check(await page.locator('.cs-surprise').count() >= 3, 'per-group Surprise me buttons render');
await page.screenshot({ path: '_formation_sheet.png' });

// INFO preview opens from the formation page
await page.locator('.cs-info-btn').first().click();
await page.waitForTimeout(500);
const previewUp = await page.locator('.cs-preview, .cs-teach, [data-cs-callpreview], .cs-drill-back').count();
check(previewUp > 0, 'INFO preview opens from the formation page');
await page.screenshot({ path: '_formation_preview.png' });

// call a play (from the preview if it has a call button, else back out and tap a tile)
const callFromPreview = page.locator('[data-cs-callconcept]').first();
if (await callFromPreview.count()) await callFromPreview.click();
await page.waitForTimeout(900);

// the game must continue: another panel/broadcast/final shows up
async function gameContinues(maxMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    if (await page.locator('.cs-form-strip').count()) return true;
    if (await page.locator('#dc-ride').count()) return true;
    if (await page.locator('[data-fourth]').count()) return true;
    if (await page.locator('.watch-live-overlay').count()) return true;
    if (await page.locator('#close-game-result-btn').count()) return true;
    await page.waitForTimeout(400);
  }
  return false;
}
check(await gameContinues(), 'calling from the formation page resumes the game');

// Auto restores the tiles on the next offensive sheet
if (await settleToSheet()) {
  const autoBtn = page.locator('[data-cs-form="__auto"]');
  if (await autoBtn.count()) { await autoBtn.click(); await page.waitForTimeout(500); }
  check(await page.locator('.cs-cats .cs-cat').count() >= 4, 'Auto brings the category tiles back');
  // G7: the play just called shows up as a RECENT repeat-the-call chip
  const recentTxt = await page.locator('.cs-suggest-row').allTextContents();
  check(recentTxt.some((t) => t.includes('RECENT')), 'RECENT repeat-the-call row appears after a real call');
} else check(false, 'no second sheet reached');

check(errs.length === 0, `zero page errors${errs.length ? ' — got: ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n❌ ${fails} FAILED` : '\n✅ FORMATION SHEET UI SMOKE PASS');
await b.close();
process.exit(fails ? 1 : 0);
