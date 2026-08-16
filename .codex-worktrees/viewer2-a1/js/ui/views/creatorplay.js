import { state, rerender, notify } from '../../state.js';
import { listCreations, loadCreationData, saveCreation, deleteCreation } from '../../engine/creator.js';
import { baseConceptsForKind, emptyCustomPlay, validateCustomPlay } from '../../engine/customplay.js';
import { routePartList, validateComposedPlay, compilePlay, COVERAGES } from '../../engine/playcompose.js';

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
    return `<div class="pb-row">
      <button class="pb-row-open" data-play-open="${esc(p.id)}"><span class="pb-row-name">✏️ ${esc(p.name)}</span><span class="pb-row-meta">${sub}</span></button>
      <button class="btn-mm-del" data-play-del="${esc(p.id)}" title="Delete" aria-label="Delete ${esc(p.name)}">✕</button>
    </div>`;
  }).join("") : `<div class="mm-lib-empty muted">No custom plays yet. Name an existing play, or compose one from routes.</div>`;
  return `<div class="creator-hub">
    <div class="creator-hub-head"><div class="creator-title">Play Composer</div>
      <div class="creator-sub">Name your own version of a play, or build one from route concepts.</div></div>
    <div class="pb-list">${rows}</div>
    <div class="pb-actions">
      <button class="btn-mm btn-mm-new" data-play-new="compose">＋ Compose from routes</button>
      <button class="btn-mm btn-mm-new" data-play-new="name">＋ Name a play</button>
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
function renderComposeEditor() {
  const p = _p();
  const parts = p.parts || [];
  const v = validateComposedPlay({ name: p.name, kind: "pass", parts });
  let preview = "";
  if (v.ok) { const c = compilePlay({ name: p.name || "Play", kind: "pass", parts }); preview = `<div class="play-preview"><div class="play-preview-head">${esc(c.depth)} pass · needs ${c.minWR} WR</div>${coverageSummary(c.vs)}</div>`; }
  const partRows = routePartList().map((rp) => {
    const on = parts.includes(rp.id);
    const full = !on && parts.length >= MAX_PARTS;
    return `<label class="pb-concept${on ? " on" : ""}${full ? " muted" : ""}"><input type="checkbox" data-play-part="${esc(rp.id)}"${on ? " checked" : ""}${full ? " disabled" : ""}/> ${esc(rp.label)}</label>`;
  }).join("");
  const msg = v.errors.length ? `<div class="pb-msg err">${esc(v.errors[0])}</div>` : `<div class="pb-msg ok">${parts.length} routes — ready to save.</div>`;
  return `<div class="creator-hub">
    <div class="creator-hub-head"><div class="creator-title">Compose a Play</div>
      <div class="creator-sub">Pick ${MIN_PARTS}–${MAX_PARTS} routes. The play's strengths are figured for you.</div></div>
    <input class="form-input pb-name" id="play-name" type="text" maxlength="36" placeholder="Play name" value="${esc(p.name || "")}"/>
    ${msg}
    ${preview}
    <div class="pb-concepts play-parts">${partRows}</div>
    <div class="pb-actions">
      <button class="btn-mm btn-mm-new" data-play-save="1"${v.errors.length ? " disabled" : ""}>Save Play</button>
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
    if (data) { state.ui.play = { ...data, mode: Array.isArray(data.parts) ? "compose" : "name" }; state.ui.playId = b.dataset.playOpen; rerender(); }
  }));
  document.querySelectorAll("[data-play-del]").forEach((b) => b.addEventListener("click", () => { deleteCreation("plays", b.dataset.playDel); rerender(); }));
  document.querySelectorAll("[data-play-new]").forEach((b) => b.addEventListener("click", () => {
    const mode = b.dataset.playNew;
    state.ui.play = mode === "name" ? { ...emptyCustomPlay("My Play"), mode: "name" } : { name: "My Play", kind: "pass", parts: [], mode: "compose" };
    state.ui.playId = null; rerender();
  }));
  document.querySelectorAll("[data-play-part]").forEach((el) => el.addEventListener("change", () => {
    _syncName(); const p = _p(); p.parts = p.parts || [];
    const id = el.dataset.playPart;
    if (el.checked) { if (p.parts.length < MAX_PARTS && !p.parts.includes(id)) p.parts.push(id); }
    else p.parts = p.parts.filter((x) => x !== id);
    rerender();
  }));
  document.querySelector("[data-play-kind]")?.addEventListener("change", (e) => { _syncName(); _p().kind = e.target.value; _p().base = baseConceptsForKind(e.target.value)[0]; rerender(); });
  document.querySelector("[data-play-base]")?.addEventListener("change", (e) => { _syncName(); _p().base = e.target.value; rerender(); });
  document.querySelector("[data-play-save]")?.addEventListener("click", () => {
    _syncName(); const p = _p();
    const isCompose = p.mode !== "name";
    const payload = isCompose ? { name: p.name, kind: "pass", parts: p.parts } : { name: p.name, kind: p.kind, base: p.base };
    const v = isCompose ? validateComposedPlay(payload) : validateCustomPlay(payload);
    if (!v.ok) { notify(v.errors[0], "warning"); return; }
    const r = saveCreation("plays", p.name, payload, state.ui.playId ? { id: state.ui.playId } : {});
    if (r.ok) { notify(`"${p.name}" saved`, "success"); state.ui.play = null; state.ui.playId = null; rerender(); }
    else notify(r.reason === "full" ? "Library is full" : "Could not save", "warning");
  });
  document.querySelector("[data-play-cancel]")?.addEventListener("click", () => { state.ui.play = null; state.ui.playId = null; rerender(); });
}
export { renderPlaysTab, playsListeners };
