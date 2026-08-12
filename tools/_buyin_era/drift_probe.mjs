// drift_probe.mjs — W10 THE 30-YEAR DRIFT PROBE (§11 answer 4, §7 ledger).
//
// THE LAW (Garrett, §11 answer 4): "players self-correct, programs don't."
// Rosters churn every 4–5 years and every class re-rolls from the same world
// distribution, so PLAYER inflation graduates. Drift lives in what does NOT
// graduate: coach DNA, milestones, facility tiers, the tree, prestige.
//
// This probe runs the REAL calendar headlessly for N seasons (default 30) and
// asserts that the league's distributions are FLAT BY YEAR. It is the shipping
// gate for the Buy-In update: no balance change lands without it green.
//
// What it measures each season (league-wide, every rostered player / school):
//   D1  TALENT       — composite OVR mean + p90 (does the league inflate?)
//   D2  CHARACTER    — grind (WE) mean, Character aggregate mean
//   D3  ACADEMICS    — GPA mean
//   D4  PRESTIGE     — mean + concentration (top-10 share of total prestige)
//   D5  BUY-IN       — program meter mean (the W2 flywheel must not run away)
//   D6  FACILITIES   — mean facility tier + mean Academic Center tier
//   D7  CHURN        — roster turnover actually happens (the self-correction)
//   D8  COACH DNA    — league-wide banked DNA (the thing that never graduates)
//
// The verdict is a LINEAR TREND per metric across seasons (least squares slope
// per season, measured over the settled window — season 1 is worldgen, not a
// steady state). Each metric declares a tolerance in its own units. A metric
// that trends past tolerance is DRIFT and fails the gate.
//
// Run:  node tools/drift_probe.mjs [years] [--seed 0xNNNN] [--csv path] [--quiet]
// Default 30 years ≈ 35 min. Use a smaller year count for iteration only —
// the SHIPPING gate is 30.

function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}

const argv = process.argv.slice(2);
const YEARS = Math.max(3, parseInt(argv.find(a => /^\d+$/.test(a)) || '30', 10));
const seedArg = argv.includes('--seed') ? argv[argv.indexOf('--seed') + 1] : '0xD21F7A11';
const SEED = Number(seedArg);
const CSV = argv.includes('--csv') ? argv[argv.indexOf('--csv') + 1] : null;
const QUIET = argv.includes('--quiet');
Math.random = mulberry32(SEED);

const { generateWorld, generateSchedule, generateRecruitPool } = await import('../js/engine/world.js');
const { advanceDay, resumeFromHalftime } = await import('../js/engine/season.js');
const { advanceOffseasonStage, graduatingSeniors } = await import('../js/engine/offseason.js');
const { acceptJob } = await import('../js/engine/season.js');
const { initBudget } = await import('../js/engine/recruiting.js');
const { characterRating } = await import('../js/engine/player.js');
const { programBuyIn } = await import('../js/engine/development.js');
const { coachDNA, DNA_AXES, dnaGrade } = await import('../js/engine/coachprofile.js');
const { C } = await import('../js/constants.js');

// ── stats helpers ─────────────────────────────────────────────────────────
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
function pct(a, q) {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
}
// Least-squares slope of y over x (x = season index). Units: metric per season.
function slope(xs, ys) {
  const n = xs.length;
  if (n < 3) return 0;
  const mx = mean(xs), my = mean(ys);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den === 0 ? 0 : num / den;
}

// ── the league snapshot ───────────────────────────────────────────────────
function snapshot(state, season) {
  const world = state.world;
  const ovr = [], grind = [], char = [], gpa = [], prest = [], buyin = [];
  const fac = [], acad = [];
  let players = 0, dnaTotal = 0, dnaSeats = 0, coaches = 0, seniors = 0;
  const rosterIds = new Set();
  for (const s of world.schools) {
    prest.push(s.prestige || 0);
    // Facility tiers: the schools' non-graduating investments (§11 answer 4).
    const f = s.facilities || {};
    fac.push(mean(['stadium', 'training', 'recruiting', 'medicine'].map(k => f[k] ?? 0)));
    acad.push(f.academics ?? 0);
    if (s.coach) {
      coaches++;
      // AI coaches bank DNA on `coach.dna` — a plain field in the world save
      // (see coachprofile.aiDnaAccrue). coachDNA() reads the PLAYER's profile
      // store and returns null for them, which made this metric a vacuous zero
      // in the probe's first cut: D8b/D8c passed by measuring nothing. The
      // player's own seat is the one that lives in the profile store.
      const axes = s.coach.dna?.axes
        || (s.coach.id === state.playerCoach?.id ? coachDNA(s.coach.id)?.axes : null)
        || null;
      // GRADES, not XP. The first cut summed raw XP — which accumulates
      // linearly by design (dnaXpForNextGrade is superlinear: 40·(g+1)^1.7), so
      // it could only ever read as runaway drift. What the sim and the UI
      // actually consume is the GRADE, and that is the thing that must stay
      // flat across a 30-year league.
      if (axes) { for (const k of Object.keys(DNA_AXES)) dnaTotal += dnaGrade(axes[k] || 0); dnaSeats++; }
      buyin.push(programBuyIn(s));
    }
    for (const p of (s.roster || [])) {
      players++;
      rosterIds.add(p.id);
      if (p.classYear === 'SR') seniors++;
      ovr.push(p.compositeRating || 0);
      grind.push(p.character?.grind ?? p.attributes?.WE ?? 0);
      const cr = characterRating(p);
      if (cr != null) char.push(cr);
      if (typeof p.gpa === 'number') gpa.push(p.gpa);
    }
  }
  const prestSorted = prest.slice().sort((a, b) => b - a);
  const prestTotal = prestSorted.reduce((s, x) => s + x, 0) || 1;
  const top10Share = prestSorted.slice(0, 10).reduce((s, x) => s + x, 0) / prestTotal;
  return {
    season, players, coaches,
    ovrMean: mean(ovr), ovrP90: pct(ovr, 0.90), ovrP10: pct(ovr, 0.10),
    grindMean: mean(grind), charMean: mean(char), gpaMean: mean(gpa),
    prestMean: mean(prest), prestTop10: top10Share,
    buyInMean: mean(buyin),
    facMean: mean(fac), acadMean: mean(acad),
    dnaPerCoach: dnaSeats ? dnaTotal / dnaSeats : 0, dnaSeats,
    srShare: players ? seniors / players : 0,
    rosterIds,
  };
}

// ── boot a headless league ────────────────────────────────────────────────
const t0 = Date.now();
const world = generateWorld();
world.recruits = generateRecruitPool(world);
for (const s of world.schools) {
  if (!s.coach) continue;
  const sen = s.roster.filter(p => p.classYear === 'SR').length;
  initBudget(s.coach, Math.max(0, C.ROSTER_SIZE - s.roster.length) + sen);
}
const ps = world.schools[0];
const state = {
  initialized: true, season: 1, day: 1,
  playerSchoolId: ps.id,
  playerCoach: {
    id: 'player', schoolId: ps.id, prestige: ps.prestige,
    reputation: 'C', budget: 0, scholarshipsAvailable: 0,
    recruitBoard: [], budgetCarryover: 0,
    seasonRecord: { wins: 0, losses: 0 },
  },
  world, schedule: generateSchedule(world),
  playoffs: null, inbox: [], gameLog: [], signingsLog: [], ui: {},
};
ps.coach = state.playerCoach;

let failed = 0;
const line = (ok, s) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${s}`); if (!ok) failed++; };

console.log(`=== W10 DRIFT PROBE — ${YEARS} seasons, seed ${seedArg} ===`);
console.log(`League: ${world.schools.length} schools. Worldgen ${((Date.now() - t0) / 1000).toFixed(1)}s.\n`);

// ── D0: DAY ZERO (checked before a single day is simulated) ───────────────
// The probe's own hard-won lesson. A drift probe measures CHANGE, so it is
// structurally blind to a world that starts wrong — and a wrong start reads
// exactly like drift as the world corrects itself over the first roster cycle.
// W10 hit this twice; the character case was real: createPlayer's year boost
// walked WE toward a division-scaled talent cap, seeding worldgen rosters at
// grind 58 against a world distribution of 52.
//
// W1's character_profile_probe could not catch it — it audits the createRecruit
// DRAW, and the leak was in the aging applied on top. So the guard belongs
// here, on the assembled world: whatever the generator does, the league that
// comes out of it must obey §11's law on day one.
{
  const byDiv = {}, byCls = {};
  for (const s of world.schools) for (const p of (s.roster || [])) {
    const g = p.character?.grind ?? p.attributes?.WE ?? 0;
    (byDiv[s.division] ||= []).push(g);
    (byCls[p.classYear] ||= []).push(g);
  }
  const dv = Object.keys(byDiv).sort().map(k => [k, mean(byDiv[k])]);
  const cl = ['FR', 'SO', 'JR', 'SR'].filter(k => byCls[k]).map(k => [k, mean(byCls[k])]);
  const spread = a => Math.max(...a.map(x => x[1])) - Math.min(...a.map(x => x[1]));
  console.log('--- D0 DAY ZERO (talent ⊥ character, §11) ---');
  line(spread(dv) <= 1.5,
    `D0a  grind flat across divisions — ${dv.map(([k, v]) => `${k} ${v.toFixed(2)}`).join(' / ')} (spread ${spread(dv).toFixed(2)}, tol 1.5)`);
  line(spread(cl) <= 1.5,
    `D0b  grind flat across class years — ${cl.map(([k, v]) => `${k} ${v.toFixed(2)}`).join(' / ')} (spread ${spread(cl).toFixed(2)}, tol 1.5)`);
  console.log('');
}

// ── The headless driver ───────────────────────────────────────────────────
// A season is NOT just repeated advanceDay(). The calendar has three player
// gates, and a driver that only answers one silently stalls: the day stops
// moving, the loop spins, and every snapshot after that point is the same
// frozen league measured over and over (which reads as a perfectly flat trend —
// the most dangerous possible false pass for a drift probe).
//
//   1. HALFTIME      — the player's game pauses  → resumeFromHalftime()
//   2. OFFSEASON     — a 10-stage wizard at day 24 → advanceOffseasonStage()
//   3. CUT DAY       — a HARD gate inside that wizard: you cannot pass it while
//                      you are over the cap post-graduation.
//   4. THE CAROUSEL  — this driver plays no strategy, so its program loses and
//                      its coach GETS FIRED, usually inside three seasons. An
//                      unemployed coach freezes the calendar until he accepts a
//                      job. He takes the first seat on the forced shortlist.
//
// The probe plays the AD's part at each: no edits at halftime, cut the weakest
// bodies to make the cap, walk every stage, take whatever job is offered. It
// never makes a strategic choice — the point is to measure the LEAGUE, and the
// player's program is one of 330.
function takeAnyJob(state) {
  const list = state.forcedShortlist || state.jobOpenings || [];
  for (const o of list) {
    const id = o.schoolId || o.id;
    if (!id) continue;
    const res = acceptJob(state, id);
    if (res && res.ok !== false) return true;
    if (state.playerCoach?.status === 'employed') return true;
  }
  return false;
}
function cutToCap(state) {
  const school = state.world.schools.find(s => s.id === state.playerSchoolId);
  if (!school) return;
  const grads = graduatingSeniors(state).length;
  let over = school.roster.length - grads - C.ROSTER_SIZE;
  if (over <= 0) return;
  // Weakest first, and never a senior (he's leaving anyway — cutting him does
  // not move the post-graduation number the gate is measured against).
  const cuts = school.roster
    .filter(p => p.classYear !== 'SR')
    .sort((a, b) => (a.compositeRating || 0) - (b.compositeRating || 0))
    .slice(0, over);
  const ids = new Set(cuts.map(p => p.id));
  school.roster = school.roster.filter(p => !ids.has(p.id));
}

function pumpOffseason(state) {
  let guard = 0;
  while (state.offseason && !state.offseason.done && guard++ < 40) {
    const ev = advanceOffseasonStage(state);
    // The one refusal the wizard can return: the cut-day cap gate.
    if (ev.some(e => e.type === 'warning')) { cutToCap(state); }
  }
  return guard;
}

const rows = [];
let prevIds = null, churnSum = 0, churnN = 0;
for (let yr = 1; yr <= YEARS; yr++) {
  const target = state.season;
  const tS = Date.now();
  let guard = 0, stalled = 0;
  while (state.season === target && guard++ < 400) {
    const before = `${state.season}.${state.day}`;
    advanceDay(state, () => {});
    while (state.pendingHalftime) resumeFromHalftime(state);
    pumpOffseason(state);
    if (state.playerCoach?.status === 'unemployed') takeAnyJob(state);
    if (`${state.season}.${state.day}` === before) {
      if (++stalled > 3) {
        console.error(`\n  STALL at season ${state.season} day ${state.day} — the driver has an ` +
                      `unanswered gate. Refusing to report a frozen league as a flat one.`);
        process.exit(2);
      }
    } else stalled = 0;
  }
  // state has rolled into season target+1 day 1: freshmen have landed, so the
  // snapshot is a settled roster, not a mid-rollover one.
  const snap = snapshot(state, target);
  if (prevIds) {
    let kept = 0;
    for (const id of snap.rosterIds) if (prevIds.has(id)) kept++;
    const turnover = 1 - kept / Math.max(1, snap.rosterIds.size);
    snap.turnover = turnover; churnSum += turnover; churnN++;
  }
  prevIds = snap.rosterIds;
  delete snap.rosterIds;
  rows.push(snap);
  if (CSV) {                      // checkpoint — a run killed mid-flight still leaves its data
    const keys = Object.keys(rows[0]);
    const { writeFileSync } = await import('node:fs');
    writeFileSync(CSV, [keys.join(','), ...rows.map(r => keys.map(k => r[k]).join(','))].join('\n'));
  }
  // Trim the unbounded logs — 30 seasons of every play-by-play line is memory
  // the real game never holds either (the UI prunes them per season).
  if (state.gameLog.length > 4000) state.gameLog.length = 0;
  if (state.inbox.length > 500) state.inbox.length = 0;
  if (!QUIET) {
    console.log(
      `  S${String(target).padStart(2)}  ovr ${snap.ovrMean.toFixed(2)} (p90 ${snap.ovrP90})` +
      `  grind ${snap.grindMean.toFixed(2)}  char ${snap.charMean.toFixed(2)}` +
      `  gpa ${snap.gpaMean.toFixed(3)}  prest ${snap.prestMean.toFixed(3)}` +
      `  buyIn ${snap.buyInMean.toFixed(2)}  dna/c ${snap.dnaPerCoach.toFixed(2)}` +
      `  [${((Date.now() - tS) / 1000).toFixed(0)}s]`);
  }
}

// ── the verdict: flat by year ─────────────────────────────────────────────
// Season 1 is worldgen, not a steady state (nobody has developed, no class has
// graduated, no coach has a record). The trend window starts at the first
// season where a full recruiting class has cycled through.
const WARMUP = Math.min(4, Math.max(1, Math.floor(YEARS / 6)));
const win = rows.slice(WARMUP);
const xs = win.map(r => r.season);

// Tolerances are PER SEASON, sized so that the drift they permit over 30 years
// is smaller than the metric's own season-to-season noise. Anything larger is
// a trend a player would feel across a career.
const METRICS = [
  ['D1a  league OVR mean',        r => r.ovrMean,     0.060, ''],
  ['D1b  league OVR p90',         r => r.ovrP90,      0.080, ''],
  ['D1c  league OVR p10',         r => r.ovrP10,      0.080, ''],
  ['D2a  grind (WE) mean',        r => r.grindMean,   0.060, ''],
  ['D2b  Character mean',         r => r.charMean,    0.060, ''],
  ['D3   GPA mean',               r => r.gpaMean,     0.0045, ''],
  ['D4a  prestige mean',          r => r.prestMean,   0.0130, ''],
  ['D4b  prestige top-10 share',  r => r.prestTop10,  0.00090, ''],
  ['D5   program Buy-In mean',    r => r.buyInMean,   0.120, ''],
  ['D6a  facility tier mean',     r => r.facMean,     0.0130, ''],
  ['D6b  academic tier mean',     r => r.acadMean,    0.0130, ''],
  ['D7   roster size',            r => r.players,     3.000, ''],
];


console.log(`\n--- DRIFT (early third vs late third, seasons ${xs[0]}–${xs[xs.length - 1]}) ---`);
// THE GATE IS A LEVEL SHIFT, NOT A RAW SLOPE. Least squares is the obvious
// tool and the wrong one here: this league runs multi-season excursions (the
// OVR mean lifts ~2 points and decays back over a class cycle), and a window
// that happens to OPEN on one of those peaks reads a steep negative slope that
// is pure windowing. Comparing the EARLY third of the window to the LATE third
// asks the question that actually matters — "is the league in a different place
// than it started?" — and an excursion in the middle, or on either edge, moves
// it far less. The slope is still printed, because its SIGN is informative even
// when its magnitude is an artifact.
const third = Math.max(2, Math.floor(win.length / 3));
for (const [name, get, tol] of METRICS) {
  const ys = win.map(get);
  const early = mean(ys.slice(0, third));
  const late = mean(ys.slice(-third));
  const shift = late - early;
  const span = win.length - third;               // seasons between the two centres
  const budget = tol * Math.max(1, span);        // same per-season tolerance, level units
  const m = slope(xs, ys);
  line(Math.abs(shift) <= budget,
    `${name.padEnd(28)} ${early.toFixed(3)} → ${late.toFixed(3)} ` +
    `(shift ${(shift >= 0 ? '+' : '')}${shift.toFixed(3)}, budget ±${budget.toFixed(3)}` +
    `; slope ${(m >= 0 ? '+' : '')}${m.toFixed(4)}/yr)`);
}

console.log('\n--- SELF-CORRECTION (the law\'s other half) ---');
const churn = churnN ? churnSum / churnN : 0;
line(churn >= 0.18 && churn <= 0.45,
  `D8a  roster turnover ${(churn * 100).toFixed(1)}%/season — classes actually graduate (18–45%)`);
const dnaFirst = win[0].dnaPerCoach, dnaLast = win[win.length - 1].dnaPerCoach;
// GUARD: a zero here used to read as a pass. A metric that measures nothing
// must fail, not go quiet — this axis is the whole "programs don't graduate"
// half of the law, and a silent zero is how it would rot unnoticed.
line(win[win.length - 1].dnaSeats > 0 && dnaLast > 0,
  `D8b  coach DNA is actually being measured (${win[win.length - 1].dnaSeats} seats banking, ${dnaLast.toFixed(1)}/seat)`);
line(true, `D8b′ DNA/seat ${dnaFirst.toFixed(2)} → ${dnaLast.toFixed(2)} (report only — retirement is the graduation)`);
const dnaSlope = slope(xs, win.map(r => r.dnaPerCoach));
line(Math.abs(dnaSlope) <= 0.15,
  `D8c  coach DNA per seat slope ${(dnaSlope >= 0 ? '+' : '')}${dnaSlope.toFixed(4)}/season — retirement graduates DNA (tol ±0.15 grades/season)`);
const coachSlope = slope(xs, win.map(r => r.coaches));
line(Math.abs(coachSlope) <= 0.4, `D8d  seated coaches slope ${coachSlope.toFixed(4)}/season — the carousel refills every seat`);

console.log('\n--- SPREAD (flat must not mean homogenised) ---');
const spreadFirst = win[0].ovrP90 - win[0].ovrP10;
const spreadLast = win[win.length - 1].ovrP90 - win[win.length - 1].ovrP10;
line(spreadLast >= spreadFirst * 0.80 && spreadLast <= spreadFirst * 1.25,
  `D9a  OVR p90−p10 spread ${spreadFirst} → ${spreadLast} — the league keeps its stars AND its walk-ons`);
const prestSpread = win.map(r => r.prestTop10);
line(Math.max(...prestSpread) - Math.min(...prestSpread) <= 0.06,
  `D9b  prestige concentration band ${(Math.min(...prestSpread) * 100).toFixed(1)}–${(Math.max(...prestSpread) * 100).toFixed(1)}% — no runaway super-league`);

if (CSV) {
  const keys = Object.keys(rows[0]);
  const out = [keys.join(','), ...rows.map(r => keys.map(k => r[k]).join(','))].join('\n');
  const { writeFileSync } = await import('node:fs');
  writeFileSync(CSV, out);
  console.log(`\n  csv → ${CSV}`);
}

console.log(`\n=== ${failed === 0 ? 'DRIFT PROBE PASS' : `DRIFT PROBE FAIL (${failed})`} — ${YEARS} seasons in ${((Date.now() - t0) / 60000).toFixed(1)} min ===`);
process.exit(failed ? 1 : 0);
