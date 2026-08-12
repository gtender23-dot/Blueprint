// front_variants_probe.mjs — verifies fronts wave 2 (Aug 2026, brain-expansion
// pass 1): Tite, 4-4, Big Nickel, Penny + the job-slot depth chart wiring.
//
// Owner decisions: job-slot depth chart (Option A — roster positions stay,
// depth chart speaks jobs: ROVER, JACK/JOKER, SPUR/BANDIT, EDGE), folded into
// the fronts pass. Pins:
//   1. Personnel: each front fields ELEVEN with the right position mix;
//      Penny's EDGEs RUSH (DL=5) like 3-4 OLBs; Tite/4-4 overhangs cover.
//   2. Layouts: 11 slots each, mix matches counts, job labels present
//      (ROV/JACK/JOKER/SPUR/BNDT/EDGE), blitz/drop eligibility sane.
//   3. Tables complete: matchup columns in all rows, weights sum to 1,
//      signatures registered.
//   4. selectDefFront: Big Nickel base stays Big Nickel where the picker
//      would sub the 4-2-5 (its ROVER is already the nickel answer).
//   5. Scheme-aware economy: 4-4 (S:1) floors S targets; Penny (DT:1, CB:3)
//      shifts DT down/CB up; Tite hard = DT 3 / LB 7.
//   6. Sub-front pins honored: resolveDefField("Nickel") with a pinned NB
//      puts that exact player on the field; with no pins, resolveDefPersonnel
//      remains the sim's chooser (AI byte-identical — asserted by the pin
//      gate logic being pin-count-driven).
import { resolveDefPersonnel, selectDefFront, FRONT_PRESSURE_SIGNATURE } from '../js/engine/formations.js';
import { resolveDefField } from '../js/engine/fieldassign.js';
import { roleFor } from '../js/engine/portal.js';
import { DEF_FRONT_COUNTS, DEF_FRONT_WEIGHTS, MATCHUP_MATRIX, schemeRosterTargets, schemeStarterCounts } from '../js/constants.js';
import { DEF_FIELD_LAYOUTS, DEF_BLITZ_ELIGIBLE, DEF_DROP_ELIGIBLE } from '../js/constants_field.js';

let pass = 0, fail = 0;
function check(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  got=${JSON.stringify(got)}${ok ? "" : `  want=${JSON.stringify(want)}`}`);
}

let nextId = 1;
const ATTRS = { SPD: 62, STR: 62, AGI: 62, AWR: 55, TEC: 55, HND: 55, TKL: 60, COV: 58 };
function mkPlayer(pos, rating) {
  return { id: `p${nextId++}`, position: pos, compositeRating: rating, classYear: "JR", attributes: { ...ATTRS } };
}
function mkRoster() {
  const roster = [];
  const add = (pos, ratings) => ratings.forEach((r) => roster.push(mkPlayer(pos, r)));
  add("DE", [72, 68, 64]); add("DT", [71, 67, 63]); add("OLB", [72, 68, 64]); add("LB", [71, 67, 63]);
  add("CB", [72, 69, 66, 63]); add("S", [71, 68, 65, 62]);
  return roster;
}
const roster = mkRoster();
const dc = {};
for (const p of roster) (dc[p.position] = dc[p.position] || []).push(p.id);

const NEW_FRONTS = ["Tite", "4-4", "Big Nickel", "Penny"];
console.log("— 1. personnel —");
for (const f of NEW_FRONTS) {
  const pers = resolveDefPersonnel(f, dc, roster);
  const total = pers.DE.length + pers.DT.length + pers.OLB.length + pers.ILB.length + pers.CB.length + pers.S.length;
  check(`${f}: eleven`, total, 11);
}
check("Penny EDGEs rush (DL=5)", resolveDefPersonnel("Penny", dc, roster).DL.length, 5);
check("Penny coverage backers = lone MIKE", resolveDefPersonnel("Penny", dc, roster).LB.length, 1);
check("Tite overhangs cover (DL=3, LB group=4)", (() => { const p = resolveDefPersonnel("Tite", dc, roster); return [p.DL.length, p.LB.length]; })(), [3, 4]);
check("4-4 fields one safety, LB group=4", (() => { const p = resolveDefPersonnel("4-4", dc, roster); return [p.S.length, p.LB.length]; })(), [1, 4]);
check("Big Nickel three safeties", resolveDefPersonnel("Big Nickel", dc, roster).S.length, 3);

console.log("— 2. layouts & jobs —");
for (const f of NEW_FRONTS) {
  const layout = DEF_FIELD_LAYOUTS[f];
  check(`${f}: layout has 11 slots`, layout.slots.length, 11);
  const mix = layout.slots.reduce((m, s2) => (m[s2.pos] = (m[s2.pos] || 0) + 1, m), {});
  const canon = (o) => Object.fromEntries(Object.entries(o).sort());
  check(`${f}: layout mix matches counts`, canon(mix), canon(Object.fromEntries(Object.entries(DEF_FRONT_COUNTS[f]).filter(([, v]) => v > 0))));
}
const labels = (f) => DEF_FIELD_LAYOUTS[f].slots.map((s2) => s2.label);
check("Big Nickel has the ROVER", labels("Big Nickel").includes("ROV"), true);
check("Tite has JACK and JOKER", labels("Tite").includes("JACK") && labels("Tite").includes("JOKER"), true);
check("4-4 has SPUR and BANDIT", labels("4-4").includes("SPUR") && labels("4-4").includes("BNDT"), true);
check("Penny has two EDGEs + NB", labels("Penny").filter((l) => l === "EDGE").length === 2 && labels("Penny").includes("NB"), true);
check("Penny EDGEs are drop-eligible (fire-zone dial)", DEF_DROP_ELIGIBLE["Penny"], ["OLB_L", "OLB_R"]);
for (const f of NEW_FRONTS) {
  const ids = new Set(DEF_FIELD_LAYOUTS[f].slots.map((s2) => s2.id));
  check(`${f}: blitz-eligible ids all exist`, (DEF_BLITZ_ELIGIBLE[f] || []).every((id) => ids.has(id)), true);
}

console.log("— 3. tables —");
check("matchup rows carry all four", Object.values(MATCHUP_MATRIX).every((row) => NEW_FRONTS.every((f) => typeof row[f] === "number")), true);
for (const f of NEW_FRONTS) {
  const ok = Object.values(DEF_FRONT_WEIGHTS[f]).every((w) => Math.round(Object.values(w).reduce((a, b) => a + b, 0) * 100) === 100);
  check(`${f}: weights sum to 1`, ok, true);
  check(`${f}: signature`, typeof FRONT_PRESSURE_SIGNATURE[f], "string");
}

console.log("— 4. selectDefFront —");
check("Big Nickel base stays vs 4WR 1st down", selectDefFront("Big Nickel", 1, 10, 900, 1, 0, "Air Raid", "auto"), "Big Nickel");
check("Big Nickel base: Dime on 3rd-and-9 vs 4WR", selectDefFront("Big Nickel", 3, 9, 900, 1, 0, "Air Raid", "auto"), "Dime");
check("Tite base subs Nickel vs 4WR (still a base front)", selectDefFront("Tite", 1, 10, 900, 1, 0, "Air Raid", "auto"), "Nickel");
check("4-4 base: 5-2 inside the 1", selectDefFront("4-4", 3, 1, 900, 1, 0, "Power-I", "auto"), "5-2");

console.log("— 5. scheme-aware economy —");
const mk = (gp) => ({ id: "s1", roster, gameplan: gp });
const tg44 = schemeRosterTargets(mk({ defFront: "4-4" }));
check("4-4 targets S floored at MIN 3, LB 7, OLB 5", [tg44.S, tg44.LB, tg44.OLB], [3, 7, 5]);
const tgP = schemeRosterTargets(mk({ defFront: "Penny" }));
check("Penny targets DT 3 / CB 9", [tgP.DT, tgP.CB], [3, 9]);
const cT = schemeStarterCounts(mk({ defFront: "Tite" }));
check("Tite starter counts DT/LB", [cT.DT, cT.LB], [1, 2]);
const bigN = mk({ defFront: "Big Nickel" });
check("Big Nickel: S3 is rotation", roleFor(bigN, roster.filter((p) => p.position === "S")[2]).role, "rotation");

console.log("— 6. sub-front pins —");
const cb3 = roster.filter((p) => p.position === "CB")[2];
const pinned = resolveDefField("Nickel", { NB: cb3.id }, {}, dc, null, (id) => roster.find((p) => p.id === id)?.position || null);
check("pinned NB takes the Nickel field", pinned.bySlot.NB, cb3.id);
const unpinned = resolveDefField("Penny", {}, {}, dc, null, (id) => roster.find((p) => p.id === id)?.position || null);
check("Penny resolves a full eleven unpinned", Object.values(unpinned.bySlot).filter(Boolean).length, 11);
check("Penny field: EDGEs in rush unit", unpinned.personnel.DL.length, 5);

console.log("\u2014 7. front mix \u2014");
const MIX = [{ id: "4-3", weight: 50 }, { id: "3-3-5", weight: 30 }, { id: "Penny", weight: 20 }];
const rollN = (mix, n) => {
  const out = {};
  for (let i = 0; i < n; i++) {
    const f = selectDefFront("4-3", 1, 10, 900, 1, 0, "Single Back", "auto", mix);
    out[f] = (out[f] || 0) + 1;
  }
  return out;
};
const dist = rollN(MIX, 6e3);
const pct = (f) => (dist[f] || 0) / 6e3;
console.log(`  mix rolls: 4-3 ${(pct("4-3") * 100).toFixed(1)}%  3-3-5 ${(pct("3-3-5") * 100).toFixed(1)}%  Penny ${(pct("Penny") * 100).toFixed(1)}%`);
check("mix ~50/30/20 (\u00b14pp)", Math.abs(pct("4-3") - 0.5) < 0.04 && Math.abs(pct("3-3-5") - 0.3) < 0.04 && Math.abs(pct("Penny") - 0.2) < 0.04, true);
check("no mix = base every time", Object.keys(rollN(null, 500)), ["4-3"]);
check("empty mix = base", Object.keys(rollN([], 500)), ["4-3"]);
check("short yardage overrides the mix", selectDefFront("4-3", 3, 1, 900, 1, 0, "Power-I", "auto", MIX), "5-2");
check("3rd-and-7 sub overrides the mix", selectDefFront("4-3", 3, 7, 900, 1, 0, "Single Back", "auto", MIX), "Nickel");
check("bogus front ids in mix are ignored", Object.keys(rollN([{ id: "6-5", weight: 100 }], 300)), ["4-3"]);
check("mix rolls under base philosophy too", Object.keys(rollN(MIX.slice(0, 2), 2e3)).sort(), ["3-3-5", "4-3"]);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
