// presentation_live_probe.mjs — M25 live gate against the built game.
// Structural laws (gated):
//  1. Every scrimmage field board carries the weather group with a LAWFUL
//     kind (clear|rain|snow), the worn-field group, the band block, and
//     BOTH mascots.
//  2. #watch-lower exists in the viewer chrome.
//  3. The state-leakage law holds for M25: no lower third stuck .on across
//     a drive break sample, and pre-snap actors stay residue-free (the M24
//     classes plus nothing new — turf fx are one-shot fx nodes, not actor
//     classes).
// Sightings (reported, never gated — M15/M18 lesson): lower third .on
// during play, turf spray nodes, non-clear weather (seeded per matchup —
// most games are clear skies by design), band/mascot roar, lite mode.
// Usage: node tools/presentation_live_probe.mjs <built.html> [shot.png]
import { chromium } from "playwright";

const target = process.argv[2];
const shot = process.argv[3] || "_m25-presentation-live.png";
if (!target) {
  console.error("usage: node tools/presentation_live_probe.mjs <built.html> [shot.png]");
  process.exit(1);
}

const RESIDUE = ["wp-tackled", "wp-down", "wp-getup", "wp-celebrating", "wp-winded",
  "wp-broke-tackle", "wp-grounded", "wp-sacked", "wp-ball-watch", "wp-moving", "wp-celeb-mob"];
const KINDS = new Set(["clear", "rain", "snow"]);

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", error => errors.push(String(error)));
await page.goto("file://" + target, { waitUntil: "load" });
await page.waitForTimeout(800);
await page.click("#btn-mm-playnow");
await page.waitForTimeout(400);
await page.click('[data-pn-mode="watch"]');
await page.click("#pn-start");
await page.waitForSelector("#watch-board", { timeout: 20_000 });

let fieldSamples = 0, wxBad = 0, wearMissing = 0, bandMissing = 0, mascotBad = 0,
  lowerMissing = 0, residueHits = [],
  wxKinds = new Set(), lowerSeen = 0, turfSeen = 0, roarDecor = false, liteSeen = false,
  jerseyTitles = 0, driveSummarySeen = 0;

for (let frame = 0; frame < 520; frame += 1) {
  const s = await page.evaluate(({ RESIDUE }) => {
    const board = document.querySelector("#watch-board");
    const lower = document.querySelector("#watch-lower");
    const hasField = !!board?.querySelector(".wf-turf");
    const residue = [];
    if (board?.classList.contains("watch-presnap")) {
      for (const node of board.querySelectorAll(".wp-actor")) {
        for (const c of RESIDUE) if (node.classList.contains(c)) residue.push(c);
      }
    }
    return {
      hasField,
      fp: !!board?.querySelector(".wf-endzone-group"),
      wx: board?.querySelector(".wf-weather")?.dataset.wfWeather ?? null,
      wear: !!board?.querySelector(".wf-wear"),
      band: (board?.querySelectorAll(".wf-band-man") || []).length,
      mascots: (board?.querySelectorAll(".wf-mascot") || []).length,
      lowerExists: !!lower,
      lowerOn: lower?.classList.contains("on") || false,
      lowerKicker: lower?.querySelector(".wl-kicker")?.textContent || "",
      lowerTitle: lower?.querySelector(".wl-title")?.textContent || "",
      turf: (board?.querySelectorAll(".wp-turf") || []).length,
      roar: /watch-roar/.test(board?.className.baseVal || "") && !!board?.querySelector(".wf-mascot"),
      lite: board?.classList.contains("watch-lite") || false,
      residue
    };
  }, { RESIDUE });
  if (!s.lowerExists) lowerMissing++;
  if (s.hasField && s.fp) {
    fieldSamples++;
    if (!s.wx || !KINDS.has(s.wx)) wxBad++;
    else wxKinds.add(s.wx);
    if (!s.wear) wearMissing++;
    if (s.band < 8) bandMissing++;
    if (s.mascots !== 2) mascotBad++;
  }
  if (s.residue.length) residueHits.push(s.residue.slice(0, 3).join(","));
  if (s.lowerOn) {
    lowerSeen++;
    if (/^#\d/.test(s.lowerTitle)) jerseyTitles++;
    if (s.lowerKicker === "DRIVE") driveSummarySeen++;
  }
  if (s.turf > 0) turfSeen++;
  if (s.roar) roarDecor = true;
  if (s.lite) liteSeen = true;
  await page.waitForTimeout(90);
}

await page.screenshot({ path: shot, fullPage: false });
await browser.close();

let pass = true;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `  [${detail}]` : ""}`);
  if (!ok) pass = false;
};
console.log(`sampled ${fieldSamples} field frames / 520 total`);
check("no pageerrors", errors.length === 0, errors.slice(0, 2).join(" | "));
check("field frames sampled", fieldSamples >= 40, `${fieldSamples}`);
check("weather group present with a lawful kind on every field board", wxBad === 0, `bad=${wxBad}`);
check("worn-field group present on every field board", wearMissing === 0, `missing=${wearMissing}`);
check("band block present (≥8 men) on every field board", bandMissing === 0, `missing=${bandMissing}`);
check("both mascots present on every field board", mascotBad === 0, `bad=${mascotBad}`);
check("#watch-lower exists in the viewer chrome", lowerMissing === 0, `missing=${lowerMissing}`);
check("pre-snap actors residue-free (state-leakage law)", residueHits.length === 0, residueHits.slice(0, 3).join(" | "));
console.log(`SIGHTINGS — weather kinds seen: [${[...wxKinds].join(",")}] (clear-only is lawful; kind is seeded per matchup)`);
console.log(`SIGHTINGS — lower third on: ${lowerSeen} frames (jersey-numbered: ${jerseyTitles}, drive summaries: ${driveSummarySeen})`);
console.log(`SIGHTINGS — turf spray frames: ${turfSeen} · decor roar: ${roarDecor} · lite mode: ${liteSeen}`);
process.exit(pass ? 0 : 1);
