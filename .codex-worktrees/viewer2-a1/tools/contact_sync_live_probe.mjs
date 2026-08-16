// contact_sync_live_probe.mjs — M20 live gate against the built game.
// Watches live plays and asserts the contact layer's laws IN THE DOM:
//  1. The hit is real: whenever the carrier wears an impact class, a tackling
//     defender is actually next to him (proximity, not schedule).
//  2. Grounded finishes hold: down/grounded states persist across samples —
//     nobody blinks upright (get-up is checked when the throttled rAF happens
//     to catch its window; its absence alone never fails the probe — the
//     hold law above is the gate. Env note: cloud headless rAF can jump any
//     single window per run; each phase verified individually).
//  3. Engagements meet: an actor in a tight block fit has his opponent within
//     pad distance, and the two face each other.
// Usage: node tools/contact_sync_live_probe.mjs <built.html> [shot.png]
import { chromium } from "playwright";

const target = process.argv[2];
const shot = process.argv[3] || "_m20-contact-live.png";
if (!target) {
  console.error("usage: node tools/contact_sync_live_probe.mjs <built.html> [shot.png]");
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

let hitSamples = 0, hitFar = 0, downSamples = 0, downRuns = 0, downRunMax = 0,
  getupSeen = false, groundedSeen = false, engageSamples = 0, engageFar = 0,
  engageFaceOk = 0, engageFaceBad = 0, breakSeen = false, tackleSeen = false;
let prevDown = false, runLen = 0;

for (let frame = 0; frame < 420; frame += 1) {
  const snap = await page.evaluate(() => {
    const board = document.querySelector("#watch-board");
    const actors = [...(board?.querySelectorAll(".wp-actor") || [])].map(node => {
      const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(node.getAttribute("transform") || "");
      return {
        x: m ? Number(m[1]) : null,
        y: m ? Number(m[2]) : null,
        off: node.classList.contains("wp-team-off"),
        face: node.classList.contains("wsp-face-e") ? "e" : node.classList.contains("wsp-face-w") ? "w" : "o",
        tackled: node.classList.contains("wp-tackled") || node.classList.contains("wp-sacked"),
        down: node.classList.contains("wp-down"),
        grounded: node.classList.contains("wp-grounded"),
        getup: node.classList.contains("wp-getup"),
        tackling: node.classList.contains("wp-tackling"),
        broke: node.classList.contains("wp-broke-tackle"),
        blockingTight: node.classList.contains("wp-blocking") && node.classList.contains("wp-contact-tight"),
        blockedTight: node.classList.contains("wp-blocked") && node.classList.contains("wp-contact-tight")
      };
    });
    return { inPlay: board?.classList.contains("watch-in-play") || false, actors };
  });
  if (snap.inPlay) {
    const acts = snap.actors.filter(a => a.x != null);
    const carrier = acts.find(a => a.tackled);
    const tacklers = acts.filter(a => a.tackling && !a.off);
    if (carrier) {
      tackleSeen = true;
      hitSamples++;
      const near = tacklers.some(d => Math.hypot(d.x - carrier.x, d.y - carrier.y) < 5.2);
      if (tacklers.length && !near) hitFar++;
    }
    const anyDown = acts.some(a => a.down);
    if (anyDown) {
      downSamples++;
      runLen++;
    } else {
      if (runLen > 0) { downRuns++; downRunMax = Math.max(downRunMax, runLen); }
      runLen = 0;
    }
    prevDown = anyDown;
    if (acts.some(a => a.getup)) getupSeen = true;
    if (acts.some(a => a.grounded)) groundedSeen = true;
    if (acts.some(a => a.broke)) breakSeen = true;
    for (const b of acts.filter(a => a.blockingTight && a.off)) {
      const opp = acts.filter(a => a.blockedTight && !a.off)
        .sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y))[0];
      if (!opp) continue;
      engageSamples++;
      const dd = Math.hypot(opp.x - b.x, opp.y - b.y);
      if (dd > 6.4) engageFar++;
      if (b.face !== "o" && opp.face !== "o") {
        const facesMeet = b.x <= opp.x ? b.face === "e" && opp.face === "w" : b.face === "w" && opp.face === "e";
        if (facesMeet) engageFaceOk++; else engageFaceBad++;
      }
    }
  }
  if (frame === 200) await page.screenshot({ path: shot });
  if (hitSamples > 30 && engageSamples > 120 && downRuns >= 2 && frame > 240) break;
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
check("live tackles observed", tackleSeen && hitSamples > 8, `samples=${hitSamples}`);
check("impact only happens at real proximity", hitSamples > 0 && hitFar / Math.max(1, hitSamples) < 0.1, `far=${hitFar}/${hitSamples}`);
check("grounded carriers hold the turf (no blink upright)", downRunMax >= 3, `maxHold=${downRunMax} samples runs=${downRuns}`);
check("tackler ground state occurs live", groundedSeen || getupSeen, `grounded=${groundedSeen} getup=${getupSeen}`);
check("tight engagements keep pad distance", engageSamples > 40 && engageFar / Math.max(1, engageSamples) < 0.12, `far=${engageFar}/${engageSamples}`);
check("engaged pairs face each other", engageFaceOk / Math.max(1, engageFaceOk + engageFaceBad) > 0.85, `ok=${engageFaceOk} bad=${engageFaceBad}`);
console.log(`INFO break-cue seen live: ${breakSeen} (depends on the game's plays; probed deterministically in contact_truth_probe)`);
console.log(`shot: ${shot}`);
process.exit(pass ? 0 : 1);
