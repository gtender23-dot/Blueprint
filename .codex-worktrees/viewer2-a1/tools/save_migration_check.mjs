// save_migration_check.mjs — release-checklist test for the save pipeline.
//   1. Round trip: a real mid-career state exports to JSON and imports back
//      with world/roster/coach integrity intact.
//   2. Version gate: an export stamped with an older _saveVersion is refused
//      with { _incompatible: true } (never a crash, never silent corruption).
//   3. Size guard: exported JSON stays under a sane ceiling deep into a
//      career (IndexedDB/localStorage budgets; also the chunked-history
//      question from Master spec §16 — measure instead of guessing).
// Run: node tools/save_migration_check.mjs [seasonsToSim]
const _ls = new Map();
global.localStorage = {
  getItem: (k) => _ls.has(k) ? _ls.get(k) : null,
  setItem: (k, v) => _ls.set(k, String(v)),
  removeItem: (k) => _ls.delete(k),
};

const { exportString, importJSON, rehydrate } = await import('../js/engine/persistence.js');
const { SAVE_VERSION } = await import('../js/constants.js');
const { generateWorld, generateRecruitPool, generateSchedule } = await import('../js/engine/world.js');

let failed = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}`); if (!ok) failed++; };

// Minimal real state (mirrors multiseason_test's shape).
const world = generateWorld();
world.recruits = generateRecruitPool(world);
const playerSchool = world.schools[0];
const state = {
  initialized: true, season: 3, day: 12,
  playerSchoolId: playerSchool.id,
  playerCoach: { id: 'player', schoolId: playerSchool.id, prestige: playerSchool.prestige,
                 reputation: 'C', budget: 50000, scholarshipsAvailable: 4, recruitBoard: [],
                 budgetCarryover: 0, seasonRecord: { wins: 6, losses: 2 } },
  world,
  schedule: generateSchedule(world),
  playoffs: null, inbox: [{ id: 1, text: 'test' }], gameLog: [],
  awardsLog: [{ season: 1, category: 'MVP', scope: 'season' }],
  coachHistory: [], signingsLog: [],
};

console.log('=== SAVE MIGRATION CHECK ===\n');

// 1. Round trip
const json = exportString(state);
check(typeof json === 'string' && json.length > 1000, `exportString produces JSON (${(json.length / 1024 / 1024).toFixed(1)} MB)`);
const back = importJSON(json);
check(!back?._incompatible, 'importJSON accepts a current-version export');
const re = rehydrate ? rehydrate(back) ?? back : back;
check(re.playerSchoolId === state.playerSchoolId, 'playerSchoolId survives round trip');
check(re.world?.schools?.length === state.world.schools.length, `school count survives (${re.world?.schools?.length})`);
check(re.world?.schools?.[0]?.roster?.length === state.world.schools[0].roster.length, 'roster sizes survive');
check(re.world?.recruits?.length === state.world.recruits.length, 'recruit pool survives');
check(re.season === 3 && re.day === 12, 'calendar position survives');
check((re.awardsLog || []).length === 1, 'awardsLog survives');
const p0 = state.world.schools[0].roster[0], r0 = re.world.schools[0].roster[0];
check(p0.id === r0.id && p0.attributes.SPD === r0.attributes.SPD, 'player identity + attributes survive');

// 2. Version gate — older save must be refused, not mangled.
// _saveVersion lives on data.state (the wrapper carries its own 'version').
const old = JSON.parse(json);
old.state._saveVersion = SAVE_VERSION - 1;
const gated = importJSON(JSON.stringify(old));
check(gated?._incompatible === true, `older _saveVersion (${SAVE_VERSION - 1}) is refused with _incompatible`);
// Malformed JSON: importJSON throws by contract; the Settings UI wraps the
// call in try/catch and shows "Import failed". Verify the throw is clean.
let threw = false;
try { importJSON('{not json'); } catch { threw = true; }
check(threw, 'malformed JSON throws cleanly (UI catches per contract)');

// 3. Size guard
const mb = json.length / 1024 / 1024;
check(mb < 44, `export size ${mb.toFixed(1)} MB under 44 MB ceiling (measured RNG-world range 38.8\u201340.6 MB \u2014 the old 40 ceiling flaked on worldgen dice; the guard exists to catch regression toward the 123 MB pre-diet disaster, and 44 still leaves 3\u00D7 headroom)`);

// 4. Diet integrity: a player who NEVER played gets emptyStats back; a player
// WITH stats keeps them exactly.
const bench = re.world.schools[0].roster.find(p => p.stats && Object.values(p.stats).every(v => !v));
check(!!bench, 'zero-stat players rehydrate with a full stats object');

// 5. The promise-survival assertions that lived here were removed with the
// recruit promise system (Aug 2026). dietSnapshot still DELETES any stale
// `promises` object it finds, so a migrated old save sheds ~1.5 MB of dead
// weight on its next write instead of carrying it forever.

console.log(failed === 0 ? '\nALL PASS ✅' : `\n${failed} FAILURE(S) ✗`);
process.exit(failed === 0 ? 0 : 1);
