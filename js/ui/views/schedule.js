import { rankMap } from '../../engine/rankings.js';
import { getPhase, weekShort } from '../../engine/season.js';
import { getPlayerSchool, rerender, state } from '../../state.js';
import { escapeHtml, fmtRecord } from '../../utils.js';

var _rankCache = null;
function prefixFor(school) {
  if (!school) return "";
  if (!_rankCache) _rankCache = {};
  if (!(school.division in _rankCache)) _rankCache[school.division] = rankMap(state, school.division);
  const r = _rankCache[school.division].get(school.id);
  return r ? `<span class="poll-rank-tag">#${r}</span> ` : "";
}
function renderSchedule(embed = false) {
  _rankCache = null;
  const school = getPlayerSchool();
  const myGames = (state.schedule || []).filter((g) => g.homeId === (school == null ? void 0 : school.id) || g.awayId === (school == null ? void 0 : school.id)).sort((a, b) => a.day - b.day);
  const wins = myGames.filter((g) => {
    var _a;
    return ((_a = g.result) == null ? void 0 : _a.winner) === (school == null ? void 0 : school.id);
  }).length;
  const losses = myGames.filter((g) => g.result && g.result.winner !== (school == null ? void 0 : school.id)).length;
  return `
  <div class="view-schedule">
    ${embed ? `<div class="view-subtitle group-subtitle">Season ${state.season} &middot; ${fmtRecord(wins, losses)}</div>` : `<div class="view-header">
      <div>
        <h1 class="view-title">Schedule</h1>
        <div class="view-subtitle">Season ${state.season} &middot; ${fmtRecord(wins, losses)}</div>
      </div>
    </div>`}

    <div class="schedule-list">
      ${myGames.length === 0 ? '<div class="card"><div class="empty-state">Schedule not yet generated</div></div>' : myGames.map((g) => renderGameCard(g, school)).join("")}
    </div>

    ${state.playoffs ? renderPlayoffSection(school) : ""}
  </div>
`;
}
function renderGameCard(game, school) {
  var _a, _b, _c, _d, _e;
  const isHome = game.homeId === (school == null ? void 0 : school.id);
  const oppId = isHome ? game.awayId : game.homeId;
  const opp = state.world.schools.find((s) => s.id === oppId);
  const played = !!game.result;
  const isCurrent = game.day === state.day;
  const phase = getPhase(game.day);
  const phaseLabel = { NONCONF: "Non-Conference", CONFERENCE: "Conference", CONFCHAMP: "Selection Week", PLAYOFFS: "Playoffs" }[phase] || "Game";
  let resultClass = "";
  let resultText = "";
  let myScore = "", oppScore = "";
  if (played) {
    const r = game.result;
    const won = r.winner === (school == null ? void 0 : school.id);
    resultClass = won ? "result-win" : "result-loss";
    myScore = isHome ? r.homeScore : r.awayScore;
    oppScore = isHome ? r.awayScore : r.homeScore;
    resultText = won ? "W" : "L";
  }
  return `
  <div class="game-card card ${resultClass}${isCurrent ? " game-current" : ""}">
    <div class="game-card-day">
      <div class="game-day-num">${weekShort(game.day)}</div>
      <div class="game-phase-label">${phaseLabel}</div>
      ${isCurrent ? '<div class="game-today-badge">TODAY</div>' : ""}
    </div>

    <div class="game-card-matchup">
      <div class="game-loc">${isHome ? "HOME" : "AWAY"}</div>
      <div class="game-teams">
        <span class="game-team my-team${school ? " team-link" : ""}"${school ? ` data-scout-team="${school.id}"` : ""}>${escapeHtml((school == null ? void 0 : school.name) || "")}</span>
        <span class="game-vs">${isHome ? "vs" : "@"}</span>
        <span class="game-team opp-team${opp ? " team-link" : ""}"${opp ? ` data-scout-team="${opp.id}"` : ""}>${prefixFor(opp)}${escapeHtml((opp == null ? void 0 : opp.name) || "TBD")}</span>
      </div>
      <div class="game-opp-record">${opp ? `Opponent record ${fmtRecord(((_a = opp == null ? void 0 : opp.record) == null ? void 0 : _a.wins) || 0, ((_b = opp == null ? void 0 : opp.record) == null ? void 0 : _b.losses) || 0)}` : ""}</div>
    </div>

    <div class="game-card-result">
      ${played ? `
        <div class="result-badge-large ${resultClass}">${resultText}</div>
        <div class="result-score-large">${myScore} \u2013 ${oppScore}</div>
        ${(isHome ? (_c = game.result) == null ? void 0 : _c.homeStats : (_d = game.result) == null ? void 0 : _d.awayStats) ? `
          <div class="result-stats-mini">
            Rush: ${isHome ? game.result.homeStats.rushYds : game.result.awayStats.rushYds}y \xB7
            Pass: ${isHome ? game.result.homeStats.passYds : game.result.awayStats.passYds}y
          </div>
        ` : ""}
        ${((_e = game.result) == null ? void 0 : _e.homeStats) ? `<button class="btn-ghost btn-sm view-boxscore-btn" data-game-id="${game.id}">Box Score</button>` : ""}
      ` : `
        <div class="upcoming-badge">UPCOMING</div>
      `}
    </div>
  </div>
`;
}
function renderPlayoffSection(school) {
  const bracket = state.playoffs;
  return `
  <div class="playoffs-section">
    <h2 class="section-title">PLAYOFFS</h2>
    ${bracket.rounds.map((round, i) => `
      <div class="playoff-round">
        <div class="round-label">Round ${i + 1}</div>
        ${round.games.map((g) => {
    var _a;
    const home = state.world.schools.find((s) => s.id === g.homeId);
    const away = state.world.schools.find((s) => s.id === g.awayId);
    const played = !!g.result;
    const isPlayer = g.homeId === (school == null ? void 0 : school.id) || g.awayId === (school == null ? void 0 : school.id);
    return `
            <div class="playoff-game card${isPlayer ? " player-game" : ""}">
              <div class="pg-home">${home ? `<span class="team-link" data-scout-team="${home.id}">${escapeHtml(home.name)}</span>` : "TBD"}</div>
              <div class="pg-score">${played ? `${g.result.homeScore} \u2013 ${g.result.awayScore}` : "vs"}</div>
              <div class="pg-away">${away ? `<span class="team-link" data-scout-team="${away.id}">${escapeHtml(away.name)}</span>` : "TBD"}</div>
              ${played ? `<div class="pg-winner"><span class="team-link" data-scout-team="${g.result.winner}">${escapeHtml(((_a = state.world.schools.find((s) => {
      var _a2;
      return s.id === ((_a2 = g.result) == null ? void 0 : _a2.winner);
    })) == null ? void 0 : _a.name) || "")}</span></div>` : ""}
            </div>
          `;
  }).join("")}
      </div>
    `).join("")}
  </div>
`;
}
function setupListeners11() {
  document.querySelectorAll(".view-boxscore-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const gameId = btn.dataset.gameId;
      const game = state.schedule.find((g) => g.id === gameId);
      if (game == null ? void 0 : game.result) {
        state.ui.lastGameResult = game.result;
        state.ui.showGameResult = true;
        rerender();
      }
    });
  });
}

export { renderSchedule, setupListeners11 };
