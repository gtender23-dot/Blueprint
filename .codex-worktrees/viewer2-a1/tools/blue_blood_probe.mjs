// blue_blood_probe — the D1 blue-blood toggle (Season Mode / Division Editor).
// Proves: (1) INERT BY DEFAULT — no procedurally-generated school carries the
// flag, so the standing world/balance is untouched (the full prestige-trajectory
// check stays green separately); (2) a flagged blue blood FLOORS near the top of
// its band while an identical un-flagged school sinks; (3) it DECLINES SLOWER;
// (4) it STILL MOVES — a winning blue blood can climb above the floor toward the
// cap. Drives updatePrestige directly with minimal schools.
import { updatePrestige } from '../js/engine/season.js';
import { generateWorld } from '../js/engine/world.js';
import { C } from '../js/constants.js';

let pass = 0, fail = 0;
const bad = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; bad.push(msg); } }

const GP = C.CONF_GAMES + C.NONCONF_GAMES;
const winWindow = (perGameWins) => C.PRESTIGE_WINDOW_WEIGHTS.map(() => perGameWins);
function school(over) {
  return Object.assign({ id: 'x', division: 'D1', prestige: 5, baseline: 5, prestigeMin: 1, prestigeMax: 6, recentWins: winWindow(3), record: {}, blueBlood: false }, over);
}
function runSeasons(sch, n) {
  const state = { world: { schools: [sch] } };
  for (let i = 0; i < n; i++) updatePrestige(state);
  return sch.prestige;
}

// ── 1. INERT — nothing procedural is flagged ────────────────────────────────
const w = generateWorld();
ok(w.schools.every((s) => !s.blueBlood), 'no procedurally-generated school is a blue blood (inert by default)');

// ── 2. FLOOR — bad results, blue blood holds ~top of band, plain sinks ──────
const floorExpected = 6 - C.BLUE_BLOOD_FLOOR_DROP; // 5
const bbLow = runSeasons(school({ blueBlood: true, recentWins: winWindow(2) }), 15);
const plainLow = runSeasons(school({ blueBlood: false, recentWins: winWindow(2) }), 15);
ok(bbLow >= floorExpected - 0.05, `blue blood floored near top of band after 15 bad seasons (${bbLow.toFixed(2)} ≥ ~${floorExpected})`);
ok(plainLow < floorExpected - 0.5, `an identical NON-blue-blood sank well below the floor (${plainLow.toFixed(2)})`);
ok(bbLow > plainLow + 0.5, 'blue blood ends far above the identical plain program');

// ── 3. SLOWER DECLINE — one season, same start + bad results ────────────────
const startP = 5.6;
const bb1 = school({ blueBlood: true, prestige: startP, baseline: startP, recentWins: winWindow(2) });
const pl1 = school({ blueBlood: false, prestige: startP, baseline: startP, recentWins: winWindow(2) });
runSeasons(bb1, 1); runSeasons(pl1, 1);
const bbDrop = startP - bb1.prestige, plDrop = startP - pl1.prestige;
ok(bbDrop >= 0 && plDrop > 0 && bbDrop < plDrop, `blue blood declined slower in one season (blue −${bbDrop.toFixed(3)} vs plain −${plDrop.toFixed(3)})`);

// ── 4. STILL MOVES — a winning blue blood climbs above the floor ────────────
const bbWin = runSeasons(school({ blueBlood: true, prestige: 5, baseline: 5, recentWins: winWindow(GP - 1) }), 8);
ok(bbWin > floorExpected + 0.2, `a winning blue blood still climbs above the floor toward the cap (${bbWin.toFixed(2)})`);
ok(bbWin <= 6.0001, 'blue blood still respects the division cap');

console.log(`BLUE BLOOD PROBE — ${pass} pass, ${fail} fail`);
if (fail) { console.log('  FAILURES:'); bad.forEach((m) => console.log('   -', m)); }
console.log(fail ? 'BLUE BLOOD PROBE FAIL' : 'BLUE BLOOD PROBE PASS');
process.exit(fail ? 1 : 0);
