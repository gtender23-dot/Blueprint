// traits_probe.mjs — Identity stage 2 gates (Pass 4.5, IDENTITY_DESIGN §4, §8).
// Generation distribution (play 1–3 / bridge ~10% / flaws independent of
// quality — the Borderlands rule), the __noTraits kill-switch, bridge fit
// math (eligibility waiver + archetype-distance zero + size-window stretch),
// the three-places law for a bridged hand-pick, and class-quality neutrality
// (per-division attribute distributions untouched by the trait system).
// Run: node tools/traits_probe.mjs
import { createRecruit, createPlayer } from '../js/engine/player.js';
import {
  BRIDGE_CATALOG, PLAY_CATALOG, FLAW_CATALOG,
  traitLv, flawLv, bridgeCoversSlot, bridgeWaivesRole, bridgeWaivesBucket,
  sizeFitForSlot, rollTraits
} from '../js/engine/traits.js';
import { resolveSlots } from '../js/engine/fieldassign.js';
import { SIZE_BANDS } from '../js/constants.js';

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};

// resolveSlots isn't exported — go through resolveDefField instead.
const { resolveDefField } = await import('../js/engine/fieldassign.js');

// ── 1: generation distribution ──────────────────────────────────────────────
const N = 5000;
const recruits = [];
for (const pos of ['QB', 'RB', 'WR', 'TE', 'OL', 'DE', 'DT', 'OLB', 'LB', 'CB', 'S']) {
  for (let i = 0; i < N / 11; i++) recruits.push(createRecruit(pos, 1 + (i % 3)));
}
check('every new player carries a trait block', recruits.every((r) => r.traits && Array.isArray(r.traits.play)));
const nPlay = recruits.map((r) => r.traits.play.length);
check('play traits 1–3 at generation', nPlay.every((n) => n >= 1 && n <= 3), `mean ${(nPlay.reduce((a, b) => a + b) / nPlay.length).toFixed(2)}`);
const bridgeRate = recruits.filter((r) => r.traits.bridge).length / recruits.length;
check('bridge rate ~10% (6–16%)', bridgeRate > 0.06 && bridgeRate < 0.16, `${(bridgeRate * 100).toFixed(1)}%`);
const lvs = recruits.flatMap((r) => r.traits.play.map((t) => t.lv));
const lv3 = lvs.filter((l) => l === 3).length / lvs.length;
check('level III rare (1–8%)', lv3 > 0.01 && lv3 < 0.08, `${(lv3 * 100).toFixed(1)}%`);
check('position-legal traits only', recruits.every((r) => r.traits.play.every((t) => PLAY_CATALOG[t.k] && PLAY_CATALOG[t.k].pos.includes(r.position))));
check('position-legal flaws only', recruits.every((r) => r.traits.flaws.every((t) => FLAW_CATALOG[t.k] && FLAW_CATALOG[t.k].pos.includes(r.position))));
check('position-legal bridges only', recruits.every((r) => !r.traits.bridge || BRIDGE_CATALOG[r.traits.bridge].pos.includes(r.position)));
// ruled-out traits stay out
check('Conditioned / Big Stage / Durable are OUT (owner ruling)', !PLAY_CATALOG.conditioned && !PLAY_CATALOG.bigStage && !PLAY_CATALOG.durable);

// ── 2: Borderlands rule — flaws independent of quality ──────────────────────
const sorted = recruits.slice().sort((a, b) => a.compositeRating - b.compositeRating);
const q1 = sorted.slice(0, Math.floor(sorted.length / 4));
const q4 = sorted.slice(-Math.floor(sorted.length / 4));
const flawRate = (arr) => arr.filter((r) => r.traits.flaws.length > 0).length / arr.length;
const fr1 = flawRate(q1), fr4 = flawRate(q4);
check('flaw incidence flat across quality (Δ < 5 pts)', Math.abs(fr1 - fr4) < 0.05, `bottom-q ${(fr1 * 100).toFixed(1)}% vs top-q ${(fr4 * 100).toFixed(1)}%`);
// class-quality neutrality: rolling traits never touches attributes
{
  const r = createRecruit('LB', 2);
  const before = JSON.stringify(r.attributes);
  rollTraits('LB', r.weight, SIZE_BANDS);
  check('rollTraits never touches attributes', JSON.stringify(r.attributes) === before);
}

// ── 3: kill-switch ──────────────────────────────────────────────────────────
const anyTraited = recruits.find((r) => r.traits.play.length > 0);
const k = anyTraited.traits.play[0].k;
globalThis.__noTraits = true;
check('__noTraits: traitLv reads 0', traitLv(anyTraited, k) === 0);
check('__noTraits: bridge fit waivers off', !bridgeCoversSlot({ traits: { bridge: 'spaceBacker' } }, { label: 'ROVER', mesh: 'SPACE' }));
delete globalThis.__noTraits;
check('live: traitLv reads the level', traitLv(anyTraited, k) >= 1);

// ── 4: bridge math ──────────────────────────────────────────────────────────
const sb = { position: 'OLB', weight: 226, traits: { bridge: 'spaceBacker', play: [], flaws: [] } };
const slot = { id: 'S_R', label: 'ROVER', pos: 'S', mesh: 'SPACE' };
check('Space Backer covers the SPACE mesh slot', bridgeCoversSlot(sb, slot));
check('Space Backer plays S-Hybrid at zero archetype distance', bridgeWaivesRole(sb, 'S-Hybrid'));
check('Space Backer waives the S bucket out-of-pos charge', bridgeWaivesBucket(sb, 'S'));
check('bridge stretches the size window (fit 1.0 at his frame)', sizeFitForSlot({ ...sb, weight: 245 }, slot) === 1);
check('no bridge, same frame: window prices him', sizeFitForSlot({ position: 'OLB', weight: 245, traits: { bridge: null } }, slot) < 1);

// ── 5: three-places law — a bridged hand-pick survives the resolver ─────────
{
  // Penny front has WAR (SPACE mesh). Build a depth where an OLB with the
  // bridge is hand-picked at a SPACE slot he could never reach natively.
  const mkP = (pos, id, bridge = null) => {
    const p = createPlayer(pos, 'JR', 2);
    p.id = id;
    p.traits = { bridge, play: [], flaws: [], earned: false };
    return p;
  };
  const roster = [
    mkP('OLB', 'olb-bridge', 'spaceBacker'),
    mkP('S', 's1'), mkP('S', 's2'), mkP('S', 's3'),
    mkP('CB', 'c1'), mkP('CB', 'c2'), mkP('CB', 'c3'),
    mkP('LB', 'l1'), mkP('LB', 'l2'),
    mkP('DE', 'd1'), mkP('DE', 'd2'), mkP('DT', 't1'), mkP('OLB', 'o1'), mkP('OLB', 'o2')
  ];
  const byId = Object.fromEntries(roster.map((p) => [p.id, p]));
  const activeDepth = {
    DE: ['d1', 'd2'], DT: ['t1'], OLB: ['o1', 'o2', 'olb-bridge'], LB: ['l1', 'l2'],
    CB: ['c1', 'c2', 'c3'], S: ['s1', 's2', 's3']
  };
  const playerPos = (id) => byId[id] ? byId[id].position : null;
  const playerById = (id) => byId[id] || null;
  // find a front with a SPACE-mesh slot
  const { DEF_FIELD_LAYOUTS } = await import('../js/constants_field.js');
  let frontId = null, spaceSlot = null;
  for (const [fid, lay] of Object.entries(DEF_FIELD_LAYOUTS)) {
    const sl = (lay.slots || []).find((sx) => sx.mesh === 'SPACE');
    if (sl) { frontId = fid; spaceSlot = sl; break; }
  }
  check('a SPACE-mesh slot exists in the layouts', !!spaceSlot, `${frontId}/${spaceSlot ? spaceSlot.id : '-'}`);
  const withById = resolveDefField(frontId, { [spaceSlot.id]: 'olb-bridge' }, {}, activeDepth, null, playerPos, playerById);
  check('bridged hand-pick ACCEPTED with playerById threaded', withById && withById.bySlot[spaceSlot.id] === 'olb-bridge', `got ${withById && withById.bySlot[spaceSlot.id]}`);
  const withoutById = resolveDefField(frontId, { [spaceSlot.id]: 'olb-bridge' }, {}, activeDepth, null, playerPos, null);
  check('same pick REFUSED without the bridge visible (old path intact)', withoutById && withoutById.bySlot[spaceSlot.id] !== 'olb-bridge', `got ${withoutById && withoutById.bySlot[spaceSlot.id]}`);
  globalThis.__noTraits = true;
  const killed = resolveDefField(frontId, { [spaceSlot.id]: 'olb-bridge' }, {}, activeDepth, null, playerPos, playerById);
  delete globalThis.__noTraits;
  check('__noTraits kills the waiver at the resolver too', killed && killed.bySlot[spaceSlot.id] !== 'olb-bridge', `got ${killed && killed.bySlot[spaceSlot.id]}`);
}

// ── 6: persistence shape ────────────────────────────────────────────────────
{
  const r = recruits[0];
  const round = JSON.parse(JSON.stringify(r.traits));
  check('trait block is plain-JSON round-trippable', JSON.stringify(round) === JSON.stringify(r.traits));
  const p = createPlayer('LB', 'SO', 2);
  check('createPlayer whitelist carries traits', !!p.traits && Array.isArray(p.traits.play));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
