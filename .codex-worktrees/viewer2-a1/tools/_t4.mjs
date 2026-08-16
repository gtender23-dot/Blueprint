function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
Math.random = mulberry32(0xD21F7A11);
const { generateWorld, generateSchedule, generateRecruitPool } = await import('../js/engine/world.js');
const { advanceDay, resumeFromHalftime } = await import('../js/engine/season.js');
const { advanceOffseasonStage, graduatingSeniors, visibleStages } = await import('../js/engine/offseason.js');
const { initBudget } = await import('../js/engine/recruiting.js');
const { C } = await import('../js/constants.js');
const world = generateWorld(); world.recruits = generateRecruitPool(world);
for (const s of world.schools) if (s.coach) { const sen=s.roster.filter(p=>p.classYear==='SR').length; initBudget(s.coach, Math.max(0,C.ROSTER_SIZE-s.roster.length)+sen); }
const ps = world.schools[0];
const state = { initialized:true, season:1, day:1, playerSchoolId: ps.id,
 playerCoach:{ id:'player', schoolId:ps.id, prestige:ps.prestige, reputation:'C', budget:0, scholarshipsAvailable:0, recruitBoard:[], budgetCarryover:0, seasonRecord:{wins:0,losses:0} },
 world, schedule: generateSchedule(world), playoffs:null, inbox:[], gameLog:[], signingsLog:[], ui:{} };
ps.coach = state.playerCoach;
function cutToCap(){ const school=world.schools.find(s=>s.id===state.playerSchoolId); const grads=graduatingSeniors(state).length;
  let over=school.roster.length-grads-C.ROSTER_SIZE; if(over<=0) return 0;
  const cuts=school.roster.filter(p=>p.classYear!=='SR').sort((a,b)=>(a.compositeRating||0)-(b.compositeRating||0)).slice(0,over);
  const ids=new Set(cuts.map(p=>p.id)); school.roster=school.roster.filter(p=>!ids.has(p.id)); return over; }
for (let i=0;i<600;i++){
  const before=`${state.season}.${state.day}`;
  const ev=advanceDay(state, ()=>{});
  while (state.pendingHalftime) resumeFromHalftime(state);
  let g=0;
  while (state.offseason && !state.offseason.done && g++<40){
    const e=advanceOffseasonStage(state);
    if (e.some(x=>x.type==='warning')) { const n=cutToCap(); if(!n){ console.log('WARN unfixable:', JSON.stringify(e).slice(0,200)); break; } }
  }
  const after=`${state.season}.${state.day}`;
  if (before===after){
    console.log('STUCK', before, 'ev=', JSON.stringify(ev).slice(0,300));
    console.log('offseason=', JSON.stringify(state.offseason).slice(0,200));
    console.log('stages=', visibleStages(state).map(s=>s.id).join(','));
    console.log('playerCoach.status=', state.playerCoach.status, 'schoolId=', state.playerCoach.schoolId, 'playerSchoolId=', state.playerSchoolId);
    break;
  }
  if (state.season>=4){ console.log('OK reached S4'); break; }
}
