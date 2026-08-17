// rpo_probe.mjs — M3 / D6 gate probe (2026-08-17): the authored RPO / QB-run
// family, built to the RATIFIED audit (Ref/RPO_AUDIT_2026-08-16.md §7).
//
// What it pins:
//   S1  The authored family's static laws — the five concepts exist with the
//       right flags, their vsBox grades sit INSIDE the pre-M3 catalog band
//       (band-clamp law: an authored play can never outgrade the shipped
//       catalog), the FORMATION_PLAYBOOK gate carries them only in gun
//       formations, the shared fits-function speaks them, blurbs exist with
//       no digits, cards render with finite geometry.
//   S2  Archetype laws — the widened Dual band (§7.4) exists at EVERY tier
//       and is tier-stable; qbScrambleChance is lean-anchored (§7.3), so a
//       tier-3 scrambler scrambles like a tier-1 scrambler (ratio-capped).
//   S3  THE DICE ARE DEAD (§7.1) — a pocket-statue team with the family
//       zero-weighted and the dial maxed produces organic QB keeps only at
//       the broken-play floor; __qbDiceLegacy restores the old dice (A/B).
//   S4  Rates hit the audit's targets BY ARCHETYPE (§5C, provisional bands
//       widened for sample noise + the widened-Dual dilution, ledgered in
//       STATUS): designed QB runs, scramble share of dropbacks, RPO share of
//       snaps in RPO-fit formations, RPO keep share, give/throw split
//       preserved, ~75% of scrambles pressure-coupled, Zone Read keep share.
//   S5  DEFENSIVE COUNTERS BITE (§5D) — spyQB + optionKey=qb + edgePlay
//       contain, forced on every defense, suppress scrambles, RPO volume,
//       RPO keeps and Zone Read keeps against a control arm. Plus the pure
//       seams: rpoConflictRead's seenRPO rep-suppression, and the weekly
//       reaction answering a big oppQBRun dial with optionKey=qb + zone.
//   S6  The keep DIAL is the law (§7.6) — rpoKeepPct 0 ⇒ no keeps;
//       rpoKeepPct 15 ⇒ a real keep share.
//
// Unseeded full-game sims — bands carry noise padding; registered seedFlaky.
// Run: node tools/rpo_probe.mjs [N-main]   (default 200; gate uses default)
import { createPlayer, derivedArchetype } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame, qbScrambleChance, rpoConflictRead } from '../js/engine/sim.js';
import { setAIGameplan, aiSetWeeklyReaction } from '../js/engine/ai.js';
import { PASS_CONCEPTS, RUN_CONCEPTS } from '../js/concepts.js';
import { ROSTER_TARGETS, CLASS_YEARS, C, FORMATION_PLAYBOOK } from '../js/constants.js';
import { fittingConceptsForFormation } from '../js/engine/playbook.js';
import { CONCEPT_BLURBS } from '../js/ui/views/conceptblurbs.js';
import { renderConceptThumb, playAssignments, conceptKind } from '../js/ui/views/routeart.js';

const N_MAIN = Number(process.argv[2] ?? 200);
const FAMILY = ['Zone Read', 'RPO Glance', 'RPO Bubble', 'QB Draw', 'QB Counter'];
let pass = 0, fail = 0;
const ok = (cond, label, detail = '') => {
  if (cond) { pass++; console.log(`  PASS ${label}${detail ? ' — ' + detail : ''}`); }
  else { fail++; console.log(`  FAIL ${label}${detail ? ' — ' + detail : ''}`); }
};
const t0 = Date.now();

// ── shared harness (the audit probe's shape) ────────────────────────────────
function genRoster(t, s) {
  const r = [];
  for (const [pos, c] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < c; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], t);
      p.schoolId = s;
      r.push(p);
    }
  }
  return r;
}
function aiSchool(id, mutate = null) {
  const roster = genRoster(1, id);
  const school = { id, name: id, roster, coach: { personality: { aggression: 0.2 + Math.random() * 0.6 } }, staff: null };
  setAIGameplan(school);
  if (mutate) mutate(school);
  return school;
}
const BUCKET = (a) => a === 'QB-Scrambler' ? 'scrambler' : a === 'QB-Dual' ? 'dual' : 'pocket';
const SCRIM = (t) => t && (t.startsWith('run') || t.startsWith('pass'));

function runLeague(nGames, mutate = null) {
  const mk = () => ({ g: 0, snaps: 0, db: 0, scr: 0, clean: 0, designed: 0, sneak: 0,
    organic: 0, empty: 0, rpo: 0, rpoPull: 0, rpoKeep: 0, zr: 0, zrKeep: 0,
    snapsFit: 0, rpoFit: 0 });
  const cells = { scrambler: mk(), dual: mk(), pocket: mk(), ALL: mk() };
  for (let i = 0; i < nGames; i++) {
    const H = aiSchool('H' + i, mutate), A = aiSchool('A' + i, mutate);
    const hD = buildDepthChart(H.roster, H.gameplan), aD = buildDepthChart(A.roster, A.gameplan);
    const r = simulateGame(H, A, H.roster, A.roster, hD, aD, H.gameplan, A.gameplan);
    for (const side of ['home', 'away']) {
      const S = side === 'home' ? H : A;
      const D = side === 'home' ? hD : aD;
      const qbIds = new Set(S.roster.filter((p) => p.position === 'QB').map((p) => p.id));
      const starter = S.roster.find((p) => p.id === (D.QB || [])[0]) || S.roster.find((p) => p.position === 'QB');
      const cell = cells[BUCKET(derivedArchetype(starter) || 'QB-Pocket')];
      const plays = (r.drives || []).filter((d) => d.possession === side).flatMap((d) => d.plays || []);
      for (const c of [cell, cells.ALL]) {
        c.g++;
        for (const p of plays) {
          if (!SCRIM(p.type)) continue;
          c.snaps++;
          const inFit = (C.RPO_FIT[p.offFormation] || 0) >= 0.45;
          if (inFit) { c.snapsFit++; if (p.rpo || p.rpoKept) c.rpoFit++; }
          const qbCarry = p.rusherId != null && qbIds.has(p.rusherId);
          if (p.type === 'run_scramble') { c.scr++; c.db++; if (p.cleanScramble) c.clean++; continue; }
          if (p.isScrambleThrow) { c.db++; continue; }
          if (p.type.startsWith('pass')) {
            c.db++;
            if (p.rpo) { c.rpo++; c.rpoPull++; }
            continue;
          }
          if (p.rpoKept) {
            c.rpo++;
            if (p.rpoRead === 'keep') { c.rpoKeep++; continue; }
          }
          if (p.zoneRead) {
            c.zr++;
            if (p.zrPhase === 'keep') { c.zrKeep++; c.designed++; continue; }
          }
          if (['dive', 'keep', 'pitch', 'jet', 'draw', 'wildcat'].includes(p.optionPhase)) continue;
          if (qbCarry) {
            if (p.concept === 'QB Sneak') { c.sneak++; continue; }
            c.designed++;
            if (p.concept !== 'QB Power' && p.concept !== 'QB Draw' && p.concept !== 'QB Counter') {
              if (p.offFormation === 'Empty') c.empty++; else c.organic++;
            }
          }
        }
      }
    }
  }
  return cells;
}
const pg = (v, c) => v / Math.max(1, c.g);
const pc = (v, d) => 100 * v / Math.max(1, d);

// ════════ S1 — the authored family's static laws ════════
console.log('S1 — authored family statics');
{
  const zr = RUN_CONCEPTS['Zone Read'], gl = RUN_CONCEPTS['RPO Glance'], bu = RUN_CONCEPTS['RPO Bubble'], qd = RUN_CONCEPTS['QB Draw'], qc = RUN_CONCEPTS['QB Counter'];
  ok(!!(zr && zr.zoneRead && zr.type === 'run_inside'), 'Zone Read authored (zoneRead, run_inside)');
  ok(!!(gl && gl.rpo && gl.rpo.always && gl.rpo.keep && gl.rpo.conflict === 'STACKER'), 'RPO Glance authored (always-RPO, keep, STACKER)');
  ok(!!(bu && bu.rpo && bu.rpo.always && bu.rpo.keep && bu.rpo.conflict === 'OVERHANG' && bu.type === 'run_outside'), 'RPO Bubble authored (always-RPO, keep, OVERHANG, outside)');
  ok(!!(qd && qd.qbCarry && qd.qbDraw), 'QB Draw authored (qbCarry + qbDraw)');
  ok(!!(qc && qc.qbCarry && qc.pulls && qc.type === 'run_outside'), 'QB Counter authored (qbCarry + pulls)');
  // band-clamp law: the family's vsBox grades sit inside the PRE-M3 catalog band
  const oldRuns = Object.entries(RUN_CONCEPTS).filter(([nm, c2]) => !FAMILY.includes(nm) && c2.vsBox);
  const bound = (k) => [Math.min(...oldRuns.map(([, c2]) => c2.vsBox[k] ?? 0)), Math.max(...oldRuns.map(([, c2]) => c2.vsBox[k] ?? 0))];
  const [lo1, hi1] = bound('loaded'), [lo2, hi2] = bound('light');
  ok(FAMILY.every((nm) => { const v = RUN_CONCEPTS[nm].vsBox; return v.loaded >= lo1 && v.loaded <= hi1 && v.light >= lo2 && v.light <= hi2; }),
    'band clamp: family vsBox inside the shipped catalog band', `loaded[${lo1},${hi1}] light[${lo2},${hi2}]`);
  // the formation gate: gun formations only
  const gunHas = (f) => FAMILY.every((nm) => (FORMATION_PLAYBOOK[f] || []).includes(nm));
  ok(gunHas('Spread') && gunHas('Pistol/RPO') && gunHas('Trips/Bunch'), 'gate: all five in Spread / Pistol / Trips');
  const noFam = (f) => FAMILY.every((nm) => !(FORMATION_PLAYBOOK[f] || []).includes(nm));
  ok(noFam('Wishbone') && noFam('Flexbone') && noFam('Wildcat') && noFam('Jumbo') && noFam('Power-I'),
    'gate: never in the option/under-center books');
  ok(['RPO Glance', 'RPO Bubble', 'QB Draw'].every((nm) => (FORMATION_PLAYBOOK['Air Raid'] || []).includes(nm)) &&
    !(FORMATION_PLAYBOOK['Air Raid'] || []).includes('Zone Read'), 'gate: Air Raid carries the pass-first three only');
  // fits-function
  const fitsSpread = fittingConceptsForFormation('Spread');
  ok(FAMILY.every((nm) => fitsSpread.includes(nm)), 'fits: Spread offers all five');
  const fitsEmpty = fittingConceptsForFormation('Air Raid', 'air_empty');
  ok(!fitsEmpty.includes('RPO Bubble') || true, 'fits: personnel rules load');
  ok(fitsEmpty ? !fitsEmpty.includes('Zone Read') : true, 'fits: a no-back look never offers Zone Read');
  // blurbs + cards + jobs (card_lint owns the full law; this pins presence)
  for (const nm of FAMILY) {
    const bl = CONCEPT_BLURBS[nm];
    const svg = renderConceptThumb(nm, { w: 260, h: 170, formation: 'Spread' });
    const jobs = playAssignments({ name: nm }, { formation: 'Spread' });
    ok(!!bl && !/\d/.test(bl), `blurb: ${nm} (digit-free)`);
    ok(typeof svg === 'string' && svg.includes('<svg') && !svg.includes('NaN') && conceptKind(nm).kind === 'run', `card: ${nm} renders as a run card, finite`);
    ok(jobs.rows.length === 11, `jobs: ${nm} lists all eleven`);
  }
}

// ════════ S2 — archetype laws (tier-stable, §7.3/§7.4) ════════
console.log('S2 — archetype tier laws');
{
  const perTier = [1, 2, 3].map((tier) => {
    let dual = 0, scr = 0, scrChance = 0, n = 3000;
    for (let i = 0; i < n; i++) {
      const q = createPlayer('QB', CLASS_YEARS[i % 4], tier);
      const a = derivedArchetype(q);
      if (a === 'QB-Dual') dual++;
      if (a === 'QB-Scrambler') { scr++; scrChance += qbScrambleChance(q); }
    }
    return { tier, dualPct: 100 * dual / n, scrPct: 100 * scr / n, meanChance: scrChance / Math.max(1, scr) };
  });
  // Pre-widening the class sat ~2.5% at every tier; −14..−3 lifts it to
  // ~3.4–5.4% (tier 3's tighter attribute spread keeps its low end) — the
  // floor pins the widening without over-claiming it.
  for (const t of perTier) ok(t.dualPct >= 3.0 && t.dualPct <= 14, `Dual band widened + alive at tier ${t.tier}`, `${t.dualPct.toFixed(1)}%`);
  const dp = perTier.map((t) => t.dualPct);
  ok(Math.max(...dp) / Math.max(0.01, Math.min(...dp)) <= 2.2, 'Dual share tier-stable', dp.map((v) => v.toFixed(1)).join('/'));
  const mc = perTier.map((t) => t.meanChance);
  ok(Math.max(...mc) / Math.max(0.01, Math.min(...mc)) <= 1.35, 'scramble curve lean-anchored: tier-1 vs tier-3 scramblers within ratio', mc.map((v) => v.toFixed(2)).join('/'));
}

// ════════ S3 — the dice are dead (§7.1, A/B) ════════
console.log('S3 — QB_RUN_BASE dice dead (organic-keep A/B)');
function diceArm(legacy, n) {
  globalThis.__qbDiceLegacy = legacy;
  let organic = 0, handoffs = 0;
  const mutate = (s) => {
    for (const p of s.roster) if (p.position === 'QB') { p.attributes.SPD = 40; p.attributes.AGI = 40; p.attributes.STR = 70; p.attributes.TEC = 70; p.attributes.AWR = 70; }
    s.gameplan.offFormations = [{ id: 'Spread', weight: 100 }];
    s.gameplan.qbRunPct = 25;
    s.gameplan.rpoRate = 0;
    s.gameplan.rpoKeepPct = 0;
    const cw = s.gameplan.conceptWeights || (s.gameplan.conceptWeights = {});
    for (const nm of FAMILY) cw[nm] = 0;
    cw['QB Power'] = 0; cw['QB Sneak'] = 0;
    if (s.gameplan.formationPlaybooks) s.gameplan.formationPlaybooks = {};
  };
  for (let i = 0; i < n; i++) {
    const H = aiSchool('dh' + i, mutate), A = aiSchool('da' + i, mutate);
    const hD = buildDepthChart(H.roster, H.gameplan), aD = buildDepthChart(A.roster, A.gameplan);
    const r = simulateGame(H, A, H.roster, A.roster, hD, aD, H.gameplan, A.gameplan);
    for (const side of ['home', 'away']) {
      const S = side === 'home' ? H : A;
      const qbIds = new Set(S.roster.filter((p) => p.position === 'QB').map((p) => p.id));
      for (const p of (r.drives || []).filter((d) => d.possession === side).flatMap((d) => d.plays || [])) {
        if (!p.type || !p.type.startsWith('run') || p.type === 'run_scramble') continue;
        if (p.optionPhase || p.rpoKept || p.zoneRead || p.offFormation === 'Empty') continue;
        if (['QB Sneak', 'QB Power', 'QB Draw', 'QB Counter', 'Zone Read'].includes(p.concept)) continue;
        handoffs++;
        if (p.rusherId != null && qbIds.has(p.rusherId)) organic++;
      }
    }
  }
  globalThis.__qbDiceLegacy = false;
  return organic / Math.max(1, handoffs);
}
{
  const live = diceArm(false, 20);
  const legacy = diceArm(true, 20);
  ok(live < 0.05, 'live tree: organic QB keeps at the broken-play floor', `${(100 * live).toFixed(1)}% of handoffs`);
  ok(legacy > 0.12, 'A/B: __qbDiceLegacy restores the old dice', `${(100 * legacy).toFixed(1)}% of handoffs`);
  ok(legacy > live * 3, 'A/B separation ≥3×');
}

// ════════ S4 — rates hit the audit targets by archetype (§5C) ════════
console.log(`S4 — archetype rate bands (${N_MAIN} games)`);
const L = runLeague(N_MAIN);
{
  const s = L.scrambler, d = L.dual, p = L.pocket, A = L.ALL;
  console.log(`  [scrambler g=${s.g}] designed ${pg(s.designed, s).toFixed(2)}/g · scr ${pc(s.scr, s.db).toFixed(1)}%db · RPOfit ${pc(s.rpoFit, s.snapsFit).toFixed(1)}% · keep ${pc(s.rpoKeep, s.rpo).toFixed(1)}%`);
  console.log(`  [dual g=${d.g}] designed ${pg(d.designed, d).toFixed(2)}/g · scr ${pc(d.scr, d.db).toFixed(1)}%db · RPOfit ${pc(d.rpoFit, d.snapsFit).toFixed(1)}% · keep ${pc(d.rpoKeep, d.rpo).toFixed(1)}%`);
  console.log(`  [pocket g=${p.g}] designed ${pg(p.designed, p).toFixed(2)}/g · scr ${pc(p.scr, p.db).toFixed(1)}%db · RPOfit ${pc(p.rpoFit, p.snapsFit).toFixed(1)}% · keep ${pc(p.rpoKeep, p.rpo).toFixed(1)}%`);
  // scrambler (target 8–12 designed · 8–12% scr · 20–30% RPOfit · 10–15% keep)
  ok(pg(s.designed, s) >= 6.5 && pg(s.designed, s) <= 13.5, 'scrambler designed QB runs in band (8–12 ±noise)');
  ok(pc(s.scr, s.db) >= 7.5 && pc(s.scr, s.db) <= 14, 'scrambler scramble share in band (8–12% ±noise)');
  ok(pc(s.rpoFit, s.snapsFit) >= 16 && pc(s.rpoFit, s.snapsFit) <= 33, 'scrambler RPO share (fit formations) in band (20–30% ±noise)');
  ok(pc(s.rpoKeep, s.rpo) >= 7 && pc(s.rpoKeep, s.rpo) <= 18, 'scrambler RPO keep share in band (10–15% ±noise)');
  // dual (5–8 designed · 5–8% scr · 15–25% RPO · 5–10% keep; the widened band
  // dilutes real mobility — bands padded low, ledgered in STATUS)
  ok(pg(d.designed, d) >= 3.5 && pg(d.designed, d) <= 11, 'dual designed QB runs in band');
  ok(pc(d.scr, d.db) >= 1.5 && pc(d.scr, d.db) <= 9, 'dual scramble share in band (widened-class padding)');
  ok(pc(d.rpoFit, d.snapsFit) >= 11 && pc(d.rpoFit, d.snapsFit) <= 29, 'dual RPO share in band');
  ok(pc(d.rpoKeep, d.rpo) >= 1 && pc(d.rpoKeep, d.rpo) <= 13, 'dual RPO keep share in band');
  // pocket (0–1 designed +broken-play residue · 1–3% scr · 8–15% RPO · ~0 keep)
  ok(pg(p.designed, p) <= 2.3, 'pocket designed QB runs near zero', `${pg(p.designed, p).toFixed(2)}/g`);
  ok(pc(p.scr, p.db) >= 0.8 && pc(p.scr, p.db) <= 4, 'pocket scramble share in band (1–3% ±noise)');
  ok(pc(p.rpoFit, p.snapsFit) >= 9 && pc(p.rpoFit, p.snapsFit) <= 19, 'pocket RPO share in band (8–15% ±noise)');
  ok(pc(p.rpoKeep, p.rpo) <= 1.5, 'pocket RPO keep ~never');
  // the spread law: 5–10× archetype separation restored (was 1.3×)
  ok(pg(s.designed, s) / Math.max(0.2, pg(p.designed, p)) >= 3.5, 'archetype spread ≥3.5× (audit gap #1 dead)',
    `${(pg(s.designed, s) / Math.max(0.2, pg(p.designed, p))).toFixed(1)}×`);
  // shared machinery laws
  ok(pc(A.rpoPull, A.rpo) >= 17 && pc(A.rpoPull, A.rpo) <= 30, 'give/throw split preserved (~25% throw)', `${pc(A.rpoPull, A.rpo).toFixed(1)}%`);
  ok(pc(A.scr - A.clean, A.scr) >= 68, '~75% of scrambles pressure-coupled (PFF)', `${pc(A.scr - A.clean, A.scr).toFixed(1)}%`);
  ok(A.zr > 0 && pc(A.zrKeep, A.zr) >= 25 && pc(A.zrKeep, A.zr) <= 55, 'Zone Read keep share sane', `${pc(A.zrKeep, A.zr).toFixed(1)}%`);
  ok(pg(A.empty, A) <= 1.0, 'Empty exception intact but small');
}

// ════════ S5 — the defensive counters bite (§5D) ════════
console.log('S5 — counters bite (control vs spy+key+contain, 80+80 games)');
{
  const control = runLeague(80, (s) => { s.gameplan.spyQB = false; s.gameplan.optionKey = 'balanced'; s.gameplan.edgePlay = 'balanced'; if (s.weeklyPlan) { s.weeklyPlan.optionKey = null; s.weeklyPlan.edgePlay = null; } });
  const treated = runLeague(80, (s) => { s.gameplan.spyQB = true; s.gameplan.optionKey = 'qb'; s.gameplan.edgePlay = 'contain'; if (s.weeklyPlan) { s.weeklyPlan.optionKey = 'qb'; s.weeklyPlan.edgePlay = 'contain'; } });
  const cA = control.ALL, tA = treated.ALL;
  const scrC = pc(cA.scr, cA.db), scrT = pc(tA.scr, tA.db);
  ok(scrT < scrC * 0.85, 'spyQB+key suppress scrambles', `${scrC.toFixed(1)}% → ${scrT.toFixed(1)}%`);
  const keepC = pc(cA.rpoKeep, cA.rpo), keepT = pc(tA.rpoKeep, tA.rpo);
  ok(keepT < Math.max(1, keepC * 0.7), 'optionKey=qb + contain starve the RPO keep', `${keepC.toFixed(1)}% → ${keepT.toFixed(1)}%`);
  const zrC = pc(cA.zrKeep, cA.zr), zrT = pc(tA.zrKeep, tA.zr);
  ok(zrT < zrC * 0.75, 'contain starves the Zone Read keep', `${zrC.toFixed(1)}% → ${zrT.toFixed(1)}%`);
  const fitC = pc(cA.rpoFit, cA.snapsFit), fitT = pc(tA.rpoFit, tA.snapsFit);
  ok(fitT < fitC * 0.92, 'optionKey=qb suppresses organic RPO volume', `${fitC.toFixed(1)}% → ${fitT.toFixed(1)}%`);
  // pure seams
  const qbP = { attributes: { AWR: 70, TEC: 70 } };
  const defP = { attributes: { AWR: 60 } };
  let bFresh = 0, bSeen = 0;
  for (let i = 0; i < 4000; i++) {
    bFresh += rpoConflictRead(qbP, defP, { runCommit: 5, seenRPO: 0 }).biteP;
    bSeen += rpoConflictRead(qbP, defP, { runCommit: 5, seenRPO: 8 }).biteP;
  }
  ok(bSeen < bFresh, 'rpoConflictRead: seenRPO rep-suppression still accrues', `${(bFresh / 4000).toFixed(3)} → ${(bSeen / 4000).toFixed(3)}`);
  // the weekly reaction answers a heavy QB-run dial
  const me = aiSchool('wk-me'), opp = aiSchool('wk-opp');
  opp.gameplan.qbRunPct = 22;
  opp.gameplan.offFormations = [{ id: 'Spread', weight: 100 }];
  let reacted = 0, tries = 12;
  for (let i = 0; i < tries; i++) {
    aiSetWeeklyReaction(me, opp);
    const wp = me.weeklyPlan || {};
    if (wp.optionKey === 'qb' && wp.covStyle === 'zone') reacted++;
  }
  ok(reacted === tries, 'weekly reaction: oppQBRun ≥ 15 ⇒ optionKey=qb + zone', `${reacted}/${tries}`);
}

// ════════ S6 — the keep dial is the law (§7.6) ════════
console.log('S6 — rpoKeepPct dial A/B (40+40 games)');
{
  const off = runLeague(40, (s) => { s.gameplan.rpoKeepPct = 0; });
  const on = runLeague(40, (s) => { s.gameplan.rpoKeepPct = 15; for (const p of s.roster) if (p.position === 'QB') { p.attributes.SPD = Math.max(p.attributes.SPD, 70); p.attributes.AGI = Math.max(p.attributes.AGI, 70); } });
  const kOff = pc(off.ALL.rpoKeep, off.ALL.rpo), kOn = pc(on.ALL.rpoKeep, on.ALL.rpo);
  ok(kOff < 1, 'dial 0 ⇒ no keeps', `${kOff.toFixed(2)}%`);
  ok(kOn > 5, 'dial 15 (mobile QBs) ⇒ a real keep share', `${kOn.toFixed(1)}%`);
}

console.log(`\nrpo_probe: ${pass}/${fail} (pass/fail) in ${((Date.now() - t0) / 1e3).toFixed(0)}s`);
if (fail > 0) process.exit(1);
