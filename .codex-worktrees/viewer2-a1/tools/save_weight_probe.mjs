// save_weight_probe.mjs — WHERE are the megabytes?
//
// save_migration_check.mjs tells you the export is 39.8 MB against a 40 MB
// ceiling. It does not tell you what's IN it, so any diet is a guess. This
// attributes the bytes: by top-level key, then inside the world by category,
// then per-player so the biggest single object in the save is named.
//
// The number that matters is headroom. A save that measures under the ceiling
// on THIS seed can still cross it on another — the export is unseeded and the
// spread is real — so this prints the margin, not just the total.
//
// Method: serialize the real snapshot the way persistence does, then re-measure
// with one branch removed at a time. Difference = that branch's true cost
// including its share of key names and punctuation, which is where a
// wide-and-shallow object graph actually spends its size.
//
// Run from repo root:  node tools/save_weight_probe.mjs [seasons]
const _ls = new Map();
global.localStorage = {
  getItem: (k) => _ls.has(k) ? _ls.get(k) : null,
  setItem: (k, v) => _ls.set(k, String(v)),
  removeItem: (k) => _ls.delete(k),
};

// SEEDED, and this matters more than it looks. Worldgen is unseeded by default,
// so two runs build two different worlds and the size differs by ~1 MB on its
// own. That is enough to completely mask a real saving: the first measurement
// of the rival-division strip came back as 36.48 → 36.49 MB and looked like a
// no-op, when the strip had in fact worked perfectly and world variance had
// eaten the result. An unseeded probe cannot measure a DELTA — only a level.
// (This is the same defect W10 flagged in save_migration_check.)
// Override with --seed N to sample a different world.
const _arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SEED = parseInt(_arg('--seed', '12345'), 10);
let _s = SEED >>> 0;
Math.random = () => {
  _s ^= _s << 13; _s >>>= 0;
  _s ^= _s >>> 17;
  _s ^= _s << 5;  _s >>>= 0;
  return _s / 4294967296;
};

const { exportString } = await import('../js/engine/persistence.js');
const { generateWorld, generateRecruitPool, generateSchedule } = await import('../js/engine/world.js');

const CEILING_MB = 40;
const bytes = (o) => Buffer.byteLength(JSON.stringify(o));
const mb = (b) => +(b / 1048576).toFixed(2);
const pct = (b, t) => `${(b / t * 100).toFixed(1)}%`;

const world = generateWorld();
world.recruits = generateRecruitPool(world);
const playerSchool = world.schools[0];
const state = {
  initialized: true, season: 3, day: 12,
  playerSchoolId: playerSchool.id,
  playerCoach: { id: 'player', schoolId: playerSchool.id, prestige: playerSchool.prestige,
                 reputation: 'C', budget: 50000, scholarshipsAvailable: 4, recruitBoard: [],
                 budgetCarryover: 0, seasonRecord: { wins: 6, losses: 2 } },
  world,
  schedule: generateSchedule(world),
  playoffs: null, inbox: [], gameLog: [], awardsLog: [], coachHistory: [], signingsLog: [],
};

// The real thing, through the real pipeline (diet included).
const full = exportString(state);
const total = Buffer.byteLength(full);
// exportString wraps the snapshot under a `state` key (with export metadata
// alongside it). Descend, or every measurement below reads 100% / state.
const parsed = JSON.parse(full);
const snapshot = parsed.state || parsed;

console.log(`\nSAVE WEIGHT — ${mb(total)} MB total, ceiling ${CEILING_MB} MB`);
const headroom = CEILING_MB - mb(total);
console.log(`HEADROOM     ${headroom.toFixed(2)} MB  (${(headroom / CEILING_MB * 100).toFixed(1)}%)`);
if (headroom < 4) console.log(`⚠  under 10% of the ceiling — an unseeded export WILL cross it on some worlds`);

// ── top level ────────────────────────────────────────────────────────────────
console.log('\n── BY TOP-LEVEL KEY ───────────────────────────────────────────');
const tops = Object.keys(snapshot)
  .map(k => ({ k, b: bytes(snapshot[k]) }))
  .sort((a, b) => b.b - a.b);
for (const { k, b } of tops.slice(0, 10)) {
  if (b < 1024) continue;
  console.log(`  ${k.padEnd(18)} ${String(mb(b)).padStart(7)} MB   ${pct(b, total).padStart(6)}`);
}

// ── inside the world ─────────────────────────────────────────────────────────
console.log('\n── INSIDE world ───────────────────────────────────────────────');
const w = snapshot.world || {};
const schools = w.schools || [];
const rosterBytes = schools.reduce((s, sc) => s + bytes(sc.roster || []), 0);
const recruitBytes = bytes(w.recruits || []);
const schoolChrome = bytes(schools) - rosterBytes;
console.log(`  rosters (${schools.reduce((s, sc) => s + (sc.roster?.length || 0), 0)} players)`.padEnd(20) + `${String(mb(rosterBytes)).padStart(7)} MB   ${pct(rosterBytes, total).padStart(6)}`);
console.log(`  recruits (${(w.recruits || []).length})`.padEnd(20) + `${String(mb(recruitBytes)).padStart(7)} MB   ${pct(recruitBytes, total).padStart(6)}`);
console.log(`  school metadata`.padEnd(20) + `${String(mb(schoolChrome)).padStart(7)} MB   ${pct(schoolChrome, total).padStart(6)}`);
for (const k of Object.keys(w)) {
  if (k === 'schools' || k === 'recruits') continue;
  const b = bytes(w[k]);
  if (b > 51200) console.log(`  world.${k}`.padEnd(20) + `${String(mb(b)).padStart(7)} MB   ${pct(b, total).padStart(6)}`);
}

// ── inside one player ────────────────────────────────────────────────────────
// Every byte here is multiplied by the roster count across the whole world, so
// this is the highest-leverage table in the file: shaving one field off a
// player is worth ~30,000 times its own size.
const players = schools.flatMap(s => s.roster || []);
const allPlayers = players.concat(w.recruits || []);
console.log(`\n── PER PLAYER (× ${allPlayers.length} in the save) ──────────────────────────`);
if (allPlayers.length) {
  const avg = allPlayers.reduce((s, p) => s + bytes(p), 0) / allPlayers.length;
  console.log(`  average player object: ${Math.round(avg)} B`);
  const fieldTotals = new Map();
  for (const p of allPlayers) {
    for (const k of Object.keys(p)) {
      // +3 for the quoted key name, colon and comma — real cost in the stream.
      fieldTotals.set(k, (fieldTotals.get(k) || 0) + bytes(p[k]) + k.length + 3);
    }
  }
  const rows = [...fieldTotals.entries()].sort((a, b) => b[1] - a[1]);
  for (const [k, b] of rows.slice(0, 14)) {
    console.log(`  ${k.padEnd(20)} ${String(mb(b)).padStart(7)} MB   ${pct(b, total).padStart(6)}   ${Math.round(b / allPlayers.length)} B/player`);
  }
  const presence = (k) => allPlayers.filter(p => p[k] !== undefined).length;
  console.log(`\n  fields present on every player (a candidate is one that is mostly default):`);
  for (const [k] of rows.slice(0, 8)) {
    const n = presence(k);
    console.log(`    ${k.padEnd(20)} on ${n}/${allPlayers.length} (${(n / allPlayers.length * 100).toFixed(0)}%)`);
  }
}

console.log('\n───────────────────────────────────────────────────────────────');
console.log('A diet targets the widest table, not the biggest single object:');
console.log('anything on a player is multiplied by the whole world.');
