// _qa_saveload.mjs — save/load persistence round-trip on a full dynasty state.
import * as S from '../js/state.js';
import { generateWorld } from '../js/engine/world.js';
import { advanceDay, resumeFromHalftime } from '../js/engine/season.js';
import { exportString, importJSON } from '../js/engine/persistence.js';

S.setRenderFn(() => {});
S.setNotifyFn(() => {});
const num = (v) => typeof v === 'number' && Number.isFinite(v);

const world = generateWorld();
const school = world.schools.filter(s => s.division === 'D1').sort((a, b) => b.prestige - a.prestige)[0];
S.startNewGamePrepared({ first: 'QA', last: 'Coach' }, world, school);
const state = S.state;

// advance a few days so there's live in-season data to preserve
let d = state.day, safety = 0;
while (state.day - d < 4 && safety++ < 12 && state.season === 1) {
  advanceDay(state, () => {});
  while (state.pendingHalftime) resumeFromHalftime(state);
}
console.log(`=== SAVE/LOAD — mid-season state (season ${state.season}, day ${state.day}) ===`);

let fails = 0;
const chk = (ok, l, e = '') => { if (!ok) fails++; console.log(`  [${ok ? 'OK' : 'FAIL'}] ${l}${e ? ' — ' + e : ''}`); };

// snapshot key facts BEFORE save
const ps = state.world.schools.find(s => s.id === state.playerSchoolId);
const before = {
  season: state.season, day: state.day, playerSchoolId: state.playerSchoolId,
  schools: state.world.schools.length,
  roster: ps.roster.length,
  coachWins: state.playerCoach.careerWins, jobSec: state.playerCoach.jobSecurity,
  firstPlayerId: ps.roster[0].id, firstPlayerRating: ps.roster[0].compositeRating,
  totalPlayers: state.world.schools.reduce((n, s) => n + s.roster.length, 0),
};

let str = null, reloaded = null, err = null;
try { str = exportString(state); } catch (e) { err = 'export threw: ' + e.message; }
chk(!!str && !err, 'export produced a string', err || `${(str.length / 1024 / 1024).toFixed(1)} MB`);
if (str) {
  try { reloaded = importJSON(str); } catch (e) { err = 'import threw: ' + e.message; }
  chk(!!reloaded && !reloaded._incompatible, 'import round-trips', reloaded && reloaded._incompatible ? 'INCOMPATIBLE version' : (err || 'ok'));
}

if (reloaded && !reloaded._incompatible) {
  const rps = reloaded.world.schools.find(s => s.id === reloaded.playerSchoolId);
  const after = {
    season: reloaded.season, day: reloaded.day, playerSchoolId: reloaded.playerSchoolId,
    schools: reloaded.world.schools.length,
    roster: rps ? rps.roster.length : -1,
    coachWins: reloaded.playerCoach && reloaded.playerCoach.careerWins, jobSec: reloaded.playerCoach && reloaded.playerCoach.jobSecurity,
    firstPlayerId: rps && rps.roster[0] && rps.roster[0].id, firstPlayerRating: rps && rps.roster[0] && rps.roster[0].compositeRating,
    totalPlayers: reloaded.world.schools.reduce((n, s) => n + s.roster.length, 0),
  };
  for (const k of Object.keys(before)) chk(before[k] === after[k], `preserved: ${k}`, before[k] === after[k] ? '' : `${before[k]} → ${after[k]}`);
  // NaN scan of reloaded player roster + coach
  const bad = [];
  (function scan(o, p, d2) { if (d2 > 5 || o == null) return; if (typeof o === 'number') { if (!Number.isFinite(o)) bad.push(p); return; } if (typeof o !== 'object') return; if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) scan(o[i], p + '[' + i + ']', d2 + 1); return; } for (const k in o) scan(o[k], p + '.' + k, d2 + 1); })({ roster: rps && rps.roster, coach: reloaded.playerCoach }, 'R', 0);
  chk(bad.length === 0, 'no NaN in reloaded roster/coach', bad.slice(0, 4).join(','));
}

console.log(`\n${fails === 0 ? 'SAVE/LOAD OK ✅' : '⚠ ' + fails + ' FAIL(s)'}`);
process.exit(fails === 0 ? 0 : 1);
