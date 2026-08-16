// M8 position-authentic pre-snap stance visual and structural gate.
// Usage: node tools/presnap_stance_probe.mjs [shot.png]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shot = process.argv[2] || join(root, '_presnap-stances.png');
const tmp = mkdtempSync(join(tmpdir(), 'wspset-'));
const entry = join(tmp, 'entry.js'), bundle = join(tmp, 'bundle.js');
writeFileSync(entry, `import { spriteMarkup } from ${JSON.stringify(join(root, 'js/ui/sprite.js').replace(/\\/g, '/'))}; window.__spriteMarkup = spriteMarkup;`);
const esbuildBin = process.platform === 'win32'
  ? join(root, 'node_modules/@esbuild/win32-x64/esbuild.exe')
  : join(root, 'node_modules/esbuild/bin/esbuild');
execFileSync(esbuildBin, [entry, '--bundle', '--format=iife', `--outfile=${bundle}`], { stdio: 'pipe' });

const css = readFileSync(join(root, 'style.css'), 'utf8'), js = readFileSync(bundle, 'utf8');
const html = `<!doctype html><meta charset="utf-8"><style>${css}
html,body{margin:0;background:#092719}#watch-board{width:1600px;height:800px;display:block}
.set-head{fill:#ffd34d;font:900 2px monospace;text-anchor:middle}.set-sub{fill:#b7c9bd;font:800 1.1px monospace;text-anchor:middle}
.set-row{fill:#7ea089;font:800 1.2px monospace}.set-cell .wsp-tag{display:none}
</style><svg id="watch-board" class="watch-sprites watch-presnap" viewBox="0 0 200 100"></svg>
<script>${js}<\/script><script>
const svg=document.getElementById('watch-board');svg.style.setProperty('--wsp-off','#f0eadb');svg.style.setProperty('--wsp-off-hl','#e0a817');svg.style.setProperty('--wsp-def','#97283d');svg.style.setProperty('--wsp-def-hl','#f0eadb');
const positions=['QB','RB','WR','TE','OL','C','DL','DE','LB','CB'];let out='';
positions.forEach((pos,col)=>{const x=19+col*19.2;out+='<text class="set-head" x="'+x+'" y="5">'+pos+'</text><text class="set-sub" x="'+x+'" y="7">SET</text>';
 [['off','e',42],['def','w',87]].forEach((row,ri)=>{const a={id:pos+'-stance-'+ri,team:row[0],label:pos,pos,grp:pos,qb:pos==='QB'};out+='<g class="set-cell wp-actor wp-team-'+row[0]+' wsp-still wsp-face-'+row[1]+'" data-pos="'+pos+'" transform="translate('+x+','+row[2]+') scale(4.8)">'+window.__spriteMarkup(a,row[1])+'</g>';});
});out+='<text class="set-row" x="2" y="42">OFFENSE</text><text class="set-row" x="2" y="87">DEFENSE</text>';svg.innerHTML=out;
const actors=[...svg.querySelectorAll('.wp-actor')],setPoses=[...svg.querySelectorAll('.wsp-pose-set')],idle=[...svg.querySelectorAll('.wsp-pose-idle')];
const lineOff=svg.querySelector('.wp-team-off [class*="wsp-profile-line"] .wsp-shell'),lineDef=svg.querySelector('.wp-team-def [class*="wsp-profile-line"] .wsp-shell');
window.__report={actors:actors.length,setCount:setPoses.length,setShown:setPoses.every(n=>getComputedStyle(n).display!=='none'),idleHidden:idle.every(n=>getComputedStyle(n).display==='none'),profiles:new Set([...svg.querySelectorAll('.wsp')].map(n=>[...n.classList].find(c=>c.startsWith('wsp-profile-'))).filter(Boolean)).size,three:svg.querySelectorAll('.wsp-stance-three').length,qb:svg.querySelectorAll('.wsp-set-quarterback').length,ready:svg.querySelectorAll('.wsp-set-ready').length,lineTransforms:[lineOff&&getComputedStyle(lineOff).transform,lineDef&&getComputedStyle(lineDef).transform]};
<\/script>`;
const pagePath = join(tmp, 'stances.html'); writeFileSync(pagePath, html);
const { chromium } = await import(pathToFileURL(join(root, 'node_modules/playwright/index.mjs')).href);
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1600, height: 800 } });
const errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.goto('file://'+pagePath);
const report=await page.evaluate('window.__report');await page.screenshot({path:shot});await browser.close();
let pass=true;const check=(name,ok,detail='')=>{console.log(`${ok?'PASS':'FAIL'} ${name}${detail?`  [${detail}]`:''}`);if(!ok)pass=false};
check('pageerrors 0',errors.length===0,errors.join(' | ').slice(0,300));
check('all 20 actors render',report.actors===20,`count=${report.actors}`);
check('all directional bodies carry visible set art',report.setCount===60&&report.setShown,`count=${report.setCount}`);
check('ordinary idle pose is hidden pre-snap',report.idleHidden);
check('all five body families set',report.profiles===5,`profiles=${report.profiles}`);
check('quarterback and ready-hand stances exist',report.qb>0&&report.ready>0,`qb=${report.qb} ready=${report.ready}`);
check('two/three-point line variation exists',report.three>0,`three=${report.three}`);
check('opposing lines lean toward each other',report.lineTransforms[0]&&report.lineTransforms[1]&&report.lineTransforms[0]!==report.lineTransforms[1],report.lineTransforms.join(' / '));
console.log(`shot: ${shot}`);process.exit(pass?0:1);
