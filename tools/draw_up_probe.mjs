// draw_up_probe.mjs — STAGE 6 of the Playbook-Root refactor
// ("the animation honors the draw-up").
// Run: node tools/draw_up_probe.mjs
//
// Pins:
//   L1  THE POINTERS RESOLVE: every FORMATION_VARIATIONS `layout:` pointer
//       names an authored VARIATION_LAYOUTS row; every move references a real
//       base slot id; every moved coordinate is in bounds and NEVER offsides
//       (y >= 0.5 — the Jul 2026 alignment law); the resolved slots keep the
//       base's ids/positions/roles in order (presentation-only: same bodies,
//       same record-stamp ids, different placement); the base table is never
//       mutated; an unknown key resolves to null (base fallback).
//   L2  THE DIAGRAMS DRAW IT: renderFormationDiagram with a variation differs
//       from the base render for all 22 looks (the authored row engages) and
//       contains no NaN coordinates; renderPlayCard accepts the look.
//   L3  ONE RESOLVER: resolveComposedReceivers gives every authored route its
//       own receiver (no dupes), honors explicit picks, sends screens/
//       checkdowns to the backs — the card and the animation resolve alike.
//   L4  ANIMATES AS DRAWN: on a REAL recorded pass snap, seeding
//       p._composedRoutes makes each authored slot's route cue carry the
//       part's own shape (COMPOSED_SHAPE), a flip mirrors the break side, and
//       a drawn blocker gets no route cue.
//   L5  NEUTRALITY: the same snap without the seed (and with a null seed)
//       builds a byte-identical script — non-composed plays cannot change.
import { FORMATION_VARIATIONS } from '../js/constants.js';
import { OFF_FIELD_LAYOUTS, DEF_FIELD_LAYOUTS, VARIATION_LAYOUTS, variationLayoutSlots } from '../js/constants_field.js';
import { renderFormationDiagram, renderPlayCard, resolveComposedReceivers } from '../js/ui/views/routeart.js';
import { buildPlayScript, COMPOSED_SHAPE } from '../js/ui/watchphys.js';
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

let pass = 0, fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}`); ok ? pass++ : fail++; };
const hdr = (s) => console.log(`\n${s}`);

hdr('L1 — every layout: pointer resolves to a lawful authored row');
{
  let looks = 0, missing = 0, badSlot = 0, oob = 0, offside = 0, drift = 0, unmoved = 0;
  for (const [fid, vset] of Object.entries(FORMATION_VARIATIONS)) {
    const base = OFF_FIELD_LAYOUTS[fid];
    for (const [vk, vd] of Object.entries(vset)) {
      looks++;
      const row = vd.layout ? VARIATION_LAYOUTS[vd.layout] : null;
      if (!row) { missing++; console.log(`    MISSING: ${fid}/${vk} → ${vd.layout}`); continue; }
      const ids = new Set(base.slots.map((s) => s.id));
      for (const [sid, m] of Object.entries(row.moves || {})) {
        if (!ids.has(sid)) { badSlot++; console.log(`    BAD SLOT: ${vd.layout}.${sid}`); }
        if (m.x != null && (m.x < 0.02 || m.x > 0.98)) oob++;
        if (m.y != null && m.y > 0.95) oob++;
        if (m.y != null && m.y < 0.5) { offside++; console.log(`    OFFSIDES: ${vd.layout}.${sid} y=${m.y}`); }
      }
      const baseJson = JSON.stringify(base.slots);
      const out = variationLayoutSlots(base.slots, vd.layout);
      if (!out) { unmoved++; console.log(`    NO-OP: ${vd.layout}`); continue; }
      if (JSON.stringify(base.slots) !== baseJson) drift++;
      // Identity law, amended for the M0 card linter (2026-08-16): slot IDS,
      // ORDER and CATCH eligibility are eternal (the record's carrier/target
      // stamps resolve by id), but an authored move may RE-DRESS the body it
      // moves (pos/label/role) so the look draws its pkg's personnel — the
      // Diamond wing draws as an FB, Ace's tightened slot as a TE. OL and QB
      // may never be re-dressed, and only slots the row actually MOVES may
      // change dress.
      const same = out.length === base.slots.length && out.every((s, i) => {
        const b = base.slots[i];
        if (s.id !== b.id || !!s.catch !== !!b.catch) return false;
        const movedRow = (row.moves || {})[b.id];
        if (!movedRow) return s.pos === b.pos && s.role === b.role && s.label === b.label;
        if (b.pos === 'OL' || b.pos === 'QB') return s.pos === b.pos;
        return true; // moved skill body: dress may change with the look
      });
      if (!same) { badSlot++; console.log(`    IDENTITY DRIFT: ${vd.layout}`); }
    }
  }
  check(looks >= 22, `walked every look (${looks})`);
  check(missing === 0, `every layout: pointer resolves (${missing} missing)`);
  check(badSlot === 0, `moves reference real slots and preserve id/pos/role/label order (${badSlot} bad)`);
  check(oob === 0 && offside === 0, `every move in bounds, nobody offsides (${oob} oob, ${offside} offside)`);
  check(drift === 0, 'the base table is never mutated');
  check(unmoved === 0, 'every authored row actually moves somebody');
  check(variationLayoutSlots(OFF_FIELD_LAYOUTS['Spread'].slots, 'no_such_key') === null, 'unknown key → null (base fallback)');
}

hdr('L2 — the diagrams draw the authored look');
{
  let differ = 0, nan = 0, total = 0;
  for (const [fid, vset] of Object.entries(FORMATION_VARIATIONS)) {
    const baseSvg = renderFormationDiagram(fid, { w: 150, h: 96 });
    for (const vk of Object.keys(vset)) {
      total++;
      const vSvg = renderFormationDiagram(fid, { variation: vk, w: 150, h: 96 });
      if (vSvg && vSvg !== baseSvg) differ++;
      if (/NaN/.test(vSvg)) nan++;
    }
  }
  check(differ === total, `every look's diagram differs from base (${differ}/${total})`);
  check(nan === 0, `no NaN coordinates (${nan})`);
  const card = renderPlayCard(['go', 'drag', 'curl'], { formation: 'Spread', variation: 'trips', w: 150, h: 92 });
  check(typeof card === 'string' && card.includes('svg') && !/NaN/.test(card), 'renderPlayCard accepts a look');
}

hdr('L3 — one resolver, lawful assignments');
{
  const slots = OFF_FIELD_LAYOUTS['Spread'].slots;
  const { resolved } = resolveComposedReceivers(['go', 'drag', 'screen', 'curl'], [{ slot: 'WR_Z', flip: true }, {}, {}, {}], slots);
  const ids = resolved.map((r) => r.slot && r.slot.id);
  check(resolved.length === 4 && ids.every(Boolean), 'every route got a receiver');
  check(new Set(ids).size === ids.length, 'no receiver runs two routes');
  check(ids[0] === 'WR_Z' && resolved[0].flip === true, 'explicit pick (WR_Z, flipped) honored');
  const scr = resolved[2];
  check(scr.slot.pos === 'RB', `the screen fell to a back (${scr.slot.id})`);
}

hdr('L4/L5 — a real snap animates as drawn; unseeded snaps are untouched');
{
  const genRoster = (t, s) => {
    const r = [];
    for (const [pos, c] of Object.entries(ROSTER_TARGETS)) {
      for (let i = 0; i < c; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], t); p.schoolId = s; r.push(p); }
    }
    return r;
  };
  const mk = () => ({ offFormations: [{ id: 'Spread', weight: 100 }], tendency: 'Balanced', rushInPct: 55, passDepth: { short: 30, medium: 50, deep: 20 }, blitzPct: 25, fourthDown: 'Moderate', baseTempo: 'Normal', maxFGDist: 42 });
  const rH = genRoster(1, 'H'), rA = genRoster(1, 'A');
  const res = simulateGame({ id: 'H', name: 'H' }, { id: 'A', name: 'A' }, rH, rA, buildDepthChart(rH, mk()), buildDepthChart(rA, mk()), mk(), mk());
  const plays = (res.drives || []).flatMap((d) => d.plays || []);
  const snap = plays.find((p) => String(p.type).startsWith('pass') && p.complete && !p.isScreen && !p.isScramble && p.offFormation === 'Spread');
  check(!!snap, 'found a real completed Spread pass snap');
  if (snap) {
    const offS = OFF_FIELD_LAYOUTS['Spread'].slots, defS = (DEF_FIELD_LAYOUTS[snap.defFront] || DEF_FIELD_LAYOUTS['4-3']).slots;
    // L5 first: unseeded === null-seeded, byte-for-byte.
    const clean = JSON.parse(JSON.stringify(snap));
    const s0 = JSON.stringify(buildPlayScript(clean, offS, defS));
    clean._composedRoutes = null;
    const s0b = JSON.stringify(buildPlayScript(clean, offS, defS));
    check(s0 === s0b, 'a null seed builds a byte-identical script (non-composed plays untouched)');
    // L4: seed the draw-up — authored routes on non-target slots + a blocker.
    const seeded = JSON.parse(JSON.stringify(snap));
    const { resolved } = resolveComposedReceivers(['wheel', 'drag', 'curl', 'go'], [], offS);
    const bySlot = {};
    for (const r of resolved) if (r.slot) bySlot[r.slot.id] = { part: r.id, flip: false };
    // flip one authored non-target wide to prove the mirror; block another.
    const nonTgt = Object.keys(bySlot).filter((sid) => sid !== seeded.targetSlotId && offS.find((s) => s.id === sid && s.pos !== 'RB'));
    const flipId = nonTgt[0] || null;
    if (flipId) bySlot[flipId].flip = true;
    const blockId = nonTgt[1] || null;
    if (blockId) delete bySlot[blockId];
    seeded._composedRoutes = { bySlot, blocks: blockId ? [blockId] : [] };
    const sc = buildPlayScript(seeded, offS, defS);
    check(!!sc, 'the seeded snap builds a script');
    const cues = (sc && sc.routeCues) || [];
    let shapeMiss = 0, checked = 0;
    for (const [sid, a] of Object.entries(bySlot)) {
      const cue = cues.find((c) => c.id === sid);
      if (!cue) continue; // the target's screen-flavor exception can reshape him
      if (sid === seeded.targetSlotId) continue; // recorded double-move can reshape the target
      checked++;
      if (cue.shape !== COMPOSED_SHAPE[a.part]) { shapeMiss++; console.log(`    SHAPE MISS: ${sid} drew ${cue.shape}, authored ${a.part}`); }
    }
    check(checked > 0 && shapeMiss === 0, `${checked} authored non-target routes drew their own shapes (${shapeMiss} misses)`);
    if (blockId) check(!cues.find((c) => c.id === blockId), `the drawn blocker ${blockId} has no route cue (stays in)`);
    if (flipId) {
      const cue = cues.find((c) => c.id === flipId);
      const slot = offS.find((s) => s.id === flipId);
      // the flip mirrors the break: direction must be the OPPOSITE of the
      // unflipped build for the same slot.
      const unflipped = JSON.parse(JSON.stringify(snap));
      const bySlot2 = JSON.parse(JSON.stringify(bySlot));
      bySlot2[flipId].flip = false;
      unflipped._composedRoutes = { bySlot: bySlot2, blocks: blockId ? [blockId] : [] };
      const cue2 = (buildPlayScript(unflipped, offS, defS).routeCues || []).find((c) => c.id === flipId);
      const bothTurn = cue && cue2 && cue.direction !== 'straight' && cue2.direction !== 'straight';
      check(!bothTurn || cue.direction !== cue2.direction, `the flip mirrors ${flipId}'s break (${cue2 && cue2.direction} → ${cue && cue.direction})`);
    }
    // determinism of the seeded build
    check(JSON.stringify(buildPlayScript(seeded, offS, defS)) === JSON.stringify(sc), 'seeded build is deterministic');
  }
}

console.log(`\nDRAW UP PROBE — ${pass} pass, ${fail} fail`);
console.log(fail ? 'DRAW UP PROBE FAIL' : 'DRAW UP PROBE PASS');
process.exit(fail ? 1 : 0);
