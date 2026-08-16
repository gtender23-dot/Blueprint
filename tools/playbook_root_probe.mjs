// playbook_root_probe — Stage 1 of the Playbook-Root refactor.
// (Ref/PLAYBOOK_ROOT_ARCHITECTURE.md.) Proves the new named object model + the
// single compile seam are BEHAVIOUR-NEUTRAL: for every writer's output, splitting
// a gameplan into { book, defbook, overlay } and compiling it back reproduces the
// gameplan the sim reads today, field-for-field (order-independent byte-identity).
// This is the node-level equivalence proof for the stage's "the first compile is
// byte-identical to today" law. It is the strongest field-level check runnable
// without a browser; the DOM-level _equiv_walk is the end-to-end final stamp.
import {
  PLAN_FIELD_SIDE, splitTeamPlan, compilePlanParts, compileTeamPlan,
  synthesizeTeamPlan, synthesizeLeaguePlans, assignBook, assignDefBook, setOverlay
} from '../js/engine/teamplan.js';
import { generateWorld, defaultGameplan } from '../js/engine/world.js';
import { setAIGameplan } from '../js/engine/ai.js';
import { emptyPlaybook, applyPlaybookToGameplan, legalConceptsForFormation } from '../js/engine/playbook.js';
import { emptyDefBook, applyDefBookToGameplan } from '../js/engine/defbook.js';

let pass = 0, fail = 0;
const bad = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; bad.push(msg); } }

// order-independent canonical form: sort object keys recursively, then stringify.
function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  }
  return JSON.stringify(v === undefined ? null : v);
}
function sameGP(a, b) { return stable(a) === stable(b); }

// round-trip a raw gameplan through split → compile and assert byte-identity.
function roundTrips(gp, label) {
  const { book, defbook, overlay } = splitTeamPlan(gp, { schoolName: 'Test' });
  const back = compilePlanParts(book, defbook, overlay);
  ok(sameGP(gp, back), `split∘compile is byte-identical: ${label}`);
  return { book, defbook, overlay, back };
}

// ── 1. the default gameplan round-trips ──────────────────────────────────────
roundTrips(defaultGameplan(), 'defaultGameplan()');

// ── 2. a sparse plan (absent fields stay absent) ─────────────────────────────
roundTrips({ offFormations: [{ id: 'Spread', weight: 50 }], defBaseFront: '3-4', fourthDown: 'Moderate' }, 'sparse plan');

// ── 3. every AI-authored gameplan in a real world round-trips ────────────────
const world = generateWorld();
let aiChecked = 0, aiBad = 0;
for (const s of world.schools) {
  setAIGameplan(s);
  const before = JSON.parse(JSON.stringify(s.gameplan));
  const { book, defbook, overlay } = splitTeamPlan(s.gameplan, { schoolName: s.name });
  const back = compilePlanParts(book, defbook, overlay);
  if (!sameGP(before, back)) { aiBad++; if (aiBad <= 3) bad.push(`AI plan mismatch: ${s.name}`); }
  aiChecked++;
}
ok(aiChecked > 20, `exercised a full world of AI plans (${aiChecked} schools)`);
ok(aiBad === 0, `every AI plan is byte-identical through the seam (${aiBad} mismatches / ${aiChecked})`);

// ── 4. the pb: and dd: load writers round-trip ───────────────────────────────
const legal = legalConceptsForFormation('Spread');
const pb = emptyPlaybook('Load Test');
pb.formations = [{ id: 'Spread', weight: 60 }, { id: 'Single Back', weight: 40 }];
pb.sheets = { 'Spread': { [legal[0]]: 60, [legal[1]]: 40 } };
roundTrips(applyPlaybookToGameplan(pb, defaultGameplan()), 'pb: load writer');
roundTrips(applyDefBookToGameplan(emptyDefBook('D'), defaultGameplan()), 'dd: load writer');

// ── 5. synthesizeTeamPlan attaches the parts; compile ≡ gameplan ─────────────
const sc = world.schools[0];
setAIGameplan(sc);
const gpBefore = JSON.parse(JSON.stringify(sc.gameplan));
synthesizeTeamPlan(sc, { force: true });
ok(sc.book && sc.defbook && sc.planOverlay, 'synthesizeTeamPlan attached book/defbook/overlay');
ok(typeof sc.book.name === 'string' && sc.book.name.length > 0, 'the offensive book carries a name');
ok(typeof sc.defbook.name === 'string' && sc.defbook.name.length > 0, 'the defensive book carries a name');
ok(sameGP(compileTeamPlan(sc), gpBefore), 'compileTeamPlan(school) ≡ the pre-synthesis gameplan');
ok(sameGP(sc.gameplan, gpBefore), 'synthesis left the school gameplan object unchanged');

// ── 6. compile determinism ───────────────────────────────────────────────────
ok(sameGP(compileTeamPlan(sc), compileTeamPlan(sc)), 'compileTeamPlan is deterministic');

// ── 7. the two verbs (assignBook / setOverlay) round-trip the plan ───────────
const v1 = world.schools[1];
setAIGameplan(v1);
const v1Before = JSON.parse(JSON.stringify(v1.gameplan));
synthesizeTeamPlan(v1, { force: true });
ok(sameGP(setOverlay(v1, {}), v1Before), 'setOverlay({}) recompiles to the same plan');
ok(sameGP(assignBook(v1, v1.book), v1Before), 'assignBook(current) recompiles to the same plan');
ok(sameGP(assignDefBook(v1, v1.defbook), v1Before), 'assignDefBook(current) recompiles to the same plan');

// ── 8. synthesizeLeaguePlans covers a whole world, idempotently ──────────────
const w2 = generateWorld();
for (const s of w2.schools) setAIGameplan(s);
const nSynthed = synthesizeLeaguePlans(w2);
ok(nSynthed === w2.schools.length, `synthesizeLeaguePlans touched every school (${nSynthed})`);
ok(w2.schools.every((s) => s.book && s.defbook), 'every school in the world now carries books');
const w2names = w2.schools.map((s) => s.book.name);
synthesizeLeaguePlans(w2); // idempotent — no re-synthesis without force
ok(w2.schools.every((s, i) => s.book.name === w2names[i]), 'a second synthesize pass is a no-op (idempotent)');

// ── 9. Stage 3: the Game Plan controls the book (a load re-syncs the model) ──
// Mirror the Game Plan load path (applyPlaybookToGameplan → wipe → assign →
// synthesize): loading a DIFFERENT offense must re-point the book, preserve the
// overlay (situations + team knobs) and the defense, and keep compile ≡ gameplan.
const gpSchool = world.schools[2];
setAIGameplan(gpSchool);
synthesizeTeamPlan(gpSchool, { force: true });
const keepSituations = JSON.parse(JSON.stringify(gpSchool.gameplan.situations || {}));
const keepFourthDown = gpSchool.gameplan.fourthDown;
const keepDefFront = gpSchool.gameplan.defBaseFront;
const newPb = emptyPlaybook('Air Raid Test');
newPb.formations = [{ id: 'Air Raid', weight: 70 }, { id: 'Empty', weight: 30 }];
const air = legalConceptsForFormation('Air Raid');
newPb.sheets = { 'Air Raid': { [air[0]]: 70 } };
const mergedGp = applyPlaybookToGameplan(newPb, gpSchool.gameplan);
for (const k of Object.keys(gpSchool.gameplan)) { if (!k.startsWith('_')) delete gpSchool.gameplan[k]; }
Object.assign(gpSchool.gameplan, mergedGp);
synthesizeTeamPlan(gpSchool, { force: true });
ok(gpSchool.book.name === 'Air Raid Test', `the book re-synced to the loaded plan (${gpSchool.book.name})`);
ok(gpSchool.book.plan.offFormations && gpSchool.book.plan.offFormations[0].id === 'Air Raid', 'the re-synced book carries the loaded formations');
ok(sameGP(gpSchool.gameplan.situations || {}, keepSituations), 'situations overlay preserved through the load');
ok(gpSchool.gameplan.fourthDown === keepFourthDown, 'team-level 4th-down preserved through the load');
ok(gpSchool.gameplan.defBaseFront === keepDefFront, 'defense untouched by an offense load');
ok(sameGP(compileTeamPlan(gpSchool), gpSchool.gameplan), 'compileTeamPlan ≡ gameplan after a controller load');

console.log(`PLAYBOOK ROOT PROBE — ${pass} pass, ${fail} fail`);
if (fail) { console.log('  FAILURES:'); bad.forEach((m) => console.log('   -', m)); }
console.log(fail ? 'PLAYBOOK ROOT PROBE FAIL' : 'PLAYBOOK ROOT PROBE PASS');
process.exit(fail ? 1 : 0);
