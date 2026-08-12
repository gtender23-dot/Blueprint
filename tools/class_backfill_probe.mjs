// class_backfill_probe.mjs — PLAYTEST 2026-08-12 item 27: AI SIGNING-DAY
// BACKFILL RESPECTS NEED.
//
// The owner took over a D2 school that had signed SEVEN defensive ends with zero
// DE need. Seven is a fingerprint: ROSTER_POS_MAX.DE is 7, and fillRemainingSlots
// only ever asked "am I at max?" — never "do I need one?". It also counted the
// WHOLE roster including departing seniors, so its numbers never matched the
// needs board the coach reads.
//
// Board-building (needWeight) was always need-aware. This probe covers the
// backfill, which is the path that actually produced the class.
//
// Run: node tools/class_backfill_probe.mjs
import { createPlayer, createRecruit } from '../js/engine/player.js';
import { fillRemainingSlots } from '../js/engine/recruiting.js';
import { ROSTER_TARGETS, ROSTER_POS_MAX, CLASS_YEARS, schemeRosterTargets } from '../js/constants.js';

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};

const POSITIONS = Object.keys(ROSTER_TARGETS);

function mkSchool(over = {}) {
  const roster = [];
  for (const [pos, c] of Object.entries(ROSTER_TARGETS)) {
    const n = over[pos] != null ? over[pos] : c;
    for (let i = 0; i < n; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], 1);
      p.schoolId = 'S';
      roster.push(p);
    }
  }
  return { id: 'S', name: 'S', division: 'D2', roster, lat: 35, lng: -85, gameplan: {} };
}

// A deep, evenly spread pool so the backfill has a real choice at every position
// — if it still stacks one room, that is the code, not the supply.
function mkPool(perPos = 6) {
  const out = [];
  let n = 0;
  for (const pos of POSITIONS) {
    for (let i = 0; i < perPos; i++) {
      const r = createRecruit(pos, 2, 40, -82, 0);
      r.id = `r${n++}`;
      r.position = pos;
      r.committed = null;
      r.decisionStatus = 'undecided';
      r.lat = 35 + (i % 5) * 0.4;
      r.lng = -85 - (i % 5) * 0.4;
      out.push(r);
    }
  }
  return out;
}

const countBy = (list, key) => {
  const m = {};
  for (const x of list) m[x[key]] = (m[x[key]] || 0) + 1;
  return m;
};

// ── 1. THE SEVEN-END CASE ────────────────────────────────────────────────────
// A roster already AT its DE target but below ROSTER_POS_MAX. The old code saw
// "not at max" and happily kept signing ends.
{
  const school = mkSchool();
  const before = countBy(school.roster, 'position');
  const targets = schemeRosterTargets(school) || ROSTER_TARGETS;
  const signed = fillRemainingSlots(school, mkPool(), 20);
  const got = countBy(signed, 'position');

  check('the backfill signs the class it was given room for', signed.length === 20, `${signed.length}/20`);

  const overMax = POSITIONS.filter((p) => ROSTER_POS_MAX[p] != null && (before[p] || 0) + (got[p] || 0) > ROSTER_POS_MAX[p]);
  check('no room is taken past its hard cap', overMax.length === 0,
    overMax.length ? `OVER CAP: ${overMax.map((p) => `${p} ${(before[p] || 0) + (got[p] || 0)}/${ROSTER_POS_MAX[p]}`).join(', ')}` : 'every room inside ROSTER_POS_MAX');

  // The real assertion: a position with no hole should not be stockpiled.
  const returningOf = (p) => school.roster.filter((x) => x.position === p && x.classYear !== 'SR').length;
  const glut = POSITIONS.filter((p) => {
    const deficit = Math.max(0, (targets[p] || 0) - returningOf(p));
    return (got[p] || 0) > deficit + 2;
  });
  check('no position is stockpiled more than 2 past its actual hole', glut.length === 0,
    glut.length ? `GLUT: ${glut.map((p) => `${p} +${got[p]} for a hole of ${Math.max(0, (targets[p] || 0) - returningOf(p))}`).join(', ')}` : 'every room within 2 of its need');
  // The reported bug, named directly. NOTE this is a need test, not a cap test:
  // an earlier draft asserted DE simply never reaches ROSTER_POS_MAX, which is
  // wrong — pass 3 exists to fill a class out and may legitimately top a room up
  // to its cap when there is class space and a real hole. What must never happen
  // is signing ends the roster does not need. (+1 for that last-resort top-up.)
  const deDeficit = Math.max(0, (targets.DE || 0) - returningOf('DE'));
  check('DE is not signed past its actual hole', (got.DE || 0) <= deDeficit + 1,
    `${got.DE || 0} ends signed for a hole of ${deDeficit} (roster ends at ${(before.DE || 0) + (got.DE || 0)}/${ROSTER_POS_MAX.DE})`);
}

// ── 2. Real holes get filled first ───────────────────────────────────────────
{
  // Gut two rooms. They should be where the class goes.
  const school = mkSchool({ CB: 1, LB: 1 });
  const signed = fillRemainingSlots(school, mkPool(), 8);
  const got = countBy(signed, 'position');
  check('a gutted room is addressed', (got.CB || 0) + (got.LB || 0) >= 4,
    `CB ${got.CB || 0} + LB ${got.LB || 0} of 8 signees`);
  check('and the deepest holes outrank mere proximity', (got.CB || 0) > 0 && (got.LB || 0) > 0);
}

// ── 2b. THE DISCRIMINATING CASE — need beats proximity ───────────────────────
// The owner's D2 school signed ends it did not need. Reproduce the shape that
// causes it: the nearest recruits on the board are ALL at a position with no
// hole, while two other rooms are gutted. Distance-first ordering signs the ends;
// need-first ordering signs the corners and backers.
{
  const school = mkSchool({ CB: 1, LB: 1 });
  const pool = [];
  let n = 0;
  for (const pos of POSITIONS) {
    const near = pos === 'DE';
    for (let i = 0; i < 10; i++) {
      const r = createRecruit(pos, 2, 40, -82, 0);
      r.id = `d${n++}`;
      r.position = pos;
      r.committed = null;
      r.decisionStatus = 'undecided';
      // Ends live next door; everyone else is a plane ride away.
      r.lat = near ? 35.01 : 44;
      r.lng = near ? -85.01 : -105;
      pool.push(r);
    }
  }
  const signed = fillRemainingSlots(school, pool, 10);
  const got = countBy(signed, 'position');
  check('a room with no hole signs nobody, however close they live', !(got.DE > 0),
    got.DE > 0 ? `signed ${got.DE} DE with no DE need — this is the seven-end bug` : 'zero unneeded ends');
  check('the gutted rooms got the class instead', (got.CB || 0) + (got.LB || 0) >= 6,
    `CB ${got.CB || 0} + LB ${got.LB || 0} of ${signed.length}`);
}

// ── 3. Counting law: departing seniors are not returning players ─────────────
// The needs board a coach reads counts RETURNING bodies. The backfill has to use
// the same number or it is answering a different question than the screen.
{
  const school = mkSchool();
  // Make an entire room graduate. Post-graduation it is empty, so it is the
  // biggest hole on the roster and should draw the class.
  for (const p of school.roster) if (p.position === 'TE') p.classYear = 'SR';
  const signed = fillRemainingSlots(school, mkPool(), 6);
  const got = countBy(signed, 'position');
  check('a room that is entirely graduating reads as a hole', (got.TE || 0) > 0,
    `TE signees: ${got.TE || 0} (the room graduates in full)`);
}

// ── 4. Nothing is signed when there is no room ───────────────────────────────
{
  const school = mkSchool();
  check('zero open slots signs nobody', fillRemainingSlots(school, mkPool(), 0).length === 0);
  check('negative open slots signs nobody', fillRemainingSlots(school, mkPool(), -3).length === 0);
}

console.log(`\n${fail === 0 ? 'ALL PASS ✅' : `${fail} FAILURES ❌`}  (${pass} pass, ${fail} fail)`);
process.exit(fail === 0 ? 0 : 1);
