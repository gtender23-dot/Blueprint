// rpo_conflict_probe.mjs — PASS 5 §A: RPO conflict-read machinery.
//
// Claim (roadmap): the sim previously had NO post-snap conflict on a named
// second-level defender — the RPO branch flipped on a team dial + flat LB
// average. Pass 5 puts ONE named defender (mesh role from the run concept's
// rpo tag) in conflict and prices his bite and the QB's eyes separately.
//
// Unit checks on the exported rpoConflictRead:
//   1. runCommit raises the bite rate (a committed defense triggers downhill).
//   2. Defender AWR lowers the bite AND the QB's read-win (discipline).
//   3. QB AWR/TEC raises the read-win (correct pull/give share).
//   4. rpoSound (def trait) lowers both; conflictReader (QB trait) raises read.
//   5. bitesHard (def flaw) raises the bite.
//   6. Outcome mapping is exact: read∧bite→pull · read∧¬bite→give ·
//      ¬read∧bite→wrongGive · ¬read∧¬bite→wrongPull|giveLate.
// Game-level checks (full sims):
//   7. RPO snaps fire with a named conflict defender and all outcome kinds.
//   8. __noRPOConflict restores the legacy branch: rpoRead never stamped,
//      rpo/rpoKept flags still work (old behavior preserved).
//
// Run: node tools/rpo_conflict_probe.mjs [trials] [games]
import { rpoConflictRead, simulateGame } from '../js/engine/sim.js';
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

const N = Number(process.argv[2] || 30000);
const GAMES = Number(process.argv[3] || 8);
let pass = true;
const check = (ok, label) => { console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}`); if (!ok) pass = false; };

const mk = (awr, tec = 50, traits = null) => ({ id: 'x', attributes: { AWR: awr, TEC: tec }, traits });
const withTrait = (p, k, lv) => ({ ...p, traits: { play: [{ k, lv }], flaws: [] } });
const withFlaw = (p, k, lv) => ({ ...p, traits: { play: [], flaws: [{ k, lv }] } });

function rates(qb, def, opts = {}, n = N) {
  let bites = 0, reads = 0, out = {};
  for (let i = 0; i < n; i++) {
    const r = rpoConflictRead(qb, def, opts);
    if (r.bite) bites++;
    if (r.read) reads++;
    out[r.outcome] = (out[r.outcome] || 0) + 1;
  }
  return { bite: bites / n, read: reads / n, out };
}

console.log(`=== RPO CONFLICT READ (Pass 5 §A), N=${N}/cell ===`);

// 1. runCommit raises bite
const rc0 = rates(mk(70, 70), mk(60), { runCommit: 0 });
const rc8 = rates(mk(70, 70), mk(60), { runCommit: 8 });
check(rc8.bite > rc0.bite + 0.05, `runCommit raises bite (${(rc0.bite * 100).toFixed(1)}% → ${(rc8.bite * 100).toFixed(1)}%)`);

// 2. defender AWR lowers bite and read
const dLo = rates(mk(70, 70), mk(40));
const dHi = rates(mk(70, 70), mk(85));
check(dHi.bite < dLo.bite - 0.03, `def AWR lowers bite (${(dLo.bite * 100).toFixed(1)}% → ${(dHi.bite * 100).toFixed(1)}%)`);
check(dHi.read < dLo.read - 0.03, `def AWR lowers QB read-win (${(dLo.read * 100).toFixed(1)}% → ${(dHi.read * 100).toFixed(1)}%)`);

// 3. QB quality raises read
const qLo = rates(mk(45, 45), mk(60));
const qHi = rates(mk(90, 85), mk(60));
check(qHi.read > qLo.read + 0.05, `QB AWR/TEC raises read-win (${(qLo.read * 100).toFixed(1)}% → ${(qHi.read * 100).toFixed(1)}%)`);

// 4. traits
const base = rates(mk(70, 70), mk(60));
const snd = rates(mk(70, 70), withTrait(mk(60), 'rpoSound', 3));
check(snd.bite < base.bite && snd.read < base.read, `rpoSound III lowers bite (${(base.bite * 100).toFixed(1)}%→${(snd.bite * 100).toFixed(1)}%) and read (${(base.read * 100).toFixed(1)}%→${(snd.read * 100).toFixed(1)}%)`);
const cr = rates(withTrait(mk(70, 70), 'conflictReader', 3), mk(60));
check(cr.read > base.read + 0.02, `conflictReader III raises read-win (${(base.read * 100).toFixed(1)}%→${(cr.read * 100).toFixed(1)}%)`);

// 5. flaw
const bh = rates(mk(70, 70), withFlaw(mk(60), 'bitesHard', 3));
check(bh.bite > base.bite + 0.03, `bitesHard III raises bite (${(base.bite * 100).toFixed(1)}%→${(bh.bite * 100).toFixed(1)}%)`);

// 6. outcome mapping exactness
let mapOK = true;
for (let i = 0; i < 2000; i++) {
  const r = rpoConflictRead(mk(70, 70), mk(60));
  if (r.read && r.bite && r.outcome !== 'pull') mapOK = false;
  if (r.read && !r.bite && r.outcome !== 'give') mapOK = false;
  if (!r.read && r.bite && r.outcome !== 'wrongGive') mapOK = false;
  if (!r.read && !r.bite && r.outcome !== 'wrongPull' && r.outcome !== 'giveLate') mapOK = false;
}
check(mapOK, 'outcome mapping exact over 2000 draws');

// 7/8. game-level
function roster(sid) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) for (let i = 0; i < count; i++) {
    const p = createPlayer(pos, CLASS_YEARS[i % 4], 1); p.schoolId = sid; r.push(p);
  }
  return r;
}
const gp = { offFormation: 'Spread', offFormations: [{ id: 'Spread', weight: 100 }], tendency: 'Balanced', rushInPct: 60, passDepth: { short: 40, medium: 40, deep: 20 }, blitzPct: 20, defFormation: 'Balanced D', fourthDown: 'Moderate', clockMgmt: 'Normal', maxFGDist: 42, rpoRate: 50, gadgetRate: 0 };
function playGames(n) {
  const c = { rpoSnaps: 0, named: 0, flips: 0, kept: 0, out: {} };
  for (let g = 0; g < n; g++) {
    const rH = roster('H'), rA = roster('A');
    const res = simulateGame({ id: 'H', name: 'H' }, { id: 'A', name: 'A' }, rH, rA, buildDepthChart(rH, gp), buildDepthChart(rA, gp), gp, gp);
    for (const d of res.drives || []) for (const pl of d.plays || []) {
      if (pl.rpoRead) { c.rpoSnaps++; if (pl.rpoConflictId) c.named++; c.out[pl.rpoRead] = (c.out[pl.rpoRead] || 0) + 1; }
      if (pl.rpo) c.flips++;
      if (pl.rpoKept) c.kept++;
    }
  }
  return c;
}
const live = playGames(GAMES);
const kinds = Object.keys(live.out).length;
check(live.rpoSnaps > 20 && live.named === live.rpoSnaps && kinds >= 4,
  `live games: ${live.rpoSnaps} RPO snaps, all named (${live.named}), ${kinds} outcome kinds ${JSON.stringify(live.out)}`);

globalThis.__noRPOConflict = true;
const legacy = playGames(GAMES);
globalThis.__noRPOConflict = false;
check(legacy.rpoSnaps === 0 && legacy.flips + legacy.kept > 0,
  `kill-switch: legacy branch (0 rpoRead stamps, ${legacy.flips} flips + ${legacy.kept} kept still fire)`);

console.log(pass ? '\nALL PASS ✅ — a named defender is in conflict and the read is real' : '\n⚠ FAIL');
process.exit(pass ? 0 : 1);
