import { __spreadProps, __spreadValues } from '../../_spread.js';
import { C, POSITIONS } from '../../constants.js';
import { weekShort } from '../../engine/season.js';
import { getScoutSchool, navigate, navigateBack, rerender, state } from '../../state.js';
import { escapeHtml, fullName, ratingColor, renderCrest } from '../../utils.js';

var scoutTab = "ratings";
var scoutSortCol = "compositeRating";
var scoutSortDir = 1;
var scoutFilterPos = "";
var POS_ORDER2 = { QB: 0, WR: 1, TE: 2, RB: 3, OL: 4, DE: 5, DT: 6, OLB: 7, LB: 8, CB: 9, S: 10, K: 11, P: 12 };
var RATINGS_COLS = [
  { key: "F40", hdr: "40", cell: (p) => {
    var _a, _b;
    return `<td class="attr-cell">${(_b = (_a = p.measurables) == null ? void 0 : _a.forty) != null ? _b : "\u2014"}</td>`;
  } },
  { key: "SPD", hdr: "SPD", cell: (p) => `<td class="attr-cell ${ratingColor(p.attributes.SPD)}">${p.attributes.SPD}</td>` },
  { key: "AGI", hdr: "AGI", cell: (p) => `<td class="attr-cell ${ratingColor(p.attributes.AGI)}">${p.attributes.AGI}</td>` },
  { key: "PWR", hdr: "PWR", cell: (p) => `<td class="attr-cell ${ratingColor(p.attributes.PWR)}">${p.attributes.PWR}</td>` },
  { key: "STR", hdr: "STR", cell: (p) => `<td class="attr-cell ${ratingColor(p.attributes.STR)}">${p.attributes.STR}</td>` },
  { key: "JMP", hdr: "JMP", cell: (p) => `<td class="attr-cell ${ratingColor(p.attributes.JMP)}">${p.attributes.JMP}</td>` },
  { key: "HND", hdr: "HND", cell: (p) => `<td class="attr-cell ${ratingColor(p.attributes.HND)}">${p.attributes.HND}</td>` },
  { key: "SEC", hdr: "SEC", cell: (p) => `<td class="attr-cell ${ratingColor(p.attributes.SEC)}">${p.attributes.SEC}</td>` },
  { key: "TEC", hdr: "TEC", cell: (p) => `<td class="attr-cell ${ratingColor(p.attributes.TEC)}">${p.attributes.TEC}</td>` },
  { key: "AWR", hdr: "AWR", cell: (p) => `<td class="attr-cell ${ratingColor(p.attributes.AWR)}">${p.attributes.AWR}</td>` }
];
var sc = (key) => (p) => {
  var _a;
  const v = (_a = p.stats) == null ? void 0 : _a[key];
  return `<td class="attr-cell">${v ? v : "\u2014"}</td>`;
};
var STATS_GROUPS = [
  { label: "PASSING", cols: [
    { key: "passAtt", hdr: "ATT" },
    { key: "passComp", hdr: "CMP" },
    { key: "passYds", hdr: "YDS" },
    { key: "passTD", hdr: "TD" },
    { key: "passInt", hdr: "INT" }
  ] },
  { label: "RUSHING", cols: [
    { key: "rushAtt", hdr: "ATT" },
    { key: "rushYds", hdr: "YDS" },
    { key: "rushTD", hdr: "TD" }
  ] },
  { label: "RECEIVING", cols: [
    { key: "recComp", hdr: "REC" },
    { key: "recYds", hdr: "YDS" },
    { key: "recTD", hdr: "TD" }
  ] },
  { label: "DEFENSE", cols: [
    { key: "tackles", hdr: "TKL" },
    { key: "tacklesForLoss", hdr: "TFL" },
    { key: "sacks", hdr: "SCK" },
    { key: "ints", hdr: "INT" },
    { key: "passBreakups", hdr: "PBU" }
  ] }
];
var STATS_COLS = STATS_GROUPS.flatMap((g) => g.cols.map((c) => __spreadProps(__spreadValues({}, c), { cell: sc(c.key) })));
function sortRoster(roster) {
  const CY = { FR: 0, SO: 1, JR: 2, SR: 3 };
  return [...roster].sort((a, b) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
    let diff = 0;
    if (scoutSortCol === "name") {
      diff = scoutSortDir * `${((_a = a.name) == null ? void 0 : _a.last) || ""}${((_b = a.name) == null ? void 0 : _b.first) || ""}`.localeCompare(`${((_c = b.name) == null ? void 0 : _c.last) || ""}${((_d = b.name) == null ? void 0 : _d.first) || ""}`);
    } else if (scoutSortCol === "position") {
      diff = scoutSortDir * (((_e = POS_ORDER2[a.position]) != null ? _e : 99) - ((_f = POS_ORDER2[b.position]) != null ? _f : 99));
    } else if (scoutSortCol === "classYear") {
      diff = scoutSortDir * (((_g = CY[b.classYear]) != null ? _g : 0) - ((_h = CY[a.classYear]) != null ? _h : 0));
    } else if (scoutSortCol === "compositeRating") {
      diff = scoutSortDir * ((b.compositeRating || 0) - (a.compositeRating || 0));
    } else if (scoutSortCol in (a.attributes || {})) {
      diff = scoutSortDir * ((b.attributes[scoutSortCol] || 0) - (a.attributes[scoutSortCol] || 0));
    } else {
      diff = scoutSortDir * ((((_i = b.stats) == null ? void 0 : _i[scoutSortCol]) || 0) - (((_j = a.stats) == null ? void 0 : _j[scoutSortCol]) || 0));
    }
    if (diff !== 0) return diff;
    const pg = ((_k = POS_ORDER2[a.position]) != null ? _k : 99) - ((_l = POS_ORDER2[b.position]) != null ? _l : 99);
    if (pg !== 0) return pg;
    return (b.compositeRating || 0) - (a.compositeRating || 0);
  });
}
function renderTable(roster) {
  const filtered = roster.filter((p) => !scoutFilterPos || p.position === scoutFilterPos);
  const sorted = sortRoster(filtered);
  if (scoutTab === "ratings") {
    const sorted_s = scoutSortCol;
    return `<table class="data-table scout-table">
    <thead><tr>
      <th class="sortable${sorted_s === "position" ? " sorted" : ""}" data-scout-sort="position">POS</th>
      <th class="sortable${sorted_s === "name" ? " sorted" : ""}" data-scout-sort="name">NAME</th>
      <th class="sortable${sorted_s === "classYear" ? " sorted" : ""}" data-scout-sort="classYear">YR</th>
      <th class="sortable${sorted_s === "compositeRating" ? " sorted" : ""}" data-scout-sort="compositeRating">OVR</th>
      ${RATINGS_COLS.map((c) => `<th class="sortable attr-col${sorted_s === c.key ? " sorted" : ""}" data-scout-sort="${c.key}">${c.hdr}</th>`).join("")}
    </tr></thead>
    <tbody>
      ${sorted.map((p) => {
      const ovr = Math.round(p.compositeRating);
      return `<tr>
          <td><span class="pos-chip pos-${p.position}">${p.position}</span></td>
          <td class="player-name-cell"><span class="player-name player-link" data-pcard="${p.id}">${escapeHtml(fullName(p))}</span></td>
          <td><span class="class-badge class-${p.classYear.toLowerCase()}">${p.classYear}</span></td>
          <td><span class="rating-chip rating-${ratingColor(ovr)}">${ovr}</span></td>
          ${RATINGS_COLS.map((c) => c.cell(p)).join("")}
        </tr>`;
    }).join("")}
      ${sorted.length === 0 ? `<tr><td colspan="${4 + RATINGS_COLS.length}" class="empty-state">No players</td></tr>` : ""}
    </tbody>
  </table>`;
  }
  const s = scoutSortCol;
  return `<table class="data-table scout-table scout-stats-table">
  <thead>
    <tr>
      <th colspan="3"></th>
      ${STATS_GROUPS.map((g) => `<th colspan="${g.cols.length}" class="stat-group-hdr">${g.label}</th>`).join("")}
    </tr>
    <tr>
      <th class="sortable${s === "position" ? " sorted" : ""}" data-scout-sort="position">POS</th>
      <th class="sortable${s === "name" ? " sorted" : ""}" data-scout-sort="name">NAME</th>
      <th class="sortable${s === "classYear" ? " sorted" : ""}" data-scout-sort="classYear">YR</th>
      ${STATS_COLS.map((c) => `<th class="sortable attr-col${s === c.key ? " sorted" : ""}" data-scout-sort="${c.key}">${c.hdr}</th>`).join("")}
    </tr>
  </thead>
  <tbody>
    ${sorted.map((p) => `<tr>
      <td><span class="pos-chip pos-${p.position}">${p.position}</span></td>
      <td class="player-name-cell"><span class="player-name player-link" data-pcard="${p.id}">${escapeHtml(fullName(p))}</span></td>
      <td><span class="class-badge class-${p.classYear.toLowerCase()}">${p.classYear}</span></td>
      ${STATS_COLS.map((c) => c.cell(p)).join("")}
    </tr>`).join("")}
    ${sorted.length === 0 ? `<tr><td colspan="${3 + STATS_COLS.length}" class="empty-state">No players</td></tr>` : ""}
  </tbody>
</table>`;
}
function renderScheduleTab(school) {
  const games = (state.schedule || []).filter((g) => g.homeId === school.id || g.awayId === school.id).sort((a, b) => a.day - b.day);
  if (games.length === 0) return '<div class="empty-state" style="padding:20px">No games scheduled.</div>';
  return `
  <table class="data-table scout-schedule-table">
    <thead>
      <tr><th>WK</th><th></th><th>OPPONENT</th><th>RESULT</th></tr>
    </thead>
    <tbody>
      ${games.map((g) => {
    var _a, _b;
    const isHome = g.homeId === school.id;
    const oppId = isHome ? g.awayId : g.homeId;
    const opp = state.world.schools.find((s) => s.id === oppId);
    const r = g.result;
    let resultHtml = '<span class="sched-tbd">\u2014</span>';
    if (r) {
      const myScore = isHome ? r.homeScore : r.awayScore;
      const oppScore = isHome ? r.awayScore : r.homeScore;
      const won = r.winner === school.id;
      resultHtml = `<span class="${won ? "sched-w" : "sched-l"}">${won ? "W" : "L"} ${myScore}\u2013${oppScore}</span>`;
    }
    return `
          <tr>
            <td class="sched-day">${weekShort(g.day)}</td>
            <td class="sched-ha">${isHome ? "vs" : "@"}</td>
            <td class="sched-opp">
              <span class="team-link" data-scout-team="${oppId}">${escapeHtml((opp == null ? void 0 : opp.name) || "Unknown")}</span>
              <span class="sched-opp-rec">(${((_a = opp == null ? void 0 : opp.record) == null ? void 0 : _a.wins) || 0}\u2013${((_b = opp == null ? void 0 : opp.record) == null ? void 0 : _b.losses) || 0})</span>
            </td>
            <td class="sched-result">${resultHtml}</td>
          </tr>`;
  }).join("")}
    </tbody>
  </table>
`;
}
function renderProgramPanel(school) {
  var _a, _b;
  const lore = school.lore || {};
  const riv = school.rival;
  const fac = school.facilities || {};
  const oc = (_a = school.staff) == null ? void 0 : _a.oc, dc = (_b = school.staff) == null ? void 0 : _b.dc;
  const at = lore.allTime;
  const natties = lore.titles || [];
  const confTitles = lore.confTitles || [];
  const pips = (v) => "\u25AE".repeat(Math.min(v || 0, 5)) + "\u25AF".repeat(Math.max(0, 5 - (v || 0)));
  const yearsNote = (ys) => ys.length ? ` <span class="muted">(last ${Math.max(...ys)})</span>` : "";
  const rows = [];
  if (school.founded) rows.push(["Founded", `${school.founded} \xB7 ${escapeHtml(school.control || "")}${school.enrollment ? ` \xB7 ${school.enrollment.toLocaleString()} students` : ""}`]);
  if (school.stadium) rows.push(["Stadium", `${escapeHtml(school.stadium.name || "")} <span class="muted">(${(school.stadium.capacity || 0).toLocaleString()})</span>`]);
  if (lore.footballSince) rows.push(["Football since", `${lore.footballSince}${at ? ` \xB7 all-time ${at.wins}\u2013${at.losses}${at.ties ? `\u2013${at.ties}` : ""}` : ""}`]);
  rows.push(["Titles", `${natties.length} national${yearsNote(natties)} \xB7 ${confTitles.length} conference${yearsNote(confTitles)}${lore.postseasons ? ` \xB7 ${lore.postseasons} postseasons` : ""}`]);
  if (lore.legend) rows.push(["Legend", `${escapeHtml(lore.legend.name)} <span class="muted">(${lore.legend.from}\u2013${lore.legend.to})</span>`]);
  if (lore.tradition) rows.push(["Tradition", escapeHtml(lore.tradition)]);
  if (riv) rows.push(["Rival", `<span class="team-link" data-scout-team="${riv.schoolId}">${escapeHtml(riv.name)}</span> <span class="muted">\xB7 ${escapeHtml(riv.trophy || "the rivalry")} \xB7 ${riv.wins}\u2013${riv.losses}${riv.ties ? `\u2013${riv.ties}` : ""} since ${riv.since}${riv.holderId ? ` \xB7 ${riv.holderId === school.id ? "they hold it" : "rival holds it"}` : ""}</span>`]);
  const cName = (c) => {
    var _a2, _b2;
    return typeof (c == null ? void 0 : c.name) === "string" ? c.name : `${((_a2 = c == null ? void 0 : c.name) == null ? void 0 : _a2.first) || ""} ${((_b2 = c == null ? void 0 : c.name) == null ? void 0 : _b2.last) || ""}`.trim() || "?";
  };
  if (oc || dc) rows.push(["Staff", [oc && `OC ${escapeHtml(cName(oc))}`, dc && `DC ${escapeHtml(cName(dc))}`].filter(Boolean).join(" \xB7 ")]);
  return `
  <div class="scout-program card">
    <div class="detail-title">PROGRAM</div>
    <div class="scout-info-grid">
      ${rows.map(([k, v]) => `<div class="si-row"><span class="si-key">${k}</span><span class="si-val">${v}</span></div>`).join("")}
    </div>
    ${Object.keys(fac).length ? `
      <div class="scout-facilities">
        ${["stadium", "training", "recruiting", "medicine"].map((k) => `
          <div class="fac-item"><span class="si-key">${k[0].toUpperCase() + k.slice(1)}</span><span class="fac-pips">${pips(fac[k])}</span></div>`).join("")}
      </div>` : ""}
  </div>
`;
}
function renderHistoryTab(school) {
  const hist = (school.seasonHistory || []).slice().reverse();
  if (!hist.length) {
    return '<div class="empty-state" style="padding:20px">No completed seasons yet \u2014 history starts once a season is played.</div>';
  }
  return `
  <table class="data-table scout-history-table">
    <thead><tr><th>SEASON</th><th>COACH</th><th>RECORD</th><th>CONF</th><th>RANK</th><th>CLASS</th><th>\u2605</th><th>RESULT</th></tr></thead>
    <tbody>
      ${hist.map((h) => {
    var _a;
    const coachCell = h.coach ? h.coachYou ? `<span class="hist-coach-you">${escapeHtml(h.coach)}</span>` : escapeHtml(h.coach) : '<span class="muted">\u2014</span>';
    return `
        <tr>
          <td class="sched-day">S${h.season}</td>
          <td class="hist-coach-cell">${coachCell}</td>
          <td>${h.w}\u2013${h.l} <span class="muted">(${h.cw}\u2013${h.cl})</span></td>
          <td class="muted">${escapeHtml(h.conf || "")}${h.confChamp ? ' <span class="hist-conf-champ" title="Conference champion">\u{1F3C6}</span>' : ""}</td>
          <td>${h.rank != null ? `#${h.rank}` : '<span class="muted">\u2014</span>'}</td>
          <td class="muted">${h.classRank != null ? `#${h.classRank}` : "\u2014"}</td>
          <td class="muted">${(_a = h.prestige) != null ? _a : "\u2014"}</td>
          <td>${h.post ? `<span class="${h.post === "National Champion" ? "hist-natty" : ""}">${escapeHtml(h.post)}</span>` : '<span class="muted">\u2014</span>'}</td>
        </tr>`;
  }).join("")}
    </tbody>
  </table>
`;
}
function renderScout() {
  var _a;
  const school = getScoutSchool();
  if (!school) return '<div class="empty-state">No team selected.</div>';
  const st = school.stats || {};
  const g = Math.max(st.games || 0, 1);
  const rec = school.record || { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
  const cap = ((_a = C.PRESTIGE_MAX) == null ? void 0 : _a[school.division]) || 5;
  const filledStars = Math.max(0, Math.min(Math.round(school.prestige || 0), cap));
  const stars = "\u2605".repeat(filledStars) + "\u2606".repeat(cap - filledStars);
  const accent = school.colors && school.colors[0] || "var(--green)";
  const roster = school.roster || [];
  const lead = (key) => roster.filter((p) => {
    var _a2;
    return (_a2 = p.stats) == null ? void 0 : _a2[key];
  }).sort((a, b) => (b.stats[key] || 0) - (a.stats[key] || 0))[0];
  const passer = lead("passYds"), rusher = lead("rushYds"), receiver = lead("recYds");
  const tackler = lead("tackles"), sacker = lead("sacks");
  const nm = (p) => p ? `<span class="player-link" data-pcard="${p.id}">${escapeHtml(`${p.name.first[0]}. ${p.name.last}`)}</span>` : "\u2014";
  return `
  <div class="scout-wrap">
    <button class="btn-ghost btn-sm" id="scout-back">\u2190 Back</button>

    <div class="scout-card" style="border-left:4px solid ${accent}">
      <div class="scout-card-head">
        <div class="scout-identity">
          <div class="scout-crest">${renderCrest(school, 52)}</div>
          <div>
            <div class="scout-name">${escapeHtml(school.name)} <span class="scout-abbr-chip">${escapeHtml(school.abbr || "")}</span></div>
            <div class="scout-sub">${escapeHtml(school.division || "")} \xB7 ${escapeHtml(school.conf || "")} \xB7 ${stars}${school.city ? ` \xB7 ${escapeHtml(school.city)}, ${escapeHtml(school.state || "")}` : ""}</div>
          </div>
        </div>
        <div class="scout-record">${rec.wins}\u2013${rec.losses}<span class="scout-conf">${rec.confWins}\u2013${rec.confLosses} conf</span></div>
      </div>
      <div class="scout-teamstats">
        <div class="ts-item"><span>PPG</span>${(st.pointsFor / g).toFixed(1)}</div>
        <div class="ts-item"><span>PA/G</span>${(st.pointsAgainst / g).toFixed(1)}</div>
        <div class="ts-item"><span>Rush Y/G</span>${Math.round((st.rushYds || 0) / g)}</div>
        <div class="ts-item"><span>Pass Y/G</span>${Math.round((st.passYds || 0) / g)}</div>
        <div class="ts-item"><span>Sacks</span>${st.sacks || 0}</div>
        <div class="ts-item"><span>TO</span>${st.turnovers || 0}</div>
      </div>
    </div>

    ${renderProgramPanel(school)}

    <div class="scout-leaders">
      <div class="detail-title">KEY PLAYERS</div>
      <div class="leader-grid">
        <div class="leader"><span>Passing</span> ${nm(passer)} ${passer ? `(${passer.stats.passYds} yds)` : ""}</div>
        <div class="leader"><span>Rushing</span> ${nm(rusher)} ${rusher ? `(${rusher.stats.rushYds} yds)` : ""}</div>
        <div class="leader"><span>Receiving</span> ${nm(receiver)} ${receiver ? `(${receiver.stats.recYds} yds)` : ""}</div>
        <div class="leader"><span>Tackles</span> ${nm(tackler)} ${tackler ? `(${tackler.stats.tackles})` : ""}</div>
        <div class="leader"><span>Sacks</span> ${nm(sacker)} ${sacker ? `(${sacker.stats.sacks})` : ""}</div>
      </div>
    </div>

    <div class="scout-roster-section">
      <div class="scout-roster-header">
        <div class="detail-title" style="margin-bottom:0">${scoutTab === "schedule" ? "SCHEDULE" : scoutTab === "history" ? "SEASON HISTORY" : "ROSTER"}</div>
        <div class="scout-tabs">
          <button class="scout-tab${scoutTab === "ratings" ? " active" : ""}" data-scout-tab="ratings">Ratings</button>
          <button class="scout-tab${scoutTab === "stats" ? " active" : ""}" data-scout-tab="stats">Stats</button>
          <button class="scout-tab${scoutTab === "schedule" ? " active" : ""}" data-scout-tab="schedule">Schedule</button>
          <button class="scout-tab${scoutTab === "history" ? " active" : ""}" data-scout-tab="history">History</button>
        </div>
      </div>
      ${scoutTab === "ratings" || scoutTab === "stats" ? `
      <div class="filter-chips">
        <button class="filter-chip${!scoutFilterPos ? " active" : ""}" data-scout-filter="">ALL</button>
        ${POSITIONS.map((p) => `<button class="filter-chip${scoutFilterPos === p ? " active" : ""}" data-scout-filter="${p}">${p}</button>`).join("")}
      </div>` : ""}
      <div class="scout-table-scroll">
        ${scoutTab === "schedule" ? renderScheduleTab(school) : scoutTab === "history" ? renderHistoryTab(school) : renderTable(roster)}
      </div>
    </div>
  </div>
`;
}
function setupListeners8() {
  var _a;
  (_a = document.getElementById("scout-back")) == null ? void 0 : _a.addEventListener("click", () => {
    if ((state.ui.navHistory || []).length) navigateBack();
    else navigate("schedule");
  });
  document.querySelectorAll("[data-scout-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      scoutTab = btn.dataset.scoutTab;
      scoutSortCol = scoutTab === "ratings" ? "compositeRating" : "tackles";
      scoutSortDir = 1;
      rerender();
    });
  });
  document.querySelectorAll("[data-scout-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      scoutFilterPos = btn.dataset.scoutFilter;
      rerender();
    });
  });
  document.querySelectorAll("[data-scout-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const col = th.dataset.scoutSort;
      if (scoutSortCol === col) scoutSortDir *= -1;
      else {
        scoutSortCol = col;
        scoutSortDir = -1;
      }
      rerender();
    });
  });
}

export { renderScout, setupListeners8 };
