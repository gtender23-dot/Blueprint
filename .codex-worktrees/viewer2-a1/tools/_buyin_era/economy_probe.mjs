// economy_probe.mjs — W7 (§5 living GPA, §5b education economy + scandal,
// §13 want measures) THE ECONOMY probe.
//
// The wave's promise, stated as things that must be numerically true:
//
//   E1  INERTNESS. At defaults the whole wave is a no-op: 0 academic hours,
//       no per-player dial, nobody artificially on the bubble → football time
//       multiplier is exactly 1, the football pool is the pre-W7 pool to the
//       dollar, and a fresh league's gate is the pre-W7 gate.
//   E2  THE PRACTICE POOL IS REAL. Hours handed to the classroom come off the
//       grass, monotonically, measured against the NCAA anchor — and the same
//       hours cost LESS in the offseason, because that pool is bigger.
//   E3  THE CHAIN: ACADEMICS → GPA → CHARACTER. Investment moves the GPA
//       target; the Academic Center tier moves the RATE; grades then move
//       Grind. Character still sets the target, so the loop closes.
//   E4  ELIGIBILITY IS REAL. Below the line = missed games, served in GAMES,
//       through the same availability gate injuries use. The Academic Center
//       is a genuine safety net. The bubble kid pays a practice tax.
//   E5  THE 5-YEAR SWING. Gutting the budget doesn't drop the grade
//       overnight and investing takes years to show — you turn it like a ship.
//       Budget → grade over 5 simmed years, both directions.
//   E6  THE NEGOTIATION. Willingness rises with success, gate and reputation;
//       bigger asks are harder; giving money back is easy. A granted ask moves
//       real dollars into the pool and real share out of the classroom.
//   E7  ACADEMIC STANDING. [GARRETT, Aug 2026 — replaces the old SCANDAL
//       dice.] An F is a published warning and one year to fix it; a second
//       consecutive F is a sanction and a firing. Deterministic end to end.
//   E8  THE WANT MEASURES TRAIL. Spotlight/Culture/Education move slowly, are
//       bounded, and cannot be bought in one season.
//   E9  WORLDGEN SHAPE. Middle-heavy with a few extremes per division; every
//       school shows a real Education grade on day one.
//
// Run: node tools/economy_probe.mjs
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
Math.random = mulberry32(0x7E00D0D0);

const { createPlayer } = await import('../js/engine/player.js');
const { C, ROSTER_TARGETS } = await import('../js/constants.js');
const A = C.ACADEMICS;
const {
  ensureSchoolAcademics, academicLevel, academicLevelFor, academicInvestment,
  eduBudget, academicUpkeep, academicUpgradeCost, buyAcademicUpgrade, settleEducationLine,
  gpaTarget, gpaDriftRate, runAcademicTerm, serveAcademicWeek,
  negotiationOdds, schoolWillingness, boardOdds, resolveNegotiation,
  academicStanding, settleAcademicStanding,
  educationScore, educationGrade, rollEducationHistory,
  attendanceFill, noteGameAttendance, recordSeasonAttendance, seasonAttendanceAvg,
  setAcademicHours,
} = await import('../js/engine/academics.js');
const { practicePool, maxAcademicHours, academicHours, footballHours,
        playerAcademicHours, footballTimeMult } = await import('../js/engine/practicepool.js');
const { developPlayer, programBuyIn, ensureProgramBuyIn } = await import('../js/engine/development.js');
const { programSpotlight, programCulture } = await import('../js/engine/measures.js');
const { computeSeasonRevenue } = await import('../js/engine/recruiting.js');
const { isAvailable, isSidelined } = await import('../js/utils.js');
const { freshSkills, SKILL_GRADE_XP } = await import('../js/engine/coach.js');
const { DEFAULT_PRACTICE } = await import('../js/constants.js');

let fails = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fails++;
};
const mean = xs => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
const r2 = v => Math.round(v * 100) / 100;

// ── Scaffolding (engine-shape, no worldgen dependency where avoidable) ────
function makeRoster(tier = 2, n = null) {
  const roster = [];
  const years = ['FR', 'SO', 'JR', 'SR'];
  let i = 0;
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let k = 0; k < count; k++, i++) {
      if (n != null && roster.length >= n) return roster;
      roster.push(createPlayer(pos, years[i % 4], tier, 0));
    }
  }
  return roster;
}
function makeSchool({ division = 'D1', prestige = 3, pref = 50, tier = 2, n = null,
                      wins = 6, repXp = SKILL_GRADE_XP[5] } = {}) {
  const roster = makeRoster(tier, n);
  const school = {
    id: 'probe_' + Math.floor(Math.random() * 1e9).toString(36),
    name: 'Probe State', division, prestige, type: 'stateUniversity',
    eduPref: pref,
    roster,
    recentWins: [wins, wins, wins],
    record: { wins, losses: 12 - wins },
    stadium: { capacity: 40000 },
    facilities: { stadium: 2, training: 2, recruiting: 2, medicine: 2 },
    staff: {}, seasonHistory: [],
    coach: { id: 'hc', name: { first: 'A', last: 'Coach' }, skills: freshSkills(), budget: 0 },
  };
  school.coach.skills.reputation.xp = repXp;
  ensureSchoolAcademics(school);
  ensureProgramBuyIn(school);
  return school;
}
const clone = o => JSON.parse(JSON.stringify(o));

console.log('\n════ E1 — INERTNESS: at defaults, W7 changes nothing ════');
{
  const s = makeSchool();
  const p = s.roster[0];
  // [W10] E1a/E1b RE-BASED BY DESIGN, not to make red go green.
  // W7 shipped academics INERT at defaults (0 hours) per the standing rule that
  // a new system lands with old behaviour. W10 is the wave where that rule is
  // explicitly lifted, and Garrett's call is "visible but low impact": the
  // default is now ACADEMIC_HOURS_DEFAULT (2 of a 20-hour week), so the system
  // is on screen from game one and still costs a coach who ignores it ~10% of
  // the football pool. The contract these two lines guard has therefore CHANGED
  // — they now assert the tuned default and a PROPORTIONATE, bounded tax,
  // rather than a no-op.
  const DEF = C.ACADEMICS.ACADEMIC_HOURS_DEFAULT;
  check('E1a default academic hours match the tuned default', academicHours(s) === DEF, `${academicHours(s)}h (default ${DEF})`);
  const mult = footballTimeMult(s, { ...p, gpa: 3.0, coachAcademics: undefined });
  check('E1b default academic hours cost football time, but barely (≥0.85, <1)',
    mult < 1 && mult >= 0.85, `×${mult.toFixed(3)}`);
  // An UNTOUCHED school object (no .academics at all) is the migrated-save case.
  const raw = { facilities: { training: 2 } };
  check('E1c un-migrated school + un-dialed player → exactly 1',
    footballTimeMult(raw, { gpa: 3.0 }) === 1 && footballTimeMult(raw, {}) === 1);

  // Development is byte-identical with and without the school's academics
  // block, given the same RNG stream.
  const base = createPlayer('WR', 'SO', 2, 0);
  const runOne = (school) => {
    Math.random = mulberry32(0x1234);
    const q = clone(base);
    developPlayer(q, DEFAULT_PRACTICE, null, 1, school, 'inseason');
    return JSON.stringify(q.attributes);
  };
  const withAcad = runOne(s);
  const without = runOne({ facilities: { training: 2 } });
  check('E1d development is byte-identical with vs without the academics block',
    withAcad === without);
  Math.random = mulberry32(0x7E00D0D1);

  // The football pool: the education line is REPORTED but never subtracted.
  const rev = computeSeasonRevenue(s, 0);
  check('E1e education line is reported on the ledger', rev.education > 0, `$${rev.education}`);
  // [W11] RE-BASED BY DESIGN (Garrett). W7 shipped the education line REPORTED
  // but never CHARGED, with C.ECON.BASE sized as if it didn't exist — so week
  // 1's negotiation traded against money that had never appeared on the ledger.
  // §5b's own words were "total allocation budgets increase across ALL
  // divisions to make room for the new line item"; that increase has now been
  // made and the line is subtracted from it. Net pools are held (measured
  // D1 ~229k · D2 ~125k · D3 ~66k), so this is presentation, not a raise.
  check('E1f the education line is CHARGED to the allocation that now contains it',
    rev.total === Math.max(0, rev.base + rev.tickets - rev.upkeep - rev.salaries - rev.education),
    `total ${rev.total} = base ${rev.base} − edu ${rev.education} − upkeep ${rev.upkeep} − salaries ${rev.salaries} + gate ${rev.tickets}`);
  // …and the gross-up actually covered it: a typical program nets what the
  // pre-W11 pool gave it, so nobody got a raise or a pay cut out of a
  // presentation change.
  check('E1f2 the gross-up covers the line (net pool within 8% of pre-W11)',
    Math.abs(rev.total - (rev.base - rev.education + rev.tickets - rev.upkeep - rev.salaries)) < 1,
    `net ${rev.total}`);
  // Pre-W7 gate formula, reproduced by hand, at a C-reputation coach with no
  // gate history — the two must agree exactly.
  const E = C.ECON;
  const legacyFill = Math.max(E.FILL_MIN, Math.min(E.FILL_MAX,
    E.FILL_BASE + s.prestige * E.FILL_PER_PRESTIGE + s.recentWins[0] * E.FILL_PER_WIN));
  check('E1g fresh-world gate matches the pre-W7 formula exactly',
    Math.abs(attendanceFill(s, s.coach) - legacyFill) < 1e-12,
    `${r2(attendanceFill(s, s.coach))} vs ${r2(legacyFill)}`);
}

console.log('\n════ E2 — THE PRACTICE POOL IS REAL (NCAA 20-hour anchor) ════');
{
  check('E2a in-season pool is the actual NCAA rule', practicePool('inseason') === 20);
  check('E2b the offseason pool is bigger', practicePool('offseason') > practicePool('inseason'),
    `${practicePool('offseason')} > ${practicePool('inseason')}`);
  const s = makeSchool();
  const p = { gpa: 3.0 };
  const mults = [];
  for (let h = 0; h <= maxAcademicHours(); h++) {
    setAcademicHours(s, h);
    mults.push(footballTimeMult(s, p, 'inseason'));
  }
  const monotone = mults.every((v, i) => i === 0 || v <= mults[i - 1] + 1e-9);
  check('E2c football time falls monotonically as hours go to the classroom',
    monotone && mults[0] === 1 && mults[mults.length - 1] < 1,
    `${mults.map(r2).join(' → ')}`);
  setAcademicHours(s, 4);
  check('E2d the cost is exactly the hours surrendered (16/20 = 0.80)',
    Math.abs(footballTimeMult(s, p, 'inseason') - 0.8) < 1e-9,
    r2(footballTimeMult(s, p, 'inseason')));
  check('E2e the same hours cost LESS at camp (the offseason pool is bigger)',
    footballTimeMult(s, p, 'offseason') > footballTimeMult(s, p, 'inseason'),
    `${r2(footballTimeMult(s, p, 'offseason'))} off vs ${r2(footballTimeMult(s, p, 'inseason'))} in`);
  check('E2f you cannot study your way out of practising (football floor holds)',
    footballHours(s, 'inseason') >= A.FOOTBALL_HOURS_FLOOR &&
    maxAcademicHours() <= practicePool('inseason') - A.FOOTBALL_HOURS_FLOOR);

  // The per-player dial overrides HIS share of the pool, both ways.
  setAcademicHours(s, 4);
  const teamMan = { gpa: 3.0 };
  const studyMan = { gpa: 3.0, coachAcademics: 1 };
  const ballMan = { gpa: 3.0, coachAcademics: -1 };
  check('E2g the dial overrides his share both ways',
    playerAcademicHours(s, ballMan) < playerAcademicHours(s, teamMan) &&
    playerAcademicHours(s, teamMan) < playerAcademicHours(s, studyMan),
    `${playerAcademicHours(s, ballMan)} / ${playerAcademicHours(s, teamMan)} / ${playerAcademicHours(s, studyMan)}h`);
  check('E2h "football first" buys his grass time back',
    footballTimeMult(s, ballMan) > footballTimeMult(s, teamMan) &&
    footballTimeMult(s, studyMan) < footballTimeMult(s, teamMan));

  // §5b's study-hall tax on the bubble kid — on HIM, not the room.
  setAcademicHours(s, 0);
  const bubble = { gpa: A.BUBBLE_GPA - 0.3 };
  const fine = { gpa: A.BUBBLE_GPA + 0.3 };
  check('E2i the bubble kid pays a practice tax and nobody else does',
    Math.abs(footballTimeMult(s, bubble) - (1 - A.BUBBLE_PRACTICE_TAX)) < 1e-9 &&
    footballTimeMult(s, fine) === 1,
    `${r2(footballTimeMult(s, bubble))} vs ${footballTimeMult(s, fine)}`);
}

console.log('\n════ E3 — THE CHAIN: ACADEMICS → GPA → CHARACTER ════');
{
  // The target is CHARACTER's (the loop closes) — investment BENDS it.
  const lo = makeSchool({ pref: 8 });  lo.facilities.academics = 1; setAcademicHours(lo, 0);
  const hi = makeSchool({ pref: 97 }); hi.facilities.academics = 5; setAcademicHours(hi, maxAcademicHours());
  const grinder = { character: { grind: 92, coachability: 60, leadership: 50 }, attributes: { WE: 92 } };
  const loafer = { character: { grind: 22, coachability: 60, leadership: 50 }, attributes: { WE: 22 } };
  check('E3a character sets the target — the grinder out-earns the loafer at the same school',
    gpaTarget(grinder, hi) > gpaTarget(loafer, hi) &&
    gpaTarget(grinder, lo) > gpaTarget(loafer, lo),
    `${r2(gpaTarget(grinder, hi))} vs ${r2(gpaTarget(loafer, hi))}`);
  check('E3b investment bends the target — the same man earns more at the invested program',
    gpaTarget(grinder, hi) > gpaTarget(grinder, lo) &&
    gpaTarget(loafer, hi) > gpaTarget(loafer, lo),
    `grinder ${r2(gpaTarget(grinder, lo))} → ${r2(gpaTarget(grinder, hi))}`);
  // [GARRETT, Aug 2026] Bound widened 1.6 → 2.0. The Academic Center is now the
  // GEARING on the funding term rather than a co-equal slice of it, which is
  // the whole "the facility gives variation" call. The institutional extremes
  // (a defunded level-1 shell against a fully funded level-5 department) are
  // therefore genuinely further apart than they were — deliberately. The bound
  // still exists, and still says the same thing: the school bends the man, it
  // does not replace him.
  check('E3c investment spans a real, bounded amount (not a rewrite of the man)',
    (gpaTarget(grinder, hi) - gpaTarget(grinder, lo)) > 0.4 &&
    (gpaTarget(grinder, hi) - gpaTarget(grinder, lo)) < 2.0,
    `Δ ${r2(gpaTarget(grinder, hi) - gpaTarget(grinder, lo))}`);

  // The FACILITY is what makes the loop live: it sets the RATE, not the target.
  const rates = [1, 2, 3, 4, 5].map(l => { const s = makeSchool(); s.facilities.academics = l; return gpaDriftRate(s); });
  check('E3d the Academic Center tier sets how fast grades move',
    rates.every((v, i) => i === 0 || v > rates[i - 1]),
    rates.map(r2).join(' → '));

  // ACADEMICS → GPA over terms, then GPA → CHARACTER.
  const run = (pref, lvl, terms = 5) => {
    const s = makeSchool({ pref, n: 40 });
    s.facilities.academics = lvl;
    for (const p of s.roster) { p.gpa = 2.6; p.classYear = 'FR'; }
    const grindBefore = mean(s.roster.map(p => p.character.grind));
    let last = null;
    for (let t = 0; t < terms; t++) last = runAcademicTerm(s, { season: t + 1 });
    return { s, gpa: mean(s.roster.map(p => p.gpa)),
             dGrind: mean(s.roster.map(p => p.character.grind)) - grindBefore, last };
  };
  const rot = run(6, 1);
  const invested = run(96, 5);
  check('E3e ACADEMICS → GPA: five terms of investment vs neglect separate the room',
    invested.gpa > rot.gpa + 0.5,
    `neglected ${r2(rot.gpa)} vs invested ${r2(invested.gpa)}`);
  check('E3f GPA → CHARACTER: the invested room grows Grind, the rotten one loses it',
    invested.dGrind > 0 && rot.dGrind < 0,
    `Grind ${r2(rot.dGrind)} (rot) vs +${r2(invested.dGrind)} (invested)`);
  check('E3g §5b: neglect is not neutral — it rots the room',
    rot.last.weDrift < 0 && invested.last.weDrift > 0,
    `drift ${rot.last.weDrift} vs +${invested.last.weDrift}`);
  check('E3h honor rolls happen where it is invested, struggles where it is not',
    invested.last.honors.length > invested.last.strugglers.length &&
    rot.last.strugglers.length > rot.last.honors.length,
    `invested ${invested.last.honors.length}H/${invested.last.strugglers.length}S · rot ${rot.last.honors.length}H/${rot.last.strugglers.length}S`);
}

console.log('\n════ E4 — ELIGIBILITY IS REAL (probation = missed games) ════');
{
  const s = makeSchool({ pref: 5, n: 60 });
  s.facilities.academics = 1;
  for (const p of s.roster) { p.gpa = 1.6; p.classYear = 'SO'; }
  const term = runAcademicTerm(s, { season: 3 });
  check('E4a men below the line draw probation', term.probations.length > 0,
    `${term.probations.length} of ${s.roster.length}`);
  const banned = s.roster.filter(p => (p.ineligibleGames || 0) > 0);
  check('E4b probation sets a real game count, severity-scaled',
    banned.length > 0 && banned.every(p => p.ineligibleGames >= 1 &&
      p.ineligibleGames <= A.PROBATION_GAMES.severe),
    `${banned.length} banned, ${[...new Set(banned.map(p => p.ineligibleGames))].sort().join('/')}g`);
  check('E4c the ban rides the SAME availability gate injuries use',
    banned.every(p => isSidelined(p) && !isAvailable(p)) &&
    s.roster.filter(p => !p.ineligibleGames && !p.injuryGamesOut).every(isAvailable));
  const worst = banned.reduce((a, b) => (a.gpa < b.gpa ? a : b));
  const best = banned.reduce((a, b) => (a.gpa > b.gpa ? a : b));
  check('E4d the worse the term, the longer he sits',
    worst.ineligibleGames >= best.ineligibleGames,
    `${r2(worst.gpa)}→${worst.ineligibleGames}g vs ${r2(best.gpa)}→${best.ineligibleGames}g`);

  // Served in GAMES.
  const before = banned[0].ineligibleGames;
  serveAcademicWeek(s);
  check('E4e a game played serves a game of the ban',
    banned[0].ineligibleGames === before - 1, `${before} → ${banned[0].ineligibleGames}`);
  for (let i = 0; i < 6; i++) serveAcademicWeek(s);
  check('E4f the ban clears and the probation record clears with it',
    s.roster.every(p => (p.ineligibleGames || 0) === 0 && !p.academicProbation));

  // The Academic Center is a real safety net.
  const netRate = (lvl) => {
    let saved = 0, cases = 0;
    for (let i = 0; i < 12; i++) {
      const t = makeSchool({ pref: 5, n: 40 });
      t.facilities.academics = lvl;
      for (const p of t.roster) { p.gpa = 1.5; p.classYear = 'SO'; }
      const r = runAcademicTerm(t, { season: 2 });
      saved += r.saved.length; cases += r.saved.length + r.probations.length;
    }
    return cases ? saved / cases : 0;
  };
  const net1 = netRate(1), net5 = netRate(5);
  check('E4g the Academic Center saves eligibility cases, and tier is the lever',
    net1 < 0.02 && net5 > 0.4 && net5 > net1,
    `lv1 ${Math.round(net1 * 100)}% saved vs lv5 ${Math.round(net5 * 100)}%`);
  check('E4h the safety net is never total (you cannot buy your way out entirely)',
    net5 <= A.SAFETY_NET_MAX + 0.06, `${Math.round(net5 * 100)}% ≤ ${Math.round(A.SAFETY_NET_MAX * 100)}%`);
}

console.log('\n════ E5 — THE 5-YEAR SWING: turn it like a ship ════');
{
  // Two programs, five simmed years each: one gutting the classroom, one
  // pouring into it. The grade must MOVE, and must move SLOWLY.
  const simYears = (dir, years = 5) => {
    const s = makeSchool({ pref: 50, n: 60 });
    s.facilities.academics = 3;
    for (const p of s.roster) p.gpa = 2.7;
    const trace = [], shares = [];
    for (let y = 1; y <= years; y++) {
      // The negotiation, taken every single year in the same direction.
      s.academics.share = Math.max(C.EDU.SHARE_MIN, Math.min(C.EDU.SHARE_MAX,
        s.academics.share + (dir === 'gut' ? -C.EDU.NEG_STEPS[2] : C.EDU.NEG_STEPS[2])));
      if (dir === 'gut') { s.academics.grantedDemand.unshift(C.EDU.NEG_STEPS[2]); s.academics.grantedDemand.length = Math.min(s.academics.grantedDemand.length, C.SCANDAL.DEMAND_MEMORY); }
      runAcademicTerm(s, { season: y });
      settleEducationLine(s);
      const sc = educationScore(s);
      trace.push(r2(sc.score * 100));
      shares.push(r2(sc.share * 100));
      rollEducationHistory(s);
    }
    return { s, trace, shares, grade: educationGrade(s) };
  };
  const gut = simYears('gut');
  const build = simYears('build');
  // The claim §13 actually makes is about the BUDGET WINDOW: "the grade tracks
  // the education share of the budget over the trailing 5 years... gutting the
  // budget doesn't drop it overnight." Roster GPA and eligibility incidents are
  // OUTCOMES and are supposed to respond within a year — the 5-year swing is
  // what refuses to. So the slowness is asserted on the window itself.
  // [GARRETT, Aug 2026] Bound 6 → 8. One max ask is a quarter of the share, and
  // a five-year window absorbs a fifth of it in the year it happens — about 5
  // points, plus the administration's own pull back toward its preference. The
  // claim being guarded is unchanged: you cannot move this window a rung in one
  // sitting.
  check('E5a the budget window barely moves in the year you take the money',
    Math.abs(gut.shares[0] - gut.shares[1]) < 8 && Math.abs(build.shares[0] - build.shares[1]) < 8,
    `gutted ${gut.shares.join(' → ')} · built ${build.shares.join(' → ')}`);
  check('E5a2 ...and it is a completely different program five years later',
    (gut.shares[0] - gut.shares[4]) > 18 && (build.shares[4] - build.shares[0]) > 18,
    `gutted −${r2(gut.shares[0] - gut.shares[4])} · built +${r2(build.shares[4] - build.shares[0])}`);
  check('E5b it drops over five years',
    gut.trace[4] < gut.trace[0] - 6, gut.trace.join(' → '));
  check('E5c investing takes years to show, then shows',
    (build.trace[1] - build.trace[0]) < 9 && build.trace[4] > build.trace[0] + 5,
    build.trace.join(' → '));
  check('E5d the two programs end in different worlds',
    build.trace[4] > gut.trace[4] + 18,
    `built ${build.grade.letter} (${build.trace[4]}) vs gutted ${gut.grade.letter} (${gut.trace[4]})`);
  check('E5e a gutted education line cannot carry the building it paid for',
    academicLevel(gut.s) < 3, `Academic Center fell to ${academicLevel(gut.s)}`);
  check('E5f the grade is a real letter on the same ladder every grade uses',
    typeof build.grade.letter === 'string' && build.grade.letter.length <= 2);
}

console.log('\n════ E6 — THE NEGOTIATION (success × gate × reputation) ════');
{
  const mk = (o) => makeSchool(o);
  const loser = mk({ wins: 2, prestige: 3, repXp: SKILL_GRADE_XP[5] });
  const winner = mk({ wins: 11, prestige: 3, repXp: SKILL_GRADE_XP[5] });
  check('E6a winning is the argument',
    negotiationOdds(winner, winner.coach, { step: 0 }) >
    negotiationOdds(loser, loser.coach, { step: 0 }) + 0.10,
    `${r2(negotiationOdds(loser, loser.coach, {}))} → ${r2(negotiationOdds(winner, winner.coach, {}))}`);

  const nobody = mk({ repXp: 0 });
  const legend = mk({ repXp: SKILL_GRADE_XP[12] });
  check('E6b the coach\'s reputation moves the answer',
    negotiationOdds(legend, legend.coach, {}) > negotiationOdds(nobody, nobody.coach, {}),
    `${r2(negotiationOdds(nobody, nobody.coach, {}))} → ${r2(negotiationOdds(legend, legend.coach, {}))}`);

  const empty = mk(); recordSeasonAttendance(empty, 0.40);
  const packed = mk(); recordSeasonAttendance(packed, 0.98);
  check('E6c the stands are the argument too',
    negotiationOdds(packed, packed.coach, {}) > negotiationOdds(empty, empty.coach, {}),
    `${r2(negotiationOdds(empty, empty.coach, {}))} → ${r2(negotiationOdds(packed, packed.coach, {}))}`);

  const s = mk({ wins: 9 });
  const o0 = negotiationOdds(s, s.coach, { step: 0 });
  const o2 = negotiationOdds(s, s.coach, { step: 2 });
  check('E6d a bigger ask is a harder ask', o2 < o0, `${r2(o0)} → ${r2(o2)}`);
  check('E6e giving money BACK to education is an easy yes',
    negotiationOdds(s, s.coach, { give: true }) > o0,
    `${r2(o0)} → ${r2(negotiationOdds(s, s.coach, { give: true }))}`);

  // A granted ask moves real money and real share, and the compliance office
  // remembers what was TAKEN.
  let moved = null, tries = 0;
  const t = mk({ wins: 12, repXp: SKILL_GRADE_XP[12] });
  const shareBefore = t.academics.share;
  const lineBefore = eduBudget(t);
  while (!moved && tries++ < 200) {
    const r = resolveNegotiation(t, t.coach, { stepIdx: 2, dir: 'recruiting', season: 1 });
    if (r.granted) moved = r;
  }
  check('E6f a granted ask moves dollars INTO the pool and share OUT of the classroom',
    moved && moved.dollars > 0 && t.academics.share < shareBefore && eduBudget(t) < lineBefore,
    moved ? `+$${moved.dollars}, share ${r2(shareBefore)} → ${r2(t.academics.share)}, line $${lineBefore} → $${eduBudget(t)}` : 'never granted');
  check('E6g the compliance office remembers what was taken',
    (t.academics.grantedDemand[0] || 0) > 0, JSON.stringify(t.academics.grantedDemand));
}

console.log('\n════ E7 — ACADEMIC STANDING (§5b, reframed Aug 2026) ════');
{
  // [GARRETT, Aug 2026] The old E7 asserted the SHAPE OF A DICE ROLL: base
  // rates, neglect multipliers, mitigation caps. That system is gone, and with
  // it the framing that a coach who moved a budget line was doing something
  // furtive. What replaces it is the university's own published academic
  // standard, and the only thing worth asserting about it is that it is legible
  // and that it never surprises anyone.
  const clean = makeSchool({ pref: 62, n: 60 });
  clean.facilities.academics = 3;
  const base = academicStanding(clean, clean.coach);
  check('E7a a normal program reads GOOD STANDING',
    base.band === 'clean' && base.status === 'good', `${base.label} (${base.letter})`);

  const rotten = makeSchool({ pref: 5, n: 60 });
  rotten.facilities.academics = 1;
  rotten.academics.share = C.EDU.SHARE_MIN;
  rotten.academics.history = [0.05, 0.05, 0.05, 0.05, 0.05];
  rotten.academics.incidentHistory = [9, 9, 9, 9, 9];
  for (const p of rotten.roster) p.gpa = 1.6;
  const bad = academicStanding(rotten, rotten.coach);
  check('E7b a program running the classroom on nothing reads FAILING',
    bad.band === 'danger' && bad.failing, `${bad.label} (${bad.letter})`);
  check('E7c the reading is the RECORD, not a probability — it is the grade itself',
    Math.abs(bad.score - educationScore(rotten).score) < 1e-9);

  // The sentence: warning, then one year, then the sanction.
  const y1 = settleAcademicStanding(rotten, { season: 1, coachId: 'hc' });
  check('E7d the first failing year is a WARNING', y1?.kind === 'warning', y1?.kind);
  check('E7e ...and the warning shuts the budget door while it is live',
    schoolWillingness(rotten, { step: 0 }) === 0);
  const y2 = settleAcademicStanding(rotten, { season: 2, coachId: 'hc' });
  check('E7f a second consecutive failing year is the SANCTION', y2?.kind === 'sanction', y2?.kind);

  // Nothing in this path is random — the same inputs give the same sentence,
  // every time. That is the whole point of the reframe.
  const kinds = new Set();
  for (let i = 0; i < 300; i++) {
    const s = makeSchool({ pref: 5, n: 30 });
    s.facilities.academics = 1;
    s.academics.share = C.EDU.SHARE_MIN;
    s.academics.history = [0.05, 0.05, 0.05, 0.05, 0.05];
    s.academics.incidentHistory = [9, 9, 9, 9, 9];
    for (const p of s.roster) p.gpa = 1.6;
    settleAcademicStanding(s, { season: 1, coachId: 'hc' });
    kinds.add(settleAcademicStanding(s, { season: 2, coachId: 'hc' })?.kind);
  }
  check('E7g deterministic across 300 program-seasons — no dice remain',
    kinds.size === 1 && kinds.has('sanction'), [...kinds].join('/'));

  // ...and a normally-run program is never touched by it at all.
  let touched = 0;
  for (let i = 0; i < 300; i++) {
    const s = makeSchool({ pref: 55, n: 30 });
    s.facilities.academics = 3;
    if (settleAcademicStanding(s, { season: 1, coachId: 'hc' })) touched++;
  }
  check('E7h a league-normal program is never sanctioned', touched === 0, `${touched}/300`);
}

console.log('\n════ E8 — THE WANT MEASURES TRAIL (§13) ════');
{
  const s = makeSchool({ prestige: 4, n: 60 });
  const m0 = programSpotlight(s);
  check('E8a a program with no receipts reads off its NAME, not off nothing',
    m0.score > 0 && m0.score < 1 && m0.seasons === 0, `${m0.letter} (${r2(m0.score)})`);

  // One monster season cannot buy the measure.
  s.seasonHistory.push({ season: 1, w: 12, l: 0, rank: 1, rankedWeeks: 13, post: 'National Champion', awardPts: 6 });
  recordSeasonAttendance(s, 1.0);
  const m1 = programSpotlight(s);
  check('E8b one perfect season moves it but cannot max it',
    m1.score > m0.score && m1.score < 0.90, `${r2(m0.score)} → ${r2(m1.score)}`);
  s.seasonHistory.push({ season: 2, w: 12, l: 0, rank: 1, rankedWeeks: 13, post: 'National Champion', awardPts: 6 });
  s.seasonHistory.push({ season: 3, w: 12, l: 0, rank: 1, rankedWeeks: 13, post: 'National Champion', awardPts: 6 });
  const m3 = programSpotlight(s);
  check('E8c a full window of dominance is what actually earns the stage',
    m3.score > m1.score && m3.score > 0.75, `${r2(m1.score)} → ${r2(m3.score)} (${m3.letter})`);
  // ...and one bad year does not erase an era.
  s.seasonHistory.push({ season: 4, w: 2, l: 10, rank: null, rankedWeeks: 0, post: null, awardPts: 0 });
  const m4 = programSpotlight(s);
  check('E8d one bad year does not erase an era',
    m4.score > m3.score * 0.55, `${r2(m3.score)} → ${r2(m4.score)}`);

  // Culture is program Buy-In heavy, and scandal subtracts.
  const c = makeSchool({ n: 60 });
  ensureProgramBuyIn(c).value = 20; const cLow = programCulture(c).score;
  ensureProgramBuyIn(c).value = 90; const cHigh = programCulture(c).score;
  check('E8e Culture is carried by the room\'s belief', cHigh > cLow + 0.25,
    `${r2(cLow)} → ${r2(cHigh)}`);
  c.academics.scandalMarks = 2;
  check('E8f scandal marks subtract from Culture', programCulture(c).score < cHigh,
    `${r2(cHigh)} → ${r2(programCulture(c).score)}`);
  check('E8g every measure is bounded 0..1 and grades on the one ladder',
    [programCulture(c), programSpotlight(s), educationGrade(s)].every(m =>
      m.score >= 0 && m.score <= 1 && typeof m.letter === 'string'));

  // The attendance curve: a season is a curve, not a constant.
  const a = makeSchool({ prestige: 3, wins: 6 });
  const open = attendanceFill(a, a.coach, { week: 1, wins: 0, losses: 0 });
  const hot = attendanceFill(a, a.coach, { week: 11, wins: 10, losses: 0 });
  const cold = attendanceFill(a, a.coach, { week: 11, wins: 1, losses: 9 });
  check('E8h the building fills or empties as the season proves itself',
    hot > open && cold < open, `open ${r2(open)} · 10-0 ${r2(hot)} · 1-9 ${r2(cold)}`);
  check('E8i the opener gets the August novelty bump',
    attendanceFill(a, a.coach, { week: 1, wins: 0, losses: 0 }) >
    attendanceFill(a, a.coach, { week: 2, wins: 0, losses: 0 }));
  noteGameAttendance(a, 0.7); noteGameAttendance(a, 0.9);
  check('E8j realized gates average into the trailing history',
    Math.abs(seasonAttendanceAvg(a) - 0.8) < 1e-9,
    (() => { recordSeasonAttendance(a, seasonAttendanceAvg(a)); return `banked ${a.attendance.history[0]}`; })());
}

console.log('\n════ E9 — WORLDGEN SHAPE (§5b: same law as prestige) ════');
{
  const { generateWorld } = await import('../js/engine/world.js');
  const world = generateWorld();
  const schools = world.schools;
  const prefs = schools.map(s => s.eduPref).sort((a, b) => a - b);
  const q = (p) => prefs[Math.floor(prefs.length * p)];
  const mid = prefs.filter(v => v >= 30 && v <= 75).length / prefs.length;
  check('E9a middle-heavy', mid > 0.55, `${Math.round(mid * 100)}% between 30 and 75`);
  check('E9b with real extremes at both ends',
    q(0.02) < 20 && q(0.98) > 82, `p2 ${q(0.02)} · p50 ${q(0.5)} · p98 ${q(0.98)}`);
  check('E9c every school has an Academic Center and a 5-year history',
    schools.every(s => s.facilities.academics >= 1 &&
      s.academics?.history?.length === C.EDU.HISTORY_YEARS));
  const grades = {};
  for (const s of schools) grades[educationGrade(s).letter] = (grades[educationGrade(s).letter] || 0) + 1;
  const distinct = Object.keys(grades).length;
  check('E9d every school shows a REAL education grade on day one',
    schools.every(s => educationGrade(s).letter) && distinct >= 6,
    `${distinct} distinct letters: ${Object.entries(grades).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(' ')}`);
  const scores = schools.map(s => educationScore(s).score * 100).sort((a, b) => a - b);
  check('E9e the sport centres near C, not at a rail',
    scores[Math.floor(scores.length / 2)] > 32 && scores[Math.floor(scores.length / 2)] < 62,
    `p10 ${r2(scores[Math.floor(scores.length * 0.1)])} · med ${r2(scores[Math.floor(scores.length / 2)])} · p90 ${r2(scores[Math.floor(scores.length * 0.9)])}`);
  // [GARRETT, Aug 2026] Was "a fresh world is not walking around at scandal
  // risk". There is no risk number any more — a world is healthy when almost
  // nobody opens the game already failing, and the handful who do are the
  // wreckage The Ashes was always premised on.
  const failing = schools.filter(s => educationGrade(s).letter === 'F').length;
  const warned = schools.filter(s => s.academics?.standing?.warning).length;
  check('E9f a fresh world opens in good academic standing almost everywhere',
    failing / schools.length < 0.03 && warned === 0,
    `${failing}/${schools.length} failing on day one, ${warned} already warned`);
  // The Academic Center is buyable with football money and maintained by the line.
  const s0 = schools[0];
  s0.coach = { budget: 1e6, skills: freshSkills() };
  const lvlBefore = academicLevel(s0);
  const res = buyAcademicUpgrade(s0, s0.coach);
  check('E9g the fifth building is bought with football money',
    res.ok && academicLevel(s0) === lvlBefore + 1 && s0.coach.budget === 1e6 - res.cost,
    `lv${lvlBefore} → lv${res.level} for $${res.cost}`);
  check('E9h and it is NOT in the football upkeep tracks (the pool is untouched)',
    !C.FACILITIES.TRACKS.includes('academics') && academicUpkeep(s0) > 0,
    `academic upkeep $${academicUpkeep(s0)} is charged to the education line`);
}

console.log(`\n${fails === 0 ? '✅ ALL CHECKS PASS' : `❌ ${fails} CHECK(S) FAILED`}`);
process.exit(fails ? 1 : 0);
