// calendar_display_probe.mjs — does the UI tell the truth about what week it is?
//
// The engine counts one flat day 1..30. Every screen is supposed to translate that through
// calendarWeek() in js/engine/season.js: camp is Preseason Week 1-4, the regular season
// restarts at Week 1 on the first game day, playoffs are rounds, the offseason is just
// "Offseason". A unit test of the helper proves the arithmetic; it does NOT prove the
// screens call it. This drives a real dynasty forward a week at a time and reads the topbar
// badge and the dashboard kicker off the rendered page, then checks them against the
// expected label for that day.
//
// It also asserts the raw day never leaks: seeing "W12" while the schedule says Week 8 is
// exactly the bug this was written to catch.
//
// Usage: node tools/calendar_display_probe.mjs [built.html]   (default dist/index.html)
import { chromium } from 'playwright';
import { calendarWeek } from '../js/engine/season.js';

const target = process.argv[2] || 'dist/index.html';
const path   = target.startsWith('/') ? target : process.cwd() + '/' + target;

// [2026-08-17, FULLGATE_TRIAGE item 10] Entry rewritten off the retired coach door
// (#btn-mm-newcoach — W9 §12 made the tree the ONLY start path). The tree door mints the
// coach and goes straight into the wizard; a tree run locks take-the-job/D3 and skips the
// Situation step. The wizard itself is then WALKED generically (new_world_probe's
// advanceWizard pattern) instead of by a hardcoded click list — the old list had already
// drifted once when the Staff step landed, and a hardcoded list fails silently the next
// time a step is added or renumbered.
const ENTRY = [
  ['click', '#btn-mm-newtree'], ['fill', '#mm-nt-first', 'Garrett'], ['fill', '#mm-nt-last', 'Tender'],
  ['click', '#mm-nt-create'],
];

const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
let fails = 0;
try {
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await p.addInitScript(() => {
    let s = 20260726;
    Math.random = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  });
  await p.goto('file://' + path, { waitUntil: 'load' });
  await p.waitForTimeout(1200);

  for (const [kind, sel, arg] of ENTRY) {
    const loc = p.locator(sel);
    if (!(await loc.count())) { console.log(`wizard stalled at ${sel}`); process.exit(1); }
    if (kind === 'fill') await loc.first().fill(arg); else await loc.first().click({ timeout: 8000 });
    await p.waitForTimeout(400);
  }

  // Walk the wizard by satisfying whatever is on screen (new_world_probe's pattern).
  // An enabled forward button always wins; otherwise answer the first unanswered option
  // group, LAST group first so cascading steps (state → level → school) fill bottom-up.
  // The Staff step's OC and DC card sets share [data-ob-staff], so they get one
  // prefix-matched selector EACH — a single shared selector would stop after the OC pick
  // (the same dead-end that stalled new_world_probe; FULLGATE_TRIAGE 2026-08-17 item 3).
  const advanceWizard = () => p.evaluate((OPTIONS) => {
    for (const id of ['ob-next-0', 'ob-next-2', 'ob-next-3', 'ob-next-4', 'ob-start']) {
      const el = document.getElementById(id);
      if (el && !el.disabled && el.offsetParent !== null) { el.click(); return '#' + id; }
    }
    for (const sel of [...OPTIONS].reverse()) {
      const all = [...document.querySelectorAll(sel)]
        .filter(e => e.offsetParent !== null && e.dataset.obSchool !== '__found__');
      if (!all.length) continue;
      if (all.some(e => e.classList.contains('active'))) continue;
      all[0].click();
      return sel;
    }
    return null;
  }, ['[data-ob-state]', '[data-ob-school]',
      '[data-ob-staff^="OC:"]', '[data-ob-staff^="DC:"]', '[data-ob-qb]', '[data-ob-front]']);
  let started = false;
  let idle = 0;
  const trace = [];
  for (let i = 0; i < 60 && !started; i++) {
    const did = await advanceWizard();
    if (!did) {
      // Nothing actionable can be legitimate for a beat — stepReveal renders a
      // "FOUNDING…" spinner with no button while the world generates. Be patient
      // before calling it a stall.
      if (++idle >= 8) break;
      await p.waitForTimeout(800);
      continue;
    }
    idle = 0;
    trace.push(did);
    if (did === '#ob-start') { started = true; break; }
    await p.waitForTimeout(did.startsWith('#') ? 450 : 250);
  }
  if (!started) { console.log(`wizard stalled after: ${trace.join(' → ') || '(nothing actionable)'}`); process.exit(1); }
  await p.waitForTimeout(2500);

  // Games must not stop to be watched, or the walk deadlocks on the chalkboard.
  await p.locator('[data-nav="settings"], [data-tabbar="settings"]').first().click().catch(() => {});
  await p.waitForTimeout(600);
  for (const key of ['liveWatch', 'showGameResultModal']) {
    const t = p.locator(`[data-setting="${key}"]`);
    if (await t.count()) {
      const on = await t.first().locator('.toggle-track.on').count();
      if (on) { await t.first().click(); await p.waitForTimeout(400); }
    }
  }
  await p.locator('[data-nav="dashboard"], [data-tabbar="dashboard"]').first().click().catch(() => {});
  await p.waitForTimeout(600);

  console.log(`Calendar display — ${target}`);
  console.log('day  expected label        topbar badge              verdict\n');

  const badgeText = () => p.locator('.topbar-meta, .season-label').first()
    .innerText().catch(() => '').then(t => (t || '').replace(/\s+/g, ' ').trim());
  const subtitleText = () => p.locator('.view-subtitle').evaluateAll(nodes => {
    const texts = nodes.map(e => (e.textContent || '').replace(/\s+/g, ' ').trim());
    return texts.find(t => /^Season \d+ · (?:Preseason Week|Week \d+|Playoff Round|Offseason)/.test(t)) || '';
  }).catch(() => '');

  // Compare the badge's week SEGMENT, not the whole string. A substring test passes
  // "Offseason" (short "OFF") against "S1 · PLAYOFF 4 · Playoffs", and passes "W1" against
  // "W12" — both of which this probe hit while it was being written.
  const badgeSaysWeek = (badge, want) => {
    const seg = badge.split('·').map(x => x.trim());
    return seg.some(x => x === want.short);
  };

  // Clicks are dispatched in-page rather than through the mouse. This probe is checking
  // what the app PRINTS, and real clicks fail on things that don't matter here — a toast
  // sliding over the advance button, an overlay mid-transition. Actionability is the
  // equivalence walk's job.
  const jsClick = sel => p.evaluate(s => {
    const el = document.querySelector(s);
    if (!el) return false;
    el.click();
    return true;
  }, sel);

  // Everything that can own the screen instead of the dashboard, in the order we want to
  // answer it. These are not all modals — the halftime locker room is a full view with no
  // .modal-overlay at all, which is why this is keyed on "is the advance button gone?"
  // rather than on any overlay class.
  const TAKEOVERS = [
    '[data-kickoff="watch"]',   // game day: headset off, the sheet calls the whole game
    '#kickoff-sim-half',      // same prompt with Coach Mode off
    '#btn-resume-halftime',   // locker room
    '#btn-rec-skip',          // "your recruiting board is empty"
    '#btn-rs-bench',          // redshirt burn warning
    '.modal-footer .btn-ghost',
    '.modal-footer .btn-primary',
    '.modal-close',
  ];
  const clearTakeovers = async () => {
    for (const sel of TAKEOVERS) if (await jsClick(sel)) return sel;
    return null;
  };

  // Reaching the next day is not always one click. Day 4 in particular takes two: the first
  // finishes the Expectations stage (the button relabels to KICK OFF THE SEASON), the
  // second actually starts the season. And a game week can take many seconds to sim. So
  // this pushes and waits: clear any takeover, otherwise re-click advance if the badge has
  // been frozen for a while, and stop the moment the badge reads what it should.
  const settleOn = async (want, budgetMs = 90000) => {
    const t0 = Date.now();
    let lastPush = 0, pushes = 0;
    while (Date.now() - t0 < budgetMs) {
      const t = await badgeText();
      if (badgeSaysWeek(t, want)) return t;
      if (await clearTakeovers()) {
        lastPush = Date.now();
      } else if (Date.now() - lastPush > 6000 && pushes < 6) {
        await jsClick('#btn-advance-day');
        lastPush = Date.now(); pushes++;
      }
      await p.waitForTimeout(700);
    }
    // Timed out. Dump what owned the screen — a stall is almost always the probe failing to
    // answer a takeover, not the app printing the wrong week, and the two look identical
    // from the badge alone.
    console.log('    [stalled-dom] ' + await p.evaluate(() => {
      const root = document.getElementById('app');
      const kids = [...(root?.children || [])].map(e => e.tagName + '.' + e.className).slice(0, 12);
      const btns = [...document.querySelectorAll('button[id]')].map(b => b.id).slice(0, 20);
      return 'app-children=' + JSON.stringify(kids) + ' buttons=' + JSON.stringify(btns);
    }));
    console.log('    [stalled] ' + await p.evaluate(() => {
      const m = document.querySelector('.modal-overlay');
      const app = (document.getElementById('app')?.innerText || '').replace(/\s+/g, ' ');
      return (m ? 'overlay=' + m.className + ' :: ' + (m.innerText || '').replace(/\s+/g, ' ').slice(0, 160)
                : 'no overlay') + ' | app=' + app.slice(0, 200);
    }));
    return badgeText();
  };

  for (let day = 1; day <= 24; day++) {
    const want  = calendarWeek(day);
    const badge = await settleOn(want);
    const subtitle = await subtitleText();

    const badgeOk = badgeSaysWeek(badge, want);
    // The dashboard's own subtitle has to agree with the badge. Checking the whole page for
    // the raw day doesn't work — the season rail legitimately prints every week of the year,
    // so "W12" is on screen in week 8 and always will be. Read the subtitle element directly:
    // a bounded slice of the whole app can end inside the expanded navigation before reaching
    // the dashboard and falsely report every week as missing.
    const subOk = subtitle.includes(want.label);

    const flag = (badgeOk ? '' : ' BADGE-MISS') + (subOk ? '' : ' SUBTITLE-MISS');
    if (flag) fails++;
    console.log(`d${String(day).padStart(2)}  ${want.label.padEnd(20)} ${badge.padEnd(25)} ${flag || 'ok'}`);
    if (!badgeOk || !subOk) break;   // out of sync — everything after this is noise

    // No explicit advance here: settleOn() drives the calendar forward itself, because
    // "one click = one day" is not true (day 4 needs two) and a click can land while the
    // sim still owns the screen. Pushing from inside the wait loop is the only version
    // that survives both.
  }

  console.log(`\npageerrors ${errs.length}`);
  errs.slice(0, 6).forEach(e => console.log('  ERR', e));
  console.log(fails ? `\nFAIL — ${fails} day(s) displayed wrong` : '\nPASS — every screen agreed with calendarWeek()');
} finally { await b.close(); }
process.exit(fails ? 1 : 0);
