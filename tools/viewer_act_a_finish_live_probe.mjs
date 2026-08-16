// Viewer Act 2 / A4+A5 live DOM law.
// Usage: node tools/viewer_act_a_finish_live_probe.mjs <built.html> [shot.png]
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';

const target = process.argv[2], shot = process.argv[3] || '_act-a-finish-live.png';
if (!target) { console.error('usage: node tools/viewer_act_a_finish_live_probe.mjs <built.html> [shot.png]'); process.exit(1); }
const root = dirname(target);
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const body = await readFile(join(root, rel));
    res.writeHead(200, { 'content-type': mime[extname(rel)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((resolve) => server.listen(0, resolve));
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(800);
await page.click('#btn-mm-playnow');
await page.waitForTimeout(400);
await page.click('[data-pn-mode="watch"]');
await page.click('#pn-start');
await page.waitForSelector('#watch-board', { timeout: 20_000 });

let castFrames = 0, bodyBad = 0, pre = 0, residue = 0, switchSamples = 0, switchBad = 0;
const bodyBadExamples = [];
const kinds = new Set();
for (let frame = 0; frame < 760; frame++) {
  const s = await page.evaluate(() => {
    const board = document.querySelector('#watch-board');
    const actors = [...(board?.querySelectorAll('[data-wpa]') || [])];
    const bodies = actors.map((n) => {
      const w = n.querySelector('.wsp');
      const frames = [...(w?.classList || [])].filter((c) => c.startsWith('wsp-frame-'));
      return { id: n.dataset.wpa || '', frames, stride: Number.parseFloat(w?.dataset.wspStride || ''), lean: Number.parseFloat(w?.dataset.wspLeanScale || ''), wrapper: !!w?.querySelector('.wsp-identity-body') };
    });
    const switches = actors.filter((n) => n.classList.contains('wp-arm-switching')).map((n) => ({
      id: n.dataset.wpa || '', arms: ['left','right'].filter((a) => n.classList.contains('wp-carry-arm-' + a))
    }));
    const ball = board?.querySelector('#wp-ball');
    return { cast: actors.length, boardClass: board?.getAttribute('class') || '',
      scrimmage: !board?.classList.contains('watch-special-teams'),
      pre: board?.classList.contains('watch-presnap') || false, bodies, switches,
      possess: ball?.dataset.possess || '', arm: ball?.dataset.arm || '' };
  });
  // A5 is roster identity on the scrimmage field. M18 special-teams boards
  // intentionally field synthetic role actors (KO0/KB0/etc.), not roster
  // slot ids, and retain their separate full-unit animation contract.
  if (s.scrimmage && s.cast === 22) castFrames++;
  if (s.scrimmage && s.cast === 22) for (const b of s.bodies) {
    for (const k of b.frames) kinds.add(k);
    if (b.frames.length !== 1 || b.frames[0] === 'wsp-frame-legacy' || !b.wrapper || !Number.isFinite(b.stride) || b.stride < .76 || b.stride > 1.08 || !Number.isFinite(b.lean) || b.lean < .72 || b.lean > 1.12) {
      bodyBad++;
      if (bodyBadExamples.length < 8) bodyBadExamples.push({ id:b.id, frames:b.frames, board:s.boardClass });
    }
  }
  if (s.pre) { pre++; residue += s.switches.length; }
  for (const sw of s.switches) {
    switchSamples++;
    if (sw.arms.length !== 1 || !s.possess || sw.id !== s.possess || !['left','right'].includes(s.arm)) switchBad++;
  }
  if (frame === 380) await page.screenshot({ path: shot });
  if (frame > 440 && castFrames > 100 && kinds.size >= 3 && switchSamples > 0 && pre > 15) break;
  await page.waitForTimeout(80);
}
await page.screenshot({ path: shot });
await browser.close();
await new Promise((resolve) => server.close(resolve));

let pass = true;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `  [${detail}]` : ''}`); if (!ok) pass = false; };
check('pageerrors 0', errors.length === 0, errors.join(' | ').slice(0, 260));
check('A5 samples the full 22-man cast with bounded real-frame identity', castFrames > 100 && bodyBad === 0,
  `castFrames=${castFrames} bad=${bodyBad}${bodyBadExamples.length ? ` examples=${JSON.stringify(bodyBadExamples)}` : ''}`);
check('live roster exposes at least three visibly distinct frame families', kinds.size >= 3, `kinds=[${[...kinds].join(',')}]`);
check('A4 outside-arm exchange stays on the live ball carrier', switchSamples > 0 && switchBad === 0,
  `samples=${switchSamples} bad=${switchBad}`);
check('arm-switch state never leaks into pre-snap', pre > 15 && residue === 0, `pre=${pre} residue=${residue}`);
console.log(`shot: ${shot}`);
process.exit(pass ? 0 : 1);
