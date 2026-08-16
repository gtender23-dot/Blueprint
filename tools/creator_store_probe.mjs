// creator_store_probe — Creativity Tools, the global Creator library.
// Proves the store that makes "save a creation, load it into any tree/world"
// true: CRUD, caps, name-overwrite vs edit-in-place, portability (loaded data is
// a deep clone with no world binding), corruption tolerance, export/import
// round-trip. A minimal in-memory localStorage polyfill stands in for the
// browser — the store is UI-layer persistence, so node needs it faked.
globalThis.localStorage = (() => {
  let m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => void (m = new Map()),
    _raw: () => m
  };
})();

const { CREATOR_KINDS, CREATOR_CAPS, listCreations, getCreation, loadCreationData, saveCreation, renameCreation, deleteCreation, duplicateCreation, exportCreation, importCreation } = await import('../js/engine/creator.js');

let pass = 0, fail = 0;
const bad = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; bad.push(msg); } }

// ── kinds present ─────────────────────────────────────────────────────────
// (six since 2026-08-16: Stage 7's Formation Designer added the `formations`
// shelf; five since 2026-08-15: the Defensive Playbook added `defbooks`)
ok(CREATOR_KINDS.length === 6, 'six creation kinds');
ok(CREATOR_KINDS.includes('defbooks') && (CREATOR_CAPS.defbooks || 0) >= 1, 'defbooks shelf exists with a cap');
ok(CREATOR_KINDS.includes('formations') && (CREATOR_CAPS.formations || 0) >= 1, 'formations shelf exists with a cap');

// ── empty store reads clean for every kind ────────────────────────────────
for (const k of CREATOR_KINDS) ok(Array.isArray(listCreations(k)) && listCreations(k).length === 0, `empty ${k}`);
ok(listCreations('bogus').length === 0, 'unknown kind → empty');

// ── save + read back ──────────────────────────────────────────────────────
const r1 = saveCreation('playbooks', 'Air Raid Base', { formations: ['Air Raid', 'Empty'], concepts: { 'Air Raid': ['Four Verts', 'Mesh'] } });
ok(r1.ok && !r1.updated && r1.id, 'save new playbook');
ok(listCreations('playbooks').length === 1, 'one playbook stored');
const got = getCreation('playbooks', r1.id);
ok(got && got.name === 'Air Raid Base' && got.v != null && got.created && got.saved, 'entry is version+time stamped');

// ── portability: loaded data is a DEEP CLONE, no world binding, no writeback ─
const loaded = loadCreationData('playbooks', r1.id);
loaded.formations.push('MUTATED');
ok(getCreation('playbooks', r1.id).data.formations.length === 2, 'loaded data is a clone — mutation does not write back');
ok(JSON.stringify(got).indexOf('coachId') < 0 && JSON.stringify(got).indexOf('treeId') < 0, 'entry binds to no coach/tree/world');

// ── name-overwrite (resave under same name replaces, does not duplicate) ────
const r2 = saveCreation('playbooks', 'Air Raid Base', { formations: ['Air Raid'], concepts: {} });
ok(r2.ok && r2.updated && r2.id === r1.id, 'same-name save overwrites, keeps id');
ok(listCreations('playbooks').length === 1, 'no duplicate after overwrite');
ok(getCreation('playbooks', r1.id).created === got.created, 'overwrite preserves created stamp');

// ── edit-in-place by id (rename via new name + same id) ────────────────────
const r3 = saveCreation('playbooks', 'Air Raid Renamed', { formations: ['Air Raid'], concepts: {} }, { id: r1.id });
ok(r3.ok && r3.updated && r3.id === r1.id, 'edit-in-place by id');
ok(getCreation('playbooks', r1.id).name === 'Air Raid Renamed', 'name updated in place');
ok(listCreations('playbooks').length === 1, 'edit-in-place did not add a row');

// ── rename / duplicate / delete ────────────────────────────────────────────
renameCreation('playbooks', r1.id, 'Final Name');
ok(getCreation('playbooks', r1.id).name === 'Final Name', 'renameCreation');
const dup = duplicateCreation('playbooks', r1.id);
ok(dup.ok && dup.id !== r1.id && listCreations('playbooks').length === 2, 'duplicateCreation makes a new row');
ok(getCreation('playbooks', dup.id).name === 'Final Name copy', 'duplicate is named "… copy"');
ok(deleteCreation('playbooks', dup.id) && listCreations('playbooks').length === 1, 'deleteCreation removes the row');
ok(!deleteCreation('playbooks', 'nope'), 'delete of missing id → false');

// ── caps only block NEW entries ────────────────────────────────────────────
localStorage.clear();
const cap = CREATOR_CAPS.leagues;
for (let i = 0; i < cap; i++) ok(saveCreation('leagues', `L${i}`, { teams: i }).ok, `league ${i} within cap`);
const over = saveCreation('leagues', 'Overflow', { teams: 99 });
ok(!over.ok && over.reason === 'full' && over.cap === cap, 'cap blocks the new entry over the limit');
ok(saveCreation('leagues', 'L0', { teams: 0 }).ok, 'overwrite of existing still allowed at cap');

// ── bad inputs ─────────────────────────────────────────────────────────────
ok(!saveCreation('bogus', 'x', {}).ok, 'save bad kind rejected');
ok(!saveCreation('plays', 'x', null).ok, 'save null payload rejected');
ok(saveCreation('plays', '', { a: 1 }).ok, 'blank name accepted (defaults to Untitled)');
ok(getCreation('plays', listCreations('plays')[0].id).name === 'Untitled', 'blank name → Untitled');

// ── export / import round-trip files under the right kind ──────────────────
localStorage.clear();
const src = saveCreation('teams', 'My U', { school: { name: 'My U', ovr: 82 } });
const text = exportCreation('teams', src.id);
ok(typeof text === 'string' && text.includes('My U'), 'exportCreation returns text');
localStorage.clear();
const imp = importCreation(text);
ok(imp.ok && listCreations('teams').length === 1, 'importCreation files it back');
ok(getCreation('teams', imp.id).data.school.ovr === 82, 'imported payload intact');
ok(!importCreation('{not json').ok && importCreation('{"kind":"nope","data":{}}').ok === false, 'import rejects garbage + bad kind');

// ── corruption tolerance ───────────────────────────────────────────────────
localStorage.setItem('cfb-creator', '{ this is not json');
ok(listCreations('playbooks').length === 0, 'corrupt store degrades to empty, no throw');
localStorage.setItem('cfb-creator', '{"playbooks":"notarray"}');
ok(Array.isArray(listCreations('playbooks')), 'wrong-typed shelf degrades to array');

console.log(`CREATOR STORE PROBE — ${pass} pass, ${fail} fail`);
if (fail) { console.log('  FAILURES:'); bad.forEach((m) => console.log('   -', m)); }
console.log(fail ? 'CREATOR STORE PROBE FAIL' : 'CREATOR STORE PROBE PASS');
process.exit(fail ? 1 : 0);
