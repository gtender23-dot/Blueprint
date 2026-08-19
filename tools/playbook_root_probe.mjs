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
  synthesizeTeamPlan, synthesizeLeaguePlans, assignBook, assignDefBook, setOverlay,
  adoptOffPlan, adoptDefPlan
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

// ── 10. D17 BATCH A — WRITER EQUIVALENCE ─────────────────────────────────────
// The gate for the writer-graph collapse: for every converted LOAD writer, the
// NEW path (adoptOffPlan / adoptDefPlan → the verbs) must produce the same flat
// gameplan as the OLD path (the hand-rolled wipe-and-Object.assign idiom every
// site used to carry), AND must leave the parts consistent instead of stale.
//
// `oldWriterIdiom` below is that retired idiom, reproduced verbatim so the
// comparison is against what actually shipped rather than against a paraphrase.
function oldWriterIdiom(school, merged) {
  for (const k of Object.keys(school.gameplan)) {
    if (!k.startsWith('_')) delete school.gameplan[k];
  }
  Object.assign(school.gameplan, merged);
  return school.gameplan;
}
// A school with parts attached and an AI-authored plan. NOTE: generateWorld()
// is UNSEEDED, so calling it twice gives two different worlds — the arms have
// to be CLONES of one school or the comparison is meaningless (this probe's
// first draft got that wrong and the "identical merges" guard below caught it).
// The verbs only touch name/gameplan/book/defbook/planOverlay, so a JSON clone
// of those is a faithful stand-in for the school.
function freshSchool(seedIdx) {
  const w = generateWorld();
  const s = w.schools[seedIdx % w.schools.length];
  setAIGameplan(s);
  synthesizeTeamPlan(s, { force: true });
  return s;
}
function twoArms(seedIdx) {
  const s = freshSchool(seedIdx);
  const snap = JSON.stringify({
    name: s.name, gameplan: s.gameplan, book: s.book, defbook: s.defbook, planOverlay: s.planOverlay
  });
  return [JSON.parse(snap), JSON.parse(snap)];
}
{
  const legal2 = legalConceptsForFormation('Trips/Bunch');
  const loadPb = emptyPlaybook('Batch A Offense');
  loadPb.formations = [{ id: 'Trips/Bunch', weight: 70 }, { id: 'Empty', weight: 30 }];
  loadPb.sheets = { 'Trips/Bunch': { [legal2[0]]: 55, [legal2[1]]: 45 } };
  loadPb.tendency = 'Heavy Pass';

  // OFFENSE load: old idiom vs adoptOffPlan.
  const [a, b] = twoArms(3);
  const mergedA = applyPlaybookToGameplan(loadPb, a.gameplan);
  const mergedB = applyPlaybookToGameplan(loadPb, b.gameplan);
  ok(sameGP(mergedA, mergedB), 'BATCH A: the two arms start from identical merges');
  // Snapshot the book BEFORE either arm loads, so "stale" can be stated exactly
  // as "unchanged" rather than "does not happen to equal the loaded book" — an
  // AI staff sometimes already runs the formation being loaded, and the looser
  // form of this pin failed on that coincidence roughly one run in three.
  const bookBefore = JSON.parse(JSON.stringify(a.book.plan.offFormations));
  const oldGp = JSON.parse(JSON.stringify(oldWriterIdiom(a, mergedA)));
  const newGp = JSON.parse(JSON.stringify(adoptOffPlan(b, mergedB)));
  ok(sameGP(oldGp, newGp), 'BATCH A: offense load — new path ≡ old wipe-and-assign path');
  ok(sameGP(newGp, mergedB), 'BATCH A: offense load — the compiled plan ≡ the merge it was given');
  // THE BUG THE BATCH EXISTS TO FIX: the old path left the book untouched.
  ok(sameGP(a.book.plan.offFormations, bookBefore),
    'BATCH A: the OLD path left school.book UNCHANGED by the load (the defect being retired)');
  ok(b.book.plan.offFormations[0].id === 'Trips/Bunch',
    'BATCH A: the NEW path re-points school.book at what was actually loaded');
  ok(sameGP(compileTeamPlan(b), b.gameplan), 'BATCH A: compile ≡ gameplan after an offense load');

  // DEFENSE load: old idiom vs adoptDefPlan. This is the arm that catches the
  // situations trap — a def book compiles its shelves into gameplan.situations,
  // which is a TEAM field in the OVERLAY, so assigning the defbook alone would
  // silently drop them.
  const loadDb = emptyDefBook('Batch A Defense');
  loadDb.baseFront = '3-4';
  loadDb.frontMix = { '3-4': 70, 'Dime': 30 };
  loadDb.aggression = 'attacking';
  const [c, d] = twoArms(4);
  const mergedC = applyDefBookToGameplan(loadDb, c.gameplan);
  const mergedD = applyDefBookToGameplan(loadDb, d.gameplan);
  const oldDefGp = JSON.parse(JSON.stringify(oldWriterIdiom(c, mergedC)));
  const newDefGp = JSON.parse(JSON.stringify(adoptDefPlan(d, mergedD)));
  ok(sameGP(oldDefGp, newDefGp), 'BATCH A: defense load — new path ≡ old wipe-and-assign path');
  ok(sameGP(newDefGp, mergedD), 'BATCH A: defense load — the compiled plan ≡ the merge it was given');
  ok(d.defbook.plan.defBaseFront === '3-4',
    'BATCH A: the NEW path re-points school.defbook at the loaded defense');
  ok(sameGP(d.gameplan.situations || {}, mergedD.situations || {}),
    'BATCH A: a def book\'s SHELF→situations survive the load (the overlay trap)');
  ok(sameGP(d.gameplan.offFormations, c.gameplan.offFormations),
    'BATCH A: the offense is untouched by a defense load');
  ok(sameGP(compileTeamPlan(d), d.gameplan), 'BATCH A: compile ≡ gameplan after a defense load');

  // Underscore markers (_bookStarter / _defbookStarter / _playbookName) must
  // survive — they are how "Edit playbook" re-opens the full starter book.
  const [e] = twoArms(5);
  e.gameplan._bookStarter = 'Air Raid';
  const mergedE = applyPlaybookToGameplan(loadPb, e.gameplan);
  adoptOffPlan(e, mergedE);
  ok(e.gameplan._bookStarter === 'Air Raid' && e.gameplan._playbookName === 'Batch A Offense',
    'BATCH A: the underscore book markers ride the overlay through a load');
}

console.log(`PLAYBOOK ROOT PROBE — ${pass} pass, ${fail} fail`);
if (fail) { console.log('  FAILURES:'); bad.forEach((m) => console.log('   -', m)); }
console.log(fail ? 'PLAYBOOK ROOT PROBE FAIL' : 'PLAYBOOK ROOT PROBE PASS');
process.exit(fail ? 1 : 0);
