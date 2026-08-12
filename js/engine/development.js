import { ATTRIBUTES, C, MEASURED_ATTRS, PRACTICE_TOOLS, schemeStarterCounts } from '../constants.js';
import { skillGradeIndex } from './coach.js';
import { advanceClassYear, makeInjury, refreshRatings } from './player.js';
import { growFlaw, shrinkFlaw } from './traits.js';
import { clamp2, randInt3, randNorm } from '../utils.js';

// [DNA TREE §4 D3 — the un-fold] `developer` returned to the skills system for
// EVERYONE. Player and AI read the same 13-step skill ladder at the OLD
// coefficient (SKILL_DEVELOPER_STEP 0.015 — maxed 12·0.015=0.18, exactly the
// pre-fold effect). Earned DNA XP was floor-mapped back into skill XP by
// unfoldDnaToSkills, so no player lost a grade he earned.
function devMultFor(coach, school) {
  return 1 + skillGradeIndex(coach, "developer") * C.SKILL_DEVELOPER_STEP;
}

function developPlayer(player, practiceMinutes, coach, scale = 1, school = null) {
  var _a, _b;
  const totalMinutes = Object.values(practiceMinutes).reduce((s, v) => s + v, 0);
  if (totalMinutes === 0) return;
  const facMult = 1 + (((_b = (_a = school == null ? void 0 : school.facilities) == null ? void 0 : _a.training) != null ? _b : 2) - 2) * C.FACILITIES.TRAINING_PER_LVL;
  const attrWeight = {};
  for (const attr of ATTRIBUTES) attrWeight[attr] = 0;
  for (const [tool, minutes] of Object.entries(practiceMinutes)) {
    if (minutes <= 0) continue;
    const attrs = PRACTICE_TOOLS[tool] || {};
    const w = minutes / totalMinutes;
    for (const [attr, aw] of Object.entries(attrs)) {
      attrWeight[attr] = (attrWeight[attr] || 0) + w * aw;
    }
  }
  const weMult = C.WE_DEV_MIN + player.attributes.WE / 99 * C.WE_DEV_SCALE;
  const ageOf = (attr) => {
    var _a2;
    return (_a2 = MEASURED_ATTRS.includes(attr) ? C.AGE_CURVE_MEASURED[player.classYear] : C.AGE_CURVE_COACHED[player.classYear]) != null ? _a2 : 1;
  };
  const convMult = player.convDev && player.convDev.left > 0 ? C.POS_CHANGE_DEV_MULT : 1;
  const devMult = devMultFor(coach, school) * convMult;
  let anyGrowth = false;
  for (const attr of ATTRIBUTES) {
    const w = attrWeight[attr] || 0;
    if (w === 0) continue;
    const cap = player.potentialCaps[attr];
    const current = player.attributes[attr];
    const headroom = cap - current;
    if (headroom <= 0) continue;
    const delta = C.GROWTH_BASE * scale * facMult * w * weMult * ageOf(attr) * devMult * Math.max(0.4, headroom / C.HEADROOM_DIV) * randNorm(1, 0.15);
    if (delta > 0) {
      player.attributes[attr] = clamp2(Math.round(current + delta), 0, cap);
      anyGrowth = true;
    }
  }
  if (anyGrowth) refreshRatings(player);
}
function developPotentialAndPerformance(player, coach, school) {
  var _a, _b;
  const weMult = C.WE_DEV_MIN + player.attributes.WE / 99 * C.WE_DEV_SCALE;
  const weGate = Math.pow(weMult / 1.1, C.WE_POT_EXP);
  const ageOf = (attr) => {
    var _a2;
    return (_a2 = MEASURED_ATTRS.includes(attr) ? C.AGE_CURVE_MEASURED[player.classYear] : C.AGE_CURVE_COACHED[player.classYear]) != null ? _a2 : 1;
  };
  const convMult = player.convDev && player.convDev.left > 0 ? C.POS_CHANGE_DEV_MULT : 1;
  const devMult = devMultFor(coach, school) * convMult;
  const facMult = 1 + (((_b = (_a = school == null ? void 0 : school.facilities) == null ? void 0 : _a.training) != null ? _b : 2) - 2) * C.FACILITIES.TRAINING_PER_LVL;
  const s = player.stats || {};
  const D = C.PERF_DIVISORS;
  const perf = {};
  const add = (attr, pts) => {
    perf[attr] = Math.min(C.PERF_ATTR_CAP, (perf[attr] || 0) + pts);
  };
  if (s.passComp) {
    const p = s.passComp / D.passComp;
    add("TEC", p * 0.5);
    add("AWR", p * 0.5);
  }
  if (s.rushAtt) {
    const p = s.rushAtt / D.rushAtt;
    add("SEC", p * 0.4);
    add("AGI", p * 0.3);
    add("PWR", p * 0.3);
  }
  if (s.brokenTackles) {
    const p = s.brokenTackles / D.brokenTackles;
    add("PWR", p * 0.5);
    add("AGI", p * 0.5);
  }
  if (s.recComp) {
    const p = s.recComp / D.recComp;
    add("HND", p * 0.6);
    add("TEC", p * 0.4);
  }
  if (s.contestedRec) {
    const p = s.contestedRec / D.contestedRec;
    add("JMP", p * 0.7);
    add("HND", p * 0.3);
  }
  if (s.tackles) {
    const p = s.tackles / D.tackles;
    add("STR", p * 0.3);
    add("PWR", p * 0.3);
    add("AWR", p * 0.4);
  }
  const rush = (s.pressures || 0) / D.pressures + (s.sacks || 0) / D.sacks;
  if (rush) {
    add("SPD", rush * 0.3);
    add("STR", rush * 0.3);
    add("PWR", rush * 0.2);
    add("TEC", rush * 0.2);
  }
  const hawk = (s.ints || 0) + (s.passBreakups || 0) * 0.5;
  if (hawk) {
    const p = hawk / D.ballhawk;
    add("AWR", p * 0.6);
    add("JMP", p * 0.4);
  }
  let anyGrowth = false;
  for (const attr of ATTRIBUTES) {
    const cap = player.potentialCaps[attr];
    const headroom = cap - player.attributes[attr];
    if (headroom <= 0) continue;
    const potDelta = C.POT_GROWTH * weGate * ageOf(attr) * devMult * facMult * Math.max(0.4, headroom / C.HEADROOM_DIV) * randNorm(1, 0.18) / 12;
    const perfDelta = (perf[attr] || 0) * randNorm(1, 0.15);
    const delta = Math.max(0, potDelta) + Math.max(0, perfDelta);
    if (delta > 0) {
      player.attributes[attr] = clamp2(Math.round(player.attributes[attr] + delta), 0, cap);
      anyGrowth = true;
    }
  }
  if (anyGrowth) refreshRatings(player);
}
function checkGameInjury(player, week = 0, school = null) {
  var _a, _b;
  const chance2 = clamp2(C.INJURY_BASE - player.attributes.CON * C.INJURY_DUR_MOD, C.INJURY_MIN, C.INJURY_MAX);
  if (Math.random() < chance2) {
    let games = Math.max(1, Math.round(randNorm(2.5, 2)));
    const medMult = 1 - (((_b = (_a = school == null ? void 0 : school.facilities) == null ? void 0 : _a.medicine) != null ? _b : 2) - 2) * C.FACILITIES.MEDICINE_PER_LVL;
    games = Math.max(1, Math.round(games * medMult));
    player.injuryGamesOut = games;
    player.injury = makeInjury(games, week);
    return games;
  }
  return 0;
}
function healInjuries(roster) {
  for (const player of roster) {
    if (player.injuryGamesOut > 0) {
      player.injuryGamesOut--;
      if (player.injury) player.injury.gamesOut = player.injuryGamesOut;
      if (player.injuryGamesOut === 0) player.injury = null;
    }
  }
}
function getEffectivePracticePlan(school, position) {
  var _a, _b;
  return (_b = (_a = school.positionPlans) == null ? void 0 : _a[position]) != null ? _b : school.practiceMinutes;
}
function campFlawPass(player, plan, school) {
  var _a;
  const flaws = (_a = player.traits) == null ? void 0 : _a.flaws;
  if (!flaws || !flaws.length) return;
  const minutes = plan && typeof plan === "object" ? Object.values(plan).reduce((s, v) => s + (Number(v) || 0), 0) : Number(plan) || 0;
  const we = (player.attributes == null ? void 0 : player.attributes.WE) != null ? player.attributes.WE : 50;
  const shrinkP = Math.min(0.4, 0.1 + Math.min(1.4, minutes / 100) * 0.08 + (we - 50) * 12e-4 + devMultFor(school.coach, school) * 0.05);
  const t = flaws[Math.floor(Math.random() * flaws.length)];
  if (Math.random() < shrinkP) {
    const out = shrinkFlaw(player, t.k);
    if (out === "gone") {
      const tl = player.traits;
      (tl._gone || (tl._gone = [])).push(t.k);
    }
  } else if (minutes < 50 && Math.random() < 0.35) {
    growFlaw(player, t.k, 3);
  }
}
function runSeasonDevelopment(school, focus = null) {
  var _a, _b;
  const coach = school.coach;
  for (const player of school.roster) {
    const plan = getEffectivePracticePlan(school, player.position);
    if (plan) {
      let mult = C.CAMP_DEV_MULT;
      if (focus == null ? void 0 : focus.positions) {
        mult *= focus.positions.has(player.position) ? (_a = focus.mult) != null ? _a : 1.4 : (_b = focus.offMult) != null ? _b : 0.75;
      }
      developPlayer(player, plan, coach, mult, school);
    }
    // Identity stage 3 (flaws): camp is the big coaching-down window — the
    // offseason's worth of position-room attention takes a real swing at a
    // flaw (the in-season checkpoints take the small ones).
    campFlawPass(player, plan, school);
    developPotentialAndPerformance(player, coach, school);
    {
      const we = player.attributes.WE || 50;
      if (we < 55 && (player.classYear === "JR" || player.classYear === "SR")) {
        const chance2 = clamp2((55 - we) / 200, 0, 0.22);
        if (Math.random() < chance2) {
          const coached = ATTRIBUTES.filter((a) => !MEASURED_ATTRS.includes(a) && (player.attributes[a] || 0) > 30);
          if (coached.length) {
            const attr = coached[randInt3(0, coached.length - 1)];
            player.attributes[attr] = clamp2(player.attributes[attr] - 1, 0, 99);
            refreshRatings(player);
          }
        }
      }
    }
  }
}
function runGraduation(school, currentSeason) {
  const remaining = [];
  const graduated = [];
  for (const player of school.roster) {
    if (advanceClassYear(player, currentSeason)) {
      remaining.push(player);
    } else {
      graduated.push(player);
    }
  }
  school.roster = remaining;
  return graduated;
}
function applyRedshirt(player, season) {
  player.redshirted = true;
  player.redshirtYear = season;
}
function clearRedshirtFromLineups(school, playerIds) {
  var _a;
  const ids = new Set(playerIds);
  const vacated = [];
  const fa = (_a = school == null ? void 0 : school.gameplan) == null ? void 0 : _a.fieldAssignments;
  if (!fa) return vacated;
  for (const side of ["offense", "defense"]) {
    for (const [containerId, entry] of Object.entries(fa[side] || {})) {
      for (const [slotId, pid] of Object.entries(entry.slots || {})) {
        if (ids.has(pid)) {
          delete entry.slots[slotId];
          vacated.push(`${containerId} ${slotId}`);
        }
      }
    }
  }
  return vacated;
}
function autoRedshirtFreshmen(school, season) {
  const applied = [];
  for (const id of computeAutoRedshirtCandidates(school, season)) {
    const player = school.roster.find((p) => p.id === id);
    if (player) {
      applyRedshirt(player, season);
      applied.push(id);
    }
  }
  if (applied.length) clearRedshirtFromLineups(school, applied);
}
function computeAutoRedshirtCandidates(school, season) {
  const candidates = [];
  const positions = [...new Set(school.roster.map((p) => p.position))];
  // Scheme-aware (Aug 2026): rotation size follows the school's identity
  // front — a Nickel program's rotation is one OLB deep and three corners
  // deep, so the freshmen the staff suggests redshirting match who actually
  // dresses. No-op for schools on a classic base front.
  const starterTable = schemeStarterCounts(school);
  for (const pos of positions) {
    const atPos = school.roster.filter((p) => p.position === pos).sort((a, b) => b.compositeRating - a.compositeRating);
    const rotationSize = (starterTable[pos] || 1) * 2;
    for (const player of atPos) {
      if (player.classYear !== "FR") continue;
      if (player.redshirted) continue;
      if (player.isWalkOn) continue;
      if (atPos.indexOf(player) >= rotationSize) {
        candidates.push(player.id);
      }
    }
  }
  return candidates;
}

export { applyRedshirt, autoRedshirtFreshmen, checkGameInjury, clearRedshirtFromLineups, computeAutoRedshirtCandidates, devMultFor, developPlayer, getEffectivePracticePlan, healInjuries, runGraduation, runSeasonDevelopment };
