// _qa_fast.mjs — fast single-game QA: Play Now box score, edge cases, stat-surface NaN.
import { createPlayer, refreshRatings } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

const num = (v) => typeof v === 'number' && Number.isFinite(v);
function gen(id, tier = 1, edit) {
  const r = [];
  for (const [pos, c] of Object.entries(ROSTER_TARGETS)) for (let i = 0; i < c; i++) {
    const p = createPlayer(pos, CLASS_YEARS[i % 4], tier); p.schoolId = id; if (edit) edit(p); r.push(p);
  }
  return r;
}
function scanBad(o, path, out, seen, d) {
  if (d > 5 || o == null) return;
  if (typeof o === 'number') { if (!Number.isFinite(o)) out.push(path); return; }
  if (typeof o !== 'object') return; if (seen.has(o)) return; seen.add(o);
  if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) scanBad(o[i], path + '[' + i + ']', out, seen, d + 1); return; }
  for (const k in o) scanBad(o[k], path + '.' + k, out, seen, d + 1);
}
const gp = { offFormation: 'Single Back', tendency: 'Balanced', rushInPct: 45, passDepth: { short: 34, medium: 33, deep: 33 }, blitzPct: 22, defFormation: 'Balanced D', fourthDown: 'Moderate', clockMgmt: 'Normal', maxFGDist: 42 };
let fails = 0;
const chk = (ok, label, extra = '') => { if (!ok) fails++; console.log(`  [${ok ? 'OK' : 'FAIL'}] ${label}${extra ? ' — ' + extra : ''}`); };

// ── A. Play Now: one game, valid box score ──
console.log('=== A. PLAY NOW — one game, valid box score ===');
{
  const rH = gen('H'), rA = gen('A');
  const res = simulateGame({ id: 'H', name: 'Home' }, { id: 'A', name: 'Away' }, rH, rA, buildDepthChart(rH, gp), buildDepthChart(rA, gp), gp, gp);
  chk(num(res.homeScore) && num(res.awayScore), 'final score finite', `${res.homeScore}-${res.awayScore}`);
  chk(!!res.homePlayerStats && !!res.awayPlayerStats, 'player stat maps present');
  const bad = []; scanBad({ homeStats: res.homeStats, awayStats: res.awayStats, home: res.homePlayerStats, away: res.awayPlayerStats }, 'box', bad, new WeakSet(), 0);
  chk(bad.length === 0, 'no NaN/undefined in box score', bad.slice(0, 4).join(','));
  // a QB threw for yards, someone rushed, TDs sum to ~score
  let pass = 0, rush = 0, td = 0;
  for (const m of [res.homePlayerStats, res.awayPlayerStats]) for (const id in m) { pass += m[id].passYds || 0; rush += m[id].rushYds || 0; td += (m[id].passTD || 0) + (m[id].rushTD || 0); }
  chk(pass > 0 && rush > 0, 'passing & rushing yards accrued', `pass ${pass}, rush ${rush}`);
  chk(td > 0, 'touchdowns credited to players', `${td} off TDs`);
}

// ── B. Edge cases ──
console.log('\n=== B. EDGE CASES ===');
// B1 blowout: elite vs scrub
{
  let crash = null, res;
  try { const rH = gen('H', 1, p => { for (const k in p.attributes) p.attributes[k] = 99; refreshRatings(p); }); const rA = gen('A', 3, p => { for (const k in p.attributes) p.attributes[k] = 30; refreshRatings(p); }); res = simulateGame({ id: 'H' }, { id: 'A' }, rH, rA, buildDepthChart(rH, gp), buildDepthChart(rA, gp), gp, gp); } catch (e) { crash = e.message; }
  chk(!crash, 'blowout (99 vs 30) no crash', crash || `${res && res.homeScore}-${res && res.awayScore}`);
}
// B2 degenerate gameplan: all-deep, max blitz, no runs
{
  const dgp = { ...gp, rushInPct: 0, passDepth: { short: 0, medium: 0, deep: 100 }, blitzPct: 100, fourthDown: 'Gunslinger' };
  let crash = null, res;
  try { const rH = gen('H'), rA = gen('A'); res = simulateGame({ id: 'H' }, { id: 'A' }, rH, rA, buildDepthChart(rH, dgp), buildDepthChart(rA, dgp), dgp, dgp); } catch (e) { crash = e.message; }
  const bad = []; if (res) scanBad({ h: res.homeStats, a: res.awayStats }, 'x', bad, new WeakSet(), 0);
  chk(!crash && bad.length === 0, 'degenerate gameplan (all-deep, max blitz) no crash/NaN', crash || (bad.length ? bad.join(',') : `score ${res.homeScore}-${res.awayScore}, ypa ${(res.homeStats.passYds / (res.homeStats.passAtt || 1)).toFixed(1)}`));
}
// B3 thin/gutted roster (half the players removed)
{
  let crash = null, res;
  try { const rH = gen('H').slice(0, 35), rA = gen('A'); res = simulateGame({ id: 'H' }, { id: 'A' }, rH, rA, buildDepthChart(rH, gp), buildDepthChart(rA, gp), gp, gp); } catch (e) { crash = e.message; }
  chk(!crash, 'thin roster (35 players) no crash', crash || 'ok');
}
// B4 many games — look for any crash/NaN across a batch (proxy for a season of variety incl OT/ties)
{
  let crash = null, nanGames = 0, ot = 0, ties = 0, n = 60;
  for (let i = 0; i < n && !crash; i++) {
    try {
      const rH = gen('H', 1 + (i % 3)), rA = gen('A', 1 + ((i + 1) % 3));
      const res = simulateGame({ id: 'H' }, { id: 'A' }, rH, rA, buildDepthChart(rH, gp), buildDepthChart(rA, gp), gp, gp);
      const bad = []; scanBad({ h: res.homeStats, a: res.awayStats, hp: res.homePlayerStats, ap: res.awayPlayerStats }, 'g', bad, new WeakSet(), 0);
      if (bad.length) nanGames++;
      if (res.overtime || res.wentOT || res.otPeriods) ot++;
      if (res.homeScore === res.awayScore) ties++;
    } catch (e) { crash = e.message; }
  }
  chk(!crash && nanGames === 0, `${n}-game batch: no crash, no NaN box scores`, crash || `NaN games ${nanGames}, OT ${ot}, tied-at-regulation ${ties}`);
}

console.log(`\n${fails === 0 ? 'FAST QA ALL OK ✅' : '⚠ ' + fails + ' FAIL(s)'}`);
process.exit(fails === 0 ? 0 : 1);
