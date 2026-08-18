// plan_side_probe — Stage 1 of the Playbook-Root refactor (Ref §4b).
// Guards the ONE canonical side manifest (PLAN_FIELD_SIDE): every field is sided
// off/def/team, the sides are disjoint, the fields the sim's situations layer
// consumes off the standing gameplan are all accounted for, and — on a real
// AI-authored plan — the partition is a clean cover (every owned field lands in
// exactly one bag, nothing dropped, nothing double-written). This is the check
// that makes the next dead-field or cross-side write impossible to ship silently.
import { PLAN_FIELD_SIDE, OFF_FIELDS, DEF_FIELDS, splitTeamPlan } from '../js/engine/teamplan.js';
import { generateWorld } from '../js/engine/world.js';
import { setAIGameplan } from '../js/engine/ai.js';

let pass = 0, fail = 0;
const bad = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; bad.push(msg); } }

// ── 1. every field is sided with a legal side ────────────────────────────────
const SIDES = new Set(['off', 'def', 'team']);
ok(Object.values(PLAN_FIELD_SIDE).every((s) => SIDES.has(s)), 'every manifest value is off/def/team');

// ── 2. the sides are disjoint (an object key has exactly one side) ───────────
const offSet = new Set(OFF_FIELDS), defSet = new Set(DEF_FIELDS);
ok(OFF_FIELDS.every((f) => !defSet.has(f)) && DEF_FIELDS.every((f) => !offSet.has(f)), 'off and def field lists are disjoint');
ok(OFF_FIELDS.length > 0 && DEF_FIELDS.length > 0, `both sides carry fields (off ${OFF_FIELDS.length}, def ${DEF_FIELDS.length})`);

// ── 3. spot-check the sidedness of critical fields ───────────────────────────
const expect = {
  offFormations: 'off', formationPlaybooks: 'off', tendency: 'off', passDepth: 'off', targetShares: 'off',
  defBaseFront: 'def', coverageScheme: 'def', pressureIdentity: 'def', blitzPct: 'def', defFrontMix: 'def',
  fourthDown: 'team', maxFGDist: 'team', baseTempo: 'team', situations: 'team',
  // D11 (OD-11): the audited manifest gaps, now sided by decision.
  screenRate: 'off', paRate: 'off', chipHelp: 'off', wildcatPassRate: 'off',
  rpoKeepPct: 'off', rbCarryShares: 'off', runDirection: 'off',
  callSheet: 'def',
  stFakes: 'team', puntDef: 'team', retScheme: 'team', patApproach: 'team', surpriseOnside: 'team'
};
for (const [f, side] of Object.entries(expect)) ok(PLAN_FIELD_SIDE[f] === side, `${f} is sided '${side}' (got '${PLAN_FIELD_SIDE[f]}')`);

// ── 4. every standing gameplan field the sim consumes is in the manifest ─────
// D11 (2026-08-18): widened from "getEffectivePlan's reads" to the FULL census
// of standing gameplan fields sim.js reads (COHESION_AUDIT_2026-08-18 §1
// tables — offense/defense/team dispositions), so the next manifest gap can't
// ship silently. Every entry below is verified as a `.field` read in
// js/engine/sim.js (or situations.js). A field the sim reads but the manifest
// forgot would drift into "unowned overlay" forever; fail loudly.
const SIM_CONSUMED = [
  // offense
  'offFormations', 'formationPlaybooks', 'tendency', 'passDepth', 'rushInPct',
  'conceptWeights', 'rpoRate', 'gadgetRate', 'qbRunPct', 'optionRate', 'optionMix',
  'pitchAggr', 'jetRate', 'drawRate', 'motionRate', 'qbAggr', 'protIdentity',
  'protEmphasis', 'losFreedom', 'targetShares',
  'screenRate', 'paRate', 'chipHelp', 'wildcatPassRate', 'rpoKeepPct',
  'rbCarryShares', 'runDirection',
  // defense
  'defBaseFront', 'defFrontMix', 'defAggression', 'blitzPct', 'pressureIdentity',
  'coverageScheme', 'covShell', 'covStyle', 'pressLevel', 'runCommit', 'edgePlay',
  'optionKey', 'robberCall', 'zoneStyle', 'tackleStyle', 'subPhilosophy',
  'bracketWho', 'greenDog', 'spyQB', 'defCalls', 'callSheet', 'formChecks',
  // team
  'fourthDown', 'maxFGDist', 'baseTempo', 'situations',
  'stFakes', 'puntDef', 'retScheme', 'patApproach', 'surpriseOnside'
];
const missing = SIM_CONSUMED.filter((f) => !(f in PLAN_FIELD_SIDE));
ok(missing.length === 0, `every sim-consumed standing field is in the manifest (missing: ${missing.join(', ') || 'none'})`);

// ── 5. on a real AI plan the partition is a clean cover ──────────────────────
const world = generateWorld();
let checked = 0, coverBad = 0, dupBad = 0;
for (const s of world.schools.slice(0, 40)) {
  setAIGameplan(s);
  const gp = s.gameplan;
  const { book, defbook, overlay } = splitTeamPlan(gp, { schoolName: s.name });
  const bagKeys = [...Object.keys(book.plan), ...Object.keys(defbook.plan), ...Object.keys(overlay)];
  const seen = new Set();
  let dup = false;
  for (const k of bagKeys) { if (seen.has(k)) dup = true; seen.add(k); }
  if (dup) dupBad++;
  // every own field of the gameplan lands in exactly one bag
  for (const k of Object.keys(gp)) if (!seen.has(k)) { coverBad++; if (coverBad <= 3) bad.push(`${s.name}: field '${k}' dropped by the partition`); break; }
  // book/defbook only hold their side's fields
  for (const k of Object.keys(book.plan)) if (PLAN_FIELD_SIDE[k] !== 'off') { coverBad++; break; }
  for (const k of Object.keys(defbook.plan)) if (PLAN_FIELD_SIDE[k] !== 'def') { coverBad++; break; }
  checked++;
}
ok(checked > 0, `exercised real AI plans (${checked})`);
ok(dupBad === 0, `no field is written to two bags (${dupBad} dup schools)`);
ok(coverBad === 0, `the partition covers every field with correct sidedness (${coverBad} problems)`);

console.log(`PLAN SIDE PROBE — ${pass} pass, ${fail} fail`);
if (fail) { console.log('  FAILURES:'); bad.forEach((m) => console.log('   -', m)); }
console.log(fail ? 'PLAN SIDE PROBE FAIL' : 'PLAN SIDE PROBE PASS');
process.exit(fail ? 1 : 0);
