// defbook_probe — the Defensive Playbook engine (js/engine/defbook.js).
// Proves the book is a safe, lossless bundle of the defensive gameplan dials the
// sim already consumes: (1) validation gates every field against the live
// catalogs (DEF_FRONTS, AGGRESSION, PRESS_IDENTITY, coverage set); (2) apply
// writes exactly those gameplan fields, with blitzPct mirrored from the
// aggression stop; (3) apply→extract round-trips; (4) repair drops stale data.
//
// v2 (2026-08-17, the standing DEFBOOK V2 probe debt from 2026-08-15): shelves +
// answers. (5) validation gates every shelf/card/answer field; (6) shelf cards
// compile to the headset defCalls library (≤12, shelf order, name dedupe);
// (7) the top-weighted card of a shelf writes that shelf's situation cells with
// DEF FIELDS ONLY, preserving a cell's offensive keys; (8) answers compile to
// formChecks; (9) a v1 book repairs into v2 losslessly (empty shelves, zero
// changes); (10) every starter book round-trips (repair is byte-stable on
// shelves+answers; apply→extract preserves the identity spine).
import { emptyDefBook, emptyDefCard, validateDefBook, applyDefBookToGameplan, defBookFromGameplan, repairDefBook, cardToDefCall, cardToCell, cardToFormCheck, bookCards, DEF_COVERAGE_SCHEMES, COVERAGE_IDS, DEF_SHELVES, DEF_SHELF_CARD_CAP, DEF_CALL_COVERAGES, DEF_CALL_BRING, frontIds, aggressionStops, pressIdentities } from '../js/engine/defbook.js';
import { DEFAULT_DEF_BOOKS } from '../js/engine/defaultbooks.js';
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

// ═══ v2: shelves + answers (the 2026-08-15 probe debt, paid 2026-08-17) ══════
const card = (name, over = {}) => ({ ...emptyDefCard(name), ...over });

// ── (5) validation gates ─────────────────────────────────────────────────────
ok(!validateDefBook({ ...e, shelves: { nope: [] } }).ok, 'unknown shelf rejected');
ok(!validateDefBook({ ...e, shelves: { base: 'x' } }).ok, 'non-array shelf rejected');
ok(!validateDefBook({ ...e, shelves: { base: [card('A'), card('B'), card('C')] } }).ok, `over-cap shelf rejected (cap ${DEF_SHELF_CARD_CAP})`);
ok(!validateDefBook({ ...e, shelves: { base: [null] } }).ok, 'malformed call rejected');
ok(!validateDefBook({ ...e, shelves: { base: [card('A', { front: 'GhostFront' })] } }).ok, 'unknown card front rejected');
ok(!validateDefBook({ ...e, shelves: { base: [card('A', { coverage: 'c9' })] } }).ok, 'unknown card coverage rejected');
ok(!validateDefBook({ ...e, shelves: { base: [card('A', { bring: '9' })] } }).ok, 'unknown pressure count rejected');
ok(!validateDefBook({ ...e, shelves: { base: [card('A', { look: 'ghost' })] } }).ok, 'unknown pressure look rejected');
ok(!validateDefBook({ ...e, shelves: { base: [card('A', { weight: -1 })] } }).ok, 'negative card weight rejected');
ok(!validateDefBook({ ...e, answers: { alien: 'A' } }).ok, 'unknown personnel class rejected');
const vWarn = validateDefBook({ ...e, shelves: { base: [card('A')] }, answers: { heavy: 'Missing' } });
ok(vWarn.ok && vWarn.warnings.some((w) => w.includes('Missing')), 'answer naming an off-shelf call warns, does not error');

// ── (6) shelf → defCalls: shelf order, name dedupe, the 12-call cap ─────────
ok(DEF_SHELVES.length * DEF_SHELF_CARD_CAP <= 12, 'shelf capacity can never exceed the 12-call headset library');
const shelves10 = {}; let _ci = 0;
for (const sh of DEF_SHELVES) shelves10[sh.key] = [card(`Call${_ci++}`, { coverage: 'c3' }), card(`Call${_ci++}`, { coverage: 'c1', bring: '5' })];
const fullBook = { ...emptyDefBook('Full'), shelves: shelves10 };
ok(validateDefBook(fullBook).ok, 'a full 10-call book is valid');
const gpF = applyDefBookToGameplan(fullBook, {});
ok(gpF.defCalls && Object.keys(gpF.defCalls).length === 10, `full book compiles every named call (${Object.keys(gpF.defCalls || {}).length}/10)`);
ok(JSON.stringify(gpF.defCalls.Call0) === JSON.stringify(cardToDefCall(shelves10.base[0])), 'a compiled call === cardToDefCall of its card');
const gpD = applyDefBookToGameplan({ ...emptyDefBook('Dup'), shelves: { base: [card('Same', { coverage: 'c2' })], passing: [card('Same', { coverage: 'c1' })] } }, {});
ok(Object.keys(gpD.defCalls).length === 1 && gpD.defCalls.Same.covStyle === 'zone', 'duplicate names dedupe — the first (shelf-order) card wins');

// ── (7) shelf → cells: DEF FIELDS ONLY, offensive keys preserved ────────────
const DEF_CELL_KEYS = new Set(['defFront', 'defAggression', 'pressureIdentity', 'covShell', 'covStyle', 'runCommit', 'edgePlay', 'robberCall', 'zoneStyle', 'pressLevel']);
const cellBook = { ...emptyDefBook('Cells'), shelves: { passing: [card('Light', { coverage: 'c3', weight: 30 }), card('Heavy', { front: 'Dime', coverage: 'tampa2', bring: '3', weight: 70 })] } };
const gpC = applyDefBookToGameplan(cellBook, { situations: { third_long: { passDepth: { short: 20, medium: 40, deep: 40 }, conceptWeights: { Mesh: 60 } } } });
const _cell = gpC.situations.third_long;
ok(_cell.passDepth && _cell.passDepth.deep === 40 && _cell.conceptWeights && _cell.conceptWeights.Mesh === 60, 'a cell\'s OFFENSIVE keys survive the shelf write');
ok(_cell.defFront === 'Dime' && _cell.covShell === 'two' && _cell.covStyle === 'zone', 'the TOP-WEIGHTED card writes the cells (family translated to shell/style)');
{
  const _shelf = DEF_SHELVES.find((s) => s.key === 'passing');
  ok(_shelf.cells.every((ck) => gpC.situations[ck] && gpC.situations[ck].defFront === 'Dime'), 'every cell of the shelf is written');
}
let _leak = 0;
for (const cov of DEF_CALL_COVERAGES) for (const br of Object.keys(DEF_CALL_BRING)) {
  const patch = cardToCell(card('X', { coverage: cov.id, bring: br, front: '4-3', look: 'fireZone', runCommit: 10, edgePlay: 'contain' }));
  for (const k of Object.keys(patch)) if (!DEF_CELL_KEYS.has(k)) { _leak++; bad.push(`cardToCell leaks non-def key "${k}" (${cov.id}/${br})`); }
}
ok(_leak === 0, `cardToCell writes DEF fields only across the coverage×bring grid (${DEF_CALL_COVERAGES.length * Object.keys(DEF_CALL_BRING).length} cards)`);
const gpG = applyDefBookToGameplan({ ...emptyDefBook('G'), shelves: { gamble: [card('Zero', { coverage: 'c1', bring: '6' })] } }, {});
ok(!gpG.situations || Object.keys(gpG.situations).length === 0, 'the Gamble shelf (headset-only, no cells) writes no situation cells');

// ── (8) answers → formChecks ────────────────────────────────────────────────
const ansBook = { ...emptyDefBook('Ans'), shelves: { base: [card('Stack', { front: '46/Bear', coverage: 'c1', bring: '5', look: 'secondLevel', runCommit: 12 })] }, answers: { heavy: 'Stack', empty: 'Missing' } };
const gpA = applyDefBookToGameplan(ansBook, {});
ok(gpA.formChecks && JSON.stringify(gpA.formChecks.heavy) === JSON.stringify(cardToFormCheck(ansBook.shelves.base[0])), 'an answer compiles to cardToFormCheck of its card');
ok(gpA.formChecks && !gpA.formChecks.empty, 'an answer naming a missing call is skipped');
ok(gpA.formChecks.heavy.defFront === '46/Bear' && gpA.formChecks.heavy.runCommit === 12 && gpA.formChecks.heavy.covShell === 'single' && gpA.formChecks.heavy.covStyle === 'man', 'the formCheck carries front + box + coverage');

// ── (9) v1 → v2 repair, lossless ────────────────────────────────────────────
const v1 = { name: 'Old Faithful', baseFront: '3-4', frontMix: { '3-4': 70, 'Nickel': 30 }, aggression: 'attacking', pressIdentity: 'fireZone', pressureSource: { edge: 60, interior: 20, secondary: 20 }, coverageScheme: 'aggressive', greenDog: true, spyQB: false };
const r1 = repairDefBook(v1);
ok(r1.ok && r1.changes.length === 0, `a v1 book repairs into v2 losslessly (${r1.changes.length} changes)`);
ok(r1.db.baseFront === '3-4' && r1.db.aggression === 'attacking' && r1.db.greenDog === true && JSON.stringify(r1.db.frontMix) === JSON.stringify(v1.frontMix), 'the v1 identity spine is preserved');
ok(r1.db.shelves && Object.keys(r1.db.shelves).length === 0 && r1.db.answers && Object.keys(r1.db.answers).length === 0, 'v1 gains EMPTY shelves+answers (no invented data)');
const broken = { ...emptyDefBook('Br'), shelves: { base: [card('Live', { front: '4-3' }), card('Dead', { front: 'GhostFront', coverage: 'c9', bring: '9', look: 'ghost' })] }, answers: { heavy: 'Live', empty: 'Gone' } };
const r2 = repairDefBook(broken);
ok(r2.ok, 'a v2 book with dead card data repairs valid');
const deadFix = (r2.db.shelves.base || []).find((c2) => c2.name === 'Dead');
ok(deadFix && deadFix.front === null && deadFix.coverage === 'base' && deadFix.bring === '4' && deadFix.look === null, 'dead card fields reset — the CALL itself survives');
ok(r2.db.answers.heavy === 'Live' && !r2.db.answers.empty, 'answers: surviving call kept, dead reference dropped');
ok(r2.changes.length >= 3, 'v2 repair reports its changes');

// ── (10) starter-book round-trip ────────────────────────────────────────────
for (const sb of DEFAULT_DEF_BOOKS) {
  const rr = repairDefBook(sb);
  ok(rr.ok && rr.changes.length === 0, `starter "${sb.name}": zero-change repair`);
  ok(JSON.stringify(rr.db.shelves) === JSON.stringify(sb.shelves) && JSON.stringify(rr.db.answers) === JSON.stringify(sb.answers), `starter "${sb.name}": shelves+answers byte-stable through repair`);
  const g = applyDefBookToGameplan(sb, {});
  const ext = defBookFromGameplan(g, sb.name);
  ok(ext.baseFront === sb.baseFront && ext.aggression === sb.aggression && ext.coverageScheme === sb.coverageScheme && ext.pressIdentity === sb.pressIdentity && JSON.stringify(ext.frontMix) === JSON.stringify(sb.frontMix), `starter "${sb.name}": apply→extract round-trips the identity spine`);
}

console.log(`DEFBOOK PROBE — ${pass} pass, ${fail} fail`);
if (fail) { console.log('  FAILURES:'); bad.slice(0, 20).forEach((m) => console.log('   -', m)); }
console.log(fail ? 'DEFBOOK PROBE FAIL' : 'DEFBOOK PROBE PASS');
process.exit(fail ? 1 : 0);
