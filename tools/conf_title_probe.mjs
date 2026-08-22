// conf_title_probe.mjs — CONFERENCE TITLE GAMES (2026-08-22, owner build).
//
// Day 19 used to be empty — CONF_GAME_DAYS ends at 18 — so conference champions
// were awarded on regular-season conference win pct alone and the week was
// called Selection Week for exactly that reason (PLAYTEST_2026-08-12 item 17,
// option L). Now each conference splits into two halves (school.confDiv, set in
// worldgen; NOT school.division, which is D1/D2/D3), the two half-leaders meet,
// and the WINNER is champion and takes the automatic playoff berth. The loser
// falls into the at-large pool.
//
// What this pins:
//   A. every conference splits into two non-empty halves that sum to it, and the
//      split is stable across two generations of the same world;
//   B. day 19 schedules exactly one title game per conference, between the two
//      half-leaders, never a team against itself;
//   C. the games are ORDINARY schedule entries — same shape as any other — which
//      is what lets the day loop sim them and the coached path call one;
//   D. every champion is a title-game WINNER, never a loser;
//   E. a title-game loser holds no automatic berth (it may still be in on
//      merit — that is the at-large pool doing its job, and is not a failure).
//
// Run from repo root: node tools/conf_title_probe.mjs
import { pinRandom } from './_seed.mjs';
import { generateWorld } from '../js/engine/world.js';

const reseed = pinRandom();
let pass = 0, fail = 0; const bad = [];
const ok = (c, m) => { if (c) pass++; else { fail++; bad.push(m); } };

// ── A. the split ────────────────────────────────────────────────────────────
reseed();
const w = generateWorld();
const byConf = {};
for (const s of w.schools) (byConf[s.conf] = byConf[s.conf] || []).push(s);
const confList = Object.keys(byConf);
ok(confList.length > 0, `world has conferences (${confList.length})`);
let uneven = 0, missing = 0;
for (const [conf, list] of Object.entries(byConf)) {
  const west = list.filter((s) => s.confDiv === 'West').length;
  const east = list.filter((s) => s.confDiv === 'East').length;
  if (!west || !east) { missing++; if (missing <= 3) bad.push(`${conf}: half empty (W${west}/E${east})`); }
  if (west + east !== list.length) { uneven++; if (uneven <= 3) bad.push(`${conf}: halves do not sum (${west}+${east} vs ${list.length})`); }
  if (Math.abs(west - east) > 1) { uneven++; if (uneven <= 3) bad.push(`${conf}: lopsided (W${west}/E${east})`); }
}
ok(missing === 0, `every conference has two non-empty halves (${missing} bad)`);
ok(uneven === 0, `halves sum and are balanced (${uneven} bad)`);
// the split must not be a second source of drift
reseed();
const w2 = generateWorld();
const key = (world) => world.schools.map((s) => `${s.id}:${s.confDiv}`).sort().join('|');
ok(key(w) === key(w2), 'the same seed splits the same way twice');

// ── F. THE SCHEDULE PLAYS THE HALVES (2026-08-22) ───────────────────────────
// A half-leader that never played its own half is a fiction, so the conference
// schedule is now everyone-in-your-half plus crossovers. The counts land exactly
// on the existing CONF_GAMES (8): a half of 6 gives 5 intra + 3 cross, a half of
// 5 gives 4 intra + 4 cross. These pin that, and pin the three laws the old
// round-robin guaranteed and a rewrite could quietly break.
{
  const { generateSchedule: genSched } = await import('../js/engine/world.js');
  const { C } = await import('../js/constants.js');
  reseed();
  const sw = generateWorld();
  const sched = genSched(sw, 1);
  const sBy = new Map(sw.schools.map((s) => [s.id, s]));
  const confOpp = {};
  for (const s of sw.schools) confOpp[s.id] = new Set();
  const perDay = {};
  for (const g of sched) {
    const h = sBy.get(g.homeId), a = sBy.get(g.awayId);
    if (!h || !a) continue;
    (perDay[g.day] = perDay[g.day] || []).push(g.homeId, g.awayId);
    if (h.conf !== a.conf) continue;
    confOpp[h.id].add(a.id); confOpp[a.id].add(h.id);
  }
  const wrongCount = sw.schools.filter((s) => confOpp[s.id].size !== C.CONF_GAMES);
  ok(wrongCount.length === 0, `every team plays exactly ${C.CONF_GAMES} conference games (${wrongCount.length} do not)`);

  const missedHalf = sw.schools.filter((s) => sw.schools.some((o) =>
    o.id !== s.id && o.conf === s.conf && o.confDiv === s.confDiv && !confOpp[s.id].has(o.id)));
  ok(missedHalf.length === 0, `every team plays its ENTIRE half (${missedHalf.length} did not)`);

  const doubled = Object.entries(perDay).filter(([, ids]) => new Set(ids).size !== ids.length);
  ok(doubled.length === 0, `no team is booked twice on a day (${doubled.length} days)`);

  // the crossovers must rotate, or every season is the same schedule
  const keyOf = (season) => genSched(sw, season)
    .filter((g) => { const h = sBy.get(g.homeId), a = sBy.get(g.awayId); return h && a && h.conf === a.conf; })
    .map((g) => [g.homeId, g.awayId].sort().join('>')).sort().join('|');
  ok(keyOf(1) !== keyOf(2), 'the conference slate is not identical two seasons running');

  // home/away stays balanced — the old scheduler's quiet guarantee
  const homeN = {};
  for (const s of sw.schools) homeN[s.id] = 0;
  for (const g of sched) {
    const h = sBy.get(g.homeId), a = sBy.get(g.awayId);
    if (h && a && h.conf === a.conf) homeN[g.homeId]++;
  }
  const hv = sw.schools.map((s) => homeN[s.id]);
  ok(Math.max(...hv) - Math.min(...hv) <= 2,
    `conference home games stay balanced (spread ${Math.min(...hv)}-${Math.max(...hv)}; the old round robin ran 3-5)`);
}

// ── B–E. a full season through the real engine ──────────────────────────────
// Imported lazily: season.js pulls in a large graph and the checks above stand
// on their own if it ever fails to load.
const { advanceDay, resumeFromHalftime } = await import('../js/engine/season.js');
const { generateSchedule, generateRecruitPool } = await import('../js/engine/world.js');
const { devCtx } = await import('../js/engine/offseason.js');
reseed();
const world = generateWorld();
world.recruits = generateRecruitPool(world);
const ps = world.schools[0];
const state = {
  initialized: true, season: 1, day: 1, playerSchoolId: ps.id,
  playerCoach: { id: 'player', schoolId: ps.id, prestige: ps.prestige, reputation: 'C',
    budget: 0, scholarshipsAvailable: 0, recruitBoard: [], budgetCarryover: 0,
    seasonRecord: { wins: 0, losses: 0 } },
  world, schedule: generateSchedule(world),
  playoffs: null, inbox: [], gameLog: [], signingsLog: [], ui: {},
};
ps.coach = state.playerCoach;
// advanceDay hard-gates day 3 on position review (only the dashboard sets it);
// acknowledge it or the loop spins forever. Same note as commit_rate_test.
let guard = 0;
while (state.day < 19 && guard++ < 60) {
  if (state.day === 3) devCtx(state).posReviewed = true;
  advanceDay(state, () => {});
  while (state.pendingHalftime) resumeFromHalftime(state);
}
ok(state.day === 19, `advanced to day 19 (got ${state.day})`);

const titles = (state.schedule || []).filter((g) => g.confTitle);
ok(titles.length > 0, `title games were scheduled (${titles.length})`);
ok(titles.every((g) => g.day === 19), 'every title game is on day 19');
ok(titles.every((g) => g.homeId && g.awayId && g.homeId !== g.awayId), 'no team plays itself');
const perConf = {};
for (const g of titles) perConf[g.conf] = (perConf[g.conf] || 0) + 1;
ok(Object.values(perConf).every((n) => n === 1), 'exactly one title game per conference');

const byId = new Map(world.schools.map((s) => [s.id, s]));
ok(titles.every((g) => {
  const h = byId.get(g.homeId), a = byId.get(g.awayId);
  return h && a && h.conf === a.conf && h.confDiv !== a.confDiv;
}), 'each title game is one half-leader against the other');

// C. ordinary entries — the day loop played them
const played = titles.filter((g) => g.result && g.result.winner);
ok(played.length === titles.length, `every title game was played by the normal day loop (${played.length}/${titles.length})`);

// D/E. champions are winners; losers hold no automatic berth
const champIds = new Set();
for (const div of ['D1', 'D2', 'D3']) for (const id of (state.allPlayoffs?.[div]?.confChampIds) || []) champIds.add(id);
ok(champIds.size > 0, `champions were named (${champIds.size})`);
const losers = played.map((g) => (g.result.winner === g.homeId ? g.awayId : g.homeId));
const winners = new Set(played.map((g) => g.result.winner));
const wrong = [...champIds].filter((id) => !winners.has(id));
ok(wrong.length === 0, `every champion won its title game (${wrong.length} did not)`);
const loserChamps = losers.filter((id) => champIds.has(id));
ok(loserChamps.length === 0, `no title-game loser is a champion (${loserChamps.length})`);

console.log(`CONF TITLE PROBE — ${pass} pass, ${fail} fail`);
console.log(`  ${confList.length} conferences · ${titles.length} title games · ${champIds.size} champions`);
if (fail) { console.log('  FAILURES:'); bad.forEach((m) => console.log('   -', m)); }
console.log(fail ? 'CONF TITLE PROBE FAIL' : 'CONF TITLE PROBE PASS');
process.exit(fail ? 1 : 0);
