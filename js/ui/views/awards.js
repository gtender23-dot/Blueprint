import { openSchool, rerender, state } from '../../state.js';
import { escapeHtml } from '../../utils.js';

var viewSeason = null;
var viewDiv = null;
var POS_ORDER = ["QB", "RB", "WR", "TE", "OL", "DE", "DT", "OLB", "LB", "CB", "S", "K", "P"];
var POS_LABEL = (p) => p === "LB" ? "ILB" : p;
function playerDivision() {
  var _a, _b;
  return ((_b = (_a = state.world) == null ? void 0 : _a.schools.find((s) => s.id === state.playerSchoolId)) == null ? void 0 : _b.division) || "D1";
}
function seasonsWithAwards() {
  const set = new Set((state.awardsLog || []).filter((a) => a.scope !== "weekly").map((a) => a.season));
  return [...set].sort((a, b) => b - a);
}
function isMine(a) {
  return a.schoolId === state.playerSchoolId;
}
function schoolAccent(schoolId) {
  var _a;
  const s = (_a = state.world) == null ? void 0 : _a.schools.find((x) => x.id === schoolId);
  return (s == null ? void 0 : s.colors) && s.colors[0] || "var(--gold)";
}
function ordinal2(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function renderBanquetBody(season) {
  const divisions = [...new Set((state.awardsLog || []).filter((a) => a.season === season && a.division).map((a) => a.division))].sort();
  if (viewDiv == null || !divisions.includes(viewDiv)) {
    viewDiv = divisions.includes(playerDivision()) ? playerDivision() : divisions[0] || playerDivision();
  }
  const log = (state.awardsLog || []).filter((a) => a.season === season && (a.division === viewDiv || a.division == null));
  const mvp = log.find((a) => a.category === "MVP");
  const divCoy = log.find((a) => a.category === "DivCOY");
  const allDiv = log.filter((a) => a.scope === "all-division");
  const confHonors = log.filter((a) => a.scope === "all-conf");
  const confCoys = log.filter((a) => a.category === "COY");
  const isPlayerDiv = viewDiv === playerDivision();
  const myHaul = log.filter((a) => isMine(a) && a.scope !== "weekly");
  return `
  ${divisions.length > 1 ? `
  <div class="banquet-div-tabs">
    ${divisions.map((d) => `<button class="banquet-div-tab${d === viewDiv ? " active" : ""}${d === playerDivision() ? " mine" : ""}" data-awards-div="${d}">${d}${d === playerDivision() ? " \u25B8" : ""}</button>`).join("")}
  </div>` : ""}

  <div class="banquet">
    ${renderSeasonStory(season)}
    ${renderHeadliners(mvp, divCoy)}
    ${renderAllDivisionTeam(allDiv)}
    ${renderConferenceHonors(confCoys, confHonors)}
    ${isPlayerDiv ? renderProgramHaul(myHaul, mvp, divCoy) : ""}
  </div>`;
}
function renderAwards(embed = false) {
  const seasons = seasonsWithAwards();
  if (seasons.length === 0) {
    return `
    <div class="view-awards">
      ${embed ? "" : `<div class="view-header"><h1 class="view-title">Season Awards</h1></div>`}
      <div class="banquet-empty">
        <div class="banquet-empty-mark">\u{1F3C6}</div>
        <p>The banquet hall is dark.</p>
        <p class="banquet-empty-sub">Finish a season to see who takes home the hardware.</p>
      </div>
    </div>`;
  }
  if (viewSeason == null || !seasons.includes(viewSeason)) viewSeason = seasons[0];
  return `
  <div class="view-awards">
    <div class="view-header${embed ? " embed-subtabs" : ""}">
      ${embed ? '<div class="view-subtitle group-subtitle">The ' + ordinal2(viewSeason) + "-Season Banquet</div>" : `<div>
        <h1 class="view-title">Season Awards</h1>
        <div class="view-subtitle">The ${ordinal2(viewSeason)}-Season Banquet</div>
      </div>`}
      <div class="banquet-controls">
        ${seasons.length > 1 ? `
          <select class="banquet-select" data-awards-season>
            ${seasons.map((s) => `<option value="${s}" ${s === viewSeason ? "selected" : ""}>Season ${s}</option>`).join("")}
          </select>` : ""}
      </div>
    </div>
    ${renderBanquetBody(viewSeason)}
  </div>`;
}
function renderSeasonStory(season) {
  const row = (state.coachHistory || []).filter((h) => h.type === "season" && h.season === season).pop();
  if (!(row == null ? void 0 : row.recap)) return "";
  return `
  <div class="banquet-section">
    <div class="banquet-section-head"><span class="banquet-eyebrow">The Season Story</span></div>
    <p class="season-story-text">${escapeHtml(row.recap)}</p>
  </div>`;
}
function renderHeadliners(mvp, divCoy) {
  return `
  <div class="banquet-headliners">
    ${trophyCard("Most Valuable Player", mvp, "mvp")}
    ${trophyCard("Coach of the Year", divCoy, "coy")}
  </div>`;
}
function trophyCard(title, award, kind) {
  if (!award) {
    return `<div class="trophy-card trophy-empty"><div class="trophy-title">${title}</div><div class="trophy-winner-name">\u2014</div></div>`;
  }
  const mine = isMine(award);
  const accent = mine ? schoolAccent(award.schoolId) : "var(--gold)";
  const whoHtml = award.playerName && award.playerId ? `<span class="player-link" data-pcard="${award.playerId}">${escapeHtml(award.playerName)}</span>` : escapeHtml(award.playerName || award.coachName || award.schoolName || "\u2014");
  const schHtml = award.schoolId ? `<span class="team-link" data-scout-team="${award.schoolId}">${escapeHtml(award.schoolName || "")}</span>` : escapeHtml(award.schoolName || "");
  const sub = award.playerName ? schHtml : award.coachName ? `Head Coach \xB7 ${schHtml}` : "Head Coach";
  const icon = kind === "coy" ? "\u{1F4CB}" : "\u{1F3C6}";
  return `
  <div class="trophy-card${mine ? " trophy-mine" : ""}" style="--accent:${accent}">
    ${mine ? '<div class="trophy-spotlight"></div>' : ""}
    <div class="trophy-icon">${icon}</div>
    <div class="trophy-title">${title}</div>
    <div class="trophy-winner">
      <div class="trophy-winner-name">${whoHtml}</div>
      <div class="trophy-winner-sub">${sub}</div>
    </div>
    ${mine ? `<div class="trophy-yours">${award.playerName ? "YOUR PLAYER" : "THAT\u2019S YOU"}</div>` : ""}
  </div>`;
}
function renderAllDivisionTeam(allDiv) {
  if (allDiv.length === 0) return "";
  const byPos = {};
  for (const a of allDiv) byPos[a.position] = a;
  const ordered = POS_ORDER.filter((p) => byPos[p]);
  return `
  <div class="banquet-section">
    <div class="banquet-section-head">
      <span class="banquet-eyebrow">First Team</span>
      <h2 class="banquet-section-title">All-${escapeHtml(viewDiv)}</h2>
    </div>
    <div class="alldiv-grid">
      ${ordered.map((p) => {
    const a = byPos[p];
    const mine = isMine(a);
    const accent = mine ? schoolAccent(a.schoolId) : "var(--gold)";
    return `
          <div class="alldiv-slot${mine ? " alldiv-mine" : ""}" style="--accent:${accent}">
            <div class="alldiv-pos">${POS_LABEL(p)}</div>
            <div class="alldiv-player">
              <div class="alldiv-name">${a.playerId && a.playerName ? `<span class="player-link" data-pcard="${a.playerId}">${escapeHtml(a.playerName)}</span>` : escapeHtml(a.playerName || "\u2014")}</div>
              <div class="alldiv-school">${a.schoolId ? `<span class="team-link" data-scout-team="${a.schoolId}">${escapeHtml(a.schoolName || "")}</span>` : escapeHtml(a.schoolName || "")}</div>
            </div>
            ${mine ? '<div class="alldiv-star">\u2605</div>' : ""}
          </div>`;
  }).join("")}
    </div>
  </div>`;
}
function renderConferenceHonors(confCoys, confHonors) {
  if (confCoys.length === 0 && confHonors.length === 0) return "";
  const byConf = {};
  for (const a of confHonors) {
    (byConf[a.group] = byConf[a.group] || []).push(a);
  }
  const coyByConf = {};
  for (const c of confCoys) coyByConf[c.conf] = c;
  const confs = [.../* @__PURE__ */ new Set([...Object.keys(byConf), ...Object.keys(coyByConf)])].sort();
  return `
  <div class="banquet-section">
    <div class="banquet-section-head">
      <span class="banquet-eyebrow">Around the League</span>
      <h2 class="banquet-section-title">Conference Honors</h2>
    </div>
    <div class="confhonors">
      ${confs.map((conf) => {
    const coy = coyByConf[conf];
    const honors = (byConf[conf] || []).filter((a) => isMine(a));
    const confName = confDisplay(conf);
    const mineCount = honors.length;
    return `
          <div class="confhonor-row">
            <div class="confhonor-name">${escapeHtml(confName)}</div>
            <div class="confhonor-detail">
              ${coy ? `<span class="confhonor-coy${isMine(coy) ? " mine" : ""}">COY: ${(() => {
      const schHtml = coy.schoolId ? `<span class="team-link" data-scout-team="${coy.schoolId}">${escapeHtml(coy.schoolName || "\u2014")}</span>` : escapeHtml(coy.schoolName || "\u2014");
      return coy.coachName ? `${escapeHtml(coy.coachName)} (${schHtml})` : schHtml;
    })()}</span>` : ""}
              ${mineCount ? `<span class="confhonor-mine">${mineCount} of your players honored</span>` : ""}
            </div>
          </div>`;
  }).join("")}
    </div>
  </div>`;
}
function confDisplay(confId) {
  var _a, _b;
  const info = (_b = (_a = state.world) == null ? void 0 : _a.conferences) == null ? void 0 : _b[confId];
  return (info == null ? void 0 : info.name) || (info == null ? void 0 : info.short) || confId;
}
function renderProgramHaul(myHaul, mvp, divCoy) {
  const gotMVP = mvp && isMine(mvp);
  const gotCOY = divCoy && isMine(divCoy);
  const allDivCount = myHaul.filter((a) => a.scope === "all-division").length;
  const allConfCount = myHaul.filter((a) => a.scope === "all-conf").length;
  const total = myHaul.length;
  if (total === 0) {
    return `
    <div class="banquet-section banquet-haul banquet-haul-empty">
      <div class="banquet-section-head"><span class="banquet-eyebrow">Your Program</span><h2 class="banquet-section-title">No Hardware This Year</h2></div>
      <p class="haul-empty-note">A quiet banquet. Build the roster, run it back.</p>
    </div>`;
  }
  return `
  <div class="banquet-section banquet-haul${gotMVP || gotCOY ? " banquet-haul-marquee" : ""}">
    <div class="banquet-section-head">
      <span class="banquet-eyebrow">Your Program</span>
      <h2 class="banquet-section-title">${gotMVP || gotCOY ? "A Night to Remember" : "The Trophy Case"}</h2>
    </div>
    <div class="haul-tally">
      ${gotMVP ? '<div class="haul-marquee">\u{1F3C6} Division MVP</div>' : ""}
      ${gotCOY ? '<div class="haul-marquee">\u{1F4CB} Coach of the Year</div>' : ""}
      <div class="haul-line"><span class="haul-num">${allDivCount}</span> All-Division selection${allDivCount === 1 ? "" : "s"}</div>
      <div class="haul-line"><span class="haul-num">${allConfCount}</span> All-Conference honor${allConfCount === 1 ? "" : "s"}</div>
      <div class="haul-total"><span class="haul-num">${total}</span> total awards</div>
    </div>
  </div>`;
}
function setupListeners4() {
  document.querySelectorAll("[data-awards-season]").forEach((sel) => {
    sel.addEventListener("change", () => {
      viewSeason = Number(sel.value);
      viewDiv = null;
      rerender();
    });
  });
  document.querySelectorAll("[data-awards-div]").forEach((btn) => {
    btn.addEventListener("click", () => {
      viewDiv = btn.dataset.awardsDiv;
      rerender();
    });
  });
  document.querySelectorAll(".view-awards [data-scout-team], .banquet [data-scout-team]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      openSchool(el.dataset.scoutTeam);
    });
  });
}

export { renderAwards, renderBanquetBody, setupListeners4 };
