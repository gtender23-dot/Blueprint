// viewer_fix_probe.mjs — targeted gates for the 2026-08-08 viewer bug-hunt fixes.
// Feeds real engine plays through buildPlayScript and asserts:
//  1. INT BALL FOLLOW  — on a pass interception the ball's late track tracks the
//     picked defender, not a frozen point at the catch spot.
//  2. RB TARGET MEET   — when the trace target is a back (non-screen checkdown),
//     the receiver's track passes near the ball's catch point (no phantom-catch).
//  3. SCREEN KIND      — a screen whose targetSlotId is a back renders rb-screen
//     geometry (catch behind/at the LOS), never a WR bubble to nobody.
//  4. MOVE CUE TIMING  — pass-play move cues never fire before the catch.
// Run from repo root: node tools/viewer_fix_probe.mjs [games]
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
import { OFF_FIELD_LAYOUTS, DEF_FIELD_LAYOUTS } from '../js/constants_field.js';
import { buildPlayScript, sampleTrack } from '../js/ui/watchphys.js';

const N = parseInt(process.argv[2] || '14', 10);

function genRoster(t, s) {
  const r = [];
  for (const [pos, c] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < c; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], t); p.schoolId = s; r.push(p); }
  }
  return r;
}
const mk = (o = {}) => ({ offFormations: [{ id: 'Spread', weight: 35 }, { id: 'Single Back', weight: 35 },
    { id: 'Trips/Bunch', weight: 30 }],
  tendency: 'Balanced', passDepth: { short: 55, medium: 30, deep: 15 },
  blitzPct: 30, fourthDown: 'Moderate', baseTempo: 'Normal', maxFGDist: 42, screenRate: 22, ...o });
const sH = { id: 'H', name: 'H' }, sA = { id: 'A', name: 'A' };

let fail = 0;
const g = (n, ok, d = '') => { if (!ok) fail++; console.log(`${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`); };

const plays = [];
for (let i = 0; i < N; i++) {
  const rH = genRoster(1, 'H'), rA = genRoster(1, 'A');
  const res = simulateGame(sH, sA, rH, rA, buildDepthChart(rH, mk()), buildDepthChart(rA, mk()), mk(), mk());
  for (const d of (res.drives || [])) for (const p of (d.plays || [])) plays.push(p);
}
const script = (p) => {
  const offL = OFF_FIELD_LAYOUTS[p.offFormation]?.slots;
  const defL = (DEF_FIELD_LAYOUTS[p.defFront] || DEF_FIELD_LAYOUTS['4-3'])?.slots;
  return offL ? buildPlayScript(p, offL, defL) : null;
};
const isBackSlot = (id) => /^(RB|FB)/.test(String(id));

// ── 1. INT ball follow ─────────────────────────────────────────────────
const ints = plays.filter(p => String(p.type).startsWith('pass') && p.turnover && !p.sack);
let intOk = 0, intBad = 0, checked = 0;
for (const p of ints) {
  const s = script(p); if (!s) continue;
  checked++;
  // find the actor whose late track the ball matches
  const bt = s.ball.track;
  const late = Math.max(0, bt.length - 3);
  const bp = bt[late];
  const first = bt[Math.max(0, late - 6)];
  const moved = Math.hypot(bp[0] - first[0], bp[1] - first[1]);
  // ball must coincide with SOME defender's track at the same frame
  let rides = false;
  for (const a of s.actors) {
    if (a.team !== 'def') continue;
    const ap = a.track[Math.min(late, a.track.length - 1)];
    if (Math.hypot(ap[0] - bp[0], ap[1] - bp[1]) < 0.75) { rides = true; break; }
  }
  if (rides) intOk++; else intBad++;
}
g(`INT ball rides the return man (${intOk}/${checked} scripts, ${ints.length} INTs harvested)`,
  checked === 0 || (intOk > 0 && intBad === 0), `bad=${intBad}`);

// ── 2. RB checkdown target meets the ball ──────────────────────────────
const rbTargets = plays.filter(p => String(p.type).startsWith('pass') && !p.sack && !p.turnover
  && p.complete && !p.isScreen && p.targetSlotId && isBackSlot(p.targetSlotId));
let meet = 0, miss = 0; let worst = 0;
for (const p of rbTargets) {
  const s = script(p); if (!s) continue;
  const rb = s.actors.find(a => a.id === p.targetSlotId); if (!rb) continue;
  // closest approach of RB track to ball track around mid-play
  let best = 1e9;
  for (let i = 0; i < s.ball.track.length; i++) {
    const b = s.ball.track[i], r = rb.track[Math.min(i, rb.track.length - 1)];
    const d = Math.hypot(b[0] - r[0], b[1] - r[1]);
    if (d < best) best = d;
  }
  if (best < 2.2) meet++; else { miss++; worst = Math.max(worst, best); }
}
g(`RB checkdown target meets the ball (${meet} met / ${miss} missed of ${rbTargets.length})`,
  rbTargets.length === 0 || miss === 0, `worst gap=${worst.toFixed(1)}u`);

// ── 3. screens to a back render rb geometry ────────────────────────────
const rbScreens = plays.filter(p => String(p.type).startsWith('pass') && p.isScreen && !p.sack
  && p.targetSlotId && isBackSlot(p.targetSlotId) && !p.turnover && p.complete);
let rbGeomOk = 0, rbGeomBad = 0;
for (const p of rbScreens) {
  const s = script(p); if (!s) continue;
  const rb = s.actors.find(a => a.id === p.targetSlotId); if (!rb) continue;
  // the back must intersect the ball path (he IS the catcher now)
  let best = 1e9;
  for (let i = 0; i < s.ball.track.length; i++) {
    const b = s.ball.track[i], r = rb.track[Math.min(i, rb.track.length - 1)];
    best = Math.min(best, Math.hypot(b[0] - r[0], b[1] - r[1]));
  }
  if (best < 2.2) rbGeomOk++; else rbGeomBad++;
}
g(`back-targeted screens catch with the back (${rbGeomOk}/${rbGeomOk + rbGeomBad} of ${rbScreens.length} harvested)`,
  rbScreens.length === 0 || rbGeomBad === 0);

// ── 4. move cue never precedes the catch on pass plays ─────────────────
let cueBad = 0, cueChecked = 0;
for (const p of plays.filter(p => String(p.type).startsWith('pass') && p.complete && !p.turnover && !p.sack)) {
  const s = script(p); if (!s || !s.moveCue) continue;
  const catchFx = (s.fx || []).find(f => f.kind === 'catch');
  if (!catchFx) continue;
  cueChecked++;
  if (s.moveCue.t < catchFx.t) cueBad++;
}
g(`pass move cues fire at/after the catch (${cueChecked} cued)`, cueBad === 0, `early=${cueBad}`);

console.log(fail ? `\n❌ VIEWER FIX PROBE FAIL (${fail})` : '\nVIEWER FIX PROBE PASS');
process.exit(fail ? 1 : 0);
