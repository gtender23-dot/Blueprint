// integration_creator_probe — the Creator "full dress rehearsal".
// Every Creator module has its own unit probe; this one chains them, because
// integration bugs hide in the SEAMS between modules, not inside them. It runs a
// creation through the entire pipeline the way a player will:
//
//   build a custom league → SAVE to the library → LOAD it back → compile it into
//   a world → build a custom playbook → SAVE/LOAD it → apply it to a team in that
//   world → PLAY games with it. Plus the play-authoring chain (custom play +
//   composed play) round-tripping through the library.
//
// The global library (creator.js) is the connective tissue, so it's exercised as
// the real transport, not bypassed. localStorage is polyfilled (UI-layer store).
globalThis.localStorage = (() => {
  let m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k), clear: () => void (m = new Map()) };
})();

const { saveCreation, loadCreationData } = await import('../js/engine/creator.js');
const { compileLeague, generateWorld, buildDepthChart } = await import('../js/engine/world.js');
const { CONFERENCES } = await import('../js/engine/world.js');
const { validatePlaybook, applyPlaybookToGameplan, legalConceptsForFormation, emptyPlaybook } = await import('../js/engine/playbook.js');
const { resolveToConcept } = await import('../js/engine/customplay.js');
const { compilePlay, BAND_LO, BAND_HI, COVERAGES } = await import('../js/engine/playcompose.js');
const { simulateGame } = await import('../js/engine/sim.js');

let pass = 0, fail = 0;
const bad = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; bad.push(msg); } }

// ── STAGE 1 — custom league → library → world ──────────────────────────────
const d1Conf = Object.entries(CONFERENCES).find(([, c]) => c.division === 'D1')[0];
const leagueBp = {
  mode: 'seed',
  teams: [
    { id: 'creator_u', name: 'Creator University', division: 'D1', conf: d1Conf, prestige: 6, nick: 'Builders', state: 'CO' },
    { id: 'sandbox_tech', name: 'Sandbox Tech', division: 'D1', conf: d1Conf, prestige: 5, state: 'OR' }
  ]
};
const lSave = saveCreation('leagues', 'Integration League', leagueBp);
ok(lSave.ok, 'league saved to library');
const lLoad = loadCreationData('leagues', lSave.id);
ok(lLoad && JSON.stringify(lLoad) === JSON.stringify(leagueBp), 'league loads back from library intact');
const compiled = compileLeague(lLoad);
const world = generateWorld({ schools: compiled.schools, conferences: compiled.conferences });
const mine = world.schools.find((s) => s.id === 'creator_u');
const foe = world.schools.find((s) => s.id === 'sandbox_tech');
ok(mine && foe, 'both custom teams present in the compiled world');
ok(mine.roster.length > 20 && foe.roster.length > 20, 'custom teams got full rosters through generateWorld');
ok(world.schools.every((s) => world.conferences[s.conf]), 'every school in the world resolves to a conference');
ok(world.schools.every((s) => s.lat != null && s.lng != null), 'every school has geo (rivalry-ready)');

// ── STAGE 2 — custom playbook → library → applied to a world team ───────────
const book = emptyPlaybook('Integration Book');
const spread = legalConceptsForFormation('Spread');
const singleBack = legalConceptsForFormation('Single Back');
book.formations = [{ id: 'Spread', weight: 55 }, { id: 'Single Back', weight: 45 }];
book.sheets = {
  'Spread': { [spread.find((c) => c === 'Mesh') || spread[0]]: 70, [spread.find((c) => c === 'Four Verts') || spread[1]]: 40, [spread.find((c) => c === 'Stick') || spread[2]]: 50 },
  'Single Back': { [singleBack.find((c) => c === 'Inside Zone') || singleBack[0]]: 70, [singleBack.find((c) => c === 'Power') || singleBack[1]]: 50 }
};
book.tendency = 'Balanced';
ok(validatePlaybook(book).ok, 'built playbook validates');
const pbSave = saveCreation('playbooks', 'Integration Book', book);
ok(pbSave.ok, 'playbook saved to library');
const pbLoad = loadCreationData('playbooks', pbSave.id);
ok(validatePlaybook(pbLoad).ok, 'playbook loads back and re-validates');
// apply the loaded book to BOTH custom teams, so every offensive snap comes from
// the carried formations (a clean gate check downstream)
const myGp = applyPlaybookToGameplan(pbLoad, mine.gameplan);
const foeGp = applyPlaybookToGameplan(pbLoad, foe.gameplan);
ok(myGp.offFormations.length === 2 && myGp.formationPlaybooks && myGp.formationPlaybooks['Spread'], 'apply set offense fields on a world team');
ok(myGp.defBaseFront === mine.gameplan.defBaseFront, 'apply preserved the team\'s existing defense');

// ── STAGE 3 — the dress rehearsal: play games with the custom setup ────────
const carried = new Set([...legalConceptsForFormation('Spread'), ...legalConceptsForFormation('Single Back')]);
let threw = false, plays = 0, illegal = 0, ptsTotal = 0, games = 0;
try {
  for (let i = 0; i < 24; i++) {
    const hDepth = buildDepthChart(mine.roster, myGp);
    const aDepth = buildDepthChart(foe.roster, foeGp);
    const res = simulateGame(mine, foe, mine.roster, foe.roster, hDepth, aDepth, myGp, foeGp);
    games++;
    ptsTotal += (res.homeScore || 0) + (res.awayScore || 0);
    for (const d of res.drives || []) for (const p of d.plays || []) {
      if (!p || !p.concept) continue;
      plays++;
      if (!carried.has(p.concept)) illegal++;
    }
  }
} catch (e) { threw = true; bad.push('sim threw: ' + e.message); }
ok(!threw, 'custom league + custom playbook drives simulateGame without error');
ok(plays > 200, `plays happened across the season sample (${plays})`);
ok(illegal === 0, `every offensive concept called was carried by the playbook (illegal: ${illegal})`);
const avgPts = ptsTotal / (games * 2);
ok(avgPts > 8 && avgPts < 55, `points per team are sane end-to-end (${avgPts.toFixed(1)})`);

// ── STAGE 4 — play authoring round-trips through the library ────────────────
const cpSave = saveCreation('plays', 'Coach Mesh', { name: 'Coach Mesh', kind: 'pass', base: 'Mesh' });
ok(cpSave.ok, 'custom play saved to library');
const cpLoad = loadCreationData('plays', cpSave.id);
const resolved = resolveToConcept(cpLoad);
const { PASS_CONCEPTS } = await import('../js/concepts.js');
ok(JSON.stringify(resolved.vs) === JSON.stringify(PASS_CONCEPTS['Mesh'].vs), 'Model-A custom play still resolves to its base grades after a library round-trip');

const composed = compilePlay({ name: 'My Shot', kind: 'pass', parts: ['go', 'post', 'flat', 'checkdown'] });
ok(COVERAGES.every((c) => composed.vs[c] >= BAND_LO - 1e-9 && composed.vs[c] <= BAND_HI + 1e-9), 'B-i composed play grades land in-band');
const comSave = saveCreation('plays', 'My Shot', { name: 'My Shot', kind: 'composed', parts: ['go', 'post', 'flat', 'checkdown'] });
ok(comSave.ok && loadCreationData('plays', comSave.id).parts.length === 4, 'composed play round-trips through the library');

console.log(`INTEGRATION CREATOR PROBE — ${pass} pass, ${fail} fail  (${games} games, ${plays} plays, ${avgPts.toFixed(1)} pts/team)`);
if (fail) { console.log('  FAILURES:'); bad.forEach((m) => console.log('   -', m)); }
console.log(fail ? 'INTEGRATION CREATOR PROBE FAIL' : 'INTEGRATION CREATOR PROBE PASS');
process.exit(fail ? 1 : 0);
