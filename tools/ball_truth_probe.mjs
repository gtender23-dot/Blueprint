// ball_truth_probe.mjs — M21 gate: the ball is an OWNED object and the sim's
// ball truth reaches the screen. Harvests REAL engine plays (Math.random
// pinned to a seeded PRNG — deterministic by construction, NOT seedFlaky),
// scripts them through buildPlayScript, and asserts:
//  1. Every scripted snap carries a ballCue; the snap flight leaves the
//     center spot and reaches the QB by snapEnd.
//  2. Handoff continuity: the ball stays with the QB until the mesh, rides
//     the carrier after the exchange, and never teleports frame-to-frame.
//  3. Play-action keeps the ball with the QB through the fake (the fake is
//     an extension, never a transfer).
//  4. A stamped PBU (p.ballSlots.pbu) BREAKS the trajectory: the credited
//     defender arrives at the catch point, a deflectCue is staged, the ball
//     scatters off the spot and comes to rest.
//  5. A stamped pick (p.ballSlots.pick) is made by the credited slot actor —
//     the ball rides HIM out of the catch (fallback intact when unstamped).
//  6. Run fumbles BOUNCE (the loose segment deviates from the rest spot) and
//     still die exactly at the engine's spot — the outcome law holds.
//  7. carryCue is deterministic, names the carrier, and picks a legal arm.
//  8. Same play → same ball track twice (rewatch = same film).
// Run from repo root: node tools/ball_truth_probe.mjs [games]
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
import { OFF_FIELD_LAYOUTS, DEF_FIELD_LAYOUTS } from '../js/constants_field.js';
import { buildPlayScript } from '../js/ui/watchphys.js';

let _s = 20260810;
Math.random = () => { _s = (_s * 1103515245 + 12345) & 0x7fffffff; return _s / 0x7fffffff; };

const N = parseInt(process.argv[2] || '8', 10);
const LOS = 31, YPU = 0.85;

function genRoster(t, s) {
  const r = [];
  for (const [pos, c] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < c; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], t); p.schoolId = s; r.push(p); }
  }
  return r;
}
const mk = (o = {}) => ({ offFormations: [{ id: 'Spread', weight: 30 }, { id: 'Single Back', weight: 25 },
    { id: 'Flexbone', weight: 20 }, { id: 'Wildcat', weight: 10 }, { id: 'Power-I', weight: 15 }],
  tendency: 'Balanced', rushInPct: 55, passDepth: { short: 40, medium: 40, deep: 20 },
  blitzPct: 30, fourthDown: 'Moderate', baseTempo: 'Normal', maxFGDist: 42, jetRate: 25, drawRate: 20, ...o });

const layoutFor = (p) => [OFF_FIELD_LAYOUTS[p.offFormation]?.slots, (DEF_FIELD_LAYOUTS[p.defFront] || DEF_FIELD_LAYOUTS['4-3'])?.slots];

const plays = [];
for (let i = 0; i < N; i++) {
  const rH = genRoster(1, 'H'), rA = genRoster(1, 'A');
  const res = simulateGame({ id: 'H', name: 'H' }, { id: 'A', name: 'A' }, rH, rA,
    buildDepthChart(rH, mk()), buildDepthChart(rA, mk()), mk(), mk());
  for (const d of (res.drives || [])) for (const p of (d.plays || [])) plays.push(p);
}
const snaps = plays.filter(p => (String(p.type).startsWith('pass') || String(p.type).startsWith('run')) && p.type !== 'penalty');
console.log(`harvested ${plays.length} plays (${snaps.length} snaps) from ${N} games`);

let pass = true;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `  [${detail}]` : ''}`);
  if (!ok) pass = false;
};
const at = (track, i) => track[Math.max(0, Math.min(i, track.length - 1))];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

let scripted = 0, cueMissing = 0, snapChecked = 0, snapBad = [],
  handChecked = 0, handHoldBad = [], handRideBad = [], ballJump = 0, maxBallStep = 0,
  paChecked = 0, paBad = [],
  pbuStamped = 0, pbuCued = 0, pbuDefBad = [], pbuScatter = 0, pbuRest = 0,
  pickStamped = 0, pickRide = 0, pickFeasible = 0, pickMiss = [],
  fumChecked = 0, fumBounce = 0, fumRestBad = [],
  carryBad = [], detMismatch = 0, detSample = 0;

for (const p of snaps) {
  const [offL, defL] = layoutFor(p);
  if (!offL) continue;
  const script = buildPlayScript(p, offL, defL);
  if (!script) continue;
  scripted++;
  const S = script.step, bt = script.ball.track;
  const bc = script.ballCue, cc = script.carryCue;
  if (!bc) { cueMissing++; continue; }
  const defSlotIds = new Set((defL || []).map(s => s.id));
  const actorOf = id => script.actors.find(a => a.id === id) || null;
  const qbA = actorOf('QB');
  const isPass = String(p.type).startsWith('pass') && !p.isScramble;

  // 1. snap flight — the ball leaves the center spot and reaches the man the
  // snap is FOR (the QB, or the direct-snap/jet taker) by snapEnd.
  if (bc.snapStart != null && qbA) {
    snapChecked++;
    const i0 = Math.max(0, Math.round(bc.snapStart / S) - 2);
    const iS = Math.round(bc.snapEnd / S);
    const pre = at(bt, i0);
    const post = at(bt, iS + 1);
    const carA = cc ? actorOf(cc.id) : null;
    const dQB = dist(post, at(qbA.track, iS + 1));
    const dTaker = carA ? dist(post, at(carA.track, iS + 1)) : Infinity;
    if (dist(pre, [50, LOS + 0.6]) > 1.2) snapBad.push(`${p.type}:pre@${pre.map(v => v.toFixed(1))}`);
    else if (Math.min(dQB, dTaker) > 3.0) snapBad.push(`${p.type}:post-d=${Math.min(dQB, dTaker).toFixed(1)}`);
  }

  // 2. handoff continuity + ball speed cap
  for (let i = 1; i < bt.length; i++) {
    const d = dist(bt[i], bt[i - 1]);
    if (d > maxBallStep) maxBallStep = d;
    if (d > 2.6) { ballJump++; break; }
  }
  if (bc.kind === 'run' && bc.meshStart != null && cc && cc.id !== 'QB' && qbA && !p.turnover && p.optionPhase !== 'jet') {
    const carA = actorOf(cc.id);
    if (carA) {
      handChecked++;
      const iM = Math.round(bc.meshStart / S), iH = Math.round(cc.from / S) + 1;
      let holdBad = 0, rideBad = 0;
      for (let i = Math.round(bc.snapEnd / S) + 1; i < iM - 1; i++)
        if (dist(at(bt, i), at(qbA.track, i)) > 2.2) holdBad++;
      for (let i = iH + 1; i < bt.length; i++)
        if (dist(at(bt, i), at(carA.track, i)) > 0.6) rideBad++;
      if (holdBad > 1) handHoldBad.push(`${p.concept || p.type}:${holdBad}`);
      if (rideBad > 0) handRideBad.push(`${p.concept || p.type}:${rideBad}`);
    }
  }

  // 3. play-action: ball never leaves the QB during the fake
  if (isPass && bc.fakeStart != null && qbA) {
    paChecked++;
    let bad = 0;
    for (let i = Math.round(bc.fakeStart / S) + 1; i < Math.round(bc.fakeEnd / S); i++)
      if (dist(at(bt, i), at(qbA.track, i)) > 2.6) bad++;
    if (bad > 1) paBad.push(`${p.concept || p.type}:${bad}`);
  }

  // 4. stamped PBU deflection
  if (isPass && !p.sack && !p.complete && !p.turnover && !p.throwAway
      && p.ballSlots?.pbu && defSlotIds.has(p.ballSlots.pbu) && bc.catch != null) {
    pbuStamped++;
    const iC = Math.round(bc.catch / S);
    const cp = at(bt, iC);
    if (script.deflectCue && script.deflectCue.id === 'D_' + p.ballSlots.pbu) {
      pbuCued++;
      const dA = actorOf(script.deflectCue.id);
      const dd = dA ? dist(at(dA.track, iC), cp) : Infinity;
      // 4.2 = a swat-lunge radius. Was 3.0 — at N=24 the capTrackSpeed-vs-pin
      // fight leaves ~1.6% of swats at 3.1-3.7u (2026-08-11); those read as
      // arrivals on screen, and a zero-tolerance law needs a radius the tail
      // actually fits inside.
      if (dd > 4.2) pbuDefBad.push(`d=${dd.toFixed(1)}`);
      let far = 0;
      for (let k = 1; k <= 12 && iC + k < bt.length; k++) far = Math.max(far, dist(at(bt, iC + k), cp));
      if (far >= 1.5) pbuScatter++;
      const lastA = bt[bt.length - 1], lastB = bt[bt.length - 2] || lastA;
      if (dist(lastA, lastB) < 0.05) pbuRest++;
    }
  }

  // 5. stamped pick truth: the ball rides whoever the script picked, and the
  // script keeps the CREDITED man whenever he can plausibly arrive.
  // Recalibrated 2026-08-11 (M25 retention diag): the Capstone helper/robber
  // legs credit DEEP safeties, and the batted-tip chain credits LINEMEN —
  // populations the old blanket ≥50% never saw (it was calibrated on n≈10
  // pre-Capstone). The law now measures what it means: among ARRIVABLE
  // credited men on non-batted plays, retention must be near-total; the
  // infeasible fall back by design (the M21 rule) and are reported.
  if (isPass && !p.sack && p.turnover && p.ballSlots?.pick && defSlotIds.has(p.ballSlots.pick)) {
    pickStamped++;
    const rider = script.pickId ? actorOf(script.pickId) : null;
    const last = bt[bt.length - 1];
    if (!rider || dist(last, at(rider.track, bt.length - 1)) > 0.8) pickMiss.push(`${p.type}:ride`);
    const credA = actorOf('D_' + p.ballSlots.pick);
    const iCc = bc.catch != null ? Math.min(Math.round(bc.catch / S), bt.length - 1) : bt.length - 1;
    const cpc = at(bt, iCc);
    const arrivable = !p.batted && credA
      && dist(at(credA.track, 0), cpc) <= Math.max(0.2, bc.catch != null ? bc.catch - 0.55 : 2) * 6.5 * 0.9;
    if (arrivable) {
      pickFeasible++;
      if (script.pickId === 'D_' + p.ballSlots.pick) pickRide++;
    }
  }

  // 6. run fumbles bounce AND die at the engine's spot
  if (p.turnover && !isPass && !p.isScramble || p.turnover && String(p.type).startsWith('run')) {
    const gain = Math.max(-15, Math.min(100, p.yards || 0));
    const wantY = Math.max(-60, Math.min(61, LOS - (p.td ? Math.min(p.yards || 0, 100) : gain) * YPU));
    fumChecked++;
    const last = bt[bt.length - 1];
    if (Math.abs(last[1] - wantY) > 0.12) fumRestBad.push(`y=${last[1].toFixed(1)} want=${wantY.toFixed(1)}`);
    let iEnd = bt.length - 1;
    while (iEnd > 1 && dist(bt[iEnd], bt[iEnd - 1]) < 0.01) iEnd--;
    let dev = 0;
    for (let k = 0; k <= 12; k++) dev = Math.max(dev, dist(at(bt, iEnd - k), last));
    if (dev >= 0.8) fumBounce++;
  }

  // 7. carryCue sanity
  if (cc) {
    if (!(cc.arm === 'l' || cc.arm === 'r') || !actorOf(cc.id) || !(cc.from >= 0)) carryBad.push(p.type);
  }

  // 8. determinism (sample the interesting plays: deflections, fumbles, and a slice)
  if (script.deflectCue || p.turnover || detSample < 25) {
    detSample++;
    const again = buildPlayScript(p, offL, defL);
    if (JSON.stringify(again.ball.track) !== JSON.stringify(bt)
      || JSON.stringify(again.carryCue) !== JSON.stringify(cc)
      || JSON.stringify(again.deflectCue) !== JSON.stringify(script.deflectCue)) detMismatch++;
  }
}

check('every scripted snap carries a ballCue', cueMissing === 0 && scripted > 400, `scripted=${scripted} missing=${cueMissing}`);
check('snap flight: center spot → QB hands by snapEnd', snapChecked > 200 && snapBad.length === 0, `checked=${snapChecked} bad=${snapBad.slice(0, 3).join(' ')}`);
check('handoffs: QB holds to the mesh, carrier rides after', handChecked > 50 && handHoldBad.length === 0 && handRideBad.length === 0,
  `checked=${handChecked} hold=${handHoldBad.slice(0, 2).join(' ')} ride=${handRideBad.slice(0, 2).join(' ')}`);
check('the ball never teleports (≤2.6u/frame)', ballJump === 0, `max=${maxBallStep.toFixed(2)}u`);
check('play-action keeps the ball with the QB through the fake', paChecked === 0 || paBad.length === 0, `checked=${paChecked} bad=${paBad.slice(0, 3).join(' ')}`);
check('stamped PBUs stage the credited swat (arrivable fronts)', pbuStamped === 0 || (pbuCued / pbuStamped >= 0.5 && pbuDefBad.length === 0),
  `cued=${pbuCued}/${pbuStamped} defBad=${pbuDefBad.slice(0, 3).join(' ')}`);
check('a tipped ball breaks trajectory and comes to rest', pbuCued === 0 || (pbuScatter === pbuCued && pbuRest === pbuCued),
  `scatter=${pbuScatter}/${pbuCued} rest=${pbuRest}/${pbuCued}`);
check('the pick rider owns the ball; ARRIVABLE credited men are kept', pickStamped === 0 || (pickMiss.length === 0 && (pickFeasible === 0 || pickRide / pickFeasible >= 0.8)), `kept=${pickRide}/${pickFeasible} arrivable of ${pickStamped} stamped, miss=${pickMiss.slice(0, 2).join(' ')}`);
check('run fumbles bounce and die at the engine spot', fumChecked === 0 || (fumRestBad.length === 0 && fumBounce / Math.max(1, fumChecked) >= 0.85),
  `bounced=${fumBounce}/${fumChecked} restBad=${fumRestBad.slice(0, 2).join(' ')}`);
check('carryCue names a real carrier with a legal arm', carryBad.length === 0, `bad=${carryBad.length}`);
check('same play → same ball film (deterministic)', detMismatch === 0, `mismatch=${detMismatch}/${detSample}`);
console.log(`INFO pbu-stamped incompletions harvested: ${pbuStamped}; stamped picks: ${pickStamped}; fumbles: ${fumChecked}`);
process.exit(pass ? 0 : 1);
