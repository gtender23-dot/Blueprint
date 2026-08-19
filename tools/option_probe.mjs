// option_probe.mjs — THE OPTION GAME, against the source (2026-08-18).
//
// Written when Midline Option was added from Throw Deep Publishing's "The
// Midline Option: The Complete Guide". The engine already modelled triple/veer
// (dive read off the edge, pitch phase, perimeter keep); midline is a different
// play and the probe's job is to keep it one:
//
//   "an option play where the Quarterback reads an INTERIOR Defensive Lineman
//    to determine whether to hand the ball off or keep it himself. The play
//    hits downhill to a dive back hitting the A-gap or if the QB keeps the
//    ball, through the B-gap."
//
// Three properties follow, and all three are pinned below:
//   1. NO PITCH PHASE — two outcomes, give or keep.
//   2. THE KEEP IS DOWNHILL — run_inside, not the perimeter keep of a veer.
//   3. IT STILL FIRES — a share of an option team's snaps are midline, so the
//      play cannot quietly stop being called (the front-mix lesson: authored,
//      shown, stored, never reaching the field).
//
// Run: node tools/option_probe.mjs [gamesPerArm]
import { ROSTER_TARGETS, CLASS_YEARS, FORMATION_PLAYBOOK } from '../js/constants.js';
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart, defaultGameplan } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';

const N = parseInt(process.argv[2] || '10', 10);
let pass = 0, fail = 0;
const check = (ok, msg, detail = '') => {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}${detail ? `  [${detail}]` : ''}`);
};
function mul(s) { let t = s >>> 0; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ t >>> 15, 1 | t); r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r; return ((r ^ r >>> 14) >>> 0) / 4294967296; }; }
const real = Math.random;
function roster(id) { const r = []; for (const [p, c] of Object.entries(ROSTER_TARGETS)) for (let i = 0; i < c; i++) { const x = createPlayer(p, CLASS_YEARS[i % 4], 1); x.schoolId = id; r.push(x); } return r; }
function sample(seedBase) {
  const rows = [];
  for (let i = 0; i < N; i++) {
    Math.random = mul(seedBase + i);
    try {
      const rH = roster('H'), rA = roster('A');
      const gpH = { ...defaultGameplan(), offFormation: 'Flexbone', offFormations: [{ id: 'Flexbone', weight: 100 }], tendency: 'Heavy Run', rushInPct: 80, optionRate: 70 };
      const gpA = { ...defaultGameplan() };
      const res = simulateGame({ id: 'H' }, { id: 'A' }, rH, rA, buildDepthChart(rH, gpH), buildDepthChart(rA, gpA), gpH, gpA);
      for (const d of res.drives || []) { if (d.possession !== 'home') continue; for (const p of d.plays || []) if (p.optionPhase) rows.push(p); }
    } finally { Math.random = real; }
  }
  return rows;
}

console.log(`— the option game, ${N} games —\n`);
const all = sample(99500);
const opt = all.filter(p => ['dive', 'keep', 'pitch'].includes(p.optionPhase));
check(opt.length > 100, `option snaps sampled (${opt.length})`);

// The midline signature: a keep that goes INSIDE. A veer/triple keep bends out.
const insideKeeps = opt.filter(p => p.optionPhase === 'keep' && p.type === 'run_inside');
const outsideKeeps = opt.filter(p => p.optionPhase === 'keep' && p.type === 'run_outside');
check(insideKeeps.length > 0, 'MIDLINE FIRES — the downhill B-gap keep appears',
  `${insideKeeps.length} inside keeps of ${opt.length} option snaps (${(100 * insideKeeps.length / opt.length).toFixed(1)}%)`);
check(outsideKeeps.length > 0, 'VEER STILL FIRES — the perimeter keep appears too',
  `${outsideKeeps.length} outside keeps`);
// Both plays must survive; neither may swallow the other.
const midShare = insideKeeps.length / (insideKeeps.length + outsideKeeps.length);
check(midShare > 0.15 && midShare < 0.75,
  'the two keeps coexist — neither play has swallowed the other', `midline keeps = ${(100 * midShare).toFixed(0)}% of keeps`);
// The pitch belongs to veer only; it must still be a real share of the whole.
const pitches = opt.filter(p => p.optionPhase === 'pitch');
check(pitches.length > 0, 'the veer PITCH phase survives the midline share', `${pitches.length} pitches`);
check(pitches.every(p => p.type === 'run_outside'), 'every pitch is a perimeter run');
// Dives are inside on both plays.
const dives = opt.filter(p => p.optionPhase === 'dive');
check(dives.length > 0 && dives.every(p => p.type === 'run_inside'), 'every dive hits inside', `${dives.length} dives`);
// Legality: the formations that carry it are the ones that should.
const carries = Object.entries(FORMATION_PLAYBOOK).filter(([, l]) => l.includes('Midline Option')).map(([f]) => f);
check(carries.length > 0 && carries.every(f => FORMATION_PLAYBOOK[f].includes('Triple Option')),
  'only option formations carry Midline', carries.join(','));

console.log(`\n${fail === 0 ? 'OPTION PROBE PASS' : 'OPTION PROBE FAIL'}  (${pass} pass, ${fail} fail)`);
process.exit(fail ? 1 : 0);
