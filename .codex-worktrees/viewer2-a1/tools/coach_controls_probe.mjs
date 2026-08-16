// F1-F3 controls probe (Aug 2026): the opening script, check-with-me, and the
// defensive live-calling loop each demonstrably move the game — and the
// machinery (pending token, resume, standing call) survives a full half.
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame, simulateFirstHalf, resumeFromCall, resumeFromDecision } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
function gen(t, s) { const r = []; for (const [p, c] of Object.entries(ROSTER_TARGETS)) for (let i = 0; i < c; i++) { const x = createPlayer(p, CLASS_YEARS[i % 4], t); x.schoolId = s; r.push(x); } return r; }
const base = (o = {}) => ({ offFormations: [{ id: 'Spread', weight: 60 }, { id: 'Single Back', weight: 40 }], tendency: 'Balanced', rushInPct: 50, passDepth: { short: 35, medium: 40, deep: 25 }, blitzPct: 20, fourthDown: 'Moderate', baseTempo: 'Normal', maxFGDist: 42, ...o });
let fails = 0; const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) fails++; };

// ── F3: an "Always Run" openers cell owns drives 1-2, later drives revert ──
{
  let d12Run = 0, d12N = 0, laterRun = 0, laterN = 0;
  for (let i = 0; i < 8; i++) {
    const rH = gen(1, 'H'), rA = gen(1, 'A');
    const gpH = base({ situations: { openers: { tendency: 'Always Run' } } });
    const res = simulateGame({ id: 'H' }, { id: 'A' }, rH, rA, buildDepthChart(rH, gpH), buildDepthChart(rA, base()), gpH, base());
    let dn = { home: 0, away: 0 };
    for (const d of (res.drives || [])) {
      dn[d.possession]++;
      for (const p of (d.plays || [])) {
        if (d.possession !== 'home') continue;
        const run = String(p.type).startsWith('run'), pass = String(p.type).startsWith('pass');
        if (!run && !pass) continue;
        if (dn.home <= 2) { d12N++; if (run) d12Run++; } else { laterN++; if (run) laterRun++; }
      }
    }
  }
  const r1 = d12Run / Math.max(1, d12N), r2 = laterRun / Math.max(1, laterN);
  ok(r1 > r2 + 0.12, `F3 openers script owns drives 1-2 (run% ${(r1 * 100).toFixed(0)} vs ${(r2 * 100).toFixed(0)} after the handoff)`);
}
// F3 law: no cell = never fires (identical machinery skips on the empty cell).
{
  const gp = base();
  ok(!gp.situations, 'F3 default plan carries no openers cell (zero-migration law)');
}

// ── F2: "vs Empty, bring the house" moves the blitz rate only through the check ──
{
  let blitzChk = 0, nChk = 0, blitzNo = 0, nNo = 0;
  for (let i = 0; i < 8; i++) {
    const rH = gen(1, 'H'), rA = gen(1, 'A');
    const offGP = base({ offFormations: [{ id: 'Empty', weight: 100 }] });
    const defChk = base({ formChecks: { empty: { defAggression: 'house' } } });
    const defNo = base();
    const r1 = simulateGame({ id: 'H' }, { id: 'A' }, rH, rA, buildDepthChart(rH, offGP), buildDepthChart(rA, defChk), offGP, defChk);
    for (const d of (r1.drives || [])) if (d.possession === 'home') for (const p of (d.plays || [])) if (String(p.type).startsWith('pass')) { nChk++; if (p.blitzFired) blitzChk++; }
    const r2 = simulateGame({ id: 'H' }, { id: 'A' }, rH, rA, buildDepthChart(rH, offGP), buildDepthChart(rA, defNo), offGP, defNo);
    for (const d of (r2.drives || [])) if (d.possession === 'home') for (const p of (d.plays || [])) if (String(p.type).startsWith('pass')) { nNo++; if (p.blitzFired) blitzNo++; }
  }
  const b1 = blitzChk / Math.max(1, nChk), b2 = blitzNo / Math.max(1, nNo);
  ok(b1 > b2 + 0.1, `F2 empty-check blitz rate ${(b1 * 100).toFixed(0)}% vs ${(b2 * 100).toFixed(0)}% unchecked`);
}

// ── F1: the defensive ask fires on opponent snaps, resumes, and stamps plays ──
{
  const rH = gen(1, 'H'), rA = gen(1, 'A');
  const token = simulateFirstHalf({ id: 'H', name: 'H' }, { id: 'A', name: 'A' }, rH, rA, buildDepthChart(rH, base()), buildDepthChart(rA, base()), base(), base(), { playerSide: 'home', callMode: 'all' });
  let defAsks = 0, offAsks = 0, guard = 0, wrongSide = 0, standingOK = true;
  let t = token;
  while (t.pending && guard++ < 300) {
    if (t.pending.kind === 'defcall') {
      defAsks++;
      if (t.pending.possession !== 'away') wrongSide++;
      const st = t.pending.drive.sit && t.pending.drive.sit.standing;
      if (!st || st.defAggression == null || !st.baseFront) standingOK = false;
      // Alternate a real call with "ride the plan" — the ride resume must
      // mark the snap answered (the {_ride} sentinel) or this loop never ends.
      if (defAsks % 2) resumeFromCall(t, { _def: true, aggression: 'house', covShell: 'two' });
      else resumeFromCall(t, { concept: 'sheet' });
    } else if (t.pending.kind === 'playcall') { offAsks++; resumeFromCall(t, { concept: 'sheet' }); }
    else resumeFromDecision(t, 'auto');
  }
  const defCoachPlays = (t.drives || []).flatMap((d) => d.plays || []).filter((p) => p.defCoachCall).length;
  ok(defAsks > 5 && offAsks > 5, `F1 both headsets fire in a half (${defAsks} def asks, ${offAsks} off asks)`);
  ok(wrongSide === 0, 'F1 defcall only fires when the opponent has the ball');
  ok(standingOK, 'F1 every defcall pending carries the standing call for the panel');
  ok(defCoachPlays >= Math.floor(defAsks / 2) - 2 && defCoachPlays <= Math.ceil(defAsks / 2) + 2, `F1 only REAL calls stamp defCoachCall — rides don't (${defCoachPlays} of ${defAsks} asks, half were rides)`);
  ok(!t.pending && (t.homeScore != null), 'F1 half completes to a real score after the ask loop');
}
// ── Madden pass (Aug 2026): "all" asks the defensive headset EVERY snap; ──
// ── "keydowns" keeps the original key-down-only cadence.                  ──
{
  const isKeyDown = (d) => d.down >= 3 || d.fieldPos >= 80 || d.clock <= 120;
  const runHalf = (callMode) => {
    const rH = gen(1, 'H'), rA = gen(1, 'A');
    const token = simulateFirstHalf({ id: 'H', name: 'H' }, { id: 'A', name: 'A' }, rH, rA, buildDepthChart(rH, base()), buildDepthChart(rA, base()), base(), base(), { playerSide: 'home', callMode });
    let t = token, guard = 0, defAsks = 0, nonKeyDefAsks = 0;
    while (t.pending && guard++ < 400) {
      if (t.pending.kind === 'defcall') {
        defAsks++;
        if (!isKeyDown(t.pending.drive)) nonKeyDefAsks++;
        resumeFromCall(t, { concept: 'sheet' });
      } else if (t.pending.kind === 'playcall') resumeFromCall(t, { concept: 'sheet' });
      else resumeFromDecision(t, 'auto');
    }
    return { defAsks, nonKeyDefAsks, done: !t.pending };
  };
  const all = runHalf('all'), kd = runHalf('keydowns');
  ok(all.done && kd.done, 'M1 both call modes drain to a finished half');
  ok(all.nonKeyDefAsks > 0, `M1 Every Snap mode asks the defensive headset on ordinary downs too (${all.nonKeyDefAsks} of ${all.defAsks} asks were non-key)`);
  ok(kd.nonKeyDefAsks === 0, `M1 Key Downs mode never asks defense outside key downs (${kd.defAsks} asks, all key)`);
  ok(all.defAsks > kd.defAsks, `M1 cadence actually widens (${all.defAsks} every-snap asks vs ${kd.defAsks} key-down asks)`);
  // The zoneStyle standing field the new ZONE RULES row displays must ride the pending.
  const rH = gen(1, 'H'), rA = gen(1, 'A');
  let t = simulateFirstHalf({ id: 'H', name: 'H' }, { id: 'A', name: 'A' }, rH, rA, buildDepthChart(rH, base()), buildDepthChart(rA, base()), base(), base(), { playerSide: 'home', callMode: 'all' });
  let sawZone = false, guard = 0;
  while (t.pending && guard++ < 400) {
    if (t.pending.kind === 'defcall') { if ('zoneStyle' in (t.pending.drive.sit.standing || {})) sawZone = true; resumeFromCall(t, { concept: 'sheet' }); }
    else if (t.pending.kind === 'playcall') resumeFromCall(t, { concept: 'sheet' });
    else resumeFromDecision(t, 'auto');
  }
  ok(sawZone, 'M1 standing call now carries zoneStyle for the ZONE RULES row');
}
console.log('');
console.log(fails ? `COACH CONTROLS PROBE: ${fails} FAIL` : 'COACH CONTROLS PROBE PASS');
process.exit(fails ? 1 : 0);
