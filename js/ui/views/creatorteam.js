import { state, rerender, notify } from '../../state.js';
import { listCreations, loadCreationData, saveCreation, deleteCreation } from '../../engine/creator.js';
import { availableStates, cityInState, STAR_CALIBER } from '../../engine/world.js';
import { renderCrest, crestLetters } from '../../utils.js';
import { C, POSITIONS, CLASS_YEARS } from '../../constants.js';

// Site a custom team in a REAL city (from the gazetteer) in its home state, so it
// has genuine coordinates for recruiting distance. Called on create, on a state
// change, and by the reroll-city button.
function teAssignCity(t) {
  const c = cityInState(t && t.state);
  if (c) { t.city = c.c; t.lat = c.lat; t.lng = c.lng; }
}

// ── Team Editor (Creativity Tools UI) — identity, v1 ───────────────────────
// A single team's identity, saved to the `teams` shelf, to drop into any world
// (a one-team seed; the conference is assigned when it's used). v1 is identity
// only — name, mascot, division, prestige, home state, colors, logo. Full roster
// authoring is a planned phase-2 (Ref/CREATOR_ENTRANCES.md). Editor state in
// state.ui.team.
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function _t() { return state.ui.team; }
var LOGOS = ["\u{1F3C8}", "\u{1F985}", "\u{1F42F}", "\u{1F43A}", "⚡", "\u{1F525}", "\u{1F3F4}‍☠️", "\u{1F984}", "\u{1F435}", "⚔️", "\u{1F428}", "\u{1F996}"];

function renderTeamList() {
  const teams = listCreations("teams");
  const rows = teams.length ? teams.map((t) => `<div class="pb-row">
      <button class="pb-row-open" data-team-open="${esc(t.id)}"><span class="pb-row-name"><span class="te-row-crest">${renderCrest(t.data, 22)}</span> ${esc(t.data.name)}</span><span class="pb-row-meta">${esc(t.data.division || "D1")} · ${(t.data.prestige != null ? t.data.prestige : 3)}★</span></button>
      <button class="btn-mm-del" data-team-del="${esc(t.id)}" title="Delete" aria-label="Delete ${esc(t.data.name)}">✕</button>
    </div>`).join("") : `<div class="mm-lib-empty muted">No custom teams yet. Build one to drop into any world.</div>`;
  return `<div class="creator-hub">
    <div class="creator-hub-head"><div class="creator-title">Team Editor</div>
      <div class="creator-sub">Build a team's identity. Drop it into a season or a division as your own.</div></div>
    <div class="pb-list">${rows}</div>
    <div class="pb-actions">
      <button class="btn-mm btn-mm-new" data-team-new="1">＋ New Team</button>
      <button class="btn-mm btn-mm-secondary" data-creator="hub">← Workshop</button>
    </div>
  </div>`;
}
function renderTeamEditor() {
  const t = _t();
  const div = t.division || "D1";
  const pMax = (C.PRESTIGE_MAX || {})[div] || 6;
  const states = availableStates().map((s) => s.state);
  const cols = t.colors || ["#1e3a8a", "#e2e8f0"];
  return `<div class="creator-hub">
    <div class="creator-hub-head"><div class="creator-title">Team Editor</div></div>
    <div class="te-preview" style="--c1:${esc(cols[0])};--c2:${esc(cols[1])}">
      <span class="te-crest">${renderCrest(t, 60)}</span>
      <span class="te-name">${esc(t.name || "New Team")}</span>
      <span class="te-nick">${esc(t.nick || "")}</span>
      <button class="btn-mm-del te-reroll" data-team-reroll="1">🎲 Reroll crest</button>
    </div>
    <div class="te-form">
      <label class="te-field"><span>Name</span><input class="form-input" id="te-name" maxlength="36" value="${esc(t.name || "")}" placeholder="River City University"/></label>
      <label class="te-field"><span>Mascot</span><input class="form-input" id="te-nick" maxlength="24" value="${esc(t.nick || "")}" placeholder="Rapids"/></label>
      <div class="te-row">
        <label class="te-field"><span>Division</span><select class="form-input" id="te-div">${["D1", "D2", "D3"].map((d) => `<option value="${d}"${div === d ? " selected" : ""}>${d}</option>`).join("")}</select></label>
        <div class="te-field"><span>Prestige</span><div class="star-sel">${Array.from({ length: pMax }, (_, i) => { const v = pMax - i; const cur = Math.min(pMax, t.prestige != null ? t.prestige : 3); return `<button class="star${v <= cur ? " on" : ""}" data-team-star="${v}">★</button>`; }).join("")}</div></div>
        <label class="te-field"><span>Home state</span><select class="form-input" id="te-state">${states.map((s) => `<option value="${s}"${t.state === s ? " selected" : ""}>${s}</option>`).join("")}</select></label>
        <div class="te-field"><span>Home city</span><div class="te-city-row"><span class="te-city-name">${esc(t.city || "—")}</span><button class="btn-mm-del te-recity" data-te-recity="1" title="Pick another real city in this state">🎲</button></div></div>
      </div>
      <div class="te-crest-note muted">Your home city is a real place — it gives your team a spot on the map so recruiting distance works. 🎲 picks another city in your state.</div>
      <div class="te-row">
        <label class="te-field te-color"><span>Primary</span><input type="color" id="te-c1" value="${esc(cols[0])}"/></label>
        <label class="te-field te-color"><span>Secondary</span><input type="color" id="te-c2" value="${esc(cols[1])}"/></label>
        <label class="te-field"><span>Crest letters</span><input class="form-input" id="te-cresttext" maxlength="3" value="${esc(t.crestText || "")}" placeholder="${esc(crestLetters({ ...t, crestText: "" }))}"/></label>
      </div>
      <div class="te-crest-note muted">The crest is drawn from your colors and name. Leave crest letters blank to use your name's initials, or type up to 3 to set them yourself.</div>
    </div>
    ${renderStarSection(t)}
    <div class="pb-actions">
      <button class="btn-mm btn-mm-new" data-team-save="1">Save Team</button>
      <button class="btn-mm btn-mm-secondary" data-team-cancel="1">Cancel</button>
    </div>
  </div>`;
}
// Star players — a few named standouts who anchor the roster when this team is
// dropped into a world (Team Editor phase 2). Stored on t.stars; applied by
// applyTeamStars when the team is built (see Play Now).
function renderStarSection(t) {
  const stars = t.stars || [];
  const rows = stars.map((s, i) => `<div class="te-star-row">
      <select class="form-input te-star-pos" data-star-field="position" data-star-i="${i}">${POSITIONS.map((p) => `<option value="${p}"${s.position === p ? " selected" : ""}>${p}</option>`).join("")}</select>
      <input class="form-input te-star-name" data-star-field="name" data-star-i="${i}" maxlength="32" placeholder="Player name" value="${esc(s.name || "")}"/>
      <select class="form-input te-star-cy" data-star-field="classYear" data-star-i="${i}">${CLASS_YEARS.map((c) => `<option value="${c}"${s.classYear === c ? " selected" : ""}>${c}</option>`).join("")}</select>
      <div class="te-star-cal">${Object.entries(STAR_CALIBER).map(([id, c]) => `<button type="button" class="te-cal${s.caliber === id ? " on" : ""}" data-star-cal="${i}|${id}">${esc(c.label)}</button>`).join("")}</div>
      <button class="btn-mm-del" data-star-del="${i}" title="Remove" aria-label="Remove star">✕</button>
    </div>`).join("");
  return `<div class="te-star-section">
    <div class="def-section-head">Star players <span class="muted">— name a few standouts; they anchor the roster in Play Now (exhibitions only, not dynasty)</span></div>
    ${rows}
    ${stars.length < 5 ? `<button class="btn-mm btn-mm-secondary te-star-add" data-star-add="1">＋ Add a star</button>` : `<div class="muted" style="font-size:11px">Up to 5 stars.</div>`}
  </div>`;
}
function renderTeamsTab() { return `<div class="creator-wrapper">${_t() ? renderTeamEditor() : renderTeamList()}</div>`; }
function _sync() {
  const t = _t(); if (!t) return;
  const g = (id) => document.getElementById(id);
  if (g("te-name")) t.name = g("te-name").value;
  if (g("te-nick")) t.nick = g("te-nick").value;
  if (g("te-div")) t.division = g("te-div").value;
  if (g("te-state")) t.state = g("te-state").value;
  if (g("te-cresttext")) t.crestText = g("te-cresttext").value;
  if (g("te-c1")) t.colors = [g("te-c1").value, (g("te-c2") ? g("te-c2").value : (t.colors || [])[1]) || "#e2e8f0"];
}
function teamsListeners() {
  document.querySelectorAll("[data-team-open]").forEach((b) => b.addEventListener("click", () => {
    const data = loadCreationData("teams", b.dataset.teamOpen);
    if (data) { state.ui.team = { ...data }; if (!data.city && data.state) teAssignCity(state.ui.team); state.ui.teamId = b.dataset.teamOpen; rerender(); }
  }));
  document.querySelectorAll("[data-team-del]").forEach((b) => b.addEventListener("click", () => { deleteCreation("teams", b.dataset.teamDel); rerender(); }));
  document.querySelector("[data-team-new]")?.addEventListener("click", () => {
    const st0 = availableStates()[0].state;
    state.ui.team = { name: "", nick: "", division: "D1", prestige: 3, state: st0, colors: ["#1e3a8a", "#e2e8f0"], logo: "\u{1F3C8}" };
    teAssignCity(state.ui.team);
    state.ui.teamId = null; rerender();
  });
  document.getElementById("te-div")?.addEventListener("change", () => { _sync(); rerender(); });
  // Home state change re-homes the team to a real city in the new state; the 🎲
  // shuffles to another city in the current state.
  document.getElementById("te-state")?.addEventListener("change", () => { _sync(); const t = _t(); if (t) teAssignCity(t); rerender(); });
  document.querySelector("[data-te-recity]")?.addEventListener("click", () => { _sync(); const t = _t(); if (t) teAssignCity(t); rerender(); });
  document.getElementById("te-c1")?.addEventListener("input", () => { _sync(); rerender(); });
  document.getElementById("te-c2")?.addEventListener("input", () => { _sync(); rerender(); });
  // Text fields NEVER rerender on 'change' — blurring into a button fired the
  // change→rerender which destroyed that button mid-click, so the first click
  // after typing (Add a star, Save Team…) was silently swallowed. Instead the
  // 'input' handlers live-refresh the crest/name/nick in place, and every action
  // button already calls _sync() first, so nothing is lost by not rerendering.
  const _refreshCrest = () => { const t = _t(); if (!t) return; const el = document.querySelector(".te-crest"); if (el) el.innerHTML = renderCrest(t, 60); };
  document.getElementById("te-cresttext")?.addEventListener("input", () => { const t = _t(); if (!t) return; t.crestText = document.getElementById("te-cresttext").value; _refreshCrest(); });
  document.getElementById("te-name")?.addEventListener("input", () => { const t = _t(); if (!t) return; t.name = document.getElementById("te-name").value; const el = document.querySelector(".te-name"); if (el) el.textContent = t.name || "New Team"; _refreshCrest(); });
  document.getElementById("te-nick")?.addEventListener("input", () => { const t = _t(); if (!t) return; t.nick = document.getElementById("te-nick").value; const el = document.querySelector(".te-nick"); if (el) el.textContent = t.nick || ""; _refreshCrest(); });
  document.querySelectorAll("[data-team-star]").forEach((b) => b.addEventListener("click", () => { _sync(); _t().prestige = +b.dataset.teamStar; rerender(); }));
  // ── Star players ──────────────────────────────────────────────────────────
  document.querySelector("[data-star-add]")?.addEventListener("click", () => {
    _sync(); const t = _t(); t.stars = t.stars || [];
    if (t.stars.length < 5) t.stars.push({ position: "QB", name: "", classYear: "JR", caliber: "star" });
    rerender();
  });
  document.querySelectorAll("[data-star-del]").forEach((b) => b.addEventListener("click", () => {
    _sync(); const t = _t(); if (t.stars) t.stars.splice(+b.dataset.starDel, 1); rerender();
  }));
  document.querySelectorAll("[data-star-cal]").forEach((b) => b.addEventListener("click", () => {
    _sync(); const t = _t(); const [i, id] = b.dataset.starCal.split("|");
    if (t.stars && t.stars[+i]) t.stars[+i].caliber = id; rerender();
  }));
  // position/class re-render; name updates live without a rerender (keeps focus)
  document.querySelectorAll("select[data-star-field]").forEach((el) => el.addEventListener("change", () => {
    _sync(); const t = _t(); const i = +el.dataset.starI;
    if (t.stars && t.stars[i]) t.stars[i][el.dataset.starField] = el.value; rerender();
  }));
  document.querySelectorAll("input[data-star-field]").forEach((el) => el.addEventListener("input", () => {
    const t = _t(); const i = +el.dataset.starI;
    if (t.stars && t.stars[i]) t.stars[i][el.dataset.starField] = el.value;
  }));
  // Reroll the crest: bump crestSeed so crestHash lands a new frame/style/pattern
  // (the shield SHAPE) while keeping the same colors + letters.
  document.querySelector("[data-team-reroll]")?.addEventListener("click", () => { _sync(); _t().crestSeed = Math.random().toString(36).slice(2, 8); rerender(); });
  document.querySelector("[data-team-save]")?.addEventListener("click", () => {
    _sync(); const t = _t();
    if (!t.name || !t.name.trim()) { notify("Give your team a name", "warning"); return; }
    const pMax = (C.PRESTIGE_MAX || {})[t.division || "D1"] || 6;
    t.prestige = Math.max(1, Math.min(pMax, t.prestige || 3));
    const r = saveCreation("teams", t.name, t, state.ui.teamId ? { id: state.ui.teamId } : {});
    if (r.ok) { notify(`"${t.name}" saved`, "success"); state.ui.team = null; state.ui.teamId = null; rerender(); }
    else notify(r.reason === "full" ? "Library is full" : "Could not save", "warning");
  });
  document.querySelector("[data-team-cancel]")?.addEventListener("click", () => { state.ui.team = null; state.ui.teamId = null; rerender(); });
}
export { renderTeamsTab, teamsListeners };
