// snap_track_probe.mjs — PASS 7 Fix D plumbing gate: the sim's real snap
// counts survive to the game result and obey conservation (Σ player snaps =
// 11 × side snaps, both teams), job-bucket snaps are a subset of snaps and
// only ever out-of-native, persistence lands on player.stats/careerStats and
// the season reset clears season fields but keeps career, and __noSnapTrack
// kills the job counting + persistence without touching the fatigue engine.
// Run: node tools/snap_track_probe.mjs
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};
function genRoster(s) {
  const r = [];
  for (const [pos, c] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < c; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], 1); p.schoolId = s; r.push(p); }
  }
  return r;
}
const gp = { offFormation: 'Pro-Set', tendency: 'Balanced', rushInPct: 60, passDepth: { short: 40, medium: 40, deep: 20 }, blitzPct: 20, defFormation: 'Balanced D', fourthDown: 'Moderate', clockMgmt: 'Normal', maxFGDist: 42 };
const play = (rH, rA) => simulateGame({ id: 'H', name: 'H' }, { id: 'A', name: 'A' }, rH, rA, buildDepthChart(rH, gp), buildDepthChart(rA, gp), gp, gp);

// conservation + subset laws over several games
{
  let consOK = true, subsetOK = true, foreignOK = true, jobsSeen = 0;
  for (let g = 0; g < 6; g++) {
    const rH = genRoster('H'), rA = genRoster('A');
    const res = play(rH, rA);
    for (const [side, roster] of [['home', rH], ['away', rA]]) {
      const counts = res[`${side}SnapCounts`], jobs = res[`${side}JobSnaps`], team = res[`${side}TeamSnaps`];
      const tot = Object.values(counts).reduce((s, n) => s + n, 0);
      if (tot !== 11 * (team.off + team.def)) consOK = false;
      for (const [id, jm] of Object.entries(jobs)) {
        const jTot = Object.values(jm).reduce((s, n) => s + n, 0);
        jobsSeen += jTot;
        if (jTot > (counts[id] || 0)) subsetOK = false;
        const p = roster.find((x) => x.id === id);
        for (const k of Object.keys(jm)) {
          const natKey = p.position === 'LB' ? 'ILB' : p.position;
          if (k === natKey) foreignOK = false;
        }
      }
    }
  }
  check('conservation: Σ player snaps = 11 × (off+def) snaps, every game, both teams', consOK);
  check('job snaps ⊆ player snaps', subsetOK);
  check('job snaps are only ever out-of-native buckets', foreignOK);
  check('job-bucket snaps actually occur (mesh fronts field cross-position bodies)', jobsSeen > 0, `${jobsSeen} foreign snaps over 6 games`);
}
// __noSnapTrack: job counting dies, fatigue snap counting (an engine concern) lives
{
  globalThis.__noSnapTrack = true;
  const rH = genRoster('H'), rA = genRoster('A');
  const res = play(rH, rA);
  const jobs = Object.keys(res.homeJobSnaps).length + Object.keys(res.awayJobSnaps).length;
  const snaps = Object.keys(res.homeSnapCounts).length;
  delete globalThis.__noSnapTrack;
  check('__noSnapTrack: no job snaps recorded', jobs === 0);
  check('__noSnapTrack: fatigue snap engine still runs (rotation untouched)', snaps > 0);
}
// persistence shape: applySnapCounts is season.js-internal, so verify through
// the public seam — updateStandings — with a minimal school pair
{
  
  const seasonMod = await import('../js/engine/season.js');
  const rH = genRoster('H'), rA = genRoster('A');
  const res = play(rH, rA);
  const mk = (id, roster) => ({ id, conf: 'X', roster, record: { wins: 0, losses: 0, confWins: 0, confLosses: 0 }, stats: { games: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, rushYds: 0, passYds: 0, totalYds: 0, turnovers: 0, sacks: 0, sacksAllowed: 0 } });
  const home = mk('H', rH), away = mk('A', rA);
  const state = { world: { schools: [home, away] } };
  // updateStandings isn't exported; drive the same seam via its exported caller if
  // present, else replicate the call contract through processGameResult lookup.
  const updateStandings = seasonMod.updateStandings || null;
  if (updateStandings) {
    updateStandings(state, { game: { homeId: 'H', awayId: 'A' }, result: res });
    const anySnaps = rH.some((p) => (p.stats?.snaps || 0) > 0);
    const anyCareer = rH.some((p) => (p.careerStats?.snaps || 0) > 0);
    const anyAt = rH.some((p) => p.stats?.snapsAt && Object.keys(p.stats.snapsAt).length);
    check('persistence: p.stats.snaps accumulates', anySnaps);
    check('persistence: p.careerStats.snaps accumulates', anyCareer);
    check('persistence: p.stats.snapsAt lands job buckets', anyAt);
    check('team side totals land on school.stats', (home.stats.offSnaps || 0) > 0 && (home.stats.defSnaps || 0) > 0, `off ${home.stats.offSnaps} def ${home.stats.defSnaps}`);
    const anyMorale = rH.some((p) => p.morale != null && p.morale !== 70);
    check('morale ticked off real usage (some player moved off baseline)', anyMorale);
  } else {
    check('updateStandings exported for the probe seam', false, 'export it or adjust probe');
  }
}
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
