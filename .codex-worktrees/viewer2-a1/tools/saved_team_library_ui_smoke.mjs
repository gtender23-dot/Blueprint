// Dynasty Game Plan save action + coach-home saved-team library UI smoke.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png' };
const server = http.createServer(async (req, res) => {
  try { const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html'; const body=await readFile(join(ROOT,rel)); res.writeHead(200,{'content-type':MIME[extname(rel)]||'application/octet-stream'}); res.end(body); }
  catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(resolve => server.listen(0, resolve));
const browser = await chromium.launch({ executablePath:process.env.PW_CHROMIUM || undefined, headless:true });
const page = await browser.newPage({ viewport:{ width:390, height:844 } });
const errors=[]; page.on('pageerror', e => errors.push(e.message));
let fails=0; const check=(ok,label,detail='')=>{if(!ok)fails++;console.log(`${ok?'✅':'❌'} ${label}${detail?` — ${detail}`:''}`);};
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForTimeout(400);
  const fixture = await page.evaluate(async () => {
    const api=await import('./js/state.js'); const cp=await import('./js/engine/coachprofile.js'); const world=await import('./js/engine/world.js'); const ai=await import('./js/engine/ai.js');
    const coach=cp.createCoach('Library','UI'); const school=world.generateExhibitionTeam('D1',4); ai.setAIGameplan(school);
    api.state.initialized=true; api.state.world={schools:[school],conferences:{},recruits:[]}; api.state.playerSchoolId=school.id; api.state.playerCoach=school.coach; api.state._coachId=coach.id; api.state.season=4; api.navigate('gameplan');
    return {coachId:coach.id,school:school.name};
  });
  await page.waitForTimeout(200);
  const saveButton=page.locator('#btn-gp-save-team');
  check(await saveButton.count()===1,'Game Plan shows Save Team to Play Now');
  const phoneOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
  check(!phoneOverflow,'Game Plan save-team controls fit a 390px phone');
  page.once('dialog', dialog => dialog.accept(`${fixture.school} UI Snapshot`));
  await saveButton.click(); await page.waitForTimeout(200);
  const saved=await page.evaluate(async()=>{const cp=await import('./js/engine/coachprofile.js');return cp.listSavedTeams().map(t=>({name:t.name,roster:t.school.roster.length,hasGP:!!t.school.gameplan}));});
  check(saved.length===1 && saved[0].roster>0 && saved[0].hasGP,'Game Plan action saves roster and gameplan',saved[0]?.name||'');
  await page.evaluate(async()=>{const api=await import('./js/state.js');api.navigate('mainmenu');}); await page.waitForTimeout(150);
  const coachButton=page.locator('[data-mm-coach]'); check(await coachButton.count()===1,'saved team remains attached to its coach profile'); await coachButton.click(); await page.waitForTimeout(150);
  check(await page.locator('[data-mm-team-del]').count()===1,'coach home lists the saved Play Now team');
  const rowText=await page.locator('[data-mm-team-del]').locator('..').innerText(); check(rowText.includes('UI Snapshot'),'coach library shows the snapshot name',rowText);
  const menuPhoneOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1); check(!menuPhoneOverflow,'coach saved-team library fits phone');
  await page.setViewportSize({width:1280,height:900}); await page.waitForTimeout(100);
  const desktopOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1); check(!desktopOverflow,'coach saved-team library fits desktop');
  check(errors.length===0,'zero page errors',errors.slice(0,2).join(' | '));
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
console.log(fails?`\nFAIL — ${fails} saved-team library UI check(s)`:'\nSAVED-TEAM LIBRARY UI SMOKE PASS'); process.exit(fails?1:0);