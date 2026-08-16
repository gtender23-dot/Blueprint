import { generateSchedule } from './world.js';
import { simulateGame } from './sim.js';
import { updateStandings } from './season.js';

// ── Season Mode engine (Creativity Tools / Season Mode, Aug 2026) ──────────
// A focused, resumable single-season loop, deliberately ISOLATED from the
// dynasty pipeline: it reuses generateSchedule + simulateGame + updateStandings,
// but NOT advanceDay, recruiting, the offseason, or the gate stack. It carries
// its own side-effect-free playoff bracket (the dynasty buildAllBrackets isn't
// exported and mutates budgets/prestige, which a pure sandbox must not do) — the
// SEEDING mirrors the dynasty bracket so a Season Mode playoff behaves like the
// real one, minus the career bookkeeping. See Ref/SEASON_MODE.md.
//
// A session: { world, schedule, playerSchoolId, division, reg:{done}, playoff }.
// The UI drives it a day at a time (coach your game in the viewer, sim the rest);
// simFullSeason is the "let the sim handle it" / probe path.

function dress(school) {
  return { roster: school.roster, depth: school.depthChart || {}, gp: school.gameplan };
}
function createSeasonSession(world, playerSchoolId = null) {
  for (const s of world.schools) {
    s.record = { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
  }
  const division = (world.schools.find((s) => s.id === playerSchoolId) || world.schools[0]).division;
  return {
    world,
    schedule: generateSchedule(world),
    playerSchoolId,
    division,
    regDone: false,
    playoff: null,
    champion: null
  };
}
// Sim every game on `day` that isn't finished. `skipPlayerGame` leaves the
// coached team's game unplayed so the UI can run it live in the viewer.
function simDay(session, day, { skipPlayerGame = false } = {}) {
  const byId = new Map(session.world.schools.map((s) => [s.id, s]));
  let n = 0;
  for (const g of session.schedule) {
    if (g.day !== day || g.result) continue;
    if (skipPlayerGame && session.playerSchoolId && (g.homeId === session.playerSchoolId || g.awayId === session.playerSchoolId)) continue;
    const home = byId.get(g.homeId), away = byId.get(g.awayId);
    if (!home || !away) continue;
    const h = dress(home), a = dress(away);
    const result = simulateGame(home, away, h.roster, a.roster, h.depth, a.depth, h.gp, a.gp);
    g.result = result;
    updateStandings(session, { game: g, result });
    n++;
  }
  return n;
}
function regularSeasonDays(session) {
  return [...new Set(session.schedule.map((g) => g.day))].sort((a, b) => a - b);
}
function simRegularSeason(session, { skipPlayerGames = false } = {}) {
  for (const day of regularSeasonDays(session)) simDay(session, day, { skipPlayerGame: skipPlayerGames });
  session.regDone = session.schedule.every((g) => g.result);
  return session.regDone;
}
// ── Playoff — side-effect-free, seeding mirrors the dynasty bracket ─────────
function conferenceChampions(schools) {
  const confs = [...new Set(schools.map((s) => s.conf))];
  const champs = [];
  for (const conf of confs) {
    const top = schools.filter((s) => s.conf === conf).sort((a, b) => {
      const ag = Math.max(1, a.record.confWins + a.record.confLosses);
      const bg = Math.max(1, b.record.confWins + b.record.confLosses);
      return b.record.confWins / bg - a.record.confWins / ag || b.record.wins - a.record.wins;
    })[0];
    if (top) champs.push(top);
  }
  return champs;
}
function seedSlots(size) {
  let a = [1];
  while (a.length < size) {
    const sum = a.length * 2 + 1, b = [];
    for (const s of a) b.push(s, sum - s);
    a = b;
  }
  return a;
}
function buildPlayoff(session, { field: FIELD = 16 } = {}) {
  const schools = session.world.schools.filter((s) => s.division === session.division);
  const champs = conferenceChampions(schools);
  const champIds = new Set(champs.map((s) => s.id));
  const byWins = (a, b) => b.record.wins - a.record.wins || b.record.confWins - a.record.confWins;
  const seededChamps = champs.slice().sort(byWins);
  const atLarge = schools.filter((s) => !champIds.has(s.id)).sort(byWins).slice(0, Math.max(0, FIELD - seededChamps.length));
  const field = [...seededChamps, ...atLarge].slice(0, FIELD);
  const bracket = { seeds: field.map((s) => s.id), rounds: [], champion: null };
  const n = field.length;
  if (n < 2) { session.playoff = bracket; return bracket; }
  const bsize = 1 << Math.ceil(Math.log2(Math.max(2, n)));
  const ordered = seedSlots(bsize).filter((seed) => seed <= n).map((seed) => field[seed - 1]);
  let alive = ordered.map((s) => s.id);
  bracket.rounds.push(pairRound(alive));
  session.playoff = bracket;
  return bracket;
}
function pairRound(aliveIds) {
  const games = [];
  for (let i = 0; i + 1 < aliveIds.length; i += 2) games.push({ homeId: aliveIds[i], awayId: aliveIds[i + 1], result: null });
  // odd one out gets a bye
  const bye = aliveIds.length % 2 ? aliveIds[aliveIds.length - 1] : null;
  return { games, bye };
}
function simPlayoff(session) {
  if (!session.playoff) buildPlayoff(session);
  const bracket = session.playoff;
  const byId = new Map(session.world.schools.map((s) => [s.id, s]));
  if (bracket.seeds.length < 2) { bracket.champion = bracket.seeds[0] || null; session.champion = bracket.champion; return bracket.champion; }
  let guard = 0;
  while (!bracket.champion && guard++ < 20) {
    const round = bracket.rounds[bracket.rounds.length - 1];
    const winners = [];
    if (round.bye) winners.push(round.bye);
    for (const g of round.games) {
      const home = byId.get(g.homeId), away = byId.get(g.awayId);
      const h = dress(home), a = dress(away);
      const result = simulateGame(home, away, h.roster, a.roster, h.depth, a.depth, h.gp, a.gp);
      g.result = result;
      winners.push(result.homeScore >= result.awayScore ? g.homeId : g.awayId);
    }
    if (winners.length <= 1) { bracket.champion = winners[0] || null; break; }
    bracket.rounds.push(pairRound(winners));
  }
  session.champion = bracket.champion;
  return bracket.champion;
}
function simFullSeason(session) {
  simRegularSeason(session);
  buildPlayoff(session);
  return simPlayoff(session);
}
function getStandings(session) {
  return session.world.schools
    .filter((s) => s.division === session.division)
    .map((s) => ({ id: s.id, name: s.name, conf: s.conf, wins: s.record.wins, losses: s.record.losses, confWins: s.record.confWins, confLosses: s.record.confLosses }))
    .sort((a, b) => b.wins - a.wins || b.confWins - a.confWins);
}
function nextUnplayedDay(session) {
  const days = [...new Set(session.schedule.filter((g) => !g.result).map((g) => g.day))].sort((a, b) => a - b);
  return days.length ? days[0] : null;
}
function seasonComplete(session) {
  return session.schedule.every((g) => g.result) && !!session.champion;
}
// ── Resumable persistence — its OWN lightweight save, separate from dynasty ─
// The whole session is plain JSON (the world's schools + schedule + playoff +
// progress), so it round-trips: the engine looks everything up by id, so lost
// object identity doesn't matter. serialize/deserialize are storage-agnostic;
// the localStorage wrappers are the default for small divisions. NOTE: a full
// D1 season (~120 teams) is a big blob — the UI should route large-division saves
// through the dynasty IndexedDB path (persistence.js) rather than localStorage.
var SEASON_KEY = "cfb-seasonmode";
function serializeSession(session) {
  return { v: 1, world: session.world, schedule: session.schedule, playerSchoolId: session.playerSchoolId || null, division: session.division, playoff: session.playoff || null, champion: session.champion || null };
}
function deserializeSession(obj) {
  if (!obj || !obj.world || !Array.isArray(obj.schedule)) return null;
  return {
    world: obj.world,
    schedule: obj.schedule,
    playerSchoolId: obj.playerSchoolId || null,
    division: obj.division,
    regDone: obj.schedule.every((g) => g.result),
    playoff: obj.playoff || null,
    champion: obj.champion || null
  };
}
function saveSeasonSession(session) {
  try {
    localStorage.setItem(SEASON_KEY, JSON.stringify(serializeSession(session)));
    return true;
  } catch (e) {
    return false;
  }
}
function loadSeasonSession() {
  try {
    const raw = localStorage.getItem(SEASON_KEY);
    return raw ? deserializeSession(JSON.parse(raw)) : null;
  } catch (e) {
    return null;
  }
}
function hasSeasonSave() {
  try {
    return !!localStorage.getItem(SEASON_KEY);
  } catch (e) {
    return false;
  }
}
function clearSeasonSave() {
  try {
    localStorage.removeItem(SEASON_KEY);
  } catch (e) {
  }
}

export { createSeasonSession, simDay, simRegularSeason, regularSeasonDays, buildPlayoff, simPlayoff, simFullSeason, getStandings, nextUnplayedDay, seasonComplete, serializeSession, deserializeSession, saveSeasonSession, loadSeasonSession, hasSeasonSave, clearSeasonSave };
