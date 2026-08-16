// gen_sep_fixture.mjs — rebuilds tools/sep_pairs_fixture.json from the LIVE engine.
//
// The fixture is 600 REAL receiver-vs-defender pairs per depth×technique bucket, captured
// from simulated games via the __sepAB instrument in sim.js. It must be the in-world
// population, not a synthetic one — the whole reason the gate exists is that a synthetic
// population lied by up to 0.23 on deep/zone. Rows are [SPD,AGI,TEC,AWR,HND,JMP,STR,comp],
// the shape tools/sep_probe.mjs unpacks.
//
// Usage: node tools/gen_sep_fixture.mjs [games] [--write]
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const GAMES = parseInt(process.argv[2] || '400', 10);
const WRITE = process.argv.includes('--write');
const PER_BUCKET = 600;
const ATTRS = ['SPD', 'AGI', 'TEC', 'AWR', 'HND', 'JMP', 'STR'];
const BUCKETS = [];
for (const d of ['short', 'medium', 'deep']) for (const t of ['press', 'offman', 'zone']) BUCKETS.push(`${d}/${t}`);

const genRoster = id => { const r = []; for (const [pos, c] of Object.entries(ROSTER_TARGETS)) for (let i = 0; i < c; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], 1); p.schoolId = id; r.push(p); } return r; };
// press and zone occur naturally in BALANCED play, so capture them there (the real
// in-world population). Off-man (man + pressLevel 'off') never happens in balanced
// play, so a fraction of games force it purely to fill that one bucket. This keeps
// the common buckets representative instead of biased by a forced full-man scheme.
const FLAVORS = {
  balanced: {},                                          // natural press + zone
  offman:   { covStyle: 'man', pressLevel: 'off' },      // fills the off-man bucket only
};
const gp = (flavor) => ({ offFormation:'Pro-Set', tendency:'Balanced', rushInPct:50, passDepth:{short:40,medium:35,deep:25}, blitzPct:20, defFormation:'Balanced D', fourthDown:'Moderate', clockMgmt:'Normal', maxFGDist:42, ...FLAVORS[flavor] });
const sH = { id:'H', name:'Home' }, sA = { id:'A', name:'Away' };
const row = a => [a.SPD, a.AGI, a.TEC, a.AWR, a.HND, a.JMP, a.STR, a.comp];

globalThis.__sepAB = [];
const seen = {}; const raw = {}; const other = {};
for (const b of BUCKETS) { seen[b] = 0; raw[b] = []; }
const OFFMAN_BUCKETS = ['short/offman', 'medium/offman', 'deep/offman'];

for (let i = 0; i < GAMES; i++) {
  // Force off-man only while its buckets are still short; otherwise play balanced.
  const offmanShort = OFFMAN_BUCKETS.some(b => raw[b].length < PER_BUCKET);
  const flavor = (offmanShort && i % 2 === 1) ? 'offman' : 'balanced';
  globalThis.__sepAB.length = 0;
  const rH = genRoster('H'), rA = genRoster('A');
  const cH = buildDepthChart(rH, gp(flavor)), cA = buildDepthChart(rA, gp(flavor));
  simulateGame(sH, sA, rH, rA, cH, cA, gp(flavor), gp(flavor));
  for (const e of globalThis.__sepAB) {
    if (!e.da) continue;                       // uncovered — not a duel pair
    const b = `${e.d}/${e.t}`;
    if (!(b in seen)) { other[e.t] = (other[e.t] || 0) + 1; continue; }
    seen[b]++;
    if (raw[b].length < PER_BUCKET * 3) raw[b].push([row(e.ra), row(e.da)]);   // keep a surplus to sample from
  }
  if (BUCKETS.every(b => raw[b].length >= PER_BUCKET) && i > 20) { console.log(`enough by game ${i}`); break; }
}

console.log('captured pairs per bucket (want ≥600):');
for (const b of BUCKETS) console.log(`  ${b.padEnd(14)} ${seen[b]}`);
if (Object.keys(other).length) console.log('  (coverage types outside the 9 buckets, skipped):', other);

// Sample exactly PER_BUCKET from each bucket's surplus (shuffle for representativeness).
const fixture = {};
let short = 0;
for (const b of BUCKETS) {
  const pool = raw[b];
  for (let i = pool.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
  if (pool.length < PER_BUCKET) { short++; console.log(`  ⚠ ${b}: only ${pool.length} pairs`); }
  fixture[b] = pool.slice(0, PER_BUCKET);
}

if (WRITE && short === 0) {
  const path = join(dirname(fileURLToPath(import.meta.url)), 'sep_pairs_fixture.json');
  writeFileSync(path, JSON.stringify(fixture));
  console.log(`\nWROTE ${path}  (${BUCKETS.length} buckets × ${PER_BUCKET} pairs)`);
} else if (short > 0) {
  console.log(`\nNOT WRITING — ${short} bucket(s) short of ${PER_BUCKET}. Raise the game count.`);
} else {
  console.log(`\nDRY RUN ok — all buckets have ${PER_BUCKET}. Re-run with --write to save.`);
}
