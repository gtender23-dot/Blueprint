// _notip_wrapper.mjs — runs any probe with the tip-drill chain killed
// (globalThis.__noTipDrill), restoring the exact pre-M25 RNG stream.
// Usage: node tools/_notip_wrapper.mjs tools/<probe>.mjs [probe args...]
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
globalThis.__noTipDrill = true;
const target = resolve(process.argv[2]);
process.argv.splice(2, 1); // the probe reads its own args from argv[2]+
await import(pathToFileURL(target));
