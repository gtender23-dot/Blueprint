// a11y_overlay_probe.mjs — proves the overlay-containment + accessible-name
// fixes from the 2026-08-10 release-hardening pass (readiness review items
// C1–C3, Ref/RELEASE_PUNCH_LIST_2026-08-10.md).
//
// Contract under test (against the BUILT bundle):
//   1. With no overlay open, no top-level child of #app carries inert or
//      aria-hidden.
//   2. After kickoff from the Play Now screen (the review's exact repro), the
//      base view under the game overlay is inert + aria-hidden — removed from
//      the accessibility tree and the tab order — and the setup's KICK OFF
//      button is inside an inert subtree.
//   3. Every button and text input rendered on the visited screens has an
//      accessible name (aria-label, non-empty text, or title). Hard gate.
//
// Run: PW_CHROMIUM=<chromium path> node tools/a11y_overlay_probe.mjs <abs dist/index.html>
import { chromium } from 'playwright';

const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
const pg = await b.newPage({ viewport: { width: 1280, height: 860 } });

let failed = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}`); if (!ok) failed++; };

const inertState = () => pg.evaluate(() => {
  const kids = Array.from(document.getElementById('app').children);
  return {
    total: kids.length,
    overlays: kids.filter((el) => el.classList.contains('modal-overlay')).length,
    inerted: kids.filter((el) => el.hasAttribute('inert')).length,
    hiddenNonOverlay: kids.filter((el) => !el.classList.contains('modal-overlay') && el.getAttribute('aria-hidden') === 'true').length,
    nonOverlayNonNotif: kids.filter((el) => !el.classList.contains('modal-overlay') && !el.classList.contains('notification')).length,
  };
});
const unnamed = () => pg.evaluate(() => {
  const bad = [];
  for (const el of document.querySelectorAll('button, input[type="text"]')) {
    if (el.closest('[inert]')) continue; // hidden from AT anyway
    const name = (el.getAttribute('aria-label') || '').trim()
      || (el.tagName === 'BUTTON' ? (el.textContent || '').trim() : '')
      || (el.getAttribute('title') || '').trim()
      || (el.getAttribute('aria-labelledby') || '').trim();
    if (!name) bad.push(`${el.tagName.toLowerCase()}#${el.id || '?'}.${el.className.split(' ')[0] || '?'}`);
  }
  return bad;
});

console.log('=== A11Y OVERLAY PROBE ===\n');

await pg.goto('file://' + process.argv[2], { waitUntil: 'networkidle' });
await pg.waitForTimeout(1800);

// 1. Main menu — clean slate.
let s = await inertState();
check(s.overlays === 0, `main menu: no overlay open (${s.overlays})`);
check(s.inerted === 0 && s.hiddenNonOverlay === 0, 'main menu: nothing inert/aria-hidden');
let u = await unnamed();
check(u.length === 0, `main menu: every control has an accessible name${u.length ? ' — MISSING: ' + u.join(', ') : ''}`);

// 2. Play Now setup screen.
const btn = await pg.$('text=PLAY NOW');
check(!!btn, 'PLAY NOW entry exists on the main menu');
if (btn) {
  await btn.click();
  await pg.waitForTimeout(1200);
  u = await unnamed();
  check(u.length === 0, `play-now setup: every control has an accessible name${u.length ? ' — MISSING: ' + u.join(', ') : ''}`);

  // 3. Kick off — the review's exact repro: setup must leave the AX tree.
  const kick = await pg.$('#pn-start');
  check(!!kick, 'KICK OFF button exists');
  if (kick) {
    await kick.click();
    await pg.waitForTimeout(5000);
    s = await inertState();
    check(s.overlays > 0, `after kickoff: a game overlay is open (${s.overlays})`);
    check(s.nonOverlayNonNotif > 0 && s.inerted >= s.nonOverlayNonNotif,
      `after kickoff: base view inert (${s.inerted}/${s.nonOverlayNonNotif} non-overlay children)`);
    check(s.hiddenNonOverlay >= s.nonOverlayNonNotif,
      `after kickoff: base view aria-hidden (${s.hiddenNonOverlay}/${s.nonOverlayNonNotif})`);
    const setupBuried = await pg.evaluate(() => {
      const el = document.getElementById('pn-start');
      return !el || !!el.closest('[inert]');
    });
    check(setupBuried, 'exhibition setup (KICK OFF) is inside an inert subtree — gone from the AX tree');
    u = await unnamed();
    check(u.length === 0, `live overlay: every reachable control has an accessible name${u.length ? ' — MISSING: ' + u.join(', ') : ''}`);
  }
}

await b.close();
console.log(failed === 0 ? '\nALL PASS ✅' : `\n${failed} FAILURES ❌`);
process.exit(failed === 0 ? 0 : 1);
