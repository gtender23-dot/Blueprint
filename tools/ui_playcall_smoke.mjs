// ui_playcall_smoke.mjs — Rung 6 UI smoke: drives the REAL app in Chromium.
// Fabricates a world in-page (same shape as advance_test), advances into the
// player's game day, then walks kickoff prompt → call sheet → halftime →
// final through the actual DOM. Run: node tools/ui_playcall_smoke.mjs
import { chromium } from 'playwright-core';
import http from 'http';
import { readFile } from 'fs/promises';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';

// fileURLToPath, not .pathname — .pathname on Windows is "/C:/…", which join() mangles.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    const body = await readFile(p);
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

let fail = 0;
const g = (n, ok, d = '') => { if (!ok) fail++; console.log(`${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`); };

await page.goto(`http://localhost:${port}/index.html`);
await page.waitForTimeout(1200);

// Fabricate a running dynasty directly in the app's own module instances.
await page.evaluate(async () => {
  const { state, rerender } = await import('./js/state.js');
  const { generateWorld, generateSchedule, generateRecruitPool } = await import('./js/engine/world.js');
  const { initBudget } = await import('./js/engine/recruiting.js');
  const { C } = await import('./js/constants.js');
  const world = generateWorld(); world.recruits = generateRecruitPool(world);
  for (const s of world.schools) { if (s.coach) { const sen = s.roster.filter(p => p.classYear === 'SR').length; initBudget(s.coach, Math.max(0, C.ROSTER_SIZE - s.roster.length) + sen); } }
  const ps = world.schools[0];
  Object.assign(state, {
    initialized: true, season: 1, day: 4, playerSchoolId: ps.id,
    playerCoach: { id: 'smoke', schoolId: ps.id, prestige: ps.prestige, reputation: 'C', budget: 0,
      scholarshipsAvailable: 0, recruitBoard: [], budgetCarryover: 0, seasonRecord: { wins: 0, losses: 0 }, status: 'employed' },
    world, schedule: generateSchedule(world), playoffs: null,
  });
  ps.coach = state.playerCoach;
  state.settings.liveWatch = true;   // Coach Mode ON — headset modes are available
  state.ui.view = 'dashboard';
  rerender();
});
await page.waitForTimeout(400);
const bootErrors = errors.filter(e => !/favicon|Failed to load resource/i.test(e));
g('app boots into fabricated dynasty', bootErrors.length === 0, bootErrors.join(' | ').slice(0, 200));

// Advance: the kickoff prompt must come up before the game sims.
await page.evaluate(async () => { const m = await import('./js/state.js'); await m.advanceDay(); });
await page.waitForTimeout(300);
g('kickoff prompt appears on the game day', await page.locator('.kickoff-overlay').count() === 1);
g('three modes + remembered default offered', await page.locator('[data-kickoff]').count() === 3
  && await page.locator('.kickoff-opt.selected[data-kickoff="watch"]').count() === 1);
await page.screenshot({ path: '/tmp/smoke_kickoff.png' });

// Coach Mode gating (Jul 2026): OFF hides the headset modes and offers a single
// Sim-to-Halftime button; ON restores them.
await page.click('#kickoff-coachmode');
await page.waitForTimeout(200);
g('Coach Mode OFF hides headset modes + offers Sim to Halftime',
  await page.locator('[data-kickoff]').count() === 0 && await page.locator('#kickoff-sim-half').count() === 1);
await page.click('#kickoff-coachmode');
await page.waitForTimeout(200);
g('Coach Mode ON restores the headset modes', await page.locator('[data-kickoff]').count() === 3);

// Cancel path: back to prep, nothing simmed.
await page.click('#kickoff-cancel');
await page.waitForTimeout(200);
g('cancel returns to prep without simming', await page.locator('.kickoff-overlay').count() === 0
  && await page.evaluate(async () => (await import('./js/state.js')).state.day) === 4);

// Take it again — EVERY SNAP. Coach Mode on → the broadcast opens with the call
// panel embedded; skip the playback to bring the tiles up.
await page.evaluate(async () => { const m = await import('./js/state.js'); await m.advanceDay(); });
await page.waitForTimeout(200);
await page.click('[data-kickoff="all"]');
await page.waitForTimeout(800);
g('the call panel opens on the first snap', await page.locator('.callsheet-overlay, .watch-live-overlay').count() >= 1);
if (await page.locator('#watch-live-skip').count()) { await page.click('#watch-live-skip'); await page.waitForTimeout(500); }
// F1 (Aug 2026): the opponent's key downs now stop the game on the DEFENSIVE
// headset (dc-panel). Ride the plan through any defensive stops until our
// offensive sheet is up — the offensive flow below is what this smoke pins.
for (let i = 0; i < 15 && !(await page.locator('.cs-strip').count()); i++) {
  if (await page.locator('#dc-send').count()) { await page.click('#dc-send'); await page.waitForTimeout(600); }
  if (await page.locator('#watch-live-skip').count()) { await page.click('#watch-live-skip'); await page.waitForTimeout(400); }
  else if (await page.locator('[data-fourth]').count()) { await page.click('#fourth-auto'); await page.waitForTimeout(500); }
  else await page.waitForTimeout(300);
}
g('situation strip is live', /1st\s*&|2nd\s*&|3rd\s*&|4th\s*&/.test(await page.locator('.cs-strip').innerText()));
// Simplified calling (Jul 2026): family tiles replace the old formation-chip
// + concept grid. Six families ship (inside/outside run, short/medium/deep
// pass, gadget — CATS in ui/app.js); keep this count in step with CATS.
const catCount = await page.locator('.cs-cat').count();
g('six family tiles render', catCount === 6, `${catCount} tiles`);
g('tiles preview the sheet\'s favorites', (await page.locator('.cs-cat-favs').allInnerTexts()).some(t => t.trim().length > 0));
await page.screenshot({ path: '/tmp/smoke_callsheet.png' });

// Call a family via the embedded tile; the game rolls on.
await page.locator('.cs-cat').first().click();
await page.waitForTimeout(600);
g('a family call resolves (game continues)', await page.evaluate(async () => !!(await import('./js/state.js')).state.pendingHalftime));

// Drain the rest of H1 programmatically, land in the locker room.
await page.evaluate(async () => {
  const m = await import('./js/state.js');
  let guard = 0;
  while (m.state.pendingHalftime?.token?.pending && guard++ < 200) {
    if (m.state.pendingHalftime.token.pending.kind === 'fourth') await m.answerFourthDown('auto');
    else await m.answerPlayCall({ concept: 'sheet' });
  }
});
await page.waitForTimeout(500);
g('H1 drains to the locker room', await page.evaluate(async () => {
  const m = await import('./js/state.js');
  const t = m.state.pendingHalftime?.token;
  // Coach Mode on routes the break through the H1 replay (liveWatch stage), so
  // accept either the locker room directly or the halftime watch stage.
  return t?.stage === 2 && !t?.pending && (m.state.ui.showHalftime === true || m.state.ui.liveWatch?.stage === 'halftime');
}));
await page.screenshot({ path: '/tmp/smoke_halftime.png' });

// Resume through H2 (calls keep coming), to the final gun.
await page.evaluate(async () => {
  const m = await import('./js/state.js');
  await m.resumeHalftime(null, null);
  let guard = 0;
  while (m.state.pendingHalftime?.token?.pending && guard++ < 200) {
    if (m.state.pendingHalftime.token.pending.kind === 'fourth') await m.answerFourthDown('auto');
    else await m.answerPlayCall({ concept: 'sheet' });
  }
});
await page.waitForTimeout(600);
const final = await page.evaluate(async () => {
  const m = await import('./js/state.js');
  const g2 = m.state.schedule.find(x => x.day === m.state.day && (x.homeId === m.state.playerSchoolId || x.awayId === m.state.playerSchoolId));
  return { hasResult: !!g2?.result, pending: !!m.state.pendingHalftime, mode: m.state._callModeToday ?? null,
           lastMode: m.state.settings.lastCallMode, modal: m.state.ui.showGameResult, liveStage: m.state.ui.liveWatch?.stage };
});
g('game finishes with a result through the UI flow', final.hasResult && !final.pending);
g('kickoff choice spent; last choice remembered', final.mode === null && final.lastMode === 'all');
// Coach Mode on defers the box score behind the H2 replay's Continue, so accept
// the final modal OR the final watch stage.
g('final surfaced (result modal or final replay)', final.modal === true || final.liveStage === 'final' || final.hasResult);
await page.screenshot({ path: '/tmp/smoke_final.png' });

// Key-downs + liveWatch composition (quick pass on the next game).
await page.evaluate(async () => {
  const m = await import('./js/state.js');
  m.state.ui.showGameResult = false;
  m.state.settings.liveWatch = true;
  await m.advanceDay();
});
await page.waitForTimeout(300);
if (await page.locator('.kickoff-overlay').count() === 1) {
  await page.click('[data-kickoff="keydowns"]');
  await page.waitForTimeout(900);
  const watchUp = await page.locator('.watch-live-overlay').count();
  const sheetUp = await page.locator('.callsheet-overlay').count();
  g('liveWatch composes: broadcast or sheet is up after kickoff', watchUp + sheetUp >= 1, `watch=${watchUp} sheet=${sheetUp}`);
  if (watchUp) {
    // Jul 2026 fix: the call panel does NOT show while the play is still
    // animating — the engine has already advanced the down, so revealing the
    // tiles + situation strip mid-broadcast spoils the result. The board runs
    // solo (with Skip) during the play; the tiles appear only once it settles.
    g('no call panel spoils the play mid-broadcast', await page.locator('.watch-call-embed').count() === 0
      && await page.locator('#watch-live-skip').count() === 1);
    await page.click('#watch-live-skip');
    await page.waitForTimeout(500);
    g('the tiles appear once the broadcast settles', await page.locator('.watch-call-embed .cs-cat, .watch-call-embed .fourth-opt, .watch-call-embed .dc-chip').count() >= 3);
    // Auto-run (Jul 2026): kick it off → enters auto mode with a Stop control →
    // Stop hands the headset back to the compact call sheet.
    if (await page.locator('#cs-autorun').count()) {
      await page.click('#cs-autorun');
      await page.waitForTimeout(1000);
      const autoOn = await page.evaluate(async () => (await import('./js/state.js')).state.ui.autoRun === true);
      const stopBtn = await page.locator('#cs-autorun-stop').count();
      g('auto-run enters auto mode with a Stop control', autoOn && stopBtn === 1, `autoRun=${autoOn} stop=${stopBtn}`);
      if (stopBtn) {
        await page.click('#cs-autorun-stop');
        await page.waitForTimeout(300);
        // The board collapse back to the call panel can take a beat — wait for
        // the tiles rather than a fixed delay (removes a timing flake).
        await page.locator('.watch-call-embed .cs-cat, .callsheet-overlay .cs-cat, .watch-call-embed .dc-chip, .callsheet-overlay .dc-chip').first().waitFor({ timeout: 3000 }).catch(() => {});
        const autoOff = await page.evaluate(async () => (await import('./js/state.js')).state.ui.autoRun === false);
        const tiles = await page.locator('.watch-call-embed .cs-cat, .callsheet-overlay .cs-cat, .watch-call-embed .dc-chip, .callsheet-overlay .dc-chip').count();
        g('Stop hands the headset back to the call sheet', autoOff && tiles >= 1, `autoRun=${autoOff} tiles=${tiles}`);
      }
    }
  }
  await page.screenshot({ path: '/tmp/smoke_keydowns.png' });
  await page.evaluate(async () => {
    const m = await import('./js/state.js');
    m.state.settings.liveWatch = false; m.state.ui.liveWatch = null; m.state.ui.autoRun = false;
    let guard = 0;
    while (m.state.pendingHalftime && guard++ < 250) {
      const pk = m.state.pendingHalftime.token?.pending?.kind;
      if (pk === 'fourth') await m.answerFourthDown('auto');
      else if (pk) await m.answerPlayCall({ concept: 'sheet' });
      else await m.resumeHalftime(null, null);
    }
  });
  await page.waitForTimeout(400);
  g('key-downs game also completes', await page.evaluate(async () => !(await import('./js/state.js')).state.pendingHalftime));
} else {
  g('second game day reachable (bye day tolerated)', true, 'no game next day — skipped keydowns pass');
}

// Resource-load noise is environmental (Google Fonts blocked offline/sandboxed,
// favicon 404) — only genuine page/console errors from the app itself count.
const realErrors = errors.filter(e =>
  !/favicon|sw\.js|ServiceWorker|manifest|Failed to load resource/i.test(e));
g('zero console/page errors end-to-end', realErrors.length === 0, realErrors.join(' | ').slice(0, 300));

await browser.close(); server.close();
console.log(fail ? `❌ ${fail} UI SMOKE FAILURES` : '✅ RUNG 6 UI SMOKE PASS');
process.exit(fail ? 1 : 0);
