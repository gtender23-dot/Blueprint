// blitz_pie_probe.mjs — BLITZ PIE gate (Ref/BLITZ_PIE_PLAN.md).
// (a) the 100% pie's weighted lottery honors the split (a 70/30 LB/S dial
//     puts the safety on ~30% of fired blitzes; undialed control keeps the
//     identity's LB-first pick), (b) HEAT owns how-often (100 vs 0 ≈ 3× the
//     fired rate, inside the aggression cap), (c) a 🛡 slice manufactures
//     fire-zone looks on fired snaps, (d) __noBlitzPie restores legacy
//     (heat inert, lottery dead), (e) undialed plans are untouched either way.
// Run: node tools/blitz_pie_probe.mjs [N-games-per-arm]   (default 60)
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

const N = Number(process.argv[2] ?? 60);
let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};
function genRoster(s) {
  const r = [];
  for (const [pos, c] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < c; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], 1); p.schoolId = s; r.push(p); }
  }
  return r;
}
const baseGp = (extra = {}) => ({
  offFormation: 'Pro-Set', tendency: 'Balanced', rushInPct: 60,
  passDepth: { short: 40, medium: 40, deep: 20 }, blitzPct: 20,
  defFormation: 'Balanced D', fourthDown: 'Moderate', clockMgmt: 'Normal', maxFGDist: 42,
  pressureIdentity: 'secondLevel',
  ...extra,
});
// Home carries the defense under test; measure plays where home DEFENDS.
// frontFilter: HEAT and the pie live on ONE front's entry — situational subs
// (Nickel/Dime on passing downs) field other fronts, so per-front claims are
// measured on the dialed front's own snaps (the play records defFront).
function runArm(defGp, games = N, frontFilter = null) {
  const acc = { defSnaps: 0, fired: 0, sBlitz: 0, lbBlitz: 0, fz: 0 };
  for (let g = 0; g < games; g++) {
    const rH = genRoster('H'), rA = genRoster('A');
    const posOf = new Map(rH.map((p) => [p.id, p.position]));
    const gpH = structuredClone(defGp), gpA = baseGp();
    const res = simulateGame({ id: 'H', name: 'H' }, { id: 'A', name: 'A' }, rH, rA, buildDepthChart(rH, gpH), buildDepthChart(rA, gpA), gpH, gpA);
    for (const d of res.drives) {
      if (d.possession !== 'away') continue; // home on defense
      for (const pl of d.plays || []) {
        if (!/^pass/.test(pl.type || '')) continue;
        if (frontFilter && pl.defFront !== frontFilter) continue;
        acc.defSnaps++;
        if (!pl.blitzFired) continue;
        acc.fired++;
        if (pl.fireZone) acc.fz++;
        for (const id of pl.blitzerIds || []) {
          const pos = posOf.get(id);
          if (pos === 'S') acc.sBlitz++;
          else if (pos === 'LB' || pos === 'OLB') acc.lbBlitz++;
        }
      }
    }
  }
  return acc;
}
const pieGp = (shares, front = '4-3', heat) => baseGp({
  defBaseFront: front,
  fieldAssignments: { offense: {}, defense: { [front]: { slots: {}, blitzShares: shares, ...(heat != null ? { heat } : {}) } } },
});

// (a) lottery honors the split
{
  const dial = runArm(pieGp({ LB_M: 70, S_SS: 30 }), N, '4-3');
  const ctrl = runArm(baseGp(), N, '4-3');
  const sShare = dial.fired ? dial.sBlitz / Math.max(1, dial.sBlitz + dial.lbBlitz) : 0;
  const sCtrl = ctrl.fired ? ctrl.sBlitz / Math.max(1, ctrl.sBlitz + ctrl.lbBlitz) : 0;
  check('70/30 LB/S pie puts the safety on ~30% of heat', sShare > 0.2 && sShare < 0.42, `S share ${(sShare * 100).toFixed(1)}% (n=${dial.fired} fired)`);
  check('undialed control keeps the identity pick (S rare)', sCtrl < 0.12 && sShare > sCtrl + 0.12, `ctrl S share ${(sCtrl * 100).toFixed(1)}%`);
}
// (b) HEAT owns how-often (low base rate so the aggression cap leaves
// headroom to see the ×3 spread; at high dialed rates the cap compresses hot)
{
  const lowRate = { blitzPct: 12 };
  const hot = runArm({ ...pieGp({ LB_M: 100 }, '4-3', 100), ...lowRate }, N, '4-3');
  const cold = runArm({ ...pieGp({ LB_M: 100 }, '4-3', 0), ...lowRate }, N, '4-3');
  const auto = runArm({ ...pieGp({ LB_M: 100 }, '4-3'), ...lowRate }, N, '4-3');
  const rHot = hot.fired / Math.max(1, hot.defSnaps);
  const rCold = cold.fired / Math.max(1, cold.defSnaps);
  const rAuto = auto.fired / Math.max(1, auto.defSnaps);
  check('heat 100 vs 0 ≈ 3× the fired rate on the dialed front', rHot > rCold * 2.2 && rHot > rAuto + 0.03 && rAuto > rCold + 0.03, `hot ${(rHot * 100).toFixed(1)}% · auto ${(rAuto * 100).toFixed(1)}% · cold ${(rCold * 100).toFixed(1)}%`);
}
// (c) a 🛡 slice manufactures fire zones
{
  const fzArm = runArm(pieGp({ OLB_L: 50, LB_I1: 50 }, '3-4'), N, '3-4');
  const ctrl = runArm(pieGp({ LB_I1: 100 }, '3-4'), N, '3-4');
  const fzRate = fzArm.fired ? fzArm.fz / fzArm.fired : 0;
  const fzCtrl = ctrl.fired ? ctrl.fz / ctrl.fired : 0;
  check('shield slice raises fire-zone rate on fired snaps', fzRate > fzCtrl + 0.05, `${(fzRate * 100).toFixed(1)}% vs ctrl ${(fzCtrl * 100).toFixed(1)}%`);
}
// (d) kill-switch restores legacy
{
  globalThis.__noBlitzPie = true;
  const hot = runArm(pieGp({ LB_M: 100 }, '4-3', 100), N, '4-3');
  const cold = runArm(pieGp({ LB_M: 100 }, '4-3', 0), N, '4-3');
  const dial = runArm(pieGp({ LB_M: 70, S_SS: 30 }), N, '4-3');
  delete globalThis.__noBlitzPie;
  const rHot = hot.fired / Math.max(1, hot.defSnaps);
  const rCold = cold.fired / Math.max(1, cold.defSnaps);
  const sShare = dial.fired ? dial.sBlitz / Math.max(1, dial.sBlitz + dial.lbBlitz) : 0;
  check('__noBlitzPie: heat inert', Math.abs(rHot - rCold) < 0.05, `hot ${(rHot * 100).toFixed(1)}% vs cold ${(rCold * 100).toFixed(1)}%`);
  check('__noBlitzPie: lottery dead (legacy preference pick, S rare again)', sShare < 0.1, `S share ${(sShare * 100).toFixed(1)}%`);
}
// (e) undialed plans untouched by the switch
{
  const on = runArm(baseGp(), Math.max(30, Math.floor(N / 2)));
  globalThis.__noBlitzPie = true;
  const off = runArm(baseGp(), Math.max(30, Math.floor(N / 2)));
  delete globalThis.__noBlitzPie;
  const rOn = on.fired / Math.max(1, on.defSnaps);
  const rOff = off.fired / Math.max(1, off.defSnaps);
  check('undialed plans: switch is a no-op (rates within noise)', Math.abs(rOn - rOff) < 0.04, `${(rOn * 100).toFixed(1)}% vs ${(rOff * 100).toFixed(1)}%`);
}
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
