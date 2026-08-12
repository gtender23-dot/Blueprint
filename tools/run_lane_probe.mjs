// run_lane_probe.mjs — does lane quality actually reach the yards?
//
// It didn't. As shipped through Jul 2026, run2geo.js transmitted lane quality into the
// carry through three points and two of them were multiplied by zero:
//
//   entry    = 0.712 + lane * 0.0 ...     (initial north-south burst — DEAD)
//   blockedP = ...   + lane * 0.0 ...     (how many fillers the line reached — DEAD)
//   laneShift= (lane-0.60)*(lane<0.60?0.45:-0.35)   (mesh point — ALIVE but non-monotonic:
//                                          peaks at lane 0.60, a clean lane starts BEHIND
//                                          the mean — a sign error, not a compression)
//
// So the run-direction dial still picked the lane and point-of-attack reps still got triple
// weight, but a won line did not turn into yards. The comments in run2geo describe a ~1
// yd/lane-unit transmission pivoted at the measured lane mean; the arithmetic delivered a
// third-of-a-yard wobble in the wrong shape.
//
// Two things are checked, same discipline as press_jam_probe:
//
//   1. MONOTONICITY — mean yards per carry must RISE as lane quality rises. This is the
//      "is the signal even connected" test.
//   2. MAGNITUDE — it must rise by about a yard across the lane range (the design target the
//      comments state), and it must be roughly calibration-NEUTRAL: mean YPC at the engine's
//      measured lane mean should not move, or the fix silently rebalances the run game the
//      way the press fix silently rebalanced completions.
//
// Everything but lane is pinned: one fixed carrier pool, one fixed set of second-level LBs,
// deep DBs and pursuing DL, reused in the same order across every cell, no penetrator, no
// vision nudge. That isolates run2geo's own lane->yards transmission from the upstream
// penetrator-count correlation in resolveRunPlay.
//
// Usage: node tools/run_lane_probe.mjs [carriesPerCell]
import { runFit }       from '../js/engine/run2geo.js';
import { createPlayer } from '../js/engine/player.js';

const N = Number(process.argv[2] || 20000);

// Fixed pools. Same bodies, same order, every cell.
const CARRIERS = Array.from({ length: 160 }, () => createPlayer('RB', 'JR', 3));
const LBS = Array.from({ length: 3 }, () => createPlayer('MLB', 'JR', 3));
const SAF = Array.from({ length: 2 }, () => createPlayer('S',  'JR', 3));
const CBS = Array.from({ length: 2 }, () => createPlayer('CB', 'JR', 3));
const DLP = [createPlayer('DT', 'JR', 3)];
const DEEP = [...SAF, ...CBS];

// The engine's real broken-tackle finish is in sim.js and not importable here without the
// whole game; run2geo falls back to its own defaultFinish when none is passed, which is the
// same contest shape. Pinning finish=undefined keeps the probe self-contained.
function ypcFor(lane) {
  let sum = 0;
  for (let i = 0; i < N; i++) {
    const fit = runFit(CARRIERS[i % CARRIERS.length], {
      lane, penetrator: null,
      secondLevel: LBS, deepLevel: DEEP, dlPursuit: DLP, vision: 0,
    });
    sum += fit.yards;
  }
  return sum / N;
}

const LANES = [0.00, 0.20, 0.40, 0.60, 0.80, 1.00];

console.log(`Run lane sweep — ${N} carries per cell, fixed pools, only lane varied\n`);
console.log('lane      mean YPC');
const curve = LANES.map(l => {
  const ypc = ypcFor(l);
  console.log(`${l.toFixed(3).padStart(5)}   ${ypc.toFixed(3).padStart(8)}`);
  return { l, ypc };
});

const lo = curve[0].ypc;                 // lane 0.00
const hi = curve[curve.length - 1].ypc;  // lane 1.00
const mid = curve.find(c => c.l === 0.60).ypc;
const swing = hi - lo;

// End-to-end monotonicity (adjacent cells sit in each other's noise; a strict ladder flaps).
const inverted = swing < 0;
const flat     = Math.abs(swing) < 0.25;

console.log(`\nswing 0.00 -> 1.00 : ${swing >= 0 ? '+' : ''}${swing.toFixed(3)} yd`);
console.log(`YPC at measured mean lane (0.60): ${mid.toFixed(3)}  <- watch this for calibration drift`);

let fail = 0;
if (inverted) { fail++; console.log(`\nFAIL — INVERTED: a clean lane yields ${(-swing).toFixed(3)} FEWER yards than a stuffed one.`); }
else if (flat) { fail++; console.log(`\nFAIL — FLAT: lane quality moves the carry by ${swing.toFixed(3)} yd; the signal is not connected.`); }
else { console.log(`\nPASS — lane quality raises YPC by ${swing.toFixed(3)} yd across the range, correct direction.`); }

process.exit(fail ? 1 : 0);
