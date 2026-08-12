// pass7_band_ab.mjs — PASS 7 band gate. The roster brain is OFF-FIELD by
// construction (nothing in the sim reads snaps/morale), so the band risk is
// ROSTER COMPOSITION: AI converts move bodies across rooms, bulk/cut moves
// weight+attrs, earned bridges change on-field selection (mesh full-rate).
// This A/B synthesizes one offseason: seed game → season-scaled snaps →
// pass7Rollover (LIVE) vs killed (KILL) → measured game. AMP arm saturates
// (every school converts up to 6, bridges earn at a trivial bar) — the
// trait_band_ab-style 2× envelope guard.
// Run: node tools/pass7_band_ab.mjs [N-games-per-arm]   (default 300)
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { applySnapCounts } from '../js/engine/season.js';
import { pass7Rollover } from '../js/engine/offseason.js';
import { C, ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

const N = Number(process.argv[2] ?? 300);
const SWITCHES = ['__noSnapTrack', '__noMorale', '__noConvertBrain', '__noEarnBridge', '__noBulkCut'];
const gp = () => ({ offFormation: 'Pro-Set', tendency: 'Balanced', rushInPct: 60, passDepth: { short: 40, medium: 40, deep: 20 }, blitzPct: 20, defFormation: 'Balanced D', fourthDown: 'Moderate', clockMgmt: 'Normal', maxFGDist: 42 });
function genRoster(s) {
  const r = [];
  for (const [pos, c] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < c; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], 1); p.schoolId = s; r.push(p); }
  }
  return r;
}
function arm(mode) {
  for (const k of SWITCHES) globalThis[k] = mode === 'kill';
  const ampSaved = { cap: C.PASS7.aiPosChangeCap, snaps: C.PASS7.bridgeEarnSnaps, share: C.PASS7.bridgeEarnShare };
  if (mode === 'amp') { C.PASS7.aiPosChangeCap = 6; C.PASS7.bridgeEarnSnaps = 50; C.PASS7.bridgeEarnShare = 0.05; }
  const acc = { g: 0, pts: 0, rush: 0, pass: 0, ints: 0, plays: 0, to: 0, comp: 0, att: 0, sacks: 0 };
  try {
    for (let i = 0; i < N; i++) {
      const rH = genRoster('H'), rA = genRoster('A');
      const gH = gp(), gA = gp();
      const mk = (id, roster, g) => ({ id, name: id, roster, gameplan: g, depthOrder: {}, stats: { games: 0, offSnaps: 0, defSnaps: 0 } });
      const H = mk('H', rH, gH), A = mk('A', rA, gA);
      const state = { season: 3, day: 1, playerSchoolId: 'NONE', world: { schools: [H, A] }, preseason: {}, inbox: [] };
      // seed a game of real usage, scale it to a season
      const seed = simulateGame(H, A, rH, rA, buildDepthChart(rH, gH), buildDepthChart(rA, gA), gH, gA);
      applySnapCounts(H, seed.homeSnapCounts, seed.homeJobSnaps, seed.homeTeamSnaps);
      applySnapCounts(A, seed.awaySnapCounts, seed.awayJobSnaps, seed.awayTeamSnaps);
      for (const r of [rH, rA]) for (const p of r) {
        if (p.stats?.snaps) p.stats.snaps *= 12;
        if (p.stats?.snapsAt) for (const k of Object.keys(p.stats.snapsAt)) p.stats.snapsAt[k] *= 12;
      }
      for (const s of [H, A]) { s.stats.offSnaps *= 12; s.stats.defSnaps *= 12; }
      // one offseason of the roster brain (LIVE/AMP) or nothing (KILL)
      pass7Rollover(state);
      // the measured game, on whatever rosters came out
      const res = simulateGame(H, A, rH, rA, buildDepthChart(rH, gH), buildDepthChart(rA, gA), gH, gA);
      for (const [st, score] of [[res.homeStats, res.homeScore], [res.awayStats, res.awayScore]]) {
        acc.g++; acc.pts += score ?? 0; acc.rush += st.rushYds ?? 0; acc.pass += st.passYds ?? 0;
        acc.ints += st.ints ?? 0; acc.plays += (st.rushAtt ?? 0) + (st.passAtt ?? 0); acc.to += (st.ints ?? 0) + (st.fumbles ?? 0);
        acc.comp += st.compAtt ?? 0; acc.att += st.passAtt ?? 0; acc.sacks += st.sacksAllowed ?? 0;
      }
    }
  } finally {
    for (const k of SWITCHES) delete globalThis[k];
    C.PASS7.aiPosChangeCap = ampSaved.cap; C.PASS7.bridgeEarnSnaps = ampSaved.snaps; C.PASS7.bridgeEarnShare = ampSaved.share;
  }
  return acc;
}
const line = (l, a) => console.log(
  `${l.padEnd(24)} pts ${(a.pts / a.g).toFixed(1)}  rush ${(a.rush / a.g).toFixed(1)}  pass ${(a.pass / a.g).toFixed(1)}` +
  `  comp% ${(100 * a.comp / (a.att || 1)).toFixed(1)}  plays ${(a.plays / a.g).toFixed(1)}  INT ${(a.ints / a.g).toFixed(2)}  TO ${(a.to / a.g).toFixed(2)}  sk ${(a.sacks / a.g).toFixed(2)}`);
console.log(`AI vs AI post-offseason, ${N} games per arm (per-team-game averages):`);
const live = arm('live');
line('Pass 7 LIVE', live);
const dead = arm('kill');
line('Pass 7 KILLED', dead);
const amp = arm('amp');
line('AMPLIFIED (sat. brain)', amp);
const driftOf = (a, b, get) => Math.abs(get(a) - get(b));
const gets = { pts: (a) => a.pts / a.g, rush: (a) => a.rush / a.g, pass: (a) => a.pass / a.g, comp: (a) => 100 * a.comp / (a.att || 1), sk: (a) => a.sacks / a.g };
const d = Object.fromEntries(Object.entries(gets).map(([k, f]) => [k, driftOf(live, dead, f)]));
const da = Object.fromEntries(Object.entries(gets).map(([k, f]) => [k, driftOf(amp, dead, f)]));
console.log(`\nlive drift: pts ${d.pts.toFixed(2)}  rush ${d.rush.toFixed(2)}  pass ${d.pass.toFixed(2)}  comp% ${d.comp.toFixed(2)}  sacks ${d.sk.toFixed(2)}`);
console.log(`amp  drift: pts ${da.pts.toFixed(2)}  rush ${da.rush.toFixed(2)}  pass ${da.pass.toFixed(2)}  comp% ${da.comp.toFixed(2)}  sacks ${da.sk.toFixed(2)}`);
const okLive = d.pts < 2.0 && d.rush < 8 && d.pass < 10 && d.comp < 1.5 && d.sk < 0.35;
const okAmp = da.pts < 4.0 && da.rush < 16 && da.pass < 20 && da.comp < 3.0 && da.sk < 0.7;
console.log(okLive ? 'LIVE BANDS HELD' : 'LIVE BAND DRIFT — investigate before ship');
console.log(okAmp ? 'AMPLIFIED INSIDE 2x ENVELOPE' : 'AMPLIFIED BEYOND 2x ENVELOPE — investigate');
process.exit(okLive && okAmp ? 0 : 1);
