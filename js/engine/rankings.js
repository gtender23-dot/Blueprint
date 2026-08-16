import { __spreadProps, __spreadValues } from '../_spread.js';

function indexGames(schedule) {
  const byTeam = /* @__PURE__ */ new Map();
  const h2h = /* @__PURE__ */ new Map();
  for (const g of schedule || []) {
    if (!g.result || !g.result.winner) continue;
    const { homeId, awayId } = g;
    const { homeScore, awayScore, winner } = g.result;
    if (homeId == null || awayId == null) continue;
    const push = (id, oppId, won, margin2) => {
      if (!byTeam.has(id)) byTeam.set(id, []);
      byTeam.get(id).push({ oppId, won, margin: margin2 });
    };
    const margin = Math.abs((homeScore || 0) - (awayScore || 0));
    push(homeId, awayId, winner === homeId, margin);
    push(awayId, homeId, winner === awayId, margin);
    h2h.set(`${homeId}|${awayId}`, winner);
    h2h.set(`${awayId}|${homeId}`, winner);
  }
  return { byTeam, h2h };
}
function opponentStrength(school, winPctOf) {
  var _a;
  const ceil = PRESTIGE_CEIL[school.division] || 5;
  const prestigeNorm = Math.max(0, Math.min(1, (school.prestige || 1) / ceil));
  const wp = (_a = winPctOf.get(school.id)) != null ? _a : 0.5;
  return 0.6 * wp + 0.4 * prestigeNorm;
}
function winPctFromRecord(s) {
  var _a, _b;
  const w = ((_a = s == null ? void 0 : s.record) == null ? void 0 : _a.wins) || 0;
  const l = ((_b = s == null ? void 0 : s.record) == null ? void 0 : _b.losses) || 0;
  return w + l > 0 ? w / (w + l) : 0.5;
}
function computeSOS(schools, schedule) {
  const byId = new Map((schools || []).map((s) => [s.id, s]));
  const { byTeam } = indexGames(schedule);
  const winPctOf = /* @__PURE__ */ new Map();
  for (const s of schools || []) winPctOf.set(s.id, winPctFromRecord(s));
  const sosOf = /* @__PURE__ */ new Map();
  for (const s of schools || []) {
    const myGames = byTeam.get(s.id) || [];
    if (!myGames.length) {
      sosOf.set(s.id, 0);
      continue;
    }
    let oppSum = 0, oppCount = 0;
    let ooSum = 0, ooCount = 0;
    for (const g of myGames) {
      const opp = byId.get(g.oppId);
      if (opp == null) continue;
      oppSum += winPctOf.has(opp.id) ? winPctOf.get(opp.id) : winPctFromRecord(opp);
      oppCount++;
      const oppGames = byTeam.get(opp.id) || [];
      for (const og of oppGames) {
        if (og.oppId === s.id) continue;
        const oo = byId.get(og.oppId);
        if (oo == null) continue;
        ooSum += winPctOf.has(oo.id) ? winPctOf.get(oo.id) : winPctFromRecord(oo);
        ooCount++;
      }
    }
    const owp = oppCount > 0 ? oppSum / oppCount : 0.5;
    const oowp = ooCount > 0 ? ooSum / ooCount : 0.5;
    sosOf.set(s.id, 2 / 3 * owp + 1 / 3 * oowp);
  }
  return sosOf;
}
function computeDivisionPoll(schools, schedule, division) {
  var _a, _b;
  const pool = schools.filter((s) => s.division === division);
  if (!pool.length) return [];
  const { byTeam, h2h } = indexGames(schedule);
  const byId = new Map(pool.map((s) => [s.id, s]));
  const winPctOf = /* @__PURE__ */ new Map();
  for (const s of pool) {
    const w = ((_a = s.record) == null ? void 0 : _a.wins) || 0, l = ((_b = s.record) == null ? void 0 : _b.losses) || 0;
    winPctOf.set(s.id, w + l > 0 ? w / (w + l) : 0.5);
  }
  const sosOf = computeSOS(schools, schedule);
  const ceil = PRESTIGE_CEIL[division] || 5;
  const scored = pool.map((s) => {
    var _a2, _b2;
    const wins = ((_a2 = s.record) == null ? void 0 : _a2.wins) || 0;
    const losses = ((_b2 = s.record) == null ? void 0 : _b2.losses) || 0;
    const games = wins + losses;
    const winPct = games > 0 ? wins / games : 0;
    let resume = 0;
    const myGames = byTeam.get(s.id) || [];
    for (const g of myGames) {
      const opp = byId.get(g.oppId);
      if (!opp) continue;
      const oppStr = opponentStrength(opp, winPctOf);
      const marginBonus = Math.min(g.margin, MARGIN_CAP) / MARGIN_CAP * 0.15;
      if (g.won) {
        resume += 0.5 + oppStr + marginBonus;
      } else {
        resume -= 0.5 + (1 - oppStr) - marginBonus * 0.5;
      }
    }
    const resumePer = games > 0 ? resume / games : 0;
    const prestigeNorm = Math.max(0, Math.min(1, (s.prestige || 1) / ceil));
    const priorWeight = Math.max(0, 1 - games / PRIOR_DECAY_GAMES);
    const sos = sosOf.get(s.id) || 0;
    const sosBonus = games > 0 ? (sos - 0.5) * 0.3 : 0;
    const score = winPct * 1 * (1 - priorWeight * 0.5) + resumePer * 0.85 + prestigeNorm * priorWeight * 0.9 + prestigeNorm * 0.05 + sosBonus;
    return { school: s, score, wins, losses, resume: resumePer, winPct, sos };
  });
  scored.sort(
    (a, b) => b.score - a.score || b.winPct - a.winPct || (b.sos || 0) - (a.sos || 0) || a.losses - b.losses || (b.school.prestige || 0) - (a.school.prestige || 0)
  );
  for (let i = 0; i < scored.length - 1; i++) {
    const A = scored[i], B = scored[i + 1];
    if (A.score - B.score > 0.08) continue;
    const w = h2h.get(`${A.school.id}|${B.school.id}`);
    if (w && w === B.school.id) {
      scored[i] = B;
      scored[i + 1] = A;
    }
  }
  return scored.map((e, i) => __spreadProps(__spreadValues({}, e), { rank: i + 1 }));
}
// Item 28 — recruiting class rankings. Within a division, score each program's
// signed class 247-style: Σ visionRating^2.5 rewards a few elite over many
// average, plus a small per-signee size term so a big solid class still counts.
// visionRating in the log is 1–99 (the log's `star` field). Scaled by /1000 for
// a readable "class points" number; the scaling is monotone so it never changes
// the order — display only.
var CLASS_SIZE_TERM = 1.5;
function computeClassRankings(schools, signingsLog, division, season) {
  const pool = (schools || []).filter((s) => s.division === division);
  if (!pool.length) return [];
  const byId = new Map(pool.map((s) => [s.id, s]));
  const agg = /* @__PURE__ */ new Map();
  for (const sg of signingsLog || []) {
    if (sg.season !== season) continue;
    if (!byId.has(sg.schoolId)) continue;
    const vr = Math.max(1, Math.min(99, sg.star || 0));
    let a = agg.get(sg.schoolId);
    if (!a) agg.set(sg.schoolId, a = { sum: 0, size: 0, starSum: 0, top: 0 });
    a.sum += Math.pow(vr, 2.5) / 1e3;
    a.size += 1;
    a.starSum += vr;
    if (vr > a.top) a.top = vr;
  }
  const scored = pool.map((s) => {
    const a = agg.get(s.id) || { sum: 0, size: 0, starSum: 0, top: 0 };
    const score = a.sum + a.size * CLASS_SIZE_TERM;
    return {
      school: s,
      score,
      size: a.size,
      avgStar: a.size ? a.starSum / a.size / 20 : 0,
      topStar: a.top / 20
    };
  });
  scored.sort(
    (a, b) => b.score - a.score || b.size - a.size || (b.school.prestige || 0) - (a.school.prestige || 0)
  );
  return scored.map((e, i) => __spreadProps(__spreadValues({}, e), { rank: i + 1 }));
}
function classRankOf(schools, signingsLog, schoolId, season) {
  const school = (schools || []).find((s) => s.id === schoolId);
  if (!school) return null;
  const list = computeClassRankings(schools, signingsLog, school.division, season);
  const e = list.find((x) => x.school.id === schoolId);
  return e ? { rank: e.rank, of: list.length, score: e.score, size: e.size, avgStar: e.avgStar } : null;
}
function rankMap(state2, division, topN = 25) {
  var _a;
  const poll = computeDivisionPoll(((_a = state2.world) == null ? void 0 : _a.schools) || [], state2.schedule || [], division);
  const m = /* @__PURE__ */ new Map();
  for (const e of poll) {
    if (e.rank > topN) break;
    m.set(e.school.id, e.rank);
  }
  return m;
}
var MARGIN_CAP, PRIOR_DECAY_GAMES, PRESTIGE_CEIL;

MARGIN_CAP = 21;
PRIOR_DECAY_GAMES = 8;
PRESTIGE_CEIL = { D1: 6, D2: 4, D3: 3 };

export { classRankOf, computeClassRankings, computeDivisionPoll, computeSOS, rankMap };
