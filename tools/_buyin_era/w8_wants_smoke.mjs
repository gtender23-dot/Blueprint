// w8_wants_smoke.mjs — does THE PITCH actually turn?
//
// wants_probe.mjs pins every piece of §13 in isolation. This drives real
// seasons in a real browser and asserts the pieces are WIRED TO EACH OTHER,
// the way the wave draws it:
//
//   a recruit is generated with wants that come from HIS profile
//     → the board reads them through your Evaluator, with the fog on
//       → your program's own receipts (W7's measures, W6's development
//         record, W5's contextual OVR) decide what your dollars are worth
//         → you promise him playing time and a role
//           → he signs, and the promise rides onto the man
//             → the season plays, and at the end the promise COMES DUE:
//               his Buy-In moves, and your word goes in the ledger
//
// Everything here has to be true in a live calendar, not a unit fixture: the
// migration running on a real pool, the promise surviving conversion into a
// player, settlement firing at the right point in end-of-season ordering, and
// the recruiting screens rendering the new panels without a console error.
//
// Run: node tools/w8_wants_smoke.mjs [seasons]   (PW_CHROMIUM optional)
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
page.on('console', m => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (/Failed to load resource|ERR_TUNNEL|favicon/i.test(t)) return;
  errors.push(`console: ${t}`);
});
let fail = 0;
const g = (n, ok, d = '') => { if (!ok) fail++; console.log(`${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`); };

await page.goto(`http://localhost:${port}/index.html`);
await page.waitForTimeout(900);

const SEASONS = parseInt(process.argv[2] || '3', 10);

const out = await page.evaluate(async (SEASONS) => {
  const { state, rerender } = await import('./js/state.js');
  const { generateWorld, generateSchedule, generateRecruitPool } = await import('./js/engine/world.js');
  const { advanceDay, resumeFromHalftime } = await import('./js/engine/season.js');
  const { createCoach } = await import('./js/engine/coachprofile.js');
  const { C } = await import('./js/constants.js');
  const R = await import('./js/engine/recruiting.js');
  const { characterRating } = await import('./js/engine/player.js');

  localStorage.removeItem('cfb-coaches-v1');
  const profile = createCoach('Wants', 'Smoke');

  const world = generateWorld(); world.recruits = generateRecruitPool(world);
  const ps = world.schools.filter(s => s.division === 'D1').sort((a, b) => b.prestige - a.prestige)[0];
  const coach = { id: 'wants', schoolId: ps.id, prestige: ps.prestige, budget: 900000,
    scholarshipsAvailable: 25, recruitBoard: [], scouted: {}, seasonRecord: { wins: 0, losses: 0 },
    skills: (await import('./js/engine/coach.js')).freshSkills(),
    status: 'employed', tenureSeasons: 0 };
  Object.assign(state, {
    initialized: true, season: 1, day: 1, playerSchoolId: ps.id, playerCoach: coach,
    _coachId: profile.id, _worldSlot: 1, world, schedule: generateSchedule(world),
    playoffs: null, coachHistory: [], awardsLog: [],
  });
  ps.coach = coach;
  state.settings.liveWatch = false;
  rerender();

  const seen = { halted: null };

  // ── 1. The pool: wants exist, come from profiles, and the mirror is synced ──
  const pool = world.recruits;
  const mix = {}; for (const t of C.WANTS.TYPES) mix[t] = 0;
  let wantless = 0, mirrorBad = 0, dupes = 0;
  for (const r of pool) {
    const ws = R.wantsFor(r);
    if (!ws.length) wantless++;
    const keys = ws.map(R.wantKey);
    if (new Set(keys).size !== keys.length) dupes++;
    for (const k of keys) mix[k]++;
    const pt = ws.find(w => R.wantKey(w) === 'PLAYING_TIME');
    if (pt ? r.ptWant !== pt.importance : r.ptWant !== null) mirrorBad++;
  }
  seen.poolN = pool.length; seen.mix = mix; seen.wantless = wantless;
  seen.mirrorBad = mirrorBad; seen.dupes = dupes;
  // The §13 pairing, measured on the REAL pool rather than a fixture.
  const egoKids = pool.filter(r => r.character?.ego);
  const rest = pool.filter(r => !r.character?.ego);
  const shareOf = (arr, t) => arr.filter(r => R.wantsFor(r).some(w => R.wantKey(w) === t)).length / (arr.length || 1);
  seen.egoSpot = shareOf(egoKids, 'SPOTLIGHT'); seen.plainSpot = shareOf(rest, 'SPOTLIGHT');

  // ── 2. The board: the fog is on, and scouting lifts it ────────────────────
  // The headliner is picked to be PITCHABLE, not just good: a position your
  // system has a role dial for (OL/TE/OLB) and a want a promise can answer.
  // ...and pitchable means the promise has HEADROOM: a kid your depth chart or
  // your scheme already answers completely cannot be sold anything.
  const promisable = (r) => R.wantsFor(r)
    .filter(w => ['PLAYING_TIME', 'ROLE'].includes(R.wantKey(w)))
    .some(w => R.wantScore(w, coach, ps, r, null) < 0.85);
  const pitchable = pool.filter(r =>
    R.calibreVisible(r, ps.division) && !r.committed && C.ROLE_DIALS?.[r.position] && promisable(r));
  const target = (pitchable.length ? pitchable : pool.filter(r => R.calibreVisible(r, ps.division) && !r.committed))
    .sort((a, b) => (b.compositeRating || 0) - (a.compositeRating || 0))[0];
  seen.fogged = R.scoutedCharacter(coach, target)?.fogged === true;
  seen.foggedRead = characterRating({ character: R.scoutedCharacter(coach, target) });
  seen.wantsHiddenAtF = R.wantsVisible(coach, target) === false;

  // ── 3. The pitch: build a board, scout, promise, and buy him ──────────────
  const entry = R.createBoardEntry(target, ps.id);
  coach.recruitBoard.push(entry);
  R.takeAction(coach, target, entry, 'scout', state.day, ps);
  seen.truthAfterScout = R.scoutedCharacter(coach, target)?.fogged === false;
  seen.wantsVisibleAfterScout = R.wantsVisible(coach, target);
  seen.trueRead = characterRating({ character: R.scoutedCharacter(coach, target) });

  seen.targetName = `${target.name.first} ${target.name.last}`;
  seen.targetPos = target.position;
  seen.targetId = target.id;

  R.takeAction(coach, target, entry, 'offer', state.day, ps);
  R.setContactAlloc(entry, C.CONTACT_WEEKLY_CAP);
  // Everyone else on the board gets money too, so the class is real.
  for (const r of pool.filter(x => R.calibreVisible(x, ps.division) && !x.committed).slice(0, 28)) {
    if (r.id === target.id) continue;
    const e = R.createBoardEntry(r, ps.id);
    coach.recruitBoard.push(e);
    R.takeAction(coach, r, e, 'offer', state.day, ps);
    R.setContactAlloc(e, Math.round(C.CONTACT_WEEKLY_CAP * 0.5));
  }

  // ── 4. Live the calendar ──────────────────────────────────────────────────
  for (let s = 0; s < SEASONS; s++) {
    for (let guard = 0; guard < 400; guard++) {
      if (state.season > SEASONS) break;
      if (state.playerCoach) { state.playerCoach.jobSecurity = 100; state.playerCoach._onNotice = false; }
      let events = [];
      try { events = advanceDay(state) || []; } catch (e) { seen.halted = `${e.message} (S${state.season} D${state.day})`; break; }
      if (state.pendingHalftime) {
        let hops = 0;
        while (state.pendingHalftime && hops++ < 60) {
          try { resumeFromHalftime(state); } catch (e) { seen.halted = `resume: ${e.message}`; break; }
          if (state.pendingHalftime?.token?.pending) { seen.halted = 'token froze'; break; }
        }
        if (seen.halted) break;
      }
      if (state.offseason && !state.offseason.done) {
        const { advanceOffseasonStage } = await import('./js/engine/offseason.js');
        for (let k = 0; k < 40 && state.offseason && !state.offseason.done; k++) advanceOffseasonStage(state);
      }
      if (state.forcedShortlist?.length) { seen.halted = 'fired'; break; }
      if (state.season > SEASONS) break;
    }
    if (seen.halted || state.season > SEASONS) break;
  }

  // ── 5. The contract landed on the man, and it was settled ─────────────────
  const school = state.world.schools.find(x => x.id === state.playerSchoolId);
  seen.arrivals = (school.roster || []).filter(p => p.arrivalComposite != null).length;
  seen.arrivalsReturning = (school.roster || []).filter(p => p.arrivalComposite != null && p.classYear !== 'FR').length;
  const signed = (school.roster || []).find(p => p.id === seen.targetId);
  seen.targetSigned = !!signed;
  seen.targetBuyIn = signed?.buyIn ?? null;

  // THE REMOVAL CHECK: nothing anywhere in the league still carries promise
  // data. A half-removed system that leaves live fields behind is the failure
  // this guards.
  {
    const bad = [];
    for (const sc of state.world.schools) {
      if (sc.coach?.honesty) { bad.push(`honesty ledger on ${sc.id}`); break; }
      const held = (sc.roster || []).find(p => p.promises);
      if (held) { bad.push(`promises on ${sc.id} roster`); break; }
    }
    seen.anyPromiseData = bad.length ? bad.join(', ') : null;
  }

  // ── 7. The measures the wants read are alive on a real program ────────────
  R.resetWantCache();
  seen.scores = Object.fromEntries(C.WANTS.TYPES.map(t =>
    [t, Math.round(R.wantScore(t, state.playerCoach, school, target) * 100) / 100]));
  seen.devRecord = (() => { const d = R.developmentRecord(school, state.playerCoach);
    return { score: Math.round(d.score * 100) / 100, growth: d.growth == null ? null : Math.round(d.growth * 100) / 100, n: d.n }; })();

  seen.season = state.season;
  return seen;
}, SEASONS);

// ── 8. The screens actually render the new panels ──────────────────────────
const uiSetup = await page.evaluate(async () => {
  const { state, navigate, rerender } = await import('./js/state.js');
  const R = await import('./js/engine/recruiting.js');
  const { C } = await import('./js/constants.js');
  try {
  // Put a live, scouted recruit back on the board so the screens have something
  // real to draw (the smoke's own class already signed).
  const school = state.world.schools.find(x => x.id === state.playerSchoolId);
  const open = state.world.recruits.filter(r => !r.committed && R.calibreVisible(r, school.division));
  const pick = open.find(r => C.ROLE_DIALS?.[r.position]) || open[0];
  if (pick) {
    const e = R.createBoardEntry(pick, school.id);
    state.playerCoach.recruitBoard.push(e);
    state.playerCoach.scouted = state.playerCoach.scouted || {};
    state.playerCoach.scouted[pick.id] = true;
    state._smokePick = pick.id;
  }
  navigate('recruiting'); rerender();
  return { ok: true, board: state.playerCoach.recruitBoard.length, pick: state._smokePick || null };
  } catch (e) { return { ok: false, err: e.message }; }   // ok:false ⇒ the UI assertions below WILL read empty; check err first
});
await page.waitForTimeout(300);
// Board tab, in the real DOM.
const tabClicked = await page.evaluate(() => {
  const els = [...document.querySelectorAll('button, .tab-btn, [data-tab], .rec-tab')];
  const b = els.find(el => /^board/i.test((el.textContent || '').trim()));
  if (b) { b.click(); return b.className || b.tagName; }
  return null;
});
await page.waitForTimeout(400);
const boardHtml = await page.evaluate(() => document.body.innerHTML);
// Profile, via the real "Profile →" button.
//
// [Aug 2026 FIX] This used to take the FIRST profile button on the board, then
// assert roleButtons > 0 a few lines down. Only OL, TE and OLB have a role
// catalog (C.ROLE_DIALS), so that assertion passed only when the top of a
// randomly-generated board happened to be one of those three — it failed on
// most seeds, for a reason that had nothing to do with the code under test.
// A gate that cries wolf on most runs gets ignored, which is worse than no gate.
// Now: prefer a card whose position actually HAS roles, and fall back to the
// first one so the rest of the panel is still exercised on a board without any.
const profilePicked = await page.evaluate(() => {
  // The war card is .board-card; its position sits in a .pos-chip.
  const ROLE_POS = ['OL', 'TE', 'OLB'];
  const posOf = (card) => card?.querySelector('.pos-chip')?.textContent?.trim() || '';
  const cards = [...document.querySelectorAll('.board-card')];
  const match = cards.find(c => ROLE_POS.includes(posOf(c)) && c.querySelector('.view-profile-btn'));
  const btn = (match && match.querySelector('.view-profile-btn'))
    || document.querySelector('.view-profile-btn');
  if (!btn) return null;
  const label = posOf(btn.closest('.board-card')) || '?';
  btn.click();
  return { pos: label, targeted: !!match, cards: cards.length };
});
await page.waitForTimeout(300);
const profileHtml = await page.evaluate(() => document.body.innerHTML);
const ui = {
  wantTags: (boardHtml.match(/want-tag/g) || []).length,
  promiseChip: /promise-chip/.test(boardHtml),
  wantPanel: /want-panel/.test(profileHtml),
  wantRows: (profileHtml.match(/want-row-name/g) || []).length,
  promiseCard: /promise-card/.test(profileHtml),
  honestyChip: /honesty-chip/.test(profileHtml),
  roleButtons: (profileHtml.match(/data-promise-role=/g) || []).length,
  hasBoard: /RECRUIT|Board|Search/i.test(boardHtml),
  setup: uiSetup, tabClicked,
};

const S = out;
console.log(`\n— ran to season ${S.season}${S.halted ? ` (HALTED: ${S.halted})` : ''}\n`);

g('W1 the calendar ran clean through the seasons', !S.halted, S.halted || `S${S.season}`);
g('W2 §13 every recruit in a live pool carries wants, no dupes, mirror in sync',
  S.wantless === 0 && S.dupes === 0 && S.mirrorBad === 0,
  `${S.poolN} recruits · ${S.wantless} wantless · ${S.dupes} dupes · ${S.mirrorBad} mirror breaks`);
g('W3 §13 all seven wants appear on the real pool',
  Object.values(S.mix).every(v => v > 0),
  Object.entries(S.mix).map(([k, v]) => `${k.slice(0, 4)} ${Math.round(v / S.poolN * 100)}%`).join(' '));
g('W4 §13 the PROFILE is what draws the want (Ego → the spotlight, on live data)',
  S.egoSpot > S.plainSpot * 1.4,
  `${Math.round(S.egoSpot * 100)}% of divas vs ${Math.round(S.plainSpot * 100)}% of everyone else`);
g('W5 §13 the fog is ON pre-scout and the scout lifts it to the truth',
  S.fogged && S.truthAfterScout && S.wantsHiddenAtF && S.wantsVisibleAfterScout,
  `character read ${S.foggedRead} through an F Evaluator → ${S.trueRead} once scouted`);
// [Aug 2026 — Garrett] W6–W10 tested the promise system (the pitch moving the
// money, the contract riding onto the signee, the settlement, the honesty
// ledger, and AI inertness). All removed with the system. What replaces them is
// one assertion that it is genuinely GONE rather than half-wired — a removal
// that leaves live data behind is the failure mode worth guarding.
g('W6 THE PROMISE SYSTEM IS GONE — no signed player carries a contract and no coach carries a ledger',
  !S.anyPromiseData,
  S.anyPromiseData ? `still found: ${S.anyPromiseData}` : 'no promises on any roster, no honesty ledger on any coach');
g('W11 §13 every want reads a live number on a real program after real seasons',
  Object.values(S.scores).every(v => v >= 0 && v <= 1),
  Object.entries(S.scores).map(([k, v]) => `${k.slice(0, 4)} ${v}`).join(' '));
g('W12 §13 the DEVELOPMENT want is reading actual receipts by now, not just the grade',
  S.devRecord.growth != null,
  `score ${S.devRecord.score} · roster growth ${S.devRecord.growth} over ${S.devRecord.n} graded returnees (${S.arrivals} men carry an arrival stamp, ${S.arrivalsReturning} past their FR year)`);
g('W13 §13 THE BOARD SHOWS THEM — want tags render on the war card',
  ui.wantTags > 0 && ui.hasBoard,
  `${ui.wantTags} want tags on the board`);
g('W13b the profile draws the full want panel',
  ui.wantPanel && ui.wantRows > 0,
  `${ui.wantRows} want rows on a ${profilePicked?.pos ?? '?'}`);
g('W13c ...and no promise control survives anywhere in the recruiting UI',
  !ui.promiseCard && !ui.honestyChip && ui.roleButtons === 0,
  `promise card ${ui.promiseCard} · honesty chip ${ui.honestyChip} · role buttons ${ui.roleButtons}`);
g('W14 zero console/page errors across the whole run', errors.length === 0,
  errors.slice(0, 3).join(' | '));

console.log(`\n${fail === 0 ? '✅ W8 WANTS SMOKE PASS' : `❌ W8 WANTS SMOKE: ${fail} FAILED`}`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
