// practice_career_impact.mjs — what a frozen attribute costs over a career.
//
// development.js skips any attribute with zero practice weight (`if (w === 0) continue`),
// so an attribute that counts toward OVR but gets no drill minutes is frozen at its spawn
// value for a whole career. Practice plans are now DERIVED from POS_WEIGHTS
// (js/ui/views/practice.js), which makes that impossible by construction.
//
// The old hand-tuned table is kept below as a frozen baseline so the before/after stays
// reproducible after the source stopped carrying it. Do not "fix" these numbers to match
// the new plans — they are history, and the point is the delta.
//
// Usage: node tools/practice_career_impact.mjs [cohortSize]

import { POS_WEIGHTS, ATTRIBUTES, POSITIONS } from '../js/constants.js';
import { createPlayer, refreshRatings }       from '../js/engine/player.js';
import { developPlayer }                      from '../js/engine/development.js';
import { planFromWeights }                    from '../js/ui/views/practice.js';

// Snapshot of DEFAULT_POSITION_PLANS as it shipped before the derivation landed.
const LEGACY_PLANS = {
  QB  : { SPD: 6, AGI: 8, STR:16, SEC:12, TEC:28, AWR:30 },
  RB  : { SPD:16, AGI:18, PWR:12, STR: 8, HND: 8, SEC:14, BLK: 4, TEC:10, AWR:10 },
  WR  : { SPD:20, AGI:16, STR: 2, JMP:10, HND:24, SEC: 6, TEC:12, AWR:10 },
  TE  : { SPD: 8, AGI: 8, STR:12, JMP: 8, HND:18, SEC: 6, BLK:16, TEC:10, AWR:14 },
  OL  : { AGI:12, PWR: 4, STR:22, BLK:34, TEC:12, AWR:16 },
  DE  : { SPD:14, AGI:12, PWR:14, STR:20, TKL:22, TEC:10, AWR: 8 },
  OLB : { SPD:18, AGI:16, PWR: 6, STR:10, HND: 2, TKL:22, TEC:10, AWR:16 },
  DT  : { SPD: 6, AGI: 8, PWR:20, STR:24, TKL:22, TEC:12, AWR: 8 },
  LB  : { SPD:13, AGI:11, PWR: 4, STR:10, JMP: 4, HND: 4, TKL:22, TEC:14, AWR:18 },
  CB  : { SPD:20, AGI:16, STR: 6, JMP: 8, HND: 8, TKL:10, TEC:10, AWR:22 },
  S   : { SPD:17, AGI:13, STR: 6, JMP: 8, HND: 8, TKL:15, TEC:12, AWR:21 },
  K   : { STR:40, TEC:44, AWR:16 },
  P   : { STR:38, TEC:40, AWR:22 },
};

const COACH  = { skills: {} };                    // neutral coach, no developer bonus
const SCHOOL = { facilities: { training: 2 } };   // neutral facilities
const YEARS  = ['FR', 'SO', 'JR', 'SR'];
const N      = Number(process.argv[2] || 400);

function career(plan, seeds) {
  const out = [];
  for (const proto of seeds) {
    const p = JSON.parse(JSON.stringify(proto));
    for (const yr of YEARS) {
      p.classYear = yr;
      for (let wk = 0; wk < 16; wk++) developPlayer(p, plan, COACH, 1, SCHOOL);  // 16 practice weeks
    }
    refreshRatings(p);
    out.push({ ovr: p.compositeRating || 0, attrs: { ...p.attributes } });
  }
  return out;
}

const mean = xs => xs.reduce((s, v) => s + v, 0) / (xs.length || 1);
const LIVE = POSITIONS.filter(p => POS_WEIGHTS[p] && LEGACY_PLANS[p]);

console.log(`Career development — ${N} players per position, 4 years x 16 practice weeks`);
console.log('neutral coach, neutral facilities, identical spawns under both plans\n');
console.log('pos      OVR old    OVR derived     delta   was frozen under the old plan');

let total = 0;
for (const pos of LIVE) {
  const seeds = Array.from({ length: N }, () => createPlayer(pos, 'FR', 1));
  const a = mean(career(LEGACY_PLANS[pos], seeds).map(x => x.ovr));
  const b = mean(career(planFromWeights(pos), seeds).map(x => x.ovr));
  const w = POS_WEIGHTS[pos];
  const wTot = Object.values(w).reduce((s, v) => s + v, 0);
  const frozen = ATTRIBUTES
    .filter(at => (w[at] || 0) > 0 && !(LEGACY_PLANS[pos][at] > 0))
    .map(at => `${at} (${((w[at] / wTot) * 100).toFixed(0)}%)`);
  total += b - a;
  console.log(`${pos.padEnd(7)}${a.toFixed(1).padStart(8)}${b.toFixed(1).padStart(15)}` +
              `${((b - a >= 0 ? '+' : '') + (b - a).toFixed(1)).padStart(10)}   ${frozen.join(', ') || '—'}`);
}
console.log(`\naverage OVR change: ${(total / LIVE.length >= 0 ? '+' : '')}${(total / LIVE.length).toFixed(2)}`);

// The sharpest case: PWR drives short-pass zip in the arm model, not just OVR.
const seeds = Array.from({ length: N }, () => createPlayer('QB', 'FR', 1));
const oldQB = career(LEGACY_PLANS.QB, seeds), newQB = career(planFromWeights('QB'), seeds);
console.log('\nQB PWR after four years (the arm model reads PWR for short-pass zip):');
console.log(`  old plan (no PWR drill): ${mean(oldQB.map(x => x.attrs.PWR)).toFixed(1)}  — spawn value, never moved`);
console.log(`  derived plan:            ${mean(newQB.map(x => x.attrs.PWR)).toFixed(1)}`);

// Specialists now read STR+PWR for leg and TEC+AWR for accuracy.
for (const pos of ['K', 'P']) {
  const s2 = Array.from({ length: N }, () => createPlayer(pos, 'FR', 1));
  const o = career(LEGACY_PLANS[pos], s2), n = career(planFromWeights(pos), s2);
  console.log(`\n${pos} after four years:`);
  for (const at of ['STR', 'PWR', 'TEC', 'AWR']) {
    console.log(`  ${at}  old ${mean(o.map(x => x.attrs[at])).toFixed(1).padStart(5)}   derived ${mean(n.map(x => x.attrs[at])).toFixed(1).padStart(5)}`);
  }
}
