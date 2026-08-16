// conference_prestige_probe — conference prestige distributes school prestige.
// The Division Editor sets a conference's PRESTIGE TIER; at compile the member
// schools' prestige distributes around that tier (blue-blood conf -> strong
// schools, weak conf -> strugglers), within the division band — generalized to
// ALL divisions so D2/D3 get the hierarchy they currently lack. Proves: a high
// tier yields a higher average than a low tier; distribution stays in-band;
// explicit team prestige still wins; a bad tier is rejected; and the default
// procedural world is untouched (it doesn't use compileLeague).
import { compileLeague, generateWorld, SCHOOL_DATA } from '../js/engine/world.js';
import { C } from '../js/constants.js';

let pass = 0, fail = 0;
const bad = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; bad.push(msg); } }

function tieredDivision(division, tiers, perConf = 20) {
  // tiers: [{ id, prestige }]; teams carry NO explicit prestige
  const conferences = [], teams = [];
  let t = 0;
  for (const c of tiers) {
    conferences.push({ id: c.id, name: `${c.id} Conf`, short: c.id.slice(0, 3), division, prestige: c.prestige });
    for (let i = 0; i < perConf; i++) teams.push({ id: `${c.id}${t++}`, name: `${c.id} Team ${i}`, division, conf: c.id });
  }
  return compileLeague({ mode: 'replace', conferences, teams });
}
function avgPrestige(schools, confId) {
  const g = schools.filter((s) => s.conf === confId);
  return g.reduce((a, s) => a + s.prestige, 0) / g.length;
}

// ── D1: tier 6 conference vs tier 2 conference ──────────────────────────────
{
  const c = tieredDivision('D1', [{ id: 'BLUE', prestige: 6 }, { id: 'WEAK', prestige: 2 }]);
  const blue = avgPrestige(c.schools, 'BLUE'), weak = avgPrestige(c.schools, 'WEAK');
  ok(blue > weak + 1.5, `D1: tier-6 conf averages well above tier-2 (${blue.toFixed(2)} vs ${weak.toFixed(2)})`);
  ok(c.schools.every((s) => s.prestige >= 1 && s.prestige <= 6), 'D1: every distributed prestige is in the division band');
  ok(blue > 4.5, `D1: a blue-blood conference is genuinely elite (${blue.toFixed(2)})`);
}

// ── D2/D3: the hierarchy they currently lack ────────────────────────────────
{
  const d2 = tieredDivision('D2', [{ id: 'D2TOP', prestige: 4 }, { id: 'D2LOW', prestige: 1 }]);
  const top = avgPrestige(d2.schools, 'D2TOP'), low = avgPrestige(d2.schools, 'D2LOW');
  ok(top > low + 1, `D2: tier-4 conf outranks tier-1 (${top.toFixed(2)} vs ${low.toFixed(2)})`);
  ok(d2.schools.every((s) => s.prestige >= 1 && s.prestige <= (C.PRESTIGE_MAX.D2 || 4)), 'D2: distribution respects the D2 cap');

  const d3 = tieredDivision('D3', [{ id: 'D3TOP', prestige: 3 }, { id: 'D3LOW', prestige: 1 }]);
  ok(avgPrestige(d3.schools, 'D3TOP') > avgPrestige(d3.schools, 'D3LOW'), 'D3: tier-3 conf outranks tier-1');
  ok(d3.schools.every((s) => s.prestige <= (C.PRESTIGE_MAX.D3 || 3)), 'D3: distribution respects the D3 cap');
}

// ── explicit team prestige still wins over the tier ─────────────────────────
{
  const compiled = compileLeague({ mode: 'replace',
    conferences: [{ id: 'X', name: 'X', short: 'X', division: 'D1', prestige: 6 }],
    teams: [
      { id: 'a', name: 'A', division: 'D1', conf: 'X', prestige: 2 }, // explicit low in a high-tier conf
      { id: 'b', name: 'B', division: 'D1', conf: 'X' },
      { id: 'c', name: 'C', division: 'D1', conf: 'X' }
    ]
  });
  ok(compiled.schools.find((s) => s.id === 'a').prestige === 2, 'explicit team prestige overrides the conference tier');
}

// ── a tier no team overrides still builds a coherent world ──────────────────
{
  const c = tieredDivision('D1', [{ id: 'P1', prestige: 6 }, { id: 'P2', prestige: 4 }, { id: 'P3', prestige: 2 }], 12);
  const w = generateWorld({ schools: c.schools, conferences: c.conferences });
  ok(w.schools.every((s) => s.roster.length > 0), 'tiered division builds full rosters through generateWorld');
  ok(w.conferences.P1.prestige === 6, 'conference tier is preserved on the built world for the editor to read');
}

// ── validation + inert default ──────────────────────────────────────────────
ok((() => { try { compileLeague({ mode: 'replace', conferences: [{ id: 'B', division: 'D2', prestige: 6 }], teams: [{ id: 't', name: 'T', division: 'D2', conf: 'B' }] }); return false; } catch (e) { return String(e.message).includes('tier'); } })(), 'conference tier out of the division band is rejected');
ok(SCHOOL_DATA.every((s) => s.prestige != null), 'default procedural schools still carry their own prestige (compileLeague path untouched)');

console.log(`CONFERENCE PRESTIGE PROBE — ${pass} pass, ${fail} fail`);
if (fail) { console.log('  FAILURES:'); bad.forEach((m) => console.log('   -', m)); }
console.log(fail ? 'CONFERENCE PRESTIGE PROBE FAIL' : 'CONFERENCE PRESTIGE PROBE PASS');
process.exit(fail ? 1 : 0);
