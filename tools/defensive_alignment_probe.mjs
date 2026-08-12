// M17 gate: every defensive package opens at football alignment depth.
// The formation catalog is a schematic; watch mode must not treat its rows as
// literal yardage. This probe covers every front without touching game state.
import { DEF_FIELD_LAYOUTS, OFF_FIELD_LAYOUTS } from '../js/constants_field.js';
import { buildPlayScript } from '../js/ui/watchphys.js';

const LOS = 31;
const YPU = 0.85;
let failed = false;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `  [${detail}]` : ''}`);
  if (!ok) failed = true;
};

const depths = [];
let countOK = true;
let lateralOK = true;
for (const [front, layout] of Object.entries(DEF_FIELD_LAYOUTS)) {
  const play = {
    type: 'run_inside', concept: 'Inside Zone', yards: 4, fieldPos: 50,
    down: 1, clock: 900, half: 1, offFormation: 'Spread', defFront: front
  };
  const script = buildPlayScript(play, OFF_FIELD_LAYOUTS.Spread.slots, layout.slots);
  const actors = script?.actors.filter(a => a.team === 'def') || [];
  countOK &&= actors.length === 11;
  for (const slot of layout.slots) {
    const actor = actors.find(a => a.id === `D_${slot.id}`);
    if (!actor) { countOK = false; continue; }
    const [x, y] = actor.track[0];
    // The first physics sample may apply a sub-pixel collision nudge.
    lateralOK &&= Math.abs(x - slot.x * 100) < 0.16;
    depths.push({ front, slot, depth: (LOS - y) / YPU });
  }
}

const inRange = (d, lo, hi) => d >= lo - 0.01 && d <= hi + 0.01;
const down = depths.filter(x => x.slot.pos === 'DE' || x.slot.pos === 'DT');
const edge = depths.filter(x => x.slot.pos === 'OLB' && /Rush/.test(x.slot.role || '') && x.slot.y >= 0.6);
const corners = depths.filter(x => x.slot.pos === 'CB' && x.slot.id !== 'NB');
const nickels = depths.filter(x => x.slot.pos === 'CB' && x.slot.id === 'NB');
const backers = depths.filter(x => (x.slot.pos === 'LB' || x.slot.pos === 'OLB') && !edge.includes(x));
const boxSafeties = depths.filter(x => x.slot.pos === 'S' && (x.slot.mesh === 'SPACE' || x.slot.y >= 0.24));
const highSafeties = depths.filter(x => x.slot.pos === 'S' && !boxSafeties.includes(x));

check('all defensive fronts build 11 players', countOK, `fronts=${Object.keys(DEF_FIELD_LAYOUTS).length}`);
check('formation width is preserved', lateralOK);
check('down linemen crowd the LOS', down.every(x => inRange(x.depth, 0.55, 1)), `range=${Math.min(...down.map(x => x.depth)).toFixed(2)}-${Math.max(...down.map(x => x.depth)).toFixed(2)} yd`);
check('stand-up rush edges stay on the line', edge.every(x => inRange(x.depth, 0.9, 1.2)), `count=${edge.length}`);
check('stacked linebackers form a connected box', backers.every(x => inRange(x.depth, 3.5, 4.6)), `range=${Math.min(...backers.map(x => x.depth)).toFixed(2)}-${Math.max(...backers.map(x => x.depth)).toFixed(2)} yd`);
check('press corners align across from receivers', corners.every(x => inRange(x.depth, 1.3, 1.6)), `count=${corners.length}`);
check('nickel defenders apex at second level', nickels.every(x => inRange(x.depth, 4, 4.5)), `count=${nickels.length}`);
check('walked safeties remain in the box', boxSafeties.every(x => inRange(x.depth, 4.4, 6.1)), `count=${boxSafeties.length}`);
check('high safeties retain real college depth', highSafeties.every(x => inRange(x.depth, 10.4, 11.6)), `range=${Math.min(...highSafeties.map(x => x.depth)).toFixed(2)}-${Math.max(...highSafeties.map(x => x.depth)).toFixed(2)} yd`);

process.exit(failed ? 1 : 0);
