// _pagedet.mjs — IS THE SEEDED PAGE PLAYING THE SAME GAME TWICE?
//
// The evidence behind the 2026-08-21 page-side seeding of qb_live_probe and
// watch_live_probe. Counting green runs proves nothing (watch_live was already
// 3-for-3 clean on the run before it failed), so this boots the built bundle
// TWICE at the same seed and diffs what the broadcast actually says — teams,
// formation, play call, yardage, clock — sampled eight times through the first
// drive.
//
// Result at the time of writing: identical, down to "t. Richardson picks up 8"
// at the same game clock. A different seed (7) yields a completely different
// matchup and is likewise identical to itself.
//
// Usage: node tools/_pagedet.mjs <ABSOLUTE dist/index.html> [seed]
import { chromium } from 'playwright';
import { pinPageRandom } from './_seed.mjs';
const dist = process.argv[2];
const seed = Number(process.argv[3] || 20260821);
const b = await chromium.launch();
async function fingerprint() {
  const p = await b.newPage({ viewport: { width: 1180, height: 820 } });
  await pinPageRandom(p, seed);
  await p.goto('file://' + dist, { waitUntil: 'load' });
  await p.waitForTimeout(900);
  await p.click('#btn-mm-playnow', { timeout: 15000 });
  await p.waitForTimeout(400);
  await p.click('[data-pn-mode="watch"]');
  await p.waitForTimeout(200);
  await p.click('#pn-start');
  await p.waitForSelector('#watch-board', { timeout: 20000 });
  // let a stretch of real football happen, then read what the broadcast says
  const marks = [];
  for (let i = 0; i < 8; i++) {
    await p.waitForTimeout(1500);
    marks.push(await p.evaluate(() => {
      const board = document.querySelector('#watch-board');
      const host = board?.closest('.modal, body') || document.body;
      return (host.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 220);
    }));
  }
  await p.close();
  return marks.join('\n');
}
const a = await fingerprint();
const c = await fingerprint();
await b.close();
console.log('run A:\n' + a);
console.log('\nrun B:\n' + c);
console.log('\nIDENTICAL: ' + (a === c));
