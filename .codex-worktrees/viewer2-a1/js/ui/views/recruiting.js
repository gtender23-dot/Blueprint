import { ATTRIBUTES, C, POSITIONS, ROSTER_TARGETS, attrLabel, schemeRosterTargets } from '../../constants.js';
import { skillGradeIndex } from '../../engine/coach.js';
import { ROLES_BY_POS, derivedArchetype } from '../../engine/player.js';
import { BRIDGE_CATALOG, FLAW_CATALOG, JOB_SIZE_WINDOWS, PLAY_CATALOG } from '../../engine/traits.js';
import { projectedPathToPlay } from '../../engine/portal.js';
import { actionCost, buildFunnelPool, calibreVisible, createBoardEntry, displayedRating, hasScouted, setContactAlloc, takeAction, wantSatisfaction } from '../../engine/recruiting.js';
import { defaultRecruitStrategy, getPhase, isRecruitingDay, recruitAssistLevel, weekLabel, weekShort } from '../../engine/season.js';
import { classRankOf } from '../../engine/rankings.js';
import { devForceSign, getBoardEntry, getPlayerSchool, getRecruit, notify, rerender, state } from '../../state.js';
import { tipTerm } from '../manual/tips.js';
import { archetypeLabel, escapeHtml, fmtMoney, fullName, ratingColor, recruitDistance, renderPlayerPortrait } from '../../utils.js';

function isScouted(recruitId) {
  var _a;
  return hasScouted(state.playerCoach, recruitId) || !!((_a = state.settings) == null ? void 0 : _a.revealScouting);
}
var ARCHETYPES_BY_POS = ROLES_BY_POS;
function cutLineInfo(recruit, playerEntry) {
  var _a, _b, _c, _d, _e, _f;
  const NEXT_CUT_N = { open: 8, top8: 5, top5: 3, top3: 1 };
  const NEXT_LABEL = { open: "Top 8 cut", top8: "Top 5 cut", top5: "Top 3 cut", top3: "Decision" };
  const STAGE_LABEL = { open: "Open", top8: "Top 8", top5: "Top 5", top3: "Top 3", committed: "Committed" };
  const stage = recruit.funnelStage || "open";
  const cutN = (_a = NEXT_CUT_N[stage]) != null ? _a : 8;
  const pool = buildFunnelPool(
    recruit,
    playerEntry,
    state.playerSchoolId,
    (_e = (_d = (_c = (_b = state.world) == null ? void 0 : _b.schools) == null ? void 0 : _c.find((s) => s.id === state.playerSchoolId)) == null ? void 0 : _d.division) != null ? _e : null
  );
  const cutVal = pool.length >= cutN ? pool[cutN - 1].interest : pool.length ? pool[pool.length - 1].interest : null;
  const playerInterest = playerEntry && !playerEntry.eliminated ? playerEntry.interest || 0 : null;
  const margin = playerInterest != null && cutVal != null ? Math.round(playerInterest - cutVal) : null;
  const leader = pool[0] || null;
  const scouted = hasScouted(state.playerCoach, recruit.id) || !!((_f = state.settings) == null ? void 0 : _f.revealScouting);
  return {
    stage,
    stageLabel: STAGE_LABEL[stage] || stage,
    cutN,
    cutVal,
    playerInterest,
    margin,
    leader,
    nextLabel: NEXT_LABEL[stage] || "",
    scouted,
    pool
  };
}
function funnelStageChip(stage, eliminated) {
  if (eliminated) return '<span class="funnel-chip funnel-elim">ELIM</span>';
  const LABELS = { open: "OPEN", top8: "TOP 8", top5: "TOP 5", top3: "TOP 3", committed: "COMMITTED" };
  return `<span class="funnel-chip funnel-${stage || "open"}">${LABELS[stage] || (stage || "open").toUpperCase()}</span>`;
}
function renderCutLineRow(recruit, entry, cli, school) {
  var _a, _b, _c, _d, _e, _f;
  if (recruit.committed) {
    const winner = recruit.committed === (school == null ? void 0 : school.id) ? "Your Program" : `<span class="team-link" data-scout-team="${recruit.committed}">${escapeHtml(((_a = state.world.schools.find((s) => s.id === recruit.committed)) == null ? void 0 : _a.name) || "another school")}</span>`;
    return `<span class="cutline-text muted">Signed with ${winner}</span>`;
  }
  if (entry.eliminated) {
    return `<span class="cutline-text cutline-eliminated">Eliminated from consideration</span>`;
  }
  if (cli.cutVal == null) return "";
  const marginClass = cli.margin >= 5 ? "margin-safe" : cli.margin >= 0 ? "margin-tight" : "margin-behind";
  const marginStr = cli.margin >= 0 ? `+${cli.margin}` : `${cli.margin}`;
  const leanName = ((_b = cli.leader) == null ? void 0 : _b.isPlayer) ? "You" : ((_c = cli.leader) == null ? void 0 : _c.schoolId) ? `<span class="team-link" data-scout-team="${cli.leader.schoolId}">${escapeHtml(((_e = (_d = state.world.schools.find((s) => s.id === cli.leader.schoolId)) == null ? void 0 : _d.name) == null ? void 0 : _e.substring(0, 12)) || "?")}</span>` : "\u2014";
  return `
  <span class="cutline-stat"><span class="muted">${cli.nextLabel}:</span> <span class="cutline-val">${Math.round(cli.cutVal)}</span></span>
  <span class="cutline-margin ${marginClass}">${marginStr}</span>
  <span class="cutline-lean muted">Lean: <span class="lean-${((_f = cli.leader) == null ? void 0 : _f.isPlayer) ? "you" : "rival"}">${leanName}</span></span>
`;
}
function renderTop3Row(recruit, cli) {
  if (recruit.committed) return "";
  const pool = cli && cli.pool || [];
  if (!pool.length) return "";
  const top3 = pool.slice(0, 3);
  const chips = top3.map((e, i) => {
    var _a, _b;
    const nm = e.isPlayer ? "YOU" : escapeHtml(((_b = (_a = state.world.schools.find((s) => s.id === e.schoolId)) == null ? void 0 : _a.name) == null ? void 0 : _b.substring(0, 11)) || "?");
    const fill = e.isPlayer ? "var(--green)" : e.bowedOut ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.28)";
    const rankMark = i === 0 ? "\u{1F3C6}" : `${i + 1}.`;
    return `<div class="top3-item${e.isPlayer ? " top3-you" : ""}${e.bowedOut ? " top3-bowed" : ""}">
      <span class="top3-rank">${rankMark}</span>
      <span class="top3-name">${nm}</span>
      <div class="top3-bar-track"><div class="top3-bar-fill" style="width:${Math.min(100, Math.round(e.interest))}%;background:${fill}"></div></div>
      <span class="top3-val">${Math.round(e.interest)}</span>
    </div>`;
  }).join("");
  const extra = pool.length > 3 ? `<span class="top3-more muted">+${pool.length - 3} more</span>` : "";
  return `<div class="board-top3"><div class="top3-label">TOP 3${extra ? ` <span class="top3-more-wrap">${extra}</span>` : ""}</div>${chips}</div>`;
}
function renderFunnelStatus(recruit, entry, school) {
  var _a, _b, _c;
  const cli = cutLineInfo(recruit, entry || null);
  if (recruit.committed) {
    const winner = recruit.committed === (school == null ? void 0 : school.id) ? "Your Program" : `<span class="team-link" data-scout-team="${recruit.committed}">${escapeHtml(((_a = state.world.schools.find((s) => s.id === recruit.committed)) == null ? void 0 : _a.name) || "another school")}</span>`;
    return `<div class="funnel-status-header">${funnelStageChip("committed", false)}</div>
          <div class="cutline-text muted" style="margin-top:6px">Signed with ${winner}</div>`;
  }
  const stageHeader = `<div class="funnel-status-header">
  <span class="funnel-status-label">RECRUITING STAGE</span>
  ${funnelStageChip(recruit.funnelStage, entry == null ? void 0 : entry.eliminated)}
</div>`;
  if (entry == null ? void 0 : entry.eliminated) {
    return `${stageHeader}<div class="cutline-text cutline-eliminated" style="margin-top:6px">Eliminated \u2014 no longer considering your program</div>`;
  }
  const risingHtml = cli.pool.slice(0, 5).map((e) => {
    var _a2, _b2;
    const name = e.isPlayer ? "YOU" : `<span class="team-link" data-scout-team="${e.schoolId}">${escapeHtml(((_b2 = (_a2 = state.world.schools.find((s) => s.id === e.schoolId)) == null ? void 0 : _a2.name) == null ? void 0 : _b2.substring(0, 12)) || "?")}</span>`;
    const fillColor = e.isPlayer ? "var(--green)" : e.bowedOut ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.25)";
    return `<div class="comp-item${e.bowedOut ? " comp-bowed" : ""}">
    <span class="comp-name${e.isPlayer ? " you" : ""}">${name}${e.bowedOut ? ' <span class="comp-bowed-tag">backed off</span>' : ""}</span>
    <div class="comp-bar-track"><div class="comp-bar-fill" style="width:${Math.min(100, e.interest)}%;background:${fillColor}"></div></div>
    <span class="comp-val">${Math.round(e.interest)}</span>
  </div>`;
  }).join("");
  const cutDetail = cli.cutVal != null && entry ? `
  <div class="funnel-cutline-detail">
    <div class="cutline-detail-row">
      <span class="muted">${cli.nextLabel}</span>
      <span class="cutline-val">${Math.round(cli.cutVal)}</span>
    </div>
    ${cli.margin != null ? `<div class="cutline-detail-row">
      <span class="muted">Your margin</span>
      <span class="cutline-margin ${cli.margin >= 5 ? "margin-safe" : cli.margin >= 0 ? "margin-tight" : "margin-behind"}">${cli.margin >= 0 ? "+" : ""}${cli.margin}</span>
    </div>` : ""}
    ${cli.leader ? `<div class="cutline-detail-row">
      <span class="muted">Lean</span>
      <span>${cli.leader.isPlayer ? '<span class="lean-you">Leaning You</span>' : `<span class="lean-rival">Leaning <span class="team-link" data-scout-team="${cli.leader.schoolId}">${escapeHtml(((_c = (_b = state.world.schools.find((s) => s.id === cli.leader.schoolId)) == null ? void 0 : _b.name) == null ? void 0 : _c.substring(0, 14)) || "?")}</span></span>`}</span>
    </div>` : ""}
  </div>
` : "";
  return `
  ${stageHeader}
  ${cutDetail}
  <div class="comp-header" style="margin-top:${entry ? "4px" : "10px"}">INTEREST COMPARISON</div>
  ${risingHtml || '<div class="muted" style="font-size:11px">No active rivals tracked</div>'}
`;
}
var WANT_LABEL = { DEVELOPMENT: "Development", PEDIGREE: "Pedigree", PROGRAM: "Big Program" };
var PT_IMP_LABEL = { low: "Playing time (minor)", med: "Playing time", high: "Playing time (KEY)" };
function renderPtWantTag(recruit) {
  if (!recruit.ptWant) return "";
  const school = getPlayerSchool();
  const path = projectedPathToPlay(recruit, school);
  const met = path.score >= 70 ? 1 : path.score <= 40 ? -1 : 0;
  const cls = met > 0 ? "want-met" : met < 0 ? "want-unmet" : "want-neutral";
  const mark = met > 0 ? "\u2713" : met < 0 ? "\u2715" : "\xB7";
  return `<span class="want-tag ${cls}" title="Path at your school: ${path.label} (${path.aheadReturning} returning ahead)">${PT_IMP_LABEL[recruit.ptWant] || "Playing time"} ${mark} \u2014 ${path.label}</span>`;
}
function renderWantTags(recruit) {
  if (!isScouted(recruit.id)) return '<span class="fog">Wants: ?</span>';
  const wants = recruit.wants || [];
  const coach = state.playerCoach;
  const school = getPlayerSchool();
  const ptTag = renderPtWantTag(recruit);
  if (wants.length === 0 && !ptTag) return '<span class="muted">No strong preferences</span>';
  const wantTags = wants.map((w) => {
    const s = wantSatisfaction(w, coach, school);
    const cls = s > 0 ? "want-met" : s < 0 ? "want-unmet" : "want-neutral";
    const mark = s > 0 ? "\u2713" : s < 0 ? "\u2715" : "\xB7";
    return `<span class="want-tag ${cls}">${WANT_LABEL[w] || w} ${mark}</span>`;
  }).join(" ");
  return [wantTags, ptTag].filter(Boolean).join(" ");
}
var activeTab = "search";
var searchFilters = {
  pos: "",
  arch: "",
  maxDist: 9999,
  status: "undecided",
  sort: "visionRating",
  posRank: 0,
  // 0 = any; else top-N at the position
  // Up to 4 attribute threshold filters: { attr, op ('gte'|'lte'), val }
  attrFilters: [
    { attr: "", op: "gte", val: 0 },
    { attr: "", op: "gte", val: 0 },
    { attr: "", op: "gte", val: 0 },
    { attr: "", op: "gte", val: 0 }
  ]
};
var profileRecruitId = null;
var profileReturnTab = "search";
var signingsScope = "mine";
function openRecruitProfile(id) {
  if (activeTab !== "profile") profileReturnTab = activeTab;
  profileRecruitId = id;
  activeTab = "profile";
  rerender();
}
function recruitingCanBack() {
  return activeTab === "profile";
}
function recruitingGoBack() {
  if (activeTab !== "profile") return false;
  activeTab = profileReturnTab || "search";
  rerender();
  return true;
}
var boardView = "cards";
var boardSortCol = "interest";
var boardSortDir = -1;
function boardSortValue(col, entry, r, school) {
  switch (col) {
    case "position":
      return r.position || "";
    case "archetype":
      return archetypeLabel(derivedArchetype(r)) || "";
    case "name":
      return fullName(r) || "";
    case "vis":
      return displayedRating(state.playerCoach, r) || 0;
    case "true":
      return isScouted(r.id) ? r.compositeRating || 0 : -1;
    case "potential":
      return isScouted(r.id) ? { average: 1, good: 2, great: 3, sky: 4 }[r.potentialBand] || 0 : -1;
    case "dist":
      return recruitDistance(r, school);
    case "interest":
      return entry.interest || 0;
    case "cut": {
      const cli = cutLineInfo(r, entry);
      return cli.margin != null ? cli.margin : -999;
    }
    case "stage":
      return r.funnelStage || "";
    default:
      return col in (r.attributes || {}) ? r.attributes[col] : 0;
  }
}
function renderRecruiting() {
  var _a, _b;
  if (profileRecruitId && !((_b = (_a = state.world) == null ? void 0 : _a.recruits) == null ? void 0 : _b.find((r) => r.id === profileRecruitId))) {
    profileRecruitId = null;
    if (activeTab === "profile") activeTab = "search";
  }
  const phase = getPhase(state.day);
  const isRecruitingOpen = isRecruitingDay(state.day);
  const coach = state.playerCoach;
  const school = getPlayerSchool();
  const myClassCount = countMyClass(school);
  return `
  <div class="view-recruiting">
    <div class="view-header">
      <div>
        <h1 class="view-title">Recruiting</h1>
        <div class="view-subtitle">
          Budget: <span class="budget-highlight">$${(((coach == null ? void 0 : coach.budget) || 0) / 1e3).toFixed(1)}k</span>
          &middot; ${(coach == null ? void 0 : coach.scholarshipsAvailable) || 0} scholarships
          ${!isRecruitingOpen ? ' &middot; <span class="phase-closed">Recruiting closed</span>' : ""}
        </div>
      </div>
      <div class="rec-tabs">
        <button class="rec-tab${activeTab === "search" ? " active" : ""}" data-tab="search">Search</button>
        <button class="rec-tab${activeTab === "board" ? " active" : ""}" data-tab="board">
          Board <span class="tab-count">${((coach == null ? void 0 : coach.recruitBoard) || []).filter((e) => {
    var _a2, _b2;
    const r = (_b2 = (_a2 = state.world) == null ? void 0 : _a2.recruits) == null ? void 0 : _b2.find((x) => x.id === e.recruitId);
    return r && !r.committed;
  }).length || 0}</span>
        </button>
        <button class="rec-tab${activeTab === "signings" ? " active" : ""}" data-tab="signings">
          Signings <span class="tab-count">${myClassCount}</span>
        </button>
        ${profileRecruitId ? `<button class="rec-tab${activeTab === "profile" ? " active" : ""}" data-tab="profile">Profile</button>` : ""}
        <button class="rec-tab${activeTab === "assist" ? " active" : ""}" data-tab="assist">Assist${recruitAssistLevel(state) !== "off" ? ' <span class="assist-on-dot">\u25CF</span>' : ""}</button>
      </div>
    </div>

    ${activeTab === "search" ? renderSearch(school, isRecruitingOpen) : ""}
    ${activeTab === "board" ? renderBoard(school, isRecruitingOpen) : ""}
    ${activeTab === "signings" ? renderSignings(school) : ""}
    ${activeTab === "profile" && profileRecruitId ? renderProfile(profileRecruitId, school, isRecruitingOpen) : ""}
    ${activeTab === "assist" ? renderAssist(school) : ""}
  </div>
`;
}
function countMyClass(school) {
  var _a;
  if (!school) return 0;
  return (((_a = state.world) == null ? void 0 : _a.recruits) || []).filter(
    (r) => r.committed === school.id && (r.decisionStatus === "committed" || r.decisionStatus === "signed")
  ).length;
}
function applyAttrFilter(r, f) {
  if (!f.attr) return true;
  const v = r.attributes[f.attr];
  if (v == null) return true;
  return f.op === "lte" ? v <= f.val : v >= f.val;
}
function searchResults(school) {
  var _a;
  const recruits = ((_a = state.world) == null ? void 0 : _a.recruits) || [];
  const calibre = (r) => calibreVisible(r, school == null ? void 0 : school.division);
  let list = recruits.filter((r) => {
    if (!calibre(r)) return false;
    if (searchFilters.pos && r.position !== searchFilters.pos) return false;
    if (searchFilters.arch && derivedArchetype(r) !== searchFilters.arch) return false;
    const dist = recruitDistance(r, school);
    if (dist > searchFilters.maxDist) return false;
    if (searchFilters.status === "undecided" && r.committed) return false;
    for (const f of searchFilters.attrFilters) if (!applyAttrFilter(r, f)) return false;
    return true;
  });
  const key = searchFilters.sort;
  list.sort((a, b) => {
    const pa = sortVal(a, key), pb = sortVal(b, key);
    if (pb !== pa) return pb - pa;
    return 0;
  });
  if (searchFilters.posRank > 0) {
    list = list.filter((r) => (r.positionRank || 999) <= searchFilters.posRank);
  }
  return list;
}
var POS_GAP_BASE = { QB: -1, RB: 13, FB: 1, WR: 1, TE: -4, OL: -3, DE: 7, DT: -1, OLB: -2, LB: -3, CB: 6, S: -2, K: -1, P: 0 };
function buildTag(r) {
  var _a;
  const canSee = hasScouted(state.playerCoach, r.id) || skillGradeIndex(state.playerCoach, "evaluator") >= 4 || ((_a = state.settings) == null ? void 0 : _a.revealScouting);
  if (!canSee || !r.attributes) return "";
  const avg2 = (ks) => ks.reduce((s, a) => s + (r.attributes[a] || 0), 0) / ks.length;
  const gap = avg2(["SPD", "AGI", "PWR", "STR", "JMP"]) - avg2(["HND", "SEC", "TEC", "AWR"]) - (POS_GAP_BASE[r.position] || 0);
  if (gap >= 17) return ' <span class="build-tag tag-raw" title="Elite testing sheet, raw skills \u2014 tests better than he plays">\u26A0 raw</span>';
  if (gap <= -15) return ' <span class="build-tag tag-gamer" title="Plays above the sheet \u2014 skills outrun the testing numbers">\u{1F3C8} gamer</span>';
  return "";
}
function sortVal(r, key) {
  var _a;
  if (key === "visionRating") return r.visionRating || 0;
  if (key === "compositeRating") return isScouted(r.id) ? r.compositeRating || 0 : -1;
  if (key === "distance") return -recruitDistance(r, getPlayerSchool());
  if (key === "ras") return r.ras || 0;
  if (ATTRIBUTES.includes(key)) return ((_a = r.attributes) == null ? void 0 : _a[key]) || 0;
  return r[key] || 0;
}
// [PLAYTEST 2026-08-12 item 19] Was renderGradNeeds — it counted graduating
// seniors per position and hid any position with zero seniors, so a room three
// under target showed nothing while a room with two seniors and nine returning
// bodies screamed "need". The real math is classNeedRows (target vs RETURNING);
// the Search screen now uses it, and the chips filter the list.
function renderClassNeeds(school) {
  var _a, _b;
  if (!school) return "";
  const recruits = ((_a = state.world) == null ? void 0 : _a.recruits) || [];
  const byId = new Map(recruits.map((r) => [r.id, r]));
  const boardByPos = {};
  for (const e of ((_b = state.playerCoach) == null ? void 0 : _b.recruitBoard) || []) {
    if (e.eliminated) continue;
    const r = byId.get(e.recruitId);
    if (r && !r.committed) boardByPos[r.position] = (boardByPos[r.position] || 0) + 1;
  }
  const klass = recruits.filter((r) => r.committed === school.id);
  const rows = classNeedRows(school, klass);
  if (rows.length === 0) return "";
  const seniorsOut = (pos) => school.roster.filter((p) => p.position === pos && p.classYear === "SR").length;
  return `
  <div class="grad-needs">
    <span class="filter-label">CLASS NEEDS \u2014 tap a position to filter</span>
    <div class="grad-need-chips">
      ${rows.map((nr) => {
        const onBoard = boardByPos[nr.pos] || 0;
        const covered = nr.filled >= nr.target;
        const out = seniorsOut(nr.pos);
        return `
        <button class="grad-need-chip${covered ? " grad-need-covered" : " grad-need-open"}${searchFilters.pos === nr.pos ? " active" : ""}" data-need-pos="${nr.pos}"
          title="${nr.filled} signed of ${nr.target} needed \u00B7 ${onBoard} on board${out ? ` \u00B7 ${out} senior${out !== 1 ? "s" : ""} leaving` : ""}">
          <span class="grad-need-pos">${nr.pos}</span>
          <span class="grad-need-in">${nr.filled}/${nr.target}</span>
          <span class="grad-need-board">${onBoard}\u25CE</span>
        </button>`;
      }).join("")}
    </div>
  </div>
`;
}
function renderSearch(school, isOpen) {
  const results = searchResults(school);
  const shown = results.slice(0, 100);
  const opt = (val, cur, label) => `<option value="${val}" ${cur === val ? "selected" : ""}>${label}</option>`;
  return `
  <div class="rec-search">
    <div class="gp-tip tip-info">\u25B8 Every attribute is on the table \u2014 but the composite verdict isn't. TRUE rating and POTENTIAL stay hidden until you scout him. RAS is a hypothesis, not a verdict: \u26A0 raw = tests better than he plays, \u{1F3C8} gamer = plays better than he tests.</div>
    <div class="search-filters card">
      <div class="card-header"><span class="card-title">RECRUIT SEARCH</span></div>

      <!-- Row 1: position chips -->
      <div class="sf-row">
        <label class="filter-label">POSITION</label>
        <div class="filter-chips">
          <button class="filter-chip${!searchFilters.pos ? " active" : ""}" data-sf-pos="">ALL</button>
          ${POSITIONS.map((p) => `<button class="filter-chip${searchFilters.pos === p ? " active" : ""}" data-sf-pos="${p}">${p}</button>`).join("")}
        </div>
      </div>

      ${(ARCHETYPES_BY_POS[searchFilters.pos] || []).length ? `
      <div class="sf-row">
        <label class="filter-label">ARCHETYPE</label>
        <div class="filter-chips">
          <button class="filter-chip${!searchFilters.arch ? " active" : ""}" data-sf-arch="">ALL</button>
          ${(ARCHETYPES_BY_POS[searchFilters.pos] || []).map((a) => `<button class="filter-chip${searchFilters.arch === a ? " active" : ""}" data-sf-arch="${a}">${archetypeLabel(a)}</button>`).join("")}
        </div>
      </div>` : ""}

      <!-- Row 2: dropdown grid like WIS -->
      <div class="sf-grid">
        <div class="sf-field">
          <label class="filter-label">MAX DISTANCE</label>
          <select class="form-select" id="sf-dist">
            ${opt(9999, searchFilters.maxDist, "Any")}
            ${opt(300, searchFilters.maxDist, "Local (\u2264300mi \u2014 Roots radius)")}
            ${opt(600, searchFilters.maxDist, "Regional (\u2264600mi)")}
            ${opt(1200, searchFilters.maxDist, "National (\u22641200mi)")}
          </select>
        </div>
        <div class="sf-field">
          <label class="filter-label">POSITION RANK</label>
          <select class="form-select" id="sf-posrank">
            ${opt(0, searchFilters.posRank, "Any")}
            ${opt(10, searchFilters.posRank, "Top 10")}
            ${opt(25, searchFilters.posRank, "Top 25")}
            ${opt(50, searchFilters.posRank, "Top 50")}
            ${opt(100, searchFilters.posRank, "Top 100")}
          </select>
        </div>
        <div class="sf-field">
          <label class="filter-label">DECISION STATUS</label>
          <select class="form-select" id="sf-status">
            ${opt("undecided", searchFilters.status, "Unsigned")}
            ${opt("all", searchFilters.status, "All")}
          </select>
        </div>
        <div class="sf-field">
          <label class="filter-label">ORDER BY</label>
          <select class="form-select" id="sf-sort">
            ${opt("visionRating", searchFilters.sort, "Visibility")}
            ${opt("compositeRating", searchFilters.sort, "True Rating (scouted)")}
            ${opt("distance", searchFilters.sort, "Distance")}
            ${opt("ras", searchFilters.sort, "Athletics")}
            ${ATTRIBUTES.map((a) => opt(a, searchFilters.sort, attrLabel(a))).join("")}
          </select>
        </div>
      </div>

      <!-- Attribute threshold filters (the power tool) -->
      <div class="sf-attrs">
        <div class="sf-attrs-head">
          <label class="filter-label">ATTRIBUTE FILTERS</label>
          <span class="sf-attrs-hint">Stack conditions to find scheme fits \u2014 e.g. STR \u2265 50 AND PWR \u2265 50</span>
        </div>
        <div class="sf-attr-rows">
          ${searchFilters.attrFilters.map((f, i) => `
            <div class="sf-attr-row">
              <select class="form-select sf-attr-pick" data-attr-idx="${i}">
                <option value="" ${!f.attr ? "selected" : ""}>\u2014</option>
                ${ATTRIBUTES.map((a) => `<option value="${a}" ${f.attr === a ? "selected" : ""}>${attrLabel(a)}</option>`).join("")}
              </select>
              <select class="form-select sf-attr-op" data-attr-idx="${i}">
                <option value="gte" ${f.op === "gte" ? "selected" : ""}>\u2265</option>
                <option value="lte" ${f.op === "lte" ? "selected" : ""}>\u2264</option>
              </select>
              <input class="gp-num sf-attr-val" data-attr-idx="${i}" type="number" min="0" max="99" value="${f.val}" />
            </div>
          `).join("")}
        </div>
        <button class="btn-ghost btn-sm" id="sf-clear-attrs">Clear attribute filters</button>
      </div>

      ${renderClassNeeds(school)}

      <div class="search-results-count">${results.length} recruits match${results.length > 100 ? ` (showing first 100)` : ""}</div>
    </div>

    <div class="card">
      <table class="data-table recruit-table">
        <thead>
          <tr>
            <th>Rank</th><th>Pos</th><th>Arch</th><th>Name</th>
            <th title="Public visibility ranking">Vis</th>
            <th title="True rating \u2014 scout to reveal">True</th>
            <th>Pot</th>
            ${ATTRIBUTES.map((a) => `<th class="attr-col">${attrLabel(a)}</th>`).join("")}
            <th>Dist</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${shown.map((r, i) => {
    var _a;
    const dist = recruitDistance(r, school);
    const onBoard = !!getBoardEntry(r.id);
    const interest = ((_a = getBoardEntry(r.id)) == null ? void 0 : _a.interest) || 0;
    const scouted = isScouted(r.id);
    return `
              <tr class="recruit-row" data-recruit-id="${r.id}">
                <td class="muted">#${r.positionRank || i + 1}</td>
                <td><span class="pos-chip pos-${r.position}">${r.position}</span></td>
                <td>${derivedArchetype(r) ? `<span class="arch-chip">${archetypeLabel(derivedArchetype(r))}</span>` : '<span class="muted">\u2014</span>'}</td>
                <td class="player-name-cell">${escapeHtml(fullName(r))}${buildTag(r)}</td>
                <td><span class="rating-chip rating-${ratingColor(displayedRating(state.playerCoach, r))}">${displayedRating(state.playerCoach, r)}</span></td>
                <td>${scouted ? `<span class="rating-chip rating-${ratingColor(r.compositeRating)}">${Math.round(r.compositeRating)}</span>` : '<span class="fog">?</span>'}</td>
                <td>${scouted ? potShort(r.potentialBand) : '<span class="fog">?</span>'}</td>
                ${ATTRIBUTES.map(
      (a) => (
        // Attributes are always visible (design revision: the fog
        // hid too much of the fun). Scouting still gates TRUE
        // RATING and POTENTIAL — the composite verdict, not the
        // raw numbers.
        `<td class="attr-cell ${ratingColor(r.attributes[a])}">${r.attributes[a]}</td>`
      )
    ).join("")}
                <td class="muted">${dist >= 9999 ? "\u2014" : `${dist}mi`}</td>
                <td>${recruitStatusChip(r, interest)}</td>
                <td class="table-action-cell">
                  ${onBoard ? `<button class="btn-ghost btn-sm view-profile-btn" data-recruit-id="${r.id}">View</button>` : isOpen ? `<button class="btn-primary btn-sm add-board-btn" data-recruit-id="${r.id}">+ Board</button>` : ""}
                </td>
              </tr>
            `;
  }).join("")}
          ${shown.length === 0 ? '<tr><td colspan="22" class="empty-state">No recruits match your filters</td></tr>' : ""}
        </tbody>
      </table>
    </div>
  </div>
`;
}
function renderBoard(school, isOpen) {
  var _a;
  const board = (((_a = state.playerCoach) == null ? void 0 : _a.recruitBoard) || []).filter((e) => {
    var _a2, _b;
    const r = (_b = (_a2 = state.world) == null ? void 0 : _a2.recruits) == null ? void 0 : _b.find((x) => x.id === e.recruitId);
    return r && !r.committed;
  });
  if (board.length === 0) {
    return `<div class="card"><div class="empty-state">No active recruits on board. Search for recruits and add them \u2014 signed kids live in the Signings tab.</div></div>`;
  }
  const viewToggle = `
  <div class="signings-scope-toggle">
    <button class="scope-btn${boardView === "cards" ? " active" : ""}" data-boardview="cards">Cards</button>
    <button class="scope-btn${boardView === "table" ? " active" : ""}" data-boardview="table">Table</button>
  </div>`;
  if (boardView === "table") {
    return `<div class="rec-board">${viewToggle}${renderBoardTable(school, board)}</div>`;
  }
  return `
  <div class="rec-board">
    ${viewToggle}
    <div class="gp-tip tip-info">\u25B8 Your board is the war: pour weekly effort into the recruits you want, watch the cut line, and pitch what each kid cares about. Out-work and out-bid the other suitors \u2014 build a clear, lasting lead and the kid commits (blowouts settle fast, dogfights go to the wire). Verbals are final: an early close frees that money for the next name.</div>
    ${board.map((entry) => {
    const recruit = state.world.recruits.find((r) => r.id === entry.recruitId);
    if (!recruit) return "";
    const dist = recruitDistance(recruit, school);
    const cli = cutLineInfo(recruit, entry);
    const barColor = entry.eliminated ? "var(--red)" : cli.margin != null && cli.margin >= 0 ? "var(--green)" : "var(--gold)";
    return `
        <div class="board-card card">
          <div class="board-card-header">
            <div class="board-left">
              <span class="pos-chip pos-${recruit.position}">${recruit.position}</span>
              <div>
                <div class="board-name">${escapeHtml(fullName(recruit))}${buildTag(recruit)}</div>
                <div class="board-meta muted">
                  ${derivedArchetype(recruit) ? `<span class="arch-chip board-meta-item">${archetypeLabel(derivedArchetype(recruit))}</span><span class="board-meta-sep">\xB7</span>` : ""}
                  ${isScouted(recruit.id) ? `<span class="board-meta-item">${Math.round(recruit.compositeRating)} true</span><span class="board-meta-sep">\xB7</span><span class="board-meta-item">${potShort(recruit.potentialBand)} pot</span>` : '<span class="fog board-meta-item">Unscouted</span>'}
                  <span class="board-meta-sep">\xB7</span><span class="board-meta-item">${dist < 9999 ? dist + "mi" : "?"}</span>
                  <span class="board-meta-sep">\xB7</span><span class="board-meta-item">${funnelStageChip(recruit.funnelStage, entry.eliminated)}</span>
                </div>
              </div>
            </div>
            <div class="board-right">
              <div class="interest-meter">
                <div class="interest-bar-track">
                  <div class="interest-bar-fill" style="width:${Math.min(100, entry.interest)}%;background:${barColor}"></div>
                </div>
                <span class="interest-val">${Math.round(entry.interest)}/100</span>
              </div>
            </div>
          </div>

          <div class="board-cutline">
            ${renderCutLineRow(recruit, entry, cli, school)}
          </div>

          ${!recruit.committed ? renderTop3Row(recruit, cli) : ""}

          ${isOpen && !recruit.committed ? renderContactControl(entry, recruit) : ""}

          <div class="board-actions">
            ${isOpen && !recruit.committed ? renderActionButtons(entry, recruit, school) : recruit.committed ? `<span class="muted">${recruit.committed === (school == null ? void 0 : school.id) ? "\u2713 Committed to your program" : "Committed elsewhere"}</span>` : '<span class="muted">Recruiting closed</span>'}
            <button class="btn-ghost btn-sm view-profile-btn" data-recruit-id="${recruit.id}">Profile \u2192</button>
          </div>

          ${!recruit.committed ? `
          <div class="board-manage">
            ${entry.offered && !recruit.committed && isOpen ? `<button class="btn-ghost btn-sm rescind-btn" data-recruit-id="${recruit.id}">Rescind Offer</button>` : ""}
            <button class="btn-ghost btn-sm btn-danger-ghost drop-btn" data-recruit-id="${recruit.id}">Drop</button>
          </div>
          ` : ""}

          <div class="board-spent muted">Spent: ${fmtMoney(entry.spent)} | Actions: ${entry.actions.length}</div>
        </div>
      `;
  }).join("")}
  </div>
`;
}
function renderBoardTable(school, board) {
  const rows = board.map((entry) => ({ entry, recruit: state.world.recruits.find((r) => r.id === entry.recruitId) })).filter((x) => x.recruit).sort((a, b) => {
    const av = boardSortValue(boardSortCol, a.entry, a.recruit, school);
    const bv = boardSortValue(boardSortCol, b.entry, b.recruit, school);
    if (typeof av === "string" || typeof bv === "string") {
      return boardSortDir * String(av).localeCompare(String(bv));
    }
    return boardSortDir * (av - bv);
  });
  const arrow = (col) => boardSortCol === col ? boardSortDir < 0 ? " \u2193" : " \u2191" : "";
  const sh = (col, label, title) => `<th class="sortable${boardSortCol === col ? " sorted" : ""}" data-boardsort="${col}"${title ? ` title="${title}"` : ""}>${label}${arrow(col)}</th>`;
  return `
  <div class="card">
    <table class="data-table recruit-table">
      <thead>
        <tr>
          ${sh("position", "Pos")}${sh("archetype", "Arch")}${sh("name", "Name")}
          ${sh("vis", "Vis", "Public visibility ranking")}
          ${sh("true", "True", "True rating \u2014 scout to reveal")}
          ${sh("potential", "Pot")}
          ${ATTRIBUTES.map((a) => `<th class="attr-col sortable${boardSortCol === a ? " sorted" : ""}" data-boardsort="${a}">${attrLabel(a)}${arrow(a)}</th>`).join("")}
          ${sh("dist", "Dist")}
          ${sh("interest", "Int", "Your interest score with him")}
          ${sh("cut", "Cut", "Margin above/below the next cut line")}
          ${sh("stage", "Stage")}<th></th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(({ entry, recruit: r }) => {
    const dist = recruitDistance(r, school);
    const scouted = isScouted(r.id);
    const cli = cutLineInfo(r, entry);
    const marginCell = r.committed || entry.eliminated || cli.margin == null ? '<span class="muted">\u2014</span>' : `<span class="cutline-margin ${cli.margin >= 5 ? "margin-safe" : cli.margin >= 0 ? "margin-tight" : "margin-behind"}">${cli.margin >= 0 ? "+" : ""}${cli.margin}</span>`;
    return `
            <tr class="recruit-row" data-recruit-id="${r.id}">
              <td><span class="pos-chip pos-${r.position}">${r.position}</span></td>
              <td>${derivedArchetype(r) ? `<span class="arch-chip">${archetypeLabel(derivedArchetype(r))}</span>` : '<span class="muted">\u2014</span>'}</td>
              <td class="player-name-cell">${escapeHtml(fullName(r))}${buildTag(r)}</td>
              <td><span class="rating-chip rating-${ratingColor(displayedRating(state.playerCoach, r))}">${displayedRating(state.playerCoach, r)}</span></td>
              <td>${scouted ? `<span class="rating-chip rating-${ratingColor(r.compositeRating)}">${Math.round(r.compositeRating)}</span>` : '<span class="fog">?</span>'}</td>
              <td>${scouted ? potShort(r.potentialBand) : '<span class="fog">?</span>'}</td>
              ${ATTRIBUTES.map((a) => `<td class="attr-cell ${ratingColor(r.attributes[a])}">${r.attributes[a]}</td>`).join("")}
              <td class="muted">${dist >= 9999 ? "\u2014" : `${dist}mi`}</td>
              <td><b>${Math.round(entry.interest || 0)}</b></td>
              <td>${marginCell}</td>
              <td>${funnelStageChip(r.committed ? "committed" : r.funnelStage, entry.eliminated)}</td>
              <td class="board-table-actions table-action-cell">
                <button class="btn-ghost btn-sm view-profile-btn" data-recruit-id="${r.id}">View</button>
                ${!r.committed ? `<button class="btn-ghost btn-sm btn-danger-ghost drop-btn" data-recruit-id="${r.id}" title="Drop from board">Drop</button>` : ""}
              </td>
            </tr>`;
  }).join("")}
      </tbody>
    </table>
  </div>`;
}
function renderContactControl(entry, recruit) {
  const alloc = (entry == null ? void 0 : entry.contactAlloc) || 0;
  const cap = C.CONTACT_WEEKLY_CAP;
  const ptsPerWk = (alloc / C.CONTACT_DOLLARS_PER_POINT).toFixed(0);
  return `
  <div class="contact-alloc">
    <span class="contact-alloc-label">Weekly Contact:</span>
    <button class="contact-step" data-contact-delta="-${C.CONTACT_ALLOC_STEP}" data-recruit-id="${recruit.id}" ${alloc <= 0 ? "disabled" : ""}>\u2212</button>
    <span class="contact-alloc-val">$${alloc}/wk</span>
    <button class="contact-step" data-contact-delta="${C.CONTACT_ALLOC_STEP}" data-recruit-id="${recruit.id}" ${alloc >= cap ? "disabled" : ""}>+</button>
    <span class="contact-alloc-pts muted">${alloc > 0 ? `~${ptsPerWk} pts/wk` : "off"}</span>
  </div>`;
}
function renderActionButtons(entry, recruit, school) {
  var _a;
  const dist = recruitDistance(recruit, school);
  const actions = [
    { id: "scout", label: "Scout", cost: actionCost("scout", dist) },
    { id: "game_visit", label: "Game Visit", cost: actionCost("game_visit", dist) },
    { id: "home_visit", label: "Home Visit", cost: actionCost("home_visit", dist) },
    { id: "campus_visit", label: "Campus Visit", cost: actionCost("campus_visit", dist) },
    { id: "offer", label: "Make Offer", cost: actionCost("offer", dist) }
  ];
  const budget = ((_a = state.playerCoach) == null ? void 0 : _a.budget) || 0;
  return actions.map((a) => `
  <button class="action-btn${budget < a.cost ? " disabled" : ""}"
          data-action="${a.id}" data-recruit-id="${recruit.id}"
          ${budget < a.cost ? "disabled" : ""}
          title="${a.label}: ${fmtMoney(a.cost)}">
    ${a.label}
    <span class="action-cost">${fmtMoney(a.cost)}</span>
  </button>
`).join("");
}
function renderSignings(school) {
  return `
  <div class="rec-signings">
    <div class="signings-scope-toggle">
      <button class="scope-btn${signingsScope === "mine" ? " active" : ""}" data-scope="mine">My Class</button>
      <button class="scope-btn${signingsScope === "national" ? " active" : ""}" data-scope="national">National Feed</button>
    </div>
    ${signingsScope === "mine" ? renderMyClass(school) : renderNationalFeed(school)}
  </div>
`;
}
function liveClassRank(school) {
  var _a;
  if (!school) return null;
  const schools = ((_a = state.world) == null ? void 0 : _a.schools) || [];
  const season = state.season || 1;
  const liveLog = [];
  for (const r of (state.world && state.world.recruits) || []) {
    if (!r.committed) continue;
    if (r.decisionStatus !== "committed" && r.decisionStatus !== "signed") continue;
    liveLog.push({ season, schoolId: r.committed, star: r.visionRating || 0 });
  }
  return classRankOf(schools, liveLog, school.id, season);
}
function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function renderMyClass(school) {
  var _a, _b, _c;
  if (!school) return '<div class="card"><div class="empty-state">No program loaded.</div></div>';
  const klass = (((_a = state.world) == null ? void 0 : _a.recruits) || []).filter(
    (r) => r.committed === school.id && (r.decisionStatus === "committed" || r.decisionStatus === "signed")
  );
  const boardByRecruit = {};
  for (const e of ((_b = state.playerCoach) == null ? void 0 : _b.recruitBoard) || []) boardByRecruit[e.recruitId] = e;
  const n = klass.length;
  const avgStar = n ? Math.round(klass.reduce((s, r) => s + (r.visionRating || 0), 0) / n) : 0;
  const avgTrue = n ? Math.round(klass.reduce((s, r) => s + (r.compositeRating || 0), 0) / n) : 0;
  const totalSpent = klass.reduce((s, r) => {
    var _a2;
    return s + (((_a2 = boardByRecruit[r.id]) == null ? void 0 : _a2.spent) || 0);
  }, 0);
  const clsRank = liveClassRank(school);
  const needRows = classNeedRows(school, klass);
  const lostRows = (((_c = state.playerCoach) == null ? void 0 : _c.recruitBoard) || []).map((e) => {
    var _a2;
    return { e, r: (((_a2 = state.world) == null ? void 0 : _a2.recruits) || []).find((x) => x.id === e.recruitId) };
  }).filter((x) => x.r && x.r.committed && x.r.committed !== school.id).sort((a, b) => (b.r.visionRating || 0) - (a.r.visionRating || 0));
  return `
  <div class="signings-summary card">
    <div class="sign-summary-grid">
      <div class="sum-stat"><div class="sum-val">${n}</div><div class="sum-label">Signed</div></div>
      <div class="sum-stat"><div class="sum-val">${avgStar || "\u2014"}</div><div class="sum-label">Avg ${tipTerm("recruit-stars", "Visibility")}</div></div>
      <div class="sum-stat"><div class="sum-val">${avgTrue || "\u2014"}</div><div class="sum-label">Avg True</div></div>
      <div class="sum-stat"><div class="sum-val">${fmtMoney(totalSpent)}</div><div class="sum-label">Total Spent</div></div>
      <div class="sum-stat"><div class="sum-val">${clsRank && clsRank.size > 0 ? ordinal(clsRank.rank) : "\u2014"}</div><div class="sum-label">${tipTerm("class-rank", "Class Rank")}${clsRank && clsRank.size > 0 ? ` <span class="muted" style="font-weight:400">of ${clsRank.of}</span>` : ""}</div></div>
    </div>
  </div>

  <div class="card">
    <div class="card-header"><span class="card-title">CLASS NEEDS</span></div>
    <div class="need-grid">
      ${needRows.map((nr) => `
        <div class="need-row ${nr.filled >= nr.target ? "need-met" : nr.filled > 0 ? "need-partial" : "need-open"}">
          <span class="need-pos pos-${nr.pos}">${nr.pos}</span>
          <span class="need-count">${nr.filled}/${nr.target}</span>
        </div>
      `).join("")}
    </div>
  </div>

  <div class="card">
    <div class="card-header"><span class="card-title">YOUR SIGNEES</span></div>
    ${n === 0 ? '<div class="empty-state">No commitments yet \u2014 work your board and close some recruits.</div>' : `
      <table class="data-table signees-table">
        <thead><tr><th>Pos</th><th>Name</th><th>Vis</th><th>True</th><th>Pot</th><th>WE</th><th>Dist</th><th>Spent</th></tr></thead>
        <tbody>
          ${klass.slice().sort((a, b) => (b.compositeRating || 0) - (a.compositeRating || 0)).map((r) => {
    const e = boardByRecruit[r.id];
    const dist = recruitDistance(r, school);
    const gemFlag = r.compositeRating - r.visionRating >= 12;
    const bustFlag = r.visionRating - r.compositeRating >= 12;
    return `
              <tr class="signee-row" data-recruit-id="${r.id}">
                <td><span class="pos-chip pos-${r.position}">${r.position}</span></td>
                <td class="player-name-cell">${escapeHtml(fullName(r))}${buildTag(r)}
                  ${gemFlag ? '<span class="gem-tag" title="True rating well above visibility">GEM</span>' : ""}
                  ${bustFlag ? '<span class="bust-tag" title="True rating well below visibility">BUST</span>' : ""}
                </td>
                <td><span class="rating-chip rating-${ratingColor(r.visionRating)}">${r.visionRating}</span></td>
                <td><span class="rating-chip rating-${ratingColor(r.compositeRating)}">${Math.round(r.compositeRating)}</span></td>
                <td>${potShort(r.potentialBand)}</td>
                <td class="${ratingColor(r.attributes.WE)}">${r.attributes.WE}</td>
                <td class="muted">${dist != null && dist < 9999 ? dist + "mi" : "\u2014"}</td>
                <td class="muted">${e ? fmtMoney(e.spent) : "\u2014"}</td>
              </tr>
            `;
  }).join("")}
        </tbody>
      </table>
    `}
  </div>

  ${lostRows.length ? `
    <div class="card">
      <div class="card-header"><span class="card-title">COMMITTED ELSEWHERE</span></div>
      <table class="data-table signees-table">
        <thead><tr><th>Pos</th><th>Name</th><th>Vis</th><th>True</th><th>Pot</th><th>Signed With</th><th>Spent</th></tr></thead>
        <tbody>
          ${lostRows.map(({ e, r }) => {
    var _a2;
    const sch = (((_a2 = state.world) == null ? void 0 : _a2.schools) || []).find((s) => s.id === r.committed);
    const scouted = isScouted(r.id);
    return `
              <tr class="signee-row" data-recruit-id="${r.id}">
                <td><span class="pos-chip pos-${r.position}">${r.position}</span></td>
                <td class="player-name-cell">${escapeHtml(fullName(r))}${buildTag(r)}</td>
                <td><span class="rating-chip rating-${ratingColor(r.visionRating)}">${r.visionRating}</span></td>
                <td>${scouted ? `<span class="rating-chip rating-${ratingColor(r.compositeRating)}">${Math.round(r.compositeRating)}</span>` : '<span class="fog">?</span>'}</td>
                <td>${scouted ? potShort(r.potentialBand) : '<span class="fog">?</span>'}</td>
                <td>${sch ? `<span class="team-link" data-scout-team="${sch.id}">${escapeHtml(sch.name)}</span>` : "\u2014"}</td>
                <td class="muted">${fmtMoney(e.spent)}</td>
              </tr>
            `;
  }).join("")}
        </tbody>
      </table>
    </div>
  ` : ""}
`;
}
function classNeedRows(school, klass) {
  const rows = [];
  // Scheme-aware (Aug 2026): the needs board follows the identity front's
  // targets, so a Nickel program stops being told to sign five OLBs.
  const targets = schemeRosterTargets(school);
  for (const pos of POSITIONS) {
    const target = targets[pos] || 0;
    if (target === 0) continue;
    const returning = school.roster.filter((p) => p.position === pos && p.classYear !== "SR").length;
    const deficit = Math.max(0, target - returning);
    if (deficit === 0) continue;
    const filled = klass.filter((r) => r.position === pos).length;
    rows.push({ pos, target: deficit, filled });
  }
  return rows;
}
function renderNationalFeed(school) {
  const feed = (state.signingsLog || []).filter((s) => s.season === state.season).filter((s) => s.star >= 55 || s.toPlayer || s.lostByPlayer).slice().reverse().slice(0, 60);
  if (feed.length === 0) {
    return `<div class="card"><div class="empty-state">No notable signings yet this season. As the season rolls, the league's big commitments will appear here.</div></div>`;
  }
  return `
  <div class="card">
    <div class="card-header"><span class="card-title">NATIONAL SIGNINGS \u2014 SEASON ${state.season}</span></div>
    <div class="feed-list">
      ${feed.map((s) => {
    const tag = s.toPlayer ? '<span class="feed-tag feed-win">YOUR SIGNING</span>' : s.lostByPlayer ? '<span class="feed-tag feed-loss">LOST</span>' : "";
    return `
          <div class="feed-row${s.toPlayer ? " feed-row-mine" : ""}${s.lostByPlayer ? " feed-row-lost" : ""}">
            <span class="feed-day muted">${escapeHtml(weekShort(s.day))}</span>
            <span class="pos-chip pos-${s.pos}">${s.pos}</span>
            <span class="feed-name">${escapeHtml(s.name)}</span>
            <span class="rating-chip rating-${ratingColor(s.star)}">${s.star}</span>
            <span class="feed-arrow muted">\u2192</span>
            <span class="feed-school">${s.schoolId ? `<span class="team-link" data-scout-team="${s.schoolId}">${escapeHtml(s.schoolName)}</span>` : escapeHtml(s.schoolName)}</span>
            ${tag}
          </div>
        `;
  }).join("")}
    </div>
  </div>
`;
}
// ── Identity stage 2 (§5): the FRAME is the first thing a recruit card says.
// "6'2\" 226 — Rover frame": the job windows his body already satisfies, so
// you recruit a body for a job you actually run. Pure display — the fit math
// lives in engine/traits.js.
const FRAME_JOB_POS = {
  NB: ["CB", "S"], ROVER: ["S", "LB", "OLB"], WAR: ["S", "LB"], SPUR: ["S", "OLB"], BANDIT: ["S", "OLB"],
  JOKER: ["OLB", "DE", "LB"], JACK: ["OLB", "DE"], EDGE: ["DE", "OLB"], STK: ["LB", "OLB"], MIKE: ["LB"],
  WILL: ["OLB", "LB"], NT: ["DT"], FB: ["RB", "TE"], SL: ["WR", "TE", "RB"]
};
function frameJobLabel(r) {
  if (!r || r.weight == null) return "";
  const fits = [];
  for (const [job, poss] of Object.entries(FRAME_JOB_POS)) {
    if (!poss.includes(r.position)) continue;
    const win = JOB_SIZE_WINDOWS[job];
    if (win && r.weight >= win[0] && r.weight <= win[1]) fits.push(job);
  }
  if (!fits.length) return "";
  return `<span class="frame-jobs">${fits.slice(0, 3).map((j) => `<span class="frame-job-chip">${j}</span>`).join("")} frame</span>`;
}
// Trait fog (§8): traits start hidden; the normal scouting process lifts the
// fog FULLY. Unscouted shows only that there is something to find.
function recruitTraitRow(r) {
  const tl = r == null ? void 0 : r.traits;
  if (!tl) return "";
  const n = (tl.play || []).length + (tl.flaws || []).length + (tl.bridge ? 1 : 0);
  if (!n) return "";
  if (!isScouted(r.id)) {
    return `<span class="trait-chip-row"><span class="trait-chip trait-fogged" title="Scout him to reveal how he plays">${n} trait${n === 1 ? "" : "s"} \u2014 <span class="fog">?</span></span></span>`;
  }
  const pips = (lv) => "\u25CF".repeat(lv || 1);
  const chips = [];
  if (tl.bridge && BRIDGE_CATALOG[tl.bridge]) chips.push(`<span class="trait-chip trait-bridge" title="${escapeHtml(BRIDGE_CATALOG[tl.bridge].desc || "")}">\u2726 ${escapeHtml(BRIDGE_CATALOG[tl.bridge].name)}</span>`);
  for (const t of tl.play || []) if (PLAY_CATALOG[t.k]) chips.push(`<span class="trait-chip" title="${escapeHtml(PLAY_CATALOG[t.k].desc || PLAY_CATALOG[t.k].name)}">${escapeHtml(PLAY_CATALOG[t.k].name)} <span class="trait-pips">${pips(t.lv)}</span></span>`);
  for (const t of tl.flaws || []) if (FLAW_CATALOG[t.k]) chips.push(`<span class="trait-chip trait-flaw" title="${escapeHtml(FLAW_CATALOG[t.k].desc || FLAW_CATALOG[t.k].name)}">${escapeHtml(FLAW_CATALOG[t.k].name)} <span class="trait-pips">${pips(t.lv)}</span></span>`);
  return chips.length ? `<span class="trait-chip-row">${chips.join("")}</span>` : "";
}
function renderProfile(recruitId, school, isOpen) {
  var _a, _b;
  const recruit = state.world.recruits.find((r) => r.id === recruitId);
  if (!recruit) return '<div class="empty-state">Recruit not found</div>';
  const entry = getBoardEntry(recruitId);
  const dist = recruitDistance(recruit, school);
  return `
  <div class="recruit-profile">
    <div class="profile-hero">
      <div class="profile-left">
        <div class="profile-identity">
          ${renderPlayerPortrait(recruit, null, "lg")}
          <div class="profile-identity-copy">
            <div class="profile-pos-badge pos-${recruit.position}">${recruit.position}</div>
        <h2 class="profile-name">${escapeHtml(fullName(recruit))}${buildTag(recruit)}</h2>
        <div class="profile-details">
          ${derivedArchetype(recruit) ? `<span class="arch-chip arch-chip-lg">${archetypeLabel(derivedArchetype(recruit))}</span>` : ""}
          <span class="frame-line"><strong>${recruit.height} &middot; ${recruit.weight} lbs</strong>${frameJobLabel(recruit) ? ` \u2014 ${frameJobLabel(recruit)}` : ""} &middot; GPA ${recruit.gpa}</span>
          ${recruitTraitRow(recruit)}
          ${recruit.measurables ? `<span class="testing-sheet">40yd ${recruit.measurables.forty} &middot; Vert ${recruit.measurables.vert}&quot; &middot; Shuttle ${recruit.measurables.shuttle} &middot; Bench ${recruit.measurables.bench}</span>` : ""}
          ${((_a = recruit.hometown) == null ? void 0 : _a.city) ? `<span>${escapeHtml(recruit.hometown.city)}, ${escapeHtml(recruit.hometown.state || "")}</span>` : ""}
          ${Number.isFinite(dist) && dist < 9999 ? `<span>${dist} miles from ${escapeHtml((school == null ? void 0 : school.name) || "")}</span>` : ""}
        </div>
          </div>
        </div>
        <div class="profile-ratings">
          <div class="profile-rating-block">
            <div class="pr-val">${displayedRating(state.playerCoach, recruit)}</div>
            <div class="pr-label">Visibility</div>
          </div>
          <div class="profile-rating-block">
            <div class="pr-val ${isScouted(recruit.id) ? "" : "unknown"}">${isScouted(recruit.id) ? recruit.compositeRating : "?"}</div>
            <div class="pr-label">True Rating</div>
          </div>
          <div class="profile-rating-block">
            <div class="pr-val ${isScouted(recruit.id) ? "" : "unknown"}">${isScouted(recruit.id) ? potLong(recruit.potentialBand) : "?"}</div>
            <div class="pr-label">Potential</div>
          </div>
          <div class="profile-rating-block">
            <div class="pr-val ${ratingColor(recruit.attributes.WE)}">${recruit.attributes.WE}</div>
            <div class="pr-label">Work Ethic</div>
          </div>
        </div>
      </div>

      <div class="profile-right">
        ${entry ? `
          <div class="profile-interest">
            <div class="profile-interest-label">YOUR ${tipTerm("recruit-interest", "INTEREST")}</div>
            <div class="interest-meter-large">
              <div class="interest-bar-track">
                <div class="interest-bar-fill" style="width:${Math.min(100, entry.interest)}%"></div>
              </div>
              <div class="interest-val-large">${Math.round(entry.interest)} / 100</div>
            </div>
          </div>
        ` : ""}
        <div class="profile-wants">
          ${renderWantTags(recruit)}
        </div>
        <div class="funnel-status-panel">
          ${renderFunnelStatus(recruit, entry, school)}
        </div>
      </div>
    </div>

    <div class="profile-attrs">
      <div class="card">
        <div class="card-header">
          <span class="card-title">ATTRIBUTES</span>
          ${isScouted(recruit.id) ? '<span class="scouted-badge">SCOUTED</span>' : '<span class="unscouted-badge" title="Attributes are public, but scout to reveal true rating &amp; potential">NOT SCOUTED</span>'}
        </div>
        <div class="attr-bars">
          ${ATTRIBUTES.map((a) => `
            <div class="attr-bar-row">
              <span class="attr-bar-label">${attrLabel(a)}</span>
              <div class="attr-bar-track">
                <div class="attr-bar-fill attr-fill-${ratingColor(recruit.attributes[a])}" style="width:${recruit.attributes[a]}%"></div>
              </div>
              <span class="attr-bar-val">${recruit.attributes[a]}</span>
            </div>
          `).join("")}
        </div>
        ${isScouted(recruit.id) ? "" : `
        <div class="scout-hint">
          The raw numbers are all here \u2014 but raw numbers aren't a verdict. Scout him to reveal his <strong>true rating</strong> and <strong>potential ceiling</strong>: how the pieces actually fit, and how much is left in the tank.
        </div>
        `}
      </div>
    </div>

    ${isOpen ? `
      <div class="card profile-actions-card">
        <div class="card-header"><span class="card-title">TAKE ACTION</span></div>
        ${entry && !recruit.committed ? renderContactControl(entry, recruit) : ""}
        <div class="board-actions">
          ${entry ? renderActionButtons(entry, recruit, school) : `
            <button class="btn-primary add-board-btn" data-recruit-id="${recruit.id}">+ Add to Board</button>
          `}
        </div>
        ${entry && !recruit.committed ? `
        <div class="board-manage profile-manage">
          ${entry.offered ? `<button class="btn-ghost btn-sm rescind-btn" data-recruit-id="${recruit.id}">Rescind Offer</button>` : ""}
          <button class="btn-ghost btn-sm btn-danger-ghost drop-btn" data-recruit-id="${recruit.id}">Drop from Board</button>
        </div>
        ` : ""}
      </div>
    ` : ""}

    <div class="profile-log card">
      <div class="card-header"><span class="card-title">ACTION HISTORY</span></div>
      ${((_b = entry == null ? void 0 : entry.actions) == null ? void 0 : _b.length) ? `
        <table class="data-table compact">
          <thead><tr><th>Week</th><th>Action</th><th>Cost</th><th>Interest Gained</th></tr></thead>
          <tbody>
            ${entry.actions.slice().reverse().map((a) => `
              <tr>
                <td>${escapeHtml(weekLabel(a.day))}</td>
                <td>${a.action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</td>
                <td>${fmtMoney(a.cost)}</td>
                <td class="${a.gain > 10 ? "rating-good" : "muted"}">+${(a.gain || 0).toFixed(1)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : '<div class="empty-state">No actions taken yet</div>'}
    </div>

    ${!recruit.committed ? `
      <div class="card dev-card">
        <div class="card-header">
          <span class="card-title">DEV TOOLS</span>
          <span class="dev-warning-badge">\u26A0 bypasses game rules</span>
        </div>
        <div class="dev-actions">
          <button class="btn-ghost dev-action-btn dev-force-sign-btn" data-recruit-id="${recruit.id}">Force Sign</button>
        </div>
      </div>
    ` : ""}
  </div>
`;
}
function potShort(band) {
  return { average: "AVG", good: "GOOD", great: "GREAT", sky: "\u2605SKY" }[band] || "?";
}
function potLong(band) {
  return { average: "Average", good: "Good", great: "Great", sky: "Sky's the Limit" }[band] || "?";
}
function recruitStatusChip(r, interest) {
  if (r.committed) return `<span class="status-chip status-committed">Committed</span>`;
  const stage = funnelStageChip(r.funnelStage, false);
  if (interest > 70) return `${stage} <span class="status-chip status-green">Leaning</span>`;
  if (interest > 0) return `${stage} <span class="status-chip status-yellow">Considering</span>`;
  return stage;
}
function renderAssist(school) {
  var _a, _b;
  const level = recruitAssistLevel(state);
  const coach = state.playerCoach;
  const strat = ((_a = state.settings) == null ? void 0 : _a.recruitStrategy) || defaultRecruitStrategy();
  const recruits = ((_b = state.world) == null ? void 0 : _b.recruits) || [];
  const board = (coach == null ? void 0 : coach.recruitBoard) || [];
  const LEVELS = [
    ["off", "Off", "You run recruiting yourself."],
    ["full", "On", "Your staff builds and closes the entire class down to your last scholarship \u2014 scouting, contact, and offers, following the strategy you set. Fully hands-off; override anytime (rescind, drop, add)."]
  ];
  const levelPicker = `
  <div class="assist-levels">
    ${LEVELS.map(([id, label, desc]) => `
      <button class="assist-level${level === id ? " active" : ""}" data-assist-level="${id}">
        <span class="assist-level-name">${label}</span>
        <span class="assist-level-desc">${desc}</span>
      </button>`).join("")}
  </div>`;
  if (level === "off") {
    return `<div class="card">
    <div class="card-header"><span class="card-title">RECRUITING ASSIST</span></div>
    <p class="offseason-hint">Love recruiting? Leave this off. Want it handled? Turn it <b>On</b> and your staff runs the whole class hands-off \u2014 following the strategy you set.</p>
    ${levelPicker}
  </div>`;
  }
  const positions = POSITIONS.filter((p) => ROSTER_TARGETS[p] != null);
  const priorities = Array.isArray(strat.priorities) ? strat.priorities : [];
  const priChips = positions.map((pos) => {
    const i = priorities.indexOf(pos);
    return `<button class="assist-pri${i >= 0 ? " active" : ""}" data-assist-pri="${pos}">${pos}${i >= 0 ? `<span class="assist-pri-n">${i + 1}</span>` : ""}</button>`;
  }).join("");
  const AGGR = [["conservative", "Conservative"], ["balanced", "Balanced"], ["aggressive", "Aggressive"]];
  const aggrBtns = AGGR.map(([v, l]) => `<button class="gp-option gp-option-sm${(strat.aggression || "balanced") === v ? " active" : ""}" data-assist-aggr="${v}">${l}</button>`).join("");
  const FLOORS = [["0", "Any"], ["55", "Solid"], ["70", "Blue-chip"]];
  const floorBtns = FLOORS.map(([v, l]) => `<button class="gp-option gp-option-sm${String(strat.qualityFloor || 0) === v ? " active" : ""}" data-assist-floor="${v}">${l}</button>`).join("");
  const classNeed = (pos) => {
    const have = (school.roster || []).filter((p) => p.position === pos).length;
    const srs = (school.roster || []).filter((p) => p.position === pos && p.classYear === "SR").length;
    return Math.max(0, (schemeRosterTargets(school)[pos] || 0) - (have - srs));
  };
  const committedAt = {}, offeredAt = {};
  for (const pos of positions) {
    committedAt[pos] = 0;
    offeredAt[pos] = 0;
  }
  for (const r of recruits) if (r.committed === school.id && committedAt[r.position] != null) committedAt[r.position]++;
  for (const e of board) {
    if (!e.offered) continue;
    const r = recruits.find((x) => x.id === e.recruitId);
    if (r && !r.committed && offeredAt[r.position] != null) offeredAt[r.position]++;
  }
  const classRows = positions.filter((pos) => classNeed(pos) > 0 || committedAt[pos] > 0 || offeredAt[pos] > 0).map((pos) => {
    const need = classNeed(pos), com = committedAt[pos], off = offeredAt[pos];
    const filled = need > 0 && com >= need;
    return `<span class="assist-class-cell${filled ? " filled" : ""}"><b>${pos}</b> ${com}${off ? `<span class="muted">+${off}</span>` : ""}/${need || "\u2014"}</span>`;
  }).join("");
  const committedTotal = Object.values(committedAt).reduce((a, b) => a + b, 0);
  return `<div class="card">
  <div class="card-header"><span class="card-title">RECRUITING ASSIST</span><span class="assist-level-tag">ON \u2014 hands-off</span></div>
  ${levelPicker}
  <div class="assist-strategy">
    <div class="assist-strat-block">
      <div class="assist-strat-label">Priority positions <span class="muted">(tap to prioritize; order matters)</span></div>
      <div class="assist-pri-row">${priChips}</div>
    </div>
    <div class="assist-strat-block">
      <div class="assist-strat-label">How hard to chase</div>
      <div class="gp-options">${aggrBtns}</div>
    </div>
    <div class="assist-strat-block">
      <div class="assist-strat-label">Quality floor <span class="muted">(skip anyone below)</span></div>
      <div class="gp-options">${floorBtns}</div>
    </div>
  </div>
  <div class="assist-class">
    <div class="assist-strat-label">Projected class \u2014 <b>${committedTotal}</b> committed \xB7 ${(coach == null ? void 0 : coach.scholarshipsAvailable) || 0} scholarships open</div>
    <div class="assist-class-grid">${classRows || '<span class="muted">No open needs \u2014 your roster is full.</span>'}</div>
  </div>
</div>
${renderAutoRecruitLog()}`;
}
function renderAutoRecruitLog() {
  const log = (state.autoRecruitLog || []).filter((e) => e.season === state.season).slice().reverse();
  const ACTION_LABEL = {
    offer: "Offered",
    scout: "Scouted",
    game_visit: "Game Visit",
    home_visit: "Home Visit",
    campus_visit: "Campus Visit"
  };
  const BULK_ACTIONS = /* @__PURE__ */ new Set();
  if (log.length === 0) {
    return `<div class="card">
    <div class="card-header"><span class="card-title">STAFF ACTIVITY</span></div>
    <div class="empty-state">No activity yet. Advance a week during recruiting season to see what your staff does on your behalf.</div>
  </div>`;
  }
  return log.map((entry) => {
    const totalSpent = entry.acts.reduce((s, a) => s + a.cost, 0);
    const notable = entry.acts.filter((a) => !BULK_ACTIONS.has(a.action));
    const bulk = entry.acts.filter((a) => BULK_ACTIONS.has(a.action));
    const bulkGroups = {};
    for (const a of bulk) {
      if (!bulkGroups[a.action]) bulkGroups[a.action] = { count: 0, cost: 0 };
      bulkGroups[a.action].count++;
      bulkGroups[a.action].cost += a.cost;
    }
    return `
    <div class="card ailog-day">
      <div class="card-header">
        <span class="card-title">${escapeHtml(weekLabel(entry.day).toUpperCase())}</span>
        ${totalSpent > 0 ? `<span class="ailog-total">${fmtMoney(totalSpent)} spent</span>` : ""}
      </div>
      ${entry.adds.length ? `
        <div class="ailog-section">
          <span class="ailog-section-label">Added to board</span>
          <div class="ailog-adds-list">
            ${entry.adds.map((a) => `
              <span class="ailog-add-item">
                <span class="pos-chip pos-${a.pos}">${a.pos}</span>
                <span>${escapeHtml(a.name)}</span>
              </span>
            `).join("")}
          </div>
        </div>
      ` : ""}
      ${notable.map((a) => `
        <div class="ailog-act-row">
          <span class="ailog-act-type${a.action === "offer" ? " ailog-offer" : ""}">${ACTION_LABEL[a.action] || a.action}</span>
          <span class="pos-chip pos-${a.pos}">${a.pos}</span>
          <span class="ailog-act-name">${escapeHtml(a.name)}</span>
          ${a.gain > 0 ? `<span class="ailog-gain">+${a.gain.toFixed(1)}</span>` : ""}
          <span class="ailog-cost muted">${fmtMoney(a.cost)}</span>
        </div>
      `).join("")}
      ${Object.entries(bulkGroups).map(([action, g]) => `
        <div class="ailog-bulk-row">
          <span class="muted">${ACTION_LABEL[action] || action}: ${g.count} recruits</span>
          <span class="ailog-cost muted">${fmtMoney(g.cost)}</span>
        </div>
      `).join("")}
    </div>
  `;
  }).join("");
}
function setupListeners10() {
  var _a, _b, _c, _d, _e;
  const school = getPlayerSchool();
  const coach = state.playerCoach;
  document.querySelectorAll(".rec-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      rerender();
    });
  });
  const ensureStrat = () => {
    if (!state.settings) state.settings = {};
    if (!state.settings.recruitStrategy) state.settings.recruitStrategy = defaultRecruitStrategy();
    if (!Array.isArray(state.settings.recruitStrategy.priorities)) state.settings.recruitStrategy.priorities = [];
    return state.settings.recruitStrategy;
  };
  document.querySelectorAll("[data-assist-level]").forEach((btn) => btn.addEventListener("click", () => {
    if (!state.settings) state.settings = {};
    state.settings.recruitAssist = btn.dataset.assistLevel;
    notify(btn.dataset.assistLevel === "off" ? "Recruiting assist off \u2014 you\u2019re in control" : `Recruiting assist: ${btn.dataset.assistLevel}`, "info");
    rerender();
  }));
  document.querySelectorAll("[data-assist-aggr]").forEach((btn) => btn.addEventListener("click", () => {
    ensureStrat().aggression = btn.dataset.assistAggr;
    rerender();
  }));
  document.querySelectorAll("[data-assist-floor]").forEach((btn) => btn.addEventListener("click", () => {
    ensureStrat().qualityFloor = parseInt(btn.dataset.assistFloor) || 0;
    rerender();
  }));
  document.querySelectorAll("[data-assist-pri]").forEach((btn) => btn.addEventListener("click", () => {
    const s = ensureStrat();
    const pos = btn.dataset.assistPri;
    const i = s.priorities.indexOf(pos);
    if (i >= 0) s.priorities.splice(i, 1);
    else s.priorities.push(pos);
    rerender();
  }));
  document.querySelectorAll(".scope-btn[data-scope]").forEach((btn) => {
    btn.addEventListener("click", () => {
      signingsScope = btn.dataset.scope;
      rerender();
    });
  });
  document.querySelectorAll(".scope-btn[data-boardview]").forEach((btn) => {
    btn.addEventListener("click", () => {
      boardView = btn.dataset.boardview;
      rerender();
    });
  });
  document.querySelectorAll("[data-boardsort]").forEach((th) => {
    th.addEventListener("click", () => {
      const col = th.dataset.boardsort;
      if (boardSortCol === col) boardSortDir *= -1;
      else {
        boardSortCol = col;
        boardSortDir = col === "name" || col === "position" || col === "archetype" || col === "stage" ? 1 : -1;
      }
      rerender();
    });
  });
  document.querySelectorAll(".signee-row").forEach((row) => {
    row.addEventListener("click", () => openRecruitProfile(row.dataset.recruitId));
  });
  document.querySelectorAll("[data-sf-pos]").forEach((btn) => {
    btn.addEventListener("click", () => {
      searchFilters.pos = btn.dataset.sfPos;
      searchFilters.arch = "";
      rerender();
    });
  });
  // The class-needs chips double as the position filter — tap the hole you need
  // to see the board for it, tap again to clear back to everyone.
  document.querySelectorAll("[data-need-pos]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pos = btn.dataset.needPos;
      searchFilters.pos = searchFilters.pos === pos ? "" : pos;
      searchFilters.arch = "";
      rerender();
    });
  });
  document.querySelectorAll("[data-sf-arch]").forEach((btn) => {
    btn.addEventListener("click", () => {
      searchFilters.arch = btn.dataset.sfArch;
      rerender();
    });
  });
  (_a = document.getElementById("sf-dist")) == null ? void 0 : _a.addEventListener("change", (e) => {
    searchFilters.maxDist = parseInt(e.target.value);
    rerender();
  });
  (_b = document.getElementById("sf-posrank")) == null ? void 0 : _b.addEventListener("change", (e) => {
    searchFilters.posRank = parseInt(e.target.value) || 0;
    rerender();
  });
  (_c = document.getElementById("sf-status")) == null ? void 0 : _c.addEventListener("change", (e) => {
    searchFilters.status = e.target.value;
    rerender();
  });
  (_d = document.getElementById("sf-sort")) == null ? void 0 : _d.addEventListener("change", (e) => {
    searchFilters.sort = e.target.value;
    rerender();
  });
  document.querySelectorAll(".sf-attr-pick").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const i = parseInt(e.target.dataset.attrIdx);
      searchFilters.attrFilters[i].attr = e.target.value;
      rerender();
    });
  });
  document.querySelectorAll(".sf-attr-op").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const i = parseInt(e.target.dataset.attrIdx);
      searchFilters.attrFilters[i].op = e.target.value;
      rerender();
    });
  });
  document.querySelectorAll(".sf-attr-val").forEach((inp) => {
    inp.addEventListener("change", (e) => {
      const i = parseInt(e.target.dataset.attrIdx);
      searchFilters.attrFilters[i].val = parseInt(e.target.value) || 0;
      rerender();
    });
  });
  (_e = document.getElementById("sf-clear-attrs")) == null ? void 0 : _e.addEventListener("click", () => {
    searchFilters.attrFilters = searchFilters.attrFilters.map(() => ({ attr: "", op: "gte", val: 0 }));
    rerender();
  });
  document.querySelectorAll(".add-board-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const recruit = getRecruit(btn.dataset.recruitId);
      if (!recruit || !coach) return;
      if (coach.recruitBoard.find((e2) => e2.recruitId === recruit.id)) {
        notify("Already on board", "info");
        return;
      }
      const entry = createBoardEntry(recruit, school.id);
      coach.recruitBoard.push(entry);
      notify(`${fullName(recruit)} added to board`, "success");
      rerender();
    });
  });
  document.querySelectorAll(".action-btn:not([disabled])").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      const recruit = getRecruit(btn.dataset.recruitId);
      let entry = getBoardEntry(recruit.id);
      if (!entry) {
        entry = createBoardEntry(recruit, school.id);
        coach.recruitBoard.push(entry);
      }
      const result = takeAction(coach, recruit, entry, action, state.day, school);
      if (result.ok) {
        const msg = result.gain > 0.05 ? `${action.replace(/_/g, " ")} \u2014 +${result.gain.toFixed(1)} interest (${fmtMoney(result.cost)})` : `${action.replace(/_/g, " ")} sent (${fmtMoney(result.cost)})`;
        notify(msg, "success");
      } else {
        notify(result.reason, "warning");
      }
      rerender();
    });
  });
  document.querySelectorAll(".contact-step").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      const delta = parseInt(btn.dataset.contactDelta, 10);
      const recruit = getRecruit(btn.dataset.recruitId);
      let entry = getBoardEntry(recruit.id);
      if (!entry) {
        entry = createBoardEntry(recruit, school.id);
        coach.recruitBoard.push(entry);
      }
      setContactAlloc(entry, (entry.contactAlloc || 0) + delta);
      const alloc = entry.contactAlloc || 0;
      const box = btn.closest(".contact-alloc");
      if (box) {
        const val = box.querySelector(".contact-alloc-val");
        if (val) val.textContent = `$${alloc}/wk`;
        const pts = box.querySelector(".contact-alloc-pts");
        if (pts) pts.textContent = alloc > 0 ? `~${(alloc / C.CONTACT_DOLLARS_PER_POINT).toFixed(0)} pts/wk` : "off";
        box.querySelectorAll(".contact-step").forEach((b) => {
          const d = parseInt(b.dataset.contactDelta, 10);
          b.disabled = d < 0 ? alloc <= 0 : alloc >= C.CONTACT_WEEKLY_CAP;
        });
      }
      notify(`Weekly contact set to $${entry.contactAlloc}/wk`, "success");
    });
  });
  document.querySelectorAll(".view-profile-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openRecruitProfile(btn.dataset.recruitId);
    });
  });
  document.querySelectorAll(".recruit-row, .signee-row").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      openRecruitProfile(row.dataset.recruitId);
    });
  });
  document.querySelectorAll(".drop-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const recruit = getRecruit(btn.dataset.recruitId);
      if (!recruit || !coach) return;
      const entry = getBoardEntry(recruit.id);
      if (entry == null ? void 0 : entry.offered) {
        coach.scholarshipsAvailable = (coach.scholarshipsAvailable || 0) + 1;
      }
      coach.recruitBoard = coach.recruitBoard.filter((e2) => e2.recruitId !== recruit.id);
      if (recruit.considering) recruit.considering = recruit.considering.filter((id) => id !== school.id);
      if (recruit.interest) delete recruit.interest[school.id];
      if (profileRecruitId === recruit.id) {
        profileRecruitId = null;
        activeTab = "board";
      }
      notify(`${fullName(recruit)} dropped from board${(entry == null ? void 0 : entry.offered) ? " \u2014 scholarship refunded" : ""}`, "info");
      rerender();
    });
  });
  document.querySelectorAll(".dev-force-sign-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const recruit = getRecruit(btn.dataset.recruitId);
      if (!recruit) return;
      devForceSign(recruit.id);
      notify(`DEV: ${fullName(recruit)} force-signed to your program`, "success");
      activeTab = "signings";
      rerender();
    });
  });
  document.querySelectorAll(".rescind-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const recruit = getRecruit(btn.dataset.recruitId);
      if (!recruit || !coach) return;
      const entry = getBoardEntry(recruit.id);
      if (!(entry == null ? void 0 : entry.offered)) return;
      entry.offered = false;
      coach.scholarshipsAvailable = (coach.scholarshipsAvailable || 0) + 1;
      notify(`Offer rescinded from ${fullName(recruit)} \u2014 scholarship returned`, "warning");
      rerender();
    });
  });
}

export { recruitingCanBack, recruitingGoBack, renderRecruiting, setupListeners10 };
