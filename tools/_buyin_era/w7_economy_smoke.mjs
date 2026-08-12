// w7_economy_smoke.mjs — does THE ECONOMY actually turn?
//
// economy_probe.mjs pins every piece of §5/§5b/§13 in isolation. This drives
// real seasons in a real browser and asserts the pieces are WIRED TO EACH
// OTHER, the way the wave draws it:
//
//   the coach hands hours to the classroom / negotiates the split
//     → the academic term settles league-wide at day 24
//       → grades move, character moves with them, men fall under the line
//         → suspensions are SERVED in real games next season
//           → the 5-year education window, the gate history and the ranked-week
//             ledger all bank, and the compliance office keeps a file
//
// Everything here has to be true in a live calendar, not a unit fixture:
// day-24 ordering, the availability gate reaching the real depth chart, the
// preseason negotiation landing on a spendable budget, and league-wide AI
// programs living the same loop (§5b's "realistic churn").
//
// Run: node tools/w7_economy_smoke.mjs [seasons]   (PW_CHROMIUM optional)
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
  const { advanceDay } = await import('./js/engine/season.js');
  const { createCoach } = await import('./js/engine/coachprofile.js');
  const { setAcademicHours, academicHours, educationGrade, educationScore,
          academicStanding, academicLevel, eduBudget, seasonAttendanceAvg,
          buyAcademicUpgrade } = await import('./js/engine/academics.js');
  const { makeBudgetAsk, budgetAskOptions } = await import('./js/engine/offseason.js');
  const { programSpotlight, programCulture } = await import('./js/engine/measures.js');
  const { isAvailable } = await import('./js/utils.js');
  const { C } = await import('./js/constants.js');

  localStorage.removeItem('cfb-coaches-v1');
  const profile = createCoach('Econ', 'Smoke');

  const world = generateWorld(); world.recruits = generateRecruitPool(world);
  const ps = world.schools[0];
  const coach = { id: 'econ', schoolId: ps.id, prestige: ps.prestige, budget: 50000,
    scholarshipsAvailable: 20, recruitBoard: [], seasonRecord: { wins: 0, losses: 0 },
    status: 'employed', tenureSeasons: 0 };
  Object.assign(state, {
    initialized: true, season: 1, day: 1, playerSchoolId: ps.id, playerCoach: coach,
    _coachId: profile.id, _worldSlot: 1, world, schedule: generateSchedule(world),
    playoffs: null, coachHistory: [], awardsLog: [],
  });
  ps.coach = coach;
  state.settings.liveWatch = false;
  state.settings.injuries = true;
  rerender();

  const seen = {
    halted: null,
    eduTrace: [], gpaTrace: [], attendTrace: [], shareTrace: [],
    banned: 0, servedInGames: 0, sidelinedSeen: 0, chartHidBanned: 0,
    asks: [], askGranted: 0, budgetDelta: 0,
    violations: 0, violationSchools: [],
    probeStartGpa: 0,
  };
  seen.probeStartGpa = ps.roster.reduce((s, p) => s + (p.gpa || 0), 0) / ps.roster.length;
  // The chain's second half: does the classroom actually build the man? Read
  // on the men who are still here at the end, so graduation can't fake it.
  const grindStart = new Map(ps.roster.map(p => [p.id, p.character?.grind ?? 50]));

  // The coach commits to the classroom on day one — this is the wave's lever,
  // and the smoke's whole point is that pulling it has consequences. All three
  // arms of §5's investment get pulled: the hours, the building, and (via the
  // preseason ask, below) the money. world.schools[0] is whatever program the
  // world happened to generate first, so its education preference may be
  // anything — the point is that INVESTMENT moves the room regardless of what
  // the administration was doing before the coach arrived.
  setAcademicHours(ps, 5);
  seen.acadLevelStart = academicLevel(ps);
  state.playerCoach.budget += 600000;   // harness money: buying the building is the §5 tradeoff, not the test
  for (let k = 0; k < 4; k++) buyAcademicUpgrade(ps, state.playerCoach);
  seen.acadLevelEnd = academicLevel(ps);

  for (let s = 0; s < SEASONS; s++) {
    for (let guard = 0; guard < 400; guard++) {
      if (state.season > SEASONS) break;

      // Preseason Week 1: make the ask, once a year, alternating direction so
      // both halves of §5b's trade are exercised in a live calendar.
      if (state.day === 1 && !state.preseason?.budgetAsk) {
        const opts = budgetAskOptions(state);
        if (opts.length) {
          const before = state.playerCoach.budget || 0;
          // Season 1 asks the other way (education → recruiting) so BOTH halves
          // of §5b's trade run in a live calendar; after that the coach is
          // investing, which is what W4 measures.
          const dir = state.season === 1 ? 'recruiting' : 'education';
          const res = makeBudgetAsk(state, { stepIdx: 1, dir });
          seen.asks.push({ season: state.season, dir, granted: !!res.granted, dollars: res.dollars || 0 });
          if (res.granted) { seen.askGranted++; seen.budgetDelta += ((state.playerCoach.budget || 0) - before); }
        }
      }

      // THE HOT SEAT IS NOT WHAT THIS SMOKE MEASURES. The harness deliberately
      // hands 5 of 20 countable hours to the classroom, which is a real −25%
      // on practice development — exactly the sacrifice §5 is built around —
      // and at a 6-star program that gets a coach fired inside three years.
      // That is the system working, but it would end the run before the
      // economy has been observed, so the seat is pinned open here.
      if (state.playerCoach) { state.playerCoach.jobSecurity = 100; state.playerCoach._onNotice = false; }

      // Someone under a live ban must be OFF the sim-facing depth chart —
      // checked LEAGUE-WIDE, since the whole point is that the field cannot
      // field an ineligible man anywhere in the world.
      if (state.day >= 5 && state.day <= 19) {
        for (const sc of world.schools) {
          const banned = (sc.roster || []).filter(p => (p.ineligibleGames || 0) > 0);
          if (!banned.length) continue;
          seen.sidelinedSeen += banned.length;
          const listed = new Set(Object.values(sc.depthChart || {}).flat());
          seen.chartHidBanned += banned.filter(p => !listed.has(p.id) && !isAvailable(p)).length;
        }
      }

      // Bans are counted LEAGUE-WIDE: whether the player's own well-funded
      // program happens to draw one in a given three-year run is luck, but the
      // mechanism either works for every room in the world or it doesn't.
      const countBans = () => world.schools.reduce((n, sc) =>
        n + (sc.roster || []).reduce((m, p) => m + (p.ineligibleGames || 0), 0), 0);
      const beforeBans = countBans();
      let events = [];
      try { events = advanceDay(state) || []; } catch (e) { seen.halted = `${e.message} (S${state.season} D${state.day})`; break; }
      const afterBans = countBans();
      if (state.day >= 5 && state.day <= 20 && afterBans < beforeBans) seen.servedInGames += (beforeBans - afterBans);

      for (const e of events || []) {
        if (/NCAA violation|came down on the program/i.test(e.text || '')) seen.violations++;
      }

      if (state.pendingHalftime) {
        const { resumeFromHalftime } = await import('./js/engine/season.js');
        let hops = 0;
        while (state.pendingHalftime && hops++ < 60) {
          try { resumeFromHalftime(state); } catch (e) { seen.halted = `resume: ${e.message}`; break; }
          if (state.pendingHalftime?.token?.pending) { seen.halted = 'token froze'; break; }
        }
        if (seen.halted) break;
      }
      if (state.offseason && !state.offseason.done) {
        // Snapshot the academic year the moment it has settled (day 24).
        if (!seen.eduTrace.length || seen.eduTrace[seen.eduTrace.length - 1].season !== state.season) {
          seen.eduTrace.push({ season: state.season,
            score: Math.round(educationScore(ps).score * 1000) / 10,
            letter: educationGrade(ps).letter,
            level: academicLevel(ps), line: eduBudget(ps) });
          seen.shareTrace.push(Math.round((ps.academics?.share ?? 0) * 100));
          seen.gpaTrace.push(Math.round((ps.roster.reduce((a, p) => a + (p.gpa || 0), 0) / ps.roster.length) * 100) / 100);
          seen.attendTrace.push(ps.attendance?.history?.[0] ?? null);
          seen.banned += world.schools.reduce((n, sc) =>
            n + (sc.roster || []).filter(p => (p.ineligibleGames || 0) > 0).length, 0);
        }
        const { advanceOffseasonStage } = await import('./js/engine/offseason.js');
        for (let k = 0; k < 40 && state.offseason && !state.offseason.done; k++) advanceOffseasonStage(state);
      }
      if (state.forcedShortlist?.length) { seen.halted = 'fired'; break; }
      if (state.season > SEASONS) break;
    }
    if (seen.halted || state.season > SEASONS) break;
  }

  // League-wide reality: every program lived the same year.
  const league = world.schools;
  const withAcad = league.filter(s => s.academics && s.academics.history?.length).length;
  const withAttend = league.filter(s => (s.attendance?.history || []).length).length;
  const leagueBanned = league.reduce((n, s) => n + (s.roster || []).filter(p => (p.ineligibleGames || 0) > 0).length, 0);
  const onProbation = league.filter(s => s.probation).map(s => s.name);
  const rankedWeeksBanked = league.filter(s =>
    (s.seasonHistory || []).some(h => (h.rankedWeeks || 0) > 0)).length;
  const eduLetters = {};
  for (const s of league) { const L = educationGrade(s).letter; eduLetters[L] = (eduLetters[L] || 0) + 1; }

  return {
    seen, season: state.season, day: state.day,
    academicHours: academicHours(ps),
    finalGpa: Math.round((ps.roster.reduce((a, p) => a + (p.gpa || 0), 0) / ps.roster.length) * 100) / 100,
    spotlight: programSpotlight(ps), culture: programCulture(ps), edu: educationGrade(ps),
    risk: academicStanding(ps, ps.coach),
    warnedLeague: league.filter(s => s.academics?.standing?.warning).map(s => s.name),
    league: { n: league.length, withAcad, withAttend, leagueBanned, onProbation, rankedWeeksBanked, eduLetters },
    grindDelta: (() => {
      const stayed = ps.roster.filter(p => grindStart.has(p.id));
      if (!stayed.length) return 0;
      return Math.round(stayed.reduce((a, p) =>
        a + ((p.character?.grind ?? 50) - grindStart.get(p.id)), 0) / stayed.length * 100) / 100;
    })(),
    histRows: (ps.seasonHistory || []).map(h => ({ s: h.season, rw: h.rankedWeeks, att: h.attendance, share: h.eduShare })),
  };
}, SEASONS);

console.log(`\n— ran to season ${out.season}, day ${out.day}`);
if (out.seen.halted) console.log(`   HALTED: ${out.seen.halted}`);
console.log('');

const S = out.seen;
g('W1 the calendar ran clean through the seasons', !S.halted && out.season > SEASONS, `S${out.season}`);
g('W2 the classroom allocation survives the whole calendar (it is program state, not a screen)',
  out.academicHours === 5, `${out.academicHours}h/week`);
g('W3 the academic term settles once a season, league-wide',
  S.eduTrace.length >= SEASONS && out.league.withAcad === out.league.n,
  `${S.eduTrace.length} terms · ${out.league.withAcad}/${out.league.n} programs`);
g('W4 §5 the chain runs in a live dynasty: real investment moved the room\'s GPA',
  out.finalGpa > S.probeStartGpa && S.acadLevelEnd > S.acadLevelStart,
  `Academic Center lv${S.acadLevelStart} → lv${S.acadLevelEnd} · GPA ${Math.round(S.probeStartGpa * 100) / 100} → ${out.finalGpa} over ${SEASONS} seasons`);
g('W4b §5 the chain\'s second half: grades moved CHARACTER too',
  out.grindDelta > 0, `roster Grind ${out.grindDelta > 0 ? '+' : ''}${out.grindDelta}`);
g('W5 §5b eligibility is real in a live season: men are banned and bans are SERVED IN GAMES',
  S.banned > 0 && S.servedInGames > 0,
  `${S.banned} league-wide bans minted · ${S.servedInGames} game-bans actually served`);
g('W6 the ban reaches the SIM-FACING depth chart (the field cannot field him)',
  S.sidelinedSeen > 0 && S.chartHidBanned === S.sidelinedSeen,
  `${S.chartHidBanned}/${S.sidelinedSeen} banned-player-days off the chart, league-wide`);
g('W7 §5b the negotiation resolves in the live preseason and moves real money',
  S.asks.length >= SEASONS && (S.askGranted === 0 || S.budgetDelta !== 0),
  S.asks.map(a => `S${a.season} ${a.dir}${a.granted ? ` ${a.dollars >= 0 ? '+' : '−'}$${Math.abs(a.dollars)}` : ' denied'}`).join(' · '));
g('W8 §13 the 5-year education window banks a real trace',
  S.eduTrace.length >= SEASONS && S.shareTrace.length >= SEASONS,
  S.eduTrace.map(e => `S${e.season} ${e.letter}(${e.score}) lv${e.level} $${e.line}`).join(' · '));
g('W9 §5b the gate banks into a trailing attendance history',
  S.attendTrace.filter(v => v != null).length >= SEASONS && out.league.withAttend === out.league.n,
  `${S.attendTrace.filter(v => v != null).join(' → ')} · ${out.league.withAttend}/${out.league.n} programs`);
g('W10 §13 weeks ranked bank as they happen (the Spotlight ledger)',
  out.league.rankedWeeksBanked > 0 && out.histRows.some(r => r.rw != null),
  `${out.league.rankedWeeksBanked} programs banked ranked weeks · yours ${out.histRows.map(r => `S${r.s}:${r.rw}w`).join(' ')}`);
g('W11 §13 all three want measures read on a real program',
  [out.spotlight, out.culture, out.edu].every(m => m && m.letter && m.score >= 0 && m.score <= 1),
  `Spotlight ${out.spotlight.letter} · Culture ${out.culture.letter} · Education ${out.edu.letter}`);
g('W12 §5b academic standing is live and the league is not burning down',
  out.risk && out.risk.band && out.risk.letter && out.league.onProbation.length <= Math.ceil(out.league.n * 0.05),
  `you: ${out.risk.label} (${out.risk.letter}) · ${out.warnedLeague.length} program(s) under academic warning · ${out.league.onProbation.length} sanctioned${out.league.onProbation.length ? `: ${out.league.onProbation.slice(0, 3).join(', ')}` : ''}`);
g('W13 the league lives the same year (AI rooms take grades and serve bans)',
  out.league.leagueBanned > 0 && Object.keys(out.league.eduLetters).length >= 5,
  `${out.league.leagueBanned} ineligible league-wide · ${Object.entries(out.league.eduLetters).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(' ')}`);
g('W14 zero console/page errors across the whole run', errors.length === 0,
  errors.slice(0, 3).join(' | '));

console.log(`\n${fail === 0 ? '✅ W7 ECONOMY SMOKE PASS' : `❌ W7 ECONOMY SMOKE: ${fail} FAILED`}`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
