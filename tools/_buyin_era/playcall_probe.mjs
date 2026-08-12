// playcall_probe.mjs — Rung 6 gate: PLAY CALLING is real and leak-free.
//  1. EVERY SNAP: each asked snap resolves with the coach's exact formation +
//     concept (asks === offensive snaps, stamps match 100% with LOS 'never').
//  2. KEY DOWNS: only key situations ask (3rd/4th, red zone, two-minute), and
//     the sheet still calls the rest.
//  3. Forced RUN concepts stamp through everything (incl. RPO pulls — the
//     Rung 2 law: the pull keeps the huddle's call).
//  4. Gadget calls force their mechanic: Draw / Jet Sweep / Triple Option.
//  5. 'sheet' answers restore the weighted roll (variety returns).
//  6. OFF / absent mode NEVER asks — league sims and old saves can't see any
//     of this by construction (the player-game-only law).
// Run from repo root: node tools/playcall_probe.mjs [gamesPerCell]
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame, simulateFirstHalf, stepSecondHalf, resumeFromCall, resumeFromDecision,
         finishInteractiveGame, callContext, isKeyDownSituation, fourthDownIsMoment, fourthDownIsCoachCall, stepToken } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

const N = parseInt(process.argv[2] || '8', 10);

function genRoster(t, s) {
  const r = [];
  for (const [pos, c] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < c; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], t); p.schoolId = s; r.push(p); }
  }
  return r;
}
const mk = (o = {}) => ({ offFormations: [{ id: 'Spread', weight: 50 }, { id: 'Single Back', weight: 50 }],
  tendency: 'Balanced', rushInPct: 60, passDepth: { short: 40, medium: 40, deep: 20 },
  blitzPct: 20, fourthDown: 'Moderate', baseTempo: 'Normal', maxFGDist: 42, ...o });
const sH = { id: 'H', name: 'H' }, sA = { id: 'A', name: 'A' };

// Drive one full game through the token: answer every asked snap with callFn,
// every asked 4th down with fourthFn ('auto' = the sheet's chart). Tracks the
// go → call-sheet chain: a GO must be followed by the 4th-down play ask.
function runCalledGame(mode, callFn, offGP = {}, defGP = {}, fourthFn = null) {
  const rH = genRoster(1, 'H'), rA = genRoster(1, 'A');
  const token = simulateFirstHalf(sH, sA, rH, rA, buildDepthChart(rH, mk()), buildDepthChart(rA, mk()),
    mk(offGP), mk(defGP), { playerSide: 'home', callMode: mode });
  let asks = 0, fourths = 0, chainTotal = 0, chainHits = 0;
  const sits = [], fourthSits = [];
  const drain = () => {
    let guard = 0;
    while (token.pending) {
      if (token.pending.kind === 'fourth') {
        fourths++;
        const p = token.pending;
        fourthSits.push({ ...p.drive.sit, down: p.drive.down, distance: p.drive.distance,
                          fieldPos: p.drive.fieldPos, half: p.half });
        const dec = fourthFn ? fourthFn(p) : 'auto';
        const clockAtAsk = p.clock;
        resumeFromDecision(token, dec);
        // The chain law holds whenever there is time left; a GO answered at
        // 0:00 correctly never snaps (the gun beat the offense to the line).
        if (dec === 'go' && clockAtAsk > 0) {
          chainTotal++;
          if (token.pending?.kind === 'playcall' && callContext(token)?.down === 4) chainHits++;
        }
      } else if (token.pending.kind === 'playcall') {
        const ctx = callContext(token);
        sits.push(ctx); asks++;
        resumeFromCall(token, callFn(ctx));
      } else throw new Error('unknown pending kind: ' + token.pending.kind);
      if (++guard > 600) throw new Error('pending never drains');
    }
  };
  drain();                                   // H1 (stops at the locker room)
  if (token.stage !== 2) throw new Error('token did not stop at halftime, stage=' + token.stage);
  stepSecondHalf(token);                     // H2
  drain();
  const result = finishInteractiveGame(token);
  return { token, result, asks, sits, fourths, fourthSits, chainTotal, chainHits };
}
// Offensive snaps for one side — OT included (since the OT-with-the-headset
// polish, a tied token game's OT drive asks like any other, so its snaps
// belong in the asks===snaps ledger too).
const offSnaps = (result, side = 'home') => (result.drives || [])
  .filter(d => d.possession === side)
  .flatMap(d => d.plays || [])
  .filter(p => String(p.type).startsWith('pass') || String(p.type).startsWith('run'));

// Pre-snap flags on one side's possessions. Each one now ends the play and
// reopens the sheet, so in every-snap mode it adds exactly one ask on top of
// the resolved snaps — the ask ledger is snaps + flags, not snaps alone.
const preSnapFlags = (result, side = 'home') => (result.drives || [])
  .filter(d => d.possession === side)
  .flatMap(d => d.plays || [])
  .filter(p => p.type === 'penalty').length;

let fail = 0; const g = (n, ok, d) => { if (!ok) fail++; console.log(`${ok ? '✅' : '❌'} ${n} — ${d}`); };
const pct = (a, b) => b ? Math.round(1000 * a / b) / 10 : 0;

// ── 1. EVERY SNAP, fixed call, LOS 'never' (no audibles) — exact stamps ────
{
  let asks = 0, snaps = 0, formHit = 0, conHit = 0, offeredSpread = 0, coachStamped = 0, flags = 0;
  for (let i = 0; i < N; i++) {
    const r = runCalledGame('all', () => ({ formationId: 'Spread', concept: 'Mesh' }), { losFreedom: 'never' });
    asks += r.asks;
    flags += preSnapFlags(r.result);
    if (r.sits.every(s => (s.formations || []).includes('Spread'))) offeredSpread++;
    const sn = offSnaps(r.result);
    snaps += sn.length;
    for (const p of sn) {
      if (p.offFormation === 'Spread') formHit++;
      if (p.concept === 'Mesh') conHit++;
      if (p.coachCall) coachStamped++;
    }
  }
  g('every-snap mode asks once per snap + once per pre-snap flag', asks === snaps + flags, `${asks} asks / ${snaps} snaps + ${flags} flags`);
  g('called formation lands on 100% of snaps', formHit === snaps, `${formHit}/${snaps}`);
  g('called concept lands on 100% of snaps (LOS never)', conHit === snaps, `${conHit}/${snaps}`);
  g('every resolved snap carries the coachCall stamp', coachStamped === snaps, `${coachStamped}/${snaps}`);
  g('the ask offers the gameplan formations', offeredSpread === N, `${offeredSpread}/${N} games`);
}

// ── 2. KEY DOWNS: only key situations ask; the sheet keeps the rest ───────
{
  let asks = 0, snaps = 0, keySits = 0, audibles = 0, conMiss = 0;
  for (let i = 0; i < N; i++) {
    const r = runCalledGame('keydowns', () => ({ concept: 'Slant-Flat' }));   // LOS auto: audibles allowed
    asks += r.asks;
    keySits += r.sits.filter(s => isKeyDownSituation(s)).length;
    const sn = offSnaps(r.result);
    snaps += sn.length;
    for (const p of sn.filter(p => p.coachCall)) {
      if (p.audible) audibles++;
      else if (p.concept !== 'Slant-Flat') conMiss++;
    }
  }
  g('key-downs asks are a real subset (0 < asks < snaps)', asks > 0 && asks < snaps, `${asks} asks / ${snaps} snaps`);
  g('every key-downs ask IS a key situation', keySits === asks, `${keySits}/${asks}`);
  g('key-downs calls stamp exactly (audibles excepted)', conMiss === 0, `${conMiss} misses, ${audibles} audibles`);
}

// ── 3. Forced RUN concept survives the RPO pull (the Rung 2 law) ──────────
{
  let snaps = 0, hit = 0, rpo = 0;
  for (let i = 0; i < N; i++) {
    const r = runCalledGame('all', () => ({ formationId: 'Spread', concept: 'Power' }), { losFreedom: 'never' });
    const sn = offSnaps(r.result);
    snaps += sn.length;
    for (const p of sn) { if (p.concept === 'Power') hit++; if (p.rpo) rpo++; }
  }
  g('forced run concept stamps 100% (RPO pulls keep it)', hit === snaps, `${hit}/${snaps} (${rpo} RPO pulls)`);
}

// ── 4. Gadget calls force their mechanic ──────────────────────────────────
{
  const cell = (concept, formationId, want) => {
    let snaps = 0, hit = 0;
    for (let i = 0; i < Math.max(2, Math.floor(N / 2)); i++) {
      const r = runCalledGame('all', () => ({ formationId, concept }), { losFreedom: 'never' });
      const sn = offSnaps(r.result);
      snaps += sn.length;
      hit += sn.filter(want).length;
    }
    return { snaps, hit };
  };
  const draw = cell('Draw', 'Spread', p => p.concept === 'Draw' && p.optionPhase === 'draw');
  const jet  = cell('Jet Sweep', 'Spread', p => p.concept === 'Jet Sweep');
  const opt  = cell('Triple Option', 'Flexbone', p => p.concept === 'Triple Option' && ['dive', 'keep', 'pitch'].includes(p.optionPhase));
  g('forced Draw runs the draw mechanic', draw.hit === draw.snaps, `${draw.hit}/${draw.snaps}`);
  g('forced Jet Sweep hands the motion man the ball', pct(jet.hit, jet.snaps) >= 95, `${pct(jet.hit, jet.snaps)}%`);
  g('forced Triple Option runs the read chain', opt.hit === opt.snaps, `${opt.hit}/${opt.snaps}`);
}

// ── 5. 'sheet' answers restore the weighted roll ──────────────────────────
{
  const seen = new Set(); let snaps = 0;
  for (let i = 0; i < N; i++) {
    const r = runCalledGame('all', () => ({ concept: 'sheet' }));
    const sn = offSnaps(r.result);
    snaps += sn.length;
    for (const p of sn) if (p.concept) seen.add(p.concept);
  }
  g("'sheet' calls keep the playbook's variety (6+ concepts)", seen.size >= 6, `${seen.size} distinct over ${snaps} snaps`);
}

// ── 5b. SIMPLIFIED CALLING (Jul 2026): a CATEGORY pins the family, the
// sheet rolls the exact play inside it. The whole point: family obedience
// plus in-family variety.
{
  const famOf = (t) => String(t).startsWith('pass') ? 'pass' : 'run';
  const CASES = [
    ['run_inside',  p => p.type === 'run_inside'],
    ['run_outside', p => p.type === 'run_outside'],
    ['pass_short',  p => p.type === 'pass_short'],
    ['pass_medium', p => p.type === 'pass_medium'],
    ['pass_deep',   p => p.type === 'pass_deep'],
  ];
  let famMiss = 0, total = 0;
  const perCat = {};
  for (const [cat, match] of CASES) {
    const seen = new Set();
    let snaps = 0, hits = 0;
    for (let i = 0; i < Math.max(2, Math.floor(N / 2)); i++) {
      const r = runCalledGame('all', () => ({ category: cat }), { losFreedom: 'never' });
      for (const p of offSnaps(r.result).filter(p2 => p2.coachCall)) {
        snaps++; total++;
        // Carve-outs that are the SIM's legal in-family dressing, not leaks:
        // the option chain crosses inside/outside by design (dive/keep/pitch),
        // RPO pulls ride run calls, and a pass call can end in a scramble.
        const legal = match(p)
          || (cat.startsWith('run') && (p.optionPhase || p.rpo))
          || (cat.startsWith('pass') && p.isScramble);
        if (legal) hits++;
        else { famMiss++; }
        if (p.concept) seen.add(p.concept);
      }
    }
    perCat[cat] = { snaps, hits, distinct: seen.size };
  }
  console.log('category calls:', Object.entries(perCat)
    .map(([c, v]) => `${c}:${v.hits}/${v.snaps} (${v.distinct} plays)`).join(' '));
  g('a called category pins the family (100%, dressing excepted)', famMiss === 0,
    `${total - famMiss}/${total}`);
  g('the sim varies the exact play inside every family (3+ concepts each)',
    CASES.every(([c]) => perCat[c].distinct >= 3),
    CASES.map(([c]) => `${c}:${perCat[c].distinct}`).join(' '));
  g('category snaps still stamp coachCall 1:1',
    CASES.every(([c]) => perCat[c].snaps > 0), 'stamped snaps present per category');
}

// ── 6. OFF / absent mode never asks — the player-game-only law ────────────
{
  const rH = genRoster(1, 'H'), rA = genRoster(1, 'A');
  const t1 = simulateFirstHalf(sH, sA, rH, rA, buildDepthChart(rH, mk()), buildDepthChart(rA, mk()),
    mk(), mk(), { playerSide: 'home', difficulty: 'varsity' });               // no callMode at all
  const t2 = simulateFirstHalf(sH, sA, rH, rA, buildDepthChart(rH, mk()), buildDepthChart(rA, mk()),
    mk(), mk(), { playerSide: 'home', callMode: 'off' });                     // explicit 'off'
  let leaked = 0;
  for (let i = 0; i < 4; i++) {
    const res = simulateGame(sH, sA, genRoster(1, 'H'), genRoster(1, 'A'),
      buildDepthChart(genRoster(1, 'H'), mk()), buildDepthChart(genRoster(1, 'A'), mk()), mk(), mk());
    for (const d of (res.drives || [])) for (const p of (d.plays || [])) if (p.coachCall) leaked++;
  }
  g('no callMode → no pending, no mode on the token', !t1.pending && !t1.callMode, `pending=${!!t1.pending}`);
  g("'off' → straight-through half, no pending", !t2.pending && !t2.callMode, `pending=${!!t2.pending}`);
  g('league simulateGame never sees a coach call', leaked === 0, `${leaked} leaked stamps`);
}

// ── 6b. THE 4TH-DOWN INTEGRATION: the headset owns the coin-flips ─────────
{
  let fourths = 0, moments = 0, chainTotal = 0, chainHits = 0, kdFourths = 0;
  for (let i = 0; i < N; i++) {
    const r = runCalledGame('all', () => ({ concept: 'sheet' }), {}, {}, () => 'go');
    fourths += r.fourths;
    moments += r.fourthSits.filter(s => fourthDownIsCoachCall(s)).length;
    chainTotal += r.chainTotal; chainHits += r.chainHits;
    const k = runCalledGame('keydowns', () => ({ concept: 'sheet' }));
    kdFourths += k.fourths;
  }
  g('4th-down moments ask the headset (both modes)', fourths > 0 && kdFourths > 0,
    `${fourths} every-snap + ${kdFourths} key-downs across ${N} games each`);
  g('every asked 4th down in every-snap mode IS a coach call', moments === fourths, `${moments}/${fourths}`);
  g("a GO rolls straight into the 4th-down play's call sheet", chainTotal > 0 && chainHits === chainTotal,
    `${chainHits}/${chainTotal} chained`);
}

// ── 6c. MID-GAME HEADSET CHANGES: demote to key downs, then all the way off
// (the "sim to next key down" / "headset off — sim to final" buttons: the
// mode rides the token and the ask closures re-read it every snap) ─────────
{
  const rH = genRoster(1, 'H'), rA = genRoster(1, 'A');
  const token = simulateFirstHalf(sH, sA, rH, rA, buildDepthChart(rH, mk()), buildDepthChart(rA, mk()),
    mk(), mk(), { playerSide: 'home', callMode: 'all' });
  let n = 0, badKeydown = 0, asksAfterOff = 0;
  const drain = () => {
    let guard = 0;
    while (token.pending && guard++ < 600) {
      if (token.pending.kind === 'fourth') {
        if (token.callMode === 'off') asksAfterOff++;
        resumeFromDecision(token, 'auto'); continue;
      }
      const ctx = callContext(token);
      n++;
      if (token.callMode === 'off') asksAfterOff++;
      if (n > 6 && token.callMode === 'keydowns' && !isKeyDownSituation(ctx)) badKeydown++;
      if (n === 6) token.callMode = 'keydowns';
      if (n === 12) token.callMode = 'off';
      resumeFromCall(token, { concept: 'sheet' });
    }
  };
  drain();
  if (token.stage === 2 && !token.pending) stepSecondHalf(token);
  drain();
  const done = token.stage === 'done' && !token.pending;
  if (done) finishInteractiveGame(token);
  g('mid-game demote: only key downs ask after the switch', badKeydown === 0, `${badKeydown} loose asks (${n} total)`);
  g('mid-game headset off: silence to the final', asksAfterOff === 0 && done,
    `${asksAfterOff} asks after off, finished=${done}`);
}

// ── 6c2. SIM BY QUARTER (Jul 2026): token.skipUntil mutes the asks until
// the boundary passes, then clears itself — jump out, and the game stops
// for you again in the next quarter. Halftime remains the only stoppage.
{
  let preSkipQ1 = 0, lateQ1 = 0, resumed = 0, cleared = 0, done = 0;
  const M = Math.max(3, Math.floor(N / 2));
  for (let i = 0; i < M; i++) {
    const rH = genRoster(1, 'H'), rA = genRoster(1, 'A');
    const token = simulateFirstHalf(sH, sA, rH, rA, buildDepthChart(rH, mk()), buildDepthChart(rA, mk()),
      mk(), mk(), { playerSide: 'home', callMode: 'all' });
    let skipped = false, guard = 0;
    while (token.stage !== 'done' && guard++ < 900) {
      if (!token.pending) { stepToken(token); continue; }
      const p = token.pending;
      const clock = p.kind === 'fourth' ? p.clock : (p.drive?.sit?.clock ?? 0);
      if (p.half === 1 && clock > 900) {
        preSkipQ1++;
        if (skipped) lateQ1++;                         // an ask leaked through the mute
        if (!skipped) { skipped = true; token.skipUntil = { half: 1, clock: 900 }; }
      } else if (p.half === 1) resumed++;              // asks back on in Q2
      if (p.kind === 'fourth') resumeFromDecision(token, 'auto');
      else resumeFromCall(token, { concept: 'sheet' });
    }
    if (token.stage === 'done') done++;
    if (!token.skipUntil) cleared++;
  }
  g('quarter skip mutes the rest of Q1 (zero leaked asks)', lateQ1 === 0, `${lateQ1} leaks over ${M} games`);
  g('the asks come back on in Q2', resumed > 0, `${resumed} Q2 asks`);
  g('the skip clears itself and the game completes', done === M && cleared === M, `${done}/${M} done, ${cleared}/${M} cleared`);
}

// ── 6d. OVERTIME WITH THE HEADSET ON (forced-OT harness): a tied token-
// stepping game runs its OT drive through the same ask machinery ──────────
{
  const rH = genRoster(1, 'H'), rA = genRoster(1, 'A');
  const token = simulateFirstHalf(sH, sA, rH, rA, buildDepthChart(rH, mk()), buildDepthChart(rA, mk()),
    mk({ losFreedom: 'never' }), mk(), { playerSide: 'home', callMode: 'all' });
  const drainSheet = () => { let g2 = 0; while (token.pending && g2++ < 600) {
    if (token.pending.kind === 'fourth') resumeFromDecision(token, 'auto');
    else resumeFromCall(token, { concept: 'sheet' }); } };
  drainSheet(); stepSecondHalf(token); drainSheet();
  // Force the tie AND the coin flip (coach's ball), then re-enter via 'ot'.
  token.awayScore = token.homeScore;
  token.otIsHome = true;
  token.otState = { clock: 300, fieldPos: 75, half: 3, score: { off: 0, def: 0 } };
  token.stage = 'ot'; token.pending = null;
  stepToken(token);
  let otAsks = 0, g3 = 0;
  while (token.pending && g3++ < 100) {
    if (token.pending.kind === 'fourth') { resumeFromDecision(token, 'auto'); continue; }
    const ctx = callContext(token);
    if (ctx.half === 3 && ctx.quarter === 'OT') otAsks++;
    resumeFromCall(token, { formationId: 'Spread', concept: 'Mesh' });
  }
  const decided = token.homeScore !== token.awayScore;
  const otDrive = token.drives[token.drives.length - 1];
  const otSnaps = (otDrive?.plays || []).filter(p2 => (p2.half || 0) === 3
    && (String(p2.type).startsWith('pass') || String(p2.type).startsWith('run')));
  const otFlags = (otDrive?.plays || []).filter(p2 => (p2.half || 0) === 3 && p2.type === 'penalty').length;
  const r = finishInteractiveGame(token);
  g('forced-OT: the headset stays on in overtime', token.stage === 'done' && otAsks > 0 && otAsks === otSnaps.length + otFlags,
    `${otAsks} OT asks / ${otSnaps.length} OT snaps + ${otFlags} flags`);
  g('forced-OT: called snaps stamp in OT too', otSnaps.every(p2 => p2.concept === 'Mesh' && p2.offFormation === 'Spread'),
    `${otSnaps.filter(p2 => p2.concept === 'Mesh').length}/${otSnaps.length} Mesh`);
  g('forced-OT: sudden victory decides it once', decided && r.homeScore !== r.awayScore
    && r.homeScore === token.homeScore && r.awayScore === token.awayScore,
    `${r.homeScore}-${r.awayScore} (finishGame ran no second OT)`);
}

// ── 7. Season-flow integration: the mode rides ONE game end-to-end through
// advanceDay → call sheet(s) → locker room → call sheet(s) → final gun, and
// a mode-less advance stays the pre-Rung-6 flow exactly ────────────────────
{
  const { generateWorld, generateSchedule, generateRecruitPool } = await import('../js/engine/world.js');
  const { advanceDay, resumeFromHalftime, resumeFromPlayCall, resumeFromFourthDown, playerGameOpponentForDay } =
    await import('../js/engine/season.js');
  const { C } = await import('../js/constants.js');
  const { initBudget } = await import('../js/engine/recruiting.js');
  const world = generateWorld(); world.recruits = generateRecruitPool(world);
  for (const s of world.schools) { if (s.coach) { const sen = s.roster.filter(p => p.classYear === 'SR').length; initBudget(s.coach, Math.max(0, C.ROSTER_SIZE - s.roster.length) + sen); } }
  const ps = world.schools[0];
  const st = { initialized: true, season: 1, day: 4, playerSchoolId: ps.id,
    playerCoach: { id: 'player', schoolId: ps.id, prestige: ps.prestige, reputation: 'C', budget: 0, scholarshipsAvailable: 0, recruitBoard: [], budgetCarryover: 0, seasonRecord: { wins: 0, losses: 0 } },
    world, schedule: generateSchedule(world), playoffs: null, inbox: [], gameLog: [], signingsLog: [], ui: {}, settings: {} };
  ps.coach = st.playerCoach;
  // Walk to the eve of the player's first game (mode-less days must not pause).
  let guard = 0;
  while (!playerGameOpponentForDay(st, st.day + 1) && guard++ < 10) {
    const evs = advanceDay(st, () => {});
    while (st.pendingHalftime) resumeFromHalftime(st);
    if (evs.some(e => e.type === 'playcall')) { g('mode-less advance never asks', false, 'playcall leaked'); break; }
  }
  const opp = playerGameOpponentForDay(st, st.day + 1);
  g('the kickoff helper finds the opponent', !!opp, `day ${st.day + 1} vs ${opp}`);
  st._callModeToday = 'all';
  let evs = advanceDay(st, () => {});
  let calls = 0, sawHalftime = 0, f4 = 0, guard2 = 0;
  const has = (t) => evs?.some(e => e.type === t);
  while ((has('playcall') || has('halftime') || has('fourthdown')) && guard2++ < 300) {
    if (has('playcall')) { evs = resumeFromPlayCall(st, { concept: 'sheet' }); calls++; }
    else if (has('fourthdown')) { evs = resumeFromFourthDown(st, 'auto'); f4++; }
    else { sawHalftime++; evs = resumeFromHalftime(st); }
  }
  const done = evs?.some(e => e.type === 'game') || !!st.schedule.find(x => x.day === st.day && (x.homeId === ps.id || x.awayId === ps.id))?.result;
  g('every-snap game reaches the final through the season flow', done && !st.pendingHalftime, `${calls} calls, ${sawHalftime} locker room`);
  g('calls were asked in BOTH halves', calls > 20 && sawHalftime === 1, `${calls} calls / ${sawHalftime} halftime`);
  g('the kickoff choice is spent with the final gun', st._callModeToday == null, String(st._callModeToday));
}

console.log(fail ? `❌ ${fail} FAILED` : '✅ RUNG 6 PLAY-CALL GATE PASS');
process.exit(fail ? 1 : 0);
