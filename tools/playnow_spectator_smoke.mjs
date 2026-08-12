// Play Now Watch Only regression: both AI gameplans run the entire exhibition
// while the user sees first-half and second-half live viewer film, with no
// call sheet, fourth-down decision, or halftime coaching screen.
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
await mkdir(SHOTS, { recursive:true });

const browser = await chromium.launch({ executablePath:process.env.PW_CHROMIUM || undefined, headless:true });
const page = await browser.newPage({ viewport:{ width:390, height:844 } });
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
  await page.locator('#btn-mm-playnow').click();
  await page.waitForTimeout(300);

  check(await page.locator('[data-pn-mode="coach"]').count() === 1
    && await page.locator('[data-pn-mode="watch"]').count() === 1,
    'Play Now offers Coach Team 1 and Watch Only');
  await page.locator('[data-pn-mode="watch"]').click();
  await page.waitForTimeout(200);
  check(await page.locator('[data-pn-mode="watch"].active[aria-pressed="true"]').count() === 1,
    'Watch Only can be selected');
  const labels = await page.locator('.pn-side-label').allTextContents();
  check(labels.join('|') === 'TEAM 1|TEAM 2', 'spectator matchup uses neutral Team 1 / Team 2 labels', labels.join('|'));
  const setupOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check(!setupOverflow, 'Watch Only setup fits a 390px phone');
  await page.screenshot({ path:join(SHOTS, 'playnow_spectator_setup_phone.png'), fullPage:true });

  await page.locator('#pn-start').click();
  let promptSeen = false;
  const stages = new Set();
  let resultUp = false;
  for (let i = 0; i < 240; i++) {
    const snap = await page.evaluate(async () => {
      const { state } = await import('./js/state.js');
      return {
        mode:state._exhibitionMode,
        stage:state.ui.liveWatch?.stage || '',
        call:!!document.querySelector('.callsheet-overlay, [data-cs-drill]'),
        fourth:!!document.querySelector('[data-fourth]'),
        halftime:!!document.querySelector('#btn-resume-halftime'),
        result:!!document.querySelector('#close-game-result-btn'),
      };
    });
    if (snap.stage) stages.add(snap.stage);
    promptSeen ||= snap.call || snap.fourth || snap.halftime;
    if (snap.result) { resultUp = true; break; }
    const skip = page.locator('#watch-live-skip');
    if (await skip.count()) await skip.click().catch(() => {});
    const cont = page.locator('#watch-continue');
    if (await cont.count()) await cont.click().catch(() => {});
    await page.waitForTimeout(250);
  }

  check(stages.has('halftime'), 'first half is presented in the live viewer');
  check(stages.has('final'), 'second half is presented in the live viewer');
  check(!promptSeen, 'Watch Only shows no call, fourth-down, or halftime coaching prompts');
  check(resultUp, 'spectator game reaches the final result automatically');
  const scores = resultUp ? await page.locator('.score-num').allTextContents() : [];
  check(scores.length >= 2 && scores.every(score => /^\d+$/.test(score.trim())),
    `spectator final score renders`, scores.join('–'));
  if (resultUp) {
    await page.screenshot({ path:join(SHOTS, 'playnow_spectator_final_phone.png'), fullPage:true });
    await page.locator('#close-game-result-btn').click();
    await page.waitForTimeout(250);
  }
  check(await page.locator('#pn-start').count() === 1
    && await page.locator('[data-pn-mode="watch"].active').count() === 1,
    'returning to setup keeps Watch Only selected');
  check(errors.length === 0, 'zero page errors', errors.slice(0, 2).join(' | '));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log(fails ? `\nFAIL — ${fails} Play Now spectator check(s)` : '\nPLAY NOW SPECTATOR SMOKE PASS');
process.exit(fails ? 1 : 0);
