import { state, rerender, navigate, notify } from '../../state.js';
import { listCreations, loadCreationData } from '../../engine/creator.js';
import { renderDivisionEditor, divisionsListeners, loadStaticDivision, leagueToEditor } from './creatordivision.js';

// ── Season Mode — setup ────────────────────────────────────────────────────
// Season Mode is a one-off single-season run that reuses the WHOLE dynasty (same
// dashboard, schedule, standings, stats, team pages, game plan, coach-your-game
// flow) minus recruiting/coach's office, and stops at the champion. Setup is two
// steps: (1) pick a division + a starting world (the real division or one of your
// saved custom leagues), then (2) the Division Editor opens as the league
// customizer + TEAM PICKER — tune the whole league if you like, hit "Play as" on
// your team, optionally Save, and kick off. The editor render/listeners are
// reused from creatordivision.js via state.ui.divContext === "season".
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function inEditor() { return state.ui.divContext === "season" && !!state.ui.div; }

function renderSetup() {
  const custom = listCreations("leagues");
  const src = state.ui.seasonSrc || { division: "D1", leagueId: null };
  const customForDiv = custom.filter((l) => (l.data.division || "D1") === src.division);
  return `<div class="creator-hub">
    <div class="creator-hub-head"><div class="creator-title">Season Mode</div>
      <div class="creator-sub">One season, played like a dynasty — schedule, standings, stats, and you coach or watch every game. No recruiting, no offseason. Win the title.</div></div>
    <div class="sm-field"><span>Division</span><div class="sm-btns">${["D1", "D2", "D3"].map((d) => `<button class="sm-pick${src.division === d ? " on" : ""}" data-sm-div="${d}">${d}</button>`).join("")}</div></div>
    <div class="sm-field"><span>Starting world</span><div class="sm-btns">
      <button class="sm-pick${!src.leagueId ? " on" : ""}" data-sm-league="">The real ${esc(src.division)}</button>
      ${customForDiv.map((l) => `<button class="sm-pick${src.leagueId === l.id ? " on" : ""}" data-sm-league="${esc(l.id)}">${esc(l.name)}</button>`).join("")}
    </div></div>
    <div class="sm-note muted">Next you'll customize the league (optional) and pick the team you want to play — great for taking a custom team for a spin.</div>
    <div class="pb-actions">
      <button class="btn-mm btn-mm-new" data-sm-choose="1">Customize & Pick Team →</button>
      <button class="btn-mm btn-mm-secondary" data-sm-menu="1">← Main Menu</button>
    </div>
  </div>`;
}
function renderSeasonMode() {
  if (inEditor()) return `<div class="creator-wrapper season-mode">${renderDivisionEditor()}</div>`;
  return `<div class="creator-wrapper season-mode">${renderSetup()}</div>`;
}
function enterEditor() {
  const src = state.ui.seasonSrc || { division: "D1", leagueId: null };
  if (src.leagueId) { state.ui.div = leagueToEditor(loadCreationData("leagues", src.leagueId)); state.ui.divId = src.leagueId; }
  else { state.ui.div = loadStaticDivision(src.division); state.ui.divId = null; }
  if (!state.ui.div) { notify("Could not load that league", "warning"); return; }
  state.ui.divContext = "season"; state.ui.divPick = null; state.ui.divConf = null; state.ui.divTeam = null; state.ui.divSearch = "";
  rerender();
}
function seasonModeListeners() {
  // In the editor step, the reused Division Editor owns all the wiring
  // (Play as / Start Season / Save / Back).
  if (inEditor()) { divisionsListeners(); return; }
  document.querySelectorAll("[data-sm-div]").forEach((b) => b.addEventListener("click", () => { state.ui.seasonSrc = { division: b.dataset.smDiv, leagueId: null }; rerender(); }));
  document.querySelectorAll("[data-sm-league]").forEach((b) => b.addEventListener("click", () => { state.ui.seasonSrc = { division: (state.ui.seasonSrc || {}).division || "D1", leagueId: b.dataset.smLeague || null }; rerender(); }));
  document.querySelector("[data-sm-choose]")?.addEventListener("click", () => { notify("Loading the league…", "info"); enterEditor(); });
  document.querySelector("[data-sm-menu]")?.addEventListener("click", () => { state.ui.season = null; navigate("mainmenu"); });
}
export { renderSeasonMode, seasonModeListeners };
