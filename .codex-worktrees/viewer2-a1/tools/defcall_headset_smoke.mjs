// defcall_headset_smoke.mjs — PASS 2 UI smoke: the headset CALL row.
// Serves the module source over http, injects a dynasty whose player gameplan
// carries two named calls, drives a live game to a defensive headset ask, and
// asserts: the CALL row renders the library, one tap pre-fills the dials
// (front + shell chips light), SEND counts the pre-filled pins, ad-lib clears
// the highlight, and the game still completes.
// Run: node tools/defcall_headset_smoke.mjs
import { chromium } from 'playwright-core';
import http from 'http';
import { readFile } from 'fs/promises';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    const body = await readFile(p);
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); res.end(body);
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 780 } });
const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
let fail = 0;
const g = (n, ok, d = '') => { if (!ok) fail++; console.log(`${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`); };

await page.goto(`http://localhost:${port}/index.html`);
await page.waitForTimeout(1000);

await page.evaluate(async () => {
  const { state, rerender } = await import('./js/state.js');
  const { generateWorld, generateSchedule, generateRecruitPool } = await import('./js/engine/world.js');
  const world = generateWorld(); world.recruits = generateRecruitPool(world);
  const ps = world.schools[0];
  Object.assign(state, { initialized: true, season: 1, day: 4, playerSchoolId: ps.id,
    playerCoach: { id: 'smoke', schoolId: ps.id, prestige: ps.prestige, budget: 0, scholarshipsAvailable: 0,
      recruitBoard: [], seasonRecord: { wins: 0, losses: 0 }, status: 'employed' },
    world, schedule: generateSchedule(world), playoffs: null });
  ps.coach = state.playerCoach;
  // PASS 2 under test: a two-call library on the player's gameplan.
  ps.gameplan.defCalls = {
    'Bear Down': { front: '46/Bear', covShell: 'single', covStyle: 'man', aggression: 'house', runCommit: 10 },
    'Tite Mint': { front: 'Tite', covShell: 'two', covStyle: 'zone' },
  };
  state.settings.liveWatch = true;
  state.ui.view = 'dashboard';
  rerender();
});
await page.waitForTimeout(400);
await page.evaluate(async () => { const m = await import('./js/state.js'); await m.advanceDay(); });
await page.waitForTimeout(300);

// Coach the game (headset every call) → walk to the first DEFENSIVE ask.
if (await page.locator('[data-kickoff="all"]').count()) await page.click('[data-kickoff="all"]');
else if (await page.locator('#kickoff-sim-half').count()) g('kickoff offered headset mode', false, 'only sim-half offered');
await page.waitForTimeout(600);
const reached = await page.evaluate(async () => {
  const m = await import('./js/state.js');
  let guard = 0;
  while (m.state.pendingHalftime?.token?.pending && guard++ < 300) {
    const pk = m.state.pendingHalftime.token.pending.kind;
    if (pk === 'defcall') return true;
    if (pk === 'fourth') await m.answerFourthDown('auto');
    else await m.answerPlayCall({ concept: 'sheet' });
  }
  return false;
});
await page.waitForTimeout(400);
g('reached a defensive headset ask', reached);

// With Coach Mode on, the play broadcast may still be on screen — settle it.
for (let i = 0; i < 20 && !(await page.locator('.dc-panel').count()); i++) {
  const skip = page.locator('#watch-live-skip');
  if (await skip.count()) await skip.click().catch(() => {});
  const cont = page.locator('#watch-continue');
  if (await cont.count()) await cont.click().catch(() => {});
  await page.waitForTimeout(400);
}
g('defensive headset panel is up', await page.locator('.dc-panel').count() === 1);

// The CALL row.
g('CALL row renders both named calls',
  await page.locator('[data-dc-callname="Bear Down"]').count() === 1
  && await page.locator('[data-dc-callname="Tite Mint"]').count() === 1);
await page.locator('[data-dc-callname="Bear Down"]').dispatchEvent('click');
await page.waitForTimeout(300);
g('tapping the call highlights it', await page.locator('[data-dc-callname="Bear Down"].active').count() === 1);
g('call pre-fills the dial chips (front + shell + style + pressure light up)',
  await page.locator('.dc-chip.active[data-dc-field="front"][data-dc-val="46/Bear"]').count() === 1
  && await page.locator('.dc-chip.active[data-dc-field="covShell"][data-dc-val="single"]').count() === 1
  && await page.locator('.dc-chip.active[data-dc-field="covStyle"][data-dc-val="man"]').count() === 1
  && await page.locator('.dc-chip.active[data-dc-field="aggression"][data-dc-val="house"]').count() === 1);
const sendTxt = await page.locator('#dc-send').innerText();
g('SEND counts the pre-filled pins', /SEND IT \(\d+ calls?\)/.test(sendTxt), sendTxt.trim());

// Switching calls swaps the package.
await page.locator('[data-dc-callname="Tite Mint"]').dispatchEvent('click');
await page.waitForTimeout(300);
g('switching calls swaps the package (Tite + two-high light, house clears)',
  await page.locator('.dc-chip.active[data-dc-field="front"][data-dc-val="Tite"]').count() === 1
  && await page.locator('.dc-chip.active[data-dc-field="covShell"][data-dc-val="two"]').count() === 1
  && await page.locator('.dc-chip.active[data-dc-field="aggression"]').count() === 0);

// Ad-lib clears the highlight but keeps the pins.
await page.locator('[data-dc-callname="__clear"]').dispatchEvent('click');
await page.waitForTimeout(300);
g('ad-lib clears the call highlight, pins survive',
  await page.locator('.dc-chip[data-dc-callname].active').count() === 0
  && await page.locator('.dc-chip.active[data-dc-field="front"][data-dc-val="Tite"]').count() === 1);

// Send it; then autopilot the rest — the game must complete.
await page.locator('#dc-send').dispatchEvent('click');
await page.waitForTimeout(400);
let done = false;
for (let i = 0; i < 200 && !done; i++) {
  const st = await page.evaluate(async () => {
    const m = await import('./js/state.js');
    const pk = m.state.pendingHalftime?.token?.pending?.kind;
    if (pk === 'fourth') { await m.answerFourthDown('auto'); return 'step'; }
    if (pk) { await m.answerPlayCall({ concept: 'sheet' }); return 'step'; }
    if (m.state.ui.showHalftime) { await m.resumeHalftime(null, null); return 'step'; }
    if (!m.state.pendingHalftime) return 'done';
    return 'idle';
  });
  if (st === 'done') done = true;
  else if (st === 'idle') {
    // Between asks the broadcast / result overlays own the flow — click them.
    for (const sel of ['#watch-live-skip', '#watch-continue', '#close-game-result-btn', '#btn-resume-halftime']) {
      const l = page.locator(sel);
      if (await l.count()) await l.first().click().catch(() => {});
    }
    await page.waitForTimeout(300);
  }
}
done = done && await page.evaluate(async () => {
  const m = await import('./js/state.js');
  const g2 = m.state.schedule.find(x => x.day === m.state.day && (x.homeId === m.state.playerSchoolId || x.awayId === m.state.playerSchoolId));
  return !!g2?.result && !m.state.pendingHalftime;
});
g('game completes after a sent named call', done);

const realErrors = errors.filter(e => !/favicon|sw\.js|ServiceWorker|manifest|Failed to load resource/i.test(e));
g('zero page errors', realErrors.length === 0, realErrors.join(' | ').slice(0, 200));

await browser.close(); server.close();
console.log(fail ? `❌ ${fail} DEFCALL HEADSET SMOKE FAILURES` : '✅ DEFCALL HEADSET SMOKE PASS');
process.exit(fail ? 1 : 0);
