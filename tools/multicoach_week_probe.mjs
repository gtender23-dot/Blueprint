// multicoach_week_probe.mjs — PLAYTEST 2026-08-12: COACH EACH OF YOUR PROGRAMS,
// AS A SEPARATE ACTION THAT GATES THE WEEK.
//
// Owner: "the games should be a separate action that gates the advance-week
// button... once the coach closes the box score they can choose when to take
// over the next coach and play that game."
//
// The gate this proves:
//   1. SINGLE-COACH never trips the multi-coach gate.
//   2. MULTI-COACH: advance-week is REFUSED while any of the player's programs'
//      games are unplayed (the button is gated in the UI; the engine backstops it
//      with a coachWeekGate warning and does not move the week).
//   3. Games are launched one at a time (beginCoachedGame) and do NOT chain —
//      after one finishes, nothing else is paused and the week has not advanced.
//   4. A game can be coached (halftime pause → resume) OR simmed from the agenda.
//   5. Standings are applied exactly once per program; the week advances only
//      after all are resolved; the originally-active chair is restored.
//
// Run: node tools/multicoach_week_probe.mjs
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { advanceDay, resumeFromHalftime, coachedGamesForDay, beginCoachedGame } from '../js/engine/season.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};

function roster(id) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], 1);
      p.schoolId = id;
      r.push(p);
    }
  }
  return r;
}
const gp = () => ({ offFormation: 'Single Back', offFormations: [{ id: 'Single Back', weight: 100 }], tendency: 'Balanced', rushInPct: 45, passDepth: { short: 30, medium: 40, deep: 30 }, blitzPct: 20, fourthDown: 'Moderate', maxFGDist: 42, fieldAssignments: null });

function mkSchool(id, name, div) {
  const rr = roster(id);
  const s = { id, name, nick: name, division: div, conf: div + 'C', prestige: div === 'D1' ? 4 : 2, roster: rr, gameplan: gp(), depthOrder: {}, record: { wins: 0, losses: 0, confWins: 0, confLosses: 0 }, stats: {}, colors: ['#333'], lat: 40, lng: -80, seasonHistory: [] };
  s.depthChart = buildDepthChart(rr, s.gameplan);
  s.coach = { id: 'coach-' + id, name: { first: 'C', last: id }, isAI: false, budget: 0, recruitBoard: [], scouted: {} };
  return s;
}

// Two coached schools (A active + B) plus AI opponents; both play day 2.
function mkState(multi) {
  const A = mkSchool('A', 'Alpha', 'D1');
  const B = mkSchool('B', 'Bravo', 'D1');
  const OA = mkSchool('OA', 'OppA', 'D1'); OA.coach.isAI = true;
  const OB = mkSchool('OB', 'OppB', 'D1'); OB.coach.isAI = true;
  const schools = [A, B, OA, OB];
  const schedule = [
    { id: 'g-A-OA', day: 2, homeId: 'A', awayId: 'OA' },
    { id: 'g-B-OB', day: 2, homeId: 'B', awayId: 'OB' },
  ];
  const st = {
    season: 2, day: 1,
    world: { schools, recruits: [] }, schedule,
    playerSchoolId: 'A', _coachId: 'coach-A',
    playerCoach: A.coach,
    settings: { injuries: false, liveWatch: false, difficulty: 'varsity' },
    inbox: [], coachHistory: [], rivalry: null,
    signingsLog: [], awardsLog: [], autoRecruitLog: [], bowls: [],
    ui: {},
  };
  if (multi) {
    st.tree = { id: 't', active: 'D1', slots: {
      D1: { schoolId: 'A', coachId: 'coach-A', division: 'D1', inbox: [], coachHistory: [] },
      D3: { schoolId: 'B', coachId: 'coach-B', division: 'D3', inbox: [], coachHistory: [] },
    } };
  }
  return st;
}
const noop = () => {};
// Play the currently-paused game to its finish (with callMode/liveWatch off, one
// resume sims the second half). No chaining, so nothing else is paused after.
function playOneGame(st) {
  let guard = 0;
  const startG = st.pendingHalftime && st.pendingHalftime.game && st.pendingHalftime.game.id;
  while (st.pendingHalftime && (st.pendingHalftime.game && st.pendingHalftime.game.id) === startG && guard++ < 50) {
    resumeFromHalftime(st, null, null);
  }
}

// ── 1. SINGLE-COACH: the multi-coach gate never engages ──────────────────────
{
  const st = mkState(false);
  const ev = advanceDay(st, noop);
  const gated = (ev || []).some(e => e.coachWeekGate);
  check('single-coach: advance is not gated by the multi-coach rule', !gated && !st.coachWeek);
}

// ── 2. MULTI-COACH: advance is GATED until each program is played ────────────
{
  const st = mkState(true);
  check('coachedGamesForDay finds both programs on day 2', coachedGamesForDay(st, 2).length === 2);
  const ev = advanceDay(st, noop);
  check('advance-week is gated while games are unplayed', (ev || []).some(e => e.coachWeekGate) && st.day === 1, `day=${st.day}`);
  check('the gate does not auto-play anything (no pause)', !st.pendingHalftime);

  const gA = st.schedule.find(g => g.id === 'g-A-OA');
  const gB = st.schedule.find(g => g.id === 'g-B-OB');
  // Launch game A from the agenda; it pauses at halftime.
  const rA = beginCoachedGame(st, 'g-A-OA');
  check('kickoff pauses only the launched game', !!st.pendingHalftime && st.pendingHalftime.game.id === 'g-A-OA' && rA.pending === true);
  playOneGame(st);
  // No chaining: after game A, nothing else is paused and the week has not moved.
  check('games do NOT chain — after game A, no pause and still week 1', !st.pendingHalftime && st.day === 1, `pending=${!!st.pendingHalftime} day=${st.day}`);
  check('game A booked, game B still open', !!gA.result && !gB.result);
  const ev2 = advanceDay(st, noop);
  check('advance still gated with one game left', (ev2 || []).some(e => e.coachWeekGate) && st.day === 1);

  // Launch game B, coach it.
  beginCoachedGame(st, 'g-B-OB');
  check('kickoff pauses game B', !!st.pendingHalftime && st.pendingHalftime.game.id === 'g-B-OB');
  playOneGame(st);
  check('both coached games are now booked', !!gA.result && !!gB.result);

  advanceDay(st, noop);
  const A = st.world.schools.find(s => s.id === 'A');
  const B = st.world.schools.find(s => s.id === 'B');
  check('the week advances once every program is resolved', st.day === 2 && !st.pendingHalftime, `day=${st.day} pending=${!!st.pendingHalftime}`);
  check('the coached-week context was cleared', !st.coachWeek);
  const recOK = (s) => (s.record.wins + s.record.losses) === 1;
  check('standings applied exactly once per coached school', recOK(A) && recOK(B), `A ${A.record.wins}-${A.record.losses} · B ${B.record.wins}-${B.record.losses}`);
  check('the originally-active chair is restored after the week', st.playerSchoolId === 'A' && st.tree.active === 'D1', `active=${st.tree.active} school=${st.playerSchoolId}`);
}

// ── 3. MULTI-COACH, agenda "Sim": book a game without coaching it ────────────
{
  const st = mkState(true);
  const rA = beginCoachedGame(st, 'g-A-OA', true);
  check('agenda sim books a result with no pause', rA.simmed === true && !st.pendingHalftime && !!st.schedule.find(g => g.id === 'g-A-OA').result);
  beginCoachedGame(st, 'g-B-OB');
  playOneGame(st);
  advanceDay(st, noop);
  check('a simmed game + a coached game together let the week advance', st.day === 2 && !st.pendingHalftime);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
