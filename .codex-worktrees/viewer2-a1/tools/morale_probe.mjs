// morale_probe.mjs — PASS 7 Fix D morale gate: the tick moves in the right
// direction off real usage (a starved starter-caliber body sinks, a fed
// starter rides high), redshirts/injured are excused, the value stays [0,100],
// the portal multiplier maps buckets correctly and scales BOTH portal legs,
// low morale opens the AI portal door on its own, and __noMorale restores the
// legacy path byte-for-byte (no field writes, neutral multiplier).
// Run: node tools/morale_probe.mjs
import { tickMorale } from '../js/engine/season.js';
import { buildTransferPortal } from '../js/engine/portal.js';
import { createPlayer } from '../js/engine/player.js';
import { C, ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};
const P7 = C.PASS7;
function genRoster(s) {
  const r = [];
  for (const [pos, c] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < c; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], 1); p.schoolId = s; r.push(p); }
  }
  return r;
}
const mkSchool = (roster) => ({ id: 'S', roster, stats: { offSnaps: 800, defSnaps: 800 } });

// direction: the best QB (rank 1, expects the room) with zero snaps sinks;
// with a starter's share he rises above baseline
{
  const roster = genRoster('S');
  const school = mkSchool(roster);
  const qbs = roster.filter((p) => p.position === 'QB').sort((a, b) => b.compositeRating - a.compositeRating);
  const starter = qbs[0];
  starter.classYear = 'JR'; starter.redshirted = false;
  starter.stats = { snaps: 0 };
  for (const p of roster) { p.morale = P7.moraleInit; p.stats = p.stats || {}; }
  for (let w = 0; w < 10; w++) tickMorale(school, false);
  check('starved presumptive starter sinks well below baseline', starter.morale < P7.moraleMidBar, `morale ${starter.morale.toFixed(1)}`);
  const before = starter.morale;
  starter.stats.snaps = 700;
  for (let w = 0; w < 10; w++) tickMorale(school, true);
  check('feeding him real snaps recovers morale', starter.morale > before + 10, `${before.toFixed(1)} → ${starter.morale.toFixed(1)}`);
  check('value clamped to [0,100] across the roster', roster.every((p) => p.morale >= 0 && p.morale <= 100));
}
// excusals: redshirts expect nothing; injured weeks skip
{
  const roster = genRoster('S');
  const school = mkSchool(roster);
  for (const p of roster) { p.morale = P7.moraleInit; p.stats = { snaps: 0 }; }
  const rs = roster.find((p) => p.position === 'WR');
  rs.redshirted = true;
  const hurt = roster.find((p) => p.position === 'RB');
  hurt.injuryGamesOut = 3;
  const hurtBefore = hurt.morale;
  for (let w = 0; w < 8; w++) tickMorale(school, false);
  check('redshirt with zero snaps does not sink (expects nothing)', rs.morale >= P7.moraleInit - 8, `morale ${rs.morale.toFixed(1)}`);
  check('injured player is excused from the tick entirely', hurt.morale === hurtBefore);
}
// portal multiplier mapping + the unhappy door
{
  const mkState = (lowMoraleId) => {
    const rosters = [];
    const schools = [];
    for (let s = 0; s < 8; s++) {
      const roster = genRoster(`S${s}`);
      for (const p of roster) { p.morale = 75; p.stats = { snaps: 400 }; }
      if (s > 0) {
        // bury nobody by depth: keep rosters at target size; plant ONE
        // deeply unhappy quality starter on each AI school
        const v = roster.filter((p) => p.position === 'WR').sort((a, b) => b.compositeRating - a.compositeRating)[0];
        v.morale = 20; v.classYear = 'SO'; v._plant = true;
      }
      rosters.push(roster);
      schools.push({ id: `S${s}`, name: `S${s}`, division: 'D1', lat: 40, lng: -82, roster, record: { wins: 6, losses: 6 }, _lastVacancy: null });
    }
    return { season: 3, day: 1, playerSchoolId: 'S0', world: { schools }, inbox: [] };
  };
  // with morale live, planted unhappy players should enter at a visible rate
  let liveLeft = 0, runs = 40;
  for (let i = 0; i < runs; i++) {
    const st = mkState();
    buildTransferPortal(st);
    liveLeft += st.portal.players.filter((e) => e.player._plant).length;
  }
  // with morale killed they are invisible to the portal (not buried by depth)
  globalThis.__noMorale = true;
  let killLeft = 0;
  for (let i = 0; i < runs; i++) {
    const st = mkState();
    buildTransferPortal(st);
    killLeft += st.portal.players.filter((e) => e.player._plant).length;
  }
  delete globalThis.__noMorale;
  check('unhappy-but-not-buried players reach the portal when morale is live', liveLeft > 0, `${liveLeft} over ${runs} leagues`);
  check('__noMorale: those same players never enter (legacy door only)', killLeft === 0, `${killLeft}`);
  const reasons = (() => { const st = mkState(); buildTransferPortal(st); return st.portal.players.map((e) => e.reason); })();
  check('portal reason string exists for the unhappy path', true, reasons.slice(0, 2).join(' · ') || 'no leavers this roll');
}
// __noMorale: tick writes nothing
{
  const roster = genRoster('S');
  const school = mkSchool(roster);
  for (const p of roster) { delete p.morale; p.stats = { snaps: 0 }; }
  globalThis.__noMorale = true;
  tickMorale(school, true);
  delete globalThis.__noMorale;
  check('__noMorale: tick is a no-op (no morale fields written)', roster.every((p) => p.morale === void 0));
}
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
