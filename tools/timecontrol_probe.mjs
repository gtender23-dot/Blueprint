// timecontrol_probe.mjs — M4 gate: WATCH / TIME CONTROLS (D7, 2026-08-16).
//
//  1. THE BIG-MOMENT SPEC (isKeyDownSituation, owner-ratified): 4th downs,
//     red-zone trips, inside two minutes, one-score 4th quarter, overtime —
//     and NOT ordinary 3rd downs (they came off the list in the redesign).
//  2. TOGGLE LEVELS HONORED: 'all' asks; 'keydowns' asks ONLY on spec
//     situations; the toggle is changeable MID-GAME in both directions and
//     the cadence follows it immediately (the engine side of the 3-level
//     involvement toggle — WATCH is 'all' + UI auto-answer, so 'all' cadence
//     is its engine contract too).
//  3. SIM POSSESSION (#54): token.skipPoss mutes every ask while that side
//     keeps the ball, clears itself on the change of possession, never leaks
//     across the half, and the game completes with sane records.
//  4. SIM TO HALF / END (#55): token.skipUntil mutes the rest of the half;
//     the halftime/final states land with real drives, plays and scores.
//  5. DRIVE SUMMARIES: driveSummariesFrom covers a skipped stretch exactly —
//     one row per touched drive, lawful possession/result vocabulary, play
//     counts that add up — never silence.
//  6. PAUSE LAW: a pending mid-skip is still a live pause (gamePauseIsLive
//     gates it — the ONLY serialization gate); skip state (skipPoss/skipUntil/
//     _skipAnim) is engine-transient and gone by the final gun, so no new
//     save path and nothing skip-related to serialize.
//  7. OWNER LIVE-TEST 2026-08-17 (bugs #3/#4): a mid-game level switch is
//     honored on the VERY NEXT SNAP, each direction — after keydowns→all,
//     no 1st–3rd-down snap is ever recorded without an ask between two asks;
//     after all→keydowns, the first ask back is on-spec.
//  8. OWNER LIVE-TEST 2026-08-17 (bug #1): sim-to-half pressed WITH a call
//     prompt open lands the HALFTIME seam — zero stray prompts, stage 2 (not
//     'done'/final), stopAfterHalf intact, all plays half 1, _skipAnim (the
//     UI's straight-to-locker-room key) untouched by the engine.
//  9. OWNER LIVE-TEST 2026-08-17 (bugs #1/#2/#3, UI half): source tripwires
//     for the parts node can't click — play-art backed by settings (read at
//     render, survives every per-play board rebuild + halftime), the watch
//     board's call stage auto-advancing, the locker-room path dropping the
//     stale call overlay. The live click-through remains browser-owed.
//
// Run from repo root: node tools/timecontrol_probe.mjs [gamesPerCell]
import { readFileSync } from 'node:fs';
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateFirstHalf, stepSecondHalf, resumeFromCall, resumeFromDecision,
         finishInteractiveGame, isKeyDownSituation, fourthDownIsMoment,
         driveSummariesFrom } from '../js/engine/sim.js';
import { gamePauseIsLive } from '../js/engine/persistence.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

const N = parseInt(process.argv[2] || '6', 10);
let fail = 0;
const g = (name, ok, detail = '') => {
  console.log(`${ok ? '  ✅' : '  ❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fail++;
};

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
const newToken = (mode) => {
  const rH = genRoster(1, 'H'), rA = genRoster(1, 'A');
  return simulateFirstHalf(sH, sA, rH, rA, buildDepthChart(rH, mk()), buildDepthChart(rA, mk()),
    mk(), mk(), { playerSide: 'home', callMode: mode });
};
const askSit = (p) => p.kind === 'fourth'
  ? { ...p.drive.sit, down: p.drive.down, distance: p.drive.distance, fieldPos: p.drive.fieldPos, half: p.half }
  : { ...p.drive.sit, half: p.half };
const answer = (token) => {
  if (token.pending.kind === 'fourth') resumeFromDecision(token, 'auto');
  else resumeFromCall(token, { concept: 'sheet' });
};
// Drive a token to 'done'; onPending may mutate/inspect before the answer.
function drain(token, onPending = null) {
  let guard = 0;
  while (guard++ < 2500) {
    if (token.pending) { if (onPending) onPending(token); answer(token); continue; }
    if (token.stage === 'done') return true;
    if (token.stage === 2 || token.stopAfterHalf === 1) { stepSecondHalf(token); continue; }
    return false;
  }
  return false;
}
const tokenPlayCount = (t) => {
  let n = 0;
  for (const d of t.drives || []) n += (d.plays || []).length;
  if (t.pending?.drive?.plays) n += t.pending.drive.plays.length;
  return n;
};

console.log('== M4 TIME CONTROLS PROBE ==');

// ── 1. The big-moment spec, point by point ─────────────────────────────────
{
  const sc = (o, d) => ({ off: o, def: d });
  g('4th down is a big moment',
    isKeyDownSituation({ down: 4, distance: 1, fieldPos: 50, clock: 1700, half: 1, score: sc(0, 0) }));
  g('an ordinary 3rd down is NOT (came off the list)',
    !isKeyDownSituation({ down: 3, distance: 9, fieldPos: 50, clock: 1700, half: 1, score: sc(0, 0) }));
  g('a red-zone trip is a big moment',
    isKeyDownSituation({ down: 1, distance: 10, fieldPos: 80, clock: 1700, half: 1, score: sc(0, 0) }));
  g('inside two minutes is a big moment (either half)',
    isKeyDownSituation({ down: 1, distance: 10, fieldPos: 40, clock: 120, half: 1, score: sc(0, 0) })
    && isKeyDownSituation({ down: 2, distance: 5, fieldPos: 30, clock: 90, half: 2, score: sc(0, 21) }));
  g('a one-score 4th quarter is all big moments',
    isKeyDownSituation({ down: 1, distance: 10, fieldPos: 40, clock: 899, half: 2, score: sc(14, 10) })
    && isKeyDownSituation({ down: 2, distance: 8, fieldPos: 25, clock: 400, half: 2, score: sc(10, 17) }));
  g('a two-score 4th quarter is not (until 2:00)',
    !isKeyDownSituation({ down: 1, distance: 10, fieldPos: 40, clock: 899, half: 2, score: sc(24, 10) }));
  g('the 3rd quarter is not the 4th',
    !isKeyDownSituation({ down: 1, distance: 10, fieldPos: 40, clock: 901, half: 2, score: sc(14, 10) }));
  g('overtime is all big moments',
    isKeyDownSituation({ down: 1, distance: 10, fieldPos: 40, clock: 290, half: 3, score: sc(0, 0) }));
}

// ── 2. Toggle levels honored + changeable mid-game ─────────────────────────
{
  let allAsks = 0, allDone = 0;
  for (let i = 0; i < Math.max(2, Math.floor(N / 3)); i++) {
    const t = newToken('all');
    let asks = 0;
    if (drain(t, () => { asks++; })) allDone++;
    if (asks > 20) allAsks++;
  }
  const M = Math.max(2, Math.floor(N / 3));
  g("'all' asks every controlled snap and completes", allDone === M && allAsks === M);

  let offSpec = 0, keyAsks = 0, keyDone = 0, badFourth = 0;
  for (let i = 0; i < N; i++) {
    const t = newToken('keydowns');
    const ok = drain(t, (tok) => {
      keyAsks++;
      const sit = askSit(tok.pending);
      if (tok.pending.kind === 'fourth') { if (!fourthDownIsMoment(sit)) badFourth++; }
      else if (!isKeyDownSituation(sit)) offSpec++;
    });
    if (ok) keyDone++;
  }
  g("'keydowns' asks ONLY on the big-moment spec", offSpec === 0, `${offSpec} off-spec of ${keyAsks} asks`);
  g("'keydowns' 4th-down asks are 4th-down moments", badFourth === 0, `${badFourth} bad`);
  g("'keydowns' games complete", keyDone === N, `${keyDone}/${N}`);

  // Mid-game switch, both directions: keydowns → all must eventually ask on a
  // non-key snap; all → keydowns must never ask off-spec again.
  let sawNonKey = 0, offSpecAfterBack = 0, switchDone = 0;
  for (let i = 0; i < Math.max(3, Math.floor(N / 2)); i++) {
    const t = newToken('keydowns');
    let phase = 0; // 0: keydowns, 1: all, 2: keydowns again
    const ok = drain(t, (tok) => {
      const sit = askSit(tok.pending);
      const nonKey = tok.pending.kind !== 'fourth' && !isKeyDownSituation(sit);
      if (phase === 0) { tok.callMode = 'all'; phase = 1; return; }
      if (phase === 1) {
        if (nonKey) { sawNonKey++; tok.callMode = 'keydowns'; phase = 2; }
        return;
      }
      if (nonKey) offSpecAfterBack++;
    });
    if (ok) switchDone++;
  }
  const M2 = Math.max(3, Math.floor(N / 2));
  g('mid-game switch → EVERY PLAY takes effect (a non-key snap asks)', sawNonKey === M2, `${sawNonKey}/${M2}`);
  g('mid-game switch back → MOMENTS goes quiet off-spec again', offSpecAfterBack === 0, `${offSpecAfterBack} leaks`);
  g('switched games complete', switchDone === M2, `${switchDone}/${M2}`);
}

// ── 3. Sim possession (#54): silent to the change of possession ────────────
{
  let leaks = 0, flipsOk = 0, skips = 0, cleared = 0, done = 0, paused = 0;
  const M = Math.max(3, Math.floor(N / 2));
  for (let i = 0; i < M; i++) {
    const t = newToken('all');
    let skipFrom = null; // possession we asked to skip
    const ok = drain(t, (tok) => {
      const poss = tok.pending.possession;
      if (skipFrom == null && tok.pending.kind === 'playcall') {
        // the live pause is a live pause — the save gate must see it
        if (gamePauseIsLive({ pendingHalftime: { token: tok } })) paused++;
        skipFrom = poss;
        skips++;
        tok.skipPoss = poss;
        tok._skipAnim = { fromPlays: tokenPlayCount(tok) };
        return;
      }
      if (skipFrom != null && poss === skipFrom && tok.skipPoss === skipFrom) leaks++;
      if (skipFrom != null && poss !== skipFrom) { flipsOk++; skipFrom = null; }
    });
    if (ok) done++;
    if (!t.skipPoss && !t.skipUntil) cleared++;
  }
  g('possession skip never asks while that side keeps the ball', leaks === 0, `${leaks} leaks over ${skips} skips`);
  g('the next ask comes on the other side of the ball (or the break)', flipsOk + (done - flipsOk) >= 0 && done === M, `${flipsOk} flips, ${done}/${M} done`);
  g('skip state is gone by the final gun', cleared === M, `${cleared}/${M}`);
  g('a mid-skip pending is a LIVE pause (gamePauseIsLive)', paused === skips, `${paused}/${skips}`);
}

// ── 4 + 5. Sim to half/end skips the asks, lands real records + summaries ──
{
  let h1Leaks = 0, h2Leaks = 0, done = 0, saneRecords = 0, sumOk = 0, sumRows = 0, resultOk = 0;
  const M = Math.max(3, Math.floor(N / 2));
  const KNOWN = new Set(['touchdown', 'field_goal', 'punt', 'turnover', 'turnover_on_downs',
    'missed_fg', 'safety', 'punt_return_td', 'end_half', 'live']);
  for (let i = 0; i < M; i++) {
    const t = newToken('all');
    let armed = 0; // 0: not yet, 1: H1 skip armed, 2: H2 skip armed
    let from = null, summaries = null;
    const ok = drain(t, (tok) => {
      const p = tok.pending;
      if (armed === 0 && p.kind === 'playcall' && p.half === 1) {
        from = tokenPlayCount(tok);
        tok.skipUntil = { half: 1, clock: 0 };
        tok._skipAnim = { fromPlays: from };
        armed = 1;
        return;
      }
      if (armed === 1 && p.half === 1) { h1Leaks++; return; }
      if (armed === 1 && p.half === 2) {
        // first stop after the break — the skipped H1 stretch summarizes here
        summaries = driveSummariesFrom(tok, from);
        armed = 2;
        tok.skipUntil = { half: 2, clock: 0 };
        return;
      }
      if (armed === 2 && p.half === 2) h2Leaks++;
    });
    if (ok) done++;
    // records: every drive carries a possession + plays; scores are sane
    const drivesOk = (t.drives || []).length > 4 && (t.drives || []).every((d) =>
      (d.possession === 'home' || d.possession === 'away') && Array.isArray(d.plays));
    const scoresOk = t.homeScore >= 0 && t.awayScore >= 0 && t.homeScore + t.awayScore <= 150;
    if (drivesOk && scoresOk) saneRecords++;
    if (summaries && summaries.length >= 1
      && summaries.every((s) => (s.poss === 'home' || s.poss === 'away') && s.plays > 0
        && Number.isFinite(s.yards) && (s.result == null || KNOWN.has(s.result)))) {
      sumOk++;
      sumRows += summaries.length;
    }
    const r = finishInteractiveGame(t);
    if (r && r.homeScore === t.homeScore && r.awayScore === t.awayScore && Array.isArray(r.drives)) resultOk++;
  }
  g('sim-to-half mutes the rest of H1 (zero leaked asks)', h1Leaks === 0, `${h1Leaks} leaks`);
  g('sim-to-end mutes the rest of H2 (OT excepted)', h2Leaks === 0, `${h2Leaks} leaks`);
  g('skipped games complete', done === M, `${done}/${M}`);
  g('the record is real: drives, plays, sane scores', saneRecords === M, `${saneRecords}/${M}`);
  g('the skipped stretch summarizes — one lawful row per touched drive, never silence',
    sumOk === M && sumRows >= M, `${sumOk}/${M} games, ${sumRows} rows`);
  g('finishInteractiveGame agrees with the token', resultOk === M, `${resultOk}/${M}`);
}

// ── 6. Pause law: no skip field survives to serialization time ─────────────
{
  const t = newToken('all');
  drain(t, (tok) => {
    if (!tok._m4once && tok.pending.kind === 'playcall') {
      tok._m4once = 1;
      tok.skipPoss = tok.pending.possession;
      tok.skipUntil = { half: tok.pending.half, clock: 0 };
      tok._skipAnim = { fromPlays: tokenPlayCount(tok) };
    }
  });
  const clean = !t.skipPoss && !t.pending;
  g('after the final gun nothing skip-related lingers on the token (no new save surface)',
    clean, `skipPoss=${String(t.skipPoss)} pending=${!!t.pending}`);
  g('a finished game is NOT a live pause', !gamePauseIsLive({ pendingHalftime: null }));
}

// ── 7. Owner live-test (bugs #3/#4): the switch bites on the VERY NEXT snap ─
{
  const M = Math.max(3, Math.floor(N / 2));
  const flatPlays = (t) => {
    const out = [];
    for (const d of t.drives || []) for (const p of d.plays || []) out.push(p);
    if (t.pending?.drive?.plays) out.push(...t.pending.drive.plays);
    return out;
  };
  let flips = 0, slipped = 0, windows = 0, backFlips = 0, backOffSpec = 0, done = 0;
  for (let i = 0; i < M; i++) {
    const t = newToken('keydowns');
    let mode = 'key';    // key → all (windows audited) → back (first ask audited)
    let prev = null;     // play count at the last audited answer
    let winsLeft = 3;    // audit three consecutive ask-to-ask windows in 'all'
    const ok = drain(t, (tok) => {
      const p = tok.pending;
      if (mode === 'key') {
        if (p.kind !== 'playcall' || p.half !== 1) return;
        tok.callMode = 'all';           // exactly what setInvolvement writes
        prev = tokenPlayCount(tok);
        mode = 'all';
        flips++;
        return;
      }
      if (mode === 'all') {
        // Between the last answered snap and THIS ask, every scrimmage snap
        // must itself have asked — i.e. nothing at down 1–3 slips through.
        // (Index `prev` is the answered snap; kickoff rows ride at down 0;
        // an un-asked 4th-down resolution rides at down 4.)
        const cur = tokenPlayCount(tok);
        const between = flatPlays(tok).slice(prev + 1, cur);
        if (between.some((pl) => pl.down >= 1 && pl.down <= 3)) slipped++;
        windows++;
        prev = cur;
        if (--winsLeft <= 0) { tok.callMode = 'keydowns'; mode = 'back'; backFlips++; }
        return;
      }
      if (mode === 'back') {
        // the FIRST ask after switching back must already be on-spec
        const sit = askSit(p);
        if (p.kind === 'fourth') { if (!fourthDownIsMoment(sit)) backOffSpec++; }
        else if (!isKeyDownSituation(sit)) backOffSpec++;
        mode = 'quiet';
      }
    });
    if (ok) done++;
  }
  g('switch → EVERY: no 1st–3rd-down snap ever passes un-asked (next-snap honored)',
    flips === M && slipped === 0, `${slipped} slips over ${windows} ask windows, ${flips}/${M} flips`);
  g('switch back → MOMENTS: the first ask back is already on-spec',
    backFlips === M && backOffSpec === 0, `${backOffSpec} off-spec of ${backFlips} first-asks`);
  g('next-snap games complete', done === M, `${done}/${M}`);
}

// ── 8. Owner live-test (bug #1): sim-to-half WITH a call prompt open ───────
{
  const M = Math.max(3, Math.floor(N / 2));
  let armed = 0, strays = 0, seamOk = 0, h1Only = 0, keyIntact = 0, done = 0;
  for (let i = 0; i < M; i++) {
    const t = newToken('all');
    let guard = 0;
    while (guard++ < 400 && t.pending && !(t.pending.kind === 'playcall' && t.pending.half === 1)) answer(t);
    if (!(t.pending && t.pending.kind === 'playcall' && t.pending.half === 1)) continue;
    armed++;
    // the owner's repro: the ⏭⏭ button pressed while the sheet is asking —
    // exactly what simToBreak arms before answering with the plan.
    t.skipUntil = { half: 1, clock: 0 };
    t._skipAnim = { fromPlays: tokenPlayCount(t) };
    answer(t);
    guard = 0;
    while (t.pending && guard++ < 400) { strays++; answer(t); }
    // the HALFTIME seam, not final: stage 2, stop-after-half intact, no pending
    if (t.stage === 2 && t.stopAfterHalf === 1 && !t.pending) seamOk++;
    // the record at the seam is a FIRST HALF — the "scoreboard phase" truth
    if ((t.drives || []).every((d) => (d.plays || []).every((pl) => pl.half == null || pl.half === 1))) h1Only++;
    // the UI's straight-to-locker-room routing key is untouched by the engine
    if (t._skipAnim) keyIntact++;
    t._skipAnim = null;
    stepSecondHalf(t);
    if (drain(t)) done++;
  }
  g('sim-to-half with a pending call: ZERO stray prompts before the break', armed === M && strays === 0, `${strays} strays, ${armed}/${M} armed`);
  g('…lands the halftime seam (stage 2, stopAfterHalf) — never final', seamOk === M, `${seamOk}/${M}`);
  g('…the record at the seam is all first-half plays', h1Only === M, `${h1Only}/${M}`);
  g('…the locker-room routing key (_skipAnim) survives to the seam', keyIntact === M, `${keyIntact}/${M}`);
  g('…and the game still completes after the break', done === M, `${done}/${M}`);
}

// ── 9. Owner live-test (UI half): source tripwires for what node can't click ─
// These pin the FIX SHAPE in js/ source; the live click-through is browser-owed.
{
  const app = readFileSync(new URL('../js/ui/app.js', import.meta.url), 'utf8');
  const st = readFileSync(new URL('../js/state.js', import.meta.url), 'utf8');
  g('play-art: the per-board `art: false` reset is GONE from the watch initializer',
    !/\bart:\s*false\b/.test(app));
  g('play-art: the watch-bar button is backed by state.settings.watchArt (read at render — survives every per-play rebuild + halftime)',
    app.includes('state.settings.watchArt'));
  g('play-art: the pre-snap overlay plan reads state.settings at render (presnapArt)',
    app.includes('presnapArt'));
  g('watch gate: the call stage auto-advances regardless of autoRun (no Continue trap)',
    !app.includes('=== "call" && !state.ui.autoRun'));
  g('sim-to-half: the straight-to-locker-room path drops the stale call overlay',
    /skipTok\._skipAnim = null;[\s\S]{0,900}state\.ui\.liveWatch = null;[\s\S]{0,100}state\.ui\.showHalftime = true;/.test(st));
  g('sim-to-end: the straight-to-box-score paths drop the stale call overlay',
    (st.match(/state\.ui\.liveWatch = null;\s*(?:\/\/[^\n]*\n\s*)*state\.ui\.showGameResult = true;/g) || []).length >= 2);
}

console.log(fail ? `\n❌ ${fail} TIME-CONTROL FAILURES` : '\n✅ M4 TIME CONTROLS PASS');
process.exit(fail ? 1 : 0);
