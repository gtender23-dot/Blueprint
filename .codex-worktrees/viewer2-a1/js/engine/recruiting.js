import { C, ROSTER_POS_MAX, ROSTER_POS_MIN, ROSTER_TARGETS, schemeRosterTargets } from '../constants.js';
import { addSkillXP, skillGradeIndex } from './coach.js';

// [DNA TREE §4 D3 — the un-fold] `recruiter` returned to the skills system for
// EVERYONE. Player and AI read the same 13-step skill ladder at the OLD
// coefficient (SKILL_RECRUITER_STEP 0.025 — maxed 12·0.025=0.30, exactly the
// pre-fold effect). `reputation` and `roots` remain skills as they always were.
function recMultFor(coach, school) {
  return 1 + skillGradeIndex(coach, "recruiter") * C.SKILL_RECRUITER_STEP;
}
import { projectedPathToPlay } from './portal.js';
import { staffSalary } from './staff.js';
import { activeScholarshipCap } from './starts.js';
import { clamp2, randInt3, randNorm, recruitDistance } from '../utils.js';

function displayedRating(coach, recruit) {
  var _a, _b;
  const vision = (_a = recruit.visionRating) != null ? _a : 50;
  const truth = (_b = recruit.compositeRating) != null ? _b : vision;
  if (!coach) return vision;
  if (!coach.perception) coach.perception = {};
  const cached = coach.perception[recruit.id];
  if (cached != null) return cached;
  const idx = skillGradeIndex(coach, "evaluator");
  const lerp = idx * C.EVAL_LERP_STEP;
  const noiseSD = C.EVAL_NOISE_SD_BASE - idx * C.EVAL_NOISE_SD_STEP;
  const lensed = vision + lerp * (truth - vision) + randNorm(0, Math.max(1, noiseSD));
  const value = clamp2(Math.round(lensed), 1, 99);
  coach.perception[recruit.id] = value;
  return value;
}
function distanceTier(dist) {
  const T = C.DISTANCE_THRESHOLDS;
  if (dist <= T.local) return "local";
  if (dist <= T.near) return "near";
  if (dist <= T.mid) return "mid";
  return "far";
}
function longHaulFactor(dist) {
  const over = Math.max(0, (dist || 0) - C.LONGHAUL_START);
  return 1 / (1 + over / C.LONGHAUL_DECAY_K);
}
function longHaulCostMult(dist) {
  const over = Math.max(0, (dist || 0) - C.LONGHAUL_START);
  return Math.min(C.LONGHAUL_COST_CAP, 1 + over / C.LONGHAUL_COST_K);
}
function distanceMod(dist) {
  var _a;
  return ((_a = C.DISTANCE_MOD[distanceTier(dist)]) != null ? _a : 0.5) * longHaulFactor(dist);
}
function actionCost(action, dist) {
  var _a, _b;
  const tier = distanceTier(dist);
  const base = (_b = (_a = C.RECRUIT_ACTION_COST[`${action}_${tier}`]) != null ? _a : C.RECRUIT_ACTION_COST[action]) != null ? _b : 0;
  if (action === "offer") return base;
  return Math.round(base * longHaulCostMult(dist));
}
function createBoardEntry(recruit, schoolId) {
  return {
    recruitId: recruit.id,
    schoolId,
    interest: 0,
    spent: 0,
    actions: [],
    offered: false,
    campusVisits: 0,
    contactAlloc: 0
    // standing $/week contact allocation (Chunk 6)
  };
}
function setContactAlloc(entry, dollars) {
  entry.contactAlloc = clamp2(Math.round(dollars), 0, C.CONTACT_WEEKLY_CAP);
  return entry.contactAlloc;
}
function rollWants(recruit) {
  const wants = [];
  const pool = [...C.WANT_TYPES];
  for (let i = 0; i < 2; i++) {
    if (Math.random() < C.WANT_CHANCE && pool.length) {
      const idx = randInt3(0, pool.length - 1);
      wants.push(pool.splice(idx, 1)[0]);
    }
  }
  recruit.wants = wants;
  if (Math.random() < C.PT_WANT_CHANCE) {
    const roll = Math.random();
    recruit.ptWant = roll < C.PT_HIGH_SHARE ? "high" : roll < C.PT_HIGH_SHARE + C.PT_MED_SHARE ? "med" : "low";
  } else {
    recruit.ptWant = null;
  }
}
function wantSatisfaction(want, coach, school) {
  var _a;
  if (want === "PROGRAM") {
    const cap = ((_a = C.PRESTIGE_MAX) == null ? void 0 : _a[school.division]) || 6;
    const ratio = (school.prestige || 1) / cap;
    if (ratio >= C.WANT_PROGRAM_HI) return 1;
    if (ratio <= C.WANT_PROGRAM_LO) return -1;
    return 0;
  }
  const key = want === "DEVELOPMENT" ? "developer" : want === "PEDIGREE" ? "reputation" : null;
  if (!key) return 0;
  const idx = skillGradeIndex(coach, key);
  if (idx >= C.WANT_SATISFY_IDX) return 1;
  if (idx <= C.WANT_UNSATISFY_IDX) return -1;
  return 0;
}
function wantMod(recruit, coach, school) {
  let mod = 1;
  for (const w of recruit.wants || []) {
    const s = wantSatisfaction(w, coach, school);
    if (s > 0) mod *= C.WANT_MOD_SATISFIED;
    else if (s < 0) mod *= C.WANT_MOD_UNSATISFIED;
  }
  return mod;
}
function classNeedMod(school, pos) {
  const roster = (school == null ? void 0 : school.roster) || [];
  const have = roster.filter((p) => p.position === pos).length;
  const srs = roster.filter((p) => p.position === pos && p.classYear === "SR").length;
  // Scheme-aware (Aug 2026): needs gravity follows the identity front's
  // targets — a Nickel program's pull weakens at OLB and strengthens at CB.
  const need = (schemeRosterTargets(school)[pos] || 0) - (have - srs);
  if (need >= 1) return 1 + Math.min(need, 3) / 3 * C.NEED_PULL_MAX;
  return Math.max(1 - C.NEED_PULL_MAX * 0.5, 1 + need * 0.06);
}
function ptMod(recruit, school) {
  if (!recruit.ptWant) return 1;
  const imp = C.PT_IMPORTANCE && C.PT_IMPORTANCE[recruit.ptWant] || 1;
  const path = projectedPathToPlay(recruit, school);
  const lean = clamp2((path.score - 55) / 45, -1, 1);
  return clamp2(1 + lean * imp * C.PT_SWING, 0.2, 1.9);
}
function effectiveSpend(dollars, recruit, school, coach, isPlayer = false) {
  if (dollars <= 0) return 0;
  const dist = recruitDistance(recruit, school);
  const distMod = distanceMod(dist);
  const prestigeMod = clamp2(
    C.PRESTIGE_MULT_MIN + school.prestige * C.PRESTIGE_MULT_SCALE,
    C.PRESTIGE_MULT_MIN,
    2
  );
  const recMult = recMultFor(coach, school);
  const repMult = 1 + skillGradeIndex(coach, "reputation") * C.SKILL_REP_STEP;
  const rootsMult = isPlayer && dist <= C.ROOTS_RADIUS_MI ? 1 + skillGradeIndex(coach, "roots") * C.SKILL_ROOTS_STEP : 1;
  const wMod = wantMod(recruit, coach, school);
  const needM = classNeedMod(school, recruit.position);
  const ptM = ptMod(recruit, school);
  return dollars * distMod * prestigeMod * recMult * repMult * rootsMult * wMod * needM * ptM;
}
function calcGain(action, recruit, school, entry, coach) {
  var _a;
  const base = (_a = C.RECRUIT_ACTION_BASE[action]) != null ? _a : 0;
  if (base === 0) return 0;
  const dist = recruitDistance(recruit, school);
  const distMod = distanceMod(dist);
  const prestigeMod = clamp2(
    C.PRESTIGE_MULT_MIN + school.prestige * C.PRESTIGE_MULT_SCALE,
    C.PRESTIGE_MULT_MIN,
    2
  );
  const spent = entry.spent || 0;
  const diminish = 1 / (1 + spent / C.DIMINISH_K);
  const repIdx = skillGradeIndex(coach, "reputation");
  const rootIdx = skillGradeIndex(coach, "roots");
  const recruiterMult = recMultFor(coach, school);
  const repMult = 1 + repIdx * C.SKILL_REP_STEP;
  const rootsMult = dist <= C.ROOTS_RADIUS_MI ? 1 + rootIdx * C.SKILL_ROOTS_STEP : 1;
  const wMod = wantMod(recruit, coach, school);
  const raw = base * distMod * prestigeMod * diminish * recruiterMult * repMult * rootsMult * wMod;
  return Math.max(0, raw);
}
function applyWeeklyContact(coach, recruit, entry, school) {
  const dollars = Math.min(entry.contactAlloc || 0, C.CONTACT_WEEKLY_CAP);
  if (dollars <= 0) return 0;
  if ((coach.budget || 0) < dollars) return 0;
  coach.budget -= dollars;
  entry.spent = (entry.spent || 0) + dollars;
  entry._bid = effectiveSpend(dollars, recruit, school, coach, true);
  return entry._bid;
}
function resolveRooms(recruits, playerBoard, playerSchoolId) {
  const playerEntry = new Map((playerBoard || []).map((e) => [e.recruitId, e]));
  for (const recruit of recruits) {
    if (recruit.committed || recruit.decisionStatus !== "undecided") continue;
    const bidders = [];
    const pe = playerEntry.get(recruit.id);
    if (pe && !pe.eliminated && (pe._bid || 0) > 0) bidders.push({ e: pe, bid: pe._bid });
    for (const rv of recruit.rivals || []) {
      if (rv.eliminated || rv.bowedOut) continue;
      if ((rv._bid || 0) > 0) bidders.push({ e: rv, bid: rv._bid });
    }
    if (bidders.length === 0) {
      if (pe) pe._bid = 0;
      continue;
    }
    const room = bidders.reduce((s, b) => s + b.bid, 0);
    const contested = bidders.length > 1;
    const fairShare = 1 / bidders.length;
    const topBid = Math.max(...bidders.map((b) => b.bid));
    for (const b of bidders) {
      const share = b.bid / room;
      let move;
      if (!contested) {
        move = C.SHARE_GAIN_MAX * C.SHARE_QUIET_BONUS;
      } else {
        move = C.SHARE_SWING * (share - fairShare);
        if (b.bid === topBid) move = Math.max(move, C.SHARE_GAIN_MAX * 0.15);
      }
      b.e.interest = clamp2((b.e.interest || 0) + move, 0, 100);
      b.e._lastShare = share;
      b.e._bid = 0;
    }
    const bidderSet = new Set(bidders.map((b) => b.e));
    for (const rv of recruit.rivals || []) {
      if (rv.eliminated || rv.bowedOut || bidderSet.has(rv)) continue;
      rv.interest = clamp2((rv.interest || 0) - C.SHARE_DECAY, 0, 100);
    }
    if (pe && !pe.eliminated && !bidderSet.has(pe)) {
      pe.interest = clamp2((pe.interest || 0) - C.SHARE_DECAY, 0, 100);
      pe._lastShare = 0;
    }
  }
}
function takeAction(coach, recruit, entry, action, day, school) {
  var _a, _b;
  const dist = recruitDistance(recruit, school);
  const cost = actionCost(action, dist);
  if (coach.budget < cost)
    return { ok: false, reason: "Insufficient budget" };
  if (action === "campus_visit" && (entry.campusVisits || 0) >= C.MAX_CAMPUS_VISITS)
    return { ok: false, reason: "Campus visit limit reached" };
  if (action === "offer" && entry.offered)
    return { ok: false, reason: "Already offered" };
  if (action === "offer" && (coach.scholarshipsAvailable || 0) <= 0)
    return { ok: false, reason: "No scholarships available" };
  let gain = calcGain(action, recruit, school, entry, coach);
  if (action === "campus_visit" || action === "home_visit" || action === "game_visit") {
    gain = Math.round(gain * facilityMult(school, "recruiting", C.FACILITIES.RECRUITING_PER_LVL));
  }
  coach.budget -= cost;
  entry.interest = clamp2((entry.interest || 0) + gain, 0, 100);
  entry.spent = (entry.spent || 0) + cost;
  entry.actions.push({ action, day, gain, cost });
  if (action === "scout") {
    if (!coach.scouted) coach.scouted = {};
    if (!coach.scouted[recruit.id]) {
      coach.scouted[recruit.id] = true;
      addSkillXP(coach, "evaluator", C.XP_SCOUT);
      const vision = (_a = recruit.visionRating) != null ? _a : 50;
      const truth = (_b = recruit.compositeRating) != null ? _b : vision;
      if (truth - vision >= C.GEM_GAP) addSkillXP(coach, "evaluator", C.XP_SCOUT_GEM);
    }
  }
  if (action === "campus_visit") entry.campusVisits = (entry.campusVisits || 0) + 1;
  if (action === "offer") {
    entry.offered = true;
    coach.scholarshipsAvailable = Math.max(0, (coach.scholarshipsAvailable || 0) - 1);
  }
  return { ok: true, gain, cost };
}
function hasScouted(coach, recruitId) {
  return !!((coach == null ? void 0 : coach.scouted) && coach.scouted[recruitId]);
}
function facilityLevel(school, track) {
  var _a, _b;
  return (_b = (_a = school == null ? void 0 : school.facilities) == null ? void 0 : _a[track]) != null ? _b : 2;
}
function facilityMult(school, track, perLvl) {
  return 1 + (facilityLevel(school, track) - 2) * perLvl;
}
function facilityUpkeep(school) {
  const F = C.FACILITIES;
  const per = F.UPKEEP_PER_LEVEL[school == null ? void 0 : school.division] || F.UPKEEP_PER_LEVEL.D3;
  return F.TRACKS.reduce((s, t) => s + per * Math.max(0, facilityLevel(school, t) - 1), 0);
}
function computeSeasonRevenue(school, carryover = 0) {
  var _a, _b, _c;
  const div = (school == null ? void 0 : school.division) || "D3";
  const E = C.ECON;
  const base = E.BASE[div] || E.BASE.D3;
  const rawCap = ((_a = school == null ? void 0 : school.stadium) == null ? void 0 : _a.capacity) || 4e3;
  const capacity = Math.round(rawCap * facilityMult(school, "stadium", C.FACILITIES.STADIUM_CAP_PER_LVL));
  const lastWins = (_c = (_b = school == null ? void 0 : school.recentWins) == null ? void 0 : _b[0]) != null ? _c : 5;
  const fill = Math.max(E.FILL_MIN, Math.min(
    E.FILL_MAX,
    E.FILL_BASE + ((school == null ? void 0 : school.prestige) || 1) * E.FILL_PER_PRESTIGE + lastWins * E.FILL_PER_WIN
  ));
  const price = E.TICKET_PRICE[div] || 9;
  const share = E.PROGRAM_SHARE[div] || 0.8;
  const tickets = Math.round(capacity * fill * price * share);
  const upkeep = facilityUpkeep(school);
  const salaries = staffSalary(school);
  return {
    base,
    capacity,
    fill: Math.round(fill * 100) / 100,
    price,
    share,
    tickets,
    upkeep,
    salaries,
    carryover: Math.round(carryover),
    total: Math.max(0, base + tickets + Math.round(carryover) - upkeep - salaries)
  };
}
function initBudget(coach, openSlots, carryover = 0, school = null, season = 1) {
  let rev = computeSeasonRevenue(school, carryover);
  if (school && rev.total === 0 && rev.upkeep > rev.base + rev.tickets + rev.carryover) {
    const F = C.FACILITIES;
    const worst = F.TRACKS.reduce((a, t) => facilityLevel(school, t) > facilityLevel(school, a) ? t : a, F.TRACKS[0]);
    if (facilityLevel(school, worst) > 1) {
      school.facilities[worst] -= 1;
      rev = computeSeasonRevenue(school, carryover);
      rev.decayed = F.LABELS[worst];
    }
  }
  coach.budget = rev.total;
  coach.revenueBreakdown = rev;
  coach.budgetCarryover = 0;
  // [OWNER RULING Aug 2026 — dynasty vs ladder] The loyalty raises: every
  // year a rival called and the coach stayed, +10% of the division base,
  // stacked, capped at 100% (double money at ten declined calls). The stack
  // lives on the coach and dies the day he takes another job.
  const _prStacks = coach.retentionStacks || 0;
  if (_prStacks > 0) {
    const _prPct = Math.min(C.PLAYER_RETENTION.CAP_PCT, _prStacks * C.PLAYER_RETENTION.PCT_PER_OFFER);
    const _prBonus = Math.round((C.ECON.BASE[school.division] || C.ECON.BASE.D3) * _prPct / 100) * 100;
    rev.retentionBonus = _prBonus;
    rev.retentionStacks = _prStacks;
    coach.budget += _prBonus;
  }
  if (coach.pendingScheduleGuarantee) {
    rev.scheduleGuarantee = coach.pendingScheduleGuarantee;
    coach.budget = Math.max(0, coach.budget + coach.pendingScheduleGuarantee);
    coach.pendingScheduleGuarantee = 0;
  }
  // [DNA TREE §5b.5 D4 / §5b.6 D5] Retention payments and succession promises
  // land here — the season AFTER the decision, straight off the recruiting
  // pool, exactly the pendingScheduleGuarantee shape. The ledger shows the
  // line so the cost is legible.
  if (coach.pendingRetentionCost) {
    rev.retentionCost = coach.pendingRetentionCost;
    coach.budget = Math.max(0, coach.budget - coach.pendingRetentionCost);
    coach.pendingRetentionCost = 0;
  }
  const cap = activeScholarshipCap(coach, season);
  coach.scholarshipsAvailable = cap != null ? Math.min(openSlots, cap) : openSlots;
  coach.scholarshipCapActive = cap != null ? cap : null;
}
function facilityUpgradeCost(school, track) {
  const F = C.FACILITIES;
  const base = F.UPGRADE_BASE[school == null ? void 0 : school.division] || F.UPGRADE_BASE.D3;
  return base * (facilityLevel(school, track) + 1);
}
function buyFacilityUpgrade(school, coach, track) {
  const lvl = facilityLevel(school, track);
  if (lvl >= C.FACILITIES.MAX_LEVEL) return { ok: false, reason: "Already at max level" };
  const cost = facilityUpgradeCost(school, track);
  if ((coach.budget || 0) < cost) return { ok: false, reason: "Not enough in the pool" };
  coach.budget -= cost;
  if (!school.facilities) school.facilities = { stadium: 2, training: 2, recruiting: 2, medicine: 2 };
  school.facilities[track] = lvl + 1;
  return { ok: true, cost, level: lvl + 1 };
}
function commitThreshold(recruit, contenders = null) {
  var _a, _b;
  const we = (_b = (_a = recruit.attributes) == null ? void 0 : _a.WE) != null ? _b : 50;
  let raw = C.COMMIT_THRESHOLD_BASE - we * C.COMMIT_WE_MOD;
  if (contenders != null) {
    const over = Math.max(0, contenders - 1);
    raw -= C.COMMIT_FIELD_RELIEF * Math.max(0, C.COMMIT_FIELD_CAP - over) / C.COMMIT_FIELD_CAP;
  }
  return clamp2(raw, C.COMMIT_THRESHOLD_FLOOR, C.COMMIT_THRESHOLD_CEIL);
}
function rivalWeight(recruit, school) {
  const prestige = school.prestige || 3;
  const recruitTier = (recruit.visionRating || 50) / 20;
  const gap = Math.abs(recruitTier - prestige);
  return Math.max(0.1, 1 - gap * 0.3);
}
function seedFunnelData(recruit, schools) {
  const vr = recruit.visionRating || 50;
  const tier = vr >= C.FUNNEL_TIER_HIGH ? "high" : vr >= C.FUNNEL_TIER_MID ? "mid" : "low";
  recruit.funnelStage = "open";
  recruit.rivals = [];
  recruit._funnelTier = tier;
  rollWants(recruit);
}
function tierOf(r) {
  if (r.recruitTier != null) return r.recruitTier;
  return r.compositeRating >= 66 ? 3 : r.compositeRating >= 50 ? 2 : 1;
}
function calibreVisible(recruit, division) {
  var _a, _b, _c;
  const myTier = (_a = { D1: 3, D2: 2, D3: 1 }[division]) != null ? _a : 1;
  const t = tierOf(recruit);
  if (t === myTier) return true;
  if (t === myTier - 1) return ((_b = recruit.tierPct) != null ? _b : 1) < C.RECRUIT_REACH_DOWN;
  if (t === myTier + 1) return ((_c = recruit.tierPct) != null ? _c : 0) > 1 - C.RECRUIT_REACH_UP;
  return false;
}
function buildAIRecruiting(schools, recruits) {
  var _a;
  for (const r of recruits) {
    r.rivals = [];
  }
  for (const school of schools) {
    const roster = school.roster || [];
    const srs = {}, count = {};
    for (const p of roster) {
      count[p.position] = (count[p.position] || 0) + 1;
      if (p.classYear === "SR") srs[p.position] = (srs[p.position] || 0) + 1;
    }
    const slots = Math.max(
      0,
      roster.filter((p) => p.classYear === "SR").length + Math.max(0, C.ROSTER_SIZE - roster.length)
    );
    if (!school.coach) continue;
    const needWeight = (pos) => {
      const returning = (count[pos] || 0) - (srs[pos] || 0);
      const max = ROSTER_POS_MAX[pos];
      if (max != null && returning >= max) return 0;
      const min = ROSTER_POS_MIN[pos];
      if (min != null && returning < min) {
        const shortfall = min - returning;
        return 2.5 + shortfall * 0.8;
      }
      const needN = (schemeRosterTargets(school)[pos] || 0) - returning;
      return Math.max(0.4, Math.min(2.2, 0.4 + needN * 0.35));
    };
    const myTier = (_a = { D1: 3, D2: 2, D3: 1 }[school.division]) != null ? _a : 1;
    const scored = recruits.filter((r) => calibreVisible(r, school.division) && tierOf(r) !== myTier - 1).map((r) => {
      var _a2;
      const dist = recruitDistance(r, school);
      const dMod = ((_a2 = C.AI_DIST_FIT[distanceTier(dist)]) != null ? _a2 : 0.8) * longHaulFactor(dist);
      return { r, fit: rivalWeight(r, school) * needWeight(r.position) * dMod * (0.85 + Math.random() * 0.3) };
    }).sort((a, b) => b.fit - a.fit);
    const boardSize = Math.min(C.AI_BOARD_CAP, Math.max(4, slots * C.AI_TARGETS_PER_SLOT));
    const targetIds = [];
    if (slots > 0 && C.RECRUIT_REACH_DOWN > 0 && Math.random() < C.AI_STEAL_CHANCE) {
      const steal = recruits.filter((r) => tierOf(r) === myTier - 1 && calibreVisible(r, school.division) && (r.rivals || []).length < C.AI_SUITORS_CAP).map((r) => {
        var _a2;
        return { r, fit: rivalWeight(r, school) * needWeight(r.position) * ((_a2 = C.AI_DIST_FIT[distanceTier(recruitDistance(r, school))]) != null ? _a2 : 0.8) };
      }).sort((a, b) => b.fit - a.fit)[0];
      if (steal) {
        targetIds.push(steal.r.id);
        const [iMin, iMax] = C.RIVAL_INTEREST[steal.r._funnelTier || "mid"];
        steal.r.rivals.push({
          schoolId: school.id,
          division: school.division,
          interest: iMin + Math.random() * (iMax - iMin),
          gain: C.AI_GAIN_BASE + steal.fit * C.AI_GAIN_FIT,
          driven: true,
          eliminated: false
        });
      }
    }
    const priorityById = {};
    for (const { r, fit } of scored) {
      if (targetIds.includes(r.id)) continue;
      if (targetIds.length >= boardSize) break;
      if ((r.rivals || []).length >= C.AI_SUITORS_CAP) continue;
      targetIds.push(r.id);
      const need = needWeight(r.position);
      const quality = 0.5 + (r.visionRating || 50) / 100;
      priorityById[r.id] = need * quality * Math.max(0.4, fit);
      const [iMin, iMax] = C.RIVAL_INTEREST[r._funnelTier || "mid"];
      r.rivals.push({
        schoolId: school.id,
        division: school.division,
        // absolutePull: division decides cross-division races
        interest: iMin + Math.random() * (iMax - iMin),
        gain: C.AI_GAIN_BASE + fit * C.AI_GAIN_FIT,
        driven: true,
        // on this school's board — interest now grows via real budget spend
        eliminated: false
      });
    }
    if (school.coach) {
      const prestige = school.prestige || 2;
      const divCap = C.PRESTIGE_MAX && C.PRESTIGE_MAX[school.division] || 6;
      const prestigeBase = 0.72 + prestige / divCap * 0.66;
      const personality = 0.78 + Math.random() * 0.44;
      const aggression = +(prestigeBase * personality).toFixed(3);
      const ranked = Object.entries(priorityById).sort((a, b) => b[1] - a[1]).map(([id]) => id);
      const warChest = ranked.slice(0, C.AI_WARCHEST_TARGETS);
      school.coach.aiRec = {
        targetIds,
        slots,
        filled: 0,
        full: slots <= 0,
        aggression,
        priorityById,
        warChest,
        maxPriority: Math.max(1e-3, ...Object.values(priorityById), 1e-3)
      };
    }
  }
  for (const r of recruits) {
    if ((r.rivals || []).length >= C.AI_SUITORS_MIN) continue;
    const have = new Set(r.rivals.map((x) => x.schoolId));
    const near = schools.filter((s) => !have.has(s.id) && calibreVisible(r, s.division) && tierOf(r) !== divisionRank(s.division) - 1).map((s) => ({ s, d: recruitDistance(r, s), w: rivalWeight(r, s) })).sort((a, b) => a.d / (a.w + 0.2) - b.d / (b.w + 0.2));
    for (const { s } of near) {
      if (r.rivals.length >= C.AI_SUITORS_MIN) break;
      const [iMin, iMax] = C.RIVAL_INTEREST[r._funnelTier || "mid"];
      r.rivals.push({
        schoolId: s.id,
        division: s.division,
        interest: iMin + Math.random() * (iMax - iMin),
        gain: C.AI_GAIN_BASE * 0.8,
        eliminated: false
      });
    }
  }
}
function setRecruitDifficulty(level) {
  var _a;
  _recDiffMult = (_a = { freshman: 0.75, varsity: 1, allamerican: 1.2, legend: 1.4 }[level != null ? level : "varsity"]) != null ? _a : 1;
}
function driftRivals(recruit, distMult = 1, aiCtx = null) {
  var _a, _b, _c;
  for (const rival of recruit.rivals || []) {
    if (rival.eliminated) continue;
    if (rival.driven) continue;
    if (rival.bowedOut) continue;
    const share = aiCtx ? (_a = aiCtx.share.get(rival.schoolId)) != null ? _a : 1 : 1;
    if (share <= 0) continue;
    const pressure = ((_c = (_b = rival.gain) != null ? _b : rival.drift) != null ? _c : 0.8) * share * distMult * (0.8 + Math.random() * 0.4) * _recDiffMult;
    rival._bid = pressure * C.CONTACT_DOLLARS_PER_POINT * 12;
  }
}
function applyAIWeeklySpend(schools, recruits, playerBoard, playerSchoolId, day) {
  const weeksLeft = Math.max(1, C.RECRUITING_LOCK_DAY - day + 1);
  const recruitById = new Map(recruits.map((r) => [r.id, r]));
  const playerEntryByRecruit = new Map((playerBoard || []).map((e) => [e.recruitId, e]));
  for (const school of schools || []) {
    if (school.id === playerSchoolId) continue;
    const coach = school.coach;
    const ai = coach == null ? void 0 : coach.aiRec;
    if (!ai || ai.full || (coach.budget || 0) <= 0) continue;
    const aggro = ai.aggression || 1;
    const openSlots = Math.max(0, ai.slots - (ai.filled || 0));
    const timePressure = Math.min(1, (C.AI_ENDGAME_WEEKS - weeksLeft + 1) / C.AI_ENDGAME_WEEKS);
    const urgency = openSlots > 0 ? Math.max(0, timePressure) : 0;
    const aggroWallet = Math.max(C.AI_AGGRO_WALLET_MIN, aggro);
    const pacedWallet = coach.budget / weeksLeft * C.AI_SPEND_AGGRO * aggroWallet * _recDiffMult;
    const wallet = Math.min(coach.budget, pacedWallet + (coach.budget - pacedWallet) * urgency * C.AI_ENDGAME_SPEND);
    if (wallet < 1) continue;
    const priorityById = ai.priorityById || {};
    const maxPriority = ai.maxPriority || 1;
    const warChest = new Set(Array.isArray(ai.warChest) ? ai.warChest : []);
    const live = [];
    for (const id of ai.targetIds) {
      const recruit = recruitById.get(id);
      if (!recruit || recruit.committed) continue;
      const mine = (recruit.rivals || []).find((rv) => rv.schoolId === school.id);
      if (!mine || mine.eliminated || mine.bowedOut) continue;
      let leader = 0;
      for (const rv of recruit.rivals || []) {
        if (rv.eliminated || rv.bowedOut || rv.schoolId === school.id) continue;
        if (rv.interest > leader) leader = rv.interest;
      }
      const pe = playerEntryByRecruit.get(id);
      if (pe && !pe.eliminated && (pe.interest || 0) > leader) leader = pe.interest;
      const gap = leader - mine.interest;
      const mods = Math.max(0.15, effectiveSpend(1, recruit, school, coach, false));
      const isWarChest = warChest.has(id);
      const strat = Math.min(1.6, (priorityById[id] || 0.4) / maxPriority);
      const stillWinning = gap <= 2;
      const effGapTrigger = C.AI_BOWOUT_GAP * (1 - urgency * 0.6);
      if (gap >= effGapTrigger && !(isWarChest && stillWinning)) {
        const costToClose = gap * C.CONTACT_DOLLARS_PER_POINT / mods;
        const hopeless = leader >= C.AI_BOWOUT_HOPELESS_LEAD && gap >= C.AI_BOWOUT_HOPELESS_GAP;
        const budgetFrac = C.AI_BOWOUT_BUDGET_FRAC * aggro * (isWarChest ? 3.2 : 1) * (1 - urgency * 0.7);
        if (hopeless || costToClose > budgetFrac * coach.budget) {
          mine.bowedOut = true;
          continue;
        }
      }
      const winning = gap <= 0;
      const battle = (winning ? 1.35 : 1 / (1 + gap / 25)) * (mine.interest >= 95 ? 0.25 : 1);
      const winnableBoost = 1 + urgency * (winning ? C.AI_ENDGAME_WINNABLE : -0.4);
      const weight = Math.max(0.02, battle * Math.pow(0.35 + strat, C.AI_PRIORITY_SPEND_POW) * (isWarChest ? C.AI_WARCHEST_MULT : 1) * winnableBoost);
      live.push({ mine, mods, weight, isWarChest, strat });
    }
    if (live.length === 0) continue;
    live.sort((a, b) => b.weight - a.weight);
    const focus = live.slice(0, C.AI_PRIORITY_TOP);
    const weightSum = focus.reduce((s, t) => s + t.weight, 0) || 1;
    for (const t of focus) {
      let dollars = wallet * t.weight / weightSum;
      if (t.isWarChest) dollars *= 1 + (_recDiffMult - 1) * 0.6;
      dollars = Math.min(coach.budget, C.CONTACT_WEEKLY_CAP, dollars);
      if (dollars < 1) continue;
      coach.budget -= dollars;
      t.mine.spent = (t.mine.spent || 0) + dollars;
      t.mine._bid = dollars * t.mods;
    }
  }
}
function buildAIContext(schools, recruits) {
  var _a;
  const committed = /* @__PURE__ */ new Set();
  for (const rec of recruits) if (rec.committed) committed.add(rec.id);
  const share = /* @__PURE__ */ new Map();
  const full = /* @__PURE__ */ new Set();
  for (const school of schools || []) {
    const ai = (_a = school.coach) == null ? void 0 : _a.aiRec;
    if (!ai) continue;
    if (ai.full || ai.filled >= ai.slots) {
      share.set(school.id, 0);
      full.add(school.id);
      continue;
    }
    const active = ai.targetIds.reduce((n, id) => n + (committed.has(id) ? 0 : 1), 0);
    share.set(school.id, Math.min(C.AI_SHARE_MAX, ai.targetIds.length / Math.max(1, active)));
  }
  return { share, full };
}
function divisionRank(division) {
  var _a;
  return (_a = DIV_DOMINANCE_RANK[division]) != null ? _a : 0;
}
function poolRank(division) {
  var _a;
  return (_a = DIV_DOMINANCE_RANK[division]) != null ? _a : 0;
}
function buildFunnelPool(recruit, playerEntry, playerSchoolId, playerDivision2 = null) {
  var _a;
  const playerInPool = playerEntry && !playerEntry.eliminated;
  const pool = [];
  if (playerInPool) {
    pool.push({
      schoolId: playerSchoolId || null,
      interest: playerEntry.interest || 0,
      isPlayer: true,
      division: playerDivision2
    });
  }
  for (const rival of recruit.rivals || []) {
    if (!rival.eliminated && rival.schoolId !== playerSchoolId) {
      pool.push({
        schoolId: rival.schoolId,
        interest: rival.interest,
        isPlayer: false,
        bowedOut: !!rival.bowedOut,
        division: (_a = rival.division) != null ? _a : null
      });
    }
  }
  pool.sort((a, b) => (b.bowedOut ? 0 : poolRank(b.division)) - (a.bowedOut ? 0 : poolRank(a.division)) || b.interest - a.interest);
  return pool;
}
function resolveFunnel(recruits, playerSchoolId, playerBoard, playerCoach, day, schools = null, events = null) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
  const commits = [];
  const seasonStarted = day >= 5;
  const aiCtx = schools ? buildAIContext(schools, recruits) : null;
  const playerDivision2 = (_b = (_a = (schools || []).find((s) => s.id === playerSchoolId)) == null ? void 0 : _a.division) != null ? _b : null;
  let divById = null;
  if (schools) {
    divById = new Map(schools.map((s) => [s.id, s.division]));
  }
  for (const recruit of recruits) {
    if (recruit.committed || recruit.decisionStatus !== "undecided") continue;
    if (divById) {
      for (const rv of recruit.rivals || []) {
        if (rv.division == null) rv.division = (_c = divById.get(rv.schoolId)) != null ? _c : null;
      }
    }
    if (seasonStarted) {
      const distToPlayer = recruitDistance(recruit, (schools || []).find((s) => s.id === playerSchoolId));
      const distMult = (_d = C.RIVAL_DRIFT_DIST_MULT[distanceTier(distToPlayer)]) != null ? _d : 1;
      driftRivals(recruit, distMult, aiCtx);
    }
    let earlyCommit = false;
    if (seasonStarted && day < C.RECRUITING_LOCK_DAY) {
      const peEarly = (playerBoard || []).find((e) => e.recruitId === recruit.id);
      const poolEarly = buildFunnelPool(recruit, peEarly, playerSchoolId, playerDivision2);
      const active = poolEarly.filter((e) => !e.bowedOut && !(e.isPlayer ? false : (aiCtx == null ? void 0 : aiCtx.full) == null ? void 0 : aiCtx.full.has(e.schoolId)));
      active.sort((a, b) => b.interest + poolRank(b.division) * 1e-3 - (a.interest + poolRank(a.division) * 1e-3));
      const L = active[0], S = active[1];
      if (L) {
        const second = (_e = S == null ? void 0 : S.interest) != null ? _e : 0;
        const contenders = active.length;
        const thr = commitThreshold(recruit, contenders);
        const gap = L.interest - second;
        const canClose = L.isPlayer ? !!(peEarly == null ? void 0 : peEarly.offered) : !((_f = aiCtx == null ? void 0 : aiCtx.full) == null ? void 0 : _f.has(L.schoolId));
        const leaderKey = L.isPlayer ? "__player__" : L.schoolId;
        if (recruit._leadKey === leaderKey && recruit._ledLastWeek === day - 1) {
          recruit._leadWeeks = (recruit._leadWeeks || 0) + 1;
        } else {
          recruit._leadWeeks = 1;
        }
        recruit._leadKey = leaderKey;
        recruit._ledLastWeek = day;
        const pastFloor = day >= C.RECRUITING_EARLY_FLOOR;
        if (canClose && L.interest >= thr && pastFloor) {
          let needWeeks = gap >= C.COMMIT_BLOWOUT_GAP ? C.COMMIT_HOLD_BLOWOUT : gap >= C.COMMIT_CLEAR_GAP ? C.COMMIT_HOLD_CLEAR : contenders <= 1 ? C.COMMIT_HOLD_UNCONTESTED : C.COMMIT_HOLD_CONTESTED;
          const weeksLeft = C.RECRUITING_LOCK_DAY - day;
          if (weeksLeft <= 4) needWeeks = Math.max(1, needWeeks - (5 - weeksLeft));
          const durable = (recruit._leadWeeks || 0) >= needWeeks;
          const collapsed = contenders <= 1 && (recruit._leadWeeks || 0) >= 2;
          if (durable || collapsed) earlyCommit = true;
        } else {
          recruit._leadWeeks = 0;
        }
      }
    }
    const hardLock = day >= C.RECRUITING_LOCK_DAY;
    if (seasonStarted && !earlyCommit && !hardLock) {
      const peN = (playerBoard || []).find((e) => e.recruitId === recruit.id);
      let stage = null;
      if (day >= C.FUNNEL_TOP3_DAY) stage = "top3";
      else if (day >= C.FUNNEL_TOP5_DAY) stage = "top5";
      else if (day >= C.FUNNEL_TOP8_DAY) stage = "top8";
      if (stage && recruit.funnelStage !== "committed") {
        const poolN = buildFunnelPool(recruit, peN, playerSchoolId, playerDivision2);
        const stageSize = C.FUNNEL_SIZE[stage] || 8;
        const keep = new Set(poolN.slice(0, stageSize).map((e) => e.schoolId));
        if (stage === "top3") {
          const l3 = poolN[0];
          recruit._trailedAtTop3 = !(l3 && l3.isPlayer);
        }
        if (peN && !peN.eliminated && !keep.has(playerSchoolId)) {
          peN.eliminated = true;
          if (peN.offered && playerCoach) {
            peN.offered = false;
            playerCoach.scholarshipsAvailable = (playerCoach.scholarshipsAvailable || 0) + 1;
          }
        }
        for (const rival of recruit.rivals || []) {
          if (!rival.eliminated && !keep.has(rival.schoolId)) rival.eliminated = true;
        }
        recruit.funnelStage = stage;
      }
    }
    if (!earlyCommit && !hardLock) continue;
    const playerEntry = (playerBoard || []).find((e) => e.recruitId === recruit.id);
    const pool = buildFunnelPool(recruit, playerEntry, playerSchoolId, playerDivision2).filter((e) => !e.bowedOut && !(e.isPlayer ? false : (aiCtx == null ? void 0 : aiCtx.full) == null ? void 0 : aiCtx.full.has(e.schoolId))).sort((a, b) => b.interest + poolRank(b.division) * 1e-3 - (a.interest + poolRank(a.division) * 1e-3));
    if (pool.length === 0) continue;
    const leader = pool[0];
    if (leader.isPlayer && (playerEntry == null ? void 0 : playerEntry.offered)) {
      const second = (_h = (_g = pool[1]) == null ? void 0 : _g.interest) != null ? _h : 0;
      recruit._contestedAtCommit = leader.interest - second <= C.CONTESTED_MARGIN;
      recruit.committed = playerSchoolId;
      recruit.decisionStatus = "signed";
      recruit.funnelStage = "committed";
      commits.push({
        recruit,
        schoolId: playerSchoolId,
        losers: pool.slice(1).map((e) => e.schoolId)
      });
    } else {
      const rivalWinner = pool.find((e) => !e.isPlayer);
      if (!rivalWinner) continue;
      recruit.committed = rivalWinner.schoolId;
      recruit.decisionStatus = "signed";
      recruit.funnelStage = "committed";
      if ((playerEntry == null ? void 0 : playerEntry.offered) && playerCoach) {
        playerEntry.offered = false;
        playerCoach.scholarshipsAvailable = (playerCoach.scholarshipsAvailable || 0) + 1;
      }
      commits.push({
        recruit,
        schoolId: rivalWinner.schoolId,
        losers: playerEntry ? [playerSchoolId] : []
      });
      const winSchool = (schools || []).find((s) => s.id === rivalWinner.schoolId);
      const ai = (_i = winSchool == null ? void 0 : winSchool.coach) == null ? void 0 : _i.aiRec;
      if (ai) {
        ai.filled++;
        if (!ai.full && ai.filled >= ai.slots) {
          ai.full = true;
          (_j = aiCtx == null ? void 0 : aiCtx.full) == null ? void 0 : _j.add(winSchool.id);
          (_k = aiCtx == null ? void 0 : aiCtx.share) == null ? void 0 : _k.set(winSchool.id, 0);
          if (events && (playerBoard || []).some((be) => {
            const rr = recruits.find((x) => x.id === be.recruitId);
            return rr && !rr.committed && (rr.rivals || []).some((rv) => rv.schoolId === winSchool.id && !rv.eliminated);
          })) {
            events.push({ type: "info", text: `${winSchool.name} wrapped up their class \u2014 they've cooled on your board.` });
          }
        }
      }
    }
  }
  return commits;
}
function fillRemainingSlots(school, recruits, openSlots) {
  if (openSlots <= 0) return [];
  const _myTier = { D1: 3, D2: 2, D3: 1 }[school.division] || 1;
  const uncommitted = recruits.filter(
    (r) => !r.committed && r.decisionStatus === "undecided" && calibreVisible(r, school.division) && tierOf(r) !== _myTier - 1
  );
  // [PLAYTEST 2026-08-12 item 27] Board-building is need-aware (needWeight), but
  // this signing-day backfill was not: it sorted by distance and asked only "am I
  // at ROSTER_POS_MAX?" — and ROSTER_POS_MAX.DE is 7, which is exactly the "signed
  // 7 DE with 0 need" the owner took over. Two fixes: count RETURNING players so
  // the number matches the needs board, and order by positional deficit first.
  // TWO counts, deliberately. posCount is the whole room and guards the hard cap
  // exactly as before — loosening it to returning-only would let a room bloat in
  // the transition season. returningCount is what the coach's needs board reads,
  // and it is what "do I actually have a hole here?" has to be measured against.
  const posCount = {};
  const returningCount = {};
  for (const p of school.roster || []) {
    posCount[p.position] = (posCount[p.position] || 0) + 1;
    if (p.classYear !== "SR") returningCount[p.position] = (returningCount[p.position] || 0) + 1;
  }
  const targets = schemeRosterTargets(school) || ROSTER_TARGETS;
  const signedByPos = {};
  const deficitOf = (pos) => Math.max(0, ((targets == null ? void 0 : targets[pos]) || 0) - (returningCount[pos] || 0) - (signedByPos[pos] || 0));
  uncommitted.sort((a, b) => {
    const fa = deficitOf(a.position);
    const fb = deficitOf(b.position);
    if (fa !== fb) return fb - fa;
    const da = recruitDistance(a, school);
    const db = recruitDistance(b, school);
    if (da !== db) return da - db;
    return (b.visionRating || 0) - (a.visionRating || 0);
  });
  const atMax = (pos) => ROSTER_POS_MAX[pos] != null && (posCount[pos] || 0) >= ROSTER_POS_MAX[pos];
  const belowMin = (pos) => ROSTER_POS_MIN[pos] != null && (posCount[pos] || 0) < ROSTER_POS_MIN[pos];
  const signed = [];
  const take = (r) => {
    r.committed = school.id;
    r.decisionStatus = "committed";
    posCount[r.position] = (posCount[r.position] || 0) + 1;
    signedByPos[r.position] = (signedByPos[r.position] || 0) + 1;
    signed.push(r);
  };
  for (const r of uncommitted) {
    if (signed.length >= openSlots) break;
    if (r.committed) continue;
    if (belowMin(r.position) && !atMax(r.position)) take(r);
  }
  // Pass 2 now takes only where a real hole exists. Stacking a room to its cap
  // because the cap happened to be high is what produced the seven-end class.
  for (const r of uncommitted) {
    if (signed.length >= openSlots) break;
    if (r.committed) continue;
    if (deficitOf(r.position) > 0 && !atMax(r.position)) take(r);
  }
  // Last resort: fill the class out, but never past the room's hard cap — an
  // unfilled slot beats an eighth defensive end.
  for (const r of uncommitted) {
    if (signed.length >= openSlots) break;
    if (r.committed) continue;
    if (!atMax(r.position)) take(r);
  }
  return signed;
}
var _recDiffMult, DIV_DOMINANCE_RANK;

_recDiffMult = 1;
DIV_DOMINANCE_RANK = { D1: 3, D2: 2, D3: 1 };

export { actionCost, applyAIWeeklySpend, applyWeeklyContact, buildAIRecruiting, buildFunnelPool, buyFacilityUpgrade, calibreVisible, createBoardEntry, displayedRating, distanceTier, divisionRank, facilityLevel, facilityUpgradeCost, facilityUpkeep, fillRemainingSlots, hasScouted, initBudget, recMultFor, resolveFunnel, resolveRooms, seedFunnelData, setContactAlloc, setRecruitDifficulty, takeAction, wantSatisfaction };

// additional exports consumed by tools/ probes
export { tierOf };
