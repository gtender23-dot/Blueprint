// Viewer-only action vocabulary gate for college-presentation Milestone 4.
// Usage: node tools/action_animation_probe.mjs [shot.png]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shot = process.argv[2] || join(root, '_action-animation-gallery.png');
const tmp = mkdtempSync(join(tmpdir(), 'wspaction-'));
const entry = join(tmp, 'entry.js');
const bundle = join(tmp, 'bundle.js');
writeFileSync(entry, `import { spriteMarkup } from ${JSON.stringify(join(root, 'js/ui/sprite.js').replace(/\\/g, '/'))}; window.__spriteMarkup = spriteMarkup;`);
const esbuildBin = process.platform === 'win32'
  ? join(root, 'node_modules/@esbuild/win32-x64/esbuild.exe')
  : join(root, 'node_modules/esbuild/bin/esbuild');
execFileSync(esbuildBin, [entry, '--bundle', '--format=iife', `--outfile=${bundle}`], { stdio: 'pipe' });

const css = readFileSync(join(root, 'style.css'), 'utf8');
const js = readFileSync(bundle, 'utf8');
const cases = [
  ['CATCH', 'SECURE', 'wp-catching', 'WR', '.wsp-shell', 'wsp-catch-secure'],
  ['CATCH', 'LOW', 'wp-catching wp-catch-low', 'RB', '.wsp-shell', 'wsp-catch-low-body'],
  ['CATCH', 'HIGH', 'wp-catching wp-catch-hi', 'WR', '.wsp-shell', 'wsp-catch-high-body'],
  ['CATCH', 'CONTEST', 'wp-catching wp-catch-hi wp-catch-contested', 'WR', '.wsp-shell', 'wsp-catch-contact'],
  ['CATCH', 'EXTEND', 'wp-catching wp-catch-extend', 'WR', '.wsp-shell', 'wsp-catch-extend'],
  ['CATCH', 'TOE TAP', 'wp-catching wp-catch-toetap', 'WR', '.wsp-shell', 'wsp-catch-toetap'],
  ['CATCH', 'BREAKUP', 'wp-catching wp-catch-hi wp-catch-contested wp-catch-breakup', 'WR', '.wsp-shell', 'wsp-catch-breakup-body'],
  ['MOVE', 'JUKE', 'wp-moving wp-mv-juke wp-mv-plant', 'RB', '.wsp-shell', 'wsp-mv-juke-modern'],
  ['MOVE', 'SPIN', 'wp-moving wp-mv-spin wp-mv-plant', 'RB', '.wsp-shell', 'wsp-mv-spin-modern'],
  ['MOVE', 'HURDLE', 'wp-moving wp-mv-hurdle wp-mv-power', 'RB', '.wsp-shell', 'wsp-mv-hurdle-modern'],
  ['MOVE', 'TRUCK', 'wp-moving wp-mv-truck wp-mv-power', 'RB', '.wsp-shell', 'wsp-mv-truck-modern'],
  ['MOVE', 'STIFF', 'wp-moving wp-mv-stiff wp-mv-power', 'RB', '.wsp-stiff-arm', 'wsp-stiff'],
  ['MOVE', 'DIVE', 'wp-moving wp-mv-dive', 'RB', '.wsp-shell', 'wsp-mv-dive-modern'],
  ['MOVE', 'RECOVER', 'wp-moving wp-mv-recover', 'RB', '.wsp-shell', 'wsp-mv-balance-modern'],
  ['MOVE', 'SLIDE', 'wp-moving wp-mv-slide', 'QB', '.wsp-shell', 'wsp-mv-slide-modern'],
  ['TACKLER', 'FORM', 'wp-tackling wp-tk-form', 'LB', '.wsp-shell', 'wsp-tkl-form-modern'],
  ['TACKLER', 'WRAP', 'wp-tackling wp-tk-wrap', 'LB', '.wsp-shell', 'wsp-tkl-wrap'],
  ['TACKLER', 'COLLISION', 'wp-tackling wp-tk-collision', 'S', '.wsp-shell', 'wsp-tkl-collide'],
  ['TACKLER', 'DRAG', 'wp-tackling wp-tk-drag', 'LB', '.wsp-shell', 'wsp-tkl-drag'],
  ['TACKLER', 'GANG', 'wp-tackling wp-tk-gang wp-tk-assisted', 'LB', '.wsp-shell', 'wsp-tkl-primary-help'],
  ['TACKLER', 'GOAL LINE', 'wp-tackling wp-tk-goalline', 'LB', '.wsp-shell', 'wsp-tkl-goal'],
  ['TACKLER', 'SHOESTRING', 'wp-tackling wp-tk-shoestring', 'CB', '.wsp-shell', 'wsp-tkl-shoe'],
  ['CARRIER', 'FORM', 'wp-tackled wp-down wp-hit-form', 'RB', '.wsp-shell', 'wsp-down-form'],
  ['CARRIER', 'WRAP', 'wp-tackled wp-down wp-hit-wrap', 'RB', '.wsp-shell', 'wsp-down-wrap'],
  ['CARRIER', 'COLLISION', 'wp-tackled wp-down wp-hit-collision', 'RB', '.wsp-shell', 'wsp-down-collision'],
  ['CARRIER', 'DRAG', 'wp-tackled wp-down wp-hit-drag', 'RB', '.wsp-shell', 'wsp-down-drag'],
  ['CARRIER', 'GANG', 'wp-tackled wp-down wp-hit-gang', 'RB', '.wsp-shell', 'wsp-down-gang'],
  ['CARRIER', 'GOAL LINE', 'wp-tackled wp-down wp-hit-goalline', 'RB', '.wsp-shell', 'wsp-down-goalline'],
  ['CARRIER', 'SHOESTRING', 'wp-tackled wp-down wp-hit-shoestring', 'RB', '.wsp-shell', 'wsp-down-shoestring'],
  ['CARRIER', 'SACK', 'wp-sacked wp-down wp-hit-sack', 'QB', '.wsp-shell', 'wsp-down-sack-modern'],
  ['SHED', 'SWIM', 'wp-blocked wp-shed wp-shed-swim', 'OL', '.wsp-shell', 'wsp-shed-swim'],
  ['SHED', 'RIP', 'wp-blocked wp-shed wp-shed-rip', 'OL', '.wsp-shell', 'wsp-shed-rip'],
  ['SHED', 'BULL', 'wp-blocked wp-shed wp-shed-bull', 'OL', '.wsp-shell', 'wsp-shed-bull'],
  ['SHED', 'COUNTER', 'wp-blocked wp-shed wp-shed-counter', 'OL', '.wsp-shell', 'wsp-shed-counter'],
  ['SHED', 'BEND', 'wp-blocked wp-shed wp-shed-bend', 'OL', '.wsp-shell', 'wsp-shed-bend']
];

const html = `<!doctype html><meta charset="utf-8"><style>${css}
html,body{margin:0;background:#102d1b}#watch-board{width:1400px;height:1040px;display:block}
.gallery-title{fill:#f7d35b;font:900 1.8px monospace;text-anchor:middle;letter-spacing:.08em}
.gallery-family{fill:#93a99b;font:800 1.25px monospace;text-anchor:middle}
.gallery-cell .wsp-tag{display:none}
.gallery-cell .wsp-shell,.gallery-cell .wsp-limb,.gallery-cell .wsp-sd-thigh,.gallery-cell .wsp-sd-shin{animation-play-state:paused!important;animation-delay:-.21s!important}
</style><svg id="watch-board" class="watch-sprites watch-in-play" viewBox="0 0 175 130"></svg>
<script>${js}<\/script><script>
const data=${JSON.stringify(cases)};const svg=document.getElementById('watch-board');
svg.style.setProperty('--wsp-off','#e6e0ce');svg.style.setProperty('--wsp-off-hl','#e4af2b');
svg.style.setProperty('--wsp-def','#8f2638');svg.style.setProperty('--wsp-def-hl','#f1ead4');
let out='';data.forEach((c,i)=>{const col=i%7,row=Math.floor(i/7),x=13+col*25,y=5+row*25;
 const team=c[0]==='TACKLER'?'def':'off',a={id:'case-'+i,team,label:c[3],pos:c[3],grp:c[3],qb:c[3]==='QB'};
 out+='<g class="gallery-cell wp-actor wp-team-'+team+' wsp-face-e '+c[2]+'" data-case="'+i+'" transform="translate('+x+','+(y+13)+') scale(1.8)">'+window.__spriteMarkup(a,'e')+'</g>';
 out+='<text class="gallery-title" x="'+x+'" y="'+y+'">'+c[1]+'</text><text class="gallery-family" x="'+x+'" y="'+(y+2.2)+'">'+c[0]+'</text>';
});svg.innerHTML=out;
window.__report=data.map((c,i)=>{const actor=svg.querySelector('[data-case="'+i+'"]');const target=actor.querySelector(c[4]);return {family:c[0],name:c[1],expected:c[5],actual:getComputedStyle(target).animationName};});
<\/script>`;
const pagePath = join(tmp, 'actions.html');
writeFileSync(pagePath, html);
const { chromium } = await import(pathToFileURL(join(root, 'node_modules/playwright/index.mjs')).href);
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1400, height: 1040 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
await page.goto('file://' + pagePath);
const report = await page.evaluate('window.__report');
await page.screenshot({ path: shot });
await browser.close();

let pass = true;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `  [${detail}]` : ''}`);
  if (!ok) pass = false;
};
check('pageerrors 0', errors.length === 0, errors.join(' | ').slice(0, 300));
const wrong = report.filter((r) => !r.actual.split(',').map((s) => s.trim()).includes(r.expected));
check('all 35 action states select their authored animation', wrong.length === 0,
  wrong.map((r) => `${r.family}/${r.name}:${r.actual}`).join(' | ').slice(0, 500));
for (const family of ['CATCH', 'MOVE', 'CARRIER', 'SHED']) {
  const unique = new Set(report.filter((r) => r.family === family).map((r) => r.actual));
  check(`${family.toLowerCase()} states remain visually distinct`, unique.size === report.filter((r) => r.family === family).length, `unique=${unique.size}`);
}
console.log(`shot: ${shot}`);
process.exit(pass ? 0 : 1);
