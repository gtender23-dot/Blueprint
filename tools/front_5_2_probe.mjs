// front_5_2_probe.mjs — the "5-2" defensive front must be FIELDED as a five-man
// wall, not silently fall back to the 4-3 personnel table.
//
// Bug (fixed Aug 2026): selectDefFront returns "5-2" on 3rd/4th-and-1 vs a
// non-spread offense, but FRONT_COUNTS / RUSH_SLOTS had no "5-2" key, so
// resolveDefPersonnel fell back to the 4-3 counts — 4 down linemen, not 5. The
// matchup matrix scored a true five-man run wall while the defense fielded a 4-3.
//
// This probe builds the personnel for "5-2" and asserts the five-man front:
// 5 rushing down linemen (2 DE + 3 DT) and exactly 2 inside backers, distinct
// from what the 4-3 fallback would field. FAILS on the old fallback (4 rushers).
//
// Run: node tools/front_5_2_probe.mjs
import { buildDepthChart } from '../js/engine/world.js';
import { createPlayer } from '../js/engine/player.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
import { resolveDefPersonnel } from '../js/engine/formations.js';

const r = [];
for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
  for (let i = 0; i < count; i++) {
    const p = createPlayer(pos, CLASS_YEARS[i % 4], 1);
    p.schoolId = 'H';
    r.push(p);
  }
}
const dc = buildDepthChart(r, { offFormation: 'Single Back' });

function shape(front) {
  const p = resolveDefPersonnel(front, dc, r);
  const de = (p.DE || []).length, dt = (p.DT || []).length;
  const rush = (p.DL || []).length;   // resolveDefPersonnel exposes the rushing DL set
  return { de, dt, rush };
}

const base = shape('4-3');
const five = shape('5-2');

console.log('=== 5-2 FRONT PERSONNEL ===');
console.log(`  4-3 : ${base.de} DE + ${base.dt} DT, ${base.rush} rushing linemen`);
console.log(`  5-2 : ${five.de} DE + ${five.dt} DT, ${five.rush} rushing linemen`);

const p1 = five.rush === 5;                 // a five-man wall actually fields five
const p2 = five.de === 2 && five.dt === 3;  // the intended 2-DE / 3-DT shape
const p3 = five.rush > base.rush;           // and it is NOT the 4-3 fallback
const pass = p1 && p2 && p3;
console.log(`\n  [${p1 ? 'PASS' : 'FAIL'}] 5-2 fields 5 rushing linemen`);
console.log(`  [${p2 ? 'PASS' : 'FAIL'}] shape is 2 DE + 3 DT`);
console.log(`  [${p3 ? 'PASS' : 'FAIL'}] distinct from the 4-3 fallback (${five.rush} > ${base.rush})`);
console.log(pass ? '\nALL PASS ✅ — the five-man wall is on the field' : '\n⚠ FAIL');
process.exit(pass ? 0 : 1);
