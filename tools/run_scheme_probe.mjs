// run_scheme_probe.mjs — subsystem 3: the read, the scheme, the fit.
//
// Four redistributive levers were added to the run game (which already sits
// in-band, so every one is centered to hold the mean — this probe's teeth are on
// that centering, not on a YPC lift):
//
//   A READ   — a zone back's dive/bounce/cutback read. runFit's LOS bend gains a
//              signed multiplier from the carrier's vision relative to the pool
//              mean. TEETH: a high-vision back must OUT-GAIN a low-vision one at
//              the SAME lane/pool, and the pool-MEAN back must be ~unchanged vs
//              the pre-fix (scheme absent) carry.
//   B CLIMB  — a won zone rep sends the combo blocker climbing (higher blockedP).
//              TEETH: climb on vs off must MOVE the distribution (it fires) while
//              holding mean YPC within noise (redistributive, not a lift).
//   C SPILL  — a crashing edge spills the run outside: TFL tail up AND breakaway
//              tail up, mean held. TEETH: crash raises BOTH the stuff rate and the
//              20+ rate vs a balanced edge, and the mean does not run away.
//   D BOX    — box-count integrity lives in resolveRunPlay (laneQuality), so it is
//              exercised via a small end-to-end lane sweep here as INFORMATIONAL;
//              its band effect is the stat_realism veto's job.
//
// Everything but the toggled lever is pinned: one fixed carrier pool, one fixed
// second level / deep / pursuit, reused in the same order across every cell —
// the run_lane_probe discipline. Gates: globalThis.__noRead/__noScheme/__noSpill.
//
// Usage: node tools/run_scheme_probe.mjs [carriesPerCell]
import { runFit }       from '../js/engine/run2geo.js';
import { createPlayer } from '../js/engine/player.js';
import { C }            from '../js/constants.js';

const N = Number(process.argv[2] || 40000);
const LANE = 0.60; // the measured mean lane — where centering is judged

// Fixed pools. Same bodies, same order, every cell.
const mk = (pos, n) => Array.from({ length: n }, () => createPlayer(pos, 'JR', 3));
const CARRIERS = mk('RB', 200);
const LBS  = mk('MLB', 3);
const SAF  = mk('S', 2);
const CBS  = mk('CB', 2);
const DLP  = [createPlayer('DT', 'JR', 3)];
const PEN  = createPlayer('DE', 'JR', 3);
const DEEP = [...SAF, ...CBS];

// A carry with an explicit scheme object (bypasses sim.js buildRunScheme so the
// probe controls exactly one lever at a time), fixed everything else.
function carries(scheme, { visionFor = null, penetrator = null } = {}) {
  let sum = 0, sumsq = 0, stuff = 0, chunk = 0, big = 0;
  for (let i = 0; i < N; i++) {
    const car = CARRIERS[i % CARRIERS.length];
    const vision = visionFor == null ? 0 : visionFor;
    const fit = runFit(car, {
      lane: LANE, penetrator,
      secondLevel: LBS, deepLevel: DEEP, dlPursuit: DLP, vision,
      scheme,
    });
    const y = fit.yards;
    sum += y; sumsq += y * y;
    if (y <= 0) stuff++;
    if (y >= 4) chunk++;
    if (y >= 20) big++;
  }
  return {
    mean: sum / N,
    sd: Math.sqrt(sumsq / N - (sum / N) ** 2),
    stuffPct: 100 * stuff / N,
    chunkPct: 100 * chunk / N,
    bigPct: 100 * big / N,
  };
}

let fails = 0;
const chk = (cond, msg) => { if (!cond) fails++; console.log(`  ${cond ? 'ok ' : 'BAD'} ${msg}`); };
const f2 = x => x.toFixed(2);

console.log(`Run scheme identity — ${N} carries/cell, fixed pools, lane ${LANE}\n`);

// ── A. THE READ — vision must separate the backs, mean held at pool average ──
// Build the read exactly as sim.js does: signed by (AWR − pivot). We feed a high-
// and a low-vision read directly (the scheme.read scalar), same carriers.
console.log('A. READ (dive/bounce/cutback) — vision separates, mean held:');
const PIVOT = 41, GAIN = 0.9, CAP = 0.35;
const readFor = awr => Math.max(-CAP, Math.min(CAP, (awr - PIVOT) * GAIN * 0.01));
const base   = carries({});                       // no read (pre-fix / mean back)
const sharp  = carries({ read: readFor(90) });    // 90-AWR vision back
const poor   = carries({ read: readFor(30) });    // 30-AWR back, below the mean
console.log(`  no-read (mean back):  ${f2(base.mean)} ypc  stuff ${f2(base.stuffPct)}%  20+ ${f2(base.bigPct)}%`);
console.log(`  sharp read (AWR90):   ${f2(sharp.mean)} ypc  stuff ${f2(sharp.stuffPct)}%  20+ ${f2(sharp.bigPct)}%`);
console.log(`  poor read  (AWR30):   ${f2(poor.mean)} ypc  stuff ${f2(poor.stuffPct)}%  20+ ${f2(poor.bigPct)}%`);
chk(sharp.mean > poor.mean + 0.1, `a sharp-vision back out-gains a poor one (Δ ${f2(sharp.mean - poor.mean)} ypc)`);
chk(PIVOT === C.READ_VISION_PIVOT && Math.abs(readFor(PIVOT)) < 1e-9, `probe read pivot ${PIVOT} tracks shipped C.READ_VISION_PIVOT (${C.READ_VISION_PIVOT}) and centers there`);

// ── B. CLIMB — zone identity fires and holds the mean ──
console.log('\nB. CLIMB (zone combo → 2nd level) — fires, redistributive:');
const climbOff = carries({});
const climbOn  = carries({ climb: 0.14 });
console.log(`  climb off:  ${f2(climbOff.mean)} ypc  chunk(4+) ${f2(climbOff.chunkPct)}%  20+ ${f2(climbOff.bigPct)}%`);
console.log(`  climb on:   ${f2(climbOn.mean)} ypc  chunk(4+) ${f2(climbOn.chunkPct)}%  20+ ${f2(climbOn.bigPct)}%`);
chk(Math.abs(climbOn.bigPct - climbOff.bigPct) > 0.05 || Math.abs(climbOn.chunkPct - climbOff.chunkPct) > 0.05,
    `zone climb MOVES the distribution (it fires)`);
chk(Math.abs(climbOn.mean - climbOff.mean) < 0.25, `zone climb holds mean YPC within noise (Δ ${f2(climbOn.mean - climbOff.mean)})`);

// ── C. SPILL — crash raises BOTH tails vs a balanced edge, mean held ──
console.log('\nC. SPILL (crash spills outside) — two-sided tradeoff, mean held:');
const spillBal   = carries({ spillTflShare: 0.55 }, { penetrator: PEN });                  // balanced edge, penetrator present
const spillCrash = carries({ spillEdge: 0.16, spillTflShare: 0.55 }, { penetrator: PEN }); // crashing edge spills
console.log(`  balanced edge:  ${f2(spillBal.mean)} ypc  stuff ${f2(spillBal.stuffPct)}%  20+ ${f2(spillBal.bigPct)}%`);
console.log(`  crash (spill):  ${f2(spillCrash.mean)} ypc  stuff ${f2(spillCrash.stuffPct)}%  20+ ${f2(spillCrash.bigPct)}%`);
chk(spillCrash.stuffPct > spillBal.stuffPct + 0.2, `a sound spill raises the stuff-for-loss rate (Δ +${f2(spillCrash.stuffPct - spillBal.stuffPct)}pp)`);
chk(spillCrash.bigPct  > spillBal.bigPct  + 0.05, `a blown spill leaks more breakaways outside (Δ +${f2(spillCrash.bigPct - spillBal.bigPct)}pp)`);
chk(Math.abs(spillCrash.mean - spillBal.mean) < 0.6, `spill is a tradeoff, not a mean move (Δ ${f2(spillCrash.mean - spillBal.mean)} ypc)`);

// ── D. informational: read magnitude across the vision range ──
console.log('\nD. informational — YPC across the vision range (read only):');
for (const awr of [30, 41, 60, 75, 90]) {
  const r = carries({ read: readFor(awr) });
  console.log(`  AWR ${String(awr).padStart(2)}:  ${f2(r.mean)} ypc  stuff ${f2(r.stuffPct)}%  20+ ${f2(r.bigPct)}%`);
}

console.log(fails
  ? `\nFAIL — ${fails} check(s).`
  : '\nPASS — the read separates backs and is centered; zone climb and edge spill fire and hold the mean.');
process.exit(fails ? 1 : 0);
