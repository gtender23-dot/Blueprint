import { ATTRIBUTES, C, PASS_TENDENCY, POSITIONS, ROSTER_POS_MIN, ROSTER_TARGETS, attrLabel, schemeRosterTargets } from '../../constants.js';
import { expectedWins, mandateText, seatState } from '../../engine/career.js';
// [W9 §12 T1] The lockstep agenda. It lives on the dashboard because this is
// where ADVANCE WEEK lives, and a gate the player can't see a door out of is
// just a bug with a message.
import { agendaPending, agendaRows, isTreeGame, pendingHandoff, refreshAgenda, softFinalize, softFinalizeAll, takeOver } from '../../engine/tree.js';
// [W9 §12 R3] The move-up handoff card. One implementation, owned by the
// coach office; the dashboard renders it too because the dashboard IS the
// agenda — and, during the offseason, the contract screen the player signs on.
import { renderHandoffCard, setupHandoffListeners } from './coachoffice.js';
import { applyRedshirt, clearRedshirtFromLineups, computeAutoRedshirtCandidates } from '../../engine/development.js';
import { gameHighlight } from '../../engine/highlights.js';
import { CLINIC_OPTIONS, FOCUS_GROUPS, PRESEASON_WEEKS, acceptExtension, acceptWalkOn, applicationOdds, applicationsLeft, applyForJob, buildSeasonGoals, conversionPenaltyFactor, convertPosition, cutDayConversionRecs, declineOffersWithLeverage, devCtx, effectiveRosterOver, getExtensionOffer, getJobOpenings, getWalkOnPool, graduatingSeniors, playSpringGame, playerHasPendingPostseason, playoffDigest, previewConversion, runDevCamp, setDevFocus, takeClinic, visibleStages } from '../../engine/offseason.js';
import { advancePortalRound, canSchoolSign, frontRunner, pitchCost, playerDrop, playerPitch, portalScholarshipRoom, resolvePortal, roleFor } from '../../engine/portal.js';
import { rankMap } from '../../engine/rankings.js';
import { PHASES, REG_WEEK_COUNT, acceptJob, calendarWeek, getPhase, recruitAssistLevel, weekLabel, weekShort } from '../../engine/season.js';
import { deriveSchemeIdentity, ensureAmbition, generateCandidates, makeSuccessionPromise, schemeStarTier } from '../../engine/staff.js';
import { buildDepthChart } from '../../engine/world.js';
import { advanceDay2, getConferenceStandings, getPhaseLabel, getPlayerSchool, getUpcomingGame, navigate, notify, notifyJobMoveCosts, rerender, skipToOffseason, state } from '../../state.js';
import { cue } from '../sound.js';
import { renderBanquetBody, setupListeners4 } from './awards.js';
import { renderScheduling, setupListeners5 } from './scheduling.js';
import { escapeHtml, fmtRecord, fullName, ratingColor, renderCrest } from '../../utils.js';

var cutModalPos = "";
var cutModalClass = "";
var convFilterPos = "";
var convBoardOpen = false;
var convTarget = "";
var convSort = "";
var campFilterPos = "";
var campSort = "gain";
function renderDashboard() {
  var _a;
  const school = getPlayerSchool();
  const phase = getPhase(state.day);
  if (state.offseason && !state.offseason.done) return renderEventTakeover(school, "offseason");
  if (phase === "PRESEASON") {
    if (state.day === 4 && devCtx(state).openerPrep) return renderEventTakeover(school, "gameweek");
    return renderEventTakeover(school, "preseason");
  }
  if (state.playoffs && phase === "PLAYOFFS") return renderEventTakeover(school, "playoffs");
  if (phase === "JOBS") return renderEventTakeover(school, "jobs");
  return renderEventTakeover(school, "gameweek");
}
function renderDashboardStandings(standings, school) {
  var _a, _b, _c, _d;
  const myIdx = standings.findIndex((s) => s.id === (school == null ? void 0 : school.id));
  const topN = standings.slice(0, 5);
  const rows = topN.map((s, i) => {
    var _a2, _b2, _c2, _d2;
    const isPlayer = s.id === (school == null ? void 0 : school.id);
    return `<tr class="${isPlayer ? "player-row" : ""}">
    <td><span class="rank-num">${i + 1}</span> <span class="team-link" data-scout-team="${s.id}">${escapeHtml(s.name)}</span></td>
    <td>${fmtRecord(((_a2 = s.record) == null ? void 0 : _a2.confWins) || 0, ((_b2 = s.record) == null ? void 0 : _b2.confLosses) || 0)}</td>
    <td class="muted">${fmtRecord(((_c2 = s.record) == null ? void 0 : _c2.wins) || 0, ((_d2 = s.record) == null ? void 0 : _d2.losses) || 0)}</td>
  </tr>`;
  });
  if (myIdx >= 5 && school) {
    const s = standings[myIdx];
    rows.push(`<tr><td colspan="3" class="dash-standings-gap">\xB7 \xB7 \xB7</td></tr>`);
    rows.push(`<tr class="player-row">
    <td><span class="rank-num">${myIdx + 1}</span> <span class="team-link" data-scout-team="${s.id}">${escapeHtml(s.name)}</span></td>
    <td>${fmtRecord(((_a = s.record) == null ? void 0 : _a.confWins) || 0, ((_b = s.record) == null ? void 0 : _b.confLosses) || 0)}</td>
    <td class="muted">${fmtRecord(((_c = s.record) == null ? void 0 : _c.wins) || 0, ((_d = s.record) == null ? void 0 : _d.losses) || 0)}</td>
  </tr>`);
  }
  return rows.join("");
}
function abbrevSchool(s) {
  if (!s) return "TBD";
  const words = String(s.name).split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
  if (!words.length) return "???";
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
  return words.map((w) => w[0].toUpperCase()).join("").slice(0, 4);
}
function seasonRailHtml(school, next) {
  const upDay = next ? next.day : 0;
  const steps = [];
  for (let w = PHASES.NONCONF.days[0]; w <= PHASES.CONFCHAMP.days[1]; w++) {
    const g = (state.schedule || []).find((g2) => g2.day === w && (g2.homeId === (school == null ? void 0 : school.id) || g2.awayId === (school == null ? void 0 : school.id)));
    if (!g) {
      if (w === PHASES.CONFCHAMP.days[1]) {
        steps.push(`<span class="event-rail-step${w <= state.day ? " done" : ""}" title="Selection Week \u2014 conference titles settle and the field is announced">SEL</span>`);
        continue;
      }
      steps.push(`<span class="event-rail-step${w <= state.day ? " done" : ""}" title="${escapeHtml(weekLabel(w))} \u2014 bye">${escapeHtml(weekShort(w))} BYE</span>`);
      continue;
    }
    const isHome = g.homeId === (school == null ? void 0 : school.id);
    const opp = state.world.schools.find((s) => s.id === (isHome ? g.awayId : g.homeId));
    const ab = abbrevSchool(opp);
    const at = isHome ? "vs" : "@";
    const tip = `${weekLabel(w)} ${at} ${(opp == null ? void 0 : opp.name) || "TBD"}`;
    if (g.result) {
      const won = g.result.winner === (school == null ? void 0 : school.id);
      const isHomeG = g.homeId === (school == null ? void 0 : school.id);
      const my = isHomeG ? g.result.homeScore : g.result.awayScore;
      const their = isHomeG ? g.result.awayScore : g.result.homeScore;
      steps.push(`<span class="event-rail-step done ${won ? "win" : "loss"}" title="${escapeHtml(tip)} \u2014 ${won ? "W" : "L"} ${my}\u2013${their}">${won ? "W" : "L"} ${at} ${ab}</span>`);
    } else {
      steps.push(`<span class="event-rail-step${w === upDay ? " current" : ""}" title="${escapeHtml(tip)}">${escapeHtml(weekShort(w))} ${at} ${ab}</span>`);
    }
  }
  return steps.join('<span class="event-rail-sep">\xB7</span>');
}
function redshirtBurnRisks() {
  const school = getPlayerSchool();
  if (!school) return [];
  const next = getUpcomingGame();
  if (!next || next.day !== state.day + 1) return [];
  const twoDeep = /* @__PURE__ */ new Set();
  for (const arr of Object.values(school.depthChart || {})) {
    for (const id of (arr || []).slice(0, 2)) twoDeep.add(id);
  }
  return school.roster.filter((p) => {
    var _a;
    return p.redshirted && p.redshirtYear === state.season && (((_a = p.stats) == null ? void 0 : _a.games) || 0) >= C.REDSHIRT_MAX_GAMES && twoDeep.has(p.id);
  });
}
function renderRedshirtBurnWarnModal() {
  const names = (state.ui.showRedshirtBurnWarn || []).map((p) => {
    var _a;
    return `${fullName(p)} (${p.position}, ${((_a = p.stats) == null ? void 0 : _a.games) || 0} games)`;
  });
  return `
  <div class="modal-overlay" id="rs-burn-overlay">
    <div class="modal">
      <div class="modal-header"><span class="modal-title">Redshirt at risk</span></div>
      <div class="modal-body">
        <p>Tomorrow's game would be a ${C.REDSHIRT_MAX_GAMES + 1}th appearance \u2014 the redshirt burns and the class clock resumes for:</p>
        ${names.map((n) => `<div class="offseason-item"><span class="offseason-label">${escapeHtml(n)}</span></div>`).join("")}
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" id="btn-rs-bench">Bench them first</button>
        <button class="btn-primary" id="btn-rs-play">Play anyway</button>
      </div>
    </div>
  </div>`;
}
function renderRecruitStartWarnModal() {
  return `
  <div class="modal-overlay" id="rec-start-overlay">
    <div class="modal">
      <div class="modal-header"><span class="modal-title">Your recruiting board is empty</span></div>
      <div class="modal-body">
        <p>Every rival coach is already working the class \u2014 interest compounds, and the
        best players commit to whoever shows up first. Leaving the recruiting week without a single
        target on the board is a hole your class may never dig out of.</p>
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" id="btn-rec-skip">Advance anyway</button>
        <button class="btn-primary" id="btn-rec-go">Open Recruiting</button>
      </div>
    </div>
  </div>`;
}
function renderEventTakeover(school, mode) {
  var _a;
  const accent = ((_a = school == null ? void 0 : school.colors) == null ? void 0 : _a[0]) || "var(--green)";
  let railHtml = "", kicker = "", title = "", sub = "", body = "", below = "";
  let btnLabel = "CONTINUE \u2192";
  if (mode === "offseason") {
    const stages = visibleStages(state);
    const idx = Math.min(state.offseason.stage, stages.length - 1);
    const stage = stages[idx];
    railHtml = stages.map(
      (s, i) => `<span class="event-rail-step${i < idx ? " done" : i === idx ? " current" : ""}">${escapeHtml(s.label)}</span>`
    ).join('<span class="event-rail-sep">\u2192</span>');
    kicker = `Offseason \xB7 Stage ${idx + 1} of ${stages.length}`;
    title = stage.label;
    sub = stage.stub;
    body = eventStageBody(stage, school);
  } else if (mode === "preseason") {
    const week = state.day;
    const focusMeta = PRESEASON_WEEKS[week] || { id: "camp", label: "Camp" };
    const preseasonIntro = {
      expectations: "Meet the program standard, review the season goals, and set the tone for the year.",
      recruiting: "Build the next class: scout prospects, shape your board, and start the relationships that win signing day.",
      spring: "Choose a training focus, test the roster in the spring game, and settle any position changes.",
      redshirts: "Make the final eligibility decisions and preserve the right development years before kickoff.",
      camp: "Finish camp, check the depth chart, and get the roster ready for kickoff."
    }[focusMeta.id];
    railHtml = [1, 2, 3, 4].map(
      (w) => `<span class="event-rail-step${w < week ? " done" : w === week ? " current" : ""}">W${w} ${escapeHtml((PRESEASON_WEEKS[w] || {}).label || "")}</span>`
    ).join('<span class="event-rail-sep">\u2192</span>') + '<span class="event-rail-sep">\u2192</span><span class="event-rail-step">Season Opener</span>';
    kicker = `Preseason \xB7 Week ${week} of ${PHASES.PRESEASON.days[1]}`;
    title = focusMeta.label;
    sub = preseasonIntro;
    body = preseasonStageBody(school, focusMeta);
  } else if (mode === "playoffs") {
    ({ railHtml, kicker, title, sub, body } = playoffContent(school));
    below = renderSeasonStrip(school);
    btnLabel = "ADVANCE WEEK \u2192";
  } else if (mode === "jobs") {
    kicker = "Offseason";
    title = "Between Seasons";
    sub = `The books are closed on Season ${state.season}. Here is the program you take into ${state.season + 1}.`;
    body = jobsBody(school);
  } else {
    ({ railHtml, kicker, title, sub, body } = gameWeekContent(school));
    below = renderSeasonStrip(school);
    btnLabel = state.day === 4 ? "KICK OFF THE SEASON \u2192" : "ADVANCE WEEK \u2192";
  }
  return `
  <div class="view-dashboard event-takeover">
    <div class="view-header">
      <div>
        <h1 class="view-title">
          <span class="dash-crest">${renderCrest(school, 34)}</span>
          ${escapeHtml((school == null ? void 0 : school.name) || "")} <span class="title-nick" style="color:${accent}">${escapeHtml((school == null ? void 0 : school.nick) || "")}</span>
        </h1>
        <div class="view-subtitle">Season ${state.season} &middot; ${escapeHtml(dashCalendarLine())}</div>
      </div>
      <button class="btn-advance" id="btn-advance-day">${btnLabel}</button>
    </div>

    ${renderTreeAgenda()}

    ${renderHandoffCard()}

    ${railHtml ? `<div class="event-rail">${railHtml}</div>` : ""}

    <div class="event-screen">
      <div class="event-kicker">${escapeHtml(kicker)}</div>
      <h2 class="event-title">${escapeHtml(title)}</h2>
      <p class="event-sub">${escapeHtml(sub)}</p>
      <div class="event-body">${body}</div>
    </div>

    ${below}
  </div>
  ${state.ui.showRedshirtBurnWarn ? renderRedshirtBurnWarnModal() : ""}
  ${state.ui.showRecruitStartWarn ? renderRecruitStartWarnModal() : ""}
`;
}
// ── [W9 §12 T1] THE LOCKSTEP AGENDA ────────────────────────────────────────
// "Your other coaches' games appear in the weekly agenda as links — TAKE OVER
// (play it) or SOFT FINALIZE (accept the pending result), and once every tree
// coach's week is soft-finalized or played, the user advances the week."
//
// Rendered above the week screen because it is the gate ON that week: the
// advance button is right there, and this is the thing standing in front of
// it. A one-slot tree, and every non-tree save, renders nothing at all.
function renderTreeAgenda() {
  if (!isTreeGame(state)) return "";
  refreshAgenda(state);
  const rows = agendaRows(state);
  if (!rows.length) return "";
  const pending = agendaPending(state).length;
  const nameOf = (id) => {
    var _a2;
    return ((_a2 = state.world) == null ? void 0 : _a2.schools.find((s) => s.id === id)?.name) || "?";
  };
  return `
    <div class="tree-agenda${pending ? " tree-agenda-blocking" : ""}">
      <div class="tree-agenda-hdr">
        <span>YOUR OTHER PROGRAMS \xB7 THIS WEEK</span>
        ${pending > 1 ? '<button class="btn-ghost btn-sm" id="tree-finalize-all">Accept all</button>' : ""}
      </div>
      ${rows.map((r) => `
        <div class="tree-agenda-row${r.status === "finalized" ? " done" : ""}">
          <div class="tree-agenda-game">
            <span class="tree-chair-div">${r.division}</span>
            ${escapeHtml(nameOf(r.schoolId))} <span class="muted">${r.home ? "vs" : "at"} ${escapeHtml(nameOf(r.oppId))}</span>
          </div>
          ${r.status === "finalized" ? '<span class="tree-agenda-done">✓ accepted</span>' : `<div class="tree-agenda-acts">
                 <button class="btn-ghost btn-sm" data-tree-final="${r.division}">Soft finalize</button>
                 <button class="btn-primary btn-sm" data-tree-take="${r.division}">Take over</button>
               </div>`}
        </div>`).join("")}
      ${pending ? `<div class="tree-agenda-note">The week can't move until every one of these is played or accepted. That's the deal with running more than one program — one clock, one truth.</div>` : ""}
    </div>`;
}
function dashCalendarLine() {
  const w = calendarWeek(state.day);
  return w.kind === "regular" ? `${w.label} \xB7 ${getPhaseLabel()}` : w.label;
}
function gameWeekContent(school) {
  var _a, _b, _c, _d, _e, _f;
  const next = getUpcomingGame();
  const railHtml = seasonRailHtml(school, next);
  if (!next) {
    return {
      railHtml,
      kicker: `${getPhaseLabel()} \xB7 ${weekLabel(state.day)} of ${REG_WEEK_COUNT}`,
      title: "Regular Season Complete",
      sub: "Championship selection week \u2014 the playoff field is announced when you advance.",
      body: `
      <div class="offseason-item" style="margin-top:8px">
        <span class="offseason-label">Final record</span>
        <span class="offseason-detail">${fmtRecord(((_a = school == null ? void 0 : school.record) == null ? void 0 : _a.wins) || 0, ((_b = school == null ? void 0 : school.record) == null ? void 0 : _b.losses) || 0)} overall \xB7 ${fmtRecord(((_c = school == null ? void 0 : school.record) == null ? void 0 : _c.confWins) || 0, ((_d = school == null ? void 0 : school.record) == null ? void 0 : _d.confLosses) || 0)} conference</span>
      </div>
      <div class="offseason-item">
        <span class="offseason-label">Recruiting</span>
        <span class="offseason-detail">the class locks this week \u2014 last call for the board</span>
      </div>
      `
    };
  }
  const isHome = next.homeId === (school == null ? void 0 : school.id);
  const opp = state.world.schools.find((s) => s.id === (isHome ? next.awayId : next.homeId));
  const rmapD = school ? rankMap(state, school.division) : /* @__PURE__ */ new Map();
  const oppRank = opp ? rmapD.get(opp.id) : null;
  const played = (state.schedule || []).filter((g) => g.result && (g.homeId === (school == null ? void 0 : school.id) || g.awayId === (school == null ? void 0 : school.id))).length;
  const isOpener = played === 0 && !next.postseason;
  const isRival = !!(state.rivalry && opp && state.rivalry.schoolId === opp.id && (next.rivalry === true || next.rivalry === void 0 && next.day === C.RIVALRY_DAY));
  const gPhase = getPhase(next.day);
  const tag = next.postseason ? "Playoffs" : gPhase === "CONFCHAMP" ? "Selection Week" : isRival ? `Rivalry Week \u2014 ${state.rivalry.trophy}` : isOpener ? "Season Opener" : gPhase === "CONFERENCE" ? "Conference" : "Non-Conference";
  const byeAhead = next.day > state.day + 1;
  return {
    railHtml,
    kicker: `Game Week \xB7 ${tag}`,
    title: `${isHome ? "vs" : "@"} ${oppRank ? `#${oppRank} ` : ""}${(opp == null ? void 0 : opp.name) || "TBD"}`,
    sub: `${weekLabel(next.day)} \xB7 ${isHome ? "at home" : "on the road"} \xB7 they're ${fmtRecord(((_e = opp == null ? void 0 : opp.record) == null ? void 0 : _e.wins) || 0, ((_f = opp == null ? void 0 : opp.record) == null ? void 0 : _f.losses) || 0)}` + (byeAhead ? ` \xB7 bye week first \u2014 nothing to play until ${weekLabel(next.day)}` : ""),
    body: gameWeekBody(next, school, opp, isHome)
  };
}
function gameWeekBody(game, school, opp, isHome) {
  var _a, _b, _c, _d;
  const rk = (s) => {
    if (!s) return "";
    const r = rankMap(state, s.division).get(s.id);
    return r ? `<span class="poll-rank-tag">#${r}</span> ` : "";
  };
  const myRating = schoolAvgRating(school);
  const oppRating = schoolAvgRating(opp);
  const spread = myRating - oppRating;
  return `
  <div class="next-game">
    <div class="next-game-matchup">
      <div class="matchup-team${!isHome ? " opp" : ""}">
        <div class="matchup-name">${school ? `<span class="team-link" data-scout-team="${school.id}">${rk(school)}${escapeHtml(school.name)}</span>` : ""}</div>
        <div class="matchup-record">${fmtRecord(((_a = school == null ? void 0 : school.record) == null ? void 0 : _a.wins) || 0, ((_b = school == null ? void 0 : school.record) == null ? void 0 : _b.losses) || 0)}</div>
      </div>
      <div class="matchup-at">${isHome ? "vs" : "@"}</div>
      <div class="matchup-team${isHome ? " opp" : ""}">
        <div class="matchup-name">${opp ? `<span class="team-link" data-scout-team="${opp.id}">${rk(opp)}${escapeHtml(opp.name)}</span>` : "TBD"}</div>
        <div class="matchup-record">${fmtRecord(((_c = opp == null ? void 0 : opp.record) == null ? void 0 : _c.wins) || 0, ((_d = opp == null ? void 0 : opp.record) == null ? void 0 : _d.losses) || 0)}</div>
      </div>
    </div>
    <div class="spread-bar">
      <div class="spread-label">${spread >= 0 ? "Favored" : "Underdog"} by ~${Math.abs(Math.round(spread * 0.4))} pts</div>
      <div class="spread-track">
        <div class="spread-fill" style="width:${Math.max(4, Math.min(96, Math.round(50 + spread * 1.5)))}%;background:${spread > 0 ? "var(--green)" : "var(--red)"}"></div>
      </div>
    </div>
    ${renderThisWeek(opp, school)}
  </div>
  ${renderLeagueHeadlines(school)}
`;
}
function renderLeagueHeadlines(school) {
  var _a;
  const played = (state.schedule || []).filter((g) => g.result);
  if (!played.length || !school) return "";
  const lastDay = Math.max(...played.map((g) => g.day));
  const dayGames = played.filter((g) => g.day === lastDay);
  const byId = (id) => state.world.schools.find((s) => s.id === id);
  const ranks = rankMap(state, school.division);
  const items = [];
  const wk = (state.awardsLog || []).filter((a) => a.scope === "weekly" && a.season === state.season).pop();
  if (wk == null ? void 0 : wk.playerName) {
    const nameHtml = wk.playerId ? `<span class="player-link" data-pcard="${wk.playerId}">${escapeHtml(wk.playerName)}</span>` : escapeHtml(wk.playerName);
    const schHtml = wk.schoolId ? `<span class="team-link" data-scout-team="${wk.schoolId}">${escapeHtml(wk.schoolName || "")}</span>` : escapeHtml(wk.schoolName || "");
    items.push(`\u2B50 Weekly honors: ${nameHtml} (${schHtml})`);
  }
  let upset = null;
  for (const g of dayGames) {
    const winner = byId(g.result.winner);
    const loser = byId(g.result.winner === g.homeId ? g.awayId : g.homeId);
    if (!winner || !loser || winner.division !== school.division) continue;
    const wR = ranks.get(winner.id) || 99, lR = ranks.get(loser.id) || 99;
    const gap = wR - lR;
    if (lR <= 15 && gap >= 8 && (!upset || gap > upset.gap)) {
      const ws = g.result.winner === g.homeId ? g.result.homeScore : g.result.awayScore;
      const ls = g.result.winner === g.homeId ? g.result.awayScore : g.result.homeScore;
      upset = { gap, text: `\u{1F631} Upset: ${wR <= 25 ? "#" + wR + " " : ""}<span class="team-link" data-scout-team="${winner.id}">${escapeHtml(winner.name)}</span> stuns #${lR} <span class="team-link" data-scout-team="${loser.id}">${escapeHtml(loser.name)}</span>, ${ws}\u2013${ls}` };
    }
  }
  if (upset) items.push(upset.text);
  const rivId = (_a = state.rivalry) == null ? void 0 : _a.schoolId;
  if (rivId && rivId !== school.id) {
    const rg = dayGames.find((g) => g.homeId === rivId || g.awayId === rivId);
    const riv = byId(rivId);
    if (rg && riv) {
      const won = rg.result.winner === rivId;
      const oppSch = byId(rg.homeId === rivId ? rg.awayId : rg.homeId);
      const rs = rg.homeId === rivId ? rg.result.homeScore : rg.result.awayScore;
      const os = rg.homeId === rivId ? rg.result.awayScore : rg.result.homeScore;
      items.push(`\u{1F525} Rival watch: <span class="team-link" data-scout-team="${riv.id}">${escapeHtml(riv.name)}</span> ${won ? "beat" : "fell to"} ${oppSch ? `<span class="team-link" data-scout-team="${oppSch.id}">${escapeHtml(oppSch.name)}</span>` : "?"}, ${rs}\u2013${os}`);
    }
  }
  if (!items.length) return "";
  return `
  <div class="card league-headlines">
    <div class="card-title">AROUND THE LEAGUE <span class="muted" style="font-weight:400">\xB7 ${escapeHtml(calendarWeek(lastDay).label)}</span></div>
    ${items.map((t) => `<div class="headline-item">${t}</div>`).join("")}
  </div>`;
}
function renderSeasonStrip(school) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
  const standings = getConferenceStandings();
  const injured = ((school == null ? void 0 : school.roster) || []).filter((p) => p.injuryGamesOut > 0);
  const boardCount = ((_b = (_a = state.playerCoach) == null ? void 0 : _a.recruitBoard) == null ? void 0 : _b.length) || 0;
  const committed = (((_c = state.world) == null ? void 0 : _c.recruits) || []).filter((r) => r.committed === (school == null ? void 0 : school.id)).length;
  return `
  <div class="dashboard-grid">
    ${state.ui.lastGameResult ? `
    <div class="card card-wide card-result-teaser">
      <div class="card-header"><span class="card-title">LAST GAME</span></div>
      <div class="result-teaser" id="open-last-result">
        ${renderLastGameTeaser(school)}
      </div>
    </div>` : ""}

    <div class="card">
      <div class="card-header"><span class="card-title">THIS SEASON</span></div>
      <div class="record-display">
        <div class="record-big">${fmtRecord(((_d = school == null ? void 0 : school.record) == null ? void 0 : _d.wins) || 0, ((_e = school == null ? void 0 : school.record) == null ? void 0 : _e.losses) || 0)}</div>
        <div class="record-sub">${fmtRecord(((_f = school == null ? void 0 : school.record) == null ? void 0 : _f.confWins) || 0, ((_g = school == null ? void 0 : school.record) == null ? void 0 : _g.confLosses) || 0)} Conf.</div>
      </div>
      <div class="stat-grid">
        <div class="stat-item">
          <div class="stat-label">PPG</div>
          <div class="stat-val">${((_h = school == null ? void 0 : school.stats) == null ? void 0 : _h.games) ? (school.stats.pointsFor / school.stats.games).toFixed(1) : "\u2014"}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Opp PPG</div>
          <div class="stat-val">${((_i = school == null ? void 0 : school.stats) == null ? void 0 : _i.games) ? (school.stats.pointsAgainst / school.stats.games).toFixed(1) : "\u2014"}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">YPG</div>
          <div class="stat-val">${((_j = school == null ? void 0 : school.stats) == null ? void 0 : _j.games) ? Math.round(school.stats.totalYds / school.stats.games) : "\u2014"}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">TO</div>
          <div class="stat-val">${((_k = school == null ? void 0 : school.stats) == null ? void 0 : _k.turnovers) || 0}</div>
        </div>
      </div>
      <div class="dash-quick-stats">
        ${injured.length > 0 ? `<span class="dash-qs-item dash-qs-injury">INJ: ${injured.length}</span>` : `<span class="dash-qs-item dash-qs-ok">\u2713 Full health</span>`}
        <span class="dash-qs-item">Board: ${boardCount}</span>
        <span class="dash-qs-item">Commits: ${committed}</span>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">CONF. STANDINGS</span>
        <button class="card-action" data-nav="standings">Full \u2192</button>
      </div>
      <div class="table-scroll"><table class="data-table compact">
        <thead><tr><th>School</th><th>Conf</th><th>W-L</th></tr></thead>
        <tbody>
          ${renderDashboardStandings(standings, school)}
        </tbody>
      </table></div>
    </div>
  </div>
`;
}
function playoffContent(school) {
  var _a;
  const bracket = state.playoffs;
  const schoolId = school == null ? void 0 : school.id;
  const div = (school == null ? void 0 : school.division) || "";
  const rounds = bracket.rounds || [];
  const inField = (_a = bracket.seeds) == null ? void 0 : _a.includes(schoolId);
  const seed = inField ? bracket.seeds.indexOf(schoolId) + 1 : null;
  const myGames = [];
  for (let ri = 0; ri < rounds.length; ri++) {
    for (const g of rounds[ri].games) {
      if (g.homeId === schoolId || g.awayId === schoolId) myGames.push({ roundIdx: ri + 1, game: g });
    }
  }
  const upcoming = myGames.find(({ game }) => !game.result);
  const isChampion = bracket.champion === schoolId;
  const isEliminated = !isChampion && myGames.some(({ game }) => game.result && game.result.winner !== schoolId);
  const bowlGame = (state.bowls || []).find((g) => g.homeId === schoolId || g.awayId === schoolId);
  const champion = bracket.champion ? state.world.schools.find((s) => s.id === bracket.champion) : null;
  const roundNames = rounds.length === 4 ? ["Round of 16", "Quarterfinals", "Semifinals", "Final"] : rounds.map((_, i) => `Round ${i + 1}`);
  let curIdx = rounds.findIndex((r) => (r.games || []).some((g) => !g.result));
  if (curIdx === -1) curIdx = rounds.length;
  const railHtml = roundNames.map(
    (n, i) => `<span class="event-rail-step${i < curIdx ? " done" : i === curIdx ? " current" : ""}">${escapeHtml(n)}</span>`
  ).join('<span class="event-rail-sep">\u2192</span>');
  let title, sub;
  if (isChampion) {
    title = `${div} Champions!`;
    sub = "The trophy comes home. Continue on to the offseason.";
  } else if (upcoming) {
    const g = upcoming.game;
    const isHome = g.homeId === schoolId;
    const opp = state.world.schools.find((s) => s.id === (isHome ? g.awayId : g.homeId));
    title = `${roundNames[upcoming.roundIdx - 1]}: ${isHome ? "vs" : "@"} ${(opp == null ? void 0 : opp.name) || "TBD"}`;
    sub = `Seed #${seed} \xB7 win and move on \u2014 lose and the season's over.`;
  } else if (isEliminated) {
    title = "Eliminated";
    sub = "Your run is over. Skip ahead, or watch the bracket play out week by week.";
  } else if (inField) {
    title = `In the Field \u2014 Seed #${seed}`;
    sub = "The bracket is set. Your matchup appears when the round is drawn.";
  } else if (bowlGame && !bowlGame.result) {
    title = "Bowl Season";
    sub = "No playoff bid, but there's one more game to win.";
  } else {
    title = "Watching from Home";
    sub = `You didn't qualify \u2014 the ${div} bracket plays out over the next few weeks.`;
  }
  let body = "";
  if (state.day >= 20 && state.day <= 23 && !playerHasPendingPostseason(state)) {
    body += `
    <button class="btn-primary" id="btn-skip-offseason" style="margin:8px 0;width:100%">
      Skip to Offseason \u23E9
    </button>
    <div class="playoff-digest">
      ${playoffDigest(state).map((r) => `
        <div class="offseason-item" style="align-items:flex-start">
          <span class="offseason-label">${escapeHtml(r.label)}</span>
          <span class="offseason-detail" style="text-align:right">${r.lines.map(escapeHtml).join("<br>")}</span>
        </div>`).join("")}
    </div>`;
  }
  if (upcoming) {
    const g = upcoming.game;
    const isHome = g.homeId === schoolId;
    const opp = state.world.schools.find((s) => s.id === (isHome ? g.awayId : g.homeId));
    body += gameWeekBody(g, school, opp, isHome);
  }
  const playedGames = myGames.filter((r) => r.game.result);
  if (playedGames.length > 0) {
    body += `
    <div class="playoff-history" style="margin-top:12px">
      ${playedGames.map(({ roundIdx, game }) => {
      const won = game.result.winner === schoolId;
      const isHome = game.homeId === schoolId;
      const oppId = isHome ? game.awayId : game.homeId;
      const opp = state.world.schools.find((s) => s.id === oppId);
      const myScore = isHome ? game.result.homeScore : game.result.awayScore;
      const oppScore = isHome ? game.result.awayScore : game.result.homeScore;
      const roundLabel = roundIdx === 1 ? "R16" : roundIdx === 2 ? "QF" : roundIdx === 3 ? "SF" : "F";
      return `
          <div class="playoff-hist-row ${won ? "hist-win" : "hist-loss"}">
            <span class="hist-badge">${won ? "W" : "L"}</span>
            <span class="hist-score">${myScore}\u2013${oppScore}</span>
            <span class="hist-opp">${opp ? `<span class="team-link" data-scout-team="${opp.id}">${escapeHtml(opp.name)}</span>` : "TBD"}</span>
            <span class="hist-round">${roundLabel}</span>
          </div>`;
    }).join("")}
    </div>`;
  }
  if (champion && !upcoming) {
    body += `<div class="playoff-champ-note">Champion: <strong><span class="team-link" data-scout-team="${champion.id}">${escapeHtml(champion.name)}</span></strong></div>`;
  }
  if (bowlGame) body += renderBowlGameSnippet(bowlGame, school);
  body += `
  <div style="display:flex;gap:6px;margin-top:14px;flex-wrap:wrap">
    <button class="btn-ghost btn-sm" data-nav="schedule">Full Bracket</button>
    <button class="btn-ghost btn-sm" data-nav="standings">Standings</button>
  </div>`;
  return {
    railHtml,
    kicker: `Playoffs \xB7 ${div}${inField ? ` \xB7 Seed #${seed}` : ""}`,
    title,
    sub,
    body
  };
}
// [PLAYTEST 2026-08-12 item 1] This screen used to embed renderScheduling() — the
// exact widget the "Scheduling & Rivalry" stage had shown one click earlier — under
// a subtitle that also promised roster trimming that happens six stages back. It is
// now the one thing the offseason never gives you: the state of the program you are
// about to take into a new season.
function jobsBody(school) {
  var _a;
  const coach = state.playerCoach;
  const roster = (school == null ? void 0 : school.roster) || [];
  const incoming = (state.signingsLog || []).filter((sg) => sg.season === state.season && sg.schoolId === (school == null ? void 0 : school.id)).length;
  const st = (school == null ? void 0 : school.staff) || {};
  const coordName = (c) => c ? escapeHtml(`${c.name.first} ${c.name.last}`) : '<span style="color:var(--red)">vacant</span>';
  const yrsLeft = ((_a = coach == null ? void 0 : coach.contract) == null ? void 0 : _a.endSeason) != null ? Math.max(0, coach.contract.endSeason - state.season) : null;
  const rows = [
    ["Roster", `${roster.length} on the books for Season ${state.season + 1}`],
    ["Incoming class", incoming ? `${incoming} signed` : "none signed"],
    ["Offensive coordinator", coordName(st.oc)],
    ["Defensive coordinator", coordName(st.dc)],
    ["Your deal", yrsLeft == null ? "—" : yrsLeft > 0 ? `${yrsLeft} season${yrsLeft !== 1 ? "s" : ""} left` : "expiring"],
    ["Program", `${escapeHtml((school == null ? void 0 : school.name) || "")} \xB7 ${escapeHtml((school == null ? void 0 : school.division) || "")}${(school == null ? void 0 : school.conf) ? ` \xB7 ${escapeHtml(school.conf)}` : ""}`]
  ];
  return `
  <div class="card">
    <div class="card-header"><span class="card-title">WHERE YOU STAND</span>
      <span class="muted" style="font-size:11px">everything the offseason changed</span></div>
    ${rows.map(([k, v]) => `<div class="offseason-item"><span class="offseason-label">${k}</span><span class="offseason-detail">${v}</span></div>`).join("")}
  </div>
  <p class="offseason-hint" style="margin-top:10px">Schedule, staff and roster are locked. Continue to open camp for Season ${state.season + 1}.</p>`;
}
// CUT DAY RECS (Aug 2026, owner ask): before the cut list, the staff pitches
// position changes for buried bodies other rooms need — convert a fit instead
// of cutting a player. Same economy as the spring board (camp cap, camp lock);
// Continue drops you on the cut screen, and a link brings the pitches back.
// The staff's pitch list, rendered identically wherever it appears. Cut day and
// camp week both show it — [PLAYTEST 2026-08-12, owner: "camp week should inherit
// the recommended position changes + the table for the changes"] — so it lives in
// one function rather than being copied and left to drift.
function conversionRecRows(recs, capLeft) {
  const ord = (n) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
  return `
  <div class="inline-roster-list" style="margin-top:8px">
    ${recs.map((r) => {
    const diff = r.projected - r.current;
    return `
        <div class="cut-row" style="flex-wrap:wrap">
          <span class="pos-chip pos-${r.from}">${r.from}</span>
          <span style="color:var(--muted)">\u2192</span>
          <span class="pos-chip pos-${r.to}">${r.to}</span>
          <span class="cut-yr muted">${r.classYear}${r.isWalkOn ? " WO" : ""}</span>
          <span class="cut-name"><span class="player-link" data-pcard="${r.playerId}">${escapeHtml(r.name)}</span></span>
          <span class="rating-chip rating-${ratingColor(r.current)}">${r.current}</span>
          <span style="color:var(--muted)">\u2192</span>
          <span class="rating-chip rating-${ratingColor(r.projected)}">${r.projected}</span>
          <span style="color:${diff >= 0 ? "var(--green)" : "var(--red)"};font-size:12px">${diff >= 0 ? "+" : ""}${diff}</span>
          <button class="btn-sm btn-primary cutrec-convert-btn" data-cutrec-id="${r.playerId}" data-cutrec-to="${r.to}" ${capLeft <= 0 ? 'disabled title="Camp conversion limit reached"' : ""}>Convert</button>
          <span class="offseason-hint" style="flex-basis:100%;margin:2px 0 0">${ord(r.fromRank)} of ${r.fromCount} in the ${r.from} room \u00b7 ${r.deficit > 0 ? `${r.to} room is ${r.deficit} short` : `walks in as the ${ord(r.toRank)} ${r.to}`}${r.bodyDelta ? ` \u00b7 <b>${r.bodyDelta > 0 ? `bulks up (+${r.bodyDelta} lb)` : `slims down (\u2212${Math.abs(r.bodyDelta)} lb)`}</b>` : ""}${r.unhappy ? ' \u00b7 <b style="color:var(--red)">unhappy \u2014 flight risk</b>' : r.usageBuried ? ' \u00b7 <span style="color:var(--muted)">rotation barely used him</span>' : ""}</span>
        </div>`;
  }).join("")}
  </div>`;
}
function cutDayRecsBody(school, recs) {
  var _a, _b;
  const pre = devCtx(state);
  const capLeft = C.POS_CHANGE_CAP - ((pre.posChanges || []).filter((c) => !c.anytime).length);
  const penaltyPct = Math.round(conversionPenaltyFactor(state) * 100);
  return `
  <div class="offseason-item" style="margin-top:8px">
    <span class="offseason-label">Staff recommendation${recs.length !== 1 ? "s" : ""}</span>
    <span class="offseason-detail">${recs.length} position change${recs.length !== 1 ? "s" : ""} worth a look before anyone gets cut \u00b7 <b>${Math.max(0, capLeft)}/${C.POS_CHANGE_CAP} camp conversions left</b></span>
  </div>
  <p class="offseason-hint" style="margin:4px 0 8px">The staff walked the roster before cut day: these players are buried where they are, and another room has a job for them. A convert takes a \u2212${penaltyPct}% haircut for one season and locks in when camp runs \u2014 it counts against the same ${C.POS_CHANGE_CAP}-conversion camp limit as the spring board. Convert who you like, then head to cuts.</p>
  ${conversionPreviewPanel()}
  ${conversionRecRows(recs, capLeft)}
  <button class="btn-primary" id="btn-cutrecs-continue" style="margin-top:12px;width:100%">Continue to Cut Day \u2192</button>`;
}
function cutDayBody(school) {
  var _a;
  const _recs = cutDayConversionRecs(state);
  if (_recs.length && !((_a = state.offseason) == null ? void 0 : _a.data.cutRecsSeen)) return cutDayRecsBody(school, _recs);
  const coach = state.playerCoach;
  const roster = (school == null ? void 0 : school.roster) || [];
  const scholarships = (coach == null ? void 0 : coach.scholarshipsAvailable) || 0;
  const leavingSrs = graduatingSeniors(state);
  const gradsLeaving = leavingSrs.length;
  const gradIds = new Set(leavingSrs.map((p) => p.id));
  const over = effectiveRosterOver(state);
  const cutsUsed = ((_a = coach == null ? void 0 : coach.cutsUsed) == null ? void 0 : _a.season) === state.season ? coach.cutsUsed.n : 0;
  const atCutCap = cutsUsed >= C.SEASON_CUT_CAP && over <= 0;
  const schCount = roster.filter((p) => !p.isWalkOn).length;
  const woCount = roster.filter((p) => p.isWalkOn).length;
  const CLASS_ORDER = { FR: 0, SO: 1, JR: 2, SR: 3 };
  // Departing seniors are off the roster in six days and their scholarships are
  // already netted out of `over` — cutting one buys nothing and burns a cut.
  const displayed = roster.filter((p) => !gradIds.has(p.id) && (!cutModalPos || p.position === cutModalPos) && (!cutModalClass || p.classYear === cutModalClass)).sort((a, b) => {
    var _a2, _b;
    const pc = (a.position || "").localeCompare(b.position || "");
    if (pc !== 0) return pc;
    return ((_a2 = CLASS_ORDER[a.classYear]) != null ? _a2 : 0) - ((_b = CLASS_ORDER[b.classYear]) != null ? _b : 0);
  });
  return `
  <div class="offseason-item" style="margin-top:8px">
    <span class="offseason-label">Roster</span>
    <span class="offseason-detail">${roster.length}/${C.ROSTER_SIZE}${gradsLeaving > 0 ? ` (\u2212${gradsLeaving} grad)` : ""}${over > 0 ? ` \xB7 <b style="color:var(--red)">cut ${over} to advance</b>` : " \xB7 under the cap \u2713"} \xB7 ${schCount} scholarship \xB7 ${woCount} walk-on \xB7 ${scholarships} slots open \xB7 <b${atCutCap ? ' style="color:var(--red)"' : ""}>${cutsUsed}/${C.SEASON_CUT_CAP} cuts used</b></span>
  </div>
  <p class="offseason-hint" style="margin:4px 0 8px">Cuts are permanent. Scholarship players return one slot; walk-ons do not. Graduating seniors (${gradsLeaving}) leave free at season's end and are already counted. Max ${C.SEASON_CUT_CAP} cuts a season (over-cap trims don't count against it). The portal won't open until the roster fits.</p>
  ${_recs.length ? `<button class="btn-ghost btn-sm" id="btn-cutrecs-back" style="margin:0 0 8px">\u21c4 Staff suggestions \u2014 ${_recs.length} position change${_recs.length !== 1 ? "s" : ""} on the table</button>` : ""}
  <div class="filter-chips">
    <button class="filter-chip${!cutModalPos ? " active" : ""}" data-cut-pos="">ALL POS</button>
    ${POSITIONS.map((p) => `<button class="filter-chip${cutModalPos === p ? " active" : ""}" data-cut-pos="${p}">${p}</button>`).join("")}
  </div>
  <div class="filter-chips" style="margin-top:4px">
    <button class="filter-chip${!cutModalClass ? " active" : ""}" data-cut-class="">ALL YRS</button>
    ${["FR", "SO", "JR", "SR"].map((yr) => `<button class="filter-chip${cutModalClass === yr ? " active" : ""}" data-cut-class="${yr}">${yr}</button>`).join("")}
  </div>
  <div class="inline-roster-list" style="margin-top:8px">
    ${displayed.length === 0 ? '<div class="empty-state">No players match filters</div>' : displayed.map((p) => `
        <div class="cut-row">
          <span class="pos-chip pos-${p.position}">${p.position}</span>
          <span class="cut-yr muted">${p.classYear}${p.isWalkOn ? " WO" : ""}</span>
          <span class="cut-name"><span class="player-link" data-pcard="${p.id}">${escapeHtml(fullName(p))}</span></span>
          <span class="rating-chip rating-${ratingColor(p.compositeRating)}">${Math.round(p.compositeRating)}</span>
          ${!p.isWalkOn ? '<span class="cut-schol muted">+1 schol</span>' : '<span class="cut-schol muted">\u2014</span>'}
          <button class="btn-sm btn-danger-ghost cut-player-btn" data-player-id="${p.id}" ${atCutCap ? 'disabled title="Season cut limit reached"' : ""}>Cut</button>
        </div>
      `).join("")}
  </div>`;
}
function redshirtFinalizeBody(school) {
  const pending2 = school == null ? void 0 : school.pendingRedshirts;
  if (pending2 == null) {
    const sitting = ((school == null ? void 0 : school.roster) || []).filter((p) => p.redshirted && p.redshirtYear === state.season);
    return `
    <div class="offseason-item" style="margin-top:8px">
      <span class="offseason-label">Redshirts finalized \u2713</span>
      <span class="offseason-detail">${sitting.length} player${sitting.length !== 1 ? "s" : ""} sitting the year \u2014 the window is closed</span>
    </div>
    ${sitting.map((p) => `
      <div class="cut-row">
        <span class="pos-chip pos-${p.position}">${p.position}</span>
        <span class="cut-yr muted">${p.classYear}</span>
        <span class="cut-name"><span class="player-link" data-pcard="${p.id}">${escapeHtml(fullName(p))}</span></span>
        <span class="rating-chip rating-${ratingColor(p.compositeRating)}">${Math.round(p.compositeRating)}</span>
      </div>`).join("")}`;
  }
  const roster = (school == null ? void 0 : school.roster) || [];
  const pendingSet = new Set(pending2);
  const autoIds = new Set(computeAutoRedshirtCandidates(school, state.season));
  const eligible = roster.filter((p) => !p.redshirted).sort((a, b) => b.compositeRating - a.compositeRating);
  const ineligible = roster.length - eligible.length;
  const CLASS_ORDER = { FR: 0, SO: 1, JR: 2, SR: 3 };
  const byPos = /* @__PURE__ */ new Map();
  for (const p of eligible) {
    if (!byPos.has(p.position)) byPos.set(p.position, []);
    byPos.get(p.position).push(p);
  }
  const posGroups = POSITIONS.filter((pos) => byPos.has(pos)).map((pos) => {
    const list = byPos.get(pos).sort((a, b) => {
      var _a, _b;
      return autoIds.has(b.id) - autoIds.has(a.id) || ((_a = CLASS_ORDER[a.classYear]) != null ? _a : 9) - ((_b = CLASS_ORDER[b.classYear]) != null ? _b : 9) || b.compositeRating - a.compositeRating;
    });
    const recCount = list.filter((p) => autoIds.has(p.id)).length;
    return { pos, list, recCount };
  });
  const group = ({ pos, list, recCount }) => `
  <div class="redshirt-group-label">${pos} <span class="muted">(${list.length}${recCount ? ` \xB7 ${recCount} recommended` : ""})</span></div>
  ${list.map((p) => renderRedshirtRow(p, pendingSet.has(p.id), autoIds.has(p.id))).join("")}`;
  return `
  <p class="offseason-hint" style="margin:8px 0 6px">This is the <b>only window all season</b> \u2014 decisions apply at kickoff and the door closes. One redshirt per career, any class: a redshirt sits the year (max ${C.REDSHIRT_MAX_GAMES} appearances before it burns) and keeps the year of eligibility.</p>
  <div class="redshirt-count" id="redshirt-count" style="border-radius:8px">${pending2.length} player${pending2.length !== 1 ? "s" : ""} selected${ineligible ? ` \xB7 ${ineligible} already used theirs` : ""}</div>
  <div class="inline-roster-list">
    ${posGroups.map(group).join("")}
    ${eligible.length === 0 ? '<div class="empty-state">Everyone has already used their redshirt.</div>' : ""}
  </div>
  <div style="display:flex;gap:8px;margin-top:10px">
    <button class="btn-ghost" id="btn-redshirt-reset" style="flex:1">Reset to Recommended</button>
    <button class="btn-primary" id="btn-redshirt-confirm" style="flex:1">Finalize Redshirts</button>
  </div>`;
}
function portalBody() {
  const portal = state.portal;
  const coach = state.playerCoach;
  const me = getPlayerSchool();
  if (!portal || portal.players.length === 0) {
    return '<div class="offseason-item"><span class="offseason-detail">A quiet window \u2014 nobody of note entered the portal this cycle.</span></div>';
  }
  const budget = Math.round((coach == null ? void 0 : coach.budget) || 0);
  const round = portal.round || 1, maxR = portal.maxRounds || 3;
  const finalWeek = round >= maxR;
  const room = portalScholarshipRoom(state);
  const ROLE_BADGE = {
    starter: '<span class="portal-role role-starter">STARTER JOB</span>',
    rotation: '<span class="portal-role role-rotation">ROTATION</span>',
    buried: '<span class="portal-role role-buried">HE\u2019D SIT</span>'
  };
  const reachable = portal.players.filter((e) => me && canSchoolSign(me, e.player));
  const outOfReach = portal.players.length - reachable.length;
  const open = reachable.filter((e) => !e.signedTo);
  const committed = reachable.filter((e) => e.signedTo);
  if (portal.resolved) {
    const mineSigned = portal.players.filter((e) => e.signedTo === state.playerSchoolId);
    const movedRow = (e) => {
      const p = e.player;
      const dest = e.signedTo === state.playerSchoolId ? '<span class="portal-committed">\u2705 Joined you</span>' : `<span class="portal-lost">\u2192 ${escapeHtml(e.signedToName || "signed elsewhere")}</span>`;
      return `
      <div class="offseason-item portal-row${e.signedTo === state.playerSchoolId ? " portal-mine" : ""}">
        <span class="offseason-label">
          <span class="pos-chip pos-${p.position}">${p.position}</span>
          <b><span class="player-link" data-pcard="${p.id}">${escapeHtml(fullName(p))}</span></b>
          <span class="class-badge class-${p.classYear.toLowerCase()}">${p.classYear}</span>
          <span style="color:var(--gold);font-weight:800">${Math.round(p.compositeRating || 0)}</span>
        </span>
        <span class="offseason-detail portal-meta">
          <span class="portal-from" data-scout-team="${e.fromSchoolId}">${escapeHtml(e.fromSchoolName)}</span>
          ${dest}
        </span>
      </div>`;
    };
    const sorted = [...portal.players].sort((a, b) => {
      const am = a.signedTo === state.playerSchoolId ? 0 : 1;
      const bm = b.signedTo === state.playerSchoolId ? 0 : 1;
      return am - bm || (b.player.compositeRating || 0) - (a.player.compositeRating || 0);
    });
    return `
    <div class="jm-summary" style="margin-bottom:8px">
      <div><span class="jm-num">Window closed</span></div>
      <div><span class="jm-num">${mineSigned.length}</span> joined your program</div>
      <div><span class="jm-num">${portal.players.length}</span> total moves</div>
    </div>
    <p class="offseason-hint">The transfer window has settled. ${mineSigned.length ? `You added <b>${mineSigned.length}</b> transfer${mineSigned.length === 1 ? "" : "s"} \u2014 each took a scholarship, and they\u2019re eligible immediately.` : "No transfers joined you this cycle."} <b>Continue</b> moves on to Signing Day.</p>
    ${mineSigned.length ? `<div class="portal-settled-head">Your transfer haul</div>${mineSigned.map(movedRow).join("")}` : ""}
    <div class="portal-settled-head">Around the league</div>
    ${sorted.filter((e) => e.signedTo !== state.playerSchoolId).map(movedRow).join("")}`;
  }
  const row = (e) => {
    const p = e.player;
    const mine = e.suitors.find((b) => b.schoolId === state.playerSchoolId);
    const inCount = e.suitors.length;
    const role = roleFor(me, p).role;
    const fr = frontRunner(state, e);
    let status;
    if (e.signedTo) {
      status = e.signedTo === state.playerSchoolId ? '<span class="portal-committed">\u2705 Joined you</span>' : `<span class="portal-lost">\u2192 ${escapeHtml(e.signedToName || "signed elsewhere")}</span>`;
    } else {
      const lead = !fr ? '<span class="portal-rivals quiet">no bids yet</span>' : fr.isPlayer ? '<span class="portal-rivals leading">You lead</span>' : `<span class="portal-rivals">${escapeHtml(fr.name)} leads</span>`;
      const suit = `<span class="portal-rivals">${inCount} in</span>`;
      const raiseCost = mine ? C.PORTAL_RAISE_STEP : pitchCost(p);
      const canAfford = ((coach == null ? void 0 : coach.budget) || 0) >= raiseCost;
      const blocked = !mine && (room <= 0 || !canAfford);
      const act = mine ? `<button class="btn-ghost btn-sm portal-pitch-btn" data-portal-pitch="${p.id}"${canAfford ? "" : " disabled"}>Raise $${raiseCost.toLocaleString()}</button>
         <button class="btn-ghost btn-sm portal-drop-btn" data-portal-drop="${p.id}">Drop</button>` : `<button class="btn-primary btn-sm portal-pitch-btn" data-portal-pitch="${p.id}"${blocked ? " disabled" : ""} title="${room <= 0 ? "No scholarships left for transfers" : !canAfford ? "Not enough budget" : ""}">Pitch $${raiseCost.toLocaleString()}</button>`;
      status = `${lead} ${suit} ${act}`;
    }
    return `
    <div class="offseason-item portal-row${mine ? " portal-mine" : ""}${e.signedTo ? " portal-done" : ""}">
      <span class="offseason-label">
        <span class="pos-chip pos-${p.position}">${p.position}</span>
        <b><span class="player-link" data-pcard="${p.id}">${escapeHtml(fullName(p))}</span></b>
        <span class="class-badge class-${p.classYear.toLowerCase()}">${p.classYear}</span>
        <span style="color:var(--gold);font-weight:800">${Math.round(p.compositeRating || 0)}</span>
        ${ROLE_BADGE[role] || ""}
      </span>
      <span class="offseason-detail portal-meta">
        <span class="portal-from" data-scout-team="${e.fromSchoolId}">${escapeHtml(e.fromSchoolName)}</span>
        <span class="portal-reason">${escapeHtml(e.reason)}</span>
        ${status}
      </span>
    </div>`;
  };
  const advanceBtn = finalWeek ? '<p class="offseason-hint">Final week \u2014 <b>Continue</b> closes the window and every race settles.</p>' : `<button class="btn-primary portal-week-btn" data-portal-next-round>Advance the week \u2192 (week ${round}/${maxR})</button>`;
  const resolveBtn = `<button class="btn-ghost portal-resolve-btn" data-portal-resolve>Settle now \u2014 see final results \u2192</button>`;
  return `
  <div class="jm-summary" style="margin-bottom:8px">
    <div><span class="jm-num">Week ${round}/${maxR}</span> of the window</div>
    <div><span class="jm-num">$${budget.toLocaleString()}</span> budget left</div>
    <div><span class="jm-num">${room}</span> scholarship${room === 1 ? "" : "s"} for transfers</div>
    <div><span class="jm-num">${open.length}</span> still open</div>
  </div>
  <p class="offseason-hint">Everyone here wants to <b>play</b>. The role you can offer \u2014 read off your depth chart \u2014 pulls harder than money. Pitch, then advance the week and the field reacts; a player with a clear-best home can commit early. Each transfer you land <b>takes a scholarship</b>, same as a signee.${outOfReach ? ` <span class="muted">(${outOfReach} higher-caliber player${outOfReach === 1 ? "" : "s"} entered but are out of your reach.)</span>` : ""}${room <= 0 ? ' <span class="portal-lost">No scholarships left \u2014 you can raise on active pitches but can\u2019t start new ones.</span>' : ""}</p>
  <div class="portal-actions" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${advanceBtn}${resolveBtn}</div>
  ${open.map(row).join("")}
  ${committed.length ? `<div class="portal-settled-head">Settled this window</div>${committed.map(row).join("")}` : ""}`;
}
function eventStageBody(stage, school) {
  var _a, _b, _c;
  if (stage.id === "jobmarket") return jobMarketBody();
  if (stage.id === "contract") return contractBody();
  if (stage.id === "walkons") return walkonBody();
  if (stage.id === "portal") return portalBody();
  if (stage.id === "staff") return staffStageBody(school);
  if (stage.id === "clinic") {
    const taken = (_b = (_a = state.offseason) == null ? void 0 : _a.data) == null ? void 0 : _b.clinicTaken;
    const btns = CLINIC_OPTIONS.map((c) => `
    <button class="btn-ghost btn-sm clinic-btn" data-skill="${c.skill}" ${taken ? "disabled" : ""}
      style="width:100%;margin-top:6px;text-align:left">
      ${escapeHtml(c.label)} <span class="offseason-detail" style="float:right">+${C.CLINIC_XP} ${c.skill}</span>
    </button>`).join("");
    return `
    ${taken ? `<div class="offseason-item" style="margin-top:8px"><span class="offseason-detail" style="color:var(--green)">Attended: ${escapeHtml((CLINIC_OPTIONS.find((c) => c.skill === taken) || {}).label || taken)} \u2713</span></div>` : ""}
    ${btns}`;
  }
  if (stage.id === "departures") return departuresBody(school);
  if (stage.id === "cuts") return cutDayBody(school);
  if (stage.id === "schedule") {
    const riv = state.rivalry;
    let rivBlock = "";
    if (riv) {
      const holder = riv.holderId === state.playerSchoolId ? "You hold it" : riv.holderId ? `<span class="team-link" data-scout-team="${riv.schoolId}">${escapeHtml(riv.schoolName)}</span> holds it` : "Never contested";
      rivBlock = `
      <div class="offseason-label" style="font-size:11px;letter-spacing:.5px;opacity:.7;margin-top:8px">RIVALRY</div>
      <div class="offseason-item">
        <span class="offseason-label">${escapeHtml(riv.trophy)}</span>
        <span class="offseason-detail">vs <span class="team-link" data-scout-team="${riv.schoolId}">${escapeHtml(riv.schoolName)}</span> \xB7 ${riv.wins}\u2013${riv.losses}${riv.ties ? `\u2013${riv.ties}` : ""} \xB7 ${holder}</span>
      </div>
      <p class="offseason-hint" style="margin:2px 0 8px">${riv.inherited && riv.since ? `They've played every year since ${riv.since}. ${weekLabel(C.RIVALRY_DAY)} is the trophy game \u2014 home and away alternate. This one was here before you, and the town keeps the record.` : `${weekLabel(C.RIVALRY_DAY)} is reserved for the trophy game \u2014 home and away alternate.`}</p>`;
    }
    return `
    ${rivBlock}
    <div class="event-embed">${renderScheduling()}</div>`;
  }
  if (stage.id === "awards") {
    const data = ((_c = state.offseason) == null ? void 0 : _c.data) || {};
    const goalResults = data.goalResults || [];
    const program = data.programMilestones || [];
    const hits = data.milestones || [];
    const goalsBody = goalResults.map((g) => `<div class="offseason-item"><span class="offseason-label">${g.hit ? "\u2713" : "\u2717"} ${escapeHtml(g.label)}</span><span class="offseason-detail">${g.hit ? `+${C.GOAL_JS_DELTA} security` : `\u2212${C.GOAL_JS_DELTA} security`}</span></div>`).join("");
    const programBody = program.map((p) => `<div class="offseason-item"><span class="offseason-label">\u{1F3C6} ${escapeHtml(p.label)}</span></div>`).join("");
    const hitsBody = hits.slice(0, 8).map((h) => `<div class="offseason-item"><span class="offseason-label">${escapeHtml(h.name)}</span><span class="offseason-detail">${escapeHtml(h.label)}</span></div>`).join("");
    const sec = (t, b) => b ? `<div style="margin:8px 0 4px"><div class="offseason-label" style="font-size:11px;letter-spacing:.5px;opacity:.7">${t}</div>${b}</div>` : "";
    const gr = state.playerCoach && state.playerCoach.lastGrade;
    const gradeCard = gr ? (() => {
      const cls = gr.score >= 0.82 ? "grade-a" : gr.score >= 0.62 ? "grade-b" : gr.score >= 0.42 ? "grade-c" : "grade-f";
      const line = gr.isNatty ? "National champions \u2014 a season for the banners." : gr.undefeated ? "A perfect season." : gr.isConfChamp ? "Conference champions." : gr.wins > gr.expWins + 1 ? `Beat expectations \u2014 the program expected ~${gr.expWins} wins.` : gr.wins < gr.expWins - 1 ? `Below the ~${gr.expWins}-win mandate the program set.` : `About what the program expected (~${gr.expWins} wins).`;
      return `<div class="coach-grade-card ${cls}">
        <div class="coach-grade-letter">${gr.letter}</div>
        <div class="coach-grade-text">
          <div class="coach-grade-title">SEASON GRADE</div>
          <div class="coach-grade-rec">${gr.wins}\u2013${gr.losses} \xB7 ${escapeHtml(line)}</div>
        </div>
      </div>`;
    })() : "";
    return `
    ${gradeCard}
    ${sec("AD REVIEW", goalsBody)}
    ${sec("PROGRAM MILESTONES", programBody)}
    ${sec("PLAYER MILESTONES", hitsBody)}
    <div style="margin-top:14px">${renderBanquetBody(state.season)}</div>`;
  }
  return "";
}
function preseasonStageBody(school, focusMeta) {
  return preseasonWeekBody(school, focusMeta);
}
function departuresBody(school) {
  const roster = (school == null ? void 0 : school.roster) || [];
  const leaving = graduatingSeniors(state);
  const leavingSet = new Set(leaving.map((p) => p.id));
  const twoDeep = /* @__PURE__ */ new Set();
  for (const arr of Object.values((school == null ? void 0 : school.depthChart) || {})) {
    for (const id of (arr || []).slice(0, 2)) twoDeep.add(id);
  }
  const schemeTargets = schemeRosterTargets(school);
  const rows = POSITIONS.map((pos) => {
    const atPos = roster.filter((p) => p.position === pos);
    const now = atPos.length;
    const grad = atPos.filter((p) => leavingSet.has(p.id)).length;
    const after = now - grad;
    const min = ROSTER_POS_MIN[pos] != null ? ROSTER_POS_MIN[pos] : 0;
    const target = schemeTargets[pos] || 0;
    const short = Math.max(0, min - after);
    const gradStarters = atPos.filter((p) => leavingSet.has(p.id) && twoDeep.has(p.id)).length;
    return { pos, now, grad, after, min, target, short, gradStarters };
  });
  const holes = rows.filter((r) => r.short > 0).sort((a, b) => b.short - a.short);
  const fine = rows.filter((r) => r.short === 0);
  const totalGrad = leaving.length;
  const totalGradStarters = leaving.filter((p) => twoDeep.has(p.id)).length;
  const posRow = (r) => {
    const arrow = r.grad > 0 ? `${r.now}\u2192${r.after}` : `${r.after}`;
    const statusCls = r.short > 0 ? "posmin-hole" : "posmin-ok";
    const rightTxt = r.short > 0 ? `<span class="posmin-need">need ${r.short}</span>` : `<span class="posmin-check">\u2713 min ${r.min}</span>`;
    const gradTxt = r.grad > 0 ? `<span class="posmin-grad">\u2212${r.grad} SR${r.gradStarters ? ` (${r.gradStarters}\u2605)` : ""}</span>` : `<span class="posmin-grad muted">\u2014</span>`;
    return `
    <div class="posmin-row ${statusCls}">
      <span class="pos-chip pos-${r.pos}">${r.pos}</span>
      <span class="posmin-count">${arrow}<span class="muted">/${r.min} min</span></span>
      ${gradTxt}
      ${rightTxt}
    </div>`;
  };
  const holesBlock = holes.length ? `
    <div class="redshirt-group-label" style="color:var(--red)">HOLES BELOW SOFT-MIN \u2014 recruit these</div>
    ${holes.map(posRow).join("")}` : `
    <div class="redshirt-group-label" style="color:var(--green)">No holes \u2014 every position clears its soft minimum after graduation \u2713</div>`;
  const fineBlock = fine.length ? `
    <div class="redshirt-group-label" style="margin-top:8px">STOCKED (after graduation)</div>
    ${fine.sort((a, b) => b.grad - a.grad || a.pos.localeCompare(b.pos)).map(posRow).join("")}` : "";
  const seniorList = leaving.length ? `
    <div class="redshirt-group-label" style="margin-top:10px">GRADUATING SENIORS (${leaving.length})</div>
    ${leaving.slice().sort((a, b) => POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position) || b.compositeRating - a.compositeRating).map((p) => {
    var _a;
    return `
      <div class="cut-row">
        <span class="pos-chip pos-${p.position}">${p.position}</span>
        <span class="cut-yr muted">SR${p.isWalkOn ? " WO" : ""}</span>
        <span class="cut-name"><span class="player-link" data-pcard="${p.id}">${escapeHtml(fullName(p))}</span>${twoDeep.has(p.id) ? ' <span style="color:var(--gold)">\u2605 starter</span>' : ""}</span>
        <span class="offseason-detail">${((_a = p.stats) == null ? void 0 : _a.games) || 0} games</span>
        <span class="rating-chip rating-${ratingColor(p.compositeRating)}">${Math.round(p.compositeRating)}</span>
      </div>`;
  }).join("")}` : "";
  return `
  <div class="offseason-item" style="margin-top:8px">
    <span class="offseason-label">After graduation</span>
    <span class="offseason-detail">${totalGrad} senior${totalGrad !== 1 ? "s" : ""} leaving${totalGradStarters ? ` \xB7 ${totalGradStarters} from the two-deep (\u2605)` : ""} \xB7 <b${holes.length ? ' style="color:var(--red)"' : ""}>${holes.length} position${holes.length !== 1 ? "s" : ""} below soft-min</b></span>
  </div>
  <p class="offseason-hint" style="margin:4px 0 8px">Each position shows your projected count after seniors graduate vs. its soft minimum. Holes to fill \u2014 whether from graduation or an unfilled spot \u2014 float to the top.</p>
  <div class="inline-roster-list">
    ${holesBlock}
    ${fineBlock}
    ${seniorList}
  </div>`;
}
function renderThisWeek(opp, school) {
  var _a, _b;
  if (!opp) return "";
  const og = opp.gameplan || {};
  const topForm = (Array.isArray(og.offFormations) && og.offFormations.length ? og.offFormations.slice().sort((a, b) => (b.weight || 0) - (a.weight || 0))[0].id : og.offFormation) || "Single Back";
  const passPct = Math.round(((_a = PASS_TENDENCY[og.tendency]) != null ? _a : 0.5) * 100);
  const threats = (opp.roster || []).filter((p) => ["QB", "RB", "WR", "TE"].includes(p.position)).sort((a, b) => b.compositeRating - a.compositeRating).slice(0, 2);
  const threatStr = threats.map((p) => `<span class="player-link" data-pcard="${p.id}">${escapeHtml(`${p.name.first[0]}. ${p.name.last}`)}</span> (${p.position} ${Math.round(p.compositeRating)})`).join(" and ");
  const bp = (_b = og.blitzPct) != null ? _b : 20;
  const pressure = bp >= 30 ? "blitz-happy \u2014 keep a back in to chip" : bp <= 12 ? "rarely blitzes \u2014 you'll have time to throw" : "balanced pressure";
  const memo = `They're a ${escapeHtml(topForm)} outfit \u2014 ${escapeHtml(og.tendency || "Balanced")} (${passPct}% pass).` + (threatStr ? ` It runs through ${threatStr}.` : "") + ` Their D: ${escapeHtml(og.defBaseFront || "4-3")} base, ${escapeHtml(pressure)}.`;
  const avgOf = (roster, poss) => {
    const list = (roster || []).filter((p) => poss.includes(p.position));
    return list.length ? list.reduce((s, p) => s + p.compositeRating, 0) / list.length : 50;
  };
  const keys = [];
  if (bp >= 30) keys.push("They bring heat \u2014 the Quick Game gets the ball out before it lands.");
  else if (bp <= 12) keys.push("They rush four and sit back \u2014 time to take shots downfield.");
  if (passPct >= 60) keys.push(`${passPct}% pass \u2014 extra DBs (Nickel/Dime) can live on the field.`);
  else if (passPct <= 40) keys.push(`${100 - passPct}% run \u2014 stack the box and make the QB beat you.`);
  if (avgOf(school == null ? void 0 : school.roster, ["WR", "TE"]) - avgOf(opp.roster, ["CB", "S"]) >= 5)
    keys.push("Their secondary can\u2019t hang with your receivers \u2014 Attack Deep is live.");
  if (avgOf(opp.roster, ["DE", "DT", "OLB", "LB"]) - avgOf(school == null ? void 0 : school.roster, ["OL"]) >= 5)
    keys.push("Their front seven outclasses your line \u2014 quick game and tempo keep the QB clean.");
  const ocw = og.conceptWeights || {};
  const topConcepts = Object.entries(ocw).filter(([, w]) => (w || 0) > 55).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n]) => n);
  if (topConcepts.length) keys.push(`Their call sheet leans ${topConcepts.join(", ")} \u2014 expect those beaters.`);
  const keysHtml = keys.slice(0, 4).map((k) => `<div class="tw-key">\u25B8 ${escapeHtml(k)}</div>`).join("");
  return `
  <div class="this-week">
    <div class="tw-title">THIS WEEK \u2014 SCOUTING REPORT</div>
    <div class="tw-memo">"${memo}" <span class="tw-memo-sig">\u2014 your staff's scout</span></div>
    ${keysHtml}
    <div class="tw-note muted">Set your plan at kickoff \u2014 the command center opens when you advance to game day, and every knob rides this game only.</div>
  </div>
`;
}
function schoolAvgRating(school) {
  var _a;
  if (!((_a = school == null ? void 0 : school.roster) == null ? void 0 : _a.length)) return 40;
  return school.roster.reduce((s, p) => s + p.compositeRating, 0) / school.roster.length;
}
function renderLastGameTeaser(school) {
  var _a;
  const r = state.ui.lastGameResult;
  const isHome = ((_a = r.homeSchool) == null ? void 0 : _a.id) === (school == null ? void 0 : school.id);
  const myScore = isHome ? r.homeScore : r.awayScore;
  const oppScore = isHome ? r.awayScore : r.homeScore;
  const opp = isHome ? r.awaySchool : r.homeSchool;
  const won = myScore > oppScore;
  let moment = null;
  try {
    moment = gameHighlight(r, r.homeSchool, r.awaySchool);
  } catch (e) {
    moment = null;
  }
  return `
  <div class="result-teaser-inner ${won ? "win" : "loss"}">
    <span class="result-badge">${won ? "W" : "L"}</span>
    <span class="result-score">${myScore} \u2013 ${oppScore}</span>
    <span class="result-opp">vs ${opp ? `<span class="team-link" data-scout-team="${opp.id}">${escapeHtml(opp.name)}</span>` : ""}</span>
    <span class="result-cta">View \u2192</span>
  </div>
  ${moment ? `
    <div class="result-moment${moment.side === "home" === isHome ? " ours" : " theirs"}">
      <span class="moment-when">Q${moment.q} ${moment.clock}</span>
      <span class="moment-text">${escapeHtml(moment.text)}</span>
    </div>` : ""}
`;
}
function renderBowlGameSnippet(game, school) {
  const schoolId = school == null ? void 0 : school.id;
  const isHome = game.homeId === schoolId;
  const oppId = isHome ? game.awayId : game.homeId;
  const opp = state.world.schools.find((s) => s.id === oppId);
  if (!game.result) {
    return `
    <div class="bowl-snippet">
      <div class="bowl-snippet-label">BOWL GAME</div>
      <div class="playoff-matchup-compact">
        <span class="pm-my">${escapeHtml((school == null ? void 0 : school.name) || "")}</span>
        <span class="pm-vs">${isHome ? "vs" : "@"}</span>
        <span class="pm-opp">${opp ? `<span class="team-link" data-scout-team="${opp.id}">${escapeHtml(opp.name)}</span>` : "TBD"}</span>
      </div>
    </div>`;
  }
  const myScore = isHome ? game.result.homeScore : game.result.awayScore;
  const oppScore = isHome ? game.result.awayScore : game.result.homeScore;
  const won = game.result.winner === schoolId;
  return `
  <div class="bowl-snippet">
    <div class="bowl-snippet-label">BOWL RESULT</div>
    <div class="playoff-hist-row ${won ? "hist-win" : "hist-loss"}">
      <span class="hist-badge">${won ? "W" : "L"}</span>
      <span class="hist-score">${myScore}\u2013${oppScore}</span>
      <span class="hist-opp">${opp ? `<span class="team-link" data-scout-team="${opp.id}">${escapeHtml(opp.name)}</span>` : "TBD"}</span>
    </div>
  </div>`;
}
function renderExpectationsBar(school, goals) {
  var _a;
  const coach = state.playerCoach;
  const games = C.CONF_GAMES + C.NONCONF_GAMES;
  const prestige = (school == null ? void 0 : school.prestige) || 3;
  const expWins = expectedWins(prestige, games, coach);
  const mandate = mandateText(prestige, games);
  const tier = prestige <= 2 ? { label: "BUILDING", note: "The boosters want progress and a competitive team. Patience \u2014 for now." } : prestige <= 4 ? { label: "EXPECTED TO WIN", note: "This program expects winning seasons and a run at the conference." } : { label: "CHAMPIONSHIP OR BUST", note: "Anything short of contention is a disappointment here." };
  const js = (_a = coach == null ? void 0 : coach.jobSecurity) != null ? _a : 50;
  const seat = seatState(js);
  const lastGrade = coach == null ? void 0 : coach.lastGrade;
  const seatLine = seat === "hot" ? "\u{1F525} HOT SEAT \u2014 the AD needs to see results this year." : seat === "warm" ? "\u26A0\uFE0F WARM SEAT \u2014 another down year and the questions start." : "\u2713 Secure \u2014 the job is yours to build on.";
  const seatCls = seat === "hot" ? "exp-seat-hot" : seat === "warm" ? "exp-seat-warm" : "exp-seat-safe";
  const lastLine = lastGrade ? `Last season graded <b>${lastGrade.letter}</b> (${lastGrade.wins}\u2013${lastGrade.losses}).` : "";
  const hist = ((coach == null ? void 0 : coach.gradeHistory) || []).slice(-5);
  const histChips = hist.length ? `<div class="exp-grade-hist">${hist.map((h) => `<span class="exp-grade-chip exp-grade-${h.score >= 0.82 ? "a" : h.score >= 0.62 ? "b" : h.score >= 0.42 ? "c" : "f"}" title="Season ${h.season}: ${h.letter}">${h.letter}</span>`).join("")}</div>` : "";
  return `
  <div class="expectations-bar">
    <div class="exp-header">
      <span class="exp-tier">${tier.label}</span>
      <span class="exp-mandate">${escapeHtml(mandate)}</span>
    </div>
    <div class="exp-note">${escapeHtml(tier.note)}</div>
    <div class="exp-seat ${seatCls}">${seatLine}${lastLine ? ` <span class="exp-last">${lastLine}</span>` : ""}</div>
    ${histChips}
    <div class="offseason-label" style="font-size:11px;letter-spacing:.5px;opacity:.7;margin-top:10px">THIS SEASON\u2019S GOALS</div>
    ${(goals || []).map((g) => `<div class="offseason-item"><span class="offseason-label">${escapeHtml(g.label)}</span></div>`).join("")}
    ${contractLine(coach)}
  </div>`;
}
// [PLAYTEST 2026-08-12 item 20] The deal is part of the expectations — you're
// told what they want AND how long you have to deliver it. Read-only: the AD
// writes the paper, and there is nothing to negotiate until it runs short.
function contractLine(coach) {
  var _a;
  const ct = coach == null ? void 0 : coach.contract;
  if (!ct) return "";
  const left = Math.max(0, ((_a = ct.endSeason) != null ? _a : state.season) - state.season);
  const label = escapeHtml(ct.termLabel || "Contract");
  return `
    <div class="offseason-label" style="font-size:11px;letter-spacing:.5px;opacity:.7;margin-top:10px">YOUR PAPER</div>
    <div class="offseason-item">
      <span class="offseason-label">${label} \u00B7 ${ct.years || left} year${(ct.years || left) !== 1 ? "s" : ""}</span>
      <span class="offseason-detail">${left > 0 ? `${left} season${left !== 1 ? "s" : ""} left${left === 1 ? " \u2014 the AD will want to talk in the offseason" : ""}` : "expiring \u2014 this is the year"}</span>
    </div>`;
}
function preseasonWeekBody(school, focusMeta) {
  var _a, _b;
  const pre = devCtx(state);
  const goals = ((_b = (_a = state.playerCoach) == null ? void 0 : _a.seasonGoals) == null ? void 0 : _b.season) === state.season ? state.playerCoach.seasonGoals.goals : buildSeasonGoals(state);
  const riv = state.rivalry;
  const rivGame = riv ? (state.schedule || []).find((g) => !g.result && [g.homeId, g.awayId].includes(school == null ? void 0 : school.id) && [g.homeId, g.awayId].includes(riv.schoolId)) : null;
  let body = "";
  if (focusMeta.id === "recruiting") {
    body = renderPreseasonRecruiting(school, pre);
  } else if (focusMeta.id === "spring") {
    body = renderPreseasonSpring(school, pre);
  } else if (focusMeta.id === "redshirts") {
    body = redshirtFinalizeBody(school);
  } else {
    body = renderExpectationsBar(school, goals);
  }
  return `
  ${body}
  ${riv && rivGame ? `<p class="offseason-hint" style="margin-top:6px">${escapeHtml(riv.trophy)} vs <span class="team-link" data-scout-team="${riv.schoolId}">${escapeHtml(riv.schoolName)}</span> \xB7 ${escapeHtml(weekLabel(rivGame.day))}</p>` : ""}`;
}
function attrGainChips(gains) {
  const entries = Object.entries(gains || {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return '<span class="attr-gain attr-gain-none">no attribute growth</span>';
  return entries.map(([k, v]) => `<span class="attr-gain${v < 0 ? " neg" : ""}">${k} ${v > 0 ? "+" : ""}${v}</span>`).join("");
}
function devReportList(report) {
  const shown = report.filter((r) => !campFilterPos || r.pos === campFilterPos).sort((a, b) => campSort === "pos" ? POSITIONS.indexOf(a.pos) - POSITIONS.indexOf(b.pos) || b.gain - a.gain : b.gain - a.gain);
  return `
  <div class="filter-chips" style="margin-top:6px">
    <button class="filter-chip${!campFilterPos ? " active" : ""}" data-camp-filter="">ALL POS</button>
    ${POSITIONS.map((p) => `<button class="filter-chip${campFilterPos === p ? " active" : ""}" data-camp-filter="${p}">${p}</button>`).join("")}
  </div>
  <div class="filter-chips" style="margin-top:4px;align-items:center">
    <span class="offseason-label" style="font-size:10px;letter-spacing:.5px;opacity:.7;margin-right:2px">SORT:</span>
    <button class="filter-chip${campSort === "gain" ? " active" : ""}" data-camp-sort="gain">BY GAIN</button>
    <button class="filter-chip${campSort === "pos" ? " active" : ""}" data-camp-sort="pos">BY POSITION</button>
  </div>
  <div class="inline-roster-list">
    ${shown.map(devReportRow).join("") || '<div class="empty-state">No players match the filter.</div>'}
  </div>`;
}
function devReportRow(r) {
  return `
  <div class="cut-row" style="flex-wrap:wrap">
    <span class="pos-chip pos-${r.pos}">${r.pos}</span>
    <span class="cut-yr muted">${r.classYear}</span>
    <span class="cut-name">${r.id ? `<span class="player-link" data-pcard="${r.id}">${escapeHtml(r.name)}</span>` : escapeHtml(r.name)}</span>
    <span class="offseason-detail">${r.before} \u2192 <b>${r.after}</b></span>
    <span style="min-width:36px;text-align:right;font-weight:700;color:${r.gain >= 0 ? "var(--green)" : "var(--red)"}">${r.gain >= 0 ? "+" : ""}${r.gain}</span>
    <div class="attr-gain-row">${attrGainChips(r.attrGains)}</div>
  </div>`;
}
function renderPreseasonRecruiting(school, pre) {
  const coach = state.playerCoach;
  const assistOn = recruitAssistLevel(state) !== "off";
  const boardCount = ((coach == null ? void 0 : coach.recruitBoard) || []).filter((e) => e && !e.committed && !e.eliminated).length;
  return `
  <div class="offseason-item" style="margin-top:8px">
    <span class="offseason-label">Recruiting is open</span>
    <span class="offseason-detail">${assistOn ? "Staff assist: ON" : boardCount > 0 ? `${boardCount} on your board` : "Board is empty"}</span>
  </div>
  <p class="offseason-hint" style="margin-top:6px">This is where next season's roster is won. Scout prospects and make offers yourself on the <b>Search</b> board, or hand the legwork to your staff under <b>Assist</b> and set the strategy \u2014 either way, the class you build now is the program you coach later. You can come back to it on any recruiting week.</p>
  <button class="btn-primary" id="btn-goto-recruiting" style="margin-top:12px;width:100%">Open Recruiting \u2192</button>`;
}
function conversionPreviewPanel() {
  var _a, _b;
  const pend = (_a = state.ui) == null ? void 0 : _a.convPending;
  if (!pend) return "";
  const school = state.world.schools.find((s) => s.id === state.playerSchoolId);
  const p = school == null ? void 0 : school.roster.find((x) => x.id === pend.playerId);
  if (!p) return "";
  const prev = previewConversion(state, pend.playerId, pend.to);
  if (!prev) return "";
  const diff = prev.projected - prev.current;
  const penaltyPct = Math.round(conversionPenaltyFactor(state) * 100);
  const nm = `${((_b = p.name) == null ? void 0 : _b.first) || ""} ${p.name && p.name.last || ""}`.trim();
  return `
  <div class="conv-preview">
    <div class="conv-preview-head">Confirm position change</div>
    <div class="conv-preview-body">
      <div class="conv-preview-name"><span class="player-link" data-pcard="${p.id}">${escapeHtml(nm)}</span></div>
      <div class="conv-preview-move">
        <span class="pos-chip pos-${prev.from}">${prev.from}</span>
        <span class="conv-preview-arrow">\u2192</span>
        <span class="pos-chip pos-${pend.to}">${pend.to}</span>
      </div>
      <div class="conv-preview-rating">
        <span class="rating-chip rating-${ratingColor(prev.current)}">${prev.current}</span>
        <span class="conv-preview-arrow">\u2192</span>
        <span class="rating-chip rating-${ratingColor(prev.projected)}">${prev.projected}</span>
        <span class="conv-preview-delta" style="color:${diff >= 0 ? "var(--green)" : "var(--red)"}">${diff >= 0 ? "+" : ""}${diff}</span>
      </div>
    </div>
    <p class="offseason-hint" style="margin:6px 0 8px">Takes a \u2212${penaltyPct}% haircut at ${pend.to} for this season only (clears at rollover). ${pend.anytime ? "This converts immediately." : "Locks in when camp runs."}</p>
    <div class="conv-preview-actions">
      <button class="btn-ghost btn-sm" id="conv-cancel">Cancel</button>
      <button class="btn-primary btn-sm" id="conv-confirm">Confirm change</button>
    </div>
  </div>`;
}
function positionChangeBoard(school, pre) {
  var _a, _b;
  const changes = pre.posChanges || [];
  const capLeft = C.POS_CHANGE_CAP - changes.filter((c) => !c.anytime).length;
  const penaltyPct = Math.round(conversionPenaltyFactor(state) * 100);
  const rows = ((school == null ? void 0 : school.roster) || []).filter((p) => !convFilterPos || p.position === convFilterPos);
  const projMap = /* @__PURE__ */ new Map();
  if (convTarget) {
    for (const p of rows) {
      projMap.set(p.id, p.position === convTarget ? null : (_b = (_a = previewConversion(state, p.id, convTarget)) == null ? void 0 : _a.projected) != null ? _b : null);
    }
  }
  const posIdx = (p) => POSITIONS.indexOf(p.position);
  const sorted = [...rows].sort((a, b) => {
    var _a2, _b2, _c, _d;
    if (convSort === "ovr") return b.compositeRating - a.compositeRating;
    if (convSort === "proj" && convTarget) return ((_a2 = projMap.get(b.id)) != null ? _a2 : -1) - ((_b2 = projMap.get(a.id)) != null ? _b2 : -1);
    if (ATTRIBUTES.includes(convSort)) return (((_c = b.attributes) == null ? void 0 : _c[convSort]) || 0) - (((_d = a.attributes) == null ? void 0 : _d[convSort]) || 0);
    return posIdx(a) - posIdx(b) || b.compositeRating - a.compositeRating;
  });
  const attrCell = (v) => {
    const c = v >= 75 ? "var(--green)" : v >= 60 ? "var(--gold)" : v <= 40 ? "var(--text-2)" : "var(--text-1)";
    return `<td style="color:${c};font-variant-numeric:tabular-nums">${v != null ? v : "\u2014"}</td>`;
  };
  const th = (key, label) => `
  <th class="conv-sort${convSort === key ? " active" : ""}" data-conv-sort="${key}" title="Sort">${label}${convSort === key ? " \u25BE" : ""}</th>`;
  const bodyRows = sorted.map((p) => {
    const proj = projMap.get(p.id);
    const diff = proj != null ? proj - Math.round(p.compositeRating) : null;
    return `
    <tr>
      <td><span class="pos-chip pos-${p.position}">${p.position}</span></td>
      <td class="muted">${p.classYear}${p.isWalkOn ? ' <span style="opacity:.6">WO</span>' : ""}</td>
      <td style="white-space:nowrap"><span class="player-link" data-pcard="${p.id}">${escapeHtml(fullName(p))}</span>${p.redshirted && p.redshirtYear === state.season ? ' <span style="color:var(--red);font-size:9px">RS</span>' : ""}</td>
      <td><span class="rating-chip rating-${ratingColor(p.compositeRating)}">${Math.round(p.compositeRating)}</span></td>
      ${ATTRIBUTES.map((a) => {
      var _a2;
      return attrCell((_a2 = p.attributes) == null ? void 0 : _a2[a]);
    }).join("")}
      ${convTarget ? `
        <td style="font-weight:700;font-variant-numeric:tabular-nums">
          ${proj == null ? '<span class="muted">\u2014</span>' : `${proj} <span style="color:${diff >= 0 ? "var(--green)" : "var(--red)"};font-size:10px">${diff >= 0 ? "+" : ""}${diff}</span>`}
        </td>
        <td class="table-action-cell">${p.position === convTarget ? "" : `<button class="btn-ghost btn-sm conv-row-btn" data-player-id="${p.id}" ${capLeft <= 0 ? "disabled" : ""}>Convert</button>`}
        </td>` : ""}
    </tr>`;
  }).join("");
  return `
  ${changes.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">
    ${changes.map((ch) => `<span class="dash-qs-item">${ch.from} \u2192 ${ch.to} \u2713</span>`).join("")}
  </div>` : ""}
  <p class="offseason-hint" style="margin:6px 0 8px">A converted player takes a \u2212${penaltyPct}% haircut for THIS season only (your Developer skill shrinks it) \u2014 it clears at rollover. Conversions lock when camp runs.</p>
  ${conversionPreviewPanel()}

  <div class="filter-chips">
    <button class="filter-chip${!convFilterPos ? " active" : ""}" data-conv-filter="">ALL POS</button>
    ${POSITIONS.map((p) => `<button class="filter-chip${convFilterPos === p ? " active" : ""}" data-conv-filter="${p}">${p}</button>`).join("")}
  </div>
  <div class="filter-chips" style="margin-top:4px;align-items:center">
    <span class="offseason-label" style="font-size:10px;letter-spacing:.5px;opacity:.7;margin-right:2px">CONVERT&nbsp;TO:</span>
    <button class="filter-chip${!convTarget ? " active" : ""}" data-conv-target="">\u2014</button>
    ${POSITIONS.map((p) => `<button class="filter-chip${convTarget === p ? " active" : ""}" data-conv-target="${p}">${p}</button>`).join("")}
  </div>

  <div class="conv-board-wrap">
    <div class="table-scroll"><table class="data-table compact conv-board">
      <thead>
        <tr>
          ${th("", "POS")}
          <th>YR</th>
          <th>NAME</th>
          ${th("ovr", "OVR")}
          ${ATTRIBUTES.map((a) => th(a, attrLabel(a))).join("")}
          ${convTarget ? `${th("proj", `AT ${convTarget}`)}<th></th>` : ""}
        </tr>
      </thead>
      <tbody>${bodyRows || `<tr><td colspan="20" class="empty-state">No players match the filter.</td></tr>`}</tbody>
    </table></div>
  </div>
  ${convTarget ? "" : `<p class="offseason-hint" style="margin-top:4px">Pick a CONVERT TO position to see every player's projected rating there.</p>`}`;
}
function renderPreseasonSpring(school, pre) {
  const sr = pre.springResult;
  if (!sr) {
    const focus = pre.devFocus || "balanced";
    const focusBtns = FOCUS_GROUPS.map((f) => `
    <button class="btn-ghost btn-sm focus-btn" data-focus="${f.id}"
      style="margin:3px 3px 0 0;${focus === f.id ? "border-color:var(--green);color:var(--green)" : ""}">
      ${escapeHtml(f.label)}${focus === f.id ? " \u2713" : ""}
    </button>`).join("");
    const changes = pre.posChanges || [];
    // [PLAYTEST 2026-08-12 item 12] Position changes come FIRST and open by
    // default now, and camp will not run until they are confirmed — they lock the
    // moment it does, and this used to be a collapsed accordion below the button
    // that opens it.
    const reviewed = !!pre.posReviewed;
    const boardOpen = convBoardOpen || !reviewed;
    // [PLAYTEST 2026-08-12, owner] Camp week INHERITS the staff's pitch list. The
    // recommendations were computed once for cut day and then thrown away, so the
    // last screen before camp locks conversions — the one where the decision
    // actually matters — showed a bare table with no guidance. Recomputed against
    // the CURRENT roster, so anything already moved drops off the list by itself.
    const campRecs = (() => {
      try {
        return cutDayConversionRecs(state) || [];
      } catch (e) {
        return [];
      }
    })();
    const campCapLeft = C.POS_CHANGE_CAP - ((pre.posChanges || []).filter((c) => !c.anytime).length);
    return `
    ${campRecs.length ? `
    <div class="offseason-item" style="margin-top:8px">
      <span class="offseason-label">Staff recommendation${campRecs.length !== 1 ? "s" : ""}</span>
      <span class="offseason-detail">${campRecs.length} move${campRecs.length !== 1 ? "s" : ""} still on the table \u00b7 <b>${campCapLeft}</b> of ${C.POS_CHANGE_CAP} camp conversions left</span>
    </div>
    <p class="offseason-hint" style="margin:4px 0 8px">Your staff still likes these. Camp locks position changes for the year, so this is the last time anyone can move.</p>
    ${conversionPreviewPanel()}
    ${conversionRecRows(campRecs, campCapLeft)}` : ""}
    <div class="offseason-item" style="margin-top:${campRecs.length ? "16" : "8"}px">
      <span class="offseason-label">Position changes
        <span class="muted" style="font-weight:400">\xB7 ${changes.length}/${C.POS_CHANGE_CAP}</span></span>
      <span class="offseason-detail" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        ${changes.map((ch) => `<span class="dash-qs-item">${ch.from} \u2192 ${ch.to} \u2713</span>`).join("")}
        <button class="btn-ghost btn-sm" id="btn-conv-toggle">${boardOpen ? "Close board" : "Open board"}</button>
      </span>
    </div>
    ${boardOpen ? `<p class="offseason-hint" style="margin:2px 0 0">Move a player to a new position \u2014 pick a target position to see everyone's projected rating there, conversion penalty included. This is the last window: camp locks them for the year.</p>
         ${positionChangeBoard(school, pre)}` : ""}
    ${reviewed ? `<p class="offseason-hint" style="margin-top:10px;color:var(--green)">Positions confirmed \u2713 \u2014 you can still change your mind until camp runs.</p>` : `<button class="btn-primary" id="btn-pos-confirm" style="margin-top:12px;width:100%">${changes.length ? `Lock in ${changes.length} position change${changes.length !== 1 ? "s" : ""} \u2014 positions are set` : "No changes \u2014 my positions are set"}</button>`}

    <div class="offseason-label" style="font-size:11px;letter-spacing:.5px;opacity:.7;margin-top:18px">TRAINING FOCUS</div>
    <div>${focusBtns}</div>
    <button class="btn-primary" id="btn-spring-play" style="margin-top:14px;width:100%"${reviewed ? "" : " disabled"}>Run Spring Game</button>
    <p class="offseason-hint" style="margin-top:6px">${reviewed ? "" : "Confirm your positions first. "}Development camp works the whole roster (freshmen too), then White vs Black runs on post-camp ratings \u2014 full box score, nothing counts, everyone banks reps. Skipping ahead runs it automatically.</p>`;
  }
  const rows = (list) => list.map((x) => `<div class="offseason-item"><span class="offseason-label">${escapeHtml(x.name)} (${x.pos})</span><span class="offseason-detail">${escapeHtml(x.line)}</span></div>`).join("");
  const report = pre.campReport || [];
  return `
  <div class="offseason-item" style="margin-top:8px">
    <span class="offseason-label">${escapeHtml(sr.nameA)} ${sr.scoreA} \u2014 ${sr.scoreB} ${escapeHtml(sr.nameB)}</span>
    <span class="offseason-detail" style="color:var(--green)">game reps banked \u2713</span>
  </div>
  ${sr.topOff.length ? `<div class="offseason-label" style="font-size:11px;opacity:.7;margin-top:8px">OFFENSE</div>${rows(sr.topOff)}` : ""}
  ${sr.topDef.length ? `<div class="offseason-label" style="font-size:11px;opacity:.7;margin-top:8px">DEFENSE</div>${rows(sr.topDef)}` : ""}
  ${sr.breakouts.length ? `<div class="offseason-label" style="font-size:11px;opacity:.7;margin-top:8px">CAMP BREAKOUTS</div>${sr.breakouts.map((b) => `
    <div class="offseason-item" style="flex-wrap:wrap">
      <span class="offseason-label">${escapeHtml(b.name)} (${b.pos})</span>
      <span class="offseason-detail" style="color:var(--green)">+${b.gain}</span>
      ${b.attrGains ? `<div class="attr-gain-row">${attrGainChips(b.attrGains)}</div>` : ""}
    </div>`).join("")}` : ""}
  ${report.length ? `
    <div class="offseason-item" style="margin-top:12px">
      <span class="offseason-label">Preseason Development \u2014 entire roster</span>
      <span class="offseason-detail">${report.length} players \xB7 team avg ${pre.campAvgGain >= 0 ? "+" : ""}${pre.campAvgGain} \xB7 freshmen included</span>
    </div>
    ${devReportList(report)}` : ""}`;
}
function renderRedshirtRow(p, checked, recommended = false) {
  return `
  <label class="redshirt-row${checked ? " redshirt-selected" : ""}">
    <input type="checkbox" class="redshirt-check" data-player-id="${p.id}"
           ${checked ? "checked" : ""}>
    <span class="redshirt-name"><span class="player-link" data-pcard="${p.id}">${escapeHtml(fullName(p))}</span> <span style="opacity:.55;font-size:11px">${p.classYear}</span>${recommended ? ' <span style="color:var(--green);font-size:10px;letter-spacing:.4px">REC</span>' : ""}</span>
    <span class="redshirt-rating">${Math.round(p.compositeRating)}</span>
  </label>
`;
}
function jobMarketBody() {
  const offers = state.pendingOffers || [];
  const openings = getJobOpenings(state);
  const appsLeft = applicationsLeft(state);
  const offeredIds = new Set(offers.map((o) => o.schoolId));
  const rank = (j) => j.status === "offered" ? 0 : j.status === "open" ? 1 : 2;
  const board = [...openings].sort((a, b) => rank(a) - rank(b) || Math.round(b.prestige) - Math.round(a.prestige));
  const reasonTag = (r) => r ? `<span class="jm-reason">seat ${r === "fired" ? "opened \u2014 firing" : r === "lapsed" ? "opened \u2014 contract" : r === "retired" ? "opened \u2014 retirement" : r === "poached" ? "opened \u2014 coach left" : "open"}</span>` : "";
  const openingRow = (j) => {
    const { label } = applicationOdds(state, j);
    const oddsColor = label === "Strong Candidate" ? "var(--green)" : label === "Competitive" ? "var(--gold, #d4a017)" : "var(--red, #c0392b)";
    const courting = offeredIds.has(j.schoolId) || j.status === "offered";
    const right = courting ? '<span class="jm-status jm-courting">Courting you \u2713</span>' : j.status === "rejected" ? '<span class="jm-status jm-passed">Passed on you</span>' : `<button class="btn-ghost btn-sm job-apply-btn" data-apply-school="${j.schoolId}" ${appsLeft <= 0 ? "disabled" : ""}>Apply</button>`;
    return `
    <div class="offseason-item jm-row${courting ? " jm-row-courting" : ""}" style="align-items:center">
      <span class="offseason-label"><span class="team-link" data-scout-team="${j.schoolId}">${escapeHtml(j.schoolName)}</span> ${reasonTag(j._reason || j.reason)}</span>
      <span class="offseason-detail">${j.division} \xB7 ${Math.round(j.prestige)}\u2605 \xB7 <span style="color:${oddsColor}">${courting ? "Wants you" : label}</span></span>
      ${right}
    </div>`;
  };
  const courtingCount = board.filter((j) => offeredIds.has(j.schoolId) || j.status === "offered").length;
  return `
  <p class="offseason-hint" style="margin-bottom:8px">Every job that opened this cycle. Tap a school to scout its roster. Apply to the ones you want \u2014 winning schools join your suitors, and you sign at Contract &amp; Signing Day.</p>
  <div class="jm-summary">
    <div><span class="jm-num">${board.length}</span> open job${board.length !== 1 ? "s" : ""}</div>
    <div><span class="jm-num">${courtingCount}</span> courting you</div>
    <div><span class="jm-num">${appsLeft}</span> application${appsLeft !== 1 ? "s" : ""} left</div>
  </div>
  <div class="award-group-label" style="margin-top:10px">THE BOARD</div>
  ${board.length ? board.map(openingRow).join("") : '<div class="offseason-item"><span class="offseason-detail">No seats opened this cycle. Quiet carousel.</span></div>'}`;
}
function contractBody() {
  var _a, _b, _c, _d;
  const coach = state.playerCoach;
  const ext = getExtensionOffer(state);
  const taken = (_b = (_a = state.offseason) == null ? void 0 : _a.data) == null ? void 0 : _b.extensionTaken;
  const yearsLeft = (coach == null ? void 0 : coach.contract) ? Math.max(0, coach.contract.endSeason - state.season) : 0;
  const offers = state.pendingOffers || [];
  return `
        <div class="award-group-label">YOUR DEAL</div>
        <div class="offseason-item">
          <span class="offseason-label">${(coach == null ? void 0 : coach.contract) ? `${yearsLeft} year${yearsLeft !== 1 ? "s" : ""} remaining` : "No active contract"}</span>
          <span class="offseason-detail">${(coach == null ? void 0 : coach.contract) ? coach.contract.recruitBonus ? `$${coach.contract.recruitBonus.toLocaleString()} per recruit signed (legacy terms)` : `loyalty raises: +${Math.min(100, (coach.retentionStacks || 0) * 10)}% of base on the pool` : ""}</span>
        </div>
        <div class="offseason-item">
          <span class="offseason-label">Seat</span>
          <span class="offseason-detail">${(_c = coach == null ? void 0 : coach.jobSecurity) != null ? _c : "\u2014"}/100 job security \xB7 career ${(coach == null ? void 0 : coach.careerWins) || 0}\u2013${(coach == null ? void 0 : coach.careerLosses) || 0}</span>
        </div>

        <div class="award-group-label" style="margin-top:10px">STAY \u2014 ${escapeHtml(((_d = getPlayerSchool()) == null ? void 0 : _d.name) || "YOUR SCHOOL")}</div>
        ${ext && !taken ? `
          <div class="offseason-item">
            <span class="offseason-label">Re-up on the table</span>
            <span class="offseason-detail">${ext.ladder && !ext.ladder.capped ? `<b>+10% of base</b> loyalty raise (+$${(ext.ladder.bump || 0).toLocaleString()} on every future pool) — total +${ext.ladder.nextPct}% after signing` : `<b>ladder capped</b> — double money already; signing keeps the paper fresh`}</span>
          </div>
          <div class="ext-terms">
            ${(ext.terms || []).slice(0, 1).map((t) => `
              <div class="ext-term-card ext-term-offered">
                <div class="ext-term-title">${escapeHtml(t.label)} \xB7 ${t.years} year${t.years !== 1 ? "s" : ""}</div>
                <div class="ext-term-money">+10%<span class="muted"> of base</span></div>
                <div class="ext-term-js ${t.jsDelta >= 0 ? "ext-js-up" : "ext-js-down"}">${t.jsDelta >= 0 ? "+" : ""}${t.jsDelta} security</div>
                <div class="ext-term-blurb muted">${escapeHtml(t.blurb || "")}</div>
              </div>`).join("")}
          </div>
          <p class="offseason-hint" style="margin:6px 0 0">The AD sets the length. What you've done here is the argument.</p>
          <button class="btn-primary" data-ext-term="ad" style="margin-top:8px;width:100%">Sign it</button>` : taken ? '<div class="offseason-item"><span class="offseason-detail" style="color:var(--green)">Extension signed \u2014 you\u2019re staying \u2713</span></div>' : '<div class="offseason-item"><span class="offseason-detail">No new deal on the table \u2014 the AD wants results first.</span></div>'}

        <div class="award-group-label" style="margin-top:10px">SUITORS ${offers.length ? `<span class="muted">(${offers.length})</span>` : ""}</div>
        ${offers.length ? `
          ${offers.map((of) => `
            <div class="offseason-item" style="align-items:center">
              <span class="offseason-label"><span class="team-link" data-scout-team="${of.schoolId}">${escapeHtml(of.schoolName)}</span></span>
              <span class="offseason-detail">${of.division} \xB7 ${Math.round(of.prestige)}\u2605${of.reason ? ` \xB7 <span style="opacity:.7">seat ${of.reason === "fired" ? "opened (firing)" : of.reason === "lapsed" ? "opened (contract)" : of.reason === "retired" ? "opened (retirement)" : of.reason === "poached" ? "opened (coach left)" : "opened"}</span>` : ""}</span>
              <button class="btn-ghost btn-sm offer-accept-btn" data-offer-school="${of.schoolId}">Sign here</button>
            </div>`).join("")}
          <button class="btn-ghost" id="btn-decline-offers" style="margin-top:6px;width:100%">Turn them all down \u2014 and let your AD know</button>` : '<div class="offseason-item"><span class="offseason-detail">No suitors this cycle. Apply on the Carousel screen to draw interest.</span></div>'}
  <p class="offseason-hint" style="margin-top:8px">Signing with a suitor moves you there next season. Staying keeps your roster and recruiting momentum.</p>`;
}
function walkonBody() {
  var _a;
  const pool = getWalkOnPool(state);
  const schol = ((_a = state.playerCoach) == null ? void 0 : _a.scholarshipsAvailable) || 0;
  const topAttrs = (wo) => Object.entries(wo.attributes || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(" \xB7 ");
  const rows = pool.map((entry, i) => {
    var _a2, _b, _c;
    const wo = entry.wo;
    const name = escapeHtml(`${((_a2 = wo.name) == null ? void 0 : _a2.first) || ""} ${((_b = wo.name) == null ? void 0 : _b.last) || ""}`.trim());
    const home = ((_c = wo.hometown) == null ? void 0 : _c.city) ? `${escapeHtml(wo.hometown.city)}, ${escapeHtml(wo.hometown.state || "")}` : "Local";
    return `
    <div class="offseason-item" style="align-items:center">
      <span class="offseason-label"><span class="pos-chip pos-${wo.position}">${wo.position}</span> ${name} <b>${Math.round(wo.compositeRating)}</b></span>
      <span class="offseason-detail">${topAttrs(wo)} \xB7 GPA ${wo.gpa} \xB7 ${home}</span>
      ${entry.accepted ? '<span class="offseason-detail" style="color:var(--green)">On the team \u2713</span>' : `<button class="btn-ghost btn-sm walkon-accept-btn" data-walkon-idx="${i}" ${schol <= 0 ? "disabled" : ""}>Accept</button>`}
    </div>`;
  }).join("");
  return `
  <div class="redshirt-count">${pool.length} candidates \xB7 ${schol} scholarship${schol !== 1 ? "s" : ""} open \u2014 pick your favorites, not everyone</div>
  <div class="redshirt-list">${rows}</div>
  <p class="offseason-hint" style="margin-top:6px">Full ratings, nothing hidden \u2014 walk-ons are what they are. No upside band.</p>`;
}
var _stageCandidates = { side: null, list: [] };
function staffStageBody(school) {
  var _a, _b, _c, _d;
  if (!school) return "";
  const SHORT = {
    qbRunDesign: "QB Run",
    passGame: "Pass",
    runGame: "Run",
    blitzDesign: "Blitz Dsn",
    coverage: "Coverage",
    runFits: "Run Fits"
  };
  const row = (coord, side2) => {
    if (!coord) return `<div class="staff-row"><span class="muted">No ${side2} on staff</span>
    <button class="btn-ghost btn-sm" data-stage-hire="${side2}">Hire</button></div>`;
    ensureAmbition(coord);
    // [DNA TREE §5b.3] The identity card: formation sheet as stars, specialty
    // highlighted, age, ambition, lineage. The sim still reads raw IQ.
    const sheet = Object.entries(coord.schemeIQ || {}).sort((a, b) => b[1] - a[1]).map(([s, iq]) => {
      const t = schemeStarTier(iq);
      const star = t ? "\u2605\u2605\u2605\u2605".slice(0, Math.min(3, t)) + (t >= 4 ? "\u{1F48E}" : "") : "\u2013";
      return `<span class="${s === coord.specialty ? "staff-hi" : ""}">${escapeHtml(s)} ${t >= 4 ? "\u{1F48E}" : star} ${iq}</span>`;
    }).join(" \xB7 ");
    const promised = !!coord.promisedSuccession;
    return `
    <div class="staff-row">
      <div class="staff-info">
        <div class="staff-name">${side2} ${escapeHtml(coord.name.first)} ${escapeHtml(coord.name.last)}
          <span class="muted" style="font-weight:400">\xB7 ${coord.age != null ? `${coord.age} yrs` : ""} \xB7 ${escapeHtml(coord.ambition || "")} \xB7 $${(coord.salary || 0).toLocaleString()}/yr</span>
          ${promised ? '<span class="staff-hi" style="font-size:11px"> \xB7 PROMISED THE SEAT</span>' : ""}</div>
        <div class="staff-ratings muted">${Object.entries(coord.ratings).map(([k, v]) => `${SHORT[k] || k} <b class="${v >= 70 ? "staff-hi" : v <= 35 ? "staff-lo" : ""}">${v}</b>`).join(" \xB7 ")}</div>
        <div class="staff-schemes muted">${sheet}</div>
        ${coord.mentorName ? `<div class="staff-schemes muted">Shaped under ${escapeHtml(coord.mentorName)}</div>` : ""}
      </div>
      <div class="staff-actions">
        <button class="btn-ghost btn-sm" data-stage-hire="${side2}">Replace</button>
        ${!promised && coord.ambition === "Climber" ? `<button class="btn-ghost btn-sm" data-stage-promise="${side2}">Promise the seat</button>` : ""}
      </div>
    </div>`;
  };
  const side = (_b = (_a = state.offseason) == null ? void 0 : _a.data) == null ? void 0 : _b.staffMarketSide;
  let market = "";
  if (side) {
    if (_stageCandidates.side !== side || !_stageCandidates.list.length) {
      _stageCandidates = { side, list: generateCandidates(side, school, 5) };
    }
    market = `
    <div class="staff-market">
      <div class="staff-market-head">CANDIDATES \u2014 ${side} <button class="btn-ghost btn-sm" data-stage-hire-close="1">Close</button></div>
      ${_stageCandidates.list.map((c, i) => {
      ensureAmbition(c);
      // [Owner request Aug 2026] The full dossier at hire: EVERY formation
      // grade (star + raw IQ, specialty called out) and all his ratings —
      // you hire the whole sheet, not a top-3 teaser.
      const sheet = Object.entries(c.schemeIQ || {}).sort((a, b) => b[1] - a[1]).map(([s, iq]) => {
        const t = schemeStarTier(iq);
        return `<span class="${s === c.specialty ? "staff-hi" : ""}">${escapeHtml(s)} ${t >= 4 ? "\u{1F48E}" : t ? "\u2605\u2605\u2605".slice(0, t) : "\u2013"} ${iq}</span>`;
      }).join(" \xB7 ");
      return `
        <div class="staff-row">
          <div class="staff-info">
            <div class="staff-name">${escapeHtml(c.name.first)} ${escapeHtml(c.name.last)}
              <span class="muted" style="font-weight:400">\xB7 ${c.age != null ? `${c.age} yrs` : ""} \xB7 ${escapeHtml(c.ambition || "")} \xB7 $${c.salary.toLocaleString()}/yr</span></div>
            <div class="staff-schemes muted">${escapeHtml(deriveSchemeIdentity(c.side, c.ratings))} \xB7 Specialty: <span class="staff-hi">${escapeHtml(c.specialty || "\u2013")}</span></div>
            <div class="staff-ratings muted">${Object.entries(c.ratings).map(([k, v]) => `${SHORT[k] || k} <b class="${v >= 70 ? "staff-hi" : v <= 35 ? "staff-lo" : ""}">${v}</b>`).join(" \xB7 ")}</div>
            <div class="staff-schemes muted">${sheet}</div>
          </div>
          <button class="btn-primary btn-sm" data-stage-hire-pick="${i}">Hire</button>
        </div>`;
    }).join("")}
    </div>`;
  }
  const poach = state.pendingPoach;
  const poachBanner = poach ? `
  <div class="poach-banner">
    <div class="poach-text">\u{1F6A8} <b>${escapeHtml(poach.suitorName)}</b> is offering your ${poach.side} <b>${escapeHtml(poach.coordName)}</b> a job.
      Pay a retention of <b>$${(poach.retentionCost || 0).toLocaleString()}</b>${poach.priorRetentions ? ` <i>(ask #${poach.priorRetentions + 1} \u2014 his agent remembers, the price has doubled)</i>` : ""} \u2014 off NEXT season's recruiting budget \u2014 or lose him.</div>
    <div class="poach-actions">
      <button class="btn-primary btn-sm" data-poach="retain">Pay the retention</button>
      <button class="btn-ghost btn-sm" data-poach="walk">Let him walk</button>
    </div>
  </div>` : "";
  return `
  <div class="offseason-body">
    ${poachBanner}
    ${row((_c = school.staff) == null ? void 0 : _c.oc, "OC")}
    ${row((_d = school.staff) == null ? void 0 : _d.dc, "DC")}
    ${market}
    <p class="offseason-hint">New hires open the playbook at Development Camp week 1. Their salary hits this season's pool \u2014 check the ledger before you stretch.</p>
  </div>`;
}
function setupListeners6() {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p;
  document.querySelectorAll("[data-poach]").forEach((btn) => {
    btn.addEventListener("click", () => {
      var _a2;
      const poach = state.pendingPoach;
      const school = getPlayerSchool();
      if (!poach || !school) return;
      const side = poach.side.toLowerCase();
      if (btn.dataset.poach === "retain") {
        const c = (_a2 = school.staff) == null ? void 0 : _a2[side];
        if (c && state.playerCoach) {
          state.playerCoach.pendingRetentionCost = (state.playerCoach.pendingRetentionCost || 0) + (poach.retentionCost || 0);
          // [Owner ruling Aug 2026] His agent keeps score — the next suitor's
          // retention costs double.
          c.retentionCount = (c.retentionCount || 0) + 1;
          notify(`${poach.coordName} stays. $${(poach.retentionCost || 0).toLocaleString()} comes off next season's recruiting budget${c.retentionCount > 1 ? ` \u2014 that's retention #${c.retentionCount}, and the next one doubles again` : " \u2014 and if the phone rings again, the price doubles"}.`, "success");
        }
      } else {
        if (school.staff) school.staff[side] = null;
        // An open chair is a hire you owe, not a slot that quietly stays empty.
        state.pendingCoordHire = { schoolId: school == null ? void 0 : school.id, side, reason: "poached" };
        notify(`${poach.coordName} left for ${poach.suitorName}. The ${poach.side} job is open \u2014 fill it before camp.`, "warning");
      }
      state.pendingPoach = null;
      rerender();
    });
  });
  document.querySelectorAll("[data-stage-promise]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const r = makeSuccessionPromise(state, btn.dataset.stagePromise);
      if (r.ok) notify(`Your word is given: ${r.coordName} will have the seat. $${r.cost.toLocaleString()} off next season's budget.`, "success");
      else notify(r.reason || "Can't make that promise.", "error");
      rerender();
    });
  });
  document.querySelectorAll("[data-stage-hire]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!state.offseason.data) state.offseason.data = {};
      state.offseason.data.staffMarketSide = btn.dataset.stageHire;
      _stageCandidates = { side: null, list: [] };
      rerender();
    });
  });
  (_a = document.querySelector("[data-stage-hire-close]")) == null ? void 0 : _a.addEventListener("click", () => {
    state.offseason.data.staffMarketSide = null;
    rerender();
  });
  document.querySelectorAll("[data-stage-hire-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      var _a2, _b2;
      const school = getPlayerSchool();
      const side = (_b2 = (_a2 = state.offseason) == null ? void 0 : _a2.data) == null ? void 0 : _b2.staffMarketSide;
      const pick2 = _stageCandidates.list[parseInt(btn.dataset.stageHirePick, 10)];
      if (!school || !pick2 || !side) return;
      if (!school.staff) school.staff = {};
      school.staff[side.toLowerCase()] = pick2;
      if (state.pendingCoordHire && school.staff.oc && school.staff.dc) state.pendingCoordHire = null;
      state.offseason.data.staffMarketSide = null;
      notify(`${pick2.name.first} ${pick2.name.last} hired as ${side} \u2014 opens the playbook at Dev Camp`, "success");
      rerender();
    });
  });
  if (state.offseason && !state.offseason.done) setupListeners4();
  document.querySelectorAll("[data-portal-pitch]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const r = playerPitch(state, btn.dataset.portalPitch);
      if (!r.ok) notify(r.reason || "Can\u2019t pitch", "error");
      rerender();
    });
  });
  document.querySelectorAll("[data-portal-drop]").forEach((btn) => {
    btn.addEventListener("click", () => {
      playerDrop(state, btn.dataset.portalDrop);
      rerender();
    });
  });
  (_b = document.querySelector("[data-portal-next-round]")) == null ? void 0 : _b.addEventListener("click", () => {
    const events = advancePortalRound(state, []);
    for (const ev of events) if (ev == null ? void 0 : ev.text) notify(ev.text, /lost/i.test(ev.text) ? "warning" : "info", 4e3);
    rerender();
  });
  (_c = document.querySelector("[data-portal-resolve]")) == null ? void 0 : _c.addEventListener("click", () => {
    const events = [];
    resolvePortal(state, events);
    for (const ev of events) if (ev == null ? void 0 : ev.text) notify(ev.text, /lost/i.test(ev.text) ? "warning" : "info", 4e3);
    rerender();
  });
  // ── [W9 §12 T1] Agenda actions ──────────────────────────────────────────
  setupHandoffListeners();
  document.querySelectorAll("[data-tree-final]").forEach((b) => b.addEventListener("click", () => {
    softFinalize(state, b.dataset.treeFinal);
    rerender();
  }));
  (_e = document.getElementById("tree-finalize-all")) == null ? void 0 : _e.addEventListener("click", () => {
    softFinalizeAll(state);
    rerender();
  });
  document.querySelectorAll("[data-tree-take]").forEach((b) => b.addEventListener("click", async () => {
    const res = takeOver(state, b.dataset.treeTake);
    if (!res.ok) {
      notify(res.reason, "warning", 4e3);
      return;
    }
    notify(`You're on the ${res.schoolName} sideline this week.`, "info", 3500);
    rerender();
  }));

  (_d = document.getElementById("btn-advance-day")) == null ? void 0 : _d.addEventListener("click", async () => {
    var _a2, _b2, _c2, _d2, _e2;
    const btn = document.getElementById("btn-advance-day");
    if (state.day === 4 && !devCtx(state).openerPrep) {
      devCtx(state).openerPrep = true;
      rerender();
      return;
    }
    const atRisk = redshirtBurnRisks();
    if (atRisk.length && !state.ui.redshirtBurnAck) {
      state.ui.showRedshirtBurnWarn = atRisk;
      rerender();
      return;
    }
    state.ui.redshirtBurnAck = false;
    const board = ((_a2 = state.playerCoach) == null ? void 0 : _a2.recruitBoard) || [];
    if (state.day === 2 && board.length === 0 && !state.ui.recruitStartAck) {
      state.ui.showRecruitStartWarn = true;
      rerender();
      return;
    }
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Processing\u2026";
    }
    cue("advance");
    const preSchool = getPlayerSchool();
    const preW = ((_b2 = preSchool == null ? void 0 : preSchool.record) == null ? void 0 : _b2.wins) || 0, preL = ((_c2 = preSchool == null ? void 0 : preSchool.record) == null ? void 0 : _c2.losses) || 0;
    const preBanners = (state.coachHistory || []).filter((h) => h.type === "program").length;
    const preSignings = (state.signingsLog || []).filter((s) => s.schoolId === (preSchool == null ? void 0 : preSchool.id)).length;
    try {
      await advanceDay2();
      const post = getPlayerSchool();
      const banners = (state.coachHistory || []).filter((h) => h.type === "program").length;
      const signings = (state.signingsLog || []).filter((s) => s.schoolId === (post == null ? void 0 : post.id)).length;
      if (banners > preBanners) cue("banner");
      else if ((((_d2 = post == null ? void 0 : post.record) == null ? void 0 : _d2.wins) || 0) > preW) cue("win");
      else if ((((_e2 = post == null ? void 0 : post.record) == null ? void 0 : _e2.losses) || 0) > preL) cue("loss");
      else if (signings > preSignings) cue("commit");
    } catch (err) {
      console.error("advanceDay error:", err);
      alert("Error advancing week: " + err.message);
    } finally {
      rerender();
    }
  });
  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", () => navigate(el.dataset.nav));
  });
  (_e = document.getElementById("open-last-result")) == null ? void 0 : _e.addEventListener("click", () => {
    state.ui.showGameResult = true;
    rerender();
  });
  document.querySelectorAll("[data-ext-term]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const res = acceptExtension(state, btn.dataset.extTerm);
      if (res.ok) notify(`${res.term.label} deal signed: ${res.term.years} years, loyalty raise +10% of base (stack ${state.playerCoach?.retentionStacks || 1}/10), ${res.term.jsDelta >= 0 ? "+" : ""}${res.term.jsDelta} security.`, "success");
      else notify(res.reason, "warning");
      rerender();
    });
  });
  (_f = document.getElementById("btn-decline-offers")) == null ? void 0 : _f.addEventListener("click", () => {
    const endBefore = state.playerCoach?.contract?.endSeason;
    const n = declineOffersWithLeverage(state);
    const extended = endBefore != null && (state.playerCoach?.contract?.endSeason || 0) > endBefore;
    if (n > 0) notify(`Declined ${n} offer${n > 1 ? "s" : ""} \u2014 the AD noticed. Seat +${C.OFFER_LEVERAGE_JS}, loyalty raise +10% of base next season (stack ${state.playerCoach?.retentionStacks || 1}/10)${extended ? ", and a year added to your deal" : ""}. Leaving forfeits every raise.`, "info", 7e3);
    rerender();
  });
  document.querySelectorAll(".offer-accept-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const result = acceptJob(state, btn.dataset.offerSchool);
      if (result.ok) {
        state.pendingOffers = null;
        const h = isTreeGame(state) ? pendingHandoff(state) : null;
        notify(h ? `You're the new coach at ${result.schoolName} — and ${h.schoolName} needs a coach. This offseason only, you can send one of your old coordinators down to take it.` : `You're the new coach at ${result.schoolName}.`, "success", h ? 7e3 : void 0);
        notifyJobMoveCosts(result);
      } else notify(result.reason, "warning");
      rerender();
    });
  });
  document.querySelectorAll(".focus-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const res = setDevFocus(state, btn.dataset.focus);
      if (!res.ok && res.reason) notify(res.reason, "warning");
      rerender();
    });
  });
  document.querySelectorAll("[data-camp-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      campFilterPos = btn.dataset.campFilter;
      rerender();
    });
  });
  document.querySelectorAll("[data-camp-sort]").forEach((btn) => {
    btn.addEventListener("click", () => {
      campSort = btn.dataset.campSort;
      rerender();
    });
  });
  document.querySelectorAll("[data-conv-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      convFilterPos = btn.dataset.convFilter;
      rerender();
    });
  });
  document.querySelectorAll("[data-conv-target]").forEach((btn) => {
    btn.addEventListener("click", () => {
      convTarget = btn.dataset.convTarget;
      if (!convTarget && convSort === "proj") convSort = "";
      rerender();
    });
  });
  document.querySelectorAll("[data-conv-sort]").forEach((el) => {
    el.addEventListener("click", () => {
      const k = el.dataset.convSort;
      convSort = convSort === k ? "" : k;
      rerender();
    });
  });
  document.querySelectorAll(".conv-row-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!convTarget) return;
      state.ui.convPending = { playerId: btn.dataset.playerId, to: convTarget, anytime: false };
      rerender();
    });
  });
  const convConfirmBtn = document.getElementById("conv-confirm");
  if (convConfirmBtn) convConfirmBtn.addEventListener("click", () => {
    const pend = state.ui.convPending;
    if (!pend) return;
    const res = convertPosition(state, pend.playerId, pend.to, { anytime: pend.anytime });
    if (res.ok) notify(`${res.name}: ${res.from} \u2192 ${pend.to} (${res.before} \u2192 ${res.after} composite).`, "success");
    else notify(res.reason, "warning");
    state.ui.convPending = null;
    rerender();
  });
  const convCancelBtn = document.getElementById("conv-cancel");
  if (convCancelBtn) convCancelBtn.addEventListener("click", () => {
    state.ui.convPending = null;
    rerender();
  });
  (_g = document.getElementById("btn-spring-play")) == null ? void 0 : _g.addEventListener("click", () => {
    var _a2;
    if (!devCtx(state).devDone) runDevCamp(state);
    const res = playSpringGame(state);
    if (!res.ok) {
      notify(res.reason, "warning");
      rerender();
      return;
    }
    if (res.raw) {
      state.ui.lastGameResult = res.raw;
      state.ui.showGameResult = true;
      state.ui.gameResultTab = "boxscore";
    }
    rerender();
  });
  (_h = document.getElementById("btn-goto-recruiting")) == null ? void 0 : _h.addEventListener("click", () => {
    navigate("recruiting");
  });
  document.querySelectorAll(".clinic-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const res = takeClinic(state, btn.dataset.skill);
      if (res.ok) notify(`Clinic attended: +${C.CLINIC_XP} ${btn.dataset.skill} XP.`, "success");
      else notify(res.reason, "warning");
      rerender();
    });
  });
  document.querySelectorAll(".walkon-accept-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const res = acceptWalkOn(state, parseInt(btn.dataset.walkonIdx, 10));
      if (!res.ok) notify(res.reason, "warning");
      rerender();
    });
  });
  (_i = document.getElementById("btn-rs-bench")) == null ? void 0 : _i.addEventListener("click", () => {
    state.ui.showRedshirtBurnWarn = null;
    navigate("depthchart");
  });
  (_j = document.getElementById("btn-conv-toggle")) == null ? void 0 : _j.addEventListener("click", () => {
    const pre = devCtx(state);
    // Before confirmation the board is forced open, so "Close board" has to
    // count as the confirmation or the button would do nothing.
    if (!pre.posReviewed) {
      pre.posReviewed = true;
      convBoardOpen = false;
    } else convBoardOpen = !convBoardOpen;
    rerender();
  });
  document.getElementById("btn-pos-confirm")?.addEventListener("click", () => {
    const pre = devCtx(state);
    const n = (pre.posChanges || []).length;
    pre.posReviewed = true;
    convBoardOpen = false;
    notify(n ? `Positions set — ${n} change${n !== 1 ? "s" : ""} take effect at camp.` : "Positions set — no changes this year.", "success");
    rerender();
  });
  (_k = document.getElementById("btn-rec-go")) == null ? void 0 : _k.addEventListener("click", () => {
    state.ui.showRecruitStartWarn = false;
    navigate("recruiting");
  });
  (_l = document.getElementById("btn-rec-skip")) == null ? void 0 : _l.addEventListener("click", () => {
    var _a2;
    state.ui.showRecruitStartWarn = false;
    state.ui.recruitStartAck = true;
    (_a2 = document.getElementById("btn-advance-day")) == null ? void 0 : _a2.click();
  });
  (_m = document.getElementById("btn-rs-play")) == null ? void 0 : _m.addEventListener("click", () => {
    var _a2;
    state.ui.showRedshirtBurnWarn = null;
    state.ui.redshirtBurnAck = true;
    rerender();
    (_a2 = document.getElementById("btn-advance-day")) == null ? void 0 : _a2.click();
  });
  (_n = document.getElementById("btn-skip-offseason")) == null ? void 0 : _n.addEventListener("click", async (e) => {
    e.target.disabled = true;
    try {
      await skipToOffseason();
    } catch (err) {
      console.error("skipToOffseason error:", err);
      e.target.disabled = false;
    }
  });
  if (document.querySelector(".event-embed .scheduling-view")) {
    setupListeners5();
  }
  document.querySelectorAll(".job-apply-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const res = applyForJob(state, btn.dataset.applySchool);
      if (!res.ok) {
        notify(res.reason, "warning");
        return;
      }
      notify(res.hired ? `${res.schoolName} wants you \u2014 their offer is on the table.` : `${res.schoolName} went another direction.`, res.hired ? "success" : "info");
      rerender();
    });
  });
  document.querySelectorAll("[data-cut-pos]").forEach((btn) => {
    btn.addEventListener("click", () => {
      cutModalPos = btn.dataset.cutPos;
      rerender();
    });
  });
  document.querySelectorAll("[data-cut-class]").forEach((btn) => {
    btn.addEventListener("click", () => {
      cutModalClass = btn.dataset.cutClass;
      rerender();
    });
  });
  document.querySelectorAll(".cutrec-convert-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.ui.convPending = { playerId: btn.dataset.cutrecId, to: btn.dataset.cutrecTo, anytime: false };
      rerender();
    });
  });
  (document.getElementById("btn-cutrecs-continue") || {}).onclick = () => {
    if (state.offseason) state.offseason.data.cutRecsSeen = true;
    state.ui.convPending = null;
    rerender();
  };
  (document.getElementById("btn-cutrecs-back") || {}).onclick = () => {
    if (state.offseason) state.offseason.data.cutRecsSeen = false;
    rerender();
  };
  document.querySelectorAll(".cut-player-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      var _a2, _b2;
      const school = getPlayerSchool();
      const coach = state.playerCoach;
      if (!school || !coach) return;
      const pid = btn.dataset.playerId;
      const player = school.roster.find((p) => p.id === pid);
      if (!player) return;
      if (graduatingSeniors(state).some((p) => p.id === pid)) {
        notify(`${fullName(player)} graduates at season's end \u2014 his scholarship comes back either way.`, "info");
        return;
      }
      // Same helper the display and the cap use \u2014 these disagreed, and cuts made
      // while over-cap-before-grads but under-cap-after were never charged.
      const over = effectiveRosterOver(state);
      const used = ((_a2 = coach.cutsUsed) == null ? void 0 : _a2.season) === state.season ? coach.cutsUsed.n : 0;
      if (used >= C.SEASON_CUT_CAP && over <= 0) {
        notify(`Cut limit reached \u2014 max ${C.SEASON_CUT_CAP} a season.`, "info");
        return;
      }
      if (!confirm(`Cut ${fullName(player)} (${player.position}, ${player.classYear})? This cannot be undone.`)) return;
      if (over <= 0) coach.cutsUsed = { season: state.season, n: used + 1 };
      school.roster = school.roster.filter((p) => p.id !== pid);
      if (!player.isWalkOn) {
        coach.scholarshipsAvailable = (coach.scholarshipsAvailable || 0) + 1;
      }
      const fa = (_b2 = school.gameplan) == null ? void 0 : _b2.fieldAssignments;
      if (fa) {
        for (const entry of Object.values(fa.offense || {})) {
          for (const [sid, id] of Object.entries(entry.slots || {})) {
            if (id === pid) delete entry.slots[sid];
          }
        }
        for (const entry of Object.values(fa.defense || {})) {
          for (const [sid, id] of Object.entries(entry.slots || {})) {
            if (id === pid) delete entry.slots[sid];
          }
        }
      }
      school.depthChart = buildDepthChart(school.roster, school.gameplan, school.depthOrder || {});
      const schMsg = player.isWalkOn ? "" : " \u2014 scholarship returned";
      notify(`${fullName(player)} cut${schMsg}`, "info");
      rerender();
    });
  });
  document.querySelectorAll(".redshirt-check").forEach((cb) => {
    cb.addEventListener("change", () => {
      var _a2, _b2;
      const school = getPlayerSchool();
      if (!school) return;
      const pid = cb.dataset.playerId;
      const current = (_a2 = school.pendingRedshirts) != null ? _a2 : [];
      let updated;
      if (cb.checked) {
        updated = [...current, pid];
      } else {
        updated = current.filter((id) => id !== pid);
      }
      school.pendingRedshirts = updated;
      const countEl = document.getElementById("redshirt-count");
      if (countEl) countEl.textContent = `${updated.length} player${updated.length !== 1 ? "s" : ""} selected`;
      (_b2 = cb.closest(".redshirt-row")) == null ? void 0 : _b2.classList.toggle("redshirt-selected", cb.checked);
    });
  });
  (_o = document.getElementById("btn-redshirt-reset")) == null ? void 0 : _o.addEventListener("click", () => {
    const school = getPlayerSchool();
    if (!school) return;
    school.pendingRedshirts = computeAutoRedshirtCandidates(school, state.season);
    rerender();
  });
  (_p = document.getElementById("btn-redshirt-confirm")) == null ? void 0 : _p.addEventListener("click", () => {
    var _a2;
    const school = getPlayerSchool();
    if (!school) return;
    const ids = (_a2 = school.pendingRedshirts) != null ? _a2 : [];
    const n = ids.length;
    for (const pid of ids) {
      const player = school.roster.find((p) => p.id === pid);
      if (player) applyRedshirt(player, state.season);
    }
    const vacated = clearRedshirtFromLineups(school, ids);
    school.pendingRedshirts = null;
    notify(`Redshirts finalized \u2014 ${n} player${n !== 1 ? "s" : ""} sitting the year.${vacated.length ? ` ${vacated.length} depth-chart slot${vacated.length !== 1 ? "s" : ""} vacated \u2014 next man up auto-filled.` : ""}`, "success");
    rerender();
  });
}

export { renderDashboard, setupListeners6 };
