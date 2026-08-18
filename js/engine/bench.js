import { ROSTER_TARGETS, CLASS_YEARS, FORMATION_PACKAGES, FORMATION_VARIATIONS, aliasFormation } from '../constants.js';
import { createPlayer } from './player.js';
import { buildDepthChart } from './world.js';
import { simulateDrive } from './sim.js';
import { emptyDefCard, cardToDefCall, DEF_CALL_COVERAGES, DEF_CALL_BRING, frontIds } from './defbook.js';

// ── The Test Bench (M1, 2026-08-17) — a PLAY-DESIGN instrument ──────────────
// bench(formationId, variation, playOrConcept, defensiveLook) runs ONE play
// between two even-matched scratch teams through the REAL sim — the same
// simulateDrive + forcedCall/forcedDefCall seams the headset uses — and hands
// back the real play record, which the real watchphys viewer can animate via
// the clip path. Owner boundary: play design ONLY. No scouting hooks, no
// opponent practice, no lesson layer — the bench answers "what does MY play
// do against THAT look?", nothing else.
//
// Laws this module keeps:
//   * NOTHING persisted. No state.js, no persistence.js, no localStorage —
//     the scratch teams and every rep live in memory only (probe-proven).
//   * DETERMINISTIC teams. Both rosters are generated from the same pinned
//     PRNG stream, so the two teams are attribute-identical position for
//     position (maximally even), at flat tier-1 caliber. Master rosters are
//     never handed to the sim — every rep plays on fresh clones, so a rep
//     can never leak (injury, stats) into the next.
//   * SAME ROLL AGAIN. Every rep runs under a pinned PRNG seed (the probes'
//     seeded-stream trick). Same seed → byte-identical record; a fresh seed
//     is a fresh roll of the same call.
//   * The defensive look speaks the EXISTING defCall vocabulary: a front +
//     one of the 8 coverage pictures + bring 3/4/5/6, compiled by the
//     defensive playbook's own cardToDefCall. No new sim paths.

var BENCH_TEAM_SEED = 0xB37C4ED1; // fixed — the scratch teams never change

// mulberry32 — the probes' pin. Returns an unpin restoring the real RNG.
function pinRandom(seed) {
  let a = seed >>> 0;
  const real = Math.random;
  Math.random = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => { Math.random = real; };
}

function _genRoster(prefix) {
  const r = [];
  let n = 0;
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], 1);
      // deterministic ids AFTER generation: uuid() draws from the pinned
      // stream, so re-pinning the same seed for the second team would clone
      // the ids too — reassign so the two teams stay distinct on the record.
      p.id = `${prefix}${n++}`;
      p.schoolId = prefix === "BO" ? "BENCH_O" : "BENCH_D";
      r.push(p);
    }
  }
  return r;
}
var _teams = null;
// Two even-matched scratch teams: SAME pinned stream for both, so every roll
// that made an offensive player made his defensive twin. Flat caliber, no
// prestige, nothing saved.
function benchTeams() {
  if (_teams) return _teams;
  let unpin = pinRandom(BENCH_TEAM_SEED);
  const off = _genRoster("BO");
  unpin();
  unpin = pinRandom(BENCH_TEAM_SEED);
  const def = _genRoster("BD");
  unpin();
  const playerNames = {};
  for (const p of [...off, ...def]) playerNames[p.id] = { name: `${p.name.first[0]}. ${p.name.last}`, pos: p.position };
  _teams = { off, def, playerNames };
  return _teams;
}

function _gpFor(formationId, variation) {
  const entry = { id: formationId, weight: 100 };
  if (variation) entry.variation = variation;
  return {
    offFormation: formationId,
    offFormations: [entry],
    tendency: "Balanced", rushInPct: 60,
    passDepth: { short: 40, medium: 40, deep: 20 },
    // D16 fixture hygiene (2026-08-18): defFormation (written, read by nothing)
    // and clockMgmt (deleted by the sim at normalize) dropped — inert keys.
    blitzPct: 20, defFront: "4-3",
    fourthDown: "Moderate", maxFGDist: 42
  };
}

// The defensive LOOK → the sparse defCall payload the sim already consumes.
// { front, coverage: <8-picture id>, bring: "3"|"4"|"5"|"6" }
function benchDefCall(defLook) {
  const o = defLook || {};
  const card = { ...emptyDefCard("Bench Look"), front: o.front || null, coverage: o.coverage || "base", bring: o.bring || "4" };
  return cardToDefCall(card);
}
function benchLookOptions() {
  return { fronts: frontIds(), coverages: DEF_CALL_COVERAGES.map((c) => ({ id: c.id, label: c.label, desc: c.desc })), brings: Object.entries(DEF_CALL_BRING).map(([id, b]) => ({ id, label: b.label, desc: b.desc })) };
}

// One rep. Options:
//   formationId (required), variation, concept (named call) OR
//   customPlayId + customPlayData (a composed play), defLook, seed.
// Returns { ok, play, real, rolled, seed, plays } — `play` is the recorded
// snap (or the penalty record if the rep drew a pre-snap flag: an honest
// football outcome, reported, never silently rerolled out of a pinned stream).
function benchSnap(o) {
  const fid = aliasFormation(o.formationId);
  if (!FORMATION_PACKAGES[fid]) return { ok: false, error: `unknown formation "${o.formationId}"`, play: null, real: false, rolled: null, seed: o.seed >>> 0, plays: [] };
  const vset = FORMATION_VARIATIONS[fid];
  const variation = o.variation && vset && vset[o.variation] ? o.variation : null;
  const call = o.customPlayData
    ? { customPlay: o.customPlayId || "_bench", customPlayData: o.customPlayData, formationId: fid, variation }
    : { concept: o.concept || "sheet", formationId: fid, variation };
  const defCall = benchDefCall(o.defLook);
  const masters = benchTeams();
  const seed = o.seed >>> 0;
  const unpin = pinRandom(seed);
  try {
    // fresh clones every rep — the sim may mutate (stats, fatigue, injury);
    // clones keep every rep independent and every same-seed rep identical.
    const offRoster = JSON.parse(JSON.stringify(masters.off));
    const defRoster = JSON.parse(JSON.stringify(masters.def));
    const gp = _gpFor(fid, variation);
    const dgp = _gpFor("Single Back", null);
    const mkCtx = () => ({ fatigueMap: {}, snapCountMap: {}, benchedMap: {}, offSnaps: 0, defSnaps: 0, jobSnapMap: {} });
    const off = { roster: offRoster, depth: buildDepthChart(offRoster, gp), gameplan: gp, school: { id: "BENCH_O", name: "Bench Offense" }, isHome: true, ctx: mkCtx(), form: 1 };
    const def = { roster: defRoster, depth: buildDepthChart(defRoster, dgp), gameplan: dgp, school: { id: "BENCH_D", name: "Bench Defense" }, isHome: false, ctx: mkCtx(), form: 1 };
    const plays = [];
    simulateDrive(off, def, { fieldPos: 35, clock: 900, half: 1, score: { off: 0, def: 0 } }, [], {
      askCall: () => "ASK", // one forced call buys exactly one snap, then the sim asks again — the bench never answers
      resume: { call, defCall, fieldPos: 35, down: 1, distance: 10, plays, audiblesUsed: 0, fourthDecided: false, decision: null, pen: { offCount: 0, offYds: 0, defCount: 0, defYds: 0 } }
    });
    const real = plays.filter((p) => p && (p.concept || (p.type && /^(run|pass)/.test(p.type))));
    const play = real[0] || plays[0] || null;
    return { ok: !!play, play, real: real.length > 0, rolled: (real[0] && real[0].coverage) || null, seed, plays };
  } finally {
    unpin();
  }
}

// The dispatch-order signature. playOrConcept: a concept NAME, or a composed
// play as { id, data } (the Composer's payload).
function bench(formationId, variation, playOrConcept, defensiveLook, opts = {}) {
  const o = { formationId, variation, defLook: defensiveLook, seed: opts.seed != null ? opts.seed : (Math.random() * 4294967296) >>> 0 };
  if (playOrConcept && typeof playOrConcept === "object") {
    o.customPlayId = playOrConcept.id || "_bench";
    o.customPlayData = playOrConcept.data || playOrConcept;
  } else o.concept = playOrConcept;
  return benchSnap(o);
}

// Plain-football outcome text for the result line (node-safe — the UI may
// dress it up with broadcast commentary, the probe reads this).
function benchOutcome(p) {
  if (!p) return "no snap";
  if (p.type === "penalty") return "flag — pre-snap penalty";
  const yds = typeof p.yards === "number" ? p.yards : 0;
  const y = `${yds > 0 ? "+" : ""}${yds} yd${Math.abs(yds) === 1 ? "" : "s"}`;
  if (p.sack) return `sacked (${y})`;
  if (p.turnover && p.turnoverType === "interception") return "intercepted";
  if (p.turnover && p.turnoverType === "fumble") return `fumble, lost (${y})`;
  const td = p.scored ? " — TOUCHDOWN" : "";
  if (String(p.type).startsWith("pass")) return p.complete ? `complete (${y})${td}` : "incomplete";
  if (String(p.type).startsWith("run")) return `run (${y})${td}`;
  return `${p.type || "play"} (${y})`;
}

// The viewer shell: a one-play "game" the clip path (buildReplayClipData →
// initWatchMode) accepts, so the bench rides the REAL watchphys board with
// zero new viewer wiring. Pure data — nothing here touches app state.
function benchGameShell(play) {
  const t = benchTeams();
  return {
    drives: [{ possession: "home", result: "bench", points: 0, plays: [play] }],
    homeSchool: { id: "BENCH_O", name: "Bench Offense", nick: "Offense", abbr: "OFF", colors: ["#243b66", "#f2c94c"] },
    awaySchool: { id: "BENCH_D", name: "Bench Defense", nick: "Defense", abbr: "DEF", colors: ["#5a2430", "#d9d9d9"] },
    homeScore: 0,
    awayScore: 0,
    playerNames: t.playerNames
  };
}

export { bench, benchSnap, benchTeams, benchDefCall, benchLookOptions, benchOutcome, benchGameShell, pinRandom as _benchPinRandom };
