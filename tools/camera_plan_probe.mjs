// camera_plan_probe.mjs — M22 gate: the broadcast camera PLAN is lawful.
// Harvests REAL engine plays (Math.random pinned — deterministic by
// construction, NOT seedFlaky), builds each play's script + camera plan
// (buildCameraPlan, the same pure function the board consumes) and asserts:
//  1. Pre-snap the anchor is pinned — the M20 motionless-snap law holds by
//     construction.
//  2. Anticipation, passes: mid-flight the anchor sits BETWEEN the ball and
//     the known catch point (closer to the destination than the ball is).
//  3. Anticipation, ground game: the anchor leads the ball toward the known
//     end point — the camera is ahead of the play, never trailing it.
//  4. Contextual zoom: wide pre-snap; tighter at the catch, the tackle and
//     inside the low red zone; replay frames tighter than live; bounded.
//  5. Turnovers carry a settle window at the turnover moment and the anchor
//     holds the spot through the cut.
//  6. TD plays hold the celebrant tight (celebration hold).
//  7. Replay warp: slow windows cover the contact cues, rates are sane, and
//     the warp is BUDGET-NEUTRAL — total wall time integrates to dur, so
//     the watch loop's replay scheduling stays exact.
//  8. Same play → same plan (deterministic).
// Run from repo root: node tools/camera_plan_probe.mjs [games]
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
import { OFF_FIELD_LAYOUTS, DEF_FIELD_LAYOUTS } from '../js/constants_field.js';
import { buildPlayScript, buildCameraPlan } from '../js/ui/watchphys.js';
import { mulberry32 } from './_seed.mjs';

let _s = 20260811;
// 2026-08-22: was a hand-rolled LCG whose state cycled every 10,466 draws — the
// multiply overflowed Number.MAX_SAFE_INTEGER and the mask then kept the bits
// that had been rounded away. An N-game arm draws millions of values, so it was
// replaying one short loop, not sampling. See tools/_seed.mjs.
Math.random = mulberry32(_s);

const N = parseInt(process.argv[2] || '8', 10);
const WIDE = 53;

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
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

let planned = 0, preMove = 0,
  passLeadN = 0, passLeadBad = 0,
  runLeadN = 0, runLeadBad = 0,
  zoomBadBounds = 0, zoomCatch = 0, zoomCatchBad = 0, zoomTackle = 0, zoomTackleBad = 0,
  replayLooser = 0, goalN = 0, goalBad = 0,
  toN = 0, toBad = 0, tdN = 0, tdBad = 0,
  warpN = 0, warpCover = 0, warpRateBad = 0, warpBudgetBad = [],
  detBad = 0, detSampled = 0;

for (const p of snaps) {
  const offL = OFF_FIELD_LAYOUTS[p.offFormation]?.slots;
  if (!offL) continue;
  const defL = (DEF_FIELD_LAYOUTS[p.defFront] || DEF_FIELD_LAYOUTS['4-3']).slots;
  const script = buildPlayScript(p, offL, defL);
  if (!script) continue;
  const plan = buildCameraPlan(script, p);
  planned++;
  const S = script.step, ps = script.presnap, dur = script.dur;
  const ballAt = (t) => {
    const tr = script.ball.track;
    const i = Math.max(0, Math.min(Math.round(t / S), tr.length - 1));
    return tr[i];
  };

  // 1. pre-snap pin
  const a0 = plan.anchorAt(0.02), a1 = plan.anchorAt(ps * 0.5), a2 = plan.anchorAt(ps - 0.05);
  if (dist(a0, a1) > 1e-6 || dist(a0, a2) > 1e-6) preMove++;

  // 2. pass lead: mid-flight anchor closer to the catch point than the ball
  const catchFx = (script.fx || []).find(f => f.kind === 'catch' || f.kind === 'inc' || f.kind === 'int');
  if (script.throwCue && catchFx && catchFx.t > script.throwCue.release + 0.15) {
    const tm = (script.throwCue.release + catchFx.t) / 2;
    const cp = [catchFx.x, catchFx.y];
    const b = ballAt(tm), a = plan.anchorAt(tm);
    if (dist(b, cp) > 2) {
      passLeadN++;
      if (!(dist(a, cp) < dist(b, cp) - 0.2)) passLeadBad++;
    }
  }

  // 3. run lead toward the known end point
  if (script.tackleCue && !script.throwCue && String(p.type).startsWith('run')) {
    const tc = script.tackleCue;
    const tm = ps + (tc.t - ps) * 0.6;
    const ep = [tc.x, tc.y];
    const b = ballAt(tm), a = plan.anchorAt(tm);
    if (tm > ps + 0.3 && dist(b, ep) > 3 && !(plan.settle && tm >= plan.settle.start)) {
      runLeadN++;
      if (!(dist(a, ep) < dist(b, ep) - 0.1)) runLeadBad++;
    }
  }

  // 4. zoom laws
  if (plan.hAt(0.05, false) !== WIDE) zoomBadBounds++;
  for (let t = 0; t <= dur; t += dur / 17) {
    const h = plan.hAt(t, false), hr = plan.hAt(t, true);
    if (!(h >= 36 && h <= 56.01) || !(hr <= h + 1e-9)) { zoomBadBounds++; break; }
    if (hr > h) replayLooser++;
  }
  if (catchFx) {
    zoomCatch++;
    if (!(plan.hAt(catchFx.t, false) <= 42.01)) zoomCatchBad++;
  }
  if (script.tackleCue) {
    zoomTackle++;
    if (!(plan.hAt(script.tackleCue.t, false) <= 41.51)) zoomTackleBad++;
  }
  if (p.fieldPos != null && p.fieldPos >= 92) {
    goalN++;
    if (!(plan.hAt(ps + (dur - ps) * 0.7, false) <= 42.51)) goalBad++;
  }

  // 5. turnover settle
  const toFx = (script.fx || []).find(f => f.kind === 'int' || f.kind === 'fum');
  if (toFx) {
    toN++;
    const ok = plan.settle && plan.settle.start <= toFx.t && plan.settle.end >= toFx.t
      && dist(plan.anchorAt(toFx.t + 0.1), [toFx.x, toFx.y]) < 0.01;
    if (!ok) toBad++;
  }

  // 6. celebration hold
  if (p.td && script.celebrateCue) {
    tdN++;
    const late = Math.max(script.celebrateCue.t + 0.05, dur - 0.1);
    const ok = plan.hold && dist(plan.anchorAt(late), plan.hold.pt) < 0.01 && plan.hAt(late, false) <= 40.01;
    if (!ok) tdBad++;
  }

  // 7. warp: coverage, rates, budget neutrality
  if (plan.warpSegs.length) {
    warpN++;
    const cues = [script.tackleCue?.t, catchFx?.t, script.breakCue?.t].filter(v => v != null);
    if (cues.every(c => plan.warpAt(Math.min(c, dur - 1e-4)) === plan.slowRate)) warpCover++;
    if (!(plan.slowRate >= 0.44 && plan.slowRate < 1 && plan.baseRate >= 1 && plan.baseRate <= 1.351)) warpRateBad++;
    let wall = 0;
    const dt = 0.005;
    for (let t = 0; t < dur; t += dt) wall += dt / plan.warpAt(t);
    if (Math.abs(wall - dur) > 0.03) warpBudgetBad.push(`${p.type}:${(wall - dur).toFixed(3)}`);
  }

  // 8. determinism
  if (detSampled < 40) {
    detSampled++;
    const again = buildCameraPlan(buildPlayScript(p, offL, defL), p);
    for (let t = 0; t <= dur; t += dur / 9) {
      if (dist(plan.anchorAt(t), again.anchorAt(t)) > 1e-9
        || plan.hAt(t, true) !== again.hAt(t, true)
        || plan.warpAt(t) !== again.warpAt(t)) { detBad++; break; }
    }
  }
}

check('every scripted snap gets a plan', planned > 400, `planned=${planned}`);
check('pre-snap anchor is pinned (motionless-snap law)', preMove === 0, `moved=${preMove}`);
check('pass anchors lead to the known catch point', passLeadN > 100 && passLeadBad === 0, `checked=${passLeadN} bad=${passLeadBad}`);
check('run anchors lead toward the known end point', runLeadN > 100 && runLeadBad === 0, `checked=${runLeadN} bad=${runLeadBad}`);
check('zoom bounded, wide pre-snap, replay never looser than live', zoomBadBounds === 0, `bad=${zoomBadBounds}`);
check('zoom tightens at the catch', zoomCatch === 0 || zoomCatchBad === 0, `${zoomCatch - zoomCatchBad}/${zoomCatch}`);
check('zoom tightens at the tackle', zoomTackle === 0 || zoomTackleBad === 0, `${zoomTackle - zoomTackleBad}/${zoomTackle}`);
check('low red zone holds the tight frame', goalN === 0 || goalBad === 0, `${goalN - goalBad}/${goalN}`);
check('turnovers carry a settle window holding the spot', toN === 0 || toBad === 0, `${toN - toBad}/${toN}`);
check('touchdowns hold the celebrant tight', tdN === 0 || tdBad === 0, `${tdN - tdBad}/${tdN}`);
check('replay warp slows the contact cues', warpN > 200 && warpCover === warpN, `${warpCover}/${warpN}`);
check('warp rates sane (slow ≥.44, base ≤ 1.35)', warpRateBad === 0, `bad=${warpRateBad}`);
check('warp is budget-neutral (∫wall = dur ±0.03s)', warpBudgetBad.length === 0, warpBudgetBad.slice(0, 3).join(' '));
check('same play → same plan (deterministic)', detBad === 0, `sampled=${detSampled}`);
process.exit(pass ? 0 : 1);
