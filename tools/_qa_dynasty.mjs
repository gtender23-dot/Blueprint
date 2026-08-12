// _qa_dynasty.mjs — QA: drive a multi-season dynasty; check standings, playoffs,
// awards/leaders, recruiting/aging, DNA/retirement/tree, and scan every stat surface
// for NaN/undefined. Args: [division] [maxSeasons]
import * as S from '../js/state.js';
import { generateWorld } from '../js/engine/world.js';
import { advanceDay, resumeFromHalftime, resumeFromPlayCall, resumeFromFourthDown } from '../js/engine/season.js';

S.setRenderFn(() => {});
S.setNotifyFn(() => {});
const DIV = process.argv[2] || 'D1';
const MAXS = Number(process.argv[3] || 6);
// Wall-clock budget in seconds, argv[4] (default: the original 34s quick-smoke).
// A full season is ~5–7 min of advanceDay in the cloud container — pass ~1200
// for a real multi-season audit.
const BUDGET_MS = Number(process.argv[4] || 34) * 1000;
const num = (v) => typeof v === 'number' && Number.isFinite(v);

// deep NaN/undefined scan (bounded depth to avoid cycles)
function scanBad(obj, path, out, seen, depth) {
  if (depth > 6 || obj == null) return;
  if (typeof obj === 'number') { if (!Number.isFinite(obj)) out.push(path); return; }
  if (typeof obj !== 'object') return;
  if (seen.has(obj)) return; seen.add(obj);
  if (Array.isArray(obj)) { for (let i = 0; i < obj.length && i < 200; i++) scanBad(obj[i], path + '[' + i + ']', out, seen, depth + 1); return; }
  for (const k in obj) { if (k.startsWith('_')) continue; scanBad(obj[k], path + '.' + k, out, seen, depth + 1); }
}

const world = generateWorld();
const school = world.schools.filter(s => s.division === DIV).sort((a, b) => b.prestige - a.prestige)[0];
S.startNewGamePrepared({ first: 'QA', last: 'Coach' }, world, school);
const state = S.state;
console.log(`=== DYNASTY QA — ${DIV} ${school.name} (prestige ${school.prestige}) ===`);

const t0 = Date.now();
let crash = null;
function drive() {
  // resolve any pending player-game stop, else advance a day
  const pt = state.pendingHalftime && state.pendingHalftime.token;
  if (pt && pt.pending) {
    if (pt.pending.kind === 'fourth') resumeFromFourthDown(state, 'auto');
    else resumeFromPlayCall(state, { concept: 'sheet' });
    return;
  }
  if (state.pendingHalftime) { resumeFromHalftime(state); return; }
  advanceDay(state, () => {});
}

let lastSeason = state.season;
let iters = 0, games = 0;
const seasonLog = [];
function snapshot(seasonJustFinished) {
  const w = state.world;
  // standings coherence: every school has a finite record
  let badRec = 0, played = 0;
  for (const s of w.schools) {
    const rw = s.seasonRecord || s.record || {};
    if (rw && (num(rw.wins) || num(rw.w))) played++;
    else badRec++;
  }
  // champion / playoffs
  const champ = (state.playoffs && (state.playoffs.champion || state.playoffs.championId)) ||
    (state.lastChampionId) || null;
  // awards/leaders present?
  const awards = state.seasonAwards || state.awards || (state.history && state.history.length ? state.history[state.history.length - 1].awards : null);
  // coach DNA
  const c = state.playerCoach;
  const dna = c && (c.dnaGrades || c.dna || c._dnaGrades);
  const bad = [];
  scanBad({ standings: w.schools.map(s => s.seasonRecord), playoffs: state.playoffs, awards, coach: c, leaders: state.leaders }, 'S' + seasonJustFinished, bad, new WeakSet(), 0);
  seasonLog.push({ season: seasonJustFinished, badRec, played, champ: !!champ, awards: !!awards, dnaGrades: dna ? Object.keys(dna).length : 0, jobSec: c && c.jobSecurity, wins: c && c.careerWins, nanFields: bad.slice(0, 8) });
}

while (state.season <= MAXS && Date.now() - t0 < BUDGET_MS) {
  try { drive(); iters++; } catch (e) { crash = { season: state.season, day: state.day, msg: e.message, stack: (e.stack || '').split('\n').slice(0, 4).join(' | ') }; break; }
  if (state.season !== lastSeason) { snapshot(lastSeason); lastSeason = state.season; }
}
// snapshot whatever we reached even mid-season
snapshot(state.season + 0.5);

console.log(`reached: season ${state.season}, day ${state.day}, iters ${iters}, elapsed ${((Date.now() - t0) / 1000).toFixed(0)}s`);
// mid-run standings + NaN across all schools this season
{
  const w = state.world; let withRec = 0, nan = [];
  for (const s of w.schools) { const rec = s.seasonRecord || {}; if (num(rec.wins) && num(rec.losses)) withRec++; }
  scanBad(w.schools.map(s => ({ id: s.id, rec: s.seasonRecord, prestige: s.prestige })), 'schools', nan, new WeakSet(), 0);
  console.log(`standings: ${withRec}/${w.schools.length} schools have a finite W-L record; NaN in school records: ${nan.length ? nan.slice(0, 5).join(',') : 'none'}`);
}
if (crash) console.log(`\n💥 CRASH at season ${crash.season} day ${crash.day}: ${crash.msg}\n   ${crash.stack}`);
console.log('\nseason | schoolsWithRecord | champ | awards | coachDNAgrades | jobSec | careerW | NaN fields');
for (const l of seasonLog) console.log(`  S${l.season}  | ${l.played}/${l.played + l.badRec} | ${l.champ ? 'Y' : 'N'} | ${l.awards ? 'Y' : 'N'} | ${l.dnaGrades} | ${num(l.jobSec) ? l.jobSec.toFixed(0) : 'NaN'} | ${l.wins} | ${l.nanFields.length ? l.nanFields.join(',') : '-'}`);

// final roster/aging sanity on the player's team
const ps = state.world.schools.find(s => s.id === state.playerSchoolId);
if (ps) {
  const ages = {}; let badP = 0;
  for (const p of ps.roster || []) { ages[p.classYear] = (ages[p.classYear] || 0) + 1; if (!num(p.compositeRating)) badP++; }
  console.log(`\nplayer roster now: ${ps.roster.length} players, class mix ${JSON.stringify(ages)}, bad-rating players ${badP}`);
}
console.log(crash ? '\n⚠ CRASH — see above' : '\n✅ no crash; see per-season table');
process.exit(crash ? 1 : 0);
