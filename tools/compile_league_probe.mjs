// compile_league_probe — Creativity Tools, the league-blueprint compiler.
// Proves compileLeague(blueprint) → {schools, conferences}: required-field
// validation fails LOUD; a seed blueprint compiles into source tables that
// generateWorld(compileLeague(bp)) builds into a coherent world; abbr dedup runs
// even on author-set abbrs; state-centroid geo lands; a replace blueprint stands
// up a whole custom world; and the no-custom path stays inert (generateWorld()
// unchanged). Discipline: no opts ⇒ today's world exactly.
import { compileLeague, generateWorld, SCHOOL_DATA, CONFERENCES } from '../js/engine/world.js';

let pass = 0, fail = 0;
const bad = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; bad.push(msg); } }
function throws(fn, needle, msg) {
  try { fn(); ok(false, `${msg} (did not throw)`); }
  catch (e) { ok(String(e.message).includes(needle), `${msg} (msg="${e.message}")`); }
}

// ── 1. validation fails loud ───────────────────────────────────────────────
throws(() => compileLeague(null), 'must be an object', 'null blueprint rejected');
throws(() => compileLeague({ teams: [] }), 'no teams', 'empty teams rejected');
throws(() => compileLeague({ teams: [{ name: 'X', division: 'D1', conf: 'DELTA', prestige: 4 }] }), 'missing an id', 'team without id rejected');
throws(() => compileLeague({ teams: [{ id: 'x', division: 'D1', conf: 'DELTA', prestige: 4 }] }), 'missing name', 'team without name rejected');
throws(() => compileLeague({ teams: [{ id: 'x', name: 'X', division: 'DX', conf: 'DELTA', prestige: 4 }] }), 'bad division', 'bad division rejected');
throws(() => compileLeague({ teams: [{ id: 'x', name: 'X', division: 'D1', conf: 'NOPE', prestige: 4 }] }), 'not found', 'unresolved conf rejected');
throws(() => compileLeague({ teams: [{ id: 'x', name: 'X', division: 'D1', conf: 'DELTA', prestige: 99 }] }), 'out of band', 'prestige out of band rejected');
throws(() => compileLeague({ mode: 'replace', conferences: [{ id: 'A', division: 'D1' }], teams: [{ id: 'x', name: 'X', division: 'D1', conf: 'A', prestige: 4 }] }), 'at least 2', 'replace: 1-team conference rejected (schedule floor)');
// division-mismatch: conf is D1 (DELTA) but team says D2
throws(() => compileLeague({ teams: [{ id: 'x', name: 'X', division: 'D2', conf: 'DELTA', prestige: 3 }] }), '!=', 'team/conf division mismatch rejected');

// ── 2. seed blueprint → coherent world through the seam ─────────────────────
const seedBp = {
  mode: 'seed',
  teams: [
    { id: 'river_city_u', name: 'River City University', division: 'D1', conf: 'DELTA', prestige: 6, nick: 'Rapids', state: 'MO' },
    { id: 'harbor_tech', name: 'Harbor Tech', division: 'D1', conf: 'DELTA', prestige: 5, state: 'CA' }
  ]
};
const seeded = compileLeague(seedBp);
ok(seeded.schools.length === SCHOOL_DATA.length, `seed holds world size (${seeded.schools.length} == ${SCHOOL_DATA.length})`);
ok(seeded.schools.some((s) => s.id === 'river_city_u') && seeded.schools.some((s) => s.id === 'harbor_tech'), 'seed teams present in output');
ok(Object.keys(seeded.conferences).length === Object.keys(CONFERENCES).length, 'seed added no phantom conferences');
// every school resolves to a real conference
ok(seeded.schools.every((s) => seeded.conferences[s.conf]), 'every seeded school has a valid conference');
// build a live world from it and assert coherence
const w = generateWorld({ schools: seeded.schools, conferences: seeded.conferences });
const mine = w.schools.find((s) => s.id === 'river_city_u');
ok(mine && Array.isArray(mine.roster) && mine.roster.length > 0, 'custom team got a roster through generateWorld');
ok(mine.conf === 'DELTA' && w.conferences.DELTA, 'custom team sits in its conference');
ok(w.schools.every((s) => s.lat != null && s.lng != null), 'every school in the built world has geo (rivalry-ready)');

// ── 3. state-centroid geo lands (MO-ish lat/lng, not null) ─────────────────
ok(mine.lat > 30 && mine.lat < 45 && mine.lng < -85 && mine.lng > -100, `MO-centroid geo landed (lat ${mine.lat}, lng ${mine.lng})`);
const harbor = w.schools.find((s) => s.id === 'harbor_tech');
ok(harbor.lng < -110, `CA-centroid geo landed west (lng ${harbor.lng})`);

// ── 4. abbr dedup runs even on an author-set colliding abbr ─────────────────
const existingAbbr = SCHOOL_DATA.find((s) => s.division === 'D1').abbr;
const dedupBp = { mode: 'seed', teams: [{ id: 'collider_u', name: 'Collider University', division: 'D1', conf: 'DELTA', prestige: 4, abbr: existingAbbr }] };
const dd = compileLeague(dedupBp);
const collider = dd.schools.find((s) => s.id === 'collider_u');
ok(collider.abbr !== existingAbbr, `author abbr "${existingAbbr}" was deduped → "${collider.abbr}"`);
const allAbbrs = dd.schools.map((s) => s.abbr);
ok(new Set(allAbbrs).size === allAbbrs.length, 'no duplicate abbrs anywhere in the compiled world');
ok(dd.warnings.some((wn) => wn.includes('collided')), 'collision produced a warning');

// ── 5. one-team seed = "coach my custom team" needs no league ───────────────
const oneTeam = compileLeague({ teams: [{ id: 'solo_u', name: 'Solo University', division: 'D2', conf: SCHOOL_DATA.find((s) => s.division === 'D2').conf, prestige: 3 }] });
ok(oneTeam.schools.some((s) => s.id === 'solo_u'), 'one-team seed compiles (references an existing procedural conf)');

// ── 6. replace mode builds a whole custom world ─────────────────────────────
const replaceBp = { mode: 'replace', conferences: [
  { id: 'NORTH', name: 'North Conference', short: 'NOR', division: 'D1', conferenceClass: 'power' },
  { id: 'SOUTH', name: 'South Conference', short: 'SOU', division: 'D1', conferenceClass: 'midmajor' }
], teams: [] };
for (let i = 0; i < 4; i++) replaceBp.teams.push({ id: `n${i}`, name: `North Team ${i}`, division: 'D1', conf: 'NORTH', prestige: 4, state: 'OH' });
for (let i = 0; i < 4; i++) replaceBp.teams.push({ id: `s${i}`, name: `South Team ${i}`, division: 'D1', conf: 'SOUTH', prestige: 3, state: 'TX' });
const rep = compileLeague(replaceBp);
ok(rep.schools.length === 8 && Object.keys(rep.conferences).length === 2, 'replace built exactly the authored world (8 teams, 2 confs)');
const rw = generateWorld({ schools: rep.schools, conferences: rep.conferences });
ok(rw.schools.length === 8 && rw.schools.every((s) => s.roster.length > 0), 'replace world builds full rosters through the seam');
ok(rep.conferences.SOUTH.conferenceClass === 'midMajor', 'author "midmajor" normalized to internal "midMajor"');

// ── 7. inert: no-custom path unchanged ──────────────────────────────────────
ok(generateWorld().schools.length === SCHOOL_DATA.length, 'generateWorld() (no opts) still builds the default world');

console.log(`COMPILE LEAGUE PROBE — ${pass} pass, ${fail} fail`);
if (fail) { console.log('  FAILURES:'); bad.forEach((m) => console.log('   -', m)); }
console.log(fail ? 'COMPILE LEAGUE PROBE FAIL' : 'COMPILE LEAGUE PROBE PASS');
process.exit(fail ? 1 : 0);
