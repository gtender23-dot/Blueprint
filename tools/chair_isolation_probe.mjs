// chair_isolation_probe.mjs — PLAYTEST 2026-08-12: ONE CHAIR'S WEEK IS NOT
// ANOTHER CHAIR'S WEEK.
//
// Owner: "finalize buttons should only finalize the action for that week. I
// finalized redshirts for 1 coach and went to do the other and both coaches had
// been finalized."
//
// Two separate defects produced that, and both are the same mistake — treating
// `state.playerSchoolId` as if it were the only program the player runs, when a
// coaching tree can have three chairs live in the same season:
//
//   1. The preseason lived at `state.preseason` — ONE object for the whole save.
//      Training focus, position changes, the camp report, the spring result and
//      the redshirt review were shared across every chair. Set the focus for one
//      coach and you set it for all of them.
//   2. `startNewSeason` handed `pendingRedshirts` only to whichever chair
//      happened to be active at rollover. Every OTHER school the same player
//      coaches was run through `autoRedshirtFreshmen` like an AI program — its
//      freshmen redshirted immediately, its window closed before it opened. Switch
//      to that chair and the screen reads "Redshirts finalized ✓" for a decision
//      that was never offered.
//
// Run: node tools/chair_isolation_probe.mjs
import { devCtx, initPreseason, setDevFocus, convertPosition } from '../js/engine/offseason.js';
import { coachedSchoolIds } from '../js/engine/season.js';

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};

// A two-chair tree: the shape `liveSlots` reads, without pulling in worldgen.
const mkState = () => {
  const schools = [
    { id: 'A', name: 'Alpha', division: 'D1', roster: [], gameplan: {}, depthOrder: {} },
    { id: 'B', name: 'Bravo', division: 'D3', roster: [], gameplan: {}, depthOrder: {} },
    { id: 'Z', name: 'Zulu (AI)', division: 'D2', roster: [], gameplan: {}, depthOrder: {} },
  ];
  return {
    season: 3, day: 1, world: { schools }, playerSchoolId: 'A',
    tree: { id: 't', slots: { D1: { schoolId: 'A', coachId: 'c1' }, D3: { schoolId: 'B', coachId: 'c2' } } },
  };
};
const at = (st, id) => { st.playerSchoolId = id; return devCtx(st); };
const school = (st, id) => st.world.schools.find((s) => s.id === id);

// ── 1. Each chair gets its own context object ────────────────────────────────
{
  const st = mkState();
  const a = at(st, 'A'), b = at(st, 'B');
  check('two chairs get two different preseason contexts', a !== b);
  check('and each is stored on its own school',
    school(st, 'A').preseason === a && school(st, 'B').preseason === b);
  check('switching back returns the SAME object, not a fresh one', at(st, 'A') === a);
}

// ── 2. THE REPORTED SYMPTOM: finalizing one must not finalize the other ──────
{
  const st = mkState();
  at(st, 'A'); at(st, 'B');           // both chairs open their window
  at(st, 'A').posReviewed = true;      // coach A confirms his positions
  check('confirming for one chair leaves the other unconfirmed',
    at(st, 'A').posReviewed === true && !at(st, 'B').posReviewed,
    `A ${at(st, 'A').posReviewed ? 'confirmed' : 'open'} · B ${at(st, 'B').posReviewed ? 'confirmed' : 'open'}`);

  at(st, 'B').devDone = true;          // coach B runs his camp
  check('and running camp for one does not run it for the other',
    at(st, 'B').devDone === true && !at(st, 'A').devDone);
}

// ── 3. Training focus is per chair ───────────────────────────────────────────
{
  const st = mkState();
  st.playerSchoolId = 'A';
  setDevFocus(st, 'qb');
  st.playerSchoolId = 'B';
  setDevFocus(st, 'oline');
  check('two coaches can run two different camps',
    at(st, 'A').devFocus === 'qb' && at(st, 'B').devFocus === 'oline',
    `A=${at(st, 'A').devFocus} · B=${at(st, 'B').devFocus}`);
}

// ── 4. Position changes do not bleed between chairs ──────────────────────────
{
  const st = mkState();
  const p = { id: 'p1', position: 'OLB', classYear: 'SO', weight: 250, attributes: {}, name: { first: 'T', last: 'B' } };
  school(st, 'A').roster.push(p);
  st.playerSchoolId = 'A';
  try { convertPosition(st, 'p1', 'DE'); } catch (e) { /* rating maths not the point here */ }
  check("a conversion is logged against the chair that made it",
    (at(st, 'A').posChanges || []).length === 1 && (at(st, 'B').posChanges || []).length === 0,
    `A ${(at(st, 'A').posChanges || []).length} · B ${(at(st, 'B').posChanges || []).length}`);
}

// ── 5. initPreseason reaches every chair, and only the chairs ────────────────
{
  const st = mkState();
  at(st, 'A').devDone = true;
  at(st, 'B').devDone = true;
  initPreseason(st);
  check('a new season resets every chair', !school(st, 'A').preseason.devDone && !school(st, 'B').preseason.devDone);
  check('and never invents one for an AI program', school(st, 'Z').preseason == null);
}

// ── 6. An old save migrates without handing a stranger's camp to a new chair ──
{
  const st = mkState();
  // Pre-split shape: one global context, already half-used.
  st.preseason = { devFocus: 'skill', devDone: true, posChanges: [{ playerId: 'x', from: 'WR', to: 'CB' }], campReport: null, campAvgGain: 3, springResult: null };
  const a = at(st, 'A');
  check('the chair that was active adopts the old global context', a.devDone === true && a.devFocus === 'skill');
  const b = at(st, 'B');
  check('every OTHER chair starts clean instead of inheriting it',
    b.devDone === false && (b.posChanges || []).length === 0,
    `B devDone=${b.devDone} posChanges=${(b.posChanges || []).length}`);
}

// ── 7. THE REDSHIRT WINDOW OPENS AT EVERY CHAIR ──────────────────────────────
// The second half of the report. `startNewSeason` decides who gets a real
// decision and who gets auto-redshirted like an AI program; it used to ask
// `school.id === state.playerSchoolId`, a single pointer. The rule is now a set.
{
  const st = mkState();
  const mine = new Set(coachedSchoolIds(st));
  check('every chair in the tree is handed its own redshirt decision',
    mine.has('A') && mine.has('B'), `[${[...mine].join(', ')}]`);
  check('and a program nobody coaches still gets the AI treatment', !mine.has('Z'));

  // A retired chair is not a chair. Its old school goes back to the AI.
  const st2 = mkState();
  st2.tree.slots.D3.retired = true;
  check('a retired chair does not keep claiming its school',
    !new Set(coachedSchoolIds(st2)).has('B'));

  // The active school always counts, even if the tree has not been built yet —
  // a plain single-chair save must not lose its own redshirt window.
  const st3 = { season: 1, world: { schools: [{ id: 'A' }] }, playerSchoolId: 'A' };
  check('a save with no tree still gets a window at the school it coaches',
    coachedSchoolIds(st3).includes('A'));
}

console.log(`\n${fail === 0 ? 'ALL PASS ✅' : `${fail} FAILURES ❌`}  (${pass} pass, ${fail} fail)`);
process.exit(fail === 0 ? 0 : 1);
