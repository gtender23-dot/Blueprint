// formation_playbook_probe.mjs — Madden pass 2 (Aug 2026): formation-specific
// playbooks. Three laws, two levels:
//
//   1. CARRY GATE (mechanism, noise-free): concept selection is now gated by
//      FORMATION_PLAYBOOK on EVERY snap — AI included — not just coach-forced
//      ones. pickPassConcept with a formation's carry list never returns a play
//      the formation doesn't run, however hard the weights push one; an
//      impossible list falls back to the ungated pool instead of bricking.
//   2. FORMATION SHEET (game level, roster-paired arms): an authored
//      gp.formationPlaybooks[fid] overlays the global weights for that
//      formation's snaps — bench a play there (0) and it disappears from those
//      snaps even at global weight 95; feature one and it takes over.
//   3. GAME-LEVEL GATE: a Jumbo-only AI team never calls a non-gadget concept
//      Jumbo doesn't carry (Jumbo has a non-empty pool at every depth, so the
//      fallback never legitimately fires for it).
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame, pickPassConcept } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS, FORMATION_PLAYBOOK } from '../js/constants.js';
import { PASS_CONCEPTS, RUN_CONCEPTS } from '../js/concepts.js';

function gen(t, s) { const r = []; for (const [p, c] of Object.entries(ROSTER_TARGETS)) for (let i = 0; i < c; i++) { const x = createPlayer(p, CLASS_YEARS[i % 4], t); x.schoolId = s; r.push(x); } return r; }
const base = (o = {}) => ({ offFormations: [{ id: 'Spread', weight: 100 }], tendency: 'Balanced', rushInPct: 50, passDepth: { short: 30, medium: 45, deep: 25 }, blitzPct: 20, fourthDown: 'Moderate', baseTempo: 'Normal', maxFGDist: 42, ...o });
let fails = 0; const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) fails++; };

// ── 1. Mechanism: the carry gate, 30k noise-free reps ──
{
  const roster = gen(3, 'H');
  const dc = buildDepthChart(roster, base());
  const pers = { WR: dc.WR ? dc.WR.slice(0, 4) : [1, 2, 3, 4] };
  const carry = FORMATION_PLAYBOOK['Power-I'];             // no Four Verts, no Mesh
  const hot = { 'Four Verts': 95, 'Mesh': 95 };            // shove hard at uncarried plays
  let out = 0, none = 0; const seen = new Set();
  for (let i = 0; i < 30000; i++) {
    const r = pickPassConcept(i % 2 ? 'pass_deep' : 'pass_short', pers, roster, 'Cover 3', hot, null, carry);
    if (!r.name) { none++; continue; }
    seen.add(r.name);
    if (!carry.includes(r.name)) out++;
  }
  ok(out === 0 && none === 0, `carry gate holds under hostile weights (0 escapes in 30k, saw: ${[...seen].sort().join(', ')})`);
  const fb = pickPassConcept('pass_medium', pers, roster, 'Cover 3', null, null, ['No Such Play']);
  ok(!!fb.name, `impossible carry list falls back instead of bricking (picked ${fb.name})`);
}

// ── 2. Game level: the authored formation sheet redirects that formation's snaps ──
{
  const N = 12;
  const gpA = () => base({ conceptWeights: { 'Mesh': 95, 'Four Verts': 10 } });
  const gpB = () => base({ conceptWeights: { 'Mesh': 95, 'Four Verts': 10 }, formationPlaybooks: { Spread: { 'Mesh': 0, 'Four Verts': 95 } } });
  const count = (mk) => {
    const t = { mesh: 0, verts: 0, pass: 0, short: 0 };
    for (let i = 0; i < N; i++) {
      const rH = gen(2, 'H'), rA = gen(2, 'A');
      const gp = mk(), dgp = base();
      const res = simulateGame({ id: 'H' }, { id: 'A' }, structuredClone(rH), structuredClone(rA), buildDepthChart(rH, gp), buildDepthChart(rA, dgp), gp, dgp);
      for (const d of (res.drives || [])) if (d.possession === 'home') for (const p of (d.plays || [])) {
        if (p.offFormation !== 'Spread' || !String(p.type).startsWith('pass') || !p.concept) continue;
        t.pass++;
        if (p.type === 'pass_short') t.short++;
        if (p.concept === 'Mesh') t.mesh++;
        if (p.concept === 'Four Verts') t.verts++;
      }
    }
    return t;
  };
  const A = count(gpA), B = count(gpB);
  ok(A.mesh / Math.max(1, A.short) > 0.15, `control arm leans on the globally-featured play (Mesh ${A.mesh} of ${A.short} short-game snaps — it only competes inside its depth)`);
  ok(B.mesh === 0, `formation-benched play vanishes from that formation's snaps (Mesh ${B.mesh}/${B.pass}; global weight still 95)`);
  ok(B.verts > A.verts, `formation-featured play takes over (Four Verts ${A.verts} → ${B.verts})`);
}

// ── 3. Game level: an AI team never leaves its formation's book ──
{
  const nonGadget = new Set([
    ...Object.keys(PASS_CONCEPTS),
    ...Object.entries(RUN_CONCEPTS).filter(([, c]) => !c.resolver).map(([nm]) => nm)
  ]);
  const carry = new Set(FORMATION_PLAYBOOK['Jumbo']);
  let checked = 0; const escapes = [];
  for (let i = 0; i < 8; i++) {
    const rH = gen(2, 'H'), rA = gen(2, 'A');
    const gp = base({ offFormations: [{ id: 'Jumbo', weight: 100 }] }), dgp = base();
    const res = simulateGame({ id: 'H' }, { id: 'A' }, rH, rA, buildDepthChart(rH, gp), buildDepthChart(rA, dgp), gp, dgp);
    for (const d of (res.drives || [])) if (d.possession === 'home') for (const p of (d.plays || [])) {
      if (p.offFormation !== 'Jumbo' || !p.concept || !nonGadget.has(p.concept)) continue;
      checked++;
      if (!carry.has(p.concept)) escapes.push(p.concept);
    }
  }
  ok(checked > 50 && escapes.length === 0, `AI stays inside Jumbo's book across ${checked} snaps (escapes: ${escapes.length ? [...new Set(escapes)].join(', ') : 'none'})`);
}

// ── 4. PASS 6: AI-authored sheets — setAIGameplan writes real tilts, the
//       engine honors them, and __noAIFormSheets ignores exactly the stamped
//       ones (player-authored sheets untouched).
{
  const { setAIGameplan } = await import('../js/engine/ai.js');
  // (a) authoring: an option school's flexbone sheet features the option.
  let authored = 0, optionTilts = 0;
  for (let i = 0; i < 40; i++) {
    const school = { id: 'S' + i, name: 'S', roster: gen(2, 'S' + i), coach: { personality: { aggression: 0.5 } } };
    setAIGameplan(school);
    const gp = school.gameplan;
    if (!gp._aiAuthoredSheets) continue;
    const sheets = gp.formationPlaybooks || {};
    if (Object.keys(sheets).length) authored++;
    for (const [fid, sheet] of Object.entries(sheets)) {
      for (const [c, w] of Object.entries(sheet)) {
        if (!FORMATION_PLAYBOOK[fid] || !FORMATION_PLAYBOOK[fid].includes(c)) { authored = -999; console.log(`  ✗ ${fid} sheet carries un-booked ${c}`); }
        if ((fid === 'Wishbone' || fid === 'Flexbone') && (c === 'Triple Option' || c === 'Speed Option') && w >= 65) optionTilts++;
      }
    }
  }
  ok(authored > 10, `setAIGameplan authors sheets for carried formations (${authored}/40 staffs, every entry inside its book)`);
  // (b) the stamp + kill-switch: a stamped sheet is ignored under the switch,
  //     an identical unstamped (player) sheet is not. Direct A/B via games.
  const N = 8;
  const mkGp = (stamp) => base({ conceptWeights: { 'Mesh': 95, 'Four Verts': 10 }, formationPlaybooks: { Spread: { 'Mesh': 0, 'Four Verts': 95 } }, _aiAuthoredSheets: stamp });
  const meshCount = (stamp) => {
    let mesh = 0, pass = 0;
    for (let i = 0; i < N; i++) {
      const rH = gen(2, 'H'), rA = gen(2, 'A');
      const gp = mkGp(stamp), dgp = base();
      const res = simulateGame({ id: 'H' }, { id: 'A' }, rH, rA, buildDepthChart(rH, gp), buildDepthChart(rA, dgp), gp, dgp);
      for (const d of (res.drives || [])) if (d.possession === 'home') for (const p of (d.plays || [])) {
        if (p.offFormation !== 'Spread' || !String(p.type).startsWith('pass') || !p.concept) continue;
        pass++;
        if (p.concept === 'Mesh') mesh++;
      }
    }
    return { mesh, pass };
  };
  globalThis.__noAIFormSheets = true;
  const killedAI = meshCount(true);     // stamped → sheet ignored → Mesh returns
  const killedPlayer = meshCount(false); // unstamped → sheet honored → Mesh benched
  delete globalThis.__noAIFormSheets;
  ok(killedAI.mesh > 0, `__noAIFormSheets ignores STAMPED sheets (Mesh back: ${killedAI.mesh}/${killedAI.pass})`);
  ok(killedPlayer.mesh === 0, `…but honors player-authored sheets under the same switch (Mesh ${killedPlayer.mesh}/${killedPlayer.pass})`);
}

console.log('');
console.log(fails ? `FORMATION PLAYBOOK PROBE: ${fails} FAIL` : 'FORMATION PLAYBOOK PROBE PASS');
process.exit(fails ? 1 : 0);
