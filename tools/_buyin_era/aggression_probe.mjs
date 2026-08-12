// aggression_probe.mjs — W4 gate: AGGRESSION DEFENSE + PROTECTION IDENTITY.
//   A. Translation law (pure): blitzPct → nearest stop (save migration);
//      the stop's rate flows through getEffectivePlan (+ weekly shift);
//      call rate is monotonic in the stop; SELECTIVE is a personality
//      (quiet early, unloads on passing downs); DC Blitz Design shifts
//      WHEN, not how much; the protection factor prices the §16.2 table
//      (quick beats the house on schedule, BOB loses to the fire zone).
//   B. Full games — rush counts by dial × situation (the wave's named gate):
//      blitz rate climbs stop by stop; Selective's pass-down spike dwarfs
//      the House's flat heat; The House sends more hats than backer heat;
//      identities put the right bodies in the rush (DB heat stamps, forced
//      fire-zone drops in a 4-3, AUTO = the front's signature package);
//      The House stamps the zero on the film.
//   C. Protection identity in-game: Max Protect chains the back to the
//      pocket, Quick Game releases him and flattens the route tree.
//   D. Sanity: migrated defaults keep the league in the sport (scores,
//      league blitz rate near the old 20% baseline); AI staffs still spend
//      timeouts coaching the clock.
// Run from repo root: node tools/aggression_probe.mjs [games-per-arm]
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame, pressureCallRate, protectionFactor } from '../js/engine/sim.js';
import { getEffectivePlan } from '../js/engine/situations.js';
import { FRONT_PRESSURE_SIGNATURE } from '../js/engine/formations.js';
import { ROSTER_TARGETS, CLASS_YEARS, C, aggrStopFromBlitzPct } from '../js/constants.js';

const N = parseInt(process.argv[2] || '14', 10);
let fail = 0;
const g = (n, ok, d = '') => { if (!ok) fail++; console.log(`${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`); };

// ═══ A. THE TRANSLATION LAW (pure) ═══════════════════════════════════════
{
  g('A1 save migration: blitzPct → nearest stop (the old landmarks land right)',
    aggrStopFromBlitzPct(20) === 'balanced' && aggrStopFromBlitzPct(undefined) === 'balanced'
    && aggrStopFromBlitzPct(10) === 'bend' && aggrStopFromBlitzPct(15) === 'selective'
    && aggrStopFromBlitzPct(38) === 'attacking' && aggrStopFromBlitzPct(45) === 'house'
    && aggrStopFromBlitzPct(0) === 'bend' && aggrStopFromBlitzPct(75) === 'house');

  const legacy = { blitzPct: 38, situations: {} };
  const eff = getEffectivePlan(legacy, null, 'base');
  g('A2 a legacy numeric plan resolves through the stop (rate mirrored to blitzPct)',
    eff.defAggression === 'attacking' && eff.blitzPct === C.AGGRESSION.rate.attacking,
    `stop=${eff.defAggression}, blitzPct=${eff.blitzPct}`);

  const cellPlan = { defAggression: 'bend', situations: { third_long: { defAggression: 'house' } } };
  const effCell = getEffectivePlan(cellPlan, null, 'third_long');
  const effBase = getEffectivePlan(cellPlan, null, 'base');
  g('A3 the situational cell owns its spot (bend base, house on 3rd & long)',
    effCell.defAggression === 'house' && effBase.defAggression === 'bend');

  const effWeekly = getEffectivePlan({ defAggression: 'balanced', situations: {} }, { blitzShift: 8 }, 'base');
  g('A4 the weekly shift still stacks on the stop\'s rate',
    effWeekly.blitzPct === C.AGGRESSION.rate.balanced + 8);

  const effProt = getEffectivePlan({ situations: { red_zone: { protIdentity: 'maxProtect' } } }, null, 'red_zone');
  const effProt0 = getEffectivePlan({ situations: {} }, null, 'base');
  g('A5 protection identity: Half-Slide default, cell-overridable (§16.2)',
    effProt0.protIdentity === 'halfSlide' && effProt.protIdentity === 'maxProtect');

  const r = (stop, lev = 'neutral', design = 50) => pressureCallRate({ stop, lev, design });
  const stops = C.AGGRESSION.order;
  const mono = stops.every((s, i) => i === 0 || r(s) > r(stops[i - 1]));
  g('A6 call rate climbs the dial stop by stop', mono,
    stops.map(s => `${s} ${(r(s) * 100).toFixed(0)}%`).join(' · '));

  const selRatio = r('selective', 'pass') / r('selective', 'early');
  const houseRatio = r('house', 'pass') / r('house', 'early');
  g('A7 Selective is a personality: quiet early, unloads on passing downs; the House doesn\'t care',
    selRatio > 3 && houseRatio < 1.5 && selRatio > houseRatio * 2,
    `selective ×${selRatio.toFixed(1)} vs house ×${houseRatio.toFixed(1)}`);

  g('A8 DC quality shifts WHEN: a sharp designer concentrates the heat into leverage downs',
    r('balanced', 'pass', 90) > r('balanced', 'pass', 10)
    && r('balanced', 'early', 90) < r('balanced', 'early', 10),
    `pass-down ${(r('balanced', 'pass', 10) * 100).toFixed(0)}→${(r('balanced', 'pass', 90) * 100).toFixed(0)}%, early ${(r('balanced', 'early', 10) * 100).toFixed(0)}→${(r('balanced', 'early', 90) * 100).toFixed(0)}%`);

  const pf = (protId, identity, playType = 'pass_medium', blitzFired = !!identity) =>
    protectionFactor({ protId, identity, playType, blitzFired });
  g('A9 §16.2 pricing: quick game beats the house on schedule, and pays for it deep',
    pf('quick', 'theHouse', 'pass_short') < 0.75 && pf('quick', null, 'pass_deep', false) > 1.1,
    `quick vs house short ${pf('quick', 'theHouse', 'pass_short').toFixed(2)}, quick deep ${pf('quick', null, 'pass_deep', false).toFixed(2)}`);
  g('A10 BOB owns the four-man rush and LOSES to the fire zone (its counter-victim)',
    pf('bob', null, 'pass_medium', false) < 1 && pf('bob', 'fireZone') > 1.2
    && pf('bob', 'fireZone') > pf('halfSlide', 'fireZone'),
    `bob 4-man ${pf('bob', null, 'pass_medium', false).toFixed(2)}, bob vs FZ ${pf('bob', 'fireZone').toFixed(2)}`);
  g('A11 Max Protect answers the secondary heat; Half-Slide stays the neutral baseline',
    pf('maxProtect', 'secondaryHeat') < 0.9 && Math.abs(pf('halfSlide', 'secondLevel') - 1) < 0.01);
}

// ═══ B/C/D. FULL GAMES ════════════════════════════════════════════════════
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
const mk = (o = {}) => ({ offFormations: [{ id: 'Spread', weight: 35 }, { id: 'Single Back', weight: 40 }, { id: 'Power-I', weight: 25 }],
  tendency: 'Balanced', rushInPct: 55, passDepth: { short: 40, medium: 40, deep: 20 },
  fourthDown: 'Moderate', baseTempo: 'Normal', maxFGDist: 42, ...o });
const sH = { id: 'H', name: 'H' }, sA = { id: 'A', name: 'A' };

function playArm(homeGP, awayGP, games = N) {
  const plays = []; let pts = 0, gCount = 0, toLogs = 0;
  for (let i = 0; i < games; i++) {
    const rH = genRoster(1, 'H'), rA = genRoster(1, 'A');
    const res = simulateGame(sH, sA, rH, rA, buildDepthChart(rH, mk()), buildDepthChart(rA, mk()), mk(homeGP), mk(awayGP));
    for (const d of (res.drives || [])) for (const p of (d.plays || [])) plays.push({ ...p, poss: d.possession });
    for (const line of (res.log || [])) if (String(line).includes('⏱️ Timeout')) toLogs++;
    pts += res.homeScore + res.awayScore; gCount++;
  }
  return { plays, avgTotal: pts / gCount, toLogs };
}
// Home team is the DEFENSE under test → measure the AWAY offense's dropbacks.
const oppDrops = (arm) => arm.plays.filter(p => p.poss === 'away' && String(p.type).startsWith('pass'));
const blitzRate = (arm, filter = () => true) => {
  const d = oppDrops(arm).filter(filter);
  return { n: d.length, rate: d.filter(p => p.blitzFired).length / Math.max(1, d.length) };
};

// B — rush counts by dial × situation.
const arms = {};
for (const stop of ['bend', 'balanced', 'house']) {
  arms[stop] = playArm({ defBaseFront: '4-3', defAggression: stop }, null);
}
{
  const rB = blitzRate(arms.bend), rM = blitzRate(arms.balanced), rH2 = blitzRate(arms.house);
  g('B1 the dial is the blitz rate: bend < balanced < house, in the film',
    rB.rate < rM.rate - 0.04 && rM.rate < rH2.rate - 0.10,
    `bend ${(rB.rate * 100).toFixed(0)}% < balanced ${(rM.rate * 100).toFixed(0)}% < house ${(rH2.rate * 100).toFixed(0)}% (n=${rB.n}/${rM.n}/${rH2.n})`);

  const sel = playArm({ defBaseFront: '4-3', defAggression: 'selective' }, null);
  const passDown = (p) => p.offSit === 'third_long' || p.offSit === 'second_long' || p.offSit === 'third_medium';
  const earlyDown = (p) => p.offSit === 'first_ten' || p.offSit === 'base';
  const sP = blitzRate(sel, passDown), sE = blitzRate(sel, earlyDown);
  const hP = blitzRate(arms.house, passDown), hE = blitzRate(arms.house, earlyDown);
  const selRatio = sP.rate / Math.max(0.01, sE.rate);
  const houseRatio = hP.rate / Math.max(0.01, hE.rate);
  g('B2 dial × situation: Selective\'s heat lives on passing downs; the House brings it any down',
    selRatio > 2 && selRatio > houseRatio * 1.5 && hE.rate > sE.rate + 0.15,
    `selective ${(sE.rate * 100).toFixed(0)}%→${(sP.rate * 100).toFixed(0)}% (×${selRatio.toFixed(1)}), house ${(hE.rate * 100).toFixed(0)}%→${(hP.rate * 100).toFixed(0)}% (×${houseRatio.toFixed(1)})`);

  // Identity shapes the rush COUNT: the zero out-numbers backer heat.
  const houseId = playArm({ defBaseFront: '4-3', defAggression: 'attacking', pressureIdentity: 'theHouse' }, null);
  const lbId    = playArm({ defBaseFront: '4-3', defAggression: 'attacking', pressureIdentity: 'secondLevel' }, null);
  const avgRush = (arm) => {
    const fired = oppDrops(arm).filter(p => p.blitzFired && p.rushN);
    return fired.reduce((s, p) => s + p.rushN, 0) / Math.max(1, fired.length);
  };
  g('B3 identity → rush count: The House sends more hats than backer heat',
    avgRush(houseId) > avgRush(lbId) + 0.6,
    `theHouse ${avgRush(houseId).toFixed(2)} vs secondLevel ${avgRush(lbId).toFixed(2)} rushers/fired snap`);

  const dbShare = (arm) => {
    const fired = oppDrops(arm).filter(p => p.blitzFired);
    return fired.filter(p => p.dbHeat).length / Math.max(1, fired.length);
  };
  const heat = playArm({ defBaseFront: '4-3', defAggression: 'attacking', pressureIdentity: 'secondaryHeat' }, null);
  g('B4 identity → who comes: secondary heat puts a DB in the rush; backer heat keeps them home',
    dbShare(heat) > 0.7 && dbShare(lbId) < 0.15,
    `DB in rush: secondaryHeat ${(dbShare(heat) * 100).toFixed(0)}% vs secondLevel ${(dbShare(lbId) * 100).toFixed(0)}%`);

  const zeroShare = oppDrops(houseId).filter(p => p.blitzFired && p.coverage === 'Cover 0').length
    / Math.max(1, oppDrops(houseId).filter(p => p.blitzFired).length);
  g('B5 The House stamps the zero on the film', zeroShare > 0.9,
    `${(zeroShare * 100).toFixed(0)}% of fired House calls read Cover 0`);

  const fz43 = playArm({ defBaseFront: '4-3', defAggression: 'attacking', pressureIdentity: 'fireZone' }, null);
  const fzShare = oppDrops(fz43).filter(p => p.blitzFired && p.fireZone).length
    / Math.max(1, oppDrops(fz43).filter(p => p.blitzFired).length);
  g('B6 fire zone from a 4-3: a shown rusher bails behind the call (borrowed heat still drops)',
    fzShare > 0.5, `${(fzShare * 100).toFixed(0)}% of fired calls dropped a lineman`);

  // AUTO identity follows the front ON THE FIELD (§2: fronts supply the
  // signatures — sub to Nickel on a passing down and the heat becomes the
  // 4-2-5's six-man zero; stay 3-4 and it's a fire zone).
  const auto34 = playArm({ defBaseFront: '3-4', defAggression: 'attacking' }, null);
  const calls = oppDrops(auto34).filter(p => p.blitzFired && p.pressCall && p.defFront);
  const fronts = new Set(calls.map(p => p.defFront));
  g('B7 AUTO identity = the signature package of the front on the field',
    calls.length > 20 && fronts.size >= 2
    && calls.every(p => p.pressCall === FRONT_PRESSURE_SIGNATURE[p.defFront]),
    `${calls.length} calls across ${[...fronts].join('/')} — every one its front's signature`);
}

// C — protection identity in-game (the away offense is under test now).
{
  const maxP  = playArm(null, { protIdentity: 'maxProtect' });
  const quick = playArm(null, { protIdentity: 'quick' });
  const kept = (arm) => {
    const d = oppDrops(arm).filter(p => p.rbKeptIn != null && !p.isScreen);
    return d.filter(p => p.rbKeptIn).length / Math.max(1, d.length);
  };
  g('C1 Max Protect chains the back to the pocket; Quick Game releases him',
    kept(maxP) > 0.9 && kept(quick) < 0.45,
    `back kept in: maxProtect ${(kept(maxP) * 100).toFixed(0)}% vs quick ${(kept(quick) * 100).toFixed(0)}%`);
  const deepShare = (arm) => {
    const d = oppDrops(arm);
    return d.filter(p => p.type === 'pass_deep').length / Math.max(1, d.length);
  };
  const half = playArm(null, { protIdentity: 'halfSlide' });
  g('C2 Quick Game caps depth: the deep ball thins out vs the half-slide baseline',
    deepShare(quick) < deepShare(half) * 0.75,
    `deep share: quick ${(deepShare(quick) * 100).toFixed(1)}% vs halfSlide ${(deepShare(half) * 100).toFixed(1)}%`);
  g('C3 the film knows the family (protId stamped on every dropback)',
    oppDrops(maxP).every(p => p.protId === 'maxProtect') && oppDrops(half).every(p => p.protId === 'halfSlide'));
}

// D — sanity on migrated defaults + the clock design.
{
  const base = playArm(null, null, Math.max(8, N));
  const r0 = blitzRate(base);
  g('D1 migrated defaults keep the league near the old 20% baseline',
    r0.rate > 0.12 && r0.rate < 0.34, `league blitz rate ${(r0.rate * 100).toFixed(0)}%`);
  g('D2 scores stay in the sport', base.avgTotal > 20 && base.avgTotal < 95,
    `avg total ${base.avgTotal.toFixed(1)}`);
  g('D3 AI staffs coach the clock (timeouts show up in the logs)',
    base.toLogs > 0, `${base.toLogs} AI timeouts across ${Math.max(8, N)} games`);
}

console.log(fail ? `❌ ${fail} FAILED` : '✅ W4 AGGRESSION GATE PASS');
process.exit(fail ? 1 : 0);
