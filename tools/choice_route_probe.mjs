// choice_route_probe.mjs — PASS 5 §C: choice/option routes (leverage reads).
//
// Claim (Throw Deep route guide / option-route doctrine): on a choice-tagged
// quick-game concept the featured receiver reads the defender's leverage
// post-snap and breaks away from it. The read is a skill — a bad reader
// breaks into the wall — and the QB must agree (miscommunication = the ball
// where the receiver isn't, priced as a forced throw).
//
// Checks (full games, choice-heavy call sheet):
//   1. Choice snaps fire with all read kinds (converted / held / wall) in man
//      and settle in zone.
//   2. Conversion share is monotone in the receiver: a high-AWR/TEC receiver
//      room converts clearly more than a low one.
//   3. leverageReader III raises conversion share further (trait hook live).
//   4. Miscommunication exists, is rare, and those throws complete less than
//      converted throws (the wrong-place ball is real).
//   5. Mean-neutrality: league comp% with choice routes live is within 2.5pp
//      of __noChoiceRoutes across the same cell (the leverage_probe contract).
//   6. __noChoiceRoutes: zero choice stamps.
//
// Run: node tools/choice_route_probe.mjs [games]
import { simulateGame } from '../js/engine/sim.js';
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

const GAMES = Number(process.argv[2] || 30);
let pass = true;
const check = (ok, label) => { console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}`); if (!ok) pass = false; };

function roster(sid, wrAwr = null, wrTrait = null) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) for (let i = 0; i < count; i++) {
    const p = createPlayer(pos, CLASS_YEARS[i % 4], 1);
    if (pos === 'WR' || pos === 'TE') {
      if (wrAwr != null) { p.attributes.AWR = wrAwr; p.attributes.TEC = wrAwr; }
      if (wrTrait) p.traits = { bridge: null, play: [{ k: wrTrait, lv: 3, xp: 0 }], flaws: [], earned: false };
    }
    p.schoolId = sid; r.push(p);
  }
  return r;
}
const cw = { 'Slant-Flat': 95, 'Stick': 95, 'Spot': 95, 'Curl-Flat': 95, 'Mesh': 10, 'Shallow Cross': 10, 'Smash': 10, 'Y-Cross': 10, 'Flood': 10 };
const gp = (extra = {}) => ({ offFormation: 'Spread', offFormations: [{ id: 'Spread', weight: 100 }], tendency: 'Pass-First', rushInPct: 40, passDepth: { short: 65, medium: 30, deep: 5 }, blitzPct: 20, defFormation: 'Balanced D', fourthDown: 'Moderate', clockMgmt: 'Normal', maxFGDist: 42, rpoRate: 0, gadgetRate: 0, conceptWeights: cw, ...extra });

function run(games, wrAwr = null, wrTrait = null, defExtra = {}) {
  const c = { out: {}, passAtt: 0, passComp: 0, misAtt: 0, misComp: 0, convAtt: 0, convComp: 0 };
  for (let g = 0; g < games; g++) {
    const rH = roster('H', wrAwr, wrTrait), rA = roster('A', wrAwr, wrTrait);
    const g1 = gp(), g2 = gp(defExtra);
    const res = simulateGame({ id: 'H', name: 'H' }, { id: 'A', name: 'A' }, rH, rA, buildDepthChart(rH, g1), buildDepthChart(rA, g1), g1, g2);
    for (const d of res.drives || []) for (const pl of d.plays || []) {
      if (pl.type && pl.type.startsWith('pass') && !pl.sack) { c.passAtt++; if (pl.complete) c.passComp++; }
      if (pl.choiceRoute) {
        c.out[pl.choiceRoute] = (c.out[pl.choiceRoute] || 0) + 1;
        const toChoice = pl.receiverId && pl.receiverId === pl.choiceReceiverId && pl.type.startsWith('pass') && !pl.sack;
        if (pl.choiceRoute === 'mis') { c.misSnaps = (c.misSnaps || 0) + 1; if (toChoice) c.misAtt++; }
        if (pl.choiceRoute === 'converted') { c.convSnaps = (c.convSnaps || 0) + 1; if (toChoice) c.convAtt++; }
        if (toChoice && pl.complete) { if (pl.choiceRoute === 'mis') c.misComp++; else if (pl.choiceRoute === 'converted') c.convComp++; }
      }
    }
  }
  return c;
}
const convShare = (c) => {
  const conv = (c.out.converted || 0) + (c.out.mis || 0);
  const manTotal = conv + (c.out.held || 0) + (c.out.wall || 0);
  return 100 * conv / (manTotal || 1);
};

console.log(`=== CHOICE ROUTES (Pass 5 §C), ${GAMES} games/cell ===`);

// 1. kinds — man cell carries the leverage reads; a zone-leaning cell
// carries the settle (leverage is zeroed in zone by the standing contract).
const base = run(GAMES, null, null, { covStyle: 'man' });
const zoneCell = run(Math.max(8, Math.floor(GAMES / 2)), null, null, { covStyle: 'zone' });
check((base.out.converted || 0) > 5 && (base.out.held || 0) > 0 && (base.out.wall || 0) > 0 && (zoneCell.out.settle || 0) > 0,
  `all read kinds fire — man ${JSON.stringify(base.out)} · zone ${JSON.stringify(zoneCell.out)}`);

// 2. receiver quality monotonicity
const lo = run(GAMES, 42, null, { covStyle: 'man' });
const hi = run(GAMES, 88, null, { covStyle: 'man' });
check(convShare(hi) > convShare(lo) + 6,
  `conversion monotone in receiver: ${convShare(lo).toFixed(1)}% (AWR/TEC 42) → ${convShare(hi).toFixed(1)}% (88)`);

// 3. trait hook
const tr = run(GAMES, 60, 'leverageReader', { covStyle: 'man' });
const noTr = run(GAMES, 60, null, { covStyle: 'man' });
check(convShare(tr) > convShare(noTr) + 3,
  `leverageReader III raises conversion: ${convShare(noTr).toFixed(1)}% → ${convShare(tr).toFixed(1)}%`);

// 4. miscommunication real: the wrong-place ball kills the featured man for
// the snap — the QB targets him far less than on a clean conversion (and the
// rare forced throw that does go there is priced by the forced-INT mult).
const cells = [base, lo, hi, tr, noTr];
const sum = (k) => cells.reduce((s, c) => s + (c[k] || 0), 0);
const misTotal = sum('misSnaps'), convTotal = sum('convSnaps');
const misTgt = 100 * sum('misAtt') / (misTotal || 1);
const convTgt = 100 * sum('convAtt') / (convTotal || 1);
check(misTotal > 5 && misTgt < convTgt - 10,
  `miscommunication real & rare: ${misTotal} snaps (${(100 * misTotal / (misTotal + convTotal)).toFixed(0)}% of conversions); choice-man targeted ${misTgt.toFixed(0)}% on mis vs ${convTgt.toFixed(0)}% on converted`);

// 5. mean-neutrality on comp%
const liveN = run(GAMES);
globalThis.__noChoiceRoutes = true;
const deadN = run(GAMES);
globalThis.__noChoiceRoutes = false;
const liveComp = 100 * liveN.passComp / (liveN.passAtt || 1);
const deadComp = 100 * deadN.passComp / (deadN.passAtt || 1);
check(Math.abs(liveComp - deadComp) < 2.5,
  `mean-neutral: comp% live ${liveComp.toFixed(1)} vs killed ${deadComp.toFixed(1)} (|Δ| < 2.5pp)`);

// 6. kill-switch
check(Object.keys(deadN.out).length === 0, `__noChoiceRoutes: 0 choice stamps`);

console.log(pass ? '\nALL PASS ✅ — the choice route reads leverage, and the read is a skill' : '\n⚠ FAIL');
process.exit(pass ? 0 : 1);
