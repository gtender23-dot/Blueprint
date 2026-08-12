// tree_trickle_probe — the live trickle: shared pool fills SLOWER than personal
// DNA, active coaches are never boosted by it, and it seeds promotions only.
const _ls=new Map();
global.localStorage={getItem:k=>_ls.has(k)?_ls.get(k):null,setItem:(k,v)=>_ls.set(k,String(v)),removeItem:k=>_ls.delete(k)};
const CP=await import('../js/engine/coachprofile.js');
const T=await import('../js/engine/tree.js');
const {C}=await import('../js/constants.js');
let pass=0,fail=0; const check=(c,m)=>{console.log((c?'  OK  ':'  FAIL  ')+m);c?pass++:fail++;};

const rec=CP.createTree('Grove');
const world={schools:[{id:'s1',division:'D3',name:'A',prestige:2,coach:{name:{first:'C',last:'D'},skills:{}},record:{wins:0,losses:0}}]};
const st={season:1,day:0,playerSchoolId:'s1',world,schedule:[]};
const coach=CP.createCoach('Head','Coach',{treeId:rec.id});
T.foundTree(st,{treeId:rec.id,coachId:coach.id});

// Simulate 10 seasons: each season the coach earns ~200 personal DNA, then tick.
for(let s=1;s<=10;s++){
  CP.addDnaXP(coach.id,{groundPound:150,adjustments:50});
  st.season=s+1;
  T.treeSeasonTick(st);
}
const personal=CP.coachDNA(coach.id).axes;
const pool=st.tree.dna.axes;
const personalGP=personal.groundPound||0;
const poolGP=pool.groundPound||0;
console.log(`after 10 seasons: personal groundPound=${personalGP}, pool groundPound=${poolGP}`);
check(poolGP>0,'the shared pool DID grow from the live trickle');
check(poolGP < personalGP*0.10+1,`the pool fills FAR slower than personal (pool ${poolGP} vs personal ${personalGP}, ~${(poolGP/personalGP*100).toFixed(1)}%)`);
check(personalGP===1500,'the coach kept 100% of his own DNA — the pool never taxed him');

// The pool must NOT be readable as a boost to the active coach — sim reads dnaGrades(coachId), which is the coach's OWN dna:
const simGrades=CP.dnaGrades(coach.id);
const poolGrade=CP.dnaGrade(poolGP);
const personalGrade=CP.dnaGrade(personalGP);
check(simGrades.groundPound===personalGrade,'the sim reads the COACH\'s grade, not the pool\'s — active coach unaffected by the pool');

// Promotion inheritance DOES read the pool:
const inherit=CP.dnaInheritance(st.tree,{seasonsUnderTree:0});
check((inherit.axes.groundPound||0)>0,'a promoted coordinator DOES inherit a share of the pool — the pool\'s only payout');
check((inherit.axes.groundPound||0)<=poolGP,'inheritance is a SHARE of the pool, never more than it holds');

console.log(`\n${fail?fail+' FAILED, ':''}${pass}/${pass+fail} — ${fail?'trickle broken':'the trickle holds: slow shared fund, coaches untouched, seeds promotions only.'}`);
process.exit(fail?1:0);
