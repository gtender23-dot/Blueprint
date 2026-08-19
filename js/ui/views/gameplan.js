import { __spreadProps, __spreadValues } from '../../_spread.js';
import { PASS_CONCEPTS, RUN_CONCEPTS } from '../../concepts.js';
import { C, FORMATIONS, FORMATION_PACKAGES, FORMATION_PLAYBOOK, FORMATION_VARIATIONS, PASS_TENDENCY, aggrStopFromBlitzPct } from '../../constants.js';
import { getCoach, saveGameplanToLibrary, saveTeamToLibrary } from '../../engine/coachprofile.js';
import { FRONT_PRESSURE_SIGNATURE, FRONT_SIG_LABEL } from '../../engine/formations.js';
import { SITUATION_KEYS, SITUATION_LABELS } from '../../engine/situations.js';
import { getPlayerSchool, navigate, notify, rerender, state } from '../../state.js';
import { renderFormationDiagram } from './routeart.js';
import { defaultGameplan } from '../../engine/world.js';
import { getCreation, listCreations, loadCreationData } from '../../engine/creator.js';
import { repairCreation } from '../../engine/creatorrepair.js';
import { DEFAULT_OFF_BOOKS, DEFAULT_DEF_BOOKS, defaultOffBook, defaultDefBook } from '../../engine/defaultbooks.js';
import { applyPlaybookToGameplan, playbookFromGameplan, lookSheetKey, splitSheetKey, resolveLookSheet } from '../../engine/playbook.js';
import { applyDefBookToGameplan, defBookFromGameplan, emptyDefBook, pruneCallSheet } from '../../engine/defbook.js';
import { applyControllerOverlay, adoptDefPlan, adoptOffPlan, controllerOverlayOf, setPlanFields, synthesizeTeamPlan } from '../../engine/teamplan.js';
import { renderPlaybooksTab, playbooksListeners } from './creatorplaybook.js';
import { renderDefTab, defListeners } from './creatordef.js';
import { tipTerm } from '../manual/tips.js';
import { escapeHtml } from '../../utils.js';

function gameplanIsSimple() {
  var _a;
  return ((_a = state.settings) == null ? void 0 : _a.gameplanMode) === "simple";
}
// W4 (§2): read the aggression stop off a plan, migrating a legacy numeric
// blitzPct through nearest-stop on the fly (the engine does the same in
// normalizeDefGameplan — the UI just has to agree before the first game).
function aggrOf(gp) {
  return gp.defAggression || aggrStopFromBlitzPct(gp.blitzPct);
}
// Writing the stop keeps the numeric mirror in sync for every legacy reader
// (scout memos, coach-DNA XP, the draw's caught-blitz roll).
function setAggr(gp, stop) {
  var _a;
  gp.defAggression = stop;
  gp.blitzPct = (_a = C.AGGRESSION.rate[stop]) != null ? _a : 20;
}
function renderGameplan() {
  const school = getPlayerSchool();
  const gp = (school == null ? void 0 : school.gameplan) || {};
  // \u2500\u2500 M5 (#39): the embedded editors take the screen over while open \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // The SAME Builder / Defensive Playbook editors as the Workshop, opened on
  // the book the coach carries (pbContext/defContext === "career"). Their own
  // Save/Push/Cancel verbs return here.
  if (state.ui.pb && state.ui.pbContext === "career") {
    return `<div class="view-gameplan gp-embed">${renderPlaybooksTab()}</div>`;
  }
  if (state.ui.def && state.ui.defContext === "career") {
    return `<div class="view-gameplan gp-embed">${renderDefTab()}</div>`;
  }
  const simple = gameplanIsSimple();
  if (simple && gameplanSection !== "st") gameplanSection = "simple";
  if (!simple && gameplanSection === "simple") gameplanSection = "home";
  if (simple) {
    return `
  <div class="view-gameplan">
    <div class="view-header">
      <div>
        <h1 class="view-title">Game Plan</h1>
        <div class="view-subtitle">Simple mode \u2014 set your identity, the sim handles the scheme. Want every knob? Settings &rsaquo; Game &rsaquo; Game Plan Detail.</div>
      </div>
    </div>
    ${renderPlanSlots(school)}
    <div class="rec-tabs" style="margin-bottom:16px">
      <button class="rec-tab active" data-gpsection="simple">Team Identity</button>
      <button class="rec-tab${gameplanSection === "st" ? " active" : ""}" data-gpsection="st">Special Teams</button>
    </div>
    <div class="gameplan-sections">
      ${gameplanSection === "st" ? renderSTSection(gp) : renderBookShelf(school, gp) + renderSimpleDials(gp)}
    </div>
  </div>`;
  }
  return `
  <div class="view-gameplan">
    <div class="view-header">
      <div>
        <h1 class="view-title">Game Plan</h1>
        <div class="view-subtitle">The book is what you ARE \u2014 the plan is this week. Anything left on AUTO inherits your defaults.</div>
      </div>
    </div>
    ${renderPlanSlots(school)}
    <div class="rec-tabs" style="margin-bottom:16px">
      <button class="rec-tab${gameplanSection === "home" ? " active" : ""}" data-gpsection="home">Plan Home</button>
      <button class="rec-tab${gameplanSection === "offense" ? " active" : ""}" data-gpsection="offense">Offense</button>
      <button class="rec-tab${gameplanSection === "defense" ? " active" : ""}" data-gpsection="defense">Defense</button>
      <button class="rec-tab${gameplanSection === "situations" ? " active" : ""}" data-gpsection="situations">Situations</button>
      <button class="rec-tab${gameplanSection === "st" ? " active" : ""}" data-gpsection="st">Special Teams</button>
    </div>

    <div class="gameplan-sections">

      ${gameplanSection === "home" ? renderPlanHome(school, gp) : ""}
      ${gameplanSection === "situations" ? renderSituationsSection(gp) : ""}
      ${gameplanSection === "offense" ? renderOffenseDefaults(gp) : ""}
      ${gameplanSection === "defense" ? renderDefenseDefaults(gp) : ""}

      <!-- SPECIAL TEAMS -->
      ${gameplanSection === "st" ? renderSTSection(gp) : ""}

    </div>
  </div>
`;
}
// \u2500\u2500 M5: THE PLAN HOME (#39/#3/#41) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// The organizing principle (ratified): the BOOK is the persistent object; the
// game plan is overlays on it. The home shows the two books you carry (with
// the embedded editors' doors), both IDENTITY panels side by side, and the
// BOOK-owned formation-usage dials. WEEK properties (tempo, aggression,
// situations) stay in the controller tabs.
function distinctSheetPlays(sheets) {
  return new Set(Object.values(sheets || {}).flatMap((s) => Object.keys(s || {}))).size;
}
function renderBookShelf(school, gp) {
  if (!school) return "";
  const looks = normalizeFormations(gp.offFormations, gp.offFormation);
  const nForm = new Set(looks.map((l) => l.id)).size;
  const nPlays = distinctSheetPlays(gp.formationPlaybooks);
  const offSrc = gp._bookSourceId ? getCreation("playbooks", gp._bookSourceId) : null;
  const defSrc = gp._defbookSourceId ? getCreation("defbooks", gp._defbookSourceId) : null;
  const nCalls = Object.keys(gp.defCalls || {}).length;
  const nChecks = Object.keys(gp.formChecks || {}).length;
  return `
  <div class="gp-home-books">
    <div class="card gp-book-card">
      <div class="card-header"><span class="card-title">\u{1F4D5} OFFENSIVE BOOK</span></div>
      <div class="gp-book-body">
        <div class="gp-book-name">${escapeHtml(gp._playbookName || "Your staff's opening plan")}</div>
        <div class="gp-book-meta muted">${nForm} formation${nForm === 1 ? "" : "s"} \xB7 ${looks.length} look${looks.length === 1 ? "" : "s"} \xB7 ${nPlays} play${nPlays === 1 ? "" : "s"}${offSrc ? ` \xB7 from the Workshop` : ""}</div>
        <div class="gp-book-actions">
          <button type="button" class="btn-ghost btn-sm" data-gp-editbook="off">\u270f\ufe0f Edit playbook</button>
        </div>
      </div>
    </div>
    <div class="card gp-book-card">
      <div class="card-header"><span class="card-title">\u{1F6E1}\ufe0f DEFENSIVE BOOK</span></div>
      <div class="gp-book-body">
        <div class="gp-book-name">${escapeHtml(gp._defbookName || "Your staff's defense")}</div>
        <div class="gp-book-meta muted">${escapeHtml(gp.defBaseFront || "4-3")} base \xB7 ${nCalls} named call${nCalls === 1 ? "" : "s"}${nChecks ? ` \xB7 ${nChecks} check${nChecks === 1 ? "" : "s"}` : ""}${defSrc ? ` \xB7 from the Workshop` : ""}</div>
        <div class="gp-book-actions">
          <button type="button" class="btn-ghost btn-sm" data-gp-editbook="def">\u270f\ufe0f Edit defense</button>
        </div>
      </div>
    </div>
  </div>`;
}
function renderPlanHome(school, gp) {
  return `
  ${renderBookShelf(school, gp)}
  <div class="gp-ident-row">
    ${renderIdentityCard(gp)}
    ${renderDefIdentityCard(gp)}
  </div>
  ${renderFormationPackageCard(gp)}`;
}
// The DEFENSIVE IDENTITY panel (M5 item 2) \u2014 the mirror of the offensive card:
// what an opposing OC's film room would say about your defense, in football
// words. Everything here restates dials the coach can already see and turn \u2014
// no sim coefficient is ever printed (help-language law).
function renderDefIdentityCard(gp) {
  var _a, _b;
  const front = gp.defBaseFront || "4-3";
  // defFrontMix rides in two shapes: the Game Plan writes an ARRAY of
  // {id, weight}; a loaded defbook compiles an OBJECT map. Read both.
  const mix = Array.isArray(gp.defFrontMix) ? gp.defFrontMix.filter((f) => f && f.id && (f.weight || 0) > 0) : gp.defFrontMix && typeof gp.defFrontMix === "object" ? Object.entries(gp.defFrontMix).filter(([, w]) => (w || 0) > 0).map(([id, weight]) => ({ id, weight })) : [];
  const mixWord = mix.length > 1 ? `multiple (${mix.map((f) => f.id).join(", ")})` : `${front} nearly every standard down`;
  const aggr = aggrOf(gp);
  const aggrWord = ((_a = C.AGGRESSION.labels) == null ? void 0 : _a[aggr]) || aggr || "balanced";
  const press = ((_b = C.PRESS_IDENTITY) == null ? void 0 : _b[gp.pressureIdentity]) ? C.PRESS_IDENTITY[gp.pressureIdentity].label : "honest looks";
  const shellWord = gp.covShell === "single" ? "single-high" : gp.covShell === "two" ? "two-high" : "mixed shells";
  const styleWord = gp.covStyle === "man" ? "man-heavy" : gp.covStyle === "zone" ? "zone-heavy" : "man/zone mix";
  const pressWord = gp.pressLevel === "press" ? "press at the line" : gp.pressLevel === "off" ? "off coverage" : "mixed leverage";
  // OD-9 (D16, 2026-08-18): the "comes off the edge/up the middle" phrase read
  // gp.pressureSource — a field the sim deletes at every kickoff. The card now
  // says only what the plan actually plays (identity + front own "who comes").
  const box = gp.runCommit || 0;
  const boxWord = box >= 8 ? "loaded against the run" : box >= 3 ? "leaning run" : box <= -8 ? "sitting on the pass" : box <= -3 ? "leaning pass" : "honest";
  const edgeWord = gp.edgePlay === "contain" ? "sets the edge" : gp.edgePlay === "crash" ? "pins its ears back" : "plays it straight";
  const tackleWord = gp.tackleStyle === "strip" ? "hunts the ball" : gp.tackleStyle === "wrap" ? "wraps and finishes" : "tackles it straight";
  const nCalls = Object.keys(gp.defCalls || {}).length;
  const nChecks = Object.keys(gp.formChecks || {}).length;
  const extras = [gp.spyQB ? "spies the QB" : null, gp.greenDog ? "green-dogs free blockers" : null].filter(Boolean).join(" \xB7 ");
  return `
  <div class="card identity-card def-identity-card">
    <div class="card-header"><span class="card-title">DEFENSIVE IDENTITY</span>
      <span class="muted" style="font-size:11px">what their film room sees</span></div>
    <div class="id-row"><span class="id-lbl">\u{1F9F1} Front</span><span><b>${escapeHtml(front)}</b> base \xB7 ${escapeHtml(mixWord)}</span></div>
    <div class="id-row"><span class="id-lbl">\u{1F441} Coverage</span><span>${escapeHtml(shellWord)}, ${escapeHtml(styleWord)} \xB7 ${escapeHtml(pressWord)}</span></div>
    <div class="id-row"><span class="id-lbl">\u{1F525} Pressure</span><span><b>${escapeHtml(String(aggrWord))}</b> \xB7 ${escapeHtml(press)}</span></div>
    <div class="id-row"><span class="id-lbl">\u{1F6E1} Run defense</span><span>box ${escapeHtml(boxWord)} \xB7 the edge ${escapeHtml(edgeWord)}</span></div>
    <div class="id-row"><span class="id-lbl">\u{1F91C} Tackling</span><span>${escapeHtml(tackleWord)}${extras ? ` \xB7 ${escapeHtml(extras)}` : ""}</span></div>
    ${nCalls ? `<div class="id-row"><span class="id-lbl">\u{1F4DE} Headset</span><span>${nCalls} named call${nCalls === 1 ? "" : "s"} ready${nChecks ? ` \xB7 ${nChecks} formation check${nChecks === 1 ? "" : "s"}` : ""}</span></div>` : ""}
  </div>`;
}
function renderSTSection(gp) {
  return `<div class="card">
        <div class="card-header"><span class="card-title">SPECIAL TEAMS</span></div>
        <div class="gameplan-group">
          <div class="gp-row">
            <label class="gp-label">Fakes <span class="gp-hint">(punt &amp; field goal)</span></label>
            <div class="gp-options">
              ${[["never", "Never"], ["occasional", "Occasional"], ["aggressive", "Aggressive"]].map(([val, lbl]) => `
                <button class="gp-option gp-option-sm${(gp.stFakes || "never") === val ? " active" : ""}"
                        data-gp-set="stFakes" data-gp-val="${val}">${lbl}</button>
              `).join("")}
            </div>
            <div class="gp-tip tip-info">\u25B8 A standing green light, not a play call: on the right 4th downs your unit runs the REAL thing \u2014 a direct snap to the upback, the punter or holder pulling it down to throw. The first one of a game has the full element of surprise; every fake you show goes on film and the next one gets harder. A punt-safe defense is set for it; a block-happy rush leaves the lanes open. Aggressive gets you a few gifts a season \u2014 and a few gut-punch turnovers on downs.</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">Return Scheme <span class="gp-hint">(kickoffs &amp; punts)</span></label>
            <div class="gp-options">
              ${[["safe", "Safe Hands"], ["balanced", "Balanced"], ["wall", "Set the Wall"]].map(([val, lbl]) => `
                <button class="gp-option gp-option-sm${(gp.retScheme || "balanced") === val ? " active" : ""}"
                        data-gp-set="retScheme" data-gp-val="${val}">${lbl}</button>
              `).join("")}
            </div>
            <div class="gp-tip tip-info">\u25B8 Your return identity, both phases. SAFE HANDS banks the catch \u2014 more fair catches and touchbacks, shorter returns, and the house call almost never happens (to either team). SET THE WALL builds the sideline return: a couple more yards a pop, real home-run threat, and your returner's vision matters more \u2014 but when the wall collapses the ball comes back. Balanced is today's default.</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">Surprise Onside <span class="gp-hint">(steal a possession)</span></label>
            <div class="gp-options">
              ${[["never", "Never"], ["arm", "Armed \u2014 once per game"]].map(([val, lbl]) => `
                <button class="gp-option gp-option-sm${(gp.surpriseOnside || "never") === val ? " active" : ""}"
                        data-gp-set="surpriseOnside" data-gp-val="${val}">${lbl}</button>
              `).join("")}
            </div>
            <div class="gp-tip tip-info">\u25B8 ARMED springs one onside kick per game on a kickoff nobody's set for \u2014 no hands team on the field, so it comes back at a real rate instead of desperation odds. The price is the field you give up when it doesn't, and once it's on film the surprise is spent \u2014 the dial stays armed week to week, but each game only gets the one. Desperation-time onsides still happen on their own.</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">PAT Approach <span class="gp-hint">(after touchdowns)</span></label>
            <div class="gp-options">
              ${[["kick", "Kick It"], ["chart", "By the Chart"], ["aggressive", "Aggressive"]].map(([val, lbl]) => `
                <button class="gp-option gp-option-sm${(gp.patApproach || "chart") === val ? " active" : ""}"
                        data-gp-set="patApproach" data-gp-val="${val}">${lbl}</button>
              `).join("")}
            </div>
            <div class="gp-tip tip-info">\u25B8 BY THE CHART (default) kicks the near-automatic point and only chases two in the classic late-game deficits (down 2, 5, 10\u2026). KICK IT trots the kicker out unless it's the naked must-have two in the final five minutes. AGGRESSIVE opens the full analytics card in the second half \u2014 up 1, down 9, down 16 \u2014 for coaches who play for the lead, not the tie.</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">Punt Defense <span class="gp-hint">(rush it or set the return)</span></label>
            <div class="gp-options">
              ${[["safe", "Safe Return"], ["balanced", "Balanced"], ["block", "Go For Block"]].map(([val, lbl]) => `
                <button class="gp-option gp-option-sm${(gp.puntDef || "balanced") === val ? " active" : ""}"
                        data-gp-set="puntDef" data-gp-val="${val}">${lbl}</button>
              `).join("")}
            </div>
            <div class="gp-tip tip-info">\u25B8 GO FOR BLOCK sells out at the line \u2014 a real shot at a blocked punt (~1 or 2 a season), but with everyone rushing there's no return set up behind it. SAFE RETURN puts every body in the wall: your best returns of the year come from this call, and the punter never feels a thing. Special teams wins one game a year; choose how you want to steal yours.</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">Max FG Distance</label>
            <div class="gp-slider-wrap">
              <span class="gp-slider-lo">25</span>
              <input class="gp-slider" type="range" id="max-fg" min="25" max="60" value="${gp.maxFGDist || 42}" />
              <span class="gp-slider-hi">60</span>
              <span class="gp-slider-val" id="max-fg-val">${gp.maxFGDist || 42} yds</span>
            </div>
          </div>
        </div>
      </div>`;
}
function currentSimpleDial(gp, key) {
  if (key === "simpleOffId") {
    const p = PASS_TENDENCY[gp.tendency] != null ? PASS_TENDENCY[gp.tendency] : 0.5;
    return p >= 0.6 ? "pass" : p <= 0.4 ? "run" : "balanced";
  }
  if (key === "simpleOffAggr") {
    const f = gp.fourthDown || "Moderate";
    return f === "Aggressive" || f === "Very Aggressive" ? "aggr" : f === "Conservative" || f === "Very Conservative" ? "safe" : "balanced";
  }
  if (key === "simpleDefPosture") {
    // OD-8 (D16): read the stop (aggrOf migrates a legacy raw blitzPct).
    const a = aggrOf(gp);
    return a === "attacking" || a === "house" ? "attack" : a === "bend" ? "bend" : "balanced";
  }
  if (key === "simpleTempo") {
    const t = gp.baseTempo || "Normal";
    return t === "Hurry" ? "fast" : t === "Chew" ? "slow" : "normal";
  }
  return "balanced";
}
// \u2500\u2500 The playbook owns the formations (owner call, 2026-08-15) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// The Game Plan no longer ADDS or REMOVES formations \u2014 that authoring lives in
// exactly one place, the playbook (a Workshop book, a preset, or the plan your
// staff opened the season with). This screen shows the book's looks and keeps
// only the weekly dial a coach actually turns mid-season: how OFTEN each look
// is used. Two editors writing gp.offFormations was the confusion this closes \u2014
// the old picker toggled by formation id, so on a multi-look book it showed
// duplicate rows and un-ticking a card silently deleted one look of several.
function lookMeta(entry) {
  const fid = entry.id;
  const vset = FORMATION_VARIATIONS[fid] || {};
  const vd = entry.variation && vset[entry.variation] || null;
  const pkg = __spreadValues(__spreadValues({}, FORMATION_PACKAGES[fid] || {}), vd && vd.pkg || {});
  return { label: vd ? `${fid} \xB7 ${vd.label}` : fid, pers: formatPersonnel(pkg), hasVar: !!vd };
}
function renderPlaybookLooks(gp) {
  const offFormations = normalizeFormations(gp.offFormations, gp.offFormation);
  const uniq = new Set(offFormations.map((f) => f.id));
  const bookName = gp._playbookName || null;
  // M5 (#3): the look art is COLLAPSED by default \u2014 the dials are the point of
  // this card; the diagrams expand on demand (state.ui.gpLookArt).
  const artOn = !!state.ui.gpLookArt;
  const cards = offFormations.map((entry, i) => {
    const m = lookMeta(entry);
    return `
      <div class="formation-card selected pb-look-card${artOn ? "" : " pb-look-compact"}">
        ${artOn ? `<div class="pb-look-dia">${renderFormationDiagram(entry.id, { variation: entry.variation || void 0, w: 150, h: 96 })}</div>` : ""}
        <div class="fc-header"><span class="fc-name">${escapeHtml(m.label)}</span></div>
        <div class="fc-personnel muted">${m.pers}</div>
        <div class="fw-row">
          <input class="gp-slider fw-slider" type="range" data-fw-index="${i}" min="5" max="95" value="${entry.weight}" aria-label="Usage for ${escapeHtml(m.label)}" />
          <span class="fw-pct" id="fw-pct-${i}">${Math.round(entry.weight)}%</span>
        </div>
      </div>`;
  }).join("");
  return `
      <div class="gp-row">
        <label class="gp-label">${tipTerm("formation", "Formation")} Usage <span class="gp-hint">from ${bookName ? `\u201C${escapeHtml(bookName)}\u201D` : "your staff's opening plan"}</span>
          <button type="button" class="btn-ghost btn-sm gp-lookart-toggle" data-gp-lookart="1">${artOn ? "Hide diagrams \u25B4" : "Show diagrams \u25BE"}</button></label>
        <div class="formation-grid pb-look-grid">${cards}</div>
        <div class="fw-bar">
          ${offFormations.map((e) => `<div class="fw-seg" style="width:${e.weight}%;background:var(--green);opacity:${0.5 + offFormations.indexOf(e) * 0.25}"></div>`).join("")}
        </div>
        <div class="gp-tip tip-info">\u25B8 Your playbook decides WHICH formations you carry \u2014 the sliders decide how often you line up in each look this week. To change the looks themselves, hit \u270F\uFE0F Edit playbook on your book card above, load a different book from \u201CLoad a plan\u2026\u201D, or build one in the Workshop.</div>
        <button type="button" class="btn-ghost btn-sm" data-gp-workshop="1">\u{1F6E0}\uFE0F Open the Workshop \u2192</button>
      </div>`;
}
function looksSubtitle(gp) {
  const offFormations = normalizeFormations(gp.offFormations, gp.offFormation);
  const uniq = new Set(offFormations.map((f) => f.id)).size;
  return `${uniq} formation${uniq === 1 ? "" : "s"} \xB7 ${offFormations.length} look${offFormations.length === 1 ? "" : "s"}`;
}
function renderFormationPackageCard(gp) {
  return `
  <div class="card">
    <div class="card-header"><span class="card-title">FORMATIONS</span><span class="card-subtitle muted">${looksSubtitle(gp)}</span></div>
    <div class="gameplan-group">
      ${renderPlaybookLooks(gp)}
    </div>
  </div>`;
}
function renderSimpleDials(gp) {
  return `
  ${renderFormationPackageCard(gp)}
  <div class="card">
    <div class="card-header"><span class="card-title">TEAM IDENTITY</span><span class="card-sub">${escapeHtml(schemeIdentityLine(gp))}</span></div>
    <div class="gameplan-group">
      ${SIMPLE_DIALS.map((d) => {
    const cur = currentSimpleDial(gp, d.key);
    return `
      <div class="gp-row simple-dial-row">
        <label class="gp-label">${d.label}</label>
        <div class="gp-options simple-dial-opts">
          ${d.opts.map(([val, lbl]) => `<button class="gp-option${cur === val ? " active" : ""}" data-simpledial="${d.key}" data-simpleval="${val}">${lbl}</button>`).join("")}
        </div>
        <div class="gp-tip tip-info">\u25B8 ${d.tip}</div>
      </div>`;
  }).join("")}
    </div>
    <p class="offseason-hint" style="margin:10px 16px">These few dials set your whole scheme behind the scenes. Want the full control panel? Switch to <b>Advanced</b> up top.</p>
  </div>
  ${renderSimpleSituations(gp)}`;
}
function currentSimpleSit(gp, cells, lever) {
  const sits = gp.situations || {};
  const cell = sits[cells[0]] || {};
  if (lever === "off") {
    const p = cell.tendency && PASS_TENDENCY[cell.tendency] != null ? PASS_TENDENCY[cell.tendency] : null;
    if (p == null) return "auto";
    return p >= 0.6 ? "pass" : p <= 0.4 ? "run" : "balanced";
  }
  // OD-8 (D16): cells speak the stop now; a legacy numeric cell still reads
  // through nearest-stop so an old save's lever lights the same button.
  const a = cell.defAggression != null ? cell.defAggression : cell.blitzPct != null ? aggrStopFromBlitzPct(cell.blitzPct) : null;
  if (a == null) return "auto";
  return a === "attacking" || a === "house" ? "attack" : a === "bend" ? "protect" : "balanced";
}
function renderSimpleSituations(gp) {
  return `
  <div class="card">
    <div class="card-header"><span class="card-title">SITUATIONS</span><span class="card-sub">optional \u2014 leave on Auto and the sim decides</span></div>
    <div class="gameplan-group">
      ${SIMPLE_SITS.map((s) => {
    const offCur = currentSimpleSit(gp, s.cells, "off");
    const defCur = currentSimpleSit(gp, s.cells, "def");
    const offOpts = [["auto", "Auto"], ["run", "Run more"], ["balanced", "Balanced"], ["pass", "Pass more"]];
    const defOpts = [["auto", "Auto"], ["protect", "Protect"], ["balanced", "Balanced"], ["attack", "Attack"]];
    return `
      <div class="simple-sit-row">
        <div class="simple-sit-label">${s.label}</div>
        <div class="simple-sit-levers">
          <div class="simple-sit-lever">
            <span class="simple-sit-lever-tag">OFFENSE</span>
            <div class="gp-options simple-dial-opts">
              ${offOpts.map(([v, l]) => `<button class="gp-option gp-option-sm${offCur === v ? " active" : ""}" data-simplesit="${s.key}" data-sitlever="off" data-sitval="${v}">${l}</button>`).join("")}
            </div>
          </div>
          <div class="simple-sit-lever">
            <span class="simple-sit-lever-tag">DEFENSE</span>
            <div class="gp-options simple-dial-opts">
              ${defOpts.map(([v, l]) => `<button class="gp-option gp-option-sm${defCur === v ? " active" : ""}" data-simplesit="${s.key}" data-sitlever="def" data-sitval="${v}">${l}</button>`).join("")}
            </div>
          </div>
        </div>
      </div>`;
  }).join("")}
    </div>
  </div>`;
}
function applySimpleSit(gp, sitKey, lever, val) {
  if (!gp.situations) gp.situations = {};
  const meta = SIMPLE_SITS.find((s) => s.key === sitKey);
  if (!meta) return;
  for (const cellKey of meta.cells) {
    const cell = gp.situations[cellKey] || (gp.situations[cellKey] = {});
    if (lever === "off") {
      if (val === "auto") cell.tendency = null;
      else cell.tendency = val === "run" ? "Heavy Run" : val === "pass" ? "Heavy Pass" : "Balanced";
    } else {
      // OD-8 (D16, 2026-08-18): the cell speaks the AGGRESSION STOP directly —
      // the raw blitzPct numbers were migrated to these exact stops at every
      // kickoff anyway (38→attacking, 10→bend, 20→balanced). OD-5 (D16): the
      // coverageScheme values "aggressive"/"conservative" were placebos (no
      // sim branch — they resolved as "balanced"); the posture is expressed by
      // the fields that actually move: the stop, the shell, the cushion.
      cell.blitzPct = null;
      cell.coverageScheme = null;
      if (val === "auto") {
        cell.defAggression = null;
        cell.covShell = null;
        cell.pressLevel = null;
      } else if (val === "attack") {
        cell.defAggression = "attacking";
        cell.covShell = "single";
        cell.pressLevel = "press";
      } else if (val === "protect") {
        cell.defAggression = "bend";
        cell.covShell = "two";
        cell.pressLevel = "off";
      } else {
        cell.defAggression = "balanced";
        cell.covShell = "balanced";
        cell.pressLevel = "balanced";
      }
    }
  }
}
function applySimpleDial(gp, key, val) {
  if (key === "simpleOffId") {
    // OFFENSE only. runCommit is the DEFENSIVE box (read as defEff.runCommit in
    // sim.js) — it must NOT be written here, or picking "Run First" silently
    // loads your own defense's box and stomps the defensive posture dial
    // (last-button-wins). The offensive lean lives in tendency + passDepth.
    gp.tendency = val === "run" ? "Heavy Run" : val === "pass" ? "Heavy Pass" : "Balanced";
    gp.passDepth = val === "pass" ? { short: 30, medium: 40, deep: 30 } : val === "run" ? { short: 50, medium: 38, deep: 12 } : { short: 40, medium: 40, deep: 20 };
  } else if (key === "simpleOffAggr") {
    gp.fourthDown = val === "aggr" ? "Aggressive" : val === "safe" ? "Conservative" : "Moderate";
    gp.qbAggr = val === "aggr" ? 68 : val === "safe" ? 34 : 50;
  } else if (key === "simpleDefPosture") {
    // OD-8 (D16, 2026-08-18): the posture writes the stop through setAggr —
    // the old raw gp.blitzPct write never touched defAggression, so whenever a
    // stop was already set the Simple dial was silently discarded at kickoff
    // (the proven stale-pair bug). OD-5 (D16): "aggressive"/"conservative"
    // coverageScheme were placebos (no sim branch) — the posture speaks
    // through the dials the sim reads: stop, shell, cushion, box.
    gp.coverageScheme = "balanced";
    if (val === "attack") {
      setAggr(gp, "attacking");
      gp.covShell = "single";
      gp.pressLevel = "press";
      gp.runCommit = 8;
    } else if (val === "bend") {
      setAggr(gp, "bend");
      gp.covShell = "two";
      gp.pressLevel = "off";
      gp.runCommit = -6;
    } else {
      setAggr(gp, "balanced");
      gp.covShell = "balanced";
      gp.pressLevel = "balanced";
      gp.runCommit = 0;
    }
  } else if (key === "simpleTempo") {
    gp.baseTempo = val === "fast" ? "Hurry" : val === "slow" ? "Chew" : "Normal";
  }
}
// Was SCHEME PROFILE — a read-only card that scored every dial 0-100 and printed
// the numbers, which breaks the never-print-coefficients rule and duplicated the
// OFFENSIVE IDENTITY card right below it. Only the one-line summary survives.
function schemeIdentityLine(gp) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
  const clampV = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  const R = (v) => Math.round(clampV(v) * 100);
  const passLean = (_a = PASS_TENDENCY[gp.tendency || "Balanced"]) != null ? _a : 0.5;
  const d = gp.passDepth || { short: 40, medium: 40, deep: 20 };
  const deepLean = clampV(((_b = d.deep) != null ? _b : 20) / 35);
  const tempo = (_c = { Chew: 0.18, Normal: 0.5, Hurry: 0.9 }[gp.baseTempo || "Normal"]) != null ? _c : 0.5;
  const blitz = clampV((gp.blitzPct != null ? gp.blitzPct : 20) / 55);
  const press = gp.pressLevel === "press" ? 1 : gp.pressLevel === "off" ? 0 : 0.5;
  const man = gp.covStyle === "man" ? 1 : gp.covStyle === "zone" ? 0 : 0.5;
  const oneHigh = gp.covShell === "single" ? 1 : gp.covShell === "two" ? 0 : 0.5;
  const fourth = (_d = {
    "Very Conservative": 0,
    "Conservative": 0.25,
    "Moderate": 0.5,
    "Aggressive": 0.75,
    "Very Aggressive": 1
  }[gp.fourthDown || "Moderate"]) != null ? _d : 0.5;
  const qbRun = clampV((gp.qbRunPct || 0) / 40);
  const losFree = gp.losFreedom === "free" ? 1 : gp.losFreedom === "never" ? 0 : 0.5;
  const forms = (gp.offFormations || [{ id: gp.offFormation || "Single Back", weight: 100 }]).filter((f) => f && (f.weight || 0) > 0);
  const tot = forms.reduce((s, f) => s + (f.weight || 0), 0) || 1;
  const shares = forms.map((f) => (f.weight || 0) / tot);
  const evenness = forms.length <= 1 ? 0 : -shares.reduce((s, p) => p > 0 ? s + p * Math.log(p) : s, 0) / Math.log(forms.length);
  const spread = clampV((forms.length - 1) / 4);
  const motion = clampV(((_e = gp.motionRate) != null ? _e : 100) / 120);
  const pa = clampV(((_f = gp.paRate) != null ? _f : 100) / 120);
  const rpo = clampV(((_g = gp.rpoRate) != null ? _g : 40) / 100);
  const jet = clampV(((_h = gp.jetRate) != null ? _h : 15) / 30);
  const draw = clampV(((_i = gp.drawRate) != null ? _i : 8) / 25);
  const screens = clampV(((_j = gp.screenRate) != null ? _j : 14) / 25);
  const aggression = R(
    0.24 * blitz + 0.19 * fourth + 0.15 * deepLean + 0.11 * press + 0.1 * man + 0.08 * oneHigh + 0.08 * qbRun + 0.05 * losFree
  );
  const tempoScore = R(tempo);
  const airGround = R(passLean);
  const deception = R(
    0.22 * spread + 0.16 * evenness + 0.14 * motion + 0.12 * pa + 0.12 * rpo + 0.1 * screens + 0.08 * jet + 0.06 * draw
  );
  const leanWord = airGround >= 62 ? "pass-first" : airGround <= 38 ? "ground-based" : "balanced";
  const tempoWord = tempoScore >= 70 ? "up-tempo" : tempoScore <= 30 ? "clock-controlling" : "measured";
  const aggWord = aggression >= 62 ? "attacking" : aggression <= 38 ? "bend-don\u2019t-break" : "even-keeled";
  const decWord = deception >= 60 ? ", multiple looks" : deception <= 25 ? ", vanilla" : "";
  return `${tempoWord.charAt(0).toUpperCase()}${tempoWord.slice(1)} ${leanWord}, ${aggWord}${decWord}`;
}
function renderIdentityCard(gp) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i;
  const school = getPlayerSchool();
  if (!school) return "";
  const roster = school.roster || [];
  const runLean = 1 - ((_a = PASS_TENDENCY[gp.tendency || "Balanced"]) != null ? _a : 0.5);
  const rbId = (((_b = school.depthChart) == null ? void 0 : _b.RB) || [])[0];
  const rb = roster.find((p) => p.id === rbId);
  const rbCred = rb ? (rb.compositeRating - 45) / 60 : 0;
  const paCred = Math.max(0.03, Math.min(1.2, 0.25 + (runLean - 0.5) * 2 + rbCred * 0.5));
  const paWord = paCred >= 0.7 ? "sells hard" : paCred >= 0.45 ? "credible" : paCred >= 0.25 ? "thin" : "nobody bites";
  const PA_RATE = {
    "Power-I": 0.34,
    "Trips/Bunch": 0.21,
    "Spread": 0.17,
    "Pistol/RPO": 0.3,
    "Air Raid": 0.12,
    "Single Back": 0.3,
    "Empty": 0.05,
    "Wishbone": 0.38,
    "Flexbone": 0.36,
    "Wildcat": 0.5,
    "Jumbo": 0.4
  };
  const MOTION_RATE = {
    "Trips/Bunch": 0.35,
    "Spread": 0.28,
    "Air Raid": 0.25,
    "Pistol/RPO": 0.22,
    "Power-I": 0.12,
    "Single Back": 0.22,
    "Empty": 0.3,
    "Wishbone": 0.1,
    "Flexbone": 0.45,
    "Wildcat": 0.4,
    "Jumbo": 0.06
  };
  const forms = gp.offFormations || [{ id: gp.offFormation || "Single Back", weight: 100 }];
  const tot = forms.reduce((s, f) => s + (f.weight || 0), 0) || 1;
  const wavg = (table) => forms.reduce((s, f) => {
    var _a2;
    return s + ((_a2 = table[f.id]) != null ? _a2 : 0.2) * (f.weight || 0);
  }, 0) / tot;
  const rpoShare = forms.filter((f) => f.id === "Pistol/RPO").reduce((s, f) => s + (f.weight || 0), 0) / tot;
  const olIds = (((_c = school.depthChart) == null ? void 0 : _c.OL) || []).slice(0, 5);
  const ols = olIds.map((id) => roster.find((p) => p.id === id)).filter(Boolean);
  const sideVal = (idx) => {
    const ps = idx.map((i) => ols[i]).filter(Boolean);
    if (!ps.length) return 0;
    return Math.round(ps.reduce((s, p) => s + p.attributes.PWR * 0.35 + p.attributes.STR * 0.3 + p.attributes.AWR * 0.2 + p.attributes.TEC * 0.15, 0) / ps.length);
  };
  const L = sideVal([0, 1]), M = sideVal([1, 2, 3]), R = sideVal([3, 4]);
  const dir = gp.runDirection || { left: 33, middle: 34, right: 33 };
  const cont = (_d = school._olCont) != null ? _d : 6;
  const contWord = cont >= 9 ? "in lockstep" : cont >= 6 ? "settled" : cont >= 3 ? "gelling" : "strangers";
  // [PLAYTEST item 33 — rule 3] The three side scores are an internal blend and
  // the continuity number is an internal counter; neither appears on any control
  // the coach can turn, so printing them handed out the sim's own arithmetic.
  // A line coach doesn't read his front five off a spreadsheet — he says which
  // side he'd run behind.
  const sideWord = (v) => v >= 78 ? "a wall" : v >= 68 ? "stout" : v >= 58 ? "solid" : v >= 48 ? "gettable" : "a soft spot";
  const olBest = L >= M && L >= R ? "left" : R >= M ? "right" : "middle";
  return `
  <div class="card identity-card">
    <div class="card-header"><span class="card-title">OFFENSIVE IDENTITY</span>
      <span class="muted" style="font-size:11px">what their film room sees</span></div>
    <div class="id-row" style="margin-bottom:4px"><span class="id-lbl">\u{1F9ED} They'd call you</span>
      <span><b>${escapeHtml(schemeIdentityLine(gp))}</b></span></div>
    <div class="id-row"><span class="id-lbl">\u{1F3AD} Play action</span>
      <span><b>${paWord}</b> \xB7 ~${Math.round(wavg(PA_RATE) * 100 * ((_e = gp.paRate) != null ? _e : 100) / 100)}% of med/deep</span></div>
    <div class="id-row"><span class="id-lbl">\u{1F525} Screens</span><span>~${(_f = gp.screenRate) != null ? _f : 14}% of short throws \u2014 jackpot vs the blitz</span></div>
    ${rpoShare > 0.05 ? `<div class="id-row"><span class="id-lbl">\u{1F500} RPO</span><span>~${Math.round(rpoShare * ((_g = gp.rpoRate) != null ? _g : 40))}% of run calls carry the option</span></div>` : ""}
    ${(() => {
    var _a2;
    const rate = (_a2 = gp.optionRate) != null ? _a2 : 70;
    const SPEED = { "Spread": 10, "Pistol/RPO": 15, "Trips/Bunch": 6 };
    const tripleShare = forms.filter((f) => f.id === "Wishbone" || f.id === "Flexbone").reduce((s, f) => s + (f.weight || 0), 0) / tot;
    const speedShare = forms.reduce((s, f) => s + (SPEED[f.id] || 0) * (f.weight || 0) / 100, 0) / tot;
    const pctTotal = Math.round(tripleShare * rate + speedShare * 100 * Math.min(rate / 70, 1.5));
    if (pctTotal < 1) return "";
    const mix = gp.optionMix || { dive: 40, keep: 30, pitch: 30 };
    const mt = (mix.dive || 0) + (mix.keep || 0) + (mix.pitch || 0) || 100;
    const kind = tripleShare > 0 ? speedShare > 0 ? "triple + speed option" : "triple option" : "speed option";
    return `<div class="id-row"><span class="id-lbl">\u{1F531} Option</span><span>~${pctTotal}% of run calls (${kind}) \xB7 lean ${Math.round((mix.dive || 0) / mt * 100)}/${Math.round((mix.keep || 0) / mt * 100)}/${Math.round((mix.pitch || 0) / mt * 100)} dive/keep/pitch</span></div>`;
  })()}
    ${(() => {
    var _a2;
    const JET_FORMS = ["Wildcat", "Flexbone", "Pistol/RPO", "Spread", "Trips/Bunch", "Air Raid", "Empty", "Single Back", "Power-I"];
    const jetShare = forms.filter((f) => JET_FORMS.includes(f.id)).reduce((s, f) => s + (f.weight || 0), 0) / tot;
    if (jetShare <= 0.05) return "";
    return `<div class="id-row"><span class="id-lbl">\u{1F680} Jet sweeps</span><span>~${Math.round(jetShare * ((_a2 = gp.jetRate) != null ? _a2 : 15))}% of outside runs hit the motion man</span></div>`;
  })()}
    <div class="id-row"><span class="id-lbl">\u{1F3C3} Motion</span><span>~${Math.round(wavg(MOTION_RATE) * 100 * ((_h = gp.motionRate) != null ? _h : 100) / 100)}% of dropbacks</span></div>
    <div class="id-row"><span class="id-lbl">\u{1F3A9} Draws</span><span>~${(_i = gp.drawRate) != null ? _i : 8}% of inside runs come off a pass look</span></div>
    <div class="id-row"><span class="id-lbl">\u{1F9F1} Your line</span>
      <span>left ${escapeHtml(sideWord(L))} \xB7 middle ${escapeHtml(sideWord(M))} \xB7 right ${escapeHtml(sideWord(R))} \u2014 ${escapeHtml(contWord)}, best behind the <b>${escapeHtml(olBest)}</b></span></div>
    ${(() => {
    var _a2;
    const fa = ((_a2 = gp.fieldAssignments) == null ? void 0 : _a2.offense) || {};
    let hi = 0, hiId = null;
    for (const f of Object.values(fa)) for (const [pid, v] of Object.entries((f == null ? void 0 : f.shares) || {})) if (v > hi) {
      hi = v;
      hiId = pid;
    }
    if (hi < 25) return "";
    const p = roster.find((x) => x.id === hiId);
    const nm = p ? `${p.name.first[0]}. ${p.name.last}` : "Your feature";
    return `<div class="id-row"><span class="id-lbl">\u2B50 Featured</span><span>${escapeHtml(nm)} at <b>${hi}%</b> \u2014 <i>expect brackets and shadows</i></span></div>`;
  })()}
    <div class="id-row"><span class="id-lbl">\u{1F3AF} Run plan</span>
      <span>${dir.left || 0}% left \xB7 ${dir.middle || 0}% mid \xB7 ${dir.right || 0}% right${L > R + 8 && (dir.right || 0) > (dir.left || 0) ? " \u2014 <i>running away from your strength?</i>" : ""}</span></div>
  </div>`;
}
var DEFAULT_SHARE_SLOTS = [
  ["WR1", "WR1"],
  ["WR2", "WR2"],
  ["WR3", "WR3"],
  ["TE1", "Tight End"],
  ["RB1", "Back"]
];
var DEFAULT_SHARE_FALLBACK = { WR1: 22, WR2: 20, WR3: 16, TE1: 20, RB1: 14 };
function renderDefaultSharesRow(gp) {
  if (!gp.targetShares) gp.targetShares = Object.assign({}, DEFAULT_SHARE_FALLBACK);
  const ds = gp.targetShares;
  return `
  <div class="gp-row">
    <label class="gp-label">Default ${tipTerm("target-share", "Target Shares")} <span class="gp-hint">(who the ball looks for)</span></label>
    <div class="run-dir-row">
      ${DEFAULT_SHARE_SLOTS.map(([key, lbl]) => {
    const v = ds[key] != null ? ds[key] : DEFAULT_SHARE_FALLBACK[key];
    return `
        <div class="run-dir-cell">
          <div class="run-dir-name">${lbl}</div>
          <input type="range" min="0" max="40" step="2" value="${v}" data-defshare="${key}">
          <div class="run-dir-val">${v}%</div>
        </div>`;
  }).join("")}
    </div>
    <div class="gp-tip tip-info">▸ Your standing pecking order by RECEIVER — your WR1 is your WR1 wherever he lines up, so his share follows the man, not the spot. The sim leans this way but always takes what the coverage gives. Want a different mix out of a specific FORMATION (by position — the X, the slot), tune it on the field view: <button type="button" class="btn-ghost btn-sm" data-nav="depthchart">Depth Chart →</button></div>
  </div>`;
}
function renderOffenseDefaults(gp) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r;
  if (gp.runDirection) normalizeDistTo100(gp.runDirection, ["left", "middle", "right"]);
  if (gp.passDepth) normalizeDistTo100(gp.passDepth, ["short", "medium", "deep"]);
  // The set of formations the loaded playbook carries — the Run/Pass Game sections
  // gate option/jet/wildcat controls on it. (Regressed in the Playbook-Root refactor
  // cfb9bd2, which dropped this declaration but left its uses in those two tabs,
  // throwing a ReferenceError that blanked Run Game and Pass Game.)
  const selectedIds = new Set(normalizeFormations(gp.offFormations, gp.offFormation).map((f) => f.id));
  return `<div class="card">
        <div class="card-header">
          <span class="card-title">OFFENSIVE DEFAULTS</span>
          <span class="card-subtitle muted">${looksSubtitle(gp)}</span>
        </div>
        <div class="gameplan-group">

          <div class="gp-tip tip-info">\u25B8 Set your identity once \u2014 the sim runs it on every snap. The Plan Home's IDENTITY cards show what your choices add up to. New here? Pick a tendency; every other dial has a sensible default.</div>

          <div class="rec-tabs gp-subtabs">
            ${[["package", "Package"], ["run", "Run Game"], ["pass", "Pass Game"], ["playbook", "Playbook"], ["tempo", "Tempo & Motion"]].map(([id, lbl]) => `
              <button class="rec-tab${offSubTab === id ? " active" : ""}" data-offsub="${id}">${lbl}</button>`).join("")}
          </div>

          ${offSubTab !== "package" ? "" : `
          <details class="gp-section" open>
          <summary class="gp-section-hdr">THE BASICS <span class="gp-section-sub">run/pass balance &amp; nerve</span></summary>

          <div class="gp-tip tip-info">\u25B8 Your formations and their usage dials live on the <b>Plan Home</b> now \u2014 the book decides the looks, the home dials how often. Tendency and 4th-down nerve stay here: they're this week's call. <button type="button" class="btn-ghost btn-sm" data-gpsection="home">\u2190 Plan Home</button></div>

          <div class="gp-row">
            <label class="gp-label">Play ${tipTerm("tendency", "Tendency")}</label>
            <div class="gp-options tendency-options">
              ${Object.keys(PASS_TENDENCY).map((t) => `
                <button class="gp-option gp-option-sm${gp.tendency === t ? " active" : ""}"
                        data-gp-set="tendency" data-gp-val="${t}">${t}</button>
              `).join("")}
            </div>
            <div class="tendency-vis">
              <div class="tend-bar">
                <div class="tend-fill-run" style="width:${Math.round((1 - (PASS_TENDENCY[gp.tendency] || 0.5)) * 100)}%"></div>
                <div class="tend-fill-pass" style="width:${Math.round((PASS_TENDENCY[gp.tendency] || 0.5) * 100)}%"></div>
              </div>
              <div class="tend-labels">
                <span>RUN ${Math.round((1 - (PASS_TENDENCY[gp.tendency] || 0.5)) * 100)}%</span>
                <span>PASS ${Math.round((PASS_TENDENCY[gp.tendency] || 0.5) * 100)}%</span>
              </div>
            </div>
            <div class="gp-tip tip-info">\u25B8 This is your biggest lever. Run-heavy teams sell play action \u2014 the fake only works if the run is real. Pass-heavy raises volume, but nobody bites the fake. No wrong answers, only tradeoffs.</div>
          </div>
          <div class="gp-row">
            <label class="gp-label">Fourth Down Approach</label>
            <div class="gp-options">
              ${["Very Conservative", "Conservative", "Moderate", "Aggressive", "Very Aggressive"].map((f) => `
                <button class="gp-option gp-option-sm${gp.fourthDown === f ? " active" : ""}"
                        data-gp-set="fourthDown" data-gp-val="${f}">${f}</button>
              `).join("")}
            </div>
            <div class="gp-tip tip-info">\u25B8 How willing your coach is to keep the offense on the field on 4th. The sim already weighs distance, field position and score \u2014 this sets the nerve. Aggressive wins games and loses jobs. (Weekly plans and ST fakes layer on top.)</div>
          </div>
          </details>`}

          ${offSubTab !== "run" ? "" : `
          <details class="gp-section" open>
          <summary class="gp-section-hdr">THE RUN GAME <span class="gp-section-sub">where &amp; who</span></summary>

          <div class="gp-row">
            <label class="gp-label">Run Direction</label>
            <div class="run-dir-row">
              ${["left", "middle", "right"].map((d) => {
    var _a2, _b2, _c2, _d2;
    return `
                <div class="run-dir-cell">
                  <div class="run-dir-name">${d.toUpperCase()}</div>
                  <input type="range" min="0" max="100" step="5" value="${(_b2 = (_a2 = gp.runDirection) == null ? void 0 : _a2[d]) != null ? _b2 : d === "middle" ? 34 : 33}" data-rundir="${d}">
                  <div class="run-dir-val">${(_d2 = (_c2 = gp.runDirection) == null ? void 0 : _c2[d]) != null ? _d2 : d === "middle" ? 34 : 33}</div>
                </div>`;
  }).join("")}
            </div>
            <div class="gp-tip tip-info">\u25B8 Runs go where you point them, and blocks at the point of attack count triple \u2014 run behind your best linemen (check YOUR LINE on the identity card). Balanced keeps the defense honest.</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">QB Run Tendency</label>
            <div class="gp-slider-wrap">
              <span class="gp-slider-lo">0</span>
              <input class="gp-slider" type="range" id="qb-run-pct" min="0" max="50" value="${gp.qbRunPct || 0}" />
              <span class="gp-slider-hi">50</span>
              <span class="gp-slider-val" id="qb-run-val">+${gp.qbRunPct || 0}%</span>
            </div>
            <div class="gp-tip tip-info">\u25B8 Designed QB runs on top of your formation's natural rate. Best with Pistol/RPO and a fast QB (SPD/AGI). A statue QB out here is a turnover waiting to happen.</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">${tipTerm("rpo", "RPO")} Rate <span class="gp-hint">(run-pass option plays)</span></label>
            <div class="gp-slider-wrap">
              <span class="gp-slider-lo">0%</span>
              <input class="gp-slider" type="range" id="rpo-rate" min="0" max="60" value="${(_a = gp.rpoRate) != null ? _a : 40}" />
              <span class="gp-slider-hi">60%</span>
              <span class="gp-slider-val" id="rpo-val">${(_b = gp.rpoRate) != null ? _b : 40}%</span>
            </div>
            <div class="gp-tip tip-info">\u25B8 RPOs run from ANY formation \u2014 what changes is whether your QB can read the mesh. Pistol is what the concept was built for and Spread is nearly as good; Trips telegraphs it and Air Raid is a drop-back system, so the dial buys less there. Under center \u2014 Power-I \u2014 he turns his back on the defender he's optioning, so the read barely exists. Higher = more mesh reads: a smart QB (AWR) pulls it against a crashing box for the free slant.</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">Gadget Rate <span class="gp-hint">(reverses, flea flickers, HB passes)</span></label>
            <div class="gp-slider-wrap">
              <span class="gp-slider-lo">0%</span>
              <input class="gp-slider" type="range" id="gadget-rate" min="0" max="12" value="${(_a = gp.gadgetRate) != null ? _a : 4}" />
              <span class="gp-slider-hi">12%</span>
              <span class="gp-slider-val" id="gadget-val">${(_b = gp.gadgetRate) != null ? _b : 4}%</span>
            </div>
            <div class="gp-tip tip-info">\u25B8 Trick plays \u2014 the dial is how often an outside run becomes a Reverse or a deep shot becomes a Flea Flicker / HB Pass on its own. Each is also callable from the sheet's Gadgets tab. They cash in against a run-committed, over-pursuing defense and get people hurt against a disciplined one \u2014 the reverse dies to a contain edge, the flea flicker eats sacks.</div>
          </div>

          ${["Wildcat", "Flexbone", "Pistol/RPO", "Spread", "Trips/Bunch", "Air Raid", "Empty", "Single Back", "Power-I"].some((f) => selectedIds.has(f)) ? `
          <div class="gp-row">
            <label class="gp-label">Jet Sweep Rate <span class="gp-hint">(outside runs to your motion man)</span></label>
            <div class="gp-slider-wrap">
              <span class="gp-slider-lo">0%</span>
              <input class="gp-slider" type="range" id="jet-rate" min="0" max="40" value="${(_c = gp.jetRate) != null ? _c : 15}" />
              <span class="gp-slider-hi">40%</span>
              <span class="gp-slider-val" id="jet-rate-val">${(_d = gp.jetRate) != null ? _d : 15}%</span>
            </div>
            <div class="gp-tip tip-info">\u25B8 The ball goes to your motion man at full speed \u2014 the slot joker (Spread/Trips/Air Raid/Empty/Pistol), an A-back (Flexbone), the JET spot (Wildcat), or your flanker/wing in pro sets (Single Back/Power-I, at naturally lower rates). Boom or bust: a displaced edge is a footrace your burner wins, a sniffed one (edge AWR, loaded boxes) is a TFL waiting in the alley. Only the Wishbone abstains \u2014 nobody jets out of the full house.</div>
          </div>` : ""}

          <div class="gp-row">
            <label class="gp-label">Draw Rate <span class="gp-hint">(inside runs from a pass look)</span></label>
            <div class="gp-slider-wrap">
              <span class="gp-slider-lo">0%</span>
              <input class="gp-slider" type="range" id="draw-rate" min="0" max="30" value="${(_e = gp.drawRate) != null ? _e : 8}" />
              <span class="gp-slider-hi">30%</span>
              <span class="gp-slider-val" id="draw-rate-val">${(_f = gp.drawRate) != null ? _f : 8}%</span>
            </div>
            <div class="gp-tip tip-info">\u25B8 The run game's screen: catch a blitz (or a crash-keyed edge) upfield and the lane opens behind it. A disciplined MIKE sits in it for nothing. Works from every formation \u2014 crank it against pressure defenses, mute it against readers.</div>
          </div>



          </details>

          ${(() => {
    var _a2, _b2, _c2, _d2;
    const hasTriple = selectedIds.has("Wishbone") || selectedIds.has("Flexbone");
    const hasSpeed = selectedIds.has("Spread") || selectedIds.has("Pistol/RPO") || selectedIds.has("Trips/Bunch");
    if (!hasTriple && !hasSpeed) return "";
    return `
          <details class="gp-section" open>
          <summary class="gp-section-hdr">THE OPTION GAME <span class="gp-section-sub">${hasTriple ? "dive \xB7 keep \xB7 pitch" : "speed option \u2014 keep \xB7 pitch"}</span></summary>
          ${!hasTriple ? `<div class="gp-tip tip-info">\u25B8 From spread formations this is the SPEED option \u2014 no dive back, the QB attacks the edge and reads only the force defender: keep or pitch. It's a changeup (a small slice of your run calls, scaled by the rate dial), not an identity. The Dive lean below is ignored without a Wishbone/Flexbone package.</div>` : ""}

          <div class="gp-row">
            <label class="gp-label">${tipTerm("option-game", "Option Rate")} <span class="gp-hint">(run calls that are true triple option \xB7 in spread sets it scales your speed-option changeup instead)</span></label>
            <div class="gp-slider-wrap">
              <span class="gp-slider-lo">0%</span>
              <input class="gp-slider" type="range" id="option-rate" min="0" max="100" value="${(_a2 = gp.optionRate) != null ? _a2 : 70}" />
              <span class="gp-slider-hi">100%</span>
              <span class="gp-slider-val" id="option-rate-val">${(_b2 = gp.optionRate) != null ? _b2 : 70}%</span>
            </div>
            <div class="gp-tip tip-info">\u25B8 Every option snap runs the live read chain: your QB reads the dive key (give or pull), then the force defender (keep or pitch). His AWR and TEC make the reads; won reads block the defense a man light, lost reads hand an unblocked defender a free shot. The rest of your run calls are normal handoffs.</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">${tipTerm("option-mix", "Option Mix")} <span class="gp-hint">(a 100% split \u2014 where you lean when the read is a coin flip)</span></label>
            <div class="run-dir-row">
              ${(() => {
      if (!gp.optionMix) gp.optionMix = { dive: 40, keep: 30, pitch: 30 };
      normalizeDistTo100(gp.optionMix, ["dive", "keep", "pitch"]);
      return [["dive", "Dive (FB)"], ["keep", "QB Keep"], ["pitch", "Pitch"]].map(([k, lbl]) => `
                <div class="run-dir-item">
                  <span class="run-dir-lbl">${lbl}</span>
                  <input class="gp-slider" type="range" data-optmix="${k}" min="0" max="100" step="5"
                         value="${gp.optionMix[k]}" />
                  <span class="run-dir-val">${gp.optionMix[k]}%</span>
                </div>`).join("");
    })()}
            </div>
            <div class="gp-tip tip-info">\u25B8 The defense picks the reads, not you \u2014 this is your QB's tiebreaker on ambiguous looks. Dive-heavy grinds behind the B-back; pitch-heavy hunts the edge with your fastest wing. QB Keep feeds your quarterback \u2014 and his injury risk.</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">${tipTerm("pitch-aggressiveness", "Pitch Aggressiveness")}</label>
            <div class="gp-slider-wrap">
              <span class="gp-slider-lo">Safe</span>
              <input class="gp-slider" type="range" id="pitch-aggr" min="0" max="100" value="${(_c2 = gp.pitchAggr) != null ? _c2 : 50}" />
              <span class="gp-slider-hi">Loose</span>
              <span class="gp-slider-val" id="pitch-aggr-val">${(_d2 = gp.pitchAggr) != null ? _d2 : 50}</span>
            </div>
            <div class="gp-tip tip-info">\u25B8 The risk dial. Loose pitches stretch the edge and spring your wing in space \u2014 and put a live ball in the air behind the line. Your QB's TEC throws the pitch; the wing's hands catch it. Option football's tax is the fumble: pay it deliberately or not at all.</div>
          </div>

          <div class="gp-tip tip-info">\u25B8 Your pitch man is whoever holds the wing spots on the Depth Chart's field view \u2014 the A-back (Flexbone) slots mesh RB/WR/TE/FB and the halfback (Wishbone) slots mesh RB/FB/TE, so a fast receiver or an H-back type can be your pitch back. Faster wing gets the ball. In spread formations the speed-option pitch goes to your halfback.</div>
          </details>`;
  })()}`}

          ${offSubTab !== "pass" ? "" : `
          <details class="gp-section" open>
          <summary class="gp-section-hdr">THE PASS GAME <span class="gp-section-sub">depth &amp; targets</span></summary>

          ${renderDefaultSharesRow(gp)}

          <div class="gp-row">
            <label class="gp-label">Pass Depth Distribution</label>
            <div class="run-dir-row">
              ${["short", "medium", "deep"].map((d) => {
    var _a2, _b2, _c2, _d2;
    return `
                <div class="run-dir-cell">
                  <div class="run-dir-name">${d.toUpperCase()}</div>
                  <input type="range" min="0" max="100" step="5" value="${(_b2 = (_a2 = gp.passDepth) == null ? void 0 : _a2[d]) != null ? _b2 : d === "short" ? 40 : d === "medium" ? 40 : 20}" data-passdepth="${d}">
                  <div class="run-dir-val">${(_d2 = (_c2 = gp.passDepth) == null ? void 0 : _c2[d]) != null ? _d2 : d === "short" ? 40 : d === "medium" ? 40 : 20}%</div>
                </div>
              `;
  }).join("")}
            </div>
            <div class="gp-tip tip-info">\u25B8 Short throws are safe and feed the screen game. Deep shots are boom-or-bust \u2014 bigger plays, longer drops, more sacks and picks. Your QB's arm (STR) and your receivers' SPD decide whether deep is a weapon or a donation.</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">Screen Rate <span class="gp-hint">(% of short throws)</span></label>
            <div class="gp-slider-wrap">
              <span class="gp-slider-lo">0%</span>
              <input class="gp-slider" type="range" id="screen-rate" min="0" max="30" value="${(_g = gp.screenRate) != null ? _g : 14}" />
              <span class="gp-slider-hi">30%</span>
              <span class="gp-slider-val" id="screen-val">${(_h = gp.screenRate) != null ? _h : 14}%</span>
            </div>
            <div class="gp-tip tip-info">\u25B8 Screens are the blitz counter \u2014 jackpot when the rush fires, blown up by a disciplined line that sniffs them. Crank this against blitz-happy defenses (check the scouting report), dial it down against patient ones.</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">${tipTerm("play-action", "Play Action")} Usage <span class="gp-hint">(\xD7 your formations' natural rate)</span></label>
            <div class="gp-slider-wrap">
              <span class="gp-slider-lo">Never</span>
              <input class="gp-slider" type="range" id="pa-rate" min="0" max="200" value="${(_i = gp.paRate) != null ? _i : 100}" />
              <span class="gp-slider-hi">2\xD7</span>
              <span class="gp-slider-val" id="pa-rate-val">${(_j = gp.paRate) != null ? _j : 100}%</span>
            </div>
            <div class="gp-tip tip-info">\u25B8 100% is your formations' DNA (Power-I fakes a third of the time, Air Raid barely bothers). Crank it and the fakes multiply \u2014 but PA is only as good as the run game the defense must honor, and the deeper drop feeds the rush when protection breaks.</div>
          </div>
          ${selectedIds.has("Wildcat") ? `
          <div class="gp-row">
            <label class="gp-label">Wildcat Trick Pass <span class="gp-hint">(pass rate from the Wildcat)</span></label>
            <div class="gp-slider-wrap">
              <span class="gp-slider-lo">0%</span>
              <input class="gp-slider" type="range" id="wildcat-pass" min="0" max="35" value="${(_k = gp.wildcatPassRate) != null ? _k : 10}" />
              <span class="gp-slider-hi">35%</span>
              <span class="gp-slider-val" id="wildcat-pass-val">${(_l = gp.wildcatPassRate) != null ? _l : 10}%</span>
            </div>
            <div class="gp-tip tip-info">\u25B8 From the Wildcat your tendency dial is ignored \u2014 this IS the pass rate. Your real QB is split out wide, so every throw is a scheduled gadget. Zero means the defense can sell out; a little keeps them honest. Your WC-spot taker is set on the Depth Chart's field view (RB, WR \u2014 or a runner QB).</div>
          </div>` : ""}

          <div class="gp-row">
            <label class="gp-label">${tipTerm("chip-help", "Chip Help")} <span class="gp-hint">(the back bumps the edge)</span></label>
            <div class="gp-options">
              ${[["auto", "Auto"], ["chip", "Chip the edge"]].map(([val, lbl]) => `
                <button class="gp-option gp-option-sm${(gp.chipHelp || "auto") === val ? " active" : ""}"
                        data-gp-set="chipHelp" data-gp-val="${val}">${lbl}</button>
              `).join("")}
            </div>
            <div class="gp-tip tip-info">▸ CHIP THE EDGE designs the bump: on the middle protections your releasing back hunts their best rusher and lands the chip more often. The bill: a back busy chipping is a late, rare checkdown — your outlet thins exactly when the heat is on. Auto keeps today's bump-on-the-way-out.</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">Protection Emphasis <span class="gp-hint">(routes vs blockers)</span></label>
            <div class="gp-slider-wrap">
              <span class="gp-slider-lo">Max Routes</span>
              <input class="gp-slider" type="range" id="prot-emph" min="0" max="100" value="${(_m = gp.protEmphasis) != null ? _m : 50}" />
              <span class="gp-slider-hi">Max Protect</span>
              <span class="gp-slider-val" id="prot-emph-val">${(_n = gp.protEmphasis) != null ? _n : 50}</span>
            </div>
            <div class="gp-tip tip-info">\u25B8 Who stays in when the ball goes up. MAX PROTECT keeps the TE (and backs) in \u2014 your QB gets his back foot down clean far more often, but the same coverage blankets fewer routes, so every window tightens. MAX ROUTES floods the field and lives with the heat. Crank protection against blitz-heavy and crash-edge defenses; empty the backfield against passive ones.</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">${tipTerm("protection-style", "Protection Style")} <span class="gp-hint">(how you keep the QB clean)</span></label>
            <div class="gp-options">
              ${C.PROT_IDENTITY.order.map((val) => `
                <button class="gp-option gp-option-sm${(gp.protIdentity || "halfSlide") === val ? " active" : ""}"
                        data-gp-set="protIdentity" data-gp-val="${val}">${C.PROT_IDENTITY.labels[val]}</button>
              `).join("")}
            </div>
            <div class="gp-tip tip-info">${{
      quick: "\u25B8 QUICK GAME \u2014 five-man protection, ball out on rhythm. The house can't sack what's already thrown, and even the safety heat arrives late \u2014 but your shot plays flatten out, and any snap that has to extend is living on borrowed air.",
      halfSlide: "\u25B8 HALF-SLIDE \u2014 the modern default: man side, zone slide side. Sound against everything, special against nothing; your CENTER's awareness sets the slide, so an old head in the middle is worth real pressure points.",
      bob: "\u25B8 BOB \u2014 big-on-big: trust your five one-on-one, backs scan the backers. The cleanest picture against a four-man rush and it frees your back into routes \u2014 but fire zones bend its angles wrong, and that's exactly what a 3-4 wants to hear.",
      maxProtect: "\u25B8 MAX PROTECT \u2014 TE and back stay home, seven block. The deep-shot answer to secondary heat... with two or three routes against a full coverage. Against a defense that just drops eight, you've blocked nobody with everybody."
    }[gp.protIdentity || "halfSlide"]}</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">${tipTerm("qb-aggression", "QB Aggression")} <span class="gp-hint">(protect it vs push it)</span></label>
            <div class="gp-slider-wrap">
              <span class="gp-slider-lo">Protect</span>
              <input class="gp-slider" type="range" id="qb-aggr" min="0" max="100" value="${(_o = gp.qbAggr) != null ? _o : 50}" />
              <span class="gp-slider-hi">Push it</span>
              <span class="gp-slider-val" id="qb-aggr-val">${(_p = gp.qbAggr) != null ? _p : 50}</span>
            </div>
            <div class="gp-tip tip-info">\u25B8 The gunslinger dial. PUSH IT hunts depth beyond your called mix and throws into tighter windows \u2014 more yards per completion, and a real jump in interceptions. PROTECT checks it down and takes what's given. Pair it with your QB: a high-AWR passer earns the right to push; a freshman doesn't.</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">Line-of-Scrimmage Freedom <span class="gp-hint">(let the QB change the call)</span></label>
            <div class="gp-options">
              ${[["never", "Run the Call"], ["auto", "Auto"], ["free", "Full Freedom"]].map(([val, lbl]) => `
                <button class="gp-option gp-option-sm${(gp.losFreedom || "auto") === val ? " active" : ""}"
                        data-gp-set="losFreedom" data-gp-val="${val}">${lbl}</button>
              `).join("")}
            </div>
            <div class="gp-tip tip-info">\u25B8 What your QB may change at the line. He can kill a run into the quick game against a loaded box, check a pass into a run against a light one, and audible out of a play that's dead against the coverage he reads. AUTO scales with his AWR \u2014 a veteran checks, a freshman runs what's called. FULL FREEDOM doubles his audible budget and sharpens his eyes \u2014 but every check goes on film, and DCs disguise a checking QB harder. A fooled QB audibles straight into the trap.</div>
          </div>
          </details>`}

          ${offSubTab !== "playbook" ? "" : `
          <details class="gp-section" open>
          <summary class="gp-section-hdr">THE PLAYBOOK <span class="gp-section-sub">your play mix \u2014 the call sheet</span></summary>
          <div class="gp-tip tip-info">\u25B8 Every snap the sim now calls a real CONCEPT \u2014 this is where you weight them. 50 is a balanced call sheet; crank what your roster executes, bench what it can't (0 = never called, and your QB can't audible into it). Each concept beats some coverages and dies against others \u2014 the drive log shows you which you're meeting. Fair warning: the defense keeps film. Ride one concept hard enough and it starts getting jumped, so a lopsided sheet pays a tax. Weights ride with your saved plans, so different opponents can get different books.</div>
          ${(() => {
    // One tab per carried LOOK (formation + variation). Each look owns its full
    // call sheet from the book (2026-08-18) — picking a look shows THAT look's
    // plays; "All Plays" is the global default the sim falls back to for a
    // concept a look doesn't weight. No authored-count badges, no inherit hint —
    // the inherit-base model is retired.
    const seenLooks = new Set();
    const carried = (gp.offFormations || []).filter((f) => f && f.id && (f.weight || 0) > 0 && FORMATION_PLAYBOOK[f.id]).map((f) => {
      const vk = f.variation || null;
      const key = lookSheetKey(f.id, vk);
      const vset = FORMATION_VARIATIONS[f.id];
      const label = vk ? `${f.id} · ${(vset && vset[vk] && vset[vk].label) || vk}` : f.id;
      return { key, fid: f.id, vk, label };
    }).filter((l) => seenLooks.has(l.key) ? false : (seenLooks.add(l.key), true));
    if (pbFormTab && !carried.some((l) => l.key === pbFormTab)) pbFormTab = null;
    const strip = carried.length ? `
          <div class="gp-row"><div class="gp-options">
            <button class="gp-option gp-option-sm${!pbFormTab ? " active" : ""}" data-pbform="">All Plays</button>
            ${carried.map((l) => `<button class="gp-option gp-option-sm${pbFormTab === l.key ? " active" : ""}" data-pbform="${escapeHtml(l.key)}">${escapeHtml(l.label)}</button>`).join("")}
          </div></div>
          <div class="gp-hint">Pick a look to weight the plays it runs. "All Plays" is your global default across every concept.</div>` : "";
    return strip + (pbFormTab ? renderFormationPlaybook(gp, pbFormTab) : renderPlaybookGroups(gp));
  })()}
          </details>`}

          ${offSubTab !== "tempo" ? "" : `
          <details class="gp-section" open>
          <summary class="gp-section-hdr">TEMPO <span class="gp-section-sub">clock &amp; legs</span></summary>

          <div class="gp-row">
            <label class="gp-label">Base Tempo</label>
            <div class="gp-options">
              ${["Chew", "Normal", "Hurry"].map((t) => `
                <button class="gp-option gp-option-sm${(gp.baseTempo || "Normal") === t ? " active" : ""}"
                        data-gp-set="baseTempo" data-gp-val="${t}">${t}</button>
              `).join("")}
            </div>
            <div class="gp-tip tip-info">\u25B8 Chew milks the clock \u2014 fewer possessions for everyone, which protects a lead or keeps an underdog close. Hurry adds possessions for BOTH teams and tires everyone out. When in doubt: Normal.</div>
          </div>
          <div class="gp-row">
            <label class="gp-label">Motion Usage <span class="gp-hint">(\xD7 your formations' natural rate)</span></label>
            <div class="gp-slider-wrap">
              <span class="gp-slider-lo">Static</span>
              <input class="gp-slider" type="range" id="motion-rate" min="0" max="200" value="${(_q = gp.motionRate) != null ? _q : 100}" />
              <span class="gp-slider-hi">2\xD7</span>
              <span class="gp-slider-val" id="motion-rate-val">${(_r = gp.motionRate) != null ? _r : 100}%</span>
            </div>
            <div class="gp-tip tip-info">\u25B8 Pre-snap movement buys separation and forces the defense to show its hand \u2014 smart DBs (AWR) give less away. Constant motion is a real identity (see: Flexbone); so is lining up and mauling people.</div>
          </div>
          </details>`}

        </div>
      </div>`;
}
function renderHalftimeAdjust(gp) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
  const chipRow = (label, current, opts, key, fmt = (x) => x) => `
  <div class="ht-adj-row">
    <div class="ht-adj-head">
      <span class="ht-adj-label">${label}</span>
      <span class="ht-adj-cur">${fmt(current)}</span>
    </div>
    <div class="gp-options ht-adj-opts">
      ${opts.map(([val, lbl]) => `
        <button class="gp-option gp-option-sm${current === val ? " active" : ""}"
                data-gp-set="${key}" data-gp-val="${val}">${lbl}</button>`).join("")}
    </div>
  </div>`;
  const boolRow = (label, cur, key) => `
  <div class="ht-adj-row">
    <div class="ht-adj-head">
      <span class="ht-adj-label">${label}</span>
      <span class="ht-adj-cur">${cur === true ? "ON" : "OFF"}</span>
    </div>
    <div class="gp-options ht-adj-opts">
      ${[[false, "Off"], [true, "On"]].map(([val, lbl]) => `
        <button class="gp-option gp-option-sm${cur === true === val ? " active" : ""}"
                data-gp-boolset="${key}" data-gp-boolval="${val}">${lbl}</button>`).join("")}
    </div>
  </div>`;
  const pass = Math.round((PASS_TENDENCY[gp.tendency] || 0.5) * 100);
  const tendOpts = Object.keys(PASS_TENDENCY).map((t) => [t, t]);
  const fourthShort = { "Very Conservative": "V.Cons", "Conservative": "Cons", "Moderate": "Mod", "Aggressive": "Aggr", "Very Aggressive": "V.Aggr" };
  if (gameplanIsSimple()) {
    const dpth = gp.passDepth || { short: 40, medium: 40, deep: 20 };
    const dcur = dpth.deep >= 35 ? "deep" : dpth.short >= 55 ? "quick" : "balanced";
    const passRow = chipRow(
      "Passing Attack",
      dcur,
      [["quick", "Quick Game"], ["balanced", "Balanced"], ["deep", "Attack Deep"]],
      "__htDepth",
      () => `${dpth.short}/${dpth.medium}/${dpth.deep}`
    ).replace(/data-gp-set="__htDepth" data-gp-val="/g, 'data-ht-depth="');
    return `${renderFormationPackageCard(gp)}
  <div class="card ht-adjust">
    <div class="card-header"><span class="card-title">ADJUSTMENTS</span>
      <span class="card-sub">the big knobs \xB7 switch to Advanced for full control</span></div>
    <div class="ht-adj-col"><div class="ht-adj-side">OFFENSE</div>
      ${chipRow("Play Tendency", gp.tendency, tendOpts, "tendency", () => `RUN ${100 - pass} / ${pass} PASS`)}
      ${chipRow("Tempo", gp.baseTempo || "Normal", [["Chew", "Chew"], ["Normal", "Normal"], ["Hurry", "Hurry"]], "baseTempo")}
      ${passRow}
      ${chipRow("Protection", gp.protIdentity || "halfSlide", C.PROT_IDENTITY.order.map((v) => [v, C.PROT_IDENTITY.labels[v]]), "protIdentity", (v) => C.PROT_IDENTITY.labels[v] || v)}
      ${chipRow(
      "4th Down",
      gp.fourthDown || "Moderate",
      ["Very Conservative", "Conservative", "Moderate", "Aggressive", "Very Aggressive"].map((f) => [f, fourthShort[f]]),
      "fourthDown"
    )}
    </div>
    <div class="ht-adj-col"><div class="ht-adj-side">DEFENSE</div>
      ${chipRow("Safety Shell", gp.covShell || "balanced", [["single", "1-High"], ["balanced", "Mix"], ["two", "2-High"]], "covShell")}
      ${chipRow("Coverage Style", gp.covStyle || "balanced", [["man", "Man"], ["balanced", "Mix"], ["zone", "Zone"]], "covStyle")}
      ${chipRow("Cushion", gp.pressLevel || "balanced", [["press", "Press"], ["balanced", "Mix"], ["off", "Off"]], "pressLevel")}
      ${boolRow("QB Spy", gp.spyQB === true, "spyQB")}
      ${boolRow("Green Dog", gp.greenDog === true, "greenDog")}
      ${chipRow("Aggression", aggrOf(gp), C.AGGRESSION.order.map((v) => [v, C.AGGRESSION.labels[v]]), "__aggr", (v) => C.AGGRESSION.labels[v] || v).replace(/data-gp-set="__aggr" data-gp-val="/g, 'data-gp-aggr="')}
    </div>
  </div>`;
  }
  return `<div class="card ht-adjust">
    <div class="card-header"><span class="card-title">HALFTIME ADJUSTMENTS</span>
      <span class="card-sub">big knobs only \xB7 fine detail lives on Situations &amp; Depth</span></div>

    <div class="ht-adj-col"><div class="ht-adj-side">OFFENSE</div>
      ${chipRow("Play Tendency", gp.tendency, tendOpts, "tendency", (t) => `RUN ${100 - pass} / ${pass} PASS`)}
      ${chipRow("Tempo", gp.baseTempo || "Normal", [["Chew", "Chew"], ["Normal", "Normal"], ["Hurry", "Hurry"]], "baseTempo")}
      ${chipRow(
    "4th Down",
    gp.fourthDown || "Moderate",
    ["Very Conservative", "Conservative", "Moderate", "Aggressive", "Very Aggressive"].map((f) => [f, fourthShort[f]]),
    "fourthDown"
  )}
      ${(() => {
    const d = gp.passDepth || { short: 40, medium: 40, deep: 20 };
    const cur = d.deep >= 35 ? "deep" : d.short >= 55 ? "quick" : "balanced";
    return chipRow(
      "Passing Attack",
      cur,
      [["quick", "Quick Game"], ["balanced", "Balanced"], ["deep", "Attack Deep"]],
      "__htDepth",
      () => `${d.short}/${d.medium}/${d.deep}`
    ).replace(/data-gp-set="__htDepth" data-gp-val="/g, 'data-ht-depth="');
  })()}
      <div class="ht-adj-row">
        <div class="ht-adj-head">
          <span class="ht-adj-label">QB Designed Runs</span>
          <span class="ht-adj-cur" id="qb-run-val">+${gp.qbRunPct || 0}%</span>
        </div>
        <input class="gp-slider" type="range" id="qb-run-pct" min="0" max="50" value="${gp.qbRunPct || 0}" />
      </div>
      <div class="ht-adj-row">
        <div class="ht-adj-head">
          <span class="ht-adj-label">Protection Emphasis</span>
          <span class="ht-adj-cur" id="prot-emph-val">${(_a = gp.protEmphasis) != null ? _a : 50}</span>
        </div>
        <input class="gp-slider" type="range" id="prot-emph" min="0" max="100" value="${(_b = gp.protEmphasis) != null ? _b : 50}" />
      </div>
      <div class="ht-adj-row">
        <div class="ht-adj-head">
          <span class="ht-adj-label">QB Aggression</span>
          <span class="ht-adj-cur" id="qb-aggr-val">${(_c = gp.qbAggr) != null ? _c : 50}</span>
        </div>
        <input class="gp-slider" type="range" id="qb-aggr" min="0" max="100" value="${(_d = gp.qbAggr) != null ? _d : 50}" />
      </div>
      <div class="ht-adj-row">
        <div class="ht-adj-head">
          <span class="ht-adj-label">Screens</span>
          <span class="ht-adj-cur" id="screen-val">${(_e = gp.screenRate) != null ? _e : 14}%</span>
        </div>
        <input class="gp-slider" type="range" id="screen-rate" min="0" max="30" value="${(_f = gp.screenRate) != null ? _f : 14}" />
      </div>
      ${chipRow(
    "Line-of-Scrimmage Freedom",
    gp.losFreedom || "auto",
    [["never", "Run the Call"], ["auto", "Auto"], ["free", "Full Freedom"]],
    "losFreedom"
  )}
    </div>

    <div class="ht-adj-col"><div class="ht-adj-side">DEFENSE</div>
      ${chipRow(
    "Safety Shell",
    gp.covShell || "balanced",
    [["single", "1-High"], ["balanced", "Mix"], ["two", "2-High"]],
    "covShell"
  )}
      ${chipRow(
    "Coverage Style",
    gp.covStyle || "balanced",
    [["man", "Man"], ["balanced", "Mix"], ["zone", "Zone"]],
    "covStyle"
  )}
      ${chipRow(
    "Cushion",
    gp.pressLevel || "balanced",
    [["press", "Press"], ["balanced", "Mix"], ["off", "Off"]],
    "pressLevel"
  )}
      ${chipRow(
    "Edge Discipline",
    gp.edgePlay || "balanced",
    [["crash", "Crash"], ["balanced", "Balanced"], ["contain", "Contain"]],
    "edgePlay"
  )}
      ${chipRow(
    "Coverage Scheme",
    gp.coverageScheme || "balanced",
    [["balanced", "Balanced"], ["lockTop", "Lock WR1"], ["bracketTop", "Bracket WR1"]],
    "coverageScheme"
  )}
      ${chipRow(
    "Option / QB Key",
    gp.optionKey || "balanced",
    [["balanced", "Balanced"], ["dive", "Take Dive"], ["qb", "Contain QB"], ["pitch", "Take Pitch"]],
    "optionKey"
  )}
      ${chipRow(
    "Tackling",
    gp.tackleStyle || "balanced",
    [["wrap", "Wrap Up"], ["balanced", "Mix"], ["strip", "Strip"]],
    "tackleStyle"
  )}
      ${boolRow("QB Spy", gp.spyQB === true, "spyQB")}
      ${boolRow("Green Dog", gp.greenDog === true, "greenDog")}
      <div class="ht-adj-row">
        <div class="ht-adj-head">
          <span class="ht-adj-label">Run Commit (box)</span>
          <span class="ht-adj-cur" id="box-val">${((_g = gp.runCommit) != null ? _g : 0) > 0 ? "+" : ""}${(_h = gp.runCommit) != null ? _h : 0}</span>
        </div>
        <input class="gp-slider" type="range" id="box-commit" min="-25" max="25" value="${(_i = gp.runCommit) != null ? _i : 0}" />
      </div>
      <div class="ht-adj-row">
        <div class="ht-adj-head">
          <span class="ht-adj-label">Aggression</span>
          <span class="ht-adj-cur">${C.AGGRESSION.labels[aggrOf(gp)] || aggrOf(gp)}</span>
        </div>
        <div class="gp-options ht-adj-opts">
          ${C.AGGRESSION.order.map((v) => `
            <button class="gp-option gp-option-sm${aggrOf(gp) === v ? " active" : ""}"
                    data-gp-aggr="${v}">${C.AGGRESSION.labels[v]}</button>`).join("")}
        </div>
      </div>
    </div>
  </div>`;
}
function renderDefenseDefaults(gp) {
  var _a, _b, _c, _d, _e;
  const defBaseFront = gp.defBaseFront || "4-3";
  const frontMix = Array.isArray(gp.defFrontMix) ? gp.defFrontMix.filter((f) => f && PIN_FRONTS.includes(f.id)) : [];
  const covScheme = gp.coverageScheme || "balanced";
  const COV_TIPS = {
    balanced: "\u25B8 Everyone covers his own man by alignment. No strengths, no holes \u2014 the safe default.",
    lockTop: "\u25B8 Your best corner follows their best receiver everywhere. A weapon if your CB1 is elite; a liability if he is not. The sim keys their FEATURED man (highest target share), not just the depth-chart WR1.",
    bracketTop: "\u25B8 Two defenders on their star \u2014 which means someone else is running free underneath. Great against feed-the-man offenses, bleeds against balanced ones."
  };
  return `<div class="card">
        <div class="card-header"><span class="card-title">DEFENSE DEFAULTS</span></div>
        <div class="gp-tip tip-info" style="margin:0 16px">\u25B8 Your defensive identity \u2014 the sim runs it every snap, and the Situations tab overrides it for specific moments. New here? Pick a front and a coverage; the defaults handle the rest.</div>
        <div class="gameplan-group">

          <div class="rec-tabs gp-subtabs">
            ${[["front", "Front"], ["coverage", "Coverage"], ["pressure", "Pressure"], ["calls", "Calls"], ["checks", "Checks"]].map(([id, lbl]) => `
              <button class="rec-tab${defSubTab === id ? " active" : ""}" data-defsub="${id}">${lbl}</button>`).join("")}
          </div>


          ${defSubTab !== "front" ? "" : `
          <details class="gp-section" open>
          <summary class="gp-section-hdr">THE FRONT <span class="gp-section-sub">bodies &amp; the box</span></summary>

          <div class="gp-row">
            <label class="gp-label">${tipTerm("base-front", "Base Front")}</label>
            <div class="gp-options">
              ${DEF_FRONTS2.map((front) => `
                <button class="gp-option${defBaseFront === front ? " active" : ""}"
                        data-gp-set="defBaseFront" data-gp-val="${front}">
                  ${front}
                  <span class="gp-option-sub">${DEF_FRONT_DESCS[front] || ""}</span>
                </button>
              `).join("")}
            </div>
            <div class="gp-tip tip-info">
              \u25B8 Your default look \u2014 the sim auto-subs Nickel and Dime on passing downs and 46/Bear in short yardage, so you're picking an identity, not micromanaging packages.
            </div>
            <div class="gp-tip tip-info">
              \u25B8 Scheme fit: ${DEF_FRONT_NEEDS[defBaseFront] || ""} Recruit players whose archetype matches your front and they play to their full rating.
            </div>
          </div>

          <div class="gp-row">
            <label class="gp-label">Front Mix <span class="gp-hint">(standard downs \u2014 pick up to 5)</span></label>
            <div class="gp-options">
              ${PIN_FRONTS.map((fid) => {
    const inMix = frontMix.some((f) => f.id === fid);
    return `<button class="gp-option gp-option-sm${inMix ? " active" : ""}" data-dfmix-front="${fid}">${fid}</button>`;
  }).join("")}
            </div>
            ${frontMix.length ? `
            <div class="formation-weights">
              ${frontMix.map((entry, i) => `
                <div class="fw-row">
                  <span class="fw-label">${escapeHtml(entry.id)}</span>
                  <input class="gp-slider dfw-slider" type="range" data-dfw-index="${i}" min="5" max="95" value="${entry.weight}" />
                  <span class="fw-pct" id="dfw-pct-${i}">${Math.round(entry.weight)}%</span>
                </div>`).join("")}
              <div class="fw-bar">
                ${frontMix.map((e, i) => `<div class="fw-seg" style="width:${e.weight}%;background:var(--team-1);opacity:${0.4 + i * 0.2}"></div>`).join("")}
              </div>
            </div>` : `
            <div class="gp-tip tip-info">\u25B8 Empty = you line up in your base front every standard down. Add fronts to roll a weighted mix \u2014 the defensive mirror of your offensive formation weights. Short-yardage walls and obvious-pass subs still override on top.</div>`}
          </div>

          <div class="gp-row">
            <label class="gp-label">${tipTerm("the-box", "Box")} <span class="gp-hint">(run commit)</span></label>
            <div class="gp-slider-wrap">
              <span class="gp-slider-lo">Light</span>
              <input class="gp-slider" type="range" id="box-commit" min="-25" max="25" step="1" value="${(_a = gp.runCommit) != null ? _a : 0}" />
              <span class="gp-slider-hi">Loaded</span>
              <span class="gp-slider-val" id="box-val">${((_b = gp.runCommit) != null ? _b : 0) > 0 ? "+" : ""}${(_c = gp.runCommit) != null ? _c : 0}</span>
            </div>
            <div class="gp-tip tip-info">\u25B8 Your most interesting lever. LOADED stuffs the run but leaves receivers open \u2014 and play action eats you alive. LIGHT sits on the pass: tighter coverage, DBs jumping routes, a rush with its ears pinned \u2014 but the ground game walks. Zero is honest. The Situations tab can override per spot.</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">${tipTerm("option-assignment", "Option Assignment")} <span class="gp-hint">(vs triple-option offenses)</span></label>
            <div class="gp-options">
              ${[["balanced", "Balanced"], ["qb", "Contain QB"], ["pitch", "Take Pitch"]].map(([val, lbl]) => `
                <button class="gp-option gp-option-sm${(gp.optionKey || "balanced") === val ? " active" : ""}"
                        data-gp-set="optionKey" data-gp-val="${val}">${lbl}</button>
              `).join("")}
            </div>
            <div class="gp-tip tip-info">\u25B8 Assignment football, against ANY read offense. Versus the triple option (Wishbone/Flexbone) and spread speed option: CONTAIN QB walls off the keep but softens the dive; TAKE PITCH flies to the wing and the keep leaks. CONTAIN QB also travels: it dampens RPO pulls, designed QB keepers, and scrambles from EVERY formation \u2014 the assigned edge meets the runner \u2014 at the cost of softer pursuit on their back's perimeter runs. Facing a running QB? Contain him, whatever they line up in.</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">${tipTerm("edge-discipline", "Edge Discipline")} <span class="gp-hint">(contain vs crash)</span></label>
            <div class="gp-options">
              ${[["contain", "Contain"], ["balanced", "Balanced"], ["crash", "Crash"]].map(([val, lbl]) => `
                <button class="gp-option gp-option-sm${(gp.edgePlay || "balanced") === val ? " active" : ""}"
                        data-gp-set="edgePlay" data-gp-val="${val}">${lbl}</button>
              `).join("")}
            </div>
            <div class="gp-tip tip-info">\u25B8 What your edges do at the snap. CONTAIN sets the edge \u2014 jets, screens and sweeps die outside, but the pass rush arrives under control and inside runs soften. CRASH pins ears back \u2014 more sacks, better dive-stuffing, and everything that bounces outside (jets, screens, draws) hurts more. Facing a motion-heavy or jet team? Contain. A statue QB behind a bad line? Crash.</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">Substitutions <span class="gp-hint">(answering their personnel)</span></label>
            <div class="gp-options">
              ${[["match", "Match"], ["auto", "Auto"], ["base", "Stay Base"]].map(([val, lbl]) => `
                <button class="gp-option gp-option-sm${(gp.subPhilosophy || "auto") === val ? " active" : ""}"
                        data-gp-set="subPhilosophy" data-gp-val="${val}">${lbl}</button>
              `).join("")}
            </div>
            <div class="gp-tip tip-info">\u25B8 MATCH answers spread sets with the nickel and dime on ANY down \u2014 coverage bodies against receivers, but light boxes that spread-to-run teams feast on. STAY BASE keeps your linebackers out there and dares them to throw at you \u2014 heavy vs the run, exposed when their slot man draws your MIKE. AUTO subs by down and distance like everyone's coordinator.</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">Tackling <span class="gp-hint">(wrap vs strip)</span></label>
            <div class="gp-options">
              ${[["wrap", "Wrap Up"], ["balanced", "Balanced"], ["strip", "Strip Hunt"]].map(([val, lbl]) => `
                <button class="gp-option gp-option-sm${(gp.tackleStyle || "balanced") === val ? " active" : ""}"
                        data-gp-set="tackleStyle" data-gp-val="${val}">${lbl}</button>
              `).join("")}
            </div>
            <div class="gp-tip tip-info">\u25B8 STRIP HUNT punches at the ball on every contact \u2014 far more balls on the ground, but going for the ball misses wraps, and a missed wrap is a broken tackle with grass behind it. WRAP UP finishes what it touches \u2014 fewer big runs against you, fewer takeaways for you. Turnover margin vs yardage allowed: pick your religion.</div>
          </div>
          </details>`}

          ${defSubTab !== "coverage" ? "" : `
          <details class="gp-section" open>
          <summary class="gp-section-hdr">COVERAGE <span class="gp-section-sub">shells &amp; eyes</span></summary>

          <div class="gp-row">
            <label class="gp-label">${tipTerm("robber", "Robber Call")} <span class="gp-hint">(the two-high safety's leash)</span></label>
            <div class="gp-options">
              ${[["auto", "Auto"], ["rob", "Rob the middle"], ["overtop", "Stay over top"]].map(([val, lbl]) => `
                <button class="gp-option gp-option-sm${(gp.robberCall || "auto") === val ? " active" : ""}"
                        data-gp-set="robberCall" data-gp-val="${val}">${lbl}</button>
              `).join("")}
            </div>
            <div class="gp-tip tip-info">▸ Two-high shells only. ROB THE MIDDLE turns the safety's read loose — he undercuts the in-breakers harder and jumps more throws — but a helper cheating downhill isn't capping the deep shot, and the post over his head knows it. STAY OVER TOP glues the lid on: no robber, ever, and a little less grass deep. AUTO lets his eyes make the call. Also callable per-snap from the defensive headset.</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">${tipTerm("zone-style", "Zone Style")} <span class="gp-hint">(sit in lanes vs carry routes)</span></label>
            <div class="gp-options">
              ${[["spot", "Spot-drop"], ["balanced", "Balanced"], ["match", "Match"]].map(([val, lbl]) => `
                <button class="gp-option gp-option-sm${(gp.zoneStyle || "balanced") === val ? " active" : ""}"
                        data-gp-set="zoneStyle" data-gp-val="${val}">${lbl}</button>
              `).join("")}
            </div>
            <div class="gp-tip tip-info">▸ How your zones are coached. MATCH travels with routes — floods and high-lows find far less grass — but it asks for smart, technical defenders: a man without the head for it loses his route mid-pattern and the bust is a chunk play. SPOT-DROP sits in the throwing lanes — a touch stingier underneath and it never busts — but a flood outnumbers grass every time. BALANCED splits the difference; it's the pre-dial game.</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">${tipTerm("coverage-scheme", "Coverage Scheme")}</label>
            <div class="gp-options">
              ${[["balanced", "Balanced"], ["lockTop", "Lock WR1"], ["bracketTop", "Bracket WR1"]].map(([val, lbl]) => `
                <button class="gp-option gp-option-sm${covScheme === val ? " active" : ""}"
                        data-gp-set="coverageScheme" data-gp-val="${val}">${lbl}</button>
              `).join("")}
            </div>
            <div class="gp-tip tip-info">${COV_TIPS[covScheme]}</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">${tipTerm("safety-shell", "Safety Shell")} <span class="gp-hint">(the deep math)</span></label>
            <div class="gp-options">
              ${[["single", "Single-High"], ["balanced", "Balanced"], ["two", "Two-High"]].map(([val, lbl]) => `
                <button class="gp-option gp-option-sm${(gp.covShell || "balanced") === val ? " active" : ""}"
                        data-gp-set="covShell" data-gp-val="${val}">${lbl}</button>
              `).join("")}
            </div>
            <div class="gp-tip tip-info">\u25B8 The central bargain of modern defense. SINGLE-HIGH drops the eighth man into the box \u2014 the run game and play-action fakes hit a wall, but one deep safety means the post and the go ball are live. TWO-HIGH blankets the deep shots and concedes a lighter box: expect to get run on. There is no free lunch; there's only choosing which one to buy.</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">${tipTerm("coverage", "Coverage")} Style <span class="gp-hint">(man vs zone)</span></label>
            <div class="gp-options">
              ${[["man", "Man"], ["balanced", "Mixed"], ["zone", "Zone"]].map(([val, lbl]) => `
                <button class="gp-option gp-option-sm${(gp.covStyle || "balanced") === val ? " active" : ""}"
                        data-gp-set="covStyle" data-gp-val="${val}">${lbl}</button>
              `).join("")}
            </div>
            <div class="gp-tip tip-info">\u25B8 MAN presses the quick game and travels with receivers \u2014 but motion stresses it hard, scramblers gash defenders playing with their backs turned, and picks come slower. ZONE keeps every eye on the QB: screens get sniffed, scrambles get rallied to, interceptions come up \u2014 and the underneath stuff is there all day. Your PERSONNEL decides which you can afford: man grades your DBs on speed and mirror agility; zone grades them on awareness and technique. Fast corners who can't read? Man. Film junkies without wheels? Zone.</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">${tipTerm("cushion", "Cushion")} <span class="gp-hint">(press vs off \u2014 man calls only)</span></label>
            <div class="gp-options">
              ${[["press", "Press"], ["balanced", "Balanced"], ["off", "Off / Soft"]].map(([val, lbl]) => `
                <button class="gp-option gp-option-sm${(gp.pressLevel || "balanced") === val ? " active" : ""}"
                        data-gp-set="pressLevel" data-gp-val="${val}">${lbl}</button>
              `).join("")}
            </div>
            <div class="gp-tip tip-info">\u25B8 PRESS jams at the line \u2014 timing routes die in the receiver's stem, but lose the jam and it's a footrace with nobody home, and living that close to the edge draws flags. OFF concedes the underneath completions to keep a lid on everything deep. Strong-handed, technical corners earn the right to press; everyone else is donating.</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">${tipTerm("bracket-target", "Bracket Target")} <span class="gp-hint">(who Lock/Bracket keys on)</span></label>
            <div class="gp-options">
              ${[["auto", "Auto (top threat)"], ["te1", "Their TE"], ["slot", "Their Slot"], ["hot", "Hot Man"]].map(([val, lbl]) => `
                <button class="gp-option gp-option-sm${(gp.bracketWho || "auto") === val ? " active" : ""}"
                        data-gp-set="bracketWho" data-gp-val="${val}">${lbl}</button>
              `).join("")}
            </div>
            <div class="gp-tip tip-info">\u25B8 Only matters when Coverage Scheme is Lock or Bracket. AUTO shadows their most dangerous receiver. THEIR TE erases the security blanket; THEIR SLOT takes away the inside quick game. HOT MAN reads the game as it happens \u2014 whoever they've fed most today gets the extra body from that point on.</div>
          </div>
          </details>`}

          ${defSubTab !== "calls" ? "" : renderDefCallsSection(gp)}

          ${defSubTab !== "checks" ? "" : renderFormChecksSection(gp)}

          ${defSubTab !== "pressure" ? "" : `
          <details class="gp-section" open>
          <summary class="gp-section-hdr">PRESSURE <span class="gp-section-sub">bringing the heat</span></summary>

          <div class="gp-row">
            <label class="gp-label">${tipTerm("def-aggression", "Aggression")} <span class="gp-hint">(how much you risk)</span></label>
            <div class="gp-options">
              ${C.AGGRESSION.order.map((val) => `
                <button class="gp-option gp-option-sm${aggrOf(gp) === val ? " active" : ""}"
                        data-gp-aggr="${val}">${C.AGGRESSION.labels[val]}</button>
              `).join("")}
            </div>
            <div class="gp-tip tip-info">${{
      bend: "\u25B8 BEND \u2014 rush four, keep everything in front, make them earn every blade of grass. Almost no free runners for the offense to feast on... and almost no free plays for you either. Death by paper cuts, in both directions.",
      selective: "\u25B8 SELECTIVE \u2014 a spot-picker's defense. Quiet on early downs, then the heat arrives exactly when the whole stadium knows a pass is coming. Your coordinator's blitz design decides how well those spots are picked.",
      balanced: "\u25B8 BALANCED \u2014 pressure often enough that the protection has to respect it, honest enough that you're rarely caught with your coverage down. The league default for a reason.",
      attacking: "\u25B8 ATTACKING \u2014 the pressure IS the identity. More sacks, more hurried throws, more short fields \u2014 and more snaps where a beaten blitz means grass and a footrace you didn't schedule.",
      house: "\u25B8 BRING THE HOUSE \u2014 heat on almost every dropback, an extra hat in every call. Quarterbacks live in a storm... until one throw beats one man and there's nobody home. The max-risk religion."
    }[aggrOf(gp)]}</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">${tipTerm("pressure-style", "Pressure Style")} <span class="gp-hint">(what your blitz looks like)</span></label>
            <div class="gp-options">
              <button class="gp-option gp-option-sm${!gp.pressureIdentity ? " active" : ""}"
                      data-gp-pressid="auto">Auto \u2014 ${escapeHtml((_d = FRONT_PRESSURE_SIGNATURE[gp.defBaseFront || "4-3"] && ((_c = C.PRESS_IDENTITY[FRONT_PRESSURE_SIGNATURE[gp.defBaseFront || "4-3"]]) == null ? void 0 : _c.label)) != null ? _d : "front\u2019s signature")}</button>
              ${Object.entries(C.PRESS_IDENTITY).map(([val, d]) => `
                <button class="gp-option gp-option-sm${gp.pressureIdentity === val ? " active" : ""}"
                        data-gp-pressid="${val}">${d.label}</button>
              `).join("")}
            </div>
            <div class="gp-tip tip-info">${{
      auto: `\u25B8 AUTO runs your front's signature package \u2014 ${escapeHtml((_e = FRONT_SIG_LABEL[gp.defBaseFront || "4-3"]) != null ? _e : "its natural pressure")}. Every front executes its own blitz best; borrow another front's heat and the angles come out a step late.`,
      fireZone: "\u25B8 FIRE ZONE \u2014 show pressure, drop a shown rusher, bring a backer behind it. Same number of rushers, wrong angles for the protection: the low-risk lie. The 3-4 speaks this natively; other fronts fake it a beat slower.",
      secondLevel: "\u25B8 SECOND LEVEL \u2014 linebackers downhill through the gaps. Honest, violent, and the run fits stay sound... but the middle of the field just lost its readers.",
      secondaryHeat: "\u25B8 SECONDARY HEAT \u2014 the strong safety or slot corner comes screaming off the edge. It arrives faster than any backer and the protection rarely sees it \u2014 but a DB in the rush is a hole in the coverage, and deep over the top is where it lives.",
      theHouse: "\u25B8 THE HOUSE \u2014 six coming, everyone else manned up with no help: the zero. The maximum-risk, maximum-violence call. When it gets home, it's a highlight; when it doesn't, it's six the other way."
    }[gp.pressureIdentity || "auto"]}</div>
            <div class="gp-tip tip-info">\u25B8 Who carries it: your \u26A1 shares on the <a data-nav="depthchart" class="link">Depth Chart</a> field still name the preferred hitman inside the package \u2014 the identity decides the shape, your dial decides the man.</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">Green Dog <span class="gp-hint">(rush when your man stays in)</span></label>
            <div class="gp-options">
              ${[[false, "Off"], [true, "On"]].map(([val, lbl]) => `
                <button class="gp-option gp-option-sm${gp.greenDog === true === val ? " active" : ""}"
                        data-gp-boolset="greenDog" data-gp-boolval="${val}">${lbl}</button>
              `).join("")}
            </div>
            <div class="gp-tip tip-info">\u25B8 The check-blitz: when their back stays in to pass-protect, your linebacker has nobody to cover \u2014 Green Dog sends him instead of letting him stand around. Free pressure against max-protect teams; does nothing when the back releases into a route. The cheapest aggression in the game.</div>
          </div>

          <div class="gp-row">
            <label class="gp-label">QB Spy <span class="gp-hint">(a defender mirrors the QB)</span></label>
            <div class="gp-options">
              ${[[false, "Off"], [true, "On"]].map(([val, lbl]) => `
                <button class="gp-option gp-option-sm${gp.spyQB === true === val ? " active" : ""}"
                        data-gp-boolset="spyQB" data-gp-boolval="${val}">${lbl}</button>
              `).join("")}
            </div>
            <div class="gp-tip tip-info">\u25B8 One defender's whole job is the quarterback's legs: scrambles nearly halve and the lanes shrink when he does escape. The cost is that body doing nothing else \u2014 worth it against a scrambler, wasted against a statue. Stacks with Contain QB (the Front tab's option assignment) for a full anti-runner plan.</div>
          
          </div>
          </details>`}



        </div>
      </div>`;
}
function holdAndRebalance(forms, movedIdx, movedVal) {
  const n = forms.length;
  if (n <= 1) {
    if (forms[0]) forms[0].weight = 100;
    return;
  }
  const maxAllowed = 100 - 5 * (n - 1);
  const held = Math.max(5, Math.min(maxAllowed, movedVal));
  forms[movedIdx].weight = held;
  const others = forms.filter((_, j) => j !== movedIdx);
  const rest = 100 - held;
  const otherTotal = others.reduce((s, f) => s + (f.weight || 0), 0);
  others.forEach((f) => {
    const share = otherTotal > 0 ? (f.weight || 0) / otherTotal : 1 / others.length;
    f.weight = Math.max(5, Math.round(rest * share));
  });
  const drift = 100 - forms.reduce((s, f) => s + f.weight, 0);
  if (drift !== 0) {
    const largest = others.reduce((a, b) => b.weight > a.weight ? b : a, others[0]);
    largest.weight = Math.max(5, largest.weight + drift);
  }
}
function holdAndRebalanceDist(obj, keys, movedKey, movedVal) {
  const held = Math.max(0, Math.min(100, movedVal));
  obj[movedKey] = held;
  const others = keys.filter((k) => k !== movedKey);
  const rest = 100 - held;
  const otherTotal = others.reduce((s, k) => s + (obj[k] || 0), 0);
  others.forEach((k) => {
    const share = otherTotal > 0 ? (obj[k] || 0) / otherTotal : 1 / others.length;
    obj[k] = Math.round(rest * share);
  });
  const drift = 100 - keys.reduce((s, k) => s + (obj[k] || 0), 0);
  if (drift !== 0) {
    const tgt = others.reduce((a, b) => (obj[b] || 0) > (obj[a] || 0) ? b : a, others[0]);
    obj[tgt] = Math.max(0, (obj[tgt] || 0) + drift);
  }
}
function normalizeDistTo100(obj, keys) {
  const total = keys.reduce((s, k) => s + (obj[k] || 0), 0);
  if (total === 100 || total <= 0) return;
  keys.forEach((k) => {
    obj[k] = Math.round((obj[k] || 0) * 100 / total);
  });
  const drift = 100 - keys.reduce((s, k) => s + obj[k], 0);
  if (drift !== 0) {
    const tgt = keys.reduce((a, b) => obj[b] > obj[a] ? b : a, keys[0]);
    obj[tgt] += drift;
  }
}
function wireDefaultsListeners(gp, { root = document } = {}) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o;
  // D17 BATCH C-1: write a dial (or a group of dials) through the parts. The
  // `gp` BINDING is reassigned to the freshly compiled plan so every handler in
  // this closure keeps reading the live plan — a recompile returns a NEW object,
  // and a captured stale one would silently render yesterday's values.
  // Falls back to a plain write when there is no school (harness/detached use).
  const writeDial = (patch) => {
    const sch = getPlayerSchool();
    if (sch) gp = setPlanFields(sch, patch);
    else Object.assign(gp, patch);
    return gp;
  };
  gp.offFormations = normalizeFormations(gp.offFormations, gp.offFormation);
  // The formation add/remove picker is gone (owner call, 2026-08-15): the
  // playbook owns WHICH formations you carry; this screen only re-weights them.
  root.querySelectorAll("[data-gp-workshop]").forEach((btn) => {
    btn.addEventListener("click", () => { state.ui.creatorTab = null; navigate("creator"); });
  });
  root.querySelectorAll("[data-dfmix-front]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!Array.isArray(gp.defFrontMix)) gp.defFrontMix = [];
      const fid = btn.dataset.dfmixFront;
      const idx = gp.defFrontMix.findIndex((f) => f.id === fid);
      if (idx >= 0) gp.defFrontMix.splice(idx, 1);
      else {
        if (gp.defFrontMix.length >= 5) gp.defFrontMix.pop();
        gp.defFrontMix.push({ id: fid, weight: 33 });
      }
      if (gp.defFrontMix.length) rebalanceWeights(gp.defFrontMix);
      rerender();
    });
  });
  root.querySelectorAll(".dfw-slider").forEach((slider) => {
    slider.addEventListener("input", () => {
      const i = parseInt(slider.dataset.dfwIndex);
      if (!Array.isArray(gp.defFrontMix) || !gp.defFrontMix[i]) return;
      holdAndRebalance(gp.defFrontMix, i, parseInt(slider.value));
      gp.defFrontMix.forEach((f, j) => {
        const sl = root.querySelector(`.dfw-slider[data-dfw-index="${j}"]`);
        if (sl && j !== i) sl.value = f.weight;
        const pctEl = root.querySelector(`#dfw-pct-${j}`);
        if (pctEl) pctEl.textContent = `${Math.round(f.weight)}%`;
      });
    });
  });
  root.querySelectorAll(".fw-slider").forEach((slider) => {
    slider.addEventListener("input", () => {
      const i = parseInt(slider.dataset.fwIndex);
      if (!gp.offFormations[i]) return;
      holdAndRebalance(gp.offFormations, i, parseInt(slider.value));
      gp.offFormations.forEach((f, j) => {
        const sl = root.querySelector(`.fw-slider[data-fw-index="${j}"]`);
        if (sl && j !== i) sl.value = f.weight;
        const pctEl = root.querySelector(`#fw-pct-${j}`);
        if (pctEl) pctEl.textContent = `${Math.round(f.weight)}%`;
      });
    });
  });
  // ── D17 BATCH C-1: the three GENERIC dial handlers write through the PARTS ──
  // These three cover most of the screen's chips and toggles, for both sides of
  // the ball, because they route by FIELD NAME — which is exactly what the seam
  // routes on. `writeDial` sends each field to its owner (book / defbook /
  // overlay) and recompiles.
  //
  // Routing is correctness, not tidiness: compile layers overlay → book →
  // defbook, so a book-owned field written to the overlay is SWALLOWED by the
  // book on the next compile and the coach's change disappears. Writing the flat
  // bag has the same problem from the other end — the next recompile discards it.
  root.querySelectorAll("[data-gp-set]").forEach((btn) => {
    btn.addEventListener("click", () => {
      writeDial({ [btn.dataset.gpSet]: btn.dataset.gpVal });
      rerender();
    });
  });
  root.querySelectorAll("[data-gp-boolset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      writeDial({ [btn.dataset.gpBoolset]: btn.dataset.gpBoolval === "true" });
      rerender();
    });
  });
  root.querySelectorAll("[data-gp-aggr]").forEach((btn) => {
    btn.addEventListener("click", () => {
      // setAggr writes the stop AND its derived blitzPct mirror (D16/OD-8), so
      // it is applied to a scratch bag and the pair committed together.
      const _pair = {};
      setAggr(_pair, btn.dataset.gpAggr);
      writeDial(_pair);
      rerender();
    });
  });
  root.querySelectorAll("[data-gp-pressid]").forEach((btn) => {
    btn.addEventListener("click", () => {
      gp.pressureIdentity = btn.dataset.gpPressid === "auto" ? null : btn.dataset.gpPressid;
      rerender();
    });
  });
  root.querySelectorAll("[data-rundir]").forEach((sl) => {
    sl.addEventListener("input", (e) => {
      if (!gp.runDirection) gp.runDirection = { left: 33, middle: 34, right: 33 };
      holdAndRebalanceDist(gp.runDirection, ["left", "middle", "right"], sl.dataset.rundir, parseInt(e.target.value) || 0);
      root.querySelectorAll("[data-rundir]").forEach((other) => {
        var _a2;
        const k = other.dataset.rundir;
        if (other !== sl) other.value = gp.runDirection[k];
        const v = (_a2 = other.parentElement) == null ? void 0 : _a2.querySelector(".run-dir-val");
        if (v) v.textContent = gp.runDirection[k];
      });
    });
  });
  (_a = root.querySelector("#screen-rate")) == null ? void 0 : _a.addEventListener("input", (e) => {
    gp.screenRate = parseInt(e.target.value);
    const el = root.querySelector("#screen-val");
    if (el) el.textContent = `${e.target.value}%`;
  });
  (_b = root.querySelector("#rpo-rate")) == null ? void 0 : _b.addEventListener("input", (e) => {
    gp.rpoRate = parseInt(e.target.value);
    const el = root.querySelector("#rpo-val");
    if (el) el.textContent = `${e.target.value}%`;
  });
  (_b = root.querySelector("#gadget-rate")) == null ? void 0 : _b.addEventListener("input", (e) => {
    gp.gadgetRate = parseInt(e.target.value);
    const el = root.querySelector("#gadget-val");
    if (el) el.textContent = `${e.target.value}%`;
  });
  (_c = root.querySelector("#option-rate")) == null ? void 0 : _c.addEventListener("input", (e) => {
    gp.optionRate = parseInt(e.target.value);
    const el = root.querySelector("#option-rate-val");
    if (el) el.textContent = `${e.target.value}%`;
  });
  (_d = root.querySelector("#pitch-aggr")) == null ? void 0 : _d.addEventListener("input", (e) => {
    gp.pitchAggr = parseInt(e.target.value);
    const el = root.querySelector("#pitch-aggr-val");
    if (el) el.textContent = `${e.target.value}`;
  });
  (_e = root.querySelector("#jet-rate")) == null ? void 0 : _e.addEventListener("input", (e) => {
    gp.jetRate = parseInt(e.target.value);
    const el = root.querySelector("#jet-rate-val");
    if (el) el.textContent = `${e.target.value}%`;
  });
  (_f = root.querySelector("#draw-rate")) == null ? void 0 : _f.addEventListener("input", (e) => {
    gp.drawRate = parseInt(e.target.value);
    const el = root.querySelector("#draw-rate-val");
    if (el) el.textContent = `${e.target.value}%`;
  });
  (_g = root.querySelector("#pa-rate")) == null ? void 0 : _g.addEventListener("input", (e) => {
    gp.paRate = parseInt(e.target.value);
    const el = root.querySelector("#pa-rate-val");
    if (el) el.textContent = `${e.target.value}%`;
  });
  (_h = root.querySelector("#motion-rate")) == null ? void 0 : _h.addEventListener("input", (e) => {
    gp.motionRate = parseInt(e.target.value);
    const el = root.querySelector("#motion-rate-val");
    if (el) el.textContent = `${e.target.value}%`;
  });
  (_i = root.querySelector("#prot-emph")) == null ? void 0 : _i.addEventListener("input", (e) => {
    gp.protEmphasis = parseInt(e.target.value);
    const el = root.querySelector("#prot-emph-val");
    if (el) el.textContent = `${e.target.value}`;
  });
  (_j = root.querySelector("#qb-aggr")) == null ? void 0 : _j.addEventListener("input", (e) => {
    gp.qbAggr = parseInt(e.target.value);
    const el = root.querySelector("#qb-aggr-val");
    if (el) el.textContent = `${e.target.value}`;
  });
  root.querySelectorAll("input[data-cw]").forEach((sl) => {
    sl.addEventListener("input", (e) => {
      if (!gp.conceptWeights) gp.conceptWeights = {};
      gp.conceptWeights[sl.dataset.cw] = parseInt(e.target.value);
      const grp = root.querySelectorAll(`input[data-cwgrp="${sl.dataset.cwgrp}"]`);
      let tot = 0;
      grp.forEach((g) => {
        tot += parseInt(g.value) || 0;
      });
      grp.forEach((g) => {
        const w = parseInt(g.value) || 0;
        const el = root.querySelector(`.cw-val[data-cwval="${CSS.escape(g.dataset.cw)}"]`);
        if (!el) return;
        el.textContent = w === 0 ? "benched" : `\u2248${tot ? Math.round(100 * w / tot) : 0}%`;
        el.classList.toggle("cw-benched", w === 0);
      });
    });
  });
  (_k = root.querySelector("#cw-reset")) == null ? void 0 : _k.addEventListener("click", () => {
    gp.conceptWeights = {};
    rerender();
  });
  // Madden pass 2: per-formation playbook editor wiring
  root.querySelectorAll("[data-pbform]").forEach((btn) => {
    btn.addEventListener("click", () => {
      pbFormTab = btn.dataset.pbform || null;
      rerender();
    });
  });
  root.querySelectorAll("input[data-fpb]").forEach((sl) => {
    sl.addEventListener("input", (e) => {
      // data-fpbform is a LOOK key ("fid" or "fid|variation"). Each look owns its
      // sheet outright now (the book seeds it), so a slide just writes the value
      // — no fork-on-first-write copy, no inherit-base to protect (2026-08-18).
      const key = sl.dataset.fpbform, nm = sl.dataset.fpb;
      const all = gp.formationPlaybooks || (gp.formationPlaybooks = {});
      const sheet = all[key] || (all[key] = {});
      sheet[nm] = parseInt(e.target.value);
      const grp = root.querySelectorAll(`input[data-fpbgrp="${sl.dataset.fpbgrp}"]`);
      let tot = 0;
      grp.forEach((g) => { tot += parseInt(g.value) || 0; });
      grp.forEach((g) => {
        const w = parseInt(g.value) || 0;
        const el = root.querySelector(`.cw-val[data-fpbval="${CSS.escape(g.dataset.fpb)}"]`);
        if (!el) return;
        el.textContent = w === 0 ? "benched" : `\u2248${tot ? Math.round(100 * w / tot) : 0}%`;
        el.classList.toggle("cw-benched", w === 0);
      });
    });
    // No mid-drag rerender any more — there are no pills to refresh, and a
    // rerender while dragging is jarring. The live % text above updates in place.
  });
  (_k = root.querySelector("#fpb-reset")) == null ? void 0 : _k.addEventListener("click", () => {
    var _b;
    // Reset drops this look's overrides so it falls back to the global default
    // mix (the "All Plays" sheet). The label says as much.
    const key = (_b = root.querySelector("#fpb-reset")) == null ? void 0 : _b.dataset.fpbform;
    if (key && gp.formationPlaybooks) {
      delete gp.formationPlaybooks[key];
      if (!Object.keys(gp.formationPlaybooks).length) delete gp.formationPlaybooks;
    }
    rerender();
  });
  root.querySelectorAll("[data-offsub]").forEach((btn) => {
    btn.addEventListener("click", () => {
      offSubTab = btn.dataset.offsub;
      rerender();
    });
  });
  root.querySelectorAll("[data-defsub]").forEach((btn) => {
    btn.addEventListener("click", () => {
      defSubTab = btn.dataset.defsub;
      rerender();
    });
  });
  // F2: check-with-me chips
  root.querySelectorAll("[data-chk-class]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cls = btn.dataset.chkClass, field = btn.dataset.chkField, val = btn.dataset.chkVal;
      const checks = gp.formChecks || (gp.formChecks = {});
      const cell = checks[cls] || (checks[cls] = {});
      const v = field === "runCommit" ? parseInt(val, 10) : val;
      if (field === "runCommit" ? cell[field] === v : cell[field] === v) delete cell[field];
      else cell[field] = v;
      if (!Object.keys(cell).length) delete checks[cls];
      if (!Object.keys(checks).length) delete gp.formChecks;
      rerender();
    });
  });
  root.querySelectorAll("[data-chk-clear]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const checks = gp.formChecks || {};
      const cell = checks[btn.dataset.chkClear || btn.dataset.chkClass];
      if (cell) {
        delete cell[btn.dataset.chkField];
        if (!Object.keys(cell).length) delete checks[btn.dataset.chkClear];
        if (!Object.keys(checks).length) delete gp.formChecks;
      }
      rerender();
    });
  });
  root.querySelectorAll("[data-chk-reset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (gp.formChecks) {
        delete gp.formChecks[btn.dataset.chkReset];
        if (!Object.keys(gp.formChecks).length) delete gp.formChecks;
      }
      rerender();
    });
  });
  // PASS 2: named calls — the library
  (_l = root.querySelector("#new-call-add")) == null ? void 0 : _l.addEventListener("click", () => {
    var _i;
    const nm = (((_i = root.querySelector("#new-call-name")) == null ? void 0 : _i.value) || "").trim().slice(0, 24);
    if (!nm) return;
    const calls = gp.defCalls || (gp.defCalls = {});
    if (Object.keys(calls).length >= MAX_DEF_CALLS || calls[nm]) {
      if (!Object.keys(calls).length) delete gp.defCalls;
      return;
    }
    calls[nm] = {};
    callEditName = nm;
    rerender();
  });
  root.querySelectorAll("[data-call-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      callEditName = callEditName === btn.dataset.callOpen ? null : btn.dataset.callOpen;
      rerender();
    });
  });
  root.querySelectorAll("[data-call-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nm = btn.dataset.callDel;
      if (gp.defCalls) {
        delete gp.defCalls[nm];
        if (!Object.keys(gp.defCalls).length) delete gp.defCalls;
      }
      sheetPurgeName(gp, nm);
      if (callEditName === nm) callEditName = null;
      rerender();
    });
  });
  root.querySelectorAll("[data-call-name]").forEach((btn) => {
    btn.addEventListener("click", () => {
      var _c2;
      const nm = btn.dataset.callName, field = btn.dataset.callField, val = btn.dataset.callVal;
      const call = (_c2 = gp.defCalls) == null ? void 0 : _c2[nm];
      if (!call) return;
      const v = field === "runCommit" ? parseInt(val, 10) : field === "rush3" ? true : val;
      if (call[field] === v) delete call[field];
      else call[field] = v;
      rerender();
    });
  });
  root.querySelectorAll("[data-call-clear]").forEach((btn) => {
    btn.addEventListener("click", () => {
      var _c2;
      const call = (_c2 = gp.defCalls) == null ? void 0 : _c2[btn.dataset.callClear];
      if (call) delete call[btn.dataset.callField];
      rerender();
    });
  });
  // PASS 2: the matchup call sheet
  root.querySelectorAll("[data-dcs-sit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      callSheetSit = btn.dataset.dcsSit;
      rerender();
    });
  });
  root.querySelectorAll("[data-dcs-pers]").forEach((btn) => {
    btn.addEventListener("click", () => {
      callSheetPers = btn.dataset.dcsPers;
      rerender();
    });
  });
  root.querySelectorAll("[data-dcs-call]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nm = btn.dataset.dcsCall;
      const cell = sheetCellOf(gp, callSheetSit, callSheetPers, true);
      const i = cell.findIndex((e) => e[0] === nm);
      if (i >= 0) cell.splice(i, 1);
      else cell.push([nm, 50]);
      // Rebalance to 100 across the cell (equal-ish, preserving ratios).
      const total = cell.reduce((s, e) => s + (e[1] || 0), 0) || 1;
      cell.forEach((e) => e[1] = Math.max(5, Math.round((e[1] || 50) / total * 100)));
      sheetCleanup(gp);
      rerender();
    });
  });
  root.querySelectorAll(".dcw-slider").forEach((slider) => {
    slider.addEventListener("input", () => {
      const i = parseInt(slider.dataset.dcwIndex);
      const cell = sheetCellOf(gp, callSheetSit, callSheetPers);
      if (!Array.isArray(cell) || !cell[i]) return;
      const objs = cell.map((e) => ({ id: e[0], weight: e[1] }));
      holdAndRebalance(objs, i, parseInt(slider.value));
      objs.forEach((o, j) => cell[j] = [o.id, o.weight]);
      root.querySelectorAll(".dcw-slider").forEach((other) => {
        const j = parseInt(other.dataset.dcwIndex);
        if (other !== slider && cell[j]) other.value = cell[j][1];
        const pct = root.querySelector(`#dcw-pct-${j}`);
        if (pct && cell[j]) pct.textContent = `${Math.round(cell[j][1])}%`;
      });
    });
  });
  (_l = root.querySelector("#wildcat-pass")) == null ? void 0 : _l.addEventListener("input", (e) => {
    gp.wildcatPassRate = parseInt(e.target.value);
    const el = root.querySelector("#wildcat-pass-val");
    if (el) el.textContent = `${e.target.value}%`;
  });
  root.querySelectorAll("[data-optmix]").forEach((sl) => {
    sl.addEventListener("input", (e) => {
      if (!gp.optionMix) gp.optionMix = { dive: 40, keep: 30, pitch: 30 };
      holdAndRebalanceDist(gp.optionMix, ["dive", "keep", "pitch"], sl.dataset.optmix, parseInt(e.target.value) || 0);
      root.querySelectorAll("[data-optmix]").forEach((other) => {
        var _a2;
        const k = other.dataset.optmix;
        if (other !== sl) other.value = gp.optionMix[k];
        const v = (_a2 = other.parentElement) == null ? void 0 : _a2.querySelector(".run-dir-val");
        if (v) v.textContent = `${gp.optionMix[k]}%`;
      });
    });
  });
  root.querySelectorAll("[data-ht-depth]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const PRESETS = {
        quick: { short: 60, medium: 30, deep: 10 },
        balanced: { short: 40, medium: 40, deep: 20 },
        deep: { short: 25, medium: 35, deep: 40 }
      };
      gp.passDepth = __spreadValues({}, PRESETS[btn.dataset.htDepth]);
      rerender();
    });
  });
  (_m = root.querySelector("#box-commit")) == null ? void 0 : _m.addEventListener("input", (e) => {
    gp.runCommit = parseInt(e.target.value);
    const el = root.querySelector("#box-val");
    if (el) el.textContent = `${e.target.value > 0 ? "+" : ""}${e.target.value}`;
  });
  (_n = root.querySelector("#qb-run-pct")) == null ? void 0 : _n.addEventListener("input", (e) => {
    gp.qbRunPct = parseInt(e.target.value);
    const el = root.querySelector("#qb-run-val");
    if (el) el.textContent = `+${e.target.value}%`;
  });
  root.querySelectorAll("[data-passdepth]").forEach((sl) => {
    sl.addEventListener("input", (e) => {
      if (!gp.passDepth) gp.passDepth = { short: 40, medium: 40, deep: 20 };
      holdAndRebalanceDist(gp.passDepth, ["short", "medium", "deep"], sl.dataset.passdepth, parseInt(e.target.value) || 0);
      root.querySelectorAll("[data-passdepth]").forEach((other) => {
        var _a2;
        const k = other.dataset.passdepth;
        if (other !== sl) other.value = gp.passDepth[k];
        const v = (_a2 = other.parentElement) == null ? void 0 : _a2.querySelector(".run-dir-val");
        if (v) v.textContent = `${gp.passDepth[k]}%`;
      });
    });
  });
  root.querySelectorAll("[data-defshare]").forEach((sl) => {
    sl.addEventListener("input", (e) => {
      var _a2;
      if (!gp.targetShares) gp.targetShares = {};
      const key = sl.dataset.defshare;
      gp.targetShares[key] = parseInt(e.target.value) || 0;
      const v = (_a2 = sl.parentElement) == null ? void 0 : _a2.querySelector(".run-dir-val");
      if (v) v.textContent = `${gp.targetShares[key]}%`;
    });
  });
}
function cellIsCustom(sits, key) {
  const c = sits[key];
  return !!c && Object.keys(c).length > 0;
}
// F2 (check-with-me, Aug 2026): calls keyed on what the OFFENSE shows, not
// just down-and-distance. Each class card overlays the effective plan for the
// snap once that personnel breaks the huddle; untouched = no check = today.
var CHK_CLASSES = [
  ["empty", "VS EMPTY", "no backs — 4-5 wide, QB alone"],
  ["spread", "VS SPREAD", "3+ receivers — Spread, Air Raid, Trips, Pistol"],
  ["heavy", "VS HEAVY", "2-back / multi-TE — Power-I, 'bone, Flexbone, Jumbo"],
  ["wildcat", "VS WILDCAT", "direct snap — QB split wide"]
];
var CHK_FIELDS = [
  ["defFront", "Front", [["4-3", "4-3"], ["3-4", "3-4"], ["Tite", "Tite"], ["Nickel", "Nickel"], ["Big Nickel", "Big Nickel"], ["3-3-5", "3-3-5"], ["Penny", "Penny"], ["Dime", "Dime"], ["4-4", "4-4"], ["46/Bear", "46/Bear"], ["5-2", "5-2"]]],
  ["defAggression", "Pressure", [["bend", "Bend"], ["selective", "Selective"], ["balanced", "Balanced"], ["attacking", "Attacking"], ["house", "House"]]],
  ["covShell", "Shell", [["single", "Single"], ["two", "Two-high"]]],
  ["covStyle", "Style", [["man", "Man"], ["zone", "Zone"]]],
  ["edgePlay", "Edge", [["contain", "Set it"], ["crash", "Crash"]]],
  ["runCommit", "Box", [["-8", "Lighten the box"], ["8", "Commit to the run"]]]
];
// PASS 2 (Aug 2026): named defensive calls + the matchup call sheet.
// gp.defCalls  = { name → sparse dial payload } (max MAX_DEF_CALLS)
// gp.callSheet = { sitKey → { persClass|any → [[name, weight], …] } }
// Absent = auto = today's game; empty structures are deleted (old-save law).
var MAX_DEF_CALLS = 12;
var CALL_FIELDS = [
  ["front", "Front", [["4-3", "4-3"], ["3-4", "3-4"], ["Tite", "Tite"], ["Nickel", "Nickel"], ["Big Nickel", "Big Nickel"], ["3-3-5", "3-3-5"], ["Penny", "Penny"], ["Dime", "Dime"], ["4-4", "4-4"], ["46/Bear", "46/Bear"], ["5-2", "5-2"]]],
  ["aggression", "Pressure", [["bend", "Bend"], ["selective", "Selective"], ["balanced", "Balanced"], ["attacking", "Attacking"], ["house", "House"]]],
  ["pressureIdentity", "Heat", [["fireZone", "Fire Zone"], ["secondLevel", "Second Level"], ["secondaryHeat", "Secondary Heat"], ["theHouse", "The House"]]],
  ["covShell", "Shell", [["single", "Single"], ["two", "Two-high"]]],
  ["covStyle", "Style", [["man", "Man"], ["zone", "Zone"]]],
  ["edgePlay", "Edge", [["contain", "Set it"], ["crash", "Crash"]]],
  ["robberCall", "Robber", [["rob", "Rob"], ["overtop", "Overtop"]]],
  ["zoneStyle", "Zone Eyes", [["spot", "Spot"], ["match", "Match"]]],
  ["runCommit", "Box", [["-10", "Lighten the box"], ["10", "Commit to the run"]]],
  // PASS 3: coverage-family ingredients — call-only, never standing dials.
  // A family pins the coverage outright (and forces its shell/style); a
  // rotation is the single-high force rule; Rush 3 drops eight. Prevent
  // bundles Rush 3 by itself (owner call).
  ["covFamily", "Coverage", [["Cover 6", "Cover 6"], ["Tampa 2", "Tampa 2"], ["Cover 2-Man", "2-Man"], ["Prevent", "Prevent"]]],
  ["rotation", "Rotation", [["sky", "Sky"], ["cloud", "Cloud"], ["buzz", "Buzz"]]],
  ["rush3", "Rush", [["true", "Rush 3 / Drop 8"]]],
  // PASS 4: pressure-flavor ingredients — call-only, never standing dials.
  // Look = the pre-snap presentation (mug: both A-gaps walked up and shown;
  // amoeba: nobody's hand down). Dog = the interior rule (green: man-your-man
  // converts when the back stays in; cross: the two-backer pick game).
  ["pressLook", "Look", [["mug", "Double-A Mug"], ["amoeba", "Amoeba"]]],
  ["dogGame", "Dog", [["green", "Green Dog"], ["cross", "Cross Dog"]]]
];
var PERS_COLS = [
  ["any", "ANY", "every look this row doesn't name"],
  ["empty", "EMPTY", "no backs"],
  ["10", "10", "1 back \xB7 0 TE — Air Raid"],
  ["11", "11", "1 back \xB7 1 TE — Spread family"],
  ["12", "12", "1 back \xB7 2 TE — Ace"],
  ["heavy", "HEAVY", "2+ backs / multi-TE"],
  ["option", "BONE", "3-back option looks"]
];
function sheetCellOf(gp, sit, pers, create = false) {
  if (create) {
    const sheet = gp.callSheet || (gp.callSheet = {});
    const row = sheet[sit] || (sheet[sit] = {});
    return row[pers] || (row[pers] = []);
  }
  var _r;
  return (_r = gp.callSheet ? gp.callSheet[sit] : null) ? _r[pers] : null;
}
function sheetCleanup(gp) {
  const sheet = gp.callSheet;
  if (!sheet) return;
  for (const sit of Object.keys(sheet)) {
    const row = sheet[sit];
    for (const pers of Object.keys(row)) {
      if (!Array.isArray(row[pers]) || !row[pers].length) delete row[pers];
    }
    if (!Object.keys(row).length) delete sheet[sit];
  }
  if (!Object.keys(sheet).length) delete gp.callSheet;
}
// Drop dead references when a call is deleted or renamed away.
function sheetPurgeName(gp, name) {
  const sheet = gp.callSheet;
  if (!sheet) return;
  for (const row of Object.values(sheet)) {
    for (const pers of Object.keys(row)) {
      row[pers] = (row[pers] || []).filter((e) => Array.isArray(e) && e[0] !== name);
    }
  }
  sheetCleanup(gp);
}
function renderDefCallsSection(gp) {
  const calls = gp.defCalls || {};
  const names = Object.keys(calls);
  const sheet = gp.callSheet || {};
  const sitKeys = SITUATION_KEYS.filter((k) => k !== "openers");
  const sit = sitKeys.includes(callSheetSit) ? callSheetSit : "base";
  const pers = PERS_COLS.some(([p]) => p === callSheetPers) ? callSheetPers : "any";
  const cell = (sheet[sit] || {})[pers] || [];
  const cellNames = cell.map((e) => e[0]);
  const rowHas = (k) => !!(sheet[k] && Object.values(sheet[k]).some((c) => Array.isArray(c) && c.length));
  const persHas = (p) => !!(sheet[sit] && Array.isArray(sheet[sit][p]) && sheet[sit][p].length);
  return `
          <details class="gp-section" open>
          <summary class="gp-section-hdr">NAMED CALLS <span class="gp-section-sub">your call library — packages, not dials</span></summary>
          <div class="gp-tip tip-info">▸ A named call is a whole defense in one word — front, shell, heat and rules saved together, the way a real sheet speaks ("Stack Buzz Dog"). Author up to ${MAX_DEF_CALLS} below, then weight them on the matchup sheet. Any dial a call leaves INHERIT rides your standing plan for that snap.</div>
          ${names.map((nm) => {
    const call = calls[nm] || {};
    const open2 = callEditName === nm;
    const chips = CALL_FIELDS.filter(([f]) => call[f] != null).map(([f, fl, opts]) => {
      var _o;
      const v = String(call[f]);
      return `${fl}: ${((_o = opts.find(([ov]) => ov === v)) == null ? void 0 : _o[1]) || v}`;
    }).join(" \xB7 ") || "nothing set — pure inherit";
    return `
          <div class="gp-row chk-card${open2 ? " chk-live" : ""}">
            <label class="gp-label"><button class="gp-option gp-option-sm${open2 ? " active" : ""}" data-call-open="${escapeHtml(nm)}">${escapeHtml(nm)}</button>
              <span class="gp-hint">${escapeHtml(chips)}</span>
              <button class="sit-mini-btn" data-call-del="${escapeHtml(nm)}">Delete</button></label>
            ${!open2 ? "" : CALL_FIELDS.map(([field, flbl, opts]) => {
      const cur = call[field] != null ? String(call[field]) : null;
      return `
            <div class="chk-row">
              <span class="chk-lbl">${flbl}</span>
              <button class="dc-plan${cur == null ? " active" : ""}" data-call-clear="${escapeHtml(nm)}" data-call-field="${field}">use plan</button>
              ${opts.map(([v, ol]) => `<button class="dc-chip${cur === v ? " active" : ""}" data-call-name="${escapeHtml(nm)}" data-call-field="${field}" data-call-val="${v}">${ol}</button>`).join("")}
            </div>`;
    }).join("")}
          </div>`;
  }).join("")}
          ${names.length >= MAX_DEF_CALLS ? `<div class="gp-tip tip-info">▸ Library full — ${MAX_DEF_CALLS} calls is a real sheet. Delete one to author another.</div>` : `
          <div class="gp-row">
            <div class="chk-row">
              <input type="text" id="new-call-name" maxlength="24" placeholder="Name a call… (e.g. Stack Buzz Dog)" style="flex:1;min-width:0" />
              <button class="gp-option gp-option-sm" id="new-call-add">+ Add call</button>
            </div>
          </div>`}
          </details>

          <details class="gp-section" open>
          <summary class="gp-section-hdr">MATCHUP CALL SHEET <span class="gp-section-sub">situation \xD7 their personnel</span></summary>
          <div class="gp-tip tip-info">▸ The sheet answers one question per snap: THIS situation, THEIR personnel — what do I call? Pick a situation and a personnel column, then weight the calls you'd dial up. ANY covers every look the row doesn't name. Untouched cells play your standing plan exactly; your live headset call still beats the sheet.</div>
          <div class="gp-row">
            <label class="gp-label">Situation</label>
            <div class="gp-options">
              ${sitKeys.map((k) => `<button class="gp-option gp-option-sm${sit === k ? " active" : ""}" data-dcs-sit="${k}">${SITUATION_LABELS[k]}${rowHas(k) ? " ●" : ""}</button>`).join("")}
            </div>
          </div>
          <div class="gp-row">
            <label class="gp-label">Their personnel</label>
            <div class="gp-options">
              ${PERS_COLS.map(([p, pl, pd]) => `<button class="gp-option gp-option-sm${pers === p ? " active" : ""}" data-dcs-pers="${p}" title="${pd}">${pl}${persHas(p) ? " ●" : ""}</button>`).join("")}
            </div>
          </div>
          <div class="gp-row">
            <label class="gp-label">${SITUATION_LABELS[sit]} \xB7 vs ${((PERS_COLS.find(([p]) => p === pers) || [])[1]) || pers}</label>
            ${names.length ? `
            <div class="gp-options">
              ${names.map((nm) => `<button class="gp-option gp-option-sm${cellNames.includes(nm) ? " active" : ""}" data-dcs-call="${escapeHtml(nm)}">${escapeHtml(nm)}</button>`).join("")}
            </div>` : `<div class="gp-tip tip-info">▸ Author a named call above first — the sheet weights calls, it doesn't invent them.</div>`}
            ${cell.length ? `
            <div class="formation-weights">
              ${cell.map((entry, i) => `
                <div class="fw-row">
                  <span class="fw-label">${escapeHtml(entry[0])}</span>
                  <input class="gp-slider dcw-slider" type="range" data-dcw-index="${i}" min="5" max="95" value="${entry[1]}" />
                  <span class="fw-pct" id="dcw-pct-${i}">${Math.round(entry[1])}%</span>
                </div>`).join("")}
              <div class="fw-bar">
                ${cell.map((e, i) => `<div class="fw-seg" style="width:${e[1]}%;background:var(--team-1);opacity:${0.4 + i * 0.2}"></div>`).join("")}
              </div>
              <div class="gp-tip tip-info">▸ The weights are the mix — the sim rolls this cell's calls at these shares every time the moment comes up.</div>
            </div>` : `
            <div class="gp-tip tip-info">▸ Empty cell — the standing plan (and any formation check) plays this moment exactly as today.</div>`}
          </div>
          </details>`;
}
function renderFormChecksSection(gp) {
  const checks = gp.formChecks || {};
  return `
          <details class="gp-section" open>
          <summary class="gp-section-hdr">CHECK-WITH-ME <span class="gp-section-sub">calls keyed on their personnel</span></summary>
          <div class="gp-tip tip-info">▸ The situation cells key on down-and-distance; a real call sheet also keys on PERSONNEL — "vs Empty, bring the house." When the offense breaks the huddle in a class below, your check overlays the standing call for that snap. Anything left on "use plan" rides the plan. Over-check at your peril: motion and the jet game punish a defense that declares off the first look.</div>
          ${CHK_CLASSES.map(([cls, label, desc]) => {
    const cell = checks[cls] || {};
    const has = Object.keys(cell).length > 0;
    return `
          <div class="gp-row chk-card${has ? " chk-live" : ""}">
            <label class="gp-label">${label} <span class="gp-hint">(${desc})</span>${has ? ` <button class="sit-mini-btn" data-chk-reset="${cls}">Reset — no check</button>` : ""}</label>
            ${CHK_FIELDS.map(([field, flbl, opts]) => {
      const cur = field === "runCommit" ? cell[field] != null ? String(cell[field]) : null : cell[field] || null;
      return `
            <div class="chk-row">
              <span class="chk-lbl">${flbl}</span>
              <button class="dc-plan${cur == null ? " active" : ""}" data-chk-clear="${cls}" data-chk-field="${field}">use plan</button>
              ${opts.map(([v, ol]) => `<button class="dc-chip${cur === v ? " active" : ""}" data-chk-class="${cls}" data-chk-field="${field}" data-chk-val="${v}">${ol}</button>`).join("")}
            </div>`;
    }).join("")}
          </div>`;
  }).join("")}
          </details>`;
}
function renderSituationsSection(gp, openKey = openSitKey) {
  const sits = gp.situations || {};
  const customCount = SITUATION_KEYS.filter((k) => cellIsCustom(sits, k)).length;
  return `<div class="card">
  <div class="card-header">
    <span class="card-title">SITUATIONAL PLAN</span>
    <span class="card-subtitle muted">${customCount ? `${customCount} custom \xB7 rest AUTO` : "all AUTO"}</span>
  </div>
  <div class="gameplan-group">
    <div class="gp-tip tip-info">\u25B8 Every snap resolves to exactly one situation below (top of the list wins). This IS your game plan: AUTO cells run your defaults (Offense/Defense Defaults tabs) plus the coordinator's built-in adjustments. Take over a cell and your call replaces the coordinator's \u2014 for that situation only.</div>
    <div class="sit-grid">
      ${SITUATION_KEYS.map((k) => {
    const custom = cellIsCustom(sits, k);
    const open = openKey === k;
    return `<div class="sit-chip${custom ? " custom" : ""}${open ? " open" : ""}" data-sitchip="${k}">
          <div class="sit-chip-head">
            <span class="sit-name">${SITUATION_LABELS[k]}</span>
            <span class="sit-badge${custom ? " custom" : ""}">${custom ? "CUSTOM" : "AUTO"}</span>
          </div>
          <div class="sit-desc muted">${SIT_DESCS[k]}</div>
        </div>`;
  }).join("")}
    </div>
    ${openKey ? renderSitPanel(gp, openKey) : `<div class="gp-tip tip-info" style="margin-top:10px">\u25B8 Tap a situation to plan it.</div>`}
    ${customCount ? `<button class="gp-option gp-option-sm sit-resetall" id="sit-reset-all" style="margin-top:12px">Reset ALL situations to AUTO</button>` : ""}
  </div>
</div>`;
}
function renderSitPanel(gp, key) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H, _I, _J;
  const cell = (gp.situations || {})[key] || {};
  if (cell.passDepth) normalizeDistTo100(cell.passDepth, ["short", "medium", "deep"]);
  const baseForms = normalizeFormations(gp.offFormations, gp.offFormation);
  const inheritForms = baseForms.map((f) => `${escapeHtml(f.id)} ${Math.round(f.weight)}%`).join(" \xB7 ");
  const nudge = SIT_NUDGE[key] || "no situational adjustment";
  const dep = gp.passDepth || { short: 40, medium: 40, deep: 20 };
  const covLabel = (COV_OPTIONS.find(([v]) => v === (gp.coverageScheme || "balanced")) || [])[1] || "Balanced";
  const group = (label, field, isCustom, inheritHtml, customHtml, allowMakeDefault = true) => `
  <div class="sit-group">
    <div class="sit-group-head">
      <label class="gp-label">${label}</label>
      <span class="sit-head-btns">
      ${isCustom ? `${allowMakeDefault ? `<button class="sit-mini-btn" data-sit-makedefault="${field}">Make Default</button>` : ""}
           <button class="sit-mini-btn" data-sit-reset="${field}">Reset to AUTO</button>` : `<button class="sit-mini-btn takeover" data-sit-customize="${field}">Take Over</button>`}
      </span>
    </div>
    ${isCustom ? customHtml : `<div class="sit-inherit muted">${inheritHtml}</div>`}
  </div>`;
  return `<div class="sit-panel">
  <div class="sit-panel-title">${SITUATION_LABELS[key]} <span class="muted">\u2014 ${SIT_DESCS[key]}</span></div>
  <div class="gp-tip tip-info">${SIT_TIPS[key]}</div>

  ${key === "openers" ? "" : `<div class="rec-tabs gp-subtabs">
    ${[["offense", "Offense"], ["defense", "Defense"]].map(([id, lbl]) => `
      <button class="rec-tab${sitSide === id ? " active" : ""}" data-sitside="${id}">${lbl}</button>`).join("")}
  </div>`}

  ${sitSide !== "offense" && key !== "openers" ? "" : `
  <div class="sit-panel-col-title">OFFENSE</div>

  ${group(
    "Formation Package",
    "offFormations",
    Array.isArray(cell.offFormations),
    `AUTO \u2014 your default package: ${inheritForms}`,
    `<div class="sitfc-grid">
      ${Object.keys(FORMATIONS).map((fid) => {
      const entry = (cell.offFormations || []).find((x) => x.id === fid);
      return `<div class="sitfc${entry ? " selected" : ""}" data-sitfc="${fid}">
          <span class="sitfc-name">${escapeHtml(fid)}</span>${entry ? '<span class="fc-check">\u2713</span>' : ""}
        </div>`;
    }).join("")}
    </div>
    <div class="formation-weights" style="margin-top:8px">
      ${(cell.offFormations || []).map((entry, i) => `
        <div class="fw-row">
          <span class="fw-label">${escapeHtml(entry.id)}</span>
          <input class="gp-slider sitfw-slider" type="range" data-sitfw-index="${i}" min="5" max="95" value="${entry.weight}" />
          <span class="fw-pct" id="sitfw-pct-${i}">${Math.round(entry.weight)}%</span>
        </div>`).join("")}
    </div>`
  )}

  ${group(
    "Tendency",
    "tendency",
    cell.tendency != null,
    `AUTO \u2014 ${escapeHtml(gp.tendency || "Balanced")}; coordinator ${nudge}`,
    `<div class="gp-options tendency-options">
      ${Object.keys(PASS_TENDENCY).map((t) => `
        <button class="gp-option gp-option-sm${cell.tendency === t ? " active" : ""}"
                data-sitset-field="tendency" data-sitset-val="${t}">${t}</button>`).join("")}
    </div>`
  )}

  ${group(
    "Pass Depth",
    "passDepth",
    !!cell.passDepth,
    `AUTO \u2014 ${(_a = dep.short) != null ? _a : 40} / ${(_b = dep.medium) != null ? _b : 40} / ${(_c = dep.deep) != null ? _c : 20} (short/med/deep)`,
    `<div class="run-dir-row">
      ${["short", "medium", "deep"].map((d) => {
      var _a2, _b2, _c2, _d2;
      return `
        <div class="run-dir-cell">
          <div class="run-dir-name">${d.toUpperCase()}</div>
          <input class="sit-depth" type="range" data-sit-depth="${d}" min="0" max="100" step="5"
                 value="${(_b2 = (_a2 = cell.passDepth) == null ? void 0 : _a2[d]) != null ? _b2 : 0}">
          <div class="run-dir-val">${(_d2 = (_c2 = cell.passDepth) == null ? void 0 : _c2[d]) != null ? _d2 : 0}%</div>
        </div>`;
    }).join("")}
    </div>`
  )}

  ${group(
    "QB Run Tendency",
    "qbRunPct",
    cell.qbRunPct != null,
    `AUTO \u2014 +${gp.qbRunPct || 0}%`,
    `<div class="gp-slider-wrap">
      <span class="gp-slider-lo">0</span>
      <input class="gp-slider" type="range" id="sit-qbrun" min="0" max="50" value="${(_d = cell.qbRunPct) != null ? _d : 0}" />
      <span class="gp-slider-hi">50</span>
      <span class="gp-slider-val" id="sit-qbrun-val">+${(_e = cell.qbRunPct) != null ? _e : 0}%</span>
    </div>`
  )}

  ${group(
    "Option Rate",
    "optionRate",
    cell.optionRate != null,
    `AUTO \u2014 ${(_f = gp.optionRate) != null ? _f : 70}%`,
    `<div class="gp-slider-wrap">
      <span class="gp-slider-lo">0%</span>
      <input class="gp-slider" type="range" id="sit-optrate" min="0" max="100" value="${(_h = (_g = cell.optionRate) != null ? _g : gp.optionRate) != null ? _h : 70}" />
      <span class="gp-slider-hi">100%</span>
      <span class="gp-slider-val" id="sit-optrate-val">${(_j = (_i = cell.optionRate) != null ? _i : gp.optionRate) != null ? _j : 70}%</span>
    </div>`
  )}

  ${group(
    "Jet Sweep Rate",
    "jetRate",
    cell.jetRate != null,
    `AUTO \u2014 ${(_k = gp.jetRate) != null ? _k : 15}%`,
    `<div class="gp-slider-wrap">
      <span class="gp-slider-lo">0%</span>
      <input class="gp-slider" type="range" id="sit-jetrate" min="0" max="40" value="${(_m = (_l = cell.jetRate) != null ? _l : gp.jetRate) != null ? _m : 15}" />
      <span class="gp-slider-hi">40%</span>
      <span class="gp-slider-val" id="sit-jetrate-val">${(_o = (_n = cell.jetRate) != null ? _n : gp.jetRate) != null ? _o : 15}%</span>
    </div>`
  )}

  ${group(
    "Tempo",
    "tempo",
    cell.tempo != null,
    `AUTO \u2014 ${escapeHtml(gp.baseTempo || "Normal")}`,
    `<div class="gp-options">
      ${["Chew", "Normal", "Hurry"].map((t) => `
        <button class="gp-option gp-option-sm${cell.tempo === t ? " active" : ""}"
                data-sitset-field="tempo" data-sitset-val="${t}">${t}</button>`).join("")}
    </div>
    <div class="gp-tip tip-info">\u25B8 Hurry here burns legs on both sides of the ball \u2014 cheap for a two-minute cell, expensive as a whole identity. Chew shortens the game.</div>`
  )}

  ${group(
    "Draw Rate",
    "drawRate",
    cell.drawRate != null,
    `AUTO \u2014 ${(_p = gp.drawRate) != null ? _p : 8}%`,
    `<div class="gp-slider-wrap">
      <span class="gp-slider-lo">0%</span>
      <input class="gp-slider" type="range" id="sit-drawrate" min="0" max="30" value="${(_r = (_q = cell.drawRate) != null ? _q : gp.drawRate) != null ? _r : 8}" />
      <span class="gp-slider-hi">30%</span>
      <span class="gp-slider-val" id="sit-drawrate-val">${(_t = (_s = cell.drawRate) != null ? _s : gp.drawRate) != null ? _t : 8}%</span>
    </div>`
  )}

  ${group(
    "Protection Style",
    "protIdentity",
    cell.protIdentity != null,
    `AUTO \u2014 ${escapeHtml(C.PROT_IDENTITY.labels[gp.protIdentity || "halfSlide"])}`,
    `<div class="gp-options">
      ${C.PROT_IDENTITY.order.map((v) => `
        <button class="gp-option gp-option-sm${cell.protIdentity === v ? " active" : ""}"
                data-sitset-field="protIdentity" data-sitset-val="${v}">${C.PROT_IDENTITY.labels[v]}</button>`).join("")}
    </div>
    <div class="gp-tip tip-info">\u25b8 How the pocket is built HERE: Quick Game beats the pressure on 3rd &amp; medium, Max Protect buys the 2nd-and-long shot play, Big-on-Big trusts your five on the money down.</div>`
  )}

  ${group(
    "Protection Emphasis",
    "protEmphasis",
    cell.protEmphasis != null,
    `AUTO \u2014 ${(_u = gp.protEmphasis) != null ? _u : 50}`,
    `<div class="gp-slider-wrap">
      <span class="gp-slider-lo">Routes</span>
      <input class="gp-slider" type="range" id="sit-prot" min="0" max="100" value="${(_w = (_v = cell.protEmphasis) != null ? _v : gp.protEmphasis) != null ? _w : 50}" />
      <span class="gp-slider-hi">Protect</span>
      <span class="gp-slider-val" id="sit-prot-val">${(_y = (_x = cell.protEmphasis) != null ? _x : gp.protEmphasis) != null ? _y : 50}</span>
    </div>`
  )}

  ${group(
    "QB Aggression",
    "qbAggr",
    cell.qbAggr != null,
    `AUTO \u2014 ${(_z = gp.qbAggr) != null ? _z : 50}`,
    `<div class="gp-slider-wrap">
      <span class="gp-slider-lo">Protect</span>
      <input class="gp-slider" type="range" id="sit-aggr" min="0" max="100" value="${(_B = (_A = cell.qbAggr) != null ? _A : gp.qbAggr) != null ? _B : 50}" />
      <span class="gp-slider-hi">Push it</span>
      <span class="gp-slider-val" id="sit-aggr-val">${(_D = (_C = cell.qbAggr) != null ? _C : gp.qbAggr) != null ? _D : 50}</span>
    </div>`
  )}

  ${group(
    "Playbook \u2014 Play Mix",
    "conceptWeights",
    !!cell.conceptWeights,
    `AUTO \u2014 your base call sheet${gp.conceptWeights && Object.keys(gp.conceptWeights).length ? " (custom mix)" : " (balanced)"}`,
    `<div class="gp-tip tip-info">\u25B8 THIS situation's play mix. It overlays your base playbook \u2014 bench the fades at the goal line, feature Power on 3rd &amp; short. The call sheet's \u2248% follow it live.</div>
    ${renderPlaybookGroups(gp, { cw: __spreadValues(__spreadValues({}, gp.conceptWeights || {}), cell.conceptWeights), attr: "sitcw" })}`
  )}
  `}

  ${sitSide !== "defense" || key === "openers" ? "" : `
  <div class="sit-panel-col-title">DEFENSE</div>

  ${group(
    "Front",
    "defFront",
    typeof cell.defFront === "string" && cell.defFront !== "auto",
    `AUTO \u2014 your default ${escapeHtml(gp.defBaseFront || "4-3")}; auto-subs by personnel + down: Nickel/Dime vs spread, 46/Bear on short-yardage, a 5-2 wall inside the 1`,
    `<div class="gp-options">
      ${PIN_FRONTS.map((fr) => `
        <button class="gp-option gp-option-sm${cell.defFront === fr ? " active" : ""}"
                data-sitset-field="defFront" data-sitset-val="${fr}">${fr}</button>`).join("")}
    </div>
    <div class="gp-tip tip-info">\u25B8 Pinned: this front takes EVERY snap in this situation \u2014 no auto-subs.</div>`,
    DEF_FRONTS2.includes(cell.defFront)
  )}

  ${group(
    "Aggression",
    "defAggression",
    cell.defAggression != null,
    `AUTO \u2014 ${C.AGGRESSION.labels[aggrOf(gp)] || aggrOf(gp)}`,
    `<div class="gp-options">
      ${C.AGGRESSION.order.map((v) => `
        <button class="gp-option gp-option-sm${cell.defAggression === v ? " active" : ""}"
                data-sitset-field="defAggression" data-sitset-val="${v}">${C.AGGRESSION.labels[v]}</button>`).join("")}
    </div>
    <div class="gp-tip tip-info">\u25B8 This situation gets its own aggression stop \u2014 SELECTIVE unloads here, BEND sits back. Who comes is still your front's identity + your Depth Chart blitz shares.</div>`
  )}

  ${group(
    "Run Commit",
    "runCommit",
    cell.runCommit != null,
    `AUTO \u2014 neutral box`,
    `<div class="gp-slider-wrap">
      <span class="gp-slider-lo">\u221220</span>
      <input class="gp-slider" type="range" id="sit-runcommit" min="-20" max="20" value="${(_H = cell.runCommit) != null ? _H : 0}" />
      <span class="gp-slider-hi">+20</span>
      <span class="gp-slider-val" id="sit-runcommit-val">${((_I = cell.runCommit) != null ? _I : 0) > 0 ? "+" : ""}${(_J = cell.runCommit) != null ? _J : 0}</span>
    </div>
    <div class="gp-tip tip-info">\u25B8 Crowd the box and the ground game dies, but every receiver runs free against a thinner secondary. Drop the box and you hand back the run to keep a lid on the pass. There is no free lunch here.</div>`,
    false
  )}

  ${group(
    "Coverage Scheme",
    "coverageScheme",
    cell.coverageScheme != null,
    `AUTO \u2014 ${escapeHtml(covLabel)}`,
    `<div class="gp-options">
      ${COV_OPTIONS.map(([val, lbl]) => `
        <button class="gp-option gp-option-sm${cell.coverageScheme === val ? " active" : ""}"
                data-sitset-field="coverageScheme" data-sitset-val="${val}">${lbl}</button>`).join("")}
    </div>`
  )}

  ${[
    ["Safety Shell", "covShell", [["single", "Single-High"], ["balanced", "Balanced"], ["two", "Two-High"]], "balanced"],
    ["Coverage Style", "covStyle", [["man", "Man"], ["balanced", "Mixed"], ["zone", "Zone"]], "balanced"],
    ["Cushion", "pressLevel", [["press", "Press"], ["balanced", "Balanced"], ["off", "Off"]], "balanced"],
    ["Edge Discipline", "edgePlay", [["contain", "Contain"], ["balanced", "Balanced"], ["crash", "Crash"]], "balanced"],
    ["Option Assignment", "optionKey", [["balanced", "Balanced"], ["qb", "Contain QB"], ["pitch", "Take Pitch"]], "balanced"],
    ["Substitutions", "subPhilosophy", [["match", "Match"], ["auto", "Auto"], ["base", "Stay Base"]], "auto"],
    ["Tackling", "tackleStyle", [["wrap", "Wrap"], ["balanced", "Balanced"], ["strip", "Strip"]], "balanced"]
  ].map(([lbl, field, opts, dflt]) => {
    var _a2;
    return group(
      lbl,
      field,
      cell[field] != null,
      `AUTO \u2014 ${escapeHtml(String((_a2 = gp[field]) != null ? _a2 : dflt))}`,
      `<div class="gp-options">
      ${opts.map(([val, olbl]) => `
        <button class="gp-option gp-option-sm${cell[field] === val ? " active" : ""}"
                data-sitset-field="${field}" data-sitset-val="${val}">${olbl}</button>`).join("")}
    </div>`
    );
  }).join("")}
  `}

</div>`;
}
function wireSituationListeners(gp, { getOpenKey, setOpenKey, root = document } = {}) {
  var _a, _b, _c, _d, _e, _f, _g;
  const sitCell = () => {
    const k = getOpenKey();
    if (!k) return null;
    gp.situations[k] = gp.situations[k] || {};
    return gp.situations[k];
  };
  const sitCleanup = () => {
    const k = getOpenKey();
    if (k && gp.situations[k] && Object.keys(gp.situations[k]).length === 0) {
      delete gp.situations[k];
    }
  };
  root.querySelectorAll("[data-sitchip]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const k = chip.dataset.sitchip;
      setOpenKey(getOpenKey() === k ? null : k);
      rerender();
    });
  });
  root.querySelectorAll("[data-sit-customize]").forEach((btn) => {
    btn.addEventListener("click", () => {
      var _a2, _b2, _c2, _d2, _e2, _f2, _g2, _h;
      const field = btn.dataset.sitCustomize;
      const cell = sitCell();
      if (!cell) return;
      if (field === "offFormations") cell.offFormations = JSON.parse(JSON.stringify(normalizeFormations(gp.offFormations, gp.offFormation)));
      else if (field === "tendency") cell.tendency = gp.tendency || "Balanced";
      else if (field === "passDepth") cell.passDepth = __spreadValues({}, gp.passDepth || { short: 40, medium: 40, deep: 20 });
      else if (field === "qbRunPct") cell.qbRunPct = gp.qbRunPct || 0;
      else if (field === "tempo") cell.tempo = gp.baseTempo || "Normal";
      else if (field === "defFront") cell.defFront = gp.defBaseFront || "4-3";
      else if (field === "defAggression") cell.defAggression = aggrOf(gp);
      else if (field === "protIdentity") cell.protIdentity = gp.protIdentity || "halfSlide";
      else if (field === "runCommit") cell.runCommit = 0;
      else if (field === "coverageScheme") cell.coverageScheme = gp.coverageScheme || "balanced";
      else if (field === "optionRate") cell.optionRate = (_b2 = gp.optionRate) != null ? _b2 : 70;
      else if (field === "jetRate") cell.jetRate = (_c2 = gp.jetRate) != null ? _c2 : 15;
      else if (field === "drawRate") cell.drawRate = (_d2 = gp.drawRate) != null ? _d2 : 8;
      else if (field === "protEmphasis") cell.protEmphasis = (_e2 = gp.protEmphasis) != null ? _e2 : 50;
      else if (field === "qbAggr") cell.qbAggr = (_f2 = gp.qbAggr) != null ? _f2 : 50;
      else if (["covShell", "covStyle", "pressLevel", "edgePlay", "optionKey", "tackleStyle"].includes(field))
        cell[field] = (_g2 = gp[field]) != null ? _g2 : "balanced";
      else if (field === "subPhilosophy") cell.subPhilosophy = (_h = gp.subPhilosophy) != null ? _h : "auto";
      else if (field === "conceptWeights") cell.conceptWeights = __spreadValues({}, gp.conceptWeights || {});
      rerender();
    });
  });
  root.querySelectorAll("[data-sit-reset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cell = sitCell();
      if (!cell) return;
      delete cell[btn.dataset.sitReset];
      sitCleanup();
      rerender();
    });
  });
  root.querySelectorAll("[data-sit-makedefault]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cell = sitCell();
      if (!cell) return;
      const field = btn.dataset.sitMakedefault;
      if (cell[field] == null) return;
      if (field === "offFormations") gp.offFormations = JSON.parse(JSON.stringify(cell.offFormations));
      else if (field === "tendency") gp.tendency = cell.tendency;
      else if (field === "passDepth") gp.passDepth = __spreadValues({}, cell.passDepth);
      else if (field === "qbRunPct") gp.qbRunPct = cell.qbRunPct;
      else if (field === "tempo") gp.baseTempo = cell.tempo;
      else if (field === "defFront") {
        if (DEF_FRONTS2.includes(cell.defFront)) gp.defBaseFront = cell.defFront;
        else return;
      } else if (field === "defAggression") setAggr(gp, cell.defAggression);
      else if (field === "protIdentity") gp.protIdentity = cell.protIdentity;
      else if (field === "coverageScheme") gp.coverageScheme = cell.coverageScheme;
      else if (field === "optionRate") gp.optionRate = cell.optionRate;
      else if (field === "jetRate") gp.jetRate = cell.jetRate;
      else if (["drawRate", "protEmphasis", "qbAggr", "covShell", "covStyle", "pressLevel", "edgePlay", "optionKey", "tackleStyle", "subPhilosophy"].includes(field))
        gp[field] = cell[field];
      else if (field === "conceptWeights") gp.conceptWeights = __spreadValues({}, cell.conceptWeights);
      else return;
      delete cell[field];
      sitCleanup();
      notify("Saved as your default \u2014 AUTO situations now inherit it", "success");
      rerender();
    });
  });
  root.querySelectorAll("[data-sitside]").forEach((btn) => {
    btn.addEventListener("click", () => {
      sitSide = btn.dataset.sitside;
      rerender();
    });
  });
  root.querySelectorAll("input[data-sitcw]").forEach((sl) => {
    sl.addEventListener("input", () => {
      const cell = sitCell();
      if (!cell) return;
      if (!cell.conceptWeights) cell.conceptWeights = {};
      cell.conceptWeights[sl.dataset.sitcw] = parseInt(sl.value);
      const grp = root.querySelectorAll(`input[data-sitcwgrp="${sl.dataset.sitcwgrp}"]`);
      let tot = 0;
      grp.forEach((g) => {
        tot += parseInt(g.value) || 0;
      });
      grp.forEach((g) => {
        const w = parseInt(g.value) || 0;
        const el = root.querySelector(`.cw-val[data-sitcwval="${CSS.escape(g.dataset.sitcw)}"]`);
        if (!el) return;
        el.textContent = w === 0 ? "benched" : `\u2248${tot ? Math.round(100 * w / tot) : 0}%`;
        el.classList.toggle("cw-benched", w === 0);
      });
    });
  });
  for (const [id, field, fmt] of [["sit-drawrate", "drawRate", "%"], ["sit-prot", "protEmphasis", ""], ["sit-aggr", "qbAggr", ""]]) {
    (_a = root.querySelector("#" + id)) == null ? void 0 : _a.addEventListener("input", (e) => {
      const cell = sitCell();
      if (!cell) return;
      cell[field] = parseInt(e.target.value);
      const el = root.querySelector("#" + id + "-val");
      if (el) el.textContent = `${e.target.value}${fmt}`;
    });
  }
  root.querySelectorAll("[data-sitset-field]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cell = sitCell();
      if (!cell) return;
      cell[btn.dataset.sitsetField] = btn.dataset.sitsetVal;
      rerender();
    });
  });
  root.querySelectorAll("[data-sitfc]").forEach((card) => {
    card.addEventListener("click", () => {
      const cell = sitCell();
      if (!cell || !Array.isArray(cell.offFormations)) return;
      const fid = card.dataset.sitfc;
      const idx = cell.offFormations.findIndex((f) => f.id === fid);
      if (idx >= 0) {
        if (cell.offFormations.length > 1) cell.offFormations.splice(idx, 1);
      } else {
        if (cell.offFormations.length >= 5) cell.offFormations.pop();
        cell.offFormations.push({ id: fid, weight: 33 });
        rebalanceWeights(cell.offFormations);
      }
      rerender();
    });
  });
  root.querySelectorAll(".sitfw-slider").forEach((slider) => {
    slider.addEventListener("input", () => {
      const cell = sitCell();
      if (!cell || !Array.isArray(cell.offFormations)) return;
      const i = parseInt(slider.dataset.sitfwIndex);
      if (!cell.offFormations[i]) return;
      holdAndRebalance(cell.offFormations, i, parseInt(slider.value));
      cell.offFormations.forEach((f, j) => {
        const sl = root.querySelector(`.sitfw-slider[data-sitfw-index="${j}"]`);
        if (sl && j !== i) sl.value = f.weight;
        const pctEl = root.querySelector(`#sitfw-pct-${j}`);
        if (pctEl) pctEl.textContent = `${Math.round(f.weight)}%`;
      });
    });
  });
  (_b = root.querySelector("#sit-qbrun")) == null ? void 0 : _b.addEventListener("input", (e) => {
    const cell = sitCell();
    if (!cell) return;
    cell.qbRunPct = parseInt(e.target.value);
    const el = root.querySelector("#sit-qbrun-val");
    if (el) el.textContent = `+${e.target.value}%`;
  });
  (_c = root.querySelector("#sit-optrate")) == null ? void 0 : _c.addEventListener("input", (e) => {
    const cell = sitCell();
    if (!cell) return;
    cell.optionRate = parseInt(e.target.value);
    const el = root.querySelector("#sit-optrate-val");
    if (el) el.textContent = `${e.target.value}%`;
  });
  (_d = root.querySelector("#sit-jetrate")) == null ? void 0 : _d.addEventListener("input", (e) => {
    const cell = sitCell();
    if (!cell) return;
    cell.jetRate = parseInt(e.target.value);
    const el = root.querySelector("#sit-jetrate-val");
    if (el) el.textContent = `${e.target.value}%`;
  });
  (_f = root.querySelector("#sit-runcommit")) == null ? void 0 : _f.addEventListener("input", (e) => {
    const cell = sitCell();
    if (!cell) return;
    cell.runCommit = parseInt(e.target.value);
    const el = root.querySelector("#sit-runcommit-val");
    if (el) el.textContent = `${cell.runCommit > 0 ? "+" : ""}${cell.runCommit}`;
  });
  root.querySelectorAll(".sit-depth").forEach((sl) => {
    sl.addEventListener("input", (e) => {
      const cell = sitCell();
      if (!cell) return;
      if (!cell.passDepth) cell.passDepth = __spreadValues({}, gp.passDepth || { short: 40, medium: 40, deep: 20 });
      holdAndRebalanceDist(cell.passDepth, ["short", "medium", "deep"], sl.dataset.sitDepth, parseInt(e.target.value) || 0);
      root.querySelectorAll(".sit-depth").forEach((other) => {
        var _a2;
        const k = other.dataset.sitDepth;
        if (other !== sl) other.value = cell.passDepth[k] || 0;
        const v = (_a2 = other.parentElement) == null ? void 0 : _a2.querySelector(".run-dir-val");
        if (v) v.textContent = `${cell.passDepth[k] || 0}%`;
      });
    });
  });
  (_g = root.querySelector("#sit-reset-all")) == null ? void 0 : _g.addEventListener("click", () => {
    gp.situations = {};
    notify("All situations reset to AUTO", "success");
    rerender();
  });
}
function formatPersonnel(pkg) {
  const parts = [];
  if (pkg.RB) parts.push(`${pkg.RB} RB`);
  if (pkg.FB) parts.push(`${pkg.FB} FB`);
  if (pkg.TE) parts.push(`${pkg.TE} TE`);
  if (pkg.WR) parts.push(`${pkg.WR} WR`);
  return parts.join(" \xB7 ");
}
function normalizeFormations(offFormations, offFormation) {
  const legacyMap = {
    "Pro-Set": "Single Back",
    "Pro Set": "Single Back",
    "I-Form": "Power-I",
    "Shotgun": "Spread",
    "Trips": "Trips/Bunch",
    "ND Box": "Power-I"
  };
  const fixId = (id) => {
    const m = legacyMap[id] || id;
    // Stage 7: FORMATION_PACKAGES is the LIVE registry (custom formations
    // register into it after this module's ALL_FORMATIONS snapshot is taken)
    // — without this check a custom formation in the plan would be silently
    // rewritten to Single Back by the Game Plan screen.
    return ALL_FORMATIONS.includes(m) || FORMATION_PACKAGES[m] ? m : "Single Back";
  };
  if (Array.isArray(offFormations) && offFormations.length > 0) return offFormations.map((f) => __spreadProps(__spreadValues({}, f), { id: fixId(f.id) }));
  const validId = fixId(offFormation);
  return [
    { id: validId, weight: 50 },
    { id: "Spread", weight: 30 },
    { id: "Power-I", weight: 20 }
  ].filter((f, i, arr) => arr.findIndex((x) => x.id === f.id) === i);
}
// BUILTIN_PLANS / builtinPlan removed 2026-08-17 (owner): the five whole-game
// presets predate the offense/defense book split and are gone from every
// surface. Starter books + Workshop creations are the only shipped plans now.
function applyPlanToSchool(school, gp) {
  // Loading a plan REPLACES the plan — it must not inherit hidden settings from
  // whatever was there before. A built-in preset is PARTIAL (it only names the
  // fields it cares about), so a plain merge left leftovers behind — e.g. a +10
  // defensive box from an earlier Simple-dial choice would survive loading Air
  // Raid, which never mentions the box. Rebuild from a clean default base, then
  // apply the plan over it, and wipe the old keys (keeping engine-internal
  // _fields). A full library snapshot overrides every default, so this is
  // identical to the old behavior for those.
  const fresh = Object.assign(defaultGameplan(), JSON.parse(JSON.stringify(gp)));
  // Stage 3: a full plan load replaces BOTH books, so any Workshop source
  // identity (the update-prompt stamps) comes off with them.
  delete fresh._bookSourceId; delete fresh._bookSourceSaved;
  delete fresh._defbookSourceId; delete fresh._defbookSourceSaved;
  // D17 BATCH A: a whole-plan snapshot replaces BOTH books and the controller,
  // so it takes both verbs — off first, then def. Each recompiles from the same
  // merge, so the three parts all end up describing the plan just loaded
  // instead of being re-derived from the bag by a trailing re-synthesis.
  adoptOffPlan(school, fresh);
  adoptDefPlan(school, fresh);
}
// ── M5 (#27): the ONE starting-books applier ────────────────────────────────
// New-game's Step-0 pickers and Season Mode's setup speak the same vocabulary:
// "" = staff default · a builtin preset name · "dpb:"/"ddb:" starter books ·
// "pb:"/"dd:" Workshop creations (repaired on load, never failing silently).
// Workshop loads stamp the source identity (_bookSourceId/_bookSourceSaved and
// the def pair), so the Stage-3 update banner works for a book you started
// the run with, exactly like one loaded mid-career.
function applyStartingChoices(school, startPlan, startDef) {
  if (!school || !school.gameplan) return;
  // D17 BATCH A: the wipe-and-Object.assign idiom is retired here. Each branch
  // now stamps its markers onto the MERGE and routes it through adoptOffPlan /
  // adoptDefPlan, so the BOOK is what was loaded rather than a snapshot
  // re-derived from the bag afterwards. Field-for-field identical to the old
  // path — playbook_root_probe §10 proves both arms against each other.
  // The whole-game presets are gone (owner, 2026-08-17): startPlan is only ""
  // (team default), a starter book (dpb:), or a Workshop playbook (pb:).
  if (startPlan && startPlan.startsWith("dpb:")) {
    const book = defaultOffBook(startPlan.slice(4));
    if (book) { try { const merged = applyPlaybookToGameplan(book, school.gameplan); delete merged._bookSourceId; delete merged._bookSourceSaved; merged._bookStarter = book.name; adoptOffPlan(school, merged, { offName: book.name, source: "starter" }); } catch (e) { notify(`Couldn't apply "${book.name}" — starting with the staff's plan`, "warning"); } }
  } else if (startPlan && startPlan.startsWith("pb:")) {
    const id = startPlan.slice(3);
    const pbRaw = loadCreationData("playbooks", id);
    if (pbRaw) {
      const rep = repairCreation("playbooks", pbRaw);
      if (rep.ok) {
        try {
          const merged = applyPlaybookToGameplan(rep.data, school.gameplan);
          const entry = getCreation("playbooks", id);
          merged._bookSourceId = id; delete merged._bookStarter;
          merged._bookSourceSaved = (entry == null ? void 0 : entry.saved) || Date.now();
          adoptOffPlan(school, merged, { offName: rep.data.name || null });
          if (rep.changes.length) notify(`Playbook updated for this build: ${rep.changes[0]}`, "warning");
        } catch (e) { notify(`Couldn't apply "${pbRaw.name || "playbook"}" — starting with the staff's plan`, "warning"); }
      } else notify(`"${pbRaw.name || "Playbook"}" can't load in this build — starting with the staff's plan`, "warning");
    }
  }
  if (startDef && startDef.startsWith("ddb:")) {
    const book = defaultDefBook(startDef.slice(4));
    if (book) { try { const merged = applyDefBookToGameplan(book, school.gameplan); delete merged._defbookSourceId; delete merged._defbookSourceSaved; merged._defbookStarter = book.name; adoptDefPlan(school, merged, { defName: book.name, source: "starter" }); } catch (e) { notify(`Couldn't apply "${book.name}" — starting with the staff's defense`, "warning"); } }
  } else if (startDef && startDef.startsWith("dd:")) {
    const id = startDef.slice(3);
    const dbRaw = loadCreationData("defbooks", id);
    if (dbRaw) {
      const rep = repairCreation("defbooks", dbRaw);
      if (rep.ok) {
        try {
          const merged = applyDefBookToGameplan(rep.data, school.gameplan);
          const entry = getCreation("defbooks", id);
          merged._defbookSourceId = id; delete merged._defbookStarter;
          merged._defbookSourceSaved = (entry == null ? void 0 : entry.saved) || Date.now();
          adoptDefPlan(school, merged, { defName: rep.data.name || null });
          if (rep.changes.length) notify(`Defense updated for this build: ${rep.changes[0]}`, "warning");
        } catch (e) { notify(`Couldn't apply "${dbRaw.name || "defense"}" — starting with the staff's defense`, "warning"); }
      } else notify(`"${dbRaw.name || "Defense"}" can't load in this build — starting with the staff's defense`, "warning");
    }
  }
  try { synthesizeTeamPlan(school, { force: true }); } catch (e) {}
}
// Stage 3: the snapshot-vs-library UPDATE PROMPT. A book loaded from the
// Workshop is a SNAPSHOT; when its source creation has a newer saved stamp,
// offer a one-tap update. Overlays (dials/weights/situations/defense-when-
// updating-offense) survive by construction — the one-side appliers carry
// every field they don't govern.
function bookUpdateBanner(school) {
  if (!school) return "";
  const rows = [];
  for (const side of ["off", "def"]) {
    const bk = side === "def" ? school.defbook : school.book;
    if (!bk || !bk.sourceId) continue;
    const entry = getCreation(side === "def" ? "defbooks" : "playbooks", bk.sourceId);
    if (!entry || !((entry.saved || 0) > (bk.sourceSaved || 0))) continue;
    rows.push(`<div class="gp-book-update"><span class="gp-book-update-msg">\u{1F4D6} A newer version of \u201C${escapeHtml(entry.name)}\u201D (${side === "def" ? "defense" : "offense"}) is in your Workshop.</span><button class="btn-ghost btn-sm" data-gp-bookupdate="${side}">Update the book \u2192 <span class="muted">(your dials & situations stay)</span></button></div>`);
  }
  return rows.join("");
}
function renderPlanSlots(school) {
  var _a, _b;
  if (!school) return "";
  const q = state.quickPlans || (state.quickPlans = { active: "A", A: null, B: null, C: null });
  const lib = state._coachId ? ((_b = (_a = getCoach(state._coachId)) == null ? void 0 : _a.plans) == null ? void 0 : _b.gameplans) || [] : [];
  return `
  <div class="plan-slots-row">
    <span class="plan-slots-label">PLAN</span>
    ${["A", "B", "C"].map((s) => `
      <button class="plan-slot${q.active === s ? " active" : ""}" data-plan-slot="${s}">${s}</button>`).join("")}
    ${state._coachId ? `
      <button class="btn-ghost btn-sm" id="btn-gp-save-team" style="margin-left:auto">Save Team to Play Now</button>
      <button class="btn-ghost btn-sm" id="btn-gp-to-library">Save Plan</button>` : ""}
    <select class="form-select plan-lib-select" id="gp-lib-load"${state._coachId ? "" : ` style="margin-left:auto"`}>
      <option value="">Load a plan\u2026</option>
      ${lib.length ? `<optgroup label="My plans">
        ${lib.map((p) => `<option value="lib:${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`).join("")}
      </optgroup>` : ""}
      ${(() => { const pbs = listCreations("playbooks"); return pbs.length ? `<optgroup label="Workshop — offensive playbooks">${pbs.map((pb) => `<option value="pb:${escapeHtml(pb.id)}">${escapeHtml(pb.data.name || "Untitled")}</option>`).join("")}</optgroup>` : ""; })()}
      ${(() => { const dbs = listCreations("defbooks"); return dbs.length ? `<optgroup label="Workshop — defenses">${dbs.map((db) => `<option value="dd:${escapeHtml(db.id)}">${escapeHtml(db.data.name || "Untitled")}</option>`).join("")}</optgroup>` : ""; })()}
      <optgroup label="Starter books — offense">${DEFAULT_OFF_BOOKS.map((b) => `<option value="dpb:${escapeHtml(b.name)}">${escapeHtml(b.name)}</option>`).join("")}</optgroup>
      <optgroup label="Starter books — defense">${DEFAULT_DEF_BOOKS.map((b) => `<option value="ddb:${escapeHtml(b.name)}">${escapeHtml(b.name)}</option>`).join("")}</optgroup>
    </select>
  </div>${bookUpdateBanner(school)}`;
}
function setupListeners() {
  var _a, _b, _c, _d;
  // M5 (#39): while an embedded editor is open it OWNS the screen — wire its
  // own listeners and skip the plan wiring (none of that DOM exists).
  if (state.ui.pb && state.ui.pbContext === "career") { playbooksListeners(); return; }
  if (state.ui.def && state.ui.defContext === "career") { defListeners(); return; }
  // M5 (#39): the embedded editors' doors — Edit playbook / Edit defense on
  // the Plan Home book cards. The offense opens on playbookFromGameplan (the
  // carried book extracts losslessly: looks, per-look sheets, tendency).
  // The defense seeds from its Workshop SOURCE creation when it has one (the
  // shelves/answers a compiled gameplan can't reconstruct ride in), else from
  // the identity extract — saving an identity-only book leaves the carried
  // named calls in place (applyDefBookToGameplan only rewrites them when the
  // book carries shelves).
  document.querySelectorAll("[data-gp-editbook]").forEach((btn) => btn.addEventListener("click", () => {
    const school2 = getPlayerSchool();
    if (!school2) return;
    const gp2 = school2.gameplan;
    if (btn.dataset.gpEditbook === "off") {
      // Prefer the full STARTER book the coach opened with (re-opens the exact
      // book); playbookFromGameplan extracts losslessly for offense as the
      // fallback. 2026-08-18.
      let pb = null;
      if (gp2._bookStarter) { const b = defaultOffBook(gp2._bookStarter); if (b) pb = JSON.parse(JSON.stringify(b)); }
      if (!pb) pb = playbookFromGameplan(gp2, gp2._playbookName || `${school2.name} Offense`);
      state.ui.pb = pb;
      state.ui.pbId = null; state.ui.pbPlays = null; state.ui.pbInfo = null; state.ui.pbPreview = null;
      state.ui.pbContext = "career";
    } else {
      let db = null;
      // 1) a Workshop source creation, if the carried defense came from one.
      if (gp2._defbookSourceId) {
        const raw = loadCreationData("defbooks", gp2._defbookSourceId);
        if (raw) { const rep = repairCreation("defbooks", raw); if (rep.ok) db = rep.data; }
      }
      // 2) the STARTER book the coach picked — re-opens the WHOLE book: front mix,
      // shelves (the named calls) AND vs-personnel answers. Without this,
      // defBookFromGameplan returned an identity-only extract and the call sheet
      // came up EMPTY (owner, 2026-08-18). _defbookStarter is a dedicated marker
      // ai.js never clobbers (unlike _defbookName).
      if (!db && gp2._defbookStarter) { const b = defaultDefBook(gp2._defbookStarter); if (b) db = JSON.parse(JSON.stringify(b)); }
      // 3) last resort: the identity extract (fronts/scheme only, no calls).
      if (!db) db = defBookFromGameplan(gp2, gp2._defbookName || `${school2.name} Defense`);
      state.ui.def = { ...emptyDefBook(db.name), ...db, frontMix: { ...(db.frontMix || {}) }, pressureSource: { ...(db.pressureSource || {}) }, shelves: JSON.parse(JSON.stringify(db.shelves || {})), answers: { ...(db.answers || {}) } };
      state.ui.defId = null; state.ui.defCard = null;
      state.ui.defContext = "career";
    }
    rerender();
  }));
  // M5 (#3): expand/collapse the look diagrams on the usage card.
  document.querySelectorAll("[data-gp-lookart]").forEach((btn) => btn.addEventListener("click", () => {
    state.ui.gpLookArt = !state.ui.gpLookArt;
    rerender();
  }));
  document.querySelectorAll("[data-plan-slot]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const school2 = getPlayerSchool();
      if (!school2) return;
      const q = state.quickPlans || (state.quickPlans = { active: "A", A: null, B: null, C: null });
      const target = btn.dataset.planSlot;
      if (target === q.active) return;
      q[q.active] = JSON.parse(JSON.stringify(school2.gameplan));
      if (q[target]) Object.assign(school2.gameplan, JSON.parse(JSON.stringify(q[target])));
      q.active = target;
      notify(`Game plan ${target} active`, "success");
      rerender();
    });
  });
  (_a = document.getElementById("btn-gp-save-team")) == null ? void 0 : _a.addEventListener("click", () => {
    const school2 = getPlayerSchool();
    if (!school2 || !state._coachId) return;
    const defaultName = `${school2.name} \xB7 Season ${state.season || 1}`;
    const name = prompt("Name this saved team for Play Now:", defaultName);
    if (!name) return;
    const ok = saveTeamToLibrary(state._coachId, name, school2, { season: state.season, record: school2.record });
    notify(ok ? `"${name}" is ready in Play Now` : "Saved team library is full (8 teams max)", ok ? "success" : "warning");
    rerender();
  });
  (_b = document.getElementById("btn-gp-to-library")) == null ? void 0 : _b.addEventListener("click", () => {
    const school2 = getPlayerSchool();
    const name = prompt("Name this game plan for your coach library:", "My System");
    if (!name || !school2) return;
    // Stage 3: "Save plan" saves the CONTROLLER — dials, concept weights,
    // target shares, situations, team knobs — not a frozen copy of the book.
    // A saved plan now loads onto ANY book (and no longer drags one career's
    // roster-bound field assignments into the library).
    const ok = saveGameplanToLibrary(state._coachId, name, controllerOverlayOf(school2.gameplan), { overlayOnly: true });
    notify(ok ? `"${name}" saved — your dials, weights & situations (loads onto any book)` : "Library is full (10 plans max)", ok ? "success" : "warning");
    rerender();
  });
  (_c = document.getElementById("gp-lib-load")) == null ? void 0 : _c.addEventListener("change", (e) => {
    var _a2, _b2;
    const school2 = getPlayerSchool();
    const raw = e.target.value;
    if (!raw || !school2) return;
    const sep = raw.indexOf(":");
    const kind = sep >= 0 ? raw.slice(0, sep) : "lib";
    const planName = sep >= 0 ? raw.slice(sep + 1) : raw;
    // The "builtin:" preset load path is gone (owner, 2026-08-17).
    // Starter books (defaultbooks.js): same one-side swap as Workshop loads.
    if (kind === "dpb" || kind === "ddb") {
      const book = kind === "dpb" ? defaultOffBook(planName) : defaultDefBook(planName);
      if (!book) return;
      try {
        const merged = kind === "dpb" ? applyPlaybookToGameplan(book, school2.gameplan) : applyDefBookToGameplan(book, school2.gameplan);
        // D12 (OD-11): the def-book compile already prunes, but a load is also
        // the healing moment for a sheet an OLD save left stale — idempotent.
        // D17: pruned on the MERGE, before the split, so the pruned sheet is
        // what lands in the book rather than only in the compiled output.
        pruneCallSheet(merged);
        // Stage 3: a starter book replaces this side — its Workshop identity
        // (if any) comes off, and the STARTER marker goes on so "Edit book"
        // re-opens the whole starter (shelves+answers included, 2026-08-18).
        if (kind === "dpb") { delete merged._bookSourceId; delete merged._bookSourceSaved; merged._bookStarter = book.name; }
        else { delete merged._defbookSourceId; delete merged._defbookSourceSaved; merged._defbookStarter = book.name; }
        // D17 BATCH A: the book becomes the truth (was wipe-and-assign + a
        // trailing re-synthesis that re-derived the book FROM the bag).
        if (kind === "dpb") adoptOffPlan(school2, merged, { offName: book.name, source: "starter" });
        else adoptDefPlan(school2, merged, { defName: book.name, source: "starter" });
        notify(`"${book.name}" ${kind === "dpb" ? "offense" : "defense"} loaded`, "success");
      } catch (err) { notify("Could not load that book", "warning"); }
      rerender();
      return;
    }
    // Workshop creations: a playbook swaps only the OFFENSE, a defense swaps only
    // the DEFENSE (the engine functions carry through the fields they don't
    // govern), so you can mix a custom offense and a custom defense freely.
    if (kind === "pb" || kind === "dd") {
      const shelf = kind === "pb" ? "playbooks" : "defbooks";
      const raw2 = loadCreationData(shelf, planName);
      if (!raw2) return;
      // Repair-on-load: a book authored against an older build may name a
      // formation/front/concept that has since changed — clean it against
      // CURRENT data and say what changed, instead of failing with a shrug.
      const rep = repairCreation(shelf, raw2);
      if (!rep.ok) { notify(`"${raw2.name || "Creation"}" can't load in this build — open it in the Workshop to rebuild it`, "warning"); return; }
      const data = rep.data;
      try {
        const merged = kind === "pb" ? applyPlaybookToGameplan(data, school2.gameplan) : applyDefBookToGameplan(data, school2.gameplan);
        // D12 (OD-11): see the starter branch above — heal-on-load, idempotent.
        // D17: on the MERGE, before the split (see the starter branch).
        pruneCallSheet(merged);
        // Stage 3: stamp the book's Workshop identity (creation id + saved
        // time) so the Game Plan can offer "a newer version exists" later.
        // The stamps are gameplan _fields — they survive wipes + re-synthesis
        // (teamplan.js copies them onto the book objects).
        {
          const _entry = getCreation(shelf, planName);
          if (kind === "pb") {
            merged._bookSourceId = planName; delete merged._bookStarter;
            merged._bookSourceSaved = (_entry == null ? void 0 : _entry.saved) || Date.now();
          } else {
            merged._defbookSourceId = planName; delete merged._defbookStarter;
            merged._defbookSourceSaved = (_entry == null ? void 0 : _entry.saved) || Date.now();
          }
        }
        // D17 BATCH A: the loaded creation IS the book.
        if (kind === "pb") adoptOffPlan(school2, merged, { offName: data.name || null });
        else adoptDefPlan(school2, merged, { defName: data.name || null });
        notify(`"${data.name || "Creation"}" ${kind === "pb" ? "offense" : "defense"} loaded`, "success");
        if (rep.changes.length) notify(`Updated for this build: ${rep.changes[0]}${rep.changes.length > 1 ? ` (+${rep.changes.length - 1} more)` : ""}`, "warning");
      } catch (err) { notify("Could not load that creation", "warning"); }
      rerender();
      return;
    }
    const p = (((_b2 = (_a2 = getCoach(state._coachId)) == null ? void 0 : _a2.plans) == null ? void 0 : _b2.gameplans) || []).find((x) => x.name === planName);
    if (!p) return;
    if (p.overlayOnly) {
      // Stage 3: a controller save loads ONTO the book you carry — the looks,
      // sheets and defensive identity stay; dials/weights/situations apply.
      const merged = applyControllerOverlay(school2.gameplan, p.gp, defaultGameplan());
      // D17 BATCH A: a controller save loads ONTO the books you carry, so this
      // is the overlay verb by definition — the books are left alone and the
      // dials/weights/situations land on the controller.
      adoptOffPlan(school2, merged);
      notify(`"${p.name}" loaded onto your current book`, "success");
    } else {
      applyPlanToSchool(school2, p.gp);
      notify(`"${p.name}" loaded from library`, "success");
    }
    rerender();
  });
  // Stage 3: one-tap book update from the Workshop source (see bookUpdateBanner).
  document.querySelectorAll("[data-gp-bookupdate]").forEach((b) => b.addEventListener("click", () => {
    const school2 = getPlayerSchool();
    if (!school2) return;
    const side = b.dataset.gpBookupdate;
    const bk = side === "def" ? school2.defbook : school2.book;
    if (!bk || !bk.sourceId) return;
    const shelf = side === "def" ? "defbooks" : "playbooks";
    const entry = getCreation(shelf, bk.sourceId);
    if (!entry) return;
    const rep = repairCreation(shelf, JSON.parse(JSON.stringify(entry.data)));
    if (!rep.ok) { notify(`"${entry.name}" can't load in this build — open it in the Workshop to rebuild it`, "warning"); return; }
    try {
      const merged = side === "def" ? applyDefBookToGameplan(rep.data, school2.gameplan) : applyPlaybookToGameplan(rep.data, school2.gameplan);
      if (side === "def") merged._defbookSourceSaved = entry.saved || Date.now();
      else merged._bookSourceSaved = entry.saved || Date.now();
      // D17 BATCH A: the updated creation IS the book from here on.
      if (side === "def") adoptDefPlan(school2, merged, { defName: rep.data.name || null });
      else adoptOffPlan(school2, merged, { offName: rep.data.name || null });
      notify(`\u{1F4D6} "${entry.name}" updated — your dials and situations carried over`, "success");
      if (rep.changes.length) notify(`Updated for this build: ${rep.changes[0]}${rep.changes.length > 1 ? ` (+${rep.changes.length - 1} more)` : ""}`, "warning");
    } catch (err) { notify("Could not update the book", "warning"); }
    rerender();
  }));
  const school = getPlayerSchool();
  if (!school) return;
  // ╔═══════════════════════════════════════════════════════════════════════╗
  // ║ ⚠ TRANSITIONAL BRIDGE — DELETE IN THE FINAL D17 BATCH-C COMMIT.       ║
  // ╚═══════════════════════════════════════════════════════════════════════╝
  // Batch C converts this screen's ~55 plan writers to the parts, in reviewable
  // pieces. A PARTIAL conversion is unsafe without this line, and the failure is
  // silent: a converted writer recompiles the plan FROM the parts, which discards
  // anything an unconverted writer had poked onto the flat bag. Proven — set
  // tendency the old way, then move any converted dial, and the tendency reverts.
  //
  // Re-splitting here closes the window: whatever a legacy writer scribbled is
  // captured into the parts before the next converted write recompiles. It is a
  // no-op for converted writers (they already keep parts and plan in agreement,
  // so the re-split returns identical parts).
  //
  // This IS the gameplan→book inversion, kept alive deliberately and briefly as
  // scaffolding for the thing that removes it. When the last writer on this
  // screen routes through setPlanField/setPlanFields/setOverlay, DELETE IT — and
  // if you are reading this after Batch C closed, it was forgotten: delete it.
  try { synthesizeTeamPlan(school, { force: true }); } catch (e) {}
  const gp = school.gameplan;
  document.querySelectorAll("[data-gpsection]").forEach((btn) => {
    btn.addEventListener("click", () => {
      gameplanSection = btn.dataset.gpsection;
      rerender();
    });
  });
  document.querySelectorAll("[data-simpledial]").forEach((btn) => {
    btn.addEventListener("click", () => {
      applySimpleDial(gp, btn.dataset.simpledial, btn.dataset.simpleval);
      rerender();
    });
  });
  document.querySelectorAll("[data-simplesit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      applySimpleSit(gp, btn.dataset.simplesit, btn.dataset.sitlever, btn.dataset.sitval);
      rerender();
    });
  });
  gp.offFormations = normalizeFormations(gp.offFormations, gp.offFormation);
  if (!gp.situations) gp.situations = {};
  const root = document.getElementById("view-root") || document;
  wireSituationListeners(gp, {
    getOpenKey: () => openSitKey,
    setOpenKey: (k) => {
      openSitKey = k;
    },
    root
  });
  wireDefaultsListeners(gp, { root });
  if (!gp.defAggression) setAggr(gp, aggrStopFromBlitzPct(gp.blitzPct));
  if (!gp.protIdentity) gp.protIdentity = "halfSlide";
  if (!gp.targetShares) gp.targetShares = { WR1: 22, WR2: 20, WR3: 16, TE1: 20, RB1: 14 };
  if (!gp.coverageScheme) gp.coverageScheme = "balanced";
  (_d = document.getElementById("max-fg")) == null ? void 0 : _d.addEventListener("input", (e) => {
    gp.maxFGDist = parseInt(e.target.value);
    document.getElementById("max-fg-val").textContent = `${e.target.value} yds`;
  });
  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", () => {
      import('../../state.js').then((m) => m.navigate(el.dataset.nav));
    });
  });
}
function rebalanceWeights(formations) {
  const total = formations.reduce((s, f) => s + f.weight, 0);
  if (total <= 0) {
    formations.forEach((f) => {
      f.weight = Math.round(100 / formations.length);
    });
  } else formations.forEach((f) => {
    f.weight = Math.round(f.weight / total * 100);
  });
  const drift = 100 - formations.reduce((s, f) => s + f.weight, 0);
  if (drift !== 0 && formations.length) {
    const largest = formations.reduce((a, b) => b.weight > a.weight ? b : a, formations[0]);
    largest.weight += drift;
  }
}
function conceptHint(name, c) {
  if (c.vs) {
    const es = Object.entries(c.vs).sort((a, b) => b[1] - a[1]);
    return `beats ${es[0][0]} \xB7 dies vs ${es[es.length - 1][0]}`;
  }
  const bits = [];
  if (c.vsBox) bits.push(`best vs ${c.vsBox.loaded > c.vsBox.light ? "loaded" : "light"} boxes`);
  if (c.pulls) bits.push("pulls a guard");
  if (c.punishes === "crash") bits.push("eats crash edges");
  return bits.join(" \xB7 ");
}
// Madden pass 2 (Aug 2026): the per-formation playbook editor. Each carried
// formation can author its own sheet — a weight set that OVERLAYS the global
// playbook concept-by-concept for snaps run from that formation. Untouched
// concepts inherit the global weight (the pill shows which is which); an empty
// sheet means the formation just runs the global book, exactly as before.
function renderFormationPlaybook(gp, key) {
  var _a;
  // `key` is a LOOK key — "fid" or "fid|variation". Reworked 2026-08-18 (owner):
  // the inherit-base / fork model is GONE from this screen. A starting book is
  // always applied, so every look already owns its full sheet — there is no
  // "unset / inherits the base" state to explain, and the per-play "set here /
  // from base sheet" pills that marked it were always-on clutter. Now it's just:
  // this look's plays, weight the mix, bench with 0, reset to the book's mix.
  const { id: fid, variation: vk } = splitSheetKey(key);
  const vset = FORMATION_VARIATIONS[fid];
  const lookLabel = vk ? `${fid} ${(vset && vset[vk] && vset[vk].label) || vk}` : fid;
  const carry = FORMATION_PLAYBOOK[fid] || [];
  const global = gp.conceptWeights || {};
  const own = ((_a = gp.formationPlaybooks) == null ? void 0 : _a[key]) || {};
  const effW = (nm) => { const v = own[nm] != null ? own[nm] : global[nm]; return v != null ? v : 50; };
  const onN = carry.filter((nm) => effW(nm) > 0).length;
  const groups = [
    ["QUICK GAME", Object.entries(PASS_CONCEPTS).filter(([nm, c]) => c.depth === "short" && carry.includes(nm))],
    ["DROPBACK", Object.entries(PASS_CONCEPTS).filter(([nm, c]) => c.depth === "medium" && carry.includes(nm))],
    ["SHOT PLAYS", Object.entries(PASS_CONCEPTS).filter(([nm, c]) => c.depth === "deep" && carry.includes(nm))],
    ["INSIDE RUN GAME", Object.entries(RUN_CONCEPTS).filter(([nm, c]) => c.type === "run_inside" && carry.includes(nm))],
    ["PERIMETER RUN GAME", Object.entries(RUN_CONCEPTS).filter(([nm, c]) => c.type === "run_outside" && carry.includes(nm))]
  ].filter(([, list]) => list.length);
  return `
  <div class="cw-explain"><b>${escapeHtml(lookLabel)}'s call sheet</b> — ${onN} of ${carry.length} plays live. Slide to weight the mix; drop a play to <b>bench</b> it (0 = never called out of this look). Reset returns this look to the book's mix.</div>
  <div class="gp-row"><button class="gp-option gp-option-sm" id="fpb-reset" data-fpbform="${escapeHtml(key)}">Reset ${escapeHtml(lookLabel)} to the book's mix</button></div>
  ${groups.map(([title, list], gi) => {
    const gTot = list.reduce((t, [nm]) => t + effW(nm), 0) || 1;
    return `
    <div class="cw-group">
      <div class="cw-group-hdr">${title}</div>
      ${list.map(([name, c]) => {
        const w = effW(name);
        const shr = Math.round(100 * w / gTot);
        return `
        <div class="cw-row">
          <div class="cw-name">${escapeHtml(name)} <span class="cw-hint">${conceptHint(name, c)}</span></div>
          <div class="gp-slider-wrap">
            <span class="gp-slider-lo">bench</span>
            <input class="gp-slider" type="range" min="0" max="100" step="5" value="${w}" data-fpb="${escapeHtml(name)}" data-fpbform="${escapeHtml(key)}" data-fpbgrp="${gi}" />
            <span class="gp-slider-hi">feature</span>
            <span class="gp-slider-val cw-val${w === 0 ? " cw-benched" : ""}" data-fpbval="${escapeHtml(name)}">${w === 0 ? "benched" : `\u2248${shr}%`}</span>
          </div>
        </div>`;
      }).join("")}
    </div>`;
  }).join("")}
`;
}
function renderPlaybookGroups(gp, opts = null) {
  var _a;
  const cw = (_a = opts == null ? void 0 : opts.cw) != null ? _a : gp.conceptWeights || {};
  const attr = (opts == null ? void 0 : opts.attr) || "cw";
  const groups = [
    ["QUICK GAME", "short passes", Object.entries(PASS_CONCEPTS).filter(([, c]) => c.depth === "short")],
    ["DROPBACK", "medium passes", Object.entries(PASS_CONCEPTS).filter(([, c]) => c.depth === "medium")],
    ["SHOT PLAYS", "deep passes", Object.entries(PASS_CONCEPTS).filter(([, c]) => c.depth === "deep")],
    ["INSIDE RUN GAME", "", Object.entries(RUN_CONCEPTS).filter(([, c]) => c.type === "run_inside")],
    ["PERIMETER RUN GAME", "", Object.entries(RUN_CONCEPTS).filter(([, c]) => c.type === "run_outside")]
  ];
  // Which formations does the coach actually carry? A concept only lives in
  // the formations that run it — if the package drops all of them, the play is
  // off the sheet no matter what its slider says. Surface that here instead of
  // letting it read as a mystery on game day.
  const carriedForms = ((gp == null ? void 0 : gp.offFormations) || []).filter((f) => f && f.id && (f.weight || 0) > 0).map((f) => f.id);
  const offSheet = (name) => {
    if (!carriedForms.length) return false;
    return !carriedForms.some((fid) => (FORMATION_PLAYBOOK[fid] || []).includes(name));
  };
  return `
  ${opts ? "" : `<div class="gp-row"><button class="gp-option gp-option-sm" id="cw-reset">Reset to an even call sheet</button></div>
  <div class="cw-explain">Weights set the mix inside each group — and <b>0 is a cut, not a low number</b>: a benched
  play is out of the game plan and will never be called; the sheet re-balances around what's left. A play also only
  lives in the formations that carry it — drop every formation that runs it from your package and it comes off the
  sheet no matter where the slider sits.</div>`}
  ${groups.map(([title, subT, list], gi) => {
    const gTot = list.reduce((s, [n]) => {
      var _a2;
      return s + ((_a2 = cw[n]) != null ? _a2 : 50);
    }, 0) || 1;
    return `
    <div class="cw-group">
      <div class="cw-group-hdr">${title}${subT ? ` <span class="gp-hint">(${subT})</span>` : ""}</div>
      ${list.map(([name, c]) => {
      var _a2;
      const w = (_a2 = cw[name]) != null ? _a2 : 50;
      const shr = Math.round(100 * w / gTot);
      const _noForm = !opts && offSheet(name);
      return `
        <div class="cw-row">
          <div class="cw-name">${escapeHtml(name)}${_noForm ? ` <span class="cw-offsheet" title="None of your carried formations run this play — it can't be called until one does.">off the sheet — no formation carries it</span>` : ""} <span class="cw-hint">${conceptHint(name, c)}</span></div>
          <div class="gp-slider-wrap">
            <span class="gp-slider-lo">bench</span>
            <input class="gp-slider" type="range" min="0" max="100" step="5" value="${w}" data-${attr}="${escapeHtml(name)}" data-${attr}grp="${gi}" />
            <span class="gp-slider-hi">feature</span>
            <span class="gp-slider-val cw-val${w === 0 ? " cw-benched" : ""}" data-${attr}val="${escapeHtml(name)}">${w === 0 ? "benched" : `\u2248${shr}%`}</span>
          </div>
        </div>`;
    }).join("")}
    </div>`;
  }).join("")}
`;
}
var gameplanSection, offSubTab, pbFormTab, defSubTab, sitSide, openSitKey, callSheetSit, callSheetPers, callEditName, SIT_DESCS, SIT_NUDGE, SIT_TIPS, PIN_FRONTS, COV_OPTIONS, ALL_FORMATIONS, DEF_FRONTS2, DEF_FRONT_DESCS, DEF_FRONT_NEEDS, SIMPLE_DIALS, SIMPLE_SITS;

gameplanSection = "home";
offSubTab = "package";
pbFormTab = null;
defSubTab = "front";
sitSide = "offense";
openSitKey = null;
// PASS 2: Calls tab UI state — which sheet cell is on screen, which call
// card is expanded for editing.
callSheetSit = "base";
callSheetPers = "any";
callEditName = null;
SIT_DESCS = {
  openers: "Your scripted first two drives of the game",
  goal_line: "Ball inside the 5 \u2014 score or stop",
  backed_up: "Ball inside the offense's own 5",
  two_min_trail: "Under 5:00 in the half, down 11+",
  four_min_lead: "Under 5:00 in the half, up 11+",
  red_zone: "Ball inside the 20",
  third_short: "3rd or 4th down, 2 or less",
  third_medium: "3rd or 4th down, 3\u20136 to go",
  third_long: "3rd or 4th down, 7+ to go",
  second_long: "2nd down, 8+ to go",
  first_ten: "Every 1st down",
  base: "Everything else (2nd & short/medium)"
};
SIT_NUDGE = {
  third_long: "throws here more than it normally would",
  third_short: "leans on the run here",
  two_min_trail: "opens it up here",
  four_min_lead: "milks the clock here"
};
SIT_TIPS = {
  openers: "\u25B8 The opening script: coaches script the first drives to probe the defense and bank tendency capital before the chess match starts. This cell owns every ordinary snap of your first TWO drives, then hands the game back to the normal sheet. Goal line, backed up, the clock cells and the red zone still take over \u2014 nobody stays on the script at the goal line. Offense only; leave it AUTO and it never fires.",
  goal_line: "\u25B8 Governs every snap inside the 5 for BOTH sides of your plan \u2014 punching it in on offense, and goal-line defense when they're knocking. A Power-I pin with a QB-keep dial is the classic offensive build; 46/Bear + run commit the defensive one.",
  backed_up: "\u25B8 Offense: pinned at your own goal line \u2014 safe calls protect against the safety. Defense: you have THEM pinned \u2014 this cell is your chance to hunt a safety or a short field.",
  two_min_trail: "\u25B8 Desperation time. AUTO already airs it out; take over to pin your best passing package and shift depth toward deep shots.",
  four_min_lead: "\u25B8 Salt the game away. AUTO leans run; take over to go full Heavy Run out of Power-I and drain the half.",
  red_zone: "\u25B8 The field shrinks \u2014 deep routes die inside the 20. This cell rules the whole red zone, including 3rd downs; a short-depth, run-lean plan is the conventional build.",
  third_short: "\u25B8 AUTO leans on the run here (this cell also covers 4th-and-short goes). The defense knows it too \u2014 46/Bear fronts and stacked boxes live on this down.",
  third_medium: "\u25B8 The true coin-flip down. No AUTO adjustment \u2014 whatever edge you build here is pure scheme.",
  third_long: "\u25B8 AUTO already treats this as a passing down. Take over to pin a package \u2014 but remember the defense knows it's a passing down too.",
  second_long: "\u25B8 After a 1st-down stuff. Screens and draws punish a defense teeing off; going conservative concedes 3rd & long.",
  first_ten: "\u25B8 The identity down \u2014 most snaps in a game start here. Changing this cell reshapes your whole offense more than any other.",
  base: "\u25B8 The fallback for anything no other situation claims (mostly 2nd & short/medium)."
};
PIN_FRONTS = ["4-3", "3-4", "Tite", "Nickel", "Big Nickel", "3-3-5", "Penny", "Dime", "4-4", "46/Bear", "5-2"];
COV_OPTIONS = [["balanced", "Balanced"], ["lockTop", "Lock WR1"], ["bracketTop", "Bracket WR1"]];
ALL_FORMATIONS = Object.keys(FORMATIONS);
DEF_FRONTS2 = ["4-3", "3-4", "Tite", "Nickel", "Big Nickel", "3-3-5", "4-4"];
DEF_FRONT_DESCS = {
  "4-3": "4 DL \xB7 3 LB \xB7 4 DB \u2014 the balanced base; auto-subs to nickel/dime on passing downs and heavy fronts in short yardage",
  "3-4": "3 DL \xB7 4 LB \xB7 4 DB \u2014 an extra linebacker for a lineman: versatile, easy to disguise the blitz, subs by situation",
  "Nickel": "4 DL \xB7 2 LB \xB7 5 DB \u2014 a fifth defensive back in for a linebacker: the spread-first base, subs heavier against power",
  "3-3-5": "3 DL \xB7 3 LB \xB7 5 DB \u2014 five defensive backs behind stacked linebackers: built to disguise where the pressure comes from",
  "Tite": "3 DL \xB7 4 LB \xB7 4 DB \u2014 the three linemen clog the inside gaps by alignment so the linebackers can run free to the ball",
  "4-4": "4 DL \xB7 4 LB \xB7 3 DB \u2014 eight in the box: a heavy run front with a single safety deep",
  "Big Nickel": "4 DL \xB7 2 LB \xB7 5 DB \u2014 nickel with a third safety instead of a slot corner: bigger, better against tight ends",
  "Penny": "5 on the line \xB7 1 LB \xB7 5 DB \u2014 a light, spread-out front built to match spread-run teams"
};
DEF_FRONT_NEEDS = {
  "4-3": "Wants penetrating tackles, pass-rushing ends, a downhill middle linebacker and rangy cover linebackers.",
  "3-4": "Wants a big two-way nose tackle, edge-rushing outside linebackers and downhill inside linebackers.",
  "Nickel": "Wants a quick nickel corner who can tackle, rangy cover linebackers and speed off the edge.",
  "3-3-5": "Wants a big nose tackle, hybrid run-and-cover linebackers and a third safety who tackles like a linebacker.",
  "Tite": "Wants big two-way ends, a stout nose tackle and rangy stand-up linebackers on the edge.",
  "4-4": "Wants downhill bodies at all four linebacker spots and one truly rangy deep safety.",
  "Big Nickel": "Wants a hybrid safety who can cover tight ends and tackle like a linebacker.",
  "Penny": "Wants two stand-up edge rushers, a stout nose tackle and a sideline-to-sideline middle linebacker."
};
SIMPLE_DIALS = [
  {
    key: "simpleOffId",
    label: "Offensive Identity",
    lo: "Run-heavy",
    hi: "Pass-heavy",
    opts: [["run", "Run-heavy"], ["balanced", "Balanced"], ["pass", "Pass-heavy"]],
    tip: "How you want to move the ball. Run-heavy leans on the ground and sells play-action; pass-heavy airs it out."
  },
  {
    key: "simpleOffAggr",
    label: "Offensive Aggression",
    lo: "Play it safe",
    hi: "Aggressive",
    opts: [["safe", "Play it safe"], ["balanced", "Balanced"], ["aggr", "Aggressive"]],
    tip: "Protect the ball and take what's there, or push the ball downfield and go for it on 4th."
  },
  {
    key: "simpleDefPosture",
    label: "Defensive Posture",
    lo: "Bend, don't break",
    hi: "Attack",
    opts: [["bend", "Bend, don't break"], ["balanced", "Balanced"], ["attack", "Attack"]],
    tip: "Sit back and keep everything in front of you, or bring pressure and press up to force mistakes."
  },
  {
    key: "simpleTempo",
    label: "Tempo",
    lo: "Ball control",
    hi: "Fast",
    opts: [["slow", "Ball control"], ["normal", "Normal"], ["fast", "Fast"]],
    tip: "Milk the clock and shorten the game, or play fast and run more plays."
  }
];
SIMPLE_SITS = [
  { key: "third", label: "3rd Down", cells: ["third_short", "third_medium", "third_long"] },
  { key: "red_zone", label: "Red Zone", cells: ["red_zone"] },
  { key: "two_min_trail", label: "When Trailing Late", cells: ["two_min_trail"] },
  { key: "four_min_lead", label: "When Leading Late", cells: ["four_min_lead"] }
];

export { applyPlanToSchool, applyStartingChoices, gameplanIsSimple, renderGameplan, renderHalftimeAdjust, renderSituationsSection, setupListeners, wireDefaultsListeners, wireSituationListeners };
