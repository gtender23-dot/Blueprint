import { weekShort } from '../../engine/season.js';
import { getPlayerSchool, rerender, state } from '../../state.js';
import { getOrder, setupDrag } from '../colOrder.js';
import { escapeHtml, fmtRecord, fullName } from '../../utils.js';

var statsTab = "team";
var leadersDiv = null;
var leadersSubTab = "offense";
var playerSubTab = "offense";
var leagueConf = null;
var leagueDiv = null;
var RATINGS_COLS2 = [
  { id: "SPD", header: "SPD", cell: (p) => `<td>${p.attributes.SPD}</td>`, sortVal: (p) => p.attributes.SPD },
  { id: "PWR", header: "PWR", cell: (p) => `<td>${p.attributes.PWR}</td>`, sortVal: (p) => p.attributes.PWR },
  { id: "STR", header: "STR", cell: (p) => `<td>${p.attributes.STR}</td>`, sortVal: (p) => p.attributes.STR },
  { id: "JMP", header: "JMP", cell: (p) => `<td>${p.attributes.JMP}</td>`, sortVal: (p) => p.attributes.JMP },
  { id: "SEC", header: "SEC", cell: (p) => `<td>${p.attributes.SEC}</td>`, sortVal: (p) => p.attributes.SEC },
  { id: "TEC", header: "TEC", cell: (p) => `<td>${p.attributes.TEC}</td>`, sortVal: (p) => p.attributes.TEC },
  { id: "AWR", header: "AWR", cell: (p) => `<td>${p.attributes.AWR}</td>`, sortVal: (p) => p.attributes.AWR },
  { id: "Pot", header: "Pot", title: "Potential", cell: (p) => `<td>${p.potentialRevealed ? { "average": "C", "good": "B", "great": "A", "sky": "S" }[p.potentialBand] || "?" : "?"}</td>`, sortVal: (p) => p.potentialRevealed ? { "average": 1, "good": 2, "great": 3, "sky": 4 }[p.potentialBand] || 0 : -1 }
];
var OFFENSE_COLS = [
  { id: "catt", header: "C/ATT", title: "Completions/Attempts", cell: (p) => `<td>${p.stats.passAtt > 0 ? (p.stats.passComp || 0) + "/" + (p.stats.passAtt || 0) : "\u2014"}</td>`, sortVal: (p) => p.stats.passAtt || 0 },
  { id: "pyds", header: "PYds", title: "Pass yards", cell: (p) => `<td>${p.stats.passYds || 0}</td>`, sortVal: (p) => p.stats.passYds || 0 },
  { id: "ptd", header: "PTD", title: "Pass TD", cell: (p) => `<td>${p.stats.passTD || 0}</td>`, sortVal: (p) => p.stats.passTD || 0 },
  { id: "pint", header: "INT", title: "Interceptions thrown", cell: (p) => `<td>${p.stats.passInt || 0}</td>`, sortVal: (p) => p.stats.passInt || 0 },
  { id: "ratt", header: "Att", title: "Rush attempts", cell: (p) => `<td>${p.stats.rushAtt || 0}</td>`, sortVal: (p) => p.stats.rushAtt || 0 },
  { id: "ryds", header: "RYds", title: "Rush yards", cell: (p) => `<td>${p.stats.rushYds || 0}</td>`, sortVal: (p) => p.stats.rushYds || 0 },
  { id: "ypc", header: "YPC", title: "Yards per carry", cell: (p) => `<td>${p.stats.rushAtt > 0 ? (p.stats.rushYds / p.stats.rushAtt).toFixed(1) : "\u2014"}</td>`, sortVal: (p) => p.stats.rushAtt > 0 ? p.stats.rushYds / p.stats.rushAtt : -1 },
  { id: "btk", header: "BTK", title: "Broken tackles", cell: (p) => `<td>${p.stats.brokenTackles || 0}</td>`, sortVal: (p) => p.stats.brokenTackles || 0 },
  { id: "rtd", header: "RTD", title: "Rush TD", cell: (p) => `<td>${p.stats.rushTD || 0}</td>`, sortVal: (p) => p.stats.rushTD || 0 },
  { id: "tgt", header: "Tgt", title: "Targets", cell: (p) => `<td>${p.stats.targets || 0}</td>`, sortVal: (p) => p.stats.targets || 0 },
  { id: "rec", header: "Rec", title: "Receptions", cell: (p) => `<td>${p.stats.recComp || 0}</td>`, sortVal: (p) => p.stats.recComp || 0 },
  { id: "rcyds", header: "RcYds", title: "Receiving yards", cell: (p) => `<td>${p.stats.recYds || 0}</td>`, sortVal: (p) => p.stats.recYds || 0 },
  { id: "ctd", header: "CTD", title: "Contested catches (made/tgt)", cell: (p) => `<td>${p.stats.contestedRec || 0}/${p.stats.contestedTgt || 0}</td>`, sortVal: (p) => p.stats.contestedRec || 0 },
  { id: "rctd", header: "RcTD", title: "Receiving TD", cell: (p) => `<td>${p.stats.recTD || 0}</td>`, sortVal: (p) => p.stats.recTD || 0 }
];
var DEFENSE_COLS = [
  { id: "solo", header: "SOLO", title: "Solo tackles", cell: (p) => `<td>${p.stats.solo || 0}</td>`, sortVal: (p) => p.stats.solo || 0 },
  { id: "ast", header: "AST", title: "Assisted tackles", cell: (p) => `<td>${p.stats.assists || 0}</td>`, sortVal: (p) => p.stats.assists || 0 },
  { id: "tot", header: "TOT", title: "Total tackles (SOLO + 0.5\xD7AST)", cell: (p) => `<td>${((p.stats.solo || 0) + 0.5 * (p.stats.assists || 0)).toFixed(1)}</td>`, sortVal: (p) => (p.stats.solo || 0) + 0.5 * (p.stats.assists || 0) },
  { id: "tfl", header: "TFL", title: "Tackles for loss", cell: (p) => `<td>${p.stats.tacklesForLoss || 0}</td>`, sortVal: (p) => p.stats.tacklesForLoss || 0 },
  { id: "sck", header: "SCK", title: "Sacks", cell: (p) => `<td>${p.stats.sacks || 0}</td>`, sortVal: (p) => p.stats.sacks || 0 },
  { id: "pres", header: "PRES", title: "Pressures (sacks + hurries)", cell: (p) => `<td>${p.stats.pressures || 0}</td>`, sortVal: (p) => p.stats.pressures || 0 },
  { id: "int", header: "INT", title: "Interceptions", cell: (p) => `<td>${p.stats.ints || 0}</td>`, sortVal: (p) => p.stats.ints || 0 },
  { id: "pbu", header: "PBU", title: "Pass breakups", cell: (p) => `<td>${p.stats.passBreakups || 0}</td>`, sortVal: (p) => p.stats.passBreakups || 0 },
  { id: "ff", header: "FF", title: "Forced fumbles", cell: (p) => `<td>${p.stats.forcedFumbles || 0}</td>`, sortVal: (p) => p.stats.forcedFumbles || 0 }
];
var ST_COLS = [
  { id: "fg", header: "FG", title: "Field goals made/attempted", cell: (p) => `<td>${(p.stats.fgAtt || 0) > 0 ? (p.stats.fgMade || 0) + "/" + (p.stats.fgAtt || 0) : "\u2014"}</td>`, sortVal: (p) => p.stats.fgMade || 0 },
  { id: "fgpct", header: "FG%", title: "Field goal percentage", cell: (p) => `<td>${(p.stats.fgAtt || 0) > 0 ? Math.round((p.stats.fgMade || 0) / p.stats.fgAtt * 100) + "%" : "\u2014"}</td>`, sortVal: (p) => (p.stats.fgAtt || 0) > 0 ? (p.stats.fgMade || 0) / p.stats.fgAtt : -1 },
  { id: "lng", header: "Lng", title: "Longest made field goal", cell: (p) => `<td>${p.stats.fgLong || "\u2014"}</td>`, sortVal: (p) => p.stats.fgLong || 0 },
  { id: "xp", header: "XP", title: "Extra points made/attempted", cell: (p) => `<td>${(p.stats.xpAtt || 0) > 0 ? (p.stats.xpMade || 0) + "/" + (p.stats.xpAtt || 0) : "\u2014"}</td>`, sortVal: (p) => p.stats.xpMade || 0 },
  { id: "pts", header: "Pts", title: "Kicking points", cell: (p) => `<td>${(p.stats.fgMade || 0) * 3 + (p.stats.xpMade || 0)}</td>`, sortVal: (p) => (p.stats.fgMade || 0) * 3 + (p.stats.xpMade || 0) },
  { id: "punts", header: "Punts", title: "Punts", cell: (p) => `<td>${p.stats.puntNo || 0}</td>`, sortVal: (p) => p.stats.puntNo || 0 },
  { id: "pavg", header: "Avg", title: "Punting average", cell: (p) => `<td>${(p.stats.puntNo || 0) > 0 ? ((p.stats.puntYds || 0) / p.stats.puntNo).toFixed(1) : "\u2014"}</td>`, sortVal: (p) => (p.stats.puntNo || 0) > 0 ? (p.stats.puntYds || 0) / p.stats.puntNo : -1 },
  { id: "ret", header: "Ret", title: "Punt returns", cell: (p) => `<td>${p.stats.retNo || 0}</td>`, sortVal: (p) => p.stats.retNo || 0 },
  { id: "retyds", header: "RetYds", title: "Return yards", cell: (p) => `<td>${p.stats.retYds || 0}</td>`, sortVal: (p) => p.stats.retYds || 0 },
  { id: "rettd", header: "RetTD", title: "Return touchdowns", cell: (p) => `<td>${p.stats.retTD || 0}</td>`, sortVal: (p) => p.stats.retTD || 0 }
];
var LEAGUE_COLS = [
  { id: "record", header: "Record", cell: (s) => `<td>${fmtRecord(s.record.wins, s.record.losses)}</td>`, sortVal: (s) => (s.record.wins || 0) - (s.record.losses || 0) },
  { id: "ppg", header: "PPG", cell: (s) => {
    var _a;
    const g = ((_a = s.stats) == null ? void 0 : _a.games) || 0;
    return `<td>${g ? (s.stats.pointsFor / g).toFixed(1) : "\u2014"}</td>`;
  }, sortVal: (s) => {
    var _a;
    const g = ((_a = s.stats) == null ? void 0 : _a.games) || 0;
    return g ? s.stats.pointsFor / g : -1;
  } },
  { id: "ypg", header: "YPG", cell: (s) => {
    var _a;
    const g = ((_a = s.stats) == null ? void 0 : _a.games) || 0;
    return `<td>${g ? ((s.stats.totalYds || 0) / g).toFixed(1) : "\u2014"}</td>`;
  }, sortVal: (s) => {
    var _a;
    const g = ((_a = s.stats) == null ? void 0 : _a.games) || 0;
    return g ? (s.stats.totalYds || 0) / g : -1;
  } },
  { id: "rypg", header: "Rush YPG", cell: (s) => {
    var _a;
    const g = ((_a = s.stats) == null ? void 0 : _a.games) || 0;
    return `<td>${g ? ((s.stats.rushYds || 0) / g).toFixed(1) : "\u2014"}</td>`;
  }, sortVal: (s) => {
    var _a;
    const g = ((_a = s.stats) == null ? void 0 : _a.games) || 0;
    return g ? (s.stats.rushYds || 0) / g : -1;
  } },
  { id: "pypg", header: "Pass YPG", cell: (s) => {
    var _a;
    const g = ((_a = s.stats) == null ? void 0 : _a.games) || 0;
    return `<td>${g ? ((s.stats.passYds || 0) / g).toFixed(1) : "\u2014"}</td>`;
  }, sortVal: (s) => {
    var _a;
    const g = ((_a = s.stats) == null ? void 0 : _a.games) || 0;
    return g ? (s.stats.passYds || 0) / g : -1;
  } }
];
var statSort = {
  "stats-ratings": { col: "ovr", dir: -1 },
  "stats-offense": { col: "__yds", dir: -1 },
  // synthetic: total yards
  "stats-defense": { col: "__def", dir: -1 },
  // synthetic: impact score
  "stats-league": { col: "wins", dir: -1 },
  "stats-special": { col: "pts", dir: -1 },
  "leaders-special": { col: "pts", dir: -1 },
  "leaders-offense": { col: "__yds", dir: -1 },
  "leaders-defense": { col: "__def", dir: -1 }
};
function sortValue(tbl, key, row, cols) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
  if (key === "pos") return row.position || "";
  if (key === "name") return `${((_a = row.name) == null ? void 0 : _a.last) || ""} ${((_b = row.name) == null ? void 0 : _b.first) || ""}`;
  if (key === "yr") return (_c = { FR: 0, SO: 1, JR: 2, SR: 3 }[row.classYear]) != null ? _c : 0;
  if (key === "ovr") return row.compositeRating || 0;
  if (key === "g") return ((_d = row.stats) == null ? void 0 : _d.games) || 0;
  if (key === "wins") return (((_e = row.record) == null ? void 0 : _e.wins) || 0) - (((_f = row.record) == null ? void 0 : _f.losses) || 0);
  if (key === "school") return row._schoolName || row.name || "";
  if (key === "__yds") return (((_g = row.stats) == null ? void 0 : _g.rushYds) || 0) + (((_h = row.stats) == null ? void 0 : _h.recYds) || 0) + (((_i = row.stats) == null ? void 0 : _i.passYds) || 0);
  if (key === "__def") return (((_j = row.stats) == null ? void 0 : _j.tackles) || 0) + (((_k = row.stats) == null ? void 0 : _k.sacks) || 0) * 3 + (((_l = row.stats) == null ? void 0 : _l.ints) || 0) * 4;
  const col = cols.find((c) => c.id === key);
  return (col == null ? void 0 : col.sortVal) ? col.sortVal(row) : 0;
}
function applySort(tbl, rows, cols) {
  const s = statSort[tbl];
  if (!s) return rows;
  return [...rows].sort((a, b) => {
    const av = sortValue(tbl, s.col, a, cols);
    const bv = sortValue(tbl, s.col, b, cols);
    if (typeof av === "string" || typeof bv === "string") {
      return s.dir * String(av).localeCompare(String(bv));
    }
    return -s.dir * (bv - av);
  });
}
function sortTh(tbl, key, label, extra = "") {
  const s = statSort[tbl];
  const active = s && s.col === key;
  const arrow = active ? s.dir < 0 ? " \u25BE" : " \u25B4" : "";
  return `<th class="stat-sortable${active ? " sorted" : ""}" data-stbl="${tbl}" data-skey="${key}" ${extra}>${label}${arrow}</th>`;
}
function colTh(tbl, c) {
  const s = statSort[tbl];
  const active = s && s.col === c.id;
  const arrow = active ? s.dir < 0 ? " \u25BE" : " \u25B4" : "";
  return `<th draggable="true" data-tbl="${tbl}" data-col="${c.id}" class="stat-sortable col-reorder${active ? " sorted" : ""}" data-stbl="${tbl}" data-skey="${c.id}" ${c.title ? `title="${c.title}"` : ""}>${c.header}${arrow}</th>`;
}
function renderStats(embed = false) {
  const school = getPlayerSchool();
  return `
  <div class="view-stats">
    <div class="view-header${embed ? " embed-subtabs" : ""}">
      ${embed ? "" : `<div>
        <h1 class="view-title">Statistics</h1>
        <div class="view-subtitle">Season ${state.season}</div>
      </div>`}
      <div class="rec-tabs">
        <button class="rec-tab${statsTab === "team" ? " active" : ""}" data-stats-tab="team">Team</button>
        <button class="rec-tab${statsTab === "players" ? " active" : ""}" data-stats-tab="players">Players</button>
        <button class="rec-tab${statsTab === "leaders" ? " active" : ""}" data-stats-tab="leaders">Leaders</button>
        <button class="rec-tab${statsTab === "league" ? " active" : ""}" data-stats-tab="league">League</button>
      </div>
    </div>

    ${statsTab === "team" ? renderTeamStats(school) : ""}
    ${statsTab === "players" ? renderPlayerStats(school) : ""}
    ${statsTab === "leaders" ? renderLeagueLeaders() : ""}
    ${statsTab === "league" ? renderLeagueStats() : ""}
  </div>
`;
}
function renderTeamStats(school) {
  var _a, _b, _c, _d;
  const s = (school == null ? void 0 : school.stats) || {};
  const games = s.games || 0;
  const avg2 = (v) => games ? (v / games).toFixed(1) : "\u2014";
  return `
  <div class="stats-team">
    <div class="stats-grid-3">
      <div class="card stat-block">
        <div class="stat-block-title">SCORING</div>
        <div class="stat-row-lg"><span class="stat-num">${avg2(s.pointsFor)}</span><span class="stat-label-lg">PPG</span></div>
        <div class="stat-row-lg"><span class="stat-num negative">${avg2(s.pointsAgainst)}</span><span class="stat-label-lg">Opp PPG</span></div>
        <div class="stat-row-sm"><span>${s.pointsFor || 0} total PF</span><span>${s.pointsAgainst || 0} PA</span></div>
      </div>
      <div class="card stat-block">
        <div class="stat-block-title">RUSHING</div>
        <div class="stat-row-lg"><span class="stat-num">${avg2(s.rushYds)}</span><span class="stat-label-lg">Yds/G</span></div>
        <div class="stat-row-sm"><span>${s.rushYds || 0} total</span></div>
      </div>
      <div class="card stat-block">
        <div class="stat-block-title">PASSING</div>
        <div class="stat-row-lg"><span class="stat-num">${avg2(s.passYds)}</span><span class="stat-label-lg">Yds/G</span></div>
        <div class="stat-row-sm"><span>${s.passYds || 0} total</span></div>
      </div>
      <div class="card stat-block">
        <div class="stat-block-title">TOTAL OFFENSE</div>
        <div class="stat-row-lg"><span class="stat-num">${avg2(s.totalYds)}</span><span class="stat-label-lg">YPG</span></div>
      </div>
      <div class="card stat-block">
        <div class="stat-block-title">TURNOVERS</div>
        <div class="stat-row-lg"><span class="stat-num">${s.turnovers || 0}</span><span class="stat-label-lg">Total TOs</span></div>
      </div>
      <div class="card stat-block">
        <div class="stat-block-title">RECORD</div>
        <div class="stat-row-lg"><span class="stat-num">${fmtRecord(((_a = school == null ? void 0 : school.record) == null ? void 0 : _a.wins) || 0, ((_b = school == null ? void 0 : school.record) == null ? void 0 : _b.losses) || 0)}</span><span class="stat-label-lg">Overall</span></div>
        <div class="stat-row-sm">${fmtRecord(((_c = school == null ? void 0 : school.record) == null ? void 0 : _c.confWins) || 0, ((_d = school == null ? void 0 : school.record) == null ? void 0 : _d.confLosses) || 0)} Conference</div>
      </div>
    </div>

    ${games === 0 ? '<div class="card"><div class="empty-state">No games played yet this season</div></div>' : ""}

    <div class="card">
      <div class="card-header"><span class="card-title">GAME-BY-GAME</span></div>
      <div class="table-scroll"><table class="data-table">
        <thead><tr><th>Week</th><th>Opponent</th><th>Result</th><th>Score</th><th>Rush</th><th>Pass</th><th>Total</th></tr></thead>
        <tbody>
          ${getMyGames(school).map(({ game, result, isHome }) => {
    const oppId = isHome ? game.awayId : game.homeId;
    const opp = state.world.schools.find((s2) => s2.id === oppId);
    const won = result.winner === (school == null ? void 0 : school.id);
    const myScore = isHome ? result.homeScore : result.awayScore;
    const oppScore = isHome ? result.awayScore : result.homeScore;
    const mySt = isHome ? result.homeStats : result.awayStats;
    return `
              <tr>
                <td>${weekShort(game.day)}</td>
                <td>${isHome ? "vs" : "@"} <span class="team-link" data-scout-team="${oppId}">${escapeHtml((opp == null ? void 0 : opp.name) || "?")}</span></td>
                <td><span class="result-badge ${won ? "result-win" : "result-loss"}">${won ? "W" : "L"}</span></td>
                <td>${myScore} \u2013 ${oppScore}</td>
                <td>${(mySt == null ? void 0 : mySt.rushYds) || 0}</td>
                <td>${(mySt == null ? void 0 : mySt.passYds) || 0}</td>
                <td>${(mySt == null ? void 0 : mySt.totalYds) || 0}</td>
              </tr>
            `;
  }).join("")}
          ${getMyGames(school).length === 0 ? '<tr><td colspan="7" class="empty-state">No results yet</td></tr>' : ""}
        </tbody>
      </table></div>
    </div>
  </div>
`;
}
function renderPlayerStats(school) {
  const roster = (school == null ? void 0 : school.roster) || [];
  const subTabs = [
    { id: "offense", label: "Offense" },
    { id: "defense", label: "Defense" },
    { id: "special", label: "Special Teams" },
    { id: "ratings", label: "Ratings" }
  ];
  return `
  <div class="stats-players">
    <div class="rec-tabs" style="margin-bottom:12px">
      ${subTabs.map((t) => `
        <button class="rec-tab${playerSubTab === t.id ? " active" : ""}" data-player-sub="${t.id}">${t.label}</button>
      `).join("")}
    </div>
    ${playerSubTab === "ratings" ? renderRatingsTable(roster) : ""}
    ${playerSubTab === "offense" ? renderOffenseTable(roster) : ""}
    ${playerSubTab === "defense" ? renderDefenseTable(roster) : ""}
    ${playerSubTab === "special" ? renderSpecialTable(roster) : ""}
  </div>
`;
}
function renderRatingsTable(roster) {
  const cols = getOrder("stats-ratings", RATINGS_COLS2);
  const sorted = applySort("stats-ratings", roster, cols);
  return `
  <div class="card">
    <div class="card-header"><span class="card-title">PLAYER RATINGS</span></div>
    <div class="table-scroll"><table class="data-table">
      <thead>
        <tr>
          ${sortTh("stats-ratings", "pos", "Pos")}${sortTh("stats-ratings", "name", "Name")}${sortTh("stats-ratings", "yr", "Yr")}${sortTh("stats-ratings", "ovr", "OVR")}
          ${cols.map((c) => colTh("stats-ratings", c)).join("")}
        </tr>
      </thead>
      <tbody>
        ${sorted.map((p) => `
          <tr>
            <td><span class="pos-chip pos-${p.position}">${p.position}</span></td>
            <td><span class="player-link" data-pcard="${p.id}">${escapeHtml(fullName(p))}</span></td>
            <td><span class="class-badge class-${p.classYear.toLowerCase()}">${p.classYear}</span></td>
            <td><strong>${Math.round(p.compositeRating)}</strong></td>
            ${cols.map((c) => c.cell(p)).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table></div>
  </div>
`;
}
function renderOffenseTable(roster) {
  const OFF_POS = ["QB", "RB", "WR", "TE"];
  const cols = getOrder("stats-offense", OFFENSE_COLS);
  const sorted = applySort("stats-offense", roster.filter((p) => OFF_POS.includes(p.position)), cols);
  return `
  <div class="card">
    <div class="card-header"><span class="card-title">OFFENSIVE STATS</span></div>
    <div class="table-scroll"><table class="data-table">
      <thead>
        <tr>
          ${sortTh("stats-offense", "pos", "Pos")}${sortTh("stats-offense", "name", "Name")}${sortTh("stats-offense", "yr", "Yr")}${sortTh("stats-offense", "g", "G")}
          ${cols.map((c) => colTh("stats-offense", c)).join("")}
        </tr>
      </thead>
      <tbody>
        ${sorted.map((p) => {
    const hasStats = (p.stats.passAtt || 0) + (p.stats.rushAtt || 0) + (p.stats.targets || 0) > 0;
    return `
            <tr class="${hasStats ? "" : "muted-row"}">
              <td><span class="pos-chip pos-${p.position}">${p.position}</span></td>
              <td><span class="player-link" data-pcard="${p.id}">${escapeHtml(fullName(p))}</span></td>
              <td><span class="class-badge class-${p.classYear.toLowerCase()}">${p.classYear}</span></td>
              <td>${p.stats.games || 0}</td>
              ${cols.map((c) => c.cell(p)).join("")}
            </tr>
          `;
  }).join("")}
        ${sorted.length === 0 ? `<tr><td colspan="${4 + cols.length}" class="empty-state">No offensive players found</td></tr>` : ""}
      </tbody>
    </table></div>
  </div>
`;
}
function renderSpecialTable(roster) {
  const pool = roster.filter((p) => ["K", "P"].includes(p.position) || (p.stats.retNo || 0) > 0);
  const cols = getOrder("stats-special", ST_COLS);
  const sorted = applySort("stats-special", pool, cols);
  return `
  <div class="card">
    <div class="card-header"><span class="card-title">SPECIAL TEAMS</span></div>
    <div class="table-scroll"><table class="data-table">
      <thead>
        <tr>
          ${sortTh("stats-special", "pos", "Pos")}${sortTh("stats-special", "name", "Name")}${sortTh("stats-special", "yr", "Yr")}${sortTh("stats-special", "g", "G")}
          ${cols.map((c) => colTh("stats-special", c)).join("")}
        </tr>
      </thead>
      <tbody>
        ${sorted.map((p) => {
    const hasStats = (p.stats.fgAtt || 0) + (p.stats.puntNo || 0) + (p.stats.retNo || 0) > 0;
    return `
            <tr class="${hasStats ? "" : "muted-row"}">
              <td><span class="pos-chip pos-${p.position}">${p.position}</span></td>
              <td><span class="player-link" data-pcard="${p.id}">${escapeHtml(fullName(p))}</span></td>
              <td><span class="class-badge class-${p.classYear.toLowerCase()}">${p.classYear}</span></td>
              <td>${p.stats.games || 0}</td>
              ${cols.map((c) => c.cell(p)).join("")}
            </tr>
          `;
  }).join("")}
        ${sorted.length === 0 ? `<tr><td colspan="${4 + cols.length}" class="empty-state">No specialists found</td></tr>` : ""}
      </tbody>
    </table></div>
  </div>
`;
}
function renderDefenseTable(roster) {
  const DEF_POS = ["DE", "DT", "OLB", "LB", "CB", "S"];
  const cols = getOrder("stats-defense", DEFENSE_COLS);
  const sorted = applySort("stats-defense", roster.filter((p) => DEF_POS.includes(p.position)), cols);
  return `
  <div class="card">
    <div class="card-header"><span class="card-title">DEFENSIVE STATS</span></div>
    <div class="table-scroll"><table class="data-table">
      <thead>
        <tr>
          ${sortTh("stats-defense", "pos", "Pos")}${sortTh("stats-defense", "name", "Name")}${sortTh("stats-defense", "yr", "Yr")}${sortTh("stats-defense", "g", "G")}
          ${cols.map((c) => colTh("stats-defense", c)).join("")}
        </tr>
      </thead>
      <tbody>
        ${sorted.map((p) => {
    const hasStats = (p.stats.tackles || 0) + (p.stats.sacks || 0) + (p.stats.ints || 0) > 0;
    return `
            <tr class="${hasStats ? "" : "muted-row"}">
              <td><span class="pos-chip pos-${p.position}">${p.position}</span></td>
              <td><span class="player-link" data-pcard="${p.id}">${escapeHtml(fullName(p))}</span></td>
              <td><span class="class-badge class-${p.classYear.toLowerCase()}">${p.classYear}</span></td>
              <td>${p.stats.games || 0}</td>
              ${cols.map((c) => c.cell(p)).join("")}
            </tr>
          `;
  }).join("")}
        ${sorted.length === 0 ? `<tr><td colspan="${4 + cols.length}" class="empty-state">No defensive players found</td></tr>` : ""}
      </tbody>
    </table></div>
  </div>
`;
}
function renderLeagueLeaders() {
  var _a;
  const mySchool = getPlayerSchool();
  const myDiv = (mySchool == null ? void 0 : mySchool.division) || "D1";
  const allSchools = ((_a = state.world) == null ? void 0 : _a.schools) || [];
  const divisions = [...new Set(allSchools.map((s) => s.division))].sort();
  if (leadersDiv == null) leadersDiv = myDiv;
  const pool = [];
  for (const s of allSchools) {
    if (s.division !== leadersDiv) continue;
    for (const p of s.roster) {
      if (p.stats && (p.stats.games || 0) > 0) {
        pool.push(Object.assign(Object.create(p), { _schoolName: s.name, _schoolId: s.id }));
      }
    }
  }
  const subTabs = [
    { id: "offense", label: "Offense" },
    { id: "defense", label: "Defense" },
    { id: "special", label: "Special Teams" }
  ];
  return `
  <div class="stats-leaders">
    <div class="conf-picker-row" style="margin-bottom:10px">
      ${divisions.map((d) => `<button class="conf-pick-btn${leadersDiv === d ? " active" : ""}${d === myDiv ? " user-conf-btn" : ""}" data-leaders-div="${d}">${d}${d === myDiv ? " \u25B6" : ""}</button>`).join("")}
    </div>
    <div class="rec-tabs" style="margin-bottom:12px">
      ${subTabs.map((t) => `<button class="rec-tab${leadersSubTab === t.id ? " active" : ""}" data-leaders-sub="${t.id}">${t.label}</button>`).join("")}
    </div>
    <div class="leaders-hint">${pool.length} players \xB7 ${escapeHtml(leadersDiv)} \xB7 tap any column to sort</div>
    ${renderLeadersTable(pool, leadersSubTab)}
  </div>
`;
}
function renderLeadersTable(pool, side) {
  const OFF_POS = ["QB", "RB", "WR", "TE"];
  const DEF_POS = ["DE", "DT", "OLB", "LB", "CB", "S"];
  const ST_POS = ["K", "P"];
  const positions = side === "offense" ? OFF_POS : side === "special" ? ST_POS : DEF_POS;
  const tbl = "leaders-" + side;
  const colDefs = side === "offense" ? OFFENSE_COLS : side === "special" ? ST_COLS : DEFENSE_COLS;
  const cols = getOrder(tbl, colDefs);
  const filtered = side === "special" ? pool.filter((p) => ST_POS.includes(p.position) || (p.stats.retNo || 0) > 0) : pool.filter((p) => positions.includes(p.position));
  const sorted = applySort(tbl, filtered, cols);
  const shown = sorted.slice(0, 100);
  return `
  <div class="card">
    <div class="card-header"><span class="card-title">${side === "offense" ? "OFFENSIVE" : side === "special" ? "SPECIAL TEAMS" : "DEFENSIVE"} LEADERS</span><span class="card-sub">top ${Math.min(100, shown.length)}</span></div>
    <div class="table-scroll"><table class="data-table">
      <thead>
        <tr>
          ${sortTh(tbl, "pos", "Pos")}${sortTh(tbl, "name", "Name")}${sortTh(tbl, "school", "School")}${sortTh(tbl, "g", "G")}
          ${cols.map((c) => colTh(tbl, c)).join("")}
        </tr>
      </thead>
      <tbody>
        ${shown.map((p) => `
          <tr>
            <td><span class="pos-chip pos-${p.position}">${p.position}</span></td>
            <td><span class="player-link" data-pcard="${p.id}">${escapeHtml(fullName(p))}</span></td>
            <td><span class="team-link" data-scout-team="${p._schoolId}">${escapeHtml(p._schoolName || "")}</span></td>
            <td>${p.stats.games || 0}</td>
            ${cols.map((c) => c.cell(p)).join("")}
          </tr>
        `).join("")}
        ${shown.length === 0 ? `<tr><td colspan="${4 + cols.length}" class="empty-state">No stats yet</td></tr>` : ""}
      </tbody>
    </table></div>
  </div>
`;
}
function renderLeagueStats() {
  var _a;
  const mySchool = getPlayerSchool();
  const allSchools = ((_a = state.world) == null ? void 0 : _a.schools) || [];
  const divisions = [...new Set(allSchools.map((s) => s.division))].sort();
  if (leagueDiv === null) leagueDiv = (mySchool == null ? void 0 : mySchool.division) || divisions[0] || "D1";
  if (leagueConf === null) leagueConf = (mySchool == null ? void 0 : mySchool.conf) || "";
  const divSchools = allSchools.filter((s) => s.division === leagueDiv);
  const confs = [...new Set(divSchools.map((s) => s.conf))].sort();
  if (leagueConf && !confs.includes(leagueConf)) leagueConf = "";
  const cols = getOrder("stats-league", LEAGUE_COLS);
  const schools = applySort("stats-league", divSchools.filter((s) => !leagueConf || s.conf === leagueConf), cols);
  return `
  <div class="stats-league">
    <div class="conf-picker-row" style="margin-bottom:8px">
      ${divisions.map((d) => `<button class="conf-pick-btn${leagueDiv === d ? " active" : ""}${d === (mySchool == null ? void 0 : mySchool.division) ? " user-conf-btn" : ""}" data-league-div="${d}">${d}${d === (mySchool == null ? void 0 : mySchool.division) ? " \u25B6" : ""}</button>`).join("")}
    </div>
    <div class="conf-picker-row" style="margin-bottom:12px">
      <button class="conf-pick-btn${leagueConf === "" ? " active" : ""}" data-lconf="">All ${escapeHtml(leagueDiv)}</button>
      ${confs.map((c) => {
    var _a2, _b;
    const info = ((_b = (_a2 = state.world) == null ? void 0 : _a2.conferences) == null ? void 0 : _b[c]) || {};
    const isUser = c === (mySchool == null ? void 0 : mySchool.conf);
    return `<button class="conf-pick-btn${leagueConf === c ? " active" : ""}${isUser ? " user-conf-btn" : ""}"
                        data-lconf="${c}">${escapeHtml(info.short || c)}${isUser ? " \u25B6" : ""}</button>`;
  }).join("")}
    </div>
    <div class="card">
      <div class="card-header">
        <span class="card-title">LEAGUE LEADERS</span>
        <span class="card-sub">${schools.length} teams</span>
      </div>
      <div class="table-scroll"><table class="data-table">
        <thead>
          <tr>
            <th>#</th>${sortTh("stats-league", "school", "School")}
            ${cols.map((c) => colTh("stats-league", c)).join("")}
          </tr>
        </thead>
        <tbody>
          ${schools.map((s, i) => {
    const isPlayer = s.id === (mySchool == null ? void 0 : mySchool.id);
    return `
              <tr class="${isPlayer ? "player-row" : ""}">
                <td class="rank-num">${i + 1}</td>
                <td>${isPlayer ? '<span class="you-marker">\u25B6</span>' : ""}<span class="team-link" data-scout-team="${s.id}">${escapeHtml(s.name)}</span></td>
                ${cols.map((c) => c.cell(s)).join("")}
              </tr>
            `;
  }).join("")}
        </tbody>
      </table></div>
    </div>
  </div>
`;
}
function getMyGames(school) {
  return (state.schedule || []).filter((g) => (g.homeId === (school == null ? void 0 : school.id) || g.awayId === (school == null ? void 0 : school.id)) && g.result).sort((a, b) => a.day - b.day).map((g) => ({
    game: g,
    result: g.result,
    isHome: g.homeId === (school == null ? void 0 : school.id)
  }));
}
function setupListeners14() {
  document.querySelectorAll("[data-stats-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      statsTab = btn.dataset.statsTab;
      rerender();
    });
  });
  document.querySelectorAll("[data-player-sub]").forEach((btn) => {
    btn.addEventListener("click", () => {
      playerSubTab = btn.dataset.playerSub;
      rerender();
    });
  });
  document.querySelectorAll("[data-lconf]").forEach((btn) => {
    btn.addEventListener("click", () => {
      leagueConf = btn.dataset.lconf;
      rerender();
    });
  });
  document.querySelectorAll("[data-league-div]").forEach((btn) => {
    btn.addEventListener("click", () => {
      leagueDiv = btn.dataset.leagueDiv;
      leagueConf = "";
      rerender();
    });
  });
  document.querySelectorAll("[data-leaders-div]").forEach((btn) => {
    btn.addEventListener("click", () => {
      leadersDiv = btn.dataset.leadersDiv;
      rerender();
    });
  });
  document.querySelectorAll("[data-leaders-sub]").forEach((btn) => {
    btn.addEventListener("click", () => {
      leadersSubTab = btn.dataset.leadersSub;
      rerender();
    });
  });
  document.querySelectorAll("[data-skey]").forEach((th) => {
    th.addEventListener("click", (e) => {
      if (th.classList.contains("col-dragging")) return;
      const tbl = th.dataset.stbl, key = th.dataset.skey;
      const s = statSort[tbl];
      if (!s) return;
      if (s.col === key) s.dir = -s.dir;
      else {
        s.col = key;
        s.dir = -1;
      }
      rerender();
    });
  });
  setupDrag("stats-ratings", RATINGS_COLS2, rerender);
  setupDrag("stats-offense", OFFENSE_COLS, rerender);
  setupDrag("stats-defense", DEFENSE_COLS, rerender);
  setupDrag("stats-league", LEAGUE_COLS, rerender);
  setupDrag("stats-special", ST_COLS, rerender);
  setupDrag("leaders-special", ST_COLS, rerender);
  setupDrag("leaders-offense", OFFENSE_COLS, rerender);
  setupDrag("leaders-defense", DEFENSE_COLS, rerender);
}

export { renderStats, setupListeners14 };
