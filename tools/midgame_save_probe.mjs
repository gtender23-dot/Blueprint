// midgame_save_probe.mjs — can a save taken DURING the player's game be resumed?
//
// Reported Jul 2026: closing the app mid-game left the chalkboard viewer unable to launch,
// froze the call-frequency buttons, and then advanced multiple weeks without ever playing
// the player's game (0-0 record while the opponent picked up wins).
//
// The suspect is the asymmetry in the save paths. js/ui/app.js REFUSES a manual save while
// a game is live, with a comment that says exactly why:
//
//     "Never snapshot a live game token. saveGame runs JSON.stringify(state), which drops
//      the token's ask closures and detaches its schedule refs — a save taken at halftime /
//      a call / the kickoff prompt reloads into a corrupt, unresumable pause."
//
// ...but the 30-second background autosave and the pagehide / beforeunload /
// visibilitychange flush call the SAME serializer with NO such guard. So the one thing the
// manual button is careful never to do happens automatically every thirty seconds, and
// guaranteed the moment the user closes the tab.
//
// This probe does the round trip in Node against the real engine: sim a first half, freeze
// the token, JSON round-trip it exactly as buildSnapshot does, and try to resume. No
// browser needed — if the token cannot survive JSON, everything downstream follows.
//
// Usage: node tools/midgame_save_probe.mjs
import { generateWorld, generateSchedule, buildDepthChart } from '../js/engine/world.js';
import { advanceDay, resumeFromHalftime, resumeFromPlayCall,
         resumeFromFourthDown }                           from '../js/engine/season.js';
import { gamePauseIsLive, rehydrate }                     from '../js/engine/persistence.js';
import { C }                                                from '../js/constants.js';

const line = (s = '') => console.log(s);

// ── build a live dynasty and push it to the first game day ─────────────────
const world = generateWorld();
const ps = world.schools[0];
const state = {
  initialized: true, season: 1, day: 4, playerSchoolId: ps.id,
  playerCoach: { id: 'player', schoolId: ps.id, prestige: ps.prestige, reputation: 'C',
    budget: 0, scholarshipsAvailable: 0, recruitBoard: [], budgetCarryover: 0,
    seasonRecord: { wins: 0, losses: 0 }, status: 'employed' },
  world, schedule: generateSchedule(world), playoffs: null,
  inbox: [], gameLog: [], signingsLog: [], awardsLog: [], ui: {},
  settings: { liveWatch: true },
};
ps.coach = state.playerCoach;

// "Every Snap" is the mode that freezes the token mid-first-half on an asked play — the
// same pause the chalkboard viewer decorates. It is the worst case, so it is the case.
state._callModeToday = 'all';

let events = advanceDay(state, () => {});
let guard = 0;
while (!state.pendingHalftime && state.day < 8 && guard++ < 6) {
  state._callModeToday = 'all';
  events = advanceDay(state, () => {});
}

if (!state.pendingHalftime) {
  line('could not reach a paused player game — probe cannot run');
  process.exit(2);
}

const pending = state.pendingHalftime;
const token   = pending.token;
line('Mid-game save round trip');
line(`paused on day ${state.day}: ${pending.home?.name} vs ${pending.away?.name}`);
line(`pause kind: ${token?.pending ? `asked snap (${token.pending.kind || 'call'})` : 'halftime'}`);
line('');

// ── what does the token actually hold? ─────────────────────────────────────
const kinds = {};
const walk = (o, depth = 0, seen = new Set()) => {
  if (!o || typeof o !== 'object' || depth > 3 || seen.has(o)) return;
  seen.add(o);
  for (const k of Object.keys(o)) {
    const v = o[k];
    const t = typeof v;
    if (t === 'function') kinds[`fn:${k}`] = (kinds[`fn:${k}`] || 0) + 1;
    else if (v instanceof Map || v instanceof Set) kinds[`${v.constructor.name}:${k}`] = 1;
    else walk(v, depth + 1, seen);
  }
};
walk(token);
const lost = Object.keys(kinds);
line(lost.length
  ? `values JSON cannot carry, found on the live token:\n  ${lost.join('\n  ')}`
  : 'no functions or Maps on the token (JSON keeps its SHAPE)');

// Reference identity is the other half: the token points AT schedule/roster objects that
// also live in state.world. JSON.stringify turns every shared reference into an independent
// copy, so after a reload the token mutates orphans and the world never sees the result.
const sched = (state.schedule || []).flat?.() || [];
const gameObj = pending.game;
const inSchedule = sched.includes ? sched.includes(gameObj) : false;
line(`pending.game is the same object as the one in state.schedule: ${inSchedule}`);
line(`pending.home is the same object as world.schools entry     : ${world.schools.includes(pending.home)}`);
line('');

// ── the round trip ─────────────────────────────────────────────────────────
let snapshot;
try {
  snapshot = JSON.parse(JSON.stringify(state, (k, v) => (k === 'roleRatings' ? undefined : v)));
} catch (e) {
  line(`SERIALIZE THREW: ${e.message}`);
  process.exit(1);
}
line('serialized OK (JSON.stringify does not throw — the corruption is silent)');
// Pristine copy: the drains below mutate `snapshot` in place, and FIX 2 needs the save as
// it was WRITTEN, not as it was left after being played wrong.
const snapshotPristine = JSON.parse(JSON.stringify(snapshot));

const before = {
  wins: ps.record?.wins ?? 0, losses: ps.record?.losses ?? 0,
  day: state.day,
};

// Route the resume by what the pause actually IS. Calling resumeFromHalftime on a token
// frozen on an asked snap is a no-op, which would make both sides of this comparison look
// equally broken and prove nothing.
const resumeIt = (st) => {
  const k = st.pendingHalftime?.token?.pending?.kind;
  if (k === 'fourth') return resumeFromFourthDown(st, 'auto');
  if (st.pendingHalftime?.token?.pending) return resumeFromPlayCall(st, { concept: 'sheet' });
  return resumeFromHalftime(st, () => {});
};

// THE smoking gun, checked before anything is resumed: inside the live state the paused
// game and the schedule's entry for it are ONE object, so finishing the game writes the
// result where the season can see it. JSON.parse(JSON.stringify(...)) turns every shared
// reference into an independent copy — so after a reload the resume mutates an orphan and
// the schedule keeps a game that never happened.
const rsched = (snapshot.schedule || []).flat?.() || [];
const rGame  = snapshot.pendingHalftime?.game;
const stillShared = rsched.some(g => g === rGame);
line('');
line(`after the round trip, pending.game is still the schedule's object: ${stillShared}`);
if (!stillShared) {
  const twin = rsched.find(g => g && rGame && g.day === rGame.day
    && g.homeId === rGame.homeId && g.awayId === rGame.awayId);
  line(`  (the schedule has a separate twin of that game: ${!!twin})`);
}

// One resume answers one snap; in "Every Snap" mode the game asks again immediately. So
// drain: keep answering until the pause clears or we give up. That is what a coach clicking
// through the call sheet does, and the end state is what he actually sees.
const drain = (st, cap = 400) => {
  let n = 0;
  try {
    while (st.pendingHalftime && n < cap) { resumeIt(st); n++; }
  } catch (e) { return { n, err: e }; }
  return { n, err: null };
};

// Resume the RELOADED state, which is what the app does after an unclean exit.
const reloaded = snapshot;
const rRun = drain(reloaded);
const resumeErr = rRun.err;

line('');
line('── resuming the RELOADED save ──');
if (resumeErr) {
  line(`THREW: ${resumeErr.message}`);
} else {
  line('did not throw');
}
const rs = reloaded.world?.schools?.find(s => s.id === reloaded.playerSchoolId);
const rSchedGame = rsched.find(g => g && rGame && g.day === rGame.day
  && g.homeId === rGame.homeId && g.awayId === rGame.awayId);
line(`answers accepted           : ${rRun.n}`);
line(`player record after resume : ${rs?.record?.wins ?? '?'}-${rs?.record?.losses ?? '?'}`);
line(`pendingHalftime cleared    : ${!reloaded.pendingHalftime}`);
line(`SCHEDULE entry has a result: ${!!rSchedGame?.result}   <-- what the season reads`);

// ── control: resume the LIVE state, which is what happens with no save ─────
line('');
line('── control: resuming the LIVE (never-serialized) state ──');
const lRun = drain(state);
line(lRun.err ? `THREW: ${lRun.err.message}` : 'did not throw');
line(`answers accepted           : ${lRun.n}`);
line(`player record after resume : ${ps.record?.wins ?? '?'}-${ps.record?.losses ?? '?'} (was ${before.wins}-${before.losses})`);
line(`pendingHalftime cleared    : ${!state.pendingHalftime}`);
line(`SCHEDULE entry has a result: ${!!gameObj?.result}   <-- what the season reads`);

// ── the fix, both halves ───────────────────────────────────────────────────
line('');
line('── FIX 1: the serializer refuses a live pause ──');
// Re-create the pause (the drains above consumed it) and ask the guard.
const state2 = JSON.parse(JSON.stringify({ ui: {} }));
state2.pendingHalftime = { token: {} };
line(`gamePauseIsLive(paused at a call/halftime) : ${gamePauseIsLive(state2)}`);
line(`gamePauseIsLive(kickoff prompt open)       : ${gamePauseIsLive({ ui: { pendingKickoff: {} } })}`);
line(`gamePauseIsLive(ordinary between-days)     : ${gamePauseIsLive({ ui: {} })}`);
line('  (true = save skipped. The 30s autosave and the pagehide flush both honour this now.)');

line('');
line('── FIX 2: a save already corrupted heals on load + next advance ──');
// Replay the user's actual session on the save as written: load it, play the game out
// through the orphan (which is what the app did before the fix), and see what the season
// is left holding.
const broken = JSON.parse(JSON.stringify(snapshotPristine));
drain(broken);
// Then the coach clicks ADVANCE. Before this fix nothing stopped him: the pause had
// cleared (onto the orphan), so the calendar moved on and left the real schedule entry
// blank — that is the reported "skipped from week 5 to week 9, my team is 0-0". Model
// exactly that: the day moves, the game stays unplayed.
const refDay = broken.day + 1;
broken.day = refDay;
// Everything else on that day DID resolve — only the player's game was orphaned. Fill the
// rest in so the fixture isolates exactly one stranded game instead of manufacturing a
// week of them and flattering the heal.
const isOrphan = g => rGame && g.day === rGame.day
  && g.homeId === rGame.homeId && g.awayId === rGame.awayId;
for (const g of (broken.schedule || [])) {
  if (g.day > refDay || g.result || isOrphan(g)) continue;
  g.result = { homeScore: 21, awayScore: 17, winner: g.homeId };
}
const strandedBefore = (broken.schedule || [])
  .filter(g => g.day < refDay && !g.result);
const mineStranded = strandedBefore.filter(g =>
  g.homeId === broken.playerSchoolId || g.awayId === broken.playerSchoolId);
line(`after the bad resume: day ${refDay}, ${strandedBefore.length} game(s) stranded with no result`);
line(`  of those, the player's own                     : ${mineStranded.length}`);

// Now load it the way the app does and take one ordinary advance.
const healed = rehydrate(JSON.parse(JSON.stringify(broken)));
const pauseClearedOnLoad = !healed.pendingHalftime && !healed.ui?.pendingKickoff;
line(`rehydrate cleared any dead pause               : ${pauseClearedOnLoad}`);
healed.settings = healed.settings || {};
healed._callModeToday = 'off';        // don't re-pause on the catch-up advance
const hEvents = advanceDay(healed, () => {});
const strandedAfter = (healed.schedule || []).filter(g => g.day < refDay && !g.result).length;
const hs = healed.world?.schools?.find(s => s.id === healed.playerSchoolId);
const bs = broken.world?.schools?.find(s => s.id === broken.playerSchoolId);
line(`stranded games after one advance               : ${strandedAfter}`);
line(`player record  ${bs?.record?.wins ?? '?'}-${bs?.record?.losses ?? '?'} (broken) -> ${hs?.record?.wins ?? '?'}-${hs?.record?.losses ?? '?'} (healed)`);
const healEvent = (hEvents || []).find(e => e.type === 'info' && /missing from your schedule/.test(e.text || ''));
line(`the coach is told                              : ${healEvent ? JSON.stringify(healEvent.text) : 'no message'}`);

// NB: healed.pendingHalftime may well be set again after the advance — day 6 has its own
// game and pausing for it is correct. What matters is that the DEAD pause went at load.
const pass = strandedBefore.length > 0 && strandedAfter === 0 && pauseClearedOnLoad;
line('');
line(pass
  ? 'PASS — the corrupt pause is dropped on load and every stranded game is played and booked.'
  : 'CHECK — see the numbers above; the heal did not do what it claims.');
process.exit(pass ? 0 : 1);
