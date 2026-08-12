import { weekLabel } from '../../engine/season.js';
import { getPlayerSchool, rerender, state } from '../../state.js';
import { escapeHtml, renderCrest } from '../../utils.js';

var activeTab2 = "program";
function renderHistory(embed = false) {
  const school = getPlayerSchool();
  const tabs = [
    ["program", "Program"],
    ["records", "Records"],
    ["awards", "Awards"],
    ["classes", "Classes"]
  ];
  return `
  ${embed ? "" : `<div class="view-header">
    <h1 class="view-title">History</h1>
    <div class="view-subtitle">The program record \u2014 banners, seasons, hardware, classes</div>
  </div>`}
  <div class="rec-tabs" style="margin-bottom:12px">
    ${tabs.map(([id, label]) => `
      <button class="rec-tab${activeTab2 === id ? " active" : ""}" data-hist-tab="${id}">${label}</button>`).join("")}
  </div>
  ${activeTab2 === "program" ? renderProgramTab(school) : activeTab2 === "records" ? renderRecordsTab(school) : activeTab2 === "awards" ? renderAwardsTab(school) : renderClassesTab(school)}
`;
}
function trophyKind(label) {
  const l = (label || "").toLowerCase();
  if (l.includes("national") || l.includes("championship")) return "natty";
  if (l.includes("conference")) return "conf";
  if (l.includes("playoff")) return "playoff";
  if (l.includes("career wins")) return "plaque";
  return "star";
}
function renderTrophy(label, season, size = 64) {
  const kind = trophyKind(label);
  const gold = "#f5c451", goldD = "#c9952b", silver = "#cfd6e4", silverD = "#8a93a8", bronze = "#c98a4b", bronzeD = "#8f5a26", wood = "#7a5230";
  let art = "";
  if (kind === "natty") art = `
  <path d="M14 8 H50 V20 C50 32 42 40 32 42 C22 40 14 32 14 20 Z" fill="${gold}" stroke="${goldD}" stroke-width="1.5"/>
  <path d="M14 10 C6 10 4 22 14 24 M50 10 C58 10 60 22 50 24" fill="none" stroke="${goldD}" stroke-width="3"/>
  <rect x="28" y="42" width="8" height="7" fill="${goldD}"/>
  <rect x="20" y="49" width="24" height="6" rx="1.5" fill="${wood}"/>
  <circle cx="32" cy="22" r="6.5" fill="${goldD}" opacity="0.55"/>`;
  else if (kind === "conf") art = `
  <path d="M17 10 H47 V21 C47 31 40 38 32 40 C24 38 17 31 17 21 Z" fill="${silver}" stroke="${silverD}" stroke-width="1.5"/>
  <path d="M17 12 C10 12 9 21 17 23 M47 12 C54 12 55 21 47 23" fill="none" stroke="${silverD}" stroke-width="2.6"/>
  <rect x="29" y="40" width="6" height="8" fill="${silverD}"/>
  <rect x="21" y="48" width="22" height="6" rx="1.5" fill="${wood}"/>`;
  else if (kind === "playoff") art = `
  <path d="M32 8 L48 14 V26 C48 36 41 42.5 32 45 C23 42.5 16 36 16 26 V14 Z" fill="${bronze}" stroke="${bronzeD}" stroke-width="1.5"/>
  <path d="M32 16 L36 24 H28 Z" fill="${bronzeD}"/>
  <rect x="22" y="48" width="20" height="5.5" rx="1.5" fill="${wood}"/>`;
  else if (kind === "plaque") art = `
  <rect x="12" y="12" width="40" height="34" rx="3" fill="${wood}" stroke="#5c3d22" stroke-width="1.5"/>
  <rect x="18" y="18" width="28" height="16" rx="2" fill="${gold}" opacity="0.95"/>
  <rect x="22" y="38" width="20" height="4" rx="1" fill="${gold}" opacity="0.6"/>`;
  else art = `
  <path d="M32 8 L38 22 L54 23.5 L42 34 L45.5 50 L32 41.5 L18.5 50 L22 34 L10 23.5 L26 22 Z"
        fill="${gold}" stroke="${goldD}" stroke-width="1.5"/>
  <rect x="22" y="50" width="20" height="5" rx="1.5" fill="${wood}"/>`;
  return `
  <div class="trophy" title="${escapeHtml(label)} \xB7 S${season}">
    <svg width="${size}" height="${size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">${art}</svg>
    <div class="trophy-label">${escapeHtml(label)}</div>
    <div class="trophy-season">S${season}</div>
  </div>`;
}
function renderProgramTab(school) {
  const hist = state.coachHistory || [];
  const seasons = hist.filter((h) => h.type === "season").slice().reverse();
  const programs = hist.filter((h) => h.type === "program");
  const milestones = hist.filter((h) => h.type === "milestone").slice().reverse();
  const L = school == null ? void 0 : school.lore;
  const heritage = L ? (() => {
    const at = L.allTime;
    const atGames = at.wins + at.losses + at.ties;
    const pct = atGames > 0 ? ` (${(at.wins / atGames * 100).toFixed(1)}%)` : "";
    const riv = school.rival;
    return `
  <div class="card">
    <div class="card-title">THE PROGRAM <span class="muted" style="font-weight:400">\u2014 before you</span></div>
    <div class="heritage">
      <div class="heritage-line"><b>Football since ${L.footballSince}</b> \xB7 all-time <b>${at.wins}\u2013${at.losses}${at.ties ? `\u2013${at.ties}` : ""}</b>${pct}</div>
      ${L.titles.length ? `<div class="heritage-line heritage-natty">\u{1F3C6} <b>${L.titles.length} national title${L.titles.length > 1 ? "s" : ""}</b> \u2014 ${L.titles.join(", ")}</div>` : ""}
      ${L.confTitles.length ? `<div class="heritage-line">\u{1F947} ${L.confTitles.length} conference championship${L.confTitles.length > 1 ? "s" : ""}${L.confTitles.length ? ` <span class="muted">(last ${L.confTitles[L.confTitles.length - 1]})</span>` : ""}</div>` : ""}
      ${L.postseasons ? `<div class="heritage-line">\u{1F39F}\uFE0F ${L.postseasons} postseason appearances</div>` : ""}
      ${L.legend ? `<div class="heritage-line heritage-legend">\u{1F464} <b>The ${escapeHtml(L.legend.name)} era</b> (${L.legend.from}\u2013${L.legend.to}) \xB7 ${L.legend.wins}\u2013${L.legend.losses} \xB7 ${escapeHtml(L.legend.note)}</div>` : ""}
      ${riv ? `<div class="heritage-line heritage-rival">\u2694\uFE0F <b>${riv.schoolId ? `<span class="team-link" data-scout-team="${riv.schoolId}">${escapeHtml(riv.name)}</span>` : escapeHtml(riv.name)}</b> \u2014 ${riv.wins}\u2013${riv.losses}${riv.ties ? `\u2013${riv.ties}` : ""} since ${riv.since}${riv.trophy ? ` \xB7 ${escapeHtml(riv.trophy)}${riv.holderId === school.id ? ' <span class="heritage-hold">(we hold it)</span>' : ' <span class="heritage-lost">(they hold it)</span>'}` : ""}</div>` : ""}
      <div class="heritage-line heritage-trad">\u{1F3BA} Tradition: ${escapeHtml(L.tradition)}</div>
    </div>
    ${L.events.length ? `
      <div class="heritage-timeline">
        ${L.events.map((e) => `
          <div class="heritage-event heritage-${e.kind}">
            <span class="heritage-year">${e.year}</span>
            <span class="heritage-text">${escapeHtml(e.text)}</span>
          </div>`).join("")}
      </div>` : ""}
  </div>`;
  })() : "";
  const trophies = programs.length ? `
  <div class="card">
    <div class="card-title">TROPHY CASE</div>
    <div class="trophy-shelf">
      ${programs.map((p) => renderTrophy(p.label, p.season)).join("")}
    </div>
  </div>` : "";
  const banners = programs.length ? `
  <div class="card">
    <div class="card-title">BANNERS</div>
    <div class="banner-wall">
      ${programs.map((p) => `
        <div class="banner-pennant">
          <div class="banner-season">S${p.season}</div>
          <div class="banner-label">${escapeHtml(p.label)}</div>
        </div>`).join("")}
    </div>
  </div>` : "";
  const totals = seasons.reduce((a, s) => ({ w: a.w + (s.wins || 0), l: a.l + (s.losses || 0) }), { w: 0, l: 0 });
  const seasonTable = `
  <div class="card">
    <div class="card-title">SEASON BY SEASON
      ${seasons.length ? `<span class="muted" style="font-weight:400"> \xB7 all-time ${totals.w}\u2013${totals.l}</span>` : ""}</div>
    ${seasons.length ? `
      <table class="data-table">
        <thead><tr><th>Season</th><th>School</th><th>Record</th></tr></thead>
        <tbody>
          ${seasons.map((s) => `
            <tr>
              <td>S${s.season}</td>
              <td>${s.schoolId ? `<span class="team-link" data-scout-team="${s.schoolId}">${escapeHtml(s.schoolName || "\u2014")}</span>` : escapeHtml(s.schoolName || "\u2014")}</td>
              <td><b>${s.wins}\u2013${s.losses}</b></td>
            </tr>
            ${s.recap ? `<tr class="hist-recap-row"><td colspan="3"><p class="hist-recap">${escapeHtml(s.recap)}</p></td></tr>` : ""}`).join("")}
        </tbody>
      </table>` : `<p class="empty-hint">Your first season is still being written. Finish it and the ledger starts here.</p>`}
  </div>`;
  const milestoneList = milestones.length ? `
  <div class="card">
    <div class="card-title">PLAYER MILESTONES</div>
    ${milestones.slice(0, 30).map((m) => `
      <div class="offseason-item">
        <span class="offseason-label">${m.playerId ? `<span class="player-link" data-pcard="${m.playerId}">${escapeHtml(m.name || "")}</span>` : escapeHtml(m.name || "")}</span>
        <span class="offseason-detail">${escapeHtml(m.label)} <span class="muted">\xB7 S${m.season}</span></span>
      </div>`).join("")}
  </div>` : "";
  return `
  <div class="hist-head card" style="display:flex;align-items:center;gap:12px">
    ${renderCrest(school, 46)}
    <div>
      <div style="font-weight:800;font-size:15px">${escapeHtml((school == null ? void 0 : school.name) || "")}</div>
      <div class="muted" style="font-size:11.5px">${escapeHtml((school == null ? void 0 : school.city) || "")}, ${escapeHtml((school == null ? void 0 : school.state) || "")} \xB7 est. ${(school == null ? void 0 : school.founded) || "\u2014"}</div>
    </div>
  </div>
  ${heritage}
  ${trophies}
  ${banners}
  ${seasonTable}
  ${milestoneList}`;
}
var REC_LABELS = [
  ["passYds", "Passing Yards"],
  ["passTD", "Passing TDs"],
  ["rushYds", "Rushing Yards"],
  ["rushTD", "Rushing TDs"],
  ["recYds", "Receiving Yards"],
  ["recTD", "Receiving TDs"],
  ["recComp", "Receptions"],
  ["tackles", "Tackles"],
  ["sacks", "Sacks"],
  ["ints", "Interceptions"],
  ["fgMade", "Field Goals Made"]
];
function renderRecordsTab(school) {
  var _a;
  const H = (_a = state.history) == null ? void 0 : _a.programRecords;
  if (!H || !Object.keys(H.season || {}).length && !Object.keys(H.career || {}).length) {
    return `<div class="card"><p class="empty-hint">The record book opens after your first full season \u2014 every completed year writes its leaders here, forever.</p></div>`;
  }
  const board = (title, data, seasonKey) => `
  <div class="card">
    <div class="card-title">${title}</div>
    ${REC_LABELS.map(([cat, label]) => {
    const rows = ((data == null ? void 0 : data[cat]) || []).slice(0, 5);
    if (!rows.length) return "";
    return `
        <div class="recbook-cat">
          <div class="recbook-label">${label}</div>
          ${rows.map((r, i) => `
            <div class="recbook-row${i === 0 ? " recbook-top" : ""}">
              <span class="recbook-rank">${i + 1}</span>
              <span class="recbook-name">${escapeHtml(r.name)} <span class="muted">${escapeHtml(r.pos || "")}</span></span>
              <span class="recbook-val">${r.value.toLocaleString()}</span>
              <span class="recbook-season muted">${seasonKey === "season" ? "S" + r.season : "thru S" + r.lastSeason}</span>
            </div>`).join("")}
        </div>`;
  }).join("")}
  </div>`;
  return board("SINGLE-SEASON RECORDS", H.season, "season") + board("CAREER RECORDS", H.career, "career");
}
var MAJOR = /* @__PURE__ */ new Set(["MVP", "DivCOY", "COY", "NATTY", "CONF_TITLE"]);
function renderAwardsTab(school) {
  var _a;
  const log = (state.awardsLog || []).filter((a) => a.scope !== "weekly");
  if (!log.length) return `<div class="card"><p class="empty-hint">No hardware handed out yet \u2014 awards live here after your first banquet.</p></div>`;
  const bySeason = {};
  for (const a of log) (bySeason[_a = a.season] || (bySeason[_a] = [])).push(a);
  const seasonsDesc = Object.keys(bySeason).map(Number).sort((a, b) => b - a).slice(0, 10);
  return seasonsDesc.map((sn) => {
    const rows = bySeason[sn].filter((a) => MAJOR.has(a.category) || a.schoolId === (school == null ? void 0 : school.id)).slice(0, 40);
    if (!rows.length) return "";
    return `
    <div class="card">
      <div class="card-title">SEASON ${sn}</div>
      ${rows.map((a) => {
      const mine = a.schoolId === (school == null ? void 0 : school.id);
      const who = a.playerName || a.coachName || a.schoolName || "\u2014";
      const whoHtml = a.playerName && a.playerId ? `<span class="player-link" data-pcard="${a.playerId}">${escapeHtml(a.playerName)}</span>` : !a.playerName && !a.coachName && a.schoolName && a.schoolId ? `<span class="team-link" data-scout-team="${a.schoolId}">${escapeHtml(a.schoolName)}</span>` : escapeHtml(who);
      const schName = a.schoolId ? `<span class="team-link" data-scout-team="${a.schoolId}">${escapeHtml(a.schoolName)}</span>` : escapeHtml(a.schoolName || "");
      const where = (a.playerName || a.coachName) && a.schoolName ? ` <span class="muted">(${schName})</span>` : "";
      return `
          <div class="offseason-item${mine ? " hist-mine" : ""}">
            <span class="offseason-label">${escapeHtml(a.category)}${a.scope && a.scope !== "division" ? ` <span class="muted" style="font-weight:400">\xB7 ${escapeHtml(String(a.scope))}</span>` : ""}</span>
            <span class="offseason-detail">${whoHtml}${where}${mine ? " \u2605" : ""}</span>
          </div>`;
    }).join("")}
    </div>`;
  }).join("");
}
function renderClassesTab(school) {
  var _a;
  const mine = (state.signingsLog || []).filter((s) => s.schoolId === (school == null ? void 0 : school.id));
  if (!mine.length) return `<div class="card"><p class="empty-hint">No signees yet \u2014 your first class shows up here on Signing Day.</p></div>`;
  const bySeason = {};
  for (const s of mine) (bySeason[_a = s.season] || (bySeason[_a] = [])).push(s);
  const seasonsDesc = Object.keys(bySeason).map(Number).sort((a, b) => b - a);
  return seasonsDesc.map((sn) => {
    const cls = bySeason[sn];
    const byPos = {};
    for (const s of cls) byPos[s.pos] = (byPos[s.pos] || 0) + 1;
    const posLine = Object.entries(byPos).map(([p, n]) => `${n} ${p}`).join(" \xB7 ");
    return `
    <div class="card">
      <div class="card-title">CLASS OF S${sn} <span class="muted" style="font-weight:400">\xB7 ${cls.length} signees \xB7 ${posLine}</span></div>
      ${cls.map((s) => `
        <div class="offseason-item">
          <span class="offseason-label">${escapeHtml(s.name)}</span>
          <span class="offseason-detail">${escapeHtml(s.pos)} <span class="muted">\xB7 ${escapeHtml(weekLabel(s.day))}</span></span>
        </div>`).join("")}
    </div>`;
  }).join("");
}
function setupListeners16() {
  document.querySelectorAll("[data-hist-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab2 = btn.dataset.histTab;
      rerender();
    });
  });
}

export { renderHistory, setupListeners16 };
