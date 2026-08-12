import { C } from '../constants.js';
import { skillGradeIndex, ensureSkills, SKILL_GRADE_XP } from './coach.js';
import { divisionMemory } from './coachprofile.js';

function expectedWinPct(prestige, coach = null) {
  const bonus = (coach == null ? void 0 : coach.expectationBonus) || 0;
  return C.EXPECT_BASE + (prestige || 3) * C.EXPECT_PRESTIGE_STEP + bonus;
}
function expectedWins(prestige, gamesInSeason, coach = null) {
  return Math.round(expectedWinPct(prestige, coach) * gamesInSeason);
}
function mandateText(prestige, gamesInSeason) {
  const w = expectedWins(prestige, gamesInSeason);
  if (prestige <= 2) return `Be competitive \u2014 around ${w} wins`;
  if (prestige <= 4) return `Winning season \u2014 ${w}+ wins`;
  return `Compete for the conference \u2014 ${w}+ wins and contention`;
}
function seatState(jobSecurity) {
  if (jobSecurity > C.JOBSEC_WARM) return "safe";
  if (jobSecurity > C.JOBSEC_HOT) return "warm";
  return "hot";
}
function schoolPull(school) {
  return (DIV_RANK[school.division] || 1) * 10 + (school.prestige || 1);
}
function coachRepScore(coach) {
  const idx = skillGradeIndex(coach, "reputation");
  return idx * (40 / 12);
}
function ensureCareerFields(coach) {
  if (!coach) return;
  if (coach.jobSecurity == null) coach.jobSecurity = C.JOBSEC_START;
  if (coach.status == null) coach.status = "employed";
  if (coach.tenureSeasons == null) coach.tenureSeasons = 0;
  if (coach.lastDelta === void 0) coach.lastDelta = null;
  if (coach.dominanceStreak == null) coach.dominanceStreak = 0;
  if (coach._onNotice == null) coach._onNotice = false;
  if (coach.lastOfferSeason === void 0) coach.lastOfferSeason = null;
}

// ── W9 §12 T4 — DIVISION MEMORY, MADE FELT ─────────────────────────────────
// New tree coaches get scouting/recruiting head starts in remembered divisions,
// cold starts elsewhere. The memory is the TREE's, not the man's, spent on the
// two skills that ARE knowing a place: Evaluator (how clearly you read a league
// you've scouted) and Roots (local relationships a familiar name inherits).
// Deliberately a FLOOR, never a bonus: it seeds a coach who starts at zero up to
// the head start, and does nothing to a coach who already earned more. A brand-
// new tree has no memory anywhere, so its first coach starts exactly cold.
function applyDivisionMemory(coach, tree, division) {
  if (!coach || !tree || !division) return null;
  const m = divisionMemory(tree, division);
  if (m <= 0) return null;
  ensureSkills(coach);
  const seed = (key, maxXp) => {
    var _a;
    const want = Math.round(maxXp * m);
    const have = ((_a = coach.skills[key]) == null ? void 0 : _a.xp) || 0;
    if (want <= have) return 0;
    coach.skills[key].xp = want;
    return want - have;
  };
  const evaluator = seed("evaluator", C.TREE.MEMORY_EVAL_XP);
  const roots = seed("roots", C.TREE.MEMORY_ROOTS_XP);
  return { memory: +m.toFixed(3), evaluator, roots };
}
// The plain-English version, for the seat-a-coach screen. Vague about the
// numbers by house rule — names the mechanism, lets the grades speak.
function divisionMemoryText(tree, division) {
  const m = divisionMemory(tree, division);
  if (m <= 0) return `Nobody on this tree has worked ${division}. He walks in cold.`;
  if (m < 0.34) return `The tree has a little ${division} history — he'll know a few names before he starts.`;
  if (m < 0.7) return `This tree knows ${division}. He arrives already able to read the league and work the local market.`;
  return `${division} is this tree's home league. He walks in knowing the talent and the territory.`;
}
// Reputation floor for a promoted coordinator — a man with a service record is
// not an unknown quantity. A floor, so it can never take from a coach who
// earned more.
function seedPromotedReputation(coach) {
  ensureSkills(coach);
  const floor = SKILL_GRADE_XP[C.TREE.PROMOTE_REP_FLOOR_IDX] || 0;
  if ((coach.skills.reputation.xp || 0) < floor) coach.skills.reputation.xp = floor;
  return coach.skills.reputation.xp;
}
var DIV_RANK;

DIV_RANK = { D1: 3, D2: 2, D3: 1 };

export { applyDivisionMemory, coachRepScore, divisionMemoryText, ensureCareerFields, expectedWins, mandateText, schoolPull, seatState, seedPromotedReputation };
