// fb_slot_probe.mjs — can the coach put his POWER back at fullback and his SPEED back at
// halfback, and does the field actually honour it?
//
// The reported case: RB1 is a power back, RB2 is a speed back carrying 40% of the load.
// The coach wants the power man leading and the speed man running. Before this, naming a
// fullback could not express that — the running slots claimed from the RB room first, so
// the power back was taken for HB and the fullback spot got the leftovers.
//
// Three things are checked, because three separate things were wrong:
//
//   1. POOL      — the FB slot is a mesh spot: RB *or* TE. It carries pos:'RB' in the
//                  layouts, so it can't live in MESH_AUTO_POOL and had to be special-cased.
//                  A thin backfield should put a tight end in front, not leave it empty.
//   2. PRIORITY  — naming a fullback makes the FB slot resolve BEFORE the running slots,
//                  the same way naming a joker makes SLOT resolve first. Leave it on Auto
//                  and the old default holds: best back at HB, FB takes the next man.
//   3. THE SIM   — the depth chart and the game must agree. sim.js carried only SLOT out of
//                  depthOrder, so a named FB showed on the depth-chart screen and never
//                  reached the field. That is why promoting a fullback felt like a no-op.
//
// Usage: node tools/fb_slot_probe.mjs
import { resolveSlots }      from '../js/engine/fieldassign.js';
import { OFF_FIELD_LAYOUTS } from '../js/constants_field.js';

const FORMATION = 'Power-I';                      // has a real FB slot
const layout = OFF_FIELD_LAYOUTS[FORMATION];
const slots  = layout.slots;
const isFb   = s => s.role === 'FB-Lead' || s.label === 'FB' || s.label === 'B';
const fbSlot = slots.find(isFb);
const hbSlot = slots.find(s => s.pos === 'RB' && !isFb(s));

// A tiny, legible roster: two backs and two tight ends, best-first in each room.
const POWER = 'rb_power', SPEED = 'rb_speed', TE1 = 'te_block', TE2 = 'te_two', TE3 = 'te_three';
const NAMES = { [POWER]: 'POWER back (RB1)', [SPEED]: 'SPEED back (RB2)',
                [TE1]: 'blocking TE (TE1)', [TE2]: 'TE2', [TE3]: 'TE3', null: '(nobody)' };
// Power-I fields TWO tight ends (Y and U). With only two on the roster both are spoken for
// before the fullback spot is reached, and the probe would be measuring its own fixture
// rather than the resolver. Three is the smallest roster that leaves a body over.
const posOf = id => (id?.startsWith('rb') ? 'RB' : id?.startsWith('te') ? 'TE' : null);

const run = (depth, label) => {
  const { bySlot } = resolveSlots(slots, {}, depth, null, posOf);
  const fb = bySlot[fbSlot.id] || null;
  const hb = bySlot[hbSlot.id] || null;
  console.log(`  ${label.padEnd(38)} FB: ${(NAMES[fb] || fb || '(nobody)').padEnd(22)} HB: ${NAMES[hb] || hb || '(nobody)'}`);
  return { fb, hb };
};

let fails = 0;
const check = (cond, msg) => { if (!cond) { fails++; console.log(`     FAIL — ${msg}`); } };

console.log(`FB slot resolution — ${FORMATION} (FB slot "${fbSlot.id}", HB slot "${hbSlot.id}")\n`);

// ── 1. default: nobody named ───────────────────────────────────────────────
console.log('1. Nobody named — the default should be unchanged');
{
  const r = run({ RB: [POWER, SPEED], TE: [TE1, TE2, TE3] }, 'RB room [power, speed]');
  check(r.hb === POWER, 'the best back should still play HB when no fullback is named');
  check(r.fb === SPEED, 'FB should take the next back');
}

// ── 2. the reported case ───────────────────────────────────────────────────
console.log('\n2. Coach names the POWER back as his fullback');
{
  const r = run({ RB: [POWER, SPEED], TE: [TE1, TE2, TE3], FB: [POWER] }, 'FB: [power]');
  check(r.fb === POWER, 'the named fullback must play FULLBACK even though he is RB1');
  check(r.hb === SPEED, 'the speed back should slide up to HB');
}

// ── 3. mesh pool: RB *or* TE ───────────────────────────────────────────────
console.log('\n3. The FB spot is a mesh spot — tight ends are eligible');
{
  const r = run({ RB: [POWER], TE: [TE1, TE2, TE3] }, 'one back on the roster');
  check(r.hb === POWER, 'the only back plays HB');
  check(r.fb === TE3, 'with the backfield exhausted the FB spot should take the top TE, not sit empty');

  const named = run({ RB: [POWER, SPEED], TE: [TE1, TE2, TE3], FB: [TE1] }, 'FB: [blocking TE]');
  check(named.fb === TE1, 'a hand-picked tight end must be allowed to play fullback');
  check(named.hb === POWER, 'naming a TE at FB should not disturb the backfield');
}

// ── 4. the named man is unavailable ────────────────────────────────────────
console.log('\n4. The named fullback is hurt / suspended (not in the active depth)');
{
  const r = run({ RB: [SPEED], TE: [TE1, TE2, TE3] }, 'FB named but absent from every room');
  check(r.hb === SPEED, 'the remaining back plays HB');
  check(r.fb === TE3, 'FB falls to the next eligible body');
}

// ── 5. no double-placement ─────────────────────────────────────────────────
console.log('\n5. Nobody plays two spots at once');
{
  const { bySlot } = resolveSlots(slots, {}, { RB: [POWER, SPEED], TE: [TE1, TE2, TE3], FB: [POWER] }, null, posOf);
  const placed = Object.values(bySlot).filter(Boolean);
  check(placed.length === new Set(placed).size, 'a player was assigned to two slots');
  console.log(`  ${String(placed.length).padStart(2)} slots filled, ${new Set(placed).size} distinct players`);
}

console.log(fails ? `\nFAIL — ${fails} check(s)` : '\nPASS — all checks');
process.exit(fails ? 1 : 0);
