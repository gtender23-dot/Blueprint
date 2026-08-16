import { rerender, state } from '../../state.js';
import { MANUAL_CHAPTERS, chapterById } from '../manual/index.js';
import { escapeHtml } from '../../utils.js';

// The manual has asked for "two to four short paragraphs" per section since it
// was written, but HTML collapses whitespace, so a body authored with blank
// lines between paragraphs rendered as one wall. Split on blank lines and wrap
// each run in a paragraph — the single largest readability win in the manual.
function bodyHtml(body) {
  return String(body)
    .split(/\n\s*\n/)
    .map((p) => p.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .map((p) => `<p>${p}</p>`)
    .join("");
}

function tocHtml() {
  return `
  <div class="view-manual">
    <div class="view-header">
      <div>
        <h1 class="view-title">The Manual</h1>
        <div class="view-subtitle">How this game actually works, in football terms</div>
      </div>
    </div>

    <p class="manual-intro">Everything here is the real mechanism, not a summary of the
    menus. What you will not find is a single coefficient \u2014 how heavily the simulation
    weighs a thing is deliberately left for you to feel out over a career, because a game
    you can solve from a reference page is not worth the career. Ordering and direction
    are here. Arithmetic is not.</p>

    <div class="manual-toc">
      ${MANUAL_CHAPTERS.map((c, i) => `
        <button class="manual-toc-item" data-manual-open="${c.id}">
          <span class="manual-toc-num">${String(i + 1).padStart(2, "0")}</span>
          <span class="manual-toc-icon">${c.icon}</span>
          <span class="manual-toc-text">
            <span class="manual-toc-title">${escapeHtml(c.title)}</span>
            <span class="manual-toc-blurb">${escapeHtml(c.blurb)}</span>
          </span>
          <span class="manual-toc-go">\u2192</span>
        </button>`).join("")}
    </div>

    ${MANUAL_CHAPTERS.length < 15 ? `
      <p class="manual-note">More chapters are being written. The ones listed above are
      finished.</p>` : ""}
  </div>`;
}
function chapterHtml(c) {
  const i = MANUAL_CHAPTERS.indexOf(c);
  const prev = MANUAL_CHAPTERS[i - 1] || null;
  const next = MANUAL_CHAPTERS[i + 1] || null;
  return `
  <div class="view-manual view-manual-read">
    <div class="view-header">
      <div>
        <button class="btn-ghost btn-sm" id="btn-manual-back">\u2190 All chapters</button>
        <h1 class="view-title manual-chapter-title">
          <span class="manual-chapter-icon">${c.icon}</span> ${escapeHtml(c.title)}
        </h1>
      </div>
    </div>

    <article class="manual-chapter">
      <p class="manual-lede">${escapeHtml(c.blurb)}</p>
      ${c.sections.map((s) => `
        <section class="manual-section">
          <h2 class="manual-heading">${escapeHtml(s.heading)}</h2>
          <div class="manual-body">${bodyHtml(s.body)}</div>
        </section>`).join("")}
    </article>

    <div class="manual-pager">
      ${prev ? `<button class="btn-ghost btn-sm" data-manual-open="${prev.id}">\u2190 ${escapeHtml(prev.title)}</button>` : "<span></span>"}
      ${next ? `<button class="btn-ghost btn-sm" data-manual-open="${next.id}">${escapeHtml(next.title)} \u2192</button>` : "<span></span>"}
    </div>
  </div>`;
}
function renderManual() {
  const open = state.ui.manualChapter ? chapterById(state.ui.manualChapter) : null;
  return open ? chapterHtml(open) : tocHtml();
}
function setupListeners12() {
  var _a;
  document.querySelectorAll("[data-manual-open]").forEach((el) => {
    el.addEventListener("click", () => {
      var _a2, _b, _c;
      state.ui.manualChapter = el.dataset.manualOpen;
      (_a2 = window.scrollTo) == null ? void 0 : _a2.call(window, 0, 0);
      (_c = (_b = document.querySelector(".main-content")) == null ? void 0 : _b.scrollTo) == null ? void 0 : _c.call(_b, 0, 0);
      rerender();
    });
  });
  (_a = document.getElementById("btn-manual-back")) == null ? void 0 : _a.addEventListener("click", () => {
    state.ui.manualChapter = null;
    rerender();
  });
}

export { renderManual, setupListeners12 };
