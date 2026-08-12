// align_probe.mjs — validates Fix C (pass-rush pass 2): align-to-win. The
// defense flips alignment to isolate its BEST rusher on the WEAKEST blocker and
// wins that schemed 1-on-1 (the "guard-on-an-island" / X-rusher idea, #5/#14/#30).
//
// The lever must:
//   1) BITE: with a standout DE on the defense and a line with a weak link, the
//      alignment scheme raises sack% vs align-off (toggled via globalThis.__noAlign,
//      so no confound).
//   2) BE DENIED BY THE OL: a heads-up line (high center AWR) re-identifies and
//      re-sets, conceding fewer align sacks than a lost line at the same design.
//   3) NOT run the league out of band: checked by stat_realism, not here.
//
// Stop held at 'bend' so the rush stays at four (isolate the base-rush scheme).
//
// Run: node tools/align_probe.mjs [gamesPerCell]
import { createPlayer, refreshRatings } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

// One standout DE on the D; one weak OL link on the O; optional OL awareness set.
function gen(t, s, { standoutDL = false, weakOL = false, olAwr = null } = {}) {
  const r = [];
  let dlDone = false, olDone = false;
  for (const [p, c] of Object.entries(ROSTER_TARGETS))
    for (let i = 0; i < c; i++) {
      const q = createPlayer(p, CLASS_YEARS[i % 4], t);
      if (standoutDL && p === 'DE' && !dlDone) { for (const a of ['STR', 'PWR', 'SPD', 'TEC']) q.attributes[a] = 95; refreshRatings(q); dlDone = true; }
      if (weakOL && p === 'OL' && !olDone) { for (const a of ['STR', 'TEC', 'AWR', 'PWR']) q.attributes[a] = 40; refreshRatings(q); olDone = true; }
      if (olAwr != null && p === 'OL') { q.attributes.AWR = olAwr; refreshRatings(q); }
      q.schoolId = s; r.push(q);
    }
  return r;
}
const sH = { id: 'H', name: 'Home' }, sA = { id: 'A', name: 'Away' };
const base = () => ({ offFormation: 'Single Back', tendency: 'Balanced', rushInPct: 60,
  passDepth: { short: 40, medium: 40, deep: 20 }, defBaseFront: '4-3', coverageScheme: 'balanced',
  fourthDown: 'Moderate', maxFGDist: 42 });
const N = parseInt(process.argv[2] || '200', 10);

function cell({ noAlign = false, homeGen = {}, design = 100 } = {}) {
  globalThis.__noAlign = noAlign;
  const t = { g: 0, patt: 0, sk: 0 };
  for (let i = 0; i < N; i++) {
    const rH = gen(1, 'H', homeGen), rA = gen(1, 'A', { standoutDL: true });
    const offGp = { ...base() };
    const defGp = { ...base(), defAggression: 'bend', pressureIdentity: null, blitzDesign: design };
    const cH = buildDepthChart(rH, offGp), cA = buildDepthChart(rA, defGp);
    const res = simulateGame(sH, sA, rH, rA, cH, cA, offGp, defGp);
    const o = res.homeStats;
    t.g++; t.patt += o.passAtt || 0; t.sk += o.sacksAllowed || 0;
  }
  globalThis.__noAlign = false;
  const db = t.patt + t.sk;
  return { sackPct: 100 * t.sk / Math.max(1, db), sacksPerG: t.sk / t.g };
}
const f2 = x => x.toFixed(2);
console.log(`=== ALIGN PROBE (Fix C: align-to-win, N=${N}) ===\n`);

// (1) align on vs off — standout DE, line with a weak link.
console.log('(1) ALIGN on vs off (standout DE vs a line with a weak link, design=100):');
const off = cell({ noAlign: true, homeGen: { weakOL: true } });
const on = cell({ noAlign: false, homeGen: { weakOL: true } });
console.log(`  align OFF: sack% ${f2(off.sackPct)}  sacks/g ${f2(off.sacksPerG)}`);
console.log(`  align ON:  sack% ${f2(on.sackPct)}  sacks/g ${f2(on.sacksPerG)}`);

// (2) OL awareness denies it — align ON, lost line vs sharp line.
console.log('\n(2) OL AWARENESS denies the align scheme (align ON, weak link + AWR set):');
const lost = cell({ noAlign: false, homeGen: { weakOL: true, olAwr: 40 } });
const sharp = cell({ noAlign: false, homeGen: { weakOL: true, olAwr: 92 } });
console.log(`  lost line  (OL AWR 40): sack% ${f2(lost.sackPct)}  sacks/g ${f2(lost.sacksPerG)}`);
console.log(`  sharp line (OL AWR 92): sack% ${f2(sharp.sackPct)}  sacks/g ${f2(sharp.sacksPerG)}`);

console.log('\n=== CHECKS ===');
let pass = true;
const chk = (n, c, d = '') => { console.log(`  ${c ? 'OK  ' : 'FAIL'}  ${n}${d ? '  ' + d : ''}`); if (!c) pass = false; };
chk('1: align ON isolates the standout → more pressure than align OFF', on.sackPct > off.sackPct,
    `off=${f2(off.sackPct)} on=${f2(on.sackPct)}`);
chk('2: a sharp line re-sets and concedes fewer align sacks than a lost line', sharp.sackPct < lost.sackPct,
    `lost=${f2(lost.sackPct)} sharp=${f2(sharp.sackPct)}`);
console.log('\n' + (pass ? 'ALL ALIGN CHECKS PASSED' : '*** SOME ALIGN CHECKS FAILED ***'));
process.exit(pass ? 0 : 1);
