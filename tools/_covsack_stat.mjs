// _covsack_stat.mjs — temp helper: run stat_realism with Fix B (coverage sack /
// throwaway) gated on or off, to measure band-neutrality. Delete after the pass.
//   COVSACK=off node tools/_covsack_stat.mjs 300
//   COVSACK=on  node tools/_covsack_stat.mjs 300
globalThis.__noCovSack = process.env.COVSACK === 'off';
if (process.env.ESC === 'off') { const { C } = await import('../js/constants.js'); C.COVSACK_SCRAMBLE_MULT = 0; }
await import('./stat_realism_harness.mjs');
