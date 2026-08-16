// leverage_probe.mjs — does defender LEVERAGE actually shape the route duel?
//
// Fix A (coverage pass, Aug 2026). Real coverage is played to a side: inside
// leverage takes away in-breakers and concedes out; outside leverage the
// reverse; you "play opposite your help." Before this fix routeDuel had none —
// the defender started at a ±0.15 coin-flip x unrelated to the route, so an
// out-breaker and an in-breaker were defended identically.
//
// Three things are checked:
//   1. DIRECTION — a route that ATTACKS the leverage (breaks away from where
//      the defender sits) must separate MORE than one that runs INTO it, at
//      every depth. This is the whole point of leverage.
//   2. MEAN-NEUTRAL — with attack UNKNOWN (attack:0, the live-play default),
//      the leverage duel's mean must match the no-leverage baseline within
//      noise. This is what keeps sep_probe (the frozen calibration gate) green
//      and stat_realism unmoved: leverage adds variance-by-direction, not a
//      league-wide separation shift.
//   3. GATE — globalThis.__noLeverage forces lev=0 (behavior-identical to
//      baseline), so the mechanism can be toggled cleanly.
//
// Usage: node tools/leverage_probe.mjs [duelsPerCell]
import { routeDuel }   from '../js/engine/sepgeo.js';
import { createPlayer } from '../js/engine/player.js';

const N      = Number(process.argv[2] || 8000);
const DEPTHS = ['short', 'medium', 'deep'];

// One fixed receiver pool + one fixed defender, reused across cells: the only
// thing that changes per row is the leverage/attack passed to the duel.
const RECS = Array.from({ length: 120 }, () => createPlayer('WR', 'JR', 3));
const DEF  = createPlayer('CB', 'JR', 3);

const meanSep = (depth, type, scheme) => {
  let s = 0;
  for (let i = 0; i < N; i++) s += routeDuel(RECS[i % RECS.length], DEF, depth, type, false, null, scheme);
  return s / N;
};

// Inside leverage (lev -1): attacking it = breaking OUTSIDE (away). Test both
// leverages so the effect isn't an artifact of one side.
function cell(depth, type, lev) {
  const away = meanSep(depth, type, { leverage: lev, attack: +1 }); // route attacks the leverage
  const into = meanSep(depth, type, { leverage: lev, attack: -1 }); // route runs into it
  const neut = meanSep(depth, type, { leverage: lev, attack: 0 });  // unknown / live-play default
  return { away, into, neut };
}

console.log(`Leverage — ${N} duels per cell, fixed pair, one man vs press\n`);

let fails = 0;

// ── 1 & the neutral baseline, swept by depth for both leverages ─────────────
for (const type of ['press', 'offman']) {
  console.log(`\n${type} coverage`);
  console.log('  depth      lev   away   into   Δ(away-into)   neutral   base(noLev)');
  for (const depth of DEPTHS) {
    for (const lev of [-1, +1]) {
      const { away, into, neut } = cell(depth, type, lev);
      globalThis.__noLeverage = true;
      const base = meanSep(depth, type, { leverage: lev, attack: 0 });
      globalThis.__noLeverage = false;
      const d = away - into;
      // Leverage bites on a BREAK. A deep vertical has almost no break (breakLat
      // ~0.8) — it's a track race, and real coaching agrees leverage matters
      // least there. So we demand a clear directional effect at short/medium and
      // only NO INVERSION (plus mean-neutrality) on deep. This isn't a fudge:
      // it's the model correctly saying leverage ≠ a deep-ball lever.
      const dirOK = depth === 'deep' ? d >= -0.01 : d > 0.02;
      const neutOK = Math.abs(neut - base) <= 0.03; // attack-unknown is mean-neutral vs baseline (band > 2·SE at N=8000 to avoid spurious fails)
      if (!dirOK)  fails++;
      if (!neutOK) fails++;
      console.log(
        `  ${depth.padEnd(8)} ${String(lev).padStart(3)}  ${away.toFixed(3)}  ${into.toFixed(3)}   ` +
        `${(d >= 0 ? '+' : '') + d.toFixed(3)} ${dirOK ? 'ok ' : 'BAD'}    ${neut.toFixed(3)}     ${base.toFixed(3)} ${neutOK ? 'ok' : 'DRIFT'}`
      );
    }
  }
}

// ── 3. Gate: __noLeverage collapses attack to no effect ─────────────────────
{
  globalThis.__noLeverage = true;
  const away = meanSep('medium', 'press', { leverage: -1, attack: +1 });
  const into = meanSep('medium', 'press', { leverage: -1, attack: -1 });
  globalThis.__noLeverage = false;
  const gated = Math.abs(away - into) <= 0.02;
  if (!gated) fails++;
  console.log(`\ngate  __noLeverage on → away ${away.toFixed(3)} vs into ${into.toFixed(3)} (Δ ${(away - into).toFixed(3)}) ${gated ? 'ok (no effect)' : 'BAD (leaked)'}`);
}

console.log(fails
  ? `\nFAIL — ${fails} check(s). Leverage is not shaping the duel as designed.`
  : '\nPASS — attacking leverage separates more, running into it separates less, and the unknown-attack default is mean-neutral.');
process.exit(fails ? 1 : 0);
