// _seed.mjs — THE one way a probe pins Math.random.
//
// Why this file exists (2026-08-21). The seeding idiom the probes had been
// copying from tipdrill_probe was:
//
//     let _s = 20260810;
//     Math.random = () => { _s = (_s * 1103515245 + 12345) & 0x7fffffff; return _s / 0x7fffffff; };
//
// That is a textbook LCG written in a language that cannot hold it. `_s` runs to
// 2^31, and 2^31 × 1103515245 ≈ 2.4e18 — far past Number.MAX_SAFE_INTEGER (9e15),
// so the multiply silently rounds away its low bits, and `& 0x7fffffff` then
// keeps exactly the bits that were rounded away. The result is not an LCG at all.
//
// Measured: the state falls into a cycle of length **10,466 for every seed
// tried** (20260810, 20260821, 7, 991 — all 10466, entering after 170–4004
// steps). A 120-game probe arm draws millions of values, so it replays that same
// ten-thousand-value loop hundreds of times. Two consequences, both bad:
//   * the arm measures whichever short loop its seed landed in, not the code —
//     time_to_throw's sack-neutrality check reads 2.09 vs 1.98 on one seed and
//     3.36 vs 0.99 on another, a swing no 240-game sample could produce;
//   * "deterministic by construction" was true and meaningless: reproducible,
//     but reproducing the wrong thing.
//
// mulberry32 below uses Math.imul, so every operation stays inside 32 bits and
// nothing is rounded. No state repeat within 5,000,000 draws at any seed tried.
//
// Usage:
//     import { pinRandom } from './_seed.mjs';
//     const reseed = pinRandom();          // pins Math.random, returns a reset
//     ...
//     reseed();                            // start this arm from the same stream
//
// Re-seeding before each arm is deliberate: it makes an A/B a MATCHED-RNG
// comparison, so the only difference between two arms is the code path. Sweep
// BP_SEED=<n> to confirm a bar is not sitting on a knife edge.

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SEED = Number(process.env.BP_SEED || 20260821);

/**
 * Replace Math.random with a pinned mulberry32 stream.
 * @param {number} [seed]  defaults to BP_SEED, else 20260821
 * @returns {() => void}   call to restart the stream from the seed
 */
export function pinRandom(seed = SEED) {
  const reseed = () => { Math.random = mulberry32(seed); };
  reseed();
  return reseed;
}

/**
 * The BROWSER twin of pinRandom, for the Playwright probes.
 *
 * Why it is separate: qb_live_probe and watch_live_probe do not compute
 * anything in this process — they boot the built game in a real browser and
 * watch a play happen. The dice that decide what happens live INSIDE THE PAGE,
 * so overriding Math.random out here reaches nothing, and those two kept
 * flapping through the 2026-08-21 seeding pass (watch_live measured 1 failure
 * in 4 runs on byte-identical code).
 *
 * addInitScript runs before ANY page script on every navigation, so the app's
 * bundle sees a pinned Math.random from its very first call — including module
 * top-level work that happens before the probe can touch anything.
 *
 * HONEST LIMIT: this pins the GAME's randomness, not the clock. These probes
 * still observe a live animation loop on wall-clock time, so frame-level timing
 * can vary between runs. Expect "the same game, watched at slightly different
 * moments" — far tighter than before, but do not promise byte-determinism.
 *
 * @param {import('playwright').Page} page
 * @param {number} [seed]
 */
export function pinPageRandom(page, seed = SEED) {
  return page.addInitScript((s) => {
    let a = s | 0;
    Math.random = function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, seed);
}
