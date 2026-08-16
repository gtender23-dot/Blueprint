// handoff_zip.mjs — package the working source so a fresh session (phone, new container,
// no filesystem carried over) can pick the project up cold.
//
// Deliberately EXCLUDES built output. An earlier handoff shipped an `index.html` that
// collided with the user's live game file, and the whole reconciliation this project came
// out of happened because a built bundle sat next to the source until the source rotted.
// The one `index.html` included here is the 3 KB build SHELL, which is a real input.
//
// Usage: node tools/handoff_zip.mjs
import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, dirname, relative }                            from 'path';
import { fileURLToPath }                                      from 'url';
import { writeZip }                                           from './_zip.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const DIRS  = ['js', 'tools', 'Ref'];
const FILES = [
  'CONTINUE_HERE.md',          // read this first
  'CLAUDE.md',                 // the project rules
  'style.css',
  'index.html',                // the build shell, not the built game
  'sw.js', 'manifest.json',
  'icon-192.png', 'icon-512.png',
  'package.json', 'package-lock.json',
  'RECONCILIATION_REPORT_2026-07-26.md',
  'DRIFT_REPORT_2026-07-26.md',
];
// Everything a fresh container reinstalls or regenerates.
const SKIP = /(^|\/)(node_modules|dist)(\/|$)|\.zip$|(^|\/)cfb_mobile\.html$/;

const files = [];
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const rel = relative(ROOT, p).replace(/\\/g, '/');
    if (SKIP.test(rel)) continue;
    if (statSync(p).isDirectory()) walk(p);
    else files.push({ name: rel, data: readFileSync(p) });
  }
};
for (const d of DIRS) walk(join(ROOT, d));
for (const f of FILES) {
  try { files.push({ name: f, data: readFileSync(join(ROOT, f)) }); }
  catch { console.log(`  (skipped missing ${f})`); }
}

writeZip(join(ROOT, 'blueprint-handoff.zip'), files);
const kb = (statSync(join(ROOT, 'blueprint-handoff.zip')).size / 1024).toFixed(0);
console.log(`blueprint-handoff.zip  ${files.length} files, ${kb} KB`);
for (const d of DIRS) console.log(`  ${d}/`.padEnd(10) + `${files.filter(f => f.name.startsWith(d + '/')).length} files`);
console.log(`  root      ${files.filter(f => !f.name.includes('/')).length} files`);
