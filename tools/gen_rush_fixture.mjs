// gen_rush_fixture.mjs — rebuilds tools/rush_pairs_fixture.json from the LIVE engine.
//
// The fixture is real resolvePassRush snapshots captured from simulated games
// via the __rushCap instrument in sim.js (Rung 7 Phase E — mirrors Phase D's
// __sepAB / gen_sep_fixture.mjs). It must be the in-world population, not a
// synthetic one — the probe's whole discipline is probe population == engine
// population. Rows are the compact shape tools/rush_probe.mjs unpacks:
//   { pm, bd, dna, pa, pk, reps: [{ f, r:[SPD,AGI,STR,PWR,TEC,AWR], b:[...]|null }] }
//   f bits: 1=penetrated, 2=free blitzer, 4=speed rush, 8=power rush, 16=edge path
//
// Usage: node tools/gen_rush_fixture.mjs [games] [--write]
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const GAMES = parseInt(process.argv[2] || '150', 10);
const WRITE = process.argv.includes('--write');
// rush_probe's tail bucket (pen=4) is its noisiest — it needs a real n there.
const PEN4_MIN = 200;

const genRoster = id => { const r = []; for (const [pos, c] of Object.entries(ROSTER_TARGETS)) for (let i = 0; i < c; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], 1); p.schoolId = id; r.push(p); } return r; };
const gp = () => ({ offFormation:'Pro-Set', tendency:'Balanced', rushInPct:50, passDepth:{short:40,medium:35,deep:25}, blitzPct:20, defFormation:'Balanced D', fourthDown:'Moderate', clockMgmt:'Normal', maxFGDist:42 });
const sH = { id:'H', name:'Home' }, sA = { id:'A', name:'Away' };

// Same edge test as resolvePocket (rushgeo.js): power/speed rushes are edge
// paths by definition; otherwise position decides.
const isEdge = rep => rep.power || rep.speed || /^(DE|OLB|LB-Edge)/.test(rep.pos || '');
const A6 = a => a ? [a.SPD, a.AGI, a.STR, a.PWR, a.TEC, a.AWR] : null;

globalThis.__rushCap = [];
const rows = [];
const penCount = {};
for (let i = 0; i < GAMES; i++) {
  globalThis.__rushCap.length = 0;
  const rH = genRoster('H'), rA = genRoster('A');
  const cH = buildDepthChart(rH, gp()), cA = buildDepthChart(rA, gp());
  simulateGame(sH, sA, rH, rA, cH, cA, gp(), gp());
  for (const s of globalThis.__rushCap) {
    if (!s.r?.length) continue;
    const reps = s.r.map(rep => ({
      f: (rep.pen ? 1 : 0) | (rep.blitzer ? 2 : 0) | (rep.speed ? 4 : 0)
       | (rep.power ? 8 : 0) | (isEdge(rep) ? 16 : 0),
      r: A6(rep.a), b: A6(rep.b),
    }));
    const pen = s.r.filter(rep => rep.pen).length;
    penCount[pen] = (penCount[pen] || 0) + 1;
    rows.push({ pm: s.protectMult, bd: s.blitzDesign, dna: s.dnaPressureGrade,
                pa: s.paBite, pk: s.passKey, reps });
  }
  if (rows.length && (penCount[4] || 0) >= PEN4_MIN && i > 40) { console.log(`enough by game ${i}`); break; }
}

console.log(`captured ${rows.length} snapshots; by penetrator count:`);
for (const k of Object.keys(penCount).sort((a, b) => a - b)) console.log(`  pen=${k}  n=${penCount[k]}`);

if (WRITE && (penCount[4] || 0) >= PEN4_MIN) {
  const path = join(dirname(fileURLToPath(import.meta.url)), 'rush_pairs_fixture.json');
  writeFileSync(path, JSON.stringify(rows));
  console.log(`\nWROTE ${path}  (${rows.length} snapshots)`);
} else if ((penCount[4] || 0) < PEN4_MIN) {
  console.log(`\nNOT WRITING — pen=4 tail has ${(penCount[4] || 0)} (< ${PEN4_MIN}). Raise the game count.`);
} else {
  console.log(`\nDRY RUN ok. Re-run with --write to save.`);
}
