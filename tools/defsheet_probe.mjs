// defsheet_probe — the STARTER LIBRARY + the bring-3 sim law (M5 close-out,
// 2026-08-17; the second half of the 2026-08-15 DEFBOOK V2 probe debt).
//
// A. THE STARTER LIBRARY IS SOUND.
//    Every DEFAULT_DEF_BOOK: validates clean (no errors, no warnings), carries
//    ≥1 base-shelf card, compiles through applyDefBookToGameplan (every named
//    call reaches the headset library, every carded shelf writes its cells,
//    every answer compiles to a formCheck) — and every card's compiled call
//    speaks ONLY applyDefCall's vocabulary. The vocabulary is PINNED here on
//    purpose (applyDefCall + pickDefCall's normalizer, sim.js): if the sim
//    grows or loses a key, update the pin WITH it — this probe exists to catch
//    a card authored against a field the sim doesn't read (the "pressure look
//    written to a dead field" class of bug, found 2026-08-15). Note the pin is
//    pickDefCall's NORMALIZED list: a key applyDefCall reads but the sheet-
//    sample path strips (or vice versa) fails here too.
//    Every DEFAULT_OFF_BOOK: validates, every formation/look exists with a
//    positive weight, every carried formation has a non-empty sheet, and every
//    sheet entry is legal for its formation.
//
// B. THE BRING-3 AUDIT (#33 sim half, dispatch D9 item 1).
//    The call card draws bring 3 on a 4-man front as a fire-zone exchange —
//    three arrows, one lineman bending back into coverage (card_lint C5 pins
//    the drawing). This half proves the SIM runs the same exchange: a forced
//    bring-3 defCall on a 4-3 (no native drop slots — DEF_DROP_ELIGIBLE['4-3']
//    is empty, so all four rushers are genuine down linemen) cuts the rush to
//    its best THREE, never fires a blitz on top, and the cut man — a DL body —
//    is recorded in rush3DroppedIds, the same ids grafted into the coverage
//    personnel (_covExtra, sim.js). Driven through the REAL sim via the
//    bench's forced-defCall seam — the exact applyDefCall path the headset
//    uses. Contrast arms: bring 4 never sets rush3 and shows four on no-blitz
//    snaps; the Prevent picture BUNDLES rush 3 (owner call 2026-08-08); a 3-4
//    bring 3 also lands on exactly three. Deterministic: every rep runs under
//    a pinned bench seed.
import { DEFAULT_DEF_BOOKS, DEFAULT_OFF_BOOKS } from '../js/engine/defaultbooks.js';
import { validateDefBook, applyDefBookToGameplan, cardToDefCall, bookCards, DEF_SHELVES } from '../js/engine/defbook.js';
import { validatePlaybook, legalConceptsForFormation, splitSheetKey, lookSheetKey } from '../js/engine/playbook.js';
import { benchSnap, benchTeams } from '../js/engine/bench.js';
import { DEF_FRONTS, C, FORMATION_PACKAGES, FORMATION_VARIATIONS } from '../js/constants.js';

let pass = 0, fail = 0; const bad = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; bad.push(msg); } }

// ═══ A. the starter library ══════════════════════════════════════════════════
ok(DEFAULT_DEF_BOOKS.length === 6, `six defensive starters survive load-time validation (${DEFAULT_DEF_BOOKS.length})`);
ok(DEFAULT_OFF_BOOKS.length === 6, `six offensive starters survive load-time validation (${DEFAULT_OFF_BOOKS.length})`);

// applyDefCall's vocabulary (see the header). Keys = pickDefCall's normalized
// list ∩ applyDefCall's reads — the set a compiled call can actually land on
// the sim through EITHER path (F1 forced call or the sheet sample).
// ⚠ HAND-MAINTAINED MIRROR of applyDefCall's vocabulary. Adding a compiled
// field to the call seam without adding it here reds this probe — which is
// exactly what happened on 2026-08-19 when `bring` started compiling to
// `bringSeats` (pressure batch 2) and this list still knew only `aggression`.
// The probe did its job; the list is the thing that drifts.
const APPLY_KEYS = new Set(['front', 'covShell', 'covStyle', 'edgePlay', 'pressureIdentity', 'robberCall', 'zoneStyle', 'aggression', 'runCommit', 'covFamily', 'rotation', 'rush3', 'pressLook', 'dogGame', 'bringSeats']);
const COV_FAMILIES = new Set(['Cover 6', 'Tampa 2', 'Cover 2-Man', 'Prevent']); // COV_FAMILY_IMPLIES, sim.js
const legalVal = {
  front: (v) => !!DEF_FRONTS[v],
  covShell: (v) => v === 'single' || v === 'two',
  covStyle: (v) => v === 'man' || v === 'zone',
  edgePlay: (v) => ['contain', 'crash', 'balanced'].includes(v),
  pressureIdentity: (v) => !!C.PRESS_IDENTITY[v],
  aggression: (v) => C.AGGRESSION.order.includes(v),
  // EXTRA rushers beyond the four-man front: bring 4/5/6 -> 0/1/2. Zero is a
  // legal, meaningful value (a four-man rush that cannot blitz), so this must
  // be an integer test, not a truthiness one.
  bringSeats: (v) => Number.isInteger(v) && v >= 0 && v <= 3,
  covFamily: (v) => COV_FAMILIES.has(v),
  rush3: (v) => v === true,
  runCommit: (v) => typeof v === 'number' && v >= -25 && v <= 25,
  robberCall: () => true, zoneStyle: () => true, rotation: () => true,
  pressLook: (v) => v === 'mug' || v === 'amoeba',
  dogGame: (v) => v === 'green' || v === 'cross'
};

let vocabBad = 0, cardsWalked = 0, bring3Cards = 0;
for (const b of DEFAULT_DEF_BOOKS) {
  const v = validateDefBook(b);
  ok(v.ok, `"${b.name}": validates (${v.errors[0] || ''})`);
  ok(v.warnings.length === 0, `"${b.name}": no warnings (${v.warnings[0] || ''})`);
  ok((b.shelves.base || []).length >= 1, `"${b.name}": carries a base-shelf card`);
  const gp = applyDefBookToGameplan(b, {});
  const names = new Set(bookCards(b).map((e2) => e2.card.name));
  ok(gp.defCalls && Object.keys(gp.defCalls).length === names.size, `"${b.name}": every named call reaches the headset library (${Object.keys(gp.defCalls || {}).length}/${names.size})`);
  for (const sh of DEF_SHELVES) {
    const cards = b.shelves[sh.key] || [];
    if (!cards.length || !sh.cells.length) continue;
    ok(sh.cells.every((ck) => gp.situations[ck] && Object.keys(gp.situations[ck]).length > 0), `"${b.name}": shelf "${sh.key}" wrote all its cells`);
  }
  for (const cls of Object.keys(b.answers || {})) ok(gp.formChecks && !!gp.formChecks[cls], `"${b.name}": answer "${cls}" compiled to a formCheck`);
  for (const { card } of bookCards(b)) {
    cardsWalked++;
    const call = cardToDefCall(card);
    for (const [k, val] of Object.entries(call)) {
      if (!APPLY_KEYS.has(k)) { vocabBad++; bad.push(`"${b.name}"/"${card.name}": key "${k}" outside applyDefCall's vocabulary`); continue; }
      if (!legalVal[k](val)) { vocabBad++; bad.push(`"${b.name}"/"${card.name}": illegal ${k}="${val}"`); }
    }
    if (card.bring === '3' && call.rush3 !== true) { vocabBad++; bad.push(`"${b.name}"/"${card.name}": bring 3 did not compile rush3`); }
    if (card.bring === '3') bring3Cards++;
  }
}
ok(vocabBad === 0, `every starter card resolves through applyDefCall's vocabulary (${cardsWalked} cards walked)`);
ok(bring3Cards >= 3, `the library genuinely exercises bring 3 (${bring3Cards} cards)`);

let offBad = 0;
for (const b of DEFAULT_OFF_BOOKS) {
  const v = validatePlaybook(b);
  ok(v.ok, `"${b.name}": validates (${v.errors[0] || ''})`);
  for (const f of b.formations) {
    if (!FORMATION_PACKAGES[f.id]) { offBad++; bad.push(`"${b.name}": unknown formation "${f.id}"`); }
    if (f.variation && !(FORMATION_VARIATIONS[f.id] && FORMATION_VARIATIONS[f.id][f.variation])) { offBad++; bad.push(`"${b.name}": unknown look "${f.id}/${f.variation}"`); }
    if (!(typeof f.weight === 'number' && f.weight > 0)) { offBad++; bad.push(`"${b.name}": "${f.id}" carries no weight`); }
  }
  // 2026-08-18: books are all-legal PER LOOK, so a look's sheet is keyed by its
  // OWN look key ("fid" or "fid|variation"), not always the base fid. Check that
  // every carried look has a non-empty sheet under its own key.
  for (const f of b.formations) {
    const lk = lookSheetKey(f.id, f.variation || null);
    if (!(b.sheets[lk] && Object.keys(b.sheets[lk]).length > 0)) { offBad++; bad.push(`"${b.name}": carried look "${lk}" has no sheet`); }
  }
  for (const [key, sh] of Object.entries(b.sheets)) {
    const { id: baseFid } = splitSheetKey(key);
    const legal = new Set(legalConceptsForFormation(baseFid));
    for (const [cName, w] of Object.entries(sh)) {
      if (!legal.has(cName)) { offBad++; bad.push(`"${b.name}": ${key} sheet holds illegal "${cName}"`); }
      if (!(typeof w === 'number' && w > 0)) { offBad++; bad.push(`"${b.name}": ${key}/"${cName}" weight bad`); }
    }
  }
}
ok(offBad === 0, 'every offensive starter: formations/looks exist, weights positive, every carried formation sheeted, every sheet entry legal');

// ═══ B. the bring-3 audit — the sim runs the exchange the card draws ═════════
const DL_POS = new Set(['DE', 'DT', 'NT']);
const defById = {};
for (const p of benchTeams().def) defById[p.id] = p;
const snapArm = (defLook, seedBase, want, maxSeeds = 80) => {
  const seen = [];
  for (let s = 1; s <= maxSeeds && seen.length < want; s++) {
    const r = benchSnap({ formationId: 'Spread', concept: 'Mesh', defLook, seed: (seedBase + s) >>> 0 });
    const p = r.play;
    if (!p || p.rushN == null) continue; // pre-snap flag — an honest outcome, skip
    seen.push(p);
  }
  return seen;
};

// bring 3 on the 4-3: every rusher shown is a DOWN LINEMAN; the cut man must be one.
const arm3 = snapArm({ front: '4-3', coverage: 'c3', bring: '3' }, 0xD9A000, 25);
let a3bad = 0;
for (const p of arm3) {
  if (p.rush3 !== true) { a3bad++; bad.push('bring-3 snap not flagged rush3'); }
  if (p.rushN !== 3) { a3bad++; bad.push(`bring 3 on a 4-man front rushed ${p.rushN}`); }
  if (p.blitzFired) { a3bad++; bad.push('a blitz fired over a rush-3 call'); }
  const dropped = p.rush3DroppedIds || [];
  if (dropped.length !== 1) { a3bad++; bad.push(`expected exactly 1 dropped lineman on the 4-3, got ${dropped.length}`); }
  for (const id of dropped) {
    const body = defById[id];
    if (!body || !DL_POS.has(body.position)) { a3bad++; bad.push(`dropped body ${id} (${body ? body.position : '?'}) is not a lineman`); }
  }
}
ok(arm3.length >= 20, `bring-3 vs the 4-3: ${arm3.length} real pass snaps measured`);
ok(a3bad === 0, 'EVERY bring-3 snap cut the front to its best three, fired no blitz, and dropped a genuine LINEMAN into coverage — the exchange the card draws');

// contrast: bring 4 never rushes three, never records a rush-3 drop.
const arm4 = snapArm({ front: '4-3', coverage: 'c3', bring: '4' }, 0xE4B000, 15);
let a4bad = 0;
for (const p of arm4) {
  if (p.rush3) { a4bad++; bad.push('bring-4 snap flagged rush3'); }
  if (p.rush3DroppedIds) { a4bad++; bad.push('bring-4 snap carries rush3DroppedIds'); }
  if (!p.blitzFired && p.rushN !== 4) { a4bad++; bad.push(`bring-4 no-blitz snap rushed ${p.rushN} (want the shown four)`); }
}
ok(arm4.length >= 10, `bring-4 contrast: ${arm4.length} snaps measured`);
ok(a4bad === 0, 'bring 4 never cuts to three and never records a rush-3 drop');

// the Prevent picture bundles rush 3 (one ingredient, the whole posture).
const armP = snapArm({ front: '4-3', coverage: 'prevent', bring: '4' }, 0xF7C000, 10);
let apBad = 0;
for (const p of armP) if (p.rushN !== 3 || p.rush3 !== true) { apBad++; bad.push(`Prevent snap rushed ${p.rushN} (rush3=${p.rush3})`); }
ok(armP.length >= 8 && apBad === 0, `the Prevent picture bundles rush 3 (${armP.length} snaps, all cut to three)`);

// bring 3 holds on a 3-man front too (3-4: OLBs share the rush ledger and may
// drop natively — the call still lands on exactly three, flagged rush3).
const arm34 = snapArm({ front: '3-4', coverage: 'c3', bring: '3' }, 0xA34000, 10);
let a34bad = 0;
for (const p of arm34) if (p.rushN !== 3 || p.rush3 !== true) { a34bad++; bad.push(`3-4 bring-3 snap rushed ${p.rushN} (rush3=${p.rush3})`); }
ok(arm34.length >= 8 && a34bad === 0, `bring 3 on the 3-4 lands on exactly three (${arm34.length} snaps)`);

// ═══ C. BOOK LOAD LEAVES NO DEAD CALLSHEET ROW (D12 / OD-11, 2026-08-18) ═════
// Loading a defensive book replaces gp.defCalls; before D12 the old callSheet
// rode through the copy naming calls the new library doesn't hold, and
// pickDefCall's dead-entry filter made the matchup sheet silently stop firing.
// applyDefBookToGameplan now prunes the sheet against the NEW library:
// surviving names keep their exact weights, dead entries drop, and a row whose
// calls all died is DELETED (renders as an empty cell — inherits the standing
// plan), never lingers. pruneCallSheet is also exported for heal-on-load.
{
  const { pruneCallSheet } = await import('../js/engine/defbook.js');
  const bk = DEFAULT_DEF_BOOKS[0];
  const newNames = new Set(Object.keys(applyDefBookToGameplan(bk, {}).defCalls || {}));
  const survivor = [...newNames][0];
  const staleGp = {
    tendency: 'Balanced',
    defCalls: { 'Old Stack': { front: '4-3' }, 'Old Zero': { aggression: 'house' } },
    callSheet: {
      third_long: { any: [['Old Stack', 60], ['Old Zero', 40]] },          // all dead → row must die
      red_zone: { any: [['Old Stack', 70], [survivor, 30]], empty: [['Old Zero', 100]] }, // mixed → survivor only
      base: { any: [[survivor, 100]] }                                     // all alive → untouched
    }
  };
  const loaded = applyDefBookToGameplan(bk, staleGp);
  const sheet = loaded.callSheet || {};
  let deadRefs = 0;
  for (const row of Object.values(sheet)) for (const cell of Object.values(row)) {
    for (const e of cell) if (!loaded.defCalls[e[0]]) deadRefs++;
  }
  ok(deadRefs === 0, `book load leaves ZERO dead callSheet references (${deadRefs})`);
  ok(!sheet.third_long, 'a row whose calls all died is deleted — renders empty, never lingers');
  ok(sheet.red_zone && sheet.red_zone.any && sheet.red_zone.any.length === 1
    && sheet.red_zone.any[0][0] === survivor && sheet.red_zone.any[0][1] === 30,
    'a surviving name keeps its exact weight — no weights invented');
  ok(sheet.red_zone && !sheet.red_zone.empty, 'an all-dead personnel cell is deleted from a surviving row');
  ok(sheet.base && sheet.base.any[0][0] === survivor && sheet.base.any[0][1] === 100, 'an all-alive row is untouched');
  ok(staleGp.callSheet.third_long.any.length === 2, 'the input gameplan is not mutated');
  // identity-only book (no shelves) → old library stays → sheet stays whole.
  const idOnly = { name: 'Identity', baseFront: '4-3', frontMix: { '4-3': 100 }, aggression: 'balanced', coverageScheme: 'balanced' };
  const kept = applyDefBookToGameplan(idOnly, staleGp);
  ok(kept.defCalls && kept.defCalls['Old Stack'] && kept.callSheet && kept.callSheet.third_long,
    'an identity-only book (no shelves) leaves the old library AND its sheet alone');
  // the exported healer: prunes in place, deletes an emptied sheet outright.
  const healGp = { defCalls: { Live: { front: 'Dime' } }, callSheet: { base: { any: [['Ghost', 100]] } } };
  pruneCallSheet(healGp);
  ok(!healGp.callSheet, 'pruneCallSheet deletes an emptied sheet (empty-structures old-save law)');
}

console.log(`DEFSHEET PROBE — ${pass} pass, ${fail} fail`);
if (fail) { console.log('  FAILURES:'); bad.slice(0, 25).forEach((m) => console.log('   -', m)); }
console.log(fail ? 'DEFSHEET PROBE FAIL' : 'DEFSHEET PROBE PASS');
process.exit(fail ? 1 : 0);
