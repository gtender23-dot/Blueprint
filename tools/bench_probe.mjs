// bench_probe.mjs — M1 THE TEST BENCH (the instrument), 2026-08-17.
// Run: node tools/bench_probe.mjs
//
// Pins the bench's laws:
//   B1  A KNOWN play vs a FORCED look runs through the REAL sim: the record
//       carries the concept, the coachCall + defCoachCall flags, the
//       formation, and a rolled coverage.
//   B2  The forced defensive LOOK is honored via the existing defCall
//       vocabulary: a pinned coverage family keeps its name on the record;
//       front/coverage/bring compile to the exact fields cardToDefCall emits.
//   B3  SAME ROLL AGAIN: the same seed replays a byte-identical record —
//       the probes' pinned-PRNG trick, now a player-facing control.
//   B4  TEAMS EVEN: the two scratch teams are attribute-identical position
//       for position (same pinned generation stream), flat tier-1 caliber,
//       distinct ids.
//   B5  ZERO SAVE WRITES: no localStorage traffic, and the bench module
//       never imports state/persistence (nothing can reach a save).
//   B6  A COMPOSED play (the Composer's payload) runs as itself.
//   B7  The forced VARIATION rides the call onto the record.
//   B8  The REAL watchphys viewer scripts the rep (buildPlayScript builds),
//       and the bench's game shell names the men on the record.
//   B9  ONE SHARED FITS-FUNCTION: fitting ⊆ legal; personnel rules hold
//       (no back-built plays with no backs, options need two backs); customs
//       never offer Wildcat/Jet.
//   B10 AUTO-SELECT seeds SHIPPED sheet weights, not flat ones.
const _lsLog = { set: 0, get: 0 };
const _ls = new Map();
global.localStorage = {
  getItem: (k) => { _lsLog.get++; return _ls.has(k) ? _ls.get(k) : null; },
  setItem: (k, v) => { _lsLog.set++; _ls.set(k, String(v)); },
  removeItem: (k) => _ls.delete(k),
};

const { benchSnap, bench, benchTeams, benchDefCall, benchLookOptions, benchOutcome, benchGameShell } = await import('../js/engine/bench.js');
const { legalConceptsForFormation, fittingConceptsForFormation, filterConceptsForPersonnel } = await import('../js/engine/playbook.js');
const { autoSheetForFormation, shippedSheetWeights, DEFAULT_OFF_BOOKS } = await import('../js/engine/defaultbooks.js');
const { compileFormation, emptyCustomFormation } = await import('../js/engine/formcompose.js');
const { FORMATION_PLAYBOOK, FORMATION_PACKAGES, FORMATION_VARIATIONS } = await import('../js/constants.js');
const { OFF_FIELD_LAYOUTS, DEF_FIELD_LAYOUTS } = await import('../js/constants_field.js');
const { buildPlayScript } = await import('../js/ui/watchphys.js');
const fs = await import('node:fs');

let pass = 0, fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}`); ok ? pass++ : fail++; };
const hdr = (s) => console.log(`\n${s}`);

// run until the seed lands a real snap (a pre-snap flag is an honest rep the
// bench REPORTS; the probe just wants a scrimmage snap to inspect).
function realSnap(o, seed0 = 11) {
  for (let s = seed0; s < seed0 + 24; s++) {
    const r = benchSnap({ ...o, seed: s });
    if (r.real) return r;
  }
  return null;
}
const LOOK = { front: '4-3', coverage: 'c3', bring: '5' };

hdr('B1 — a known play vs a forced look runs through the real sim');
{
  const r = realSnap({ formationId: 'Spread', concept: 'Mesh', defLook: LOOK });
  check(!!r, 'a seed lands a real scrimmage snap');
  if (r) {
    const p = r.play;
    check(p.concept === 'Mesh', `the record ran the forced concept (${p.concept})`);
    check(p.coachCall === true, 'coachCall flag set (one forced call, one snap)');
    check(p.defCoachCall === true, 'defCoachCall flag set (the forced look was applied)');
    check(p.offFormation === 'Spread', `the record fielded the forced formation (${p.offFormation})`);
    check(typeof r.rolled === 'string' && r.rolled.length > 0, `a coverage was rolled and recorded (${r.rolled})`);
    check(typeof benchOutcome(p) === 'string' && benchOutcome(p).length > 0, `outcome line reads (${benchOutcome(p)})`);
  }
}

hdr('B2 — the forced look is honored (defCall vocabulary, families pinned)');
{
  const dc = benchDefCall({ front: '3-4', coverage: 'c1', bring: '6' });
  check(dc.front === '3-4' && dc.covShell === 'single' && dc.covStyle === 'man' && dc.aggression === 'house',
    'front + Cover 1 picture + Bring the House compile to the exact engine fields');
  const dc3 = benchDefCall({ front: 'Dime', coverage: 'tampa2', bring: '3' });
  check(dc3.covFamily === 'Tampa 2' && dc3.rush3 === true, 'Tampa 2 picture pins the family; Rush 3 sets rush3');
  const r = realSnap({ formationId: 'Spread', concept: 'Four Verts', defLook: { front: 'Nickel', coverage: 'tampa2', bring: '4' } }, 31);
  check(!!r && r.play.coverage === 'Tampa 2', `a pinned family keeps its name on the ledger (rolled ${r && r.play.coverage})`);
  const opts = benchLookOptions();
  check(opts.coverages.length === 8 && opts.brings.length === 4 && opts.fronts.length > 0,
    `the picker speaks the catalog (8 pictures, 4 brings, ${opts.fronts.length} fronts)`);
}

hdr('B3 — SAME ROLL AGAIN: same seed, byte-identical record');
{
  const a = benchSnap({ formationId: 'Spread', concept: 'Mesh', defLook: LOOK, seed: 77 });
  const b = benchSnap({ formationId: 'Spread', concept: 'Mesh', defLook: LOOK, seed: 77 });
  const c = benchSnap({ formationId: 'Spread', concept: 'Mesh', defLook: LOOK, seed: 77 });
  check(JSON.stringify(a.play) === JSON.stringify(b.play) && JSON.stringify(b.play) === JSON.stringify(c.play),
    'three reps on seed 77 are byte-identical');
  check(a.seed === 77 && b.seed === 77, 'the seed is reported back for the rerun control');
}

hdr('B4 — the scratch teams are even, flat, distinct, and never persisted');
{
  const t = benchTeams();
  check(t.off.length === t.def.length && t.off.length > 0, `both teams carry the full roster (${t.off.length})`);
  let evenAll = true, idClash = 0;
  const defIds = new Set(t.def.map((p) => p.id));
  for (let i = 0; i < t.off.length; i++) {
    const o = t.off[i], d = t.def[i];
    if (o.position !== d.position || JSON.stringify(o.attributes) !== JSON.stringify(d.attributes)) evenAll = false;
    if (defIds.has(o.id)) idClash++;
  }
  check(evenAll, 'position-for-position attribute-identical (maximally even, same pinned stream)');
  check(idClash === 0 && new Set([...t.off, ...t.def].map((p) => p.id)).size === t.off.length * 2, 'every player id distinct across the two teams');
  const t2 = benchTeams();
  check(t2 === t, 'teams are generated once and cached (deterministic instrument)');
}

hdr('B5 — zero save writes');
{
  const before = _lsLog.set;
  realSnap({ formationId: 'Spread', concept: 'Mesh', defLook: LOOK }, 91);
  benchGameShell(benchSnap({ formationId: 'Spread', concept: 'Mesh', defLook: LOOK, seed: 5 }).play);
  check(_lsLog.set === before, `no localStorage writes across reps (${_lsLog.set - before})`);
  const src = fs.readFileSync(new URL('../js/engine/bench.js', import.meta.url), 'utf8');
  const imports = src.split('\n').filter((l) => l.startsWith('import '));
  check(!imports.some((l) => /state\.js|persistence/.test(l)) && !/localStorage\s*[.([]/.test(src),
    'bench.js imports no state/persistence and never touches storage');
}

hdr('B6 — a composed play runs as itself on the bench');
{
  const COMPOSED = { schemaVersion: 1, name: 'Bench Special', kind: 'pass', parts: ['go', 'drag', 'curl', 'checkdown'], assigns: [{ slot: null, flip: false }, { slot: null, flip: false }, { slot: null, flip: false }, { slot: null, flip: false }], blocks: [], formations: ['Spread'] };
  let hit = null;
  for (let s = 101; s < 125 && !hit; s++) {
    const r = bench('Spread', null, { id: 'bench1', data: COMPOSED }, LOOK, { seed: s });
    if (r.real) hit = r;
  }
  check(!!hit && hit.play.concept === 'Bench Special', `the composed call records its own name (${hit && hit.play.concept})`);
  check(!!hit && hit.play.customPlayId === 'bench1', 'the record stamps the composed play id (Stage-5 stamp)');
}

hdr('B7 — the forced variation rides the call');
{
  const r = realSnap({ formationId: 'Spread', variation: 'trips', concept: 'Mesh', defLook: LOOK }, 141);
  check(!!r && r.play.variation === 'trips', `the record carries the fielded look (${r && r.play.variation})`);
}

hdr('B8 — the real watchphys viewer scripts the rep');
{
  const r = realSnap({ formationId: 'Spread', concept: 'Mesh', defLook: LOOK }, 161);
  const p = r && r.play;
  const offS = p && OFF_FIELD_LAYOUTS[p.offFormation] && OFF_FIELD_LAYOUTS[p.offFormation].slots;
  const defS = ((p && DEF_FIELD_LAYOUTS[p.defFront]) || DEF_FIELD_LAYOUTS['4-3']).slots;
  const script = p && offS ? buildPlayScript(p, offS, defS) : null;
  check(!!script, 'buildPlayScript builds the rep — the bench rides the real board');
  const shell = p ? benchGameShell(p) : null;
  check(!!shell && shell.drives.length === 1 && shell.drives[0].plays[0] === p, 'the game shell wraps exactly the one rep');
  const ids = p ? [p.rusherId, p.targetId, p.passerId, p.receiverId].filter(Boolean) : [];
  check(!!shell && ids.every((id) => shell.playerNames[id]), `the shell names every recorded participant (${ids.length} checked)`);
}

hdr('B9 — the ONE shared fits-function');
{
  const spreadFit = fittingConceptsForFormation('Spread');
  const spreadLegal = legalConceptsForFormation('Spread');
  check(spreadFit.length > 0 && spreadFit.every((c) => spreadLegal.includes(c)), `fitting ⊆ legal (Spread: ${spreadFit.length}/${spreadLegal.length})`);
  const emptyFit = fittingConceptsForFormation('Empty');
  const backNeedy = ['Slip Screen', 'RB Screen', 'Flea Flicker', 'HB Pass', 'Triple Option', 'Speed Option'];
  check(backNeedy.every((c) => !emptyFit.includes(c)), 'Empty (no backs) never offers back-built plays or options');
  // options need two backs — via a live pkg override where one exists
  const oneBack = filterConceptsForPersonnel(['Triple Option', 'Speed Option', 'Inside Zone'], { RB: 1, WR: 3, TE: 1 });
  check(!oneBack.includes('Triple Option') && !oneBack.includes('Speed Option') && oneBack.includes('Inside Zone'), 'one back: options filtered, base runs stay');
  const cf = compileFormation(emptyCustomFormation('Bench Look Test'));
  check(!cf.playbook.includes('Wildcat Power') && !cf.playbook.includes('Jet Sweep'), 'customs never offer Wildcat/Jet (the customs-only exclusion)');
  check(cf.playbook.every((c) => (FORMATION_PLAYBOOK[cf.archetype] || []).includes(c)), 'a custom call list stays a strict subset of its archetype book');
}

hdr('B10 — auto-select seeds SHIPPED sheet weights, not flat ones');
{
  const sheet = autoSheetForFormation('Spread');
  const fit = fittingConceptsForFormation('Spread');
  check(Object.keys(sheet).length === fit.length && fit.every((c) => sheet[c] != null), 'the seeded sheet covers exactly the fitting list');
  const shipped = shippedSheetWeights('Spread');
  const shippedNames = Object.keys(shipped).filter((c) => sheet[c] != null);
  check(shippedNames.length > 0 && shippedNames.every((c) => sheet[c] === shipped[c]), `starter-book weights carry through (${shippedNames.length} shipped concepts)`);
  // 2026-08-18 (owner-directed, commit 91fefce — "ALL-LEGAL PER LOOK"): a
  // starter book now selects EVERY fitting play at a FLAT weight, exactly like
  // the Playbook Builder's default. A book's identity comes from WHICH looks it
  // runs and how it leans, not from a curated play menu. The old pin here
  // asserted the seeded sheet was NOT flat — that encoded the retired curated-
  // weights model and has been red since that change. What still matters, and
  // is checked above, is that the seed carries the SHIPPED weights through
  // verbatim, whatever they are.
  const ws = new Set(Object.values(sheet));
  check([...ws].every((w) => typeof w === 'number' && w > 0),
    `every seeded weight is a live number (${ws.size} distinct: ${[...ws].join('/')})`);
  check(DEFAULT_OFF_BOOKS.length > 0, 'starter books present (the shipped source)');
}

console.log(`\nBENCH PROBE — ${pass} pass, ${fail} fail`);
console.log(fail ? 'BENCH PROBE FAIL' : 'BENCH PROBE PASS');
process.exit(fail ? 1 : 0);
