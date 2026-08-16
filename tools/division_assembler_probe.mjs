// division_assembler_probe — the per-division world assembler.
// Proves assembleWorldSources composes a world from per-division slots, each
// 'static' (the real division) or a custom division blueprint, and that the
// output builds a coherent world through the generateWorld seam. Covers the
// Season Mode case (one slot -> single-division world), the dynasty case (all
// three), mix-and-match (custom D1 + static D2/D3), global abbr uniqueness, and
// that all-static reproduces the real division populations.
import { assembleWorldSources, generateWorld, SCHOOL_DATA, CONFERENCES } from '../js/engine/world.js';

let pass = 0, fail = 0;
const bad = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; bad.push(msg); } }

const dCount = (d) => SCHOOL_DATA.filter((s) => s.division === d).length;
const dConfs = (d) => Object.values(CONFERENCES).filter((c) => c.division === d).length;

function customD1(nConf = 2, size = 6) {
  const conferences = [], teams = [];
  let t = 0;
  for (let c = 0; c < nConf; c++) {
    conferences.push({ id: `CST${c}`, name: `Custom ${c}`, short: `C${c}`, division: 'D1', conferenceClass: c === 0 ? 'power' : 'midmajor' });
    for (let i = 0; i < size; i++) teams.push({ id: `cst${t++}`, name: `Custom Team ${t}`, division: 'D1', conf: `CST${c}`, prestige: 4, state: 'CO' });
  }
  return { conferences, teams };
}

// ── 1. Season Mode case: one static slot -> single-division world ───────────
{
  const a = assembleWorldSources({ D1: 'static' });
  ok(a.schools.length === dCount('D1') && a.schools.every((s) => s.division === 'D1'), 'single static D1 slot = exactly the real D1 division');
  ok(Object.keys(a.conferences).length === dConfs('D1'), 'single slot brings only that division\'s conferences');
  const w = generateWorld({ schools: a.schools, conferences: a.conferences });
  ok(w.schools.length === dCount('D1') && w.schools.every((s) => Array.isArray(s.roster) && s.roster.length > 0), 'single-division world builds with rosters');
  ok(w.schools.every((s) => w.conferences[s.conf]), 'every school resolves to a conference');
}

// ── 2. Dynasty case: all three static slots = the full real world ───────────
{
  const a = assembleWorldSources({ D1: 'static', D2: 'static', D3: 'static' });
  ok(a.schools.length === SCHOOL_DATA.length, `all-static assembles the full world (${a.schools.length} == ${SCHOOL_DATA.length})`);
  ok(Object.keys(a.conferences).length === Object.keys(CONFERENCES).length, 'all-static brings every conference');
  const abbrs = a.schools.map((s) => s.abbr);
  ok(new Set(abbrs).size === abbrs.length, 'assembled abbreviations are globally unique');
}

// ── 3. Mix-and-match: custom D1 + static D2 + static D3 ─────────────────────
{
  const a = assembleWorldSources({ D1: customD1(2, 6), D2: 'static', D3: 'static' });
  ok(a.schools.filter((s) => s.division === 'D1').length === 12, 'custom D1 replaced the real D1 (12 custom teams)');
  ok(a.schools.some((s) => s.id === 'cst0'), 'a specific custom D1 team is present');
  ok(a.schools.filter((s) => s.division === 'D2').length === dCount('D2'), 'D2 stayed the real division');
  ok(a.schools.filter((s) => s.division === 'D3').length === dCount('D3'), 'D3 stayed the real division');
  const allAbbr = a.schools.map((s) => s.abbr);
  ok(new Set(allAbbr).size === allAbbr.length, 'no abbr collisions across custom D1 + static D2/D3');
  const w = generateWorld({ schools: a.schools, conferences: a.conferences });
  const mine = w.schools.find((s) => s.id === 'cst0');
  ok(mine && mine.roster.length > 0 && w.conferences[mine.conf], 'mixed world builds; custom team has a roster and a conference');
}

// ── 4. Single custom division only (Season Mode with a custom division) ─────
{
  const a = assembleWorldSources({ D1: customD1(3, 8) });
  ok(a.schools.length === 24 && a.schools.every((s) => s.division === 'D1'), 'single custom-division slot = just those 24 teams');
  const w = generateWorld({ schools: a.schools, conferences: a.conferences });
  ok(w.schools.length === 24 && w.schools.every((s) => s.roster.length > 0), 'custom single-division world builds with rosters');
}

// ── 5. Bad input ────────────────────────────────────────────────────────────
ok((() => { try { assembleWorldSources(null); return false; } catch (e) { return true; } })(), 'null sources rejected');
ok((() => { try { assembleWorldSources({ D9: 'static' }); return false; } catch (e) { return true; } })(), 'no valid division slots rejected');

console.log(`DIVISION ASSEMBLER PROBE — ${pass} pass, ${fail} fail`);
if (fail) { console.log('  FAILURES:'); bad.forEach((m) => console.log('   -', m)); }
console.log(fail ? 'DIVISION ASSEMBLER PROBE FAIL' : 'DIVISION ASSEMBLER PROBE PASS');
process.exit(fail ? 1 : 0);
