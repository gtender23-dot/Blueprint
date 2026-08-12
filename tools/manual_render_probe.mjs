// manual_render_probe.mjs — [GARRETT, Aug 2026] THE SLIM PASS, PROVED ON SCREEN.
//
// The manual was cut roughly in half and taken out of its first-person coach
// voice. Two of the three things that made it "way too much reading" were not
// word count at all, and both are asserted here because both were invisible
// failures that survived for the manual's whole life:
//
//   M1  PARAGRAPHS ARE REAL. Chapter bodies are authored as template literals
//       with blank lines between paragraphs. HTML collapses whitespace, so every
//       section rendered as ONE unbroken block — the writing spec has asked for
//       "two to four short paragraphs" since day one and no reader ever saw one.
//       views/manual.js now splits on blank lines into <p>. If that regresses,
//       the manual silently becomes a wall again and nothing else notices.
//   M2  EVERY CHAPTER OPENS WITH ITS ONE-LINE ANSWER. The blurb renders as a
//       lede above the sections, so an opened chapter reads as answerable at a
//       glance rather than as a page of prose.
//   M3  THE BUDGET. No chapter runs past the length the spec allows, measured
//       on what actually reaches the screen rather than on the source file.
//   M4  THE PERSONA IS GONE. No first person, no rhetorical questions, no
//       exclamation marks, no "trust me" / "here's the thing" narrator tells.
//   M5  EVERY CHAPTER STILL OPENS AND STILL SAYS SOMETHING.
//
// Run: PW_CHROMIUM=<chrome> node tools/manual_render_probe.mjs
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
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

const WORD_CEILING = 900;          // the hard ceiling; the spec's target is far lower
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });

let fails = 0;
const check = (ok, label, detail = '') => {
  if (!ok) fails++;
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
};

// Narrator tells. Each of these appeared in the manual before the slim pass.
const PERSONA = /\b(I'd|I've|I have watched|trust me|here's the thing|here's the part|let me tell|my honest advice|the thing nobody tells|get this straight|hear me)\b/i;

try {
  await page.goto(`http://localhost:${server.address().port}/index.html`);
  await page.waitForTimeout(900);

  const { rows, toc } = await page.evaluate(async () => {
    const { state, rerender, navigate } = await import('./js/state.js');
    const { MANUAL_CHAPTERS } = await import('./js/ui/manual/index.js');
    navigate('manual');
    const out = [];
    for (const c of MANUAL_CHAPTERS) {
      state.ui.manualChapter = c.id;
      rerender();
      await new Promise(r => setTimeout(r, 20));
      const bodies = [...document.querySelectorAll('.manual-body')];
      const text = document.querySelector('.manual-chapter')?.innerText || '';
      out.push({
        id: c.id,
        sections: bodies.length,
        paras: bodies.reduce((s, b) => s + b.querySelectorAll('p').length, 0),
        multiParaSections: bodies.filter(b => b.querySelectorAll('p').length > 1).length,
        lede: (document.querySelector('.manual-lede')?.innerText || '').trim(),
        words: text.split(/\s+/).filter(Boolean).length,
        text,
      });
    }
    state.ui.manualChapter = null; rerender();
    await new Promise(r => setTimeout(r, 20));
    return { rows: out, toc: document.querySelectorAll('.manual-toc-item').length };
  });

  console.log(`\n  ${'chapter'.padEnd(24)} sec  <p>  words`);
  for (const r of rows) {
    console.log(`  ${r.id.padEnd(24)} ${String(r.sections).padStart(3)} ${String(r.paras).padStart(4)} ${String(r.words).padStart(6)}`);
  }
  console.log('');

  check(rows.length === toc && toc >= 20,
    'M5 every chapter in the registry opens from the table of contents', `${toc} chapters`);
  check(rows.every(r => r.sections >= 4 && r.words > 120),
    'M5b every chapter renders real sections with real prose');

  // M1 — the fix that matters most. A section that renders one <p> is a wall.
  const walls = rows.filter(r => r.paras <= r.sections);
  check(walls.length === 0,
    'M1 chapter bodies render as real paragraphs, not one collapsed block',
    walls.length ? `wall-of-text chapters: ${walls.map(w => w.id).join(', ')}` : `${rows.reduce((s, r) => s + r.paras, 0)} paragraphs across ${rows.length} chapters`);
  const thin = rows.filter(r => r.multiParaSections < Math.ceil(r.sections / 2));
  check(thin.length === 0,
    'M1b ...in at least half of every chapter\'s sections',
    thin.length ? thin.map(t => `${t.id} ${t.multiParaSections}/${t.sections}`).join(', ') : 'ok');

  check(rows.every(r => r.lede.length > 20),
    'M2 every chapter opens with its one-line answer above the sections');

  const long = rows.filter(r => r.words > WORD_CEILING);
  check(long.length === 0, `M3 no chapter runs past the ceiling`,
    long.length ? long.map(l => `${l.id} ${l.words}`).join(', ')
      : `longest ${Math.max(...rows.map(r => r.words))}w · mean ${Math.round(rows.reduce((s, r) => s + r.words, 0) / rows.length)}w`);

  const persona = rows.filter(r => PERSONA.test(r.text));
  check(persona.length === 0, 'M4 the coach narrator is gone',
    persona.length ? persona.map(p => `${p.id}: ${p.text.match(PERSONA)[0]}`).join(' · ') : 'no first person, no asides');
  const shouty = rows.filter(r => /[!?]/.test(r.text));
  check(shouty.length === 0, 'M4b no rhetorical questions and no exclamation marks',
    shouty.map(s => s.id).join(', '));

  check(errors.length === 0, 'zero console/page errors across every chapter', errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${fails === 0 ? 'MANUAL RENDER PROBE PASS' : `MANUAL RENDER PROBE FAIL — ${fails} check(s)`}\n`);
process.exit(fails ? 1 : 0);
