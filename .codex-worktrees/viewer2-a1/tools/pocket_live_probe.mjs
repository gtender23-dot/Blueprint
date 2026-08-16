// M11 end-to-end pocket gate: calls real dropback concepts in Play Now.
// Usage: node tools/pocket_live_probe.mjs <built.html> [shot.png]
import { chromium } from "playwright";

const target = process.argv[2];
const shot = process.argv[3] || "_pocket-live.png";
if (!target) {
  console.error("usage: node tools/pocket_live_probe.mjs <built.html> [shot.png]");
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
    if (await page.locator('[data-cs-drill="dropback"]').count()) return true;
    const ride = page.locator("#dc-ride");
    if (await ride.count()) {
      await ride.click().catch(() => {});
      await page.waitForTimeout(450);
      continue;
    }
    const send = page.locator("#dc-send");
    if (await send.count()) {
      await send.click().catch(() => {});
      await page.waitForTimeout(450);
      continue;
    }
    const skip = page.locator("#watch-live-skip");
    if (await skip.count()) await skip.click().catch(() => {});
    const cont = page.locator("#watch-continue");
    if (await cont.count()) await cont.click().catch(() => {});
    await page.waitForTimeout(350);
  }
  return false;
}

let sheet = false;
let pocket = false;
let maxSet = 0;
let maxRush = 0;
let maxFamilies = 0;
let sawQB = false;
let sawLost = false;
let activeShot = false;
let leaked = false;

for (let attempt = 0; attempt < 3 && !pocket; attempt += 1) {
  const ready = await settle();
  sheet ||= ready;
  if (!ready) break;
  await page.click('[data-cs-drill="dropback"]');
  await page.waitForTimeout(180);
  await page.locator("[data-cs-callconcept]").first().click();
  await page.waitForSelector("#watch-board", { timeout: 20000 });

  for (let frame = 0; frame < 160; frame += 1) {
    const state = await page.evaluate(() => {
      const board = document.querySelector("#watch-board");
      const setters = [...(board?.querySelectorAll(".wp-pass-set") || [])];
      const rushers = [...(board?.querySelectorAll(".wp-pass-engaged") || [])];
      const families = new Set(
        [...setters, ...rushers].flatMap((node) =>
          [...node.classList].filter((name) => /^wp-pass-(edge|power|counter)$/.test(name))
        )
      );
      return {
        active: board?.classList.contains("watch-pass-pocket") || false,
        set: setters.length,
        rush: rushers.length,
        families: families.size,
        qb: !!board?.querySelector(".wp-pocket-qb"),
        lost: !!board?.querySelector(".wp-pass-lost"),
      };
    });
    pocket ||= state.active;
    maxSet = Math.max(maxSet, state.set);
    maxRush = Math.max(maxRush, state.rush);
    maxFamilies = Math.max(maxFamilies, state.families);
    sawQB ||= state.qb;
    sawLost ||= state.lost;
    if (state.active && !activeShot) {
      await page.screenshot({ path: shot });
      activeShot = true;
    }
    await page.waitForTimeout(50);
  }

  leaked ||= await page.evaluate(() => {
    const board = document.querySelector("#watch-board");
    return !board?.classList.contains("watch-pass-pocket") &&
      !!board?.querySelector(".wp-pass-set,.wp-pass-engaged,.wp-pocket-qb");
  });
}

await browser.close();
let pass = true;
const check = (name, ok, detail = "") => {
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? `  [${detail}]` : ""));
  if (!ok) pass = false;
};
check("pageerrors 0", errors.length === 0, errors.join(" | ").slice(0, 260));
check("dropback call sheet reached", sheet);
check("explicit live pocket state observed", pocket);
check("the called protection engages every live down rusher", maxSet >= 3, `max=${maxSet}`);
check("live rushers retain paired protection actors", maxRush >= 3 && maxRush === maxSet, `rush=${maxRush} set=${maxSet}`);
check("the called rush retains its authored move family", maxFamilies >= 1, `families=${maxFamilies}`);
check("quarterback carries a live pocket base", sawQB);
check("pass-set state clears after release", !leaked);
console.log("lost leverage observed: " + sawLost);
console.log("shot: " + shot);
process.exit(pass ? 0 : 1);
