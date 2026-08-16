// Viewer Act 2 / A3 contract: secondary weight consumes motion state but never
// writes a track, and carrier awareness stays bounded to a lawful pursuer cue.
// Run from repo root: node tools/viewer_secondary_motion_probe.mjs
import fs from 'node:fs';
import { selectSecondaryMotion } from '../js/ui/watchphys.js';

let pass = true;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `  [${detail}]` : ''}`);
  if (!ok) pass = false;
};

const still = selectSecondaryMotion();
check('a planted athlete carries no secondary-motion residue',
  !still.weighted && !still.gather && !still.sprint && still.headSide === null &&
  still.shadowScale === 1 && still.shadowOpacity === .72 && still.shadowSkew === 0);

const sprint = selectSecondaryMotion({ speed: 6.4, accel: 1.2, lateralSpeed: 3.8, locomotion: 'sprint' });
check('top speed adds weight and momentum tilt without inventing a gather',
  sprint.weighted && sprint.sprint && !sprint.gather && sprint.shadowScale > 1 && sprint.shadowSkew > 0,
  JSON.stringify(sprint));

const plant = selectSecondaryMotion({ speed: 4.2, accel: -2, lateralSpeed: -3.1, locomotion: 'plant' });
const brake = selectSecondaryMotion({ speed: 3.6, accel: -6.2, lateralSpeed: .2, locomotion: 'run' });
check('a planted cut or hard deceleration earns the gather-step', plant.gather && brake.gather);

const left = selectSecondaryMotion({ speed: 4.8, locomotion: 'run', carrier: true, pursuitDx: -3, pursuitDistance: 7 });
const right = selectSecondaryMotion({ speed: 4.8, locomotion: 'run', carrier: true, pursuitDx: 3, pursuitDistance: 7 });
check('the active carrier checks toward the nearest lawful pursuit side', left.headSide === 'left' && right.headSide === 'right');
check('non-carriers and out-of-range pursuit never receive a head-check',
  selectSecondaryMotion({ speed: 4.8, locomotion: 'run', pursuitDx: 3, pursuitDistance: 7 }).headSide === null &&
  selectSecondaryMotion({ speed: 4.8, locomotion: 'run', carrier: true, pursuitDx: 3, pursuitDistance: 20 }).headSide === null &&
  selectSecondaryMotion({ speed: 4.8, locomotion: 'run', carrier: true, pursuitDx: .2, pursuitDistance: 7 }).headSide === null);

const extremes = [
  selectSecondaryMotion({ speed: 99, lateralSpeed: 99, locomotion: 'sprint' }),
  selectSecondaryMotion({ speed: 99, lateralSpeed: -99, locomotion: 'sprint' })
];
check('shadow accents stay inside the SVG-safe bounds', extremes.every((x) =>
  x.shadowScale >= 1 && x.shadowScale <= 1.28 &&
  x.shadowOpacity >= .72 && x.shadowOpacity <= .92 &&
  x.shadowSkew >= -9 && x.shadowSkew <= 9));
check('secondary-motion selection is deterministic',
  JSON.stringify(left) === JSON.stringify(selectSecondaryMotion({ speed: 4.8, locomotion: 'run', carrier: true, pursuitDx: -3, pursuitDistance: 7 })));

const app = fs.readFileSync(new URL('../js/ui/app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
check('watch loop consumes the existing locomotion cache and clears A3 state every frame',
  app.includes('motion = node && node._wsm') &&
  app.includes('...tackleSetupCls, ...secondaryCls') &&
  app.includes('selectSecondaryMotion({'));
check('A3 never resamples or mutates actor tracks in the watch loop',
  !app.includes('selectSecondaryMotion({\n        track:') &&
  !app.includes('a.track = selectSecondaryMotion'));
check('viewer CSS carries shadow, gather-step, sprint and pursuit head accents',
  ['wp-a3-weight', 'wp-a3-gather', 'wp-a3-sprint', 'wp-a3-head-left', 'wp-a3-head-right'].every((x) => css.includes(x)) &&
  css.includes('wsp-a3-gather-front') && css.includes('wsp-a3-gather-back'));

console.log(pass ? '\nVIEWER SECONDARY MOTION PROBE PASS' : '\nVIEWER SECONDARY MOTION PROBE FAIL');
process.exit(pass ? 0 : 1);
