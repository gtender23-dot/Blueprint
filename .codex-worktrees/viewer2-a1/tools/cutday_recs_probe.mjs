// cutday_recs_probe.mjs — Cut Day staff-recommendation gate (Aug 2026).
// Run: node tools/cutday_recs_probe.mjs
//
// Pins the three-leg rule and the read-only law:
//   1. A buried body a needy room wants IS recommended (overstuffed CB room
//      + short S room → a CB→S pitch exists, pointed the right way).
//   2. A balanced roster produces no LATERAL pitches — only strict miscasts
//      (starts there, +2 after the haircut); volume stays a trickle.
//   3. Legs bind: nobody in the two-deep is pitched away; a projection worse
//      than current−3 is dropped; K/P sit out both sides; cap 6; players
//      already converted this offseason are skipped.
//   4. Read-only: calling it twice changes nothing (no state mutation).
import { cutDayConversionRecs, initOffseason, devCtx } from '../js/engine/offseason.js';
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { ROSTER_TARGETS, CLASS_YEARS, STARTER_COUNTS } from '../js/constants.js';

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
};

function genRoster(schoolId, mutate = null) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 3], 1); // FR/SO/JR only — no grads muddying counts
      p.schoolId = schoolId; r.push(p);
    }
  }
  if (mutate) mutate(r);
  return r;
}
function mkState(roster) {
  const school = { id: 'T', name: 'Test', roster, gameplan: { offFormation: 'Single Back' }, lat: 0, lng: 0 };
  school.depthChart = buildDepthChart(roster, school.gameplan);
  const st = { world: { schools: [school] }, playerSchoolId: 'T', season: 1, playerCoach: { skills: {} } };
  return { st, school };
}

// ── 1+3. the engineered case: CB room overstuffed, S room short ─────────────
{
  const roster = genRoster('T', (r) => {
    // Move two safeties out (S room now 2 short of target)...
    const sPool = r.filter((p) => p.position === 'S');
    sPool[0].position = 'CB'; sPool[1].position = 'CB';
    // ...so the CB room is 2 OVER target, and its buried tail has S-shaped
    // ratings (the transplanted safeties keep their S-leaning attributes).
  });
  const { st } = mkState(roster);
  const recs = cutDayConversionRecs(st);
  check('an overstuffed room with a needy neighbor produces pitches', recs.length > 0, `${recs.length} recs`);
  const cbToS = recs.filter((x) => x.from === 'CB' && x.to === 'S');
  check('the pitch points the right way (CB → S exists)', cbToS.length > 0, recs.map((x) => `${x.from}→${x.to}`).join(', '));
  check('cap 6 respected', recs.length <= 6, `${recs.length}`);
  check('no K/P on either side', recs.every((x) => !['K', 'P'].includes(x.from) && !['K', 'P'].includes(x.to)), '');
  check('no projection worse than current−3', recs.every((x) => x.projected >= x.current - 3), '');
  // nobody pitched out of his own two-deep
  const rosterByPos = {};
  for (const p of roster) (rosterByPos[p.position] = rosterByPos[p.position] || []).push(p);
  const inTwoDeep = (rec) => {
    const room = (rosterByPos[rec.from] || []).slice().sort((a, b) => b.compositeRating - a.compositeRating);
    const idx = room.findIndex((p) => p.id === rec.playerId);
    return idx > -1 && idx < (STARTER_COUNTS[rec.from] || 1) + 1 && room.length <= (ROSTER_TARGETS[rec.from] || 0);
  };
  check('nobody is pitched out of a two-deep his room needs', recs.every((x) => !inTwoDeep(x)), '');
  // 3b. already-converted players are skipped
  if (recs.length) {
    // Write through the real seam. The preseason is per-SCHOOL now (a coaching
    // tree runs up to three chairs and each owes its own camp), so assigning
    // `st.preseason` sets a legacy mirror the reader no longer consults.
    const ctx = devCtx(st);
    ctx.posChanges = [{ playerId: recs[0].playerId, from: recs[0].from, to: recs[0].to, anytime: false }];
    const recs2 = cutDayConversionRecs(st);
    check('a player already converted this offseason is not re-pitched', recs2.every((x) => x.playerId !== recs[0].playerId), '');
    ctx.posChanges = [];
  }
  // ── 4. read-only ──
  const snap = JSON.stringify(roster.map((p) => [p.id, p.position, Math.round(p.compositeRating * 1000)]));
  cutDayConversionRecs(st); cutDayConversionRecs(st);
  const snap2 = JSON.stringify(roster.map((p) => [p.id, p.position, Math.round(p.compositeRating * 1000)]));
  check('read-only — two extra calls mutate nothing', snap === snap2, '');
}

// ── 2. balanced roster → no LATERAL pitches ─────────────────────────────────
// Target-shaped rooms have no shortages, so every pitch must be a genuine
// MISCAST: he'd START in the target room and projects at least +2 even after
// the conversion haircut. Random rosters legitimately roll a few miscast
// players (attributes don't consult position on the way in) — the staff
// flagging those is the feature. What it must NOT do is shuffle laterals.
// Pinned RNG. The volume half of this section is a THRESHOLD on random rosters,
// and unseeded it sat one coin-flip from its own ceiling — the OVR_POS_ADJ
// re-derive (playtest item 3) shifted the miscast rate enough that ~20 recs
// across 5 rosters became the typical draw against a ceiling of 20. A gate check
// that fails one run in three teaches people to re-run gates, so the rosters are
// pinned and the number means something again.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
{
  let total = 0, lateral = 0, trials = 5;
  const realRandom = Math.random;
  Math.random = mulberry32(20260812);
  for (let t = 0; t < trials; t++) {
    const { st } = mkState(genRoster('T'));
    const recs = cutDayConversionRecs(st);
    total += recs.length;
    for (const r of recs) {
      const startsThere = r.toRank <= (STARTER_COUNTS[r.to] || 1);
      if (!(r.deficit > 0) && !(startsThere && r.projected >= r.current + 2)) lateral++;
    }
  }
  Math.random = realRandom;
  check('no lateral pitches — every no-shortage rec is a strict miscast', lateral === 0, `${lateral} lateral of ${total}`);
  check('volume stays sane on balanced rosters (cap-bounded trickle)', total <= trials * 4, `${total} recs across ${trials} rosters`);
}

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'}  (${pass} pass, ${fail} fail)`);
process.exit(fail ? 1 : 0);
