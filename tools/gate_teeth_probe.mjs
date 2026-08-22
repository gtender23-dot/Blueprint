// gate_teeth_probe.mjs — DOES THE GATE HAVE TEETH?
//
// 2026-08-21. Two probes were found within days of each other that PRINT a
// failure and then exit 0: coverage_monotonicity_check (which had been printing
// "HELPS THE RECEIVER (INVERTED)" for seven months while the gate stayed green)
// and time_to_throw_probe (whose sack-neutrality check was failing on two seeds
// in seven, silently). Both were caught by eye. That is not a system.
//
// _gate.mjs judges a probe by its EXIT CODE and nothing else. So a probe that
// can reach a failure conclusion without reaching a non-zero exit is not a
// gate — it is a log file. This probe reads every manifest entry's source and
// flags three shapes:
//
//   NO-EXIT     the file never calls process.exit at all, yet prints a word
//               like FAIL/BAD/INVERTED — it cannot fail, ever.
//   EXIT-0-ONLY every process.exit call is a literal 0.
//   UNGUARDED   it has a failure counter (fails/bad/pass=false…) but the only
//               exit is unconditional 0.
//
// A probe that genuinely cannot fail — a gallery, a report, a fixture
// generator — belongs in the ALLOW list below WITH a reason, not in a grey
// area. That is the whole point: make "this one only reports" a decision
// somebody wrote down, instead of an accident nobody noticed.
//
// Run from repo root: node tools/gate_teeth_probe.mjs
import { readFileSync } from 'node:fs';
import { MANIFEST } from './_gate_manifest.mjs';

// Report-only by design. Each needs a reason; a bare name is not accepted.
const ALLOW = {
  'position_gallery.mjs': 'renders a sprite sheet for eyeballing — no pass/fail concept',
  'scheme_block_gallery.mjs': 'renders block-scheme art for eyeballing',
  'sprite_gallery.mjs': 'renders a sprite sheet for eyeballing',
  'gen_rush_fixture.mjs': 'regenerates a fixture file',
  'gen_sep_fixture.mjs': 'regenerates a fixture file',
  'stat_realism_harness.mjs': 'prints a stat census for the owner to read',
  'pos_ovr_census_probe.mjs': 'prints a positional OVR census',
  'practice_weight_audit.mjs': 'prints a weight audit',
  'deadcode_audit.mjs': 'prints an audit listing',
  'manual_leak_audit.mjs': 'prints an audit listing',
  // 2026-08-21 sweep: these four print a table for the owner to read and say so
  // in their own closing lines. Each was checked by hand before being excused.
  'def_stress_probe.mjs': 'its own footer says a flat dial is a LEAD to chase by hand, not a verdict',
  'broken_tackle_check.mjs': 'a calibration table — "pick the scale where the elite back lands 3-5/g"',
  'commit_rate_test.mjs': 'reports funnel commit rate vs class size; no bar to clear',
  'recruit_calendar_probe.mjs': 'reports what a compressed calendar would do; no bar to clear',
};

const FAILWORD = /\b(FAIL|BAD|INVERTED|MISMATCH|BROKEN|VIOLATION)\b/;
const rows = [];
for (const e of MANIFEST) {
  let src;
  try { src = readFileSync(new URL(e.name, import.meta.url), 'utf8'); }
  catch { rows.push({ name: e.name, kind: 'UNREADABLE', why: 'file not found' }); continue; }

  const exits = [...src.matchAll(/process\.exit\s*\(([^)]*)\)/g)].map((m) => m[1].trim());
  const printsFail = FAILWORD.test(src);
  // a counter the probe increments on a failed check
  const hasCounter = /\b(fails?|bad|failures)\s*(\+\+|\+=)|\bpass\s*=\s*false|\bok\s*=\s*false/.test(src);

  let kind = null;
  if (exits.length === 0) {
    if (printsFail || hasCounter) kind = 'NO-EXIT';
  } else if (exits.every((a) => a === '0')) {
    // every exit is a hard zero
    kind = hasCounter || printsFail ? 'EXIT-0-ONLY' : null;
  } else if (hasCounter && !exits.some((a) => a !== '0' && a !== '')) {
    kind = 'UNGUARDED';
  }
  if (kind) rows.push({ name: e.name, kind, why: `${exits.length} exit(s): ${exits.join(' | ') || 'none'}` });
}

const flagged = rows.filter((r) => !ALLOW[r.name]);
const excused = rows.filter((r) => ALLOW[r.name]);

console.log(`=== GATE TEETH — ${MANIFEST.length} manifest entries scanned ===\n`);
if (excused.length) {
  console.log('report-only by decision:');
  for (const r of excused) console.log(`  ·  ${r.name.padEnd(38)} ${ALLOW[r.name]}`);
  console.log('');
}
if (!flagged.length) {
  console.log('every gating probe can actually fail.\n');
} else {
  console.log('THESE CANNOT FAIL THE GATE:');
  for (const r of flagged) console.log(`  ✗  ${r.name.padEnd(38)} ${r.kind.padEnd(12)} ${r.why}`);
  console.log('');
  console.log('Fix each by adding `process.exit(<failed> ? 1 : 0)`, or add it to ALLOW');
  console.log('above with a reason if it is a report and not a gate.');
}
console.log(flagged.length ? `\n❌ GATE TEETH FAIL (${flagged.length})` : '\nGATE TEETH PASS');
process.exit(flagged.length ? 1 : 0);
