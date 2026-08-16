// education_swing_probe.mjs — [GARRETT, Aug 2026] THE EDUCATION LINE, REFRAMED.
//
// This probe exists because the education system was framed wrong and the fix
// has a NUMERIC spec. What is asserted here is the spec, in the owner's words:
//
//   "the school gives the team more money for football which means they have
//    less money for education which is where the penalty to gpa comes from...
//    the 5 year swing was how much it should effect gpa — 5 years for C down to
//    F and 5 years for C up to A. I still want this but I want the academic
//    facility to give variation. the school's priority for academics is the
//    school-side check for asking for more money which should then check with
//    the coach's rep for the decision. hitting F should give you a warning for
//    a year then check again and if still F trigger the violation and
//    termination of the coach."
//
//   S1  THE START LINE. An ordinary, untouched program reads a C. If the
//       neutral case is not a C, neither endpoint of the swing means anything.
//   S2  FIVE YEARS DOWN: C → F. Max ask, granted every year, five years.
//   S3  FIVE YEARS UP:   C → A. Max give-back, granted every year, five years.
//   S4  THE BUILDING IS THE VARIATION. The same budget cut at a level-1 and a
//       level-5 Academic Center produces materially different transcripts —
//       and the level-5 program absorbs it. Same for money handed back.
//   S5  GPA RESPONDS FAST, THE GRADE RESPONDS SLOW. The cost is felt while it
//       is happening (roster GPA inside ~2 seasons), the letter takes five.
//   S6  TWO-STAGE ASK. Stage 1 is the SCHOOL's academic priority; stage 2 is
//       the COACH's reputation. Each gate moves independently, and a denial
//       names which one closed.
//   S7  THE F RULE, DETERMINISTIC. F → warning. Still F → sanction + firing.
//       Fixed in the warning year → cleared. A NEW coach inheriting a warning
//       gets his own year. Nothing anywhere rolls a die.
//
// Run: node tools/education_swing_probe.mjs
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
Math.random = mulberry32(0x5EED0ED0);

const { createPlayer } = await import('../js/engine/player.js');
const { C, ROSTER_TARGETS } = await import('../js/constants.js');
const {
  ensureSchoolAcademics, academicLevel, academicFunding, facilityFactor,
  fundingGearing, fundingBend, gpaTarget, gpaDriftRate,
  runAcademicTerm, settleEducationLine, rollEducationHistory,
  educationScore, educationGrade, setAcademicHours,
  schoolWillingness, boardOdds, negotiationCheck, resolveNegotiation,
  academicStanding, settleAcademicStanding,
} = await import('../js/engine/academics.js');
const { ensureProgramBuyIn } = await import('../js/engine/development.js');
const { freshSkills, SKILL_GRADE_XP } = await import('../js/engine/coach.js');
const { letterIndex } = await import('../js/engine/grades.js');

let fails = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fails++;
};
const r2 = v => Math.round(v * 100) / 100;
const pct = v => `${Math.round(v * 100)}%`;

function makeRoster(tier = 2, n = 60) {
  const roster = []; const years = ['FR', 'SO', 'JR', 'SR']; let i = 0;
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let k = 0; k < count; k++, i++) {
      if (roster.length >= n) return roster;
      roster.push(createPlayer(pos, years[i % 4], tier, 0));
    }
  }
  return roster;
}
function makeSchool({ prestige = 3, pref = 46, tier = 2, n = 60, wins = 6,
                      lvl = 3, repXp = SKILL_GRADE_XP[5], gpa = 2.7 } = {}) {
  const school = {
    id: 'sw_' + Math.floor(Math.random() * 1e9).toString(36),
    name: 'Probe State', division: 'D1', prestige, type: 'stateUniversity',
    eduPref: pref, roster: makeRoster(tier, n),
    recentWins: [wins, wins, wins], record: { wins, losses: 12 - wins },
    stadium: { capacity: 40000 },
    facilities: { stadium: 2, training: 2, recruiting: 2, medicine: 2, academics: lvl },
    staff: {}, seasonHistory: [],
    coach: { id: 'hc', name: { first: 'A', last: 'Coach' }, skills: freshSkills(), budget: 0 },
  };
  school.coach.skills.reputation.xp = repXp;
  ensureSchoolAcademics(school);
  ensureProgramBuyIn(school);
  school.facilities.academics = lvl;
  for (const p of school.roster) p.gpa = gpa;
  return school;
}

// One simulated season of the education year, in the SAME order season.js runs
// it. `dir` is what the coach asks for and is GRANTED every single year, which
// is the ceiling case the swing spec is written against.
function runYear(school, season, dir) {
  if (dir === 'gut' || dir === 'give') {
    const step = C.EDU.NEG_STEPS[C.EDU.NEG_STEPS.length - 1];
    const a = school.academics;
    const before = a.share;
    a.share = Math.max(C.EDU.SHARE_MIN, Math.min(C.EDU.SHARE_MAX,
      before + (dir === 'give' ? step : -step)));
    const moved = Math.abs(a.share - before);
    a.grantedDemand.unshift(dir === 'gut' ? moved : 0);
    if (a.grantedDemand.length > C.SCANDAL.DEMAND_MEMORY) a.grantedDemand.pop();
  }
  const term = runAcademicTerm(school, { season });
  settleEducationLine(school);
  const snap = { season, ...educationGrade(school), gpa: term.gpaAfter, probations: term.probations.length };
  rollEducationHistory(school);
  return snap;
}
function simFive(dir, opts = {}) {
  const s = makeSchool(opts);
  const trace = [];
  for (let y = 1; y <= 5; y++) trace.push(runYear(s, y, dir));
  // The endpoint is the grade AT THE END OF SEASON FIVE, which is the year-5
  // snapshot — not a sixth year's opening reading.
  return { s, trace, end: trace[4], start: trace[0] };
}

console.log('\n════ S1 — THE START LINE: an ordinary program reads a C ════');
{
  const s = makeSchool();
  const g = educationGrade(s);
  check('S1a a neutral, untouched program grades a C',
    g.letter.startsWith('C'), `${g.letter} (${r2(g.score * 100)})`);
  // ...and so does the ordinary worldgen shape, at the building worldgen builds.
  const lo = educationGrade(makeSchool({ lvl: 2 }));
  const hi = educationGrade(makeSchool({ lvl: 4, pref: 60 }));
  check('S1b the everyday band sits C−…B−, not at either rail',
    letterIndex(lo.letter) >= letterIndex('C-') && letterIndex(hi.letter) <= letterIndex('B'),
    `lv2/pref46 ${lo.letter} · lv4/pref60 ${hi.letter}`);
}

console.log('\n════ S2 — FIVE YEARS DOWN: C → F ════');
{
  const gut = simFive('gut');
  console.log('      ' + gut.trace.map(t => `y${t.season} ${t.letter}(${r2(t.score * 100)}) gpa ${r2(t.gpa)} inel ${t.probations}`).join('\n      '));
  check('S2a it starts at a C', gut.start.letter.startsWith('C'), gut.start.letter);
  check('S2b five straight max asks land on an F', gut.end.letter === 'F',
    `${gut.start.letter} → ${gut.end.letter} (${r2(gut.end.score * 100)})`);
  check('S2c and it does NOT get there in one year — you cannot ruin it overnight',
    letterIndex(gut.trace[0].letter) - letterIndex(gut.trace[1].letter) <= 4,
    `${gut.trace[0].letter} → ${gut.trace[1].letter}`);
  check('S2d the classroom is the visible cause: GPA falls and men go ineligible',
    gut.trace[4].gpa < gut.trace[0].gpa - 0.30 && gut.trace[4].probations > gut.trace[0].probations,
    `gpa ${r2(gut.trace[0].gpa)} → ${r2(gut.trace[4].gpa)} · ineligible ${gut.trace[0].probations} → ${gut.trace[4].probations}`);
}

console.log('\n════ S3 — FIVE YEARS UP: C → A ════');
{
  const give = simFive('give');
  console.log('      ' + give.trace.map(t => `y${t.season} ${t.letter}(${r2(t.score * 100)}) gpa ${r2(t.gpa)} inel ${t.probations}`).join('\n      '));
  check('S3a it starts at a C', give.start.letter.startsWith('C'), give.start.letter);
  check('S3b five straight max give-backs land on an A',
    give.end.letter.startsWith('A'), `${give.start.letter} → ${give.end.letter} (${r2(give.end.score * 100)})`);
  check('S3c ...and not on an A+ — the top rung still wants the building',
    give.end.letter !== 'A+', give.end.letter);
  check('S3d the classroom shows it: GPA climbs, nobody is ineligible',
    give.trace[4].gpa > give.trace[0].gpa + 0.15 && give.trace[4].probations === 0,
    `gpa ${r2(give.trace[0].gpa)} → ${r2(give.trace[4].gpa)} · ineligible ${give.trace[4].probations}`);
}

console.log('\n════ S4 — THE BUILDING IS THE VARIATION ════');
{
  const shell = makeSchool({ lvl: 1 });
  const real = makeSchool({ lvl: 5 });
  for (const s of [shell, real]) s.academics.share = C.EDU.SHARE_MIN;
  const gShell = fundingGearing(shell), gReal = fundingGearing(real);
  check('S4a a shell absorbs nothing and a real building absorbs most of a cut',
    gShell.cut > 1.3 && gReal.cut < 0.5, `lv1 ×${r2(gShell.cut)} · lv5 ×${r2(gReal.cut)}`);
  const man = shell.roster[0];
  const tShell = gpaTarget(man, shell), tReal = gpaTarget(man, real);
  check('S4b the SAME gutted budget produces very different transcripts',
    tReal - tShell > 0.55, `lv1 target ${r2(tShell)} · lv5 target ${r2(tReal)}`);
  // ...and in the other direction the building is what makes money land.
  const pShell = makeSchool({ lvl: 1 }), pReal = makeSchool({ lvl: 5 });
  for (const s of [pShell, pReal]) s.academics.share = C.EDU.SHARE_MAX;
  check('S4c money handed to a school with nowhere to spend it mostly evaporates',
    gpaTarget(man, pReal) - gpaTarget(man, pShell) > 0.35,
    `lv1 ${r2(gpaTarget(man, pShell))} · lv5 ${r2(gpaTarget(man, pReal))}`);
  {
    const a = simFive('gut', { lvl: 1 }), b = simFive('gut', { lvl: 5 });
    const inelA = a.trace.reduce((x, t) => x + t.probations, 0);
    const inelB = b.trace.reduce((x, t) => x + t.probations, 0);
    console.log(`      lv1 → ${a.end.letter} (${r2(a.end.score * 100)}) gpa ${r2(a.end.gpa)}, ${inelA} ineligible`);
    console.log(`      lv5 → ${b.end.letter} (${r2(b.end.score * 100)}) gpa ${r2(b.end.gpa)}, ${inelB} ineligible`);
    check('S4d the same five-year gutting wrecks a shell and merely dents a real building',
      b.end.gpa - a.end.gpa > 0.25 && inelB < inelA * 0.5,
      `gpa ${r2(a.end.gpa)} vs ${r2(b.end.gpa)} · ineligible ${inelA} vs ${inelB}`);
    check('S4d2 ...so the letter arrives at F on completely different timelines',
      a.trace.findIndex(t => t.letter === 'F') < b.trace.findIndex(t => t.letter === 'F')
        || b.trace.every(t => t.letter !== 'F'),
      `lv1 first F at y${a.trace.findIndex(t => t.letter === 'F') + 1} · lv5 ${b.trace.some(t => t.letter === 'F') ? `y${b.trace.findIndex(t => t.letter === 'F') + 1}` : 'never'}`);
  }
}

console.log('\n════ S5 — GPA MOVES FAST, THE LETTER MOVES SLOW ════');
{
  const s = makeSchool({ lvl: 4, gpa: 2.7 });
  // One granted max ask — the biggest single move the negotiation allows.
  s.academics.share = Math.max(C.EDU.SHARE_MIN, s.academics.share - C.EDU.NEG_STEPS[2]);
  const g0 = educationGrade(s).score;
  const roomTarget = () => s.roster.reduce((x, p) => x + gpaTarget(p, s), 0) / s.roster.length;
  const target = roomTarget();
  const t1 = runAcademicTerm(s, { season: 1 }); rollEducationHistory(s);
  const t2 = runAcademicTerm(s, { season: 2 }); rollEducationHistory(s);
  const closed = (2.7 - t2.gpaAfter) / Math.max(0.01, 2.7 - target);
  check('S5a two seasons closes most of the GPA gap at a real building',
    closed > 0.60, `${r2(closed * 100)}% of the way to ${r2(target)} (gpa ${r2(t1.gpaAfter)} → ${r2(t2.gpaAfter)})`);
  check('S5b the LETTER has moved far less than the transcripts did',
    g0 - educationGrade(s).score < 0.20,
    `grade ${r2(g0 * 100)} → ${r2(educationGrade(s).score * 100)} while GPA went 2.70 → ${r2(t2.gpaAfter)}`);
}

console.log('\n════ S6 — THE TWO-STAGE ASK ════');
{
  const factory = makeSchool({ pref: 14 });
  const ivy = makeSchool({ pref: 88 });
  check('S6a stage 1 is the SCHOOL: an academic school will not put it on the agenda',
    schoolWillingness(factory, { step: 2 }) - schoolWillingness(ivy, { step: 2 }) > 0.35,
    `factory ${pct(schoolWillingness(factory, { step: 2 }))} · academic school ${pct(schoolWillingness(ivy, { step: 2 }))}`);
  {
    const one = makeSchool({ pref: 46 });
    const before = schoolWillingness(one, { step: 1 });
    one.coach.skills.reputation.xp = SKILL_GRADE_XP[12];
    check('S6b stage 1 cannot see the coach at all',
      schoolWillingness(one, { step: 1 }) === before);
  }
  const nobody = makeSchool({ repXp: SKILL_GRADE_XP[1] });
  const legend = makeSchool({ repXp: SKILL_GRADE_XP[12] });
  check('S6c stage 2 is the COACH: reputation is the decisive term',
    boardOdds(legend, legend.coach, { step: 1 }) - boardOdds(nobody, nobody.coach, { step: 1 }) > 0.20,
    `nobody ${pct(boardOdds(nobody, nobody.coach, { step: 1 }))} · legend ${pct(boardOdds(legend, legend.coach, { step: 1 }))}`);
  check('S6d stage 2 does not care about the school\'s academic identity',
    Math.abs(boardOdds(factory, factory.coach, { step: 1 }) - boardOdds(ivy, ivy.coach, { step: 1 })) < 0.01);
  const s = makeSchool();
  check('S6e a bigger ask is harder on BOTH sides',
    schoolWillingness(s, { step: 2 }) < schoolWillingness(s, { step: 0 })
      && boardOdds(s, s.coach, { step: 2 }) < boardOdds(s, s.coach, { step: 0 }));
  check('S6f giving money back sails through the institution',
    schoolWillingness(s, { step: 2, give: true }) === 1
      && boardOdds(s, s.coach, { give: true }) > boardOdds(s, s.coach, {}));
  // Draining the line closes the institutional door on you over time.
  const drained = makeSchool();
  const open = schoolWillingness(drained, { step: 1 });
  drained.academics.grantedDemand = [0.25, 0.25, 0.25];
  check('S6g the budget office remembers: a drained line stops being offered',
    schoolWillingness(drained, { step: 1 }) < open - 0.15,
    `${pct(open)} → ${pct(schoolWillingness(drained, { step: 1 }))}`);
  const warned = makeSchool();
  warned.academics.standing = { warning: true, season: 1, coachId: 'hc' };
  check('S6g2 under a formal warning the university will not move another dollar',
    schoolWillingness(warned, { step: 0 }) === 0);
  // A denial has to say WHICH gate closed.
  let sawSchool = false, sawBoard = false;
  for (let i = 0; i < 400; i++) {
    const t = makeSchool({ pref: 70, repXp: SKILL_GRADE_XP[2] });
    const r = resolveNegotiation(t, t.coach, { stepIdx: 2 });
    if (!r.granted && r.blockedBy === 'school') sawSchool = true;
    if (!r.granted && r.blockedBy === 'board') sawBoard = true;
  }
  check('S6h a denial names the gate that closed', sawSchool && sawBoard);
}

console.log('\n════ S7 — THE F RULE: warning, then the sanction ════');
{
  // A program parked on a failing record.
  const failing = () => {
    const s = makeSchool({ lvl: 1, pref: 8, gpa: 1.6 });
    s.academics.share = C.EDU.SHARE_MIN;
    s.academics.history = [C.EDU.SHARE_MIN, C.EDU.SHARE_MIN, C.EDU.SHARE_MIN, C.EDU.SHARE_MIN, C.EDU.SHARE_MIN];
    s.academics.incidentHistory = [8, 8, 8, 8, 8];
    return s;
  };
  const s = failing();
  check('S7a the setup really is an F', educationGrade(s).letter === 'F', `${r2(educationGrade(s).score * 100)}`);

  const y1 = settleAcademicStanding(s, { season: 1, coachId: 'hc' });
  check('S7b year one on an F is a WARNING, not a firing', y1?.kind === 'warning', y1?.kind);
  check('S7c the warning is visible on the standing readout',
    academicStanding(s).status === 'final' && academicStanding(s).warned,
    `${academicStanding(s).label}`);

  const y2 = settleAcademicStanding(s, { season: 2, coachId: 'hc' });
  check('S7d a second straight F is the SANCTION', y2?.kind === 'sanction', y2?.kind);
  check('S7e the sanction names the warning it followed', y2?.warnedSince === 1, `${y2?.warnedSince}`);
  check('S7e2 the sanction REMEDIATES — the university is made to restore the line',
    s.academics.share >= C.EDU.REMEDIATION_SHARE
      && educationGrade(s).letter !== 'F'
      && !settleAcademicStanding(s, { season: 3, coachId: 'new-hc' }),
    `share → ${r2(s.academics.share)}, record → ${educationGrade(s).letter}`);

  // Fix it inside the warning year and the file closes.
  const fix = failing();
  settleAcademicStanding(fix, { season: 1, coachId: 'hc' });
  fix.academics.share = C.EDU.SHARE_MAX;
  fix.academics.history = [1, 1, 1, 1, 1];
  fix.academics.incidentHistory = [0, 0, 0, 0, 0];
  fix.facilities.academics = 4;
  for (const p of fix.roster) p.gpa = 3.1;
  const cleared = settleAcademicStanding(fix, { season: 2, coachId: 'hc' });
  check('S7f fixing it inside the warning year LIFTS the warning',
    cleared?.kind === 'cleared' && !fix.academics.standing, cleared?.kind);

  // A new man in the chair is not fired for his predecessor's budget.
  const inherited = failing();
  settleAcademicStanding(inherited, { season: 1, coachId: 'old-hc' });
  const re = settleAcademicStanding(inherited, { season: 2, coachId: 'new-hc' });
  check('S7g a coach who INHERITS a warning gets his own clean year',
    re?.kind === 'reissued', re?.kind);
  const then = settleAcademicStanding(inherited, { season: 3, coachId: 'new-hc' });
  check('S7h ...and is sanctioned if HE fails to fix it', then?.kind === 'sanction', then?.kind);

  // Nothing here is random.
  const outcomes = new Set();
  for (let i = 0; i < 200; i++) {
    const t = failing();
    settleAcademicStanding(t, { season: 1, coachId: 'hc' });
    outcomes.add(settleAcademicStanding(t, { season: 2, coachId: 'hc' })?.kind);
  }
  check('S7i the outcome is DETERMINISTIC — no dice anywhere in this path',
    outcomes.size === 1 && outcomes.has('sanction'), [...outcomes].join('/'));

  // A healthy program is never touched by any of it.
  const good = makeSchool({ lvl: 4, pref: 70 });
  let touched = 0;
  for (let y = 1; y <= 40; y++) if (settleAcademicStanding(good, { season: y, coachId: 'hc' })) touched++;
  check('S7j a well-run program cannot be surprised by this system in 40 seasons',
    touched === 0, `${touched} event(s)`);
}

console.log(`\n${fails ? `FAILURES: ${fails}` : 'ALL PASS'}\n`);
process.exit(fails ? 1 : 0);
