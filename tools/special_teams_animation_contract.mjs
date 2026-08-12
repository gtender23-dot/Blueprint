// M18 source contract for complete 11-v-11 special-teams presentation.
// This stays deliberately fast: use it before the browser/live-play probes.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const app = await readFile(`${root}/js/ui/app.js`, "utf8");
const css = await readFile(`${root}/style.css`, "utf8");
let pass = true;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `  [${detail}]` : ""}`);
  if (!ok) pass = false;
};

const kickoffTen = /Array\.from\(\{ length: 10 \}/.test(app);
const returnNine = /Array\.from\(\{ length: 9 \}/.test(app);
check("kickoff coverage is K plus ten lanes", kickoffTen);
check("kick return is PR, KR2, plus nine blockers", returnNine && /data-wpk="KR2"/.test(app));
check("punt unit totals eleven", /const protectCount = isFG \? 8 : 7/.test(app) && /\[7, 93\]\.map/.test(app));
check("punt return unit totals eleven", /const rushCount = isFG \? 11 : 8/.test(app) && /const jammerUnit = isFG \? \[\] : \[7, 93\]/.test(app));
check("place-kick protection and rush are eleven-a-side", /protectCount = isFG \? 8/.test(app) && /rushCount = isFG \? 11/.test(app));

const states = [
  "wp-st-anchor", "wp-st-rush", "wp-st-leap", "wp-st-jam", "wp-st-release",
  "wp-st-wedge", "wp-st-engage", "wp-st-breakdown", "wp-st-lead",
  "wp-st-hands", "wp-st-onside-dive", "wp-st-pile", "wp-st-faircatch",
  "wp-st-snapper", "wp-st-lost"
];
for (const state of states) {
  check(`motion state ${state}`, app.includes(state) && css.includes(state));
}

process.exit(pass ? 0 : 1);
