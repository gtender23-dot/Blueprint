// off_stress_probe.mjs — THE OFFENSIVE STRESS TEST (2026-08-22).
//
// The twin of def_stress_probe, and it exists for the same reason: to ask the
// one question the other probes do not — DOES THE GAME PLAY DIFFERENTLY?
//
// The bug class is this project's most persistent: a dial the coach can author,
// that the UI shows and the book stores, which never reaches the field. The
// front-mix bug was one. `bringSeats` silently flattened by the headset was
// another — and it would have passed dead_surface_probe, because that probe
// checks whether a key APPEARS in engine code, and `bringSeats` appears
// everywhere. Presence is not effect. Only playing the game answers this.
//
// def_stress has covered the defensive dials since 2026-08-18. Until now nothing
// covered the 28 OFFENSIVE fields in PLAN_FIELD_SIDE.
//
// TWO RULES, both learned the hard way:
//
//  1. A FLAT dial is a LEAD, not a verdict. It may be a weak effect at this
//     sample size, or a dial that needs a situation this matchup never creates.
//     Chase it by hand — that is exactly how the front mix was found.
//
//  2. POINT THE ARM AT A DEFENSE THAT MAKES THE DIAL MATTER. def_stress spent
//     weeks reporting the BOX dial as dead (4.30 vs 4.34 ypc) because it tested
//     it against a neutral spread offense; against a run offense the same dial
//     moves half a yard per carry. A false FLAT is worse than no report — it
//     teaches you to skim the list. Every arm below names its defense when the
//     neutral one would not show the effect.
//
// Run from repo root: node tools/off_stress_probe.mjs [gamesPerArm]
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
import { mulberry32 } from './_seed.mjs';

const N = parseInt(process.argv[2] || '10', 10);
const realRandom = Math.random;
let checked = 0, flagged = 0;
const rows = [];

function genRoster(id) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], 1); p.schoolId = id; r.push(p); }
  }
  return r;
}

// The OFFENSE under test is the home team; the defense is fixed and neutral
// unless an arm names another.
const OFF = {
  offFormation: 'Spread',
  offFormations: [{ id: 'Spread', weight: 50 }, { id: 'Single Back', weight: 30 }, { id: 'Power-I', weight: 20 }],
  tendency: 'Balanced', rushInPct: 55, passDepth: { short: 40, medium: 40, deep: 20 },
  fourthDown: 'Moderate', maxFGDist: 42,
};
const DEF = { defBaseFront: '4-3', coverageScheme: 'balanced', defAggression: 'balanced',
  covShell: 'balanced', covStyle: 'balanced', fourthDown: 'Moderate', maxFGDist: 42 };
// A pass-rush-heavy look, for the protection dials — you cannot price pass
// protection against a defense that is not coming.
const HEAT_DEF = { ...DEF, defAggression: 'house', pressureIdentity: 'theHouse', blitzPct: 60 };
// A run-committed, crashing look, for the dials that read the defense's posture.
const CRASH_DEF = { ...DEF, runCommit: 20, edgePlay: 'crash', covShell: 'single' };

function play(offPatch, seed, defPlan) {
  Math.random = mulberry32(seed);
  try {
    const rH = genRoster('H'), rA = genRoster('A');
    // A patch may be a FUNCTION of the roster. Some dials are keyed by PLAYER ID
    // — rbCarryShares is read as rbShares[id] in sim.js:3421 — and the roster is
    // regenerated per game, so a literal { RB1: 95 } patch names nobody and the
    // arm reads FLAT for a dial that works. Found by this probe on itself.
    const dH = buildDepthChart(rH, OFF);
    const patch = typeof offPatch === 'function' ? offPatch(rH, dH) : offPatch;
    const gpH = { ...OFF, ...patch };
    const gpA = { ...DEF, ...(defPlan || {}) };
    const res = simulateGame({ id: 'H' }, { id: 'A' }, rH, rA,
      buildDepthChart(rH, gpH), buildDepthChart(rA, gpA), gpH, gpA);
    const out = [];
    for (const d of res.drives || []) { if (d.possession !== 'home') continue; for (const p of d.plays || []) out.push(p); }
    return out;
  } finally { Math.random = realRandom; }
}
function sample(offPatch, seedBase, defPlan) {
  const all = [];
  // Tag the game each play came from. Player-keyed metrics have to be measured
  // PER GAME and averaged — the roster is regenerated every game, so pooling
  // player ids across games dilutes any share to noise.
  for (let i = 0; i < N; i++) for (const p of play(offPatch, seedBase + i, defPlan)) { p._g = i; all.push(p); }
  return all;
}
function topShareByGame(ps, key, over) {
  const games = {};
  for (const p of ps.filter(over)) if (p[key] != null) ((games[p._g] = games[p._g] || {})[p[key]] ??= 0, games[p._g][p[key]]++);
  const shares = Object.values(games).map((o) => {
    const vs = Object.values(o), t = vs.reduce((a, b) => a + b, 0);
    return t ? Math.max(...vs) / t : 0;
  });
  return shares.length ? shares.reduce((a, b) => a + b, 0) / shares.length : 0;
}

const isRun = (p) => (p.type || '').startsWith('run');
const isPass = (p) => (p.type || '').startsWith('pass');
const scrim = (p) => isRun(p) || isPass(p);
const rate = (ps, f, over = scrim) => { const d = ps.filter(over); return d.length ? d.filter(f).length / d.length : 0; };
const dist = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}:${v}`).join(' ');
const tally = (ps, key, over = scrim) => { const o = {}; for (const p of ps.filter(over)) if (p[key] != null) o[p[key]] = (o[p[key]] || 0) + 1; return o; };
const topShare = (ps, key, over = scrim) => {
  const o = tally(ps, key, over); const vs = Object.values(o);
  const t = vs.reduce((a, b) => a + b, 0);
  return t ? Math.max(...vs) / t : 0;
};

const M = {
  passRate:    (ps) => rate(ps, isPass),
  insideShare: (ps) => rate(ps, (p) => p.type === 'run_inside', isRun),
  deepShare:   (ps) => rate(ps, (p) => p.type === 'pass_deep', isPass),
  aDOT:        (ps) => { const a = ps.filter((p) => isPass(p) && p.airYds != null); return a.length ? a.reduce((s, p) => s + p.airYds, 0) / a.length : 0; },
  rpoRate:     (ps) => rate(ps, (p) => !!p.rpo),
  rpoKeepRate: (ps) => rate(ps, (p) => !!p.rpoKept, (p) => !!p.rpo),
  qbRunRate:   (ps) => rate(ps, (p) => !!p.isQBDesignedRun),
  optionRate:  (ps) => rate(ps, (p) => p.optionPhase != null),
  pitchShare:  (ps) => rate(ps, (p) => p.optionPhase === 'pitch', (p) => p.optionPhase != null),
  jetRate:     (ps) => rate(ps, (p) => !!p.jetSweep),
  motionRate:  (ps) => rate(ps, (p) => !!p.motion),
  screenRate:  (ps) => rate(ps, (p) => !!p.isScreen),
  paRate:      (ps) => rate(ps, (p) => !!p.playAction, isPass),
  sackRate:    (ps) => rate(ps, (p) => !!p.sack, isPass),
  keptInRate:  (ps) => rate(ps, (p) => !!p.rbKeptIn, isPass),
  audibleRate: (ps) => rate(ps, (p) => !!p.audible),
  plays:       (ps) => ps.filter(scrim).length,
  // 2026-08-22: these two measure the SLOT the dial actually names. The first
  // cut pooled `rusherId`/`targetId` across games — but each game generates a
  // fresh roster, so pooling different players' ids diluted the share to noise
  // and both arms read 9.9%. The dial is keyed by slot (WR1/WR2/TE1/RB1 in
  // sim.js shareSlot), and the play record stamps carrierSlotId/targetSlotId, so
  // ask the question in the units the dial is written in. My arm was wrong, not
  // the dial — the same mistake def_stress made with the BOX.
  // rbCarryShares is keyed by PLAYER, so measure the player — per game, averaged.
  // Measuring the top SLOT instead read 69% vs 64.6%, moving the wrong way,
  // because the bell cow need not be the slot the previous arm was watching.
  rb1Share:    (ps) => topShareByGame(ps, 'rusherId', isRun),
  wr1Share:    (ps) => topShare(ps, 'targetSlotId', (p) => isPass(p) && p.targetSlotId != null),
  pressRate:   (ps) => rate(ps, (p) => !!p.sack || !!p.hurried, isPass),
  runDirs:     (ps) => tally(ps, 'runDir', isRun),
  formations:  (ps) => tally(ps, 'offFormation'),
  concepts:    (ps) => tally(ps, 'concept'),
  tempos:      (ps) => tally(ps, 'tempo'),
};
const COUNT_METRICS = new Set(['plays']);

function ab(label, patchA, patchB, metric, opts = {}) {
  checked++;
  const A = sample(patchA, 74000, opts.def), B = sample(patchB, 74000, opts.def);
  const va = M[metric](A), vb = M[metric](B);
  let moved, detail;
  if (typeof va === 'number') {
    const delta = Math.abs(va - vb);
    moved = delta >= (opts.min ?? 0.02);
    if (COUNT_METRICS.has(metric)) { moved = Math.abs(va - vb) >= (opts.min ?? 1); detail = `${va} vs ${vb} snaps  (Δ ${Math.abs(va - vb)})`; }
    else if (metric === 'aDOT') { moved = delta >= (opts.min ?? 0.5); detail = `${va.toFixed(2)} vs ${vb.toFixed(2)} air yds  (Δ ${delta.toFixed(2)})`; }
    else detail = `${(va * 100).toFixed(1)}% vs ${(vb * 100).toFixed(1)}%  (Δ ${(delta * 100).toFixed(1)}pts)`;
  } else {
    detail = `A[${dist(va)}]  B[${dist(vb)}]`;
    moved = JSON.stringify(va) !== JSON.stringify(vb);
  }
  if (!moved) flagged++;
  rows.push({ label, metric, moved, detail });
  console.log(`${moved ? 'MOVES  ' : '⚠ FLAT '} ${label.padEnd(46)} ${metric.padEnd(11)} ${detail}`);
}

console.log(`=== OFFENSIVE STRESS TEST — every dial between its extremes, ${N} games/arm ===\n`);

// ── the shape of the attack ────────────────────────────────────────────────
ab('tendency heavy run vs always pass',   { tendency: 'Heavy Run' }, { tendency: 'Always Pass' }, 'passRate', { min: 0.10 });
ab('rush inside 5% vs 95%',               { rushInPct: 5 }, { rushInPct: 95 }, 'insideShare', { min: 0.10 });
ab('pass depth quick vs shots',           { passDepth: { short: 80, medium: 15, deep: 5 } },
                                          { passDepth: { short: 15, medium: 30, deep: 55 } }, 'deepShare', { min: 0.10 });
ab('QB aggression 0 vs 100',              { qbAggr: 0 }, { qbAggr: 100 }, 'aDOT', { min: 0.5 });
ab('tempo chew vs hurry',                 { baseTempo: 'Chew' }, { baseTempo: 'Hurry' }, 'plays', { min: 20 });
ab('formation mix spread vs power',       { offFormations: [{ id: 'Spread', weight: 100 }] },
                                          { offFormations: [{ id: 'Power-I', weight: 100 }] }, 'formations');
ab('concept weights (Mesh 0 vs heavy)',   { conceptWeights: { Mesh: 0 } }, { conceptWeights: { Mesh: 400 } }, 'concepts');
ab('run direction left vs right',         { runDirection: { left: 80, middle: 10, right: 10 } },
                                          { runDirection: { left: 10, middle: 10, right: 80 } }, 'runDirs');

// ── the toy box ────────────────────────────────────────────────────────────
// RPO is gated by formation and concept, so even rpoRate:100 only reaches a few
// percent of snaps from a mixed book. A 5-point bar was measuring the gate, not
// the dial; 1.0% -> 5.3% is a 5x move. Ask from an RPO-friendly book and keep the
// bar in proportion.
ab('RPO rate 0 vs 100',                   { offFormations: [{ id: 'Spread', weight: 100 }], rpoRate: 0 },
                                          { offFormations: [{ id: 'Spread', weight: 100 }], rpoRate: 100 }, 'rpoRate', { min: 0.02 });
ab('RPO keep 0 vs 100',                   { offFormations: [{ id: 'Spread', weight: 100 }], rpoRate: 100, rpoKeepPct: 0 },
                                          { offFormations: [{ id: 'Spread', weight: 100 }], rpoRate: 100, rpoKeepPct: 100 }, 'rpoKeepRate', { min: 0.10 });
ab('QB run 0 vs 100',                     { qbRunPct: 0 }, { qbRunPct: 100 }, 'qbRunRate', { min: 0.03 });
ab('option rate 0 vs 100',                { offFormations: [{ id: 'Flexbone', weight: 100 }], optionRate: 0 },
                                          { offFormations: [{ id: 'Flexbone', weight: 100 }], optionRate: 100 }, 'optionRate', { min: 0.05 });
ab('option mix dive vs pitch',            { offFormations: [{ id: 'Flexbone', weight: 100 }], optionRate: 90, optionMix: { dive: 90, keep: 5, pitch: 5 } },
                                          { offFormations: [{ id: 'Flexbone', weight: 100 }], optionRate: 90, optionMix: { dive: 5, keep: 5, pitch: 90 } }, 'pitchShare', { min: 0.05 });
ab('jet rate 0 vs 100',                   { jetRate: 0 }, { jetRate: 100 }, 'jetRate', { min: 0.03 });
ab('motion 0 vs 100',                     { motionRate: 0 }, { motionRate: 100 }, 'motionRate', { min: 0.05 });
ab('screens 0 vs 100',                    { screenRate: 0 }, { screenRate: 100 }, 'screenRate', { min: 0.03 });
ab('play action 0 vs 100 (vs a crashing box)', { paRate: 0 }, { paRate: 100 }, 'paRate', { min: 0.10, def: CRASH_DEF });

// ── protection: priced against a defense that is actually coming ───────────
ab('protection slide vs max (vs the house)',  { protIdentity: 'halfSlide' }, { protIdentity: 'maxProtect' }, 'sackRate', { min: 0.02, def: HEAT_DEF });
// chipHelp is an ENUM ("chip"), not a 0-100 rate — sim.js reads `=== "chip"`.
// The first cut passed numbers and measured rbKeptIn, which is true on nearly
// every drop back regardless; both arms read 100%. Wrong value AND wrong metric.
ab('chip help auto vs chip (vs the house)',  { chipHelp: 'auto' }, { chipHelp: 'chip' }, 'pressRate', { min: 0.02, def: HEAT_DEF });
ab('protection emphasis 0 vs 100 (vs the house)', { protEmphasis: 0 }, { protEmphasis: 100 }, 'sackRate', { min: 0.02, def: HEAT_DEF });
// losFreedom is an ENUM — "never" / "auto" / "free" (gameplan.js:521 reads it as
// one). The first cut passed 0 and 100, which are neither, so both arms ran the
// default and read identical. My arm, not the dial.
ab('LOS freedom never vs free',           { losFreedom: 'never' }, { losFreedom: 'free' }, 'audibleRate', { min: 0.01 });

// ── who gets the ball ──────────────────────────────────────────────────────
ab('RB carry shares even vs bell cow',    (r, d) => ({ rbCarryShares: null }),
                                          (r, d) => { const rb = (d.RB || []).slice(0, 3);
                                            const m = {}; rb.forEach((id, i) => { m[id] = i === 0 ? 95 : 2; }); return { rbCarryShares: m }; },
                                          'rb1Share', { min: 0.05 });
ab('target shares even vs one star',      { targetShares: null }, { targetShares: { WR1: 70, WR2: 15, WR3: 15 } }, 'wr1Share', { min: 0.05 });

console.log(`\n── summary: ${checked - flagged}/${checked} dials moved the game; ${flagged} FLAT ──`);
if (flagged) {
  console.log('FLAT dials (authored, shown, stored — but nothing changed):');
  for (const r of rows) if (!r.moved) console.log('   ⚠', r.label, '→', r.metric, r.detail);
}
console.log('\nA flat dial is not automatically a bug: it may be a weak effect at this sample');
console.log('size, or need a defense this arm never fields. Each one is a lead to chase by');
console.log('hand — which is exactly how the front mix, and the BOX arm\'s false FLAT, were found.');
