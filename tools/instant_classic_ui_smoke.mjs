// Tree-home Instant Classics list + fixed-scale replay smoke on phone and desktop.
//
// [2026-08-17, FULLGATE_TRIAGE item 9] Rewritten off the retired coach door. W9 §12 made
// the tree the only main-menu path, so the coach/world screen this smoke used to open via
// [data-mm-coach] is unreachable UI. Classics now live on the TREE home:
// renderTreeClassics (mainmenu.js) reads t.meta.classics and each row's
// [data-mm-tree-classic] keys the tree's ONE world save (treeWorldKey). The replay half
// (watch viewer ids, INSTANT CLASSIC header, Back to Coach Select) is unchanged.
// Two deliberate differences from the old coach-path assertions, both real moves:
// - the row prints "Season N · week", NOT "World N" — a tree has exactly one world.
// - delete is RE-HOMED (owner decision 2026-08-17): each tree classic row now carries
//   [data-mm-tree-classic-del] (the coach-home [data-mm-classic-del] door stays
//   unreachable). The old delete drive is restored below against the tree door,
//   including the payload-leaves-the-world-save proof.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png' };
const server = http.createServer(async (req,res)=>{try{const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '')||'index.html';const body=await readFile(join(ROOT,rel));res.writeHead(200,{'content-type':MIME[extname(rel)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end('not found');}});
await new Promise(resolve=>server.listen(0,resolve));
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||undefined,headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}}); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
let fails=0; const check=(ok,label,detail='')=>{if(!ok)fails++;console.log(`${ok?'✅':'❌'} ${label}${detail?` — ${detail}`:''}`);};
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`); await page.waitForTimeout(300);
  const seeded=await page.evaluate(async()=>{
    const cp=await import('./js/engine/coachprofile.js'); const persist=await import('./js/engine/persistence.js'); const api=await import('./js/state.js');
    const tree=cp.createTree('Classic'); cp.createCoach('Classic','Coach',{treeId:tree.id}); const home={id:'classic-home',name:'Home State',nick:'Owls',abbr:'HST',colors:['#184a8b','#f2c94c']}; const away={id:'classic-away',name:'Away Tech',nick:'Foxes',abbr:'AT',colors:['#a52a2a','#f3f3f3']};
    const plays=[{half:2,clock:80,scoreOff:24,scoreDef:27,type:'run',yards:6,fieldPos:55,down:1,distance:10,offFormation:'Spread',defFront:'4-3',concept:'Inside Zone',rusherId:'rb'}];
    const result={homeScore:31,awayScore:30,winner:home.id,homeSchool:home,awaySchool:away,homeStats:{rushYds:180,passYds:220,totalYds:400},awayStats:{rushYds:150,passYds:235,totalYds:385},homePlayerStats:{},awayPlayerStats:{},playerNames:{rb:{name:'Ray Back',pos:'RB'}},drives:[{possession:'home',plays,result:'td',points:7}],log:[]};
    const entry={id:'ic-ui',score:76,saved:Date.now(),season:3,day:9,week:'Week 5',playerSchoolId:home.id,homeId:home.id,awayId:away.id,homeName:home.name,awayName:away.name,homeScore:31,awayScore:30,result};
    cp.noteTreeMeta(tree.id,{season:3,classics:[{...entry,result:undefined}]});
    await persist.saveGame({initialized:true,world:null,instantClassics:[entry],ui:{},settings:{}},cp.treeWorldKey(tree.id));
    api.navigate('mainmenu'); return tree.id;
  });
  await page.waitForTimeout(250); await page.locator(`[data-mm-tree="${seeded}"]`).click(); await page.waitForTimeout(200);
  check(await page.locator('[data-mm-tree-classic="ic-ui"]').count()===1,'tree home lists the Instant Classic');
  const row=await page.locator('[data-mm-tree-classic="ic-ui"]').innerText(); check(row.includes('Home State 31–30 Away Tech')&&row.includes('Season 3'),'classic row shows matchup, score, and season (a tree has one world — no World tag)',row.replace(/\n/g,' | '));
  check(await page.locator('[data-mm-tree-classic-del="ic-ui"]').count()===1,'tree classic row carries the re-homed delete door (owner decision 2026-08-17)');
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'classic list fits a 390px phone');
  await page.locator('[data-mm-tree-classic="ic-ui"]').click(); await page.waitForTimeout(250);
  check(await page.locator('#watch-root').count()===1,'replay opens directly in Watch');
  check((await page.locator('.game-result-modal .modal-header h2').innerText()).includes('INSTANT CLASSIC'),'replay modal identifies the archived classic');
  check(await page.locator('#watch-live-toggle').count()===0,'archived replay does not show the live-game preference');
  check((await page.locator('#close-game-result-btn').innerText()).toUpperCase().includes('BACK TO COACH SELECT'),'replay return action is explicit');
  check(await page.locator('#watch-board').count()===1,'existing fixed-scale game viewer mounts');
  await page.locator('#watch-stepfwd').click(); await page.waitForTimeout(120);
  const bugText=await page.locator('#watch-bug').innerText(); check(bugText.toUpperCase().includes('HOME STATE'),'replay scoreboard uses archived team identity',bugText.replace(/\\n/g,' | '));
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'replay viewer fits a 390px phone');
  await page.setViewportSize({width:1280,height:900}); await page.waitForTimeout(150);
  check(await page.locator('#watch-board').count()===1,'replay remains mounted on desktop');
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'replay viewer fits desktop');
  await page.locator('#close-game-result-btn').click(); await page.waitForTimeout(200);
  check(await page.locator('[data-mm-tree-classic="ic-ui"]').count()===1,'Back to Coach Select returns to the tree home with the classic still listed');
  // The payload half is still asserted directly against the tree's world save:
  const replayIntact=await page.evaluate(async()=>{const cp=await import('./js/engine/coachprofile.js');const p=await import('./js/engine/persistence.js');const tree=cp.listTrees()[0];const saved=await p.loadGame(cp.treeWorldKey(tree.id));return (saved?.instantClassics||[]).some(item=>item.id==='ic-ui'&&!!item.result);});
  check(replayIntact,'the full replay payload survives in the tree\'s world save after watching');
  // The delete drive, restored onto the re-homed tree door (2026-08-17): confirm →
  // row gone → payload gone from the tree's ONE world save AND from the menu meta.
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-mm-tree-classic-del="ic-ui"]').click(); await page.waitForTimeout(300);
  check(await page.locator('[data-mm-tree-classic="ic-ui"]').count()===0,'deleting the classic removes the row from the tree home');
  const replayGone=await page.evaluate(async()=>{const cp=await import('./js/engine/coachprofile.js');const p=await import('./js/engine/persistence.js');const tree=cp.listTrees()[0];const saved=await p.loadGame(cp.treeWorldKey(tree.id));const meta=(cp.getTree(tree.id)?.meta?.classics)||[];return !(saved?.instantClassics||[]).some(item=>item.id==='ic-ui')&&!meta.some(item=>item.id==='ic-ui');});
  check(replayGone,'the delete strips the payload from the world save and the row from the menu meta');
  check(errors.length===0,'zero page errors',errors.slice(0,3).join(' | '));
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
console.log(fails?`\nFAIL — ${fails} Instant Classic UI check(s)`:'\nINSTANT CLASSIC UI SMOKE PASS'); process.exit(fails?1:0);
