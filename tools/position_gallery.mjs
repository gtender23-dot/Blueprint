// Visual and structural gate for the viewer-only position anatomy system.
// Usage: node tools/position_gallery.mjs [shot.png]
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shot = process.argv[2] || join(root, '_position-gallery.png');
const tmp = mkdtempSync(join(tmpdir(), 'wsppos-'));
const entry = join(tmp, 'entry.js');
const bundle = join(tmp, 'bundle.js');
writeFileSync(entry, `import { spriteMarkup } from ${JSON.stringify(join(root, 'js/ui/sprite.js').replace(/\\/g, '/'))}; window.__spriteMarkup = spriteMarkup;`);
const esbuildBin = process.platform === 'win32'
  ? join(root, 'node_modules/@esbuild/win32-x64/esbuild.exe')
  : join(root, 'node_modules/esbuild/bin/esbuild');
execSync(`${JSON.stringify(esbuildBin)} ${JSON.stringify(entry)} --bundle --format=iife --outfile=${JSON.stringify(bundle)}`, { stdio: 'pipe' });

const css = readFileSync(join(root, 'style.css'), 'utf8');
const js = readFileSync(bundle, 'utf8');
const html = `<!doctype html><meta charset="utf-8"><style>${css}
html,body{margin:0;background:#0f321b}#watch-board{width:1440px;height:810px;display:block}
.pos-head{fill:#ffd34d;font:800 2.3px monospace;text-anchor:middle}.face-head{fill:#f4f0d8;font:800 2px monospace;text-anchor:middle}
</style><svg id="watch-board" class="watch-sprites watch-in-play" viewBox="0 0 180 100"></svg>
<script>${js}<\/script><script>
const svg=document.getElementById('watch-board');
svg.style.setProperty('--wsp-off','#e8e2d0');svg.style.setProperty('--wsp-off-hl','#e8b92f');
svg.style.setProperty('--wsp-def','#9f2737');svg.style.setProperty('--wsp-def-hl','#f4f0d8');
const positions=['QB','RB','WR','TE','LB','OL','DL','CB','K'];
const faces=['e','w','s','n'];let out='';
positions.forEach((pos,col)=>{
  const x=15+col*19.2;out+='<text class="pos-head" x="'+x+'" y="5">'+pos+'</text>';
  faces.forEach((face,row)=>{
    const y=18+row*24,team=(col+row)%2?'def':'off';
    const a={id:pos+'-'+face,team,label:pos,pos,grp:pos,qb:pos==='QB'};
    out+='<g class="wp-actor wp-team-'+team+' wsp-face-'+face+(a.qb?' wp-qb':'')+'" data-pos="'+pos+'" transform="translate('+x+','+y+') scale(2)">'+window.__spriteMarkup(a,face)+'</g>';
  });
});
faces.forEach((f,row)=>out+='<text class="face-head" x="3.5" y="'+(18+row*24)+'">'+f.toUpperCase()+'</text>');
svg.innerHTML=out;
window.__report={modern:svg.querySelectorAll('.wsp-modern-athlete').length,profiles:[...svg.querySelectorAll('.wsp-modern-athlete')].map(n=>[...n.classList].find(c=>c.startsWith('wsp-profile-'))),helmets:svg.querySelectorAll('.wsp-modern-mask').length};
<\/script>`;
const page = join(tmp, 'positions.html');
writeFileSync(page, html);
const { chromium } = await import(pathToFileURL(join(root, 'node_modules/playwright/index.mjs')).href);
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const pg = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const errs=[];pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+page);await pg.screenshot({path:shot});
const rep=await pg.evaluate('window.__report');await browser.close();
const expected=9*4;let pass=true;
const check=(name,ok,detail='')=>{console.log((ok?'PASS ':'FAIL ')+name+(detail?'  ['+detail+']':''));if(!ok)pass=false};
check('pageerrors 0',errs.length===0,errs.join('; ').slice(0,180));
check('all position sprites use modern anatomy',rep.modern===expected,'modern='+rep.modern);
check('five position profiles render',new Set(rep.profiles).size===5,[...new Set(rep.profiles)].join(','));
check('modern facemasks render in all directions',rep.helmets>=expected,'masks='+rep.helmets);
console.log('shot: '+shot);process.exit(pass?0:1);
