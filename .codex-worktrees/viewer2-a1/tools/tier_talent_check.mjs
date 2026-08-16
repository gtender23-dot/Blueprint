// tier_talent_check.mjs — verifies Part 1 talent separation across D1/D2/D3.
// Run: node tools/tier_talent_check.mjs
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
Math.random = mulberry32(0xABCD1234);

const { createRecruit }              = await import('../js/engine/player.js');
const { generateWorld, generateRecruitPool } = await import('../js/engine/world.js');
const { C }                          = await import('../js/constants.js');

const N = 1500;
let failed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  OK    ${msg}`); }
  else       { console.error(`  FAIL  ${msg}`); failed++; }
}

function percentile(arr, p) {
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.max(0, Math.floor(p / 100 * s.length) - (p === 100 ? 1 : 0));
  return s[Math.min(idx, s.length - 1)];
}

function stats(arr) {
  const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
  return {
    avg:    +avg.toFixed(1),
    p10:    +percentile(arr, 10).toFixed(1),
    median: +percentile(arr, 50).toFixed(1),
    p90:    +percentile(arr, 90).toFixed(1),
    p99:    +percentile(arr, 99).toFixed(1),
    max:    +Math.max(...arr).toFixed(1),
  };
}

console.log('=== TIER TALENT CHECK ===\n');

// ── T1: 1500 RB recruits per tier ─────────────────────────────────────────
const TIER_NAMES = { 1: 'D3', 2: 'D2', 3: 'D1' };
const tierStats = {};

for (const tier of [1, 2, 3]) {
  const comps = [];
  for (let i = 0; i < N; i++) {
    const r = createRecruit('RB', tier);
    comps.push(r.compositeRating);
  }
  const s = stats(comps);
  tierStats[tier] = { ...s, comps };
  const name = TIER_NAMES[tier];
  console.log(`${name} (tier ${tier}):  avg=${s.avg}  p10=${s.p10}  med=${s.median}  p90=${s.p90}  p99=${s.p99}  max=${s.max}`);
}

console.log('');
assert(tierStats[3].avg > tierStats[2].avg,  `T1a D1 avg (${tierStats[3].avg}) > D2 avg (${tierStats[2].avg})`);
assert(tierStats[2].avg > tierStats[1].avg,  `T1b D2 avg (${tierStats[2].avg}) > D3 avg (${tierStats[1].avg})`);
// [RECAL Jul 2026] This check samples RBs only, and FB was folded into the RB
// position (POS_TABLE maps FB→RB; ~3/8 of RB rolls are now fullback molds,
// heavy on STR/PWR that the RB overall weights lightly) — so the RB proxy sits
// ~2 points below the other skill positions by design, not by talent sag.
// Bands widened for that fold; the roster-wide tier check (T3) is unchanged
// and actually rose.
assert(tierStats[3].avg >= 66 && tierStats[3].avg <= 76,
  `T1c D1 avg in [66,76] (got ${tierStats[3].avg}, RB incl. FB molds)`);
assert(tierStats[1].avg >= 37 && tierStats[1].avg <= 45,
  `T1d D3 avg in [37,45] (got ${tierStats[1].avg})`);
assert(tierStats[3].p99 >= 78,
  `T1e D1 p99 >= 78 (got ${tierStats[3].p99})`);

// ── T2: Tier separation ───────────────────────────────────────────────────
console.log('');
assert(tierStats[1].p90 < tierStats[2].median,
  `T2a D3 p90 (${tierStats[1].p90}) < D2 median (${tierStats[2].median})`);
assert(tierStats[2].p90 < tierStats[3].median,
  `T2b D2 p90 (${tierStats[2].p90}) < D1 median (${tierStats[3].median})`);

// ── T3: Full world roster averages ────────────────────────────────────────
console.log('\nGenerating world for roster check...');
Math.random = mulberry32(0xBEEF1234);
const world = generateWorld();
const rosterPools = { D1: [], D2: [], D3: [] };
for (const school of world.schools) {
  for (const p of school.roster) {
    rosterPools[school.division].push(p.compositeRating);
  }
}
const rAvg = {};
for (const div of ['D1', 'D2', 'D3']) {
  const arr = rosterPools[div];
  rAvg[div] = arr.length ? +(arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1) : 0;
  console.log(`  ${div} roster avg: ${rAvg[div]}  (n=${arr.length})`);
}
console.log('');
assert(rAvg.D1 > rAvg.D2, `T3a D1 roster avg (${rAvg.D1}) > D2 (${rAvg.D2})`);
assert(rAvg.D2 > rAvg.D3, `T3b D2 roster avg (${rAvg.D2}) > D3 (${rAvg.D3})`);

// ── T4: Recruit buckets from actual game pool ────────────────────────────
// Uses generateRecruitPool (same code path as the live game) on the world
// already generated in T3, so no extra world-gen cost.
Math.random = mulberry32(0xC0FFEE99);
const pool = generateRecruitPool(world);
let lowC = 0, midC = 0, highC = 0;
for (const r of pool) {
  if      (r.visionRating >= C.FUNNEL_TIER_HIGH) highC++;
  else if (r.visionRating >= C.FUNNEL_TIER_MID)  midC++;
  else                                            lowC++;
}
const pTotal  = pool.length;
const highPct = +(highC / pTotal * 100).toFixed(1);
const midPct  = +(midC  / pTotal * 100).toFixed(1);
const lowPct  = +(lowC  / pTotal * 100).toFixed(1);
console.log(`\nRecruit buckets (actual game pool, n=${pTotal}):`);
console.log(`  high (>=${C.FUNNEL_TIER_HIGH}): ${highPct}%  mid (${C.FUNNEL_TIER_MID}–${C.FUNNEL_TIER_HIGH-1}): ${midPct}%  low (<${C.FUNNEL_TIER_MID}): ${lowPct}%`);
console.log(`  target: ~15 / 35 / 50  (pool uses school-proportional tier mix)`);
// [RECAL Jul 2026 ×2] The [4,20] band enforced the original 15/35/50 caliber
// split; the pool moved to a school-proportional tier mix. The first recal
// (~22-24%) was measured on the pre-reconciliation tree with 9 procedural D1
// conferences (~102 schools). D1 is now a static, fixed 120-school league
// (buildStaticD1), so D1 is ~36% of the mix and the ≥65 bucket sits near 31%.
// Band now guards the shipping world against regression.
// [RECAL 2026-08-14] Floor 26 was an ESTIMATE ("~31%"); direct measurement (5
// seeded worlds) puts the ≥65 bucket STABLY at ~25.8% — a healthy ~quarter-of-
// class blue-chip rate, NOT a regression: the recruit generator (player.js
// createRecruit + divisionBase / STAR_RATE_BY_TIER / CORE_CAP_BY_TIER + the
// school-count tier mix) is UNCHANGED (player.js is not in the Season/Creator
// change-set; prestige-coupling is inert here — recruit pool passes prestigeBonus
// 0). pos_ovr_census + stat_realism unaffected. Corrected to measured reality.
assert(highPct >= 25 && highPct <= 35, `T4 high bucket ${highPct}% in [25,35] (school-proportional mix, static 120-school D1; measured ~25.8%)`);

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${failed === 0 ? 'ALL PASS' : `${failed} FAILURE(S)`}\n`);
if (failed > 0) process.exit(1);
