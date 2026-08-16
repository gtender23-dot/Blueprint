// season_persist_probe — Season Mode resumable persistence.
// Proves a season can be saved mid-run and resumed to a champion: play part of a
// season, save, load into a FRESH session object, and confirm the standings and
// results survived and the restored session plays the rest of the way to a
// champion. Also the progress cursor (nextUnplayedDay) and corruption tolerance.
// localStorage is polyfilled (UI-layer store).
globalThis.localStorage = (() => {
  let m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k), clear: () => void (m = new Map()) };
})();

const { compileLeague, generateWorld } = await import('../js/engine/world.js');
const { createSeasonSession, simDay, regularSeasonDays, nextUnplayedDay, simRegularSeason, buildPlayoff, simPlayoff, seasonComplete, saveSeasonSession, loadSeasonSession, hasSeasonSave, clearSeasonSave, getStandings } = await import('../js/engine/seasonmode.js');

let pass = 0, fail = 0;
const bad = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; bad.push(msg); } }

// small division for speed
function smallWorld() {
  const conferences = [], teams = [];
  let t = 0;
  for (const c of ['A', 'B']) {
    conferences.push({ id: c, name: `${c} Conf`, short: c, division: 'D1', conferenceClass: 'midmajor' });
    for (let i = 0; i < 6; i++) teams.push({ id: `t${t++}`, name: `${c}${i}`, division: 'D1', conf: c, prestige: 3 + (i % 3), state: 'KS' });
  }
  const compiled = compileLeague({ mode: 'replace', conferences, teams });
  return generateWorld({ schools: compiled.schools, conferences: compiled.conferences });
}

const world = smallWorld();
const me = world.schools[0].id;
const s = createSeasonSession(world, me);
ok(!hasSeasonSave(), 'no season save initially');

// play the first 3 scheduled days
const days = regularSeasonDays(s);
for (const d of days.slice(0, 3)) simDay(s, d);
const playedBefore = s.schedule.filter((g) => g.result).length;
ok(playedBefore > 0, `partial season played (${playedBefore} games)`);
const winsBefore = world.schools.reduce((a, x) => a + x.record.wins, 0);
const nextBefore = nextUnplayedDay(s);
ok(nextBefore != null && nextBefore > days[0], 'progress cursor points past the games played');

// save
ok(saveSeasonSession(s) && hasSeasonSave(), 'session saved');

// load into a fresh object
const r = loadSeasonSession();
ok(r && r.division === 'D1' && r.playerSchoolId === me, 'session loaded with its division + coached team');
ok(r.schedule.filter((g) => g.result).length === playedBefore, 'played games survived the round-trip');
ok(r.world.schools.reduce((a, x) => a + x.record.wins, 0) === winsBefore, 'standings (win totals) survived the round-trip');
ok(nextUnplayedDay(r) === nextBefore, 'progress cursor identical after resume');

// resume: play the rest + playoff to a champion, on the RESTORED session
let threw = false, champ = null;
try {
  simRegularSeason(r);
  buildPlayoff(r);
  champ = simPlayoff(r);
} catch (e) { threw = true; bad.push('resume threw: ' + e.message); }
ok(!threw, 'restored session plays the rest of the season without error');
ok(champ && r.world.schools.find((x) => x.id === champ), 'restored season resolves to a champion');
ok(seasonComplete(r), 'restored season reports complete');
ok(r.schedule.every((g) => g.result), 'every regular-season game finished after resume');
ok(getStandings(r).length === 12, 'standings intact on the restored world');

// corruption + clear
localStorage.setItem('cfb-seasonmode', '{ not json');
ok(loadSeasonSession() === null, 'corrupt save loads as null (no throw)');
clearSeasonSave();
ok(!hasSeasonSave(), 'clearSeasonSave removes it');

console.log(`SEASON PERSIST PROBE — ${pass} pass, ${fail} fail`);
if (fail) { console.log('  FAILURES:'); bad.forEach((m) => console.log('   -', m)); }
console.log(fail ? 'SEASON PERSIST PROBE FAIL' : 'SEASON PERSIST PROBE PASS');
process.exit(fail ? 1 : 0);
