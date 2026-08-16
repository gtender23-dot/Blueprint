// Structural browser gate for the procedural viewer-audio engine.
// Usage: node tools/stadium_audio_probe.mjs
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const tmp=mkdtempSync(join(tmpdir(),'stadium-audio-'));
const entry=join(tmp,'entry.js'),bundle=join(tmp,'bundle.js'),pagePath=join(tmp,'probe.html');
writeFileSync(entry,`import { stadiumStart,stadiumPause,stadiumReact,soundDebug } from ${JSON.stringify(join(root,'js/ui/sound.js').replace(/\\/g,'/'))};import { state } from ${JSON.stringify(join(root,'js/state.js').replace(/\\/g,'/'))};window.__audio={stadiumStart,stadiumPause,stadiumReact,soundDebug,state};`);
const esbuild=process.platform==='win32'?join(root,'node_modules/@esbuild/win32-x64/esbuild.exe'):join(root,'node_modules/esbuild/bin/esbuild');
execSync(`${JSON.stringify(esbuild)} ${JSON.stringify(entry)} --bundle --format=iife --outfile=${JSON.stringify(bundle)}`,{stdio:'pipe'});
const js=readFileSync(bundle,'utf8');
writeFileSync(pagePath,`<!doctype html><button id="start">start</button><button id="mute">mute</button><script>${js}<\/script><script>
window.__reports=[];
document.querySelector('#start').onclick=()=>{const a=window.__audio;a.state.settings=a.state.settings||{};a.state.settings.sound=true;a.stadiumStart(.42);a.stadiumReact('snap');a.stadiumReact('contact');a.stadiumReact('touchdown');window.__reports.push({phase:'on',played:true,...a.soundDebug()})};
document.querySelector('#mute').onclick=()=>{const a=window.__audio;const before=a.soundDebug().cueCount;a.state.settings.sound=false;a.stadiumPause();const played=a.stadiumReact('turnover');window.__reports.push({phase:'muted',played,before,...a.soundDebug()})};
<\/script>`);
const {chromium}=await import(pathToFileURL(join(root,'node_modules/playwright/index.mjs')).href);
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||undefined});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto('file://'+pagePath);await page.click('#start');await page.waitForTimeout(180);await page.click('#mute');await page.waitForTimeout(80);
const reports=await page.evaluate('window.__reports');await browser.close();
const on=reports.find(r=>r.phase==='on')||{},muted=reports.find(r=>r.phase==='muted')||{};let pass=true;
const check=(n,ok,d='')=>{console.log((ok?'PASS ':'FAIL ')+n+(d?'  ['+d+']':''));if(!ok)pass=false};
check('pageerrors 0',errors.length===0,errors.join('; ').slice(0,180));
check('audio context created from user gesture',on.context!=='uncreated','context='+on.context);
check('stadium ambience graph active',on.stadium===true,'stadium='+on.stadium);
check('football cues recorded',on.cueCount>=3,'cues='+on.cueCount);
check('muted setting blocks reactions',muted.enabled===false&&muted.played===false,'played='+muted.played);
check('muted reaction adds no cue',muted.cueCount===muted.before,'before='+muted.before+' after='+muted.cueCount);
process.exit(pass?0:1);
