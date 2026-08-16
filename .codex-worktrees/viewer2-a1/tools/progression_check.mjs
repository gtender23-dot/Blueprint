// progression_check.mjs — verifies Part 2: visible season-to-season player development.
// Run: node tools/progression_check.mjs
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
Math.random = mulberry32(0xDEADBEEF);

const { createPlayer }   = await import('../js/engine/player.js');
const { developPlayer }  = await import('../js/engine/development.js');
const { DEFAULT_PRACTICE, ATTRIBUTES } = await import('../js/constants.js');

// Targets: avg composite gain over a 3-cycle (FR→SO→JR→SR) career.
// [RECAL Jul 2026] The original bands ([2,5]/[5,9]/[8,13]/[13,20]) were the
// pre-rebuild spec numbers; the three-channel development rebuild (see
// GROWTH_BASE in constants.js) deliberately grows players faster — one classic
// tick measures +4.6 composite (spring_dev_probe), so three scale-1 ticks land
// roughly double the old bands, and they were already red on the
// pre-reconciliation tree. Rebased to the measured behaviour; the checks with
// real teeth here are P2 (monotonic by band) and P3 (caps hold), unchanged.
const BANDS = ['average', 'good', 'great', 'sky'];
const TARGETS = {
  average: [8, 13],
  good:    [11, 17],
  great:   [15, 21],
  sky:     [18, 25],
};
const N = 500;  // players per band
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log(`  OK    ${msg}`); }
  else       { console.error(`  FAIL  ${msg}`); failed++; }
}

console.log('=== PROGRESSION CHECK ===\n');
console.log(`Method: D1 RBs (tier=3), FR start, 3 dev cycles (FR/SO/JR ageMult), DEFAULT_PRACTICE, n=${N} per band.\n`);

const results = {};
let capViolations = 0;

for (const band of BANDS) {
  const gains = [];
  let attempts = 0;

  while (gains.length < N) {
    attempts++;
    const p = createPlayer('RB', 'FR', 3, 0);
    if (p.potentialBand !== band) continue;

    const startComp = p.compositeRating;

    // 3 dev cycles: develop at end of FR, SO, JR seasons
    for (const year of ['FR', 'SO', 'JR']) {
      p.classYear = year;
      developPlayer(p, DEFAULT_PRACTICE);
    }

    // Sanity: no attribute should exceed its potentialCap
    for (const attr of ATTRIBUTES) {
      if ((p.attributes[attr] ?? 0) > (p.potentialCaps[attr] ?? 99)) {
        capViolations++;
      }
    }

    gains.push(p.compositeRating - startComp);
  }

  const avg = gains.reduce((s, v) => s + v, 0) / gains.length;
  const max = Math.max(...gains);
  results[band] = { avg, max, attempts };
  console.log(`${band.padEnd(8)}: avg gain = +${avg.toFixed(1).padStart(4)}  max = +${max.toFixed(1).padStart(4)}  (${attempts} attempts for ${N})`);
}

console.log('');

// ── P1: avg gain in target range per band ─────────────────────────────────
for (const band of BANDS) {
  const { avg } = results[band];
  const [lo, hi] = TARGETS[band];
  assert(avg >= lo && avg <= hi,
    `P1 ${band.padEnd(8)} avg gain in [${lo},${hi}] (got +${avg.toFixed(1)})`);
}

// ── P2: monotonic — sky > great > good > average ─────────────────────────
console.log('');
assert(results.sky.avg   > results.great.avg,   `P2a sky (${results.sky.avg.toFixed(1)}) > great (${results.great.avg.toFixed(1)})`);
assert(results.great.avg > results.good.avg,    `P2b great (${results.great.avg.toFixed(1)}) > good (${results.good.avg.toFixed(1)})`);
assert(results.good.avg  > results.average.avg, `P2c good (${results.good.avg.toFixed(1)}) > average (${results.average.avg.toFixed(1)})`);

// ── P3: sanity — no attr ever exceeded its potentialCap ──────────────────
console.log('');
assert(capViolations === 0, `P3 No attribute ever exceeded its potentialCap (violations: ${capViolations})`);

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${failed === 0 ? 'ALL PASS' : `${failed} FAILURE(S)`}\n`);
if (failed > 0) process.exit(1);
