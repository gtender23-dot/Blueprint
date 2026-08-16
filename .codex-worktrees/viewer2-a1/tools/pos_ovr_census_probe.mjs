// pos_ovr_census_probe.mjs — PLAYTEST 2026-08-12 item 3: EVERY POSITION AVERAGES
// ~58, AND OVR_POS_ADJ IS THE THING THAT MAKES IT TRUE.
//
// The owner reported corners rated too high. The cause was documented in the
// source the whole time and nobody re-ran the measurement:
//
//   OVR_POS_ADJ's own comment says each value is (58 − that position's raw
//   mean), sampled over ~70k players in Jul 2026, "so every position averages
//   ~58 and OVR stays comparable across the roster."
//
//   Two lines above the CB core row, a LATER comment records that AWR was added
//   to the DE and CB cores after that census. A core attribute spawns ~0.6×its
//   threshold above base, so that edit silently added ~+3.7 raw OVR to every
//   corner and ~+2.1 to every end — and the calibration constant was never
//   re-derived to absorb it.
//
// This probe is the census, run as a gate. It fails loudly the next time
// somebody edits a core list, a weight row, or an attribute band without
// re-deriving the offsets — which is exactly how this shipped.
//
//   node tools/pos_ovr_census_probe.mjs            # gate (default N)
//   node tools/pos_ovr_census_probe.mjs --derive   # print a corrected block
//
import { generateWorld } from '../js/engine/world.js';
import { OVR_POS_ADJ } from '../js/constants.js';

const DERIVE = process.argv.includes('--derive');
// The constant's own provenance is "~70k generated players across 3 worlds" —
// so the census has to be a WORLD census (every division, at their real
// prestige spread), not a single-tier draw. One world is ~28k players, which is
// plenty to gate on; --derive uses three to match the original sample.
const WORLDS = Number(process.env.CENSUS_WORLDS || (DERIVE ? 3 : 1));
const TARGET = 58;
// Gate band. A world census is a sample, so it needs slack — but the slack has
// to be tighter than the drift it exists to catch (AWR-on-CB was +3.7).
const TOL = 1.6;

const POSITIONS = Object.keys(OVR_POS_ADJ);
// Specialists are exempt from the 58 band ON PURPOSE. Nothing compares a
// kicker's overall to a corner's — the number ranks kickers against kickers —
// and their composite feeds a separately calibrated kicking model, so forcing
// them onto the shared scale buys nothing and moves scoring (the 2026-08-12 A/B
// measured +1.5 pts/team from that change alone). They are still censused and
// printed; they just do not gate.
const SPECIALISTS = new Set(['K', 'P']);
const GATED = POSITIONS.filter((p) => !SPECIALISTS.has(p));

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};

// compositeRating already has posAdjust applied, so the ADJUSTED mean is what we
// measure and the raw mean is recovered by backing the offset out. The probe
// therefore reads the shipping number rather than a reimplementation of it.
const sums = {}, counts = {};
for (const pos of POSITIONS) { sums[pos] = 0; counts[pos] = 0; }
let players = 0;
for (let w = 0; w < WORLDS; w++) {
  const world = generateWorld();
  for (const school of world.schools) {
    for (const p of school.roster || []) {
      if (sums[p.position] == null) continue;
      sums[p.position] += p.compositeRating;
      counts[p.position]++;
      players++;
    }
  }
}
const census = {};
for (const pos of POSITIONS) {
  const adjMean = counts[pos] ? sums[pos] / counts[pos] : TARGET;
  census[pos] = { adjMean, rawMean: adjMean - (OVR_POS_ADJ[pos] || 0), n: counts[pos] };
}

console.log(`\n=== POSITION OVR CENSUS (${WORLDS} world${WORLDS !== 1 ? 's' : ''}, ${players.toLocaleString()} players) ===\n`);
console.log('  pos    adj mean   raw mean   current adj   implied adj   drift');
for (const pos of POSITIONS) {
  const c = census[pos];
  const implied = TARGET - c.rawMean;
  const drift = c.adjMean - TARGET;
  console.log(
    `  ${pos.padEnd(5)} ${c.adjMean.toFixed(2).padStart(8)} ${c.rawMean.toFixed(2).padStart(10)} ` +
    `${String(OVR_POS_ADJ[pos]).padStart(13)} ${implied.toFixed(1).padStart(13)} ${(drift >= 0 ? '+' : '') + drift.toFixed(2).padStart(7)}`
  );
}

if (DERIVE) {
  console.log('\n--- paste over the OVR_POS_ADJ body in js/constants.js ---');
  console.log('    (K and P are exempt — keep their shipped values)');
  for (const pos of POSITIONS) {
    console.log(`  ${pos}: ${(TARGET - census[pos].rawMean).toFixed(1)},`);
  }
  console.log('---\n');
}

console.log('');
const off = GATED.filter((p) => Math.abs(census[p].adjMean - TARGET) > TOL);
check(
  `every position averages ${TARGET} \u00B1 ${TOL} OVR`,
  off.length === 0,
  off.length
    ? `OUT OF BAND: ${off.map((p) => `${p} ${census[p].adjMean.toFixed(1)}`).join(', ')} — re-derive with --derive`
    : `${GATED.length} gated positions (K/P exempt), worst drift ${Math.max(...GATED.map((p) => Math.abs(census[p].adjMean - TARGET))).toFixed(2)}`
);

// The specific complaint: a corner should not out-rate a safety for the same
// player. These two rooms are drawn from near-identical attribute profiles, so a
// gap between their means is calibration drift, not design.
const cbS = census.CB.adjMean - census.S.adjMean;
check('corners and safeties rate on the same scale', Math.abs(cbS) <= TOL,
  `CB ${census.CB.adjMean.toFixed(1)} vs S ${census.S.adjMean.toFixed(1)} (gap ${cbS >= 0 ? '+' : ''}${cbS.toFixed(1)})`);

// And no room may sit more than a rounding error above the most-scrutinised
// position on the field.
const cbQb = census.CB.adjMean - census.QB.adjMean;
check('corners and quarterbacks rate on the same scale', Math.abs(cbQb) <= TOL,
  `CB ${census.CB.adjMean.toFixed(1)} vs QB ${census.QB.adjMean.toFixed(1)} (gap ${cbQb >= 0 ? '+' : ''}${cbQb.toFixed(1)})`);

console.log(`\n${fail === 0 ? 'ALL PASS ✅' : `${fail} FAILURES ❌`}  (${pass} pass, ${fail} fail)`);
process.exit(fail === 0 ? 0 : 1);
