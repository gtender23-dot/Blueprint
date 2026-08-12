// dead_surface_probe.mjs — THE DEAD-SURFACE SWEEP (parked-item #1, Aug 2026).
//
// The bug class this exists to kill: the UI lets you set a thing, the engine
// never reads it, and the setting silently does nothing — like the old
// simple-mode `coverageScheme` mismatch. This probe statically extracts EVERY
// key the UI writes into a gameplan/practice object (all three write forms:
// direct `gp.key =`, dataset-driven `data-gp-set="key"` / `data-gp-boolset=`,
// and the situations-grid field lists), then requires each key to appear in
// engine code. A key the UI writes that the engine never reads is a DEAD
// SURFACE and fails the gate — unless it's on the curated UI-only exceptions
// list below, each entry justified.
//
// The reverse direction (engine reads a key no UI writes) prints as INFO
// only: defaults and AI-authored plans legitimately populate keys the player
// UI doesn't expose.
//
// Run: node tools/dead_surface_probe.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not URL.pathname — pathname yields "/C:/…" on Windows and
// join() doubles the drive letter (found 2026-08-10, first local-Windows
// gate run).
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const list = (dir, filter) => readdirSync(join(ROOT, dir)).filter(filter).map((f) => join(dir, f));

const uiFiles = [...list('js/ui/views', (f) => f.endsWith('.js')), 'js/ui/app.js'];
const engineFiles = [...list('js/engine', (f) => f.endsWith('.js')), 'js/state.js', 'js/constants.js'];

// ── Curated UI-only exceptions ─────────────────────────────────────────────
// Keys the UI stores on the plan object for its OWN use (render state that
// wants to persist with the plan). Every entry needs a reason. Anything not
// here that lacks an engine reader FAILS.
const UI_ONLY = new Map([
  // none yet — the first sweep decides what belongs here, with reasons
]);

let pass = 0, fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}`); ok ? pass++ : fail++; };

// ── Extraction: every key the UI writes ────────────────────────────────────
const written = new Map(); // key -> Set of "file:line" evidence
const note = (key, where) => {
  if (!key || key === 'length') return;
  if (!written.has(key)) written.set(key, new Set());
  written.get(key).add(where);
};

const DIRECT = /\b(?:gameplan|gp|practice|plan|prac|pp)\.(\w+)\s*=(?!=)/g;
const DATASET = /data-gp-(?:bool)?set="(\w+)"/g;
const PRACTICE_SET = /data-(?:pp|practice)-set="(\w+)"/g;
// The situations grid writes gp[field] where `field` comes from its own
// dispatch — extract the exact keys from the `field === "key"` comparisons
// and the includes-array, in gameplan.js only. (A generic field-list scan
// swallows stat-table COLUMN LABELS from stats/scout/standings views — 90
// false positives on the first sweep. Display columns are not settings.)
const SIT_EQ = /field === "(\w+)"/g;
const SIT_INCLUDES = /\[((?:"\w+",?\s*)+)\]\.includes\(field\)/g;

for (const f of uiFiles) {
  const src = read(f);
  const lineOf = (idx) => src.slice(0, idx).split('\n').length;
  for (const m of src.matchAll(DIRECT)) note(m[1], `${f}:${lineOf(m.index)}`);
  for (const m of src.matchAll(DATASET)) note(m[1], `${f}:${lineOf(m.index)}`);
  for (const m of src.matchAll(PRACTICE_SET)) note(m[1], `${f}:${lineOf(m.index)}`);
  if (f.endsWith('gameplan.js')) {
    for (const m of src.matchAll(SIT_EQ)) note(m[1], `${f}:${lineOf(m.index)} (situations grid)`);
    for (const m of src.matchAll(SIT_INCLUDES)) {
      for (const q of m[1].matchAll(/"(\w+)"/g)) note(q[1], `${f}:${lineOf(m.index)} (situations grid)`);
    }
  }
}
// Sentinel rule: keys with a `__` prefix are template plumbing — rendered as
// data-gp-set="__x" then .replace()d to a DIFFERENT attribute before the DOM
// ever sees them (see gameplan.js ~956/979). The generic gp-set handler never
// fires for them; they are not writes.
for (const k of [...written.keys()]) if (k.startsWith('__')) written.delete(k);

// ── Engine-read check ──────────────────────────────────────────────────────
const engineSrc = engineFiles.map((f) => ({ f, src: read(f) }));
function engineReads(key) {
  const dot = new RegExp(`\\.${key}\\b`);
  const quoted = new RegExp(`["']${key}["']`);
  const hits = [];
  for (const { f, src } of engineSrc) {
    if (dot.test(src) || quoted.test(src)) hits.push(f);
  }
  return hits;
}

console.log(`\nDEAD-SURFACE SWEEP — ${written.size} UI-writable keys extracted from ${uiFiles.length} UI files, checked against ${engineFiles.length} engine files`);

const dead = [];
const alive = [];
for (const [key, evidence] of [...written.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const hits = engineReads(key);
  if (hits.length) alive.push(key);
  else if (UI_ONLY.has(key)) alive.push(key + ' (UI-only, vetted)');
  else dead.push({ key, evidence: [...evidence][0] });
}

console.log(`\n  live keys: ${alive.length}`);
if (dead.length) {
  console.log(`\n  DEAD SURFACES — written by the UI, read by nothing:`);
  for (const d of dead) console.log(`    ${d.key}  (written at ${d.evidence})`);
}
check(dead.length === 0, dead.length === 0
  ? `every UI-writable key has an engine reader — no setting lies to the player`
  : `${dead.length} dead surface(s): ${dead.map((d) => d.key).join(', ')}`);

// ── Reverse direction (INFO only, no gate) ─────────────────────────────────
// Gameplan keys the ENGINE reads off gp/gameplan that no UI write produces.
// Legitimate for defaults/AI-authored fields; printed for awareness.
{
  const engineKeyRe = /\b(?:gameplan|gp|offPlan|defPlan)\.(\w+)\b/g;
  const engineKeys = new Set();
  for (const { src } of engineSrc) for (const m of src.matchAll(engineKeyRe)) engineKeys.add(m[1]);
  const uiKeys = new Set(written.keys());
  const unwritten = [...engineKeys].filter((k) => !uiKeys.has(k) && !k.startsWith('_')).sort();
  console.log(`\n  INFO — engine-read gameplan keys with no UI write (defaults/AI-authored; not gated): ${unwritten.length}`);
  if (unwritten.length) console.log(`    ${unwritten.slice(0, 30).join(', ')}${unwritten.length > 30 ? ', …' : ''}`);
}

console.log(`\n${'='.repeat(50)}\n${fail === 0 ? 'ALL GREEN' : 'FAILURES: ' + fail} (${pass} passed)`);
process.exit(fail ? 1 : 0);
