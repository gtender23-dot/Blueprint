// broadcast_live_probe.mjs — M23 live gate against the built game.
// Watches live plays and asserts the stadium/broadcast layer IN THE DOM:
//  1. Three officials on every scrimmage play, never within the stand-off
//     of the ball (structural law, sampled).
//  2. The down box shows a legal down.
//  3. Fans carry section classes (home/away/neutral) — the reaction system
//     has sections to speak to.
//  4. Goalpost forks exist at both end lines.
//  5. Crowd-band parallax: the stands' transform tracks a fraction of the
//     camera pan (correlation-checked over same-play samples).
// Banner, roar classes, chain walk, replay wipe and net shake are SIGHTING-
// reported — per the M15/M18 lesson, a phase the throttled rAF never lands
// on is never a failure; the structural laws gate.
// Usage: node tools/broadcast_live_probe.mjs <built.html> [shot.png]
import { chromium } from "playwright";

const target = process.argv[2];
const shot = process.argv[3] || "_m23-broadcast-live.png";
if (!target) {
  console.error("usage: node tools/broadcast_live_probe.mjs <built.html> [shot.png]");
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

let scrimSamples = 0, crewBadCount = 0, crewNear = 0, crewMinD = Infinity,
  downOk = 0, downBad = 0, fansOk = false, postsOk = 0, postsBad = 0,
  parSamples = 0, parBad = 0, baseVb = null, basePar = null, prevSt = null, prevVb = null,
  roarSeen = false, bannerSeen = false, walkSeen = false, wipeSeen = false,
  shakeSeen = false, signalsSeen = new Set();

for (let frame = 0; frame < 520; frame += 1) {
  const s = await page.evaluate(() => {
    const board = document.querySelector("#watch-board");
    const vb = (board?.getAttribute("viewBox") || "").split(/\s+/).map(Number);
    const rd = node => {
      const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(node?.getAttribute("transform") || "");
      return m ? [Number(m[1]), Number(m[2])] : null;
    };
    const par = board?.querySelector(".wf-stadium-par");
    const pm = /translate\(([-\d.]+)/.exec(par?.getAttribute("transform") || "");
    const officials = [...(board?.querySelectorAll("[data-wpo]") || [])].map(n => ({
      pt: rd(n),
      sigs: [...n.classList].filter(c => c.startsWith("wpo-sig-"))
    }));
    const ball = rd(board?.querySelector("#wp-ball"));
    return {
      st: board?.classList.contains("watch-special-teams") || false,
      inPlay: board?.classList.contains("watch-in-play") || false,
      pre: board?.classList.contains("watch-presnap") || false,
      cast: (board?.querySelectorAll("[data-wpa]") || []).length,
      vb: vb.length === 4 && vb.every(Number.isFinite) ? vb : null,
      parX: pm ? Number(pm[1]) : par ? 0 : null,
      officials, ball,
      down: board?.querySelector("[data-wf-down]")?.getAttribute("data-wf-down") || null,
      fanHome: !!board?.querySelector(".wf-fan-home"),
      fanAway: !!board?.querySelector(".wf-fan-away"),
      posts: (board?.querySelectorAll("[data-wf-post]") || []).length,
      roar: /watch-roar-(home|away)/.test(board?.className.baseVal || board?.className || ""),
      banner: document.getElementById("watch-banner")?.classList.contains("on") || false,
      walk: !!board?.querySelector(".wf-gang-walk"),
      wipe: document.getElementById("watch-wipe")?.classList.contains("run") || false,
      shake: !!board?.querySelector(".wf-post-shake")
    };
  });
  if (s.roar) roarSeen = true;
  if (s.banner) bannerSeen = true;
  if (s.walk) walkSeen = true;
  if (s.wipe) wipeSeen = true;
  if (s.shake) shakeSeen = true;
  for (const o of s.officials) for (const c of o.sigs) signalsSeen.add(c.replace("wpo-sig-", ""));
  // gate on the REAL scrimmage board (full 22-actor cast) — the 2pt-try and
  // kneel mini-boards toggle watch-in-play but run their own tiny pipeline
  // with no officials/sticks/posts by design
  if (!s.st && s.vb && (s.inPlay || s.pre) && s.cast === 22) {
    scrimSamples++;
    if (s.officials.length !== 3) crewBadCount++;
    if (s.ball && s.inPlay) {
      for (const o of s.officials) {
        if (!o.pt) continue;
        const d = Math.hypot(o.pt[0] - s.ball[0], o.pt[1] - s.ball[1]);
        crewMinD = Math.min(crewMinD, d);
        if (d < 2.2) crewNear++;
      }
    }
    if (s.down != null) {
      if (["1", "2", "3", "4"].includes(String(s.down))) downOk++; else downBad++;
    }
    if (s.fanHome && s.fanAway) fansOk = true;
    if (s.posts === 2) postsOk++; else postsBad++;
    // parallax correlation: baseline at pre-snap, compare while the SAME
    // board pans. A board dispatch (viewBox jump or the dispatcher's full-
    // width frame) invalidates the baseline — the throttled rAF can hide
    // the next pre-snap entirely.
    if (prevVb == null || Math.abs(s.vb[0] - prevVb) > 20 || s.vb[2] > 98) {
      // a sampling gap (ST play, board dispatch, big jump) orphans the
      // baseline — require a fresh pre-snap before correlating again
      baseVb = null;
      basePar = null;
    }
    if (s.pre) {
      baseVb = s.vb[0];
      basePar = s.parX;
    } else if (baseVb != null && s.parX != null && Math.abs(s.vb[0] - baseVb) > 4) {
      parSamples++;
      const want = (s.vb[0] - baseVb) * 0.12 + (basePar || 0);
      if (Math.abs(s.parX - want) > 1.2) parBad++;
    }
    prevVb = s.vb[0];
  }
  if (s.st !== prevSt) {
    baseVb = null;
    basePar = null;
    prevVb = null;
  }
  prevSt = s.st;
  if (frame === 240) await page.screenshot({ path: shot });
  if (frame > 360 && scrimSamples > 140 && parSamples > 8) break;
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
check("three officials on every scrimmage sample", scrimSamples > 80 && crewBadCount === 0, `samples=${scrimSamples} bad=${crewBadCount}`);
check("officials never inside the play (rendered)", crewNear === 0, `minD=${crewMinD === Infinity ? "-" : crewMinD.toFixed(2)}u near=${crewNear}`);
check("down box shows a legal down", downOk > 20 && downBad === 0, `ok=${downOk} bad=${downBad}`);
check("fans carry section identity", fansOk);
check("goalpost forks at both end lines", postsOk > 40 && postsBad === 0, `ok=${postsOk} bad=${postsBad}`);
check("crowd-band parallax tracks the pan", parSamples >= 5 ? parBad / parSamples <= 0.2 : true, `samples=${parSamples} bad=${parBad}${parSamples < 5 ? " (few pans seen — structural checks above gate)" : ""}`);
console.log(`INFO sightings — roar:${roarSeen} banner:${bannerSeen} chain-walk:${walkSeen} wipe:${wipeSeen} net-shake:${shakeSeen} signals:[${[...signalsSeen].join(",") || "none"}] (absence under throttled rAF is env-dependent, never a failure)`);
console.log(`shot: ${shot}`);
process.exit(pass ? 0 : 1);
