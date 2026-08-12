// tree_advantage_probe.mjs — DNA TREE §9 ENFORCEMENT. The standing law under
// test, stated once: THE TREE COMPRESSES TIME, IT NEVER RAISES CEILINGS.
//
// Two career arms, EQUAL SCRIPTED DECISIONS (formalized as identical
// per-season earn streams fed through the real production functions):
//   ARM T — born of a MAXED tree: full inheritance (real dnaInheritance),
//           credential-seeded skills, the works.
//   ARM S — a solo man with nothing.
//
//   E1  THE HEAD START IS REAL: arm T reaches ★★★ and 💎 STRICTLY EARLIER
//       (seasons-to-tier), and his early-career multipliers are higher.
//   E2  THE CEILING IS SHARED: both arms saturate at IDENTICAL maxima —
//       dnaGrade, dnaBonus, skill multipliers, formation envelope. Nothing a
//       maxed tree reaches is unreachable solo; nothing exceeds today's caps.
//   E3  OUTCOMES, DAY 1: identical rosters, identical gameplans; the day-1
//       protégé's school (inherited ★★-capped DNA stamps) beats the day-1
//       solo school MORE than half the time — the inheritance does something.
//   E4  OUTCOMES, ENDGAME: a maxed tree-line coach vs a maxed solo coach,
//       identical rosters — statistically indistinguishable. THE LAW.
//   E5  Sanity: endgame vs day-1 is a massacre (the systems are live).
//
// Run: node tools/tree_advantage_probe.mjs [gamesPerArm]
const _ls = new Map();
global.localStorage = {
  getItem: (k) => (_ls.has(k) ? _ls.get(k) : null),
  setItem: (k, v) => _ls.set(k, String(v)),
  removeItem: (k) => _ls.delete(k),
};

const { C, ROSTER_TARGETS, CLASS_YEARS, FORMATIONS, DEF_FRONTS } = await import('../js/constants.js');
const CP = await import('../js/engine/coachprofile.js');
const S = await import('../js/engine/staff.js');
const { addSkillXP, freshSkills, gradeIndexFromXP, SKILL_GRADE_XP } = await import('../js/engine/coach.js');
const { devMultFor } = await import('../js/engine/development.js');
const R = await import('../js/engine/recruiting.js');
const { createPlayer } = await import('../js/engine/player.js');
const { buildDepthChart } = await import('../js/engine/world.js');
const { simulateGame } = await import('../js/engine/sim.js');

let pass = 0, fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}`); ok ? pass++ : fail++; };
const hdr = (s) => console.log(`\n${s}`);

// ── The maxed tree: every axis banked to the sky ───────────────────────────
const maxedTree = { dna: { axes: {} }, ledger: [] };
for (const k of Object.keys(CP.DNA_AXES)) maxedTree.dna.axes[k] = 50000;

// ── The two arms, built through the REAL machinery ─────────────────────────
const inherit = CP.dnaInheritance(maxedTree, { seasonsUnderTree: 30 });
const profT = CP.createCoach('Tree', 'Born', { treeId: 'T9', dna: inherit });
const profS = CP.createCoach('Solo', 'Made', { treeId: 'T9' });

// Credential-seeded skills for arm T (a real coordinatorCredentials record —
// a strong OC ledger, the promoted man's inheritance path from W9).
const coT = S.generateCoordinator('OC', 85, 'D1');
for (let s = 1; s <= 8; s++) S.writeStaffLedger(coT, s, { OFF: 'A-' });
const credT = S.coordinatorCredentials(coT);
const skillsT = freshSkills();
if (credT.startingLevels) {
  for (const [k, lvl] of Object.entries(credT.startingLevels)) {
    if (skillsT[k] != null && typeof lvl === 'number') skillsT[k] = { xp: SKILL_GRADE_XP[Math.max(0, Math.min(12, lvl))] || 0 };
  }
}
const coachT = { isAI: false, skills: skillsT };
const coachS = { isAI: false, skills: freshSkills() };

// ── E1 + E2: the equal-decision career script ──────────────────────────────
hdr('E1/E2 — equal per-season earn streams through production code');
{
  // DNA: 300 XP/season into the same axis for both arms, via the real
  // addDnaXP (badges, migration, everything live).
  const AXIS = 'pressure';
  const SEASONS = 40, PER = 300;
  let tStar3 = null, sStar3 = null, tDiamond = null, sDiamond = null;
  for (let season = 1; season <= SEASONS; season++) {
    CP.addDnaXP(profT.id, { [AXIS]: PER });
    CP.addDnaXP(profS.id, { [AXIS]: PER });
    const gT = CP.dnaGrades(profT.id)[AXIS] || 0;
    const gS = CP.dnaGrades(profS.id)[AXIS] || 0;
    if (tStar3 == null && gT >= 9) tStar3 = season;
    if (sStar3 == null && gS >= 9) sStar3 = season;
    if (tDiamond == null && gT >= 10) tDiamond = season;
    if (sDiamond == null && gS >= 10) sDiamond = season;
  }
  console.log(`  seasons to ★★★: tree ${tStar3}, solo ${sStar3} · to 💎: tree ${tDiamond}, solo ${sDiamond}`);
  check(tStar3 != null && sStar3 != null && tStar3 < sStar3, `★★★ comes STRICTLY earlier for the tree arm (${tStar3} < ${sStar3}) — time compressed`);
  check(tDiamond != null && sDiamond != null && tDiamond < sDiamond, `💎 too (${tDiamond} < ${sDiamond})`);
  const gT = CP.dnaGrades(profT.id)[AXIS], gS = CP.dnaGrades(profS.id)[AXIS];
  check(gT === 10 && gS === 10, `both arms SATURATE at the same effective grade (${gT} = ${gS} = old max)`);
  const bT = CP.dnaBonus(AXIS, gT).mult, bS = CP.dnaBonus(AXIS, gS).mult;
  check(bT === bS, `and the same bonus (${bT}) — the ceiling is shared`);
  // The inheritance NEVER opened above ★★ — the head start was floors, not tiers.
  check(CP.dnaStarTier(inherit.axes[AXIS] || 0) <= C.TREE.INHERIT_CAP_STAR, `the head start itself was ★★-capped (${CP.dnaStarLabel(CP.dnaStarTier(inherit.axes[AXIS] || 0))})`);

  // Skills: equal 60 XP/season of developer work for both coaches.
  const dEarly = [devMultFor(coachT, {}), devMultFor(coachS, {})];
  for (let season = 1; season <= 60; season++) {
    addSkillXP(coachT, 'developer', 60);
    addSkillXP(coachS, 'developer', 60);
  }
  const dLate = [devMultFor(coachT, {}), devMultFor(coachS, {})];
  console.log(`  devMult day 1: tree ${dEarly[0].toFixed(3)} vs solo ${dEarly[1].toFixed(3)} · saturated: ${dLate[0].toFixed(3)} vs ${dLate[1].toFixed(3)}`);
  check(dEarly[0] > dEarly[1], 'credential-seeded skills give the tree arm a real day-1 developer edge');
  check(dLate[0] === dLate[1] && Math.abs(dLate[0] - 1.18) < 1e-9, `both saturate at the identical old maximum (${dLate[0]})`);

  // The formation envelope: both arms' mastery grows through the REAL
  // growHCMastery; the stacked mod caps at the same envelope for both.
  S.ensureHCMastery(coachT);
  S.ensureHCMastery(coachS);
  const form = Object.keys(FORMATIONS)[0];
  const gpGrow = { offFormations: [{ id: form, weight: 100 }], defFront: Object.keys(DEF_FRONTS)[0] };
  for (let y = 0; y < 30; y++) { S.growHCMastery(coachT, gpGrow); S.growHCMastery(coachS, gpGrow); }
  const maxCoord = { staff: { oc: { side: 'OC', schemeIQ: { [form]: 92 }, ratings: {} }, dc: null } };
  const modT = S.formationIqMod({ ...maxCoord, coach: coachT }, 'off', form);
  const modS = S.formationIqMod({ ...maxCoord, coach: coachS }, 'off', form);
  check(modT === modS && modT === C.HC_MASTERY.ENVELOPE_MAX, `at a maxed coordinator, both arms read the SAME capped envelope (${modT})`);
}

// ── The game-outcome arms ──────────────────────────────────────────────────
// Identical rosters (one generation, deep-cloned per game side), identical
// gameplans. The ONLY difference between schools is the coaching dressing.
const gp = { offFormation: 'Single Back', tendency: 'Balanced', rushInPct: 60, passDepth: { short: 40, medium: 40, deep: 20 }, blitzPct: 20, defFormation: 'Balanced D', fourthDown: 'Moderate', clockMgmt: 'Normal', maxFGDist: 42 };
function genRoster(schoolId) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], 1);
      p.schoolId = schoolId;
      r.push(p);
    }
  }
  return r;
}
const cloneRoster = (r, schoolId) => r.map((p) => { const q = JSON.parse(JSON.stringify(p)); q.schoolId = schoolId; return q; });

// School dressings. Coordinator IQ 48 default everywhere (staff omitted) so
// the ONLY levers are the ones the tree grants.
const day1Solo = () => ({ id: 'S', name: 'Solo U' });
const day1Tree = () => {
  // Day-1 protégé: the inherited profile's REAL dnaGrades stamped, exactly as
  // the season loop stamps them. (Skills/mastery don't differ on day 1.)
  const grades = CP.dnaGrades(profTDay1.id);
  return { id: 'T', name: 'Tree U', _dnaGrades: grades };
};
const endgame = (id) => {
  // A finished career, either path: 💎 everything, maxed mastery, maxed OC.
  const g = {};
  for (const k of Object.keys(CP.DNA_AXES)) g[k] = 10;
  const mastery = {};
  for (const s of [...Object.keys(FORMATIONS), ...Object.keys(DEF_FRONTS)]) mastery[s] = C.HC_MASTERY.CEILING;
  return {
    id, name: id,
    _dnaGrades: g,
    coach: { isAI: false, masteryIQ: mastery },
    staff: { oc: { side: 'OC', schemeIQ: { 'Single Back': 92 }, ratings: {} }, dc: { side: 'DC', schemeIQ: { 'Balanced D': 92, '4-3': 92 }, ratings: {} } },
  };
};
// A separate day-1 inherited profile (the E1 script maxed profT's pressure).
const profTDay1 = CP.createCoach('Tree', 'DayOne', { treeId: 'T9', dna: CP.dnaInheritance(maxedTree, { seasonsUnderTree: 30 }) });

function playArm(mkHome, mkAway, n) {
  // The gate statistic is POINT DIFFERENTIAL, not win% — far better power per
  // simulated game (calibrated: the day-1 inheritance is a true ~54% / +1.7
  // pts edge; win%-gates at affordable n flake, diff-gates don't).
  let a = 0, b = 0, sum = 0, sumSq = 0, m = 0;
  for (let i = 0; i < n; i++) {
    const base = genRoster('X');
    // Alternate which dressing gets home field so HOME_EDGE cancels.
    const flip = i % 2 === 1;
    const A = mkHome(), B = mkAway();
    const home = flip ? B : A, away = flip ? A : B;
    const rH = cloneRoster(base, home.id), rA = cloneRoster(base, away.id);
    const cH = buildDepthChart(rH, gp), cA = buildDepthChart(rA, gp);
    const res = simulateGame(home, away, rH, rA, cH, cA, gp, gp);
    const diff = flip ? res.awayScore - res.homeScore : res.homeScore - res.awayScore;
    sum += diff; sumSq += diff * diff; m++;
    if (diff > 0) a++;
    else if (diff < 0) b++;
  }
  const mean = sum / m;
  const sd = Math.sqrt(Math.max(0, sumSq / m - mean * mean));
  return { a, b, n: m, mean, se: sd / Math.sqrt(m) };
}

const N = parseInt(process.argv[2] || '400', 10);

hdr(`E3 — day-1 protégé vs day-1 solo (${Math.round(N * 1.5)} games, identical rosters)`);
{
  const r = playArm(day1Tree, day1Solo, Math.round(N * 1.5));
  console.log(`  protégé ${r.a}–${r.b} (${(r.a / (r.a + r.b) * 100).toFixed(1)}%) · mean diff ${r.mean >= 0 ? '+' : ''}${r.mean.toFixed(2)} pts (se ${r.se.toFixed(2)})`);
  check(r.mean > 0, `the inheritance is worth points on the field (calibrated true effect ~+1.7/game, 54% — real but modest, as the ★★ cap intends)`);
}

hdr(`E4 — THE LAW: maxed tree-line vs maxed solo (${N} games, identical rosters)`);
{
  const r = playArm(() => endgame('TMAX'), () => endgame('SMAX'), N);
  const tol = 2.5 * r.se + 0.5;
  console.log(`  tree-line ${r.a}–${r.b} · mean diff ${r.mean >= 0 ? '+' : ''}${r.mean.toFixed(2)} pts (tolerance ±${tol.toFixed(2)})`);
  check(Math.abs(r.mean) <= tol, `statistically indistinguishable — a maxed tree raises NO ceiling a maxed solo can't reach (|${r.mean.toFixed(2)}| ≤ ${tol.toFixed(2)})`);
}

hdr(`E5 — sanity: endgame vs day-1 solo (${N} games)`);
{
  const r = playArm(() => endgame('TMAX'), day1Solo, N);
  console.log(`  endgame ${r.a}–${r.b} (${(r.a / (r.a + r.b) * 100).toFixed(1)}%) · mean diff ${r.mean >= 0 ? '+' : ''}${r.mean.toFixed(2)} pts (se ${r.se.toFixed(2)})`);
  check(r.mean > 2 * r.se, `the systems are live — a finished career is worth real points over a day-1 school (calibrated ~+3.3/game, 57.6%; modest BY DESIGN — players decide games, the band-gate law from the other side)`);
}

CP.deleteCoach(profT.id); CP.deleteCoach(profS.id); CP.deleteCoach(profTDay1.id);

console.log(`\n${'='.repeat(50)}\n${fail === 0 ? 'ALL GREEN — the tree compresses time and raises no ceiling' : 'FAILURES: ' + fail} (${pass} passed)`);
process.exit(fail ? 1 : 0);
