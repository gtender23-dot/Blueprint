// Reference-driven RB anatomy and pose gate for presentation Milestone 5.
// Usage: node tools/rb_anatomy_probe.mjs [shot.png]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shot = process.argv[2] || join(root, '_rb-anatomy.png');
const tmp = mkdtempSync(join(tmpdir(), 'wsprb-'));
const entry = join(tmp, 'entry.js');
const bundle = join(tmp, 'bundle.js');
writeFileSync(entry, `import { spriteMarkup } from ${JSON.stringify(join(root, 'js/ui/sprite.js').replace(/\\/g, '/'))}; window.__spriteMarkup = spriteMarkup;`);
const esbuildBin = process.platform === 'win32'
  ? join(root, 'node_modules/@esbuild/win32-x64/esbuild.exe')
  : join(root, 'node_modules/esbuild/bin/esbuild');
execFileSync(esbuildBin, [entry, '--bundle', '--format=iife', `--outfile=${bundle}`], { stdio: 'pipe' });

const css = readFileSync(join(root, 'style.css'), 'utf8');
const js = readFileSync(bundle, 'utf8');
const html = `<!doctype html><meta charset="utf-8"><style>${css}
html,body{margin:0;background:#102d1b}#watch-board{width:1440px;height:800px;display:block}
.rb-title{fill:#f7d35b;font:900 2.3px monospace;text-anchor:middle}.rb-sub{fill:#aab9ae;font:800 1.4px monospace;text-anchor:middle}
.rb-cell .wsp-tag{display:none}.rb-cell .wsp-shell,.rb-cell .wsp-limb,.rb-cell .wsp-sd-thigh,.rb-cell .wsp-sd-shin{animation-play-state:paused!important;animation-delay:-.2s!important}
</style><svg id="watch-board" class="watch-sprites watch-in-play" viewBox="0 0 180 100"></svg>
<script>${js}<\/script><script>
const svg=document.getElementById('watch-board');svg.style.setProperty('--wsp-off','#efe9dc');svg.style.setProperty('--wsp-off-hl','#e3ac24');
const cells=[['FRONT','s','wsp-still'],['BACK','n','wsp-still'],['RIGHT','e','wsp-still'],['LEFT','w','wsp-still'],['CARRY','e','wp-near-ball'],['JUKE','e','wp-near-ball wp-moving wp-mv-juke wp-mv-plant'],['STIFF','e','wp-near-ball wp-moving wp-mv-stiff wp-mv-power'],['CATCH','e','wp-catching wp-catch-hi'],['DIVE','e','wp-near-ball wp-moving wp-mv-dive'],['DOWN','e','wp-tackled wp-down wp-hit-form']];
let out='';cells.forEach((c,i)=>{const col=i%5,row=Math.floor(i/5),x=18+col*36,y=9+row*48;const a={id:'RB-'+i,team:'off',label:'RB',pos:'RB',grp:'RB'};
 out+='<text class="rb-title" x="'+x+'" y="'+y+'">'+c[0]+'</text><text class="rb-sub" x="'+x+'" y="'+(y+2.4)+'">REFERENCE BODY</text>';
 out+='<g class="rb-cell wp-actor wp-team-off wsp-face-'+c[1]+' '+c[2]+'" data-rb="'+i+'" transform="translate('+x+','+(y+35)+') scale(5)">'+window.__spriteMarkup(a,c[1])+'</g>';
});svg.innerHTML=out;window.__report={prototype:svg.querySelectorAll('.wsp-prototype-rb').length,rbChains:svg.querySelectorAll('.wsp-rb-leg-chain, .wsp-reference-leg-chain').length,profiles:svg.querySelectorAll('.wsp-profile-runner').length,facemasks:svg.querySelectorAll('.wsp-modern-mask').length};
<\/script>`;
const pagePath = join(tmp, 'rb.html');
writeFileSync(pagePath, html);
const { chromium } = await import(pathToFileURL(join(root, 'node_modules/playwright/index.mjs')).href);
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1440, height: 800 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
await page.goto('file://' + pagePath);
const report = await page.evaluate('window.__report');
await page.screenshot({ path: shot });
await browser.close();
let pass = true;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `  [${detail}]` : ''}`); if (!ok) pass = false; };
check('pageerrors 0', errors.length === 0, errors.join(' | ').slice(0, 300));
check('all ten samples use the RB prototype', report.prototype === 10, `count=${report.prototype}`);
check('all ten samples use runner profiles', report.profiles === 10, `count=${report.profiles}`);
check('reference-driven joint chains render', report.rbChains >= 40, `chains=${report.rbChains}`);
check('modern facemasks survive every pose', report.facemasks >= 20, `masks=${report.facemasks}`);
console.log(`shot: ${shot}`);
process.exit(pass ? 0 : 1);
