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
const ACTIONS = [
  ['click', '#btn-mm-newcoach',        'new coach'],
  ['fill',  '#mm-nc-first', 'Garrett'],
  ['fill',  '#mm-nc-last',  'Tender'],
  ['click', '#mm-nc-create',           'create coach'],
  ['click', '.btn-mm-new >> nth=0',    'world 1'],
  ['click', '#ob-next-0',              'step1 ground rules'],
  ['click', '.ob-pick-card >> nth=0',  'take the job'],
  ['click', '#ob-next-1',              'step2 situation'],
  ['click', '.ob-chip >> nth=0',       'state'],
  ['click', '.ob-pick-card >> nth=0',  'division'],
  ['click', '.ob-school-row >> nth=0', 'school'],
  ['click', '#ob-next-2',              'step3 job'],
  ['click', '.ob-pick-card >> nth=0',  'identity'],
  ['click', '.ob-pick-card >> nth=4',  'front'],
  ['click', '#ob-next-3',              'step4 blueprint'],
  ['click', '.ob-pick-card >> nth=0',  'OC'],
  ['click', '.ob-pick-card >> nth=4',  'DC'],
  ['click', '#ob-next-4',              'FOUND THE PROGRAM'],
  ['click', '#ob-start',               'START THE DYNASTY'],
];
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
  for (const [i, [kind, sel, arg]] of ACTIONS.entries()) {
    const loc = p.locator(sel);
    if (!(await loc.count())) { out.push(`${String(i + 1).padStart(2, '0')} MISSING ${sel}`); break; }
    if (kind === 'fill') await loc.first().fill(arg);
    else await loc.first().click({ timeout: 8000 }).catch(e => out.push(`  clickfail ${sel}`));
    await p.waitForTimeout(450);
    await snap(`${String(i + 1).padStart(2, '0')} ${kind === 'fill' ? 'fill ' + sel : arg || sel}`);
  }
  await p.waitForTimeout(2500);
  await snap('19 dynasty settled');

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
