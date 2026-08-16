// M12 end-to-end route/coverage gate: calls real quick-game concepts in Play Now.
// Usage: node tools/route_live_probe.mjs <built.html> [shot.png]
import { chromium } from "playwright";

const target = process.argv[2];
const shot = process.argv[3] || "_route-live.png";
if (!target) {
  console.error("usage: node tools/route_live_probe.mjs <built.html> [shot.png]");
  process.exit(1);
}
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
await page.goto("file://" + target, { waitUntil: "load" });
await page.waitForTimeout(800);
await page.click("#btn-mm-playnow");
await page.waitForTimeout(450);
await page.click('[data-pn-star="home:6"]');
await page.click('[data-pn-div="away:D3"]');
await page.waitForTimeout(250);
await page.click('[data-pn-star="away:1"]');
await page.waitForTimeout(250);
await page.click("#pn-start");

async function settle(maxMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (await page.locator('[data-cs-drill="quick"]').count()) return true;
    for (const selector of ["#dc-ride", "#dc-send", "#watch-live-skip", "#watch-continue"]) {
      const control = page.locator(selector);
      if (await control.count()) await control.click().catch(() => {});
    }
    await page.waitForTimeout(350);
  }
  return false;
}

let sheet = false, routeLive = false, sawRelease = false, sawStem = false, sawBreak = false, sawHands = false;
let sawPedal = false, sawTurn = false, sawTrail = false, sawTargetCoverage = false, sawCatchpoint = false;
let maxRoutes = 0, maxCoverage = 0, activeShot = false, leaked = false;
for (let attempt = 0; attempt < 3 && !(routeLive && sawBreak && sawTurn && sawTrail && sawHands); attempt += 1) {
  const ready = await settle();
  sheet ||= ready;
  if (!ready) break;
  await page.click('[data-cs-drill="quick"]');
  await page.waitForTimeout(180);
  await page.locator("[data-cs-callconcept]").first().click();
  await page.waitForSelector("#watch-board", { timeout: 20000 });
  for (let frame = 0; frame < 220; frame += 1) {
    const state = await page.evaluate(() => {
      const board = document.querySelector("#watch-board");
      return {
        live: board?.classList.contains("watch-route-live") || false,
        routes: board?.querySelectorAll(".wp-route-active").length || 0,
        coverage: board?.querySelectorAll(".wp-cov-active").length || 0,
        release: !!board?.querySelector(".wp-route-release"),
        stem: !!board?.querySelector(".wp-route-stem"),
        break: !!board?.querySelector(".wp-route-break"),
        hands: !!board?.querySelector(".wp-route-hands"),
        pedal: !!board?.querySelector(".wp-cov-pedal"),
        turn: !!board?.querySelector(".wp-cov-turn"),
        trail: !!board?.querySelector(".wp-cov-trail"),
        targetCoverage: !!board?.querySelector(".wp-cov-target"),
        catchpoint: !!board?.querySelector(".wp-catchpoint-receiver"),
      };
    });
    routeLive ||= state.live;
    maxRoutes = Math.max(maxRoutes, state.routes);
    maxCoverage = Math.max(maxCoverage, state.coverage);
    sawRelease ||= state.release;
    sawStem ||= state.stem;
    sawBreak ||= state.break;
    sawHands ||= state.hands;
    sawPedal ||= state.pedal;
    sawTurn ||= state.turn;
    sawTrail ||= state.trail;
    sawTargetCoverage ||= state.targetCoverage;
    sawCatchpoint ||= state.catchpoint;
    if (!activeShot && state.break && state.turn) {
      await page.screenshot({ path: shot });
      activeShot = true;
    }
    await page.waitForTimeout(20);
  }
  leaked ||= await page.evaluate(() => {
    const board = document.querySelector("#watch-board");
    return !board?.classList.contains("watch-route-live") && !!board?.querySelector(".wp-route-active,.wp-cov-active,.wp-catchpoint");
  });
}
if (!activeShot) await page.screenshot({ path: shot });
await browser.close();
let pass = true;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (detail ? `  [${detail}]` : "")); if (!ok) pass = false; };
check("pageerrors 0", errors.length === 0, errors.join(" | ").slice(0, 260));
check("passing call sheet reached", sheet);
check("explicit live route state observed", routeLive);
check("at least three eligible routes carry phase cues", maxRoutes >= 3, `max=${maxRoutes}`);
check("release and stem phases read live", sawRelease && sawStem, `release=${sawRelease} stem=${sawStem}`);
check("a recorded route break reads live", sawBreak);
check("target gathers hands during flight", sawHands);
check("coverage actors carry the route phase", maxCoverage >= 3, `max=${maxCoverage}`);
check("coverage pedal, turn and trail all read live", sawPedal && sawTurn && sawTrail, `pedal=${sawPedal} turn=${sawTurn} trail=${sawTrail}`);
check("coverage remains complete with or without optional target trace", sawTargetCoverage || maxCoverage >= 3, `targetTrace=${sawTargetCoverage}`);
check("recorded catch or incompletion reaches the receiver", sawCatchpoint);
check("downfield state clears after the play", !leaked);
console.log("shot: " + shot);
process.exit(pass ? 0 : 1);
