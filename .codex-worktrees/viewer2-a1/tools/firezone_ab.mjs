// firezone_ab.mjs — PLAYTEST 2026-08-12 item 4. A DECISION RECORD, NOT A GATE.
//
// THE REPORTED BUG. sim.js's rush-3 path grafts its dropped ids onto
// `defPersonnelCov` and its comment claims the fire-zone drop obeys "the same
// body-conservation law (a man leaves the rush ledger only by entering the
// coverage ledger)". It does not. Fire-zone `droppedIds` go into `lbIds` — used
// ONLY to pick more blitzers — and never reach `defPersonnelCov`, the one thing
// handed to `assignCoverage`. The dropped man's entire contribution is `fzBonus`,
// a scalar spent on `resolvePassRush`. So on paper, dropping a lineman into
// coverage improves your PASS RUSH and leaves your coverage untouched.
//
// WHY THE OBVIOUS FIX WAS NOT SHIPPED. Grafting the ids in and re-running this
// A/B (three arms, matched RNG) measured the graft ALONE making the defence
// WORSE: comp% +0.23, INT% −0.21, sacks −0.20, pass yds +6.2. Two structural
// reasons, both bigger than the item:
//
//   1. `defPersonnel.LB` is NEVER pruned of blitzing linebackers — only ONE
//      blitzing DB is filtered out (`blitzerDbId`). A backer who rushes is still
//      counted as a coverage defender. So the ledger already balances by
//      accident, and grafting the dropped lineman on top inflates it to eight
//      cover men behind a four-man rush.
//   2. assignCoverage's concept-stress swap moves the weakest-AWR cover defender
//      onto the primary receiver. Adding a 290-pound end to that pool hands the
//      offence a better man to attack.
//
// So the honest conclusion is that item 4 is downstream of a LARGER bug: a blitz
// currently costs the defence less coverage than it should, league-wide. Fixing
// that moves stat bands hard and deserves its own pass. This file stays so the
// experiment can be re-run in one command when that pass happens.
//
// To reproduce: re-add the two gates to sim.js (`__noFZGraft` around the
// `_covExtra` line, `__noFZBonusCut` around the fzBonus curve) and run:
//   node tools/firezone_ab.mjs [N]
// As shipped both gates are absent, so all three arms are identical and the
// deltas read ~0 — that is expected, and is itself the proof nothing changed.
//
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

const N = parseInt(process.argv[2] || '400', 10);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const realRandom = Math.random;

// A 3-4 defence is the front that drops natively, so it is the one that
// exercises the path. Aggression high enough that blitzes actually fire.
const gpOff = { offFormation: 'Single Back', tendency: 'Heavy Pass', rushInPct: 40, passDepth: { short: 35, medium: 40, deep: 25 }, fourthDown: 'Moderate', clockMgmt: 'Normal', maxFGDist: 42 };
const gpDef = { ...gpOff, defBaseFront: '3-4', blitzPct: 34, covStyle: 'mixed', covShell: 'balanced' };
const sH = { id: 'H', name: 'Home' }, sA = { id: 'A', name: 'Away' };

function genRoster(id) {
  const r = [];
  for (const [pos, c] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < c; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], 1); p.schoolId = id; r.push(p); }
  }
  return r;
}

// THREE arms, because the change has two halves that pull opposite ways and a
// single before/after cannot tell you whether the graft is doing anything at all.
function runArm(label, { graft, bonusCut }) {
  // No-ops unless the gates have been re-added to sim.js (see the header).
  if (graft) delete globalThis.__noFZGraft; else globalThis.__noFZGraft = true;
  if (bonusCut) delete globalThis.__noFZBonusCut; else globalThis.__noFZBonusCut = true;
  Math.random = mulberry32(20260812);

  const t = { g: 0, patt: 0, pcomp: 0, pyds: 0, pints: 0, sacks: 0, pts: 0, plays: 0, rush: 0, ratt: 0 };
  for (let i = 0; i < N; i++) {
    const rH = genRoster('H'), rA = genRoster('A');
    const res = simulateGame(sH, sA, rH, rA, buildDepthChart(rH, gpOff), buildDepthChart(rA, gpDef), gpOff, gpDef);
    for (const st of [res.homeStats, res.awayStats]) {
      t.patt += st.passAtt; t.pcomp += st.compAtt; t.pyds += st.passYds; t.pints += st.ints;
      t.sacks += st.sacksAllowed || 0; t.rush += st.rushYds; t.ratt += st.rushAtt;
      t.plays += st.rushAtt + st.passAtt;
    }
    t.pts += res.homeScore + res.awayScore; t.g += 2;
  }
  Math.random = realRandom;
  delete globalThis.__noFZGraft;
  delete globalThis.__noFZBonusCut;
  return {
    label,
    comp: t.pcomp / t.patt * 100, ypa: t.pyds / t.patt, intPct: t.pints / t.patt * 100,
    sacks: t.sacks / t.g, pts: t.pts / t.g, pass: t.pyds / t.g, rush: t.rush / t.g,
    ypc: t.rush / t.ratt, plays: t.plays / t.g,
  };
}

console.log(`\n=== FIRE-ZONE BODY CONSERVATION A/B — ${N} games/arm, 3-4 defence, matched RNG ===`);
const A = runArm('before', { graft: false, bonusCut: false });
const G = runArm('graft only', { graft: true, bonusCut: false });
const B = runArm('shipped', { graft: true, bonusCut: true });

const ROWS = [
  ['comp %', 'comp', 1], ['yds/att', 'ypa', 2], ['INT %', 'intPct', 2],
  ['sacks/team', 'sacks', 2], ['pass yds/team', 'pass', 1],
  ['points/team', 'pts', 1], ['rush yds/team', 'rush', 1], ['yds/carry', 'ypc', 2],
];
console.log('\n  metric            before   +graft    shipped   graft-only   net');
for (const [label, key, dp] of ROWS) {
  const dG = G[key] - A[key], dB = B[key] - A[key];
  console.log(`  ${label.padEnd(16)} ${A[key].toFixed(dp).padStart(7)} ${G[key].toFixed(dp).padStart(8)} ${B[key].toFixed(dp).padStart(10)}` +
    ` ${((dG >= 0 ? '+' : '') + dG.toFixed(dp)).padStart(12)} ${((dB >= 0 ? '+' : '') + dB.toFixed(dp)).padStart(7)}`);
}
// The graft on its own must HELP THE DEFENCE — that is the whole point of the
// body-conservation law. If this reads ~0 the drop is still reaching nothing.
const graftComp = G.comp - A.comp;
console.log(`\n  graft-only completion %% delta: ${graftComp >= 0 ? '+' : ''}${graftComp.toFixed(2)} (must be NEGATIVE — an extra cover man defends)`);

// THE BAR. Coverage should get better (the extra body is real) and the rush
// should give a little back (fzBonus halved) — but the pair has to land inside
// the standing stat bands, not swing the game. This is a mechanism-realism fix,
// not a band repair, so net movement should be small and in the right DIRECTION.
let fail = 0;
const band = (label, delta, tol, unit = '') => {
  const ok = Math.abs(delta) <= tol;
  if (!ok) fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(32)} Δ ${(delta >= 0 ? '+' : '') + delta.toFixed(2)}${unit} (tol ±${tol})`);
};
console.log('\n  the trade must be near-neutral overall:');
band('completion %', B.comp - A.comp, 1.5, '%');
band('yards/attempt', B.ypa - A.ypa, 0.35);
band('sacks/team', B.sacks - A.sacks, 0.35);
band('points/team', B.pts - A.pts, 1.5);
band('rush yds/team (should be inert)', B.rush - A.rush, 8);
band('yards/carry (should be inert)', B.ypc - A.ypc, 0.2);

console.log(`\n${fail === 0 ? 'in band' : `${fail} out of band`} — see the header: as shipped this is a decision record, not a gate.`);
process.exit(0);
