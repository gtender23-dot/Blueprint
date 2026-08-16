import { __spreadProps, __spreadValues } from '../_spread.js';
import { C } from '../constants.js';

function baseWeight(p) {
  let w = 0;
  const yds = p.yards || 0;
  if (p.td) w += 26;
  if (p.turnover) w += 48;
  if (p.breakaway) w += 34;
  if (p.batted) w += 24;
  if (p.contested) w += 18;
  if (p.rpo) w += 12;
  if (p.sack) w += 14;
  if (p.returnTD) w += 55;
  if (p.type === "fg" && p.made && (p.fgDist || 0) >= 45) w += 28;
  w += Math.max(0, yds) * 1.15;
  if (p.down === 4 && yds >= (p.distance || 10)) w += 30;
  if (p.down === 3 && yds >= (p.distance || 10) && (p.distance || 0) >= 7) w += 10;
  return w;
}
function leverage(p) {
  var _a, _b, _c;
  const half = p.half || 1;
  const margin = Math.abs(((_a = p.scoreOff) != null ? _a : 0) - ((_b = p.scoreDef) != null ? _b : 0));
  const secs = (_c = p.clock) != null ? _c : C.HALF_SECONDS;
  const late = half >= 2 ? clamp01(1 - secs / C.HALF_SECONDS) : 0;
  const timeMult = 1 + late * 1.6;
  const closeMult = margin <= 8 ? 1.5 : margin <= 16 ? 1 : margin <= 24 ? 0.55 : 0.3;
  return timeMult * closeMult;
}
var clamp01 = (v) => Math.max(0, Math.min(1, v));
function nameLookup(result) {
  const names = result.playerNames || {};
  return (id) => {
    const e = id && names[id];
    if (!e) return null;
    return typeof e === "string" ? e : e.name || null;
  };
}
function quarterOf(p) {
  var _a;
  const half = p.half || 1;
  if (half >= 3) return 5;
  const secs = (_a = p.clock) != null ? _a : C.HALF_SECONDS;
  const firstOfHalf = secs > C.HALF_SECONDS / 2;
  return half === 1 ? firstOfHalf ? 1 : 2 : firstOfHalf ? 3 : 4;
}
function quarterSecsLeft(p) {
  var _a;
  const secs = Math.max(0, ((_a = p.clock) != null ? _a : C.HALF_SECONDS) | 0);
  if ((p.half || 1) >= 3) return secs;
  const qtr = C.HALF_SECONDS / 2;
  return secs > qtr ? secs - qtr : secs;
}
function quarterClock(p) {
  const left = quarterSecsLeft(p);
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
}
function chronoKey(row) {
  var _a;
  return (row.q || 1) * 1e5 - ((_a = row.qsec) != null ? _a : 0);
}
function describe(p, nameOf, offName) {
  var _a;
  const n = (id) => nameOf(id) || null;
  const yds = p.yards || 0;
  const scored = p.td ? " \u2014 TOUCHDOWN" : "";
  const carrier = p.rusherId || p.receiverId || p.brokenByCarrier || null;
  if (p.returnTD && n(p.returnerId)) return `${n(p.returnerId)} takes the return ${p.returnYds || yds} yards to the house.`;
  if (p.batted) {
    const who = p.battedByName || n(p.battedById);
    if (!who) return null;
    return p.turnover ? `${who} bats it at the line \u2014 and it's picked off.` : `${who} gets a hand up and swats it down at the line.`;
  }
  if (p.turnover && p.turnoverType === "interception") {
    const pick2 = n(p.intPickerId || p.intById), thrower = n(p.throwerId);
    if (!pick2) return null;
    if (p.tipDrill) {
      const tipper = n(p.pbuId);
      return tipper ? `${tipper} tips it up and ${pick2} snatches the carom out of the air.` : `${pick2} pulls a tipped ball out of the air.`;
    }
    return thrower ? `${pick2} reads ${thrower} and takes it away.` : `${pick2} picks it off.`;
  }
  if (p.turnover && p.turnoverType === "fumble") {
    const forcer = n(p.ffId);
    const lost = n(carrier);
    if (!lost && p.sack && n(p.throwerId)) {
      return forcer ? `${forcer} strips ${n(p.throwerId)} in the pocket \u2014 ball's loose.` : `${n(p.throwerId)} is stripped in the pocket.`;
    }
    if (!lost) return forcer ? `${forcer} punches it out \u2014 ${offName} lose the football.` : null;
    if (forcer && forcer !== lost) return `${lost} coughs it up \u2014 ${forcer} forced it out.`;
    return `${lost} puts it on the ground and ${offName} lose it.`;
  }
  if (p.type === "fg" && p.made && n(p.kickerId)) return `${n(p.kickerId)} drills it from ${p.fgDist}.`;
  if (p.breakaway && n(p.rusherId)) {
    if (yds >= 40) return `${n(p.rusherId)} breaks contain and he is GONE \u2014 ${yds} yards${scored}.`;
    if (yds >= 20) return `${n(p.rusherId)} bounces it outside and turns on the jets for ${yds}${scored}.`;
    return `${n(p.rusherId)} finds a crease for ${yds}${scored}.`;
  }
  if (p.contested) {
    if (p.complete && n(p.receiverId)) return `${n(p.receiverId)} goes up and rips it away for ${yds}${scored}.`;
    if (!p.complete && n(p.targetId)) return `${n(p.targetId)} is blanketed on the jump ball \u2014 broken up.`;
    return null;
  }
  if (p.sack && n(p.sackerId) && n(p.throwerId)) return `${n(p.sackerId)} gets home \u2014 ${n(p.throwerId)} down for ${Math.abs(yds)}.`;
  if (p.rpo && n(p.throwerId) && n(p.receiverId)) return `${n(p.throwerId)} pulls it at the mesh and hits ${n(p.receiverId)} for ${yds}${scored}.`;
  if ((p.isQBDesignedRun || p.isScramble) && n(p.rusherId)) return `${n(p.rusherId)} escapes the pocket for ${yds}${scored}.`;
  if (((_a = p.type) == null ? void 0 : _a.startsWith("run")) && n(p.rusherId)) {
    const action = yds >= 15 ? "bursts into the second level" : yds >= 7 ? "slashes through traffic" : yds >= 3 ? "powers ahead" : "fights for every inch";
    return `${n(p.rusherId)} ${action} for ${yds} yard${Math.abs(yds) === 1 ? "" : "s"}${scored}.`;
  }
  if (p.complete && n(p.throwerId) && n(p.receiverId)) return `${n(p.throwerId)} finds ${n(p.receiverId)} for ${yds}${scored}.`;
  return null;
}
function gameHighlight(result, homeSchool, awaySchool) {
  var _a, _b, _c;
  if (!((_a = result == null ? void 0 : result.drives) == null ? void 0 : _a.length)) return null;
  const nameOf = nameLookup(result);
  let best = null, bestScore = 0, bestSide = null;
  for (let di = 0; di < result.drives.length; di++) {
    const d = result.drives[di];
    const plays = d.plays || [];
    for (let pi = 0; pi < plays.length; pi++) {
      const p = plays[pi];
      const base = baseWeight(p);
      if (base <= 0) continue;
      const score = base * leverage(p);
      if (score <= bestScore) continue;
      const side = d.possession === "home" ? "home" : "away";
      const off = side === "home" ? homeSchool : awaySchool;
      if (!describe(p, nameOf, (off == null ? void 0 : off.name) || "The offense")) continue;
      bestScore = score;
      best = p;
      bestSide = side;
    }
  }
  if (!best || bestScore < 30) return null;
  const offSchool = bestSide === "home" ? homeSchool : awaySchool;
  return {
    q: quarterOf(best),
    clock: quarterClock(best),
    side: bestSide,
    school: (offSchool == null ? void 0 : offSchool.name) || "",
    text: describe(best, nameOf, (offSchool == null ? void 0 : offSchool.name) || "The offense"),
    score: `${(_b = best.scoreOff) != null ? _b : 0}\u2013${(_c = best.scoreDef) != null ? _c : 0}`,
    weight: Math.round(bestScore),
    // Flags the UI can style on.
    td: !!best.td,
    turnover: !!best.turnover,
    breakaway: !!best.breakaway
  };
}
function gameHighlights(result, homeSchool, awaySchool, n = 3) {
  var _a, _b, _c;
  if (!((_a = result == null ? void 0 : result.drives) == null ? void 0 : _a.length)) return [];
  const nameOf = nameLookup(result);
  const rows = [];
  for (let di = 0; di < result.drives.length; di++) {
    const d = result.drives[di];
    const plays = d.plays || [];
    for (let pi = 0; pi < plays.length; pi++) {
      const p = plays[pi];
      const base = baseWeight(p);
      if (base <= 0) continue;
      const side = d.possession === "home" ? "home" : "away";
      const offSchool = side === "home" ? homeSchool : awaySchool;
      const text = describe(p, nameOf, (offSchool == null ? void 0 : offSchool.name) || "The offense");
      if (!text) continue;
      rows.push({
        q: quarterOf(p),
        clock: quarterClock(p),
        qsec: quarterSecsLeft(p),
        side,
        school: (offSchool == null ? void 0 : offSchool.name) || "",
        text,
        score: `${(_b = p.scoreOff) != null ? _b : 0}\u2013${(_c = p.scoreDef) != null ? _c : 0}`,
        weight: base * leverage(p),
        td: !!p.td,
        turnover: !!p.turnover,
        breakaway: !!p.breakaway,
        driveIndex: di,
        playIndex: pi
      });
    }
  }
  return rows.sort((a, b) => b.weight - a.weight).slice(0, n).sort((a, b) => chronoKey(a) - chronoKey(b)).map((r) => __spreadProps(__spreadValues({}, r), { weight: Math.round(r.weight) }));
}

function linescore(result) {
  var _a, _b, _c;
  const cells = [1, 2, 3, 4, 5].map((q) => ({ q, home: 0, away: 0 }));
  let ph = 0, pa = 0, lastQ = 0;
  for (const d of ((_a = result == null ? void 0 : result.drives) != null ? _a : [])) {
    for (const p of d.plays || []) {
      if (!Number.isFinite(p == null ? void 0 : p.scoreOff) || !Number.isFinite(p == null ? void 0 : p.scoreDef)) continue;
      const home = d.possession === "away" ? p.scoreDef : p.scoreOff;
      const away = d.possession === "away" ? p.scoreOff : p.scoreDef;
      const qi = Math.min(5, Math.max(1, quarterOf(p)));
      lastQ = Math.max(lastQ, qi);
      if (home === ph && away === pa) continue;
      cells[qi - 1].home += home - ph;
      cells[qi - 1].away += away - pa;
      ph = home;
      pa = away;
    }
  }
  const fh = Math.max(0, ((_b = result == null ? void 0 : result.homeScore) != null ? _b : 0) | 0);
  const fa = Math.max(0, ((_c = result == null ? void 0 : result.awayScore) != null ? _c : 0) | 0);
  if (ph !== fh || pa !== fa) {
    const tail = cells[Math.max(1, lastQ) - 1];
    tail.home += fh - ph;
    tail.away += fa - pa;
  }
  const hadOT = cells[4].home !== 0 || cells[4].away !== 0 || lastQ >= 5;
  const rows = hadOT ? cells : cells.slice(0, 4);
  const sumH = rows.reduce((s, c) => s + c.home, 0);
  const sumA = rows.reduce((s, c) => s + c.away, 0);
  // A linescore that does not add up to the final is worse than no linescore.
  if (sumH !== fh || sumA !== fa) return null;
  return { cells: rows, homeTotal: fh, awayTotal: fa, hadOT };
}

export { gameHighlight, gameHighlights, linescore };
