import { SAVE_VERSION } from '../constants.js';

// ── Replay store (Creativity Tools / Viewer, Aug 2026) ─────────────────────
// The home for saved replay clips — a DEDICATED store (its own localStorage key),
// separate from the Creator config library (cfb-creator), because clips are far
// larger than a playbook or team and must not crowd them out of quota. Same
// resilience as the config library and saves: tolerant read + a two-generation
// backup ring, so a corrupt write can't wipe your highlights. The clip DATA
// SHAPE is the viewer's (Codex) to define — this store just holds the blob and
// the display meta; it never inspects `data`. API for the viewer:
//   saveReplay(name, data, { id?, info? }) / listReplays() / loadReplayData(id)
//   / getReplay(id) / renameReplay(id,name) / deleteReplay(id).
// If clips outgrow localStorage, the backend swaps behind this API without
// changing a single viewer call.
var REPLAY_KEY = "cfb-replays";
var REPLAY_BAK1 = "cfb-replays.bak1", REPLAY_BAK2 = "cfb-replays.bak2";
var REPLAY_CAP = 60;
var NAME_MAX = 48;

function parseList(raw) {
  if (!raw) return null;
  let a;
  try {
    a = JSON.parse(raw);
  } catch (e) {
    return null;
  }
  return Array.isArray(a) ? a : null;
}
// Primary, then walk the backup ring — a garbled cfb-replays never silently
// wipes the film room.
function readReplays() {
  return parseList(localStorage.getItem(REPLAY_KEY)) || parseList(localStorage.getItem(REPLAY_BAK1)) || parseList(localStorage.getItem(REPLAY_BAK2)) || [];
}
function writeReplays(list) {
  try {
    const cur = localStorage.getItem(REPLAY_KEY);
    if (cur) {
      const b1 = localStorage.getItem(REPLAY_BAK1);
      if (b1) localStorage.setItem(REPLAY_BAK2, b1);
      localStorage.setItem(REPLAY_BAK1, cur);
    }
    localStorage.setItem(REPLAY_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    return false;
  }
}
function listReplays() {
  return readReplays().slice().sort((a, b) => (b.saved || 0) - (a.saved || 0));
}
function getReplay(id) {
  return readReplays().find((r) => r.id === id) || null;
}
// Deep clone — a caller playing a clip can't mutate the stored copy by reference.
function loadReplayData(id) {
  const r = getReplay(id);
  return r ? JSON.parse(JSON.stringify(r.data)) : null;
}
// Save or update. opts.id updates in place; opts.info is display metadata the
// Film Room shows (e.g. { matchup, score, week }). Returns { ok, id } or
// { ok:false, reason }.
function saveReplay(name, data, opts = {}) {
  if (data == null || typeof data !== "object") return { ok: false, reason: "bad-data" };
  const list = readReplays();
  const now = Date.now();
  const existing = opts.id ? list.findIndex((r) => r.id === opts.id) : -1;
  if (existing < 0 && list.length >= REPLAY_CAP) return { ok: false, reason: "full", cap: REPLAY_CAP };
  const id = existing >= 0 ? list[existing].id : opts.id || `clip-${now.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const entry = {
    id,
    name: String(name || "Clip").slice(0, NAME_MAX),
    v: SAVE_VERSION,
    saved: now,
    info: opts.info && typeof opts.info === "object" ? opts.info : null,
    data: JSON.parse(JSON.stringify(data))
  };
  if (existing >= 0) list[existing] = entry;
  else list.push(entry);
  if (!writeReplays(list)) return { ok: false, reason: "write" };
  return { ok: true, id };
}
function renameReplay(id, name) {
  const list = readReplays();
  const r = list.find((x) => x.id === id);
  if (!r) return false;
  r.name = String(name || r.name).slice(0, NAME_MAX) || r.name;
  return writeReplays(list);
}
function deleteReplay(id) {
  const list = readReplays();
  const i = list.findIndex((r) => r.id === id);
  if (i < 0) return false;
  list.splice(i, 1);
  return writeReplays(list);
}

export { REPLAY_CAP, listReplays, getReplay, loadReplayData, saveReplay, renameReplay, deleteReplay };
