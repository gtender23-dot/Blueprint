// contract_ladder_probe.mjs — proves the D6 loyalty-ladder contract system
// (owner ruling 2026-08-11, replacing the recruitBonus/juice extension terms).
//
// Contract under test:
//   1. getExtensionOffer carries NO recruitBonus and NO juice — the money is the
//      ladder (offer.ladder: stacks/pct/nextPct/bump vs division base).
//   2. acceptExtension writes a contract WITHOUT recruitBonus and adds exactly
//      one retentionStack (the renewal raise), for any term.
//   3. declineOffersWithLeverage outside a contract year adds ONE stack AND one
//      year to the current contract; in the final contract year (or with no
//      contract) it adds the stack but does NOT extend.
//   4. The revenue line converts stacks to +10%-of-base each, capped at +100%
//      (12 stacks pay the same as 10) — the shipped retentionBonus path.
//   5. Legacy contracts keep their recruitBonus field untouched (season.js
//      honors old paper; new deals never mint one).
// Run: node tools/contract_ladder_probe.mjs
const _ls = new Map();
global.localStorage = {
  getItem: (k) => (_ls.has(k) ? _ls.get(k) : null),
  setItem: (k, v) => _ls.set(k, String(v)),
  removeItem: (k) => _ls.delete(k),
};

const { getExtensionOffer, acceptExtension, declineOffersWithLeverage } = await import('../js/engine/offseason.js');
const { initSeasonBudget } = await import('../js/engine/recruiting.js').then((m) => ({ initSeasonBudget: m.initSeasonBudget || m.computeSeasonRevenue || null }));
const R = await import('../js/engine/recruiting.js');
const { C } = await import('../js/constants.js');
const { generateWorld } = await import('../js/engine/world.js');

let failed = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}`); if (!ok) failed++; };

const world = generateWorld();
const school = world.schools.find((s) => s.division === 'D2') || world.schools[0];
const mkState = (coachOver = {}) => ({
  season: 5, day: 30, world, playerSchoolId: school.id,
  offseason: { data: {} }, awardsLog: [], allPlayoffs: {},
  playerCoach: {
    id: 'p', schoolId: school.id, status: 'employed', jobSecurity: 70,
    lastDelta: 1, retentionStacks: 0, contract: null, ...coachOver,
  },
});

console.log('=== CONTRACT LADDER PROBE ===\n');

// 1. Offer shape: ladder, no bonus money.
const s1 = mkState();
const offer = getExtensionOffer(s1);
check(!!offer, 'eligible coach gets an extension offer');
check(offer && offer.recruitBonus === undefined, 'offer carries NO recruitBonus');
check(offer && offer.juice === undefined, 'offer carries NO juice multipliers');
check(offer && offer.ladder && offer.ladder.nextPct === 10 && offer.ladder.stacks === 0, `offer.ladder present (next +${offer?.ladder?.nextPct}% from ${offer?.ladder?.stacks} stacks)`);
check(offer && offer.ladder.base === (C.ECON.BASE[school.division] || C.ECON.BASE.D3), 'ladder base = division base allocation');
// [PLAYTEST 2026-08-12 item 20] THE AD DECIDES THE LENGTH. There used to be three
// term cards (2/3/5yr) and the coach simply picked one. Now the offer carries
// exactly one term, its length derived from job security / last delta / tenure,
// and acceptExtension ignores whatever termId it is handed.
check(offer && (offer.terms || []).length === 1 && offer.terms.every((t) => t.recruitBonus === undefined), `one AD-set term (${offer?.terms?.[0]?.label} ${offer?.terms?.[0]?.years}yr), no bonus money`);
check(offer && offer.years === offer.terms[0].years, 'offer.years agrees with the term on the table');

// The AD's number tracks the resume: a hot-seat coach gets prove-it, a coach the
// program is built around gets the max. Same code path, three different answers.
const termFor = (over) => {
  const st = mkState(over);
  const o = getExtensionOffer(st);
  return o && o.terms[0];
};
const cold = termFor({ jobSecurity: 58, lastDelta: 0, tenureSeasons: 0 });
const warm = termFor({ jobSecurity: 70, lastDelta: 1, tenureSeasons: 1 });
const hot = termFor({ jobSecurity: 96, lastDelta: 3, tenureSeasons: 6 });
check(cold && cold.years === 2, `weak resume → Prove-It (${cold?.years}yr)`);
check(warm && warm.years === 3, `solid resume → Market (${warm?.years}yr)`);
check(hot && hot.years === 5, `elite resume → Max Deal (${hot?.years}yr)`);
check(cold.years < warm.years && warm.years < hot.years, 'length is monotone in what he has done for them');

// 2. Accepting a renewal = contract without recruitBonus + exactly one stack.
const adTermYears = offer.terms[0].years;
const res = acceptExtension(s1, 'max');
check(res.ok, 'acceptExtension succeeds');
check(s1.playerCoach.contract && s1.playerCoach.contract.recruitBonus === undefined, 'new contract has NO recruitBonus');
check(
  s1.playerCoach.contract.years === adTermYears && s1.playerCoach.contract.endSeason === 5 + adTermYears,
  `the AD's term is what gets written, not the caller's termId (${s1.playerCoach.contract.years}yr → end S${s1.playerCoach.contract.endSeason})`
);
check(s1.playerCoach.retentionStacks === 1, `renewal added exactly one loyalty stack (${s1.playerCoach.retentionStacks})`);

// 3a. Decline outside a contract year: +1 stack AND +1 year.
const s2 = mkState({ retentionStacks: 2, contract: { startSeason: 4, endSeason: 8, years: 4, termLabel: 'Market' } });
s2.pendingOffers = [{ schoolId: 'x', schoolName: 'X' }];
declineOffersWithLeverage(s2);
check(s2.playerCoach.retentionStacks === 3, 'decline adds one stack');
check(s2.playerCoach.contract.endSeason === 9 && s2.playerCoach.contract.years === 5, `decline mid-contract extends the deal (+1yr → end S${s2.playerCoach.contract.endSeason})`);

// 3b. Final contract year: stack yes, extension no.
const s3 = mkState({ retentionStacks: 0, contract: { startSeason: 3, endSeason: 5, years: 3, termLabel: 'Market' } });
s3.pendingOffers = [{ schoolId: 'x', schoolName: 'X' }];
declineOffersWithLeverage(s3);
check(s3.playerCoach.retentionStacks === 1 && s3.playerCoach.contract.endSeason === 5, 'in the final contract year: stack added, deal NOT extended');

// 3c. No contract: stack yes, no crash.
const s4 = mkState({ contract: null });
s4.pendingOffers = [{ schoolId: 'x', schoolName: 'X' }];
declineOffersWithLeverage(s4);
check(s4.playerCoach.retentionStacks === 1 && s4.playerCoach.contract === null, 'no contract: stack added, nothing invented');

// 4. Revenue: stacks → +10% of base each, capped at +100%.
// initBudget(coach, openSlots, carryover, school, season) applies the stacks.
const pay = (stacks) => {
  const c = { retentionStacks: stacks, budget: 0 };
  R.initBudget(c, 5, 0, school, 6);
  return (c.revenueBreakdown || {}).retentionBonus || 0;
};
const p3 = pay(3), p10 = pay(10), p12 = pay(12);
const base = C.ECON.BASE[school.division] || C.ECON.BASE.D3;
check(Math.abs(p3 - Math.round(base * 0.3 / 100) * 100) <= 100 && p3 > 0, `3 stacks pay ~30% of base ($${p3})`);
check(p10 > 0 && p10 === p12, `cap holds — 12 stacks pay the same as 10 ($${p12})`);

// 5. Legacy paper untouched.
const s5 = mkState({ contract: { startSeason: 2, endSeason: 7, years: 5, recruitBonus: 800, termLabel: 'Market' } });
s5.pendingOffers = [{ schoolId: 'x', schoolName: 'X' }];
declineOffersWithLeverage(s5);
check(s5.playerCoach.contract.recruitBonus === 800, 'legacy recruitBonus survives untouched on old paper');

console.log(failed === 0 ? '\nALL PASS ✅' : `\n${failed} FAILURES ❌`);
process.exit(failed === 0 ? 0 : 1);
