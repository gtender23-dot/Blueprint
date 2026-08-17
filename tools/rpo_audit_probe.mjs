// rpo_audit_probe.mjs — D5 / M3 AUDIT instrument (report-only, NOT a gate probe).
//
// Measures what the sim actually produces today, per QB archetype:
//   · designed QB runs per game (organic qbRunChance keeps + QB Sneak/QB Power
//     concepts + Empty no-backfield keeps)
//   · scrambles per game (all three rungs: pressure escape, clean-pocket
//     improv, coverage-sack escape) + scramble-drill throws
//   · RPO snaps per game and the give/pull split (the engine has NO keep phase
//     — rpoConflictRead outcomes are pull/wrongPull → throw, give/giveLate/
//     wrongGive → hand off; the QB never keeps at the RPO mesh)
//   · triple/speed option snaps and their dive/keep/pitch phases
//
// Sample: N AI-vs-AI games on fresh generated rosters with setAIGameplan on
// both sides (varied staff aggression), the same harness shape as
// balance_probe. Attribution: each team-game is filed under its STARTING QB's
// derived archetype; QB-carry plays are cross-checked against the roster's QB
// id set so a backup's snaps still count as QB activity.
//
// Run: node tools/rpo_audit_probe.mjs [N-games]   (default 300)
import { createPlayer, derivedArchetype } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { setAIGameplan } from '../js/engine/ai.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

const N = Number(process.argv[2] ?? 300);

function genRoster(t, s) {
  const r = [];
  for (const [pos, c] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < c; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], t);
      p.schoolId = s;
      r.push(p);
    }
  }
  return r;
}

function aiSchool(id) {
  const roster = genRoster(1, id);
  const school = {
    id, name: id, roster,
    coach: { personality: { aggression: 0.2 + Math.random() * 0.6 } },
    staff: null,
  };
  setAIGameplan(school);
  return school;
}

// Archetype buckets. The engine's 5 QB archetypes collapse onto the audit's
// scrambler / dual / pocket axis: Gunslinger + Game-Manager + Pocket are all
// "pocket" for run-game purposes (none carries a mobility lean).
const BUCKET = (arch) =>
  arch === 'QB-Scrambler' ? 'scrambler'
  : arch === 'QB-Dual' ? 'dual'
  : 'pocket';

const mkCell = () => ({
  teamGames: 0, snaps: 0, dropbacks: 0, sacks: 0,
  scrambles: 0, covScrambles: 0, scrThrows: 0,
  qbDesigned: 0, qbSneak: 0, qbPower: 0, qbOrganicKeep: 0, emptyKeep: 0,
  rpoSnaps: 0, rpoPull: 0, rpoWrongPull: 0, rpoGive: 0, rpoGiveLate: 0, rpoWrongGive: 0,
  optSnaps: 0, optDive: 0, optKeep: 0, optPitch: 0,
  jet: 0, draw: 0, wildcat: 0,
  qbRushYds: 0, qbRushAtt: 0,
  qbSPD: 0, qbCount: 0,
});
const cells = { scrambler: mkCell(), dual: mkCell(), pocket: mkCell(), ALL: mkCell() };
const archCounts = {};
const formUse = {};

const SCRIMMAGE = (t) => t && (t.startsWith('run') || t.startsWith('pass'));

function tally(cell, plays, qbIds, starterId) {
  for (const p of plays) {
    if (!SCRIMMAGE(p.type)) continue;
    cell.snaps++;
    formUse[p.offFormation] = (formUse[p.offFormation] || 0) + 1;
    const qbCarry = p.rusherId != null && qbIds.has(p.rusherId);

    if (p.type === 'run_scramble') {
      cell.scrambles++;
      cell.dropbacks++; // a dropback that became a run
      if (p.covScramble) cell.covScrambles++;
      if (qbCarry) { cell.qbRushAtt++; cell.qbRushYds += p.yards || 0; }
      continue;
    }
    if (p.isScrambleThrow) { cell.scrThrows++; cell.dropbacks++; continue; }

    if (p.type.startsWith('pass')) {
      cell.dropbacks++;
      if (p.sacked) cell.sacks++;
      // RPO pull: originated as a run call, restamped pass_short
      if (p.rpo) {
        cell.rpoSnaps++;
        if (p.rpoRead === 'pull') cell.rpoPull++;
        else if (p.rpoRead === 'wrongPull') cell.rpoWrongPull++;
        else cell.rpoPull++; // legacy flip branch has no rpoRead
      }
      continue;
    }

    // run types from here
    if (p.rpoKept) {
      cell.rpoSnaps++;
      if (p.rpoRead === 'give') cell.rpoGive++;
      else if (p.rpoRead === 'giveLate') cell.rpoGiveLate++;
      else if (p.rpoRead === 'wrongGive') cell.rpoWrongGive++;
      else cell.rpoGive++;
    }
    if (p.optionPhase === 'dive' || p.optionPhase === 'keep' || p.optionPhase === 'pitch') {
      cell.optSnaps++;
      if (p.optionPhase === 'dive') cell.optDive++;
      else if (p.optionPhase === 'keep') cell.optKeep++;
      else cell.optPitch++;
      if (qbCarry) { cell.qbRushAtt++; cell.qbRushYds += p.yards || 0; }
      continue;
    }
    if (p.optionPhase === 'jet') { cell.jet++; continue; }
    if (p.optionPhase === 'draw') cell.draw++;
    if (p.optionPhase === 'wildcat') cell.wildcat++;

    if (qbCarry) {
      cell.qbRushAtt++; cell.qbRushYds += p.yards || 0;
      cell.qbDesigned++;
      if (p.concept === 'QB Sneak') cell.qbSneak++;
      else if (p.concept === 'QB Power') cell.qbPower++;
      else if (p.offFormation === 'Empty') cell.emptyKeep++;
      else cell.qbOrganicKeep++;
    }
  }
}

console.log(`rpo_audit_probe — ${N} AI-vs-AI games (fresh rosters, AI gameplans both sides)`);
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const H = aiSchool('H' + i), A = aiSchool('A' + i);
  const hD = buildDepthChart(H.roster, H.gameplan), aD = buildDepthChart(A.roster, A.gameplan);
  const r = simulateGame(H, A, H.roster, A.roster, hD, aD, H.gameplan, A.gameplan);
  for (const side of ['home', 'away']) {
    const S = side === 'home' ? H : A;
    const D = side === 'home' ? hD : aD;
    const qbIds = new Set(S.roster.filter((p) => p.position === 'QB').map((p) => p.id));
    const starterId = (D.QB || [])[0];
    const starter = S.roster.find((p) => p.id === starterId) || S.roster.find((p) => p.position === 'QB');
    const arch = derivedArchetype(starter) || 'QB-Pocket';
    archCounts[arch] = (archCounts[arch] || 0) + 1;
    const bucket = BUCKET(arch);
    const plays = (r.drives || []).filter((d) => d.possession === side).flatMap((d) => d.plays || []);
    for (const cell of [cells[bucket], cells.ALL]) {
      cell.teamGames++;
      cell.qbSPD += starter?.attributes?.SPD || 0;
      cell.qbCount++;
      tally(cell, plays, qbIds, starterId);
    }
  }
  if ((i + 1) % 50 === 0) console.log(`  ...${i + 1}/${N} games (${((Date.now() - t0) / 1e3).toFixed(0)}s)`);
}

const pg = (v, c) => (v / Math.max(1, c.teamGames)).toFixed(2);
const pct = (v, d) => (100 * v / Math.max(1, d)).toFixed(1);

console.log(`\nStarter archetype distribution over ${cells.ALL.teamGames} team-games:`);
for (const [a, n] of Object.entries(archCounts).sort((x, y) => y[1] - x[1]))
  console.log(`  ${a.padEnd(16)} ${String(n).padStart(4)}  (${pct(n, cells.ALL.teamGames)}%)`);

console.log('\nPer team-game rates by starter bucket (per-snap share in parens):');
const hdr = ['bucket', 'games', 'snaps/g', 'designedQB/g', 'sneak/g', 'power/g', 'organic/g', 'empty/g', 'scrambles/g', 'scrThrow/g', 'RPO/g', 'RPOpull%', 'opt/g', 'optKeep/g', 'QBrush yds/att', 'QB SPD'];
console.log('  ' + hdr.join(' | '));
for (const b of ['scrambler', 'dual', 'pocket', 'ALL']) {
  const c = cells[b];
  const row = [
    b.padEnd(9), c.teamGames,
    pg(c.snaps, c),
    `${pg(c.qbDesigned, c)} (${pct(c.qbDesigned, c.snaps)}%)`,
    pg(c.qbSneak, c), pg(c.qbPower, c), pg(c.qbOrganicKeep, c), pg(c.emptyKeep, c),
    `${pg(c.scrambles, c)} (${pct(c.scrambles, c.dropbacks)}% of db)`,
    pg(c.scrThrows, c),
    `${pg(c.rpoSnaps, c)} (${pct(c.rpoSnaps, c.snaps)}%)`,
    pct(c.rpoPull + c.rpoWrongPull, c.rpoSnaps) + '%',
    pg(c.optSnaps, c), pg(c.optKeep, c),
    `${(c.qbRushYds / Math.max(1, c.qbRushAtt)).toFixed(1)}/${pg(c.qbRushAtt, c)}`,
    (c.qbSPD / Math.max(1, c.qbCount)).toFixed(0),
  ];
  console.log('  ' + row.join(' | '));
}

console.log('\nRPO outcome split (ALL):');
const A = cells.ALL;
console.log(`  pull ${A.rpoPull} · wrongPull ${A.rpoWrongPull} · give ${A.rpoGive} · giveLate ${A.rpoGiveLate} · wrongGive ${A.rpoWrongGive}` +
  `  (throw rate ${pct(A.rpoPull + A.rpoWrongPull, A.rpoSnaps)}% — keep phase does not exist in the engine)`);

console.log('\nOption phases (ALL): dive', A.optDive, '· keep', A.optKeep, '· pitch', A.optPitch,
  ' | jet', A.jet, '· draw', A.draw, '· wildcat', A.wildcat);

console.log('\nFormation usage (share of scrimmage snaps):');
const totSnaps = Object.values(formUse).reduce((s, v) => s + v, 0) / 2; // counted into bucket+ALL
for (const [f, n] of Object.entries(formUse).sort((x, y) => y[1] - x[1]))
  console.log(`  ${f.padEnd(12)} ${pct(n / 2, totSnaps)}%`);

console.log(`\ndone in ${((Date.now() - t0) / 1e3).toFixed(0)}s`);
