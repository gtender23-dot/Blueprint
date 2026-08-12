// h2_shadow_probe.mjs — how much does the halftime "shadow" bracket actually take off
// the hot receiver?
//
// The shadow (defPlan._h2Shadow) is a separation penalty the player pins on one opposing
// receiver at halftime. As shipped through Jul 2026 it was nested inside the DB-blitz branch
// in sim.js, so it only fired on the ~few-percent of dropbacks where a DB blitzed — the
// bracket was sized in season.js as though it applied to every H2 snap but reached almost
// none of them. Un-nesting it makes it fire on every dropback, which multiplies its
// aggregate bite ~30x, so the eff has to be re-sized or the hot receiver vanishes.
//
// This measures the WHOLE-GAME effect (shadow on every snap) so eff can be sized against a
// clean per-snap number. In live play the flag is H2-only, so the real single-game hit on a
// receiver's final line is roughly half what this prints.
//
// Two arms, statistically identical fresh rosters each game:
//   control : away defense plays straight
//   shadow  : away defense pins _h2Shadow on home's WR1 for the whole game
// We track home WR1's targets / catches / yards in each arm and print the ratio.
//
// Usage: node tools/h2_shadow_probe.mjs [games] [eff]
//   eff omitted -> sweeps a small ladder so you can pick one.
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

const N   = parseInt(process.argv[2] || '1500', 10);
const EFF = process.argv[3] != null ? parseFloat(process.argv[3]) : null;

function genRoster(schoolId) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS))
    for (let i = 0; i < count; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], 1); p.schoolId = schoolId; r.push(p); }
  return r;
}
const baseGP = () => ({ offFormation:'Pro-Set', tendency:'Balanced', rushInPct:60, passDepth:{short:40,medium:40,deep:20}, blitzPct:20, defFormation:'Balanced D', fourthDown:'Moderate', clockMgmt:'Normal', maxFGDist:42 });
const sH = { id:'H', name:'Home' }, sA = { id:'A', name:'Away' };

// Accumulate home WR1's line over N games for a given shadow eff (null = control).
function arm(eff) {
  const acc = { games:0, tgt:0, rec:0, yds:0, td:0 };
  for (let i = 0; i < N; i++) {
    const rH = genRoster('H'), rA = genRoster('A');
    const cH = buildDepthChart(rH, baseGP()), cA = buildDepthChart(rA, baseGP());
    const wr1 = cH.WR[0];
    const gpH = baseGP(), gpA = baseGP();
    if (eff != null) gpA._h2Shadow = { id: wr1, eff };   // away D shadows home WR1 all game
    const res = simulateGame(sH, sA, rH, rA, cH, cA, gpH, gpA);
    const ps = res.homePlayerStats[wr1];
    if (ps) { acc.games++; acc.tgt += ps.targets||0; acc.rec += ps.recComp||0; acc.yds += ps.recYds||0; acc.td += ps.recTD||0; }
  }
  return acc;
}

function line(label, a) {
  const g = a.games || 1;
  return `${label.padEnd(16)} tgt/g ${(a.tgt/g).toFixed(2).padStart(5)}   rec/g ${(a.rec/g).toFixed(2).padStart(5)}   yds/g ${(a.yds/g).toFixed(1).padStart(6)}   TD/g ${(a.td/g).toFixed(3)}`;
}

console.log(`H2 shadow — home WR1 line, ${N} games/arm, shadow on EVERY snap (halve for the H2-only live hit)\n`);
const ctrl = arm(null);
console.log(line('control', ctrl));

const effs = EFF != null ? [EFF] : [0.07, 0.05, 0.035, 0.025];
for (const eff of effs) {
  const s = arm(eff);
  const dropYds = 100 * (1 - (s.yds/ (s.games||1)) / (ctrl.yds/(ctrl.games||1)));
  console.log(line(`shadow eff=${eff}`, s) + `   yds -${dropYds.toFixed(0)}%`);
}
console.log(`\n(whole-game reduction; a sensible H2-only bracket lands the full-game drop around 15-25%,`);
console.log(` i.e. a whole-game figure here of ~30-45%. Too deep and the hot man disappears.)`);
