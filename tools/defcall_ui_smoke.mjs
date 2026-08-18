// defcall_ui_smoke.mjs — PASS 2 UI smoke: the Calls tab.
// Drives the real new-tree wizard to a live dynasty (advanced gameplan mode
// picked in step 1), opens Game Plan › Defense Defaults › Calls, authors a
// named call, sets two of its dials, weights it on the matchup sheet, and
// asserts the sparse storage laws (empty structures collapse; deleting a
// call purges it from the sheet).
// Usage: node tools/defcall_ui_smoke.mjs <path-to-dist/index.html>
import { chromium } from 'playwright';

const target = process.argv[2];
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await b.newPage({ viewport: { width: 460, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? '✅' : '❌'} ${msg}`); if (!ok) fails++; };
// Some chip rows overflow-scroll on the phone layout; when Playwright can't
// bring a chip into the viewport, fall through to a DOM-dispatched click —
// the app's listeners are plain addEventListener, so it behaves identically.
const click = async (sel) => {
  const loc = page.locator(sel).first();
  await loc.click({ timeout: 4000 }).catch(async () => { await loc.dispatchEvent('click'); });
  await page.waitForTimeout(450);
};

await page.goto('file://' + target, { waitUntil: 'load' });
await page.waitForTimeout(1500);

// ── new-tree wizard to a live dynasty ──
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

// ── gameplan › defense › calls ──
await click('[data-nav="gameplan"]');
await click('[data-gpsection="defense"]');
check(await page.locator('[data-defsub="calls"]').count() === 1, 'Calls tab renders in Defense Defaults');
await click('[data-defsub="calls"]');
// 2026-08-18: a fresh dynasty now carries a FULL starter defense (12 named calls
// at the MAX_DEF_CALLS cap), so the author flow can't add a 13th. Empty the
// library via the UI Delete buttons first, to test authoring from a clean slate.
for (let i = 0; i < 15; i++) {
  const del = page.locator('[data-call-del]').first();
  if (!(await del.count())) break;
  await del.dispatchEvent('click').catch(() => {});
  await page.waitForTimeout(150);
}
await page.waitForTimeout(300);
check(await page.locator('#new-call-name').count() === 1, 'call author input renders');

// ── author a call ──
await page.locator('#new-call-name').fill('Bear Down');
await click('#new-call-add');
check(await page.locator('[data-call-open="Bear Down"]').count() === 1, 'named call created');
// card auto-opens for editing: set front + pressure
await click('[data-call-name="Bear Down"][data-call-field="front"][data-call-val="46/Bear"]');
await click('[data-call-name="Bear Down"][data-call-field="aggression"][data-call-val="house"]');
check(await page.locator('[data-call-val="46/Bear"].active').count() === 1, 'front chip sticks');
check(await page.locator('[data-call-val="house"].active').count() === 1, 'pressure chip sticks');
// PASS 3: the family/rotation/rush ingredient rows author and stick
await click('[data-call-name="Bear Down"][data-call-field="covFamily"][data-call-val="Tampa 2"]');
await click('[data-call-name="Bear Down"][data-call-field="rotation"][data-call-val="buzz"]');
await click('[data-call-name="Bear Down"][data-call-field="rush3"][data-call-val="true"]');
check(await page.locator('[data-call-field="covFamily"][data-call-val="Tampa 2"].active').count() === 1, 'PASS 3: Coverage family chip sticks');
check(await page.locator('[data-call-field="rotation"][data-call-val="buzz"].active').count() === 1, 'PASS 3: Rotation chip sticks');
check(await page.locator('[data-call-field="rush3"].active').count() === 1, 'PASS 3: Rush 3 chip sticks');
// toggle rush3 back off (boolean true round-trips through the toggle law)
await click('[data-call-name="Bear Down"][data-call-field="rush3"][data-call-val="true"]');
check(await page.locator('[data-call-field="rush3"][data-call-val="true"].active').count() === 0, 'PASS 3: Rush 3 toggles back off');
// PASS 4: the pressure-flavor ingredient rows author and stick
await click('[data-call-name="Bear Down"][data-call-field="pressLook"][data-call-val="mug"]');
await click('[data-call-name="Bear Down"][data-call-field="dogGame"][data-call-val="cross"]');
check(await page.locator('[data-call-field="pressLook"][data-call-val="mug"].active').count() === 1, 'PASS 4: Look (Double-A Mug) chip sticks');
check(await page.locator('[data-call-field="dogGame"][data-call-val="cross"].active').count() === 1, 'PASS 4: Dog (Cross Dog) chip sticks');
// same-chip tap clears the field (the toggle law)
await click('[data-call-name="Bear Down"][data-call-field="pressLook"][data-call-val="mug"]');
check(await page.locator('[data-call-field="pressLook"][data-call-val="mug"].active').count() === 0, 'PASS 4: Look toggles back off');

// ── weight it on the sheet ──
await click('[data-dcs-sit="third_long"]');
await click('[data-dcs-pers="11"]');
await click('[data-dcs-call="Bear Down"]');
check(await page.locator('.dcw-slider').count() === 1, 'sheet cell holds the weighted call');
check((await page.locator('[data-dcs-sit="third_long"]').textContent() || '').includes('●'), 'situation row shows the content dot');
check((await page.locator('[data-dcs-pers="11"]').textContent() || '').includes('●'), 'personnel column shows the content dot');

// second call → cell of two, sliders rebalance
await page.locator('#new-call-name').fill('Tite Mint');
await click('#new-call-add');
await click('[data-dcs-call="Tite Mint"]');
check(await page.locator('.dcw-slider').count() === 2, 'two-call cell renders two weight sliders');

// ── untoggle both → cell deleted (dot gone) ──
await click('[data-dcs-call="Tite Mint"]');
await click('[data-dcs-call="Bear Down"]');
check(await page.locator('.dcw-slider').count() === 0, 'emptied cell collapses');
check(!((await page.locator('[data-dcs-pers="11"]').textContent() || '').includes('●')), 'personnel dot clears with the cell');

// ── re-add, then delete the call → sheet purged ──
await click('[data-dcs-call="Bear Down"]');
check(await page.locator('.dcw-slider').count() === 1, 'cell restored');
await click('[data-call-del="Bear Down"]');
check(await page.locator('[data-call-open="Bear Down"]').count() === 0, 'call deleted from library');
check(await page.locator('.dcw-slider').count() === 0, 'deleting a call purges it from the sheet');

// other defense tabs still alive after the new tab wiring
await click('[data-defsub="front"]');
check(await page.locator('#box-commit').count() === 1, 'Front tab still renders');
await click('[data-defsub="checks"]');
check(await page.locator('[data-chk-class]').count() > 0, 'Checks tab still renders');

check(errs.length === 0, `zero page errors${errs.length ? ' — got: ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n❌ ${fails} FAILED` : '\n✅ DEFCALL UI SMOKE PASS');
await b.close();
process.exit(fails ? 1 : 0);
