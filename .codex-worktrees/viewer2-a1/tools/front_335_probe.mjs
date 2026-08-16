// front_335_probe.mjs — verifies the 3-3-5 odd-stack front (Aug 2026).
//
// Owner decisions: stack shape = 2 stack OLBs + 1 Mike + 3 S (the odd-front
// nickel that KEEPS the OLBs); AI programs MAY base out of it when the
// secondary clearly outclasses the front seven. Pins:
//   1. resolveDefPersonnel("3-3-5") fields ELEVEN: 2 DE, 1 NT, 2 OLB, 1 Mike,
//      2 CB, 3 S; LB coverage group = 3 backers; rush unit = 3 down bodies.
//   2. Scheme-aware economy: hard 3-3-5 → S3 buried→rotation, DT2 buried;
//      targets S 5→7, DT 5→3; base-3-3-5 (blend path) qualifies too.
//   3. selectDefFront: a 3-3-5 base STAYS in its stack where other bases sub
//      the 4-2-5 Nickel; Dime on true long downs and 5-2/46 short-yardage
//      overrides still fire; classic 4-3 base behavior is byte-identical.
//   4. Tables complete: every MATCHUP_MATRIX row has a 3-3-5 column,
//      DEF_FRONT_WEIGHTS rows sum to 1, pressure signature registered.
//   5. AI adoption: DB-rich/front-seven-poor rosters base 3-3-5 at a real
//      rate; balanced rosters mostly don't.
import { resolveDefPersonnel, selectDefFront, FRONT_PRESSURE_SIGNATURE } from '../js/engine/formations.js';
import { roleFor } from '../js/engine/portal.js';
import { setAIGameplan } from '../js/engine/ai.js';
import { DEF_FRONT_COUNTS, DEF_FRONT_WEIGHTS, MATCHUP_MATRIX, schemeRosterTargets, ROSTER_TARGETS } from '../js/constants.js';
import { DEF_FIELD_LAYOUTS, DEF_BLITZ_ELIGIBLE } from '../js/constants_field.js';

let pass = 0, fail = 0;
function check(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  got=${JSON.stringify(got)}${ok ? "" : `  want=${JSON.stringify(want)}`}`);
}

let nextId = 1;
const ATTRS = { SPD: 62, STR: 62, AGI: 62, AWR: 55, TEC: 55, HND: 55, TKL: 60, COV: 58, BLK: 55, KIK: 50 };
function mkPlayer(pos, rating, classYear = "JR") {
  return { id: `p${nextId++}`, position: pos, compositeRating: rating, classYear, attributes: { ...ATTRS } };
}
function mkRoster(defBoost = {}) {
  const roster = [];
  const add = (pos, ratings) => ratings.forEach((r) => roster.push(mkPlayer(pos, r + (defBoost[pos] || 0))));
  add("QB", [72, 65]); add("RB", [70, 66, 62]); add("WR", [72, 68, 65, 62]); add("TE", [66, 62]);
  add("OL", [70, 69, 68, 67, 66, 62]); add("K", [60]); add("P", [58]);
  add("DE", [70, 66, 62]); add("DT", [69, 65, 61]); add("OLB", [70, 66, 62]); add("LB", [69, 65, 61]);
  add("CB", [70, 67, 64, 61]); add("S", [69, 66, 63, 60]);
  return roster;
}
function mkSchool(gameplan, defBoost = {}) {
  return { id: "s1", name: "Test U", division: "D1", prestige: 2, lat: 0, lng: 0, roster: mkRoster(defBoost), gameplan };
}

console.log("— 1. personnel —");
const school = mkSchool({});
const dc = {};
for (const p of school.roster) (dc[p.position] = dc[p.position] || []).push(p.id);
const pers = resolveDefPersonnel("3-3-5", dc, school.roster);
check("counts DE/DT/OLB/ILB/CB/S", [pers.DE.length, pers.DT.length, pers.OLB.length, pers.ILB.length, pers.CB.length, pers.S.length], [2, 1, 2, 1, 2, 3]);
check("total defenders", pers.DE.length + pers.DT.length + pers.OLB.length + pers.ILB.length + pers.CB.length + pers.S.length, 11);
check("coverage-backer group (Mike + 2 stack OLBs)", pers.LB.length, 3);
check("rush unit is the three down bodies", pers.DL.length, 3);
check("DB unit (2 CB + 3 S)", pers.DB.length, 5);

console.log("— 2. scheme-aware economy —");
const hard335 = mkSchool({ defFront: "3-3-5", defBaseFront: "4-3" });
const base335 = mkSchool({ defFront: "auto", defBaseFront: "3-3-5" });
const base43 = mkSchool({ defFront: "auto", defBaseFront: "4-3" });
const s3Of = (s) => s.roster.filter((p) => p.position === "S")[2];
const dt2Of = (s) => s.roster.filter((p) => p.position === "DT")[1];
check("4-3: S3 role", roleFor(base43, s3Of(base43)).role, "buried");
check("hard 3-3-5: S3 role", roleFor(hard335, s3Of(hard335)).role, "rotation");
check("base-3-3-5 blend: S3 role", roleFor(base335, s3Of(base335)).role, "rotation");
check("hard 3-3-5: DT2 role (one-NT front)", roleFor(hard335, dt2Of(hard335)).role, "buried");
const tg = schemeRosterTargets(hard335);
check("targets S/DT/OLB/CB", [tg.S, tg.DT, tg.OLB, tg.CB], [7, 3, 5, 7]);
check("4-3 base targets untouched", schemeRosterTargets(base43), ROSTER_TARGETS);

console.log("— 3. selectDefFront —");
// (base, down, distance, clock, half, trailing, offFormation, philosophy)
check("3-3-5 base stays vs Spread 1st-and-10", selectDefFront("3-3-5", 1, 10, 900, 1, 0, "Spread", "auto"), "3-3-5");
check("3-3-5 base stays vs Spread (match phil.)", selectDefFront("3-3-5", 1, 10, 900, 1, 0, "Spread", "match"), "3-3-5");
check("3-3-5 base: Dime on 4WR 3rd-and-8", selectDefFront("3-3-5", 3, 8, 900, 1, 0, "Air Raid", "auto"), "Dime");
check("3-3-5 base: 5-2 inside the 1", selectDefFront("3-3-5", 3, 1, 900, 1, 0, "Power-I", "auto"), "5-2");
check("3-3-5 base: 46/Bear on 3rd-and-2", selectDefFront("3-3-5", 3, 2, 900, 1, 0, "Power-I", "auto"), "46/Bear");
check("3-3-5 base stays vs 4WR 1st-and-10 (auto)", selectDefFront("3-3-5", 1, 10, 900, 1, 0, "Air Raid", "auto"), "3-3-5");
check("4-3 base still subs Nickel vs 4WR 1st-and-10 (regression)", selectDefFront("4-3", 1, 10, 900, 1, 0, "Air Raid", "auto"), "Nickel");
check("4-3 base: match phil. subs Nickel vs Spread (regression)", selectDefFront("4-3", 1, 10, 900, 1, 0, "Spread", "match"), "Nickel");
check("4-3 base: 3rd-and-7 Nickel (regression)", selectDefFront("4-3", 3, 7, 900, 1, 0, "Single Back", "auto"), "Nickel");

console.log("— 4. table completeness —");
check("MATCHUP_MATRIX rows with 3-3-5", Object.values(MATCHUP_MATRIX).filter((row) => typeof row["3-3-5"] === "number").length, Object.keys(MATCHUP_MATRIX).length);
const sums = Object.entries(DEF_FRONT_WEIGHTS["3-3-5"]).map(([k, w]) => [k, Math.round(Object.values(w).reduce((a, b) => a + b, 0) * 100) / 100]);
check("3-3-5 weight rows sum to 1", sums.every(([, v]) => v === 1), true);
check("counts table entry sums to 11", Object.values(DEF_FRONT_COUNTS["3-3-5"]).reduce((a, b) => a + b, 0), 11);
check("pressure signature registered", FRONT_PRESSURE_SIGNATURE["3-3-5"], "fireZone");
check("field layout fields 11", DEF_FIELD_LAYOUTS["3-3-5"].slots.length, 11);
check("blitz-eligible = all six second-level + backs", DEF_BLITZ_ELIGIBLE["3-3-5"].length >= 6, true);
const layoutPos = DEF_FIELD_LAYOUTS["3-3-5"].slots.reduce((m, s2) => (m[s2.pos] = (m[s2.pos] || 0) + 1, m), {});
check("layout position mix matches counts", layoutPos, { S: 3, CB: 2, OLB: 2, LB: 1, DE: 2, DT: 1 });

console.log("— 5. AI adoption Monte-Carlo —");
function aiRate(defBoost, N = 400) {
  let stack = 0;
  for (let i = 0; i < N; i++) {
    nextId = 1;
    const sch = mkSchool(undefined, defBoost);
    setAIGameplan(sch);
    if (sch.gameplan.defBaseFront === "3-3-5") stack++;
  }
  return stack / N;
}
const rDb = aiRate({ CB: 14, S: 14, DE: -6, DT: -6, OLB: -6 });
const rBal = aiRate({});
console.log(`  DB-rich roster bases 3-3-5: ${(rDb * 100).toFixed(1)}%   balanced roster: ${(rBal * 100).toFixed(1)}%`);
check("DB-rich rosters adopt the stack (>50%)", rDb > 0.5, true);
check("balanced rosters mostly don't (<25%)", rBal < 0.25, true);
check("DB-rich >> balanced", rDb > rBal + 0.3, true);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
