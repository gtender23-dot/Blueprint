// _equiv_walk.mjs — behavioural equivalence check between two builds of the game.
//
// The gate (tools/_reconcile.mjs) proves the rebuilt bundle is semantically identical to
// cfb_mobile.html as TEXT. This proves it behaves identically as a PROGRAM: it pins
// Math.random to a seeded PRNG, drives the real new-game wizard to a live dynasty, then
// walks the main screens, hashing the rendered DOM at every step. Run it against both
// builds and diff the transcripts — they must match line for line.
//
// Usage: node tools/_equiv_walk.mjs <path-to-built-html>
import { chromium } from 'playwright';
import { createHash } from 'crypto';

const target = process.argv[2];
// ── ENTRY: the TREE door ────────────────────────────────────────────────────
// REPAIRED 2026-08-18. This walk had rotted against the shipped UI and would
// dead-end mid-wizard: it entered through `#btn-mm-newcoach` (the one-coach
// setup the coaching TREE replaced — the id still exists in mainmenu.js inside
// the deliberately-retained legacy block, but nothing renders it), and then
// clicked `#ob-next-1`, the old "step 2 situation" button, which no longer
// exists ANYWHERE in js/ (the Situation step was retired 2026-08-17 — every
// dynasty is take-the-job at the start division, so it was never a question).
// Planting a tree now takes the coach's name and goes straight into the wizard.
const ENTRY = [
  ['click', '#btn-mm-newtree', 'plant a tree'],
  ['fill',  '#mm-nt-first', 'Garrett'],
  ['fill',  '#mm-nt-last',  'Tender'],
  ['click', '#mm-nt-create', 'sign the founder → wizard'],
];
// ── THE WIZARD: click what is on screen, not a memorised script ─────────────
// Mirrors tools/new_world_probe.mjs's driver (12/12 green against the current
// build) instead of hard-coding a step list. That is deliberate, and it is what
// keeps this gate honest across UI work: a memorised script rots silently and
// then "passes" by dead-ending in the same place on BOTH builds, which is how
// a byte-identity gate can quietly stop testing anything. Clicking whatever is
// live is still perfectly deterministic — and if two builds disagree about what
// is on screen, the traces diverge, which is exactly the signal we want.
const OPTIONS = ['[data-ob-state]', '[data-ob-school]',
                 '[data-ob-staff^="OC:"]', '[data-ob-staff^="DC:"]',
                 '[data-ob-qb]', '[data-ob-front]', '.ob-pick-card'];
const NEXT_IDS = ['ob-next-0', 'ob-next-2', 'ob-next-3', 'ob-next-4', 'ob-start'];
// Screens to visit once the dynasty exists, exercising the reconciled views.
// Ordered so each group is entered before its sub-tabs are asked for.
const TOUR = ['team', 'roster', 'depthchart', 'practice',
              'program', 'coachoffice', 'schedule', 'standings',
              'statsgroup', 'stats', 'awards', 'history',
              'gameplan', 'recruiting', 'settings'];

const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const out = [];
try {
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await p.addInitScript(() => {
    let s = 20260726;
    Math.random = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  });
  await p.goto('file://' + target, { waitUntil: 'load' });
  await p.waitForTimeout(1200);

  const snap = async (label) => {
    const t = await p.evaluate(() => (document.getElementById('app')?.innerText || '').replace(/\s+/g, ' ').trim());
    const h = createHash('sha256').update(t).digest('hex').slice(0, 16);
    out.push(`${label.padEnd(26)} len=${String(t.length).padStart(6)} sha=${h}`);
  };

  await snap('00 boot');
  let step = 0;
  const stepNo = () => String(++step).padStart(2, '0');
  for (const [kind, sel, arg] of ENTRY) {
    const loc = p.locator(sel);
    if (!(await loc.count())) { out.push(`${stepNo()} MISSING ${sel}`); break; }
    if (kind === 'fill') await loc.first().fill(arg);
    else await loc.first().click({ timeout: 8000 }).catch(() => out.push(`  clickfail ${sel}`));
    await p.waitForTimeout(450);
    await snap(`${stepNo()} ${kind === 'fill' ? 'fill ' + sel : arg}`);
  }
  // Walk the wizard until it starts the dynasty (or the screen stops offering
  // anything, which is itself a diffable outcome rather than a silent pass).
  let started = false;
  for (let i = 0; i < 40 && !started; i++) {
    const did = await p.evaluate(({ OPTIONS, NEXT_IDS }) => {
      for (const id of NEXT_IDS) {
        const el = document.getElementById(id);
        if (el && !el.disabled && el.offsetParent !== null) { el.click(); return '#' + id; }
      }
      // Answer the LAST unanswered group first so a cascading step
      // (state → school) fills bottom-up and re-renders cleanly.
      for (const sel of [...OPTIONS].reverse()) {
        const all = [...document.querySelectorAll(sel)]
          .filter(e => e.offsetParent !== null && e.dataset.obSchool !== '__found__');
        if (!all.length) continue;
        if (all.some(e => e.classList.contains('active'))) continue;
        all[0].click();
        return sel;
      }
      return null;
    }, { OPTIONS, NEXT_IDS });
    if (!did) { out.push(`${stepNo()} wizard DEAD-END (nothing left to press)`); break; }
    if (did === '#ob-start') started = true;
    await p.waitForTimeout(did.startsWith('#') ? 450 : 250);
    await snap(`${stepNo()} ${did}`);
  }
  out.push(started ? 'wizard STARTED the dynasty' : 'wizard DID NOT START');
  await p.waitForTimeout(2500);
  await snap('dynasty settled');

  for (const view of TOUR) {
    const nav = p.locator(`[data-nav="${view}"], [data-tabbar="${view}"], [data-view="${view}"], [data-team-tab="${view}"], [data-program-tab="${view}"], [data-statsgroup-tab="${view}"]`);
    if (await nav.count()) {
      await nav.first().click({ timeout: 6000 }).catch(() => {});
      await p.waitForTimeout(800);
      await snap(`view ${view}`);
    } else {
      out.push(`view ${view.padEnd(21)} (no nav control)`);
    }
  }

  out.push(`PAGEERRORS ${errs.length}`);
  errs.slice(0, 8).forEach(e => out.push(`  ERR ${e}`));
} finally { await b.close(); }
console.log(out.join('\n'));
