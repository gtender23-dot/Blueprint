import { computeDivisionPoll, computeSOS } from '../../engine/rankings.js';
import { getPlayerSchool, rerender, state } from '../../state.js';
import { getOrder, setupDrag } from '../colOrder.js';
import { escapeHtml, fmtRecord } from '../../utils.js';

var standingsMode = "conference";
var standingsConf = null;
var nationalDiv = null;
var _sosCache = null;
var CONF_COLS = [
  { id: "conf", header: "Conf", cell: (s) => `<td>${fmtRecord(s.record.confWins, s.record.confLosses)}</td>` },
  { id: "wl", header: "W-L", cell: (s) => `<td>${fmtRecord(s.record.wins, s.record.losses)}</td>` },
  { id: "pf", header: "PF", title: "Points for per game", cell: (s) => {
    var _a, _b;
    const g = ((_a = s.stats) == null ? void 0 : _a.games) || 0;
    const pf = ((_b = s.stats) == null ? void 0 : _b.pointsFor) || 0;
    return `<td>${g ? (pf / g).toFixed(1) : "\u2014"}</td>`;
  } },
  { id: "pa", header: "PA", title: "Points against per game", cell: (s) => {
    var _a, _b;
    const g = ((_a = s.stats) == null ? void 0 : _a.games) || 0;
    const pa = ((_b = s.stats) == null ? void 0 : _b.pointsAgainst) || 0;
    return `<td>${g ? (pa / g).toFixed(1) : "\u2014"}</td>`;
  } },
  { id: "diff", header: "Diff", title: "Point differential", cell: (s) => {
    var _a, _b;
    const d = (((_a = s.stats) == null ? void 0 : _a.pointsFor) || 0) - (((_b = s.stats) == null ? void 0 : _b.pointsAgainst) || 0);
    return `<td class="${d >= 0 ? "positive" : "negative"}">${d >= 0 ? "+" : ""}${d}</td>`;
  } },
  { id: "sos", header: "SOS", title: "Strength of schedule (\u2154 opponents' win% + \u2153 opponents-of-opponents' win%)", cell: (s) => {
    var _a;
    if (!_sosCache) _sosCache = computeSOS(((_a = state.world) == null ? void 0 : _a.schools) || [], state.schedule || []);
    const v = _sosCache.get(s.id);
    return `<td title="Strength of schedule">${v != null && v > 0 ? v.toFixed(3) : "\u2014"}</td>`;
  } },
  { id: "streak", header: "Streak", cell: (s) => `<td>${calcStreak(s.id)}</td>` }
];
var OVERALL_COLS = [
  { id: "conf", header: "Conf", cell: (e) => `<td class="muted">${escapeHtml(e.school.conf)}</td>` },
  { id: "record", header: "Record", cell: (e) => `<td>${fmtRecord(e.wins, e.losses)}</td>` },
  { id: "pf", header: "PF", title: "Points for per game", cell: (e) => {
    var _a;
    const s = e.school;
    const g = ((_a = s.stats) == null ? void 0 : _a.games) || 0;
    return `<td>${g ? (s.stats.pointsFor / g).toFixed(1) : "\u2014"}</td>`;
  } },
  { id: "pa", header: "PA", title: "Points against per game", cell: (e) => {
    var _a;
    const s = e.school;
    const g = ((_a = s.stats) == null ? void 0 : _a.games) || 0;
    return `<td>${g ? (s.stats.pointsAgainst / g).toFixed(1) : "\u2014"}</td>`;
  } },
  { id: "sos", header: "SOS", title: "Strength of schedule (\u2154 opponents' win% + \u2153 opponents-of-opponents' win%)", cell: (e) => {
    const v = e.sos;
    return `<td title="Strength of schedule">${v != null && v > 0 ? v.toFixed(3) : "\u2014"}</td>`;
  } },
  { id: "resume", header: "R\xE9sum\xE9", title: "Quality of wins / losses, opponent-weighted", cell: (e) => `<td class="${e.resume >= 0 ? "positive" : "negative"}">${e.resume >= 0 ? "+" : ""}${e.resume.toFixed(2)}</td>` }
];
function renderStandings(embed = false) {
  var _a;
  _sosCache = null;
  const school = getPlayerSchool();
  const myConf = school == null ? void 0 : school.conf;
  if (!standingsConf) standingsConf = myConf;
  if (!nationalDiv) nationalDiv = (school == null ? void 0 : school.division) || "D1";
  const confs = [...new Set((((_a = state.world) == null ? void 0 : _a.schools) || []).map((s) => s.conf))].sort();
  return `
  <div class="view-standings">
    <div class="view-header${embed ? " embed-subtabs" : ""}">
      ${embed ? "" : `<div>
        <h1 class="view-title">Standings</h1>
        <div class="view-subtitle">Season ${state.season}</div>
      </div>`}
      <div class="rec-tabs">
        <button class="rec-tab${standingsMode === "conference" ? " active" : ""}" data-smode="conference">Conference</button>
        <button class="rec-tab${standingsMode === "national" ? " active" : ""}" data-smode="national">National</button>
      </div>
    </div>

    ${standingsMode === "conference" ? `
      <div class="conf-div-groups">
        ${(() => {
    var _a2, _b, _c;
    const byDiv = {};
    for (const c of confs) {
      const d = ((_c = (_b = (_a2 = state.world) == null ? void 0 : _a2.conferences) == null ? void 0 : _b[c]) == null ? void 0 : _c.division) || "D3";
      (byDiv[d] = byDiv[d] || []).push(c);
    }
    const myDiv = school == null ? void 0 : school.division;
    const order = ["D1", "D2", "D3"].filter((d) => byDiv[d]);
    return order.map((d) => `
            <div class="conf-div-group">
              <span class="conf-div-label${d === myDiv ? " mine" : ""}">${d}</span>
              <div class="conf-picker-row">
                ${byDiv[d].map((c) => {
      var _a3, _b2;
      const info = ((_b2 = (_a3 = state.world) == null ? void 0 : _a3.conferences) == null ? void 0 : _b2[c]) || {};
      const isUser = c === myConf;
      return `<button class="conf-pick-btn${standingsConf === c ? " active" : ""}${isUser ? " user-conf-btn" : ""}"
                                  data-sconf="${c}">${escapeHtml(info.short || c)}${isUser ? " \u25B6" : ""}</button>`;
    }).join("")}
              </div>
            </div>`).join("");
  })()}
      </div>
      <div class="standings-layout">
        ${renderConferenceTable(standingsConf, school)}
      </div>
    ` : `
      <div class="conf-picker-row">
        ${["D1", "D2", "D3"].map((d) => {
    const isUser = d === (school == null ? void 0 : school.division);
    return `<button class="conf-pick-btn${nationalDiv === d ? " active" : ""}${isUser ? " user-conf-btn" : ""}"
                          data-ndiv="${d}">${d}${isUser ? " \u25B6" : ""}</button>`;
  }).join("")}
      </div>
      <div class="standings-layout">
        ${renderNationalTable(nationalDiv, school)}
      </div>
    `}
  </div>
`;
}
function renderConferenceTable(conf, mySchool) {
  var _a, _b, _c;
  const confInfo = ((_b = (_a = state.world) == null ? void 0 : _a.conferences) == null ? void 0 : _b[conf]) || { name: conf };
  const schools = (((_c = state.world) == null ? void 0 : _c.schools) || []).filter((s) => s.conf === conf).sort(
    (a, b) => {
      var _a2, _b2, _c2, _d;
      return b.record.confWins - a.record.confWins || b.record.wins - a.record.wins || (((_a2 = b.stats) == null ? void 0 : _a2.pointsFor) - ((_b2 = b.stats) == null ? void 0 : _b2.pointsAgainst) || 0) - (((_c2 = a.stats) == null ? void 0 : _c2.pointsFor) - ((_d = a.stats) == null ? void 0 : _d.pointsAgainst) || 0);
    }
  );
  const cols = getOrder("standings-conf", CONF_COLS);
  return `
  <div class="card standings-card">
    <div class="card-header">
      <span class="card-title">${escapeHtml(confInfo.name || conf)}</span>
      <span class="card-sub">${confInfo.division || "D-III"}</span>
    </div>
    <div class="table-scroll"><table class="data-table standings-table">
      <thead>
        <tr>
          <th>#</th>
          <th>School</th>
          ${cols.map((c) => `<th draggable="true" data-tbl="standings-conf" data-col="${c.id}" ${c.title ? `title="${c.title}"` : ""}>${c.header}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${schools.map((s, i) => {
    const isPlayer = s.id === (mySchool == null ? void 0 : mySchool.id);
    return `
            <tr class="${isPlayer ? "player-row" : ""}">
              <td class="rank-num">${i + 1}</td>
              <td class="school-name-cell">
                ${isPlayer ? '<span class="you-marker">\u25B6</span>' : ""}
                <span class="team-link" data-scout-team="${s.id}">${escapeHtml(s.name)}</span>
                <span class="team-nick muted">${escapeHtml(s.nick)}</span>
              </td>
              ${cols.map((c) => c.cell(s)).join("")}
            </tr>
          `;
  }).join("")}
      </tbody>
    </table></div>
  </div>
`;
}
function renderNationalTable(division, mySchool) {
  var _a;
  const poll = computeDivisionPoll(((_a = state.world) == null ? void 0 : _a.schools) || [], state.schedule || [], division);
  const top25 = poll.slice(0, 25);
  const cols = getOrder("standings-overall", OVERALL_COLS);
  const DIV_LABEL = { D1: "Division I", D2: "Division II", D3: "Division III" };
  const playerEntry = mySchool && mySchool.division === division ? poll.find((e) => e.school.id === mySchool.id) : null;
  const playerUnranked = playerEntry && playerEntry.rank > 25;
  return `
  <div class="card standings-card">
    <div class="card-header">
      <span class="card-title">${DIV_LABEL[division] || division} \u2014 National Poll</span>
      <span class="card-sub">Top 25</span>
    </div>
    <div class="table-scroll"><table class="data-table standings-table">
      <thead>
        <tr>
          <th>#</th><th>School</th>
          ${cols.map((c) => `<th draggable="true" data-tbl="standings-overall" data-col="${c.id}" ${c.title ? `title="${c.title}"` : ""}>${c.header}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${top25.map((e) => {
    const s = e.school;
    const isPlayer = s.id === (mySchool == null ? void 0 : mySchool.id);
    return `
            <tr class="${isPlayer ? "player-row" : ""}">
              <td class="rank-num poll-rank">${e.rank}</td>
              <td class="school-name-cell">
                ${isPlayer ? '<span class="you-marker">\u25B6</span>' : ""}
                <span class="team-link" data-scout-team="${s.id}"><span class="poll-rank-tag">#${e.rank}</span> ${escapeHtml(s.name)}</span>
                <span class="team-nick muted">${escapeHtml(s.nick)}</span>
              </td>
              ${cols.map((c) => c.cell(e)).join("")}
            </tr>
          `;
  }).join("")}
        ${playerUnranked ? `
          <tr class="poll-gap-row"><td colspan="${cols.length + 2}">\xB7 \xB7 \xB7</td></tr>
          <tr class="player-row">
            <td class="rank-num poll-rank">${playerEntry.rank}</td>
            <td class="school-name-cell">
              <span class="you-marker">\u25B6</span>
              <span class="team-link" data-scout-team="${playerEntry.school.id}">${escapeHtml(playerEntry.school.name)}</span>
              <span class="team-nick muted">${escapeHtml(playerEntry.school.nick)}</span>
            </td>
            ${cols.map((c) => c.cell(playerEntry)).join("")}
          </tr>
        ` : ""}
      </tbody>
    </table></div>
  </div>
`;
}
function calcStreak(schoolId) {
  const games = (state.schedule || []).filter((g) => (g.homeId === schoolId || g.awayId === schoolId) && g.result).sort((a, b) => b.day - a.day);
  if (games.length === 0) return "\u2014";
  const first = games[0];
  const won = first.result.winner === schoolId;
  let count = 1;
  for (let i = 1; i < games.length; i++) {
    if (games[i].result.winner === schoolId === won) count++;
    else break;
  }
  return `${won ? "W" : "L"}${count}`;
}
function setupListeners13() {
  document.querySelectorAll("[data-smode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      standingsMode = btn.dataset.smode;
      rerender();
    });
  });
  document.querySelectorAll("[data-sconf]").forEach((btn) => {
    btn.addEventListener("click", () => {
      standingsConf = btn.dataset.sconf;
      rerender();
    });
  });
  document.querySelectorAll("[data-ndiv]").forEach((btn) => {
    btn.addEventListener("click", () => {
      nationalDiv = btn.dataset.ndiv;
      rerender();
    });
  });
  setupDrag("standings-conf", CONF_COLS, rerender);
  setupDrag("standings-overall", OVERALL_COLS, rerender);
}

export { renderStandings, setupListeners13 };
