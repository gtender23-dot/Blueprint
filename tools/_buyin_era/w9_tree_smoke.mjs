// w9_tree_smoke.mjs — W9 §12: the tree in a REAL browser, on a REAL world.
//
// tree_probe.mjs proves the state machine against a three-school fixture. This
// proves the other half — that the machine is actually reachable, that the
// screens the player touches render it, and that a live world with a live
// schedule and live coordinators behaves the way the fixture said it would.
// The W8 precedent: a probe for the rules, a smoke for the room.
//
// It drives the SOURCE modules (index.html's native-ES-module path), not the
// bundle, so a failure points at a file you can edit.
//
// Run: node tools/w9_tree_smoke.mjs        (PW_CHROMIUM= to pick a browser)
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
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
let fails = 0;
const check = (ok, label, detail = '') => { if (!ok) fails++; console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`); };
const openView = async (view) => {
  await page.evaluate(async v => { const { navigate } = await import('./js/state.js'); navigate(v); }, view);
  await page.waitForTimeout(220);
};

try {
  await page.goto(`http://localhost:${server.address().port}/index.html`);
  await page.waitForTimeout(900);

  // ── 1. The menu ─────────────────────────────────────────────────────────
  check(await page.locator('#btn-mm-newtree').count() === 1, 'the main menu offers a tree beside the legacy coach list');
  await page.click('#btn-mm-newtree'); await page.waitForTimeout(200);
  await page.fill('#mm-nt-name', 'Smoke Grove');
  await page.click('#mm-nt-create'); await page.waitForTimeout(300);
  const home = await page.locator('.mm-actions').innerText();
  check(home.includes('SMOKE GROVE'), 'planting one opens its chair picker');
  check(await page.locator('[data-mm-tree-found]').count() === 1
     && await page.locator('.mm-tree-empty').count() === 2,
    'only the D3 trunk can be started from the menu — D1/D2 are filled from inside the world (growth rule 1)');

  // ── 2. A real world, seated the way state.js seats one ──────────────────
  // Built through the same public entry points the wizard uses, so this is
  // the real founding path with the wizard's clicking skipped.
  const planted = await page.evaluate(async () => {
    const { state, rerender } = await import('./js/state.js');
    const { generateWorld, generateSchedule, generateRecruitPool } = await import('./js/engine/world.js');
    const { initBudget } = await import('./js/engine/recruiting.js');
    const { C } = await import('./js/constants.js');
    const CP = await import('./js/engine/coachprofile.js');
    const T = await import('./js/engine/tree.js');
    const world = generateWorld();
    world.recruits = generateRecruitPool(world);
    for (const s of world.schools) {
      if (!s.coach) continue;
      const sr = s.roster.filter(p => p.classYear === 'SR').length;
      initBudget(s.coach, Math.max(0, C.ROSTER_SIZE - s.roster.length) + sr, 0, s);
    }
    const tree = CP.listTrees()[0];
    const prof = CP.createCoach('Smoke', 'Founder', { treeId: tree.id });
    const d3 = world.schools.find(s => s.division === 'D3' && s.staff?.oc && s.staff?.dc);
    Object.assign(state, {
      initialized: true, season: 4, day: 9, playerSchoolId: d3.id, world,
      schedule: generateSchedule(world), playoffs: null, inbox: [], coachHistory: [],
      rivalry: null, jobOpenings: [], tree: null,
      playerCoach: { id: 'smoke-hc', name: { first: 'Smoke', last: 'Founder' }, isAI: false,
        schoolId: d3.id, prestige: d3.prestige, reputation: 'C', budget: 200000,
        scholarshipsAvailable: 12, recruitBoard: [], scouted: {}, budgetCarryover: 0,
        promises: [], seasonRecord: { wins: 0, losses: 0 }, careerWins: 21, careerLosses: 15,
        titles: 0, jobSecurity: 62, status: 'employed', tenureSeasons: 4 },
    });
    d3.coach = state.playerCoach;
    state._coachId = prof.id;
    state._treeId = tree.id;
    state._saveSlot = CP.treeWorldKey(tree.id);
    T.foundTree(state, { treeId: tree.id, coachId: prof.id });
    state.ui.view = 'dashboard';
    rerender();
    return { treeId: tree.id, d3: d3.name, active: state.tree.active, slots: T.liveSlots(state).length };
  });
  check(planted.active === 'D3' && planted.slots === 1,
    `the trunk seats in D3 on a live 300+ school world (${planted.d3})`);

  // ── 3. One slot = the pre-W9 game ───────────────────────────────────────
  check(await page.locator('.tree-agenda').count() === 0,
    'a one-chair tree shows NO agenda — a solo tree is the career it replaces');
  const advancedSolo = await page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    const { advanceDay } = await import('./js/engine/season.js');
    const before = state.day;
    advanceDay(state, () => {});
    return { before, after: state.day };
  });
  check(advancedSolo.after > advancedSolo.before,
    `and the week advances normally (day ${advancedSolo.before} → ${advancedSolo.after})`);

  // ── 4. Grow a branch: promote a coordinator into an open division ───────
  const promoted = await page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    const T = await import('./js/engine/tree.js');
    const { gradeIndexFromXP } = await import('./js/engine/coach.js');
    const { coordinatorCredentials } = await import('./js/engine/staff.js');
    const { C } = await import('./js/constants.js');
    const me = state.world.schools.find(s => s.id === state.playerSchoolId);
    const target = state.world.schools.find(s => s.division === 'D2');
    // Give him the service record a real four-year assistant would have, so
    // the conversion has something to convert. (recordUnitGrades writes this
    // every rollover for the player's staff — this is four of those.)
    const oc = me.staff.oc;
    oc.seasons = 4;
    oc.ledger = [1, 2, 3, 4].map(season => ({ season, units: { QB: 'B+', RB: 'B+', REC: 'A-', OL: 'B' } }));
    const cred = coordinatorCredentials(oc);
    const res = T.promoteCoordinatorToHC(state, {
      sourceSchoolId: me.id, side: 'oc', targetSchoolId: target.id, takeControl: false,
    });
    const hc = target.coach;
    return {
      ok: res.ok, reason: res.reason, name: res.name, at: res.schoolName,
      stillMine: state.playerSchoolId === me.id,
      slots: T.liveSlots(state).length,
      credDev: cred.startingLevels.developer,
      devIdx: hc ? gradeIndexFromXP(hc.skills.developer.xp) : null,
      backfilled: me.staff.oc.id !== oc.id,
      seat: hc?.jobSecurity ?? null,
      promoteSeat: C.TREE.PROMOTE_JOBSEC,
    };
  });
  check(promoted.ok, `a real coordinator takes a real D2 job: ${promoted.name} → ${promoted.at}`, promoted.reason || '');
  check(promoted.slots === 2 && promoted.stillMine, 'the branch exists and control did NOT move (apply-down shape)');
  // The assertion is the RELAY, not a number: whatever staff.js says his record
  // is worth, that is exactly what he walks in with. (A coordinator hired this
  // morning is worth nothing yet, and should be — the levels are a service
  // record, so a man with no service has no credentials.)
  check(promoted.devIdx === promoted.credDev,
    `his credentials land on the live skill ladder unchanged (developer level ${promoted.credDev} → grade index ${promoted.devIdx})`);
  check(promoted.seat === promoted.promoteSeat,
    'and he opens on the promoted-coach seat, not a stranger\'s');

  // ── 5. LOCKSTEP, on a real schedule ─────────────────────────────────────
  const lock = await page.evaluate(async () => {
    const { state, rerender } = await import('./js/state.js');
    const T = await import('./js/engine/tree.js');
    const { advanceDay, resumeFromHalftime } = await import('./js/engine/season.js');
    // The player's OWN game pauses at halftime — that is the Chunk-12 gate, not
    // this wave's. Play through it so the only thing under test here is the
    // lockstep gate. (Same pattern as w8_wants_smoke's season walk.)
    const step = () => {
      const ev = advanceDay(state, () => {});
      let hops = 0;
      while (state.pendingHalftime && hops++ < 60) {
        try { resumeFromHalftime(state); } catch { break; }
      }
      return ev;
    };
    // Walk to a week where the branch actually has a game, resolving as we go.
    let rows = [], guard = 0;
    while (!rows.length && guard++ < 12) {
      state.tree.agenda = { season: null, day: null, rows: [] };
      T.refreshAgenda(state);
      rows = T.agendaRows(state);
      if (rows.length) break;
      T.softFinalizeAll(state);
      step();
    }
    const before = state.day;
    const blocked = T.lockstepBlock(state);
    step();
    const stuck = state.day === before;
    T.softFinalizeAll(state);
    const cleared = T.lockstepBlock(state) === null;
    step();
    const moved = state.day > before;
    state.ui.view = 'dashboard';
    rerender();
    return { rows: rows.length, blocked: !!blocked, msg: blocked, stuck, cleared, moved,
             day: state.day, halted: !!state.pendingHalftime };
  });
  check(lock.rows > 0, `the branch's real game becomes an agenda row (${lock.rows})`);
  check(lock.blocked && lock.stuck, 'the week REFUSES to move while it is pending (T1)', lock.msg?.slice(0, 60));
  check(lock.cleared && lock.moved, `soft-finalizing clears it and the week moves (now day ${lock.day})`);

  // ── 6. The screens ──────────────────────────────────────────────────────
  // Walk to a week the branch actually plays, so the DOM assertion below is
  // deterministic rather than hostage to a bye.
  const onGameWeek = await page.evaluate(async () => {
    const { state, rerender } = await import('./js/state.js');
    const T = await import('./js/engine/tree.js');
    const { advanceDay, resumeFromHalftime } = await import('./js/engine/season.js');
    let guard = 0;
    for (;;) {
      state.tree.agenda = { season: null, day: null, rows: [] };
      T.refreshAgenda(state);
      if (T.agendaRows(state).length || guard++ >= 12) break;
      T.softFinalizeAll(state);
      advanceDay(state, () => {});
      let hops = 0;
      while (state.pendingHalftime && hops++ < 60) { try { resumeFromHalftime(state); } catch { break; } }
    }
    state.ui.view = 'dashboard';
    rerender();
    return T.agendaRows(state).length;
  });
  await page.waitForTimeout(250);
  check(onGameWeek > 0 && await page.locator('.tree-agenda').count() === 1,
    'the dashboard renders the agenda on a week the branch plays');
  const agendaText = await page.locator('.tree-agenda').innerText().catch(() => '');
  check(/Take over/i.test(agendaText) && /Soft finalize/i.test(agendaText),
    'and it offers both doors §12 names — take over, or accept the pending result');
  check(/can't move until/i.test(agendaText),
    'and says plainly why the week is stuck');

  await openView('coachoffice');
  const office = await page.locator('.tree-card').innerText().catch(() => '');
  check(!!office, 'the coach\'s office renders the tree panel');
  check(/D2/.test(office) && /D3/.test(office), 'with a row per division — the chair picker');
  check(await page.locator('[data-tree-switch]').count() >= 1, 'and a live door into the other chair');
  check(/THE HARVEST/.test(office), 'the harvest section is present');
  check(await page.locator('#tree-retire[disabled]').count() === 1,
    'retirement is DISABLED mid-season — T5 says the wrap-up (and the screen says why)');

  // ── 7. Switching chairs actually moves you ──────────────────────────────
  await page.click('[data-tree-switch]'); await page.waitForTimeout(500);
  const switched = await page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    const school = state.world.schools.find(s => s.id === state.playerSchoolId);
    return { active: state.tree.active, division: school?.division, name: school?.name,
             coach: `${state.playerCoach?.name?.first} ${state.playerCoach?.name?.last}`,
             isMe: school?.coach === state.playerCoach };
  });
  check(switched.active === switched.division,
    `you are now the ${switched.division} coach (${switched.coach} at ${switched.name})`);
  check(switched.isMe, 'and state.playerCoach IS that school\'s coach object — no stale pointer');

  // ── 8. The world save carries it ────────────────────────────────────────
  const round = await page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    const { exportString, importJSON } = await import('./js/engine/persistence.js');
    const T = await import('./js/engine/tree.js');
    const back = importJSON(exportString(state));
    return { hasTree: !!back?.tree, slots: T.liveSlots(back).length, active: back?.tree?.active };
  });
  check(round.hasTree && round.slots === 2 && round.active === switched.active,
    'the whole tree round-trips through a real export/import intact');

  check(errors.length === 0, `no console errors (${errors.length})`, errors.slice(0, 2).join(' | '));
} catch (e) {
  fails++;
  console.log('❌ threw:', e.message);
} finally {
  await browser.close();
  server.close();
}
console.log(fails ? `\n${fails} FAILED` : '\nPASS — the tree is reachable, playable, gated and saveable on a live world.');
process.exit(fails ? 1 : 0);
