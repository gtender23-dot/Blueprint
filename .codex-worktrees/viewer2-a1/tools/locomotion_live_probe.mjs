// M19 live locomotion gate against the built game.
// Usage: node tools/locomotion_live_probe.mjs <built.html> [shot.png]
import { chromium } from "playwright";

const target = process.argv[2];
const shot = process.argv[3] || "_m19-locomotion-live.png";
if (!target) {
  console.error("usage: node tools/locomotion_live_probe.mjs <built.html> [shot.png]");
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

const seen = new Set();
let actorMax = 0, invalidState = 0, invalidPlant = 0, phaseSamples = 0;
let phaseScrubbed = false, captured = false, movingFrames = 0;
const locoClasses = ["still", "start", "walk", "jog", "sprint", "brake", "plant"];

for (let frame = 0; frame < 240; frame += 1) {
  const snap = await page.evaluate((states) => {
    const board = document.querySelector("#watch-board");
    const actors = [...(board?.querySelectorAll(".wp-actor") || [])];
    return {
      inPlay: board?.classList.contains("watch-in-play") || false,
      actors: actors.map(node => {
        const active = states.filter(state => node.classList.contains(`wsp-loco-${state}`));
        const planted = Number(node.classList.contains("wsp-plant-a")) + Number(node.classList.contains("wsp-plant-b"));
        const ph = Number(node.style.getPropertyValue("--ph"));
        const shell = node.querySelector(".wsp-shell");
        const css = shell ? getComputedStyle(shell) : null;
        return {
          active,
          planted,
          phase: Number.isFinite(ph) ? ph : null,
          phasePaused: css?.animationPlayState?.split(",").some(value => value.trim() === "paused") || false,
          phaseDelay: css?.animationDelay || "",
          moving: !node.classList.contains("wsp-still"),
          cut: node.classList.contains("wsp-cut-left") || node.classList.contains("wsp-cut-right"),
          backpedal: node.classList.contains("wsp-backpedal"),
          shuffle: node.classList.contains("wsp-shuffle")
        };
      })
    };
  }, locoClasses);
  actorMax = Math.max(actorMax, snap.actors.length);
  for (const actor of snap.actors) {
    actor.active.forEach(state => seen.add(state));
    if (actor.cut) seen.add("cut");
    if (actor.backpedal) seen.add("backpedal");
    if (actor.shuffle) seen.add("shuffle");
    if (actor.active.length !== 1) invalidState += 1;
    if ((actor.active.includes("still") || actor.active.includes("plant")) && actor.planted !== 1) invalidPlant += 1;
    if (actor.moving) {
      movingFrames += 1;
      if (actor.phase != null && actor.phase >= 0 && actor.phase < 1) phaseSamples += 1;
      phaseScrubbed ||= actor.phasePaused && actor.phaseDelay.includes("-");
    }
  }
  if (!captured && snap.inPlay && snap.actors.length === 22 && (seen.has("sprint") || seen.has("plant"))) {
    await page.screenshot({ path: shot });
    captured = true;
  }
  if (phaseSamples > 140 && seen.has("start") && seen.has("sprint") && seen.has("brake") && seen.has("plant") && seen.has("backpedal")) break;
  await page.waitForTimeout(80);
}
if (!captured) await page.screenshot({ path: shot });
await browser.close();

let pass = true;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `  [${detail}]` : ""}`);
  if (!ok) pass = false;
};
check("pageerrors 0", errors.length === 0, errors.join(" | ").slice(0, 260));
check("full live cast receives locomotion state", actorMax === 22, `max=${actorMax}`);
check("locomotion state is mutually exclusive", invalidState === 0, `invalid=${invalidState}`);
check("starts, sprints, brakes, and planted cuts occur live", ["start", "sprint", "brake", "plant"].every(state => seen.has(state)), [...seen].join(","));
check("football retreat or lateral movement is identified", seen.has("backpedal") || seen.has("shuffle"), [...seen].join(","));
check("stops and redirects retain one support foot", invalidPlant === 0, `invalid=${invalidPlant}`);
check("moving actors expose a bounded ground phase", phaseSamples > 100, `samples=${phaseSamples}/${movingFrames}`);
check("base body motion is phase-scrubbed, not wall-clock driven", phaseScrubbed);
console.log(`shot: ${shot}`);
process.exit(pass ? 0 : 1);
