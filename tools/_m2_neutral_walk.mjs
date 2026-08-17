// _m2_neutral_walk.mjs — M2 proof (i): SHEETS ALONE ARE BYTE-NEUTRAL.
// Not gate-registered (a cross-TREE harness): run this same file against the
// pre-M2 tree and the M2 tree — identical hashes mean a no-override book under
// pinned PRNG plays byte-identical pre/post (the inheritance law), and AI
// league play (which never carries variations) is untouched.
//
//   node tools/_m2_neutral_walk.mjs
//
// Prints three hashes:
//   WORLD   — sha256 of every school's gameplan after worldgen
//   LEAGUE  — sha256 of 40 pinned AI-vs-AI simulateGame results
//   DRIVES  — sha256 of the play-by-play of 12 pinned drives under a
//             NO-OVERRIDE player book (base sheets only, no variations)
import { createHash } from 'node:crypto';

const _ls = new Map();
global.localStorage = {
  getItem: (k) => (_ls.has(k) ? _ls.get(k) : null),
  setItem: (k, v) => _ls.set(k, String(v)),
  removeItem: (k) => _ls.delete(k),
};

// pin BEFORE any world/roster RNG runs (mulberry32)
function pinRandom(seed) {
  let a = seed >>> 0;
  Math.random = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

// PIN BEFORE THE IMPORTS: several modules draw Math.random at LOAD time
// (module-level shuffles), and unpinned load-time draws make even the same
// tree diverge run to run. Pinning first makes the whole walk reproducible.
pinRandom(0xA110C8);

const { ROSTER_TARGETS, CLASS_YEARS } = await import('../js/constants.js');
const { createPlayer } = await import('../js/engine/player.js');
const { generateWorld, buildDepthChart } = await import('../js/engine/world.js');
const { simulateGame, simulateDrive } = await import('../js/engine/sim.js');

// ── WORLD: every AI plan, byte-hashed ───────────────────────────────────────
pinRandom(0x51EED);
const world = generateWorld();
console.log('WORLD  ', sha(world.schools.map((s) => s.gameplan)));

// ── LEAGUE: 40 pinned AI-vs-AI games ────────────────────────────────────────
pinRandom(0xBEEF01);
const results = [];
const pool = world.schools.slice(0, 80);
for (let i = 0; i + 1 < pool.length && results.length < 40; i += 2) {
  const h = pool[i], a = pool[i + 1];
  const hd = buildDepthChart(h.roster, h.gameplan), ad = buildDepthChart(a.roster, a.gameplan);
  const r = simulateGame(h, a, h.roster, a.roster, hd, ad, h.gameplan, a.gameplan);
  results.push({ hs: r.homeScore, as: r.awayScore, hst: r.homeStats || null, ast: r.awayStats || null });
}
console.log('LEAGUE ', sha(results));

// ── DRIVES: a NO-OVERRIDE player book (base sheets only), pinned ────────────
pinRandom(0xD01E5);
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
const offR = genRoster('O'), defR = genRoster('D');
const gp = {
  offFormation: 'Air Raid',
  offFormations: [{ id: 'Air Raid', weight: 60 }, { id: 'Spread', weight: 40 }],
  formationPlaybooks: { 'Air Raid': { Mesh: 80, 'Four Verts': 70 }, 'Spread': { 'Slant-Flat': 75 } },
  tendency: 'Balanced', rushInPct: 55,
  passDepth: { short: 40, medium: 40, deep: 20 },
  blitzPct: 20, defFormation: 'Balanced D', defFront: '4-3',
  fourthDown: 'Moderate', maxFGDist: 42,
};
const dgp = { ...gp, offFormation: 'Single Back', offFormations: [{ id: 'Single Back', weight: 100 }], formationPlaybooks: undefined };
const off = { roster: offR, depth: buildDepthChart(offR, gp), gameplan: gp, school: { id: 'O', name: 'Off U' }, isHome: true, ctx: { fatigueMap: {}, snapCountMap: {}, benchedMap: {}, offSnaps: 0, defSnaps: 0, jobSnapMap: {} }, form: 1 };
const def = { roster: defR, depth: buildDepthChart(defR, dgp), gameplan: dgp, school: { id: 'D', name: 'Def U' }, isHome: false, ctx: { fatigueMap: {}, snapCountMap: {}, benchedMap: {}, offSnaps: 0, defSnaps: 0, jobSnapMap: {} }, form: 1 };
const log = [];
for (let d = 0; d < 12; d++) {
  simulateDrive(off, def, { fieldPos: 25 + (d % 3) * 15, clock: 1700 - d * 120, half: d < 6 ? 1 : 2, score: { off: 0, def: 0 } }, log, {});
}
console.log('DRIVES ', sha(log));
console.log('done — compare all three lines across trees');
