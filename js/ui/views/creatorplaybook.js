import { state, rerender, notify, navigate, getPlayerSchool } from '../../state.js';
import { FORMATION_PACKAGES, FORMATION_PLAYBOOK, FORMATION_VARIATIONS, aliasFormation } from '../../constants.js';
import { emptyPlaybook, validatePlaybook, fittingConceptsForFormation, lookSheetKey, resolveLookSheet } from '../../engine/playbook.js';
import { applyEditedBookToSchool, pushBookToWorkshop } from '../../engine/bookpush.js';
import { listCreations, loadCreationData, saveCreation, deleteCreation } from '../../engine/creator.js';
import { DEFAULT_OFF_BOOKS } from '../../engine/defaultbooks.js';
import { renderFormationDiagram, renderConceptThumb, playAssignments } from './routeart.js';
import { conceptBlurb } from './conceptblurbs.js';

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
// Every play that FITS a look's personnel, all selected, at a flat weight
// (owner, 2026-08-18). A variation is its OWN formation: the empty look never
// carries a handoff, because a back-needing play doesn't fit empty personnel
// and is never added. fittingConceptsForFormation is variation-aware; passing
// the variation is what makes a look independent of its base.
function allFittingSheet(fid, vk) {
  const sheet = {};
  for (const c of fittingConceptsForFormation(fid, vk || undefined)) sheet[c] = 50;
  return sheet;
}
// ── M5 embedded editing (#39): the SAME editor, opened from the Game Plan ───
// state.ui.pbContext === "career" means the book being edited is the one the
// coach CARRIES in his dynasty/season — Save writes it to the league save
// (applyEditedBookToSchool), and "Push to Workshop" copies it to the library
// and restamps the source identity so the update banner can't fire about your
// own push. The Workshop path (pbContext unset) is unchanged.
function _career() { return state.ui.pbContext === "career"; }

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
  const v = validatePlaybook(pb);
  const formRows = Object.keys(FORMATION_PACKAGES).map((fid) => {
    const vset = FORMATION_VARIATIONS[fid];
    // A formation can carry SEVERAL looks at once — Base + any variations — each
    // a separate weighted entry in pb.formations (same id, different .variation).
    const entryFor = (vk) => (pb.formations || []).find((f) => aliasFormation(f.id) === fid && (f.variation || "") === vk);
    const looks = [{ key: "", label: "Base", pers: personnelStr(fid) }].concat(
      Object.entries(vset || {}).map(([vk, vd]) => ({ key: vk, label: vd.label, pers: variationPers(fid, vk) }))
    );
    const onLooks = looks.filter((l) => entryFor(l.key));
    const anyOn = onLooks.length > 0;
    // Each look owns its own sheet now (no inherit-base). "Plays (N)" opens the
    // dedicated plays screen for that one look — the grid, info, and test live
    // there, not inline, so this card stays a compact list row.
    const sheetOf = (vk) => (pb.sheets && pb.sheets[lookSheetKey(fid, vk || null)]) || resolveLookSheet(pb.sheets, fid, vk || null) || {};
    const lookGrid = `<div class="fb-look-grid">${looks.map((l) => {
      const e = entryFor(l.key);
      const inc = !!e;
      const nOn = inc ? Object.keys(sheetOf(l.key)).length : 0;
      return `<div class="fb-look-card${inc ? " on" : ""}">
        <button type="button" class="fb-look-pick" data-pb-look="${esc(fid)}|${esc(l.key)}" title="${esc(l.pers)}">
          <span class="fb-look-dia">${renderFormationDiagram(fid, { variation: l.key || undefined, w: 118, h: 74 })}</span>
          <span class="fb-look-name">${esc(l.label)}${inc ? " ✓" : ""}</span>
          <span class="fb-look-pers">${esc(l.pers)}</span>
        </button>
        ${inc ? `<label class="fb-look-wlbl">Usage <input class="pb-weight fb-look-weight" type="number" min="0" max="99" value="${e.weight != null ? e.weight : 0}" data-pb-lookweight="${esc(fid)}|${esc(l.key)}"/></label>` : ""}
        ${inc ? `<button type="button" class="fb-look-plays" data-pb-plays="${esc(fid)}|${esc(l.key)}">Plays (${nOn}) →</button>` : ""}
        <button type="button" class="fb-look-test" data-pb-test="${esc(fid)}|${esc(l.key)}" title="Test this look on the bench">🧪 Test</button>
      </div>`;
    }).join("")}</div>`;
    const nDistinct = anyOn ? new Set(onLooks.flatMap((l) => Object.keys(sheetOf(l.key)))).size : 0;
    return `<div class="pb-form fb-card${anyOn ? " on" : ""}">
      <div class="fb-card-head-lite">
        <span class="fb-card-name">${esc(fid)}</span>
        ${anyOn ? `<span class="fb-card-count">${onLooks.length} look${onLooks.length === 1 ? "" : "s"} · ${nDistinct} play${nDistinct === 1 ? "" : "s"}</span>` : `<span class="fb-card-add muted">pick a look to add</span>`}
      </div>
      ${lookGrid}
    </div>`;
  }).join("");
  const msg = v.errors.length ? `<div class="pb-msg err">${esc(v.errors[0])}</div>` : v.warnings.length ? `<div class="pb-msg warn">${esc(v.warnings[0])}</div>` : `<div class="pb-msg ok">Ready to save.</div>`;
  const career = _career();
  return `<div class="creator-hub">
    <div class="creator-hub-head"><div class="creator-title">${career ? "Edit Your Playbook" : "Playbook Builder"}</div>
      ${career ? `<div class="creator-sub">The book you carry — Save keeps the edit in this ${state.seasonMode ? "season" : "dynasty"}'s save. Push it to the Workshop to keep a library copy you can load anywhere.</div>` : ""}</div>
    <input class="form-input pb-name" id="pb-name" type="text" maxlength="36" placeholder="Playbook name" value="${esc(pb.name || "")}"/>
    ${msg}
    <div class="pb-forms">${formRows}</div>
    <div class="pb-actions">
      <button class="btn-mm btn-mm-new" data-pb-save="1"${v.errors.length ? " disabled" : ""}>${career ? "Save to My Season" : "Save Playbook"}</button>
      ${career ? `<button class="btn-mm btn-mm-secondary" data-pb-push="1"${v.errors.length ? " disabled" : ""}>⤴ Push to Workshop</button>` : ""}
      <button class="btn-mm btn-mm-secondary" data-pb-cancel="1">Cancel</button>
    </div>
  </div>`;
}
// ── The Plays screen (owner, 2026-08-18) ────────────────────────────────────
// One look's play grid, on its own page — moved out of the builder so the
// builder stays a clean list and the grid never reflows a responsive card row.
// Every legal play for the look is a card; the selected ones are lit; tapping
// toggles. Info (every man's job) opens inline here where there's room, and the
// bench test lives here too. state.ui.pbPlays = { fid, vk } is the open look.
function renderPlaysScreen() {
  const pb = _pb();
  const sel = state.ui.pbPlays || {};
  const fid = aliasFormation(sel.fid);
  const vk = sel.vk || "";
  const vset = FORMATION_VARIATIONS[fid];
  const entry = (pb && pb.formations || []).find((f) => aliasFormation(f.id) === fid && (f.variation || "") === vk);
  if (!pb || !entry) { state.ui.pbPlays = null; return renderPlaybookEditor(); }
  const lookLabel = vk ? (vset && vset[vk] && vset[vk].label) || vk : "Base";
  // A look shows only the plays that FIT its personnel — a variation is its own
  // formation (owner, 2026-08-18), so there are no misfits to grey out.
  const fits = fittingConceptsForFormation(fid, vk || undefined);
  pb.sheets = pb.sheets || {};
  const key = lookSheetKey(fid, vk || null);
  const sheet = pb.sheets[key] || {};
  const onN = Object.keys(sheet).length;
  const persText = vk ? variationPers(fid, vk) : personnelStr(fid);
  // The play-info panel (every man's job) opens for one concept at a time.
  const info = state.ui.pbInfo && state.ui.pbInfo.fid === fid && (state.ui.pbInfo.vk || "") === (vk || "") ? state.ui.pbInfo : null;
  let infoPanel = "";
  if (info && fits.includes(info.concept)) {
    const blurb = conceptBlurb(info.concept);
    const jobs = playAssignments({ name: info.concept }, { formation: fid, variation: vk || undefined });
    infoPanel = `<div class="pb-cinfo">
      <div class="pb-cinfo-head"><span class="pb-cinfo-name">${esc(info.concept)}</span><button type="button" class="btn-mm-del" data-pb-infoclose="1" aria-label="Close play info">✕</button></div>
      ${blurb ? `<div class="pb-cinfo-blurb">${esc(blurb)}</div>` : ""}
      <span class="pb-cinfo-art">${renderConceptThumb(info.concept, { w: 340, h: 215, formation: fid, variation: vk || undefined, jobs: true })}</span>
      <div class="cs-jobs-list">${jobs.rows.map((r) => `<div class="cs-job-row"><b>${esc(r.label)}</b><span class="cs-job-pos">${esc(r.pos)}</span><span class="cs-job-text">${esc(r.job)}</span></div>`).join("")}</div>
    </div>`;
  }
  const grid = `<div class="concept-grid">${fits.map((c) => {
    const on = sheet[c] != null;
    return `<button type="button" class="concept-card${on ? " on" : ""}" data-pb-concept="${esc(fid)}|${esc(vk)}|${esc(c)}" aria-pressed="${on}" title="${esc(conceptBlurb(c) || c)}">
      <span class="concept-card-thumb">${renderConceptThumb(c, { w: 120, h: 72, scale: 0.72, formation: fid, variation: vk || undefined })}</span>
      <span class="concept-card-name">${esc(c)}</span>
      <span class="concept-card-info" data-pb-cinfo="${esc(fid)}|${esc(vk)}|${esc(c)}" title="Every man's job on ${esc(c)}" role="button">ℹ</span>
      <span class="concept-card-test" data-pb-testc="${esc(fid)}|${esc(c)}" title="Test ${esc(c)} on the bench" role="button">🧪</span>
    </button>`;
  }).join("")}</div>`;
  return `<div class="creator-hub pb-plays-screen">
    <div class="creator-hub-head">
      <div class="pb-plays-title-row">
        <span class="pb-plays-dia">${renderFormationDiagram(fid, { variation: vk || undefined, w: 130, h: 84 })}</span>
        <div>
          <div class="creator-title">${esc(fid)}${vk ? ` · ${esc(lookLabel)}` : ""}</div>
          <div class="creator-sub">${esc(persText)} · ${onN} of ${fits.length} plays on — tap to toggle</div>
        </div>
      </div>
    </div>
    <div class="pb-plays-tools">
      <button type="button" class="btn-ghost btn-sm" data-pb-allon="1">Select all</button>
      <button type="button" class="btn-ghost btn-sm" data-pb-alloff="1">Clear all</button>
    </div>
    ${infoPanel}
    ${grid}
    <div class="pb-actions">
      <button class="btn-mm btn-mm-new" data-pb-plays-back="1">← Done — back to the book</button>
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
      ? plays.map((c) => `<div class="concept-card is-static"${conceptBlurb(c) ? ` title="${esc(conceptBlurb(c))}"` : ""}><span class="concept-card-thumb">${renderConceptThumb(c, { w: 120, h: 72, scale: 0.72, formation: fid, variation: f.variation || undefined })}</span><span class="concept-card-name">${esc(c)}</span></div>`).join("")
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
  const inner = state.ui.pbPreview ? renderPlaybookPreview()
    : state.ui.pbPlays && _pb() ? renderPlaysScreen()
    : _pb() ? renderPlaybookEditor()
    : renderPlaybookList();
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
    if (data) { state.ui.pb = { ...data }; state.ui.pbId = id; state.ui.pbPlays = null; rerender(); }
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
    if (data) { state.ui.pb = { ...data }; state.ui.pbId = id; state.ui.pbPlays = null; }
    state.ui.pbPreview = null; rerender();
  });
  document.querySelector("[data-pb-new]")?.addEventListener("click", () => {
    state.ui.pb = emptyPlaybook("My Playbook"); state.ui.pbId = null; state.ui.pbPlays = null; rerender();
  });
  document.querySelectorAll("[data-pb-preset]").forEach((b) => b.addEventListener("click", () => {
    const book = DEFAULT_OFF_BOOKS.find((x) => x.name === b.dataset.pbPreset);
    if (!book) return;
    state.ui.pb = JSON.parse(JSON.stringify(book)); state.ui.pbId = null; state.ui.pbPlays = null; rerender();
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
      // If the removed look's plays screen was open, close it.
      if (state.ui.pbPlays && aliasFormation(state.ui.pbPlays.fid) === fid && (state.ui.pbPlays.vk || "") === vk) state.ui.pbPlays = null;
    } else {
      const entry = { id: fid, weight: 25 }; if (vk) entry.variation = vk;
      pb.formations.push(entry);
      // A look arrives with every play that FITS ITS personnel already selected
      // (owner, 2026-08-18). Each look seeds its OWN sheet — no inherit-base — and
      // a variation is its own formation: the empty look never carries a handoff
      // because a back-needing play doesn't fit it and is never added.
      pb.sheets = pb.sheets || {};
      const key = lookSheetKey(fid, vk);
      if (!pb.sheets[key] || !Object.keys(pb.sheets[key]).length) {
        pb.sheets[key] = allFittingSheet(fid, vk);
      }
    }
    rerender();
  }));
  // Open the dedicated plays screen for one look.
  document.querySelectorAll("[data-pb-plays]").forEach((b) => b.addEventListener("click", () => {
    _syncName();
    const raw = b.dataset.pbPlays; const sep = raw.indexOf("|");
    state.ui.pbPlays = { fid: aliasFormation(raw.slice(0, sep)), vk: raw.slice(sep + 1) || "" };
    state.ui.pbInfo = null;
    rerender();
  }));
  document.querySelector("[data-pb-plays-back]")?.addEventListener("click", () => {
    state.ui.pbPlays = null; state.ui.pbInfo = null; rerender();
  });
  // The plays-screen tools: select-all / clear-all. "Select all" = every play
  // that fits this look (the grid only shows fitting plays now, so there is no
  // separate "only what fits").
  const _playsCtx = () => {
    const s = state.ui.pbPlays; if (!s) return null;
    const fid = aliasFormation(s.fid), vk = s.vk || "";
    const pb = _pb(); if (!pb) return null;
    pb.sheets = pb.sheets || {};
    return { pb, fid, vk, key: lookSheetKey(fid, vk || null) };
  };
  document.querySelector("[data-pb-allon]")?.addEventListener("click", () => {
    const c = _playsCtx(); if (!c) return;
    c.pb.sheets[c.key] = allFittingSheet(c.fid, c.vk); rerender();
  });
  document.querySelector("[data-pb-alloff]")?.addEventListener("click", () => {
    const c = _playsCtx(); if (!c) return;
    c.pb.sheets[c.key] = {}; rerender();
  });
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
    state.ui.benchReturn = _career() ? "gameplan" : null;
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
    state.ui.benchReturn = _career() ? "gameplan" : null;
    navigate("bench");
  }));
  // D4/M2: the ℹ corner — open/close the big card for one concept of the
  // open look (art + blurb + every man's job).
  document.querySelectorAll("[data-pb-cinfo]").forEach((el) => el.addEventListener("click", (e) => {
    e.stopPropagation();
    _syncName();
    const raw = el.dataset.pbCinfo;
    const s1 = raw.indexOf("|"), s2 = raw.indexOf("|", s1 + 1);
    const next = { fid: aliasFormation(raw.slice(0, s1)), vk: raw.slice(s1 + 1, s2) || null, concept: raw.slice(s2 + 1) };
    const cur = state.ui.pbInfo;
    state.ui.pbInfo = cur && cur.fid === next.fid && (cur.vk || "") === (next.vk || "") && cur.concept === next.concept ? null : next;
    rerender();
  }));
  document.querySelector("[data-pb-infoclose]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    state.ui.pbInfo = null;
    rerender();
  });
  document.querySelectorAll("[data-pb-lookweight]").forEach((el) => el.addEventListener("change", () => {
    const raw = el.dataset.pbLookweight; const sep = raw.indexOf("|");
    const fid = aliasFormation(raw.slice(0, sep)); const vk = raw.slice(sep + 1);
    const f = _pb().formations.find((x) => aliasFormation(x.id) === fid && (x.variation || "") === vk);
    if (f) f.weight = Math.max(0, Math.min(99, +el.value || 0));
  }));
  document.querySelectorAll("[data-pb-concept]").forEach((el) => el.addEventListener("click", () => {
    _syncName();
    // "fid|vk|concept" — the toggle lands on THAT look's own sheet. Each look
    // owns its sheet (seeded with all-legal on add), so there is no fork-on-edit
    // and no inherit-base to protect against any more. An emptied sheet stays an
    // empty object on purpose: the look keeps its own (now zero-play) sheet
    // rather than falling back to inheriting the base — inherit-base is retired.
    const raw = el.dataset.pbConcept;
    const s1 = raw.indexOf("|"), s2 = raw.indexOf("|", s1 + 1);
    const fid = aliasFormation(raw.slice(0, s1));
    const vk = raw.slice(s1 + 1, s2) || null;
    const concept = raw.slice(s2 + 1);
    const pb = _pb();
    pb.sheets = pb.sheets || {};
    const key = lookSheetKey(fid, vk);
    pb.sheets[key] = pb.sheets[key] || {};
    if (pb.sheets[key][concept] != null) delete pb.sheets[key][concept];
    else pb.sheets[key][concept] = 50;
    rerender();
  }));
  document.querySelector("[data-pb-save]")?.addEventListener("click", () => {
    _syncName();
    const pb = _pb();
    const v = validatePlaybook(pb);
    if (!v.ok) { notify(v.errors[0], "warning"); return; }
    // M5 (#39): in-career save — the edit lands on the LEAGUE save (the same
    // one-side applier every book load uses; dials/situations/defense carry).
    if (_career()) {
      const school = getPlayerSchool();
      const r2 = applyEditedBookToSchool(school, "off", pb);
      if (r2.ok) { notify(`"${pb.name}" saved — your ${state.seasonMode ? "season" : "dynasty"} carries the edit`, "success"); state.ui.pb = null; state.ui.pbId = null; state.ui.pbContext = null; }
      else notify(r2.reason || "Could not save", "warning");
      rerender();
      return;
    }
    const r = saveCreation("playbooks", pb.name, pb, state.ui.pbId ? { id: state.ui.pbId } : {});
    if (r.ok) { notify(`"${pb.name}" saved`, "success"); state.ui.pb = null; state.ui.pbId = null; rerender(); }
    else notify(r.reason === "full" ? "Library is full" : "Could not save", "warning");
  });
  // M5 (#39): push the carried book back to the Workshop. Applies the edit to
  // the career first (so carried book ≡ library copy), then saves the library
  // entry and RESTAMPS the source identity — the update banner cannot fire
  // about your own push (bookpush.js is the one seam; probe-pinned).
  document.querySelector("[data-pb-push]")?.addEventListener("click", () => {
    _syncName();
    const pb = _pb();
    const v = validatePlaybook(pb);
    if (!v.ok) { notify(v.errors[0], "warning"); return; }
    const school = getPlayerSchool();
    const r = pushBookToWorkshop(school, "off", pb);
    if (r.ok) notify(`"${pb.name}" ${r.updated ? "updated in" : "pushed to"} the Workshop — the library copy now matches the book you carry`, "success");
    else notify(r.reason === "full" ? "Workshop library is full" : r.reason || "Could not push", "warning");
    rerender();
  });
  document.querySelector("[data-pb-cancel]")?.addEventListener("click", () => {
    state.ui.pb = null; state.ui.pbId = null; state.ui.pbContext = null; rerender();
  });
}
export { renderPlaybooksTab, playbooksListeners };
