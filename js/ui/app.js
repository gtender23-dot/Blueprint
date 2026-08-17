import { __spreadProps, __spreadValues } from '../_spread.js';
import { PASS_CONCEPTS, RUN_CONCEPTS } from '../concepts.js';
import { DEF_FIELD_LAYOUTS, OFF_FIELD_LAYOUTS, variationLayoutSlots } from '../constants_field.js';
import { ATTRIBUTES, C, FORMATION_PACKAGES, FORMATION_VARIATIONS, PASS_TENDENCY, aliasFormation, attrLabel } from '../constants.js';
import { gameHighlights, linescore } from '../engine/highlights.js';
import { flushSaveSync, gamePauseIsLive, saveGame } from '../engine/persistence.js';
import { saveReplay } from '../engine/replays.js';
import { derivedArchetype } from '../engine/player.js';
import { BRIDGE_CATALOG, FLAW_CATALOG, PLAY_CATALOG } from '../engine/traits.js';
import { coachedGamesForDay, weekShort } from '../engine/season.js';
import { callContext, decisionContext, midGameReport, setPenaltyScale } from '../engine/sim.js';
import { defBookCalls } from '../engine/teamplan.js';
import { listCreations, loadCreationData } from '../engine/creator.js';
import { repairComposedPlay } from '../engine/playcompose.js';
import { renderConceptThumb, renderFormationDiagram, renderPlayCard, resolveComposedReceivers, renderComposedCard, playAssignments, conceptKind, routeColor } from './views/routeart.js';
import { conceptBlurb, composedBlurb } from './views/conceptblurbs.js';
import { SITUATION_KEYS, SITUATION_LABELS } from '../engine/situations.js';
import { isTreeGame, lockstepBlock, treeSnapshot } from '../engine/tree.js';
import { afterCoachedGameResultClose, answerFourthDown, answerPlayCall, chooseKickoffMode, closeInstantClassicReplay, continueExhibitionSpectator, exitSeasonRun, getPhaseLabel, getPlayerSchool, getUpcomingGame, getWeekLabel, getWeekShort, navigate, navigateBack, notify, openSchool, programGroupTab, refreshSaves, rerender, resumeHalftime, saveToSlot, seasonGroupTab, setCallModeMidGame, setGroupTab, setInvolvement, involvementLevel, setNotifyFn, setRenderFn, simCoached, simToBreak, simToPossessionEnd, state, statsGroupTab, switchTreeSlot, teamGroupTab } from '../state.js';
import { chapterById } from './manual/index.js';
import { tipById, tipTerm } from './manual/tips.js';
import { renderAwards, setupListeners4 } from './views/awards.js';
import { renderCoachOffice, setupListeners18 } from './views/coachoffice.js';
import { renderDashboard, setupListeners6 } from './views/dashboard.js';
import { formationPlaybookSet, renderDepthChart, setupListeners9 } from './views/depthchart.js';
import { renderGameplan, renderHalftimeAdjust, renderSituationsSection, setupListeners, wireDefaultsListeners, wireSituationListeners } from './views/gameplan.js';
import { renderHistory, setupListeners16 } from './views/history.js';
import { renderMainMenu } from './views/mainmenu.js';
import { renderManual, setupListeners12 } from './views/manual.js';
import { renderNewGame, setupListeners3 } from './views/newgame.js';
import { playnowListeners, renderPlayNow } from './views/playnow.js';
import { creatorListeners, renderCreator } from './views/creator.js';
import { renderSeasonMode, seasonModeListeners } from './views/seasonmodeview.js';
import { renderPractice, setupListeners17 } from './views/practice.js';
import { recruitingCanBack, recruitingGoBack, renderRecruiting, setupListeners10 } from './views/recruiting.js';
import { renderRoster, setupListeners7 } from './views/roster.js';
import { renderSchedule, setupListeners11 } from './views/schedule.js';
import { renderScheduling, setupListeners5 } from './views/scheduling.js';
import { renderScout, setupListeners8 } from './views/scout.js';
import { renderSettings, setupListeners15 } from './views/settings.js';
import { renderStandings, setupListeners13 } from './views/standings.js';
import { renderStats, setupListeners14 } from './views/stats.js';
import { buildPlayScript, sampleTrack, buildCameraPlan, buildOfficialsPlan, selectSecondaryMotion, buildBroadcastCommentary, routeWaypoints } from './watchphys.js';
import { normalizeWatchCamera, nextWatchCamera, watchCameraLabel, projectWatchPoint, watchProjectionScale, watchProjectionDepth, buildReplayDirectorPlan, buildSpecialTeamsDirectorPlan, selectWatchLabels, replayDirectorFocus, specialTeamsDirectorFocus } from './watchcamera.js';
import { spriteMarkup, ballMarkup, spriteMotionTick, wspPlace } from './sprite.js';
import { stadiumPause, stadiumReact, stadiumStart } from './sound.js';
import { archetypeLabel, escapeHtml, fullName, ratingColor, renderCrest, renderPlayerPortrait } from '../utils.js';
import { syncCustomFormations } from '../engine/formcompose.js';
import { benchSnap, benchLookOptions, benchOutcome, benchGameShell } from '../engine/bench.js';
import { fittingConceptsForFormation, resolveLookSheet } from '../engine/playbook.js';

// Stage 7 (Playbook-Root): register the library's custom formations into the
// live tables at boot — after this, every surface that lists or fields a
// formation (Builder, Game Plan, call sheet, depth chart, the sim, the board)
// sees them like built-ins. The Designer re-syncs after every save/delete.
// Guarded: a machine with no library (or a broken one) boots exactly as before.
try {
  syncCustomFormations(listCreations("formations").map((e) => ({ name: e.name, data: e.data })));
} catch (e) {
}

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return [h * 360, s * 100, l * 100];
}
function hslToHex(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let rv, gv, bv;
  if (s === 0) {
    rv = gv = bv = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    rv = hue2rgb(p, q, h + 1 / 3);
    gv = hue2rgb(p, q, h);
    bv = hue2rgb(p, q, h - 1 / 3);
  }
  return "#" + [rv, gv, bv].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
}
function teamAccentColor(hex) {
  const [h, s, l] = hexToHsl(hex);
  const newL = Math.max(l, 60);
  const newS = s < 5 ? s : Math.max(s, 55);
  return hslToHex(h, newS, newL);
}
function applyTeamColors(school) {
  var _a;
  const root = document.documentElement;
  if (!((_a = school == null ? void 0 : school.colors) == null ? void 0 : _a[0])) {
    for (const v of ["--team-1", "--team-1-d", "--team-1-dk", "--team-2", "--team-2-ink"]) root.style.removeProperty(v);
    return;
  }
  const accent = teamAccentColor(school.colors[0]);
  const [ah, as_, al] = hexToHsl(accent);
  const dark = hslToHex(ah, as_, Math.max(al * 0.82, 44));
  const darkBg = hslToHex(ah, Math.min(as_, 70), Math.min(al * 0.28, 24));
  root.style.setProperty("--team-1", accent);
  root.style.setProperty("--team-1-d", dark);
  root.style.setProperty("--team-1-dk", darkBg);
  const second = teamAccentColor(school.colors[1] || school.colors[0]);
  root.style.setProperty("--team-2", second);
  // [UI overhaul, broadcast skin] The lower-third tabs and accent keylines
  // ride the TEAM'S second color (owner ruling: colors still change with
  // teams — both of them). A tab needs readable ink on ANY second color, so
  // compute it by luminance.
  const [, , sl] = hexToHsl(second);
  root.style.setProperty("--team-2-ink", sl >= 55 ? "#0E1B2C" : "#F2F6FB");
}
function groupHeader(title, sub, tabs, activeTab3, dataAttr) {
  return `
    <div class="view-header group-header">
      <div>
        <h1 class="view-title">${title}</h1>
        ${sub ? `<div class="view-subtitle">${sub}</div>` : ""}
      </div>
      <div class="rec-tabs group-tabs">
        ${tabs.map((t) => `<button class="rec-tab${activeTab3 === t.id ? " active" : ""}" ${dataAttr}="${t.id}">${t.label}</button>`).join("")}
      </div>
    </div>`;
}
function renderTeamGroup() {
  const tabs = [
    { id: "roster", label: "Roster" },
    { id: "depthchart", label: "Depth Chart" },
    // Practice is weekly player-development toward next season — dropped in a
    // single-season run.
    ...(state.seasonMode ? [] : [{ id: "practice", label: "Practice" }])
  ];
  const tab = state.seasonMode && teamGroupTab === "practice" ? "roster" : teamGroupTab;
  let body = "";
  if (tab === "depthchart") body = renderDepthChart(true);
  else if (tab === "practice") body = renderPractice(true);
  else body = renderRoster(true);
  return `<div class="view-group view-team">
    ${groupHeader("Team", "", tabs, tab, "data-team-tab")}
    <div class="group-body">${body}</div>
  </div>`;
}
function renderProgramGroup() {
  const tabs = [
    { id: "identity", label: "Identity" },
    { id: "program", label: "Program" }
  ];
  const body = renderCoachOffice(true, programGroupTab === "program" ? "program" : "identity");
  return `<div class="view-group view-program">
    ${groupHeader("Coach's Office", "", tabs, programGroupTab, "data-program-tab")}
    <div class="group-body">${body}</div>
  </div>`;
}
function renderSeasonGroup() {
  const tabs = [
    { id: "schedule", label: "Schedule" },
    { id: "standings", label: "Standings" }
  ];
  const body = seasonGroupTab === "standings" ? renderStandings(true) : renderSchedule(true);
  return `<div class="view-group view-season">
    ${groupHeader("Season", "", tabs, seasonGroupTab, "data-season-tab")}
    <div class="group-body">${body}</div>
  </div>`;
}
function renderStatsGroup() {
  const tabs = [
    { id: "stats", label: "Statistics" },
    { id: "awards", label: "Awards" },
    // History is cross-season (past champions, program history) — nothing to
    // show in a one-off run.
    ...(state.seasonMode ? [] : [{ id: "history", label: "History" }])
  ];
  const tab = state.seasonMode && statsGroupTab === "history" ? "stats" : statsGroupTab;
  let body = "";
  if (tab === "awards") body = renderAwards(true);
  else if (tab === "history") body = renderHistory(true);
  else body = renderStats(true);
  return `<div class="view-group view-statsgroup">
    ${groupHeader("Statistics", "", tabs, tab, "data-statsgroup-tab")}
    <div class="group-body">${body}</div>
  </div>`;
}
var VIEWS = {
  dashboard: renderDashboard,
  team: renderTeamGroup,
  program: renderProgramGroup,
  season: renderSeasonGroup,
  statsgroup: renderStatsGroup,
  scout: renderScout,
  gameplan: renderGameplan,
  recruiting: renderRecruiting,
  settings: renderSettings,
  manual: renderManual,
  scheduling: renderScheduling,
  // legacy ids kept so deep links / back-nav still resolve to the merged groups
  roster: renderTeamGroup,
  depthchart: renderTeamGroup,
  practice: renderTeamGroup,
  coachoffice: renderProgramGroup,
  schedule: renderSeasonGroup,
  standings: renderSeasonGroup,
  stats: renderStatsGroup,
  awards: renderStatsGroup,
  history: renderStatsGroup
};
var NAV_ITEMS = [
  { id: "dashboard", icon: "\u25C9", label: "Agenda" },
  { id: "team", icon: "\u25A4", label: "Team", navTo: "roster" },
  // sidebar Team → Roster tab
  { id: "gameplan", icon: "\u25C8", label: "Game Plan" },
  { id: "recruiting", icon: "\u25CE", label: "Recruiting" },
  { id: "season", icon: "\u25F7", label: "Season", navTo: "schedule" },
  { id: "program", icon: "\u2726", label: "Coach's Office" },
  { id: "statsgroup", icon: "\u25CA", label: "Statistics" },
  { id: "manual", icon: "\u{1F4D6}", label: "The Manual" },
  { id: "settings", icon: "\u2699", label: "Settings" }
];
var TABBAR_ITEMS = [
  { id: "dashboard", icon: "\u25C9", label: "Home" },
  { id: "team", icon: "\u25A4", label: "Depth Chart", navTo: "depthchart" },
  // opens straight to the Depth Chart tab
  { id: "gameplan", icon: "\u25C8", label: "Plan" },
  { id: "recruiting", icon: "\u25CE", label: "Recruits" }
];
// Season Mode hides the dynasty-progression sections (recruiting + the coach's
// office). The Season nav opens straight to Standings there, since Schedule is
// already the Agenda's focus. Everything else is identical to a dynasty.
var SEASON_HIDE_NAV = /* @__PURE__ */ new Set(["recruiting", "program"]);
function navItemsFor() {
  return state.seasonMode ? NAV_ITEMS.filter((i) => !SEASON_HIDE_NAV.has(i.id)) : NAV_ITEMS;
}
function renderSeasonCompleteOverlay() {
  var _a, _b;
  const sc = state.ui.seasonComplete;
  if (!sc || !state.seasonMode) return "";
  const champ = (_b = (_a = state.world) == null ? void 0 : _a.schools) == null ? void 0 : _b.find((s) => s.id === sc.champion);
  const me = getPlayerSchool();
  const won = sc.champion && me && sc.champion === me.id;
  return `<div class="modal-overlay season-complete-overlay" id="season-complete-overlay">
    <div class="modal season-complete-card">
      <div class="sc-trophy">\u{1F3C6}</div>
      <div class="sc-kicker">${escapeHtml(sc.division || "D1")} National Champion</div>
      <div class="sc-champ">${champ ? renderCrest(champ, 44) : ""}<span class="sc-champ-name">${champ ? escapeHtml(champ.name) : "—"}</span></div>
      ${won ? '<div class="sc-you sc-you-won">That’s you — congratulations, Coach.</div>' : me ? `<div class="sc-you muted">Your ${escapeHtml(me.name)} finished ${me.record.wins}-${me.record.losses}.</div>` : ""}
      <div class="sc-actions">
        <button class="btn-mm btn-mm-new" id="btn-sc-standings">Final Standings</button>
        <button class="btn-mm btn-mm-secondary" id="btn-sc-exit">Exit to Menu</button>
      </div>
    </div>
  </div>`;
}
function tabbarItemsFor() {
  return state.seasonMode ? TABBAR_ITEMS.filter((i) => i.id !== "recruiting").concat([{ id: "season", icon: "\u25F7", label: "Standings", navTo: "standings" }]) : TABBAR_ITEMS;
}
var HELP_CHAPTER_FLAT = {
  dashboard: "the-year",
  // the agenda IS the calendar/season loop
  gameplan: "calling-a-game",
  recruiting: "recruiting",
  scout: "reading-a-player",
  // scouting a school = reading its players
  scheduling: "the-year"
};
var HELP_CHAPTER_GROUP = {
  team: { roster: "reading-a-player", depthchart: "the-depth-chart", practice: "building-a-player" },
  program: { identity: "your-career", program: "your-career" },
  season: { schedule: "the-year", standings: "the-year" },
  statsgroup: { stats: "reading-a-player", awards: "your-career", history: "your-career" }
};
var HELP_CHAPTER_LIVEGAME = "anatomy-of-a-play";
function helpChapterFor(view) {
  if (view === "team") return HELP_CHAPTER_GROUP.team[teamGroupTab] || "the-depth-chart";
  if (view === "program") return HELP_CHAPTER_GROUP.program[programGroupTab] || "your-career";
  if (view === "season") return HELP_CHAPTER_GROUP.season[seasonGroupTab] || "the-year";
  if (view === "statsgroup") return HELP_CHAPTER_GROUP.statsgroup[statsGroupTab] || "reading-a-player";
  return HELP_CHAPTER_FLAT[view] || null;
}
function helpButtonHtml(chapterId) {
  if (!chapterId) return "";
  return `<button class="view-help-btn" data-help-chapter="${chapterId}"
                title="Quick help for this screen" aria-label="Help for this screen">?</button>`;
}
function injectHelpButton(view) {
  const chapterId = helpChapterFor(view);
  if (!chapterId) return;
  const header = document.querySelector("#view-root .view-header");
  if (!header || header.querySelector(".view-help-btn")) return;
  header.insertAdjacentHTML("beforeend", helpButtonHtml(chapterId));
}
var phoneDialActive = null;
var phoneDialTimer = null;
var phoneDialOutsideHandler = null;
var phoneDialResizeHandler = null;
var phoneDialLayoutHandler = null;
function clearPhoneDialBindings() {
  clearTimeout(phoneDialTimer);
  phoneDialTimer = null;
  phoneDialActive = null;
  if (phoneDialOutsideHandler) document.removeEventListener("pointerdown", phoneDialOutsideHandler, true);
  if (phoneDialResizeHandler) window.removeEventListener("resize", phoneDialResizeHandler);
  if (phoneDialLayoutHandler) document.removeEventListener("toggle", phoneDialLayoutHandler, true);
  phoneDialOutsideHandler = null;
  phoneDialResizeHandler = null;
  phoneDialLayoutHandler = null;
}
function dialControlLabel(control) {
  const row = control.closest(".gp-row, .fw-row, .practice-row, .share-row, .run-dir-cell, .run-dir-item");
  const label = row == null ? void 0 : row.querySelector(".gp-label, .fw-label, .practice-name, .share-slot-label, .run-dir-name, .run-dir-lbl, label");
  return ((label == null ? void 0 : label.textContent) || control.getAttribute("aria-label") || "control").trim();
}
function installPhoneDialGuards() {
  clearPhoneDialBindings();
  if (!window.matchMedia("(max-width: 700px)").matches) return;
  const guards = [];
  const lock = (guard) => {
    guard.classList.remove("is-editing");
    guard.controls.forEach((control) => {
      control.classList.add("phone-dial-locked");
      control.setAttribute("aria-disabled", "true");
      control.tabIndex = -1;
    });
    if (phoneDialActive === guard) phoneDialActive = null;
  };
  const resetTimer = (guard) => {
    clearTimeout(phoneDialTimer);
    phoneDialTimer = setTimeout(() => lock(guard), 8e3);
  };
  const activate = (guard) => {
    var _a;
    if (phoneDialActive && phoneDialActive !== guard) lock(phoneDialActive);
    phoneDialActive = guard;
    guard.classList.add("is-editing");
    guard.controls.forEach((control) => {
      control.classList.remove("phone-dial-locked");
      control.removeAttribute("aria-disabled");
      control.tabIndex = control._phoneDialTabIndex;
    });
    resetTimer(guard);
    (_a = guard.controls[0]) == null ? void 0 : _a.focus({ preventScroll: true });
  };
  const addGuard = (guard, controls, label) => {
    if (!guard || guard.classList.contains("phone-dial-guard")) return;
    guard.classList.add("phone-dial-guard");
    guard.controls = controls;
    controls.forEach((control) => {
      control._phoneDialTabIndex = control.tabIndex;
      control.addEventListener("input", () => resetTimer(guard));
      control.addEventListener("click", () => resetTimer(guard));
    });
    const unlock = document.createElement("button");
    unlock.type = "button";
    unlock.className = "phone-dial-unlock";
    unlock.textContent = "Tap to edit";
    unlock.setAttribute("aria-label", `Tap to edit ${label}`);
    unlock.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      activate(guard);
    });
    guard.appendChild(unlock);
    guard.unlock = unlock;
    guards.push(guard);
    lock(guard);
  };
  document.querySelectorAll('#view-root input[type="range"]').forEach((input) => {
    const host = input.parentElement;
    if (!host || host.querySelector(":scope > .phone-dial-unlock")) return;
    host.classList.add("phone-dial-range-host");
    addGuard(host, [input], dialControlLabel(input));
  });
  document.querySelectorAll("#view-root .fs-share, #view-root .fs-blitz, #view-root .do-carry").forEach((group) => {
    const controls = [...group.querySelectorAll("button")];
    if (controls.length) addGuard(group, controls, group.getAttribute("title") || "depth chart control");
  });
  const positionRangeUnlocks = () => guards.forEach((guard) => {
    if (!guard.classList.contains("phone-dial-range-host")) return;
    const input = guard.controls[0];
    const hostRect = guard.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();
    const height = Math.max(34, inputRect.height + 12);
    guard.unlock.style.left = `${inputRect.left - hostRect.left}px`;
    guard.unlock.style.top = `${inputRect.top - hostRect.top - (height - inputRect.height) / 2}px`;
    guard.unlock.style.width = `${inputRect.width}px`;
    guard.unlock.style.height = `${height}px`;
  });
  positionRangeUnlocks();
  phoneDialResizeHandler = positionRangeUnlocks;
  window.addEventListener("resize", phoneDialResizeHandler);
  phoneDialLayoutHandler = () => requestAnimationFrame(positionRangeUnlocks);
  document.addEventListener("toggle", phoneDialLayoutHandler, true);
  phoneDialOutsideHandler = (event) => {
    if (phoneDialActive && !phoneDialActive.contains(event.target)) lock(phoneDialActive);
  };
  document.addEventListener("pointerdown", phoneDialOutsideHandler, true);
}
function renderTipPopover() {
  const id = state.ui.activeTip;
  if (!id) return "";
  const tip = tipById(id);
  if (!tip) return "";
  const chap = tip.chapter ? chapterById(tip.chapter) : null;
  const link = chap ? `<button class="tip-chapter-link" data-tip-chapter="${chap.id}">Read more in <em>${escapeHtml(chap.title)}</em> \u2192</button>` : "";
  return `
  <div class="modal-overlay tip-overlay" id="tip-overlay">
    <div class="tip-popover" role="dialog" aria-label="${escapeHtml(tip.term)}">
      <div class="tip-head">
        <span class="tip-term-title">${escapeHtml(tip.term)}</span>
        <button class="tip-close" id="tip-close" aria-label="Close">\u2715</button>
      </div>
      <div class="tip-body">${escapeHtml(tip.body)}</div>
      ${link}
    </div>
  </div>`;
}
var CONTEXT_HELP_SUMMARIES = {
  "anatomy-of-a-play": { title: "Calling the next play", intro: "Use the situation first, then pick a play that gives your players a favorable job.", bullets: ["Check down, distance, clock, and field position.", "Open a play family, then tap a play diagram to see what it attacks.", "The result stays on screen after the animation so you can read what happened."] },
  "calling-a-game": { title: "Calling a game", intro: "Build calls around the situation, not a perfect-play hunt.", bullets: ["Stay balanced enough that the defense cannot sit on one answer.", "Use the matchup notes and concept preview before committing.", "On key downs, favor what your best players execute well."] },
  "the-year": { title: "Managing the season", intro: "Each week is a small set of decisions that shape the whole program.", bullets: ["Handle the current agenda item before advancing.", "Watch fatigue, development, and upcoming opponents.", "The phase banner tells you what matters right now."] },
  recruiting: { title: "Recruiting this week", intro: "Spend attention where interest and roster need overlap.", bullets: ["Use Assist if you want the staff to protect your board.", "Scout before overcommitting resources.", "A balanced class prevents future depth-chart holes."] },
  "reading-a-player": { title: "Reading a player", intro: "Overall is a shortcut; role fit and key attributes explain the player.", bullets: ["Start with position and archetype.", "Look at the attributes the role uses most.", "Development and class year tell you how much growth is left."] },
  "the-depth-chart": { title: "Setting the depth chart", intro: "Put players in roles they can actually execute.", bullets: ["The starter is not always the best fit for every package.", "Check fatigue and specialist roles.", "Formation personnel changes which plays are available."] },
  "building-a-player": { title: "Developing players", intro: "Practice trades short-term focus for long-term growth.", bullets: ["Prioritize young players with a real path to snaps.", "Train attributes that matter to their role.", "Avoid spreading development so thin that nobody improves."] },
  "your-career": { title: "Your coaching career", intro: "Program results, expectations, and job choices build your reputation.", bullets: ["Know the board's current expectations.", "Sustainable roster health matters beyond one season.", "Your decisions shape future job opportunities."] }
};
function renderContextHelp() {
  const id = state.ui.contextHelpChapter;
  if (!id) return "";
  const chapter17 = chapterById(id);
  const help = CONTEXT_HELP_SUMMARIES[id] || {
    title: (chapter17 == null ? void 0 : chapter17.title) || "Quick help",
    intro: "Here are the essentials for the screen you are using.",
    bullets: ["Read the situation first.", "Make one decision at a time.", "Open the full chapter when you want the deeper explanation."]
  };
  const returnLabel = state.ui.liveWatch ? "Return to game" : "Return to screen";
  return `
  <div class="modal-overlay context-help-overlay" id="context-help-overlay">
    <section class="context-help" role="dialog" aria-modal="true" aria-labelledby="context-help-title">
      <div class="context-help-head">
        <div><span class="context-help-kicker">QUICK HELP</span><h2 id="context-help-title">${escapeHtml(help.title)}</h2></div>
        <button class="tip-close" id="context-help-close" aria-label="Close">\u2715</button>
      </div>
      <p>${escapeHtml(help.intro)}</p>
      <ul>${help.bullets.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
      <div class="context-help-actions">
        <button class="btn primary" id="context-help-return">\u2190 ${returnLabel}</button>
        <button class="btn secondary" data-context-help-full="${escapeHtml(id)}">Read full chapter \u2192</button>
      </div>
    </section>
  </div>`;
}
var SLOT_LABELS = { auto: "Auto", slot1: "Slot 1", slot2: "Slot 2", slot3: "Slot 3", slot4: "Slot 4" };
var ALL_SLOTS = ["slot1", "slot2", "slot3", "slot4"];
var SCROLL_SELECTORS = [
  ".main-content",
  ".halftime-body",
  ".result-tab-body",
  ".inbox-list",
  ".picker-list",
  ".school-conf-grid",
  ".sched-picker-list",
  // Adjustment surfaces: every chip press re-renders the whole app, so without
  // these two the timeout menu and the live call sheet jump to the top on each tap.
  ".to-adjust-body",
  ".callsheet-modal"
];
var lastRenderedView = null;
var _helpDelegationWired = false;
function captureScroll() {
  const map = {};
  for (const sel of SCROLL_SELECTORS) {
    const el = document.querySelector(sel);
    if (el && el.scrollTop > 0) map[sel] = el.scrollTop;
  }
  map.__window = window.scrollY || document.documentElement.scrollTop || 0;
  return map;
}
function restoreScroll(map, viewChanged) {
  if (!map) return;
  const navScroll = state.ui._navRestoreScroll || null;
  state.ui._navRestoreScroll = null;
  const apply = () => {
    for (const sel of SCROLL_SELECTORS) {
      if (map[sel] == null) continue;
      if (viewChanged && sel === ".main-content") continue;
      const el = document.querySelector(sel);
      if (el) el.scrollTop = map[sel];
    }
    if (!viewChanged && map.__window) window.scrollTo(0, map.__window);
    if (navScroll) {
      const mc = document.querySelector(".main-content");
      if (mc && navScroll.main) mc.scrollTop = navScroll.main;
      window.scrollTo(0, navScroll.win || 0);
    } else if (viewChanged) {
      window.scrollTo(0, 0);
    }
  };
  document.body.offsetHeight;
  apply();
  requestAnimationFrame(() => requestAnimationFrame(apply));
}
function resultViewerSchool(result) {
  var _a, _b, _c;
  const replaySchoolId = (_a = state._instantClassicReplay) == null ? void 0 : _a.playerSchoolId;
  if (replaySchoolId && result) {
    return ((_b = result.homeSchool) == null ? void 0 : _b.id) === replaySchoolId ? result.homeSchool : ((_c = result.awaySchool) == null ? void 0 : _c.id) === replaySchoolId ? result.awaySchool : result.homeSchool || result.awaySchool || null;
  }
  return getPlayerSchool();
}
// ── Overlay containment (release hardening, Aug 2026) ────────────────────────
// Every modal renders as a fixed .modal-overlay ON TOP of the retained base
// view, so without this the covered screen stays in the accessibility tree and
// keyboard-focusable underneath the dialog (the readiness review caught the
// exhibition setup surviving kickoff — the pattern was app-wide). After every
// full render, any non-overlay top-level child of #app is marked inert +
// aria-hidden while at least one overlay is open. `inert` also removes the
// background from the tab order, which is the focus containment a dialog needs.
// Notifications stay live — they are transient announcements, not background.
function syncOverlayInert() {
  const root = document.getElementById("app");
  if (!root) return;
  const kids = Array.from(root.children);
  const hasOverlay = kids.some((el) => el.classList && el.classList.contains("modal-overlay"));
  for (const el of kids) {
    const exempt = el.classList && (el.classList.contains("modal-overlay") || el.classList.contains("notification"));
    if (hasOverlay && !exempt) {
      el.setAttribute("inert", "");
      el.setAttribute("aria-hidden", "true");
    } else {
      el.removeAttribute("inert");
      el.removeAttribute("aria-hidden");
    }
  }
  // M0 #7: any render that leaves no watch viewer on screen drops the wake
  // lock (syncOverlayInert runs on every render path, so no close site can
  // be missed).
  if (_wakeWanted && !document.getElementById("watch-root")) watchWakeRelease();
}

// Act B replay payloads deliberately save the recorded play—not animation
// frames. Rebuilding the deterministic viewer keeps clips compact enough for
// the dedicated Film Room store and makes camera/scrub changes non-destructive.
function watchClone(value) {
  return JSON.parse(JSON.stringify(value));
}
function watchSchoolSnapshot(school, fallback) {
  if (!school) return { id: fallback, name: fallback, abbr: fallback, colors: ["#243b66", "#f2c94c"] };
  return watchClone({
    id: school.id,
    name: school.name,
    nick: school.nick,
    abbr: school.abbr,
    division: school.division,
    colors: school.colors,
    logo: school.logo,
    customLogo: school.customLogo
  });
}
function buildReplayClipData(r, d, p, extra = {}) {
  const play = watchClone(p);
  const drive = watchClone(__spreadProps(__spreadValues({}, d || {}), { plays: [play] }));
  const game = {
    drives: [drive],
    homeSchool: watchSchoolSnapshot(r == null ? void 0 : r.homeSchool, "HOME"),
    awaySchool: watchSchoolSnapshot(r == null ? void 0 : r.awaySchool, "AWAY"),
    homeScore: Number.isFinite(r == null ? void 0 : r.homeScore) ? r.homeScore : (d == null ? void 0 : d.possession) === "away" ? p.scoreDef || 0 : p.scoreOff || 0,
    awayScore: Number.isFinite(r == null ? void 0 : r.awayScore) ? r.awayScore : (d == null ? void 0 : d.possession) === "away" ? p.scoreOff || 0 : p.scoreDef || 0,
    playerNames: watchClone((r == null ? void 0 : r.playerNames) || {}),
    viewerBoard: extra.board ? watchClone(extra.board) : (r == null ? void 0 : r.viewerBoard) ? watchClone(r.viewerBoard) : null
  };
  return {
    kind: "blueprint-viewer-replay",
    version: 2,
    game,
    driveIndex: Number.isFinite(extra.driveIndex) ? extra.driveIndex : 0,
    playIndex: Number.isFinite(extra.playIndex) ? extra.playIndex : 0,
    camera: normalizeWatchCamera(extra.camera),
    annotations: Array.isArray(extra.annotations) ? watchClone(extra.annotations) : [],
    capturedAt: Date.now()
  };
}
function buildHighlightReelData(r) {
  let rows = [];
  try { rows = gameHighlights(r, r.homeSchool, r.awaySchool, 3); } catch (e) { rows = []; }
  if (!rows.length) return null;
  const drives = [];
  for (const h of rows) {
    const d = r.drives && r.drives[h.driveIndex];
    const p = d && d.plays && d.plays[h.playIndex];
    if (d && p) drives.push(watchClone(__spreadProps(__spreadValues({}, d), { plays: [p] })));
  }
  if (!drives.length) return null;
  return {
    kind: "blueprint-viewer-replay",
    version: 2,
    reel: true,
    game: {
      drives,
      homeSchool: watchSchoolSnapshot(r.homeSchool, "HOME"),
      awaySchool: watchSchoolSnapshot(r.awaySchool, "AWAY"),
      homeScore: r.homeScore || 0,
      awayScore: r.awayScore || 0,
      playerNames: watchClone(r.playerNames || {})
    },
    camera: "broadcast",
    annotations: [],
    capturedAt: Date.now()
  };
}
function replayClipParts(data) {
  if (!data || data.kind !== "blueprint-viewer-replay" || !data.game || !Array.isArray(data.game.drives)) return null;
  const d = data.game.drives[0];
  const p = d && Array.isArray(d.plays) ? d.plays[0] : null;
  return d && p ? { r: data.game, d, p } : null;
}
function openReplayClip(data) {
  if (!replayClipParts(data)) {
    notify("That replay clip is not compatible with this viewer", "warning");
    return false;
  }
  state.ui.replayClip = watchClone(data);
  state.ui.replayReturn = state.ui.view === "creator" ? "filmroom" : "back";
  navigate("replayclip");
  return true;
}
function openResultHighlight(r, di, pi) {
  const d = r && r.drives && r.drives[di];
  const p = d && d.plays && d.plays[pi];
  if (!p) return false;
  return openReplayClip(buildReplayClipData(r, d, p, { driveIndex: di, playIndex: pi }));
}
function openResultHighlightReel(r) {
  const data = buildHighlightReelData(r);
  if (!data) {
    notify("No replay-worthy moments were recorded", "info");
    return false;
  }
  return openReplayClip(data);
}
function renderReplayClipScreen() {
  const parts = replayClipParts(state.ui.replayClip);
  if (!parts) return `<div class="replay-screen"><button class="btn-ghost" id="replay-screen-back">← Back</button><div class="empty-state">This clip could not be loaded.</div></div>`;
  const c = buildBroadcastCommentary(parts.p, parts.r.playerNames || {});
  return `<div class="replay-screen">
    <div class="replay-screen-head">
      <button class="btn-ghost" id="replay-screen-back">← ${state.ui.replayReturn === "filmroom" ? "Film Room" : "Back"}</button>
      <div><div class="replay-screen-kicker">ACT B REPLAY LAB</div><h1>${escapeHtml(c.title)}</h1></div>
    </div>
    <div id="watch-root" class="watch-root replay-watch-root"></div>
  </div>`;
}
function setupReplayClipScreen() {
  const back = document.getElementById("replay-screen-back");
  if (back) back.addEventListener("click", () => {
    if (state.ui.replayReturn === "filmroom") state.ui.creatorTab = "replays";
    navigateBack();
  });
  const parts = replayClipParts(state.ui.replayClip);
  if (!parts) return;
  initWatchMode(parts.r, parts.d.possession === "home", { key: state.ui.replayClip, clip: state.ui.replayClip });
}
// ── THE TEST BENCH (M1, 2026-08-17) — a PLAY-DESIGN instrument ─────────────
// One screen: run ONE play between the bench's even scratch teams against a
// forced defensive look, watch it on the REAL board (the clip path — zero new
// viewer wiring), and rep it: RUN AGAIN rolls fresh, SAME ROLL AGAIN replays
// the pinned seed byte-identically. Reps live HERE (module state), never in
// state.ui — a bench session can never leak into a save. Owner boundary:
// play design only — no scouting hooks, no opponent practice, no lessons.
var _bench = null;
function _benchState() {
  const cfg = state.ui.bench;
  if (!cfg) return null;
  if (!_bench || _bench.cfg !== cfg) _bench = { cfg, reps: [], lastSeed: null, n: 0 };
  return _bench;
}
function renderBenchScreen() {
  const b = _benchState();
  if (!b) return `<div class="replay-screen bench-screen"><button class="btn-ghost" id="bench-back">← Back</button><div class="empty-state">Nothing on the bench. Open it from the Workshop — the Composer, the Formation Designer, or a Playbook Builder card.</div></div>`;
  const cfg = b.cfg;
  const fid = aliasFormation(cfg.formationId);
  const vset = FORMATION_VARIATIONS[fid] || {};
  const vLabel = cfg.variation && vset[cfg.variation] ? vset[cfg.variation].label : null;
  const fits = fittingConceptsForFormation(fid, cfg.variation || undefined);
  const hasCustom = !!cfg.customPlayData;
  const playOpts = [
    ...(hasCustom ? [`<option value="__custom"${!cfg.concept ? " selected" : ""}>★ ${escapeHtml(cfg.label || "Your play")} (composed)</option>`] : []),
    ...(cfg.concept && !fits.includes(cfg.concept) ? [`<option value="${escapeHtml(cfg.concept)}" selected>${escapeHtml(cfg.concept)}</option>`] : []),
    ...fits.map((c) => `<option value="${escapeHtml(c)}"${cfg.concept === c ? " selected" : ""}>${escapeHtml(c)}</option>`)
  ].join("");
  const opts = benchLookOptions();
  const dl = cfg.defLook || (cfg.defLook = { front: "4-3", coverage: "c3", bring: "4" });
  const log = b.reps.length ? b.reps.map((rep) => `<div class="bench-line${rep.real ? "" : " bench-line-flag"}">
      <span class="bench-line-n">#${rep.n}</span>
      <span class="bench-line-call">${escapeHtml(rep.call)}</span>
      <span class="muted">vs ${escapeHtml(rep.look)} · rolled ${escapeHtml(rep.rolled || "—")} →</span>
      <span class="bench-line-out">${escapeHtml(rep.outcome)}</span>
    </div>`).join("") : `<div class="muted bench-line-empty">No reps yet — run the play.</div>`;
  return `<div class="replay-screen bench-screen">
    <div class="replay-screen-head">
      <button class="btn-ghost" id="bench-back">${state.ui.benchReturn === "gameplan" ? "← Game Plan" : "← Workshop"}</button>
      <div><div class="replay-screen-kicker">THE TEST BENCH</div><h1>${escapeHtml(fid)}${vLabel ? ` · ${escapeHtml(vLabel)}` : ""}</h1></div>
    </div>
    <div class="bench-controls">
      <label class="bench-ctl"><span>Play</span><select class="form-input" id="bench-play">${playOpts}</select></label>
      <label class="bench-ctl"><span>Front</span><select class="form-input" id="bench-front">${opts.fronts.map((f) => `<option value="${escapeHtml(f)}"${dl.front === f ? " selected" : ""}>${escapeHtml(f)}</option>`).join("")}</select></label>
      <label class="bench-ctl"><span>Coverage</span><select class="form-input" id="bench-cov">${opts.coverages.map((c) => `<option value="${c.id}"${dl.coverage === c.id ? " selected" : ""}>${escapeHtml(c.label)}</option>`).join("")}</select></label>
      <label class="bench-ctl"><span>Pressure</span><select class="form-input" id="bench-bring">${opts.brings.map((x) => `<option value="${x.id}"${dl.bring === x.id ? " selected" : ""}>${escapeHtml(x.label)}</option>`).join("")}</select></label>
      <div class="bench-btns">
        <button class="btn-mm btn-mm-new" id="bench-run">▶ ${b.reps.length ? "Run again" : "Run the play"}</button>
        <button class="btn-mm btn-mm-secondary" id="bench-same"${b.lastSeed == null ? " disabled" : ""} title="Replay the exact same roll">⟲ Same roll again</button>
      </div>
    </div>
    <div class="bench-log">${log}</div>
    <div id="watch-root" class="watch-root replay-watch-root"></div>
  </div>`;
}
function setupBenchScreen() {
  var _a, _b, _c, _d, _e, _f, _g;
  const b = _benchState();
  // M5 (#39): a bench opened from the in-career embedded editor returns to the
  // Game Plan, not the Workshop (state.ui.benchReturn set by the entrances).
  (_a = document.getElementById("bench-back")) == null ? void 0 : _a.addEventListener("click", () => navigate(state.ui.benchReturn || "creator"));
  if (!b) return;
  const cfg = b.cfg;
  (_b = document.getElementById("bench-play")) == null ? void 0 : _b.addEventListener("change", (e) => {
    cfg.concept = e.target.value === "__custom" ? null : e.target.value;
    rerender();
  });
  (_c = document.getElementById("bench-front")) == null ? void 0 : _c.addEventListener("change", (e) => { cfg.defLook.front = e.target.value; });
  (_d = document.getElementById("bench-cov")) == null ? void 0 : _d.addEventListener("change", (e) => { cfg.defLook.coverage = e.target.value; });
  (_e = document.getElementById("bench-bring")) == null ? void 0 : _e.addEventListener("change", (e) => { cfg.defLook.bring = e.target.value; });
  const opts = benchLookOptions();
  const run = (seed) => {
    const useCustom = cfg.customPlayData && !cfg.concept;
    const r = benchSnap({
      formationId: aliasFormation(cfg.formationId),
      variation: cfg.variation || null,
      concept: useCustom ? null : cfg.concept,
      customPlayId: useCustom ? cfg.customPlayId || "_bench" : null,
      customPlayData: useCustom ? cfg.customPlayData : null,
      defLook: { ...cfg.defLook },
      seed
    });
    if (!r.ok) { notify(r.error || "The bench could not run that play", "warning"); return; }
    b.lastSeed = r.seed;
    b.n = (b.n || 0) + 1;
    const covL = ((opts.coverages.find((c) => c.id === cfg.defLook.coverage) || {}).label) || cfg.defLook.coverage;
    const bringL = ((opts.brings.find((x) => x.id === cfg.defLook.bring) || {}).label) || cfg.defLook.bring;
    b.reps.unshift({
      n: b.n, real: r.real, play: r.play, seed: r.seed,
      call: useCustom ? `★ ${cfg.label || "Your play"}` : cfg.concept || "sheet",
      look: `${cfg.defLook.front} · ${covL} · ${bringL}`,
      rolled: r.rolled, outcome: benchOutcome(r.play)
    });
    if (b.reps.length > 12) b.reps.length = 12; // a bench, not an archive
    rerender();
  };
  (_f = document.getElementById("bench-run")) == null ? void 0 : _f.addEventListener("click", () => run((Math.random() * 4294967296) >>> 0));
  (_g = document.getElementById("bench-same")) == null ? void 0 : _g.addEventListener("click", () => { if (b.lastSeed != null) run(b.lastSeed); });
  // The latest REAL rep rides the real board through the clip path.
  const latest = b.reps.find((rep) => rep.real && rep.play);
  if (latest) {
    const shell = benchGameShell(latest.play);
    const clip = buildReplayClipData(shell, shell.drives[0], latest.play, { driveIndex: 0, playIndex: 0 });
    initWatchMode(clip.game, true, { key: latest, clip });
  }
}
function renderApp() {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const _scroll = captureScroll();
  const _viewChanged = state.ui.view !== lastRenderedView;
  setPenaltyScale(((_b = (_a = state.settings) == null ? void 0 : _a.penaltyRate) != null ? _b : 90) / 100);
  const _pSchool = state._instantClassicReplay ? resultViewerSchool(state.ui.lastGameResult) : getPlayerSchool();
  applyTeamColors(_pSchool);
  document.body.classList.toggle(
    "theme-school",
    ((_c = state.settings) == null ? void 0 : _c.darkMode) !== true && !!((_d = _pSchool == null ? void 0 : _pSchool.colors) == null ? void 0 : _d[0])
  );
  const root = document.getElementById("app");
  const view = state.ui.view;
  if (view === "mainmenu") {
    root.innerHTML = renderMainMenu();
    import('./views/mainmenu.js').then((m) => {
      var _a2;
      return (_a2 = m.setupListeners) == null ? void 0 : _a2.call(m);
    });
    syncOverlayInert(); lastRenderedView = view;
    return;
  }
  if (view === "manual" && (!state.initialized || state.ui.manualFromMenu)) {
    root.innerHTML = `<div class="newgame-wrapper">
      <div class="manual-pregame-bar"><button class="btn-ghost btn-sm" id="btn-manual-to-menu">\u2190 Main Menu</button></div>
      ${renderManual()}
    </div>`;
    setupListeners12();
    (_e = document.getElementById("btn-manual-to-menu")) == null ? void 0 : _e.addEventListener("click", () => navigate("mainmenu"));
    syncOverlayInert(); lastRenderedView = view;
    return;
  }
  if (view === "playnow") {
    root.innerHTML = `<div class="newgame-wrapper playnow-wrapper">${state.ui.showHalftime && state.pendingHalftime ? renderHalftimeTakeover() : renderPlayNow()}</div>` + renderNotification() + renderLiveWatchOverlay() + renderGameResultModal() + renderCallSheetModal() + renderTimeoutAdjustOverlay() + renderFourthDownModal() + renderPlayerCardModal() + renderContextHelp() + renderTipPopover();
    playnowListeners();
    setupGlobalListeners();
    syncOverlayInert(); lastRenderedView = view;
    return;
  }
  if (view === "creator") {
    root.innerHTML = `<div class="newgame-wrapper creator-screen">${renderCreator()}</div>` + renderNotification();
    creatorListeners();
    setupGlobalListeners();
    syncOverlayInert(); lastRenderedView = view;
    return;
  }
  if (view === "seasonmode") {
    root.innerHTML = `<div class="newgame-wrapper creator-screen">${renderSeasonMode()}</div>` + renderNotification();
    seasonModeListeners();
    setupGlobalListeners();
    syncOverlayInert(); lastRenderedView = view;
    return;
  }
  if (view === "classicreplay") {
    const classic = state._instantClassicReplay;
    root.innerHTML = '<div class="instant-classic-replay-shell"><div class="instant-classic-replay-mark">\u2605 INSTANT CLASSIC ' + ((classic == null ? void 0 : classic.score) || "") + "</div></div>" + renderGameResultModal();
    setupGlobalListeners();
    syncOverlayInert(); lastRenderedView = view;
    return;
  }
  if (view === "replayclip") {
    root.innerHTML = renderReplayClipScreen() + renderNotification();
    setupReplayClipScreen();
    syncOverlayInert(); lastRenderedView = view;
    return;
  }
  if (view === "bench") {
    root.innerHTML = renderBenchScreen() + renderNotification();
    setupBenchScreen();
    syncOverlayInert(); lastRenderedView = view;
    return;
  }
  if (view === "newgame" || !state.initialized) {
    root.innerHTML = `<div class="newgame-wrapper">${renderNewGame()}</div>`;
    setupListeners3();
    syncOverlayInert(); lastRenderedView = view;
    return;
  }
  const school = getPlayerSchool();
  const phase = getPhaseLabel();
  const week = getWeekShort();
  const unread = state.inbox.filter((m) => !m.read).length;
  const coach = state.playerCoach;
  root.innerHTML = `
  <div class="app-layout">
    <header class="mobile-topbar">
      ${(() => {
    const canBack = !!state.ui.pcardId || !!state.ui.showInbox || state.ui.view === "recruiting" && recruitingCanBack() || (state.ui.navHistory || []).length > 0;
    return `<button class="sidebar-toggle topbar-back${canBack ? "" : " back-disabled"}"
                        id="btn-back-top" title="Back" aria-label="Back" ${canBack ? "" : "disabled"}>\u2190</button>`;
  })()}
      <span class="topbar-crest">${school ? renderCrest(school, 26) : "\u2B21"}</span>
      ${(() => {
    const sw = teamSwitchModel();
    const inner = `<span class="topbar-nick">${school ? escapeHtml(school.nick || school.name || "BLUEPRINT").toUpperCase() : "BLUEPRINT"}</span>${sw.show ? '<span class="topbar-caret">\u25BE</span>' : ""}
        <span class="topbar-meta">S${state.season} \xB7 ${escapeHtml(week)} \xB7 ${escapeHtml(phase)}</span>`;
    return sw.show
      ? `<button class="topbar-id topbar-id-btn" id="btn-team-switch" aria-label="Switch chairs" aria-haspopup="dialog">${inner}</button>`
      : `<div class="topbar-id">${inner}</div>`;
  })()}
      <button class="btn-icon topbar-inbox" id="btn-inbox-top" title="Inbox" aria-label="Inbox${unread > 0 ? `, ${unread} unread` : ""}">\u2709${unread > 0 ? `<span class="inbox-dot">${unread}</span>` : ""}</button>
    </header>
    <nav class="sidebar${state.ui.sidebarOpen ? " open" : ""}">
      ${(() => {
    const sw = teamSwitchModel();
    const inner = `<span class="brand-icon">${school ? renderCrest(school, 24) : "\u2B21"}</span>
        <span class="brand-text">${school ? escapeHtml(school.nick || school.name || "BLUEPRINT").toUpperCase() : "BLUEPRINT"}</span>${sw.show ? '<span class="topbar-caret">\u25BE</span>' : ""}`;
    return sw.show
      ? `<button class="sidebar-brand sidebar-brand-btn" id="btn-team-switch-side" aria-label="Switch chairs" aria-haspopup="dialog">${inner}</button>`
      : `<div class="sidebar-brand">${inner}</div>`;
  })()}
      ${school ? '<div class="team-stripe"><span></span><span></span><span></span></div>' : ""}
      <div class="season-badge">
        <span class="season-label">S${state.season} \xB7 ${escapeHtml(week)}</span>
        <span class="phase-label">${escapeHtml(phase)}</span>
      </div>
      <ul class="nav-list">
        ${navItemsFor().map((item) => `
          <li class="nav-item${view === item.id ? " active" : ""}" data-nav="${item.navTo || item.id}" role="button" tabindex="0" aria-label="${escapeHtml(item.label)}"${view === item.id ? ' aria-current="page"' : ""}>
            <span class="nav-icon">${item.icon}</span>
            <span class="nav-label">${item.label}</span>
            ${(() => {
    var _a2;
    if (item.id !== "recruiting") return "";
    const active = (((_a2 = state.playerCoach) == null ? void 0 : _a2.recruitBoard) || []).filter((e) => {
      var _a3, _b2;
      const r = (_b2 = (_a3 = state.world) == null ? void 0 : _a3.recruits) == null ? void 0 : _b2.find((x) => x.id === e.recruitId);
      return r && !r.committed;
    }).length;
    return active > 0 ? `<span class="nav-badge">${active}</span>` : "";
  })()}
          </li>
        `).join("")}
      </ul>
      <div class="sidebar-footer">
        <div class="coach-info">
          <div class="coach-school">${escapeHtml((school == null ? void 0 : school.name) || "")}</div>
          <div class="coach-meta">
            <span class="rep-badge">${escapeHtml((coach == null ? void 0 : coach.reputation) || "C")}</span>
            ${renderPrestige((_g = (_f = school == null ? void 0 : school.prestige) != null ? _f : coach == null ? void 0 : coach.prestige) != null ? _g : 3, ((_h = C.PRESTIGE_MAX) == null ? void 0 : _h[school == null ? void 0 : school.division]) || 5)}
          </div>
        </div>
        ${state.seasonMode ? "" : `<div class="budget-info">
          <div class="budget-row">
            <span class="budget-label">Budget</span>
            <span class="budget-value">$${(((coach == null ? void 0 : coach.budget) || 0) / 1e3).toFixed(1)}k</span>
          </div>
          <div class="budget-row">
            <span class="budget-label">${tipTerm("scholarship", "Scholarships")}</span>
            <span class="budget-value">${(coach == null ? void 0 : coach.scholarshipsAvailable) || 0}</span>
          </div>
        </div>`}
        <div class="sidebar-actions">
          <button class="btn-icon" id="btn-inbox" title="Inbox" aria-label="Inbox${unread > 0 ? `, ${unread} unread` : ""}">
            \u2709${unread > 0 ? `<span class="inbox-dot">${unread}</span>` : ""}
          </button>
          ${state.seasonMode ? "" : '<button class="btn-icon" id="btn-save" title="Save Game" aria-label="Save Game">\u{1F4BE}</button>'}
          <button class="btn-icon" id="btn-main-menu" title="${state.seasonMode ? "Exit Season" : "Main Menu"}" aria-label="${state.seasonMode ? "Exit Season" : "Main Menu"}">\u2302</button>
        </div>
      </div>
    </nav>
    ${state.ui.sidebarOpen ? '<div class="sidebar-backdrop" id="sidebar-backdrop"></div>' : ""}
    <main class="main-content">
      <div id="view-root">
        ${state.ui.showHalftime && state.pendingHalftime ? renderHalftimeTakeover() : (VIEWS[view] || renderDashboard)()}
      </div>
    </main>
    <nav class="tabbar">
      ${tabbarItemsFor().map((t) => `
        <button class="tabbar-item${view === t.id ? " active" : ""}" data-nav="${t.navTo || t.id}">
          <span class="tabbar-icon">${t.icon}</span>
          <span class="tabbar-label">${t.label}</span>
        </button>`).join("")}
      <button class="tabbar-item${state.ui.sidebarOpen ? " active" : ""}" id="tab-more">
        <span class="tabbar-icon">\u2630</span>
        <span class="tabbar-label">More</span>
      </button>
    </nav>
  </div>
  ${renderNotification()}
  ${renderSeasonCompleteOverlay()}
  ${renderInboxModal()}
  ${renderLiveWatchOverlay()}
  ${renderGameResultModal()}
  ${renderSaveModal()}
  ${renderTeamSwitchSheet()}
  ${renderPlayerCardModal()}
  ${renderKickoffModal()}
  ${renderCallSheetModal()}
  ${renderTimeoutAdjustOverlay()}
  ${renderFourthDownModal()}
  ${renderContextHelp()}
  ${renderTipPopover()}
`;
  setupGlobalListeners();
  if (!(state.ui.showHalftime && state.pendingHalftime)) setupViewListeners(view);
  if (!(state.ui.showHalftime && state.pendingHalftime)) injectHelpButton(view);
  installPhoneDialGuards();
  restoreScroll(_scroll, _viewChanged);
  syncOverlayInert(); lastRenderedView = view;
}
// [PLAYTEST 2026-08-12 item 22] THE CHAIR SWITCHER.
// "Switch teams" is two different features. Changing jobs is hard-gated to the
// offseason and correctly so — acceptJob wipes the board, scouting and retention
// stacks. Switching which of YOUR coaches you are (activateSlot) is legal any
// time and is free, and it was buried four taps deep on the Coach's Office
// program tab — whose own comment calls it "who you can BE right now… in the
// order they matter". The school name is now the control, on both layouts.
function teamSwitchModel() {
  let slots = null;
  try {
    if (isTreeGame(state)) {
      const snap = treeSnapshot(state);
      slots = ((snap == null ? void 0 : snap.slots) || []).filter((sl) => !sl.empty);
    }
  } catch (e) {
    slots = null;
  }
  const offers = (state.pendingOffers || []).length;
  const live = slots && slots.length > 1;
  return { slots: slots || [], offers, show: !!(live || offers) };
}
function renderTeamSwitchSheet() {
  if (!state.ui.showTeamSwitch) return "";
  const m = teamSwitchModel();
  if (!m.show) return "";
  const rows = m.slots.map((sl) => `
    <button class="ts-row${sl.active ? " ts-row-active" : ""}" data-ts-slot="${escapeHtml(sl.division)}"${sl.active ? " disabled" : ""}>
      <span class="ts-div">${escapeHtml(sl.division)}</span>
      <span class="ts-body">
        <span class="ts-school">${escapeHtml(sl.schoolName || "—")}</span>
        <span class="ts-coach muted">${escapeHtml(sl.name || "Coach")}${sl.record ? ` · ${sl.record.wins}–${sl.record.losses}` : ""}</span>
      </span>
      <span class="ts-tag">${sl.active ? "YOU" : "Coach him"}</span>
    </button>`).join("");
  const offerRow = m.offers ? `
    <button class="ts-row" data-ts-offers="1">
      <span class="ts-div">\u2709</span>
      <span class="ts-body"><span class="ts-school">${m.offers} job offer${m.offers !== 1 ? "s" : ""} on the table</span>
        <span class="ts-coach muted">Sign at Contract &amp; Signing Day</span></span>
      <span class="ts-tag">Open</span>
    </button>` : "";
  return `
  <div class="modal-overlay ts-overlay" data-ts-close="bg">
    <div class="modal ts-sheet">
      <div class="modal-header"><h2>Your chairs</h2></div>
      <div class="ts-list">${rows}${offerRow}</div>
      <p class="offseason-hint" style="padding:0 16px 12px">Switching chairs is free and instant — the clock is shared, so nothing moves in the world when you do it. Changing JOBS happens in the offseason.</p>
      <div class="modal-footer" style="padding:0 16px 14px"><button class="btn-ghost" data-ts-close="btn" style="width:100%">Close</button></div>
    </div>
  </div>`;
}
function renderPrestige(p, max = 6) {
  const filled = Math.max(0, Math.min(Math.round(p || 0), max));
  return `<span class="prestige-stars">${"\u2605".repeat(filled)}${"\u2606".repeat(Math.max(0, max - filled))}</span>`;
}
function renderNotification() {
  const n = state.ui.notification;
  if (!n) return "";
  return `<div class="notification notification-${n.type}">${escapeHtml(n.text)}</div>`;
}
var _toastEl = null;
var _toastTimer = null;
function patchToast(text, type = "info", duration = 3500) {
  if (!_toastEl) {
    _toastEl = document.createElement("div");
    _toastEl.id = "toast-layer";
    document.body.appendChild(_toastEl);
  }
  _toastEl.innerHTML = `<div class="notification notification-${type}">${escapeHtml(text)}</div>`;
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    if (_toastEl) _toastEl.innerHTML = "";
    _toastTimer = null;
  }, duration);
}
function renderInboxModal() {
  if (!state.ui.showInbox) return "";
  return `
  <div class="modal-overlay" id="inbox-overlay">
    <div class="modal inbox-modal">
      <div class="modal-header">
        <h2>Inbox</h2>
        <button class="modal-close" id="close-inbox" aria-label="Close inbox">\u2715</button>
      </div>
      <div class="inbox-list">
        ${state.inbox.length === 0 ? '<p class="empty-state">No messages</p>' : state.inbox.map((m) => `
            <div class="inbox-msg${m.read ? "" : " unread"}">
              <div class="msg-subject">${escapeHtml(m.subject)}</div>
              <div class="msg-day">${escapeHtml(weekShort(m.day))}</div>
              <div class="msg-body">${escapeHtml(m.body)}</div>
            </div>
          `).join("")}
      </div>
    </div>
  </div>
`;
}
function renderGameResultModal() {
  var _a, _b, _c;
  const r = state.ui.lastGameResult;
  if (!r || !state.ui.showGameResult) return "";
  const school = resultViewerSchool(r);
  const isHome = ((_a = r.homeSchool) == null ? void 0 : _a.id) === (school == null ? void 0 : school.id);
  const myScore = isHome ? r.homeScore : r.awayScore;
  const oppScore = isHome ? r.awayScore : r.homeScore;
  const opp = isHome ? r.awaySchool : r.homeSchool;
  const won = myScore > oppScore;
  const tab = state.ui.gameResultTab || "boxscore";
  const isClassic = !!state._instantClassicReplay;
  const resultTitle = isClassic ? "INSTANT CLASSIC \xB7 " + (state._instantClassicReplay.score || 0) : won ? "VICTORY" : "DEFEAT";
  const resultTitleClass = isClassic ? "classic-text" : won ? "win-text" : "loss-text";
  const continueLabel = isClassic ? "Back to Coach Select" : "Continue \u2192";
  const watchLiveOption = isClassic ? "" : '<label class="watch-live-opt"><input type="checkbox" id="watch-live-toggle" ' + (((_b = state.settings) == null ? void 0 : _b.liveWatch) !== false ? "checked" : "") + "/> Watch my games LIVE (first half \u2192 locker room \u2192 second half \u2192 final)</label>";
  return `
  <div class="modal-overlay" id="game-result-overlay">
    <div class="modal game-result-modal${tab === "watch" ? " watch-desktop-modal" : ""}">
      <div class="modal-header">
        <h2 class="${resultTitleClass}">${escapeHtml(resultTitle)}</h2>
        <button class="modal-close" id="close-game-result" aria-label="Close game result">\u2715</button>
      </div>
      <div class="score-display">
        <div class="score-team">
          <div class="score-name">${escapeHtml((school == null ? void 0 : school.name) || "")}</div>
          <div class="score-num ${won ? "win-score" : "loss-score"}">${myScore}</div>
        </div>
        <div class="score-vs">\u2013</div>
        <div class="score-team">
          <div class="score-name">${escapeHtml(((_c = isHome ? r.awaySchool : r.homeSchool) == null ? void 0 : _c.name) || "")}</div>
          <div class="score-num ${!won ? "win-score" : "loss-score"}">${oppScore}</div>
        </div>
      </div>

      <div class="result-tabs">
        <button class="result-tab${tab === "boxscore" ? " active" : ""}" data-result-tab="boxscore">Box Score</button>
        <button class="result-tab${tab === "pbp" ? " active" : ""}" data-result-tab="pbp">Play-by-Play</button>
        <button class="result-tab${tab === "watch" ? " active" : ""}" data-result-tab="watch">\u25B6 Watch</button>
        <button class="result-tab${tab === "plan" ? " active" : ""}" data-result-tab="plan">Plan Report</button>
      </div>

      <div class="result-tab-body">
        ${tab === "pbp" ? renderPlayByPlay(r, isHome) : tab === "watch" ? `${watchLiveOption}<div id="watch-root" class="watch-root"></div>` : tab === "plan" ? renderPlanReport(r, isHome, school) : renderBoxScoreTab(r, school, isHome)}
      </div>

      <button class="btn-primary" style="margin:0 20px 16px;width:calc(100% - 40px)" id="close-game-result-btn">${escapeHtml(continueLabel)}</button>
    </div>
  </div>
`;
}
function renderHalftimeTakeover() {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
  if (!state.ui.showHalftime || !state.pendingHalftime) return "";
  const { token, home, away } = state.pendingHalftime;
  const school = getPlayerSchool();
  const isHome = home.id === (school == null ? void 0 : school.id);
  const gp = isHome ? token.homeGP : token.awayGP;
  const myScore = isHome ? token.homeScore : token.awayScore;
  const oppScore = isHome ? token.awayScore : token.homeScore;
  const opp = isHome ? away : home;
  const VALID_TABS = ["adjust", "situations", "boxscore"];
  const tab = VALID_TABS.includes(state.ui.halftimeTab) ? state.ui.halftimeTab : "adjust";
  const accent = ((_a = school == null ? void 0 : school.colors) == null ? void 0 : _a[0]) || "var(--green)";
  if (!gp.offFormations || !gp.offFormations.length) {
    gp.offFormations = [{ id: gp.offFormation || "Single Back", weight: 100 }];
  }
  if (!gp.situations) gp.situations = {};
  const mid = midGameReport(token);
  const r = {
    homeSchool: home,
    awaySchool: away,
    homeStats: token.homeStats,
    awayStats: token.awayStats,
    homePlayerStats: mid.homePlayerStats,
    awayPlayerStats: mid.awayPlayerStats,
    playerNames: mid.playerNames,
    drives: token.drives
  };
  const oppGP = isHome ? token.awayGP : token.homeGP;
  const oppForms = (oppGP.offFormations || []).slice().sort((a, b) => (b.weight || 0) - (a.weight || 0));
  const topForm = ((_b = oppForms[0]) == null ? void 0 : _b.id) || "Single Back";
  const oppPS = isHome ? mid.awayPlayerStats : mid.homePlayerStats;
  let hotId = null, hotYds = 0, hotName = "their top target";
  for (const pid in oppPS || {}) {
    const yds = oppPS[pid].recYds || 0;
    if (yds > hotYds) {
      hotYds = yds;
      hotId = pid;
      const e = (_c = mid.playerNames) == null ? void 0 : _c[pid];
      hotName = (typeof e === "string" ? e : e == null ? void 0 : e.name) || "their top target";
    }
  }
  const picked = ((_d = state.pendingHalftime.adjustment) == null ? void 0 : _d.kind) || null;
  const adjCard = (kind, icon, title, desc, extra) => `
  <button class="ht-adj-card${picked === kind ? " active" : ""}" data-ht-adj="${kind}" ${extra || ""}>
    <span class="ht-adj-icon">${icon}</span>
    <span class="ht-adj-title">${title}</span>
    <span class="ht-adj-desc">${desc}</span>
  </button>`;
  const adjustmentsBlock = `
  <div class="ht-adjustments">
    <div class="ht-adj-label">HALFTIME ADJUSTMENT \u2014 pick one (or none)</div>
    <div class="ht-adj-row">
      ${adjCard("offlean", "\u2694\uFE0F", "Lean offensive", "Tip the team toward offense in H2 \u2014 win the line, run it better, buy the passer time")}
      ${adjCard("deflean", "\u{1F6E1}", "Lean defensive", "Tip the team toward defense in H2 \u2014 win the front, get after the passer, stuff the run")}
      ${adjCard("fresh", "\u{1F50B}", "Fresh legs", "A conditioning push \u2014 your team wears down slower the rest of the game")}
      ${adjCard("protect", "\u{1F9F1}", "Protect the QB", "Extra bodies stay in and chip the rushers \u2014 fewer sacks and hits the rest of the way")}
      ${hotId ? adjCard("shadow", "\u{1F576}", `Shadow ${escapeHtml(hotName)}`, `Bracket their hot hand every snap of H2 \u2014 ${escapeHtml(hotName)} (${hotYds} yds so far) sees a cloud`, `data-ht-adj-id="${escapeHtml(String(hotId))}" data-ht-adj-name="${escapeHtml(hotName)}"`) : ""}
    </div>
  </div>`;
  const margin = myScore - oppScore;
  const subLine = margin > 0 ? `You lead by ${margin}. Decide how to close this out.` : margin < 0 ? `Down ${-margin}. One half left \u2014 change what isn't working.` : "All square. The adjustments win it from here.";
  const tabs = [
    ["adjust", "Adjustments"],
    ["situations", "Situations"],
    ["boxscore", "Box Score"]
  ];
  return `
  <div class="view-dashboard event-takeover" id="halftime-screen">
    <div class="view-header">
      <div>
        <h1 class="view-title">
          <span class="dash-crest">${renderCrest(school, 34)}</span>
          ${escapeHtml((school == null ? void 0 : school.name) || "")} <span class="title-nick" style="color:${accent}">${escapeHtml((school == null ? void 0 : school.nick) || "")}</span>
        </h1>
        <div class="view-subtitle">Season ${state.season} &middot; ${escapeHtml(getWeekLabel())} &middot; Halftime${(() => {
    const cw = state.coachWeek;
    if (!cw || !((_i = state.pendingHalftime) == null ? void 0 : _i.coachWeek)) return "";
    const all = coachedGamesForDay(state, cw.day).length + (cw.results ? cw.results.length : 0);
    const done = (cw.results ? cw.results.length : 0);
    return all > 1 ? ` &middot; <span style="color:var(--gold)">Your programs \u2014 game ${done + 1} of ${all}</span>` : "";
  })()}</div>
      </div>
      <div class="ht-resume-controls">
        <button class="cm-switch cm-switch-sm${((_e = state.settings) == null ? void 0 : _e.liveWatch) !== false ? " on" : ""}" id="ht-coachmode" role="switch" aria-checked="${((_f = state.settings) == null ? void 0 : _f.liveWatch) !== false}">
          <span class="cm-track"><span class="cm-thumb"></span></span>
          <span class="cm-text"><span class="cm-name">\u25B6 Coach Mode</span><span class="cm-sub">${((_g = state.settings) == null ? void 0 : _g.liveWatch) !== false ? "Coach the 2nd half" : "Sim the 2nd half"}</span></span>
        </button>
        <button class="btn-advance" id="btn-resume-halftime">${((_h = state.settings) == null ? void 0 : _h.liveWatch) !== false ? "START 2ND HALF \u2192" : "\u23E9 SIM TO FINAL \u2192"}</button>
        ${state.coachWeek && ((_j = state.pendingHalftime) == null ? void 0 : _j.coachWeek) ? `<button class="btn-ghost btn-sm" id="btn-sim-coached" title="Let the sim finish this game and move to your next program">Let the sim handle this one \u2192</button>` : ""}
      </div>
    </div>

    <div class="event-screen">
      <div class="event-kicker">Halftime \xB7 ${isHome ? "vs" : "@"} ${escapeHtml((opp == null ? void 0 : opp.name) || "")}</div>
      <div class="score-display" style="padding:8px 0 0">
        <div class="score-team">
          <div class="score-name">${escapeHtml((school == null ? void 0 : school.name) || "")}</div>
          <div class="score-num">${myScore}</div>
        </div>
        <div class="score-vs">\u2013</div>
        <div class="score-team">
          <div class="score-name">${escapeHtml((opp == null ? void 0 : opp.name) || "")}</div>
          <div class="score-num">${oppScore}</div>
        </div>
      </div>
      <p class="event-sub" style="text-align:center;margin-bottom:12px">${escapeHtml(subLine)}</p>
      ${adjustmentsBlock}

      <div class="result-tabs">
        ${tabs.map(([id, label]) => `
          <button class="result-tab${tab === id ? " active" : ""}" data-halftime-tab="${id}">${label}</button>`).join("")}
      </div>

      <div class="halftime-body" style="padding:14px 0 0">
        ${tab === "situations" ? `<div class="ht-plan-report">${renderPlanReport(r, isHome, school, 2)}</div>${renderSituationsSection(gp, state.ui.halftimeOpenSitKey)}` : tab === "boxscore" ? renderBoxScoreTab(r, school, isHome) : renderHalftimeAdjust(gp)}
      </div>
    </div>
  </div>
`;
}
function renderBoxScoreTab(r, school, isHome) {
  var _a, _b;
  const opp = isHome ? r.awaySchool : r.homeSchool;
  const myStats = (isHome ? r.homeStats : r.awayStats) || {};
  const oppStats = (isHome ? r.awayStats : r.homeStats) || {};
  const myPS = isHome ? r.homePlayerStats : r.awayPlayerStats;
  const oppPS = isHome ? r.awayPlayerStats : r.homePlayerStats;
  const names = r.playerNames || {};
  const myTOs = (myStats.ints || 0) + (myStats.fumbles || 0);
  const oppTOs = (oppStats.ints || 0) + (oppStats.fumbles || 0);
  let reel = [];
  try {
    reel = gameHighlights(r, r.homeSchool, r.awaySchool, 3);
  } catch (e) {
    reel = [];
  }
  let ls = null;
  try {
    ls = linescore(r);
  } catch (e) {
    ls = null;
  }
  const lsMine = (c) => isHome ? c.home : c.away;
  const lsTheirs = (c) => isHome ? c.away : c.home;
  return `
  ${ls ? `
  <div class="box-score box-line">
    <div class="box-row header">
      <span></span>
      ${ls.cells.map((c) => `<span>${c.q === 5 ? "OT" : c.q}</span>`).join("")}
      <span>T</span>
    </div>
    <div class="box-row">
      <span>${escapeHtml(((_a = school == null ? void 0 : school.name) == null ? void 0 : _a.substring(0, 10)) || "")}</span>
      ${ls.cells.map((c) => `<span>${lsMine(c)}</span>`).join("")}
      <span><b>${isHome ? ls.homeTotal : ls.awayTotal}</b></span>
    </div>
    <div class="box-row">
      <span>${escapeHtml(((_b = opp == null ? void 0 : opp.name) == null ? void 0 : _b.substring(0, 10)) || "")}</span>
      ${ls.cells.map((c) => `<span>${lsTheirs(c)}</span>`).join("")}
      <span><b>${isHome ? ls.awayTotal : ls.homeTotal}</b></span>
    </div>
  </div>` : ""}
  ${reel.length ? `
  <div class="box-reel">
    <div class="box-reel-label">HIGHLIGHTS <button class="box-reel-play" data-watch-reel="1" title="Play the highlight reel">▶ Play Reel</button></div>
    ${reel.map((h) => `
      <button class="result-moment result-moment-replay${h.side === "home" === isHome ? " ours" : " theirs"}" data-watch-highlight="${h.driveIndex}:${h.playIndex}" title="Play this highlight">
        <span class="moment-when">${h.q === 5 ? "OT" : `Q${h.q}`} ${h.clock}</span>
        <span class="moment-text">${escapeHtml(h.text)}</span>
        <span class="moment-score">${escapeHtml(h.score)}</span>
        <span class="moment-play" aria-hidden="true">▶</span>
      </button>`).join("")}
  </div>` : ""}
  <div class="box-score">
    <div class="box-row header">
      <span></span>
      <span>${escapeHtml(((_a = school == null ? void 0 : school.name) == null ? void 0 : _a.substring(0, 10)) || "")}</span>
      <span>${escapeHtml(((_b = opp == null ? void 0 : opp.name) == null ? void 0 : _b.substring(0, 10)) || "")}</span>
    </div>
    <div class="box-row"><span>Rush Yds</span><span>${myStats.rushYds || 0}</span><span>${oppStats.rushYds || 0}</span></div>
    <div class="box-row"><span>Pass Yds</span><span>${myStats.passYds || 0}</span><span>${oppStats.passYds || 0}</span></div>
    <div class="box-row"><span>Total Yds</span><span>${myStats.totalYds || 0}</span><span>${oppStats.totalYds || 0}</span></div>
    <div class="box-row"><span>Sacks</span><span>${myStats.sacksAllowed || 0}</span><span>${oppStats.sacksAllowed || 0}</span></div>
    <div class="box-row"><span>Turnovers</span><span>${myTOs}</span><span>${oppTOs}</span></div>
  </div>

  <div class="player-stats-wrap">
    ${myPS ? renderTeamPlayerStats(myPS, names, school == null ? void 0 : school.name, true) : ""}
    ${oppPS ? renderTeamPlayerStats(oppPS, names, opp == null ? void 0 : opp.name, false) : ""}
  </div>
`;
}
function renderTeamPlayerStats(pStats, names, teamName, isMyTeam) {
  const passers = psRows(pStats, names, (s) => s.passAtt > 0, (a, b) => b.passAtt - a.passAtt);
  const rushers = psRows(pStats, names, (s) => s.rushAtt > 0, (a, b) => b.rushYds - a.rushYds);
  const receivers = psRows(pStats, names, (s) => s.recComp > 0, (a, b) => b.recYds - a.recYds);
  const sackers = psRows(pStats, names, (s) => s.sacks > 0, (a, b) => b.sacks - a.sacks);
  const pressurers = psRows(pStats, names, (s) => (s.pressures || 0) >= 3, (a, b) => (b.pressures || 0) - (a.pressures || 0));
  const breakers = psRows(pStats, names, (s) => (s.brokenTackles || 0) >= 2, (a, b) => (b.brokenTackles || 0) - (a.brokenTackles || 0));
  const contesteds = psRows(pStats, names, (s) => (s.contestedRec || 0) >= 2, (a, b) => (b.contestedRec || 0) - (a.contestedRec || 0));
  const inters = psRows(pStats, names, (s) => s.ints > 0, (a, b) => b.ints - a.ints);
  const hasOff = passers.length || rushers.length || receivers.length;
  const hasDef = sackers.length || pressurers.length || breakers.length || contesteds.length || inters.length;
  return `
  <div class="ps-team-block ${isMyTeam ? "ps-my-team" : ""}">
    <div class="ps-team-name">${escapeHtml(teamName || "")}</div>

    ${passers.length ? `
      <div class="ps-group">
        <div class="ps-cat-label">PASSING</div>
        <table class="ps-table">
          <thead><tr><th></th><th>C/A</th><th>YDS</th><th>TD</th><th>INT</th></tr></thead>
          <tbody>
            ${passers.map(({ id, name, s }) => `
              <tr>
                <td class="ps-name"><span class="player-link" data-pcard="${id}">${escapeHtml(name)}</span></td>
                <td>${s.passComp}/${s.passAtt}</td>
                <td>${s.passYds}</td>
                <td class="${s.passTD ? "ps-td" : ""}">${s.passTD}</td>
                <td class="${s.passInt ? "ps-bad" : ""}">${s.passInt}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>` : ""}

    ${rushers.length ? `
      <div class="ps-group">
        <div class="ps-cat-label">RUSHING</div>
        <table class="ps-table">
          <thead><tr><th></th><th>CAR</th><th>YDS</th><th>AVG</th><th>TD</th></tr></thead>
          <tbody>
            ${rushers.map(({ id, name, s }) => `
              <tr>
                <td class="ps-name"><span class="player-link" data-pcard="${id}">${escapeHtml(name)}</span></td>
                <td>${s.rushAtt}</td>
                <td>${s.rushYds}</td>
                <td class="ps-muted">${s.rushAtt ? (s.rushYds / s.rushAtt).toFixed(1) : "\u2014"}</td>
                <td class="${s.rushTD ? "ps-td" : ""}">${s.rushTD}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>` : ""}

    ${receivers.length ? `
      <div class="ps-group">
        <div class="ps-cat-label">RECEIVING</div>
        <table class="ps-table">
          <thead><tr><th></th><th>REC</th><th>YDS</th><th>AVG</th><th>TD</th></tr></thead>
          <tbody>
            ${receivers.map(({ id, name, s }) => `
              <tr>
                <td class="ps-name"><span class="player-link" data-pcard="${id}">${escapeHtml(name)}</span></td>
                <td>${s.recComp}</td>
                <td>${s.recYds}</td>
                <td class="ps-muted">${s.recComp ? (s.recYds / s.recComp).toFixed(1) : "\u2014"}</td>
                <td class="${s.recTD ? "ps-td" : ""}">${s.recTD}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>` : ""}

    ${hasDef ? `
      <div class="ps-group">
        <div class="ps-cat-label">DEFENSE</div>
        <div class="ps-def-lines">
          ${sackers.length ? `<div class="ps-def-line"><span class="ps-def-cat">Sacks</span> ${sackers.map(({ id, name, s }) => `<span class="player-link" data-pcard="${id}">${escapeHtml(name)}</span> ${s.sacks}`).join(", ")}</div>` : ""}
          ${pressurers.length ? `<div class="ps-def-line"><span class="ps-def-cat">Pressures</span> ${pressurers.slice(0, 3).map(({ id, name, s }) => `<span class="player-link" data-pcard="${id}">${escapeHtml(name)}</span> ${s.pressures}`).join(", ")}</div>` : ""}
          ${breakers.length ? `<div class="ps-def-line"><span class="ps-def-cat">Brk Tackles</span> ${breakers.slice(0, 3).map(({ id, name, s }) => `<span class="player-link" data-pcard="${id}">${escapeHtml(name)}</span> ${s.brokenTackles}`).join(", ")}</div>` : ""}
          ${contesteds.length ? `<div class="ps-def-line"><span class="ps-def-cat">Contested</span> ${contesteds.slice(0, 3).map(({ id, name, s }) => `<span class="player-link" data-pcard="${id}">${escapeHtml(name)}</span> ${s.contestedRec}/${s.contestedTgt || s.contestedRec}`).join(", ")}</div>` : ""}
          ${inters.length ? `<div class="ps-def-line"><span class="ps-def-cat">INTs</span>  ${inters.map(({ id, name, s }) => `<span class="player-link" data-pcard="${id}">${escapeHtml(name)}</span> ${s.ints}`).join(", ")}</div>` : ""}
        </div>
      </div>` : ""}

    ${!hasOff && !hasDef ? '<div class="ps-empty">No stats recorded</div>' : ""}
  </div>
`;
}
function psRows(pStats, names, filterFn, sortFn) {
  return Object.entries(pStats).filter(([, s]) => filterFn(s)).sort(([, a], [, b]) => sortFn(a, b)).map(([id, s]) => {
    const entry = names[id];
    const name = typeof entry === "string" ? entry : entry == null ? void 0 : entry.name;
    return { id, name, s };
  }).filter((row) => !!row.name);
}
function ordinal3(n) {
  return { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th" }[n] || `${n}th`;
}
function describePlay(play, names) {
  var _a;
  const nm = (id) => id && names && names[id] ? names[id].name : null;
  const y = play.yards || 0;
  const pick2 = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const tackler = nm(play.tacklerId);
  const tackleTag = tackler ? ` (${tackler})` : "";
  if (play.type === "penalty") {
    const yds = Math.abs(play.yards || 0);
    const culprit = nm(play.penaltyPlayerId);
    const name = play.penaltyName || "Penalty";
    const who = culprit ? ` (${culprit})` : "";
    if (play.penaltySide === "offense") {
      return {
        text: `\u{1F6A9} ${name}${who} on ${play.penaltyOn} \u2014 ${yds} yards, replay the down`,
        cls: "pbp-bad"
      };
    }
    return {
      text: `\u{1F6A9} ${name}${who} on ${play.penaltyOn} \u2014 ${yds} yards${play.autoFirst ? ", automatic first down" : ""}`,
      cls: "pbp-good"
    };
  }
  if (play.type === "pat") {
    const kn = nm(play.kickerId);
    return play.made ? { text: `Extra point is GOOD${kn ? ` \u2014 ${kn}` : ""}`, cls: "pbp-good" } : { text: `Extra point is NO GOOD!${kn ? ` ${kn} pushes it wide` : ""}`, cls: "pbp-bad" };
  }
  if (play.type === "pat2") {
    return play.made ? { text: `TWO-POINT TRY IS GOOD!`, cls: "pbp-good" } : { text: `Two-point try is stopped short`, cls: "pbp-bad" };
  }
  if (play.type === "kickoff") {
    if (play.onside) return play.recovered ? { text: `ONSIDE KICK \u2014 the kicking team recovers!`, cls: "pbp-good" } : { text: `Onside kick fails \u2014 the hands team falls on it`, cls: "pbp-bad" };
    if (play.returnTD) return { text: `KICKOFF RETURN TOUCHDOWN \u2014 ${nm(play.returnerId) || "the returner"} takes it to the house!`, cls: "pbp-good" };
    if (play.touchback) return { text: `Kickoff sails through the end zone \u2014 touchback`, cls: "" };
    return { text: `Kickoff returned ${play.retYds || 0} yards${nm(play.returnerId) ? ` by ${nm(play.returnerId)}` : ""}`, cls: "" };
  }
  if (play.type === "kneel") return { text: `Victory formation \u2014 the quarterback takes a knee`, cls: "" };
  if (play.type === "spike") return { text: `Spike! Clock stopped`, cls: "" };
  if (play.type === "fg") {
    const kn = nm(play.kickerId);
    if (play.made) {
      return { text: `Field goal is GOOD from ${play.fgDist}${kn ? ` \u2014 ${kn}` : ""}`, cls: "pbp-good" };
    }
    return { text: `Field goal from ${play.fgDist} is NO GOOD${kn ? ` \u2014 ${kn}` : ""}`, cls: "pbp-bad" };
  }
  if (play.type === "punt") {
    if (play.returnTD) {
      const rn2 = nm(play.returnerId);
      return { text: `Punt \u2014 ${play.puntYds} yards, ${rn2 || "the returner"} returns it for a TOUCHDOWN!`, cls: "pbp-good" };
    }
    if (play.touchback) {
      return { text: `Punt \u2014 ${play.puntYds} yards into the end zone, touchback`, cls: "pbp-muted" };
    }
    const rn = nm(play.returnerId);
    const ret = rn && play.returnYds ? `, ${rn} returns ${play.returnYds}` : "";
    return { text: `Punt \u2014 ${play.puntYds} yards${ret}`, cls: "pbp-muted" };
  }
  if (play.sack) {
    const s1 = nm(play.sackerId), s2 = nm(play.sackerId2);
    const who = s1 && s2 ? `${s1} & ${s2}` : s1 || "The defense";
    let text = pick2([
      `${who} drop${s1 && s2 ? "" : "s"} the QB for ${y}`,
      `Sack! ${who} get${s1 && s2 ? "" : "s"} home for ${y}`,
      `${who} bring${s1 && s2 ? "" : "s"} him down for ${y}`
    ]);
    let cls = "pbp-bad";
    if (play.turnover && play.turnoverType === "fumble") text += " \u2014 FUMBLE, recovered by defense!";
    return { text, cls };
  }
  if (play.type === "run_inside" || play.type === "run_outside" || play.type === "run_scramble") {
    const carrier = nm(play.rusherId) || "Runner";
    const scramble = play.type === "run_scramble";
    const dir = play.type === "run_scramble" ? "scrambles" : play.runDir === "left" ? play.type === "run_outside" ? "around left end" : "off left tackle" : play.runDir === "right" ? play.type === "run_outside" ? "around right end" : "off right tackle" : play.type === "run_inside" ? "up the middle" : "to the outside";
    const broke = nm(play.brokenById);
    if (play.pitchMuffed) {
      const text2 = play.turnover ? `PITCH IS LOOSE! ${carrier} can't corral it \u2014 the defense falls on it!` : `Pitch off ${carrier}'s hands \u2014 he smothers it for ${y}`;
      return { text: text2, cls: "pbp-bad" };
    }
    if (play.optionPhase && play.optionPhase !== "wildcat") {
      const phaseText = {
        dive: pick2([
          `Option \u2014 dive to ${carrier} for ${y}${tackleTag}`,
          `${carrier} takes the mesh give up the middle, ${y}${tackleTag}`,
          `Triple option \u2014 the B-back ${carrier} pounds it for ${y}${tackleTag}`
        ]),
        keep: pick2([
          `Option keep! ${carrier} pulls it and turns the corner, ${y}${tackleTag}`,
          `${carrier} rides the mesh, keeps it himself for ${y}${tackleTag}`,
          `The QB keeps on the option \u2014 ${y} yards${tackleTag}`
        ]),
        pitch: pick2([
          `Option pitch! ${carrier} takes it wide for ${y}${tackleTag}`,
          `${carrier} catches the pitch in space \u2014 ${y} yards${tackleTag}`,
          `Pitch phase \u2014 ${carrier} to the edge for ${y}${tackleTag}`
        ]),
        jet: pick2([
          `Jet sweep! ${carrier} takes it at full speed for ${y}${tackleTag}`,
          `${carrier} on the jet motion \u2014 ${y} yards around the edge${tackleTag}`,
          `Handoff on the fly \u2014 ${carrier}'s jet sweep goes for ${y}${tackleTag}`
        ])
      }[play.optionPhase];
      if (phaseText) {
        let text2 = phaseText;
        if (broke) {
          text2 += play.btStyle === "truck" ? ` \u2014 runs right through ${broke}!` : play.btStyle === "evade" ? ` \u2014 leaves ${broke} grasping!` : ` \u2014 breaks a tackle!`;
        }
        if (play.breakaway) text2 += " \u{1F4A8}";
        let cls2 = y >= 15 ? "pbp-big" : y <= 0 ? "pbp-muted" : "";
        if (play.turnover && play.turnoverType === "fumble") {
          text2 += " \u2014 FUMBLE LOST";
          cls2 = "pbp-bad";
        }
        if (play.td) {
          text2 += " \u2014 TOUCHDOWN! \u{1F3C8}";
          cls2 = "pbp-score";
        }
        return { text: text2, cls: cls2 };
      }
    }
    if (play.optionPhase === "wildcat") {
      let text2 = pick2([
        `Wildcat \u2014 direct snap to ${carrier}, ${y} yards ${dir}${tackleTag}`,
        `${carrier} takes the snap himself ${dir} for ${y}${tackleTag}`,
        `Direct snap! ${carrier} ${dir} for ${y}${tackleTag}`
      ]);
      if (broke) text2 += play.btStyle === "truck" ? ` \u2014 runs right through ${broke}!` : play.btStyle === "evade" ? ` \u2014 leaves ${broke} grasping!` : ` \u2014 breaks a tackle!`;
      if (play.breakaway) text2 += " \u{1F4A8}";
      let cls2 = y >= 15 ? "pbp-big" : y <= 0 ? "pbp-muted" : "";
      if (play.turnover && play.turnoverType === "fumble") {
        text2 += " \u2014 FUMBLE LOST";
        cls2 = "pbp-bad";
      }
      if (play.td) {
        text2 += " \u2014 TOUCHDOWN! \u{1F3C8}";
        cls2 = "pbp-score";
      }
      return { text: text2, cls: cls2 };
    }
    let text;
    if (scramble) {
      text = pick2([
        `${carrier} scrambles for ${y}`,
        `${carrier} takes off, ${y} yards`,
        `${carrier} escapes the pocket for ${y}`
      ]);
    } else if (y >= 15) {
      text = pick2([
        `${carrier} breaks free ${dir} for ${y}!`,
        `${carrier} bursts ${dir}, ${y} yards!`,
        `Big gain \u2014 ${carrier} ${y} yards ${dir}!`
      ]);
    } else if (y <= 0) {
      text = pick2([
        `${carrier} stuffed ${dir} for ${y}${tackleTag}`,
        `${carrier} met at the line for ${y}${tackleTag}`,
        `No room \u2014 ${carrier} ${y}${tackleTag}`
      ]);
    } else {
      text = pick2([
        `${carrier} ${dir} for ${y}${tackleTag}`,
        `${carrier} gains ${y} ${dir}${tackleTag}`,
        `${carrier} picks up ${y}${tackleTag}`
      ]);
    }
    if (broke) {
      text += play.btStyle === "truck" ? ` \u2014 runs right through ${broke}!` : play.btStyle === "evade" ? ` \u2014 leaves ${broke} grasping!` : ` \u2014 breaks a tackle!`;
    }
    if (play.breakaway) text += " \u{1F4A8}";
    if (play.rpoKept) text = `RPO read \u2014 kept the handoff: ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
    let cls = y >= 15 ? "pbp-big" : y <= 0 ? "pbp-muted" : "";
    if (play.turnover && play.turnoverType === "fumble") {
      text += " \u2014 FUMBLE LOST";
      cls = "pbp-bad";
    }
    if (play.td) {
      text += " \u2014 TOUCHDOWN! \u{1F3C8}";
      cls = "pbp-score";
    }
    return { text, cls };
  }
  const thrower = nm(play.throwerId) || "QB";
  const target = nm(play.receiverId) || nm(play.targetId) || "his receiver";
  const depth = play.passDepth === "deep" ? "deep" : play.passDepth === "short" ? "short" : "medium";
  if (play.complete) {
    const depthWord = depth === "deep" ? pick2(["deep ball", "shot downfield", "deep strike"]) : depth === "short" ? pick2(["quick pass", "short throw", "checkdown"]) : pick2(["pass", "strike", "throw"]);
    let text = y >= 20 ? pick2([`${thrower} hits ${target} on a ${depthWord} \u2014 ${y}!`, `${thrower} \u2192 ${target} for a big ${y}!`, `${target} hauls in the ${depthWord} for ${y}!`]) : play.contested ? `${target} GOES UP and takes it away \u2014 ${y} yards${tackleTag}` : pick2([`${thrower} finds ${target} for ${y}`, `${thrower} \u2192 ${target}, ${y} yards`, `${target} reels it in for ${y}${tackleTag}`]);
    if (play.motionReveal) text = `Motion shows ${play.motionReveal === "man" ? "MAN" : "ZONE"} \u2014 ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
    else if (play.motion && play.targetId && play.motionManId === play.targetId) text = `Motion man \u2014 ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
    else if (play.rpo) text = `RPO read \u2014 pulled it and threw: ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
    if (play.batted) {
      const b = play.battedByName || (play.battedById ? nm(play.battedById) : null);
      const t = b ? `Batted down at the line by ${b}!` : "Batted down at the line!";
      return play.turnover ? { text: `${t} Tipped in the air \u2014 INTERCEPTED!`, cls: "pbp-bad" } : { text: t, cls: "pbp-def" };
    } else if (play.isScreen) text = `Screen \u2014 ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
    else if (play.playAction) text = `Play action \u2014 ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
    if (play.hurried) {
      const flusher = ((_a = play.pressureIds) == null ? void 0 : _a[0]) ? nm(play.pressureIds[0]) : null;
      text = flusher ? `Flushed by ${flusher} \u2014 ${text.charAt(0).toLowerCase()}${text.slice(1)}` : `Under pressure, ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
    }
    if (play.turnover && play.turnoverType === "fumble") {
      text += " \u2014 FUMBLE LOST";
      return { text, cls: "pbp-bad" };
    }
    if (play.td) {
      text += " \u2014 TOUCHDOWN! \u{1F3C8}";
      return { text, cls: "pbp-score" };
    }
    return { text, cls: y >= 20 ? "pbp-big" : "" };
  }
  if (play.turnover && play.turnoverType === "interception") {
    const picker2 = nm(play.intPickerId);
    if (play.tipDrill) {
      const tipper = nm(play.pbuId);
      return { text: pick2([
        `${tipper ? tipper + " tips it up" : "Tipped at the catch point"} — ${picker2 ? picker2 + " snatches the carom" : "and it's picked off"}! INTERCEPTED!`,
        `Tip drill! ${tipper ? tipper + " gets a hand on it and " : ""}${picker2 || "the defense"} comes down with it — INTERCEPTION!`
      ]), cls: "pbp-bad" };
    }
    return { text: pick2([
      `INTERCEPTED${picker2 ? " by " + picker2 : ""}! ${thrower} picked off`,
      `${picker2 || "The defense"} steps in front \u2014 INTERCEPTION!`,
      `Picked! ${thrower}'s ${depth} pass intercepted${picker2 ? " by " + picker2 : ""}`
    ]), cls: "pbp-bad" };
  }
  const pbu = nm(play.pbuId);
  return { text: pick2([
    pbu ? `Incomplete \u2014 broken up by ${pbu}` : `${thrower} incomplete${target !== "his receiver" ? " to " + target : ""}`,
    pbu ? `${pbu} breaks it up!` : `${thrower}'s ${depth} pass falls incomplete`,
    `Incomplete${pbu ? " \u2014 " + pbu + " with the PBU" : ""}`
  ]), cls: "pbp-muted" };
}
var PLAN_OFF_FIELDS = ["offFormations", "tendency", "passDepth", "qbRunPct", "tempo", "protIdentity"];
var PLAN_DEF_FIELDS = ["defFront", "defAggression", "pressureIdentity", "coverageScheme", "runCommit"];
function planAgg(drives, poss) {
  var _a;
  const bySit = {};
  const cell = (k) => bySit[k] || (bySit[k] = {
    snaps: 0,
    drop: 0,
    runs: 0,
    yards: 0,
    convAtt: 0,
    conv: 0,
    blitz: 0,
    blitzSack: 0,
    blitzComp: 0,
    blitzYds: 0
  });
  let hurry = 0, chew = 0, rushAtt = 0, rushYds = 0;
  for (const d of drives) {
    if (d.possession !== poss) continue;
    for (const p of d.plays || []) {
      const t = p.type || "";
      const scrimmage = t.startsWith("run") || t.startsWith("pass");
      if (!scrimmage) continue;
      const c = cell(p.offSit || "base");
      const dropback = t.startsWith("pass") || t === "run_scramble" || p.sack;
      c.snaps++;
      if (dropback) c.drop++;
      else c.runs++;
      c.yards += p.yards || 0;
      if (p.down >= 3) {
        c.convAtt++;
        if (!p.turnover && (((_a = p.yards) != null ? _a : -99) >= p.distance || p.fieldPos + (p.yards || 0) >= 100)) c.conv++;
      }
      if (dropback && p.blitzFired) {
        c.blitz++;
        if (p.sack) c.blitzSack++;
        if (p.complete) {
          c.blitzComp++;
          c.blitzYds += p.yards || 0;
        }
      }
      if (p.tempo === "Hurry") hurry++;
      else if (p.tempo === "Chew") chew++;
      if (!dropback) {
        rushAtt++;
        rushYds += p.yards || 0;
      }
    }
  }
  return { bySit, hurry, chew, rushAtt, rushYds };
}
function planVerdict(k, c, side) {
  const convPct = c.convAtt >= 3 ? Math.round(100 * c.conv / c.convAtt) : null;
  const ypp = c.snaps ? c.yards / c.snaps : 0;
  if (side === "off") {
    if (convPct != null && convPct >= 55) return "It's working \u2014 keep dialing it.";
    if (convPct != null && convPct <= 25) return "It's not converting. Rethink this cell.";
    if (ypp >= 7 && c.snaps >= 5) return "Chunk plays \u2014 this look is winning.";
    if (ypp <= 2.5 && c.snaps >= 5) return "Going nowhere here.";
  } else {
    if (c.blitz >= 4 && c.blitzSack >= 2) return "Pressure got home \u2014 the blitz paid.";
    if (c.blitz >= 4 && c.blitzComp >= 3) return "They beat the blitz \u2014 coverage paid the bill.";
    if (convPct != null && convPct <= 30) return "Shut the door on the money down.";
    if (convPct != null && convPct >= 60) return "They converted at will. Adjust.";
  }
  return "";
}
function renderPlanReport(r, isHome, school, minSnaps = 3) {
  var _a;
  const myPoss = isHome ? "home" : "away";
  const oppPoss = isHome ? "away" : "home";
  const drives = r.drives || [];
  if (!drives.length) return '<p class="empty-state">No play data for this game.</p>';
  const sits = ((_a = school == null ? void 0 : school.gameplan) == null ? void 0 : _a.situations) || {};
  const hasCustom = (k, fields) => {
    const c = sits[k];
    if (!c) return false;
    return fields.some((f) => c[f] != null);
  };
  const off = planAgg(drives, myPoss);
  const def = planAgg(drives, oppPoss);
  const row = (k, c, side) => {
    const custom = hasCustom(k, side === "off" ? PLAN_OFF_FIELDS : PLAN_DEF_FIELDS);
    const ypp = (c.yards / c.snaps).toFixed(1);
    const convPct = c.convAtt >= 3 ? `${Math.round(100 * c.conv / c.convAtt)}% conv (${c.conv}/${c.convAtt})` : "";
    const split = `${c.runs}R/${c.drop}P`;
    const blitzBit = side === "def" && c.blitz > 0 ? `<span class="pr-chip pr-blitz">blitz \xD7${c.blitz}: ${c.blitzSack} sk, ${c.blitzComp} cmp</span>` : "";
    const verdict = planVerdict(k, c, side);
    return `
    <div class="pr-row">
      <div class="pr-head">
        <span class="pr-sit">${SITUATION_LABELS[k] || k}</span>
        <span class="pr-badge${custom ? " custom" : ""}">${custom ? "CUSTOM" : "AUTO"}</span>
      </div>
      <div class="pr-stats">
        <span class="pr-chip">${c.snaps} snaps</span>
        <span class="pr-chip">${split}</span>
        <span class="pr-chip">${ypp} yds/play${side === "def" ? " allowed" : ""}</span>
        ${convPct ? `<span class="pr-chip">${convPct}</span>` : ""}
        ${blitzBit}
      </div>
      ${verdict ? `<div class="pr-verdict">${verdict}</div>` : ""}
    </div>`;
  };
  const table = (agg, side, title) => {
    const rows = SITUATION_KEYS.filter((k) => {
      var _a2;
      return (((_a2 = agg.bySit[k]) == null ? void 0 : _a2.snaps) || 0) >= minSnaps;
    }).map((k) => row(k, agg.bySit[k], side)).join("");
    return `
    <div class="pr-section">
      <div class="pr-title">${title}</div>
      ${rows || '<div class="pr-verdict">Not enough snaps to grade.</div>'}
    </div>`;
  };
  const oppYpc = def.rushAtt >= 5 ? (def.rushYds / def.rushAtt).toFixed(1) : null;
  const myYpc = off.rushAtt >= 5 ? (off.rushYds / off.rushAtt).toFixed(1) : null;
  const tempoBits = [];
  if (off.hurry > 0) tempoBits.push(`${off.hurry} Hurry snaps`);
  if (off.chew > 0) tempoBits.push(`${off.chew} Chew snaps`);
  const tempoLine = `${drives.length} possessions (combined)${tempoBits.length ? " \xB7 " + tempoBits.join(" \xB7 ") : ""}`;
  return `
  <div class="plan-report">
    ${table(off, "off", "YOUR OFFENSE \u2014 BY SITUATION")}
    ${table(def, "def", "YOUR DEFENSE \u2014 BY SITUATION")}
    <div class="pr-section">
      <div class="pr-title">GAME SHAPE</div>
      <div class="pr-stats">
        <span class="pr-chip">${tempoLine}</span>
        ${myYpc ? `<span class="pr-chip">your ground game ${myYpc} ypc</span>` : ""}
        ${oppYpc ? `<span class="pr-chip">opponent ground game ${oppYpc} ypc</span>` : ""}
      </div>
    </div>
  </div>`;
}
function fmtPlayClock(p) {
  if (p.clock == null || p.half == null) return "";
  const q = p.half === 1 ? p.clock > 900 ? 1 : 2 : p.clock > 900 ? 3 : 4;
  const s = p.clock > 900 ? p.clock - 900 : p.clock;
  const mm = Math.floor(s / 60), ss = String(s % 60).padStart(2, "0");
  return `Q${q} ${mm}:${ss}`;
}
function fmtSpot(fp) {
  if (fp == null) return "";
  if (fp === 50) return "MID 50";
  return fp < 50 ? `OWN ${fp}` : `OPP ${100 - fp}`;
}
var PBP_SIT_CHIPS = {
  goal_line: "GOAL LINE",
  backed_up: "BACKED UP",
  red_zone: "RED ZONE",
  two_min_trail: "2-MIN",
  four_min_lead: "4-MIN"
};
function renderPlayByPlay(r, isHome) {
  const names = r.playerNames || {};
  const drives = r.drives || [];
  if (drives.length === 0) return '<p class="empty-state">No play data for this game.</p>';
  return `
  <div class="pbp-wrap">
    ${drives.map((d, di) => {
    var _a;
    const mine = d.possession === "home" === isHome;
    const team = ((_a = d.possession === "home" ? r.homeSchool : r.awaySchool) == null ? void 0 : _a.name) || "";
    const plays = d.plays || [];
    return `
        <div class="pbp-drive">
          <div class="pbp-drive-header ${mine ? "pbp-mine" : "pbp-opp"}">
            <span class="pbp-drive-team">${mine ? "\u25B6" : "\u25C0"} ${escapeHtml(team)}${plays[0] && fmtPlayClock(plays[0]) ? ` <span class="pbp-drive-clock">${fmtPlayClock(plays[0])}</span>` : ""}</span>
            <span class="pbp-drive-result result-${d.result}">${formatDriveResult(d)}${d.points > 0 ? ` (+${d.points})` : ""}</span>
          </div>
          <div class="pbp-plays">
            ${plays.map((p) => {
      var _a2, _b, _c;
      const desc = describePlay(p, names);
      let covTag = "";
      if (p.coverage && String(p.type || "").startsWith("pass") && !p.sack) {
        const pre = p.killCall === "toPass" ? "checked: " : "";
        const cpt = p.concept ? `${escapeHtml(p.concept)}${p.audible ? " (audible)" : ""} ` : "";
        const show = p.shownCoverage ? p.fooled ? ` \u2014 bit on ${escapeHtml(p.shownCoverage.replace("Cover ", ""))}` : ` (showed ${escapeHtml(p.shownCoverage.replace("Cover ", ""))})` : "";
        let blame = "";
        if (p.complete && ((_a2 = p.yards) != null ? _a2 : 0) >= 15 && p.beatenDefId) {
          const bn = (_b = names[p.beatenDefId]) == null ? void 0 : _b.name;
          if (bn) blame = p.covJob ? ` \u2014 beat ${escapeHtml(bn)} in the ${escapeHtml(p.covJob)}` : ` \u2014 beat ${escapeHtml(bn)}`;
        }
        covTag = ` <span class="pbp-cov">\xB7 ${pre}${cpt}vs ${escapeHtml(p.coverage)}${show}${blame}</span>`;
      } else if (p.concept && String(p.type || "").startsWith("run") && !p.optionPhase && !["Jet Sweep", "Draw"].includes(p.concept)) {
        const pre = p.killCall === "toRun" ? "checked: " : "";
        const gap = p.runGap && ((_c = p.yards) != null ? _c : 0) <= 0 && !p.isScramble ? ` \u2014 stuffed in the ${escapeHtml(p.runGap)}` : "";
        covTag = ` <span class="pbp-cov">\xB7 ${pre}${escapeHtml(p.concept)}${gap}</span>`;
      }
      const dd = p.down && p.distance != null ? `${ordinal3(p.down)} & ${p.distance}` : "";
      const form = p.offFormation ? `${p.offFormation} vs ${p.defFront || "?"}` : "";
      const clockStr = fmtPlayClock(p);
      const spot = fmtSpot(p.fieldPos);
      const score = p.scoreOff != null ? `${d.possession === "home" ? p.scoreOff : p.scoreDef}\u2013${d.possession === "home" ? p.scoreDef : p.scoreOff}` : "";
      const sitChip = PBP_SIT_CHIPS[p.offSit] || "";
      return `
                <div class="pbp-play">
                  <span class="pbp-dd">${clockStr ? `<span class="pbp-clock">${clockStr}</span>` : ""}${dd}${spot ? `${dd ? " \xB7 " : ""}<span class="pbp-spot">${spot}</span>` : ""}</span>
                  <span class="pbp-play-body">
                    <span class="pbp-meta">
                      ${score ? `<span class="pbp-chip">${score}</span>` : ""}
                      ${sitChip ? `<span class="pbp-chip pbp-chip-sit">${sitChip}</span>` : ""}
                      ${p.blitzFired ? `<span class="pbp-chip pbp-chip-blitz">BLITZ</span>` : ""}
                    </span>
                    <span class="pbp-desc ${desc.cls}">${escapeHtml(desc.text)}${covTag}</span>
                    ${form ? `<span class="pbp-form">${escapeHtml(form)}</span>` : ""}
                  </span>
                </div>
              `;
    }).join("")}
          </div>
        </div>
      `;
  }).join("")}
  </div>
`;
}
function findPlayerAnywhere(id) {
  var _a, _b;
  for (const s of ((_a = state.world) == null ? void 0 : _a.schools) || []) {
    const p = (s.roster || []).find((pl) => pl.id === id);
    if (p) return { p, school: s };
  }
  const pe = (((_b = state.portal) == null ? void 0 : _b.players) || []).find((e) => {
    var _a2;
    return ((_a2 = e.player) == null ? void 0 : _a2.id) === id;
  });
  if (pe) return { p: pe.player, school: null };
  return null;
}
// ── Identity stage 2: trait chips (player card) ─────────────────────────────
// Bridge = gold, play traits = neutral with level pips, flaws = red. Old-save
// players simply have no p.traits and render nothing.
function renderTraitChips(p) {
  const tl = p == null ? void 0 : p.traits;
  if (!tl) return "";
  const pips = (lv) => "\u25CF".repeat(lv || 1);
  const chips = [];
  if (tl.bridge && BRIDGE_CATALOG[tl.bridge]) {
    const b = BRIDGE_CATALOG[tl.bridge];
    chips.push(`<span class="trait-chip trait-bridge" title="${escapeHtml(b.desc || "Bridge trait")}">\u2726 ${escapeHtml(b.name)}</span>`);
  }
  for (const t of tl.play || []) {
    const cat = PLAY_CATALOG[t.k];
    if (!cat) continue;
    chips.push(`<span class="trait-chip" title="${escapeHtml(cat.desc || cat.name)}">${escapeHtml(cat.name)} <span class="trait-pips">${pips(t.lv)}</span></span>`);
  }
  for (const t of tl.flaws || []) {
    const cat = FLAW_CATALOG[t.k];
    if (!cat) continue;
    chips.push(`<span class="trait-chip trait-flaw" title="${escapeHtml(cat.desc || cat.name)}">${escapeHtml(cat.name)} <span class="trait-pips">${pips(t.lv)}</span></span>`);
  }
  if (!chips.length) return "";
  return `<span class="trait-chip-row">${chips.join("")}</span>`;
}
// Item 10 — the full TRAITS block for the player card: every trait spelled out in
// plain language, with its level and (for play traits) how it grows. This is the
// touch-friendly home for trait info — no hover required, so phones see it too.
var TRAIT_LEVEL_LABEL = ["", "I", "II", "III"];
function renderTraitDetail(p) {
  var _a;
  const tl = p == null ? void 0 : p.traits;
  if (!tl) return "";
  const lvl = (n) => TRAIT_LEVEL_LABEL[n] || "I";
  const rows = [];
  if (tl.bridge && BRIDGE_CATALOG[tl.bridge]) {
    const b = BRIDGE_CATALOG[tl.bridge];
    rows.push(`<div class="trait-detail-row trait-detail-bridge">
      <div class="trait-detail-head"><span class="trait-detail-name">✦ ${escapeHtml(b.name)}</span><span class="trait-detail-tag">Bridge</span></div>
      <div class="trait-detail-desc">${escapeHtml(b.desc || "")}</div></div>`);
  }
  for (const t of tl.play || []) {
    const cat = PLAY_CATALOG[t.k];
    if (!cat) continue;
    rows.push(`<div class="trait-detail-row">
      <div class="trait-detail-head"><span class="trait-detail-name">${escapeHtml(cat.name)}</span><span class="trait-detail-lv">${lvl(t.lv)}</span></div>
      <div class="trait-detail-desc">${escapeHtml(cat.desc || "")}</div>
      ${cat.grow ? `<div class="trait-detail-grow">Improves with: ${escapeHtml(cat.grow)}</div>` : ""}</div>`);
  }
  for (const t of tl.flaws || []) {
    const cat = FLAW_CATALOG[t.k];
    if (!cat) continue;
    rows.push(`<div class="trait-detail-row trait-detail-flaw">
      <div class="trait-detail-head"><span class="trait-detail-name">${escapeHtml(cat.name)}</span><span class="trait-detail-tag">Flaw</span></div>
      <div class="trait-detail-desc">${escapeHtml(cat.desc || "")}</div></div>`);
  }
  if (!rows.length) return "";
  return `<div class="card trait-detail-card">
    <div class="card-header"><span class="card-title">TRAITS</span><span class="card-sub">how he plays</span></div>
    <div class="trait-detail-list">${rows.join("")}</div>
  </div>`;
}
function renderPlayerCardModal() {
  var _a, _b, _c;
  const id = state.ui.pcardId;
  if (!id) return "";
  const hit = findPlayerAnywhere(id);
  if (!hit) return "";
  const { p, school } = hit;
  const mySchool = getPlayerSchool();
  const isMine2 = school && school.id === (mySchool == null ? void 0 : mySchool.id);
  const st = p.stats || {};
  const statBits = [];
  if (st.passAtt > 0) statBits.push(`${st.passComp}/${st.passAtt} \xB7 ${st.passYds} yds \xB7 ${st.passTD} TD / ${st.passInt} INT`);
  if (st.rushAtt > 0) statBits.push(`${st.rushAtt} car \xB7 ${st.rushYds} yds \xB7 ${st.rushTD} TD`);
  if (st.recComp > 0) statBits.push(`${st.recComp} rec \xB7 ${st.recYds} yds \xB7 ${st.recTD} TD`);
  if (st.tackles > 0 || st.sacks > 0 || st.ints > 0) statBits.push(`${st.tackles || 0} tkl \xB7 ${st.sacks || 0} sck \xB7 ${st.ints || 0} INT`);
  // PASS 7 (Fix D): real usage on the card — season snaps, plus where he
  // actually lived when it wasn't his listed room (job-bucket snaps).
  if (!globalThis.__noSnapTrack && st.snaps > 0) {
    const at = st.snapsAt || {};
    const foreign = Object.entries(at).sort((a, b) => b[1] - a[1])[0];
    statBits.push(`${st.snaps} snaps${foreign && foreign[1] >= 20 ? ` (${foreign[1]} at ${foreign[0]})` : ""}`);
  }
  const potChar = { average: "C", good: "B", great: "A", sky: "S" }[p.potentialBand] || "?";
  const potKnown = isMine2 && p.potentialRevealed;
  const m = p.measurables;
  return `
  <div class="modal-overlay" id="pcard-overlay">
    <div class="modal pcard-modal pcard-profile">
      <div class="modal-header">
        <div class="pcard-title">
          <div class="profile-pos-badge pos-${p.position}">${p.position}</div>
          <span class="pcard-name">${escapeHtml(fullName(p))}</span>
          <span class="class-badge class-${(p.classYear || "fr").toLowerCase()}">${p.classYear || ""}</span>
          ${p.redshirted ? '<span class="rs-badge">RS</span>' : ""}
        </div>
        <button class="btn-icon" id="close-pcard" type="button" aria-label="Close player profile" title="Close">\u2715</button>
      </div>

      <div class="pcard-portrait-row">
        ${renderPlayerPortrait(p, school, "lg")}
        <div class="pcard-portrait-info">
          <div class="profile-details pcard-details">
        ${derivedArchetype(p) ? `<span class="arch-chip arch-chip-lg" data-tip="archetype" title="What is an archetype?">${archetypeLabel(derivedArchetype(p))}</span>` : ""}
        <span>${school ? `<span class="team-link" data-scout-team="${school.id}">${escapeHtml(school.name)} ${escapeHtml(school.nick || "")}</span>` : '<span class="muted">Transfer portal</span>'}</span>
        ${p.height || p.weight ? `<span>${p.height ? escapeHtml(String(p.height)) : ""}${p.height && p.weight ? " \xB7 " : ""}${p.weight ? `${p.weight} lbs` : ""}</span>` : ""}
        ${!globalThis.__noMorale && isMine2 && p.morale != null ? (() => {
    const mv = Math.round(p.morale);
    const bar = C.PASS7 || {};
    const lab = mv < (bar.moraleLowBar || 40) ? ["Unhappy", "var(--red)"] : mv < (bar.moraleMidBar || 55) ? ["Restless", "var(--gold, orange)"] : mv > (bar.moraleHighBar || 80) ? ["Locked in", "var(--green)"] : ["Content", "var(--muted)"];
    return `<span title="Morale ${mv} — tracks his real snap share vs the role he expects. Low morale feeds the portal." style="color:${lab[1]};font-size:12px;letter-spacing:.3px">● ${lab[0]}</span>`;
  })() : ""}
        ${renderTraitChips(p)}
        ${m ? `<span class="testing-sheet">40yd ${m.forty} \xB7 Vert ${m.vert}&quot; \xB7 Shuttle ${m.shuttle} \xB7 Bench ${m.bench}</span>` : ""}
        ${((_a = p.hometown) == null ? void 0 : _a.city) ? `<span>${escapeHtml(p.hometown.city)}, ${escapeHtml(p.hometown.state || "")}</span>` : ""}
      </div>

      <div class="profile-ratings pcard-ratings">
        <div class="profile-rating-block">
          <div class="pr-val rating-${ratingColor(Math.round(p.compositeRating))}">${Math.round(p.compositeRating)}</div>
          <div class="pr-label">${tipTerm("overall", "Overall")}</div>
        </div>
        <div class="profile-rating-block">
          <div class="pr-val ${potKnown ? `pot-${p.potentialBand}` : "unknown"}">${potKnown ? potChar : "?"}</div>
          <div class="pr-label">${tipTerm("potential", "Potential")}</div>
        </div>
        <div class="profile-rating-block">
          <div class="pr-val ${ratingColor(p.attributes.WE)}">${p.attributes.WE}</div>
          <div class="pr-label">Work Ethic</div>
        </div>
        <div class="profile-rating-block">
          <div class="pr-val ${ratingColor(p.attributes.CON)}">${p.attributes.CON}</div>
          <div class="pr-label">Conditioning</div>
        </div>
      </div>
        </div>
      </div>

      ${p.injuryGamesOut > 0 ? `
        <div class="pcard-injury injury-detail inj-${((_b = p.injury) == null ? void 0 : _b.severity) || "moderate"}">
          <span class="injury-detail-type">${p.injury ? escapeHtml(p.injury.type) : "Injured"}</span>
          <span class="injury-detail-meta">${p.injury ? `${p.injury.severityLabel} \xB7 ` : ""}${p.injuryGamesOut} week${p.injuryGamesOut === 1 ? "" : "s"} out${((_c = p.injury) == null ? void 0 : _c.totalGames) && p.injury.totalGames !== p.injuryGamesOut ? ` (of ${p.injury.totalGames})` : ""}</span>
        </div>` : ""}

      ${statBits.length ? `
        <div class="card pcard-season-card">
          <div class="card-header"><span class="card-title">THIS SEASON</span></div>
          <div class="pcard-stats muted">${statBits.join(" &nbsp;\xB7&nbsp; ")}</div>
        </div>` : ""}

      <div class="card pcard-attr-card">
        <div class="card-header"><span class="card-title">${tipTerm("attributes", "ATTRIBUTES")}</span></div>
        <div class="attr-bars pcard-attrs">
          ${ATTRIBUTES.map((a) => `
            <div class="attr-bar-row">
              <span class="attr-bar-label">${attrLabel(a)}</span>
              <div class="attr-bar-track">
                <div class="attr-bar-fill attr-fill-${ratingColor(p.attributes[a])}" style="width:${p.attributes[a]}%"></div>
              </div>
              <span class="attr-bar-val">${p.attributes[a]}</span>
            </div>`).join("")}
        </div>
      </div>

      ${renderTraitDetail(p)}
    </div>
  </div>
`;
}
function renderSaveModal() {
  if (!state.ui.showSaveModal) return "";
  const saves = state.ui.saves || [];
  return `
  <div class="modal-overlay" id="save-modal-overlay">
    <div class="modal save-modal">
      <div class="modal-header">
        <h2>Save Game</h2>
        <button class="modal-close" id="close-save-modal" aria-label="Close save menu">\u2715</button>
      </div>
      <div class="save-slots">
        <div class="save-slot save-slot-auto" data-save-slot="auto">
          <div class="save-slot-label">Auto Save</div>
          <div class="save-slot-info">
            <div class="save-slot-meta">Overwrites on every week advance</div>
          </div>
        </div>
        ${ALL_SLOTS.map((slot) => {
    const save = saves.find((s) => s.slot === slot);
    return `
            <div class="save-slot ${save ? "save-slot-filled" : "save-slot-empty"}" data-save-slot="${slot}">
              <div class="save-slot-label">${SLOT_LABELS[slot]}</div>
              ${save ? `
                <div class="save-slot-info">
                  <div class="save-slot-school">${escapeHtml(save.school || "?")}</div>
                  <div class="save-slot-meta">S${save.season} ${escapeHtml(weekShort(save.day))} \xB7 ${formatDate2(save.timestamp)}</div>
                </div>
                <div class="save-slot-overwrite">Click to overwrite</div>
              ` : `
                <div class="save-slot-empty-label">Empty \u2014 click to save</div>
              `}
            </div>
          `;
  }).join("")}
      </div>
    </div>
  </div>
`;
}
function formatDate2(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function formatDriveResult(d) {
  const labels = { touchdown: "TD", field_goal: "FG", punt: "Punt", turnover: "TO", turnover_on_downs: "Downs", missed_fg: "Miss", safety: "Safety", punt_return_td: "Punt Return TD", end_half: "End Half" };
  return labels[d.result] || d.result;
}
function setupGlobalListeners() {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H, _I, _J, _K, _L, _M, _N, _O, _P, _Q, _R;
  document.querySelectorAll("[data-nav]").forEach((el) => {
    const activateNav = () => {
      state.ui.sidebarOpen = false;
      navigate(el.dataset.nav);
    };
    el.addEventListener("click", activateNav);
    if (el.matches('.nav-item[role="button"]')) {
      el.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        activateNav();
      });
    }
  });
  if (!_helpDelegationWired) {
    _helpDelegationWired = true;
    document.addEventListener("click", (e) => {
      var _a2, _b2;
      const btn = (_b2 = (_a2 = e.target).closest) == null ? void 0 : _b2.call(_a2, "[data-help-chapter]");
      if (!btn) return;
      e.stopPropagation();
      state.ui.contextHelpChapter = btn.dataset.helpChapter;
      renderApp();
    });
  }
  const closeContextHelp = () => {
    state.ui.contextHelpChapter = null;
    renderApp();
  };
  (_a = document.getElementById("context-help-overlay")) == null ? void 0 : _a.addEventListener("click", (e) => {
    if (e.target.id === "context-help-overlay") closeContextHelp();
  });
  (_b = document.getElementById("context-help-close")) == null ? void 0 : _b.addEventListener("click", closeContextHelp);
  (_c = document.getElementById("context-help-return")) == null ? void 0 : _c.addEventListener("click", closeContextHelp);
  (_d = document.querySelector("[data-context-help-full]")) == null ? void 0 : _d.addEventListener("click", (e) => {
    const chapter17 = e.currentTarget.dataset.contextHelpFull;
    state.ui.contextHelpChapter = null;
    navigate("manual", { chapter: chapter17 });
  });
  document.querySelectorAll("[data-tip]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      state.ui.activeTip = el.dataset.tip;
      renderApp();
    });
  });
  (_e = document.getElementById("tip-overlay")) == null ? void 0 : _e.addEventListener("click", (e) => {
    if (e.target.id === "tip-overlay") {
      state.ui.activeTip = null;
      renderApp();
    }
  });
  (_f = document.getElementById("tip-close")) == null ? void 0 : _f.addEventListener("click", () => {
    state.ui.activeTip = null;
    renderApp();
  });
  (_g = document.querySelector("[data-tip-chapter]")) == null ? void 0 : _g.addEventListener("click", (e) => {
    e.stopPropagation();
    const chapter17 = e.currentTarget.dataset.tipChapter;
    state.ui.activeTip = null;
    navigate("manual", { chapter: chapter17 });
  });
  (_h = document.getElementById("btn-back-top")) == null ? void 0 : _h.addEventListener("click", () => {
    if (!state.ui.pcardId && !state.ui.showInbox && state.ui.view === "recruiting" && recruitingGoBack()) return;
    navigateBack();
  });
  (_i = document.getElementById("tab-more")) == null ? void 0 : _i.addEventListener("click", () => {
    state.ui.sidebarOpen = !state.ui.sidebarOpen;
    renderApp();
  });
  (_j = document.getElementById("sidebar-backdrop")) == null ? void 0 : _j.addEventListener("click", () => {
    state.ui.sidebarOpen = false;
    renderApp();
  });
  if (state.ui.showHalftime && state.pendingHalftime) {
    const { token, home } = state.pendingHalftime;
    const school = getPlayerSchool();
    const gp = home.id === (school == null ? void 0 : school.id) ? token.homeGP : token.awayGP;
    const htRoot = document.getElementById("halftime-screen") || document;
    document.querySelectorAll("[data-ht-adj]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const kind = btn.dataset.htAdj;
        const cur = state.pendingHalftime.adjustment;
        if ((cur == null ? void 0 : cur.kind) === kind) {
          state.pendingHalftime.adjustment = null;
        } else state.pendingHalftime.adjustment = { kind, id: btn.dataset.htAdjId || null, name: btn.dataset.htAdjName || null };
        renderApp();
      });
    });
    document.querySelectorAll("[data-halftime-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.ui.halftimeTab = btn.dataset.halftimeTab;
        renderApp();
      });
    });
    wireDefaultsListeners(gp, { root: htRoot });
    if (state.ui.halftimeTab === "situations") {
      wireSituationListeners(gp, {
        getOpenKey: () => state.ui.halftimeOpenSitKey,
        setOpenKey: (k) => {
          state.ui.halftimeOpenSitKey = k;
        },
        root: htRoot
      });
    }
    (_k = document.getElementById("ht-coachmode")) == null ? void 0 : _k.addEventListener("click", () => {
      if (!state.settings) state.settings = {};
      state.settings.liveWatch = state.settings.liveWatch === false;
      renderApp();
    });
    (_l = document.getElementById("btn-resume-halftime")) == null ? void 0 : _l.addEventListener("click", async () => {
      var _a2, _b2;
      const btn = document.getElementById("btn-resume-halftime");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "SIMULATING 2ND HALF\u2026";
      }
      if (((_a2 = state.settings) == null ? void 0 : _a2.liveWatch) === false && ((_b2 = state.pendingHalftime) == null ? void 0 : _b2.token)) {
        state.pendingHalftime.token.callMode = "off";
      }
      await resumeHalftime();
      renderApp();
    });
    document.getElementById("btn-sim-coached")?.addEventListener("click", async () => {
      const btn = document.getElementById("btn-sim-coached");
      if (btn) { btn.disabled = true; btn.textContent = "Simulating…"; }
      await simCoached();
      renderApp();
    });
  }
  document.querySelectorAll("[data-scout-team]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      openSchool(el.dataset.scoutTeam);
    });
  });
  document.querySelectorAll("[data-pcard]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!findPlayerAnywhere(el.dataset.pcard)) {
        notify("No longer in the league", "info");
        return;
      }
      state.ui.pcardId = el.dataset.pcard;
      renderApp();
    });
  });
  (_m = document.getElementById("pcard-overlay")) == null ? void 0 : _m.addEventListener("click", (e) => {
    if (e.target.id === "pcard-overlay") {
      state.ui.pcardId = null;
      renderApp();
    }
  });
  (_n = document.getElementById("close-pcard")) == null ? void 0 : _n.addEventListener("click", () => {
    state.ui.pcardId = null;
    renderApp();
  });
  for (const id of ["btn-team-switch", "btn-team-switch-side"]) {
    const _tsBtn = document.getElementById(id);
    if (_tsBtn) _tsBtn.addEventListener("click", () => {
      state.ui.showTeamSwitch = true;
      renderApp();
    });
  }
  document.querySelectorAll("[data-ts-close]").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (el.dataset.tsClose === "bg" && e.target !== el) return;
      state.ui.showTeamSwitch = false;
      renderApp();
    });
  });
  document.querySelectorAll("[data-ts-slot]").forEach((el) => {
    el.addEventListener("click", () => {
      state.ui.showTeamSwitch = false;
      // The tree runs one clock. If another chair still owes this week a result,
      // send the coach to the agenda rather than silently swapping mid-lockstep.
      try {
        const block = lockstepBlock(state);
        if (block) {
          notify(block, "warning", 5e3);
          renderApp();
          return;
        }
      } catch (e) {
      }
      switchTreeSlot(el.dataset.tsSlot);
    });
  });
  document.querySelectorAll("[data-ts-offers]").forEach((el) => {
    el.addEventListener("click", () => {
      state.ui.showTeamSwitch = false;
      navigate("program");
    });
  });
  for (const id of ["btn-inbox", "btn-inbox-top"]) {
    (_o = document.getElementById(id)) == null ? void 0 : _o.addEventListener("click", () => {
      state.inbox.forEach((m) => m.read = true);
      state.ui.showInbox = !state.ui.showInbox;
      renderApp();
    });
  }
  (_p = document.getElementById("inbox-overlay")) == null ? void 0 : _p.addEventListener("click", (e) => {
    if (e.target.id === "inbox-overlay" || e.target.id === "close-inbox") {
      state.ui.showInbox = false;
      renderApp();
    }
  });
  (_q = document.getElementById("btn-save")) == null ? void 0 : _q.addEventListener("click", async () => {
    if (gamePauseIsLive(state)) {
      notify("Finish the current game before saving.", "warning");
      return;
    }
    await refreshSaves();
    state.ui.showSaveModal = true;
    renderApp();
  });
  (_r = document.getElementById("close-save-modal")) == null ? void 0 : _r.addEventListener("click", () => {
    state.ui.showSaveModal = false;
    renderApp();
  });
  (_s = document.getElementById("save-modal-overlay")) == null ? void 0 : _s.addEventListener("click", (e) => {
    if (e.target.id === "save-modal-overlay") {
      state.ui.showSaveModal = false;
      renderApp();
    }
  });
  document.querySelectorAll("[data-save-slot]").forEach((el) => {
    el.addEventListener("click", async () => {
      const slot = el.dataset.saveSlot;
      await saveToSlot(slot);
      state.ui.showSaveModal = false;
      notify(`Saved to ${SLOT_LABELS[slot] || slot}`, "success");
    });
  });
  (_t = document.getElementById("btn-main-menu")) == null ? void 0 : _t.addEventListener("click", async () => {
    if (state.seasonMode) { exitSeasonRun(); return; }
    await refreshSaves();
    navigate("mainmenu");
  });
  document.getElementById("btn-sc-exit")?.addEventListener("click", () => exitSeasonRun());
  document.getElementById("btn-sc-standings")?.addEventListener("click", () => {
    state.ui.seasonComplete = null;
    setGroupTab("season", "standings");
    navigate("season");
  });
  document.querySelectorAll("[data-result-tab]").forEach((el) => {
    el.addEventListener("click", () => {
      state.ui.gameResultTab = el.dataset.resultTab;
      renderApp();
    });
  });
  document.querySelectorAll("[data-watch-highlight]").forEach((el) => {
    el.addEventListener("click", () => {
      const pair = String(el.dataset.watchHighlight || "").split(":").map((v) => parseInt(v, 10));
      if (Number.isFinite(pair[0]) && Number.isFinite(pair[1]) && state.ui.lastGameResult) openResultHighlight(state.ui.lastGameResult, pair[0], pair[1]);
    });
  });
  document.querySelectorAll("[data-watch-reel]").forEach((el) => {
    el.addEventListener("click", () => { if (state.ui.lastGameResult) openResultHighlightReel(state.ui.lastGameResult); });
  });
  (_u = document.getElementById("close-game-result")) == null ? void 0 : _u.addEventListener("click", () => {
    if (state._instantClassicReplay) {
      closeInstantClassicReplay();
      return;
    }
    if (state.coachWeek) { afterCoachedGameResultClose(); return; }
    state.ui.showGameResult = false;
    renderApp();
  });
  (_v = document.getElementById("close-game-result-btn")) == null ? void 0 : _v.addEventListener("click", () => {
    if (state._instantClassicReplay) {
      closeInstantClassicReplay();
      return;
    }
    if (state.coachWeek) { afterCoachedGameResultClose(); return; }
    state.ui.showGameResult = false;
    state.ui.lastGameResult = null;
    renderApp();
  });
  (_w = document.getElementById("game-result-overlay")) == null ? void 0 : _w.addEventListener("click", (e) => {
    if (e.target.id !== "game-result-overlay") return;
    if (state._instantClassicReplay) {
      closeInstantClassicReplay();
      return;
    }
    if (state.coachWeek) { afterCoachedGameResultClose(); return; }
    state.ui.showGameResult = false;
    renderApp();
  });
  if (state.ui.showGameResult && (state.ui.gameResultTab || "boxscore") === "watch" && state.ui.lastGameResult) {
    initWatchMode(state.ui.lastGameResult, ((_x = state.ui.lastGameResult.homeSchool) == null ? void 0 : _x.id) === ((_y = getPlayerSchool()) == null ? void 0 : _y.id));
  }
  if (state.ui.liveWatch) mountLiveWatch();
  (_z = document.getElementById("watch-live-toggle")) == null ? void 0 : _z.addEventListener("change", (e) => {
    state.settings = state.settings || {};
    state.settings.liveWatch = e.target.checked;
  });
  document.querySelectorAll("[data-kickoff]").forEach((b) => b.addEventListener("click", () => chooseKickoffMode(b.dataset.kickoff)));
  (_A = document.getElementById("kickoff-coachmode")) == null ? void 0 : _A.addEventListener("click", () => {
    if (!state.settings) state.settings = {};
    state.settings.liveWatch = state.settings.liveWatch === false;
    renderApp();
  });
  (_B = document.getElementById("kickoff-sim-half")) == null ? void 0 : _B.addEventListener("click", () => chooseKickoffMode("off"));
  (_C = document.getElementById("kickoff-cancel")) == null ? void 0 : _C.addEventListener("click", () => {
    state.ui.pendingKickoff = null;
    state._pregamePlan = null;
    renderApp();
  });
  {
    const root = document.getElementById("kickoff-adjust");
    const gp = state._pregamePlan || ((_D = getPlayerSchool()) == null ? void 0 : _D.gameplan);
    if (root && gp) wireDefaultsListeners(gp, { root });
  }
  document.querySelectorAll("[data-cs-form]").forEach((b) => b.addEventListener("click", () => {
    state.ui.callFormation = b.dataset.csForm === "__auto" ? null : b.dataset.csForm;
    // Stage 4: a pin is a LOOK from your book — id + variation (Base = none).
    state.ui.callVariation = state.ui.callFormation ? b.dataset.csVar || null : null;
    rerender();
  }));
  const _PASS_DRILLS = ["quick", "dropback", "shots"];
  const _RUN_DRILLS = ["inside", "perimeter", "gadgets"];
  const _clearLockedDrill = () => {
    const g = state.ui.callDrill && state.ui.callDrill.grp;
    if (!g) return;
    if (state.ui.callPA && _RUN_DRILLS.includes(g)) state.ui.callDrill = null;
    if ((state.ui.callRPO || state.ui.callQBRun) && (_PASS_DRILLS.includes(g) || g === "gadgets")) state.ui.callDrill = null;
  };
  document.querySelectorAll("[data-cs-pa]").forEach((b) => b.addEventListener("click", () => {
    if (b.disabled) return;
    state.ui.callPA = !state.ui.callPA;
    if (state.ui.callPA) {
      state.ui.callRPO = false;
      state.ui.callQBRun = false;
    }
    _clearLockedDrill();
    rerender();
  }));
  document.querySelectorAll("[data-cs-rpo]").forEach((b) => b.addEventListener("click", () => {
    if (b.disabled) return;
    state.ui.callRPO = !state.ui.callRPO;
    if (state.ui.callRPO) {
      state.ui.callPA = false;
      state.ui.callQBRun = false;
    }
    _clearLockedDrill();
    rerender();
  }));
  document.querySelectorAll("[data-cs-qbrun]").forEach((b) => b.addEventListener("click", () => {
    if (b.disabled) return;
    state.ui.callQBRun = !state.ui.callQBRun;
    if (state.ui.callQBRun) {
      state.ui.callPA = false;
      state.ui.callRPO = false;
    }
    _clearLockedDrill();
    rerender();
  }));
  document.querySelectorAll("[data-cs-timeout]").forEach((b) => b.addEventListener("click", () => {
    state.ui.callTimeout = !state.ui.callTimeout;
    if (state.ui.callTimeout) {
      state.ui.timeoutAdjust = { tab: "next" };
    } else {
      state.ui.timeoutAdjust = null;
      const gpL = _liveGPMine();
      if (gpL) delete gpL._nextPlay;
    }
    rerender();
  }));
  document.querySelectorAll("[data-to-tab]").forEach((b) => b.addEventListener("click", () => {
    if (state.ui.timeoutAdjust) {
      state.ui.timeoutAdjust.tab = b.dataset.toTab;
      rerender();
    }
  }));
  document.querySelectorAll("[data-tonp-field]").forEach((b) => b.addEventListener("click", () => {
    const gpL = _liveGPMine();
    if (!gpL) return;
    const field = b.dataset.tonpField;
    let val = b.dataset.tonpVal;
    const np = gpL._nextPlay || (gpL._nextPlay = {});
    if (field === "passDepth") {
      const PRESETS = { quick: { short: 60, medium: 30, deep: 10 }, balanced: { short: 40, medium: 40, deep: 20 }, deep: { short: 25, medium: 35, deep: 40 } };
      if (np._depthKey === val) {
        delete np.passDepth;
        delete np._depthKey;
      } else {
        np.passDepth = __spreadValues({}, PRESETS[val]);
        np._depthKey = val;
      }
    } else {
      if (field === "qbAggr") val = parseInt(val, 10);
      if (np[field] === val) delete np[field];
      else np[field] = val;
    }
    if (Object.keys(np).length === 0) delete gpL._nextPlay;
    rerender();
  }));
  {
    const _toBreak = document.getElementById("to-break");
    if (_toBreak) _toBreak.addEventListener("click", () => {
      state.ui.timeoutAdjust = null;
      rerender();
    });
    const _toCancel = document.getElementById("to-cancel");
    if (_toCancel) _toCancel.addEventListener("click", () => {
      state.ui.callTimeout = false;
      state.ui.timeoutAdjust = null;
      const gpL = _liveGPMine();
      if (gpL) delete gpL._nextPlay;
      rerender();
    });
  }
  document.querySelectorAll("[data-cs-st-toggle]").forEach((b) => b.addEventListener("click", () => {
    state.ui.callSTOpen = !state.ui.callSTOpen;
    rerender();
  }));
  document.querySelectorAll("[data-cs-st]").forEach((b) => b.addEventListener("click", () => {
    if (b.disabled || !callTapOk()) return;
    state.ui.callSTOpen = false;
    answerPlayCall({ specialTeams: b.dataset.csSt });
  }));
  const _decorateCall = (call) => {
    if (state.ui.callFormation) {
      call.formationId = state.ui.callFormation;
      // Stage 4: the pinned LOOK's variation rides the call (sim already
      // honors forcedCall.variation — P1b).
      if (state.ui.callVariation) call.variation = state.ui.callVariation;
    }
    if (state.ui.callPA) call.playAction = true;
    if (state.ui.callRPO) call.rpo = true;
    if (state.ui.callQBRun) call.qbRun = true;
    if (state.ui.callTimeout) call.timeout = true;
    return call;
  };
  document.querySelectorAll("[data-cs-drill]").forEach((b) => b.addEventListener("click", () => {
    if (b.disabled) return;
    const grp = b.dataset.csDrill;
    state.ui.callDrill = { grp, cat: b.dataset.csCat };
    state.ui.callConceptPreview = null;
    if (_RUN_DRILLS.includes(grp)) state.ui.callPA = false;
    if (_PASS_DRILLS.includes(grp)) {
      state.ui.callRPO = false;
      state.ui.callQBRun = false;
    }
    rerender();
  }));
  const _drillBackBtn = document.querySelector("[data-cs-drillback]");
  if (_drillBackBtn) _drillBackBtn.addEventListener("click", () => {
    state.ui.callDrill = null;
    state.ui.callConceptPreview = null;
    rerender();
  });
  document.querySelectorAll("[data-cs-concept]").forEach((b) => b.addEventListener("click", () => {
    if (!callTapOk()) return;
    state.ui.callDrill = null;
    state.ui.callConceptPreview = null;
    answerPlayCall(_decorateCall({ category: b.dataset.csCat }));
  }));
  document.querySelectorAll("[data-cs-preview]").forEach((b) => b.addEventListener("click", () => {
    state.ui.callConceptPreview = b.dataset.csPreview;
    rerender();
  }));
  (_E = document.querySelector("[data-cs-previewback]")) == null ? void 0 : _E.addEventListener("click", () => {
    state.ui.callConceptPreview = null;
    rerender();
  });
  document.querySelectorAll("[data-cs-callconcept]").forEach((b) => b.addEventListener("click", () => {
    if (!callTapOk()) return;
    const nm = b.dataset.csCallconcept;
    state.ui.callDrill = null;
    state.ui.callConceptPreview = null;
    answerPlayCall(_decorateCall({ concept: nm }));
  }));
  // Stage 4 (Playbook-Root): call a COMPOSED play from the book. The call
  // carries the play's composed source; the sim compiles it through the proven
  // band-clamped rulebook (compilePlay) — human-call-only by construction.
  document.querySelectorAll("[data-cs-callcustom]").forEach((b) => b.addEventListener("click", () => {
    if (!callTapOk()) return;
    const data = _composedCallData(b.dataset.csCallcustom);
    if (!data) return;
    state.ui.callDrill = null;
    state.ui.callConceptPreview = null;
    answerPlayCall(_decorateCall({ customPlay: b.dataset.csCallcustom, customPlayData: data }));
  }));
  // PASS 2: named-call chips on the headset — one tap pre-fills every dial
  // the call names (BOX translated to the panel's relative shove); the coach
  // can still adjust any dial on top before sending.
  document.querySelectorAll("[data-dc-callname]").forEach((b) => b.addEventListener("click", () => {
    var _a2, _b2, _c2;
    const nm = b.dataset.dcCallname;
    if (nm === "__clear" || state.ui.defCallName === nm) {
      state.ui.defCallName = null;
      rerender();
      return;
    }
    // Stage 4: the chips read the defensive BOOK's named calls (defBookCalls —
    // defbook.calls when Stage 3 lands it, the book's plan.defCalls snapshot
    // today, the flat gameplan for pre-book saves).
    const call = (_a2 = defBookCalls(getPlayerSchool())) == null ? void 0 : _a2[nm];
    if (!call) return;
    const sel = {};
    for (const f of ["front", "aggression", "covShell", "covStyle", "edgePlay", "robberCall", "zoneStyle", "pressureIdentity"]) {
      if (call[f] != null && call[f] !== "auto") sel[f] = String(call[f]);
    }
    // PASS 3: the call's family/rotation/rush ride the package invisibly —
    // ingredients of the CALL, not dials of the panel (owner call: display
    // chips only). Touching SHELL or STYLE below clears the family pin.
    if (call.covFamily != null) sel.covFamily = String(call.covFamily);
    if (call.rotation != null) sel.rotation = String(call.rotation);
    if (call.rush3) sel.rush3 = true;
    // PASS 4: the pressure flavors ride the package the same way.
    if (call.pressLook != null) sel.pressLook = String(call.pressLook);
    if (call.dogGame != null) sel.dogGame = String(call.dogGame);
    if (call.runCommit != null) {
      // A call's BOX is absolute; the panel's runCommit is a relative shove
      // (dc-send adds the standing plan back before answering).
      const standingRC = state.pendingHalftime?.token?.pending?.drive?.sit?.standing?.runCommit || 0;
      sel.runCommit = String(call.runCommit - standingRC);
    }
    state.ui.defCall = sel;
    state.ui.defCallName = nm;
    rerender();
  }));
  // F1: defensive headset chips — toggle a per-snap pin, then send or ride.
  document.querySelectorAll("[data-dc-field]").forEach((b) => b.addEventListener("click", () => {
    const f = b.dataset.dcField, v = b.dataset.dcVal;
    const sel = state.ui.defCall || (state.ui.defCall = {});
    if (sel[f] === v) delete sel[f];
    else sel[f] = v;
    // PASS 3: you overrode the coverage by hand — the pinned family (whose
    // implied shell/style would fight your adjustment) comes off the call.
    if ((f === "covShell" || f === "covStyle") && sel.covFamily != null) delete sel.covFamily;
    // PASS 4: you overrode the pressure design by hand — the look and the
    // dog game (which are the design) come off the call.
    if (f === "pressureIdentity" && (sel.pressLook != null || sel.dogGame != null)) {
      delete sel.pressLook;
      delete sel.dogGame;
    }
    rerender();
  }));
  document.querySelectorAll("[data-dc-clear]").forEach((b) => b.addEventListener("click", () => {
    const sel = state.ui.defCall || {};
    delete sel[b.dataset.dcClear];
    rerender();
  }));
  (document.getElementById("dc-send") || {}).onclick = () => {
    if (!callTapOk()) return;
    state.ui.defCallName = null;
    const sel = state.ui.defCall || {};
    if (!Object.keys(sel).length) { answerPlayCall({ concept: "sheet" }); return; }
    const call = __spreadProps(__spreadValues({}, sel), { _def: true });
    if (call.runCommit != null) {
      // BOX chips are a one-snap shove relative to the standing plan, not an
      // absolute box count — applyDefCall clamps the sum to the same ±25 law.
      const standingRC = state.pendingHalftime?.token?.pending?.drive?.sit?.standing?.runCommit || 0;
      call.runCommit = standingRC + parseInt(call.runCommit, 10);
    }
    answerPlayCall(call);
  };
  (_F = document.getElementById("cs-sheet-call")) == null ? void 0 : _F.addEventListener("click", () => {
    if (callTapOk()) answerPlayCall({ concept: "sheet" });
  });
  document.querySelectorAll("[data-fourth]").forEach((b) => b.addEventListener("click", () => {
    if (!b.disabled && callTapOk()) answerFourthDown(b.dataset.fourth);
  }));
  (_G = document.getElementById("fourth-auto")) == null ? void 0 : _G.addEventListener("click", () => {
    if (callTapOk()) answerFourthDown("auto");
  });
  (_L = document.getElementById("cs-recover")) == null ? void 0 : _L.addEventListener("click", () => {
    var _a2, _b2;
    const t = (_a2 = state.pendingHalftime) == null ? void 0 : _a2.token;
    if (((_b2 = t == null ? void 0 : t.pending) == null ? void 0 : _b2.kind) === "fourth") {
      answerFourthDown("auto");
      return;
    }
    if (t == null ? void 0 : t.pending) {
      answerPlayCall({ concept: "sheet" });
      return;
    }
    state.ui.liveWatch = null;
    renderApp();
  });
  document.querySelectorAll("[data-cs-quickcat]").forEach((btn) => btn.addEventListener("click", () => {
    if (callTapOk()) answerPlayCall({ category: btn.dataset.csQuickcat });
  }));
  wireTimeControls();
}
// M4 — the transport row + involvement toggle, wired in one place. Rendered
// by timeControlBar() into the call sheet, the fourth-down panel AND the live
// watch bar; this runs after every render pass (and mountLiveWatch injects
// before it runs), so every copy on screen is live. The old row's dead
// cs-skip-quarter / cs-autorun listeners and the tc-tempo chips are gone —
// tempo is hurry-up/chew-clock STRATEGY and lives with the game plan
// (Game Plan → Tempo & Motion, and the timeout modal's Rest of Game tab).
function wireTimeControls() {
  var _a, _b, _c;
  document.querySelectorAll("[data-tc-invo]").forEach((b) => b.addEventListener("click", () => {
    if (!callTapOk()) return;
    const level = b.dataset.tcInvo;
    if (level === involvementLevel()) return;
    setInvolvement(level);
  }));
  (_a = document.getElementById("tc-simposs")) == null ? void 0 : _a.addEventListener("click", () => {
    if (callTapOk()) simToPossessionEnd();
  });
  (_b = document.getElementById("tc-skipbreak")) == null ? void 0 : _b.addEventListener("click", () => {
    if (callTapOk()) simToBreak();
  });
  // Take control NEXT SNAP: cut the board short, keep the headset. (The toggle
  // set to Every Play waits for the backlog to finish; this one doesn't.)
  (_c = document.getElementById("tc-takeover")) == null ? void 0 : _c.addEventListener("click", () => {
    var _a2;
    if (!callTapOk()) return;
    state.ui.autoRun = false;
    const t = (_a2 = state.pendingHalftime) == null ? void 0 : _a2.token;
    if (t) t.callMode = "all";
    if (state.settings) state.settings.lastCallMode = "all";
    watchStop();
    _watch = null;
    if (state.ui.liveWatch) state.ui.liveWatch.boardDone = true;
    renderApp();
  });
}
function wireGroupTabs() {
  document.querySelectorAll("[data-team-tab]").forEach((b) => b.addEventListener("click", () => {
    setGroupTab("team", b.dataset.teamTab);
    rerender();
  }));
  document.querySelectorAll("[data-program-tab]").forEach((b) => b.addEventListener("click", () => {
    setGroupTab("program", b.dataset.programTab);
    rerender();
  }));
  document.querySelectorAll("[data-season-tab]").forEach((b) => b.addEventListener("click", () => {
    setGroupTab("season", b.dataset.seasonTab);
    rerender();
  }));
  document.querySelectorAll("[data-statsgroup-tab]").forEach((b) => b.addEventListener("click", () => {
    setGroupTab("statsgroup", b.dataset.statsgroupTab);
    rerender();
  }));
}
function setupTeamGroupListeners() {
  wireGroupTabs();
  if (teamGroupTab === "depthchart") setupListeners9();
  else if (teamGroupTab === "practice") setupListeners17();
  else setupListeners7();
}
function setupProgramGroupListeners() {
  wireGroupTabs();
  setupListeners18();
}
function setupSeasonGroupListeners() {
  wireGroupTabs();
  if (seasonGroupTab === "standings") setupListeners13();
  else setupListeners11();
}
function setupStatsGroupListeners() {
  wireGroupTabs();
  if (statsGroupTab === "awards") setupListeners4();
  else if (statsGroupTab === "history") setupListeners16();
  else setupListeners14();
}
function setupViewListeners(view) {
  const listeners = {
    dashboard: setupListeners6,
    team: setupTeamGroupListeners,
    program: setupProgramGroupListeners,
    season: setupSeasonGroupListeners,
    statsgroup: setupStatsGroupListeners,
    scout: setupListeners8,
    gameplan: setupListeners,
    recruiting: setupListeners10,
    settings: setupListeners15,
    manual: setupListeners12,
    scheduling: setupListeners5,
    // legacy ids route to their group listeners
    roster: setupTeamGroupListeners,
    depthchart: setupTeamGroupListeners,
    practice: setupTeamGroupListeners,
    coachoffice: setupProgramGroupListeners,
    schedule: setupSeasonGroupListeners,
    standings: setupSeasonGroupListeners,
    stats: setupStatsGroupListeners,
    awards: setupStatsGroupListeners,
    history: setupStatsGroupListeners
  };
  try {
    (listeners[view] || (() => {
    }))();
  } catch (e) {
    console.error("setupViewListeners:", e);
  }
}
async function init() {
  var _a;
  setRenderFn(renderApp);
  setNotifyFn(patchToast);
  window.__playReplayClip = openReplayClip;
  await refreshSaves();
  state.ui.view = "mainmenu";
  renderApp();
  installSaveGuards();
  try {
    if (new URLSearchParams(location.search).has("dev") || location.hash.replace("#", "") === "dev") {
      const m = await import('./views/newgame.js');
      (_a = m.devTakeJobStart) == null ? void 0 : _a.call(m);
    }
  } catch (e) {
    console.error("[dev] quick-start failed:", e);
  }
}
function installSaveGuards() {
  const flushNow = () => {
    try {
      if (!(state && state.world && state.playerSchoolId && !state._exhibition)) return;
      // Season Mode flushes to its OWN dedicated slot and never to "auto" (which
      // would collide with a dynasty), and stops once the season is over.
      if (state.seasonMode) { if (!state.seasonOver) flushSaveSync(state, "season"); return; }
      flushSaveSync(state, state._saveSlot || "auto");
    } catch (e) {
    }
  };
  window.addEventListener("pagehide", flushNow);
  window.addEventListener("beforeunload", flushNow);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushNow();
  });
  setInterval(() => {
    if (!(state && state.world && state.playerSchoolId && !state._exhibition)) return;
    if (state.seasonMode) { if (!state.seasonOver) saveGame(state, "season").catch(() => {}); return; }
    if (state._saveSlot) saveGame(state, state._saveSlot).catch(() => {});
  }, 3e4);
}
function renderKickoffModal() {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i;
  const k = state.ui.pendingKickoff;
  if (!k) return "";
  const school = getPlayerSchool();
  const gp = state._pregamePlan || (school == null ? void 0 : school.gameplan) || {};
  const next = getUpcomingGame();
  const isHome = next ? next.homeId === (school == null ? void 0 : school.id) : true;
  const opp = next ? (_b = (_a = state.world) == null ? void 0 : _a.schools) == null ? void 0 : _b.find((s) => s.id === (isHome ? next.awayId : next.homeId)) : null;
  // M4: legacy "off" (headset off, watch in bulk) maps onto the WATCH level.
  const _lastRaw = ((_c = state.settings) == null ? void 0 : _c.lastCallMode) || "watch";
  const last = _lastRaw === "off" ? "watch" : _lastRaw;
  let scoutHtml = "";
  if (opp) {
    const og = opp.gameplan || {};
    const topForm = (Array.isArray(og.offFormations) && og.offFormations.length ? og.offFormations.slice().sort((a, b) => (b.weight || 0) - (a.weight || 0))[0].id : og.offFormation) || "Single Back";
    const passPct = Math.round(((_d = PASS_TENDENCY[og.tendency]) != null ? _d : 0.5) * 100);
    const threats = (opp.roster || []).filter((p) => ["QB", "RB", "WR", "TE"].includes(p.position)).sort((a, b) => b.compositeRating - a.compositeRating).slice(0, 2);
    const threatStr = threats.map((p) => `<span class="player-link" data-pcard="${p.id}">${escapeHtml(`${p.name.first[0]}. ${p.name.last}`)}</span> (${p.position} ${Math.round(p.compositeRating)})`).join(" and ");
    const bp = (_e = og.blitzPct) != null ? _e : 20;
    const pressure = bp >= 30 ? "blitz-happy \u2014 keep a back in to chip" : bp <= 12 ? "rarely blitzes \u2014 you'll have time to throw" : "balanced pressure";
    const memo = `They're a ${escapeHtml(topForm)} outfit \u2014 ${escapeHtml(og.tendency || "Balanced")} (${passPct}% pass).` + (threatStr ? ` It runs through ${threatStr}.` : "") + ` Their D: ${escapeHtml(og.defBaseFront || "4-3")} base, ${escapeHtml(pressure)}.`;
    const avgOf = (roster, poss) => {
      const l = (roster || []).filter((p) => poss.includes(p.position));
      return l.length ? l.reduce((s, p) => s + p.compositeRating, 0) / l.length : 50;
    };
    const keys = [];
    if (bp >= 30) keys.push("They bring heat \u2014 lean Quick Game / Protection to get the ball out.");
    else if (bp <= 12) keys.push("They rush four and sit back \u2014 take your shots downfield.");
    if (passPct >= 60) keys.push(`${passPct}% pass \u2014 extra DBs (Nickel/Dime) can live on the field.`);
    else if (passPct <= 40) keys.push(`${100 - passPct}% run \u2014 stack the box and make the QB beat you.`);
    if (avgOf(school == null ? void 0 : school.roster, ["WR", "TE"]) - avgOf(opp.roster, ["CB", "S"]) >= 5) keys.push("Your receivers outclass their secondary \u2014 Attack Deep is live.");
    if (avgOf(opp.roster, ["DE", "DT", "OLB", "LB"]) - avgOf(school == null ? void 0 : school.roster, ["OL"]) >= 5) keys.push("Their front outclasses your line \u2014 quick game + up-tempo keep the QB clean.");
    const ocw = og.conceptWeights || {};
    const topC = Object.entries(ocw).filter(([, w]) => (w || 0) > 55).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n]) => n);
    if (topC.length) keys.push(`Their call sheet leans ${topC.join(", ")} \u2014 expect those beaters.`);
    scoutHtml = `<div class="kickoff-scout">
      <div class="kickoff-scout-memo">"${memo}" <span class="tw-memo-sig">\u2014 your staff's scout</span></div>
      ${keys.slice(0, 4).map((kk) => `<div class="tw-key">\u25B8 ${escapeHtml(kk)}</div>`).join("")}
    </div>`;
  }
  const opt = (id, icon, title, desc) => `
  <button class="kickoff-opt${last === id ? " selected" : ""}" data-kickoff="${id}">
    <span class="kickoff-opt-icon">${icon}</span>
    <span class="kickoff-opt-text">
      <span class="kickoff-opt-title">${title}${last === id ? ' <span class="kickoff-last">last time</span>' : ""}</span>
      <span class="kickoff-opt-desc">${desc}</span>
    </span>
  </button>`;
  return `
  <div class="modal-overlay kickoff-overlay kickoff-prep">
    <div class="modal kickoff-modal">
      <div class="modal-header"><h2>\u{1F3C8} Game Day \u2014 ${isHome ? "vs" : "@"} ${escapeHtml((opp == null ? void 0 : opp.name) || k.opponent)}</h2>
        <button class="kickoff-cancel" id="kickoff-cancel">\u2190 Back to prep</button></div>
      <div class="kickoff-body">
        ${scoutHtml}
        <div class="kickoff-section-label">DIAL IN THIS GAME'S PLAN</div>
        <div class="kickoff-adjust" id="kickoff-adjust">${renderHalftimeAdjust(gp)}</div>
        <div class="kickoff-simtype">
          <div class="kickoff-coachmode">
            <button class="cm-switch${((_f = state.settings) == null ? void 0 : _f.liveWatch) !== false ? " on" : ""}" id="kickoff-coachmode" role="switch" aria-checked="${((_g = state.settings) == null ? void 0 : _g.liveWatch) !== false}">
              <span class="cm-track"><span class="cm-thumb"></span></span>
              <span class="cm-text">
                <span class="cm-name">\u25B6 Coach Mode</span>
                <span class="cm-sub">${((_h = state.settings) == null ? void 0 : _h.liveWatch) !== false ? "Watch it live and coach between calls" : "Off \u2014 you'll sim the game instead"}</span>
              </span>
            </button>
          </div>
          ${((_i = state.settings) == null ? void 0 : _i.liveWatch) !== false ? `
          <div class="kickoff-section-label">HOW MUCH OF THE HEADSET DO YOU WANT?</div>
          ${opt("watch", "\u{1F441}", "Watch Every Play", "The sheet calls it, the board plays every snap \u2014 and the headset is one tap away all game.")}
          ${opt("keydowns", "\u{1F3AF}", "Coach the Big Moments", "4th downs, the red zone, inside two minutes, a one-score 4th quarter \u2014 the sheet opens pre-snap when it matters.")}
          ${opt("all", "\u{1F3A7}", "Coach Every Play", "Full coordinator mode \u2014 every play on offense AND defense, plus the big 4th-down calls.")}
          ` : `
          <button class="kickoff-opt kickoff-simhalf" id="kickoff-sim-half">
            <span class="kickoff-opt-icon">\u23E9</span>
            <span class="kickoff-opt-text">
              <span class="kickoff-opt-title">Sim to Halftime \u2192</span>
              <span class="kickoff-opt-desc">Play the first half out instantly. You'll get the locker room at the break \u2014 flip Coach Mode back on to take the second half, or sim to the final.</span>
            </span>
          </button>
          `}
        </div>
      </div>
    </div>
  </div>`;
}
function renderCallFeed(token) {
  var _a;
  const feed = state.ui.callFeed || [];
  if (!feed.length) return "";
  const names = {};
  for (const pl of [...token.homeRoster || [], ...token.awayRoster || []]) {
    names[pl.id] = { name: `${pl.name.first[0]}. ${pl.name.last}`, pos: pl.position };
  }
  const mySide = ((_a = token.pending) == null ? void 0 : _a.possession) || token.playerSide || "home";
  const items = feed.slice(-8).map(({ p, poss, sum }) => {
    const mine = poss === mySide;
    if (sum) {
      // M4: a skipped stretch reads as one summary line per drive — never silence.
      const team = (poss === "home" ? token.homeSchool : token.awaySchool)?.abbr || (poss === "home" ? "HOME" : "AWAY");
      const RESULT_LBL = { touchdown: "TOUCHDOWN", field_goal: "FIELD GOAL", punt: "punt", turnover: "TURNOVER", turnover_on_downs: "turnover on downs", missed_fg: "missed FG", end_half: "end of half", safety: "SAFETY", punt_return_td: "PUNT RETURN TD", live: "drive alive" };
      const big = sum.result === "touchdown" || sum.result === "turnover" || sum.result === "field_goal" || sum.result === "safety" || sum.result === "punt_return_td";
      return `<div class="cs-feed-item cs-feed-sum${mine ? " mine" : " theirs"}${big ? " big" : ""}">${mine ? "▶" : "◀"} ⏩ ${escapeHtml(team)} drive: ${sum.plays} play${sum.plays === 1 ? "" : "s"}, ${sum.yards >= 0 ? "" : "−"}${Math.abs(sum.yards)} yds — ${RESULT_LBL[sum.result] || "over"}</div>`;
    }
    let tag = "";
    if (p.td) tag = " \u2014 <b>TOUCHDOWN</b>";
    else if (p.turnover) tag = p.turnoverType === "interception" ? " \u2014 <b>INTERCEPTED</b>" : " \u2014 <b>FUMBLE</b>";
    else if (p.type === "fg") tag = p.made ? " \u2014 <b>GOOD</b>" : " \u2014 no good";
    const big = p.td || p.turnover || p.type === "fg" && p.made;
    return `<div class="cs-feed-item${mine ? " mine" : " theirs"}${big ? " big" : ""}">${mine ? "\u25B6" : "\u25C0"} ${describePlay(p, names).text}${tag}</div>`;
  }).join("");
  return `<div class="cs-feed">${feed.length > 8 ? `<div class="cs-feed-more">\u2026${feed.length - 8} earlier plays</div>` : ""}${items}</div>`;
}
function renderCallSheetModal() {
  if (!state.ui.showCallSheet) return "";
  const body = callSheetPanelHtml();
  if (!body) return "";
  return `
  <div class="modal-overlay callsheet-overlay">
    <div class="modal callsheet-modal">${body}</div>
  </div>`;
}
// W4 (decision #6): the timeout screen. "Next Play Only" arms one-snap
// overrides on the live plan copy (gp._nextPlay); "Rest of Game" is the real
// halftime-adjust menus, live from the sideline.
function renderTimeoutAdjustModal(gp, toLeft, school) {
  var _a;
  const tab = ((_a = state.ui.timeoutAdjust) == null ? void 0 : _a.tab) || "next";
  const np = gp._nextPlay || {};
  const chipRow = (label, rows) => `
    <div class="ht-adj-row">
      <div class="ht-adj-head"><span class="ht-adj-label">${label}</span></div>
      <div class="gp-options ht-adj-opts">${rows}</div>
    </div>`;
  const chips = (field, opts, cur) => opts.map(([val, lbl]) => `
    <button class="gp-option gp-option-sm${String(cur) === String(val) ? " active" : ""}"
            data-tonp-field="${field}" data-tonp-val="${val}">${lbl}</button>`).join("");
  const nextLayer = `
    <div class="gp-tip tip-info">▸ One snap only — the huddle hears THIS. Anything untouched runs as planned; it all evaporates after the next play.</div>
    ${chipRow("Play Lean", chips("tendency", [["Heavy Run", "Run It"], ["Balanced", "Balanced"], ["Heavy Pass", "Air It"]], np.tendency != null ? np.tendency : "__none"))}
    ${chipRow("Passing Attack", chips("passDepth", [["quick", "Quick Game"], ["balanced", "Balanced"], ["deep", "Take a Shot"]], np._depthKey != null ? np._depthKey : "__none"))}
    ${chipRow("Protection", chips("protIdentity", C.PROT_IDENTITY.order.map((v) => [v, C.PROT_IDENTITY.labels[v]]), np.protIdentity != null ? np.protIdentity : "__none"))}
    ${chipRow("QB Leash", chips("qbAggr", [["30", "Protect It"], ["50", "Neutral"], ["70", "Push It"]], np.qbAggr != null ? np.qbAggr : "__none"))}`;
  const gameLayer = `
    <div class="gp-tip tip-info">▸ The standing plan for the rest of the game — same knobs as the locker room, live from the sideline. Holds until another timeout (or halftime) changes it.</div>
    <div id="to-adjust-root">${renderHalftimeAdjust(gp)}</div>`;
  return `
    <div class="modal-overlay to-adjust-overlay">
      <div class="modal to-adjust-modal">
        <div class="modal-header">
          <h2>⏱️ TIMEOUT — ${escapeHtml((school == null ? void 0 : school.name) || "You")} <span class="muted">(${toLeft} left this half)</span></h2>
        </div>
        <div class="rec-tabs" style="margin:0 16px">
          <button class="rec-tab${tab === "next" ? " active" : ""}" data-to-tab="next">Next Play Only</button>
          <button class="rec-tab${tab === "game" ? " active" : ""}" data-to-tab="game">Rest of Game</button>
        </div>
        <div class="to-adjust-body" style="padding:10px 16px; max-height:60vh; overflow-y:auto">
          ${tab === "next" ? nextLayer : gameLayer}
        </div>
        <div class="modal-footer" style="display:flex; gap:10px; padding:12px 16px">
          <button class="btn primary" id="to-break" style="flex:1">✓ Break the Huddle</button>
          <button class="btn-ghost" id="to-cancel">✋ Cancel Timeout</button>
        </div>
      </div>
    </div>`;
}
// The live gameplan copy for the player's side (the timeout modal writes its
// one-snap overrides here). Mirrors the call sheet's side resolution.
function _liveGPMine() {
  var _a, _b, _c;
  const tk = (_a = state.pendingHalftime) == null ? void 0 : _a.token;
  if (!tk) return null;
  const ps = getPlayerSchool();
  const side = ((_b = tk.pending) == null ? void 0 : _b.possession) || tk.playerSide || (((_c = tk.homeSchool) == null ? void 0 : _c.id) === (ps == null ? void 0 : ps.id) ? "home" : "away");
  return side === "home" ? tk.homeGP : tk.awayGP;
}
function renderTimeoutAdjustOverlay() {
  var _a, _b, _c, _d, _e, _f;
  if (!state.ui.showCallSheet || !state.ui.callTimeout || !state.ui.timeoutAdjust) return "";
  const token = (_a = state.pendingHalftime) == null ? void 0 : _a.token;
  if (!(token == null ? void 0 : token.pending)) return "";
  const playerSchool = getPlayerSchool();
  const mySide = ((_b = token.pending) == null ? void 0 : _b.possession) || token.playerSide || (((_c = token.homeSchool) == null ? void 0 : _c.id) === (playerSchool == null ? void 0 : playerSchool.id) ? "home" : "away");
  const school = mySide === "home" ? token.homeSchool : token.awaySchool;
  const gp = token[`${mySide}GP`] || {};
  const _to = token.timeouts || {};
  const toLeft = (_f = _to[mySide]) != null ? _f : C.TIMEOUTS_PER_HALF;
  return renderTimeoutAdjustModal(gp, toLeft, school);
}
// M4 \u2014 the involvement toggle + transport row (#51/#54/#55). One component,
// rendered on the call sheet, the fourth-down panel, the defensive call panel
// and the live watch bar; wireTimeControls() is its single wiring point.
// Tempo is NOT here \u2014 it's hurry-up/chew-clock strategy and lives with the
// game plan (Game Plan \u2192 Tempo & Motion; timeout modal \u2192 Rest of Game).
function involvementToggleHtml() {
  const cur = involvementLevel();
  const seg = (id, icon, lbl, tip) => `<button class="tc-invo-btn${cur === id ? " active" : ""}" data-tc-invo="${id}" title="${tip}" aria-pressed="${cur === id}">${icon} ${lbl}</button>`;
  return `<span class="tc-invo-group" role="group" aria-label="How much of the headset do you want?">` + seg("watch", "\u{1F441}", "Watch", "Watch every play \u2014 the sheet calls it, the board plays it, and you can take the headset back any time") + seg("moments", "\u{1F3AF}", "Moments", "Coach the big moments \u2014 4th downs, the red zone, inside two minutes, a one-score 4th quarter") + seg("every", "\u{1F3A7}", "Every play", "Coach every play \u2014 full coordinator mode, both sides of the ball") + `</span>`;
}
function timeControlBar() {
  var _a;
  const lw = state.ui.liveWatch;
  const token = (_a = state.pendingHalftime) == null ? void 0 : _a.token;
  if (!(token == null ? void 0 : token.pending) || (lw == null ? void 0 : lw.stage) !== "call") return "";
  const half = token.pending.half;
  const auto = !!state.ui.autoRun;
  const poss = token.pending.possession;
  const mine = poss === (token.playerSide || poss);
  const breakLabel = half === 3 ? "\u23ED\u23ED Sim to final" : half === 1 ? "\u23ED\u23ED Sim to half" : "\u23ED\u23ED Sim to end";
  const possBtn = `<button class="bc-btn bc-text" id="tc-simposs" title="Sim the rest of ${mine ? "this possession" : "their possession"} \u2014 no animation, drive summary in the feed">\u23ED Sim possession</button>`;
  const takeover = auto ? `<button class="bc-btn bc-text tc-coach" id="tc-takeover" title="Take the headset next snap">\u{1F3A7} Take control</button>` : "";
  return `<div class="tc-bar">${involvementToggleHtml()}${possBtn}<button class="bc-btn bc-text" id="tc-skipbreak" title="Sim straight to the ${half === 1 ? "locker room" : "final gun"} \u2014 no animation, drive summaries in the feed">${breakLabel}</button>${takeover}</div>`;
}
var CONCEPT_ROUTE_ART = {
  "Mesh": ["M18 46 L18 31 L44 26 L76 26", "M82 46 L82 31 L56 28 L28 28"],
  "Slant-Flat": ["M18 46 L28 35 L48 22", "M82 46 L82 38 L94 35"],
  "Stick": ["M68 46 L68 27 L58 27", "M86 46 L86 38 L96 35"],
  "Shallow Cross": ["M20 46 L20 33 L42 27 L76 27", "M82 46 L82 18"],
  "Bubble Screen": ["M82 46 L89 42 L94 36", "M66 46 L76 38"],
  "Tunnel Screen": ["M84 46 L94 38 L78 34 L62 28", "M68 46 L78 35"],
  "RB Screen": ["M50 49 L61 44 L74 33", "M68 46 L76 36"],
  "Smash": ["M18 46 L18 31 L30 31", "M82 46 L82 30 L76 20 L64 14"],
  "Curl-Flat": ["M22 46 L22 23 L17 27 L14 31", "M78 46 L78 38 L94 34"],
  "Flood": ["M18 46 L18 12", "M50 46 L62 27 L84 22", "M82 46 L94 36"],
  "Y-Cross": ["M48 46 L48 33 L60 24 L86 18", "M20 46 L20 10"],
  "Dagger": ["M34 46 L34 9", "M68 46 L68 22 L42 22"],
  "Four Verts": ["M14 46 L14 8", "M38 46 L38 8", "M62 46 L62 8", "M86 46 L86 8"],
  "Post-Wheel": ["M22 46 L22 27 L50 10", "M72 46 L84 38 L88 25 L86 9"],
  "PA Deep Cross": ["M24 46 L24 20 L46 12 L82 17", "M78 46 L78 9"],
  "Mills (Post-Dig)": ["M30 46 L30 22 L50 9", "M72 46 L72 22 L45 22"],
  "Red-Zone Fade": ["M82 46 L90 30 L88 12"],
  "Spot": ["M78 46 L78 30 L68 14", "M62 46 L58 36 L68 33", "M88 46 L96 40"],
  "Sail": ["M18 46 L18 10", "M46 46 L46 28 L20 16", "M70 46 L60 42 L36 40"],
  "Levels": ["M20 46 L20 24 L52 24", "M74 46 L70 36 L48 32", "M88 46 L84 40 L66 38"],
  "Sluggo Seam": ["M16 46 L24 38 L18 32 L14 10", "M42 46 L42 10", "M86 46 L86 34 L94 30 L92 12"],
  "Inside Zone": ["M50 49 L50 17"],
  "Power": ["M48 49 L37 38 L55 17"],
  "Iso": ["M50 49 L50 17"],
  "Trap": ["M50 49 L61 35 L48 17"],
  "Outside Zone": ["M50 49 L67 35 L88 20"],
  "Counter": ["M50 49 L35 40 L63 18"],
  "Toss": ["M50 49 L71 45 L92 23"],
  "QB Sneak": ["M50 49 L50 29"],
  "Triple Option": ["M50 49 L50 34 L70 34 L89 18", "M50 49 L39 34 L28 18"],
  "Speed Option": ["M50 49 L69 39 L90 19"],
  "Jet Sweep": ["M18 43 L50 43 L72 34 L91 20"],
  "QB Power": ["M50 51 L41 40 L57 18"],
  "Draw": ["M50 49 L50 38 L55 28 L50 17"],
  "Wildcat Power": ["M50 49 L39 35 L62 17"]
};
function conceptRouteArrow(d, run) {
  const nums = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
  if (nums.length < 4) return "";
  const x2 = nums[nums.length - 2], y2 = nums[nums.length - 1];
  const x1 = nums[nums.length - 4], y1 = nums[nums.length - 3];
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
  const size = run ? 4.8 : 4.1, wing = run ? 2.7 : 2.25;
  const bx = x2 - ux * size, by = y2 - uy * size;
  const px = -uy * wing, py = ux * wing;
  const points = `${x2.toFixed(2)},${y2.toFixed(2)} ${(bx + px).toFixed(2)},${(by + py).toFixed(2)} ${(bx - px).toFixed(2)},${(by - py).toFixed(2)}`;
  return `<polygon class="cs-route-arrow${run ? " cs-route-arrow-run" : ""}" points="${points}"/>`;
}
function conceptPlayGraphic(name, large = false) {
  const paths = CONCEPT_ROUTE_ART[name] || ["M20 46 L20 20", "M50 46 L50 16", "M80 46 L80 20"];
  const run = !!RUN_CONCEPTS[name];
  const cls = run ? "cs-route cs-route-run" : "cs-route";
  const label = large ? ` role="img" aria-label="${escapeHtml(name)} play diagram"` : ' aria-hidden="true"';
  return `<svg class="cs-play-art${large ? " is-large" : ""}" viewBox="0 0 100 56"${label}>
  <rect class="cs-art-field" x="1" y="1" width="98" height="54"/>
  <path class="cs-art-yard" d="M1 14 H99 M1 28 H99 M1 42 H99"/>
  <path class="cs-art-los" d="M4 46 H96"/>
  ${paths.map((d) => `<path class="${cls}" d="${d}"/>${conceptRouteArrow(d, run)}`).join("")}
  <g class="cs-art-offense"><circle cx="34" cy="46" r="1.8"/><circle cx="42" cy="46" r="1.8"/><circle cx="50" cy="46" r="1.8"/><circle cx="58" cy="46" r="1.8"/><circle cx="66" cy="46" r="1.8"/><circle class="cs-art-qb" cx="50" cy="51" r="2.2"/></g>
</svg>`;
}
var CONCEPT_COACH = {
  "Smash": { attacks: "Two-high and Cover 2: the corner route climbs behind the flat defender.", risk: "Needs time, and quarters can squeeze the corner window.", best: "An aware QB plus a precise, strong-at-the-catch receiver." },
  "Curl-Flat": { attacks: "Cover 3: it makes the flat defender choose between two routes.", risk: "A late throw toward the sideline can become an interception.", best: "An accurate QB and a sharp route-running receiver." },
  "Flood": { attacks: "Zone coverage by stretching one sideline at three depths.", risk: "It develops slowly and man coverage can carry the routes.", best: "An aware QB and a mobile, technical tight end." },
  "Y-Cross": { attacks: "Man and single-high looks with a fast route across the field.", risk: "It asks protection to hold while the crosser clears traffic.", best: "An accurate QB and a fast tight end." },
  "Dagger": { attacks: "Middle-field zones: a vertical clears space for the deep dig.", risk: "The dig can be jumped if the QB is late or pressured.", best: "Solid protection and a fast, precise receiver." },
  "Mesh": { attacks: "Man coverage with two shallow crossers that create traffic.", risk: "Zone defenders can sit underneath and erase the easy yards.", best: "Quick decisions and agile, technical receivers." },
  "Spot": { attacks: "Soft zone with a spacing triangle: corner over the snag with the flat underneath.", risk: "A physical flat defender can blow up the triangle's easy answer.", best: "A quick-eyed QB and a receiver who settles in the window." },
  "Sail": { attacks: "Three-deep zone by flooding one sideline at three depths.", risk: "Man coverage carries every route and the boundary throws get tight.", best: "An aware QB who works high to low with patience." },
  "Levels": { attacks: "Man and Cover 2 with two in-cuts high-lowing the same defender.", risk: "An inside-leverage wall or a lurking robber sits right where the digs break.", best: "Hard plants at the break — technique wins these routes." },
  "Sluggo Seam": { attacks: "Aggressive man corners: sell the slant, then go over the top.", risk: "A disciplined two-high defense doesn't bite and the QB holds the ball.", best: "A crafty receiver whose first move looks like a called slant." },
  "QB Power": { attacks: "Defenses that key the back — the QB adds a hat the box didn't count.", risk: "Your QB takes real hits in the interior.", best: "A strong, agile QB behind a pulling guard who clears the lane." },
  "Four Verts": { attacks: "Single-high and Cover 3 by stressing every deep seam.", risk: "A long-developing call against pressure or deep quarters.", best: "Receiver speed and a QB who can place the deep ball." },
  "Inside Zone": { attacks: "Light boxes and over-pursuing fronts with a one-cut run.", risk: "A loaded box can close the interior before the cut appears.", best: "Technical linemen and a patient, agile back." },
  "Outside Zone": { attacks: "Light boxes by stretching the front horizontally.", risk: "Fast edge defenders can force the run backward.", best: "Agile linemen and a back with vision and speed." },
  "Power": { attacks: "A firm interior edge with a pulling blocker at the point of attack.", risk: "Penetration can disrupt the pull and clog the designed lane.", best: "Strong linemen and a physical runner." }
};
function conceptTeaching(name) {
  var _a;
  if (CONCEPT_COACH[name]) return CONCEPT_COACH[name];
  const c = PASS_CONCEPTS[name] || RUN_CONCEPTS[name] || {};
  let attacks = "A balanced defensive look with spacing and assignment conflict.";
  let risk = "Execution breaks down if the defense wins quickly at the point of attack.";
  if (c.vs) {
    const ranked = Object.entries(c.vs).sort((a, b) => b[1] - a[1]);
    const good = ranked.filter(([, v]) => v > 0).slice(0, 2).map(([k]) => k);
    const bad = (_a = ranked.slice().reverse().find(([, v]) => v < 0)) == null ? void 0 : _a[0];
    if (good.length) attacks = `${good.join(" and ")} by creating the concept's preferred coverage conflict.`;
    if (bad) risk = `${bad} is the toughest answer; ${c.depth === "deep" ? "the routes also need protection and time." : "late decisions can close the throwing window."}`;
  } else if (c.vsBox) {
    attacks = (c.vsBox.light || 0) >= (c.vsBox.loaded || 0) ? "A light box, where blockers can create a clean lane." : "An aggressive front by changing the blocking angle.";
    risk = (c.vsBox.loaded || 0) < 0 ? "A loaded box can outnumber the blockers." : "Backfield penetration can spoil the designed path.";
  }
  const attrNames = { AWR: "awareness", TEC: "technique", SPD: "speed", AGI: "agility", STR: "strength", JMP: "jumping", HND: "hands" };
  const pieces = Object.entries(c.exec || {}).slice(0, 2).map(([pos, attrs]) => {
    var _a2;
    const top = (_a2 = Object.entries(attrs).sort((a, b) => b[1] - a[1])[0]) == null ? void 0 : _a2[0];
    return `${pos} ${attrNames[top] || "execution"}`;
  });
  return { attacks, risk, best: pieces.length ? pieces.join(" plus ") : "Players whose strengths match the assignment." };
}
function conceptPreviewHtml(name, formation, variation) {
  const note = conceptTeaching(name);
  const blurb = conceptBlurb(name);
  // D4/M2 (#16): the INFO drill-down IS the big card \u2014 the look-specific art
  // at full size with the line's job drawn (jobs:true), a one-line purpose
  // blurb (#21), and an expandable EVERY MAN'S JOB list covering all eleven,
  // OL included. Stage 4 law unchanged: the art is the Builder's own card,
  // aligned to the look the coach is calling from.
  const jobs = playAssignments({ name }, { formation: formation || "Spread", variation: variation || void 0 });
  const jobRows = jobs.rows.map((r) => `<div class="cs-job-row"><b>${escapeHtml(r.label)}</b><span class="cs-job-pos">${escapeHtml(r.pos)}</span><span class="cs-job-text">${escapeHtml(r.job)}</span></div>`).join("");
  return `<div class="cs-concept-preview">
  <button class="cs-drill-back" data-cs-previewback="1">\u2190 Back to plays</button>
  <div class="cs-preview-main">
    <span class="cs-preview-art">${renderConceptThumb(name, { w: 300, h: 195, formation: formation || void 0, variation: variation || void 0, jobs: true })}</span>
    <div class="cs-preview-copy">
      <h3>${escapeHtml(name)}</h3>
      ${blurb ? `<div class="cs-preview-blurb">${escapeHtml(blurb)}</div>` : ""}
      <div class="cs-teach-row"><b>ATTACKS</b><span>${escapeHtml(note.attacks)}</span></div>
      <div class="cs-teach-row"><b>RISK</b><span>${escapeHtml(note.risk)}</span></div>
      <div class="cs-teach-row"><b>BEST WITH</b><span>${escapeHtml(note.best)}</span></div>
    </div>
  </div>
  ${jobRows ? `<details class="cs-jobs"><summary>EVERY MAN'S JOB \u2014 all eleven, line included</summary><div class="cs-jobs-list">${jobRows}</div></details>` : ""}
  <button class="btn primary cs-call-play" data-cs-callconcept="${escapeHtml(name)}">CALL THIS PLAY \u2192</button>
</div>`;
}
// Stage 4 (Playbook-Root): the book's COMPOSED plays, resolved for the call
// sheet. school.book.plays (play snapshots — the target-model home, populated
// by later stages) wins when present; today the coach's Workshop library (the
// "plays" shelf) is the source, repaired against current game data. Returns
// [{id, name, cp}] — cp is the composed source the sim compiles through the
// band-clamped rulebook (compilePlay). AI teams never reach this: only the
// human call sheet renders it.
function composedPlaysForCall(school, pinnedForm) {
  let entries;
  const bp = school && school.book && Array.isArray(school.book.plays) ? school.book.plays : null;
  if (bp && bp.length) entries = bp.map((p) => p && { id: p.id, name: p.name || (p.data && p.data.name) || "Play", data: p.data || p }).filter(Boolean);
  else {
    try {
      entries = listCreations("plays").map((e) => ({ id: e.id, name: e.name, data: e.data }));
    } catch (e) {
      entries = [];
    }
  }
  const out = [];
  for (const e of entries) {
    if (!e || !e.data) continue;
    const r = repairComposedPlay(e.data);
    if (!r.ok) continue;
    const cp = r.cp;
    if (pinnedForm && Array.isArray(cp.formations) && cp.formations.length && !cp.formations.some((f) => aliasFormation(f) === pinnedForm)) continue;
    out.push({ id: e.id, name: cp.name || e.name || "Play", cp });
  }
  return out;
}
// Resolve one composed play for the actual CALL (book snapshot first, then the
// Workshop library), repaired — null if it can't be built (the tile wouldn't
// have rendered either).
function _composedCallData(id) {
  var _a, _b;
  const t = (_a = state.pendingHalftime) == null ? void 0 : _a.token;
  const side = ((_b = t == null ? void 0 : t.pending) == null ? void 0 : _b.possession) || (t == null ? void 0 : t.playerSide) || "home";
  const school = side === "home" ? t == null ? void 0 : t.homeSchool : t == null ? void 0 : t.awaySchool;
  const bp = school && school.book && Array.isArray(school.book.plays) ? school.book.plays.find((p) => p && p.id === id) : null;
  let data = bp ? bp.data || bp : null;
  if (!data) {
    try {
      data = loadCreationData("plays", id);
    } catch (e) {
      data = null;
    }
  }
  if (!data) return null;
  const r = repairComposedPlay(data);
  return r.ok ? r.cp : null;
}
// F1 (Aug 2026): the defensive headset. Same pending machinery as the offensive
// call sheet — the panel just speaks defense: pin the front, lean the shell,
// pick the heat. Empty selections = ride the plan = today's auto exactly.
var DEF_CALL_ROWS = [
  ["front", "FRONT", [["4-3", "4-3"], ["3-4", "3-4"], ["Tite", "Tite"], ["Nickel", "Nickel"], ["Big Nickel", "Big Nickel"], ["3-3-5", "3-3-5"], ["Penny", "Penny"], ["Dime", "Dime"], ["4-4", "4-4"], ["46/Bear", "46/Bear"], ["5-2", "5-2"]]],
  ["aggression", "PRESSURE", [["bend", "Bend"], ["selective", "Selective"], ["balanced", "Balanced"], ["attacking", "Attacking"], ["house", "House"]]],
  ["covShell", "SHELL", [["single", "Single-high"], ["two", "Two-high"]]],
  ["covStyle", "STYLE", [["man", "Man"], ["zone", "Zone"]]],
  ["edgePlay", "EDGE", [["contain", "Set it"], ["crash", "Crash"]]],
  ["robberCall", "ROBBER", [["rob", "Rob the middle"], ["overtop", "Stay over top"]]],
  ["zoneStyle", "ZONE RULES", [["spot", "Spot-drop"], ["match", "Match"]]],
  ["runCommit", "BOX", [["-8", "Lighten \u22128"], ["8", "Commit +8"]]],
  ["pressureIdentity", "HEAT SHAPE", [["fireZone", "Fire Zone"], ["secondLevel", "2nd Level"], ["secondaryHeat", "DB Heat"], ["theHouse", "The House"]]]
];
function defCallPanelHtml() {
  var _a, _b, _c;
  const token = (_a = state.pendingHalftime) == null ? void 0 : _a.token;
  const p = token == null ? void 0 : token.pending;
  if (!p || p.kind !== "defcall") return "";
  const d = p.drive;
  const s = d.sit || {};
  const standing = s.standing || {};
  const sel = state.ui.defCall || {};
  const qSecs = p.half === 3 ? d.clock : d.clock > 900 ? d.clock - 900 : d.clock;
  const mm = Math.floor(qSecs / 60), ss = String(qSecs % 60).padStart(2, "0");
  const qtr = p.half === 3 ? "OT" : d.clock > 900 ? p.half === 1 ? "Q1" : "Q3" : p.half === 1 ? "Q2" : "Q4";
  const spot = d.fieldPos >= 50 ? `opp ${100 - d.fieldPos}` : `own ${d.fieldPos}`;
  const goal = d.fieldPos + d.distance >= 100;
  const downTxt = `${["1st", "2nd", "3rd", "4th"][d.down - 1] || `${d.down}th`} &amp; ${goal ? "Goal" : d.distance}`;
  const us = ((_b = s.score) == null ? void 0 : _b.def) != null ? s.score.def : 0, them = ((_c = s.score) == null ? void 0 : _c.off) != null ? s.score.off : 0;
  const planLabel = {
    front: standing.defFront && standing.defFront !== "auto" ? standing.defFront : `Auto (${escapeHtml(standing.baseFront || "4-3")} base)`,
    aggression: standing.defAggression || "balanced",
    covShell: standing.covShell || "balanced",
    covStyle: standing.covStyle || "balanced",
    edgePlay: standing.edgePlay || "balanced",
    robberCall: standing.robberCall || "auto",
    zoneStyle: standing.zoneStyle || "balanced",
    runCommit: (standing.runCommit || 0) > 0 ? `+${standing.runCommit} committed` : (standing.runCommit || 0) < 0 ? `${standing.runCommit} light` : "even box",
    pressureIdentity: standing.pressureIdentity || "front's signature"
  };
  const nSel = Object.keys(sel).length;
  const rows = DEF_CALL_ROWS.map(([field, label, opts]) => `
    <div class="dc-row">
      <span class="dc-row-label">${label}</span>
      <span class="dc-plan${sel[field] ? "" : " active"}" data-dc-clear="${field}" title="Tap to ride the plan for this dial">plan: ${escapeHtml(String(planLabel[field]))}</span>
      ${opts.map(([v, lbl]) => `<button class="dc-chip${sel[field] === v ? " active" : ""}" data-dc-field="${field}" data-dc-val="${escapeHtml(v)}">${escapeHtml(lbl)}</button>`).join("")}
    </div>`).join("");
  return `
  <div class="cs-panel dc-panel">
    <div class="cs-head">
      <span class="cs-head-tag dc-head-tag">\u{1F6E1} YOUR DEFENSE</span>
      <span class="cs-head-sit">${downTxt} \xB7 ${spot} \xB7 ${qtr} ${mm}:${ss}</span>
      <span class="cs-head-score">US ${us} — ${them} THEM</span>
    </div>
    <p class="cs-diagram-hint">They're breaking the huddle. Pin any dial for THIS SNAP ONLY — anything you don't touch rides your standing plan.</p>
    ${(() => {
    // PASS 2 (Aug 2026): the headset speaks your call sheet. One tap loads a
    // named call's whole package into the dials below; adjust on top or send.
    var _s, _s2;
    // Stage 4: the chip row reads the defensive BOOK (defBookCalls), and says
    // whose calls these are.
    const _dcSchool = getPlayerSchool();
    const lib = defBookCalls(_dcSchool);
    const _dbName = ((_s2 = _dcSchool == null ? void 0 : _dcSchool.defbook) == null ? void 0 : _s2.name) || null;
    const names = lib ? Object.keys(lib) : [];
    if (!names.length) return "";
    const cur = state.ui.defCallName || null;
    // PASS 3: the loaded call's family/rotation/rush render as passive chips
    // (they ride the package; only shell/style adjustments can shed them).
    const curSel = state.ui.defCall || {};
    const ROT_LBL = { sky: "Sky", cloud: "Cloud", buzz: "Buzz" };
    // PASS 4: the pressure-flavor ingredients ride the same chip row (Heat
    // Shape adjustments shed them \u2014 you overrode the pressure design).
    const LOOK_LBL = { mug: "Double-A Mug", amoeba: "Amoeba" };
    const DOG_LBL = { green: "Green Dog", cross: "Cross Dog" };
    const ing = [
      curSel.covFamily ? `\u2601 ${curSel.covFamily === "Cover 2-Man" ? "2-Man" : curSel.covFamily}` : null,
      curSel.rotation ? `\u21ba ${ROT_LBL[curSel.rotation] || curSel.rotation}` : null,
      curSel.rush3 ? "\u2602 Rush 3 / Drop 8" : null,
      curSel.pressLook ? `\u26a1 ${LOOK_LBL[curSel.pressLook] || curSel.pressLook}` : null,
      curSel.dogGame ? `\u{1F415} ${DOG_LBL[curSel.dogGame] || curSel.dogGame}` : null
    ].filter(Boolean);
    return `
    <div class="dc-row">
      <span class="dc-row-label"${_dbName ? ` title="Named calls from your defensive book — “${escapeHtml(_dbName)}”"` : ""}>CALL${_dbName ? `<span class="dc-book-name">${escapeHtml(_dbName)}</span>` : ""}</span>
      <span class="dc-plan${cur ? "" : " active"}" data-dc-callname="__clear" title="Drop the named call, keep your pins">ad-lib</span>
      ${names.map((nm) => `<button class="dc-chip${cur === nm ? " active" : ""}" data-dc-callname="${escapeHtml(nm)}">${escapeHtml(nm)}</button>`).join("")}
    </div>${cur && ing.length ? `
    <div class="dc-row">
      <span class="dc-row-label"></span>
      <span class="dc-plan active" title="These ride the named call — adjust SHELL or STYLE to shed the coverage pin">${ing.map(escapeHtml).join(" \xb7 ")}</span>
    </div>` : ""}`;
  })()}
    ${rows}
    ${timeControlBar()}
    <div class="cs-footer dc-footer">
      <button class="btn primary dc-send" id="dc-send">${nSel ? `\u{1F6E1} SEND IT (${nSel} call${nSel > 1 ? "s" : ""})` : "\u{1F6E1} RIDE THE PLAN →"}</button>
    </div>
  </div>`;
}
function callSheetPanelHtml() {
  var _a, _b, _c, _d, _e, _f, _g;
  if (!((_b = (_a = state.pendingHalftime) == null ? void 0 : _a.token) == null ? void 0 : _b.pending)) return "";
  const token = state.pendingHalftime.token;
  if (token.pending.kind === "defcall") return defCallPanelHtml();
  const ctx2 = callContext(token);
  if (!ctx2) return "";
  const playerSchool = getPlayerSchool();
  const mySide = ((_c = token.pending) == null ? void 0 : _c.possession) || token.playerSide || (((_d = token.homeSchool) == null ? void 0 : _d.id) === (playerSchool == null ? void 0 : playerSchool.id) ? "home" : "away");
  const school = mySide === "home" ? token.homeSchool : token.awaySchool;
  const opp = mySide === "home" ? token.awaySchool : token.homeSchool;
  const gp = token[`${mySide}GP`] || {};
  const _weightsBase = (_f = (_e = ctx2.conceptWeights) != null ? _e : gp.conceptWeights) != null ? _f : null;
  // Madden pass 2: a pinned formation's authored sheet overlays the situation
  // weights — the panel shows the exact book the engine will pick from.
  // M2 (per-look sheets): the pinned LOOK resolves through THE resolver, so a
  // forked look shows its own sheet and an unforked one shows the inherited
  // base sheet — exactly what the sim's _fpbSheet overlay will read.
  const _fpbAll = ctx2.formationPlaybooks || gp.formationPlaybooks || null;
  const _fpbSel = state.ui.callFormation && _fpbAll ? resolveLookSheet(_fpbAll, state.ui.callFormation, state.ui.callVariation || null) : null;
  const weights = _fpbSel && Object.keys(_fpbSel).length ? { ..._weightsBase || {}, ..._fpbSel } : _weightsBase;
  const qSecs = ctx2.half === 3 ? ctx2.clock : ctx2.clock > 900 ? ctx2.clock - 900 : ctx2.clock;
  const mm = Math.floor(qSecs / 60), ss = String(qSecs % 60).padStart(2, "0");
  const spot = ctx2.fieldPos >= 50 ? `opp ${100 - ctx2.fieldPos}` : `own ${ctx2.fieldPos}`;
  const goal = ctx2.fieldPos + ctx2.distance >= 100;
  const downTxt = `${["1st", "2nd", "3rd", "4th"][ctx2.down - 1] || `${ctx2.down}th`} &amp; ${goal ? "Goal" : ctx2.distance}`;
  const favs = (groupKey) => {
    var _a2;
    const names = (((_a2 = ctx2.conceptsByGroup) == null ? void 0 : _a2[groupKey]) || []).filter((nm) => {
      var _a3;
      if (_activePlaybook.size && !_activePlaybook.has(nm)) return false;
      return !weights || ((_a3 = weights[nm]) != null ? _a3 : 50) > 0;
    });
    if (!names.length) return "";
    const wOf = (nm) => {
      var _a3;
      return weights ? Math.max(0, (_a3 = weights[nm]) != null ? _a3 : 50) : 50;
    };
    return names.slice().sort((a, b) => wOf(b) - wOf(a)).slice(0, 2).join(" \xB7 ") + (names.length > 2 ? " \u2026" : "");
  };
  const CATS = [
    ["run_inside", "\u{1F3C3} INSIDE RUN", "inside"],
    ["run_outside", "\u{1F300} OUTSIDE RUN", "perimeter"],
    ["pass_short", "\u26A1 SHORT PASS", "quick"],
    ["pass_medium", "\u{1F3AF} MEDIUM PASS", "dropback"],
    ["pass_deep", "\u{1F680} DEEP SHOT", "shots"],
    ["gadget", "\u{1F0CF} GADGET", "gadgets"]
  ];
  const _selFormId = state.ui.callFormation || (gp == null ? void 0 : gp.offFormation) || "Single Back";
  const _pkg = FORMATION_PACKAGES[aliasFormation(_selFormId)] || FORMATION_PACKAGES["Single Back"] || {};
  const _drillCat = state.ui.callDrill || null;
  const _carriedIds = ((gp == null ? void 0 : gp.offFormations) || []).map((f) => f && f.id).filter((id) => id && FORMATION_PACKAGES[id]);
  const _pbForms = state.ui.callFormation ? [state.ui.callFormation] : _carriedIds.length ? _carriedIds : [_selFormId];
  const _activePlaybook = formationPlaybookSet(_pbForms);
  const _wrOf = (id) => {
    const p = FORMATION_PACKAGES[id] || {};
    return (p.WR || 0) + (p.SLOT || 0);
  };
  const _wrCount = state.ui.callFormation ? (_pkg.WR || 0) + (_pkg.SLOT || 0) : _carriedIds.length ? Math.max(..._carriedIds.map(_wrOf)) : _wrOf(_selFormId);
  // Stage 4: every play tile is a CARD — the Builder's own art (renderConceptThumb),
  // drawn from the formation the coach is calling out of.
  const _thumbForm = state.ui.callFormation || _pbForms[0] || _selFormId;
  const _thumbOpts = { w: 120, h: 72, scale: 0.72, formation: _thumbForm, variation: state.ui.callFormation && state.ui.callVariation || void 0 };
  const conceptsFor = (grp) => {
    var _a2;
    const names = ((_a2 = ctx2.conceptsByGroup) == null ? void 0 : _a2[grp]) || [];
    return names.filter((nm) => {
      var _a3;
      if (_activePlaybook.size && !_activePlaybook.has(nm)) return false;
      if (weights && ((_a3 = weights[nm]) != null ? _a3 : 50) <= 0) return false;
      const c = PASS_CONCEPTS[nm];
      if (c && c.minWR && _wrCount < c.minWR) return false;
      return true;
    });
  };
  // The plays that DIDN'T make the sheet, and why — a silent filter reads as a
  // bug ("where's Four Verts?"); a labeled cut reads as coaching.
  const conceptsOffSheet = (grp) => {
    var _a2, _b2;
    const names = ((_a2 = ctx2.conceptsByGroup) == null ? void 0 : _a2[grp]) || [];
    const outs = [];
    for (const nm of names) {
      if (weights && ((_b2 = weights[nm]) != null ? _b2 : 50) <= 0) {
        outs.push({ nm, why: "benched in your gameplan" });
        continue;
      }
      if (_activePlaybook.size && !_activePlaybook.has(nm)) {
        outs.push({ nm, why: state.ui.callFormation ? `${state.ui.callFormation} doesn't carry it` : "no carried formation runs it" });
        continue;
      }
      const c = PASS_CONCEPTS[nm];
      if (c && c.minWR && _wrCount < c.minWR) outs.push({ nm, why: `needs ${c.minWR} receivers — this package has ${_wrCount}` });
    }
    return outs;
  };
  const _paOn = !!state.ui.callPA;
  const _rpoOn = !!state.ui.callRPO;
  const _qbRunOn = !!state.ui.callQBRun;
  const _RUN_GRPS = ["inside", "perimeter"];
  const _PASS_GRPS = ["quick", "dropback", "shots"];
  const _lockedGrps = _paOn ? /* @__PURE__ */ new Set([..._RUN_GRPS, "gadgets"]) : _rpoOn || _qbRunOn ? /* @__PURE__ */ new Set([..._PASS_GRPS, "gadgets"]) : /* @__PURE__ */ new Set();
  const _lockTip = _paOn ? "Play Action is on \u2014 pass plays only" : _rpoOn ? "RPO is on \u2014 run plays only" : _qbRunOn ? "QB Run is on \u2014 run plays only" : "";
  const tiles = CATS.map(([cat, label, grp]) => {
    const locked = _lockedGrps.has(grp);
    return `
  <button class="cs-cat${locked ? " cs-cat-locked" : ""}"${locked ? " disabled" : ""} data-cs-drill="${grp}" data-cs-cat="${cat}"${locked ? ` title="${escapeHtml(_lockTip)}"` : ""}>
    <span class="cs-cat-name">${label}</span>
    <span class="cs-cat-favs">${locked ? "\u{1F512} locked" : escapeHtml(favs(grp))}</span>
  </button>`;
  }).join("");
  let drillBlock = "";
  if (_drillCat) {
    const meta = CATS.find(([, , g]) => g === _drillCat.grp);
    const list = conceptsFor(_drillCat.grp);
    const previewName = list.includes(state.ui.callConceptPreview) ? state.ui.callConceptPreview : null;
    drillBlock = previewName ? conceptPreviewHtml(previewName, _thumbForm, state.ui.callFormation ? state.ui.callVariation : null) : `
      <div class="cs-drill">
        <div class="cs-drill-head">
          <button class="cs-drill-back" data-cs-drillback="1">\u2190 Plays</button>
          <span class="cs-drill-title">${meta ? escapeHtml(meta[1]) : "Plays"} \xB7 <span class="muted">${state.ui.callFormation ? escapeHtml(state.ui.callFormation) : "Auto"}</span></span>
        </div>
        <p class="cs-diagram-hint">Tap the play to call it now. INFO opens the optional coaching notes.</p>
        <div class="cs-concepts">
          <button class="cs-concept cs-surprise" data-cs-concept="__surprise" data-cs-cat="${_drillCat.cat}"><span class="cs-surprise-die">\u{1F3B2}</span><span>Surprise me</span></button>
          ${list.map((nm) => `<div class="cs-concept-tile"><button class="cs-concept cs-concept-card" data-cs-callconcept="${escapeHtml(nm)}" aria-label="Call ${escapeHtml(nm)}" title="${escapeHtml(conceptBlurb(nm) || nm)}">${renderConceptThumb(nm, _thumbOpts)}<span class="cs-c-name">${escapeHtml(nm)}</span><span class="cs-c-learn">Call play \u2192</span></button><button class="cs-info-btn" data-cs-preview="${escapeHtml(nm)}" aria-label="Learn about ${escapeHtml(nm)}">INFO</button></div>`).join("") || `<div class="muted" style="padding:6px">No plays fit ${state.ui.callFormation ? "this formation" : "your carried formations"} \u2014 try Surprise me.</div>`}
        </div>
        ${(() => {
      const outs = conceptsOffSheet(_drillCat.grp);
      if (!outs.length) return "";
      return `<div class="cs-offsheet-hdr">OFF THE SHEET</div>
        <div class="cs-concepts cs-concepts-out">${outs.map(({ nm, why }) => `<div class="cs-concept-tile cs-concept-out"><div class="cs-concept cs-concept-card cs-concept-dead" aria-label="${escapeHtml(nm)} unavailable: ${escapeHtml(why)}">${renderConceptThumb(nm, _thumbOpts)}<span class="cs-c-name">${escapeHtml(nm)}</span><span class="cs-c-dead-why">${escapeHtml(why)}</span></div></div>`).join("")}</div>`;
    })()}
      </div>`;
  }
  // Stage 4 (Playbook-Root): the formation pin lists YOUR BOOK'S LOOKS — each
  // weighted (formation, variation) entry the book carries, drawn with its real
  // pre-snap diagram (renderFormationDiagram — the Builder's art). The book is
  // read via school.book; the compiled gameplan is the identical fallback
  // (compileTeamPlan ≡ gameplan, Stage-1 law), so pre-book plans pin exactly
  // as before.
  const _bookSrc = school && school.book && school.book.plan && Array.isArray(school.book.plan.offFormations) ? school.book.plan.offFormations : null;
  const _carried = _bookSrc && _bookSrc.length ? _bookSrc : (gp == null ? void 0 : gp.offFormations) || [];
  const _bookName = school && school.book && school.book.name || (gp == null ? void 0 : gp._playbookName) || null;
  const _bookLooks = (() => {
    const src = (_carried.length ? _carried : [{ id: gp == null ? void 0 : gp.offFormation }]).filter((f) => f && f.id && FORMATION_PACKAGES[aliasFormation(f.id)]);
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const f of src) {
      const id = aliasFormation(f.id);
      const vkey = f.variation || null;
      const key = `${id}|${vkey || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const vd = vkey ? (FORMATION_VARIATIONS[id] || {})[vkey] : null;
      out.push({ id, vkey: vd ? vkey : null, label: vd ? `${id} \xB7 ${vd.label}` : id });
    }
    return out;
  })();
  const _formList = _bookLooks.map((l) => l.id);
  const _selForm = state.ui.callFormation || "__auto";
  const _selVar = state.ui.callVariation || null;
  // Madden pass 2 (Aug 2026): pin a formation and the sheet becomes THAT
  // formation's playbook — every play it runs, grouped and weight-ordered,
  // one tap to call. Auto keeps the six category tiles.
  let formationPage = "";
  if (_selForm !== "__auto") {
    const _fpPreview = state.ui.callConceptPreview && conceptsFor("quick").concat(conceptsFor("dropback"), conceptsFor("shots"), conceptsFor("inside"), conceptsFor("perimeter"), conceptsFor("gadgets")).includes(state.ui.callConceptPreview) ? state.ui.callConceptPreview : null;
    if (_fpPreview) formationPage = conceptPreviewHtml(_fpPreview, _thumbForm, _selVar);
    else {
      const _wOf = (nm) => { var _z; return weights ? Math.max(0, (_z = weights[nm]) != null ? _z : 50) : 50; };
      const GRP_META = [
        ["inside", "\u{1F3C3} INSIDE RUNS", "run_inside"],
        ["perimeter", "\u{1F300} OUTSIDE RUNS", "run_outside"],
        ["quick", "\u26A1 QUICK GAME", "pass_short"],
        ["dropback", "\u{1F3AF} DROPBACK", "pass_medium"],
        ["shots", "\u{1F680} SHOT PLAYS", "pass_deep"],
        ["gadgets", "\u{1F0CF} GADGETS", "gadget"]
      ];
      const _nAuth = _fpbSel ? Object.keys(_fpbSel).length : 0;
      const sections = GRP_META.map(([grp, label, cat]) => {
        if (_lockedGrps.has(grp)) return `
        <div class="cs-drill-head"><span class="cs-drill-title">${label} \xB7 <span class="muted">\u{1F512} ${escapeHtml(_lockTip)}</span></span></div>`;
        const list = conceptsFor(grp).slice().sort((a, b) => _wOf(b) - _wOf(a));
        if (!list.length) return "";
        return `
        <div class="cs-drill-head"><span class="cs-drill-title">${label}</span></div>
        <div class="cs-concepts">
          <button class="cs-concept cs-surprise" data-cs-concept="__surprise" data-cs-cat="${cat}"><span class="cs-surprise-die">\u{1F3B2}</span><span>Surprise me</span></button>
          ${list.map((nm) => `<div class="cs-concept-tile"><button class="cs-concept cs-concept-card" data-cs-callconcept="${escapeHtml(nm)}" aria-label="Call ${escapeHtml(nm)}" title="${escapeHtml(conceptBlurb(nm) || nm)}">${renderConceptThumb(nm, _thumbOpts)}<span class="cs-c-name">${escapeHtml(nm)}</span><span class="cs-c-learn">Call play \u2192</span></button><button class="cs-info-btn" data-cs-preview="${escapeHtml(nm)}" aria-label="Learn about ${escapeHtml(nm)}">INFO</button></div>`).join("")}
        </div>`;
      }).join("");
      const outs = ["inside", "perimeter", "quick", "dropback", "shots", "gadgets"].flatMap((grp) => conceptsOffSheet(grp));
      const outBlock = outs.length ? `<div class="cs-offsheet-hdr">OFF THE SHEET</div>
        <div class="cs-concepts cs-concepts-out">${outs.map(({ nm, why }) => `<div class="cs-concept-tile cs-concept-out"><div class="cs-concept cs-concept-card cs-concept-dead" aria-label="${escapeHtml(nm)} unavailable: ${escapeHtml(why)}">${renderConceptThumb(nm, _thumbOpts)}<span class="cs-c-name">${escapeHtml(nm)}</span><span class="cs-c-dead-why">${escapeHtml(why)}</span></div></div>`).join("")}</div>` : "";
      formationPage = `
      <div class="cs-drill">
        <div class="cs-drill-head">
          <span class="cs-drill-title">${escapeHtml(_selForm).toUpperCase()}${_selVar ? ` \xB7 ${escapeHtml(String((FORMATION_VARIATIONS[_selForm] || {})[_selVar]?.label || _selVar).toUpperCase())}` : ""}'S PLAYBOOK${_nAuth ? ` \xB7 <span class="muted">${_nAuth} play${_nAuth === 1 ? "" : "s"} authored for this formation</span>` : ""}</span>
        </div>
        <p class="cs-diagram-hint">Every play ${escapeHtml(_selForm)} runs, best-weighted first. Tap to call it now \u2014 or Auto up top for the category tiles.</p>
        ${sections}
        ${outBlock}
      </div>`;
    }
  }
  // Stage 4: the book's composed plays, callable as cards. D4/M2: composed
  // RUNS draw their own run diagrams now, but the RPO/QB-Run tags still lock
  // the block — a composed call is the whole play; it never takes a tag.
  const _myPlaysBlock = (() => {
    if (_rpoOn || _qbRunOn) return "";
    const plays = composedPlaysForCall(school, _selForm !== "__auto" ? _selForm : null);
    if (!plays.length) return "";
    const fromBook = !!(school && school.book && Array.isArray(school.book.plays) && school.book.plays.length);
    const srcLbl = fromBook && _bookName ? `from “${escapeHtml(_bookName)}”` : "your Workshop plays";
    return `
        <div class="cs-drill-head cs-myplays-head"><span class="cs-drill-title">\u{1F4D6} MY PLAYS \xB7 <span class="muted">${srcLbl}</span></span></div>
        <div class="cs-concepts cs-myplays">
          ${plays.map((p) => `<div class="cs-concept-tile"><button class="cs-concept cs-concept-card" data-cs-callcustom="${escapeHtml(p.id)}" aria-label="Call ${escapeHtml(p.name)}" title="${escapeHtml(composedBlurb(p.cp) || p.name)}">${renderComposedCard(p.cp, { w: 120, h: 72, scale: 0.72, formation: _selForm !== "__auto" ? _selForm : p.cp.formations && p.cp.formations[0] || _thumbForm, variation: _selForm !== "__auto" ? _selVar || void 0 : void 0 })}<span class="cs-c-name">${escapeHtml(p.name)}</span><span class="cs-c-learn">Call play →</span></button></div>`).join("")}
        </div>`;
  })();
  const _drillGrp = _drillCat ? _drillCat.grp : null;
  const _paDisabled = !!(_drillGrp && (_RUN_GRPS.includes(_drillGrp) || _drillGrp === "gadgets"));
  const _runLevDisabled = !!(_drillGrp && (_PASS_GRPS.includes(_drillGrp) || _drillGrp === "gadgets"));
  const formStrip = _bookLooks.length ? `
      <div class="cs-form-strip cs-look-strip">
        <span class="cs-form-tag"${_bookName ? ` title="Your book's looks — from “${escapeHtml(_bookName)}”"` : ""}>FORMATION${_bookName ? `<span class="cs-book-name">\u{1F4D6} ${escapeHtml(_bookName)}</span>` : ""}</span>
        <button class="cs-form-btn${_selForm === "__auto" ? " active" : ""}" data-cs-form="__auto">Auto</button>
        ${_bookLooks.map((l) => `<button class="cs-form-btn cs-form-look${_selForm === l.id && _selVar === l.vkey ? " active" : ""}" data-cs-form="${escapeHtml(l.id)}"${l.vkey ? ` data-cs-var="${escapeHtml(l.vkey)}"` : ""} title="Pin ${escapeHtml(l.label)} for this call"><span class="cs-look-dia" aria-hidden="true">${renderFormationDiagram(l.id, { variation: l.vkey || void 0, w: 96, h: 58 })}</span><span class="cs-look-lbl">${escapeHtml(l.label)}</span></button>`).join("")}
      </div>
      <div class="cs-tag-strip">
        <button class="cs-tag-btn${_paOn ? " active" : ""}" data-cs-pa="1" ${_paDisabled ? "disabled" : ""} title="${_paDisabled ? "Play action only applies to pass plays" : "Play action \u2014 fake the run to freeze the linebackers (opens up the medium/deep pass)"}">\u{1F3AD} Play Action</button>
        <button class="cs-tag-btn${_rpoOn ? " active" : ""}" data-cs-rpo="1" ${_runLevDisabled ? "disabled" : ""} title="${_runLevDisabled ? "RPO is a run call \u2014 it only applies to run plays" : "RPO \u2014 read a defender off the run action and hand off or throw"}">\u{1F504} RPO</button>
        <button class="cs-tag-btn${_qbRunOn ? " active" : ""}" data-cs-qbrun="1" ${_runLevDisabled ? "disabled" : ""} title="${_runLevDisabled ? "QB Run is a run call \u2014 it only applies to run plays" : "QB Run \u2014 the QB keeps it on the called run (a designed QB keeper)"}">\u{1F3C8} QB Run</button>
        ${(() => {
    const _tt = token.timeouts || {};
    const _ms = mySide;
    const _left = _tt[_ms] != null ? _tt[_ms] : C.TIMEOUTS_PER_HALF;
    const _on = !!state.ui.callTimeout;
    return `<button class="cs-tag-btn${_on ? " active" : ""}" data-cs-timeout="1" ${_left <= 0 ? "disabled" : ""} title="Call timeout \u2014 stops the clock this play (saves the run-off). ${_left} left this half.">\u23F1\uFE0F Timeout (${_left})</button>`;
  })()}
      </div>` : "";
  // G5 (Aug 2026): COACH'S CALL — the three legal plays the sheet leans hardest
  // toward in THIS situation (situation weights + formation overlay + carry +
  // personnel + PA/RPO locks all already applied by conceptsFor/weights).
  const _GRP_CAT2 = { inside: "run_inside", perimeter: "run_outside", quick: "pass_short", dropback: "pass_medium", shots: "pass_deep", gadgets: "gadget" };
  const _GRP_LBL = { inside: "inside run", perimeter: "outside run", quick: "quick game", dropback: "dropback", shots: "shot play", gadgets: "gadget" };
  const _sugWOf = (nm) => { var _z2; return weights ? Math.max(0, (_z2 = weights[nm]) != null ? _z2 : 50) : 50; };
  const _sugPool = Object.keys(_GRP_CAT2).filter((g) => !_lockedGrps.has(g)).flatMap((g) => conceptsFor(g).map((nm) => ({ nm, g })));
  const _sugTop = _sugPool.slice().sort((a, b) => _sugWOf(b.nm) - _sugWOf(a.nm)).slice(0, 3);
  const suggestRow = _sugTop.length ? `
      <div class="cs-form-strip cs-suggest-row">
        <span class="cs-form-tag" title="The plays your sheet leans hardest toward right here \u2014 tap to call one">COACH'S CALL</span>
        ${_sugTop.map(({ nm, g }) => `<button class="cs-form-btn" data-cs-callconcept="${escapeHtml(nm)}" title="Call ${escapeHtml(nm)} \u2014 the sheet's top ${_GRP_LBL[g]} here">\u2605 ${escapeHtml(nm)}</button>`).join("")}
      </div>` : "";
  // G7: repeat-the-call — my last 3 distinct real calls this game, still legal now.
  const _legalSet = new Set(_sugPool.map((x) => x.nm));
  const _recentNames = [];
  {
    const _pd = token.pending && token.pending.drive ? [{ possession: token.pending.possession, plays: token.pending.drive.plays || [] }] : [];
    const drv = (token.drives || []).concat(_pd);
    for (let i = drv.length - 1; i >= 0 && _recentNames.length < 3; i--) {
      const d = drv[i];
      if (d.possession !== mySide) continue;
      const ps = d.plays || [];
      for (let j = ps.length - 1; j >= 0 && _recentNames.length < 3; j--) {
        const p = ps[j];
        if (p.coachCall && p.concept && _legalSet.has(p.concept) && !_recentNames.includes(p.concept)) _recentNames.push(p.concept);
      }
    }
  }
  const recentRow = _recentNames.length ? `
      <div class="cs-form-strip cs-suggest-row">
        <span class="cs-form-tag">RECENT</span>
        ${_recentNames.map((nm) => `<button class="cs-form-btn" data-cs-callconcept="${escapeHtml(nm)}" title="Run it again \u2014 ${escapeHtml(nm)}">\u21BB ${escapeHtml(nm)}</button>`).join("")}
      </div>` : "";
  const adj = (_g = state.pendingHalftime) == null ? void 0 : _g.adjustment;
  const adjChip = adj ? `<span class="cs-adj">${adj.kind === "offlean" ? "\u2694\uFE0F Leaning offensive" : adj.kind === "deflean" ? "\u{1F6E1} Leaning defensive" : adj.kind === "fresh" ? "\u{1F50B} Fresh legs" : adj.kind === "protect" ? "\u{1F9F1} Protecting the QB" : adj.kind === "shadow" ? `\u{1F576} Shadowing ${escapeHtml(adj.name || "their top target")}` : "Halftime adjustment live"}</span>` : "";
  const fdLine = goal ? 100 : Math.max(0, Math.min(100, ctx2.fieldPos + ctx2.distance));
  const fieldBar = `
      <div class="cs-field" aria-hidden="true">
        <span class="cs-field-fd" style="left:${fdLine}%"></span>
        <span class="cs-field-ball" style="left:${ctx2.fieldPos}%"></span>
      </div>`;
  const _to = token.timeouts || {};
  const _mySide = mySide;
  const _oppSide = _mySide === "home" ? "away" : "home";
  const _toPips = (n) => `${"\u25CF".repeat(Math.max(0, n))}${"\u25CB".repeat(Math.max(0, C.TIMEOUTS_PER_HALF - n))}`;
  const _toLine = `<span class="cs-timeouts" title="Timeouts remaining this half">TO <b>${escapeHtml((school == null ? void 0 : school.abbr) || "You")}</b> ${_toPips(_to[_mySide] != null ? _to[_mySide] : C.TIMEOUTS_PER_HALF)} \xB7 <b>${escapeHtml((opp == null ? void 0 : opp.abbr) || "Opp")}</b> ${_toPips(_to[_oppSide] != null ? _to[_oppSide] : C.TIMEOUTS_PER_HALF)}</span>`;
  const controlLabel = state._exhibitionMode === "both" ? `${mySide === "home" ? "TEAM 1" : "TEAM 2"} CALL \xB7 ` : "";
  return `
      <div class="cs-strip">
        <span class="cs-sit">\u{1F3A7} ${controlLabel}${ctx2.half === 3 ? "OT" : `Q${ctx2.quarter}`} \xB7 ${mm}:${ss} \xB7 <b>${downTxt}</b> \xB7 ball on ${spot}</span>
        <span class="cs-score">${escapeHtml((school == null ? void 0 : school.name) || "You")} ${ctx2.scoreOff} \u2014 ${ctx2.scoreDef} ${escapeHtml((opp == null ? void 0 : opp.name) || "")}</span>
      </div>
      <div class="cs-timeout-row">${_toLine}</div>
      ${fieldBar}
      ${adjChip ? `<div class="cs-adj-row">${adjChip}</div>` : ""}
      ${renderCallFeed(token)}
      ${timeControlBar()}
      ${formStrip}
      ${suggestRow}${recentRow}
      ${_drillCat ? drillBlock : _selForm !== "__auto" ? formationPage + _myPlaysBlock : `<div class="cs-cats">${tiles}</div>` + _myPlaysBlock}
      ${(() => {
    const _dfg = 100 - ctx2.fieldPos;
    const _fgYds = _dfg + 17;
    const _maxFG = ((gp == null ? void 0 : gp.maxFGDist) || 42) + 17;
    const _inRange = _fgYds <= _maxFG && ctx2.fieldPos >= 55;
    const _stOpen = !!state.ui.callSTOpen;
    return `
      <div class="cs-st-block">
        <button class="cs-st-toggle${_stOpen ? " active" : ""}" data-cs-st-toggle="1">\u{1F3C8} Special Teams${_stOpen ? " \u25BE" : " \u25B8"}</button>
        ${_stOpen ? `<div class="cs-st-opts">
          <button class="cs-st-btn" data-cs-st="fg"${_inRange ? "" : " disabled"} title="${_inRange ? `A ${_fgYds}-yard attempt` : `${_fgYds} yds \u2014 out of range`}">\u{1F9BF} Field Goal \xB7 ${_fgYds} yds${_inRange ? "" : " (long)"}</button>
          <button class="cs-st-btn" data-cs-st="punt">\u{1F9E4} Punt \u2014 flip the field</button>
        </div>` : ""}
      </div>`;
  })()}`;
}
function renderFourthDownModal() {
  if (!state.ui.showFourthDown) return "";
  const body = fourthDownPanelHtml();
  if (!body) return "";
  return `
  <div class="modal-overlay callsheet-overlay">
    <div class="modal fourth-modal">${body}</div>
  </div>`;
}
function fourthDownPanelHtml() {
  var _a, _b, _c, _d, _e;
  if (((_c = (_b = (_a = state.pendingHalftime) == null ? void 0 : _a.token) == null ? void 0 : _b.pending) == null ? void 0 : _c.kind) !== "fourth") return "";
  const token = state.pendingHalftime.token;
  const ctx2 = decisionContext(token);
  if (!ctx2) return "";
  const playerSchool = getPlayerSchool();
  const mySide = ((_d = token.pending) == null ? void 0 : _d.possession) || token.playerSide || (((_e = token.homeSchool) == null ? void 0 : _e.id) === (playerSchool == null ? void 0 : playerSchool.id) ? "home" : "away");
  const school = mySide === "home" ? token.homeSchool : token.awaySchool;
  const opp = mySide === "home" ? token.awaySchool : token.homeSchool;
  const qSecs = ctx2.half === 3 ? ctx2.clock : ctx2.clock > 900 ? ctx2.clock - 900 : ctx2.clock;
  const mm = Math.floor(qSecs / 60), ss = String(qSecs % 60).padStart(2, "0");
  const spot = ctx2.fieldPos >= 50 ? `opp ${100 - ctx2.fieldPos}` : `own ${ctx2.fieldPos}`;
  const margin = ctx2.scoreOff - ctx2.scoreDef;
  const frame = margin < 0 && ctx2.half === 2 && ctx2.clock <= 360 ? "The season is watching." : ctx2.distance <= 2 ? "Inches. The analytics say be a coach about it." : ctx2.canFG ? "Points on the board, or the sticks?" : "No-man\u2019s land \u2014 the punt buys almost nothing.";
  return `
      <div class="cs-strip">
        <span class="cs-sit">\u{1F3C8} ${ctx2.half === 3 ? "OT" : `Q${ctx2.quarter}`} \xB7 ${mm}:${ss} \xB7 <b>4th &amp; ${ctx2.distance}</b> \xB7 ball on ${spot}</span>
        <span class="cs-score">${escapeHtml((school == null ? void 0 : school.name) || "You")} ${ctx2.scoreOff} \u2014 ${ctx2.scoreDef} ${escapeHtml((opp == null ? void 0 : opp.name) || "")}</span>
      </div>
      ${renderCallFeed(token)}
      ${timeControlBar()}
      <p class="fourth-frame">${frame}</p>
      <div class="fourth-opts">
        <button class="fourth-opt" data-fourth="go">
          <span class="fourth-opt-title">\u{1F680} GO FOR IT</span>
          <span class="fourth-opt-desc">${ctx2.distance} to move the sticks \u2014 and the call sheet is yours next snap.</span>
        </button>
        <button class="fourth-opt${ctx2.canFG ? "" : " ineligible"}" data-fourth="fg" ${ctx2.canFG ? "" : "disabled"}>
          <span class="fourth-opt-title">\u{1F9BF} FIELD GOAL \xB7 ${ctx2.fgDist} yds</span>
          <span class="fourth-opt-desc">${ctx2.canFG ? `A ${ctx2.fgDist}-yarder \u2014 three points for certainty.` : `${ctx2.fgDist} yds \u2014 out of range for your kicker.`}</span>
        </button>
        <button class="fourth-opt" data-fourth="punt">
          <span class="fourth-opt-title">\u{1F9E4} PUNT</span>
          <span class="fourth-opt-desc">Flip the field and trust the defense.</span>
        </button>
      </div>`;
}
function renderLiveWatchOverlay() {
  var _a, _b, _c;
  const lw = state.ui.liveWatch;
  if (!lw) return "";
  if (state.ui.view === "manual") return "";
  const isCall = lw.stage === "call";
  const auto = isCall && state.ui.autoRun;
  const boardDone = isCall && lw.boardDone && !auto;
  const label = lw.stage === "halftime" ? "1ST HALF \u2014 LIVE" : isCall ? auto ? "AUTO-RUN \u2014 WATCHING" : boardDone ? "YOUR CALL" : "LIVE \u2014 HEADSET ON" : "2ND HALF \u2014 LIVE";
  let embed = "";
  if (isCall && !auto && boardDone) {
    try {
      embed = ((_c = (_b = (_a = state.pendingHalftime) == null ? void 0 : _a.token) == null ? void 0 : _b.pending) == null ? void 0 : _c.kind) === "fourth" ? fourthDownPanelHtml() : callSheetPanelHtml();
    } catch (err) {
      console.error("[watch] call panel render failed \u2014 showing recovery:", err);
      embed = "";
    }
  }
  const stranded = isCall && !auto && boardDone && !embed;
  const recover = stranded ? `<div class="cs-footer cs-recover" style="flex-wrap:wrap;gap:6px">
       <button class="btn-secondary" data-cs-quickcat="run_inside">\u{1F3C3} Inside Run</button>
       <button class="btn-secondary" data-cs-quickcat="run_outside">\u{1F300} Outside Run</button>
       <button class="btn-secondary" data-cs-quickcat="pass_short">\u26A1 Short Pass</button>
       <button class="btn-secondary" data-cs-quickcat="pass_medium">\u{1F3AF} Medium Pass</button>
       <button class="btn-secondary" data-cs-quickcat="pass_deep">\u{1F680} Deep Shot</button>
       <button class="btn-primary" id="cs-recover">\u{1F4CB} Let the sheet decide</button>
     </div>` : "";
  const headerBtn = !boardDone && !auto ? `<button class="bc-btn bc-text" id="watch-live-skip">Skip \u23E9</button>` : "";
  const helpBtn = helpButtonHtml(HELP_CHAPTER_LIVEGAME);
  return `
  <div class="modal-overlay watch-live-overlay">
    <div class="modal game-result-modal${embed ? " watch-call-mode" : ""}${boardDone ? " watch-board-collapsed" : ""}">
      <div class="modal-header"><h2>\u25B6 ${label}</h2>${helpBtn}${headerBtn}</div>
      <div class="result-tab-body">
      ${boardDone ? "" : `<div id="watch-root" class="watch-root"></div>`}
      ${embed ? `<div class="watch-call-embed">${embed}</div>` : ""}${recover}</div>
    </div>
  </div>`;
}
function liveWatchFinish() {
  var _a, _b, _c;
  const lw = state.ui.liveWatch;
  if ((lw == null ? void 0 : lw.stage) === "call") {
    if (state.ui.autoRun) {
      if (((_c = (_b = (_a = state.pendingHalftime) == null ? void 0 : _a.token) == null ? void 0 : _b.pending) == null ? void 0 : _c.kind) === "fourth") answerFourthDown("auto");
      else answerPlayCall({ concept: "sheet" });
      return;
    }
    lw.boardDone = true;
    renderApp();
    return;
  }
  state.ui.liveWatch = null;
  state.ui._finalWatched = null;
  if ((lw == null ? void 0 : lw.stage) === "halftime" && state._exhibitionMode === "watch") {
    continueExhibitionSpectator();
    return;
  }
  if ((lw == null ? void 0 : lw.stage) === "halftime") state.ui.showHalftime = true;
  else {
    state.ui.showGameResult = true;
    state.ui.gameResultTab = "boxscore";
  }
  renderApp();
}
function watchDrivesOf(token) {
  var _a, _b, _c;
  const drv = [...token.drives || []];
  if ((_c = (_b = (_a = token.pending) == null ? void 0 : _a.drive) == null ? void 0 : _b.plays) == null ? void 0 : _c.length) {
    drv.push({ possession: token.pending.possession, plays: token.pending.drive.plays, result: null });
  }
  return drv;
}
function sliceDrivesFrom(drives, fromIdx) {
  let seen = 0;
  const out = [];
  for (const d of drives) {
    const ps = d.plays || [];
    if (seen + ps.length <= fromIdx) {
      seen += ps.length;
      continue;
    }
    out.push(__spreadProps(__spreadValues({}, d), { plays: ps.slice(Math.max(0, fromIdx - seen)) }));
    seen += ps.length;
  }
  return out;
}
function mountLiveWatch() {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const lw = state.ui.liveWatch;
  if (!lw || lw.boardDone) return;
  const exhTag = state._exhibition ? `-x${state._exhNonce || 0}` : "";
  let gameLike = null, isHome = true, watchKey = `live-${lw.stage}-${state.day}-${state.season}${exhTag}`;
  const school = getPlayerSchool();
  const rosterNames = (t) => {
    const names = {};
    for (const p of [...t.homeRoster || [], ...t.awayRoster || []]) {
      names[p.id] = { name: `${p.name.first[0]}. ${p.name.last}`, pos: p.position };
    }
    return names;
  };
  if (lw.stage === "call" && ((_b = (_a = state.pendingHalftime) == null ? void 0 : _a.token) == null ? void 0 : _b.pending)) {
    const t = state.pendingHalftime.token;
    const total = watchDrivesOf(t).reduce((n, d) => {
      var _a2;
      return n + (((_a2 = d.plays) == null ? void 0 : _a2.length) || 0);
    }, 0);
    watchKey = `call-${state.season}-${state.day}-${total}${exhTag}`;
    if (t._watchKey !== watchKey) {
      t._watchBase = t._watchedPlays || 0;
      t._watchedPlays = total;
      t._watchKey = watchKey;
    }
    gameLike = {
      drives: sliceDrivesFrom(watchDrivesOf(t), t._watchBase || 0),
      homeSchool: t.homeSchool,
      awaySchool: t.awaySchool,
      homeScore: t.homeScore,
      awayScore: t.awayScore,
      playerNames: rosterNames(t)
    };
    isHome = state._exhibitionMode === "both" ? (((_c = t.pending) == null ? void 0 : _c.possession) || t.playerSide) === "home" : ((_d = t.homeSchool) == null ? void 0 : _d.id) === (school == null ? void 0 : school.id);
  } else if (lw.stage === "halftime" && ((_e = state.pendingHalftime) == null ? void 0 : _e.token)) {
    const t = state.pendingHalftime.token;
    const from = t.callMode && t.callMode !== "off" ? t._watchedPlays || 0 : 0;
    t._watchedPlays = (t.drives || []).reduce((n, d) => {
      var _a2;
      return n + (((_a2 = d.plays) == null ? void 0 : _a2.length) || 0);
    }, 0);
    gameLike = {
      drives: from > 0 ? sliceDrivesFrom(t.drives || [], from) : t.drives || [],
      homeSchool: t.homeSchool,
      awaySchool: t.awaySchool,
      homeScore: t.homeScore,
      awayScore: t.awayScore,
      playerNames: rosterNames(t)
    };
    isHome = ((_f = t.homeSchool) == null ? void 0 : _f.id) === (school == null ? void 0 : school.id);
  } else if (lw.stage === "final" && state.ui.lastGameResult) {
    const r = state.ui.lastGameResult;
    const fw = state.ui._finalWatched;
    const drives = fw != null && fw > 0 ? sliceDrivesFrom(r.drives || [], fw) : (() => {
      const cut = (r.drives || []).findIndex((d) => (d.plays || []).some((pl) => pl.half === 2));
      return cut >= 0 ? r.drives.slice(cut) : r.drives;
    })();
    gameLike = __spreadProps(__spreadValues({}, r), { drives });
    isHome = ((_g = r.homeSchool) == null ? void 0 : _g.id) === (school == null ? void 0 : school.id);
  }
  if (!gameLike) {
    liveWatchFinish();
    return;
  }
  initWatchMode(gameLike, isHome, { key: watchKey, onFinish: liveWatchFinish });
  if (_watch) _watch.liveLabel = lw.stage === "halftime" ? "End of the first half \u2014 the locker room is waiting." : lw.stage === "call" ? "The headset crackles \u2014 your call." : "That\u2019s the ballgame.";
  (_h = document.getElementById("watch-live-skip")) == null ? void 0 : _h.addEventListener("click", () => {
    var _a2;
    watchStop();
    _watch = null;
    if (((_a2 = state.ui.liveWatch) == null ? void 0 : _a2.stage) === "call") {
      state.ui.liveWatch.boardDone = true;
      renderApp();
    } else liveWatchFinish();
  });
}
var _watch = null;
// ── M0 #7: the screen stays awake while a game is on the board ─────────────
// Screen Wake Lock API, feature-detected + try/caught — a safe no-op where
// unsupported (older iOS Safari, desktop browsers without the API). The OS
// auto-releases the sentinel whenever the tab hides; the visibilitychange
// listener below re-acquires it if the viewer is still up. Release rides
// syncOverlayInert (every render path), so any screen without a watch viewer
// drops the lock — no per-close-site bookkeeping to miss.
var _wakeSentinel = null;
var _wakeWanted = false;
function watchWakeAcquire() {
  _wakeWanted = true;
  try {
    if (!navigator.wakeLock || typeof navigator.wakeLock.request !== "function") return;
    if (_wakeSentinel && !_wakeSentinel.released) return;
    navigator.wakeLock.request("screen").then((s) => {
      if (!_wakeWanted) {
        try { s.release(); } catch (e) {}
        return;
      }
      _wakeSentinel = s;
      try { s.addEventListener("release", () => { if (_wakeSentinel === s) _wakeSentinel = null; }); } catch (e) {}
    }).catch(() => {});
  } catch (e) {}
}
function watchWakeRelease() {
  _wakeWanted = false;
  const s = _wakeSentinel;
  _wakeSentinel = null;
  if (s) { try { const p = s.release(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
}
document.addEventListener("visibilitychange", () => {
  if (_wakeWanted && document.visibilityState === "visible" && document.getElementById("watch-root")) watchWakeAcquire();
});
// M0 #9 → M4 Presentation: the replay toggle grew into a FREQUENCY —
// Off / Low (scores + turnovers only) / High (the tuned predicate, default).
// settings.replayFreq is the value; a legacy watchReplays === false save
// reads as Off. Lives in Settings → PRESENTATION and on the watch bar.
function watchReplayFreq() {
  const s = state.settings || {};
  if (s.replayFreq === "off" || s.replayFreq === "low" || s.replayFreq === "high") return s.replayFreq;
  return s.watchReplays === false ? "off" : "high";
}
function watchReplaysOn() {
  return watchReplayFreq() !== "off";
}
var _lastCallClick = 0;
function callTapOk() {
  const n = Date.now();
  if (n - _lastCallClick < 350) return false;
  _lastCallClick = n;
  return true;
}
function watchStop() {
  if (_watch == null ? void 0 : _watch.timer) clearTimeout(_watch.timer);
  if (_watch == null ? void 0 : _watch.revealTimer) clearTimeout(_watch.revealTimer);
  if (_watch == null ? void 0 : _watch.replayTimer) clearTimeout(_watch.replayTimer);
  if (_watch) {
    _watch.timer = null;
    _watch.revealTimer = null;
    _watch.replayTimer = null;
  }
  watchStopAnim();
  stadiumPause();
}
function buildWatchSeq(r) {
  const seq = [];
  (r.drives || []).forEach((d, di) => {
    seq.push({ kind: "drive", d, di });
    for (const p of d.plays || []) seq.push({ kind: "play", p, d, di });
    if (d.result != null) seq.push({ kind: "result", d, di });
  });
  seq.push({ kind: "final" });
  return seq;
}
function initWatchMode(r, isHome, opts = {}) {
  var _a, _b, _c;
  const root = document.getElementById("watch-root");
  if (!root) return;
  watchWakeAcquire();
  const key = (_a = opts.key) != null ? _a : r;
  const clipMode = !!opts.clip;
  const _resumeActive = !!(_watch && _watch.key === key && !_watch.paused && _watch.idx > 0);
  if (!_watch || _watch.key !== key) {
    watchStop();
    _watch = {
      r,
      key,
      seq: clipMode ? r.drives.flatMap((d, di) => (d.plays || []).map((p) => ({ kind: "play", p, d, di }))).concat(opts.clip.reel ? [{ kind: "final" }] : []) : buildWatchSeq(r),
      idx: 0,
      speed: 1,
      paused: clipMode && !opts.clip.reel,
      timer: null,
      replayTimer: null,
      art: false,
      onFinish: opts.onFinish || null,
      clip: opts.clip || null,
      activePlay: null,
      activeDrive: null
    };
  } else {
    watchStop();
    _watch.r = r;
    _watch.onFinish = opts.onFinish || _watch.onFinish;
    _watch.clip = opts.clip || _watch.clip;
  }
  const w = _watch;
  const isLive = !!w.onFinish;
  const _lwStage = (_b = state.ui.liveWatch) == null ? void 0 : _b.stage;
  const liveCall = isLive && _lwStage === "call";
  const finalLabel = !isLive ? "End \u23ED" : _lwStage === "halftime" ? "Skip to Halftime \u23ED" : "Skip to Final \u23ED";
  const finalTitle = !isLive ? "Jump to the end" : _lwStage === "halftime" ? "Skip the rest of the half and go to the locker room" : "Skip the rest and jump to the final";
  root.innerHTML = `
  <div class="watch-bug" id="watch-bug"></div>
  <div class="watch-ticker" id="watch-ticker">Kickoff coming up\u2026</div>
  <aside class="watch-desktop-insight" id="watch-desktop-insight" aria-live="polite">
    <div class="wdi-kicker">FIELD NOTES</div>
    <div class="wdi-grid">
      <div class="wdi-cell"><span>POSSESSION</span><b>Awaiting series</b></div>
      <div class="wdi-cell"><span>FORMATION</span><b>\u2014</b></div>
      <div class="wdi-cell"><span>PLAY</span><b>\u2014</b></div>
      <div class="wdi-cell"><span>FIELD</span><b>\u2014</b></div>
    </div>
  </aside>
  <div class="watch-board-wrap"><svg id="watch-board" viewBox="-19 0 100 56" preserveAspectRatio="xMidYMid meet"></svg>
    <svg id="watch-ink" class="watch-ink" viewBox="-19 0 100 56" preserveAspectRatio="xMidYMid meet" aria-label="Replay telestrator"></svg>
    <div class="watch-camera-bug" id="watch-camera-bug">LIVE</div>
    <div class="watch-replay-bug" id="watch-replay-bug">INSTANT REPLAY</div>
    <div class="watch-director-bug" id="watch-director-bug" aria-live="polite"></div>
    <div class="watch-flash" id="watch-flash"></div>
    <div class="watch-wipe" id="watch-wipe"></div>
    <div class="watch-banner" id="watch-banner"></div>
    <div class="watch-lower" id="watch-lower"></div>
    <div class="watch-analysis" id="watch-analysis" aria-live="polite"></div>
    <div class="watch-call-card" id="watch-call-card" aria-label="The called play"></div>
    <div class="watch-player-pop" id="watch-player-pop"></div>
    <div class="watch-replay-tools" id="watch-replay-tools" aria-label="Replay controls">
      <button class="bc-btn bc-icon" id="replay-play" title="Play or pause">⏸</button>
      <input id="replay-scrub" class="replay-scrub" type="range" min="0" max="1000" value="0" aria-label="Replay position">
      <button class="bc-btn bc-speed" id="replay-rate" title="Slow motion">1×</button>
      <button class="bc-btn bc-text" id="replay-director" title="Automatically cut cameras by play phase">Director</button>
      <button class="bc-btn bc-text" id="replay-camera" title="Change camera">Broadcast</button>
      <button class="bc-btn bc-text" id="replay-ink" title="Draw while paused">Draw</button>
      <button class="bc-btn bc-icon" id="replay-undo" title="Undo drawing">↶</button>
      <button class="bc-btn bc-text" id="replay-still" title="Save annotated still">Still</button>
      <button class="bc-btn bc-text" id="replay-video" title="Export short video">Video</button>
      <button class="bc-btn bc-text" id="replay-save" title="Save to Film Room">Film Room</button>
    </div></div>
  <div class="watch-controls broadcast-bar${clipMode ? " replay-clip-summary" : ""}">
    ${isLive ? "" : `<button class="bc-btn bc-icon" id="watch-stepback" title="Step back">\u23EE</button>`}
    <button class="bc-btn bc-icon bc-play" id="watch-pause" title="Play / pause">\u23F8</button>
    ${isLive ? `<button class="bc-btn bc-icon" id="watch-skipplay" title="Skip this play's animation">\u23ED</button>` : `<button class="bc-btn bc-icon" id="watch-stepfwd" title="Step forward">\u23ED</button>`}
    <button class="bc-btn bc-speed" id="watch-speed" title="Playback speed">1\xD7</button>
    <button class="bc-btn bc-text" id="watch-landscape" title="Rotate to landscape">⤢ Landscape</button>
    <button class="bc-btn bc-text watch-desktop-only" id="watch-art" title="Show or hide the developing play trail">Play Art: On</button>
    ${clipMode ? "" : `<button class="bc-btn bc-text" id="watch-replays" title="Instant replays after big plays">Replays: On</button>`}
    ${clipMode ? "" : `<button class="bc-btn bc-text" id="watch-save-clip" title="Save this play to Film Room">Save Clip</button>`}
    ${isLive ? "" : `<button class="bc-btn bc-text" id="watch-nextdrive" title="Next drive">Next Drive \u23ED</button>`}
    ${liveCall ? timeControlBar() : `<button class="bc-btn bc-text bc-final" id="watch-final" title="${finalTitle}">${finalLabel}</button>`}
    <span class="watch-progress" id="watch-progress"></span>
  </div>
  <div class="watch-drives" id="watch-drives"></div>`;
  stadiumStart(0.18);
  if (!isLive) {
    const step = (dir) => {
      w.paused = true;
      const pb = document.getElementById("watch-pause");
      if (pb) pb.textContent = "\u25B6";
      watchStop();
      w.idx = Math.max(0, Math.min(w.seq.length - 1, w.idx - 1 + dir));
      watchTick(true);
    };
    document.getElementById("watch-stepback").addEventListener("click", () => step(-1));
    document.getElementById("watch-stepfwd").addEventListener("click", () => step(1));
    document.getElementById("watch-nextdrive").addEventListener("click", () => {
      for (let i = w.idx + 1; i < w.seq.length; i++) {
        if (w.seq[i].kind === "drive" || w.seq[i].kind === "final") {
          w.idx = i;
          break;
        }
      }
      watchStop();
      watchTick(true);
    });
  }
  // M4: the working FF button — skip THIS play's animation and land on the
  // next item (the board keeps rolling if it was rolling).
  const skipPlayBtn = document.getElementById("watch-skipplay");
  if (skipPlayBtn) skipPlayBtn.addEventListener("click", () => {
    // watchTick advances w.idx after rendering, so idx already names the NEXT
    // item — kill the in-flight animation and tick straight to it.
    watchStop();
    watchTick(true);
  });
  document.getElementById("watch-pause").addEventListener("click", () => {
    w.paused = !w.paused;
    const pb = document.getElementById("watch-pause");
    pb.textContent = w.paused ? "\u25B6" : "\u23F8";
    pb.classList.toggle("bc-paused", w.paused);
    if (!w.paused) {
      stadiumStart(0.2);
      watchTick();
    }
    else watchStop();
  });
  document.getElementById("watch-speed").addEventListener("click", () => {
    w.speed = w.speed === 1 ? 2 : w.speed === 2 ? 0.5 : 1;
    document.getElementById("watch-speed").textContent = w.speed === 0.5 ? "\xBD\xD7" : `${w.speed}\xD7`;
  });
  // Force landscape on tap — the reliable path when the installed PWA won't honor
  // the manifest's "any" orientation. In a browser tab orientation.lock needs
  // fullscreen (requested first); in a standalone PWA the lock works directly.
  // Toggles: tap again (or when already landscape) to release back to portrait.
  // Fully feature-detected + try/caught, so it's a safe no-op on iOS.
  const lsBtn = document.getElementById("watch-landscape");
  if (lsBtn) lsBtn.addEventListener("click", async () => {
    try {
      const o = screen.orientation;
      const isLandscape = o && typeof o.type === "string" && o.type.indexOf("landscape") === 0;
      if (isLandscape) {
        if (o && o.unlock) { try { o.unlock(); } catch (e) {} }
        if (document.fullscreenElement && document.exitFullscreen) { try { await document.exitFullscreen(); } catch (e) {} }
      } else {
        const el = document.documentElement;
        if (!document.fullscreenElement && el.requestFullscreen) { try { await el.requestFullscreen(); } catch (e) {} }
        if (o && o.lock) { try { await o.lock("landscape"); } catch (e) {} }
      }
    } catch (e) {}
  });
  const artBtn = document.getElementById("watch-art");
  const syncArt = () => {
    root.classList.toggle("watch-art-off", w.art === false);
    if (artBtn) artBtn.textContent = `Play Art: ${w.art === false ? "Off" : "On"}`;
  };
  artBtn == null ? void 0 : artBtn.addEventListener("click", () => {
    w.art = w.art === false;
    syncArt();
  });
  syncArt();
  // M4 Presentation: the watch-bar replay button cycles the FREQUENCY
  // High → Low → Off (same value as Settings → PRESENTATION).
  const repBtn = document.getElementById("watch-replays");
  const _RF_LBL = { high: "High", low: "Low", off: "Off" };
  const syncReplays = () => {
    if (repBtn) repBtn.textContent = `Replays: ${_RF_LBL[watchReplayFreq()]}`;
  };
  repBtn == null ? void 0 : repBtn.addEventListener("click", () => {
    if (!state.settings) state.settings = {};
    const cur = watchReplayFreq();
    state.settings.replayFreq = cur === "high" ? "low" : cur === "low" ? "off" : "high";
    delete state.settings.watchReplays;
    syncReplays();
  });
  syncReplays();
  const saveClipBtn = document.getElementById("watch-save-clip");
  if (saveClipBtn) saveClipBtn.addEventListener("click", () => watchSaveActiveClip(w));
  (_c = document.getElementById("watch-final")) == null ? void 0 : _c.addEventListener("click", () => {
    w.idx = w.seq.length - 1;
    watchStop();
    watchTick(true);
  });
  // A render mid-playback destroys and rebuilds this overlay (it lives in the app's
  // innerHTML). Without this, the rebuild's watchTick(true) would CONSUME the next
  // play, so a burst of renders races the game forward and you only catch a fraction
  // of it. On an active same-key remount, step back one so we re-show the in-progress
  // frame instead of skipping ahead.
  if (_resumeActive) w.idx = Math.max(0, w.idx - 1);
  watchTick(true);
}
function watchDriveChart() {
  var _a, _b;
  const w = _watch;
  if (!w) return;
  const el = document.getElementById("watch-drives");
  if (!el) return;
  const curDi = (_b = (_a = w.seq[Math.min(w.idx, w.seq.length - 1)]) == null ? void 0 : _a.di) != null ? _b : -1;
  el.innerHTML = (w.r.drives || []).map((d, di) => {
    var _a2;
    const mine = d.possession === "home";
    const done = di < curDi || ((_a2 = w.seq[w.idx]) == null ? void 0 : _a2.kind) === "final";
    const tag = { td: "TD", fg: "FG", punt: "P", turnover: "TO", downs: "D", fg_miss: "FGX", half: "H", safety: "SF" }[d.result] || "\xB7";
    return `<span class="watch-pill ${mine ? "wp-home" : "wp-away"}${di === curDi ? " wp-live" : ""}" data-wdrive="${di}">${done || di === curDi ? tag : "\xB7"}</span>`;
  }).join("");
  el.querySelectorAll("[data-wdrive]").forEach((pill) => pill.addEventListener("click", () => {
    const di = parseInt(pill.dataset.wdrive);
    const at = w.seq.findIndex((s) => s.di === di && s.kind === "drive");
    if (at >= 0) {
      w.idx = at;
      watchStop();
      watchTick(true);
    }
  }));
}
// Stage 5 (Playbook-Root): the broadcast reads the record's CALL stamps.
// watchLookLabel — the fielded LOOK ("Spread · Trips"), from the record's
// offFormation + variation. watchCalledCardHtml — the called play's CARD (the
// Builder's art) next to what happened: a composed play draws its own routes
// (library lookup by the recorded customPlayId), a named concept draws its
// identity art from the recorded formation. Pure presentation — reads stamps,
// never the sim.
function watchLookLabel(p) {
  if (!p || !p.offFormation) return null;
  const vd = p.variation ? (FORMATION_VARIATIONS[p.offFormation] || {})[p.variation] : null;
  return vd ? `${p.offFormation} \xB7 ${vd.label}` : p.offFormation;
}
// Stage 6: the board fields the LOOK the record says was fielded — the base
// slots with the variation's AUTHORED moves applied (VARIATION_LAYOUTS, the
// same table the diagrams draw). Same slot ids, so every recorded slot stamp
// (carrier/target/coverage) still resolves; records with no variation — every
// pre-Stage-5 record — get the base slots byte-identically.
function watchOffSlots(p) {
  var _a;
  const base = ((_a = OFF_FIELD_LAYOUTS[p == null ? void 0 : p.offFormation]) == null ? void 0 : _a.slots) || null;
  if (!base) return null;
  const vd = (p == null ? void 0 : p.variation) ? (FORMATION_VARIATIONS[p.offFormation] || {})[p.variation] : null;
  return (vd && variationLayoutSlots(base, vd.layout)) || base;
}
// Stage 6: a composed play ANIMATES AS DRAWN — resolve the recorded book
// play's authored routes onto the fielded slots with THE SAME resolver the
// card uses (resolveComposedReceivers), and hand watchphys the per-slot route
// plan. Cached on the record (presentation stamp); null when the play isn't
// in this machine's library — the viewer falls back to concept/depth shapes.
function watchComposedRoutes(p, offSlots) {
  if (!p || !p.customPlayId || !offSlots) return null;
  if (p._composedRoutes !== void 0) return p._composedRoutes;
  p._composedRoutes = (() => {
    let data = null;
    try {
      data = loadCreationData("plays", p.customPlayId);
    } catch (e) {
      data = null;
    }
    if (!data) return null;
    const r = repairComposedPlay(data);
    if (!r.ok) return null;
    const { resolved } = resolveComposedReceivers(r.cp.parts, r.cp.assigns, offSlots);
    const bySlot = {};
    for (const rr of resolved) if (rr.slot) bySlot[rr.slot.id] = { part: rr.id, flip: !!rr.flip };
    const blocks = (r.cp.blocks || []).filter((b) => typeof b === "string" && !bySlot[b]);
    // D4/M2: the pre-snap play-art overlay also wants the play's KIND and a
    // composed run's authored design — stamp them on the cached plan.
    return { bySlot, blocks, kind: r.cp.kind === "run" ? "run" : "pass", run: r.cp.run || null };
  })();
  return p._composedRoutes;
}
function watchCalledCardHtml(p, opts) {
  if (!p || p.type === "penalty") return "";
  const o = opts || {};
  const W = o.w || 150, H = o.h || 92;
  let art = "", nm = p.concept || "";
  if (p.customPlayId) {
    let data = null;
    try {
      data = loadCreationData("plays", p.customPlayId);
    } catch (e) {
      data = null;
    }
    if (data) {
      const r = repairComposedPlay(data);
      if (r.ok) {
        art = renderComposedCard(r.cp, { w: W, h: H, scale: 0.8, formation: p.offFormation, variation: p.variation || void 0 });
        nm = r.cp.name || nm;
      }
    }
  }
  if (!art && p.concept) art = renderConceptThumb(p.concept, { w: W, h: H, scale: 0.8, formation: p.offFormation, variation: p.variation || void 0 });
  if (!art) return "";
  const look = watchLookLabel(p);
  return `<div class="wcc-kicker">THE CALL</div>${art}<div class="wcc-name">${escapeHtml(nm)}</div><div class="wcc-meta">${look ? escapeHtml(look) : ""}${p.bookName ? `${look ? " \xB7 " : ""}\u{1F4D6} ${escapeHtml(p.bookName)}` : ""}</div>`;
}
// ── D4/M2: the PRE-SNAP PLAY-ART OVERLAY (the Madden trust device) ─────────
// The called play's card art drawn over the fielded players before the snap,
// in WORLD space — the routes come from the script's own routeCues (the exact
// shapes the bodies are about to run, which for a composed play are the
// card's authored rows via COMPOSED_SHAPE), so card↔field agreement is
// visible on every snap instead of asserted. Runs draw the designed path to
// the recorded gap plus the pull. Projected through the frame's projectPoint,
// so every camera and both drive directions inherit the #49 handedness law.
// Replays and the Film Room inherit it for free (one scrimmage renderer).
var _ART_SHAPE_COLOR = {
  go: "go", seam: "go", sluggo: "go", fade: "fade", deepfade: "fade",
  post: "post", postcorner: "corner", corner: "corner", dig: "dig",
  out: "out", quickout: "out", outandup: "out", comeback: "comeback",
  curl: "curl", hitch: "curl", pivot: "curl", slant: "slant", whip: "slant",
  cross: "drag", deepcross: "drag", arrow: "flat", flat: "flat",
  wheel: "wheel", bubble: "bubble", tunnel: "tunnel", slip: "screen",
  stick: "checkdown"
};
function watchPlayArtPlan(p, script, offSlots) {
  if (!p || !script || !offSlots || !/^(pass|run)/.test(String(p.type || ""))) return null;
  const LOSW = 31, YPU = 0.85;
  const toB = (s) => [s.x * 100, LOSW + Math.max(0, s.y - 0.5) * 18 * YPU];
  const byId = {};
  offSlots.forEach((s) => { byId[s.id] = s; });
  const cr = p._composedRoutes || null;
  const paths = [];
  for (const cue of Array.isArray(script.routeCues) ? script.routeCues : []) {
    const s = byId[cue.id];
    if (!s) continue;
    const [bx, by] = toB(s);
    const flip = cr && cr.bySlot && cr.bySlot[cue.id] ? !!cr.bySlot[cue.id].flip : false;
    const mid = (bx <= 50 ? 1 : -1) * (flip ? -1 : 1);
    const wps = routeWaypoints(cue.shape, bx, by, mid);
    paths.push({ pts: [[bx, by], ...wps], color: routeColor(_ART_SHAPE_COLOR[cue.shape] || "checkdown"), cls: "wp-art-route", arrow: true });
  }
  // authored stay-in blockers (composed plays): the football "T" at the man
  for (const id of cr && Array.isArray(cr.blocks) ? cr.blocks : []) {
    const s = byId[id];
    if (!s) continue;
    const [bx, by] = toB(s);
    paths.push({ pts: [[bx, by], [bx, by - 1.4]], cls: "wp-art-block", tee: true });
  }
  // the run design: carrier's path to the recorded gap, plus the pull
  if (String(p.type).startsWith("run")) {
    const k = cr && cr.kind === "run" && cr.run ? { param: _artRunParam(cr.run) } : conceptKind(p.concept || "");
    const param = k.param || (k.kind === "run" ? _artRunTypeParam(k.rtype) : null);
    if (param) {
      const BACKS = ["RB", "WING", "ABACK", "WILDCAT", "JETMAN"];
      const qs = offSlots.find((s) => s.pos === "QB");
      const backs = offSlots.filter((s) => BACKS.includes(s.pos)).slice().sort((a, b) => b.y - a.y);
      const carrierSlot = p.carrierSlotId && byId[p.carrierSlotId] ? byId[p.carrierSlotId] : param.qb ? qs : backs[0] || qs;
      if (carrierSlot) {
        const [sx0, sy0] = toB(carrierSlot);
        const side = p.runDir === "left" ? -1 : p.runDir === "right" ? 1 : sx0 <= 50 ? 1 : -1;
        const gapX = Math.min(96, Math.max(4, 50 + side * (param.gap || 0.1) * 44));
        paths.push({ pts: [[sx0, sy0], [gapX, LOSW + 0.8], [gapX, LOSW - 5]], cls: "wp-art-run", arrow: true });
        if (param.pull) {
          const ol = offSlots.filter((s) => s.pos === "OL").slice().sort((a, b) => a.x - b.x);
          const g = ol[side > 0 ? 1 : 3];
          if (g) {
            const [gx, gy] = toB(g);
            paths.push({ pts: [[gx, gy], [gx + side * 2, gy + 1.6], [gapX - side * 2, LOSW + 0.8]], cls: "wp-art-pull", arrow: true });
          }
        }
      }
    }
  }
  return paths.length ? paths : null;
}
// the card's run vocabulary, reachable without importing routeart internals
function _artRunParam(run) {
  const GAPS = { inside: 0.1, offtackle: 0.22, outside: 0.3, toss: 0.36, draw: 0.1 };
  return { gap: GAPS[run.path] != null ? GAPS[run.path] : 0.1, pull: run.scheme === "gap" || run.scheme === "trap", qb: run.carrier === "QB" };
}
function _artRunTypeParam(rtype) {
  const T = {
    inside: { gap: 0.1 }, outside: { gap: 0.3 }, power: { gap: 0.22, pull: true },
    counter: { gap: 0.22, pull: true }, trap: { gap: 0.08, pull: true }, draw: { gap: 0.1 },
    dive: { gap: 0.05 }, sweep: { gap: 0.34, pull: true }, toss: { gap: 0.36 },
    jet: { gap: 0.38 }, reverse: { gap: 0.34 }, option: { gap: 0.28, qb: true },
    triple: { gap: 0.26, qb: true }, qbpower: { gap: 0.18, pull: true, qb: true }
  };
  return T[rtype] || T.inside;
}
// One frame of the overlay: project the world-space plan through the frame's
// camera. Rebuilt only when the camera changes; per-frame cost is opacity.
function watchPlayArtMarkup(plan, projectPoint) {
  let out = "";
  for (const row of plan) {
    const pts = row.pts.map(([wx, wy]) => projectPoint(wx, wy));
    const ptStr = pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
    const style = row.color ? ` style="stroke:${row.color}"` : "";
    out += `<polyline points="${ptStr}" class="${row.cls}"${style}/>`;
    const n = pts.length;
    if (row.arrow && n >= 2) {
      const [x1, y1] = pts[n - 2], [x2, y2] = pts[n - 1];
      const L = Math.hypot(x2 - x1, y2 - y1) || 1;
      const ux = (x2 - x1) / L, uy = (y2 - y1) / L;
      const w = 0.7;
      out += `<polygon points="${(x2 + ux * 1.1).toFixed(2)},${(y2 + uy * 1.1).toFixed(2)} ${(x2 - uy * w).toFixed(2)},${(y2 + ux * w).toFixed(2)} ${(x2 + uy * w).toFixed(2)},${(y2 - ux * w).toFixed(2)}" class="${row.cls}-head"${row.color ? ` style="fill:${row.color}"` : ""}/>`;
    }
    if (row.tee && n >= 2) {
      // the crossbar sits perpendicular to the stem, whatever the camera
      const [x1, y1] = pts[n - 2], [x2, y2] = pts[n - 1];
      const L = Math.hypot(x2 - x1, y2 - y1) || 1;
      const ux = (x2 - x1) / L, uy = (y2 - y1) / L;
      out += `<line x1="${(x2 - uy * 1.1).toFixed(2)}" y1="${(y2 + ux * 1.1).toFixed(2)}" x2="${(x2 + uy * 1.1).toFixed(2)}" y2="${(y2 - ux * 1.1).toFixed(2)}" class="wp-art-block"/>`;
    }
  }
  return out;
}
function watchBug(p, d) {
  var _a, _b;
  const w = _watch;
  const r = w.r;
  const hs = p ? d.possession === "home" ? p.scoreOff : p.scoreDef : r.homeScore;
  const as = p ? d.possession === "home" ? p.scoreDef : p.scoreOff : r.awayScore;
  const clock = p ? fmtPlayClock(p) || "\u2014:\u2014" : "FINAL";
  const half = p ? `${p.half === 2 ? "2nd" : "1st"} HALF` : "";
  const dd = p && p.down ? `${ordinal3(p.down)} & ${p.distance}` : "";
  const spot = p ? fmtSpot(p.fieldPos) || "" : "";
  const hasBall = p ? d.possession : null;
  const home = r.homeSchool || null;
  const away = r.awaySchool || null;
  const short = (school, fallback) => escapeHtml(String((school == null ? void 0 : school.abbr) || (school == null ? void 0 : school.name) || fallback).slice(0, 4).toUpperCase());
  const el = document.getElementById("watch-bug");
  if (!el) return;
  el.classList.remove("wsb-possession-change");
  el.dataset.possession = hasBall || "";
  el.innerHTML = `
  <div class="wsb-matchup">
    <div class="wsb-side wsb-home${hasBall === "home" ? " has-ball" : ""}">
      <span class="wsb-crest">${home ? renderCrest(home, 34) : ""}</span>
      <span class="wsb-identity"><b>${short(home, "HOME")}</b><small>${escapeHtml(((_a = home) == null ? void 0 : _a.name) || "Home")}</small></span>
      <span class="wsb-score">${hs}</span>
    </div>
    <div class="wsb-clockbox">
      <div class="wsb-network">BLUEPRINT</div>
      <div class="wsb-clock">${clock}</div>
      <div class="wsb-half">${half || "GAME"}</div>
    </div>
    <div class="wsb-side wsb-away${hasBall === "away" ? " has-ball" : ""}">
      <span class="wsb-score">${as}</span>
      <span class="wsb-identity"><b>${short(away, "AWAY")}</b><small>${escapeHtml(((_b = away) == null ? void 0 : _b.name) || "Away")}</small></span>
      <span class="wsb-crest">${away ? renderCrest(away, 34) : ""}</span>
    </div>
  </div>
  <div class="wsb-situation">${dd ? `<b>${dd}</b>${spot ? `<span>${spot}</span>` : ""}` : `<b>${p ? "READY" : "FINAL"}</b>`}</div>`;
  const insight = document.getElementById("watch-desktop-insight");
  if (insight) {
    const possSchool = p ? (d == null ? void 0 : d.possession) === "away" ? r.awaySchool : r.homeSchool : null;
    const type = String((p == null ? void 0 : p.type) || "");
    const play = (p == null ? void 0 : p.concept) || ((p == null ? void 0 : p.sack) ? "Pass rush wins" : type.startsWith("pass") ? "Dropback pass" : type.startsWith("run") ? "Designed run" : type === "punt" ? "Punt" : type === "fg" ? "Field goal" : "Awaiting snap");
    // Stage 5: the rail speaks the BOOK \u2014 the fielded look, the call's source
    // book, and the called play's card (the Builder's art) next to the result.
    const _card = watchCalledCardHtml(p, { w: 150, h: 92 });
    insight.innerHTML = `<div class="wdi-kicker">FIELD NOTES</div>
    <div class="wdi-grid">
      <div class="wdi-cell"><span>POSSESSION</span><b>${escapeHtml((possSchool == null ? void 0 : possSchool.name) || "Between drives")}</b></div>
      <div class="wdi-cell"><span>FORMATION</span><b>${escapeHtml(watchLookLabel(p) || "\u2014")}</b></div>
      <div class="wdi-cell"><span>PLAY</span><b>${escapeHtml(play)}</b>${(p == null ? void 0 : p.bookName) ? `<small class="wdi-book">\u{1F4D6} ${escapeHtml(p.bookName)}${p.customPlayId ? " \xB7 your play" : ""}</small>` : ""}</div>
      <div class="wdi-cell"><span>FIELD</span><b>${escapeHtml(dd ? `${dd}${spot ? ` \xB7 ${spot}` : ""}` : "\u2014")}</b></div>
    </div>${_card ? `<div class="wdi-callcard">${_card}</div>` : ""}`;
  }
}
function watchBugPossession(side) {
  const el = document.getElementById("watch-bug");
  if (!el || side !== "home" && side !== "away") return;
  el.dataset.possession = side;
  el.querySelector(".wsb-home") == null ? void 0 : el.querySelector(".wsb-home").classList.toggle("has-ball", side === "home");
  el.querySelector(".wsb-away") == null ? void 0 : el.querySelector(".wsb-away").classList.toggle("has-ball", side === "away");
  const school = side === "home" ? _watch == null ? void 0 : _watch.r.homeSchool : _watch == null ? void 0 : _watch.r.awaySchool;
  const possessionCell = document.querySelector("#watch-desktop-insight .wdi-cell");
  const value = possessionCell == null ? void 0 : possessionCell.querySelector("b");
  if (value) value.textContent = (school == null ? void 0 : school.name) || "Possession changed";
  el.classList.remove("wsb-possession-change");
  void el.offsetWidth;
  el.classList.add("wsb-possession-change");
}
var _watchAnim = null;
function watchStopAnim() {
  if (_watchAnim == null ? void 0 : _watchAnim.raf) cancelAnimationFrame(_watchAnim.raf);
  _watchAnim = null;
}
function watchBoardColors(w, d) {
  var _a, _b, _c, _d;
  const r = w == null ? void 0 : w.r;
  if (!r) return null;
  if (r.viewerBoard) return __spreadProps(__spreadValues({}, watchClone(r.viewerBoard)), { possession: (d == null ? void 0 : d.possession) === "away" ? "away" : "home" });
  const pick2 = (school, i, fb) => {
    var _a2, _b2;
    const c = ((_a2 = school == null ? void 0 : school.colors) == null ? void 0 : _a2[i]) || ((_b2 = school == null ? void 0 : school.colors) == null ? void 0 : _b2[0]);
    return c ? teamAccentColor(c) : fb;
  };
  // [PLAYTEST 2026-08-12 item 9c] This used to slow the WALL CLOCK for every play
  // in a lower-division game — 0.86× in D3, 0.93× in D2 — which made the football
  // itself slow rather than making the football look less crisp. It also hit new
  // players hardest: Simple game planning locks you to a D3 start, so the very
  // first game anyone sees played at 86% speed. Division flavour belongs in
  // stride and animation quality, not in the clock, so the multiplier is 1.
  const divM = (dv) => 1;
  // M25: per-GAME weather, deterministic — hashed from the matchup + the
  // calendar day, so every play (and every stage: call, halftime, final) of
  // one game renders the same sky. Presentation only; the sim never reads it.
  const wxKey = `${((_c = r.homeSchool) == null ? void 0 : _c.abbr) || "H"}|${((_d = r.awaySchool) == null ? void 0 : _d.abbr) || "A"}|${state.season || 0}|${state.day || 0}`;
  let wxH = 2166136261;
  for (let i = 0; i < wxKey.length; i++) {
    wxH ^= wxKey.charCodeAt(i);
    wxH = Math.imul(wxH, 16777619);
  }
  wxH = wxH >>> 0;
  const wxRoll = wxH % 1000 / 1000;
  const wxLate = (state.day || 1) >= 19;
  const weather = {
    kind: wxRoll < 0.13 ? "rain" : wxLate && wxRoll < 0.21 ? "snow" : "clear",
    intensity: 0.55 + (wxH >>> 4) % 100 / 220,
    seed: wxH
  };
  return {
    possession: (d == null ? void 0 : d.possession) === "away" ? "away" : "home",
    weather,
    homeFill: pick2(r.homeSchool, 0, "var(--team-1,#eaeaea)"),
    homeHi: pick2(r.homeSchool, 1, "var(--team-2,#ffd34d)"),
    awayFill: pick2(r.awaySchool, 0, "#c23a35"),
    awayHi: pick2(r.awaySchool, 1, "#f4f0d8"),
    homeName: ((_a = r.homeSchool) == null ? void 0 : _a.name) || "",
    awayName: ((_b = r.awaySchool) == null ? void 0 : _b.name) || "",
    homeAbbr: ((_c = r.homeSchool) == null ? void 0 : _c.abbr) || ((_c = r.homeSchool) == null ? void 0 : _c.name) || "H",
    divMult: (divM((_c = r.homeSchool) == null ? void 0 : _c.division) + divM((_d = r.awaySchool) == null ? void 0 : _d.division)) / 2
  };
}
var WATCH_SIDE = Object.freeze({
  ypu: 0.85,
  longitudinal: 1.35,
  fieldTop: 8,
  fieldHeight: 42,
  viewW: 100,
  viewH: 56
});
// The stadium stays fixed on screen (home end zone left, visitor right), while
// the offense changes direction with possession. Home attacks right; away
// attacks left. All viewer coordinates derive from this one sign so the LOS,
// first-down line, actors, ball and camera can never disagree.
var _watchSideDir = 1;
function watchSideDirection(board) {
  return (board == null ? void 0 : board.possession) === "away" ? -1 : 1;
}
function watchSideFacing(team) {
  const off = _watchSideDir > 0 ? "e" : "w";
  return team === "off" ? off : off === "e" ? "w" : "e";
}
function watchCameraFacing(mode, team) {
  if (["coach", "endzone"].includes(normalizeWatchCamera(mode))) return team === "off" ? "n" : "s";
  return watchSideFacing(team);
}
function watchSideX(worldY) {
  return 31 + _watchSideDir * (31 - worldY) * WATCH_SIDE.longitudinal;
}
function watchSideY(worldX) {
  // #49: the lateral axis mirrors with the drive direction (see
  // projectWatchPoint) so the fielded look keeps the card's handedness in
  // both drive directions. This helper and watchSideWorldPoint are the local
  // pair; they must always invert each other.
  const latX = _watchSideDir < 0 ? 100 - worldX : worldX;
  return WATCH_SIDE.fieldTop + latX * (WATCH_SIDE.fieldHeight / 100);
}
function watchSidePoint(worldX, worldY) {
  return [watchSideX(worldY), watchSideY(worldX)];
}
function watchCameraPoint(mode, worldX, worldY, z = 0) {
  return projectWatchPoint(mode, worldX, worldY, {
    direction: _watchSideDir,
    fieldTop: WATCH_SIDE.fieldTop,
    fieldHeight: WATCH_SIDE.fieldHeight,
    longitudinal: WATCH_SIDE.longitudinal,
    z
  });
}
function watchCameraScale(mode, worldX, worldY) {
  return watchProjectionScale(mode, worldX, worldY, { direction: _watchSideDir });
}
function watchCameraDepth(mode, worldX, worldY) {
  return watchProjectionDepth(mode, worldX, worldY, {
    direction: _watchSideDir,
    fieldTop: WATCH_SIDE.fieldTop,
    fieldHeight: WATCH_SIDE.fieldHeight,
    longitudinal: WATCH_SIDE.longitudinal
  });
}
function watchSideFieldX(absYard, fieldPos) {
  return 31 + _watchSideDir * (absYard - fieldPos) * WATCH_SIDE.ypu * WATCH_SIDE.longitudinal;
}
function watchSideCameraX(p, focusX = 31, viewW = WATCH_SIDE.viewW) {
  const fp = Number.isFinite(p == null ? void 0 : p.fieldPos) ? p.fieldPos : 50;
  const endZone = 10 * WATCH_SIDE.ypu * WATCH_SIDE.longitudinal;
  const goalA = watchSideFieldX(0, fp), goalB = watchSideFieldX(100, fp);
  const minX = Math.min(goalA, goalB) - endZone - 4;
  const maxX = Math.max(goalA, goalB) + endZone + 4 - viewW;
  const wanted = focusX - viewW * (_watchSideDir > 0 ? 0.38 : 0.62);
  return Math.max(minX, Math.min(Math.max(minX, maxX), wanted));
}
function watchSetSpritePalette(svg, board) {
  if (!svg || !board) return;
  const offHome = board.possession !== "away";
  const oF = offHome ? board.homeFill : board.awayFill;
  const oH = offHome ? board.homeHi : board.awayHi;
  const dF = offHome ? board.awayFill : board.homeFill;
  const dH = offHome ? board.awayHi : board.homeHi;
  svg.style.setProperty("--wsp-off", oF || "var(--team-1, #eaeaea)");
  svg.style.setProperty("--wsp-off-hl", oH || oF || "var(--team-2, #ffd34d)");
  svg.style.setProperty("--wsp-def", dF || "#c23a35");
  svg.style.setProperty("--wsp-def-hl", dH || dF || "#f4f0d8");
}
function watchReplayPlayer(p, actor, script, names) {
  let id = null;
  if (actor.id === "QB") id = p.throwerId || p.rusherId;
  else if (actor.id === p.targetSlotId) id = p.receiverId || p.targetId;
  else if (actor.id === p.carrierSlotId) id = p.rusherId || p.returnerId;
  else if (actor.id === script.pickId) id = p.intPickerId;
  else if (actor.id === script.covId) id = p.pbuId || p.beatenDefId;
  else if (script.tackleCue && actor.id === script.tackleCue.id) id = p.tacklerId;
  else if (script.tackleCue && actor.id === script.tackleCue.assistId) id = p.tacklerId2;
  const entry = id && names[id] || null;
  return {
    id,
    name: entry && entry.name || actor.label || actor.id,
    pos: entry && entry.pos || actor.grp || actor.label || "Player",
    team: actor.team,
    role: actor.qb ? "Quarterback" : actor.id === p.targetSlotId ? "Target" : actor.id === p.carrierSlotId ? "Ball carrier" : actor.id === script.pickId ? "Interceptor" : actor.id === script.covId ? "Coverage" : actor.team === "off" ? "Offense" : "Defense"
  };
}
function watchReplaySetCamera(playback, svg, script, nodes, next, isDirectorCut = false) {
  const camera = normalizeWatchCamera(next);
  if (camera === playback.cameraMode) return false;
  playback.cameraMode = camera;
  playback.projectionDirty = true;
  for (const actor of script.actors || []) {
    const node = nodes[actor.id];
    if (!node) continue;
    node._wsm = null;
    node.classList.remove("wsp-face-e", "wsp-face-w", "wsp-face-n", "wsp-face-s");
    node.classList.add("wsp-face-" + watchCameraFacing(camera, actor.team));
  }
  const camBtn = document.getElementById("replay-camera");
  if (camBtn) camBtn.textContent = watchCameraLabel(camera);
  if (isDirectorCut) {
    svg.classList.remove("watch-director-cut");
    void svg.getBoundingClientRect();
    svg.classList.add("watch-director-cut");
  }
  return true;
}
function watchApplyLabelPlan(cameraMode, actors, actorPts, nodes, featuredIds = []) {
  const featured = new Set(featuredIds.filter(Boolean));
  const entries = actors.map((actor) => {
    const pt = actorPts[actor.id] || [0, 0];
    const room = String(actor.grp || actor.label || "").toUpperCase();
    const priority = featured.has(actor.id) ? 3 : /^(QB|RB|WR|TE|FB|CB|FS|SS|S|K|P|PR|KR)$/.test(room) ? 1 : 0;
    return { id: actor.id, x: pt[0], y: pt[1], priority };
  });
  const visible = new Set(selectWatchLabels(entries, { camera: cameraMode }));
  for (const actor of actors) {
    const node = nodes[actor.id];
    if (!node) continue;
    node.classList.toggle("wp-label-muted", !visible.has(actor.id));
    node.classList.toggle("wp-label-featured", featured.has(actor.id));
  }
}
function watchApplyDirectorFocus(playback, svg, script, p, nodes, specialTeams = false) {
  const on = !!(playback.interactive && playback.director && playback.directorReason);
  const bug = document.getElementById("watch-director-bug");
  for (const node of Object.values(nodes)) {
    node.classList.remove("wp-focus-primary", "wp-focus-secondary");
  }
  svg.classList.toggle("watch-focus-ball", false);
  if (!on) {
    delete svg.dataset.directorFocus;
    if (bug) {
      bug.textContent = "";
      bug.classList.remove("on");
    }
    return null;
  }
  const focus = specialTeams
    ? specialTeamsDirectorFocus(script.actors || [], playback.directorReason)
    : replayDirectorFocus(script, p, playback.directorReason);
  focus.primary.forEach((id) => nodes[id] == null ? void 0 : nodes[id].classList.add("wp-focus-primary"));
  focus.secondary.forEach((id) => nodes[id] == null ? void 0 : nodes[id].classList.add("wp-focus-secondary"));
  svg.classList.toggle("watch-focus-ball", focus.ball);
  svg.dataset.directorFocus = focus.kind;
  if (bug) {
    if (bug.textContent !== focus.label) bug.textContent = focus.label;
    bug.classList.add("on");
  }
  return focus;
}
function watchWireInteractiveReplay(playback, svg, script, p, board, nodes) {
  const tools = document.getElementById("watch-replay-tools");
  const ink = document.getElementById("watch-ink");
  if (!tools || !ink) return;
  tools.classList.add("on");
  const playBtn = document.getElementById("replay-play");
  const scrub = document.getElementById("replay-scrub");
  const rateBtn = document.getElementById("replay-rate");
  const directorBtn = document.getElementById("replay-director");
  const camBtn = document.getElementById("replay-camera");
  const inkBtn = document.getElementById("replay-ink");
  const undoBtn = document.getElementById("replay-undo");
  const stillBtn = document.getElementById("replay-still");
  const videoBtn = document.getElementById("replay-video");
  const saveBtn = document.getElementById("replay-save");
  const syncPlay = () => {
    if (playBtn) playBtn.textContent = playback.paused ? "▶" : "⏸";
    if (inkBtn) inkBtn.classList.toggle("active", playback.ink);
    if (directorBtn) {
      directorBtn.classList.toggle("active", !!playback.director);
      directorBtn.textContent = playback.director ? "Auto" : "Director";
      directorBtn.title = playback.director ? `Director on${playback.directorReason ? `: ${playback.directorReason}` : ""}` : "Automatically cut cameras by play phase";
    }
    ink.classList.toggle("drawing", playback.ink && playback.paused);
  };
  playback.renderInk = () => {
    ink.innerHTML = playback.annotations.filter((stroke) => !stroke.camera || stroke.camera === playback.cameraMode).map((stroke) => `<polyline points="${(stroke.points || []).map((pt) => `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`).join(" ")}" fill="none" stroke="${stroke.color || "#ffd54a"}" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
  };
  playback.renderInk();
  if (playBtn) playBtn.addEventListener("click", () => {
    if (playback.t >= playback.duration - 0.01) playback.seek(0);
    playback.paused = !playback.paused;
    playback.ink = playback.ink && playback.paused;
    syncPlay();
    if (!playback.paused) playback.seek(playback.t);
  });
  if (scrub) {
    scrub.addEventListener("input", () => {
      playback.paused = true;
      playback.ink = false;
      playback.seek(parseInt(scrub.value, 10) / 1000 * playback.duration);
      syncPlay();
    });
  }
  if (rateBtn) rateBtn.addEventListener("click", () => {
    playback.rate = playback.rate === 1 ? 0.5 : playback.rate === 0.5 ? 0.25 : 1;
    rateBtn.textContent = playback.rate === 0.5 ? "½×" : playback.rate === 0.25 ? "¼×" : "1×";
  });
  if (directorBtn) directorBtn.addEventListener("click", () => {
    playback.director = !playback.director;
    if (playback.director && playback.directorPlan) {
      const cut = playback.directorPlan.at(playback.t);
      playback.directorReason = cut.reason;
      watchReplaySetCamera(playback, svg, script, nodes, cut.camera, true);
    }
    playback.renderInk();
    playback.seek(playback.t);
    syncPlay();
  });
  if (camBtn) {
    camBtn.textContent = watchCameraLabel(playback.cameraMode);
    camBtn.addEventListener("click", () => {
      playback.director = false;
      watchReplaySetCamera(playback, svg, script, nodes, nextWatchCamera(playback.cameraMode));
      playback.renderInk();
      playback.seek(playback.t);
      syncPlay();
    });
  }
  if (inkBtn) inkBtn.addEventListener("click", () => {
    if (!playback.paused) {
      playback.paused = true;
      if (_watchAnim && _watchAnim.raf) cancelAnimationFrame(_watchAnim.raf);
    }
    playback.ink = !playback.ink;
    syncPlay();
  });
  if (undoBtn) undoBtn.addEventListener("click", () => {
    playback.annotations.pop();
    playback.renderInk();
  });
  let activeStroke = null;
  const pointOf = (e) => {
    const pt = ink.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const out = pt.matrixTransform(ink.getScreenCTM().inverse());
    return { x: out.x, y: out.y };
  };
  ink.addEventListener("pointerdown", (e) => {
    if (!playback.ink || !playback.paused) return;
    e.preventDefault();
    ink.setPointerCapture(e.pointerId);
    activeStroke = { camera: playback.cameraMode, color: "#ffd54a", points: [pointOf(e)] };
    playback.annotations.push(activeStroke);
    playback.renderInk();
  });
  ink.addEventListener("pointermove", (e) => {
    if (!activeStroke || !ink.hasPointerCapture(e.pointerId)) return;
    activeStroke.points.push(pointOf(e));
    playback.renderInk();
  });
  const stopStroke = () => { activeStroke = null; };
  ink.addEventListener("pointerup", stopStroke);
  ink.addEventListener("pointercancel", stopStroke);
  const names = _watch && _watch.r && _watch.r.playerNames || {};
  for (const actor of script.actors) {
    const node = nodes[actor.id];
    if (!node) continue;
    node.setAttribute("tabindex", "0");
    node.setAttribute("role", "button");
    const openCard = () => {
      if (playback.ink) return;
      const card = watchReplayPlayer(p, actor, script, names);
      const jersey = node.querySelector("[data-jersey]") && node.querySelector("[data-jersey]").getAttribute("data-jersey");
      const pop = document.getElementById("watch-player-pop");
      if (!pop) return;
      pop.innerHTML = `<button aria-label="Close player card">×</button><span>${escapeHtml(card.role)}</span><b>${jersey ? `#${escapeHtml(jersey)} ` : ""}${escapeHtml(card.name)}</b><small>${escapeHtml(card.pos)} · ${card.team === "off" ? "Offense" : "Defense"}</small>`;
      pop.classList.add("on");
      const close = pop.querySelector("button");
      if (close) close.addEventListener("click", () => pop.classList.remove("on"));
    };
    node.addEventListener("click", openCard);
    node.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") openCard(); });
  }
  if (stillBtn) stillBtn.addEventListener("click", () => {
    const visibleInk = playback.annotations.filter((stroke) => !stroke.camera || stroke.camera === playback.cameraMode);
    const xml = watchSerializedStill(svg, visibleInk);
    watchDownloadBlob(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }), `blueprint-still-${Date.now()}.svg`);
    notify("Annotated still saved", "success");
  });
  if (videoBtn) videoBtn.addEventListener("click", async () => {
    videoBtn.disabled = true;
    videoBtn.textContent = "Rendering…";
    try { await watchExportVideo(playback, svg); }
    finally { videoBtn.disabled = false; videoBtn.textContent = "Video"; }
  });
  if (saveBtn) saveBtn.addEventListener("click", () => watchSaveActiveClip(_watch));
  syncPlay();
}
function watchBoard(p, durMs, board = null, opts = {}) {
  var _a, _b, _c, _d, _e;
  const svg = document.getElementById("watch-board");
  if (!svg) return null;
  watchStopAnim();
  _watchSideDir = watchSideDirection(board);
  const projectionEligible = !!p && !["pat2", "kneel", "spike", "penalty"].includes(p.type);
  const initialCamera = projectionEligible ? normalizeWatchCamera(opts.clip && opts.clip.camera) : "broadcast";
  const initialPoint = (worldX, worldY, z = 0) => watchCameraPoint(initialCamera, worldX, worldY, z);
  svg.dataset.fieldDirection = _watchSideDir > 0 ? "right" : "left";
  svg.dataset.fieldPossession = (board == null ? void 0 : board.possession) || "";
  svg.dataset.camera = initialCamera;
  svg.classList.toggle("watch-camera-coach", initialCamera === "coach");
  svg.classList.toggle("watch-camera-endzone", initialCamera === "endzone");
  svg.classList.toggle("watch-camera-reverse", initialCamera === "reverse");
  // M25: the sky rides the board dataset so CSS (turf pellets, sheen) can
  // key off it without per-frame work.
  svg.dataset.weather = board && board.weather ? board.weather.kind : "clear";
  // M8 gives scrimmage plays an explicit stance window. Clear it before every
  // board dispatch so kick, flag and empty-field boards can never inherit a
  // stale pre-snap state from the preceding play.
  svg.classList.remove(
    "watch-presnap", "watch-snap-release", "watch-pass-pocket", "watch-route-live", "watch-qb-mechanics",
    "watch-special-teams", "watch-kick-place", "watch-kick-punt", "watch-kickoff", "watch-kick-onside"
  );
  svg.classList.toggle("watch-replay", !!opts.replay);
  // M23: replay wipe — a one-shot broadcast sweep when a replay board starts.
  if (opts.replay) {
    const wipe = document.getElementById("watch-wipe");
    if (wipe) {
      wipe.classList.remove("run");
      void wipe.offsetWidth;
      wipe.classList.add("run");
    }
  }
  const cameraBug = document.getElementById("watch-camera-bug");
  const replayBug = document.getElementById("watch-replay-bug");
  if (cameraBug) cameraBug.textContent = opts.replay ? "REPLAY" : "LIVE";
  if (replayBug) replayBug.classList.toggle("on", !!opts.replay);
  // Stage 5: on a REPLAY, show the DRAW-UP next to what happened — the called
  // play's card from the record's stamps (concept/customPlayId + look + book).
  {
    const callCard = document.getElementById("watch-call-card");
    if (callCard) {
      const html = opts.replay ? watchCalledCardHtml(p, { w: 150, h: 92 }) : "";
      callCard.classList.toggle("on", !!html);
      callCard.innerHTML = html;
    }
  }
  svg.setAttribute("viewBox", `${watchSideCameraX(p).toFixed(2)} 0 ${WATCH_SIDE.viewW} ${WATCH_SIDE.viewH}`);
  watchSetSpritePalette(svg, board);
  if (p && (p.type === "fg" || p.type === "punt" || p.type === "pat")) return watchBoardKick(svg, p, board, opts);
  if (p && p.type === "kickoff") return watchBoardKickoff(svg, p, board, opts);
  if (p && p.type === "pat2") return watchBoardTry(svg, p, board);
  if (p && (p.type === "kneel" || p.type === "spike")) return watchBoardSituational(svg, p, board);
  // Stage 6: field the recorded LOOK (authored variation alignment) and seed
  // the composed play's drawn routes before the script builds.
  const offL = watchOffSlots(p);
  const defL = (_b = DEF_FIELD_LAYOUTS[p == null ? void 0 : p.defFront] || DEF_FIELD_LAYOUTS["4-3"]) == null ? void 0 : _b.slots;
  if (!p || !offL) {
    if ((p == null ? void 0 : p.type) === "penalty") return watchBoardFlag(svg, p, board);
    svg.innerHTML = watchFieldBase(p, board);
    return null;
  }
  watchComposedRoutes(p, offL);
  const script = buildPlayScript(p, offL, defL);
  if (!script) {
    if (p.type === "penalty") return watchBoardFlag(svg, p, board);
    svg.innerHTML = watchFieldBase(p, board);
    return null;
  }
  const sprites = ((_c = state.settings) == null ? void 0 : _c.spriteWatch) !== false;
  if (sprites) svg.classList.add("watch-sprites");
  else svg.classList.remove("watch-sprites");
  const glyph = (a) => sprites ? spriteMarkup(a, a.team === "off" ? "e" : "w") : a.team === "def" ? `<text class="wd-x" x="0" y="0">\u2715</text><text class="wd-lbl" x="0" y="-2.6">${a.label}</text>` : `<circle r="1.9" class="wo-c${a.qb ? " wo-qb" : ""}" cx="0" cy="0"/><text class="wo-lbl" x="0" y="4.4">${a.label}</text>`;
  // M23: the officials plan (pure, from watchphys) \u2014 three zebras placed per
  // frame, never inside the play, signaling the result.
  const offPlan = buildOfficialsPlan(script, p);
  const _off0 = offPlan.at(0);
  const officialsMarkup = `<g id="wp-officials">` + offPlan.crew.map((id, i) => {
    const [sx, sy] = initialPoint(_off0[i][0], _off0[i][1]);
    return watchOfficialMarkup(id, sx, sy);
  }).join("") + `</g>`;
  svg.innerHTML = watchFieldBase(p, board) + `<polyline id="wp-trail" class="wp-trail" points=""/><g id="wp-spot" class="wp-spot" transform="translate(0,0)"><ellipse class="wp-spot-ring" rx="2.6" ry="1.15"/><path class="wp-spot-chevron" d="M-1.15 1.8L0 3.05l1.15-1.25z"/></g><g id="wp-engagements">${(script.blocks || []).map((b, i) => `<g class="wp-engage" data-wengage="${i}"><ellipse class="wp-engage-shadow" rx="1.45" ry=".48"/><path class="wp-engage-pads" d="M-1.8-.8L-.35 0-1.8.8M1.8-.8L.35 0 1.8.8"/><circle class="wp-engage-core" r=".32"/></g>`).join("")}</g><g id="wp-blocks">${(script.blocks || []).map((b, i) => `<line class="wp-block-link" data-wblock="${i}"/>`).join("")}</g><g id="wp-playart" class="wp-playart"></g>` + officialsMarkup + `<g id="wp-actors">` + script.actors.map((a) => {
    const [sx, sy] = initialPoint(a.track[0][0], a.track[0][1]);
    const face = watchCameraFacing(initialCamera, a.team);
    return `<g class="wp-actor wp-team-${a.team}${a.qb ? " wp-qb" : ""}${sprites ? ` wsp-still wsp-face-${face}` : ""}" data-wpa="${a.id}" data-wpg="${a.grp || ""}" transform="translate(${sx.toFixed(2)},${sy.toFixed(2)})">` + (sprites ? spriteMarkup(a, face) : glyph(a)) + `</g>`;
  }).join("") + `</g><g id="wp-fx"></g><ellipse id="wp-ball-ground-shadow" class="wp-ball-ground-shadow" rx="1.05" ry=".36"/>` + (() => {
    const [sx, sy] = initialPoint(script.ball.track[0][0], script.ball.track[0][1]);
    return ballMarkup(sx, sy);
  })();
  svg.classList.add("watch-presnap");
  const CAM_ASPECT = WATCH_SIDE.viewW / WATCH_SIDE.viewH;
  const WIDE_H = 53;
  const CLOSE_H = 44;
  let camH = WIDE_H;
  let camW = camH * CAM_ASPECT;
  let camY = (WATCH_SIDE.viewH - camH) / 2;
  // M22: initialize on the pre-snap ANCHOR (the ball spot) — starting on the
  // generic LOS constant left a sub-unit pull that had the camera creeping
  // through the cadence (latent since M20; the live probe caught it).
  let camX = watchSideCameraX(p, watchSidePoint(script.ball.track[0][0], script.ball.track[0][1])[0], camW);
  if (initialCamera === "all22" || initialCamera === "coach") {
    camX = initialCamera === "coach" ? 0 : watchSideCameraX(p, 31, WATCH_SIDE.viewW);
    camY = 0;
    camW = WATCH_SIDE.viewW;
    camH = WATCH_SIDE.viewH;
  }
  // M20 camera slice (pulled forward from M22, scoped tight): slew-limited
  // pan/zoom — the camera accelerates and brakes instead of exponentially
  // whipping at its target, and holds framing rock-steady through the snap.
  let camVX = 0, camVH = 0;
  const CAM_PAN_ACCEL = 0.055, CAM_PAN_VMAX = 1.9, CAM_ZOOM_ACCEL = 0.03, CAM_ZOOM_VMAX = 0.85, CAM_DEAD = 0.35;
  const setCam = () => {
    const vb = `${camX.toFixed(2)} ${camY.toFixed(2)} ${camW.toFixed(2)} ${camH.toFixed(2)}`;
    svg.setAttribute("viewBox", vb);
    const ink = document.getElementById("watch-ink");
    if (ink) ink.setAttribute("viewBox", vb);
  };
  setCam();
  const nodes = {};
  svg.querySelectorAll("[data-wpa]").forEach((n) => {
    nodes[n.dataset.wpa] = n;
  });
  const actorLayer = svg.querySelector("#wp-actors");
  const ballN = svg.querySelector("#wp-ball"), ballGroundN = svg.querySelector("#wp-ball-ground-shadow"), trailN = svg.querySelector("#wp-trail"), fxN = svg.querySelector("#wp-fx");
  const spotN = svg.querySelector("#wp-spot");
  // D4/M2: the pre-snap play-art overlay — computed once per board from the
  // record + the script, projected per camera inside tick. Settings → Game →
  // Presentation owns the switch (on by default; presentation only).
  const playartN = svg.querySelector("#wp-playart");
  const playArtPlan = ((_e2) => (_e2 == null ? void 0 : _e2.presnapArt) === false ? null : watchPlayArtPlan(p, script, offL))(state.settings);
  const blockNodes = [...svg.querySelectorAll("[data-wblock]")];
  const engageNodes = [...svg.querySelectorAll("[data-wengage]")];
  // M23: officials + crowd-band parallax handles
  const officialNodes = [...svg.querySelectorAll("[data-wpo]")];
  const parN = svg.querySelector(".wf-stadium-par");
  const camX0Par = camX;
  // Viewer Act 2 / A2: watchphys owns the deterministic geometry-to-style
  // decision. The browser only applies its pose classes.
  const catchCue = script.catchCue || null;
  let tackleCue = null;
  if (script.tackleCue) {
    const tc = script.tackleCue;
    tackleCue = {
      id: tc.id,
      assistId: tc.assistId,
      joinCues: tc.joinCues || (tc.assistId ? [{ id: tc.assistId, t: tc.t + 0.02 }] : []),
      carrierId: tc.carrierId,
      cls: "wp-tk-" + tc.style,
      style: tc.style,
      sack: !!tc.sack,
      approachStart: tc.t - (tc.sack ? 0.34 : 0.62),
      breakdownStart: tc.t - (tc.sack ? 0.2 : 0.34),
      braceStart: tc.t - (tc.sack ? 0.14 : 0.32),
      assistStart: tc.t - 0.48,
      start: tc.t - (tc.sack ? 0.14 : 0.24),
      impact: tc.t,
      end: tc.t + 0.34,
      finish: script.dur,
      point: watchSidePoint(tc.x, tc.y)
    };
  }
  let moveCue = null;
  if (script.moveCue) {
    const mc = script.moveCue;
    moveCue = {
      id: mc.id,
      cls: "wp-mv-" + mc.style,
      style: mc.style,
      direction: mc.direction || null,
      plantStart: mc.t - 0.27,
      plantEnd: mc.t + 0.08,
      start: mc.t - 0.16,
      end: mc.t + (mc.style.includes("dive") || mc.style === "slide" ? 0.58 : 0.4)
    };
  }
  const rushCues = script.rushCues || [];
  const jamCues = script.jamCues || [];
  const routeCues = script.routeCues || [];
  const coverageCues = script.coverageCues || [];
  const pressCue = script.pressCue || null;
  const pumpCue = script.pumpCue || null;
  const qbCue = script.qbCue || null;
  const armSwitchCue = script.armSwitchCue || null;
  const carryArmState = (cc, time) => {
    const fallback = cc && (cc.arm === "l" || cc.arm === "left") ? "left" : "right";
    if (!armSwitchCue || !cc || armSwitchCue.id !== cc.id) return { arm: fallback, from: fallback, to: fallback, u: 1, switching: false };
    const span = Math.max(0.001, armSwitchCue.end - armSwitchCue.t);
    const u = Math.max(0, Math.min(1, (time - armSwitchCue.t) / span));
    return { arm: u < 0.5 ? armSwitchCue.from : armSwitchCue.to, from: armSwitchCue.from, to: armSwitchCue.to, u, switching: time >= armSwitchCue.t && time <= armSwitchCue.end };
  };
  const celebrateCue = script.celebrateCue ? { id: script.celebrateCue.id, start: script.celebrateCue.t, end: script.dur, style: script.celebrateCue.style || "bounce", mobIds: script.celebrateCue.mobIds || [] } : null;
  let beatenCue = null;
  {
    const bf = (script.fx || []).find((f) => f.kind === "beaten");
    if (bf) beatenCue = { id: bf.actorId, start: bf.t, end: bf.t + 0.8 };
  }
  const catchT = (_e = (_d = (script.fx || []).find((f) => f.kind === "catch" || f.kind === "inc" || f.kind === "int")) == null ? void 0 : _d.t) != null ? _e : null;
  const turnoverFx = (script.fx || []).find((f) => f.kind === "int" || f.kind === "fum") || null;
  const looseFx = (script.fx || []).find((f) => f.kind === "fum") || null;
  const repCls = [...new Set((script.blocks || []).filter((b) => b.rep).map((b) => "wp-rep-" + b.rep))];
  // M9 turns one generic blocking loop into a recorded engagement sequence.
  // These are viewer-only pose states; actor tracks and results stay untouched.
  const contactCls = [
    "wp-contact-off", "wp-contact-def", "wp-contact-strike",
    "wp-contact-drive", "wp-contact-strain", "wp-contact-tight",
    "wp-contact-space"
  ];
  const passSetCls = [
    "wp-pass-set", "wp-pass-anchor", "wp-pass-lost", "wp-pass-engaged",
    "wp-pass-won", "wp-pass-edge", "wp-pass-power", "wp-pass-counter",
    "wp-pocket-qb", "wp-trench-kick-slide", "wp-trench-anchor",
    "wp-trench-redirect", "wp-trench-rusher-speed", "wp-trench-rusher-bull",
    "wp-trench-rusher-counter"
  ];
  const downfieldCls = [
    "wp-route-active", "wp-route-target", "wp-route-release", "wp-route-stem",
    "wp-route-break", "wp-route-cut", "wp-route-double", "wp-route-settle",
    "wp-route-vertical", "wp-route-left", "wp-route-right", "wp-route-straight",
    "wp-route-hands", "wp-cov-active", "wp-cov-target", "wp-cov-man",
    "wp-cov-zone", "wp-cov-press", "wp-cov-pedal", "wp-cov-turn",
    "wp-cov-trail", "wp-cov-left", "wp-cov-right", "wp-catchpoint",
    "wp-catchpoint-receiver", "wp-catchpoint-defender", "wp-catchpoint-secure",
    "wp-catchpoint-breakup", "wp-catch-style-secure", "wp-catch-style-toe-tap",
    "wp-catch-style-layout", "wp-catch-style-high-point", "wp-catch-style-one-hand",
    "wp-catch-style-battle", "wp-catch-style-breakup", "wp-catch-style-pick"
  ];
  const qbMechanicCls = [
    "wp-qb-mechanics", "wp-qb-quick", "wp-qb-three", "wp-qb-five",
    "wp-qb-playaction", "wp-qb-snap", "wp-qb-mesh", "wp-qb-drop",
    "wp-qb-hitch", "wp-qb-reset", "wp-qb-load", "wp-qb-follow",
    "wp-qb-rollout", "wp-qb-rollout-left", "wp-qb-rollout-right",
    "wp-qb-escape", "wp-qb-pa-carry", "wp-qb-throw-set",
    "wp-qb-throw-sidearm", "wp-qb-throw-on-run", "wp-qb-throw-off-platform",
    "wp-qb-throw-pa-carry"
  ];
  const tackleSetupCls = [
    "wp-tk-pursuit", "wp-tk-breakdown", "wp-tk-leverage-left",
    "wp-tk-leverage-right", "wp-tk-assist-lane", "wp-carrier-brace",
    "wp-carrier-secure", "wp-carrier-brace-left", "wp-carrier-brace-right"
  ];
  const secondaryCls = [
    "wp-a3-weight", "wp-a3-gather", "wp-a3-sprint",
    "wp-a3-head-left", "wp-a3-head-right"
  ];
  const carryArmCls = ["wp-carry-arm-left", "wp-carry-arm-right", "wp-arm-switching"];
  const liftN = ballN == null ? void 0 : ballN.querySelector(".wab-lift");
  const aimN = ballN == null ? void 0 : ballN.querySelector(".wab-aim");
  // M21 ball-render state: last rendered (lift-inclusive) point + held flight
  // angle, so the ball can orient along its own motion while in the air.
  let prevBallR = null, ballAng = 0;
  let flightArc = null;
  if (script.throwCue && catchT != null && catchT > script.throwCue.release) {
    const rel = script.throwCue.release;
    const [rx, ry] = sampleTrack(script.ball.track, script.step, rel);
    const [cx2, cy2] = sampleTrack(script.ball.track, script.step, catchT);
    const fdist = Math.hypot(cx2 - rx, cy2 - ry);
    const armM = script.throwCue.arm != null ? Math.max(0.55, Math.min(1.35, 1 - (script.throwCue.arm - 55) / 130)) : 1;
    flightArc = { rel, end: catchT, loft: Math.max(0.8, Math.min(5.2, fdist * 0.16 * armM)) };
  }
  const speed = ((_watch == null ? void 0 : _watch.speed) || 1) * ((board == null ? void 0 : board.divMult) || 1) * (opts.replay ? 0.68 : 1);
  // M22: the camera plan — leading anchors, contextual zoom, turnover
  // settle, celebration hold, and the replay time-warp (budget-neutral, so
  // the watch loop's replay wall-time math is untouched).
  const camPlan = buildCameraPlan(script, p, { wideH: WIDE_H, closeH: CLOSE_H, longitudinal: WATCH_SIDE.longitudinal });
  const t0 = performance.now();
  let _tWarp = 0, _lastWall = t0;
  const playback = {
    interactive: !!opts.interactive,
    paused: false,
    rate: 1,
    t: 0,
    duration: script.dur,
    cameraMode: initialCamera,
    director: false,
    directorPlan: buildReplayDirectorPlan(script, p),
    directorReason: "",
    projectionDirty: false,
    annotations: opts.clip && Array.isArray(opts.clip.annotations) ? watchClone(opts.clip.annotations) : [],
    ink: false,
    exporting: false,
    lastRenderedT: 0,
    seek: null,
    renderInk: null
  };
  // M24 perf state: frame-time EMA for the auto lite mode.
  let _frameEma = null, _lastFrameWall = t0;
  const shown = /* @__PURE__ */ new Set();
  const trail = [];
  let lastTrail = null;
  let impactShown = false;
  let snapHeard = false;
  let whistleHeard = false;
  const tick = () => {
    var _a2, _b2, _c2, _d2, _e2, _f, _g, _h, _i, _j, _k;
    if (!svg.isConnected) {
      watchStopAnim();
      return;
    }
    if (playback.interactive && playback.director && playback.directorPlan) {
      const cut = playback.directorPlan.at(playback.t);
      playback.directorReason = cut.reason;
      svg.dataset.directorReason = cut.reason;
      watchReplaySetCamera(playback, svg, script, nodes, cut.camera, true);
      const directorBtn = document.getElementById("replay-director");
      if (directorBtn) directorBtn.title = `Director on: ${cut.reason}`;
    } else delete svg.dataset.directorReason;
    watchApplyDirectorFocus(playback, svg, script, p, nodes);
    const cameraMode = playback.interactive ? normalizeWatchCamera(playback.cameraMode) : "broadcast";
    const projectPoint = (worldX, worldY, z = 0) => watchCameraPoint(cameraMode, worldX, worldY, z);
    svg.dataset.camera = cameraMode;
    svg.classList.toggle("watch-camera-coach", cameraMode === "coach");
    svg.classList.toggle("watch-camera-endzone", cameraMode === "endzone");
    svg.classList.toggle("watch-camera-reverse", cameraMode === "reverse");
    if (playback.projectionDirty) {
      shown.clear();
      trail.length = 0;
      lastTrail = null;
      if (trailN) trailN.setAttribute("points", "");
      if (fxN) fxN.innerHTML = "";
      impactShown = false;
      prevBallR = null;
      playback.projectionDirty = false;
    }
    // M22 replay time-warp: in replay mode play-time accumulates through the
    // plan's warp (slow at the contact moments, compensated elsewhere — the
    // total replay duration is unchanged). Live playback is the plain clock.
    const _wallNow = performance.now();
    let t;
    if (playback.interactive) {
      if (!playback.paused) playback.t = Math.min(script.dur, playback.t + Math.max(0, _wallNow - _lastWall) / 1e3 * playback.rate);
      t = playback.t;
      const scrub = document.getElementById("replay-scrub");
      if (scrub && document.activeElement !== scrub) scrub.value = String(Math.round(t / Math.max(0.001, script.dur) * 1000));
    } else if (opts.replay) {
      _tWarp += Math.max(0, _wallNow - _lastWall) / 1e3 * speed * camPlan.warpAt(_tWarp);
      t = Math.min(script.dur, _tWarp);
    } else t = Math.min(script.dur, (_wallNow - t0) / 1e3 * speed);
    _lastWall = _wallNow;
    if (playback.interactive && t + 0.01 < playback.lastRenderedT) {
      shown.clear();
      trail.length = 0;
      lastTrail = null;
      if (trailN) trailN.setAttribute("points", "");
      if (fxN) fxN.innerHTML = "";
      impactShown = false;
      prevBallR = null;
    }
    playback.lastRenderedT = t;
    if (!opts.replay && !snapHeard && t >= script.presnap) {
      snapHeard = true;
      stadiumReact("snap");
    }
    const [bwx, bwy] = sampleTrack(script.ball.track, script.step, t);
    let ballZ = 0;
    if (flightArc && t >= flightArc.rel && t < flightArc.end) {
      ballZ = Math.sin((t - flightArc.rel) / (flightArc.end - flightArc.rel) * Math.PI) * flightArc.loft;
    }
    const [bx, by] = projectPoint(bwx, bwy, ["coach", "endzone"].includes(cameraMode) ? ballZ : 0);
    if (ballGroundN) {
      const [groundX, groundY] = projectPoint(bwx, bwy, 0);
      const projectionFlight = ["coach", "endzone"].includes(cameraMode) && ballZ > 0.08;
      ballGroundN.setAttribute("transform", `translate(${groundX.toFixed(2)},${groundY.toFixed(2)}) scale(${Math.max(0.52, 1 - ballZ * 0.045).toFixed(3)})`);
      ballGroundN.style.opacity = projectionFlight ? String(Math.max(0.14, 0.46 - ballZ * 0.035)) : "0";
      ballGroundN.classList.toggle("on", projectionFlight);
    }
    // M21: the ball's rendered position is finalized AFTER the actor pass —
    // possession phases attach it to the owner's hands (see the ball block
    // below). The track still owns every outcome-bearing location.
    let cx = null, cy = null, cd = 1e9, carrierId = null;
    const possessionTeam = turnoverFx && t >= turnoverFx.t + (turnoverFx.kind === "fum" ? 0.32 : 0) ? "def" : "off";
    const playOn = t >= script.presnap;
    const pocketEnd = script.throwCue ? script.throwCue.release + 0.08 : tackleCue && tackleCue.sack ? tackleCue.impact + 0.08 : script.presnap;
    const pocketOn = rushCues.length > 0 && playOn && t <= pocketEnd;
    svg.classList.toggle("watch-presnap", !playOn);
    svg.classList.toggle("watch-snap-release", playOn && t < script.presnap + 0.18);
    svg.classList.toggle("watch-in-play", playOn);
    svg.classList.toggle("watch-pass-pocket", pocketOn);
    svg.classList.toggle("watch-route-live", routeCues.length > 0 && playOn && (catchT == null || t <= catchT + 0.08));
    svg.classList.toggle("watch-qb-mechanics", !!qbCue && t >= qbCue.start && t <= qbCue.followEnd);
    // D4/M2: the pre-snap play-art overlay — full through the cadence, a
    // short fade through the snap so the eye can carry the design onto the
    // moving bodies. Re-projected only when the camera changes.
    if (playartN && playArtPlan) {
      const ART_FADE = 0.4;
      if (t >= script.presnap + ART_FADE) {
        if (playartN.childNodes.length) { playartN.innerHTML = ""; playartN.dataset.cam = ""; }
      } else {
        if (playartN.dataset.cam !== cameraMode || !playartN.childNodes.length) {
          playartN.dataset.cam = cameraMode;
          playartN.innerHTML = watchPlayArtMarkup(playArtPlan, projectPoint);
        }
        playartN.style.opacity = t < script.presnap ? "1" : Math.max(0, 1 - (t - script.presnap) / ART_FADE).toFixed(2);
      }
    }
    const actorPts = {};
    const actorDepth = [];
    // M20 engagement facing: contact sections below register face locks here;
    // anything not re-registered this frame is released after the sections run.
    const faceLocks = /* @__PURE__ */ new Set();
    for (const a of script.actors) {
      const [wx, wy] = sampleTrack(a.track, script.step, t);
      const [x, y] = projectPoint(wx, wy);
      actorPts[a.id] = [x, y];
      const node = nodes[a.id];
      if (node) {
        const scale = watchCameraScale(cameraMode, wx, wy);
        node.setAttribute("transform", `translate(${x.toFixed(2)},${y.toFixed(2)}) scale(${scale.toFixed(3)})`);
        actorDepth.push({ node, depth: watchCameraDepth(cameraMode, wx, wy) });
        if (sprites) spriteMotionTick(node, x, y);
      }
      if (a.team === possessionTeam) {
        const dd = Math.hypot(x - bx, y - by);
        if (dd < cd) {
          cd = dd;
          cx = x;
          cy = y;
          carrierId = a.id;
        }
      }
    }
    if (actorLayer && actorDepth.length) {
      actorDepth.sort((a, b) => a.depth - b.depth || String(a.node.dataset.wpa).localeCompare(String(b.node.dataset.wpa)));
      for (const row of actorDepth) actorLayer.appendChild(row.node);
    }
    watchApplyLabelPlan(cameraMode, script.actors, actorPts, nodes, [
      "QB", p.targetSlotId, p.carrierSlotId, script.pickId, script.covId,
      tackleCue && tackleCue.id, tackleCue && tackleCue.assistId
    ]);
    Object.values(nodes).forEach((node) => node.classList.remove("wp-near-ball", "wp-ball-watch", "wp-blocking", "wp-blocked", ...repCls, ...contactCls, ...passSetCls, ...downfieldCls, ...qbMechanicCls, ...tackleSetupCls, ...secondaryCls, ...carryArmCls));
    // Viewer Act 2 / A3: reuse the locomotion controller's already-computed
    // speed/acceleration instead of resampling 22 tracks. The only extra
    // geometry is one nearest-pursuer lookup for the active carrier.
    const a3CarrierId = script.carryCue && t >= script.carryCue.from ? script.carryCue.id : null;
    let a3Pursuit = null;
    if (a3CarrierId && actorPts[a3CarrierId]) {
      const cp = actorPts[a3CarrierId];
      for (const a of script.actors) {
        if (a.team !== "def" || !actorPts[a.id]) continue;
        const pt = actorPts[a.id], distance = Math.hypot(pt[0] - cp[0], pt[1] - cp[1]);
        if (!a3Pursuit || distance < a3Pursuit.distance) a3Pursuit = { dx: pt[0] - cp[0], distance };
      }
    }
    for (const a of script.actors) {
      const node = nodes[a.id], motion = node && node._wsm;
      if (!node || !motion || !playOn) continue;
      const a3 = selectSecondaryMotion({
        speed: Math.hypot(motion.vx, motion.vy),
        accel: motion.accel,
        lateralSpeed: motion.vx,
        locomotion: motion.loco,
        carrier: a.id === a3CarrierId,
        pursuitDx: a.id === a3CarrierId && a3Pursuit ? a3Pursuit.dx : 0,
        pursuitDistance: a.id === a3CarrierId && a3Pursuit ? a3Pursuit.distance : Infinity
      });
      node.classList.toggle("wp-a3-weight", a3.weighted);
      node.classList.toggle("wp-a3-gather", a3.gather);
      node.classList.toggle("wp-a3-sprint", a3.sprint);
      node.classList.toggle("wp-a3-head-left", a3.headSide === "left");
      node.classList.toggle("wp-a3-head-right", a3.headSide === "right");
      node.style.setProperty("--a3-shadow-scale", a3.shadowScale);
      node.style.setProperty("--a3-shadow-opacity", a3.shadowOpacity);
      node.style.setProperty("--a3-shadow-skew", a3.shadowSkew + "deg");
    }
    const carryCueNow = script.carryCue || null;
    if (carryCueNow && t >= carryCueNow.from && nodes[carryCueNow.id]) {
      const armState = carryArmState(carryCueNow, t);
      nodes[carryCueNow.id].classList.add("wp-carry-arm-" + armState.arm);
      if (armState.switching) nodes[carryCueNow.id].classList.add("wp-arm-switching");
    }
    if (pocketOn) (_a2 = nodes.QB) == null ? void 0 : _a2.classList.add("wp-pocket-qb");
    if (t > script.presnap && cd < 4.4 && carrierId) (_a2 = nodes[carrierId]) == null ? void 0 : _a2.classList.add("wp-near-ball");
    const throwCue = script.throwCue;
    const throwOn = !!throwCue && t >= throwCue.start && t <= throwCue.end;
    const pumpOn = !!pumpCue && t >= pumpCue.start && t <= pumpCue.end;
    (_b2 = nodes.QB) == null ? void 0 : _b2.classList.toggle("wp-throwing", throwOn || pumpOn);
    (_c2 = nodes.QB) == null ? void 0 : _c2.classList.toggle("wp-pressed", !!pressCue && !throwOn && t >= pressCue.start && t <= pressCue.end);
    if (qbCue && t >= qbCue.start && t <= qbCue.followEnd) {
      const qbNode = nodes.QB;
      if (qbNode) {
        qbNode.classList.add("wp-qb-mechanics", "wp-qb-" + qbCue.family);
        if (qbCue.rollout) qbNode.classList.add("wp-qb-rollout", "wp-qb-rollout-" + qbCue.rolloutDirection);
        if (qbCue.escape) qbNode.classList.add("wp-qb-escape");
        if (qbCue.playActionCarry) qbNode.classList.add("wp-qb-pa-carry");
        if (qbCue.throwStyle) qbNode.classList.add("wp-qb-throw-" + qbCue.throwStyle);
        if (t <= qbCue.secureEnd) qbNode.classList.add("wp-qb-snap");
        else if (qbCue.family === "playaction" && t < qbCue.meshEnd) qbNode.classList.add("wp-qb-mesh");
        else if (t < qbCue.setStart) qbNode.classList.add("wp-qb-drop");
        else if (t < qbCue.releaseStart) qbNode.classList.add(qbCue.hurried ? "wp-qb-reset" : "wp-qb-hitch");
        else if (t < qbCue.release) qbNode.classList.add("wp-qb-load");
        else qbNode.classList.add("wp-qb-follow");
      }
    }
    ballN == null ? void 0 : ballN.classList.toggle("wp-ball-air", !!throwCue && catchT != null && t >= throwCue.release && t < catchT);
    ballN == null ? void 0 : ballN.classList.toggle("wp-ball-loose", !!looseFx && t >= looseFx.t && t <= looseFx.t + 0.38);
    if (liftN) {
      if (["coach", "endzone"].includes(cameraMode)) {
        if (liftN.style.transform) liftN.style.transform = "";
      } else if (flightArc && t >= flightArc.rel && t < flightArc.end) {
        const u2 = (t - flightArc.rel) / (flightArc.end - flightArc.rel);
        liftN.style.transform = `translateY(${(-Math.sin(u2 * Math.PI) * flightArc.loft).toFixed(2)}px)`;
      } else if (liftN.style.transform) liftN.style.transform = "";
    }
    for (const rc of routeCues) {
      if (t < rc.start || t > rc.end) continue;
      const routeNode = nodes[rc.id];
      if (!routeNode) continue;
      routeNode.classList.add("wp-route-active", "wp-route-" + rc.family, "wp-route-" + rc.direction);
      if (rc.target) routeNode.classList.add("wp-route-target");
      if (t <= rc.releaseEnd) routeNode.classList.add("wp-route-release");
      else if (rc.handsStart != null && t >= rc.handsStart) routeNode.classList.add("wp-route-hands");
      else if (rc.family !== "vertical" && t >= rc.breakStart && t <= rc.breakEnd) routeNode.classList.add("wp-route-break");
      else routeNode.classList.add("wp-route-stem");
    }
    for (const cc of coverageCues) {
      if (t < cc.start || t > cc.end) continue;
      const coverNode = nodes[cc.id];
      if (!coverNode) continue;
      coverNode.classList.add("wp-cov-active", cc.zone ? "wp-cov-zone" : "wp-cov-man");
      if (cc.target) coverNode.classList.add("wp-cov-target");
      if (cc.press && t <= cc.start + 0.42) coverNode.classList.add("wp-cov-press");
      else if (t < cc.pedalEnd) coverNode.classList.add("wp-cov-pedal");
      else if (t <= cc.turnEnd) coverNode.classList.add("wp-cov-turn");
      else coverNode.classList.add("wp-cov-trail");
      const receiverPt = cc.receiverId ? actorPts[cc.receiverId] : null;
      const coverPt = actorPts[cc.id];
      if (receiverPt && coverPt) coverNode.classList.add(coverPt[0] < receiverPt[0] ? "wp-cov-left" : "wp-cov-right");
    }
    if (catchCue) {
      const on = t >= catchCue.start && t <= catchCue.end;
      const cnode = nodes[catchCue.id];
      if (cnode) {
        cnode.classList.toggle("wp-catching", on);
        for (const cls of catchCue.classes) cnode.classList.toggle(cls, on);
        cnode.classList.toggle("wp-catchpoint", on);
        cnode.classList.toggle("wp-catchpoint-receiver", on);
        cnode.classList.toggle("wp-catchpoint-secure", on && !catchCue.breakup);
        cnode.classList.toggle("wp-catchpoint-breakup", on && catchCue.breakup);
        if (on) cnode.classList.remove("wp-near-ball");
      }
      if (catchCue.contestId) {
        const contestNode = nodes[catchCue.contestId];
        if (contestNode) {
          contestNode.classList.toggle("wp-contesting", on);
          contestNode.classList.toggle("wp-breakup", on && catchCue.breakup);
          contestNode.classList.toggle("wp-catchpoint", on);
          contestNode.classList.toggle("wp-catchpoint-defender", on);
          contestNode.classList.toggle("wp-catchpoint-breakup", on && catchCue.breakup);
          contestNode.classList.toggle("wp-catchpoint-secure", on && !catchCue.breakup);
        }
      }
    }
    if (moveCue) {
      const on = t >= moveCue.start && t <= moveCue.end;
      const mnode = nodes[moveCue.id];
      if (mnode) {
        mnode.classList.toggle("wp-moving", on);
        mnode.classList.toggle(moveCue.cls, on);
        mnode.classList.toggle("wp-mv-boundary-left", on && moveCue.direction === "left");
        mnode.classList.toggle("wp-mv-boundary-right", on && moveCue.direction === "right");
        mnode.classList.toggle("wp-mv-plant", (moveCue.style === "juke" || moveCue.style === "spin") && t >= moveCue.plantStart && t <= moveCue.plantEnd);
        mnode.classList.toggle("wp-mv-power", (moveCue.style === "truck" || moveCue.style === "stiff" || moveCue.style === "hurdle") && on);
      }
    }
    if (tackleCue) {
      const tacklerPt = actorPts[tackleCue.id];
      const carrierPt = actorPts[tackleCue.carrierId];
      const fromLeft = !!tacklerPt && !!carrierPt && tacklerPt[0] < carrierPt[0];
      // M20: the hit is gated on real proximity — impact classes fire when the
      // two sprites actually meet (time failsafe keeps a bad track from
      // freezing the finish), never on schedule alone.
      const met = !!tacklerPt && !!carrierPt && Math.hypot(tacklerPt[0] - carrierPt[0], tacklerPt[1] - carrierPt[1]) < 3.1 || t >= tackleCue.impact + 0.3;
      const on = t >= tackleCue.start && t <= tackleCue.end;
      const finish = t > tackleCue.end && t <= tackleCue.finish;
      const arrival = met && t >= tackleCue.impact - 0.1 && t <= tackleCue.impact + 0.16;
      const carrierHit = met && t >= tackleCue.impact - 0.04 && t <= tackleCue.finish;
      // M20 grounded finish: tackled players stay down through a real hold,
      // then take a get-up beat — nobody blinks back upright.
      const downEnd = Math.min(tackleCue.finish, tackleCue.impact + 1.05);
      const carrierDown = met && t >= tackleCue.impact + 0.18 && t <= downEnd;
      const getUp = t > downEnd && t <= downEnd + 0.4 && downEnd < tackleCue.finish - 0.05;
      const groundFinish = ["wrap", "collision", "big-hit", "drag", "drag-down", "gang", "shoestring"].includes(tackleCue.style);
      const tacklerGrounded = met && !tackleCue.sack && groundFinish && t >= tackleCue.impact + 0.22 && t <= downEnd;
      const pursuit = t >= tackleCue.approachStart && t < tackleCue.breakdownStart;
      const breakdown = t >= tackleCue.breakdownStart && t < tackleCue.start;
      const brace = t >= tackleCue.braceStart && t < tackleCue.impact;
      const tnode = nodes[tackleCue.id];
      if (tnode) {
        tnode.classList.toggle("wp-tk-pursuit", pursuit);
        tnode.classList.toggle("wp-tk-breakdown", breakdown);
        tnode.classList.toggle("wp-tk-leverage-left", (pursuit || breakdown) && fromLeft);
        tnode.classList.toggle("wp-tk-leverage-right", (pursuit || breakdown) && !fromLeft);
        tnode.classList.toggle("wp-tackling", on);
        tnode.classList.toggle(tackleCue.cls, on || finish);
        tnode.classList.toggle("wp-tk-assisted", tackleCue.joinCues.length > 0 && (on || finish));
        tnode.classList.toggle("wp-tackle-finish", finish);
        tnode.classList.toggle("wp-contact-arrival", arrival);
        tnode.classList.toggle("wp-contact-hitter", arrival);
        tnode.classList.toggle("wp-contact-from-left", arrival && fromLeft);
        tnode.classList.toggle("wp-contact-from-right", arrival && !fromLeft);
        tnode.classList.toggle("wp-grounded", tacklerGrounded);
        tnode.classList.toggle("wp-getup", getUp && groundFinish);
        if (on && carrierPt && tacklerPt) {
          tnode._faceLock = carrierPt[0] >= tacklerPt[0] ? "e" : "w";
          faceLocks.add(tackleCue.id);
        }
      }
      for (let joinIndex = 0; joinIndex < tackleCue.joinCues.length; joinIndex++) {
        const joinCue = tackleCue.joinCues[joinIndex];
        const anode = nodes[joinCue.id];
        if (anode) {
          const joinApproach = t >= tackleCue.assistStart + joinIndex * 0.1 && t < joinCue.t;
          const joinOn = t >= joinCue.t - 0.12 && t <= tackleCue.end + 0.2;
          const joinFinish = t > tackleCue.end + 0.2 && t <= tackleCue.finish;
          const joinArrival = t >= joinCue.t - 0.06 && t <= joinCue.t + 0.14;
          anode.classList.toggle("wp-tk-assist-lane", joinApproach);
          anode.classList.toggle("wp-tk-leverage-left", joinApproach && fromLeft);
          anode.classList.toggle("wp-tk-leverage-right", joinApproach && !fromLeft);
          anode.classList.toggle("wp-tackling", joinOn);
          anode.classList.toggle("wp-tk-gang", joinOn || joinFinish);
          anode.classList.toggle("wp-tk-assist", joinOn || joinFinish);
          anode.classList.toggle("wp-tackle-finish", joinFinish);
          anode.classList.toggle("wp-contact-arrival", joinArrival);
          anode.classList.toggle("wp-contact-hitter", joinArrival);
        }
      }
      const vnode = nodes[tackleCue.carrierId];
      if (vnode) {
        vnode.classList.toggle("wp-carrier-brace", brace);
        vnode.classList.toggle("wp-carrier-secure", brace);
        vnode.classList.toggle("wp-carrier-brace-left", brace && fromLeft);
        vnode.classList.toggle("wp-carrier-brace-right", brace && !fromLeft);
        vnode.classList.toggle("wp-hit-" + tackleCue.style, carrierHit);
        vnode.classList.toggle("wp-contact-arrival", arrival);
        vnode.classList.toggle("wp-contact-carrier", arrival);
        vnode.classList.toggle("wp-contact-from-left", arrival && fromLeft);
        vnode.classList.toggle("wp-contact-from-right", arrival && !fromLeft);
        if (tackleCue.sack) vnode.classList.toggle("wp-sacked", carrierHit);
        else {
          vnode.classList.toggle("wp-tackled", carrierHit);
          if (carrierHit) vnode.classList.remove("wp-near-ball");
        }
        vnode.classList.toggle("wp-down", carrierDown);
        vnode.classList.toggle("wp-getup", getUp);
        if (on && carrierPt && tacklerPt) {
          vnode._faceLock = tacklerPt[0] >= carrierPt[0] ? "e" : "w";
          faceLocks.add(tackleCue.carrierId);
        }
      }
      if (on && !impactShown) {
        impactShown = true;
        svg.classList.add("watch-impact");
        setTimeout(() => svg.classList.remove("watch-impact"), 420);
      }
    }
    for (const rc of rushCues) {
      const on = t >= rc.t && t <= rc.t + 0.6;
      const rn = nodes[rc.id];
      const family = rc.family || (rc.move === "bend" || rc.move === "rip" ? "edge" : rc.move === "bull" ? "power" : "counter");
      const protectionOn = t >= script.presnap + 0.04 && t <= pocketEnd;
      const lost = protectionOn && !!rc.win && t >= rc.t;
      if (rn) {
        rn.classList.toggle("wp-rushing", on);
        rn.classList.toggle("wp-rush-" + rc.move, on);
        rn.classList.toggle("wp-rush-win", !!rc.win && on);
        if (protectionOn) rn.classList.add("wp-pass-engaged", "wp-pass-" + family);
        if (protectionOn && rc.rusherStyle) rn.classList.add("wp-trench-rusher-" + rc.rusherStyle);
        if (lost) rn.classList.add("wp-pass-won");
      }
      if (rc.blockerId && protectionOn) {
        const blocker = nodes[rc.blockerId];
        if (blocker) {
          blocker.classList.add("wp-pass-set", "wp-pass-" + family);
          if (rc.blockerStyle) blocker.classList.add("wp-trench-" + rc.blockerStyle);
          blocker.classList.add(lost ? "wp-pass-lost" : "wp-pass-anchor");
        }
      }
      if (rc.win && rc.blockerId) {
        const shedOn = t >= rc.t && t <= rc.t + 0.7;
        const blocker = nodes[rc.blockerId];
        if (blocker) {
          blocker.classList.toggle("wp-shed", shedOn);
          blocker.classList.toggle("wp-shed-" + rc.move, shedOn);
        }
      }
    }
    for (const jc of jamCues) (_e2 = nodes[jc.id]) == null ? void 0 : _e2.classList.toggle("wp-blocking", t >= jc.start && t <= jc.end);
    if (beatenCue) (_f = nodes[beatenCue.id]) == null ? void 0 : _f.classList.toggle("wp-stumbled", t >= beatenCue.start && t <= beatenCue.end);
    if (celebrateCue) {
      const on = t >= celebrateCue.start && t <= celebrateCue.end;
      const cn2 = nodes[celebrateCue.id];
      if (cn2) {
        cn2.classList.toggle("wp-celebrating", on);
        cn2.classList.toggle("wp-celeb-" + celebrateCue.style, on);
      }
      // M24: the nearest teammates join the moment (class only — tracks
      // untouched).
      for (const mid of celebrateCue.mobIds) (_g = nodes[mid]) == null ? void 0 : _g.classList.toggle("wp-celeb-mob", on);
    }
    // M24: exhaustion — long plays leave the principals bent over through
    // the linger (timed after the grounded/get-up window).
    if (script.windedCue) for (const wid of script.windedCue.ids) {
      (_g = nodes[wid]) == null ? void 0 : _g.classList.toggle("wp-winded", t >= script.windedCue.t);
    }
    for (const mc of script.missCues || []) {
      const on = t >= mc.t && t <= mc.t + 0.35;
      const n2 = nodes[mc.id];
      if (n2) {
        n2.classList.toggle("wp-tackling", on);
        n2.classList.toggle("wp-tk-wrap", on);
      }
    }
    // M20: the sim-credited broken tackle — defender attempts at the staged
    // collision, whiffs, hits the ground and takes a get-up beat; the carrier
    // wears the break (his juke/truck move cue fires at this same moment).
    if (script.breakCue) {
      const bc = script.breakCue;
      const n2 = nodes[bc.id];
      if (n2) {
        n2.classList.toggle("wp-tackling", t >= bc.t - 0.18 && t <= bc.t + 0.12);
        n2.classList.toggle("wp-tk-" + (bc.style === "truck" ? "collision" : "wrap"), t >= bc.t - 0.18 && t <= bc.t + 0.12);
        n2.classList.toggle("wp-tk-miss", t >= bc.t && t <= bc.t + 0.5);
        n2.classList.toggle("wp-grounded", t >= bc.t + 0.14 && t <= bc.t + 1);
        n2.classList.toggle("wp-getup", t > bc.t + 1 && t <= bc.t + 1.4);
      }
      const cn2 = nodes[bc.carrierId];
      if (cn2) cn2.classList.toggle("wp-broke-tackle", t >= bc.t && t <= bc.t + 0.5);
    }
    // M20: the credited strip man swipes at the ball just before it comes out.
    if (script.stripCue) {
      const sc = script.stripCue;
      const n2 = nodes[sc.id];
      if (n2) {
        n2.classList.toggle("wp-tackling", t >= sc.t - 0.12 && t <= sc.t + 0.3);
        n2.classList.toggle("wp-tk-strip", t >= sc.t - 0.12 && t <= sc.t + 0.45);
      }
    }
    if (script.culpritCue) (_h = nodes[script.culpritCue.id]) == null ? void 0 : _h.classList.toggle("wp-dejected", t >= script.culpritCue.t);
    if (script.injuryCue) {
      const on = t >= script.injuryCue.t;
      const qn = nodes.QB;
      if (qn) {
        qn.classList.toggle("wp-injured", on);
        if (on) {
          qn.classList.remove("wp-tackled", "wp-sacked");
        }
      }
    }
    (script.blocks || []).forEach((b, i) => {
      var _a3, _b3, _c3, _d3;
      const line = blockNodes[i], engage = engageNodes[i], op = actorPts[b.offId], dp = actorPts[b.defId];
      const active = t >= b.start && t <= b.end && op && dp;
      if (line) line.style.display = active ? "" : "none";
      if (line) line.classList.remove("wp-block-link-tight", "wp-block-link-space");
      if (engage) {
        engage.style.display = "none";
        engage.setAttribute("class", "wp-engage");
      }
      if (!active) return;
      const dur = Math.max(0.18, b.end - b.start);
      const age = t - b.start;
      const u = Math.max(0, Math.min(1, age / dur));
      const phase = age < Math.min(0.2, dur * 0.3) ? "strike" : u < 0.72 ? "drive" : "strain";
      const padD = Math.hypot(dp[0] - op[0], dp[1] - op[1]);
      const spacing = padD < 4.8 ? "tight" : "space";
      const offNode = nodes[b.offId], defNode = nodes[b.defId];
      offNode == null ? void 0 : offNode.classList.add("wp-blocking", "wp-contact-off", "wp-contact-" + phase, "wp-contact-" + spacing);
      defNode == null ? void 0 : defNode.classList.add("wp-blocked", "wp-contact-def", "wp-contact-" + phase, "wp-contact-" + spacing);
      // M20 engagement facing: while fitted, blocker and defender face each
      // other regardless of drift velocity — hands land on pads, not on air.
      if (padD < 5.2) {
        if (offNode) {
          offNode._faceLock = dp[0] >= op[0] ? "e" : "w";
          faceLocks.add(b.offId);
        }
        if (defNode) {
          defNode._faceLock = op[0] >= dp[0] ? "e" : "w";
          faceLocks.add(b.defId);
        }
      }
      if (b.rep) {
        (_c3 = nodes[b.offId]) == null ? void 0 : _c3.classList.add("wp-rep-" + b.rep);
        (_d3 = nodes[b.defId]) == null ? void 0 : _d3.classList.add("wp-rep-" + b.rep);
      }
      line.setAttribute("x1", op[0].toFixed(2));
      line.setAttribute("y1", op[1].toFixed(2));
      line.setAttribute("x2", dp[0].toFixed(2));
      line.setAttribute("y2", dp[1].toFixed(2));
      line.classList.add("wp-block-link-" + spacing);
      if (engage && padD < 7.2) {
        const mx = (op[0] + dp[0]) / 2, my = (op[1] + dp[1]) / 2;
        const ang = Math.atan2(dp[1] - op[1], dp[0] - op[0]) * 180 / Math.PI;
        engage.style.display = "";
        engage.classList.add("wp-engage-" + phase, "wp-engage-" + spacing);
        if (b.rep) engage.classList.add("wp-engage-rep-" + b.rep);
        engage.setAttribute("transform", `translate(${mx.toFixed(2)},${my.toFixed(2)}) rotate(${ang.toFixed(1)})`);
      }
    });
    // Release face locks that no contact section re-registered this frame.
    for (const id in nodes) {
      const n2 = nodes[id];
      if (n2 && n2._faceLock && !faceLocks.has(id)) n2._faceLock = null;
    }
    // ── M21 ball ownership & flight (render-only; the track owns outcomes) ──
    {
      const bc = script.ballCue || null, cc = script.carryCue || null, dc = script.deflectCue || null;
      const inAir = !!throwCue && catchT != null && t >= throwCue.release && t < catchT;
      const deflectOn = !!dc && t >= dc.t;
      const looseOn = !!looseFx && t >= looseFx.t;
      const snapOn = !!bc && bc.snapStart != null && t >= bc.snapStart && t < bc.snapEnd;
      const meshOn = !!bc && bc.meshStart != null && t >= bc.meshStart && t < bc.meshEnd;
      const paFakeOn = !!bc && bc.fakeStart != null && t >= bc.fakeStart && t < bc.fakeEnd;
      // The credited PBU man swats at the arrival (reuses the M20 strip pose).
      if (dc) {
        const dn = nodes[dc.id];
        if (dn) {
          dn.classList.toggle("wp-tackling", t >= dc.t - 0.12 && t <= dc.t + 0.3);
          dn.classList.toggle("wp-tk-strip", t >= dc.t - 0.12 && t <= dc.t + 0.45);
        }
      }
      let rbx = bx, rby = by;
      let attach = null;
      let carriedOn = false;
      if (!inAir && !looseOn && !deflectOn && !snapOn && !meshOn && playOn) {
        if (cc && t >= cc.from && nodes[cc.id]) {
          const cnode = nodes[cc.id];
          const face = cnode._wsm ? cnode._wsm.face : "e";
          const isDown = cnode.classList.contains("wp-down") || tackleCue && !tackleCue.sack && cc.id === tackleCue.carrierId && t > tackleCue.impact + 0.18;
          const armState = carryArmState(cc, t);
          const armOx = (arm) => face === "e" ? arm === "right" ? 0.54 : -0.14 : face === "w" ? arm === "right" ? -0.54 : 0.14 : arm === "right" ? 0.5 : -0.5;
          const fromX = armOx(armState.from), toX = armOx(armState.to);
          const blend = armState.switching ? armState.u * armState.u * (3 - 2 * armState.u) : armState.u >= 1 ? 1 : 0;
          let ox = fromX + (toX - fromX) * blend;
          let oy = -2.15;
          if (isDown) {
            ox *= 1.5;
            oy = -0.55;
          }
          attach = [cc.id, ox, oy];
          carriedOn = true;
        } else if (!paFakeOn && bc && bc.holdEnd != null && t >= bc.snapEnd && t < bc.holdEnd && nodes.QB) {
          // QB hold: two-hand chest carriage; the windup lifts the ball to
          // the throwing shoulder so the release leaves from the hand.
          const qm = nodes.QB._wsm;
          const fs = qm && qm.face === "w" ? -1 : 1;
          const load = nodes.QB.classList.contains("wp-qb-load");
          attach = ["QB", load ? -fs * 0.55 : fs * 0.42, load ? -3.1 : -2.3];
        }
      }
      if (attach) {
        const ap = actorPts[attach[0]];
        if (ap) {
          const handScale = watchCameraScale(cameraMode, 50, 31);
          const tx = ap[0] + attach[1] * handScale, ty = ap[1] + attach[2] * handScale;
          // Proximity guard: attachment snaps feet→hands, it never yanks the
          // ball across the screen — weird phases stay track-driven.
          if (Math.hypot(tx - bx, ty - by) < 3.4) {
            rbx = tx;
            rby = ty;
          } else carriedOn = false;
        } else carriedOn = false;
      }
      // Hand blending on pass flights: leave the QB's hand, land in the
      // catcher's hands — no pop at either end of the arc.
      if (inAir) {
        const u2 = (t - throwCue.release) / Math.max(0.001, catchT - throwCue.release);
        if (u2 < 0.14 && actorPts.QB && nodes.QB) {
          const w = 1 - u2 / 0.14;
          const qm = nodes.QB._wsm;
          const fs = qm && qm.face === "w" ? -1 : 1;
          const handScale = watchCameraScale(cameraMode, 50, 31);
          rbx += (actorPts.QB[0] + fs * 0.6 * handScale - rbx) * w;
          rby += (actorPts.QB[1] - 3.05 * handScale - rby) * w;
        } else if (u2 > 0.85 && catchCue && actorPts[catchCue.id] && nodes[catchCue.id]) {
          const w = (u2 - 0.85) / 0.15;
          const cm = nodes[catchCue.id]._wsm;
          const fs = cm && cm.face === "w" ? -1 : 1;
          const handScale = watchCameraScale(cameraMode, 50, 31);
          rbx += (actorPts[catchCue.id][0] + fs * 0.45 * handScale - rbx) * w;
          rby += (actorPts[catchCue.id][1] - 2.35 * handScale - rby) * w;
        }
      }
      // Orientation: nose along the rendered motion (lift included) while in
      // the air — nose-up on the climb, nose-over on the descent.
      let liftY = 0;
      if (!["coach", "endzone"].includes(cameraMode) && flightArc && t >= flightArc.rel && t < flightArc.end) {
        const u3 = (t - flightArc.rel) / (flightArc.end - flightArc.rel);
        liftY = -Math.sin(u3 * Math.PI) * flightArc.loft;
      }
      if (aimN) {
        if (inAir) {
          if (prevBallR) {
            const dxA = rbx - prevBallR[0], dyA = rby + liftY - prevBallR[1];
            if (Math.hypot(dxA, dyA) > 0.12) ballAng = Math.atan2(dyA, dxA) * 180 / Math.PI;
          }
          aimN.setAttribute("transform", `rotate(${ballAng.toFixed(1)})`);
        } else if (aimN.hasAttribute("transform")) aimN.removeAttribute("transform");
      }
      prevBallR = [rbx, rby + liftY];
      ballN == null ? void 0 : ballN.classList.toggle("wp-ball-snap", snapOn);
      ballN == null ? void 0 : ballN.classList.toggle("wp-ball-carried", carriedOn);
      ballN == null ? void 0 : ballN.classList.toggle("wp-ball-tipped", deflectOn && t <= dc.t + 0.62);
      ballN == null ? void 0 : ballN.setAttribute("transform", `translate(${rbx.toFixed(2)},${rby.toFixed(2)})`);
      if (ballN) {
        ballN.dataset.worldZ = ballZ.toFixed(3);
        ballN.style.setProperty("--watch-ball-z", Math.min(1, ballZ / 5.2).toFixed(3));
        ballN.dataset.possess = carriedOn ? cc.id : attach ? attach[0] : "";
        ballN.dataset.arm = carriedOn && cc ? carryArmState(cc, t).arm : "";
      }
      // M24: heads to the ball — defenders near the catch point take an
      // eyes-up lean while the pass is in the air (cleared by the sweep).
      if (inAir && catchCue && actorPts[catchCue.id]) {
        const cp2 = actorPts[catchCue.id];
        for (const a of script.actors) {
          if (a.team !== "def") continue;
          const n3 = nodes[a.id], pt3 = actorPts[a.id];
          if (n3 && pt3 && Math.hypot(pt3[0] - cp2[0], pt3[1] - cp2[1]) < 16) n3.classList.add("wp-ball-watch");
        }
      }
    }
    // M23: place the crew from the plan and fire the result signals.
    if (officialNodes.length) {
      const pos = offPlan.at(t);
      officialNodes.forEach((n2, i) => {
        if (!pos[i]) return;
        const [sx2, sy2] = projectPoint(pos[i][0], pos[i][1]);
        n2.setAttribute("transform", `translate(${sx2.toFixed(2)},${sy2.toFixed(2)})`);
      });
      for (const sg of offPlan.signals) {
        const on = t >= sg.t && t <= sg.t + 1.5;
        const who = sg.kind === "fd" ? "LJ" : "R";
        const n2 = officialNodes.find((o) => o.dataset.wpo === who);
        if (n2) n2.classList.toggle("wpo-sig-" + sg.kind, on);
      }
    }
    if (spotN) {
      if (t > script.presnap && cx != null && cd < 3) {
        spotN.setAttribute("transform", `translate(${cx.toFixed(2)},${cy.toFixed(2)})`);
        spotN.style.opacity = "1";
      } else spotN.style.opacity = "0";
    }
    // M22 anticipatory camera: the plan (built from the script's own cues)
    // supplies a LEADING anchor and a contextual zoom target; the M20 slew
    // integrator below still owns smoothness, so framing can never whip.
    // The anchor is pinned pre-snap — the motionless-snap law holds by
    // construction.
    const [awx, awy] = camPlan.anchorAt(t);
    let focusX = projectPoint(awx, awy)[0];
    let hTarget = camPlan.hAt(t, !!opts.replay);
    // Act B replay camera law: once a frame has been rendered, the replay
    // camera reads the ball's rendered transform. It never jumps ahead by
    // peeking back into script.ball.track while the user scrubs.
    if (playback.interactive && ballN) {
      const m = String(ballN.getAttribute("transform") || "").match(/translate\(([-\d.]+)[ ,]([-\d.]+)\)/);
      if (m) focusX = Number(m[1]);
    }
    // M20 slew-limited camera: velocity eases toward the pull with a hard
    // acceleration cap, and a deadzone keeps micro-jitter out of the framing.
    // Pre-snap the targets are static, so the camera is motionless at the snap.
    // M22: pan velocity is halved inside the turnover settle window — the
    // possession flip becomes a controlled cut, not a whip.
    if (playback.interactive && ["coach", "endzone"].includes(cameraMode)) {
      camH = WATCH_SIDE.viewH;
      camW = WATCH_SIDE.viewW;
      camY = 0;
      camX = 0;
      camVX = 0;
      camVH = 0;
    } else if (playback.interactive && cameraMode === "all22") {
      camH = WATCH_SIDE.viewH;
      camW = WATCH_SIDE.viewW;
      camY = 0;
      camX = watchSideCameraX(p, 31, camW);
      camVX = 0;
      camVH = 0;
    } else {
      const _settleOn = camPlan.settle && t >= camPlan.settle.start && t <= camPlan.settle.end;
      const _vmax = _settleOn ? CAM_PAN_VMAX * 0.5 : CAM_PAN_VMAX;
      const hPull = hTarget - camH;
      camVH += Math.max(-CAM_ZOOM_ACCEL, Math.min(CAM_ZOOM_ACCEL, hPull * 0.06 - camVH));
      camVH = Math.max(-CAM_ZOOM_VMAX, Math.min(CAM_ZOOM_VMAX, camVH));
      if (Math.abs(hPull) < 0.25 && Math.abs(camVH) < 0.05) camVH = 0;
      camH += camVH;
      camW = camH * CAM_ASPECT;
      camY = (WATCH_SIDE.viewH - camH) / 2;
      const tX = watchSideCameraX(p, focusX, camW);
      const xPull = tX - camX;
      camVX += Math.max(-CAM_PAN_ACCEL, Math.min(CAM_PAN_ACCEL, xPull * 0.12 - camVX));
      camVX = Math.max(-_vmax, Math.min(_vmax, camVX));
      if (Math.abs(xPull) < CAM_DEAD && Math.abs(camVX) < 0.08) camVX = 0;
      camX += camVX;
    }
    setCam();
    // M23: crowd-band parallax — the stands drift at a fraction of the pan.
    if (parN) parN.setAttribute("transform", `translate(${((camX - camX0Par) * 0.12).toFixed(2)},0)`);
    // M24 perf: crowd micro-animations pause while the camera pans hard, and
    // sustained slow frames flip the stadium to lite for the session.
    svg.classList.toggle("watch-panning", Math.abs(camVX) > 0.55);
    {
      const dtW = Math.min(300, _wallNow - _lastFrameWall);
      _lastFrameWall = _wallNow;
      _frameEma = _frameEma == null ? 16 : _frameEma * 0.94 + dtW * 0.06;
      if (_frameEma > 95) _watchLiteMode = true;
      svg.classList.toggle("watch-lite", _watchLiteMode);
    }
    if (t > script.presnap && (!lastTrail || Math.hypot(bx - lastTrail[0], by - lastTrail[1]) > 0.6)) {
      lastTrail = [bx, by];
      trail.push(`${bx.toFixed(1)},${by.toFixed(1)}`);
      trailN == null ? void 0 : trailN.setAttribute("points", trail.join(" "));
    }
    for (const f of script.fx) {
      if (t >= f.t && !shown.has(f)) {
        shown.add(f);
        if (f.kind === "beaten") (_j = (_i = nodes[f.actorId]) == null ? void 0 : _i.querySelector(".wd-x")) == null ? void 0 : _j.classList.add("wd-beaten");
        else fxN == null ? void 0 : fxN.insertAdjacentHTML("beforeend", watchFxMarkup(f, { x: camX, y: camY, w: camW, h: camH }, projectPoint));
        if (f.kind === "inc" && catchCue) (_k = nodes[catchCue.id]) == null ? void 0 : _k.classList.add("wp-dejected");
        if (!opts.replay) {
          if (f.kind === "contact" || f.kind === "block" || f.kind === "tackle") stadiumReact("contact");
          else if (f.kind === "catch") stadiumReact("catch");
          else if (f.kind === "inc") stadiumReact("incomplete");
          else if (f.kind === "flag") stadiumReact("whistle");
          // M23: the visual side of the reaction — sections erupt, banners
          // slide, the chains walk. Live only; replays never re-present.
          const _offSide = (board == null ? void 0 : board.possession) === "away" ? "away" : "home";
          const _defSide = _offSide === "home" ? "away" : "home";
          if (f.kind === "td") {
            const side = possessionTeam === "off" ? _offSide : _defSide;
            watchCrowdReact(svg, side);
            watchShowBanner("TOUCHDOWN", side === "home" ? board == null ? void 0 : board.homeName : board == null ? void 0 : board.awayName, side === "home" ? board == null ? void 0 : board.homeFill : board == null ? void 0 : board.awayFill);
          } else if (f.kind === "int" || f.kind === "fum") {
            watchCrowdReact(svg, _defSide);
            watchShowBanner(f.kind === "int" ? "INTERCEPTED!" : "FUMBLE!", `${(_defSide === "home" ? board == null ? void 0 : board.homeName : board == null ? void 0 : board.awayName) || "Defense"} ball`, _defSide === "home" ? board == null ? void 0 : board.homeFill : board == null ? void 0 : board.awayFill);
          } else if (f.kind === "fd") {
            // the chain crew and the down box WALK to the new spot
            const [gx] = watchSidePoint(f.x, f.y);
            svg.querySelectorAll(".wf-chain-gang, .wf-down-gang").forEach((g) => {
              g.classList.add("wf-gang-walk");
              g.style.transition = "transform 1.4s ease-in-out";
              g.style.transform = `translate(${gx.toFixed(1)}px, ${(WATCH_SIDE.fieldTop + WATCH_SIDE.fieldHeight + 1.6).toFixed(1)}px)`;
            });
          }
        }
      }
    }
    if (!opts.replay && !whistleHeard && t >= script.dur - 0.08) {
      whistleHeard = true;
      stadiumReact("whistle");
    }
    if (playback.interactive) {
      if (t >= script.dur) {
        playback.paused = true;
        const playBtn = document.getElementById("replay-play");
        if (playBtn) playBtn.textContent = "▶";
      }
      if (!playback.paused && _watchAnim) _watchAnim.raf = requestAnimationFrame(tick);
    } else if (t < script.dur && _watchAnim) _watchAnim.raf = requestAnimationFrame(tick);
  };
  playback.seek = (next) => {
    playback.t = Math.max(0, Math.min(script.dur, Number(next) || 0));
    _lastWall = performance.now();
    if (_watchAnim && _watchAnim.raf) cancelAnimationFrame(_watchAnim.raf);
    if (_watchAnim) _watchAnim.raf = requestAnimationFrame(tick);
  };
  _watchAnim = playback;
  _watchAnim.raf = requestAnimationFrame(tick);
  if (playback.interactive) watchWireInteractiveReplay(playback, svg, script, p, board, nodes);
  return script.dur;
}
function watchBoardKick(svg, p, board, opts = {}) {
  var _a;
  const [startX, startY] = watchSidePoint(50, 31);
  svg.setAttribute("viewBox", `${watchSideCameraX(p, startX).toFixed(2)} 0 ${WATCH_SIDE.viewW} ${WATCH_SIDE.viewH}`);
  const isFG = p.type === "fg" || p.type === "pat";
  const dist = p.type === "pat" ? 20 : isFG ? p.fgDist || 30 : p.blocked ? 4 : p.puntYds || 40;
  const worldEndY = Math.max(2.5, 31 - Math.min(dist, 33) * WATCH_SIDE.ypu);
  const worldEndX = isFG ? 50 : 50 + ((p.fieldPos || 0) % 2 ? 9 : -9);
  const [endX, endY] = watchSidePoint(worldEndX, worldEndY);
  const holdW = isFG ? [50.6, 31 + 6.4 * WATCH_SIDE.ypu] : [50, 31 + 11 * WATCH_SIDE.ypu];
  const [holdX, holdY] = watchSidePoint(holdW[0], holdW[1]);
  const [kickX0, kickY0] = watchSidePoint(holdW[0] + 2.3, holdW[1] + 2.1);
  const [retX, retY] = watchSidePoint(worldEndX, Math.max(3.2, worldEndY - 4));
  const retYds = !isFG && !p.blocked && !p.touchback && p.returnerId ? Math.max(0, p.returnYds || 0) : 0;
  const retDur = retYds > 0 ? Math.max(0.45, Math.min(3.2, retYds / 8)) : 0;
  const [retEndX, retEndY] = watchSidePoint(worldEndX, Math.min(58, worldEndY + retYds * WATCH_SIDE.ypu));
  const sprites = ((_a = state.settings) == null ? void 0 : _a.spriteWatch) !== false;
  const initialCamera = opts.interactive ? normalizeWatchCamera(opts.clip && opts.clip.camera) : "broadcast";
  svg.classList.add("watch-special-teams", isFG ? "watch-kick-place" : "watch-kick-punt");
  if (sprites) svg.classList.add("watch-sprites");
  else svg.classList.remove("watch-sprites");
  const cast = (a) => {
    const face = watchCameraFacing(initialCamera, a.team);
    return sprites ? `<g class="wp-actor wp-team-${a.team} wsp-still wsp-face-${face}" data-wpk="${a.id}" transform="translate(${a.x.toFixed(2)},${a.y.toFixed(2)})">${spriteMarkup(a, face)}</g>` : "";
  };
  const point = (wx, wy) => {
    const [x, y] = watchSidePoint(wx, wy);
    return { x, y, wx, wy };
  };
  const protectCount = isFG ? 8 : 7;
  const protectUnit = Array.from({ length: protectCount }, (_, i) => {
    const wx = isFG ? 18 + i * 64 / 7 : 23 + i * 54 / 6;
    return __spreadProps(__spreadValues({ id: `PP${i}`, team: "off", label: i < 2 || i >= protectCount - 2 ? "W" : "P" }, point(wx, 31 + 0.72 * WATCH_SIDE.ypu)), { lane: wx });
  });
  const rushCount = isFG ? 11 : 8;
  const rushUnit = Array.from({ length: rushCount }, (_, i) => {
    const wx = isFG ? 14 + i * 72 / 10 : 22 + i * 56 / 7;
    return __spreadProps(__spreadValues({ id: p.blocked && i === (isFG ? 1 : 0) ? "RS" : `KR${i}`, team: "def", label: i === 0 || i === rushCount - 1 ? "E" : "R" }, point(wx, 31 - 0.78 * WATCH_SIDE.ypu)), { lane: wx });
  });
  const gunnerUnit = isFG ? [] : [7, 93].map((wx, i) => __spreadValues({ id: `G${i + 1}`, team: "off", label: "G" }, point(wx, 31 + 0.42 * WATCH_SIDE.ypu)));
  const jammerUnit = isFG ? [] : [7, 93].map((wx, i) => __spreadValues({ id: `J${i + 1}`, team: "def", label: "J" }, point(wx, 31 - 0.82 * WATCH_SIDE.ypu)));
  const landingMarkup = !isFG && !p.blocked ? `<g id="wp-kick-landing" class="wp-kick-landing" transform="translate(${endX.toFixed(2)},${endY.toFixed(2)})"><ellipse rx="2.7" ry="1.05"/><ellipse rx="1.55" ry=".6"/><path d="M0-1.65v3.3M-1.1-.85L0-1.65l1.1.8"/></g>` : "";
  svg.innerHTML = watchFieldBase(p, board) + landingMarkup +
    protectUnit.map(cast).join("") + gunnerUnit.map(cast).join("") +
    cast({ id: "LS", team: "off", label: "LS", x: startX, y: startY }) +
    (isFG ? cast({ id: "H", team: "off", label: "H", x: holdX, y: holdY }) : "") +
    cast({ id: "K", team: "off", label: isFG ? "K" : "P", x: isFG ? kickX0 : holdX, y: isFG ? kickY0 : holdY }) +
    rushUnit.map(cast).join("") + jammerUnit.map(cast).join("") +
    (!isFG ? cast({ id: "PR", team: "def", label: "PR", x: retX, y: retY }) : "") +
    `<ellipse id="wp-ball-ground-shadow" class="wp-ball-ground-shadow" rx="1.05" ry=".36"/>` + ballMarkup(startX, startY) + `<g id="wp-st-engagements"></g><g id="wp-fx"></g>`;
  const ballN = svg.querySelector("#wp-ball"), ballGroundN = svg.querySelector("#wp-ball-ground-shadow"), ballLiftN = ballN == null ? void 0 : ballN.querySelector(".wab-lift"), fxN = svg.querySelector("#wp-fx");
  const kN = svg.querySelector('[data-wpk="K"]'), hN = svg.querySelector('[data-wpk="H"]'), prN = svg.querySelector('[data-wpk="PR"]'), lsN = svg.querySelector('[data-wpk="LS"]');
  const protectNodes = protectUnit.map(a => svg.querySelector(`[data-wpk="${a.id}"]`));
  const rushNodes = rushUnit.map(a => svg.querySelector(`[data-wpk="${a.id}"]`));
  const gunnerNodes = gunnerUnit.map(a => svg.querySelector(`[data-wpk="${a.id}"]`));
  const jammerNodes = jammerUnit.map(a => svg.querySelector(`[data-wpk="${a.id}"]`));
  const rsN = svg.querySelector('[data-wpk="RS"]'), engagementN = svg.querySelector("#wp-st-engagements"), landingN = svg.querySelector("#wp-kick-landing");
  const speed = (_watch == null ? void 0 : _watch.speed) || 1;
  const snapT = isFG ? 0.28 : 0.38;
  const placeT = snapT + (isFG ? 0.22 : 0.26);
  const swingT = placeT + (isFG ? 0.34 : 0.18);
  const flight = p.blocked ? 0.5 : 1.5;
  const landT = swingT + flight;
  const dur = landT + retDur + (retYds > 0 || p.returnTD ? 0.35 : 0);
  const actors = [
    ...protectUnit, ...gunnerUnit,
    __spreadValues({ id: "LS", team: "off", label: "LS" }, point(50, 31)),
    ...(isFG ? [__spreadValues({ id: "H", team: "off", label: "H" }, point(holdW[0], holdW[1]))] : []),
    __spreadValues({ id: "K", team: "off", label: isFG ? "K" : "P" }, point(isFG ? holdW[0] + 2.3 : holdW[0], isFG ? holdW[1] + 2.1 : holdW[1])),
    ...rushUnit, ...jammerUnit,
    ...(!isFG ? [__spreadValues({ id: "PR", team: "def", label: "PR" }, point(worldEndX, Math.max(3.2, worldEndY - 4)))] : [])
  ];
  const nodes = {};
  for (const actor of actors) {
    const node = svg.querySelector(`[data-wpk="${actor.id}"]`);
    if (!node) continue;
    nodes[actor.id] = node;
    watchSpecialPlace(node, actor.x, actor.y);
  }
  let lastWall = performance.now();
  const playback = {
    raf: 0,
    interactive: !!opts.interactive,
    paused: false,
    rate: 1,
    t: 0,
    duration: dur,
    cameraMode: initialCamera,
    director: false,
    directorPlan: buildSpecialTeamsDirectorPlan(p, { contact: swingT, landing: landT, duration: dur, returnDuration: retDur }),
    directorReason: "",
    projectionDirty: false,
    annotations: opts.clip && Array.isArray(opts.clip.annotations) ? watchClone(opts.clip.annotations) : [],
    ink: false,
    exporting: false,
    lastRenderedT: 0,
    seek: null,
    renderInk: null
  };
  const lerp = (a, b, u) => a + (b - a) * u;
  const camX = watchSideCameraX(p, startX);
  // M22: ST boards get the M20 slew-limited pan + a gentle return tighten.
  const camState = { x: camX, y: 0, w: WATCH_SIDE.viewW, h: WATCH_SIDE.viewH, vx: 0 };
  // M23: parallax handle + the made kick's net reaction target.
  const parN = svg.querySelector(".wf-stadium-par"), camX0Par = camX;
  const _postTarget = isFG ? [...svg.querySelectorAll("[data-wf-post]")].sort((a, b) => {
    const gx = (n) => Math.abs(Number((/translate\(([-\d.]+)/.exec(n.getAttribute("transform") || "") || [0, 0])[1]) - endX);
    return gx(a) - gx(b);
  })[0] || null : null;
  let _netShaken = false;
  let kickHeard = false, kickWhistle = false;
  const tick = () => {
    if (!svg.isConnected) {
      watchStopAnim();
      return;
    }
    const wallNow = performance.now();
    if (playback.interactive && !playback.paused) playback.t = Math.min(dur, playback.t + Math.max(0, wallNow - lastWall) / 1e3 * playback.rate);
    const t = playback.interactive ? playback.t : Math.min(dur, playback.t + Math.max(0, wallNow - lastWall) / 1e3 * speed);
    if (!playback.interactive) playback.t = t;
    lastWall = wallNow;
    const scrub = document.getElementById("replay-scrub");
    if (playback.interactive && scrub && document.activeElement !== scrub) scrub.value = String(Math.round(t / Math.max(0.001, dur) * 1000));
    if (playback.interactive && t + 0.01 < playback.lastRenderedT) {
      if (fxN) fxN.innerHTML = "";
      if (_postTarget) _postTarget.classList.remove("wf-post-shake");
      _netShaken = false;
    }
    playback.lastRenderedT = t;
    if (playback.interactive && playback.director && playback.directorPlan) {
      const cut = playback.directorPlan.at(playback.t);
      playback.directorReason = cut.reason;
      svg.dataset.directorReason = cut.reason;
      watchReplaySetCamera(playback, svg, { actors }, nodes, cut.camera, true);
      const directorBtn = document.getElementById("replay-director");
      if (directorBtn) directorBtn.title = `Director on: ${cut.reason}`;
    } else delete svg.dataset.directorReason;
    watchApplyDirectorFocus(playback, svg, { actors }, p, nodes, true);
    const cameraMode = playback.interactive ? normalizeWatchCamera(playback.cameraMode) : "broadcast";
    if (!opts.replay && !kickHeard && t >= swingT) {
      kickHeard = true;
      stadiumReact("kick");
    }
    if (!opts.replay && !kickWhistle && t >= dur - 0.08) {
      kickWhistle = true;
      stadiumReact("whistle");
    }
    svg.classList.toggle("watch-in-play", t > 0.05);
    let bx, by, ballZ = 0;
    if (t < snapT) {
      const u = t / snapT;
      bx = lerp(startX, holdX, u);
      by = lerp(startY, holdY, u);
    } else if (t < swingT) {
      bx = holdX;
      by = holdY;
    } else if (t < landT) {
      const u = (t - swingT) / flight;
      bx = lerp(holdX, endX, u);
      by = lerp(holdY, endY, u);
      ballZ = Math.sin(u * Math.PI) * (p.blocked ? 0 : 6);
    } else {
      const u = retDur ? Math.min(1, (t - landT) / retDur) : 1;
      bx = lerp(endX, retEndX, u);
      by = lerp(endY, retEndY, u);
    }
    ballN == null ? void 0 : ballN.classList.toggle("wp-ball-kick", t >= swingT && t < landT);
    ballN == null ? void 0 : ballN.classList.toggle("wp-ball-place", isFG && t >= swingT && t < landT);
    ballN == null ? void 0 : ballN.classList.toggle("wp-ball-punt", !isFG && t >= swingT && t < landT);
    if (ballLiftN && t >= swingT && t < landT) {
      const fu = Math.max(0, Math.min(1, (t - swingT) / flight));
      ballLiftN.style.setProperty("--kick-flight", fu.toFixed(3));
      ballLiftN.style.setProperty("--kick-height", Math.sin(fu * Math.PI).toFixed(3));
    }
    landingN == null ? void 0 : landingN.classList.toggle("wp-kick-landing-live", t >= swingT && t < landT + 0.18);
    if (kN && isFG) {
      const u = Math.max(0, Math.min(1, (t - placeT) / Math.max(0.01, swingT - placeT)));
      watchSpecialPlace(kN, lerp(kickX0, holdX + 1.2, u), lerp(kickY0, holdY + 0.4, u));
    }
    const approachStart = isFG ? Math.max(0, placeT - 0.12) : snapT;
    const plantStart = swingT - (isFG ? 0.14 : 0.16);
    kN == null ? void 0 : kN.classList.toggle("wp-kick-approach", t >= approachStart && t < plantStart);
    kN == null ? void 0 : kN.classList.toggle("wp-kick-gather", !isFG && t >= snapT && t < plantStart);
    kN == null ? void 0 : kN.classList.toggle("wp-kick-plant", t >= plantStart && t < swingT + 0.02);
    kN == null ? void 0 : kN.classList.toggle("wp-kick-contact", t >= swingT - 0.045 && t < swingT + 0.085);
    kN == null ? void 0 : kN.classList.toggle("wp-kick-follow", t >= swingT + 0.02 && t <= swingT + 0.54);
    kN == null ? void 0 : kN.classList.toggle("wp-kicking", t >= swingT - 0.06 && t <= swingT + 0.4);
    lsN == null ? void 0 : lsN.classList.toggle("wp-st-snapper", t < snapT + 0.16);
    hN == null ? void 0 : hN.classList.toggle("wp-hold-receive", t >= snapT - 0.08 && t < placeT);
    hN == null ? void 0 : hN.classList.toggle("wp-hold-place", t >= placeT && t < swingT + 0.16);
    if (prN && t >= swingT) {
      if (t < landT) {
        const u = Math.min(1, (t - swingT) / flight);
        watchSpecialPlace(prN, lerp(retX, endX, u * 0.9), lerp(retY, endY - 1.5, u * 0.9));
      } else watchSpecialPlace(prN, bx, by);
    }
    prN == null ? void 0 : prN.classList.toggle("wp-return-track", t >= swingT && t < landT - 0.1);
    prN == null ? void 0 : prN.classList.toggle("wp-return-secure", t >= landT - 0.1 && t < landT + 0.28);
    prN == null ? void 0 : prN.classList.toggle("wp-return-burst", retYds > 0 && t >= landT + 0.16 && t < dur);
    // Protection and rush are separate choreography, not decorative dots.
    // The line sets/anchors, the rush fits gaps, and a recorded block gives one
    // edge player a clean path and leap through the launch point.
    const engageU = Math.max(0, Math.min(1, (t - 0.04) / Math.max(0.2, snapT + 0.18)));
    protectNodes.forEach((node, i) => {
      if (!node) return;
      const a = protectUnit[i];
      const mate = rushUnit[Math.round(i * (rushUnit.length - 1) / Math.max(1, protectUnit.length - 1))];
      const tx = mate ? (a.x + mate.x) / 2 + _watchSideDir * 0.35 : a.x;
      const ty = mate ? (a.y + mate.y) / 2 : a.y;
      watchSpecialPlace(node, lerp(a.x, tx, engageU), lerp(a.y, ty, engageU));
      node.classList.toggle("wp-st-anchor", t >= 0.05 && t < swingT + 0.42);
      node.classList.toggle("wp-st-lost", !!p.blocked && (i === 0 || i === protectNodes.length - 1) && t >= placeT);
    });
    rushNodes.forEach((node, i) => {
      if (!node) return;
      const a = rushUnit[i];
      const mate = protectUnit[Math.round(i * (protectUnit.length - 1) / Math.max(1, rushUnit.length - 1))];
      let tx = mate ? (a.x + mate.x) / 2 - _watchSideDir * 0.28 : a.x;
      let ty = mate ? (a.y + mate.y) / 2 : a.y;
      if (node === rsN) {
        const winU = Math.max(engageU, Math.min(1, t / Math.max(0.01, swingT + 0.06)));
        tx = holdX - _watchSideDir * 1.1;
        ty = holdY - 0.35;
        watchSpecialPlace(node, lerp(a.x, tx, winU), lerp(a.y, ty, winU));
      } else {
        watchSpecialPlace(node, lerp(a.x, tx, engageU), lerp(a.y, ty, engageU));
      }
      node.classList.toggle("wp-st-rush", t >= 0.04 && t < swingT + 0.24);
      node.classList.toggle("wp-st-leap", node === rsN && t >= swingT - 0.16 && t < swingT + 0.22);
    });
    if (!isFG) {
      const chaseU = Math.max(0, Math.min(1, (t - snapT) / Math.max(0.4, flight + retDur)));
      const kickSign = Math.sign(endX - holdX) || -1;
      gunnerNodes.forEach((node, i) => {
        if (!node) return;
        const a = gunnerUnit[i];
        const targetY = by + (i ? 2.8 : -2.8);
        watchSpecialPlace(node, lerp(a.x, bx - kickSign * 2.8, chaseU), lerp(a.y, targetY, chaseU));
        node.classList.toggle("wp-st-release", t >= snapT && t < dur);
        node.classList.toggle("wp-st-breakdown", t >= landT + Math.max(0, retDur - 0.24));
      });
      jammerNodes.forEach((node, i) => {
        if (!node) return;
        const a = jammerUnit[i];
        const gun = gunnerUnit[i];
        const jamU = Math.max(0, Math.min(1, (t - 0.04) / 0.55));
        const releaseU = Math.max(0, Math.min(1, (t - swingT) / Math.max(0.45, flight + retDur)));
        const jamX = gun ? (a.x + gun.x) / 2 : a.x;
        const jamY = gun ? (a.y + gun.y) / 2 : a.y;
        watchSpecialPlace(node, lerp(lerp(a.x, jamX, jamU), bx - kickSign * 5.3, releaseU), lerp(lerp(a.y, jamY, jamU), by + (i ? 4 : -4), releaseU));
        node.classList.toggle("wp-st-jam", t >= 0.04 && t < swingT + 0.14);
        node.classList.toggle("wp-st-wedge", t >= swingT + 0.14 && t < dur);
      });
      engagementN == null ? void 0 : engagementN.classList.toggle("wp-st-engagements-live", t >= 0.05 && t < swingT + 0.45 || t >= landT + 0.1 && t < dur);
    }
    prN == null ? void 0 : prN.classList.toggle("wp-st-faircatch", !p.blocked && !p.touchback && retYds === 0 && !!p.returnerId && t >= landT - 0.12);
    // M22 slew-limited ST pan (no more raw exponential chase) + a gentle
    // tighten while a return is actually being run back.
    {
      const retOn = !isFG && !p.blocked && retDur > 0 && t >= landT;
      camState.h += ((retOn ? 47 : WATCH_SIDE.viewH) - camState.h) * 0.055;
      camState.w = camState.h * (WATCH_SIDE.viewW / WATCH_SIDE.viewH);
      camState.y = (WATCH_SIDE.viewH - camState.h) / 2;
      watchSpecialCameraFrame(svg, p, cameraMode, bx, camState);
      if (parN) parN.setAttribute("transform", ["coach", "endzone"].includes(cameraMode) ? "translate(0,0)" : `translate(${((camState.x - camX0Par) * 0.12).toFixed(2)},0)`);
    }
    const actorPts = {};
    for (const actor of actors) {
      const pt = watchSpecialProjectNode(nodes[actor.id], cameraMode);
      if (pt) actorPts[actor.id] = pt;
    }
    watchApplyLabelPlan(cameraMode, actors, actorPts, nodes, ["K", "PR", "H", "LS", "RS"]);
    const [ballWX, ballWY] = watchSideWorldPoint(bx, by);
    const [renderBX, renderBY] = watchCameraPoint(cameraMode, ballWX, ballWY, ballZ);
    if (ballGroundN) {
      const [groundBX, groundBY] = watchCameraPoint(cameraMode, ballWX, ballWY, 0);
      const projectionFlight = ["coach", "endzone"].includes(cameraMode) && ballZ > 0.08;
      ballGroundN.setAttribute("transform", `translate(${groundBX.toFixed(2)},${groundBY.toFixed(2)}) scale(${Math.max(0.52, 1 - ballZ * 0.045).toFixed(3)})`);
      ballGroundN.style.opacity = projectionFlight ? String(Math.max(0.14, 0.46 - ballZ * 0.035)) : "0";
      ballGroundN.classList.toggle("on", projectionFlight);
    }
    if (ballN) {
      ballN.dataset.worldX = ballWX.toFixed(3);
      ballN.dataset.worldY = ballWY.toFixed(3);
      ballN.dataset.worldZ = ballZ.toFixed(3);
      ballN.setAttribute("transform", `translate(${renderBX.toFixed(2)},${renderBY.toFixed(2)})`);
    }
    if (landingN) {
      const [landingWX, landingWY] = watchSideWorldPoint(endX, endY);
      const [landingX, landingY] = watchCameraPoint(cameraMode, landingWX, landingWY);
      landingN.setAttribute("transform", `translate(${landingX.toFixed(2)},${landingY.toFixed(2)})`);
    }
    // M23: net reaction — the target fork shakes when a made kick arrives.
    if (isFG && p.made && !_netShaken && t >= landT && _postTarget) {
      _netShaken = true;
      _postTarget.classList.add("wf-post-shake");
    }
    if (t >= dur && fxN && !fxN.childElementCount) {
      const label = isFG ? p.made ? "GOOD" : "NO GOOD" : p.blocked ? "BLOCKED" : p.touchback ? "TOUCHBACK" : p.returnTD ? "RETURN TD" : retYds > 0 ? `RET ${retYds} YDS` : p.returnerId && !p.touchback && !p.blocked ? "FAIR CATCH" : "PUNT";
      const cls = isFG && p.made ? "wa-pick" : isFG || p.blocked || p.returnTD ? "wa-x" : "wp-kick-lbl";
      fxN.insertAdjacentHTML(
        "beforeend",
        `<text x="${renderBX.toFixed(1)}" y="${Math.max(5, renderBY - 3.2).toFixed(1)}" class="${cls}">${label}</text>`
      );
    }
    if (playback.interactive) {
      if (t >= dur) {
        playback.paused = true;
        const playBtn = document.getElementById("replay-play");
        if (playBtn) playBtn.textContent = "â–¶";
      }
      if (!playback.paused && _watchAnim) _watchAnim.raf = requestAnimationFrame(tick);
    } else if (t < dur && _watchAnim) _watchAnim.raf = requestAnimationFrame(tick);
  };
  playback.seek = (next) => {
    playback.t = Math.max(0, Math.min(dur, Number(next) || 0));
    lastWall = performance.now();
    if (_watchAnim && _watchAnim.raf) cancelAnimationFrame(_watchAnim.raf);
    if (_watchAnim) _watchAnim.raf = requestAnimationFrame(tick);
  };
  _watchAnim = playback;
  _watchAnim.raf = requestAnimationFrame(tick);
  if (playback.interactive) watchWireInteractiveReplay(playback, svg, { actors }, p, board, nodes);
  return dur;
}
function watchBoardKickoff(svg, p, board, opts = {}) {
  var _a;
  const sprites = ((_a = state.settings) == null ? void 0 : _a.spriteWatch) !== false;
  if (sprites) svg.classList.add("watch-sprites");
  else svg.classList.remove("watch-sprites");
  svg.classList.add("watch-special-teams", "watch-kickoff");
  svg.classList.toggle("watch-kick-onside", !!p.onside);
  const initialCamera = opts.interactive ? normalizeWatchCamera(opts.clip && opts.clip.camera) : "broadcast";
  const [teeX, teeY] = watchSidePoint(50, 31);
  const kickYds = p.onside ? 12 : 58;
  // Kickoffs are stored on the receiving drive. Start from the opponent's
  // side, kick toward the receiver's own end, then return in that drive's
  // offensive direction. This also keeps onside recovery colors honest.
  // M18 kick records name both sides explicitly.  That keeps a scoring team's
  // kickoff attached to the receiver's drive through live call-sheet pauses,
  // and also handles the two-kick sequence after a return touchdown.
  const driveSide = (board == null ? void 0 : board.possession) || "home";
  const kickTeam = p.kickingSide ? p.kickingSide === driveSide ? "off" : "def" : p.returnTD || p.onside && p.recovered ? "off" : "def";
  const returnTeam = kickTeam === "off" ? "def" : "off";
  const kickEndWorldY = 31 + kickYds * WATCH_SIDE.ypu;
  const [endX, endY] = watchSidePoint(p.onside ? 44 : 50, kickEndWorldY);
  const retYds = !p.onside && !p.touchback ? Math.max(0, p.retYds || 0) : 0;
  const [retEndX, retEndY] = watchSidePoint(50, kickEndWorldY - retYds * WATCH_SIDE.ypu);
  const cast = (a) => {
    const face = watchCameraFacing(initialCamera, a.team);
    return sprites ? `<g class="wp-actor wp-team-${a.team} wsp-still wsp-face-${face}" data-wpk="${a.id}" transform="translate(${a.x.toFixed(2)},${a.y.toFixed(2)})">${spriteMarkup(a, face)}</g>` : "";
  };
  const landingMarkup = `<g id="wp-kick-landing" class="wp-kick-landing" transform="translate(${endX.toFixed(2)},${endY.toFixed(2)})"><ellipse rx="2.7" ry="1.05"/><ellipse rx="1.55" ry=".6"/><path d="M0-1.65v3.3M-1.1-.85L0-1.65l1.1.8"/></g>`;
  const kickStartX = teeX + _watchSideDir * 8;
  // M18 fields both complete units.  Coverage owns ten disciplined lanes;
  // return owns a two-deep return pair plus a nine-man wall.  Onside uses the
  // same 11-on-11 count but compresses both units around the restraining line.
  const kickUnit = Array.from({ length: 10 }, (_, i) => {
    const wx = 8 + i * 84 / 9;
    const wy = p.onside ? 31 + 1.2 * WATCH_SIDE.ypu : 31 + 2.1 * WATCH_SIDE.ypu;
    const [x, y] = watchSidePoint(wx, wy);
    return { id: `KO${i}`, team: kickTeam, label: i === 0 || i === 9 ? "G" : "CV", x, y, wx, wy, lane: wx };
  });
  const returnWall = Array.from({ length: 9 }, (_, i) => {
    const wx = 10 + i * 80 / 8;
    const wy = p.onside ? 31 + 6.5 * WATCH_SIDE.ypu : kickEndWorldY - (10 + i % 3 * 2.2) * WATCH_SIDE.ypu;
    const [x, y] = watchSidePoint(wx, wy);
    return { id: `KB${i}`, team: returnTeam, label: p.onside ? "H" : "B", x, y, wx, wy };
  });
  const [kr2X, kr2Y] = watchSidePoint(64, p.onside ? 31 + 7.5 * WATCH_SIDE.ypu : kickEndWorldY + 2.5 * WATCH_SIDE.ypu);
  const returners = [
    { id: "PR", team: returnTeam, label: p.onside ? "HANDS" : "KR", x: endX, y: endY - 2 },
    { id: "KR2", team: returnTeam, label: p.onside ? "HANDS" : "KR", x: kr2X, y: kr2Y }
  ];
  svg.innerHTML = watchFieldBase(p, board) + landingMarkup +
    cast({ id: "K", team: kickTeam, label: "K", x: kickStartX, y: teeY }) +
    kickUnit.map(cast).join("") + returnWall.map(cast).join("") + returners.map(cast).join("") +
    `<ellipse id="wp-ball-ground-shadow" class="wp-ball-ground-shadow" rx="1.05" ry=".36"/>` + ballMarkup(teeX, teeY) + `<g id="wp-st-engagements"></g><g id="wp-fx"></g>`;
  const ballN = svg.querySelector("#wp-ball"), ballGroundN = svg.querySelector("#wp-ball-ground-shadow"), ballLiftN = ballN == null ? void 0 : ballN.querySelector(".wab-lift"), fxN = svg.querySelector("#wp-fx");
  const kN = svg.querySelector('[data-wpk="K"]'), prN = svg.querySelector('[data-wpk="PR"]');
  const kr2N = svg.querySelector('[data-wpk="KR2"]');
  const coverNodes = kickUnit.map(a => svg.querySelector(`[data-wpk="${a.id}"]`));
  const wallNodes = returnWall.map(a => svg.querySelector(`[data-wpk="${a.id}"]`));
  const engagementN = svg.querySelector("#wp-st-engagements"), landingN = svg.querySelector("#wp-kick-landing");
  const speed = (_watch == null ? void 0 : _watch.speed) || 1;
  const runT = 0.6, flight = p.onside ? 0.7 : 1.7;
  const boomT = runT + flight;
  const retDur = retYds > 0 ? Math.max(0.5, Math.min(3.4, retYds / 8)) : p.onside ? 0.8 : 0.3;
  const dur = boomT + retDur + 0.35;
  const actors = [
    { id: "K", team: kickTeam, label: "K", x: kickStartX, y: teeY },
    ...kickUnit, ...returnWall, ...returners
  ];
  const nodes = {};
  for (const actor of actors) {
    const node = svg.querySelector(`[data-wpk="${actor.id}"]`);
    if (!node) continue;
    nodes[actor.id] = node;
    watchSpecialPlace(node, actor.x, actor.y);
  }
  let lastWall = performance.now();
  const playback = {
    raf: 0,
    interactive: !!opts.interactive,
    paused: false,
    rate: 1,
    t: 0,
    duration: dur,
    cameraMode: initialCamera,
    director: false,
    directorPlan: buildSpecialTeamsDirectorPlan(p, { contact: runT, landing: boomT, duration: dur, returnDuration: retYds > 0 ? retDur : 0 }),
    directorReason: "",
    projectionDirty: false,
    annotations: opts.clip && Array.isArray(opts.clip.annotations) ? watchClone(opts.clip.annotations) : [],
    ink: false,
    exporting: false,
    lastRenderedT: 0,
    seek: null,
    renderInk: null
  };
  const lerp = (a, b, u) => a + (b - a) * u;
  const camX = watchSideCameraX(p, teeX);
  // M22: ST boards get the M20 slew-limited pan + a gentle return tighten.
  const camState = { x: camX, y: 0, w: WATCH_SIDE.viewW, h: WATCH_SIDE.viewH, vx: 0 };
  // M23: parallax handle.
  const parN = svg.querySelector(".wf-stadium-par"), camX0Par = camX;
  let kickHeard = false, kickWhistle = false;
  const tick = () => {
    if (!svg.isConnected) {
      watchStopAnim();
      return;
    }
    const wallNow = performance.now();
    if (playback.interactive && !playback.paused) playback.t = Math.min(dur, playback.t + Math.max(0, wallNow - lastWall) / 1e3 * playback.rate);
    const t = playback.interactive ? playback.t : Math.min(dur, playback.t + Math.max(0, wallNow - lastWall) / 1e3 * speed);
    if (!playback.interactive) playback.t = t;
    lastWall = wallNow;
    const scrub = document.getElementById("replay-scrub");
    if (playback.interactive && scrub && document.activeElement !== scrub) scrub.value = String(Math.round(t / Math.max(0.001, dur) * 1000));
    if (playback.interactive && t + 0.01 < playback.lastRenderedT && fxN) fxN.innerHTML = "";
    playback.lastRenderedT = t;
    if (playback.interactive && playback.director && playback.directorPlan) {
      const cut = playback.directorPlan.at(playback.t);
      playback.directorReason = cut.reason;
      svg.dataset.directorReason = cut.reason;
      watchReplaySetCamera(playback, svg, { actors }, nodes, cut.camera, true);
      const directorBtn = document.getElementById("replay-director");
      if (directorBtn) directorBtn.title = `Director on: ${cut.reason}`;
    } else delete svg.dataset.directorReason;
    watchApplyDirectorFocus(playback, svg, { actors }, p, nodes, true);
    const cameraMode = playback.interactive ? normalizeWatchCamera(playback.cameraMode) : "broadcast";
    if (!opts.replay && !kickHeard && t >= runT) {
      kickHeard = true;
      stadiumReact("kick");
    }
    if (!opts.replay && !kickWhistle && t >= dur - 0.08) {
      kickWhistle = true;
      stadiumReact("whistle");
    }
    svg.classList.toggle("watch-in-play", t > 0.05);
    let bx, by, ballZ = 0;
    if (t < runT) {
      bx = teeX;
      by = teeY;
    } else if (t < boomT) {
      const u = (t - runT) / flight;
      bx = lerp(teeX, endX, u);
      by = lerp(teeY, endY, u);
      ballZ = Math.sin(u * Math.PI) * (p.onside ? 1.5 : 7);
    } else if (retYds > 0) {
      const u = Math.min(1, (t - boomT) / retDur);
      bx = lerp(endX, retEndX, u);
      by = lerp(endY, retEndY, u);
    } else {
      bx = endX;
      by = endY;
    }
    ballN == null ? void 0 : ballN.classList.toggle("wp-ball-kick", t >= runT && t < boomT);
    ballN == null ? void 0 : ballN.classList.toggle(p.onside ? "wp-ball-onside" : "wp-ball-kickoff", t >= runT && t < boomT);
    if (ballLiftN && t >= runT && t < boomT) {
      const fu = Math.max(0, Math.min(1, (t - runT) / flight));
      ballLiftN.style.setProperty("--kick-flight", fu.toFixed(3));
      ballLiftN.style.setProperty("--kick-height", Math.sin(fu * Math.PI).toFixed(3));
    }
    landingN == null ? void 0 : landingN.classList.toggle("wp-kick-landing-live", t >= runT && t < boomT + 0.18);
    if (kN) {
      const u = Math.min(1, t / runT);
      watchSpecialPlace(kN, lerp(kickStartX, teeX + _watchSideDir * 1.4, u), teeY);
    }
    kN == null ? void 0 : kN.classList.toggle("wp-kick-approach", t >= 0.08 && t < runT - 0.16);
    kN == null ? void 0 : kN.classList.toggle("wp-kick-plant", t >= runT - 0.16 && t < runT + 0.02);
    kN == null ? void 0 : kN.classList.toggle("wp-kick-contact", t >= runT - 0.045 && t < runT + 0.085);
    kN == null ? void 0 : kN.classList.toggle("wp-kick-follow", t >= runT + 0.02 && t <= runT + 0.56);
    kN == null ? void 0 : kN.classList.toggle("wp-kicking", t >= runT - 0.06 && t <= runT + 0.4);
    const kickSign = Math.sign(endX - teeX) || -1;
    if (p.onside) {
      const crashU = Math.max(0, Math.min(1, (t - runT + 0.12) / (flight + 0.32)));
      coverNodes.forEach((node, i) => {
        if (!node) return;
        const a = kickUnit[i];
        const spread = (i - 4.5) * 0.34 * (1 - crashU);
        watchSpecialPlace(node, lerp(a.x, bx - kickSign * (0.7 + i % 3 * 0.22), crashU), lerp(a.y, by + spread, crashU));
        node.classList.toggle("wp-cover-lane", t >= 0.08 && t < boomT);
        node.classList.toggle("wp-st-onside-dive", t >= boomT - 0.12 && t < boomT + 0.42);
        node.classList.toggle("wp-st-pile", t >= boomT + 0.18);
      });
      wallNodes.forEach((node, i) => {
        if (!node) return;
        const a = returnWall[i];
        const spread = (i - 4) * 0.38 * (1 - crashU);
        watchSpecialPlace(node, lerp(a.x, bx + kickSign * (0.65 + i % 2 * 0.25), crashU), lerp(a.y, by + spread, crashU));
        node.classList.toggle("wp-st-hands", t < boomT + 0.1);
        node.classList.toggle("wp-st-onside-dive", t >= boomT - 0.1 && t < boomT + 0.44);
        node.classList.toggle("wp-st-pile", t >= boomT + 0.18);
      });
      if (prN) watchSpecialPlace(prN, lerp(endX, bx + kickSign * 0.4, crashU), lerp(endY - 2, by - 0.55, crashU));
      if (kr2N) watchSpecialPlace(kr2N, lerp(kr2X, bx + kickSign * 1.1, crashU), lerp(kr2Y, by + 0.65, crashU));
      prN == null ? void 0 : prN.classList.toggle("wp-st-pile", t >= boomT + 0.18);
      kr2N == null ? void 0 : kr2N.classList.toggle("wp-st-pile", t >= boomT + 0.18);
    } else {
      const covU = Math.max(0, Math.min(1, (t - runT) / (flight + Math.max(0.55, retDur))));
      coverNodes.forEach((node, i) => {
        if (!node) return;
        const a = kickUnit[i];
        const laneY = watchSideY(a.lane);
        const wave = (i % 3) * 0.55;
        const targetX = bx - kickSign * (3.2 + wave);
        watchSpecialPlace(node, lerp(a.x, targetX, covU), lerp(a.y, laneY + (by - laneY) * covU * 0.72, covU));
        node.classList.toggle("wp-cover-lane", t >= runT && t < dur);
        node.classList.toggle("wp-st-breakdown", t >= boomT + Math.max(0, retDur - 0.3));
      });
      const wallU = Math.max(0, Math.min(1, (t - runT) / Math.max(0.35, flight + retDur * 0.75)));
      wallNodes.forEach((node, i) => {
        if (!node) return;
        const a = returnWall[i];
        const rank = i % 3;
        const side = Math.floor(i / 3) - 1;
        const wedgeX = bx - kickSign * (4.5 + rank * 2.1);
        const wedgeY = by + side * (2.2 + rank * 0.65);
        watchSpecialPlace(node, lerp(a.x, wedgeX, wallU), lerp(a.y, wedgeY, wallU));
        node.classList.toggle("wp-st-wedge", t >= runT + 0.18 && t < boomT + retDur);
        node.classList.toggle("wp-st-engage", t >= boomT + 0.18 && t < dur - 0.08);
      });
      if (prN && t >= boomT - 0.2) watchSpecialPlace(prN, bx, by);
      if (kr2N) {
        const leadU = Math.max(0, Math.min(1, (t - boomT + 0.12) / Math.max(0.3, retDur)));
        watchSpecialPlace(kr2N, lerp(kr2X, bx - kickSign * 3.4, leadU), lerp(kr2Y, by + 2.5, leadU));
        kr2N.classList.toggle("wp-st-lead", retYds > 0 && t >= boomT);
      }
    }
    prN == null ? void 0 : prN.classList.toggle("wp-return-track", t >= runT && t < boomT - 0.1);
    prN == null ? void 0 : prN.classList.toggle("wp-return-secure", t >= boomT - 0.1 && t < boomT + 0.28);
    prN == null ? void 0 : prN.classList.toggle("wp-return-burst", retYds > 0 && t >= boomT + 0.16 && t < dur);
    prN == null ? void 0 : prN.classList.toggle("wp-st-faircatch", !p.onside && !p.touchback && retYds === 0 && t >= boomT - 0.12);
    engagementN == null ? void 0 : engagementN.classList.toggle("wp-st-engagements-live", !p.onside && t >= boomT + 0.18 && t < dur);
    // M22 slew-limited ST pan (no more raw exponential chase) + a gentle
    // tighten while a return is actually being run back.
    {
      const retOn = !p.onside && !p.touchback && retYds > 0 && t >= boomT;
      camState.h += ((retOn ? 47 : WATCH_SIDE.viewH) - camState.h) * 0.055;
      camState.w = camState.h * (WATCH_SIDE.viewW / WATCH_SIDE.viewH);
      camState.y = (WATCH_SIDE.viewH - camState.h) / 2;
      watchSpecialCameraFrame(svg, p, cameraMode, bx, camState);
      if (parN) parN.setAttribute("transform", ["coach", "endzone"].includes(cameraMode) ? "translate(0,0)" : `translate(${((camState.x - camX0Par) * 0.12).toFixed(2)},0)`);
    }
    const actorPts = {};
    for (const actor of actors) {
      const pt = watchSpecialProjectNode(nodes[actor.id], cameraMode);
      if (pt) actorPts[actor.id] = pt;
    }
    watchApplyLabelPlan(cameraMode, actors, actorPts, nodes, ["K", "PR", "KR2"]);
    const [ballWX, ballWY] = watchSideWorldPoint(bx, by);
    const [renderBX, renderBY] = watchCameraPoint(cameraMode, ballWX, ballWY, ballZ);
    if (ballGroundN) {
      const [groundBX, groundBY] = watchCameraPoint(cameraMode, ballWX, ballWY, 0);
      const projectionFlight = ["coach", "endzone"].includes(cameraMode) && ballZ > 0.08;
      ballGroundN.setAttribute("transform", `translate(${groundBX.toFixed(2)},${groundBY.toFixed(2)}) scale(${Math.max(0.52, 1 - ballZ * 0.045).toFixed(3)})`);
      ballGroundN.style.opacity = projectionFlight ? String(Math.max(0.14, 0.46 - ballZ * 0.035)) : "0";
      ballGroundN.classList.toggle("on", projectionFlight);
    }
    if (ballN) {
      ballN.dataset.worldX = ballWX.toFixed(3);
      ballN.dataset.worldY = ballWY.toFixed(3);
      ballN.dataset.worldZ = ballZ.toFixed(3);
      ballN.setAttribute("transform", `translate(${renderBX.toFixed(2)},${renderBY.toFixed(2)})`);
    }
    if (landingN) {
      const [landingWX, landingWY] = watchSideWorldPoint(endX, endY);
      const [landingX, landingY] = watchCameraPoint(cameraMode, landingWX, landingWY);
      landingN.setAttribute("transform", `translate(${landingX.toFixed(2)},${landingY.toFixed(2)})`);
    }
    if (t >= dur && fxN && !fxN.childElementCount) {
      const label = p.onside ? p.recovered ? "ONSIDE \u2014 RECOVERED!" : "ONSIDE FAILS" : p.returnTD ? "RETURN TD!" : p.touchback ? "TOUCHBACK" : `RET ${retYds} YDS`;
      const cls = p.returnTD || p.recovered ? "wa-pick" : p.onside ? "wa-x" : "wp-kick-lbl";
      fxN.insertAdjacentHTML("beforeend", `<text x="${renderBX.toFixed(1)}" y="${Math.max(5, renderBY - 3.2).toFixed(1)}" class="${cls}">${label}</text>`);
    }
    if (playback.interactive) {
      if (t >= dur) {
        playback.paused = true;
        const playBtn = document.getElementById("replay-play");
        if (playBtn) playBtn.textContent = "â–¶";
      }
      if (!playback.paused && _watchAnim) _watchAnim.raf = requestAnimationFrame(tick);
    } else if (t < dur && _watchAnim) _watchAnim.raf = requestAnimationFrame(tick);
  };
  playback.seek = (next) => {
    playback.t = Math.max(0, Math.min(dur, Number(next) || 0));
    lastWall = performance.now();
    if (_watchAnim && _watchAnim.raf) cancelAnimationFrame(_watchAnim.raf);
    if (_watchAnim) _watchAnim.raf = requestAnimationFrame(tick);
  };
  _watchAnim = playback;
  _watchAnim.raf = requestAnimationFrame(tick);
  if (playback.interactive) watchWireInteractiveReplay(playback, svg, { actors }, p, board, nodes);
  return dur;
}
function watchBoardTry(svg, p, board) {
  var _a, _b;
  const sprites = ((_a = state.settings) == null ? void 0 : _a.spriteWatch) !== false;
  if (sprites) svg.classList.add("watch-sprites");
  else svg.classList.remove("watch-sprites");
  const offL = watchOffSlots(p) || OFF_FIELD_LAYOUTS["Spread"].slots;
  const defL = DEF_FIELD_LAYOUTS["4-3"].slots;
  const LOSW = 31, YPU2 = WATCH_SIDE.ypu;
  const defMaxY = Math.max(...defL.map((sl) => sl.y));
  const cast = [];
  for (const sl of offL) cast.push({
    id: "O_" + sl.id,
    team: "off",
    label: sl.label,
    qb: sl.id === "QB",
    wx: sl.x * 100,
    wy: LOSW + Math.max(0, sl.y - 0.5) * 18 * YPU2
  });
  for (const sl of defL) cast.push({
    id: "D_" + sl.id,
    team: "def",
    label: sl.label,
    wx: sl.x * 100,
    wy: Math.max(23, 29 - (defMaxY - sl.y) * 36)
  });
  const [bx0, by0] = watchSidePoint(50, LOSW + 0.6);
  const [gx, gy] = watchSidePoint(50, LOSW - 3 * YPU2 - 0.5);
  const [sx2, sy2] = watchSidePoint(50, LOSW - 2 * YPU2);
  svg.innerHTML = watchFieldBase(p, board) + cast.map((a) => {
    const [x, y] = watchSidePoint(a.wx, a.wy);
    const face = watchSideFacing(a.team);
    return sprites ? `<g class="wp-actor wp-team-${a.team}${a.qb ? " wp-qb" : ""} wsp-still wsp-face-${face}" transform="translate(${x.toFixed(2)},${y.toFixed(2)})">${spriteMarkup(a, face)}</g>` : "";
  }).join("") + ballMarkup(bx0, by0) + `<g id="wp-fx"></g>`;
  const ballN = svg.querySelector("#wp-ball"), fxN = svg.querySelector("#wp-fx");
  const [tx, ty] = p.made ? [gx, gy] : [sx2, sy2];
  const speed = (_watch == null ? void 0 : _watch.speed) || 1;
  const snapT = 0.6, pushT = snapT + 1, dur = pushT + 1;
  const t0 = performance.now();
  const tick = () => {
    if (!svg.isConnected) {
      watchStopAnim();
      return;
    }
    const t = Math.min(dur, (performance.now() - t0) / 1e3 * speed);
    svg.classList.toggle("watch-in-play", t > snapT * 0.9);
    let x = bx0, y = by0;
    if (t >= snapT) {
      const u = Math.min(1, (t - snapT) / (pushT - snapT));
      x = bx0 + (tx - bx0) * u;
      y = by0 + (ty - by0) * u;
    }
    ballN == null ? void 0 : ballN.setAttribute("transform", `translate(${x.toFixed(2)},${y.toFixed(2)})`);
    if (t >= pushT && fxN && !fxN.childElementCount) {
      fxN.insertAdjacentHTML("beforeend", `<g class="wp-card"><rect x="${x - 22}" y="${y - 12}" width="44" height="5.4" class="wp-card-bg"/><text x="${x}" y="${y - 8.2}" class="wp-card-txt">${p.made ? "TWO-POINT TRY \u2014 GOOD!" : "TRY IS STOPPED!"}</text></g>`);
    }
    if (t < dur && _watchAnim) _watchAnim.raf = requestAnimationFrame(tick);
  };
  _watchAnim = { raf: requestAnimationFrame(tick) };
  return dur;
}
function watchBoardSituational(svg, p, board) {
  var _a;
  const sprites = ((_a = state.settings) == null ? void 0 : _a.spriteWatch) !== false;
  if (sprites) svg.classList.add("watch-sprites");
  else svg.classList.remove("watch-sprites");
  const kneel = p.type === "kneel";
  const [cx0, cy0] = watchSidePoint(50, 31);
  const mk2 = (id, team, label, wx, wy, qb = false) => {
    const [x, y] = watchSidePoint(wx, wy);
    const face = watchSideFacing(team);
    return sprites ? `<g class="wp-actor wp-team-${team}${qb ? " wp-qb" : ""} wsp-still wsp-face-${face}" data-wpk="${id}" transform="translate(${x.toFixed(2)},${y.toFixed(2)})">${spriteMarkup({ id, team, label, qb }, face)}</g>` : "";
  };
  let bodies = "";
  for (let i = 0; i < 5; i++) bodies += mk2("OL" + i, "off", "OL", 38 + i * 6, 31.8);
  bodies += mk2("QB", "off", "QB", 50, kneel ? 35.5 : 34, true);
  if (kneel) {
    bodies += mk2("RB1", "off", "RB", 44, 38) + mk2("RB2", "off", "RB", 56, 38);
  }
  for (let i = 0; i < 4; i++) bodies += mk2("DL" + i, "def", "DL", 40 + i * 6.6, 30.2);
  bodies += mk2("LB1", "def", "LB", 44, 27) + mk2("LB2", "def", "LB", 56, 27);
  const [qx, qy] = watchSidePoint(50, kneel ? 35.5 : 34);
  svg.setAttribute("viewBox", `${watchSideCameraX(p, cx0).toFixed(2)} 0 ${WATCH_SIDE.viewW} ${WATCH_SIDE.viewH}`);
  svg.innerHTML = watchFieldBase(p, board) + bodies + ballMarkup(cx0, cy0) + `<g id="wp-fx"></g>`;
  const ballN = svg.querySelector("#wp-ball"), fxN = svg.querySelector("#wp-fx");
  const qbN = svg.querySelector('[data-wpk="QB"]');
  const speed = (_watch == null ? void 0 : _watch.speed) || 1;
  const snapT = 0.55, actT = snapT + 0.35, dur = kneel ? 2.2 : 1.7;
  const t0 = performance.now();
  const tick = () => {
    if (!svg.isConnected) {
      watchStopAnim();
      return;
    }
    const t = Math.min(dur, (performance.now() - t0) / 1e3 * speed);
    svg.classList.toggle("watch-in-play", t > snapT * 0.8);
    let x = cx0, y = cy0;
    if (t >= snapT) {
      const u = Math.min(1, (t - snapT) / 0.22);
      x = cx0 + (qx - cx0) * u;
      y = cy0 + (qy - cy0) * u;
      if (!kneel && t >= actT) {
        const v = Math.min(1, (t - actT) / 0.15);
        y = qy + (cy0 + 1.2 - qy) * v;
      }
    }
    ballN == null ? void 0 : ballN.setAttribute("transform", `translate(${x.toFixed(2)},${y.toFixed(2)})`);
    qbN == null ? void 0 : qbN.classList.toggle("wp-kneeling", kneel && t >= actT);
    qbN == null ? void 0 : qbN.classList.toggle("wp-throwing", !kneel && t >= snapT && t <= actT + 0.15);
    if (t >= actT + 0.3 && fxN && !fxN.childElementCount) {
      fxN.insertAdjacentHTML("beforeend", `<text x="${cx0}" y="${(cy0 - 8).toFixed(1)}" class="wp-kick-lbl">${kneel ? "VICTORY FORMATION" : "CLOCK STOPPED"}</text>`);
    }
    if (t < dur && _watchAnim) _watchAnim.raf = requestAnimationFrame(tick);
  };
  _watchAnim = { raf: requestAnimationFrame(tick) };
  return dur;
}
function watchBoardFlag(svg, p, board) {
  const [fx0, fy0] = watchSidePoint(50, 31);
  svg.classList.remove("watch-in-play");
  const camX = watchSideCameraX(p, fx0);
  svg.setAttribute("viewBox", `${camX.toFixed(2)} 0 ${WATCH_SIDE.viewW} ${WATCH_SIDE.viewH}`);
  const cx = Math.max(camX + 28, Math.min(camX + WATCH_SIDE.viewW - 28, fx0));
  const name = escapeHtml(String(p.penaltyName || "PENALTY").toUpperCase());
  const team = escapeHtml(String(p.penaltyOn || "").toUpperCase());
  const yds = Math.abs(p.yards || 0);
  const verdict = p.penaltySide === "offense" ? `${yds} YDS \u2014 REPLAY THE DOWN` : `${yds} YDS${p.autoFirst ? " \u2014 AUTOMATIC 1ST DOWN" : ""}`;
  const lx = fx0 + ((p.fieldPos || 50) % 5 - 2) * 2.2;
  const ly = fy0 + (((p.clock || 0) / 10 % 3 | 0) - 1) * 4;
  const line1 = team ? `${name} \u2014 ${team}` : name;
  svg.innerHTML = watchFieldBase(p, board) + `<g transform="translate(${lx.toFixed(1)},${ly.toFixed(1)})"><g class="wp-flag"><rect x="-1.15" y="-1.15" width="2.3" height="2.3" class="wp-flag-cloth"/><rect x="-0.4" y="-0.4" width="0.8" height="0.8" class="wp-flag-knot"/></g></g><text x="${cx.toFixed(1)}" y="${(fy0 - 9).toFixed(1)}" class="wa-flag-call">FLAG</text><g class="wp-card wp-flag-detail"><rect x="${(cx - 26).toFixed(1)}" y="${(fy0 + 3).toFixed(1)}" width="52" height="11" class="wp-card-bg"/><text x="${cx.toFixed(1)}" y="${(fy0 + 7.6).toFixed(1)}" class="wp-card-txt"${line1.length > 24 ? ` textLength="48" lengthAdjust="spacingAndGlyphs"` : ""}>${line1}</text><text x="${cx.toFixed(1)}" y="${(fy0 + 11.6).toFixed(1)}" class="wp-card-txt wp-card-sub">${verdict}</text></g>`;
  return 2.6;
}
function watchFxMarkup(f, cam = null, projectPoint = watchSidePoint) {
  let [x, y] = projectPoint(f.x, f.y);
  // M22: overlays stay inside the playable frame — cards and result texts
  // clamp into the CURRENT camera view at spawn, so no banner is ever
  // bisected by the frame edge or parked over the chrome.
  if (cam) {
    const wide = f.kind === "flag" || f.kind === "td" ? 28 : 8;
    const top = f.kind === "td" ? 13.5 : f.kind === "flag" ? 9.5 : 4;
    const bot = f.kind === "flag" ? 16.5 : 5;
    x = Math.max(cam.x + wide, Math.min(cam.x + cam.w - wide, x));
    y = Math.max(cam.y + top, Math.min(cam.y + cam.h - bot, y));
  }
  switch (f.kind) {
    case "inc":
      return `<text x="${x}" y="${y}" class="wa-x">\u2715</text>`;
    case "int":
      return `<text x="${x}" y="${y}" class="wa-pick">INT</text>`;
    case "sack":
      return `<text x="${x}" y="${y}" class="wa-pick">SACK</text>`;
    case "fum":
      return `<text x="${x}" y="${y}" class="wa-pick">FUM</text>`;
    case "tackle":
      return `<circle cx="${x}" cy="${y}" r="2.4" class="wp-tackle"/>`;
    case "contact":
      return `<g class="wp-contact" transform="translate(${x},${y})"><ellipse class="wp-contact-wave" rx="2.4" ry="1.25"/><circle r="0.52" class="wp-contact-core"/><g class="wp-contact-rays"><line x1="0" y1="-2.8" x2="0" y2="-1.35"/><line x1="0" y1="2.8" x2="0" y2="1.35"/><line x1="-2.8" y1="0" x2="-1.35" y2="0"/><line x1="2.8" y1="0" x2="1.35" y2="0"/></g><g class="wp-contact-dust"><rect x="-1.8" y=".5" width=".55" height=".55" style="--dx:-2px;--dy:-1.4px"/><rect x="1.25" y=".45" width=".48" height=".48" style="--dx:2.2px;--dy:-1.1px"/><rect x="-.35" y=".8" width=".42" height=".42" style="--dx:.5px;--dy:-2px"/></g></g>`;
    case "block":
      return `<g class="wp-block-pop" transform="translate(${x},${y})"><path d="M-2,-2 L2,2 M-2,2 L2,-2"/></g>`;
    case "catch":
      return `<circle cx="${x}" cy="${y}" r="2.7" class="wp-catch"/>`;
    case "fd":
      return `<g class="wp-fd-spot" transform="translate(${x},${y})"><ellipse rx="3.2" ry="1.35"/><path d="M-1.8 0H1.8M.8-1L1.8 0 .8 1"/></g>`;
    case "hurt":
      return `<g class="wp-hurt" transform="translate(${x},${(y - 5).toFixed(1)})"><rect x="-2" y="-0.7" width="4" height="1.4"/><rect x="-0.7" y="-2" width="1.4" height="4"/></g>`;
    case "flag": {
      const nm2 = escapeHtml(String(f.name || "PENALTY").toUpperCase());
      const tm2 = escapeHtml(String(f.team || "").toUpperCase());
      const line1 = tm2 ? `${nm2} \u2014 ${tm2}` : nm2;
      return `<g transform="translate(${x},${y})"><g class="wp-flag"><rect x="-1.15" y="-1.15" width="2.3" height="2.3" class="wp-flag-cloth"/><rect x="-0.4" y="-0.4" width="0.8" height="0.8" class="wp-flag-knot"/></g></g><text x="${x}" y="${(y - 8).toFixed(1)}" class="wa-flag-call">FLAG</text><g class="wp-card wp-flag-detail"><rect x="${(x - 26).toFixed(1)}" y="${(y + 4).toFixed(1)}" width="52" height="11" class="wp-card-bg"/><text x="${x}" y="${(y + 8.6).toFixed(1)}" class="wp-card-txt"${line1.length > 24 ? ' textLength="48" lengthAdjust="spacingAndGlyphs"' : ""}>${line1}</text><text x="${x}" y="${(y + 12.6).toFixed(1)}" class="wp-card-txt wp-card-sub">${escapeHtml(f.verdict || "")}</text></g>`;
    }
    case "turf": {
      // M25: turf spray — pellets kicked off a hard cut (small) or a tackle
      // landing (big). Same one-shot CSS pattern as wp-contact-dust; the
      // seed picks the scatter so the same play sprays the same way twice.
      let s = f.seed != null ? f.seed : 1;
      const tr = () => {
        s = s * 1103515245 + 12345 & 2147483647;
        return s / 2147483647;
      };
      const n = f.big ? 7 : 4;
      let pel = "";
      for (let i = 0; i < n; i++) {
        const ang = tr() * Math.PI * 2, r = (f.big ? 1.6 : 1.1) + tr() * (f.big ? 1.9 : 1.2);
        const sz = 0.3 + tr() * 0.26;
        pel += `<rect x="-${(sz / 2).toFixed(2)}" y="-${(sz / 2).toFixed(2)}" width="${sz.toFixed(2)}" height="${sz.toFixed(2)}" style="--dx:${(Math.cos(ang) * r).toFixed(1)}px;--dy:${(Math.sin(ang) * r * 0.6 - 1.1).toFixed(1)}px"/>`;
      }
      return `<g class="wp-turf${f.big ? " wp-turf-big" : ""}" transform="translate(${x},${y})">${pel}</g>`;
    }
    case "td": {
      const cols = ["#ffd34d", "#f4f0d8", "#59d8ff", "#ff8c79", "#3fe04b"];
      let conf = "";
      for (let i = 0; i < 10; i++) {
        const ang = i / 10 * Math.PI * 2;
        const r = 4 + i % 3 * 1.7;
        conf += `<rect x="-0.45" y="-0.45" width="0.9" height="0.9" fill="${cols[i % cols.length]}" style="--cx:${(Math.cos(ang) * r).toFixed(1)}px;--cy:${(Math.sin(ang) * r - 2.5).toFixed(1)}px"/>`;
      }
      return `<g class="wp-conf" transform="translate(${x},${y})">${conf}</g><text x="${x}" y="${y}" class="wa-td">TD!</text>`;
    }
    default:
      return "";
  }
}
// M23: a lightweight zebra — the officials layer renders three of these and
// places them per frame from buildOfficialsPlan (never part of the 22 actors).
function watchOfficialMarkup(id, x, y) {
  return `<g class="wp-official" data-wpo="${id}" transform="translate(${x.toFixed(2)},${y.toFixed(2)})"><ellipse class="wpo-shadow" cx="0" cy="0" rx=".95" ry=".22"/><g class="wpo-body"><rect class="wpo-legs" x="-.48" y="-1.45" width=".96" height="1.45"/><rect class="wpo-torso" x="-.66" y="-3.05" width="1.32" height="1.6"/><path class="wpo-stripes" d="M-.44-3.05v1.6M-.15-3.05v1.6M.15-3.05v1.6M.44-3.05v1.6"/><g class="wpo-arm wpo-arm-l"><rect x="-1" y="-2.95" width=".3" height="1.05"/></g><g class="wpo-arm wpo-arm-r"><rect x=".7" y="-2.95" width=".3" height="1.05"/></g><circle class="wpo-head" cx="0" cy="-3.5" r=".4"/><rect class="wpo-cap" x="-.4" y="-3.95" width=".8" height=".28"/></g></g>`;
}
// M24: auto quality — sticky per session; set when a board's frame-time EMA
// stays slow, and every later board starts lite.
var _watchLiteMode = false;
// M23: section-based crowd reaction — the given side's fans erupt, the other
// side sags; cleared after the moment passes.
function watchCrowdReact(svg, side) {
  if (!svg) return;
  const other = side === "home" ? "away" : "home";
  svg.classList.add("watch-roar-" + side, "watch-groan-" + other);
  setTimeout(() => svg.classList.remove("watch-roar-" + side, "watch-groan-" + other), 1900);
}
// M23: broadcast banner — DOM strip over the crowd band (outside the playable
// field, per the M22 safe-area rule). Live plays only; replays never re-banner.
let _watchBannerTimer = null;
function watchShowBanner(title, sub, fill) {
  const el = document.getElementById("watch-banner");
  if (!el) return;
  el.innerHTML = `<span class="wb-title">${escapeHtml(title)}</span>${sub ? `<span class="wb-sub">${escapeHtml(sub)}</span>` : ""}`;
  el.style.setProperty("--wb-accent", fill || "var(--px-yellow)");
  el.classList.add("on");
  if (_watchBannerTimer) clearTimeout(_watchBannerTimer);
  _watchBannerTimer = setTimeout(() => el.classList.remove("on"), 2400);
}
// M25: player-ID lower third / drive summary — a DOM strip on the bottom
// crowd band (safe area, the banner precedent). Live moments only; the
// replay path re-runs the board, never the reveal, so it can't re-show.
let _watchLowerTimer = null;
function watchShowLower(kicker, title, sub, fill, ms = 3e3) {
  const el = document.getElementById("watch-lower");
  if (!el) return;
  el.innerHTML = `<span class="wl-kicker">${escapeHtml(kicker)}</span><span class="wl-title">${escapeHtml(title)}</span>${sub ? `<span class="wl-sub">${escapeHtml(sub)}</span>` : ""}`;
  el.style.setProperty("--wl-accent", fill || "var(--px-yellow)");
  el.classList.add("on");
  if (_watchLowerTimer) clearTimeout(_watchLowerTimer);
  _watchLowerTimer = setTimeout(() => el.classList.remove("on"), ms);
}
// M25: the featured man of a play — scorer first, then the ball-taker, the
// sacker, the big-play man. def:true colors the strip with the DEFENSE'S
// fill. Returns null on plays nobody headlines.
function watchFeaturedMan(p) {
  const yds = p.yards || 0;
  if (p.turnover && p.turnoverType === "interception" && p.intPickerId) return { id: p.intPickerId, role: p.tipDrill ? "TIP-DRILL PICK" : "INTERCEPTION", def: true, slot: p.ballSlots && p.ballSlots.pick || null };
  if (p.sack && (p.sackerId || p.sackerId2)) return { id: p.sackerId || p.sackerId2, role: "SACK", def: true, slot: null };
  if (p.td && (p.receiverId || p.rusherId || p.returnerId)) return { id: p.receiverId || p.rusherId || p.returnerId, role: "TOUCHDOWN", def: false, slot: p.receiverId ? p.targetSlotId : p.carrierSlotId || null };
  if (p.complete && yds >= 20 && p.receiverId) return { id: p.receiverId, role: "BIG PLAY", def: false, slot: p.targetSlotId || null };
  if (String(p.type || "").startsWith("run") && yds >= 15 && p.rusherId) return { id: p.rusherId, role: "BIG RUN", def: false, slot: p.carrierSlotId || null };
  return null;
}
// The on-screen jersey number for a slot — read off the RENDERED sprite
// (data-wpa → data-jersey), so the strip can never disagree with the body
// on the field. Null when the slot didn't translate.
function watchJerseyOf(slotId) {
  var _a;
  if (!slotId) return null;
  const n = document.querySelector(`#watch-board [data-wpa="${slotId}"] [data-jersey]`);
  return ((_a = n) == null ? void 0 : _a.getAttribute("data-jersey")) || null;
}
// A player's running line for THIS game, accumulated from the plays already
// watched — the broadcast "his day so far" stat.
function watchGameLine(w, uptoIdx, id) {
  let ruAtt = 0, ruYds = 0, rec = 0, recYds = 0, tds = 0, sacks = 0, ints = 0, pbus = 0, tkl = 0;
  for (let i = 0; i <= uptoIdx && i < w.seq.length; i++) {
    const it = w.seq[i];
    if (it.kind !== "play" || !it.p) continue;
    const p = it.p;
    if (p.rusherId === id && String(p.type || "").startsWith("run")) {
      ruAtt++;
      ruYds += p.yards || 0;
      if (p.td) tds++;
    }
    if (p.receiverId === id && p.complete) {
      rec++;
      recYds += p.yards || 0;
      if (p.td) tds++;
    }
    if (p.sackerId === id || p.sackerId2 === id) sacks++;
    if (p.intPickerId === id && p.turnover) ints++;
    if (p.pbuId === id) pbus++;
    if (p.tacklerId === id) tkl++;
  }
  const bits = [];
  if (ruAtt) bits.push(`${ruAtt} CAR ${ruYds} YDS`);
  if (rec) bits.push(`${rec} REC ${recYds} YDS`);
  if (tds) bits.push(`${tds} TD`);
  if (sacks) bits.push(`${sacks} SACK${sacks > 1 ? "S" : ""}`);
  if (ints) bits.push(`${ints} INT`);
  if (pbus) bits.push(`${pbus} PBU`);
  if (!bits.length && tkl) bits.push(`${tkl} TKL`);
  return bits.join(" \xB7 ");
}
function watchCoachFieldBase(p, board = null) {
  const fp = Number.isFinite(p == null ? void 0 : p.fieldPos) ? p.fieldPos : 50;
  const x0 = 8, x1 = 92, width = x1 - x0;
  const yOf = (absYard) => 31 - (absYard - fp) * 0.72;
  const homeOnOffense = (board == null ? void 0 : board.possession) !== "away";
  const offFill = homeOnOffense ? board == null ? void 0 : board.homeFill : board == null ? void 0 : board.awayFill;
  const defFill = homeOnOffense ? board == null ? void 0 : board.awayFill : board == null ? void 0 : board.homeFill;
  const offName = homeOnOffense ? board == null ? void 0 : board.homeName : board == null ? void 0 : board.awayName;
  const defName = homeOnOffense ? board == null ? void 0 : board.awayName : board == null ? void 0 : board.homeName;
  const top = yOf(110), bottom = yOf(-10);
  let out = `<g class="wf-coach-camera" data-watch-camera-layer="coach">`;
  out += `<rect x="0" y="0" width="100" height="56" class="wf-coach-stadium"/>`;
  out += `<rect x="${x0}" y="${top.toFixed(2)}" width="${width}" height="${(bottom - top).toFixed(2)}" class="wf-turf"/>`;
  for (let abs = -10; abs < 110; abs += 10) {
    const ya = yOf(abs), yb = yOf(abs + 5);
    out += `<rect x="${x0}" y="${Math.min(ya, yb).toFixed(2)}" width="${width}" height="${Math.abs(yb - ya).toFixed(2)}" class="wf-mow"/>`;
  }
  const topEzY = yOf(110), topGoalY = yOf(100), bottomGoalY = yOf(0), bottomEzY = yOf(-10);
  out += `<rect x="${x0}" y="${topEzY.toFixed(2)}" width="${width}" height="${(topGoalY - topEzY).toFixed(2)}" class="wf-endzone" fill="${defFill || "#8b3440"}"/>`;
  out += `<rect x="${x0}" y="${bottomGoalY.toFixed(2)}" width="${width}" height="${(bottomEzY - bottomGoalY).toFixed(2)}" class="wf-endzone" fill="${offFill || "#37506f"}"/>`;
  if (defName) out += `<text x="50" y="${(topGoalY - 2.1).toFixed(2)}" class="wf-coach-endzone-label">${escapeHtml(String(defName).toUpperCase())}</text>`;
  if (offName) out += `<text x="50" y="${(bottomGoalY + 5.2).toFixed(2)}" class="wf-coach-endzone-label">${escapeHtml(String(offName).toUpperCase())}</text>`;
  out += `<rect x="${x0}" y="${top.toFixed(2)}" width="${width}" height="${(bottom - top).toFixed(2)}" fill="url(#wf-grain)"/>`;
  const hashLeft = 8 + 31.4 * 0.84, hashRight = 8 + 66.6 * 0.84;
  for (let abs = 0; abs <= 100; abs++) {
    const y = yOf(abs);
    if (abs % 5 === 0) {
      out += `<line x1="${x0}" y1="${y.toFixed(2)}" x2="${x1}" y2="${y.toFixed(2)}" class="${abs === 0 || abs === 100 ? "wf-goal" : "wf-yard"}"/>`;
      if (abs > 0 && abs < 100 && abs % 10 === 0) {
        const n = abs <= 50 ? abs : 100 - abs;
        out += `<text x="15" y="${(y + 1.15).toFixed(2)}" class="wf-num wf-num-coach">${n}</text><text x="85" y="${(y + 1.15).toFixed(2)}" class="wf-num wf-num-coach">${n}</text>`;
      }
    } else {
      out += `<line x1="${(hashLeft - 0.7).toFixed(2)}" y1="${y.toFixed(2)}" x2="${(hashLeft + 0.7).toFixed(2)}" y2="${y.toFixed(2)}" class="wf-hash"/><line x1="${(hashRight - 0.7).toFixed(2)}" y1="${y.toFixed(2)}" x2="${(hashRight + 0.7).toFixed(2)}" y2="${y.toFixed(2)}" class="wf-hash"/>`;
    }
  }
  out += `<line x1="${x0}" y1="${top.toFixed(2)}" x2="${x0}" y2="${bottom.toFixed(2)}" class="wf-side"/><line x1="${x1}" y1="${top.toFixed(2)}" x2="${x1}" y2="${bottom.toFixed(2)}" class="wf-side"/>`;
  out += `<line x1="${x0}" y1="31" x2="${x1}" y2="31" class="wf-los" data-wf-los="${fp}"/>`;
  if (p && p.down && p.distance != null && fp + p.distance <= 100) {
    const firstY = yOf(fp + p.distance);
    out += `<line x1="${x0}" y1="${firstY.toFixed(2)}" x2="${x1}" y2="${firstY.toFixed(2)}" class="wf-first" data-wf-first="${(fp + p.distance).toFixed(1)}"/>`;
  }
  out += `<g class="wf-coach-direction" transform="translate(50 25)"><path d="M0 3V-3M-2-1L0-3 2-1"/></g>`;
  return out + `</g>`;
}
function watchSideWorldPoint(sideX, sideY) {
  const latX = (sideY - WATCH_SIDE.fieldTop) * 100 / WATCH_SIDE.fieldHeight;
  return [
    _watchSideDir < 0 ? 100 - latX : latX, // #49: undo the lateral mirror
    31 - (sideX - 31) / (_watchSideDir * WATCH_SIDE.longitudinal)
  ];
}
function watchSpecialProjectNode(node, cameraMode) {
  if (!node || !Number.isFinite(node._watchSideX) || !Number.isFinite(node._watchSideY)) return null;
  const [worldX, worldY] = watchSideWorldPoint(node._watchSideX, node._watchSideY);
  const [x, y] = watchCameraPoint(cameraMode, worldX, worldY);
  const scale = watchCameraScale(cameraMode, worldX, worldY);
  node.dataset.worldX = worldX.toFixed(3);
  node.dataset.worldY = worldY.toFixed(3);
  node.setAttribute("transform", `translate(${x.toFixed(2)},${y.toFixed(2)}) scale(${scale.toFixed(3)})`);
  return [x, y, worldX, worldY];
}
function watchSpecialPlace(node, sideX, sideY) {
  if (!node) return;
  node._watchSideX = sideX;
  node._watchSideY = sideY;
}
function watchSpecialCameraFrame(svg, p, cameraMode, focusX, camState) {
  svg.dataset.camera = cameraMode;
  svg.classList.toggle("watch-camera-coach", cameraMode === "coach");
  svg.classList.toggle("watch-camera-endzone", cameraMode === "endzone");
  svg.classList.toggle("watch-camera-reverse", cameraMode === "reverse");
  if (["coach", "endzone"].includes(cameraMode)) {
    svg.setAttribute("viewBox", `0 0 ${WATCH_SIDE.viewW} ${WATCH_SIDE.viewH}`);
    return;
  }
  if (cameraMode === "all22") {
    svg.setAttribute("viewBox", `${watchSideCameraX(p, 31).toFixed(2)} 0 ${WATCH_SIDE.viewW} ${WATCH_SIDE.viewH}`);
    return;
  }
  const xPull = watchSideCameraX(p, focusX, camState.w) - camState.x;
  camState.vx += Math.max(-0.075, Math.min(0.075, xPull * 0.11 - camState.vx));
  camState.vx = Math.max(-2.1, Math.min(2.1, camState.vx));
  if (Math.abs(xPull) < 0.35 && Math.abs(camState.vx) < 0.08) camState.vx = 0;
  camState.x += camState.vx;
  svg.setAttribute("viewBox", `${camState.x.toFixed(2)} ${camState.y.toFixed(2)} ${camState.w.toFixed(2)} ${camState.h.toFixed(2)}`);
}

function watchEndzoneFieldBase(p, board = null) {
  const fp = Number.isFinite(p == null ? void 0 : p.fieldPos) ? p.fieldPos : 50;
  const worldYOf = (absYard) => 31 - (absYard - fp) * WATCH_SIDE.ypu;
  const edge = (absYard, worldX) => watchCameraPoint("endzone", worldX, worldYOf(absYard));
  const quad = (a, b) => {
    const al = edge(a, 0), ar = edge(a, 100), bl = edge(b, 0), br = edge(b, 100);
    return `${al[0].toFixed(2)},${al[1].toFixed(2)} ${ar[0].toFixed(2)},${ar[1].toFixed(2)} ${br[0].toFixed(2)},${br[1].toFixed(2)} ${bl[0].toFixed(2)},${bl[1].toFixed(2)}`;
  };
  const homeOnOffense = (board == null ? void 0 : board.possession) !== "away";
  const offFill = homeOnOffense ? board == null ? void 0 : board.homeFill : board == null ? void 0 : board.awayFill;
  const defFill = homeOnOffense ? board == null ? void 0 : board.awayFill : board == null ? void 0 : board.homeFill;
  let out = `<g class="wf-endzone-camera" data-watch-camera-layer="endzone"><rect width="100" height="56" class="wf-endzone-stadium"/>`;
  out += `<polygon points="${quad(-10, 110)}" class="wf-turf"/>`;
  for (let abs = -10; abs < 110; abs += 10) out += `<polygon points="${quad(abs, abs + 5)}" class="wf-mow"/>`;
  out += `<polygon points="${quad(-10, 0)}" class="wf-endzone" fill="${offFill || "#37506f"}"/><polygon points="${quad(100, 110)}" class="wf-endzone" fill="${defFill || "#8b3440"}"/>`;
  for (let abs = 0; abs <= 100; abs++) {
    const left = edge(abs, 0), right = edge(abs, 100);
    if (abs % 5 === 0) {
      out += `<line x1="${left[0].toFixed(2)}" y1="${left[1].toFixed(2)}" x2="${right[0].toFixed(2)}" y2="${right[1].toFixed(2)}" class="${abs === 0 || abs === 100 ? "wf-goal" : "wf-yard"}"/>`;
      if (abs > 0 && abs < 100 && abs % 10 === 0) {
        const n = abs <= 50 ? abs : 100 - abs;
        const lp = edge(abs, 12), rp = edge(abs, 88);
        out += `<text x="${lp[0].toFixed(2)}" y="${(lp[1] + .8).toFixed(2)}" class="wf-num wf-num-endzone">${n}</text><text x="${rp[0].toFixed(2)}" y="${(rp[1] + .8).toFixed(2)}" class="wf-num wf-num-endzone">${n}</text>`;
      }
    } else {
      const hl = edge(abs, 31.4), hr = edge(abs, 66.6);
      const tick = Math.max(.18, watchCameraScale("endzone", 50, worldYOf(abs)) * .55);
      out += `<line x1="${(hl[0] - tick).toFixed(2)}" y1="${hl[1].toFixed(2)}" x2="${(hl[0] + tick).toFixed(2)}" y2="${hl[1].toFixed(2)}" class="wf-hash"/><line x1="${(hr[0] - tick).toFixed(2)}" y1="${hr[1].toFixed(2)}" x2="${(hr[0] + tick).toFixed(2)}" y2="${hr[1].toFixed(2)}" class="wf-hash"/>`;
    }
  }
  const nearL = edge(-10, 0), nearR = edge(-10, 100), farL = edge(110, 0), farR = edge(110, 100);
  out += `<line x1="${nearL[0].toFixed(2)}" y1="${nearL[1].toFixed(2)}" x2="${farL[0].toFixed(2)}" y2="${farL[1].toFixed(2)}" class="wf-side"/><line x1="${nearR[0].toFixed(2)}" y1="${nearR[1].toFixed(2)}" x2="${farR[0].toFixed(2)}" y2="${farR[1].toFixed(2)}" class="wf-side"/>`;
  const losL = edge(fp, 0), losR = edge(fp, 100);
  out += `<line x1="${losL[0].toFixed(2)}" y1="${losL[1].toFixed(2)}" x2="${losR[0].toFixed(2)}" y2="${losR[1].toFixed(2)}" class="wf-los" data-wf-los="${fp}"/>`;
  if (p && p.down && p.distance != null && fp + p.distance <= 100) {
    const first = fp + p.distance, firstL = edge(first, 0), firstR = edge(first, 100);
    out += `<line x1="${firstL[0].toFixed(2)}" y1="${firstL[1].toFixed(2)}" x2="${firstR[0].toFixed(2)}" y2="${firstR[1].toFixed(2)}" class="wf-first" data-wf-first="${first.toFixed(1)}"/>`;
  }
  out += `<g class="wf-endzone-direction" transform="translate(50 36)"><path d="M0 3V-3M-2-1L0-3 2-1"/></g>`;
  return out + `</g>`;
}

function watchFieldBase(p, board = null) {
  const fp = Number.isFinite(p == null ? void 0 : p.fieldPos) ? p.fieldPos : null;
  const FT = WATCH_SIDE.fieldTop, FH = WATCH_SIDE.fieldHeight, FB = FT + FH;
  const EZ = 10 * WATCH_SIDE.ypu * WATCH_SIDE.longitudinal;
  const X_LEFT = -110, X_RIGHT = 180;
  const homeCrowd = (board == null ? void 0 : board.homeFill) || "#37506f";
  const awayCrowd = (board == null ? void 0 : board.awayFill) || "#8b3440";
  // M25: the game's weather rides the board (deterministic per game); one
  // seeded stream draws every weather-touched element so nothing teleports
  // between plays.
  const wx = (board == null ? void 0 : board.weather) || null;
  let _wxS = (wx ? wx.seed : 1234567) >>> 0;
  const wxRnd = () => {
    _wxS = _wxS * 1103515245 + 12345 & 2147483647;
    return _wxS / 2147483647;
  };
  const defs = `<defs>
    <marker id="wa-arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#ffd54a"/></marker>
    <marker id="wa-arr-r" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#e5533d"/></marker>
    <pattern id="wf-grain" width="9" height="9" patternUnits="userSpaceOnUse">
      <rect x="1.2" y="2.6" width="0.7" height="0.7" fill="rgba(0,0,0,0.11)"/>
      <rect x="5.6" y="6.8" width="0.7" height="0.7" fill="rgba(255,255,255,0.05)"/>
      <rect x="7.2" y="0.9" width="0.7" height="0.7" fill="rgba(0,0,0,0.09)"/>
      <rect x="3.1" y="7.4" width="0.7" height="0.7" fill="rgba(0,0,0,0.07)"/>
      <rect x="0.4" y="5.2" width="0.7" height="0.7" fill="rgba(255,255,255,0.035)"/>
    </pattern>
    <pattern id="wf-ezchk" width="2.4" height="2.4" patternUnits="userSpaceOnUse">
      <rect width="1.2" height="1.2" fill="rgba(0,0,0,0.2)"/>
      <rect x="1.2" y="1.2" width="1.2" height="1.2" fill="rgba(0,0,0,0.2)"/>
    </pattern>
    <pattern id="wf-crowd" width="7" height="5" patternUnits="userSpaceOnUse">
      <rect width="7" height="5" fill="#0a1220"/>
      <rect x="0.7" y="0.8" width="0.9" height="0.9" fill="${homeCrowd}" fill-opacity=".72"/>
      <rect x="2.6" y="2.9" width="0.9" height="0.9" fill="#5a6884"/>
      <rect x="4.8" y="1.1" width="0.9" height="0.9" fill="${awayCrowd}" fill-opacity=".72"/>
      <rect x="5.6" y="3.6" width="0.9" height="0.9" fill="#6e7a94"/>
      <rect x="1.4" y="4.0" width="0.9" height="0.9" fill="#49536e"/>
      <rect x="3.9" y="0.2" width="0.9" height="0.9" fill="#8a8ca3"/>
    </pattern>
  </defs>`;
  let crowdLife = `<g class="wf-crowd-life">`;
  for (let i = 0; i < 59; i++) {
    const x = X_LEFT + 2.4 + i * 4.9;
    const topY = Math.max(1.1, FT - 2.2 - i % 3 * 0.72);
    const botY = Math.min(WATCH_SIDE.viewH - 1.2, FB + 1.35 + i % 3 * 0.72);
    // M23: section identity — fans carry home/away/neutral classes so the
    // crowd can react by SECTION (the scoring side's people bounce).
    const sect = i % 5 === 0 ? "neutral" : i % 2 ? "home" : "away";
    const fill = i % 5 === 0 ? "#f4f0d8" : i % 2 ? homeCrowd : awayCrowd;
    const fan = (y, flip) => `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)})"><g class="wf-fan-motion wf-fan-${sect}" style="--wf-phase:${i % 7};--wf-bob:${(-0.22 * flip).toFixed(2)}px"><circle class="wf-fan-head" cx="0" cy="-.5" r=".28"/><rect class="wf-fan-body" x="-.38" y="-.18" width=".76" height=".88" fill="${fill}"/></g></g>`;
    crowdLife += fan(topY, 1) + fan(botY, -1);
  }
  crowdLife += `</g>`;
  // M25: the band — a rowed block deep in the home stands, part of the
  // parallax crowd. It idles with a slow bob and PLAYS on a home roar
  // (instrument glint + bounce), riding the M23 reaction classes.
  let bandBlock = `<g class="wf-band">`;
  for (let i = 0; i < 16; i++) {
    const bbx = -8 + i % 8 * 2.2, bby = i < 8 ? 2 : 3.7;
    bandBlock += `<g transform="translate(${bbx.toFixed(1)},${bby.toFixed(1)})" class="wf-band-man" style="--wf-phase:${i % 5}"><rect class="wf-band-body" x="-.4" y="-.2" width=".8" height=".95" fill="${homeCrowd}"/><circle class="wf-band-head" cx="0" cy="-.52" r=".3"/><circle class="wf-band-horn" cx=".42" cy="-.24" r=".17"/></g>`;
  }
  bandBlock += `</g>`;
  // M23: the crowd band (pattern + ribbons + fans — nothing field-registered)
  // lives in one parallax group the boards translate by a fraction of the
  // camera pan. Benches, chains and yard-line-aligned pieces stay locked.
  let under = `<g class="wf-stadium-par"><rect x="${X_LEFT}" y="0" width="${X_RIGHT - X_LEFT}" height="${WATCH_SIDE.viewH}" fill="url(#wf-crowd)"/><rect x="${X_LEFT}" y="${(FT - 1.15).toFixed(1)}" width="${X_RIGHT - X_LEFT}" height=".58" class="wf-stadium-ribbon" fill="${homeCrowd}"/><rect x="${X_LEFT}" y="${(FB + .58).toFixed(1)}" width="${X_RIGHT - X_LEFT}" height=".58" class="wf-stadium-ribbon wf-stadium-ribbon-away" fill="${awayCrowd}"/>${crowdLife}${bandBlock}</g>`;
  let lines = "";
  if (fp != null) {
    const xOf = (abs) => watchSideFieldX(abs, fp);
    const gOwn = xOf(0), gFar = xOf(100);
    const gLeft = Math.min(gOwn, gFar), gRight = Math.max(gOwn, gFar);
    const grassX = gLeft - EZ, grassW = gRight - gLeft + 2 * EZ;
    under += `<rect x="${grassX.toFixed(1)}" y="${FT}" width="${grassW.toFixed(1)}" height="${FH}" class="wf-turf"/>`;
    for (let abs = 0; abs < 100; abs += 10) {
      const x0 = xOf(abs), x5 = xOf(abs + 5);
      under += `<rect x="${Math.min(x0, x5).toFixed(1)}" y="${FT}" width="${Math.abs(x5 - x0).toFixed(1)}" height="${FH}" class="wf-mow"/>`;
    }
    // Stadium identity is fixed to the screen, never to possession. The left
    // end zone belongs to the home team and the right to the visitor for every
    // renderer, including kickoffs, punts, tries and penalties.
    const homeC = board == null ? void 0 : board.homeFill;
    const awayC = board == null ? void 0 : board.awayFill;
    const homeN = board == null ? void 0 : board.homeName;
    const awayN = board == null ? void 0 : board.awayName;
    const ez = (xLeft, fill, name, rotation, owner) => {
      const cx = xLeft + EZ / 2, cy = FT + FH / 2;
      let s = `<g class="wf-endzone-group" data-wf-owner="${owner}"><rect x="${xLeft.toFixed(1)}" y="${FT}" width="${EZ.toFixed(1)}" height="${FH}" class="wf-endzone" fill="${fill}"/><rect x="${xLeft.toFixed(1)}" y="${FT}" width="${EZ.toFixed(1)}" height="${FH}" fill="url(#wf-ezchk)"/>`;
      if (name) {
        const txt = escapeHtml(String(name).toUpperCase());
        s += `<text x="${cx.toFixed(1)}" y="${(cy + 1.7).toFixed(1)}" class="wf-ez-lbl" transform="rotate(${rotation} ${cx.toFixed(1)} ${cy.toFixed(1)})"${txt.length > 9 ? ` textLength="${(FH - 6).toFixed(1)}" lengthAdjust="spacingAndGlyphs"` : ""}>${txt}</text>`;
      }
      return s + `</g>`;
    };
    under += ez(gLeft - EZ, homeC || "var(--team-1,#175b35)", homeN, -90, "home");
    under += ez(gRight, awayC || "#c23a35", awayN, 90, "away");
    under += `<rect x="${grassX.toFixed(1)}" y="${FT}" width="${grassW.toFixed(1)}" height="${FH}" fill="url(#wf-grain)"/>`;
    // M25: the worn middle — dirt blotches between the hashes, heavier as
    // the game ages (and in weather). One seeded stream, consumed at a fixed
    // rate per blotch, so a Q4 field is the Q1 field plus MORE wear — the
    // early blotches never move.
    {
      const qNow = ((p == null ? void 0 : p.half) === 2 ? 2 : 0) + (((p == null ? void 0 : p.clock) != null ? p.clock : 1800) > 900 ? 0 : 1);
      const wear = Math.min(1, (qNow + 1) / 4 * (wx && wx.kind !== "clear" ? 1.35 : 1));
      const hashFarW = watchSideY(31.4), hashNearW = watchSideY(66.6);
      const snowW = wx && wx.kind === "snow";
      let wearS = `<g class="wf-wear">`;
      const nBlotch = Math.round(8 + 16 * wear);
      for (let i = 0; i < nBlotch; i++) {
        const abs = 18 + (wxRnd() + wxRnd()) / 2 * 64;
        const bx = xOf(abs), by = hashFarW + wxRnd() * (hashNearW - hashFarW);
        const rx = 1.1 + wxRnd() * 1.7;
        wearS += `<ellipse cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${(rx * 0.42).toFixed(2)}" fill="${snowW ? "#eef2f6" : "#4a3a24"}" opacity="${((0.05 + wxRnd() * 0.06) * (0.5 + wear)).toFixed(3)}"/>`;
      }
      wearS += `</g>`;
      under += wearS;
      if (snowW) under += `<rect class="wf-snow-veil" x="${grassX.toFixed(1)}" y="${FT}" width="${grassW.toFixed(1)}" height="${FH}" fill="#eef2f6" opacity="${(0.07 + 0.13 * wear * wx.intensity).toFixed(3)}"/>`;
      else if (wx && wx.kind === "rain") under += `<rect class="wf-wet-sheen" x="${grassX.toFixed(1)}" y="${FT}" width="${grassW.toFixed(1)}" height="${FH}" fill="#08140c" opacity="${(0.1 * wx.intensity).toFixed(3)}"/>`;
    }
    lines += `<line x1="${grassX.toFixed(1)}" y1="${FT}" x2="${(gRight + EZ).toFixed(1)}" y2="${FT}" class="wf-side"/><line x1="${grassX.toFixed(1)}" y1="${FB}" x2="${(gRight + EZ).toFixed(1)}" y2="${FB}" class="wf-side"/><line x1="${grassX.toFixed(1)}" y1="${FT}" x2="${grassX.toFixed(1)}" y2="${FB}" class="wf-endline"/><line x1="${(gRight + EZ).toFixed(1)}" y1="${FT}" x2="${(gRight + EZ).toFixed(1)}" y2="${FB}" class="wf-endline"/>`;
    // M23: goalpost forks at both end lines (top-down: crossbar + gooseneck),
    // on every board — the FG board shakes the target fork on a make.
    const cyMid = FT + FH / 2;
    const post = (x, side) => {
      const st = side === "left" ? -1.7 : 1.7;
      return `<g class="wf-goalpost" data-wf-post="${side}" transform="translate(${x.toFixed(1)},${cyMid.toFixed(1)})"><line class="wf-post-bar" x1="0" y1="-4.4" x2="0" y2="4.4"/><line class="wf-post-stem" x1="0" y1="0" x2="${st}" y2="0"/><circle class="wf-post-pad" cx="${st}" cy="0" r=".55"/></g>`;
    };
    lines += post(grassX, "left") + post(gRight + EZ, "right");
    const hashFar = watchSideY(31.4), hashNear = watchSideY(66.6);
    for (let abs = 0; abs <= 100; abs++) {
      const x = xOf(abs);
      if (abs % 5 === 0) {
        const isGoal = abs === 0 || abs === 100;
        lines += `<line x1="${x.toFixed(1)}" y1="${FT}" x2="${x.toFixed(1)}" y2="${FB}" class="${isGoal ? "wf-goal" : "wf-yard"}"/>`;
        if (isGoal) {
          lines += `<rect x="${(x - 0.5).toFixed(1)}" y="${(FT - 0.4).toFixed(1)}" width="1" height="1" class="wf-pylon"/><rect x="${(x - 0.5).toFixed(1)}" y="${(FB - 0.6).toFixed(1)}" width="1" height="1" class="wf-pylon"/>`;
        } else if (abs % 10 === 0) {
          const num = abs <= 50 ? abs : 100 - abs;
          const fy = FT + 6, ny = FB - 2;
          lines += `<text x="${x.toFixed(1)}" y="${fy}" class="wf-num wf-num-side" transform="rotate(180 ${x.toFixed(1)} ${fy})">${num}</text><text x="${x.toFixed(1)}" y="${ny}" class="wf-num wf-num-side">${num}</text>`;
        }
      } else {
        lines += `<line x1="${(x - 0.7).toFixed(1)}" y1="${hashFar.toFixed(1)}" x2="${(x + 0.7).toFixed(1)}" y2="${hashFar.toFixed(1)}" class="wf-hash"/><line x1="${(x - 0.7).toFixed(1)}" y1="${hashNear.toFixed(1)}" x2="${(x + 0.7).toFixed(1)}" y2="${hashNear.toFixed(1)}" class="wf-hash"/>`;
      }
    }
    if (board && board.homeAbbr) {
      const mx = xOf(50), mark = escapeHtml(String(board.homeAbbr).slice(0, 3).toUpperCase());
      lines += `<g class="wf-midmark" transform="translate(${mx.toFixed(1)},${(FT + FH / 2).toFixed(1)})"><path d="M-4.8-5.6H4.8V1.1Q4.8 4.2 0 6.2Q-4.8 4.2-4.8 1.1Z" fill="${board.homeFill || "#24466f"}"/><path d="M-3.9-4.7H3.9V.8Q3.9 3.3 0 5Q-3.9 3.3-3.9.8Z" class="wf-midmark-in"/><text x="0" y="1.55">${mark}</text></g>`;
    }
    if (p.down && p.distance != null && fp + p.distance <= 100) {
      const firstX = xOf(fp + p.distance);
      lines += `<line x1="${firstX.toFixed(1)}" y1="${FT}" x2="${firstX.toFixed(1)}" y2="${FB}" class="wf-first" data-wf-first="${(fp + p.distance).toFixed(1)}"/>`;
      lines += `<g class="wf-chain-gang" transform="translate(${firstX.toFixed(1)},${(FB + 1.6).toFixed(1)})"><rect x="-0.5" y="0" width="1.0" height="3.2" class="wf-crew"/><circle cx="0" cy="-1.05" r="1.1" class="wf-chain-disc"/></g>`;
    }
    const sy = FB + 1.6;
    if (p.down) {
      lines += `<g class="wf-down-gang" transform="translate(31,${sy.toFixed(1)})"><rect x="-1.1" y="0" width="2.2" height="3.2" class="wf-crew"/><rect x="-1.7" y="-3.5" width="3.4" height="3.6" class="wf-downbox-card"/><text x="0" y="-0.75" class="wf-downbox-num" data-wf-down="${p.down}">${p.down}</text></g>`;
    }
    const bench = (screenA, fill, side) => {
      let s = "";
      for (let i = 0; i < 7; i++) {
        const bx2 = screenA + i * 2.6 * WATCH_SIDE.ypu * WATCH_SIDE.longitudinal, lift = i % 3 * 0.22;
        s += `<rect x="${(bx2 - 0.55).toFixed(1)}" y="${(sy + 0.5 - lift).toFixed(2)}" width="1.1" height="1.7" class="wf-bench-man wf-bench-${side}" fill="${fill}"/>`;
      }
      return s;
    };
    const yardScale = WATCH_SIDE.ypu * WATCH_SIDE.longitudinal;
    under += bench(gLeft + 22 * yardScale, homeC || "#8a94a8", "home") + bench(gLeft + 60 * yardScale, awayC || "#8a94a8", "away");
    // M25: one mascot per sideline, field-locked beside his bench. Idles
    // with a bob; goes wild on his side's roar (the bench-men precedent).
    const mascot = (mx, fill, hi, side) => `<g class="wf-mascot wf-mascot-${side}" transform="translate(${mx.toFixed(1)},${(sy + 0.4).toFixed(1)})"><rect class="wf-mascot-body" x="-.75" y="-.4" width="1.5" height="2.1" fill="${fill}"/><circle class="wf-mascot-head" cx="0" cy="-1.05" r=".62" fill="${hi}"/><rect class="wf-mascot-ear" x="-.55" y="-1.85" width=".35" height=".55" fill="${fill}"/><rect class="wf-mascot-ear" x=".2" y="-1.85" width=".35" height=".55" fill="${fill}"/></g>`;
    under += mascot(gLeft + 16 * yardScale, homeC || "#8a94a8", board && board.homeHi || "#f4f0d8", "home") + mascot(gLeft + 66 * yardScale, awayC || "#8a94a8", board && board.awayHi || "#f4f0d8", "away");
  } else {
    under += `<rect x="${X_LEFT}" y="${FT}" width="${X_RIGHT - X_LEFT}" height="${FH}" class="wf-turf"/>`;
    for (let x = X_LEFT; x < X_RIGHT; x += 14) under += `<rect x="${x}" y="${FT}" width="7" height="${FH}" class="wf-mow"/>`;
    under += `<rect x="${X_LEFT}" y="${FT}" width="${X_RIGHT - X_LEFT}" height="${FH}" fill="url(#wf-grain)"/>`;
    for (let x = X_LEFT; x <= X_RIGHT; x += 11.475) lines += `<line x1="${x.toFixed(1)}" y1="${FT}" x2="${x.toFixed(1)}" y2="${FB}" class="wf-yard"/>`;
    lines += `<line x1="${X_LEFT}" y1="${FT}" x2="${X_RIGHT}" y2="${FT}" class="wf-side"/><line x1="${X_LEFT}" y1="${FB}" x2="${X_RIGHT}" y2="${FB}" class="wf-side"/>`;
  }
  const dirPath = _watchSideDir > 0 ? "M-2.3 0H2.3M.8-1.35L2.4 0 .8 1.35" : "M2.3 0H-2.3M-.8-1.35L-2.4 0-.8 1.35";
  // M25: precipitation — a fixed set of CSS-looped drops/flakes spanning the
  // whole world width (no per-frame JS; the camera pans inside the sheet).
  // The group is ALWAYS present with a lawful kind so structure checks never
  // depend on the sky; clear games just carry an empty group.
  let wxLayer = `<g class="wf-weather" data-wf-weather="${wx ? wx.kind : "clear"}">`;
  if (wx && wx.kind === "rain") {
    const nD = Math.round(34 + 22 * wx.intensity);
    for (let i = 0; i < nD; i++) {
      const dx2 = X_LEFT + wxRnd() * (X_RIGHT - X_LEFT), dur = (0.55 + wxRnd() * 0.5).toFixed(2), dl = (wxRnd() * 1.8).toFixed(2);
      wxLayer += `<rect class="wf-rain-drop" x="${dx2.toFixed(1)}" y="-3" width="0.14" height="2.1" style="--wx-dur:${dur}s;--wx-delay:-${dl}s"/>`;
    }
  } else if (wx && wx.kind === "snow") {
    const nF = Math.round(26 + 20 * wx.intensity);
    for (let i = 0; i < nF; i++) {
      const dx2 = X_LEFT + wxRnd() * (X_RIGHT - X_LEFT), dur = (3.2 + wxRnd() * 2.6).toFixed(2), dl = (wxRnd() * 4).toFixed(2), sw = (0.8 + wxRnd() * 1.4).toFixed(2);
      wxLayer += `<circle class="wf-snow-flake" cx="${dx2.toFixed(1)}" cy="-2" r="${(0.2 + wxRnd() * 0.16).toFixed(2)}" style="--wx-dur:${dur}s;--wx-delay:-${dl}s;--wx-sway:${sw}px"/>`;
    }
  }
  wxLayer += `</g>`;
  const side = under + lines + `<line x1="31" y1="${FT}" x2="31" y2="${FB}" class="wf-los" data-wf-los="${fp == null ? "" : fp}"/><g class="wf-drive-direction" data-wf-direction="${_watchSideDir > 0 ? "right" : "left"}" transform="translate(31 ${(FT + 2.25).toFixed(1)})"><path d="${dirPath}"/></g>` + wxLayer;
  return defs + `<g class="wf-side-camera" data-watch-camera-layer="side">${side}</g>` + watchCoachFieldBase(p, board) + watchEndzoneFieldBase(p, board);
}
function watchTick(immediate = false) {
  const w = _watch;
  if (!w) return;
  try {
    watchTickBody(w, immediate);
  } catch (err) {
    console.error("[watch] tick failed \u2014 recovering the live flow", err);
    watchStop();
    const fn = w.onFinish;
    _watch = null;
    if (fn) fn();
  }
}
function watchPreSnapLine(p, d) {
  const ord = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th" };
  const dd = p.down ? `${ord[p.down] || p.down} & ${p.distance != null ? p.distance : 10}` : "";
  const t = String(p.type || "");
  let action = "";
  if (p.optionPhase === "jet") action = "jet motion\u2026";
  else if (p.isScramble) action = "the pocket breaks down\u2026";
  else if (t.startsWith("pass")) action = p.playAction ? "play-action, dropping back\u2026" : "back to pass\u2026";
  else if (t.startsWith("run")) action = p.concept ? `${p.concept}\u2026` : "the handoff\u2026";
  else action = "the snap\u2026";
  const form = p.offFormation ? `${p.offFormation} \u2014 ` : "";
  return `${dd ? dd + " \xB7 " : ""}${form}${action}`;
}
function watchClipName(w, p) {
  const names = w.r.playerNames || {};
  const featured = watchFeaturedMan(p);
  const who = featured && names[featured.id] && names[featured.id].name;
  if (p.td) return who ? `${who} touchdown` : "Touchdown";
  if (p.turnover && p.turnoverType === "interception") return who ? `${who} interception` : "Interception";
  if (p.sack) return who ? `${who} sack` : "Sack";
  if (who) return `${who} · ${p.yards || 0} yards`;
  return `${p.concept || p.type || "Play"} · ${p.yards || 0} yards`;
}
function watchSaveActiveClip(w) {
  const p = w && w.activePlay;
  const d = w && w.activeDrive;
  if (!p || !d) {
    notify("Pause on a play before saving a clip", "info");
    return null;
  }
  const anim = _watchAnim || {};
  const data = w.clip ? watchClone(w.clip) : buildReplayClipData(w.r, d, p, { driveIndex: w.activeDriveIndex || 0, playIndex: w.activePlayIndex || 0, board: w.activeBoard || null });
  data.camera = normalizeWatchCamera(anim.cameraMode);
  data.annotations = Array.isArray(anim.annotations) ? watchClone(anim.annotations) : data.annotations || [];
  data.capturedAt = Date.now();
  const home = (w.r.homeSchool && (w.r.homeSchool.abbr || w.r.homeSchool.name)) || "HOME";
  const away = (w.r.awaySchool && (w.r.awaySchool.abbr || w.r.awaySchool.name)) || "AWAY";
  const result = saveReplay(watchClipName(w, p), data, {
    info: { matchup: `${away} @ ${home}`, score: `${w.r.awayScore || 0}–${w.r.homeScore || 0}`, week: p.half ? `${p.half === 1 ? "1st" : "2nd"} half` : "Replay" }
  });
  if (result.ok) {
    // [2026-08-16 fix] Only refresh w.clip when this session IS clip playback
    // (the replay screen re-saving with new camera/telestrator data). In a
    // LIVE watch, latching the first save here made line 6809's w.clip branch
    // hijack every LATER save — Save Clip on a 4th-quarter touchdown silently
    // re-saved the first quarter's clip, for the whole rest of the game (the
    // Act B probe's "frozen scrub" red was this: it kept re-saving a dead-ball
    // penalty clip).
    if (w.clip) w.clip = data;
    notify("Saved to Film Room", "success");
  } else notify(result.reason === "full" ? "Film Room is full" : "Replay could not be saved", "warning");
  return result;
}
function watchDownloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
let _watchExportCss = null;
function watchCssText() {
  if (_watchExportCss != null) return _watchExportCss;
  let css = "";
  for (const sheet of Array.from(document.styleSheets || [])) {
    try {
      css += Array.from(sheet.cssRules || []).map((r) => r.cssText).filter((s) => /(?:watch-|wp-|wf-|wsp-|wab-|wo-|wd-|svg)/.test(s)).join("\n");
    } catch (e) {
    }
  }
  _watchExportCss = css;
  return _watchExportCss;
}
function watchSerializedStill(svg, annotations = []) {
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = watchCssText();
  clone.insertBefore(style, clone.firstChild);
  if (annotations.length) {
    const ink = document.createElementNS("http://www.w3.org/2000/svg", "g");
    ink.setAttribute("class", "watch-export-ink");
    for (const stroke of annotations) {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      line.setAttribute("points", (stroke.points || []).map((pt) => `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`).join(" "));
      line.setAttribute("fill", "none");
      line.setAttribute("stroke", stroke.color || "#ffd54a");
      line.setAttribute("stroke-width", "0.8");
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("stroke-linejoin", "round");
      ink.appendChild(line);
    }
    clone.appendChild(ink);
  }
  return new XMLSerializer().serializeToString(clone);
}
async function watchDrawSvgFrame(svg, annotations, canvas) {
  const xml = watchSerializedStill(svg, annotations);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function watchExportVideo(controller, svg) {
  if (!controller || !svg || typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
    notify("Short-video export is not supported by this browser", "warning");
    return false;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 540;
  const stream = canvas.captureStream(8);
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3500000 });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const done = new Promise((resolve) => { recorder.onstop = resolve; });
  const was = { t: controller.t, paused: controller.paused, rate: controller.rate };
  controller.paused = true;
  controller.exporting = true;
  recorder.start(250);
  const fps = 8;
  const wallStep = 1000 / fps;
  const playStep = Math.max(1, controller.duration / 7) / fps;
  try {
    for (let t = 0; t <= controller.duration + 0.001; t += playStep) {
      controller.seek(Math.min(controller.duration, t));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await watchDrawSvgFrame(svg, controller.annotations, canvas);
      await new Promise((resolve) => setTimeout(resolve, wallStep));
    }
  } finally {
    recorder.stop();
    await done;
    for (const track of stream.getTracks()) track.stop();
    controller.exporting = false;
    controller.rate = was.rate;
    controller.paused = was.paused;
    controller.seek(was.t);
  }
  if (!chunks.length) {
    notify("The browser did not produce a video", "warning");
    return false;
  }
  watchDownloadBlob(new Blob(chunks, { type: mime }), `blueprint-replay-${Date.now()}.webm`);
  notify("Short replay video exported", "success");
  return true;
}
function watchEventFlash(label, kind = "moment", ms = 1100, speed = 1) {
  const f = document.getElementById("watch-flash");
  if (!f) return;
  if (f._watchFlashTimer) clearTimeout(f._watchFlashTimer);
  f.textContent = label;
  f.dataset.event = kind;
  f.classList.remove("on");
  void f.offsetWidth;
  f.classList.add("on");
  f._watchFlashTimer = setTimeout(() => {
    f.classList.remove("on");
    f._watchFlashTimer = null;
  }, ms / Math.max(0.2, speed || 1));
}
function watchTickBody(w, immediate = false) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
  if (!document.getElementById("watch-board")) {
    watchStop();
    return;
  }
  if (!w.paused) stadiumStart(0.2);
  if (w.revealTimer) {
    clearTimeout(w.revealTimer);
    w.revealTimer = null;
  }
  const names = w.r.playerNames || {};
  const item = w.seq[Math.min(w.idx, w.seq.length - 1)];
  const ticker = document.getElementById("watch-ticker");
  const baseMs = 4200 / w.speed;
  let holdMs = baseMs;
  if (item.kind === "drive") {
    const driveSchool = item.d.possession === "home" ? w.r.homeSchool : w.r.awaySchool;
    const team = ((_a = driveSchool) == null ? void 0 : _a.name) || "";
    ticker.innerHTML = `<span class="wt-drive">${item.d.possession === "home" ? "\u25B6" : "\u25C0"} ${escapeHtml(team)} ball.</span>`;
    watchBug((_b = item.d.plays) == null ? void 0 : _b[0], item.d);
    watchBoard(null);
    stadiumStart(0.16);
    watchEventFlash(`${String((driveSchool == null ? void 0 : driveSchool.abbr) || team).slice(0, 12).toUpperCase()} BALL`, "drive", 760, w.speed);
    holdMs = baseMs * 0.6;
  } else if (item.kind === "play") {
    const p = item.p;
    w.activePlay = p;
    w.activeDrive = item.d;
    w.activeDriveIndex = item.di || 0;
    w.activePlayIndex = (item.d.plays || []).indexOf(p);
    watchBug(p, item.d);
    stadiumStart(p.down >= 3 ? 0.42 : p.fieldPos >= 80 ? 0.34 : 0.22);
    const boardPalette = watchBoardColors(w, item.d);
    w.activeBoard = boardPalette;
    const scriptDur = watchBoard(p, baseMs, boardPalette, w.clip ? w.clip.reel ? { replay: true } : { replay: true, interactive: true, clip: w.clip } : {});
    const desc = describePlay(p, names);
    const film = buildBroadcastCommentary(p, names);
    const analysis = document.getElementById("watch-analysis");
    if (analysis) analysis.innerHTML = `<span>${escapeHtml(film.kicker)}</span><b>${escapeHtml(film.title)}</b><small>${escapeHtml(film.detail)}</small>`;
    let extra = "";
    if (p.coverage && String(p.type || "").startsWith("pass") && !p.sack) {
      const cpt = p.concept ? `${p.concept}${p.audible ? " (audible)" : ""} ` : "";
      const show = p.shownCoverage ? p.fooled ? ` \u2014 bit on ${p.shownCoverage.replace("Cover ", "")}` : ` (showed ${p.shownCoverage.replace("Cover ", "")})` : "";
      let blame = "";
      if (p.complete && ((_c = p.yards) != null ? _c : 0) >= 15 && p.beatenDefId && ((_d = names[p.beatenDefId]) == null ? void 0 : _d.name)) {
        blame = p.covJob ? ` \u2014 beat ${names[p.beatenDefId].name} in the ${p.covJob}` : ` \u2014 beat ${names[p.beatenDefId].name}`;
      }
      extra = `<span class="pbp-cov">\xB7 ${cpt}vs ${p.coverage}${show}${blame}</span>`;
    } else if (p.concept && String(p.type || "").startsWith("run") && !p.optionPhase) {
      const gap = p.runGap && ((_e = p.yards) != null ? _e : 0) <= 0 && !p.isScramble ? ` \u2014 stuffed in the ${p.runGap}` : "";
      extra = `<span class="pbp-cov">\xB7 ${p.killCall === "toRun" ? "checked: " : ""}${p.concept}${gap}</span>`;
    }
    const yds = p.yards || 0;
    let tempo = 1;
    if (p.td || p.turnover) tempo = 1.4;
    else if (yds >= 20 || p.sack) tempo = 1.15;
    else if (!p.complete && String(p.type || "").startsWith("pass")) tempo = 0.58;
    else if (yds <= 3) tempo = 0.7;
    holdMs = baseMs * tempo;
    if (scriptDur) holdMs = Math.max(holdMs, scriptDur * 1e3 / (w.speed * (w.clip && w.clip.reel ? 0.68 : 1)) + 1200);
    // Stage 5: the ticker names the LOOK the book fielded, not just the base
    // formation ("[Spread · Trips v 4-3]").
    const formTag = p.offFormation && p.type !== "penalty" ? `<span class="pbp-form">[${escapeHtml(watchLookLabel(p) || p.offFormation)}${p.defFront ? " v " + escapeHtml(p.defFront) : ""}]</span> ` : "";
    const fakeTag = p.stFake ? `<span class="wa-td">FAKE! </span>` : "";
    const patchScore = () => {
      var _a2;
      let np = null, nd = null;
      for (let i = w.idx + 1; i < w.seq.length; i++) {
        const it = w.seq[i];
        if (it.kind === "play" && ((_a2 = it.p) == null ? void 0 : _a2.scoreOff) != null) {
          np = it.p;
          nd = it.d;
          break;
        }
      }
      const hs2 = np ? nd.possession === "home" ? np.scoreOff : np.scoreDef : w.r.homeScore;
      const as2 = np ? nd.possession === "home" ? np.scoreDef : np.scoreOff : w.r.awayScore;
      const bug = document.getElementById("watch-bug");
      if (!bug) return;
      const sc2 = bug.querySelectorAll(".wsb-score");
      if (sc2[0]) sc2[0].textContent = hs2;
      if (sc2[1]) sc2[1].textContent = as2;
    };
    const reveal = () => {
      ticker.innerHTML = `${fakeTag}${formTag}${desc.text} ${extra}`;
      patchScore();
      if (p.td) {
        watchEventFlash(p.turnover ? p.turnoverType === "interception" ? "PICK SIX" : "DEFENSIVE TD" : "TOUCHDOWN", "touchdown", 1450, w.speed);
        stadiumReact("touchdown");
      } else if (p.turnover) {
        watchBugPossession(item.d.possession === "home" ? "away" : "home");
        watchEventFlash(p.turnoverType === "interception" ? "INTERCEPTED" : "FUMBLE!", "turnover", 1250, w.speed);
        stadiumReact("turnover");
      } else if (p.type === "fg" && p.made) {
        watchEventFlash("FIELD GOAL", "fieldgoal", 1100, w.speed);
        stadiumReact("fieldgoal");
      } else if (p.safety) {
        watchEventFlash("SAFETY", "turnover", 1300, w.speed);
        stadiumReact("turnover");
      } else if (p.sack) {
        watchEventFlash("SACK", "sack", 850, w.speed);
        stadiumReact("sack");
      } else if (p.down >= 3 && p.distance != null && (p.yards || 0) >= p.distance) {
        watchEventFlash("FIRST DOWN", "firstdown", 760, w.speed);
        stadiumReact("firstdown");
      }
      if (p.type === "punt" && !p.stFake || p.type === "fg" && !p.made) {
        watchBugPossession(item.d.possession === "home" ? "away" : "home");
      }
      // M25: the featured man gets his lower third — name, position, the
      // on-screen jersey when the slot translated, and his day so far.
      const feat = watchFeaturedMan(p);
      const fEntry = feat && names[feat.id];
      if (fEntry && boardPalette) {
        const offHome = item.d.possession !== "away";
        const featHome = feat.def ? !offHome : offHome;
        const jersey = watchJerseyOf(feat.slot);
        const line = watchGameLine(w, w.idx, feat.id);
        watchShowLower(feat.role, `${jersey ? "#" + jersey + " " : ""}${fEntry.name} \xB7 ${fEntry.pos}`, line, featHome ? boardPalette.homeFill : boardPalette.awayFill);
      }
    };
    if (w.revealTimer) {
      clearTimeout(w.revealTimer);
      w.revealTimer = null;
    }
    if (scriptDur && scriptDur > 0.2) {
      ticker.innerHTML = `<span class="wt-develop">${escapeHtml(watchPreSnapLine(p, item.d))}</span>`;
      const revealMs = Math.max(250, scriptDur * 1e3 / w.speed - 260);
      w.revealTimer = setTimeout(reveal, revealMs);
    } else {
      reveal();
    }
    // M4 Presentation: Low keeps only the biggest moments (scores + turnovers).
    const _rf = watchReplayFreq();
    const replayWorthy = !!scriptDur && (_rf === "low" ? !!(p.td || p.turnover) : !!(p.td || p.turnover || p.sack || p.blocked || p.contested || p.brokenByCarrier || Math.abs(yds) >= 25));
    if (replayWorthy && !w.paused && !w.clip && _rf !== "off") {
      const liveWallMs = scriptDur * 1e3 / w.speed;
      const replayWallMs = scriptDur * 1e3 / (w.speed * 0.68);
      holdMs = Math.max(holdMs, liveWallMs + replayWallMs + 1050);
      w.replayTimer = setTimeout(() => {
        if (_watch !== w || !document.getElementById("watch-board")) return;
        ticker.innerHTML = `<span class="wt-replay">INSTANT REPLAY</span> ${desc.text}`;
        watchBoard(p, baseMs, boardPalette, { replay: true });
      }, liveWallMs + 320);
    }
  } else if (item.kind === "result") {
    const team = ((_f = item.d.possession === "home" ? w.r.homeSchool : w.r.awaySchool) == null ? void 0 : _f.name) || "";
    ticker.innerHTML = `<span class="wt-result">${escapeHtml(team)}: ${formatDriveResult(item.d)}${item.d.points > 0 ? ` (+${item.d.points})` : ""}</span>`;
    holdMs = baseMs * 0.8;
    // M25: the drive-summary lower third — plays, yards, clock consumed.
    const dPlays = item.d.plays || [];
    if (dPlays.length) {
      const dy = dPlays.reduce((n, pl) => n + (pl.yards || 0), 0);
      const c0 = dPlays[0].clock, c1 = dPlays[dPlays.length - 1].clock;
      const secs = dPlays[0].half === dPlays[dPlays.length - 1].half && c0 != null && c1 != null ? Math.max(0, c0 - c1) : null;
      const top = secs != null ? ` \xB7 ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}` : "";
      const bp2 = watchBoardColors(w, item.d);
      watchShowLower("DRIVE", `${team}: ${formatDriveResult(item.d)}`, `${dPlays.length} PLAY${dPlays.length > 1 ? "S" : ""} \xB7 ${dy} YDS${top}`, item.d.possession === "home" ? bp2 && bp2.homeFill : bp2 && bp2.awayFill, 3400);
    }
  } else {
    const trueEnd = !w.onFinish || ((_g = state.ui.liveWatch) == null ? void 0 : _g.stage) === "final";
    if (trueEnd) {
      watchBug(null, {});
    } else {
      let lp = null, ld = null;
      for (let i = w.seq.length - 1; i >= 0; i--) {
        if (w.seq[i].kind === "play") {
          lp = w.seq[i].p;
          ld = w.seq[i].d;
          break;
        }
      }
      watchBug(lp, ld || {});
    }
    watchBoard(null);
    if (w.onFinish) {
      var _lw = state.ui.liveWatch;
      const isCallStage = (_lw == null ? void 0 : _lw.stage) === "call" && !state.ui.autoRun;
      if (isCallStage) {
        ticker.innerHTML = `<span class="wt-final">${w.liveLabel || ""}</span>`;
        const fn = w.onFinish;
        w.revealTimer = setTimeout(() => {
          watchStop();
          _watch = null;
          fn();
        }, Math.max(650, baseMs * 0.5));
      } else {
        ticker.innerHTML = `<span class="wt-final">${w.liveLabel || "That\u2019s the half."}</span>
        <button class="btn-primary watch-continue" id="watch-continue">Continue \u2192</button>`;
        (_h = document.getElementById("watch-continue")) == null ? void 0 : _h.addEventListener("click", () => {
          const fn = w.onFinish;
          watchStop();
          _watch = null;
          fn();
        });
      }
    } else {
      ticker.innerHTML = `<span class="wt-final">FINAL \u2014 ${escapeHtml(((_i = w.r.homeSchool) == null ? void 0 : _i.name) || "")} ${w.r.homeScore}, ${escapeHtml(((_j = w.r.awaySchool) == null ? void 0 : _j.name) || "")} ${w.r.awayScore}</span>`;
    }
    watchDriveChart();
    const prog2 = document.getElementById("watch-progress");
    if (prog2) prog2.textContent = w.onFinish ? "" : "replay over \u2014 click a drive to rewatch";
    return;
  }
  watchDriveChart();
  const prog = document.getElementById("watch-progress");
  if (prog) {
    const playCount = w.seq.filter((s) => s.kind === "play").length;
    const done = w.seq.slice(0, w.idx + 1).filter((s) => s.kind === "play").length;
    prog.textContent = `play ${done}/${playCount}`;
  }
  if (w.paused && !immediate) return;
  w.idx = Math.min(w.idx + 1, w.seq.length - 1);
  if (!w.paused) w.timer = setTimeout(() => watchTick(), holdMs);
}

export { init };
