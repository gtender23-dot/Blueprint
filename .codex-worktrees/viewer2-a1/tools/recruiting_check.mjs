// recruiting_check.mjs — regression probe for the AI recruiting rebuild.
// Run: node tools/recruiting_check.mjs
// Proves: (1) commitments roll through the season instead of stacking at the
// end, (2) AI classes target actual roster needs, (3) class-size limits hold
// and full schools stop winning, (4) every recruit faces real competition.

import { generateWorld, generateSchedule, generateRecruitPool } from '../js/engine/world.js';
import { advanceDay, resumeFromHalftime, acceptJob } from '../js/engine/season.js';
import { initBudget } from '../js/engine/recruiting.js';
import { freshSkills } from '../js/engine/coach.js';
import { C, ROSTER_TARGETS } from '../js/constants.js';

let fails = 0;
const ok  = (m) => console.log(`  OK  ${m}`);
const bad = (m) => { console.log(`  ✗   ${m}`); fails++; };

const world = generateWorld();
world.recruits = generateRecruitPool(world);

// Snapshot pre-season needs per AI school BEFORE anything commits.
const preNeeds = new Map();
for (const s of world.schools) {
  const count = {}, srs = {};
  for (const p of s.roster) {
    count[p.position] = (count[p.position] || 0) + 1;
    if (p.classYear === 'SR') srs[p.position] = (srs[p.position] || 0) + 1;
  }
  const need = {};
  for (const pos of Object.keys(ROSTER_TARGETS)) {
    need[pos] = (ROSTER_TARGETS[pos] || 0) - ((count[pos] || 0) - (srs[pos] || 0));
  }
  preNeeds.set(s.id, need);
}

for (const s of world.schools) {
  if (s.coach) {
    const sen = s.roster.filter(p => p.classYear === 'SR').length;
    initBudget(s.coach, Math.max(0, C.ROSTER_SIZE - s.roster.length) + sen);
  }
}
const ps = world.schools.filter(s => s.division === 'D1').sort((a, b) => b.prestige - a.prestige)[0];
const state = {
  initialized: true, season: 1, day: 4, playerSchoolId: ps.id,
  playerCoach: { id: 'player', schoolId: ps.id, prestige: ps.prestige, reputation: 'C', skills: freshSkills(),
    budget: 0, scholarshipsAvailable: 0, recruitBoard: [], budgetCarryover: 0, seasonRecord: { wins: 0, losses: 0 } },
  world, schedule: generateSchedule(world), playoffs: null, allPlayoffs: null, bowls: null,
  offseason: null, postseasonMode: null, pendingWeeklyCands: null, pendingWalkOns: null, rivalry: null,
  pendingNonConfChoices: [], inbox: [], gameLog: [], signingsLog: [], awardsLog: [], coachHistory: [], ui: {},
};
ps.coach = state.playerCoach;

console.log('\n=== recruiting_check — AI recruiting rebuild ===\n');

// ── Board sanity before the season runs ────────────────────────────────────
{
  const withBoards = world.schools.filter(s => s.coach?.aiRec).length;
  withBoards >= world.schools.length - 1
    ? ok(`AI boards built for ${withBoards}/${world.schools.length} schools`)
    : bad(`only ${withBoards} schools have boards`);
  const suitorCounts = world.recruits.map(r => (r.rivals || []).filter(x => !x.eliminated).length);
  const starved = suitorCounts.filter(n => n < C.AI_SUITORS_MIN).length;
  const over = suitorCounts.filter(n => n > C.AI_SUITORS_CAP).length;
  (starved === 0 && over === 0)
    ? ok(`every recruit has ${C.AI_SUITORS_MIN}–${C.AI_SUITORS_CAP} suitors (avg ${(suitorCounts.reduce((a, b) => a + b, 0) / suitorCounts.length).toFixed(1)})`)
    : bad(`suitor bounds violated: ${starved} starved, ${over} oversubscribed`);
  // (The pre-rolled narrowSchedule commit-calendar check was retired with the
  // field itself — battle-decided signing has no pre-season commit dates by
  // construction. Commit-timing spread is asserted on state.signingsLog after
  // the live season below, which measures the outcome the calendar was a
  // proxy for.)
}

// ── Run the season through signing day ─────────────────────────────────────
const tick = () => {
  const ev = advanceDay(state, () => {}) || [];
  while (state.pendingHalftime) ev.push(...(resumeFromHalftime(state) || []));
  if (state.playerCoach?.status === 'unemployed') {
    const pick = state.forcedShortlist?.[0];
    if (pick) acceptJob(state, pick.schoolId);
  }
  return ev;
};
let guard = 0;
while (state.day < 20 && guard++ < 30) tick();

// ── 1. Rolling commitments ─────────────────────────────────────────────────
{
  const funnel = state.signingsLog.filter(sg => sg.source !== 'backfill');
  const byDay = {};
  for (const sg of funnel) byDay[sg.day] = (byDay[sg.day] || 0) + 1;
  const days = Object.keys(byDay).map(Number).sort((a, b) => a - b);
  const total = funnel.length;
  const lateShare = funnel.filter(sg => sg.day >= 17).length / total;
  const byDay12 = funnel.filter(sg => sg.day <= 12).length / total;

  days.length >= 8
    ? ok(`signings landed on ${days.length} distinct days (${days[0]}–${days[days.length - 1]})`)
    : bad(`signings on only ${days.length} days`);
  lateShare < 0.55
    ? ok(`final-window share ${(lateShare * 100).toFixed(0)}% (was ~100% on days 17–19)`)
    : bad(`still back-loaded: ${(lateShare * 100).toFixed(0)}% on days 17–19`);
  byDay12 >= 0.12
    ? ok(`${(byDay12 * 100).toFixed(0)}% committed by midseason (day 12)`)
    : bad(`only ${(byDay12 * 100).toFixed(0)}% by day 12`);
  console.log(`  ·   ${total} funnel signings; per-day: ${days.map(d => `${d}:${byDay[d]}`).join(' ')}`);
}

// ── 2. Need-driven targeting ────────────────────────────────────────────────
{
  const aiSchools = world.schools.filter(s => s.id !== ps.id && s.coach?.aiRec);
  let needHits = 0, needTotal = 0;
  for (const s of aiSchools) {
    const need = preNeeds.get(s.id);
    for (const r of world.recruits) {
      if (r.committed !== s.id) continue;
      needTotal++;
      if ((need[r.position] || 0) > 0) needHits++;
    }
  }
  const share = needTotal ? needHits / needTotal : 0;
  share >= 0.55
    ? ok(`${(share * 100).toFixed(0)}% of AI signings fill positions of genuine need (${needHits}/${needTotal})`)
    : bad(`need targeting weak: ${(share * 100).toFixed(0)}%`);
}

// ── 3. Class caps + full-class freeze ───────────────────────────────────────
{
  let overCap = 0, fullSchools = 0;
  for (const s of world.schools) {
    const ai = s.coach?.aiRec;
    if (!ai || s.id === ps.id) continue;
    const funnelWins = state.signingsLog.filter(sg => sg.schoolId === s.id && sg.source !== 'backfill').length;
    if (funnelWins > ai.slots) overCap++;
    if (ai.full) fullSchools++;
  }
  overCap === 0
    ? ok(`no AI school funnel-signed past its scholarship count (${fullSchools} classes filled early and froze)`)
    : bad(`${overCap} schools signed past their slots`);
  fullSchools > 0
    ? ok('full-class freeze exercised in a live season')
    : bad('no school ever filled — freeze path untested');
}

console.log(`\n${fails === 0 ? 'ALL CHECKS PASSED' : fails + ' FAILURES'}\n`);
process.exit(fails === 0 ? 0 : 1);
