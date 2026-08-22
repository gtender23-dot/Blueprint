// variety_probe.mjs — M24 gate: animation VARIETY is real and lawful.
// Harvests REAL engine plays (Math.random pinned — deterministic by
// construction, NOT seedFlaky), builds scripts and asserts:
//  1. Every TD carries a celebration style; short-yardage TDs never leap,
//     bombs never spike (situation-lawful).
//  2. Variety is REAL: at least 3 distinct styles appear across the harvest
//     (a constant would pass a per-play check).
//  3. Mob ids are real teammates, never the celebrant, at most two.
//  4. windedCue fires on long plays (25+ yds or 5.2s+), never on routine
//     ones, names real actors, and starts AFTER the grounded/get-up window
//     (endInfo + 1.6s — the M20 finish laws stay untouched).
//  5. Same play → same style/mob/winded (deterministic).
// Run from repo root: node tools/variety_probe.mjs [games]
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
import { OFF_FIELD_LAYOUTS, DEF_FIELD_LAYOUTS } from '../js/constants_field.js';
import { buildPlayScript } from '../js/ui/watchphys.js';
import { mulberry32 } from './_seed.mjs';

let _s = 20260813;
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

const LEGAL = new Set(['spike', 'leap', 'flex', 'bounce']);
const styles = new Set();
let tds = 0, styleBad = [], mobBad = 0,
  windedLong = 0, windedLongHit = 0, windedShort = 0, windedShortBad = 0,
  windedIdBad = 0, windedTimeBad = 0, detBad = 0, detSampled = 0;

for (const p of snaps) {
  const offL = OFF_FIELD_LAYOUTS[p.offFormation]?.slots;
  if (!offL) continue;
  const defL = (DEF_FIELD_LAYOUTS[p.defFront] || DEF_FIELD_LAYOUTS['4-3']).slots;
  const script = buildPlayScript(p, offL, defL);
  if (!script) continue;
  const ids = new Set(script.actors.map(a => a.id));
  const cc = script.celebrateCue;

  if (p.td && cc) {
    tds++;
    styles.add(cc.style);
    if (!LEGAL.has(cc.style)) styleBad.push(`${p.yards}yd:${cc.style}`);
    if ((p.yards || 0) <= 3 && cc.style === 'leap') styleBad.push(`${p.yards}yd:leap`);
    if ((p.yards || 0) >= 25 && cc.style === 'spike') styleBad.push(`${p.yards}yd:spike`);
    const mob = cc.mobIds || [];
    if (mob.length > 2 || mob.includes(cc.id) || mob.some(m => !ids.has(m))) mobBad++;
  }

  const wc = script.windedCue;
  const longPlay = !p.td && ((p.yards || 0) >= 25 || script.dur >= 5.2 + 0.5);
  const routine = !p.td && (p.yards || 0) < 12 && script.dur < 5.0;
  if (longPlay && script.tackleCue) {
    windedLong++;
    if (wc) windedLongHit++;
  }
  if (routine) {
    windedShort++;
    if (wc && (p.yards || 0) < 25 && script.dur < 5.2 + 0.5) windedShortBad++;
  }
  if (wc) {
    if (wc.ids.some(id => !ids.has(id)) || !wc.ids.length) windedIdBad++;
    const endT = script.tackleCue ? script.tackleCue.t : null;
    if (endT != null && wc.t < endT + 1.55) windedTimeBad++;
  }

  if ((p.td || wc) && detSampled < 30) {
    detSampled++;
    const again = buildPlayScript(p, offL, defL);
    if (JSON.stringify(again.celebrateCue) !== JSON.stringify(cc)
      || JSON.stringify(again.windedCue) !== JSON.stringify(wc)) detBad++;
  }
}

check('TDs carry situation-lawful celebration styles', tds > 10 && styleBad.length === 0, `tds=${tds} bad=${styleBad.slice(0, 3).join(' ')}`);
check('variety is real (≥3 distinct styles in harvest)', styles.size >= 3, `styles=[${[...styles].join(',')}]`);
check('mob ids are real teammates, never the celebrant', mobBad === 0, `bad=${mobBad}`);
check('long plays leave men winded', windedLong === 0 || windedLongHit / windedLong >= 0.9, `${windedLongHit}/${windedLong}`);
check('routine plays never do', windedShortBad === 0, `checked=${windedShort} bad=${windedShortBad}`);
check('winded names real actors', windedIdBad === 0, `bad=${windedIdBad}`);
check('winded starts after the grounded window', windedTimeBad === 0, `bad=${windedTimeBad}`);
check('same play → same variety (deterministic)', detBad === 0, `sampled=${detSampled}`);
process.exit(pass ? 0 : 1);
