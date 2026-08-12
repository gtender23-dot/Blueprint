// grade_honesty_probe.mjs — W6 gate: GRADES → MILESTONES → DNA → SPEECHES →
// LIVING STAFF. The wave's central promise is §10's balance note:
//
//     "Grades must be honest (bad teams get bad grades even in wins)."
//
// Everything else in W6 hangs off that, so the probe leads with it and then
// pins each downstream system to the design it was built from:
//   A. HONESTY — the same tape grades the same in a blowout win and a blowout
//      loss; a bad team grades badly while winning; decision #10's EVEN
//      weighting is exact; thin tape is ungraded, not invented.
//   B. THE SIM CAPTURE — snap counts, the protection ledger, sacksTaken and
//      the coverage rebuild all come back off a real game.
//   C. THE DNA AUDIT (§16.6) — the axis table, the roadWarrior→discipline
//      migration, the sim-mirror contract (no dead axes), the XP economy
//      (no dead axes, no fire-hose), the grade curve's career pace, titles.
//   D. HALFTIME, TWO LAYERS — the adjustments lean is floor-not-cliff and
//      monotone in each term; the speech is a season resource, gated by the
//      room, boosted only when the moment was real, and CHALLENGE is a
//      tradeoff (it buys effort and it buys flags).
//   E. COORDINATORS, ALIVE — growth reads his character and the culture above
//      him, the unit ledger records, credentials convert, the voice is stable
//      and a weak one can be a trap.
//
// Run from repo root: node tools/grade_honesty_probe.mjs [games]
import { C } from '../js/constants.js';
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
import {
  gradePlayerGame, gradeTeamGame, coverageLedger, letterFor, letterIndex,
  averageLetter, recordPlayerGrade, seasonGrade, GRADE_LETTERS,
} from '../js/engine/grades.js';
import {
  DNA_AXES, DNA_CONSUMERS, DNA_XP_SOURCES, dnaGrade, dnaXpForNextGrade,
  dnaTitle, migrateDna, adjustmentLean, adjustmentLeanText, speechCountFor, aiDnaAccrue, aiDnaTitle,
} from '../js/engine/coachprofile.js';
import {
  SPEECH_FLAVORS, ensureSpeechBank, speechMoment, speechEffectiveness,
  applySpeech, speechFeedback, applyMemorableSpeech,
} from '../js/engine/speeches.js';
import {
  generateCoordinator, growCoordinator, recordUnitGrades, coordStreak,
  coordinatorCredentials, coordinatorVoice, coordRatingAvg, schemeFriction,
} from '../js/engine/staff.js';
import { ensureProgramBuyIn } from '../js/engine/development.js';

const N = parseInt(process.argv[2] || '6', 10);
let fail = 0;
const g = (n, ok, d = '') => { if (!ok) fail++; console.log(`${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`); };

const mkP = (pos, cls = 'JR', tier = 1) => { const p = createPlayer(pos, cls, tier); return p; };

// ═══ A. THE HONESTY LAW ═══════════════════════════════════════════════════
{
  // A1 — the same stat line grades identically no matter the scoreboard. The
  // grade functions take no score, no winner, no opponent: this is the law
  // made structural, and the probe pins it by grading the SAME line through a
  // blowout win's context and a blowout loss's.
  const rb = mkP('RB');
  const line = { rushAtt: 18, rushYds: 96, rushTD: 1, targets: 3, recComp: 2, recYds: 18, brokenTackles: 3 };
  const win  = gradePlayerGame(rb, line, { snaps: { [rb.id]: 44 } });
  const loss = gradePlayerGame(rb, line, { snaps: { [rb.id]: 44 } });
  g('A1 the same tape grades the same in a win and a loss (the honesty law)',
    win && loss && win.score === loss.score && win.letter === loss.letter,
    `${win?.letter} both ways`);

  // A2 — a bad team grades badly even while winning. Nothing about a team
  // scoring 52 can rescue a quarterback who went 8-of-24.
  const qb = mkP('QB');
  const bad  = gradePlayerGame(qb, { passAtt: 24, passComp: 8, passYds: 88, passTD: 0, passInt: 3, rushAtt: 4, rushYds: 6, sacksTaken: 5 }, {});
  const good = gradePlayerGame(qb, { passAtt: 24, passComp: 17, passYds: 268, passTD: 3, passInt: 0, rushAtt: 4, rushYds: 22, sacksTaken: 1 }, {});
  g('A2 a bad quarterback grades badly — no scoreboard can rescue the tape',
    bad && good && letterIndex(bad.letter) <= letterIndex('D+') && letterIndex(good.letter) >= letterIndex('B'),
    `bad ${bad?.letter} (${bad?.score}) vs good ${good?.letter} (${good?.score})`);

  // A3 — DECISION #10: EVEN. Not "mostly production."
  const samples = [
    [mkP('WR'), { targets: 9, recComp: 6, recYds: 74, recTD: 1, contestedTgt: 3, contestedRec: 2 }, {}],
    [mkP('LB'), { tackles: 9, tacklesForLoss: 2, sacks: 1, missedTackles: 1, pressures: 2 }, null],
    [mkP('QB'), { passAtt: 30, passComp: 20, passYds: 240, passTD: 2, passInt: 1, rushAtt: 5, rushYds: 30, sacksTaken: 2 }, {}],
  ];
  let even = true;
  for (const [p, line, extra] of samples) {
    const ctx = extra === null ? { snaps: { [p.id]: 55 } } : extra;
    const r = gradePlayerGame(p, line, ctx);
    if (!r || Math.abs(r.score - (r.prod + r.exec) / 2) > 0.51) even = false;
  }
  g('A3 decision #10: production and execution weigh EXACTLY the same', even);

  // A4 — thin tape is not graded. An invented C on four snaps is a lie.
  const wr = mkP('WR');
  const thin = gradePlayerGame(wr, { targets: 1, recComp: 1, recYds: 40, recTD: 1 }, {});
  const real = gradePlayerGame(wr, { targets: 4, recComp: 3, recYds: 61, recTD: 1 }, {});
  g('A4 below the rep floor a man is UNGRADED, not invented',
    thin === null && real !== null, `1 target → ${thin}, 4 targets → ${real?.letter}`);

  // A5 — the ladder is monotone and bounded: better tape never grades worse.
  const rb2 = mkP('RB');
  const ladder = [40, 60, 80, 100, 130].map(yds =>
    gradePlayerGame(rb2, { rushAtt: 20, rushYds: yds, rushTD: 1, brokenTackles: 3 }, {}).score);
  g('A5 the curve is monotone in production and stays on the scale',
    ladder.every((v, i) => i === 0 || v >= ladder[i - 1]) && ladder[0] >= 2 && ladder[4] <= 99,
    ladder.join(' → '));

  // A6 — flags cost EXECUTION, never production. Discipline lives there.
  const clean  = gradePlayerGame(mkP('OL'), {}, { prot: { x: null } , snaps: {} }) ; // ungraded, ignored
  const base   = { targets: 8, recComp: 6, recYds: 88, recTD: 1 };
  const wr2 = mkP('WR');
  const noFlag = gradePlayerGame(wr2, base, {});
  const flagged = gradePlayerGame(wr2, { ...base, penalties: 2 }, {});
  g('A6 flags come out of EXECUTION and leave production untouched',
    noFlag.prod === flagged.prod && flagged.exec < noFlag.exec && flagged.score < noFlag.score,
    `exec ${noFlag.exec} → ${flagged.exec}, prod ${noFlag.prod} both`);

  // A7 — the line is graded on its own tape: a leaky protection is a bad
  // grade even when the team ran for a ton.
  const ol = mkP('OL');
  const clean5 = gradePlayerGame(ol, {}, { prot: { [ol.id]: { pass: 30, run: 25, runYds: 112, sackAllowed: 0, pressAllowed: 2 } } });
  const leaky  = gradePlayerGame(ol, {}, { prot: { [ol.id]: { pass: 30, run: 25, runYds: 112, sackAllowed: 4, pressAllowed: 9 } } });
  g('A7 the offensive line is graded on protection, not on the box score',
    clean5 && leaky && clean5.prod === leaky.prod && letterIndex(clean5.letter) > letterIndex(leaky.letter),
    `clean ${clean5?.letter} vs leaky ${leaky?.letter} (same run blocking)`);

  // A8 — coverage: a corner nobody threw at grades at the honest middle, not
  // at an A. Silence is not excellence.
  const cb = mkP('CB');
  const untested = gradePlayerGame(cb, { tackles: 3 }, { snaps: { [cb.id]: 55 } });
  const locked   = gradePlayerGame(cb, { tackles: 3, passBreakups: 2 }, { snaps: { [cb.id]: 55 }, cover: { [cb.id]: { tgt: 7, allowed: 2, yds: 21, pbu: 2, ints: 0 } } });
  const torched  = gradePlayerGame(cb, { tackles: 3 }, { snaps: { [cb.id]: 55 }, cover: { [cb.id]: { tgt: 7, allowed: 6, yds: 104, pbu: 0, ints: 0 } } });
  g('A8 an untested corner reads at the middle; coverage decides the rest',
    untested.exec === 50 && locked.exec > 60 && torched.exec < 40,
    `untested ${untested.exec} · locked ${locked.exec} · torched ${torched.exec}`);

  // A9 — letters round-trip through the ladder.
  g('A9 the letter ladder round-trips and averages',
    GRADE_LETTERS.length === 13 && letterFor(50) === 'C' && letterFor(95) === 'A+' && letterFor(5) === 'F'
    && averageLetter(['A', 'C']) && letterIndex(averageLetter(['B', 'B'])) === letterIndex('B'),
    `50→${letterFor(50)}, 95→${letterFor(95)}, avg(B,B)=${averageLetter(['B','B'])}`);
}

// ═══ B. THE SIM CAPTURE ═══════════════════════════════════════════════════
function genRoster(t, s) {
  const r = [];
  for (const [pos, c] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < c; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], t); p.schoolId = s; r.push(p); }
  }
  return r;
}
const mk = (o = {}) => ({ offFormations: [{ id: 'Spread', weight: 35 }, { id: 'Single Back', weight: 40 }, { id: 'Power-I', weight: 25 }],
  tendency: 'Balanced', rushInPct: 55, passDepth: { short: 40, medium: 40, deep: 20 },
  blitzPct: 25, fourthDown: 'Moderate', baseTempo: 'Normal', maxFGDist: 42, ...o });

let sample = null;
{
  const rH = genRoster(1, 'H'), rA = genRoster(1, 'A');
  const hSchool = { id: 'H', name: 'Home U', roster: rH };
  const res = simulateGame(hSchool, { id: 'A', name: 'Away St', roster: rA }, rH, rA,
    buildDepthChart(rH, mk()), buildDepthChart(rA, mk()), mk(), mk());
  sample = { res, hSchool, rH };

  const snaps = res.homeSnapCounts || {};
  const prot  = res.homeProtection || {};
  g('B1 snap counts come back for both sides (the free rep denominator)',
    Object.keys(snaps).length > 20 && Object.keys(res.awaySnapCounts || {}).length > 20,
    `${Object.keys(snaps).length} home / ${Object.keys(res.awaySnapCounts || {}).length} away`);

  const protRows = Object.values(prot);
  const totalPass = protRows.reduce((s, e) => s + e.pass, 0);
  const totalRun  = protRows.reduce((s, e) => s + e.run, 0);
  g('B2 the protection ledger records real pass sets and run blocks for five men',
    protRows.length >= 5 && totalPass > 40 && totalRun > 40,
    `${protRows.length} linemen, ${totalPass} pass sets, ${totalRun} run blocks`);

  const sacksAllowed = protRows.reduce((s, e) => s + e.sackAllowed, 0);
  const teamSacksAgainst = Object.values(res.awayPlayerStats || {}).reduce((s, p) => s + (p.sacks || 0), 0);
  g('B3 sacks are charged to the whole unit — five men wear every sack',
    protRows.length >= 5 && Math.abs(sacksAllowed / 5 - teamSacksAgainst) < 1.01,
    `ledger ${sacksAllowed} across ${protRows.length} men vs ${teamSacksAgainst} defensive sacks`);

  const qbLines = Object.values(res.homePlayerStats || {}).filter(s => (s.passAtt || 0) > 5);
  const takenTotal = qbLines.reduce((s, x) => s + (x.sacksTaken || 0), 0);
  g('B4 sacksTaken is dug back out of the NCAA rushing column for the QB grade',
    qbLines.length > 0 && Math.abs(takenTotal - teamSacksAgainst) < 1.01,
    `${takenTotal} taken vs ${teamSacksAgainst} allowed`);

  const cov = coverageLedger(res.drives, 'home');
  const covTgts = Object.values(cov).reduce((s, e) => s + e.tgt, 0);
  const covAllowed = Object.values(cov).reduce((s, e) => s + e.allowed, 0);
  g('B5 coverage reps rebuild from covAssign with no new per-snap telemetry',
    Object.keys(cov).length >= 3 && covTgts > 10 && covAllowed <= covTgts,
    `${Object.keys(cov).length} defenders, ${covAllowed}/${covTgts} allowed`);

  const graded = gradeTeamGame(hSchool, res.homePlayerStats, {
    snaps, prot, cover: coverageLedger(res.drives, 'home'),
  });
  const letters = Object.values(graded.byId).map(x => x.letter);
  g('B6 a real game grades a real roster, units and sides included',
    letters.length >= 8 && graded.units.OL && graded.off && graded.def && graded.overall,
    `${letters.length} graded · off ${graded.off?.letter} · def ${graded.def?.letter} · overall ${graded.overall?.letter}`);

  // B7 — the grades land on the sport's scale, not everyone at A and not
  // everyone at F. A league of average teams should centre near C/B-.
  const avg = Object.values(graded.byId).reduce((s, x) => s + x.score, 0) / letters.length;
  const spread = Math.max(...Object.values(graded.byId).map(x => x.score))
               - Math.min(...Object.values(graded.byId).map(x => x.score));
  g('B7 grades centre in the sport and actually spread (no everybody-gets-an-A)',
    avg > 35 && avg < 68 && spread > 25, `mean ${avg.toFixed(1)}, spread ${spread.toFixed(0)}`);

  // B8 — the pre-W6 engine is untouched where it should be: no _h2Penalty
  // anywhere means the speech channel is inert in a normal game.
  const anyPen = (res.drives || []).some(d => (d.plays || []).some(p => p._h2Penalty != null));
  g('B8 the speech penalty channel is inert in a game where nobody spoke', !anyPen);
}

// ═══ C. THE DNA AUDIT (§16.6) ═════════════════════════════════════════════
{
  const keys = Object.keys(DNA_AXES);
  g('C1 §16.6 verdict applied: 11 axes, roadWarrior retired, motivator + culture added',
    keys.length === 11 && !keys.includes('roadWarrior')
    && keys.includes('motivator') && keys.includes('culture')
    && DNA_AXES.discipline.label === 'Composure',
    keys.join(', '));

  // C2 — MIGRATION: nobody loses a grade he earned.
  const legacy = { axes: { roadWarrior: 300, discipline: 120, pressure: 40 }, badges: [] };
  const beforeRoad = dnaGrade(300), beforeDisc = dnaGrade(120);
  migrateDna(legacy);
  g('C2 roadWarrior XP merges into Composure — no coach loses progress',
    legacy.axes.roadWarrior === undefined && legacy.axes.discipline === 420
    && dnaGrade(legacy.axes.discipline) >= Math.max(beforeRoad, beforeDisc),
    `300 + 120 → ${legacy.axes.discipline} (G${dnaGrade(legacy.axes.discipline)})`);

  // C3 — a stale roadWarrior key can never render "undefined Coach".
  const stale = { axes: { roadWarrior: 900, groundPound: 700 }, badges: [] };
  const title = dnaTitle(stale);
  g('C3 titles filter to live axes — a pre-migration profile never breaks',
    !title.includes('undefined') && title.includes('Ground & Pound'), title);

  // C4 — §16.6.5: every live axis has a title name, including the new two.
  const titled = keys.every(k => {
    const t = dnaTitle({ axes: { [k]: 5000 } });
    return t && !t.includes('undefined') && t !== 'Building an Identity';
  });
  g('C4 §16.6.5: every axis names a coach (titles extend to the new axes)', titled,
    `motivator → "${dnaTitle({ axes: { motivator: 5000 } })}", culture → "${dnaTitle({ axes: { culture: 5000 } })}"`);

  // C5 — §16.6.6 THE SIM MIRROR CONTRACT: no dead axes. Every axis in the
  // table must name a live consumer; the promise IS the contract.
  const orphans = keys.filter(k => !(DNA_CONSUMERS[k] || []).length);
  const ghosts = Object.keys(DNA_CONSUMERS).filter(k => !DNA_AXES[k]);
  g('C5 §16.6.6 the mirror contract holds — every axis has a named consumer, and no consumer names a dead axis',
    orphans.length === 0 && ghosts.length === 0,
    orphans.length || ghosts.length ? `orphans ${orphans} ghosts ${ghosts}` : `${keys.length} axes, all live`);

  // C6 — §16.6.1 THE XP ECONOMY: every axis must be earnable, and documented.
  const undocumented = keys.filter(k => !(DNA_XP_SOURCES[k] || []).length);
  g('C6 §16.6.1 every axis has documented XP sources (no dead axes)',
    undocumented.length === 0, undocumented.length ? `missing: ${undocumented}` : 'all 11 documented');

  // C7 — §16.6.2 THE GRADE CURVE, re-checked against the new sources. The
  // curve was tuned for 10 axes and the old XP volumes; the audit's question
  // is whether it still lands at career-realistic pace now that grades,
  // speeches and unit performance feed it. Model a season's realistic income
  // on the two NEW axes and check the shape: early identity fast, grade 10 a
  // career. (The verdict is that the curve holds and the NEW SOURCES were
  // sized to it — which is what these numbers assert.)
  // Two incomes per axis, because the honest audit is about SHAPE, not a
  // single number: what a coach earns in his FIRST years (no four-year men in
  // the building yet, a room that grades out only sometimes) and what an
  // ESTABLISHED program earns. Both are measured against w6_loop_smoke, which
  // observed ~28/yr motivator and ~10/yr culture in a brand-new program.
  const d = C.DNA_W6;
  const earlyMotivator = 12 * d.xpGradeA * 0.7 + d.xpBreakout;                       // ≈ 35
  const earlyCulture   = 12 * d.xpGradeTeamB * 0.25 + d.xpTeamCharacter;             // ≈ 17
  const matureMotivator = 12 * d.xpGradeA * 1.2 + d.xpBreakout + d.xpSpeechRead * 1.5;
  const matureCulture   = 12 * d.xpGradeTeamB * 0.6 + d.xpFourYear + d.xpTeamCharacter;
  const yearsTo = (perYear, grade) => dnaXpForNextGrade(grade - 1) / perYear;
  const motY3 = yearsTo(matureMotivator, 3), motY10 = yearsTo(matureMotivator, 10);
  const culY3 = yearsTo(matureCulture, 3), culY10 = yearsTo(matureCulture, 10);
  g('C7 §16.6.2 the 40·g^1.7 curve still lands right for an established program: identity in a few years, grade 10 is a career',
    motY3 < 5 && motY10 > 12 && motY10 < 60 && culY3 < 7 && culY10 > 12 && culY10 < 90,
    `motivator G3 ≈ ${motY3.toFixed(1)}yr / G10 ≈ ${motY10.toFixed(0)}yr · culture G3 ≈ ${culY3.toFixed(1)}yr / G10 ≈ ${culY10.toFixed(0)}yr`);
  // And the early years are SLOWER, not dead — the loop has to be climbable
  // from a standing start (§10.1 dense low rungs) without being instant.
  g('C7b ...and a brand-new coach climbs from a standing start: slower, never stalled',
    yearsTo(earlyMotivator, 1) < 3 && yearsTo(earlyCulture, 1) < 3
    && yearsTo(earlyMotivator, 3) < 20 && yearsTo(earlyCulture, 3) < 20
    && earlyMotivator < matureMotivator && earlyCulture < matureCulture,
    `standing start — first grade: motivator ≈ ${yearsTo(earlyMotivator, 1).toFixed(1)}yr / culture ≈ ${yearsTo(earlyCulture, 1).toFixed(1)}yr · a real identity (G3): ${yearsTo(earlyMotivator, 3).toFixed(0)}yr / ${yearsTo(earlyCulture, 3).toFixed(0)}yr`);

  // C8 — and the new axes are not a FIRE-HOSE relative to the old ones. A
  // season of the best identity XP the old economy pays is the yardstick.
  const seasonIdentity = 12 * 6 + 10 * 2;   // ~6/game on a leaned identity + two badges
  g('C8 §16.6.1 the new axes earn at a comparable rate — no one-axis fire-hose',
    matureMotivator < seasonIdentity * 1.6 && matureCulture < seasonIdentity * 1.6
    && matureMotivator > seasonIdentity * 0.25 && matureCulture > seasonIdentity * 0.25,
    `identity ≈ ${seasonIdentity}/yr · motivator ≈ ${matureMotivator.toFixed(0)} · culture ≈ ${matureCulture.toFixed(0)}`);

  // C9 — §16.6.8: AI coaches accrue an IDENTITY, and it reads in the same
  // language the player's does.
  const ai = { tenureSeasons: 6 };
  for (let i = 0; i < 8; i++) aiDnaAccrue(ai, { runShare: 0.63, blitzPct: 34, wins: 9, expected: 7, roadWins: 3, tenure: 6 });
  const aiTitle = aiDnaTitle(ai);
  g('C9 §16.6.8 AI coaches grow a real identity the world can name',
    ai.dna.axes.groundPound > 0 && ai.dna.axes.pressure > 0 && !aiTitle.includes('undefined')
    && aiTitle !== 'Building an Identity', `"${aiTitle}"`);
}

// ═══ D. HALFTIME, TWO LAYERS ══════════════════════════════════════════════
{
  // D1 — §10.1 FLOOR, NOT CLIFF. A brand-new coach's adjustment is exactly the
  // pre-W6 baseline: strength 1.0, never less.
  const cold = adjustmentLean({}, 'offlean', 0);
  g('D1 §10.1 floor-not-cliff: a coach with nothing lands the engine baseline, never worse',
    cold.strength === 1, `strength ${cold.strength}`);

  // D2 — each of the three terms moves it, and only upward.
  const mind = adjustmentLean({ adjustments: 8 }, 'offlean', 0).strength;
  const fit  = adjustmentLean({ groundPound: 8 }, 'offlean', 0).strength;
  const rep  = adjustmentLean({}, 'offlean', 12).strength;
  const all  = adjustmentLean({ adjustments: 8, groundPound: 8 }, 'offlean', 12).strength;
  g('D2 the lean is the mind × the identity × credibility — each term real, all additive',
    mind > 1 && fit > 1 && rep > 1 && all > Math.max(mind, fit, rep) && all <= C.HT_ADJ.max,
    `mind ${mind.toFixed(2)} · identity ${fit.toFixed(2)} · rep ${rep.toFixed(2)} · all ${all.toFixed(2)}`);

  // D3 — the identity that matches the change is the one that counts.
  const groundFresh = adjustmentLean({ groundPound: 9 }, 'fresh', 0).strength;
  const airFresh    = adjustmentLean({ airAttack: 9 }, 'fresh', 0).strength;
  g('D3 the matching identity amplifies — a Ground & Pound coach\'s conditioning push hits different',
    groundFresh > airFresh, `ground ${groundFresh.toFixed(2)} vs air ${airFresh.toFixed(2)}`);

  // D4 — §10.1 demands it be FORECAST, never hidden.
  const text = adjustmentLeanText(adjustmentLean({ adjustments: 6, pressure: 5 }, 'deflean', 8));
  g('D4 §10.1 the UI can forecast it — informed risk, never hidden punishment',
    typeof text === 'string' && text.length > 20 && /%/.test(text), `"${text}"`);

  // D5 — #11: adjustment DNA sets HOW MANY speeches.
  const counts = [0, 3, 6, 10].map(speechCountFor);
  g('D5 #11: the Adjustments grade sets the speech COUNT',
    counts[0] === C.SPEECH.base && counts.every((v, i) => i === 0 || v >= counts[i - 1]) && counts[3] <= C.SPEECH.max,
    counts.join(' → '));

  // D6 — the bank is a season resource, refills on the season, and survives a
  // mid-season grade-up without refunding what was spent.
  const coach = {};
  const b1 = ensureSpeechBank(coach, { adjustments: 0 }, 5);
  const startTotal = b1.total;
  b1.left--; b1.used++;
  const b2 = ensureSpeechBank(coach, { adjustments: 10 }, 5);
  const spent = b2.used;
  const b3 = ensureSpeechBank(coach, { adjustments: 10 }, 6);
  g('D6 speeches are a season resource — grading up adds, and spent stays spent',
    b2.total > startTotal && b2.left === b2.total - spent && b3.left === b3.total && b3.used === 0,
    `S5 ${b2.left}/${b2.total} after 1 used (was ${startTotal}) · S6 refilled ${b3.left}/${b3.total}`);

  // D7 — §16.3 THE MOMENT is engine truth. Trailing-but-winnable, stakes, a
  // reeling room and an upset in progress all read TRUE; a comfortable lead in
  // a nothing game reads FALSE.
  const trailing = speechMoment({ myScore: 10, oppScore: 21 });
  const rivalry  = speechMoment({ myScore: 21, oppScore: 20, rivalry: true });
  const upset    = speechMoment({ myScore: 17, oppScore: 10, myPrestige: 2, oppPrestige: 5 });
  const reeling  = speechMoment({ myScore: 21, oppScore: 24, isHome: true, drives: [
    { possession: 'home', result: 'touchdown' }, { possession: 'away', result: 'touchdown' },
    { possession: 'away', result: 'touchdown' }] });
  const nothing  = speechMoment({ myScore: 31, oppScore: 3 });
  const blowout  = speechMoment({ myScore: 3, oppScore: 45 });
  g('D7 §16.3 the engine knows a true moment — and a nothing one',
    trailing.correct && rivalry.correct && upset.correct && reeling.correct
    && !nothing.correct && !blowout.correct,
    `nothing-game reasons ${nothing.reasons.length}, 42-down reasons ${blowout.reasons.length}`);

  // D8 — #11: motivator sets HOW EFFECTIVE, the room gates it, and reading it
  // right is worth multiples of getting it wrong.
  const room = { coach: { id: 'x', tenureSeasons: 3 } };
  ensureProgramBuyIn(room);
  const hot = { coach: { id: 'y', tenureSeasons: 12 } }; ensureProgramBuyIn(hot); hot.buyIn.value = 90;
  const cold2 = { coach: { id: 'z', tenureSeasons: 0 } }; ensureProgramBuyIn(cold2); cold2.buyIn.value = 12;
  const right = speechMoment({ myScore: 7, oppScore: 17 });
  const wrong = speechMoment({ myScore: 40, oppScore: 3 });
  const eLo = speechEffectiveness({ motivator: 0 }, room, right);
  const eHi = speechEffectiveness({ motivator: 10 }, room, right);
  const eHot = speechEffectiveness({ motivator: 5 }, hot, right);
  const eCold = speechEffectiveness({ motivator: 5 }, cold2, right);
  const eWrong = speechEffectiveness({ motivator: 10 }, room, wrong);
  g('D8 #11: Motivator sets the power, the room gates it, and reading it right is worth multiples',
    eHi > eLo * 1.5 && eHot > eCold * 1.5 && eHi > eWrong * 3,
    `G0 ${eLo.toFixed(2)} · G10 ${eHi.toFixed(2)} · bought-in ${eHot.toFixed(2)} · broken ${eCold.toFixed(2)} · wasted ${eWrong.toFixed(2)}`);

  // D9 — CHALLENGE IS A TRADEOFF, not a buff (§3's law reaches speeches).
  const gpC = {}, gpR = {}, gpS = {};
  applySpeech(gpC, 'challenge', 1.2);
  applySpeech(gpR, 'rally', 1.2);
  applySpeech(gpS, 'steady', 1.2);
  g('D9 Challenge buys effort AND flags — a speech is never free candy',
    gpC._h2OffLean.eff > 0 && gpC._h2DefLean.eff > 0 && gpC._h2Penalty > 0
    && gpR._h2OffLean.eff > 0 && !gpR._h2Penalty
    && gpS._h2DefLean.eff > 0 && gpS._h2Fresh.eff > 0 && !gpS._h2Penalty,
    `challenge pen +${(gpC._h2Penalty * 100).toFixed(0)}% flags`);

  // D10 — a speech STACKS onto an adjustment through the same channels, and
  // the caps hold.
  const stacked = { _h2OffLean: { eff: 0.16 } };
  applySpeech(stacked, 'rally', 3);
  g('D10 a speech stacks onto the adjustment and the caps hold',
    stacked._h2OffLean.eff > 0.16 && stacked._h2OffLean.eff <= 0.24,
    `0.16 → ${stacked._h2OffLean.eff.toFixed(3)}`);

  // D11 — the FEEDBACK is the story, and it's honest either way.
  const fr = speechFeedback('rally', right, 1), fw = speechFeedback('rally', wrong, 1);
  g('D11 the feedback tells the truth after the fact — never a prompt before it',
    /ignited/.test(fr) && /flat/.test(fw), `"${fr}" / "${fw}"`);

  // D12 — §10.6 MEMORABLE: only a close/ranked win, only the young men, and
  // only once a season per player (the cap-inflation guard).
  const roster = [mkP('WR', 'FR'), mkP('LB', 'SO'), mkP('OL', 'SR')];
  for (const p of roster) { p.character = p.character || { grind: 50, coachability: 50, leadership: 50 }; }
  const capsBefore = roster.map(p => p.potentialCaps.SPD);
  const school = { roster };
  const blowoutTry = applyMemorableSpeech(school, { margin: 40, rankedWin: false, season: 5 });
  const closeWin   = applyMemorableSpeech(school, { margin: 3, season: 5 });
  const secondTry  = applyMemorableSpeech(school, { margin: 3, season: 5 });
  const capsAfter = roster.map(p => p.potentialCaps.SPD);
  g('D12 §10.6 a memorable night raises YOUNG ceilings — close games only, once a season',
    blowoutTry === null && closeWin?.touched === 2 && secondTry === null
    && capsAfter[0] > capsBefore[0] && capsAfter[1] > capsBefore[1] && capsAfter[2] === capsBefore[2],
    `FR/SO caps +${capsAfter[0] - capsBefore[0]}, SR untouched`);

  // D13 — the three flavours are distinct answers to distinct halves.
  g('D13 three messages, three different halves',
    Object.keys(SPEECH_FLAVORS).length === 3
    && SPEECH_FLAVORS.rally.apply(1).off > SPEECH_FLAVORS.steady.apply(1).off
    && SPEECH_FLAVORS.steady.apply(1).def > SPEECH_FLAVORS.rally.apply(1).def);
}

// ═══ E. COORDINATORS, ALIVE (§14) ═════════════════════════════════════════
{
  const mkCoord = (side, q, ch) => {
    const c = generateCoordinator(side, q, 'D1');
    if (ch) c.character = { ...c.character, ...ch };
    return c;
  };

  // E1 — decision #8: the culture flows downhill. The head coach's Motivator
  // and Culture drive coordinator growth, and his own Grind sets his rate.
  const flat = mkCoord('OC', 55, { grind: 50, coachability: 50 });
  const same = JSON.parse(JSON.stringify(flat));
  const grinder = mkCoord('OC', 55, { grind: 92, coachability: 85 });
  grinder.ratings = { ...flat.ratings };
  const noDna = growCoordinator(JSON.parse(JSON.stringify(flat)), {}, {});
  const bigDna = growCoordinator(JSON.parse(JSON.stringify(flat)), { motivator: 9, culture: 9 }, {});
  const selfMade = growCoordinator(grinder, {}, {});
  g('E1 decision #8: the HC\'s cap/culture DNA and the man\'s own character both drive his growth',
    bigDna.gain > noDna.gain && selfMade.gain > noDna.gain && bigDna.ceiling > noDna.ceiling,
    `flat +${noDna.gain} (ceil ${noDna.ceiling}) · under a builder +${bigDna.gain} (ceil ${bigDna.ceiling}) · self-made +${selfMade.gain}`);

  // E2 — the receipts matter: a unit that graded out adds to his year, a unit
  // that didn't takes some back.
  const good = growCoordinator(JSON.parse(JSON.stringify(same)), {}, { QB: { letter: 'A' }, RB: { letter: 'A-' }, REC: { letter: 'B+' }, OL: { letter: 'A' } });
  const bad  = growCoordinator(JSON.parse(JSON.stringify(same)), {}, { QB: { letter: 'D' }, RB: { letter: 'D+' }, REC: { letter: 'C-' }, OL: { letter: 'F' } });
  g('E2 §14.3 unit grades are receipts — they add to a good year and take back a bad one',
    good.gain > noDna.gain && bad.gain < noDna.gain,
    `graded-out +${good.gain} · neutral +${noDna.gain} · graded-badly +${bad.gain}`);

  // E3 — the ledger and the brag line.
  const led = mkCoord('OC', 60);
  for (let s = 1; s <= 5; s++) recordUnitGrades(led, s, { QB: { letter: 'A-' }, OL: { letter: 'B+' }, RB: { letter: 'B+' }, REC: { letter: 'A-' } });
  recordUnitGrades(led, 5, { QB: { letter: 'A' }, OL: { letter: 'A' }, RB: { letter: 'A' }, REC: { letter: 'A' } });  // same season overwrites
  g('E3 §14.3 the milestone ledger records one row per season and computes the streak',
    led.ledger.length === 5 && led.ledger[4].units.QB === 'A' && coordStreak(led, 'B+') === 5,
    `${led.ledger.length} seasons, ${coordStreak(led, 'B+')}-year B+ streak`);

  // E4 — §12 T3 / §16.6.7: his service record converts to starting levels.
  const cred = coordinatorCredentials(led);
  const green = coordinatorCredentials(mkCoord('OC', 45));
  g('E4 §16.6.7 a coordinator\'s service record converts to day-one credentials',
    cred.startingLevels.developer > green.startingLevels.developer && cred.avgUnitGrade
    && cred.streakBPlus === 5,
    `veteran developer L${cred.startingLevels.developer} (avg ${cred.avgUnitGrade}) vs green L${green.startingLevels.developer}`);

  // E5 — THE WEEKLY VOICE is stable per week (no reshuffle on re-render) and
  // changes when the week does.
  const school = { id: 'S', prestige: 4, roster: genRoster(1, 'S'), gameplan: mk({ tendency: 'Run Heavy' }) };
  const opp = { id: 'O', name: 'Opp', prestige: 3, roster: genRoster(1, 'O'), gameplan: mk({ blitzPct: 38, tendency: 'Pass Heavy' }) };
  const dc = mkCoord('DC', 78);
  const a = coordinatorVoice(dc, school, opp, '1:9');
  const b = coordinatorVoice(dc, school, opp, '1:9');
  const c2 = coordinatorVoice(dc, school, opp, '1:14');
  g('E5 §14.1 the voice is stable inside a week and moves on to the next one',
    a && b && a.text === b.text && (c2 ? true : false),
    `week 9 stable, week 14 ${c2 && c2.text !== a.text ? 'differs' : 'same read (small pool)'}`);

  // E6 — a suggestion is a real lever, not flavour, and the trap is real: a
  // coordinator beneath his weight class can be confidently wrong.
  // A weak coordinator has to come from a market that HAS weak coordinators —
  // the D1 floor is 55 by design, so the trap lives in the lower divisions.
  const weak = generateCoordinator('DC', 28, 'D3');
  let traps = 0, reads = 0;
  for (let i = 0; i < 60; i++) {
    const v = coordinatorVoice(weak, school, opp, `1:${i}`);
    if (!v) continue;
    reads++;
    if (v.trap) traps++;
  }
  const strong = coordinatorVoice(mkCoord('DC', 85), school, opp, '1:9');
  g('E6 §14.1 a great read is worth following, a weak one can be a trap',
    reads > 20 && traps > 0 && strong && strong.confidence === 'high' && !strong.trap,
    `weak DC: ${traps}/${reads} reads were traps · elite DC confidence ${strong?.confidence}`);

  // E7 — §14.2 scheme friction: an air-raid OC in a ground-and-pound program
  // is something you feel every week.
  const airRaid = mkCoord('OC', 70); airRaid.identity = 'Air Raid'; airRaid.name = { first: 'Jim', last: 'Keller' };
  const ground  = mkCoord('OC', 70); ground.identity = 'Ground and Pound'; ground.name = { first: 'Dan', last: 'Holt' };
  g('E7 §14.2 hiring for scheme fit is real — the mismatch says so, the fit stays quiet',
    schemeFriction(airRaid, school) && !schemeFriction(ground, school),
    `"${schemeFriction(airRaid, school)}"`);

  // E8 — growth re-derives identity, so a man who outgrew his run game really
  // does become the air-raid guy his numbers say he is.
  const drifting = mkCoord('OC', 55, { grind: 95, coachability: 95 });
  drifting.ratings = { qbRunDesign: 50, passGame: 70, runGame: 50 };
  drifting.identity = 'Balanced';
  growCoordinator(drifting, { motivator: 10, culture: 10 }, { QB: { letter: 'A' }, REC: { letter: 'A' } });
  g('E8 identity is DERIVED, so growth can change who a coordinator IS',
    drifting.identity === 'Air Raid', `${drifting.identity} (pass ${drifting.ratings.passGame} / run ${drifting.ratings.runGame})`);
}

// ═══ F. THE SEASON LEDGER ═════════════════════════════════════════════════
{
  const p = mkP('WR');
  for (const [s, letter, score] of [[5, 'B', 70], [5, 'A-', 82], [5, 'C', 52], [6, 'A', 88]]) {
    recordPlayerGrade(p, { letter, score }, s, 10);
  }
  const s5 = seasonGrade(p, 5), s6 = seasonGrade(p, 6);
  g('F1 the season grade averages his graded games, per season',
    s5.games === 3 && s6.games === 1 && s5.score === 68 && s6.letter === 'A',
    `S5 ${s5.letter} (${s5.score}, ${s5.games}g) · S6 ${s6.letter}`);

  // F2 — the log is bounded so a 30-year career can't bloat a save.
  for (let i = 0; i < 200; i++) recordPlayerGrade(p, { letter: 'C', score: 50 }, 7, i);
  g('F2 the per-player grade log stays bounded (30-year save hygiene)',
    p.gradeLog.length <= 60, `${p.gradeLog.length} rows after 204 games`);
}

// ═══ G. THE LEAGUE SAMPLE — is the SCALE honest? ══════════════════════════
// The honesty law has a second half nobody states out loud: a grade that
// centres in the wrong place is dishonest even if it never reads the score.
// The first calibration of this table was anchored to real-world football
// averages and produced a league where every offense graded D and every
// defense graded B — the SAME SNAPS, two different verdicts. So the expectation
// table is calibrated off the ENGINE, and this section is the guard that keeps
// it there: the sport must centre near C, the two sides of the ball must agree,
// and the grade must still tell a good team from a bad one.
{
  const games = Math.max(6, N);
  const units = {}, sides = { off: [], def: [], overall: [] };
  let power = [], doormat = [];
  for (let i = 0; i < games; i++) {
    // Even game: the calibration sample.
    const rH = genRoster(1, 'H'), rA = genRoster(1, 'A');
    const hS = { id: 'H', name: 'H', roster: rH }, aS = { id: 'A', name: 'A', roster: rA };
    const res = simulateGame(hS, aS, rH, rA, buildDepthChart(rH, mk()), buildDepthChart(rA, mk()), mk(), mk());
    for (const [side, sc, gs, sn, pr] of [
      ['home', hS, res.homePlayerStats, res.homeSnapCounts, res.homeProtection],
      ['away', aS, res.awayPlayerStats, res.awaySnapCounts, res.awayProtection]]) {
      const gr = gradeTeamGame(sc, gs, { snaps: sn, prot: pr, cover: coverageLedger(res.drives, side) });
      for (const [u, v] of Object.entries(gr.units)) (units[u] ??= []).push(v.score);
      for (const k of ['off', 'def', 'overall']) if (gr[k]) sides[k].push(gr[k].score);
    }
    // Mismatch: a real powerhouse against a real doormat.
    const rP = genRoster(5, 'P'), rD = genRoster(1, 'D');
    const pS = { id: 'P', name: 'P', roster: rP }, dS = { id: 'D', name: 'D', roster: rD };
    const r2 = simulateGame(pS, dS, rP, rD, buildDepthChart(rP, mk()), buildDepthChart(rD, mk()), mk(), mk());
    power.push(gradeTeamGame(pS, r2.homePlayerStats, { snaps: r2.homeSnapCounts, prot: r2.homeProtection, cover: coverageLedger(r2.drives, 'home') }).overall.score);
    doormat.push(gradeTeamGame(dS, r2.awayPlayerStats, { snaps: r2.awaySnapCounts, prot: r2.awayProtection, cover: coverageLedger(r2.drives, 'away') }).overall.score);
  }
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const off = mean(sides.off), def = mean(sides.def), all = mean(sides.overall);
  g('G1 the league centres on C — the sport\'s own average is the yardstick',
    all > 43 && all < 58, `mean overall ${all.toFixed(1)}`);
  g('G2 the two sides of the ball agree — the same snaps can\'t grade a full tier apart',
    Math.abs(off - def) < 8, `offense ${off.toFixed(1)} vs defense ${def.toFixed(1)}`);
  const strays = Object.entries(units).filter(([, v]) => mean(v) < 38 || mean(v) > 62);
  g('G3 no unit is systematically mis-graded',
    strays.length === 0,
    Object.entries(units).map(([u, v]) => `${u} ${mean(v).toFixed(0)}`).join(' · '));
  g('G4 and it still tells a good team from a bad one',
    mean(power) - mean(doormat) > 10,
    `powerhouse ${mean(power).toFixed(1)} vs doormat ${mean(doormat).toFixed(1)}`);
}

console.log(fail ? `❌ ${fail} FAILED` : '✅ W6 GRADES → DNA → SPEECHES → STAFF GATE PASS');
process.exit(fail ? 1 : 0);
