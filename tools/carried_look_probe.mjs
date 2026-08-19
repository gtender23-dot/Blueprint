// carried_look_probe.mjs — THE SCREEN OFFERS WHAT THE TEAM CARRIES (2026-08-19).
//
// Owner ask: "limit them to only selected formation variation in their
// playbooks offense and defense and then same thing for situations."
//
// Three surfaces offered formations from GLOBAL tables instead of the team's
// plan, and all three predate the playbook:
//
//   Depth Chart offense   Object.keys(OFF_FIELD_LAYOUTS)  — every formation in
//                         the game, while the screen's own empty-state text
//                         said "Pick your package on the Game Plan screen".
//   Depth Chart defense   Object.keys(DEF_FIELD_LAYOUTS)  — every front, so you
//                         could pin an eleven into a front you never call.
//   Situations            Object.keys(FORMATIONS)         — every formation, and
//                         no concept of a variation at all.
//
// Underneath sat a worse one. resolveOffField takes a `variation` argument and
// the SIM passes it (sim.js `offVar`); all four Depth Chart call sites omitted
// it. So for a re-dressed look the screen resolved BASE personnel while the
// game fielded the variation's — Flexbone Trips dresses RB_H as a slot receiver
// (ABACK/A → SLOT/SL), and the depth chart offered A-backs for it. That is a
// straight breach of the depth-chart↔field↔sim agreement in CLAUDE.md: hop 1
// (who the picker offers) and hop 3 (who the sim fields) disagreed.
//
// Run: node tools/carried_look_probe.mjs
import { readFileSync } from 'fs';
import { FORMATION_VARIATIONS } from '../js/constants.js';
import { carriedOffLooks, lookSheetKey } from '../js/engine/playbook.js';
import { carriedDefFronts } from '../js/engine/formations.js';
import { offFieldSlots, resolveOffField } from '../js/engine/fieldassign.js';

let pass = 0, fail = 0;
const check = (ok, msg, detail = '') => {
  if (ok) pass++; else fail++;
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}${detail ? `  [${detail}]` : ''}`);
};
const hdr = (t) => console.log(`\n${t}`);
const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

// ── §1 the offensive look set ───────────────────────────────────────────────
hdr('L1 — carriedOffLooks: the ONE answer to "what do we carry?"');
{
  const gp = {
    offFormations: [
      { id: 'Flexbone', weight: 60, variation: 'trips' },
      { id: 'Power-I', weight: 40, variation: 'big' },
      { id: 'Spread', weight: 0 },                      // dialled to zero
      { id: 'Flexbone', weight: 10, variation: 'trips' }, // duplicate look
      { id: 'Ghost Formation', weight: 20 },            // not a formation
      { id: 'Wishbone', weight: 15, variation: 'nope' } // variation not in data
    ]
  };
  const looks = carriedOffLooks(gp);
  const keys = looks.map((l) => l.key);
  check(keys.length === new Set(keys).size, `no duplicate looks (${keys.length})`, keys.join(', '));
  check(!keys.includes('Spread'), 'a zero-weight look is not offered');
  check(!keys.some((k) => k.startsWith('Ghost')), 'an unknown formation is dropped');
  check(keys.includes('Wishbone'), 'a look whose variation no longer exists falls back to BASE, not a ghost');
  check(looks.every((l) => l.key === lookSheetKey(l.id, l.variation)),
    'the look key IS the book sheet key — the depth chart and the call sheet name the same thing');
  const tri = looks.find((l) => l.key === 'Flexbone|trips');
  check(!!tri && /·/.test(tri.label) && tri.variation === 'trips', 'a variation look carries its own label', tri && tri.label);
  // `all` keeps zero-weight entries (the Game Plan screen shows what you own)
  check(carriedOffLooks(gp, { all: true }).some((l) => l.key === 'Spread'), 'opts.all keeps a zero-weight look');
  // the empty plan still yields something pinnable
  check(carriedOffLooks({}).length === 1, 'an empty plan still offers one look — the screen is never blank');
}

// ── §2 the defensive front set ──────────────────────────────────────────────
hdr('L2 — carriedDefFronts: the fronts the defbook actually calls');
{
  const fronts = carriedDefFronts({ defBaseFront: '4-3', defFrontMix: { Nickel: 40, '3-4': 20, Bogus: 50 } });
  check(fronts[0] === '4-3', 'the identity front leads — selectDefFront falls back to it, so it must be pinnable', fronts.join(', '));
  check(fronts.includes('Nickel') && fronts.includes('3-4'), 'every front in the mix is offered');
  check(!fronts.includes('Bogus'), 'a front the game does not define is dropped');
  const hard = carriedDefFronts({ defFront: 'Penny', defBaseFront: '4-3', defFrontMix: {} });
  check(hard[0] === 'Penny', 'a HARD front dial wins the identity slot over the base front', hard.join(', '));
  check(carriedDefFronts({}).length === 1, 'a bare plan still offers a front');
}

// ── §3 the bug underneath: the variation argument changes who is fielded ─────
hdr('L3 — the variation argument is not cosmetic');
{
  // Find every variation that actually re-dresses a body, so this section keeps
  // testing something real if the layouts are re-authored.
  const redressed = [];
  for (const [fid, vars] of Object.entries(FORMATION_VARIATIONS)) {
    for (const vk of Object.keys(vars)) {
      const base = offFieldSlots(fid, null), dressed = offFieldSlots(fid, vk);
      if (!base || !dressed) continue;
      const diff = base.filter((s, i) => s.pos !== dressed[i].pos || s.role !== dressed[i].role);
      if (diff.length) redressed.push({ fid, vk, diff: diff.map((s) => s.id) });
    }
  }
  check(redressed.length > 0, `variations that re-dress a body exist (${redressed.length})`,
    redressed.slice(0, 4).map((r) => `${r.fid}|${r.vk}:${r.diff.join('+')}`).join(' · '));

  const base = offFieldSlots('Flexbone', null), trips = offFieldSlots('Flexbone', 'trips');
  const rbBase = base.find((s) => s.id === 'RB_H'), rbTrips = trips.find((s) => s.id === 'RB_H');
  check(rbBase.pos !== rbTrips.pos, 'Flexbone Trips re-dresses RB_H — the exact case the depth chart got wrong',
    `${rbBase.pos}/${rbBase.label} → ${rbTrips.pos}/${rbTrips.label}`);

  // Slot IDs must NEVER change, or assignments keyed by formation would not
  // ride across looks and every pin would need a save migration.
  let idsStable = true;
  for (const r of redressed) {
    const a = offFieldSlots(r.fid, null).map((s) => s.id).join(',');
    const b = offFieldSlots(r.fid, r.vk).map((s) => s.id).join(',');
    if (a !== b) idsStable = false;
  }
  check(idsStable, 'slot IDs are identical across every variation — pins ride looks without a migration');

  // Catch eligibility is likewise stable: that is WHY the target-share handlers
  // may keep reading the base slots.
  let catchStable = true;
  for (const r of redressed) {
    const a = offFieldSlots(r.fid, null).filter((s) => s.catch).map((s) => s.id).join(',');
    const b = offFieldSlots(r.fid, r.vk).filter((s) => s.catch).map((s) => s.id).join(',');
    if (a !== b) catchStable = false;
  }
  check(catchStable, 'catch eligibility is identical across variations — the share sliders are safe on base slots');

  // And the resolver really does field different men.
  const depth = { QB: ['q1'], RB: ['r1', 'r2', 'r3'], WR: ['w1', 'w2', 'w3', 'w4'], TE: ['t1', 't2'], OL: ['o1', 'o2', 'o3', 'o4', 'o5'], FB: ['f1'] };
  const posOf = (id) => ({ q: 'QB', r: 'RB', w: 'WR', t: 'TE', o: 'OL', f: 'FB' }[id[0]]);
  const a = resolveOffField('Flexbone', {}, {}, depth, null, posOf, null, null);
  const b = resolveOffField('Flexbone', {}, {}, depth, null, posOf, null, 'trips');
  check(JSON.stringify(a && a.bySlot) !== JSON.stringify(b && b.bySlot) ||
        JSON.stringify(a && a.personnel) !== JSON.stringify(b && b.personnel),
    'resolveOffField fields a DIFFERENT eleven with the variation than without — omitting it was a real defect');
}

// ── §4 the surfaces are wired to the plan, not to the global tables ─────────
hdr('L4 — no screen offers from a global table any more');
{
  const dc = src('js/ui/views/depthchart.js');
  const gpv = src('js/ui/views/gameplan.js');

  check(/carriedOffLooks\(/.test(dc), 'depth chart asks carriedOffLooks for its offensive pills');
  check(!/Object\.keys\(OFF_FIELD_LAYOUTS\)\.filter\(\(_fid\) => FORMATIONS\[_fid\]\)[\s\S]{0,80}selectedOff/.test(dc),
    'the "every formation in the game" offer is gone');
  check(/carriedDefFronts\(/.test(dc), 'depth chart asks carriedDefFronts for its defensive pills');
  check(!/\$\{Object\.keys\(DEF_FIELD_LAYOUTS\)\.map/.test(dc), 'the "every front in the game" pill strip is gone');
  check(/carriedOffLooks\(gp, \{ all: true \}\)\.map/.test(gpv), 'the situations picker offers carried looks');
  check(!/\$\{Object\.keys\(FORMATIONS\)\.map\(\(fid\) => \{/.test(gpv), 'the situations "every formation" grid is gone');

  // THE ONE THAT BIT: every offensive resolve on the screen passes a variation.
  // Match the WHOLE call — the argument list contains nested calls like
  // posById(school), so a lazy [^;]*? stops at the first inner paren.
  const calls = dc.match(/resolveOffField\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g) || [];
  const withVar = calls.filter((c) => /,\s*(vk|variation|activeOffVariation|varByFid\[fid\] \|\| null)\s*\)$/.test(c.trim()));
  check(calls.length > 0 && withVar.length === calls.length,
    `every resolveOffField call on the depth chart passes the variation (${withVar.length}/${calls.length})`,
    calls.filter((c) => !withVar.includes(c)).map((c) => c.slice(0, 60)).join(' | '));

  // and the screen draws the dressed slots, not the base ones
  check(/offFieldSlots\(/.test(dc), 'the depth chart draws the variation-resolved slots');
  const badLayout = /const layout = OFF_FIELD_LAYOUTS\[fid\];\s*\n\s*const entry = gp\.fieldAssignments/.test(dc);
  check(!badLayout, 'renderOffense no longer draws the BASE layout for a dressed look');
}

// ── §5 a situational pin can name a look, and the look reaches the sim ───────
hdr('L5 — a situational package pins a LOOK, and the sim honours it');
{
  const gpv = src('js/ui/views/gameplan.js');
  check(/cell\.offFormations\.push\(vk \?/.test(gpv), 'the situations handler stores the variation on the pinned entry');
  check(/f\.id === fid && \(f\.variation \|\| null\) === vk/.test(gpv),
    'selection is matched on the LOOK, so Flexbone and Flexbone-Trips are separate pins');
  // the sim reads the winning entry's variation — so the pin is not decoration
  const sim = src('js/engine/sim.js');
  check(/_rolledEntry \? _rolledEntry\.variation \|\| null/.test(sim),
    'sim.js takes the variation off the formation entry that won the roll');
}

console.log(`\nCARRIED LOOK PROBE — ${pass} pass, ${fail} fail`);
console.log(fail ? 'CARRIED LOOK PROBE FAIL' : 'CARRIED LOOK PROBE PASS');
process.exit(fail ? 1 : 0);
