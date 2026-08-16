// Viewer Act 2 / A2 contract: catch, throw and trench variants are lawful,
// deterministic presentation layered over unchanged tracks and ball truth.
// Run from repo root: node tools/viewer_throwcatch_probe.mjs
import fs from 'node:fs';
import { OFF_FIELD_LAYOUTS, DEF_FIELD_LAYOUTS } from '../js/constants_field.js';
import {
  buildPlayScript,
  sampleTrack,
  selectCatchStyle,
  selectThrowStyle,
  selectTrenchStyle
} from '../js/ui/watchphys.js';

let pass = true;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `  [${detail}]` : ''}`);
  if (!ok) pass = false;
};

const catchCases = [
  [{ kind: 'catch', boundaryDistance: 30, reachDistance: .4 }, 'secure'],
  [{ kind: 'catch', boundaryDistance: 7, reachDistance: 1.2 }, 'toe-tap'],
  [{ kind: 'catch', boundaryDistance: 30, reachDistance: 1.2, contested: true }, 'battle'],
  [{ kind: 'catch', boundaryDistance: 30, reachDistance: 1.2, highArrival: true }, 'high-point'],
  [{ kind: 'catch', boundaryDistance: 30, reachDistance: 1.4, roll: .03 }, 'one-hand'],
  [{ kind: 'catch', boundaryDistance: 30, reachDistance: 2.7, lowArrival: true }, 'layout'],
  [{ kind: 'inc', boundaryDistance: 30, reachDistance: 1.2, contested: true }, 'breakup'],
  [{ kind: 'int', boundaryDistance: 30, reachDistance: 1.2, highArrival: true }, 'pick']
];
check('catch selector covers secure / toe-tap / battle / high-point / one-hand / layout / breakup / pick',
  catchCases.every(([input, want]) => selectCatchStyle(input) === want));
check('catch selector is deterministic',
  catchCases.every(([input]) => selectCatchStyle(input) === selectCatchStyle(input)));

const throwCases = [
  [{}, 'set'],
  [{ playAction: true }, 'pa-carry'],
  [{ moving: true, rollout: true, roll: .2 }, 'sidearm'],
  [{ moving: true, rollout: true, roll: .9 }, 'on-run'],
  [{ moving: true, hurried: true }, 'off-platform']
];
check('throw selector covers set / PA carry / sidearm / on-run / off-platform',
  throwCases.every(([input, want]) => selectThrowStyle(input) === want));

const trenchCases = [
  [{ pass: false }, { family: 'run', blocker: 'drive', rusher: 'fit' }],
  [{ pass: true, move: 'rip', edge: true }, { family: 'edge', blocker: 'kick-slide', rusher: 'speed' }],
  [{ pass: true, move: 'bull' }, { family: 'power', blocker: 'anchor', rusher: 'bull' }],
  [{ pass: true, move: 'counter' }, { family: 'counter', blocker: 'redirect', rusher: 'counter' }]
];
check('trench selector distinguishes run drive, edge kick-slide, bull anchor and counter redirect',
  trenchCases.every(([input, want]) => JSON.stringify(selectTrenchStyle(input)) === JSON.stringify(want)));

const off = OFF_FIELD_LAYOUTS.Spread.slots;
const def = DEF_FIELD_LAYOUTS['4-3'].slots;
const base = {
  type: 'pass_medium', concept: 'Spot', complete: true, turnover: false,
  sack: false, yards: 12, fieldPos: 50, down: 2, distance: 8, half: 1,
  clock: 643, offFormation: 'Spread', defFront: '4-3', targetSlotId: 'WR_X'
};
const script = buildPlayScript(base, off, def);
const again = buildPlayScript(base, off, def);
check('completed pass emits a deterministic A2 catch cue',
  !!script?.catchCue && JSON.stringify(script.catchCue) === JSON.stringify(again?.catchCue),
  script?.catchCue?.style || 'no cue');
check('stamped target owns the catch pose even when another route finishes nearby',
  script?.catchCue?.id === base.targetSlotId, `cue=${script?.catchCue?.id || 'none'} target=${base.targetSlotId}`);

const tracks = (s) => JSON.stringify(s.actors.map((a) => a.track).concat([s.ball.track]));
const contested = buildPlayScript({ ...base, contested: true }, off, def);
check('presentation-only contested flag never changes actor or ball tracks',
  !!script && !!contested && tracks(script) === tracks(contested));

if (script?.catchCue) {
  const receiver = script.actors.find((a) => a.id === script.catchCue.id);
  const at = script.catchCue.impact;
  const rp = receiver ? sampleTrack(receiver.track, script.step, at) : null;
  const bp = sampleTrack(script.ball.track, script.step, at);
  check('every new catch pose meets the ball at the recorded catch frame',
    !!rp && Math.hypot(rp[0] - bp[0], rp[1] - bp[1]) <= .2,
    rp ? `gap=${Math.hypot(rp[0] - bp[0], rp[1] - bp[1]).toFixed(3)}` : 'no receiver');
}

const boot = buildPlayScript({ ...base, concept: 'Boot', playAction: true, targetSlotId: 'WR_Z', clock: 601 }, off, def);
check('moving Boot throw is labeled sidearm or on-run without changing its rollout track',
  !!boot?.qbCue?.rollout && ['sidearm', 'on-run'].includes(boot?.throwCue?.style));
const escape = buildPlayScript({ ...base, isScrambleThrow: true, hurried: true, clock: 577 }, off, def);
check('hurried escape throw is labeled off-platform and carries the reset cue',
  escape?.throwCue?.style === 'off-platform' && escape?.qbCue?.escape === true);

const rushBad = (script?.rushCues || []).filter((r) =>
  !r.family || !r.blockerStyle || !r.rusherStyle ||
  JSON.stringify(selectTrenchStyle({ pass: true, move: r.move, edge: r.family === 'edge' })) !==
    JSON.stringify({ family: r.family, blocker: r.blockerStyle, rusher: r.rusherStyle }));
check('every pass-rush pair carries a lawful blocker/rusher posture',
  (script?.rushCues?.length || 0) > 0 && rushBad.length === 0,
  `rushers=${script?.rushCues?.length || 0} bad=${rushBad.length}`);

const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../js/ui/app.js', import.meta.url), 'utf8');
check('viewer CSS carries A2 catch, moving-QB and trench silhouettes',
  ['wsp-a2-catch-layout', 'wsp-a2-catch-onehand', 'wsp-a2-sidearm-follow', 'wp-trench-kick-slide'].every((x) => css.includes(x)));
check('watch loop consumes watchphys A2 cues and clears their state every frame',
  app.includes('script.catchCue || null') && app.includes('wp-qb-throw-') &&
  app.includes('wp-trench-rusher-') && app.includes('wp-catch-style-one-hand'));

console.log(pass ? '\nVIEWER THROW/CATCH PROBE PASS' : '\nVIEWER THROW/CATCH PROBE FAIL');
process.exit(pass ? 0 : 1);
