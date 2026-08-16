// formation_compose_probe.mjs — STAGE 7 of the Playbook-Root refactor
// (the Formation Designer: one registry, a legality validator, a FIXED
// balance rulebook).
// Run: node tools/formation_compose_probe.mjs
//
// Pins:
//   F1  LEGALITY: the validator enforces the alignment rules — exactly five
//       skill players, no shared spots, backs in the backfield, 7 men on the
//       line — warns on covered (ineligible) ends, and refuses built-in names.
//   F2  THE FIXED RULEBOOK: package counted from the placements; the nearest
//       built-in ARCHETYPE supplies identity/leans VERBATIM; the legal call
//       list is a STRICT SUBSET of the archetype's book (the band guarantee —
//       a custom formation can never call what a shipped one can't);
//       structure filters hold (no Wildcat Power/Jet Sweep, options need two
//       backs, empty backfields keep only the QB runs); the layout is a
//       lawful 11 (5 OL + QB + 5 skill, unique ids, in bounds).
//   F3  THE REGISTRY: syncCustomFormations installs all four rows; matchup
//       and situational mods stay NEUTRAL (exactly 1.0 — no edges to tune);
//       personnel class derives; a re-sync is idempotent; a removed creation
//       unregisters; a built-in id can never be shadowed.
//   F4  THE SIM PLAYS IT: a full game on a plan carrying the custom formation
//       completes with real snaps recorded FROM it (sane yardage, its own
//       call sheet respected), resolveOffField fields the 11, the viewer
//       builds scripts for its snaps, and a headset call forced from it runs.
//   F5  AI-BLIND: setAIGameplan across a generated world never authors the
//       custom formation.
const _ls = new Map();
global.localStorage = {
  getItem: (k) => (_ls.has(k) ? _ls.get(k) : null),
  setItem: (k, v) => _ls.set(k, String(v)),
  removeItem: (k) => _ls.delete(k),
};

const { FORMATIONS, FORMATION_PACKAGES, FORMATION_PLAYBOOK, ROSTER_TARGETS, CLASS_YEARS, MATCHUP_MATRIX } = await import('../js/constants.js');
const { OFF_FIELD_LAYOUTS } = await import('../js/constants_field.js');
const {
  emptyCustomFormation, validateCustomFormation, formationArchetype, compileFormation,
  syncCustomFormations, registeredCustomFormations, isCustomFormation
} = await import('../js/engine/formcompose.js');
const { getMatchupEdge, getSituationalMod, offPersonnelClass } = await import('../js/engine/formations.js');
const { resolveOffField, ensureFieldAssignments } = await import('../js/engine/fieldassign.js');
const { createPlayer } = await import('../js/engine/player.js');
const { buildDepthChart, generateWorld } = await import('../js/engine/world.js');
const { simulateGame, simulateDrive } = await import('../js/engine/sim.js');
const { setAIGameplan } = await import('../js/engine/ai.js');
const { buildPlayScript } = await import('../js/ui/watchphys.js');

let pass = 0, fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}`); ok ? pass++ : fail++; };
const hdr = (s) => console.log(`\n${s}`);

const GOOD = {
  schemaVersion: 1, name: 'Bearcat Trips', qb: 'gun',
  slots: [
    { pos: 'WR', anchor: 'wideL' },
    { pos: 'SLOT', anchor: 'slotR' },
    { pos: 'TE', anchor: 'tightR' },
    { pos: 'WR', anchor: 'flankR' },
    { pos: 'RB', anchor: 'bfOffL' },
  ],
};

hdr('F1 — legality');
{
  check(validateCustomFormation(emptyCustomFormation('Test Look')).ok, 'the default formation is legal');
  check(validateCustomFormation(GOOD).ok, 'the trips design is legal');
  check(!validateCustomFormation({ ...GOOD, name: 'Spread' }).ok, 'a built-in name is refused');
  check(!validateCustomFormation({ ...GOOD, slots: GOOD.slots.slice(0, 4) }).ok, 'four skill players is refused');
  const dup = JSON.parse(JSON.stringify(GOOD)); dup.slots[1].anchor = 'wideL';
  check(!validateCustomFormation(dup).ok, 'two players on one spot is refused');
  const badBack = JSON.parse(JSON.stringify(GOOD)); badBack.slots[4].anchor = 'slotL';
  check(!validateCustomFormation(badBack).ok, 'a back outside the backfield is refused');
  const offLine = JSON.parse(JSON.stringify(GOOD)); offLine.slots[0].anchor = 'flankL'; offLine.slots[2].anchor = 'wingR';
  const vOff = validateCustomFormation(offLine);
  check(!vOff.ok && vOff.errors.some((e) => /line/.test(e)), 'fewer than 7 on the line is refused');
  const covered = JSON.parse(JSON.stringify(GOOD)); covered.slots[3] = { pos: 'WR', anchor: 'wideR' }; // outside the on-line TE
  const vCov = validateCustomFormation(covered);
  check(vCov.ok && vCov.warnings.some((w) => /COVERED/.test(w)), 'a covered end is legal but warned');
}

hdr('F2 — the fixed rulebook');
{
  const c = compileFormation(GOOD);
  check(JSON.stringify(c.pkg) === JSON.stringify({ RB: 1, FB: 0, TE: 1, WR: 3 }), `package counted from the placements (${JSON.stringify(c.pkg)})`);
  check(['Spread', 'Trips/Bunch', 'Pistol/RPO'].includes(c.archetype), `1-back 1-TE 3-WR lands in a spread family (${c.archetype})`);
  const archBook = new Set(FORMATION_PLAYBOOK[c.archetype]);
  check(c.playbook.length > 20 && c.playbook.every((nm) => archBook.has(nm)), `call list is a strict subset of the ${c.archetype} book (${c.playbook.length}/${archBook.size})`);
  check(!c.playbook.includes('Wildcat Power') && !c.playbook.includes('Jet Sweep'), 'no structure-borrowing gadgets');
  check(!c.playbook.includes('Triple Option') && !c.playbook.includes('Speed Option'), 'options need two backs');
  const arch = FORMATIONS[c.archetype];
  check(c.formationsRow.passLean === arch.passLean && c.formationsRow.runIn === arch.runIn && c.formationsRow.identity === arch.identity, 'identity/leans inherited from the archetype verbatim');
  const slots = c.layout.slots;
  check(slots.length === 11 && slots.filter((s) => s.pos === 'OL').length === 5 && slots.filter((s) => s.pos === 'QB').length === 1, '5 OL + QB + 5 skill = a lawful 11');
  check(new Set(slots.map((s) => s.id)).size === slots.length, 'slot ids unique');
  check(slots.every((s) => s.x >= 0.02 && s.x <= 0.98 && s.y >= 0.5 && s.y <= 0.95), 'every slot in bounds, nobody offsides');
  const bone = compileFormation({ ...GOOD, name: 'Triple Threat', slots: [
    { pos: 'WR', anchor: 'wideL' }, { pos: 'TE', anchor: 'tightR' },
    { pos: 'FB', anchor: 'bfSet' }, { pos: 'RB', anchor: 'bfOffL' }, { pos: 'RB', anchor: 'bfOffR' } ] });
  check(['Wishbone', 'Flexbone'].includes(bone.archetype), `a 3-back design lands in an option family (${bone.archetype})`);
  check(bone.playbook.includes('Triple Option') || bone.playbook.includes('Speed Option'), 'and options come with it');
  const empty5 = compileFormation({ ...GOOD, name: 'Five Out', slots: [
    { pos: 'WR', anchor: 'wideL' }, { pos: 'SLOT', anchor: 'slotL' }, { pos: 'SLOT', anchor: 'slotR' },
    { pos: 'TE', anchor: 'tightR' }, { pos: 'WR', anchor: 'wideR' } ] });
  check(empty5.archetype === 'Empty', `an empty backfield lands in the Empty family (${empty5.archetype})`);
  check(empty5.playbook.every((nm) => !['Inside Zone', 'Power', 'Toss', 'Outside Zone'].includes(nm)), 'no handoff runs with an empty backfield');
}

hdr('F3 — the registry');
{
  const before = Object.keys(FORMATIONS).length;
  const n = syncCustomFormations([{ name: 'Bearcat Trips', data: GOOD }]);
  check(n === 1 && isCustomFormation('Bearcat Trips'), 'sync registered the formation');
  check(!!FORMATIONS['Bearcat Trips'] && !!FORMATION_PACKAGES['Bearcat Trips'] && !!FORMATION_PLAYBOOK['Bearcat Trips'] && !!OFF_FIELD_LAYOUTS['Bearcat Trips'], 'all four registry rows installed');
  check(offPersonnelClass('Bearcat Trips') === '11', `personnel class derives (${offPersonnelClass('Bearcat Trips')})`);
  const fronts = Object.keys(MATCHUP_MATRIX[Object.keys(MATCHUP_MATRIX)[0]]);
  check(fronts.every((d) => getMatchupEdge('Bearcat Trips', d, null) === 1), 'matchup edges are NEUTRAL against every front');
  check(getSituationalMod('Bearcat Trips', 3, 1, 800, 50, null) === 1 && getSituationalMod('Bearcat Trips', 1, 10, 60, 50, null) === 1, 'situational mods are NEUTRAL');
  syncCustomFormations([{ name: 'Bearcat Trips', data: GOOD }]);
  check(Object.keys(FORMATIONS).length === before, 're-sync is idempotent (no row growth)');
  syncCustomFormations([{ name: 'Bearcat Trips', data: GOOD }, { name: 'Spread', data: { ...GOOD, name: 'Spread' } }]);
  check(FORMATIONS['Spread'].label === 'Spread' && FORMATION_PACKAGES['Spread'].WR === 3, 'a built-in can never be shadowed');
  syncCustomFormations([]);
  check(!FORMATIONS['Bearcat Trips'] && !isCustomFormation('Bearcat Trips') && registeredCustomFormations().length === 0, 'an emptied library unregisters cleanly');
  syncCustomFormations([{ name: 'Bearcat Trips', data: GOOD }]); // back on for F4
}

hdr('F4 — the sim plays it');
{
  const genRoster = (t, s) => {
    const r = [];
    for (const [pos, cnt] of Object.entries(ROSTER_TARGETS)) {
      for (let i = 0; i < cnt; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], t); p.schoolId = s; r.push(p); }
    }
    return r;
  };
  const gpC = () => ({ offFormation: 'Bearcat Trips', offFormations: [{ id: 'Bearcat Trips', weight: 100 }], tendency: 'Balanced', rushInPct: 55, passDepth: { short: 40, medium: 40, deep: 20 }, blitzPct: 25, fourthDown: 'Moderate', baseTempo: 'Normal', maxFGDist: 42 });
  const gpD = () => ({ offFormation: 'Single Back', offFormations: [{ id: 'Single Back', weight: 100 }], tendency: 'Balanced', rushInPct: 55, passDepth: { short: 40, medium: 40, deep: 20 }, blitzPct: 25, fourthDown: 'Moderate', baseTempo: 'Normal', maxFGDist: 42 });
  const rH = genRoster(1, 'H'), rA = genRoster(1, 'A');
  // field assignment path: the ensure pass must pick the custom formation up
  const fa = ensureFieldAssignments(gpC());
  check(!!fa.offense['Bearcat Trips'] && Object.keys(fa.offense['Bearcat Trips'].shares).length >= 5, 'ensureFieldAssignments carries the custom formation (share slots seeded)');
  const depthH = buildDepthChart(rH, gpC());
  const field = resolveOffField('Bearcat Trips', {}, null, depthH.active || depthH, null, null, null);
  const fielded = field ? Object.values(field.bySlot).filter(Boolean).length : 0;
  check(field && fielded === 11, `resolveOffField mans all 11 slots (${fielded})`);
  const res = simulateGame({ id: 'H', name: 'Custom U' }, { id: 'A', name: 'Base U' }, rH, rA, buildDepthChart(rH, gpC()), buildDepthChart(rA, gpD()), gpC(), gpD());
  const plays = (res.drives || []).flatMap((d) => d.plays || []);
  const mine = plays.filter((p) => p.offFormation === 'Bearcat Trips');
  const legal = new Set(FORMATION_PLAYBOOK['Bearcat Trips']);
  const offBook = mine.filter((p) => p.concept && !legal.has(p.concept) && !p.audible);
  check(mine.length > 20, `a full game ran from the custom formation (${mine.length} snaps)`);
  check(mine.every((p) => Number.isFinite(p.yards || 0)), 'every snap has numeric yardage');
  check(offBook.length === 0, `every called concept is in the derived book (${offBook.length} breaches)`);
  check(Number.isFinite(res.homeScore) && res.homeScore + res.awayScore < 150, `the game is football (${res.homeScore}-${res.awayScore})`);
  // the viewer scripts its snaps
  const snap = mine.find((p) => String(p.type).startsWith('pass') || String(p.type).startsWith('run'));
  const script = snap ? buildPlayScript(snap, OFF_FIELD_LAYOUTS['Bearcat Trips'].slots, null) : null;
  check(!!script, 'the watch board builds a script for a custom-formation snap');
  // a forced headset call from the custom formation runs
  let forcedOk = false;
  for (let i = 0; i < 6 && !forcedOk; i++) {
    const plays2 = [];
    const off = { roster: rH, depth: buildDepthChart(rH, gpC()), gameplan: gpC(), school: { id: 'H', name: 'Custom U' }, isHome: true, ctx: { fatigueMap: {}, snapCountMap: {}, benchedMap: {}, offSnaps: 0, defSnaps: 0, jobSnapMap: {} }, form: 1 };
    const def = { roster: rA, depth: buildDepthChart(rA, gpD()), gameplan: gpD(), school: { id: 'A', name: 'Base U' }, isHome: false, ctx: { fatigueMap: {}, snapCountMap: {}, benchedMap: {}, offSnaps: 0, defSnaps: 0, jobSnapMap: {} }, form: 1 };
    simulateDrive(off, def, { fieldPos: 35, clock: 1500, half: 1, score: { off: 0, def: 0 } }, [], {
      askCall: () => 'ASK',
      resume: { call: { concept: 'Mesh', formationId: 'Bearcat Trips' }, fieldPos: 35, down: 1, distance: 10, plays: plays2, audiblesUsed: 0, fourthDecided: false, decision: null, pen: { offCount: 0, offYds: 0, defCount: 0, defYds: 0 } },
    });
    const real = plays2.find((p) => p.concept === 'Mesh');
    if (real && real.offFormation === 'Bearcat Trips' && real.coachCall) forcedOk = true;
  }
  check(forcedOk, 'a headset call forced from the custom formation runs as called');
}

hdr('F5 — the AI stays blind');
{
  const world = generateWorld();
  let leaked = 0;
  for (const s of world.schools) {
    setAIGameplan(s);
    if ((s.gameplan.offFormations || []).some((f) => f.id === 'Bearcat Trips')) leaked++;
  }
  check(leaked === 0, `no AI staff authored the custom formation (${leaked} leaks across ${world.schools.length} schools)`);
  syncCustomFormations([]); // leave the tables pristine
  check(!FORMATIONS['Bearcat Trips'], 'probe cleanup: tables pristine');
}

console.log(`\nFORMATION COMPOSE PROBE — ${pass} pass, ${fail} fail`);
console.log(fail ? 'FORMATION COMPOSE PROBE FAIL' : 'FORMATION COMPOSE PROBE PASS');
process.exit(fail ? 1 : 0);
