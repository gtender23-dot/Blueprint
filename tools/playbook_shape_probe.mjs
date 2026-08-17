// playbook_shape_probe — Creativity Tools, the customPlaybook foundation.
// Proves the shape the Playbook Builder saves and loads: concept-legality
// validation (a formation can't run a play it doesn't carry), formation/variation
// existence, apply→extract round-trip, that applying a book never mutates the
// input gameplan, and that a built playbook actually drives a live sim through
// the fields the engine already consumes (offFormations + formationPlaybooks).
import { PLAYBOOK_SCHEMA_VERSION, legalConceptsForFormation, emptyPlaybook, validatePlaybook, applyPlaybookToGameplan, playbookFromGameplan } from '../js/engine/playbook.js';
import { FORMATION_PLAYBOOK } from '../js/constants.js';
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

let pass = 0, fail = 0;
const bad = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; bad.push(msg); } }

// ── legality helper ─────────────────────────────────────────────────────────
ok(legalConceptsForFormation('Spread').length > 0 && legalConceptsForFormation('Spread') === FORMATION_PLAYBOOK['Spread'], 'legalConceptsForFormation returns the formation list');
ok(legalConceptsForFormation('Nope').length === 0, 'unknown formation → empty legal list');

// ── validation: a clean book ────────────────────────────────────────────────
const spreadLegal = legalConceptsForFormation('Spread');
const good = {
  schemaVersion: PLAYBOOK_SCHEMA_VERSION, name: 'Air It Out',
  formations: [ { id: 'Spread', weight: 60 }, { id: 'Trips/Bunch', weight: 40, variation: 'closed' } ],
  sheets: { 'Spread': { [spreadLegal[0]]: 60, [spreadLegal[1]]: 30 } },
  tendency: 'Balanced'
};
let v = validatePlaybook(good);
ok(v.ok && v.errors.length === 0, `clean book validates (${v.errors[0] || 'ok'})`);

// ── validation: illegal concept for a formation is a hard error ─────────────
const illegalConcept = 'Wishbone Dive Option Nonexistent';
v = validatePlaybook({ name: 'x', formations: [{ id: 'Spread', weight: 50 }], sheets: { 'Spread': { [illegalConcept]: 50 } } });
ok(!v.ok && v.errors.some((e) => e.includes('cannot run')), 'illegal concept for formation rejected');
// a concept legal in ANOTHER formation but not this one
const jumboOnly = legalConceptsForFormation('Jumbo').find((c) => !new Set(spreadLegal).has(c));
if (jumboOnly) {
  v = validatePlaybook({ name: 'x', formations: [{ id: 'Spread', weight: 50 }], sheets: { 'Spread': { [jumboOnly]: 50 } } });
  ok(!v.ok, `concept "${jumboOnly}" legal in Jumbo is rejected for Spread`);
} else ok(true, 'no jumbo-only concept to test (skipped)');

// ── validation: unknown formation, unknown variation, bad tendency ──────────
ok(!validatePlaybook({ name: 'x', formations: [{ id: 'Nonexistent', weight: 50 }] }).ok, 'unknown formation rejected');
ok(!validatePlaybook({ name: 'x', formations: [{ id: 'Spread', weight: 50, variation: 'nope' }] }).ok, 'unknown variation rejected');
ok(!validatePlaybook({ name: 'x', formations: [{ id: 'Spread', weight: 50 }], tendency: 'Bogus' }).ok, 'unknown tendency rejected');
ok(!validatePlaybook({ name: 'x', formations: [{ id: 'Spread', weight: -5 }] }).ok, 'negative weight rejected');

// ── validation: warnings (not errors) ───────────────────────────────────────
v = validatePlaybook(emptyPlaybook('Empty'));
ok(v.ok && v.warnings.some((w) => w.includes('no formations')), 'empty book is valid-with-warning');
v = validatePlaybook({ name: 'x', formations: [{ id: 'Spread', weight: 50 }], sheets: { 'Power-I': { [legalConceptsForFormation('Power-I')[0]]: 40 } } });
ok(v.ok && v.warnings.some((w) => w.includes("doesn't carry")), 'sheet for a non-carried formation warns, does not error');

// ── apply → gameplan populates the right fields, preserves the rest ─────────
const baseGp = { defBaseFront: '3-4', tendency: 'Ground & Pound', targetShares: { WR1: 30 }, situations: { redzone: 1 }, offFormations: [{ id: 'Jumbo', weight: 99 }] };
const gp = applyPlaybookToGameplan(good, baseGp);
ok(gp.offFormations.length === 2 && gp.offFormations[0].id === 'Spread', 'apply set offFormations from the book');
ok(gp.offFormations[1].variation === 'closed', 'apply carried the formation variation');
ok(gp.formationPlaybooks && gp.formationPlaybooks['Spread'], 'apply set formationPlaybooks (the sim sheet)');
ok(gp.tendency === 'Balanced', 'apply overrode tendency from the book');
ok(gp.defBaseFront === '3-4' && gp.targetShares.WR1 === 30 && gp.situations.redzone === 1, 'apply preserved defense/target-shares/situations');
ok(JSON.stringify(baseGp.offFormations) === JSON.stringify([{ id: 'Jumbo', weight: 99 }]), 'apply did NOT mutate the input gameplan (clone)');
ok(!validatePlaybook({ name: 'x', formations: [{ id: 'Bad' }] }).ok && (() => { try { applyPlaybookToGameplan({ formations: [{ id: 'Bad' }] }, {}); return false; } catch (e) { return true; } })(), 'apply throws on an invalid book');

// ── round-trip: extract ∘ apply is stable ───────────────────────────────────
const rt = playbookFromGameplan(gp, 'Air It Out');
ok(rt.formations.length === 2 && rt.formations[0].id === 'Spread' && rt.formations[1].variation === 'closed', 'extract recovers formations+variation');
ok(JSON.stringify(rt.sheets) === JSON.stringify(good.sheets), 'extract recovers the sheets exactly');
ok(validatePlaybook(rt).ok, 'the extracted book re-validates');

// ── a built playbook drives a live sim through the existing engine fields ───
function gen(id) { const r = []; for (const [p, c] of Object.entries(ROSTER_TARGETS)) for (let i = 0; i < c; i++) { const x = createPlayer(p, CLASS_YEARS[i % 4], 1); x.schoolId = id; r.push(x); } return r; }
// restrict Spread to two pass concepts + carry Single Back for runs
const sbLegal = legalConceptsForFormation('Single Back');
const drivePb = {
  name: 'Drive Test',
  formations: [ { id: 'Spread', weight: 55 }, { id: 'Single Back', weight: 45 } ],
  sheets: {
    'Spread': { [spreadLegal.find((c) => c === 'Mesh') || spreadLegal[0]]: 80, [spreadLegal.find((c) => c === 'Four Verts') || spreadLegal[1]]: 40 },
    'Single Back': { [sbLegal.find((c) => c === 'Inside Zone') || sbLegal[0]]: 70 }
  },
  tendency: 'Balanced'
};
ok(validatePlaybook(drivePb).ok, 'drive-test book validates');
const runGp = applyPlaybookToGameplan(drivePb, {});
let plays = 0, threw = false;
try {
  for (let i = 0; i < 12; i++) {
    const rH = gen('H'), rA = gen('A');
    const res = simulateGame({ id: 'H', name: 'H' }, { id: 'A', name: 'A' }, rH, rA, buildDepthChart(rH, runGp), buildDepthChart(rA, runGp), runGp, runGp);
    for (const d of res.drives || []) plays += (d.plays || []).length;
  }
} catch (e) { threw = true; bad.push('sim threw: ' + e.message); }
ok(!threw, 'a custom playbook drives simulateGame without error');
ok(plays > 100, `plays happened under the custom book (${plays})`);

// ── M2 per-look sheet keys ("fid|variation") ride the same shape laws ───────
// (the deep coverage — inheritance, forking, repair, pkg truth — lives in
// tools/look_sheet_probe.mjs; this pins the SHAPE grammar where the shape
// lives)
{
  const spreadC = spreadLegal[0];
  const lookPb = {
    name: 'Look Keys',
    formations: [{ id: 'Spread', weight: 60 }, { id: 'Spread', weight: 40, variation: 'trips' }],
    sheets: { 'Spread': { [spreadC]: 60 }, 'Spread|trips': { [spreadC]: 90 } },
  };
  ok(validatePlaybook(lookPb).ok, 'M2: a per-look sheet key validates');
  ok(!validatePlaybook({ ...lookPb, sheets: { 'Spread|nope': { [spreadC]: 50 } } }).ok, 'M2: an unknown look key is an error');
  const lookGp = applyPlaybookToGameplan(lookPb, {});
  ok(lookGp.formationPlaybooks && !!lookGp.formationPlaybooks['Spread|trips'], 'M2: apply carries the look key into the sim sheet store');
  const lookRt = playbookFromGameplan(lookGp, 'Look Keys RT');
  ok(JSON.stringify(lookRt.sheets) === JSON.stringify(lookPb.sheets), 'M2: extract ∘ apply round-trips look keys exactly');
}

console.log(`PLAYBOOK SHAPE PROBE — ${pass} pass, ${fail} fail`);
if (fail) { console.log('  FAILURES:'); bad.forEach((m) => console.log('   -', m)); }
console.log(fail ? 'PLAYBOOK SHAPE PROBE FAIL' : 'PLAYBOOK SHAPE PROBE PASS');
process.exit(fail ? 1 : 0);
