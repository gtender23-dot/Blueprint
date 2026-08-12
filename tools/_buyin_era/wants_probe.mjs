// wants_probe.mjs — W8 (§13 RECRUITING WANTS) probe.
//
// The wave's promise, stated as things that must be numerically true:
//
//   W1  GENERATION FROM THE PROFILE. Each recruit draws 2–3 wants WEIGHTED BY
//       HIS PROFILE, division-independently (§11's talent ⊥ character law):
//       the Ego kid wants the ball and the stage, the grinding late bloomer
//       wants to be developed, the leader wants a locker room worth leading,
//       the student wants a classroom. No duplicates, no unknown types.
//   W2  MIGRATION + INERTNESS. Pre-W8 saves (bare-string wants, PROGRAM/
//       PEDIGREE, a separate ptWant) fold into the W8 shape in place, once,
//       idempotently — and a recruit with no wants multiplies nothing.
//   W3  EVERY WANT READS A RECEIPT. Each of the seven is answered by a system
//       that already banked its own proof, and every one of them MOVES when
//       that system moves. No orphan wants, no asserted currencies.
//   W4  WANTS SATISFIED → INTEREST MOVES (the wave's named assertion). Same
//       dollars, same kid, two programs: the one that answers him gets more
//       for its money. Monotone in satisfaction, scaled by importance,
//       bounded inside the pre-W8 envelope.
//   W5  (removed Aug 2026 with the recruit promise system.)
//   W6  THE EVALUATOR, WIDENED TO THE PERSON. Character is ALL VISIBLE and
//       fogged pre-signing: better Evaluator, tighter read, no bias, no
//       invented divas, exact truth once scouted.
//   W7  LEAGUE SAMPLE. On a real generated pool every want appears, the mix
//       is sane, and the average kid's multiplier centres near 1 — the system
//       is a lever, not a league-wide tax.
//
// Run: node tools/wants_probe.mjs
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
Math.random = mulberry32(0x8ADD1E5);

const { C, ROSTER_TARGETS } = await import('../js/constants.js');
const { createPlayer, createRecruit, roleDialOf } = await import('../js/engine/player.js');
const { freshSkills, SKILL_GRADE_XP, skillGradeIndex } = await import('../js/engine/coach.js');
const { ensureSchoolAcademics, educationGrade } = await import('../js/engine/academics.js');
const { programSpotlight, programCulture } = await import('../js/engine/measures.js');
const { ensureProgramBuyIn, programBuyIn, ensureBuyIn } = await import('../js/engine/development.js');
const {
  wantKey, wantsFor, rollWants, wantScore, wantSatisfaction, wantModFor, wantCentre, wantMod,
  developmentRecord, roleEdge, scoutedCharacter, wantsVisible,
  effectiveSpend, resetWantCache, createBoardEntry, seedFunnelData,
} = await import('../js/engine/recruiting.js');

let fails = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fails++;
};
const mean = xs => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
const sd = xs => { const m = mean(xs); return Math.sqrt(mean(xs.map(x => (x - m) ** 2))); };
const r2 = v => Math.round(v * 100) / 100;
const r3 = v => Math.round(v * 1000) / 1000;
const pct = v => `${(v * 100).toFixed(0)}%`;
const clone = o => JSON.parse(JSON.stringify(o));

// ── Scaffolding ───────────────────────────────────────────────────────────
function makeCoach({ dev = 5, rep = 5, evaluator = 5, recruiter = 5, roots = 5, id = 'hc' } = {}) {
  const c = { id, name: { first: 'A', last: 'Coach' }, skills: freshSkills(), budget: 0, scouted: {} };
  c.skills.developer.xp  = SKILL_GRADE_XP[dev];
  c.skills.reputation.xp = SKILL_GRADE_XP[rep];
  c.skills.evaluator.xp  = SKILL_GRADE_XP[evaluator];
  c.skills.recruiter.xp  = SKILL_GRADE_XP[recruiter];
  c.skills.roots.xp      = SKILL_GRADE_XP[roots];
  return c;
}
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
function makeSchool({ division = 'D1', prestige = 3, tier = 2, wins = 6, n = null,
                      coach = null, lat = 40, lng = -82, name = 'Probe State' } = {}) {
  const school = {
    id: 'probe_' + Math.floor(Math.random() * 1e9).toString(36),
    name, division, prestige, type: 'stateUniversity',
    lat, lng, location: { lat, lng },
    roster: makeRoster(tier, n),
    recentWins: [wins, wins, wins],
    record: { wins, losses: 12 - wins },
    stadium: { capacity: 40000 },
    facilities: { stadium: 2, training: 2, recruiting: 2, medicine: 2 },
    staff: {}, seasonHistory: [],
    coach: coach || makeCoach(),
  };
  ensureSchoolAcademics(school);
  ensureProgramBuyIn(school);
  resetWantCache();
  return school;
}
// A recruit with a HAND-SET profile — every W1 generation term pinned, so the
// want draw is the only thing being measured.
function profiledRecruit({ ego = false, grind = 50, coachability = 50, leadership = 50,
                           curve = 'steady', gpa = 2.5, vision = 50, pos = 'WR', tier = 2 } = {}) {
  const r = createRecruit(pos, tier, 40, -82, 0);
  r.character = { grind, coachability, leadership, ego };
  r.devProfile = { curve, volatility: 50 };
  r.gpa = gpa;
  r.visionRating = vision;
  r.attributes.WE = grind;
  r.wants = [];
  r.ptWant = null;
  return r;
}
function wantShare(make, n = 4000) {
  const counts = {};
  for (const t of C.WANTS.TYPES) counts[t] = 0;
  for (let i = 0; i < n; i++) {
    const r = make();
    rollWants(r);
    for (const w of r.wants) counts[wantKey(w)]++;
  }
  const out = {};
  for (const t of C.WANTS.TYPES) out[t] = counts[t] / n;
  return out;
}

console.log('\n════ W1 — GENERATION FROM THE PROFILE (§13) ════');
{
  // The §13 pairings, each measured against its own opposite. These are not
  // "the want exists" checks — they are "the PROFILE is what draws it" checks.
  const diva  = wantShare(() => profiledRecruit({ ego: true,  grind: 40, leadership: 40 }));
  const plain = wantShare(() => profiledRecruit({ ego: false, grind: 40, leadership: 40 }));
  check('W1a Ego draws PLAYING TIME ("Playing time NOW — Ego")',
    diva.PLAYING_TIME > plain.PLAYING_TIME * 1.25,
    `${pct(diva.PLAYING_TIME)} diva vs ${pct(plain.PLAYING_TIME)} plain`);
  check('W1b Ego draws THE SPOTLIGHT',
    diva.SPOTLIGHT > plain.SPOTLIGHT * 1.4,
    `${pct(diva.SPOTLIGHT)} vs ${pct(plain.SPOTLIGHT)}`);

  const grinder = wantShare(() => profiledRecruit({ grind: 90, curve: 'late' }));
  const loafer  = wantShare(() => profiledRecruit({ grind: 20, curve: 'early' }));
  check('W1c Grind + a late curve draws DEVELOP ME ("Grind / late-bloomer")',
    grinder.DEVELOPMENT > loafer.DEVELOPMENT * 1.4,
    `${pct(grinder.DEVELOPMENT)} grinder vs ${pct(loafer.DEVELOPMENT)} loafer`);
  check('W1d ...and the early bloomer wants the field NOW instead',
    loafer.PLAYING_TIME > grinder.PLAYING_TIME,
    `${pct(loafer.PLAYING_TIME)} early vs ${pct(grinder.PLAYING_TIME)} late`);

  const captain = wantShare(() => profiledRecruit({ leadership: 92 }));
  const loner   = wantShare(() => profiledRecruit({ leadership: 15 }));
  check('W1e Leadership draws CULTURE ("leaders want a locker room worth leading")',
    captain.CULTURE > loner.CULTURE * 1.35,
    `${pct(captain.CULTURE)} captain vs ${pct(loner.CULTURE)} loner`);

  const student = wantShare(() => profiledRecruit({ gpa: 3.9, grind: 88 }));
  const dropout = wantShare(() => profiledRecruit({ gpa: 1.8, grind: 25 }));
  check('W1f GPA + Grind draws EDUCATION ("the classroom literally recruits")',
    student.EDUCATION > dropout.EDUCATION * 1.5,
    `${pct(student.EDUCATION)} student vs ${pct(dropout.EDUCATION)} dropout`);

  // Shape: 2–3, no dupes, all known.
  let bad = 0, sizes = {};
  for (let i = 0; i < 3000; i++) {
    const r = profiledRecruit({ ego: Math.random() < 0.1, grind: 20 + Math.random() * 70 });
    rollWants(r);
    sizes[r.wants.length] = (sizes[r.wants.length] || 0) + 1;
    const keys = r.wants.map(wantKey);
    if (r.wants.length < C.WANTS.MIN || r.wants.length > C.WANTS.MAX) bad++;
    if (new Set(keys).size !== keys.length) bad++;
    if (keys.some(k => !C.WANTS.TYPES.includes(k))) bad++;
    if (r.wants.some(w => !C.WANTS.IMPORTANCE[w.importance])) bad++;
  }
  check('W1g every recruit draws 2–3 distinct known wants with a valid importance',
    bad === 0, `sizes ${JSON.stringify(sizes)}`);

  // The mirror contract (the W4 gp.blitzPct precedent).
  let mirrorBad = 0;
  for (let i = 0; i < 2000; i++) {
    const r = profiledRecruit({ ego: Math.random() < 0.3 });
    rollWants(r);
    const pt = r.wants.find(w => wantKey(w) === 'PLAYING_TIME');
    if (pt ? r.ptWant !== pt.importance : r.ptWant !== null) mirrorBad++;
  }
  check('W1h recruit.ptWant is an exact synced mirror of the PLAYING_TIME want',
    mirrorBad === 0, `${mirrorBad} mismatches in 2000`);

  // §11's law: talent ⊥ character, so the want mix cannot know the division.
  const d1 = wantShare(() => createRecruit('WR', 3, 40, -82, 0), 3000);
  const d3 = wantShare(() => createRecruit('WR', 1, 40, -82, 0), 3000);
  const drift = Math.max(...C.WANTS.TYPES.map(t => Math.abs(d1[t] - d3[t])));
  check('W1i want generation is DIVISION-INDEPENDENT (§11: talent ⊥ character)',
    drift < 0.05, `max D1↔D3 drift ${pct(drift)}`);
}

console.log('\n════ W2 — MIGRATION + INERTNESS ════');
{
  // The pre-W8 save shape, verbatim: bare strings, the retired keys, and the
  // playing-time want living OUTSIDE the array.
  const old = { id: 'r1', wants: ['DEVELOPMENT', 'PROGRAM'], ptWant: 'high', character: {}, gpa: 3 };
  const got = wantsFor(old);
  const keys = got.map(w => w.type);
  check('W2a bare-string wants migrate to the {type, importance} shape',
    got.every(w => typeof w === 'object' && w.type && w.importance));
  check('W2b PROGRAM retires into SPOTLIGHT (the name and the stage were one want)',
    keys.includes('SPOTLIGHT') && !keys.includes('PROGRAM'), keys.join(','));
  check('W2c the separate ptWant folds in at the importance it was rolled with',
    got.some(w => w.type === 'PLAYING_TIME' && w.importance === 'high'));
  const again = JSON.stringify(wantsFor(old));
  const third = JSON.stringify(wantsFor(old));
  check('W2d migration is idempotent (a save can be loaded twice)',
    again === third && again === JSON.stringify(got));

  const ped = wantsFor({ wants: ['PEDIGREE'] });
  check('W2e PEDIGREE also retires into SPOTLIGHT — no want is silently dropped',
    ped.length === 1 && ped[0].type === 'SPOTLIGHT');

  // ALIAS is a contract: every retired key must land on a LIVE type.
  check('W2f every aliased (retired) key points at a live want type',
    Object.values(C.WANTS.ALIAS).every(v => C.WANTS.TYPES.includes(v)));
  check('W2g every live want type has a generation weight row',
    C.WANTS.TYPES.every(t => C.WANTS.WEIGHT[t]));

  const school = makeSchool();
  const inert = { id: 'r0', wants: [], character: {}, position: 'WR', gpa: 2.5,
                  hometown: { lat: 40, lng: -82 }, attributes: { WE: 50 }, compositeRating: 60 };
  check('W2h a recruit with no wants multiplies NOTHING (exactly 1)',
    wantMod(inert, school.coach, school) === 1);
  const junk = wantsFor({ wants: ['NOT_A_WANT', 'DEVELOPMENT', 'DEVELOPMENT'] });
  check('W2i unknown and duplicate keys are dropped, not carried',
    junk.length === 1 && junk[0].type === 'DEVELOPMENT');
}

console.log('\n════ W3 — EVERY WANT READS A RECEIPT ════');
{
  const coach = makeCoach();
  // --- EDUCATION: the 5-year swing (W7's own measure)
  const invested = makeSchool();
  invested.academics.share = C.EDU.SHARE_MAX;
  invested.academics.history = [0.5, 0.5, 0.5, 0.5, 0.5];
  invested.facilities.academics = 5;
  for (const p of invested.roster) p.gpa = 3.4;
  resetWantCache();
  const gutted = makeSchool();
  gutted.academics.share = C.EDU.SHARE_MIN;
  gutted.academics.history = [0.02, 0.02, 0.02, 0.02, 0.02];
  gutted.facilities.academics = 1;
  for (const p of gutted.roster) p.gpa = 2.1;
  resetWantCache();
  const eduHi = wantScore('EDUCATION', invested.coach, invested);
  const eduLo = wantScore('EDUCATION', gutted.coach, gutted);
  check('W3a EDUCATION reads the program\'s education GRADE, not this year\'s promises',
    eduHi > eduLo + 0.25, `${r2(eduHi)} invested vs ${r2(eduLo)} gutted`);

  // --- CULTURE: program Buy-In (heavy) + the room
  const believers = makeSchool();
  believers.buyIn = { value: 95, coachId: believers.coach.id, seasons: 3 };
  for (const p of believers.roster) { p.character.grind = 85; p.character.coachability = 88; p.character.leadership = 80; }
  resetWantCache();
  const broken = makeSchool();
  broken.buyIn = { value: 12, coachId: broken.coach.id, seasons: 3 };
  for (const p of broken.roster) { p.character.grind = 25; p.character.coachability = 22; p.character.leadership = 20; }
  resetWantCache();
  const cultHi = wantScore('CULTURE', believers.coach, believers);
  const cultLo = wantScore('CULTURE', broken.coach, broken);
  check('W3b CULTURE reads program Buy-In and the room\'s own character',
    cultHi > cultLo + 0.3, `${r2(cultHi)} bought-in vs ${r2(cultLo)} broken`);

  // --- SPOTLIGHT: the measure + the retired PEDIGREE want (the coach's name)
  const bigStage = makeSchool({ prestige: 6, wins: 12 });
  bigStage.seasonHistory = [
    { rankedWeeks: 14, post: 'National Champion', awardPts: 8, confChamp: true },
    { rankedWeeks: 13, post: 'Semifinal', awardPts: 6, confChamp: true },
    { rankedWeeks: 12, post: 'Quarterfinal', awardPts: 5 },
  ];
  bigStage.attendance = { history: [0.99, 0.98, 0.99] };
  resetWantCache();
  const backwater = makeSchool({ prestige: 1, wins: 1 });
  backwater.seasonHistory = [
    { rankedWeeks: 0, post: '', awardPts: 0 }, { rankedWeeks: 0, post: '', awardPts: 0 },
    { rankedWeeks: 0, post: '', awardPts: 0 },
  ];
  backwater.attendance = { history: [0.32, 0.31, 0.30] };
  resetWantCache();
  const spotHi = wantScore('SPOTLIGHT', bigStage.coach, bigStage);
  const spotLo = wantScore('SPOTLIGHT', backwater.coach, backwater);
  check('W3c SPOTLIGHT reads the stage you actually played on',
    spotHi > spotLo + 0.35, `${r2(spotHi)} blueblood vs ${r2(spotLo)} backwater`);

  // The retired PEDIGREE want must still have a live consumer.
  const namedCoach = makeCoach({ rep: 12 });
  const noNameCoach = makeCoach({ rep: 0 });
  resetWantCache();
  const withName = wantScore('SPOTLIGHT', namedCoach, backwater);
  resetWantCache();
  const noName = wantScore('SPOTLIGHT', noNameCoach, backwater);
  check('W3d the retired PEDIGREE want is STILL CONSUMED — the coach\'s name moves SPOTLIGHT',
    withName > noName + 0.15, `${r2(withName)} A+ name vs ${r2(noName)} F name at the same school`);

  // --- DEVELOPMENT: the loop's receipts
  const claimsOnly = makeSchool({ coach: makeCoach({ dev: 11 }) });
  for (const p of claimsOnly.roster) { p.arrivalComposite = p.compositeRating; }   // grew nothing
  resetWantCache();
  const receipts = makeSchool({ coach: makeCoach({ dev: 11 }) });
  for (const p of receipts.roster) { p.arrivalComposite = p.compositeRating - 15; }
  resetWantCache();
  const devClaim = wantScore('DEVELOPMENT', claimsOnly.coach, claimsOnly);
  const devReal = wantScore('DEVELOPMENT', receipts.coach, receipts);
  check('W3e DEVELOP ME reads THE RECEIPTS — the same Developer grade, two records',
    devReal > devClaim + 0.2, `${r2(devReal)} with receipts vs ${r2(devClaim)} with claims only`);
  const rec = developmentRecord(receipts, receipts.coach);
  check('W3f ...and the Developer grade is still half of it',
    developmentRecord(receipts, makeCoach({ dev: 0 })).score < rec.score,
    `dev A+ ${r2(rec.score)} vs dev F ${r2(developmentRecord(receipts, makeCoach({ dev: 0 })).score)}`);
  const fresh = makeSchool();
  for (const p of fresh.roster) delete p.arrivalComposite;
  const freshRec = developmentRecord(fresh, makeCoach({ dev: 8 }));
  check('W3g a program with no receipts yet falls back to the grade alone (no invented proof)',
    freshRec.growth === null && Math.abs(freshRec.score - freshRec.skill) < 1e-9,
    `score ${r2(freshRec.score)} = skill ${r2(freshRec.skill)}`);

  // --- HOME: the distance curve, absorbed
  const s = makeSchool();
  const near = { position: 'WR', hometown: { lat: s.lat, lng: s.lng }, distanceFromSchool: 0 };
  const far  = { position: 'WR', hometown: { lat: s.lat + 22, lng: s.lng - 30 } };
  const hNear = wantScore('HOME', s.coach, s, near);
  const hFar  = wantScore('HOME', s.coach, s, far);
  check('W3h HOME is the distance factor, absorbed as a want',
    hNear > 0.95 && hFar < 0.2, `doorstep ${r2(hNear)}, across the country ${r2(hFar)}`);
  const homeCurve = [0, 175, 350, 525, 700, 1400].map(d => Math.max(0, 1 - d / C.WANTS.HOME_FAR_MI));
  check('W3i ...and it decays monotonically to zero at the far stop',
    homeCurve.every((v, i) => i === 0 || v <= homeCurve[i - 1]) && homeCurve[5] === 0);

  // --- ROLE: W5's contextual OVR, used as a pitch. "Contextual OVR shows him
  // HIS number in YOUR scheme during the pitch."
  const roleKid = createRecruit('TE', 3, 40, -82, 0);
  const tightEnd = makeSchool();  tightEnd.gameplan = { defBaseFront: '4-3', offFormations: [{ id: 'Single Back', weight: 100 }] };
  const spread = makeSchool();    spread.gameplan = { defBaseFront: '4-3', offFormations: [{ id: 'Air Raid', weight: 100 }] };
  const eIn = roleEdge(roleKid, tightEnd), eOut = roleEdge(roleKid, spread);
  check('W3j ROLE reads YOUR scheme\'s lens — the same body, two programs, two numbers',
    eIn.mine !== eOut.mine,
    `${eIn.mine} to a Single Back program vs ${eOut.mine} to an Air Raid (consensus ${eIn.consensus})`);
  const noScheme = makeSchool();  // no gameplan at all
  check('W3k a program with no scheme reads him at the consensus (no free edge)',
    roleEdge(roleKid, noScheme).edge === 0);
  check('W3k2 ...and the want follows the lens — the fit is worth more than the misfit',
    wantScore('ROLE', tightEnd.coach, tightEnd, roleKid) >
    wantScore('ROLE', spread.coach, spread, roleKid),
    `${r2(wantScore('ROLE', tightEnd.coach, tightEnd, roleKid))} vs ${r2(wantScore('ROLE', spread.coach, spread, roleKid))}`);

  // --- PLAYING_TIME: the depth chart he'd walk into
  const stacked = makeSchool({ tier: 3 });
  const empty = makeSchool({ tier: 1, n: 12 });
  const qb = createRecruit('QB', 2, 40, -82, 0);
  const ptStacked = wantScore('PLAYING_TIME', stacked.coach, stacked, qb);
  const ptEmpty = wantScore('PLAYING_TIME', empty.coach, empty, qb);
  check('W3l PLAYING TIME reads the depth chart he would actually walk into',
    ptEmpty > ptStacked, `${r2(ptEmpty)} wide open vs ${r2(ptStacked)} stacked`);

  // NO ORPHAN WANTS: every type must MOVE when the system that answers it
  // moves. (W6's DNA_CONSUMERS rule, applied to §13 — a want nothing answers
  // is a lie on the board.) Each pair below is the best/worst program for that
  // want specifically, so this measures the want's own consumer, not a
  // coincidence of fixtures.
  const PAIRS = {
    PLAYING_TIME: [[empty.coach, empty, qb], [stacked.coach, stacked, qb]],
    DEVELOPMENT:  [[receipts.coach, receipts, null], [makeCoach({ dev: 0 }), fresh, null]],
    EDUCATION:    [[invested.coach, invested, null], [gutted.coach, gutted, null]],
    CULTURE:      [[believers.coach, believers, null], [broken.coach, broken, null]],
    SPOTLIGHT:    [[namedCoach, bigStage, null], [noNameCoach, backwater, null]],
    ROLE:         [[tightEnd.coach, tightEnd, roleKid], [spread.coach, spread, roleKid]],
    HOME:         [[s.coach, s, near], [s.coach, s, far]],
  };
  const dead = [];
  for (const t of C.WANTS.TYPES) {
    const [[hc, hs, hr], [lc, ls, lr]] = PAIRS[t];
    resetWantCache(); const hi = wantScore(t, hc, hs, hr);
    resetWantCache(); const lo = wantScore(t, lc, ls, lr);
    if (!(hi - lo > 0.05)) dead.push(`${t}(${r2(hi)}/${r2(lo)})`);
  }
  check('W3m NO ORPHAN WANTS — all seven move when their own system moves',
    dead.length === 0, dead.length ? `dead: ${dead.join(' ')}` : 'seven live');
}

console.log('\n════ W4 — WANTS SATISFIED → INTEREST MOVES ════');
{
  // Monotone in satisfaction, through the pivot, with the sign the design says.
  const curve = [0, 0.25, 0.5, 0.75, 1].map(v => wantModFor(v, 'med'));
  check('W4a the multiplier is monotone in satisfaction',
    curve.every((v, i) => i === 0 || v >= curve[i - 1]), curve.map(r2).join(' → '));
  check('W4b ...and crosses exactly 1.00 at each want\'s OWN centre — an ORDINARY',
    C.WANTS.TYPES.every(t => Math.abs(wantModFor(wantCentre(t), 'med', t) - 1) < 1e-9),
    'program at a want is neutral, never taxed (the W6 calibration lesson)');
  check('W4c a fully met want pays, a fully missed one costs',
    curve[4] > 1.2 && curve[0] < 0.8, `met ×${r2(curve[4])}, missed ×${r2(curve[0])}`);

  // Importance is what §13 gives EVERY want in W8 (the pre-W8 world gave it to
  // playing time alone).
  const hi = wantModFor(1, 'high'), md = wantModFor(1, 'med'), lo = wantModFor(1, 'low');
  check('W4d importance scales the swing (high ≫ med ≫ low)',
    hi > md && md > lo && (hi - 1) > (lo - 1) * 2.5,
    `high ×${r2(hi)}, med ×${r2(md)}, low ×${r2(lo)}`);

  // The envelope is deliberately the pre-W8 one — balance is a W10 question.
  const allMet = wantModFor(1, 'high') * wantModFor(1, 'med') * wantModFor(1, 'low');
  const allMissed = wantModFor(0, 'high') * wantModFor(0, 'med') * wantModFor(0, 'low');
  check('W4e the three-want envelope still lands where the pre-W8 one did',
    allMet > 1.6 && allMet < 2.2 && allMissed > 0.25 && allMissed < 0.5,
    `all met ×${r2(allMet)}, all missed ×${r2(allMissed)} (pre-W8: 1.9 / 0.34)`);

  // THE NAMED ASSERTION. Same kid, same dollars, two programs identical except
  // for whether they answer what he is actually chasing.
  const kid = profiledRecruit({ ego: false, grind: 90, leadership: 88, gpa: 3.9, curve: 'late' });
  kid.wants = [
    { type: 'DEVELOPMENT', importance: 'high' },
    { type: 'EDUCATION', importance: 'med' },
    { type: 'CULTURE', importance: 'low' },
  ];
  kid.ptWant = null;
  const fitCoach = makeCoach({ dev: 12, rep: 6 });
  const fit = makeSchool({ coach: fitCoach });
  fit.academics.share = C.EDU.SHARE_MAX;
  fit.academics.history = [0.5, 0.5, 0.5, 0.5, 0.5];
  fit.facilities.academics = 5;
  fit.buyIn = { value: 92, coachId: fitCoach.id, seasons: 3 };
  for (const p of fit.roster) { p.gpa = 3.5; p.arrivalComposite = p.compositeRating - 16;
                                p.character.grind = 84; p.character.coachability = 86; p.character.leadership = 78; }
  const badCoach = makeCoach({ dev: 0, rep: 6 });
  const misfit = makeSchool({ coach: badCoach, prestige: 3, wins: 6 });
  misfit.academics.share = C.EDU.SHARE_MIN;
  misfit.academics.history = [0.02, 0.02, 0.02, 0.02, 0.02];
  misfit.facilities.academics = 1;
  misfit.buyIn = { value: 10, coachId: badCoach.id, seasons: 3 };
  for (const p of misfit.roster) { p.gpa = 2.0; p.arrivalComposite = p.compositeRating;
                                   p.character.grind = 25; p.character.coachability = 24; p.character.leadership = 20; }
  resetWantCache();
  const modFit = wantMod(kid, fit.coach, fit);
  const modMis = wantMod(kid, misfit.coach, misfit);
  check('W4f WANTS SATISFIED → INTEREST MOVES: the program that answers him is worth more',
    modFit > modMis * 1.5, `×${r2(modFit)} fit vs ×${r2(modMis)} misfit`);

  // Same statement in dollars, through the real interest math.
  kid.hometown = { lat: fit.lat, lng: fit.lng };
  misfit.lat = fit.lat; misfit.lng = fit.lng;
  misfit.prestige = fit.prestige;
  resetWantCache();
  const bidFit = effectiveSpend(10000, kid, fit, fit.coach, true);
  const bidMis = effectiveSpend(10000, kid, misfit, misfit.coach, true);
  check('W4g ...and the same $10k buys materially more at the program he wants',
    bidFit > bidMis * 1.4, `$${Math.round(bidFit)} vs $${Math.round(bidMis)} of effective spend`);

  // The share-of-room consequence: those dollars are what decide the race.
  const share = bidFit / (bidFit + bidMis);
  check('W4h ...which is a real share of a two-horse room, not a rounding error',
    share > 0.58, `${pct(share)} of the room on identical money`);

  // Bounded: no want stack can run away.
  const stacked = { ...kid, wants: C.WANTS.TYPES.map(t => ({ type: t, importance: 'high' })) };
  resetWantCache();
  const big = wantMod(stacked, fit.coach, fit);
  const small = wantMod(stacked, misfit.coach, misfit);
  check('W4i the combined multiplier is bounded in both directions',
    big <= C.WANTS.MOD_MAX && small >= C.WANTS.MOD_MIN,
    `${r2(small)} … ${r2(big)} inside [${C.WANTS.MOD_MIN}, ${C.WANTS.MOD_MAX}]`);

  check('W4j the ternary read the board draws its ✓/✕ from agrees with the score',
    wantSatisfaction('CULTURE', fit.coach, fit) === 1 &&
    wantSatisfaction('CULTURE', misfit.coach, misfit) === -1);
}

// [Aug 2026 — Garrett] W5 (PROMISES + THE HONESTY LEDGER) was removed from
// this probe along with the system it tested. Wants themselves are unchanged
// and still covered by W3/W4 above: a recruit is judged on what your program
// actually is. There is no longer anything you can promise him.

console.log('\n════ W6 — THE EVALUATOR, WIDENED TO THE PERSON ════');
{
  const truth = { grind: 70, coachability: 30, leadership: 55, ego: true };
  const mkKid = (id) => ({ id, character: { ...truth } });

  // Better Evaluator, tighter read. Measured as the SD of the error.
  const errFor = (grade) => {
    const errs = [];
    for (let i = 0; i < 1500; i++) {
      const c = makeCoach({ evaluator: grade, id: `ev${grade}_${i}` });
      const k = mkKid(`k${i}`);
      const seen = scoutedCharacter(c, k);
      errs.push(seen.grind - truth.grind, seen.coachability - truth.coachability, seen.leadership - truth.leadership);
    }
    return { sd: sd(errs), bias: mean(errs) };
  };
  const f = errFor(0), c6 = errFor(6), ap = errFor(12);
  check('W6a a better Evaluator reads the PERSON more accurately (noise shrinks monotonically)',
    f.sd > c6.sd && c6.sd > ap.sd, `F ±${r2(f.sd)} → C ±${r2(c6.sd)} → A+ ±${r2(ap.sd)}`);
  check('W6b the fog is UNBIASED — a bad evaluator is wrong, not pessimistic',
    Math.abs(f.bias) < 1.0 && Math.abs(ap.bias) < 0.5,
    `bias F ${r2(f.bias)}, A+ ${r2(ap.bias)}`);

  // Never invents a diva. (The one you didn't see coming is a recruiting
  // outcome; one who isn't there is a bug.)
  let phantom = 0, missed = 0;
  for (let i = 0; i < 800; i++) {
    const weak = makeCoach({ evaluator: 0, id: `w${i}` });
    if (scoutedCharacter(weak, { id: `n${i}`, character: { ...truth, ego: false } }).ego) phantom++;
    if (!scoutedCharacter(weak, { id: `e${i}`, character: { ...truth, ego: true } }).ego) missed++;
  }
  check('W6c a weak evaluator can MISS a diva but never invents one',
    phantom === 0 && missed > 0, `${phantom} phantom, ${missed}/800 missed`);

  // Scouted = the truth, no fog.
  const scout = makeCoach({ evaluator: 0, id: 'scouted' });
  const kid = mkKid('kk');
  scout.scouted = { kk: true };
  const seen = scoutedCharacter(scout, kid);
  check('W6d on a scouted kid you see the man, exactly (§13: no hidden character)',
    seen.grind === truth.grind && seen.coachability === truth.coachability &&
    seen.leadership === truth.leadership && seen.ego === truth.ego && seen.fogged === false);

  // Stability — the same number every render (the displayedRating contract).
  const c2 = makeCoach({ evaluator: 3, id: 'stable' });
  const k2 = mkKid('k2');
  const a = scoutedCharacter(c2, k2), b = scoutedCharacter(c2, k2);
  check('W6e the read is CACHED — a board that re-renders does not re-roll the kid',
    a.grind === b.grind && a.coachability === b.coachability && a.leadership === b.leadership);

  check('W6f the wants themselves are gated on the same Evaluator scope',
    wantsVisible(makeCoach({ evaluator: 12, id: 'v1' }), { id: 'x' }) === true &&
    wantsVisible(makeCoach({ evaluator: 0, id: 'v2' }), { id: 'x' }) === false &&
    wantsVisible((() => { const c = makeCoach({ evaluator: 0, id: 'v3' }); c.scouted = { x: true }; return c; })(),
      { id: 'x' }) === true);
  check('W6g no character block → no invented one',
    scoutedCharacter(makeCoach(), { id: 'z' }) === null);
}

console.log('\n════ W7 — LEAGUE SAMPLE ════');
{
  const { generateWorld, generateRecruitPool } = await import('../js/engine/world.js');
  const world = generateWorld();
  world.recruits = generateRecruitPool(world);
  const pool = world.recruits;

  const counts = {}; for (const t of C.WANTS.TYPES) counts[t] = 0;
  let sizes = {}, noWants = 0;
  for (const r of pool) {
    const ws = wantsFor(r);
    sizes[ws.length] = (sizes[ws.length] || 0) + 1;
    if (!ws.length) noWants++;
    for (const w of ws) counts[wantKey(w)]++;
  }
  const shares = Object.fromEntries(C.WANTS.TYPES.map(t => [t, counts[t] / pool.length]));
  console.log(`  ·   ${pool.length} recruits; want mix ${C.WANTS.TYPES.map(t => `${t.slice(0, 4)} ${pct(shares[t])}`).join('  ')}`);
  check('W7a every want appears on a real generated pool (no dead want in practice)',
    C.WANTS.TYPES.every(t => shares[t] > 0.05), JSON.stringify(sizes));
  check('W7b no recruit is generated wantless',
    noWants === 0);

  const school = world.schools.filter(s => s.division === 'D1').sort((a, b) => b.prestige - a.prestige)[0];
  const coach = school.coach || makeCoach();
  resetWantCache();
  const mods = pool.filter(r => r.recruitTier === 3).slice(0, 1200)
    .map(r => wantMod(r, coach, school));
  const m = mean(mods);
  console.log(`  ·   blueblood want multiplier over 1,200 D1 recruits: mean ×${r2(m)}, ${r2(Math.min(...mods))}–${r2(Math.max(...mods))}`);
  check('W7c the want system is a LEVER, not a league-wide tax (mean near 1)',
    m > 0.85 && m < 1.35, `mean ×${r2(m)}`);
  check('W7d ...with real spread — some kids fit you and some do not',
    Math.max(...mods) - Math.min(...mods) > 0.5,
    `${r2(Math.min(...mods))} … ${r2(Math.max(...mods))}`);

  // THE SYSTEM IS A TRADE, NOT A LADDER — §13's whole point, and the reason a
  // D3 program with a good read beats a war chest with a bad one. The
  // blueblood owns the stage and the room; the doormat owns the depth chart.
  // Neither is "better at wants"; they answer DIFFERENT kids.
  const weak = world.schools.filter(s => s.division === 'D1').sort((a, b) => a.prestige - b.prestige)[0];
  const weakCoach = weak.coach || makeCoach({ id: 'w' });
  const sample = pool.filter(r => r.recruitTier === 3).slice(0, 400);
  const avgWant = (t, c, sc) => { resetWantCache(); return mean(sample.map(r => wantScore(t, c, sc, r))); };
  const spotBig = avgWant('SPOTLIGHT', coach, school), spotSmall = avgWant('SPOTLIGHT', weakCoach, weak);
  const cultBig = avgWant('CULTURE', coach, school), cultSmall = avgWant('CULTURE', weakCoach, weak);
  const ptBig = avgWant('PLAYING_TIME', coach, school), ptSmall = avgWant('PLAYING_TIME', weakCoach, weak);
  check('W7e the blueblood owns the SPOTLIGHT the doormat cannot sell',
    spotBig > spotSmall, `${r2(spotBig)} vs ${r2(spotSmall)}`);
  check('W7f ...and the doormat owns the DEPTH CHART the blueblood cannot sell',
    ptSmall > ptBig, `playing time ${r2(ptSmall)} at the doormat vs ${r2(ptBig)} at the blueblood`);
  console.log(`  ·   culture ${r2(cultBig)} blueblood vs ${r2(cultSmall)} doormat — the trade, not a ladder`);
  check('W7g so the LEAGUE-WIDE multiplier is near 1 at BOTH ends — nobody is taxed for existing',
    (() => { resetWantCache();
      const wm = mean(sample.map(r => wantMod(r, weakCoach, weak)));
      return wm > 0.85 && wm < 1.35; })());
}

console.log(`\n${fails === 0 ? 'ALL CHECKS PASSED' : fails + ' FAILURES'}\n`);
process.exit(fails === 0 ? 0 : 1);
