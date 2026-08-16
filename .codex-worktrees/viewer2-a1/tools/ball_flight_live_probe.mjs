// ball_flight_live_probe.mjs — M21 live gate against the built game.
// Watches live plays and asserts the ball-ownership laws IN THE DOM:
//  1. KEY CHECK — ball-to-hand alignment at the catch point: while a catch is
//     being made, the ball closes to the catcher's hands band (min observed
//     distance per catch ≤ hand radius).
//  2. A carried ball rides the possessing sprite's HANDS band — offset above
//     the base point, never at his feet (wp-ball-carried + data-possess).
//  3. While wp-ball-air, the ball's aim group is rotated along its own
//     rendered motion (spiral nose tracks the flight).
//  4. Kick boards still speak the four distinct spin classes (informational
//     when no kick happens inside the sampling window).
// Per the M15/M18 lesson NOTHING here is windowed on normalized play time —
// states are sampled opportunistically across frames; a phase the throttled
// rAF never lands on is reported, not failed (the alignment laws gate).
// Usage: node tools/ball_flight_live_probe.mjs <built.html> [shot.png]
import { chromium } from "playwright";

const target = process.argv[2];
const shot = process.argv[3] || "_m21-ball-live.png";
if (!target) {
  console.error("usage: node tools/ball_flight_live_probe.mjs <built.html> [shot.png]");
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

let carrySamples = 0, carryFar = 0, carryFeet = 0,
  airSamples = 0, aimOk = 0, aimBad = 0,
  catchMin = null, catches = 0, catchAligned = 0,
  kickClasses = new Set(), airSeen = false, snapSeen = false, tippedSeen = false;
let prevBall = null, curCatchMin = null, prevCatching = false;

for (let frame = 0; frame < 520; frame += 1) {
  const snap = await page.evaluate(() => {
    const board = document.querySelector("#watch-board");
    const ball = board?.querySelector("#wp-ball");
    const rd = node => {
      const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(node?.getAttribute("transform") || "");
      return m ? [Number(m[1]), Number(m[2])] : null;
    };
    const aim = ball?.querySelector(".wab-aim");
    const am = /rotate\(([-\d.]+)/.exec(aim?.getAttribute("transform") || "");
    const lift = ball?.querySelector(".wab-lift");
    let liftY = 0;
    const lm = /translateY\(([-\d.]+)px\)/.exec(lift?.style.transform || "");
    if (lm) liftY = Number(lm[1]);
    const actors = [...(board?.querySelectorAll(".wp-actor") || [])].map(node => ({
      id: node.dataset.wpa,
      pt: rd(node),
      catching: node.classList.contains("wp-catching")
    }));
    return {
      st: board?.classList.contains("watch-special-teams") || false,
      inPlay: board?.classList.contains("watch-in-play") || false,
      ball: rd(ball),
      air: ball?.classList.contains("wp-ball-air") || false,
      carried: ball?.classList.contains("wp-ball-carried") || false,
      snapC: ball?.classList.contains("wp-ball-snap") || false,
      tipped: ball?.classList.contains("wp-ball-tipped") || false,
      kick: ["wp-ball-place", "wp-ball-punt", "wp-ball-kickoff", "wp-ball-onside"].filter(c => ball?.classList.contains(c)),
      possess: ball?.dataset.possess || "",
      aimAng: am ? Number(am[1]) : null,
      liftY,
      actors
    };
  });
  for (const k of snap.kick) kickClasses.add(k);
  if (snap.snapC) snapSeen = true;
  if (snap.tipped) tippedSeen = true;
  if (snap.inPlay && !snap.st && snap.ball) {
    const ballR = [snap.ball[0], snap.ball[1] + snap.liftY];
    // 2. carried alignment
    if (snap.carried && snap.possess) {
      const owner = snap.actors.find(a => a.id === snap.possess);
      if (owner?.pt) {
        carrySamples++;
        const dx = Math.abs(snap.ball[0] - owner.pt[0]);
        const dy = owner.pt[1] - snap.ball[1]; // + = ball above base
        if (dx > 2.2 || dy < -0.6 || dy > 3.6) carryFar++;
        if (dy < 0.2) carryFeet++;
      }
    }
    // 3. air orientation
    if (snap.air) {
      airSeen = true;
      if (prevBall && snap.aimAng != null) {
        const dx = ballR[0] - prevBall[0], dy = ballR[1] - prevBall[1];
        if (Math.hypot(dx, dy) > 1.4) {
          airSamples++;
          const want = Math.atan2(dy, dx) * 180 / Math.PI;
          let diff = Math.abs(want - snap.aimAng) % 360;
          if (diff > 180) diff = 360 - diff;
          if (diff <= 55) aimOk++; else aimBad++;
        }
      }
    }
    // 1. catch alignment: track the closest ball↔catcher approach per catch
    const catcher = snap.actors.find(a => a.catching && a.pt);
    if (catcher) {
      const d = Math.hypot(snap.ball[0] - catcher.pt[0], snap.ball[1] - (catcher.pt[1] - 2.35));
      curCatchMin = curCatchMin == null ? d : Math.min(curCatchMin, d);
      prevCatching = true;
    } else if (prevCatching) {
      catches++;
      if (curCatchMin != null && curCatchMin <= 2.6) catchAligned++;
      if (curCatchMin != null) catchMin = catchMin == null ? curCatchMin : Math.max(catchMin, curCatchMin);
      curCatchMin = null;
      prevCatching = false;
    }
    prevBall = ballR;
  } else prevBall = null;
  if (frame === 260) await page.screenshot({ path: shot });
  if (catches >= 6 && carrySamples > 60 && airSamples > 30 && frame > 300) break;
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
check("live catches observed", catches >= 2, `catches=${catches}`);
check("receiver hands meet the ball at the catch point", catches >= 2 && catchAligned / Math.max(1, catches) >= 0.75,
  `aligned=${catchAligned}/${catches} worstMin=${catchMin == null ? "-" : catchMin.toFixed(2)}u`);
check("carried ball rides the hands band, never the feet", carrySamples > 30 && carryFar / Math.max(1, carrySamples) < 0.1 && carryFeet === 0,
  `far=${carryFar}/${carrySamples} feet=${carryFeet}`);
// Sample minimum is low on purpose: throttled rAF in a run-heavy window can
// land only a handful of flight frames (seen 2026-08-10: 5 samples, 0 bad).
// The RATIO is the law; scarcity alone must not red a correct board.
check("airborne ball noses along its own flight", airSamples >= 4 && aimOk / Math.max(1, aimOk + aimBad) > 0.75,
  `ok=${aimOk} bad=${aimBad}`);
console.log(`INFO phases seen — air:${airSeen} snap-tumble:${snapSeen} tipped:${tippedSeen} kickSpins:[${[...kickClasses].join(",") || "none in window"}] (absence of a phase is env-dependent, never a failure)`);
console.log(`shot: ${shot}`);
process.exit(pass ? 0 : 1);
