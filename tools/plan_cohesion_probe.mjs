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
//   2. CHK-AFTER-CALL ORDER DEPENDENCE. A formCheck's shell/style overwrite a
//      sampled call's shell/style (sim.js ~4768 CALL then ~4776 CHK, same
//      defEff) — but a check CANNOT clear defEff.covFamily, and the coverage
//      pick (~4958) short-circuits on the family. So the same check wins
//      against a plain-dials call and silently LOSES against a family call.
//      Both arms proven at sim level with the same check.
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
//      placebo. Starter card extras carry values outside the engine enums
//      (zoneStyle:"fire"/"soft", robberCall:true) that no validator flags.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import {
  cardToDefCall, cardToCell, cardToFormCheck, emptyDefCard,
  DEF_COVERAGE_SCHEMES
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

console.log('\n— 2. CHK-after-CALL: the same check wins vs plain dials, loses vs a family —\n');
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
  // Arm B — family call under the SAME check. The check still overwrites the
  // shell/style dials, but it cannot clear defEff.covFamily and the coverage
  // pick short-circuits on the family: the check silently loses.
  const b = covCounts({ covFamily: 'Tampa 2' }, 44000, CHK);
  check('family call: the SAME formCheck is silently ignored by the coverage pick',
    share(b, ['Tampa 2']) >= 0.9, `${(share(b, ['Tampa 2']) * 100).toFixed(1)}% of ${b.db} [${fmt(b)}]`);
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
  // The headset/call path: emits pressLevel — which pickDefCall's normalizer
  // and applyDefCall both drop (pinned below) — and carries dogGame.
  check('cardToDefCall emits pressLevel (the call path will drop it)', call.pressLevel === 'press');
  check('cardToDefCall carries dogGame', call.dogGame === 'green');
  check('cardToDefCall DROPS greenDog (the "Dime Green Dog" card class)', !('greenDog' in call));
  // The shelf→cell path: honors pressLevel, DROPS dogGame.
  check('cardToCell carries pressLevel (the cell path honors the cushion)', cell.pressLevel === 'press');
  check('cardToCell DROPS dogGame (the standing answer loses the dog game)', !('dogGame' in cell));
  check('cardToCell carries robberCall + zoneStyle', cell.robberCall === 'rob' && cell.zoneStyle === 'match');
  // The answers→formCheck path: drops robber/zone-eyes/cushion/dog.
  for (const k of ['robberCall', 'zoneStyle', 'pressLevel', 'dogGame', 'greenDog']) {
    check(`cardToFormCheck DROPS ${k}`, !(k in chk));
  }
  // A family coverage loses its shell/style entirely in a personnel answer.
  const famChk = cardToFormCheck({ ...emptyDefCard('T2'), coverage: 'tampa2' });
  check('cardToFormCheck({coverage:"tampa2"}) carries NO covShell/covStyle (the answer loses the coverage)',
    !('covShell' in famChk) && !('covStyle' in famChk));
  // The sim-side vocabulary pin: pickDefCall's normalizer key list (sim.js).
  // pressLevel is NOT in it — the drop is at this seam. If the sim ever grows
  // the key, this pin fails and the audit finding is resolved: update both.
  const NORMALIZED = ['front', 'covShell', 'covStyle', 'edgePlay', 'pressureIdentity', 'robberCall', 'zoneStyle', 'aggression', 'runCommit', 'covFamily', 'rotation', 'rush3', 'pressLook', 'dogGame'];
  for (const k of NORMALIZED) {
    check(`pickDefCall normalizer still speaks "${k}"`, new RegExp(`${k}\\s*:\\s*c\\.${k === 'rush3' ? 'rush3' : k}`).test(SIM_SRC));
  }
  check('pickDefCall normalizer does NOT speak pressLevel', !/pressLevel\s*:\s*c\.pressLevel/.test(SIM_SRC));
  check('applyDefCall has no pressLevel branch', !/o\.pressLevel/.test(SIM_SRC));
}

console.log('\n— 5. placebo enums (pinned as CURRENT behavior — see the audit) —\n');
{
  const ids = DEF_COVERAGE_SCHEMES.map(s => s.id);
  check('defbook offers aggressive/conservative coverage identities', ids.includes('aggressive') && ids.includes('conservative'));
  check('the sim has NO aggressive/conservative coverageScheme branch',
    !/coverageScheme\s*===\s*"aggressive"/.test(SIM_SRC) && !/coverageScheme\s*===\s*"conservative"/.test(SIM_SRC));
  const attack = DEFAULT_DEF_BOOKS.find(b => b.name === 'Attack 3-4');
  check('shipped "Attack 3-4" carries the placebo coverageScheme "aggressive"', attack && attack.coverageScheme === 'aggressive');
  const cards = [];
  for (const b of DEFAULT_DEF_BOOKS) for (const arr of Object.values(b.shelves || {})) for (const c of arr) cards.push([b.name, c]);
  const badZone = cards.filter(([, c]) => c.zoneStyle != null && !['spot', 'balanced', 'match'].includes(c.zoneStyle));
  const badRob = cards.filter(([, c]) => c.robberCall != null && !['auto', 'rob', 'overtop'].includes(c.robberCall));
  check('starter cards still carry zoneStyle values outside spot/balanced/match (fire/soft — inert)',
    badZone.length > 0, badZone.map(([b, c]) => `${b}/"${c.name}":${c.zoneStyle}`).join(', '));
  check('starter cards still carry robberCall values outside auto/rob/overtop (true — behaves as auto)',
    badRob.length > 0, badRob.map(([b, c]) => `${b}/"${c.name}":${c.robberCall}`).join(', '));
  const gd = cards.filter(([, c]) => c.greenDog === true);
  check('a starter card still carries greenDog:true that no compile path reads', gd.length > 0,
    gd.map(([b, c]) => `${b}/"${c.name}"`).join(', '));
}

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'}  (${pass} pass, ${fail} fail)`);
process.exit(fail ? 1 : 0);
