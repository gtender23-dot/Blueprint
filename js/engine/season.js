import { __spreadProps, __spreadValues } from '../_spread.js';
import { C, ROSTER_TARGETS, STARTER_COUNTS, schemeRosterTargets } from '../constants.js';
import { aiSetWeeklyReaction } from './ai.js';
import { awardDevelopmentXP, collectWeeklyCandidates, computeMilestones, computeProgramMilestones, computeSeasonAwards, finalizeWeeklyAwards } from './awards.js';
import { coachRepScore, expectedWins, schoolPull, seatState } from './career.js';
import { addSkillXP, gradeFromXP, skillGradeIndex } from './coach.js';
import { addDnaXP, coachRecords, dnaGrades, noteCoachRecords } from './coachprofile.js';
import { applyRedshirt, autoRedshirtFreshmen, checkGameInjury, computeAutoRedshirtCandidates, developPlayer, getEffectivePracticePlan, healInjuries, runGraduation } from './development.js';
import { advanceOffseasonStage, checkRivalryResult, evaluateConversions, evaluateSeasonGoals, initOffseason, initPreseason, pass7Rollover, preseasonAdvanceHook, slotRivalryGame } from './offseason.js';
import { createWalkOn, emptyStats, refreshRatings } from './player.js';
import { PLAY_CATALOG, growFlaw, growthFromGameStats, shrinkFlaw } from './traits.js';
import { ensureTree, refreshAgenda, lockstepBlock, treeSeasonTick, syncActiveSlot, noteMoveUpHandoff, canRetire as canRetire2 } from './tree.js';
import { computeDivisionPoll, computeSOS, rankMap } from './rankings.js';
import { actionCost, applyAIWeeklySpend, applyWeeklyContact, buildFunnelPool, createBoardEntry, distanceTier, divisionRank, fillRemainingSlots, initBudget, resolveFunnel, resolveRooms, setContactAlloc, setRecruitDifficulty, takeAction } from './recruiting.js';
import { finishInteractiveGame, midGameReport, pinnedFirst, resumeFromCall, resumeFromDecision, setAutoCounter, simulateFirstHalf, simulateGame, simulateSecondHalf, stepSecondHalf } from './sim.js';
import { defaultWeeklyPlan } from './situations.js';
import { coordRatingAvg, generateCoordinator, growHCMastery, growStaffSchemeIQ, rollCoordinatorPoach, writeStaffLedger } from './staff.js';
import { onStartLeash } from './starts.js';
import { buildDepthChart, generateAICoach, generateRecruitPool, generateSchedule } from './world.js';
import { randInt3, recruitDistance } from '../utils.js';

function isRecruitingDay(day) {
  return day >= RECRUITING_OPEN.start && day <= RECRUITING_OPEN.end;
}
function getPhase(day) {
  for (const [key, phase] of Object.entries(PHASES)) {
    if (day >= phase.days[0] && day <= phase.days[1]) return key;
  }
  return "OFFSEASON";
}
function calendarWeek(day) {
  const d = Number(day) || 0;
  if (d <= PHASES.PRESEASON.days[1]) {
    const n2 = Math.max(1, d);
    return {
      kind: "preseason",
      num: n2,
      total: PHASES.PRESEASON.days[1],
      label: `Preseason Week ${n2}`,
      short: `PRE ${n2}`
    };
  }
  if (d === PHASES.CONFCHAMP.days[1]) {
    return {
      kind: "selection",
      num: REG_WEEK_COUNT,
      total: REG_WEEK_COUNT,
      label: "Selection Week",
      short: "SEL"
    };
  }
  if (d <= PHASES.CONFCHAMP.days[1]) {
    const n2 = d - REG_WEEK_1_DAY + 1;
    return {
      kind: "regular",
      num: n2,
      total: REG_WEEK_COUNT,
      label: `Week ${n2}`,
      short: `W${n2}`
    };
  }
  if (d <= PHASES.PLAYOFFS.days[1]) {
    const n2 = d - PHASES.PLAYOFFS.days[0] + 1;
    return {
      kind: "postseason",
      num: n2,
      total: PHASES.PLAYOFFS.days[1] - PHASES.PLAYOFFS.days[0] + 1,
      label: `Playoff Round ${n2}`,
      short: `PLAYOFF ${n2}`
    };
  }
  const n = d - PHASES.JOBS.days[0] + 1;
  return {
    kind: "offseason",
    num: n,
    total: PHASES.JOBS.days[1] - PHASES.JOBS.days[0] + 1,
    label: "Offseason",
    short: "OFF"
  };
}
function recruitAssistLevel(state2) {
  var _a, _b;
  const lvl = (_a = state2.settings) == null ? void 0 : _a.recruitAssist;
  if (lvl === "off") return "off";
  if (lvl === "full" || lvl === "assist") return "full";
  return ((_b = state2.settings) == null ? void 0 : _b.autoRecruit) ? "full" : "off";
}
function defaultRecruitStrategy() {
  return { priorities: [], aggression: "balanced", qualityFloor: 0 };
}
function autoCalibReVisible(r, myTier) {
  var _a, _b, _c;
  const t = (_a = r.recruitTier) != null ? _a : r.compositeRating >= 66 ? 3 : r.compositeRating >= 50 ? 2 : 1;
  if (t === myTier) return true;
  if (t === myTier - 1) return ((_b = r.tierPct) != null ? _b : 1) < C.RECRUIT_REACH_DOWN;
  if (t === myTier + 1) return ((_c = r.tierPct) != null ? _c : 0) > 1 - C.RECRUIT_REACH_UP;
  return false;
}
function classNeedAtPos(school, pos) {
  const roster = school.roster || [];
  const have = roster.filter((p) => p.position === pos).length;
  const srs = roster.filter((p) => p.position === pos && p.classYear === "SR").length;
  // Scheme-aware targets (Aug 2026): no-op unless the school's identity is a
  // sub front (see schemeRosterTargets in constants.js).
  return Math.max(0, (schemeRosterTargets(school)[pos] || 0) - (have - srs));
}
function canAffordCost(budget, cost) {
  return cost > 0 && budget >= cost;
}
function autoLegworkAction(coach, recruit, entry, dist) {
  var _a;
  const budget = coach.budget || 0;
  if (!((_a = coach.scouted) == null ? void 0 : _a[recruit.id])) {
    const cost = actionCost("scout", dist);
    if (budget >= cost) return "scout";
  }
  if ((entry.spent || 0) > 1500 || (entry.interest || 0) > 60) {
    if (canAffordCost(budget, actionCost("home_visit", dist))) return "home_visit";
    if (canAffordCost(budget, actionCost("game_visit", dist))) return "game_visit";
  }
  return null;
}
function assistOfferBar(aggr) {
  let bar = 35;
  if (aggr === "aggressive") bar -= 8;
  else if (aggr === "conservative") bar += 8;
  return bar;
}
function autoRecruitForPlayer(state2, day) {
  var _a, _b, _c, _d, _e, _f;
  const level = recruitAssistLevel(state2);
  if (level === "off") return;
  const coach = state2.playerCoach;
  const school = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  if (!coach || !school) return;
  if (!coach.recruitBoard) coach.recruitBoard = [];
  const board = coach.recruitBoard;
  const recruits = state2.world.recruits || [];
  const myTier = (_a = { D1: 3, D2: 2, D3: 1 }[school.division]) != null ? _a : 1;
  const strat = ((_b = state2.settings) == null ? void 0 : _b.recruitStrategy) || defaultRecruitStrategy();
  const aggr = strat.aggression || "balanced";
  const floor = strat.qualityFloor || 0;
  const priorities = Array.isArray(strat.priorities) ? strat.priorities : [];
  const priIndex = (pos) => {
    const i = priorities.indexOf(pos);
    return i < 0 ? 99 : i;
  };
  const positions = Object.keys(ROSTER_TARGETS);
  const needByPos = {}, securedByPos = {};
  for (const pos of positions) {
    needByPos[pos] = classNeedAtPos(school, pos);
    securedByPos[pos] = 0;
  }
  for (const r of recruits) if (r.committed === school.id && securedByPos[r.position] != null) securedByPos[r.position]++;
  for (const e of board) {
    if (!e.offered) continue;
    const r = recruits.find((x) => x.id === e.recruitId);
    if (r && !r.committed && securedByPos[r.position] != null) securedByPos[r.position]++;
  }
  const openNeed = (pos) => Math.max(0, (needByPos[pos] || 0) - (securedByPos[pos] || 0));
  const recById = new Map(recruits.map((r) => [r.id, r]));
  const distScore = (mi) => mi <= 180 ? 45 : mi <= 359 ? 25 : mi <= 700 ? 0 : -35;
  const entryDist = (e) => {
    const r = recById.get(e.recruitId);
    return r ? recruitDistance(r, school) : 9999;
  };
  const isActiveEntry = (e) => {
    const r = recById.get(e.recruitId);
    return !!r && !r.committed && !e.eliminated;
  };
  const logAdds = [];
  const logActs = [];
  let activeBoardCount = board.filter(isActiveEntry).length;
  if (activeBoardCount < AUTO_BOARD_MAX) {
    const boardIds = new Set(board.map((e) => e.recruitId));
    const addedByPos = {};
    for (const e of board) {
      if (!isActiveEntry(e)) continue;
      const r = recById.get(e.recruitId);
      if (r) addedByPos[r.position] = (addedByPos[r.position] || 0) + 1;
    }
    const perPosCap = (pos) => {
      const need = openNeed(pos);
      return need > 0 ? Math.min(5, need + 2) : 2;
    };
    const cands = recruits.filter(
      (r) => !r.committed && !boardIds.has(r.id) && autoCalibReVisible(r, myTier) && (r.visionRating || 0) >= floor
    ).map((r) => {
      const need = openNeed(r.position);
      const score = (need > 0 ? 500 : 0) - priIndex(r.position) * 30 + Math.min(need, 4) * 40 + (r.visionRating || 0) * 0.6 + distScore(recruitDistance(r, school)) * 2;
      return { r, score };
    }).sort((a, b) => b.score - a.score);
    for (const { r } of cands) {
      if (activeBoardCount >= AUTO_BOARD_MAX) break;
      const pos = r.position;
      if ((addedByPos[pos] || 0) >= perPosCap(pos)) continue;
      board.push(createBoardEntry(r, school.id));
      activeBoardCount++;
      addedByPos[pos] = (addedByPos[pos] || 0) + 1;
      logAdds.push({ name: `${((_c = r.name) == null ? void 0 : _c.first) || ""} ${((_d = r.name) == null ? void 0 : _d.last) || ""}`.trim(), pos });
    }
  }
  const remainingDays = Math.max(1, C.RECRUITING_LOCK_DAY - day + 1);
  const perDay = (coach.budget || 0) / remainingDays;
  const contactFrac = aggr === "aggressive" ? 0.7 : aggr === "conservative" ? 0.45 : 0.58;
  const dailyCap = perDay * 0.45;
  const offerBar = assistOfferBar(aggr);
  const sorted = [...board].sort((a, b) => {
    if (!!a.eliminated !== !!b.eliminated) return a.eliminated ? 1 : -1;
    return (b.interest || 0) + distScore(entryDist(b)) - ((a.interest || 0) + distScore(entryDist(a)));
  });
  const MIN_RATE = 100;
  const MAX_RATE = aggr === "aggressive" ? 900 : aggr === "conservative" ? 500 : 700;
  const focusCap = 8 + (aggr === "aggressive" ? 22 : aggr === "conservative" ? 12 : 18);
  const sustainableContact = perDay * contactFrac;
  const activeCount = sorted.filter((e) => !e.eliminated).length;
  const focusCount = Math.max(1, Math.min(activeCount, focusCap, Math.floor(sustainableContact / MIN_RATE)));
  const perRecruit = Math.round(Math.max(MIN_RATE, Math.min(MAX_RATE, sustainableContact / Math.max(1, focusCount))));
  let daySpent = 0;
  let focusRank = 0;
  for (const entry of sorted) {
    if ((coach.budget || 0) <= 0) break;
    if (entry.eliminated) continue;
    const recruit = recruits.find((r) => r.id === entry.recruitId);
    if (!recruit || recruit.committed) continue;
    const dist = recruitDistance(recruit, school);
    const pos = recruit.position;
    const pool = buildFunnelPool(recruit, entry, school.id, school.division);
    const leader = pool[0];
    const interestLeader = [...pool].sort((a, b) => (b.interest || 0) - (a.interest || 0))[0];
    const outclassed = interestLeader && !interestLeader.isPlayer && divisionRank(interestLeader.division) > divisionRank(school.division) && (interestLeader.interest || 0) > (entry.interest || 0);
    const losing = leader && !leader.isPlayer && leader.interest - (entry.interest || 0) >= 35 && leader.interest >= 60;
    if (losing || outclassed) {
      setContactAlloc(entry, 0);
      continue;
    }
    focusRank++;
    const alloc = focusRank <= focusCount ? perRecruit : 0;
    if ((entry.contactAlloc || 0) !== alloc) setContactAlloc(entry, alloc);
    const wantOffer = !entry.offered && (coach.scholarshipsAvailable || 0) > 0 && (entry.interest || 0) >= offerBar;
    const action = wantOffer && (coach.budget || 0) >= (actionCost("offer", dist) || C.RECRUIT_ACTION_COST.offer || 0) ? "offer" : autoLegworkAction(coach, recruit, entry, dist);
    if (!action) continue;
    const cost = actionCost(action, dist) || C.RECRUIT_ACTION_COST[action] || 0;
    if (daySpent + cost > dailyCap + 100) continue;
    if ((coach.budget || 0) < cost) continue;
    const result = takeAction(coach, recruit, entry, action, day, school);
    if (result.ok) {
      daySpent += result.cost;
      if (action === "offer") securedByPos[pos] = (securedByPos[pos] || 0) + 1;
      logActs.push({
        name: `${((_e = recruit.name) == null ? void 0 : _e.first) || ""} ${((_f = recruit.name) == null ? void 0 : _f.last) || ""}`.trim(),
        pos,
        action,
        cost: result.cost,
        gain: Math.round((result.gain || 0) * 10) / 10
      });
    }
  }
  if (logAdds.length > 0 || logActs.length > 0) {
    if (!state2.autoRecruitLog) state2.autoRecruitLog = [];
    state2.autoRecruitLog.push({ season: state2.season, day, adds: logAdds, acts: logActs });
    if (state2.autoRecruitLog.length > 40) state2.autoRecruitLog = state2.autoRecruitLog.slice(-40);
  }
}
function advanceDay(state2, dispatch2) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q;
  setRecruitDifficulty((_a = state2.settings) == null ? void 0 : _a.diffRecruiting);
  if (((_b = state2.settings) == null ? void 0 : _b.injuries) === false) {
    for (const s of state2.world.schools) s._injuriesOff = true;
  } else if ((_e = (_d = (_c = state2.world) == null ? void 0 : _c.schools) == null ? void 0 : _d[0]) == null ? void 0 : _e._injuriesOff) {
    for (const s of state2.world.schools) s._injuriesOff = false;
  }
  if (state2._coachId) {
    const mySchool = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
    if (mySchool && !mySchool._dnaGrades) mySchool._dnaGrades = dnaGrades(state2._coachId);
  }
  {
    const mine = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
    if (mine == null ? void 0 : mine.gameplan) mine.gameplan._aiScheme = false;
  }
  if (((_f = state2.playerCoach) == null ? void 0 : _f.status) === "unemployed") {
    return [{ type: "warning", text: "You must accept a new job before continuing." }];
  }
  if (state2.pendingHalftime) {
    return [{ type: "warning", text: "Finish your halftime adjustments before continuing." }];
  }
  // ── [W9 §12 T1] THE LOCKSTEP GATE ────────────────────────────────────────
  // Advancing requires resolving every other tree coach's game that week — play
  // it (TAKE OVER) or accept it (SOFT FINALIZE). Sits with the other advance
  // gates because it is the same kind of thing: a week not finished being
  // decided cannot become a week that happened. A one-slot tree — and every
  // non-tree save — produces no rows and never sees it.
  if (ensureTree(state2)) {
    refreshAgenda(state2);
    const treeBlock = lockstepBlock(state2);
    if (treeBlock) return [{ type: "warning", text: treeBlock }];
  }
  let carriedStageEvents = null;
  if (state2.offseason && !state2.offseason.done) {
    const stageEvents = advanceOffseasonStage(state2);
    if (!state2.offseason.done) return stageEvents;
    carriedStageEvents = stageEvents;
    state2.day = PHASES.JOBS.days[1] - 1;
  } else if (((_g = state2.offseason) == null ? void 0 : _g.done) && state2.day < PHASES.JOBS.days[1] - 1) {
    state2.day = PHASES.JOBS.days[1] - 1;
  }
  if (state2.day >= 1 && state2.day <= 4) {
    const preEvents = [];
    const gate = preseasonAdvanceHook(state2, preEvents);
    if (!gate.ok) return gate.events;
    if (preEvents.length) {
      carriedStageEvents = [...carriedStageEvents || [], ...preEvents];
    }
  }
  state2.day++;
  if (state2.day > PHASES.JOBS.days[1]) {
    state2.day = 1;
    state2.season++;
    startNewSeason(state2, dispatch2);
    return [];
  }
  const day = state2.day;
  const phase = getPhase(day);
  const events = [];
  if (carriedStageEvents) events.push(...carriedStageEvents);
  if (day >= PHASES.PLAYOFFS.days[0] && day <= PHASES.PLAYOFFS.days[1]) {
    if (day === PHASES.PLAYOFFS.days[0] && !state2.allPlayoffs) buildAllBrackets(state2, events);
    if (day === PHASES.PLAYOFFS.days[0] && (state2.bowls || []).some((b) => !b.result)) {
      const { results: bowlResults, halftimeGame: bowlHalftime } = runD1BowlsFrom(state2, 0);
      for (const r of bowlResults) events.push({ type: "game", result: r.result });
      if (bowlResults.length) {
        events.push({ type: "info", text: `${bowlResults.length} D1 bowl game${bowlResults.length !== 1 ? "s" : ""} played.` });
      }
      if (bowlHalftime) {
        state2.pendingHalftime = __spreadProps(__spreadValues({}, bowlHalftime), { context: __spreadProps(__spreadValues({}, bowlHalftime.context), { day }) });
        events.push(pendingGameEvent(bowlHalftime));
        return events;
      }
    }
    if (state2.allPlayoffs) {
      const { events: pEvents, halftimeGame: pHalftime } = processPlayoffDay(state2, day, 0, 0);
      events.push(...pEvents);
      if (pHalftime) {
        state2.pendingHalftime = pHalftime;
        events.push(pendingGameEvent(pHalftime));
        return events;
      }
    }
  }
  if (day === 5) {
    // Closes the window for EVERY chair — an unfinalised tree school would
    // otherwise carry its pending list into the season forever.
    for (const sid of coachedSchoolIds(state2)) {
      const sch = state2.world.schools.find((s) => s.id === sid);
      if (!sch) continue;
      if ((_h = sch.pendingRedshirts) == null ? void 0 : _h.length) {
        for (const pid of sch.pendingRedshirts) {
          const player = sch.roster.find((p) => p.id === pid);
          if (player) applyRedshirt(player, state2.season);
        }
        const _who = sid === state2.playerSchoolId ? "" : ` (${sch.name})`;
        events.push({ type: "info", text: `Redshirts finalized${_who} \u2014 ${sch.pendingRedshirts.length} player${sch.pendingRedshirts.length !== 1 ? "s" : ""} sitting the year. That window is closed.` });
      }
      sch.pendingRedshirts = null;
    }
  }
  if (isRecruitingDay(day)) {
    const pc = state2.playerCoach;
    const pSchool = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
    if (pc && pSchool) {
      for (const entry of pc.recruitBoard || []) {
        if (entry.contactAlloc > 0) {
          const recruit = state2.world.recruits.find((r) => r.id === entry.recruitId);
          if (recruit && !recruit.committed && !entry.eliminated) applyWeeklyContact(pc, recruit, entry, pSchool);
        }
      }
    }
    autoRecruitForPlayer(state2, day);
    applyAIWeeklySpend(
      state2.world.schools,
      state2.world.recruits,
      (_j = (_i = state2.playerCoach) == null ? void 0 : _i.recruitBoard) != null ? _j : [],
      state2.playerSchoolId,
      day
    );
    resolveRooms(state2.world.recruits, (_l = (_k = state2.playerCoach) == null ? void 0 : _k.recruitBoard) != null ? _l : [], state2.playerSchoolId);
    const commits = resolveFunnel(
      state2.world.recruits,
      state2.playerSchoolId,
      (_n = (_m = state2.playerCoach) == null ? void 0 : _m.recruitBoard) != null ? _n : [],
      state2.playerCoach,
      day,
      state2.world.schools,
      // AI recruiting rebuild: real boards + full-class freeze
      events
    );
    for (const c of commits) {
      c.recruit.decisionStatus = "signed";
      events.push({ type: "commit", recruit: c.recruit, schoolId: c.schoolId, losers: c.losers });
      recordSigning(state2, c.recruit, c.schoolId, c.losers);
    }
    if (day === RECRUITING_OPEN.end) {
      const board = ((_o = state2.playerCoach) == null ? void 0 : _o.recruitBoard) || [];
      for (const entry of board) {
        if (!entry.offered || entry.eliminated) continue;
        const recruit = state2.world.recruits.find((r) => r.id === entry.recruitId);
        if (!recruit || recruit.committed) continue;
        recruit.committed = state2.playerSchoolId;
        recruit.decisionStatus = "signed";
        events.push({ type: "commit", recruit, schoolId: state2.playerSchoolId, losers: [], signingDay: true });
        recordSigning(state2, recruit, state2.playerSchoolId, []);
        events.push({ type: "info", text: `\u{1F58A}\uFE0F Signing Day: ${recruit.name.first} ${recruit.name.last} (${recruit.position}) honors your scholarship offer.` });
      }
      for (const school of state2.world.schools) {
        if (school.id === state2.playerSchoolId) continue;
        const seniors = school.roster.filter((p) => p.classYear === "SR").length;
        const currentVacancies = Math.max(0, C.ROSTER_SIZE - school.roster.length);
        const signed = state2.world.recruits.filter(
          (r) => r.committed === school.id && (r.decisionStatus === "signed" || r.decisionStatus === "committed")
        ).length;
        const classTarget = seniors + currentVacancies;
        const openSlots = classTarget - signed;
        if (openSlots > 0) {
          const filled = fillRemainingSlots(school, state2.world.recruits, openSlots);
          for (const r of filled) {
            if (!recordSigning(state2, r, school.id, [], "backfill")) {
              r.committed = null;
              r.decisionStatus = "undecided";
            }
          }
        }
      }
      for (const recruit of state2.world.recruits) {
        if (recruit.committed && recruit.decisionStatus === "committed") {
          recruit.decisionStatus = "signed";
        }
      }
      const playerBackfills = (state2.signingsLog || []).filter(
        (e) => e.season === state2.season && e.toPlayer && e.source === "backfill"
      ).length;
      const playerFunnels = (state2.signingsLog || []).filter(
        (e) => e.season === state2.season && e.toPlayer && e.source === "funnel"
      ).length;
      if (playerBackfills === 0 && playerFunnels > 0 && state2.playerCoach) {
        addSkillXP(state2.playerCoach, "recruiter", C.XP_CLEAN_SWEEP);
      }
      if (playerFunnels > 0 && state2.playerCoach) {
        const playerFunnelSignings = (state2.signingsLog || []).filter(
          (e) => e.season === state2.season && e.toPlayer && e.source === "funnel"
        );
        const localCount = playerFunnelSignings.filter((e) => {
          const r = state2.world.recruits.find((x) => x.id === e.recruitId);
          const d = recruitDistance(r, state2.world.schools.find((s) => s.id === state2.playerSchoolId));
          return d <= C.ROOTS_RADIUS_MI;
        }).length;
        if (localCount / playerFunnelSignings.length >= C.ROOTS_LOCAL_CLASS_SHARE) {
          addSkillXP(state2.playerCoach, "roots", C.XP_ROOTS_LOCAL_CLASS);
        }
      }
      events.push({ type: "info", text: "Recruiting class locked \u2014 your signees report next season." });
    }
  }
  if (day === PHASES.JOBS.days[0]) {
    finalizeSeasonRecords(state2);
    computeSeasonAwards(state2, events);
    attachSeasonRecap(state2);
    state2.pendingPoach = rollCoordinatorPoach(state2);
    // [DNA TREE §8 + §7] The player's own clock gets its teeth here. At
    // eligible age the question starts getting asked (one mail per season);
    // at the wall the ceremony OPENS — but only when a successor exists.
    // Forcing a retirement that would end the run is a deleted save, and
    // canRetire's law (tree.js) already forbids it; a solo career or a
    // last-coach tree just keeps coaching, advisory only.
    {
      const _pc = state2.playerCoach;
      const _AGE = C.COACH_AGE;
      if (_pc && _pc.age != null && _pc.age >= _AGE.RETIRE_ELIGIBLE && _pc._ageNudgeSeason !== state2.season) {
        _pc._ageNudgeSeason = state2.season;
        if (_pc.age >= _AGE.RETIRE_FORCE) {
          const _gate = canRetire2(state2);
          if (_gate && _gate.ok) {
            state2._forcedRetirement = true;
            events.push({ type: "warning", text: `At ${_pc.age}, the game has decided for you. The retirement ceremony is waiting at the Coach's Office.` });
          } else {
            events.push({ type: "info", text: `${_pc.age} years old and still on the sideline. The sport will let you stay \u2014 it has nobody to hand the whistle to.` });
          }
        } else {
          events.push({ type: "info", text: `You're ${_pc.age}. Nobody says it to your face, but the retirement question is in the building.` });
        }
      }
    }
    if (state2.pendingPoach) events.push({
      type: "warning",
      text: `${state2.pendingPoach.suitorName} is courting your ${state2.pendingPoach.side} ${state2.pendingPoach.coordName} \u2014 decide at Coordinator Hires.`
    });
    updatePrestige(state2);
    updateReputation(state2);
    updateJobSecurity(state2, events);
    const goalResults = evaluateSeasonGoals(state2, events);
    evaluateConversions(state2, events);
    runJobMarket(state2, events);
    let milestoneHits = [];
    let programHits = [];
    const pSchool = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
    if (pSchool) {
      milestoneHits = computeMilestones(pSchool, pSchool.coach, state2._coachId);
      if (milestoneHits.length) {
        recordMilestoneEvents(state2, events, milestoneHits, { raisers: 0, finishers: 0 });
      }
      if (pSchool.coach) {
        programHits = computeProgramMilestones(state2, pSchool, pSchool.coach, events);
      }
    }
    initOffseason(state2, milestoneHits, programHits, goalResults);
    events.push({ type: "offseason-stage", stageId: "jobmarket", text: "Offseason: Coaching Carousel" });
  }
  if (day === PHASES.JOBS.days[1]) {
    endOfSeasonProcessing(state2, events);
  }
  for (const school of state2.world.schools) {
    healInjuries(school.roster);
  }
  if (C.INSEASON_DEV_WEEKS.includes(day)) {
    for (const school of state2.world.schools) {
      for (const player of school.roster) {
        const plan = getEffectivePracticePlan(school, player.position);
        if (plan) developPlayer(player, plan, school.coach, C.INSEASON_DEV_MULT, school);
        // Identity stage 3 (flaws, the coaching-down loop §4c): practice
        // emphasis + coordinator quality chip away at a flaw; a neglected
        // room lets one grow. Rides the existing weekly dev tick.
        coachFlawTick(player, plan, school);
      }
      school.depthChart = buildDepthChart(school.roster, school.gameplan, school.depthOrder || {});
    }
    if (state2.playerSchoolId) events.push({ type: "info", text: "\u{1F3CB}\uFE0F Practice checkpoint \u2014 the week's work shows: your practice plan just developed the roster." });
  }
  // Identity stage 3: surface the week's trait level-ups for the coach's own
  // roster — "Jenkins' Strip Artist hit level II" (pend flags set by the
  // growth pass; AI rosters just clear silently below).
  {
    const mySchool = state2.playerSchoolId ? state2.world.schools.find((sc) => sc.id === state2.playerSchoolId) : null;
    if (mySchool) {
      for (const p of mySchool.roster) {
        const tl = p.traits;
        if (!tl) continue;
        for (const t of tl.play || []) {
          if (!t.pend) continue;
          t.pend = false;
          const nm = PLAY_CATALOG[t.k] ? PLAY_CATALOG[t.k].name : t.k;
          events.push({ type: "info", text: `\u2B50 ${p.name.first} ${p.name.last}'s ${nm} hit level ${"I".repeat(t.lv)}.` });
        }
        for (const t of tl.flaws || []) {
          if (t.pendUp) { t.pendUp = false; events.push({ type: "warning", text: `\u26A0\uFE0F ${p.name.first} ${p.name.last}'s ${flawName(t.k)} is getting worse (level ${"I".repeat(t.lv)}).` }); }
          if (t.pendDown) { t.pendDown = false; events.push({ type: "info", text: `\u{1F4C8} Coaching shows \u2014 ${p.name.first} ${p.name.last}'s ${flawName(t.k)} shrank to level ${"I".repeat(t.lv)}.` }); }
          if (t.pendGone) { t.pendGone = false; }
        }
        if (tl._gone && tl._gone.length) {
          for (const nm of tl._gone.splice(0)) events.push({ type: "info", text: `\u{1F389} ${p.name.first} ${p.name.last} has shaken his ${flawName(nm)} flaw \u2014 the coaching arc pays off.` });
        }
      }
    }
  }
  resolveStaleGames(state2, day, events);
  const dayGames = (state2.schedule || []).filter((g) => g.day === day && !g.result);
  if (dayGames.length > 0) {
    const { results, halftimeGame } = simulateGameDay(dayGames, state2);
    for (const r of results) {
      updateStandings(state2, r);
      events.push({ type: "game", result: r.result });
    }
    const weeklyCands = collectWeeklyCandidates(state2, results);
    if (halftimeGame) {
      state2.pendingWeeklyCands = { day, cands: weeklyCands };
    } else {
      finalizeWeeklyAwards(state2, weeklyCands, events);
      state2.pendingWeeklyCands = null;
    }
    checkRedshirtBurns(state2, events);
    checkRivalryResult(state2, results, events);
    if (halftimeGame) {
      state2.pendingHalftime = halftimeGame;
      events.push(pendingGameEvent(halftimeGame));
    }
  }
  if (day === PHASES.CONFCHAMP.days[1] && !state2.allPlayoffs && !state2.pendingHalftime) {
    events.push({ type: "info", text: "\u{1F3C6} Selection Week — the regular season is over. Conference titles go to the league champions on record, and the postseason field is set." });
    buildAllBrackets(state2, events);
    const div = getPlayerDivision(state2);
    const seeds = ((_q = (_p = state2.allPlayoffs) == null ? void 0 : _p[div]) == null ? void 0 : _q.seeds) || [];
    const seed = seeds.indexOf(state2.playerSchoolId);
    if (seed >= 0) {
      const r1 = state2.allPlayoffs[div].rounds[0];
      const g = (r1.games || []).find((x) => x.homeId === state2.playerSchoolId || x.awayId === state2.playerSchoolId);
      const oppId = g ? g.homeId === state2.playerSchoolId ? g.awayId : g.homeId : null;
      const opp = oppId ? state2.world.schools.find((s) => s.id === oppId) : null;
      events.push({ type: "info", text: opp ? `You're the ${ordinal(seed + 1)} seed. First round: ${opp.name}.` : `You're the ${ordinal(seed + 1)} seed \u2014 first-round bye.` });
    } else {
      const bowl = (state2.bowls || []).find((b) => b.homeId === state2.playerSchoolId || b.awayId === state2.playerSchoolId);
      if (bowl) {
        const oppId = bowl.homeId === state2.playerSchoolId ? bowl.awayId : bowl.homeId;
        const opp = state2.world.schools.find((s) => s.id === oppId);
        events.push({ type: "info", text: `Bowl bid: you'll face ${(opp == null ? void 0 : opp.name) || "a bowl opponent"}.` });
      }
    }
  }
  return events;
}
function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function cheapRandNorm(mean, sd) {
  const u1 = Math.random() || 1e-10;
  const u2 = Math.random();
  return mean + Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * sd;
}
function avgTop22Composite(roster) {
  const field = roster.filter((p) => p.position !== "K" && p.position !== "P");
  const pool = field.length >= 22 ? field : roster;
  const sorted = [...pool].sort((a, b) => b.compositeRating - a.compositeRating).slice(0, 22);
  return sorted.reduce((s, p) => s + (p.compositeRating || 50), 0) / (sorted.length || 1);
}
function topByPos(roster, pos, n, season = null) {
  return roster.filter((p) => p.position === pos && (p.injuryGamesOut || 0) === 0 && !(season != null && p.redshirted && p.redshirtYear === season)).sort((a, b) => (b.compositeRating || 0) - (a.compositeRating || 0)).slice(0, n);
}
function statJitter(v, frac = 0.18) {
  return Math.max(0, Math.round(v * (1 + (Math.random() * 2 - 1) * frac)));
}
function clampNum(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function distributeCheapStats(roster, pts, passLean = 0.55, season = null) {
  var _a, _b, _c, _d, _e;
  const stats = {};
  const add = (id, obj) => {
    stats[id] = __spreadValues(__spreadValues({}, stats[id] || {}), obj);
  };
  const totalYds = Math.max(120, Math.round(pts * cheapRandNorm(14, 2.2)));
  const passYds = Math.round(totalYds * clampNum(passLean + (Math.random() * 0.16 - 0.08), 0.25, 0.8));
  const rushYds = totalYds - passYds;
  const passTD = Math.round(pts / 7 * passLean);
  const rushTD = Math.max(0, Math.round(pts / 7 * (1 - passLean)));
  const qb = topByPos(roster, "QB", 1, season)[0];
  if (qb) {
    const att = Math.max(8, Math.round(passYds / cheapRandNorm(7.4, 0.8)));
    const comp = Math.round(att * clampNum(cheapRandNorm(0.6, 0.05), 0.42, 0.75));
    add(qb.id, { passYds, passComp: comp, passAtt: att, passTD, passInt: Math.random() < 0.5 ? 1 : 0 });
  }
  const rbs = topByPos(roster, "RB", 3, season);
  const rbShares = [0.62, 0.28, 0.1];
  rbs.forEach((rb, i) => {
    const y = statJitter(rushYds * (rbShares[i] || 0));
    add(rb.id, { rushYds: y, rushAtt: Math.max(1, Math.round(y / cheapRandNorm(4.4, 0.4))), rushTD: i === 0 ? rushTD : 0 });
  });
  const recvs = [...topByPos(roster, "WR", 4, season), ...topByPos(roster, "TE", 2, season)];
  const recShares = [0.3, 0.24, 0.17, 0.12, 0.1, 0.07];
  let recTDleft = passTD;
  recvs.forEach((r, i) => {
    const y = statJitter(passYds * (recShares[i] || 0));
    const rec = Math.max(0, Math.round(y / cheapRandNorm(12.5, 1.2)));
    const td = recTDleft > 0 && (i < 2 || Math.random() < 0.3) ? (recTDleft--, 1) : 0;
    add(r.id, { recYds: y, recComp: rec, targets: Math.round(rec * cheapRandNorm(1.5, 0.15)), recTD: td });
  });
  const front = [...topByPos(roster, "LB", 3, season), ...topByPos(roster, "DE", 2, season), ...topByPos(roster, "DT", 2, season), ...topByPos(roster, "OLB", 2, season)];
  const backs = [...topByPos(roster, "CB", 3, season), ...topByPos(roster, "S", 2, season)];
  {
    const k = topByPos(roster, "K", 1, season)[0];
    if (k) {
      const ks = stats[_a = k.id] || (stats[_a] = {});
      const tds = Math.floor(pts / 7);
      const fgM = clampNum(Math.round((pts - tds * 7) / 3), 0, 4);
      ks.xpMade = (ks.xpMade || 0) + tds;
      ks.xpAtt = (ks.xpAtt || 0) + tds + (Math.random() < 0.06 ? 1 : 0);
      ks.fgMade = (ks.fgMade || 0) + fgM;
      ks.fgAtt = (ks.fgAtt || 0) + fgM + (Math.random() < 0.35 ? 1 : 0);
      if (fgM > 0) ks.fgLong = Math.max(ks.fgLong || 0, 25 + Math.floor(Math.random() * 27));
    }
    const p = topByPos(roster, "P", 1, season)[0];
    if (p) {
      const ps = stats[_b = p.id] || (stats[_b] = {});
      const n = 3 + Math.floor(Math.random() * 4);
      ps.puntNo = (ps.puntNo || 0) + n;
      ps.puntYds = (ps.puntYds || 0) + Math.round(n * (36 + Math.random() * 9));
    }
  }
  const tacklePool = Math.round(cheapRandNorm(62, 6));
  const allDef = [...front, ...backs];
  const weights = allDef.map((p, i) => (i < front.length ? 1.4 : 1) * (1 - i * 0.03));
  const wSum = weights.reduce((s, w) => s + w, 0) || 1;
  allDef.forEach((p, i) => {
    const t = Math.max(0, Math.round(tacklePool * weights[i] / wSum));
    const solo = Math.round(t * 0.65);
    add(p.id, { tackles: t, solo, assists: t - solo });
  });
  const sackers = [...topByPos(roster, "DE", 2, season), ...topByPos(roster, "OLB", 2, season), ...topByPos(roster, "DT", 1, season)];
  let sacks = Math.round(cheapRandNorm(2, 1));
  while (sacks-- > 0 && sackers.length) {
    const s = sackers[Math.floor(Math.random() * sackers.length)];
    add(s.id, { sacks: (((_c = stats[s.id]) == null ? void 0 : _c.sacks) || 0) + 1, tacklesForLoss: (((_d = stats[s.id]) == null ? void 0 : _d.tacklesForLoss) || 0) + 1 });
  }
  if (backs.length && Math.random() < 0.55) {
    const pick2 = backs[Math.floor(Math.random() * backs.length)];
    add(pick2.id, { ints: (((_e = stats[pick2.id]) == null ? void 0 : _e.ints) || 0) + 1 });
  }
  backs.slice(0, 2).forEach((b) => {
    var _a2;
    if (Math.random() < 0.5) add(b.id, { passBreakups: (((_a2 = stats[b.id]) == null ? void 0 : _a2.passBreakups) || 0) + 1 });
  });
  return stats;
}
function passLeanOf(school) {
  var _a, _b;
  const t = ((_a = school.gameplan) == null ? void 0 : _a.tendency) || "Balanced";
  return (_b = {
    "Always Pass": 0.76,
    "Heavy Pass": 0.68,
    "Pass": 0.6,
    "Balanced": 0.55,
    "Run": 0.48,
    "Heavy Run": 0.4,
    "Always Run": 0.32
  }[t]) != null ? _b : 0.55;
}
function cheapSimGame(home, away, season = null) {
  const hStr = avgTop22Composite(home.roster) + C.CHEAP_HOME_EDGE;
  const aStr = avgTop22Composite(away.roster);
  const d = hStr - aStr;
  const pHome = 1 / (1 + Math.exp(-d / C.CHEAP_SPREAD));
  const homeWin = Math.random() < pHome;
  const base = 17 + Math.round(Math.random() * 17);
  const margin = Math.max(1, Math.round(Math.abs(cheapRandNorm(Math.abs(d) * 0.8, C.CHEAP_MARGIN_SD))));
  const homeScore = homeWin ? base + margin : base;
  const awayScore = homeWin ? base : base + margin;
  return {
    homeScore,
    awayScore,
    winner: homeWin ? home.id : away.id,
    homeStats: {},
    awayStats: {},
    // Distribute a plausible box score so every team gets real player stats.
    homePlayerStats: distributeCheapStats(home.roster, homeScore, passLeanOf(home), season),
    awayPlayerStats: distributeCheapStats(away.roster, awayScore, passLeanOf(away), season)
  };
}
function getPlayerDivision(state2) {
  var _a, _b;
  return ((_b = (_a = state2.world) == null ? void 0 : _a.schools.find((s) => s.id === state2.playerSchoolId)) == null ? void 0 : _b.division) || "D3";
}
function resetWeeklyPlan(state2) {
  const me = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  if (me) me.weeklyPlan = defaultWeeklyPlan();
  state2._pregamePlan = null;
}
function gameDressed(school, season) {
  // Injuries heal on every day tick but the stored chart only rebuilds on the
  // in-season dev weeks, so between them it can bury a healed starter and keep
  // dressing an injured one. Rebuild for the two teams actually playing — cheap,
  // deterministic, and it keeps the depth-chart screen honest between games.
  school.depthChart = buildDepthChart(school.roster, school.gameplan, school.depthOrder || {});
  const rs = new Set(school.roster.filter((p) => p.redshirted && p.redshirtYear === season).map((p) => p.id));
  if (rs.size === 0) return { roster: school.roster, depth: pinnedFirst(school.depthChart, school.gameplan) };
  for (const [pos, ids] of Object.entries(school.depthChart || {})) {
    if ((ids || []).length > 0 && ids.every((id) => rs.has(id))) {
      for (const id of ids) rs.delete(id);
    }
  }
  if (rs.size === 0) return { roster: school.roster, depth: pinnedFirst(school.depthChart, school.gameplan) };
  const roster = school.roster.filter((p) => !rs.has(p.id));
  const depth = {};
  for (const [pos, ids] of Object.entries(school.depthChart || {})) {
    depth[pos] = (ids || []).filter((id) => !rs.has(id));
  }
  return { roster, depth: pinnedFirst(depth, school.gameplan) };
}
function playerGameOpponentForDay(state2, day) {
  var _a, _b, _c, _d, _e;
  const pid = state2.playerSchoolId;
  if (!pid || ((_a = state2.playerCoach) == null ? void 0 : _a.status) === "unemployed") return null;
  const name = (id) => {
    var _a2;
    return ((_a2 = state2.world.schools.find((s) => s.id === id)) == null ? void 0 : _a2.name) || null;
  };
  const g = (state2.schedule || []).find((g2) => g2.day === day && !g2.result && (g2.homeId === pid || g2.awayId === pid));
  if (g) return name(g.homeId === pid ? g.awayId : g.homeId);
  if (day >= PHASES.PLAYOFFS.days[0] && day <= PHASES.PLAYOFFS.days[1]) {
    if (day === PHASES.PLAYOFFS.days[0]) {
      const b = (state2.bowls || []).find((b2) => !b2.result && (b2.homeId === pid || b2.awayId === pid));
      if (b) return name(b.homeId === pid ? b.awayId : b.homeId);
    }
    const div = getPlayerDivision(state2);
    const round = (_d = (_c = (_b = state2.allPlayoffs) == null ? void 0 : _b[div]) == null ? void 0 : _c.rounds) == null ? void 0 : _d.find((r) => r.day === day && !r.complete);
    const pg = (_e = round == null ? void 0 : round.games) == null ? void 0 : _e.find((x) => !x.result && (x.homeId === pid || x.awayId === pid));
    if (pg) return name(pg.homeId === pid ? pg.awayId : pg.homeId);
  }
  return null;
}
function pendingGameEvent(hg) {
  var _a, _b;
  const k = (_b = (_a = hg.token) == null ? void 0 : _a.pending) == null ? void 0 : _b.kind;
  return k ? { type: k === "fourth" ? "fourthdown" : "playcall", game: hg.game, token: hg.token } : { type: "halftime", game: hg.game, token: hg.token };
}
function runGameMaybeHalftime(home, away, state2) {
  var _a, _b;
  const isUser = home.id === state2.playerSchoolId || away.id === state2.playerSchoolId;
  const iqVsPlayer = (_a = state2.settings) == null ? void 0 : _a.diffCoaching;
  if (home.id !== state2.playerSchoolId) aiSetWeeklyReaction(home, away, away.id === state2.playerSchoolId ? iqVsPlayer : "varsity");
  if (away.id !== state2.playerSchoolId) aiSetWeeklyReaction(away, home, home.id === state2.playerSchoolId ? iqVsPlayer : "varsity");
  const h = gameDressed(home, state2.season);
  const a = gameDressed(away, state2.season);
  if (isUser) {
    const pgp = state2._pregamePlan;
    const homeGP = pgp && home.id === state2.playerSchoolId ? pgp : home.gameplan;
    const awayGP = pgp && away.id === state2.playerSchoolId ? pgp : away.gameplan;
    const token = simulateFirstHalf(
      home,
      away,
      h.roster,
      a.roster,
      h.depth,
      a.depth,
      homeGP,
      awayGP,
      // Difficulty: the AI opponent's execution edge, player games only.
      {
        playerSide: home.id === state2.playerSchoolId ? "home" : "away",
        difficulty: (_b = state2.settings) == null ? void 0 : _b.difficulty,
        // Rung 6: the kickoff-time headset choice rides this one game.
        // Absent/'off' = the straight-through path, exactly as before.
        callMode: state2._callModeToday || null
      }
    );
    return { halftimeToken: token };
  }
  const result = simulateGame(
    home,
    away,
    h.roster,
    a.roster,
    h.depth,
    a.depth,
    home.gameplan,
    away.gameplan
  );
  return { result };
}
function checkRedshirtBurns(state2, events) {
  var _a, _b, _c;
  const school = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  if (!school) return;
  for (const p of school.roster) {
    if (!p.redshirted || p.redshirtYear !== state2.season) continue;
    if ((((_a = p.stats) == null ? void 0 : _a.games) || 0) > C.REDSHIRT_MAX_GAMES) {
      p.redshirted = false;
      p.redshirtYear = null;
      const name = `${((_b = p.name) == null ? void 0 : _b.first) || ""} ${((_c = p.name) == null ? void 0 : _c.last) || ""}`.trim();
      events.push({ type: "warning", text: `${name} played his ${C.REDSHIRT_MAX_GAMES + 1}th game \u2014 redshirt burned. His class clock resumes.` });
    }
  }
}
function recordIsShort(state2, school) {
  var _a, _b;
  const played = (state2.schedule || []).filter((g) => g.result && (g.homeId === school.id || g.awayId === school.id)).length;
  const booked = (((_a = school.record) == null ? void 0 : _a.wins) || 0) + (((_b = school.record) == null ? void 0 : _b.losses) || 0);
  return booked < played;
}
function resolveStaleGames(state2, day, events) {
  const stale = (state2.schedule || []).filter((g) => g.day < day && !g.result);
  if (!stale.length) return 0;
  const playerDiv = getPlayerDivision(state2);
  let healed = 0;
  for (const game of stale) {
    const home = state2.world.schools.find((s) => s.id === game.homeId);
    const away = state2.world.schools.find((s) => s.id === game.awayId);
    if (!home || !away) continue;
    const isUserGame = game.homeId === state2.playerSchoolId || game.awayId === state2.playerSchoolId;
    const h = gameDressed(home, state2.season);
    const a = gameDressed(away, state2.season);
    const result = home.division === playerDiv ? simulateGame(home, away, h.roster, a.roster, h.depth, a.depth, home.gameplan, away.gameplan) : cheapSimGame(home, away, state2.season);
    game.result = isUserGame && home.division === playerDiv ? result : { homeScore: result.homeScore, awayScore: result.awayScore, winner: result.winner };
    if (recordIsShort(state2, home) && recordIsShort(state2, away)) {
      updateStandings(state2, { game, result });
    }
    events.push({ type: "game", result: game.result });
    healed++;
  }
  const mine = stale.filter((g) => g.result && (g.homeId === state2.playerSchoolId || g.awayId === state2.playerSchoolId)).length;
  if (mine) {
    events.push({ type: "info", text: mine === 1 ? "A game was missing from your schedule and has now been played and recorded." : `${mine} games were missing from your schedule and have now been played and recorded.` });
  }
  return healed;
}
function simulateGameDay(games, state2) {
  var _a, _b;
  const playerDiv = getPlayerDivision(state2);
  const results = [];
  let halftimeGame = null;
  for (const game of games) {
    if (game.result) continue;
    const home = state2.world.schools.find((s) => s.id === game.homeId);
    const away = state2.world.schools.find((s) => s.id === game.awayId);
    if (!home || !away) continue;
    const isUserGame = game.homeId === state2.playerSchoolId || game.awayId === state2.playerSchoolId;
    if (home.division === playerDiv) {
      const { halftimeToken, result } = runGameMaybeHalftime(home, away, state2);
      if (halftimeToken) {
        halftimeGame = { token: halftimeToken, game, home, away };
        continue;
      }
      if (((_a = state2.settings) == null ? void 0 : _a.injuries) !== false) for (const player of home.roster) checkGameInjury(player, state2.day, home);
      if (((_b = state2.settings) == null ? void 0 : _b.injuries) !== false) for (const player of away.roster) checkGameInjury(player, state2.day, away);
      game.result = isUserGame ? result : { homeScore: result.homeScore, awayScore: result.awayScore, winner: result.winner };
      results.push({ game, result });
    } else {
      const result = cheapSimGame(home, away, state2.season);
      game.result = { homeScore: result.homeScore, awayScore: result.awayScore, winner: result.winner };
      results.push({ game, result });
    }
  }
  return { results, halftimeGame };
}
function resumeFromHalftime(state2, homeGPEdits = null, awayGPEdits = null) {
  var _a, _b, _c, _d;
  const pending2 = state2.pendingHalftime;
  if (!pending2) return [];
  if ((_a = pending2.token) == null ? void 0 : _a.pending) {
    return [pendingGameEvent(pending2)];
  }
  const { token, game, home, away, context } = pending2;
  let adjEval = null;
  if (pending2.adjustment && state2._coachId) {
    const isHome = home.id === state2.playerSchoolId;
    const myGP = isHome ? token.homeGP : token.awayGP;
    const adj = pending2.adjustment;
    const grade = ((_c = (_b = home.id === state2.playerSchoolId ? home : away) == null ? void 0 : _b._dnaGrades) == null ? void 0 : _c.adjustments) || 0;
    const strength = 1 + grade * 0.1;
    const mid = midGameReport(token);
    const oppStats = isHome ? mid.awayPlayerStats : mid.homePlayerStats;
    const myH1SacksAllowed = Object.values(oppStats || {}).reduce((s, p) => s + (p.sacks || 0), 0);
    if (adj.kind === "offlean") {
      myGP._h2OffLean = { eff: Math.min(0.16, 0.08 * strength) };
      adjEval = { kind: "offlean", h1Pts: isHome ? token.homeScore : token.awayScore };
    } else if (adj.kind === "deflean") {
      myGP._h2DefLean = { eff: Math.min(0.16, 0.08 * strength) };
      adjEval = { kind: "deflean", h1OppPts: isHome ? token.awayScore : token.homeScore };
    } else if (adj.kind === "fresh") {
      myGP._h2Fresh = { eff: Math.min(0.5, 0.28 * strength) };
      adjEval = { kind: "fresh", h1Pts: isHome ? token.homeScore : token.awayScore };
    } else if (adj.kind === "protect") {
      // G3 (Aug 2026): the orphaned _h2Protect read (resolvePassRush) gets its
      // writer back — sized so a full grade-10 adjustments coach caps at 0.2.
      myGP._h2Protect = { eff: Math.min(0.2, 0.1 * strength) };
      adjEval = { kind: "protect", h1Sacks: myH1SacksAllowed };
    } else if (adj.kind === "shadow" && adj.id) {
      // G3: the orphaned _h2Shadow read (separation tax on one receiver). Eff
      // sized off tools/h2_shadow_probe.mjs — 0.07 = -31% whole-game on the
      // hot man's line, i.e. ~15-20% over an H2-only bracket. In band.
      myGP._h2Shadow = { id: adj.id, eff: Math.min(0.12, 0.07 * strength) };
      const _h1Rec = ((_c2 => (_c2 == null ? void 0 : _c2.recYds) || 0)((oppStats || {})[adj.id]));
      adjEval = { kind: "shadow", id: adj.id, name: adj.name || "their top target", h1RecYds: _h1Rec };
    }
  }
  {
    const isHome = home.id === state2.playerSchoolId;
    const aiGP = isHome ? token.awayGP : token.homeGP;
    setAutoCounter(aiGP, token.drives, isHome ? "home" : "away", (_d = state2.settings) == null ? void 0 : _d.diffCoaching);
  }
  if (token.callMode && token.callMode !== "off") {
    pending2._h2 = { adjEval };
    stepSecondHalf(token, homeGPEdits, awayGPEdits);
    return continueSteppedGame(state2, pending2);
  }
  state2.pendingHalftime = null;
  const result = simulateSecondHalf(token, homeGPEdits, awayGPEdits);
  return finishPlayerGame(state2, pending2, result, adjEval);
}
function continueSteppedGame(state2, pending2) {
  const token = pending2.token;
  if (token.pending) {
    return [pendingGameEvent(pending2)];
  }
  if (!pending2._h2) {
    return [{ type: "halftime", game: pending2.game, token }];
  }
  state2.pendingHalftime = null;
  return finishPlayerGame(state2, pending2, finishInteractiveGame(token), pending2._h2.adjEval);
}
function resumeFromPlayCall(state2, call) {
  const pending2 = state2.pendingHalftime;
  const token = pending2 == null ? void 0 : pending2.token;
  if (!(token == null ? void 0 : token.pending) || token.pending.kind !== "playcall" && token.pending.kind !== "defcall") return [];
  resumeFromCall(token, call);
  return continueSteppedGame(state2, pending2);
}
function resumeFromFourthDown(state2, decision) {
  const pending2 = state2.pendingHalftime;
  const token = pending2 == null ? void 0 : pending2.token;
  if (!(token == null ? void 0 : token.pending) || token.pending.kind !== "fourth") return [];
  resumeFromDecision(token, decision || "auto");
  return continueSteppedGame(state2, pending2);
}
function finishPlayerGame(state2, pending2, result, adjEval) {
  var _a, _b, _c;
  const { token, game, home, away, context } = pending2;
  state2._callModeToday = null;
  if (adjEval && state2._coachId) {
    const isHome = home.id === state2.playerSchoolId;
    const oppFinal = isHome ? result.awayScore : result.homeScore;
    const myFinal = isHome ? result.homeScore : result.awayScore;
    let worked = false, line = "";
    if (adjEval.kind === "offlean") {
      const h2Pts = myFinal - adjEval.h1Pts;
      worked = h2Pts > adjEval.h1Pts;
      line = `Offensive lean: ${adjEval.h1Pts} scored in H1 \u2192 ${h2Pts} in H2`;
    } else if (adjEval.kind === "deflean") {
      const h2Opp = oppFinal - adjEval.h1OppPts;
      worked = h2Opp < adjEval.h1OppPts;
      line = `Defensive lean: ${adjEval.h1OppPts} allowed in H1 \u2192 ${h2Opp} in H2`;
    } else if (adjEval.kind === "fresh") {
      const h2Pts = myFinal - adjEval.h1Pts;
      worked = h2Pts >= adjEval.h1Pts;
      line = `Fresh legs: ${adjEval.h1Pts} scored in H1 \u2192 ${h2Pts} closing the game out`;
    } else if (adjEval.kind === "protect") {
      const oppPS = isHome ? result.awayPlayerStats : result.homePlayerStats;
      const finalSacks = Object.values(oppPS || {}).reduce((s2, p2) => s2 + (p2.sacks || 0), 0);
      const h2Sacks = Math.max(0, finalSacks - adjEval.h1Sacks);
      worked = h2Sacks <= adjEval.h1Sacks;
      line = `Protection: ${adjEval.h1Sacks} sack${adjEval.h1Sacks === 1 ? "" : "s"} allowed in H1 \u2192 ${h2Sacks} behind the extra bodies`;
    } else if (adjEval.kind === "shadow") {
      const oppPS = isHome ? result.awayPlayerStats : result.homePlayerStats;
      const finalRec = ((oppPS || {})[adjEval.id] || {}).recYds || 0;
      const h2Rec = Math.max(0, finalRec - adjEval.h1RecYds);
      worked = h2Rec < adjEval.h1RecYds;
      line = `Shadow on ${adjEval.name}: ${adjEval.h1RecYds} receiving yards in H1 \u2192 ${h2Rec} under the bracket`;
    }
    try {
      addDnaXP(state2._coachId, { adjustments: worked ? 6 : 1 });
      const mySchool = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
      if (mySchool) mySchool._dnaGrades = dnaGrades(state2._coachId);
      state2._lastAdjEval = { worked, line };
    } catch (e) {
    }
  }
  if (((_a = state2.settings) == null ? void 0 : _a.injuries) !== false) for (const player of home.roster) checkGameInjury(player, state2.day, home);
  if (((_b = state2.settings) == null ? void 0 : _b.injuries) !== false) for (const player of away.roster) checkGameInjury(player, state2.day, away);
  resetWeeklyPlan(state2);
  game.result = result;
  const kind = (context == null ? void 0 : context.kind) || "regular";
  if (kind === "regular") {
    const events2 = [];
    const r = { game, result };
    try {
      trackCoachDNA(state2, token, game, result, events2);
    } catch (e) {
      console.warn("DNA track:", e.message);
    }
    try {
      for (const s of [home, away]) updateOLContinuity(s);
    } catch (e) {
    }
    if (state2._lastAdjEval) {
      events2.push({
        type: state2._lastAdjEval.worked ? "info" : "warning",
        text: `\u{1F9E0} ${state2._lastAdjEval.line} \u2014 ${state2._lastAdjEval.worked ? "it worked" : "didn't take"}`
      });
      state2._lastAdjEval = null;
    }
    updateStandings(state2, r);
    const stash = state2.pendingWeeklyCands;
    const dayCands = stash && stash.day === game.day ? stash.cands : [];
    state2.pendingWeeklyCands = null;
    finalizeWeeklyAwards(state2, [...dayCands, ...collectWeeklyCandidates(state2, [r])], events2);
    checkRedshirtBurns(state2, events2);
    checkRivalryResult(state2, [r], events2);
    events2.push({ type: "game", result });
    return events2;
  }
  if (kind === "bowl") {
    const events2 = [{ type: "game", result }];
    try {
      trackCoachDNA(state2, token, game, result, events2);
    } catch (e) {
      console.warn("DNA track:", e.message);
    }
    const winner = state2.world.schools.find((s) => s.id === result.winner);
    if (winner) winner.prestige = Math.min(winner.prestige + C.PRESTIGE_W_BOWL, (_c = winner.prestigeMax) != null ? _c : 5);
    const { results: restBowls, halftimeGame: nextBowlHalftime } = runD1BowlsFrom(state2, context.pairIdx + 1);
    for (const r of restBowls) events2.push({ type: "game", result: r.result });
    if (nextBowlHalftime) {
      state2.pendingHalftime = nextBowlHalftime;
      events2.push({ type: "halftime", game: nextBowlHalftime.game, token: nextBowlHalftime.token });
      return events2;
    }
    const { events: pEvents2, halftimeGame: pHalftime2 } = processPlayoffDay(state2, context.day, 0, 0);
    events2.push(...pEvents2);
    if (pHalftime2) {
      state2.pendingHalftime = pHalftime2;
      events2.push({ type: "halftime", game: pHalftime2.game, token: pHalftime2.token });
    }
    return events2;
  }
  const events = [{ type: "game", result }];
  const bracket = state2.allPlayoffs[context.div];
  const round = bracket.rounds.find((r) => r.day === context.day && !r.complete);
  const { results: restGames, halftimeGame: nextHalftime } = playPlayoffRoundFrom(round, state2, context.gameIdx + 1, context.div);
  for (const r of restGames) events.push({ type: "game", result: r.result });
  if (nextHalftime) {
    state2.pendingHalftime = __spreadProps(__spreadValues({}, nextHalftime), { context: __spreadProps(__spreadValues({}, nextHalftime.context), { divIdx: context.divIdx, day: context.day }) });
    events.push({ type: "halftime", game: nextHalftime.game, token: nextHalftime.token });
    return events;
  }
  round.complete = true;
  populateNextPlayoffRound(bracket, round, state2, events);
  if (bracket.champion) {
    const champ = state2.world.schools.find((s) => s.id === bracket.champion);
    if (champ) events.push({ type: "info", text: `${champ.name} wins the ${context.div} Championship!` });
  }
  const { events: pEvents, halftimeGame: pHalftime } = processPlayoffDay(state2, context.day, context.divIdx + 1, 0);
  events.push(...pEvents);
  if (pHalftime) {
    state2.pendingHalftime = pHalftime;
    events.push({ type: "halftime", game: pHalftime.game, token: pHalftime.token });
  }
  return events;
}
function updateStandings(state2, { game, result }) {
  const home = state2.world.schools.find((s) => s.id === game.homeId);
  const away = state2.world.schools.find((s) => s.id === game.awayId);
  if (!home || !away) return;
  const isConf = home.conf === away.conf;
  if (result.homeScore > result.awayScore) {
    home.record.wins++;
    away.record.losses++;
    if (isConf) {
      home.record.confWins++;
      away.record.confLosses++;
    }
  } else {
    away.record.wins++;
    home.record.losses++;
    if (isConf) {
      away.record.confWins++;
      home.record.confLosses++;
    }
  }
  accumTeamStats(home.stats, result.homeStats, result.homeScore, result.awayScore, result.awayStats);
  accumTeamStats(away.stats, result.awayStats, result.awayScore, result.homeScore, result.homeStats);
  if (result.homePlayerStats) applyPlayerGameStats(home.roster, result.homePlayerStats);
  if (result.awayPlayerStats) applyPlayerGameStats(away.roster, result.awayPlayerStats);
  // PASS 7 (Fix D): persist the sim's real snap counts (it always tracked
  // them for fatigue and threw them away at the whistle) + job-bucket snaps +
  // team side totals, then tick usage morale for both rosters. All off-field.
  if (!globalThis.__noSnapTrack) {
    applySnapCounts(home, result.homeSnapCounts, result.homeJobSnaps, result.homeTeamSnaps);
    applySnapCounts(away, result.awaySnapCounts, result.awayJobSnaps, result.awayTeamSnaps);
    tickMorale(home, result.homeScore > result.awayScore);
    tickMorale(away, result.awayScore > result.homeScore);
  }
}
function applySnapCounts(school, snapCounts, jobSnaps, teamSnaps) {
  for (const [id, n] of Object.entries(snapCounts || {})) {
    const p = school.roster.find((x) => x.id === id);
    if (!p || !n) continue;
    if (!p.stats) p.stats = {};
    if (!p.careerStats) p.careerStats = {};
    p.stats.snaps = (p.stats.snaps || 0) + n;
    p.careerStats.snaps = (p.careerStats.snaps || 0) + n;
    const jobs = (jobSnaps || {})[id];
    if (jobs) {
      const at = p.stats.snapsAt || (p.stats.snapsAt = {});
      for (const [k, jn] of Object.entries(jobs)) at[k] = (at[k] || 0) + jn;
    }
  }
  if (teamSnaps && school.stats) {
    school.stats.offSnaps = (school.stats.offSnaps || 0) + (teamSnaps.off || 0);
    school.stats.defSnaps = (school.stats.defSnaps || 0) + (teamSnaps.def || 0);
  }
}
// PASS 7 (Fix D): usage morale — persistent, visible, OFF-FIELD ONLY (the sim
// never reads it; it feeds the portal and the convert brain). Expectation from
// depth rank + class year; actual from real season snap share. `__noMorale`.
const OFF_POS_SET = new Set(["QB", "RB", "WR", "TE", "OL", "FB"]);
function tickMorale(school, won) {
  var _a, _b;
  if (globalThis.__noMorale) return;
  const P7 = C.PASS7;
  const roster = school.roster || [];
  const rank = /* @__PURE__ */ new Map();
  const rooms = {};
  for (const p of roster) (rooms[p.position] || (rooms[p.position] = [])).push(p);
  for (const list of Object.values(rooms)) {
    list.sort((a, b) => (b.compositeRating || 0) - (a.compositeRating || 0));
    list.forEach((p, i) => rank.set(p.id, i + 1));
  }
  for (const p of roster) {
    if (p.morale == null) p.morale = P7.moraleInit;
    if (p.position === "K" || p.position === "P") continue;
    if ((p.injuryGamesOut || 0) > 0) continue;
    const teamSnaps = ((_a = school.stats) == null ? void 0 : _a[OFF_POS_SET.has(p.position) ? "offSnaps" : "defSnaps"]) || 0;
    if (!teamSnaps) continue;
    const actual = (((_b = p.stats) == null ? void 0 : _b.snaps) || 0) / teamSnaps;
    const starters = STARTER_COUNTS[p.position] || 1;
    const r = rank.get(p.id) || 99;
    let expected = r <= starters ? 0.65 : r === starters + 1 ? 0.3 : 0.1;
    if (p.redshirted) expected = 0;
    else if (p.classYear === "FR") expected *= 0.6;
    else if (p.classYear === "JR" || p.classYear === "SR") expected = Math.min(0.75, expected + 0.06);
    const delta = Math.max(-P7.moraleLossCap, Math.min(P7.moraleGainCap, P7.moraleUsageK * (actual - expected))) + (won ? P7.moraleTeamW : -P7.moraleTeamW);
    let m = p.morale + delta;
    m += Math.sign(P7.moraleInit - m) * Math.min(P7.moraleDrift, Math.abs(P7.moraleInit - m));
    p.morale = Math.max(0, Math.min(100, m));
  }
}
// ── Identity stage 3: flaw coaching loop (§4c) ──────────────────────────────
// Runs on the in-season dev checkpoints and again at camp. Practice attention
// (the position's plan minutes) + staff quality shrink a flaw a level — and
// can erase it (the redemption arc). A neglected flaw slowly worsens instead.
const FLAW_NAMES = { grabby: "Grabby", jumpy: "Jumpy", gambler: "Gambler", headhunter: "Headhunter", freelancer: "Freelancer", drops: "Drops", fumbler: "Fumbler", happyFeet: "Happy Feet", slowStarter: "Slow Starter", telegraph: "Telegraph", heroBall: "Hero Ball", dancer: "Dancer", bodyCatcher: "Body Catcher", bitesHard: "Bites Hard", laneDrifter: "Lane Drifter", holdingHabit: "Holding Habit", shanks: "Shanks", muffs: "Muffs" };
function flawName(k) {
  return FLAW_NAMES[k] || k;
}
function coachFlawTick(player, plan, school, scale = 1) {
  var _a, _b;
  const flaws = (_a = player.traits) == null ? void 0 : _a.flaws;
  if (!flaws || !flaws.length) return;
  const minutes = plan && typeof plan === "object" ? Object.values(plan).reduce((s, v) => s + (Number(v) || 0), 0) : Number(plan) || 0;
  const attention = Math.min(1.4, minutes / 100);
  const _coord = ["QB", "RB", "WR", "TE", "OL"].includes(player.position) ? (_b = school.staff) == null ? void 0 : _b.oc : school.staff == null ? void 0 : school.staff.dc;
  const coordQ = _coord ? coordRatingAvg(_coord) : 50;
  const we = (player.attributes == null ? void 0 : player.attributes.WE) != null ? player.attributes.WE : 50;
  const shrinkP = Math.min(0.28, (0.03 + attention * 0.05 + (coordQ - 50) * 15e-4 + (we - 50) * 8e-4) * scale);
  const t = flaws[Math.floor(Math.random() * flaws.length)];
  if (Math.random() < shrinkP) {
    const out = shrinkFlaw(player, t.k);
    if (out === "gone") {
      const tl = player.traits;
      (tl._gone || (tl._gone = [])).push(flawName(t.k));
    }
  } else if (attention < 0.5 && Math.random() < 0.3) {
    // unaddressed: it festers (xp toward the next level)
    growFlaw(player, t.k, 2);
  }
}
function applyPlayerGameStats(roster, gameStats) {
  const KEYS = ["passAtt", "passComp", "passYds", "passTD", "passInt", "rushAtt", "rushYds", "rushTD", "recComp", "recYds", "recTD", "targets", "tackles", "solo", "assists", "tacklesForLoss", "sacks", "ints", "passBreakups", "forcedFumbles", "batted", "brokenTackles", "missedTackles", "pressures", "contestedTgt", "contestedRec", "penalties", "penaltyYds", "fgMade", "fgAtt", "xpMade", "xpAtt", "puntNo", "puntYds", "retNo", "retYds", "retTD"];
  for (const [id, gs] of Object.entries(gameStats)) {
    const player = roster.find((p) => p.id === id);
    if (!player) continue;
    if (!player.stats) player.stats = {};
    if (!player.careerStats) player.careerStats = {};
    if (!gs._counted) {
      player.stats.games = (player.stats.games || 0) + 1;
      player.careerStats.games = (player.careerStats.games || 0) + 1;
      gs._counted = true;
    }
    for (const key of KEYS) {
      if (gs[key]) {
        player.stats[key] = (player.stats[key] || 0) + gs[key];
        player.careerStats[key] = (player.careerStats[key] || 0) + gs[key];
      }
    }
    if (gs.fgLong) {
      player.stats.fgLong = Math.max(player.stats.fgLong || 0, gs.fgLong);
      player.careerStats.fgLong = Math.max(player.careerStats.fgLong || 0, gs.fgLong);
    }
    // Identity stage 3 (intensity growth §4c): traits grow by DOING — the
    // game's stat line credits each trait's own trigger counter (works for
    // cheap-simmed AI games too; the sim already logged the events). A
    // level-up marks t.pend, surfaced by the weekly report scan.
    growthFromGameStats(player, gs);
  }
}
function accumTeamStats(teamStats, gameStats, pf, pa, oppGameStats = null) {
  teamStats.games++;
  teamStats.pointsFor += pf;
  teamStats.pointsAgainst += pa;
  teamStats.rushYds += gameStats.rushYds || 0;
  teamStats.passYds += gameStats.passYds || 0;
  teamStats.totalYds += gameStats.totalYds || 0;
  teamStats.turnovers += (gameStats.ints || 0) + (gameStats.fumbles || 0);
  teamStats.sacksAllowed = (teamStats.sacksAllowed || 0) + (gameStats.sacksAllowed || 0);
  teamStats.sacks = (teamStats.sacks || 0) + ((oppGameStats == null ? void 0 : oppGameStats.sacksAllowed) || 0);
  teamStats.wins = teamStats.wins || 0;
  teamStats.losses = teamStats.losses || 0;
  if (pf > pa) teamStats.wins++;
  else teamStats.losses++;
}
function buildAllBrackets(state2, events) {
  const playerDiv = getPlayerDivision(state2);
  state2.allPlayoffs = {
    D1: buildPlayoffBracket(state2, "D1", events),
    D2: buildPlayoffBracket(state2, "D2", events),
    D3: buildPlayoffBracket(state2, "D3", events)
  };
  state2.playoffs = state2.allPlayoffs[playerDiv];
  pairD1Bowls(state2);
}
function buildPlayoffBracket(state2, division, events = null) {
  var _a;
  const bracket = { rounds: [], champion: null, seeds: [] };
  const divSchools = state2.world.schools.filter((s) => s.division === division);
  const _sos = computeSOS(state2.world.schools, state2.schedule || []);
  const sosOf = (s) => _sos.get(s.id) || 0;
  const h2h = (a, b) => {
    const g = (state2.schedule || []).find((x) => x.result && x.result.winner && [x.homeId, x.awayId].includes(a.id) && [x.homeId, x.awayId].includes(b.id));
    if (!g) return 0;
    return g.result.winner === a.id ? -1 : g.result.winner === b.id ? 1 : 0;
  };
  const confs = [...new Set(divSchools.map((s) => s.conf))];
  const confChamps = [];
  const champIds = /* @__PURE__ */ new Set();
  for (const conf of confs) {
    const top = divSchools.filter((s) => s.conf === conf).sort((a, b) => {
      const aG = Math.max(1, a.record.confWins + a.record.confLosses);
      const bG = Math.max(1, b.record.confWins + b.record.confLosses);
      const aPct = a.record.confWins / aG;
      const bPct = b.record.confWins / bG;
      return bPct - aPct || b.record.wins - a.record.wins || h2h(a, b) || avgTop22Composite(b.roster) - avgTop22Composite(a.roster);
    })[0];
    if (top) {
      confChamps.push(top);
      champIds.add(top.id);
    }
  }
  const FIELD = 16;
  const atLarge = divSchools.filter((s) => !champIds.has(s.id)).sort((a, b) => b.record.wins - a.record.wins || b.record.confWins - a.record.confWins || sosOf(b) - sosOf(a)).slice(0, Math.max(0, FIELD - confChamps.length));
  const field = [
    ...confChamps.sort((a, b) => b.record.wins - a.record.wins || b.record.confWins - a.record.confWins || sosOf(b) - sosOf(a)),
    ...atLarge
  ].slice(0, FIELD);
  bracket.seeds = field.map((s) => s.id);
  bracket.confChampIds = [...champIds];
  for (const cid of champIds) {
    const s = state2.world.schools.find((x) => x.id === cid);
    if (s) s.prestige = Math.min(s.prestige + C.PRESTIGE_W_CONF, (_a = s.prestigeMax) != null ? _a : 5);
  }
  for (const id of champIds) creditBudgetBonus(state2, id, C.BONUS_CONF_CHAMP, "Conference Champions", events);
  for (const s of field) creditBudgetBonus(state2, s.id, C.BONUS_PLAYOFF_BERTH, "Playoff berth", events);
  if (field.length < 2) return bracket;
  const n = field.length;
  const _seedSlots = (size) => {
    let a = [1];
    while (a.length < size) {
      const sum = a.length * 2 + 1, b = [];
      for (const s of a) b.push(s, sum - s);
      a = b;
    }
    return a;
  };
  const _bsize = 1 << Math.ceil(Math.log2(Math.max(2, n)));
  const ordered = _seedSlots(_bsize).filter((seed) => seed <= n).map((seed) => field[seed - 1]);
  const r1games = [];
  for (let i = 0; i + 1 < ordered.length; i += 2) {
    r1games.push({ homeId: ordered[i].id, awayId: ordered[i + 1].id, result: null });
  }
  const byeId = ordered.length % 2 === 1 ? ordered[ordered.length - 1].id : null;
  const days = [];
  for (let d = PHASES.PLAYOFFS.days[0]; d <= PHASES.PLAYOFFS.days[1]; d++) days.push(d);
  bracket.rounds.push({ day: days[0], games: r1games, complete: false, byeId });
  for (let r = 1; r < days.length; r++) {
    bracket.rounds.push({ day: days[r], games: [], complete: false, byeId: null });
  }
  return bracket;
}
function cheapPlayPlayoffRound(round, state2) {
  const results = [];
  for (const game of round.games) {
    const home = state2.world.schools.find((s) => s.id === game.homeId);
    const away = state2.world.schools.find((s) => s.id === game.awayId);
    if (!home || !away) continue;
    const result = cheapSimGame(home, away, state2.season);
    game.result = { homeScore: result.homeScore, awayScore: result.awayScore, winner: result.winner };
    results.push({ game, result });
  }
  return results;
}
function pairD1Bowls(state2) {
  var _a;
  if (!((_a = state2.allPlayoffs) == null ? void 0 : _a.D1)) return;
  const d1PlayoffIds = new Set(state2.allPlayoffs.D1.seeds || []);
  const eligible = state2.world.schools.filter((s) => s.division === "D1" && !d1PlayoffIds.has(s.id)).sort((a, b) => b.record.wins - a.record.wins || b.record.confWins - a.record.confWins || avgTop22Composite(b.roster) - avgTop22Composite(a.roster)).slice(0, C.BOWL_TOP_N);
  state2.bowls = [];
  for (let i = 0; i + 1 < eligible.length && state2.bowls.length < C.BOWL_COUNT; i += 2) {
    state2.bowls.push({ homeId: eligible[i].id, awayId: eligible[i + 1].id, isBowl: true, result: null });
  }
}
function runD1BowlsFrom(state2, startPairIdx = 0) {
  var _a, _b, _c, _d, _e;
  if (!((_a = state2.allPlayoffs) == null ? void 0 : _a.D1)) return { results: [], halftimeGame: null };
  if (!((_b = state2.bowls) == null ? void 0 : _b.length)) pairD1Bowls(state2);
  const playerSchoolId = state2.playerSchoolId;
  const playerDiv = getPlayerDivision(state2);
  const results = [];
  for (let pairIdx = 0; pairIdx < state2.bowls.length; pairIdx++) {
    if (pairIdx < startPairIdx) continue;
    const game = state2.bowls[pairIdx];
    if (game.result) continue;
    const home = state2.world.schools.find((s) => s.id === game.homeId);
    const away = state2.world.schools.find((s) => s.id === game.awayId);
    if (!home || !away) continue;
    const isPlayerGame = home.id === playerSchoolId || away.id === playerSchoolId;
    let result;
    if (isPlayerGame && playerDiv === "D1") {
      const r = runGameMaybeHalftime(home, away, state2);
      if (r.halftimeToken) {
        return {
          results,
          halftimeGame: { token: r.halftimeToken, game, home, away, context: { kind: "bowl", pairIdx } }
        };
      }
      result = r.result;
      if (((_c = state2.settings) == null ? void 0 : _c.injuries) !== false) for (const player of home.roster) checkGameInjury(player, state2.day, home);
      if (((_d = state2.settings) == null ? void 0 : _d.injuries) !== false) for (const player of away.roster) checkGameInjury(player, state2.day, away);
    } else {
      result = cheapSimGame(home, away);
    }
    if (isPlayerGame) resetWeeklyPlan(state2);
    const winner = state2.world.schools.find((s) => s.id === result.winner);
    if (winner) winner.prestige = Math.min(winner.prestige + C.PRESTIGE_W_BOWL, (_e = winner.prestigeMax) != null ? _e : 5);
    game.result = result;
    results.push({ game, result });
  }
  return { results, halftimeGame: null };
}
function creditBudgetBonus(state2, schoolId, amount, label, events) {
  const school = state2.world.schools.find((s) => s.id === schoolId);
  const coach = school == null ? void 0 : school.coach;
  if (!coach || !amount) return;
  coach.budget = (coach.budget || 0) + amount;
  if (schoolId === state2.playerSchoolId && events) {
    events.push({ type: "info", text: `\u{1F4B0} +$${amount.toLocaleString()} recruiting budget \u2014 ${label}.` });
  }
}
function populateNextPlayoffRound(bracket, completedRound, state2 = null, events = null) {
  var _a, _b, _c, _d;
  const idx = bracket.rounds.indexOf(completedRound);
  const gameWinners = completedRound.games.map((g) => {
    var _a2;
    return (_a2 = g.result) == null ? void 0 : _a2.winner;
  }).filter(Boolean);
  const winners = [...gameWinners];
  if (completedRound.byeId) winners.push(completedRound.byeId);
  const isFinal = idx < 0 || idx + 1 >= bracket.rounds.length || winners.length <= 1;
  if (state2) {
    if (isFinal) {
      const finalGame = completedRound.games[0];
      const champ = winners.length === 1 ? winners[0] : (_a = finalGame == null ? void 0 : finalGame.result) == null ? void 0 : _a.winner;
      const loser = finalGame ? finalGame.homeId === champ ? finalGame.awayId : finalGame.homeId : null;
      if (champ) creditBudgetBonus(state2, champ, C.BONUS_NC_WIN, "National Championship", events);
      if (loser) creditBudgetBonus(state2, loser, C.BONUS_NC_LOSS, "Championship game appearance", events);
    } else {
      for (const w of gameWinners) creditBudgetBonus(state2, w, C.BONUS_PLAYOFF_WIN, "Playoff win", events);
    }
  }
  if (isFinal) {
    if (winners.length === 1) bracket.champion = winners[0];
    else if ((_c = (_b = completedRound.games[0]) == null ? void 0 : _b.result) == null ? void 0 : _c.winner) bracket.champion = completedRound.games[0].result.winner;
    if (bracket.champion) {
      const champ = state2.world.schools.find((s) => s.id === bracket.champion);
      if (champ) champ.prestige = Math.min(champ.prestige + C.PRESTIGE_W_TITLE, (_d = champ.prestigeMax) != null ? _d : 5);
    }
    return;
  }
  const next = bracket.rounds[idx + 1];
  next.games = [];
  for (let i = 0; i + 1 < winners.length; i += 2) {
    next.games.push({ homeId: winners[i], awayId: winners[i + 1], result: null });
  }
  next.byeId = winners.length % 2 === 1 ? winners[winners.length - 1] : null;
}
function playPlayoffRoundFrom(round, state2, startIdx, div) {
  const results = [];
  for (let i = startIdx; i < round.games.length; i++) {
    const game = round.games[i];
    const home = state2.world.schools.find((s) => s.id === game.homeId);
    const away = state2.world.schools.find((s) => s.id === game.awayId);
    if (!home || !away) continue;
    const { halftimeToken, result } = runGameMaybeHalftime(home, away, state2);
    if (halftimeToken) {
      return {
        results,
        halftimeGame: { token: halftimeToken, game, home, away, context: { kind: "playoff", div, gameIdx: i } }
      };
    }
    if (game.homeId === state2.playerSchoolId || game.awayId === state2.playerSchoolId) resetWeeklyPlan(state2);
    game.result = result;
    results.push({ game, result });
  }
  return { results, halftimeGame: null };
}
function processPlayoffDay(state2, day, startDivIdx = 0, startGameIdx = 0) {
  const events = [];
  const playerDiv = getPlayerDivision(state2);
  for (let di = startDivIdx; di < PLAYOFF_DIVS.length; di++) {
    const div = PLAYOFF_DIVS[di];
    const bracket = state2.allPlayoffs[div];
    if (!bracket) continue;
    const round = bracket.rounds.find((r) => r.day === day && !r.complete);
    if (!round) continue;
    const fromIdx = di === startDivIdx ? startGameIdx : 0;
    if (div === playerDiv) {
      const { results, halftimeGame } = playPlayoffRoundFrom(round, state2, fromIdx, div);
      for (const r of results) events.push({ type: "game", result: r.result });
      if (halftimeGame) {
        return { events, halftimeGame: __spreadProps(__spreadValues({}, halftimeGame), { context: __spreadProps(__spreadValues({}, halftimeGame.context), { divIdx: di, day }) }) };
      }
      round.complete = true;
      populateNextPlayoffRound(bracket, round, state2, events);
      if (bracket.champion) {
        const champ = state2.world.schools.find((s) => s.id === bracket.champion);
        if (champ) events.push({ type: "info", text: `${champ.name} wins the ${div} Championship!` });
      }
    } else {
      const results = cheapPlayPlayoffRound(round, state2);
      round.complete = true;
      for (const r of results) events.push({ type: "game", result: r.result });
      populateNextPlayoffRound(bracket, round, state2, events);
      if (bracket.champion) {
        const champ = state2.world.schools.find((s) => s.id === bracket.champion);
        if (champ) events.push({ type: "info", text: `${champ.name} wins the ${div} Championship!` });
      }
    }
  }
  return { events, halftimeGame: null };
}
function clamp4(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function recordSigning(state2, recruit, schoolId, losers = [], source = "funnel") {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i;
  if (!state2.signingsLog) state2.signingsLog = [];
  const school = state2.world.schools.find((s) => s.id === schoolId);
  if (school) {
    const alreadyLogged = state2.signingsLog.filter(
      (e) => e.season === state2.season && e.schoolId === schoolId
    ).length;
    const slots = C.ROSTER_SIZE - school.roster.length + school.roster.filter((p) => p.classYear === "SR").length;
    if (alreadyLogged >= slots) return false;
  }
  const playerWasChasing = !!(((_a = state2.playerCoach) == null ? void 0 : _a.recruitBoard) || []).find((e) => e.recruitId === recruit.id);
  state2.signingsLog.push({
    season: state2.season,
    day: state2.day,
    recruitId: recruit.id,
    name: `${((_b = recruit.name) == null ? void 0 : _b.first) || ""} ${((_c = recruit.name) == null ? void 0 : _c.last) || ""}`.trim(),
    pos: recruit.position,
    schoolId,
    schoolName: (school == null ? void 0 : school.name) || (schoolId === state2.playerSchoolId ? "Your Program" : "Unknown"),
    star: recruit.visionRating,
    trueRating: recruit.compositeRating,
    toPlayer: schoolId === state2.playerSchoolId,
    lostByPlayer: playerWasChasing && schoolId !== state2.playerSchoolId,
    source
  });
  if (schoolId === state2.playerSchoolId && ((_e = (_d = state2.playerCoach) == null ? void 0 : _d.contract) == null ? void 0 : _e.recruitBonus)) {
    const bonus = state2.playerCoach.contract.recruitBonus;
    state2.playerCoach.budget = (state2.playerCoach.budget || 0) + bonus;
    (_i = (_f = state2.inbox) == null ? void 0 : _f.push) == null ? void 0 : _i.call(_f, {
      id: `bonus_${recruit.id}`,
      day: state2.day,
      subject: "AD Recruiting Bonus",
      body: `+$${bonus.toLocaleString()} for signing ${((_g = recruit.name) == null ? void 0 : _g.first) || ""} ${((_h = recruit.name) == null ? void 0 : _h.last) || ""} (${recruit.position}). Contract terms honored.`,
      read: false
    });
  }
  if (state2.signingsLog.length > 18e3) state2.signingsLog = state2.signingsLog.slice(-18e3);
  if (schoolId === state2.playerSchoolId && source === "funnel") {
    awardSigningXP(state2, recruit, losers);
  }
  return true;
}
function awardSigningXP(state2, recruit, losers) {
  var _a, _b, _c, _d;
  const coach = state2.playerCoach;
  if (!coach) return;
  const school = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  const dist = recruitDistance(recruit, state2.world.schools.find((s) => s.id === state2.playerSchoolId));
  const vision = (_a = recruit.visionRating) != null ? _a : 50;
  const truth = (_b = recruit.compositeRating) != null ? _b : vision;
  const isGem = truth - vision >= C.GEM_GAP;
  // recruiter is now the player's DNA axis (accumulated into one write); roots
  // stays a skill. Same XP amounts — they simply grade up slower on the DNA curve.
  let recXp = C.XP_SIGN_BASE;
  if (recruit._contestedAtCommit) recXp += C.XP_CONTESTED;
  if (recruit._trailedAtTop3) recXp += C.XP_FLIP;
  if (isGem) recXp += C.XP_GEM_SIGN;
  const tierRank = vision >= C.FUNNEL_TIER_HIGH ? 2 : vision >= C.FUNNEL_TIER_MID ? 1 : 0;
  const prestige = (_c = school == null ? void 0 : school.prestige) != null ? _c : 3;
  if (tierRank >= 1 && prestige <= C.PUNCH_UP_PRESTIGE_MAX) {
    recXp += C.XP_PUNCH_UP;
  }
  if (distanceTier(dist) === "far") recXp += C.XP_LONG_RANGE;
  addSkillXP(coach, "recruiter", recXp);
  if (dist <= C.ROOTS_RADIUS_MI) {
    addSkillXP(coach, "roots", C.XP_ROOTS_SIGN);
    if (isGem) addSkillXP(coach, "roots", C.XP_ROOTS_GEM);
    const entry = (coach.recruitBoard || []).find((e) => e.recruitId === recruit.id);
    const spentOnRecruit = (_d = entry == null ? void 0 : entry.spent) != null ? _d : 0;
    if (spentOnRecruit <= C.ROOTS_CHEAP_THRESHOLD) addSkillXP(coach, "roots", C.XP_ROOTS_CHEAP);
  }
}
function addFreshmenToRosters(state2) {
  var _a;
  const signed = state2.world.recruits.filter((r) => r.committed && r.decisionStatus === "signed");
  for (const recruit of signed) {
    const school = state2.world.schools.find((s) => s.id === recruit.committed);
    if (!school) continue;
    if (school.roster.length >= C.ROSTER_SIZE && school.id !== state2.playerSchoolId) continue;
    const newPlayer = convertRecruitToPlayer(recruit);
    school.roster.push(newPlayer);
    school.depthChart = buildDepthChart(school.roster, school.gameplan, school.depthOrder || {});
  }
  if ((_a = state2.pendingWalkOns) == null ? void 0 : _a.length) {
    const pSchool = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
    let joined = 0;
    if (pSchool) {
      for (const wo of state2.pendingWalkOns) {
        pSchool.roster.push(convertWalkOnToPlayer(wo, pSchool.id));
        joined++;
      }
      if (joined) {
        pSchool.depthChart = buildDepthChart(pSchool.roster, pSchool.gameplan, pSchool.depthOrder || {});
      }
    }
    state2.pendingWalkOns = null;
  }
  for (const school of state2.world.schools) {
    fillWithWalkOns(state2, school);
  }
}
function fillWithWalkOns(state2, school) {
  var _a, _b;
  let deficit = C.ROSTER_SIZE - school.roster.length;
  if (deficit <= 0) return;
  const center = state2.world.center || { lat: 40, lng: -82 };
  const lat = (_a = school.lat) != null ? _a : center.lat;
  const lng = (_b = school.lng) != null ? _b : center.lng;
  let added = 0;
  while (deficit > 0) {
    const pos = neediestPosition(school);
    const wo = createWalkOn(pos, lat, lng);
    school.roster.push(convertWalkOnToPlayer(wo, school.id));
    deficit--;
    added++;
    if (added > 60) break;
  }
  school.depthChart = buildDepthChart(school.roster, school.gameplan, school.depthOrder || {});
}
function neediestPosition(school) {
  let worstPos = "OL", worstGap = -Infinity;
  for (const [pos, target] of Object.entries(schemeRosterTargets(school))) {
    const have = school.roster.filter((p) => p.position === pos).length;
    const gap = target - have;
    if (gap > worstGap) {
      worstGap = gap;
      worstPos = pos;
    }
  }
  return worstPos;
}
function convertWalkOnToPlayer(recruit, schoolId) {
  const player = __spreadProps(__spreadValues({}, recruit), {
    classYear: "FR",
    redshirted: false,
    redshirtYear: null,
    fatigue: 0,
    injuryGamesOut: 0,
    promises: { frStart: false, soStart: false, pctPlays: null },
    schoolId,
    isWalkOn: true,
    stats: __spreadValues({}, emptyStats()),
    careerStats: __spreadValues({}, emptyStats())
  });
  refreshRatings(player);
  return player;
}
function convertRecruitToPlayer(recruit) {
  const player = __spreadProps(__spreadValues({}, recruit), {
    classYear: "FR",
    redshirted: false,
    redshirtYear: null,
    potentialRevealed: true,
    fatigue: 0,
    injuryGamesOut: 0,
    promises: { frStart: false, soStart: false, pctPlays: null },
    schoolId: recruit.committed,
    stats: __spreadValues({}, emptyStats()),
    careerStats: __spreadValues({}, emptyStats())
  });
  refreshRatings(player);
  player.arrivalComposite = player.compositeRating;
  return player;
}
function finalizeSeasonRecords(state2) {
  var _a, _b, _c, _d, _e, _f;
  for (const school of state2.world.schools) {
    school.recentWins.unshift(school.record.wins);
    if (school.recentWins.length > 3) school.recentWins.pop();
  }
  for (const school of state2.world.schools) {
    const coach = school.coach;
    if (!coach) continue;
    coach.careerWins = (coach.careerWins || 0) + (school.record.wins || 0);
    coach.careerLosses = (coach.careerLosses || 0) + (school.record.losses || 0);
  }
  const _mine = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  if (_mine && state2.coachHistory) {
    state2.coachHistory.push({
      type: "season",
      season: state2.season,
      wins: ((_a = _mine.record) == null ? void 0 : _a.wins) || 0,
      losses: ((_b = _mine.record) == null ? void 0 : _b.losses) || 0,
      schoolId: _mine.id,
      schoolName: _mine.name
    });
  }
  if (_mine) snapshotProgramRecords(state2, _mine);
  if (_mine && state2._coachId) {
    try {
      const wins = ((_c = _mine.record) == null ? void 0 : _c.wins) || 0, losses = ((_d = _mine.record) == null ? void 0 : _d.losses) || 0;
      const badges = [];
      const xp = {};
      const badge = (id, label, axis, big) => {
        badges.push({ id, label, season: state2.season, day: state2.day });
        if (axis) xp[axis] = (xp[axis] || 0) + big;
      };
      if (losses === 0 && wins >= 8) badge("perfect", `Undefeated season (${wins}-0)`, "discipline", 20);
      else if (wins >= 10) badge("win10", `${wins}-win season`, "discipline", 8);
      const bracket = ((_e = state2.allPlayoffs) == null ? void 0 : _e[_mine.division]) || state2.playoffs;
      const ccIds = bracket == null ? void 0 : bracket.confChampIds;
      if (Array.isArray(ccIds) ? ccIds.includes(_mine.id) : (_f = ccIds == null ? void 0 : ccIds.has) == null ? void 0 : _f.call(ccIds, _mine.id)) badge("confChamp", "Conference champion", "roadWarrior", 10);
      if ((bracket == null ? void 0 : bracket.champion) === _mine.id) badge("natty", "National champion", "riverboat", 25);
      if (badges.length) addDnaXP(state2._coachId, xp, badges);
      if (state2.playerCoach) {
        const isConfChampRoots = Array.isArray(ccIds) ? ccIds.includes(_mine.id) : !!(ccIds && ccIds.has && ccIds.has(_mine.id));
        const isNatty = (bracket == null ? void 0 : bracket.champion) === _mine.id;
        const madePlayoff = !!((bracket == null ? void 0 : bracket.seeds) && bracket.seeds.includes(_mine.id));
        let rootsDelta = wins * C.ROOTS_XP_PER_WIN - losses * C.ROOTS_XP_PER_LOSS;
        if (isNatty) rootsDelta += C.ROOTS_XP_NATTY;
        else if (isConfChampRoots) rootsDelta += C.ROOTS_XP_CONF_CHAMP;
        else if (madePlayoff) rootsDelta += C.ROOTS_XP_PLAYOFF;
        if (rootsDelta !== 0) addSkillXP(state2.playerCoach, "roots", rootsDelta);
      }
      _mine._dnaGrades = dnaGrades(state2._coachId);
      try {
        const ctx2 = { world: state2._worldSlot, school: _mine.name, season: state2.season };
        const payload = { season: {}, seasonIndiv: {}, seasonTeam: {}, careerAdd: {} };
        const isConfChamp = Array.isArray(ccIds) ? ccIds.includes(_mine.id) : !!(ccIds && ccIds.has && ccIds.has(_mine.id));
        const inPlayoff = !!(bracket && (bracket.confChampIds && (Array.isArray(bracket.confChampIds) ? bracket.confChampIds.includes(_mine.id) : bracket.confChampIds.has && bracket.confChampIds.has(_mine.id)) || bracket.champion === _mine.id));
        if (isConfChamp) payload.careerAdd.confTitles = 1;
        if (inPlayoff) payload.careerAdd.playoffApps = 1;
        const winPct = wins + losses > 0 ? wins / (wins + losses) : 0;
        let curStreak = 0, maxStreak = 0;
        for (const gm of state2.schedule || []) {
          if (!gm.result || gm.homeId !== _mine.id && gm.awayId !== _mine.id) continue;
          if (gm.result.winner === _mine.id) {
            curStreak++;
            if (curStreak > maxStreak) maxStreak = curStreak;
          } else curStreak = 0;
        }
        if (maxStreak > 0) payload.season.longestStreak = { v: maxStreak, ctx: ctx2 };
        const prevBest = coachRecords(state2._coachId).season;
        const prevPct = prevBest && prevBest.bestRecord ? prevBest.bestRecord.pct || 0 : -1;
        if (winPct > prevPct) payload.season.bestRecord = { v: `${wins}\u2013${losses}`, pct: winPct, ctx: ctx2 };
        const _rm = rankMap(state2, _mine.division);
        const rk = _rm == null ? void 0 : _rm.get(_mine.id);
        if (rk) {
          const prevRank = prevBest && prevBest.bestRank ? prevBest.bestRank.v : Infinity;
          if (rk < prevRank) payload.season.bestRank = { v: rk, ctx: ctx2 };
        }
        const ts = _mine.stats || {};
        if (ts.pointsFor > 0) payload.seasonTeam.pointsFor = { v: Math.round(ts.pointsFor), ctx: ctx2 };
        if (ts.totalYds > 0) payload.seasonTeam.totalYds = { v: Math.round(ts.totalYds), ctx: ctx2 };
        const nm = (p) => {
          var _a2, _b2;
          return `${((_a2 = p.name) == null ? void 0 : _a2.first) || ""} ${((_b2 = p.name) == null ? void 0 : _b2.last) || ""}`.trim();
        };
        const best = { passYds: null, rushYds: null, recYds: null, sacks: null, ints: null };
        for (const p of _mine.roster || []) {
          const s = p.stats || {};
          for (const key of ["passYds", "rushYds", "recYds", "sacks", "ints"]) {
            const v = s[key] || 0;
            if (v > 0 && (!best[key] || v > best[key].v)) best[key] = { v: Math.round(v), name: nm(p), pos: p.position, ctx: ctx2 };
          }
        }
        for (const key of Object.keys(best)) if (best[key]) payload.seasonIndiv[key] = best[key];
        noteCoachRecords(state2._coachId, payload);
      } catch (e) {
      }
    } catch (e) {
    }
  }
}
function snapshotProgramRecords(state2, school) {
  var _a;
  if (!state2.history) state2.history = {};
  if (!state2.history.programRecords) state2.history.programRecords = { season: {}, career: {} };
  const H = state2.history.programRecords;
  const nm = (p) => {
    var _a2, _b;
    return `${((_a2 = p.name) == null ? void 0 : _a2.first) || ""} ${((_b = p.name) == null ? void 0 : _b.last) || ""}`.trim();
  };
  for (const cat of RECORD_CATS) {
    const sList = H.season[cat] || (H.season[cat] = []);
    for (const p of school.roster) {
      const v = ((_a = p.stats) == null ? void 0 : _a[cat]) || 0;
      if (v > 0) sList.push({ name: nm(p), pos: p.position, value: v, season: state2.season });
    }
    sList.sort((a, b) => b.value - a.value);
    H.season[cat] = sList.slice(0, 10);
  }
}
function attachSeasonRecap(state2) {
  var _a, _b, _c, _d, _e;
  const school = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  const row = (state2.coachHistory || []).filter((h) => h.type === "season" && h.season === state2.season).pop();
  if (!school || !row) return;
  const rec = school.record || { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
  const parts = [];
  const prev = (state2.coachHistory || []).filter((h) => h.type === "season" && h.season === state2.season - 1 && h.schoolId === school.id).pop();
  let open = `${school.name} finished ${rec.wins}\u2013${rec.losses}`;
  if (rec.confWins + rec.confLosses > 0) open += ` (${rec.confWins}\u2013${rec.confLosses} in conference)`;
  if (prev) {
    const d = rec.wins - prev.wins;
    open += d >= 3 ? ` \u2014 a ${d}-win leap from last year.` : d >= 1 ? ` \u2014 ${d} win${d > 1 ? "s" : ""} better than last season.` : d <= -3 ? ` \u2014 a hard fall from last year's ${prev.wins} wins.` : d < 0 ? ` \u2014 a step back from ${prev.wins} wins a year ago.` : `, matching last season's mark.`;
  } else open += ` in year one of the ${((_b = (_a = state2.playerCoach) == null ? void 0 : _a.name) == null ? void 0 : _b.last) || ""} era.`.replace(" of the  era", " of a new era");
  parts.push(open);
  const myGames = (state2.schedule || []).filter((g) => g.result && (g.homeId === school.id || g.awayId === school.id));
  let best = null;
  for (const g of myGames) {
    if (g.result.winner !== school.id) continue;
    const oppId = g.homeId === school.id ? g.awayId : g.homeId;
    const opp = state2.world.schools.find((s) => s.id === oppId);
    if (!opp) continue;
    if (!best || (((_c = opp.record) == null ? void 0 : _c.wins) || 0) > (((_d = best.opp.record) == null ? void 0 : _d.wins) || 0)) {
      const myScore = g.homeId === school.id ? g.result.homeScore : g.result.awayScore;
      const oppScore = g.homeId === school.id ? g.result.awayScore : g.result.homeScore;
      best = { opp, myScore, oppScore };
    }
  }
  if (best && (((_e = best.opp.record) == null ? void 0 : _e.wins) || 0) >= Math.max(4, rec.wins - 2)) {
    parts.push(`The signature win: ${best.myScore}\u2013${best.oppScore} over ${best.opp.record.wins}-win ${best.opp.name}.`);
  }
  const mine = (state2.awardsLog || []).filter((a) => a.season === state2.season && a.schoolId === school.id && a.scope !== "weekly");
  const mvp = mine.find((a) => a.category === "MVP");
  const coy = mine.find((a) => a.category === "DivCOY" || a.category === "COY");
  if (mvp == null ? void 0 : mvp.playerName) parts.push(`${mvp.playerName} took home ${mvp.category === "MVP" ? "the MVP" : mvp.category}.`);
  if (coy) parts.push(`The coaching staff earned ${coy.category === "DivCOY" ? "Division" : "Conference"} Coach of the Year.`);
  const firsts = (state2.coachHistory || []).filter((h) => h.type === "program" && h.season === state2.season);
  for (const f of firsts.slice(0, 2)) parts.push(`The program hung a banner: ${f.label}.`);
  const classSize = (state2.signingsLog || []).filter((s) => s.season === state2.season && s.schoolId === school.id).length;
  if (classSize > 0) parts.push(`${classSize} recruit${classSize > 1 ? "s" : ""} signed on for what comes next.`);
  row.recap = parts.join(" ");
}
function recordCareerBoards(state2, graduated) {
  var _a;
  if (!state2.history) state2.history = {};
  if (!state2.history.programRecords) state2.history.programRecords = { season: {}, career: {} };
  const H = state2.history.programRecords;
  const nm = (p) => {
    var _a2, _b;
    return `${((_a2 = p.name) == null ? void 0 : _a2.first) || ""} ${((_b = p.name) == null ? void 0 : _b.last) || ""}`.trim();
  };
  for (const cat of RECORD_CATS) {
    const cList = H.career[cat] || (H.career[cat] = []);
    for (const p of graduated) {
      const v = ((_a = p.careerStats) == null ? void 0 : _a[cat]) || 0;
      if (v > 0) cList.push({ name: nm(p), pos: p.position, value: v, lastSeason: state2.season });
    }
    cList.sort((a, b) => b.value - a.value);
    H.career[cat] = cList.slice(0, 10);
  }
}
function archiveSeasonIntoSchools(state2) {
  var _a, _b, _c;
  const rankByDiv = {};
  for (const d of ["D1", "D2", "D3"]) {
    try {
      const poll = computeDivisionPoll(state2.world.schools, state2.schedule || [], d);
      rankByDiv[d] = new Map(poll.map((e) => [e.school.id, e.rank]));
    } catch (e) {
      rankByDiv[d] = /* @__PURE__ */ new Map();
    }
  }
  const bowlById = /* @__PURE__ */ new Map();
  for (const b of state2.bowls || []) {
    if (!b.result) continue;
    bowlById.set(b.homeId, b);
    bowlById.set(b.awayId, b);
  }
  for (const school of state2.world.schools) {
    const rec = school.record || {};
    const bracket = (_a = state2.allPlayoffs) == null ? void 0 : _a[school.division];
    let post = null;
    if (bracket) {
      if (bracket.champion === school.id) post = "National Champion";
      else {
        let lastIdx = -1;
        (bracket.rounds || []).forEach((r, i) => {
          if (r.byeId === school.id || (r.games || []).some((g) => g.homeId === school.id || g.awayId === school.id)) lastIdx = i;
        });
        if (lastIdx >= 0) {
          const fromEnd = bracket.rounds.length - 1 - lastIdx;
          post = fromEnd === 0 ? "Playoff Final" : fromEnd === 1 ? "Playoff Semifinal" : fromEnd === 2 ? "Playoff Quarterfinal" : `Playoff Round ${lastIdx + 1}`;
        }
      }
    }
    if (!post) {
      const b = bowlById.get(school.id);
      if (b) post = b.result.winner === school.id ? "Bowl win" : "Bowl loss";
    }
    const rank = (_c = (_b = rankByDiv[school.division]) == null ? void 0 : _b.get(school.id)) != null ? _c : null;
    const _hc = school.coach;
    const _hcName = _hc && _hc.name ? `${_hc.name.first || ""} ${_hc.name.last || "Coach"}`.trim() : _hc ? "Coach" : null;
    const _hcYou = _hc && (_hc === state2.playerCoach || school.id === state2.playerSchoolId && !_hc.isAI);
    (school.seasonHistory = school.seasonHistory || []).push({
      season: state2.season,
      w: rec.wins || 0,
      l: rec.losses || 0,
      cw: rec.confWins || 0,
      cl: rec.confLosses || 0,
      conf: school.conf,
      division: school.division,
      prestige: school.prestige,
      rank: rank != null && rank <= 25 ? rank : null,
      confChamp: ((bracket == null ? void 0 : bracket.confChampIds) || []).includes(school.id),
      post,
      coach: _hcName,
      coachYou: !!_hcYou
    });
    if (school.seasonHistory.length > 60) school.seasonHistory.shift();
  }
}
function endOfSeasonProcessing(state2, events) {
  archiveSeasonIntoSchools(state2);
  // [DNA TREE §5b.3] THE LEDGER WRITER. Grade every coordinator's unit against
  // his division's season (points scored for the OC, points allowed for the
  // DC) on the 13-letter scale coordStreak/coordinatorCredentials read, and
  // append the row BEFORE stats reset below. C average, ±2.4 letters per σ.
  const _letterOrder = ["F", "D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+"];
  const _divAgg = {};
  for (const school of state2.world.schools) {
    const st = school.stats || {};
    const g = st.games || 0;
    if (!g) continue;
    const d = _divAgg[school.division] = _divAgg[school.division] || { pf: [], pa: [] };
    d.pf.push((st.pointsFor || 0) / g);
    d.pa.push((st.pointsAgainst || 0) / g);
  }
  const _meanSd = (arr) => {
    if (!arr.length) return { mean: 0, sd: 1 };
    const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
    const sd = Math.sqrt(arr.reduce((s, v) => s + (v - mean) * (v - mean), 0) / arr.length) || 1;
    return { mean, sd };
  };
  const _divStats = {};
  for (const [d, agg] of Object.entries(_divAgg)) _divStats[d] = { pf: _meanSd(agg.pf), pa: _meanSd(agg.pa) };
  const _unitLetter = (val, mean, sd, invert) => {
    const z = ((val - mean) / sd) * (invert ? -1 : 1);
    return _letterOrder[Math.max(0, Math.min(12, Math.round(6 + z * 2.4)))];
  };
  for (const school of state2.world.schools) {
    const isPlayerSchool = school.id === state2.playerSchoolId;
    const coach = school.coach;
    const _st = school.stats || {};
    const _g = _st.games || 0;
    const _ds = _divStats[school.division];
    if (_g && _ds && school.staff) {
      if (school.staff.oc) writeStaffLedger(school.staff.oc, state2.season, { OFF: _unitLetter((_st.pointsFor || 0) / _g, _ds.pf.mean, _ds.pf.sd, false) });
      if (school.staff.dc) writeStaffLedger(school.staff.dc, state2.season, { DEF: _unitLetter((_st.pointsAgainst || 0) / _g, _ds.pa.mean, _ds.pa.sd, true) });
    }
    // [DNA TREE §5b.3] Lineage: a season served under the player's whistle
    // stamps the mentor line — who shaped his sheet. Cosmetic for AI (skipped).
    if (isPlayerSchool && school.staff && coach) {
      for (const _side of ["oc", "dc"]) {
        const _co = school.staff[_side];
        if (_co && !_co.mentorId) {
          _co.mentorId = state2._coachId || coach.id || "player";
          _co.mentorName = `${(coach.name && coach.name.first) || "Coach"} ${(coach.name && coach.name.last) || ""}`.trim();
        }
      }
    }
    growStaffSchemeIQ(school);
    // [DNA TREE §5b.2] The player HC's own sheet grows off the same season of
    // real calls (and rusts the ones he shelved). AI coaches carry no sheet.
    if (isPlayerSchool && coach) growHCMastery(coach, school.gameplan);
    const graduated = runGraduation(school, state2.season);
    if (isPlayerSchool && graduated.length) recordCareerBoards(state2, graduated);
    let devResult = { raisers: 0, finishers: 0 };
    if (isPlayerSchool) {
      devResult = awardDevelopmentXP(school, coach, /* @__PURE__ */ new Map(), graduated, state2._coachId);
    }
    school.depthChart = buildDepthChart(school.roster, school.gameplan, school.depthOrder || {});
    school.record = { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
    school.stats = { games: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, rushYds: 0, passYds: 0, totalYds: 0, turnovers: 0, sacks: 0, sacksAllowed: 0 };
    if (isPlayerSchool && (devResult.raisers || devResult.finishers)) {
      recordMilestoneEvents(state2, events, [], devResult);
    }
  }
  // [W9 §12 T4] Every live tree coach just worked a year in his division, and
  // the TREE is what remembers it. Runs at the end of the wrap-up so the memory
  // a protégé inherits includes the season he was hired out of. Inert (returns
  // null) on every non-tree save.
  try {
    const tick = treeSeasonTick(state2);
    if (tick && tick.worked.length > 1) {
      events.push({ type: "info", text: `Your tree worked ${tick.worked.join(", ")} this year — the next man up will know those leagues.` });
    }
  } catch (e) {
    console.warn("W9 tree tick:", e.message);
  }
  state2.offseason = null;
  state2.postseasonMode = null;
  events.push({ type: "info", text: "Season complete. New recruits incoming." });
}
function recordMilestoneEvents(state2, events, milestoneHits, devResult) {
  if (!state2.coachHistory) state2.coachHistory = [];
  for (const hit of milestoneHits) {
    state2.coachHistory.push({ season: state2.season, type: "milestone", playerId: hit.playerId, name: hit.name, label: hit.label });
    events.push({ type: "info", text: `${hit.name} reached ${hit.label}.` });
  }
  if (devResult.raisers || devResult.finishers) {
    state2.coachHistory.push({ season: state2.season, type: "development", raisers: devResult.raisers, finishers: devResult.finishers });
    events.push({ type: "info", text: `Player development: ${devResult.raisers} breakout riser${devResult.raisers !== 1 ? "s" : ""}, ${devResult.finishers} strong finisher${devResult.finishers !== 1 ? "s" : ""}.` });
  }
}
function updatePrestige(state2) {
  var _a, _b, _c;
  const gamesPerSeason = C.CONF_GAMES + C.NONCONF_GAMES;
  const W = C.PRESTIGE_WINDOW_WEIGHTS;
  for (const school of state2.world.schools) {
    const rw = school.recentWins || [];
    let wSum = 0, wgt = 0;
    for (let i = 0; i < W.length; i++) {
      // [PLAYTEST 2026-08-12 item 18] Only seasons that HAPPENED count. A missing
      // season used to be filled in as an even .500, so a program's first real
      // year was diluted by two phantom mediocre ones — half of why a debut
      // 11-1 moved the needle by nothing. Renormalising over the seasons that
      // exist means year one is judged on year one.
      if (rw[i] == null) continue;
      wgt += W[i];
      wSum += W[i] * (rw[i] / gamesPerSeason);
    }
    const windowPct = wgt > 0 ? wSum / wgt : 0.5;
    // Linear core, with a super-linear tail at each end: winning big is worth
    // more than winning, and a collapse costs more than a losing season.
    const surge = Math.max(0, windowPct - C.PRESTIGE_SURGE_AT);
    const slump = Math.max(0, C.PRESTIGE_SLUMP_AT - windowPct);
    const form = C.PRESTIGE_W_WIN * (windowPct - 0.5) + C.PRESTIGE_W_SURGE * surge - C.PRESTIGE_W_SLUMP * slump;
    const delta = form - C.PRESTIGE_W_DECAY * (school.prestige - school.baseline);
    const lo = (_a = school.prestigeMin) != null ? _a : 1;
    const hi = (_c = school.prestigeMax) != null ? _c : ((_b = C.PRESTIGE_MAX) == null ? void 0 : _b[school.division]) || 5;
    school.prestige = clamp4(school.prestige + delta, lo, hi);
    school.baseline = clamp4(
      school.baseline + C.PRESTIGE_BASELINE_CREEP * (school.prestige - school.baseline),
      lo,
      hi
    );
  }
}
function gradeFromScore(score) {
  const idx = Math.max(0, Math.min(GRADE_LETTERS.length - 1, Math.round(score * (GRADE_LETTERS.length - 1))));
  return GRADE_LETTERS[idx];
}
function computeCoachGrade(state2, school, coach) {
  var _a;
  const totalGames = C.CONF_GAMES + C.NONCONF_GAMES;
  const wins = school.recentWins && school.recentWins[0] || 0;
  const losses = Math.max(0, totalGames - wins);
  const expWins = expectedWins(school.prestige, totalGames, coach);
  const bracket = ((_a = state2.allPlayoffs) == null ? void 0 : _a[school.division]) || state2.playoffs;
  const ccIds = bracket == null ? void 0 : bracket.confChampIds;
  const isConfChamp = Array.isArray(ccIds) ? ccIds.includes(school.id) : !!(ccIds && ccIds.has && ccIds.has(school.id));
  const isNatty = (bracket == null ? void 0 : bracket.champion) === school.id;
  const madePlayoff = !!((bracket == null ? void 0 : bracket.seeds) && bracket.seeds.includes(school.id));
  const undefeated = losses === 0 && wins >= totalGames - 1;
  const perWin = 1 / Math.max(6, totalGames);
  let score = 0.62 + (wins - expWins) * perWin;
  if (madePlayoff) score += 0.06;
  if (isConfChamp) score = Math.max(score + 0.08, 0.82);
  if (undefeated) score = Math.max(score, 0.9);
  if (isNatty) score = Math.max(score, 0.97);
  score = Math.max(0, Math.min(1, score));
  return {
    score,
    letter: gradeFromScore(score),
    wins,
    losses,
    expWins,
    isConfChamp,
    isNatty,
    madePlayoff,
    undefeated,
    season: state2.season
  };
}
function updateReputation(state2) {
  var _a, _b, _c, _d, _e;
  const coach = state2.playerCoach;
  if (!coach) return;
  const school = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  if (!school) return;
  const grade = computeCoachGrade(state2, school, coach);
  coach.lastGrade = grade;
  if (!coach.gradeHistory) coach.gradeHistory = [];
  coach.gradeHistory.push({ season: grade.season, letter: grade.letter, score: Math.round(grade.score * 100) / 100 });
  if (coach.gradeHistory.length > 40) coach.gradeHistory.shift();
  const repGain = Math.round((grade.score - 0.5) * C.REP_GRADE_SCALE) + (grade.isNatty ? C.REP_GRADE_NATTY : grade.isConfChamp ? C.REP_GRADE_CONF : 0);
  if (repGain !== 0) addSkillXP(coach, "reputation", repGain);
  const cur = (_c = (_b = (_a = coach.skills) == null ? void 0 : _a.reputation) == null ? void 0 : _b.xp) != null ? _c : 0;
  if (cur > C.REP_DECAY_FLOOR) {
    const decayed = Math.max(C.REP_DECAY_FLOOR, Math.round(cur * (1 - C.REP_ANNUAL_DECAY)));
    coach.skills.reputation.xp = decayed;
  }
  coach.reputation = gradeFromXP(((_e = (_d = coach.skills) == null ? void 0 : _d.reputation) == null ? void 0 : _e.xp) || 0);
}
function updateJobSecurity(state2, events) {
  var _a, _b;
  const coach = state2.playerCoach;
  if (!coach || coach.status === "unemployed") return;
  const school = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  if (!school) return;
  const games = C.CONF_GAMES + C.NONCONF_GAMES;
  const actual = ((_a = school.recentWins) == null ? void 0 : _a[0]) || 0;
  const exp = expectedWins(school.prestige, games, coach);
  const delta = actual - exp;
  const dominated = delta >= C.DOMINANCE_DELTA;
  coach.dominanceStreak = dominated ? (coach.dominanceStreak || 0) + 1 : 0;
  coach.tenureSeasons = (coach.tenureSeasons || 0) + 1;
  // The player's run clock (DNA TREE §8). Ticks with the same wrap-up that
  // ticks tenure. Old saves (no age) roll one lazily, credited with tenure so
  // a veteran isn't suddenly 35. Nothing FORCES a player retirement in this
  // pass — the ceremony (build order pass 5) owns that.
  if (coach.age == null) coach.age = Math.min(C.COACH_AGE.RETIRE_FORCE - 1, randInt3(C.COACH_AGE.PLAYER_START_MIN, C.COACH_AGE.PLAYER_START_MAX) + (coach.tenureSeasons || 0));
  else coach.age = coach.age + 1;
  const leashed = onStartLeash(coach, state2.season);
  const rawMove = C.JOBSEC_PER_DELTA * delta;
  const move = leashed && rawMove < 0 ? rawMove * C.ASHES_LEASH_BLEED : rawMove;
  coach.jobSecurity = Math.max(0, Math.min(
    100,
    ((_b = coach.jobSecurity) != null ? _b : C.JOBSEC_START) + move + C.JOBSEC_PRESTIGE_STABILITY * ((school.prestige || 3) - 3)
  ));
  const inGrace = coach.tenureSeasons <= C.JOBSEC_GRACE_SEASONS || leashed;
  const streakFire = coach.lastDelta != null && delta <= C.JOBSEC_FIRE_STREAK_DELTA && coach.lastDelta <= C.JOBSEC_FIRE_STREAK_DELTA;
  const fireConditionsMet = !inGrace && (coach.jobSecurity <= C.JOBSEC_FIRE_FLOOR || streakFire);
  const seat = seatState(coach.jobSecurity);
  if (fireConditionsMet && coach._onNotice) {
    coach._pendingFire = true;
  } else if (fireConditionsMet || !inGrace && seat === "hot") {
    coach._pendingFire = false;
    coach._onNotice = true;
    events.push({ type: "warning", text: `AD: You're on the hot seat. Win now or a change will be made.` });
  } else {
    coach._pendingFire = false;
    coach._onNotice = false;
    if (seat === "warm") events.push({ type: "info", text: `AD: Program needs to show improvement next season.` });
  }
  coach.lastDelta = delta;
}
function updateAICarousel(state2, events, openings) {
  var _a, _b, _c, _d, _e, _f, _g;
  const games = C.CONF_GAMES + C.NONCONF_GAMES;
  const schools = state2.world.schools;
  const divisions = [...new Set(schools.map((s) => s.division))];
  for (const division of divisions) {
    const divSchools = schools.filter((s) => s.division === division && s.id !== state2.playerSchoolId);
    const nDiv = divSchools.length;
    if (nDiv === 0) continue;
    const minChanges = Math.floor(nDiv * C.CAROUSEL_CHURN_MIN);
    const maxChanges = Math.ceil(nDiv * C.CAROUSEL_CHURN_MAX);
    const departures = [];
    for (const school of divSchools) {
      const coach = school.coach;
      if (!coach || !coach.isAI) continue;
      const actual = ((_a = school.recentWins) == null ? void 0 : _a[0]) || 0;
      const exp = expectedWins(school.prestige, games);
      const delta = actual - exp;
      coach.tenureSeasons = (coach.tenureSeasons || 0) + 1;
      // The run clock (DNA TREE §8). Old-save coaches (no age) get one rolled
      // lazily, credited with current tenure — zero-migration. Age ticks here
      // and ONLY here for AI HCs, and never resets on a poach.
      if (coach.age == null) coach.age = Math.min(C.COACH_AGE.RETIRE_FORCE - 1, randInt3(C.COACH_AGE.HC_MIN, C.COACH_AGE.HC_MAX) + (coach.tenureSeasons || 0));
      else coach.age = coach.age + 1;
      coach.dominanceStreak = delta >= C.DOMINANCE_DELTA ? (coach.dominanceStreak || 0) + 1 : 0;
      coach.jobSecurity = Math.max(0, Math.min(
        100,
        ((_b = coach.jobSecurity) != null ? _b : C.JOBSEC_START) + C.JOBSEC_PER_DELTA * delta + C.JOBSEC_PRESTIGE_STABILITY * ((school.prestige || 3) - 3)
      ));
      const inGrace = coach.tenureSeasons <= C.JOBSEC_GRACE_SEASONS;
      const contractUp = coach.contract && state2.season >= coach.contract.endSeason;
      let reason = null;
      // Retirement is the MAN'S decision, not the AD's — it ignores the firing
      // grace window and keys on AGE (tenure resets on every poach, so the old
      // tenure gate made hot journeymen immortal — DNA TREE §8's carousel fix).
      const _age = coach.age;
      if (_age >= C.COACH_AGE.RETIRE_FORCE || _age >= C.COACH_AGE.RETIRE_ELIGIBLE && Math.random() < C.COACH_AGE.RETIRE_BASE + (_age - C.COACH_AGE.RETIRE_ELIGIBLE) * C.COACH_AGE.RETIRE_RAMP) {
        reason = "retired";
      } else if (!inGrace) {
        const badYear = delta <= C.CAROUSEL_FIRE_DELTA;
        const streakFire = coach.lastDelta != null && delta < 0 && coach.lastDelta < 0 && coach.jobSecurity <= C.JOBSEC_HOT;
        if (badYear && (coach.jobSecurity <= C.JOBSEC_HOT || streakFire) && Math.random() < C.CAROUSEL_FIRE_PROB) {
          reason = "fired";
        } else if (contractUp && delta <= C.CAROUSEL_FIRE_DELTA + 1 && Math.random() < C.CAROUSEL_LAPSE_PROB) {
          reason = "lapsed";
        }
      }
      coach.lastDelta = delta;
      if (!reason && contractUp) {
        coach.contract.endSeason = state2.season + randInt3(2, 4) + (school.prestige >= 5 ? 1 : 0);
      }
      if (reason) departures.push({ school, coach, reason });
    }
    departures.sort((a, b) => {
      var _a2, _b2;
      return ((_a2 = a.coach.jobSecurity) != null ? _a2 : 0) - ((_b2 = b.coach.jobSecurity) != null ? _b2 : 0);
    });
    let leaving = departures.slice(0, maxChanges);
    if (leaving.length < minChanges) {
      const already = new Set(leaving.map((d) => d.school.id));
      const filler = divSchools.filter((s) => s.coach && s.coach.isAI && !already.has(s.id) && s.coach.tenureSeasons > C.JOBSEC_GRACE_SEASONS).sort((a, b) => {
        var _a2, _b2;
        return ((_a2 = a.coach.jobSecurity) != null ? _a2 : 0) - ((_b2 = b.coach.jobSecurity) != null ? _b2 : 0);
      }).slice(0, minChanges - leaving.length).map((s) => ({ school: s, coach: s.coach, reason: s.coach.contract && state2.season >= s.coach.contract.endSeason ? "lapsed" : "fired" }));
      leaving = leaving.concat(filler);
    }
    for (const d of leaving) {
      const { school, coach, reason } = d;
      const nm = `${((_d = (_c = coach.name) == null ? void 0 : _c.first) == null ? void 0 : _d[0]) || ""}. ${((_e = coach.name) == null ? void 0 : _e.last) || "Coach"}`;
      school.coach = null;
      school._lastVacancy = { reason, coachName: nm, season: state2.season };
      openings.push(school);
      const line = reason === "fired" ? `${school.name} fired ${nm} after a ${(_g = (_f = school.recentWins) == null ? void 0 : _f[0]) != null ? _g : 0}-win season.` : reason === "lapsed" ? `${school.name} let ${nm}'s contract expire.` : reason === "retired" ? `${nm} announced retirement, leaving ${school.name}.` : `${school.name} has an opening.`;
      events.push({ type: "info", text: line });
    }
  }
  cascadeCarousel(state2, events, openings);
}
function coachHotScore(coach, school) {
  if (!coach) return -999;
  const games = C.CONF_GAMES + C.NONCONF_GAMES;
  const wins = school && school.recentWins && school.recentWins[0] || 0;
  const exp = expectedWins((school == null ? void 0 : school.prestige) || 3, games);
  const overperf = wins - exp;
  const streak = coach.dominanceStreak || 0;
  const rep = skillGradeIndex(coach, "reputation") || 0;
  return overperf * 2 + streak * 3 + rep * 0.8;
}
function cascadeCarousel(state2, events, openings) {
  var _a, _b, _c, _d, _e, _f;
  const schools = state2.world.schools;
  const resolved = /* @__PURE__ */ new Set();
  let guard = 0;
  while (guard++ < 200) {
    const openSeats = openings.filter((s) => !s.coach && s.id !== state2.playerSchoolId && !resolved.has(s.id)).sort((a, b) => schoolPull(b) - schoolPull(a));
    const seat = openSeats[0];
    if (!seat) break;
    const candidates = schools.filter((s) => s.coach && s.coach.isAI && s.id !== state2.playerSchoolId && s.id !== seat.id && schoolPull(seat) > schoolPull(s) && coachHotScore(s.coach, s) >= C.CAROUSEL_PROMOTE_MIN).map((s) => ({ from: s, score: coachHotScore(s.coach, s) })).sort((a, b) => b.score - a.score);
    const pick2 = candidates[0];
    let coordPick = null;
    if ((seat.prestige || 3) <= C.COORD_HC_MAX_PRESTIGE) {
      const coordCands = [];
      for (const s of schools) {
        if (s.id === seat.id || s.id === state2.playerSchoolId || !s.staff) continue;
        for (const side of ["oc", "dc"]) {
          const co = s.staff[side];
          if (!co) continue;
          const avg2 = coordRatingAvg(co);
          if (avg2 >= C.COORD_HC_MIN_RATING) coordCands.push({ from: s, side, co, avg: avg2 });
        }
      }
      coordCands.sort((a, b) => b.avg - a.avg);
      coordPick = coordCands[0] || null;
    }
    const promoteHead = pick2 && (!coordPick || pick2.score * 8 >= coordPick.avg - 55);
    if (!pick2 && !coordPick || Math.random() > C.CAROUSEL_POACH_PROB) {
      resolved.add(seat.id);
      continue;
    }
    if (!promoteHead && coordPick) {
      const co = coordPick.co;
      const newHC = generateAICoach(seat);
      newHC.name = co.name;
      if (co.age != null) newHC.age = co.age;
      newHC.reputation = "C";
      newHC.fromCoordinator = true;
      seat.coach = newHC;
      seat._lastVacancy = { reason: "coord-promoted", coachName: `${((_a = co.name) == null ? void 0 : _a.first) || ""} ${((_b = co.name) == null ? void 0 : _b.last) || ""}`.trim(), season: state2.season };
      coordPick.from.staff[coordPick.side] = generateCoordinator(coordPick.side.toUpperCase(), 44 + (coordPick.from.prestige || 1) * 5, coordPick.from.division);
      events.push({ type: "info", text: `${seat.name} promoted ${coordPick.from.name}'s ${coordPick.side.toUpperCase()} ${((_c = co.name) == null ? void 0 : _c.first) || ""} ${co.name.last} to head coach.` });
      continue;
    }
    const from = pick2.from;
    const moving = from.coach;
    const nm = `${((_e = (_d = moving.name) == null ? void 0 : _d.first) == null ? void 0 : _e[0]) || ""}. ${((_f = moving.name) == null ? void 0 : _f.last) || "Coach"}`;
    seat.coach = moving;
    moving.schoolId = seat.id;
    moving.prestige = seat.prestige;
    moving.tenureSeasons = 0;
    moving.jobSecurity = C.JOBSEC_START;
    moving.dominanceStreak = 0;
    moving.contract = { endSeason: state2.season + randInt3(2, 4) + (seat.prestige >= 5 ? 1 : 0) };
    from.coach = null;
    from._lastVacancy = { reason: "poached", coachName: nm, toSchool: seat.name, season: state2.season };
    openings.push(from);
    events.push({ type: "info", text: `${seat.name} hired ${nm} away from ${from.name}.` });
  }
}
function runJobMarket(state2, events) {
  var _a;
  const openings = [];
  updateAICarousel(state2, events, openings);
  const pc = state2.playerCoach;
  if (pc && pc._pendingFire && pc.status !== "unemployed") {
    const oldSchool = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
    if (oldSchool) {
      oldSchool.coach = null;
      openings.push(oldSchool);
    }
    pc.status = "unemployed";
    pc._pendingFire = false;
    events.push({ type: "warning", text: `You have been let go by ${(_a = oldSchool == null ? void 0 : oldSchool.name) != null ? _a : "your program"}. You must take a new job to continue.` });
  }
  if (pc && pc.status === "unemployed") {
    buildForcedShortlist(state2, events, openings);
  }
  state2.jobOpenings = openings.filter((sc2) => sc2.id !== state2.playerSchoolId).map((sc2) => {
    var _a2;
    return {
      schoolId: sc2.id,
      schoolName: sc2.name,
      division: sc2.division,
      prestige: sc2.prestige,
      pull: schoolPull(sc2),
      status: "open",
      reason: ((_a2 = sc2._lastVacancy) == null ? void 0 : _a2.reason) || null
    };
  });
  const playerVacated = pc && pc.status === "unemployed" ? state2.playerSchoolId : null;
  for (const school of state2.world.schools) {
    if (school.id === state2.playerSchoolId) continue;
    if (school.id === playerVacated) continue;
    if (!school.coach) {
      school.coach = makeReplacementAICoach(school);
    }
  }
  if (pc && pc.status === "employed") {
    const cooledDown = pc.lastOfferSeason == null || state2.season - pc.lastOfferSeason > C.OFFER_COOLDOWN;
    if (cooledDown) {
      const repScore = coachRepScore(pc);
      const here = schoolPull(state2.world.schools.find((s) => s.id === state2.playerSchoolId) || {});
      // [W9 §12 T2] In a tree, a call from a division one of your OWN coaches
      // already holds is not an offer you could ever take — filter it before it
      // reaches the screen. Your current division stays legal: moving inside it
      // is the slot moving. Null (no filtering) on every non-tree save.
      const t9 = ensureTree(state2);
      const blockedDivs = t9 ? new Set(C.TREE.DIVISIONS.filter((d) => d !== t9.active && t9.slots[d] && !t9.slots[d].retired)) : null;
      const callers = (openings || []).filter((s) => s.id !== state2.playerSchoolId).filter((s) => !blockedDivs || !blockedDivs.has(s.division)).filter((s) => repScore >= schoolPull(s) - C.OFFER_SLACK).filter((s) => schoolPull(s) >= here - C.OFFER_SLACK).filter(() => Math.random() < C.OFFER_CALL_PROB).sort((a, b) => schoolPull(b) - schoolPull(a)).slice(0, C.OFFER_MAX);
      if (callers.length) {
        state2.pendingOffers = callers.map((s) => {
          var _a2;
          return {
            schoolId: s.id,
            schoolName: s.name,
            division: s.division,
            prestige: s.prestige,
            reason: ((_a2 = s._lastVacancy) == null ? void 0 : _a2.reason) || null
          };
        });
        pc.lastOfferSeason = state2.season;
        events.push({ type: "info", text: `You have ${callers.length} job offer${callers.length > 1 ? "s" : ""}. Review them in the Job Market.` });
      }
    }
  }
}
function buildForcedShortlist(state2, events, openings) {
  var _a, _b;
  const pc = state2.playerCoach;
  const repScore = coachRepScore(pc);
  const oldSchoolId = state2.playerSchoolId;
  const divRank = { D3: 0, D2: 1, D1: 2 };
  const firedDivCap = (_b = divRank[(_a = state2.world.schools.find((s) => s.id === oldSchoolId)) == null ? void 0 : _a.division]) != null ? _b : 2;
  let opts = (openings || []).filter((s) => {
    var _a2;
    return s.id !== oldSchoolId && ((_a2 = divRank[s.division]) != null ? _a2 : 0) <= firedDivCap;
  }).map((s) => ({ school: s, pull: schoolPull(s) })).filter((o) => o.pull <= repScore + C.OFFER_SLACK).sort((a, b) => b.pull - a.pull).slice(0, C.OFFER_MAX);
  if (opts.length === 0) {
    const anyPoachable = state2.world.schools.filter((s) => s.id !== oldSchoolId && s.coach && s.coach.isAI).sort((a, b) => schoolPull(a) - schoolPull(b))[0];
    if (anyPoachable) opts = [{ school: anyPoachable, pull: schoolPull(anyPoachable) }];
  }
  state2.forcedShortlist = opts.map((o) => ({
    schoolId: o.school.id,
    schoolName: o.school.name,
    division: o.school.division,
    prestige: o.school.prestige
  }));
}
function makeReplacementAICoach(school) {
  const coach = generateAICoach(school);
  const yrs = randInt3(0, 6);
  coach.careerWins = yrs * randInt3(4, 8);
  coach.careerLosses = yrs * randInt3(3, 7);
  coach.priorSeasons = yrs;
  return coach;
}
function acceptJob(state2, newSchoolId) {
  const pc = state2.playerCoach;
  const newSchool = state2.world.schools.find((s) => s.id === newSchoolId);
  if (!pc || !newSchool) return { ok: false, reason: "School not found" };
  pc.contract = null;
  pc.seasonGoals = null;
  state2.rivalry = (newSchool == null ? void 0 : newSchool.rival) ? {
    schoolId: newSchool.rival.schoolId,
    schoolName: newSchool.rival.name,
    trophy: newSchool.rival.trophy,
    sinceSeason: null,
    since: newSchool.rival.since,
    holderId: newSchool.rival.holderId,
    wins: newSchool.rival.wins,
    losses: newSchool.rival.losses,
    ties: newSchool.rival.ties || 0,
    inherited: true
  } : null;
  const oldSchoolId = state2.playerSchoolId;
  const oldSchool = state2.world.schools.find((s) => s.id === oldSchoolId);
  // A coach who WALKED OUT of a chair he held (not a fired man taking the
  // shortlist) leaves a program behind — that distinction is what arms the
  // tree's move-up handoff below.
  const walkedOut = !!(oldSchool && oldSchool.id !== newSchoolId && oldSchool.coach === pc);
  if (oldSchool && oldSchool.id !== newSchoolId && (!oldSchool.coach || oldSchool.coach === pc)) {
    oldSchool.coach = makeReplacementAICoach(oldSchool);
  }
  // [PLAYTEST 2026-08-12 item 26] THE GAMEPLAN TRAVELS WITH THE COACH.
  // The plan lives on the school, so a coach used to walk into a stranger's
  // playbook — while state.quickPlans (which hangs off state) followed him,
  // making the inconsistency visible. Carry the coach-owned scheme; leave behind
  // anything that names the OLD roster.
  if (oldSchool && oldSchool.id !== newSchoolId && oldSchool.gameplan) {
    const carried = JSON.parse(JSON.stringify(oldSchool.gameplan));
    // Player-id-bearing and school-bearing keys stay with the old program.
    delete carried.fieldAssignments;
    delete carried.rbCarryShares;
    delete carried._aiScheme;
    delete carried._nextPlay;
    newSchool.gameplan = Object.assign(newSchool.gameplan || {}, carried);
    try {
      newSchool.depthChart = buildDepthChart(newSchool.roster, newSchool.gameplan, newSchool.depthOrder || {});
    } catch (e) {
      console.warn("gameplan carry rebuild:", e.message);
    }
  }
  newSchool.coach = pc;
  if (pc.skills && pc.skills.roots) {
    pc.skills.roots.xp = Math.round((pc.skills.roots.xp || 0) * C.ROOTS_MOVE_RETENTION);
  }
  pc.schoolId = newSchool.id;
  pc.prestige = newSchool.prestige;
  state2.playerSchoolId = newSchool.id;
  pc.status = "employed";
  pc.jobSecurity = 50;
  pc.tenureSeasons = 0;
  // [OWNER RULING Aug 2026 — dynasty vs ladder] Climbing costs the dynasty:
  // every loyalty raise he stacked at the old school is forfeited here.
  pc.retentionStacks = 0;
  // [PLAYTEST 2026-08-12 item 25] …and so is the war chest. It used to follow
  // him: initBudget folds coach.budget in as carryover every rollover, and this
  // function never touched it. promoteCoordinatorToHC already zeroed both, so
  // the two career-move paths disagreed. The money belonged to the old program.
  const forfeitedBudget = Math.round(pc.budget || 0);
  pc.budget = 0;
  pc.budgetCarryover = 0;
  pc.pendingScheduleGuarantee = 0;
  pc.pendingRetentionCost = 0;
  pc.lastDelta = null;
  pc.dominanceStreak = 0;
  pc.lastOfferSeason = null;
  pc.recruitBoard = [];
  pc.scouted = {};
  state2.pendingOffers = null;
  state2.forcedShortlist = null;
  // [W9 §12] A tree coach who moves has MOVED HIS SLOT, not created one —
  // otherwise the man would hold two divisions at once and T2 would be a lie.
  // Re-keying here is also what FREES the division he just left, the vacancy a
  // protégé is then promoted into. Inert on a non-tree save.
  try {
    syncActiveSlot(state2);
  } catch (e) {
    console.warn("W9 slot sync:", e.message);
  }
  // [W9 §12 R3] THE MOVE-UP HANDOFF. Armed AFTER the slot re-key, because the
  // window only exists if the division he left is now open to the tree. The
  // interim AI coach seated above keeps the world sane in the meantime; the
  // handoff, taken, simply replaces him with the coordinator left behind.
  // Inert on a non-tree save and on a forced (fired) move.
  if (walkedOut) {
    try {
      noteMoveUpHandoff(state2, oldSchoolId);
    } catch (e) {
      console.warn("W9 handoff:", e.message);
    }
  }
  return { ok: true, schoolName: newSchool.name, forfeitedBudget, carriedGameplan: !!(oldSchool && oldSchool.id !== newSchoolId && oldSchool.gameplan) };
}
function pruneCapBlockedSignings(state2) {
  const prevSeason = state2.season - 1;
  if (prevSeason < 1 || !state2.signingsLog) return;
  const arrivedIds = /* @__PURE__ */ new Set();
  for (const school of state2.world.schools) {
    for (const player of school.roster) arrivedIds.add(player.id);
  }
  state2.signingsLog = state2.signingsLog.filter(
    (e) => e.season !== prevSeason || arrivedIds.has(e.recruitId)
  );
}
// Every school this save's coach(es) actually run — the tree's live chairs plus
// whoever is active. Read off state.tree directly to avoid an import cycle.
function coachedSchoolIds(state2) {
  var _a;
  const ids = new Set();
  const slots = ((_a = state2.tree) == null ? void 0 : _a.slots) || {};
  for (const slot of Object.values(slots)) {
    if (slot && !slot.retired && slot.schoolId) ids.add(slot.schoolId);
  }
  if (state2.playerSchoolId) ids.add(state2.playerSchoolId);
  return [...ids];
}
function startNewSeason(state2, dispatch2) {
  state2.playoffs = null;
  state2.allPlayoffs = null;
  state2.bowls = null;
  addFreshmenToRosters(state2);
  // [PLAYTEST 2026-08-12] EVERY CHAIR GETS ITS OWN REDSHIRT DECISION.
  // This used to compare against `state.playerSchoolId` — a single pointer — so
  // in a coaching tree only whichever chair happened to be active at rollover was
  // handed a real decision. Every OTHER school the same player coaches was run
  // through autoRedshirtFreshmen like an AI program, its freshmen redshirted
  // immediately and `pendingRedshirts` left null. Switch to that chair and the
  // screen reads "Redshirts finalized ✓" for a window he never got. Owner:
  // "I finalized redshirts for 1 coach and went to do the other and both coaches
  // had been finalized."
  const _mine = new Set(coachedSchoolIds(state2));
  for (const school of state2.world.schools) {
    if (_mine.has(school.id)) {
      school.pendingRedshirts = computeAutoRedshirtCandidates(school, state2.season);
    } else {
      autoRedshirtFreshmen(school, state2.season);
    }
  }
  pruneCapBlockedSignings(state2);
  state2.autoRecruitLog = [];
  if (state2.playerCoach) {
    state2.playerCoach.recruitBoard = [];
    state2.playerCoach.scouted = {};
  }
  for (const school of state2.world.schools) {
    if (school.coach) {
      school.coach.recruitBoard = [];
      school.coach.scouted = {};
    }
  }
  for (const school of state2.world.schools) {
    for (const player of school.roster) {
      if (player.convPenalty && player.convPenalty.season < state2.season) {
        delete player.convPenalty;
        refreshRatings(player);
      }
      if (player.convDev && player.convDev.season < state2.season) {
        player.convDev.left = (player.convDev.left || 0) - 1;
        if (player.convDev.left <= 0) delete player.convDev;
        else player.convDev.season = state2.season;
      }
    }
  }
  // PASS 7 rollover (roster brain) — MUST run before the stat reset below:
  // AI converts, earned bridges and bulk/cut all consume last season's real
  // snaps/jobs (Fix D). Ref/PASS7_ROSTER_PLAN.md.
  pass7Rollover(state2);
  const blank = emptyStats();
  for (const school of state2.world.schools) {
    for (const player of school.roster) {
      player.stats = __spreadValues({}, blank);
    }
  }
  state2.world.recruits = generateRecruitPool(state2.world);
  for (const school of state2.world.schools) {
    const seniors = school.roster.filter((p) => p.classYear === "SR").length;
    const openSlots = Math.max(0, C.ROSTER_SIZE - school.roster.length) + seniors;
    const coach = school.coach;
    if (coach) initBudget(coach, openSlots, coach.budget || 0, school, state2.season);
  }
  if (state2.playerCoach) {
    const school = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
    if (!school || school.coach !== state2.playerCoach) {
      const seniors = school ? school.roster.filter((p) => p.classYear === "SR").length : 0;
      const openSlots = school ? Math.max(0, C.ROSTER_SIZE - school.roster.length) + seniors : 10;
      initBudget(state2.playerCoach, openSlots, state2.playerCoach.budget || 0, school, state2.season);
    }
  }
  initPreseason(state2);
  state2.jobOpenings = null;
  slotRivalryGame(state2);
  state2.schedule = generateSchedule(state2.world, state2.season, state2.pendingNonConfChoices || []);
  state2.pendingNonConfChoices = [];
}
function trackCoachDNA(state2, token, game, result, events) {
  var _a, _b, _c, _d;
  if (!state2._coachId || !result) return;
  const myId = state2.playerSchoolId;
  const home = game.homeId === myId || ((_a = game.home) == null ? void 0 : _a.id) === myId;
  if (!home && game.awayId !== myId && ((_b = game.away) == null ? void 0 : _b.id) !== myId) return;
  const myScore = home ? result.homeScore : result.awayScore;
  const oppScore = home ? result.awayScore : result.homeScore;
  const myStats = home ? result.homePlayerStats : result.awayPlayerStats;
  const won = myScore > oppScore;
  let rushAtt = 0, passAtt = 0, sacks = 0, takeaways = 0, giveaways = 0, fgMade = 0, retTD = 0, penalties = 0, bigRusher = 0, bigPasser = 0;
  for (const pid in myStats || {}) {
    const s = myStats[pid];
    rushAtt += s.rushAtt || 0;
    passAtt += s.passAtt || 0;
    sacks += s.sacks || 0;
    takeaways += (s.ints || 0) + (s.forcedFumbles || 0);
    giveaways += s.passInt || 0;
    fgMade += s.fgMade || 0;
    retTD += s.retTD || 0;
    penalties += s.penalties || 0;
    if ((s.rushYds || 0) >= 200) bigRusher = Math.max(bigRusher, s.rushYds);
    if ((s.passYds || 0) >= 400) bigPasser = Math.max(bigPasser, s.passYds);
  }
  const plays = rushAtt + passAtt;
  const school = state2.world.schools.find((s) => s.id === myId);
  const gp = (school == null ? void 0 : school.gameplan) || {};
  const xp = {};
  const add = (axis, n) => {
    if (n > 0) xp[axis] = (xp[axis] || 0) + n;
  };
  if (plays >= 20) {
    const runShare = rushAtt / plays;
    if (runShare >= 0.6) add("groundPound", 3);
    else if (runShare >= 0.52) add("groundPound", 1);
    if (runShare <= 0.4) add("airAttack", 3);
    else if (runShare <= 0.48) add("airAttack", 1);
  }
  const blitz = (_c = gp.blitzPct) != null ? _c : 20;
  if (blitz >= 32) add("pressure", 3);
  else if (blitz >= 25) add("pressure", 1);
  add("pressure", Math.min(3, sacks));
  add("ballHawk", Math.min(6, takeaways * 2));
  if (giveaways === 0 && plays >= 20) add("ballSecurity", 3);
  if (penalties <= 3 && plays >= 20) add("discipline", 2);
  if (gp.fourthDown === "aggressive" || gp.fourthDown === "veryAggressive") add("riverboat", won ? 3 : 1);
  if (!home && won) add("roadWarrior", 4);
  if (fgMade >= 2) add("specialTeams", 2);
  add("specialTeams", retTD * 4);
  const badges = [];
  const badge = (id, label, axis, big) => {
    badges.push({ id, label, season: state2.season, day: state2.day });
    add(axis, big);
    events == null ? void 0 : events.push({ type: "info", text: `\u{1F3C5} Coach milestone: ${label}` });
  };
  const htMy = token ? home ? token.homeScore : token.awayScore : null;
  const htOpp = token ? home ? token.awayScore : token.homeScore : null;
  if (won && htMy != null && htOpp - htMy >= 10) badge("comeback", `Comeback win \u2014 trailed ${htOpp}\u2013${htMy} at the half`, "riverboat", 12);
  if (sacks >= 5) badge("sack5", `${sacks}-sack game`, "pressure", 10);
  if (takeaways >= 3) badge("take3", `${takeaways}-takeaway game`, "ballHawk", 10);
  if (bigRusher) badge("rush200", `${bigRusher}-yard rusher`, "groundPound", 10);
  if (bigPasser) badge("pass400", `${bigPasser}-yard passer`, "airAttack", 10);
  if (won && oppScore === 0) badge("shutout", "Shutout win", "discipline", 10);
  if (retTD > 0) badge("retTD", "Return touchdown", "specialTeams", 8);
  {
    let rpoComp = 0, screenTD = false, paBomb = 0;
    for (const d of result.drives || []) {
      const myBall = d.possession === "home" === home;
      if (!myBall) continue;
      const ps = d.plays || [];
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        if (p.rpo && p.complete) rpoComp++;
        if (p.isScreen && p.td) screenTD = true;
        if (p.playAction && p.complete && (p.yards || 0) >= 40) paBomb = Math.max(paBomb, p.yards);
      }
    }
    const myPS = home ? result.homePlayerStats : result.awayPlayerStats;
    let teamPres = 0;
    for (const pid in myPS || {}) teamPres += myPS[pid].pressures || 0;
    if (teamPres >= 10) badge("pressure10", `${teamPres}-pressure swarm`, "pressure", 8);
    if (rpoComp >= 4) badge("rpoClinic", `RPO clinic \u2014 ${rpoComp} pulls completed`, "airAttack", 8);
    if (screenTD) badge("screenTD", "Screen taken to the house", "airAttack", 8);
    if (paBomb) badge("paBomb", `Play-action bomb \u2014 ${paBomb} yards`, "airAttack", 10);
  }
  if (won && myScore - oppScore >= 35) badge("blowout", `Statement win, ${myScore}\u2013${oppScore}`, "discipline", 5);
  if (!home && won) {
    const rk = (_d = rankMap(state2, school == null ? void 0 : school.division)) == null ? void 0 : _d.get(home ? game.awayId : game.homeId);
    if (rk && rk <= 15) badge("roadRanked", `Road win over #${rk}`, "roadWarrior", 12);
  }
  if (Object.keys(xp).length || badges.length) {
    const ups = addDnaXP(state2._coachId, xp, badges);
    for (const u of ups) {
      events == null ? void 0 : events.push({ type: "info", text: `\u{1F4C8} Coach DNA: ${u.axis} reached grade ${u.grade}` });
    }
    if (school) school._dnaGrades = dnaGrades(state2._coachId);
  }
  if (state2._coachId) {
    try {
      let gPass = 0, gRush = 0;
      for (const pid in myStats || {}) {
        const s = myStats[pid];
        gPass = Math.max(gPass, s.passYds || 0);
        gRush = Math.max(gRush, s.rushYds || 0);
      }
      const ctx2 = { world: state2._worldSlot, school: school == null ? void 0 : school.name, season: state2.season };
      const g = {};
      if (gPass > 0) g.passYds = { v: gPass, ctx: ctx2 };
      if (gRush > 0) g.rushYds = { v: gRush, ctx: ctx2 };
      if (sacks > 0) g.sacks = { v: sacks, ctx: ctx2 };
      if (takeaways > 0) g.takeaways = { v: takeaways, ctx: ctx2 };
      if (won && myScore - oppScore > 0) g.margin = { v: myScore - oppScore, ctx: ctx2 };
      if (Object.keys(g).length) noteCoachRecords(state2._coachId, { game: g });
    } catch (e) {
    }
  }
}
function updateOLContinuity(school) {
  var _a, _b, _c;
  if (!((_a = school == null ? void 0 : school.depthChart) == null ? void 0 : _a.OL)) return;
  const five = school.depthChart.OL.slice(0, 5).join("|");
  if (school._olLastFive === five) {
    school._olCont = Math.min(10, ((_b = school._olCont) != null ? _b : 6) + 1);
  } else if (school._olLastFive) {
    const changes = school.depthChart.OL.slice(0, 5).filter((id) => !school._olLastFive.includes(id)).length;
    school._olCont = Math.max(0, ((_c = school._olCont) != null ? _c : 6) - changes * 2);
  }
  school._olLastFive = five;
}
var PHASES, RECRUITING_OPEN, REG_WEEK_1_DAY, REG_WEEK_COUNT, weekLabel, weekShort, AUTO_BOARD_MAX, PLAYOFF_DIVS, RECORD_CATS, GRADE_LETTERS;

PHASES = {
  PRESEASON: { days: [1, 4], label: "Preseason" },
  NONCONF: { days: [5, 8], label: "Non-Conference" },
  CONFERENCE: { days: [9, 18], label: "Conference Play" },
  // No game is scheduled on day 19 — CONF_GAME_DAYS ends at 18. Conference
  // champions are decided on conference record and the postseason field is
  // announced here, so the week is Selection Week, not a title-game week. (Real
  // title games are a separate pass: see Ref/PLAYTEST_2026-08-12.md item 17.)
  CONFCHAMP: { days: [19, 19], label: "Selection Week" },
  PLAYOFFS: { days: [20, 23], label: "Playoffs" },
  JOBS: { days: [24, 30], label: "Offseason" }
};
RECRUITING_OPEN = { start: 1, end: 19 };
REG_WEEK_1_DAY = PHASES.NONCONF.days[0];
REG_WEEK_COUNT = PHASES.CONFCHAMP.days[1] - REG_WEEK_1_DAY + 1;
weekLabel = (day) => calendarWeek(day).label;
weekShort = (day) => calendarWeek(day).short;
AUTO_BOARD_MAX = 30;
PLAYOFF_DIVS = ["D1", "D2", "D3"];
RECORD_CATS = [
  "passYds",
  "passTD",
  "rushYds",
  "rushTD",
  "recYds",
  "recTD",
  "recComp",
  "tackles",
  "sacks",
  "ints",
  "fgMade"
];
GRADE_LETTERS = ["F", "D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+"];

export { PHASES, REG_WEEK_COUNT, acceptJob, advanceDay, calendarWeek, defaultRecruitStrategy, getPhase, isRecruitingDay, playerGameOpponentForDay, recruitAssistLevel, resumeFromFourthDown, resumeFromHalftime, resumeFromPlayCall, weekLabel, weekShort };

// additional exports consumed by tools/ probes
export { RECRUITING_OPEN, autoRecruitForPlayer, updateAICarousel, updateJobSecurity };
// PASS 7: probe seams (snap persistence + morale tick ride updateStandings)
export { updateStandings, applySnapCounts, tickMorale, updatePrestige };
// PLAYTEST 2026-08-12: chair_isolation_probe asserts the redshirt window is
// seeded for every chair, not just whoever is active at rollover.
export { coachedSchoolIds };
