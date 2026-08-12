// Focused regression for the phone schedule card.
// Uses deliberately long school names and completed-game result controls at the
// narrowest supported widths so matchup text and results can never cover each other.
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
await mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const expectedOpponentNames = [
  'Southern Appalachian Polytechnic Institute',
  'University of North Central Commonwealth',
  'Eastern Intermountain Agricultural College',
];
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let fails = 0;
const check = (ok, label, detail = '') => {
  if (!ok) fails++;
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
};

try {
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForTimeout(800);
  await page.evaluate(async () => {
    const { state, navigate } = await import('./js/state.js');
    const { generateWorld } = await import('./js/engine/world.js');
    const world = generateWorld();
    const me = world.schools[0], a = world.schools[1], b = world.schools[2], c = world.schools[3];
    me.name = 'University of Northwestern Chesapeake';
    a.name = 'Southern Appalachian Polytechnic Institute';
    b.name = 'University of North Central Commonwealth';
    c.name = 'Eastern Intermountain Agricultural College';
    me.record = { wins: 2, losses: 1, confWins: 1, confLosses: 0 };
    a.record = { wins: 3, losses: 0, confWins: 1, confLosses: 0 };
    b.record = { wins: 2, losses: 1, confWins: 0, confLosses: 1 };
    c.record = { wins: 1, losses: 2, confWins: 0, confLosses: 1 };
    const stats = (rushYds, passYds) => ({ rushYds, passYds });
    const result = (home, away, hs, as, homeStats, awayStats) => ({
      winner: hs > as ? home.id : away.id,
      homeScore: hs, awayScore: as, homeStats, awayStats,
      homeSchool: home, awaySchool: away, drives: [], log: [],
      homePlayerStats: {}, awayPlayerStats: {}, playerNames: {},
    });
    Object.assign(state, {
      initialized: true, season: 4, day: 8, world, playerSchoolId: me.id,
      playerCoach: me.coach,
      schedule: [
        { id:'phone-1', day:5, homeId:me.id, awayId:a.id,
          result:result(me, a, 31, 28, stats(188, 246), stats(121, 315)) },
        { id:'phone-2', day:6, homeId:b.id, awayId:me.id,
          result:result(b, me, 17, 24, stats(140, 199), stats(205, 230)) },
        { id:'phone-3', day:8, homeId:me.id, awayId:c.id, result:null },
      ],
    });
    navigate('schedule');
  });
  await page.waitForTimeout(250);

  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const report = await page.evaluate(() => {
      const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const cards = [...document.querySelectorAll('.game-card')].map(card => {
        const matchup = card.querySelector('.game-card-matchup');
        const result = card.querySelector('.game-card-result');
        const opp = card.querySelector('.opp-team');
        const oppName = (opp?.textContent || '').replace(/^#\d+\s*/, '').trim();
        const occurrences = oppName
          ? ((card.innerText || '').match(new RegExp(oppName.replace(/[.*+?^${\}()|[\]\\]/g, '\\$&'), 'g')) || []).length
          : 0;
        const cr = card.getBoundingClientRect();
        const mr = matchup?.getBoundingClientRect();
        const rr = result?.getBoundingClientRect();
        return {
          overlap: !!(mr && rr && intersects(mr, rr)),
          resultInside: !rr || (rr.left >= cr.left - 1 && rr.right <= cr.right + 1),
          opponentName: oppName,
          opponentOccurrences: occurrences,
          myTeamVisible: getComputedStyle(card.querySelector('.my-team')).display !== 'none',
        };
      });
      return {
        scheduleVisible: !!document.querySelector('.view-schedule'),
        docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        cards,
      };
    });
    check(report.scheduleVisible && report.cards.length === 3,
      `${width}px renders all schedule cards`, `${report.cards.length} found`);
    check(!report.docOverflow, `${width}px has no page overflow`);
    check(report.cards.every(c => !c.overlap), `${width}px matchup and result rows never overlap`);
    check(report.cards.every(c => c.resultInside), `${width}px result controls remain inside each card`);
    check(report.cards.every(c => c.opponentOccurrences <= 1), `${width}px opponent is printed once`);
    check(report.cards.every((c, i) => c.opponentName === expectedOpponentNames[i]),
      `${width}px home and away cards show the correct opponent`);
    check(report.cards.every(c => !c.myTeamVisible), `${width}px phone card reserves its matchup row for the opponent`);
    await page.screenshot({ path: join(SHOTS, `schedule_phone_${width}.png`), fullPage: true });
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  const desktop = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    myTeamVisible: [...document.querySelectorAll('.game-card .my-team')]
      .every(e => getComputedStyle(e).display !== 'none'),
  }));
  check(!desktop.overflow && desktop.myTeamVisible, 'desktop schedule retains the full matchup');
  check(errors.length === 0, 'zero page errors', errors.slice(0, 2).join(' | '));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log(fails ? `\nFAIL — ${fails} schedule phone check(s)` : '\nSCHEDULE PHONE SMOKE PASS');
process.exit(fails ? 1 : 0);
