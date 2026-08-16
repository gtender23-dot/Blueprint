// _gate.mjs — the one-command verification gate (established 2026-08-09).
// Runs the probe registry in tools/_gate_manifest.mjs against the current
// tree. Tool-agnostic and Windows-safe: plain Node, no shell tricks.
//
//   node tools/_gate.mjs                 core tier (the per-change-set gate)
//   node tools/_gate.mjs full            deploy-level sweep (full ⊇ core)
//   node tools/_gate.mjs night           the deferred CPU giants ONLY
//   node tools/_gate.mjs --list [tier]   show what would run, with flags
//   node tools/_gate.mjs --only <name..> run specific manifest entries
//   flags: --no-build   skip the build + boot check (dist already fresh)
//          --local      force local semantics (envKnown failures GATE)
//
// Policy (see CLAUDE.md "Verifying a change"):
//   • every change-set runs CORE before it ships: build + boot + stat bands +
//     the current pass's A/B + the newest-surface probes + the UI trio.
//   • FULL runs before a deploy, or when a change touches an old subsystem.
//   • seedFlaky entries get ONE automatic retry (unseeded RNG).
//   • envKnown entries fail identically on a pristine tree in the CLOUD
//     container (verified 2026-08-09) — there they are informational; on a
//     local machine they gate like everything else.
//   • localOnly entries are skipped in the cloud (CPU-bound giants) and MUST
//     be run locally before a deploy.
//   • night entries (owner request 2026-08-10: the giants were crawling the
//     working machine) are DEFERRED out of core and full — they run only via
//     `node tools/_gate.mjs night` (or --only). Full's summary shows them as
//     deferred so a deploy still knows they're owed.
// Results stream to stdout and land in tools/_gate_last.json.

import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MANIFEST } from './_gate_manifest.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST_HTML = join(ROOT, 'dist', 'index.html');
const DIST_DIR = join(ROOT, 'dist');
const CLOUD_CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const tier = argv.find((a) => a === 'core' || a === 'full' || a === 'night') || 'core';
const onlyIdx = argv.indexOf('--only');
const only = onlyIdx >= 0 ? argv.slice(onlyIdx + 1).filter((a) => !a.startsWith('--')) : null;

// Environment: cloud container (envKnown = informational) vs local (gating).
const inCloud = !has('--local') && existsSync(CLOUD_CHROMIUM);
const pwExe = process.env.PW_CHROMIUM || (inCloud ? CLOUD_CHROMIUM : undefined);

const selected = MANIFEST.filter((e) =>
  only ? only.some((n) => e.name === n || e.name === n + '.mjs')
       : tier === 'night' ? !!e.night
       : tier === 'full' ? true
       : e.tier === 'core');

if (has('--list')) {
  console.log(`gate ${only ? '--only' : tier} — ${selected.length} entries (${inCloud ? 'CLOUD' : 'LOCAL'} semantics)`);
  for (const e of selected) {
    const flags = [e.tier, e.kind, e.seedFlaky && 'seedFlaky', e.envKnown && 'envKnown', e.localOnly && 'localOnly', e.night && 'night'].filter(Boolean).join(' · ');
    console.log(`  ${e.name.padEnd(38)} ${flags}${e.note ? `   — ${e.note}` : ''}`);
  }
  process.exit(0);
}

function run(cmdArgs, timeoutSec, env = {}) {
  return new Promise((res) => {
    const child = spawn(process.execPath, cmdArgs, {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    const cap = (d) => { out += d; if (out.length > 400000) out = out.slice(-200000); };
    child.stdout.on('data', cap);
    child.stderr.on('data', cap);
    let timedOut = false;
    const t = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutSec * 1000);
    child.on('close', (code) => {
      clearTimeout(t);
      res({ code: timedOut ? 'TIMEOUT' : code, out });
    });
  });
}

function argvFor(e) {
  const base = [join(ROOT, 'tools', e.name)];
  if (e.kind === 'pw') base.push(DIST_HTML);
  else if (e.kind === 'pw-dist') base.push(DIST_DIR);
  return base.concat(e.args || []);
}

const t0 = Date.now();
const results = [];
const line = (s) => console.log(s);

// 1) build + boot check (the floor for everything)
if (!has('--no-build')) {
  line('── build + boot ──');
  const b = await run([join(ROOT, 'tools', 'build.mjs')], 300);
  if (b.code !== 0) {
    line(`FAIL  build.mjs (${b.code})\n${b.out.slice(-1500)}`);
    process.exit(1);
  }
  line('OK    build.mjs');
  const boot = await run([join(ROOT, 'tools', '_boot_check.mjs'), DIST_HTML], 180, pwExe ? { PW_CHROMIUM: pwExe } : {});
  if (boot.code !== 0) {
    line(`FAIL  _boot_check.mjs (${boot.code})\n${boot.out.slice(-1500)}`);
    process.exit(1);
  }
  line('OK    _boot_check.mjs (0 pageerrors)');
}

// 2) the manifest
line(`── ${only ? 'selected' : tier} tier — ${selected.length} probes (${inCloud ? 'cloud' : 'local'} semantics) ──`);
for (const e of selected) {
  if (e.night && tier !== 'night' && !only) {
    results.push({ name: e.name, status: 'DEFERRED-NIGHT' });
    line(`DEFER ${e.name}  — night tier (${e.note ? e.note.slice(0, 80) : 'run node tools/_gate.mjs night'})`);
    continue;
  }
  if (e.localOnly && inCloud) {
    results.push({ name: e.name, status: 'SKIPPED-LOCAL-ONLY' });
    line(`SKIP  ${e.name}  — local-only (${e.note || 'too slow for the cloud container'})`);
    continue;
  }
  const isPw = e.kind !== 'node';
  const env = isPw && pwExe ? { PW_CHROMIUM: pwExe } : {};
  let r = await run(argvFor(e), e.timeoutSec, env);
  let retried = false;
  if (r.code !== 0 && e.seedFlaky) {
    retried = true;
    r = await run(argvFor(e), e.timeoutSec, env);
  }
  const tail = (r.out.trim().split('\n').filter(Boolean).pop() || '').slice(0, 100);
  if (r.code === 0) {
    const status = retried ? 'FLAKY-CLEARED' : 'OK';
    results.push({ name: e.name, status, tail });
    line(`${retried ? 'FLAKY' : 'OK   '} ${e.name}  — ${tail}`);
  } else if (e.envKnown && inCloud) {
    results.push({ name: e.name, status: 'ENV-KNOWN-FAIL', code: r.code, tail });
    line(`ENV   ${e.name}  — known cloud failure (${e.note || 'verified identical on pristine'})`);
  } else {
    results.push({ name: e.name, status: r.code === 'TIMEOUT' ? 'TIMEOUT' : 'FAIL', code: r.code, tail });
    line(`FAIL  ${e.name} (${r.code})  — ${tail}`);
  }
}

// 3) summary + verdict
const count = (s) => results.filter((r) => r.status === s).length;
const bad = results.filter((r) => r.status === 'FAIL' || r.status === 'TIMEOUT');
const mins = ((Date.now() - t0) / 60000).toFixed(1);
line('── summary ──');
line(`OK ${count('OK')} · flaky-cleared ${count('FLAKY-CLEARED')} · env-known ${count('ENV-KNOWN-FAIL')} · skipped-local ${count('SKIPPED-LOCAL-ONLY')} · deferred-night ${count('DEFERRED-NIGHT')} · FAIL ${bad.length} · ${mins} min`);
if (count('SKIPPED-LOCAL-ONLY') > 0) line('NOTE: local-only probes were skipped — run them on a real machine before a deploy.');
if (count('DEFERRED-NIGHT') > 0) line('NOTE: night-tier giants were deferred — run `node tools/_gate.mjs night` (end of day) before a deploy.');
for (const r of bad) line(`  FAIL: ${r.name} (${r.code}) — ${r.tail}`);
try {
  writeFileSync(join(ROOT, 'tools', '_gate_last.json'), JSON.stringify({ tier: only ? 'only' : tier, cloud: inCloud, minutes: +mins, results }, null, 2));
} catch { /* read-only checkout is fine */ }
line(bad.length ? 'GATE FAILED — investigate before ship.' : 'GATE PASSED.');
process.exit(bad.length ? 1 : 0);
