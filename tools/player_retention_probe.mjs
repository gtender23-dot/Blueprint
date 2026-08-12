// player_retention_probe.mjs — OWNER RULING Aug 2026: dynasty vs ladder.
//
// The choice, as ruled: every year the player holds another job offer and
// stays, the AD raises the recruiting pool by 10% of the division base —
// stacking, permanent, CAPPED at 100% of that allocation. Taking any job
// forfeits the entire stack.
//
//   R1  Declining live offers stacks +1 (and still grants the old jobSecurity
//       leverage). Declining with NO offers on the table stacks nothing.
//   R2  The money is exact: initBudget adds stacks × 10% × C.ECON.BASE[div],
//       ledger-visible, on top of everything else.
//   R3  THE CAP: stack 15 pays exactly 100% of the base — double money, no
//       more. Ten declined calls is the summit.
//   R4  THE FORFEIT: acceptJob zeroes the stack — climbing costs the dynasty.
//   N1  Zero-migration: an old-save coach (no field) reads as stack 0
//       everywhere, no throw.
//
// Run: node tools/player_retention_probe.mjs
const _ls = new Map();
global.localStorage = {
  getItem: (k) => (_ls.has(k) ? _ls.get(k) : null),
  setItem: (k, v) => _ls.set(k, String(v)),
  removeItem: (k) => _ls.delete(k),
};

const { C } = await import('../js/constants.js');
const O = await import('../js/engine/offseason.js');
const R = await import('../js/engine/recruiting.js');
const SE = await import('../js/engine/season.js');

let pass = 0, fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}`); ok ? pass++ : fail++; };
const hdr = (s) => console.log(`\n${s}`);

const mkSchool = (div = 'D2') => ({ id: 'A', name: 'Harbor State', division: div, prestige: 3, facilities: {}, recentWins: [6], staff: { oc: null, dc: null } });
const budgetFor = (coach, div = 'D2') => {
  const c = { ...coach, budget: 0, revenueBreakdown: null };
  R.initBudget(c, 20, 0, mkSchool(div), 6);
  return { budget: c.budget, rev: c.revenueBreakdown, coach: c };
};

// ── R1: the stack site ─────────────────────────────────────────────────────
hdr('R1 — declining live offers stacks the raise; empty declines do not');
{
  const st = { playerCoach: { jobSecurity: 50 }, pendingOffers: [{ schoolId: 'B' }, { schoolId: 'C' }] };
  const n = O.declineOffersWithLeverage(st);
  check(n === 2 && st.playerCoach.retentionStacks === 1, `two suitors, one decline action → stack 1 (one season of "I'm staying")`);
  check(st.playerCoach.jobSecurity === 50 + C.OFFER_LEVERAGE_JS, 'the old jobSecurity leverage still rides along');
  const n2 = O.declineOffersWithLeverage(st);
  check(n2 === 0 && st.playerCoach.retentionStacks === 1, 'declining an empty table stacks nothing');
  st.pendingOffers = [{ schoolId: 'D' }];
  O.declineOffersWithLeverage(st);
  check(st.playerCoach.retentionStacks === 2, 'next season, another call, another decline → stack 2');
}

// ── R2: the money, exact ───────────────────────────────────────────────────
hdr('R2 — stacks × 10% of the division base, ledger-visible');
{
  const base = C.ECON.BASE.D2;
  const zero = budgetFor({ retentionStacks: 0 });
  const one = budgetFor({ retentionStacks: 1 });
  const three = budgetFor({ retentionStacks: 3 });
  check(one.budget - zero.budget === Math.round(base * 0.1 / 100) * 100, `stack 1 pays exactly 10% of D2 base (+$${(one.budget - zero.budget).toLocaleString()})`);
  check(three.budget - zero.budget === Math.round(base * 0.3 / 100) * 100, `stack 3 pays exactly 30% (+$${(three.budget - zero.budget).toLocaleString()})`);
  check(three.rev.retentionBonus === three.budget - zero.budget && three.rev.retentionStacks === 3, 'the ledger carries the line and the count — the raise is legible');
  check(zero.rev.retentionBonus == null, 'no stacks, no line');
}

// ── R3: the cap ────────────────────────────────────────────────────────────
hdr('R3 — ten declined calls is the summit: 100% of base, never more');
{
  const base = C.ECON.BASE.D2;
  const zero = budgetFor({ retentionStacks: 0 });
  const ten = budgetFor({ retentionStacks: 10 });
  const fifteen = budgetFor({ retentionStacks: 15 });
  check(ten.budget - zero.budget === Math.round(base * 1 / 100) * 100, `stack 10 pays exactly 100% of the base (+$${(ten.budget - zero.budget).toLocaleString()} — double money)`);
  check(fifteen.budget === ten.budget, 'stack 15 pays the same — the cap holds');
  // The cap is division-scaled: a D1 dynasty caps at the D1 base.
  const zeroD1 = budgetFor({ retentionStacks: 0 }, 'D1');
  const tenD1 = budgetFor({ retentionStacks: 10 }, 'D1');
  check(tenD1.budget - zeroD1.budget === Math.round(C.ECON.BASE.D1 * 1 / 100) * 100, `and it scales with the division (D1 cap +$${(tenD1.budget - zeroD1.budget).toLocaleString()})`);
  // And D3 — the small-school dynasty pays on the same law (owner-confirmed).
  const zeroD3 = budgetFor({ retentionStacks: 0 }, 'D3');
  const oneD3 = budgetFor({ retentionStacks: 1 }, 'D3');
  const tenD3 = budgetFor({ retentionStacks: 10 }, 'D3');
  check(oneD3.budget - zeroD3.budget === Math.round(C.ECON.BASE.D3 * 0.1 / 100) * 100 && tenD3.budget - zeroD3.budget === Math.round(C.ECON.BASE.D3 * 1 / 100) * 100, `D3 works identically: +$${(oneD3.budget - zeroD3.budget).toLocaleString()}/stack, capped at +$${(tenD3.budget - zeroD3.budget).toLocaleString()}`);
}

// ── R4: the forfeit ────────────────────────────────────────────────────────
hdr('R4 — taking any job forfeits every raise');
{
  const schools = [
    { id: 'A', name: 'Harbor State', division: 'D2', prestige: 3, staff: { oc: null, dc: null }, coach: null, roster: [], gameplan: {}, recentWins: [6], facilities: {} },
    { id: 'B', name: 'Bigger U', division: 'D1', prestige: 5, staff: { oc: null, dc: null }, coach: null, roster: [], gameplan: {}, recentWins: [8], facilities: {}, _lastVacancy: { reason: 'fired', season: 4 } },
  ];
  const pc = { id: 'player', isAI: false, name: { first: 'A', last: 'V' }, status: 'employed', retentionStacks: 7, jobSecurity: 80, tenureSeasons: 9, skills: {}, recruitBoard: [], scouted: {} };
  schools[0].coach = pc;
  const st = { season: 10, day: 1, playerSchoolId: 'A', playerCoach: pc, world: { schools, recruits: [] }, pendingOffers: [{ schoolId: 'B' }], jobOpenings: [{ schoolId: 'B' }], inbox: [] };
  let threw = false, res = null;
  try { res = SE.acceptJob(st, 'B'); } catch (e) { threw = true; console.log('  threw:', e.message); }
  check(!threw && res && res.ok !== false, 'acceptJob runs on the rig');
  check(pc.retentionStacks === 0, `seven seasons of loyalty raises: forfeited the day he climbed (stacks ${pc.retentionStacks})`);
}

// ── N1: zero-migration ─────────────────────────────────────────────────────
hdr('N1 — an old-save coach without the field');
{
  let threw = false;
  let out = null;
  try { out = budgetFor({}); } catch (e) { threw = true; }
  check(!threw && out.rev.retentionBonus == null, 'no field = stack 0, no line, no throw');
  const st = { playerCoach: { jobSecurity: 50 }, pendingOffers: [{ schoolId: 'B' }] };
  O.declineOffersWithLeverage(st);
  check(st.playerCoach.retentionStacks === 1, 'and his first decline starts the stack from zero');
}

console.log(`\n${'='.repeat(50)}\n${fail === 0 ? 'ALL GREEN — the dynasty pays, the ladder costs' : 'FAILURES: ' + fail} (${pass} passed)`);
process.exit(fail ? 1 : 0);
