import { state, rerender, notify, navigate } from '../../state.js';
import { listCreations, loadCreationData, saveCreation, deleteCreation } from '../../engine/creator.js';
import {
  FORM_ANCHORS, QB_DEPTH, FORM_POS, emptyCustomFormation, validateCustomFormation,
  formationArchetype, compileFormation, syncCustomFormations
} from '../../engine/formcompose.js';
import { renderFormationDiagram } from './routeart.js';

// ── Formation Designer (Stage 7, the Workshop) ─────────────────────────────
// Author a formation from five skill placements over the fixed core (five OL +
// a QB depth). Everything the sim consumes is DERIVED by formcompose.js's
// fixed rulebook — the author picks football, never numbers. Saved to the
// global `formations` shelf; syncCustomFormations() registers every valid
// creation into the live tables, so the Playbook Builder, the Game Plan, the
// call sheet and the field pick it up with no further wiring.
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function _f() { return state.ui.form; }
function _entries() { return listCreations("formations").map((e) => ({ name: e.name, data: e.data })); }
function resyncFormations() {
  try {
    return syncCustomFormations(_entries());
  } catch (e) {
    return 0;
  }
}
function _persStr(pkg) {
  const bits = [];
  if ((pkg.RB || 0) + (pkg.FB || 0)) bits.push(`${(pkg.RB || 0) + (pkg.FB || 0)} back${(pkg.RB || 0) + (pkg.FB || 0) === 1 ? "" : "s"}`);
  bits.push(`${pkg.TE || 0} TE`, `${pkg.WR || 0} WR`);
  return bits.join(" \xB7 ");
}
function _tryCompile(cf) {
  try {
    return compileFormation(cf);
  } catch (e) {
    return null;
  }
}
// Same call, but it KEEPS the reason. The editor swallowed it and printed "fix
// the errors above" over an empty error block whenever validation passed and
// the compile still threw (owner screenshot 2026-08-17: five tight ends). A
// message that points at errors must be able to name one.
function _compileOrWhy(cf) {
  try {
    return { form: compileFormation(cf), why: null };
  } catch (e) {
    return { form: null, why: String((e && e.message) || e).replace(/^compileFormation: (invalid formation \u2014 )?/, "") };
  }
}

function renderFormList() {
  const forms = listCreations("formations");
  const rows = forms.length ? forms.map((f) => {
    const c = _tryCompile(f.data);
    const thumb = c ? `<span class="play-row-thumb">${renderFormationDiagram(f.name, { slots: c.layout.slots, w: 120, h: 76 })}</span>` : `<span class="play-row-thumb play-row-thumb-named">⚠️</span>`;
    const meta = c ? `${_persStr(c.pkg)} \xB7 ${c.playbook.length} plays \xB7 ${esc(c.archetype)} family` : "needs repair — open to fix";
    return `<div class="pb-row play-row">
      <button class="pb-row-open" data-form-open="${esc(f.id)}">${thumb}<span class="play-row-copy"><span class="pb-row-name">${esc(f.name)}</span><span class="pb-row-meta">${meta}</span></span></button>
      <button class="btn-mm-del" data-form-del="${esc(f.id)}" title="Delete" aria-label="Delete ${esc(f.name)}">✕</button>
    </div>`;
  }).join("") : `<div class="mm-lib-empty muted">No formations yet. Place five skill players over the line and save a look of your own.</div>`;
  return `<div class="creator-hub">
    <div class="creator-hub-head"><div class="creator-title">Formation Designer</div>
      <div class="creator-sub">Five skill players, a QB depth, the line does the rest. Legal by the rulebook — crazy is fine, illegal isn't.</div></div>
    <div class="pb-list">${rows}</div>
    <div class="pb-actions">
      <button class="btn-mm btn-mm-new" data-form-new="1">＋ New formation</button>
      <button class="btn-mm btn-mm-secondary" data-creator="hub">← Workshop</button>
    </div>
  </div>`;
}

function renderFormEditor() {
  const cf = _f();
  const v = validateCustomFormation(cf);
  const built = v.ok ? _compileOrWhy(cf) : { form: null, why: null };
  const c = built.form;
  const posOpts = (sel) => FORM_POS.map((p) => `<option value="${p}"${sel === p ? " selected" : ""}>${p}</option>`).join("");
  const anchorOpts = (s) => {
    const isBack = s.pos === "RB" || s.pos === "FB";
    return Object.entries(FORM_ANCHORS)
      .filter(([, a]) => a.back === isBack)
      .map(([id, a]) => `<option value="${id}"${s.anchor === id ? " selected" : ""}>${esc(a.label)}</option>`).join("");
  };
  const rows = cf.slots.map((s, i) => `
    <div class="fc-slot-row">
      <span class="fc-slot-n">${i + 1}</span>
      <select class="form-input fc-select" data-fc-pos="${i}" aria-label="Player ${i + 1} position">${posOpts(s.pos)}</select>
      <select class="form-input fc-select fc-select-anchor" data-fc-anchor="${i}" aria-label="Player ${i + 1} alignment">${anchorOpts(s)}</select>
    </div>`).join("");
  const qbRow = Object.keys(QB_DEPTH).map((k) => `<button type="button" class="def-preset fc-qb${(cf.qb || "gun") === k ? " active" : ""}" data-fc-qb="${k}"><span class="def-preset-name">${k === "under" ? "Under Center" : k === "pistol" ? "Pistol" : "Shotgun"}</span></button>`).join("");
  // A compile failure is an error like any other — it just found the problem a
  // layer deeper than the legality pass did.
  const errs = built.why ? [...v.errors, built.why] : v.errors;
  const problems = errs.length ? errs.map((e) => `<div class="pb-msg err">⛔ ${esc(e)}</div>`).join("") : "";
  const warns = v.warnings.length ? v.warnings.map((w) => `<div class="pb-msg fc-warn">⚠️ ${esc(w)}</div>`).join("") : "";
  const derived = c ? `
    <div class="fc-derived">
      <div class="play-preview-head">${_persStr(c.pkg)} \xB7 plays from the <b>${esc(c.archetype)}</b> family (${c.playbook.length} calls)</div>
      <div class="gp-tip tip-info">▸ The rulebook sets the numbers: your formation inherits the ${esc(c.archetype)} identity, its call sheet filtered to what this alignment can run, and NO matchup edges — a designed look can never out-tune a shipped one.</div>
    </div>` : "";
  const preview = c ? renderFormationDiagram(cf.name || "Custom", { slots: c.layout.slots, w: 260, h: 160 }) : `<div class="mm-lib-empty muted">${errs.length ? "Fix the errors above to see the alignment." : "This alignment can't be drawn yet."}</div>`;
  return `<div class="creator-hub">
    <div class="creator-hub-head"><div class="creator-title">Formation Designer</div>
      <div class="creator-sub">Place your five. The five linemen and the rulebook handle the rest.</div></div>
    <div class="gp-row"><label class="gp-label">Name</label>
      <input id="fc-name" class="form-input pb-name" maxlength="20" value="${esc(cf.name || "")}" placeholder="e.g. Bearcat Trips" /></div>
    <div class="gp-row"><label class="gp-label">Quarterback</label>
      <div class="def-preset-row">${qbRow}</div></div>
    <div class="gp-row"><label class="gp-label">The five</label>${rows}</div>
    ${problems}${warns}
    <div class="gp-row"><label class="gp-label">The look</label><div class="fc-preview">${preview}</div></div>
    ${derived}
    <div class="pb-actions">
      <button class="btn-mm btn-mm-new" id="fc-save"${v.ok && c ? "" : " disabled"}>\u{1F4BE} Save formation</button>
      <button class="btn-mm btn-mm-secondary" data-form-back="1">← All formations</button>
    </div>
  </div>`;
}

function renderFormTab() {
  return `<div class="creator-wrapper">${_f() ? renderFormEditor() : renderFormList()}</div>`;
}

function formListeners() {
  document.querySelectorAll("[data-form-new]").forEach((b) => b.addEventListener("click", () => {
    state.ui.form = emptyCustomFormation();
    state.ui.formId = null;
    rerender();
  }));
  document.querySelectorAll("[data-form-open]").forEach((b) => b.addEventListener("click", () => {
    const data = loadCreationData("formations", b.dataset.formOpen);
    if (!data) return;
    state.ui.form = data;
    state.ui.formId = b.dataset.formOpen;
    rerender();
  }));
  document.querySelectorAll("[data-form-del]").forEach((b) => b.addEventListener("click", () => {
    deleteCreation("formations", b.dataset.formDel);
    resyncFormations();
    rerender();
  }));
  document.querySelectorAll("[data-form-back]").forEach((b) => b.addEventListener("click", () => {
    state.ui.form = null;
    state.ui.formId = null;
    rerender();
  }));
  const cf = _f();
  if (!cf) return;
  const nameEl = document.getElementById("fc-name");
  if (nameEl) nameEl.addEventListener("change", () => {
    cf.name = nameEl.value.slice(0, 20);
    rerender();
  });
  document.querySelectorAll("[data-fc-qb]").forEach((b) => b.addEventListener("click", () => {
    cf.qb = b.dataset.fcQb;
    rerender();
  }));
  document.querySelectorAll("[data-fc-pos]").forEach((el) => el.addEventListener("change", () => {
    const i = parseInt(el.dataset.fcPos, 10);
    const s = cf.slots[i];
    if (!s) return;
    s.pos = el.value;
    // position families live in different anchor sets — snap to a legal one
    const isBack = s.pos === "RB" || s.pos === "FB";
    if (FORM_ANCHORS[s.anchor] && FORM_ANCHORS[s.anchor].back !== isBack) {
      const taken = new Set(cf.slots.filter((x) => x !== s).map((x) => x.anchor));
      const first = Object.entries(FORM_ANCHORS).find(([id, a]) => a.back === isBack && !taken.has(id));
      s.anchor = first ? first[0] : s.anchor;
    }
    rerender();
  }));
  document.querySelectorAll("[data-fc-anchor]").forEach((el) => el.addEventListener("change", () => {
    const i = parseInt(el.dataset.fcAnchor, 10);
    if (cf.slots[i]) cf.slots[i].anchor = el.value;
    rerender();
  }));
  const saveBtn = document.getElementById("fc-save");
  if (saveBtn) saveBtn.addEventListener("click", () => {
    const v = validateCustomFormation(cf);
    if (!v.ok) { notify(`⛔ ${v.errors[0]}`); return; }
    const r = saveCreation("formations", cf.name, cf, state.ui.formId ? { id: state.ui.formId } : {});
    if (!r.ok) { notify(r.reason === "full" ? `The shelf is full (${r.cap}). Delete one first.` : "Couldn't save the formation."); return; }
    state.ui.formId = r.id;
    resyncFormations();
    // M1: on save, every fitting concept is auto-installed (the registry's
    // call list IS the shared fits-function's answer) — then the bench opens
    // on the new look so the first thing you do with a formation is TEST it.
    const c = _tryCompile(cf);
    state.ui.form = null;
    state.ui.formId = null;
    if (c && c.playbook.length) {
      notify(`\u{1F4BE} ${cf.name} saved — ${c.playbook.length} fitting concepts installed. Take it to the bench.`);
      state.ui.bench = {
        formationId: c.id, variation: null, concept: c.playbook[0],
        defLook: { front: "4-3", coverage: "c3", bring: "4" }
      };
      state.ui.benchReturn = null; // Workshop entrance — bench-back goes home
      navigate("bench");
      return;
    }
    notify(`\u{1F4BE} ${cf.name} saved — it's now a formation your playbooks can carry.`);
    rerender();
  });
}

export { renderFormTab, formListeners, resyncFormations };
