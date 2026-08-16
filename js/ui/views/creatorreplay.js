import { state, rerender, notify } from '../../state.js';
import { listReplays, loadReplayData, deleteReplay, renameReplay } from '../../engine/replays.js';

// ── Film Room (Creativity Tools UI) — the home for saved replay clips ───────
// Lists the clips the viewer (Codex) saves via js/engine/replays.js: play, rename,
// delete. PLAYBACK is the viewer's: "Play" loads the clip and hands it to a hook
// the viewer registers as window.__playReplayClip(data); until that's wired it
// falls back to a friendly notice. The clip editor (trim/label) grows here later.
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function when(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function metaLine(info) {
  if (!info || typeof info !== "object") return "";
  const bits = [info.matchup, info.score, info.week].filter(Boolean).map(esc);
  return bits.length ? `<span class="rp-meta">${bits.join(" · ")}</span>` : "";
}
function renderReplaysTab() {
  const clips = listReplays();
  const rows = clips.length ? clips.map((c) => `<div class="rp-row">
      <button class="rp-play" data-rp-play="${esc(c.id)}" title="Play clip">▶</button>
      <div class="rp-body">
        <span class="rp-name">🎬 ${esc(c.name)}</span>
        <span class="rp-sub">${metaLine(c.info)}<span class="rp-when">${when(c.saved)}</span></span>
      </div>
      <button class="btn-mm-del" data-rp-del="${esc(c.id)}" title="Delete" aria-label="Delete ${esc(c.name)}">✕</button>
    </div>`).join("") : `<div class="mm-lib-empty muted">No clips yet. Save a highlight from the live viewer and it'll land here.</div>`;
  return `<div class="creator-wrapper"><div class="creator-hub">
    <div class="creator-hub-head"><div class="creator-title">Film Room</div>
      <div class="creator-sub">Your saved replay clips — play them back, or clear them out.</div></div>
    <div class="rp-list">${rows}</div>
    <div class="pb-actions"><button class="btn-mm btn-mm-secondary" data-creator="hub">← Workshop</button></div>
  </div></div>`;
}
function replaysListeners() {
  document.querySelectorAll("[data-rp-play]").forEach((b) => b.addEventListener("click", () => {
    const data = loadReplayData(b.dataset.rpPlay);
    if (!data) { notify("That clip could not be loaded", "warning"); return; }
    if (typeof window !== "undefined" && typeof window.__playReplayClip === "function") {
      state.ui.creatorTab = null;
      window.__playReplayClip(data);
    } else {
      notify("Clip playback lands with the next viewer update", "info");
    }
  }));
  document.querySelectorAll("[data-rp-del]").forEach((b) => b.addEventListener("click", () => { deleteReplay(b.dataset.rpDel); rerender(); }));
}
export { renderReplaysTab, replaysListeners };
