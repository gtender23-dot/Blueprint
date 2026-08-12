// prestige_trajectory_probe.mjs — PLAYTEST 2026-08-12 item 18: WINNING MUST
// MOVE A PROGRAM, AND PRESTIGE MUST MEAN SOMETHING IN YEAR ONE.
//
// Owner: "Prestige needs more fluidity and a stronger influence on team gen in
// year 1. Shouldn't have a 1 star 11-1 team going into year 2."
//
// Both halves are measured here because they are the same complaint from two
// directions: a 1-star program that wins 11 games should (a) not have been that
// bad to begin with, and (b) not still be a 1-star next August.
//
//   node tools/prestige_trajectory_probe.mjs
//
import { updatePrestige } from '../js/engine/season.js';
import { createPlayer } from '../js/engine/player.js';
import { C, ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};

const GAMES = C.CONF_GAMES + C.NONCONF_GAMES;

// A bare school is all updatePrestige touches: prestige, baseline, recentWins.
const mkSchool = (prestige, division = 'D1') => ({
  id: 's', name: 'S', division, prestige, baseline: prestige, recentWins: [],
});
// Play a season: push a win total onto the front of the 3-season window.
const season = (s, wins) => {
  s.recentWins = [wins, ...(s.recentWins || [])].slice(0, C.PRESTIGE_WINDOW_WEIGHTS.length);
  updatePrestige({ world: { schools: [s] } });
  return s.prestige;
};

// ── 1. THE OWNER'S CASE, EXACTLY ─────────────────────────────────────────────
{
  const s = mkSchool(1);
  const after = season(s, 11);
  console.log(`\n  a 1-star program goes ${11}-${GAMES - 11} → prestige ${after.toFixed(3)}\n`);
  check('one big year moves a program off its floor', after - 1 >= 0.25,
    `+${(after - 1).toFixed(3)} after a single 11-win season`);
}

// ── 2. SUSTAINED WINNING EARNS A STAR ────────────────────────────────────────
{
  const s = mkSchool(1);
  const path = [];
  for (let y = 0; y < 3; y++) path.push(season(s, 11).toFixed(2));
  // Assert on the DISPLAYED star, because that is what the coach sees and what
  // the report was about — renderPrestige rounds, so 1.87 is a two-star program.
  check('a 1-star that wins 11 three years running is DISPLAYED as a 2-star', Math.round(s.prestige) >= 2,
    `1.00 → ${path.join(' → ')} (displays ${Math.round(s.prestige)}★)`);

  const s2 = mkSchool(2);
  const path2 = [];
  for (let y = 0; y < 5; y++) path2.push(season(s2, 12).toFixed(2));
  check('an undefeated dynasty climbs fast', s2.prestige >= 3.5,
    `2.00 → ${path2.join(' → ')}`);
}

// ── 3. LOSING COSTS YOU ──────────────────────────────────────────────────────
{
  const s = mkSchool(5);
  const path = [];
  for (let y = 0; y < 3; y++) path.push(season(s, 2).toFixed(2));
  check('a collapsing blue-blood actually falls', s.prestige <= 4.4,
    `5.00 → ${path.join(' → ')}`);
}

// ── 4. .500 IS STABLE ────────────────────────────────────────────────────────
// The rule must not drift a program that is exactly meeting expectations.
{
  const s = mkSchool(3);
  const start = s.prestige;
  for (let y = 0; y < 6; y++) season(s, GAMES / 2);
  check('a .500 program holds its ground', Math.abs(s.prestige - start) <= 0.15,
    `${start.toFixed(2)} → ${s.prestige.toFixed(2)} over 6 even seasons`);
}

// ── 5. THE DIVISION CEILING HOLDS ────────────────────────────────────────────
{
  const s = mkSchool(3, 'D3');
  for (let y = 0; y < 12; y++) season(s, GAMES);
  const cap = C.PRESTIGE_MAX.D3;
  check('a D3 juggernaut cannot exceed its division cap', s.prestige <= cap + 1e-9,
    `${s.prestige.toFixed(2)} against a D3 cap of ${cap}`);
}

// ── 5b. THE LEAGUE MUST NOT INFLATE ──────────────────────────────────────────
// Making the rule ~3x more responsive is only safe if it stays zero-sum in
// aggregate: somebody's 11-1 is somebody else's 1-11. Run a closed league for 30
// seasons where every week has a winner and a loser, and check the mean does not
// drift and nobody's prestige runs away.
{
  const TEAMS = 12;
  const league = Array.from({ length: TEAMS }, (_, i) => mkSchool(1 + (i % 6)));
  const startMean = league.reduce((a, s) => a + s.prestige, 0) / TEAMS;
  // Deterministic round-robin-ish spread: win totals are a permutation summing
  // to exactly half the league's games, rotated each year so no team is favoured.
  const spread = Array.from({ length: TEAMS }, (_, i) => Math.round(GAMES * i / (TEAMS - 1)));
  for (let y = 0; y < 30; y++) {
    for (let i = 0; i < TEAMS; i++) {
      league[i].recentWins = [spread[(i + y) % TEAMS], ...(league[i].recentWins || [])]
        .slice(0, C.PRESTIGE_WINDOW_WEIGHTS.length);
    }
    updatePrestige({ world: { schools: league } });
  }
  const endMean = league.reduce((a, s) => a + s.prestige, 0) / TEAMS;
  const hi = Math.max(...league.map((s) => s.prestige));
  const lo = Math.min(...league.map((s) => s.prestige));
  check('30 seasons of zero-sum football does not inflate the league',
    Math.abs(endMean - startMean) <= 0.4,
    `mean ${startMean.toFixed(2)} → ${endMean.toFixed(2)}`);
  check('and nobody runs away or collapses to nothing', hi <= 6.01 && lo >= 0.99,
    `range ${lo.toFixed(2)} – ${hi.toFixed(2)}`);
}

// ── 6. YEAR-ONE TALENT COUPLING ──────────────────────────────────────────────
// The other half of the report. Within ONE division, a top-prestige program must
// out-draft a bottom-prestige one by enough to show up on the field.
{
  const N = 900;
  const meanFor = (prestige, tier) => {
    const bonus = (prestige - 3) * 2; // the same scalar generateRoster passes
    let sum = 0, n = 0;
    for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
      for (let i = 0; i < Math.max(1, Math.round(count * N / 85)); i++) {
        sum += createPlayer(pos, CLASS_YEARS[i % 4], tier, bonus).compositeRating;
        n++;
      }
    }
    return sum / n;
  };
  // D3 spans prestige 1-3, D1 power spans 4-6.
  const d3Low = meanFor(1, 1), d3High = meanFor(3, 1);
  const d1Low = meanFor(4, 3), d1High = meanFor(6, 3);
  console.log(`\n  D3  1-star ${d3Low.toFixed(1)} vs 3-star ${d3High.toFixed(1)}   (gap ${(d3High - d3Low).toFixed(1)})`);
  console.log(`  D1  4-star ${d1Low.toFixed(1)} vs 6-star ${d1High.toFixed(1)}   (gap ${(d1High - d1Low).toFixed(1)})\n`);
  // ── REPORTED, NOT GATED — this is the OPEN half of item 18 ────────────────
  // The owner asked for two things: more fluidity (fixed above) and "a stronger
  // influence on team gen in year 1". The whole prestige signal into roster
  // generation is one scalar, `prestigeBonus = (prestige - 3) * 2`, which spans
  // just 4 points of attribute base across a division's entire prestige range —
  // under half a per-attribute standard deviation. That is why a 1-star CAN go
  // 11-1 in the first place.
  //
  // It is not gated because widening it is a worldgen change that moves every
  // stat band and needs its own matched A/B (see Ref/PLAYTEST_2026-08-12.md).
  // Gating a number nobody has agreed to move would just be a red light that
  // gets ignored, which is worse than an honest measurement.
  const flag = (g) => (g >= 6 ? 'ok' : g >= 4 ? 'thin' : 'WEAK');
  console.log(`  OPEN (item 18, second half) — prestige→talent coupling:`);
  console.log(`    D3 range spans ${(d3High - d3Low).toFixed(1)} OVR [${flag(d3High - d3Low)}]`);
  console.log(`    D1 range spans ${(d1High - d1Low).toFixed(1)} OVR [${flag(d1High - d1Low)}]`);
  console.log(`    (a division's whole prestige range should be worth more than a`);
  console.log(`     single attribute's standard deviation — it is not yet)`);
  // What IS gated: the direction must at least be right, and prestige must not
  // be actively inverted or inert.
  check('more prestige means more talent, in every division', d3High > d3Low && d1High > d1Low,
    `D3 +${(d3High - d3Low).toFixed(1)} · D1 +${(d1High - d1Low).toFixed(1)}`);
}

console.log(`\n${fail === 0 ? 'ALL PASS ✅' : `${fail} FAILURES ❌`}  (${pass} pass, ${fail} fail)`);
process.exit(fail === 0 ? 0 : 1);
