// watch_live_probe.mjs — end-to-end check of the directional sprite layer on a
// LIVE game: boots the built bundle, starts PLAY NOW -> WATCH ONLY, lets real
// plays run, and asserts the motion layer is alive on real tracks:
//   - 0 pageerrors while plays animate
//   - actors carry facing classes, and more than one facing shows up
//   - side-profile views actually display (vs visible on e/w facings)
//   - leg frames alternate on moving actors (odometer is ticking)
// Also drops screenshots for the eyeball test.
//
//   PW_CHROMIUM=... node tools/watch_live_probe.mjs <built.html> [shotPrefix]
import { chromium } from 'playwright';

const target = process.argv[2];
const prefix = process.argv[3] || '_watchlive';
if (!target) { console.error('usage: node tools/watch_live_probe.mjs <built.html>'); process.exit(1); }

const exe = process.env.PW_CHROMIUM;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto('file://' + target, { waitUntil: 'load' });
await page.waitForTimeout(900);

// If a coach exists this menu differs; PLAY NOW is present either way.
await page.click('#btn-mm-playnow', { timeout: 15000 });
await page.waitForTimeout(400);
await page.click('[data-pn-mode="watch"]');
await page.waitForTimeout(200);
await page.click('#pn-start');
await page.waitForSelector('#watch-board', { timeout: 20000 });
await page.evaluate(() => {
  const board = document.querySelector('#watch-board');
  window.__m9ContactSeen = { strike: false, drive: false, strain: false, engagement: false };
  window.__m10RepSeen = [];
  window.__m9ContactObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      const n = m.target;
      if (!(n instanceof Element)) continue;
      window.__m9ContactSeen.strike ||= n.classList.contains('wp-contact-strike');
      window.__m9ContactSeen.drive ||= n.classList.contains('wp-contact-drive');
      window.__m9ContactSeen.strain ||= n.classList.contains('wp-contact-strain');
      window.__m9ContactSeen.engagement ||= n.matches('.wp-engage-strike,.wp-engage-drive,.wp-engage-strain');
      for (const cls of n.classList) if (cls.startsWith('wp-rep-') && !window.__m10RepSeen.includes(cls)) window.__m10RepSeen.push(cls);
    }
  });
  window.__m9ContactObserver.observe(board, { subtree: true, attributes: true, attributeFilter: ['class'] });
});

// Sample the live board over ~14s of real plays.
const seenFaces = new Set();
let sawVs = false, sawFlipMirror = false, stepFlips = 0, actorMax = 0;
let sawPresnap = false, sawRelease = false, sawInPlay = false, sawSetPose = false, setPoseLeaked = false;
let sawContactStrike = false, sawContactDrive = false, sawContactStrain = false, sawEngagementPhase = false, contactLeaked = false;
let sawSchemeAnimation = false;
const seenRepFamilies = new Set();
let contactShot = false;
let presnapShot = false;
const stepMem = {};
for (let i = 0; i < 60; i++) {
  const snap = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('#watch-board .wp-actor').forEach((n) => {
      const face = (n.className.baseVal.match(/wsp-face-([ewns])/) || [])[1] || null;
      const vs = n.querySelector('.wsp-vs');
      out.push({
        id: n.dataset.wpa || n.dataset.wpk || '?',
        face,
        still: /wsp-still/.test(n.className.baseVal),
        stepB: /wsp-stepB/.test(n.className.baseVal),
        vsShown: vs ? getComputedStyle(vs).display !== 'none' : false,
        flipped: !!n.querySelector('.wsp-flip[transform]')
      });
    });
    const board = document.querySelector('#watch-board');
    const setPose = board?.querySelector('.wsp-pose-set');
    return {
      actors: out,
      presnap: board?.classList.contains('watch-presnap') || false,
      release: board?.classList.contains('watch-snap-release') || false,
      inPlay: board?.classList.contains('watch-in-play') || false,
      setShown: setPose ? getComputedStyle(setPose).display !== 'none' : false,
      contactStrike: !!board?.querySelector('.wp-contact-strike') || !!window.__m9ContactSeen?.strike,
      contactDrive: !!board?.querySelector('.wp-contact-drive') || !!window.__m9ContactSeen?.drive,
      contactStrain: !!board?.querySelector('.wp-contact-strain') || !!window.__m9ContactSeen?.strain,
      engagementPhase: !!board?.querySelector('.wp-engage-strike,.wp-engage-drive,.wp-engage-strain') || !!window.__m9ContactSeen?.engagement,
      contactLeak: !!board?.querySelector('.wp-contact-strike:not(.wp-blocking):not(.wp-blocked),.wp-contact-drive:not(.wp-blocking):not(.wp-blocked),.wp-contact-strain:not(.wp-blocking):not(.wp-blocked)'),
      repFamilies: window.__m10RepSeen || [],
      schemeAnimated: [...(board?.querySelectorAll('.wp-blocking .wsp-shell') || [])].some(n => /^(wsp-m10-|wsp-cutblock)/.test(getComputedStyle(n).animationName))
    };
  });
  actorMax = Math.max(actorMax, snap.actors.length);
  sawPresnap ||= snap.presnap;
  sawRelease ||= snap.release;
  sawInPlay ||= snap.inPlay;
  sawSetPose ||= snap.presnap && snap.setShown;
  setPoseLeaked ||= snap.inPlay && !snap.release && snap.setShown;
  sawContactStrike ||= snap.contactStrike;
  sawContactDrive ||= snap.contactDrive;
  sawContactStrain ||= snap.contactStrain;
  sawEngagementPhase ||= snap.engagementPhase;
  contactLeaked ||= snap.contactLeak;
  sawSchemeAnimation ||= snap.schemeAnimated;
  for (const rep of snap.repFamilies) seenRepFamilies.add(rep);
  if (snap.presnap && !presnapShot) {
    await page.screenshot({ path: `${prefix}-presnap.png` });
    presnapShot = true;
  }
  if ((snap.contactDrive || snap.contactStrain) && !contactShot) {
    await page.screenshot({ path: `${prefix}-contact.png` });
    contactShot = true;
  }
  for (const a of snap.actors) {
    if (a.face) seenFaces.add(a.face);
    if (a.vsShown) sawVs = true;
    if (a.flipped && a.vsShown) sawFlipMirror = true;
    if (a.id in stepMem && stepMem[a.id] !== a.stepB) stepFlips++;
    stepMem[a.id] = a.stepB;
  }
  if (i === 18) await page.screenshot({ path: `${prefix}1.png` });
  if (i === 44) await page.screenshot({ path: `${prefix}2.png` });
  await page.waitForTimeout(100);
}
await browser.close();

let pass = true;
const check = (name, ok, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  [' + detail + ']' : '')); if (!ok) pass = false; };
check('pageerrors 0', errs.length === 0, errs.join(' | ').slice(0, 300));
check('sprite actors on the board', actorMax >= 12, 'max actors=' + actorMax);
check('facing classes present', seenFaces.size >= 1, [...seenFaces].join(','));
check('multiple facings over live plays', seenFaces.size >= 2, [...seenFaces].join(','));
check('side profile view displayed', sawVs);
check('west-facing mirror applied', sawFlipMirror);
check('leg odometer flips on live tracks', stepFlips >= 10, 'flips=' + stepFlips);
check('explicit pre-snap state observed', sawPresnap);
check('authored set pose displays before snap', sawSetPose);
check('snap-release bridge observed', sawRelease);
check('normal in-play state follows snap', sawInPlay);
check('set pose never leaks into live action', !setPoseLeaked);
check('recorded block strike phase observed', sawContactStrike);
check('recorded block drive phase observed', sawContactDrive);
check('recorded block late re-fit phase observed', sawContactStrain);
check('engagement glyph follows contact phase', sawEngagementPhase);
check('contact phases never leak off active blocks', !contactLeaked);
check('recorded scheme family observed live', seenRepFamilies.size >= 1, [...seenRepFamilies].join(','));
check('scheme-specific blocker execution observed live', sawSchemeAnimation);
console.log('shots: ' + prefix + '1.png ' + prefix + '2.png');
process.exit(pass ? 0 : 1);
