// recruit_assist_probe.mjs — the rebuilt Recruiting Assist (3 levels):
//   • off    — does nothing.
//   • assist — fills the board at OPEN-NEED positions, offers there, and stops
//              once needs are covered (leaves surplus scholarships to you).
//   • full   — completes the class, spending down toward zero scholarships.
// Plus: strategy is obeyed (quality floor), offers never exceed the scholarship
// count, and the old dev-tools boolean maps to full (back-compat).
// Run: node tools/recruit_assist_probe.mjs [worlds]
import { generateWorld, generateRecruitPool } from '../js/engine/world.js';
import { initBudget } from '../js/engine/recruiting.js';
import { recruitDistance } from '../js/utils.js';
import { recruitAssistLevel, defaultRecruitStrategy, autoRecruitForPlayer } from '../js/engine/season.js';

const WORLDS = parseInt(process.argv[2] || '4', 10);
let fail = 0;
const g = (n, ok, d = '') => { if (!ok) fail++; console.log(`${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`); };

// ── Back-compat mapping (unit) ─────────────────────────────────────────────
g('level maps: off passes through, legacy assist folds into full',
  recruitAssistLevel({ settings: { recruitAssist: 'off' } }) === 'off'
  && recruitAssistLevel({ settings: { recruitAssist: 'assist' } }) === 'full'
  && recruitAssistLevel({ settings: { recruitAssist: 'full' } }) === 'full');
g('back-compat: old autoRecruit:true → full, absent → off',
  recruitAssistLevel({ settings: { autoRecruit: true } }) === 'full'
  && recruitAssistLevel({ settings: {} }) === 'off');

function makeState(level, strat) {
  const world = generateWorld();
  world.recruits = generateRecruitPool(world);
  for (const s of world.schools) if (s.coach) initBudget(s.coach, 20);
  const me = world.schools.find(s => s.division === 'D1' && s.coach) || world.schools[0];
  const coach = { id: 'p', schoolId: me.id, budget: 400000, scholarshipsAvailable: 12,
                  recruitBoard: [], scouted: {} };
  me.coach = coach;
  return { world, season: 1, playerSchoolId: me.id, playerCoach: coach,
           settings: { recruitAssist: level, recruitStrategy: strat || defaultRecruitStrategy() } };
}

// Warm the board (fill it), then force interest above the offer bar so the OFFER
// gate actually fires without needing the full weekly-funnel sim, and run again.
function warmAndOffer(state, days = 3) {
  autoRecruitForPlayer(state, 5);                          // day 5: fills the board
  for (const e of state.playerCoach.recruitBoard) e.interest = 85;
  for (let d = 6; d < 6 + days; d++) autoRecruitForPlayer(state, d);
}

let offNoop = 0, floorHeld = 0, neverNegative = 0;
let boardSpread = 0, worstMaxPos = 0;
const ROSTER_TARGETS = { QB: 4, RB: 7, WR: 10, TE: 4, OL: 15, DE: 5, DT: 5, OLB: 5, LB: 5, CB: 7, S: 5, K: 2, P: 1 };  // synced to constants.js (RB 7, FB retired)
const classNeed = (school, pos) => {
  const have = (school.roster || []).filter(p => p.position === pos).length;
  const srs  = (school.roster || []).filter(p => p.position === pos && p.classYear === 'SR').length;
  return Math.max(0, (ROSTER_TARGETS[pos] || 0) - (have - srs));
};
for (let w = 0; w < WORLDS; w++) {
  // OFF — no board, no spend.
  {
    const st = makeState('off');
    const budget0 = st.playerCoach.budget;
    warmAndOffer(st);
    if (st.playerCoach.recruitBoard.length === 0 && st.playerCoach.budget === budget0) offNoop++;
  }
  // FULL on the world (assist tier retired — on/off only now).
  const full   = makeState('full');
  warmAndOffer(full, 4);

  // Board diversity: no single position may monopolize the board (the "30 OL"
  // bug). Count per-position on the full board and check the spread.
  {
    const byPos = {};
    for (const e of full.playerCoach.recruitBoard) {
      const r = full.world.recruits.find(x => x.id === e.recruitId);
      if (r) byPos[r.position] = (byPos[r.position] || 0) + 1;
    }
    const counts = Object.values(byPos);
    const maxPos = counts.length ? Math.max(...counts) : 0;
    const distinct = counts.length;
    worstMaxPos = Math.max(worstMaxPos, maxPos);
    if (maxPos <= 6 && distinct >= 4) boardSpread++;   // capped + spread across ≥4 positions
  }
  if (full.playerCoach.scholarshipsAvailable >= 0) neverNegative++;

  // Quality floor: a blue-chip floor must never board a sub-70 kid.
  {
    const st = makeState('full', { priorities: [], aggression: 'balanced', qualityFloor: 70 });
    warmAndOffer(st, 2);
    const belowFloor = st.playerCoach.recruitBoard.filter(e => {
      const r = st.world.recruits.find(x => x.id === e.recruitId);
      return r && (r.visionRating || 0) < 70;
    }).length;
    if (belowFloor === 0 && st.playerCoach.recruitBoard.length > 0) floorHeld++;
  }
}

console.log('');
g('OFF is a true no-op (no board, no spend)', offNoop === WORLDS, `${offNoop}/${WORLDS}`);
g('offers NEVER drive scholarships negative', neverNegative === WORLDS, `${neverNegative}/${WORLDS}`);
g('quality floor held (no sub-70 kids boarded at blue-chip floor)', floorHeld === WORLDS, `${floorHeld}/${WORLDS}`);
g('board SPREADS across positions (no single-position monopoly / "30 OL" bug)',
  boardSpread === WORLDS, `${boardSpread}/${WORLDS}, worst single-position count=${worstMaxPos}`);

// ── Budget pacing: the fix — full-mode contact must LAST the whole cycle on a
//    realistic budget, not blow out in week 1, and no single allocation near the
//    old $4k weekly cap. Simulate applyWeeklyContact charging the standing
//    allocation every one of the ~19 recruiting days. ──────────────────────────
let pacedSurvives = 0, maxAllocSeen = 0, week1Funded = 0;
for (let w = 0; w < WORLDS; w++) {
  const st = makeState('full');
  st.playerCoach.budget = 50000;   // a realistic recruiting budget, not the dev-flush 400k
  let brokeDay = 99;
  for (let d = 1; d <= 19; d++) {
    autoRecruitForPlayer(st, d);
    if (d === 1) week1Funded = st.playerCoach.recruitBoard.filter(e => (e.contactAlloc || 0) > 0).length;
    for (const e of st.playerCoach.recruitBoard) maxAllocSeen = Math.max(maxAllocSeen, e.contactAlloc || 0);
    for (const e of st.playerCoach.recruitBoard) {              // mimic applyWeeklyContact (charges every day)
      const r = st.world.recruits.find(x => x.id === e.recruitId);
      if (r && !r.committed && !e.eliminated) {
        const pay = Math.min(e.contactAlloc || 0, st.playerCoach.budget);
        if (pay > 0) st.playerCoach.budget -= pay;
      }
    }
    if (st.playerCoach.budget <= 1 && brokeDay === 99) brokeDay = d;
  }
  if (brokeDay >= 15) pacedSurvives++;
}
// ── Distance priority: the board should skew to the backyard (light budget wins
//    up close), i.e. boarded recruits average NEARER than the eligible pool. ──
let distSkew = 0;
for (let w = 0; w < WORLDS; w++) {
  const st = makeState('full');
  autoRecruitForPlayer(st, 5);
  const school = st.world.schools.find(s => s.id === st.playerSchoolId);
  const mean = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
  const boardDists = st.playerCoach.recruitBoard
    .map(e => { const r = st.world.recruits.find(x => x.id === e.recruitId); return r ? recruitDistance(r, school) : null; })
    .filter(x => x != null);
  const poolDists = st.world.recruits.filter(r => !r.committed).map(r => recruitDistance(r, school));
  if (boardDists.length && mean(boardDists) < mean(poolDists) * 0.9) distSkew++;
}
g('board PRIORITIZES distance (boarded recruits skew nearer than the pool)', distSkew === WORLDS, `${distSkew}/${WORLDS}`);

g('FULL contact is paced — budget survives the cycle (not broke by week 1)', pacedSurvives === WORLDS, `${pacedSurvives}/${WORLDS} survive to day 15+`);
g('FULL works a BROAD field in week 1 (not just a handful)', week1Funded >= 10, `${week1Funded} recruits funded in week 1`);
g('no single allocation anywhere near the old $4k weekly cap', maxAllocSeen <= 950, `max seen $${maxAllocSeen}`);

console.log(fail ? `\n❌ ${fail} RECRUIT ASSIST PROBE FAILURES` : '\n✅ RECRUIT ASSIST PROBE PASS');
process.exit(fail ? 1 : 0);
