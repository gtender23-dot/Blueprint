// spring_dev_probe.mjs — is the spring game's development bump actually small?
//
// The spring code scaled practice MINUTES by SPRING_DEV_MULT before developPlayer. But
// developPlayer normalizes minutes to proportions (w = minutes / total), so scaling every
// minute by the same factor cancels — the bump ran at a FULL classic tick (scale 1),
// making the "small" spring game the single largest development event of the year, bigger
// than dev camp (CAMP_DEV_MULT 0.30). The multiplier was a no-op.
//
// The fix passes SPRING_DEV_MULT in developPlayer's `scale` slot (which multiplies the tick
// directly), like in-season checkpoints do. This probe proves both halves:
//   1. the OLD path (pre-scaled minutes) == a full scale-1 tick  → the multiplier did nothing
//   2. the NEW path (scale 0.15) is about half a camp tick        → spring < camp, as intended
//
// Mean composite-rating gain over a fresh roster, same players cloned into each arm.
// Usage: node tools/spring_dev_probe.mjs [players]
import { developPlayer } from '../js/engine/development.js';
import { createPlayer } from '../js/engine/player.js';
import { C, DEFAULT_PRACTICE } from '../js/constants.js';
const { SPRING_DEV_MULT, CAMP_DEV_MULT } = C;

const M = parseInt(process.argv[2] || '4000', 10);
const POSNS = ['QB','RB','WR','TE','OL','CB','S','LB','DE','DT'];
const CLASSES = ['FR','SO','JR'];   // seniors have less headroom; keep the pool developing
const base = Array.from({ length: M }, (_, i) => createPlayer(POSNS[i % POSNS.length], CLASSES[i % 3], 2));

const clone = p => {
  const c = structuredClone(p);
  return c;
};

// One arm: run a dev pass over clones of the base pool, return mean composite gain.
function meanGain(runOne) {
  let sum = 0, n = 0;
  for (const p0 of base) {
    const p = clone(p0);
    const before = p.compositeRating || 0;
    runOne(p);
    sum += (p.compositeRating || 0) - before; n++;
  }
  return sum / n;
}

const coach = null;   // grade-F developer (neutral devMult)

// OLD spring: pre-scale the minutes, default scale=1 (reproduces the shipped no-op).
const oldSpring = meanGain(p => {
  const reps = {}; for (const [t, m] of Object.entries(DEFAULT_PRACTICE)) reps[t] = Math.round((m || 0) * SPRING_DEV_MULT);
  developPlayer(p, reps, coach);
});
// A genuine full tick (raw minutes, scale 1) — should equal oldSpring if the mult was a no-op.
const fullTick = meanGain(p => developPlayer(p, DEFAULT_PRACTICE, coach, 1));
// Dev camp tick.
const camp = meanGain(p => developPlayer(p, DEFAULT_PRACTICE, coach, CAMP_DEV_MULT));
// NEW spring: scale the tick.
const newSpring = meanGain(p => developPlayer(p, DEFAULT_PRACTICE, coach, SPRING_DEV_MULT));

console.log(`Spring development bump — mean composite gain over ${M} players\n`);
console.log(`OLD spring (pre-scaled minutes) : ${oldSpring.toFixed(3)}`);
console.log(`full classic tick (scale 1)     : ${fullTick.toFixed(3)}`);
console.log(`dev camp (scale ${CAMP_DEV_MULT})            : ${camp.toFixed(3)}`);
console.log(`NEW spring (scale ${SPRING_DEV_MULT})          : ${newSpring.toFixed(3)}`);

const noop = Math.abs(oldSpring - fullTick) / (fullTick || 1) < 0.06;   // within rounding noise
const oldBiggerThanCamp = oldSpring > camp * 1.3;
const newSmallerThanCamp = newSpring < camp;

console.log('');
let fail = 0;
if (noop) console.log(`confirmed: the OLD multiplier was a NO-OP (spring ran at a full tick, not ${SPRING_DEV_MULT}).`);
else { fail++; console.log('unexpected: OLD spring differs from a full tick — recheck the no-op claim.'); }
if (oldBiggerThanCamp) console.log(`confirmed: OLD spring (${oldSpring.toFixed(3)}) dwarfed dev camp (${camp.toFixed(3)}).`);
else { fail++; console.log('unexpected: OLD spring was not larger than camp.'); }
if (newSmallerThanCamp) console.log(`PASS — NEW spring (${newSpring.toFixed(3)}) is smaller than dev camp (${camp.toFixed(3)}), a real small bump.`);
else { fail++; console.log(`FAIL — NEW spring (${newSpring.toFixed(3)}) is not smaller than camp (${camp.toFixed(3)}).`); }

process.exit(fail ? 1 : 0);
