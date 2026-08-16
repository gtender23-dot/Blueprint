import { __spreadProps, __spreadValues } from '../_spread.js';
import { C } from '../constants.js';
import { addSkillXP } from './coach.js';
import { addDnaXP } from './coachprofile.js';

// developer/recruiter are now DNA axes FOR THE PLAYER, but stay SKILLS for AI
// coaches (AI keeps its own development internally). This routes an axis's XP to
// the right place: DNA when the coach is the player (isAI === false) and a
// player profile id is known, else the coach's skill. The XP amounts are the
// old skill amounts — on the DNA curve they simply grade up a bit slower (the
// intended "ramp stretches, max matches" behavior). reputation/roots never
// route here — they remain skills for everyone.
function awardCoachAxisXP(coach, axis, amount, playerCoachId) {
  if (!coach || !amount) return;
  // [DNA TREE §4 D3] recruiter/developer are skills again for EVERYONE — the
  // player earns on the same 13-step ladder the AI always did, at the same
  // old amounts. Other axes still route to the player's DNA profile.
  if (axis === "developer" || axis === "recruiter") {
    addSkillXP(coach, axis, amount);
    return;
  }
  if (coach.isAI === false && playerCoachId) addDnaXP(playerCoachId, { [axis]: amount });
  else addSkillXP(coach, axis, amount);
}
function computeMilestones(school, coach, playerCoachId = null) {
  var _a, _b;
  const hits = [];
  for (const p of school.roster) {
    const s = p.stats || {};
    for (const m of MILESTONES) {
      if ((s[m.key] || 0) >= m.min) {
        hits.push({ playerId: p.id, name: `${((_a = p.name) == null ? void 0 : _a.first) || ""} ${((_b = p.name) == null ? void 0 : _b.last) || ""}`.trim(), label: m.label });
        if (coach) awardCoachAxisXP(coach, "developer", C.XP_MILESTONE, playerCoachId);
      }
    }
  }
  return hits;
}
function awardDevelopmentXP(school, coach, before, graduated, playerCoachId = null) {
  var _a;
  if (!coach) return { raisers: 0, finishers: 0 };
  let raisers = 0, finishers = 0;
  for (const p of school.roster) {
    const gain = (p.compositeRating || 0) - ((_a = before.get(p.id)) != null ? _a : p.compositeRating || 0);
    if (gain >= C.RAISER_GAIN) {
      awardCoachAxisXP(coach, "developer", C.XP_RAISER, playerCoachId);
      raisers++;
    }
  }
  for (const g of graduated || []) {
    if (g.arrivalComposite != null && (g.compositeRating || 0) - g.arrivalComposite >= C.FINISHER_GAIN) {
      awardCoachAxisXP(coach, "developer", C.XP_FINISHER, playerCoachId);
      finishers++;
    }
  }
  return { raisers, finishers };
}
function offScore(gs) {
  return (gs.passYds || 0) * 0.04 + (gs.passTD || 0) * 4 - (gs.passInt || 0) * 2 + (gs.rushYds || 0) * 0.1 + (gs.rushTD || 0) * 6 + (gs.recYds || 0) * 0.1 + (gs.recTD || 0) * 6;
}
function defScore(gs) {
  return (gs.tackles || 0) * 0.5 + (gs.tacklesForLoss || 0) * 1.5 + (gs.sacks || 0) * 3 + (gs.ints || 0) * 5 + (gs.passBreakups || 0) * 1 + (gs.forcedFumbles || 0) * 3;
}
function scoreQB(s) {
  return (s.passYds || 0) * 0.04 + (s.passTD || 0) * 4 - (s.passInt || 0) * 2 + (s.rushYds || 0) * 0.05 + (s.rushTD || 0) * 4;
}
function scoreRB(s) {
  return (s.rushYds || 0) * 0.1 + (s.rushTD || 0) * 6 + (s.recYds || 0) * 0.08 + (s.recTD || 0) * 5;
}
function scoreRecv(s) {
  return (s.recYds || 0) * 0.1 + (s.recTD || 0) * 6 + (s.recComp || 0) * 0.2;
}
function scoreEdgeDT(s) {
  return (s.sacks || 0) * 4 + (s.tacklesForLoss || 0) * 2 + (s.forcedFumbles || 0) * 3 + (s.tackles || 0) * 0.3;
}
function scoreLB(s) {
  return (s.tackles || 0) * 0.6 + (s.tacklesForLoss || 0) * 1.5 + (s.sacks || 0) * 3 + (s.ints || 0) * 4 + (s.forcedFumbles || 0) * 3;
}
function scoreDB(s) {
  return (s.ints || 0) * 6 + (s.passBreakups || 0) * 2 + (s.tackles || 0) * 0.4 + (s.forcedFumbles || 0) * 3;
}
function scoreK(player) {
  const s = player.stats || {};
  const made = (s.fgMade || 0) * 5 + (s.xpMade || 0);
  const acc2 = (s.fgAtt || 0) >= 8 ? (s.fgMade || 0) / s.fgAtt * 25 : 0;
  const leg = (s.fgLong || 0) >= 50 ? 6 : (s.fgLong || 0) >= 45 ? 3 : 0;
  return made + acc2 + leg;
}
function scoreP(player) {
  const s = player.stats || {};
  const n = s.puntNo || 0;
  if (n === 0) return 0;
  const avg2 = (s.puntYds || 0) / n;
  const volumeGate = Math.min(1, n / 25);
  return avg2 * volumeGate * 2;
}
function scoreOL(player, school) {
  const st = school.stats || {};
  const rushYds = st.rushYds || 0;
  const sacksAllowed = st.sacksAllowed || 0;
  const unit = rushYds * 0.05 - sacksAllowed * 8;
  const rating = player.compositeRating || 0;
  return unit + rating * 0.5;
}
function positionScore(player, school) {
  const s = player.stats || {};
  switch (player.position) {
    case "QB":
      return scoreQB(s);
    case "RB":
      return scoreRB(s);
    case "WR":
    case "TE":
      return scoreRecv(s);
    case "DE":
    case "OLB":
    case "DT":
      return scoreEdgeDT(s);
    case "LB":
      return scoreLB(s);
    case "CB":
    case "S":
      return scoreDB(s);
    case "K":
      return scoreK(player);
    case "P":
      return scoreP(player);
    case "OL":
      return scoreOL(player, school);
    default:
      return 0;
  }
}
function collectWeeklyCandidates(state2, results) {
  const pSchool = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  if (!pSchool) return [];
  const conf = pSchool.conf;
  const cands = [];
  for (const r of results) {
    const res = r.result;
    if (!res || !res.homePlayerStats && !res.awayPlayerStats) continue;
    for (const side of ["home", "away"]) {
      const school = state2.world.schools.find((s) => s.id === r.game[side + "Id"]);
      if (!school || school.conf !== conf) continue;
      const stats = side === "home" ? res.homePlayerStats : res.awayPlayerStats;
      if (!stats) continue;
      let bestOffId = null, bestOffScore = 0, bestDefId = null, bestDefScore = 0;
      for (const [pid, gs] of Object.entries(stats)) {
        const o = offScore(gs), d = defScore(gs);
        if (o > bestOffScore) {
          bestOffScore = o;
          bestOffId = pid;
        }
        if (d > bestDefScore) {
          bestDefScore = d;
          bestDefId = pid;
        }
      }
      const nameOf = (pid) => {
        var _a, _b;
        const p = school.roster.find((x) => x.id === pid);
        return p ? `${((_a = p.name) == null ? void 0 : _a.first) || ""} ${((_b = p.name) == null ? void 0 : _b.last) || ""}`.trim() : "Unknown";
      };
      if (bestOffId) cands.push({ playerId: bestOffId, name: nameOf(bestOffId), schoolId: school.id, schoolName: school.name, abbr: school.abbr, score: bestOffScore, side: "off" });
      if (bestDefId) cands.push({ playerId: bestDefId, name: nameOf(bestDefId), schoolId: school.id, schoolName: school.name, abbr: school.abbr, score: bestDefScore, side: "def" });
    }
  }
  return cands;
}
function finalizeWeeklyAwards(state2, cands, events) {
  if (!cands || !cands.length) return;
  if (!state2.awardsLog) state2.awardsLog = [];
  const coach = state2.playerCoach;
  for (const side of ["off", "def"]) {
    let best = null;
    for (const c of cands) if (c.side === side && (!best || c.score > best.score)) best = c;
    if (!best) continue;
    const mine = best.schoolId === state2.playerSchoolId;
    if (mine && coach) awardCoachAxisXP(coach, "developer", C.XP_WEEKLY_AWARD, state2._coachId);
    state2.awardsLog.push({
      season: state2.season,
      day: state2.day,
      scope: "weekly",
      category: side === "off" ? "weekly-off" : "weekly-def",
      schoolId: best.schoolId,
      schoolName: best.schoolName,
      playerId: best.playerId,
      playerName: best.name
    });
    events.push({ type: "info", text: `${side === "off" ? "Offensive" : "Defensive"} Player of the Week: ${best.name} (${best.abbr || best.schoolName})${mine ? " \u2014 your program!" : ""}` });
  }
}
function computeProgramMilestones(state2, school, coach, events) {
  var _a, _b, _c, _d;
  if (!coach || !school) return [];
  if (!coach.milestoneFlags) coach.milestoneFlags = {};
  const bracket = (_a = state2.allPlayoffs) == null ? void 0 : _a[school.division];
  const champGame = (state2.schedule || []).find((g) => g.day === 19 && (g.homeId === school.id || g.awayId === school.id) && g.result);
  const wonConfGame = !!(champGame && champGame.result.winner === school.id);
  const ccIds = bracket == null ? void 0 : bracket.confChampIds;
  const inChampSet = ccIds ? typeof ccIds.has === "function" ? ccIds.has(school.id) : Array.isArray(ccIds) && ccIds.includes(school.id) : false;
  const ctx2 = {
    coach,
    seasonWins: ((_b = school.record) == null ? void 0 : _b.wins) || 0,
    seasonLosses: ((_c = school.record) == null ? void 0 : _c.losses) || 0,
    wasConfChamp: wonConfGame || inChampSet,
    madePlayoff: !!((_d = bracket == null ? void 0 : bracket.seeds) == null ? void 0 : _d.includes(school.id)),
    wonNatty: (bracket == null ? void 0 : bracket.champion) === school.id
  };
  const hits = [];
  for (const m of PROGRAM_MILESTONES) {
    const flagKey = m.repeat ? `${m.id}:${state2.season}` : m.id;
    if (coach.milestoneFlags[flagKey]) continue;
    if (!m.check(ctx2)) continue;
    coach.milestoneFlags[flagKey] = state2.season;
    hits.push({ id: m.id, label: m.label });
    addSkillXP(coach, "reputation", C.XP_PROGRAM_MILESTONE);
    if (!state2.coachHistory) state2.coachHistory = [];
    state2.coachHistory.push({ season: state2.season, type: "program", label: m.label });
    events.push({ type: "info", text: `Program milestone: ${m.label}!` });
  }
  return hits;
}
function topByScore(list, scoreFn) {
  let best = null, bestScore = 0;
  for (const entry of list) {
    const sc2 = scoreFn(entry.player);
    if (sc2 > bestScore) {
      bestScore = sc2;
      best = __spreadProps(__spreadValues({}, entry), { score: sc2 });
    }
  }
  return best;
}
function topCOY(schools, totalGames) {
  var _a;
  let best = null, bestGap = -Infinity;
  for (const school of schools) {
    const wins = ((_a = school.recentWins) == null ? void 0 : _a[0]) || 0;
    if (wins < 4) continue;
    const winPct = wins / Math.max(1, totalGames);
    const expected = 0.3 + (school.prestige || 3) * 0.1;
    const gap = winPct - expected;
    if (gap > bestGap) {
      bestGap = gap;
      best = { school, coach: school.coach || null, gap, winPct };
    }
  }
  return best;
}
function playerName(p) {
  var _a, _b;
  return `${((_a = p.name) == null ? void 0 : _a.first) || ""} ${((_b = p.name) == null ? void 0 : _b.last) || ""}`.trim();
}
function logAward(state2, category, scope, winner, events, division = null, quiet = false) {
  var _a, _b, _c, _d, _e, _f;
  if (!winner) return;
  const entry = {
    season: state2.season,
    scope: "season",
    category,
    conf: typeof scope === "string" ? scope : void 0,
    division: division != null ? division : void 0,
    schoolId: (_b = (_a = winner.school) == null ? void 0 : _a.id) != null ? _b : null,
    schoolName: (_d = (_c = winner.school) == null ? void 0 : _c.name) != null ? _d : null,
    playerId: (_f = (_e = winner.player) == null ? void 0 : _e.id) != null ? _f : null,
    playerName: winner.player ? playerName(winner.player) : null,
    coachName: winner.coach ? playerName(winner.coach) : null
  };
  state2.awardsLog.push(entry);
  if (!quiet) {
    const who = entry.playerName ? `${entry.playerName} (${entry.schoolName})` : entry.coachName ? `${entry.coachName} (${entry.schoolName})` : entry.schoolName;
    events.push({ type: "info", text: `${category}: ${who}` });
  }
}
function logPositionAward(state2, scope, group, pos, winner, events, division = null, quiet = false) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  if (!winner) return;
  const label = scope === "all-division" ? `All-${group}` : `All-${group}`;
  state2.awardsLog.push({
    season: state2.season,
    scope,
    tier: scope,
    category: `${pos}`,
    group,
    // conf id or division
    division: division != null ? division : void 0,
    position: pos,
    schoolId: (_b = (_a = winner.school) == null ? void 0 : _a.id) != null ? _b : null,
    schoolName: (_d = (_c = winner.school) == null ? void 0 : _c.name) != null ? _d : null,
    playerId: (_f = (_e = winner.player) == null ? void 0 : _e.id) != null ? _f : null,
    playerName: winner.player ? playerName(winner.player) : null
  });
  if (!quiet) {
    const who = winner.player ? `${playerName(winner.player)} (${(_g = winner.school) == null ? void 0 : _g.name})` : (_h = winner.school) == null ? void 0 : _h.name;
    events.push({ type: "info", text: `${label} ${pos}: ${who}` });
  }
}
function computeSeasonAwards(state2, events) {
  var _a;
  const playerDiv = (_a = state2.world.schools.find((s) => s.id === state2.playerSchoolId)) == null ? void 0 : _a.division;
  if (!playerDiv) return;
  if (!state2.awardsLog) state2.awardsLog = [];
  const totalGames = C.CONF_GAMES + C.NONCONF_GAMES;
  const pc = state2.playerCoach;
  const pid = state2.playerSchoolId;
  const allDivisions = [...new Set(state2.world.schools.map((s) => s.division))];
  for (const division of allDivisions) {
    const isPlayerDiv = division === playerDiv;
    const divSchools = state2.world.schools.filter((s) => s.division === division);
    const confs = [...new Set(divSchools.map((s) => s.conf))];
    const allEntries = [];
    for (const school of divSchools) {
      for (const p of school.roster) allEntries.push({ player: p, school });
    }
    const topAtPos = (entries, pos) => {
      let best = null, bestScore = -Infinity;
      for (const e of entries) {
        if (e.player.position !== pos) continue;
        const sc2 = positionScore(e.player, e.school);
        if (sc2 > bestScore && sc2 > 0) {
          bestScore = sc2;
          best = __spreadProps(__spreadValues({}, e), { score: sc2 });
        }
      }
      return best;
    };
    if (isPlayerDiv) {
      for (const conf of confs) {
        const confEntries = allEntries.filter((e) => e.school.conf === conf);
        for (const pos of AWARD_POSITIONS) {
          const winner = topAtPos(confEntries, pos);
          if (!winner) continue;
          logPositionAward(state2, "all-conf", conf, pos, winner, events, division);
          if (pc && winner.school.id === pid) awardCoachAxisXP(pc, "developer", C.XP_ALLCONF_POS, state2._coachId);
        }
        const coy = topCOY(divSchools.filter((s) => s.conf === conf), totalGames);
        logAward(state2, "COY", conf, coy, events, division);
        if (pc && coy && coy.school.id === pid) addSkillXP(pc, "reputation", C.XP_COY);
      }
    }
    for (const pos of AWARD_POSITIONS) {
      const winner = topAtPos(allEntries, pos);
      if (!winner) continue;
      logPositionAward(state2, "all-division", division, pos, winner, events, division, !isPlayerDiv);
      if (isPlayerDiv && pc && winner.school.id === pid) awardCoachAxisXP(pc, "developer", C.XP_ALLDIV_POS, state2._coachId);
    }
    const mvp = topByScore(allEntries, (p) => Math.max(offScore(p.stats || {}), defScore(p.stats || {})));
    logAward(state2, "MVP", division, mvp, events, division, !isPlayerDiv);
    if (isPlayerDiv && mvp && pc && mvp.school.id === pid) {
      awardCoachAxisXP(pc, "developer", C.XP_MVP_DEV, state2._coachId);
      addSkillXP(pc, "reputation", C.XP_MVP_REP);
    }
    const divCoy = topCOY(divSchools, totalGames);
    logAward(state2, "DivCOY", division, divCoy, events, division, !isPlayerDiv);
    if (isPlayerDiv && divCoy && pc && divCoy.school.id === pid) addSkillXP(pc, "reputation", C.XP_DIV_COY);
  }
  awardChampionshipXP(state2, events);
  awardCareerWinMilestones(state2, events);
}
function awardChampionshipXP(state2, events) {
  var _a, _b, _c;
  const coach = state2.playerCoach;
  if (!coach) return;
  const school = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  const playerDiv = school == null ? void 0 : school.division;
  const bracket = playerDiv ? (_a = state2.allPlayoffs) == null ? void 0 : _a[playerDiv] : null;
  const ccIds = bracket == null ? void 0 : bracket.confChampIds;
  if (Array.isArray(ccIds) ? ccIds.includes(state2.playerSchoolId) : (_b = ccIds == null ? void 0 : ccIds.has) == null ? void 0 : _b.call(ccIds, state2.playerSchoolId)) {
    addSkillXP(coach, "reputation", C.XP_CONF_TITLE);
    events.push({ type: "info", text: "Conference Championship \u2014 Reputation boosted." });
  }
  if ((bracket == null ? void 0 : bracket.champion) === state2.playerSchoolId) {
    addSkillXP(coach, "reputation", C.XP_DIV_TITLE);
    coach.titles = (coach.titles || 0) + 1;
    events.push({ type: "info", text: "Division Championship! Reputation and career titles boosted." });
  }
  const totalGames = C.CONF_GAMES + C.NONCONF_GAMES;
  if (school && (((_c = school.recentWins) == null ? void 0 : _c[0]) || 0) >= totalGames) {
    addSkillXP(coach, "reputation", C.XP_UNDEFEATED);
    events.push({ type: "info", text: "Undefeated regular season! Reputation boosted." });
  }
}
function awardCareerWinMilestones(state2, events) {
  var _a;
  const coach = state2.playerCoach;
  const school = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  if (!coach || !school) return;
  if (!coach._winMilestonesHit) coach._winMilestonesHit = [];
  const seasonWins = ((_a = school.recentWins) == null ? void 0 : _a[0]) || 0;
  const afterCareer = coach.careerWins || 0;
  const beforeCareer = afterCareer - seasonWins;
  for (const [threshold, xp] of WIN_MILESTONES) {
    if (afterCareer >= threshold && beforeCareer < threshold && !coach._winMilestonesHit.includes(threshold)) {
      coach._winMilestonesHit.push(threshold);
      addSkillXP(coach, "reputation", xp);
      events.push({ type: "info", text: `Career milestone: ${threshold} wins! Reputation boosted.` });
    }
  }
}
var MILESTONES, AWARD_POSITIONS, PROGRAM_MILESTONES, WIN_MILESTONES;

MILESTONES = [
  { key: "passYds", min: 2500, label: "2,500 Passing Yards" },
  { key: "passTD", min: 25, label: "25 Passing TDs" },
  { key: "rushYds", min: 1e3, label: "1,000 Rushing Yards" },
  { key: "rushTD", min: 12, label: "12 Rushing TDs" },
  { key: "recYds", min: 900, label: "900 Receiving Yards" },
  { key: "recTD", min: 10, label: "10 Receiving TDs" },
  { key: "sacks", min: 10, label: "10 Sacks" },
  { key: "tackles", min: 100, label: "100 Tackles" },
  { key: "tacklesForLoss", min: 15, label: "15 TFL" },
  { key: "ints", min: 5, label: "5 Interceptions" }
];
AWARD_POSITIONS = ["QB", "RB", "WR", "TE", "OL", "DE", "DT", "OLB", "LB", "CB", "S", "K", "P"];
PROGRAM_MILESTONES = [
  { id: "wins10", label: "10 Career Wins", check: (c) => (c.coach.careerWins || 0) >= 10 },
  { id: "wins25", label: "25 Career Wins", check: (c) => (c.coach.careerWins || 0) >= 25 },
  { id: "wins50", label: "50 Career Wins", check: (c) => (c.coach.careerWins || 0) >= 50 },
  { id: "wins100", label: "100 Career Wins", check: (c) => (c.coach.careerWins || 0) >= 100 },
  { id: "wins150", label: "150 Career Wins", check: (c) => (c.coach.careerWins || 0) >= 150 },
  { id: "wins200", label: "200 Career Wins", check: (c) => (c.coach.careerWins || 0) >= 200 },
  { id: "winningSeason", label: "First Winning Season", check: (c) => c.seasonWins > c.seasonLosses },
  { id: "confTitle", label: "First Conference Title", check: (c) => c.wasConfChamp },
  { id: "playoffBerth", label: "First Playoff Berth", check: (c) => c.madePlayoff },
  { id: "natty", label: "National Champions", check: (c) => c.wonNatty, repeat: true },
  { id: "perfect", label: "Perfect Season", check: (c) => c.seasonWins >= 10 && c.seasonLosses === 0, repeat: true }
];
WIN_MILESTONES = [[25, 5], [50, 8], [100, 12], [150, 15], [200, 20]];

export { awardCoachAxisXP, awardDevelopmentXP, collectWeeklyCandidates, computeMilestones, computeProgramMilestones, computeSeasonAwards, defScore, finalizeWeeklyAwards, offScore };
