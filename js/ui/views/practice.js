import { __spreadProps, __spreadValues } from '../../_spread.js';
import { C, DEFAULT_PRACTICE, POS_WEIGHTS, PRACTICE_TOOLS, ROLE_WEIGHTS } from '../../constants.js';
import { weekLabel } from '../../engine/season.js';
import { getPlayerSchool, rerender, state } from '../../state.js';
import { escapeHtml } from '../../utils.js';

var TOTAL_MINUTES = 100;
var POS_GROUPS = [
  { id: "QB", label: "QB", positions: ["QB"], unit: "off" },
  { id: "RB", label: "RB", positions: ["RB"], unit: "off" },
  { id: "WR", label: "WR", positions: ["WR"], unit: "off" },
  { id: "TE", label: "TE", positions: ["TE"], unit: "off" },
  { id: "OL", label: "OL", positions: ["OL"], unit: "off" },
  { id: "DE", label: "DE", positions: ["DE"], unit: "def" },
  { id: "OLB", label: "OLB", positions: ["OLB"], unit: "def" },
  { id: "DT", label: "DT", positions: ["DT"], unit: "def" },
  { id: "LB", label: "LB", positions: ["LB"], unit: "def" },
  { id: "CB", label: "CB", positions: ["CB"], unit: "def" },
  { id: "S", label: "S", positions: ["S"], unit: "def" },
  { id: "K", label: "K", positions: ["K"], unit: "st" },
  { id: "P", label: "P", positions: ["P"], unit: "st" }
];
var PRACTICE_UNITS = [
  { id: "off", label: "Offense" },
  { id: "def", label: "Defense" },
  { id: "st", label: "Special Teams" }
];
var PRACTICE_KEYS = Object.keys(PRACTICE_TOOLS);
var POSITION_TOOLS = Object.fromEntries(POS_GROUPS.map((g) => [g.id, [...PRACTICE_KEYS]]));
function planFromWeights(pos) {
  const w = POS_WEIGHTS[pos] || {};
  const drills = Object.keys(PRACTICE_TOOLS).filter((d) => (w[d] || 0) > 0);
  const total = drills.reduce((sum, d) => sum + w[d], 0);
  if (!total) return {};
  const parts = drills.map((d) => ({ d, exact: w[d] / total * TOTAL_MINUTES }));
  const plan = {};
  let used = 0;
  for (const part of parts) {
    plan[part.d] = Math.floor(part.exact);
    used += plan[part.d];
  }
  const byRemainder = [...parts].sort((a, b) => b.exact % 1 - a.exact % 1);
  for (let i = 0; used < TOTAL_MINUTES; i++, used++) plan[byRemainder[i % byRemainder.length].d]++;
  return plan;
}
var DEFAULT_POSITION_PLANS = Object.fromEntries(POS_GROUPS.map((g) => [g.id, planFromWeights(g.id)]));
var TOOL_DEFAULTS = {
  SPD: "Speed Training",
  AGI: "Agility Drills",
  PWR: "Explosive Power",
  STR: "Weight Room",
  JMP: "Plyometrics",
  HND: "Catching Drills",
  SEC: "Ball Security",
  TEC: "Technique Drills",
  AWR: "Film Study"
};
var TOOL_LABELS_BY_POS = {
  QB: { AGI: "Pocket Mobility", TEC: "Throwing Mechanics", SEC: "Ball Handling" },
  RB: { AGI: "Cut & Change Direction", SEC: "High-and-Tight Drills", HND: "Receiving Drills" },
  FB: { AGI: "Lead Block Footwork", SEC: "High-and-Tight Drills", HND: "Receiving Drills" },
  WR: { AGI: "Route Breaks", TEC: "Release Technique", JMP: "High-Point Drills" },
  TE: { AGI: "Seam Route Breaks", TEC: "Release Technique", JMP: "High-Point Drills" },
  OL: { AGI: "Pass Set Footwork", TEC: "Block Technique" },
  DE: { AGI: "First-Step Quickness", TEC: "Pass Rush Technique" },
  OLB: { AGI: "Lateral Movement", TEC: "Blitz Technique" },
  DT: { AGI: "First-Step Quickness", TEC: "Pass Rush Technique" },
  LB: { AGI: "Lateral Movement", TEC: "Blitz Technique" },
  CB: { TEC: "Press Coverage", HND: "Ball Skills", JMP: "High-Point Drills" },
  S: { TEC: "Press Coverage", HND: "Ball Skills" },
  K: { TEC: "Kicking Mechanics" },
  P: { TEC: "Punting Mechanics" }
};
function getToolLabel(groupId, toolKey) {
  var _a, _b, _c;
  return (_c = (_b = (_a = TOOL_LABELS_BY_POS[groupId]) == null ? void 0 : _a[toolKey]) != null ? _b : TOOL_DEFAULTS[toolKey]) != null ? _c : toolKey;
}
var SECONDARY_LABEL = { CON: "Conditioning", WE: "Work Ethic" };
function secondaryStat(toolKey) {
  const attrs = Object.keys(PRACTICE_TOOLS[toolKey] || {});
  return attrs.find((a) => a !== toolKey) || null;
}
function archetypesForGroup(groupId) {
  const prefix = `${groupId}-`;
  return Object.keys(ROLE_WEIGHTS).filter((k) => k.startsWith(prefix)).map((k) => ({ key: k, label: k.slice(prefix.length).replace(/-/g, " ") }));
}
var ARCH_POS_FLOOR = 2;
function archetypePlanWeights(archetypeKey, pos) {
  const arch = ROLE_WEIGHTS[archetypeKey] || {};
  const posW = POS_WEIGHTS[pos] || {};
  const w = {};
  for (const k of Object.keys(PRACTICE_TOOLS)) {
    const a = arch[k] || 0, p = posW[k] || 0;
    if (a === 0 && p === 0) continue;
    w[k] = a * 0.75 + p * 0.25;
    if (p > 0) w[k] = Math.max(w[k], ARCH_POS_FLOOR);
  }
  return w;
}
function activeGroup() {
  var _a;
  const id = state.ui.practicePosGroup || "QB";
  return (_a = POS_GROUPS.find((g) => g.id === id)) != null ? _a : POS_GROUPS[0];
}
function getActivePlan(school) {
  var _a, _b, _c, _d;
  const g = activeGroup();
  const pos = g.positions[0];
  return (_d = (_c = (_b = (_a = school.positionPlans) == null ? void 0 : _a[pos]) != null ? _b : DEFAULT_POSITION_PLANS[pos]) != null ? _c : school.practiceMinutes) != null ? _d : __spreadValues({}, DEFAULT_PRACTICE);
}
function isGroupCustom(school, group) {
  return group.positions.some((pos) => {
    var _a;
    return ((_a = school.positionPlans) == null ? void 0 : _a[pos]) != null;
  });
}
function setToolInPlan(school, group, tool, val) {
  if (!school.positionPlans) school.positionPlans = {};
  const pos = group.positions[0];
  if (!school.positionPlans[pos]) {
    school.positionPlans[pos] = __spreadValues({}, DEFAULT_POSITION_PLANS[pos]);
  }
  const updated = __spreadProps(__spreadValues({}, school.positionPlans[pos]), { [tool]: val });
  for (const p of group.positions) {
    school.positionPlans[p] = updated;
  }
}
function applyPresetToGroup(school, group, preset) {
  var _a, _b;
  if (!school.positionPlans) school.positionPlans = {};
  const relevant = (_a = POSITION_TOOLS[group.id]) != null ? _a : Object.keys(PRACTICE_TOOLS);
  const filtered = {};
  let total = 0;
  for (const t of relevant) {
    filtered[t] = (_b = preset[t]) != null ? _b : 0;
    total += filtered[t];
  }
  if (total > 0) {
    const parts = relevant.map((t) => ({ t, exact: filtered[t] / total * TOTAL_MINUTES }));
    let used = 0;
    for (const part of parts) {
      filtered[part.t] = Math.floor(part.exact);
      used += filtered[part.t];
    }
    const byRem = [...parts].sort((a, b) => b.exact % 1 - a.exact % 1);
    for (let i = 0; used < TOTAL_MINUTES; i++, used++) filtered[byRem[i % byRem.length].t]++;
  }
  for (const p of group.positions) {
    school.positionPlans[p] = filtered;
  }
}
function resetGroupToDefault(school, group) {
  if (!school.positionPlans) return;
  for (const pos of group.positions) {
    delete school.positionPlans[pos];
  }
}
function renderPractice(embed = false) {
  var _a;
  const school = getPlayerSchool();
  const group = activeGroup();
  const plan = getActivePlan(school);
  const custom = isGroupCustom(school, group);
  const tools = (_a = POSITION_TOOLS[group.id]) != null ? _a : Object.keys(PRACTICE_TOOLS);
  const total = tools.reduce((s, t) => {
    var _a2;
    return s + ((_a2 = plan[t]) != null ? _a2 : 0);
  }, 0);
  const over = total > TOTAL_MINUTES;
  const under = total < TOTAL_MINUTES;
  const customCount = POS_GROUPS.filter((g) => isGroupCustom(school, g)).length;
  const checkpointWeeks = C.INSEASON_DEV_WEEKS.map((day) => weekLabel(day).replace(/^Week /, "")).join(", ");
  return `
  <div class="view-practice">
    <div class="view-header${embed ? " embed-actions" : ""}">
      <div>
        ${embed ? "" : `<h1 class="view-title">Practice Plan</h1>`}
        <div class="view-subtitle">
          ${TOTAL_MINUTES} min per position \xB7 trains at camp and three in-season checkpoints
          ${customCount > 0 ? `<span class="custom-groups-badge">${customCount} customized</span>` : ""}
        </div>
      </div>
    </div>

    <div class="practice-timing-note">
      Practice is your TARGETED channel: it develops the roster at three in-season
      checkpoints (regular-season Weeks ${checkpointWeeks}) using whatever plan is set at that moment \u2014 mid-season
      changes are real now. Talent grows separately at season's end: potential and Work Ethic
      drive it (your sky-high freshman blooms even on the bench), and production feeds the
      attributes it exercised.
    </div>

    <div class="gp-tip tip-info">\u25B8 100 minutes a week per position group \u2014 this is the growth YOU aim. It ticks in regular-season Weeks ${checkpointWeeks}, so retargeting mid-season pays. Bodies RAMP through the years (a senior's weight-room leap is his biggest), craft grows steady with reps, Work Ethic multiplies everything, and your Developer skill plus the Training Complex raise the whole ceiling.</div>

    <div class="practice-unit-groups">
      ${PRACTICE_UNITS.map((u) => {
    const unitGroups = POS_GROUPS.filter((g) => g.unit === u.id);
    const anyActive = unitGroups.some((g) => g.id === group.id);
    return `
          <div class="practice-unit-group">
            <div class="practice-unit-label${anyActive ? " active-unit" : ""}">${u.label}</div>
            <div class="practice-pos-tabs">
              ${unitGroups.map((g) => {
      const isActive = g.id === group.id;
      const hasCustom = isGroupCustom(school, g);
      return `<button class="practice-tab${isActive ? " active" : ""}${hasCustom ? " has-custom" : ""}"
                                data-group="${g.id}">
                  ${g.label}${hasCustom && !isActive ? '<span class="tab-custom-dot"></span>' : ""}
                </button>`;
    }).join("")}
            </div>
          </div>
        `;
  }).join("")}
    </div>

    ${!custom ? `
      <div class="practice-group-banner practice-group-default">
        <span class="banner-label">Using <strong>${group.label}</strong> position default</span>
        <span class="banner-hint">Adjust any slider to customize</span>
      </div>
    ` : `
      <div class="practice-group-banner practice-group-custom">
        <span class="banner-label">Custom plan \xB7 <strong>${group.label}</strong></span>
        <button class="btn-link" id="btn-reset-group">Reset to default</button>
      </div>
    `}

    <div class="practice-budget-bar">
      <div class="practice-budget-track">
        <div class="practice-budget-fill${over ? " over" : under ? " under" : ""}"
             id="practice-budget-fill"
             style="width:${Math.min(100, total / TOTAL_MINUTES * 100)}%"></div>
      </div>
      <span class="practice-budget-label ${over ? "budget-over" : under ? "budget-under" : "budget-ok"}"
            id="practice-budget-label">
        ${total} / ${TOTAL_MINUTES} min${over ? ` \u2014 ${total - TOTAL_MINUTES} over` : under ? ` \u2014 ${TOTAL_MINUTES - total} remaining` : " \u2014 ready"}
      </span>
    </div>

    <div class="practice-tools">
      ${tools.map((tool) => {
    var _a2;
    const val = (_a2 = plan[tool]) != null ? _a2 : 0;
    const label = getToolLabel(group.id, tool);
    const secondary = secondaryStat(tool);
    return `
          <div class="practice-row">
            <div class="practice-row-meta">
              <span class="practice-tool-name">${escapeHtml(label)}</span>
              <div class="practice-tool-attrs">
                <span class="attr-chip attr-${tool.toLowerCase()}">${tool}</span>
                ${secondary ? `<span class="attr-chip attr-secondary" title="${SECONDARY_LABEL[secondary] || secondary} \u2014 trained at half rate">+${secondary}</span>` : ""}
              </div>
            </div>
            <div class="practice-row-control">
              <input type="range" class="practice-slider" data-tool="${escapeHtml(tool)}"
                     min="0" max="40" step="1" value="${val}">
              <span class="practice-slider-val" id="pval-${escapeHtml(tool)}">${val}<span class="slider-unit"> min</span></span>
            </div>
          </div>
        `;
  }).join("")}
    </div>

    <div class="practice-presets">
      <span class="practice-presets-label">Train as</span>
      ${archetypesForGroup(group.id).map((a) => `
        <button class="btn-ghost btn-sm practice-preset" data-archetype="${escapeHtml(a.key)}">${escapeHtml(a.label)}</button>
      `).join("")}
    </div>
  </div>
`;
}
function setupListeners17() {
  var _a;
  const school = getPlayerSchool();
  if (!school) return;
  function recalcBudget() {
    var _a2;
    const group = activeGroup();
    const plan = getActivePlan(school);
    const tools = (_a2 = POSITION_TOOLS[group.id]) != null ? _a2 : Object.keys(PRACTICE_TOOLS);
    const total = tools.reduce((s, t) => {
      var _a3;
      return s + ((_a3 = plan[t]) != null ? _a3 : 0);
    }, 0);
    const over = total > TOTAL_MINUTES;
    const under = total < TOTAL_MINUTES;
    const fill = document.getElementById("practice-budget-fill");
    const label = document.getElementById("practice-budget-label");
    if (fill) {
      fill.style.width = `${Math.min(100, total / TOTAL_MINUTES * 100)}%`;
      fill.className = `practice-budget-fill${over ? " over" : under ? " under" : ""}`;
    }
    if (label) {
      label.className = `practice-budget-label ${over ? "budget-over" : under ? "budget-under" : "budget-ok"}`;
      label.textContent = `${total} / ${TOTAL_MINUTES} min${over ? ` \u2014 ${total - TOTAL_MINUTES} over` : under ? ` \u2014 ${TOTAL_MINUTES - total} remaining` : " \u2014 ready"}`;
    }
  }
  document.querySelectorAll(".practice-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.ui.practicePosGroup = btn.dataset.group;
      rerender();
    });
  });
  document.querySelectorAll(".practice-slider").forEach((slider) => {
    slider.addEventListener("input", () => {
      const tool = slider.dataset.tool;
      const val = parseInt(slider.value, 10);
      setToolInPlan(school, activeGroup(), tool, val);
      const valEl = document.getElementById(`pval-${tool}`);
      if (valEl) valEl.innerHTML = `${val}<span class="slider-unit"> min</span>`;
      recalcBudget();
    });
  });
  document.querySelectorAll(".practice-preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.archetype;
      if (!ROLE_WEIGHTS[key]) return;
      const g = activeGroup();
      applyPresetToGroup(school, g, archetypePlanWeights(key, g.positions[0]));
      rerender();
    });
  });
  (_a = document.getElementById("btn-reset-group")) == null ? void 0 : _a.addEventListener("click", () => {
    resetGroupToDefault(school, activeGroup());
    rerender();
  });
}

export { renderPractice, setupListeners17 };

// additional exports consumed by tools/ probes
export { planFromWeights };
