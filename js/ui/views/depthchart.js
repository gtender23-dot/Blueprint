import { DEF_BLITZ_ELIGIBLE, DEF_DROP_ELIGIBLE, DEF_FIELD_LAYOUTS, OFF_FIELD_LAYOUTS } from '../../constants_field.js';
import { C, FORMATIONS, FORMATION_PLAYBOOK, SLOT_ELIGIBILITY, STARTER_COUNTS } from '../../constants.js';
import { defaultShareFor, ensureFieldAssignments, offFieldSlots, resolveDefField, resolveOffField, SLOT_ELIGIBLE_POS } from '../../engine/fieldassign.js';
import { carriedOffLooks } from '../../engine/playbook.js';
import { carriedDefFronts } from '../../engine/formations.js';
import { bridgeCoversSlot, bridgeOf, sizeFitForSlot } from '../../engine/traits.js';
import { derivedArchetype, posAdjust, roleRating } from '../../engine/player.js';
import { buildDepthChart, buildRoleSortedDepthOrder } from '../../engine/world.js';
import { getPlayerSchool, navigate, notify, rerender, state } from '../../state.js';
import { tipTerm } from '../manual/tips.js';
import { gameplanIsSimple } from './gameplan.js';
import { archetypeLabel, escapeHtml, fullName, ratingColor } from '../../utils.js';

var depthTab = "offense";
// Job-slot depth chart (Aug 2026): which front's eleven the defense tab is
// editing. null = the school's identity front (hard dial, else base front).
var defFrontTab = null;
var activeOffFormation = null;
// 2026-08-19: the active look's VARIATION. The screen used to know only the
// formation, so it drew and resolved base personnel while the sim fielded the
// variation's — see offFieldSlots.
var activeOffVariation = null;
var depthSecOpen = {};
var depthPosTab = {};
var picker = null;
var uniqSwap = null;
var formationInfoOpen = false;
function renderUniqSwapPicker(school) {
  const u = UNIQUE_DEPTH_OFF.find((x) => x.pos === uniqSwap);
  if (!u) return "";
  const all = uniqueDepthTop(school, u, 999);
  const override = (school.depthOrder || {})[u.pos] || [];
  const currentId = override[0] || all[0] && all[0].p.id || null;
  const overridden = override.length > 0;
  return `
  <div class="picker-overlay" data-uniq-swap-close="bg">
    <div class="picker-panel" data-uniq-swap-close="stop">
      <div class="picker-head">
        <div>
          <div class="picker-title">${escapeHtml(u.label)}</div>
          <div class="picker-sub">${u.from.join("/")} \xB7 all eligible by fit \xB7 plays here in every formation with this spot</div>
        </div>
        <button class="picker-x" data-uniq-swap-close="x">\u2715</button>
      </div>
      <div class="picker-list">
        <div class="picker-item picker-auto${overridden ? "" : " active"}" data-uniq-pick="__auto__">
          <span class="picker-name">Auto (best fit)</span>
          <span class="picker-tag">default</span>
        </div>
        ${all.map(({ p, fit }) => `
          <div class="picker-item${overridden && p.id === currentId ? " active" : ""}" data-uniq-pick="${p.id}">
            <span class="picker-name">${escapeHtml(fullName(p))}</span>
            <span class="picker-meta">
              <span class="pos-chip pos-${p.position}">${p.position}</span>
              <span class="class-badge class-${p.classYear.toLowerCase()}">${p.classYear}</span>
              <span class="fs-rating ${ratingColor(Math.round(fit))}">${Math.round(fit)}</span>
            </span>
          </div>`).join("")}
        ${all.length === 0 ? '<div class="empty-hint">No eligible players.</div>' : ""}
      </div>
    </div>
  </div>
`;
}
function lookKeyOf(fid, variation) { return variation ? `${fid}|${variation}` : fid; }
function renderDepthChart(embed = false) {
  const school = getPlayerSchool();
  const gp = (school == null ? void 0 : school.gameplan) || {};
  ensureFieldAssignments(gp);
  if (gameplanIsSimple() && school) applySimplePlan(school);
  // THE LOOKS THIS TEAM CARRIES — not every formation in the game. The old
  // line read Object.keys(OFF_FIELD_LAYOUTS) while the empty-state below it
  // already said "Pick your package on the Game Plan screen first"; the intent
  // was always the carried set, the filter just never did it (2026-08-19).
  const offLooks = carriedOffLooks(gp);
  const activeKey = activeOffFormation ? lookKeyOf(activeOffFormation, activeOffVariation) : null;
  if (!activeKey || !offLooks.some((l) => l.key === activeKey)) {
    activeOffFormation = offLooks[0] ? offLooks[0].id : "Single Back";
    activeOffVariation = offLooks[0] ? offLooks[0].variation : null;
  }
  const baseFront = gp.defBaseFront || "4-3";
  // A front tab left over from a plan that no longer carries it would pin an
  // eleven the defense never fields — drop back to the identity front.
  const defFronts = carriedDefFronts(gp);
  if (defFrontTab && !defFronts.includes(defFrontTab)) defFrontTab = null;
  return `
  <div class="view-depthchart">
    ${embed ? `<div class="view-header embed-actions">
      <div class="view-subtitle">Who starts \xB7 who's next \xB7 who gets the ball</div>
      <div class="header-actions">
        <button class="btn-ghost" id="btn-auto-sort">Auto-Fill</button>
      </div>
    </div>` : `<div class="view-header dc-header">
      <div>
        <h1 class="view-title">${tipTerm("depth-chart", "Depth Chart")}</h1>
        <div class="view-subtitle">Who starts \xB7 who's next \xB7 who gets the ball</div>
      </div>
      <div class="header-actions">
        <button class="btn-ghost" id="btn-auto-sort">Auto-Fill</button>
      </div>
    </div>`}

    <div class="depth-unit-tabs">
      <button class="rec-tab${depthTab === "offense" ? " active" : ""}" data-dtab="offense">Offense</button>
      <button class="rec-tab${depthTab === "defense" ? " active" : ""}" data-dtab="defense">Defense</button>
      <button class="rec-tab${depthTab === "st" ? " active" : ""}" data-dtab="st">Special Teams</button>
    </div>

    ${depthTab === "offense" ? renderOffense(school, gp, offLooks) : ""}
    ${depthTab === "defense" ? renderDefense(school, gp, defFrontTab || (gp.defFront && gp.defFront !== "auto" ? gp.defFront : baseFront), defFronts) : ""}
    ${depthTab === "st" ? renderST(school) : ""}

    ${picker ? renderPicker2(school) : ""}
    ${uniqSwap ? renderUniqSwapPicker(school) : ""}
    ${formationInfoOpen && depthTab === "offense" ? renderFormationInfo(activeOffFormation, { slots: offFieldSlots(activeOffFormation, activeOffVariation) || [] }) : ""}
  </div>
`;
}
function renderOffense(school, gp, offLooks) {
  if (offLooks.length === 0) {
    return `<div class="card"><div class="empty-hint">No offensive formations selected. Pick your package on the <a data-nav="gameplan" class="link">Game Plan</a> screen first.</div></div>`;
  }
  const fid = activeOffFormation;
  const vk = activeOffVariation;
  // The look's DRESSED slots — the same list resolveOffField fields and the
  // play cards draw. Assignments stay keyed by formation (slot IDs never change
  // across variations), so a pin rides every look of the same formation.
  const layout = { ...OFF_FIELD_LAYOUTS[fid], slots: offFieldSlots(fid, vk) || OFF_FIELD_LAYOUTS[fid].slots };
  const entry = gp.fieldAssignments.offense[fid] || { slots: {}, shares: {} };
  const activeDepth = buildActiveDepth(school);
  const ratingById = buildRatingById(school);
  const resolved = resolveOffField(fid, entry.slots, entry.shares, activeDepth, ratingById, posById(school), byId(school), vk);
  const bySlot = (resolved == null ? void 0 : resolved.bySlot) || {};
  const catchSlots = layout.slots.filter((s) => s.catch);
  if (!entry.shares) entry.shares = {};
  normalizeShares(entry.shares, catchSlots.map((s) => s.id));
  const shareTotal = 100;
  return `
  <div class="fielded-formation-picker ff-strip">
    ${offLooks.map((l) => `
      <button class="ff-pill${l.key === lookKeyOf(fid, vk) ? " active" : ""}" data-off-look="${escapeHtml(l.key)}">${escapeHtml(l.label)}</button>
    `).join("")}
    <span class="ff-hint">These are the looks your playbook carries · change them on the <a data-nav="gameplan" class="link">Game Plan</a> screen</span>
  </div>

  <div class="formation-info-row">
    <button class="btn-ghost formation-info-btn" type="button" data-formation-info-open="1"
            aria-label="Explain the positions in ${escapeHtml(fid)}">
      <span aria-hidden="true">\u24D8</span> Where everyone lines up in ${escapeHtml(fid)}
    </button>
  </div>

  <details class="dc-tip"${depthSecOpen["tip:offense"] ? " open" : ""} data-do-sec="tip:offense">
    <summary>How this screen works</summary>
    <div class="dc-tip-body">Tap any slot to change who starts there. The dial under each pass-catcher is his TARGET SHARE \u2014 his slice of 100% of the QB's looks. Move one man and the rest rebalance. One rule to know: load a man up far enough and a \u2605 appears \u2014 he is now your FEATURED target, and defenses bracket featured men. Volume buys attention. The line reads left-to-right: LT \xB7 LG \xB7 C \xB7 RG \xB7 RT \u2014 your run-direction dials on the Game Plan point at these five.</div>
  </details>

  <div class="field-card off-field">
    <div class="field-turf">
      ${(() => {
    const slotHtmlById = {};
    for (const s of layout.slots) slotHtmlById[s.id] = renderFieldSlot(school, s, bySlot[s.id], {
      side: "offense",
      containerId: fid,
      entry,
      shareTotal
    });
    return renderTurfRows(layout, "offense", slotHtmlById);
  })()}
    </div>
  </div>

  ${gameplanIsSimple() ? renderSimpleOffPanel(school, gp, catchSlots, entry, bySlot) : renderShareBar(catchSlots, entry.shares, shareTotal, school, bySlot, gp, fid)}
  ${renderDepthOrder(school, "offense")}
`;
}
function formationSpotInfo(fid, slot) {
  const side = slot.x < 0.5 ? "left" : slot.x > 0.5 ? "right" : "middle";
  const onLine = Math.abs(slot.y - 0.5) <= 0.01;
  if (slot.pos === "WILDCAT") return {
    name: "Wildcat back",
    eligible: "RB \xB7 WR \xB7 QB",
    detail: "Direct-snap ball carrier behind the center. This is the player running the Wildcat offense."
  };
  if (slot.pos === "JETMAN") return {
    name: "Jet motion",
    eligible: "WR \xB7 RB",
    detail: "Speed player crossing the formation before the snap for handoffs, fakes, and edge pressure."
  };
  if (slot.pos === "WING") return {
    name: `${slot.label === "LH" ? "Left" : "Right"} halfback`,
    eligible: "RB \xB7 TE",
    detail: `Wishbone pitch back aligned deep on the ${side} side of the full-house backfield.`
  };
  if (slot.pos === "ABACK") return {
    name: `${side === "left" ? "Left" : "Right"} A-back`,
    eligible: "RB \xB7 WR \xB7 TE",
    detail: `Flexbone wing and pitch back aligned outside the ${side} tackle.`
  };
  if (fid === "Wildcat" && slot.id === "QB") return {
    name: "Quarterback decoy",
    eligible: "QB",
    detail: "The regular quarterback is split wide right as a decoy. He does not take the direct snap; the WC back does."
  };
  if (slot.id === "QB") return {
    name: "Quarterback",
    eligible: "QB",
    detail: "Receives the snap and operates the offense from behind the line."
  };
  if (slot.label === "B") return {
    name: "B-back",
    eligible: "RB \xB7 TE",
    detail: "Flexbone downhill runner aligned behind the quarterback, between the two A-backs."
  };
  if (slot.label === "FB" || slot.role === "FB-Lead") return {
    name: "Fullback",
    eligible: "RB \xB7 TE",
    detail: "Lead blocker and inside runner aligned in the backfield."
  };
  if (slot.label === "HB") return {
    name: "Halfback",
    eligible: "RB",
    detail: "Primary running back aligned behind or beside the quarterback."
  };
  if (slot.label === "X") return {
    name: "X receiver",
    eligible: "WR",
    detail: `Split wide ${side} and ${onLine ? "on" : "just off"} the line of scrimmage.`
  };
  if (slot.label === "Z") return {
    name: "Z receiver",
    eligible: "WR",
    detail: `Split wide ${side} and ${onLine ? "on" : "just off"} the line of scrimmage.`
  };
  if (slot.label === "SL" || slot.label === "FL") return {
    name: slot.label === "SL" ? "Slot receiver" : "F receiver",
    eligible: "WR \xB7 TE \xB7 RB",
    detail: `Inside receiver aligned off the line on the ${side} side.`
  };
  if (slot.pos === "TE") return {
    name: `${slot.label} tight end`,
    eligible: "TE \xB7 WR",
    detail: `${onLine ? "Attached to the line" : "Aligned as a wing"} on the ${side} side; blocks and releases into routes.`
  };
  if (slot.pos === "RB") return {
    name: "Running back",
    eligible: "RB",
    detail: "Backfield runner and pass-game outlet."
  };
  return { name: slot.label, eligible: slot.pos, detail: "Formation-specific offensive position." };
}
function renderFormationMiniDiagram(fid, layout) {
  const slots = layout.slots.map((slot) => {
    const mx = (slot.x * 100).toFixed(1);
    const my = (16 + (slot.y - 0.5) * 175).toFixed(1);
    const info = formationSpotInfo(fid, slot);
    return `<span class="formation-mini-slot${slot.pos === "OL" ? " is-line" : ""}"
                style="--mx:${mx}%;--my:${my}%"
                data-formation-visual-slot="${slot.id}" data-visual-pos="${slot.pos}"
                title="${escapeHtml(slot.label + " \u2014 " + info.name)}"
                aria-hidden="true">${escapeHtml(slot.label)}</span>`;
  }).join("");
  return `
  <div class="formation-info-visual" data-formation-visual="${escapeHtml(fid)}">
    <div class="formation-info-visual-head">
      <span>Formation alignment</span>
      <span class="formation-info-direction">Offense faces <b aria-hidden="true">\u2191</b></span>
    </div>
    <div class="formation-mini-field" role="img"
         aria-label="${escapeHtml(fid)} offensive formation alignment">
      <span class="formation-mini-los" aria-hidden="true">LOS</span>
      ${slots}
    </div>
  </div>`;
}
function renderFormationInfo(fid, layout) {
  if (!layout) return "";
  const line = layout.slots.filter((s) => s.pos === "OL").sort((a, b) => a.x - b.x);
  const skill = layout.slots.filter((s) => s.pos !== "OL").sort((a, b) => a.y - b.y || a.x - b.x);
  return `
  <div class="picker-overlay formation-info-overlay" data-formation-info-close="bg">
    <section class="picker-panel formation-info-panel" data-formation-info-close="stop"
             role="dialog" aria-modal="true" aria-labelledby="formation-info-title">
      <div class="picker-head">
        <div>
          <div class="picker-title" id="formation-info-title">${escapeHtml(fid)} positions</div>
          <div class="picker-sub">How the eleven players line up \xB7 eligible roster positions shown below</div>
        </div>
        <button class="picker-x" type="button" data-formation-info-close="x" aria-label="Close formation guide">\u2715</button>
      </div>
      <div class="formation-info-list">
        ${renderFormationMiniDiagram(fid, layout)}
        <div class="formation-info-unit" data-formation-info-unit="ol">
          <div class="formation-info-unit-title">Offensive line</div>
          <div class="formation-info-line-labels">
            ${line.map((s) => `<span data-formation-info-slot="${s.id}">${escapeHtml(s.label)}</span>`).join("")}
          </div>
          <div class="formation-info-detail">Five blockers on the line of scrimmage, read left to right: left tackle, left guard, center, right guard, right tackle. Eligible: OL \xB7 TE.</div>
        </div>
        ${skill.map((s) => {
    const info = formationSpotInfo(fid, s);
    return `<div class="formation-info-spot" data-formation-info-slot="${s.id}">
            <span class="formation-info-label">${escapeHtml(s.label)}</span>
            <div class="formation-info-copy">
              <div class="formation-info-name">${escapeHtml(info.name)}</div>
              <div class="formation-info-detail">${escapeHtml(info.detail)}</div>
              <div class="formation-info-eligible">Eligible: ${escapeHtml(info.eligible)}</div>
            </div>
          </div>`;
  }).join("")}
      </div>
    </section>
  </div>`;
}
function applySimplePlan(school) {
  const gp = school == null ? void 0 : school.gameplan;
  if (!gp) return;
  ensureFieldAssignments(gp);
  const sg = gp.simple || (gp.simple = {});
  const roster = school.roster || [];
  const activeDepth = buildActiveDepth(school);
  const ratingById = buildRatingById(school);
  // Simple mode's auto target-shares. This still walks EVERY formation on
  // purpose — the shares are bookkeeping a coach may inherit if he later
  // carries a look, and narrowing it would leave stale splits behind. What DID
  // need fixing: a carried look's shares were computed off base personnel, so
  // a re-dressed body got weighted as the wrong kind of receiver. Resolve each
  // formation under the variation the team actually carries it in.
  const varByFid = {};
  for (const l of carriedOffLooks(gp, { all: true })) if (l.variation) varByFid[l.id] = l.variation;
  for (const fid of Object.keys(OFF_FIELD_LAYOUTS).filter((_fid) => FORMATIONS[_fid])) {
    const layout = { slots: offFieldSlots(fid, varByFid[fid] || null) || OFF_FIELD_LAYOUTS[fid].slots };
    const e = gp.fieldAssignments.offense[fid] || (gp.fieldAssignments.offense[fid] = { slots: {}, shares: {} });
    if (!e.shares) e.shares = {};
    const resolved = resolveOffField(fid, e.slots, e.shares, activeDepth, ratingById, posById(school), byId(school), varByFid[fid] || null);
    const bySlot = resolved && resolved.bySlot || {};
    const catchSlots = layout.slots.filter((s) => s.catch);
    const wById = {};
    let tot = 0;
    for (const s of catchSlots) {
      const pid = bySlot[s.id];
      const r = pid ? ratingById[pid] || 40 : 0;
      wById[s.id] = r;
      tot += r;
    }
    const keys = catchSlots.map((s) => s.id);
    if (tot <= 0) {
      normalizeShares(e.shares, keys);
      continue;
    }
    for (const s of catchSlots) e.shares[s.id] = Math.round(wById[s.id] / tot * 20) * 5;
    normalizeShares(e.shares, keys);
    if (sg.featuredSlot && sg.featuredSlot !== "__even" && keys.includes(sg.featuredSlot)) {
      setSplitRebalanced(e.shares, keys, sg.featuredSlot, 30);
    }
  }
  const rbIds = (activeDepth.RB || []).slice(0, 4);
  gp.rbCarryShares = gp.rbCarryShares || {};
  for (const id of Object.keys(gp.rbCarryShares)) delete gp.rbCarryShares[id];
  const style = sg.rushStyle || "auto";
  if (style !== "auto" && rbIds.length) {
    const ranked = rbIds.slice().sort((a, b) => (ratingById[b] || 0) - (ratingById[a] || 0));
    let splits = [];
    if (style === "workhorse") splits = [80, 20];
    else if (style === "dual") splits = [55, 45];
    else splits = [40, 30, 20, 10];
    let assigned = 0;
    ranked.forEach((id, i) => {
      if (i < splits.length) {
        gp.rbCarryShares[id] = splits[i];
        assigned += splits[i];
      }
    });
    const drift = 100 - Object.values(gp.rbCarryShares).reduce((s, v) => s + v, 0);
    if (drift && ranked[0]) gp.rbCarryShares[ranked[0]] += drift;
  }
  gp.qbRunPct = sg.qbRun ? C.SIMPLE_QBRUN_PCT || 12 : 0;
  const front = gp.defBaseFront || "4-3";
  const de = gp.fieldAssignments.defense[front] || (gp.fieldAssignments.defense[front] = { slots: {}, blitzShares: {} });
  de.blitzShares = de.blitzShares || {};
  for (const k of Object.keys(de.blitzShares)) delete de.blitzShares[k];
  const eligible = DEF_BLITZ_ELIGIBLE[front] || [];
  const dr = resolveDefField(front, de.slots, {}, activeDepth, ratingById, posById(school), byId(school));
  const dBySlot = dr && dr.bySlot || {};
  const aggr = sg.blitzAggr || "balanced";
  const nBlitz = aggr === "conservative" ? 0 : aggr === "aggressive" ? 3 : 1;
  if (nBlitz > 0) {
    const ranked = eligible.map((sid) => ({ sid, pid: dBySlot[sid] })).filter((x) => x.pid).sort((a, b) => (ratingById[b.pid] || 0) - (ratingById[a.pid] || 0)).slice(0, nBlitz);
    for (const { sid } of ranked) de.blitzShares[sid] = 100;
  }
}
function renderSimpleOffPanel(school, gp, catchSlots, entry, bySlot) {
  const roster = (school == null ? void 0 : school.roster) || [];
  const sg = gp.simple || (gp.simple = {});
  const featuredSlot = sg.featuredSlot || "__even";
  const catchOpts = catchSlots.map((s) => {
    const pid = bySlot[s.id];
    const p = pid ? roster.find((pl) => pl.id === pid) : null;
    return { id: s.id, label: s.label, name: p ? shortName(p) : "\u2014" };
  });
  const rushStyle = sg.rushStyle || "auto";
  const RUSH = [
    ["auto", "Auto", "Sim splits by scheme"],
    ["workhorse", "Workhorse", "One back carries the load"],
    ["dual", "Dual", "Two backs share the work"],
    ["committee", "Committee", "Spread across the room"]
  ];
  const qbRun = (gp.qbRunPct || 0) > 0 || sg.qbRun === true;
  return `
  <div class="card simple-gp-card">
    <div class="card-header"><span class="card-title">SIMPLE GAME PLAN</span>
      <span class="card-sub">plain calls \xB7 the sim handles the fine detail</span></div>

    <div class="simple-gp-row">
      <div class="simple-gp-label">Featured Receiver</div>
      <div class="simple-gp-desc">Who the QB leans on. Featured men get the volume \u2014 and get bracketed.</div>
      <div class="gp-options" style="flex-wrap:wrap">
        <button class="gp-option gp-option-sm${featuredSlot === "__even" ? " active" : ""}" data-simple-featured="__even">Spread it</button>
        ${catchOpts.map((c) => `<button class="gp-option gp-option-sm${featuredSlot === c.id ? " active" : ""}" data-simple-featured="${c.id}">${escapeHtml(c.label)} \xB7 ${escapeHtml(c.name)}</button>`).join("")}
      </div>
    </div>

    <div class="simple-gp-row">
      <div class="simple-gp-label">Rushing Split</div>
      <div class="simple-gp-desc">How you divide the carries among your backs.</div>
      <div class="gp-options" style="flex-wrap:wrap">
        ${RUSH.map(([v, l, d]) => `<button class="gp-option gp-option-sm${rushStyle === v ? " active" : ""}" data-simple-rush="${v}" title="${d}">${l}</button>`).join("")}
      </div>
    </div>

    <div class="simple-gp-row">
      <div class="simple-gp-label">QB in the Run Game</div>
      <div class="simple-gp-desc">Designed QB runs \u2014 keepers, draws, option. Great with a mobile QB.</div>
      <div class="gp-mode-toggle">
        <button class="gp-mode-btn${!qbRun ? " active" : ""}" data-simple-qbrun="off">Pocket</button>
        <button class="gp-mode-btn${qbRun ? " active" : ""}" data-simple-qbrun="on">Involved</button>
      </div>
    </div>
  </div>
`;
}
var SLOT_ELIGIBLE = ["WR", "TE", "RB"];
var SLOT_DEPTH_SHOWN = 7;
function formationPlaybookSet(formIds) {
  const set = /* @__PURE__ */ new Set();
  for (const id of formIds || []) for (const nm of FORMATION_PLAYBOOK[id] || []) set.add(nm);
  return set;
}
var DEPTH_POS = {
  offense: ["QB", "RB", "WR", "TE", "OL"],
  defense: ["DE", "DT", "OLB", "LB", "CB", "S"],
  st: ["K", "P"]
};
var UNIQUE_DEPTH_OFF = [
  { pos: "SLOT", label: "SLOT RECEIVER", role: "WR-Slot", from: ["WR", "TE", "RB"], forms: ["Spread", "Air Raid", "Pistol/RPO", "Trips/Bunch", "Empty"] },
  { pos: "FADE", label: "FADE / JUMP-BALL", role: "WR-Fade", from: ["WR", "TE"], forms: ["Single Back", "Power-I", "Wishbone", "Flexbone", "Wildcat", "Spread", "Trips/Bunch", "Pistol/RPO", "Air Raid", "Empty", "Jumbo"] },
  { pos: "FB", label: "FULLBACK", role: "FB-Lead", from: ["RB", "TE"], forms: ["Power-I", "Wishbone", "Flexbone", "Wildcat", "Jumbo"] },
  { pos: "WING", label: "WISHBONE HB", role: "RB-Power", from: ["RB", "TE"], forms: ["Wishbone"] },
  { pos: "ABACK", label: "FLEXBONE A-BACK", role: "RB-Scat", from: ["RB", "WR", "TE"], forms: ["Flexbone"] },
  { pos: "WILDCAT", label: "WILDCAT BACK", role: "RB-Power", from: ["RB", "WR", "QB"], forms: ["Wildcat"] },
  { pos: "JETMAN", label: "JET MOTION", role: "RB-Scat", from: ["WR", "RB"], forms: ["Wildcat"] }
];
var UNIQUE_DEPTH_DEF = [];
function uniqueDepthTop(school, entry, n = 5) {
  const roster = (school == null ? void 0 : school.roster) || [];
  const pool = roster.filter((p) => entry.from.includes(p.position) && p.injuryGamesOut === 0);
  const scored = pool.map((p) => ({ p, fit: roleRating(p, entry.role) }));
  scored.sort((a, b) => b.fit - a.fit);
  const override = ((school == null ? void 0 : school.depthOrder) || {})[entry.pos] || [];
  if (override.length) {
    const rank = new Map(override.map((id, i) => [id, i]));
    scored.sort((a, b) => {
      const ra = rank.has(a.p.id) ? rank.get(a.p.id) : Infinity;
      const rb = rank.has(b.p.id) ? rank.get(b.p.id) : Infinity;
      if (ra !== rb) return ra - rb;
      return b.fit - a.fit;
    });
  }
  return scored.slice(0, n);
}
function slotLabelsByPlayer(school, side) {
  var _a, _b, _c, _d, _e, _f;
  const gp = school == null ? void 0 : school.gameplan;
  const out = {};
  try {
    if (side === "offense") {
      const fid = activeOffFormation;
      const baseLayout = OFF_FIELD_LAYOUTS[fid];
      const entry = (_b = (_a = gp == null ? void 0 : gp.fieldAssignments) == null ? void 0 : _a.offense) == null ? void 0 : _b[fid];
      if (!baseLayout) return out;
      // Dressed slots + the variation, so the badge on a player's card names
      // the job he holds in THIS look (Trips' RB_H is a slot receiver, not an
      // A-back) rather than the base formation's job.
      const layout = { slots: offFieldSlots(fid, activeOffVariation) || baseLayout.slots };
      const r = resolveOffField(fid, entry == null ? void 0 : entry.slots, entry == null ? void 0 : entry.shares, buildActiveDepth(school), buildRatingById(school), posById(school), byId(school), activeOffVariation);
      for (const s of layout.slots) {
        const pid = (_c = r == null ? void 0 : r.bySlot) == null ? void 0 : _c[s.id];
        if (pid) out[pid] = { label: s.label, pos: s.pos, role: s.role };
      }
    } else if (side === "defense") {
      const front = (gp == null ? void 0 : gp.defBaseFront) || "4-3";
      const layout = DEF_FIELD_LAYOUTS[front];
      const entry = (_e = (_d = gp == null ? void 0 : gp.fieldAssignments) == null ? void 0 : _d.defense) == null ? void 0 : _e[front];
      if (!layout) return out;
      const r = resolveDefField(front, entry == null ? void 0 : entry.slots, entry == null ? void 0 : entry.blitzShares, buildActiveDepth(school), buildRatingById(school), posById(school), byId(school));
      for (const s of layout.slots) {
        const pid = (_f = r == null ? void 0 : r.bySlot) == null ? void 0 : _f[s.id];
        if (pid) out[pid] = { label: s.label, pos: s.pos, role: s.role };
      }
    }
  } catch (e) {
  }
  return out;
}
function formationRoleFor(pos, side, school, slotOf, playerId) {
  var _a, _b;
  const hit = slotOf[playerId];
  if ((hit == null ? void 0 : hit.pos) === pos && hit.role) return hit.role;
  // Dressed slots on offense: a variation may re-dress a body's ROLE, and this
  // is the fallback that names the role. (The target-share handlers below still
  // read the base slots on purpose — variationLayoutSlots never changes slot
  // IDs or catch eligibility, so the catch list is identical either way.)
  const layout = side === "offense"
    ? { slots: offFieldSlots(activeOffFormation, activeOffVariation) || [] }
    : DEF_FIELD_LAYOUTS[((_a = school.gameplan) == null ? void 0 : _a.defBaseFront) || "4-3"];
  return ((_b = ((layout == null ? void 0 : layout.slots) || []).find((s) => s.pos === pos)) == null ? void 0 : _b.role) || null;
}
function renderDepthOrder(school, side) {
  const slotOf = slotLabelsByPlayer(school, side);
  const groups = (DEPTH_POS[side] || []).filter((pos) => {
    var _a;
    return ((((_a = school.depthChart) == null ? void 0 : _a[pos]) || []).length > 0);
  });
  const uniq = side === "offense" ? UNIQUE_DEPTH_OFF : UNIQUE_DEPTH_DEF;
  const hasSpots = uniq.some((u) => uniqueDepthTop(school, u, 1).length > 0);
  const tabs = hasSpots ? [...groups, "__spots"] : groups;
  if (!tabs.length) return "";
  let active = depthPosTab[side];
  if (!tabs.includes(active)) active = tabs[0];
  return `
  <div class="card depth-order-card">
    <div class="card-header">
      <span class="card-title">FULL DEPTH</span>
      <span class="card-sub">drag \u2261 to reorder \xB7 order = who plays next</span>
    </div>
    <div class="do-tabs">
      ${tabs.map((pos) => pos === "__spots" ? `<button class="do-tab do-tab-spots${active === "__spots" ? " active" : ""}" data-do-tab="${side}:__spots">SPOTS</button>` : `<button class="do-tab${active === pos ? " active" : ""}" data-do-tab="${side}:${pos}"><span class="pos-chip pos-${pos}">${pos}</span><span class="do-tab-n">${(school.depthChart[pos] || []).length}</span></button>`).join("")}
    </div>
    ${active === "__spots" ? "" : (() => {
    const pos = active;
    const ids = (school.depthChart[pos] || []);
    return `
        <div class="do-group" data-drag-list="pos:${pos}">
          ${ids.map((id, i) => {
      const p = school.roster.find((x) => x.id === id);
      if (!p) return "";
      const committee = !gameplanIsSimple() && side === "offense" && pos === "RB" && i < 4 ? (() => {
        var _a2, _b, _c;
        const rbTop = (((_a2 = school.depthChart) == null ? void 0 : _a2.RB) || []).slice(0, 4);
        const anyDialed = rbTop.some((rid) => {
          var _a3, _b2;
          return (((_b2 = (_a3 = school.gameplan) == null ? void 0 : _a3.rbCarryShares) == null ? void 0 : _b2[rid]) || 0) > 0;
        });
        const pct = ((_c = (_b = school.gameplan) == null ? void 0 : _b.rbCarryShares) == null ? void 0 : _c[id]) || 0;
        return `
                <span class="do-carry" title="${anyDialed ? "Carry share \u2014 his slice of 100% of RB carries. 0% = benched from the run game." : "AUTO \u2014 the engine splits carries by scheme (FB inside, top back outside). Tap to take over with a real 100% split."}">
                  <button class="do-carry-btn" data-rbshare-step="-1" data-pid="${id}">\u2212</button>
                  <span class="do-carry-pct">\u{1F3C3}${anyDialed ? `${pct}%` : "auto"}</span>
                  <button class="do-carry-btn" data-rbshare-step="1" data-pid="${id}">+</button>
                </span>`;
      })() : "";
      return `
              <div class="do-row${i === 0 ? " do-starter" : ""}" data-pid="${id}">
                <button class="do-drag" data-drag-handle="1" aria-label="Drag to reorder ${escapeHtml(fullName(p))}">\u2261</button>
                ${(() => {
        var _a2;
        const hit = slotOf[id];
        const lbl = hit && hit.pos === pos && typeof hit.label === "string" ? hit.label.trim() : "";
        return lbl ? `<span class="do-slot" title="Lines up at ${escapeHtml(lbl)} in your ${side === "offense" ? escapeHtml(activeOffFormation) : escapeHtml(((_a2 = school.gameplan) == null ? void 0 : _a2.defBaseFront) || "4-3")}">${escapeHtml(lbl)}</span>` : `<span class="do-rank">${i + 1}</span>`;
      })()}
                <span class="do-name"><span class="player-link" data-pcard="${p.id}">${escapeHtml(fullName(p))}</span></span>
                <span class="class-badge class-${p.classYear.toLowerCase()}">${p.classYear}</span>
                ${(() => {
        var _a2;
        const role = formationRoleFor(pos, side, school, slotOf, id);
        const val = roleRatingShown(p, role);
        const ttl = role ? `${archetypeLabel(role) || role} \u2014 his fit for this spot in ${side === "offense" ? activeOffFormation : ((_a2 = school.gameplan) == null ? void 0 : _a2.defBaseFront) || "4-3"}. Overall ${Math.round(p.compositeRating)}.` : `Overall ${Math.round(p.compositeRating)}`;
        return `<span class="do-rating" style="color:${ratingColor(val)}" title="${escapeHtml(ttl)}">${val}</span>`;
      })()}
                <span class="do-arch">${escapeHtml(archetypeLabel(p) || "")}</span>
                ${committee}
              </div>`;
    }).join("")}
        </div>`;
  })()}
  ${(() => {
    if (active !== "__spots") return "";
    const uniq = side === "offense" ? UNIQUE_DEPTH_OFF : UNIQUE_DEPTH_DEF;
    if (!uniq.length) return "";
    const curForm = side === "offense" ? activeOffFormation : (school.gameplan || {}).defBaseFront || "4-3";
    const blocks = uniq.map((u) => {
      const top = uniqueDepthTop(school, u, 5);
      if (!top.length) return "";
      const live = u.forms.includes(curForm);
      const noteHtml = live ? `<span class="do-slot-note on">plays in ${escapeHtml(curForm)}</span>` : `<span class="do-slot-note">only in ${escapeHtml(u.forms.join(", "))}</span>`;
      const rows = top.map(({ p, fit }, i) => `
        <div class="do-row do-row-uniq${i === 0 ? " do-starter" : ""}" data-pid="${p.id}">
          <button class="do-drag" data-drag-handle="1" aria-label="Drag to reorder ${escapeHtml(fullName(p))}">\u2261</button>
          <span class="do-rank">${i + 1}</span>
          <span class="do-name"><span class="player-link" data-pcard="${p.id}">${escapeHtml(fullName(p))}</span></span>
          <span class="pos-chip pos-${p.position}" style="font-size:9px;padding:1px 5px">${p.position}</span>
          <span class="class-badge class-${p.classYear.toLowerCase()}">${p.classYear}</span>
          <span class="do-rating" style="color:${ratingColor(Math.round(fit))}" title="${escapeHtml((archetypeLabel(u.role) || u.role) + " fit \u2014 how well he plays this exotic spot. Overall " + Math.round(p.compositeRating) + ".")}">${Math.round(fit)}</span>
        </div>`).join("");
      return `
        <div class="do-group do-group-uniq">
          <div class="do-pos"><span class="pos-chip pos-${u.pos}">${escapeHtml(u.label)}</span>${noteHtml}<button class="do-uniq-swap" data-uniq-swap="${u.pos}" title="Choose who plays ${escapeHtml(u.label)} \u2014 full list by rating">Swap \u21C4</button></div>
          <div data-drag-list="uniq:${u.pos}">${rows}</div>
        </div>`;
    }).filter(Boolean).join("");
    if (!blocks) return "";
    return `
        <div class="do-uniq-sub-line">top fits \xB7 they play these spots only when the formation calls for it</div>
        ${blocks}`;
  })()}
  </div>
`;
}
function renderDefense(school, gp, front, defFronts) {
  const baseFront = front;
  const layout = DEF_FIELD_LAYOUTS[baseFront];
  if (!layout) return `<div class="card"><div class="empty-hint">Unknown front.</div></div>`;
  const identityFront = gp.defFront && gp.defFront !== "auto" ? gp.defFront : gp.defBaseFront || "4-3";
  const entry = gp.fieldAssignments.defense[baseFront] || { slots: {}, blitzShares: {} };
  const activeDepth = buildActiveDepth(school);
  const ratingById = buildRatingById(school);
  const resolved = resolveDefField(baseFront, entry.slots, entry.blitzShares, activeDepth, ratingById, posById(school), byId(school));
  const bySlot = (resolved == null ? void 0 : resolved.bySlot) || {};
  const eligible = new Set(DEF_BLITZ_ELIGIBLE[baseFront] || []);
  const dropEligible = new Set(DEF_DROP_ELIGIBLE[baseFront] || []);
  const blitzShares = entry.blitzShares || {};
  const blitzerCount = Object.values(blitzShares).filter((v) => v > 0).length;
  const simple = gameplanIsSimple();
  return `
  <div class="fielded-formation-picker ff-strip">
    ${(defFronts && defFronts.length ? defFronts : [baseFront]).filter((fid) => DEF_FIELD_LAYOUTS[fid]).map((fid) => `
      <button class="ff-pill${fid === baseFront ? " active" : ""}" data-dfront="${fid}">${fid}${fid === identityFront ? " \u2605" : ""}</button>`).join("")}
    <span class="ff-hint">\u2605 = your identity front \xB7 these are the fronts your defensive book calls \xB7 pins here apply whenever this front takes the field \xB7 situational subs are automatic</span>
  </div>

  <details class="dc-tip"${depthSecOpen["tip:defense"] ? " open" : ""} data-do-sec="tip:defense">
    <summary>How this screen works</summary>
    <div class="dc-tip-body">${simple ? `Tap a slot to change who lines up there. Blitzers are picked automatically \u2014 your best pass-rushers come when a blitz fires. Set how aggressive below.` : `Tap a slot to assign. The \u26A1 dials are the PRESSURE PIE \u2014 a 100% split of whose look it is when the blitz fires: a dialed man is your extra rusher (he abandons his coverage to come). Fire zones \u2014 dropping an edge man into coverage while a backer comes behind \u2014 fire automatically at their natural rate; you don't set them. HOW OFTEN pressure comes is the HEAT dial below, riding on top of your Game Plan blitz rate.`}</div>
  </details>

  <div class="field-card def-field">
    <div class="field-turf def-turf">
      ${(() => {
    const slotHtmlById = {};
    for (const s of layout.slots) slotHtmlById[s.id] = renderFieldSlot(school, s, bySlot[s.id], {
      side: "defense",
      containerId: baseFront,
      entry,
      blitzEligible: eligible.has(s.id),
      dropEligible: dropEligible.has(s.id),
      blitzShares
    });
    return renderTurfRows(layout, "defense", slotHtmlById);
  })()}
    </div>
  </div>

  ${simple ? renderSimpleDefPanel(school, gp) : (() => {
    const heat = entry.heat != null ? entry.heat : null;
    return `<div class="blitz-legend">
    <span class="blitz-dot"></span> <strong>PRESSURE PIE</strong> \u2014 when the blitz fires, whose look is it. <strong data-blitz-count>${blitzerCount}</strong> in the mix<span data-blitz-auto style="${blitzerCount === 0 ? "" : "display:none"}"> \u2014 auto (your best rusher comes)</span>.
    <span class="fs-blitz fs-heat${heat != null ? " on" : ""}" data-heat-ctl style="margin-left:8px" title="How often pressure comes when this front is on the field \u2014 multiplies your Game Plan blitz rate (0 = half as often, 50 = as dialed, 100 = half again more)">
      <span class="fs-heat-lbl">HEAT</span><button class="fs-blitz-btn" data-heat-step="-1" aria-label="Less heat">\u2212</button><span class="fs-blitz-val" data-heat-val>${heat == null ? "auto" : heat}</span><button class="fs-blitz-btn" data-heat-step="1" aria-label="More heat">+</button><button class="fs-blitz-btn" data-heat-reset="1" data-heat-reset-btn title="Back to auto (Game Plan rate untouched)" style="${heat != null ? "" : "display:none"}" aria-label="Reset heat to auto">\u21ba</button>
    </span>
    Base rate lives on <a data-nav="gameplan" class="link">Game Plan \xB7 Defense</a>.
  </div>`;
  })()}
  ${renderDepthOrder(school, "defense")}
`;
}
function renderSimpleDefPanel(school, gp) {
  const sg = gp.simple || (gp.simple = {});
  const aggr = sg.blitzAggr || "balanced";
  const AGG = [
    ["conservative", "Conservative", "Rush 4 \u2014 keep everyone in coverage"],
    ["balanced", "Balanced", "Occasional pressure from your best rusher"],
    ["aggressive", "Aggressive", "Send extra rushers often \u2014 sacks or busts"]
  ];
  return `
  <div class="card simple-gp-card">
    <div class="card-header"><span class="card-title">SIMPLE GAME PLAN</span>
      <span class="card-sub">blitzers auto-picked by rating</span></div>
    <div class="simple-gp-row">
      <div class="simple-gp-label">Pressure</div>
      <div class="simple-gp-desc">How aggressively you bring extra rushers. The sim sends your highest-rated pass-rushers when a blitz fires.</div>
      <div class="gp-options" style="flex-wrap:wrap">
        ${AGG.map(([v, l, d]) => `<button class="gp-option gp-option-sm${aggr === v ? " active" : ""}" data-simple-blitz="${v}" title="${d}">${l}</button>`).join("")}
      </div>
    </div>
  </div>
`;
}
function renderST(school) {
  const roster = (school == null ? void 0 : school.roster) || [];
  const depthOrder = (school == null ? void 0 : school.depthOrder) || {};
  return `
  <div class="depth-grid">
    <div class="depth-group depth-group-st">
      <div class="depth-group-header">SPECIAL TEAMS</div>
      ${["K", "P"].map((pos) => renderSTColumn(pos, depthOrder, roster)).join("")}
      ${renderReturnerColumn(school)}
    </div>
  </div>
`;
}
function renderReturnerColumn(school) {
  const roster = (school == null ? void 0 : school.roster) || [];
  const depthOrder = (school == null ? void 0 : school.depthOrder) || {};
  const pool = roster.filter((p) => ["RB", "WR", "CB", "S"].includes(p.position)).map((p) => ({ p, ret: Math.round(roleRating(p, "Returner")) })).sort((a, b) => b.ret - a.ret);
  const override = (depthOrder.RET || []).filter((id) => pool.find((x) => x.p.id === id));
  const overrideSet = new Set(override);
  const orderedIds2 = [...override, ...pool.filter((x) => !overrideSet.has(x.p.id)).map((x) => x.p.id)];
  const shown = orderedIds2.slice(0, 5);
  return `
  <div class="depth-col">
    <div class="depth-col-header"><span class="depth-pos">RET</span></div>
    <div class="depth-slots" data-drag-list="ret">
      ${shown.map((id, idx) => {
    const entry = pool.find((x) => x.p.id === id);
    if (!entry) return "";
    const p = entry.p;
    return `<div class="depth-slot${idx === 0 ? " starter" : ""}" data-pid="${p.id}">
          <button class="do-drag" data-drag-handle="1" aria-label="Drag to reorder ${escapeHtml(fullName(p))}">\u2261</button>
          <div class="depth-slot-rank">${idx + 1}</div>
          <div class="depth-slot-info">
            <div class="depth-slot-name"><span class="player-link" data-pcard="${p.id}">${escapeHtml(fullName(p))}</span> <span class="ret-pos">${p.position}</span></div>
          </div>
          <div class="ret-controls">
            <span class="depth-slot-rating ${ratingColor(entry.ret)}">${entry.ret}</span>
          </div>
        </div>`;
  }).join("")}
      ${shown.length === 0 ? '<div class="depth-slot empty">No eligible returners</div>' : ""}
    </div>
    <div class="ret-hint">Top man returns kicks &amp; punts. Drag to reorder.</div>
  </div>
`;
}
function renderSTColumn(pos, depthOrder, roster) {
  const inPool = roster.filter((p) => p.position === pos).sort((a, b) => b.compositeRating - a.compositeRating);
  const override = (depthOrder[pos] || []).filter((id) => inPool.find((p) => p.id === id));
  const overrideSet = new Set(override);
  const ordered = [...override, ...inPool.filter((p) => !overrideSet.has(p.id)).map((p) => p.id)];
  const starterCount = STARTER_COUNTS[pos] || 1;
  return `
  <div class="depth-col">
    <div class="depth-col-header"><span class="depth-pos">${pos}</span></div>
    <div class="depth-slots" data-drag-list="st:${pos}">
      ${ordered.map((id, idx) => {
    const p = roster.find((pl) => pl.id === id);
    if (!p) return "";
    return `<div class="depth-slot${idx < starterCount ? " starter" : ""}" data-pid="${p.id}">
          ${ordered.length > 1 ? `<button class="do-drag" data-drag-handle="1" aria-label="Drag to reorder ${escapeHtml(fullName(p))}">\u2261</button>` : ""}
          <div class="depth-slot-rank">${idx + 1}</div>
          <div class="depth-slot-info"><div class="depth-slot-name"><span class="player-link" data-pcard="${p.id}">${escapeHtml(fullName(p))}</span></div></div>
          <span class="depth-slot-rating ${ratingColor(Math.round(p.compositeRating))}">${Math.round(p.compositeRating)}</span>
        </div>`;
  }).join("")}
      ${ordered.length === 0 ? '<div class="depth-slot empty">Empty</div>' : ""}
    </div>
  </div>
`;
}
function bandLabel(slots, side) {
  const poss = new Set(slots.map((s) => s.pos));
  if (side === "defense") {
    if (poss.has("CB") && poss.has("S")) return "Secondary";
    if (poss.has("S")) return "Safeties";
    if (poss.has("CB")) return "Corners";
    if (poss.has("LB") || poss.has("OLB")) return "Linebackers";
    return "Line";
  }
  if (poss.has("OL")) return "Offensive Line";
  if (poss.has("QB")) return "Quarterback";
  if (poss.has("RB")) return "Backfield";
  return "Receivers";
}
function renderTurfRows(layout, side, slotHtmlById) {
  const sorted = [...layout.slots].sort((a, b) => a.y - b.y || a.x - b.x);
  const bands = [];
  for (const s of sorted) {
    const band = bands[bands.length - 1];
    if (band && Math.abs(s.y - band.y) <= 0.05) {
      band.slots.push(s);
    } else bands.push({ y: s.y, slots: [s] });
  }
  if (side === "offense") {
    const CATCH = /* @__PURE__ */ new Set(["TE", "WR", "SLOT"]);
    const isRecvBand = (b) => b.slots.some((s) => CATCH.has(s.pos));
    for (const b of bands) {
      if (!b.slots.some((s) => s.pos === "OL")) continue;
      const movers = b.slots.filter((s) => CATCH.has(s.pos));
      if (!movers.length) continue;
      b.slots = b.slots.filter((s) => !CATCH.has(s.pos));
      let recv = bands.find((x) => x !== b && isRecvBand(x));
      if (!recv) {
        recv = { y: b.y - 1e-3, slots: [] };
        bands.splice(bands.indexOf(b), 0, recv);
      }
      recv.slots.push(...movers);
    }
  }
  const visibleBands = bands.filter((b) => b.slots.length);
  if (side === "offense") {
    visibleBands.sort((a, b) => {
      const aLine = a.slots.some((s) => s.pos === "OL") ? 0 : 1;
      const bLine = b.slots.some((s) => s.pos === "OL") ? 0 : 1;
      return aLine - bLine || a.y - b.y;
    });
  }
  let lastBand = null;
  return visibleBands.map((b) => {
    let lbl = bandLabel(b.slots, side);
    if (lbl === lastBand) lbl = "";
    else lastBand = lbl;
    return `
  <div class="frow" data-band="${escapeHtml(lbl)}"
       data-unit="${b.slots.some((s) => s.pos === "OL") ? "line" : "skill"}">
    ${b.slots.sort((a, c) => a.x - c.x).map((s) => slotHtmlById[s.id]).join("")}
  </div>`;
  }).join("");
}
function renderFieldSlot(school, slot, playerId, opts) {
  var _a;
  const roster = (school == null ? void 0 : school.roster) || [];
  const p = playerId ? roster.find((pl) => pl.id === playerId) : null;
  const rat = p ? slotRating(p, slot) : null;
  const fx = (slot.x * 100).toFixed(1);
  const fy = (slot.y * 100).toFixed(1);
  const injured = p && p.injuryGamesOut > 0;
  const simple = gameplanIsSimple();
  const shareBadge = !simple && opts.side === "offense" && slot.catch ? renderShareControl(slot, opts.entry) : opts.side === "offense" && slot.catch && simple ? renderSimpleShareBadge(slot, opts.entry) : "";
  // Item 4 (owner, 2026-08-12): the fire-zone DROP dial is gone — in a 3-4/Penny
  // the edge men HAVE to rush, so who drops is automatic (the sim's native
  // fire-zone rate), not a control. Only the ⚡ blitz dial is user-facing now.
  const blitzControl = simple ? "" : opts.side === "defense" && opts.blitzEligible ? renderBlitzControl(slot, opts.blitzShares) : "";
  const hasShare = opts.side === "defense" && ((_a = opts.blitzShares) == null ? void 0 : _a[slot.id]) > 0;
  const isBlitzing = hasShare && opts.blitzEligible;
  return `
  <div class="field-slot${p ? "" : " unassigned"}${isBlitzing ? " blitzing" : ""}"
       style="--fx:${fx}%;--fy:${fy}%"
       data-slot-id="${slot.id}" data-slot-pos="${slot.pos}"
       data-side="${opts.side}" data-container="${opts.containerId}">
    <div class="fs-label">${escapeHtml(slot.label)}</div>
    <div class="fs-body" data-open-picker="1">
      ${p ? `
        <div class="fs-name">${escapeHtml(shortName(p))}</div>
        <div class="fs-meta">
          <span class="fs-rating ${ratingColor(rat)}">${rat}</span>
          ${derivedArchetype(p) ? `<span class="fs-arch">${archetypeLabel(derivedArchetype(p)) || ""}</span>` : ""}
          ${injured ? `<span class="injury-badge">${p.injuryGamesOut}g</span>` : ""}
        </div>
      ` : `<div class="fs-empty">\u2014 tap \u2014</div>`}
    </div>
    ${shareBadge}
    ${blitzControl}
  </div>
`;
}
// BLITZ PIE: both controls display the slot's NORMALIZED slice of the front's
// one 100% pressure allocation (legacy plans with independent dials read as
// their relative weights \u2014 the read-time translation, no save mutation).
function _pieShareOf(slot, blitzShares) {
  const raw = (blitzShares == null ? void 0 : blitzShares[slot.id]) || 0;
  if (!raw) return 0;
  let tot = 0;
  for (const v of Object.values(blitzShares)) if (v > 0) tot += v;
  return tot > 0 ? Math.round(raw / tot * 100) : 0;
}
function renderBlitzControl(slot, blitzShares) {
  const val = _pieShareOf(slot, blitzShares);
  return `
  <div class="fs-blitz${val > 0 ? " on" : ""}" data-blitz-ctl="${slot.id}" data-blitz-kind="blitz" title="His slice of the pressure pie \u2014 the share of fired blitzes where HE is the extra man. Slices sum to 100 across the front.">
    <span class="fs-blitz-tag">\u26a1 BLITZ</span>
    <button class="fs-blitz-btn" data-blitz-step="-1" data-blitz-slot="${slot.id}" aria-label="Less blitz for ${escapeHtml(slot.label)}">\u2212</button>
    <span class="fs-blitz-val" data-blitz-val="${slot.id}">${val ? val + "%" : "\u2014"}</span>
    <button class="fs-blitz-btn" data-blitz-step="1" data-blitz-slot="${slot.id}" aria-label="More blitz for ${escapeHtml(slot.label)}">+</button>
  </div>
`;
}
function renderDropControl(slot, blitzShares) {
  const val = _pieShareOf(slot, blitzShares);
  return `
  <div class="fs-blitz fs-drop${val > 0 ? " on" : ""}" data-blitz-ctl="${slot.id}" data-blitz-kind="drop" title="His slice of the pressure pie \u2014 the share of fired blitzes that are a FIRE ZONE through him: he drops into coverage and a backer comes behind. Undialed, he still bails naturally on ~${C.FZ_NATIVE_DROP_PCT}% of snaps.">
    <span class="fs-blitz-tag">\u{1F6E1} DROP</span>
    <button class="fs-blitz-btn" data-blitz-step="-1" data-blitz-slot="${slot.id}" aria-label="Less drop for ${escapeHtml(slot.label)}">\u2212</button>
    <span class="fs-blitz-val" data-blitz-val="${slot.id}">${val ? val + "%" : "\u2014"}</span>
    <button class="fs-blitz-btn" data-blitz-step="1" data-blitz-slot="${slot.id}" aria-label="More drop for ${escapeHtml(slot.label)}">+</button>
  </div>
`;
}
function setSplitRebalanced(map, keys, key, want) {
  normalizeShares(map, keys);
  want = Math.max(0, Math.min(100, Math.round(want / 5) * 5));
  map[key] = want;
  const others = keys.filter((k) => k !== key);
  const rem = 100 - want;
  const curOthers = others.reduce((s, k) => s + (map[k] || 0), 0);
  others.forEach((k) => {
    const shareOf = curOthers > 0 ? (map[k] || 0) / curOthers : 1 / others.length;
    map[k] = Math.max(0, Math.round(rem * shareOf));
  });
  const drift = 100 - keys.reduce((s, k) => s + (map[k] || 0), 0);
  if (drift !== 0 && others.length) {
    const big = others.reduce((a, b) => (map[b] || 0) > (map[a] || 0) ? b : a);
    map[big] = Math.max(0, (map[big] || 0) + drift);
  }
}
function normalizeShares(map, keys) {
  for (const k of Object.keys(map)) if (!keys.includes(k)) delete map[k];
  let tot = keys.reduce((s, k) => s + (map[k] || 0), 0);
  if (tot === 100) return;
  if (tot <= 0) {
    const even = Math.floor(100 / keys.length / 5) * 5;
    keys.forEach((k) => {
      map[k] = even;
    });
  } else {
    keys.forEach((k) => {
      map[k] = Math.round((map[k] || 0) / tot * 20) * 5;
    });
  }
  let drift = 100 - keys.reduce((s, k) => s + (map[k] || 0), 0);
  while (drift !== 0 && keys.length) {
    const stepDir = drift > 0 ? 5 : -5;
    const pick2 = drift > 0 ? keys.reduce((a, b) => (map[b] || 0) > (map[a] || 0) ? b : a) : keys.filter((k) => (map[k] || 0) >= 5).reduce((a, b) => (map[b] || 0) > (map[a] || 0) ? b : a, keys[0]);
    map[pick2] = Math.max(0, (map[pick2] || 0) + stepDir);
    drift -= stepDir;
  }
}
// Item 4 polish: patch the pressure-pie controls in place instead of a full
// rerender, so a +/- press doesn't flicker or reset scroll and only the shares
// that actually changed move. The pie still renormalizes under the hood (the sim
// reads the shares), but the screen stays put.
function repaintBlitzShares(map) {
  let tot = 0;
  for (const v of Object.values(map || {})) if (v > 0) tot += v;
  let dialed = 0;
  document.querySelectorAll("[data-blitz-ctl]").forEach((ctl) => {
    const sid = ctl.dataset.blitzCtl;
    const raw = (map && map[sid]) || 0;
    const pct = raw > 0 && tot > 0 ? Math.round(raw / tot * 100) : 0;
    if (raw > 0) dialed++;
    const valEl = ctl.querySelector("[data-blitz-val]");
    if (valEl) valEl.textContent = pct ? pct + "%" : "—";
    ctl.classList.toggle("on", raw > 0);
    const slotEl = ctl.closest(".field-slot");
    if (slotEl) {
      const kind = ctl.dataset.blitzKind;
      slotEl.classList.toggle("blitzing", raw > 0 && kind === "blitz");
      slotEl.classList.toggle("dropping", raw > 0 && kind === "drop");
    }
  });
  const cnt = document.querySelector("[data-blitz-count]");
  if (cnt) cnt.textContent = String(dialed);
  const auto = document.querySelector("[data-blitz-auto]");
  if (auto) auto.style.display = dialed === 0 ? "" : "none";
}
function repaintOffShares(gp, formationId) {
  var _a, _b;
  const entry = (_b = (_a = gp.fieldAssignments) == null ? void 0 : _a.offense) == null ? void 0 : _b[formationId];
  const layout = OFF_FIELD_LAYOUTS[formationId];
  if (!(entry == null ? void 0 : entry.shares) || !layout) return;
  layout.slots.filter((s) => s.catch).forEach((s) => {
    var _a2;
    const val = entry.shares[s.id] || 0;
    const barPct = document.querySelector(`[data-share-pct="${s.id}"]`);
    if (barPct) barPct.textContent = `${val}%`;
    const step = document.querySelector(`[data-share-step="1"][data-slot="${s.id}"]`);
    const fieldPct = (_a2 = step == null ? void 0 : step.parentElement) == null ? void 0 : _a2.querySelector(".fs-share-pct");
    if (fieldPct) fieldPct.textContent = `${val}%`;
    const sld = document.querySelector(`[data-share-slider="${s.id}"]`);
    if (sld && +sld.value !== val) sld.value = val;
  });
}
function renderShareControl(slot, entry) {
  var _a;
  const pct = ((_a = entry.shares) == null ? void 0 : _a[slot.id]) || 0;
  return `
  <div class="fs-share" title="Target share \u2014 his slice of 100% of the QB's looks. Feed one man enough and he goes featured (\u2605), which draws brackets.">
    <button class="fs-share-btn" data-share-step="-1" data-slot="${slot.id}">\u2212</button>
    <span class="fs-share-pct">${pct}%</span>
    <button class="fs-share-btn" data-share-step="1" data-slot="${slot.id}">+</button>
  </div>
`;
}
function renderSimpleShareBadge(slot, entry) {
  var _a;
  const featured = ((_a = entry.shares) == null ? void 0 : _a[slot.id]) || 0;
  if (featured >= 25) return `<div class="fs-featured" title="Featured target \u2014 the offense feeds him the ball (defenses bracket him)">\u2605</div>`;
  return "";
}
function renderShareBar(catchSlots, shares, shareTotal, school, bySlot, gp, fid) {
  const roster = (school == null ? void 0 : school.roster) || [];
  const legacy = (gp == null ? void 0 : gp.targetShares) || {};
  const defaults = (gp == null ? void 0 : gp.defaultShares) || null;
  let anyDiffers = false;
  const rows = catchSlots.map((s) => {
    const pid = bySlot[s.id];
    const p = pid ? roster.find((pl) => pl.id === pid) : null;
    const raw = (shares == null ? void 0 : shares[s.id]) || 0;
    const def = defaultShareFor(s, legacy, defaults);
    const differs = raw !== def;
    if (differs) anyDiffers = true;
    return `
          <div class="share-row">
            <span class="share-slot-label">${escapeHtml(s.label)}</span>
            <span class="share-slot-name">${p ? escapeHtml(shortName(p)) : "\u2014"}</span>
            <input class="share-slider" type="range" min="0" max="100" step="5" value="${raw}"
                   data-share-slider="${s.id}">
            <span class="share-slot-pct" data-share-pct="${s.id}">${raw}%</span>
            ${differs ? `<span class="share-diff-badge" title="Differs from your Game Plan default of ${def}%">\u2260 default</span>` : `<span class="share-diff-badge share-diff-none"></span>`}
          </div>`;
  }).join("");
  return `
  <div class="card share-summary">
    <div class="card-header"><span class="card-title">TARGET SHARE</span>
      <span class="card-sub">who the QB looks for \xB7 per slot</span>
      ${anyDiffers && fid ? `<button class="btn-ghost btn-sm" type="button" data-share-reset="${escapeHtml(fid)}">Reset to default</button>` : ""}</div>
    <div class="share-rows">
      ${rows}
    </div>
  </div>
`;
}
function renderPicker2(school) {
  const roster = (school == null ? void 0 : school.roster) || [];
  const { side, containerId, slotId, pos, label, variation } = picker;
  const slots = side === "offense"
    ? (offFieldSlots(containerId, variation) || [])
    : ((DEF_FIELD_LAYOUTS[containerId] || {}).slots || []);
  const slot = slots.find((s) => s.id === slotId);
  const entry = side === "offense" ? school.gameplan.fieldAssignments.offense[containerId] : school.gameplan.fieldAssignments.defense[containerId];
  const activeDepth = buildActiveDepth(school);
  const ratingById = buildRatingById(school);
  const resolved = side === "offense" ? resolveOffField(containerId, entry.slots, entry.shares, activeDepth, ratingById, posById(school), byId(school), variation) : resolveDefField(containerId, entry.slots, entry.blitzShares || {}, activeDepth, ratingById, posById(school), byId(school));
  const bySlot = (resolved == null ? void 0 : resolved.bySlot) || {};
  const currentId = bySlot[slotId] || null;
  const takenElsewhere = new Set(
    Object.entries(bySlot).filter(([sid]) => sid !== slotId).map(([, pid]) => pid).filter(Boolean)
  );
  const SHARED_POS = {
    RB: ["RB"],
    WR: ["WR"],
    // X / Z — split end and flanker
    SLOT: ["WR", "TE", "RB"],
    // the joker
    ABACK: ["RB", "WR", "TE"],
    // flexbone wing — any skill body (RB includes fullback types)
    WING: ["RB", "TE"],
    // wishbone halfback — power bodies
    WILDCAT: ["RB", "WR", "QB"],
    // direct-snap taker — even a runner QB
    JETMAN: ["WR", "RB"],
    // jet-motion man — pure speed
    TE: ["TE", "WR"],
    OL: ["OL", "TE"]
  };
  const isFbSlot = slot && (slot.role === "FB-Lead" || slot.label === "FB" || slot.label === "B");
  // Defensive job mesh (identity Stage 0, Aug 2026): a mesh-keyed job slot
  // (NB / OVERHANG / STACKER / SPACE) pools every eligible body from the SAME
  // table the resolver enforces (SLOT_ELIGIBLE_POS — three-places law), sorted
  // by job fit: role rating × the existing SLOT_ELIGIBILITY discount for an
  // out-of-native body. Base 4-3 / 3-4 slots carry no mesh key — unchanged.
  const meshPool = slot && slot.mesh ? SLOT_ELIGIBLE_POS[slot.mesh] : null;
  const posList = isFbSlot ? ["RB", "TE"] : meshPool || SHARED_POS[pos] || [pos];
  // Identity stage 2: a bridge trait that covers this job waives the
  // out-of-native discount (full rate) — and lists a body the mesh pool alone
  // would refuse (a Space Backer OLB shows up at ROVER). Stage 1: the job's
  // size window multiplies the fit (picker sort only — 1.0 in-window).
  const jobFitMult = (p) => {
    var _a2;
    if (slot && bridgeCoversSlot(p, slot)) return 1;
    const elig = meshPool ? (_a2 = (SLOT_ELIGIBILITY[slot.pos] || {})[p.position]) != null ? _a2 : 1 : 1;
    return elig * sizeFitForSlot(p, slot);
  };
  const listed = (p) => posList.includes(p.position) || slot && bridgeCoversSlot(p, slot);
  const candidates = roster.filter(listed).map((p) => ({ p, rat: Math.round(slotRating(p, slot) * jobFitMult(p)) })).sort((a, b) => b.rat - a.rat);
  return `
  <div class="picker-overlay" data-picker-close="bg">
    <div class="picker-panel" data-picker-stop="1">
      <div class="picker-head">
        <div>
          <div class="picker-title">${escapeHtml(label || slotId)}</div>
          <div class="picker-sub">${posList.join("/")} \xB7 sorted by fit for this slot</div>
        </div>
        <button class="picker-x" data-picker-close="x">\u2715</button>
      </div>
      <div class="picker-list">
        <div class="picker-item picker-auto${currentId ? "" : " active"}" data-pick="__auto__">
          <span class="picker-name">Auto (best available)</span>
          <span class="picker-tag">default</span>
        </div>
        ${candidates.map(({ p, rat }) => `
          <div class="picker-item${p.id === currentId ? " active" : ""}" data-pick="${p.id}">
            <span class="picker-name">${escapeHtml(fullName(p))}</span>
            <span class="picker-meta">
              <span class="pos-chip pos-${p.position}">${p.position}</span>
              <span class="class-badge class-${p.classYear.toLowerCase()}">${p.classYear}</span>
              ${derivedArchetype(p) ? `<span class="fs-arch">${archetypeLabel(derivedArchetype(p)) || ""}</span>` : ""}
              ${takenElsewhere.has(p.id) ? `<span class="picker-taken">in lineup</span>` : ""}
              <span class="fs-rating ${ratingColor(rat)}">${rat}</span>
            </span>
          </div>
        `).join("")}
        ${candidates.length === 0 ? '<div class="empty-hint">No players at this position.</div>' : ""}
      </div>
    </div>
  </div>
`;
}
function roleRatingShown(p, role) {
  var _a;
  if (!role || ((_a = p.roleRatings) == null ? void 0 : _a[role]) == null) return Math.round(p.compositeRating);
  return Math.round(posAdjust(p.roleRatings[role], p.position));
}
function slotRating(p, slot) {
  return roleRatingShown(p, slot == null ? void 0 : slot.role);
}
function shortName(p) {
  return `${p.name.first[0]}. ${p.name.last}`;
}
function buildActiveDepth(school) {
  var _a, _b, _c;
  const roster = (school == null ? void 0 : school.roster) || [];
  const byId = new Map(roster.map((p) => [p.id, p]));
  const eligible = (p) => p && p.injuryGamesOut === 0 && !(p.redshirted && p.redshirtYear === state.season);
  const depth = {};
  for (const [pos, ids] of Object.entries((school == null ? void 0 : school.depthChart) || {})) {
    const kept = (ids || []).filter((id) => eligible(byId.get(id)));
    if (kept.length) depth[pos] = kept;
  }
  for (const p of roster) {
    if (!eligible(p)) continue;
    const list = depth[_a = p.position] || (depth[_a] = []);
    if (!list.includes(p.id)) list.push(p.id);
  }
  const slotPool = roster.filter((p) => eligible(p) && SLOT_ELIGIBLE.includes(p.position)).map((p) => ({ id: p.id, fit: roleRating(p, "WR-Slot") })).sort((a, b) => b.fit - a.fit).slice(0, SLOT_DEPTH_SHOWN).map((x) => x.id);
  const slotRanked = (((_b = school == null ? void 0 : school.depthOrder) == null ? void 0 : _b.SLOT) || []).filter((id) => eligible(byId.get(id)));
  const slotSet = new Set(slotRanked);
  depth.SLOT = [...slotRanked, ...slotPool.filter((id) => !slotSet.has(id))];
  for (const upos of ["FB", "ABACK", "WING", "WILDCAT", "JETMAN"]) {
    const ov = (((school == null ? void 0 : school.depthOrder) || {})[upos] || []).filter((id) => eligible(byId.get(id)));
    if (ov.length) depth[upos] = ov;
  }
  for (const pos of Object.keys(depth)) {
    if (pos === "SLOT" || ["FB", "ABACK", "WING", "WILDCAT", "JETMAN"].includes(pos)) continue;
    const listed = new Set(((_c = school == null ? void 0 : school.depthChart) == null ? void 0 : _c[pos]) || []);
    const ranked = depth[pos].filter((id) => listed.has(id));
    const extras = depth[pos].filter((id) => !listed.has(id)).sort((a, b) => {
      var _a2, _b2;
      return (((_a2 = byId.get(b)) == null ? void 0 : _a2.compositeRating) || 0) - (((_b2 = byId.get(a)) == null ? void 0 : _b2.compositeRating) || 0);
    });
    depth[pos] = [...ranked, ...extras];
  }
  return depth;
}
function posById(school) {
  const m = new Map(((school == null ? void 0 : school.roster) || []).map((p) => [p.id, p.position]));
  return (id) => m.get(id) || null;
}
// identity stage 2: full player-object lookup so the resolver can read
// bridge traits + frames (see fieldassign playerById)
function byId(school) {
  const m = new Map(((school == null ? void 0 : school.roster) || []).map((p) => [p.id, p]));
  return (id) => m.get(id) || null;
}
function buildRatingById(school) {
  return Object.fromEntries(((school == null ? void 0 : school.roster) || []).map((p) => [p.id, p.compositeRating]));
}
function findScrollParent(el) {
  let n = el.parentElement;
  while (n) {
    const s = getComputedStyle(n);
    if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight) return n;
    n = n.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}
function depthDragOrder(school, kind) {
  var _a, _b;
  if (kind.indexOf("pos:") === 0) {
    return [...((_a = school.depthChart) == null ? void 0 : _a[kind.slice(4)]) || []];
  }
  if (kind.indexOf("uniq:") === 0) {
    const u = UNIQUE_DEPTH_OFF.find((x) => x.pos === kind.slice(5));
    return u ? uniqueDepthTop(school, u, 999).map((x) => x.p.id) : [];
  }
  if (kind === "ret") {
    const roster = school.roster || [];
    const pool = roster.filter((p) => ["RB", "WR", "CB", "S"].includes(p.position)).map((p) => ({ id: p.id, ret: roleRating(p, "Returner") })).sort((a, b) => b.ret - a.ret).map((x) => x.id);
    const existing = (((_b = school.depthOrder) == null ? void 0 : _b.RET) || []).filter((x) => pool.includes(x));
    const overrideSet = new Set(existing);
    return [...existing, ...pool.filter((x) => !overrideSet.has(x))];
  }
  if (kind.indexOf("st:") === 0) {
    const pos = kind.slice(3);
    const inPool = (school.roster || []).filter((p) => p.position === pos).sort((a, b) => b.compositeRating - a.compositeRating);
    const override = ((school.depthOrder || {})[pos] || []).filter((id) => inPool.find((p) => p.id === id));
    const overrideSet = new Set(override);
    return [...override, ...inPool.filter((p) => !overrideSet.has(p.id)).map((p) => p.id)];
  }
  return [];
}
function applyDepthReorder(kind, pid, to) {
  const school = getPlayerSchool();
  if (!school) return;
  const cur = depthDragOrder(school, kind);
  const from = cur.indexOf(pid);
  if (from < 0) return;
  cur.splice(from, 1);
  cur.splice(Math.max(0, Math.min(to, cur.length)), 0, pid);
  school.depthOrder = school.depthOrder || {};
  if (kind.indexOf("pos:") === 0) {
    school.depthOrder[kind.slice(4)] = cur;
    school.depthChart = buildDepthChart(school.roster, school.gameplan, school.depthOrder);
  } else if (kind.indexOf("uniq:") === 0) {
    school.depthOrder[kind.slice(5)] = cur;
  } else if (kind === "ret") {
    school.depthOrder.RET = cur;
  } else if (kind.indexOf("st:") === 0) {
    school.depthOrder[kind.slice(3)] = cur;
    school.depthChart = buildDepthChart(school.roster, school.gameplan, school.depthOrder);
  }
  rerender();
}
function setupDepthDrag() {
  document.querySelectorAll("[data-drag-list]").forEach((listEl) => {
    const kind = listEl.dataset.dragList;
    listEl.querySelectorAll("[data-drag-handle]").forEach((handle) => {
      handle.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const row = handle.closest("[data-pid]");
        if (!row) return;
        const rows = [...listEl.querySelectorAll("[data-pid]")];
        const startIdx = rows.indexOf(row);
        if (startIdx < 0) return;
        const rects = rows.map((r) => r.getBoundingClientRect());
        const rowH = rects[startIdx].height;
        const scroller = findScrollParent(listEl);
        const startScroll = scroller.scrollTop;
        const startY = rects[startIdx].top + rowH / 2;
        let to = startIdx;
        let moved = false;
        row.classList.add("do-dragging");
        try {
          handle.setPointerCapture(e.pointerId);
        } catch (err) {
        }
        const onMove = (ev) => {
          const y = ev.clientY + (scroller.scrollTop - startScroll);
          if (!moved && Math.abs(y - startY) < 4) return;
          moved = true;
          row.style.transform = `translateY(${y - startY}px)`;
          let above = 0;
          for (let k = 0; k < rows.length; k++) {
            if (k === startIdx) continue;
            if (y > rects[k].top + rects[k].height / 2) above++;
          }
          to = above;
          rows.forEach((r, k) => {
            if (k === startIdx) return;
            const kk = k < startIdx ? k : k - 1;
            const shift = (kk >= to ? rowH : 0) + (k > startIdx ? -rowH : 0);
            r.style.transform = shift ? `translateY(${shift}px)` : "";
          });
          const vh = window.innerHeight || 800;
          if (ev.clientY < 90) scroller.scrollTop -= 14;
          else if (ev.clientY > vh - 90) scroller.scrollTop += 14;
        };
        const finish = (commit) => {
          handle.removeEventListener("pointermove", onMove);
          handle.removeEventListener("pointerup", onUp);
          handle.removeEventListener("pointercancel", onCancel);
          rows.forEach((r) => {
            r.style.transform = "";
          });
          row.classList.remove("do-dragging");
          if (commit && moved && to !== startIdx) applyDepthReorder(kind, row.dataset.pid, to);
        };
        const onUp = () => finish(true);
        const onCancel = () => finish(false);
        handle.addEventListener("pointermove", onMove);
        handle.addEventListener("pointerup", onUp);
        handle.addEventListener("pointercancel", onCancel);
      });
    });
  });
}
// Naming a man on the field view pins him for the resolver, but the pin used to
// live ONLY in gameplan.fieldAssignments — the position room itself stayed sorted
// by rating, so a 49-over-50 call flipped back the moment either man gained a
// point in practice. Mirror the pin into school.depthOrder so the room agrees
// with the field and the choice survives the season.
function pinRoomOf(school, pid) {
  var _a;
  if (!pid) return null;
  const pos = (_a = (school.roster || []).find((p) => p.id === pid)) == null ? void 0 : _a.position;
  if (!pos) return null;
  school.depthOrder = school.depthOrder || {};
  const current = school.depthOrder[pos] || (school.depthChart || {})[pos] || [];
  return { pos, current: current.filter((id) => id !== pid) };
}
function promoteInRoom(school, pid) {
  const r = pinRoomOf(school, pid);
  if (!r) return;
  school.depthOrder[r.pos] = [pid, ...r.current];
}
function demoteInRoom(school, pid) {
  const r = pinRoomOf(school, pid);
  if (!r) return;
  const order = school.depthOrder[r.pos];
  // Only undo OUR promotion — a hand-dragged room order is the coach's and stays.
  if (!order || order[0] !== pid) return;
  if (r.current.length === 0) delete school.depthOrder[r.pos];
  else school.depthOrder[r.pos] = r.current;
}
function setupListeners9() {
  var _a, _b, _c;
  const school = getPlayerSchool();
  if (!school) return;
  const gp = school.gameplan;
  ensureFieldAssignments(gp);
  document.querySelectorAll("[data-do-sec]").forEach((d) => {
    d.addEventListener("toggle", () => {
      depthSecOpen[d.dataset.doSec] = d.open;
    });
  });
  document.querySelectorAll("[data-do-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const parts = btn.dataset.doTab.split(":");
      depthPosTab[parts[0]] = parts[1];
      rerender();
    });
  });
  setupDepthDrag();
  document.querySelectorAll("[data-dtab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      depthTab = btn.dataset.dtab;
      picker = null;
      formationInfoOpen = false;
      rerender();
    });
  });
  document.querySelectorAll("[data-dfront]").forEach((btn) => {
    btn.addEventListener("click", () => {
      defFrontTab = btn.dataset.dfront;
      picker = null;
      rerender();
    });
  });
  document.querySelectorAll("[data-off-look]").forEach((btn) => {
    btn.addEventListener("click", () => {
      // The pill carries the LOOK key (lookSheetKey shape: "Flexbone|trips"),
      // so picking a look sets the variation too — the screen then draws and
      // resolves the dressed personnel the sim actually fields.
      const raw = btn.dataset.offLook || "";
      const bar = raw.indexOf("|");
      activeOffFormation = bar < 0 ? raw : raw.slice(0, bar);
      activeOffVariation = bar < 0 ? null : raw.slice(bar + 1);
      formationInfoOpen = false;
      rerender();
    });
  });
  (_a = document.querySelector("[data-formation-info-open]")) == null ? void 0 : _a.addEventListener("click", () => {
    formationInfoOpen = true;
    rerender();
  });
  document.querySelectorAll("[data-formation-info-close]").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (el.dataset.formationInfoClose === "stop") {
        e.stopPropagation();
        return;
      }
      if (el.dataset.formationInfoClose === "bg" && e.target !== el) return;
      formationInfoOpen = false;
      rerender();
    });
  });
  document.querySelectorAll(".field-slot [data-open-picker]").forEach((el) => {
    el.addEventListener("click", (e) => {
      var _a2;
      const slotEl = e.target.closest(".field-slot");
      if (!slotEl) return;
      const side = slotEl.dataset.side;
      const containerId = slotEl.dataset.container;
      const slotId = slotEl.dataset.slotId;
      const pos = slotEl.dataset.slotPos;
      // The picker must be opened against the DRESSED slot: `pos` comes off the
      // rendered slot, and for a re-dressed body (Trips' RB_H reads SLOT, not
      // ABACK) that is what decides which room we offer. Carrying the variation
      // keeps the offer (hop 1) and the resolver's gate (hop 2) speaking about
      // the same slot.
      const variation = side === "offense" ? activeOffVariation : null;
      const slots = side === "offense"
        ? (offFieldSlots(containerId, variation) || [])
        : ((DEF_FIELD_LAYOUTS[containerId] || {}).slots || []);
      const label = ((_a2 = slots.find((s) => s.id === slotId)) == null ? void 0 : _a2.label) || slotId;
      picker = { side, containerId, slotId, pos, label, variation };
      rerender();
    });
  });
  document.querySelectorAll("[data-picker-close]").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (el.dataset.pickerClose === "bg" && e.target !== el) return;
      picker = null;
      rerender();
    });
  });
  (_b = document.querySelector("[data-picker-stop]")) == null ? void 0 : _b.addEventListener("click", (e) => e.stopPropagation());
  document.querySelectorAll("[data-pick]").forEach((el) => {
    el.addEventListener("click", () => {
      if (!picker) return;
      const val = el.dataset.pick;
      const entry = picker.side === "offense" ? gp.fieldAssignments.offense[picker.containerId] : gp.fieldAssignments.defense[picker.containerId];
      if (!entry.slots) entry.slots = {};
      const prevPinned = entry.slots[picker.slotId] || null;
      if (val === "__auto__") {
        delete entry.slots[picker.slotId];
        demoteInRoom(school, prevPinned);
      } else {
        for (const [sid, pid] of Object.entries(entry.slots)) {
          if (pid === val && sid !== picker.slotId) delete entry.slots[sid];
        }
        entry.slots[picker.slotId] = val;
        if (prevPinned && prevPinned !== val) demoteInRoom(school, prevPinned);
        promoteInRoom(school, val);
      }
      picker = null;
      rerender();
    });
  });
  const setShareRebalanced = (map, layoutSlots, slotId, want) => setSplitRebalanced(map, layoutSlots.map((s) => s.id), slotId, want);
  document.querySelectorAll("[data-share-step]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const entry = gp.fieldAssignments.offense[activeOffFormation];
      const slotId = btn.dataset.slot;
      const step = parseInt(btn.dataset.shareStep, 10) * 5;
      if (!entry.shares) entry.shares = {};
      const catchSlots = OFF_FIELD_LAYOUTS[activeOffFormation].slots.filter((s) => s.catch);
      setShareRebalanced(entry.shares, catchSlots, slotId, (entry.shares[slotId] || 0) + step);
      repaintOffShares(gp, activeOffFormation);
    });
  });
  document.querySelectorAll("[data-rbshare-step]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      var _a2;
      e.stopPropagation();
      const school2 = getPlayerSchool();
      const pid = btn.dataset.pid;
      const step = parseInt(btn.dataset.rbshareStep, 10) * 5;
      const gpn = school2.gameplan;
      if (!gpn.rbCarryShares) gpn.rbCarryShares = {};
      const rbIds = (((_a2 = school2.depthChart) == null ? void 0 : _a2.RB) || []).slice(0, 4);
      const anyDialed = rbIds.some((id) => (gpn.rbCarryShares[id] || 0) > 0);
      if (!anyDialed) {
        const seed = [55, 30, 15, 0];
        rbIds.forEach((id, i) => {
          var _a3;
          gpn.rbCarryShares[id] = (_a3 = seed[i]) != null ? _a3 : 0;
        });
      }
      setSplitRebalanced(gpn.rbCarryShares, rbIds, pid, (gpn.rbCarryShares[pid] || 0) + step);
      rbIds.forEach((id) => {
        var _a3;
        const b = document.querySelector(`[data-rbshare-step="1"][data-pid="${id}"]`);
        const pctEl = (_a3 = b == null ? void 0 : b.parentElement) == null ? void 0 : _a3.querySelector(".do-carry-pct");
        if (pctEl) pctEl.textContent = `\u{1F3C3}${gpn.rbCarryShares[id] || 0}%`;
      });
    });
  });
  document.querySelectorAll("[data-uniq-swap]").forEach((btn) => btn.addEventListener("click", (e) => {
    e.stopPropagation();
    uniqSwap = btn.dataset.uniqSwap;
    rerender();
  }));
  document.querySelectorAll("[data-uniq-pick]").forEach((el) => el.addEventListener("click", () => {
    const school2 = getPlayerSchool();
    const upos = uniqSwap;
    const pid = el.dataset.uniqPick;
    const u = UNIQUE_DEPTH_OFF.find((x) => x.pos === upos);
    if (u) {
      school2.depthOrder = school2.depthOrder || {};
      if (pid === "__auto__") {
        delete school2.depthOrder[upos];
      } else {
        const rest = uniqueDepthTop(school2, u, 999).map((x) => x.p.id).filter((id) => id !== pid);
        school2.depthOrder[upos] = [pid, ...rest];
      }
    }
    uniqSwap = null;
    rerender();
  }));
  document.querySelectorAll("[data-uniq-swap-close]").forEach((el) => el.addEventListener("click", (e) => {
    const kind = el.dataset.uniqSwapClose;
    if (kind === "stop") {
      e.stopPropagation();
      return;
    }
    if (kind === "bg" && e.target !== el) return;
    uniqSwap = null;
    rerender();
  }));
  document.querySelectorAll("[data-share-slider]").forEach((sl) => {
    sl.addEventListener("input", () => {
      const entry = gp.fieldAssignments.offense[activeOffFormation];
      if (!entry.shares) entry.shares = {};
      const catchSlots = OFF_FIELD_LAYOUTS[activeOffFormation].slots.filter((s) => s.catch);
      const slotId = sl.dataset.shareSlider;
      setShareRebalanced(entry.shares, catchSlots, slotId, parseInt(sl.value, 10));
      if (parseInt(sl.value, 10) !== entry.shares[slotId]) sl.value = entry.shares[slotId];
      repaintOffShares(gp, activeOffFormation);
    });
  });
  document.querySelectorAll("[data-share-reset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const fid = btn.dataset.shareReset;
      const entry = gp.fieldAssignments.offense[fid];
      if (!entry) return;
      if (!entry.shares) entry.shares = {};
      const layout = OFF_FIELD_LAYOUTS[fid];
      const catchSlots = (layout ? layout.slots : []).filter((s) => s.catch);
      for (const s of catchSlots) entry.shares[s.id] = defaultShareFor(s, gp.targetShares || {}, gp.defaultShares || null);
      normalizeShares(entry.shares, catchSlots.map((s) => s.id));
      notify("Target shares reset to your default", "success");
      rerender();
    });
  });
  // BLITZ PIE (Ref/BLITZ_PIE_PLAN.md): the ⚡/🛡 dials share one 100%
  // allocation per front — a step rebalances the whole pie (carry-share
  // math). Also fixes a pre-existing scoping bug: this handler used to write
  // to defBaseFront no matter which front tab was being viewed.
  const _defViewFront = () => defFrontTab || (gp.defFront && gp.defFront !== "auto" ? gp.defFront : gp.defBaseFront || "4-3");
  const _defViewEntry = () => {
    const front = _defViewFront();
    return gp.fieldAssignments.defense[front] || (gp.fieldAssignments.defense[front] = { slots: {}, blitzShares: {} });
  };
  document.querySelectorAll("[data-blitz-step]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const entry = _defViewEntry();
      if (!entry.blitzShares) entry.blitzShares = {};
      const map = entry.blitzShares;
      const slotId = btn.dataset.blitzSlot;
      const step = parseInt(btn.dataset.blitzStep, 10);
      const cur = map[slotId] || 0;
      const want = Math.max(0, cur + step * 10);
      if (want <= 0) {
        delete map[slotId];
        const keys = Object.keys(map).filter((k) => map[k] > 0);
        if (keys.length) normalizeShares(map, keys);
      } else {
        const keys = [...new Set([...Object.keys(map).filter((k) => map[k] > 0), slotId])];
        if (keys.length === 1) map[slotId] = 100;
        else setSplitRebalanced(map, keys, slotId, want);
      }
      repaintBlitzShares(map);
    });
  });
  const repaintHeat = (entry) => {
    const ctl = document.querySelector("[data-heat-ctl]");
    const val = document.querySelector("[data-heat-val]");
    const reset = document.querySelector("[data-heat-reset-btn]");
    const set = entry.heat != null;
    if (val) val.textContent = set ? String(entry.heat) : "auto";
    if (reset) reset.style.display = set ? "" : "none";
    if (ctl) ctl.classList.toggle("on", set);
  };
  document.querySelectorAll("[data-heat-step]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const entry = _defViewEntry();
      const step = parseInt(btn.dataset.heatStep, 10);
      const cur = entry.heat != null ? entry.heat : 50;
      entry.heat = Math.max(0, Math.min(100, cur + step * 10));
      repaintHeat(entry);
    });
  });
  document.querySelectorAll("[data-heat-reset]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const entry = _defViewEntry();
      delete entry.heat;
      repaintHeat(entry);
    });
  });
  (_c = document.getElementById("btn-auto-sort")) == null ? void 0 : _c.addEventListener("click", () => {
    if (depthTab === "offense") {
      const e = gp.fieldAssignments.offense[activeOffFormation];
      if (e) e.slots = {};
    } else if (depthTab === "defense") {
      const front = gp.defBaseFront || "4-3";
      const e = gp.fieldAssignments.defense[front];
      if (e) e.slots = {};
    } else {
      school.depthOrder = buildRoleSortedDepthOrder(school.roster);
      school.depthChart = buildDepthChart(school.roster, school.gameplan, school.depthOrder);
    }
    rerender();
  });
  document.querySelectorAll("[data-simple-featured]").forEach((btn) => btn.addEventListener("click", () => {
    gp.simple = gp.simple || {};
    gp.simple.featuredSlot = btn.dataset.simpleFeatured;
    applySimplePlan(school);
    rerender();
  }));
  document.querySelectorAll("[data-simple-rush]").forEach((btn) => btn.addEventListener("click", () => {
    gp.simple = gp.simple || {};
    gp.simple.rushStyle = btn.dataset.simpleRush;
    applySimplePlan(school);
    rerender();
  }));
  document.querySelectorAll("[data-simple-qbrun]").forEach((btn) => btn.addEventListener("click", () => {
    gp.simple = gp.simple || {};
    gp.simple.qbRun = btn.dataset.simpleQbrun === "on";
    applySimplePlan(school);
    rerender();
  }));
  document.querySelectorAll("[data-simple-blitz]").forEach((btn) => btn.addEventListener("click", () => {
    gp.simple = gp.simple || {};
    gp.simple.blitzAggr = btn.dataset.simpleBlitz;
    applySimplePlan(school);
    rerender();
  }));
  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", () => navigate(el.dataset.nav));
  });
}

export { formationPlaybookSet, renderDepthChart, setupListeners9 };
