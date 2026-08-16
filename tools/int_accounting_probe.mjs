// int_accounting_probe.mjs — proves every interception is attributed under the
// canonical keys (turnoverType "interception" + intPickerId), so the per-player
// box score (QB passInt, DB ints) captures ALL picks — not just the ones thrown
// on the main catch-resolution path.
//
// The bug (fixed Aug 2026): the batted-tip INT (sim.js ~1313) and the deep-fade /
// back-shoulder INT (~1433) wrote `turnoverType = "INT"` + `intById`, which the
// per-player tally (passInt keys off "interception"; DB ints keys off intPickerId)
// never read. Team INT% was fine (accumDriveStats counts off play.turnover), but
// the QB's and DB's own stat lines silently dropped those picks.
//
// This probe scans every play and cross-checks the box score. It FAILS on the old
// code (deprecated "INT" string present; passInt/DB-ints totals short of the real
// interception count) and PASSES once every pick is canonical.
//
// Run: node tools/int_accounting_probe.mjs [games]
import { createPlayer, refreshRatings } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

const GAMES = Number(process.argv[2] || 400);
const TIER = 1;

function roster(schoolId) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], TIER);
      p.schoolId = schoolId;
      r.push(p);
    }
  }
  return r;
}

// Deep/medium-heavy so the fade INT path (a covered deep shot) gets real volume.
const gp = { offFormation:'Single Back', offFormations:[{id:'Single Back',weight:100}], tendency:'Balanced', rushInPct:32, passDepth:{short:20,medium:40,deep:40}, blitzPct:26, defFormation:'Balanced D', fourthDown:'Moderate', clockMgmt:'Normal', maxFGDist:42 };
const sH = { id:'H', name:'Home' }, sA = { id:'A', name:'Away' };

let intPlays = 0;         // plays that are an interception (any string)
let attributedPlays = 0;  // ...that carry the canonical string + a picker id
let deprecatedString = 0; // ...that still carry the old "INT" string
let noPicker = 0;         // ...interception with no intPickerId
let boxPassInt = 0;       // sum of per-player passInt (INTs thrown)
let boxDbInt = 0;         // sum of per-player ints (INTs caught)
let teamAccumInt = 0;     // sum of team-level ints (accumDriveStats, play.turnover)
let ezTouchbacks = 0;     // item 9b — picks flagged as an end-zone touchback
let ezTouchbackBadFP = 0; // ...that occurred at a field position a touchback can't come from

for (let i = 0; i < GAMES; i++) {
  const rH = roster('H'), rA = roster('A');
  const cH = buildDepthChart(rH, gp), cA = buildDepthChart(rA, gp);
  const res = simulateGame(sH, sA, rH, rA, cH, cA, gp, gp);

  for (const d of res.drives || []) for (const pl of d.plays || []) {
    const isInt = !!pl.turnover && (pl.turnoverType === 'interception' || pl.turnoverType === 'INT');
    if (!isInt) continue;
    intPlays++;
    if (pl.turnoverType === 'INT') deprecatedString++;
    if (pl.turnoverType === 'interception' && pl.intPickerId != null) attributedPlays++;
    if (pl.intPickerId == null) noPicker++;
    // item 9b — an end-zone pick becomes a touchback. It can only be flagged
    // where the flat 100 - fieldPos mirror was WORSE than the 20 (fieldPos >= 80),
    // so the fix never regresses the defense's spot — it only rescues the pick
    // that used to hand the defense its own 1-5.
    if (pl.intTouchback) {
      ezTouchbacks++;
      if (!(pl.fieldPos >= 80)) ezTouchbackBadFP++;
    }
  }

  for (const st of [res.homeStats, res.awayStats]) teamAccumInt += st.ints || 0;
  for (const psMap of [res.homePlayerStats, res.awayPlayerStats]) {
    for (const id in psMap) {
      boxPassInt += psMap[id].passInt || 0;
      boxDbInt += psMap[id].ints || 0;
    }
  }
}

console.log(`=== INT ACCOUNTING — ${GAMES} games ===`);
console.log(`  interception plays (scan)      : ${intPlays}`);
console.log(`  ...canonical (interception+id) : ${attributedPlays}`);
console.log(`  ...still using "INT" string    : ${deprecatedString}`);
console.log(`  ...missing intPickerId         : ${noPicker}`);
console.log(`  box-score QB passInt total     : ${boxPassInt}`);
console.log(`  box-score DB ints total        : ${boxDbInt}`);
console.log(`  team-accum ints total          : ${teamAccumInt}`);

// Teeth: every pick must be canonical, and both per-player ledgers must equal the
// real interception count. (A tiny slack absorbs the rare pick-two / shared-play
// edge but not a systematic drop.)
console.log(`  end-zone touchbacks (item 9b)  : ${ezTouchbacks}  (${intPlays?((100*ezTouchbacks/intPlays).toFixed(1)):'0'}% of picks)`);

const slack = Math.max(2, Math.round(intPlays * 0.01));
const p1 = deprecatedString === 0;
const p2 = noPicker === 0;
const p3 = Math.abs(boxPassInt - intPlays) <= slack;
const p4 = Math.abs(boxDbInt - intPlays) <= slack;
// item 9b — the end-zone touchback fires (a deep-heavy passing game throws into
// the end zone often enough that some are picked) and never fires from a spot it
// can't legally come from.
const p5 = ezTouchbacks > 0;
const p6 = ezTouchbackBadFP === 0;
const pass = p1 && p2 && p3 && p4 && p5 && p6;
console.log(`\n  [${p1?'PASS':'FAIL'}] no play uses the deprecated "INT" turnoverType`);
console.log(`  [${p2?'PASS':'FAIL'}] every interception carries an intPickerId`);
console.log(`  [${p3?'PASS':'FAIL'}] QB passInt total matches the interception count (${boxPassInt} vs ${intPlays})`);
console.log(`  [${p4?'PASS':'FAIL'}] DB ints total matches the interception count (${boxDbInt} vs ${intPlays})`);
console.log(`  [${p5?'PASS':'FAIL'}] the end-zone touchback path fires (${ezTouchbacks} picks)`);
console.log(`  [${p6?'PASS':'FAIL'}] no touchback comes from fieldPos < 80 (${ezTouchbackBadFP} bad)`);
console.log(pass ? '\nALL PASS ✅ — every pick lands in the box score, end-zone picks are touchbacks' : '\n⚠ FAIL');
process.exit(pass ? 0 : 1);
