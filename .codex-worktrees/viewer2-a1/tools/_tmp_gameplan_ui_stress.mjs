import { chromium } from 'playwright';
const target = process.argv[2];
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await b.newPage({ viewport:{ width:390, height:844 } });
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
let fails=0; const check=(ok,msg)=>{console.log(`${ok?'PASS':'FAIL'}  ${msg}`);if(!ok)fails++;};
await page.goto('file://'+target,{waitUntil:'load'}); await page.waitForTimeout(1000);
for(const [kind,sel,arg] of [
  ['click','#btn-mm-newtree'],['fill','#mm-nt-first','Game'],['fill','#mm-nt-last','Planner'],['click','#mm-nt-create']
]) { const l=page.locator(sel); if(kind==='fill') await l.fill(arg); else await l.click(); await page.waitForTimeout(300); }
for(let i=0;i<40;i++){
  if(await page.locator('[data-nav]').count()>3)break;
  if(await page.locator('#ob-start').count()){await page.locator('#ob-start').click();await page.waitForTimeout(1000);continue;}
  for(const sel of ['.ob-school-row','.ob-pick-card','.ob-chip:not(.active)']){const l=page.locator(sel),n=await l.count();if(!n)continue;await l.first().click().catch(()=>{});if(n>1)await l.last().click().catch(()=>{});break;}
  const n=page.locator('[id^="ob-next-"]:not([disabled])');if(await n.count())await n.last().click().catch(()=>{});await page.waitForTimeout(350);
}
const nav=async(v)=>{const l=page.locator(`[data-nav="${v}"],[data-tabbar="${v}"]`);await l.first().dispatchEvent('click');await page.waitForTimeout(500);};
await nav('gameplan');
check(await page.locator('[data-simpledial]').count()===12,'all 12 simple identity buttons render at phone width');
check(await page.locator('[data-simplesit]').count()>=24,'simple situation controls render');
for(const [key,vals] of [['simpleOffId',['run','balanced','pass']],['simpleOffAggr',['safe','balanced','aggr']],['simpleDefPosture',['bend','balanced','attack']],['simpleTempo',['slow','normal','fast']]]){
  for(const val of vals){const l=page.locator(`[data-simpledial="${key}"][data-simpleval="${val}"]`);await l.dispatchEvent('click');await page.waitForTimeout(120);check(await l.getAttribute('class').then(x=>x.includes('active')),`${key} persists ${val}`);}
}
// Contradictory order: pass-first then attacking defense. Advanced view should
// retain Heavy Pass, but its sole Box slider reveals the shared runCommit field.
await page.locator('[data-simpledial="simpleOffId"][data-simpleval="pass"]').dispatchEvent('click');
await page.locator('[data-simpledial="simpleDefPosture"][data-simpleval="attack"]').dispatchEvent('click');
await nav('settings'); await page.locator('[data-gpmode="advanced"]').dispatchEvent('click'); await page.waitForTimeout(300);
await nav('gameplan'); await page.locator('[data-gpsection="defense"]').dispatchEvent('click'); await page.waitForTimeout(350);
const boxAttack=await page.locator('#box-commit').inputValue();
check(boxAttack==='8',`pass-first + attack leaves defensive Box at +8 (actual ${boxAttack})`);
await nav('settings'); await page.locator('[data-gpmode="simple"]').dispatchEvent('click'); await page.waitForTimeout(250); await nav('gameplan');
await page.locator('[data-simpledial="simpleDefPosture"][data-simpleval="bend"]').dispatchEvent('click');
await page.locator('[data-simpledial="simpleOffId"][data-simpleval="run"]').dispatchEvent('click');
await nav('settings'); await page.locator('[data-gpmode="advanced"]').dispatchEvent('click'); await page.waitForTimeout(250); await nav('gameplan'); await page.locator('[data-gpsection="defense"]').dispatchEvent('click'); await page.waitForTimeout(350);
const boxRun=await page.locator('#box-commit').inputValue();
check(boxRun==='10',`bend defense + run-first offense is silently changed to loaded Box +10 (actual ${boxRun})`);
check(errors.length===0,`zero page errors (${errors.length})`);
await b.close();
console.log(`\n${fails?'UI STRESS FAILED':'UI STRESS PASS (with cross-control coupling reproduced)'}`);
process.exit(fails?1:0);
