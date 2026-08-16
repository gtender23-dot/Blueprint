// M7 uniform-authenticity visual and structural gate.
// Usage: node tools/uniform_identity_probe.mjs [shot.png]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shot = process.argv[2] || join(root, '_uniform-identity.png');
const tmp = mkdtempSync(join(tmpdir(), 'wspuniform-'));
const entry = join(tmp, 'entry.js');
const bundle = join(tmp, 'bundle.js');
writeFileSync(entry, `import { spriteMarkup, uniformNumber } from ${JSON.stringify(join(root, 'js/ui/sprite.js').replace(/\\/g, '/'))}; window.__uniform = { spriteMarkup, uniformNumber };`);
const esbuildBin = process.platform === 'win32'
  ? join(root, 'node_modules/@esbuild/win32-x64/esbuild.exe')
  : join(root, 'node_modules/esbuild/bin/esbuild');
execFileSync(esbuildBin, [entry, '--bundle', '--format=iife', `--outfile=${bundle}`], { stdio: 'pipe' });

const css = readFileSync(join(root, 'style.css'), 'utf8');
const js = readFileSync(bundle, 'utf8');
const html = `<!doctype html><meta charset="utf-8"><style>${css}
html,body{margin:0;background:#0a2717}#watch-board{width:1600px;height:900px;display:block}
.uni-head{fill:#ffd34d;font:900 2.1px monospace;text-anchor:middle}.uni-sub{fill:#b9cabf;font:800 1.1px monospace;text-anchor:middle}
.uni-row{fill:#7fa18a;font:800 1.1px monospace;text-anchor:end}.uni-cell .wsp-tag{display:none}
.uni-cell .wsp-shell,.uni-cell .wsp-limb,.uni-cell .wsp-sd-thigh,.uni-cell .wsp-sd-shin{animation-play-state:paused!important;animation-delay:-.2s!important}
</style><svg id="watch-board" class="watch-sprites watch-in-play" viewBox="0 0 200 112.5"></svg>
<script>${js}<\/script><script>
const {spriteMarkup,uniformNumber}=window.__uniform,svg=document.getElementById('watch-board');
svg.style.setProperty('--wsp-off','#f2eee1');svg.style.setProperty('--wsp-off-hl','#e0a916');
svg.style.setProperty('--wsp-def','#98283c');svg.style.setProperty('--wsp-def-hl','#f2eee1');
const positions=['QB','RB','WR','TE','OL','DL','LB','CB','S','K'];
const views=[['FRONT','s'],['BACK','n'],['RIGHT','e'],['LEFT','w']];let out='';
positions.forEach((pos,col)=>{const x=19+col*19.3;out+='<text class="uni-head" x="'+x+'" y="4.5">'+pos+'</text><text class="uni-sub" x="'+x+'" y="6.5">NUMERIC KIT</text>';
 views.forEach((view,row)=>{const y=21+row*27,off=!['DL','LB','CB','S'].includes(pos),a={id:pos+'-'+col+'-'+row,team:off?'off':'def',label:pos,pos,grp:pos,qb:pos==='QB'};
  if(pos==='QB'&&row===0)a.jerseyNumber=7;
  out+='<g class="uni-cell wp-actor wp-team-'+a.team+' wsp-face-'+view[1]+' wsp-still" data-pos="'+pos+'" transform="translate('+x+','+y+') scale(2.75)">'+spriteMarkup(a,view[1])+'</g>';
 });
});
views.forEach((view,row)=>out+='<text class="uni-row" x="8" y="'+(21+row*27)+'">'+view[0]+'</text>');svg.innerHTML=out;
const range=(pos,n)=>/^(OL|C|G|T)$/.test(pos)?n>=50&&n<=79:pos==='DL'?n>=50&&n<=99:pos==='QB'?n>=0&&n<=19:pos==='WR'?((n>=0&&n<=19)||(n>=80&&n<=89)):pos==='TE'?((n>=0&&n<=49)||(n>=80&&n<=89)):n>=0&&n<=99;
const rangeRuns=positions.flatMap(pos=>Array.from({length:80},(_,i)=>[pos,uniformNumber(pos,pos+'-'+i)]));
const sprites=[...svg.querySelectorAll('.wsp-uniform-authentic')],numbers=[...svg.querySelectorAll('.wsp-number')];
window.__report={sprites:sprites.length,numeric:sprites.every(n=>/^\\d{1,2}$/.test(n.dataset.jersey)),roleLeaks:numbers.filter(n=>/[^0-9]/.test(n.textContent)).length,sideNumbers:svg.querySelectorAll('.wsp-side-number').length,stripes:svg.querySelectorAll('.wsp-stripe-line').length,sleeves:svg.querySelectorAll('.wsp-gear-arm-sleeves').length,braces:svg.querySelectorAll('.wsp-gear-knee-brace').length,explicit:svg.querySelector('[data-pos="QB"] .wsp-uniform-authentic')?.dataset.jersey,ranges:rangeRuns.every(([p,n])=>range(p,n)),distinct:new Set(sprites.map(n=>n.dataset.jersey)).size};
<\/script>`;
const pagePath = join(tmp, 'uniforms.html');
writeFileSync(pagePath, html);
const { chromium } = await import(pathToFileURL(join(root, 'node_modules/playwright/index.mjs')).href);
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
await page.goto('file://' + pagePath);
const report = await page.evaluate('window.__report');
await page.screenshot({ path: shot });
await browser.close();
let pass = true;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `  [${detail}]` : ''}`); if (!ok) pass = false; };
check('pageerrors 0', errors.length === 0, errors.join(' | ').slice(0, 300));
check('all 40 samples use authentic uniforms', report.sprites === 40, `count=${report.sprites}`);
check('all jersey marks are numeric', report.numeric && report.roleLeaks === 0, `roleLeaks=${report.roleLeaks}`);
check('position number ranges hold', report.ranges);
check('explicit roster number wins', report.explicit === '7', `number=${report.explicit}`);
check('side number exists in every sprite', report.sideNumbers === 40, `count=${report.sideNumbers}`);
check('helmet stripes survive every direction', report.stripes >= 120, `count=${report.stripes}`);
check('equipment variation renders', report.sleeves > 0 && report.braces > 0, `sleeves=${report.sleeves} braces=${report.braces}`);
check('lineup has varied numbers', report.distinct >= 8, `distinct=${report.distinct}`);
console.log(`shot: ${shot}`);
process.exit(pass ? 0 : 1);
