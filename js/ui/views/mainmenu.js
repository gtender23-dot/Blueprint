import { __spreadProps, __spreadValues } from '../../_spread.js';
import { gradeFromXP } from '../../engine/coach.js';
import { DNA_AXES, MAX_COACHES, MAX_TREES, MAX_WORLDS, clearWorldSlot, coachDNA, createCoach, createTree, deleteCoach, deleteLibraryPlan, deleteSavedTeam, deleteTree, dnaBonus, dnaGrade, dnaGrades, dnaStarLabel, dnaStarTier, dnaTitle, dnaXpForNextGrade, getCoach, getTree, listCoaches, listSoloCoaches, listTrees, removeWorldClassicMeta, treeWorldKey, worldSlotKey } from '../../engine/coachprofile.js';
import { deleteSlotData, loadGame, saveGame } from '../../engine/persistence.js';
import { C } from '../../constants.js';
import { weekLabel } from '../../engine/season.js';
import { loadFromSlot, navigate, notify, refreshSaves, rerender, startInstantClassicReplay, state } from '../../state.js';
import { BLUEPRINT_MARK } from '../logo.js';
import { escapeHtml, fmtRecord } from '../../utils.js';

function buildId() {
  return typeof globalThis !== "undefined" && globalThis.__BUILD__ || "dev";
}
// ── Stale-build diagnosis (Aug 2026) ────────────────────────────────────────
// The id above is printed BY the bundle that is running, so on its own it can
// never reveal that a device is serving an old build: a stale build prints its
// own id and looks perfectly consistent. It is self-certifying, which is the
// one thing a staleness diagnostic must not be.
//
// The independent witness living on the device is the service worker's Cache
// Storage key — named for the build that INSTALLED it, not for the build
// currently executing. Read it once; if it disagrees with the running id, this
// device is mixing builds (fresh HTML off the network, older worker still
// active) and the footer says so. No key at all — file://, a first visit
// before the install finishes, any browser without a worker — means there is
// nothing to compare, so nothing is claimed. That asymmetry is deliberate:
// this can report a real mismatch, never a false alarm.
var CACHE_PREFIX = "cfb-dynasty-";
var _cacheWitness = null;
var _cacheProbed = false;
function probeCacheWitness() {
  if (_cacheProbed) return;
  _cacheProbed = true;
  let store = null;
  try {
    store = globalThis.caches;
  } catch (e) {
    return;
  }
  if (!store || !globalThis.isSecureContext) return;
  store.keys().then((keys) => {
    const ids = (keys || []).filter((k) => k.indexOf(CACHE_PREFIX) === 0).map((k) => k.slice(CACHE_PREFIX.length));
    // Report only the caches that are NOT this build's — an old worker still
    // holding the wheel, or a stale cache 'activate' failed to purge. This
    // build's own key present and alone is the healthy state.
    const others = ids.filter((id) => id !== buildId());
    if (!others.length) return;
    _cacheWitness = others.join(", ");
    rerender();
  }).catch(() => {
  });
}
function buildStampHtml() {
  probeCacheWitness();
  const w = _cacheWitness;
  const title = w ? `This device is mixing builds — the page is running ${buildId()} but the installed service worker still holds cache ${w}. Reload once and the new worker takes over.` : "Build ID of the code running right now. The service worker names its cache after the build that installed it — if the two ever disagree, a warning appears right here.";
  // When a stale worker is detected, show the ACTION in plain words (phones
  // can't hover the title). The hash stays in the tooltip for debugging.
  return `<span class="mm-build" title="${escapeHtml(title)}">build ${escapeHtml(buildId())}${w ? ` <span class="mm-build-stale" title="${escapeHtml(title)}">⚠ update ready — reload once</span>` : ""}</span>`;
}
function renderMainMenu() {
  const saves = state.ui.saves || [];
  const autoSave = saves.find((s) => s.slot === "auto");
  const seasonSave = saves.find((s) => s.slot === "season");
  const hasRecord = (autoSave == null ? void 0 : autoSave.record) && (autoSave.record.wins > 0 || autoSave.record.losses > 0);
  return `
  <div class="mainmenu-screen">
    <div class="mm-bg-grid"></div>

    <div class="mm-content">
      <div class="mm-logo">
        <div class="mm-logo-badge">${BLUEPRINT_MARK}</div>
        <h1 class="mm-title">BLUE<span class="mm-title-cfb">PRINT</span></h1>
        <p class="mm-subtitle">College Football Dynasty \xB7 D1 \xB7 D2 \xB7 D3</p>
      </div>

      ${mmTreeId ? renderTreeHome() : mmCoachId ? renderCoachHome() : renderCoachSelect(autoSave, seasonSave)}

      <div class="mm-footer">
        <span class="mm-version">320+ Schools \xB7 29 Conferences \xB7 3 Divisions \xB7 Fixed D1 \xB7 Procedural D2/D3</span>
        ${buildStampHtml()}
      </div>
    </div>

    ${renderLoadModal(saves)}
  </div>
`;
}
function renderTreeSelect() {
  const trees = listTrees();
  return `
    <div class="mm-section-label">YOUR DYNASTIES <span class="mm-tree-tag">one world \xB7 three chairs</span></div>
    ${trees.map((t) => {
    var _a;
    const armed = mmDeleteArmed === t.id;
    const slots = t.slots || {};
    const live = ["D1", "D2", "D3"].filter((d) => slots[d]);
    const banked = Object.values(((_a = t.dna) == null ? void 0 : _a.axes) || {}).reduce((s, v) => s + (v || 0), 0);
    return `
      <div class="mm-coach-row${armed ? " mm-coach-armed" : ""}">
        <button class="btn-mm-primary mm-coach-card" data-mm-tree="${escapeHtml(t.id)}">
          <span class="btn-mm-label">\u{1F333} ${escapeHtml(t.name)}</span>
          <span class="btn-mm-meta">${live.length ? live.map((d) => `${d} \xB7 ${escapeHtml(slots[d].schoolName || "?")}`).join("  |  ") : "no chairs filled yet"}</span>
          <span class="mm-w-career">${t.meta ? `Season ${t.meta.season} \xB7 ${live.length}/3 chairs` : "not started"}${banked ? ` \xB7 ${(t.ledger || []).length} retired, ${banked.toLocaleString()} XP banked` : ""}</span>
        </button>
        <button class="mm-coach-del${armed ? " armed" : ""}" data-mm-tree-del="${escapeHtml(t.id)}" aria-label="${armed ? "Confirm permanent delete of this tree" : "Delete tree"}" title="${armed ? "Tap again to permanently delete this tree, its world and every coach on it" : "Delete tree"}">${armed ? "Delete?" : "\u{1F5D1}"}</button>
      </div>`;
  }).join("")}
    ${trees.length < MAX_TREES ? mmNewTree ? `
      <div class="mm-newcoach">
        <input class="form-input" id="mm-nt-first" type="text" placeholder="First name" aria-label="Coach first name" maxlength="16" autocomplete="off" />
        <input class="form-input" id="mm-nt-last" type="text" placeholder="Last name" aria-label="Coach last name" maxlength="16" autocomplete="off" />
        <button class="btn-mm btn-mm-new" id="mm-nt-create">START →</button>
      </div>
      <p class="mm-tree-blurb">Your last name becomes the tree. You'll found a Division III program and build a coaching family from there.</p>` : `
      <button class="btn-mm btn-mm-new" id="btn-mm-newtree">+ START A DYNASTY</button>
      <p class="mm-tree-blurb">A tree is ONE world you never leave. Start at the bottom with one coach; grow branches by
      sending coordinators up, down and sideways, and play any of them — one per division. Retiring a coach banks
      his whole career into the tree for whoever comes next.</p>` : ""}`;
}
function renderCoachSelect(autoSave, seasonSave) {
  // [W9 \u00A712] The tree is now the ONLY start path. The legacy coach system
  // (YOUR COACHES list, per-coach worlds, new-coach creation, the legacy
  // autosave) is intentionally not rendered here \u2014 the code still exists and is
  // reachable programmatically, it just has no door on this screen. To bring it
  // back, restore the coach list / new-coach form / legacy-save button below.
  return `
  <div class="mm-actions">
    ${renderTreeSelect()}
    <div class="mm-section-label" style="margin-top:14px">EXHIBITION</div>
    <button class="btn-mm btn-mm-secondary" id="btn-mm-playnow">\u{1F3C8} PLAY NOW \u2014 coach or watch one game</button>
    ${seasonSave ? `<button class="btn-mm btn-mm-new" id="btn-mm-season-resume">\u21ba RESUME SEASON${seasonSave.school ? ` \u2014 ${escapeHtml(seasonSave.school)}${seasonSave.record ? ` \xB7 ${seasonSave.record.wins}-${seasonSave.record.losses}` : ""}` : ""}</button>` : ""}
    <button class="btn-mm btn-mm-secondary" id="btn-mm-season">\u{1F3C6} SEASON MODE \u2014 play one full season, your teams or ours</button>
    <button class="btn-mm btn-mm-secondary" id="btn-mm-creator">\u{1F6E0}\ufe0f THE WORKSHOP \u2014 build playbooks, plays, teams &amp; leagues</button>
    <button class="btn-mm-guide" id="btn-mm-guide">\u{1F4D6} The Manual</button>
  </div>`;
}
function renderCoachDna(c) {
  const dna = coachDNA(c.id) || { axes: {}, badges: [] };
  const grades = dnaGrades(c.id);
  const rows = Object.entries(DNA_AXES).map(([k, meta]) => {
    var _a;
    const xp = ((_a = dna.axes) == null ? void 0 : _a[k]) || 0;
    const g = grades[k] || 0;
    const tier = dnaStarTier(xp);
    const nextAt = dnaXpForNextGrade(g);
    const bonus = dnaBonus(k, g);
    return { k, meta, xp, g, tier, nextAt, bonus };
  }).sort((a, b) => b.tier - a.tier || b.xp - a.xp);
  return `
  <div class="mm-actions">
    <div class="mm-section-label">${escapeHtml(c.name.first.toUpperCase())} \u2014 DNA & BONUSES</div>
    <div class="mm-dna-title">${escapeHtml(dnaTitle(dna))} \xB7 ${(dna.badges || []).length} \u{1F3C5}</div>
    <p class="mm-hub-hint">Your identity forms from how you coach. Every star earns a permanent, live bonus \u2014 carried into every world. \u2605\u2605\u2605 and \u{1F48E} are earned, never inherited.</p>
    <div class="mm-dna-list">
      ${rows.map((r) => `
        <div class="mm-dna-item${r.tier === 0 ? " mm-dna-locked" : ""}">
          <div class="mm-dna-head">
            <span class="mm-dna-axis">${r.meta.icon} ${r.meta.label}</span>
            <span class="dna-grade-num">${r.tier ? dnaStarLabel(r.tier) : "\u2013"}</span>
          </div>
          <div class="mm-dna-meter">
            <span class="dna-bar"><span class="dna-bar-fill" style="width:${r.tier >= 4 ? 100 : Math.min(100, Math.round(r.xp / r.nextAt * 100))}%"></span></span>
            <span class="dna-xp-num">${r.tier >= 4 ? "MAX" : `${r.xp}/${r.nextAt}`}</span>
          </div>
          <div class="mm-dna-bonus${r.tier === 0 ? " muted" : ""}">${r.tier ? "\u25B8 " : ""}${escapeHtml(r.bonus.label)}</div>
        </div>`).join("")}
    </div>
    <button class="btn-mm btn-mm-secondary" data-mm-view="back" style="margin-top:12px">\u2190 Back</button>
  </div>`;
}
function renderCoachRecordBook(c) {
  const R = c.records || {};
  const career = R.career || {};
  const game = R.game || {};
  const season = R.season || {};
  const indiv = R.seasonIndiv || {};
  const team = R.seasonTeam || {};
  const dna = coachDNA(c.id) || { badges: [] };
  const ctxStr = (ctx2) => {
    if (!ctx2) return "";
    const bits = [];
    if (ctx2.school) bits.push(ctx2.school);
    if (ctx2.world) bits.push(`W${ctx2.world}`);
    if (ctx2.season != null) bits.push(`S${ctx2.season}`);
    return bits.length ? ` \u2014 ${escapeHtml(bits.join(" \xB7 "))}` : "";
  };
  const recRow = (label, rec, suffix = "") => rec && rec.v != null ? `
    <div class="mm-rec-row"><span class="mm-rec-lbl">${escapeHtml(label)}</span><span class="mm-rec-val">${rec.v}${suffix}<span class="mm-rec-ctx">${ctxStr(rec.ctx)}</span></span></div>` : "";
  const indivRow = (label, rec, suffix = "") => rec && rec.v != null ? `
    <div class="mm-rec-row"><span class="mm-rec-lbl">${escapeHtml(label)}</span><span class="mm-rec-val">${rec.v}${suffix}<span class="mm-rec-ctx">${rec.name ? ` \u2014 ${escapeHtml(rec.name)}${rec.pos ? ` (${escapeHtml(rec.pos)})` : ""}` : ""}${ctxStr(rec.ctx)}</span></span></div>` : "";
  const wins = c.careerWins || 0, losses = c.careerLosses || 0;
  const winPct = wins + losses > 0 ? (wins / (wins + losses)).toFixed(3).replace(/^0/, "") : "\u2014";
  const gameHtml = [
    recRow("Best passing game", game.passYds, " yds"),
    recRow("Best rushing game", game.rushYds, " yds"),
    recRow("Most sacks (game)", game.sacks),
    recRow("Most takeaways (game)", game.takeaways),
    recRow("Biggest win margin", game.margin, " pts")
  ].join("");
  const seasonHtml = [
    season.bestRecord ? `<div class="mm-rec-row"><span class="mm-rec-lbl">Best season record</span><span class="mm-rec-val">${season.bestRecord.v}${ctxStr(season.bestRecord.ctx)}</span></div>` : "",
    recRow("Longest win streak", season.longestStreak, " games"),
    season.bestRank && season.bestRank.v ? `<div class="mm-rec-row"><span class="mm-rec-lbl">Highest final ranking</span><span class="mm-rec-val">#${season.bestRank.v}${ctxStr(season.bestRank.ctx)}</span></div>` : ""
  ].join("");
  const indivHtml = [
    indivRow("Passing yards (season)", indiv.passYds, " yds"),
    indivRow("Rushing yards (season)", indiv.rushYds, " yds"),
    indivRow("Receiving yards (season)", indiv.recYds, " yds"),
    indivRow("Sacks (season)", indiv.sacks),
    indivRow("Interceptions (season)", indiv.ints)
  ].join("");
  const teamHtml = [
    recRow("Points scored (season)", team.pointsFor, " pts"),
    recRow("Total yards (season)", team.totalYds, " yds")
  ].join("");
  const badges = (dna.badges || []).slice().reverse();
  const badgeHtml = badges.length ? (() => {
    const bySeason = {};
    for (const b of badges) (bySeason[b.season] = bySeason[b.season] || []).push(b);
    return Object.keys(bySeason).sort((a, b) => b - a).map((s) => `
      <div class="dna-season-group">
        <div class="dna-season-hdr">SEASON ${s}</div>
        ${bySeason[s].map((b) => `<span class="dna-chip">\u{1F3C5} ${escapeHtml(b.label)}</span>`).join("")}
      </div>`).join("");
  })() : '<p class="mm-hub-hint">No milestones yet \u2014 they log here as you earn them.</p>';
  const section = (title, body, empty) => `
    <div class="mm-rec-section">
      <div class="mm-rec-hdr">${title}</div>
      ${body || `<p class="mm-hub-hint">${empty}</p>`}
    </div>`;
  return `
  <div class="mm-actions">
    <div class="mm-section-label">${escapeHtml(c.name.first.toUpperCase())} ${escapeHtml(c.name.last.toUpperCase())} \u2014 RECORD BOOK</div>
    <p class="mm-hub-hint">Career bests across every world you've coached.</p>
    ${section("CAREER TOTALS", `
      <div class="mm-rec-row"><span class="mm-rec-lbl">Record</span><span class="mm-rec-val">${wins}\u2013${losses} <span class="mm-rec-ctx">(${winPct})</span></span></div>
      ${career.confTitles ? `<div class="mm-rec-row"><span class="mm-rec-lbl">Conference titles</span><span class="mm-rec-val">${career.confTitles}</span></div>` : ""}
      <div class="mm-rec-row"><span class="mm-rec-lbl">National titles</span><span class="mm-rec-val">${c.titles || 0}</span></div>
      ${career.playoffApps ? `<div class="mm-rec-row"><span class="mm-rec-lbl">Playoff appearances</span><span class="mm-rec-val">${career.playoffApps}</span></div>` : ""}
      ${career.bowlWins != null || career.bowlLosses != null ? `<div class="mm-rec-row"><span class="mm-rec-lbl">Bowl record</span><span class="mm-rec-val">${career.bowlWins || 0}\u2013${career.bowlLosses || 0}</span></div>` : ""}
    `, "")}
    ${section("SINGLE-GAME RECORDS", gameHtml, "Play some games and your bests show up here.")}
    ${section("SEASON BESTS", seasonHtml, "Finish a season to set your marks.")}
    ${section("SINGLE-SEASON \u2014 INDIVIDUAL", indivHtml, "Your players' best statistical seasons will appear here.")}
    ${section("SINGLE-SEASON \u2014 TEAM", teamHtml, "Your best team seasons will appear here.")}
    ${section("MILESTONE LOG", badgeHtml, "")}
    <button class="btn-mm btn-mm-secondary" data-mm-view="back" style="margin-top:12px">\u2190 Back</button>
  </div>`;
}
function renderInstantClassics(c) {
  const classics = Object.entries(c.worlds || {}).flatMap(([worldSlot, world]) => (world.classics || []).map((item) => __spreadProps(__spreadValues({}, item), { worldSlot }))).sort((a, b) => (b.saved || 0) - (a.saved || 0));
  const body = classics.length ? classics.map(
    (item) => {
      var _a, _b;
      return '<div class="mm-classic-row"><button class="mm-classic-watch" data-mm-classic="' + escapeHtml(item.id) + '" data-mm-classic-world="' + escapeHtml(item.worldSlot) + '"><span class="mm-classic-score">\u2605 ' + (item.score || 0) + '</span><span class="mm-classic-matchup">' + escapeHtml(item.homeName || "Home") + " " + ((_a = item.homeScore) != null ? _a : 0) + "\u2013" + ((_b = item.awayScore) != null ? _b : 0) + " " + escapeHtml(item.awayName || "Away") + '</span><span class="mm-classic-meta">World ' + escapeHtml(item.worldSlot) + " \xB7 Season " + (item.season || 1) + " \xB7 " + escapeHtml(item.week || "") + ' \xB7 Watch replay</span></button><button class="btn-mm-del mm-classic-del" data-mm-classic-del="' + escapeHtml(item.id) + '" data-mm-classic-world="' + escapeHtml(item.worldSlot) + '" title="Delete replay" aria-label="Delete replay">\u2715</button></div>';
    }
  ).join("") : '<div class="mm-lib-empty muted">Close finishes, comebacks and overtime games are archived here automatically.</div>';
  return '<div class="mm-section-label" style="margin-top:14px">INSTANT CLASSICS</div><div class="mm-classics">' + body + "</div>";
}
function renderTreeHome() {
  var _a, _b;
  const t = getTree(mmTreeId);
  if (!t) {
    mmTreeId = null;
    return renderCoachSelect(null);
  }
  const slots = t.slots || {};
  const started = Object.keys(slots).length > 0 || !!t.meta;
  const banked = Object.entries(((_a = t.dna) == null ? void 0 : _a.axes) || {}).map(([k, xp]) => ({ k, xp, g: dnaGrade(xp), meta: DNA_AXES[k] })).filter((r) => r.meta && r.g > 0).sort((a, b) => b.g - a.g || b.xp - a.xp).slice(0, 4);
  const memory = ["D1", "D2", "D3"].map((d) => {
    var _a2;
    return { d, n: ((_a2 = t.memory) == null ? void 0 : _a2[d]) || 0 };
  }).filter((r) => r.n > 0);
  // The SHARED family DNA — the one pool every coach on the tree adds to (a
  // small trickle while working, his whole career at retirement) and every new
  // promoted coordinator inherits a share of. This is the tree's OWN DNA, NOT
  // any individual coach's — a coach's personal DNA lives in the Coach's Office.
  const sharedRows = Object.entries(((_b = t.dna) == null ? void 0 : _b.axes) || {}).map(([k, xp]) => ({ k, xp, g: dnaGrade(xp), meta: DNA_AXES[k] })).filter((r) => r.meta && r.xp > 0).sort((a, b) => b.xp - a.xp);
  const sharedTotal = sharedRows.reduce((s, r) => s + r.xp, 0);
  return `
  <div class="mm-actions">
    <div class="mm-section-label">\u{1F333} ${escapeHtml(t.name.toUpperCase())} — COACHING TREE</div>
    <p class="mm-hub-hint">${started ? `One world, ${t.meta ? `Season ${t.meta.season}` : "in progress"} — every chair below is the same league on the same week. Pick who you want to be, then load in.` : "Nothing planted yet. Every tree starts the same way: one coach, one job, the bottom of the sport."}</p>

    <div class="mm-section-label" style="margin-top:6px">THE CHAIRS</div>
    ${["D1", "D2", "D3"].map((div) => {
    var _a2;
    const s = slots[div];
    if (s) return `
        <div class="mm-world-row">
          <button class="btn-mm-primary mm-world-card${s.active ? " mm-tree-active" : ""}" data-mm-tree-slot="${div}">
            <span class="btn-mm-label">${s.active ? "▶ " : ""}${div} — ${escapeHtml(s.schoolName || "?")}</span>
            <span class="btn-mm-meta">Seated season ${(_a2 = s.seatedSeason) != null ? _a2 : "—"} \xB7 ${s.seasonsWorked || 0} season${(s.seasonsWorked || 0) === 1 ? "" : "s"} in the chair${s.active ? " \xB7 currently coaching" : ""}</span>
          </button>
        </div>`;
    if (!started && div === C.TREE.START_DIVISION) return mmNewTrunk ? `
        <div class="mm-newcoach">
          <input class="form-input" id="mm-tc-first" type="text" placeholder="First" aria-label="Coach first name" maxlength="16" autocomplete="off" />
          <input class="form-input" id="mm-tc-last" type="text" placeholder="Last" aria-label="Coach last name" maxlength="16" autocomplete="off" />
          <button class="btn-mm btn-mm-new" id="mm-tc-create">TAKE THE JOB</button>
        </div>` : `
        <button class="btn-mm btn-mm-new mm-world-empty" data-mm-tree-found="1">＋ ${div} — take your first job</button>`;
    return `
        <div class="mm-tree-empty muted">${div} — no coach. ${started ? "Fill it from inside the world: promote a coordinator, or apply one down." : "Opens once your first coach is working."}</div>`;
  }).join("")}

    <div class="mm-section-label" style="margin-top:14px">TREE DNA <span class="mm-tree-tag">the family identity</span></div>
    <p class="mm-hub-hint">The tree's shared identity — every coach adds a little to it while he works and his whole career when he retires. Every new coordinator you promote is born with a share of it. It never changes a working coach's own game; that's his, in the Coach's Office.</p>
    ${sharedRows.length ? `
      <div class="mm-library">
        ${sharedRows.map((r) => `<div class="mm-lib-row"><span>${r.meta.icon} ${escapeHtml(r.meta.label)}</span><span class="dna-grade-num">${dnaStarLabel(dnaStarTier(r.xp)) || "\u2013"} \xB7 ${r.xp.toLocaleString()} XP</span></div>`).join("")}
      </div>
      <p class="mm-hub-hint" style="margin-top:4px">${sharedTotal.toLocaleString()} XP banked across ${(t.ledger || []).length} retired coach${(t.ledger || []).length === 1 ? "" : "es"} and every season your coaches have worked.</p>` : `<div class="mm-lib-empty muted">Nothing banked yet. Coach some seasons — the family identity grows slowly, on purpose.</div>`}
    ${memory.length ? `
      <div class="mm-section-label" style="margin-top:14px">DIVISION MEMORY</div>
      <div class="mm-library">
        ${memory.map((r) => `<div class="mm-lib-row"><span>${r.d}</span><span class="muted">${r.n} season${r.n === 1 ? "" : "s"} worked</span></div>`).join("")}
      </div>` : ""}
    ${(t.ledger || []).length ? `
      <div class="mm-section-label" style="margin-top:14px">THE RETIRED</div>
      <div class="mm-library">
        ${(t.ledger || []).slice().reverse().map((r) => `<div class="mm-lib-row"><span>\u{1F396} ${escapeHtml(r.name)}</span><span class="muted">${escapeHtml(r.title || "")} \xB7 ${r.seasons || 0} yr</span></div>`).join("")}
      </div>` : ""}
    ${renderTreeClassics(t)}
    <button class="btn-mm btn-mm-secondary" id="mm-back-trees" style="margin-top:12px">← Back</button>
  </div>`;
}
// Instant Classics for a tree — read from the menu snapshot (t.meta.classics)
// so the screen lists them without opening the world save. Same replay button
// as the legacy path, but keyed to the tree's world slot.
function renderTreeClassics(t) {
  var _a;
  const classics = (((_a = t.meta) == null ? void 0 : _a.classics) || []).slice().sort((a, b) => (b.saved || 0) - (a.saved || 0));
  if (!classics.length) return "";
  const slot = treeWorldKey(t.id);
  const body = classics.map((item) => {
    var _a2, _b2;
    return '<div class="mm-classic-row"><button class="mm-classic-watch" data-mm-tree-classic="' + escapeHtml(item.id) + '" data-mm-tree-classic-slot="' + escapeHtml(slot) + '"><span class="mm-classic-score">★ ' + (item.score || 0) + '</span><span class="mm-classic-matchup">' + escapeHtml(item.homeName || "Home") + " " + ((_a2 = item.homeScore) != null ? _a2 : 0) + "–" + ((_b2 = item.awayScore) != null ? _b2 : 0) + " " + escapeHtml(item.awayName || "Away") + '</span><span class="mm-classic-meta">Season ' + (item.season || 1) + " \xB7 " + escapeHtml(item.week || "") + ' \xB7 Watch replay</span></button></div>';
  }).join("");
  return '<div class="mm-section-label" style="margin-top:14px">INSTANT CLASSICS</div><div class="mm-classics">' + body + "</div>";
}
function renderCoachHome() {
  var _a, _b, _c;
  const c = getCoach(mmCoachId);
  if (!c) {
    mmCoachId = null;
    mmView = null;
    return renderCoachSelect(null);
  }
  if (mmView === "dna") return renderCoachDna(c);
  if (mmView === "records") return renderCoachRecordBook(c);
  const slots = Array.from({ length: MAX_WORLDS }, (_, i) => i + 1);
  return `
  <div class="mm-actions">
    <div class="mm-section-label">COACH ${escapeHtml(c.name.first.toUpperCase())} ${escapeHtml(c.name.last.toUpperCase())}</div>
    <div class="mm-dna-title">${escapeHtml(dnaTitle(coachDNA(c.id)))} \xB7 ${(((_a = coachDNA(c.id)) == null ? void 0 : _a.badges) || []).length} \u{1F3C5}</div>
    <div class="mm-hub-btns">
      <button class="btn-mm btn-mm-hub" data-mm-view="dna">\u{1F9EC} DNA & Bonuses</button>
      <button class="btn-mm btn-mm-hub" data-mm-view="records">\u{1F4D6} Record Book</button>
    </div>
    <div class="mm-section-label" style="margin-top:12px">SELECT A WORLD</div>
    ${slots.map((n) => {
    var _a2, _b2, _c2;
    const wMeta = (_a2 = c.worlds) == null ? void 0 : _a2[n];
    return wMeta ? `
        <div class="mm-world-row">
          <button class="btn-mm-primary mm-world-card" data-mm-world="${n}">
            <span class="btn-mm-label">\u{1F30D} WORLD ${n} \u2014 ${escapeHtml(wMeta.school || "?")}${wMeta.division ? ` <span class="mm-w-div">${wMeta.division}</span>` : ""}${wMeta.prestige != null ? ` <span class="mm-w-star">${wMeta.prestige}\u2605</span>` : ""}</span>
            <span class="btn-mm-meta">Season ${wMeta.season}${wMeta.record ? ` \xB7 ${fmtRecord(wMeta.record.wins, wMeta.record.losses)}` : ""} \xB7 ${formatDate(wMeta.timestamp)}</span>
            ${wMeta.careerWins != null || wMeta.titles ? `
              <span class="mm-w-career">Career ${(_b2 = wMeta.careerWins) != null ? _b2 : 0}\u2013${(_c2 = wMeta.careerLosses) != null ? _c2 : 0}${wMeta.titles ? ` \xB7 ${wMeta.titles}\u{1F3C6}` : ""}${wMeta.jobSecurity != null ? ` \xB7 seat ${wMeta.jobSecurity}` : ""}</span>` : ""}
            ${wMeta.skills ? `<span class="mm-w-skills">${[["evaluator", "EVL"], ["recruiter", "REC"], ["developer", "DEV"], ["reputation", "REP"], ["roots", "ROO"]].map(([k, lbl]) => {
      var _a3;
      return `${lbl} ${gradeFromXP((_a3 = wMeta.skills[k]) != null ? _a3 : 0)}`;
    }).join(" \xB7 ")}</span>` : ""}
          </button>
          <button class="btn-mm-del" data-mm-world-del="${n}" title="Delete world" aria-label="Delete world ${n}">\u2715</button>
        </div>` : `
        <button class="btn-mm btn-mm-new mm-world-empty" data-mm-world-new="${n}">\uFF0B WORLD ${n} \u2014 start a new dynasty</button>`;
  }).join("")}
    ${renderInstantClassics(c)}
    <div class="mm-section-label" style="margin-top:14px">PLAYBOOK LIBRARY</div>
    <div class="mm-library">
      ${(((_b = c.plans) == null ? void 0 : _b.gameplans) || []).length || (((_c = c.plans) == null ? void 0 : _c.practice) || []).length ? `
        ${(c.plans.gameplans || []).map((p) => `<div class="mm-lib-row"><span>\u{1F4CB} ${escapeHtml(p.name)}</span><button class="btn-mm-del" data-mm-lib-del="gp:${escapeHtml(p.name)}">\u2715</button></div>`).join("")}
        ${(c.plans.practice || []).map((p) => `<div class="mm-lib-row"><span>\u{1F3CB} ${escapeHtml(p.name)}</span><button class="btn-mm-del" data-mm-lib-del="pp:${escapeHtml(p.name)}">\u2715</button></div>`).join("")}
      ` : '<div class="mm-lib-empty muted">Save game plans in-game \u2014 they follow this coach into every new world.</div>'}
    </div>
    <div class="mm-section-label" style="margin-top:14px">SAVED TEAMS \xB7 PLAY NOW</div>
    <div class="mm-library">
      ${(c.teams || []).length ? (c.teams || []).map((t) => `<div class="mm-lib-row"><span>\u{1F3C8} ${escapeHtml(t.name)}${t.season ? ` <small>\xB7 S${t.season}</small>` : ""}</span><button class="btn-mm-del" data-mm-team-del="${escapeHtml(t.id)}" title="Delete saved team" aria-label="Delete saved team ${escapeHtml(t.name)}">\u2715</button></div>`).join("") : '<div class="mm-lib-empty muted">Save your current roster and gameplan from the Game Plan screen, then load it in Play Now.</div>'}
    </div>
    <button class="btn-mm btn-mm-secondary" id="mm-back-coaches" style="margin-top:10px">\u2190 Coaches</button>
  </div>`;
}
function renderLoadModal(saves) {
  if (!state.ui.showLoadModal) return "";
  const SLOT_LABELS2 = { auto: "Auto", slot1: "Slot 1", slot2: "Slot 2", slot3: "Slot 3", slot4: "Slot 4" };
  const ALL_SLOTS2 = ["auto", "slot1", "slot2", "slot3", "slot4"];
  return `
  <div class="modal-overlay" id="load-modal-overlay">
    <div class="modal save-modal">
      <div class="modal-header">
        <h2>Load Game</h2>
        <button class="modal-close" id="close-load-modal">\u2715</button>
      </div>
      <div class="save-slots">
        ${ALL_SLOTS2.map((slot) => {
    const save = saves.find((s) => s.slot === slot);
    const hasRec = (save == null ? void 0 : save.record) && (save.record.wins > 0 || save.record.losses > 0);
    return `
            <div class="save-slot ${save ? "save-slot-filled" : "save-slot-empty"}"
                 data-load-slot="${slot}" ${!save ? "data-disabled" : ""}>
              <div class="save-slot-label">${SLOT_LABELS2[slot]}</div>
              ${save ? `
                <div class="save-slot-info">
                  <div class="save-slot-school">${escapeHtml(save.school || "Unknown")}</div>
                  <div class="save-slot-meta">Season ${save.season} \xB7 ${weekLabel(save.day)}${hasRec ? ` \xB7 ${fmtRecord(save.record.wins, save.record.losses)}` : ""}</div>
                  <div class="save-slot-date">${formatDate(save.timestamp)}</div>
                </div>
              ` : `
                <div class="save-slot-empty-label">Empty</div>
              `}
            </div>
          `;
  }).join("")}
      </div>
    </div>
  </div>
`;
}
function formatDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
async function setupListeners2() {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m;
  (_a = document.getElementById("btn-mm-guide")) == null ? void 0 : _a.addEventListener("click", () => {
    state.ui.manualFromMenu = true;
    navigate("manual");
  });
  (_b = document.getElementById("btn-mm-playnow")) == null ? void 0 : _b.addEventListener("click", () => {
    navigate("playnow");
  });
  document.getElementById("btn-mm-creator")?.addEventListener("click", () => {
    state.ui.creatorTab = null;
    navigate("creator");
  });
  document.getElementById("btn-mm-season")?.addEventListener("click", () => {
    state.ui.season = state.ui.season || { phase: "setup" };
    navigate("seasonmode");
  });
  document.getElementById("btn-mm-season-resume")?.addEventListener("click", async () => {
    // The dedicated "season" save restores state.seasonMode, so loadFromSlot's
    // navigate('dashboard') lands straight back in the season chrome.
    const ok = await loadFromSlot("season");
    if (!ok) notify("Could not resume — that season save is missing or from an older build.", "warning");
  });
  await refreshSaves();
  (_c = document.getElementById("btn-mm-continue")) == null ? void 0 : _c.addEventListener("click", async () => {
    await loadFromSlot("auto");
  });
  document.querySelectorAll("[data-mm-coach]").forEach((b) => b.addEventListener("click", () => {
    mmDeleteArmed = null;
    mmCoachId = b.dataset.mmCoach;
    mmNewCoach = false;
    rerender();
  }));
  document.querySelectorAll("[data-mm-coach-del]").forEach((b) => b.addEventListener("click", (e) => {
    e.stopPropagation();
    const id = b.dataset.mmCoachDel;
    if (mmDeleteArmed !== id) {
      mmDeleteArmed = id;
      rerender();
      return;
    }
    const c = getCoach(id);
    if (c) {
      for (const slot of Object.keys(c.worlds || {})) {
        const key = worldSlotKey(id, slot);
        import('../../engine/persistence.js').then((m) => {
          var _a2;
          return (_a2 = m.deleteSlotData) == null ? void 0 : _a2.call(m, key);
        });
      }
    }
    deleteCoach(id);
    mmDeleteArmed = null;
    if (mmCoachId === id) {
      mmCoachId = null;
      mmView = null;
    }
    rerender();
  }));
  (_d = document.getElementById("btn-mm-newcoach")) == null ? void 0 : _d.addEventListener("click", () => {
    mmDeleteArmed = null;
    mmNewCoach = true;
    rerender();
    setTimeout(() => {
      var _a2;
      return (_a2 = document.getElementById("mm-nc-first")) == null ? void 0 : _a2.focus();
    }, 30);
  });
  (_e = document.getElementById("mm-nc-create")) == null ? void 0 : _e.addEventListener("click", () => {
    var _a2, _b2, _c2, _d2;
    const f = (_b2 = (_a2 = document.getElementById("mm-nc-first")) == null ? void 0 : _a2.value) == null ? void 0 : _b2.trim();
    const l = (_d2 = (_c2 = document.getElementById("mm-nc-last")) == null ? void 0 : _c2.value) == null ? void 0 : _d2.trim();
    if (!f && !l) return;
    const c = createCoach(f || "Coach", l || "");
    if (c) {
      mmCoachId = c.id;
      mmNewCoach = false;
    }
    rerender();
  });
  (_f = document.getElementById("mm-back-coaches")) == null ? void 0 : _f.addEventListener("click", () => {
    mmCoachId = null;
    mmView = null;
    rerender();
  });
  document.querySelectorAll("[data-mm-tree]").forEach((b) => b.addEventListener("click", () => {
    mmDeleteArmed = null;
    mmTreeId = b.dataset.mmTree;
    mmNewTree = false;
    rerender();
  }));
  (_j = document.getElementById("btn-mm-newtree")) == null ? void 0 : _j.addEventListener("click", () => {
    mmDeleteArmed = null;
    mmNewTree = true;
    rerender();
    setTimeout(() => {
      var _a2;
      return (_a2 = document.getElementById("mm-nt-first")) == null ? void 0 : _a2.focus();
    }, 30);
  });
  // [W9 §12] START A DYNASTY, collapsed: one screen. The coach's LAST NAME
  // becomes the tree, the trunk coach is minted here, and we go straight to the
  // wizard (which locks the founding to a D3 job — growth rule 1). No separate
  // "name the tree" step, no division pick.
  (_k = document.getElementById("mm-nt-create")) == null ? void 0 : _k.addEventListener("click", () => {
    var _a2, _b2, _c2, _d2;
    const f = (_b2 = (_a2 = document.getElementById("mm-nt-first")) == null ? void 0 : _a2.value) == null ? void 0 : _b2.trim();
    const l = (_d2 = (_c2 = document.getElementById("mm-nt-last")) == null ? void 0 : _c2.value) == null ? void 0 : _d2.trim();
    if (!f && !l) return;
    // The tree is named for the coach's last name (fallback to first, then a
    // generic — createTree caps the length).
    const treeName = l || f || "The Tree";
    const t = createTree(treeName);
    if (!t) return;
    const c = createCoach(f || "Coach", l || "", { treeId: t.id });
    if (!c) return;
    mmNewTree = false;
    state._coachId = c.id;
    state._treeId = t.id;
    state._worldSlot = null;
    state._saveSlot = treeWorldKey(t.id);
    state._coachProfileName = { first: c.name.first, last: c.name.last };
    navigate("newgame");
  });
  document.querySelectorAll("[data-mm-tree-del]").forEach((b) => b.addEventListener("click", (e) => {
    e.stopPropagation();
    const id = b.dataset.mmTreeDel;
    if (mmDeleteArmed !== id) {
      mmDeleteArmed = id;
      rerender();
      return;
    }
    deleteSlotData == null ? void 0 : deleteSlotData(treeWorldKey(id));
    for (const c of listCoaches()) {
      if (c.treeId === id) deleteCoach(c.id);
    }
    deleteTree(id);
    mmDeleteArmed = null;
    if (mmTreeId === id) mmTreeId = null;
    rerender();
  }));
  (_l = document.getElementById("mm-back-trees")) == null ? void 0 : _l.addEventListener("click", () => {
    mmTreeId = null;
    rerender();
  });
  document.querySelectorAll("[data-mm-tree-found]").forEach((b) => b.addEventListener("click", () => {
    mmNewTrunk = true;
    rerender();
    setTimeout(() => {
      var _a2;
      return (_a2 = document.getElementById("mm-tc-first")) == null ? void 0 : _a2.focus();
    }, 30);
  }));
  (_m = document.getElementById("mm-tc-create")) == null ? void 0 : _m.addEventListener("click", () => {
    var _a2, _b2, _c2, _d2;
    const t = getTree(mmTreeId);
    if (!t) return;
    const f = (_b2 = (_a2 = document.getElementById("mm-tc-first")) == null ? void 0 : _a2.value) == null ? void 0 : _b2.trim();
    const l = (_d2 = (_c2 = document.getElementById("mm-tc-last")) == null ? void 0 : _c2.value) == null ? void 0 : _d2.trim();
    if (!f && !l) return;
    const c = createCoach(f || "Coach", l || "", { treeId: t.id });
    if (!c) return;
    mmNewTrunk = false;
    state._coachId = c.id;
    state._treeId = t.id;
    state._worldSlot = null;
    state._saveSlot = treeWorldKey(t.id);
    state._coachProfileName = { first: c.name.first, last: c.name.last };
    navigate("newgame");
  });
  document.querySelectorAll("[data-mm-tree-slot]").forEach((b) => b.addEventListener("click", async () => {
    const slot = treeWorldKey(mmTreeId);
    const ok = await loadFromSlot(slot);
    if (ok === false) return;
    state._treeId = mmTreeId;
    state._worldSlot = null;
    state._saveSlot = slot;
    const { switchTreeSlot } = await import('../../state.js');
    await switchTreeSlot(b.dataset.mmTreeSlot);
  }));
  document.querySelectorAll("[data-mm-view]").forEach((b) => b.addEventListener("click", () => {
    const v = b.dataset.mmView;
    mmView = v === "back" ? null : v;
    rerender();
  }));
  document.querySelectorAll("[data-mm-world]").forEach((b) => b.addEventListener("click", async () => {
    const slot = worldSlotKey(mmCoachId, b.dataset.mmWorld);
    const ok = await loadFromSlot(slot);
    if (ok !== false) {
      state._coachId = mmCoachId;
      state._worldSlot = b.dataset.mmWorld;
      state._saveSlot = slot;
    }
  }));
  document.querySelectorAll("[data-mm-world-del]").forEach((b) => b.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!confirm("Delete this world? The save is gone for good.")) return;
    clearWorldSlot(mmCoachId, b.dataset.mmWorldDel);
    import('../../engine/persistence.js').then((m) => m.saveGame && indexedDB.deleteDatabase ? null : null);
    rerender();
  }));
  document.querySelectorAll("[data-mm-world-new]").forEach((b) => b.addEventListener("click", () => {
    const c = getCoach(mmCoachId);
    state._coachId = mmCoachId;
    state._worldSlot = b.dataset.mmWorldNew;
    state._saveSlot = worldSlotKey(mmCoachId, b.dataset.mmWorldNew);
    state._coachProfileName = c ? { first: c.name.first, last: c.name.last } : null;
    navigate("newgame");
  }));
  document.querySelectorAll("[data-mm-classic]").forEach((b) => b.addEventListener("click", async () => {
    var _a2;
    const worldNo = b.dataset.mmClassicWorld;
    const saved = await loadGame(worldSlotKey(mmCoachId, worldNo));
    const classic = (_a2 = saved == null ? void 0 : saved.instantClassics) == null ? void 0 : _a2.find((item) => item.id === b.dataset.mmClassic);
    if (!(classic == null ? void 0 : classic.result)) {
      notify("That replay is no longer available in this world save.", "warning", 4500);
      return;
    }
    startInstantClassicReplay(classic);
  }));
  // [W9 §12] Watch a tree's Instant Classic. A tree has ONE world save (keyed by
  // treeWorldKey), so load that and find the full replay by id.
  document.querySelectorAll("[data-mm-tree-classic]").forEach((b) => b.addEventListener("click", async () => {
    var _a2;
    const saved = await loadGame(b.dataset.mmTreeClassicSlot);
    const classic = (_a2 = saved == null ? void 0 : saved.instantClassics) == null ? void 0 : _a2.find((item) => item.id === b.dataset.mmTreeClassic);
    if (!(classic == null ? void 0 : classic.result)) {
      notify("That replay is no longer available in this tree's world save.", "warning", 4500);
      return;
    }
    startInstantClassicReplay(classic);
  }));
  document.querySelectorAll("[data-mm-classic-del]").forEach((b) => b.addEventListener("click", async (event) => {
    event.stopPropagation();
    if (!confirm("Delete this Instant Classic replay?")) return;
    const worldNo = b.dataset.mmClassicWorld;
    const classicId = b.dataset.mmClassicDel;
    const key = worldSlotKey(mmCoachId, worldNo);
    const saved = await loadGame(key);
    if (!saved || saved._incompatible) {
      notify("That world save could not be opened.", "warning");
      return;
    }
    saved.instantClassics = (saved.instantClassics || []).filter((item) => item.id !== classicId);
    const ok = await saveGame(saved, key);
    if (!ok) {
      notify("The replay could not be deleted.", "warning");
      return;
    }
    removeWorldClassicMeta(mmCoachId, worldNo, classicId);
    rerender();
  }));
  document.querySelectorAll("[data-mm-lib-del]").forEach((b) => b.addEventListener("click", () => {
    const [kind, ...rest] = b.dataset.mmLibDel.split(":");
    deleteLibraryPlan(mmCoachId, kind === "pp" ? "practice" : "gameplan", rest.join(":"));
    rerender();
  }));
  document.querySelectorAll("[data-mm-team-del]").forEach((b) => b.addEventListener("click", () => {
    deleteSavedTeam(mmCoachId, b.dataset.mmTeamDel);
    rerender();
  }));
  (_g = document.getElementById("btn-mm-load")) == null ? void 0 : _g.addEventListener("click", () => {
    state.ui.showLoadModal = true;
    rerender();
  });
  (_h = document.getElementById("close-load-modal")) == null ? void 0 : _h.addEventListener("click", () => {
    state.ui.showLoadModal = false;
    import('../../state.js').then((m) => m.rerender());
  });
  (_i = document.getElementById("load-modal-overlay")) == null ? void 0 : _i.addEventListener("click", (e) => {
    if (e.target.id === "load-modal-overlay") {
      state.ui.showLoadModal = false;
      import('../../state.js').then((m) => m.rerender());
    }
  });
  document.querySelectorAll("[data-load-slot]").forEach((el) => {
    if (el.dataset.disabled !== void 0) return;
    el.addEventListener("click", async () => {
      await loadFromSlot(el.dataset.loadSlot);
    });
  });
}
var mmCoachId, mmNewCoach, mmView, mmDeleteArmed, mmTreeId, mmNewTree, mmNewTrunk;

mmCoachId = null;
mmNewCoach = false;
mmView = null;
mmTreeId = null;
mmNewTree = false;
mmNewTrunk = false;

export { renderMainMenu, setupListeners2 as setupListeners };
