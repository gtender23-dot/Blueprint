// dial_tradeoff_probe.mjs — W3 gate: COACHING POINTS resolve through the
// core law and every dial is a TRADEOFF, never a buff.
//   A. Resolution law (§1/§3b/§16.1, pure): player unlock → room → null;
//      capability scales the effect; low Buy-In flips it (the backfire);
//      the program meter blends into compliance; AI/old-save = null = zero.
//   B. Mechanics (Monte Carlo on the exposed contests): RB style tilts
//      truck↔evade; QB fight buys yards AND injuries, slide buys neither;
//      the diva QB coached to slide keeps fighting.
//   C. Full games: null dials → ZERO cp stamps (old behavior untouched);
//      dialed rooms stamp the film in the right direction; ears-back
//      penetrate out-TFLs two-gap; WR block motor moves perimeter yardage;
//      scores stay in the sport.
// Run from repo root: node tools/dial_tradeoff_probe.mjs [games-per-arm]
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame, coachPtLevel, coachPtEffect, setCoachPtCtx, _cpProbe } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS, C } from '../js/constants.js';

const N = parseInt(process.argv[2] || '16', 10);
let fail = 0;
const g = (n, ok, d = '') => { if (!ok) fail++; console.log(`${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`); };

// ═══ A. THE RESOLUTION LAW ═══════════════════════════════════════════════
const mkP = (pos, attrs = {}, buyIn = 75) => {
  const p = createPlayer(pos, 'JR', 1);
  Object.assign(p.attributes, attrs);
  p.buyIn = buyIn;
  delete p.coachPts;
  return p;
};

{
  const wr = mkP('WR', { STR: 85, PWR: 85 }, 85);
  g('A1 no dials anywhere → null (AI teams, old saves)',
    coachPtLevel(wr, {}, 'wrBlockMotor') === null
    && coachPtEffect(wr, null, 'wrBlockMotor') === null
    && Object.keys(C.COACH_PT_DIALS).every(d => coachPtEffect(wr, {}, d) === null));

  const plan = { roomPoints: { WR: { wrBlockMotor: 1 } } };
  const roomLvl = coachPtLevel(wr, plan, 'wrBlockMotor');
  wr.coachPts = { wrBlockMotor: -1 };
  const ownLvl = coachPtLevel(wr, plan, 'wrBlockMotor');
  delete wr.coachPts;
  g('A2 hierarchy: room applies, player unlock overrides it',
    roomLvl === 1 && ownLvl === -1);

  const frame  = coachPtEffect(mkP('WR', { STR: 88, PWR: 88 }, 85), plan, 'wrBlockMotor');
  const slight = coachPtEffect(mkP('WR', { STR: 32, PWR: 32 }, 85), plan, 'wrBlockMotor');
  g('A3 capability gates the effect (blocker frame ≫ slight frame)',
    frame.e > 0.5 && slight.e > 0 && frame.e > slight.e * 1.5,
    `frame e=${frame.e.toFixed(2)}, slight e=${slight.e.toFixed(2)}`);

  const diva = coachPtEffect(mkP('WR', { STR: 88, PWR: 88 }, 12), plan, 'wrBlockMotor');
  g('A4 the backfire: a checked-out star flips the instruction negative (§1)',
    diva.e < 0, `diva e=${diva.e.toFixed(2)}`);

  const soSo = mkP('WR', { STR: 88, PWR: 88 }, 50);
  const hot  = coachPtEffect(soSo, { ...plan, _programBuyIn: 95 }, 'wrBlockMotor');
  const cold = coachPtEffect(soSo, { ...plan, _programBuyIn: 12 }, 'wrBlockMotor');
  g('A5 the program meter blends into compliance (§16.1)',
    hot.e > cold.e, `bought-in room e=${hot.e.toFixed(2)}, broken room e=${cold.e.toFixed(2)}`);
}

// ═══ B. MECHANICS (Monte Carlo) ══════════════════════════════════════════
const MC = 30000;

// RB style: undialed he takes his better answer; coached he COMMITS to the
// coached one — style share moves, and committing to the wrong tool costs.
{
  const lb = mkP('LB', { STR: 60, PWR: 60, AGI: 60, SPD: 60, TEC: 55, AWR: 55 });
  const arm = (rb, roomVal) => {
    setCoachPtCtx(roomVal == null ? null : { roomPoints: { RB: { rbStyle: roomVal } } }, null);
    let breaks = 0, truck = 0;
    for (let i = 0; i < MC; i++) {
      const s = { style: null };
      if (_cpProbe.breaksTackle(rb, lb, s)) { breaks++; if (s.style === 'truck') truck++; }
    }
    setCoachPtCtx(null, null);
    return { rate: breaks / MC, truckShare: breaks ? truck / breaks : 0 };
  };
  // Each back's coached-into tool is his SECOND-best but still viable — the
  // dial should show in the film AND cost a little (the truly mismatched
  // monster who never shows up is A3/B2's low-cap story).
  const scat  = mkP('RB', { AGI: 85, SPD: 80, PWR: 72, STR: 72, AWR: 55, SEC: 60, TEC: 55 }, 85);
  const hammer = mkP('RB', { AGI: 72, SPD: 65, PWR: 85, STR: 85, AWR: 55, SEC: 60, TEC: 55 }, 85);
  const sBase = arm(scat, null), sNS = arm(scat, 1);
  const hBase = arm(hammer, null), hMM = arm(hammer, -1);
  g('B1 the dial moves the coached style into the film (both directions)',
    sNS.truckShare > sBase.truckShare + 0.10 && hMM.truckShare < hBase.truckShare - 0.10,
    `scat truck share ${(sBase.truckShare * 100).toFixed(0)}→${(sNS.truckShare * 100).toFixed(0)}%; hammer ${(hBase.truckShare * 100).toFixed(0)}→${(hMM.truckShare * 100).toFixed(0)}%`);
  g('B2 never a buff: coaching a back INTO his worse tool costs breaks',
    sNS.rate <= sBase.rate + 0.005 && hMM.rate <= hBase.rate + 0.005
    && (sNS.rate < sBase.rate || hMM.rate < hBase.rate),
    `scat ${(sBase.rate * 100).toFixed(1)}→${(sNS.rate * 100).toFixed(1)}%; hammer ${(hBase.rate * 100).toFixed(1)}→${(hMM.rate * 100).toFixed(1)}%`);
}

// QB in danger: fight buys yards AND injuries; slide buys neither.
// [W6 probe-stability fix — TEST ONLY, no game behaviour touched.] B4
// discriminates injury RATES around 0.3%, so the shared MC=30k sample gave
// each arm only ~90 events and the assertion failed on pure noise roughly one
// run in four. Measured truth is fight 0.49% / auto 0.31% / slide 0.20% — the
// claim is real, the sample was not. Eight times the draw makes it mean what
// it says (ratio noise drops from ~2σ-to-failure to ~4σ).
const MC_INJ = MC * 8;
{
  const qb = mkP('QB', { STR: 80, AWR: 70, TEC: 70, CON: 60 }, 85);
  const outcome = { tacklerId: 'x', yards: 6 };
  const arm = (roomVal, who = qb) => {
    setCoachPtCtx(roomVal == null ? null : { roomPoints: { QB: { qbInDanger: roomVal } } }, null);
    let yds = 0, inj = 0, slid = 0, fought = 0;
    for (let i = 0; i < MC_INJ; i++) {
      const r = _cpProbe.qbContactResult(who, outcome);
      yds += r.yards; if (r.qbInjured) inj++; if (r.slid) slid++; if (r.fought) fought++;
    }
    setCoachPtCtx(null, null);
    return { yds: yds / MC_INJ, inj: inj / MC_INJ, slid: slid / MC_INJ, fought: fought / MC_INJ };
  };
  const fight = arm(1), slide = arm(-1), auto = arm(null);
  g('B3 fight finds hidden yards; slide concedes them',
    fight.yds > auto.yds + 0.2 && slide.yds < auto.yds - 0.4,
    `yds/contact: slide ${slide.yds.toFixed(2)} · auto ${auto.yds.toFixed(2)} · fight ${fight.yds.toFixed(2)}`);
  g('B4 ...and the injury bill matches the style',
    fight.inj > auto.inj * 1.2 && slide.inj < auto.inj * 0.8,
    `inj/contact: slide ${(slide.inj * 100).toFixed(2)}% · auto ${(auto.inj * 100).toFixed(2)}% · fight ${(fight.inj * 100).toFixed(2)}%`);
  g('B5 film stamps tell the truth (fought only when coached to fight; slides when coached down)',
    fight.fought > 0.2 && auto.fought === 0 && slide.fought === 0 && slide.slid > auto.slid + 0.3);
  const divaQB = mkP('QB', { STR: 80, AWR: 70, TEC: 70, CON: 60 }, 10);
  const divaSlide = arm(-1, divaQB);
  g('B6 the diva coached to slide keeps fighting (§1 backfire, live in the contest)',
    divaSlide.fought > 0 && divaSlide.yds > slide.yds,
    `diva-slide yds ${divaSlide.yds.toFixed(2)} vs bought-in-slide ${divaSlide.yds > slide.yds ? '>' : '≤'} ${slide.yds.toFixed(2)}`);
}

// ═══ C. FULL GAMES ═══════════════════════════════════════════════════════
function genRoster(t, s, buyIn = null) {
  const r = [];
  for (const [pos, c] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < c; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], t);
      p.schoolId = s;
      if (buyIn != null) p.buyIn = buyIn;
      r.push(p);
    }
  }
  return r;
}
const mk = (o = {}) => ({ offFormations: [{ id: 'Spread', weight: 35 }, { id: 'Single Back', weight: 40 }, { id: 'Power-I', weight: 25 }],
  tendency: 'Balanced', rushInPct: 55, passDepth: { short: 40, medium: 40, deep: 20 },
  blitzPct: 25, fourthDown: 'Moderate', baseTempo: 'Normal', maxFGDist: 42, ...o });
const sH = { id: 'H', name: 'H' }, sA = { id: 'A', name: 'A' };

// One arm: N games, home team carrying the given plans/buyIn. Returns pooled
// play list + score tallies.
function playArm(homeGP, awayGP, homeBuyIn = null, games = N, mutate = null) {
  const plays = []; let pts = 0, gCount = 0;
  for (let i = 0; i < games; i++) {
    const rH = genRoster(1, 'H', homeBuyIn), rA = genRoster(1, 'A');
    if (mutate) mutate(rH);
    const res = simulateGame(sH, sA, rH, rA, buildDepthChart(rH, mk()), buildDepthChart(rA, mk()), mk(homeGP), mk(awayGP));
    for (const d of (res.drives || [])) for (const p of (d.plays || [])) plays.push({ ...p, poss: d.possession });
    pts += res.homeScore + res.awayScore; gCount++;
  }
  return { plays, avgTotal: pts / gCount };
}

// C1 — the null arm IS the old engine: no dials anywhere → zero stamps.
{
  const arm = playArm(null, null, null, Math.max(6, Math.floor(N / 2)));
  const stamped = arm.plays.filter(p => p.cp?.length || p.qbFought);
  g('C1 null dials → ZERO coaching stamps (defaults untouched, AI unchanged)',
    stamped.length === 0 && arm.plays.length > 500,
    `${arm.plays.length} plays, ${stamped.length} stamped`);
  g('C2 sanity: scores stay in the sport (null arm)',
    arm.avgTotal > 20 && arm.avgTotal < 95, `avg total ${arm.avgTotal.toFixed(1)}`);
}

// C3 — CB leverage: the room's cushion stamps the film in the right direction,
// and only when the room buys in.
{
  const press = playArm({ roomPoints: { CB: { cbLeverage: 1 } } }, null, 85, Math.max(4, Math.floor(N / 3)));
  const off   = playArm({ roomPoints: { CB: { cbLeverage: -1 } } }, null, 85, Math.max(4, Math.floor(N / 3)));
  const pStamps = press.plays.flatMap(p => p.cp || []).filter(s => s.d === 'cbLeverage');
  const oStamps = off.plays.flatMap(p => p.cp || []).filter(s => s.d === 'cbLeverage');
  g('C3 leverage dial sets the cushion and stamps it (press ↔ off)',
    pStamps.length > 20 && oStamps.length > 20
    && pStamps.every(s => s.e > 0) && oStamps.every(s => s.e < 0),
    `${pStamps.length} press stamps, ${oStamps.length} off stamps`);
  const mutiny = playArm({ roomPoints: { CB: { cbLeverage: 1 } } }, null, 8, Math.max(3, Math.floor(N / 5)));
  const mStamps = mutiny.plays.flatMap(p => p.cp || []).filter(s => s.d === 'cbLeverage');
  g('C4 a room that does not buy in ignores the call (comply gate)',
    mStamps.length === 0, `${mStamps.length} stamps from a broken room`);
}

// C5 — DE ears-back: penetrate LIVES IN THE BACKFIELD; the anchor turns
// penetrations into stalemates. Every dialed penetration stamps the film,
// so the stamp rate per defensive run snap IS the behavior. (TFL/yardage
// distributions are W10 rebalance territory; the wave gate pins direction.)
{
  // Same frame boost in BOTH arms: the probe measures the dial, not the men.
  const beef = (r) => r.filter(p => p.position === 'DE' || p.position === 'DT')
    .forEach(p => { p.attributes.AGI = 80; p.attributes.STR = 80; });
  const shoot  = playArm({ roomPoints: { DE: { deEarsBack: 1 },  DT: { deEarsBack: 1 } } },  null, 85, N, beef);
  const anchor = playArm({ roomPoints: { DE: { deEarsBack: -1 }, DT: { deEarsBack: -1 } } }, null, 85, N, beef);
  const penRate = (arm) => {
    const defRuns = arm.plays.filter(p => p.poss === 'away' && String(p.type).startsWith('run'));
    const pens = defRuns.flatMap(p => p.cp || []).filter(s => s.d === 'deEarsBack');
    return { rate: pens.length / Math.max(1, defRuns.length), pens };
  };
  const ps = penRate(shoot), pa = penRate(anchor);
  g('C5 ears-back shoots gaps the anchor refuses (penetrations per run snap)',
    ps.rate > pa.rate * 1.1,
    `penetrate ${ps.rate.toFixed(2)} vs two-gap ${pa.rate.toFixed(2)} per snap`);
  g('C6 penetrations stamp the film with the room\'s lean',
    ps.pens.length > 100 && ps.pens.every(s => s.e > 0) && pa.pens.every(s => s.e < 0),
    `${ps.pens.length} shoot / ${pa.pens.length} anchor stamps`);
}

// C7 — WR block motor: §1's founding example, pinned on the exact laneQuality
// term resolveRunPlay consumes (deterministic — no ypc noise), plus in-game
// film stamps from a real arm.
{
  const wrs = [mkP('WR', { STR: 85, PWR: 85 }, 90), mkP('WR', { STR: 85, PWR: 85 }, 90)];
  const offP = { WR: wrs.map(p => p.id) };
  const lane = (roomVal, roster = wrs) => {
    setCoachPtCtx(roomVal == null ? null : { roomPoints: { WR: { wrBlockMotor: roomVal } } }, null);
    const adj = _cpProbe.runLaneAdj(offP, roster, [], [], true, {});
    setCoachPtCtx(null, null);
    return adj;
  };
  const divas = wrs.map(p => { const q = mkP('WR', { STR: 85, PWR: 85 }, 10); q.id = p.id; return q; });
  const dLane = (() => {
    setCoachPtCtx({ roomPoints: { WR: { wrBlockMotor: 1 } } }, null);
    const adj = _cpProbe.runLaneAdj({ WR: divas.map(p => p.id) }, divas, [], [], true, {});
    setCoachPtCtx(null, null);
    return adj;
  })();
  g('C7 the founding example: throw-in springs the lane, stay-alive shrinks it, the diva room backfires',
    lane(1) > 0.05 && lane(-1) < -0.03 && lane(null) === 0 && dLane < 0,
    `throw-in ${lane(1).toFixed(3)} · auto 0 · stay-alive ${lane(-1).toFixed(3)} · diva room ${dLane.toFixed(3)}`);
  const frames = (r) => r.filter(p => p.position === 'WR')
    .forEach(p => { p.attributes.STR = 85; p.attributes.PWR = 85; });
  const throwIn = playArm({ roomPoints: { WR: { wrBlockMotor: 1 } } }, null, 90, Math.max(4, Math.floor(N / 3)), frames);
  const wStamps = throwIn.plays.flatMap(p => p.cp || []).filter(s => s.d === 'wrBlockMotor');
  g('C8 perimeter blocks stamp the film', wStamps.length > 20 && wStamps.every(s => s.e > 0),
    `${wStamps.length} stamps`);
}

// C9 — LB trigger: one dial, both prices. The run half pinned on the
// laneQuality term (downhill closes lanes, read-and-react concedes them);
// the pass half stamped on the play fakes it bites.
{
  const lbs = [mkP('LB', { SPD: 75, PWR: 75, AWR: 70 }, 85), mkP('LB', { SPD: 75, PWR: 75, AWR: 70 }, 85)];
  const trigLane = (roomVal) => {
    setCoachPtCtx(null, { roomPoints: { LB: { lbTrigger: roomVal } } });
    const adj = _cpProbe.runLaneAdj({}, [], lbs.map(p => p.id), lbs, false, {});
    setCoachPtCtx(null, null);
    return adj;
  };
  g('C9a downhill closes the lane; read-and-react concedes it',
    trigLane(1) < -0.01 && trigLane(-1) > 0.005,
    `downhill ${trigLane(1).toFixed(3)} vs read ${trigLane(-1).toFixed(3)}`);
  const downhill = playArm(null, { roomPoints: { LB: { lbTrigger: 1 }, OLB: { lbTrigger: 1 } } }, null);
  // Away defense dialed downhill: PA passes by the HOME offense should stamp.
  const tStamps = downhill.plays.filter(p => p.poss === 'home' && p.playAction)
    .flatMap(p => p.cp || []).filter(s => s.d === 'lbTrigger');
  // AI-side rosters carry no seeded buyIn (WE fallback), so an odd low-motor
  // LB group can flip a snap — the ROOM'S lean must still read downhill.
  g('C9 downhill trigger stamps the play fake it bites on',
    tStamps.length > 10 && tStamps.filter(s => s.e > 0).length >= tStamps.length * 0.9,
    `${tStamps.length} PA stamps, ${tStamps.filter(s => s.e > 0).length} downhill`);
}

console.log(fail ? `❌ ${fail} FAILED` : '✅ W3 DIAL-TRADEOFF GATE PASS');
process.exit(fail ? 1 : 0);
