import { C, POSITIONS } from '../../constants.js';
import { schemeAdjustedOVR } from '../../engine/formations.js';
import { derivedArchetype } from '../../engine/player.js';
import { getPlayerSchool, navigate, rerender, state } from '../../state.js';
import { getOrder, setupDrag } from '../colOrder.js';
import { archetypeLabel, escapeHtml, fullName, ratingColor } from '../../utils.js';

function posLabel(pos) {
  return pos === "LB" ? "ILB" : pos;
}
var sortCol = "compositeRating";
var sortDir = 1;
var filterPos = "";
var filterClass = "";
var ROSTER_COLS = [
  { id: "SPD", header: "SPD", sortKey: "SPD", cell: (p) => `<td class="attr-cell ${ratingColor(p.attributes.SPD)}">${p.attributes.SPD}</td>` },
  { id: "AGI", header: "AGI", sortKey: "AGI", cell: (p) => `<td class="attr-cell ${ratingColor(p.attributes.AGI)}">${p.attributes.AGI}</td>` },
  { id: "PWR", header: "PWR", sortKey: "PWR", cell: (p) => `<td class="attr-cell ${ratingColor(p.attributes.PWR)}">${p.attributes.PWR}</td>` },
  { id: "STR", header: "STR", sortKey: "STR", cell: (p) => `<td class="attr-cell ${ratingColor(p.attributes.STR)}">${p.attributes.STR}</td>` },
  { id: "JMP", header: "JMP", sortKey: "JMP", cell: (p) => `<td class="attr-cell ${ratingColor(p.attributes.JMP)}">${p.attributes.JMP}</td>` },
  { id: "HND", header: "HND", sortKey: "HND", cell: (p) => `<td class="attr-cell ${ratingColor(p.attributes.HND)}">${p.attributes.HND}</td>` },
  { id: "SEC", header: "SEC", sortKey: "SEC", cell: (p) => `<td class="attr-cell ${ratingColor(p.attributes.SEC)}">${p.attributes.SEC}</td>` },
  { id: "TEC", header: "TEC", sortKey: "TEC", cell: (p) => `<td class="attr-cell ${ratingColor(p.attributes.TEC)}">${p.attributes.TEC}</td>` },
  { id: "AWR", header: "AWR", sortKey: "AWR", cell: (p) => `<td class="attr-cell ${ratingColor(p.attributes.AWR)}">${p.attributes.AWR}</td>` },
  { id: "CON", header: "CON", sortKey: "CON", cell: (p) => `<td class="attr-cell ${ratingColor(p.attributes.CON)}">${p.attributes.CON}</td>` },
  { id: "POT", header: "POT", sortKey: "potential", title: "Potential", cell: (p) => `<td><span class="pot-badge pot-${p.potentialBand}">${potBandChar(p)}</span></td>` },
  { id: "INJ", header: "INJ", sortKey: "injuryGamesOut", title: "Injury games out", cell: (p) => {
    var _a;
    return `<td>${p.injuryGamesOut > 0 ? `<span class="injury-badge inj-${((_a = p.injury) == null ? void 0 : _a.severity) || "moderate"}" title="${p.injury ? escapeHtml(p.injury.type + " \u2014 " + p.injury.severityLabel) : "Injured"}">${p.injuryGamesOut}g</span>` : "\u2014"}</td>`;
  } }
];
function renderRoster(embed = false) {
  const school = getPlayerSchool();
  const roster = (school == null ? void 0 : school.roster) || [];
  const orderedCols = getOrder("roster", ROSTER_COLS);
  const CLASS_ORDER = { FR: 0, SO: 1, JR: 2, SR: 3 };
  const filtered = roster.filter((p) => (!filterPos || p.position === filterPos) && (!filterClass || p.classYear === filterClass)).sort((a, b) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (sortCol === "name") {
      const an = `${((_a = a.name) == null ? void 0 : _a.last) || ""} ${((_b = a.name) == null ? void 0 : _b.first) || ""}`;
      const bn = `${((_c = b.name) == null ? void 0 : _c.last) || ""} ${((_d = b.name) == null ? void 0 : _d.first) || ""}`;
      return sortDir * an.localeCompare(bn);
    }
    if (sortCol === "classYear") {
      return sortDir * (((_e = CLASS_ORDER[b.classYear]) != null ? _e : 0) - ((_f = CLASS_ORDER[a.classYear]) != null ? _f : 0));
    }
    if (sortCol === "position") {
      return sortDir * (a.position || "").localeCompare(b.position || "");
    }
    if (sortCol === "archetype") {
      const aa = archetypeLabel(derivedArchetype(a)) || "";
      const ba = archetypeLabel(derivedArchetype(b)) || "";
      return sortDir * aa.localeCompare(ba);
    }
    if (sortCol === "potential") {
      const bandVal = (p) => p.potentialRevealed ? { average: 1, good: 2, great: 3, sky: 4 }[p.potentialBand] || 0 : -1;
      return sortDir * (bandVal(b) - bandVal(a));
    }
    const aVal = sortCol in a.attributes ? a.attributes[sortCol] : (_g = a[sortCol]) != null ? _g : 0;
    const bVal = sortCol in b.attributes ? b.attributes[sortCol] : (_h = b[sortCol]) != null ? _h : 0;
    return sortDir * (bVal - aVal);
  });
  return `
  <div class="view-roster">
    ${embed ? "" : `<div class="view-header">
      <div>
        <h1 class="view-title">Roster</h1>
        <div class="view-subtitle">${roster.length} / ${C.ROSTER_SIZE} Players</div>
      </div>
    </div>`}

    <div class="roster-controls">
      <div class="filter-group">
        <label class="filter-label">POSITION</label>
        <div class="filter-chips">
          <button class="filter-chip${!filterPos ? " active" : ""}" data-filter-pos="">ALL</button>
          ${POSITIONS.map((p) => `<button class="filter-chip${filterPos === p ? " active" : ""}" data-filter-pos="${p}">${posLabel(p)}</button>`).join("")}
        </div>
      </div>
      <div class="filter-group">
        <label class="filter-label">CLASS</label>
        <div class="filter-chips">
          ${["", "FR", "SO", "JR", "SR"].map((c) => `<button class="filter-chip${filterClass === c ? " active" : ""}" data-filter-class="${c}">${c || "ALL"}</button>`).join("")}
        </div>
      </div>
    </div>


    <div class="card">
      <div class="table-scroll"><table class="data-table roster-table">
        <thead>
          <tr>
            <th class="sortable${sortCol === "position" ? " sorted" : ""}" data-sort="position">POS</th>
            <th class="sortable${sortCol === "name" ? " sorted" : ""}" data-sort="name">NAME</th>
            <th class="sortable${sortCol === "classYear" ? " sorted" : ""}" data-sort="classYear">YR</th>
            <th class="sortable${sortCol === "compositeRating" ? " sorted" : ""}" data-sort="compositeRating">OVR</th>
            <th class="sortable${sortCol === "archetype" ? " sorted" : ""}" data-sort="archetype" title="Player archetype (drives scheme fit)">ARCH</th>
            ${orderedCols.map((col) => `
              <th draggable="true" data-tbl="roster" data-col="${col.id}"
                  class="${col.sortKey ? `sortable attr-col${sortCol === col.sortKey ? " sorted" : ""}` : ""} col-reorder"
                  ${col.sortKey ? `data-sort="${col.sortKey}"` : ""}
                  ${col.title ? `title="${col.title}"` : ""}>
                ${col.header}
              </th>
            `).join("")}
          </tr>
        </thead>
        <tbody>
          ${(() => {
    var _a;
    const frontId = ((_a = school == null ? void 0 : school.gameplan) == null ? void 0 : _a.defBaseFront) || "4-3";
    return filtered.map((p) => renderPlayerRow(p, orderedCols, frontId)).join("");
  })()}
          ${filtered.length === 0 ? `<tr><td colspan="${5 + orderedCols.length}" class="empty-state">No players match filter</td></tr>` : ""}
        </tbody>
      </table></div>
    </div>
  </div>
`;
}
function renderPlayerRow(p, orderedCols, frontId) {
  const rawOvr = Math.round(p.compositeRating);
  const ovr = schemeAdjustedOVR(p, frontId);
  const diff = ovr - rawOvr;
  const schemeCls = Math.abs(diff) >= 2 ? diff > 0 ? " scheme-up" : " scheme-dn" : "";
  const schemeTtl = Math.abs(diff) >= 2 ? ` title="Scheme fit: ${frontId}"` : "";
  return `
  <tr class="player-row${p.injuryGamesOut > 0 ? " injured" : ""}" data-player-id="${p.id}">
    <td class="pos-cell">
      <span class="pos-chip pos-${p.position}">${posLabel(p.position)}</span>
    </td>
    <td class="player-name-cell">
      <span class="player-name">${escapeHtml(fullName(p))}</span>
      ${p.redshirted ? '<span class="rs-badge">RS</span>' : ""}
    </td>
    <td><span class="class-badge class-${p.classYear.toLowerCase()}">${p.classYear}</span></td>
    <td><span class="rating-chip rating-${ratingColor(ovr)}${schemeCls}"${schemeTtl}>${ovr}</span></td>
    <td><span class="arch-tag">${archetypeLabel(derivedArchetype(p)) || "\u2014"}</span></td>
    ${orderedCols.map((col) => col.cell(p)).join("")}
  </tr>
`;
}
function potBandChar(p) {
  if (!p.potentialRevealed) return "?";
  return { average: "C", good: "B", great: "A", sky: "S" }[p.potentialBand] || "?";
}
function setupListeners7() {
  document.querySelectorAll("[data-filter-pos]").forEach((btn) => {
    btn.addEventListener("click", () => {
      filterPos = btn.dataset.filterPos;
      rerender();
    });
  });
  document.querySelectorAll("[data-filter-class]").forEach((btn) => {
    btn.addEventListener("click", () => {
      filterClass = btn.dataset.filterClass;
      rerender();
    });
  });
  document.querySelectorAll("[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const col = th.dataset.sort;
      if (sortCol === col) sortDir *= -1;
      else {
        sortCol = col;
        sortDir = 1;
      }
      rerender();
    });
  });
  document.querySelectorAll(".player-row").forEach((row) => {
    row.addEventListener("click", () => {
      state.ui.pcardId = row.dataset.playerId;
      rerender();
    });
  });
  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", () => navigate(el.dataset.nav));
  });
  setupDrag("roster", ROSTER_COLS, rerender);
}

export { renderRoster, setupListeners7 };
