// recruit_calendar_probe.mjs — what happens if the recruiting calendar is compressed?
//
// The live calendar (js/engine/season.js PHASES + RECRUITING_OPEN):
//
//   PRESEASON   1-4    groundwork only — resolveFunnel gates ALL battle resolution,
//                      narrowing and drift behind `seasonStarted = day >= 5`
//   NONCONF     5-8    battles begin; day 8 is C.RECRUITING_EARLY_FLOOR, the first day a
//                      battle-driven commit is allowed
//   CONFERENCE  9-18   top5 narrowing d12, top3 d15
//   CONFCHAMP   19     C.RECRUITING_LOCK_DAY — hard lock, every open recruit signs
//
// The proposal: open recruiting the week before the season (day 4 instead of 1) and let
// signings start in week 2 of the season (floor day 6 instead of 8).
//
// What this measures, because the risk is not obvious from the constants:
//   * WHEN commits land — a compressed contact window may not build enough interest to
//     clear commitThreshold, pushing everyone onto the day-19 hard lock. That would turn a
//     battle-decided system back into a deadline lottery, which is what the July overhaul
//     removed.
//   * WHO wins — AI budget is a pot spread across the cycle (initBudget + weekly spend),
//     while the player is capped on ACTIONS PER ROUND. Cutting rounds takes the player's
//     agency away without touching the AI's money. That asymmetry is the real hazard.
//   * ROSTER FALLOUT — recruits who never resolve become walk-on backfill.
//
// Usage: node tools/recruit_calendar_probe.mjs [worlds]

import { generateWorld, generateSchedule, generateRecruitPool } from '../js/engine/world.js';
import { advanceDay, resumeFromHalftime, RECRUITING_OPEN }   from '../js/engine/season.js';
import { devCtx }                                            from '../js/engine/offseason.js';
import { initBudget }                                        from '../js/engine/recruiting.js';
import { C }                                                 from '../js/constants.js';

const WORLDS = Number(process.argv[2] || 1);
const LOCK   = C.RECRUITING_LOCK_DAY;          // 19 — unchanged by the proposal

// [label, openDay, earlyFloor]
const SCENARIOS = [
  ['current    (open d1, floor d8)', 1, 8],
  ['proposed   (open d4, floor d6)', 4, 6],
  ['half-step  (open d4, floor d8)', 4, 8],
  ['floor only (open d1, floor d6)', 1, 6],
];

// Drives the REAL season pipeline (advanceDay), not the recruiting internals — calling
// resolveFunnel directly misses the rival seeding and AI board construction that
// advanceDay performs, and silently produces zero commits.
function runCycle(openDay, floorDay) {
  const world = generateWorld();
  world.recruits = generateRecruitPool(world);
  for (const s of world.schools) {
    if (s.coach) {
      const sen = s.roster.filter(p => p.classYear === 'SR').length;
      initBudget(s.coach, Math.max(0, C.ROSTER_SIZE - s.roster.length) + sen);
    }
  }
  const ps = world.schools[0];
  const state = {
    initialized: true, season: 1, day: 1, playerSchoolId: ps.id,
    playerCoach: { id: 'player', schoolId: ps.id, prestige: ps.prestige, reputation: 'C',
      budget: 0, scholarshipsAvailable: 0, recruitBoard: [], budgetCarryover: 0,
      seasonRecord: { wins: 0, losses: 0 } },
    world, schedule: generateSchedule(world), playoffs: null,
    inbox: [], gameLog: [], signingsLog: [], ui: {}, settings: {},
  };
  ps.coach = state.playerCoach;

  const origOpen = RECRUITING_OPEN.start, origFloor = C.RECRUITING_EARLY_FLOOR;
  RECRUITING_OPEN.start = openDay;
  C.RECRUITING_EARLY_FLOOR = floorDay;
  try {
    // The preseason camp gate (offseason item 12) hard-blocks advanceDay at day 3
    // until the coach CONFIRMS his positions — a click the dashboard makes as
    // `devCtx(state).posReviewed = true`. A headless driver has no UI, so it must
    // perform that same confirmation or advanceDay never advances (was a silent
    // day-3 infinite loop → night-gate TIMEOUT). We mark it each preseason day so
    // the flag is set at the moment the gate checks it, whatever re-init ran.
    // STALL GUARD: if a day ever fails to advance across several calls, FAIL loud
    // and fast rather than spinning — a future gate regression should be legible,
    // not a 30-minute timeout with no diagnostic.
    let stalls = 0;
    while (state.season === 1 && state.day <= LOCK) {
      if (state.day <= 3) devCtx(state).posReviewed = true;
      const before = state.day;
      advanceDay(state, () => {});
      while (state.pendingHalftime) resumeFromHalftime(state);
      if (state.day === before && state.season === 1) {
        if (++stalls > 3) throw new Error(`advanceDay STALLED at day ${state.day} — a gate is blocking the headless pipeline (check advanceDay early-returns)`);
      } else stalls = 0;
    }
  } finally {
    RECRUITING_OPEN.start = origOpen;
    C.RECRUITING_EARLY_FLOOR = origFloor;
  }

  const byDay = {}, bySource = {};
  for (const e of state.signingsLog || []) {
    if (e.season !== 1) continue;
    byDay[e.day] = (byDay[e.day] || 0) + 1;
    bySource[e.source || '?'] = (bySource[e.source || '?'] || 0) + 1;
  }
  return { byDay, bySource, total: world.recruits.length };
}

console.log(`Recruiting calendar — ${WORLDS} full season(s) per scenario, real advanceDay pipeline`);
console.log(`hard lock stays at day ${LOCK} in every scenario\n`);

for (const [label, openDay, floorDay] of SCENARIOS) {
  const agg = {}, src = {}; let signed = 0;
  for (let w = 0; w < WORLDS; w++) {
    const r = runCycle(openDay, floorDay);
    for (const [d, n] of Object.entries(r.byDay)) { agg[d] = (agg[d] || 0) + n; signed += n; }
    for (const [k, n] of Object.entries(r.bySource)) src[k] = (src[k] || 0) + n;
  }
  const lockDay = agg[LOCK] || 0;
  const preLock = signed - lockDay;
  console.log(`── ${label}`);
  console.log(`   ${signed} signings   battle-decided ${preLock} (${((preLock / (signed||1)) * 100).toFixed(1)}%)` +
              `   deadline-dumped ${lockDay} (${((lockDay / (signed||1)) * 100).toFixed(1)}%)`);
  console.log(`   by source: ${Object.entries(src).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  const days = Object.keys(agg).map(Number).sort((a, b) => a - b);
  const peak = Math.max(1, ...days.map(d => agg[d]));
  for (const d of days) {
    if (!agg[d]) continue;
    console.log(`   d${String(d).padStart(2)} ${String(agg[d]).padStart(5)} ${'#'.repeat(Math.round((agg[d] / peak) * 40))}`);
  }
  console.log('');
}

console.log('Read this as: how much of the class the BATTLE decides versus how much the');
console.log('day-19 DEADLINE dumps. Mass shifting onto the lock day is the failure mode the');
console.log('July overhaul removed — it turns a contested race back into a lottery.');
