// defbook_probe — the Defensive Playbook engine (js/engine/defbook.js).
// Proves the book is a safe, lossless bundle of the defensive gameplan dials the
// sim already consumes: (1) validation gates every field against the live
// catalogs (DEF_FRONTS, AGGRESSION, PRESS_IDENTITY, coverage set); (2) apply
// writes exactly those gameplan fields, with blitzPct mirrored from the
// aggression stop; (3) apply→extract round-trips; (4) repair drops stale data.
import { emptyDefBook, validateDefBook, applyDefBookToGameplan, defBookFromGameplan, repairDefBook, DEF_COVERAGE_SCHEMES, COVERAGE_IDS, frontIds, aggressionStops, pressIdentities } from '../js/engine/defbook.js';
import { DEF_FRONTS, C } from '../js/constants.js';

let pass = 0, fail = 0; const bad = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; bad.push(msg); } }

// ── shape ────────────────────────────────────────────────────────────────────
const e = emptyDefBook('Base');
ok(validateDefBook(e).ok, 'empty defense is valid');
ok(COVERAGE_IDS.length === DEF_COVERAGE_SCHEMES.length && COVERAGE_IDS.includes('balanced'), 'coverage catalog exported');

// ── validation gates ─────────────────────────────────────────────────────────
ok(!validateDefBook({ ...e, baseFront: 'Nope' }).ok, 'unknown base front rejected');
ok(!validateDefBook({ ...e, aggression: 'nope' }).ok, 'unknown aggression rejected');
ok(!validateDefBook({ ...e, coverageScheme: 'nope' }).ok, 'unknown coverage rejected');
ok(!validateDefBook({ ...e, pressIdentity: 'nope' }).ok, 'unknown pressure identity rejected');
ok(!validateDefBook({ ...e, frontMix: { 'Nope': 40 } }).ok, 'unknown front in mix rejected');
ok(!validateDefBook({ ...e, frontMix: { '4-3': -3 } }).ok, 'negative front weight rejected');
ok(!validateDefBook({ ...e, greenDog: 'yes' }).ok, 'non-boolean greenDog rejected');

// every catalog value builds a valid book
let built = 0;
for (const f of frontIds()) for (const cov of COVERAGE_IDS) for (const ag of aggressionStops()) for (const pi of pressIdentities()) {
  const db = { ...emptyDefBook('T'), baseFront: f, frontMix: { [f]: 60 }, coverageScheme: cov, aggression: ag, pressIdentity: pi };
  if (!validateDefBook(db).ok) { ok(false, `catalog combo invalid: ${f}/${cov}/${ag}/${pi}`); break; }
  built++;
}
ok(true, `every catalog combo builds a valid book (${built} combos)`);

// ── apply writes the right gameplan fields + mirrors blitzPct ────────────────
const book = { ...emptyDefBook('Bring It'), baseFront: '3-4', frontMix: { '3-4': 60, 'Dime': 40 }, aggression: 'house', pressIdentity: 'theHouse', coverageScheme: 'aggressive', pressureSource: { edge: 45, interior: 35, secondary: 20 }, greenDog: true, spyQB: false };
const gp0 = { offFormations: [{ id: 'Spread', weight: 50 }], tendency: 'Balanced', targetShares: { WR1: 22 } };
const gp = applyDefBookToGameplan(book, gp0);
ok(gp.defBaseFront === '3-4', 'apply sets defBaseFront');
ok(gp.defAggression === 'house', 'apply sets defAggression');
ok(gp.blitzPct === C.AGGRESSION.rate.house, `apply mirrors blitzPct from the stop (${gp.blitzPct})`);
// The engine's field is pressureIdentity — the old assert agreed with the old
// code on the dead field gp.pressIdentity and both were wrong vs the sim
// (2026-08-15 separation audit). Prove the look lands where the sim reads it.
ok(gp.pressureIdentity === 'theHouse' && gp.pressIdentity === undefined && gp.coverageScheme === 'aggressive', 'apply sets identity (on the SIM\'s field) + coverage');
const effSit = (await import('../js/engine/situations.js')).getEffectivePlan(gp, null, 'base');
ok(effSit.pressureIdentity === 'theHouse', 'the custom pressure look actually reaches the effective plan the sim consumes');
ok(gp.greenDog === true && gp.spyQB === false, 'apply sets toggles');
ok(JSON.stringify(gp.defFrontMix) === JSON.stringify(book.frontMix), 'apply copies the front mix');
ok(gp.offFormations && gp.offFormations[0].id === 'Spread' && gp.tendency === 'Balanced', 'apply leaves the OFFENSE untouched');
ok(gp0.defBaseFront === undefined, 'apply does not mutate the input gameplan');

// ── round-trip: apply → extract yields an equivalent book ────────────────────
const back = defBookFromGameplan(gp, 'Bring It');
ok(back.baseFront === book.baseFront && back.aggression === book.aggression && back.coverageScheme === book.coverageScheme && back.pressIdentity === book.pressIdentity, 'round-trip preserves the core dials');
ok(JSON.stringify(back.frontMix) === JSON.stringify(book.frontMix) && back.greenDog === true, 'round-trip preserves mix + toggles');

// ── repair drops stale data ──────────────────────────────────────────────────
const r = repairDefBook({ name: 'Old', baseFront: 'GhostFront', frontMix: { '4-3': 50, 'GhostFront': 30 }, aggression: 'nope', coverageScheme: 'ancient', pressIdentity: 'gone', greenDog: true });
ok(r.ok, 'repaired book is valid');
ok(!('GhostFront' in r.db.frontMix) && r.db.frontMix['4-3'] === 50, 'repair drops the dead front, keeps the good one');
ok(DEF_FRONTS[r.db.baseFront], 'repair falls back to a real base front');
ok(r.db.greenDog === true, 'repair preserves a good toggle');
ok(r.changes.length >= 3, 'repair reports what it changed');

console.log(`DEFBOOK PROBE — ${pass} pass, ${fail} fail`);
if (fail) { console.log('  FAILURES:'); bad.slice(0, 20).forEach((m) => console.log('   -', m)); }
console.log(fail ? 'DEFBOOK PROBE FAIL' : 'DEFBOOK PROBE PASS');
process.exit(fail ? 1 : 0);
