// new_world_probe.mjs — [GARRETT, Aug 2026] CAN YOU ACTUALLY START A GAME?
//
// This tool exists because a one-line missing import took the whole product
// down and every single check in the repo stayed green.
//
// What happened: the preseason budget-conversation card started calling
// tipTerm() and views/dashboard.js never imported it. esbuild leaves an
// unresolved identifier as a runtime global rather than failing the build, so
// the bundle built clean. _boot_check only loads the MAIN MENU, so it passed.
// polish_ui_smoke and w7_economy_smoke assemble a world programmatically and
// jump straight to the screens they care about, so they passed. Nothing in the
// repo walked a human being's actual first ninety seconds — plant a tree, take
// the job, click through the wizard, look at the dashboard — and the dashboard
// on preseason Week 1 is exactly where the card renders. Every new world booted
// to a blank screen.
//
// So this probe is deliberately dumb and end-to-end. It clicks what a person
// clicks, in the order a person clicks it, and it fails on ANY page or console
// error along the way. It does not know or care what the wizard's steps are.
//
//   N1  A tree can be planted — one form, which seats its first coach.
//   N2  The new-game wizard can be walked to the end by clicking what is on
//       screen, with no dead end and no step that cannot be satisfied.
//   N3  A world generates and the dashboard RENDERS CONTENT.
//   N4  Every preseason week renders — Week 1 is where the budget conversation
//       lives, and it is the screen that broke.
//   N5  The season can be advanced into real games.
//   N6  Zero page errors and zero console errors across all of it.
//
// Run: PW_CHROMIUM=<chrome> node tools/new_world_probe.mjs [dist-dir]
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.argv[2] || join(fileURLToPath(new URL('..', import.meta.url)), 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const body = await readFile(join(ROOT, rel));
    res.writeHead(200, { 'content-type': MIME[extname(rel)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, r));

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => {
  if (m.type() !== 'error') return;
  const t = m.text();
  // The offline shell 404s its own icons under a plain file server. Not a bug.
  if (/Failed to load resource|ERR_TUNNEL|ERR_INTERNET|favicon/i.test(t)) return;
  errors.push(`console: ${t}`);
});

let fails = 0;
const check = (ok, label, detail = '') => {
  if (!ok) fails++;
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const settle = (ms = 350) => page.waitForTimeout(ms);

// Click whatever the current screen needs, without knowing what it is. Returns
// a label for the trace, or null when there is genuinely nothing to press.
const OPTIONS = ['[data-ob-challenge]', '[data-ob-state]', '[data-ob-div]', '[data-ob-school]',
                 '[data-ob-qb]', '[data-ob-front]'];
async function advanceWizard() {
  return page.evaluate((OPTIONS) => {
    // An enabled forward button always wins.
    for (const id of ['ob-next-0', 'ob-next-1', 'ob-next-2', 'ob-next-3', 'ob-next-4', 'ob-start']) {
      const el = document.getElementById(id);
      if (el && !el.disabled && el.offsetParent !== null) { el.click(); return '#' + id; }
    }
    // Otherwise satisfy the first unanswered question on screen. Answer the
    // LAST group first so a cascading step (state → division → school) fills
    // from the bottom up and re-renders cleanly.
    for (const sel of [...OPTIONS].reverse()) {
      const all = [...document.querySelectorAll(sel)]
        .filter(e => e.offsetParent !== null && e.dataset.obSchool !== '__found__');
      if (!all.length) continue;
      if (all.some(e => e.classList.contains('active'))) continue;
      all[0].click();
      return sel;
    }
    return null;
  }, OPTIONS);
}

try {
  await page.goto(`http://localhost:${server.address().port}/index.html`);
  await page.waitForTimeout(1200);

  // ── N1. Plant a tree — which IS signing its first coach ─────────────────
  // [GARRETT, Aug 2026] One form now, not two: PLANT A TREE takes the COACH's
  // first and last name, derives the tree's name from his surname, seats him as
  // the trunk and goes straight into the wizard. The old flow typed a tree name
  // here and a coach name on the tree home a screen later.
  await page.click('#btn-mm-newtree');
  await settle();
  await page.fill('#mm-nt-first', 'Probe');
  await page.fill('#mm-nt-last', 'Whitaker');
  await page.click('#mm-nt-create');
  await settle(700);
  check(!!(await page.$('.ob-kicker')),
    'N1 planting a tree signs the first coach and opens the wizard in one submit');
  // The tree took the coach's name — the menu is the only thing that reads it,
  // so this is checked here rather than on a screen the player never sees.
  const treeNamed = await page.evaluate(() => {
    try { return (JSON.parse(localStorage.getItem('cfb-trees-v1') || '[]')[0] || {}).name || null; }
    catch { return null; }
  });
  check(treeNamed === 'The Whitaker Tree', 'N1b the tree is named after its founder', `tree name "${treeNamed}"`);

  // ── N2. Walk the wizard by clicking what is on screen ───────────────────
  const trace = [];
  let started = false;
  for (let i = 0; i < 40; i++) {
    const did = await advanceWizard();
    if (!did) break;
    trace.push(did);
    if (did === '#ob-start') { started = true; break; }
    await settle(did.startsWith('#') ? 450 : 250);
  }
  console.log(`   wizard path: ${trace.join(' → ')}`);
  check(started, 'N2 the wizard can be walked end to end by clicking what is on screen',
    started ? `${trace.length} clicks` : `dead-ended after ${trace.length}: ${trace.join(' → ')}`);

  // ── N3. The world generates and the dashboard renders CONTENT ───────────
  await page.waitForTimeout(6000);
  const dash = await page.evaluate(() => {
    const root = document.getElementById('view-root');
    return {
      kids: root ? root.children.length : -1,
      text: (root?.innerText || '').replace(/\s+/g, ' ').trim().length,
      title: document.querySelector('.view-title')?.textContent?.trim() || null,
      cards: document.querySelectorAll('#view-root .card').length,
    };
  });
  check(dash.kids > 0 && dash.text > 400, 'N3 the world generates and the dashboard renders content',
    `${dash.kids} node(s), ${dash.text} chars, ${dash.cards} card(s), title "${dash.title}"`);

  // ── N4/N5. Walk the weeks the way a person does: press the button ───────
  // Deliberately NOT driven by importing js/state.js — the shipped artefact is
  // one bundled IIFE with no importable modules, and testing a module graph the
  // player never loads is how the blank dashboard got through in the first
  // place. Everything below is clicks on the real bundle.
  const pressAdvance = async () => page.evaluate(() => {
    // Clear anything modal first: kickoff prompt, result modal, tree agenda.
    const kick = document.querySelector('[data-kickoff]');
    if (kick && kick.offsetParent !== null) { kick.click(); return 'kickoff'; }
    const half = document.getElementById('btn-resume-halftime');
    if (half && half.offsetParent !== null) { half.click(); return 'halftime'; }
    const accept = document.getElementById('tree-finalize-all')
      || document.querySelector('[data-tree-final]');
    if (accept && accept.offsetParent !== null) { accept.click(); return 'accept-other-game'; }
    const rs = document.getElementById('btn-redshirt-confirm');
    if (rs && rs.offsetParent !== null) { rs.click(); return 'redshirt-confirm'; }
    const close = document.querySelector('.modal-close, [data-modal-close]');
    if (close && close.offsetParent !== null) { close.click(); return 'close-modal'; }
    const adv = document.getElementById('btn-advance-day');
    if (adv && !adv.disabled && adv.offsetParent !== null) { adv.click(); return 'advance'; }
    return null;
  });
  const readScreen = () => page.evaluate(() => ({
    chars: (document.getElementById('view-root')?.innerText || '').replace(/\s+/g, ' ').trim().length,
    header: (document.querySelector('.topbar-week, .view-subtitle, .exp-kicker')?.textContent || '').trim().slice(0, 40),
  }));

  const walk = [];
  let blank = null;
  for (let i = 0; i < 14; i++) {
    const screen = await readScreen();
    walk.push(`${screen.chars}c`);
    if (screen.chars < 300 && blank === null) blank = `after ${i} advance(s)`;
    let did = await pressAdvance();
    if (!did) {
      // A rerender can land between reading the DOM and clicking it. Give the
      // screen one more beat before deciding the walk is genuinely over —
      // otherwise the probe stops early and quietly tests less than it says.
      await settle(900);
      did = await pressAdvance();
    }
    if (!did) {
      const why = await page.evaluate(() => {
        const adv = document.getElementById('btn-advance-day');
        return { advExists: !!adv, advDisabled: adv ? adv.disabled : null,
          advHidden: adv ? adv.offsetParent === null : null,
          modals: [...document.querySelectorAll('.modal, .modal-backdrop, .kickoff-modal')]
            .filter(e => e.offsetParent !== null).map(e => e.className).slice(0, 3),
          buttons: [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null)
            .map(b => (b.id || b.textContent || '').trim().slice(0, 28)).slice(0, 12) };
      });
      console.log(`   walk stopped after ${i}: ${JSON.stringify(why)}`);
      break;
    }
    await settle(did === 'advance' ? 1400 : 600);
  }
  console.log(`   week walk: ${walk.join(' → ')}`);
  check(blank === null, 'N4 no screen goes blank while walking the preseason into the season', blank || 'every screen rendered');

  const end = await readScreen();
  check(end.chars > 400, 'N5 the game is still standing at the end of the walk', `${end.chars} chars`);

  // ── N7. The tree home's shelf ───────────────────────────────────────────
  // [GARRETT, Aug 2026] The tree home replaced the old coach home and quietly
  // dropped five of its screens. This walks back out to the menu and asserts
  // every one of them is reachable and renders, because "the screen exists but
  // nothing links to it" is exactly the failure that shipped.
  const backToMenu = await page.evaluate(() => {
    const b = document.getElementById('btn-main-menu');
    if (b && b.offsetParent !== null) { b.click(); return true; }
    return false;
  });
  await settle(1200);
  if (!backToMenu) {
    check(false, 'N7 could not get back to the main menu to check the tree home');
  } else {
    // Confirm/leave any "are you sure" step the menu button raises.
    await page.evaluate(() => {
      const y = [...document.querySelectorAll('button')].find(x =>
        x.offsetParent !== null && /^(yes|leave|main menu|confirm)/i.test((x.textContent || '').trim()));
      if (y) y.click();
    });
    await settle(900);
    // Leaving a tree world usually lands straight back on that tree's home, so
    // only click through the list when it does not.
    await page.evaluate(() => {
      if (/SEATED SEASON|THE RETIRED|PLAYBOOK LIBRARY/.test((document.body.innerText || '').toUpperCase())) return;
      const tree = document.querySelector('[data-mm-tree]') ||
        [...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('🌳'));
      if (tree) tree.click();
    });
    await settle(700);
    const shelf = await page.evaluate(() => {
      const txt = (document.body.innerText || '').toUpperCase();
      return {
        opened: /THE RETIRED|PLAYBOOK LIBRARY|BANKED BY THE TREE|SEATED SEASON/.test(txt),
        library: txt.includes('PLAYBOOK LIBRARY'),
        teams: txt.includes('SAVED TEAMS'),
        classics: txt.includes('INSTANT CLASSICS'),
        dnaBtns: document.querySelectorAll('[data-mm-view="dna"][data-mm-view-coach]').length,
        recBtns: document.querySelectorAll('[data-mm-view="records"][data-mm-view-coach]').length,
      };
    });
    check(shelf.opened, 'N7 the tree home is reachable from the menu after leaving a world', JSON.stringify(shelf));
    check(shelf.library && shelf.teams && shelf.classics,
      'N7b the tree home carries the library, saved teams and instant classics',
      `library ${shelf.library} · teams ${shelf.teams} · classics ${shelf.classics}`);
    check(shelf.dnaBtns > 0 && shelf.recBtns > 0,
      'N7c every seated chair opens its own DNA and record book',
      `${shelf.dnaBtns} DNA · ${shelf.recBtns} records`);

    // And the pages behind those buttons actually render, with a Back that works.
    const hub = await page.evaluate(async () => {
      const open = (sel) => { const b = document.querySelector(sel); if (b) { b.click(); return true; } return false; };
      const read = () => (document.body.innerText || '').toUpperCase();
      const out = {};
      open('[data-mm-view="dna"][data-mm-view-coach]');
      await new Promise(r => setTimeout(r, 400));
      out.dna = /DNA & BONUSES/.test(read());
      open('[data-mm-view="back"]');
      await new Promise(r => setTimeout(r, 400));
      out.backFromDna = /SEATED SEASON|THE RETIRED|PLAYBOOK LIBRARY/.test(read());
      open('[data-mm-view="records"][data-mm-view-coach]');
      await new Promise(r => setTimeout(r, 400));
      out.records = /RECORD BOOK/.test(read());
      open('[data-mm-view="back"]');
      await new Promise(r => setTimeout(r, 400));
      out.backFromRecords = /SEATED SEASON|THE RETIRED|PLAYBOOK LIBRARY/.test(read());
      return out;
    });
    check(hub.dna && hub.records, 'N7d both hub pages render for a chair', JSON.stringify(hub));
    check(hub.backFromDna && hub.backFromRecords,
      'N7e Back returns to the TREE, not to a coach home the player never opened',
      JSON.stringify(hub));
  }

  // ── N8. Nothing threw, anywhere ─────────────────────────────────────────
  check(errors.length === 0, 'N8 zero page and console errors across the whole first session',
    errors.slice(0, 4).join(' | '));
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${fails === 0 ? 'NEW WORLD PROBE PASS' : `NEW WORLD PROBE FAIL — ${fails} check(s)`}\n`);
process.exit(fails ? 1 : 0);
