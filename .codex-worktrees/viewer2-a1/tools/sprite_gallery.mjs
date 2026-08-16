// Sprite gallery + motion probe for the watch-viewer player model.
//
//   node tools/sprite_gallery.mjs [--shot1 out1.png] [--shot2 out2.png]
//
// Renders a grid of sprites (facings x poses, offense/defense/QB) inside a
// #watch-board svg with the real style.css, then drives spriteMotionTick()
// on a moving row and asserts:
//   - facing classes land where velocity points (e/w/n/s, backpedal hold)
//   - the leg odometer alternates fA/fB with distance covered
//   - a standing man goes wsp-still (and a moving one doesn't)
// Takes two screenshots ~0.5s apart so a human can eyeball frame change.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const shot1 = argOf('--shot1', join(root, '_gallery1.png'));
const shot2 = argOf('--shot2', join(root, '_gallery2.png'));

// Bundle the sprite module into an IIFE the page can use.
const tmp = mkdtempSync(join(tmpdir(), 'wspgal-'));
const entry = join(tmp, 'entry.js');
writeFileSync(entry, `import { spriteMarkup, spriteMotionTick, wspPlace } from ${JSON.stringify(join(root, 'js/ui/sprite.js').replace(/\\/g, '/'))};
window.__sprite = { spriteMarkup, spriteMotionTick, wspPlace };`);
const bundle = join(tmp, 'bundle.js');
try {
  const esbuildBin = process.platform === 'win32'
    ? join(root, 'node_modules/@esbuild/win32-x64/esbuild.exe')
    : join(root, 'node_modules/esbuild/bin/esbuild');
  execSync(`${JSON.stringify(esbuildBin)} ${JSON.stringify(entry)} --bundle --format=iife --outfile=${JSON.stringify(bundle)}`, { stdio: 'pipe' });
} catch (e) {
  console.error(String(e.stdout || '') + String(e.stderr || ''));
  process.exit(1);
}
const css = readFileSync(join(root, 'style.css'), 'utf8');
const js = readFileSync(bundle, 'utf8');

const html = `<!doctype html><meta charset="utf-8"><style>${css}
html,body { background:#123312; margin:0; }
#watch-board { width:1280px; height:720px; display:block; }
.gal-lbl { fill:#fff; font-size:2px; text-anchor:middle; font-family:monospace; }
</style>
<svg id="watch-board" class="watch-sprites watch-in-play" viewBox="0 0 160 90"></svg>
<script>${js}<\/script>
<script>
const { spriteMarkup, spriteMotionTick, wspPlace } = window.__sprite;
const svg = document.getElementById('watch-board');
svg.style.setProperty('--wsp-off', '#e8e2d0');
svg.style.setProperty('--wsp-off-hl', '#ffd34d');
svg.style.setProperty('--wsp-def', '#c23a35');
svg.style.setProperty('--wsp-def-hl', '#f4f0d8');
const FACES = ['e','w','s','n'];
const STATES = [
  ['run', ''], ['idle', 'wsp-still'], ['carry', 'wp-near-ball'], ['block', 'wp-blocking'],
  ['throw', 'wp-throwing'], ['catch', 'wp-catching'], ['tackle', 'wp-tackling'], ['stiff', 'wp-moving wp-mv-stiff']
];
let out = '';
STATES.forEach(([name, cls], col) => {
  FACES.forEach((f, row) => {
    const teams = name === 'tackle' ? ['def'] : name === 'throw' ? ['off'] : ['off', 'def'];
    teams.forEach((team, k) => {
      const x = 10 + col * 19 + k * 8, y = 12 + row * 20;
      const a = { id: name + f + team, team, label: team === 'off' ? '84' : 'CB', qb: name === 'throw' };
      out += '<g class="wp-actor wp-team-' + team + (a.qb ? ' wp-qb' : '') + ' wsp-face-' + f + ' ' + cls +
        '" data-gal="' + name + '-' + f + '-' + team + '" transform="translate(' + x + ',' + y + ') scale(1.6)">' +
        spriteMarkup(a, f) + '</g>';
      if (row === 0 && k === 0) out += '<text class="gal-lbl" x="' + (x + 4) + '" y="4">' + name + '</text>';
    });
    if (col === 0) out += '<text class="gal-lbl" x="3" y="' + (12 + row * 20) + '">' + f.toUpperCase() + '</text>';
  });
});
// motion row: movers with scripted velocity, driven through wspPlace
const movers = [
  { id: 'M-east',   x: 8,   y: 86, vx: 9,  vy: 0 },     // sprint right -> face-e
  { id: 'M-west',   x: 155, y: 86, vx: -9, vy: 0 },     // def spawn e? no: give fwd w
  { id: 'M-up',     x: 60,  y: 88, vx: 0,  vy: -6 },    // -> face-n (back view)
  { id: 'M-down',   x: 80,  y: 82, vx: 0,  vy: 6 },     // -> face-s (front view)
  { id: 'M-pedal',  x: 100, y: 86, vx: -2.2, vy: 0 },   // slow drift against fwd=e -> hold e
  { id: 'M-stand',  x: 120, y: 86, vx: 0,  vy: 0 }      // -> wsp-still
];
movers.forEach((mv) => {
  const team = mv.id === 'M-west' ? 'def' : 'off';
  const f = team === 'off' ? 'e' : 'w';
  out += '<g class="wp-actor wp-team-' + team + ' wsp-still wsp-face-' + f + '" data-gal="' + mv.id +
    '" transform="translate(' + mv.x + ',' + mv.y + ') scale(1.6)">' +
    spriteMarkup({ id: mv.id, team, label: 'RB' }, f) + '</g>';
});
svg.innerHTML = out + svg.innerHTML.replace(/^/, '');
svg.insertAdjacentHTML('beforeend', '');
// re-grab nodes after innerHTML
const mnodes = {};
movers.forEach((mv) => { mnodes[mv.id] = svg.querySelector('[data-gal="' + mv.id + '"]'); });
const t0 = performance.now();
window.__report = null;
function frame() {
  const t = (performance.now() - t0) / 1000;
  movers.forEach((mv) => {
    const x = mv.x + mv.vx * t, y = mv.y + mv.vy * t;
    const n = mnodes[mv.id];
    n.setAttribute('transform', 'translate(' + x.toFixed(2) + ',' + y.toFixed(2) + ') scale(1.6)');
    spriteMotionTick(n, x, y);
  });
  if (t < 3.4) requestAnimationFrame(frame);
  else {
    const cls = (id) => mnodes[id].getAttribute('class');
    // skeleton scrub: same limb, two phases, must compute different transforms
    const thigh = svg.querySelector('[data-gal="run-e-off"] .wsp-sd-thigh-f');
    const cell = thigh && thigh.closest('.wp-actor');
    let scrub0 = '', scrub5 = '';
    if (cell) {
      cell.style.setProperty('--ph', '0');
      void cell.getBoundingClientRect();
      scrub0 = getComputedStyle(thigh).transform;
      cell.style.setProperty('--ph', '0.5');
      void cell.getBoundingClientRect();
      scrub5 = getComputedStyle(thigh).transform;
    }
    window.__report = {
      east: cls('M-east'), west: cls('M-west'), up: cls('M-up'), down: cls('M-down'),
      pedal: cls('M-pedal'), stand: cls('M-stand'),
      eastLean: mnodes['M-east'].style.getPropertyValue('--wsp-lean'),
      eastPh: mnodes['M-east'].style.getPropertyValue('--ph'),
      scrub0, scrub5,
      stepFlips: window.__stepFlips
    };
  }
}
// count fA/fB flips on the east mover
window.__stepFlips = 0;
let lastStep = false;
const obs = new MutationObserver(() => {
  const s = mnodes['M-east'].classList.contains('wsp-stepB');
  if (s !== lastStep) { lastStep = s; window.__stepFlips++; }
});
requestAnimationFrame(() => { obs.observe(mnodes['M-east'], { attributes: true, attributeFilter: ['class'] }); frame(); });
<\/script>`;

const page = join(tmp, 'gallery.html');
writeFileSync(page, html);

const { chromium } = await import(pathToFileURL(join(root, 'node_modules/playwright/index.mjs')).href);
const exe = process.env.PW_CHROMIUM;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const pg = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errs = [];
pg.on('pageerror', (e) => errs.push(String(e)));
await pg.goto('file://' + page);
await pg.waitForTimeout(1200);
await pg.screenshot({ path: shot1 });
await pg.waitForTimeout(600);
await pg.screenshot({ path: shot2 });
await pg.waitForFunction('window.__report !== null', null, { timeout: 8000 });
const rep = await pg.evaluate('window.__report');
await browser.close();

let pass = true;
const check = (name, ok, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  [' + detail + ']' : '')); if (!ok) pass = false; };
check('pageerrors 0', errs.length === 0, errs.join('; ').slice(0, 200));
check('east sprint faces e', /wsp-face-e/.test(rep.east) && !/wsp-still/.test(rep.east), rep.east);
check('west sprint faces w', /wsp-face-w/.test(rep.west), rep.west);
check('upfield-away faces n (back view)', /wsp-face-n/.test(rep.up), rep.up);
check('toward-camera faces s (front view)', /wsp-face-s/.test(rep.down), rep.down);
check('slow backpedal holds combat facing e', /wsp-face-e/.test(rep.pedal), rep.pedal);
check('standing man is wsp-still', /wsp-still/.test(rep.stand), rep.stand);
check('sprinter leans forward', parseFloat(rep.eastLean) > 4, rep.eastLean);
check('leg odometer alternates (>=8 flips in 3.4s sprint)', (rep.stepFlips | 0) >= 8, 'flips=' + rep.stepFlips);
check('odometer drives --ph', rep.eastPh !== '' && isFinite(parseFloat(rep.eastPh)), 'ph=' + rep.eastPh);
check('skeleton scrub poses thigh (ph 0 vs .5 differ)', !!rep.scrub0 && rep.scrub0 !== 'none' && rep.scrub0 !== rep.scrub5, rep.scrub0.slice(0, 40) + ' vs ' + rep.scrub5.slice(0, 40));
console.log('shots: ' + shot1 + ' , ' + shot2);
process.exit(pass ? 0 : 1);
