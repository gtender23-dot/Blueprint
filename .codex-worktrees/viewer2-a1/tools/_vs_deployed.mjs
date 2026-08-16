// _vs_deployed.mjs — RAW comparison of a build against the previously deployed bundle.
//
// tools/_reconcile.mjs scores SEMANTICS and deliberately ignores comments. That is right
// for "does it behave the same", but it is blind to one thing that matters: esbuild keeps
// comments that sit before an object property or array element, so those comments are
// SHIPPED BYTES. Trademark scrubbing partly lives in exactly such comments.
//
// This compares raw text, per module, and separates comment-only differences from code.
// Usage: node tools/_vs_deployed.mjs <deployed.html> <mine.html>
import { readFileSync } from 'fs';
import { execSync }     from 'child_process';
import { writeFileSync, mkdirSync, rmSync } from 'fs';

const grab = (p) => {
  const s = readFileSync(p, 'utf8');
  const a = s.indexOf('<script>'), b = s.indexOf('</script>', a);
  return s.slice(a + 8, b);
};
const split = (t) => {
  const lines = t.split('\n'); const marks = [];
  lines.forEach((l, i) => { const m = l.match(/^  \/\/ (js\/.*\.js)$/); if (m) marks.push([i, m[1]]); });
  const acc = {};
  for (let k = 0; k < marks.length; k++) {
    const [i, n] = marks[k];
    const end = k + 1 < marks.length ? marks[k + 1][0] : lines.length;
    (acc[n] ||= []).push(...lines.slice(i, end));
  }
  return acc;
};
const A = split(grab(process.argv[2]));   // deployed
const B = split(grab(process.argv[3]));   // mine
for (const d of ['/tmp/vsA', '/tmp/vsB']) { rmSync(d, { recursive: true, force: true }); mkdirSync(d, { recursive: true }); }

const names = [...new Set([...Object.keys(A), ...Object.keys(B)])].sort();
let totComment = 0, totCode = 0;
const rows = [];
for (const n of names) {
  const f = n.replace(/\//g, '~');
  writeFileSync(`/tmp/vsA/${f}`, (A[n] || []).join('\n'));
  writeFileSync(`/tmp/vsB/${f}`, (B[n] || []).join('\n'));
  const raw = execSync(`git diff --no-index --numstat /tmp/vsA/${f} /tmp/vsB/${f} 2>/dev/null || true`, { encoding: 'utf8' }).trim();
  if (!raw) continue;
  // classify: how many of the differing lines are comment-only?
  const d = execSync(`git diff --no-index -U0 /tmp/vsA/${f} /tmp/vsB/${f} 2>/dev/null || true`, { encoding: 'utf8', maxBuffer: 1 << 28 });
  const changed = d.split('\n').filter(l => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l));
  const commentLines = changed.filter(l => /^[+-]\s*\/\//.test(l)).length;
  const codeLines = changed.length - commentLines;
  totComment += commentLines; totCode += codeLines;
  rows.push([f, commentLines, codeLines]);
}
rows.sort((a, b) => (b[1] + b[2]) - (a[1] + a[2]));
console.log('module'.padEnd(32) + 'comment-only   code');
for (const [f, c, k] of rows) console.log(`${f.padEnd(32)}${String(c).padEnd(15)}${k}${k ? '   <-- CODE DIFFERS' : ''}`);
console.log(`\nTOTAL differing lines — comments: ${totComment}   code: ${totCode}`);
