import { navigate, state, rerender } from '../../state.js';
import { listCreations } from '../../engine/creator.js';
import { listReplays } from '../../engine/replays.js';
import { renderPlaybooksTab, playbooksListeners } from './creatorplaybook.js';
import { renderDefTab, defListeners } from './creatordef.js';
import { renderPlaysTab, playsListeners } from './creatorplay.js';
import { renderTeamsTab, teamsListeners } from './creatorteam.js';
import { renderReplaysTab, replaysListeners } from './creatorreplay.js';
import { renderDivisionsTab, divisionsListeners } from './creatordivision.js';
import { renderFormTab, formListeners } from './creatorform.js';

// ── The Creator hub (Creativity Tools UI, Aug 2026) ────────────────────────
// The Main-Menu front door to the whole Creator: build playbooks, plays, teams
// and leagues, saved once to the global library and loadable into any world.
// A full-screen view (like Play Now), reached via navigate('creator'). The
// editors mount into `state.ui.creatorTab`; the hub is tab === null.
function creatorCard(id, icon, name, desc, count) {
  return `<button class="creator-card" data-creator="${id}">
      <span class="creator-card-icon">${icon}</span>
      <span class="creator-card-body">
        <span class="creator-card-name">${name}</span>
        <span class="creator-card-desc">${desc}</span>
      </span>
      <span class="creator-card-count">${count} saved</span>
    </button>`;
}
function renderCreatorHub() {
  const n = (k) => listCreations(k).length;
  return `<div class="creator-hub">
    <div class="creator-hub-head">
      <div class="creator-title">The Workshop</div>
      <div class="creator-sub">Build it once — load it into any world. Nothing here is tied to a save.</div>
    </div>
    <div class="creator-grid">
      ${creatorCard("playbooks", "\u{1F4CB}", "Playbook Builder", "Pick formations, choose each one's plays, save a system.", n("playbooks"))}
      ${creatorCard("defbooks", "\u{1F6E1}️", "Defensive Playbook", "Set your fronts, coverage, and pressure — a defense to load anywhere.", n("defbooks"))}
      ${creatorCard("plays", "✏️", "Play Composer", "Name your own version of a play, or compose one from routes.", n("plays"))}
      ${creatorCard("formations", "\u{1F4D0}", "Formation Designer", "Place your five over the line — a legal look of your own, playable in any book.", n("formations"))}
      ${creatorCard("leagues", "\u{1F3DF}️", "Division Editor", "Edit a whole division — conferences, teams, prestige.", n("leagues"))}
      ${creatorCard("teams", "\u{1F3C8}", "Team Editor", "Build a single team's identity to drop into any world.", n("teams"))}
      ${creatorCard("replays", "\u{1F3AC}", "Film Room", "Play back and manage the highlight clips you've saved.", listReplays().length)}
    </div>
    <button class="btn-mm btn-mm-secondary creator-back" data-creator="back">← Main Menu</button>
  </div>`;
}
function renderCreatorPlaceholder(tab) {
  const names = { playbooks: "Playbook Builder", defbooks: "Defensive Playbook", plays: "Play Composer", leagues: "Division Editor", teams: "Team Editor" };
  return `<div class="creator-hub">
    <div class="creator-hub-head">
      <div class="creator-title">${names[tab] || "Editor"}</div>
      <div class="creator-sub">This editor is being built. The engine underneath is done and tested — the screen is next.</div>
    </div>
    <button class="btn-mm btn-mm-secondary creator-back" data-creator="hub">← Back to the Workshop</button>
  </div>`;
}
function renderCreator() {
  const tab = state.ui.creatorTab || null;
  if (tab === "playbooks") return renderPlaybooksTab();
  if (tab === "defbooks") return renderDefTab();
  if (tab === "plays") return renderPlaysTab();
  if (tab === "formations") return renderFormTab();
  if (tab === "teams") return renderTeamsTab();
  if (tab === "leagues") return renderDivisionsTab();
  if (tab === "replays") return renderReplaysTab();
  return `<div class="creator-wrapper">${tab ? renderCreatorPlaceholder(tab) : renderCreatorHub()}</div>`;
}
function creatorListeners() {
  // Leaving a tab clears EVERY editor's transient state (not just pb/def) — a
  // half-open composer, team editor, or playbook preview otherwise greets you
  // on the next visit to that tab instead of its list.
  const clearEditors = () => {
    state.ui.pb = null; state.ui.pbId = null; state.ui.pbExpand = null; state.ui.pbPreview = null;
    state.ui.def = null; state.ui.defId = null; state.ui.defCard = null;
    state.ui.play = null; state.ui.playId = null;
    state.ui.form = null; state.ui.formId = null;
    state.ui.team = null; state.ui.teamId = null;
  };
  document.querySelectorAll("[data-creator]").forEach((b) => b.addEventListener("click", () => {
    const t = b.dataset.creator;
    if (t === "back") { state.ui.creatorTab = null; clearEditors(); navigate("mainmenu"); return; }
    if (t === "hub") { state.ui.creatorTab = null; clearEditors(); rerender(); return; }
    state.ui.creatorTab = t; clearEditors();
    rerender();
  }));
  if (state.ui.creatorTab === "playbooks") playbooksListeners();
  if (state.ui.creatorTab === "defbooks") defListeners();
  if (state.ui.creatorTab === "plays") playsListeners();
  if (state.ui.creatorTab === "formations") formListeners();
  if (state.ui.creatorTab === "teams") teamsListeners();
  if (state.ui.creatorTab === "leagues") divisionsListeners();
  if (state.ui.creatorTab === "replays") replaysListeners();
}
export { renderCreator, creatorListeners };
