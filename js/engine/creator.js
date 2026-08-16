import { SAVE_VERSION } from '../constants.js';

// ── The Creator library (Creativity Tools, Aug 2026) ──────────────────────
// A GLOBAL, coach-and-tree-INDEPENDENT store for player creations: custom
// playbooks, custom plays, custom teams, custom leagues. It lives in its own
// localStorage key, separate from the per-coach `plans`/`teams` quick-saves in
// coachprofile.js, for one reason the owner set the direction on: creations must
// be reachable from the Main Menu (before any coach or tree exists) and load
// into ANY new tree/world. So an entry binds to nothing — its `data` is a plain
// JSON payload with no coachId, treeId, worldId or schoolId baked in. Portable
// by construction; that portability IS the feature.
//
// Two surfaces read/write this one store: the Main-Menu Creator hub and the
// in-dynasty Game Plan screen (playbooks + play composer). Both go through the
// functions below, so the two can never disagree about what's in the library.
var CREATOR_KEY = "cfb-creator";
var CREATOR_BAK1 = "cfb-creator.bak1", CREATOR_BAK2 = "cfb-creator.bak2";
// Stage 7 (Playbook-Root): the `formations` shelf joins — custom formations
// built in the Formation Designer, registered into the live tables at boot.
var CREATOR_KINDS = ["playbooks", "defbooks", "plays", "formations", "teams", "leagues"];
// Per-kind caps. Generous — this is a creative sandbox, not a save-slot economy.
var CREATOR_CAPS = { playbooks: 30, defbooks: 30, plays: 80, formations: 16, teams: 32, leagues: 12 };
var NAME_MAX = 36;

function blankStore() {
  const s = {};
  for (const k of CREATOR_KINDS) s[k] = [];
  return s;
}
function parseStore(raw) {
  if (!raw) return null;
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch (e) {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const store = blankStore();
  for (const k of CREATOR_KINDS) if (Array.isArray(obj[k])) store[k] = obj[k];
  return store;
}
// Tolerant read with a two-generation backup RING (release hardening, mirrors
// the save ring in persistence.js): the primary is tried first, then bak1, then
// bak2. A corrupt or truncated cfb-creator NEVER silently wipes the library — it
// recovers the last good generation. Always returns every kind so callers can
// index without guarding.
function readCreatorStore() {
  return parseStore(localStorage.getItem(CREATOR_KEY)) || parseStore(localStorage.getItem(CREATOR_BAK1)) || parseStore(localStorage.getItem(CREATOR_BAK2)) || blankStore();
}
function writeCreatorStore(store) {
  try {
    // Rotate the ring BEFORE overwriting, so a bad write (or a crash mid-write)
    // always leaves a previous-good library behind: current → bak1, old bak1 →
    // bak2. Two generations means one corrupt save can't take the library with it.
    const cur = localStorage.getItem(CREATOR_KEY);
    if (cur) {
      const b1 = localStorage.getItem(CREATOR_BAK1);
      if (b1) localStorage.setItem(CREATOR_BAK2, b1);
      localStorage.setItem(CREATOR_BAK1, cur);
    }
    localStorage.setItem(CREATOR_KEY, JSON.stringify(store));
    return true;
  } catch (e) {
    return false;
  }
}
function isKind(kind) {
  return CREATOR_KINDS.includes(kind);
}
function listCreations(kind) {
  if (!isKind(kind)) return [];
  return readCreatorStore()[kind].slice().sort((a, b) => (b.saved || 0) - (a.saved || 0));
}
function getCreation(kind, id) {
  if (!isKind(kind)) return null;
  return readCreatorStore()[kind].find((e) => e.id === id) || null;
}
// The portable payload — what a UI loads into a live gameplan / world. Deep-
// cloned so a caller mutating the loaded object can never write back into the
// stored library by reference.
function loadCreationData(kind, id) {
  const e = getCreation(kind, id);
  return e ? JSON.parse(JSON.stringify(e.data)) : null;
}
// Save-or-update. Update path: pass opts.id (edit in place, keeps created);
// otherwise a same-name entry of the same kind is overwritten (the Save button's
// natural "resave under this name" behaviour). Returns {ok, id, updated} or
// {ok:false, reason}. Caps only block genuinely NEW entries.
function saveCreation(kind, name, payload, opts = {}) {
  if (!isKind(kind)) return { ok: false, reason: "bad-kind" };
  if (payload == null || typeof payload !== "object") return { ok: false, reason: "bad-payload" };
  const store = readCreatorStore();
  const lib = store[kind];
  const cleanName = String(name || "Untitled").trim().slice(0, NAME_MAX) || "Untitled";
  const existing = opts.id ? lib.findIndex((e) => e.id === opts.id) : lib.findIndex((e) => e.name === cleanName);
  if (existing < 0 && lib.length >= (CREATOR_CAPS[kind] || 30)) return { ok: false, reason: "full", cap: CREATOR_CAPS[kind] };
  const now = Date.now();
  const id = existing >= 0 ? lib[existing].id : opts.id || `${kind.slice(0, -1)}-${now.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const entry = {
    id,
    kind,
    name: cleanName,
    v: SAVE_VERSION,
    created: existing >= 0 ? lib[existing].created || now : now,
    saved: now,
    data: JSON.parse(JSON.stringify(payload))
  };
  if (existing >= 0) lib[existing] = entry;
  else lib.push(entry);
  if (!writeCreatorStore(store)) return { ok: false, reason: "write" };
  return { ok: true, id, updated: existing >= 0 };
}
function renameCreation(kind, id, name) {
  if (!isKind(kind)) return false;
  const store = readCreatorStore();
  const e = store[kind].find((x) => x.id === id);
  if (!e) return false;
  e.name = String(name || e.name).trim().slice(0, NAME_MAX) || e.name;
  e.saved = Date.now();
  return writeCreatorStore(store);
}
function deleteCreation(kind, id) {
  if (!isKind(kind)) return false;
  const store = readCreatorStore();
  const i = store[kind].findIndex((e) => e.id === id);
  if (i < 0) return false;
  store[kind].splice(i, 1);
  return writeCreatorStore(store);
}
function duplicateCreation(kind, id) {
  const e = getCreation(kind, id);
  if (!e) return { ok: false, reason: "missing" };
  return saveCreation(kind, `${e.name} copy`.slice(0, NAME_MAX), e.data);
}
// ── Sharing: a creation is a self-describing JSON string. exportCreation gives
// the shareable text; importCreation validates the envelope and files it under
// its own kind, so a friend's playbook lands in the right shelf.
function exportCreation(kind, id) {
  const e = getCreation(kind, id);
  return e ? JSON.stringify({ id: e.id, kind: e.kind, name: e.name, v: e.v, data: e.data }) : null;
}
function importCreation(jsonStr) {
  let e;
  try {
    e = JSON.parse(jsonStr);
  } catch (_) {
    return { ok: false, reason: "parse" };
  }
  if (!e || !isKind(e.kind) || e.data == null || typeof e.data !== "object") return { ok: false, reason: "shape" };
  return saveCreation(e.kind, e.name, e.data);
}

export { CREATOR_KINDS, CREATOR_CAPS, listCreations, getCreation, loadCreationData, saveCreation, renameCreation, deleteCreation, duplicateCreation, exportCreation, importCreation };
