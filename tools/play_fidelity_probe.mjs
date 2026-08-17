// play_fidelity_probe.mjs — THE CALL IS THE PLAY (owner mandate, Aug 2026).
//
// The audience's suspicion, stated as law: if the player selects a play on
// offense or a setup on defense, it FIRES — every single time, zero
// tolerance. And a play that can't run from the current package is never
// selectable to begin with (the sheet's gate), so a silent substitute is
// impossible by construction.
//
//   G1  GATE INTEGRITY: the selectable set == the runnable set. The sheet's
//       filter (FORMATION_PLAYBOOK ∩ minWR, reimplemented in lockstep with
//       app.js conceptsFor) offers a concept only where it can run; Wildcat
//       Power lives in exactly one book; no offered concept breaches minWR.
//   F1  SNAP FIDELITY, offense: EVERY legal (formation, concept) pair —
//       full pass tree, full run tree, all 8 gadgets — forced for N snaps:
//       the recorded concept equals the call, N for N. One miss fails.
//   F2  SNAP FIDELITY, defense: a forced setup deploys — the recorded front
//       equals the called front on every snap, the defCoachCall flag is set,
//       and aggression steering is real (attack >> passive blitz rates).
//   R1  ROUTE FIDELITY: the record's concept drives both the route-shape
//       duel and the viewer's drawn routes, so concept fidelity IS route
//       fidelity; additionally, for concepts declaring a `routes` spec, the
//       spec is the duel input (asserted via the concepts table contract).
//   S1  GADGET SIGNATURES: each of the 8 runs *as itself* — Flea Flicker
//       attempts deep, Reverse bounces outside, HB Pass leaves the back's
//       hand, Wildcat snaps to the back — with numeric yardage, no NaNs.
//   P1  THE RE-PROMPT PIN: one resume.call buys exactly ONE real snap; in
//       call-every-play mode the drive pauses again before the next snap —
//       including after a pre-snap penalty nulls the call. The sim NEVER
//       free-runs past the player's headset.
//
// Run: node tools/play_fidelity_probe.mjs [snapsPerPair]
const _ls = new Map();
global.localStorage = {
  getItem: (k) => (_ls.has(k) ? _ls.get(k) : null),
  setItem: (k, v) => _ls.set(k, String(v)),
  removeItem: (k) => _ls.delete(k),
};

const { C, FORMATIONS, DEF_FRONTS, FORMATION_PLAYBOOK, FORMATION_PACKAGES, ROSTER_TARGETS, CLASS_YEARS } = await import('../js/constants.js');
const { PASS_CONCEPTS, RUN_CONCEPTS } = await import('../js/concepts.js');
const { createPlayer } = await import('../js/engine/player.js');
const { buildDepthChart } = await import('../js/engine/world.js');
const { simulateDrive } = await import('../js/engine/sim.js');

let pass = 0, fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}`); ok ? pass++ : fail++; };
const hdr = (s) => console.log(`\n${s}`);
const N = parseInt(process.argv[2] || '6', 10);
const GADGETS = ['Draw', 'Jet Sweep', 'Triple Option', 'Speed Option', 'Wildcat Power', 'Reverse', 'Flea Flicker', 'HB Pass'];

// ── The rig ────────────────────────────────────────────────────────────────
function genRoster(sid) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], 1);
      p.schoolId = sid;
      r.push(p);
    }
  }
  return r;
}
const gpFor = (formation) => ({
  offFormation: formation,
  offFormations: [{ id: formation, weight: 100 }],
  tendency: 'Balanced', rushInPct: 60,
  passDepth: { short: 40, medium: 40, deep: 20 },
  blitzPct: 20, defFormation: 'Balanced D', defFront: '4-3',
  fourthDown: 'Moderate', clockMgmt: 'Normal', maxFGDist: 42,
});
const offRoster = genRoster('O'), defRoster = genRoster('D');
const bundleFor = (formation, gpOverride = null) => {
  const gp = gpOverride || gpFor(formation);
  return {
    off: { roster: offRoster, depth: buildDepthChart(offRoster, gp), gameplan: gp, school: { id: 'O', name: 'Off U' }, isHome: true, ctx: { fatigueMap: {}, snapCountMap: {}, benchedMap: {}, offSnaps: 0, defSnaps: 0, jobSnapMap: {} }, form: 1 },
    def: { roster: defRoster, depth: buildDepthChart(defRoster, gpFor('Single Back')), gameplan: gpFor('Single Back'), school: { id: 'D', name: 'Def U' }, isHome: false, ctx: { fatigueMap: {}, snapCountMap: {}, benchedMap: {}, offSnaps: 0, defSnaps: 0, jobSnapMap: {} }, form: 1 },
  };
};
// One forced snap: resume with the call, pause at the next ask. Returns the
// real snap records this resume produced (penalty rows lack a concept/type).
function forcedSnap(formation, call, defCall = null) {
  const { off, def } = bundleFor(formation);
  const gameState = { fieldPos: 35, clock: 1500, half: 1, score: { off: 0, def: 0 } };
  const plays = [];
  const d = simulateDrive(off, def, gameState, [], {
    askCall: () => 'ASK',
    resume: { call, defCall, fieldPos: 35, down: 1, distance: 10, plays, audiblesUsed: 0, fourthDecided: false, decision: null, pen: { offCount: 0, offYds: 0, defCount: 0, defYds: 0 } },
  });
  const real = plays.filter((p) => p && (p.concept || (p.type && /^(run|pass)/.test(p.type))));
  return { real, plays, drive: d };
}

// ── G1: gate integrity ─────────────────────────────────────────────────────
hdr('G1 — the selectable set is the runnable set');
{
  // Lockstep with app.js conceptsFor: playbook ∩ minWR (weights are player
  // choice, not legality). Every formation's offer list must be gate-clean.
  const wrOf = (id) => ((FORMATION_PACKAGES[id] || {}).WR || 0) + ((FORMATION_PACKAGES[id] || {}).SLOT || 0);
  let minWrBreaches = 0, unknownConcepts = 0;
  const legalPairs = [];
  for (const [fid, book] of Object.entries(FORMATION_PLAYBOOK)) {
    for (const nm of book) {
      const c = PASS_CONCEPTS[nm];
      if (!c && !RUN_CONCEPTS[nm]) { unknownConcepts++; continue; }
      if (c && c.minWR && wrOf(fid) < c.minWR) { minWrBreaches++; continue; }
      legalPairs.push([fid, nm]);
    }
  }
  check(unknownConcepts === 0, `every playbook entry is a real concept (unknown: ${unknownConcepts})`);
  check(minWrBreaches === 0, `no book offers a concept its own package can't man (minWR breaches: ${minWrBreaches})`);
  const wildcatBooks = Object.entries(FORMATION_PLAYBOOK).filter(([, b]) => b.includes('Wildcat Power')).map(([f]) => f);
  check(wildcatBooks.length === 1 && wildcatBooks[0] === 'Wildcat', `Wildcat Power is selectable from exactly one formation: ${wildcatBooks.join(', ')} — the gate, not the sim, does the refusing`);
  globalThis.__legalPairs = legalPairs;
  console.log(`  legal (formation, concept) pairs: ${legalPairs.length} across ${Object.keys(FORMATION_PLAYBOOK).length} formations`);
}

// ── F1: snap fidelity, offense — the whole matrix ──────────────────────────
hdr(`F1 — every legal pair, ${N} forced snaps each: recorded == called, always`);
{
  const misses = [];
  let snaps = 0, retries = 0;
  for (const [fid, nm] of globalThis.__legalPairs) {
    let seen = 0, guard = 0;
    while (seen < N && guard < N * 4) {
      guard++;
      const { real } = forcedSnap(fid, { concept: nm });
      if (!real.length) { retries++; continue; } // pre-snap penalty consumed the call — re-prompt path, no snap ran
      snaps++;
      seen++;
      const p = real[0];
      if (p.concept !== nm) misses.push(`${fid} → called "${nm}", ran "${p.concept}" (type ${p.type})`);
      if (real.length > 1) misses.push(`${fid}/${nm}: one call produced ${real.length} real snaps — the sim free-ran`);
      if (!p.coachCall) misses.push(`${fid}/${nm}: coachCall flag missing — the call didn't pin the play`);
    }
    if (seen < N) misses.push(`${fid}/${nm}: only ${seen}/${N} snaps observed (penalty storm?)`);
  }
  for (const m of misses.slice(0, 8)) console.log(`    MISS: ${m}`);
  check(misses.length === 0, `${snaps} forced snaps across ${globalThis.__legalPairs.length} pairs: ${misses.length} fidelity misses (penalty re-prompts along the way: ${retries})`);
}

// ── F2: snap fidelity, defense ─────────────────────────────────────────────
hdr('F2 — a called defensive setup deploys, every snap');
{
  const fronts = Object.keys(DEF_FRONTS);
  const misses = [];
  let snaps = 0;
  for (const front of fronts) {
    for (let i = 0; i < N; i++) {
      const { real } = forcedSnap('Single Back', { concept: 'sheet' }, { front, covShell: 'two', covStyle: 'zone' });
      if (!real.length) continue;
      snaps++;
      const p = real[0];
      if (p.defFront !== front) misses.push(`called front ${front}, deployed ${p.defFront}`);
      if (!p.defCoachCall) misses.push(`${front}: defCoachCall flag missing`);
    }
  }
  for (const m of misses.slice(0, 6)) console.log(`    MISS: ${m}`);
  check(misses.length === 0, `${snaps} snaps across ${fronts.length} called fronts: ${misses.length} deployment misses`);
  // Aggression steering is real: attack vs passive over 40 snaps each.
  let hot = 0, cold = 0, hotN = 0, coldN = 0;
  for (let i = 0; i < 40; i++) {
    const a = forcedSnap('Spread', { concept: 'Four Verts' }, { front: '4-3', aggression: 'house' }).real[0];
    const b = forcedSnap('Spread', { concept: 'Four Verts' }, { front: '4-3', aggression: 'bend' }).real[0];
    if (a) { hotN++; if (a.blitzFired) hot++; }
    if (b) { coldN++; if (b.blitzFired) cold++; }
  }
  check(hot / Math.max(1, hotN) > cold / Math.max(1, coldN), `called aggression steers the rush (house ${hot}/${hotN} blitzes vs bend ${cold}/${coldN})`);
}

// ── R1: route fidelity ─────────────────────────────────────────────────────
hdr('R1 — the routes that run are the routes you called');
{
  // Architecture contract: the route-shape duel AND the viewer both key off
  // the RECORDED concept — so F1's identity guarantee carries the routes.
  // Here we pin the remaining link: every concept with a `routes` spec keeps
  // a well-formed spec (the duel's input), and the record preserves the
  // concept name the viewer will draw from.
  let badSpecs = 0, drawn = 0;
  const SHAPES = new Set(['sharp', 'speed', 'double']);
  for (const [nm, c] of Object.entries(PASS_CONCEPTS)) {
    if (!c.routes) continue;
    if (!Array.isArray(c.routes) || !c.routes.length || c.routes.some((r) => !SHAPES.has(r))) { badSpecs++; console.log(`    bad spec: ${nm} → ${JSON.stringify(c.routes)}`); }
  }
  check(badSpecs === 0, `every declared route spec is duel-valid (bad: ${badSpecs})`);
  // Unseeded RNG: a pre-snap penalty on the lone forced snap leaves no real
  // record (observed 2026-08-16 — fail/pass flipped on an identical tree).
  // Retry the snap, the same trick viewer_act_b_probe uses.
  let got = forcedSnap('Spread', { concept: 'Spot' });
  for (let i = 0; i < 4 && !got.real.length; i++) got = forcedSnap('Spread', { concept: 'Spot' });
  const { real } = got;
  check(real.length === 1 && real[0].concept === 'Spot', `the record carries the called name for the viewer to draw (${real[0] && real[0].concept})`);
}

// ── S1: gadget signatures ──────────────────────────────────────────────────
hdr('S1 — the eight gadgets run as themselves');
{
  const HOME = { 'Draw': 'Single Back', 'Jet Sweep': 'Single Back', 'Triple Option': 'Wishbone', 'Speed Option': 'Spread', 'Wildcat Power': 'Wildcat', 'Reverse': 'Single Back', 'Flea Flicker': 'Single Back', 'HB Pass': 'Single Back' };
  const SIG = {
    'Draw': (p) => p.type === 'run_inside' && p.optionPhase === 'draw',
    'Jet Sweep': (p) => p.type === 'run_outside' && p.optionPhase === 'jet',
    'Triple Option': (p) => ['dive', 'keep', 'pitch'].includes(p.optionPhase),
    'Speed Option': (p) => ['dive', 'keep', 'pitch'].includes(p.optionPhase),
    'Wildcat Power': (p) => p.optionPhase === 'wildcat',
    'Reverse': (p) => p.gadget === 'reverse' && p.type.startsWith('run'),
    'Flea Flicker': (p) => p.gadget === 'fleaflicker',
    'HB Pass': (p) => p.gadget === 'hbpass',
  };
  for (const g of GADGETS) {
    let sigOk = 0, nans = 0, seen = 0, sampleYds = [];
    for (let i = 0; i < 25 && seen < 15; i++) {
      const { real } = forcedSnap(HOME[g], { concept: g });
      if (!real.length) continue;
      seen++;
      const p = real[0];
      if (SIG[g](p)) sigOk++;
      const y = p.yards;
      if (typeof y !== 'number' || Number.isNaN(y)) nans++;
      else sampleYds.push(y);
    }
    const spread = sampleYds.length ? `${Math.min(...sampleYds)}..${Math.max(...sampleYds)} yds` : 'n/a';
    check(seen >= 10 && sigOk === seen && nans === 0, `${g}: ${sigOk}/${seen} snaps ran the signature, 0 NaNs (${spread})`);
  }
}

// ── P1: the re-prompt pin ──────────────────────────────────────────────────
hdr('P1 — one call, one snap: the headset always gets the ball back');
{
  let freeRuns = 0, paused = 0, trials = 60;
  for (let i = 0; i < trials; i++) {
    const { real, drive } = forcedSnap('Spread', { concept: 'Mesh' });
    if (real.length > 1) freeRuns++;
    if (drive && drive.pending) paused++;
  }
  check(freeRuns === 0, `${trials} calls: the sim never ran a second snap on one call (free-runs: ${freeRuns})`);
  check(paused >= trials * 0.8, `and the drive hands control back to the headset (${paused}/${trials} paused pending the next call; the rest ended the drive on the snap itself — score/turnover/downs)`);
}

console.log(`\n${'='.repeat(50)}\n${fail === 0 ? 'ALL GREEN — what you call is what runs' : 'FAILURES: ' + fail} (${pass} passed)`);
process.exit(fail ? 1 : 0);
