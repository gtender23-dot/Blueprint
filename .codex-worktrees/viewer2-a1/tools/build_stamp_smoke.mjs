// build_stamp_smoke.mjs — the build stamp must be able to CATCH a stale build.
// Usage: node tools/build_stamp_smoke.mjs <path-to-dist>
//
// The on-screen id alone can never do this: it is printed by the bundle that is
// running, so a stale build prints its own id and looks perfectly consistent.
// The independent witness is the service worker's Cache Storage key, named for
// the build that INSTALLED it. This smoke serves dist/ over http (localhost is
// a secure context, so a worker really registers — file:// cannot) and proves
// both directions:
//
//   1. HEALTHY: worker installed, its cache is this build → stamp is quiet, and
//      the id on screen equals the cache name on disk. No false alarm.
//   2. STALE: plant a cache key from another build (the exact shape of the
//      symptom reported in review — page on one build, cache on another) →
//      the footer names the foreign build and flags it.
//   3. NO WORKER AT ALL (no cache keys) → still quiet. Nothing to compare is
//      never reported as a problem.
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';

const DIST = process.argv[2];
if (!DIST || !existsSync(join(DIST, 'index.html'))) {
  console.error('usage: node tools/build_stamp_smoke.mjs <path-to-dist>');
  process.exit(1);
}
const FOREIGN = 'c219379683';   // a build id that is not this one
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? '✅' : '❌'} ${msg}`); if (!ok) fails++; };

// The id this build actually shipped, read from the two artifacts a device downloads.
const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const swTxt = readFileSync(join(DIST, 'sw.js'), 'utf8');
const htmlId = (html.match(/globalThis\.__BUILD__ = "([0-9a-f]+)"/) || [])[1] || null;
const swId = (swTxt.match(/const CACHE = 'cfb-dynasty-([^']+)'/) || [])[1] || null;
check(!!htmlId && htmlId === swId, `shipped artifacts agree (index.html ${htmlId} · sw.js ${swId})`);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const server = createServer((req, res) => {
  const rel = (req.url || '/').split('?')[0].replace(/^\/+/, '') || 'index.html';
  const file = join(DIST, rel);
  if (!existsSync(file) || rel.includes('..')) { res.writeHead(404); res.end('nope'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await b.newPage({ viewport: { width: 460, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.split('\n')[0]));

const stamp = () => page.locator('.mm-build').first().textContent();
const staleCount = () => page.locator('.mm-build-stale').count();

// ── 3. no worker yet: the very first paint has no cache keys to compare ──
await page.goto(base, { waitUntil: 'load' });
await page.waitForSelector('.mm-build', { timeout: 20000 });
check((await stamp() || '').includes(htmlId), `stamp prints the running build (${htmlId})`);
check(await staleCount() === 0, 'no cache keys yet → no warning (never a false alarm)');

// ── 1. healthy: let the worker install, then reload into it ──
await page.evaluate(() => navigator.serviceWorker.ready).catch(() => {});
await page.waitForTimeout(800);
const keys = await page.evaluate(() => caches.keys());
check(keys.includes(`cfb-dynasty-${htmlId}`), `worker installed this build's cache (${keys.join(', ') || 'none'})`);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.mm-build', { timeout: 20000 });
await page.waitForTimeout(600);
check(await staleCount() === 0, 'worker cache matches the running build → stamp stays quiet');

// ── 2. stale: plant a foreign build's cache, exactly the reported symptom ──
await page.evaluate((k) => caches.open(k), `cfb-dynasty-${FOREIGN}`);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.mm-build', { timeout: 20000 });
await page.waitForTimeout(900);
const warned = await staleCount();
const txt = (await stamp()) || '';
check(warned > 0, 'a foreign build cache IS reported (the stamp can now catch staleness)');
check(txt.includes(FOREIGN), `the warning names the foreign build — "${txt.trim()}"`);
check(txt.includes(htmlId), 'the running build is still shown alongside it');

check(errs.length === 0, `zero page errors${errs.length ? ' — got: ' + errs.slice(0, 3).join(' | ') : ''}`);
await b.close();
server.close();
console.log(fails ? `\n❌ ${fails} FAILED` : '\n✅ BUILD STAMP SMOKE PASS');
process.exit(fails ? 1 : 0);
