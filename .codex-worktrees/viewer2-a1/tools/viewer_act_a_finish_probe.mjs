// Viewer Act 2 / A4+A5 deterministic contract: outside-arm stamps are lawful
// recording-only facts, and roster height/weight changes expression—not tracks.
import fs from 'node:fs';
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
import { OFF_FIELD_LAYOUTS, DEF_FIELD_LAYOUTS } from '../js/constants_field.js';
import {
  buildPlayScript, selectBodyExpression, selectDuelMove,
  selectTackleStyle, selectCatchStyle
} from '../js/ui/watchphys.js';

let seed = 20260814;
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

let pass = true;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `  [${detail}]` : ''}`);
  if (!ok) pass = false;
};

const lean = selectBodyExpression({ heightInches: 69, weight: 172, group: 'WR' });
const balanced = selectBodyExpression({ heightInches: 74, weight: 225, group: 'LB' });
const massive = selectBodyExpression({ heightInches: 76, weight: 340, group: 'DT' });
const legacy = selectBodyExpression();
check('real frames resolve lean / balanced / massive while old film stays legacy',
  lean.kind === 'lean' && balanced.kind === 'balanced' && massive.kind === 'massive' && legacy.kind === 'legacy',
  `${lean.kind}/${balanced.kind}/${massive.kind}/${legacy.kind}`);
check('a 340-lb tackle reads wider, longer-strided, and less whippy than a 172-lb slot',
  massive.scaleX > lean.scaleX && massive.stride > lean.stride && massive.leanScale < lean.leanScale,
  `x ${lean.scaleX}->${massive.scaleX} stride ${lean.stride}->${massive.stride} lean ${lean.leanScale}->${massive.leanScale}`);
check('frame identity lawfully weights A1/A2 presentation choices',
  selectDuelMove({ outcomeStyle: 'evade', speed: 5.8, agility: 55, lateralness: .7, bodyKind: 'lean', roll: .45 }) === 'spin' &&
  selectDuelMove({ outcomeStyle: 'evade', speed: 5.8, agility: 55, lateralness: .7, bodyKind: 'massive', roll: .45 }) === 'stiff' &&
  selectTackleStyle({ speed: 6, openField: true, lateral: true, bodyKind: 'lean' }) === 'shoestring' &&
  selectTackleStyle({ speed: 6, openField: true, lateral: true, bodyKind: 'massive' }) === 'big-hit' &&
  selectCatchStyle({ reachDistance: 1.4, bodyKind: 'lean', roll: .09 }) === 'one-hand' &&
  selectCatchStyle({ reachDistance: 1.4, bodyKind: 'massive', roll: .09 }) === 'secure');

function roster(tier, schoolId) {
  const out = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], tier);
      p.schoolId = schoolId;
      out.push(p);
    }
  }
  return out;
}
const gp = () => ({ offFormations: [{ id: 'Spread', weight: 45 }, { id: 'Single Back', weight: 35 }, { id: 'Flexbone', weight: 20 }],
  tendency: 'Balanced', rushInPct: 52, passDepth: { short: 35, medium: 45, deep: 20 }, blitzPct: 28,
  fourthDown: 'Moderate', baseTempo: 'Normal', maxFGDist: 44, runDirection: { left: 40, middle: 20, right: 40 } });

const plays = [];
for (let i = 0; i < 6; i++) {
  const rh = roster(1, 'H'), ra = roster(1, 'A'), gh = gp(), ga = gp();
  const res = simulateGame({ id: 'H', name: 'H' }, { id: 'A', name: 'A' }, rh, ra,
    buildDepthChart(rh, gh), buildDepthChart(ra, ga), gh, ga);
  for (const d of res.drives || []) for (const p of d.plays || []) plays.push(p);
}

const scrimmage = plays.filter((p) => p.offFormation && (String(p.type).startsWith('run') || String(p.type).startsWith('pass')));
const stamped = scrimmage.filter((p) => p.armSwitch);
let stampBad = 0, bodyBad = 0, scripts = 0, cueBad = 0, trackBad = 0, legacyTrackBad = 0;
let firstStampBad = null, firstBodyBad = null;
const kinds = new Set();
const tracks = (s) => JSON.stringify((s?.actors || []).map((a) => a.track).concat(s?.ball ? [s.ball.track] : []));
for (const p of scrimmage) {
  const maps = [p.offSpd, p.defSpd];
  if (maps.some((m) => !m || Object.values(m).some((v) => !Number.isFinite(v.h) || !Number.isFinite(v.w)))) {
    bodyBad++;
    if (!firstBodyBad) firstBodyBad = { type: p.type, form: p.offFormation, front: p.defFront, off: p.offSpd, def: p.defSpd };
  }
  if (!p.armSwitch) continue;
  const a = p.armSwitch;
  const openYards = p.rusherId ? Math.max(0, p.yards || 0) : Math.max(0, p.yacYds || 0);
  const expectedSlot = p.rusherId ? p.carrierSlotId : p.targetSlotId;
  if (p.turnover || openYards < 6 || a.slot !== expectedSlot || a.from === a.to || !['left','right'].includes(a.to) || a.f < .38 || a.f > .58 || (p.rusherId && ['left','right'].includes(p.runDir) && a.to !== p.runDir)) {
    stampBad++;
    if (!firstStampBad) firstStampBad = { type: p.type, yards: p.yards, yac: p.yacYds, rusher: p.rusherId, receiver: p.receiverId, carrierSlot: p.carrierSlotId, targetSlot: p.targetSlotId, runDir: p.runDir, stamp: a };
  }
  const off = OFF_FIELD_LAYOUTS[p.offFormation]?.slots;
  const def = (DEF_FIELD_LAYOUTS[p.defFront] || DEF_FIELD_LAYOUTS['4-3']).slots;
  if (!off) continue;
  const script = buildPlayScript(p, off, def);
  if (!script) continue;
  scripts++;
  for (const actor of script.actors) kinds.add(actor.body?.kind);
  if (!script.armSwitchCue || script.armSwitchCue.id !== a.slot || !(script.armSwitchCue.end > script.armSwitchCue.t)) cueBad++;
  const noStamp = buildPlayScript({ ...p, armSwitch: null }, off, def);
  if (tracks(script) !== tracks(noStamp)) trackBad++;
  const stripBody = (m) => Object.fromEntries(Object.entries(m || {}).map(([k,v]) => [k, { s: v.s, a: v.a }]));
  const noBody = buildPlayScript({ ...p, offSpd: stripBody(p.offSpd), defSpd: stripBody(p.defSpd) }, off, def);
  if (tracks(script) !== tracks(noBody)) legacyTrackBad++;
}
check('shipping engine emits outside-arm stamps at useful volume', stamped.length >= 12, `stamps=${stamped.length}/${scrimmage.length}`);
check('every outside-arm stamp belongs to the real eligible carrier and field side', stampBad === 0, `bad=${stampBad}/${stamped.length}${firstStampBad ? ` first=${JSON.stringify(firstStampBad)}` : ''}`);
check('every fielded slot carries real height and weight identity', bodyBad === 0, `badPlays=${bodyBad}/${scrimmage.length}${firstBodyBad ? ` first=${JSON.stringify(firstBodyBad).slice(0,900)}` : ''}`);
check('viewer translates every usable stamp into a timed arm-switch cue', scripts >= 8 && cueBad === 0, `scripts=${scripts} bad=${cueBad}`);
check('arm stamps and body identity never change actor or ball tracks', trackBad === 0 && legacyTrackBad === 0,
  `arm=${trackBad} body=${legacyTrackBad}`);
check('real live scripts expose multiple body frames', kinds.size >= 3 && !kinds.has('legacy'), `kinds=[${[...kinds].join(',')}]`);

const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../js/ui/app.js', import.meta.url), 'utf8');
check('CSS and watch loop carry the A4 arm exchange and A5 identity wrapper',
  ['wsp-a4-switch-shell', 'wp-arm-switching', 'wsp-identity-body', 'wsp-frame-massive'].every((x) => css.includes(x)) &&
  app.includes('carryArmState') && app.includes('ballN.dataset.arm'));

console.log(pass ? '\nVIEWER ACT A FINISH PROBE PASS' : '\nVIEWER ACT A FINISH PROBE FAIL');
process.exit(pass ? 0 : 1);
