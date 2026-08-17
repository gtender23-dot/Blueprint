// Dynasty Game Plan save action + saved-team library UI smoke.
//
// [2026-08-17, FULLGATE_TRIAGE item 8] Rewritten off the retired coach door. W9 §12 made
// the tree the only main-menu path, so the coach home this smoke used to open via
// [data-mm-coach] — with its SAVED TEAMS · PLAY NOW list and [data-mm-team-del] — is
// unreachable UI. Where a saved team SURFACES today is Play Now's "Saved dynasty teams"
// source picker (playnow.js sourcePicker → instantiateSavedTeam), so the library half of
// this smoke asserts the same substance there: the snapshot is listed, it stays attached
// to its coach, and picking it actually fields the saved roster.
// DELETE is RE-HOMED (owner decision 2026-08-17): a fielded snapshot's .pn-saved-meta
// row now carries [data-pn-saved-del] (same deleteSavedTeam logic the unreachable coach
// home wired, confirm() per the app's destructive convention). The delete drive below
// asserts it: control present → confirm → snapshot gone from the coach profile, the
// picker, and the fielded panel.
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
  await page.evaluate(async()=>{const api=await import('./js/state.js');api.navigate('playnow');}); await page.waitForTimeout(250);
  const pick=await page.evaluate(async()=>{
    const cp=await import('./js/engine/coachprofile.js');
    const team=cp.listSavedTeams()[0]; const sel=document.getElementById('pn-source-home');
    if(!team||!sel) return null;
    const key=`${team.coachId}|${team.id}`;
    const opt=[...sel.options].find(o=>o.value===key);
    return {key,coachId:team.coachId,coachName:team.coachName||'',label:opt?.textContent?.trim()||'',group:opt?.closest('optgroup')?.label||''};
  });
  check(!!pick&&pick.group==='Saved dynasty teams'&&pick.label.includes('UI Snapshot'),'Play Now lists the snapshot under Saved dynasty teams',pick?pick.label:'no option');
  check(!!pick&&pick.coachId===fixture.coachId&&!!pick.coachName&&pick.label.includes(pick.coachName),'saved team remains attached to its coach profile',pick?`${pick.coachName} / ${pick.label}`:'');
  await page.selectOption('#pn-source-home',pick?.key??''); await page.waitForTimeout(250);
  const loaded=await page.evaluate(()=>({meta:(document.querySelector('.pn-saved-meta')?.textContent||'').trim(),name:(document.querySelector('.pn-panel .pn-name')?.textContent||'').trim()}));
  check(loaded.meta.includes('SAVED SNAPSHOT'),'picking the snapshot swaps Team 1 to the saved team',loaded.meta);
  check(loaded.name===fixture.school,'the fielded team is the saved school, roster and all',loaded.name);
  const menuPhoneOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1); check(!menuPhoneOverflow,'Play Now saved-team picker fits phone');
  await page.setViewportSize({width:1280,height:900}); await page.waitForTimeout(100);
  const desktopOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1); check(!desktopOverflow,'Play Now saved-team picker fits desktop');
  // The re-homed delete door (2026-08-17): lives on the fielded snapshot's meta row.
  check(await page.locator('[data-pn-saved-del="home"]').count()===1,'the fielded snapshot shows its delete control');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-pn-saved-del="home"]').click(); await page.waitForTimeout(300);
  const afterDelete=await page.evaluate(async()=>{const cp=await import('./js/engine/coachprofile.js');const sel=document.getElementById('pn-source-home');return {teams:cp.listSavedTeams().length,optgroup:!!sel?.querySelector('optgroup[label="Saved dynasty teams"]'),meta:!!document.querySelector('.pn-saved-meta')};});
  check(afterDelete.teams===0,'deleting removes the snapshot from the coach profile');
  check(!afterDelete.optgroup,'the Saved dynasty teams group is gone from the picker');
  check(!afterDelete.meta,'Team 1 falls back to a generated team after the delete');
  check(errors.length===0,'zero page errors',errors.slice(0,2).join(' | '));
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
console.log(fails?`\nFAIL — ${fails} saved-team library UI check(s)`:'\nSAVED-TEAM LIBRARY UI SMOKE PASS'); process.exit(fails?1:0);