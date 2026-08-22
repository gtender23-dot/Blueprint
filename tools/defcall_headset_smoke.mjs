// defcall_headset_smoke.mjs — PASS 2 UI smoke: the headset CALL row.
// Serves the module source over http, injects a dynasty whose player gameplan
// carries two named calls, drives a live game to a defensive headset ask, and
// asserts: the CALL row renders the library, one tap pre-fills the dials
// (front + shell chips light), the SENDING card and SEND button agree, re-tapping
// the live card clears
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
// ── 2026-08-22: THE PICTURE AND THE BUTTON TELL THE SAME TRUTH ─────────────
// This used to assert `SEND IT (N calls)` — a label that counted PINNED DIALS
// and called them "calls", so one card and four knobs read as four calls. The
// owner reported the whole screen as incoherent: tapping a card copied it into
// the dials and then forgot the card, leaving the highlight lit while the dials
// underneath were free to contradict it. A 3-4 two-high card could send Big
// Nickel single-high man with nothing on screen admitting it.
//
// Now a SENDING card is drawn from the live pins and the button names the same
// defense. These checks pin that they can never disagree.
const sendTxt = (await page.locator('#dc-send').innerText()).trim();
g('SEND names the defense instead of counting knobs',
  /SEND\s*[—-]\s*\S+ · .+ · .+/.test(sendTxt) && !/\(\d+ calls?\)/.test(sendTxt), sendTxt);
g('a SENDING card is drawn', await page.locator('.dc-live .dc-live-art svg').count() === 1);
const liveSub = (await page.locator('.dc-live-sub').innerText()).trim();
g('the SENDING card and the SEND button agree', sendTxt.includes(liveSub), `${liveSub}  vs  ${sendTxt}`);
g('the SENDING card names the tapped call, unedited',
  (await page.locator('.dc-live-name').innerText()).trim() === 'Bear Down' ||
  !/\(edited\)/.test(await page.locator('.dc-live-name').innerText()),
  (await page.locator('.dc-live-name').innerText()).trim());

// contradict the card by hand — the picture must admit it
await page.evaluate(() => document.querySelector('.dc-chip[data-dc-field="covStyle"][data-dc-val="zone"]').click());
await page.waitForTimeout(300);
g('changing a dial marks the call edited',
  /\(edited\)/.test(await page.locator('.dc-live-name').innerText()),
  (await page.locator('.dc-live-name').innerText()).trim());
const sendTxt2 = (await page.locator('#dc-send').innerText()).trim();
g('and the SEND button follows the change', sendTxt2 !== sendTxt, `${sendTxt} -> ${sendTxt2}`);
const liveSub2 = (await page.locator('.dc-live-sub').innerText()).trim();
g('the picture still agrees with the button after the edit', sendTxt2.includes(liveSub2), `${liveSub2}  vs  ${sendTxt2}`);
await page.evaluate(() => document.querySelector('.dc-chip[data-dc-field="covStyle"][data-dc-val="zone"]').click());
await page.waitForTimeout(300);

// the FRONT row offers the BOOK's fronts, not all eleven in the game
const frontOpts = await page.locator('.dc-chip[data-dc-field="front"]').count();
g('FRONT offers the book\'s fronts, not every front in the game', frontOpts > 0 && frontOpts < 11, `${frontOpts} offered`);

// ── EVERY CARD, TAPPED, MUST SEND ITSELF (2026-08-22) ──────────────────────
// The strongest form of the owner's complaint, as one loop: tap each card and
// require the SENDING line to equal that card's OWN tile line. The tile is read
// from the stored call; SENDING is read from the exploded pins. If the explode
// drops a field, the two disagree here and this goes red.
//
// It is not hypothetical. The explode was a hand-kept list of fourteen field
// names that had forgotten `bringSeats` — 29 of the 71 shipped calls drew five
// or six men rushing and sent a base four.
{
  const cards = await page.evaluate(() => [...document.querySelectorAll('[data-dc-callname]')]
    .map((n) => [n.dataset.dcCallname, (n.querySelector('.cs-c-learn')?.textContent || '').trim()]));
  let bad = [];
  for (const [nm, tile] of cards) {
    // Re-tapping the LIVE card clears it instead of selecting it, so make sure
    // nothing is selected before the measuring tap. (Getting this wrong reads
    // the previous card's pins and invents a mismatch — it did, once.)
    const alreadyOn = await page.evaluate((n) =>
      document.querySelector(`[data-dc-callname="${n}"]`).classList.contains('active'), nm);
    if (alreadyOn) {
      await page.evaluate((n) => document.querySelector(`[data-dc-callname="${n}"]`).click(), nm);
      await page.waitForTimeout(150);
    }
    await page.evaluate((n) => document.querySelector(`[data-dc-callname="${n}"]`).click(), nm);
    await page.waitForTimeout(220);
    const sending = (await page.locator('.dc-live-sub').innerText()).trim();
    if (sending !== tile) {
      const pins = await page.evaluate(() => [...document.querySelectorAll('.dc-chip.active')]
        .map((n) => `${n.dataset.dcField}=${n.dataset.dcVal}`).join(','));
      bad.push(`${nm}: tile "${tile}" vs sending "${sending}"  [pins ${pins || 'none'}]`);
    }
    await page.evaluate((n) => document.querySelector(`[data-dc-callname="${n}"]`).click(), nm);
    await page.waitForTimeout(120);
  }
  g(`every card sends itself (${cards.length} checked)`, bad.length === 0, bad.join(' | '));
}

// ── EVERY PIN IS NAMED (2026-08-22, owner-reported) ────────────────────────
// The SENDING headline is front · coverage · rush, and it used to stop there.
// The owner sent a screenshot reading "(5 PINNED)" over a line that described
// three of them — PRESSURE House and HEAT SHAPE The House were nowhere, and
// those two take the rush from a measured 4.27 men a snap to 5.41, with seven
// coming on 45% of snaps. A summary that omits the pins doing the most work is
// the same defect this panel was rebuilt to kill.
{
  await page.evaluate(() => document.querySelector('.dc-chip[data-dc-field="aggression"][data-dc-val="house"]').click());
  await page.waitForTimeout(300);
  const also = await page.locator('.dc-live-also').count()
    ? (await page.locator('.dc-live-also').innerText()).trim() : '';
  g('a pin outside front/coverage/rush is still named on the card', /House/i.test(also), also || '(no also-pinned line)');
  const pinned = await page.locator('.dc-chip.active').count();
  const named = also ? also.split('·').length : 0;
  // front + coverage pins live in the headline; the rest must all appear here
  g('the card names every pin the headline does not carry', named > 0 && named >= pinned - 4, `${pinned} pinned, ${named} named below`);
  await page.evaluate(() => document.querySelector('.dc-chip[data-dc-field="aggression"][data-dc-val="house"]').click());
  await page.waitForTimeout(250);
}

// the quick call is always reachable
g("Coordinator's call is on the panel", await page.locator('#dc-auto').count() === 1);

// Switching calls swaps the package.
await page.locator('[data-dc-callname="Tite Mint"]').dispatchEvent('click');
await page.waitForTimeout(300);
g('switching calls swaps the package (Tite + two-high light, house clears)',
  await page.locator('.dc-chip.active[data-dc-field="front"][data-dc-val="Tite"]').count() === 1
  && await page.locator('.dc-chip.active[data-dc-field="covShell"][data-dc-val="two"]').count() === 1
  && await page.locator('.dc-chip.active[data-dc-field="aggression"]').count() === 0);

// ── THE CALL SHEET IS A GRID NOW (2026-08-21) ─────────────────────────────
// The headset was a row of text chips plus an "ad-lib" button. It is now front
// tabs over drawn call cards, with the nine dial rows folded into an Adjust
// drawer, and the ad-lib button is gone — RE-TAPPING THE LIVE CARD drops the
// call. This smoke clicked the retired clear-sentinel button, and
// dispatchEvent on a zero-match locator throws: that is the crash the full
// gate reported, and it was right to.
//
// Two of these checks also had to stop keying on `.dc-chip`. The named calls
// are `.cs-concept-card` buttons now (they share the OFFENSIVE sheet's classes
// on purpose), so `.dc-chip[data-dc-callname]` matches nothing and asserting
// it counts ZERO would have passed for the wrong reason — vacuously true
// whether the product worked or not.
g('the calls render as drawn cards, not text chips',
  await page.locator('.dc-cards .cs-concept-card[data-dc-callname]').count() >= 2
  && await page.locator('.dc-cards svg.def-call-card').count() >= 2);
g('the nine dials moved into the Adjust drawer', await page.locator('details.dc-adjust .dc-row').count() >= 5);

// Re-tapping the LIVE card drops the call and keeps the pins.
await page.locator('[data-dc-callname="Tite Mint"]').dispatchEvent('click');
await page.waitForTimeout(300);
g('re-tapping the live card clears the call highlight, pins survive',
  await page.locator('[data-dc-callname].active').count() === 0
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
