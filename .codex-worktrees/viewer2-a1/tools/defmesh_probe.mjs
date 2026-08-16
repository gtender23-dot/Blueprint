// defmesh_probe.mjs — identity Stage 0 gate: the DEFENSIVE JOB MESH.
//
// Defensive unique jobs (NB, JACK/JOKER/CHAR/SPUR/BANDIT/EDGE, the stack
// backers, WAR/ROVER/Dime DB) are mesh pools like offense's SLOT/WING/WILDCAT:
// a coach may hand-pick any eligible body; auto-fill stays native-position-
// first with the mesh as tail. Base 4-3 and 3-4 are untouched.
//
// The three-places law, extended to defense, is the spine of this probe:
//
//   picker offers ⊆ resolver accepts ⊆ sim receives
//
//   1. TABLES    — every mesh key has one eligibility list (SLOT_ELIGIBLE_POS)
//                  and one auto pool (MESH_AUTO_POOL); native position first;
//                  every pooled position is priced by SLOT_ELIGIBILITY (the
//                  existing fit multiplier — no new math). 4-3/3-4 carry NO
//                  mesh keys. Exact ratified slot counts.
//   2. RESOLVER  — every position the picker would offer is accepted as a
//                  hand-pick; an out-of-pool body is refused; a legacy pin of
//                  a native body keeps resolving (old-save law).
//   3. SIM       — resolveDefField (the sim's per-snap personnel entry) seats
//                  a cross-position body in the JOB's bucket, so the existing
//                  applyOutOfPos machinery prices him; a full simulateGame
//                  with a pinned cross-position NB completes.
//   4. AUTO      — with healthy rooms every mesh slot auto-fills a NATIVE
//                  body (untouched plans and AI defenses resolve as before);
//                  only a drained room reaches the mesh tail.
//
// Run: node tools/defmesh_probe.mjs
import { resolveSlots, resolveDefField, SLOT_ELIGIBLE_POS, MESH_AUTO_POOL } from '../js/engine/fieldassign.js';
import { DEF_FIELD_LAYOUTS } from '../js/constants_field.js';
import { SLOT_ELIGIBILITY, ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';

let pass = 0, fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  got=${JSON.stringify(got)}${ok ? '' : `  want=${JSON.stringify(want)}`}`);
};

const meshSlots = [];
for (const [fid, layout] of Object.entries(DEF_FIELD_LAYOUTS))
  for (const s of layout.slots) if (s.mesh) meshSlots.push({ fid, s });

console.log('— 1. tables (one source of truth, priced by existing math) —');
{
  const counts = {};
  for (const { s } of meshSlots) counts[s.mesh] = (counts[s.mesh] || 0) + 1;
  // 16 STACKER jobs: Nickel WILL+MIKE, Dime MIKE, 46 MIKE, 5-2 ILB×2,
  // 3-3-5 STK×2+MIKE, Tite MIKE+WILL, 4-4 MIKE+WILL, Big Nickel WILL+MIKE,
  // Penny MIKE. 8 OVERHANG: 46 JACK/CHAR, Tite JOKER/JACK, 4-4 SPUR/BNDT,
  // Penny EDGE×2. 3 NB (Nickel/Dime/Penny). 3 SPACE (WAR, ROVER, Dime DB).
  check('ratified mesh coverage (slots per pool)', counts, { NB: 3, STACKER: 16, SPACE: 3, OVERHANG: 8 });
  check('base 4-3 carries no mesh keys', DEF_FIELD_LAYOUTS['4-3'].slots.some(s => s.mesh), false);
  check('base 3-4 carries no mesh keys', DEF_FIELD_LAYOUTS['3-4'].slots.some(s => s.mesh), false);
  check('pool lists (ratified)', {
    NB: SLOT_ELIGIBLE_POS.NB, OVERHANG: SLOT_ELIGIBLE_POS.OVERHANG,
    STACKER: SLOT_ELIGIBLE_POS.STACKER, SPACE: SLOT_ELIGIBLE_POS.SPACE,
  }, { NB: ['CB', 'S'], OVERHANG: ['OLB', 'DE', 'LB'], STACKER: ['LB', 'OLB'], SPACE: ['S', 'LB', 'CB'] });
  let pooled = true, priced = true, autoPool = true;
  for (const { s } of meshSlots) {
    const elig = SLOT_ELIGIBLE_POS[s.mesh];
    if (!elig || !elig.includes(s.pos)) pooled = false;
    if (!MESH_AUTO_POOL[s.mesh]) autoPool = false;
    for (const p of elig || []) if ((SLOT_ELIGIBILITY[s.pos] || {})[p] == null) priced = false;
  }
  check('every mesh slot pools its own position', pooled, true);
  check('every pooled position priced by SLOT_ELIGIBILITY (no new math)', priced, true);
  check('every mesh key has an auto pool', autoPool, true);
}

console.log('— 2. resolver: picker offers ⊆ resolver accepts (+ old-save pins) —');
// Synthetic rooms: three bodies per defensive position, one WR interloper.
const ROOMS = ['DE', 'DT', 'OLB', 'LB', 'CB', 'S', 'WR'];
const depth = {};
for (const pos of ROOMS) depth[pos] = [1, 2, 3].map(i => `${pos.toLowerCase()}${i}`);
const posOf = id => id ? ROOMS.find(p => id.startsWith(p.toLowerCase())) || null : null;
{
  let accepted = 0, wanted = 0, refusedOk = true, legacyOk = true;
  for (const { fid, s } of meshSlots) {
    const layout = DEF_FIELD_LAYOUTS[fid];
    for (const pos of SLOT_ELIGIBLE_POS[s.mesh]) {
      wanted++;
      const pick = `${pos.toLowerCase()}3`;                       // third-stringer: never auto-claimed first
      const { bySlot } = resolveSlots(layout.slots, { [s.id]: pick }, depth, null, posOf);
      if (bySlot[s.id] === pick) accepted++;
    }
    // out-of-pool: a WR (and for backer jobs a DT) must be refused
    const bad = s.mesh === 'NB' || s.mesh === 'SPACE' ? 'wr1' : 'dt3';
    const { bySlot: bs2 } = resolveSlots(layout.slots, { [s.id]: bad }, depth, null, posOf);
    if (bs2[s.id] === bad) refusedOk = false;
    // old-save law: a legacy pin of a NATIVE body (what the old picker offered)
    const native = `${s.pos.toLowerCase()}3`;
    const { bySlot: bs3 } = resolveSlots(layout.slots, { [s.id]: native }, depth, null, posOf);
    if (bs3[s.id] !== native) legacyOk = false;
  }
  check(`every pooled position accepted as a hand-pick (${wanted} slot×pos cases)`, accepted, wanted);
  check('out-of-pool bodies refused at every mesh slot', refusedOk, true);
  check('legacy native pins keep resolving (old-save law)', legacyOk, true);
}

console.log('— 3. sim receives: job bucket + full-game smoke —');
{
  // A star safety hand-picked at the Nickel NB lands in the CB bucket (the
  // job's bucket) — that is what routes him through applyOutOfPos pricing
  // and the DB coverage unit.
  const r = resolveDefField('Nickel', { NB: 's3' }, {}, depth, null, posOf);
  check('S pinned at NB seats in the CB (job) bucket', r.personnel.CB.includes('s3'), true);
  check('...and in the DB coverage unit', r.personnel.DB.includes('s3'), true);
  check('...not double-seated in the S bucket', r.personnel.S.includes('s3'), false);
  // A LB at the Penny EDGE joins the rush unit (Penny OLBs rush).
  const rp = resolveDefField('Penny', { OLB_L: 'lb3' }, {}, depth, null, posOf);
  check('LB pinned at Penny EDGE seats in OLB bucket', rp.personnel.OLB.includes('lb3'), true);
  check('...and rushes with the DL unit', rp.personnel.DL.includes('lb3'), true);
  // A DE at the Tite JACK.
  const rt = resolveDefField('Tite', { OLB_K: 'de3' }, {}, depth, null, posOf);
  check('DE pinned at Tite JACK seats in OLB bucket', rt.personnel.OLB.includes('de3'), true);

  // Full game: pinned PRNG, home defense bases Nickel with its best S at NB.
  const mulberry32 = seed => { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let x = Math.imul(t ^ t >>> 15, 1 | t); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; }; };
  const realRandom = Math.random;
  Math.random = mulberry32(1986);
  try {
    const gen = sid => { const out = []; for (const [pos, n] of Object.entries(ROSTER_TARGETS)) for (let i = 0; i < n; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], 1); p.schoolId = sid; out.push(p); } return out; };
    const rH = gen('H'), rA = gen('A');
    const gpH = { offFormation: 'Single Back', tendency: 'Balanced', defBaseFront: 'Nickel' };
    const gpA = { offFormation: 'Spread', tendency: 'Balanced' };
    const cH = buildDepthChart(rH, gpH), cA = buildDepthChart(rA, gpA);
    const bestS = (cH.S || [])[0];
    gpH.fieldAssignments = { offense: {}, defense: { Nickel: { slots: { NB: bestS }, blitzShares: {} } } };
    const res = simulateGame({ id: 'H', name: 'Home' }, { id: 'A', name: 'Away' }, rH, rA, cH, cA, gpH, gpA);
    check('full game with a cross-position NB pin completes', Number.isFinite(res.homeScore) && Number.isFinite(res.awayScore), true);
  } finally { Math.random = realRandom; }
}

console.log('— 4. auto-fill: native-first, mesh tail only when the room is dry —');
{
  // Healthy rooms (real roster targets): every mesh slot must auto-fill a
  // native-position body in every front — the mesh must not move auto.
  const roster = [];
  for (const [pos, n] of Object.entries(ROSTER_TARGETS)) for (let i = 0; i < n; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], 1); p.schoolId = 'X'; roster.push(p); }
  const dc = buildDepthChart(roster, { offFormation: 'Single Back' });
  const byId = new Map(roster.map(p => [p.id, p]));
  const posOfReal = id => byId.get(id)?.position || null;
  let allNative = true;
  for (const [fid, layout] of Object.entries(DEF_FIELD_LAYOUTS)) {
    const r = resolveDefField(fid, {}, {}, dc, null, posOfReal);
    for (const s of layout.slots) {
      if (!s.mesh) continue;
      const pid = r.bySlot[s.id];
      if (!pid || posOfReal(pid) !== s.pos) { allNative = false; console.log(`   drift: ${fid} ${s.id} auto-filled ${pid ? posOfReal(pid) : 'nobody'}`); }
    }
  }
  check('healthy rooms: every mesh slot auto-fills its native position (all fronts)', allNative, true);

  // Dry room: only two corners on the roster — the Nickel NB must come from
  // the mesh tail (an S), not sit empty and not grab a WR.
  const thin = { ...depth, CB: ['cb1', 'cb2'] };
  const { bySlot } = resolveSlots(DEF_FIELD_LAYOUTS['Nickel'].slots, {}, thin, null, posOf);
  check('dry CB room: NB auto-fills from the mesh tail (an S)', posOf(bySlot.NB), 'S');
  // With ratings present the tail is ranked by the SLOT_ELIGIBILITY-discounted
  // rating. Four safeties so FS/SS leave two over: the 80-rated s4 (×0.8 = 64)
  // must beat the 55-rated s3 (×0.8 = 44) for the dry NB.
  const thin4 = { ...depth, CB: ['cb1', 'cb2'], S: ['s1', 's2', 's3', 's4'] };
  const ratings = { s1: 60, s2: 70, s3: 55, s4: 80 };
  const { bySlot: bs } = resolveSlots(DEF_FIELD_LAYOUTS['Nickel'].slots, {}, thin4, ratings, posOf);
  check('mesh tail ranked by discounted rating (best free S wins the dry NB)', bs.NB, 's4');
}

console.log(`\n${fail ? 'FAIL' : 'ALL PASS'}  (${pass} pass, ${fail} fail)`);
process.exit(fail ? 1 : 0);
