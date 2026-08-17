// look_sheet_probe.mjs — M2 ENGINE HALF (per-look sheets + the pkg truth).
// Run: node tools/look_sheet_probe.mjs
//
// Pins (dispatch D3, owner decisions a+b confirmed 2026-08-17):
//   L1  THE RESOLVER — inherit-with-override. A (formation, variation) look
//       without its own sheet inherits the formation's BASE sheet
//       BYTE-IDENTICALLY (the very same object, not a copy); a look with its
//       own non-empty sheet gets exactly that; an empty fork falls back to
//       the base (the sim treats empty as absent). Key grammar round-trips
//       and aliases ("Pro Set" → "Single Back").
//   L2  THE SIM CONSUMES THE FORK — a forked look's zero-weighted play is
//       NEVER called from that look while the base look still calls it, and
//       an unforked sibling look inherits the base sheet's cuts. (Weights of
//       0 are hard cuts in weightedConceptPick and the audible loop.)
//   L3  THE PKG TRUTH (owner decision a): the variation pkg ALWAYS wins when
//       fielding personnel — for every (formation, variation) with a pkg,
//       resolveOffField fields exactly the pkg's backs/TE/WR counts, from the
//       rooms the re-dressed VARIATION_LAYOUTS row names. Slot IDS never
//       change (pins and target shares ride across looks); base looks and
//       __noVarPkg field byte-identically to the base slots; the fallback
//       resolvePersonnel path agrees with the field path (ONE truth).
//   L4  THE REAL EMPTY (owner decision b): Air Raid "Empty" fields ZERO
//       backs and five receivers — the back genuinely leaves the field.
//   L5  MIGRATION — repairPlaybook maps an old (base-keys-only) book
//       LOSSLESSLY; per-look keys survive repair; a dead look's sheet drops
//       with a plain-English note (the look inherits the base again);
//       validatePlaybook accepts look keys and rejects unknown looks;
//       apply→extract round-trips look keys; repairCreation delegates.
//   L6  AI-BLIND — setAIGameplan across a full world never authors a look
//       key ("|") and never sets a variation entry, so every AI plan rides
//       the base path byte-identically (the stat bands cannot move from AI
//       play).
//   L7  OVERLAY LAW — controllerOverlayOf never carries formationPlaybooks
//       (look keys included): sheets are BOOK structure, not controller.

const _ls = new Map();
global.localStorage = {
  getItem: (k) => (_ls.has(k) ? _ls.get(k) : null),
  setItem: (k, v) => _ls.set(k, String(v)),
  removeItem: (k) => _ls.delete(k),
};

const { ROSTER_TARGETS, CLASS_YEARS, FORMATION_PACKAGES, FORMATION_VARIATIONS, FORMATION_PLAYBOOK, aliasFormation } = await import('../js/constants.js');
const { createPlayer } = await import('../js/engine/player.js');
const { buildDepthChart, generateWorld } = await import('../js/engine/world.js');
const { simulateDrive } = await import('../js/engine/sim.js');
const { resolveOffField } = await import('../js/engine/fieldassign.js');
const { resolvePersonnel } = await import('../js/engine/formations.js');
const { lookSheetKey, splitSheetKey, resolveLookSheet, validatePlaybook, repairPlaybook, applyPlaybookToGameplan, playbookFromGameplan, legalConceptsForFormation } = await import('../js/engine/playbook.js');
const { repairCreation } = await import('../js/engine/creatorrepair.js');
const { controllerOverlayOf } = await import('../js/engine/teamplan.js');

let pass = 0, fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}`); ok ? pass++ : fail++; };
const hdr = (s) => console.log(`\n${s}`);

// ── L1 — the resolver ───────────────────────────────────────────────────────
hdr('L1 — inherit-with-override: THE resolver');
{
  const base = { Mesh: 60, Stick: 20 };
  const fork = { Stick: 90 };
  const sheets = { 'Air Raid': base, 'Air Raid|empty': fork };
  check(resolveLookSheet(sheets, 'Air Raid', null) === base, 'base look resolves the base sheet (identity)');
  check(resolveLookSheet(sheets, 'Air Raid', 'tight') === base, 'unforked look INHERITS the base sheet BYTE-IDENTICALLY (same object)');
  check(resolveLookSheet(sheets, 'Air Raid', 'empty') === fork, 'a forked look resolves its OWN sheet');
  check(resolveLookSheet({ 'Air Raid': base, 'Air Raid|empty': {} }, 'Air Raid', 'empty') === base, 'an EMPTY fork falls back to the base (empty ≡ absent, matching the sim overlay gate)');
  check(resolveLookSheet(null, 'Air Raid', 'empty') === null && resolveLookSheet({}, 'Air Raid', null) === null, 'null-safe on absent stores');
  check(lookSheetKey('Air Raid', 'empty') === 'Air Raid|empty' && lookSheetKey('Air Raid', null) === 'Air Raid', 'key grammar: fid | fid|variation');
  const sk = splitSheetKey('Air Raid|empty');
  check(sk.id === 'Air Raid' && sk.variation === 'empty' && splitSheetKey('Air Raid').variation === null, 'splitSheetKey round-trips');
  check(lookSheetKey('Pro Set', 'twins') === 'Single Back|twins' && resolveLookSheet({ 'Single Back': base }, 'Pro Set', null) === base, 'formation aliases resolve ("Pro Set" → "Single Back")');
  // Every base-keys-only store (every pre-M2 book) resolves the base sheet for
  // EVERY look of EVERY formation — the zero-migration law.
  let inheritOk = true;
  for (const [fid, vset] of Object.entries(FORMATION_VARIATIONS)) {
    const s = { [fid]: { Probe: 1 } };
    for (const vk of Object.keys(vset)) if (resolveLookSheet(s, fid, vk) !== s[fid]) inheritOk = false;
  }
  check(inheritOk, 'every look of every formation inherits a base-keys-only store byte-identically (22 looks)');
}

// ── shared rig: rosters + a forced-look sheet drive ─────────────────────────
function genRoster(sid) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], 1);
      p.schoolId = sid;
      r.push(p);
    }
  }
  return r;
}
const offRoster = genRoster('O'), defRoster = genRoster('D');
const gpFor = (formation) => ({
  offFormation: formation,
  offFormations: [{ id: formation, weight: 100 }],
  tendency: 'Balanced', rushInPct: 60,
  passDepth: { short: 40, medium: 40, deep: 20 },
  blitzPct: 20, defFormation: 'Balanced D', defFront: '4-3',
  fourthDown: 'Moderate', maxFGDist: 42,
});
function runDrive(call, gpMut) {
  const gp = gpFor('Air Raid');
  if (gpMut) gpMut(gp);
  const off = { roster: offRoster, depth: buildDepthChart(offRoster, gp), gameplan: gp, school: { id: 'O', name: 'Off U' }, isHome: true, ctx: { fatigueMap: {}, snapCountMap: {}, benchedMap: {}, offSnaps: 0, defSnaps: 0, jobSnapMap: {} }, form: 1 };
  const dgp = gpFor('Single Back');
  const def = { roster: defRoster, depth: buildDepthChart(defRoster, dgp), gameplan: dgp, school: { id: 'D', name: 'Def U' }, isHome: false, ctx: { fatigueMap: {}, snapCountMap: {}, benchedMap: {}, offSnaps: 0, defSnaps: 0, jobSnapMap: {} }, form: 1 };
  const plays = [];
  simulateDrive(off, def, { fieldPos: 35, clock: 1500, half: 1, score: { off: 0, def: 0 } }, [], {
    askCall: () => 'ASK',
    resume: { call, fieldPos: 35, down: 1, distance: 10, plays, audiblesUsed: 0, fourthDecided: false, decision: null, pen: { offCount: 0, offYds: 0, defCount: 0, defYds: 0 } },
  });
  return plays;
}

// ── L2 — the sim consumes the fork through the resolver ─────────────────────
hdr('L2 — a forked look plays ITS sheet; unforked looks inherit the base');
{
  // Base sheet: Mesh featured, Stick CUT. Empty-look fork: Stick featured,
  // Mesh CUT. Weight 0 is a hard cut (weightedConceptPick + the audible gate),
  // so a snap from a look must never call its sheet's cuts.
  const legal = legalConceptsForFormation('Air Raid');
  const baseSheet = { Mesh: 100, Stick: 0 };
  const forkSheet = { Stick: 100, Mesh: 0 };
  const sheets = { 'Air Raid': baseSheet, 'Air Raid|empty': forkSheet };
  check(legal.includes('Mesh') && legal.includes('Stick'), 'rig sanity: Air Raid runs Mesh and Stick');
  const collect = (variation, n) => {
    const out = [];
    let guard = 0;
    while (out.length < n && guard < n * 6) {
      guard++;
      const call = { concept: 'sheet', formationId: 'Air Raid' };
      if (variation) call.variation = variation;
      const plays = runDrive(call, (gp) => { gp.formationPlaybooks = JSON.parse(JSON.stringify(sheets)); });
      for (const p of plays) if (p && p.concept && p.offFormation === 'Air Raid') out.push(p);
    }
    return out;
  };
  const baseSnaps = collect(null, 40);
  const forkSnaps = collect('empty', 40);
  const tightSnaps = collect('tight', 40);
  check(baseSnaps.length >= 40 && forkSnaps.length >= 40 && tightSnaps.length >= 40, `rig produced real snaps (base ${baseSnaps.length} / empty ${forkSnaps.length} / tight ${tightSnaps.length})`);
  check(baseSnaps.every((p) => p.concept !== 'Stick'), 'base look never calls the base sheet\'s cut (Stick)');
  check(forkSnaps.every((p) => p.concept !== 'Mesh'), 'the FORKED empty look never calls ITS cut (Mesh) — the fork is consumed');
  check(forkSnaps.some((p) => p.concept === 'Stick'), 'the forked look features its own play (Stick called)');
  check(tightSnaps.every((p) => p.concept !== 'Stick'), 'an UNFORKED sibling look (tight) inherits the base sheet\'s cuts');
  check(forkSnaps.every((p) => p.variation === 'empty'), 'the fork\'s snaps record the look (variation stamped)');
}

// ── L3/L4 — the pkg truth on the field ──────────────────────────────────────
hdr('L3 — variation pkg ALWAYS wins when fielding personnel (every look)');
{
  const posOf = (id) => { const p = offRoster.find((x) => x.id === id); return p ? p.position : null; };
  const byId = (id) => offRoster.find((x) => x.id === id) || null;
  const depthOf = (fid) => buildDepthChart(offRoster, gpFor(fid));
  const counts = (per) => ({
    backs: (per.RB || []).length + (per.FB || []).length,
    te: (per.TE || []).length,
    wr: (per.WR || []).length,
    total: ['OL', 'QB', 'RB', 'FB', 'WR', 'TE'].reduce((n, k) => n + (per[k] || []).length, 0),
  });
  let looksChecked = 0, pkgOk = 0, idOk = 0, elevenOk = 0, baseNeutral = 0, killOk = 0, oneTruth = 0;
  const misses = [];
  for (const [fid, vset] of Object.entries(FORMATION_VARIATIONS)) {
    const depth = depthOf(fid);
    const baseField = resolveOffField(fid, null, null, depth, null, posOf, byId);
    for (const [vk, vd] of Object.entries(vset)) {
      looksChecked++;
      const f = resolveOffField(fid, null, null, depth, null, posOf, byId, vk);
      const c = counts(f.personnel);
      if (c.total === 11) elevenOk++; else misses.push(`${fid}·${vk}: ${c.total} men`);
      if (vd.pkg) {
        const pkg = { ...FORMATION_PACKAGES[fid], ...vd.pkg };
        const want = { backs: (pkg.RB || 0) + (pkg.FB || 0), te: pkg.TE || 0, wr: pkg.WR || 0 };
        if (c.backs === want.backs && c.te === want.te && c.wr === want.wr) pkgOk++;
        else misses.push(`${fid}·${vk}: fielded ${c.backs}B/${c.te}TE/${c.wr}WR want ${want.backs}B/${want.te}TE/${want.wr}WR`);
        // ONE TRUTH: the no-field-assignments fallback (resolvePersonnel)
        // agrees with the field path on the pkg counts.
        const rp = resolvePersonnel(fid, depth, vk);
        const rc = counts(rp);
        if (rc.backs === want.backs && rc.te === want.te && rc.wr === want.wr) oneTruth++;
        else misses.push(`${fid}·${vk} fallback: ${rc.backs}B/${rc.te}TE/${rc.wr}WR`);
      } else { pkgOk++; oneTruth++; }
      // slot IDS never change across looks — pins/shares ride
      const idsBase = Object.keys(baseField.bySlot).sort().join(',');
      const idsVar = Object.keys(f.bySlot).sort().join(',');
      if (idsBase === idsVar) idOk++; else misses.push(`${fid}·${vk}: slot ids moved`);
      // kill-switch restores base fielding
      globalThis.__noVarPkg = true;
      const off = resolveOffField(fid, null, null, depth, null, posOf, byId, vk);
      globalThis.__noVarPkg = false;
      if (JSON.stringify(off.personnel) === JSON.stringify(baseField.personnel)) killOk++;
      else misses.push(`${fid}·${vk}: __noVarPkg didn't restore base`);
    }
    // base look (no variation) unchanged by the new parameter
    const again = resolveOffField(fid, null, null, depth, null, posOf, byId, null);
    if (JSON.stringify(again.personnel) === JSON.stringify(baseField.personnel)) baseNeutral++;
  }
  if (misses.length) console.log('    misses: ' + misses.slice(0, 8).join(' · '));
  check(looksChecked >= 22, `walked every (formation × variation) look (${looksChecked})`);
  check(elevenOk === looksChecked, `every look fields a lawful ELEVEN (${elevenOk}/${looksChecked})`);
  check(pkgOk === looksChecked, `every pkg look fields EXACTLY its pkg — backs/TE/WR (${pkgOk}/${looksChecked})`);
  check(oneTruth === looksChecked, `ONE truth: the resolvePersonnel fallback agrees with the field path (${oneTruth}/${looksChecked})`);
  check(idOk === looksChecked, `slot IDS never change across looks — pins and shares ride (${idOk}/${looksChecked})`);
  check(killOk === looksChecked, `__noVarPkg restores base-personnel fielding (${killOk}/${looksChecked})`);
  check(baseNeutral === Object.keys(FORMATION_VARIATIONS).length, `base looks field byte-identically with the new parameter (${baseNeutral} formations)`);

  hdr('L4 — the REAL Empty (owner decision b)');
  const depth = depthOf('Air Raid');
  const f = resolveOffField('Air Raid', null, null, depth, null, posOf, byId, 'empty');
  const c = counts(f.personnel);
  check(c.backs === 0, `Air Raid Empty fields ZERO backs (${c.backs})`);
  check(c.wr === 5, `Air Raid Empty fields FIVE receivers (${c.wr})`);
  const pkg = FORMATION_VARIATIONS['Air Raid'].empty.pkg;
  check(!!pkg && pkg.RB === 0 && pkg.WR === 5, 'the Empty pkg exists in the data (RB 0 / WR 5)');
  // a hand-picked pin at the moved slot still resolves (three-places law)
  const wr2 = (depth.WR || [])[3];
  const pinned = resolveOffField('Air Raid', { RB_H: wr2 }, null, depth, null, posOf, byId, 'empty');
  check(pinned.bySlot.RB_H === wr2, 'a hand-picked receiver at the emptied slot still resolves (pins ride the slot id)');
}

// ── L5 — migration: lossless repair, per-look keys, dead looks ──────────────
hdr('L5 — migration: repair is lossless for old books, look keys survive');
{
  const legacy = {
    name: 'Old Book', schemaVersion: 1,
    formations: [{ id: 'Air Raid', weight: 60 }, { id: 'Spread', weight: 40, variation: 'trips' }],
    sheets: { 'Air Raid': { Mesh: 70, Stick: 40 }, 'Spread': { Mesh: 55 } },
    tendency: 'Heavy Pass',
  };
  const r1 = repairPlaybook(JSON.parse(JSON.stringify(legacy)));
  check(r1.ok && r1.changes.length === 0, 'an old base-keys-only book repairs with ZERO changes');
  check(JSON.stringify(r1.pb.sheets) === JSON.stringify(legacy.sheets), 'its sheets come through byte-equal (lossless)');
  check(JSON.stringify(r1.pb.formations) === JSON.stringify(legacy.formations), 'its looks come through byte-equal');
  const forked = JSON.parse(JSON.stringify(legacy));
  forked.sheets['Air Raid|empty'] = { Stick: 80 };
  const r2 = repairPlaybook(JSON.parse(JSON.stringify(forked)));
  check(r2.ok && JSON.stringify(r2.pb.sheets['Air Raid|empty']) === JSON.stringify({ Stick: 80 }), 'a per-look fork survives repair intact');
  const dead = JSON.parse(JSON.stringify(forked));
  dead.sheets['Air Raid|goneLook'] = { Mesh: 50 };
  const r3 = repairPlaybook(dead);
  check(!('Air Raid|goneLook' in r3.pb.sheets) && r3.changes.some((c) => c.includes('goneLook')), 'a DEAD look\'s sheet drops with a plain-English note (it inherits the base again)');
  check(JSON.stringify(r3.pb.sheets['Air Raid']) === JSON.stringify(forked.sheets['Air Raid']), 'the base sheet is untouched by the dead fork\'s removal');
  const v1 = validatePlaybook(forked);
  check(v1.ok, 'validate accepts per-look keys');
  const v2 = validatePlaybook({ ...forked, sheets: { ...forked.sheets, 'Air Raid|nope': { Mesh: 50 } } });
  check(!v2.ok && v2.errors.some((e) => e.includes('nope')), 'validate rejects a sheet for an unknown look');
  const v3 = validatePlaybook({ ...forked, sheets: { ...forked.sheets, 'Air Raid|empty': { 'Power': 50 } } });
  check(!v3.ok, 'a look sheet still answers to the FORMATION\'s legality gate');
  // warning (not error) when the fork's look isn't carried
  const vWarn = validatePlaybook({ name: 'x', formations: [{ id: 'Air Raid', weight: 50 }], sheets: { 'Air Raid|empty': { Stick: 50 } } });
  check(vWarn.ok && vWarn.warnings.some((w) => w.includes('empty')), 'a fork for an uncarried look warns, never errors');
  // apply → extract round-trips the look keys
  const gp2 = applyPlaybookToGameplan(forked, gpFor('Air Raid'));
  check(JSON.stringify(gp2.formationPlaybooks) === JSON.stringify(forked.sheets), 'applyPlaybookToGameplan carries look keys verbatim');
  const back = playbookFromGameplan(gp2, 'Round Trip');
  check(JSON.stringify(back.sheets) === JSON.stringify(forked.sheets), 'playbookFromGameplan extracts them verbatim (round trip)');
  const rc = repairCreation('playbooks', JSON.parse(JSON.stringify(forked)));
  check(rc.ok && JSON.stringify(rc.data.sheets) === JSON.stringify(forked.sheets), 'repairCreation (the CREATOR LIBRARY door) preserves the fork');
}

// ── L6 — AI-blind ───────────────────────────────────────────────────────────
hdr('L6 — the AI never authors a look key and never fields a variation');
{
  const world = generateWorld();
  let plans = 0, lookKeys = 0, variations = 0;
  for (const s of world.schools) {
    const gp = s.gameplan || {};
    plans++;
    for (const k of Object.keys(gp.formationPlaybooks || {})) if (k.includes('|')) lookKeys++;
    for (const f of gp.offFormations || []) if (f && f.variation) variations++;
  }
  check(plans >= 100, `swept a full world of AI plans (${plans})`);
  check(lookKeys === 0, 'zero AI-authored look keys (aiFormationSheets stays base-keyed)');
  check(variations === 0, 'zero AI variation entries — every AI snap rides the base path byte-identically');
}

// ── L7 — overlay law ────────────────────────────────────────────────────────
hdr('L7 — controller overlays never carry sheets (look keys included)');
{
  const gp = gpFor('Air Raid');
  gp.formationPlaybooks = { 'Air Raid': { Mesh: 70 }, 'Air Raid|empty': { Stick: 80 } };
  const ov = controllerOverlayOf(gp);
  check(!('formationPlaybooks' in ov), 'controllerOverlayOf excludes formationPlaybooks (book structure, not controller)');
}

console.log(`\nLOOK SHEET PROBE — ${pass} pass, ${fail} fail`);
console.log(fail === 0 ? 'LOOK SHEET PROBE PASS' : 'LOOK SHEET PROBE FAIL');
process.exit(fail === 0 ? 0 : 1);
