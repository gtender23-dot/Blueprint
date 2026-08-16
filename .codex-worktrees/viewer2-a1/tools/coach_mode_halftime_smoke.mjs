// coach_mode_halftime_smoke.mjs — Coach Mode at the half: the locker room shows
// a Coach Mode toggle; OFF labels the resume button "Sim to Final" and sims the
// 2nd half straight (headset silenced), ON labels it "Start 2nd Half". Also
// pins the pregame "Sim to Halftime" entry when Coach Mode is off.
// Run: node tools/coach_mode_halftime_smoke.mjs
import { chromium } from 'playwright-core';
import http from 'http';
import { readFile } from 'fs/promises';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';

// fileURLToPath, not .pathname — .pathname on Windows is "/C:/…", which join() mangles.
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
page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
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
  state.settings.liveWatch = false;   // Coach Mode OFF
  state.ui.view = 'dashboard';
  rerender();
});
await page.waitForTimeout(400);

// Kickoff prompt with Coach Mode OFF → headset modes hidden, Sim-to-Halftime up.
await page.evaluate(async () => { const m = await import('./js/state.js'); await m.advanceDay(); });
await page.waitForTimeout(300);
g('Coach Mode OFF pregame → Sim to Halftime button (no headset modes)',
  await page.locator('#kickoff-sim-half').count() === 1 && await page.locator('[data-kickoff]').count() === 0);

// Sim the first half; land in the locker room.
await page.click('#kickoff-sim-half');
await page.waitForTimeout(500);
await page.evaluate(async () => {
  const m = await import('./js/state.js');
  let guard = 0;
  while (m.state.pendingHalftime?.token?.pending && guard++ < 200) {
    if (m.state.pendingHalftime.token.pending.kind === 'fourth') await m.answerFourthDown('auto');
    else await m.answerPlayCall({ concept: 'sheet' });
  }
});
await page.waitForTimeout(400);
g('reached the halftime locker room', await page.evaluate(async () =>
  (await import('./js/state.js')).state.ui.showHalftime === true));

// The locker room shows the Coach Mode toggle; OFF → "Sim to Final".
g('halftime shows the Coach Mode toggle', await page.locator('#ht-coachmode').count() === 1);

// G3 (Aug 2026): Protect the QB + Shadow chips joined the original three.
// Shadow only renders when a hot receiver exists, so 4 is the floor.
g('halftime offers the G3 adjustment chips (protect + up to shadow)',
  await page.locator('[data-ht-adj]').count() >= 4
  && await page.locator('[data-ht-adj="protect"]').count() === 1);
await page.click('[data-ht-adj="protect"]');
await page.waitForTimeout(250);
g('the Protect chip arms (active state)', await page.locator('[data-ht-adj="protect"].active').count() === 1);
if (await page.locator('[data-ht-adj="shadow"]').count()) {
  await page.click('[data-ht-adj="shadow"]');
  await page.waitForTimeout(250);
  g('the Shadow chip swaps in and carries its target id',
    await page.locator('[data-ht-adj="shadow"].active').count() === 1
    && !!(await page.locator('[data-ht-adj="shadow"]').getAttribute('data-ht-adj-id')));
}

// Mobile trim (Jul 2026): only Adjustments / Situations / Box Score; Depth Chart
// and Play-by-Play removed. Plan Report folded to the top of Situations.
g('halftime has 3 tabs (depth + play-by-play removed)',
  await page.locator('.result-tab[data-halftime-tab]').count() === 3
  && await page.locator('[data-halftime-tab="depth"], [data-halftime-tab="pbp"], [data-halftime-tab="report"]').count() === 0);
await page.click('[data-halftime-tab="situations"]');
await page.waitForTimeout(250);
g('Situations tab leads with the Plan Report', await page.locator('.ht-plan-report').count() === 1);
const labelOff = (await page.locator('#btn-resume-halftime').innerText()).toUpperCase();
g('Coach Mode OFF → resume reads "Sim to Final"', /SIM TO FINAL/.test(labelOff), labelOff);

// Flip Coach Mode ON at the half → label becomes "Start 2nd Half".
await page.click('#ht-coachmode');
await page.waitForTimeout(250);
const labelOn = (await page.locator('#btn-resume-halftime').innerText()).toUpperCase();
g('Coach Mode ON → resume reads "Start 2nd Half"', /START 2ND HALF/.test(labelOn), labelOn);

// Flip back OFF and sim to the final — game completes.
await page.click('#ht-coachmode');
await page.waitForTimeout(200);
await page.click('#btn-resume-halftime');
await page.waitForTimeout(500);
await page.evaluate(async () => {
  const m = await import('./js/state.js');
  let guard = 0;
  while (m.state.pendingHalftime && guard++ < 250) {
    const pk = m.state.pendingHalftime.token?.pending?.kind;
    if (pk === 'fourth') await m.answerFourthDown('auto');
    else if (pk) await m.answerPlayCall({ concept: 'sheet' });
    else await m.resumeHalftime(null, null);
  }
});
await page.waitForTimeout(400);
g('Sim to Final completes the game', await page.evaluate(async () => {
  const m = await import('./js/state.js');
  const g2 = m.state.schedule.find(x => x.day === m.state.day && (x.homeId === m.state.playerSchoolId || x.awayId === m.state.playerSchoolId));
  return !!g2?.result && !m.state.pendingHalftime;
}));

const realErrors = errors.filter(e => !/favicon|sw\.js|ServiceWorker|manifest|Failed to load resource/i.test(e));
g('zero console/page errors', realErrors.length === 0, realErrors.join(' | ').slice(0, 200));

await browser.close(); server.close();
console.log(fail ? `❌ ${fail} COACH-MODE HALFTIME SMOKE FAILURES` : '✅ COACH-MODE HALFTIME SMOKE PASS');
process.exit(fail ? 1 : 0);
