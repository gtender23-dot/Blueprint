// record_call_probe.mjs — STAGE 5 of the Playbook-Root refactor
// ("the record knows the call, the broadcast shows it").
// Run: node tools/record_call_probe.mjs
//
// Pins:
//   R1  Every real scrimmage record carries the call stamps: bookName (the
//       school's book, gameplan._playbookName fallback, null-safe),
//       variation (the fielded look), customPlayId (composed calls only).
//   R2  RECORDING-ONLY LAW, pinned PRNG: with Math.random pinned to the same
//       seeded stream, a drive with a book name present and one with it
//       absent produce BYTE-IDENTICAL records except the bookName stamp
//       itself — the stamp reads state, it never moves a roll or an outcome.
//   R3  A forced look rides into the record: calling formationId+variation
//       stamps that exact variation; an unvariated call stamps null.
//   R4  A composed call's record carries its customPlayId + its name.
const _ls = new Map();
global.localStorage = {
  getItem: (k) => (_ls.has(k) ? _ls.get(k) : null),
  setItem: (k, v) => _ls.set(k, String(v)),
  removeItem: (k) => _ls.delete(k),
};

const { ROSTER_TARGETS, CLASS_YEARS } = await import('../js/constants.js');
const { createPlayer } = await import('../js/engine/player.js');
const { buildDepthChart } = await import('../js/engine/world.js');
const { simulateDrive } = await import('../js/engine/sim.js');

let pass = 0, fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}`); ok ? pass++ : fail++; };
const hdr = (s) => console.log(`\n${s}`);

function genRoster(sid) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], 1);
      p.schoolId = sid;
      r.push(p);
    }
  }
  return r;
}
const gpFor = (formation) => ({
  offFormation: formation,
  offFormations: [{ id: formation, weight: 100 }],
  tendency: 'Balanced', rushInPct: 60,
  passDepth: { short: 40, medium: 40, deep: 20 },
  blitzPct: 20, defFormation: 'Balanced D', defFront: '4-3',
  fourthDown: 'Moderate', clockMgmt: 'Normal', maxFGDist: 42,
});
const offRoster = genRoster('O'), defRoster = genRoster('D');
function runDrive(call, gpMut, school) {
  const gp = gpFor('Spread');
  if (gpMut) gpMut(gp);
  const off = { roster: offRoster, depth: buildDepthChart(offRoster, gp), gameplan: gp, school: school || { id: 'O', name: 'Off U' }, isHome: true, ctx: { fatigueMap: {}, snapCountMap: {}, benchedMap: {}, offSnaps: 0, defSnaps: 0, jobSnapMap: {} }, form: 1 };
  const dgp = gpFor('Single Back');
  const def = { roster: defRoster, depth: buildDepthChart(defRoster, dgp), gameplan: dgp, school: { id: 'D', name: 'Def U' }, isHome: false, ctx: { fatigueMap: {}, snapCountMap: {}, benchedMap: {}, offSnaps: 0, defSnaps: 0, jobSnapMap: {} }, form: 1 };
  const plays = [];
  simulateDrive(off, def, { fieldPos: 35, clock: 1500, half: 1, score: { off: 0, def: 0 } }, [], call ? {
    askCall: () => 'ASK',
    resume: { call, fieldPos: 35, down: 1, distance: 10, plays, audiblesUsed: 0, fourthDecided: false, decision: null, pen: { offCount: 0, offYds: 0, defCount: 0, defYds: 0 } },
  } : { _probePlays: plays, plays });
  return plays;
}
// unforced drives: simulateDrive collects plays into events; simplest is to
// force a sheet call each snap is overkill — use the resume rig with 'sheet'.
function sheetDrive() { return runDrive({ concept: 'sheet' }); }

// seeded PRNG pin (mulberry32) — same stream both runs.
function pinRandom(seed) {
  let a = seed >>> 0;
  const real = Math.random;
  Math.random = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => { Math.random = real; };
}

hdr('R1 — every real scrimmage record carries the stamps');
{
  const plays = sheetDrive();
  const real = plays.filter((p) => p && (p.concept || (p.type && /^(run|pass)/.test(p.type))));
  const hasKeys = real.every((p) => 'bookName' in p && 'variation' in p && 'customPlayId' in p && 'offFormation' in p);
  check(real.length > 0, `drive produced real snaps (${real.length})`);
  check(hasKeys, 'every real snap carries bookName/variation/customPlayId (+offFormation)');
  check(real.every((p) => p.customPlayId === null), 'sheet snaps carry no customPlayId');
  check(real.every((p) => p.bookName === null), 'no book, no _playbookName → bookName stamps null (null-safe)');
  // pre-snap penalties can consume a resume with no real snap — retry like the
  // fidelity probe does.
  const realOf = (mut, school) => {
    for (let i = 0; i < 8; i++) {
      const r = runDrive({ concept: 'sheet' }, mut, school).filter((p) => p && p.concept);
      if (r.length) return r;
    }
    return [];
  };
  const namedReal = realOf((gp) => { gp._playbookName = 'Air Raid Test'; });
  check(namedReal.length > 0 && namedReal.every((p) => p.bookName === 'Air Raid Test'), '_playbookName fallback stamps the book name');
  const bookedReal = realOf(null, { id: 'O', name: 'Off U', book: { name: 'The Real Book', plan: {} } });
  check(bookedReal.length > 0 && bookedReal.every((p) => p.bookName === 'The Real Book'), 'school.book.name wins as the stamp source');
}

hdr('R2 — recording-only law: pinned PRNG, book name present vs absent → byte-identical but the stamp');
{
  const unpin1 = pinRandom(0xC0FFEE);
  const a = runDrive({ concept: 'sheet' }, (gp) => { gp._playbookName = 'Stamp Test'; });
  unpin1();
  const unpin2 = pinRandom(0xC0FFEE);
  const b = runDrive({ concept: 'sheet' });
  unpin2();
  const strip = (plays) => JSON.stringify(plays.map((p) => { const q = { ...p }; delete q.bookName; return q; }));
  check(a.length === b.length, `same snap count under the pinned stream (${a.length} vs ${b.length})`);
  check(strip(a) === strip(b), 'records byte-identical with bookName stripped — the stamp moved nothing');
  check(JSON.stringify(a) !== JSON.stringify(b), 'and the stamp itself is the only difference (present vs null)');
}

hdr('R3 — the fielded LOOK is recorded');
{
  let vSeen = 0, vNull = 0, guard = 0;
  while (vSeen < 4 && guard < 16) {
    guard++;
    const plays = runDrive({ concept: 'Mesh', formationId: 'Spread', variation: 'trips' });
    const real = plays.filter((p) => p && p.concept === 'Mesh');
    if (!real.length) continue;
    vSeen++;
    if (real[0].variation !== 'trips') vNull++;
  }
  check(vSeen === 4 && vNull === 0, `a forced (Spread · trips) call stamps variation 'trips' (${vSeen} snaps, ${vNull} misses)`);
  const base = runDrive({ concept: 'Mesh', formationId: 'Spread' });
  const baseReal = base.filter((p) => p && p.concept === 'Mesh');
  check(baseReal.length === 0 || baseReal.every((p) => p.variation === null), 'an unvariated call stamps variation null');
}

hdr('R4 — a composed call records its customPlayId');
{
  const COMPOSED = { schemaVersion: 1, name: 'Record Special', kind: 'pass', parts: ['go', 'drag', 'curl'], assigns: [], blocks: [], formations: [] };
  let seen = 0, misses = 0, guard = 0;
  while (seen < 4 && guard < 16) {
    guard++;
    const plays = runDrive({ customPlay: 'play-xyz', customPlayData: COMPOSED });
    const real = plays.filter((p) => p && p.concept === 'Record Special');
    if (!real.length) continue;
    seen++;
    const p = real[0];
    if (p.customPlayId !== 'play-xyz') misses++;
  }
  check(seen === 4 && misses === 0, `composed snaps carry customPlayId 'play-xyz' (${seen} snaps, ${misses} misses)`);
}

console.log(`\nRECORD CALL PROBE — ${pass} pass, ${fail} fail`);
console.log(fail ? 'RECORD CALL PROBE FAIL' : 'RECORD CALL PROBE PASS');
process.exit(fail ? 1 : 0);
