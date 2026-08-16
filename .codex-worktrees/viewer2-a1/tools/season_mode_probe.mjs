// season_mode_probe — the Season Mode engine + the no-cap guarantee.
// Proves the isolated single-season loop runs end to end: build a division ->
// generateWorld -> play a full regular season -> build a playoff -> resolve to a
// champion, with standings that add up. Then the no-cap arm: a division with
// deliberately WEIRD conference sizes (a 2-team conf, a 20-team superconference,
// an odd one) still schedules, plays, and crowns a champion — verifying the
// "no size cap needed" claim rather than assuming it. Reuses the Creator league
// compiler to build the divisions, so it also exercises that seam under load.
import { compileLeague, generateWorld } from '../js/engine/world.js';
import { createSeasonSession, simRegularSeason, buildPlayoff, simPlayoff, simFullSeason, getStandings } from '../js/engine/seasonmode.js';

let pass = 0, fail = 0;
const bad = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; bad.push(msg); } }

function divisionWorld(confSpecs) {
  // confSpecs: [{ id, size }] — build a replace-mode single-D1-division blueprint
  const conferences = [], teams = [];
  let t = 0;
  for (const c of confSpecs) {
    conferences.push({ id: c.id, name: `${c.id} Conference`, short: c.id.slice(0, 3), division: 'D1', conferenceClass: c.power ? 'power' : 'midmajor' });
    for (let i = 0; i < c.size; i++) teams.push({ id: `t${t++}`, name: `${c.id} Team ${i}`, division: 'D1', conf: c.id, prestige: 3 + (i % 4), state: 'TX' });
  }
  const compiled = compileLeague({ mode: 'replace', conferences, teams });
  return { world: generateWorld({ schools: compiled.schools, conferences: compiled.conferences }), teamCount: teams.length };
}

// ── 1. A normal division: full season to a champion ─────────────────────────
{
  const { world, teamCount } = divisionWorld([
    { id: 'NORTH', size: 10, power: true }, { id: 'SOUTH', size: 10, power: true },
    { id: 'EAST', size: 10 }, { id: 'WEST', size: 10 }
  ]);
  const me = world.schools[0].id;
  const s = createSeasonSession(world, me);
  ok(s.division === 'D1' && s.schedule.length > 0, 'session built with a schedule');
  ok(world.schools.every((x) => x.record.wins === 0), 'records reset at session start');
  const regDone = simRegularSeason(s);
  ok(regDone && s.schedule.every((g) => g.result), 'full regular season played, every game has a result');
  // standings sanity: total wins == total losses (every game makes exactly one of each)
  const totW = world.schools.reduce((a, x) => a + x.record.wins, 0);
  const totL = world.schools.reduce((a, x) => a + x.record.losses, 0);
  ok(totW === totL && totW === s.schedule.length, `standings balance (W ${totW} == L ${totL} == games ${s.schedule.length})`);
  const st = getStandings(s);
  ok(st.length === teamCount && st[0].wins >= st[st.length - 1].wins, 'standings sorted, every team listed');
  const bracket = buildPlayoff(s);
  ok(bracket.seeds.length >= 2 && bracket.seeds.length <= 16, `playoff field is 2..16 (${bracket.seeds.length})`);
  const champ = simPlayoff(s);
  ok(champ && world.schools.find((x) => x.id === champ), 'a champion was crowned');
  ok(bracket.champion === champ, 'session records the champion');
}

// ── 2. simFullSeason convenience + a coached-team present in the field path ──
{
  const { world } = divisionWorld([{ id: 'A', size: 8, power: true }, { id: 'B', size: 8 }, { id: 'C', size: 8 }]);
  const s = createSeasonSession(world, world.schools[3].id);
  let threw = false, champ = null;
  try { champ = simFullSeason(s); } catch (e) { threw = true; bad.push('simFullSeason threw: ' + e.message); }
  ok(!threw && champ, 'simFullSeason runs reg + playoff to a champion in one call');
}

// ── 3. NO-CAP: weird conference sizes still run to a champion ───────────────
{
  let threw = false, champ = null, teamCount = 0;
  try {
    const built = divisionWorld([
      { id: 'MEGA', size: 20, power: true },  // superconference
      { id: 'MICRO', size: 2 },               // two-team conf (minimum that plays)
      { id: 'ODD', size: 7 },                 // odd size -> round-robin bye
      { id: 'MID', size: 11 }
    ]);
    teamCount = built.teamCount;
    const s = createSeasonSession(built.world, built.world.schools[0].id);
    champ = simFullSeason(s);
    ok(s.schedule.every((g) => g.result), 'weird-size division: every regular-season game resolved');
  } catch (e) { threw = true; bad.push('no-cap arm threw: ' + e.message); }
  ok(!threw, 'a division with a 20-team conf + a 2-team conf + odd sizes runs without error');
  ok(champ, `weird-size division still crowns a champion (${teamCount} teams, no cap)`);
}

console.log(`SEASON MODE PROBE — ${pass} pass, ${fail} fail`);
if (fail) { console.log('  FAILURES:'); bad.forEach((m) => console.log('   -', m)); }
console.log(fail ? 'SEASON MODE PROBE FAIL' : 'SEASON MODE PROBE PASS');
process.exit(fail ? 1 : 0);
