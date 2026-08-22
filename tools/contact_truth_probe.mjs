// contact_truth_probe.mjs — M20 gate: the sim's contact truth reaches the
// screen. Harvests REAL engine plays (Math.random pinned to a seeded PRNG —
// this probe is deterministic by construction, not seedFlaky), scripts them
// through buildPlayScript, and asserts:
//  1. When the credited tackler's slot exists in the viewer front, the
//     tackle cue stages HIM — never a proximity stand-in.
//  2. Same for the credited assist.
//  3. A credited broken tackle stages a real collision: breakCue at the
//     defender's meeting with the carrier, before the play's end.
//  4. Pile discipline: at most tackler + assist + one extra inside the pile
//     radius at the end frame, and no two bodies share coordinates.
//  5. A credited strip on a run fumble stages the strip man's cue.
//  6. Pass plays carry pass-pro block pairs (rep=passpro) for wired rushers.
//  7. Plays WITHOUT truth stamps still stage a tackle (fallback intact).
//  8. Same play → same script (determinism, incl. the staged break).
// Run from repo root: node tools/contact_truth_probe.mjs [games]
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
import { DEF_FIELD_LAYOUTS } from '../js/constants_field.js';
import { buildPlayScript } from '../js/ui/watchphys.js';

let _s = 20260809;
// 2026-08-22: was a hand-rolled LCG whose state cycled every 10,466 draws — the
// multiply overflowed Number.MAX_SAFE_INTEGER and the mask then kept the bits
// that had been rounded away. An N-game arm draws millions of values, so it was
// replaying one short loop, not sampling. See tools/_seed.mjs.
Math.random = mulberry32(_s);

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

import { OFF_FIELD_LAYOUTS } from '../js/constants_field.js';
import { mulberry32 } from './_seed.mjs';
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

let stamped = 0, tMatch = 0, tMiss = [], aMatch = 0, aMiss = [],
  breaks = 0, breakStaged = 0, breakBad = [], breakOrder = 0,
  pileChecked = 0, pileOver = [], pileClump = [],
  strips = 0, stripStaged = 0, passN = 0, passPro = 0,
  fallbackTackles = 0, fallbackEligible = 0, detMismatch = 0;

for (const p of snaps) {
  const [offL, defL] = layoutFor(p);
  if (!offL) continue;
  const script = buildPlayScript(p, offL, defL);
  if (!script) continue;
  const defSlotIds = new Set((defL || []).map(s => s.id));
  const truth = p.contactSlots || null;
  const runTackled = script.tackleCue && !script.tackleCue.sack;

  if (truth) stamped++;
  if (truth?.tackler && defSlotIds.has(truth.tackler) && script.tackleCue) {
    const want = 'D_' + truth.tackler;
    if (script.tackleCue.id === want) tMatch++;
    else tMiss.push(`${p.type}:${script.tackleCue.id}!=${want}`);
  }
  if (truth?.assist && defSlotIds.has(truth.assist) && script.tackleCue && !script.tackleCue.sack) {
    const want = 'D_' + truth.assist;
    if (script.tackleCue.assistId === want) aMatch++;
    else if (script.tackleCue.id !== want) aMiss.push(`${p.type}:${script.tackleCue.assistId}!=${want}`);
  }
  if (truth?.brokenBy && defSlotIds.has(truth.brokenBy) && !(String(p.type).startsWith('pass') && p.sack)) {
    breaks++;
    if (script.breakCue) {
      breakStaged++;
      const bc = script.breakCue;
      const dA = script.actors.find(a => a.id === bc.id);
      const iBk = Math.round(bc.t / script.step);
      const tr = dA?.track[Math.min(iBk, dA.track.length - 1)];
      const dd = tr ? Math.hypot(tr[0] - bc.x, tr[1] - bc.y) : Infinity;
      if (dd > 1.7) breakBad.push(`${p.type}:d=${dd.toFixed(2)}`);
      if (!script.tackleCue || bc.t < script.tackleCue.t) breakOrder++;
    }
  }
  if (runTackled && script.tackleCue.t != null) {
    pileChecked++;
    const iEnd = Math.round(script.tackleCue.t / script.step);
    const ex = script.tackleCue.x, ey = script.tackleCue.y;
    const inside = [];
    for (const a of script.actors) {
      if (a.team !== 'def') continue;
      const tr = a.track[Math.min(iEnd, a.track.length - 1)];
      if (tr && Math.hypot(tr[0] - ex, tr[1] - ey) < 3.05) inside.push(tr);
    }
    if (inside.length > 3) pileOver.push(`${p.type}:${inside.length}`);
    for (let i = 0; i < inside.length; i++) for (let j = i + 1; j < inside.length; j++) {
      if (Math.hypot(inside[i][0] - inside[j][0], inside[i][1] - inside[j][1]) < 0.5) {
        pileClump.push(p.type);
        i = inside.length;
        break;
      }
    }
  }
  if (truth?.ff && defSlotIds.has(truth.ff) && p.turnover && !String(p.type).startsWith('pass')) {
    strips++;
    if (script.stripCue && script.stripCue.id === 'D_' + truth.ff) stripStaged++;
  }
  if (String(p.type).startsWith('pass') && !p.isScramble && (script.rushCues || []).some(rc => rc.blockerId)) {
    passN++;
    if ((script.blocks || []).some(b => b.rep === 'passpro')) passPro++;
  }
  if (!truth && !p.td && !p.turnover && !p.sack && !p.breakaway && (p.yards || 0) >= 0 && String(p.type).startsWith('run')) {
    fallbackEligible++;
    if (script.tackleCue) fallbackTackles++;
  }
  if (script.breakCue) {
    const again = buildPlayScript(p, offL, defL);
    if (!again?.breakCue || again.breakCue.t !== script.breakCue.t || again.breakCue.id !== script.breakCue.id) detMismatch++;
  }
}

check('truth stamps present in harvest', stamped > 20, `stamped=${stamped}/${snaps.length}`);
check('credited tackler is the staged tackler', tMiss.length === 0 && tMatch > 10, `match=${tMatch} miss=${tMiss.slice(0, 3).join(' ')}`);
check('credited assist is the staged assist', aMiss.length === 0, `match=${aMatch} miss=${aMiss.slice(0, 3).join(' ')}`);
check('credited broken tackles stage a collision', breaks === 0 || breakStaged / breaks >= 0.9, `${breakStaged}/${breaks}`);
check('the staged break happens AT the meeting, before the stop', breakBad.length === 0 && breakOrder === breakStaged, `bad=${breakBad.slice(0, 3).join(' ')} order=${breakOrder}/${breakStaged}`);
check('pile is capped at tackler + assist + one', pileOver.length === 0, `checked=${pileChecked} over=${pileOver.slice(0, 3).join(' ')}`);
check('no two pile bodies share a spot', pileClump.length === 0, `clumped=${pileClump.length}`);
check('credited strips stage the strip man', strips === 0 || stripStaged === strips, `${stripStaged}/${strips}`);
check('pass plays carry pass-pro engagement pairs', passN > 0 && passPro === passN, `${passPro}/${passN}`);
check('plays without truth stamps still stage tackles', fallbackEligible === 0 || fallbackTackles / fallbackEligible > 0.9, `${fallbackTackles}/${fallbackEligible}`);
check('same play scripts the same break (deterministic)', detMismatch === 0, `mismatch=${detMismatch}`);
process.exit(pass ? 0 : 1);
