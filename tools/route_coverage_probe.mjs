// M12 route, coverage-leverage and catch-point visual/structural gate.
// Usage: node tools/route_coverage_probe.mjs [shot.png]
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shot = process.argv[2] || join(root, "_route-coverage.png");
const tmp = mkdtempSync(join(tmpdir(), "wsproute-"));
const entry = join(tmp, "entry.js");
const bundle = join(tmp, "bundle.js");
writeFileSync(entry, `import { spriteMarkup } from ${JSON.stringify(join(root, "js/ui/sprite.js").replace(/\\/g, "/"))};window.__spriteMarkup=spriteMarkup;`);
const esbuild = process.platform === "win32" ? join(root, "node_modules/@esbuild/win32-x64/esbuild.exe") : join(root, "node_modules/esbuild/bin/esbuild");
execFileSync(esbuild, [entry, "--bundle", "--format=iife", `--outfile=${bundle}`], { stdio: "pipe" });
const css = readFileSync(join(root, "style.css"), "utf8");
const js = readFileSync(bundle, "utf8");
const html = `<!doctype html><meta charset="utf-8"><style>${css}
html,body{margin:0;background:#071d18}#watch-board{display:block;width:1600px;height:1000px}.rt-title{fill:#ffd34d;font:900 2.05px monospace;text-anchor:middle}.rt-sub{fill:#a9c0b2;font:800 .9px monospace;text-anchor:middle}.rt-cell .wsp-tag{display:none}.rt-rule{stroke:#214b36;stroke-width:.2}
</style><svg id="watch-board" class="watch-sprites watch-in-play watch-route-live" viewBox="0 0 200 125"></svg><script>${js}<\/script><script>
const svg=document.getElementById('watch-board');svg.style.setProperty('--wsp-off','#f2ead8');svg.style.setProperty('--wsp-off-hl','#dda919');svg.style.setProperty('--wsp-def','#8f2942');svg.style.setProperty('--wsp-def-hl','#f2ead8');
const actor=(team,id,pos,face,cls,x,y)=>'<g class="rt-cell wp-actor wp-team-'+team+' wsp-face-'+face+' '+cls+'" data-case="'+id+'" transform="translate('+x+','+y+') scale(3.7)">'+window.__spriteMarkup({id:team+'-'+id,team,label:pos,pos,grp:pos},face)+'</g>';
const routes=[['RELEASE','wp-route-active wp-route-release wp-route-cut wp-route-left'],['STEM','wp-route-active wp-route-stem wp-route-vertical wp-route-straight'],['CUT LEFT','wp-route-active wp-route-break wp-route-cut wp-route-left'],['CUT RIGHT','wp-route-active wp-route-break wp-route-cut wp-route-right'],['DOUBLE','wp-route-active wp-route-break wp-route-double wp-route-right'],['SETTLE','wp-route-active wp-route-break wp-route-settle wp-route-left'],['VERTICAL','wp-route-active wp-route-stem wp-route-vertical wp-route-straight'],['HANDS READY','wp-route-active wp-route-target wp-route-hands wp-route-cut wp-route-right']];
let out='<line class="rt-rule" x1="4" x2="196" y1="42" y2="42"/><line class="rt-rule" x1="4" x2="196" y1="82" y2="82"/>';
routes.forEach((r,i)=>{const x=13+i*25,y=35;out+='<text class="rt-title" x="'+x+'" y="6">'+r[0]+'</text>'+actor('off','route-'+i,'WR',i%2?'w':'e',r[1],x,y)});
const cov=[['PEDAL','wp-cov-active wp-cov-man wp-cov-pedal wp-cov-left'],['TURN LEFT','wp-cov-active wp-cov-man wp-cov-turn wp-cov-left'],['TURN RIGHT','wp-cov-active wp-cov-man wp-cov-turn wp-cov-right'],['TRAIL','wp-cov-active wp-cov-target wp-cov-man wp-cov-trail wp-cov-right']];
cov.forEach((r,i)=>{const x=25+i*50,y=76;out+='<text class="rt-title" x="'+x+'" y="47">'+r[0]+'</text><text class="rt-sub" x="'+x+'" y="49.5">COVERAGE LEVERAGE</text>'+actor('def','cov-'+i,'CB',i%2?'w':'e',r[1],x,y)});
out+='<text class="rt-title" x="50" y="87">SECURE THROUGH CONTACT</text>'+actor('off','secure-wr','WR','e','wp-catching wp-catch-hi wp-catch-contested wp-catchpoint wp-catchpoint-receiver wp-catchpoint-secure',45,119)+actor('def','secure-db','CB','w','wp-contesting wp-catchpoint wp-catchpoint-defender wp-catchpoint-secure',55,119);
out+='<text class="rt-title" x="150" y="87">PLAY THROUGH THE HANDS</text>'+actor('off','breakup-wr','WR','e','wp-catching wp-catch-breakup wp-catch-contested wp-catchpoint wp-catchpoint-receiver wp-catchpoint-breakup',145,119)+actor('def','breakup-db','CB','w','wp-contesting wp-breakup wp-catchpoint wp-catchpoint-defender wp-catchpoint-breakup',155,119);svg.innerHTML=out;
const anim=n=>getComputedStyle(n).animationName,route=[...svg.querySelectorAll('[data-case^="route-"]')],coverage=[...svg.querySelectorAll('[data-case^="cov-"]')];window.__report={actors:svg.querySelectorAll('.wp-actor').length,routeShell:route.map(n=>anim(n.querySelector('.wsp-shell'))),routeFeet:route.slice(2,6).flatMap(n=>[...n.querySelectorAll('.wsp-sd-thigh,.wsp-leg-chain')].map(anim)),gather:[...route[7].querySelectorAll('.wsp-run-arm-l,.wsp-run-arm-r,.wsp-sd-uarm-f')].map(anim),coverage:coverage.map(n=>anim(n.querySelector('.wsp-shell'))),pedalFeet:[...coverage[0].querySelectorAll('.wsp-sd-thigh')].map(anim),secure:[...svg.querySelectorAll('[data-case="secure-wr"] .wsp-catch-arm-l,[data-case="secure-wr"] .wsp-catch-arm-r,[data-case="secure-db"] .wsp-tkl-arm-l,[data-case="secure-db"] .wsp-tkl-arm-r')].map(anim),breakup:[...svg.querySelectorAll('[data-case="breakup-wr"] .wsp-catch-arm-l,[data-case="breakup-wr"] .wsp-catch-arm-r,[data-case="breakup-db"] .wsp-tkl-arm-l,[data-case="breakup-db"] .wsp-tkl-arm-r')].map(anim),catchPose:getComputedStyle(svg.querySelector('[data-case="secure-wr"] .wsp-pose-catch')).display,contestPose:getComputedStyle(svg.querySelector('[data-case="secure-db"] .wsp-pose-tackle')).display};
<\/script>`;
const pagePath = join(tmp, "route.html");
writeFileSync(pagePath, html);
const { chromium } = await import(pathToFileURL(join(root, "node_modules/playwright/index.mjs")).href);
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
await page.goto("file://" + pagePath);
await page.waitForTimeout(260);
const report = await page.evaluate("window.__report");
await page.screenshot({ path: shot });
await browser.close();
let pass = true;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (detail ? `  [${detail}]` : "")); if (!ok) pass = false; };
const uniq = (items) => new Set(items.filter((name) => name && name !== "none"));
check("pageerrors 0", errors.length === 0, errors.join(" | ").slice(0, 260));
check("all 16 downfield actors render", report.actors === 16, `count=${report.actors}`);
check("release, stem, both cuts, double and settle render", uniq(report.routeShell).size >= 6, report.routeShell.join(","));
check("cuts and double moves own distinct plant feet", uniq(report.routeFeet).size >= 4, `unique=${uniq(report.routeFeet).size}`);
check("target gathers both hands before the catch", uniq(report.gather).size >= 2, report.gather.join(","));
check("pedal, both hip turns and trail differ", uniq(report.coverage).size === 4, report.coverage.join(","));
check("backpedal owns alternating feet", uniq(report.pedalFeet).size >= 2, report.pedalFeet.join(","));
check("secure catch binds receiver and defender hands", uniq(report.secure).size >= 2, report.secure.join(","));
check("breakup uses a different rake and displacement", uniq(report.breakup).size >= 2 && [...uniq(report.breakup)].every((name) => !uniq(report.secure).has(name)), report.breakup.join(","));
check("catch and contest poses share the point", report.catchPose !== "none" && report.contestPose !== "none");
console.log("shot: " + shot);
process.exit(pass ? 0 : 1);
