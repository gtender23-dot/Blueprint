// Viewer Act B live gate: save a real simulated play, hand it through the Film
// Room hook, and exercise the broadcast/replay/export controls against the
// built app. Usage: node tools/viewer_act_b_probe.mjs <built.html>
import { chromium } from 'playwright';
import { buildBroadcastCommentary } from '../js/ui/watchphys.js';

const target = process.argv[2];
const shot = process.argv[3] || null;
if (!target) { console.error('usage: node tools/viewer_act_b_probe.mjs <built.html>'); process.exit(1); }
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
await page.addInitScript(() => {
  let seed = 0x41c7b22d;
  Math.random = () => {
    seed = Math.imul(seed, 1664525) + 1013904223 >>> 0;
    return seed / 4294967296;
  };
});
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
let pass = 0, fail = 0;
const check = (ok, label, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? `  [${detail}]` : ''}`);
  if (ok) pass++; else fail++;
};

const traceCases = [
  [{ type: 'pass_short', sack: true, blitzFired: true }, 'PASS RUSH'],
  [{ type: 'pass_deep', turnover: true, turnoverType: 'interception', trace: { rob: 1 } }, 'ROBBER'],
  [{ type: 'pass_short', fooled: true, shownCoverage: 'Cover 2', coverage: 'Cover 3' }, 'DISGUISE'],
  [{ type: 'pass_short', complete: true, trace: { vd: 1 } }, 'COVERAGE VOID'],
  [{ type: 'pass_short', complete: false, trace: { ct: 'zone' } }, 'COVERAGE'],
  [{ type: 'run_inside', yards: -1, runGap: 'A-gap' }, 'RUN FIT']
];
for (const [play, expected] of traceCases) {
  const row = buildBroadcastCommentary(play, {});
  check(row.kicker === expected && row.title && row.detail, `recorded ${expected.toLowerCase()} stamp maps to truthful football language`);
}

await page.goto('file://' + target, { waitUntil: 'load' });
await page.waitForTimeout(700);
check(await page.evaluate(() => typeof window.__playReplayClip === 'function'), 'Film Room playback hook registered');
await page.click('#btn-mm-playnow');
await page.waitForTimeout(350);
await page.click('[data-pn-mode="watch"]');
await page.click('#pn-start');
await page.waitForSelector('#watch-board [data-wpa]', { timeout: 25_000 });
await page.waitForSelector('#watch-save-clip', { timeout: 5_000 });
// [2026-08-16] The scrub check below needs MOTION, and a penalty whistle clip
// is dead-ball BY DESIGN (the Act B contract: a flag play asserts nothing),
// so identical scrub frames on one are correct behavior. Which play is active
// when the save button first appears depends on the pinned seed's roll
// stream, which shifts with every engine change — the old single blind click
// started landing on a flag (first seen cloud-side 2026-08-15, then locally).
// Save-with-retry until the clip holds a scrimmage snap.
let savedType = null;
for (let tries = 0; tries < 14 && !savedType; tries++) {
  await page.click('#watch-save-clip');
  await page.waitForTimeout(250);
  savedType = await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('cfb-replays') || '[]');
    const data = rows.length ? rows[rows.length - 1].data : null;
    const p = data && data.game && data.game.drives && data.game.drives[0] && data.game.drives[0].plays[0];
    if (p && /^(pass|run)/.test(String(p.type || ''))) return p.type;
    localStorage.removeItem('cfb-replays');
    localStorage.removeItem('cfb-replays.bak1');
    localStorage.removeItem('cfb-replays.bak2');
    return null;
  });
  if (!savedType) await page.waitForTimeout(1200);
}
check(!!savedType, 'saved clip captured a scrimmage snap (motion for the scrub check)', String(savedType));

const saved = await page.evaluate(() => {
  const rows = JSON.parse(localStorage.getItem('cfb-replays') || '[]');
  const data = rows[0] && rows[0].data;
  return {
    count: rows.length,
    kind: data && data.kind,
    version: data && data.version,
    drives: data && data.game && data.game.drives && data.game.drives.length,
    plays: data && data.game && data.game.drives && data.game.drives[0] && data.game.drives[0].plays.length,
    bytes: data ? JSON.stringify(data).length : 0
  };
});
check(saved.count === 1 && saved.kind === 'blueprint-viewer-replay' && saved.version === 2, 'real play saves as Viewer replay v2', JSON.stringify(saved));
check(saved.drives === 1 && saved.plays === 1 && saved.bytes > 500 && saved.bytes < 240_000, 'clip is compact recorded-play data, not frame spam', `${saved.bytes} bytes`);

await page.evaluate(() => {
  const data = JSON.parse(localStorage.getItem('cfb-replays'))[0].data;
  window.__playReplayClip(data);
});
await page.waitForSelector('.replay-screen #watch-board [data-wpa]', { timeout: 10_000 });
await page.waitForSelector('#watch-replay-tools.on', { timeout: 5_000 });
check(await page.locator('#watch-analysis b').count() === 1, 'trace-driven broadcast analysis mounted');
const analysisText = (await page.locator('#watch-analysis').innerText()).trim();
check(analysisText.length > 12 && !/\b(?:sep|dbl|vd|ct|rob)\s*[:=]/i.test(analysisText), 'analysis uses football language, not raw trace fields', analysisText.slice(0, 140));

await page.click('#replay-play');
const scrub = page.locator('#replay-scrub');
const frameSignature = () => page.evaluate(() => [...document.querySelectorAll('#watch-board [data-wpa], #watch-board #wp-ball')].map((el) => el.getAttribute('transform') || '').join('|'));
await scrub.evaluate((el) => { el.value = '120'; el.dispatchEvent(new Event('input', { bubbles: true })); });
await page.waitForTimeout(150);
const before = await frameSignature();
await scrub.evaluate((el) => { el.value = '820'; el.dispatchEvent(new Event('input', { bubbles: true })); });
await page.waitForTimeout(150);
const after = await frameSignature();
check(before !== after, 'scrubber rerenders a deterministic play frame', `${before.slice(0, 70)} -> ${after.slice(0, 70)}`);
await page.click('#replay-rate');
check((await page.locator('#replay-rate').innerText()).includes('½'), 'slow-motion control cycles to half speed');

await page.click('#replay-camera');
await page.waitForTimeout(120);
const cam = await page.evaluate(() => ({ label: document.querySelector('#replay-camera')?.textContent, vb: document.querySelector('#watch-board')?.getAttribute('viewBox') }));
check(cam.label === 'All-22' && /\s100(?:\.00)?\s56(?:\.00)?$/.test(cam.vb || ''), 'All-22 camera exposes the full field', `${cam.label} ${cam.vb}`);

await page.locator('#watch-board [data-wpa]').first().evaluate((el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
check(await page.locator('#watch-player-pop.on b').count() === 1, 'clicking an actor opens a player card');

await page.click('#replay-ink');
const ink = page.locator('#watch-ink');
const box = await ink.boundingBox();
if (box) {
  await page.mouse.move(box.x + box.width * .32, box.y + box.height * .38);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .48, box.y + box.height * .52, { steps: 6 });
  await page.mouse.up();
}
check(await page.locator('#watch-ink polyline').count() === 1, 'paused telestrator records a stroke');
const stillDownload = page.waitForEvent('download', { timeout: 10_000 });
await page.click('#replay-still');
const still = await stillDownload;
check(/\.svg$/i.test(still.suggestedFilename()), 'annotated still exports as portable SVG', still.suggestedFilename());

await page.click('#replay-save');
await page.waitForTimeout(180);
const annotationSaved = await page.evaluate(() => {
  const rows = JSON.parse(localStorage.getItem('cfb-replays') || '[]');
  return rows.some((r) => r.data && Array.isArray(r.data.annotations) && r.data.annotations.length === 1);
});
check(annotationSaved, 'Film Room save carries camera and telestrator data');
if (shot) await page.screenshot({ path: shot, fullPage: true });
const videoReady = await page.locator('#replay-video').count() === 1 && await page.evaluate(() => typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream);
check(videoReady, 'short-video export path is available');
if (videoReady) {
  try {
    const videoDownload = page.waitForEvent('download', { timeout: 60_000 });
    await page.click('#replay-video');
    const video = await videoDownload;
    const stream = await video.createReadStream();
    let videoBytes = 0;
    if (stream) for await (const chunk of stream) videoBytes += chunk.length;
    check(/\.webm$/i.test(video.suggestedFilename()) && videoBytes > 2_000, 'deterministic replay rerun exports a non-empty WebM', `${video.suggestedFilename()} ${videoBytes} bytes`);
  } catch (error) {
    check(false, 'deterministic replay rerun exports a non-empty WebM', String(error).split('\n')[0]);
  }
}
await page.setViewportSize({ width: 460, height: 900 });
await page.waitForTimeout(180);
const phone = await page.evaluate(() => {
  const tools = document.querySelector('#watch-replay-tools')?.getBoundingClientRect();
  return { inner: innerWidth, scroll: document.documentElement.scrollWidth, tools: tools && { left: tools.left, right: tools.right, width: tools.width } };
});
check(phone.scroll <= phone.inner + 2 && phone.tools && phone.tools.left >= -1 && phone.tools.right <= phone.inner + 1, 'phone replay tools stay inside the viewport', JSON.stringify(phone));
if (shot) await page.screenshot({ path: shot.replace(/\.png$/i, '-phone.png'), fullPage: true });
check(errors.length === 0, 'zero page errors', errors.slice(0, 3).join(' | '));

console.log(`VIEWER ACT B PROBE — ${pass} pass, ${fail} fail`);
await browser.close();
process.exit(fail ? 1 : 0);
