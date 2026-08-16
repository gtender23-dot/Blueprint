// creator_world_probe — the generateWorld(opts) source seam.
// Proves the seam is INERT BY DEFAULT: under an identically-seeded RNG,
// generateWorld(), generateWorld({}), generateWorld(undefined), and
// generateWorld({schools: SCHOOL_DATA, conferences: CONFERENCES}) all produce a
// byte-identical world — the single-coach/default world path is untouched. A
// sensitivity arm (different seed ⇒ different world) guards against a probe that
// passes trivially. Same discipline as the formation-variation / creator-store
// seams: no opts ⇒ today's game exactly.
import { generateWorld, SCHOOL_DATA, CONFERENCES } from '../js/engine/world.js';

// Deterministic PRNG so both world builds draw the same random sequence.
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function snap(seed, arg, hasArg) {
  const orig = Math.random;
  Math.random = mulberry32(seed);
  let w;
  try { w = hasArg ? generateWorld(arg) : generateWorld(); }
  finally { Math.random = orig; }
  return JSON.stringify(w);
}

let pass = 0, fail = 0;
const bad = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; bad.push(msg); } }

const SEED = 0x1234abcd;
const base = snap(SEED, undefined, false);              // generateWorld()
const empty = snap(SEED, {}, true);                     // generateWorld({})
const undef = snap(SEED, undefined, true);              // generateWorld(undefined)
const explicit = snap(SEED, { schools: SCHOOL_DATA, conferences: CONFERENCES }, true);
const other = snap(0x9999f00d, undefined, false);       // different seed

ok(base === empty, 'generateWorld() ≡ generateWorld({}) — empty opts inert');
ok(base === undef, 'generateWorld() ≡ generateWorld(undefined) — undefined opts inert');
ok(base === explicit, 'generateWorld() ≡ explicit global source tables — seam threads cleanly');
ok(base !== other, 'different RNG seed ⇒ different world (snapshot is sensitive, probe is real)');

// structural sanity — the seam still returns a well-formed world
const w = JSON.parse(base);
ok(Array.isArray(w.schools) && w.schools.length > 0, 'world has schools');
ok(w.conferences && typeof w.conferences === 'object', 'world has conferences');
ok(w.season === 1 && Array.isArray(w.recruits), 'world has season + recruits shell');
ok(w.schools.every((s) => s.division && s.conf && Array.isArray(s.roster)), 'every school has division/conf/roster');
ok(w.schools.length === SCHOOL_DATA.length, 'default world school count == SCHOOL_DATA');

console.log(`CREATOR WORLD PROBE — ${pass} pass, ${fail} fail  (${w.schools.length} schools)`);
if (fail) { console.log('  FAILURES:'); bad.forEach((m) => console.log('   -', m)); }
console.log(fail ? 'CREATOR WORLD PROBE FAIL' : 'CREATOR WORLD PROBE PASS');
process.exit(fail ? 1 : 0);
