// _m2_pkg_ab.mjs — M2 proof (ii): the pkg change is a DELIBERATE behavior
// change, measured with before/after distributions (not a byte proof).
// Not gate-registered — a measurement harness. Run: node tools/_m2_pkg_ab.mjs [N]
//
// BEFORE = __noVarPkg (the old base-personnel fielding)   AFTER = M2 pkg truth
//   A. personnel fielded per look (every pkg look, engine-level)
//   B. Air Raid Empty snaps in live drives: back touches + yards, both arms

const _ls = new Map();
global.localStorage = {
  getItem: (k) => (_ls.has(k) ? _ls.get(k) : null),
  setItem: (k, v) => _ls.set(k, String(v)),
  removeItem: (k) => _ls.delete(k),
};

const N = Math.max(40, parseInt(process.argv[2] || '160', 10));

const { ROSTER_TARGETS, CLASS_YEARS, FORMATION_PACKAGES, FORMATION_VARIATIONS } = await import('../js/constants.js');
const { createPlayer } = await import('../js/engine/player.js');
const { buildDepthChart } = await import('../js/engine/world.js');
const { simulateDrive } = await import('../js/engine/sim.js');
const { resolveOffField } = await import('../js/engine/fieldassign.js');

function genRoster(sid) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], 1);
      p.schoolId = sid;
      r.push(p);
    }
  }
  return r;
}
const offR = genRoster('O'), defR = genRoster('D');
const posOf = (id) => { const p = offR.find((x) => x.id === id); return p ? p.position : null; };
const byId = (id) => offR.find((x) => x.id === id) || null;
const gpFor = (formation, entries) => ({
  offFormation: formation,
  offFormations: entries || [{ id: formation, weight: 100 }],
  tendency: 'Balanced', rushInPct: 55,
  passDepth: { short: 40, medium: 40, deep: 20 },
  blitzPct: 20, defFormation: 'Balanced D', defFront: '4-3',
  fourthDown: 'Moderate', maxFGDist: 42,
});

// ── A. personnel fielded per look, before vs after ─────────────────────────
console.log('A — PERSONNEL FIELDED PER LOOK (backs/TE/WR), before → after (pkg in brackets)');
for (const [fid, vset] of Object.entries(FORMATION_VARIATIONS)) {
  const depth = buildDepthChart(offR, gpFor(fid));
  for (const [vk, vd] of Object.entries(vset)) {
    if (!vd.pkg) continue;
    globalThis.__noVarPkg = true;
    const b = resolveOffField(fid, null, null, depth, null, posOf, byId, vk).personnel;
    globalThis.__noVarPkg = false;
    const a = resolveOffField(fid, null, null, depth, null, posOf, byId, vk).personnel;
    const c = (p) => `${(p.RB || []).length + (p.FB || []).length}B/${(p.TE || []).length}TE/${(p.WR || []).length}WR`;
    const pkg = { ...FORMATION_PACKAGES[fid], ...vd.pkg };
    const want = `${(pkg.RB || 0) + (pkg.FB || 0)}B/${pkg.TE || 0}TE/${pkg.WR || 0}WR`;
    const moved = c(b) !== c(a);
    console.log(`  ${(fid + ' · ' + vk).padEnd(24)} ${c(b).padEnd(12)} → ${c(a).padEnd(12)} [pkg ${want}]${moved ? '' : '   (unchanged)'}`);
  }
}

// ── B. live drives from the Air Raid starter shape, both arms ──────────────
function runArm(noVarPkg) {
  globalThis.__noVarPkg = noVarPkg || false;
  const gp = gpFor('Air Raid', [
    { id: 'Air Raid', weight: 55 },
    { id: 'Air Raid', weight: 45, variation: 'empty' },
  ]);
  const dgp = gpFor('Single Back');
  const off = { roster: offR, depth: buildDepthChart(offR, gp), gameplan: gp, school: { id: 'O', name: 'Off U' }, isHome: true, ctx: { fatigueMap: {}, snapCountMap: {}, benchedMap: {}, offSnaps: 0, defSnaps: 0, jobSnapMap: {} }, form: 1 };
  const def = { roster: defR, depth: buildDepthChart(defR, dgp), gameplan: dgp, school: { id: 'D', name: 'Def U' }, isHome: false, ctx: { fatigueMap: {}, snapCountMap: {}, benchedMap: {}, offSnaps: 0, defSnaps: 0, jobSnapMap: {} }, form: 1 };
  // records only ride the resume rig (unforced drives discard them) — a
  // 'sheet' call per drive keeps the AI picking from the plan's own looks
  const log = [];
  for (let d = 0; d < N; d++) {
    simulateDrive(off, def, { fieldPos: 20 + (d % 4) * 15, clock: 1800 - (d % 12) * 120, half: (d % 2) + 1, score: { off: 0, def: 0 } }, [], {
      askCall: () => 'ASK',
      resume: { call: { concept: 'sheet' }, fieldPos: 20 + (d % 4) * 15, down: 1, distance: 10, plays: log, audiblesUsed: 0, fourthDecided: false, decision: null, pen: { offCount: 0, offYds: 0, defCount: 0, defYds: 0 } },
    });
  }
  globalThis.__noVarPkg = false;
  const backIds = new Set(offR.filter((p) => p.position === 'RB' || p.position === 'FB').map((p) => p.id));
  const stat = { snaps: 0, backTouches: 0, yards: 0, runs: 0 };
  const base = { snaps: 0, backTouches: 0, yards: 0, runs: 0 };
  for (const p of log) {
    if (!p || !p.concept) continue;
    const s = p.variation === 'empty' ? stat : p.variation == null ? base : null;
    if (!s) continue;
    s.snaps++;
    if (typeof p.yards === 'number') s.yards += p.yards;
    if (p.type && p.type.startsWith('run')) s.runs++;
    if ((p.rusherId && backIds.has(p.rusherId)) || (p.targetId && backIds.has(p.targetId))) s.backTouches++;
  }
  return { stat, base };
}
console.log(`\nB — AIR RAID: base look vs the Empty look in live drives (${N} drives/arm, unseeded)`);
const before = runArm(true);
const after = runArm(false);
const line = (nm, r) => `  ${nm.padEnd(26)} snaps ${String(r.snaps).padStart(4)} · back touches ${String(r.backTouches).padStart(4)} (${r.snaps ? (100 * r.backTouches / r.snaps).toFixed(1) : '0.0'}%) · yds/snap ${(r.snaps ? r.yards / r.snaps : 0).toFixed(2)} · run share ${(r.snaps ? 100 * r.runs / r.snaps : 0).toFixed(1)}%`;
console.log('  BEFORE (__noVarPkg — old fielding):');
console.log(line('empty look', before.stat));
console.log(line('base look', before.base));
console.log('  AFTER (pkg truth):');
console.log(line('empty look', after.stat));
console.log(line('base look', after.base));
console.log('\ndone — the Empty look should show back touches → 0 and the base look ~unchanged');
