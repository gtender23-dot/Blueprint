// Capstone P1 probe (Aug 2026): the trace-driven render is the REAL play.
// A trace render must (1) put the ball in the sim's actual target's hands,
// (2) end at the sim's actual yardage, (3) keep the recorded cover man in the
// target's hip pocket — tighter when the sim's separation was small — and
// (4) degrade gracefully to synthesis when the trace is absent (old saves).
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
import { OFF_FIELD_LAYOUTS, DEF_FIELD_LAYOUTS } from '../js/constants_field.js';
import { buildPlayScript, sampleTrack } from '../js/ui/watchphys.js';
const STEP = 0.05, LOS = 31, YPU = 0.85;
function gen(t, s) { const r = []; for (const [p, c] of Object.entries(ROSTER_TARGETS)) for (let i = 0; i < c; i++) { const x = createPlayer(p, CLASS_YEARS[i % 4], t); x.schoolId = s; r.push(x); } return r; }
const mk = () => ({ offFormations: [{ id: 'Spread', weight: 30 }, { id: 'Air Raid', weight: 25 }, { id: 'Single Back', weight: 25 }, { id: 'Trips/Bunch', weight: 20 }], tendency: 'Balanced', rushInPct: 45, passDepth: { short: 35, medium: 40, deep: 25 }, blitzPct: 25, fourthDown: 'Moderate', baseTempo: 'Normal', maxFGDist: 42 });
let fails = 0; const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) fails++; };

const plays = [];
for (let i = 0; i < 10; i++) {
  const rH = gen(1, 'H'), rA = gen(1, 'A');
  const res = simulateGame({ id: 'H' }, { id: 'A' }, rH, rA, buildDepthChart(rH, mk()), buildDepthChart(rA, mk()), mk(), mk());
  for (const d of (res.drives || [])) for (const p of (d.plays || [])) plays.push(p);
}
const passPlays = plays.filter((p) => String(p.type).startsWith('pass') && !p.isScramble && !p.sack);
const traced = passPlays.filter((p) => p.trace && p.targetSlotId);
ok(traced.length / Math.max(1, passPlays.length) > 0.85, `traces stamped on pass plays (${traced.length}/${passPlays.length})`);

const build = (p) => {
  const off = OFF_FIELD_LAYOUTS[p.offFormation]?.slots;
  if (!off) return null;
  return buildPlayScript(p, off, (DEF_FIELD_LAYOUTS[p.defFront] || DEF_FIELD_LAYOUTS['4-3']).slots);
};
const offIds = new Set(Object.values(OFF_FIELD_LAYOUTS).flatMap((l) => l.slots.map((s) => s.id)));

// 1+2: ball in the actual target's hands, at the actual yardage.
let handsOK = 0, yardsOK = 0, n = 0;
for (const p of traced.filter((p) => p.complete && !p.turnover)) {
  const s = build(p); if (!s) continue;
  const tgt = s.actors.find((a) => a.id === p.targetSlotId); if (!tgt) continue;
  n++;
  const bEnd = s.ball.track[s.ball.track.length - 1];
  const aEnd = tgt.track[tgt.track.length - 1];
  if (Math.hypot(bEnd[0] - aEnd[0], bEnd[1] - aEnd[1]) < 3.2) handsOK++;
  const expY = Math.max(-60, LOS - Math.min(p.td ? Math.min(p.yards || 0, 100) : Math.max(-15, Math.min(100, p.yards || 0)), 100) * YPU);
  if (Math.abs(bEnd[1] - expY) < 2.5) yardsOK++;
}
ok(n > 60 && handsOK / n > 0.92, `ball ends in the REAL target's hands (${handsOK}/${n})`);
ok(n > 60 && yardsOK / n > 0.92, `render ends at the sim's yardage (${yardsOK}/${n})`);

// 3: the RECORDED cover man's cushion at the throw tracks the sim's
// separation — measured on script.covId (the actor the render actually wired),
// at the throw release frame the script itself reports.
const covCushion = (p) => {
  const s = build(p); if (!s || !s.covId || !s.throwCue) return null;
  const tgt = s.actors.find((a) => a.id === p.targetSlotId); if (!tgt) return null;
  const cov = s.actors.find((a) => a.id === s.covId); if (!cov) return null;
  const fi = Math.min(Math.round(s.throwCue.release / STEP), tgt.track.length - 1, cov.track.length - 1);
  const tp = tgt.track[fi], cp = cov.track[fi];
  return Math.hypot(cp[0] - tp[0], cp[1] - tp[1]);
};
const tight = [], loose = [];
for (const p of traced.filter((p) => !p.isScreen && (p.type === 'pass_medium' || p.type === 'pass_deep'))) {
  if (p.trace.sep <= 0.4) { const d = covCushion(p); if (d != null) tight.push(d); }
  else if (p.trace.sep >= 0.6) { const d = covCushion(p); if (d != null) loose.push(d); }
}
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
ok(tight.length > 15 && loose.length > 15 && med(tight) < med(loose), `cover cushion follows the sim's separation (tight-sep med ${med(tight)?.toFixed(2)}u < open-sep med ${med(loose)?.toFixed(2)}u, n=${tight.length}/${loose.length})`);
ok(traced.slice(0, 60).every((p) => { const s = build(p); return !s || !p.isScreen ? true : true; }), 'trace builds never throw');

// incompletions: a defender arrives at the ball (the breakup you watched)
let brk = 0, bn = 0;
for (const p of traced.filter((p) => !p.complete && !p.turnover && !p.hurried && !p.isScreen).slice(0, 80)) {
  const s = build(p); if (!s) continue;
  bn++;
  const bEnd = s.ball.track[s.ball.track.length - 1];
  let best = 1e9;
  for (const a of s.actors) { if (a.id === 'QB' || offIds.has(a.id)) continue; const dp = a.track[a.track.length - 1]; best = Math.min(best, Math.hypot(dp[0] - bEnd[0], dp[1] - bEnd[1])); }
  if (best < 5.5) brk++;
}
ok(bn > 20 && brk / bn > 0.8, `incompletions show a defender on the ball (${brk}/${bn})`);

// 4: graceful fallback — stripping the trace still renders every play.
let fb = 0, fbn = 0;
for (const p of passPlays.slice(0, 120)) {
  const q = { ...p }; delete q.trace; delete q.targetSlotId;
  fbn++;
  try { if (build(q)) fb++; } catch (e) { /* count as fail */ }
}
ok(fbn > 80 && fb === fbn, `synthesis fallback intact without traces (${fb}/${fbn})`);

// double-move + robber presence sanity (mechanisms exist in the data)
const dbls = traced.filter((p) => p.trace.dbl).length;
const robs = traced.filter((p) => p.trace.rob).length;
ok(dbls > 0, `double moves recorded in traces (${dbls})`);
console.log(`   (robber throws recorded: ${robs} — shell/coverage dependent, informational)`);

console.log('');
console.log(fails ? `PLAY TRACE PROBE: ${fails} FAIL` : 'PLAY TRACE PROBE PASS');
process.exit(fails ? 1 : 0);
