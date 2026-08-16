// ai_book_name_probe — Stage 2 of the Playbook-Root refactor.
// AI staffs now name their books from the scheme they authored. The stage's law
// is that naming is COSMETIC — the sim's stat bands must not move. This probe
// proves that structurally: the naming helpers consume zero RNG (so they cannot
// shift the roll stream), the two name fields are not sim-plan fields (they live
// in the overlay, never reaching the plan the sim resolves), and the names flow
// through synthesis onto school.book.name / school.defbook.name with sane values.
import { generateWorld } from '../js/engine/world.js';
import { setAIGameplan, aiOffenseSchemeName, aiDefenseSchemeName } from '../js/engine/ai.js';
import { synthesizeTeamPlan, PLAN_FIELD_SIDE } from '../js/engine/teamplan.js';

let pass = 0, fail = 0;
const bad = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; bad.push(msg); } }

// ── 1. the naming helpers consume ZERO Math.random ───────────────────────────
// A shifted roll stream would change every downstream number; prove naming can't.
const realRandom = Math.random;
let rngCalls = 0;
Math.random = () => { rngCalls++; return realRandom(); };
const FORMS = ['Air Raid', 'Empty', 'Spread', 'Trips/Bunch', 'Pistol/RPO', 'Flexbone', 'Wishbone', 'Power-I', 'Jumbo', 'Single Back', 'Weird'];
const BUCKETS = ['runHeavy', 'run', 'balanced', 'pass', 'passHeavy'];
const offNames = new Set(), defNames = new Set();
for (const f of FORMS) for (const b of BUCKETS) offNames.add(aiOffenseSchemeName(f, b));
for (const fr of ['4-3', '3-4', '3-3-5', null]) for (const c of ['balanced', 'lockTop', 'bracketTop']) defNames.add(aiDefenseSchemeName(fr, c));
Math.random = realRandom;
ok(rngCalls === 0, `naming helpers consumed no RNG (${rngCalls} calls)`);

// ── 2. names are non-empty and stable (pure functions) ───────────────────────
ok([...offNames].every((n) => typeof n === 'string' && n.length > 0), 'every offense name is a non-empty string');
ok([...defNames].every((n) => typeof n === 'string' && n.length > 0), 'every defense name is a non-empty string');
ok(aiOffenseSchemeName('Air Raid', 'pass') === aiOffenseSchemeName('Air Raid', 'pass'), 'offense naming is deterministic');
ok(aiDefenseSchemeName('3-3-5', 'balanced') === '3-3-5 Stack', 'the odd stack names correctly');

// ── 3. the name fields are NOT sim-plan fields (overlay-only) ─────────────────
ok(!('_playbookName' in PLAN_FIELD_SIDE), '_playbookName is not a sided sim field');
ok(!('_defbookName' in PLAN_FIELD_SIDE), '_defbookName is not a sided sim field');

// ── 4. AI gameplans carry the names; synthesis surfaces them on the books ────
const world = generateWorld();
let checked = 0, noName = 0, mismatch = 0;
for (const s of world.schools) {
  setAIGameplan(s);
  const on = s.gameplan._playbookName, dn = s.gameplan._defbookName;
  if (!on || !dn) { noName++; continue; }
  synthesizeTeamPlan(s, { force: true });
  if (s.book.name !== on || s.defbook.name !== dn) mismatch++;
  checked++;
}
ok(checked > 20, `exercised a full world of named AI books (${checked})`);
ok(noName === 0, `every AI staff named both books (${noName} unnamed)`);
ok(mismatch === 0, `synthesis put the scheme name on book/defbook (${mismatch} mismatches)`);

// ── 5. names are drawn from the football-plain vocabulary ────────────────────
const KNOWN_OFF = new Set(['Air Raid', 'Empty Spread', 'Spread', 'Spread Option', 'Spread Attack', 'Bunch Spread', 'Pistol RPO', 'Flexbone Option', 'Wishbone Option', 'Pro-Style', 'Power Run', 'Ground & Pound', 'West Coast', 'Zone Run', 'Pro Spread', 'Balanced Pro']);
const worldOff = new Set(world.schools.map((s) => s.book && s.book.name));
ok([...worldOff].every((n) => KNOWN_OFF.has(n)), `every world offense name is in the known vocabulary (${[...worldOff].filter((n) => !KNOWN_OFF.has(n)).join(', ') || 'all known'})`);

console.log(`AI BOOK NAME PROBE — ${pass} pass, ${fail} fail`);
if (fail) { console.log('  FAILURES:'); bad.forEach((m) => console.log('   -', m)); }
console.log(fail ? 'AI BOOK NAME PROBE FAIL' : 'AI BOOK NAME PROBE PASS');
process.exit(fail ? 1 : 0);
