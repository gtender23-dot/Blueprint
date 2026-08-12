// tipdrill_ab.mjs — M25 stat A/B: the tip-drill chain's cost, measured.
// LIVE (shipping constant) vs KILL (globalThis.__noTipDrill). UNSEEDED, the
// band-A/B convention (pass7_band_ab) — a pinned LCG was tried first and
// the extra draw per breakup phase-shifted the whole stream, making the two
// arms play different games; volume is the honest comparison. seedFlaky in
// the manifest for the same reason.
// The chain adds INTs at exactly the tip rate and touches nothing else —
// tip plays KEEP their pbuId, so the PBU ledger must not move. At N=120/arm
// the cross-arm SE on INT/g is ~0.08 (comparable to the ~0.15 effect), so
// the gates are 3-SE bands around the honest expectations, not tight drift
// windows — this A/B catches a mis-wired chain (INTs doubling, PBUs
// vanishing, scoring moved), and tipdrill_probe owns exactness. Gates:
//   * chain fires live, never killed; tip rate in [0.05, 0.30]/team-game
//   * |INT drift − tip rate| ≤ 0.25 (the INTs gained ARE the tips fired)
//   * |PBU drift| ≤ 0.8 · |pts| ≤ 3.5 · |comp%| ≤ 2.5 · |plays| ≤ 2.5
// Run from repo root: node tools/tipdrill_ab.mjs [gamesPerArm]
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

const N = parseInt(process.argv[2] || '120', 10);

function genRoster(t, s) {
  const r = [];
  for (const [pos, c] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < c; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], t); p.schoolId = s; r.push(p); }
  }
  return r;
}
const mk = (o = {}) => ({ offFormations: [{ id: 'Spread', weight: 30 }, { id: 'Single Back', weight: 25 },
    { id: 'Flexbone', weight: 20 }, { id: 'Wildcat', weight: 10 }, { id: 'Power-I', weight: 15 }],
  tendency: 'Balanced', rushInPct: 55, passDepth: { short: 40, medium: 40, deep: 20 },
  blitzPct: 30, fourthDown: 'Moderate', baseTempo: 'Normal', maxFGDist: 42, jetRate: 25, drawRate: 20, ...o });

function arm(kill) {
  if (kill) globalThis.__noTipDrill = true;
  const m = { games: 0, pts: 0, ints: 0, pbus: 0, comp: 0, att: 0, plays: 0, tips: 0 };
  for (let i = 0; i < N; i++) {
    const rH = genRoster(1, 'H'), rA = genRoster(1, 'A');
    const res = simulateGame({ id: 'H', name: 'H' }, { id: 'A', name: 'A' }, rH, rA,
      buildDepthChart(rH, mk()), buildDepthChart(rA, mk()), mk(), mk());
    m.games += 2; // per-TEAM-game averages
    m.pts += (res.homeScore || 0) + (res.awayScore || 0);
    for (const d of res.drives || []) for (const pl of d.plays || []) {
      m.plays++;
      if (pl.tipDrill) m.tips++;
      if (pl.turnover && pl.turnoverType === 'interception') m.ints++;
      if (pl.pbuId != null) m.pbus++;
      if (String(pl.type || '').startsWith('pass') && !pl.sack && !pl.throwAway) {
        m.att++;
        if (pl.complete) m.comp++;
      }
    }
  }
  if (kill) delete globalThis.__noTipDrill;
  return m;
}

const live = arm(false);
const kill = arm(true);

const per = (m, k) => m[k] / m.games;
const line = (tag, m) => console.log(
  `${tag}  pts/g ${per(m, 'pts').toFixed(2)}  INT/g ${per(m, 'ints').toFixed(3)}  PBU/g ${per(m, 'pbus').toFixed(3)}` +
  `  comp% ${(m.comp / m.att * 100).toFixed(1)}  plays/g ${per(m, 'plays').toFixed(1)}  tips ${m.tips} (${(m.tips / m.games).toFixed(3)}/g)`);
console.log(`=== TIP-DRILL A/B — ${N} games per arm (unseeded) ===`);
line('LIVE', live);
line('KILL', kill);

const dInt = per(live, 'ints') - per(kill, 'ints');
const dPbu = per(live, 'pbus') - per(kill, 'pbus');
const dPts = Math.abs(per(live, 'pts') - per(kill, 'pts'));
const dComp = Math.abs(live.comp / live.att * 100 - kill.comp / kill.att * 100);
const dPlays = Math.abs(per(live, 'plays') - per(kill, 'plays'));
console.log(`\ndrift: INT ${dInt >= 0 ? '+' : ''}${dInt.toFixed(3)}  PBU ${dPbu.toFixed(3)}  |pts| ${dPts.toFixed(2)}  |comp%| ${dComp.toFixed(2)}  |plays| ${dPlays.toFixed(2)}`);

let pass = true;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `  [${detail}]` : ''}`);
  if (!ok) pass = false;
};
const tipRate = live.tips / live.games;
check('chain fires live, never killed', live.tips > 0 && kill.tips === 0, `live=${live.tips} kill=${kill.tips}`);
check('tip rate near design (0.05 .. 0.30 per team-game)', tipRate >= 0.05 && tipRate <= 0.3, tipRate.toFixed(3));
check('INTs gained match the tips fired (|drift − rate| ≤ 0.25)', Math.abs(dInt - tipRate) <= 0.25, `drift ${dInt.toFixed(3)} vs rate ${tipRate.toFixed(3)}`);
check('PBU ledger unmoved — tip plays keep their pbuId (|Δ| ≤ 0.8)', Math.abs(dPbu) <= 0.8, dPbu.toFixed(3));
check('points flat inside noise (|Δ| ≤ 3.5)', dPts <= 3.5, dPts.toFixed(2));
check('completion % flat inside noise (|Δ| ≤ 2.5)', dComp <= 2.5, dComp.toFixed(2));
check('plays/game flat inside noise (|Δ| ≤ 2.5)', dPlays <= 2.5, dPlays.toFixed(2));
process.exit(pass ? 0 : 1);
