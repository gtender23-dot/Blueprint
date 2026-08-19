// plan_cohesion_probe.mjs — D10 COHESION AUDIT (2026-08-18): the book↔dials seam,
// PROVEN, not read. Run: node tools/plan_cohesion_probe.mjs [gamesPerArm]
//
// This probe PINS the collision behavior the audit found between the defensive
// book/card/call vocabulary and the standing gameplan dials. Every assertion
// pins CURRENT behavior — including behavior the audit reports as a defect —
// so the pins are tripwires: when a D-block fixes one, the pin fails and gets
// updated WITH the fix (the defsheet_probe convention). See
// Ref/COHESION_AUDIT_2026-08-18.md for the findings each section evidences.
//
//   1. FAMILY BEATS THE DIALS. A defCall carrying covFamily OVERWRITES the
//      standing covShell/covStyle unconditionally (sim.js applyDefCall
//      ~200-208, COV_FAMILY_IMPLIES) — proven at sim level: a single/man/press
//      standing plan under an all-rows "Tampa 2" call sheet stamps Tampa 2 on
//      the pass ledger, which coverageFamily('single','man') can never emit.
//   2. CHK-AFTER-CALL — THE RATIFIED WINNER (D15, OD-2(a) 2026-08-17): the
//      personnel check is the more specific layer and WINS in both arms. A
//      formCheck's shell/style overwrite a sampled call's shell/style, AND
//      when the check writes shell/style it clears defEff.covFamily, so the
//      coverage pick reads the check's dials instead of short-circuiting on
//      the family name. A check naming NEITHER shell nor style leaves the
//      family standing (OD-1(a): the family is the call grammar). Plus OD-3
//      source pins: the headset re-stamp after the _nextPlay merge.
//   3. THE BOX SPEAKS TWO SEMANTICS. A CALL's runCommit is ABSOLUTE
//      (clamp2(o.runCommit,-25,25)); a CHK's runCommit is a DELTA
//      (defEff.runCommit + _chk.runCommit). The UI splits again: CALL_FIELDS
//      ±10, CHK_FIELDS ±8, headset DEF_CALL_ROWS ±8-relative. Source pins.
//   4. THE CARD'S THREE COMPILE PATHS DISAGREE. cardToDefCall emits pressLevel
//      (dropped by pickDefCall's normalizer + applyDefCall — the headset path
//      ignores the card's cushion) but carries dogGame; cardToCell carries
//      pressLevel but DROPS dogGame; cardToFormCheck drops robber/zone-eyes/
//      cushion/dog AND the family coverages entirely. greenDog on a card is
//      dropped by all three (the shipped "Dime Green Dog" card's green dog
//      never compiles). Data-level, one card through all three seams.
//   5. PLACEBO ENUMS. defbook offers coverageScheme aggressive/conservative
//      ("the five coverage identities the sim honors") — the sim branches only
//      on lockTop/bracketTop; the shipped "Attack 3-4" starter carries the
//      placebo. Card extras: D13 (OD-7, ratified 2026-08-18) repaired the
//      starter strays and gave validateDefBook enum teeth — these pins now
//      assert ABSENCE (the probe working as designed: pins flip WITH the fix).
//      The last stray, zoneStyle:"quarterQuarterHalf", was owner-resolved
//      (realism: QQH IS Cover 6 — the card already calls c6) — extra dropped;
//      the validator keeps a legacy WARNING for pre-fix saved copies.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { ROSTER_TARGETS, CLASS_YEARS, COV_FAMILY, aggrStopFromBlitzPct } from '../js/constants.js';
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import {
  cardToDefCall, cardToCell, cardToFormCheck, emptyDefCard,
  DEF_COVERAGE_SCHEMES, validateDefBook, CARD_EXTRA_ENUMS, CARD_EXTRA_LEGACY, CARD_VOCAB
} from '../js/engine/defbook.js';
import { DEFAULT_DEF_BOOKS } from '../js/engine/defaultbooks.js';

const N = parseInt(process.argv[2] || '12', 10);
let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
};

const __dir = path.dirname(url.fileURLToPath(import.meta.url));
const SIM_SRC = fs.readFileSync(path.join(__dir, '../js/engine/sim.js'), 'utf8');
const GP_UI_SRC = fs.readFileSync(path.join(__dir, '../js/ui/views/gameplan.js'), 'utf8');
const APP_SRC = fs.readFileSync(path.join(__dir, '../js/ui/app.js'), 'utf8');

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ t >>> 15, 1 | t);
    r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r;
    return ((r ^ r >>> 14) >>> 0) / 4294967296;
  };
}
const realRandom = Math.random;
function genRoster(schoolId) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], 1);
      p.schoolId = schoolId; r.push(p);
    }
  }
  return r;
}
const ALL_ROWS = ['base', 'first_ten', 'second_long', 'third_short', 'third_medium', 'third_long', 'red_zone', 'goal_line', 'backed_up', 'two_min_trail', 'four_min_lead'];
const sheetAll = (name) => Object.fromEntries(ALL_ROWS.map(k => [k, { any: [[name, 100]] }]));
// Home offense pinned to Spread → formationCheckClass = "spread" every snap.
const GP_OFF = {
  offFormation: 'Spread', tendency: 'Heavy Pass', rushInPct: 60,
  passDepth: { short: 34, medium: 33, deep: 33 }, blitzPct: 15,
  fourthDown: 'Moderate', maxFGDist: 42,
};
function runGame(defCall, seed, defExtra = {}) {
  Math.random = mulberry32(seed);
  try {
    const rH = genRoster('H'), rA = genRoster('A');
    const gpH = { ...GP_OFF };
    const gpA = {
      ...GP_OFF,
      // The standing trio under test: single-high, man, press.
      covShell: 'single', covStyle: 'man', pressLevel: 'press',
      defCalls: { Probe: defCall }, callSheet: sheetAll('Probe'),
      ...defExtra,
    };
    const cH = buildDepthChart(rH, gpH), cA = buildDepthChart(rA, gpA);
    const res = simulateGame({ id: 'H' }, { id: 'A' }, rH, rA, cH, cA, gpH, gpA);
    const plays = [];
    for (const d of res.drives || []) {
      if (d.possession !== 'home') continue;
      for (const pl of d.plays || []) plays.push(pl);
    }
    return plays;
  } finally {
    Math.random = realRandom;
  }
}
function covCounts(defCall, seedBase, defExtra = {}) {
  const counts = {}; let db = 0;
  for (let i = 0; i < N; i++) {
    for (const pl of runGame(defCall, seedBase + i, defExtra)) {
      if (!String(pl.type || '').startsWith('pass')) continue;
      db++;
      counts[pl.coverage || '?'] = (counts[pl.coverage || '?'] || 0) + 1;
    }
  }
  return { counts, db };
}
const share = (c, names) => c.db ? names.reduce((s, n) => s + (c.counts[n] || 0), 0) / c.db : 0;
const fmt = (c) => Object.entries(c.counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' ');

console.log(`— 1. a family call OVERWRITES the standing shell/style dials — ${N} games/arm\n`);
{
  // Standing plan is single/man/press. coverageFamily('single','man') can only
  // ever emit Cover 1 (Cover 0 at blitz≥40). If Tampa 2 lands on the ledger,
  // the call's covFamily overwrote the dials — not blended, not gated on unset.
  const c = covCounts({ covFamily: 'Tampa 2' }, 41000);
  check('covFamily call stamps its family over a single/man/press standing plan',
    share(c, ['Tampa 2']) >= 0.9, `${(share(c, ['Tampa 2']) * 100).toFixed(1)}% of ${c.db} dropbacks [${fmt(c)}]`);
}

console.log('\n— 2. CHK-after-CALL: the check WINS in both arms (D15, OD-2(a) ratified) —\n');
{
  const CHK = { formChecks: { spread: { covShell: 'single', covStyle: 'man' } } };
  // Arm A — plain-dials call (two/zone). The spread check runs AFTER the call
  // on the same defEff and overwrites shell/style: the ledger must read the
  // CHECK's single/man (Cover 1/0), not the CALL's two/zone (Cover 2/4).
  const a = covCounts({ covShell: 'two', covStyle: 'zone' }, 42000, CHK);
  check('plain-dials call: the formCheck\'s single/man wins the snap',
    share(a, ['Cover 1', 'Cover 0']) >= 0.85, `${(share(a, ['Cover 1', 'Cover 0']) * 100).toFixed(1)}% of ${a.db} [${fmt(a)}]`);
  check('plain-dials call: the call\'s two-zone families are gone',
    share(a, ['Cover 2', 'Cover 4', 'Cover 2-Man']) <= 0.05, `${(share(a, ['Cover 2', 'Cover 4', 'Cover 2-Man']) * 100).toFixed(1)}%`);
  // Control — same call, NO check: the call's two/zone dials must land.
  const ctl = covCounts({ covShell: 'two', covStyle: 'zone' }, 43000);
  check('control (no check): the call\'s two/zone dials govern',
    share(ctl, ['Cover 2', 'Cover 4']) >= 0.85, `${(share(ctl, ['Cover 2', 'Cover 4']) * 100).toFixed(1)}% of ${ctl.db} [${fmt(ctl)}]`);
  // Arm B — family call under the SAME check. RATIFIED WINNER (was the pinned
  // defect): the check's shell/style write clears defEff.covFamily, so the
  // coverage pick reads the check's single/man — the family is GONE.
  const b = covCounts({ covFamily: 'Tampa 2' }, 44000, CHK);
  check('family call: the check\'s shell/style write CLEARS the family — check wins (OD-2(a))',
    share(b, ['Cover 1', 'Cover 0']) >= 0.85, `${(share(b, ['Cover 1', 'Cover 0']) * 100).toFixed(1)}% of ${b.db} [${fmt(b)}]`);
  check('family call under the check: Tampa 2 no longer stamps',
    share(b, ['Tampa 2']) <= 0.05, `${(share(b, ['Tampa 2']) * 100).toFixed(1)}%`);
  // Arm C — a check that names NEITHER shell nor style (box-only) leaves the
  // family standing: OD-1(a), the family is the call grammar on its snap.
  const c2 = covCounts({ covFamily: 'Tampa 2' }, 45000,
    { formChecks: { spread: { runCommit: 4 } } });
  check('box-only check: the family STANDS (clear is gated on a shell/style write)',
    share(c2, ['Tampa 2']) >= 0.9, `${(share(c2, ['Tampa 2']) * 100).toFixed(1)}% of ${c2.db} [${fmt(c2)}]`);
  // OD-3 source pins (the _nextPlay seam is coached-game machinery this
  // AI-only harness can't drive; timecontrol_probe owns the live seam):
  // the headset re-stamp exists AND sits after the _nextPlay merge loop.
  const npIdx = SIM_SRC.indexOf('plan._nextPlay;');
  const restampRe = /\/\/ OD-3[^]*?if \(forcedDefCall && !forcedDefCall\._ride\) applyDefCall\(defEff, forcedDefCall, defSchool\);/;
  const m = restampRe.exec(SIM_SRC);
  check('OD-3: headset re-stamp after the _nextPlay merge exists in sim.js', !!m);
  check('OD-3: the re-stamp sits AFTER the _nextPlay merge loop', !!m && npIdx > 0 && m.index > npIdx);
  check('OD-2(a): the CHK site clears covFamily on a shell/style write',
    /if \(_chk\.covShell \|\| _chk\.covStyle\) defEff\.covFamily = null;/.test(SIM_SRC));
}

console.log('\n— 3. the box speaks two semantics + three UI magnitudes (source pins) —\n');
{
  check('CALL runCommit is ABSOLUTE in applyDefCall (clamp2(o.runCommit, -25, 25))',
    /clamp2\(o\.runCommit,\s*-25,\s*25\)/.test(SIM_SRC));
  check('CHK runCommit is a DELTA in the formCheck apply (defEff.runCommit + _chk.runCommit)',
    /defEff\.runCommit\s*\+\s*_chk\.runCommit/.test(SIM_SRC));
  check('CALL_FIELDS Box options are ±10', /\[\s*"-10"\s*,\s*"Lighten the box"\s*\]/.test(GP_UI_SRC) && /\[\s*"10"\s*,\s*"Commit to the run"\s*\]/.test(GP_UI_SRC));
  check('CHK_FIELDS Box options are ±8', /\[\s*"-8"\s*,\s*"Lighten the box"\s*\]/.test(GP_UI_SRC) && /\[\s*"8"\s*,\s*"Commit to the run"\s*\]/.test(GP_UI_SRC));
  // Note: the source stores the minus as the − escape ("Lighten −8").
  check('headset DEF_CALL_ROWS Box is ±8 (relative)', /\[\s*"-8"\s*,\s*"Lighten /.test(APP_SRC) && /\[\s*"8"\s*,\s*"Commit \+8"\s*\]/.test(APP_SRC));
}

console.log('\n— 4. one card, three compile paths, three vocabularies —\n');
{
  const card = {
    ...emptyDefCard('Kitchen Sink'), front: '4-3', coverage: 'c3', bring: '5', look: 'fireZone',
    runCommit: 6, edgePlay: 'contain', robberCall: 'rob', zoneStyle: 'match',
    dogGame: 'green', pressLevel: 'press', greenDog: true,
  };
  const call = cardToDefCall(card), cell = cardToCell(card), chk = cardToFormCheck(card);
  // ── D14 (OD-6, owner-ratified 2026-08-18): THE PINS FLIP ──────────────────
  // Every "DROPS" pin below was a defect pinned as current behavior. The three
  // seams now derive their key sets from ONE exported CARD_VOCAB table, so the
  // asymmetries can't come back by hand-editing one list and not the others.
  check('D14: CARD_VOCAB is exported and every seam column is declared',
    CARD_VOCAB && Object.values(CARD_VOCAB).every(v => 'call' in v && 'cell' in v && 'check' in v));
  // The headset/call path — and now the sim ACTUALLY honors the cushion.
  check('cardToDefCall emits pressLevel', call.pressLevel === 'press');
  check('cardToDefCall carries dogGame', call.dogGame === 'green');
  check('cardToDefCall DROPS greenDog (a book identity toggle, never a card element)', !('greenDog' in call));
  // The shelf→cell path: unchanged by D14 (ratified — it already spoke every
  // key a standing posture can hold).
  check('cardToCell carries pressLevel (the cell path honors the cushion)', cell.pressLevel === 'press');
  check('cardToCell DROPS dogGame (call-only by design — no cell-side field)', !('dogGame' in cell));
  check('cardToCell carries robberCall + zoneStyle', cell.robberCall === 'rob' && cell.zoneStyle === 'match');
  // The answers→formCheck path: dog/rotation stay call-only BY DESIGN, and the
  // three call-only-by-design drops are now declared in CARD_VOCAB, not
  // accidents of a hand-listed key set.
  for (const k of ['dogGame', 'rotation', 'greenDog']) {
    check(`cardToFormCheck DROPS ${k} (declared call-only in CARD_VOCAB)`, !(k in chk));
  }
  for (const k of ['dogGame', 'rotation']) {
    check(`CARD_VOCAB declares ${k} call-only`, CARD_VOCAB[k].call && !CARD_VOCAB[k].cell && !CARD_VOCAB[k].check);
  }
  // THE RATIFIED FIX: a family coverage now SURVIVES into a personnel answer,
  // translated through the ONE table. Before D14 the answer arrived with no
  // coverage at all and quietly fell back to the standing dials.
  const famChk = cardToFormCheck({ ...emptyDefCard('T2'), coverage: 'tampa2' });
  check('D14: cardToFormCheck({coverage:"tampa2"}) keeps the family AND its implied shell/style',
    famChk.covFamily === 'Tampa 2' && famChk.covShell === 'two' && famChk.covStyle === 'zone');
  check('D14: a plain-dials card still yields plain dials in the answer (no phantom family)',
    !('covFamily' in cardToFormCheck({ ...emptyDefCard('C3'), coverage: 'c3' })));
  // The sim-side vocabulary pins: the normalizer and applyDefCall now speak the
  // cushion, and the check apply site forwards a family.
  const NORMALIZED = ['front', 'covShell', 'covStyle', 'edgePlay', 'pressureIdentity', 'robberCall', 'zoneStyle', 'aggression', 'runCommit', 'covFamily', 'rotation', 'rush3', 'pressLook', 'dogGame', 'pressLevel'];
  for (const k of NORMALIZED) {
    check(`pickDefCall normalizer speaks "${k}"`, new RegExp(`${k}\\s*:\\s*c\\.${k === 'rush3' ? 'rush3' : k}`).test(SIM_SRC));
  }
  check('D14: applyDefCall HAS a pressLevel branch (the headset honors a card cushion)',
    /if \(o\.pressLevel && o\.pressLevel !== "auto"\) defEff\.pressLevel = o\.pressLevel;/.test(SIM_SRC));
  check('D14: the formCheck apply site forwards covFamily (the answer keeps its picture)',
    /covFamily: _chk\.covFamily \|\| null,/.test(SIM_SRC));
  check('D14: OD-2(a) order preserved — the CALL family is cleared BEFORE the check applies its own',
    SIM_SRC.indexOf('if (_chk.covShell || _chk.covStyle) defEff.covFamily = null;') <
    SIM_SRC.indexOf('covFamily: _chk.covFamily || null,'));
  // The THREE hand-kept family→shell copies are now ONE (constants.js).
  check('D14: sim.js FAMILY_SHELL is derived, not hand-listed',
    /var FAMILY_SHELL = Object\.fromEntries\(Object\.entries\(COV_FAMILY\)/.test(SIM_SRC));
  check('D14: sim.js COV_FAMILY_IMPLIES is derived from the callable families',
    /var COV_FAMILY_IMPLIES = Object\.fromEntries\(\s*Object\.entries\(COV_FAMILY\)\.filter\(\(\[, v\]\) => v\.callable\)/.test(SIM_SRC));
  check('D14: only the four card-selectable pictures are callable (an output-only family cannot overwrite dials)',
    Object.entries(COV_FAMILY).filter(([, v]) => v.callable).map(([f]) => f).sort().join('|')
      === 'Cover 2-Man|Cover 6|Prevent|Tampa 2');
  check('D14: the shell-only copy carries Cover 2-Man (the audit recorded it missing — it never was)',
    COV_FAMILY['Cover 2-Man'].shell === 'two');
}

console.log('\n— 5. placebo enums (pinned as CURRENT behavior — see the audit) —\n');
{
  // D16 (OD-5(b), owner-ratified): the placebo pins FLIPPED — the two dead
  // values are RETIRED from every picker but keep LOADING (schema-compatible).
  const active = DEF_COVERAGE_SCHEMES.filter(s => !s.retired).map(s => s.id);
  check('D16: the live coverage identities are exactly balanced/lockTop/bracketTop',
    active.length === 3 && active.includes('balanced') && active.includes('lockTop') && active.includes('bracketTop'), active.join(','));
  check('D16: aggressive/conservative survive as RETIRED entries (old books keep validating/loading)',
    DEF_COVERAGE_SCHEMES.some(s => s.id === 'aggressive' && s.retired === true) &&
    DEF_COVERAGE_SCHEMES.some(s => s.id === 'conservative' && s.retired === true));
  check('the sim has NO aggressive/conservative coverageScheme branch',
    !/coverageScheme\s*===\s*"aggressive"/.test(SIM_SRC) && !/coverageScheme\s*===\s*"conservative"/.test(SIM_SRC));
  const attack = DEFAULT_DEF_BOOKS.find(b => b.name === 'Attack 3-4');
  check('D16: "Attack 3-4" no longer carries a placebo — no starter book does',
    attack && attack.coverageScheme === 'balanced' &&
    DEFAULT_DEF_BOOKS.every(b => b.coverageScheme !== 'aggressive' && b.coverageScheme !== 'conservative'));
  const cards = [];
  for (const b of DEFAULT_DEF_BOOKS) for (const arr of Object.values(b.shelves || {})) for (const c of arr) cards.push([b.name, c]);
  // D13 (OD-7, owner-ratified): the invalid-values pins FLIPPED — they assert
  // absence now. That is the probe working as designed.
  const badZone = cards.filter(([, c]) => c.zoneStyle != null && !CARD_EXTRA_ENUMS.zoneStyle.includes(c.zoneStyle));
  check('D13: no starter card carries a zoneStyle outside the enum (QQH owner-resolved: it IS Cover 6)',
    badZone.length === 0, badZone.map(([b, c]) => `${b}/"${c.name}":${c.zoneStyle}`).join(', '));
  check('D13: "Bend Cover 6" calls the c6 picture with NO zoneStyle extra (QQH was a redundant restatement)',
    cards.some(([, c]) => c.name === 'Bend Cover 6' && c.coverage === 'c6' && c.zoneStyle == null));
  check('D13: quarterQuarterHalf is registered LEGACY (old saved copies warn, never red)',
    (CARD_EXTRA_LEGACY.zoneStyle || []).includes('quarterQuarterHalf'));
  const badRob = cards.filter(([, c]) => c.robberCall != null && !CARD_EXTRA_ENUMS.robberCall.includes(c.robberCall));
  check('D13: no starter card carries a robberCall outside auto/rob/overtop', badRob.length === 0,
    badRob.map(([b, c]) => `${b}/"${c.name}":${c.robberCall}`).join(', '));
  check('D13: the six robberCall:true cards now rob for real (robberCall:"rob" ×6)',
    cards.filter(([, c]) => c.robberCall === 'rob').length === 6);
  const badRot = cards.filter(([, c]) => c.rotation != null && !CARD_EXTRA_ENUMS.rotation.includes(c.rotation));
  check('D13: every card rotation is sky/cloud/buzz', badRot.length === 0,
    badRot.map(([b, c]) => `${b}/"${c.name}":${c.rotation}`).join(', '));
  check('D13: the Coastal strays landed on rotation (sky/sky/cloud) and Bear Fire Zone buzzes',
    cards.some(([, c]) => c.name === 'Coastal Cover 3' && c.rotation === 'sky')
    && cards.some(([, c]) => c.name === 'Sky Rotation Cover 3' && c.rotation === 'sky' && c.robberCall === 'rob')
    && cards.some(([, c]) => c.name === 'Dime Coastal 3' && c.rotation === 'cloud')
    && cards.some(([, c]) => c.name === 'Bear Fire Zone' && c.rotation === 'buzz'));
  check('D13: "Lead Prevent" plays its soft zone for real (zoneStyle:"spot")',
    cards.some(([, c]) => c.name === 'Lead Prevent' && c.zoneStyle === 'spot'));
  const gd = cards.filter(([, c]) => c.greenDog === true);
  check('D13: no starter card carries dead greenDog:true ("Dime Green Dog" speaks dogGame:"green" now)',
    gd.length === 0 && cards.some(([, c]) => c.name === 'Dime Green Dog' && c.dogGame === 'green'),
    gd.map(([b, c]) => `${b}/"${c.name}"`).join(', '));
  // The card→call seam carries rotation now (D13 — the ONE seam that dropped
  // it; without this the repaired rotation data would compile to nothing).
  check('D13: cardToDefCall carries rotation',
    cardToDefCall({ ...emptyDefCard('R'), coverage: 'c3', rotation: 'sky' }).rotation === 'sky');
  // Validator teeth: a stray value reds; the known-pending value warns only.
  const vBook = (card) => validateDefBook({ ...DEFAULT_DEF_BOOKS[0], shelves: { base: [card] }, answers: {} });
  const vBad = vBook({ ...emptyDefCard('Stray'), zoneStyle: 'fire' });
  check('D13: validateDefBook reds an unknown zoneStyle ("fire")',
    !vBad.ok && vBad.errors.some(e => /zoneStyle "fire"/.test(e)));
  const vPend = vBook({ ...emptyDefCard('Pend'), zoneStyle: 'quarterQuarterHalf' });
  check('D13: validateDefBook treats quarterQuarterHalf as legacy (warning, ok stays true — old saves keep loading)',
    vPend.ok && vPend.warnings.some(w => /legacy value/.test(w)));
  const vKey = vBook({ ...emptyDefCard('Zombie'), spyQB: true });
  check('D13: an unknown card KEY is a warning, not an error (future vocab can add keys)',
    vKey.ok && vKey.warnings.some(w => /unknown key "spyQB"/.test(w)));
  check('D13: all six starter books validate ok', DEFAULT_DEF_BOOKS.every(b => validateDefBook(b).ok));
}

console.log(`\n— 7. D14: the ANSWER keeps its coverage (OD-6 ratified) — ${N} games/arm\n`);
{
  // The sharpest half of "one card, three defenses", proven at sim level.
  // A book answer built from a Tampa 2 card used to reach the field with NO
  // coverage — cardToFormCheck copied only shell/style and the family name
  // died there — so "vs Empty/spread, check to Dime Tampa 2" quietly played
  // whatever the dials said. The standing plan here is single/man/press, so
  // any Tampa 2 on the ledger can only have come from the ANSWER.
  const CALL = { defCalls: { Probe: { covShell: 'single', covStyle: 'man' } }, callSheet: sheetAll('Probe') };
  const withFam = covCounts({ covShell: 'single', covStyle: 'man' }, 71000,
    { ...CALL, formChecks: { spread: { covFamily: 'Tampa 2', covShell: 'two', covStyle: 'zone' } } });
  check('D14: an answer naming a family STAMPS that family on the snap',
    share(withFam, ['Tampa 2']) >= 0.9,
    `${(share(withFam, ['Tampa 2']) * 100).toFixed(1)}% of ${withFam.db} [${fmt(withFam)}]`);
  // Control — the PRE-D14 shape of the same answer (shell/style only, family
  // dropped): the dials resolve to the two-high zone families, never Tampa 2.
  const plain = covCounts({ covShell: 'single', covStyle: 'man' }, 71000,
    { ...CALL, formChecks: { spread: { covShell: 'two', covStyle: 'zone' } } });
  check('control (the pre-D14 shape): shell/style alone can never produce Tampa 2',
    share(plain, ['Tampa 2']) <= 0.02 && share(plain, ['Cover 2', 'Cover 4']) >= 0.85,
    `Tampa2 ${(share(plain, ['Tampa 2']) * 100).toFixed(1)}% · two-high zone ${(share(plain, ['Cover 2', 'Cover 4']) * 100).toFixed(1)}% of ${plain.db}`);
}

console.log('\n— 6. D16 retirements, disclosed (OD-5/OD-8/OD-9 ratified 2026-08-17) —\n');
{
  const AI_SRC = fs.readFileSync(path.join(__dir, '../js/engine/ai.js'), 'utf8');
  const CD_SRC = fs.readFileSync(path.join(__dir, '../js/ui/views/creatordef.js'), 'utf8');
  const WORLD_SRC = fs.readFileSync(path.join(__dir, '../js/engine/world.js'), 'utf8');
  const DB_SRC = fs.readFileSync(path.join(__dir, '../js/engine/defbook.js'), 'utf8');
  const BENCH_SRC = fs.readFileSync(path.join(__dir, '../js/engine/bench.js'), 'utf8');
  // OD-8 — blitzPct is derived-only: every writer writes the STOP.
  check('OD-8: setAIGameplan writes the stop from the aggression roll (no raw blitzPct author)',
    /defAggression:\s*aiAggrStop/.test(AI_SRC) && !/blitzPct:\s*15\s*\+\s*Math\.round/.test(AI_SRC));
  // THE BAND CLAIM, PROVEN rather than sampled: OD-8 called the writer
  // retirement "near-neutral by construction (the sim already quantizes)".
  // It is EXACTLY neutral for the AI — the same 15–35 roll is quantized by the
  // same aggrStopFromBlitzPct, one draw as before, so the stop distribution is
  // identical draw-for-draw and the RNG stream position is preserved.
  check('OD-8: setAIGameplan quantizes the SAME 15–35 roll (one draw, stream position preserved)',
    /aggrStopFromBlitzPct\(15 \+ Math\.round\(Math\.random\(\) \* 20\)\)/.test(AI_SRC));
  {
    const mulb = (s) => { let t = s >>> 0; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ t >>> 15, 1 | t); r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r; return ((r ^ r >>> 14) >>> 0) / 4294967296; }; };
    const oldR = mulb(7), newR = mulb(7);
    let identical = true;
    for (let i = 0; i < 20000; i++) {
      // OLD: authored raw, quantized by the sim at the first kickoff.
      const o = aggrStopFromBlitzPct(15 + Math.round(oldR() * 20));
      // NEW: the identical roll, quantized at write time.
      const n = aggrStopFromBlitzPct(15 + Math.round(newR() * 20));
      if (o !== n) { identical = false; break; }
    }
    check('OD-8: the AI stop distribution is IDENTICAL to the pre-D16 path, draw for draw (the band claim)', identical);
  }
  check('OD-8: the AI weekly-reaction cell speaks the stop (house/bend), not 45/10',
    /defAggression:\s*"house"/.test(AI_SRC) && !/blitzPct:\s*45/.test(AI_SRC) && !/blitzPct:\s*10/.test(AI_SRC));
  // D17 C-2 moved Simple mode onto a returned PATCH (the seam commits it), so
  // the posture now calls setAggr on that patch rather than on the live plan.
  // The PIN'S INTENT is unchanged and is what still matters: the posture must
  // go through setAggr — which writes the stop AND its derived blitzPct mirror
  // together — and must never author a raw 38 again.
  check('OD-8: Simple-mode Defensive Posture routes through setAggr (the stale-pair discard is closed)',
    /setAggr\((?:gp|patch),\s*"attacking"\)/.test(GP_UI_SRC) && /setAggr\((?:gp|patch),\s*"bend"\)/.test(GP_UI_SRC) &&
    !/(?:gp|patch)\.blitzPct\s*=\s*38/.test(GP_UI_SRC));
  check('OD-8: Simple-mode situation cells write cell.defAggression, never a raw cell.blitzPct number',
    /cell\.defAggression\s*=\s*"attacking"/.test(GP_UI_SRC) && !/cell\.blitzPct\s*=\s*38/.test(GP_UI_SRC));
  check('OD-8: the sim\'s normalize/migration shims STAY (old saves keep converting)',
    /aggrStopFromBlitzPct\(gp\.blitzPct\)/.test(SIM_SRC) &&
    /cell\.blitzPct\s*!=\s*null\s*&&\s*cell\.defAggression\s*==\s*null/.test(SIM_SRC));
  check('OD-8: defaultGameplan carries the stop from birth (blitzPct kept as its mirror)',
    /defAggression:\s*"balanced",\s*\n\s*blitzPct:\s*20/.test(WORLD_SRC));
  // OD-5 — the creator picker no longer offers the placebos.
  check('OD-5: the creator coverage picker filters retired entries',
    /DEF_COVERAGE_SCHEMES\.filter\(\(c\) => !c\.retired/.test(CD_SRC));
  // OD-9 — pressureSource: off every authoring surface, schema still loads it.
  check('OD-9: defaultGameplan no longer ships pressureSource', !/pressureSource:\s*\{/.test(WORLD_SRC));
  check('OD-9: the creator pressure-source pie is off the editor surface', !/data-def-src/.test(CD_SRC));
  check('OD-9: the identity card no longer narrates the dead field', !/=\s*gp\.pressureSource/.test(GP_UI_SRC));
  check('OD-9: the SCHEMA keeps the field — emptyDefBook still carries it and apply still copies it (old books load)',
    /pressureSource:\s*\{\s*edge:\s*50,\s*interior:\s*25,\s*secondary:\s*25\s*\}/.test(DB_SRC) &&
    /gp\.pressureSource\s*=\s*\{\s*\.\.\.db\.pressureSource\s*\}/.test(DB_SRC));
  check('OD-9: the sim still deletes it at kickoff (the retirement end-state, unchanged)',
    /delete gp\.pressureSource/.test(SIM_SRC));
  // _liveTempo — the reader-without-writer is gone.
  check('_liveTempo dead reads deleted from sim.js (was read 3x, written never)',
    !/offPlan\._liveTempo/.test(SIM_SRC));
  // Fixture hygiene.
  check('bench.js fixtures no longer carry defFormation/clockMgmt (inert keys)',
    !/defFormation:/.test(BENCH_SRC) && !/clockMgmt:/.test(BENCH_SRC));
}

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'}  (${pass} pass, ${fail} fail)`);
process.exit(fail ? 1 : 0);
