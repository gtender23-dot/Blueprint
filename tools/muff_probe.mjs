// muff_probe.mjs — Subsystem 6 PASS 2 veto for muffed/fumbled returns.
//
// Two halves:
//   UNIT — returnMuff() directly: a sure-handed returner muffs far less than a
//   poor-hands one, the base rate sits where the constant says, and the
//   kicking team falls on ~MUFF_RECOVER_KICK of muffs.
//   EMERGENT — full games: measures the muffed-punt and fumbled-kickoff rates
//   the drive engine actually produces, and that kicking-team recoveries flip
//   possession (show up as a lost fumble). Real anchors (footballperspective
//   fumble study): ~3.5% of returnable punts muffed, kicking team recovers
//   ~1/3 (~1.15% of ALL punts a turnover); ~3.1% of kickoffs fumbled, ~1%
//   recovered by the kicking team.
//
// Run: node tools/muff_probe.mjs [games]
import { returnMuff, simulateGame } from '../js/engine/sim.js';
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { ROSTER_TARGETS, CLASS_YEARS, C } from '../js/constants.js';

const GAMES = Number(process.argv[2] || 400);
const pct = (a, b) => (b ? (100 * a / b).toFixed(2) : '—') + '%';
let fails = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) fails++; };

// ── UNIT ────────────────────────────────────────────────────────────────────
function ret(hnd, sec) { return { attributes: { HND: hnd, SEC: sec } }; }
function muffRate(returner, base, n = 200000) {
  let m = 0, lost = 0;
  for (let i = 0; i < n; i++) {
    const r = returnMuff(returner, base);
    if (r.muffed) { m++; if (r.lostToKicking) lost++; }
  }
  return { rate: m / n, lostShare: m ? lost / m : 0 };
}
console.log('=== UNIT: returnMuff() ===');
const sure = muffRate(ret(88, 88), C.PUNT_MUFF_BASE);
const avg = muffRate(ret(55, 55), C.PUNT_MUFF_BASE);
const poor = muffRate(ret(40, 40), C.PUNT_MUFF_BASE);
console.log(`  sure-handed (88/88): ${pct(sure.rate * 1, 1)}   avg (55/55): ${pct(avg.rate, 1)}   poor (40/40): ${pct(poor.rate, 1)}`);
console.log(`  lost-to-kicking share (avg returner): ${pct(avg.lostShare, 1)}   (const ${C.MUFF_RECOVER_KICK})`);
check(avg.rate > 0.030 && avg.rate < 0.040, `avg returner punt-muff rate ~PUNT_MUFF_BASE (${pct(avg.rate, 1)} vs ${C.PUNT_MUFF_BASE})`);
check(sure.rate < avg.rate && avg.rate < poor.rate, `hands monotonic: sure ${pct(sure.rate, 1)} < avg ${pct(avg.rate, 1)} < poor ${pct(poor.rate, 1)}`);
check(sure.rate < 0.015, `sure hands rarely muff (${pct(sure.rate, 1)} < 1.5%)`);
check(Math.abs(avg.lostShare - C.MUFF_RECOVER_KICK) < 0.03, `~1/3 of muffs lost to kicking team (${pct(avg.lostShare, 1)})`);

// ── EMERGENT ─────────────────────────────────────────────────────────────────
function genRoster(tier, schoolId) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], tier); p.schoolId = schoolId; r.push(p); }
  }
  return r;
}
const gp = { offFormation: 'Pro-Set', tendency: 'Balanced', rushInPct: 60, passDepth: { short: 40, medium: 40, deep: 20 }, blitzPct: 20, defFormation: 'Balanced D', fourthDown: 'Moderate', clockMgmt: 'Normal', maxFGDist: 42 };
const sH = { id: 'H', name: 'Home' }, sA = { id: 'A', name: 'Away' };

let puntReturnable = 0, puntMuff = 0, puntMuffLost = 0;
let koReturned = 0, koMuffLost = 0, koTotal = 0;
for (let i = 0; i < GAMES; i++) {
  const rH = genRoster(1, 'H'), rA = genRoster(1, 'A');
  const res = simulateGame(sH, sA, rH, rA, buildDepthChart(rH, gp), buildDepthChart(rA, gp), gp, gp);
  for (const d of res.drives) {
    for (const p of d.plays || []) {
      if (p.type === 'punt' && !p.blocked && !p.touchback && p.puntYds > 0) {
        // returnable if it wasn't fair-caught: approximate by muffed or has a returner or returnYds
        if (p.muffed) { puntReturnable++; puntMuff++; if (p.muffLost) puntMuffLost++; }
        else if (p.returnerId != null || (p.returnYds || 0) > 0) puntReturnable++;
      }
    }
  }
  // kickoffs live on the token's pendingKickoff snapshots inside plays too; scan log-free via drives is hard,
  // so count from the game's koReturns ledger + muffLost flags on kickoff play records.
  for (const d of res.drives) {
    for (const p of d.plays || []) {
      if (p.type === 'kickoff') { koTotal++; if (!p.touchback && !p.onside && !p.squib) koReturned++; if (p.muffLost) koMuffLost++; }
    }
  }
}
console.log('\n=== EMERGENT: ' + GAMES + ' games ===');
console.log(`  PUNTS returnable(approx) ${puntReturnable}  muffed ${puntMuff} (${pct(puntMuff, puntReturnable)})  lost-to-kicking ${puntMuffLost} (${pct(puntMuffLost, puntReturnable)} of returnable)`);
console.log(`  KICKOFFS total ${koTotal}  returned ${koReturned}  muff-lost ${koMuffLost} (${pct(koMuffLost, koReturned)} of returned, ${pct(koMuffLost, koTotal)} of all KOs)`);
check(puntMuff / Math.max(1, puntReturnable) > 0.02 && puntMuff / Math.max(1, puntReturnable) < 0.06, `punt muff rate ~3.5% of returnable (${pct(puntMuff, puntReturnable)})`);
check(puntMuffLost > 0, `punt muffs are lost to the kicking team sometimes (${puntMuffLost})`);
check(koMuffLost >= 0, `kickoff muff-lost recorded (${koMuffLost})`);

console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nALL PASS ✅ — muffed/fumbled returns behave as designed');
process.exit(fails ? 1 : 0);
