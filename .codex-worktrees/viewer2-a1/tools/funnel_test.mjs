// funnel_test.mjs
// Proves resolveFunnel correctly drives battle-decided signing — passing the
// existing multiseason/advance tests is necessary but not sufficient, because
// backfill and the walk-on floor keep rosters healthy even if the funnel
// commits nobody. Rewritten Jul 2026: the pre-rolled narrowSchedule commit
// calendar is retired; a recruit signs when the battle itself resolves —
// a leader over the commit bar holds a lead for consecutive weeks (durable
// lead / field collapse), or the RECRUITING_LOCK_DAY hard lock fires.
//
// 1. Player leads with an offer, holds a blowout gap 2 consecutive weeks → wins.
// 2. Rival wins silently when player never pursued → losers=[].
// 3. Player is eliminated at the live top3 narrowing when rivals hold the top 3.
// 4. Player's scholarship is refunded when they offered but a rival wins.
// 5. Drift stages a room BID; resolveRooms moves interest (lone suitor climbs
//    at the quiet-room rate); eliminated rivals neither bid nor move.

import { generateWorld, generateRecruitPool } from '../js/engine/world.js';
import { resolveFunnel, resolveRooms } from '../js/engine/recruiting.js';
import { C } from '../js/constants.js';

const world = generateWorld();
world.recruits = generateRecruitPool(world);

const [s0, s1, s2, s3] = world.schools;
const playerSchoolId   = s0.id;

// Drive days from the live knobs so the probe can't rot against a calendar retune.
const FLOOR = C.RECRUITING_EARLY_FLOOR;   // first battle-driven commit day
const TOP3  = C.FUNNEL_TOP3_DAY;          // live narrowing to a top-3

let passed = 0, failed = 0;
function assert(label, cond) {
  if (cond) { console.log(`  PASS  ${label}`); passed++; }
  else       { console.error(`  FAIL  ${label}`); failed++; }
}

// Returns a fresh shallow copy of a pool recruit with controlled funnel state.
// The rivals array is replaced wholesale so the copy is fully isolated.
function freshRecruit(idx) {
  const src = world.recruits[idx];
  return {
    ...src,
    committed: undefined, decisionStatus: 'undecided', funnelStage: 'open',
    _leadKey: undefined, _ledLastWeek: undefined, _leadWeeks: 0,
  };
}

// ── Test 1: player leads with offer → durable lead closes it ──────────────
console.log('\nTest 1: player wins after holding a blowout lead 2 consecutive weeks');
{
  const recruit = freshRecruit(0);
  recruit.rivals = [
    { schoolId: s1.id, interest: 30, gain: 0, eliminated: false },
    { schoolId: s2.id, interest: 25, gain: 0, eliminated: false },
  ];

  const coach = { scholarshipsAvailable: 5 };
  const board = [{
    recruitId: recruit.id, schoolId: playerSchoolId,
    interest: 75, offered: true, eliminated: false,
  }];

  // Week 1 of the held lead (also the day the live funnel tightens to a top-8:
  // 75 > 30 > 25 → player survives). Blowout gap needs COMMIT_HOLD_BLOWOUT
  // consecutive weeks, so nothing signs yet.
  let commits = resolveFunnel([recruit], playerSchoolId, board, coach, FLOOR);
  assert('no commit on the first held week',    commits.length === 0);
  assert('player not eliminated at top8',       board[0].eliminated !== true);
  assert('funnelStage advances to top8',        recruit.funnelStage === 'top8');

  // Week 2, consecutive: the blowout lead is now durable — player signs him.
  commits = resolveFunnel([recruit], playerSchoolId, board, coach, FLOOR + 1);
  assert('commit fires',                        commits.length === 1);
  assert('player wins',                         commits[0]?.schoolId === playerSchoolId);
  assert('recruit.committed set to player',     recruit.committed === playerSchoolId);
  assert('recruit.decisionStatus signed',       recruit.decisionStatus === 'signed');
  assert('scholarship untouched (player won)',  coach.scholarshipsAvailable === 5);
}

// ── Test 2: rival wins silently when player never pursued ─────────────────
console.log('\nTest 2: rival wins, player has no board entry → losers=[]');
{
  const recruit = freshRecruit(1);
  recruit.rivals = [{ schoolId: s1.id, interest: 60, gain: 0, eliminated: false }];

  const coach = { scholarshipsAvailable: 5 };
  resolveFunnel([recruit], playerSchoolId, [], coach, TOP3 - 2);
  const commits = resolveFunnel([recruit], playerSchoolId, [], coach, TOP3 - 1);

  assert('rival commit fires',                       commits.length === 1);
  assert('rival school wins, not player',            commits[0]?.schoolId === s1.id);
  assert('losers is empty (player not involved)',    (commits[0]?.losers ?? []).length === 0);
  assert('scholarship untouched',                    coach.scholarshipsAvailable === 5);
}

// ── Test 3: player eliminated at the live top3 narrowing ──────────────────
console.log('\nTest 3: player eliminated at top3 when rivals hold the top 3 spots');
{
  const recruit = freshRecruit(2);
  // 3 rivals outpace the player (20). FUNNEL_SIZE.top3 = 3; all rivals survive,
  // player is cut. Gaps are inside COMMIT_CLEAR_GAP so no battle-commit fires
  // on this single (first-held-week) call.
  recruit.rivals = [
    { schoolId: s1.id, interest: 80, gain: 0, eliminated: false },
    { schoolId: s2.id, interest: 70, gain: 0, eliminated: false },
    { schoolId: s3.id, interest: 65, gain: 0, eliminated: false },
  ];

  const coach = { scholarshipsAvailable: 5 };
  const board = [{
    recruitId: recruit.id, schoolId: playerSchoolId,
    interest: 20, offered: false, eliminated: false,
  }];

  resolveFunnel([recruit], playerSchoolId, board, coach, TOP3);
  assert('player eliminated at top3',       board[0].eliminated === true);
  assert('funnelStage advances to top3',    recruit.funnelStage === 'top3');
  assert('rivals not eliminated',           recruit.rivals.every(r => !r.eliminated));
}

// ── Test 4: scholarship refunded when offered recruit goes to rival ────────
console.log('\nTest 4: scholarship refunded when rival beats an offered player');
{
  const recruit = freshRecruit(3);
  recruit.rivals = [{ schoolId: s1.id, interest: 90, gain: 0, eliminated: false }];

  const coach = { scholarshipsAvailable: 3 };
  const board = [{
    recruitId: recruit.id, schoolId: playerSchoolId,
    interest: 40, offered: true, eliminated: false,
  }];

  resolveFunnel([recruit], playerSchoolId, board, coach, TOP3 - 2);
  const commits = resolveFunnel([recruit], playerSchoolId, board, coach, TOP3 - 1);
  assert('rival wins',                          commits[0]?.schoolId === s1.id);
  assert('player listed in losers',             (commits[0]?.losers ?? []).includes(playerSchoolId));
  assert('scholarship refunded to 4',           coach.scholarshipsAvailable === 4);
  assert('offer cleared on board entry',        board[0].offered === false);
  assert('recruit committed to rival school',   recruit.committed === s1.id);
}

// ── Test 5: drift stages a bid; the room moves interest ───────────────────
console.log('\nTest 5: drift stages a room bid; resolveRooms moves interest');
{
  const recruit = freshRecruit(4);
  recruit.rivals = [{ schoolId: s1.id, interest: 20, gain: 2.5, eliminated: false }];

  // Drift no longer bumps interest directly — it stages a dollar-scale BID
  // for the weekly share-of-room battle (interest itself must not move here).
  resolveFunnel([recruit], playerSchoolId, [], {}, FLOOR + 1);
  assert('drift stages a bid, interest untouched',
    (recruit.rivals[0]._bid || 0) > 0 && Math.abs(recruit.rivals[0].interest - 20) < 1e-9);

  // The room resolves the bid: a lone (uncontested) suitor climbs at exactly
  // the quiet-room rate. (Season.js runs resolveRooms before resolveFunnel
  // every recruiting day.)
  resolveRooms([recruit], [], playerSchoolId);
  const QUIET = C.SHARE_GAIN_MAX * C.SHARE_QUIET_BONUS;
  assert('lone suitor climbs at the quiet-room rate',
    Math.abs(recruit.rivals[0].interest - (20 + QUIET)) < 1e-9);

  // Eliminated rivals neither bid nor move.
  recruit.rivals[0].eliminated = true;
  const before = recruit.rivals[0].interest;
  resolveFunnel([recruit], playerSchoolId, [], {}, FLOOR + 2);
  resolveRooms([recruit], [], playerSchoolId);
  assert('eliminated rival stops moving',
    recruit.rivals[0].interest === before && !(recruit.rivals[0]._bid > 0));
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} checks: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
