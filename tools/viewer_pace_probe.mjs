// viewer_pace_probe.mjs — PLAYTEST 2026-08-12 items 9 and 9c: THE VIEWER MUST
// SHOW THE PLAY THAT HAPPENED, AT THE SPEED IT HAPPENED.
//
// Owner: "flushed plays ball flight path gets wonky … immersion breaking slow
// runs." Three defects, none of which anything asserted:
//
//   9-a  The ball's origin was re-read from the live QB on EVERY frame, so the
//        already-flown part of the arc rebased onto wherever he had drifted to.
//        A moving passer physically dragged the ball sideways.
//   9-b  The arc's bow direction was decided by `catchPt[0] >= ox` with that same
//        live ox, so it could FLIP mid-flight and snap the ball to the other side
//        of the throw line. That discontinuity is the "wonky".
//   9c-a `stepAgent` clamped actor y to a hard 2 while endY is allowed to −60, so
//        any run over ~34 yards had an endpoint the physics could not reach: the
//        carrier pinned and stalled, then constrainTrack slid him to the spot.
//   9c-b Travel time was `dist / (speed * 0.92) + 0.35`, and the arrival governor
//        floored the carrier at 55% of top speed — together, a jog.
//
// Run: node tools/viewer_pace_probe.mjs
import { buildPlayScript } from '../js/ui/watchphys.js';
import { OFF_FIELD_LAYOUTS, DEF_FIELD_LAYOUTS } from '../js/constants_field.js';

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};

const base = {
  offFormation: 'Spread', defFront: '4-3', fieldPos: 25, down: 1, distance: 10,
  half: 1, clock: 900, offSit: 'base',
};
// Same two layout tables the viewer feeds it in app.js.
const script = (over) => {
  const play = { ...base, ...over };
  const offL = OFF_FIELD_LAYOUTS[play.offFormation]?.slots;
  const defL = (DEF_FIELD_LAYOUTS[play.defFront] || DEF_FIELD_LAYOUTS['4-3'])?.slots;
  return buildPlayScript(play, offL, defL);
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// ── 9-a/9-b: the ball has ONE origin, and the arc never doubles back ──────────
{
  // A flushed throw is the reported case: the passer is moving at release.
  const s = script({ type: 'pass_deep', complete: true, yards: 34, isScrambleThrow: true, hurried: true, qbArm: 70 });
  const track = s.ball.track.filter(Boolean);
  check('a flushed throw still produces a ball track', !!s && track.length > 10, `${track.length} frames`);

  // Find the flight: the longest run of frames where the ball is moving fast.
  const steps = [];
  for (let i = 1; i < track.length; i++) steps.push(dist(track[i - 1], track[i]));
  const moving = steps.map((d) => d > 0.25);
  let best = { a: 0, b: 0 }, cur = null;
  for (let i = 0; i < moving.length; i++) {
    if (moving[i]) { if (!cur) cur = { a: i, b: i }; else cur.b = i; }
    else if (cur) { if (cur.b - cur.a > best.b - best.a) best = cur; cur = null; }
  }
  if (cur && cur.b - cur.a > best.b - best.a) best = cur;
  const seg = track.slice(best.a, best.b + 2);
  check('the flight segment is long enough to judge', seg.length >= 6, `${seg.length} frames`);

  // THE REBASE TEST. On a straight-line lerp from a FIXED origin, every frame's
  // distance back to the launch point grows monotonically. If the origin is
  // re-read from a drifting passer, that distance stutters or shrinks.
  if (seg.length >= 6) {
    const origin = seg[0];
    const back = seg.map((pt) => dist(origin, pt));
    let regress = 0;
    for (let i = 2; i < back.length - 1; i++) if (back[i] < back[i - 1] - 0.15) regress++;
    check('the ball never retreats toward its release point mid-flight', regress === 0,
      regress ? `${regress} frames moved BACKWARD — the origin is rebasing` : `${back.length} frames, monotonic`);

    // THE BOW-FLIP TEST. Signed offset from the straight release→catch line. A
    // real arc bows one way and returns; a sign flip means the arc jumped sides.
    const A = seg[0], B = seg[seg.length - 1];
    const vx = B[0] - A[0], vy = B[1] - A[1];
    const L = Math.hypot(vx, vy) || 1;
    const side = seg.map((pt) => ((pt[0] - A[0]) * vy - (pt[1] - A[1]) * vx) / L);
    const signs = side.filter((v) => Math.abs(v) > 0.12).map((v) => Math.sign(v));
    const flips = signs.reduce((n, v, i) => n + (i && v !== signs[i - 1] ? 1 : 0), 0);
    check('the arc bows one way and stays there', flips === 0,
      flips ? `${flips} sign flips — the arc snapped across the throw line` : 'no side changes');
  }
}

// ── 9c-a: a long run must be able to REACH its endpoint ──────────────────────
{
  // 60 yards from the offense's own 25 — well past the old y=2 physics floor,
  // which sat only ~34 yards downfield.
  const s = script({ type: 'run_inside', yards: 60, complete: false });
  // The carrier is the offensive actor that travels furthest downfield.
  const offs = (s.actors || []).filter((a) => a.team === 'off' && a.track && a.track.length);
  const depth = (a) => Math.min(...a.track.filter(Boolean).map((pt) => pt[1]));
  const carrier = offs.reduce((a, b) => (a == null || depth(b) < depth(a) ? b : a), null);
  const track = (carrier && carrier.track || []).filter(Boolean);
  check('the long run produces a carrier track', track.length > 10, `${track.length} frames`);
  if (track.length > 10) {
    const ys = track.map((pt) => pt[1]);
    const minY = Math.min(...ys);
    // The tell: frames PINNED at exactly the old floor while the scheduler kept
    // demanding more speed.
    const pinned = ys.filter((y) => Math.abs(y - 2) < 1e-6).length;
    check('the carrier is not pinned against the old hard floor', pinned <= 1,
      pinned > 1 ? `${pinned} frames stuck at exactly y=2` : `deepest y ${minY.toFixed(1)}`);
    check('and he actually runs past where that floor used to be', minY < 2 + 1e-6,
      `reached y ${minY.toFixed(1)}`);
  }
}

// ── 9c-b: the ballcarrier runs, he does not jog ──────────────────────────────
{
  const YPU = 0.85;
  const samples = [];
  for (const yards of [8, 14, 22, 35]) {
    const s = script({ type: 'run_inside', yards });
    const offs = (s.actors || []).filter((a) => a.team === 'off' && a.track && a.track.length);
    const depth = (a) => Math.min(...a.track.filter(Boolean).map((pt) => pt[1]));
    const carrier = offs.reduce((a, b) => (a == null || depth(b) < depth(a) ? b : a), null);
    const track = (carrier && carrier.track || []).filter(Boolean);
    if (track.length < 8 || !s.dur) continue;
    // Realized top speed over the run, in units/sec.
    const step = s.dur / (track.length - 1);
    let top = 0;
    for (let i = 1; i < track.length; i++) top = Math.max(top, dist(track[i - 1], track[i]) / step);
    samples.push({ yards, top, ydsPerSec: top * YPU });
  }
  check('every run sampled produced a track', samples.length === 4, `${samples.length}/4`);
  // The floor is distance-aware ON PURPOSE. A back on an 8-yard inside run does
  // not reach top speed in real football either — he is acceleration- and
  // contact-limited, and holding short runs to the same bar as a 35-yard burst
  // would be asserting something untrue. Measured before → after this pass:
  //   8yd 3.7→4.0 · 14yd 4.1→4.3 · 22yd 4.8→6.1 · 35yd 6.1→6.5 (yds/sec)
  // The bands sit just under the "after" numbers so a regression reds and normal
  // variance does not. NOTE this measures the SCRIPT only; killing the 0.86×
  // D3 wall-clock multiplier (app.js `divM`) is a further ~16% in the division
  // where Simple game planning starts every new player, and is invisible here.
  for (const s of samples) {
    const floor = s.yards >= 20 ? 5.5 : 3.9;
    check(`a ${s.yards}-yard run reaches a real running speed`, s.ydsPerSec >= floor,
      `${s.ydsPerSec.toFixed(1)} yds/sec (floor ${floor})`);
  }
}

console.log(`\n${fail === 0 ? 'ALL PASS ✅' : `${fail} FAILURES ❌`}  (${pass} pass, ${fail} fail)`);
process.exit(fail === 0 ? 0 : 1);
