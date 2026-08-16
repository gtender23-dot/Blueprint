// help_coverage_audit.mjs — is the help system actually WIRED to the game?
//
// manual_leak_audit.mjs proves the help CONTENT is safe (no numbers). Nothing
// proved it was CONNECTED. Written Aug 2026 after a by-hand review found that
// 31 tips existed and only 16 had ever been placed on a screen, and that every
// system built from W3 on (coaching points, role dials, Buy-In, academics, the
// tree) had no help affordance at all. Both are invisible failures: an unplaced
// tip is content nobody can reach, and a MISSPELLED tip id degrades silently to
// plain text — `tipTerm` is deliberately forgiving, so a dead control looks
// exactly like a live one on screen. Only a scan catches either.
//
// What it checks
//   FAIL  1. A screen references a tip id that doesn't exist  → dead control.
//   FAIL  2. A tip deep-links a chapter id that doesn't exist → dead link.
//   FAIL  3. The screen→chapter help map names a chapter that doesn't exist.
//   WARN  4. A tip is defined but never placed on any screen  → unreachable.
//   WARN  5. A manual chapter no screen's ? can reach         → orphan chapter.
//   WARN  6. A chapter with no CONTEXT_HELP_SUMMARIES entry   → generic ? panel.
//   INFO  7. Per-view affordance counts, so thin screens are visible.
//
// WARNs never fail the build — an orphan reference chapter (The Position Room
// is reached from a card tooltip, not a ?) and a deliberately-unplaced tip are
// both legitimate. FAILs are always real: they are controls that look alive and
// are not. Exit code is nonzero on FAIL only, so this can join the gate.
//
// Run from repo root:  node tools/help_coverage_audit.mjs [--verbose]
import { readFileSync, readdirSync } from 'fs';
import { TIPS } from '../js/ui/manual/tips.js';
import { MANUAL_CHAPTERS } from '../js/ui/manual/index.js';

const VERBOSE = process.argv.includes('--verbose');
const UI_DIR = 'js/ui';
const chapterIds = new Set(MANUAL_CHAPTERS.map(c => c.id));
const tipIds = new Set(Object.keys(TIPS));

// ── collect every UI source file ─────────────────────────────────────────────
function uiFiles(dir, acc = []) {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${f.name}`;
    if (f.isDirectory()) { if (f.name !== 'manual') uiFiles(p, acc); }
    else if (f.name.endsWith('.js')) acc.push(p);
  }
  return acc;
}
const files = uiFiles(UI_DIR);

// ── 1 · where are tips actually placed? ──────────────────────────────────────
// Both spellings count: tipTerm('id', …) is the normal path, data-tip="id" is
// hand-rolled markup (the player card does one that way).
const placed = new Map();           // tipId → [file, …]
const perView = new Map();          // file   → count
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  let n = 0;
  // Three spellings count. tipTerm('id', …) is the normal path; data-tip="id"
  // is hand-rolled markup; helpTip: 'id' is a config-object field a renderer
  // later feeds to tipTerm. The third was added after this audit reported a
  // correctly-placed tip as unplaced — it could not see through the indirection.
  for (const re of [/tipTerm\(\s*'([a-z0-9-]+)'/g, /data-tip="([a-z0-9-]+)"/g, /helpTip:\s*'([a-z0-9-]+)'/g]) {
    for (const m of src.matchAll(re)) {
      const id = m[1];
      if (!placed.has(id)) placed.set(id, []);
      if (!placed.get(id).includes(file)) placed.get(id).push(file);
      n++;
    }
  }
  if (n) perView.set(file, n);
}

// ── 2 · which chapters can a ? actually reach? ───────────────────────────────
// Read the map out of app.js as text rather than importing it (app.js pulls in
// the whole UI and expects a DOM). Deliberately loose: any quoted chapter-shaped
// id inside the three HELP_CHAPTER_* declarations counts as reachable.
const appSrc = readFileSync(`${UI_DIR}/app.js`, 'utf8');
function block(name) {
  const i = appSrc.indexOf(name);
  if (i < 0) return '';
  const end = appSrc.indexOf('\n};', i);
  return appSrc.slice(i, end < 0 ? i + 2000 : end);
}
// The two object literals and the live-game const are bounded by '\n};' / one
// line. helpChapterFor is a function whose body contains no such terminator, so
// it is scanned SEPARATELY with a return-literal regex — slicing it by brace
// would overrun into unrelated code and start reporting CSS class names as
// broken chapter ids. (It did, on the first run.)
const helpFnSrc = (() => {
  const i = appSrc.indexOf('function helpChapterFor');
  return i < 0 ? '' : appSrc.slice(i, appSrc.indexOf('\n}', i));
})();
const mapSrc = [
  block('const HELP_CHAPTER_FLAT'),
  block('const HELP_CHAPTER_GROUP'),
  appSrc.slice(appSrc.indexOf('HELP_CHAPTER_LIVEGAME'), appSrc.indexOf('HELP_CHAPTER_LIVEGAME') + 120),
  // Only the RETURNED literals from helpChapterFor — its tab keys and guards
  // are not chapter ids.
  [...helpFnSrc.matchAll(/return\s+[^;]*?'([a-z][a-z0-9-]+)'/g)].map(m => `'${m[1]}'`).join('\n'),
].join('\n');
const reachable = new Set([...mapSrc.matchAll(/'([a-z][a-z0-9-]{3,})'/g)]
  .map(m => m[1]).filter(id => chapterIds.has(id)));

// Chapters reachable from a tip's deep-link count as reachable too — that's the
// documented second door, and it's how the Position Room is meant to be found.
for (const t of Object.values(TIPS)) if (t.chapter) reachable.add(t.chapter);

const summarised = new Set([...block('const CONTEXT_HELP_SUMMARIES')
  .matchAll(/^\s*'?([a-z][a-z0-9-]{3,})'?\s*:\s*\{/gm)].map(m => m[1])
  .filter(id => chapterIds.has(id)));

// ── findings ─────────────────────────────────────────────────────────────────
const fails = [], warns = [];

for (const [id, where] of placed) {
  if (!tipIds.has(id)) fails.push(`DEAD CONTROL   tip '${id}' is placed but not defined — renders as plain text\n                 ${where.join(', ')}`);
}
for (const [id, tip] of Object.entries(TIPS)) {
  if (tip.chapter && !chapterIds.has(tip.chapter)) fails.push(`DEAD LINK      tip '${id}' deep-links chapter '${tip.chapter}', which does not exist`);
}
// A chapter id in this map is always a VALUE — right of a colon, or returned.
// View keys (team, program, coachoffice) sit left of a colon and are skipped,
// so a bare word is only checked when it's genuinely in a chapter position.
for (const m of mapSrc.matchAll(/(?::\s*|return\s+(?:[^;']*?)?)'([a-z][a-z0-9-]{3,})'/g)) {
  const id = m[1];
  if (!chapterIds.has(id)) fails.push(`BROKEN MAP     the screen→chapter map points at '${id}', which is not a live chapter`);
}

for (const id of tipIds) if (!placed.has(id)) warns.push(`UNPLACED       tip '${id}' (${TIPS[id].term}) is written but sits on no screen`);
for (const c of MANUAL_CHAPTERS) if (!reachable.has(c.id)) warns.push(`ORPHAN CHAPTER '${c.id}' — no screen's ? and no tip link reaches it`);
for (const c of MANUAL_CHAPTERS) if (reachable.has(c.id) && !summarised.has(c.id)) warns.push(`NO SUMMARY     '${c.id}' is reachable but has no CONTEXT_HELP_SUMMARIES entry — the ? shows the generic panel`);

// ── report ───────────────────────────────────────────────────────────────────
console.log(`Help coverage — ${MANUAL_CHAPTERS.length} chapters · ${tipIds.size} tips · ${[...perView.values()].reduce((a, b) => a + b, 0)} affordances across ${perView.size} views\n`);

if (fails.length) { console.log('FAIL'); for (const f of fails) console.log('  ' + f); console.log(''); }
if (warns.length) {
  console.log(`REVIEW (${warns.length}) — not build-breaking, but each one is help nobody can reach:`);
  for (const w of warns) console.log('  ' + w);
  console.log('');
}
if (VERBOSE) {
  console.log('Affordances per view:');
  for (const [f, n] of [...perView.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${f}`);
  const bare = files.filter(f => !perView.has(f) && !/\/(manual|settings|mainmenu|playnow|newgame)\.js$/.test(f));
  if (bare.length) { console.log('\nViews with no help affordance at all:'); for (const f of bare) console.log('  ' + f); }
  console.log('');
}

const placedCount = [...tipIds].filter(id => placed.has(id)).length;
console.log(`${placedCount}/${tipIds.size} tips placed · ${reachable.size}/${chapterIds.size} chapters reachable · ${fails.length} fail, ${warns.length} to review`);
if (!fails.length) console.log('\nHELP COVERAGE PASS — every placed control is live and every link resolves.');
process.exit(fails.length ? 1 : 0);
