import { __spreadProps, __spreadValues } from '../../_spread.js';
import { C } from '../../constants.js';
import { designateRival, getRivalCandidates, injectRivalryIntoSchedule, swapNonConfOpponent } from '../../engine/offseason.js';
import { scheduleGuarantee } from '../../engine/portal.js';
import { weekLabel } from '../../engine/season.js';
import { CONFERENCES } from '../../engine/world.js';
import { getPlayerSchool, navigate, notify, rerender, state } from '../../state.js';
import { escapeHtml } from '../../utils.js';

var NC_DAYS = [5, 6, 7, 8];
function slotLabel(day) {
  return `${weekLabel(day)} Non-Conf`;
}
function prestigePips(p, max = 5) {
  const filled = Math.min(Math.round(p), max);
  return "\u25CF".repeat(filled) + "\u25CB".repeat(max - filled);
}
function isPreseasonMode() {
  return state.day <= 4 && !state.offseason;
}
function getChoiceForDay(day) {
  if (isPreseasonMode()) {
    const me = getPlayerSchool();
    const g = (state.schedule || []).find((x) => x.day === day && !x.result && (x.homeId === (me == null ? void 0 : me.id) || x.awayId === (me == null ? void 0 : me.id)));
    return g ? { day, homeId: g.homeId, awayId: g.awayId } : null;
  }
  return (state.pendingNonConfChoices || []).find((g) => g.day === day);
}
function getSchoolById(id) {
  var _a;
  return (_a = state.world) == null ? void 0 : _a.schools.find((s) => s.id === id);
}
function recordLabel(school) {
  const r = school.record;
  if (!r) return "";
  return `${r.wins}-${r.losses}`;
}
function candidateOpponents(excludeDay = null) {
  var _a;
  const school = getPlayerSchool();
  if (!school) return [];
  const locked = /* @__PURE__ */ new Set();
  if (isPreseasonMode()) {
    for (const day of NC_DAYS) {
      if (day === excludeDay) continue;
      const g = getChoiceForDay(day);
      if (g) {
        locked.add(g.homeId);
        locked.add(g.awayId);
      }
    }
  } else {
    for (const g of state.pendingNonConfChoices || []) {
      if (g.day !== excludeDay) {
        locked.add(g.homeId);
        locked.add(g.awayId);
      }
    }
  }
  return (((_a = state.world) == null ? void 0 : _a.schools) || []).filter((s) => s.id !== school.id && s.conf !== school.conf && s.division === school.division && !locked.has(s.id)).sort((a, b) => b.prestige - a.prestige || a.name.localeCompare(b.name));
}
function renderScheduling() {
  var _a, _b;
  const school = getPlayerSchool();
  if (!school) return '<p class="empty-state">No active game.</p>';
  const choices = state.pendingNonConfChoices || [];
  const pickerDay = (_b = (_a = state.ui.params) == null ? void 0 : _a.schedulingPickerDay) != null ? _b : null;
  const pre = isPreseasonMode();
  let rivalryBlock = "";
  if (!state.rivalry) {
    const cands = getRivalCandidates(state);
    rivalryBlock = `
    <div class="card" style="margin-bottom:10px">
      <div class="card-header"><span class="card-title">DECLARE A RIVAL</span></div>
      <div style="padding:8px 12px">
        ${cands.map((c) => `
          <div class="offseason-item" style="align-items:center">
            <span class="offseason-label">${escapeHtml(c.school.name)}</span>
            <span class="offseason-detail">${c.miles} mi \xB7 ${c.school.prestige}\u2605</span>
            <button class="btn-ghost btn-sm sched-rival-btn" data-rival-id="${c.school.id}">Declare</button>
          </div>`).join("")}
        <p class="scheduling-hint" style="margin:6px 0 2px">An annual trophy game on ${weekLabel(C.RIVALRY_DAY)}${pre ? " \u2014 declared now, it joins this season\u2019s slate" : ""}.</p>
      </div>
    </div>`;
  }
  return `
  <div class="scheduling-view">
    ${rivalryBlock}
    <div class="scheduling-header">
      <h2 class="scheduling-title">Non-Conference Schedule</h2>
      <p class="scheduling-sub">
        Choose up to ${C.NONCONF_GAMES} non-conference opponents for next season.
        Scheduling <b>down</b> pays the opponent a guarantee; scheduling <b>up</b> earns you one.
        It lands on next season's budget. Any unfilled slots auto-schedule at season start.
      </p>
      ${(() => {
    const g = state.playerCoach && state.playerCoach.pendingScheduleGuarantee || 0;
    if (!g) return "";
    const cls = g > 0 ? "sched-gtee-earn" : "sched-gtee-pay";
    return `<p class="scheduling-sub sched-gtee-total"><span class="sched-gtee ${cls}">${g > 0 ? "+" : "\u2212"}$${Math.abs(g).toLocaleString()}</span> to next season's budget from your current slate</p>`;
  })()}
    </div>

    <div class="scheduling-slots">
      ${NC_DAYS.map((day) => renderSlot(day, school, choices, pickerDay)).join("")}
    </div>

    ${pickerDay !== null ? renderPicker(pickerDay, school) : ""}

    <div class="scheduling-actions">
      ${pre ? "" : '<button class="btn-ghost" id="btn-sched-clear-all">Clear All</button>'}
      <button class="btn-primary" id="btn-sched-confirm">
        Lock Schedule &amp; Return \u2192
      </button>
    </div>

    <p class="scheduling-hint">
      ${pre ? "Editing this season\u2019s slate: changes are opponent swaps, so every program keeps a full schedule. Own division only." : "Non-conference opponents come from your own division \u2014 any conference, any prestige. AI opponents will fill any remaining non-conf slots at season start."}
    </p>
  </div>
`;
}
function renderSlot(day, school, choices, pickerDay) {
  var _a, _b;
  if (state.rivalry && day === C.RIVALRY_DAY) {
    const riv = state.rivalry;
    return `
    <div class="sched-slot sched-slot-locked">
      <div class="sched-slot-day">${weekLabel(day)}</div>
      <div class="sched-slot-body">
        <div class="sched-slot-name">Rivalry: ${escapeHtml(riv.schoolName)}</div>
        <div class="sched-slot-detail muted">${escapeHtml(riv.trophy)} \xB7 reserved, venues alternate</div>
      </div>
    </div>`;
  }
  const choice = getChoiceForDay(day);
  const opp = choice ? getSchoolById(choice.awayId === school.id ? choice.homeId : choice.awayId) : null;
  const isHome = choice ? choice.homeId === school.id : null;
  const open = pickerDay === day;
  return `
  <div class="sched-slot${open ? " sched-slot-open" : ""}">
    <div class="sched-slot-label">${slotLabel(day)}</div>
    ${opp ? `
      <div class="sched-slot-filled">
        <div class="sched-opp-info">
          <span class="sched-opp-name">${escapeHtml(opp.name)}</span>
          <span class="sched-opp-detail">
            ${escapeHtml(((_a = CONFERENCES[opp.conf]) == null ? void 0 : _a.name) || opp.conf)} \xB7
            ${opp.division} \xB7
            ${prestigePips(opp.prestige, ((_b = C.PRESTIGE_MAX) == null ? void 0 : _b[opp.division]) || 5)} \xB7
            ${isHome ? "\u{1F3E0} Home" : "\u2708 Away"}
          </span>
        </div>
        ${isPreseasonMode() ? `<button class="btn-ghost btn-sched-pick" data-sched-day="${day}">Change</button>` : `<button class="btn-ghost btn-sched-clear" data-sched-day="${day}">\u2715 Clear</button>`}
      </div>
    ` : `
      <button class="btn-ghost btn-sched-pick" data-sched-day="${day}">
        + Pick Opponent
      </button>
    `}
  </div>
`;
}
function renderPicker(day, school) {
  const opponents = candidateOpponents(day);
  return `
  <div class="sched-picker">
    <div class="sched-picker-header">
      <span>Choose opponent for ${slotLabel(day)}</span>
      <button class="btn-ghost" id="btn-sched-picker-close">\u2715</button>
    </div>
    <input class="sched-search" id="sched-search" type="text" placeholder="Search school\u2026" autocomplete="off" />
    <div class="sched-picker-list" id="sched-picker-list">
      ${renderPickerList(opponents, day, school)}
    </div>
  </div>
`;
}
function renderPickerList(opponents, day, school, filter = "") {
  const filtered = filter ? opponents.filter((s) => {
    var _a;
    return s.name.toLowerCase().includes(filter.toLowerCase()) || (((_a = CONFERENCES[s.conf]) == null ? void 0 : _a.name) || "").toLowerCase().includes(filter.toLowerCase());
  }) : opponents;
  if (filtered.length === 0) return '<p class="empty-state">No matching schools.</p>';
  return filtered.slice(0, 60).map((opp) => {
    var _a;
    const conf = CONFERENCES[opp.conf];
    const maxPips = ((_a = C.PRESTIGE_MAX) == null ? void 0 : _a[opp.division]) || 5;
    const crossDiv = opp.division !== school.division;
    const gtee = scheduleGuarantee(school, opp);
    const gTag = gtee > 0 ? `<span class="sched-gtee sched-gtee-earn" title="You get paid to play up">+$${gtee.toLocaleString()}</span>` : gtee < 0 ? `<span class="sched-gtee sched-gtee-pay" title="Guarantee you pay to play down">\u2212$${Math.abs(gtee).toLocaleString()}</span>` : `<span class="sched-gtee sched-gtee-free" title="Even matchup \u2014 no guarantee">FREE</span>`;
    return `
    <div class="sched-pick-row" data-pick-id="${opp.id}" data-pick-day="${day}" data-pick-home="1">
      <div class="sched-pick-main">
        <span class="sched-pick-name">${escapeHtml(opp.name)}</span>
        ${crossDiv ? `<span class="sched-pick-badge sched-badge-crossdiv">${opp.division}</span>` : ""}
      </div>
      <div class="sched-pick-meta">
        <span class="sched-pick-conf">${escapeHtml((conf == null ? void 0 : conf.name) || opp.conf)}</span>
        <span class="sched-pick-pips">${prestigePips(opp.prestige, maxPips)}</span>
        ${gTag}
        <span class="sched-pick-record">${recordLabel(opp)}</span>
      </div>
      <div class="sched-pick-ha">
        <button class="btn-tiny btn-pick-home" data-pick-id="${opp.id}" data-pick-day="${day}" data-pick-home="1">Home</button>
        <button class="btn-tiny btn-pick-away" data-pick-id="${opp.id}" data-pick-day="${day}" data-pick-home="0">Away</button>
      </div>
    </div>
  `;
  }).join("");
}
function setupListeners5() {
  var _a, _b, _c;
  const school = getPlayerSchool();
  if (!school) return;
  document.querySelectorAll(".btn-sched-pick").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.ui.params = __spreadProps(__spreadValues({}, state.ui.params), { schedulingPickerDay: Number(btn.dataset.schedDay) });
      rerender();
    });
  });
  document.querySelectorAll(".btn-sched-clear").forEach((btn) => {
    btn.addEventListener("click", () => {
      const day = Number(btn.dataset.schedDay);
      state.pendingNonConfChoices = (state.pendingNonConfChoices || []).filter((g) => g.day !== day);
      recomputeScheduleGuarantee();
      state.ui.params = __spreadProps(__spreadValues({}, state.ui.params), { schedulingPickerDay: null });
      rerender();
    });
  });
  document.querySelectorAll(".sched-rival-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const res = designateRival(state, btn.dataset.rivalId);
      if (!res.ok) {
        notify(res.reason, "warning");
        return;
      }
      let msg = `Rivalry declared: ${res.rivalry.trophy} vs ${res.rivalry.schoolName}.`;
      if (isPreseasonMode()) {
        const inj = injectRivalryIntoSchedule(state);
        msg += inj.ok ? ` The trophy game is on this season's slate (${weekLabel(inj.day)}).` : ` ${inj.reason}.`;
      }
      notify(msg, "success");
      rerender();
    });
  });
  (_a = document.getElementById("btn-sched-picker-close")) == null ? void 0 : _a.addEventListener("click", () => {
    state.ui.params = __spreadProps(__spreadValues({}, state.ui.params), { schedulingPickerDay: null });
    rerender();
  });
  document.querySelectorAll(".btn-pick-home, .btn-pick-away").forEach((btn) => {
    btn.addEventListener("click", () => {
      const oppId = btn.dataset.pickId;
      const day = Number(btn.dataset.pickDay);
      const home = btn.dataset.pickHome === "1";
      commitChoice(school, day, oppId, home);
    });
  });
  document.querySelectorAll(".sched-pick-row").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest(".btn-pick-home, .btn-pick-away")) return;
      const oppId = row.dataset.pickId;
      const day = Number(row.dataset.pickDay);
      commitChoice(school, day, oppId, true);
    });
  });
  const searchEl = document.getElementById("sched-search");
  if (searchEl) {
    searchEl.addEventListener("input", () => {
      var _a2;
      const day = (_a2 = state.ui.params) == null ? void 0 : _a2.schedulingPickerDay;
      const listEl = document.getElementById("sched-picker-list");
      if (!listEl || day == null) return;
      listEl.innerHTML = renderPickerList(candidateOpponents(day), day, school, searchEl.value);
      listEl.querySelectorAll(".btn-pick-home, .btn-pick-away").forEach((btn) => {
        btn.addEventListener("click", () => {
          const oppId = btn.dataset.pickId;
          const d2 = Number(btn.dataset.pickDay);
          const isH = btn.dataset.pickHome === "1";
          commitChoice(school, d2, oppId, isH);
        });
      });
      listEl.querySelectorAll(".sched-pick-row").forEach((row) => {
        row.addEventListener("click", (e) => {
          if (e.target.closest(".btn-pick-home, .btn-pick-away")) return;
          commitChoice(school, Number(row.dataset.pickDay), row.dataset.pickId, true);
        });
      });
    });
    searchEl.focus();
  }
  (_b = document.getElementById("btn-sched-clear-all")) == null ? void 0 : _b.addEventListener("click", () => {
    state.pendingNonConfChoices = [];
    recomputeScheduleGuarantee();
    state.ui.params = __spreadProps(__spreadValues({}, state.ui.params), { schedulingPickerDay: null });
    rerender();
  });
  (_c = document.getElementById("btn-sched-confirm")) == null ? void 0 : _c.addEventListener("click", () => {
    state.ui.params = __spreadProps(__spreadValues({}, state.ui.params), { schedulingPickerDay: null });
    const count = (state.pendingNonConfChoices || []).length;
    notify(
      count > 0 ? `${count} non-conf game${count !== 1 ? "s" : ""} locked \u2014 AI will fill the rest at season start.` : "No games locked \u2014 AI will fill all non-conf slots at season start.",
      "info",
      3e3
    );
    navigate("dashboard");
  });
}
function recomputeScheduleGuarantee() {
  const me = getPlayerSchool();
  const coach = state.playerCoach;
  if (!me || !coach) return;
  let total = 0;
  for (const day of NC_DAYS) {
    if (state.rivalry && day === C.RIVALRY_DAY) continue;
    const g = getChoiceForDay(day);
    if (!g) continue;
    const oppId = g.homeId === me.id ? g.awayId : g.homeId;
    const opp = getSchoolById(oppId);
    if (opp) total += scheduleGuarantee(me, opp);
  }
  coach.pendingScheduleGuarantee = total;
}
function commitChoice(school, day, oppId, playerIsHome) {
  var _a, _b;
  if (state.rivalry && day === C.RIVALRY_DAY) {
    notify("Rivalry week is reserved for the trophy game.", "warning");
    return;
  }
  if (isPreseasonMode()) {
    const res = swapNonConfOpponent(state, day, oppId, { forceHome: playerIsHome });
    if (res.ok) {
      const opp2 = getSchoolById(oppId);
      recomputeScheduleGuarantee();
      notify(`${weekLabel(day)}: ${(opp2 == null ? void 0 : opp2.name) || "opponent"} is on the slate${res.displaced ? ` \u2014 ${res.displaced.join(" and ")} pair off instead` : ""}.`, "success");
      state.ui.params = __spreadProps(__spreadValues({}, state.ui.params), { schedulingPickerDay: null });
    } else {
      notify(res.reason, "warning");
    }
    rerender();
    return;
  }
  const opp = (_b = (_a = state.world) == null ? void 0 : _a.schools) == null ? void 0 : _b.find((s) => s.id === oppId);
  if (!opp || opp.division !== school.division) {
    notify("Non-conference games are limited to your own division.", "warning");
    return;
  }
  if (!state.pendingNonConfChoices) state.pendingNonConfChoices = [];
  state.pendingNonConfChoices = state.pendingNonConfChoices.filter((g) => g.day !== day);
  const homeId = playerIsHome ? school.id : oppId;
  const awayId = playerIsHome ? oppId : school.id;
  state.pendingNonConfChoices.push({ day, homeId, awayId });
  recomputeScheduleGuarantee();
  state.ui.params = __spreadProps(__spreadValues({}, state.ui.params), { schedulingPickerDay: null });
  rerender();
}

export { renderScheduling, setupListeners5 };
