const t0=Date.now();
const { generateWorld, generateSchedule, generateRecruitPool } = await import('../js/engine/world.js');
const { advanceDay, resumeFromHalftime } = await import('../js/engine/season.js');
const { initBudget } = await import('../js/engine/recruiting.js');
const { C } = await import('../js/constants.js');
const world = generateWorld();
world.recruits = generateRecruitPool(world);
for (const s of world.schools) if (s.coach) { const sen=s.roster.filter(p=>p.classYear==='SR').length; initBudget(s.coach, Math.max(0,C.ROSTER_SIZE-s.roster.length)+sen); }
console.log('worldgen ms', Date.now()-t0, 'schools', world.schools.length);
const ps = world.schools[0];
const state = { initialized:true, season:1, day:1, playerSchoolId: ps.id,
 playerCoach:{ id:'player', schoolId:ps.id, prestige:ps.prestige, reputation:'C', budget:0, scholarshipsAvailable:0, recruitBoard:[], budgetCarryover:0, seasonRecord:{wins:0,losses:0} },
 world, schedule: generateSchedule(world), playoffs:null, inbox:[], gameLog:[], signingsLog:[], ui:{} };
ps.coach = state.playerCoach;
const t1=Date.now();
while (state.season === 1) { advanceDay(state, ()=>{}); while (state.pendingHalftime) resumeFromHalftime(state); }
console.log('season1 ms', Date.now()-t1);
const t2=Date.now();
while (state.season === 2) { advanceDay(state, ()=>{}); while (state.pendingHalftime) resumeFromHalftime(state); }
console.log('season2 ms', Date.now()-t2);
