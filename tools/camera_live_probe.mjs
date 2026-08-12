// camera_live_probe.mjs — M22 live gate against the built game.
// Watches live plays and asserts the camera's laws IN THE DOM:
//  1. Pre-snap the viewBox is motionless through the cadence (M20 law).
//  2. No whip: consecutive viewBox samples never jump (pan bounded) — the
//     slew limiter is real, including across any turnover in the window.
//  3. Containment: the rendered ball stays inside the viewBox with margin
//     on nearly every in-play sample — the whole point of tracking.
//  4. ST boards: viewBox height stays in the [return-tighten .. wide] band
//     and their pan is bounded too (the raw chase is gone).
// Replay sightings (REPLAY bug on) are reported informationally — per the
// M15/M18 lesson, a phase the throttled rAF never lands on is never a
// failure; the framing laws above gate.
// Usage: node tools/camera_live_probe.mjs <built.html> [shot.png]
import { chromium } from "playwright";

const target = process.argv[2];
const shot = process.argv[3] || "_m22-camera-live.png";
if (!target) {
  console.error("usage: node tools/camera_live_probe.mjs <built.html> [shot.png]");
  process.exit(1);
}

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

let prev = null;
let preSnapPairs = 0, preSnapMoved = 0,
  panPairs = 0, panJumps = 0, worstJump = 0,
  containN = 0, containOut = 0,
  stN = 0, stBad = 0, stPanPairs = 0, stPanJumps = 0,
  replaySeen = false, stSeen = false, zoomMin = 99, zoomMax = 0;

for (let frame = 0; frame < 520; frame += 1) {
  const s = await page.evaluate(() => {
    const board = document.querySelector("#watch-board");
    const vb = (board?.getAttribute("viewBox") || "").split(/\s+/).map(Number);
    const ball = board?.querySelector("#wp-ball");
    const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(ball?.getAttribute("transform") || "");
    return {
      vb: vb.length === 4 && vb.every(Number.isFinite) ? vb : null,
      ball: m ? [Number(m[1]), Number(m[2])] : null,
      pre: board?.classList.contains("watch-presnap") || false,
      inPlay: board?.classList.contains("watch-in-play") || false,
      st: board?.classList.contains("watch-special-teams") || false,
      replay: document.getElementById("watch-replay-bug")?.classList.contains("on") || false
    };
  });
  if (s.replay) replaySeen = true;
  if (s.vb) {
    const sameBoard = prev && prev.vb && Math.abs(s.vb[2] - prev.vb[2]) < 8 && prev.st === s.st;
    if (!s.st) {
      if (s.pre && prev && prev.pre && sameBoard) {
        preSnapPairs++;
        if (Math.abs(s.vb[0] - prev.vb[0]) > 0.01 || Math.abs(s.vb[3] - prev.vb[3]) > 0.01) preSnapMoved++;
      }
      if (s.inPlay && prev && prev.inPlay && sameBoard) {
        panPairs++;
        const j = Math.abs(s.vb[0] - prev.vb[0]);
        worstJump = Math.max(worstJump, j);
        if (j > 26) panJumps++;
      }
      if (s.inPlay && s.ball) {
        containN++;
        const inX = s.ball[0] >= s.vb[0] - 3 && s.ball[0] <= s.vb[0] + s.vb[2] + 3;
        const inY = s.ball[1] >= s.vb[1] - 3 && s.ball[1] <= s.vb[1] + s.vb[3] + 3;
        if (!(inX && inY)) containOut++;
      }
      if (s.inPlay) { zoomMin = Math.min(zoomMin, s.vb[3]); zoomMax = Math.max(zoomMax, s.vb[3]); }
    } else {
      stSeen = true;
      stN++;
      if (!(s.vb[3] >= 45.5 && s.vb[3] <= 56.05)) stBad++;
      if (prev && prev.st && sameBoard) {
        stPanPairs++;
        if (Math.abs(s.vb[0] - prev.vb[0]) > 26) stPanJumps++;
      }
    }
  }
  prev = s;
  if (frame === 260) await page.screenshot({ path: shot });
  if (frame > 340 && preSnapPairs > 25 && panPairs > 120 && containN > 120) break;
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
check("pre-snap framing is motionless", preSnapPairs > 10 && preSnapMoved === 0, `pairs=${preSnapPairs} moved=${preSnapMoved}`);
check("no pan whips or teleports", panPairs > 60 && panJumps === 0, `pairs=${panPairs} worst=${worstJump.toFixed(1)}u`);
check("rendered ball stays framed (≥95%)", containN > 60 && containOut / Math.max(1, containN) <= 0.05, `out=${containOut}/${containN}`);
check("zoom stays inside the contextual band", zoomMin >= 36 && zoomMax <= 56.05, `h=${zoomMin.toFixed(1)}..${zoomMax.toFixed(1)}`);
check("ST board framing lawful when seen", !stSeen || (stBad === 0 && stPanJumps === 0), `samples=${stN} bad=${stBad} jumps=${stPanJumps}`);
console.log(`INFO phases seen — special-teams:${stSeen} replay:${replaySeen} (absence under throttled rAF is env-dependent, never a failure)`);
console.log(`shot: ${shot}`);
process.exit(pass ? 0 : 1);
