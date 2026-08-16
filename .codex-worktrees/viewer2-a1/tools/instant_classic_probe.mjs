import assert from 'node:assert/strict';
import { archiveInstantClassic, compactReplayResult, instantClassicScore,
         INSTANT_CLASSIC_MIN_SCORE, MAX_INSTANT_CLASSICS } from '../js/engine/instantclassics.js';

const school = (id, name, colors) => ({
  id, name, nick: name, abbr: name.slice(0, 3).toUpperCase(), colors,
  roster: Array.from({ length: 85 }, (_, i) => ({ id: `${id}-p${i}`, name: { first: 'P', last: String(i) } })),
  schedule: Array.from({ length: 12 }, () => ({ result: null })),
});
const home = school('h', 'Home State', ['#112244', '#ffffff']);
const away = school('a', 'Away Tech', ['#aa2200', '#eeeeee']);
const play = (half, clock, scoreOff, scoreDef) => ({ half, clock, scoreOff, scoreDef, type: 'run', yards: 4, fieldPos: 50 });
const result = (homeScore, awayScore, drives) => ({
  homeScore, awayScore, winner: homeScore > awayScore ? home.id : away.id,
  homeSchool: home, awaySchool: away, drives,
  homeStats: { totalYds: 400 }, awayStats: { totalYds: 390 },
  homePlayerStats: {}, awayPlayerStats: {}, playerNames: {}, log: [],
});

const routine = result(35, 14, [{ possession: 'home', plays: [play(1, 1700, 0, 0)], result: 'td' }]);
const thriller = result(31, 30, [
  { possession: 'away', plays: [play(2, 240, 24, 21)], result: 'td' },
  { possession: 'home', plays: [play(2, 75, 24, 28)], result: 'td' },
]);
const overtime = result(38, 35, [
  { possession: 'home', plays: [play(2, 30, 28, 28)], result: 'fg' },
  { possession: 'home', plays: [play(3, 300, 35, 35)], result: 'fg' },
]);

assert.ok(instantClassicScore(routine) < INSTANT_CLASSIC_MIN_SCORE, 'routine multi-score game must not archive');
assert.ok(instantClassicScore(thriller) >= INSTANT_CLASSIC_MIN_SCORE, 'late one-point finish must archive');
assert.ok(instantClassicScore(overtime) >= INSTANT_CLASSIC_MIN_SCORE, 'overtime finish must archive');

const compact = compactReplayResult(thriller);
assert.equal(compact.homeSchool.roster, undefined, 'replay must not duplicate a roster');
assert.equal(compact.homeSchool.schedule, undefined, 'replay must not duplicate a schedule');
assert.deepEqual(compact.homeSchool.colors, home.colors);
assert.equal(compact.drives.length, thriller.drives.length);

const state = { season: 2, day: 9, playerSchoolId: home.id, instantClassics: [] };
const first = archiveInstantClassic(state, thriller, 'Week 5');
assert.ok(first?.result, 'qualified game should produce a replay entry');
assert.equal(archiveInstantClassic(state, thriller, 'Week 5'), null, 'same game must not archive twice');
for (let i = 0; i < MAX_INSTANT_CLASSICS + 4; i++) {
  state.day++;
  const r = result(28 + (i % 3), 27, [{ possession: 'home', plays: [play(2, 40, 21, 27)], result: 'td' }]);
  archiveInstantClassic(state, r, `Week ${i + 6}`);
}
assert.ok(state.instantClassics.length <= MAX_INSTANT_CLASSICS, 'archive must remain capped');

const live = await import('../js/state.js');
live.setNotifyFn(() => {});
Object.assign(live.state, {
  season: 4, day: 12, playerSchoolId: home.id, playerCoach: { recruitBoard: [] },
  world: { schools: [home, away] }, instantClassics: [], inbox: [],
  settings: { showGameResultModal: false }, ui: { showGameResult: false },
});
live.processEvents([{ type: 'game', result: thriller }], { suppressModal: true });
assert.equal(live.state.instantClassics.length, 1, 'real game-event path must archive even when the result modal is suppressed');
assert.equal(live.state.ui.showGameResult, false, 'archiving must not force a suppressed result modal');
const fullBytes = Buffer.byteLength(JSON.stringify(thriller));
const compactBytes = Buffer.byteLength(JSON.stringify(compact));
assert.ok(compactBytes < fullBytes / 2, `compact replay should shed world-sized school payload (${compactBytes}/${fullBytes})`);

console.log(`PASS instant classics: routine=${instantClassicScore(routine)} thriller=${instantClassicScore(thriller)} overtime=${instantClassicScore(overtime)} archive=${state.instantClassics.length}/${MAX_INSTANT_CLASSICS} compact=${compactBytes}/${fullBytes} bytes`);
