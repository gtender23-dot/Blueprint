import { state, rerender, notify } from '../../state.js';
import { FORMATION_PACKAGES, FORMATION_PLAYBOOK, aliasFormation } from '../../constants.js';
import { emptyPlaybook, validatePlaybook, legalConceptsForFormation } from '../../engine/playbook.js';
import { listCreations, loadCreationData, saveCreation, deleteCreation } from '../../engine/creator.js';

// ── Playbook Builder (Creativity Tools UI) — formation-first ───────────────
// Assembles a customPlaybook (js/engine/playbook.js): pick formations, pick each
// formation's plays from its legal list, save to the global library. All the
// engine — legality, validation, save/load — is done and probe-proven; this is
// the screen on top. Editor state lives in state.ui.pb.
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function _pb() { return state.ui.pb; }

function renderPlaybookList() {
  const books = listCreations("playbooks");
  const rows = books.length ? books.map((b) => `<div class="pb-row">
      <button class="pb-row-open" data-pb-open="${esc(b.id)}"><span class="pb-row-name">\u{1F4CB} ${esc(b.name)}</span><span class="pb-row-meta">${(b.data.formations || []).length} formations</span></button>
      <button class="btn-mm-del" data-pb-del="${esc(b.id)}" title="Delete" aria-label="Delete ${esc(b.name)}">✕</button>
    </div>`).join("") : `<div class="mm-lib-empty muted">No playbooks yet. Build one — pick formations, pick their plays, save.</div>`;
  return `<div class="creator-hub">
    <div class="creator-hub-head"><div class="creator-title">Playbook Builder</div>
      <div class="creator-sub">Pick formations, choose each one's plays, save a system you can load into any world.</div></div>
    <div class="pb-list">${rows}</div>
    <div class="pb-actions">
      <button class="btn-mm btn-mm-new" data-pb-new="1">＋ New Playbook</button>
      <button class="btn-mm btn-mm-secondary" data-creator="hub">← Workshop</button>
    </div>
  </div>`;
}
function renderPlaybookEditor() {
  const pb = _pb();
  const carried = new Map((pb.formations || []).map((f) => [aliasFormation(f.id), f]));
  const expand = state.ui.pbExpand || null;
  const v = validatePlaybook(pb);
  const formRows = Object.keys(FORMATION_PACKAGES).map((fid) => {
    const on = carried.has(fid);
    const f = carried.get(fid) || {};
    const legal = legalConceptsForFormation(fid);
    const sheet = (pb.sheets && pb.sheets[fid]) || {};
    const picked = Object.keys(sheet).length;
    const open = expand === fid;
    const concepts = on && open ? `<div class="pb-concepts">${legal.map((c) => `<label class="pb-concept${sheet[c] != null ? " on" : ""}"><input type="checkbox" data-pb-concept="${esc(fid)}|${esc(c)}"${sheet[c] != null ? " checked" : ""}/> ${esc(c)}</label>`).join("")}</div>` : "";
    return `<div class="pb-form${on ? " on" : ""}">
      <div class="pb-form-head">
        <label class="pb-form-toggle"><input type="checkbox" data-pb-form="${esc(fid)}"${on ? " checked" : ""}/> <span class="pb-form-name">${esc(fid)}</span></label>
        ${on ? `<input class="pb-weight" type="number" min="0" max="99" value="${f.weight != null ? f.weight : 0}" data-pb-weight="${esc(fid)}" title="how often to line up here"/>
        <button class="pb-expand" data-pb-expand="${esc(fid)}">${picked}/${legal.length} plays ${open ? "▴" : "▾"}</button>` : ""}
      </div>${concepts}
    </div>`;
  }).join("");
  const msg = v.errors.length ? `<div class="pb-msg err">${esc(v.errors[0])}</div>` : v.warnings.length ? `<div class="pb-msg warn">${esc(v.warnings[0])}</div>` : `<div class="pb-msg ok">Ready to save.</div>`;
  return `<div class="creator-hub">
    <div class="creator-hub-head"><div class="creator-title">Playbook Builder</div></div>
    <input class="form-input pb-name" id="pb-name" type="text" maxlength="36" placeholder="Playbook name" value="${esc(pb.name || "")}"/>
    ${msg}
    <div class="pb-forms">${formRows}</div>
    <div class="pb-actions">
      <button class="btn-mm btn-mm-new" data-pb-save="1"${v.errors.length ? " disabled" : ""}>Save Playbook</button>
      <button class="btn-mm btn-mm-secondary" data-pb-cancel="1">Cancel</button>
    </div>
  </div>`;
}
function renderPlaybooksTab() {
  return `<div class="creator-wrapper">${_pb() ? renderPlaybookEditor() : renderPlaybookList()}</div>`;
}
function _syncName() {
  const el = document.getElementById("pb-name");
  if (el && _pb()) _pb().name = el.value;
}
function playbooksListeners() {
  document.querySelectorAll("[data-pb-open]").forEach((b) => b.addEventListener("click", () => {
    const id = b.dataset.pbOpen;
    const data = loadCreationData("playbooks", id);
    if (data) { state.ui.pb = { ...data }; state.ui.pbId = id; state.ui.pbExpand = null; rerender(); }
  }));
  document.querySelectorAll("[data-pb-del]").forEach((b) => b.addEventListener("click", () => {
    deleteCreation("playbooks", b.dataset.pbDel); rerender();
  }));
  document.querySelector("[data-pb-new]")?.addEventListener("click", () => {
    state.ui.pb = emptyPlaybook("My Playbook"); state.ui.pbId = null; state.ui.pbExpand = null; rerender();
  });
  // editor
  document.querySelectorAll("[data-pb-form]").forEach((el) => el.addEventListener("change", () => {
    _syncName();
    const fid = aliasFormation(el.dataset.pbForm);
    const pb = _pb();
    if (el.checked) { if (!pb.formations.some((f) => aliasFormation(f.id) === fid)) pb.formations.push({ id: fid, weight: 25 }); state.ui.pbExpand = fid; }
    else { pb.formations = pb.formations.filter((f) => aliasFormation(f.id) !== fid); if (pb.sheets) delete pb.sheets[fid]; if (state.ui.pbExpand === fid) state.ui.pbExpand = null; }
    rerender();
  }));
  document.querySelectorAll("[data-pb-expand]").forEach((b) => b.addEventListener("click", () => {
    _syncName();
    state.ui.pbExpand = state.ui.pbExpand === b.dataset.pbExpand ? null : b.dataset.pbExpand;
    rerender();
  }));
  document.querySelectorAll("[data-pb-weight]").forEach((el) => el.addEventListener("change", () => {
    const fid = aliasFormation(el.dataset.pbWeight);
    const f = _pb().formations.find((x) => aliasFormation(x.id) === fid);
    if (f) f.weight = Math.max(0, Math.min(99, +el.value || 0));
  }));
  document.querySelectorAll("[data-pb-concept]").forEach((el) => el.addEventListener("change", () => {
    _syncName();
    const [fid, concept] = el.dataset.pbConcept.split("|");
    const pb = _pb();
    pb.sheets = pb.sheets || {};
    pb.sheets[fid] = pb.sheets[fid] || {};
    if (el.checked) pb.sheets[fid][concept] = 50; else delete pb.sheets[fid][concept];
    rerender();
  }));
  document.querySelector("[data-pb-save]")?.addEventListener("click", () => {
    _syncName();
    const pb = _pb();
    const v = validatePlaybook(pb);
    if (!v.ok) { notify(v.errors[0], "warning"); return; }
    const r = saveCreation("playbooks", pb.name, pb, state.ui.pbId ? { id: state.ui.pbId } : {});
    if (r.ok) { notify(`"${pb.name}" saved`, "success"); state.ui.pb = null; state.ui.pbId = null; rerender(); }
    else notify(r.reason === "full" ? "Library is full" : "Could not save", "warning");
  });
  document.querySelector("[data-pb-cancel]")?.addEventListener("click", () => {
    state.ui.pb = null; state.ui.pbId = null; rerender();
  });
}
export { renderPlaybooksTab, playbooksListeners };
