// Stat-realism diagnostic harness.
// Simulates full sets of games, accumulates PER-PLAYER and PER-TEAM stats, and
// prints distributions next to real CFB reference points. Crucially, it segments
// QB INT% by QB skill (GI/TECH) to test whether elite QBs actually throw fewer picks.
import { createPlayer, refreshRatings } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

function genRoster(tier, schoolId, boost = 0) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], tier);
      if (boost) { for (const a in p.attributes) p.attributes[a] = Math.min(99, p.attributes[a] + boost); refreshRatings(p); }
      p.schoolId = schoolId;
      r.push(p);
    }
  }
  return r;
}

// Force a roster's starting QB to specific GI/TECH so we can measure skill→INT.
function setStarterQB(roster, chart, gi, tech) {
  const qb = roster.find(p => p.id === chart.QB[0]);
  qb.attributes.AWR = gi;   // [FIX Jul 2026] GI/TECH were renamed AWR/TEC — the old names set dead keys and every bucket measured the same rosters
  qb.attributes.TEC = tech;
  refreshRatings(qb);
  return qb;
}

const gp = { offFormation:'Single Back', tendency:'Balanced', rushInPct:60, passDepth:{short:40,medium:40,deep:20}, blitzPct:20, defFormation:'Balanced D', fourthDown:'Moderate', clockMgmt:'Normal', maxFGDist:42 };
const sH = { id:'H', name:'Home' }, sA = { id:'A', name:'Away' };
const N = parseInt(process.argv[2] || '1200', 10);

// ── Accumulators ──
const team = { games:0, rush:0, pass:0, total:0, patt:0, ratt:0, pcomp:0, pints:0, plays:0, pts:0, to:0, sacks:0 };
// QB rows: each starting QB-game. Keyed by skill bucket label.
const qbBuckets = {}; // label -> { att, comp, yds, td, int, games }
function qbBucket(label) { return qbBuckets[label] ?? (qbBuckets[label] = { att:0, comp:0, yds:0, td:0, int:0, games:0 }); }
// RB / WR aggregate (leading back / top receivers)
const rb = { games:0, att:0, yds:0, td:0 };       // per starting RB-game
const wr = { recgames:0, rec:0, yds:0, td:0 };    // per WR with >=1 target-game

function bucketLabel(gi, tech) {
  const m = (gi + tech) / 2;
  if (m >= 90) return 'elite   (AWR/TEC ~94/96)';
  if (m >= 80) return 'good    (AWR/TEC ~84)';
  if (m >= 70) return 'average (AWR/TEC ~75)';
  return 'weak    (AWR/TEC ~62)';
}

// Skill assignments per game: home QB random-natural, away QB forced to a fixed
// elite spec so we get a clean elite sample plus a natural-distribution sample.
for (let i = 0; i < N; i++) {
  const rH = genRoster(1, 'H'), rA = genRoster(1, 'A');
  const cH = buildDepthChart(rH, gp), cA = buildDepthChart(rA, gp);

  // Home QB: leave natural (whatever createPlayer rolled) — gives the organic distribution.
  const qbH = rH.find(p => p.id === cH.QB[0]);
  // Away QB: force elite mistake-free spec the user flagged.
  const qbA = setStarterQB(rA, cA, 94, 96);

  const res = simulateGame(sH, sA, rH, rA, cH, cA, gp, gp);

  // Team aggregates (both teams)
  for (const st of [res.homeStats, res.awayStats]) {
    team.rush += st.rushYds; team.pass += st.passYds; team.total += st.totalYds;
    team.patt += st.passAtt; team.pcomp += st.compAtt; team.pints += st.ints;
    team.to += st.ints + st.fumbles; team.plays += st.rushAtt + st.passAtt; team.ratt += st.rushAtt;
    team.sacks += st.sacksAllowed || 0;
  }
  team.pts += res.homeScore + res.awayScore; team.games += 2;

  // QB per-game, bucketed by skill
  for (const [qb, ps] of [[qbH, res.homePlayerStats[qbH.id]], [qbA, res.awayPlayerStats[qbA.id]]]) {
    if (!ps || ps.passAtt === 0) continue;
    const b = qbBucket(bucketLabel(qb.attributes.AWR, qb.attributes.TEC));
    b.att += ps.passAtt; b.comp += ps.passComp; b.yds += ps.passYds; b.td += ps.passTD; b.int += ps.passInt; b.games++;
  }

  // RB: starting back each team
  for (const [chart, roster, psMap] of [[cH, rH, res.homePlayerStats], [cA, rA, res.awayPlayerStats]]) {
    const back = chart.RB[0]; const ps = psMap[back];
    if (ps && ps.rushAtt > 0) { rb.att += ps.rushAtt; rb.yds += ps.rushYds; rb.td += ps.rushTD; rb.games++; }
  }

  // WR: every receiver with >=1 target in the game
  for (const psMap of [res.homePlayerStats, res.awayPlayerStats]) {
    for (const id in psMap) {
      const ps = psMap[id];
      if (ps.targets > 0 && ps.recComp >= 0 && (ps.recYds > 0 || ps.recComp > 0)) {
        // crude WR filter: had receptions
        if (ps.recComp > 0) { wr.rec += ps.recComp; wr.yds += ps.recYds; wr.td += ps.recTD; wr.recgames++; }
      }
    }
  }
}

const f1 = x => x.toFixed(1);
const f2 = x => x.toFixed(2);
const chk = (v, lo, hi) => (v >= lo && v <= hi) ? '  OK' : '  <-- off';
const g = team.games;

console.log(`=== TEAM AGGREGATES (n=${N} games, ${g} team-games) ===`);
console.log(`Points/team:       ${f1(team.pts/g)}    [real ~24-30]${chk(team.pts/g,22,32)}`);
console.log(`Rush yds/team:     ${f1(team.rush/g)}   [real ~150-200]${chk(team.rush/g,150,200)}`);
console.log(`Pass yds/team:     ${f1(team.pass/g)}   [real ~220-270]${chk(team.pass/g,200,290)}`);
console.log(`Total yds/team:    ${f1(team.total/g)}   [real ~370-470]`);
console.log(`Comp %:            ${f1(100*team.pcomp/team.patt)}    [real ~60-66]${chk(100*team.pcomp/team.patt,58,68)}`);
console.log(`Yds/play:          ${f2(team.total/team.plays)}   [real ~5.5-6.5]`);
console.log(`Plays/team:        ${f1(team.plays/g)}   [real ~65-72]${chk(team.plays/g,65,74)}`);
console.log(`Rush att/team:     ${f1(team.ratt/g)}   [real ~34-42]${chk(team.ratt/g,32,44)}   run% ${f1(100*team.ratt/team.plays)}`);
console.log(`Sacks/team:        ${f2(team.sacks/team.games)}   [target ~1.8-2.3]`);
console.log(`Yds/attempt:       ${f2(team.pass/team.patt)}   [real ~7.0-7.5]${chk(team.pass/team.patt,6.5,8.0)}`);
console.log(`TEAM INT %:        ${f2(100*team.pints/team.patt)}    [real ~2.0-2.5]${chk(100*team.pints/team.patt,1.8,2.8)}`);
console.log(`Turnovers/team:    ${f2(team.to/g)}   [real ~1.3-1.8]${chk(team.to/g,1.2,1.9)}`);

console.log(`\n=== QB INT% BY SKILL BUCKET (the lead question) ===`);
console.log(`bucket                       games   att   comp%   yds/g  TD/g   INT%   [INT% real: avg ~2.3, elite <2.0]`);
const order = ['elite   (AWR/TEC ~94/96)','good    (AWR/TEC ~84)','average (AWR/TEC ~75)','weak    (AWR/TEC ~62)'];
for (const label of order) {
  const b = qbBuckets[label]; if (!b || b.games === 0) continue;
  const intPct = 100*b.int/b.att;
  console.log(`${label}   ${String(b.games).padStart(5)} ${String(b.att).padStart(6)}  ${f1(100*b.comp/b.att).padStart(5)}  ${f1(b.yds/b.games).padStart(6)}  ${f2(b.td/b.games).padStart(4)}  ${f2(intPct).padStart(5)}`);
}

console.log(`\n=== RB (starting back) ===`);
console.log(`yds/game: ${f1(rb.yds/rb.games)}  [real ~70-110]   ypc: ${f2(rb.yds/rb.att)}  [real ~4.2-4.6]   TD/game: ${f2(rb.td/rb.games)}`);

console.log(`\n=== WR (per receiver-with-catch game) ===`);
console.log(`rec/game: ${f1(wr.rec/wr.recgames)}   yds/game: ${f1(wr.yds/wr.recgames)}   TD/game: ${f2(wr.td/wr.recgames)}`);
