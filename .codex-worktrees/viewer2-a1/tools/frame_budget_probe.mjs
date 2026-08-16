// frame_budget_probe.mjs — M20 standing perf gate (created pre-M20 so the
// baseline is the M19 tree; see Ref/M20_CONTACT_SCOPE_2026-08-09.md).
//
// Measures main-thread frame pacing during a live watch play: rAF deltas and
// longtask count over a sampling window, plus the actor census (a 22-man play
// is the load we care about). Modes:
//
//   node tools/frame_budget_probe.mjs <built.html> --baseline
//     → writes tools/_frame_budget_BASELINE.json (do this ONCE, pre-change)
//   node tools/frame_budget_probe.mjs <built.html>
//     → compares against the baseline with margins; FAILs on regression
//
// Cloud caveat (standing lesson): the headless container throttles rAF, so
// absolute numbers are only comparable within one environment. The baseline
// file records its environment; comparisons across environments are
// informational, same-env comparisons gate.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const target = process.argv[2];
const isBaseline = process.argv.includes("--baseline");
const BASE_PATH = join(here, "_frame_budget_BASELINE.json");
if (!target) {
  console.error("usage: node tools/frame_budget_probe.mjs <built.html> [--baseline]");
  process.exit(1);
}

const SAMPLE_MS = 9000;
// Regression margins (same environment): generous enough for run-to-run noise,
// tight enough that a real per-frame cost increase trips them.
// Margins are wide because the cloud container renders in software and its
// run-to-run variance is real (verified 2026-08-09: p50 ranged 16.7–50ms on a
// pristine tree). A genuine per-frame cost increase moves the BEST window's
// p50 and the longtask count together; requiring both to trip keeps the wide
// margins honest. On a local machine the same margins are simply comfortable.
const P50_MARGIN = ms => ms * 1.5 + 35; // best-window median allowance
const LONG_MARGIN = 8;                  // absolute extra longtasks allowed

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  // Headless throttles rAF for occluded/backgrounded pages; this probe needs
  // the renderer to run frames as fast as the main thread allows so deltas
  // reflect script cost, not throttling policy.
  args: [
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows"
  ]
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
await page.goto("file://" + target, { waitUntil: "load" });
await page.waitForTimeout(800);
await page.click("#btn-mm-playnow");
await page.waitForTimeout(400);
await page.click('[data-pn-mode="watch"]');
await page.click("#pn-start");
await page.waitForSelector("#watch-board", { timeout: 20_000 });

// Wait for a live play with the full cast before sampling.
let cast = 0;
for (let i = 0; i < 100; i++) {
  cast = await page.evaluate(() => {
    const board = document.querySelector("#watch-board");
    return board?.classList.contains("watch-in-play")
      ? board.querySelectorAll(".wp-actor").length : 0;
  });
  if (cast >= 22) break;
  await page.waitForTimeout(150);
}

const measureOnce = async () => page.evaluate(async (windowMs) => {
  const deltas = [];
  let longtasks = 0;
  let observer = null;
  try {
    observer = new PerformanceObserver(list => { longtasks += list.getEntries().length; });
    observer.observe({ entryTypes: ["longtask"] });
  } catch { /* longtask unsupported: count stays 0 */ }
  let prev = performance.now();
  let running = true;
  const tick = now => {
    deltas.push(now - prev);
    prev = now;
    if (running) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  await new Promise(resolve => setTimeout(resolve, windowMs));
  running = false;
  observer?.disconnect();
  deltas.sort((a, b) => a - b);
  const at = q => deltas.length ? deltas[Math.min(deltas.length - 1, Math.floor(q * deltas.length))] : 0;
  const mean = deltas.length ? deltas.reduce((s, d) => s + d, 0) / deltas.length : 0;
  return {
    frames: deltas.length,
    meanMs: Math.round(mean * 100) / 100,
    p50Ms: Math.round(at(0.5) * 100) / 100,
    p95Ms: Math.round(at(0.95) * 100) / 100,
    maxMs: Math.round(at(1) * 100) / 100,
    longtasks
  };
}, SAMPLE_MS);
// Software rendering makes single windows noisy (first window pays warmup and
// layout-cache misses). Sample twice, gate on the better window — a real
// per-frame cost increase raises the best case too.
const runA = await measureOnce();
const runB = await measureOnce();
const sample = runB.p50Ms <= runA.p50Ms ? runB : runA;
await browser.close();

const record = {
  ...sample,
  cast,
  windowMs: SAMPLE_MS,
  env: process.env.CLOUD_ENV || (process.platform + "/" + (process.env.PW_CHROMIUM ? "pw-chromium-override" : "pw-default")),
  when: new Date().toISOString()
};

let pass = true;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `  [${detail}]` : ""}`);
  if (!ok) pass = false;
};

check("pageerrors 0", errors.length === 0, errors.join(" | ").slice(0, 200));
check("full 22-man cast sampled", cast >= 22, `cast=${cast}`);
check("sampling captured frames", sample.frames > 30, `frames=${sample.frames}`);

if (isBaseline) {
  writeFileSync(BASE_PATH, JSON.stringify(record, null, 2));
  console.log(`BASELINE WRITTEN ${BASE_PATH}`);
  console.log(JSON.stringify(record));
  process.exit(pass ? 0 : 1);
}

let base = null;
try { base = JSON.parse(readFileSync(BASE_PATH, "utf8")); } catch { /* no baseline */ }
check("baseline exists (run --baseline on the pre-change tree first)", !!base);
if (base) {
  const sameEnv = base.env === record.env;
  console.log(`INFO baseline env=${base.env} current env=${record.env}${sameEnv ? "" : "  (cross-env: informational only)"}`);
  const gate = (name, ok, detail) => sameEnv ? check(name, ok, detail) : console.log(`INFO ${name}  [${detail}]`);
  const p50Bad = record.p50Ms > P50_MARGIN(base.p50Ms);
  const longBad = record.longtasks > base.longtasks + LONG_MARGIN;
  console.log(`INFO p50 ${record.p50Ms}ms vs base ${base.p50Ms}ms (allow ${Math.round(P50_MARGIN(base.p50Ms))}ms) · longtasks ${record.longtasks} vs base ${base.longtasks} (allow +${LONG_MARGIN})`);
  gate("frame budget holds (p50 and longtasks must not BOTH regress)", !(p50Bad && longBad), `p50Bad=${p50Bad} longBad=${longBad}`);
}
console.log(JSON.stringify(record));
process.exit(pass ? 0 : 1);
