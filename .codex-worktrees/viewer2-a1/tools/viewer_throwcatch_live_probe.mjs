// Viewer Act 2 / A2 live DOM gate against the built game.
// Usage: node tools/viewer_throwcatch_live_probe.mjs <built.html> [shot.png]
import { chromium } from 'playwright';

const target = process.argv[2];
const shot = process.argv[3] || '_a2-throwcatch-live.png';
if (!target) {
  console.error('usage: node tools/viewer_throwcatch_live_probe.mjs <built.html> [shot.png]');
  process.exit(1);
}

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
await page.goto('file://' + target, { waitUntil: 'load' });
await page.waitForTimeout(800);
await page.click('#btn-mm-playnow');
await page.waitForTimeout(400);
await page.click('[data-pn-mode="watch"]');
await page.click('#pn-start');
await page.waitForSelector('#watch-board', { timeout: 20_000 });

let preSamples = 0, residue = 0, catchSamples = 0, catchBad = 0,
  throwSamples = 0, throwBad = 0, trenchSamples = 0, trenchBad = 0, maxCatchGap = 0;
const catchStyles = new Set(), throwStyles = new Set(), blockerStyles = new Set(), rusherStyles = new Set();
const catchGapByStyle = new Map();

for (let frame = 0; frame < 520; frame += 1) {
  const s = await page.evaluate(() => {
    const board = document.querySelector('#watch-board');
    const actors = [...(board?.querySelectorAll('[data-wpa]') || [])];
    const pref = (node, prefix) => [...(node?.classList || [])].filter((c) => c.startsWith(prefix));
    const catches = actors.filter((n) => n.classList.contains('wp-catching')).map((n) => ({
      styles: pref(n, 'wp-catch-style-'),
      pt: /translate\(([-\d.]+),([-\d.]+)\)/.exec(n.getAttribute('transform') || '')?.slice(1).map(Number) || null
    }));
    const qb = board?.querySelector('[data-wpa="QB"]');
    const throws = qb?.classList.contains('wp-throwing') ? pref(qb, 'wp-qb-throw-') : [];
    const blockers = actors.filter((n) => n.classList.contains('wp-pass-set')).flatMap((n) => pref(n, 'wp-trench-').filter((c) => !c.startsWith('wp-trench-rusher-')));
    const rushers = actors.filter((n) => n.classList.contains('wp-pass-engaged')).flatMap((n) => pref(n, 'wp-trench-rusher-'));
    const ball = board?.querySelector('#wp-ball');
    const ballPt = /translate\(([-\d.]+),([-\d.]+)\)/.exec(ball?.getAttribute('transform') || '')?.slice(1).map(Number) || null;
    const pre = board?.classList.contains('watch-presnap') || false;
    const preResidue = pre ? actors.flatMap((n) => [
      ...pref(n, 'wp-catch-style-'), ...pref(n, 'wp-qb-throw-'),
      ...pref(n, 'wp-trench-rusher-'),
      ...pref(n, 'wp-trench-').filter((c) => !c.startsWith('wp-trench-rusher-'))
    ]) : [];
    return { pre, preResidue, catches, throws, blockers, rushers, ballPt,
      ballCarried: ball?.classList.contains('wp-ball-carried') || false };
  });
  if (s.pre) { preSamples++; residue += s.preResidue.length; }
  for (const c of s.catches) {
    catchSamples++;
    if (c.styles.length !== 1) catchBad++;
    for (const st of c.styles) catchStyles.add(st);
    // A breakup pose intentionally finishes after the M21 deflection has sent
    // the loose ball away. Secured catches stay attached throughout the pose.
    if (!c.styles.includes('wp-catch-style-breakup') && s.ballCarried && c.pt && s.ballPt) {
      const gap = Math.hypot(c.pt[0] - s.ballPt[0], c.pt[1] - s.ballPt[1]);
      maxCatchGap = Math.max(maxCatchGap, gap);
      const style = c.styles[0] || 'none';
      catchGapByStyle.set(style, Math.max(catchGapByStyle.get(style) || 0, gap));
      if (gap > 4.4) catchBad++;
    }
  }
  if (s.throws.length) {
    throwSamples++;
    if (s.throws.length !== 1) throwBad++;
    for (const st of s.throws) throwStyles.add(st);
  }
  if (s.blockers.length || s.rushers.length) {
    trenchSamples++;
    if (!s.blockers.length || !s.rushers.length) trenchBad++;
    for (const st of s.blockers) blockerStyles.add(st);
    for (const st of s.rushers) rusherStyles.add(st);
  }
  if (frame === 260) await page.screenshot({ path: shot });
  if (frame > 380 && preSamples > 20 && catchSamples > 0 && throwSamples > 0 && trenchSamples > 0) break;
  await page.waitForTimeout(80);
}
await page.screenshot({ path: shot });
await browser.close();

let pass = true;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `  [${detail}]` : ''}`);
  if (!ok) pass = false;
};
check('pageerrors 0', errors.length === 0, errors.join(' | ').slice(0, 260));
check('A2 state never leaks into a fresh play', preSamples > 15 && residue === 0, `pre=${preSamples} residue=${residue}`);
check('live catch owns exactly one style and stays attached to the ball', catchSamples > 0 && catchBad === 0,
  `samples=${catchSamples} bad=${catchBad} maxGap=${maxCatchGap.toFixed(2)} byStyle=[${[...catchGapByStyle].map(([k,v]) => `${k}:${v.toFixed(2)}`).join(',')}] styles=[${[...catchStyles].join(',')}]`);
check('live QB release owns exactly one lawful style', throwSamples > 0 && throwBad === 0,
  `samples=${throwSamples} bad=${throwBad} styles=[${[...throwStyles].join(',')}]`);
check('live pass rush pairs blocker and rusher silhouettes', trenchSamples > 0 && trenchBad === 0,
  `samples=${trenchSamples} bad=${trenchBad} blockers=[${[...blockerStyles].join(',')}] rushers=[${[...rusherStyles].join(',')}]`);
console.log(`shot: ${shot}`);
process.exit(pass ? 0 : 1);
