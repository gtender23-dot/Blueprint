// Play Now E2E: main menu → setup (reroll, prestige, division) → kick off →
// call a play → skip to halftime → locker room → 2nd half → skip to final →
// result modal → back to setup → back to main menu. Screenshots along the way.
import { chromium } from 'playwright';
const dist = process.argv[2];
const shotDir = process.argv[3] || '.';
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await b.newPage({ viewport: { width: 460, height: 900 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? '✅' : '❌'} ${msg}`); if (!ok) fails++; };
const shot = (name) => page.screenshot({ path: `${shotDir}/${name}.png` });

await page.goto('file://' + dist, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// 1. Main menu has the Play Now button
const pnBtn = page.locator('#btn-mm-playnow');
check(await pnBtn.count() === 1, 'main menu shows PLAY NOW');
await pnBtn.click();
await page.waitForTimeout(600);

// 2. Setup screen: two panels, star pickers, reroll works
check(await page.locator('.pn-panel').count() === 2, 'setup shows two team panels');
const nameBefore = await page.locator('.pn-panel .pn-name').first().textContent();
await page.locator('[data-pn-reroll="home"]').click();
await page.waitForTimeout(400);
const nameAfter = await page.locator('.pn-panel .pn-name').first().textContent();
check(nameBefore !== nameAfter, `reroll changes the team (${nameBefore} → ${nameAfter})`);
// change opponent division to D3 and prestige to 1 (stack the deck)
await page.locator('[data-pn-div="away:D3"]').click();
await page.waitForTimeout(400);
check(await page.locator('.pn-panel').nth(1).locator('.pn-star').count() === 3, 'D3 prestige caps at 3 stars');
await page.locator('[data-pn-star="away:1"]').click();
await page.waitForTimeout(400);
// crank our side to 6
await page.locator('[data-pn-star="home:6"]').click();
await page.waitForTimeout(400);
await shot('pn_setup');

// 3. Kick off → first ask arrives (watch overlay or call sheet)
await page.locator('#pn-start').click();
await page.waitForTimeout(1200);
const overlayUp = async () => (await page.locator('.watch-live-overlay').count()) > 0
  || (await page.locator('.callsheet-overlay').count()) > 0;
check(await overlayUp(), 'kick off opens the live game (watch overlay / call sheet)');
await shot('pn_kickoff');

// Helper: settle to a call panel (skip any running broadcast)
async function settleToCall(maxMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    if (await page.locator('[data-cs-drill]').count() > 0 || await page.locator('[data-fourth]').count() > 0) return true;
    // Madden pass: every-snap mode also stops on the DEFENSIVE panel — ride it.
    const ride = page.locator('#dc-ride');
    if (await ride.count()) { await ride.click().catch(() => {}); await page.waitForTimeout(500); continue; }
    const dcSend = page.locator('#dc-send');
    if (await dcSend.count()) { await dcSend.click().catch(() => {}); await page.waitForTimeout(500); continue; }
    const skip = page.locator('#watch-live-skip');
    if (await skip.count()) { await skip.click().catch(() => {}); }
    await page.waitForTimeout(400);
  }
  return false;
}
// A fourth-down decision is also a valid call-panel state, but it does not render
// the time-control bar. Answer it and keep settling until the normal sheet is back.
async function settleToSkipBreak(maxMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    if (await page.locator('#tc-skipbreak').count()) return 'call';
    if (await page.locator('#close-game-result-btn').count()) return 'final';
    // The opening snap after halftime intentionally has no skip-to-break
    // control yet. Answer that normal call sheet, then settle again; otherwise
    // the harness mistakes a healthy Q3 call panel for a timeout.
    const drill = page.locator('[data-cs-drill]');
    if (await drill.count()) {
      await drill.first().click().catch(() => {});
      await page.waitForTimeout(250);
      const concept = page.locator('[data-cs-callconcept]').first();
      if (await concept.count()) await concept.click().catch(() => {});
      else await page.locator('[data-cs-concept="__surprise"]').click().catch(() => {});
      await page.waitForTimeout(700);
      continue;
    }
    const fourth = page.locator('[data-fourth="go"]');
    if (await fourth.count()) {
      await fourth.first().click().catch(() => {});
    }
    // Madden pass: ride defensive every-snap stops so the loop keeps settling.
    const ride = page.locator('#dc-ride');
    if (await ride.count()) { await ride.click().catch(() => {}); await page.waitForTimeout(500); continue; }
    const skip = page.locator('#watch-live-skip');
    if (await skip.count()) await skip.click().catch(() => {});
    const cont = page.locator('#watch-continue');
    if (await cont.count()) await cont.click().catch(() => {});
    await page.waitForTimeout(400);
  }
  return '';
}
check(await settleToCall(), 'first call panel is up');

// 4. Call one real play through the drill-down (inside run)
if (await page.locator('[data-cs-drill]').count()) {
  await page.locator('[data-cs-drill]').first().click();
  await page.waitForTimeout(400);
  const card = page.locator('[data-cs-callconcept]').first();
  if (await card.count()) await card.click();
  else await page.locator('[data-cs-concept="__surprise"]').click();
  await page.waitForTimeout(800);
  // The call was actually consumed iff the drill-down closed (board or next ask up)
  check(await page.locator('[data-cs-callconcept]').count() === 0, 'called a play from the sheet (drill closed)');
} else if (await page.locator('[data-fourth="go"]').count()) {
  await page.locator('[data-fourth="go"]').click();
  await page.waitForTimeout(600);
  check(await page.locator('[data-fourth="go"]').count() === 0, 'answered the 4th-down panel (panel closed)');
} else {
  check(false, 'no call panel to answer at step 4');
}
await shot('pn_aftercall');

// 5. Skip to halftime → locker room → start 2nd half
check(await settleToSkipBreak() === 'call', 'next call panel after the play');
await page.locator('#tc-skipbreak').first().click();
await page.waitForTimeout(1500);
// halftime live-watch replay may be up — skip it
for (let i = 0; i < 30 && !(await page.locator('#btn-resume-halftime').count()); i++) {
  const ride = page.locator('#dc-ride');
  if (await ride.count()) await ride.click().catch(() => {});
  const skip = page.locator('#watch-live-skip');
  if (await skip.count()) await skip.click().catch(() => {});
  const cont = page.locator('#watch-continue');
  if (await cont.count()) await cont.click().catch(() => {});
  await page.waitForTimeout(500);
}
check(await page.locator('#btn-resume-halftime').count() === 1, 'locker room (halftime takeover) reached');
await shot('pn_halftime');
await page.locator('[data-ht-adj="offlean"]').click().catch(() => {});
await page.locator('#btn-resume-halftime').click();
await page.waitForTimeout(1500);

// 6. Second half: settle to a call, then skip to final
const secondHalfState = await settleToSkipBreak();
if (!secondHalfState) {
  console.log('second-half DOM: ' + await page.evaluate(() => {
    const ids = [...document.querySelectorAll('button')].map(e => ({
      id: e.id, text: (e.textContent || '').replace(/\s+/g, ' ').trim(),
      drill: e.dataset.csDrill || '', fourth: e.dataset.fourth || '',
    })).slice(0, 80);
    const overlays = [...document.querySelectorAll('[class*="overlay"], [class*="takeover"]')]
      .map(e => ({ className: e.className, text: (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300) })).slice(0, 15);
    const text = (document.getElementById('app')?.innerText || '').replace(/\s+/g, ' ').slice(0, 300);
    return JSON.stringify({ ids, overlays, text });
  }));
  await b.close();
  process.exit(1);
}
check(secondHalfState === 'call' || secondHalfState === 'final', 'second-half call panel or final is up');
if (secondHalfState === 'call') {
  await page.locator('#tc-skipbreak').first().click();
  await page.waitForTimeout(1500);
}
// final live-watch replay → skip → result modal
for (let i = 0; i < 30 && !(await page.locator('#close-game-result-btn').count()); i++) {
  const ride = page.locator('#dc-ride');
  if (await ride.count()) await ride.click().catch(() => {});
  const skip = page.locator('#watch-live-skip');
  if (await skip.count()) await skip.click().catch(() => {});
  const cont = page.locator('#watch-continue');
  if (await cont.count()) await cont.click().catch(() => {});
  await page.waitForTimeout(500);
}
check(await page.locator('#close-game-result-btn').count() === 1, 'final result modal is up');
const scores = await page.locator('.score-num').allTextContents();
check(scores.length >= 2 && scores.every(s => /^\d+$/.test(s.trim())), `final score rendered (${scores.join('–')})`);
await shot('pn_final');

// 7. Continue → back on the setup screen (rematch-ready), then back to menu
await page.locator('#close-game-result-btn').click();
await page.waitForTimeout(700);
check(await page.locator('#pn-start').count() === 1, 'back on the Play Now setup after the game');
await page.locator('#pn-back').click();
await page.waitForTimeout(700);
check(await page.locator('#btn-mm-playnow').count() === 1, 'back on the main menu');

check(errs.length === 0, `zero page errors${errs.length ? ' — got: ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n❌ ${fails} FAILED` : '\n✅ PLAY NOW E2E PASS');
await b.close();
process.exit(fails ? 1 : 0);
