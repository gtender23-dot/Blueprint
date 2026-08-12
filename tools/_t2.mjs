const { generateWorld, generateSchedule, generateRecruitPool } = await import('../js/engine/world.js');
const { advanceDay, resumeFromHalftime, getPhase } = await import('../js/engine/season.js');
const { initBudget } = await import('../js/engine/recruiting.js');
const { C } = await import('../js/constants.js');
const world = generateWorld();
world.recruits = generateRecruitPool(world);
for (const s of world.schools) if (s.coach) { const sen=s.roster.filter(p=>p.classYear==='SR').length; initBudget(s.coach, Math.max(0,C.ROSTER_SIZE-s.roster.length)+sen); }
const ps = world.schools[0];
const state = { initialized:true, season:1, day:1, playerSchoolId: ps.id,
 playerCoach:{ id:'player', schoolId:ps.id, prestige:ps.prestige, reputation:'C', budget:0, scholarshipsAvailable:0, recruitBoard:[], budgetCarryover:0, seasonRecord:{wins:0,losses:0} },
 world, schedule: generateSchedule(world), playoffs:null, inbox:[], gameLog:[], signingsLog:[], ui:{} };
ps.coach = state.playerCoach;
const rows=[];
while (state.season === 1) { const d=state.day; const t=Date.now(); advanceDay(state, ()=>{}); while (state.pendingHalftime) resumeFromHalftime(state); rows.push([d, Date.now()-t]); }
rows.sort((a,b)=>b[1]-a[1]);
console.log(rows.slice(0,14).map(r=>`day ${r[0]}: ${r[1]}ms`).join('\n'));
console.log('total', rows.reduce((s,r)=>s+r[1],0));
