// Viewer Act 2 / A3 live DOM gate against the built game.
// Usage: node tools/viewer_secondary_motion_live_probe.mjs <built.html> [shot.png]
import { chromium } from 'playwright';

const target = process.argv[2];
const shot = process.argv[3] || '_a3-secondary-live.png';
if (!target) {
  console.error('usage: node tools/viewer_secondary_motion_live_probe.mjs <built.html> [shot.png]');
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

let cast22 = 0, preSamples = 0, residue = 0, weightedSamples = 0,
  gatherSamples = 0, sprintSamples = 0, headSamples = 0, headOwnedSamples = 0,
  badBounds = 0, doubleHeads = 0;
for (let frame = 0; frame < 520; frame += 1) {
  const s = await page.evaluate(() => {
    const board = document.querySelector('#watch-board');
    const actors = [...(board?.querySelectorAll('[data-wpa]') || [])];
    const a3 = actors.filter((n) => [...n.classList].some((c) => c.startsWith('wp-a3-')));
    const weighted = actors.filter((n) => n.classList.contains('wp-a3-weight'));
    const gather = actors.filter((n) => n.classList.contains('wp-a3-gather'));
    const sprint = actors.filter((n) => n.classList.contains('wp-a3-sprint'));
    const heads = actors.filter((n) => n.classList.contains('wp-a3-head-left') || n.classList.contains('wp-a3-head-right'));
    const ball = board?.querySelector('#wp-ball');
    return {
      cast: actors.length,
      pre: board?.classList.contains('watch-presnap') || false,
      residue: board?.classList.contains('watch-presnap') ? a3.length : 0,
      weighted: weighted.map((n) => ({
        scale: Number.parseFloat(n.style.getPropertyValue('--a3-shadow-scale')),
        opacity: Number.parseFloat(n.style.getPropertyValue('--a3-shadow-opacity')),
        skew: Number.parseFloat(n.style.getPropertyValue('--a3-shadow-skew'))
      })),
      gather: gather.length,
      sprint: sprint.length,
      heads: heads.map((n) => ({
        id: n.dataset.wpa || '',
        count: Number(n.classList.contains('wp-a3-head-left')) + Number(n.classList.contains('wp-a3-head-right'))
      })),
      possess: ball?.dataset.possess || ''
    };
  });
  if (s.cast === 22) cast22++;
  if (s.pre) { preSamples++; residue += s.residue; }
  weightedSamples += s.weighted.length;
  gatherSamples += s.gather;
  sprintSamples += s.sprint;
  for (const w of s.weighted) {
    if (!Number.isFinite(w.scale) || w.scale < 1 || w.scale > 1.28 ||
        !Number.isFinite(w.opacity) || w.opacity < .72 || w.opacity > .92 ||
        !Number.isFinite(w.skew) || w.skew < -9 || w.skew > 9) badBounds++;
  }
  for (const h of s.heads) {
    headSamples++;
    if (h.count !== 1) doubleHeads++;
    if (s.possess && h.id === s.possess) headOwnedSamples++;
  }
  if (frame === 260) await page.screenshot({ path: shot });
  if (frame > 380 && preSamples > 15 && weightedSamples > 200 && gatherSamples > 0 && sprintSamples > 0 && headOwnedSamples > 0) break;
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
check('live law samples the full 22-man cast', cast22 > 40, `frames=${cast22}`);
check('A3 state never leaks into a fresh play', preSamples > 15 && residue === 0, `pre=${preSamples} residue=${residue}`);
check('live movers receive bounded shadow weight', weightedSamples > 200 && badBounds === 0,
  `samples=${weightedSamples} bad=${badBounds}`);
check('live play exposes gather and top-speed accents', gatherSamples > 0 && sprintSamples > 0,
  `gather=${gatherSamples} sprint=${sprintSamples}`);
check('pursuit head-check belongs only to the live ball carrier',
  headOwnedSamples > 0 && headOwnedSamples === headSamples && doubleHeads === 0,
  `heads=${headSamples} owned=${headOwnedSamples} double=${doubleHeads}`);
console.log(`shot: ${shot}`);
process.exit(pass ? 0 : 1);
