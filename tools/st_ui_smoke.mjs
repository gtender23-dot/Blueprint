// st_ui_smoke.mjs — PASS 6 UI smoke: the Special Teams tab's new rows.
// Wizard to a live dynasty, Game Plan › Special Teams: the Return Scheme row
// renders (Safe Hands / Balanced / Set the Wall), a pick sticks and survives a
// tab round-trip, and the rewritten Fakes tip copy (real-fake language) is in.
// Usage: node tools/st_ui_smoke.mjs <path-to-dist/index.html>
import { chromium } from 'playwright';

const target = process.argv[2];
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await b.newPage({ viewport: { width: 460, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? '✅' : '❌'} ${msg}`); if (!ok) fails++; };
const click = async (sel) => {
  const loc = page.locator(sel).first();
  await loc.click({ timeout: 4000 }).catch(async () => { await loc.dispatchEvent('click'); });
  await page.waitForTimeout(450);
};

await page.goto('file://' + target, { waitUntil: 'load' });
await page.waitForTimeout(1500);

for (const s of [
  ['#btn-mm-newtree'], ['fill', '#mm-nt-first', 'Smoke'], ['fill', '#mm-nt-last', 'Test'],
  ['#mm-nt-create'], ['[data-ob-gpmode="advanced"]'], ['#ob-next-0'],
  ['[data-ob-state="AL"]'], ['[data-ob-school]:not([data-ob-school="__found__"])'], ['#ob-next-2'],
  ['[data-ob-qb="QB-Pocket"]'], ['[data-ob-front="4-3"]'], ['#ob-next-3'],
  ['[data-ob-staff^="OC:"]'], ['[data-ob-staff^="DC:"]'], ['#ob-next-4'], ['#ob-start'],
]) {
  if (s[0] === 'fill') await page.locator(s[1]).first().fill(s[2]);
  else await page.locator(s[0]).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(600);
}
await page.waitForTimeout(2500);
check(await page.locator('[data-nav="gameplan"]').count() > 0, 'dynasty is live');

await click('[data-nav="gameplan"]');
await click('[data-gpsection="st"]');
check(await page.locator('[data-gp-set="retScheme"]').count() === 3, 'Return Scheme row renders (3 options)');
check((await page.locator('.gp-tip', { hasText: 'the REAL thing' }).count()) >= 1, 'Fakes tip carries the Pass-6 real-fake copy');
// balanced is the default
check(await page.locator('[data-gp-set="retScheme"][data-gp-val="balanced"].active').count() === 1, 'Balanced is the default');
await click('[data-gp-set="retScheme"][data-gp-val="wall"]');
check(await page.locator('[data-gp-set="retScheme"][data-gp-val="wall"].active').count() === 1, 'Set the Wall sticks');
// round-trip through another tab and back
await click('[data-gpsection="offense"]');
await click('[data-gpsection="st"]');
check(await page.locator('[data-gp-set="retScheme"][data-gp-val="wall"].active').count() === 1, 'pick survives a tab round-trip');
check(errs.length === 0, `0 pageerrors (${errs.length ? errs.join(' | ') : 'clean'})`);

console.log(fails ? `\nST UI SMOKE: ${fails} FAIL` : '\nST UI SMOKE PASS');
await b.close();
process.exit(fails ? 1 : 0);
