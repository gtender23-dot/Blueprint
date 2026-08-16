// ─────────────────────────────────────────────────────────────────────────
// BROKEN-TACKLE UNIT TEST — fixed-attribute contest probe
//
// WHY: the season_probe rolls a fresh random roster each run, so comparing break
// rates ACROSS probe runs (different rosters) is invalid — a "2.2/g vs 0.7/g"
// difference can be pure roster variance (one run's Scat back has ELU 90, the
// next's has ELU 79). Scale CANNOT be calibrated that way. This test fixes the
// attributes and runs the contest in isolation, so the only variable is the knob.
//
// It replicates the EXACT shipped breaksTackle() formula and current knob values
// (the build _32 upload lacks them, so they're inlined here — keep in sync with
// constants.js if the knobs change).
//
// Run: node broken_tackle_check.mjs
// ─────────────────────────────────────────────────────────────────────────

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// ── SHIPPED KNOB VALUES (mirror of constants.js — update if those change) ──
const K = {
  BROKEN_TKL_SCALE: 0.016,
  BROKEN_TKL_BASE: 0.03,
  BROKEN_TKL_CAP: 0.40,
  BROKEN_TKL_WEIGHT_SCALE: 0.0015,
};

// ── EXACT replica of sim.js breaksTackle() ────────────────────────────────
function breakChance(carrierELU, defenderTKL, carrierWeight) {
  const eluGap = carrierELU - defenderTKL;
  const weightOver = Math.max(0, (carrierWeight ?? 210) - 210);
  return clamp(
    K.BROKEN_TKL_BASE
      + eluGap * K.BROKEN_TKL_SCALE
      + weightOver * K.BROKEN_TKL_WEIGHT_SCALE,
    0, K.BROKEN_TKL_CAP
  );
}

// Monte-Carlo the actual draw to confirm the analytic chance matches sampled rate
function sampledRate(carrierELU, defenderTKL, carrierWeight, n = 100000) {
  const p = breakChance(carrierELU, defenderTKL, carrierWeight);
  let hits = 0;
  for (let i = 0; i < n; i++) if (Math.random() < p) hits++;
  return { analytic: p, sampled: hits / n };
}

console.log(`BROKEN_TKL knobs: scale ${K.BROKEN_TKL_SCALE}, base ${K.BROKEN_TKL_BASE}, cap ${K.BROKEN_TKL_CAP}, weightScale ${K.BROKEN_TKL_WEIGHT_SCALE}\n`);

// ── 1. BREAK RATE BY ELU-TKL GAP (the core calibration table) ─────────────
// Defender TKL fixed at the real pool average (~80, measured from roster gen).
// Carrier weight fixed at 205 (typical Scat — no weight bonus) to isolate the
// ELU gap. Sweep carrier ELU across the realistic range.
const DEF_TKL = 80;        // measured LB/DB pool average
const SCAT_WT = 205;       // light back, weightOver = 0
console.log(`── Break rate by carrier ELU (defender TKL=${DEF_TKL}, carrier wt=${SCAT_WT}, light) ──`);
console.log('  carrier ELU   gap    break%   (this is P(break) per contest reached)');
for (const elu of [70, 75, 80, 85, 88, 90, 95, 99]) {
  const { analytic } = sampledRate(elu, DEF_TKL, SCAT_WT, 1); // analytic only, fast
  const gap = elu - DEF_TKL;
  const clip = analytic >= K.BROKEN_TKL_CAP ? ' [CAP]' : '';
  console.log(`  ${String(elu).padStart(3)}          ${(gap>=0?'+':'')+gap}     ${(100*analytic).toFixed(1).padStart(5)}%${clip}`);
}

// ── 2. CONVERT BREAK% → EXPECTED BROKEN TACKLES / GAME ────────────────────
// Translates a per-contest break rate into a season-leaderboard number, so we
// can target 3-5/g directly. Needs the contest-reach fraction: the share of a
// back's carries that reach a gain branch where the contest fires (TFL/stuffed
// runs are excluded). We don't know this exactly, so we show the brk/g for a
// RANGE of contest-reach assumptions — this brackets the real number HONESTLY
// rather than pretending one fitted value.
console.log('\n── Expected broken tackles/game for an ELITE Scat back (ELU 90, 23 car/g) ──');
console.log('  (brk/g = carries × contestReach × break%, for a range of contestReach)');
const eliteBreak = breakChance(90, DEF_TKL, SCAT_WT);
console.log(`  elite break% per contest: ${(100*eliteBreak).toFixed(1)}%`);
console.log('  contestReach   brk/g    /season(12g)   in 3-5 band?');
for (const cr of [0.55, 0.65, 0.75, 0.85]) {
  const bpg = 23 * cr * eliteBreak;
  const band = (bpg >= 3 && bpg <= 5) ? '✓' : (bpg < 3 ? 'low' : 'high');
  console.log(`  ${cr.toFixed(2)}          ${bpg.toFixed(1).padStart(4)}     ${(bpg*12).toFixed(0).padStart(4)}           ${band}`);
}

// ── 3. SCALE SWEEP AT FIXED ATTRIBUTES (what we SHOULD have done first) ────
// Holds the elite back fixed (ELU 90 vs TKL 80, gap +10) and sweeps the scale,
// showing break% and brk/g at a mid contest-reach of 0.70. This is the clean
// calibration curve — no roster variance.
console.log('\n── Scale sweep, FIXED elite back (ELU 90 vs TKL 80, gap +10, 23 car/g, reach 0.70) ──');
console.log('  scale    break%   brk/g   /season   band?');
for (const sc of [0.013, 0.016, 0.020, 0.024, 0.028, 0.032]) {
  const p = clamp(K.BROKEN_TKL_BASE + 10 * sc + 0, 0, K.BROKEN_TKL_CAP);
  const bpg = 23 * 0.70 * p;
  const band = (bpg >= 3 && bpg <= 5) ? '✓ IN' : (bpg < 3 ? 'low' : 'high');
  const clip = p >= K.BROKEN_TKL_CAP ? ' [CAP]' : '';
  console.log(`  ${sc.toFixed(3)}   ${(100*p).toFixed(1).padStart(5)}%${clip}   ${bpg.toFixed(1).padStart(4)}   ${(bpg*12).toFixed(0).padStart(4)}    ${band}`);
}

// ── 4. WEIGHT EFFECT (confirm heavier back breaks more at equal ELU) ──────
console.log('\n── Weight effect (carrier ELU 85 vs TKL 80, gap +5; vary weight) ──');
console.log('  weight   weightOver   break%');
for (const wt of [195, 210, 225, 245]) {
  const p = breakChance(85, DEF_TKL, wt);
  console.log(`  ${String(wt).padStart(3)}      ${String(Math.max(0,wt-210)).padStart(3)}          ${(100*p).toFixed(1).padStart(5)}%`);
}

console.log('\n— This is the calibration the scale should be set against: a FIXED elite back at');
console.log('  a known ELU gap. Pick the scale where the elite back lands 3-5/g, then confirm');
console.log('  ONCE on season_probe (accepting that the season leader\'s exact ELU varies).');
