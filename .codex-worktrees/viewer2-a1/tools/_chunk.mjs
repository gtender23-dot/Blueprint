// _chunk.mjs — phone-friendly audit chunker (Aug 2026). Runs a slice of a
// batch file: `node tools/_chunk.mjs <batchfile> <start> <count> [capSec]`.
// One verdict line per probe, appended to /tmp/audit_master.log. Per-probe
// cap defaults 150s (giants get their own chunks with a higher cap).
import { spawnSync } from 'node:child_process';
import { readFileSync, appendFileSync } from 'node:fs';

const [file, start = '0', count = '10', cap = '150'] = process.argv.slice(2);
const rows = readFileSync(file, 'utf8').split('\n').filter(Boolean).slice(+start, +start + +count);
let ok = 0, bad = 0;
for (const row of rows) {
  const [name, ...args] = row.split(' ').filter(Boolean);
  const t0 = Date.now();
  const r = spawnSync('node', ['tools/' + name, ...args], {
    timeout: +cap * 1000, encoding: 'utf8',
    env: { ...process.env, PW_CHROMIUM: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' },
  });
  const secs = Math.round((Date.now() - t0) / 1000);
  const out = (r.stdout || '') + (r.stderr || '');
  const tail = out.trim().split('\n').pop()?.slice(0, 70) || '';
  const verdict = r.status === 0 ? 'OK  ' : r.signal ? 'TIME' : 'FAIL';
  const line = `${verdict} ${name} (${secs}s) — ${tail}`;
  console.log(line);
  appendFileSync('/tmp/audit_master.log', line + '\n');
  verdict === 'OK  ' ? ok++ : bad++;
}
console.log(`chunk: ${ok} ok, ${bad} not-ok`);
