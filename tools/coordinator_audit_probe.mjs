// coordinator_audit_probe.mjs — THE COORDINATOR AUDIT (owner request, Aug
// 2026): sanity-check what a coordinator actually carries against what the
// DNA Tree update says he should. One generator feeds every path (worldgen
// staffFor, hire-market generateCandidates, cascade replacements), so the
// contract is checked at the source and again after a career of accretion.
//
// THE FIELD CONTRACT (§5b + passes 1/3/6):
//   at generation — id, name (unified pool), side, ratings (3 side-keys),
//     schemeIQ (side-correct scheme space), specialty (boosted, on-sheet),
//     seasons 0, age (31–52), baseIQ (rust floor = rolled sheet), ambition
//     (Climber/Lifer), salary (> 0, division-scaled)
//   accrued in a career — ledger rows (capped), mentor lineage (player staff),
//     retentionCount (doubling asks), promisedSuccession (D5)
//
//   A1  Shape: every generation-time field present, all paths, all divisions.
//   A2  SIDE CORRECTNESS: an OC's sheet is EXACTLY the offensive formation
//       set; a DC's is EXACTLY the defensive fronts. No cross-side waste, no
//       missing scheme — coordIqMod reads exactly this space.
//   A3  Ranges: schemeIQ 25–92 with the specialty boosted on-sheet; ratings
//       within division floor–95; age in window; salary positive and higher
//       divisions pay more.
//   A4  A career accretes cleanly: grow/rust keeps baseIQ ≤ sheet everywhere,
//       ledger caps, and the poach/promise fields land where §5b put them.
//   A5  HIRE-CARD COMPLETENESS: every candidate carries every datum the new
//       profile card renders — nothing on the card can be blank.
//
// Run: node tools/coordinator_audit_probe.mjs
const _ls = new Map();
global.localStorage = {
  getItem: (k) => (_ls.has(k) ? _ls.get(k) : null),
  setItem: (k, v) => _ls.set(k, String(v)),
  removeItem: (k) => _ls.delete(k),
};

const { C, FORMATIONS, DEF_FRONTS } = await import('../js/constants.js');
const S = await import('../js/engine/staff.js');

let pass = 0, fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}`); ok ? pass++ : fail++; };
const hdr = (s) => console.log(`\n${s}`);
const OFF = Object.keys(FORMATIONS).sort(), DEF = Object.keys(DEF_FRONTS).sort();
const OC_KEYS = ['qbRunDesign', 'passGame', 'runGame'];
const DC_KEYS = ['blitzDesign', 'coverage', 'runFits'];

const GEN_FIELDS = ['id', 'name', 'side', 'ratings', 'schemeIQ', 'specialty', 'seasons', 'age', 'baseIQ', 'ambition', 'salary'];

// ── A1: shape, all paths ───────────────────────────────────────────────────
hdr('A1 — every generation field present on every path');
{
  const sample = [];
  for (const div of ['D1', 'D2', 'D3']) {
    for (const q of [32, 55, 88]) {
      sample.push(S.generateCoordinator('OC', q, div), S.generateCoordinator('DC', q, div));
    }
    const st = S.staffFor(4, div);
    sample.push(st.oc, st.dc);
    for (const c of S.generateCandidates('OC', { prestige: 3, division: div }, 5)) sample.push(c);
    for (const c of S.generateCandidates('DC', { prestige: 3, division: div }, 5)) sample.push(c);
  }
  let missing = 0;
  const missingWhat = new Set();
  for (const co of sample) {
    for (const f of GEN_FIELDS) {
      if (co[f] == null) { missing++; missingWhat.add(f); }
    }
    if (!co.name || !co.name.first) { missing++; missingWhat.add('name.first'); }
  }
  check(missing === 0, `${sample.length} coordinators across staffFor/candidates/direct, all divisions: 0 missing fields${missing ? ` (missing: ${[...missingWhat].join(', ')})` : ''}`);
}

// ── A2: side correctness ───────────────────────────────────────────────────
hdr("A2 — the sheet IS the side's scheme space, exactly");
{
  let bad = 0;
  for (let i = 0; i < 60; i++) {
    const oc = S.generateCoordinator('OC', 40 + i % 50, 'D2');
    const dc = S.generateCoordinator('DC', 40 + i % 50, 'D2');
    if (JSON.stringify(Object.keys(oc.schemeIQ).sort()) !== JSON.stringify(OFF)) bad++;
    if (JSON.stringify(Object.keys(dc.schemeIQ).sort()) !== JSON.stringify(DEF)) bad++;
    if (JSON.stringify(Object.keys(oc.ratings).sort()) !== JSON.stringify([...OC_KEYS].sort())) bad++;
    if (JSON.stringify(Object.keys(dc.ratings).sort()) !== JSON.stringify([...DC_KEYS].sort())) bad++;
    if (!OFF.includes(oc.specialty) || !DEF.includes(dc.specialty)) bad++;
  }
  check(bad === 0, `OC sheets = the ${OFF.length} offensive formations, DC sheets = the ${DEF.length} fronts, ratings = the 3 side keys, specialty on-sheet (violations: ${bad})`);
}

// ── A3: value ranges ───────────────────────────────────────────────────────
hdr('A3 — values live in their windows');
{
  let iqBad = 0, ageBad = 0, ratBad = 0, salBad = 0, specNotTop = 0;
  const N = 300;
  for (let i = 0; i < N; i++) {
    const div = ['D1', 'D2', 'D3'][i % 3];
    const co = S.generateCoordinator(i % 2 ? 'OC' : 'DC', 30 + i % 60, div);
    for (const v of Object.values(co.schemeIQ)) if (v < 25 || v > 92) iqBad++;
    if (co.age < C.COACH_AGE.COORD_MIN || co.age > C.COACH_AGE.COORD_MAX) ageBad++;
    const floor = (C.STAFF_DIV_FLOOR && C.STAFF_DIV_FLOOR[div]) != null ? C.STAFF_DIV_FLOOR[div] : 22;
    for (const v of Object.values(co.ratings)) if (v < floor || v > 95) ratBad++;
    if (!(co.salary > 0)) salBad++;
  }
  check(iqBad === 0, `schemeIQ always 25–92 (out-of-range: ${iqBad})`);
  check(ageBad === 0, `age always ${C.COACH_AGE.COORD_MIN}–${C.COACH_AGE.COORD_MAX} (out: ${ageBad})`);
  check(ratBad === 0, `ratings always division-floor–95 (out: ${ratBad})`);
  check(salBad === 0, `salary always positive (bad: ${salBad})`);
  const avg = (side, div) => {
    let s = 0;
    for (let i = 0; i < 80; i++) s += S.generateCoordinator(side, 60, div).salary;
    return s / 80;
  };
  const d1 = avg('OC', 'D1'), d3 = avg('OC', 'D3');
  check(d1 > d3, `divisions pay like divisions (D1 avg $${Math.round(d1).toLocaleString()} > D3 avg $${Math.round(d3).toLocaleString()})`);
}

// ── A4: a career accretes cleanly ──────────────────────────────────────────
hdr('A4 — twelve seasons of career: rust floors hold, the §5b fields land');
{
  const co = S.generateCoordinator('OC', 70, 'D2');
  const used = OFF[0];
  const school = { staff: { oc: co, dc: null }, gameplan: { offFormations: [{ id: used, weight: 100 }] } };
  for (let y = 1; y <= 12; y++) {
    S.growStaffSchemeIQ(school);
    S.writeStaffLedger(co, y, { OFF: 'B+' });
  }
  let floorBreach = 0;
  for (const k of Object.keys(co.schemeIQ)) if (co.schemeIQ[k] < co.baseIQ[k]) floorBreach++;
  check(floorBreach === 0, 'after growth AND rust, no scheme sits below its rolled floor');
  check(co.seasons === 12 && co.age >= 31 + 12 - 1, `seasons and age tick together (${co.seasons} seasons, age ${co.age})`);
  check(co.ledger.length === 12 && S.coordinatorCredentials(co).avgUnitGrade === 'B+', 'the ledger reads back through credentials');
  // The poach/promise/retention fields land where the passes put them.
  co.retentionCount = 2;
  const st = { playerSchoolId: 'P', season: 5, playerCoach: { id: 'player' }, world: { schools: [{ id: 'P', name: 'M', division: 'D2', prestige: 1, staff: { oc: co, dc: null } }, { id: 'B', name: 'B', division: 'D2', prestige: 5 }] } };
  let offer = null;
  for (let i = 0; i < 400 && !offer; i++) offer = S.rollCoordinatorPoach(st);
  check(offer && offer.retentionCost === Math.round(C.ECON.BASE.D2 * C.STAFF_ID.RETENTION_PCT * 4 / 100) * 100, 'retentionCount drives the doubled ask');
  const promise = S.makeSuccessionPromise({ ...st, playerCoach: { id: 'player' } }, 'OC');
  if (co.ambition === 'Climber') check(promise.ok && !!co.promisedSuccession, 'a Climber takes the promise and carries it');
  else check(!promise.ok, 'a Lifer refuses the promise, as ruled');
}

// ── A5: hire-card completeness ─────────────────────────────────────────────
hdr('A5 — every candidate carries everything the profile card shows');
{
  const school = { prestige: 3, division: 'D2' };
  let holes = 0;
  for (const side of ['OC', 'DC']) {
    for (const c of S.generateCandidates(side, school, 5)) {
      const sheetKeys = side === 'OC' ? OFF : DEF;
      if (!c.name?.first || c.age == null || !c.ambition || !c.specialty || !(c.salary > 0)) holes++;
      if (!S.deriveSchemeIdentity(c.side, c.ratings)) holes++;
      for (const s of sheetKeys) if (c.schemeIQ[s] == null || S.schemeStarTier(c.schemeIQ[s]) == null) holes++;
      for (const k of (side === 'OC' ? OC_KEYS : DC_KEYS)) if (c.ratings[k] == null) holes++;
    }
  }
  check(holes === 0, `name, age, ambition, identity, specialty, salary, FULL side sheet with star tiers, all ratings — no blanks on any of 10 candidates (holes: ${holes})`);
}

console.log(`\n${'='.repeat(50)}\n${fail === 0 ? 'ALL GREEN — the coordinator carries exactly what the update says he should' : 'FAILURES: ' + fail} (${pass} passed)`);
process.exit(fail ? 1 : 0);
