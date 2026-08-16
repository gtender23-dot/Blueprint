// career_firing_probe.mjs — the hot seat: does the mandate bonus bite, and is a firing
// ever a surprise?
//
// A8 — the expectation bonus (a fallen blueblood is judged against its banners) is set on the
//      coach but the firing math called expectedWins WITHOUT the coach, so the bonus never
//      reached the delta. Fixed: the bonus now moves the meter.
// A9 — the hot-seat ultimatum was suppressed in the very tick that fired
//      (`seat==='hot' && !coach._pendingFire`), so a one-season meter crash or a two-year
//      streak could fire with no warning at all. Fixed: a coach can only be fired if the AD
//      already put him on notice in an EARLIER season — otherwise this season becomes the
//      ultimatum and the fire defers a year.
import { updateJobSecurity } from '../js/engine/season.js';
import { expectedWins } from '../js/engine/career.js';
import { C } from '../js/constants.js';

const GAMES = C.CONF_GAMES + C.NONCONF_GAMES;

function mkCoach(over = {}) {
  return { status:'employed', isAI:false, jobSecurity:C.JOBSEC_START, tenureSeasons:3,
           lastDelta:null, dominanceStreak:0, _onNotice:false, expectationBonus:0,
           skills:{}, ...over };
}
function mkState(coach, prestige, wins, season = 2030) {
  const school = { id:'P', prestige, recentWins:[wins] };
  return { playerCoach:coach, playerSchoolId:'P', world:{ schools:[school] }, season };
}

let fail = 0;

// ── A8: the bonus reaches the firing meter ────────────────────────────────────────────────
console.log('A8 — expectation bonus reaches the firing math');
console.log(`  expectedWins(prestige 3, bonus 0)    = ${expectedWins(3, GAMES)}`);
console.log(`  expectedWins(prestige 3, bonus +.15) = ${expectedWins(3, GAMES, { expectationBonus: 0.15 })}`);
{
  const wins = 6, prestige = 3;
  const plain = mkCoach({ expectationBonus: 0 });
  const hot   = mkCoach({ expectationBonus: 0.15 });   // Hot Seat: judged against banners
  updateJobSecurity(mkState(plain, prestige, wins), []);
  updateJobSecurity(mkState(hot,   prestige, wins), []);
  console.log(`  after a ${wins}-win season at prestige ${prestige}: meter ${plain.jobSecurity} (no bonus)  vs  ${hot.jobSecurity} (bonus)`);
  if (hot.jobSecurity < plain.jobSecurity) console.log('  PASS — the bonus makes the identical record cost more job security.');
  else { fail++; console.log('  FAIL — the bonus did not move the meter; still dropped from the firing math.'); }
}

// ── A9: never fired without a prior-season warning ────────────────────────────────────────
console.log('\nA9 — a firing is never a surprise');
// A season-by-season trajectory of win totals; returns the per-season log.
function runTrajectory(label, prestige, winsByYear) {
  const coach = mkCoach({ jobSecurity: C.JOBSEC_START });
  const log = [];
  for (let y = 0; y < winsByYear.length; y++) {
    const events = [];
    updateJobSecurity(mkState(coach, prestige, winsByYear[y], 2030 + y), events);
    const warned = events.some(e => e.type === 'warning');
    log.push({ y, wins: winsByYear[y], meter: coach.jobSecurity, warned, onNotice: coach._onNotice, fired: !!coach._pendingFire });
    if (coach._pendingFire) break;
  }
  // Invariant: if a firing happened, some STRICTLY earlier season carried a warning.
  const fireYear = log.findIndex(r => r.fired);
  let ok = true, detail = 'no firing in window';
  if (fireYear >= 0) {
    const warnedEarlier = log.slice(0, fireYear).some(r => r.warned);
    ok = warnedEarlier;
    detail = warnedEarlier ? `fired year ${fireYear}, warned earlier ✓` : `fired year ${fireYear} with NO prior warning ✗`;
  }
  console.log(`  ${label.padEnd(22)} ${log.map(r => `[y${r.y} w${r.wins} m${r.meter}${r.warned?' WARN':''}${r.fired?' FIRED':''}]`).join(' ')}`);
  console.log(`      → ${detail}`);
  if (!ok) fail++;
  return log;
}

// Catastrophic one-season crash from a safe meter — the case the OLD code fired silently.
runTrajectory('one-season crash', 3, [0, 0, 0]);
// Two-year bad streak from a decent start.
runTrajectory('two-year streak', 3, [4, 4, 4]);
// Slow bleed at a high-prestige (well-cushioned) program.
runTrajectory('slow bleed (P5)', 5, [7, 6, 5, 4, 3, 2]);
// A near-miss that recovers — must NOT fire, and notice should lift.
runTrajectory('scare then recover', 3, [3, 8, 8]);

console.log(fail ? `\n${fail} FAILED` : '\nPASS — the bonus bites and no coach is fired without a prior-season ultimatum.');
process.exit(fail ? 1 : 0);
