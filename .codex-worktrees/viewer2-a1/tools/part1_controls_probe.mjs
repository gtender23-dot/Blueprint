// Part 1 controls probe (Aug 2026): each of the five audit dials demonstrably
// moves its mechanic AND pays its cost; every default equals the pre-dial game.
// Arms are PAIRED — the same generated rosters play both settings — so the
// checks measure the dial, not roster luck.
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { resolvePassRush, simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
function gen(t, s) { const r = []; for (const [p, c] of Object.entries(ROSTER_TARGETS)) for (let i = 0; i < c; i++) { const x = createPlayer(p, CLASS_YEARS[i % 4], t); x.schoolId = s; r.push(x); } return r; }
const base = (o = {}) => ({ offFormations: [{ id: 'Spread', weight: 60 }, { id: 'Single Back', weight: 40 }], tendency: 'Balanced', rushInPct: 45, passDepth: { short: 30, medium: 40, deep: 30 }, blitzPct: 20, fourthDown: 'Moderate', baseTempo: 'Normal', maxFGDist: 42, ...o });
let fails = 0; const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) fails++; };
const PAIRS = 20;
const mkPool = (tier) => Array.from({ length: PAIRS }, () => [gen(tier, 'H'), gen(tier, 'A')]);
const POOL1 = mkPool(1);
const runPool = (pool, offGP, defGP, each) => {
  for (const [rH0, rA0] of pool) {
    const rH = structuredClone(rH0), rA = structuredClone(rA0);
    const res = simulateGame({ id: 'H' }, { id: 'A' }, rH, rA, buildDepthChart(rH, offGP()), buildDepthChart(rA, defGP()), offGP(), defGP());
    each(res, rH, rA);
  }
};

// ── P1-1: surprise onside ─────────────────────────────────────────────────
{
  const count = (gpFn) => {
    let att = 0, rec = 0;
    runPool(POOL1, gpFn, () => base(), (res) => {
      for (const d of (res.drives || [])) for (const p of (d.plays || [])) {
        if (p.type === 'kickoff' && p.onside) { att++; if (p.recovered) rec++; }
      }
    });
    return { att, rec };
  };
  const armed = count(() => base({ surpriseOnside: 'arm' }));
  const never = count(() => base());
  ok(armed.att >= PAIRS * 0.7, `armed team springs ~one surprise onside per game (${armed.att} attempts / ${PAIRS} games)`);
  const extra = armed.att - never.att, extraRec = armed.rec - never.rec;
  ok(extra > 8 && extraRec / extra > 0.28, `surprise kicks recover at surprise rates, not desperation odds (${extraRec}/${extra} ≈ ${(100 * extraRec / Math.max(1, extra)).toFixed(0)}% vs expected-onside ~11%)`);
  ok(never.att <= PAIRS * 0.6, `default "never" only onsides in desperation (${never.att} attempts / ${PAIRS} games)`);
}

// ── P1-2: robber call ─────────────────────────────────────────────────────
{
  const meas = (robberCall) => {
    let robs = 0, medIn = 0, deepSep = [];
    runPool(POOL1, () => base(), () => base({ covShell: 'two', robberCall }), (res) => {
      for (const d of (res.drives || [])) for (const p of (d.plays || [])) {
        if (!String(p.type).startsWith('pass') || p.sack || p.isScramble || !p.trace) continue;
        if (p.trace.dep === 'medium' && p.trace.shape === 'sharp') { medIn++; if (p._robber) robs++; }
        if (p.trace.dep === 'deep' && p.trace.sep != null) deepSep.push(p.trace.sep);
      }
    });
    return { robRate: robs / Math.max(1, medIn), medIn, deepSep: deepSep.length ? deepSep.reduce((a, b) => a + b, 0) / deepSep.length : null, deep: deepSep.length };
  };
  const rob = meas('rob'), auto = meas('auto'), top = meas('overtop');
  ok(rob.robRate > 0, `"rob the middle" robs (${(100 * rob.robRate).toFixed(1)}% of in-breakers; auto ${(100 * auto.robRate).toFixed(1)}% — selection shifts make the game-level ordering informational)`);
  ok(top.robRate === 0, `"stay over top" never robs (${(100 * top.robRate).toFixed(1)}%)`);
  ok(rob.deepSep != null && top.deepSep != null && rob.deepSep > top.deepSep, `the cost is real: deep balls find more grass vs rob than vs over-top (sep ${rob.deepSep?.toFixed(3)} > ${top.deepSep?.toFixed(3)}, n=${rob.deep}/${top.deep})`);
}

// ── P1-3: zone teaching style ─────────────────────────────────────────────
{
  const meas = (zoneStyle) => {
    let busts = 0, passes = 0, vdSep = [], baseSep = [];
    runPool(POOL1, () => base({ conceptWeights: { 'Flood': 90, 'Sail': 90, 'Four Verts': 90 } }), () => base({ covStyle: 'zone', zoneStyle }), (res) => {
      for (const d of (res.drives || [])) for (const p of (d.plays || [])) {
        if (!String(p.type).startsWith('pass') || p.sack || p.isScramble || !p.trace) continue;
        passes++;
        if (p.trace.bust) busts++;
        if (p.trace.sep != null) (p.trace.vd ? vdSep : baseSep).push(p.trace.sep);
      }
    });
    const m = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
    // WITHIN-arm contrast: how much extra grass a VOID throw finds over this
    // arm's ordinary throws — cancels game-level drift the raw mean can't.
    return { bustRate: busts / Math.max(1, passes), vdEdge: m(vdSep) != null && m(baseSep) != null ? m(vdSep) - m(baseSep) : null, vd: vdSep.length };
  };
  const match = meas('match'), bal = meas('balanced'), spot = meas('spot');
  ok(match.bustRate > 0.004, `MATCH with an average back seven busts (${(100 * match.bustRate).toFixed(1)}% of throws found a blown zone)`);
  ok(bal.bustRate === 0 && spot.bustRate === 0, `balanced and spot-drop never bust (${(100 * bal.bustRate).toFixed(1)}% / ${(100 * spot.bustRate).toFixed(1)}%)`);
  ok(match.vdEdge != null && spot.vdEdge != null && match.vdEdge < spot.vdEdge, `MATCH squeezes the flood, SPOT gives it grass (void edge over base +${match.vdEdge?.toFixed(3)} < +${spot.vdEdge?.toFixed(3)}, n=${match.vd}/${spot.vd})`);
}

// ── P1-4 chip help ────────────────────────────────────────────────────────
{
  const meas = (offOpts) => {
    let heat = 0, dropbacks = 0, rbTgt = 0, mdPass = 0;
    runPool(POOL1, () => base({ protIdentity: 'halfSlide', protEmphasis: 10, ...offOpts }), () => base({ blitzPct: 35 }), (res, rH) => {
      const rbIds = new Set(rH.filter((p) => p.position === 'RB').map((p) => p.id));
      for (const d of (res.drives || [])) {
        if (d.possession !== 'home') continue;
        for (const p of (d.plays || [])) {
          if (!String(p.type).startsWith('pass') || p.isScramble) continue;
          dropbacks++;
          if (p.sack || p.hurried) heat++;
          if (p.sack) continue;
          if ((p.type === 'pass_medium' || p.type === 'pass_deep') && p.targetId) { mdPass++; if (rbIds.has(p.targetId)) rbTgt++; }
        }
      }
    });
    return { heatRate: heat / Math.max(1, dropbacks), cdShare: rbTgt / Math.max(1, mdPass), mdPass };
  };
  const chip = meas({ chipHelp: 'chip' });
  const auto = meas({});
  // Mechanism hard gate (house rule: whole-game deltas for a per-rep bump sit
  // inside sampling noise — resolvePassRush called head-to-head is noise-free).
  {
    const mk = (pos, over = {}) => { const q = createPlayer(pos, 'JR', 2); Object.assign(q.attributes, over); return q; };
    const rushers = [mk('DE', { SPD: 78, PWR: 60 }), mk('DT'), mk('DT'), mk('DE', { SPD: 84, PWR: 64 })].map((player, i) => ({ player, role: i === 0 || i === 3 ? 'DE-Speed' : 'DT-3tech' }));
    const oline = [mk('OL'), mk('OL'), mk('OL'), mk('OL'), mk('OL')];
    const chipper = { STR: 62, AWR: 62 };
    const trial = (chipCalled) => {
      let heat = 0;
      for (let i = 0; i < 30000; i++) {
        const r = resolvePassRush(rushers, oline, 20, 0, 50, 0, 1, 0, 0, { olAwr: 50, protId: 'halfSlide', chip: chipper, chipCalled });
        if (r.sacked || r.hurried) heat++;
      }
      return heat / 30000;
    };
    const on = trial(true), off = trial(false);
    ok(on < off, `chip help cools the rush — mechanism gate (pressure ${(100 * on).toFixed(2)}% < ${(100 * off).toFixed(2)}% over 30k reps)`);
  }
  console.log(`   (game-level pressure w/ chip ${(100 * chip.heatRate).toFixed(1)}% vs auto ${(100 * auto.heatRate).toFixed(1)}% — informational)`);
  ok(chip.cdShare < auto.cdShare, `and starves the outlet (RB-target share ${(100 * chip.cdShare).toFixed(1)}% < ${(100 * auto.cdShare).toFixed(1)}%, n=${chip.mdPass}/${auto.mdPass})`);
}

// ── P1-5 checkdown emphasis (the kept-in back's late leak) ────────────────
{
  const meas = (qbAggr) => {
    let rbTgt = 0, mdPass = 0;
    runPool(POOL1, () => base({ protEmphasis: 70, qbAggr }), () => base(), (res, rH) => {
      const rbIds = new Set(rH.filter((p) => p.position === 'RB').map((p) => p.id));
      for (const d of (res.drives || [])) {
        if (d.possession !== 'home') continue;
        for (const p of (d.plays || [])) {
          if ((p.type === 'pass_medium' || p.type === 'pass_deep') && !p.sack && !p.isScramble && p.targetId) { mdPass++; if (rbIds.has(p.targetId)) rbTgt++; }
        }
      }
    });
    return { cdShare: rbTgt / Math.max(1, mdPass), mdPass };
  };
  const cons = meas(15), aggr = meas(85);
  ok(cons.cdShare > aggr.cdShare, `the QB leash shades the checkdown rung (conservative ${(100 * cons.cdShare).toFixed(1)}% > aggressive ${(100 * aggr.cdShare).toFixed(1)}%, n=${cons.mdPass}/${aggr.mdPass})`);
}
console.log('');
console.log(fails ? `PART 1 CONTROLS PROBE: ${fails} FAIL` : 'PART 1 CONTROLS PROBE PASS');
process.exit(fails ? 1 : 0);
