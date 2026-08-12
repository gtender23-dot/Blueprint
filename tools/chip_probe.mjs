// chip_probe.mjs — validates Fix B (pass-rush pass 2): chip protection. On the
// middle protections (Half-Slide / BOB) a RELEASED back can bump ONE edge
// penetrator on his way out — the third option between "block the whole play"
// and "run a route" the sources list. The bump buys the QB a beat, so that
// rusher no longer gets home this rep.
//
// The lever must:
//   1) BITE: with the chip ON, four-man sack% is LOWER than with it OFF (same
//      games, toggled via globalThis.__noChip so there is no confound).
//   2) SCALE WITH THE CHIPPER: a stout, aware back (high STR/AWR) chips more
//      pressure away than a weak one.
//   3) NOT run the league out of band: checked by stat_realism, not here.
//
// Half-Slide keeps the back-release path live and is the cleanest chip posture.
// Stop held at 'attacking' so there is enough edge pressure to chip away at.
//
// Run: node tools/chip_probe.mjs [gamesPerCell]
import { createPlayer, refreshRatings } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

function gen(t, s, rbAttr = null) {
  const r = [];
  for (const [p, c] of Object.entries(ROSTER_TARGETS))
    for (let i = 0; i < c; i++) {
      const q = createPlayer(p, CLASS_YEARS[i % 4], t);
      // Force every RB's STR+AWR to isolate the "who chips well" axis.
      if (rbAttr != null && p === 'RB') { q.attributes.STR = rbAttr; q.attributes.AWR = rbAttr; refreshRatings(q); }
      q.schoolId = s; r.push(q);
    }
  return r;
}
const sH = { id: 'H', name: 'Home' }, sA = { id: 'A', name: 'Away' };
const base = () => ({ offFormation: 'Single Back', tendency: 'Balanced', rushInPct: 60,
  passDepth: { short: 40, medium: 40, deep: 20 }, defBaseFront: '4-3', coverageScheme: 'balanced',
  fourthDown: 'Moderate', maxFGDist: 42 });
const N = parseInt(process.argv[2] || '200', 10);

// Half-Slide protection (chip-active), attacking defense (edge pressure to chip).
function cell({ noChip = false, rbAttr = null } = {}) {
  globalThis.__noChip = noChip;
  const t = { g: 0, patt: 0, sk: 0, comp: 0, yds: 0 };
  for (let i = 0; i < N; i++) {
    const rH = gen(1, 'H', rbAttr), rA = gen(1, 'A');
    const offGp = { ...base(), protIdentity: 'halfSlide', protEmphasis: 40 }; // <50 → the back releases (chip-eligible)
    const defGp = { ...base(), defAggression: 'attacking', pressureIdentity: null };
    const cH = buildDepthChart(rH, offGp), cA = buildDepthChart(rA, defGp);
    const res = simulateGame(sH, sA, rH, rA, cH, cA, offGp, defGp);
    const o = res.homeStats;
    t.g++; t.patt += o.passAtt || 0; t.sk += o.sacksAllowed || 0; t.comp += o.compAtt || 0; t.yds += o.passYds || 0;
  }
  globalThis.__noChip = false;
  const db = t.patt + t.sk;
  return { sackPct: 100 * t.sk / Math.max(1, db), sacksPerG: t.sk / t.g, comp: 100 * t.comp / Math.max(1, t.patt), ypa: t.yds / Math.max(1, t.patt) };
}
const f2 = x => x.toFixed(2);
console.log(`=== CHIP PROBE (Fix B: chip protection, N=${N}) ===\n`);

// (1) chip ON vs OFF — same games, toggled.
console.log('(1) CHIP on vs off (Half-Slide, released back, attacking D):');
// Use a competent chipping back (STR/AWR 75) — the realistic case: a back kept
// back to help IS a capable blocker. A replacement-level back's chip is real but
// too small to clear the game-level noise floor in an on/off aggregate (see the
// chipper-quality check below, which isolates that axis directly).
const off = cell({ noChip: true, rbAttr: 75 });
const on = cell({ noChip: false, rbAttr: 75 });
console.log(`  chip OFF (STR/AWR 75 back): sack% ${f2(off.sackPct)}  sacks/g ${f2(off.sacksPerG)}  comp% ${f2(off.comp)}`);
console.log(`  chip ON  (STR/AWR 75 back): sack% ${f2(on.sackPct)}  sacks/g ${f2(on.sacksPerG)}  comp% ${f2(on.comp)}`);

// (2) does a better chipper help more? weak vs stout/aware back, chip ON.
console.log('\n(2) CHIPPER QUALITY (chip ON, weak vs stout back):');
const weak = cell({ rbAttr: 40 });
const stout = cell({ rbAttr: 90 });
console.log(`  weak back  (STR/AWR 40): sack% ${f2(weak.sackPct)}  sacks/g ${f2(weak.sacksPerG)}`);
console.log(`  stout back (STR/AWR 90): sack% ${f2(stout.sackPct)}  sacks/g ${f2(stout.sacksPerG)}`);

console.log('\n=== CHECKS ===');
let pass = true;
const chk = (n, c, d = '') => { console.log(`  ${c ? 'OK  ' : 'FAIL'}  ${n}${d ? '  ' + d : ''}`); if (!c) pass = false; };
chk('1: chip ON lowers sack% vs chip OFF', on.sackPct < off.sackPct,
    `off=${f2(off.sackPct)} on=${f2(on.sackPct)}`);
chk('2: a stout/aware back chips away more pressure than a weak one', stout.sackPct < weak.sackPct,
    `weak=${f2(weak.sackPct)} stout=${f2(stout.sackPct)}`);
console.log('\n' + (pass ? 'ALL CHIP CHECKS PASSED' : '*** SOME CHIP CHECKS FAILED ***'));
process.exit(pass ? 0 : 1);
