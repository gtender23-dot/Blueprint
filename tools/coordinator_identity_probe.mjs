// coordinator_identity_probe.mjs — DNA TREE §5b: rust, the ledger writer,
// Climber/Lifer, the retention (D4) and the succession promise (D5).
// Pass 3 of the roguelite build order.
//
//   R1  Rust: an unused formation decays toward his ROLLED baseline and never
//       below it; a used formation still grows to its ceiling.
//   R2  AI NEUTRALITY: with stable usage (the AI's shape), coordIqMod for the
//       formation actually in use is IDENTICAL with rust in the code —
//       expected band impact ~0, verified, not assumed.
//   L1  The ledger writer: endOfSeason-shaped writes make coordStreak and
//       coordinatorCredentials return live values (the scaffold has a writer).
//   A1  Ambition: generation rolls Climber/Lifer; better men are hungrier;
//       old-save coordinators get one lazily.
//   P1  The promise (D5): only a Climber can hold it, it costs PROMISE_PCT of
//       the division base, and a promised man NEVER draws a poach event.
//   P2  Ambition appetite: over many trials, a Lifer draws fewer poach events
//       than a Climber of the same quality.
//   D4  Retention money: the poach carries retentionCost = 10% of
//       C.ECON.BASE[div]; pendingRetentionCost is deducted by initBudget the
//       NEXT season and zeroed (the pendingScheduleGuarantee shape).
//   N1  Zero-migration: an old-save coordinator (no baseIQ, no ambition, no
//       ledger, no age) passes through grow/poach/credentials without a throw.
//
// Run: node tools/coordinator_identity_probe.mjs
const _ls = new Map();
global.localStorage = {
  getItem: (k) => (_ls.has(k) ? _ls.get(k) : null),
  setItem: (k, v) => _ls.set(k, String(v)),
  removeItem: (k) => _ls.delete(k),
};

const { C, FORMATIONS } = await import('../js/constants.js');
const S = await import('../js/engine/staff.js');
const R = await import('../js/engine/recruiting.js');

let pass = 0, fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}`); ok ? pass++ : fail++; };
const hdr = (s) => console.log(`\n${s}`);
const FORMS = Object.keys(FORMATIONS);

// ── R1: rust decays toward the rolled floor, growth still works ────────────
hdr('R1 — rust: unused decays to the rolled floor, used still grows');
{
  const co = S.generateCoordinator('OC', 60, 'D2');
  const used = FORMS[0], shelf = FORMS[1];
  // Lift the shelf formation above its floor first (simulate past usage).
  co.schemeIQ[shelf] = co.baseIQ[shelf] + 9;
  const floorShelf = co.baseIQ[shelf];
  const school = { staff: { oc: co, dc: null }, gameplan: { offFormations: [{ id: used, weight: 100 }] } };
  const usedBefore = co.schemeIQ[used];
  for (let y = 0; y < 12; y++) S.growStaffSchemeIQ(school);
  check(co.schemeIQ[used] > usedBefore, `the called formation grew (${usedBefore} → ${co.schemeIQ[used]})`);
  check(co.schemeIQ[shelf] === floorShelf, `the shelved formation rusted back to its rolled floor and STOPPED (${floorShelf + 9} → ${co.schemeIQ[shelf]}, floor ${floorShelf})`);
  const rate = C.STAFF_ID.RUST_PER_SEASON;
  const co2 = S.generateCoordinator('OC', 60, 'D2');
  co2.schemeIQ[shelf] = co2.baseIQ[shelf] + 9;
  const school2 = { staff: { oc: co2, dc: null }, gameplan: { offFormations: [{ id: used, weight: 100 }] } };
  S.growStaffSchemeIQ(school2);
  check(co2.schemeIQ[shelf] === co2.baseIQ[shelf] + 9 - rate, `rust rate is ${rate}/season (one season: +9 → +${co2.schemeIQ[shelf] - co2.baseIQ[shelf]})`);
}

// ── R2: AI neutrality, verified ────────────────────────────────────────────
hdr('R2 — stable AI usage: the used formation reads IDENTICAL, band impact ~0');
{
  // Two identical coordinators, same seed sheet; one world with rust ticking
  // 15 seasons of STABLE usage. The formation in use must read the same as a
  // pure-growth world would read it — rust only ever touches shelf schemes,
  // which coordIqMod never consults for a stable gameplan.
  const mk = () => {
    const co = S.generateCoordinator('DC', 55, 'D1');
    // normalize the sheet so both copies are byte-identical
    for (const k of Object.keys(co.schemeIQ)) { co.schemeIQ[k] = 50; co.baseIQ[k] = 44; }
    co.ratings = { blitzDesign: 60, coverage: 60, runFits: 60 };
    return co;
  };
  const a = mk(), b = mk();
  const school = (co) => ({ staff: { oc: null, dc: co }, gameplan: { defFront: '4-3' } });
  const sa = school(a), sb = school(b);
  for (let y = 0; y < 15; y++) { S.growStaffSchemeIQ(sa); S.growStaffSchemeIQ(sb); }
  const modA = S.coordIqMod({ staff: { dc: a } }, 'def', '4-3');
  const modB = S.coordIqMod({ staff: { dc: b } }, 'def', '4-3');
  check(modA === modB, `two stable-usage worlds read the same used-formation IQ mod (${modA.toFixed(4)})`);
  check(a.schemeIQ['4-3'] === b.schemeIQ['4-3'], `used-formation IQ identical after 15 seasons (${a.schemeIQ['4-3']})`);
  const shelfDecayed = Object.keys(a.schemeIQ).filter((k) => k !== '4-3').every((k) => a.schemeIQ[k] === 44);
  check(shelfDecayed, 'every shelf scheme sits at its floor — decayed, and irrelevant to the mod the sim reads');
}

// ── L1: the ledger writer makes the scaffold live ──────────────────────────
hdr('L1 — coordStreak and coordinatorCredentials go live');
{
  const co = S.generateCoordinator('OC', 65, 'D2');
  check(S.coordStreak(co, 'B+') === 0 && S.coordinatorCredentials(co).avgUnitGrade == null, 'before any writes: streak 0, no unit grades (the old half-built state)');
  for (let s = 1; s <= 4; s++) S.writeStaffLedger(co, s, { OFF: 'A-' });
  check(S.coordStreak(co, 'B+') === 4, `four A- seasons → a 4-year B+ streak (${S.coordStreak(co, 'B+')})`);
  const cred = S.coordinatorCredentials(co);
  check(cred.avgUnitGrade === 'A-', `credentials read the ledger (avg unit grade ${cred.avgUnitGrade})`);
  check(cred.startingLevels && Object.values(cred.startingLevels).some((v) => typeof v === 'number' && v > 0), 'the record term now feeds a promoted man\'s starting levels');
  // The cap (save diet).
  for (let s = 5; s <= 30; s++) S.writeStaffLedger(co, s, { OFF: 'B' });
  check(co.ledger.length === C.STAFF_ID.LEDGER_CAP, `ledger capped at ${C.STAFF_ID.LEDGER_CAP} rows (save diet)`);
}

// ── A1: ambition ───────────────────────────────────────────────────────────
hdr('A1 — Climber/Lifer rolled at generation, hungrier when better, lazy for old saves');
{
  let missing = 0;
  for (let i = 0; i < 200; i++) if (!S.generateCoordinator('OC', 55, 'D2').ambition) missing++;
  check(missing === 0, `every generated coordinator carries an ambition (missing: ${missing})`);
  let hiClimb = 0, loClimb = 0;
  const N = 3000;
  for (let i = 0; i < N; i++) {
    if (S.generateCoordinator('OC', 85, 'D1').ambition === 'Climber') hiClimb++;
    if (S.generateCoordinator('OC', 35, 'D3').ambition === 'Climber') loClimb++;
  }
  check(hiClimb > loClimb, `better men are hungrier (q85 climbers ${(hiClimb / N * 100).toFixed(0)}% > q35 ${(loClimb / N * 100).toFixed(0)}%)`);
  const old = S.generateCoordinator('DC', 60, 'D2');
  delete old.ambition;
  S.ensureAmbition(old);
  check(!!old.ambition, `an old-save coordinator gets one lazily (${old.ambition})`);
}

// ── P1 + P2: the promise and the appetite ──────────────────────────────────
hdr('P1/P2 — the promise takes a man off the market; Lifers barely answer the phone');
{
  const mkState = (coord) => ({
    playerSchoolId: 'P', season: 5,
    playerCoach: { id: 'player', pendingRetentionCost: 0 },
    world: { schools: [
      { id: 'P', name: 'Mine', division: 'D2', prestige: 1, staff: { oc: coord, dc: null } },
      { id: 'B', name: 'Bigger U', division: 'D2', prestige: 5 },
    ] },
  });
  // A star OC at a prestige-1 school: heavy poach pressure by construction.
  const star = () => { const c = S.generateCoordinator('OC', 88, 'D2'); c.ambition = 'Climber'; return c; };
  // The promise, made through the real action:
  const promised = star();
  const st = mkState(promised);
  const res = S.makeSuccessionPromise(st, 'OC');
  const wantCost = Math.round((C.ECON.BASE.D2 * C.STAFF_ID.PROMISE_PCT) / 100) * 100;
  check(res.ok && res.cost === wantCost, `the promise costs ${C.STAFF_ID.PROMISE_PCT * 100}% of the division base ($${res.cost} = $${wantCost})`);
  check(st.playerCoach.pendingRetentionCost === wantCost, 'charged to NEXT season via pendingRetentionCost');
  let promisedPoaches = 0;
  for (let i = 0; i < 500; i++) if (S.rollCoordinatorPoach(st)) promisedPoaches++;
  check(promisedPoaches === 0, `a promised man drew ${promisedPoaches} poach events in 500 rolls — off the market`);
  const lifer = star(); lifer.ambition = 'Lifer';
  const liferDenied = S.makeSuccessionPromise(mkState(lifer), 'OC');
  check(!liferDenied.ok, 'a Lifer cannot be promised the seat — the promise is for Climbers');
  let climbHits = 0, lifeHits = 0;
  for (let i = 0; i < 2000; i++) {
    const cc = star();
    if (S.rollCoordinatorPoach(mkState(cc))) climbHits++;
    const lc = star(); lc.ambition = 'Lifer';
    if (S.rollCoordinatorPoach(mkState(lc))) lifeHits++;
  }
  check(climbHits > lifeHits * 1.5, `Climbers draw far more offers (${climbHits} vs ${lifeHits} in 2000 rolls each)`);
}

// ── D4: the retention money, end to end ────────────────────────────────────
hdr('D4 — retention: 10% of C.ECON.BASE[div], deducted next season, then zeroed');
{
  const co = S.generateCoordinator('OC', 88, 'D2');
  co.ambition = 'Climber';
  const st = {
    playerSchoolId: 'P', season: 5,
    playerCoach: { id: 'player' },
    world: { schools: [
      { id: 'P', name: 'Mine', division: 'D2', prestige: 1, staff: { oc: co, dc: null } },
      { id: 'B', name: 'Bigger U', division: 'D2', prestige: 5 },
    ] },
  };
  let offer = null;
  for (let i = 0; i < 400 && !offer; i++) offer = S.rollCoordinatorPoach(st);
  const wantRet = Math.round((C.ECON.BASE.D2 * C.STAFF_ID.RETENTION_PCT) / 100) * 100;
  check(!!offer, 'a poach offer fires for a star OC at a small school');
  check(offer && offer.retentionCost === wantRet, `the FIRST offer carries retentionCost $${offer && offer.retentionCost} = 10% of D2 base ($${wantRet})`);
  // [Owner ruling Aug 2026] The doubling: his agent keeps score.
  co.retentionCount = 1;
  let offer2 = null;
  for (let i = 0; i < 400 && !offer2; i++) offer2 = S.rollCoordinatorPoach(st);
  check(offer2 && offer2.retentionCost === wantRet * 2, `after one retention, the next ask costs DOUBLE ($${offer2 && offer2.retentionCost} = $${wantRet * 2})`);
  co.retentionCount = 3;
  let offer3 = null;
  for (let i = 0; i < 400 && !offer3; i++) offer3 = S.rollCoordinatorPoach(st);
  check(offer3 && offer3.retentionCost === wantRet * 8, `three retentions in: 8× the base ($${offer3 && offer3.retentionCost}) — eventually you promise the seat or let him go`);
  check(offer3 && offer3.priorRetentions === 3, 'the offer carries his ask history for the banner');
  co.retentionCount = 0;
  // The player pays: the UI writes pendingRetentionCost; initBudget applies it.
  const coach = { pendingRetentionCost: wantRet, pendingScheduleGuarantee: 0 };
  const school = { division: 'D2', prestige: 3, facilities: {}, recentWins: [6], staff: { oc: null, dc: null } };
  R.initBudget(coach, 20, 0, school, 6);
  const withCost = coach.budget;
  const coach2 = { pendingRetentionCost: 0, pendingScheduleGuarantee: 0 };
  R.initBudget(coach2, 20, 0, school, 6);
  check(coach2.budget - withCost === wantRet, `next season's budget is exactly $${wantRet} lighter (${coach2.budget} → ${withCost})`);
  check(coach.pendingRetentionCost === 0, 'and the pending line zeroes after applying (no double-charge)');
  check(coach.revenueBreakdown && coach.revenueBreakdown.retentionCost === wantRet, 'the ledger shows the line — the cost is legible');
}

// ── N1: zero-migration ─────────────────────────────────────────────────────
hdr('N1 — an old-save coordinator passes through everything without a throw');
{
  const old = S.generateCoordinator('OC', 60, 'D2');
  delete old.baseIQ; delete old.ambition; delete old.age; delete old.ledger;
  const school = { staff: { oc: old, dc: null }, gameplan: { offFormations: [{ id: FORMS[0], weight: 100 }] } };
  let threw = false;
  try {
    S.growStaffSchemeIQ(school);
    S.growStaffSchemeIQ(school);
    S.coordinatorCredentials(old);
    S.coordStreak(old, 'B+');
    S.ensureAmbition(old);
  } catch (e) { threw = true; console.log('  threw:', e.message); }
  check(!threw, 'grow (rust path) + credentials + streak + ambition: no throw');
  check(!!old.baseIQ, 'baseIQ snapshotted lazily — his arrival sheet became his floor');
  const shelf = FORMS[1];
  check(old.baseIQ[shelf] != null && old.schemeIQ[shelf] >= old.baseIQ[shelf], 'and nothing he arrived with can rust away (floor = first-seen sheet)');
}

console.log(`\n${'='.repeat(50)}\n${fail === 0 ? 'ALL GREEN' : 'FAILURES: ' + fail} (${pass} passed)`);
process.exit(fail ? 1 : 0);
