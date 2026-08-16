// creator_resilience_probe — Creator gaps #1 (load-time repair) + #2 (backup).
// Proves creations survive two things they'll actually face: the game changing
// under a saved creation, and a corrupt store. (1) repairCreation cleans a
// creation authored against older game data — dropping removed formations /
// concepts / variations / route parts / dead bases — and tells you what changed,
// never breaking on load; a clean creation is left untouched. (2) the cfb-creator
// backup ring recovers the last good library when the primary is corrupted, so a
// bad write can't wipe your creations. localStorage is polyfilled.
globalThis.localStorage = (() => {
  let m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k), clear: () => void (m = new Map()), _dump: () => m };
})();

const { saveCreation, listCreations } = await import('../js/engine/creator.js');
const { repairCreation } = await import('../js/engine/creatorrepair.js');
const { legalConceptsForFormation, validatePlaybook } = await import('../js/engine/playbook.js');

let pass = 0, fail = 0;
const bad = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; bad.push(msg); } }

// ── #1 REPAIR — playbook with old/removed references ────────────────────────
const spread = legalConceptsForFormation('Spread');
const stale = {
  name: 'Old Book',
  formations: [
    { id: 'Spread', weight: 50 },
    { id: 'Ghost Formation', weight: 30 },              // formation removed
    { id: 'Trips/Bunch', weight: 20, variation: 'gone' } // variation removed
  ],
  sheets: {
    'Spread': { [spread[0]]: 60, 'Nonexistent Concept': 40 }, // concept removed
    'Power-I': { 'Spacing': 50 }                               // now-illegal (real drift!)
  },
  tendency: 'Bogus Tendency'
};
let r = repairCreation('playbooks', stale);
ok(r.data.formations.length === 2, 'repair dropped the removed formation');
ok(r.data.formations.find((f) => f.id === 'Trips/Bunch') && !r.data.formations.find((f) => f.id === 'Trips/Bunch').variation, 'repair kept the formation but dropped its dead variation');
ok(!r.data.sheets['Spread']['Nonexistent Concept'] && r.data.sheets['Spread'][spread[0]] === 60, 'repair dropped the removed concept, kept the legal one');
ok(!r.data.sheets['Power-I'], 'repair dropped the Power-I sheet whose only concept is now illegal (Spacing)');
ok(!r.data.tendency, 'repair dropped the unknown tendency');
ok(r.ok && validatePlaybook(r.data).ok, 'repaired playbook validates clean');
ok(r.changes.length >= 5 && r.changes.every((c) => typeof c === 'string'), `repair reported the changes in plain language (${r.changes.length})`);

// clean playbook is left untouched
const clean = { name: 'Good Book', formations: [{ id: 'Spread', weight: 60 }], sheets: { 'Spread': { [spread[0]]: 70 } }, tendency: 'Balanced' };
r = repairCreation('playbooks', clean);
ok(r.ok && r.changes.length === 0, 'a clean playbook repairs to zero changes');
ok(JSON.stringify(r.data.sheets) === JSON.stringify(clean.sheets), 'a clean playbook is left untouched');

// ── #1 REPAIR — composed + custom plays ─────────────────────────────────────
r = repairCreation('plays', { name: 'Shot', parts: ['go', 'boguspart', 'flat', 'checkdown'] });
ok(r.ok && r.data.parts.length === 3 && r.changes.some((c) => c.includes('boguspart')), 'composed play: dropped unknown part, still buildable');
r = repairCreation('plays', { name: 'Broken', parts: ['go', 'nope1', 'nope2', 'nope3'] });
ok(!r.ok && r.data.parts.length === 1, 'composed play with too few valid parts → not auto-rebuildable');
r = repairCreation('plays', { name: 'Coach Mesh', kind: 'pass', base: 'Mesh' });
ok(r.ok, 'Model-A custom play with a live base is fine');
r = repairCreation('plays', { name: 'Dead', kind: 'pass', base: 'Concept That Was Deleted' });
ok(!r.ok && r.changes.some((c) => c.includes('no longer exists')), 'Model-A custom play with a dead base → flagged, needs rebuild');

// ── #1 REPAIR — league (compile is the check) ───────────────────────────────
r = repairCreation('leagues', { mode: 'seed', teams: [{ id: 't', name: 'T', division: 'D1', conf: 'NOPE', prestige: 4 }] });
ok(!r.ok && r.changes.length, 'a league that no longer compiles is flagged, not loaded blind');
r = repairCreation('teams', { name: 'My U', prestige: 5 });
ok(r.ok && r.changes.length === 0, 'a team identity has nothing to drift against — passes through');

// ── #2 BACKUP RING — corruption recovery ────────────────────────────────────
localStorage.clear();
const s1 = saveCreation('playbooks', 'Ring A', { formations: [{ id: 'Spread', weight: 10 }], sheets: {} });
const s2 = saveCreation('playbooks', 'Ring B', { formations: [{ id: 'Air Raid', weight: 20 }], sheets: {} });
ok(listCreations('playbooks').length === 2, 'two creations saved');
// after two writes the ring holds prior generations
ok(localStorage.getItem('cfb-creator.bak1') != null, 'backup ring populated after writes');
// corrupt the PRIMARY — read must recover the last good generation, not wipe out
localStorage.setItem('cfb-creator', '{ corrupt !!! not json');
const recovered = listCreations('playbooks');
ok(recovered.length >= 1, `corrupt primary recovers from the backup ring (${recovered.length} creation(s) survived)`);
ok(recovered.some((e) => e.name === 'Ring A' || e.name === 'Ring B'), 'recovered creations are the real ones, not blank');
// a fresh save after corruption still works (heals forward)
const s3 = saveCreation('playbooks', 'Ring C', { formations: [{ id: 'Spread', weight: 5 }], sheets: {} });
ok(s3.ok && listCreations('playbooks').some((e) => e.name === 'Ring C'), 'library heals forward after a corrupt primary');

console.log(`CREATOR RESILIENCE PROBE — ${pass} pass, ${fail} fail`);
if (fail) { console.log('  FAILURES:'); bad.forEach((m) => console.log('   -', m)); }
console.log(fail ? 'CREATOR RESILIENCE PROBE FAIL' : 'CREATOR RESILIENCE PROBE PASS');
process.exit(fail ? 1 : 0);
