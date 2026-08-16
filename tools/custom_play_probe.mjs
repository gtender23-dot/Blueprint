// custom_play_probe — Creativity Tools, the band-safe Play Composer (Model A).
// Proves the guarantee that lets this ship with zero owner ruling: a custom play
// resolves to its base concept VERBATIM — same vs table, same exec — so it is
// balance-identical by construction and cannot move a stat_realism band. Also
// covers validation (kind, base existence, formation legality warnings).
import { CUSTOM_PLAY_SCHEMA_VERSION, baseConceptsForKind, emptyCustomPlay, validateCustomPlay, resolveToConcept } from '../js/engine/customplay.js';
import { PASS_CONCEPTS, RUN_CONCEPTS } from '../js/concepts.js';

let pass = 0, fail = 0;
const bad = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; bad.push(msg); } }

// ── base concept lists ──────────────────────────────────────────────────────
ok(baseConceptsForKind('pass').length === Object.keys(PASS_CONCEPTS).length, 'pass base list == PASS_CONCEPTS');
ok(baseConceptsForKind('run').length === Object.keys(RUN_CONCEPTS).length, 'run base list == RUN_CONCEPTS');

// ── validation ──────────────────────────────────────────────────────────────
ok(validateCustomPlay({ name: 'Coach Mesh', kind: 'pass', base: 'Mesh' }).ok, 'valid pass custom play');
ok(validateCustomPlay({ name: 'Coach IZ', kind: 'run', base: 'Inside Zone' }).ok, 'valid run custom play');
ok(!validateCustomPlay({ name: 'x', kind: 'jump', base: 'Mesh' }).ok, 'bad kind rejected');
ok(!validateCustomPlay({ name: 'x', kind: 'pass', base: 'Not A Concept' }).ok, 'unknown base rejected');
ok(!validateCustomPlay({ name: 'x', kind: 'pass', base: null }).ok, 'missing base rejected');
ok(!validateCustomPlay({ name: 'x', kind: 'run', base: 'Mesh' }).ok, 'pass concept as a run base rejected');
ok(!validateCustomPlay({ name: 'x', kind: 'pass', base: 'Mesh', formations: ['Nope'] }).ok, 'unknown formation rejected');
// formation that doesn't carry the base → warning, not error
let v = validateCustomPlay({ name: 'x', kind: 'pass', base: 'Mesh', formations: ['Power-I'] });
ok(v.ok && v.warnings.some((w) => w.includes('does not carry')), "base not in a formation's list warns, not errors");
ok(emptyCustomPlay('Blank').schemaVersion === CUSTOM_PLAY_SCHEMA_VERSION, 'emptyCustomPlay stamped');

// ── THE band-safe guarantee: resolve == base concept, grades verbatim ───────
let checked = 0;
for (const [nm, base] of Object.entries(PASS_CONCEPTS)) {
  const r = resolveToConcept({ name: `Custom ${nm}`, kind: 'pass', base: nm });
  ok(r.name === `Custom ${nm}` && r._customOf === nm, `resolve keeps custom name for ${nm}`);
  ok(JSON.stringify(r.vs) === JSON.stringify(base.vs), `${nm}: vs table identical to base`);
  ok(JSON.stringify(r.exec) === JSON.stringify(base.exec), `${nm}: exec identical to base`);
  ok(r.depth === base.depth && r.minWR === base.minWR && r.motion === base.motion, `${nm}: structural flags identical`);
  checked++;
}
for (const [nm, base] of Object.entries(RUN_CONCEPTS)) {
  const r = resolveToConcept({ name: `Custom ${nm}`, kind: 'run', base: nm });
  ok(JSON.stringify(r.vsBox) === JSON.stringify(base.vsBox) && JSON.stringify(r.exec) === JSON.stringify(base.exec), `${nm}: run grades identical to base`);
  ok(r.type === base.type, `${nm}: run type identical`);
}
ok(resolveToConcept({ name: 'x', kind: 'pass', base: 'Mesh' })._customOf === 'Mesh', 'resolved concept marks its base');
ok((() => { try { resolveToConcept({ kind: 'pass', base: 'Nope' }); return false; } catch (e) { return true; } })(), 'resolve throws on invalid custom play');

console.log(`CUSTOM PLAY PROBE — ${pass} pass, ${fail} fail  (${checked} pass concepts + ${Object.keys(RUN_CONCEPTS).length} runs verified grade-identical)`);
if (fail) { console.log('  FAILURES:'); bad.slice(0, 20).forEach((m) => console.log('   -', m)); }
console.log(fail ? 'CUSTOM PLAY PROBE FAIL' : 'CUSTOM PLAY PROBE PASS');
process.exit(fail ? 1 : 0);
