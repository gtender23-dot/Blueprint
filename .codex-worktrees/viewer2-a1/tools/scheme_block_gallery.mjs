// M10 recorded blocking/protection scheme visual and structural gate.
// Usage: node tools/scheme_block_gallery.mjs [shot.png]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const shot=process.argv[2]||join(root,'_scheme-block-gallery.png');
const tmp=mkdtempSync(join(tmpdir(),'wspscheme-')),entry=join(tmp,'entry.js'),bundle=join(tmp,'bundle.js');
writeFileSync(entry,`import { spriteMarkup } from ${JSON.stringify(join(root,'js/ui/sprite.js').replace(/\\/g,'/'))};window.__spriteMarkup=spriteMarkup;`);
const esbuild=process.platform==='win32'?join(root,'node_modules/@esbuild/win32-x64/esbuild.exe'):join(root,'node_modules/esbuild/bin/esbuild');
execFileSync(esbuild,[entry,'--bundle','--format=iife',`--outfile=${bundle}`],{stdio:'pipe'});
const css=readFileSync(join(root,'style.css'),'utf8'),js=readFileSync(bundle,'utf8');
const html=`<!doctype html><meta charset="utf-8"><style>${css}
html,body{margin:0;background:#082719}#watch-board{display:block;width:1600px;height:1000px}.sg-title{fill:#ffd34d;font:900 2.2px monospace;text-anchor:middle}.sg-sub{fill:#a9c0b2;font:800 1px monospace;text-anchor:middle}.sg-cell .wsp-tag{display:none}.sg-rule{stroke:#214b36;stroke-width:.2}
</style><svg id="watch-board" class="watch-sprites watch-in-play" viewBox="0 0 200 125"></svg><script>${js}<\/script><script>
const svg=document.getElementById('watch-board');svg.style.setProperty('--wsp-off','#f2ead8');svg.style.setProperty('--wsp-off-hl','#dda919');svg.style.setProperty('--wsp-def','#982c40');svg.style.setProperty('--wsp-def-hl','#f2ead8');
const reps=[['DRIVE','drive','OL','DL'],['DOWN','down','OL','DL'],['REACH','reach','OL','DL'],['PULL','pull','OL','LB'],['TRAP','trap','OL','DL'],['CLIMB','climb','OL','LB'],['CUT','cut','OL','DL'],['CHIP','chip','TE','DE'],['PICKUP','pickup','RB','LB']];
const actor=(team,id,pos,face,cls,x,y)=>'<g class="sg-cell wp-actor wp-team-'+team+' wsp-face-'+face+' '+cls+'" data-rep="'+id+'" transform="translate('+x+','+y+') scale(3.7)">'+window.__spriteMarkup({id:team+'-'+id,team,label:pos,pos,grp:pos},face)+'</g>';let out='<line class="sg-rule" x1="4" x2="196" y1="42" y2="42"/><line class="sg-rule" x1="4" x2="196" y1="83" y2="83"/>';
reps.forEach((r,i)=>{const col=i%3,row=Math.floor(i/3),x=35+col*65,y=31+row*41;out+='<text class="sg-title" x="'+x+'" y="'+(y-24)+'">'+r[0]+'</text><text class="sg-sub" x="'+x+'" y="'+(y-21.5)+'">'+r[2]+' vs '+r[3]+'</text>';const common='wp-contact-drive wp-contact-tight wp-rep-'+r[1];out+=actor('off',r[1],r[2],'e','wp-blocking wp-contact-off '+common,x-4.3,y)+actor('def',r[1],r[3],'w','wp-blocked wp-contact-def '+common,x+4.3,y);});svg.innerHTML=out;
const blockers=[...svg.querySelectorAll('.wp-blocking')],defenders=[...svg.querySelectorAll('.wp-blocked')];const anim=n=>getComputedStyle(n).animationName;window.__report={actors:svg.querySelectorAll('.wp-actor').length,reps:new Set(blockers.map(n=>n.dataset.rep)).size,blockShell:blockers.map(n=>anim(n.querySelector('.wsp-shell'))),defShell:defenders.map(n=>anim(n.querySelector('.wsp-shell'))),hands:blockers.flatMap(n=>[...n.querySelectorAll('.wsp-pose-block .wsp-limb')].map(anim)),feet:blockers.flatMap(n=>[...n.querySelectorAll('.wsp-sd-thigh')].map(anim))};
<\/script>`;
const pagePath=join(tmp,'scheme.html');writeFileSync(pagePath,html);const {chromium}=await import(pathToFileURL(join(root,'node_modules/playwright/index.mjs')).href);const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||undefined});const page=await browser.newPage({viewport:{width:1600,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.goto('file://'+pagePath);await page.waitForTimeout(220);const report=await page.evaluate('window.__report');await page.screenshot({path:shot});await browser.close();
let pass=true;const check=(n,ok,d='')=>{console.log((ok?'PASS ':'FAIL ')+n+(d?'  ['+d+']':''));if(!ok)pass=false};const uniq=a=>new Set(a.filter(n=>n&&n!=='none'));
check('pageerrors 0',errors.length===0,errors.join(' | ').slice(0,260));check('all 18 scheme actors render',report.actors===18,'count='+report.actors);check('all nine recorded rep families render',report.reps===9,'count='+report.reps);check('all nine blocker executions are distinct',uniq(report.blockShell).size===9,[...uniq(report.blockShell)].join(','));check('defender reactions remain scheme-specific',uniq(report.defShell).size>=8,'unique='+uniq(report.defShell).size);check('at least seven hand-placement families render',uniq(report.hands).size>=7,'unique='+uniq(report.hands).size);check('reach, pull, climb and pickup footwork render',uniq(report.feet).size>=4,'unique='+uniq(report.feet).size);console.log('shot: '+shot);process.exit(pass?0:1);
