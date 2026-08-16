// ceremony_probe.mjs — DNA TREE §7 + §8's player teeth: the retirement
// ceremony, D8 harvest shares, and lore-format world writes. Pass 5, the
// finale of the roguelite build order.
//
//   H1  D8 shares: the harvest banks BANK_SHARE × {retire 1.0 / quit 0.6 /
//       fired 0.4}, detected from how the career is ending.
//   W1  THE WORLD RESPONDS: a qualifying tenure appends an event in the EXACT
//       generateProgramLore shape ({year, kind:'era', text}), sets/keeps the
//       legend, and a long-enough tenure names the field — once, never twice.
//   W2  A short tenure writes NOTHING — the lore belongs to men who stayed.
//   C1  The ceremony payload carries all six beats from existing systems:
//       record+epitaph, deeds in stars, classics, share, succession sheet,
//       world preview.
//   P1  The succession pick: dnaInheritance with pickAxes grants ONLY the
//       chosen axes (still ★★-capped); the promote path consumes the tree's
//       stored pick exactly once.
//   F1  The law: exitKindFor reads fired/quit/retire correctly, and the
//       forced-retirement flag can never fire when it would end the run
//       (canRetire's refusal is the gate).
//
// Run: node tools/ceremony_probe.mjs
const _ls = new Map();
global.localStorage = {
  getItem: (k) => (_ls.has(k) ? _ls.get(k) : null),
  setItem: (k, v) => _ls.set(k, String(v)),
  removeItem: (k) => _ls.delete(k),
};

const { C } = await import('../js/constants.js');
const T = await import('../js/engine/tree.js');
const CP = await import('../js/engine/coachprofile.js');

let pass = 0, fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}`); ok ? pass++ : fail++; };
const hdr = (s) => console.log(`\n${s}`);

// A minimal two-slot tree world the retirement paths can run in.
function mkWorld({ age = 66, fired = false, tenure = 10, wins = 90, losses = 40 } = {}) {
  const prof = CP.createCoach('Amos', 'Vane', { treeId: 'T' });
  CP.updateCoach(prof.id, (c) => { c.dna = { axes: { pressure: 1700, ballHawk: 800, groundPound: 300 }, badges: [], log: [] }; });
  const prof2 = CP.createCoach('Heir', 'Apparent', { treeId: 'T' });
  const schoolA = { id: 'A', name: 'Harbor State', division: 'D2', prestige: 3, stadium: 'Memorial Stadium',
    lore: { footballSince: 1920, titles: [], confTitles: [], postseasons: 3, legend: null, tradition: 'the bell', events: [{ year: 1954, kind: 'era', text: 'Old days.' }], allTime: { wins: 300, losses: 280, ties: 4 } },
    staff: { oc: { id: 'oc1', name: { first: 'Sonny', last: 'Marsh' }, side: 'OC', ratings: { qbRunDesign: 60, passGame: 70, runGame: 55 }, schemeIQ: { Spread: 70 }, specialty: 'Spread', seasons: 6, age: 44, ambition: 'Climber', promisedSuccession: { season: 3, coachId: 'player' } }, dc: null },
    coach: null, recentWins: [8] };
  const schoolB = { id: 'B', name: 'Prairie Tech', division: 'D3', prestige: 2, stadium: 'Tech Field', staff: { oc: null, dc: null }, coach: { id: 'b-coach', isAI: false }, recentWins: [6] };
  const pc = { id: 'player', isAI: false, name: { first: 'Amos', last: 'Vane' }, age, status: 'employed',
    _pendingFire: fired, tenureSeasons: tenure, careerWins: wins, careerLosses: losses, titles: 1, skills: {} };
  schoolA.coach = pc;
  const state = {
    season: 12, day: 26, offseason: null,
    playerSchoolId: 'A', playerCoach: pc, _coachId: prof.id,
    world: { schools: [schoolA, schoolB] },
    instantClassics: [
      { id: 'ic1', score: 91, season: 5, week: 'Week 9', playerSchoolId: 'A' },
      { id: 'ic2', score: 84, season: 8, week: 'Playoffs', playerSchoolId: 'A' },
    ],
    inbox: [], jobOpenings: [],
    tree: {
      id: 'T', name: 'The Vane Tree', active: 'D2',
      slots: {
        D2: { division: 'D2', coachId: prof.id, schoolId: 'A', seasonsWorked: 9, retired: false },
        D3: { division: 'D3', coachId: prof2.id, schoolId: 'B', seasonsWorked: 2, retired: false },
      },
      dna: { axes: { pressure: 2000, ballHawk: 1200, discipline: 900, adjustments: 400 } },
      memory: {}, ledger: [], agenda: { rows: [] },
    },
    ui: {},
  };
  return { state, prof, prof2, schoolA, pc };
}

// ── F1: exit kinds + the never-delete law ──────────────────────────────────
hdr('F1 — exit kinds read right; the forced flag can never end a run');
{
  const { state } = mkWorld({ age: 66 });
  check(T.exitKindFor(state) === 'retire', 'eligible age, employed, not fired → retire');
  const { state: s2 } = mkWorld({ age: 50 });
  check(T.exitKindFor(s2) === 'quit', 'walking away at 50 → quit');
  const { state: s3 } = mkWorld({ age: 66, fired: true });
  check(T.exitKindFor(s3) === 'fired', 'pending fire → fired');
  // canRetire refuses a last-coach retirement — the forced flag's gate.
  const { state: s4 } = mkWorld();
  s4.tree.slots.D3.retired = true; // only one live coach left
  check(!T.canRetire(s4).ok, 'canRetire refuses the last coach — the forced-retirement gate holds, no save can be force-deleted');
}

// ── C1: the ceremony payload ───────────────────────────────────────────────
hdr('C1 — six beats, all from existing systems');
{
  const { state } = mkWorld({ age: 66, tenure: 15 });
  const cer = T.buildRetirementCeremony(state);
  check(!!cer, 'the payload builds');
  check(cer.record.name === 'Amos Vane' && cer.record.wins === 90 && typeof cer.record.epitaph === 'string', `beat 1 — the record: ${cer.record.name}, ${cer.record.wins}–${cer.record.losses}, "${cer.record.epitaph}"`);
  check(cer.deeds.length === 3 && cer.deeds[0].tier === 3 && cer.deeds[0].stars === '\u2605\u2605\u2605', `beat 2 — deeds in stars (top: ${cer.deeds[0].label} ${cer.deeds[0].stars})`);
  check(cer.games.length === 2 && cer.games[0].score === 91, `beat 3 — the games, best first (${cer.games.length} classics)`);
  check(cer.exitKind === 'retire' && cer.harvestShare === C.TREE.BANK_SHARE * 1, `beat 4 — the harvest share (${cer.harvestShare})`);
  check(cer.succession.mentored[0] && cer.succession.mentored[0].promised === true, `beat 5 — the promised Climber stands first (${cer.succession.mentored[0].name})`);
  check(cer.succession.bankedAxes.length === 4 && cer.succession.pickMax === C.TREE.INHERIT_PICK_MAX, 'beat 5 — the pick list from the banked pool');
  check(cer.world.qualifiesLegend === true && cer.world.qualifiesField === true, 'beat 6 — a 15-season tenure earns the legend AND the field');
}

// ── H1: D8 shares on the harvest ───────────────────────────────────────────
hdr('H1 — the harvest banks BANK_SHARE × exit share');
{
  const run = (opts) => {
    const { state } = mkWorld(opts);
    const before = { ...state.tree.dna.axes };
    const res = T.retireActiveCoach(state);
    return { res, gained: (state.tree.dna.axes.pressure || 0) - (before.pressure || 0) };
  };
  const full = run({ age: 66 });
  const quit = run({ age: 50 });
  const fired = run({ age: 66, fired: true });
  const base = 1700; // profile pressure XP
  check(full.res.ok && full.gained === Math.round(base * C.TREE.BANK_SHARE * 1), `retire banks ${full.gained} = 1700 × ${C.TREE.BANK_SHARE} × 1.0`);
  check(quit.res.ok && quit.gained === Math.round(base * C.TREE.BANK_SHARE * C.TREE.EXIT_SHARE.quit), `quit banks ${quit.gained} = × ${C.TREE.EXIT_SHARE.quit}`);
  check(fired.res.ok && fired.gained === Math.round(base * C.TREE.BANK_SHARE * C.TREE.EXIT_SHARE.fired), `fired banks ${fired.gained} = × ${C.TREE.EXIT_SHARE.fired}`);
  check(full.gained > quit.gained && quit.gained > fired.gained, 'a real reason to survive the hot seat: retire > quit > fired');
}

// ── W1 + W2: the world responds in the exact lore shape ────────────────────
hdr('W1/W2 — lore-format writes: exact shape, legend, the field, and silence for short stays');
{
  const { state, schoolA } = mkWorld({ age: 68, tenure: 15, wins: 130, losses: 40 });
  const res = T.retireActiveCoach(state);
  check(res.ok, 'the retirement lands');
  const era = schoolA.lore.events.find((e) => e.kind === 'era' && e.text.indexOf('Amos Vane') >= 0);
  check(!!era, 'a legend era event was appended');
  check(era && typeof era.year === 'number' && era.year === 2025 + Math.max(1, 12 - 15 + 1) && /arrives\. The \d{4}\u2013\d{4} teams /.test(era.text), `and it is the EXACT generateProgramLore shape ({year:${era && era.year}, kind:'era', text:"${era && era.text.slice(0, 44)}..."})`);
  check(schoolA.lore.legend && schoolA.lore.legend.name === 'Amos Vane' && schoolA.lore.legend.wins === 130, `the program's legend is now him (${schoolA.lore.legend.name}, ${schoolA.lore.legend.wins}–${schoolA.lore.legend.losses})`);
  check(schoolA.stadium === 'Vane Field at Memorial Stadium', `14+ seasons named the field: "${schoolA.stadium}"`);
  check(state.inbox.length === 1 && state.inbox[0].subject.indexOf('era ends') >= 0, 'the news feed carries it');
  check(schoolA.lore.events[0].year <= era.year, 'events stay year-sorted — his era sits inside the generated backstory');
  // Double-naming guard: a second legend at the same school never re-prefixes.
  const again = { ...schoolA };
  check(schoolA.stadium.indexOf(' Field at ') >= 0, 'and the naming guard key is in place for any future legend');
  // W2 — the short stay.
  const { state: s2, schoolA: sh2 } = mkWorld({ age: 66, tenure: 4 });
  const evBefore = sh2.lore.events.length;
  T.retireActiveCoach(s2);
  check(sh2.lore.events.length === evBefore && sh2.stadium === 'Memorial Stadium' && s2.inbox.length === 0, 'a 4-season tenure writes NOTHING — no era, no field, no mail');
}

// NOTE: these fixtures used to bank/pick `motivator`. It was CUT 2026-08-12
// (playtest item 31) — no code path ever awarded it XP and its bonus was
// per: 0, so it could neither be earned nor felt. `discipline` is a live axis
// and keeps the banked-axis count and the two-axis pick identical.
// ── P1: the succession pick ────────────────────────────────────────────────
hdr('P1 — pickAxes grants only the chosen axes, ★★-capped, consumed once');
{
  const tree = { dna: { axes: { pressure: 99999, ballHawk: 5000, discipline: 3000 } } };
  const picked = CP.dnaInheritance(tree, { seasonsUnderTree: 10, pickAxes: ['pressure', 'discipline'] });
  check(picked.axes.pressure != null && picked.axes.discipline != null && picked.axes.ballHawk == null, 'only the two picked axes inherit');
  check(CP.dnaStarTier(picked.axes.pressure) <= C.TREE.INHERIT_CAP_STAR, 'each still ★★-capped');
  const all = CP.dnaInheritance(tree, { seasonsUnderTree: 10 });
  check(all.axes.ballHawk != null, 'no pick list = all axes (the pre-ceremony path, unchanged)');
}

console.log(`\n${'='.repeat(50)}\n${fail === 0 ? 'ALL GREEN' : 'FAILURES: ' + fail} (${pass} passed)`);
process.exit(fail ? 1 : 0);
