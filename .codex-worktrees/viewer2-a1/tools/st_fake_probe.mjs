// st_fake_probe.mjs — PASS 6 §B: real fake punt / fake FG paths.
//
// Anchors: real fake punts convert ~55-60% (they're only called when the look
// is right); fakes are rare events (a handful a season, not a weekly staple);
// a punt-safe defense is set for it, a block-mode rush vacates lanes.
//
// Two layers:
//   DIRECT — resolveFakePunt/resolveFakeFG hammered off-game (N=20k) for the
//   pricing gates (posture, distance, seen-dock, disaster wiring). This is the
//   noise-free mechanism check (probe-craft rule: don't gate a rare event's
//   pricing on whole-game counts).
//   GAMES — full simulateGame wiring: the dial tiers actually fire at sane
//   rates, conversions land in band, __noSTFakes restores the legacy
//   flip-to-go branch (stFake-flagged normal snaps, zero fake-type plays).
//
// Run: node tools/st_fake_probe.mjs [games]
import { simulateGame, resolveFakePunt, resolveFakeFG } from '../js/engine/sim.js';
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

const GAMES = Number(process.argv[2] || 50);
let pass = true;
const check = (ok, label) => { console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}`); if (!ok) pass = false; };

function roster(sid) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) for (let i = 0; i < count; i++) {
    const p = createPlayer(pos, CLASS_YEARS[i % 4], 1); p.schoolId = sid; r.push(p);
  }
  return r;
}

console.log('=== FAKE PUNT / FAKE FG (Pass 6 §B) ===\n-- direct resolver pricing (N=20000/cell) --');
{
  const rr = roster('X'), dd = buildDepthChart(rr, {});
  const dR = roster('Y');
  const N = 20000;
  const rate = (fn) => { let c = 0, n = 0; for (let i = 0; i < N; i++) { const r = fn(); n++; if (r.converted) c++; } return 100 * c / n; };
  const balanced2 = rate(() => resolveFakePunt(rr, dd, dR, { puntDef: 'balanced' }, 2, 0));
  const block2 = rate(() => resolveFakePunt(rr, dd, dR, { puntDef: 'block' }, 2, 0));
  const safe2 = rate(() => resolveFakePunt(rr, dd, dR, { puntDef: 'safe' }, 2, 0));
  const bal1 = rate(() => resolveFakePunt(rr, dd, dR, { puntDef: 'balanced' }, 1, 0));
  const bal5 = rate(() => resolveFakePunt(rr, dd, dR, { puntDef: 'balanced' }, 5, 0));
  const seen2 = rate(() => resolveFakePunt(rr, dd, dR, { puntDef: 'balanced' }, 2, 2));
  const fg2 = rate(() => resolveFakeFG(rr, dd, dR, 2, 8, 0));
  check(balanced2 >= 40 && balanced2 <= 75, `fake punt 4th-and-2 converts in band: ${balanced2.toFixed(1)}% (want 40-75, anchor ~55-60)`);
  check(block2 > safe2 + 8, `block-mode rush concedes more than punt-safe: ${block2.toFixed(1)}% > ${safe2.toFixed(1)}% + 8`);
  check(bal1 > bal5 + 8, `distance monotone: 4th-and-1 ${bal1.toFixed(1)}% > 4th-and-5 ${bal5.toFixed(1)}% + 8`);
  check(balanced2 > seen2 + 3, `seen-dock surprises decay: fresh ${balanced2.toFixed(1)}% > twice-shown ${seen2.toFixed(1)}% + 3`);
  check(fg2 >= 30 && fg2 <= 70 && fg2 < balanced2 + 10, `fake FG tighter than the punt fake: ${fg2.toFixed(1)}% (want 30-70)`);
  let ints = 0, runInts = 0, M = 20000;
  for (let i = 0; i < M; i++) { const r = resolveFakePunt(rr, dd, dR, { puntDef: 'balanced' }, 3, 0); if (r.int) { ints++; if (r.style === 'run') runInts++; } }
  check(ints > 0 && runInts === 0, `pass-fake INT wired, never on the upback run (${ints} INTs, ${runInts} on runs)`);
}

console.log(`\n-- full-game wiring (${GAMES} games/cell) --`);
function run(games, stFakes) {
  const c = { fakes: 0, conv: 0, legacyFlips: 0, snaps: 0, tds: 0, fgFakes: 0, maxPerGame: 0 };
  for (let g = 0; g < games; g++) {
    const rH = roster('H'), rA = roster('A');
    // Conservative 4th-down brains punt short yardage more → more eligible
    // fake windows (amplified-eligibility, not amplified pricing).
    const gp = (x = {}) => ({ offFormation: 'Single Back', offFormations: [{ id: 'Single Back', weight: 100 }], tendency: 'Heavy Run', rushInPct: 60, passDepth: { short: 40, medium: 40, deep: 20 }, blitzPct: 20, defFormation: 'Balanced D', fourthDown: 'Conservative', maxFGDist: 42, rpoRate: 0, gadgetRate: 0, stFakes, ...x });
    const res = simulateGame({ id: 'H', name: 'H' }, { id: 'A', name: 'A' }, rH, rA, buildDepthChart(rH, gp()), buildDepthChart(rA, gp()), gp(), gp());
    let inGame = 0;
    for (const d of res.drives || []) for (const pl of d.plays || []) {
      c.snaps++;
      if (pl.type === 'fakePunt' || pl.type === 'fakeFG') {
        c.fakes++; inGame++;
        if (pl.converted) c.conv++;
        if (pl.td) c.tds++;
        if (pl.type === 'fakeFG') c.fgFakes++;
      }
      if (pl.stFake) c.legacyFlips++;
    }
    c.maxPerGame = Math.max(c.maxPerGame, inGame);
  }
  return c;
}
const aggr = run(GAMES, 'aggressive');
const occ = run(GAMES, 'occasional');
const never = run(Math.max(10, GAMES >> 1), 'never');
const aRate = aggr.fakes / GAMES, oRate = occ.fakes / GAMES;
check(aRate >= 0.1 && aRate <= 1.5, `aggressive fires at fake-rare rate: ${aRate.toFixed(2)}/game (${aggr.fakes} fakes, want 0.1-1.5)`);
check(occ.fakes < aggr.fakes * 0.75, `occasional < aggressive (${oRate.toFixed(2)}/game vs ${aRate.toFixed(2)})`);
check(never.fakes === 0, `never = 0 fakes (${never.fakes})`);
const convPct = 100 * aggr.conv / (aggr.fakes || 1);
check(aggr.fakes < 5 || convPct >= 30 && convPct <= 80, `in-game conversion sane: ${convPct.toFixed(0)}% of ${aggr.fakes}`);
check(aggr.maxPerGame <= 4, `seen-dock keeps any single game sane: max ${aggr.maxPerGame}/game`);

globalThis.__noSTFakes = true;
const killed = run(GAMES, 'aggressive');
delete globalThis.__noSTFakes;
check(killed.fakes === 0 && killed.legacyFlips > 0, `__noSTFakes: 0 fake-type plays, legacy flip-to-go lives (${killed.legacyFlips} stFake snaps)`);

console.log(pass ? '\nALL PASS ✅ — the fake is a real play now' : '\n⚠ FAIL');
process.exit(pass ? 0 : 1);
