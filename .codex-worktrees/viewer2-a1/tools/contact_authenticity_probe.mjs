// M9 line-engagement and tackle-arrival visual/structural gate.
// Usage: node tools/contact_authenticity_probe.mjs [shot.png]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const shot=process.argv[2]||join(root,'_contact-authenticity.png');
const tmp=mkdtempSync(join(tmpdir(),'wspcontact-'));
const entry=join(tmp,'entry.js'),bundle=join(tmp,'bundle.js');
writeFileSync(entry,`import { spriteMarkup } from ${JSON.stringify(join(root,'js/ui/sprite.js').replace(/\\/g,'/'))};window.__spriteMarkup=spriteMarkup;`);
const esbuild=process.platform==='win32'?join(root,'node_modules/@esbuild/win32-x64/esbuild.exe'):join(root,'node_modules/esbuild/bin/esbuild');
execFileSync(esbuild,[entry,'--bundle','--format=iife',`--outfile=${bundle}`],{stdio:'pipe'});
const css=readFileSync(join(root,'style.css'),'utf8'),js=readFileSync(bundle,'utf8');
const html=`<!doctype html><meta charset="utf-8"><style>${css}
html,body{margin:0;background:#082719}#watch-board{width:1600px;height:900px;display:block}.m9-title{fill:#ffd34d;font:900 2.2px monospace;text-anchor:middle}.m9-sub{fill:#a9c0b2;font:800 1.05px monospace;text-anchor:middle}.m9-cell .wsp-tag{display:none}.m9-rule{stroke:#254d38;stroke-width:.2}
</style><svg id="watch-board" class="watch-sprites watch-in-play" viewBox="0 0 200 112.5"></svg><script>${js}<\/script><script>
const svg=document.getElementById('watch-board');svg.style.setProperty('--wsp-off','#f2ead8');svg.style.setProperty('--wsp-off-hl','#dca818');svg.style.setProperty('--wsp-def','#982c40');svg.style.setProperty('--wsp-def-hl','#f2ead8');
const actor=(team,id,pos,face,classes,x,y)=>'<g class="m9-cell wp-actor wp-team-'+team+' wsp-face-'+face+' '+classes+'" data-case="'+id+'" transform="translate('+x+','+y+') scale(4.25)">'+window.__spriteMarkup({id,team,label:pos,pos,grp:pos},face)+'</g>';
const engage=(phase,rep,x,y)=>'<g class="wp-engage wp-engage-'+phase+' wp-engage-tight wp-engage-rep-'+rep+'" transform="translate('+x+','+(y-10)+') scale(1.7)"><ellipse class="wp-engage-shadow" rx="1.45" ry=".48"/><path class="wp-engage-pads" d="M-1.8-.8L-.35 0-1.8.8M1.8-.8L.35 0 1.8.8"/><circle class="wp-engage-core" r=".32"/></g>';
const scenes=[['STRIKE','strike','drive'],['DRIVE','drive','drive'],['RE-FIT','strain','drive'],['REACH','drive','reach'],['CUT','drive','cut']];let out='<line class="m9-rule" x1="4" x2="196" y1="56" y2="56"/>';
scenes.forEach((s,i)=>{const x=20+i*40,y=34;out+='<text class="m9-title" x="'+x+'" y="5">'+s[0]+'</text><text class="m9-sub" x="'+x+'" y="8">'+(s[0]==='CUT'?'LOW BODY':'HANDS + PADS')+'</text>';const common='wp-contact-'+s[1]+' wp-contact-tight wp-rep-'+s[2];out+=actor('off','off-'+s[1],'OL','e','wp-blocking wp-contact-off '+common,x-4.7,y)+actor('def','def-'+s[1],'DL','w','wp-blocked wp-contact-def '+common,x+4.7,y)+engage(s[1],s[2],x,y);});
const tackle=(name,x,from)=>{const y=88,left=from==='left';out+='<text class="m9-title" x="'+x+'" y="64">'+name+'</text><text class="m9-sub" x="'+x+'" y="67">SHARED IMPACT FRAME</text>';out+=actor('def','hit-'+name,'LB',left?'e':'w','wp-tackling wp-contact-arrival wp-contact-hitter wp-contact-from-'+from,x+(left?-4.5:4.5),y)+actor('off','carry-'+name,'RB','e','wp-near-ball wp-tackled wp-contact-arrival wp-contact-carrier wp-contact-from-'+from,x+(left?4.5:-4.5),y);};
tackle('FORM TACKLE',48,'left');tackle('ANGLE TACKLE',102,'right');
out+='<text class="m9-title" x="160" y="64">HELP ARRIVES</text><text class="m9-sub" x="160" y="67">SECOND HAT, NEW ANGLE</text>'+actor('def','help','LB','e','wp-tackling wp-contact-arrival wp-contact-hitter',155,88)+actor('off','help-carrier','RB','e','wp-near-ball wp-tackled wp-contact-arrival wp-contact-carrier wp-contact-from-left',165,88);svg.innerHTML=out;
const shells=[...svg.querySelectorAll('.wp-actor .wsp-shell')].map(n=>getComputedStyle(n).animationName);const hands=[...svg.querySelectorAll('.wp-actor .wsp-pose-block .wsp-limb')].map(n=>getComputedStyle(n).animationName);const glyphs=[...svg.querySelectorAll('.wp-engage-pads')].map(n=>getComputedStyle(n).animationName);window.__report={actors:svg.querySelectorAll('.wp-actor').length,engages:glyphs.length,shells,hands,glyphs,strike:svg.querySelectorAll('.wp-contact-strike').length,drive:svg.querySelectorAll('.wp-contact-drive').length,strain:svg.querySelectorAll('.wp-contact-strain').length,arrival:svg.querySelectorAll('.wp-contact-arrival').length,cutShell:getComputedStyle(svg.querySelector('[data-case="off-drive"]')?.querySelector('.wsp-shell')).animationName};
<\/script>`;
const pagePath=join(tmp,'contact.html');writeFileSync(pagePath,html);
const {chromium}=await import(pathToFileURL(join(root,'node_modules/playwright/index.mjs')).href);
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||undefined});const page=await browser.newPage({viewport:{width:1600,height:900}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.goto('file://'+pagePath);await page.waitForTimeout(220);const report=await page.evaluate('window.__report');await page.screenshot({path:shot});await browser.close();
let pass=true;const check=(n,ok,d='')=>{console.log((ok?'PASS ':'FAIL ')+n+(d?'  ['+d+']':''));if(!ok)pass=false};
check('pageerrors 0',errors.length===0,errors.join(' | ').slice(0,260));check('all 16 contact actors render',report.actors===16,'count='+report.actors);check('five engagement glyphs render',report.engages===5,'count='+report.engages);check('strike, drive and re-fit families exist',report.strike===2&&report.drive===6&&report.strain===2,`strike=${report.strike} drive=${report.drive} strain=${report.strain}`);check('six tackle-arrival bodies share impact state',report.arrival===6,'count='+report.arrival);check('blocker and defender shell animations differ',new Set(report.shells.filter(n=>n&&n!=='none')).size>=8,'unique='+new Set(report.shells).size);check('hands use authored contact animation',report.hands.some(n=>String(n).includes('wsp-m9-hand'))||report.hands.some(n=>String(n).includes('wsp-m9-refit')),[...new Set(report.hands)].join(','));check('engagement glyph follows three phases',new Set(report.glyphs).size>=3,[...new Set(report.glyphs)].join(','));console.log('shot: '+shot);process.exit(pass?0:1);
