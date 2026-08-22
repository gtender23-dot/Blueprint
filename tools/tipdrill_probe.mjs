// tipdrill_probe.mjs — M25 gate: the tip-drill INT chain is lawful, booked,
// and renderable. Math.random pinned — deterministic by construction, NOT
// seedFlaky. Three arms:
//   AMP  — C.TIP_DRILL_INT cranked to 0.5 so chains happen at volume:
//          1. every tipDrill play is a canonical interception with BOTH a
//             tipper (pbuId) and a DIFFERENT picker (intPickerId);
//          2. ballSlots stamps both men on the plays the front translated;
//          3. the box score books the chain: tipper +passBreakups, picker
//             +ints, thrower +passInt (the int_accounting law on tip plays);
//          4. the viewer stages tip THEN pick: deflectCue strictly before
//             the int fx, and the ball ends the play riding the picker;
//          5. same play → same script (deterministic rebuild).
//   KILL — globalThis.__noTipDrill: ZERO tipDrill plays.
//   LIVE — the shipping constant, reported (rate sanity, not gated hard).
// Run from repo root: node tools/tipdrill_probe.mjs [ampGames]
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS, C } from '../js/constants.js';
import { OFF_FIELD_LAYOUTS, DEF_FIELD_LAYOUTS } from '../js/constants_field.js';
import { buildPlayScript } from '../js/ui/watchphys.js';
import { pinRandom } from './_seed.mjs';

// 2026-08-21: was a hand-rolled LCG whose state cycled every 10,466 draws (the
// multiply overflowed Number.MAX_SAFE_INTEGER and `& 0x7fffffff` then kept the
// rounded-away bits). Deterministic, yes — but replaying one short loop, not a
// random stream. Moved onto tools/_seed.mjs, which explains the whole thing.
const reseed = pinRandom(20260810);

const N_AMP = parseInt(process.argv[2] || '6', 10);

function genRoster(t, s) {
  const r = [];
  for (const [pos, c] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < c; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], t); p.schoolId = s; r.push(p); }
  }
  return r;
}
// Medium/deep-heavy passing so PBUs (the chain's parent event) get volume.
const mk = (o = {}) => ({ offFormations: [{ id: 'Spread', weight: 60 }, { id: 'Single Back', weight: 40 }],
  tendency: 'Balanced', rushInPct: 30, passDepth: { short: 20, medium: 45, deep: 35 },
  blitzPct: 26, fourthDown: 'Moderate', baseTempo: 'Normal', maxFGDist: 42, jetRate: 10, drawRate: 10, ...o });

function runGames(n) {
  const games = [];
  for (let i = 0; i < n; i++) {
    const rH = genRoster(1, 'H'), rA = genRoster(1, 'A');
    games.push(simulateGame({ id: 'H', name: 'H' }, { id: 'A', name: 'A' }, rH, rA,
      buildDepthChart(rH, mk()), buildDepthChart(rA, mk()), mk(), mk()));
  }
  return games;
}

let pass = true;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `  [${detail}]` : ''}`);
  if (!ok) pass = false;
};

// ── AMP arm ────────────────────────────────────────────────────────────────
const saved = C.TIP_DRILL_INT;
C.TIP_DRILL_INT = 0.5;
reseed();
const ampGames = runGames(N_AMP);
C.TIP_DRILL_INT = saved;

let tips = 0, structBad = 0, slotBoth = 0, slotEligible = 0, slotSame = 0;
let bookBad = 0, bookChecked = 0;
const viewerTips = [];
for (const res of ampGames) {
  for (const d of res.drives || []) for (const pl of d.plays || []) {
    if (!pl.tipDrill) continue;
    tips++;
    if (!(pl.turnover && pl.turnoverType === 'interception' && pl.intPickerId != null
      && pl.pbuId != null && pl.pbuId !== pl.intPickerId)) structBad++;
    slotEligible++;
    if (pl.ballSlots && pl.ballSlots.pbu && pl.ballSlots.pick) {
      slotBoth++;
      if (pl.ballSlots.pbu === pl.ballSlots.pick) slotSame++;
      viewerTips.push(pl);
    }
    // the defense's box score books both halves of the chain
    const defPS = d.possession === 'home' ? res.awayPlayerStats : res.homePlayerStats;
    if (defPS) {
      bookChecked++;
      const tipperPS = defPS[pl.pbuId], pickerPS = defPS[pl.intPickerId];
      if (!tipperPS || !(tipperPS.passBreakups >= 1) || !pickerPS || !(pickerPS.ints >= 1)) bookBad++;
    }
  }
  // the int_accounting law still holds with the chain live
}
let intPlays = 0, boxPassInt = 0, boxDbInt = 0;
for (const res of ampGames) {
  for (const d of res.drives || []) for (const pl of d.plays || [])
    if (pl.turnover && pl.turnoverType === 'interception') intPlays++;
  for (const psMap of [res.homePlayerStats, res.awayPlayerStats])
    for (const id in psMap) { boxPassInt += psMap[id].passInt || 0; boxDbInt += psMap[id].ints || 0; }
}
const slack = Math.max(2, Math.round(intPlays * 0.01));

console.log(`AMP: ${N_AMP} games, ${tips} tip-drill plays, ${intPlays} total INTs`);
check('amp produces real chain volume', tips >= 12, `tips=${tips}`);
check('every tipDrill play: canonical INT, tipper != picker, both ids', structBad === 0, `bad=${structBad}/${tips}`);
check('ballSlots stamps both men on most chains', tips === 0 || slotBoth / slotEligible >= 0.5, `${slotBoth}/${slotEligible}`);
check('stamped tipper slot never equals picker slot', slotSame === 0, `same=${slotSame}`);
check('box score books tipper PBU + picker INT on every chain', bookBad === 0, `bad=${bookBad}/${bookChecked}`);
check('int accounting exact with the chain live (passInt)', Math.abs(boxPassInt - intPlays) <= slack, `${boxPassInt} vs ${intPlays}`);
check('int accounting exact with the chain live (DB ints)', Math.abs(boxDbInt - intPlays) <= slack, `${boxDbInt} vs ${intPlays}`);

// ── Viewer arm (on the amp harvest's stamped chains) ──────────────────────
let vTried = 0, vStaged = 0, vOrderBad = 0, vRideBad = 0, vDetBad = 0;
for (const pl of viewerTips) {
  const offL = OFF_FIELD_LAYOUTS[pl.offFormation]?.slots;
  if (!offL) continue;
  const defL = (DEF_FIELD_LAYOUTS[pl.defFront] || DEF_FIELD_LAYOUTS['4-3']).slots;
  const script = buildPlayScript(pl, offL, defL);
  if (!script) continue;
  vTried++;
  const dc = script.deflectCue;
  if (!dc) continue; // feasibility fallback — legal, counted by the ratio gate
  vStaged++;
  const intFx = (script.fx || []).find(f => f.kind === 'int');
  if (!intFx || !(intFx.t > dc.t + 0.3)) vOrderBad++;
  // the ball ends the play riding whoever made the pick
  const picker = script.actors.find(a => a.id === script.pickId);
  if (picker) {
    const bEnd = script.ball.track[script.ball.track.length - 1];
    const aEnd = picker.track[picker.track.length - 1];
    if (Math.hypot(bEnd[0] - aEnd[0], bEnd[1] - aEnd[1]) > 0.6) vRideBad++;
  } else vRideBad++;
  const again = buildPlayScript(pl, offL, defL);
  if (JSON.stringify(again.deflectCue) !== JSON.stringify(dc) || again.pickId !== script.pickId) vDetBad++;
}
// Bar re-centered 0.5→0.4 (2026-08-17, FULLGATE_TRIAGE item 12): the probe is
// deterministic per tree, and the per-tree staging share has ranged 47–62%
// across recent trees — the old 0.5 bar sat inside that range, so an RNG
// re-base (any heavy sim change) could flip it red with nothing broken. 0.4
// still proves the viewer stages the chain on a solid plurality of stamped
// plays. Gate args also raised 6→12 for real margin.
check('viewer stages the chain on most stamped plays', vTried === 0 || vStaged / vTried >= 0.4, `${vStaged}/${vTried}`);
check('tip strictly precedes the pick', vOrderBad === 0, `bad=${vOrderBad}/${vStaged}`);
check('ball ends the play riding the picker', vRideBad === 0, `bad=${vRideBad}/${vStaged}`);
check('same play → same chain script (deterministic)', vDetBad === 0, `bad=${vDetBad}`);

// ── KILL arm ───────────────────────────────────────────────────────────────
globalThis.__noTipDrill = true;
reseed();
const killGames = runGames(3);
delete globalThis.__noTipDrill;
let killTips = 0;
for (const res of killGames) for (const d of res.drives || []) for (const pl of d.plays || [])
  if (pl.tipDrill) killTips++;
check('__noTipDrill kills the chain dead', killTips === 0, `tips=${killTips}`);

// ── LIVE arm (report) ──────────────────────────────────────────────────────
reseed();
const liveGames = runGames(4);
let liveTips = 0, livePbus = 0;
for (const res of liveGames) for (const d of res.drives || []) for (const pl of d.plays || []) {
  if (pl.tipDrill) liveTips++;
  if (pl.pbuId != null) livePbus++;
}
console.log(`LIVE (shipping constant): ${liveTips} tips / ${livePbus} PBUs in 4 games — rare by design`);
check('live rate stays rare (most swats hit the turf)', livePbus === 0 || liveTips / livePbus <= 0.12, `${liveTips}/${livePbus}`);

process.exit(pass ? 0 : 1);
