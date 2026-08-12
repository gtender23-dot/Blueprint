// officials_plan_probe.mjs — M23 gate: the officials plan is lawful.
// Harvests REAL engine plays (Math.random pinned — deterministic by
// construction, NOT seedFlaky), builds each script's officials plan
// (buildOfficialsPlan, the same pure function the board consumes) and
// asserts:
//  1. Every scrimmage script yields a 3-man crew, and script.actors stays
//     EXACTLY the 22 players (officials never join the cast).
//  2. Positions are finite and on the board at every sampled time.
//  3. Pre-snap the crew is static.
//  4. THE STAND-OFF LAW: no official is ever closer to the ball than the
//     minimum — the crew is never inside the play.
//  5. No teleports: consecutive samples move smoothly.
//  6. The line judge rides the near sideline, always.
//  7. The signals list covers the play's fx (td/fd/inc/sack→spot/
//     int|fum→change/flag).
//  8. Same play → same plan (deterministic).
// Run from repo root: node tools/officials_plan_probe.mjs [games]
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
import { OFF_FIELD_LAYOUTS, DEF_FIELD_LAYOUTS } from '../js/constants_field.js';
import { buildPlayScript, buildOfficialsPlan, sampleTrack } from '../js/ui/watchphys.js';

let _s = 20260812;
Math.random = () => { _s = (_s * 1103515245 + 12345) & 0x7fffffff; return _s / 0x7fffffff; };

const N = parseInt(process.argv[2] || '8', 10);

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

let planned = 0, castBad = 0, badPos = 0, preMove = 0,
  standoffMin = Infinity, standoffBad = 0, jumpMax = 0, jumps = 0,
  ljBad = 0, sigChecked = 0, sigMiss = [], detBad = 0, detSampled = 0;

for (const p of snaps) {
  const offL = OFF_FIELD_LAYOUTS[p.offFormation]?.slots;
  if (!offL) continue;
  const defL = (DEF_FIELD_LAYOUTS[p.defFront] || DEF_FIELD_LAYOUTS['4-3']).slots;
  const script = buildPlayScript(p, offL, defL);
  if (!script) continue;
  const plan = buildOfficialsPlan(script, p);
  planned++;
  if (script.actors.length !== offL.length + defL.length) castBad++;
  const dur = script.dur, ps = script.presnap;
  const ballAt = (t) => sampleTrack(script.ball.track, script.step, t);

  // pre-snap static, to the same tolerance the ball itself is held to (a
  // constrained track may drift sub-unit before the snap)
  const p0 = plan.at(0.02), p1 = plan.at(ps - 0.06);
  if (p0.some((pt, i) => dist(pt, p1[i]) > 0.6)) preMove++;

  let prev = null;
  for (let t = 0; t <= dur; t += 0.1) {
    const pos = plan.at(t);
    if (pos.length !== 3) { badPos++; break; }
    const b = ballAt(t);
    for (let i = 0; i < 3; i++) {
      const pt = pos[i];
      if (!Number.isFinite(pt[0]) || !Number.isFinite(pt[1]) || pt[0] < 1.5 || pt[0] > 98.5 || pt[1] < -59.5 || pt[1] > 61) { badPos++; }
      const d = dist(pt, b);
      if (d < standoffMin) standoffMin = d;
      if (d < 2.8) standoffBad++;
      if (prev) {
        const j = dist(pt, prev[i]);
        if (j > jumpMax) jumpMax = j;
        if (j > 8) jumps++;
      }
      if (plan.crew[i] === 'LJ' && Math.abs(pt[0] - 93.5) > 0.01) ljBad++;
    }
    prev = pos;
  }

  // signals cover the play's fx
  const wantKinds = new Set();
  for (const f of script.fx || []) {
    if (f.kind === 'td') wantKinds.add('td');
    else if (f.kind === 'fd') wantKinds.add('fd');
    else if (f.kind === 'inc') wantKinds.add('inc');
    else if (f.kind === 'sack' || f.kind === 'tackle') wantKinds.add('spot');
    else if (f.kind === 'int' || f.kind === 'fum') wantKinds.add('change');
  }
  for (const k of wantKinds) {
    sigChecked++;
    if (!plan.signals.some(s => s.kind === k)) sigMiss.push(`${p.type}:${k}`);
  }

  if (detSampled < 30) {
    detSampled++;
    const again = buildOfficialsPlan(buildPlayScript(p, offL, defL), p);
    for (let t = 0; t <= dur; t += dur / 7) {
      const a = plan.at(t), b2 = again.at(t);
      if (a.some((pt, i) => dist(pt, b2[i]) > 1e-9)) { detBad++; break; }
    }
  }
}

check('every scripted snap yields a 3-man plan', planned > 400 && badPos === 0, `planned=${planned} badPos=${badPos}`);
check('script.actors stays exactly the 22 players', castBad === 0, `bad=${castBad}`);
check('pre-snap crew is static', preMove === 0, `moved=${preMove}`);
check('stand-off law: never inside the play (≥2.8u)', standoffBad === 0, `min=${standoffMin.toFixed(2)}u bad=${standoffBad}`);
check('no teleports (≤8u per 0.1s sample)', jumps === 0, `max=${jumpMax.toFixed(2)}u`);
check('the line judge rides the near sideline', ljBad === 0, `bad=${ljBad}`);
check('signals cover the play fx', sigChecked > 400 && sigMiss.length === 0, `checked=${sigChecked} miss=${sigMiss.slice(0, 3).join(' ')}`);
check('same play → same plan (deterministic)', detBad === 0, `sampled=${detSampled}`);
process.exit(pass ? 0 : 1);
