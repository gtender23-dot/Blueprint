const { generateWorld, generateSchedule, generateRecruitPool } = await import('../js/engine/world.js');
const { advanceDay, resumeFromHalftime } = await import('../js/engine/season.js');
const { initBudget } = await import('../js/engine/recruiting.js');
const { C } = await import('../js/constants.js');
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
Math.random = mulberry32(0xD21F7A11);
const world = generateWorld(); world.recruits = generateRecruitPool(world);
for (const s of world.schools) if (s.coach) { const sen=s.roster.filter(p=>p.classYear==='SR').length; initBudget(s.coach, Math.max(0,C.ROSTER_SIZE-s.roster.length)+sen); }
const ps = world.schools[0];
const state = { initialized:true, season:1, day:1, playerSchoolId: ps.id,
 playerCoach:{ id:'player', schoolId:ps.id, prestige:ps.prestige, reputation:'C', budget:0, scholarshipsAvailable:0, recruitBoard:[], budgetCarryover:0, seasonRecord:{wins:0,losses:0} },
 world, schedule: generateSchedule(world), playoffs:null, inbox:[], gameLog:[], signingsLog:[], ui:{} };
ps.coach = state.playerCoach;
for (let i=0;i<200;i++){
  const before = `${state.season}.${state.day}`;
  const ev = advanceDay(state, ()=>{});
  while (state.pendingHalftime) resumeFromHalftime(state);
  const after = `${state.season}.${state.day}`;
  if (before === after) {
    console.log('STUCK at', before, 'status=', state.playerCoach?.status, 'events=', JSON.stringify(ev).slice(0,400));
    console.log('pending keys:', Object.keys(state).filter(k=>k.startsWith('pending')||k.startsWith('await')).map(k=>k+'='+JSON.stringify(state[k]).slice(0,80)));
    break;
  }
  if (state.season>=4) { console.log('reached S4 fine'); break; }
}
