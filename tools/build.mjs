// build.mjs — the only build step. Run it from the project root:
//
//     node tools/build.mjs
//
// It bundles js/ + style.css into one self-contained HTML file and writes everything
// GitHub Pages needs:
//
//     dist/index.html      the whole game, one file (JS + CSS inlined)
//     dist/404.html        same bytes — makes any URL under the site serve the app
//     dist/sw.js           service worker, cache name stamped with the bundle's hash
//     dist/manifest.json   PWA manifest
//     dist/icon-192.png    icons
//     dist/icon-512.png
//     dist/.nojekyll       stops GitHub trying to run Jekyll over the files
//     blueprint-pages.zip  the seven files above, ready to extract over the Pages repo
//
// NOTHING here is edited by hand. js/ and style.css are the source; dist/ is output and is
// safe to delete at any time. If you want to check the phone experience before pushing,
// serve dist/ over http (`npx serve dist`) — a service worker will not register on file://.

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join, dirname }                                  from 'path';
import { fileURLToPath }                                  from 'url';
import { createHash }                                     from 'crypto';
import { execSync }                                       from 'child_process';
import { writeZip }                                       from './_zip.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const ZIP  = join(ROOT, 'blueprint-pages.zip');
const ESBUILD_VERSION = '0.28.1';   // pinned: a different version changes the output bytes

// ── 1. bundle js/ into one IIFE ──────────────────────────────────────────────
// Prefer the pinned local esbuild (fast, deterministic). Fall back to npx at the SAME
// pinned version if node_modules isn't installed, so the build still works on a fresh
// clone — but never to a floating "latest", which would change the output.
console.log('Bundling JS…');
let bundle;
try {
  const esbuild = await import('esbuild');
  const res = await esbuild.build({
    entryPoints: [join(ROOT, 'js/ui/app.js')],
    bundle: true, format: 'iife', globalName: '_CFB', target: 'es2017',
    write: false, logLevel: 'warning',
  });
  bundle = res.outputFiles[0].text;
} catch (err) {
  if (err?.code !== 'ERR_MODULE_NOT_FOUND') throw err;
  console.log(`  (esbuild not installed locally — falling back to npx esbuild@${ESBUILD_VERSION};`);
  console.log('   run "npm install" once to make this faster)');
  const tmp = '_cfb_tmp_bundle.js';                       // relative: no spaces in the path
  execSync(
    `npx --yes esbuild@${ESBUILD_VERSION} js/ui/app.js --bundle --format=iife ` +
    `--global-name=_CFB --target=es2017 --outfile=${tmp}`,
    { stdio: 'inherit', cwd: ROOT },
  );
  bundle = readFileSync(join(ROOT, tmp), 'utf8');
  rmSync(join(ROOT, tmp), { force: true });
}

if (/^(import |export )/m.test(bundle)) {
  console.error('ERROR: bundle still contains import/export — esbuild missed something.');
  process.exit(1);
}

const css      = readFileSync(join(ROOT, 'style.css'),    'utf8');
const swSrc    = readFileSync(join(ROOT, 'sw.js'),        'utf8');
const manifest = readFileSync(join(ROOT, 'manifest.json'), 'utf8');
const icon192  = readFileSync(join(ROOT, 'icon-192.png'));
const icon512  = readFileSync(join(ROOT, 'icon-512.png'));

// ── 2. the build id ──────────────────────────────────────────────────────────
// Derived from the SOURCE content, not from the assembled HTML. It has to be, because the
// id is embedded in that HTML — hashing the output would change the thing being hashed.
// The shell below is therefore a FUNCTION of the id, which lets the template's own text be
// hashed with the id held at a fixed placeholder: covered, without self-reference.
//
// Aug 2026 (build-diagnostics fix): the hash used to cover only the bundle + CSS. Every
// other shipped byte — the service worker's own logic, the manifest, the icons, this HTML
// shell — was invisible to it. Editing any of them shipped a changed file under the SAME
// cache name, so 'activate' never purged the old cache, and the cache-first assets
// (manifest, icons) stayed stale on an installed device indefinitely. The cache name has
// to be a fingerprint of everything in the cache, or it isn't a cache-busting name at all.
const shellHtml = (buildId) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0, user-scalable=no" />
  <title>Dynasty CFB</title>
  <meta name="theme-color" content="#060912" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <link rel="manifest" href="manifest.json" />
  <link rel="apple-touch-icon" href="icon-192.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;0,900;1,600&display=swap" rel="stylesheet" />
  <style>
${css}
  </style>
</head>
<body>
  <div id="app">
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#6a7490;font-size:14px;">
      Loading Dynasty CFB…
    </div>
  </div>
  <script>
globalThis.__BUILD__ = "${buildId}";
${bundle}
_CFB.init().catch(function(err) {
  document.getElementById('app').innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;' +
    'justify-content:center;height:100vh;gap:12px;color:#ff5252;font-family:monospace">' +
    '<div style="font-size:18px;font-weight:700">Failed to initialize</div>' +
    '<div style="font-size:12px;color:#6a7490">' + (err && err.message || String(err)) + '</div>' +
    '</div>';
  console.error('Dynasty CFB init error:', err);
});
  </script>
<script>
// PWA install: register the service worker only when actually served over http(s) —
// file:// can't register one, and the game must keep working there.
if ('serviceWorker' in navigator && (location.protocol === 'https:'
    || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
</script>
</body>
</html>`;

// Every shipped byte feeds the fingerprint. The shell goes in with a FIXED placeholder id
// (hashing it with the real id would be circular); everything else goes in verbatim.
const hash = createHash('sha256')
  .update(bundle).update(css).update(swSrc).update(manifest)
  .update(icon192).update(icon512)
  .update(shellHtml('__BUILD_ID__'))
  .digest('hex').slice(0, 10);

// ── 3. assemble the standalone HTML ──────────────────────────────────────────
// Google Fonts is an absolute HTTPS URL, so it loads on any device with internet.
const html = shellHtml(hash);

// ── 4. stamp the service worker with the same build id ──────────────────────
// This is what forces an already-installed phone to pick up a new build: the cache name
// changes, so 'activate' deletes the old cache. Done here, every build, automatically —
// there is no hash to maintain by hand.
const sw = swSrc.replace(/const CACHE = 'cfb-dynasty-[^']*';/,
                         `const CACHE = 'cfb-dynasty-${hash}';`);
if (!sw.includes(`cfb-dynasty-${hash}`)) {
  console.error("ERROR: couldn't find the CACHE line in sw.js — service worker not stamped.");
  process.exit(1);
}

// ── 5. write dist/ ───────────────────────────────────────────────────────────
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

const files = [
  ['index.html',    Buffer.from(html, 'utf8')],
  ['404.html',      Buffer.from(html, 'utf8')],   // any deep link still serves the app
  ['sw.js',         Buffer.from(sw, 'utf8')],
  ['manifest.json', Buffer.from(manifest, 'utf8')],
  ['icon-192.png',  icon192],
  ['icon-512.png',  icon512],
  ['.nojekyll',     Buffer.alloc(0)],
];
for (const [name, data] of files) writeFileSync(join(DIST, name), data);

// ── 6. zip it for dropping over the Pages repo ───────────────────────────────
writeZip(ZIP, files.map(([name, data]) => ({ name, data })));

// ── 7. sanity checks ─────────────────────────────────────────────────────────
// The id checks READ THE WRITTEN FILES BACK and compare them to EACH OTHER. They used to
// compare each artifact to the same in-memory `hash` variable, which made the check that
// claimed to guarantee "the on-screen stamp IS the cache name" a tautology: both sides of
// it were the same expression, so it could not fail independently of the thing it was
// meant to catch. Extracting from disk and cross-comparing is the only version of this
// check that can actually detect a desync between the artifacts a device downloads.
const written    = readFileSync(join(DIST, 'index.html'), 'utf8');
const written404 = readFileSync(join(DIST, '404.html'),   'utf8');
const writtenSw  = readFileSync(join(DIST, 'sw.js'),      'utf8');
const idIn    = (s) => (s.match(/globalThis\.__BUILD__ = "([0-9a-f]+)"/)   || [])[1] || null;
const cacheIn = (s) => (s.match(/const CACHE = 'cfb-dynasty-([^']+)'/)     || [])[1] || null;
const htmlId = idIn(written), id404 = idIn(written404), swId = cacheIn(writtenSw);

const checks = [
  ['No external JS src',        !/<script[^>]+src=/i.test(written)],
  ['No external CSS href',      !/<link[^>]+href=["'](?!https:)[^"']+\.css/i.test(written)],
  ['No ES module imports',      !/\bimport\s+[{*'"]/m.test(written)],
  ['CSS inlined',               written.includes('<style>')],
  ['JS bundle present',         written.includes('_CFB.init()')],
  ['App mount div present',     written.includes('id="app"')],
  ['SW cache stamped',          swId !== null],
  // Guards the GitHub Pages failure mode: the bundle is served as index.html there, so a
  // service worker asking for './cfb_mobile.html' 404s — and cache.addAll() rejects if any
  // one entry fails, which silently kills the whole install. Comments are stripped first so
  // the note explaining this doesn't trip its own check.
  ['SW paths are root-relative',
    !sw.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n').includes('cfb_mobile.html')],
  // Must stay relative — the site is a project page served from /Blueprint/, not a domain root.
  ['Manifest start_url relative', /"start_url"\s*:\s*"\.\//.test(manifest)],
  // The on-screen stamp and the cache name must be the same value, or the stamp is
  // useless for spotting a stale cache — which is the only reason it exists. Read back
  // from disk and cross-compared, so a real desync between the two shipped files fails
  // the build instead of passing a check that only ever compared `hash` to itself.
  ['Build id injected',            htmlId !== null],
  ['index.html ≡ sw.js build id',  htmlId !== null && htmlId === swId],
  ['404.html ≡ index.html id',     id404 !== null && id404 === htmlId],
  ['Ids are this build',           htmlId === hash],
];

console.log('\nSanity checks:');
let allOk = true;
for (const [label, ok] of checks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) allOk = false;
}

const kb = (written.length / 1024).toFixed(0);
console.log(`\n  dist/                 7 files, index.html is ${kb} KB`);
console.log(`  blueprint-pages.zip   extract this over your GitHub Pages repo`);
console.log(`  cache name            cfb-dynasty-${swId}   (index.html stamp: ${htmlId})`);
if (!allOk) { console.error('\nONE OR MORE CHECKS FAILED — do not deploy.\n'); process.exit(1); }
console.log('\nREADY. Test locally with:  npx serve dist\n');
