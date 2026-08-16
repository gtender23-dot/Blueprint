import { state, rerender, notify, startSeasonRun } from '../../state.js';
import { listCreations, loadCreationData, saveCreation, deleteCreation } from '../../engine/creator.js';
import { assembleWorldSources, generateWorld, coinTeamIdentity, cityInState } from '../../engine/world.js';
import { renderCrest, crestLetters } from '../../utils.js';
import { C } from '../../constants.js';

// Is the editor open as the Season Mode setup (customize league + pick your
// team) rather than the Workshop's Division Editor? One flag switches the title,
// the per-team "Play as" control, and the footer (Start Season vs Save/Cancel).
function isSeasonSetup() { return state.ui.divContext === "season"; }

function stars(current, max, attr, id) {
  // Reverse value order (max..1) — paired with .star-sel{flex-direction:row-reverse}
  // so they read 1..max left-to-right and hover fills leftward.
  return `<div class="star-sel">${Array.from({ length: max }, (_, i) => { const v = max - i; return `<button class="star${v <= current ? " on" : ""}" data-${attr}="${id}" data-star-val="${v}">★</button>`; }).join("")}</div>`;
}

// ── Division Editor (Creativity Tools UI) ──────────────────────────────────
// Edit a whole division — starting from the REAL one — and save it as a custom
// division to drop into any world (Season Mode / a dynasty slot). Conferences and
// teams edit inline; a conference's PRESTIGE TIER distributes its schools at
// generation (the blue-blood/mid-major control, all divisions). Scale is handled
// by collapsing conferences: you expand one at a time. School detail opens in a
// card. Saved to the `leagues` shelf as a division blueprint the assembler +
// compileLeague already consume. Editor state in state.ui.div.
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function _d() { return state.ui.div; }
// Reroll a school's identity from a real one; a fresh crestSeed also reshapes
// the shield so the new look is distinct even if the pick's letters overlap.
function rerollSchool(t, division) {
  // Coin a fresh PROCEDURAL program sited in a real gazetteer city — a unique,
  // non-duplicate identity (the old reroll pulled a real team from the fixed
  // pool, which for D1 is always already in the division → a duplicate) that
  // also carries real coordinates, so a rerolled team has a genuine map home.
  const id = coinTeamIdentity({});
  t.name = id.name; t.nick = id.nick; t.colors = id.colors; t.state = id.state;
  t.city = id.city; t.lat = id.lat; t.lng = id.lng;
  t.crestSeed = Math.random().toString(36).slice(2, 8);
}
// Conf tier is the rounded average of its members' prestige — recomputed
// whenever a single team changes so the tier stays an honest summary.
function syncConfTier(d, confId) {
  const cf = d.confs.find((c) => c.id === confId);
  const mates = d.teams.filter((t) => t.conf === confId);
  if (cf && mates.length) cf.prestige = Math.round(mates.reduce((s, x) => s + (x.prestige || 0), 0) / mates.length);
}
var LOGOS = ["\u{1F3C8}", "\u{1F985}", "\u{1F42F}", "\u{1F43A}", "⚡", "\u{1F525}", "\u{1F984}", "\u{1F435}", "⚔️", "\u{1F428}", "\u{1F996}", "\u{1F408}"];

// The editor's working state (d = {name, division, confs, teams}) → the saved
// blueprint shape the assembler + compileLeague consume. Used by both Save and
// Start Season.
function blueprintFromEditor(d) {
  return { schemaVersion: 1, name: d.name, division: d.division,
    conferences: d.confs.map((c) => ({ id: c.id, name: c.name, short: c.short || c.id.slice(0, 4), division: d.division, conferenceClass: c.conferenceClass || null, prestige: c.prestige })),
    teams: d.teams.map((t) => ({ id: t.id, name: t.name, division: d.division, conf: t.conf, prestige: t.prestige, nick: t.nick, colors: t.colors, state: t.state, city: t.city, lat: t.lat, lng: t.lng, logo: t.logo, crestText: t.crestText, crestSeed: t.crestSeed }))
  };
}
// A saved `leagues` creation → the editor's working shape. Handles both the
// native editor format ({confs}) and a compileLeague blueprint ({conferences}).
function leagueToEditor(data) {
  if (data && data.confs) return data;
  if (data) return { name: data.name || "Custom", division: (data.conferences || [{}])[0].division || "D1", confs: (data.conferences || []).map((c) => ({ ...c, prestige: c.prestige != null ? c.prestige : 3 })), teams: data.teams || [] };
  return null;
}
function loadStaticDivision(division) {
  const src = assembleWorldSources({ [division]: "static" });
  const confs = Object.entries(src.conferences).filter(([, c]) => c.division === division).map(([id, c]) => ({
    id, name: c.name, short: c.short, division,
    conferenceClass: c.conferenceClass || null,
    prestige: c.prestige != null ? c.prestige : (c.conferenceClass === "power" ? Math.min((C.PRESTIGE_MAX || {})[division] || 6, 6) : c.conferenceClass === "midMajor" ? 3 : Math.round(((C.PRESTIGE_MAX || {})[division] || 4) / 2))
  }));
  const teams = src.schools.filter((s) => s.division === division).map((s) => ({
    id: s.id, name: s.name, conf: s.conf, prestige: s.prestige, nick: s.nick,
    colors: s.colors || ["#1e3a8a", "#e2e8f0"], state: s.state || "", logo: s.logo || "\u{1F3C8}",
    city: s.city || "", lat: s.lat, lng: s.lng
  }));
  return { name: `Custom ${division}`, division, confs, teams };
}

function renderDivisionList() {
  const saved = listCreations("leagues");
  const rows = saved.length ? saved.map((l) => `<div class="pb-row">
      <button class="pb-row-open" data-div-open="${esc(l.id)}"><span class="pb-row-name">🏟️ ${esc(l.name)}</span><span class="pb-row-meta">${esc(l.data.division || "D1")} · ${(l.data.teams || []).length} teams</span></button>
      <button class="btn-mm-del" data-div-del="${esc(l.id)}" title="Delete" aria-label="Delete ${esc(l.name)}">✕</button>
    </div>`).join("") : `<div class="mm-lib-empty muted">No custom divisions yet. Start from a real one and make it yours.</div>`;
  return `<div class="creator-hub">
    <div class="creator-hub-head"><div class="creator-title">Division Editor</div>
      <div class="creator-sub">Edit a whole division — conferences, teams, prestige — and save it to use anywhere.</div></div>
    <div class="pb-list">${rows}</div>
    <div class="pb-actions">
      <button class="btn-mm btn-mm-new" data-div-new="D1">＋ New from D1</button>
      <button class="btn-mm btn-mm-new" data-div-new="D2">＋ D2</button>
      <button class="btn-mm btn-mm-new" data-div-new="D3">＋ D3</button>
    </div>
    <div class="pb-actions"><button class="btn-mm btn-mm-secondary" data-creator="hub">← Workshop</button></div>
  </div>`;
}
function renderSchoolCard(t) {
  const cols = t.colors || ["#1e3a8a", "#e2e8f0"];
  return `<div class="dv-card" style="--c1:${esc(cols[0])};--c2:${esc(cols[1])}">
    <div class="dv-card-crest"><span class="dv-card-shield">${renderCrest(t, 72)}</span>
      <button class="btn-mm-del dv-reroll-crest" data-dv-reroll-crest="1">🎲 Reroll crest</button></div>
    <div class="te-row">
      <label class="te-field"><span>Name</span><input class="form-input" data-dv-field="name" value="${esc(t.name)}"/></label>
      <label class="te-field"><span>Mascot</span><input class="form-input" data-dv-field="nick" value="${esc(t.nick || "")}"/></label>
    </div>
    <div class="te-row">
      <label class="te-field te-color"><span>Primary</span><input type="color" data-dv-field="c1" value="${esc(cols[0])}"/></label>
      <label class="te-field te-color"><span>Secondary</span><input type="color" data-dv-field="c2" value="${esc(cols[1])}"/></label>
      <label class="te-field"><span>State</span><input class="form-input" maxlength="2" data-dv-field="state" value="${esc(t.state || "")}"/></label>
      <label class="te-field"><span>Crest letters</span><input class="form-input" maxlength="3" data-dv-field="crestText" value="${esc(t.crestText || "")}" placeholder="${esc(crestLetters({ ...t, crestText: "" }))}"/></label>
    </div>
    <button class="btn-mm-del dv-reroll" data-dv-reroll="1">🎲 Reroll this school</button>
    ${isSeasonSetup() ? `<button class="btn-mm btn-mm-new dv-card-playas${state.ui.divPick === t.id ? " picked" : ""}" data-dv-playas="${esc(t.id)}">${state.ui.divPick === t.id ? "✓ Your team" : "▶ Play as this team"}</button>` : ""}
  </div>`;
}
// Flat, cross-conference search results for the Season picker — find your team
// by name without expanding every conference. Reuses the existing row classes.
function seasonSearchResults(d, q, pMax, pickId) {
  const results = d.teams.filter((t) => (t.name || "").toLowerCase().includes(q) || (t.nick || "").toLowerCase().includes(q)).slice(0, 60);
  if (!results.length) return `<div class="mm-lib-empty muted">No teams match “${esc(q)}”.</div>`;
  return `<div class="dv-teams">${results.map((t) => {
    const isPick = t.id === pickId;
    const confName = (d.confs.find((c) => c.id === t.conf) || {}).name || "";
    return `<div class="dv-team${isPick ? " dv-team-picked" : ""}">
      <div class="dv-team-head">
        <span class="dv-team-name"><span class="te-row-crest">${renderCrest(t, 18)}</span> ${esc(t.name)} <span class="muted" style="font-size:11px">· ${esc(confName)}</span></span>
        <button class="dv-playas${isPick ? " picked" : ""}" data-dv-playas="${esc(t.id)}">${isPick ? "✓ Your team" : "Play as"}</button>
        ${stars(t.prestige, pMax, "dv-prestige", esc(t.id))}
      </div>
    </div>`;
  }).join("")}</div>`;
}
function renderDivisionEditor() {
  const d = _d();
  const season = isSeasonSetup();
  const pMax = (C.PRESTIGE_MAX || {})[d.division] || 6;
  const openConf = state.ui.divConf || null;
  const openTeam = state.ui.divTeam || null;
  const pickId = season ? state.ui.divPick || null : null;
  const picked = pickId ? d.teams.find((t) => t.id === pickId) : null;
  const q = season ? (state.ui.divSearch || "").trim().toLowerCase() : "";
  const confBlocks = d.confs.map((cf) => {
    const teams = d.teams.filter((t) => t.conf === cf.id);
    const open = openConf === cf.id;
    const hasPick = season && teams.some((t) => t.id === pickId);
    const teamRows = open ? teams.map((t) => {
      const cardOpen = openTeam === t.id;
      const isPick = season && t.id === pickId;
      return `<div class="dv-team${cardOpen ? " open" : ""}${isPick ? " dv-team-picked" : ""}">
        <div class="dv-team-head">
          <button class="dv-team-name" data-dv-team="${esc(t.id)}"><span class="te-row-crest">${renderCrest(t, 18)}</span> ${esc(t.name)}</button>
          ${season ? `<button class="dv-playas${isPick ? " picked" : ""}" data-dv-playas="${esc(t.id)}">${isPick ? "✓ Your team" : "Play as"}</button>` : ""}
          <button class="dv-quick-reroll" data-dv-reroll-school="${esc(t.id)}" title="Reroll this school">🎲</button>
          ${stars(t.prestige, pMax, "dv-prestige", esc(t.id))}
        </div>${cardOpen ? renderSchoolCard(t) : ""}
      </div>`;
    }).join("") : "";
    return `<div class="dv-conf${open ? " open" : ""}">
      <div class="dv-conf-head">
        <input class="form-input dv-conf-name" value="${esc(cf.name)}" data-dv-conf-name="${esc(cf.id)}"/>
        <div class="dv-conf-tier" title="conference tier — sets how strong its schools generate"><span>Tier</span>${stars(cf.prestige, pMax, "dv-conf-tier", esc(cf.id))}</div>
        <button class="dv-conf-toggle" data-dv-expand="${esc(cf.id)}">${hasPick ? "★ " : ""}${teams.length} teams ${open ? "▴" : "▾"}</button>
      </div>
      <div class="dv-teams">${teamRows}</div>
    </div>`;
  }).join("");
  return `<div class="creator-hub">
    <div class="creator-hub-head"><div class="creator-title">${season ? "Set Up Your Season" : "Division Editor"}</div>${season ? '<div class="creator-sub">Tune the whole league if you like, then hit “Play as” on the team you want. Saving is optional.</div>' : ""}</div>
    <input class="form-input pb-name" id="dv-name" maxlength="36" value="${esc(d.name)}" placeholder="${season ? "League name (if you save it)" : "Division name"}"/>
    ${season ? `<div class="dv-pick-banner${picked ? " has-pick" : ""}">${picked ? `<span class="te-row-crest">${renderCrest(picked, 22)}</span> Playing as <b>${esc(picked.name)}</b>` : "No team picked yet — search below or expand a conference, then hit “Play as.”"}</div>` : ""}
    ${season ? `<input class="form-input" id="dv-search" style="margin:2px 0 6px" placeholder="🔎 Search teams by name…" value="${esc(state.ui.divSearch || "")}" autocomplete="off"/>` : ""}
    <div class="pb-msg ok">${d.division} · ${d.confs.length} conferences · ${d.teams.length} teams. ${season ? "Search for your team, or tune the league." : "Set a conference's tier to bulk-set its schools, or tune any team."}</div>
    <div class="dv-confs">${q ? seasonSearchResults(d, q, pMax, pickId) : confBlocks}</div>
    <div class="pb-actions">
      ${season ? `<button class="btn-mm btn-mm-new${picked ? "" : " btn-mm-disabled"}" data-dv-start="1">Start Season →</button>
      <button class="btn-mm btn-mm-secondary" data-dv-save="1">Save League</button>
      <button class="btn-mm btn-mm-secondary" data-dv-back="1">← Back</button>` : `<button class="btn-mm btn-mm-new" data-dv-save="1">Save Division</button>
      <button class="btn-mm btn-mm-secondary" data-dv-cancel="1">Cancel</button>`}
    </div>
  </div>`;
}
function renderDivisionsTab() { return `<div class="creator-wrapper">${_d() ? renderDivisionEditor() : renderDivisionList()}</div>`; }
function _syncName() { const el = document.getElementById("dv-name"); if (el && _d()) _d().name = el.value; }
function divisionsListeners() {
  document.querySelectorAll("[data-div-open]").forEach((b) => b.addEventListener("click", () => {
    const ed = leagueToEditor(loadCreationData("leagues", b.dataset.divOpen));
    if (ed) { state.ui.div = ed; state.ui.divId = b.dataset.divOpen; state.ui.divConf = null; state.ui.divTeam = null; rerender(); }
  }));
  document.querySelectorAll("[data-div-del]").forEach((b) => b.addEventListener("click", () => { deleteCreation("leagues", b.dataset.divDel); rerender(); }));
  document.querySelectorAll("[data-div-new]").forEach((b) => b.addEventListener("click", () => {
    notify("Loading the division…", "info");
    state.ui.div = loadStaticDivision(b.dataset.divNew); state.ui.divId = null; state.ui.divConf = null; state.ui.divTeam = null; rerender();
  }));
  document.querySelectorAll("[data-dv-expand]").forEach((b) => b.addEventListener("click", () => { _syncName(); state.ui.divConf = state.ui.divConf === b.dataset.dvExpand ? null : b.dataset.dvExpand; state.ui.divTeam = null; rerender(); }));
  document.querySelectorAll("[data-dv-team]").forEach((b) => b.addEventListener("click", () => { _syncName(); state.ui.divTeam = state.ui.divTeam === b.dataset.dvTeam ? null : b.dataset.dvTeam; rerender(); }));
  document.querySelectorAll("[data-dv-conf-name]").forEach((el) => el.addEventListener("change", () => { const cf = _d().confs.find((c) => c.id === el.dataset.dvConfName); if (cf) cf.name = el.value; }));
  // Conf tier → all member schools: setting the tier bulk-sets every team in it.
  document.querySelectorAll("[data-dv-conf-tier]").forEach((b) => b.addEventListener("click", () => {
    _syncName(); const cf = _d().confs.find((c) => c.id === b.dataset.dvConfTier);
    if (cf) { const v = +b.dataset.starVal; cf.prestige = v; _d().teams.filter((t) => t.conf === cf.id).forEach((t) => { t.prestige = v; }); }
    rerender();
  }));
  // Team prestige → conf tier: editing one school pulls the conf tier to the new
  // member average, so the two views never disagree.
  document.querySelectorAll("[data-dv-prestige]").forEach((b) => b.addEventListener("click", () => {
    _syncName(); const t = _d().teams.find((x) => x.id === b.dataset.dvPrestige);
    if (t) { t.prestige = +b.dataset.starVal; syncConfTier(_d(), t.conf); }
    rerender();
  }));
  // Season picker search — filter teams by name across all conferences. Full
  // rerender per keystroke, then restore focus + caret so typing is unbroken.
  const se = document.getElementById("dv-search");
  if (se) se.addEventListener("input", () => {
    state.ui.divSearch = se.value; const pos = se.selectionStart;
    rerender();
    const ns = document.getElementById("dv-search");
    if (ns) { ns.focus(); try { ns.setSelectionRange(pos, pos); } catch (_) {} }
  });
  // Quick reroll on the conference list — no need to open the card.
  document.querySelectorAll("[data-dv-reroll-school]").forEach((b) => b.addEventListener("click", (e) => {
    e.stopPropagation(); _syncName();
    const t = _d().teams.find((x) => x.id === b.dataset.dvRerollSchool);
    if (t) { rerollSchool(t, _d().division); rerender(); }
  }));
  // school card fields
  const t = state.ui.divTeam ? _d().teams.find((x) => x.id === state.ui.divTeam) : null;
  if (t) {
    document.querySelectorAll("[data-dv-field]").forEach((el) => el.addEventListener("change", () => {
      const f = el.dataset.dvField;
      if (f === "c1") t.colors = [el.value, (t.colors || [])[1] || "#e2e8f0"];
      else if (f === "c2") t.colors = [(t.colors || [])[0] || "#1e3a8a", el.value];
      else t[f] = el.value;
      rerender();
    }));
    document.querySelector("[data-dv-reroll]")?.addEventListener("click", () => { rerollSchool(t, _d().division); rerender(); });
    // Reroll just the crest shape, keeping this school's name + colors.
    document.querySelector("[data-dv-reroll-crest]")?.addEventListener("click", () => { t.crestSeed = Math.random().toString(36).slice(2, 8); rerender(); });
  }
  document.querySelector("[data-dv-save]")?.addEventListener("click", () => {
    _syncName(); const d = _d();
    const r = saveCreation("leagues", d.name, blueprintFromEditor(d), state.ui.divId ? { id: state.ui.divId } : {});
    if (r.ok) {
      state.ui.divId = r.id || state.ui.divId;
      // In the Workshop, saving returns to the library. In Season setup you stay
      // put so you can pick a team and play the league you just saved.
      if (isSeasonSetup()) { notify(`"${d.name}" saved`, "success"); rerender(); }
      else { notify(`"${d.name}" saved`, "success"); state.ui.div = null; state.ui.divId = null; rerender(); }
    } else notify(r.reason === "full" ? "Library is full" : "Could not save", "warning");
  });
  document.querySelector("[data-dv-cancel]")?.addEventListener("click", () => { state.ui.div = null; state.ui.divId = null; rerender(); });
  // ── Season-setup only ────────────────────────────────────────────────────
  // Pick your team (anywhere in the league) and kick the season off from the
  // edited-in-memory league — saving first is optional.
  document.querySelectorAll("[data-dv-playas]").forEach((b) => b.addEventListener("click", (e) => {
    e.stopPropagation(); _syncName();
    state.ui.divPick = state.ui.divPick === b.dataset.dvPlayas ? null : b.dataset.dvPlayas;
    rerender();
  }));
  document.querySelector("[data-dv-start]")?.addEventListener("click", () => {
    _syncName(); const d = _d();
    const pickId = state.ui.divPick;
    if (!pickId) { notify("Pick your team first — hit “Play as” on any school.", "warning"); return; }
    notify("Building your league…", "info");
    try {
      const bp = blueprintFromEditor(d);
      const assembled = assembleWorldSources({ [d.division]: { conferences: bp.conferences, teams: bp.teams } });
      const world = generateWorld({ schools: assembled.schools, conferences: assembled.conferences });
      const me = world.schools.find((s) => s.id === pickId) || world.schools.find((s) => s.division === d.division);
      state.ui.divContext = null; state.ui.div = null; state.ui.divId = null; state.ui.divPick = null; state.ui.divSearch = "";
      startSeasonRun(world, me);
    } catch (err) { notify("Could not start: " + err.message, "warning"); }
  });
  document.querySelector("[data-dv-back]")?.addEventListener("click", () => {
    state.ui.divContext = null; state.ui.div = null; state.ui.divId = null; state.ui.divPick = null; state.ui.divSearch = ""; rerender();
  });
}
export { renderDivisionsTab, renderDivisionEditor, divisionsListeners, loadStaticDivision, leagueToEditor };
