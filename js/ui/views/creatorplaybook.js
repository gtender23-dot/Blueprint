import { state, rerender, notify, navigate } from '../../state.js';
import { FORMATION_PACKAGES, FORMATION_PLAYBOOK, FORMATION_VARIATIONS, aliasFormation } from '../../constants.js';
import { emptyPlaybook, validatePlaybook, legalConceptsForFormation, fittingConceptsForFormation, lookSheetKey, resolveLookSheet } from '../../engine/playbook.js';
import { listCreations, loadCreationData, saveCreation, deleteCreation } from '../../engine/creator.js';
import { DEFAULT_OFF_BOOKS, autoSheetForFormation } from '../../engine/defaultbooks.js';
import { renderFormationDiagram, renderConceptThumb } from './routeart.js';

// "1 RB · 1 TE · 3 WR" from a personnel package object
function persStr(p) {
  const o = p || {};
  return ["RB", "FB", "TE", "WR"].filter((k) => o[k]).map((k) => `${o[k]} ${k}`).join(" · ") || "—";
}
function personnelStr(fid) { return persStr(FORMATION_PACKAGES[fid]); }
// A variation can override the personnel (e.g. Power-I "Big" = 3 TE, 0 WR)
function variationPers(fid, varKey) {
  const vset = FORMATION_VARIATIONS[fid];
  const pkg = vset && vset[varKey] && vset[varKey].pkg;
  return pkg ? persStr({ ...(FORMATION_PACKAGES[fid] || {}), ...pkg }) : personnelStr(fid);
}
// The formation a playbook leans on most, for the list thumbnail
function topFormation(book) {
  const fs = (book.formations || []).slice().sort((a, b) => (b.weight || 0) - (a.weight || 0));
  return fs.length ? aliasFormation(fs[0].id) : null;
}

// ── Playbook Builder (Creativity Tools UI) — formation-first ───────────────
// Assembles a customPlaybook (js/engine/playbook.js): pick formations, pick each
// formation's plays from its legal list, save to the global library. All the
// engine — legality, validation, save/load — is done and probe-proven; this is
// the screen on top. Editor state lives in state.ui.pb.
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function _pb() { return state.ui.pb; }

// Distinct plays across every sheet (base + per-look forks) — a fork of the
// same play never double-counts in the "N plays" meta line.
function distinctPlays(sheets) {
  return new Set(Object.values(sheets || {}).flatMap((s) => Object.keys(s || {}))).size;
}
function renderPlaybookList() {
  const books = listCreations("playbooks");
  const rows = books.length ? books.map((b) => {
    const tf = topFormation(b.data);
    const plays = distinctPlays(b.data.sheets);
    const thumb = tf ? `<span class="pb-row-thumb">${renderFormationDiagram(tf, { w: 120, h: 76 })}</span>` : `<span class="play-row-thumb-named">📋</span>`;
    return `<div class="pb-row play-row">
      <button class="pb-row-open" data-pb-open="${esc(b.id)}">${thumb}<span class="play-row-copy"><span class="pb-row-name">${esc(b.name)}</span><span class="pb-row-meta">${(b.data.formations || []).length} formations · ${plays} plays</span></span></button>
      <button class="pb-row-preview" data-pb-preview="${esc(b.id)}" title="Preview playbook" aria-label="Preview ${esc(b.name)}">👁</button>
      <button class="btn-mm-del" data-pb-del="${esc(b.id)}" title="Delete" aria-label="Delete ${esc(b.name)}">✕</button>
    </div>`;
  }).join("") : `<div class="mm-lib-empty muted">No playbooks yet. Build one — pick formations, pick their plays, save.</div>`;
  return `<div class="creator-hub">
    <div class="creator-hub-head"><div class="creator-title">Playbook Builder</div>
      <div class="creator-sub">Pick formations, choose each one's plays, save a system you can load into any world.</div></div>
    <div class="pb-list">${rows}</div>
    <div class="def-section-head">Start from a scheme <span class="muted">— complete books, edit anything, save as your own</span></div>
    <div class="def-preset-row">${DEFAULT_OFF_BOOKS.map((b) => `<button type="button" class="def-preset" data-pb-preset="${esc(b.name)}"><span class="def-preset-name">${esc(b.name)}</span><span class="def-preset-sub">${(b.formations || []).length} looks · ${distinctPlays(b.sheets)} plays</span></button>`).join("")}</div>
    <div class="pb-actions">
      <button class="btn-mm btn-mm-new" data-pb-new="1">＋ Blank Playbook</button>
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
    const legal = legalConceptsForFormation(fid);
    const vset = FORMATION_VARIATIONS[fid];
    // A formation can carry SEVERAL looks at once — Base + any variations — each a
    // separate weighted entry in pb.formations (same id, different .variation).
    const entryFor = (vk) => (pb.formations || []).find((f) => aliasFormation(f.id) === fid && (f.variation || "") === vk);
    const looks = [{ key: "", label: "Base", pers: personnelStr(fid) }].concat(
      Object.entries(vset || {}).map(([vk, vd]) => ({ key: vk, label: vd.label, pers: variationPers(fid, vk) }))
    );
    const onLooks = looks.filter((l) => entryFor(l.key));
    const anyOn = onLooks.length > 0;
    // ── M2 per-look sheets (#43): each LOOK edits its own plays ─────────────
    // A look without its own sheet INHERITS the base sheet (shown as such);
    // the first edit forks it. The expanded grid always belongs to ONE look.
    const openLook = expand && expand.indexOf("|") >= 0 && expand.slice(0, expand.indexOf("|")) === fid ? expand.slice(expand.indexOf("|") + 1) : null;
    const open = openLook != null && !!entryFor(openLook);
    const sheetOf = (vk) => resolveLookSheet(pb.sheets, fid, vk || null) || {};
    const ownSheet = (vk) => {
      const s = pb.sheets && pb.sheets[lookSheetKey(fid, vk || null)];
      return s && Object.keys(s).length ? s : null;
    };
    let concepts = "";
    if (anyOn && open) {
      const vk = openLook;
      const sheet = sheetOf(vk);
      const inherited = !!vk && !ownSheet(vk);
      const fits = new Set(fittingConceptsForFormation(fid, vk || undefined));
      const lookLabel = vk ? (vset && vset[vk] && vset[vk].label) || vk : "Base";
      const pill = vk ? inherited
        ? `<span class="pb-sheet-pill muted">inherits the ${esc(fid)} base sheet — first edit gives ${esc(lookLabel)} its own</span>`
        : `<span class="pb-sheet-pill">its own sheet <button type="button" class="pb-unfork" data-pb-unfork="${esc(fid)}|${esc(vk)}" title="Drop this look's sheet and inherit the base sheet again">↩ inherit base</button></span>`
        : `<span class="pb-sheet-pill muted">the ${esc(fid)} base sheet — looks without their own sheet inherit it</span>`;
      concepts = `<div class="pb-sheet-head"><b>${esc(fid)}${vk ? ` · ${esc(lookLabel)}` : ""}</b> ${pill}</div>
      <div class="concept-grid">${legal.map((c) => {
        const sel = sheet[c] != null;
        const misfit = !fits.has(c);
        return `<button type="button" class="concept-card${sel ? " on" : ""}${misfit ? " misfit" : ""}" data-pb-concept="${esc(fid)}|${esc(vk)}|${esc(c)}" aria-pressed="${sel}"${misfit ? ` title="Doesn't fit this look's personnel"` : ""}>
        <span class="concept-card-thumb">${renderConceptThumb(c, { w: 120, h: 72, scale: 0.72, formation: fid })}</span>
        <span class="concept-card-name">${esc(c)}${misfit ? " ⚠" : ""}</span>
        <span class="concept-card-test" data-pb-testc="${esc(fid)}|${esc(c)}" title="Test ${esc(c)} on the bench" role="button">🧪</span>
      </button>`;
      }).join("")}</div>`;
    }
    const lookGrid = `<div class="fb-look-grid">${looks.map((l) => {
      const e = entryFor(l.key);
      const inc = !!e;
      const nOn = inc ? Object.keys(sheetOf(l.key)).length : 0;
      const forked = inc && !!l.key && !!ownSheet(l.key);
      const isOpen = open && openLook === l.key;
      return `<div class="fb-look-card${inc ? " on" : ""}">
        <button type="button" class="fb-look-pick" data-pb-look="${esc(fid)}|${esc(l.key)}" title="${esc(l.pers)}">
          <span class="fb-look-dia">${renderFormationDiagram(fid, { variation: l.key || undefined, w: 118, h: 74 })}</span>
          <span class="fb-look-name">${esc(l.label)}${inc ? " ✓" : ""}</span>
          <span class="fb-look-pers">${esc(l.pers)}</span>
        </button>
        ${inc ? `<label class="fb-look-wlbl">Usage <input class="pb-weight fb-look-weight" type="number" min="0" max="99" value="${e.weight != null ? e.weight : 0}" data-pb-lookweight="${esc(fid)}|${esc(l.key)}"/></label>` : ""}
        ${inc ? `<button type="button" class="fb-look-plays pb-expand" data-pb-expand="${esc(fid)}|${esc(l.key)}">${isOpen ? "Hide plays ▴" : `Plays (${nOn}${l.key && !forked ? " · base" : ""}) ▾`}</button>` : ""}
        <button type="button" class="fb-look-test" data-pb-test="${esc(fid)}|${esc(l.key)}" title="Test this look on the bench">🧪 Test</button>
      </div>`;
    }).join("")}</div>`;
    const nDistinct = anyOn ? new Set(onLooks.flatMap((l) => Object.keys(sheetOf(l.key)))).size : 0;
    return `<div class="pb-form fb-card${anyOn ? " on" : ""}${open ? " open" : ""}">
      <div class="fb-card-head-lite">
        <span class="fb-card-name">${esc(fid)}</span>
        ${anyOn ? `<span class="fb-card-count">${onLooks.length} look${onLooks.length === 1 ? "" : "s"} · ${nDistinct} play${nDistinct === 1 ? "" : "s"}</span>` : `<span class="fb-card-add muted">pick a look to add</span>`}
      </div>
      ${lookGrid}
      ${concepts}
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
// A read-only browse of a saved playbook: every formation with its chosen plays
// drawn as cards — like flipping through the book in-game.
function renderPlaybookPreview() {
  const id = state.ui.pbPreview;
  const data = loadCreationData("playbooks", id);
  if (!data) { state.ui.pbPreview = null; return renderPlaybookList(); }
  const forms = (data.formations || []).slice().sort((a, b) => (b.weight || 0) - (a.weight || 0));
  const sections = forms.map((f) => {
    const fid = aliasFormation(f.id);
    // M2: each look previews ITS sheet — own fork, or the inherited base
    const sheet = resolveLookSheet(data.sheets, fid, f.variation || null) || {};
    const plays = Object.keys(sheet);
    const cards = plays.length
      ? plays.map((c) => `<div class="concept-card is-static"><span class="concept-card-thumb">${renderConceptThumb(c, { w: 120, h: 72, scale: 0.72, formation: fid })}</span><span class="concept-card-name">${esc(c)}</span></div>`).join("")
      : `<div class="muted pbv-empty">No plays chosen for this formation.</div>`;
    const vset = FORMATION_VARIATIONS[fid];
    const vLabel = f.variation && vset && vset[f.variation] ? vset[f.variation].label : null;
    const persText = f.variation ? variationPers(fid, f.variation) : personnelStr(fid);
    return `<section class="pbv-form">
      <div class="pbv-form-head">
        <span class="pbv-form-diagram">${renderFormationDiagram(fid, { w: 130, h: 84, variation: f.variation || undefined })}</span>
        <span class="pbv-form-meta"><span class="pbv-form-name">${esc(fid)}${vLabel ? ` <span class="fb-var-tag">${esc(vLabel)}</span>` : ""}</span><span class="pbv-form-sub">${esc(persText)} · ${plays.length} play${plays.length === 1 ? "" : "s"} · usage ${f.weight != null ? f.weight : 0}</span></span>
      </div>
      <div class="concept-grid pbv-grid">${cards}</div>
    </section>`;
  }).join("");
  return `<div class="creator-hub pbv">
    <div class="creator-hub-head"><div class="creator-title">${esc(data.name)}</div>
      <div class="creator-sub">${forms.length} formation${forms.length === 1 ? "" : "s"} · playbook preview</div></div>
    ${sections || `<div class="mm-lib-empty muted">This playbook has no formations yet.</div>`}
    <div class="pb-actions">
      <button class="btn-mm btn-mm-new" data-pbv-edit="${esc(id)}">Edit this playbook</button>
      <button class="btn-mm btn-mm-secondary" data-pbv-close="1">← Playbooks</button>
    </div>
  </div>`;
}
function renderPlaybooksTab() {
  const inner = state.ui.pbPreview ? renderPlaybookPreview() : _pb() ? renderPlaybookEditor() : renderPlaybookList();
  return `<div class="creator-wrapper">${inner}</div>`;
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
  document.querySelectorAll("[data-pb-preview]").forEach((b) => b.addEventListener("click", () => {
    state.ui.pbPreview = b.dataset.pbPreview; rerender();
  }));
  document.querySelector("[data-pbv-close]")?.addEventListener("click", () => { state.ui.pbPreview = null; rerender(); });
  document.querySelector("[data-pbv-edit]")?.addEventListener("click", (e) => {
    const id = e.currentTarget.dataset.pbvEdit;
    const data = loadCreationData("playbooks", id);
    if (data) { state.ui.pb = { ...data }; state.ui.pbId = id; state.ui.pbExpand = null; }
    state.ui.pbPreview = null; rerender();
  });
  document.querySelector("[data-pb-new]")?.addEventListener("click", () => {
    state.ui.pb = emptyPlaybook("My Playbook"); state.ui.pbId = null; state.ui.pbExpand = null; rerender();
  });
  document.querySelectorAll("[data-pb-preset]").forEach((b) => b.addEventListener("click", () => {
    const book = DEFAULT_OFF_BOOKS.find((x) => x.name === b.dataset.pbPreset);
    if (!book) return;
    state.ui.pb = JSON.parse(JSON.stringify(book)); state.ui.pbId = null; state.ui.pbExpand = null; rerender();
  }));
  // editor — add/remove a LOOK (base or a variation); each is its own weighted entry
  document.querySelectorAll("[data-pb-look]").forEach((b) => b.addEventListener("click", () => {
    _syncName();
    const raw = b.dataset.pbLook; const sep = raw.indexOf("|");
    const fid = aliasFormation(raw.slice(0, sep)); const vk = raw.slice(sep + 1);
    const pb = _pb(); pb.formations = pb.formations || [];
    const idx = pb.formations.findIndex((f) => aliasFormation(f.id) === fid && (f.variation || "") === vk);
    if (idx >= 0) {
      pb.formations.splice(idx, 1);
      // M2 per-look sheets: a removed variation look takes its FORK with it;
      // when the formation's last look leaves, the base sheet and every
      // remaining fork go too.
      if (vk && pb.sheets) delete pb.sheets[lookSheetKey(fid, vk)];
      if (!pb.formations.some((f) => aliasFormation(f.id) === fid)) {
        if (pb.sheets) for (const k of Object.keys(pb.sheets)) { if (k === fid || k.startsWith(fid + "|")) delete pb.sheets[k]; }
      }
      if (state.ui.pbExpand === `${fid}|${vk}`) state.ui.pbExpand = null;
    } else {
      const entry = { id: fid, weight: 25 }; if (vk) entry.variation = vk;
      pb.formations.push(entry); state.ui.pbExpand = `${fid}|${vk}`;
      // #23 auto-select: a look arrives with its FITTING plays already chosen
      // (the one shared fits-function), seeded with the SHIPPED sheet weights —
      // not a flat everything-equal book. Deselect freely. Per-look law (M2):
      // the BASE look seeds the base sheet; a variation look added while a
      // base sheet exists simply INHERITS it (no fork until edited); a
      // variation look added with no base sheet seeds its OWN sheet, so its
      // auto-selection fits ITS personnel.
      pb.sheets = pb.sheets || {};
      const baseLive = pb.sheets[fid] && Object.keys(pb.sheets[fid]).length;
      if (!vk) {
        if (!baseLive) {
          const seeded = autoSheetForFormation(fid);
          if (Object.keys(seeded).length) pb.sheets[fid] = seeded;
        }
      } else if (!baseLive) {
        const key = lookSheetKey(fid, vk);
        if (!pb.sheets[key] || !Object.keys(pb.sheets[key]).length) {
          const seeded = autoSheetForFormation(fid, vk);
          if (Object.keys(seeded).length) pb.sheets[key] = seeded;
        }
      }
    }
    rerender();
  }));
  // M2: drop a look's forked sheet — it inherits the base sheet again
  document.querySelectorAll("[data-pb-unfork]").forEach((b) => b.addEventListener("click", (e) => {
    e.stopPropagation();
    _syncName();
    const raw = b.dataset.pbUnfork; const sep = raw.indexOf("|");
    const fid = aliasFormation(raw.slice(0, sep)); const vk = raw.slice(sep + 1);
    const pb = _pb();
    if (pb && pb.sheets) delete pb.sheets[lookSheetKey(fid, vk)];
    rerender();
  }));
  // ── M1 test-bench entrance: any BUILT-IN look or concept, one tap ─────────
  const benchDefaults = () => ({ front: "4-3", coverage: "c3", bring: "4" });
  document.querySelectorAll("[data-pb-test]").forEach((b) => b.addEventListener("click", () => {
    _syncName();
    const raw = b.dataset.pbTest; const sep = raw.indexOf("|");
    const fid = aliasFormation(raw.slice(0, sep)); const vk = raw.slice(sep + 1) || null;
    const pb = _pb();
    // M2: the bench opens on the LOOK's resolved sheet (own fork or inherited)
    const sheet = (pb && resolveLookSheet(pb.sheets, fid, vk)) || {};
    const top = Object.entries(sheet).sort((a, b2) => (b2[1] || 0) - (a[1] || 0)).map((e) => e[0])[0];
    const concept = top || fittingConceptsForFormation(fid, vk || undefined)[0] || null;
    if (!concept) { notify("No play fits this look yet", "warning"); return; }
    state.ui.bench = { formationId: fid, variation: vk, concept, defLook: benchDefaults() };
    navigate("bench");
  }));
  document.querySelectorAll("[data-pb-testc]").forEach((el) => el.addEventListener("click", (e) => {
    e.stopPropagation();
    _syncName();
    const raw = el.dataset.pbTestc; const sep = raw.indexOf("|");
    const fid = aliasFormation(raw.slice(0, sep)); const concept = raw.slice(sep + 1);
    const pb = _pb();
    const entry = (pb && pb.formations || []).find((f) => aliasFormation(f.id) === fid);
    state.ui.bench = { formationId: fid, variation: (entry && entry.variation) || null, concept, defLook: benchDefaults() };
    navigate("bench");
  }));
  document.querySelectorAll("[data-pb-expand]").forEach((b) => b.addEventListener("click", () => {
    _syncName();
    state.ui.pbExpand = state.ui.pbExpand === b.dataset.pbExpand ? null : b.dataset.pbExpand;
    rerender();
  }));
  document.querySelectorAll("[data-pb-lookweight]").forEach((el) => el.addEventListener("change", () => {
    const raw = el.dataset.pbLookweight; const sep = raw.indexOf("|");
    const fid = aliasFormation(raw.slice(0, sep)); const vk = raw.slice(sep + 1);
    const f = _pb().formations.find((x) => aliasFormation(x.id) === fid && (x.variation || "") === vk);
    if (f) f.weight = Math.max(0, Math.min(99, +el.value || 0));
  }));
  document.querySelectorAll("[data-pb-concept]").forEach((el) => el.addEventListener("click", () => {
    _syncName();
    // M2 per-look (#43): "fid|vk|concept" — the edit lands on THAT look.
    const raw = el.dataset.pbConcept;
    const s1 = raw.indexOf("|"), s2 = raw.indexOf("|", s1 + 1);
    const fid = aliasFormation(raw.slice(0, s1));
    const vk = raw.slice(s1 + 1, s2) || null;
    const concept = raw.slice(s2 + 1);
    const pb = _pb();
    pb.sheets = pb.sheets || {};
    const key = lookSheetKey(fid, vk);
    // FORK ON FIRST EDIT: a variation look editing while it still inherits
    // copies the base sheet byte-for-byte, then edits the copy — the base and
    // every other look stay untouched (the #43 echo, killed).
    if (vk && !(pb.sheets[key] && Object.keys(pb.sheets[key]).length)) {
      pb.sheets[key] = { ...(pb.sheets[fid] || {}) };
    }
    pb.sheets[key] = pb.sheets[key] || {};
    if (pb.sheets[key][concept] != null) delete pb.sheets[key][concept];
    else pb.sheets[key][concept] = 50;
    if (!Object.keys(pb.sheets[key]).length) delete pb.sheets[key];
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
