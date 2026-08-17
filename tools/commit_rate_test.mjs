// commit_rate_test.mjs
// Reports funnel commit rate vs graduating class size for one full season.
// Verifies the funnel carries its weight rather than backfill being the
// load-bearing path. Run after any change to recruiting constants or targets.
import { generateWorld, generateSchedule, generateRecruitPool } from '../js/engine/world.js';
import { advanceDay, resumeFromHalftime } from '../js/engine/season.js';
import { devCtx } from '../js/engine/offseason.js';
import { initBudget } from '../js/engine/recruiting.js';
import { C } from '../js/constants.js';

const world = generateWorld();
world.recruits = generateRecruitPool(world);

// Give all school coaches a full budget so funnel and backfill have funding.
for (const s of world.schools) {
  if (s.coach) {
    const sen = s.roster.filter(p => p.classYear === 'SR').length;
    initBudget(s.coach, Math.max(0, C.ROSTER_SIZE - s.roster.length) + sen);
  }
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
  world,
  schedule: generateSchedule(world),
  playoffs: null, inbox: [], gameLog: [], signingsLog: [],
  ui: {},
};
ps.coach = state.playerCoach;

// Record graduating class proxy before the season starts (SRs graduate at the
// season rollover — the calendar is a flat 1–30 counter).
const startSeniors = {};
for (const s of world.schools) {
  startSeniors[s.id] = s.roster.filter(p => p.classYear === 'SR').length;
}

// Run the full season (the 30-day calendar) then the rollover tick (→ S2 D1,
// where freshmen join and auto-redshirts are applied).
// [PLAYTEST 2026-08-12 item 12] advanceDay hard-gates day 3 until positions
// are confirmed before camp (offseason.js posReviewed) — only the dashboard
// UI sets it. Acknowledge it here or the loop spins at day 3 forever (the
// deterministic "TIMEOUT" every FULL gate logged since 08-12 —
// FULLGATE_TRIAGE_2026-08-17 item 2).
while (state.season === 1) {
  if (state.day === 3) devCtx(state).posReviewed = true;
  advanceDay(state, () => {});
  // Chunk 12: the player's game pauses at halftime — auto-resume, no edits.
  while (state.pendingHalftime) resumeFromHalftime(state);
}
// state is now season 2 day 1 — freshmen and auto-redshirts have landed.

// Tally signings for season 1 by school and source.
const funnelBy = {};
const backfillBy = {};
for (const entry of (state.signingsLog || [])) {
  if (entry.season !== 1) continue;
  const sid = entry.schoolId;
  funnelBy[sid]   = (funnelBy[sid]   || 0) + (entry.source === 'funnel'   ? 1 : 0);
  backfillBy[sid] = (backfillBy[sid] || 0) + (entry.source === 'backfill' ? 1 : 0);
}

// FRs on rosters now = recruits who actually made it through the cap + RS filter.
const frCountBy = {};
for (const s of world.schools) {
  frCountBy[s.id] = s.roster.filter(p => p.classYear === 'FR').length;
}

const pad  = (s, n) => String(s).padStart(n);
const padL = (s, n) => String(s).padEnd(n);

console.log('\n=== Funnel Commit Rate Report — Season 1 ===');
console.log(`${'School'.padEnd(22)} |  Grad |Funnel|Backfl| Total|  FRs`);
console.log('-'.repeat(60));

let sumGrad = 0, sumFunnel = 0, sumBackfill = 0, sumFR = 0, aiCount = 0;
for (const s of world.schools) {
  const isPlayer = s.id === ps.id;
  const grad     = startSeniors[s.id] || 0;
  const funnel   = funnelBy[s.id]     || 0;
  const backfill = backfillBy[s.id]   || 0;
  const total    = funnel + backfill;
  const frs      = frCountBy[s.id]    || 0;
  const label    = s.name + (isPlayer ? ' (player)' : '');
  console.log(`${padL(label, 22)} | ${pad(grad,5)} |${pad(funnel,6)}|${pad(backfill,6)}|${pad(total,6)}|${pad(frs,5)}`);
  if (!isPlayer) {
    sumGrad     += grad;
    sumFunnel   += funnel;
    sumBackfill += backfill;
    sumFR       += frs;
    aiCount++;
  }
}
console.log('-'.repeat(60));
const ai = aiCount || 1;
console.log(`${'AI AVG (n='+aiCount+')'.padEnd(22)} | ${pad((sumGrad/ai).toFixed(1),5)} |${pad((sumFunnel/ai).toFixed(1),6)}|${pad((sumBackfill/ai).toFixed(1),6)}|${pad(((sumFunnel+sumBackfill)/ai).toFixed(1),6)}|${pad((sumFR/ai).toFixed(1),5)}`);

const s1Log = (state.signingsLog || []).filter(e => e.season === 1);
const totalSignings = s1Log.length;
const totalFRs = world.schools.reduce((t, s) => t + s.roster.filter(p => p.classYear === 'FR').length, 0);
const walkOns = totalFRs - totalSignings; // always ≥ 0: walk-ons fill the gap signees left

// Reconciliation check: after pruneCapBlockedSignings, every log entry must have a
// matching player on some roster. Any orphan indicates the pruning didn't fire.
const arrivedIds = new Set(world.schools.flatMap(s => s.roster.map(p => p.id)));
const orphaned = s1Log.filter(e => !arrivedIds.has(e.recruitId));

console.log(`\nTotal S1 signings in log:           ${totalSignings}`);
console.log(`Total FRs on rosters at S2 start:   ${totalFRs} (signees + walk-ons)`);
console.log(`Walk-ons added to fill roster:      ${walkOns}`);
console.log(`Reconciliation (orphaned entries):   ${orphaned.length === 0 ? 'PASS — 0 phantom signings' : 'FAIL — ' + orphaned.length + ' orphaned'}`);

const funnelPct   = (sumFunnel + sumBackfill) > 0 ? Math.round(sumFunnel   / (sumFunnel + sumBackfill) * 100) : 0;
const backfillPct = 100 - funnelPct;
console.log('\n=== Funnel Share (AI schools only) ===');
console.log(`Funnel commits:   ${sumFunnel} (${funnelPct}%)`);
console.log(`Backfill commits: ${sumBackfill} (${backfillPct}%)`);
const coveragePct = sumGrad > 0 ? (sumFunnel / sumGrad * 100).toFixed(0) : 'n/a';
console.log(`Funnel coverage of graduating class: ${coveragePct}%`);
console.log(`  (${(sumFunnel/ai).toFixed(1)} funnel avg vs ${(sumGrad/ai).toFixed(1)} grad avg per school)`);
console.log('Goal: funnel ≥ ~50% of grad class; backfill covers remainder.');
console.log('If funnel < 30%, rival density or drift values need Phase-5 tuning.');

// Auto-redshirt summary (redshirtYear === 2 because auto-RS ran in startNewSeason with season=2).
const totalRS = world.schools.reduce((t, s) => t + s.roster.filter(p => p.redshirted && p.redshirtYear === 2).length, 0);
console.log(`\n=== Auto-Redshirts (S2 class) ===`);
console.log(`Total RS applied: ${totalRS} (${(totalRS/world.schools.length).toFixed(1)} avg per school, no cap)`);
console.log(`RS badge shows for each of these ${totalRS} players in roster view.`);
