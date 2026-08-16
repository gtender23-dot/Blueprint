// Madden pass 2 (Aug 2026) UI smoke: the per-formation playbook EDITOR.
// Drives the new-game wizard to a live dynasty (same script as _equiv_walk),
// opens Game Plan → Offense → Playbook, then: formation chips render → picking
// one shows that formation's sheet → moving a slider authors an override (pill
// + count appear) → the inherit pill clears it → reset clears the whole sheet.
import { chromium } from 'playwright';
const target = process.argv[2];
const ACTIONS = [
  ['click', '#btn-mm-newtree'], ['fill', '#mm-nt-first', 'Garrett'], ['fill', '#mm-nt-last', 'Tender'],
  ['click', '#mm-nt-create'],
];
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await b.newPage({ viewport: { width: 460, height: 1400 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? '✅' : '❌'} ${msg}`); if (!ok) fails++; };

await page.goto('file://' + target, { waitUntil: 'load' });
await page.waitForTimeout(1200);
for (const [kind, sel, arg] of ACTIONS) {
  const loc = page.locator(sel);
  if (!(await loc.count())) { check(false, `wizard control missing: ${sel}`); break; }
  if (kind === 'fill') await loc.first().fill(arg);
  else await loc.first().click({ timeout: 8000 }).catch(() => check(false, `wizard clickfail ${sel}`));
  await page.waitForTimeout(400);
}
await page.waitForTimeout(2000);

// drive whatever onboarding wizard follows, generically: pick, advance, start
for (let i = 0; i < 40; i++) {
  if (await page.locator('[data-nav]').count() > 3) break; // dynasty nav is live
  const start = page.locator('#ob-start');
  if (await start.count()) { await start.first().click().catch(() => {}); await page.waitForTimeout(1800); continue; }
  for (const sel of ['.ob-school-row', '.ob-pick-card', '.ob-chip:not(.active)']) {
    const l = page.locator(sel);
    const n = await l.count();
    if (!n) continue;
    // a step can hold two card groups (identity + front, OC + DC) — first and
    // last covers both; re-clicking a picked card is a harmless re-pick
    await l.first().click().catch(() => {});
    if (n > 1) { await page.waitForTimeout(200); await l.last().click().catch(() => {}); }
    await page.waitForTimeout(250);
    break;
  }
  const next = page.locator('[id^="ob-next-"]:not([disabled])');
  if (await next.count()) await next.last().click().catch(() => {});
  await page.waitForTimeout(500);
}
check(await page.locator('[data-nav]').count() > 3, 'dynasty is live (nav bar up)');

// Simple mode is the default — flip to advanced in Settings first
const navTo = async (view) => {
  const n = page.locator(`[data-nav="${view}"], [data-tabbar="${view}"], [data-view="${view}"], [data-team-tab="${view}"], [data-program-tab="${view}"]`);
  if (await n.count()) { await n.first().dispatchEvent('click'); await page.waitForTimeout(700); return true; }
  return false;
};
check(await navTo('settings'), 'settings nav exists');
const advBtn = page.locator('[data-gpmode="advanced"]');
check(await advBtn.count() > 0, 'Game Plan Detail toggle exists in settings');
await advBtn.first().dispatchEvent('click'); await page.waitForTimeout(500);
check(await navTo('gameplan'), 'game plan nav exists');
const offTab = page.locator('[data-gpsection="offense"]');
if (await offTab.count()) { await offTab.first().dispatchEvent('click'); await page.waitForTimeout(500); }
const pbTab = page.locator('[data-offsub="playbook"]');
check(await pbTab.count() > 0, 'Playbook sub-tab exists');
await pbTab.first().dispatchEvent('click'); await page.waitForTimeout(700);

// formation chips
const chips = page.locator('[data-pbform]:not([data-pbform=""])');
const nChips = await chips.count();
check(nChips >= 1, `formation sheet chips render (${nChips} carried formations + GLOBAL)`);
check(await page.locator('[data-pbform=""]').count() === 1, 'GLOBAL SHEET chip renders');
const firstForm = (await chips.first().textContent() || '').trim();
await chips.first().dispatchEvent('click'); await page.waitForTimeout(700);

// the formation's own sheet is up, sliders carry the formation id
const fpbSliders = page.locator('input[data-fpb]');
const nSliders = await fpbSliders.count();
check(nSliders >= 5, `${firstForm} sheet shows its carried plays (${nSliders} sliders)`);
check(await page.locator('input[data-cw]').count() === 0, 'global sliders are replaced by the formation sheet');
check(await page.locator('[data-fpbclear]').count() === 0, 'nothing authored yet — no override pills');

// author an override by moving the first slider
const sl = fpbSliders.first();
const name = await sl.getAttribute('data-fpb');
await sl.evaluate((el) => {
  el.value = '0';
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForTimeout(700);
check(await page.locator('[data-fpbclear]').count() === 1, `moving a slider authors an override (${name} → benched)`);
check(await page.locator('#fpb-reset').count() === 1, 'reset button appears once something is authored');
const benched = await page.locator('.cw-val.cw-benched').count();
check(benched >= 1, 'benched state renders on the authored play');
await page.screenshot({ path: '_formation_editor.png' });

// the inherit pill clears the single override
await page.locator('[data-fpbclear]').first().dispatchEvent('click'); await page.waitForTimeout(600);
check(await page.locator('[data-fpbclear]').count() === 0, 'inherit pill clears the override');

// author again, then whole-sheet reset
await page.locator('input[data-fpb]').first().evaluate((el) => {
  el.value = '100';
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForTimeout(600);
if (await page.locator('#fpb-reset').count()) { await page.locator('#fpb-reset').dispatchEvent('click'); await page.waitForTimeout(600); }
check(await page.locator('[data-fpbclear]').count() === 0, 'formation reset returns the sheet to the global book');

// back to global
await page.locator('[data-pbform=""]').first().dispatchEvent('click'); await page.waitForTimeout(600);
check(await page.locator('input[data-cw]').count() > 5, 'GLOBAL SHEET chip restores the global sliders');

check(errs.length === 0, `zero page errors${errs.length ? ' — got: ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n❌ ${fails} FAILED` : '\n✅ FORMATION PLAYBOOK EDITOR SMOKE PASS');
await b.close();
process.exit(fails ? 1 : 0);
