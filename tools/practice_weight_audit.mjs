// practice_weight_audit.mjs — does practice train what overall actually rewards?
//
// Two tables have to agree and nothing enforces it:
//   POS_WEIGHTS          (js/constants.js)        what each attribute is worth to OVR
//   DEFAULT_POSITION_PLANS (js/ui/views/practice.js)  where a position's 100 minutes go
//
// They interact through js/engine/development.js, which builds attrWeight from
// practice minutes × PRACTICE_TOOLS and then does:
//
//     if (w === 0) continue;
//
// So an attribute with ZERO practice weight gets ZERO growth — permanently. An attribute
// that matters to OVR but has no drill minutes can never improve, and minutes spent on an
// attribute worth 0 to OVR are burned.
//
// Read-only: this parses practice.js rather than importing it, so running the audit can't
// change what ships.
//
// Usage: node tools/practice_weight_audit.mjs

import { POS_WEIGHTS, PRACTICE_TOOLS, POSITIONS } from '../js/constants.js';
import { planFromWeights }                          from '../js/ui/views/practice.js';

// Import the real derivation rather than re-implementing it, so this audit can never
// pass while the shipped plans say something different.
const GROUP_IDS = POSITIONS.filter(p => POS_WEIGHTS[p]);
const PLANS = Object.fromEntries(GROUP_IDS.map(p => [p, planFromWeights(p)]));

// Replicate development.js exactly: minutes → per-attribute training weight.
// Split by primary vs secondary, because they mean different things. A drill's PRIMARY
// attribute is where its minutes were deliberately spent; the SECONDARY is half-rate
// spillover baked into PRACTICE_TOOLS (the catching drill also works ball security). Only
// primary misallocation is a planning error — spillover onto an attribute a position
// doesn't need is just how the drill table works, and costs nothing.
function trainWeight(plan) {
  const total = Object.values(plan).reduce((s, v) => s + v, 0);
  const primary = {}, secondary = {};
  for (const [tool, minutes] of Object.entries(plan)) {
    if (minutes <= 0) continue;
    for (const [attr, aw] of Object.entries(PRACTICE_TOOLS[tool] || {})) {
      const bucket = attr === tool ? primary : secondary;
      bucket[attr] = (bucket[attr] || 0) + (minutes / total) * aw;
    }
  }
  const all = {};
  for (const k of new Set([...Object.keys(primary), ...Object.keys(secondary)]))
    all[k] = (primary[k] || 0) + (secondary[k] || 0);
  return Object.assign(all, { _primary: primary, _secondary: secondary });
}

const ATTRS = ['SPD', 'AGI', 'PWR', 'STR', 'JMP', 'HND', 'SEC', 'BLK', 'TKL', 'TEC', 'AWR'];
const pct = n => (n * 100);

console.log('OVR share vs PRACTICE share, per position (both normalized to 100%)');
console.log('  ovr = share of the overall rating   prac = share of training effect\n');

const dead = [], wasted = [];
for (const pos of GROUP_IDS) {
  const w = POS_WEIGHTS[pos];
  const plan = PLANS[pos];
  if (!w || !plan) { console.log(`${pos}: MISSING (${!w ? 'no POS_WEIGHTS' : ''}${!plan ? 'no practice plan' : ''})`); continue; }
  const wTot = Object.values(w).reduce((s, v) => s + v, 0);
  const tw = trainWeight(plan);

  const rows = ATTRS.map(a => {
    const ovr  = pct((w[a] || 0) / wTot);
    const prac = pct(tw[a] || 0);
    return { a, ovr, prac, gap: prac - ovr };
  }).filter(r => r.ovr > 0 || r.prac > 0);

  console.log(`── ${pos}`);
  console.log('   attr   ovr%   prac%     gap');
  for (const r of rows) {
    let flag = '';
    if (r.ovr > 0 && r.prac === 0) { flag = '  <-- MATTERS BUT CANNOT BE TRAINED'; dead.push([pos, r.a, r.ovr]); }
    else if (r.prac > 0 && r.ovr === 0) {
      const isPrimary = (tw._primary[r.a] || 0) > 0;
      flag = isPrimary ? '  <-- MINUTES SPENT ON SOMETHING OVR IGNORES' : '  (half-rate spillover, costs nothing)';
      if (isPrimary) wasted.push([pos, r.a, r.prac]);
    }
    console.log(`   ${r.a.padEnd(5)}${r.ovr.toFixed(1).padStart(6)}${r.prac.toFixed(1).padStart(7)}${(r.gap >= 0 ? '+' : '') + r.gap.toFixed(1).padStart(7)}${flag}`);
  }
  console.log('');
}

console.log('='.repeat(72));
console.log('\nDEAD WEIGHT — counts toward OVR, gets zero practice, so it never grows:');
if (!dead.length) console.log('  (none)');
for (const [pos, a, ovr] of dead.sort((x, y) => y[2] - x[2])) {
  console.log(`  ${pos.padEnd(4)} ${a.padEnd(5)} ${ovr.toFixed(1)}% of overall — permanently frozen`);
}
console.log('\nWASTED MINUTES — drill minutes deliberately spent on something OVR ignores:');
if (!wasted.length) console.log('  (none)');
for (const [pos, a, prac] of wasted.sort((x, y) => y[2] - x[2])) {
  console.log(`  ${pos.padEnd(4)} ${a.padEnd(5)} ${prac.toFixed(1)}% of training effect`);
}

console.log('\nPOS_WEIGHTS rows with no live position (dead data):');
const orphans = Object.keys(POS_WEIGHTS).filter(p => !GROUP_IDS.includes(p));
console.log(orphans.length ? '  ' + orphans.join(', ') + '   (kept only if a ROLE_WEIGHTS role needs them)' : '  (none)');

console.log('\nPWR SPECIFICALLY — is power trainable everywhere it counts?');
for (const pos of GROUP_IDS) {
  const w = POS_WEIGHTS[pos]; const plan = PLANS[pos];
  if (!w || !plan) continue;
  const wTot = Object.values(w).reduce((s, v) => s + v, 0);
  const ovr = pct((w.PWR || 0) / wTot), prac = pct(trainWeight(plan).PWR || 0);
  const verdict = ovr === 0 && prac === 0 ? 'n/a'
    : ovr > 0 && prac === 0 ? 'BROKEN — counts, cannot train'
    : ovr === 0 && prac > 0 ? 'trains for nothing'
    : 'ok';
  console.log(`  ${pos.padEnd(4)} ovr ${ovr.toFixed(1).padStart(5)}%   prac ${prac.toFixed(1).padStart(5)}%   ${verdict}`);
}
