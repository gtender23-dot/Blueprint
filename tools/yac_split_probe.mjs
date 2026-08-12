// ─────────────────────────────────────────────────────────────────────────
// YAC-SPLIT PROBE (subsystem 4, Fix A) — the measurement veto for YAC realism.
//
// WHY: stat_realism_harness reports pass yds / comp% / ypa / WR yds, but NEVER
// segments a completion's yardage into AIR vs YAC. The realism anchor for this
// subsystem (SOURCE_LIBRARY #49) is the ~57% air / ~43% YAC split, and the PFF
// league-average of ~4.4 YAC/reception (#47). Without a probe that measures the
// split, no YAC fix (B-E) can be proven to move the composition toward realism
// WITHOUT breaking ypa. This is that instrument.
//
// It does NOT change how the game books stats. resolvePassPlay still records the
// full air+YAC total as passing/receiving yards. This probe only READS the
// (read-only) result.airYds / result.yacYds instrumentation fields the sim now
// attaches at each completion site, and decomposes the SAME total.
//
// Run: node tools/yac_split_probe.mjs [nGames]
// ─────────────────────────────────────────────────────────────────────────
import { createPlayer, refreshRatings } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

function genRoster(tier, schoolId) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], tier);
      p.schoolId = schoolId;
      r.push(p);
    }
  }
  return r;
}

const gp = { offFormation:'Single Back', tendency:'Balanced', rushInPct:60,
  passDepth:{short:40,medium:40,deep:20}, blitzPct:20, defFormation:'Balanced D',
  fourthDown:'Moderate', clockMgmt:'Normal', maxFGDist:42 };
const sH = { id:'H', name:'Home' }, sA = { id:'A', name:'Away' };
const N = parseInt(process.argv[2] || '400', 10);

// Accumulators
let comps = 0, air = 0, yac = 0;
// by depth band
const band = {}; // key -> {comps, air, yac}
function B(k){ return band[k] ?? (band[k] = { comps:0, air:0, yac:0 }); }
// YAC distribution for an explosive tail
let yacOver10 = 0, yacOver20 = 0;
// screens separately (they should be YAC-heavy)
let scrComps = 0, scrYac = 0;

for (let i = 0; i < N; i++) {
  const rH = genRoster(1, 'H'), rA = genRoster(1, 'A');
  const cH = buildDepthChart(rH, gp), cA = buildDepthChart(rA, gp);
  const res = simulateGame(sH, sA, rH, rA, cH, cA, gp, gp);
  for (const d of res.drives || []) {
    for (const pl of d.plays || []) {
      if (!pl || !pl.complete) continue;
      if (pl.airYds == null || pl.yacYds == null) continue; // only pass completions carry the split
      comps++; air += pl.airYds; yac += pl.yacYds;
      const b = B(pl.passDepth || '?');
      b.comps++; b.air += pl.airYds; b.yac += pl.yacYds;
      if (pl.yacYds > 10) yacOver10++;
      if (pl.yacYds > 20) yacOver20++;
      if (pl.isScreen) { scrComps++; scrYac += pl.yacYds; }
    }
  }
}

const f1 = x => x.toFixed(1), f2 = x => x.toFixed(2);
const pct = (a, b) => b ? (100*a/b) : 0;
const total = air + yac;
const chk = (v, lo, hi) => (v >= lo && v <= hi) ? '  OK' : '  <-- off';

console.log(`=== YAC-SPLIT PROBE (n=${N} games, ${comps} pass completions) ===\n`);
console.log(`Air yds/comp:      ${f2(air/comps)}`);
console.log(`YAC yds/comp:      ${f2(yac/comps)}    [PFF real ~4.4]${chk(yac/comps, 4.0, 4.8)}`);
console.log(`Total yds/comp:    ${f2(total/comps)}`);
console.log(`YAC share:         ${f1(pct(yac,total))}%   [real anchor ~43%]${chk(pct(yac,total), 40, 46)}`);
console.log(`Air share:         ${f1(pct(air,total))}%   [real anchor ~57%]`);
console.log(`\nExplosive YAC tail:`);
console.log(`  comps w/ YAC>10: ${f1(pct(yacOver10,comps))}%   [real ~8-12%]`);
console.log(`  comps w/ YAC>20: ${f1(pct(yacOver20,comps))}%   [real ~2-4%]`);

console.log(`\n=== by depth band (air / YAC per completion) ===`);
console.log(`band       comps    air/c   yac/c   YAC%`);
for (const k of ['short','medium','deep','vdeep','?']) {
  const b = band[k]; if (!b || !b.comps) continue;
  console.log(`${k.padEnd(9)} ${String(b.comps).padStart(6)}   ${f2(b.air/b.comps).padStart(5)}   ${f2(b.yac/b.comps).padStart(5)}   ${f1(pct(b.yac, b.air+b.yac))}%`);
}

console.log(`\n=== screens (should be the most YAC in football) ===`);
if (scrComps) console.log(`screen comps: ${scrComps}   YAC/comp: ${f2(scrYac/scrComps)}   [PFF: screens = highest YAC]`);
else console.log(`(no screen completions captured this run)`);
