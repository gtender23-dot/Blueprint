// Viewer Act 2 / A1 contract: expressive ball-carrier duels stay lawful,
// deterministic, and presentation-only. Run from repo root:
//   node tools/viewer_duel_probe.mjs [games]
import fs from 'node:fs';
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
import { OFF_FIELD_LAYOUTS, DEF_FIELD_LAYOUTS } from '../js/constants_field.js';
import {
  buildPlayScript,
  selectDuelMove,
  selectTackleStyle,
  selectLandmarkMove
} from '../js/ui/watchphys.js';

let pass = true;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `  [${detail}]` : ''}`);
  if (!ok) pass = false;
};

const duelCases = [
  [{ outcomeStyle: 'evade', speed: 6.4, agility: 76, frontness: .8, lateralness: .2, roll: .1 }, 'hurdle'],
  [{ outcomeStyle: 'evade', speed: 5.8, agility: 78, frontness: .1, lateralness: .82, roll: .3 }, 'spin'],
  [{ outcomeStyle: 'evade', speed: 5.8, agility: 55, frontness: .1, lateralness: .82, roll: .9 }, 'stiff'],
  [{ outcomeStyle: 'evade', speed: 5.8, agility: 72, frontness: .7, lateralness: .2, roll: .8 }, 'juke'],
  [{ outcomeStyle: 'truck', speed: 5.2, agility: 55, frontness: .8, lateralness: .2, roll: .2 }, 'truck'],
  [{ outcomeStyle: 'truck', speed: 5.2, agility: 55, frontness: .1, lateralness: .7, roll: .2 }, 'stiff']
];
check('duel selector maps recorded result + geometry to the intended styles',
  duelCases.every(([input, want]) => selectDuelMove(input) === want));
check('duel selector is deterministic', duelCases.every(([input]) => selectDuelMove(input) === selectDuelMove(input)));

const tackleCases = [
  [{ nearGoal: false, speed: 4.5, openField: false, lateral: false, fromBehind: false }, 'wrap'],
  [{ nearGoal: false, speed: 5.8, openField: true, lateral: false, fromBehind: false }, 'big-hit'],
  [{ nearGoal: false, speed: 5.0, openField: false, lateral: false, fromBehind: true }, 'drag-down'],
  [{ nearGoal: false, speed: 5.8, openField: true, lateral: true, fromBehind: false }, 'shoestring'],
  [{ nearGoal: true, speed: 4.2, openField: false, lateral: false, fromBehind: false }, 'goalline']
];
check('tackle selector exposes wrap / big-hit / drag-down / shoestring lawfully',
  tackleCases.every(([input, want]) => selectTackleStyle(input) === want));

const landmarkCases = [
  [{ runLike: true, touchdown: true, boundary: true, finishSpeed: 4.2, nearGoal: true }, 'pylon-dive'],
  [{ runLike: true, touchdown: false, boundary: true, finishSpeed: 4.8, madeMarker: true }, 'marker-dive'],
  [{ runLike: true, touchdown: true, boundary: false, finishSpeed: 3, nearGoal: true }, 'dive'],
  [{ runLike: true, touchdown: false, boundary: true, finishSpeed: 3.2, madeMarker: true }, null]
];
check('landmark dives require the boundary, marker, and speed',
  landmarkCases.every(([input, want]) => selectLandmarkMove(input) === want));

function genRoster(tier, schoolId) {
  const roster = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], tier);
      p.schoolId = schoolId;
      roster.push(p);
    }
  }
  return roster;
}
const gp = (o = {}) => ({
  offFormations: [{ id: 'Spread', weight: 40 }, { id: 'Single Back', weight: 35 }, { id: 'Power-I', weight: 25 }],
  tendency: 'Balanced', rushInPct: 55, passDepth: { short: 45, medium: 35, deep: 20 },
  blitzPct: 30, fourthDown: 'Moderate', baseTempo: 'Normal', maxFGDist: 44,
  screenRate: 18, ...o
});
const layoutFor = (p) => [
  OFF_FIELD_LAYOUTS[p.offFormation]?.slots,
  (DEF_FIELD_LAYOUTS[p.defFront] || DEF_FIELD_LAYOUTS['4-3'])?.slots
];

let seed = 20260813;
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const games = Number(process.argv[2] || 4);
const plays = [];
for (let i = 0; i < games; i++) {
  const home = genRoster(1, 'H'), away = genRoster(1, 'A');
  const result = simulateGame({ id: 'H', name: 'H' }, { id: 'A', name: 'A' }, home, away,
    buildDepthChart(home, gp()), buildDepthChart(away, gp()), gp(), gp());
  for (const drive of result.drives || []) for (const play of drive.plays || []) plays.push(play);
}

let scripted = 0, duelN = 0, badLaw = 0, trackChanges = 0, gangN = 0, badGang = 0, detBad = 0;
const sameTracks = (a, b) => JSON.stringify(a.actors.map(x => x.track).concat([a.ball.track])) === JSON.stringify(b.actors.map(x => x.track).concat([b.ball.track]));
for (const p of plays) {
  const [off, def] = layoutFor(p);
  if (!off) continue;
  const s = buildPlayScript(p, off, def);
  if (!s) continue;
  scripted++;
  const again = buildPlayScript(p, off, def);
  if (JSON.stringify(s.moveCue) !== JSON.stringify(again.moveCue) || JSON.stringify(s.tackleCue) !== JSON.stringify(again.tackleCue)) detBad++;

  if (s.moveCue?.basis) {
    duelN++;
    const b = s.moveCue.basis;
    if (s.moveCue.style === 'hurdle' && !(b.speed >= 6.05 && b.agility >= 62 && b.frontness >= .52)) badLaw++;
    if ((s.moveCue.style === 'spin' || s.moveCue.style === 'stiff') && p.btStyle === 'evade' && b.lateralness < .56) badLaw++;
    const alternate = { ...p, btStyle: p.btStyle === 'truck' ? 'evade' : 'truck' };
    const alt = buildPlayScript(alternate, off, def);
    if (!alt || !sameTracks(s, alt)) trackChanges++;
  }
  if (s.tackleCue?.joinCues?.length) {
    gangN++;
    const ids = s.tackleCue.joinCues.map(j => j.id);
    if (ids.length > 2 || new Set(ids).size !== ids.length || ids.includes(s.tackleCue.id)) badGang++;
    if (s.tackleCue.assistId && !ids.includes(s.tackleCue.assistId)) badGang++;
  }
}
check('real film emits only geometry-lawful duel variants', duelN > 0 && badLaw === 0, `duels=${duelN} bad=${badLaw}`);
check('style selection never changes actor or ball tracks', duelN > 0 && trackChanges === 0, `checked=${duelN} changed=${trackChanges}`);
check('gang tackle cast is primary + at most two unique joiners', gangN > 0 && badGang === 0, `gang=${gangN} bad=${badGang}`);
check('same play produces identical duel cues', detBad === 0, `scripts=${scripted} mismatch=${detBad}`);

// Direct contracts for the two handed-off animations. These stay node-level:
// the browser pass verifies how they read, this verifies their actual geometry.
const off = OFF_FIELD_LAYOUTS.Spread.slots;
const def = DEF_FIELD_LAYOUTS['4-3'].slots;
const basePass = {
  type: 'pass_short', concept: 'Slip Screen', isScreen: true, complete: true,
  turnover: false, sack: false, yards: 8, fieldPos: 50, down: 1, distance: 10,
  half: 1, clock: 800, offFormation: 'Spread', defFront: '4-3', targetSlotId: 'WR_X'
};
const slip = buildPlayScript(basePass, off, def);
const slipCatch = slip?.fx.find(f => f.kind === 'catch');
check('Slip Screen target crosses behind the formation for the catch', !!slipCatch && slipCatch.x > 11 && slipCatch.y > 31,
  slipCatch ? `catch=(${slipCatch.x.toFixed(1)},${slipCatch.y.toFixed(1)})` : 'no catch');

const boot = buildPlayScript({ ...basePass, concept: 'Boot', isScreen: false, playAction: true, type: 'pass_medium', targetSlotId: 'WR_Z' }, off, def);
const bootQb = boot?.actors.find(a => a.id === 'QB');
const releaseFrame = boot ? Math.round(boot.throwCue.release / boot.step) : 0;
const qbRelease = bootQb?.track[Math.min(releaseFrame, bootQb.track.length - 1)];
check('Boot QB reaches a designed lateral rollout launch point', !!qbRelease && Math.abs(qbRelease[0] - 50) >= 4.4,
  qbRelease ? `releaseX=${qbRelease[0].toFixed(1)}` : 'no QB');

const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../js/ui/app.js', import.meta.url), 'utf8');
check('viewer CSS carries semantic tackle and landmark-dive poses',
  ['wp-tk-big-hit', 'wp-tk-drag-down', 'wp-mv-pylon-dive', 'wsp-a1-landmark-left'].every(x => css.includes(x)));
check('watch loop stages late gang-tackle joiners', app.includes('tackleCue.joinCues') && app.includes('joinCue.t'));

console.log(pass ? '\nVIEWER DUEL PROBE PASS' : '\nVIEWER DUEL PROBE FAIL');
process.exit(pass ? 0 : 1);
