// deadcode_audit.mjs — find leftovers: exports nobody imports, C.* constants nobody reads.
//
// Written after the Jul 2026 recruiting overhaul deleted the pre-rolled commit calendar but
// left its constants behind. Being conservative on purpose:
//   * a symbol used by tools/ is NOT dead — the probe suite is the test suite
//   * anything reachable by dynamic access (C[expr], ROLE_WEIGHTS[role]) is flagged as
//     UNCERTAIN rather than dead, because a grep can't see those
//
// Usage: node tools/deadcode_audit.mjs
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname }                       from 'path';
import { fileURLToPath }                       from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (d, out = []) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith('.js') || f.endsWith('.mjs')) out.push(p);
  }
  return out;
};
const jsFiles    = walk(join(ROOT, 'js'));
const toolFiles  = walk(join(ROOT, 'tools'));
const read = p => readFileSync(p, 'utf8');
const src  = Object.fromEntries([...jsFiles, ...toolFiles].map(p => [p, read(p)]));
const rel  = p => p.slice(ROOT.length + 1).replace(/\\/g, '/');

// ── 1. exported symbols with no consumer ────────────────────────────────────
const exports_ = [];
for (const f of jsFiles) {
  for (const m of src[f].matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    exports_.push({ name: m[1], file: f });
  }
}
const deadExports = [];
for (const { name, file } of exports_) {
  const re = new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`, 'g');
  let usesElsewhere = 0, usesInTools = 0, usesInOwnFile = 0;
  for (const f of jsFiles) {
    const n = (src[f].match(re) || []).length;
    if (f === file) usesInOwnFile += n; else usesElsewhere += n;
  }
  for (const f of toolFiles) usesInTools += (src[f].match(re) || []).length;
  // 1 hit in its own file is the declaration itself.
  if (usesElsewhere === 0 && usesInTools === 0 && usesInOwnFile <= 1) {
    deadExports.push({ name, file: rel(file) });
  } else if (usesElsewhere === 0 && usesInTools > 0) {
    deadExports.push({ name, file: rel(file), toolsOnly: usesInTools });
  }
}

console.log('EXPORTS WITH NO CONSUMER IN js/');
const trulyDead = deadExports.filter(d => !d.toolsOnly);
const toolsOnly = deadExports.filter(d => d.toolsOnly);
if (!trulyDead.length) console.log('  (none)');
for (const d of trulyDead) console.log(`  ${d.file.padEnd(34)} ${d.name}`);
console.log('\nEXPORTED FOR tools/ ONLY (keep — the probes are the test suite)');
if (!toolsOnly.length) console.log('  (none)');
for (const d of toolsOnly) console.log(`  ${d.file.padEnd(34)} ${d.name}  (${d.toolsOnly} uses)`);

// ── 2. C.* constants nobody reads ───────────────────────────────────────────
const cBlock = src[join(ROOT, 'js/constants.js')];
const cStart = cBlock.indexOf('export const C = {');
const cEnd   = cBlock.indexOf('\n};', cStart);
// Collect TOP-LEVEL keys only. Two traps here, both of which bit during the Jul 2026
// cleanup: keys can share a line (`REP_WIN: 2, REP_HEAL: 1,`), so an anchored per-line
// regex under-reports; and a position-free regex reaches INTO nested objects, flagging
// e.g. FACILITIES.TRAINING_PER_LVL as dead because nothing writes `C.TRAINING_PER_LVL`.
// Deleting that gutted FACILITIES to {}. So: scan with a depth counter, depth 1 only.
const keys = (() => {
  const body = cBlock.slice(cBlock.indexOf('{', cStart), cEnd);
  const out = []; let depth = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '"' || ch === "'") { const q = ch; i++; while (i < body.length && body[i] !== q) { if (body[i] === '\\') i++; i++; } continue; }
    if (ch === '{' || ch === '[') { depth++; continue; }
    if (ch === '}' || ch === ']') { depth--; continue; }
    if (depth !== 1) continue;
    const m = /^([A-Z][A-Z0-9_]{2,})\s*:/.exec(body.slice(i));
    if (m && (i === 0 || /[\s{,]/.test(body[i - 1]))) { out.push(m[1]); i += m[0].length - 1; }
  }
  return [...new Set(out)];
})();

const dynamicC = /C\[[^\]]+\]/.test(Object.values(src).join('\n'));
const deadConsts = [];
for (const k of keys) {
  const re = new RegExp(`C\\.${k}\\b`, 'g');
  let inJs = 0, inTools = 0;
  for (const f of jsFiles)   inJs    += (src[f].match(re) || []).length;
  for (const f of toolFiles) inTools += (src[f].match(re) || []).length;
  if (inJs === 0) deadConsts.push({ k, inTools });
}
console.log('\nC.* CONSTANTS WITH NO READER IN js/');
if (!deadConsts.length) console.log('  (none)');
for (const d of deadConsts) {
  console.log(`  C.${(d.k + ' ').padEnd(32)}${d.inTools ? `referenced by ${d.inTools} tool(s) — check before removing` : 'DEAD'}`);
}
if (dynamicC) console.log('\n  NOTE: dynamic C[...] access exists somewhere — verify by hand before deleting.');

// ── 3. modules nobody imports ───────────────────────────────────────────────
console.log('\nMODULES NOT IMPORTED BY ANY OTHER MODULE');
let orphans = 0;
for (const f of jsFiles) {
  const base = rel(f).split('/').pop();
  const importedBy = jsFiles.filter(o => o !== f && new RegExp(`from\\s+['"][^'"]*${base.replace('.', '\\.')}['"]`).test(src[o]));
  if (!importedBy.length && !rel(f).endsWith('ui/app.js')) {
    const byTools = toolFiles.some(o => new RegExp(`${base.replace('.', '\\.')}`).test(src[o]));
    console.log(`  ${rel(f)}${byTools ? '   (used by tools/)' : '   ORPHAN'}`);
    orphans++;
  }
}
if (!orphans) console.log('  (none)');
