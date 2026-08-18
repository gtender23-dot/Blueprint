import { state, rerender, notify, getPlayerSchool } from '../../state.js';
import { applyEditedBookToSchool, pushBookToWorkshop } from '../../engine/bookpush.js';
import { listCreations, loadCreationData, saveCreation, deleteCreation } from '../../engine/creator.js';
import {
  emptyDefBook, emptyDefCard, validateDefBook, DEF_COVERAGE_SCHEMES,
  DEF_SHELVES, DEF_SHELF_CARD_CAP, DEF_CALL_COVERAGES, DEF_CALL_BRING, DEF_ANSWER_CLASSES,
  bookCards, frontIds, aggressionStops, pressIdentities
} from '../../engine/defbook.js';
import { DEFAULT_DEF_BOOKS } from '../../engine/defaultbooks.js';
import { renderFrontDiagram, renderDefCallCard } from './routeart.js';
import { C, DEF_FRONTS } from '../../constants.js';

// ── Defensive Playbook v2 — "The Answers" (Ref/DEFENSIVE_PLAYBOOK_V2.md) ────
// A defensive play is one CARD (front + coverage + pressure, one picture); the
// book is SHELVES of answers + personnel checks, on top of the v1 identity
// spine. Editor state: state.ui.def (book), state.ui.defCard ({shelf, idx,
// call}) while a card is open. NOTHING here touches the sim — a book compiles
// through applyDefBookToGameplan into seams the engine already consumes.
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function _d() { return state.ui.def; }
// M5 embedded editing (#39): state.ui.defContext === "career" — the book being
// edited is the defense the coach CARRIES; Save writes the league save, Push
// copies to the Workshop + restamps (see creatorplaybook.js / bookpush.js).
function _career() { return state.ui.defContext === "career"; }
function _covArt(id) { const c = DEF_CALL_COVERAGES.find((x) => x.id === id); return c ? c.art : { deep: null }; }
function _covLabel(id) { const c = DEF_CALL_COVERAGES.find((x) => x.id === id); return c ? c.label : id; }

function renderDefList() {
  const books = listCreations("defbooks");
  const rows = books.length ? books.map((b) => {
    const bf = b.data.baseFront || "4-3";
    const nCalls = bookCards(b.data).length;
    return `<div class="pb-row play-row">
      <button class="pb-row-open" data-def-open="${esc(b.id)}"><span class="pb-row-thumb">${renderFrontDiagram(bf, { w: 120, h: 76 })}</span><span class="play-row-copy"><span class="pb-row-name">${esc(b.name)}</span><span class="pb-row-meta">${esc(bf)} base${nCalls ? ` · ${nCalls} call${nCalls === 1 ? "" : "s"}` : ""}</span></span></button>
      <button class="btn-mm-del" data-def-del="${esc(b.id)}" title="Delete" aria-label="Delete ${esc(b.name)}">✕</button>
    </div>`;
  }).join("") : `<div class="mm-lib-empty muted">No defenses yet. Start from a scheme below — every one is a complete book you can make your own.</div>`;
  return `<div class="creator-hub">
    <div class="creator-hub-head"><div class="creator-title">Defensive Playbook</div>
      <div class="creator-sub">Your answers — who you are every snap, and the calls you trust in every situation.</div></div>
    <div class="pb-list">${rows}</div>
    <div class="def-section-head">Start from a scheme <span class="muted">— complete books, edit anything, save as your own</span></div>
    <div class="def-preset-row">${DEFAULT_DEF_BOOKS.map((b) => `<button type="button" class="def-preset" data-def-preset="${esc(b.name)}"><span class="def-preset-name">${esc(b.name)}</span><span class="def-preset-sub">${esc(b.baseFront)} · ${esc(_covLabel((bookCards(b)[0] || { card: { coverage: "base" } }).card.coverage))} base</span></button>`).join("")}</div>
    <div class="pb-actions">
      <button class="btn-mm btn-mm-new" data-def-new="1">＋ Blank Defense</button>
      <button class="btn-mm btn-mm-secondary" data-creator="hub">← Workshop</button>
    </div>
  </div>`;
}
function _pickRow(cur, opts, dataAttr) {
  return `<div class="def-pick-row">${opts.map((o) => `<button type="button" class="def-pick${cur === o.id ? " on" : ""}" ${dataAttr}="${esc(o.id)}"${o.desc ? ` title="${esc(o.desc)}"` : ""}>${esc(o.label)}</button>`).join("")}</div>`;
}
function renderIdentity(db) {
  const frontCards = frontIds().map((f) => {
    const inMix = db.frontMix && db.frontMix[f] != null;
    const isBase = db.baseFront === f;
    const p = DEF_FRONTS[f] || { DL: 0, LB: 0, DB: 0 };
    return `<div class="pb-form fb-card def-card${inMix ? " on" : ""}${isBase ? " is-base" : ""}">
      <label class="fb-card-toggle">
        <input type="checkbox" data-def-front="${esc(f)}"${inMix ? " checked" : ""}/>
        <span class="fb-card-diagram">${renderFrontDiagram(f, { w: 150, h: 96 })}</span>
        <span class="fb-card-meta">
          <span class="fb-card-name">${esc(f)}${isBase ? ` <span class="def-base-tag">BASE</span>` : ""}</span>
          <span class="fb-card-pers">${p.DL} DL · ${p.LB} LB · ${p.DB} DB</span>
          ${inMix ? "" : `<span class="fb-card-add">Tap to add</span>`}
        </span>
      </label>
      ${inMix ? `<div class="fb-card-tools">
        <label class="fb-weight-lbl">Usage <input class="pb-weight" type="number" min="0" max="99" value="${db.frontMix[f]}" data-def-weight="${esc(f)}"/></label>
        <button class="pb-expand" type="button" data-def-base="${esc(f)}"${isBase ? " disabled" : ""}>${isBase ? "Base front" : "Make base"}</button>
      </div>` : ""}
    </div>`;
  }).join("");
  const aggrOpts = aggressionStops().map((a) => ({ id: a, label: (C.AGGRESSION.labels && C.AGGRESSION.labels[a]) || a }));
  const pressOpts = pressIdentities().map((pi) => ({ id: pi, label: (C.PRESS_IDENTITY[pi] && C.PRESS_IDENTITY[pi].label) || pi }));
  // OD-9 (D16, 2026-08-18): the pressure-source pie is RETIRED from the editor
  // surface — the sim deleted gp.pressureSource at every kickoff (G11), so the
  // three sliders never did anything. Old books still LOAD the field (schema
  // keeps it until the next schema bump); pressureIdentity + the front's
  // signature own "who comes". Stated in the release note — not a silent cut.
  return `<details class="gp-section def-identity" open>
    <summary class="gp-section-hdr">THE IDENTITY <span class="gp-section-sub">who you are every snap — the shelves override it by situation</span></summary>
    <div class="def-section-head">Fronts <span class="muted">— tap to add, set one as your base</span></div>
    <div class="pb-forms">${frontCards}</div>
    <div class="def-section-head">Coverage identity</div>
    ${_pickRow(db.coverageScheme, DEF_COVERAGE_SCHEMES.filter((c) => !c.retired || c.id === db.coverageScheme), "data-def-cov")}
    ${DEF_COVERAGE_SCHEMES.some((c) => c.retired && c.id === db.coverageScheme) ? `<div class="muted" style="font-size:11px;margin:4px 0 0">This defense carries a retired identity — it plays as Balanced (it always did). Pick another to move off it.</div>` : ""}
    <div class="def-section-head">Aggression <span class="muted">— how often you bring pressure</span></div>
    ${_pickRow(db.aggression, aggrOpts, "data-def-aggr")}
    <div class="def-section-head">Pressure look</div>
    ${_pickRow(db.pressIdentity, pressOpts, "data-def-press")}
    <div class="def-toggles">
      <label class="def-toggle"><input type="checkbox" data-def-toggle="greenDog"${db.greenDog ? " checked" : ""}/> <span>Green-dog <span class="muted">— a back's blocker becomes a rusher when he stays in</span></span></label>
      <label class="def-toggle"><input type="checkbox" data-def-toggle="spyQB"${db.spyQB ? " checked" : ""}/> <span>Spy the QB <span class="muted">— keep a defender home to shadow a scrambler</span></span></label>
    </div>
  </details>`;
}
function renderShelves(db) {
  const shelves = DEF_SHELVES.map((sh) => {
    const cards = (db.shelves && db.shelves[sh.key]) || [];
    const tiles = cards.map((c, i) => `<div class="def-call-tile">
        ${renderDefCallCard(c, { w: 220, h: 150, art: _covArt(c.coverage), fallbackFront: db.baseFront })}
        <div class="def-call-tile-row">
          <span class="def-call-name">${esc(c.name)}</span>
          <span class="def-call-sub muted">${esc(c.front || db.baseFront)} · ${esc(_covLabel(c.coverage))} · ${esc((DEF_CALL_BRING[c.bring] || {}).label || "")}</span>
        </div>
        <div class="def-call-tile-row">
          ${cards.length > 1 ? `<label class="fb-weight-lbl">Usage <input class="pb-weight" type="number" min="0" max="99" value="${c.weight != null ? c.weight : 50}" data-card-weight="${esc(sh.key)}|${i}"/></label>` : "<span></span>"}
          <span>
            <button type="button" class="btn-ghost btn-sm" data-card-edit="${esc(sh.key)}|${i}">Edit</button>
            <button type="button" class="btn-mm-del" data-card-del="${esc(sh.key)}|${i}" title="Remove call">✕</button>
          </span>
        </div>
      </div>`).join("");
    return `<div class="def-shelf">
      <div class="def-shelf-head"><span class="def-shelf-name">${esc(sh.label)}</span><span class="def-shelf-desc muted">${esc(sh.desc)}</span></div>
      <div class="def-shelf-cards">${tiles}
        ${cards.length < DEF_SHELF_CARD_CAP ? `<button type="button" class="def-shelf-add" data-card-add="${esc(sh.key)}">＋ Add a call</button>` : ""}
      </div>
    </div>`;
  }).join("");
  return `<div class="def-section-head" style="margin-top:14px">THE CALL SHEET <span class="muted">— your answer for every situation; the top call on a shelf is the standing one</span></div>${shelves}`;
}
function renderAnswers(db) {
  const names = bookCards(db).map((e) => e.card.name);
  const rows = DEF_ANSWER_CLASSES.map((a) => {
    const cur = (db.answers || {})[a.key] || "";
    return `<div class="def-answer-row">
      <span class="def-answer-lbl">${esc(a.label)}</span>
      <select class="form-input" data-def-answer="${esc(a.key)}">
        <option value=""${!cur ? " selected" : ""}>Auto — play the situation</option>
        ${names.map((n) => `<option value="${esc(n)}"${cur === n ? " selected" : ""}>Check to “${esc(n)}”</option>`).join("")}
      </select>
    </div>`;
  }).join("");
  return `<div class="def-section-head" style="margin-top:14px">WHEN THEY SHOW IT <span class="muted">— read their huddle, check to your answer</span></div>
    <div class="def-answers">${rows}</div>`;
}
function renderDefEditor() {
  const db = _d();
  const v = validateDefBook(db);
  const msg = v.errors.length ? `<div class="pb-msg err">${esc(v.errors[0])}</div>` : v.warnings.length ? `<div class="pb-msg warn">${esc(v.warnings[0])}</div>` : `<div class="pb-msg ok">Ready to save.</div>`;
  const career = _career();
  return `<div class="creator-hub">
    <div class="creator-hub-head"><div class="creator-title">${career ? "Edit Your Defense" : "Defensive Playbook"}</div>
      ${career ? `<div class="creator-sub">The defense you carry — Save keeps the edit in this ${state.seasonMode ? "season" : "dynasty"}'s save. Push it to the Workshop to keep a library copy.</div>` : ""}</div>
    <input class="form-input pb-name" id="def-name" type="text" maxlength="36" placeholder="Defense name" value="${esc(db.name || "")}"/>
    ${msg}
    ${renderIdentity(db)}
    ${renderShelves(db)}
    ${renderAnswers(db)}
    <div class="pb-actions">
      <button class="btn-mm btn-mm-new" data-def-save="1"${v.errors.length ? " disabled" : ""}>${career ? "Save to My Season" : "Save Defense"}</button>
      ${career ? `<button class="btn-mm btn-mm-secondary" data-def-push="1"${v.errors.length ? " disabled" : ""}>⤴ Push to Workshop</button>` : ""}
      <button class="btn-mm btn-mm-secondary" data-def-cancel="1">Cancel</button>
    </div>
  </div>`;
}
// ── The card editor — three big choices + Coach mode ────────────────────────
function renderCardEditor() {
  const db = _d();
  const ed = state.ui.defCard;
  const c = ed.call;
  const shelf = DEF_SHELVES.find((s) => s.key === ed.shelf);
  const chips = (opts, cur, attr) => `<div class="def-pick-row">${opts.map((o) => `<button type="button" class="def-pick${cur === o.id ? " on" : ""}" ${attr}="${esc(o.id)}"${o.desc ? ` title="${esc(o.desc)}"` : ""}>${esc(o.label)}</button>`).join("")}</div>`;
  const fronts = [{ id: "", label: `Base (${db.baseFront})` }].concat(frontIds().map((f) => ({ id: f, label: f })));
  const brings = Object.entries(DEF_CALL_BRING).map(([id, b]) => ({ id, label: b.label, desc: b.desc }));
  const looks = [{ id: "", label: "Any look" }].concat(pressIdentities().map((pi) => ({ id: pi, label: (C.PRESS_IDENTITY[pi] && C.PRESS_IDENTITY[pi].label) || pi })));
  const covCards = DEF_CALL_COVERAGES.map((cov) => `<button type="button" class="def-cov-card${c.coverage === cov.id ? " on" : ""}" data-card-cov="${esc(cov.id)}" title="${esc(cov.desc)}">
      <span class="def-cov-dia">${renderDefCallCard({ ...c, coverage: cov.id, bring: "4" }, { w: 130, h: 88, art: cov.art, fallbackFront: db.baseFront })}</span>
      <span class="def-cov-name">${esc(cov.label)}</span>
    </button>`).join("");
  return `<div class="creator-hub">
    <div class="creator-hub-head"><div class="creator-title">${ed.idx == null ? "New Call" : "Edit Call"}</div>
      <div class="creator-sub">${esc(shelf ? shelf.label : "")} — ${esc(shelf ? shelf.desc : "")}</div></div>
    <input class="form-input pb-name" id="def-card-name" type="text" maxlength="24" placeholder="Call name" value="${esc(c.name || "")}"/>
    <div class="def-card-preview">${renderDefCallCard(c, { w: 250, h: 170, art: _covArt(c.coverage), fallbackFront: db.baseFront })}</div>
    <div class="def-section-head">Front</div>
    ${chips(fronts, c.front || "", "data-card-front")}
    <div class="def-section-head">Coverage <span class="muted">— the picture behind the rush</span></div>
    <div class="def-cov-grid">${covCards}</div>
    <div class="def-section-head">How many come</div>
    ${chips(brings, c.bring, "data-card-bring")}
    <div class="def-section-head">Where it comes from</div>
    ${chips(looks, c.look || "", "data-card-look")}
    <details class="gp-section def-coachmode">
      <summary class="gp-section-hdr">COACH MODE <span class="gp-section-sub">the fine print — everything optional</span></summary>
      <div class="def-answer-row"><span class="def-answer-lbl">Extra men in the box</span>
        <input class="form-input" type="number" min="0" max="20" value="${c.runCommit != null ? c.runCommit : 0}" data-card-commit="1"/></div>
      <div class="def-section-head">Edge discipline</div>
      ${chips([{ id: "", label: "Auto" }, { id: "contain", label: "Contain", desc: "Set the edge — jets and sweeps die outside." }, { id: "crash", label: "Crash", desc: "Pin the ears back — more heat, soft edge." }], c.edgePlay || "", "data-card-edge")}
    </details>
    <div class="pb-actions">
      <button class="btn-mm btn-mm-new" data-card-save="1"${c.name && c.name.trim() ? "" : " disabled"}>Save Call</button>
      <button class="btn-mm btn-mm-secondary" data-card-cancel="1">Back</button>
    </div>
  </div>`;
}
function renderDefTab() {
  return `<div class="creator-wrapper">${state.ui.defCard && _d() ? renderCardEditor() : _d() ? renderDefEditor() : renderDefList()}</div>`;
}
function _syncName() { const el = document.getElementById("def-name"); if (el && _d()) _d().name = el.value; }
function _syncCardName() { const el = document.getElementById("def-card-name"); if (el && state.ui.defCard) state.ui.defCard.call.name = el.value; }
function defListeners() {
  document.querySelectorAll("[data-def-open]").forEach((b) => b.addEventListener("click", () => {
    const data = loadCreationData("defbooks", b.dataset.defOpen);
    if (data) { state.ui.def = { ...emptyDefBook(data.name), ...data, frontMix: { ...(data.frontMix || {}) }, pressureSource: { ...(data.pressureSource || {}) }, shelves: JSON.parse(JSON.stringify(data.shelves || {})), answers: { ...(data.answers || {}) } }; state.ui.defId = b.dataset.defOpen; rerender(); }
  }));
  document.querySelectorAll("[data-def-del]").forEach((b) => b.addEventListener("click", () => { deleteCreation("defbooks", b.dataset.defDel); rerender(); }));
  document.querySelector("[data-def-new]")?.addEventListener("click", () => { state.ui.def = emptyDefBook("My Defense"); state.ui.defId = null; rerender(); });
  document.querySelectorAll("[data-def-preset]").forEach((b) => b.addEventListener("click", () => {
    const preset = DEFAULT_DEF_BOOKS.find((p) => p.name === b.dataset.defPreset);
    if (!preset) return;
    state.ui.def = JSON.parse(JSON.stringify(preset));
    state.ui.defId = null; rerender();
  }));
  // identity — fronts / dials (unchanged mechanics from v1)
  document.querySelectorAll("[data-def-front]").forEach((el) => el.addEventListener("change", () => {
    _syncName(); const db = _d(); const f = el.dataset.defFront;
    db.frontMix = db.frontMix || {};
    if (el.checked) { db.frontMix[f] = db.frontMix[f] != null ? db.frontMix[f] : 40; if (!db.baseFront || !(db.baseFront in db.frontMix)) db.baseFront = f; }
    else {
      delete db.frontMix[f];
      if (db.baseFront === f) db.baseFront = Object.keys(db.frontMix)[0] || f;
      if (!Object.keys(db.frontMix).length) db.frontMix[f] = 40, db.baseFront = f;
    }
    rerender();
  }));
  document.querySelectorAll("[data-def-weight]").forEach((el) => el.addEventListener("change", () => {
    const db = _d(); const f = el.dataset.defWeight;
    if (db.frontMix && db.frontMix[f] != null) db.frontMix[f] = Math.max(0, Math.min(99, +el.value || 0));
  }));
  document.querySelectorAll("[data-def-base]").forEach((b) => b.addEventListener("click", () => {
    _syncName(); const db = _d(); const f = b.dataset.defBase;
    db.frontMix = db.frontMix || {}; if (db.frontMix[f] == null) db.frontMix[f] = 40;
    db.baseFront = f; rerender();
  }));
  document.querySelectorAll("[data-def-cov]").forEach((b) => b.addEventListener("click", () => { _syncName(); _d().coverageScheme = b.dataset.defCov; rerender(); }));
  document.querySelectorAll("[data-def-aggr]").forEach((b) => b.addEventListener("click", () => { _syncName(); _d().aggression = b.dataset.defAggr; rerender(); }));
  document.querySelectorAll("[data-def-press]").forEach((b) => b.addEventListener("click", () => { _syncName(); _d().pressIdentity = b.dataset.defPress; rerender(); }));
  document.querySelectorAll("[data-def-toggle]").forEach((el) => el.addEventListener("change", () => { _d()[el.dataset.defToggle] = el.checked; }));
  // shelves — add / edit / delete / weight
  document.querySelectorAll("[data-card-add]").forEach((b) => b.addEventListener("click", () => {
    _syncName(); state.ui.defCard = { shelf: b.dataset.cardAdd, idx: null, call: emptyDefCard("") }; rerender();
  }));
  document.querySelectorAll("[data-card-edit]").forEach((b) => b.addEventListener("click", () => {
    _syncName(); const [sh, i] = b.dataset.cardEdit.split("|"); const db = _d();
    const card = db.shelves && db.shelves[sh] && db.shelves[sh][+i];
    if (card) { state.ui.defCard = { shelf: sh, idx: +i, call: JSON.parse(JSON.stringify(card)) }; rerender(); }
  }));
  document.querySelectorAll("[data-card-del]").forEach((b) => b.addEventListener("click", () => {
    _syncName(); const [sh, i] = b.dataset.cardDel.split("|"); const db = _d();
    if (db.shelves && db.shelves[sh]) {
      const nm = (db.shelves[sh][+i] || {}).name;
      db.shelves[sh].splice(+i, 1);
      if (!db.shelves[sh].length) delete db.shelves[sh];
      // an answer pointing at a deleted call resets to Auto
      for (const k of Object.keys(db.answers || {})) if (db.answers[k] === nm) delete db.answers[k];
    }
    rerender();
  }));
  document.querySelectorAll("[data-card-weight]").forEach((el) => el.addEventListener("change", () => {
    const [sh, i] = el.dataset.cardWeight.split("|"); const db = _d();
    const card = db.shelves && db.shelves[sh] && db.shelves[sh][+i];
    if (card) card.weight = Math.max(0, Math.min(99, +el.value || 0));
  }));
  document.querySelectorAll("[data-def-answer]").forEach((el) => el.addEventListener("change", () => {
    const db = _d(); db.answers = db.answers || {};
    if (el.value) db.answers[el.dataset.defAnswer] = el.value;
    else delete db.answers[el.dataset.defAnswer];
  }));
  // card editor
  document.querySelectorAll("[data-card-front]").forEach((b) => b.addEventListener("click", () => { _syncCardName(); state.ui.defCard.call.front = b.dataset.cardFront || null; rerender(); }));
  document.querySelectorAll("[data-card-cov]").forEach((b) => b.addEventListener("click", () => { _syncCardName(); state.ui.defCard.call.coverage = b.dataset.cardCov; rerender(); }));
  document.querySelectorAll("[data-card-bring]").forEach((b) => b.addEventListener("click", () => { _syncCardName(); state.ui.defCard.call.bring = b.dataset.cardBring; rerender(); }));
  document.querySelectorAll("[data-card-look]").forEach((b) => b.addEventListener("click", () => { _syncCardName(); state.ui.defCard.call.look = b.dataset.cardLook || null; rerender(); }));
  document.querySelector("[data-card-commit]")?.addEventListener("change", (e) => { _syncCardName(); state.ui.defCard.call.runCommit = Math.max(0, Math.min(20, +e.target.value || 0)) || null; });
  document.querySelectorAll("[data-card-edge]").forEach((b) => b.addEventListener("click", () => { _syncCardName(); state.ui.defCard.call.edgePlay = b.dataset.cardEdge || null; rerender(); }));
  document.getElementById("def-card-name")?.addEventListener("input", () => {
    const c = state.ui.defCard && state.ui.defCard.call; if (!c) return;
    c.name = document.getElementById("def-card-name").value;
    const btn = document.querySelector("[data-card-save]");
    if (btn) btn.disabled = !c.name.trim();
  });
  document.querySelector("[data-card-save]")?.addEventListener("click", () => {
    _syncCardName(); const db = _d(); const ed = state.ui.defCard;
    if (!ed || !ed.call.name || !ed.call.name.trim()) return;
    ed.call.name = ed.call.name.trim().slice(0, 24);
    // call names must be unique across the book (they become headset chips)
    const clash = bookCards(db).some((e2, _i) => e2.card.name === ed.call.name && !(e2.shelf === ed.shelf && ed.idx != null && (db.shelves[ed.shelf] || []).indexOf(e2.card) === ed.idx));
    if (clash) { notify(`You already have a call named "${ed.call.name}"`, "warning"); return; }
    db.shelves = db.shelves || {};
    db.shelves[ed.shelf] = db.shelves[ed.shelf] || [];
    if (ed.idx == null) db.shelves[ed.shelf].push(ed.call);
    else db.shelves[ed.shelf][ed.idx] = ed.call;
    state.ui.defCard = null; rerender();
  });
  document.querySelector("[data-card-cancel]")?.addEventListener("click", () => { state.ui.defCard = null; rerender(); });
  // save / cancel the book
  document.querySelector("[data-def-save]")?.addEventListener("click", () => {
    _syncName(); const db = _d();
    const v = validateDefBook(db);
    if (!v.ok) { notify(v.errors[0], "warning"); return; }
    // M5 (#39): in-career save — the edit lands on the LEAGUE save.
    if (_career()) {
      const school = getPlayerSchool();
      const r2 = applyEditedBookToSchool(school, "def", db);
      if (r2.ok) { notify(`"${db.name}" saved — your ${state.seasonMode ? "season" : "dynasty"} carries the edit`, "success"); state.ui.def = null; state.ui.defId = null; state.ui.defCard = null; state.ui.defContext = null; }
      else notify(r2.reason || "Could not save", "warning");
      rerender();
      return;
    }
    const r = saveCreation("defbooks", db.name, db, state.ui.defId ? { id: state.ui.defId } : {});
    if (r.ok) { notify(`"${db.name}" saved`, "success"); state.ui.def = null; state.ui.defId = null; rerender(); }
    else notify(r.reason === "full" ? "Library is full" : "Could not save", "warning");
  });
  // M5 (#39): push the carried defense to the Workshop + restamp (no self-banner).
  document.querySelector("[data-def-push]")?.addEventListener("click", () => {
    _syncName(); const db = _d();
    const v = validateDefBook(db);
    if (!v.ok) { notify(v.errors[0], "warning"); return; }
    const school = getPlayerSchool();
    const r = pushBookToWorkshop(school, "def", db);
    if (r.ok) notify(`"${db.name}" ${r.updated ? "updated in" : "pushed to"} the Workshop — the library copy now matches the defense you carry`, "success");
    else notify(r.reason === "full" ? "Workshop library is full" : r.reason || "Could not push", "warning");
    rerender();
  });
  document.querySelector("[data-def-cancel]")?.addEventListener("click", () => { state.ui.def = null; state.ui.defId = null; state.ui.defCard = null; state.ui.defContext = null; rerender(); });
}
export { renderDefTab, defListeners };
