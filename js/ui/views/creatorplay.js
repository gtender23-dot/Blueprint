import { state, rerender, notify, navigate } from '../../state.js';
import { FORMATION_PACKAGES } from '../../constants.js';
import { listCreations, loadCreationData, saveCreation, deleteCreation } from '../../engine/creator.js';
import { baseConceptsForKind, emptyCustomPlay, validateCustomPlay } from '../../engine/customplay.js';
import { routePartList, validateComposedPlay, compilePlay, COVERAGES } from '../../engine/playcompose.js';
import { routeGlyph, renderPlayCard, routeColor, formationReceivers } from './routeart.js';

// ── Play Composer (Creativity Tools UI) ────────────────────────────────────
// Two ways to make a play, both on the proven engine: NAME an existing concept
// (Model A, customplay.js — band-safe, resolves to the base) or COMPOSE one from
// route parts (Model B-i, playcompose.js — grades derived from a fixed rulebook,
// clamped in-band, human-call-only). Editor state in state.ui.play.
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function _p() { return state.ui.play; }
var MIN_PARTS = 2, MAX_PARTS = 5;

function renderPlayList() {
  const plays = listCreations("plays");
  const rows = plays.length ? plays.map((p) => {
    const kind = Array.isArray(p.data.parts) ? "composed" : "named";
    const sub = kind === "composed" ? `${(p.data.parts || []).length} routes` : `= ${esc(p.data.base || "?")}`;
    const thumb = kind === "composed"
      ? `<span class="play-row-thumb">${renderPlayCard(p.data.parts, { w: 120, h: 76, scale: 0.72, formation: (p.data.formations && p.data.formations[0]) || null, assigns: p.data.assigns, blocks: p.data.blocks })}</span>`
      : `<span class="play-row-thumb play-row-thumb-named">📋</span>`;
    return `<div class="pb-row play-row">
      <button class="pb-row-open" data-play-open="${esc(p.id)}">${thumb}<span class="play-row-copy"><span class="pb-row-name">${esc(p.name)}</span><span class="pb-row-meta">${sub}</span></span></button>
      <button class="btn-mm-del" data-play-del="${esc(p.id)}" title="Delete" aria-label="Delete ${esc(p.name)}">✕</button>
    </div>`;
  }).join("") : `<div class="mm-lib-empty muted">No custom plays yet. Compose one from route concepts.</div>`;
  return `<div class="creator-hub">
    <div class="creator-hub-head"><div class="creator-title">Play Composer</div>
      <div class="creator-sub">Build a play from route concepts.</div></div>
    <div class="pb-list">${rows}</div>
    <div class="pb-actions">
      <button class="btn-mm btn-mm-new" data-play-new="compose">＋ Compose from routes</button>
      <button class="btn-mm btn-mm-secondary" data-creator="hub">← Workshop</button>
    </div>
  </div>`;
}
function coverageSummary(vs) {
  const strong = COVERAGES.filter((c) => vs[c] >= 0.04).sort((a, b) => vs[b] - vs[a]).slice(0, 3);
  const weak = COVERAGES.filter((c) => vs[c] <= -0.03).sort((a, b) => vs[a] - vs[b]).slice(0, 3);
  return `<div class="play-cov">
    <div class="play-cov-row"><span class="play-cov-lbl good">Strong vs</span> ${strong.length ? strong.map(esc).join(", ") : "—"}</div>
    <div class="play-cov-row"><span class="play-cov-lbl bad">Struggles vs</span> ${weak.length ? weak.map(esc).join(", ") : "—"}</div>
  </div>`;
}
// ── Formation-first lineup ─────────────────────────────────────────────────
// A composed play is now formation-forced: pick a formation, then say what EVERY
// skill player does — a route or "block". No "even spread", no invisible men.
// Editor state: p.formation + p.lineup = { [slotId]: { route, flip } } where
// route is a route id or "block". On save it's derived into the engine's
// parts/assigns/blocks (parts drive the band-safe grades; the rest is diagram).
var DEF_FORMATION = "Spread";
var _ROUTE_IDS = new Set(routePartList().map((r) => r.id));
function _defaultRouteFor(rec) {
  if (rec.pos === "RB" || rec.pos === "WING" || rec.pos === "ABACK") return "checkdown";
  if (rec.pos === "TE") return "curl";
  return Math.abs((rec.x != null ? rec.x : 0.5) - 0.5) > 0.32 ? "go" : "dig";
}
function _ensureLineup(p) {
  if (!p.formation || !FORMATION_PACKAGES[p.formation]) p.formation = DEF_FORMATION;
  const recs = formationReceivers(p.formation);
  p.lineup = p.lineup || {};
  for (const k of Object.keys(p.lineup)) if (!recs.some((r) => r.id === k)) delete p.lineup[k];
  for (const r of recs) if (!p.lineup[r.id]) p.lineup[r.id] = { route: _defaultRouteFor(r), flip: false };
  return p;
}
function _lineupPayload(p) {
  const recs = formationReceivers(p.formation);
  const parts = [], assigns = [], blocks = [];
  for (const r of recs) {
    const a = p.lineup[r.id] || {};
    if (a.route === "block") blocks.push(r.id);
    else if (a.route && _ROUTE_IDS.has(a.route)) { parts.push(a.route); assigns.push({ slot: r.id, flip: !!a.flip }); }
  }
  return { name: p.name, kind: "pass", parts, assigns, blocks, formations: [p.formation] };
}
function _lineupFromData(data) {
  const formation = (data.formations && data.formations[0]) || DEF_FORMATION;
  const lineup = {};
  const parts = Array.isArray(data.parts) ? data.parts : [];
  const assigns = Array.isArray(data.assigns) ? data.assigns : [];
  // Pass 1: honor explicit receiver picks (deduped — first claim wins).
  const unplaced = [];
  parts.forEach((route, i) => {
    if (!_ROUTE_IDS.has(route)) return;
    const slot = assigns[i] && assigns[i].slot;
    const flip = !!(assigns[i] && assigns[i].flip);
    if (slot && !lineup[slot]) lineup[slot] = { route, flip };
    else unplaced.push({ route, flip });
  });
  (Array.isArray(data.blocks) ? data.blocks : []).forEach((slot) => { if (!lineup[slot]) lineup[slot] = { route: "block", flip: false }; });
  // Pass 2 (old Auto-assigned plays, pre-lineup composer): distribute slot-less
  // routes into open receivers the same way the play card draws them — screens
  // and checkdowns to the backs, everything else to open receivers outside-in —
  // so the editor matches the picture the card has been showing, instead of
  // silently replacing the play's routes with position defaults (which then
  // overwrote the play on save).
  if (unplaced.length) {
    const recs = formationReceivers(formation).filter((r) => !lineup[r.id]);
    const isBack = (r) => r.pos === "RB" || r.pos === "WING" || r.pos === "ABACK";
    for (const u of unplaced) {
      const backFirst = u.route === "screen" || u.route === "checkdown";
      const pick = (backFirst ? recs.find(isBack) : recs.find((r) => !isBack(r))) || recs[0];
      if (!pick) break;
      lineup[pick.id] = { route: u.route, flip: u.flip };
      recs.splice(recs.indexOf(pick), 1);
    }
    // Receivers the old play never mentioned stay in to block, so reopening and
    // resaving an old play keeps its exact route list (and therefore its exact
    // grades) instead of growing default routes.
    formationReceivers(formation).forEach((r) => { if (!lineup[r.id]) lineup[r.id] = { route: "block", flip: false }; });
  }
  return { formation, lineup };
}
function renderComposeEditor() {
  const p = _ensureLineup(_p());
  const recs = formationReceivers(p.formation);
  const payload = _lineupPayload(p);
  const parts = payload.parts;
  const v = validateComposedPlay({ name: p.name, kind: "pass", parts });
  let grade = "";
  if (v.ok) { const c = compilePlay({ name: p.name || "Play", kind: "pass", parts }); grade = `<div class="play-preview-head">${esc(c.depth)} pass · needs ${c.minWR} WR</div>${coverageSummary(c.vs)}`; }
  const formPick = `<label class="play-form-pick"><span>Formation</span>
    <select class="form-input" id="play-formation">
      ${Object.keys(FORMATION_PACKAGES).map((f) => `<option value="${esc(f)}"${p.formation === f ? " selected" : ""}>${esc(f)}</option>`).join("")}
    </select></label>`;
  const canvas = `<div class="play-canvas">${formPick}
    ${renderPlayCard(parts, { w: 300, h: 200, formation: p.formation, assigns: payload.assigns, blocks: payload.blocks })}
  </div>`;
  const preview = grade ? `<div class="play-preview">${grade}</div>` : "";
  const routeOpts = routePartList();
  const rows = recs.map((r) => {
    const a = p.lineup[r.id] || { route: "block", flip: false };
    const isBlock = a.route === "block";
    const glyph = isBlock ? `<span class="assign-glyph assign-glyph-block">🛡</span>` : `<span class="assign-glyph">${routeGlyph(a.route, { size: 34 })}</span>`;
    return `<div class="assign-row">
      ${glyph}
      <span class="assign-name">${esc(r.label)} <span class="assign-pos muted">${esc(r.pos)}</span></span>
      <select class="form-input assign-route" data-lineup-slot="${esc(r.id)}">
        <option value="block"${isBlock ? " selected" : ""}>— Block / stay in —</option>
        ${routeOpts.map((rp) => `<option value="${esc(rp.id)}"${a.route === rp.id ? " selected" : ""}>${esc(rp.label)}</option>`).join("")}
      </select>
      <button type="button" class="assign-btn${a.flip ? " on" : ""}" data-lineup-flip="${esc(r.id)}"${isBlock ? " disabled" : ""} title="Flip the route left/right" aria-label="Flip route">⇄</button>
    </div>`;
  }).join("");
  const msg = v.errors.length ? `<div class="pb-msg err">${esc(v.errors[0])}</div>` : `<div class="pb-msg ok">${parts.length} routes on ${esc(p.formation)} — ready to save.</div>`;
  return `<div class="creator-hub">
    <div class="creator-hub-head"><div class="creator-title">Compose a Play</div>
      <div class="creator-sub">Pick a formation, then set what every receiver runs. Give at least ${MIN_PARTS} of them a route.</div></div>
    <input class="form-input pb-name" id="play-name" type="text" maxlength="36" placeholder="Play name" value="${esc(p.name || "")}"/>
    ${canvas}
    ${msg}
    ${preview}
    <div class="assign-add-head muted">The lineup — what each ${esc(p.formation)} receiver does</div>
    <div class="assign-list">${rows}</div>
    <div class="pb-actions">
      <button class="btn-mm btn-mm-new" data-play-save="1"${v.errors.length ? " disabled" : ""}>Save Play</button>
      <button class="btn-mm btn-mm-secondary" data-play-test="1"${v.errors.length ? " disabled" : ""}>🧪 Test on the bench</button>
      <button class="btn-mm btn-mm-secondary" data-play-cancel="1">Cancel</button>
    </div>
  </div>`;
}
function renderNameEditor() {
  const p = _p();
  const kind = p.kind === "run" ? "run" : "pass";
  const bases = baseConceptsForKind(kind);
  const v = validateCustomPlay({ name: p.name, kind, base: p.base });
  const opts = bases.map((b) => `<option value="${esc(b)}"${p.base === b ? " selected" : ""}>${esc(b)}</option>`).join("");
  const msg = v.errors.length ? `<div class="pb-msg err">${esc(v.errors[0])}</div>` : `<div class="pb-msg ok">Your name for "${esc(p.base)}" — plays exactly like it.</div>`;
  return `<div class="creator-hub">
    <div class="creator-hub-head"><div class="creator-title">Name a Play</div>
      <div class="creator-sub">Give an existing play your own name. It plays identically — no balance change.</div></div>
    <input class="form-input pb-name" id="play-name" type="text" maxlength="36" placeholder="Your name for it" value="${esc(p.name || "")}"/>
    <div class="play-name-row">
      <select class="form-input" data-play-kind>
        <option value="pass"${kind === "pass" ? " selected" : ""}>Pass</option>
        <option value="run"${kind === "run" ? " selected" : ""}>Run</option>
      </select>
      <select class="form-input" data-play-base>${opts}</select>
    </div>
    ${msg}
    <div class="pb-actions">
      <button class="btn-mm btn-mm-new" data-play-save="1"${v.errors.length ? " disabled" : ""}>Save Play</button>
      <button class="btn-mm btn-mm-secondary" data-play-cancel="1">Cancel</button>
    </div>
  </div>`;
}
function renderPlaysTab() {
  const p = _p();
  const inner = !p ? renderPlayList() : p.mode === "name" ? renderNameEditor() : renderComposeEditor();
  return `<div class="creator-wrapper">${inner}</div>`;
}
function _syncName() { const el = document.getElementById("play-name"); if (el && _p()) _p().name = el.value; }
function playsListeners() {
  document.querySelectorAll("[data-play-open]").forEach((b) => b.addEventListener("click", () => {
    const data = loadCreationData("plays", b.dataset.playOpen);
    if (!data) return;
    if (Array.isArray(data.parts)) {
      const { formation, lineup } = _lineupFromData(data);
      state.ui.play = { name: data.name, kind: "pass", formation, lineup, mode: "compose" };
    } else {
      state.ui.play = { ...data, mode: "name" };
    }
    state.ui.playId = b.dataset.playOpen; rerender();
  }));
  document.querySelectorAll("[data-play-del]").forEach((b) => b.addEventListener("click", () => { deleteCreation("plays", b.dataset.playDel); rerender(); }));
  document.querySelectorAll("[data-play-new]").forEach((b) => b.addEventListener("click", () => {
    const mode = b.dataset.playNew;
    state.ui.play = mode === "name" ? { ...emptyCustomPlay("My Play"), mode: "name" } : { name: "My Play", kind: "pass", formation: DEF_FORMATION, lineup: {}, mode: "compose" };
    state.ui.playId = null; rerender();
  }));
  // formation-first lineup: change formation, set each receiver's route, or flip
  document.querySelector("#play-formation")?.addEventListener("change", (e) => {
    _syncName(); const p = _p(); p.formation = e.target.value; _ensureLineup(p); rerender();
  });
  document.querySelectorAll("[data-lineup-slot]").forEach((el) => el.addEventListener("change", () => {
    _syncName(); const p = _ensureLineup(_p()); const slot = el.dataset.lineupSlot;
    if (p.lineup[slot]) p.lineup[slot].route = el.value;
    rerender();
  }));
  document.querySelectorAll("[data-lineup-flip]").forEach((b) => b.addEventListener("click", () => {
    _syncName(); const p = _ensureLineup(_p()); const slot = b.dataset.lineupFlip;
    if (p.lineup[slot] && p.lineup[slot].route !== "block") p.lineup[slot].flip = !p.lineup[slot].flip;
    rerender();
  }));
  // name-a-play mode (Model A)
  document.querySelector("[data-play-kind]")?.addEventListener("change", (e) => { _syncName(); _p().kind = e.target.value; _p().base = baseConceptsForKind(e.target.value)[0]; rerender(); });
  document.querySelector("[data-play-base]")?.addEventListener("change", (e) => { _syncName(); _p().base = e.target.value; rerender(); });
  document.querySelector("[data-play-save]")?.addEventListener("click", () => {
    _syncName(); const p = _p();
    const isCompose = p.mode !== "name";
    const payload = isCompose ? _lineupPayload(_ensureLineup(p)) : { name: p.name, kind: p.kind, base: p.base };
    const v = isCompose ? validateComposedPlay(payload) : validateCustomPlay(payload);
    if (!v.ok) { notify(v.errors[0], "warning"); return; }
    const r = saveCreation("plays", p.name, payload, state.ui.playId ? { id: state.ui.playId } : {});
    if (r.ok) { notify(`"${p.name}" saved`, "success"); state.ui.play = null; state.ui.playId = null; rerender(); }
    else notify(r.reason === "full" ? "Library is full" : "Could not save", "warning");
  });
  document.querySelector("[data-play-cancel]")?.addEventListener("click", () => { state.ui.play = null; state.ui.playId = null; rerender(); });
  // M1 test-bench entrance: run the play BEING BUILT (saved or not) against a
  // forced defensive look on the bench — the composer's own live rep.
  document.querySelector("[data-play-test]")?.addEventListener("click", () => {
    _syncName(); const p = _p();
    if (!p || p.mode === "name") return;
    const payload = _lineupPayload(_ensureLineup(p));
    const v = validateComposedPlay(payload);
    if (!v.ok) { notify(v.errors[0], "warning"); return; }
    state.ui.bench = {
      formationId: p.formation, variation: null, concept: null,
      customPlayId: state.ui.playId || "_composer", customPlayData: payload,
      label: payload.name || "My Play",
      defLook: { front: "4-3", coverage: "c3", bring: "4" }
    };
    navigate("bench");
  });
}
export { renderPlaysTab, playsListeners };
