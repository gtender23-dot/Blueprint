// depth_auto_probe.mjs — W5 role dials (§3) + contextual OVR (§9): does the
// designation actually steer the auto depth chart, and does the lens move the
// number?
//
// The spec's founding case is the OL trio: "set a lineman's designated role
// and auto-fill honors it — T-priority men claim the edges first, C-priority
// claims the pivot", and "the designation VISIBLY CHANGES HIS OVERALL". Five
// families of checks:
//
//   1. OL T/G/C   — designations claim their slots; NULL dials = the exact
//                   pre-W5 fill, byte for byte; a manual pick still beats a
//                   designation; a designated man outside the old top five is
//                   pulled onto the field.
//   2. TE catalog — the inline identity claims the blocking slot, the
//                   receiving identities leave it alone.
//   3. OLB hunter — claims the rush-first slot in fronts that HAVE one
//                   (3-4 edges, the 4-3 blitz-side SAM) and is ignored where
//                   the job doesn't exist (Nickel's lone cover OLB).
//   4. §9 lens    — contextual OVR swings when the dial moves, the consensus
//                   number does not; scheme context grades the same body
//                   differently under different fronts.
//   5. Inertness  — no dials anywhere (every AI team, every old save) →
//                   resolver output deep-equals the no-lookup call.
//
// Usage: node tools/depth_auto_probe.mjs
import { resolveSlots } from '../js/engine/fieldassign.js';
import { OFF_FIELD_LAYOUTS, DEF_FIELD_LAYOUTS } from '../js/constants_field.js';
import { resolveDefPersonnel } from '../js/engine/formations.js';
import {
  roleDialOf, deployRolesOf, schemeContext, contextRoleFor, contextualOvr,
  ovrConsensus, compositeRating, roleRating,
} from '../js/engine/player.js';
import { C, ATTRIBUTES } from '../js/constants.js';

let fails = 0, checks = 0;
const check = (cond, msg) => {
  checks++;
  console.log(`  ${cond ? 'PASS' : 'FAIL'} — ${msg}`);
  if (!cond) fails++;
};

// ── fixtures ───────────────────────────────────────────────────────────────
const mkPlayer = (id, position, attrs = {}) => {
  const attributes = {};
  for (const a of ATTRIBUTES) attributes[a] = attrs[a] ?? 55;
  const p = { id, position, attributes, injuryGamesOut: 0 };
  p.compositeRating = Math.round(compositeRating(p));
  return p;
};
const dialLookup = (players) => {
  const byId = new Map(players.map(p => [p.id, p]));
  return (id) => { const p = byId.get(id); return p ? deployRolesOf(p) : null; };
};

const olSlots = OFF_FIELD_LAYOUTS['Single Back'].slots.filter(s => s.pos === 'OL');
const slotIds = olSlots.map(s => s.id);   // OL_LT, OL_LG, OL_C, OL_RG, OL_RT
const lineup = (bySlot) => slotIds.map(sid => bySlot[sid] || null).join(' ');

// ── 1. OL T/G/C priority ───────────────────────────────────────────────────
console.log('\n1. OL T/G/C — the designation claims the slot');
{
  const ol = ['OL1', 'OL2', 'OL3', 'OL4', 'OL5', 'OL6'].map(id => mkPlayer(id, 'OL'));
  const posOf = () => 'OL';
  const depth = { OL: ol.map(p => p.id) };

  // NULL DIALS: the legacy fill, exactly — LT..RT get the room's top five.
  {
    const { bySlot } = resolveSlots(olSlots, {}, depth, null, posOf, dialLookup(ol));
    check(lineup(bySlot) === 'OL1 OL2 OL3 OL4 OL5',
      `no dials → legacy order holds (got ${lineup(bySlot)})`);
  }
  // C-priority claims the pivot from the 4-hole.
  {
    ol.forEach(p => delete p.coachRole);
    ol[3].coachRole = 'OL-C';
    const { bySlot } = resolveSlots(olSlots, {}, depth, null, posOf, dialLookup(ol));
    check(bySlot.OL_C === 'OL4', `C-designated OL4 claims the pivot (got ${bySlot.OL_C})`);
    check(lineup(bySlot) === 'OL1 OL2 OL4 OL3 OL5',
      `undesignated men shift in depth order (got ${lineup(bySlot)})`);
  }
  // T-priority men claim the edges first, in depth order.
  {
    ol.forEach(p => delete p.coachRole);
    ol[2].coachRole = 'OL-T'; ol[4].coachRole = 'OL-T';
    const { bySlot } = resolveSlots(olSlots, {}, depth, null, posOf, dialLookup(ol));
    check(bySlot.OL_LT === 'OL3' && bySlot.OL_RT === 'OL5',
      `two dialed tackles take LT/RT by depth (got LT=${bySlot.OL_LT} RT=${bySlot.OL_RT})`);
  }
  // Two G-priority men own both guard spots.
  {
    ol.forEach(p => delete p.coachRole);
    ol[0].coachRole = 'OL-IOL'; ol[4].coachRole = 'OL-IOL';
    const { bySlot } = resolveSlots(olSlots, {}, depth, null, posOf, dialLookup(ol));
    check(bySlot.OL_LG === 'OL1' && bySlot.OL_RG === 'OL5',
      `dialed guards claim LG/RG (got LG=${bySlot.OL_LG} RG=${bySlot.OL_RG})`);
  }
  // A designated man OUTSIDE the old top five gets pulled onto the field.
  {
    ol.forEach(p => delete p.coachRole);
    ol[5].coachRole = 'OL-C';
    const { bySlot } = resolveSlots(olSlots, {}, depth, null, posOf, dialLookup(ol));
    check(bySlot.OL_C === 'OL6', `bench C-priority man is pulled to the pivot (got ${bySlot.OL_C})`);
    check(!Object.values(bySlot).includes('OL5'),
      'the last undesignated man is the one who sits');
  }
  // A manual pick beats a designation — the coach's hand always wins.
  {
    ol.forEach(p => delete p.coachRole);
    ol[4].coachRole = 'OL-C';
    const { bySlot } = resolveSlots(olSlots, { OL_C: 'OL2' }, depth, null, posOf, dialLookup(ol));
    check(bySlot.OL_C === 'OL2', `manual pivot pick holds over the dial (got ${bySlot.OL_C})`);
  }
  ol.forEach(p => delete p.coachRole);
}

// ── 2. TE usage identity ───────────────────────────────────────────────────
console.log('\n2. TE catalog — the inline identity claims the blocking slot');
{
  // Power-I fields Y (TE-Blocking) then U (TE-Receiving).
  const layout = OFF_FIELD_LAYOUTS['Power-I'];
  const teSlots = layout.slots.filter(s => s.pos === 'TE');
  const yId = teSlots.find(s => s.role === 'TE-Blocking').id;
  const uId = teSlots.find(s => s.role === 'TE-Receiving').id;
  const tes = ['TE1', 'TE2', 'TE3'].map(id => mkPlayer(id, 'TE'));
  const posOf = () => 'TE';
  const depth = { TE: tes.map(p => p.id) };

  {
    const { bySlot } = resolveSlots(teSlots, {}, depth, null, posOf, dialLookup(tes));
    check(bySlot[yId] === 'TE1' && bySlot[uId] === 'TE2',
      `no dials → legacy TE order (got Y=${bySlot[yId]} U=${bySlot[uId]})`);
  }
  {
    tes[1].coachRole = 'TE-Inline';
    const { bySlot } = resolveSlots(teSlots, {}, depth, null, posOf, dialLookup(tes));
    check(bySlot[yId] === 'TE2', `inline-dialed TE2 claims the blocking slot (got ${bySlot[yId]})`);
    check(bySlot[uId] === 'TE1', `TE1 moves to the receiving slot (got ${bySlot[uId]})`);
    delete tes[1].coachRole;
  }
  {
    // A receiving identity (seam) claims the RECEIVING slot instead.
    tes[1].coachRole = 'TE-Seam';
    const { bySlot } = resolveSlots(teSlots, {}, depth, null, posOf, dialLookup(tes));
    check(bySlot[uId] === 'TE2' && bySlot[yId] === 'TE1',
      `seam-dialed TE2 claims U, TE1 keeps Y (got Y=${bySlot[yId]} U=${bySlot[uId]})`);
    delete tes[1].coachRole;
  }
}

// ── 3. OLB designated QB hunter ────────────────────────────────────────────
console.log('\n3. OLB hunter — rush-first slots in fronts that have one');
{
  // Roster: two cover-shaped OLBs ahead of a rush-shaped third stringer.
  const cover = { SPD: 78, AGI: 66, PWR: 40, STR: 42, TEC: 55, AWR: 72 };
  // Rush-LEANING but strictly worse than the cover men on every lens — with
  // no dial he sits, so any snap he gets below is the dial's doing.
  const rush  = { SPD: 64, AGI: 62, PWR: 58, STR: 56, TEC: 52, AWR: 45 };
  const olbs = [mkPlayer('OLB1', 'OLB', cover), mkPlayer('OLB2', 'OLB', cover),
                mkPlayer('OLB3', 'OLB', rush)];
  // The front line needs REAL bodies for their own slots — flat-55 ends lose
  // the DE spot to a rush OLB through cross-position eligibility (correctly!),
  // and then the probe measures its own fixture instead of the dial.
  // …and the ends need BOTH shapes on the shelf: the 4-3 fields a speed end
  // and a power end, and a power-only pair loses the speed slot to a spare
  // OLB through cross-position eligibility (the distance table doesn't price
  // cross-position bodies — pre-existing engine behavior, not the dial's).
  const deSpeed = { SPD: 74, AGI: 70, PWR: 56, STR: 62, TEC: 60, AWR: 55 };
  const dePower = { SPD: 62, AGI: 52, PWR: 74, STR: 78, TEC: 64, AWR: 60 };
  const dtShape = { SPD: 50, AGI: 42, PWR: 76, STR: 80, TEC: 62, AWR: 60 };
  const filler = [
    mkPlayer('DE1', 'DE', deSpeed), mkPlayer('DE2', 'DE', dePower),
    ...['DT1', 'DT2', 'DT3'].map(id => mkPlayer(id, 'DT', dtShape)),
    ...['LB1', 'LB2'].map(id => mkPlayer(id, 'LB')),
    ...['CB1', 'CB2', 'CB3'].map(id => mkPlayer(id, 'CB')),
    ...['S1', 'S2', 'S3'].map(id => mkPlayer(id, 'S')),
  ];
  const roster = [...olbs, ...filler];
  const depthChart = {
    OLB: ['OLB1', 'OLB2', 'OLB3'],
    DE: ['DE1', 'DE2'], DT: ['DT1', 'DT2', 'DT3'], LB: ['LB1', 'LB2'],
    CB: ['CB1', 'CB2', 'CB3'], S: ['S1', 'S2', 'S3'],
  };

  // The 3-4's OLB slots are BOTH rush jobs, and the engine's rush-fit
  // ranking already fields the rush-leaning body there without any dial —
  // the dial and the scout agree, nothing to flip. The isolating case is
  // the 4-3, where the slots are two different jobs (blitz-side SAM,
  // cover-side WILL) and the undialed fill keeps the better cover men on
  // the field.
  const undialed34 = resolveDefPersonnel('3-4', depthChart, roster).OLB.slice();
  const undialed43 = resolveDefPersonnel('4-3', depthChart, roster).OLB.slice();
  check(undialed34.includes('OLB3'), `3-4 undialed: rush fit already fields him (got [${undialed34}])`);
  check(!undialed43.includes('OLB3'), `4-3 undialed: the hunter-to-be sits (got [${undialed43}])`);

  olbs[2].coachRole = 'OLB-Rush';
  const dialed43 = resolveDefPersonnel('4-3', depthChart, roster).OLB.slice();
  check(dialed43[0] === 'OLB3',
    `4-3 dialed: he claims the blitz-first SAM ahead of a better-graded cover man (got [${dialed43}])`);
  const dialed34 = resolveDefPersonnel('3-4', depthChart, roster).OLB.slice();
  check(dialed34.includes('OLB3'), `3-4 dialed: still on the edge (got [${dialed34}])`);

  // Nickel's lone OLB job is COVERAGE — the hunter dial does not claim it.
  const nick = resolveDefPersonnel('Nickel', depthChart, roster).OLB.slice();
  check(!nick.includes('OLB3'), `Nickel: no rush job, the dial claims nothing (got [${nick}])`);
  delete olbs[2].coachRole;
}

// ── 4. §9 — the lens IS the number ─────────────────────────────────────────
console.log('\n4. Contextual OVR — the dial moves the shown number, not the consensus');
{
  // A tackle-shaped lineman: feet and hands, lighter drive.
  const tackleShaped = mkPlayer('T1', 'OL', { STR: 74, TEC: 78, PWR: 58, AWR: 62, AGI: 70, SPD: 55 });
  const school = { gameplan: { offFormations: [{ id: 'Spread', weight: 60 }, { id: 'Single Back', weight: 40 }], defBaseFront: '3-4' } };
  const ctx = schemeContext(school);

  const asAuto = contextualOvr(tackleShaped, ctx);
  tackleShaped.coachRole = 'OL-T';
  const asT = contextualOvr(tackleShaped, ctx);
  tackleShaped.coachRole = 'OL-IOL';
  const asG = contextualOvr(tackleShaped, ctx);
  const cons1 = ovrConsensus(tackleShaped).consensus;
  tackleShaped.coachRole = 'OL-T';
  const cons2 = ovrConsensus(tackleShaped).consensus;
  check(asT > asG, `tackle-shaped OL grades higher as T than as G (${asT} vs ${asG})`);
  check(asAuto === asT, `auto best-fit finds the tackle lens on its own (${asAuto} vs ${asT})`);
  check(cons1 === cons2 && cons1 === Math.round(tackleShaped.compositeRating),
    `consensus never moves with the dial (${cons1}/${cons2})`);
  const spread = ovrConsensus(tackleShaped);
  check(spread.lo <= spread.hi && spread.hi >= asG,
    `spread brackets the scheme grades (${spread.lo}–${spread.hi})`);
  delete tackleShaped.coachRole;

  // Same body, two programs: a cover-shaped OLB is worth more to the 4-3
  // down the road than to your 3-4 that only has rush jobs for him.
  const coverOlb = mkPlayer('OLBx', 'OLB', { SPD: 80, AGI: 68, PWR: 38, STR: 40, TEC: 54, AWR: 75 });
  const ctx34 = schemeContext({ gameplan: { offFormations: [{ id: 'Spread', weight: 100 }], defBaseFront: '3-4' } });
  const ctx43 = schemeContext({ gameplan: { offFormations: [{ id: 'Spread', weight: 100 }], defBaseFront: '4-3' } });
  check(contextualOvr(coverOlb, ctx43) > contextualOvr(coverOlb, ctx34),
    `cover OLB: 4-3 sees ${contextualOvr(coverOlb, ctx43)}, 3-4 sees ${contextualOvr(coverOlb, ctx34)} — both true (§9)`);

  // Validation: a bogus key or a wrong-position key is Auto, not a crash.
  const te = mkPlayer('TEx', 'TE');
  te.coachRole = 'OL-T';
  check(roleDialOf(te) === null && deployRolesOf(te) === null,
    'wrong-position designation is ignored (Auto)');
  te.coachRole = 'TE-Nonsense';
  check(roleDialOf(te) === null, 'unknown designation is ignored (Auto)');

  // Every dial in the catalog names a real fit-grade lens.
  let allWeighted = true;
  for (const cat of Object.values(C.ROLE_DIALS)) {
    for (const [rk, spec] of Object.entries(cat.roles)) {
      if (roleRating(mkPlayer('probe', 'OL'), rk) == null) allWeighted = false;
      if (!spec.label || !spec.short || !spec.deploy?.length) allWeighted = false;
    }
  }
  check(allWeighted, 'every ROLE_DIALS entry has weights, label, short, deploy');
}

// ── 5. Inertness — AI teams and old saves ──────────────────────────────────
console.log('\n5. No dials anywhere → the resolver is byte-identical');
{
  const layout = OFF_FIELD_LAYOUTS['Power-I'];
  const roster = [
    mkPlayer('QB1', 'QB'),
    ...['RB1', 'RB2'].map(id => mkPlayer(id, 'RB')),
    ...['WR1', 'WR2'].map(id => mkPlayer(id, 'WR')),
    ...['TE1', 'TE2', 'TE3'].map(id => mkPlayer(id, 'TE')),
    ...['OL1', 'OL2', 'OL3', 'OL4', 'OL5'].map(id => mkPlayer(id, 'OL')),
  ];
  const posOf = (id) => roster.find(p => p.id === id)?.position || null;
  const depth = {};
  for (const p of roster) (depth[p.position] ||= []).push(p.id);
  const a = resolveSlots(layout.slots, {}, depth, null, posOf);
  const b = resolveSlots(layout.slots, {}, depth, null, posOf, dialLookup(roster));
  check(JSON.stringify(a) === JSON.stringify(b),
    'offense: with-lookup === without-lookup when nobody is dialed');

  const dLayout = DEF_FIELD_LAYOUTS['3-4'];
  const dRoster = [
    ...['DE1', 'DE2'].map(id => mkPlayer(id, 'DE')), mkPlayer('DT1', 'DT'),
    ...['OLB1', 'OLB2'].map(id => mkPlayer(id, 'OLB')),
    ...['LB1', 'LB2'].map(id => mkPlayer(id, 'LB')),
    ...['CB1', 'CB2'].map(id => mkPlayer(id, 'CB')),
    ...['S1', 'S2'].map(id => mkPlayer(id, 'S')),
  ];
  const dPosOf = (id) => dRoster.find(p => p.id === id)?.position || null;
  const dDepth = {};
  for (const p of dRoster) (dDepth[p.position] ||= []).push(p.id);
  const da = resolveSlots(dLayout.slots, {}, dDepth, null, dPosOf);
  const db = resolveSlots(dLayout.slots, {}, dDepth, null, dPosOf, dialLookup(dRoster));
  check(JSON.stringify(da) === JSON.stringify(db),
    'defense: with-lookup === without-lookup when nobody is dialed');
}

console.log(`\n${fails ? 'FAIL' : 'PASS'} — ${checks - fails}/${checks} checks green`);
process.exit(fails ? 1 : 0);
