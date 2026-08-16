// _boot_check.mjs — load dist/index.html headless, assert 0 pageerrors.
import { chromium } from 'playwright';
const url = 'file://' + process.argv[2];
// PW_CHROMIUM overrides for environments with a non-standard browser install
// (e.g. the cloud session's /opt/pw-browsers); default resolution otherwise.
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
// console errors ignored (file:// resource 403s are expected)
await p.goto(url, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
console.log('PAGEERRORS', errs.length);
for (const e of errs) console.log('  ', e);
await b.close();
process.exit(errs.length ? 1 : 0);
