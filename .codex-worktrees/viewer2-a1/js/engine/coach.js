import { clamp2 } from '../utils.js';

function freshSkills() {
  return {
    evaluator: { xp: 0 },
    recruiter: { xp: 0 },
    developer: { xp: 0 },
    reputation: { xp: SKILL_GRADE_XP[5] },
    roots: { xp: 0 }
  };
}
function gradeIndexFromXP(xp) {
  let idx = 0;
  for (let i = 0; i < SKILL_GRADE_XP.length; i++) {
    if (xp >= SKILL_GRADE_XP[i]) idx = i;
    else break;
  }
  return idx;
}
function gradeFromXP(xp) {
  return SKILL_GRADES[gradeIndexFromXP(xp)];
}
function skillGrade(coach, key) {
  var _a, _b, _c;
  const xp = (_c = (_b = (_a = coach == null ? void 0 : coach.skills) == null ? void 0 : _a[key]) == null ? void 0 : _b.xp) != null ? _c : 0;
  return gradeFromXP(xp);
}
function skillGradeIndex(coach, key) {
  var _a, _b, _c;
  const xp = (_c = (_b = (_a = coach == null ? void 0 : coach.skills) == null ? void 0 : _a[key]) == null ? void 0 : _b.xp) != null ? _c : 0;
  return gradeIndexFromXP(xp);
}
function skillProgress(coach, key) {
  var _a, _b, _c;
  const xp = (_c = (_b = (_a = coach == null ? void 0 : coach.skills) == null ? void 0 : _a[key]) == null ? void 0 : _b.xp) != null ? _c : 0;
  const curIdx = gradeIndexFromXP(xp);
  const floorXP = SKILL_GRADE_XP[curIdx];
  const nextXP = curIdx < SKILL_GRADE_XP.length - 1 ? SKILL_GRADE_XP[curIdx + 1] : null;
  const pct = nextXP == null ? 1 : clamp2((xp - floorXP) / (nextXP - floorXP), 0, 1);
  return { curIdx, curXP: xp, floorXP, nextXP, pct };
}
function addSkillXP(coach, key, amount) {
  if (!coach.skills) coach.skills = freshSkills();
  if (!coach.skills[key]) coach.skills[key] = { xp: 0 };
  coach.skills[key].xp = Math.max(0, (coach.skills[key].xp || 0) + amount);
  return coach.skills[key].xp;
}
function ensureSkills(coach) {
  if (!coach) return;
  if (!coach.skills) coach.skills = freshSkills();
  for (const k of SKILL_KEYS) {
    if (!coach.skills[k]) coach.skills[k] = { xp: k === "reputation" ? SKILL_GRADE_XP[5] : 0 };
  }
  if (coach.reputation && typeof coach.reputation === "string") {
    const legacyIdx = SKILL_GRADES.indexOf(coach.reputation);
    if (legacyIdx > 0) {
      const legacyXP = SKILL_GRADE_XP[legacyIdx];
      if ((coach.skills.reputation.xp || 0) < legacyXP) coach.skills.reputation.xp = legacyXP;
    }
  }
}
var SKILL_GRADES, SKILL_GRADE_XP, SKILL_KEYS;

SKILL_GRADES = ["F", "D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+"];
SKILL_GRADE_XP = [0, 20, 45, 75, 115, 165, 225, 300, 390, 495, 620, 770, 950];
SKILL_KEYS = ["evaluator", "recruiter", "developer", "reputation", "roots"];

export { SKILL_GRADE_XP, SKILL_KEYS, addSkillXP, ensureSkills, freshSkills, gradeFromXP, gradeIndexFromXP, skillGrade, skillGradeIndex, skillProgress };
