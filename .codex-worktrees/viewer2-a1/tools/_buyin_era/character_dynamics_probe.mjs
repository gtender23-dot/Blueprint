// character_dynamics_probe.mjs — W2 (Buy-In §13 dynamic / §11 malleability /
// §16.1 / §10) dynamics probe. Verifies that facets MOVE, and move SANELY:
//   D1  Malleability gates every facet move (FR ≈ 5× SR on the same event)
//   D2  The WE mirror survives dynamics (attributes.WE === round(grind), always)
//   D3  Benching responses split by character: the Gym Rat works, the Diva
//       breaks (ego can flare), everyone bleeds personal Buy-In
//   D4  Program meter: honeymoon multiplies early proof; gains flatten with
//       tenure; §10.4 settlement bleeds underperformance harder than it
//       builds overperformance; a coaching change resets to the baseline
//   D5  Per-player Buy-In derives in range (coachability-heavy, ego-docked)
//       and drifts toward character × program
//   D6  4-year careers move facets sanely: a winning, well-led room lifts a
//       young cohort a real-but-bounded amount; seniors barely move; nobody
//       runs away past the clamps
//   D7  Staff (§14.2): coordinators generate with character + scheme
//       identity; identity matches the ratings lean; legacy staff migrate
//       idempotently via ensureStaffProfile
// Run: node tools/character_dynamics_probe.mjs
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
Math.random = mulberry32(0xB0071E52);

const { createPlayer } = await import('../js/engine/player.js');
const {
  malleability, nudgeFacet, deriveBuyIn, ensureBuyIn, driftPlayerBuyIn,
  ensureProgramBuyIn, programBuyIn, bumpProgramBuyIn, settleProgramBuyIn,
  onGameResultBuyIn, applyBenchingEvent, applyProbationEvent,
  runCharacterDynamics,
} = await import('../js/engine/development.js');
const { generateCoordinator, deriveSchemeIdentity, ensureStaffProfile, growStaffSchemeIQ } = await import('../js/engine/staff.js');
const { C, ROSTER_TARGETS, STARTER_COUNTS } = await import('../js/constants.js');

let fails = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fails++;
};
const mean = xs => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);

// ── School scaffolding (engine-shape, no worldgen dependency) ─────────────
function makeRoster(tier = 2) {
  const roster = [];
  const years = ['FR', 'SO', 'JR', 'SR'];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) roster.push(createPlayer(pos, years[i % 4], tier, 0));
  }
  return roster;
}
function chartFor(roster) {
  const dc = {};
  for (const p of roster) (dc[p.position] = dc[p.position] || []).push(p);
  for (const pos of Object.keys(dc)) {
    dc[pos].sort((a, b) => b.compositeRating - a.compositeRating);
    dc[pos] = dc[pos].map(p => p.id);
  }
  return dc;
}
function makeSchool({ tier = 2, wins = 6, coachId = 'hc_1', tenure = 0 } = {}) {
  const roster = makeRoster(tier);
  return {
    id: 'probe_school', prestige: 3,
    coach: { id: coachId, tenureSeasons: tenure },
    roster, depthChart: chartFor(roster),
    recentWins: [wins], record: { wins, losses: (C.CONF_GAMES + C.NONCONF_GAMES) - wins },
  };
}

// ── D1: malleability gates ────────────────────────────────────────────────
{
  const fr = createPlayer('WR', 'FR', 2, 0), sr = createPlayer('WR', 'SR', 2, 0);
  fr.character.grind = 50; sr.character.grind = 50;
  const dFr = nudgeFacet(fr, 'grind', 10), dSr = nudgeFacet(sr, 'grind', 10);
  check('D1 malleability: FR moves, SR is who he is',
    Math.abs(dFr - 10 * C.MALLEABILITY.FR) < 1e-9 && Math.abs(dSr - 10 * C.MALLEABILITY.SR) < 1e-9,
    `FR +${dFr.toFixed(1)} vs SR +${dSr.toFixed(1)} on the same event`);
  check('D1 malleability curve is monotonic FR≥SO≥JR≥SR',
    C.MALLEABILITY.FR >= C.MALLEABILITY.SO && C.MALLEABILITY.SO >= C.MALLEABILITY.JR && C.MALLEABILITY.JR >= C.MALLEABILITY.SR);
  const clampTest = createPlayer('RB', 'FR', 2, 0);
  clampTest.character.grind = 98;
  nudgeFacet(clampTest, 'grind', 50);
  check('D1 clamps hold (1..99)', clampTest.character.grind <= 99 && clampTest.character.grind >= 1);
  const egoTry = createPlayer('QB', 'FR', 2, 0);
  const egoBefore = egoTry.character.ego;
  check('D1 ego is a flag, not a rating — nudge refuses it',
    nudgeFacet(egoTry, 'ego', 10) === 0 && egoTry.character.ego === egoBefore);
}

// ── D2: the WE mirror survives dynamics ───────────────────────────────────
{
  const ps = Array.from({ length: 300 }, (_, i) => createPlayer('LB', ['FR','SO','JR','SR'][i % 4], 2, 0));
  for (const p of ps) for (let k = 0; k < 12; k++) nudgeFacet(p, 'grind', (Math.random() - 0.5) * 6);
  check('D2 attributes.WE === round(grind) after 12 random nudges each',
    ps.every(p => p.attributes.WE === Math.round(Math.max(1, Math.min(99, p.character.grind)))));
}

// ── D3: benching responses split by character ─────────────────────────────
{
  const gym = createPlayer('CB', 'SO', 2, 0);
  gym.character = { ...gym.character, grind: 80, coachability: 60, ego: false };
  const g0 = gym.character.grind, gb0 = ensureBuyIn(gym);
  check('D3 gym rat benched → back to work', applyBenchingEvent(gym) === 'motivated' && gym.character.grind > g0,
    `grind ${g0.toFixed(1)}→${gym.character.grind.toFixed(1)}, buy-in ${gb0}→${gym.buyIn.toFixed(1)}`);

  const diva = createPlayer('WR', 'SO', 2, 0);
  diva.character = { ...diva.character, grind: 55, coachability: 55, ego: true };
  const d0 = diva.character.grind, dc0 = diva.character.coachability, db0 = ensureBuyIn(diva);
  check('D3 diva benched → breaks', applyBenchingEvent(diva) === 'broken'
    && diva.character.grind < d0 && diva.character.coachability < dc0 && diva.buyIn < db0,
    `grind ${d0}→${diva.character.grind.toFixed(1)}, coach ${dc0}→${diva.character.coachability.toFixed(1)}, buy-in ${db0}→${diva.buyIn.toFixed(1)}`);

  let flares = 0;
  for (let i = 0; i < 400; i++) {
    const p = createPlayer('RB', 'FR', 2, 0);
    p.character = { ...p.character, grind: 30, ego: false };
    applyBenchingEvent(p);
    if (p.character.ego) flares++;
  }
  const flareRate = flares / 400;
  check('D3 a bad benching can flare Ego (near designed rate)',
    Math.abs(flareRate - C.CHAR_DYN.benchEgoFlareRate) < 0.07, `${(flareRate * 100).toFixed(1)}%`);

  // The stubs exist and behave (nothing calls them until W7/W8 — but they ship working).
  const prob = createPlayer('TE', 'FR', 2, 0);
  prob.character = { ...prob.character, coachability: 70, ego: false };
  const pg0 = prob.character.grind;
  check('D3 probation stub: coachable kid is humbled', applyProbationEvent(prob) === 'humbled' && prob.character.grind > pg0);
  // [Aug 2026] The broken-ROLE-promise assertion was removed with the recruit
  // promise system — applyPromiseEvent no longer exists. Benching and academic
  // probation remain the two events that move a man's Buy-In and character.
}

// ── D4: program meter — honeymoon, flattening, settlement, reset ─────────
{
  const s = makeSchool({ coachId: 'new_hire', tenure: 0 });
  const init = programBuyIn(s);
  check('D4 new coach opens at the floor-not-cliff baseline', init === C.BUYIN.start, `${init}`);

  const early = bumpProgramBuyIn(s, 1) - init;                       // seasons 0: honeymoon
  s.buyIn.seasons = C.BUYIN.honeymoonSeasons + 7;                    // veteran tenure
  const before = s.buyIn.value;
  const late = bumpProgramBuyIn(s, 1) - before;
  check('D4 honeymoon: early proof lands big, tenure flattens the curve', early > late * 1.8 && late > 0,
    `same +1 win: +${early.toFixed(2)} in year 1 vs +${late.toFixed(2)} in year ${C.BUYIN.honeymoonSeasons + 8}`);

  const over = makeSchool({ coachId: 'hc_o', tenure: 10 });
  over.buyIn = { value: 60, coachId: 'hc_o', seasons: 10 };
  const under = makeSchool({ coachId: 'hc_u', tenure: 10 });
  under.buyIn = { value: 60, coachId: 'hc_u', seasons: 10 };
  settleProgramBuyIn(over, +2);
  settleProgramBuyIn(under, -2);
  const gain = over.buyIn.value - 60, bleed = 60 - under.buyIn.value;
  check('D4 §10.4 expectations scale the damage: −2 bleeds harder than +2 builds',
    bleed > gain && gain > 0, `+2 → +${gain.toFixed(1)}; −2 → −${bleed.toFixed(1)}`);

  // Upset proof: beating a clearly better program counts extra.
  const wA = makeSchool({ coachId: 'a' }); wA.prestige = 2;
  const wB = makeSchool({ coachId: 'b' }); wB.prestige = 2;
  onGameResultBuyIn(wA, { prestige: 5 });   // upset
  onGameResultBuyIn(wB, { prestige: 2 });   // ordinary win
  check('D4 the upset is REAL proof', wA.buyIn.value > wB.buyIn.value,
    `upset meter ${wA.buyIn.value.toFixed(1)} vs ordinary ${wB.buyIn.value.toFixed(1)}`);

  // The arc is SLOW (§10 balance note: earned, cyclical, a dynasty arc —
  // not a season exploit): a dominant new coach doesn't rail-slam the meter
  // in his honeymoon; a decade of dominance earns the elite room.
  const arc = makeSchool({ coachId: 'dyn', tenure: 0 });
  const readings = [];
  for (let yr = 1; yr <= 10; yr++) {
    for (let w = 0; w < 10; w++) onGameResultBuyIn(arc, { prestige: 3 });
    settleProgramBuyIn(arc, +3);
    readings.push(arc.buyIn.value);
  }
  check('D4 the arc is slow: 3 dominant years leave real headroom, 10 earn the room',
    readings[2] < 85 && readings[9] > 70 && readings[9] < 99,
    `yearly meter: ${readings.map(v => v.toFixed(0)).join(' → ')}`);

  // Coaching change: the stamp resets the meter — trust doesn't transfer.
  const s2 = makeSchool({ coachId: 'old_guy', tenure: 12 });
  s2.buyIn = { value: 88, coachId: 'old_guy', seasons: 12 };
  s2.coach = { id: 'the_new_man', tenureSeasons: 0 };
  check('D4 a coaching change resets the room', programBuyIn(s2) === C.BUYIN.start,
    `88 under the old man → ${programBuyIn(s2)} under the new one`);
}

// ── D5: per-player Buy-In derivation + drift ──────────────────────────────
{
  const pool = Array.from({ length: 600 }, (_, i) => createPlayer('S', ['FR','SO','JR','SR'][i % 4], 2, 0));
  check('D5 derivation in range on every player', pool.every(p => { const b = deriveBuyIn(p); return b >= 1 && b <= 99; }));
  const twin = createPlayer('WR', 'SO', 2, 0);
  twin.character = { grind: 60, coachability: 60, leadership: 50, ego: false };
  const egoTwin = { ...twin, character: { ...twin.character, ego: true }, attributes: { ...twin.attributes } };
  check('D5 ego docks trust', deriveBuyIn(egoTwin) < deriveBuyIn(twin),
    `${deriveBuyIn(egoTwin)} vs ${deriveBuyIn(twin)}`);
  const hiC = createPlayer('LB', 'SO', 2, 0), loC = createPlayer('LB', 'SO', 2, 0);
  hiC.character = { grind: 50, coachability: 85, leadership: 50, ego: false };
  loC.character = { grind: 50, coachability: 25, leadership: 50, ego: false };
  hiC.attributes.CON = loC.attributes.CON = 50;
  check('D5 coachability carries the derivation (the heavy weight)',
    deriveBuyIn(hiC) - deriveBuyIn(loC) >= 15, `Δ=${deriveBuyIn(hiC) - deriveBuyIn(loC)}`);

  const school = makeSchool({});
  school.buyIn = { value: 90, coachId: 'hc_1', seasons: 5 };
  const p = school.roster[0];
  p.buyIn = 10;
  const start = p.buyIn;
  for (let i = 0; i < 8; i++) driftPlayerBuyIn(p, school);
  const target = deriveBuyIn(p) * (1 - C.BUYIN.programPull) + 90 * C.BUYIN.programPull;
  check('D5 drift converges toward character × program', Math.abs(p.buyIn - target) < 6,
    `${start} → ${p.buyIn.toFixed(1)} (target ${target.toFixed(1)})`);
}

// ── D6: 4-year careers move sanely ────────────────────────────────────────
{
  const years = ['FR', 'SO', 'JR', 'SR'];
  const advance = (school) => {
    school.roster = school.roster.filter(p => p.classYear !== 'SR');
    for (const p of school.roster) p.classYear = years[years.indexOf(p.classYear) + 1];
    const perYear = Math.round(Object.values(ROSTER_TARGETS).reduce((a, b) => a + b, 0) / 4);
    const poses = Object.keys(ROSTER_TARGETS);
    for (let i = 0; i < perYear; i++) school.roster.push(createPlayer(poses[i % poses.length], 'FR', 2, 0));
    school.depthChart = chartFor(school.roster);
  };

  // A winning, bought-in, well-led program vs a mediocre one.
  const good = makeSchool({ coachId: 'winner', wins: 10 });
  good.buyIn = { value: 80, coachId: 'winner', seasons: 5 };
  const bad = makeSchool({ coachId: 'meh', wins: 6 });
  bad.buyIn = { value: 45, coachId: 'meh', seasons: 5 };

  const track = (school) => new Map(school.roster.filter(p => p.classYear === 'FR')
    .map(p => [p.id, p.character.grind + p.character.coachability]));
  const g0 = track(good), b0 = track(bad);
  const deltas = { good: [], bad: [] };
  for (let season = 1; season <= 4; season++) {
    for (const [name, school] of [['good', good], ['bad', bad]]) {
      school.recentWins = [name === 'good' ? 10 : 6];
      runCharacterDynamics(school, { season });
      if (season === 4) {
        const before = name === 'good' ? g0 : b0;
        for (const p of school.roster) {
          if (before.has(p.id)) deltas[name].push((p.character.grind + p.character.coachability) - before.get(p.id));
        }
      }
    }
    if (season < 4) { advance(good); advance(bad); }
  }
  const gAvg = mean(deltas.good), bAvg = mean(deltas.bad);
  check('D6 the winning culture shapes its young men more', deltas.good.length > 10 && gAvg > bAvg,
    `4-yr grind+coach Δ: winner ${gAvg >= 0 ? '+' : ''}${gAvg.toFixed(1)} vs mediocre ${bAvg >= 0 ? '+' : ''}${bAvg.toFixed(1)} (n=${deltas.good.length}/${deltas.bad.length})`);
  check('D6 a career shapes, a season nudges (bounded: avg 4-yr move < 20 pts across two facets)',
    Math.abs(gAvg) < 20 && Math.abs(bAvg) < 20);
  check('D6 nobody escapes the clamps', [...good.roster, ...bad.roster].every(p =>
    p.character.grind >= 1 && p.character.grind <= 99 &&
    p.character.coachability >= 1 && p.character.coachability <= 99 &&
    p.character.leadership >= 1 && p.character.leadership <= 99));
  check('D6 the WE mirror survives 4 full seasons of dynamics', [...good.roster, ...bad.roster].every(p =>
    p.attributes.WE === Math.round(Math.max(1, Math.min(99, p.character.grind)))));
  check('D6 everyone carries a personal Buy-In in range after the pass', [...good.roster, ...bad.roster].every(p =>
    p.buyIn != null && p.buyIn >= 1 && p.buyIn <= 99));

  // Seniors barely move: one strong season pass on a fresh school, SR vs FR.
  const s = makeSchool({ coachId: 'x', wins: 11 });
  s.buyIn = { value: 85, coachId: 'x', seasons: 4 };
  const snap = new Map(s.roster.map(p => [p.id, p.character.grind + p.character.coachability]));
  runCharacterDynamics(s, { season: 1 });
  const moveOf = (yr) => mean(s.roster.filter(p => p.classYear === yr)
    .map(p => Math.abs((p.character.grind + p.character.coachability) - snap.get(p.id))));
  check('D6 young men move, old men are who they are', moveOf('FR') > moveOf('SR'),
    `avg |Δ| FR ${moveOf('FR').toFixed(2)} vs SR ${moveOf('SR').toFixed(2)}`);
}

// ── D7: staff profiles + scheme identity (§14.2) ──────────────────────────
{
  const ocs = Array.from({ length: 300 }, () => generateCoordinator('OC', 55, 'D2'));
  const dcs = Array.from({ length: 300 }, () => generateCoordinator('DC', 55, 'D2'));
  check('D7 every coordinator generates with a character profile', [...ocs, ...dcs].every(c =>
    c.character && c.character.grind >= 1 && c.character.coachability >= 1 &&
    c.character.leadership >= 1 && typeof c.character.ego === 'boolean'));
  check('D7 every coordinator generates with a scheme identity', [...ocs, ...dcs].every(c => typeof c.identity === 'string' && c.identity.length > 0));
  const idsOk = ocs.every(c => c.identity === deriveSchemeIdentity('OC', c.ratings))
             && dcs.every(c => c.identity === deriveSchemeIdentity('DC', c.ratings));
  check('D7 identity matches the ratings lean (never contradicted by his numbers)', idsOk);
  check('D7 identity spread is real (not everyone Balanced/Multiple)',
    new Set(ocs.map(c => c.identity)).size >= 3 && new Set(dcs.map(c => c.identity)).size >= 3,
    `OC: ${[...new Set(ocs.map(c => c.identity))].join('/')} · DC: ${[...new Set(dcs.map(c => c.identity))].join('/')}`);
  check('D7 identity edges: pass lean → Air Raid, blitz lean → Attacking',
    deriveSchemeIdentity('OC', { passGame: 80, runGame: 50, qbRunDesign: 50 }) === 'Air Raid'
    && deriveSchemeIdentity('DC', { blitzDesign: 80, coverage: 50, runFits: 50 }) === 'Attacking');

  // Legacy migration: a pre-W2 coordinator (no character/identity) gains both
  // on the season-rollover path, idempotently.
  const legacy = generateCoordinator('OC', 50, 'D3');
  delete legacy.character; delete legacy.identity;
  const school = { gameplan: { offFormation: 'Single Back' }, staff: { oc: legacy, dc: null } };
  growStaffSchemeIQ(school);
  check('D7 legacy staff migrate on the rollover path', !!legacy.character && !!legacy.identity);
  const g = legacy.character.grind, id = legacy.identity;
  ensureStaffProfile(legacy);
  check('D7 migration is idempotent', legacy.character.grind === g && legacy.identity === id);
}

console.log(fails === 0 ? '\nALL CHECKS PASS' : `\n${fails} CHECK(S) FAILED`);
process.exit(fails === 0 ? 0 : 1);
