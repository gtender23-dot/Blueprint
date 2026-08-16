function blendValue(blend, player) {
  var _a, _b;
  let v = 0;
  for (const [attr, w] of Object.entries(blend)) {
    v += ((_b = (_a = player == null ? void 0 : player.attributes) == null ? void 0 : _a[attr]) != null ? _b : 50) * w;
  }
  return v;
}
function contestGap(contestId, offPlayer, defPlayer) {
  const row = CONTESTS[contestId];
  if (!row) return 0;
  return blendValue(row.off, offPlayer) - blendValue(row.def, defPlayer);
}
var CONTESTS;

CONTESTS = {
  // Tackle chain — the carrier's two ways out (Round-2 table, audit Part 4).
  tackleEvade: {
    phase: "aftermath",
    off: { AGI: 0.55, SPD: 0.27, TEC: 0.18 },
    // the juke is craft
    def: { AGI: 0.34, SPD: 0.26, AWR: 0.22, TEC: 0.18 },
    // get-there: mirror the juke (Phase 2a-ii: TKL out)
    pbp: { win: "jukes {def} out of his cleats", lose: null }
  },
  tackleTruck: {
    phase: "aftermath",
    off: { PWR: 0.55, STR: 0.27, TEC: 0.18 },
    // pad level wins collisions
    def: { STR: 0.34, PWR: 0.28, TEC: 0.2, AWR: 0.18 },
    // finish: anchor+pop — DBs bounce off here (Phase 2a-ii)
    pbp: { win: "runs right through {def}", lose: null }
  },
  // Fall forward — contact yards, signed: a thumper stones you backward,
  // a hammer carrier falls ahead. Centered at zero for equal blends.
  fallForward: {
    phase: "aftermath",
    off: { PWR: 0.85, TEC: 0.15 },
    def: { STR: 0.6, PWR: 0.25, TEC: 0.15 }
  }
};

export { contestGap };

// additional exports consumed by tools/ probes
export { CONTESTS };
