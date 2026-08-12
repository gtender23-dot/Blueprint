import { C, schemeStarterOverride } from '../constants.js';
import { clamp2, distanceMiles } from '../utils.js';

// Scheme-aware starters (Aug 2026): when a school's defensive identity is a
// sub package — the front hard-picked on the gameplan, or Nickel set as the
// BASE front (the real-life nickel-base blend) — that front's real count wins
// at the defensive positions it changes (a Nickel program starts ONE OLB and
// THREE corners); everywhere else the portal keeps its own STARTERS table. AI
// schools only ever base 4-3/3-4 on auto, so this resolves to STARTERS for
// them — the league-wide portal economy is untouched.
function startersAt(school, pos) {
  const ovr = schemeStarterOverride(school, pos);
  return ovr != null ? ovr : STARTERS[pos] || 1;
}

// PASS 7 (Fix D): the morale bucket → leave-probability multiplier. Reads the
// value tickMorale maintains off real snap usage; `__noMorale` (or a pre-pass
// save with no morale field) = neutral 1.
function moraleMult(p) {
  if (globalThis.__noMorale) return 1;
  const m = p == null ? void 0 : p.morale;
  if (m == null) return 1;
  const P7 = C.PASS7;
  return m < P7.moraleLowBar ? P7.moraleLowMult : m < P7.moraleMidBar ? P7.moraleMidMult : m > P7.moraleHighBar ? P7.moraleHighMult : 1;
}
function caliberTier(player) {
  const r = (player == null ? void 0 : player.compositeRating) || 0;
  return r >= C.PORTAL_TIER_HI ? 3 : r >= C.PORTAL_TIER_MID ? 2 : 1;
}
function schoolTier(division) {
  var _a;
  return (_a = TIER_OF_DIV[division]) != null ? _a : 1;
}
function canSchoolSign(school, player) {
  return caliberTier(player) <= schoolTier(school == null ? void 0 : school.division) + 1;
}
function pitchCost(player) {
  const rating = player.compositeRating || 0;
  const bounds = [C.PORTAL_MIN_RATING];
  const rates = [C.PORTAL_PITCH_COST_PER_PT];
  for (const t of C.PORTAL_PITCH_TIERS || []) {
    bounds.push(t.over);
    rates.push(t.per);
  }
  bounds.push(Infinity);
  let cost = C.PORTAL_PITCH_COST_BASE;
  for (let i = 0; i < rates.length; i++) {
    const lo = bounds[i], hi = bounds[i + 1];
    const pts = Math.max(0, Math.min(rating, hi) - lo);
    cost += pts * rates[i];
  }
  return Math.round(cost / 50) * 50;
}
function scholarshipValue(division) {
  var _a;
  return ((_a = C.SCHOLARSHIP_VALUE) == null ? void 0 : _a[division]) || C.BUDGET_PER_SCHOLARSHIP || 3e3;
}
function schoolStars(school) {
  var _a;
  const cap = ((_a = C.PRESTIGE_MAX) == null ? void 0 : _a[school == null ? void 0 : school.division]) || 6;
  return Math.max(1, Math.min(cap, Math.round((school == null ? void 0 : school.prestige) || 1)));
}
function scheduleGuarantee(mySchool, oppSchool) {
  if (!mySchool || !oppSchool) return 0;
  const gap = schoolStars(oppSchool) - schoolStars(mySchool);
  return gap * scholarshipValue(mySchool.division);
}
function rivalryReward(division) {
  return Math.round(scholarshipValue(division) * (C.RIVALRY_REWARD_SCHOLARSHIPS || 1.5));
}
function depthRankAtPos(school, player) {
  const peers = school.roster.filter((p) => p.position === player.position).sort((a, b) => (b.compositeRating || 0) - (a.compositeRating || 0));
  return peers.findIndex((p) => p.id === player.id);
}
function roleFor(school, player) {
  const better = ((school == null ? void 0 : school.roster) || []).filter((p) => p.position === player.position && (p.compositeRating || 0) > (player.compositeRating || 0)).length;
  const starters = startersAt(school, player.position);
  if (better === 0) return { role: "starter", score: C.PORTAL_ROLE_STARTER };
  if (better < starters) return { role: "rotation", score: C.PORTAL_ROLE_ROTATION };
  return { role: "buried", score: C.PORTAL_ROLE_BURIED };
}
function projectedPeak(player) {
  const band = player.potentialBand || "average";
  const spread = C.POTENTIAL_BAND && C.POTENTIAL_BAND[band] || 15;
  const yr = player.classYear || "FR";
  const grow = yr === "FR" ? 0.45 : yr === "SO" ? 0.32 : yr === "JR" ? 0.18 : 0.06;
  return (player.compositeRating || 0) + spread * grow;
}
function projectedPathToPlay(recruit, school) {
  const roster = (school == null ? void 0 : school.roster) || [];
  const pos = recruit.position;
  const starters = startersAt(school, pos);
  const myPeak = projectedPeak(recruit);
  const aheadReturning = roster.filter(
    (p) => p.position === pos && p.classYear !== "SR" && projectedPeak(p) > myPeak
  ).length;
  let tier, score, label;
  if (aheadReturning === 0) {
    tier = "starter";
    score = 100;
    label = "Immediate starter";
  } else if (aheadReturning < starters) {
    tier = "rotation";
    score = 70;
    label = "Early playing time";
  } else if (aheadReturning < starters + 2) {
    tier = "developmental";
    score = 40;
    label = "A year or two away";
  } else {
    tier = "logjam";
    score = 12;
    label = "Buried in a logjam";
  }
  return { tier, score, label, aheadReturning, starters };
}
function distComfortW(school, entry) {
  var _a, _b;
  const dist = distanceMiles(school.lat, school.lng, (_a = entry._fromLat) != null ? _a : school.lat, (_b = entry._fromLng) != null ? _b : school.lng);
  return dist < 300 ? C.PORTAL_W_DIST : dist < 800 ? C.PORTAL_W_DIST / 2 : 0;
}
function adjustedOffer(school, entry, money) {
  return roleFor(school, entry.player).score + (school.prestige || 1) * C.PORTAL_W_PRESTIGE + distComfortW(school, entry) + C.PORTAL_W_MONEY * Math.sqrt(Math.max(0, money || 0));
}
function aiValuation(school, entry) {
  const role = roleFor(school, entry.player).role;
  if (role === "buried") return 0;
  const roleMult = role === "starter" ? 1 : 0.45;
  const over = Math.max(0, (entry.player.compositeRating || 0) - C.PORTAL_MIN_RATING);
  return (C.PORTAL_AI_VAL_BASE + over * C.PORTAL_AI_VAL_PER_PT) * roleMult;
}
function frontRunner(state2, entry) {
  const byId = new Map(state2.world.schools.map((s) => [s.id, s]));
  let best = null, bestAdj = -Infinity;
  for (const b of entry.suitors || []) {
    const s = byId.get(b.schoolId);
    if (!s) continue;
    const adj = adjustedOffer(s, entry, b.money);
    if (adj > bestAdj) {
      bestAdj = adj;
      best = { schoolId: b.schoolId, name: s.name, isPlayer: b.schoolId === state2.playerSchoolId, adj };
    }
  }
  return best;
}
function needScore(school, player) {
  const rank = school.roster.filter((p) => p.position === player.position).filter((p) => (p.compositeRating || 0) > (player.compositeRating || 0)).length;
  const starters = startersAt(school, player.position);
  if (rank < starters) return 1;
  if (rank < starters + 1) return 0.5;
  return 0.1;
}
function buildTransferPortal(state2) {
  var _a, _b, _c, _d, _e;
  if (state2.portal && state2.portal.season === state2.season) return state2.portal;
  const portal = {
    season: state2.season,
    round: 1,
    maxRounds: C.PORTAL_ROUNDS,
    players: [],
    resolved: false,
    signings: []
  };
  const perDiv = { D1: 0, D2: 0, D3: 0 };
  for (const school of state2.world.schools) {
    if (school.id === state2.playerSchoolId) continue;
    const coachLeft = ((_a = school._lastVacancy) == null ? void 0 : _a.season) === state2.season;
    const collapsing = ((_c = (_b = school.record) == null ? void 0 : _b.wins) != null ? _c : 99) <= C.PORTAL_COLLAPSE_WINS;
    const leavers = [];
    for (const p of school.roster) {
      if (p.classYear === "SR") continue;
      if ((p.compositeRating || 0) < C.PORTAL_MIN_RATING) continue;
      if (p.redshirted && p.redshirtYear === state2.season) continue;
      if (perDiv[school.division] >= C.PORTAL_CAP_PER_DIV) break;
      const buried = depthRankAtPos(school, p) >= C.PORTAL_BURIED_DEPTH;
      // PASS 7 (Fix D): portal pressure rides real usage. A season of low
      // morale (ticked off actual snap share) opens the door even when the
      // depth chart looks respectable, and scales every leave probability \u2014
      // content players stay put. `__noMorale` = legacy byte-for-byte.
      const unhappy = !globalThis.__noMorale && p.morale != null && p.morale < C.PASS7.moraleLowBar;
      let prob = 0;
      if (buried) prob = Math.max(prob, C.PORTAL_BURIED_PROB);
      if (unhappy) prob = Math.max(prob, C.PORTAL_BURIED_PROB);
      if (coachLeft) prob = Math.max(prob, C.PORTAL_COACH_LEFT_PROB);
      if (collapsing) prob = Math.max(prob, C.PORTAL_COLLAPSE_PROB);
      prob *= moraleMult(p);
      if (prob > 0 && Math.random() < Math.min(0.95, prob)) {
        leavers.push({ p, buried, unhappy });
        perDiv[school.division]++;
      }
    }
    for (const { p, buried, unhappy } of leavers) {
      school.roster = school.roster.filter((x) => x.id !== p.id);
      const reason = coachLeft ? "coach left" : collapsing ? "program collapsing" : buried ? "buried \u2014 wants to play" : unhappy ? "unhappy with his role" : "seeking a fresh start";
      portal.players.push({
        player: p,
        fromSchoolId: school.id,
        fromSchoolName: school.name,
        fromDivision: school.division,
        reason,
        caliberTier: caliberTier(p),
        _fromLat: school.lat,
        _fromLng: school.lng,
        suitors: [],
        signedTo: null
      });
    }
  }
  const mySchool = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  if (mySchool && mySchool.roster) {
    const eligible = [];
    for (const p of mySchool.roster) {
      if (p.classYear !== "JR" && p.classYear !== "SR") continue;
      if ((p.compositeRating || 0) < C.PLAYER_ATTRITION_MIN_RATING) continue;
      if (p.redshirted && p.redshirtYear === state2.season) continue;
      const aheadReturning = mySchool.roster.filter((x) => x.position === p.position && x.id !== p.id && (x.compositeRating || 0) > (p.compositeRating || 0) && (p.classYear === "SR" || x.classYear !== "SR")).length;
      // Scheme-aware gate (Aug 2026): every starting spot the coach's chosen
      // front removes at this position lowers the "how deep before you're
      // buried" bar by one — the No. 2 OLB in an every-snap Nickel program is
      // an upperclassman who never plays, and he acts like it. Flat-front
      // schools keep the old bar exactly.
      const schemeCut = Math.max(0, (STARTERS[p.position] || 1) - startersAt(mySchool, p.position));
      const buriedBar = Math.max(1, C.PLAYER_ATTRITION_DEPTH - schemeCut);
      if (aheadReturning < buriedBar) continue;
      p._attritionAhead = aheadReturning;
      eligible.push(p);
    }
    eligible.sort((a, b) => (b.compositeRating || 0) - (a.compositeRating || 0));
    const leaving = [];
    for (const p of eligible) {
      if (leaving.length >= C.PLAYER_ATTRITION_MAX_PER_YEAR) break;
      const starters = startersAt(mySchool, p.position);
      const bar = Math.max(1, C.PLAYER_ATTRITION_DEPTH - Math.max(0, (STARTERS[p.position] || 1) - starters));
      const depthOver = (p._attritionAhead || 0) - Math.max(bar, starters) + 1;
      const buriedMult = clamp2(1 + Math.max(0, depthOver) * C.PLAYER_ATTRITION_BURIED_STEP, 1, C.PLAYER_ATTRITION_BURIED_MAX);
      delete p._attritionAhead;
      // PASS 7 (Fix D): the player-school attrition roll scales by morale too
      // — a buried upperclassman who actually PLAYED (rotation snaps kept his
      // morale up) is likelier to stay than the one the rotation never used.
      if (Math.random() < C.PLAYER_ATTRITION_PROB * buriedMult * moraleMult(p)) leaving.push(p);
    }
    for (const p of leaving) {
      mySchool.roster = mySchool.roster.filter((x) => x.id !== p.id);
      portal.players.push({
        player: p,
        fromSchoolId: mySchool.id,
        fromSchoolName: mySchool.name,
        fromDivision: mySchool.division,
        reason: "buried \u2014 wants to play",
        caliberTier: caliberTier(p),
        _fromLat: mySchool.lat,
        _fromLng: mySchool.lng,
        fromPlayer: true,
        suitors: [],
        signedTo: null
      });
      (_e = (_d = state2.inbox) == null ? void 0 : _d.push) == null ? void 0 : _e.call(_d, {
        id: `attrition_${p.id}`,
        day: state2.day,
        subject: "\u{1F6AA} Transfer Portal Departure",
        body: `${p.name.first} ${p.name.last} (${p.position}, ${p.classYear}, ${Math.round(p.compositeRating || 0)} OVR) has entered the transfer portal \u2014 buried on the depth chart, he's looking for playing time elsewhere.`,
        read: false
      });
    }
  }
  portal.players.sort((a, b) => (b.player.compositeRating || 0) - (a.player.compositeRating || 0));
  state2.portal = portal;
  return portal;
}
function aiPortalPursuits(state2) {
  const portal = state2.portal;
  if (!portal || portal.resolved) return;
  for (const school of state2.world.schools) {
    if (school.id === state2.playerSchoolId) continue;
    const coach = school.coach;
    if (!coach || (coach.budget || 0) < C.PORTAL_PITCH_COST_BASE) continue;
    const targets = portal.players.filter((e) => !e.signedTo && e.fromSchoolId !== school.id && canSchoolSign(school, e.player) && roleFor(school, e.player).role !== "buried" && !e.suitors.some((b) => b.schoolId === school.id)).map((e) => ({ e, v: aiValuation(school, e) })).sort((a, b) => b.v - a.v).slice(0, C.PORTAL_AI_MAX_SIGNINGS);
    for (const { e } of targets) {
      const cost = pitchCost(e.player);
      if ((coach.budget || 0) < cost) continue;
      coach.budget -= cost;
      e.suitors.push({ schoolId: school.id, division: school.division, money: cost, isPlayer: false });
    }
  }
}
function aiPortalReact(state2) {
  const portal = state2.portal;
  for (const school of state2.world.schools) {
    if (school.id === state2.playerSchoolId) continue;
    const coach = school.coach;
    if (!coach) continue;
    const targets = portal.players.filter((e) => !e.signedTo && e.fromSchoolId !== school.id && canSchoolSign(school, e.player) && roleFor(school, e.player).role !== "buried").map((e) => ({ e, v: aiValuation(school, e) })).sort((a, b) => b.v - a.v).slice(0, C.PORTAL_AI_MAX_SIGNINGS + 1);
    for (const { e, v } of targets) {
      const top = frontRunner(state2, e);
      if (top && top.schoolId === school.id) continue;
      const myBid = e.suitors.find((b) => b.schoolId === school.id);
      const myMoney = (myBid == null ? void 0 : myBid.money) || 0;
      if (myMoney >= v) continue;
      if ((coach.budget || 0) < C.PORTAL_RAISE_STEP) continue;
      coach.budget -= C.PORTAL_RAISE_STEP;
      if (myBid) myBid.money += C.PORTAL_RAISE_STEP;
      else e.suitors.push({ schoolId: school.id, division: school.division, money: C.PORTAL_RAISE_STEP, isPlayer: false });
    }
  }
}
function portalScholarshipRoom(state2) {
  var _a, _b;
  const avail = ((_a = state2.playerCoach) == null ? void 0 : _a.scholarshipsAvailable) || 0;
  const inFlight = (((_b = state2.portal) == null ? void 0 : _b.players) || []).filter((e) => !e.signedTo && (e.suitors || []).some((b) => b.schoolId === state2.playerSchoolId)).length;
  return Math.max(0, avail - inFlight);
}
// Returns false when the player's program has no scholarship left to spend, so
// callers can refuse the signing instead of taking a man for free. (The old
// clamp at 0 silently gifted a transfer whenever a recruiting offer consumed the
// last slot after a portal pitch was already open.)
function chargeScholarship(state2, schoolId) {
  if (schoolId !== state2.playerSchoolId) return true;
  const coach = state2.playerCoach;
  if (!coach) return true;
  const have = coach.scholarshipsAvailable || 0;
  if (have <= 0) return false;
  coach.scholarshipsAvailable = have - 1;
  return true;
}
function commitEntry(state2, entry, school, events) {
  school.roster.push(entry.player);
  entry.signedTo = school.id;
  entry.signedToName = school.name;
  chargeScholarship(state2, school.id);
  state2.portal.signings.push({ playerId: entry.player.id, toSchoolId: school.id });
  const mineChasing = entry.suitors.some((b) => b.schoolId === state2.playerSchoolId);
  if (!events) return;
  const nm = `${entry.player.name.first} ${entry.player.name.last} (${entry.player.position})`;
  if (school.id === state2.playerSchoolId) events.push({ type: "info", text: `\u{1F504} ${nm} commits to YOU \u2014 locked in early.` });
  else if (mineChasing) events.push({ type: "info", text: `You lost ${nm} \u2014 he committed to ${school.name}.` });
}
function checkPortalCommits(state2, events) {
  const portal = state2.portal;
  const byId = new Map(state2.world.schools.map((s) => [s.id, s]));
  for (const e of portal.players) {
    if (e.signedTo || (e.suitors || []).length === 0) continue;
    const ranked = e.suitors.map((b) => {
      const s = byId.get(b.schoolId);
      return s ? { s, adj: adjustedOffer(s, e, b.money) } : null;
    }).filter(Boolean).sort((a, b) => b.adj - a.adj);
    if (!ranked.length) continue;
    const top = ranked[0], second = ranked[1];
    const blowout = !second || top.adj - second.adj > C.PORTAL_BLOWOUT;
    if (blowout && roleFor(top.s, e.player).role === "starter") commitEntry(state2, e, top.s, events);
  }
}
function advancePortalRound(state2, events = []) {
  const portal = state2.portal;
  if (!portal || portal.resolved || portal.round >= portal.maxRounds) return events;
  aiPortalReact(state2);
  portal.round++;
  checkPortalCommits(state2, events);
  return events;
}
function playerPitch(state2, playerId) {
  const portal = state2.portal;
  const coach = state2.playerCoach;
  const me = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  const entry = portal == null ? void 0 : portal.players.find((e) => e.player.id === playerId);
  if (!entry || portal.resolved) return { ok: false, reason: "Window closed" };
  if (entry.signedTo) return { ok: false, reason: "Already committed" };
  if (me && !canSchoolSign(me, entry.player)) {
    return { ok: false, reason: `Out of reach \u2014 a ${CALIBER_LABEL[entry.caliberTier]}-caliber transfer won't drop to ${me.division}.` };
  }
  const mine = entry.suitors.find((b) => b.schoolId === state2.playerSchoolId);
  if (!mine && portalScholarshipRoom(state2) <= 0) {
    return { ok: false, reason: "No scholarships left \u2014 a transfer takes a slot, same as a signee." };
  }
  const cost = mine ? C.PORTAL_RAISE_STEP : pitchCost(entry.player);
  if ((coach.budget || 0) < cost) return { ok: false, reason: "Not enough budget" };
  coach.budget -= cost;
  if (mine) mine.money += cost;
  else entry.suitors.push({ schoolId: state2.playerSchoolId, division: me == null ? void 0 : me.division, money: cost, isPlayer: true });
  return { ok: true, raised: !!mine };
}
function playerDrop(state2, playerId) {
  var _a;
  const entry = (_a = state2.portal) == null ? void 0 : _a.players.find((e) => e.player.id === playerId);
  if (!entry || entry.signedTo) return { ok: false };
  entry.suitors = entry.suitors.filter((b) => b.schoolId !== state2.playerSchoolId);
  return { ok: true };
}
function resolvePortal(state2, events) {
  const portal = state2.portal;
  if (!portal || portal.resolved) return;
  portal.resolved = true;
  const byId = new Map(state2.world.schools.map((s) => [s.id, s]));
  const signedPerSchool = {};
  for (const s of portal.signings) signedPerSchool[s.toSchoolId] = (signedPerSchool[s.toSchoolId] || 0) + 1;
  for (const entry of portal.players) {
    if (entry.signedTo) continue;
    const ranked = entry.suitors.map((b) => {
      const s = byId.get(b.schoolId);
      if (!s) return null;
      if (b.schoolId !== state2.playerSchoolId && (signedPerSchool[b.schoolId] || 0) >= C.PORTAL_AI_MAX_SIGNINGS) return null;
      return { s, adj: adjustedOffer(s, entry, b.money) };
    }).filter(Boolean).sort((a, b) => b.adj - a.adj);
    const win = ranked[0];
    // Re-check the ledger at award time — a recruiting offer may have taken the
    // last slot since the pitch was opened. Refusing here drops him into the
    // quiet-reassign loop below, which is what happens to every unsigned man.
    if (win && win.s.id === state2.playerSchoolId && !chargeScholarship(state2, win.s.id)) {
      if (events) events.push({ type: "warning", text: `\u{1F504} ${entry.player.name.first} ${entry.player.name.last} picked you \u2014 but you had no scholarship left to give him. He signs elsewhere.` });
      continue;
    }
    if (win) {
      win.s.roster.push(entry.player);
      if (win.s.id !== state2.playerSchoolId) chargeScholarship(state2, win.s.id);
      signedPerSchool[win.s.id] = (signedPerSchool[win.s.id] || 0) + 1;
      portal.signings.push({ playerId: entry.player.id, toSchoolId: win.s.id });
      entry.signedTo = win.s.id;
      entry.signedToName = win.s.name;
      if (win.s.id === state2.playerSchoolId && events) {
        events.push({ type: "info", text: `\u{1F504} Portal signing: ${entry.player.name.first} ${entry.player.name.last} (${entry.player.position}, ${entry.player.classYear}) transfers in from ${entry.fromSchoolName}.` });
      }
    }
  }
  for (const entry of portal.players) {
    if (entry.signedTo) continue;
    const gated = state2.world.schools.filter((s) => s.id !== entry.fromSchoolId && s.id !== state2.playerSchoolId && canSchoolSign(s, entry.player));
    const pool = gated.length ? gated : state2.world.schools.filter((s) => s.division === entry.fromDivision && s.id !== entry.fromSchoolId && s.id !== state2.playerSchoolId);
    const home = pool.sort((a, b) => needScore(b, entry.player) - needScore(a, entry.player))[0];
    if (home) {
      home.roster.push(entry.player);
      entry.signedTo = home.id;
      entry.signedToName = home.name;
      entry.quiet = true;
    }
  }
  const playerSignings = portal.signings.filter((s) => s.toSchoolId === state2.playerSchoolId).length;
  if (events) {
    events.push({ type: "info", text: `Transfer portal closes \u2014 ${portal.players.length} players moved${playerSignings ? `, ${playerSignings} to your program` : ""}.` });
  }
}
var STARTERS, TIER_OF_DIV, CALIBER_LABEL;

STARTERS = { QB: 1, RB: 2, WR: 3, TE: 1, OL: 5, DE: 2, DT: 2, OLB: 2, LB: 2, CB: 2, S: 2, K: 1, P: 1 };
TIER_OF_DIV = { D1: 3, D2: 2, D3: 1 };
CALIBER_LABEL = ["", "low", "mid", "high"];

export { advancePortalRound, aiPortalPursuits, buildTransferPortal, canSchoolSign, frontRunner, pitchCost, playerDrop, playerPitch, portalScholarshipRoom, projectedPathToPlay, resolvePortal, rivalryReward, roleFor, scheduleGuarantee };

// additional exports consumed by tools/ probes
export { adjustedOffer };
