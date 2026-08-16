// scheme_role_probe.mjs — verifies the scheme-aware-roles pass (Aug 2026).
//
// A coach whose defensive identity is a sub front (hard-picked Front dial, or
// Nickel as BASE front) fields that front every meaningful snap, so the role
// and recruiting economy must read that front's starter counts, not the
// static base-4-3 table. This probe pins:
//   1. roleFor: OLB2 at a Nickel program reads "buried", CB3 reads "rotation";
//      both unchanged at a classic 4-3 program. Applies via defFront hard-pick
//      AND via defBaseFront="Nickel" (the blend path).
//   2. projectedPathToPlay: an OLB recruit sees the logjam, a CB recruit sees
//      the open third-corner job.
//   3. schemeRosterTargets: Nickel OLB 5→3, CB 7→9; Dime floors at
//      ROSTER_POS_MIN.OLB=3; 5-2 DT 5→7; classic fronts and AI-shaped
//      gameplans (defBaseFront 4-3/3-4, defFront auto) are byte-identical to
//      the static tables.
//   4. Attrition: Monte-Carlo buildTransferPortal — the JR OLB2 of a
//      hard-Nickel program enters the portal "buried — wants to play" at a
//      healthy rate; the same roster on a 4-3 base never does.
//   5. [BUGFIX] resolveDefPersonnel("46/Bear") fields ELEVEN (S was 1 — ten
//      men — in the stale local counts table).
import { roleFor, projectedPathToPlay, buildTransferPortal } from '../js/engine/portal.js';
import { resolveDefPersonnel } from '../js/engine/formations.js';
import { schemeRosterTargets, schemeStarterCounts, ROSTER_TARGETS, STARTER_COUNTS } from '../js/constants.js';

let pass = 0, fail = 0;
function check(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  got=${JSON.stringify(got)}${ok ? "" : `  want=${JSON.stringify(want)}`}`);
}

let nextId = 1;
function mkPlayer(pos, rating, classYear = "JR") {
  return { id: `p${nextId++}`, position: pos, compositeRating: rating, classYear, attributes: {} };
}
function mkSchool(gameplan) {
  const roster = [];
  const add = (pos, ratings, cy) => ratings.forEach((r) => roster.push(mkPlayer(pos, r, cy)));
  // Two OLBs + a third, three CBs + a fourth, at spaced ratings.
  add("OLB", [82, 76, 70]);
  add("CB", [84, 80, 74, 68]);
  add("S", [81, 77, 71]);
  add("DE", [83, 79]); add("DT", [82, 78]); add("LB", [80, 75]);
  return { id: "s1", name: "Test U", division: "D1", prestige: 2, lat: 0, lng: 0, roster, gameplan };
}

console.log("— 1. roleFor —");
const base43 = mkSchool({ defFront: "auto", defBaseFront: "4-3" });
const hardNickel = mkSchool({ defFront: "Nickel", defBaseFront: "4-3" });
const baseNickel = mkSchool({ defFront: "auto", defBaseFront: "Nickel" });
const olb2Of = (s) => s.roster.filter((p) => p.position === "OLB")[1];
const cb3Of = (s) => s.roster.filter((p) => p.position === "CB")[2];
check("4-3 base: OLB2 role", roleFor(base43, olb2Of(base43)).role, "rotation");
check("4-3 base: CB3 role", roleFor(base43, cb3Of(base43)).role, "buried");
check("hard Nickel: OLB2 role", roleFor(hardNickel, olb2Of(hardNickel)).role, "buried");
check("hard Nickel: CB3 role", roleFor(hardNickel, cb3Of(hardNickel)).role, "rotation");
check("base-Nickel blend: OLB2 role", roleFor(baseNickel, olb2Of(baseNickel)).role, "buried");
check("base-Nickel blend: CB3 role", roleFor(baseNickel, cb3Of(baseNickel)).role, "rotation");

console.log("— 2. projectedPathToPlay —");
const olbRecruit = { position: "OLB", potentialBand: "average", classYear: "FR", compositeRating: 72 };
const cbRecruit = { position: "CB", potentialBand: "average", classYear: "FR", compositeRating: 72 };
const t43olb = projectedPathToPlay(olbRecruit, base43);
const tNolb = projectedPathToPlay(olbRecruit, hardNickel);
const t43cb = projectedPathToPlay(cbRecruit, base43);
const tNcb = projectedPathToPlay(cbRecruit, hardNickel);
check("OLB recruit starters 4-3 vs Nickel", [t43olb.starters, tNolb.starters], [2, 1]);
check("CB recruit starters 4-3 vs Nickel", [t43cb.starters, tNcb.starters], [2, 3]);
console.log(`  info: OLB recruit tier ${t43olb.tier}→${tNolb.tier}, CB recruit tier ${t43cb.tier}→${tNcb.tier}`);

console.log("— 3. schemeRosterTargets / schemeStarterCounts —");
const tgN = schemeRosterTargets(hardNickel);
check("Nickel targets OLB/CB/S", [tgN.OLB, tgN.CB, tgN.S], [3, 9, 5]);
const tgD = schemeRosterTargets(mkSchool({ defFront: "Dime", defBaseFront: "4-3" }));
check("Dime targets OLB (floored at MIN 3)/CB/S", [tgD.OLB, tgD.CB, tgD.S], [3, 9, 7]);
const tg52 = schemeRosterTargets(mkSchool({ defFront: "5-2", defBaseFront: "4-3" }));
check("5-2 targets DT/LB/OLB", [tg52.DT, tg52.LB, tg52.OLB], [7, 7, 3]);
check("4-3 base targets untouched", schemeRosterTargets(base43), ROSTER_TARGETS);
check("AI-shaped 3-4 base targets untouched", schemeRosterTargets(mkSchool({ defBaseFront: "3-4" })), ROSTER_TARGETS);
check("no-gameplan school untouched", schemeRosterTargets({ id: "x" }), ROSTER_TARGETS);
check("hard 3-4 starter counts DT/LB", (() => { const c = schemeStarterCounts(mkSchool({ defFront: "3-4" })); return [c.DT, c.LB]; })(), [1, 2]);
check("static table identity when auto", schemeStarterCounts(base43) === STARTER_COUNTS, true);

console.log("— 4. attrition Monte-Carlo —");
function attritionRate(gameplan, pos, slotIdx) {
  const N = 3e3;
  let out = 0;
  for (let i = 0; i < N; i++) {
    nextId = 1;
    const school = mkSchool(gameplan);
    const target = school.roster.filter((p) => p.position === pos)[slotIdx];
    const state2 = {
      season: 2026,
      playerSchoolId: "s1",
      world: { schools: [school] }
    };
    const portal = buildTransferPortal(state2);
    if (portal.players.some((e) => e.player.id === target.id && e.reason.includes("wants to play"))) out++;
  }
  return out / N;
}
const r43 = attritionRate({ defFront: "auto", defBaseFront: "4-3" }, "OLB", 1);
const rN = attritionRate({ defFront: "Nickel", defBaseFront: "4-3" }, "OLB", 1);
console.log(`  OLB2 (JR, 76 ovr, 1 ahead) portal rate: 4-3 base ${(r43 * 100).toFixed(1)}%  hard Nickel ${(rN * 100).toFixed(1)}%`);
check("4-3: OLB2 never leaves (above old bar)", r43 === 0, true);
check("Nickel: OLB2 leaves at a real rate (>8%)", rN > 0.08, true);
const rN3 = attritionRate({ defFront: "Nickel", defBaseFront: "4-3" }, "OLB", 2);
console.log(`  OLB3 (70 ovr) hard-Nickel portal rate: ${(rN3 * 100).toFixed(1)}% (deeper = likelier)`);
check("Nickel: OLB3 rate >= OLB2 rate", rN3 >= rN, true);

console.log("— 5. 46/Bear fields eleven —");
nextId = 1;
const s46 = mkSchool({});
// Depth chart: enough bodies at every slot.
const dc = {};
for (const p of s46.roster) (dc[p.position] = dc[p.position] || []).push(p.id);
const pers = resolveDefPersonnel("46/Bear", dc, s46.roster);
const onField = ["DE", "DT", "OLB", "ILB", "CB", "S"].reduce((t, k) => t + (pers[k] || []).length, 0);
check("46/Bear total defenders", onField, 11);
check("46/Bear safeties", (pers.S || []).length, 2);
const persN = resolveDefPersonnel("Nickel", dc, s46.roster);
check("Nickel total defenders (regression)", ["DE", "DT", "OLB", "ILB", "CB", "S"].reduce((t, k) => t + (persN[k] || []).length, 0), 11);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
