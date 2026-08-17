import { C } from '../../constants.js';
import { setAIGameplan } from '../../engine/ai.js';
import { synthesizeTeamPlan } from '../../engine/teamplan.js';
import { deleteSavedTeam, instantiateSavedTeam, listSavedTeams } from '../../engine/coachprofile.js';
import { listCreations, loadCreationData } from '../../engine/creator.js';
import { ensureFieldAssignments } from '../../engine/fieldassign.js';
import { generateExhibitionTeam, applyTeamStars } from '../../engine/world.js';
import { endExhibition, navigate, rerender, startExhibition } from '../../state.js';
import { escapeHtml, renderCrest } from '../../utils.js';

var DIVS = ["D1", "D2", "D3"];
var capOf = (div) => {
  var _a;
  return ((_a = C.PRESTIGE_MAX) == null ? void 0 : _a[div]) || 5;
};
var cloneJson3 = (value) => JSON.parse(JSON.stringify(value));
var pn = {
  cfg: { home: { div: "D1", prestige: 4 }, away: { div: "D1", prestige: 4 } },
  mode: "coach",
  // legacy name for Team 1; also supports away | both | watch
  source: { home: "", away: "" },
  home: null,
  away: null
};
function makeTeam(side) {
  const { div, prestige } = pn.cfg[side];
  const school = generateExhibitionTeam(div, prestige);
  try {
    setAIGameplan(school);
  } catch (e) {
  }
  try {
    synthesizeTeamPlan(school, { force: true });
  } catch (e) {
  }
  try {
    ensureFieldAssignments(school.gameplan);
  } catch (e) {
  }
  return school;
}
function ensureTeams() {
  if (!pn.home) pn.home = makeTeam("home");
  if (!pn.away) pn.away = makeTeam("away");
}
// Build a playable team from a Team Editor creation (identity only): generate a
// roster at its division/prestige, then stamp the custom identity (name, mascot,
// colors, crest) over it so your created team takes the field.
function makeCreatorTeam(id, side) {
  const c = loadCreationData("teams", id);
  if (!c) return null;
  const div = c.division || "D1";
  const prestige = c.prestige != null ? c.prestige : 3;
  pn.cfg[side].div = div;
  pn.cfg[side].prestige = prestige;
  const school = generateExhibitionTeam(div, prestige);
  if (c.name) school.name = c.name;
  if (c.nick) school.nick = c.nick;
  if (Array.isArray(c.colors) && c.colors.length === 2) school.colors = c.colors;
  if (c.state) school.state = c.state;
  if (c.crestText) school.crestText = c.crestText;
  if (c.crestSeed) school.crestSeed = c.crestSeed;
  if (Array.isArray(c.stars) && c.stars.length) { try { applyTeamStars(school, c.stars); } catch (e) {} }
  school._creatorTeam = true;
  try { setAIGameplan(school); } catch (e) {}
  try { synthesizeTeamPlan(school, { force: true }); } catch (e) {}
  try { ensureFieldAssignments(school.gameplan); } catch (e) {}
  return school;
}
function savedKey(team) {
  return `${team.coachId}|${team.id}`;
}
function savedByKey(key) {
  return listSavedTeams().find((team) => savedKey(team) === key) || null;
}
function teamOvr(school) {
  const top = (school.roster || []).map((p) => p.compositeRating).sort((a, b) => b - a).slice(0, 22);
  return top.length ? Math.round(top.reduce((sum, value) => sum + value, 0) / top.length) : 0;
}
function bestAt(school, positions) {
  return (school.roster || []).filter((p) => positions.includes(p.position)).sort((a, b) => b.compositeRating - a.compositeRating)[0] || null;
}
function starRow(side) {
  const { div, prestige } = pn.cfg[side];
  const cap = capOf(div);
  let html = "";
  for (let i = 1; i <= cap; i++) {
    html += `<button class="pn-star${i <= prestige ? " on" : ""}" data-pn-star="${side}:${i}" aria-label="${i} star">${i <= prestige ? "\u2605" : "\u2606"}</button>`;
  }
  return html;
}
function sideLabel(side) {
  if (pn.mode === "both" || pn.mode === "watch") return side === "home" ? "TEAM 1" : "TEAM 2";
  if (pn.mode === "away") return side === "away" ? "YOUR TEAM \xB7 TEAM 2" : "OPPONENT \xB7 TEAM 1";
  return side === "home" ? "YOUR TEAM \xB7 TEAM 1" : "OPPONENT \xB7 TEAM 2";
}
function sourcePicker(side) {
  const saved = listSavedTeams();
  const custom = listCreations("teams");
  return `<label class="pn-source-label" for="pn-source-${side}">TEAM SOURCE</label>
  <select class="form-select pn-source" id="pn-source-${side}" data-pn-source="${side}">
    <option value=""${pn.source[side] ? "" : " selected"}>Generate a new team</option>
    ${custom.length ? `<optgroup label="Your custom teams">${custom.map((t) => `<option value="creator:${escapeHtml(t.id)}"${pn.source[side] === "creator:" + t.id ? " selected" : ""}>${escapeHtml(t.data.name)} \u2014 ${escapeHtml(t.data.division || "D1")}</option>`).join("")}</optgroup>` : ""}
    ${saved.length ? `<optgroup label="Saved dynasty teams">${saved.map((team) => {
    const key = savedKey(team);
    return `<option value="${escapeHtml(key)}"${pn.source[side] === key ? " selected" : ""}>${escapeHtml(team.name)} \u2014 ${escapeHtml(team.coachName)}</option>`;
  }).join("")}</optgroup>` : ""}
  </select>`;
}
function teamPanel(side, school) {
  var _a, _b;
  const generated = !pn.source[side];
  const saved = generated ? null : savedByKey(pn.source[side]);
  const { div } = pn.cfg[side];
  const qb = bestAt(school, ["QB"]);
  const star = (school.roster || []).slice().sort((a, b) => b.compositeRating - a.compositeRating)[0];
  const pname = (p) => p ? `${p.name.first[0]}. ${p.name.last}` : "\u2014";
  return `
  <div class="pn-panel">
    <div class="pn-side-label">${sideLabel(side)}</div>
    ${sourcePicker(side)}
    ${generated ? `
      <div class="pn-seg">
        ${DIVS.map((d) => `<button class="pn-seg-btn${div === d ? " active" : ""}" data-pn-div="${side}:${d}">${d}</button>`).join("")}
      </div>
      <div class="pn-stars">${starRow(side)}<span class="pn-star-hint">prestige \u2014 roster strength</span></div>` : (pn.source[side] || "").startsWith("creator:") ? `<div class="pn-saved-meta">CUSTOM TEAM \xB7 ${div}</div>` : `<div class="pn-saved-meta">SAVED SNAPSHOT${(saved == null ? void 0 : saved.season) ? ` \xB7 SEASON ${saved.season}` : ""}${(saved == null ? void 0 : saved.record) ? ` \xB7 ${saved.record.wins || 0}\u2013${saved.record.losses || 0}` : ""}${saved ? `<button class="btn-mm-del pn-saved-del" data-pn-saved-del="${side}" title="Delete saved team" aria-label="Delete saved team ${escapeHtml(saved.name)}">\u2715</button>` : ""}</div>`}
    <div class="pn-card" style="--pn-c1:${((_a = school.colors) == null ? void 0 : _a[0]) || "#888"};--pn-c2:${((_b = school.colors) == null ? void 0 : _b[1]) || "#ccc"}">
      <div class="pn-card-head">
        <span class="pn-crest">${renderCrest(school, 40)}</span>
        <span class="pn-id">
          <span class="pn-name">${escapeHtml(school.name)}</span>
          <span class="pn-nick">${escapeHtml(school.nick)} \xB7 ${escapeHtml(school.city || "")}${school.state ? `, ${escapeHtml(school.state)}` : ""}</span>
        </span>
        <span class="pn-ovr" title="Average of the 22 best players">${teamOvr(school)}<small>TEAM</small></span>
      </div>
      <div class="pn-stripe"><span></span><span></span></div>
      <div class="pn-key-row">
        <span class="pn-key">QB1 <b>${escapeHtml(pname(qb))}</b> ${qb ? Math.round(qb.compositeRating) : ""}</span>
        <span class="pn-key">BEST <b>${escapeHtml(pname(star))}</b> ${star ? `${star.position} ${Math.round(star.compositeRating)}` : ""}</span>
      </div>
    </div>
    ${generated ? `<button class="btn-secondary pn-reroll" data-pn-reroll="${side}">\u21BB REROLL ${side === "home" ? "TEAM 1" : "TEAM 2"}</button>` : ""}
  </div>`;
}
function modeNote() {
  if (pn.mode === "watch") return "No coaching prompts. Both teams follow their loaded gameplans for the entire game.";
  if (pn.mode === "both") return "Local multiplayer: pass the device as the headset switches to whichever team has the ball.";
  if (pn.mode === "away") return "You control Team 2. Team 1 follows its gameplan.";
  return "You control Team 1. Team 2 follows its gameplan.";
}
function renderPlayNow() {
  ensureTeams();
  const watching = pn.mode === "watch";
  return `
  <div class="playnow-screen">
    <div class="newgame-header pn-header">
      <h1>\u{1F3C8} PLAY NOW</h1>
      <p class="pn-sub">${watching ? "One game, tonight. Both teams run their own plans \u2014 you watch every snap on the board." : pn.mode === "both" ? "One game, two headsets. Call every offensive snap for both teams." : "One game, tonight. Every offensive snap for your team is your call."}</p>
    </div>
    <div class="pn-body">
      <div class="pn-matchup">
        ${teamPanel("home", pn.home)}
        <div class="pn-vs">VS</div>
        ${teamPanel("away", pn.away)}
      </div>
      <div class="pn-control">
        <div class="pn-control-title">GAME CONTROL</div>
        <div class="pn-mode" role="group" aria-label="Game control">
          <button class="pn-mode-btn${pn.mode === "coach" ? " active" : ""}" data-pn-mode="coach" aria-pressed="${pn.mode === "coach"}">\u{1F3A7} TEAM 1</button>
          <button class="pn-mode-btn${pn.mode === "away" ? " active" : ""}" data-pn-mode="away" aria-pressed="${pn.mode === "away"}">\u{1F3A7} TEAM 2</button>
          <button class="pn-mode-btn${pn.mode === "both" ? " active" : ""}" data-pn-mode="both" aria-pressed="${pn.mode === "both"}">\u{1F3AE} BOTH TEAMS</button>
          <button class="pn-mode-btn${watching ? " active" : ""}" data-pn-mode="watch" aria-pressed="${watching}">\u25B6 WATCH ONLY</button>
        </div>
        <div class="pn-mode-note">${modeNote()}</div>
      </div>
      <div class="pn-actions">
        <button class="btn-primary pn-start" id="pn-start">${watching ? "WATCH KICKOFF" : "KICK OFF"} \u2192</button>
        <button class="btn-ghost" id="pn-back">\u2190 Main Menu</button>
      </div>
    </div>
  </div>`;
}
function playnowListeners() {
  var _a, _b;
  document.querySelectorAll("[data-pn-mode]").forEach((button) => button.addEventListener("click", () => {
    const mode = button.dataset.pnMode;
    pn.mode = ["coach", "away", "both", "watch"].includes(mode) ? mode : "coach";
    rerender();
  }));
  document.querySelectorAll("[data-pn-source]").forEach((select) => select.addEventListener("change", () => {
    const side = select.dataset.pnSource;
    const key = select.value;
    pn.source[side] = key;
    if (!key) pn[side] = makeTeam(side);
    else if (key.startsWith("creator:")) {
      pn[side] = makeCreatorTeam(key.slice(8), side) || makeTeam(side);
      if (!pn[side] || !pn[side]._creatorTeam) pn.source[side] = "";
    } else {
      const entry = savedByKey(key);
      pn[side] = instantiateSavedTeam(entry, side) || makeTeam(side);
      if (!entry) pn.source[side] = "";
    }
    rerender();
  }));
  // Delete a saved dynasty team from where it surfaces (the source picker).
  // Same logic the retired coach home wired ([data-mm-team-del] → deleteSavedTeam),
  // re-homed 2026-08-17; confirm() is the app's destructive-action convention
  // (world delete, classic delete).
  document.querySelectorAll("[data-pn-saved-del]").forEach((button) => button.addEventListener("click", () => {
    const side = button.dataset.pnSavedDel;
    const entry = savedByKey(pn.source[side]);
    if (!entry) return;
    if (!confirm(`Delete saved team "${entry.name}"? The snapshot is gone for good.`)) return;
    deleteSavedTeam(entry.coachId, entry.id);
    // Any side fielding this snapshot falls back to a generated team.
    for (const s of ["home", "away"]) {
      if (pn.source[s] === savedKey(entry)) {
        pn.source[s] = "";
        pn[s] = makeTeam(s);
      }
    }
    rerender();
  }));
  document.querySelectorAll("[data-pn-div]").forEach((button) => button.addEventListener("click", () => {
    const [side, div] = button.dataset.pnDiv.split(":");
    if (pn.cfg[side].div === div) return;
    pn.cfg[side].div = div;
    pn.cfg[side].prestige = Math.min(pn.cfg[side].prestige, capOf(div));
    pn[side] = makeTeam(side);
    rerender();
  }));
  document.querySelectorAll("[data-pn-star]").forEach((button) => button.addEventListener("click", () => {
    const [side, n] = button.dataset.pnStar.split(":");
    if (pn.cfg[side].prestige === +n) return;
    pn.cfg[side].prestige = +n;
    pn[side] = makeTeam(side);
    rerender();
  }));
  document.querySelectorAll("[data-pn-reroll]").forEach((button) => button.addEventListener("click", () => {
    const side = button.dataset.pnReroll;
    pn[side] = makeTeam(side);
    rerender();
  }));
  (_a = document.getElementById("pn-start")) == null ? void 0 : _a.addEventListener("click", () => {
    ensureTeams();
    startExhibition(cloneJson3(pn.home), cloneJson3(pn.away), pn.mode);
  });
  (_b = document.getElementById("pn-back")) == null ? void 0 : _b.addEventListener("click", () => {
    endExhibition();
    navigate("mainmenu");
  });
}

export { playnowListeners, renderPlayNow };
