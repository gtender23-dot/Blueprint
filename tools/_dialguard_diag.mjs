// _dialguard_diag.mjs — one-shot diagnostic for phone_dial_guard_smoke's two
// depth-chart failures. NOT a gate; delete when the question is settled.
//
// The question: is the phone tap-to-edit guard BROKEN, or is the probe clicking
// coordinates that fall outside the 390x844 viewport?
//
// The probe does `center(plus)` -> `page.mouse.click(x, y)`, which clicks raw
// viewport coordinates. If the stepper sits below the fold that click lands on
// nothing, and the failure pattern is identical to a broken guard:
//   - "first tap doesn't change the value"  passes VACUOUSLY (nothing was hit)
//   - "enters editing state"                fails (no activate)
//   - "second tap changes the value"        fails (still nothing hit)
//
// Run: node tools/_dialguard_diag.mjs
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const body = await readFile(join(ROOT, rel));
    res.writeHead(200, { 'content-type': MIME[extname(rel)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, r));

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://127.0.0.1:' + server.address().port + '/index.html');
await page.waitForTimeout(650);

// The smoke's fixture, copied VERBATIM. An earlier version of this file stubbed
// it and the depth chart rendered with no team at all — 0 groups, which reads as
// "the guard is gone" when it actually means "there was nothing to guard".
await page.evaluate(async () => {
  const { state, rerender } = await import('./js/state.js');
  const { generateWorld, generateSchedule, generateRecruitPool } = await import('./js/engine/world.js');
  const { initBudget } = await import('./js/engine/recruiting.js');
  const { C } = await import('./js/constants.js');
  const world = generateWorld();
  world.recruits = generateRecruitPool(world);
  for (const school of world.schools) {
    if (!school.coach) continue;
    const seniors = school.roster.filter(player => player.classYear === 'SR').length;
    initBudget(school.coach, Math.max(0, C.ROSTER_SIZE - school.roster.length) + seniors);
  }
  const school = world.schools[0];
  const coach = {
    id: 'dial-guard-diag', schoolId: school.id, prestige: school.prestige,
    reputation: 'C', budget: 500000, scholarshipsAvailable: 20, recruitBoard: [],
    scouted: {}, budgetCarryover: 0, seasonRecord: { wins: 0, losses: 0 }, status: 'employed',
  };
  school.coach = coach;
  Object.assign(state, {
    initialized: true, season: 1, day: 8, playerSchoolId: school.id, playerCoach: coach,
    world, schedule: generateSchedule(world), playoffs: null,
    settings: { ...state.settings, gameplanMode: 'advanced' },
  });
  state.ui.view = 'gameplan';
  rerender();
});
await page.waitForTimeout(300);
// Navigate the way the smoke does. Setting state.ui.view directly is NOT
// equivalent — navigate() is the real entry point and does more than assign.
await page.evaluate(async () => {
  const { navigate } = await import('./js/state.js');
  navigate('depthchart');
});
await page.waitForTimeout(500);

const report = await page.evaluate(() => {
  const sel = '#view-root .fs-share, #view-root .fs-blitz, #view-root .do-carry';
  const groups = [...document.querySelectorAll(sel)];
  const vh = window.innerHeight, vw = window.innerWidth;
  // A bare zero told us nothing twice already. Say what IS on screen.
  if (!groups.length) {
    const root = document.querySelector('#view-root');
    const kids = root ? [...root.children].map(n => n.className || n.tagName).slice(0, 8) : null;
    const anySteppers = document.querySelectorAll('.fs-share, .fs-blitz, .do-carry').length;
    return {
      groups: 0,
      note: 'NO stepper matched inside #view-root',
      viewRootExists: !!root,
      viewRootChildren: kids ? kids.join(' | ') : '(no #view-root)',
      steppersAnywhereInDoc: anySteppers,
      activeView: (window.__state?.ui?.view) || '(unknown)',
      hint: anySteppers > 0
        ? 'steppers EXIST but not under #view-root — the selector, not the app'
        : 'no steppers rendered at all — wrong view, wrong tab, or no roster',
    };
  }
  const first = groups.find(g => g.getBoundingClientRect().width > 0);
  if (!first) return { groups: groups.length, note: 'groups found but none has a box' };
  const gb = first.getBoundingClientRect();
  const unlock = first.querySelector(':scope > .phone-dial-unlock');
  const ub = unlock?.getBoundingClientRect();
  const plus = first.querySelector('button[data-share-step="1"], button[data-blitz-step="1"], button[data-rbshare-step="1"]');
  const pb = plus?.getBoundingClientRect();
  const cx = pb ? pb.x + pb.width / 2 : null;
  const cy = pb ? pb.y + pb.height / 2 : null;
  const atPoint = (cx != null && cy >= 0 && cy <= vh) ? document.elementFromPoint(cx, cy) : null;
  return {
    viewport: `${vw}x${vh}`,
    pageHeight: Math.round(document.documentElement.scrollHeight),
    scrollY: Math.round(window.scrollY),
    groups: groups.length,
    groupClass: first.className,
    isGuard: first.classList.contains('phone-dial-guard'),
    hasUnlockChild: !!unlock,
    unlockBox: ub ? `${Math.round(ub.width)}x${Math.round(ub.height)} @ y=${Math.round(ub.y)}` : null,
    plusCentre: cx != null ? `x=${Math.round(cx)} y=${Math.round(cy)}` : null,
    plusInsideViewport: cy != null ? (cy >= 0 && cy <= vh) : null,
    elementAtClickPoint: atPoint ? (atPoint.className || atPoint.tagName) : '(outside viewport — mouse.click hits nothing)',
  };
});

console.log('\n— phone dial guard diagnostic —');
for (const [k, v] of Object.entries(report)) console.log(`  ${String(k).padEnd(22)} ${v}`);
console.log(`
VERDICT KEY
  isGuard=true + hasUnlockChild=true + plusInsideViewport=false
      -> the guard is FINE; the probe clicks coordinates below the fold.
         Fix the PROBE (use plus.click(), which auto-scrolls), not the app.
  isGuard=false or hasUnlockChild=false
      -> the guard genuinely failed to install. Fix the APP.
`);
await browser.close();
server.close();
