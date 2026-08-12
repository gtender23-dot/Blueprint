// save_backup_probe.mjs — proves the rolling backup ring in persistence.js
// (release hardening, Aug 2026).
//
// Contract under test:
//   1. Every saveGame(slot) rotates the overwritten record into `<slot>.bak1`
//      and the previous bak1 into `<slot>.bak2`, in the same transaction.
//   2. loadGame(slot) returns the primary when present; when the primary
//      record is MISSING (eviction / partial clear) it falls back to bak1,
//      then bak2.
//   3. The version gate still applies to recovered snapshots — an old
//      _saveVersion backup is refused with { _incompatible: true }, never
//      silently loaded.
//   4. listSaves() never shows `.bak` keys.
//   5. deleteSlotData(slot) removes the primary AND both backups.
//
// Runs against a minimal in-memory IndexedDB + localStorage fake (callbacks
// via queueMicrotask, FIFO like the real thing), so it exercises the actual
// persistence.js code paths with no browser.
// Run: node tools/save_backup_probe.mjs

// ── fakes ────────────────────────────────────────────────────────────────────
const _ls = new Map();
global.localStorage = {
  getItem: (k) => (_ls.has(k) ? _ls.get(k) : null),
  setItem: (k, v) => _ls.set(k, String(v)),
  removeItem: (k) => _ls.delete(k),
};

const _db = new Map(); // slot -> record
class FakeRequest {
  constructor(exec) {
    this.onsuccess = null;
    this.onerror = null;
    queueMicrotask(() => {
      try {
        this.result = exec();
        if (this.onsuccess) this.onsuccess({ target: this });
      } catch (err) {
        this.error = err;
        if (this.onerror) this.onerror({ target: this });
      }
    });
  }
}
class FakeStore {
  get(key) { return new FakeRequest(() => (_db.has(key) ? structuredClone(_db.get(key)) : undefined)); }
  put(rec) { return new FakeRequest(() => { _db.set(rec.slot, structuredClone(rec)); return rec.slot; }); }
  delete(key) { return new FakeRequest(() => { _db.delete(key); return undefined; }); }
  getAll() { return new FakeRequest(() => Array.from(_db.values()).map((r) => structuredClone(r))); }
}
class FakeTx {
  constructor() {
    this.oncomplete = null;
    this.onerror = null;
    this._store = new FakeStore();
    // Complete after all queued microtasks (requests) have run — two macro
    // hops is enough for the depth this code uses.
    setTimeout(() => { if (this.oncomplete) this.oncomplete(); }, 0);
  }
  objectStore() { return this._store; }
}
global.indexedDB = {
  open() {
    const req = { onupgradeneeded: null, onsuccess: null, onerror: null };
    queueMicrotask(() => {
      const db = { transaction: () => new FakeTx(), createObjectStore: () => new FakeStore() };
      if (req.onupgradeneeded) req.onupgradeneeded({ target: { result: db } });
      if (req.onsuccess) req.onsuccess({ target: { result: db } });
    });
    return req;
  },
};

const { saveGame, loadGame, listSaves, deleteSlotData } = await import('../js/engine/persistence.js');
const { SAVE_VERSION } = await import('../js/constants.js');

let failed = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}`); if (!ok) failed++; };
const mkState = (marker) => ({ world: { schools: [] }, season: 1, day: marker, marker });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The localStorage flush write is newest-wins vs IDB; the ring answers for the
// "storage partially cleared" scenario, so clear the flush before each load.
const clearFlush = () => { for (const k of Array.from(_ls.keys())) _ls.delete(k); };

console.log('=== SAVE BACKUP RING PROBE ===\n');

// 1. Three saves rotate the ring.
await saveGame(mkState(1), 'w1'); await sleep(5);
await saveGame(mkState(2), 'w1'); await sleep(5);
await saveGame(mkState(3), 'w1'); await sleep(5);
check(_db.get('w1')?.state?.marker === 3, 'primary holds save #3');
check(_db.get('w1.bak1')?.state?.marker === 2, 'bak1 holds save #2');
check(_db.get('w1.bak2')?.state?.marker === 1, 'bak2 holds save #1');

// 2. Primary wins when present.
clearFlush();
const primary = await loadGame('w1');
check(primary?.marker === 3, 'loadGame returns primary when present');

// 3. Missing primary falls back to bak1, then bak2.
_db.delete('w1'); clearFlush();
const fromBak1 = await loadGame('w1');
check(fromBak1?.marker === 2, 'missing primary → recovered from bak1');
_db.delete('w1.bak1'); clearFlush();
const fromBak2 = await loadGame('w1');
check(fromBak2?.marker === 1, 'missing primary+bak1 → recovered from bak2');
_db.delete('w1.bak2'); clearFlush();
const nothing = await loadGame('w1');
check(nothing === null || nothing === undefined, 'empty ring → null, no invention');

// 4. Version gate applies to recovered snapshots.
_db.set('w2.bak1', { slot: 'w2.bak1', timestamp: 1, state: { _saveVersion: SAVE_VERSION - 1, world: { schools: [] } } });
clearFlush();
const oldBak = await loadGame('w2');
check(!!oldBak?._incompatible, 'old-version backup refused with _incompatible');
_db.delete('w2.bak1');

// 5. listSaves hides the ring.
await saveGame(mkState(9), 'w3'); await sleep(5);
await saveGame(mkState(10), 'w3'); await sleep(5);
const listed = await listSaves();
check(listed.some((s) => s.slot === 'w3'), 'listSaves shows the primary slot');
check(!listed.some((s) => String(s.slot).indexOf('.bak') !== -1), 'listSaves hides .bak keys');

// 6. deleteSlotData kills primary + ring.
await deleteSlotData('w3'); await sleep(5);
check(!_db.has('w3') && !_db.has('w3.bak1') && !_db.has('w3.bak2'), 'deleteSlotData removes primary and both backups');

console.log(failed === 0 ? '\nALL PASS ✅' : `\n${failed} FAILURES ❌`);
process.exit(failed === 0 ? 0 : 1);
