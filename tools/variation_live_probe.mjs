// variation_live_probe.mjs — M24 live gate against the built game.
// The goals doc's regression list, made law IN THE DOM:
//  1. STATE-LEAKAGE LAW: at every scrimmage pre-snap sample, NO actor
//     carries a residue class (tackled/down/getup/celebrating/winded/
//     broke-tackle/grounded/sacked/ball-watch/moving) and the ball carries
//     no flight/loose state — a fresh play starts clean.
//  2. Orientation coverage: both field directions render across the window.
//  3. End-zone stability: both end-zone groups present with owners and
//     lettering on every field board.
// Variant sightings (celebration styles, winded, ball-watch, bench roar,
// panning, lite) are reported, never gated (M15/M18 lesson).
// Usage: node tools/variation_live_probe.mjs <built.html> [shot.png]
import { chromium } from "playwright";

const target = process.argv[2];
const shot = process.argv[3] || "_m24-variation-live.png";
if (!target) {
  console.error("usage: node tools/variation_live_probe.mjs <built.html> [shot.png]");
  process.exit(1);
}

const RESIDUE = ["wp-tackled", "wp-down", "wp-getup", "wp-celebrating", "wp-winded",
  "wp-broke-tackle", "wp-grounded", "wp-sacked", "wp-ball-watch", "wp-moving", "wp-celeb-mob"];
const BALL_RESIDUE = ["wp-ball-air", "wp-ball-loose", "wp-ball-tipped", "wp-ball-carried"];

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

let preSamples = 0, residueHits = [], ballResidue = 0,
  dirs = new Set(), ezSamples = 0, ezBad = 0,
  celebStyles = new Set(), windedSeen = false, watchSeen = false,
  benchRoar = false, panningSeen = false, liteSeen = false;

for (let frame = 0; frame < 520; frame += 1) {
  const s = await page.evaluate(({ RESIDUE, BALL_RESIDUE }) => {
    const board = document.querySelector("#watch-board");
    const ball = board?.querySelector("#wp-ball");
    const residue = [];
    if (board?.classList.contains("watch-presnap")) {
      for (const node of board.querySelectorAll(".wp-actor")) {
        for (const c of RESIDUE) if (node.classList.contains(c)) residue.push(c);
      }
    }
    const ez = [...(board?.querySelectorAll(".wf-endzone-group") || [])].map(g => ({
      owner: g.dataset.wfOwner,
      lbl: !!g.querySelector(".wf-ez-lbl")?.textContent
    }));
    const styles = [];
    for (const node of board?.querySelectorAll(".wp-celebrating") || [])
      for (const c of node.classList) if (c.startsWith("wp-celeb-") && c !== "wp-celeb-mob") styles.push(c);
    return {
      pre: board?.classList.contains("watch-presnap") || false,
      st: board?.classList.contains("watch-special-teams") || false,
      residue,
      ballBad: board?.classList.contains("watch-presnap") ? BALL_RESIDUE.filter(c => ball?.classList.contains(c)) : [],
      dir: board?.dataset.fieldDirection || null,
      ez,
      styles,
      winded: !!board?.querySelector(".wp-winded"),
      watch: !!board?.querySelector(".wp-ball-watch"),
      bench: /watch-roar/.test(board?.className.baseVal || "") && !!board?.querySelector(".wf-bench-man"),
      panning: board?.classList.contains("watch-panning") || false,
      lite: board?.classList.contains("watch-lite") || false
    };
  }, { RESIDUE, BALL_RESIDUE });
  if (s.pre && !s.st) {
    preSamples++;
    if (s.residue.length) residueHits.push(s.residue.slice(0, 3).join(","));
    if (s.ballBad.length) ballResidue++;
  }
  if (s.dir) dirs.add(s.dir);
  if (!s.st && s.ez.length) {
    ezSamples++;
    const owners = new Set(s.ez.map(e => e.owner));
    if (!(owners.has("home") && owners.has("away") && s.ez.every(e => e.lbl))) ezBad++;
  }
  for (const st of s.styles) celebStyles.add(st);
  if (s.winded) windedSeen = true;
  if (s.watch) watchSeen = true;
  if (s.bench) benchRoar = true;
  if (s.panning) panningSeen = true;
  if (s.lite) liteSeen = true;
  if (frame === 240) await page.screenshot({ path: shot });
  if (frame > 380 && preSamples > 30) break;
  await page.waitForTimeout(80);
}
await page.screenshot({ path: shot });
await browser.close();

let pass = true;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `  [${detail}]` : ""}`);
  if (!ok) pass = false;
};
check("pageerrors 0", errors.length === 0, errors.join(" | ").slice(0, 260));
check("no animation-state leakage into a fresh play", preSamples > 15 && residueHits.length === 0,
  `preSamples=${preSamples} hits=${residueHits.slice(0, 3).join(" | ")}`);
check("ball starts every play clean", ballResidue === 0, `bad=${ballResidue}`);
check("both field orientations render", dirs.has("right") && dirs.has("left"), `dirs=[${[...dirs].join(",")}]`);
check("end zones stable: owners + lettering", ezSamples > 40 && ezBad === 0, `samples=${ezSamples} bad=${ezBad}`);
console.log(`INFO sightings — celebStyles:[${[...celebStyles].join(",") || "none"}] winded:${windedSeen} ball-watch:${watchSeen} bench-roar:${benchRoar} panning:${panningSeen} lite:${liteSeen} (absence under throttled rAF is env-dependent, never a failure)`);
console.log(`shot: ${shot}`);
process.exit(pass ? 0 : 1);
