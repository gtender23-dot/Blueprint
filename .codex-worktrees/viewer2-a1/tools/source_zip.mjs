// Package the complete handoff source with built Pages output, excluding only
// reinstallable dependencies and local QA artifacts.
// Usage: node tools/source_zip.mjs [output.zip]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeZip } from './_zip.mjs';

const ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'));
const PREFIX = 'Blueprint-College_Football_Dynasty/';
const OUTPUT = resolve(process.argv[2] || join(ROOT, 'Blueprint-College_Football_Dynasty-sideline-source.zip'));
const DIRS = ['js', 'tools', 'Ref', 'dist'];
const FILES = [
  'AGENTS.md', 'CLAUDE.md', 'CONTINUE_HERE.md',
  'DRIFT_REPORT_2026-07-26.md', 'RECONCILIATION_REPORT_2026-07-26.md',
  'style.css', 'index.html', 'sw.js', 'manifest.json',
  'icon-192.png', 'icon-512.png', 'package.json', 'package-lock.json',
  'blueprint-pages.zip',
];
const SKIP = /(^|\/)(node_modules|qa-shots)(\/|$)|(^|\/)\.git(\/|$)|\.zip$/i;

const files = [];
const add = (absolute, rel) => files.push({
  name: PREFIX + rel.replace(/\\/g, '/'),
  data: readFileSync(absolute),
});
const walk = dir => {
  for (const name of readdirSync(dir)) {
    const absolute = join(dir, name);
    const rel = relative(ROOT, absolute).replace(/\\/g, '/');
    if (SKIP.test(rel)) continue;
    if (statSync(absolute).isDirectory()) walk(absolute);
    else add(absolute, rel);
  }
};

for (const dir of DIRS) walk(join(ROOT, dir));
for (const file of FILES) add(join(ROOT, file), file);

writeZip(OUTPUT, files);
const sizeKb = (statSync(OUTPUT).size / 1024).toFixed(0);
console.log(`${OUTPUT}  ${files.length} files, ${sizeKb} KB`);
for (const dir of DIRS) {
  const prefix = PREFIX + dir + '/';
  console.log(`  ${dir}/`.padEnd(10) + `${files.filter(file => file.name.startsWith(prefix)).length} files`);
}
console.log(`  root      ${files.filter(file => !file.name.slice(PREFIX.length).includes('/')).length} files`);
