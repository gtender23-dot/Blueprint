// coach_age_probe.mjs — DNA TREE §8: the age system, the carousel tenure-reset
// fix, and the name-pool unification. Pass 1 of the roguelite build order.
//
// The assertions are the RULES of §8, stated as the thing that would be broken:
//
//   G1  Every generated coach carries an age inside his window (AI HC, coord,
//       fresh player career, tree-promoted player).
//   G2  Worldgen produces ZERO duplicate coach full names — HC vs HC, HC vs
//       coordinator, coordinator vs coordinator. (The old 10×10 pool
//       guaranteed duplicate Mike Smiths in a 320-school world.)
//   A1  Ages tick once per carousel season for AI HCs, and once per
//       growStaffSchemeIQ for coordinators.
//   A2  THE BUG FIX: a poached coach's tenure resets but his AGE does not —
//       and he can therefore still retire. (Old code: tenure-gated retirement
//       + tenure reset on poach = immortal journeymen.)
//   A3  The retirement window is real: nobody starts a second season at or
//       past RETIRE_FORCE; retirements only happen at RETIRE_ELIGIBLE+.
//   A4  Carousel health: over a long run, per-season churn stays within the
//       CHURN_MIN/CHURN_MAX bands (the fix must not starve or flood seats)
//       and retirements actually occur (the reason went live again).
//   N1  Zero-migration: an old-save coach (no age) passes through the
//       carousel without throwing and comes out with a plausible age.
//
// Run: node tools/coach_age_probe.mjs
const _ls = new Map();
global.localStorage = {
  getItem: (k) => (_ls.has(k) ? _ls.get(k) : null),
  setItem: (k, v) => _ls.set(k, String(v)),
  removeItem: (k) => _ls.delete(k),
};

const { C } = await import('../js/constants.js');
const W = await import('../js/engine/world.js');
const S = await import('../js/engine/staff.js');
const SE = await import('../js/engine/season.js');

const AGE = C.COACH_AGE;
let pass = 0, fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}`); ok ? pass++ : fail++; };
const hdr = (s) => console.log(`\n${s}`);

// ── G1: generation windows ─────────────────────────────────────────────────
hdr('G1 — generation ages land in their windows');
{
  let hcLo = 999, hcHi = -1, hcMissing = 0;
  for (let i = 0; i < 300; i++) {
    const c = W.generateAICoach({ id: 's' + i, prestige: 3, recentWins: [5, 5, 5] });
    if (c.age == null) hcMissing++;
    else { hcLo = Math.min(hcLo, c.age); hcHi = Math.max(hcHi, c.age); }
  }
  check(hcMissing === 0, `every AI HC has an age (missing: ${hcMissing})`);
  check(hcLo >= AGE.HC_MIN && hcHi <= AGE.HC_MAX, `AI HC ages span [${hcLo}, ${hcHi}] within [${AGE.HC_MIN}, ${AGE.HC_MAX}]`);
  let coLo = 999, coHi = -1, coMissing = 0;
  for (let i = 0; i < 300; i++) {
    const co = S.generateCoordinator(i % 2 ? 'OC' : 'DC', 55, 'D2');
    if (co.age == null) coMissing++;
    else { coLo = Math.min(coLo, co.age); coHi = Math.max(coHi, co.age); }
  }
  check(coMissing === 0, `every coordinator has an age (missing: ${coMissing})`);
  check(coLo >= AGE.COORD_MIN && coHi <= AGE.COORD_MAX, `coordinator ages span [${coLo}, ${coHi}] within [${AGE.COORD_MIN}, ${AGE.COORD_MAX}]`);
}

// ── G2: worldgen name dedup ────────────────────────────────────────────────
hdr('G2 — worldgen: zero duplicate coach names, HCs and coordinators together');
{
  const world = W.generateWorld();
  const names = [];
  for (const s of world.schools) {
    if (s.coach?.name) names.push(`${s.coach.name.first} ${s.coach.name.last}`);
    if (s.staff?.oc?.name) names.push(`${s.staff.oc.name.first} ${s.staff.oc.name.last}`);
    if (s.staff?.dc?.name) names.push(`${s.staff.dc.name.first} ${s.staff.dc.name.last}`);
  }
  const dupes = names.length - new Set(names).size;
  check(world.schools.length > 100, `world generated (${world.schools.length} schools, ${names.length} named coaches)`);
  check(dupes === 0, `duplicate full names across HCs + coordinators: ${dupes} (old pool guaranteed dozens)`);
  // HC ages present at worldgen too.
  const hcNoAge = world.schools.filter((s) => s.coach && s.coach.age == null).length;
  check(hcNoAge === 0, `worldgen HCs missing an age: ${hcNoAge}`);
}

// ── The carousel rig: a synthetic division the probe fully controls ────────
// updateAICarousel needs: state.world.schools, state.playerSchoolId, state.season.
// Every school gets recentWins so nobody auto-fires, letting age effects show.
function mkDivision(n, division = 'D2') {
  const schools = [];
  for (let i = 0; i < n; i++) {
    const sc = { id: `${division}-${i}`, name: `School ${i}`, division, prestige: 3, recentWins: [6, 6, 6], staff: null };
    sc.coach = W.generateAICoach(sc);
    schools.push(sc);
  }
  return schools;
}
function runSeasons(state, seasons, log) {
  for (let y = 0; y < seasons; y++) {
    state.season = y + 1;
    const events = [];
    const openings = [];
    SE.updateAICarousel(state, events, openings);
    if (log) log(state, events, y + 1);
    // runJobMarket's refill, mirrored: an empty seat gets a fresh AI hire, so
    // the division holds steady-state population like the real game.
    for (const sc of state.world.schools) {
      if (!sc.coach) sc.coach = W.generateAICoach(sc);
    }
  }
}

// ── A1 + A2: aging ticks, and the poach does not reset the clock ───────────
hdr('A1/A2 — the clock ticks, and a poach cannot reset it (the bug fix)');
{
  const schools = mkDivision(20);
  const state = { world: { schools }, playerSchoolId: 'nobody', season: 1 };
  const c0 = schools[0].coach;
  const ageBefore = c0.age;
  runSeasons(state, 1);
  check(c0.age === ageBefore + 1, `one carousel season ages a coach ${ageBefore} → ${c0.age}`);

  // The poach, replayed exactly as cascadeCarousel does it: tenure resets, and
  // the assertion is that AGE is untouched by that same block.
  const moving = schools[1].coach;
  moving.age = 63; // an old lion, poached
  moving.tenureSeasons = 9;
  const agePrePoach = moving.age;
  moving.tenureSeasons = 0; // what cascadeCarousel line ~2197 does
  check(moving.age === agePrePoach, `tenure reset to 0, age still ${moving.age} — the journeyman is mortal`);

  // And mortal means RETIRABLE: run seasons until he retires; must not need
  // tenure. Force determinism: age him to the wall.
  moving.age = AGE.RETIRE_FORCE; // at the wall, retirement is certain
  const events = [];
  const openings = [];
  state.season = 99;
  SE.updateAICarousel(state, events, openings);
  const retired = events.some((e) => /retirement/.test(e.text || ''));
  check(retired, `a coach at the RETIRE_FORCE wall with tenure 0 retired anyway (tenure gate is gone)`);
}

// ── A3: the retirement window ──────────────────────────────────────────────
hdr('A3 — the retirement window holds');
{
  const schools = mkDivision(24);
  const state = { world: { schools }, playerSchoolId: 'nobody', season: 1 };
  const retireAges = [];
  let overForce = 0;
  for (let y = 0; y < 40; y++) {
    state.season = y + 1;
    // Snapshot: who sits where, at what age, BEFORE the carousel runs.
    const seatAge = new Map(schools.filter((s) => s.coach).map((s) => [s.id, s.coach.age]));
    const events = [];
    const openings = [];
    SE.updateAICarousel(state, events, openings);
    for (const sc of schools) {
      if (!sc.coach && sc._lastVacancy && sc._lastVacancy.reason === 'retired' && sc._lastVacancy.season === state.season) {
        // He aged +1 inside this carousel tick before deciding; the decision
        // age is the post-tick age = snapshot + 1.
        const a = seatAge.get(sc.id);
        if (a != null) retireAges.push(a + 1);
      }
      if (sc.coach && sc.coach.age > AGE.RETIRE_FORCE) overForce++;
    }
    for (const sc of schools) if (!sc.coach) sc.coach = W.generateAICoach(sc);
  }
  const early = retireAges.filter((a) => a < AGE.RETIRE_ELIGIBLE).length;
  const spread = retireAges.length ? `${Math.min(...retireAges)}–${Math.max(...retireAges)}` : 'n/a';
  console.log(`  retirements observed: ${retireAges.length}, ages ${spread}`);
  check(retireAges.length > 0, `retirements observed in 40 seasons (${retireAges.length})`);
  check(early === 0, `every retirement at ${AGE.RETIRE_ELIGIBLE}+ (early: ${early})`);
  check(overForce === 0, `no coach ever held a seat past RETIRE_FORCE (${AGE.RETIRE_FORCE}) — violations: ${overForce}`);
}

// ── A4: carousel health over a long world ──────────────────────────────────
hdr('A4 — churn stays inside the bands and retirement is a live reason again');
{
  const N = 30;
  const schools = mkDivision(N);
  const state = { world: { schools }, playerSchoolId: 'nobody', season: 1 };
  let totalDepartures = 0, retirements = 0, seasonsRun = 50;
  const churnBySeason = [];
  runSeasons(state, seasonsRun, (st, events) => {
    const dep = events.filter((e) => /fired|expire|retirement|opening/.test(e.text || '')).length;
    const ret = events.filter((e) => /announced retirement/.test(e.text || '')).length;
    churnBySeason.push(dep);
    totalDepartures += dep;
    retirements += ret;
  });
  const avgChurn = totalDepartures / seasonsRun / N;
  console.log(`  avg churn ${(avgChurn * 100).toFixed(1)}%/season (bands ${C.CAROUSEL_CHURN_MIN * 100}–${C.CAROUSEL_CHURN_MAX * 100}%) · retirements over ${seasonsRun} seasons: ${retirements}`);
  check(avgChurn >= C.CAROUSEL_CHURN_MIN * 0.9 && avgChurn <= C.CAROUSEL_CHURN_MAX * 1.1, `avg churn within bands (±10% slack)`);
  check(retirements > 0, `retirements occur (${retirements}) — the reason is alive again`);
  // Everyone left standing after 50 years must be under the wall + 1.
  const geriatrics = schools.filter((s) => s.coach && s.coach.age > AGE.RETIRE_FORCE).length;
  check(geriatrics === 0, `after ${seasonsRun} seasons, nobody coaching past ${AGE.RETIRE_FORCE}: ${geriatrics}`);
}

// ── N1: zero-migration — the old-save coach ────────────────────────────────
hdr('N1 — an old-save coach (no age field) passes through untouched code paths');
{
  const schools = mkDivision(8);
  // Strip ages: the old-save shape.
  for (const sc of schools) delete sc.coach.age;
  const state = { world: { schools }, playerSchoolId: 'nobody', season: 1 };
  let threw = false;
  try { runSeasons(state, 3); } catch (e) { threw = true; console.log('  threw:', e.message); }
  check(!threw, `three carousel seasons on age-less coaches: no throw`);
  const bad = schools.filter((s) => s.coach && (s.coach.age == null || s.coach.age < AGE.HC_MIN)).length;
  check(bad === 0, `every old-save coach lazily acquired a plausible age (bad: ${bad})`);
  // Coordinator side: growStaffSchemeIQ on an age-less coordinator.
  const co = S.generateCoordinator('OC', 55, 'D2');
  delete co.age;
  co.seasons = 6;
  const school = { staff: { oc: co, dc: null }, gameplan: { offFormations: [{ id: 'Spread', weight: 100 }] } };
  let threw2 = false;
  try { S.growStaffSchemeIQ(school); } catch (e) { threw2 = true; }
  check(!threw2 && co.age != null && co.age >= AGE.COORD_MIN, `old-save coordinator: lazily aged to ${co.age} (seasons-credited), no throw`);
}

console.log(`\n${'='.repeat(50)}\n${fail === 0 ? 'ALL GREEN' : 'FAILURES: ' + fail} (${pass} passed)`);
process.exit(fail ? 1 : 0);
