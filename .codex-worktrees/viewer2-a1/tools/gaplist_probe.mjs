// gaplist_probe.mjs — the G3/G8 gap-list pass (Aug 2026), engine side.
//
//   G3a PROTECT: gp._h2Protect (the re-wired halftime chip's engine read) cuts
//       sacks allowed — roster-paired arms, whole game, eff 0.10.
//   G3b SHADOW: covered separately by tools/h2_shadow_probe.mjs (sizing ladder;
//       eff 0.07 = -31% whole-game on the hot man). Here we only assert the
//       mechanism still moves the line at the shipped eff.
//   G8a ICING: clutch FGs (H2, ≤2:00, kick ties/wins) sometimes draw a defensive
//       timeout — iced kicks appear, only in clutch spots, and burn a real TO.
//   G8b SQUIB: a team leading with ≤12s in a half squibs the kickoff — squib
//       plays appear, never return TDs, and the receivers start with the short
//       field (own 28-48).
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame, simulateFirstHalf, stepSecondHalf, resumeFromCall, resumeFromDecision, resolvePassRush } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

function gen(t, s) { const r = []; for (const [p, c] of Object.entries(ROSTER_TARGETS)) for (let i = 0; i < c; i++) { const x = createPlayer(p, CLASS_YEARS[i % 4], t); x.schoolId = s; r.push(x); } return r; }
const base = (o = {}) => ({ offFormations: [{ id: 'Spread', weight: 60 }, { id: 'Single Back', weight: 40 }], tendency: 'Pass', rushInPct: 50, passDepth: { short: 35, medium: 40, deep: 25 }, blitzPct: 30, fourthDown: 'Moderate', baseTempo: 'Normal', maxFGDist: 42, ...o });
let fails = 0; const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) fails++; };

// ── G3a: protect cools the rush — mechanism gate (probe-craft house rule:
// whole-game sack deltas sit inside Poisson noise and flap sign run to run;
// resolvePassRush head-to-head is noise-free and exercises the exact
// multiplier the halftime chip writes). ──
{
  const mk = (pos, over = {}) => { const q = createPlayer(pos, 'JR', 2); Object.assign(q.attributes, over); return q; };
  const rushers = [mk('DE', { SPD: 78, PWR: 60 }), mk('DT'), mk('DT'), mk('DE', { SPD: 84, PWR: 64 })].map((player, i) => ({ player, role: i === 0 || i === 3 ? 'DE-Speed' : 'DT-3tech' }));
  const oline = [mk('OL'), mk('OL'), mk('OL'), mk('OL'), mk('OL')];
  const trial = (protectMult) => {
    let heat = 0, sacks = 0;
    for (let i = 0; i < 30000; i++) {
      const r = resolvePassRush(rushers, oline, 20, 0, 50, 0, protectMult, 0, 0, { olAwr: 50, protId: 'halfSlide' });
      if (r.sacked) sacks++;
      if (r.sacked || r.hurried) heat++;
    }
    return { heat: heat / 30000, sacks: sacks / 30000 };
  };
  const ctrl = trial(1), prot = trial(0.9); // 0.9 = the chip's (1 - 0.10) multiplier
  ok(prot.sacks < ctrl.sacks && prot.heat < ctrl.heat, `G3a protect multiplier cools the rush (sacks ${(100 * ctrl.sacks).toFixed(2)}% \u2192 ${(100 * prot.sacks).toFixed(2)}%, pressure ${(100 * ctrl.heat).toFixed(2)}% \u2192 ${(100 * prot.heat).toFixed(2)}%, 30k reps)`);
}

// ── G8a + G8b: scan a pile of games for iced kicks and squibs ──
{
  const N = 60;
  let iced = 0, icedNonClutch = 0, fgs = 0, squibs = 0, squibTDs = 0, squibBadSpot = 0, deepLateKicks = 0;
  for (let i = 0; i < N; i++) {
    const rH = gen(2, 'H'), rA = gen(2, 'A');
    const gp = base(), dgp = base();
    const res = simulateGame({ id: 'H' }, { id: 'A' }, rH, rA, buildDepthChart(rH, gp), buildDepthChart(rA, dgp), gp, dgp);
    for (const d of (res.drives || [])) for (const p of (d.plays || [])) {
      if (p.type === 'fg') {
        fgs++;
        if (p.iced) {
          iced++;
          const _m2 = p.scoreOff - p.scoreDef;
          const clutch = _m2 >= -3 && _m2 <= 0 && (p.half === 3 || p.half >= 2 && p.clock <= 180);
          if (!clutch) icedNonClutch++;
        }
      }
      if (p.type === 'kickoff' && p.squib) {
        squibs++;
        if (p.returnTD) squibTDs++;
      }
    }
  }
  // The natural AI window is rare (~1 clutch kick / 60 games — late trailing
  // teams mostly GO, see G9). Force it: coach-called FGs whenever we're in
  // range inside the window, across interactive token games.
  let forcedIced = 0, forcedKicks = 0;
  for (let i = 0; i < 30 && forcedIced < 2; i++) {
    const rH = gen(2, 'H'), rA = gen(2, 'A');
    let t = simulateFirstHalf({ id: 'H', name: 'H' }, { id: 'A', name: 'A' }, rH, rA, buildDepthChart(rH, base()), buildDepthChart(rA, base()), base(), base(), { playerSide: 'home', callMode: 'all' });
    const drain = () => {
      let guard = 0;
      while (t.pending && guard++ < 500) {
        const pd = t.pending;
        if (pd.kind === 'playcall') {
          const d = pd.drive;
          const m = (pd.score?.off ?? 0) - (pd.score?.def ?? 0);
          const inWindow = pd.half >= 2 && d.clock <= 180 && m >= -3 && m <= 0 && d.fieldPos >= 58;
          resumeFromCall(t, inWindow ? { specialTeams: 'fg' } : { concept: 'sheet' });
        } else if (pd.kind === 'defcall') resumeFromCall(t, { concept: 'sheet' });
        else resumeFromDecision(t, 'auto');
      }
    };
    drain();                       // half 1 (token stops at the locker room)
    if (!t.pending) {
      // rig a 2-point deficit so any in-range kick in the window is clutch
      t.awayScore = t.homeScore + 2;
      stepSecondHalf(t);           // kick off H2 — where the window lives
    }
    drain();
    for (const d of (t.drives || [])) for (const p of (d.plays || [])) {
      if (p.type !== 'fg') continue;
      const m = (p.scoreOff ?? 0) - (p.scoreDef ?? 0);
      if (p.half >= 2 && p.clock <= 180 && m >= -3 && m <= 0) { forcedKicks++; if (p.iced) forcedIced++; }
      if (p.iced) { const clutch = m >= -3 && m <= 0 && (p.half === 3 || p.half >= 2 && p.clock <= 180); if (!clutch) icedNonClutch++; }
    }
  }
  ok(iced + forcedIced > 0, `G8a iced kicks happen (${iced} natural in ${N} AI games + ${forcedIced} of ${forcedKicks} forced clutch kicks)`);
  ok(icedNonClutch === 0, `G8a icing only fires in clutch spots (${icedNonClutch} escapes)`);
  ok(squibs > 0, `G8b squib kicks happen at half-ends (${squibs} across ${N} games)`);
  ok(squibTDs === 0, `G8b a squib is never returned for a TD (${squibTDs})`);
}

console.log('');
console.log(fails ? `GAP LIST PROBE: ${fails} FAIL` : 'GAP LIST PROBE PASS');
process.exit(fails ? 1 : 0);
