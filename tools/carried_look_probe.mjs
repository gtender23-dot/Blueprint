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
import { carriedOffLooks, goalLineLookFor, goalLineFormations, lookSheetKey } from '../js/engine/playbook.js';
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
  check(/const live = carriedOffLooks\(gp, \{ all: true \}\);/.test(gpv), 'the situations picker offers carried looks');
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

// ── §6 the hole that narrowing the offer opens ──────────────────────────────
hdr('L6 — everything that can TAKE THE FIELD is assignable (both sides)');
{
  // The trap: limiting the Depth Chart to the STANDING set would strand any
  // look a SITUATION pins. A situational package fields its look for real, so
  // an older save that pinned a goal-line look under the unrestricted picker
  // would field an eleven the coach could no longer assign anybody to — the
  // very "it plays but you can't coach it" class this change set kills.
  const gp = {
    offFormations: [{ id: 'Spread', weight: 60 }, { id: 'Air Raid', weight: 40 }],
    defBaseFront: 'Nickel',
    defFrontMix: { Nickel: 70, Dime: 30 },
    situations: {
      goal_line: { offFormations: [{ id: 'Wildcat', weight: 100 }], defFront: '5-2' },
      third_long: { offFormations: [{ id: 'Flexbone', weight: 100, variation: 'trips' }] }
    }
  };
  const field = carriedOffLooks(gp, { withSituations: true }).map((l) => l.key);
  check(field.includes('Wildcat'), 'a situationally pinned formation is assignable on the depth chart', field.join(', '));
  check(field.includes('Flexbone|trips'), 'a situational pin keeps its VARIATION into the depth chart');
  const dfield = carriedDefFronts(gp, { withSituations: true });
  check(dfield.includes('5-2'), 'a situationally pinned FRONT is assignable too — the defensive twin', dfield.join(', '));

  // …while the situations PICKER still offers only the standing set, so new
  // pins stay clean. (The panel additionally lists whatever the cell already
  // pins, so an old pin can be cleared — asserted statically below.)
  const offer = carriedOffLooks(gp, { all: true }).map((l) => l.key);
  check(!offer.includes('Wildcat'), 'the situations picker does NOT offer an uncarried look as a new choice');
  check(!carriedDefFronts(gp).includes('5-2'), 'nor an uncarried front');

  const dc = src('js/ui/views/depthchart.js');
  check(/carriedOffLooks\(gp, \{ withSituations: true \}\)/.test(dc), 'the depth chart asks for the can-take-the-field set (offense)');
  check(/carriedDefFronts\(gp, \{ withSituations: true \}\)/.test(dc), 'the depth chart asks for the can-take-the-field set (defense)');

  const gpv = src('js/ui/views/gameplan.js');
  check(!/\$\{PIN_FRONTS\.map\(\(fr\) => `/.test(gpv), 'the situations DEFENSE picker no longer lists all eleven fronts');
  check(/carriedDefFronts\(gp\)\.filter\(\(fr\) => PIN_FRONTS\.includes\(fr\)\)/.test(gpv),
    'it lists the fronts the defbook calls');
  check(/!live\.includes\(cell\.defFront\)/.test(gpv), 'a front this cell ALREADY pins stays listed, so an old pin can be cleared');
  check(/an older pin the standing plan no longer carries/.test(gpv), 'same courtesy on the offensive grid');
}

// ── §7 the goal-line package ────────────────────────────────────────────────
hdr('L7 — every team has a goal-line package, and it takes the field');
{
  // Measured before this landed: Ground & Pound (the ONLY shipped book carrying
  // Jumbo) ran it on 17% of goal-line snaps against a 20% standing weight — no
  // situational lean whatever — and the Air Raid book lined up EMPTY on 18% of
  // its snaps inside the 5. The defense has auto-subbed a 5-2 wall inside the 1
  // for months; the offense had no equivalent.
  const books = {
    airRaid: [{ id: 'Air Raid', weight: 40 }, { id: 'Air Raid', weight: 20, variation: 'empty' }, { id: 'Spread', weight: 25 }, { id: 'Empty', weight: 15 }],
    ground: [{ id: 'Power-I', weight: 40 }, { id: 'Single Back', weight: 25 }, { id: 'Jumbo', weight: 20 }],
    pureSpread: [{ id: 'Air Raid', weight: 60 }, { id: 'Empty', weight: 40 }]
  };
  const gl = (f) => goalLineLookFor({ offFormations: f });
  check(gl(books.ground).key === 'Jumbo', 'a team carrying a true goal-line package uses it', gl(books.ground).key);
  check(gl(books.airRaid).key === 'Spread|ace',
    'a spread team SUBS PERSONNEL into a look it already runs rather than being handed a jumbo set', gl(books.airRaid).key);
  const fb = gl(books.pureSpread);
  check(fb.added === true && fb.key === 'Single Back|heavy',
    'a team carrying nothing heavy at all is handed 13 personnel — flagged as added', fb.key);
  // every shipped-style plan resolves to SOMETHING, always
  check([books.airRaid, books.ground, books.pureSpread].every((f) => !!gl(f)), 'the derivation is total — no plan is left without one');

  // DERIVED, not stored: it must not mutate the plan (no save migration).
  const plan = { offFormations: JSON.parse(JSON.stringify(books.ground)) };
  const before = JSON.stringify(plan);
  goalLineLookFor(plan); goalLineFormations(plan, 0.6);
  check(JSON.stringify(plan) === before, 'deriving the package does not mutate the plan — nothing to migrate, nothing to rot');

  // the AUTO weighting
  const set = goalLineFormations({ offFormations: books.ground }, 0.6);
  const top = set.slice().sort((a, b) => b.weight - a.weight)[0];
  check(top.id === 'Jumbo' && Math.round(top.weight) === 60, 'AUTO goal line weights the package to the configured share',
    set.map((f) => `${f.id} ${Math.round(f.weight)}`).join(' · '));
  check(Math.abs(set.reduce((t, f) => t + f.weight, 0) - 100) < 0.01, 'the goal-line set still sums to 100');
  check(set.length > 1, 'the base offense still shows up — it is a lean, not a lockout');
  const only = goalLineFormations({ offFormations: [{ id: 'Jumbo', weight: 100 }] }, 0.6);
  check(only.length === 1 && only[0].weight === 100, 'a team whose only look IS the package keeps it at full weight');

  // the seam: situations, NOT the efficiency table (no double-dip)
  const sit = src('js/engine/situations.js');
  check(/sitKey === "goal_line" \? goalLineFormations/.test(sit), 'AUTO goal line resolves at getEffectivePlan');
  check(/\(_a = cell\.offFormations\) != null \? _a/.test(sit), "the coach's own pin is still checked FIRST and outranks the default");
  const fm = src('js/engine/formations.js');
  check(!/FORMATION_SITUATIONAL[\s\S]{0,400}rollFormationEntry/.test(fm),
    'the efficiency table was NOT repurposed to drive call rate — that would double-count');

  // the AI gap
  const ai = src('js/engine/ai.js');
  check(/const glLook = goalLineLookFor\(/.test(ai), 'the AI pins the same derived package (it never checked has("Jumbo"))');

  // and it is COACHABLE — the standing rule
  const dcSet = carriedOffLooks({ offFormations: books.airRaid }, { withSituations: true }).map((l) => l.key);
  check(dcSet.includes('Spread|ace'), 'the goal-line package is assignable on the depth chart', dcSet.join(', '));
}

// ── §8 goal to go ───────────────────────────────────────────────────────────
hdr('L8 — GOAL TO GO: you never need more yards than the end zone is away');
{
  // Found while giving the DEFENSE its goal-line answer. The main first-down
  // path in the whole sim set `distance = 10` flat, so a team that moved the
  // chains at the 3 got "1st & 10" with three yards of field left. Measured on
  // the pre-fix tree: 86% of snaps inside the 5 carried an impossible distance,
  // 149 of 251 reading literally "and 10".
  //
  // It was never cosmetic. `distance` drives the play caller, the situation
  // resolver, the 4th-down decision and the DEFENSIVE front picker, whose
  // heavy-package rule is `down >= 3 && distance <= 2`. Pinned at 10, that rule
  // could not fire at the goal line: the defense sat in a 4-3 on 94% of
  // first-and-goal snaps and 83% of heavy-offense goal-line snaps went
  // unmatched. Fixing the distance fixed the defense — no new rule needed.
  const sim = src('js/engine/sim.js');
  const flat = (sim.match(/^\s*distance = 10;/gm) || []).length;
  check(flat === 0, 'no first-down path hands out a flat 10 any more', `${flat} left`);
  check((sim.match(/distance = Math\.min\(10, 100 - fieldPos\)/g) || []).length >= 3,
    'every new set of downs is goal-to-go aware');

  const { ROSTER_TARGETS, CLASS_YEARS } = await import('../js/constants.js');
  const { createPlayer } = await import('../js/engine/player.js');
  const { buildDepthChart, defaultGameplan } = await import('../js/engine/world.js');
  const { simulateGame } = await import('../js/engine/sim.js');
  const realRnd = Math.random;
  const mul = (sd) => { let t = sd >>> 0; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ t >>> 15, 1 | t); r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r; return ((r ^ r >>> 14) >>> 0) / 4294967296; }; };
  const rost = (id) => { const r = []; for (const [ps, c] of Object.entries(ROSTER_TARGETS)) for (let i = 0; i < c; i++) { const x = createPlayer(ps, CLASS_YEARS[i % 4], 1); x.schoolId = id; r.push(x); } return r; };
  let impossible = 0, snaps = 0, heavyTot = 0, heavyUnmatched = 0;
  for (let i = 0; i < 12; i++) {
    Math.random = mul(9100 + i);
    try {
      const rH = rost('H'), rA = rost('A');
      const g = () => ({ ...defaultGameplan() });
      const gpH = g(), gpA = g();
      const res = simulateGame({ id: 'H' }, { id: 'A' }, rH, rA, buildDepthChart(rH, gpH), buildDepthChart(rA, gpA), gpH, gpA);
      for (const d of res.drives || []) for (const pl of d.plays || []) {
        if (pl.fieldPos == null || pl.fieldPos < 95 || !pl.offFormation || !(pl.down >= 1 && pl.down <= 4)) continue;
        snaps++;
        if (pl.distance > 100 - pl.fieldPos) impossible++;
        const oHeavy = ['Jumbo', 'Power-I', 'Wishbone', 'Wildcat'].includes(pl.offFormation) || (pl.variation && /big|heavy/.test(pl.variation));
        if (oHeavy) { heavyTot++; if (!['5-2', '46/Bear'].includes(pl.defFront)) heavyUnmatched++; }
      }
    } finally { Math.random = realRnd; }
  }
  check(snaps > 20, `sampled real goal-line snaps (${snaps})`);
  check(impossible === 0, 'ZERO impossible distances inside the 5', `${impossible}/${snaps}`);
  // The payoff: the defense's own heavy rule now reaches the goal line.
  check(heavyTot === 0 || heavyUnmatched / heavyTot < 0.5,
    'the defense MATCHES heavy personnel at the goal line more often than not',
    `${heavyUnmatched}/${heavyTot} unmatched`);
}

// ── §9 the field shrinks ────────────────────────────────────────────────────
hdr('L9 — the route tree cannot outrun the end zone');
{
  // routeYds was drawn from C.PASS_YARDS with no idea where the ball was, so
  // the tree at the 3 was statistically IDENTICAL to the one at midfield
  // (deep attempts 10% inside the 5 vs 11% at 51+). Measured consequence:
  // 12.5% of throws inside the 10 flew past the BACK of the end zone and every
  // one was completed — caught out of bounds. Longest from inside the 5: 31
  // air yards, eighteen beyond the back line.
  const sim = src('js/engine/sim.js');
  check(/roomToBackLine/.test(sim), 'the pass resolver knows how much field is left');
  check(/\(100 - fieldPos\) \+ 10/.test(sim), 'the boundary is the BACK of the end zone — ten yards deep, not the goal line');
  check(/VDEEP_MIN_ROOM/.test(sim), 'the over-the-shoulder deep ball needs grass to exist');

  const { ROSTER_TARGETS, CLASS_YEARS } = await import('../js/constants.js');
  const { createPlayer } = await import('../js/engine/player.js');
  const { buildDepthChart, defaultGameplan } = await import('../js/engine/world.js');
  const { simulateGame } = await import('../js/engine/sim.js');
  const realRnd = Math.random;
  const mul = (sd) => { let t = sd >>> 0; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ t >>> 15, 1 | t); r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r; return ((r ^ r >>> 14) >>> 0) / 4294967296; }; };
  const rost = (id) => { const r = []; for (const [ps, c] of Object.entries(ROSTER_TARGETS)) for (let i = 0; i < c; i++) { const x = createPlayer(ps, CLASS_YEARS[i % 4], 1); x.schoolId = id; r.push(x); } return r; };
  let atts = 0, past = 0, maxAir = 0;
  for (let i = 0; i < 25; i++) {
    Math.random = mul(6200 + i);
    try {
      const rH = rost('H'), rA = rost('A');
      const gpH = { ...defaultGameplan() }, gpA = { ...defaultGameplan() };
      const res = simulateGame({ id: 'H' }, { id: 'A' }, rH, rA, buildDepthChart(rH, gpH), buildDepthChart(rA, gpA), gpH, gpA);
      for (const d of res.drives || []) for (const pl of d.plays || []) {
        if (pl.fieldPos == null || !pl.offFormation || !(pl.down >= 1 && pl.down <= 4)) continue;
        if (!(pl.type || '').startsWith('pass') || pl.airYds == null) continue;
        const ytg = 100 - pl.fieldPos;
        if (ytg > 10) continue;
        atts++;
        if (pl.airYds > ytg + 10) past++;
        if (ytg <= 5) maxAir = Math.max(maxAir, pl.airYds);
      }
    } finally { Math.random = realRnd; }
  }
  check(atts > 20, `sampled throws inside the 10 (${atts})`);
  check(past === 0, 'NO throw is caught past the back of the end zone', `${past}/${atts}`);
  check(maxAir === 0 || maxAir <= 15, 'the longest throw from inside the 5 fits the field', `${maxAir} air yds`);
}

console.log(`\nCARRIED LOOK PROBE — ${pass} pass, ${fail} fail`);
console.log(fail ? 'CARRIED LOOK PROBE FAIL' : 'CARRIED LOOK PROBE PASS');
process.exit(fail ? 1 : 0);
