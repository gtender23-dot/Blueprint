import { SAVE_VERSION } from '../constants.js';
import { unfoldDnaToSkills } from './coachprofile.js';
import { emptyStats, refreshRatings } from './player.js';
import { registerCoachName, resetCoachNames } from './staff.js';
import { ensureTree } from './tree.js';

function _jsonUnsafeType(v) {
  if (v instanceof Set) return "Set";
  if (v instanceof Map) return "Map";
  return null;
}
function saveDietReplacer(key, value) {
  if (key === "roleRatings") return void 0;
  const bad = _jsonUnsafeType(value);
  if (bad && !_warnedSaveKeys.has(key)) {
    _warnedSaveKeys.add(key);
    console.warn(`[save] "${key}" is a ${bad} \u2014 it serializes to {} and loses its data on load. Store it as an array and rebuild the ${bad} on read (see warChest in recruiting.js).`);
  }
  return value;
}
function auditSaveState(root, { maxNodes = 2e5 } = {}) {
  const offenders = [];
  const seen = /* @__PURE__ */ new Set();
  let budget = maxNodes;
  const walk = (val, path) => {
    if (budget-- <= 0 || val == null || typeof val !== "object") return;
    const bad = _jsonUnsafeType(val);
    if (bad) {
      offenders.push({ path, type: bad });
      return;
    }
    if (seen.has(val)) return;
    seen.add(val);
    if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) walk(val[i], `${path}[${i}]`);
    } else {
      for (const k of Object.keys(val)) walk(val[k], path ? `${path}.${k}` : k);
    }
  };
  walk(root, "");
  return offenders;
}
function rehydrate(saved) {
  var _a, _b;
  if (!((_a = saved == null ? void 0 : saved.world) == null ? void 0 : _a.schools)) return saved;
  const restore = (p) => {
    if (!p.stats) p.stats = emptyStats();
    if (!p.careerStats) p.careerStats = emptyStats();
    if (p.position === "FB") {
      p.position = "RB";
      if (p.role && typeof p.role === "string" && p.role.indexOf("FB-") === 0) {
      } else if (p.archetype && typeof p.archetype === "string" && p.archetype.indexOf("FB-") === 0) {
      }
    }
  };
  for (const school of saved.world.schools) {
    for (const p of school.roster || []) {
      restore(p);
      try {
        refreshRatings(p);
      } catch (e) {
      }
    }
  }
  for (const r of saved.world.recruits || []) restore(r);
  // [DNA TREE §4 D3] The un-fold's floor mapping: earned DNA XP in recruiter/
  // developer seeds the in-world coach's SKILL XP (idempotent floor — a man
  // keeps what he earned, and a re-load can never double-award it).
  try {
    if (saved._coachId && saved.playerCoach) unfoldDnaToSkills(saved._coachId, saved.playerCoach);
  } catch (e) {
  }
  // [DNA TREE §8 ride-along] Re-seed the world-scoped coach-name dedup from
  // the save being loaded, so names rolled in THIS session can't duplicate the
  // ones already living in the world. Read-only against the save; byte-safe.
  resetCoachNames();
  for (const school of saved.world.schools) {
    if (school.coach && school.coach.name) registerCoachName(school.coach.name);
    if (school.staff) {
      if (school.staff.oc && school.staff.oc.name) registerCoachName(school.staff.oc.name);
      if (school.staff.dc && school.staff.dc.name) registerCoachName(school.staff.dc.name);
    }
  }
  if (saved.pendingHalftime || ((_b = saved.ui) == null ? void 0 : _b.pendingKickoff)) {
    saved.pendingHalftime = null;
    saved._callModeToday = null;
    saved._pregamePlan = null;
    if (saved.ui) {
      saved.ui.pendingKickoff = null;
      saved.ui.liveWatch = null;
      saved.ui.autoRun = false;
      saved.ui.showHalftime = false;
      saved.ui.showCallSheet = false;
      saved.ui.showFourthDown = false;
      saved.ui._finalWatched = null;
    }
  }
  // [W9 §12] The tree is a plain-JSON overlay, so it round-trips through the
  // save intact with no special handling. ensureTree is the same lazy first-
  // touch migration W1/W2 established: it fills defaults in place and returns
  // null for every non-tree save. It NEVER invents a tree on a save that never
  // had one — a legacy career reads as a non-tree game forever. Wrapped so the
  // meta-layer can never block a load.
  try {
    ensureTree(saved);
  } catch (e) {
  }
  return saved;
}
function dietSnapshot(snapshot) {
  var _a, _b;
  const allZero = (o) => {
    for (const k in o) {
      if (o[k]) return false;
    }
    return true;
  };
  const diet = (p) => {
    if (p.stats && allZero(p.stats)) delete p.stats;
    if (p.careerStats && allZero(p.careerStats)) delete p.careerStats;
  };
  for (const school of ((_a = snapshot.world) == null ? void 0 : _a.schools) || []) {
    for (const p of school.roster || []) diet(p);
  }
  for (const r of ((_b = snapshot.world) == null ? void 0 : _b.recruits) || []) diet(r);
  if (Array.isArray(snapshot.signingsLog) && snapshot.signingsLog.length) {
    const minSeason = (snapshot.season || 1) - 10;
    snapshot.signingsLog = snapshot.signingsLog.filter((e) => (e.season || 0) >= minSeason);
  }
  if (Array.isArray(snapshot.awardsLog) && snapshot.awardsLog.length) {
    const minMajor = (snapshot.season || 1) - 10, minWeekly = (snapshot.season || 1) - 2;
    snapshot.awardsLog = snapshot.awardsLog.filter((a) => a.scope === "weekly" ? (a.season || 0) >= minWeekly : (a.season || 0) >= minMajor);
  }
  return snapshot;
}
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME, { keyPath: "slot" });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}
function gamePauseIsLive(state2) {
  var _a;
  return !!((state2 == null ? void 0 : state2.pendingHalftime) || ((_a = state2 == null ? void 0 : state2.ui) == null ? void 0 : _a.pendingKickoff));
}
function buildSnapshot(state2) {
  const snapshot = JSON.parse(JSON.stringify(state2, saveDietReplacer));
  dietSnapshot(snapshot);
  snapshot._saveVersion = SAVE_VERSION;
  return snapshot;
}
function flushSaveSync(state2, slot = "auto") {
  try {
    if (!state2 || !state2.world) return false;
    if (gamePauseIsLive(state2)) return false;
    const snapshot = buildSnapshot(state2);
    localStorage.setItem(`cfb-flush-${slot}`, JSON.stringify({ timestamp: Date.now(), state: snapshot }));
    return true;
  } catch (e) {
    return false;
  }
}
async function saveGame(state2, slot = "auto") {
  if (gamePauseIsLive(state2)) return false;
  const snapshot = buildSnapshot(state2);
  const ts = Date.now();
  try {
    localStorage.setItem(`cfb-flush-${slot}`, JSON.stringify({ timestamp: ts, state: snapshot }));
  } catch (e) {
  }
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    // Rolling backup ring (release hardening, Aug 2026): before this write
    // lands, the record it overwrites survives as `<slot>.bak1`, and the old
    // bak1 as `<slot>.bak2` — all inside the SAME transaction, so the ring can
    // never half-rotate. Two generations means a bad save (or a corrupted
    // state at save time) always leaves a previous-good snapshot behind;
    // loadGame walks the ring when the primary record is gone. IndexedDB
    // requests in one transaction run FIFO, so both gets below read the
    // PRE-write records even though the new put is queued after them. Backup
    // keys are hidden from listSaves and die with their slot in deleteSlotData.
    const prevBak = store.get(slot + ".bak1");
    prevBak.onsuccess = () => {
      const b = prevBak.result;
      if (b && b.state) store.put({ slot: slot + ".bak2", timestamp: b.timestamp, state: b.state });
    };
    const prevMain = store.get(slot);
    prevMain.onsuccess = () => {
      const m = prevMain.result;
      if (m && m.state) store.put({ slot: slot + ".bak1", timestamp: m.timestamp, state: m.state });
    };
    store.put({ slot, timestamp: ts, state: snapshot });
    return new Promise((res, rej) => {
      tx.oncomplete = () => res(true);
      tx.onerror = (e) => rej(e.target.error);
    });
  } catch (e) {
    try {
      localStorage.setItem(`cfb-dynasty-${slot}`, JSON.stringify({ timestamp: ts, state: snapshot }));
      return true;
    } catch (e2) {
      return false;
    }
  }
}
function readFlushSave(slot) {
  try {
    const raw = localStorage.getItem(`cfb-flush-${slot}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.state) return null;
    return { timestamp: parsed.timestamp || 0, state: parsed.state };
  } catch (e) {
    return null;
  }
}
async function deleteSlotData(slot) {
  try {
    localStorage.removeItem(`cfb-flush-${slot}`);
    localStorage.removeItem(`cfb-dynasty-${slot}`);
  } catch (e) {
  }
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(slot);
    // The backup ring dies with its slot — a deleted world must not be
    // resurrectable from a backup key the UI never shows.
    store.delete(slot + ".bak1");
    store.delete(slot + ".bak2");
    return new Promise((res) => {
      tx.oncomplete = () => res(true);
      tx.onerror = () => res(false);
    });
  } catch (e) {
    return false;
  }
}
async function loadGame(slot = "auto") {
  const flush = readFlushSave(slot);
  const resolveNewest = (idbState, idbTs) => {
    const useFlush = flush && flush.timestamp > (idbTs || 0);
    const saved = useFlush ? flush.state : idbState;
    if (!saved) return null;
    if (saved._saveVersion !== SAVE_VERSION) return { _incompatible: true };
    return rehydrate(saved);
  };
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(slot);
    return new Promise((res, rej) => {
      req.onsuccess = (e) => {
        const rec = e.target.result;
        const saved = rec == null ? void 0 : rec.state;
        const idbTs = rec == null ? void 0 : rec.timestamp;
        const primary = resolveNewest(saved, idbTs);
        if (primary) {
          res(primary);
          return;
        }
        // Primary record gone (storage eviction, partial clear): walk the
        // backup ring, newest first. Recovery goes through the same
        // resolveNewest path, so the save-version gate still applies to a
        // recovered snapshot. An _incompatible primary does NOT reach here —
        // it resolved above; the ring only answers for a MISSING save.
        const reqB1 = store.get(slot + ".bak1");
        reqB1.onsuccess = (e1) => {
          const rec1 = e1.target.result;
          const fromB1 = resolveNewest(rec1 == null ? void 0 : rec1.state, rec1 == null ? void 0 : rec1.timestamp);
          if (fromB1) {
            res(fromB1);
            return;
          }
          const reqB2 = store.get(slot + ".bak2");
          reqB2.onsuccess = (e2) => {
            const rec2 = e2.target.result;
            res(resolveNewest(rec2 == null ? void 0 : rec2.state, rec2 == null ? void 0 : rec2.timestamp));
          };
          reqB2.onerror = () => res(null);
        };
        reqB1.onerror = () => res(null);
      };
      req.onerror = (e) => rej(e.target.error);
    });
  } catch (e) {
    try {
      const raw = localStorage.getItem(`cfb-dynasty-${slot}`);
      const legacy = raw ? JSON.parse(raw) : null;
      return resolveNewest(legacy == null ? void 0 : legacy.state, legacy == null ? void 0 : legacy.timestamp);
    } catch (e2) {
      return flush ? resolveNewest(null, 0) : null;
    }
  }
}
async function listSaves() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    return new Promise((res, rej) => {
      const req = store.getAll();
      req.onsuccess = (e) => res(e.target.result.filter((r) => String(r.slot).indexOf(".bak") === -1).map((r) => {
        var _a, _b, _c, _d, _e, _f, _g;
        const isIncompat = ((_a = r.state) == null ? void 0 : _a._saveVersion) !== SAVE_VERSION;
        const school = isIncompat ? null : (_d = (_c = (_b = r.state) == null ? void 0 : _b.world) == null ? void 0 : _c.schools) == null ? void 0 : _d.find((s) => {
          var _a2;
          return s.id === ((_a2 = r.state) == null ? void 0 : _a2.playerSchoolId);
        });
        return { slot: r.slot, timestamp: r.timestamp, season: (_e = r.state) == null ? void 0 : _e.season, day: (_f = r.state) == null ? void 0 : _f.day, school: (school == null ? void 0 : school.name) || (isIncompat ? "(old save)" : (_g = r.state) == null ? void 0 : _g.playerSchoolId), record: (school == null ? void 0 : school.record) || null, incompatible: isIncompat };
      }));
      req.onerror = (e) => rej(e.target.error);
    });
  } catch (e) {
    return [];
  }
}
function exportString(state2) {
  const snapshot = JSON.parse(JSON.stringify(state2, saveDietReplacer));
  dietSnapshot(snapshot);
  // A paused game is never serialized (same rule as the save-path gate). A
  // mid-play pause isn't resumable from an exported file anyway — rehydrate drops
  // it on load — so strip it from the clone rather than block the export.
  if (snapshot.pendingHalftime) delete snapshot.pendingHalftime;
  if (snapshot.ui && snapshot.ui.pendingKickoff) delete snapshot.ui.pendingKickoff;
  snapshot._saveVersion = SAVE_VERSION;
  return JSON.stringify({ version: "1.0", timestamp: Date.now(), state: snapshot });
}
function exportJSON(state2) {
  const data = exportString(state2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dynasty-s${state2.season}-d${state2.day}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
function importJSON(jsonStr) {
  const data = JSON.parse(jsonStr);
  const saved = data.state || null;
  if (saved && saved._saveVersion !== SAVE_VERSION) return { _incompatible: true };
  return saved ? rehydrate(saved) : null;
}
var _warnedSaveKeys, DB_NAME, DB_VERSION, STORE_NAME;

_warnedSaveKeys = /* @__PURE__ */ new Set();
DB_NAME = "cfb-dynasty";
DB_VERSION = 1;
STORE_NAME = "saves";

export { auditSaveState, deleteSlotData, exportJSON, exportString, flushSaveSync, gamePauseIsLive, importJSON, listSaves, loadGame, rehydrate, saveGame };
