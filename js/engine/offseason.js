import { __spreadProps, __spreadValues } from '../_spread.js';
import { C, ROSTER_TARGETS, SIZE_BANDS, STARTER_COUNTS } from '../constants.js';
import { awardDevelopmentXP, defScore, offScore } from './awards.js';
import { coachRepScore, expectedWins } from './career.js';
import { addSkillXP, gradeIndexFromXP } from './coach.js';
import { developPlayer, getEffectivePracticePlan, runSeasonDevelopment } from './development.js';
import { createWalkOn, refreshRatings } from './player.js';
import { aiPortalPursuits, buildTransferPortal, resolvePortal, rivalryReward } from './portal.js';
import { simulateGame } from './sim.js';
import { BRIDGE_CATALOG } from './traits.js';
import { buildDepthChart } from './world.js';
import { clamp2, distanceMiles, randInt3 } from '../utils.js';

function stageVisible(stage, state2) {
  var _a, _b, _c;
  if (!stage.conditional) return true;
  if (stage.id === "walkons") {
    const frozen = (_b = (_a = state2.offseason) == null ? void 0 : _a.data) == null ? void 0 : _b.walkOnEligible;
    if (frozen !== void 0) return frozen;
    return (((_c = state2.playerCoach) == null ? void 0 : _c.scholarshipsAvailable) || 0) > 0;
  }
  return true;
}
function visibleStages(state2) {
  return OFFSEASON_STAGES.filter((s) => stageVisible(s, state2));
}
function initOffseason(state2, milestoneHits, programHits, goalResults) {
  var _a;
  state2.offseason = {
    stage: 0,
    done: false,
    data: {
      milestones: milestoneHits || [],
      programMilestones: programHits || [],
      walkOnEligible: (((_a = state2.playerCoach) == null ? void 0 : _a.scholarshipsAvailable) || 0) > 0,
      goalResults: goalResults || []
    }
  };
}
function fireStageExit(stage, state2, events) {
  if (stage.id === "portal") resolvePortal(state2, events);
}
function effectiveRosterOver(state2) {
  const school = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  if (!school) return 0;
  const grads = graduatingSeniors(state2).length;
  return school.roster.length - grads - C.ROSTER_SIZE;
}
function advanceOffseasonStage(state2) {
  const events = [];
  const stages = visibleStages(state2);
  const stage = stages[state2.offseason.stage];
  if (stage && stage.id === "cuts") {
    const over = effectiveRosterOver(state2);
    if (over > 0) {
      return [{ type: "warning", text: `Cut day: you're ${over} over the cap once seniors graduate. Cut ${over} more before you hit the portal.` }];
    }
  }
  // [PLAYTEST 2026-08-12 item 24] Coordinator Hires is the ONLY window to change
  // a coordinator, so it has to be a real gate. Walking past it with an empty
  // chair used to cost the whole season's coordinator bonus silently — staff.js
  // reads a missing coordinator as simply absent, with no warning anywhere.
  if (stage && stage.id === "staff") {
    const school = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
    const st = (school == null ? void 0 : school.staff) || {};
    const empty = [!st.oc && "offensive", !st.dc && "defensive"].filter(Boolean);
    if (empty.length) {
      return [{ type: "warning", text: `You can't open camp with no ${empty.join(" and no ")} coordinator. Fill ${empty.length > 1 ? "both chairs" : "the chair"} before you move on.` }];
    }
  }
  if (stage) fireStageExit(stage, state2, events);
  if (state2.offseason.stage + 1 < stages.length) {
    state2.offseason.stage++;
    const next = stages[state2.offseason.stage];
    if (next.id === "portal") {
      const portal = buildTransferPortal(state2);
      aiPortalPursuits(state2);
      events.push({ type: "info", text: `Transfer portal opens \u2014 ${portal.players.length} players available.` });
    }
    events.push({ type: "offseason-stage", stageId: next.id, text: `Offseason: ${next.label}` });
  } else {
    state2.offseason.done = true;
    events.push({ type: "info", text: "Offseason complete \u2014 wrapping the season." });
  }
  return events;
}
function graduatingSeniors(state2) {
  const school = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  if (!school) return [];
  return school.roster.filter((p) => p.classYear === "SR" && !(p.redshirted && p.redshirtYear != null && p.redshirtYear === state2.season));
}
function neediestPositions(school, n) {
  const counts = {};
  for (const p of school.roster) counts[p.position] = (counts[p.position] || 0) + 1;
  return Object.entries(ROSTER_TARGETS).map(([pos, target]) => ({ pos, deficit: target - (counts[pos] || 0) })).sort((a, b) => b.deficit - a.deficit).slice(0, Math.max(n, 3)).map((x) => x.pos);
}
function getWalkOnPool(state2) {
  var _a;
  if (!state2.offseason) return [];
  if (state2.offseason.data.walkOnPool) return state2.offseason.data.walkOnPool;
  const school = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  if (!school) return [];
  const open = ((_a = state2.playerCoach) == null ? void 0 : _a.scholarshipsAvailable) || 0;
  const n = Math.min(
    C.WALKON_POOL_CAP,
    Math.max(C.WALKON_POOL_FLOOR, open + randInt3(C.WALKON_POOL_EXTRA_MIN, C.WALKON_POOL_EXTRA_MAX))
  );
  const positions = neediestPositions(school, n);
  const pool = [];
  for (let i = 0; i < n; i++) {
    const pos = positions[i % positions.length];
    const wo = createWalkOn(pos, school.lat, school.lng);
    pool.push({ wo, accepted: false });
  }
  state2.offseason.data.walkOnPool = pool;
  return pool;
}
function acceptWalkOn(state2, idx) {
  var _a, _b;
  const pool = (_b = (_a = state2.offseason) == null ? void 0 : _a.data) == null ? void 0 : _b.walkOnPool;
  const entry = pool == null ? void 0 : pool[idx];
  const coach = state2.playerCoach;
  if (!entry || entry.accepted) return { ok: false, reason: "Unavailable" };
  if (((coach == null ? void 0 : coach.scholarshipsAvailable) || 0) <= 0) return { ok: false, reason: "No scholarships left" };
  entry.accepted = true;
  coach.scholarshipsAvailable--;
  if (!state2.pendingWalkOns) state2.pendingWalkOns = [];
  state2.pendingWalkOns.push(entry.wo);
  return { ok: true };
}
function freshPreseason() {
  return {
    devFocus: "balanced",
    devDone: false,
    posChanges: [],
    campReport: null,
    campAvgGain: 0,
    springResult: null
  };
}
// [PLAYTEST 2026-08-12] THE PRESEASON BELONGS TO A SCHOOL, NOT TO THE SAVE.
// It used to live at `state.preseason` — a single object — while a coaching tree
// can have three chairs live in the same season, each owing its own week. So the
// training focus, the position changes, the camp report, the spring result and
// the redshirt window were all SHARED: set the focus for one coach and you set it
// for all of them. Owner hit this from the redshirt side ("I finalized redshirts
// for 1 coach and went to do the other and both coaches had been finalized").
// The store is now per-school; `state.preseason` is kept in sync as a legacy
// mirror so an old save (and anything still reading it) keeps working.
// Every school this save's coach(es) actually run. Read straight off the tree
// rather than importing tree.js — offseason.js is imported BY the season/tree
// side, and a cycle here would be a worse problem than the duplication.
function preseasonSchools(state2) {
  var _a, _b, _c;
  const out = [];
  const slots = ((_a = state2.tree) == null ? void 0 : _a.slots) || {};
  for (const slot of Object.values(slots)) {
    if (!slot || slot.retired || !slot.schoolId) continue;
    const sc = (_b = state2.world) == null ? void 0 : _b.schools.find((s) => s.id === slot.schoolId);
    if (sc && !out.includes(sc)) out.push(sc);
  }
  const active = (_c = state2.world) == null ? void 0 : _c.schools.find((s) => s.id === state2.playerSchoolId);
  if (active && !out.includes(active)) out.push(active);
  return out;
}
function initPreseason(state2) {
  for (const school of preseasonSchools(state2)) school.preseason = freshPreseason();
  state2.preseason = freshPreseason();
}
function devCtx(state2) {
  var _a;
  const school = (_a = state2.world) == null ? void 0 : _a.schools.find((s) => s.id === state2.playerSchoolId);
  if (!school) {
    if (!state2.preseason) state2.preseason = freshPreseason();
    return state2.preseason;
  }
  // Migration: a save written before the per-school split carries one global
  // context. The chair that was active when it was saved adopts it; every other
  // chair starts clean rather than inheriting a stranger's camp.
  if (!school.preseason) {
    school.preseason = state2.preseason && !state2._preseasonSplit ? state2.preseason : freshPreseason();
    state2._preseasonSplit = true;
  }
  state2.preseason = school.preseason;
  return school.preseason;
}
function setDevFocus(state2, focusId) {
  const ctx2 = devCtx(state2);
  if (ctx2.devDone) return { ok: false, reason: "Camp already ran" };
  if (!FOCUS_GROUPS.find((f) => f.id === focusId)) return { ok: false, reason: "Unknown focus" };
  ctx2.devFocus = focusId;
  return { ok: true };
}
function focusFor(state2) {
  const id = devCtx(state2).devFocus;
  const grp = FOCUS_GROUPS.find((f) => f.id === id);
  if (!grp || !grp.positions) return null;
  return { positions: new Set(grp.positions), mult: C.DEV_FOCUS_MULT, offMult: C.DEV_NONFOCUS_MULT };
}
function diffAttrs(beforeAttrs, player) {
  var _a, _b;
  const ba = beforeAttrs || {};
  const gains = {};
  for (const [k, v] of Object.entries(player.attributes || {})) {
    const d = (v || 0) - ((_b = (_a = ba[k]) != null ? _a : v) != null ? _b : 0);
    if (d) gains[k] = d;
  }
  return gains;
}
function runDevCamp(state2) {
  const data = devCtx(state2);
  if (data.devDone) return { ok: true, report: data.campReport || [] };
  const pSchool = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  const before = new Map(((pSchool == null ? void 0 : pSchool.roster) || []).map((p) => [p.id, Math.round(p.compositeRating || 0)]));
  const beforeAttrs = new Map(((pSchool == null ? void 0 : pSchool.roster) || []).map((p) => [p.id, __spreadValues({}, p.attributes)]));
  const focus = focusFor(state2);
  for (const school of state2.world.schools) {
    runSeasonDevelopment(school, school.id === state2.playerSchoolId ? focus : null);
  }
  data.devDone = true;
  if (pSchool == null ? void 0 : pSchool.coach) awardDevelopmentXP(pSchool, pSchool.coach, before, [], state2._coachId);
  const report = ((pSchool == null ? void 0 : pSchool.roster) || []).map((p) => {
    var _a, _b, _c;
    return {
      id: p.id,
      // lets the camp report open the player card
      name: `${((_a = p.name) == null ? void 0 : _a.first) || ""} ${((_b = p.name) == null ? void 0 : _b.last) || ""}`.trim(),
      pos: p.position,
      classYear: p.classYear,
      before: (_c = before.get(p.id)) != null ? _c : Math.round(p.compositeRating || 0),
      after: Math.round(p.compositeRating || 0),
      attrGains: diffAttrs(beforeAttrs.get(p.id), p)
    };
  }).map((r) => __spreadProps(__spreadValues({}, r), { gain: r.after - r.before })).sort((a, b) => b.gain - a.gain);
  data.campReport = report;
  data.campAvgGain = report.length ? +(report.reduce((s, r) => s + r.gain, 0) / report.length).toFixed(1) : 0;
  return { ok: true, report };
}
function conversionPenaltyFactor(state2) {
  var _a, _b, _c;
  const xp = ((_c = (_b = (_a = state2.playerCoach) == null ? void 0 : _a.skills) == null ? void 0 : _b.developer) == null ? void 0 : _c.xp) || 0;
  const grade = gradeIndexFromXP(xp);
  return Math.max(C.POS_CHANGE_PENALTY * 0.25, C.POS_CHANGE_PENALTY * (1 - grade * 0.05));
}
function previewConversion(state2, playerId, newPos, school = null) {
  // PASS 7: optional school param generalizes the preview to AI rosters (the
  // convert brain). Player-school callers are unchanged; AI staffs price the
  // flat POS_CHANGE_PENALTY (no Developer-coach discount).
  const mine = !school || school.id === state2.playerSchoolId;
  school = school || state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  const p = school == null ? void 0 : school.roster.find((x) => x.id === playerId);
  if (!p) return null;
  const clone = JSON.parse(JSON.stringify(p));
  clone.position = newPos;
  clone.convPenalty = { factor: mine ? conversionPenaltyFactor(state2) : C.POS_CHANGE_PENALTY };
  refreshRatings(clone);
  return { from: p.position, current: Math.round(p.compositeRating), projected: clone.compositeRating };
}
// ── PASS 7 helpers (Ref/PASS7_ROSTER_PLAN.md) ───────────────────────────────
// SIZE_BANDS.byPos keys band FAMILIES (DL/LB/DB), not roster positions —
// mirror traits.js posBandKey exactly so DE/DT/OLB/CB/S resolve their bands.
function _bandKeyForPos(position) {
  if (position === "DE" || position === "DT") return "DL";
  if (position === "CB" || position === "S") return "DB";
  if (position === "OLB") return "LB";
  return position;
}
// Position-level size window read: where this weight sits vs SIZE_BANDS.byPos,
// as a gentle fit multiplier (identity-style ≤10% cap — 0.002/lb outside).
function posSizeFit(weight, pos) {
  var _a;
  const band = (_a = SIZE_BANDS == null ? void 0 : SIZE_BANDS.byPos) == null ? void 0 : _a[_bandKeyForPos(pos)];
  if (!band || !weight) return 1;
  const [, , wMin, wMax] = band;
  const dist = weight < wMin ? wMin - weight : weight > wMax ? weight - wMax : 0;
  return 1 - Math.min(0.1, dist * 2e-3);
}
// The body target a position asks of this weight: the nearest in-window point
// (null = already in-window). Stage 4b moves toward it a capped step per
// offseason; the convert flow stamps it as the player's bodyPlan.
function bodyTargetForPos(weight, pos) {
  var _a;
  const band = (_a = SIZE_BANDS == null ? void 0 : SIZE_BANDS.byPos) == null ? void 0 : _a[_bandKeyForPos(pos)];
  if (!band || !weight) return null;
  const [, , wMin, wMax] = band;
  const t = clamp2(weight, wMin, wMax);
  return t === weight ? null : t;
}
// ── CUT DAY RECOMMENDATIONS (Aug 2026, owner ask) ───────────────────────────
// Before the axe falls, the staff walks the roster looking for bodies that fit
// better somewhere else — the buried fourth corner with safety size, the
// blocked-in edge who'd start inside. A recommendation needs all three legs:
// the man is BURIED in his own room (behind the two-deep, or the room is
// overstuffed), some other room actually NEEDS him (short of its target, or
// he'd walk into its two-deep), and the projection says the move doesn't
// throw away the player (projected composite within a small haircut of
// current — previewConversion already prices the one-season conversion
// penalty). Recs ride the SAME conversion economy as the spring board: the
// camp cap counts them, camp locks them. Pure read — calling this changes
// nothing. K/P rooms sit out both sides (specialists are hand-managed).
// PASS 7 (Fix C): generalized to any school — the SAME staff brain now walks
// AI rosters at rollover (aiRosterConverts) and the player's cut-day screen
// (cutDayConversionRecs wrapper below, signature untouched). Identity-aware
// legs (real-usage buried test, size-window term, bridge-trait bonus, body
// direction) sit behind `__noConvertBrain` — switched off, the scoring is the
// legacy formula byte-for-byte.
function schoolConversionRecs(state2, school) {
  var _a, _b;
  if (!school) return [];
  const mine = school.id === state2.playerSchoolId;
  const brain = !globalThis.__noConvertBrain;
  const gradIds = mine ? new Set(graduatingSeniors(state2).map((p) => p.id)) : new Set();
  const roster = school.roster.filter((p) => !gradIds.has(p.id) && (mine || p.classYear !== "SR"));
  const converted = new Set(mine ? ((devCtx(state2).posChanges) || []).map((c) => c.playerId) : []);
  const counts = {};
  for (const p of roster) counts[p.position] = (counts[p.position] || 0) + 1;
  const roomRank = (pos, rating, selfId) => roster.filter((x) => x.position === pos && x.id !== selfId && x.compositeRating > rating).length + 1;
  // Fix D tie-in: real snap share, when the season logged one. A body the
  // rotation never actually used is buried no matter what his room rank says.
  const sideSnaps = (p) => {
    var _s;
    const off = ["QB", "RB", "WR", "TE", "OL", "FB"].includes(p.position);
    return ((_s = school.stats) == null ? void 0 : _s[off ? "offSnaps" : "defSnaps"]) || 0;
  };
  const usageBuried = (p) => {
    var _s;
    if (!brain || globalThis.__noSnapTrack) return false;
    const team = sideSnaps(p);
    const snaps = ((_s = p.stats) == null ? void 0 : _s.snaps) || 0;
    if (!team || team < 200) return false;
    return snaps / team < C.PASS7.moraleShareFloor && p.classYear !== "FR";
  };
  const recs = [];
  for (const p of roster) {
    if (converted.has(p.id)) continue;
    if (p.position === "K" || p.position === "P") continue;
    const fromCount = counts[p.position] || 0;
    const fromRank = roomRank(p.position, p.compositeRating, null);
    const starters = STARTER_COUNTS[p.position] || 1;
    const buried = fromRank > starters + 1 || fromCount > (ROSTER_TARGETS[p.position] || 0) || usageBuried(p);
    if (!buried) continue;
    let best = null;
    for (const [pos, target] of Object.entries(ROSTER_TARGETS)) {
      if (pos === p.position || pos === "K" || pos === "P") continue;
      const deficit = target - (counts[pos] || 0);
      const prev = previewConversion(state2, p.id, pos, school);
      if (!prev) continue;
      if (prev.projected < prev.current - 3) continue;
      const toRank = roomRank(pos, prev.projected, p.id);
      // The move has to MATTER somewhere. Two honest cases only:
      //   FILL — the target room is short of bodies (portal's about to open;
      //          a convert is a free fill), tolerance = the small haircut.
      //   MISCAST — no shortage, but he'd flat-out START there and projects
      //          BETTER than where he is even after the haircut. Cross-
      //          position composites correlate (few attributes, shared
      //          blends), so a loose walks-into-the-two-deep rule pitches
      //          half of every balanced roster — this branch stays strict.
      const startsThere = toRank <= (STARTER_COUNTS[pos] || 1);
      if (deficit <= 0 && !(startsThere && prev.projected >= prev.current + 2)) continue;
      let score = (fromRank - toRank) + Math.max(0, deficit) * 2 + (prev.projected - prev.current) * 0.3;
      let bodyDelta = 0;
      if (brain) {
        // Identity legs: (a) the destination window prices the body — a
        // tweener misfit at home who projects IN-window at the destination
        // scores the gap; (b) a bridge trait already covering the destination
        // bucket makes the move near-free on the field — big bonus.
        const projT = bodyTargetForPos(p.weight, pos);
        const projW = projT == null ? p.weight : p.weight + clamp2(projT - p.weight, -C.PASS7.bulkMax, C.PASS7.bulkMax);
        score += C.PASS7.convertSizeW * (posSizeFit(projW, pos) - posSizeFit(p.weight, p.position));
        const bk = (_b = p.traits) == null ? void 0 : _b.bridge;
        const bdef = bk ? BRIDGE_CATALOG[bk] : null;
        if (bdef && (bdef.buckets || []).includes(pos)) score += C.PASS7.convertBridgeBonus;
        bodyDelta = projT == null ? 0 : Math.round(projT - p.weight);
      }
      if (score <= 1) continue;
      if (!best || score > best.score) best = { to: pos, current: prev.current, projected: prev.projected, toRank, toCount: counts[pos] || 0, deficit, score, bodyDelta };
    }
    if (best) recs.push(__spreadValues({
      playerId: p.id,
      name: `${(p.name == null ? void 0 : p.name.first) || ""} ${p.name && p.name.last || ""}`.trim(),
      from: p.position,
      fromRank,
      fromCount,
      classYear: p.classYear,
      isWalkOn: !!p.isWalkOn,
      // Fix D surface: flag flight risks so the cut-day screen can say WHY
      // the staff is pitching the move ("unhappy — buried")
      unhappy: brain && !globalThis.__noMorale && p.morale != null && p.morale < C.PASS7.moraleLowBar,
      usageBuried: usageBuried(p)
    }, best));
  }
  return recs.sort((a, b) => b.score - a.score).slice(0, 6);
}
function cutDayConversionRecs(state2) {
  const school = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  return schoolConversionRecs(state2, school);
}
function convertPosition(state2, playerId, newPos, opts = {}) {
  var _a, _b;
  const anytime = !!opts.anytime;
  const data = devCtx(state2);
  if (!anytime) {
    if (data.devDone) return { ok: false, reason: "Camp already ran \u2014 conversions lock at camp" };
    data.posChanges = data.posChanges || [];
    const gatedCount = data.posChanges.filter((c) => !c.anytime).length;
    if (gatedCount >= C.POS_CHANGE_CAP)
      return { ok: false, reason: `Max ${C.POS_CHANGE_CAP} camp conversions per offseason` };
  }
  const school = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  const p = school == null ? void 0 : school.roster.find((x) => x.id === playerId);
  if (!p) return { ok: false, reason: "Player not found" };
  if (p.position === newPos) return { ok: false, reason: "Already plays there" };
  const from = p.position;
  const before = Math.round(p.compositeRating);
  p.position = newPos;
  const inOffseason = !!(state2.offseason && !state2.offseason.done);
  const applySeason = inOffseason ? state2.season + 1 : state2.season;
  p.convPenalty = { season: applySeason, factor: conversionPenaltyFactor(state2) };
  p.convDev = { season: applySeason, left: C.POS_CHANGE_DEV_SEASONS };
  // PASS 7 (stage 4b tie-in): the convert flow stamps the body plan — the new
  // position's window becomes his offseason bulk/cut target ("bulks to DE").
  if (!globalThis.__noBulkCut) {
    const bt = bodyTargetForPos(p.weight, newPos);
    if (bt != null) p.bodyPlan = { targetW: bt, from, to: newPos };
    else delete p.bodyPlan;
  }
  refreshRatings(p);
  school.depthChart = buildDepthChart(school.roster, school.gameplan, school.depthOrder || {});
  data.posChanges = data.posChanges || [];
  data.posChanges.push({ playerId, from, to: newPos, anytime });
  const coach = state2.playerCoach;
  if (coach) {
    coach.pendingConversions = coach.pendingConversions || [];
    coach.pendingConversions.push({ playerId, forSeason: applySeason });
  }
  return {
    ok: true,
    from,
    before,
    after: p.compositeRating,
    name: `${((_a = p.name) == null ? void 0 : _a.first) || ""} ${((_b = p.name) == null ? void 0 : _b.last) || ""}`.trim()
  };
}
function evaluateConversions(state2, events) {
  var _a, _b, _c, _d;
  const coach = state2.playerCoach;
  if (!((_a = coach == null ? void 0 : coach.pendingConversions) == null ? void 0 : _a.length)) return;
  const school = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  const keep = [];
  for (const pc of coach.pendingConversions) {
    if (pc.forSeason !== state2.season) {
      keep.push(pc);
      continue;
    }
    const p = school == null ? void 0 : school.roster.find((x) => x.id === pc.playerId);
    if (p && (((_b = school.depthChart) == null ? void 0 : _b[p.position]) || [])[0] === p.id) {
      addSkillXP(coach, "evaluator", C.XP_CONVERT_HIT);
      events.push({ type: "info", text: `Conversion paid off: ${((_c = p.name) == null ? void 0 : _c.first) || ""} ${((_d = p.name) == null ? void 0 : _d.last) || ""} started at ${p.position} all season. +${C.XP_CONVERT_HIT} Evaluator.` });
    }
  }
  coach.pendingConversions = keep;
}
// ── PASS 7 ROLLOVER (Ref/PASS7_ROSTER_PLAN.md) — called from startNewSeason
// BEFORE the season stat reset (it consumes last season's snaps/jobs) ────────
// AI converts (Fix C, league-wide by owner call): each AI staff applies its
// top schoolConversionRecs through the same penalty economy the player pays.
// Conservative bar — the AI only takes obvious moves. `__noConvertBrain`.
function aiRosterConverts(state2) {
  if (globalThis.__noConvertBrain) return;
  for (const school of state2.world.schools) {
    if (school.id === state2.playerSchoolId) continue;
    if (!(school.roster || []).length) continue;
    const recs = schoolConversionRecs(state2, school);
    let done = 0;
    for (const r of recs) {
      if (done >= C.PASS7.aiPosChangeCap) break;
      if (r.score < 2.5 || r.isWalkOn) continue;
      const p = school.roster.find((x) => x.id === r.playerId);
      if (!p || p.position === r.to) continue;
      p.position = r.to;
      p.convPenalty = { season: state2.season, factor: C.POS_CHANGE_PENALTY };
      p.convDev = { season: state2.season, left: C.POS_CHANGE_DEV_SEASONS };
      if (!globalThis.__noBulkCut) {
        const bt = bodyTargetForPos(p.weight, r.to);
        if (bt != null) p.bodyPlan = { targetW: bt, from: r.from, to: r.to };
      }
      refreshRatings(p);
      done++;
    }
    if (done) school.depthChart = buildDepthChart(school.roster, school.gameplan, school.depthOrder || {});
  }
}
// Stage 4a — earnable bridges off REAL job snaps (IDENTITY_DESIGN §4d).
// A season living at a foreign bucket → "He's become a Rover." One per career
// (traits.earned), all schools (generation-parity law). `__noEarnBridge`.
// twoGapper / poleRunner / swingTackle stay unreachable — declined in the
// plan (job-internal, not bucket-visible).
const EARN_BRIDGE_MAP = {
  LB: [{ k: "spaceBacker", keys: ["S", "CB"] }],
  OLB: [{ k: "spaceBacker", keys: ["S", "CB"] }, { k: "edgeBender", keys: ["DE"] }],
  DE: [{ k: "edgeBender", keys: ["OLB"] }],
  S: [{ k: "slotStar", keys: ["CB"] }, { k: "boxGeneral", keys: ["ILB", "OLB"] }],
  TE: [{ k: "moveTE", keys: ["SLOT", "WR"] }, { k: "hBack", keys: ["RB"] }],
  RB: [
    { k: "backfieldWeapon", keys: ["SLOT", "WR"] },
    { k: "hBack", keys: ["TE"] },
    { k: "wildcatEngine", keys: ["WILDCAT", "QB"] }
  ]
};
function earnBridges(state2) {
  var _a, _b, _c;
  if (globalThis.__noEarnBridge || globalThis.__noSnapTrack) return;
  const P7 = C.PASS7;
  for (const school of state2.world.schools) {
    const mine = school.id === state2.playerSchoolId;
    for (const p of school.roster || []) {
      const snaps = ((_a = p.stats) == null ? void 0 : _a.snaps) || 0;
      const at = (_b = p.stats) == null ? void 0 : _b.snapsAt;
      if (!at || snaps < P7.bridgeEarnSnaps) continue;
      if (((_c = p.traits) == null ? void 0 : _c.bridge) || ((_c = p.traits) == null ? void 0 : _c.earned)) continue;
      const cands = EARN_BRIDGE_MAP[p.position] || [];
      let best = null;
      for (const c of cands) {
        if (!BRIDGE_CATALOG[c.k] || !BRIDGE_CATALOG[c.k].pos.includes(p.position)) continue;
        const n = c.keys.reduce((s, k) => s + (at[k] || 0), 0);
        if (n / snaps >= P7.bridgeEarnShare && (!best || n > best.n)) best = { k: c.k, n };
      }
      if (!best) continue;
      // Earning is the one legitimate retro path onto a pre-trait save: the
      // bridge was EARNED by logged snaps, not retro-rolled at generation.
      if (!p.traits) p.traits = { bridge: null, play: [], flaws: [], earned: false };
      p.traits.bridge = best.k;
      p.traits.earned = true;
      if (mine && state2.inbox && state2.inbox.push) {
        const nm = `${(p.name == null ? void 0 : p.name.first) || ""} ${(p.name == null ? void 0 : p.name.last) || ""}`.trim();
        state2.inbox.push({
          id: `bridge_${p.id}_${state2.season}`,
          day: state2.day,
          subject: "⭐ A player has grown into a new role",
          body: `${nm} (${p.position}) logged ${best.n} real snaps living in a different job all season — he's become a ${BRIDGE_CATALOG[best.k].name}. The job is his now, at full rate.`,
          read: false
        });
      }
    }
  }
}
// Stage 4b — offseason bulk/cut (IDENTITY_DESIGN §5). Body target priority:
// the convert flow's stamped plan → the foreign job he actually lived at
// (real snaps, Fix D) → own-window regression when he's outside his band.
// ±bulkMin..bulkMax lb per offseason (WE/CON-seeded), coupled attr nudges per
// 10 lb, zero-sum in spirit; height never changes. `__noBulkCut`.
const BULK_BUCKET_POS = { ILB: "LB", SLOT: "WR" };
function offseasonBulkCut(state2) {
  var _a, _b, _c;
  if (globalThis.__noBulkCut) return;
  const P7 = C.PASS7;
  const notable = [];
  for (const school of state2.world.schools) {
    const mine = school.id === state2.playerSchoolId;
    for (const p of school.roster || []) {
      if (p.position === "K" || p.position === "P" || !p.weight) continue;
      let target = null, why = null;
      if ((_a = p.bodyPlan) == null ? void 0 : _a.targetW) {
        target = p.bodyPlan.targetW;
        why = `for the move to ${p.bodyPlan.to || p.position}`;
      } else if (!globalThis.__noSnapTrack && ((_b = p.stats) == null ? void 0 : _b.snapsAt)) {
        const snaps = p.stats.snaps || 0;
        if (snaps > 0) {
          let bk = null, bn = 0;
          for (const [k, n] of Object.entries(p.stats.snapsAt)) {
            if (n > bn) { bk = k; bn = n; }
          }
          if (bk && bn / snaps >= P7.bulkJobShare) {
            const pos = BULK_BUCKET_POS[bk] || bk;
            const t = bodyTargetForPos(p.weight, pos);
            if (t != null) {
              target = t;
              why = `for the ${bk} job he's living at`;
            }
          }
        }
      }
      if (target == null) {
        const t = bodyTargetForPos(p.weight, p.position);
        if (t != null) { target = t; why = "back toward playing weight"; }
      }
      if (target == null || target === p.weight) {
        if (p.bodyPlan && (p.bodyPlan.targetW == null || p.bodyPlan.targetW === p.weight)) delete p.bodyPlan;
        continue;
      }
      const we = (p.attributes == null ? void 0 : p.attributes.WE) != null ? p.attributes.WE : 50;
      const con = (p.attributes == null ? void 0 : p.attributes.CON) != null ? p.attributes.CON : 50;
      const cap = Math.round(P7.bulkMin + (P7.bulkMax - P7.bulkMin) * clamp2((we + con) / 2 / 100, 0, 1));
      const move = Math.round(clamp2(target - p.weight, -cap, cap));
      if (!move) continue;
      p.weight += move;
      for (const [k, per10] of Object.entries(P7.bulkAttrPer10 || {})) {
        if (p.attributes && p.attributes[k] != null) {
          p.attributes[k] = clamp2(Math.round(p.attributes[k] + per10 * (move / 10)), 1, 99);
        }
      }
      refreshRatings(p);
      if (p.bodyPlan && Math.abs((p.bodyPlan.targetW || p.weight) - p.weight) < 1) delete p.bodyPlan;
      if (mine && Math.abs(move) >= P7.bulkReportMin) {
        const nm = `${(p.name == null ? void 0 : p.name.first) || ""} ${(p.name == null ? void 0 : p.name.last) || ""}`.trim();
        notable.push(`${nm} (${p.position}) ${move > 0 ? "bulked up" : "cut"} ${Math.abs(move)} lb ${why} — now ${p.weight} lb.`);
      }
    }
  }
  if (notable.length && state2.inbox && state2.inbox.push) {
    state2.inbox.push({
      id: `bulkcut_${state2.season}`,
      day: state2.day,
      subject: "\u{1F3CB}️ Offseason body work",
      body: notable.join("\n"),
      read: false
    });
  }
}
// The one entry point startNewSeason calls, in dependency order, BEFORE the
// stat reset: converts stamp body plans → bridges read job snaps → bulk/cut
// consumes both.
function pass7Rollover(state2) {
  aiRosterConverts(state2);
  earnBridges(state2);
  offseasonBulkCut(state2);
}
function statLine(gs) {
  const parts = [];
  if (gs.passYds) parts.push(`${gs.passYds} pass yds${gs.passTD ? `, ${gs.passTD} TD` : ""}`);
  if (gs.rushYds) parts.push(`${gs.rushYds} rush yds${gs.rushTD ? `, ${gs.rushTD} TD` : ""}`);
  if (gs.recYds) parts.push(`${gs.recYds} rec yds${gs.recTD ? `, ${gs.recTD} TD` : ""}`);
  if (gs.tackles) parts.push(`${gs.tackles} tkl`);
  if (gs.sacks) parts.push(`${gs.sacks} sk`);
  if (gs.ints) parts.push(`${gs.ints} INT`);
  return parts.slice(0, 2).join(" \xB7 ");
}
function playSpringGame(state2) {
  const data = devCtx(state2);
  if (data.springResult) return { ok: true, result: data.springResult, raw: null };
  if (!data.devDone) return { ok: false, reason: "Development camp runs first (Week 1)" };
  const school = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  if (!school) return { ok: false, reason: "No school" };
  const rosterA = [], rosterB = [];
  const dc = school.depthChart || {};
  const placed = /* @__PURE__ */ new Set();
  const orderFor = (pos) => {
    const ids = [...dc[pos] || []];
    for (const p of school.roster) if (p.position === pos && !ids.includes(p.id)) ids.push(p.id);
    return ids.map((id) => school.roster.find((p) => p.id === id)).filter(Boolean);
  };
  const clone = (p, suffix = "") => {
    const c = JSON.parse(JSON.stringify(p));
    if (suffix) c.id = c.id + suffix;
    return c;
  };
  for (const pos of SPRING_OFF_POS) orderFor(pos).forEach((p, i) => {
    (i % 2 === 0 ? rosterA : rosterB).push(clone(p));
    placed.add(p.id);
  });
  for (const pos of SPRING_DEF_POS) orderFor(pos).forEach((p, i) => {
    (i % 2 === 1 ? rosterA : rosterB).push(clone(p));
    placed.add(p.id);
  });
  for (const p of school.roster) {
    if (placed.has(p.id)) continue;
    rosterA.push(clone(p));
    rosterB.push(clone(p, "_b"));
  }
  const shellA = __spreadProps(__spreadValues({}, school), { name: `${school.nick} White`, roster: void 0 });
  const shellB = __spreadProps(__spreadValues({}, school), { id: "spring_black", name: `${school.nick} Black`, roster: void 0 });
  const depthA = buildDepthChart(rosterA, school.gameplan, {});
  const depthB = buildDepthChart(rosterB, school.gameplan, {});
  const result = simulateGame(shellA, shellB, rosterA, rosterB, depthA, depthB, school.gameplan, school.gameplan);
  const nameOf = (roster, id) => {
    var _a, _b;
    const p = roster.find((x) => x.id === id);
    return p ? { name: `${((_a = p.name) == null ? void 0 : _a.first) || ""} ${((_b = p.name) == null ? void 0 : _b.last) || ""}`.trim(), pos: p.position } : null;
  };
  const perf = [];
  for (const [roster, stats] of [[rosterA, result.homePlayerStats], [rosterB, result.awayPlayerStats]]) {
    for (const [id, gs] of Object.entries(stats || {})) {
      const who = nameOf(roster, id);
      if (!who) continue;
      perf.push(__spreadProps(__spreadValues({}, who), { o: offScore(gs), d: defScore(gs), line: statLine(gs) }));
    }
  }
  const topOff = perf.filter((x) => x.o > 0).sort((a, b) => b.o - a.o).slice(0, 3);
  const topDef = perf.filter((x) => x.d > 0).sort((a, b) => b.d - a.d).slice(0, 3);
  const breakouts = (data.campReport || []).filter((r) => r.gain >= C.RAISER_GAIN).slice(0, 6).map((r) => ({ id: r.id, name: r.name, pos: r.pos, gain: r.gain, attrGains: r.attrGains }));
  const beforeComp = new Map(school.roster.map((p) => [p.id, Math.round(p.compositeRating || 0)]));
  const beforeAttrs = new Map(school.roster.map((p) => [p.id, __spreadValues({}, p.attributes)]));
  const coach = state2.playerCoach;
  for (const p of school.roster) {
    const plan = getEffectivePracticePlan(school, p.position);
    if (!plan) continue;
    developPlayer(p, plan, coach, C.SPRING_DEV_MULT, school);
  }
  school.depthChart = buildDepthChart(school.roster, school.gameplan, school.depthOrder || {});
  const devReport = school.roster.map((p) => {
    var _a, _b, _c;
    return {
      id: p.id,
      // lets the spring report open the player card
      name: `${((_a = p.name) == null ? void 0 : _a.first) || ""} ${((_b = p.name) == null ? void 0 : _b.last) || ""}`.trim(),
      pos: p.position,
      classYear: p.classYear,
      before: (_c = beforeComp.get(p.id)) != null ? _c : Math.round(p.compositeRating || 0),
      after: Math.round(p.compositeRating || 0),
      attrGains: diffAttrs(beforeAttrs.get(p.id), p)
    };
  }).map((r) => __spreadProps(__spreadValues({}, r), { gain: r.after - r.before })).filter((r) => r.gain !== 0 || Object.keys(r.attrGains).length > 0).sort((a, b) => b.gain - a.gain);
  data.springResult = {
    scoreA: result.homeScore,
    scoreB: result.awayScore,
    nameA: `${school.nick} White`,
    nameB: `${school.nick} Black`,
    topOff: topOff.map(({ name, pos, line }) => ({ name, pos, line })),
    topDef: topDef.map(({ name, pos, line }) => ({ name, pos, line })),
    breakouts,
    devReport,
    boosted: true
  };
  return { ok: true, result: data.springResult, raw: result };
}
function getRivalCandidates(state2) {
  const school = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  if (!school) return [];
  return state2.world.schools.filter((s) => s.id !== school.id && s.division === school.division && s.conf !== school.conf).map((s) => ({ school: s, miles: Math.round(distanceMiles(school.lat, school.lng, s.lat, s.lng)) })).sort((a, b) => a.miles - b.miles).slice(0, 3);
}
function makeTrophyName(a, b) {
  const item = TROPHY_ITEMS[randInt3(0, TROPHY_ITEMS.length - 1)];
  if (a.state && a.state === b.state && Math.random() < 0.4) return `The ${a.state} ${item}`;
  if (a.city && b.city) return `The ${a.city}\u2013${b.city} ${item}`;
  return `The Rivalry ${item}`;
}
function designateRival(state2, schoolId) {
  var _a, _b;
  const cands = getRivalCandidates(state2);
  const pick2 = cands.find((c) => c.school.id === schoolId);
  if (!pick2) return { ok: false, reason: "Not an eligible rival" };
  const school = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  if (((_a = state2.rivalry) == null ? void 0 : _a.schoolId) && ((_b = state2.world.schools.find((s) => s.id === state2.rivalry.schoolId)) == null ? void 0 : _b.division) === school.division) {
    return { ok: false, reason: "You already have a rival" };
  }
  state2.rivalry = {
    schoolId: pick2.school.id,
    schoolName: pick2.school.name,
    trophy: makeTrophyName(school, pick2.school),
    sinceSeason: state2.season,
    holderId: null,
    wins: 0,
    losses: 0
  };
  return { ok: true, rivalry: state2.rivalry };
}
function checkRivalryResult(state2, results, events) {
  var _a;
  const riv = state2.rivalry;
  if (!riv) return;
  for (const r of results) {
    const ids = [r.game.homeId, r.game.awayId];
    if (!ids.includes(state2.playerSchoolId) || !ids.includes(riv.schoolId)) continue;
    if (!((_a = r.result) == null ? void 0 : _a.winner)) continue;
    const won = r.result.winner === state2.playerSchoolId;
    if (won) {
      riv.wins++;
      riv.holderId = state2.playerSchoolId;
      if (state2.playerCoach) {
        addSkillXP(state2.playerCoach, "reputation", C.XP_RIVALRY);
        const mySchool = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
        const reward = rivalryReward((mySchool == null ? void 0 : mySchool.division) || "D3");
        state2.playerCoach.budget = (state2.playerCoach.budget || 0) + reward;
        events.push({ type: "info", text: `\u{1F4B0} +$${reward.toLocaleString()} recruiting budget \u2014 rivalry win (1.5 scholarships).` });
      }
      events.push({ type: "info", text: `${riv.trophy} ${riv.holderId === state2.playerSchoolId ? "stays home" : "is yours"}! Rivalry record ${riv.wins}\u2013${riv.losses}. +${C.XP_RIVALRY} Reputation.` });
    } else {
      riv.losses++;
      riv.holderId = riv.schoolId;
      events.push({ type: "warning", text: `${riv.schoolName} takes ${riv.trophy}. Rivalry record ${riv.wins}\u2013${riv.losses}.` });
    }
  }
}
function findNonConfGame(state2, teamId, day) {
  return (state2.schedule || []).find((g) => g.day === day && !g.result && (g.homeId === teamId || g.awayId === teamId));
}
function swapNonConfOpponent(state2, day, newOppId, { forceHome = null } = {}) {
  if (state2.day > day) return { ok: false, reason: "That week has passed" };
  if (!NC_WINDOW.includes(day)) return { ok: false, reason: "Not a non-conference week" };
  if (state2.rivalry && day === C.RIVALRY_DAY && newOppId !== state2.rivalry.schoolId) return { ok: false, reason: "Rivalry week is reserved" };
  const me = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  const opp = state2.world.schools.find((s) => s.id === newOppId);
  if (!me || !opp) return { ok: false, reason: "School not found" };
  if (opp.division !== me.division) return { ok: false, reason: "Own division only" };
  if (opp.conf === me.conf) return { ok: false, reason: "Conference foes are already on the slate" };
  const myGame = findNonConfGame(state2, me.id, day);
  if (!myGame) return { ok: false, reason: "No open game that week" };
  const curOppId = myGame.homeId === me.id ? myGame.awayId : myGame.homeId;
  if (curOppId === newOppId) {
    if (forceHome !== null) {
      myGame.homeId = forceHome ? me.id : newOppId;
      myGame.awayId = forceHome ? newOppId : me.id;
    }
    return { ok: true, unchanged: true };
  }
  for (const d of NC_WINDOW) {
    if (d === day) continue;
    const g = findNonConfGame(state2, me.id, d);
    if (g && (g.homeId === newOppId || g.awayId === newOppId))
      return { ok: false, reason: "Already scheduled that opponent" };
  }
  const theirGame = findNonConfGame(state2, newOppId, day);
  if (!theirGame) return { ok: false, reason: "They have no open game that week" };
  const displacedA = state2.world.schools.find((s) => s.id === curOppId);
  const displacedBId = theirGame.homeId === newOppId ? theirGame.awayId : theirGame.homeId;
  const displacedB = state2.world.schools.find((s) => s.id === displacedBId);
  if (!displacedA || !displacedB) return { ok: false, reason: "Pairing failed" };
  if (displacedA.conf === displacedB.conf)
    return { ok: false, reason: "The leftover pairing would be in-conference \u2014 try another week or opponent" };
  for (const d of NC_WINDOW) {
    const g = findNonConfGame(state2, displacedA.id, d);
    if (g && (g.homeId === displacedB.id || g.awayId === displacedB.id))
      return { ok: false, reason: "The leftover pair already meets this season" };
  }
  const iWasHome = myGame.homeId === me.id;
  const meHome = forceHome === null ? iWasHome : forceHome;
  myGame.homeId = meHome ? me.id : newOppId;
  myGame.awayId = meHome ? newOppId : me.id;
  theirGame.homeId = displacedA.id;
  theirGame.awayId = displacedB.id;
  return { ok: true, displaced: [displacedA.name, displacedB.name] };
}
function injectRivalryIntoSchedule(state2) {
  const riv = state2.rivalry;
  if (!riv) return { ok: false, reason: "No rivalry" };
  for (const day of [C.RIVALRY_DAY, 7, 6, 5]) {
    if (state2.day > day) continue;
    const res = swapNonConfOpponent(state2, day, riv.schoolId, { forceHome: true });
    if (res.ok) {
      const g = findNonConfGame(state2, state2.playerSchoolId, day);
      if (g && (g.homeId === riv.schoolId || g.awayId === riv.schoolId)) g.rivalry = true;
      return { ok: true, day };
    }
  }
  return { ok: false, reason: "No legal slot this season \u2014 the series starts next year" };
}
function slotRivalryGame(state2) {
  const riv = state2.rivalry;
  if (!riv) return;
  const rival = state2.world.schools.find((s) => s.id === riv.schoolId);
  const school = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  if (!rival || !school || rival.division !== school.division) return;
  state2.pendingNonConfChoices = state2.pendingNonConfChoices || [];
  const already = state2.pendingNonConfChoices.find((g) => g.homeId === riv.schoolId && g.awayId === school.id || g.awayId === riv.schoolId && g.homeId === school.id);
  if (already) return;
  state2.pendingNonConfChoices = state2.pendingNonConfChoices.filter((g) => g.day !== C.RIVALRY_DAY);
  const homeThisYear = (state2.season - riv.sinceSeason) % 2 === 0;
  state2.pendingNonConfChoices.push({
    day: C.RIVALRY_DAY,
    homeId: homeThisYear ? school.id : rival.id,
    awayId: homeThisYear ? rival.id : school.id,
    rivalry: true
  });
}
function getJobOpenings(state2) {
  return state2.jobOpenings || [];
}
function applicationsLeft(state2) {
  var _a, _b;
  const used = ((_b = (_a = state2.offseason) == null ? void 0 : _a.data) == null ? void 0 : _b.applicationsUsed) || 0;
  return Math.max(0, C.APPLICATIONS_MAX - used);
}
function applicationOdds(state2, opening) {
  const rep = coachRepScore(state2.playerCoach);
  const raw = C.APPLY_BASE_ODDS + (rep - opening.pull + C.OFFER_SLACK) * C.APPLY_ODDS_SLOPE;
  const odds = Math.min(0.85, Math.max(0.05, raw));
  const label = odds >= 0.55 ? "Strong Candidate" : odds >= 0.28 ? "Competitive" : "Long Shot";
  return { odds, label };
}
function applyForJob(state2, schoolId) {
  var _a;
  const data = (_a = state2.offseason) == null ? void 0 : _a.data;
  if (!data) return { ok: false, reason: "Applications open during the offseason only" };
  const opening = (state2.jobOpenings || []).find((j) => j.schoolId === schoolId);
  if (!opening) return { ok: false, reason: "That job is no longer open" };
  if (opening.status !== "open") return { ok: false, reason: "Already applied there" };
  if (applicationsLeft(state2) <= 0) return { ok: false, reason: "No applications left this offseason" };
  data.applicationsUsed = (data.applicationsUsed || 0) + 1;
  const { odds } = applicationOdds(state2, opening);
  if (Math.random() < odds) {
    opening.status = "offered";
    state2.pendingOffers = state2.pendingOffers || [];
    if (!state2.pendingOffers.some((off) => off.schoolId === opening.schoolId)) {
      state2.pendingOffers.push({
        schoolId: opening.schoolId,
        schoolName: opening.schoolName,
        division: opening.division,
        prestige: opening.prestige
      });
    }
    return { ok: true, hired: true, schoolName: opening.schoolName };
  }
  opening.status = "rejected";
  return { ok: true, hired: false, schoolName: opening.schoolName };
}
function preseasonAdvanceHook(state2, events) {
  const day = state2.day;
  if (day < 1 || day > 4) return { ok: true };
  const ctx2 = devCtx(state2);
  if (day === 1) {
    commitSeasonGoals(state2, state2.season);
    events.push({ type: "info", text: "AD expectations locked for the season." });
  }
  // [PLAYTEST 2026-08-12 item 12] Position changes lock at camp, so the last
  // honest moment to make them is the click that opens camp. Like the portal
  // stage, this is a hard gate rather than an accordion the coach may never open.
  if (day === 3 && !ctx2.devDone && !ctx2.posReviewed) {
    return { ok: false, events: [{ type: "warning", text: "Camp locks position changes for the year. Look at the board below and confirm your positions are set before you open camp." }] };
  }
  if (day === 3) {
    if (!ctx2.devDone) runDevCamp(state2);
    if (!ctx2.springResult) {
      const sg = playSpringGame(state2);
      if (sg.ok) events.push({ type: "info", text: `Spring game auto-ran \u2014 camp avg gain +${ctx2.campAvgGain}, ${sg.result.nameA} ${sg.result.scoreA}\u2013${sg.result.scoreB} ${sg.result.nameB}.` });
    }
  }
  return { ok: true };
}
function divisionClass(state2, school) {
  var _a, _b;
  if (!school) return "D3";
  if (school.division !== "D1") return school.division;
  return ((_b = (_a = state2.world.conferences) == null ? void 0 : _a[school.conf]) == null ? void 0 : _b.conferenceClass) || "midMajor";
}
// [PLAYTEST 2026-08-12 item 20] The AD decides the length, not the coach. There
// used to be three cards (2/3/5 years) and the player simply picked one, which is
// not how a contract works — a school offers you a deal and you take it or you
// don't. What he has done for them sets the number.
function adTerm(state2, coach, school) {
  var _a, _b, _c;
  const js = (_a = coach == null ? void 0 : coach.jobSecurity) != null ? _a : 50;
  const delta = (_b = coach == null ? void 0 : coach.lastDelta) != null ? _b : 0;
  const tenure = (_c = coach == null ? void 0 : coach.tenureSeasons) != null ? _c : 0;
  const score = js + delta * 6 + Math.min(3, tenure) * 4;
  if (score >= 92) {
    return { id: "ad", label: "Max Deal", years: 5, jsDelta: -6, blurb: "Five years. The AD is betting the program on you — and a deal this long makes the seat run hot the moment it stops working." };
  }
  if (score >= 72) {
    return { id: "ad", label: "Market", years: 3, jsDelta: C.EXTENSION_STABILITY_JS, blurb: "Three years — the standard re-up for a coach the AD is happy with." };
  }
  return { id: "ad", label: "Prove-It", years: 2, jsDelta: 15, blurb: "Two years. The AD wants more before he commits — win and the next one is longer." };
}
function getExtensionOffer(state2) {
  var _a, _b, _c, _d, _e, _f;
  const data = (_a = state2.offseason) == null ? void 0 : _a.data;
  if (!data) return null;
  if (data.extensionOffer !== void 0) return data.extensionOffer;
  const coach = state2.playerCoach;
  const school = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  let offer = null;
  const yearsLeft = (coach == null ? void 0 : coach.contract) ? coach.contract.endSeason - state2.season : 0;
  const eligible = coach && coach.status !== "unemployed" && yearsLeft < 2 && (((_b = coach.jobSecurity) != null ? _b : 0) >= C.EXTENSION_JS_MIN || ((_c = coach.lastDelta) != null ? _c : -1) >= 0);
  if (eligible && school) {
    const cls = divisionClass(state2, school);
    // [D6 REVISED \u2014 the loyalty ladder, owner 2026-08-11] The re-up money IS
    // the ladder. Signing a follow-up contract adds one loyalty raise: +10% of
    // the division base on every future season's recruiting pool, feeding the
    // SAME retentionStacks the declined-call path feeds, same +100% cap, and
    // forfeited the same way the day he takes another job. No per-signee
    // bonus, no championship juice multipliers \u2014 loyalty is this system's only
    // currency, mirroring the coordinator side (D5). Legacy contracts written
    // under the old terms keep their recruitBonus and keep paying (season.js
    // honors the field); new deals never mint one.
    const ladderBase = C.ECON.BASE[school.division] || C.ECON.BASE.D3;
    const ladderStacks = coach.retentionStacks || 0;
    const ladderPct = Math.min(C.PLAYER_RETENTION.CAP_PCT, ladderStacks * C.PLAYER_RETENTION.PCT_PER_OFFER);
    const ladderNextPct = Math.min(C.PLAYER_RETENTION.CAP_PCT, (ladderStacks + 1) * C.PLAYER_RETENTION.PCT_PER_OFFER);
    const ladderBump = Math.round(ladderBase * (ladderNextPct - ladderPct) / 100) * 100;
    offer = {
      years: 3,
      cls,
      ladder: {
        stacks: ladderStacks,
        pct: Math.round(ladderPct * 100),
        nextPct: Math.round(ladderNextPct * 100),
        bump: ladderBump,
        base: ladderBase,
        capped: ladderBump <= 0
      },
      terms: [adTerm(state2, coach, school)]
    };
    offer.years = offer.terms[0].years;
  }
  data.extensionOffer = offer;
  return offer;
}
function acceptExtension(state2, termId = "market") {
  var _a, _b, _c;
  const offer = getExtensionOffer(state2);
  const coach = state2.playerCoach;
  if (!offer || !coach) return { ok: false, reason: "No extension on the table" };
  if ((_b = (_a = state2.offseason) == null ? void 0 : _a.data) == null ? void 0 : _b.extensionTaken) return { ok: false, reason: "Already signed" };
  // termId is ignored — the AD's number is the only number on the table.
  const term = (offer.terms || [])[0] || { years: offer.years, jsDelta: C.EXTENSION_STABILITY_JS, label: "Standard" };
  coach.contract = {
    startSeason: state2.season + 1,
    endSeason: state2.season + term.years,
    years: term.years,
    termLabel: term.label
  };
  // [D6 ladder] The renewal IS the raise: one loyalty stack per follow-up
  // contract — the same stack the declined-call path feeds, applied by the
  // same revenue line, capped and forfeited by the same rules.
  coach.retentionStacks = (coach.retentionStacks || 0) + 1;
  coach.jobSecurity = Math.max(0, Math.min(100, ((_c = coach.jobSecurity) != null ? _c : 0) + term.jsDelta));
  state2.offseason.data.extensionTaken = true;
  return { ok: true, offer, term };
}
function declineOffersWithLeverage(state2) {
  var _a, _b;
  const n = ((_a = state2.pendingOffers) == null ? void 0 : _a.length) || 0;
  state2.pendingOffers = null;
  if (n > 0 && state2.playerCoach) {
    state2.playerCoach.jobSecurity = Math.min(
      100,
      ((_b = state2.playerCoach.jobSecurity) != null ? _b : 0) + C.OFFER_LEVERAGE_JS
    );
    // [OWNER RULING Aug 2026 — dynasty vs ladder] Turning down a live call is
    // the dynasty choice, and the AD pays for it: +10% of the division base
    // on next season's pool, permanent, stacking to +100%. One stack per
    // decline action however many suitors called (it's one season of "I'm
    // staying"). Forfeited entirely by taking any job — see acceptJob.
    state2.playerCoach.retentionStacks = (state2.playerCoach.retentionStacks || 0) + 1;
    // [D6 ladder, owner 2026-08-11] Declining suitors OUTSIDE a contract year
    // also extends the paper: the AD answers loyalty with security, +1 year on
    // the current deal. In the final year (or with no active contract) there
    // is nothing to extend — the renewal offer is the vehicle there.
    const ct = state2.playerCoach.contract;
    if (ct && ct.endSeason > state2.season) {
      ct.endSeason += 1;
      ct.years = (ct.years || 0) + 1;
    }
  }
  return n;
}
function takeClinic(state2, skill) {
  if (!state2.offseason) return { ok: false, reason: "Not in the offseason" };
  if (state2.offseason.data.clinicTaken) return { ok: false, reason: "One clinic per offseason" };
  if (!CLINIC_OPTIONS.find((c) => c.skill === skill)) return { ok: false, reason: "Unknown clinic" };
  const coach = state2.playerCoach;
  if (!coach) return { ok: false, reason: "No coach" };
  addSkillXP(coach, skill, C.CLINIC_XP);
  state2.offseason.data.clinicTaken = skill;
  return { ok: true };
}
function buildSeasonGoals(state2) {
  const school = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  if (!school) return [];
  const games = C.CONF_GAMES + C.NONCONF_GAMES;
  const coach = state2.playerCoach;
  const ghost = coach == null ? void 0 : coach.ghost;
  const base = Math.max(1, Math.round(expectedWins(school.prestige, games, coach)));
  const target = ghost ? Math.max(base + 1, Math.ceil(ghost.winPct * games + C.HEIR_MANDATE_PREMIUM)) : base;
  const goals = [{
    id: "wins",
    label: ghost ? `Win ${target}+ games \u2014 ${ghost.name} won ${ghost.record}` : `Win ${target}+ games`,
    target
  }];
  if (school.prestige >= 5) goals.push({ id: "playoff", label: "Reach the playoff" });
  else if (school.prestige >= 3) goals.push({ id: "winning", label: "Post a winning season" });
  if (state2.rivalry && Math.random() < 0.5) {
    goals.push({ id: "rivalry", label: `Beat ${state2.rivalry.schoolName} (${state2.rivalry.trophy})`, rivalId: state2.rivalry.schoolId });
  }
  return goals;
}
function commitSeasonGoals(state2, forSeason = state2.season + 1) {
  const coach = state2.playerCoach;
  if (!coach) return;
  coach.seasonGoals = { season: forSeason, goals: buildSeasonGoals(state2) };
}
function evaluateSeasonGoals(state2, events) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const coach = state2.playerCoach;
  const school = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  if (!coach || !school) return [];
  if (coach.contract && state2.season >= coach.contract.endSeason) {
    events.push({ type: "info", text: "Your contract has run out \u2014 the AD is watching before offering a new one." });
    coach.contract = null;
  }
  const sg = coach.seasonGoals;
  if (!sg || sg.season !== state2.season) return [];
  const games = C.CONF_GAMES + C.NONCONF_GAMES;
  const wins = (_d = (_c = (_a = school.recentWins) == null ? void 0 : _a[0]) != null ? _c : (_b = school.record) == null ? void 0 : _b.wins) != null ? _d : 0;
  const bracket = (_e = state2.allPlayoffs) == null ? void 0 : _e[school.division];
  const results = [];
  for (const g of sg.goals) {
    let hit = false;
    if (g.id === "wins") hit = wins >= g.target;
    if (g.id === "playoff") hit = !!((_f = bracket == null ? void 0 : bracket.seeds) == null ? void 0 : _f.includes(school.id));
    if (g.id === "winning") hit = wins > games - wins;
    if (g.id === "rivalry") {
      const rg = (state2.schedule || []).find((x) => x.result && [x.homeId, x.awayId].includes(school.id) && [x.homeId, x.awayId].includes(g.rivalId));
      hit = !!(rg && rg.result.winner === school.id);
    }
    coach.jobSecurity = Math.max(0, Math.min(
      100,
      ((_g = coach.jobSecurity) != null ? _g : 0) + (hit ? C.GOAL_JS_DELTA : -C.GOAL_JS_DELTA)
    ));
    let paid = 0;
    if (hit) {
      paid = ((_h = C.GOAL_BONUS) == null ? void 0 : _h[school.division]) || 0;
      coach.budget = (coach.budget || 0) + paid;
    }
    results.push({ label: g.label, hit, paid });
    events.push({
      type: hit ? "info" : "warning",
      text: `AD goal ${hit ? "met" : "missed"}: ${g.label}${paid ? ` \u2014 +$${paid.toLocaleString()} to the program pool` : ""}`
    });
  }
  coach.seasonGoals = null;
  return results;
}
function playerHasPendingPostseason(state2) {
  var _a, _b;
  const schoolId = state2.playerSchoolId;
  if (!schoolId) return false;
  const bowl = (state2.bowls || []).find((g) => g.homeId === schoolId || g.awayId === schoolId);
  if (bowl && !bowl.result) return true;
  const school = state2.world.schools.find((s) => s.id === schoolId);
  const bracket = (_a = state2.allPlayoffs) == null ? void 0 : _a[school == null ? void 0 : school.division];
  if (!bracket) return false;
  if (bracket.champion) return false;
  if (!((_b = bracket.seeds) == null ? void 0 : _b.includes(schoolId))) return false;
  for (const round of bracket.rounds || []) {
    for (const g of round.games || []) {
      if ((g.homeId === schoolId || g.awayId === schoolId) && g.result && g.result.winner !== schoolId) return false;
    }
  }
  return true;
}
function playoffDigest(state2) {
  var _a;
  const school = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  const bracket = (_a = state2.allPlayoffs) == null ? void 0 : _a[school == null ? void 0 : school.division];
  if (!bracket) return [];
  const nameOf = (id) => {
    const s = state2.world.schools.find((x) => x.id === id);
    return s ? `${s.abbr} ${s.nick}` : "?";
  };
  const seedOf = (id) => {
    var _a2;
    const i = (_a2 = bracket.seeds) == null ? void 0 : _a2.indexOf(id);
    return i >= 0 ? i + 1 : null;
  };
  const rounds = [];
  (bracket.rounds || []).forEach((round, i) => {
    var _a2, _b, _c, _d, _e, _f;
    const lines = [];
    for (const g of round.games || []) {
      if (!g.result) continue;
      const wId = g.result.winner;
      const lId = wId === g.homeId ? g.awayId : g.homeId;
      const upset = ((_a2 = seedOf(wId)) != null ? _a2 : 99) > ((_b = seedOf(lId)) != null ? _b : 99);
      const hs = (_d = (_c = g.result.homeScore) != null ? _c : g.result.home) != null ? _d : "";
      const as = (_f = (_e = g.result.awayScore) != null ? _e : g.result.away) != null ? _f : "";
      const score = hs !== "" && as !== "" ? wId === g.homeId ? `${hs}\u2013${as}` : `${as}\u2013${hs}` : "";
      lines.push(`${upset ? "\u26A0 " : ""}${nameOf(wId)} over ${nameOf(lId)}${score ? ` ${score}` : ""}`);
    }
    if (lines.length) rounds.push({ label: `Round ${i + 1}`, lines });
  });
  if (bracket.champion) {
    rounds.push({ label: "Champion", lines: [nameOf(bracket.champion)] });
  }
  return rounds;
}
var OFFSEASON_STAGES, PRESEASON_WEEKS, FOCUS_GROUPS, SPRING_OFF_POS, SPRING_DEF_POS, TROPHY_ITEMS, NC_WINDOW, CLINIC_OPTIONS;

OFFSEASON_STAGES = [
  {
    id: "jobmarket",
    label: "Coaching Carousel",
    type: "reveal",
    stub: "The full board of open jobs \u2014 apply, and see who is courting you."
  },
  {
    id: "awards",
    label: "Awards Ceremony",
    type: "reveal",
    stub: "Season awards, player milestones, and program milestones."
  },
  {
    id: "departures",
    label: "Departures",
    type: "reveal",
    stub: "Graduating seniors and the roster holes they leave."
  },
  {
    id: "cuts",
    label: "Cut Day",
    type: "decision",
    stub: "Trim your roster before you shop \u2014 clear dead weight, see your holes, then hit the portal to fill them."
  },
  {
    id: "portal",
    label: "Transfer Portal",
    type: "decision",
    stub: "Proven players looking for a new home. Pitch them with real budget \u2014 rivals are doing the same."
  },
  {
    id: "contract",
    label: "Contract & Signing Day",
    type: "decision",
    stub: "Sign with a suitor, or take your current school\u2019s new deal."
  },
  {
    id: "staff",
    label: "Coordinator Hires",
    type: "decision",
    stub: "Review your OC and DC before camp opens \u2014 new hires start work at Development Camp week 1."
  },
  {
    id: "clinic",
    label: "Coach Clinic",
    type: "decision",
    stub: "One directed skill retreat per offseason."
  },
  {
    id: "walkons",
    label: "Walk-On Tryouts",
    type: "decision",
    conditional: true,
    stub: "Local candidates for leftover scholarships."
  },
  {
    id: "schedule",
    label: "Scheduling & Rivalry",
    type: "decision",
    stub: "Lock non-conference games and manage the rivalry."
  }
];
PRESEASON_WEEKS = {
  1: { id: "expectations", label: "Expectations" },
  2: { id: "recruiting", label: "Recruiting" },
  3: { id: "spring", label: "Spring Game" },
  4: { id: "redshirts", label: "Redshirt Finalization" }
};
FOCUS_GROUPS = [
  { id: "balanced", label: "Balanced", positions: null },
  { id: "qb", label: "Quarterbacks", positions: ["QB"] },
  { id: "skill", label: "Skill Positions", positions: ["RB", "WR", "TE"] },
  { id: "oline", label: "Offensive Line", positions: ["OL"] },
  { id: "front7", label: "Front Seven", positions: ["DE", "DT", "OLB", "LB"] },
  { id: "secondary", label: "Secondary", positions: ["CB", "S"] }
];
SPRING_OFF_POS = ["QB", "RB", "WR", "TE", "OL"];
SPRING_DEF_POS = ["DE", "DT", "OLB", "LB", "CB", "S"];
TROPHY_ITEMS = ["Trophy", "Bell", "Bucket", "Axe", "Jug", "Cannon", "Boot", "Anvil", "Lantern", "Oar"];
NC_WINDOW = [5, 6, 7, 8];
CLINIC_OPTIONS = [
  { skill: "recruiter", label: "Recruiting Convention" },
  { skill: "developer", label: "Film-Study Retreat" },
  { skill: "roots", label: "Home-State Circuit" },
  { skill: "evaluator", label: "Area Scouting Camp" }
];

export { CLINIC_OPTIONS, FOCUS_GROUPS, PRESEASON_WEEKS, acceptExtension, acceptWalkOn, advanceOffseasonStage, aiRosterConverts, applicationOdds, applicationsLeft, applyForJob, bodyTargetForPos, buildSeasonGoals, checkRivalryResult, commitSeasonGoals, conversionPenaltyFactor, convertPosition, cutDayConversionRecs, declineOffersWithLeverage, designateRival, devCtx, earnBridges, effectiveRosterOver, evaluateConversions, evaluateSeasonGoals, getExtensionOffer, getJobOpenings, getRivalCandidates, getWalkOnPool, graduatingSeniors, initOffseason, initPreseason, injectRivalryIntoSchedule, offseasonBulkCut, pass7Rollover, playSpringGame, playerHasPendingPostseason, playoffDigest, posSizeFit, preseasonAdvanceHook, previewConversion, runDevCamp, schoolConversionRecs, setDevFocus, slotRivalryGame, swapNonConfOpponent, takeClinic, visibleStages };
