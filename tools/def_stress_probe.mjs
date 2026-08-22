// def_stress_probe.mjs — THE DEFENSIVE STRESS TEST (2026-08-18).
//
// Why this exists: the front-mix bug (fixed the same day) had a shape worth
// hunting for generally — a dial the coach can author, that the UI shows, that
// the book stores, and that NEVER REACHES THE FIELD. It survived because every
// probe asked "is the value stored correctly?" and none asked "does the game
// play differently?".
//
// So this probe asks only the second question. For each defensive dial it runs
// two seeded arms — the same games, the same rosters, the same RNG stream, one
// dial flipped between its extremes — and measures the outcome that dial is
// SUPPOSED to move. A dial that moves nothing is reported, and then it is a
// human call whether it is dead, mis-shaped, or simply weaker than it looks.
//
// Run: node tools/def_stress_probe.mjs [gamesPerArm]
import { ROSTER_TARGETS, CLASS_YEARS, C } from '../js/constants.js';
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart, defaultGameplan } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { applyDefBookToGameplan } from '../js/engine/defbook.js';
import { DEFAULT_DEF_BOOKS } from '../js/engine/defaultbooks.js';

// DEFAULT 10 GAMES PER ARM, and do not gate below it. At N=5 the cushion
// (press/off) and option-key arms flag FLAT on sample noise alone — they move
// 6.7pts and 0.21 ypc respectively at N=10. A probe that cries wolf gets
// ignored, which is worse than not having it (the covfam lesson: do not gate
// that one below N≈90 either).
const N = parseInt(process.argv[2] || '10', 10);
let flagged = 0, checked = 0;
const rows = [];

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
function genRoster(id) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], 1); p.schoolId = id; r.push(p); }
  }
  return r;
}
// The DEFENSE under test is the away team; the offense is fixed and neutral.
const OFF = { offFormation: 'Spread', offFormations: [{ id: 'Spread', weight: 60 }, { id: 'Single Back', weight: 40 }],
  tendency: 'Balanced', rushInPct: 55, passDepth: { short: 40, medium: 40, deep: 20 },
  fourthDown: 'Moderate', maxFGDist: 42 };

// 2026-08-22: the BOX arm needs a RUN offense. Against the neutral spread above
// it read "FLAT — 4.30 vs 4.34 ypc (Δ 0.04)" and had been doing so for a while,
// which is worse than no report: a false FLAT trains you to skim the list. The
// dial is fine. Measured against this offense at N=24, ypc runs monotonically
// 4.49 / 4.31 / 4.22 / 4.16 / 3.99 across runCommit -25/-8/0/+8/+25 — a clean
// half-yard gradient. A box dial can only be judged when someone is running.
const RUN_OFF = { offFormation: 'Power-I', offFormations: [{ id: 'Power-I', weight: 100 }],
  tendency: 'Heavy Run', rushInPct: 70, passDepth: { short: 45, medium: 35, deep: 20 },
  fourthDown: 'Moderate', maxFGDist: 42 };

const OPTION_OFF = { offFormation: 'Flexbone', offFormations: [{ id: 'Flexbone', weight: 70 }, { id: 'Wishbone', weight: 30 }],
  tendency: 'Heavy Run', rushInPct: 78, passDepth: { short: 50, medium: 35, deep: 15 },
  optionRate: 70, optionMix: { dive: 40, keep: 30, pitch: 30 }, pitchAggr: 55,
  fourthDown: 'Moderate', maxFGDist: 42 };
function play(defPatch, seed, offPlan) {
  Math.random = mulberry32(seed);
  try {
    const rH = genRoster('H'), rA = genRoster('A');
    const gpH = { ...(offPlan || OFF) };
    const gpA = { ...defaultGameplan(), ...defPatch };
    const res = simulateGame({ id: 'H' }, { id: 'A' }, rH, rA, buildDepthChart(rH, gpH), buildDepthChart(rA, gpA), gpH, gpA);
    const out = [];
    for (const d of res.drives || []) { if (d.possession !== 'home') continue; for (const p of d.plays || []) out.push(p); }
    return out;
  } finally { Math.random = realRandom; }
}
function sample(defPatch, seedBase, offPlan) {
  const all = [];
  for (let i = 0; i < N; i++) all.push(...play(defPatch, seedBase + i, offPlan));
  return all;
}
// ── the metrics a defensive dial might move ─────────────────────────────────
const M = {
  fronts: (ps) => { const c = {}; for (const p of ps) if (p.defFront) c[p.defFront] = (c[p.defFront] || 0) + 1; return c; },
  coverages: (ps) => { const c = {}; for (const p of ps) if (p.coverage) c[p.coverage] = (c[p.coverage] || 0) + 1; return c; },
  pressRate: (ps) => { const d = ps.filter(p => String(p.type || '').startsWith('pass')); return d.length ? d.filter(p => p.blitzFired || p.pressCall).length / d.length : 0; },
  sackRate: (ps) => { const d = ps.filter(p => String(p.type || '').startsWith('pass')); return d.length ? d.filter(p => p.sack).length / d.length : 0; },
  compPct: (ps) => { const d = ps.filter(p => String(p.type || '').startsWith('pass')); return d.length ? d.filter(p => p.complete).length / d.length : 0; },
  rushYPC: (ps) => { const r = ps.filter(p => String(p.type || '').startsWith('run')); return r.length ? r.reduce((s, p) => s + (p.yards || 0), 0) / r.length : 0; },
  explosive: (ps) => ps.length ? ps.filter(p => (p.yards || 0) >= 20).length / ps.length : 0,
  intRate: (ps) => { const d = ps.filter(p => String(p.type || '').startsWith('pass')); return d.length ? d.filter(p => p.turnoverType === 'INT' || (p.turnover && p.intPickerId)).length / d.length : 0; },
  spyUsed: (ps) => ps.filter(p => p.qbSpy || p.spy).length,
  greenDogs: (ps) => ps.filter(p => p.greenDog).length,
  rush3: (ps) => ps.filter(p => p.rush3).length,
  robber: (ps) => ps.filter(p => p._robber).length,
  pole: (ps) => ps.filter(p => p._pole).length,
  mug: (ps) => ps.filter(p => p.mug).length,
  fireZone: (ps) => ps.filter(p => p.fireZone).length,
  forcedFumbles: (ps) => ps.length ? ps.filter(p => p.ffId || p.turnoverType === 'FUM').length / ps.length : 0,
};
const COUNT_METRICS = new Set(['spyUsed', 'greenDogs', 'rush3', 'robber', 'pole', 'mug', 'fireZone']);
const dist = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' ') || '(none)';

function ab(label, patchA, patchB, metric, opts = {}) {
  checked++;
  const A = sample(patchA, 91000, opts.off), B = sample(patchB, 91000, opts.off);
  const va = M[metric](A), vb = M[metric](B);
  let moved, detail;
  if (typeof va === 'number') {
    const delta = Math.abs(va - vb);
    moved = delta >= (opts.min ?? 0.02);
    // COUNT metrics (snaps a thing happened) are not rates — printing them as
    // percentages produced "500.0%" and made a real signal look like garbage.
    const isCount = COUNT_METRICS.has(metric);
    if (isCount) { moved = va !== vb; detail = `${va} vs ${vb} snaps  (Δ ${delta})`; }
    else detail = `${(va * 100).toFixed(1)}% vs ${(vb * 100).toFixed(1)}%  (Δ ${(delta * 100).toFixed(1)}pts)`;
    if (metric === 'rushYPC') detail = `${va.toFixed(2)} vs ${vb.toFixed(2)} ypc  (Δ ${delta.toFixed(2)})`;
  } else {
    detail = `A[${dist(va)}]  B[${dist(vb)}]`;
    moved = JSON.stringify(va) !== JSON.stringify(vb);
  }
  if (!moved) flagged++;
  rows.push({ label, metric, moved, detail });
  console.log(`${moved ? 'MOVES ' : '⚠ FLAT'}  ${label.padEnd(46)} ${metric.padEnd(10)} ${detail}`);
}
console.log(`\n══ DEFENSIVE STRESS TEST — ${N} games per arm, seeded, same rosters ══\n`);

console.log('── the standing identity dials ──');
ab('base front 4-3 vs 46/Bear',        { defBaseFront: '4-3' }, { defBaseFront: '46/Bear' }, 'fronts');
ab('front mix (map, as a book stores it)', { defBaseFront: '4-3', defFrontMix: { '4-3': 100 } }, { defBaseFront: '4-3', defFrontMix: { 'Dime': 60, '4-3': 40 } }, 'fronts');
ab('sub philosophy base vs match',     { subPhilosophy: 'base' }, { subPhilosophy: 'match' }, 'fronts');
ab('aggression bend vs house',         { defAggression: 'bend' }, { defAggression: 'house' }, 'pressRate');
ab('pressure identity fireZone vs zero', { pressureIdentity: 'fireZone' }, { pressureIdentity: 'zero' }, 'pressRate');
ab('coverage shell single vs two',     { covShell: 'single' }, { covShell: 'two' }, 'coverages');
ab('coverage style man vs zone',       { covStyle: 'man' }, { covStyle: 'zone' }, 'coverages');
ab('coverage scheme lockTop vs bracketTop', { coverageScheme: 'lockTop' }, { coverageScheme: 'bracketTop' }, 'compPct');
ab('cushion press vs off',             { pressLevel: 'press' }, { pressLevel: 'off' }, 'compPct');
ab('box -25 vs +25 (vs a run offense)', { runCommit: -25 }, { runCommit: 25 }, 'rushYPC', { min: 0.15, off: RUN_OFF });
ab('edge discipline crash vs contain', { edgePlay: 'crash' }, { edgePlay: 'contain' }, 'rushYPC', { min: 0.10 });
ab('tackling wrap vs strip',           { tackleStyle: 'wrap' }, { tackleStyle: 'strip' }, 'forcedFumbles', { min: 0.004 });
ab('QB spy off vs on',                 { spyQB: false }, { spyQB: true }, 'compPct');
ab('green dog off vs on',              { greenDog: false }, { greenDog: true }, 'pressRate');
ab('zone teaching spot vs match',      { covStyle: 'zone', zoneStyle: 'spot' }, { covStyle: 'zone', zoneStyle: 'match' }, 'compPct');
// The robber only exists behind a TWO-HIGH shell (sim.js ~2757) — testing it
// off the default shell was a probe bug, not a product one.
ab('robber auto vs rob (two-high)',    { covShell: 'two', covStyle: 'zone', robberCall: 'auto' }, { covShell: 'two', covStyle: 'zone', robberCall: 'rob' }, 'robber');
ab('robber auto vs overtop (two-high)',{ covShell: 'two', covStyle: 'zone', robberCall: 'auto' }, { covShell: 'two', covStyle: 'zone', robberCall: 'overtop' }, 'robber');
// optionKey only means anything against an offense that RUNS the option.
ab('option key dive vs pitch (vs option)', { optionKey: 'dive' }, { optionKey: 'pitch' }, 'rushYPC', { min: 0.10, off: OPTION_OFF });

console.log('\n── the aggression ladder: the stop must order the pressure ──');
{
  // Measured BY LEVERAGE, because the aggregate hides the design: SELECTIVE is
  // documented as "a personality, not a low number" — it sits on early downs
  // and unloads on the obvious passing down (constants.js passDownMult 2.4 vs
  // balanced's 1.25). On aggregate rate alone selective and balanced are
  // indistinguishable (19.2% vs 19.3% measured), which reads like a dead stop
  // and is not one. This split is the honest test.
  const lev = {};
  for (const stop of C.AGGRESSION.order) {
    let eD = 0, eP = 0, pD = 0, pP = 0;
    for (const p of sample({ defAggression: stop, blitzPct: C.AGGRESSION.rate[stop] }, 97000)) {
      if (!String(p.type || '').startsWith('pass')) continue;
      const passDown = p.down >= 3 && p.distance >= 6;
      const fired = p.blitzFired || p.pressCall;
      if (passDown) { pD++; if (fired) pP++; } else { eD++; if (fired) eP++; }
    }
    lev[stop] = { early: eD ? eP / eD : 0, pass: pD ? pP / pD : 0 };
    console.log(`   ${stop.padEnd(10)} early ${(100 * lev[stop].early).toFixed(1).padStart(5)}%   passing ${(100 * lev[stop].pass).toFixed(1).padStart(5)}%`);
  }
  const mono = ['bend', 'selective', 'balanced', 'attacking', 'house'];
  let ok = true;
  for (let i = 1; i < mono.length; i++) if (lev[mono[i]].early < lev[mono[i - 1]].early - 0.02) ok = false;
  checked++; if (!ok) flagged++;
  rows.push({ label: 'aggression stops order the EARLY-down pressure', metric: 'ladder', moved: ok, detail: '' });
  console.log(`${ok ? 'ORDERED' : '⚠ BROKE'}  early-down pressure rises with the stop`);
  const personality = lev.selective.early < lev.balanced.early && lev.selective.pass > lev.balanced.pass;
  checked++; if (!personality) flagged++;
  rows.push({ label: 'SELECTIVE is a personality (quiet early, unloads late)', metric: 'ladder', moved: personality, detail: '' });
  console.log(`${personality ? 'KEPT   ' : '⚠ BROKE'}  selective sits BELOW balanced early and ABOVE it on passing downs`);
}

console.log('\n── THE SHIPPED BOOKS: does each one PLAY what it says? ──');
// This is the section the front-mix bug would have failed. A book is a promise
// — "I am a 3-4 that plays 40% Nickel and brings pressure" — and the only way
// to know it is kept is to play games and look at the field.
for (const book of DEFAULT_DEF_BOOKS) {
  const gp = applyDefBookToGameplan(book, defaultGameplan());
  const ps = sample(gp, 93000);
  const fronts = M.fronts(ps);
  const total = Object.values(fronts).reduce((a, b) => a + b, 0) || 1;
  const declared = Object.keys(book.frontMix || {});
  // every front the book declares should actually appear
  const missing = declared.filter((f) => !fronts[f]);
  checked++;
  const ok = missing.length === 0;
  if (!ok) flagged++;
  rows.push({ label: `book "${book.name}" plays every front it declares`, metric: 'fronts', moved: ok, detail: missing.join(',') });
  console.log(`${ok ? 'KEPT  ' : '⚠ BROKE'}  ${('book "' + book.name + '" — declares ' + declared.join('/')).padEnd(56)} played ${dist(fronts)}`);
  // the base front should lead (it is the identity), unless the mix says otherwise
  const top = Object.entries(fronts).sort((a, b) => b[1] - a[1])[0];
  const topDeclared = Object.entries(book.frontMix || {}).sort((a, b) => b[1] - a[1])[0];
  if (topDeclared && top && top[0] !== topDeclared[0]) {
    console.log(`         note: the book's heaviest front is ${topDeclared[0]} (${topDeclared[1]}) but ${top[0]} led the field at ${(100 * top[1] / total).toFixed(0)}% — situational subs outweigh the mix here`);
  }
  // aggression: a "house" book must bring more than a "bend" book
  const pr = M.pressRate(ps);
  console.log(`         aggression "${book.aggression}" → pressure on ${(pr * 100).toFixed(1)}% of dropbacks`);
}

console.log(`\n── summary: ${checked - flagged}/${checked} dials moved the game; ${flagged} FLAT ──`);
if (flagged) {
  console.log('\nFLAT dials (authored, shown, stored — but nothing changed):');
  for (const r of rows) if (!r.moved) console.log('   ⚠', r.label, '→', r.metric, r.detail);
  console.log('\nA flat dial is not automatically a bug: it may be a weak effect at this');
  console.log('sample size, or need a situation the neutral offense never creates. Each');
  console.log('one is a lead to chase by hand, which is exactly how the front mix was found.');
}

