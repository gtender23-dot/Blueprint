// recruit_tier_gate_probe.mjs — divisions must recruit ONLY their own weight
// class. Measures cross-tier overlap in the AI suitor graph (every rival a
// recruit collects is a school actively recruiting him) and in the player-
// visible pool, contrasting the OLD reach bands (13%/12%) against the new
// STRICT gate. Also checks supply: strict gating must not starve boards.
// Run: node tools/recruit_tier_gate_probe.mjs [worlds]
import { C } from '../js/constants.js';
import { generateWorld, generateRecruitPool } from '../js/engine/world.js';
import { calibreVisible, tierOf } from '../js/engine/recruiting.js';

const WORLDS = parseInt(process.argv[2] || '4', 10);
const TIER = { D1: 3, D2: 2, D3: 1 };

// Measure overlap for a world whose pool/AI graph was built under the CURRENT
// C.RECRUIT_REACH_* values.
function measure(world) {
  const schools = world.schools;
  const recruits = world.recruits;
  const divOf = Object.fromEntries(schools.map(s => [s.id, s.division]));

  // 1) AI suitor graph: how many (recruit, school) pairings cross a tier line?
  let rivals = 0, crossRivals = 0;
  for (const r of recruits) {
    for (const rv of (r.rivals || [])) {
      rivals++;
      const schoolDiv = rv.division || divOf[rv.schoolId];
      if (TIER[schoolDiv] !== tierOf(r)) crossRivals++;
    }
  }

  // 2) Player-visible pool purity: for each division, of the recruits it CAN
  //    see (calibreVisible), how many are out of its tier?
  const vis = {}, visCross = {};
  for (const div of ['D1', 'D2', 'D3']) {
    vis[div] = 0; visCross[div] = 0;
    for (const r of recruits) {
      if (!calibreVisible(r, div)) continue;
      vis[div]++;
      if (tierOf(r) !== TIER[div]) visCross[div]++;
    }
  }

  // 3) Supply/starvation: schools with open slots that still got a full-ish
  //    board (targetIds). A strict gate that starved a tier would show boards
  //    far under their slot demand.
  let withSlots = 0, boardsFilled = 0;
  for (const s of schools) {
    const rec = s.coach?.aiRec;
    if (!rec || rec.slots <= 0) continue;
    withSlots++;
    if ((rec.targetIds?.length || 0) >= Math.min(rec.slots, 4)) boardsFilled++;
  }

  return { rivals, crossRivals, vis, visCross, withSlots, boardsFilled };
}

function pct(n, d) { return d ? (100 * n / d).toFixed(1) : '0.0'; }

let sumStrictCross = 0, sumStrictRivals = 0, sumOldCross = 0, sumOldRivals = 0;
let sumFilled = 0, sumSlots = 0;

for (let w = 0; w < WORLDS; w++) {
  const world = generateWorld();  // built under strict defaults (reach = 0)

  // OLD behavior on the SAME schools: reopen the reach bands and rebuild the
  // pool + AI graph to show the overlap the strict gate removes.
  const savedDown = C.RECRUIT_REACH_DOWN, savedUp = C.RECRUIT_REACH_UP;
  C.RECRUIT_REACH_DOWN = 0.13; C.RECRUIT_REACH_UP = 0.12;
  world.recruits = generateRecruitPool(world);
  const old = measure(world);
  // Restore strict and rebuild — this is the shipping config.
  C.RECRUIT_REACH_DOWN = savedDown; C.RECRUIT_REACH_UP = savedUp;
  world.recruits = generateRecruitPool(world);
  const strict = measure(world);

  sumOldCross += old.crossRivals; sumOldRivals += old.rivals;
  sumStrictCross += strict.crossRivals; sumStrictRivals += strict.rivals;
  sumFilled += strict.boardsFilled; sumSlots += strict.withSlots;

  if (w === 0) {
    console.log('Sample world #1 — player-visible pool purity (strict):');
    for (const div of ['D1', 'D2', 'D3'])
      console.log(`  ${div}: ${strict.vis[div]} visible, ${strict.visCross[div]} cross-tier (${pct(strict.visCross[div], strict.vis[div])}%)`);
  }
}

console.log(`\nAI suitor graph (cross-tier pairings), ${WORLDS} worlds:`);
console.log(`  OLD reach bands (13%/12%): ${sumOldCross}/${sumOldRivals} rivals cross a tier (${pct(sumOldCross, sumOldRivals)}%)`);
console.log(`  STRICT gate (shipping):    ${sumStrictCross}/${sumStrictRivals} rivals cross a tier (${pct(sumStrictCross, sumStrictRivals)}%)`);
console.log(`Board supply under strict gating: ${sumFilled}/${sumSlots} schools-with-slots got a full board (${pct(sumFilled, sumSlots)}%)`);

let fail = 0;
const g = (n, ok, d = '') => { if (!ok) fail++; console.log(`${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`); };
console.log('');
g('STRICT gate produces ZERO cross-tier suitor pairings', sumStrictCross === 0, `${sumStrictCross} found`);
g('OLD bands DID produce cross-tier overlap (probe is measuring the right thing)', sumOldCross > 0, `${sumOldCross} pairings`);
g('strict gating does not starve boards (>90% of slotted schools still fill)', pct(sumFilled, sumSlots) >= 90, `${pct(sumFilled, sumSlots)}%`);

console.log(fail ? `\n❌ ${fail} TIER-GATE PROBE FAILURES` : '\n✅ RECRUIT TIER-GATE PROBE PASS');
process.exit(fail ? 1 : 0);
