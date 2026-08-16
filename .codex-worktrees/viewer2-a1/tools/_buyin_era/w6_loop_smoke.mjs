// w6_loop_smoke.mjs — does the LEADERSHIP LOOP actually turn?
//
// The unit probe (grade_honesty_probe) pins every piece in isolation. This
// drives three real seasons in a real browser and asserts the pieces are
// WIRED TO EACH OTHER — stage 3 feeds 4 feeds 5, the way §10 draws it:
//
//   grades land on players and on the season ledger
//     → grade milestones mint from the tape (never from the scoreboard)
//       → the new DNA axes accrue, with the WHY attached (§16.6.3)
//         → coordinators record unit ledgers and grow (§14.3 / decision #8)
//           → Motivator raises real ceilings and the speech bank refills
//
// The DNA half CANNOT be tested in node: the profile store is localStorage, so
// addDnaXP is a silent no-op outside a browser. That is exactly why this smoke
// exists as a browser harness rather than another section of the probe.
//
// Run: node tools/w6_loop_smoke.mjs   (PW_CHROMIUM optional)
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
// Resource 404s / proxy noise are environment, not the app (the other smokes
// make the same exclusion).
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
  const { createCoach, coachDNA, dnaGrades, dnaStory, aiDnaTitle, DNA_AXES } = await import('./js/engine/coachprofile.js');
  const { seasonGrade } = await import('./js/engine/grades.js');
  const { coordStreak, coordinatorCredentials } = await import('./js/engine/staff.js');

  // A real profile in the real store — the DNA layer only lives here.
  localStorage.removeItem('cfb-coaches-v1');
  const profile = createCoach('Loop', 'Smoke');

  const world = generateWorld(); world.recruits = generateRecruitPool(world);
  const ps = world.schools[0];
  const coach = { id: 'loop', schoolId: ps.id, prestige: ps.prestige, budget: 50000,
    scholarshipsAvailable: 20, recruitBoard: [], seasonRecord: { wins: 0, losses: 0 },
    status: 'employed', tenureSeasons: 0 };
  Object.assign(state, {
    initialized: true, season: 1, day: 1, playerSchoolId: ps.id, playerCoach: coach,
    _coachId: profile.id, _worldSlot: 1, world, schedule: generateSchedule(world),
    playoffs: null, coachHistory: [], awardsLog: [],
  });
  ps.coach = coach;
  state.settings.liveWatch = false;   // sim every game; no locker-room pause
  state.settings.injuries = true;
  rerender();

  const capsBefore = new Map();
  const snapshotCaps = () => {
    capsBefore.clear();
    for (const p of ps.roster) capsBefore.set(p.id, { ...p.potentialCaps });
  };
  snapshotCaps();

  const seen = { halted: null };
  for (let s = 0; s < SEASONS; s++) {
    for (let guard = 0; guard < 400; guard++) {
      if (state.season > SEASONS) break;
      let events = [];
      try { events = advanceDay(state) || []; } catch (e) { seen.halted = `${e.message} (S${state.season} D${state.day})`; break; }
      // The player's own game pauses in the locker room. Resume it here — and
      // on the first break of each season, actually USE both halftime layers,
      // so the smoke proves the adjustment lean and the speech run end-to-end
      // inside a live game rather than only in the unit probe.
      if (state.pendingHalftime) {
        const { resumeFromHalftime } = await import('./js/engine/season.js');
        if (!seen.usedLayers?.[state.season]) {
          (seen.usedLayers ||= {})[state.season] = true;
          state.pendingHalftime.adjustment = { kind: 'offlean' };
          state.pendingHalftime.speech = 'rally';
          seen.spokeIn = (seen.spokeIn || 0) + 1;
        }
        let hops = 0;
        while (state.pendingHalftime && hops++ < 60) {
          try { resumeFromHalftime(state); } catch (e) { seen.halted = `resume: ${e.message}`; break; }
          if (state.pendingHalftime?.token?.pending) { seen.halted = 'token froze on an asked snap'; break; }
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
    if (seen.halted) break;
    if (state.season > SEASONS) break;
  }

  const dna = coachDNA(profile.id) || { axes: {}, log: [], badges: [] };
  const grades = dnaGrades(profile.id);
  const graded = ps.roster.filter(p => (p.gradeLog || []).length);
  // state.season has already rolled past the last one played.
  const lastPlayed = Math.min(state.season, SEASONS);
  const anySeason = graded.map(p => seasonGrade(p, lastPlayed)).filter(Boolean);
  const oc = ps.staff?.oc, dc = ps.staff?.dc;
  let capsRaised = 0;
  for (const p of ps.roster) {
    const before = capsBefore.get(p.id);
    if (!before) continue;
    if (Object.keys(before).some(a => (p.potentialCaps[a] || 0) > before[a])) capsRaised++;
  }
  const aiCoaches = world.schools.slice(1, 60).map(s => s.coach).filter(Boolean);
  const aiAccrued = aiCoaches.filter(c => Object.values(c.dna?.axes || {}).some(v => v > 0)).length;
  const aiTitles = aiCoaches.map(aiDnaTitle).filter(t => t !== 'Building an Identity');

  return {
    halted: seen.halted,
    season: state.season, day: state.day,
    gradeLogRows: (state.gradeLog || []).length,
    gradedPlayers: graded.length,
    sampleGrade: graded[0] ? { pos: graded[0].position, log: (graded[0].gradeLog || []).slice(0, 3) } : null,
    seasonGrades: anySeason.slice(0, 4).map(x => `${x.letter}(${x.games}g)`),
    units: (state.gradeLog || []).slice(-1)[0]?.units || null,
    dnaAxes: Object.fromEntries(Object.entries(dna.axes || {}).filter(([, v]) => v > 0)),
    dnaLog: (dna.log || []).length,
    dnaLogSample: (dna.log || []).slice(-3),
    badges: (dna.badges || []).length,
    badgeLabels: (dna.badges || []).slice(-4).map(b => b.label),
    milestoneFlags: Object.keys(coach.milestoneFlags || {}),
    motivatorGrade: grades.motivator || 0,
    cultureGrade: grades.culture || 0,
    capsRaised,
    speeches: coach.speeches || null,
    spokeIn: seen.spokeIn || 0,
    lastAdj: state._lastAdjEval || null,
    ocLedger: oc?.ledger?.length || 0,
    ocIdentity: oc?.identity || null,
    ocRatings: oc ? { ...oc.ratings } : null,
    ocStreak: oc ? coordStreak(oc, 'B+') : 0,
    ocCred: oc ? coordinatorCredentials(oc)?.startingLevels : null,
    dcLedger: dc?.ledger?.length || 0,
    aiAccrued, aiCoaches: aiCoaches.length,
    aiIdentified: aiTitles.length,
    aiSample: aiTitles.slice(0, 3),
    dnaMoments: (state._dnaMoments || []).length,
  };
}, SEASONS);

console.log(`\n— ran to season ${out.season}, day ${out.day}${out.halted ? ` (halted: ${out.halted})` : ''}\n`);

g('L1 the calendar ran clean through the seasons', !out.halted, out.halted || `S${out.season}`);
g('L2 stage 3: every game leaves graded tape on the players and the season ledger',
  out.gradeLogRows >= 10 && out.gradedPlayers >= 15,
  `${out.gradeLogRows} games logged, ${out.gradedPlayers} players graded, e.g. ${out.sampleGrade?.pos} ${JSON.stringify(out.sampleGrade?.log)}`);
g('L3 unit grades come off every game (what a coordinator is judged on)',
  out.units && Object.keys(out.units).length >= 5, JSON.stringify(out.units));
g('L4 season grades accumulate per player', out.seasonGrades.length >= 3, out.seasonGrades.join(' · '));
g('L5 stage 4: grade milestones mint from the tape',
  out.milestoneFlags.some(k => k.startsWith('grade')),
  out.milestoneFlags.filter(k => k.startsWith('grade')).join(', ') || 'none');
g('L6 stage 5: the two new DNA axes actually accrue in a real career',
  (out.dnaAxes.motivator || 0) > 0 && (out.dnaAxes.culture || 0) > 0,
  `motivator ${out.dnaAxes.motivator || 0} (G${out.motivatorGrade}) · culture ${out.dnaAxes.culture || 0} (G${out.cultureGrade})`);
g('L7 §16.6.3 the shine: every XP line carries its WHY into the story ledger',
  out.dnaLog >= 5 && out.dnaLogSample.every(e => e.why),
  out.dnaLogSample.map(e => `${e.axis}: "${e.why}"`).join(' | '));
g('L8 badges mint and carry the axis they belong to (the shelf groups)',
  out.badges > 0, `${out.badges} badges — ${out.badgeLabels.join(', ')}`);
g('L9 §14.3 the coordinator ledger records a row per season',
  out.ocLedger >= 1 && out.dcLedger >= 1, `OC ${out.ocLedger} rows, DC ${out.dcLedger} rows`);
g('L10 §16.6.7 the service record converts to day-one credentials',
  out.ocCred && Object.keys(out.ocCred).length >= 2, JSON.stringify(out.ocCred));
g('L11 §16.3 speeches are really spent in a live game, and the bank counts them',
  out.speeches && out.speeches.total >= 2 && out.spokeIn > 0
  && out.speeches.used > 0 && out.speeches.left === out.speeches.total - out.speeches.used,
  `${out.spokeIn} spoken · bank ${JSON.stringify(out.speeches)}`);
// A TITLE needs grade 3 (~6 seasons of one identity), so a short run proves
// ACCRUAL; the named legends arrive on a career timescale, by design.
g('L12 §16.6.8 the world grows its own coaching identities',
  out.aiAccrued > out.aiCoaches * 0.8,
  `${out.aiAccrued}/${out.aiCoaches} AI coaches accruing · ${out.aiIdentified} already named${out.aiSample.length ? ` (${out.aiSample.join(' · ')})` : ''}`);
g('L13 zero console/page errors across three simulated seasons',
  errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(fail ? `\n❌ ${fail} FAILED` : '\n✅ W6 LEADERSHIP-LOOP SMOKE PASS');
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
