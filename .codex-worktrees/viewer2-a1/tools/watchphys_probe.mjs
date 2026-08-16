// watchphys_probe.mjs — Rung 7 Phase A gate: SCRIPTED PHYSICS is truthful.
// Feeds thousands of REAL engine plays through buildPlayScript and asserts
// the choreography's one law: the dots may improvise, the OUTCOME may not.
//  1. Every offensive snap (all types, all gadget phases) gets a script.
//  2. The ball's final resting spot matches the engine's yardage exactly.
//  3. Every track stays on the board; nobody teleports (speed cap honored).
//  4. Same play → same script (deterministic — rewatches don't reroll).
//  5. The engine itself is UNTOUCHED — this module only ever reads plays.
// Run from repo root: node tools/watchphys_probe.mjs [games]
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
import { OFF_FIELD_LAYOUTS, DEF_FIELD_LAYOUTS } from '../js/constants_field.js';
import { buildPlayScript, sampleTrack } from '../js/ui/watchphys.js';

const N = parseInt(process.argv[2] || '10', 10);
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
const sH = { id: 'H', name: 'H' }, sA = { id: 'A', name: 'A' };

let fail = 0;
const g = (n, ok, d = '') => { if (!ok) fail++; console.log(`${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`); };

// Harvest real plays across formation-diverse games.
const plays = [];
for (let i = 0; i < N; i++) {
  const rH = genRoster(1, 'H'), rA = genRoster(1, 'A');
  const res = simulateGame(sH, sA, rH, rA, buildDepthChart(rH, mk()), buildDepthChart(rA, mk()), mk(), mk());
  for (const d of (res.drives || [])) for (const p of (d.plays || [])) plays.push(p);
}
const snaps = plays.filter(p => String(p.type).startsWith('pass') || String(p.type).startsWith('run'));
const others = plays.filter(p => !String(p.type).startsWith('pass') && !String(p.type).startsWith('run'));
console.log(`harvested ${plays.length} plays (${snaps.length} snaps) from ${N} games`);

let built = 0, missing = [], endMiss = [], oob = 0, tooFast = 0, maxStepSpeed = 0, lenBad = 0;
const speedSamples = [];
const kinds = new Set();
for (const p of snaps) {
  const offS = OFF_FIELD_LAYOUTS[p.offFormation]?.slots;
  const defS = (DEF_FIELD_LAYOUTS[p.defFront] || DEF_FIELD_LAYOUTS['4-3']).slots;
  if (!offS) continue;                       // unknown formation = board can't draw it either
  const s = buildPlayScript(p, offS, defS);
  if (!s) { missing.push(p.type + '/' + (p.optionPhase || '-')); continue; }
  built++;
  for (const f of s.fx) kinds.add(f.kind);

  // 1. Outcome law: where does the ball die vs what the engine ruled?
  // [UPDATED Jul 2026 — true-distance tracks] The board went follow-cam:
  // long plays travel their REAL distance (gain clamp −15..100, endY
  // −60..61) instead of compressing into the old ~35yd window. The guard
  // now mirrors that convention — teeth unchanged: the ball must die at
  // the REAL yardage point, not the old clamped one.
  const last = s.ball.track[s.ball.track.length - 1];
  const gain = Math.max(-15, Math.min(100, p.yards || 0));
  const wantY = Math.max(-60, Math.min(61,
    LOS - (p.td ? Math.min(p.yards || 0, 100) : gain) * YPU));
  const isInc = String(p.type).startsWith('pass') && !p.isScramble && !p.complete && !p.sack && !p.turnover;
  const isInt = String(p.type).startsWith('pass') && !p.isScramble && p.turnover;
  if (!isInc && !isInt) {
    if (Math.abs(last[1] - wantY) > 0.12) {
      endMiss.push(`${p.type} ${p.yards}yd → ball y ${last[1].toFixed(1)} want ${wantY.toFixed(1)}`);
    }
  }

  // 2. Board bounds + 3. speed cap (per-sample displacement, constraint incl.)
  const lens = new Set(s.actors.map(a => a.track.length));
  if (lens.size !== 1 || s.actors.length !== offS.length + defS.length) lenBad++;
  for (const a of s.actors) {
    for (let i = 0; i < a.track.length; i++) {
      const [x, y] = a.track[i];
      // true-distance envelope: the follow-cam pans, so y runs the full
      // travel range; x is still the field's width.
      if (x < 0.5 || x > 99.5 || y < -61 || y > 62) { oob++; break; }
      if (i > 0) {
        const v = Math.hypot(x - a.track[i - 1][0], y - a.track[i - 1][1]) / s.step;
        if (v > maxStepSpeed) maxStepSpeed = v;
        speedSamples.push(v);
        // Hard pop guard: 16 u/s = 0.8 units/frame at 20 Hz — sub-dot-radius,
        // the eye can't see it. Anything past that IS a teleport.
        if (v > 16) { tooFast++; break; }
      }
    }
  }
}

g('every offensive snap builds a script', missing.length === 0 && built > 400,
  `${built} built, missing: ${[...new Set(missing)].join(',') || 'none'}`);
g('the ball dies where the engine said (±0.12u)', endMiss.length === 0,
  endMiss.length ? `${endMiss.length} misses e.g. ${endMiss[0]}` : `${built} exact`);
g('every dot stays on the board', oob === 0, `${oob} out-of-bounds tracks`);
const p99 = speedSamples.sort((a, b) => a - b)[Math.floor(speedSamples.length * 0.99)] || 0;
g('nobody teleports (hard ≤16 u/s; p99 ≤ 11)', tooFast === 0 && p99 <= 11,
  `max ${maxStepSpeed.toFixed(1)} u/s, p99 ${p99.toFixed(1)} u/s over ${speedSamples.length} steps`);
g('22 actors, uniform track lengths, every play', lenBad === 0, `${lenBad} malformed`);
{
  // [UPDATED Aug 2026 — penalty whistle scripts, Garrett-approved contract
  // change] Special teams stay un-animated. Flagged downs MAY now carry a
  // WHISTLE script: a dead play with no outcome claim. When one exists it must
  // be deterministic, full-cast with uniform tracks, and the ball must die
  // near the line — a whistle script can never assert yardage.
  const st = others.filter(p => p.type !== 'penalty');
  g('special teams stay un-animated (null script)',
    st.every(p => buildPlayScript(p, OFF_FIELD_LAYOUTS['Spread'].slots, DEF_FIELD_LAYOUTS['4-3'].slots) === null),
    `${st.length} checked`);
  const pens = others.filter(p => p.type === 'penalty');
  let scripted = 0, bad = 0;
  for (const p of pens) {
    const s1 = buildPlayScript(p, OFF_FIELD_LAYOUTS['Spread'].slots, DEF_FIELD_LAYOUTS['4-3'].slots);
    if (!s1) continue;
    scripted++;
    const s2 = buildPlayScript(p, OFF_FIELD_LAYOUTS['Spread'].slots, DEF_FIELD_LAYOUTS['4-3'].slots);
    if (JSON.stringify(s1.ball.track) !== JSON.stringify(s2.ball.track)) { bad++; continue; }
    if (new Set(s1.actors.map(a => a.track.length)).size !== 1
        || s1.actors.length !== OFF_FIELD_LAYOUTS['Spread'].slots.length + DEF_FIELD_LAYOUTS['4-3'].slots.length) { bad++; continue; }
    const bl = s1.ball.track[s1.ball.track.length - 1];
    if (Math.abs(bl[1] - LOS) > 9 || bl[0] < 1 || bl[0] > 99) bad++;
  }
  g('penalty whistle scripts are dead-ball + deterministic', bad === 0,
    `${scripted}/${pens.length} scripted`);
}

// 4. Gadget coverage: the harvest must exercise the whole cast.
{
  const phases = new Set(snaps.map(p => p.optionPhase).filter(Boolean));
  const hasScr = snaps.some(p => p.isScramble), hasSack = snaps.some(p => p.sack);
  g('harvest exercises gadgets + sacks + scrambles',
    phases.size >= 3 && hasScr && hasSack,
    `phases: ${[...phases].join(',')}; scramble ${hasScr}, sack ${hasSack}`);
  g('fx vocabulary is spoken', ['catch', 'inc', 'tackle'].every(k => kinds.has(k)),
    [...kinds].join(','));
}

// 5. Determinism: the same play scripts identically twice.
{
  const p = snaps.find(x => x.complete) || snaps[0];
  const offS = OFF_FIELD_LAYOUTS[p.offFormation].slots, defS = (DEF_FIELD_LAYOUTS[p.defFront] || DEF_FIELD_LAYOUTS['4-3']).slots;
  const a = buildPlayScript(p, offS, defS), b = buildPlayScript(p, offS, defS);
  g('same play → same script (rewatch = same film)',
    JSON.stringify(a.ball.track) === JSON.stringify(b.ball.track)
    && JSON.stringify(a.actors[3].track) === JSON.stringify(b.actors[3].track));
}

// 6. sampleTrack interpolates cleanly across the whole duration.
{
  const p = snaps[0];
  const s = buildPlayScript(p, OFF_FIELD_LAYOUTS[p.offFormation].slots, (DEF_FIELD_LAYOUTS[p.defFront] || DEF_FIELD_LAYOUTS['4-3']).slots);
  let ok = true;
  for (let t = 0; t <= s.dur + 0.3; t += 0.013) {
    const [x, y] = sampleTrack(s.ball.track, s.step, t);
    if (!isFinite(x) || !isFinite(y)) { ok = false; break; }
  }
  g('sampleTrack is finite at any playback time', ok);
}

console.log(fail ? `❌ ${fail} FAILED` : '✅ RUNG 7A SCRIPTED-PHYSICS GATE PASS');
process.exit(fail ? 1 : 0);
