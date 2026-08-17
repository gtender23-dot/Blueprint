// Letter-logo production-screen + visual gallery smoke (phone and desktop).
import { chromium } from 'playwright-core';
import http from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=fileURLToPath(new URL('..',import.meta.url)); const SHOTS=join(ROOT,'qa-shots');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
const server=http.createServer(async(req,res)=>{try{const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '')||'index.html';const body=await readFile(join(ROOT,rel));res.writeHead(200,{'content-type':MIME[extname(rel)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end('not found');}}); await new Promise(r=>server.listen(0,r)); await mkdir(SHOTS,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||undefined,headless:true}); const errors=[]; let fails=0; const check=(ok,label,detail='')=>{if(!ok)fails++;console.log(`${ok?'✅':'❌'} ${label}${detail?` — ${detail}`:''}`);};
const noOverflow=p=>p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1);
try{
  const page=await browser.newPage({viewport:{width:1280,height:900}}); page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`); await page.waitForTimeout(400);
  const fixture=await page.evaluate(async()=>{const api=await import('./js/state.js');const worldApi=await import('./js/engine/world.js');const world=worldApi.generateWorld();const school=world.schools[0];Object.assign(api.state,{initialized:true,season:2,day:8,world,playerSchoolId:school.id,playerCoach:school.coach,schedule:[]});api.state.ui.view='dashboard';api.rerender();return{abbr:school.abbr};}); await page.waitForTimeout(200);
  const dashboardMarks=page.locator('.topbar-crest .crest-letter, .dash-crest .crest-letter');
  check(await dashboardMarks.count()>=2,'desktop dashboard uses letter marks in navigation and identity header');
  const markData=await page.evaluate(()=>[...document.querySelectorAll('.crest')].slice(0,12).map(el=>({letters:el.dataset.letterMark||'',old:el.classList.contains('crest-pixel')})));
  check(markData.every(mark=>mark.letters&& !mark.old) && markData.some(mark=>mark.letters===fixture.abbr),'dashboard exposes abbreviation marks only');
  check(await noOverflow(page),'letter marks fit the desktop dashboard'); await page.screenshot({path:join(SHOTS,'letter_logos_dashboard_desktop.png'),fullPage:true});

  await page.evaluate(async()=>{const api=await import('./js/state.js');api.navigate('settings');}); await page.waitForTimeout(120);
  const programTab=page.locator('[data-settings-tab="program"]'); check(await programTab.count()===1,'Program customization tab is available'); await programTab.click(); await page.waitForTimeout(120);
  check(await page.locator('.logo-preview .crest-letter').count()===1 && await page.locator('#btn-logo-remove').innerText()==='Use letter mark','customization preview and reset copy use the letter system');

  await page.evaluate(async()=>{const api=await import('./js/state.js');api.navigate('playnow');}); await page.waitForTimeout(180);
  check(await page.locator('.pn-crest .crest-letter').count()===2,'Play Now matchup uses letter marks for both teams');
  await page.setViewportSize({width:390,height:844}); await page.waitForTimeout(100);
  check(await noOverflow(page),'Play Now letter marks fit a 390px phone'); await page.screenshot({path:join(SHOTS,'letter_logos_playnow_phone.png'),fullPage:true});

  const wizard=await browser.newPage({viewport:{width:390,height:844}}); wizard.on('pageerror',e=>errors.push(e.message)); await wizard.goto(`http://127.0.0.1:${server.address().port}/index.html`); await wizard.waitForTimeout(300);
  // [2026-08-17, FULLGATE_TRIAGE item 7] Rewritten onto the tree door. The coach door
  // this section used to enter through (#btn-mm-newcoach → coach home → [data-mm-world-new])
  // was retired by W9 §12 — the tree is the ONLY start path. START A DYNASTY takes the
  // coach's name in one form and goes straight into the wizard (navigate('newgame')); a
  // tree run locks take-the-job/D3 and skips the Situation step, so #ob-next-0 lands
  // directly on THE JOB (state → level → school list — the screen under test here).
  await wizard.locator('#btn-mm-newtree').click(); await wizard.locator('#mm-nt-first').fill('Logo'); await wizard.locator('#mm-nt-last').fill('Test'); await wizard.locator('#mm-nt-create').click(); await wizard.waitForTimeout(400);
  check(await wizard.locator('.ob-kicker').count()>=1,'new dynasty entry (the tree door) opens the wizard');
  await wizard.locator('#ob-next-0').click(); await wizard.locator('[data-ob-state="CA"]').click(); await wizard.locator('[data-ob-div="D3"]').click(); await wizard.waitForTimeout(150);
  const schoolRows=wizard.locator('.ob-school-row:not(.ob-school-found)'); const rowCount=await schoolRows.count(); const rowMarks=wizard.locator('.ob-school-row:not(.ob-school-found) .ob-school-mark .crest-letter');
  check(rowCount>0 && await rowMarks.count()===rowCount,'opportunity board replaces every school emoji with its letter mark',`${await rowMarks.count()}/${rowCount}`);
  const rowText=await wizard.locator('.ob-school-list').innerText(); check(!/[🐺🐻🦅🐍🐴🐏🐝🐉🐆🐯🦁]/u.test(rowText),'opportunity board has no mascot emoji logos'); check(await noOverflow(wizard),'opportunity-board letter marks fit phone'); await wizard.screenshot({path:join(SHOTS,'letter_logos_job_picker_phone.png'),fullPage:true});

  const gallery=await browser.newPage({viewport:{width:1100,height:780}}); gallery.on('pageerror',e=>errors.push(e.message)); await gallery.goto(`http://127.0.0.1:${server.address().port}/index.html`); await gallery.evaluate(async()=>{const {generateWorld}=await import('./js/engine/world.js');const {renderCrest}=await import('./js/utils.js');const schools=generateWorld().schools;const picked=[];const seen=new Set();for(const school of schools){const mark=renderCrest(school,68);const style=mark.match(/data-crest-style="(\d+)"/)?.[1];if(!seen.has(style)){seen.add(style);picked.push(school);}}for(const school of schools){if(picked.length>=32)break;if(!picked.includes(school))picked.push(school);}document.body.innerHTML=`<main style="max-width:1040px;margin:auto;padding:24px;background:#0b111c;color:#f4f0d8;font-family:Arial,sans-serif"><h1 style="margin:0 0 6px">School Letter Marks</h1><p style="margin:0 0 18px;color:#aebbd0">Deterministic school colors, five frames, eight collegiate letter treatments.</p><section style="display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:12px">${picked.map(s=>`<article style="min-width:0;padding:10px;text-align:center;border:2px solid #53617a;background:#111b2b">${renderCrest(s,68)}<b style="display:block;margin-top:7px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.abbr}</b><small style="display:block;color:#8f9db3;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.name}</small></article>`).join('')}</section></main>`;});
  check(await gallery.locator('.crest-letter').count()===32,'visual gallery renders 32 varied school marks'); check(await noOverflow(gallery),'letter-mark gallery fits desktop'); await gallery.screenshot({path:join(SHOTS,'letter_logo_gallery_desktop.png'),fullPage:true}); await gallery.setViewportSize({width:390,height:844}); await gallery.evaluate(()=>{const grid=document.querySelector('section');if(grid)grid.style.gridTemplateColumns='repeat(3,minmax(0,1fr))';}); check(await noOverflow(gallery),'letter-mark gallery fits phone'); await gallery.screenshot({path:join(SHOTS,'letter_logo_gallery_phone.png'),fullPage:true});
  check(errors.length===0,'zero page errors',errors.slice(0,3).join(' | '));
}finally{await browser.close();await new Promise(r=>server.close(r));}
console.log(fails?`\nFAIL — ${fails} letter-logo UI check(s)`:'\nLETTER-LOGO UI SMOKE PASS');process.exit(fails?1:0);