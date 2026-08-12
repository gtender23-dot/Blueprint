// _reconcile.mjs — drift verifier for the bundle→source reconciliation.
//
// Builds the JS bundle from js/ (in memory; never touches cfb_mobile.html or sw.js), splits
// it by esbuild's `// js/<path>.js` module markers, and compares each module chunk against
// the authoritative chunk in /tmp/split_AUTH.
//
// THE GATE IS THE SEMANTIC DIFF (see _canon.mjs). Both sides are minified and re-printed,
// so formatting the bundle's hand-edits carry but esbuild can never re-emit — trailing
// comments, `0.006` vs `6e-3`, hand-wrapped arrays, one-line blocks — does not count as
// drift. What the gate measures is whether the rebuilt game behaves identically.
//
// The diff shown to you is the READABLE one (pretty-printed, one statement per line), which
// points at the line to actually change.
//
// Usage:
//   node tools/_reconcile.mjs                    → drift table for every module + CSS
//   node tools/_reconcile.mjs <filter>           → only modules whose name contains <filter>
//   node tools/_reconcile.mjs <filter> --diff    → also print the readable diff
//   node tools/_reconcile.mjs <filter> --sem     → print the semantic diff (what the gate sees)
//   node tools/_reconcile.mjs <filter> --raw     → print the untouched diff, comments included
//   node tools/_reconcile.mjs <filter> --tag=xyz → private build path, for parallel workers
//
// Exit 0 only when every selected module has zero semantic drift (ignoring the accepted
// artifacts in _reconcile_accepted.json) and, when unfiltered, style.css matches.

import { execSync }                                   from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'fs';
import { join, dirname }                              from 'path';
import { fileURLToPath }                              from 'url';
import { readable, semantic }                         from './_canon.mjs';

const ROOT     = join(dirname(fileURLToPath(import.meta.url)), '..');
const AUTH_DIR = '/tmp/split_AUTH';

const args     = process.argv.slice(2);
const filter   = args.find(a => !a.startsWith('--')) || '';
const wantDiff = args.includes('--diff');
const wantSem  = args.includes('--sem');
const wantRaw  = args.includes('--raw');
const tag      = (args.find(a => a.startsWith('--tag=')) || '--tag=main').slice(6);
const TMP_JS   = `_rc_${tag}.js`;
const CUR_DIR  = `/tmp/split_CUR_${tag}`;

// Hunks that no source can reproduce, enumerated with a reason. See the JSON file.
let accepted = {};
try { accepted = JSON.parse(readFileSync(join(ROOT, 'tools/_reconcile_accepted.json'), 'utf8')); } catch {}

// ── 1. bundle ────────────────────────────────────────────────────────────────
execSync(
  `npx --yes esbuild js/ui/app.js --bundle --format=iife --global-name=_CFB --target=es2017 --outfile=${TMP_JS}`,
  { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] },
);
const js = readFileSync(join(ROOT, TMP_JS), 'utf8');
rmSync(join(ROOT, TMP_JS), { force: true });

// ── 2. split by module marker ────────────────────────────────────────────────
function splitChunks(text) {
  const lines = text.split('\n');
  const marks = [];
  lines.forEach((l, i) => {
    const m = l.match(/^  \/\/ (js\/.*\.js)$/);
    if (m) marks.push([i, m[1]]);
  });
  const acc = {};
  for (let k = 0; k < marks.length; k++) {
    const [i, name] = marks[k];
    const end = k + 1 < marks.length ? marks[k + 1][0] : lines.length;
    (acc[name] ||= []).push(...lines.slice(i, end));
  }
  return acc;
}

const cur = splitChunks(js);
rmSync(CUR_DIR, { recursive: true, force: true });
for (const d of ['', '/sem', '/read']) mkdirSync(CUR_DIR + d, { recursive: true });

const selected = n => !filter || n.includes(filter);

for (const [name, body] of Object.entries(cur)) {
  const fn   = name.replace(/\//g, '~');
  const text = body.join('\n');
  writeFileSync(join(CUR_DIR, fn), text);
  if (!selected(fn)) continue;
  for (const [sub, fnc] of [['sem', semantic], ['read', readable]]) {
    let out; try { out = await fnc(text); } catch { out = text; }
    writeFileSync(join(CUR_DIR, sub, fn), out);
  }
}

// ── 3. cached normalized mirrors of the authoritative chunks ─────────────────
const AUTH_SEM  = '/tmp/split_AUTH_sem';
const AUTH_READ = '/tmp/split_AUTH_read';
for (const d of [AUTH_SEM, AUTH_READ]) mkdirSync(d, { recursive: true });
for (const n of readdirSync(AUTH_DIR)) {
  if (!selected(n)) continue;
  const src = readFileSync(join(AUTH_DIR, n), 'utf8');
  for (const [dir, fnc] of [[AUTH_SEM, semantic], [AUTH_READ, readable]]) {
    const dst = join(dir, n);
    if (existsSync(dst)) continue;                       // AUTH never changes
    let out; try { out = await fnc(src); } catch { out = src; }
    writeFileSync(dst, out);
  }
}

// ── 4. diff ──────────────────────────────────────────────────────────────────
function numstat(a, b) {
  const out = execSync(`git diff --no-index --numstat "${a}" "${b}" 2>/dev/null || true`,
    { encoding: 'utf8' }).trim();
  if (!out) return [0, 0];
  const [add, del] = out.split(/\s+/);
  return [Number(add) || 0, Number(del) || 0];
}

const authNames = readdirSync(AUTH_DIR).sort();
const rows = [];
let semAdd = 0, semDel = 0, dirty = 0, acceptedHit = 0;

for (const n of authNames) {
  if (!selected(n)) continue;
  if (!existsSync(join(CUR_DIR, 'sem', n))) { rows.push([n, 'MISSING FROM BUILD']); dirty++; continue; }
  const [sa, sd] = numstat(join(CUR_DIR, 'sem', n),  join(AUTH_SEM, n));
  const [ra, rd] = numstat(join(CUR_DIR, 'read', n), join(AUTH_READ, n));
  const allow = accepted[n];
  if (sa + sd > 0 && allow && sa <= allow.lines && sd <= allow.lines) {
    acceptedHit++; rows.push([n, `ACCEPTED: ${allow.why}`, sa, sd, ra, rd]);
    continue;
  }
  semAdd += sa; semDel += sd;
  if (sa || sd) { dirty++; rows.push([n, '', sa, sd, ra, rd]); }
}

for (const n of readdirSync(join(CUR_DIR, 'sem'))) {
  if (!selected(n)) continue;
  if (!authNames.includes(n)) { rows.push([n, 'NOT IN AUTHORITATIVE BUNDLE']); dirty++; }
}

// ── 5. CSS (inlined verbatim, so a plain diff is correct) ────────────────────
let cssAdd = 0, cssDel = 0;
if (!filter) {
  const strip = t => t.split('\n').filter(l => !/^\s*$/.test(l)).join('\n');
  writeFileSync('/tmp/CUR.code.css', strip(readFileSync(join(ROOT, 'style.css'), 'utf8')));
  [cssAdd, cssDel] = numstat('/tmp/CUR.code.css', '/tmp/AUTH.code.css');
}

// ── 6. report ────────────────────────────────────────────────────────────────
if (rows.length) {
  console.log('module'.padEnd(32) + 'GATE: semantic   (layout only)');
  for (const r of rows.sort((a, b) => (Number(b[2]) + Number(b[3])) - (Number(a[2]) + Number(a[3])))) {
    const [n, note, sa, sd, ra, rd] = r;
    if (sa === undefined) { console.log(`${n.padEnd(32)}${note}`); continue; }
    console.log(`${n.padEnd(32)}+${String(sa).padEnd(5)}-${String(sd).padEnd(6)}   (+${ra} / -${rd})${note ? '  ' + note : ''}`);
  }
}

console.log('');
console.log(`modules failing the gate: ${dirty}   semantic lines to reconcile: +${semAdd} / -${semDel}`);
if (acceptedHit) console.log(`accepted bundle artifacts (not failures): ${acceptedHit}`);
if (!filter) console.log(`style.css drift: +${cssAdd} / -${cssDel}`);

if (wantDiff || wantSem || wantRaw) {
  const [dir, authDir] = wantRaw ? ['',     AUTH_DIR]
                       : wantSem ? ['sem',  AUTH_SEM]
                                 : ['read', AUTH_READ];
  for (const r of rows) {
    if (r[2] === undefined) continue;
    console.log(`\n############################## ${r[0]}`);
    console.log(execSync(
      `git diff --no-index -U6 "${join(CUR_DIR, dir, r[0])}" "${join(authDir, r[0])}" 2>/dev/null || true`,
      { encoding: 'utf8', maxBuffer: 1 << 28 }));
  }
}

const clean = dirty === 0 && (filter ? true : cssAdd === 0 && cssDel === 0);
if (clean) console.log('\nGATE PASSED — a build from js/ is semantically identical to the authoritative bundle.');
process.exit(clean ? 0 : 1);
