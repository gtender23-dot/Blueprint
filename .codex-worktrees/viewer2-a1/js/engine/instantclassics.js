import { __objRest } from '../_spread.js';

function scoreTimeline(result) {
  const states = [];
  let lateClose = false;
  for (const drive of (result == null ? void 0 : result.drives) || []) {
    for (const play of drive.plays || []) {
      if (!Number.isFinite(play == null ? void 0 : play.scoreOff) || !Number.isFinite(play == null ? void 0 : play.scoreDef)) continue;
      const home = drive.possession === "away" ? play.scoreDef : play.scoreOff;
      const away = drive.possession === "away" ? play.scoreOff : play.scoreDef;
      const prev = states[states.length - 1];
      if (!prev || prev.home !== home || prev.away !== away) states.push({ home, away });
      if (play.half === 2 && Number(play.clock) <= 300 && Math.abs(home - away) <= 8 || play.half === 3) lateClose = true;
    }
  }
  const finalState = { home: Number(result == null ? void 0 : result.homeScore) || 0, away: Number(result == null ? void 0 : result.awayScore) || 0 };
  const last = states[states.length - 1];
  if (!last || last.home !== finalState.home || last.away !== finalState.away) states.push(finalState);
  return { states, lateClose };
}
function instantClassicScore(result) {
  if (!result || result.forfeit || !Number.isFinite(result.homeScore) || !Number.isFinite(result.awayScore)) return 0;
  const margin = Math.abs(result.homeScore - result.awayScore);
  const total = result.homeScore + result.awayScore;
  const { states, lateClose } = scoreTimeline(result);
  const overtime = (result.drives || []).some((d) => (d.plays || []).some((p) => (p == null ? void 0 : p.half) === 3));
  let leadChanges = 0, ties = 0, priorLeader = 0, maxHomeDeficit = 0, maxAwayDeficit = 0;
  for (const s of states) {
    const diff = s.home - s.away;
    const leader = Math.sign(diff);
    if (leader === 0) ties++;
    else {
      if (priorLeader && leader !== priorLeader) leadChanges++;
      priorLeader = leader;
    }
    maxHomeDeficit = Math.max(maxHomeDeficit, -diff);
    maxAwayDeficit = Math.max(maxAwayDeficit, diff);
  }
  const winnerComeback = result.homeScore > result.awayScore ? maxHomeDeficit : maxAwayDeficit;
  let score = 4;
  score += margin <= 1 ? 32 : margin <= 3 ? 27 : margin <= 7 ? 17 : margin <= 10 ? 8 : margin <= 14 ? 3 : 0;
  if (overtime) score += 24;
  if (lateClose) score += 12;
  score += Math.min(15, leadChanges * 5);
  score += Math.min(8, ties * 2);
  score += Math.min(15, Math.round(winnerComeback * 1.5));
  if (total >= 80) score += 9;
  else if (total >= 60) score += 6;
  else if (total >= 45) score += 3;
  return clamp5(Math.round(score), 0, 100);
}
function compactSchool(school) {
  if (!school) return null;
  const out = {};
  for (const key of ["id", "name", "nick", "abbr", "logo", "crestImg", "crestSeed", "colors", "division"]) {
    if (school[key] !== void 0) out[key] = cloneJson2(school[key]);
  }
  return out;
}
function compactReplayResult(result) {
  if (!result) return null;
  const replay = {};
  for (const key of [
    "homeScore",
    "awayScore",
    "winner",
    "homeStats",
    "awayStats",
    "homePlayerStats",
    "awayPlayerStats",
    "homeSnapCounts",
    "awaySnapCounts",
    "homeForm",
    "awayForm",
    "drives",
    "log",
    "playerNames",
    "qbInjuries",
    "forfeit"
  ]) if (result[key] !== void 0) replay[key] = cloneJson2(result[key]);
  replay.homeSchool = compactSchool(result.homeSchool);
  replay.awaySchool = compactSchool(result.awaySchool);
  return replay;
}
function classicMetadata(entry) {
  if (!entry) return null;
  const _a = entry, { result } = _a, meta = __objRest(_a, ["result"]);
  return cloneJson2(meta);
}
function archiveInstantClassic(state2, result, week) {
  const score = instantClassicScore(result);
  if (score < INSTANT_CLASSIC_MIN_SCORE) return null;
  const home = result.homeSchool, away = result.awaySchool;
  if (!(home == null ? void 0 : home.id) || !(away == null ? void 0 : away.id) || !(state2 == null ? void 0 : state2.playerSchoolId)) return null;
  const id = `ic-${state2.season}-${state2.day}-${home.id}-${away.id}`;
  const existing = Array.isArray(state2.instantClassics) ? state2.instantClassics : [];
  if (existing.some((c) => c.id === id)) return null;
  const entry = {
    id,
    score,
    saved: Date.now(),
    season: state2.season,
    day: state2.day,
    week: week || `Week ${state2.day}`,
    playerSchoolId: state2.playerSchoolId,
    homeId: home.id,
    awayId: away.id,
    homeName: home.name || "Home",
    awayName: away.name || "Away",
    homeScore: result.homeScore,
    awayScore: result.awayScore,
    result: compactReplayResult(result)
  };
  const ranked = [...existing, entry].sort((a, b) => (b.score || 0) - (a.score || 0) || (b.saved || 0) - (a.saved || 0)).slice(0, MAX_INSTANT_CLASSICS);
  state2.instantClassics = ranked;
  return ranked.some((c) => c.id === id) ? entry : null;
}
var INSTANT_CLASSIC_MIN_SCORE, MAX_INSTANT_CLASSICS, cloneJson2, clamp5;

INSTANT_CLASSIC_MIN_SCORE = 50;
MAX_INSTANT_CLASSICS = 8;
cloneJson2 = (value) => JSON.parse(JSON.stringify(value));
clamp5 = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export { archiveInstantClassic, classicMetadata };

// additional exports consumed by tools/ probes
export { INSTANT_CLASSIC_MIN_SCORE, MAX_INSTANT_CLASSICS, compactReplayResult, instantClassicScore };
