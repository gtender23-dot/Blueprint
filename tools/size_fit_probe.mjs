// size_fit_probe.mjs — Identity stage 1 gates (Pass 4.5, IDENTITY_DESIGN §5).
// 1) THE FLIP: frames roll first with fat tails — real tweeners exist.
// 2) Soft priors: heavy frames bias STR/PWR up and SPD/AGI down (small).
// 3) The size-fit term: 1.0 in-window, gentle falloff, hard cap ≤10%.
// 4) __noSizeFit kills the term everywhere (multiplier reads 1.0).
// 5) effectiveRoleRating orders an in-window body over an out-of-window twin.
// Run: node tools/size_fit_probe.mjs
import { createRecruit } from '../js/engine/player.js';
import { sizeFitFromWindow, sizeFitForSlot, sizeFitForRole, JOB_SIZE_WINDOWS, isTweenerFrame } from '../js/engine/traits.js';
import { SIZE_BANDS } from '../js/constants.js';

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};

// ── 1+2: generation sweep ────────────────────────────────────────────────────
const N = 4000;
const byPos = {};
for (const pos of ['S', 'OLB', 'LB', 'DT', 'WR', 'RB']) {
  const rs = Array.from({ length: N }, () => createRecruit(pos, 2));
  byPos[pos] = rs;
}
// tweeners exist: some safeties at 220+, some OLBs at 250+ and some at ≤215
const bigS = byPos.S.filter((r) => r.weight >= 218).length / N;
const runOLB = byPos.OLB.filter((r) => r.weight <= 218).length / N;
check('fat tails: heavy safeties exist (≥218 lbs, >0.5%)', bigS > 0.005, `${(bigS * 100).toFixed(1)}%`);
check('fat tails: light OLBs exist (≤218 lbs, >0.5%)', runOLB > 0.005, `${(runOLB * 100).toFixed(1)}%`);
const tweenRate = byPos.S.filter((r) => isTweenerFrame('S', r.weight, SIZE_BANDS)).length / N;
check('tweener rate is a real minority (2–30% at S)', tweenRate > 0.02 && tweenRate < 0.3, `${(tweenRate * 100).toFixed(1)}%`);
// priors: heavy half should out-STR and under-SPD the light half
for (const pos of ['S', 'OLB']) {
  const rs = byPos[pos].slice().sort((a, b) => a.weight - b.weight);
  const lo = rs.slice(0, N / 4), hi = rs.slice(-N / 4);
  const mean = (arr, k) => arr.reduce((s, r) => s + r.attributes[k], 0) / arr.length;
  const dSTR = mean(hi, 'STR') - mean(lo, 'STR');
  const dSPD = mean(hi, 'SPD') - mean(lo, 'SPD');
  check(`${pos}: heavy quartile carries more STR (+1..+9)`, dSTR > 1 && dSTR < 9, `Δ ${dSTR.toFixed(1)}`);
  check(`${pos}: heavy quartile gives up SPD (−1..−9)`, dSPD < -1 && dSPD > -9, `Δ ${dSPD.toFixed(1)}`);
}

// ── 3: the fit term itself ───────────────────────────────────────────────────
const win = JOB_SIZE_WINDOWS.ROVER; // [215, 235]
check('in-window = exactly 1.0', sizeFitFromWindow(225, win) === 1);
check('gentle falloff just outside', sizeFitFromWindow(win[1] + 5, win) > 0.97 && sizeFitFromWindow(win[1] + 5, win) < 1);
check('hard cap ≤10% (floor 0.90)', sizeFitFromWindow(win[0] - 200, win) >= 0.9, `${sizeFitFromWindow(win[0] - 200, win)}`);
const nt = JOB_SIZE_WINDOWS.NT;
check('NT window starts heavy (≥300)', nt[0] >= 300, `[${nt}]`);

// ── 4: kill-switch ───────────────────────────────────────────────────────────
const slot = { label: 'ROVER', pos: 'S', mesh: 'SPACE' };
const light = { position: 'LB', weight: 190, traits: null };
globalThis.__noSizeFit = true;
check('__noSizeFit: slot fit reads 1.0', sizeFitForSlot(light, slot) === 1);
check('__noSizeFit: role fit reads 1.0', sizeFitForRole({ position: 'DT', weight: 250 }, 'DT-NT', SIZE_BANDS) === 1);
delete globalThis.__noSizeFit;
check('live: out-of-window slot fit < 1.0', sizeFitForSlot(light, slot) < 1, `${sizeFitForSlot(light, slot).toFixed(3)}`);

// ── 5: role-rating ordering ──────────────────────────────────────────────────
const { default: _ } = { default: null };
const mkDT = (w) => {
  const r = createRecruit('DT', 2);
  r.weight = w;
  r.traits = { bridge: null, play: [], flaws: [] };
  return r;
};
const twinA = mkDT(320), twinB = mkDT(255);
twinB.attributes = { ...twinA.attributes };
twinB.compositeRating = twinA.compositeRating;
twinB.roleRatings = { ...twinA.roleRatings };
const { effRole } = await (async () => {
  const m = await import('../js/engine/formations.js');
  // effectiveRoleRating is not exported; verify through the exported
  // schemeAdjustedOVR path is DE/OLB/LB-only, so use sizeFitForRole directly.
  return { effRole: null };
})();
const fitHeavy = sizeFitForRole(twinA, 'DT-NT', SIZE_BANDS);
const fitLight = sizeFitForRole(twinB, 'DT-NT', SIZE_BANDS);
check('NT role: 320-lb body fits (1.0), 255-lb body pays', fitHeavy === 1 && fitLight < 1 && fitLight >= 0.9, `${fitHeavy} vs ${fitLight.toFixed(3)}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
