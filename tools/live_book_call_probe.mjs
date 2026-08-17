// live_book_call_probe.mjs — STAGE 4 of the Playbook-Root refactor
// ("live coaching reads the book", Ref/PLAYBOOK_ROOT_ARCHITECTURE.md).
// Run: node tools/live_book_call_probe.mjs
//
// Pins the new mechanism and its safety walls:
//   C1  A COMPOSED play called from the headset RUNS AS ITSELF: the recorded
//       concept equals the composed play's name, the coachCall flag is set,
//       one call buys exactly one snap, and the pinned formation/variation
//       still rides the call.
//   C2  BAND SAFETY: the compiled grades the sim consumes are the compilePlay
//       rulebook's output — every vs grade inside [BAND_LO, BAND_HI] — and
//       compiling for the call NEVER writes into PASS_CONCEPTS (AI-invisible
//       by construction: pickPassConcept only iterates PASS_CONCEPTS).
//   C3  A broken customPlayData payload falls through to the normal sheet
//       call — the snap runs, nothing throws, no composed name is recorded.
//   C4  AI stays blind: an unforced (sheet) drive on the same rig never
//       records the composed name.
//   D1  defBookCalls reads the BOOK: a synthesized school resolves its named
//       defensive calls through the defbook (plan.defCalls snapshot today), a
//       future defbook.calls home wins over the flat gameplan, and
//       compilePlanParts emits gameplan.defCalls from defbook.calls when the
//       plan snapshot is absent (the minimal Stage-3 migration seam) while
//       staying byte-neutral for every book that exists today.
const _ls = new Map();
global.localStorage = {
  getItem: (k) => (_ls.has(k) ? _ls.get(k) : null),
  setItem: (k, v) => _ls.set(k, String(v)),
  removeItem: (k) => _ls.delete(k),
};

const { ROSTER_TARGETS, CLASS_YEARS } = await import('../js/constants.js');
const { PASS_CONCEPTS } = await import('../js/concepts.js');
const { createPlayer } = await import('../js/engine/player.js');
const { buildDepthChart } = await import('../js/engine/world.js');
const { simulateDrive } = await import('../js/engine/sim.js');
const { compilePlay, BAND_LO, BAND_HI, COVERAGES } = await import('../js/engine/playcompose.js');
const { splitTeamPlan, compilePlanParts, synthesizeTeamPlan, defBookCalls } = await import('../js/engine/teamplan.js');

let pass = 0, fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}`); ok ? pass++ : fail++; };
const hdr = (s) => console.log(`\n${s}`);

// ── rig (lockstep with play_fidelity_probe) ────────────────────────────────
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
function forcedSnap(formation, call) {
  const gp = gpFor(formation);
  const off = { roster: offRoster, depth: buildDepthChart(offRoster, gp), gameplan: gp, school: { id: 'O', name: 'Off U' }, isHome: true, ctx: { fatigueMap: {}, snapCountMap: {}, benchedMap: {}, offSnaps: 0, defSnaps: 0, jobSnapMap: {} }, form: 1 };
  const dgp = gpFor('Single Back');
  const def = { roster: defRoster, depth: buildDepthChart(defRoster, dgp), gameplan: dgp, school: { id: 'D', name: 'Def U' }, isHome: false, ctx: { fatigueMap: {}, snapCountMap: {}, benchedMap: {}, offSnaps: 0, defSnaps: 0, jobSnapMap: {} }, form: 1 };
  const plays = [];
  simulateDrive(off, def, { fieldPos: 35, clock: 1500, half: 1, score: { off: 0, def: 0 } }, [], {
    askCall: () => 'ASK',
    resume: { call, fieldPos: 35, down: 1, distance: 10, plays, audiblesUsed: 0, fourthDecided: false, decision: null, pen: { offCount: 0, offYds: 0, defCount: 0, defYds: 0 } },
  });
  return { real: plays.filter((p) => p && (p.concept || (p.type && /^(run|pass)/.test(p.type)))), plays };
}

const COMPOSED = {
  schemaVersion: 1, name: 'Garrett Special', kind: 'pass',
  parts: ['go', 'drag', 'curl', 'checkdown'],
  assigns: [{ slot: null, flip: false }, { slot: null, flip: false }, { slot: null, flip: false }, { slot: null, flip: false }],
  blocks: [], formations: ['Spread'],
};

hdr('C1 — the composed call runs as itself (name, flag, one snap, pinned look)');
{
  const N = 8;
  let seen = 0, guard = 0, misses = [];
  while (seen < N && guard < N * 4) {
    guard++;
    const { real } = forcedSnap('Spread', { customPlay: 'p1', customPlayData: COMPOSED, formationId: 'Spread', variation: 'trips' });
    if (!real.length) continue; // pre-snap penalty re-prompt
    seen++;
    const p = real[0];
    if (p.concept !== 'Garrett Special') misses.push(`ran "${p.concept}" (type ${p.type})`);
    if (!p.coachCall) misses.push('coachCall flag missing');
    if (real.length > 1) misses.push(`one call produced ${real.length} snaps`);
    // a pass snap can legitimately record run_scramble (the QB pulled it down)
    if (p.type && !String(p.type).startsWith('pass') && p.type !== 'run_scramble') misses.push(`playType "${p.type}" not a pass snap`);
  }
  for (const m of misses.slice(0, 5)) console.log(`    MISS: ${m}`);
  check(seen === N && misses.length === 0, `${seen}/${N} forced composed snaps recorded "Garrett Special", coachCall set, one snap per call (misses: ${misses.length})`);
}

hdr('C1b — D4/M2: a composed RUN runs as itself (run type, pulls ride, one snap)');
{
  const RUN_CP = {
    schemaVersion: 2, name: 'Garrett Toss', kind: 'run',
    run: { path: 'toss', scheme: 'gap', carrier: 'RB' },
    parts: [], assigns: [], blocks: [], formations: ['Power-I'],
  };
  const N = 8;
  let seen = 0, guard = 0, misses = [];
  while (seen < N && guard < N * 4) {
    guard++;
    const { real } = forcedSnap('Power-I', { customPlay: 'r1', customPlayData: RUN_CP, formationId: 'Power-I' });
    if (!real.length) continue;
    seen++;
    const p = real[0];
    if (p.concept !== 'Garrett Toss') misses.push(`ran "${p.concept}" (type ${p.type})`);
    if (!p.coachCall) misses.push('coachCall flag missing');
    if (real.length > 1) misses.push(`one call produced ${real.length} snaps`);
    if (p.type && !String(p.type).startsWith('run')) misses.push(`playType "${p.type}" not a run snap`);
  }
  for (const m of misses.slice(0, 5)) console.log(`    MISS: ${m}`);
  check(seen === N && misses.length === 0, `${seen}/${N} forced composed RUN snaps recorded "Garrett Toss" as a run (misses: ${misses.length})`);
}

hdr('C2 — band safety + AI invisibility of the compile');
{
  const before = JSON.stringify(Object.keys(PASS_CONCEPTS).sort());
  const cc = compilePlay(COMPOSED);
  const inBand = COVERAGES.every((cov) => cc.vs[cov] >= BAND_LO - 1e-9 && cc.vs[cov] <= BAND_HI + 1e-9);
  check(inBand, `every compiled vs grade within the band [${BAND_LO}, ${BAND_HI}]`);
  check(cc.depth === 'medium' || cc.depth === 'short' || cc.depth === 'deep', `compile derives a depth class (${cc.depth})`);
  const after = JSON.stringify(Object.keys(PASS_CONCEPTS).sort());
  check(before === after && !PASS_CONCEPTS['Garrett Special'], 'PASS_CONCEPTS untouched — composed plays never enter the AI pool');
}

hdr('C3 — a broken payload falls through to the sheet, never bricks the snap');
{
  let ranOk = 0, composedLeak = 0, guard = 0;
  while (ranOk < 4 && guard < 16) {
    guard++;
    const { real } = forcedSnap('Spread', { customPlay: 'bad', customPlayData: { schemaVersion: 1, name: 'Broken', kind: 'pass', parts: ['not-a-part'] } });
    if (!real.length) continue;
    ranOk++;
    if (real[0].concept === 'Broken') composedLeak++;
  }
  check(ranOk === 4 && composedLeak === 0, `${ranOk}/4 snaps ran normally on an invalid payload, 0 recorded the broken play`);
}

hdr('C4 — the AI never calls it: sheet drives record no composed names');
{
  let leaked = 0, snaps = 0;
  for (let i = 0; i < 12; i++) {
    const { real } = forcedSnap('Spread', { concept: 'sheet' });
    for (const p of real) { snaps++; if (p.concept === 'Garrett Special' || p.concept === 'Broken') leaked++; }
  }
  check(snaps > 0 && leaked === 0, `${snaps} sheet snaps, ${leaked} composed-name leaks`);
}

hdr('D1 — the defensive headset reads the BOOK (defBookCalls + the compile seam)');
{
  const LIB = { 'Bear Storm': { front: '46/Bear', aggression: 'attacking' }, 'Two Shell': { covShell: 'two' } };
  const school = { name: 'Probe U', gameplan: { ...gpFor('Spread'), defCalls: JSON.parse(JSON.stringify(LIB)) } };
  synthesizeTeamPlan(school, { force: true });
  const viaBook = defBookCalls(school);
  check(!!school.defbook.plan.defCalls, 'synthesis put defCalls in the defensive book (plan.defCalls snapshot)');
  check(viaBook && Object.keys(viaBook).join('|') === 'Bear Storm|Two Shell', 'defBookCalls resolves the named calls through the defbook');
  check(JSON.stringify(viaBook) === JSON.stringify(LIB), 'the book\'s calls are byte-identical to the plan\'s');
  // the future first-class home wins
  school.defbook.calls = { 'New Home': { covStyle: 'man' } };
  const viaHome = defBookCalls(school);
  check(viaHome && Object.keys(viaHome).join('|') === 'New Home', 'a first-class defbook.calls home outranks the snapshot');
  delete school.defbook.calls;
  // the compile seam: defbook.calls → gameplan.defCalls when no plan snapshot
  const { book, defbook, overlay } = splitTeamPlan(school.gameplan, { schoolName: 'Probe U' });
  const baseline = JSON.stringify(compilePlanParts(book, defbook, overlay));
  delete defbook.plan.defCalls;
  defbook.calls = JSON.parse(JSON.stringify(LIB));
  const migrated = compilePlanParts(book, defbook, overlay);
  check(JSON.stringify(migrated.defCalls) === JSON.stringify(LIB), 'compilePlanParts emits gameplan.defCalls from defbook.calls (migration seam)');
  // byte-neutral today: with the plan snapshot present, calls is ignored
  defbook.plan.defCalls = JSON.parse(JSON.stringify(LIB));
  defbook.calls = { 'Should Not Win': {} };
  check(JSON.stringify(compilePlanParts(book, defbook, overlay)) === baseline, 'plan.defCalls (the round-trip snapshot) still wins — byte-neutral for every existing book');
  // pre-book saves keep working
  check(JSON.stringify(defBookCalls({ gameplan: { defCalls: LIB } })) === JSON.stringify(LIB), 'a pre-book school falls back to the flat gameplan');
}

console.log(`\nLIVE BOOK CALL PROBE — ${pass} pass, ${fail} fail`);
console.log(fail ? 'LIVE BOOK CALL PROBE FAIL' : 'LIVE BOOK CALL PROBE PASS');
process.exit(fail ? 1 : 0);
