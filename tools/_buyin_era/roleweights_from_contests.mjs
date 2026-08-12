// ── ROLE_WEIGHTS FROM THE CONTEST TABLE (Phase 3 closer) ────────────────────
// Design law #1 executed: a role's rating weights derive from the CONTESTS
// that role actually fights, weighted by how often. Run this after any blend
// change; it drift-checks BLENDS against sim.js first (alarm if the sim's
// inline formulas ever diverge from the table), prints a diff, and splices
// the generated block into constants.js.
//
//   node tools/roleweights_from_contests.mjs          (check + diff only)
//   node tools/roleweights_from_contests.mjs --write  (splice into constants)

import { BLENDS, CONTESTS } from '../js/engine/contests.js';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--write');

// ── 1. Drift alarm: every multi-attr blend must appear in sim.js ───────────
const sim = readFileSync(join(ROOT, 'js/engine/sim.js'), 'utf8');
const DRIFT_CHECKS = {
  passProBlock: ['STR * 0.30', 'TEC * 0.28'],
  runBlock:     ['PWR * 0.30', 'AWR * 0.28'],
  rushSpeed:    ['SPD * 0.30', 'JMP * 0.08'],
  rushPower:    ['PWR * 0.34', 'JMP * 0.06'],
  shed:         ['STR * 0.34', 'TEC * 0.16'],
  routeShort:   ['AGI * 0.30', 'TEC * 0.20'],
  routeMed:     ['SPD * 0.40', 'TEC * 0.20'],
  routeDeep:    ['SPD * 0.60', 'JMP * 0.10'],
  // coverage has NO drift string: the blend formula was retired in Jul 2026 and separation
  // is now emergent in js/engine/sepgeo.js. The old needles ('SPD * 0.33') matched only
  // _refSepAB, sim.js's frozen debug reference, so this check fired forever on dead code.
  // Re-derive the row with tools/coverage_blend_sensitivity.mjs instead of grepping.
  intChain:     ['AWR * 0.40', 'TEC * 0.12'],
  pursuit:      ['SPD * 0.42', 'TEC * 0.10'],
  qbPassing:    ['AWR * 0.6', 'TEC * 0.4'],
};
let drift = 0;
for (const [row, needles] of Object.entries(DRIFT_CHECKS)) {
  for (const n of needles) {
    if (!sim.includes(n)) { console.error(`DRIFT: ${row} — sim.js no longer contains "${n}"`); drift++; }
  }
}
if (drift) { console.error(`\n${drift} drift(s): update BLENDS + this check, then regenerate.`); process.exit(1); }
console.log('drift check: BLENDS match sim.js ✓');

// ── 2. Contest mix per role (shares sum to 1.0) ─────────────────────────────
// This table IS the football opinion of what each role's job is made of.
const MIX = {
  // Quarterbacks
  'QB-Pocket': { qbPassing: 0.6076, qbArm: 0.1764, ballSecurity: 0.098, scramble: 0.049, motor: 0.049, tackleTruckOff: 0.02 },
  'QB-Gunslinger': { qbPassing: 0.539, qbArm: 0.2744, ballSecurity: 0.0686, scramble: 0.049, motor: 0.049, tackleTruckOff: 0.02 },
  'QB-Game-Manager': { qbPassing: 0.6664, qbArm: 0.098, ballSecurity: 0.1372, scramble: 0.0294, motor: 0.049, tackleTruckOff: 0.02 },
  'QB-Scrambler': { qbPassing: 0.4185, qbArm: 0.093, scramble: 0.279, ballSecurity: 0.093, motor: 0.0465, tackleTruckOff: 0.07 },
  'QB-Dual': { qbPassing: 0.4888, qbArm: 0.1128, scramble: 0.2256, ballSecurity: 0.0658, motor: 0.047, tackleTruckOff: 0.06 },
  // Running backs — the two escape paths ARE the identity split
  'RB-Speed':     { tackleEvadeOff: .30, pureSpeed: .14, vision: .12, ballSecurity: .10, routeShort: .10, hands: .08, tackleTruckOff: .06, motor: .10 },
  'RB-Power':     { tackleTruckOff: .34, vision: .12, ballSecurity: .12, runBlock: .10, tackleEvadeOff: .08, hands: .05, pureSpeed: .05, motor: .14 },
  'RB-Elusive':   { tackleEvadeOff: .38, vision: .14, hands: .10, ballSecurity: .10, routeShort: .10, pureSpeed: .07, tackleTruckOff: .04, motor: .07 },
  'RB-Workhorse': { tackleEvadeOff: .17, tackleTruckOff: .17, vision: .14, ballSecurity: .14, hands: .08, runBlock: .08, pureSpeed: .08, motor: .14 },
  'RB-Scat': { tackleEvadeOff: 0.266, routeShort: 0.19, hands: 0.171, pureSpeed: 0.114, ballSecurity: 0.076, vision: 0.0665, motor: 0.0665, tackleTruckOff: 0.05 },
  // Fullbacks
  'FB-Lead':   { runBlock: .50, tackleTruckOff: .14, ballSecurity: .10, vision: .10, motor: .16 },
  'FB-HBack':  { runBlock: .30, hands: .18, routeShort: .16, tackleTruckOff: .10, ballSecurity: .10, motor: .16 },
  'FB-Hybrid': { runBlock: .38, tackleTruckOff: .14, hands: .12, routeShort: .10, ballSecurity: .10, motor: .16 },
  // Receivers
  'WR-Deep':     { routeDeep: .38, pureSpeed: .14, hands: .16, contestedOff: .12, routeMed: .08, ballSecurity: .04, motor: .08 },
  'WR-Poss':     { hands: .26, routeShort: .20, routeMed: .16, contestedOff: .16, ballSecurity: .08, motor: .14 },
  'WR-Slot': { routeShort: 0.288, routeMed: 0.1536, hands: 0.1728, tackleEvadeOff: 0.1344, ballSecurity: 0.0576, motor: 0.1536, tackleTruckOff: 0.04 },
  'WR-Physical': { contestedOff: .26, hands: .18, routeMed: .16, routeShort: .10, runBlock: .12, ballSecurity: .06, motor: .12 },
  // The red-zone fade target (added Jul 2026 with the Red-Zone Fade concept). He is a
  // jump-ball specialist first — the fade resolver is an isolated contested catch — so he
  // leans harder on contestedOff than WR-Physical and carries almost no route tree.
  'WR-Fade':     { contestedOff: .44, hands: .22, routeShort: .10, routeMed: .08, runBlock: .06, ballSecurity: .04, motor: .06 },
  // Tight ends
  'TE-Blocking':  { runBlock: .44, passProBlock: .12, hands: .10, routeShort: .10, contestedOff: .08, motor: .16 },
  'TE-Receiving': { hands: .24, routeMed: .20, routeShort: .14, contestedOff: .18, runBlock: .10, motor: .14 },
  'TE-Hybrid':    { runBlock: .24, hands: .18, routeMed: .14, routeShort: .12, contestedOff: .14, passProBlock: .06, motor: .12 },
  'TE-Move': { routeMed: 0.192, hands: 0.1728, runBlock: 0.1728, contestedOff: 0.1152, tackleEvadeOff: 0.096, routeShort: 0.0768, motor: 0.1344, tackleTruckOff: 0.04 },
  // Offensive line
  'OL-Mauler':   { runBlock: .60, passProBlock: .22, motor: .18 },
  'OL-PassPro':  { passProBlock: .58, runBlock: .24, motor: .18 },
  'OL-Balanced': { runBlock: .41, passProBlock: .41, motor: .18 },
  'OL-Athletic': { passProBlock: .34, runBlock: .32, pull: .18, motor: .16 },
  // Defensive ends
  'DE-Speed': { rushSpeed: .46, shed: .20, pursuit: .12, tackleDef: .10, motor: .12 },
  'DE-Power': { rushPower: .34, shed: .34, tackleDef: .12, pursuit: .08, motor: .12 },
  'DE-Base':  { rushSpeed: .24, rushPower: .20, shed: .26, tackleDef: .12, pursuit: .08, motor: .10 },
  // Defensive tackles
  'DT-NT':       { shed: .46, rushPower: .26, tackleDef: .10, motor: .18 },
  'DT-3tech':    { rushPower: .38, shed: .32, tackleDef: .12, pursuit: .06, motor: .12 },
  'DT-Quick':    { rushSpeed: .28, shed: .28, rushPower: .20, pursuit: .10, motor: .14 },
  'DT-Balanced': { shed: .34, rushPower: .28, rushSpeed: .12, tackleDef: .10, motor: .16 },
  // Outside linebackers
  'OLB-Rush':  { rushSpeed: .40, pursuit: .16, tackleDef: .16, shed: .10, coverage: .06, motor: .12 },
  'OLB-Blitz': { rushSpeed: .36, tackleDef: .18, pursuit: .16, shed: .12, coverage: .06, motor: .12 },
  'OLB-Cover': { coverage: .32, pursuit: .18, tackleDef: .18, intChain: .10, rushSpeed: .08, motor: .14 },
  // Inside linebackers
  'LB-Thumper':  { tackleDef: .30, shed: .20, pursuit: .20, coverage: .06, intChain: .04, motor: .20 },
  'LB-Cover':    { coverage: .30, pursuit: .20, tackleDef: .18, intChain: .14, motor: .18 },
  'LB-Hybrid':   { tackleDef: .22, pursuit: .20, coverage: .18, shed: .12, intChain: .08, motor: .20 },
  'LB-Blitzer':  { rushSpeed: .28, tackleDef: .22, pursuit: .18, shed: .12, coverage: .06, motor: .14 },
  'LB-Sideline': { pursuit: .30, coverage: .22, tackleDef: .20, intChain: .08, motor: .20 },
  // Cornerbacks
  'CB-Press': { coverage: .44, intChain: .14, contestedDef: .12, tackleDef: .10, pursuit: .08, motor: .12 },
  'CB-Ball':  { intChain: .30, coverage: .34, contestedDef: .14, pursuit: .08, tackleDef: .06, motor: .08 },
  'CB-Zone':  { coverage: .40, intChain: .18, pursuit: .12, tackleDef: .12, contestedDef: .08, motor: .10 },
  'CB-Slot':  { coverage: .42, tackleDef: .14, pursuit: .12, intChain: .12, contestedDef: .08, motor: .12 },
  // Safeties
  'S-Free':   { coverage: .26, intChain: .26, pursuit: .20, tackleDef: .12, contestedDef: .08, motor: .08 },
  'S-Strong': { tackleDef: .26, pursuit: .22, coverage: .16, intChain: .10, shed: .08, motor: .18 },
  'S-Ball':   { intChain: .34, coverage: .24, pursuit: .16, contestedDef: .12, tackleDef: .06, motor: .08 },
  'S-Hybrid': { coverage: .22, tackleDef: .20, pursuit: .20, intChain: .16, contestedDef: .06, motor: .16 },
  'S-Nickel': { coverage: .34, tackleDef: .18, pursuit: .16, intChain: .14, contestedDef: .06, motor: .12 },
  // Specialists
  'K-Accuracy': { kickAccuracy: .60, kickLeg: .28, motor: .12 },
  'K-Power':    { kickLeg: .60, kickAccuracy: .28, motor: .12 },
  'K-Balanced': { kickLeg: .44, kickAccuracy: .44, motor: .12 },
  'P-Directional': { kickAccuracy: .58, kickLeg: .30, motor: .12 },
  'P-Distance':    { kickLeg: .58, kickAccuracy: .30, motor: .12 },
  'P-Balanced':    { kickLeg: .44, kickAccuracy: .44, motor: .12 },
  // Return man
  'Returner': { pureSpeed: 0.3128, tackleEvadeOff: 0.276, ballSecurity: 0.1472, vision: 0.184, tackleTruckOff: 0.08 },
};

// Offense-side rows of the two-sided tackle contests + the OL pull.
// Offense-side views of the two escape contests. These MUST mirror the `off`
// side of BLENDS.tackleEvade / BLENDS.tackleTruck — they were a stale pre-TEC
// copy (AGI .67 / SPD .33), which silently kept RB role weights on the old
// TEC-free formulas after the juke/truck gained technique. Derive them from
// BLENDS so they can never drift again.
const LOCAL = {
  tackleEvadeOff: CONTESTS.tackleEvade.off,
  tackleTruckOff: CONTESTS.tackleTruck.off,
  pull:           { AGI: 0.60, SPD: 0.40 },
};
const ROW = (id) => LOCAL[id] || BLENDS[id];

// ── 3. Generate ─────────────────────────────────────────────────────────────
const constantsPath = join(ROOT, 'js/constants.js');
const constants = readFileSync(constantsPath, 'utf8');
const cur = {};
{
  const i = constants.indexOf('export const ROLE_WEIGHTS');
  const block = constants.slice(i, constants.indexOf('\n};', i));
  for (const m of block.matchAll(/'([\w/-]+)':\s*\{([^}]*)\}/g)) {
    cur[m[1]] = Object.fromEntries([...m[2].matchAll(/(\w+):\s*(\d+)/g)].map(x => [x[1], +x[2]]));
  }
}
const missing = Object.keys(cur).filter(r => !MIX[r]);
if (missing.length) { console.error('UNMAPPED ROLES:', missing.join(', ')); process.exit(1); }

const ORDER = ['SPD','AGI','PWR','STR','JMP','HND','SEC','BLK','TKL','TEC','AWR','CON'];

// ── CON is a MOTOR attribute, not a rating input (Jul 2026) ─────────────────
// Conditioning governs how long you hold up — fatigue curves, injury odds,
// fumble resistance under contact, QB durability. All of that is live and
// staying. What it must NOT do is inflate a player's OVR: a rating answers
// "how good is he", and CON answers "how long can he do it". WE was correctly
// excluded from OVR on exactly this logic years ago; CON never got the same
// treatment, so it had quietly grown into a fifth of an interior player's
// rating (LB 19, OL 18, FB 16, DT 15) — nobody ever chose those numbers.
//
// The `motor` contest ({CON: 1.0}) is dropped from every role's mix here and
// its share redistributed PROPORTIONALLY across that role's real football
// contests. Each role's opinion of its own job is preserved exactly; only the
// conditioning tax comes off.
const DROP_CONTESTS = new Set(['motor']);

const gen = {};
for (const [role, rawMix] of Object.entries(MIX)) {
  const rawSum = Object.values(rawMix).reduce((a, b) => a + b, 0);
  if (Math.abs(rawSum - 1) > 0.005) { console.error(`MIX for ${role} sums to ${rawSum.toFixed(2)}`); process.exit(1); }
  const mix = {};
  let kept = 0;
  for (const [cid, share] of Object.entries(rawMix)) if (!DROP_CONTESTS.has(cid)) kept += share;
  if (kept <= 0) { console.error(`MIX for ${role} is all motor`); process.exit(1); }
  for (const [cid, share] of Object.entries(rawMix)) {
    if (DROP_CONTESTS.has(cid)) continue;
    mix[cid] = share / kept;   // renormalize the real work back to 1.0
  }
  const w = {};
  for (const [cid, share] of Object.entries(mix)) {
    const row = ROW(cid);
    if (!row) { console.error(`Unknown contest "${cid}" in ${role}`); process.exit(1); }
    for (const [attr, coef] of Object.entries(row)) w[attr] = (w[attr] || 0) + share * coef * 100;
  }
  // integer-round with drift fix so each role sums to exactly 100
  const rounded = {};
  let sum = 0;
  for (const a of ORDER) { if (w[a] >= 0.5) { rounded[a] = Math.round(w[a]); sum += rounded[a]; } }
  const topAttr = ORDER.reduce((best, a) => (rounded[a] || 0) > (rounded[best] || 0) ? a : best, 'SPD');
  rounded[topAttr] += 100 - sum;
  gen[role] = rounded;
}

// ── 4. Diff report ──────────────────────────────────────────────────────────
let bigMoves = 0;
for (const role of Object.keys(cur)) {
  const deltas = [];
  for (const a of ORDER) {
    const d = (gen[role][a] || 0) - (cur[role][a] || 0);
    if (Math.abs(d) >= 8) deltas.push(`${a} ${d > 0 ? '+' : ''}${d}`);
  }
  if (deltas.length) { console.log(`${role}: ${deltas.join(', ')}`); bigMoves++; }
}
console.log(`\n${bigMoves}/${Object.keys(cur).length} roles moved ≥8 pts on some attribute`);

// ── 5. Splice ───────────────────────────────────────────────────────────────
if (WRITE) {
  const fmt = (w) => Object.entries(w).filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}:${v}`).join(', ');
  const lines = Object.keys(cur).map(r => `  '${r}': { ${fmt(gen[r])} },`);
  const i = constants.indexOf('export const ROLE_WEIGHTS');
  const j = constants.indexOf('\n};', i);
  const head = constants.slice(0, constants.indexOf('\n', i) + 1);
  const out = head
    + '  // GENERATED from the contest table — edit tools/roleweights_from_contests.mjs, not this block.\n'
    + lines.join('\n') + constants.slice(j);
  writeFileSync(constantsPath, out);
  console.log('ROLE_WEIGHTS spliced ✓ (' + lines.length + ' roles)');

  // ── 6. POS_WEIGHTS from the same truth ──────────────────────────────────
  // A position's composite = the average of its archetype roles. This table
  // was hand-maintained and had drifted badly (TEC a flat 8 everywhere while
  // the sim used it in every contest; JMP 0 for DL after batted passes
  // shipped). One source of truth or it drifts again.
  const POS_ROLES = {};
  for (const role of Object.keys(MIX)) {
    const pos = role.split('-')[0];
    if (pos === 'Returner') continue;
    (POS_ROLES[pos] = POS_ROLES[pos] || []).push(role);
  }
  const posGen = {};
  for (const [pos, roles] of Object.entries(POS_ROLES)) {
    const w = {};
    for (const r of roles) for (const a of ORDER) w[a] = (w[a] || 0) + (gen[r][a] || 0) / roles.length;
    const rounded = {};
    let sum = 0;
    for (const a of ORDER) { if (w[a] >= 0.5) { rounded[a] = Math.round(w[a]); sum += rounded[a]; } }
    const top = ORDER.reduce((b, a) => (rounded[a] || 0) > (rounded[b] || 0) ? a : b, 'SPD');
    rounded[top] += 100 - sum;
    posGen[pos] = rounded;
  }
  const cst2 = readFileSync(constantsPath, 'utf8');
  const pi = cst2.indexOf('export const POS_WEIGHTS');
  const pj = cst2.indexOf('\n};', pi);
  const posLines = Object.keys(posGen).sort().map(p => `  ${p}: { ${fmt(posGen[p])} },`);
  const posHead = cst2.slice(0, cst2.indexOf('\n', pi) + 1);
  writeFileSync(constantsPath, posHead
    + '  // GENERATED from the contest table (average of each position\'s archetype\n'
    + '  // roles) — edit tools/roleweights_from_contests.mjs, not this block.\n'
    + posLines.join('\n') + cst2.slice(pj));
  console.log('POS_WEIGHTS spliced ✓ (' + posLines.length + ' positions)');
  for (const p of Object.keys(posGen).sort()) {
    console.log('   ', p.padEnd(4), 'TEC', String(posGen[p].TEC ?? 0).padStart(2), '| JMP', String(posGen[p].JMP ?? 0).padStart(2));
  }
}
