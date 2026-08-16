// thin_roster_check.mjs — verifies emergency backfill (Pass 3 in resolveSlots):
//   1. simulateGame completes without crash on thin/empty position pools.
//   2. With depthChart.QB=[], the QB slot is filled by the best available player.
//   3. On a full healthy roster, every slot is filled by its natural position
//      (Pass 3 never fires — WR slots get WRs, QB slot gets a QB, etc.).
//   4. Calibration guard: backfill never fires across 50 normal generated worlds.
// Run: node tools/thin_roster_check.mjs
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
Math.random = mulberry32(0xAB12CD);

const { generateWorld }   = await import('../js/engine/world.js');
const { simulateGame }    = await import('../js/engine/sim.js');
const { resolveOffField } = await import('../js/engine/fieldassign.js');
const { OFF_FIELD_LAYOUTS } = await import('../js/constants_field.js');

function clone(o) { return JSON.parse(JSON.stringify(o)); }

let passed = 0, failed = 0;
function assert(cond, label) {
  if (cond) { console.log(`  PASS ✅  ${label}`); passed++; }
  else       { console.error(`  FAIL ❌  ${label}`); failed++; }
}

// ── 1. No-crash on thin rosters ───────────────────────────────────────────
console.log('=== THIN ROSTER CHECK ===\n');
console.log('── 1. NO-CRASH ON THIN ROSTERS ──');

function runCrashTest(label, mutateDepth) {
  Math.random = mulberry32(0xAB12CD);
  const w = generateWorld();
  const home = w.schools[0], away = w.schools[1];
  const homeDepth = mutateDepth(clone(home.depthChart));
  let crashed = false, result;
  try {
    Math.random = mulberry32(0xAB12CD + 1);
    result = simulateGame(
      home, away, home.roster, away.roster,
      homeDepth, away.depthChart,
      home.gameplan, away.gameplan,
    );
  } catch (e) {
    crashed = true;
    console.error(`    CRASH (${label}): ${e.message}`);
  }
  assert(!crashed, `${label}: no crash`);
  if (!crashed) {
    const total = (result.homeScore ?? 0) + (result.awayScore ?? 0);
    assert(Number.isFinite(total) && total >= 0, `${label}: sane score (home ${result.homeScore} – away ${result.awayScore})`);
  }
}

runCrashTest('all QBs removed from depth',
  d => { d.QB = []; return d; });

runCrashTest('all FBs removed',
  d => { d.FB = []; return d; });

runCrashTest('all TEs removed',
  d => { d.TE = []; return d; });

runCrashTest('all RBs removed',
  d => { d.RB = []; return d; });

runCrashTest('only 3 OL',
  d => { d.OL = (d.OL || []).slice(0, 3); return d; });

runCrashTest('only 12 total healthy players', d => {
  const all = Object.entries(d)
    .flatMap(([pos, ids]) => ids.map(id => ({ pos, id })))
    .slice(0, 12);
  const out = {};
  for (const { pos, id } of all) (out[pos] ||= []).push(id);
  return out;
});

// ── 2. Emergency backfill fills QB slot when QB pool is empty ─────────────
console.log('\n── 2. EMERGENCY BACKFILL FILLS QB SLOT ──');
{
  Math.random = mulberry32(0x5E1DC0);
  const w = generateWorld();
  const school = w.schools[0];
  const roster = school.roster;

  // Active depth with no QBs in the pool
  const activeDepth = {};
  for (const p of roster) {
    if (p.position === 'QB') continue;
    (activeDepth[p.position] ||= []).push(p.id);
  }
  for (const pos of Object.keys(activeDepth)) {
    activeDepth[pos].sort((a, b) => {
      const ra = roster.find(p => p.id === a)?.compositeRating ?? 0;
      const rb = roster.find(p => p.id === b)?.compositeRating ?? 0;
      return rb - ra;
    });
  }
  const ratingById = Object.fromEntries(roster.map(p => [p.id, p.compositeRating]));

  const fid = school.gameplan.offFormations?.[0]?.id || 'Single Back';
  const resolved = resolveOffField(fid, {}, {}, activeDepth, ratingById);
  const qbFill = resolved?.bySlot?.['QB'];

  assert(qbFill != null, `QB slot is not null when QB pool is empty (got player ${qbFill})`);
  if (qbFill) {
    const filler = roster.find(p => p.id === qbFill);
    assert(filler != null, `Emergency QB filler exists in roster`);
    assert(filler?.position !== 'QB', `Filler is cross-position (${filler?.position}) — confirms Pass 3 fired`);
    // Should be the best-rated AVAILABLE player — i.e. the best body NOT already
    // assigned to another slot (a starter can't also emergency-fill QB) and NOT
    // a specialist (Pass 3 excludes K/P — you don't move your kicker to QB). The
    // old check compared against the best of the whole roster, which counted
    // players already on the field (e.g. a 92 TE playing TE) and wrongly red.
    const assignedElsewhere = new Set(
      Object.entries(resolved.bySlot).filter(([slot, id]) => slot !== 'QB' && id).map(([, id]) => id)
    );
    const bestAvail = Object.values(activeDepth).flat()
      .map(id => roster.find(p => p.id === id))
      .filter(Boolean)
      .filter(p => !assignedElsewhere.has(p.id) && p.position !== 'K' && p.position !== 'P')
      .sort((a, b) => b.compositeRating - a.compositeRating)[0];
    assert(filler?.compositeRating >= (bestAvail?.compositeRating ?? 0),
      `Filler (rating ${filler?.compositeRating}) is the best available (best avail: ${bestAvail?.compositeRating})`);
    console.log(`  QB slot filled by: ${filler?.position} rating=${filler?.compositeRating}`);
  }
}

// ── 3. Natural position preferred on full healthy roster ──────────────────
console.log('\n── 3. NATURAL POSITION PREFERRED ON FULL ROSTER ──');
{
  Math.random = mulberry32(0x7E2A44);
  const w = generateWorld();
  const school = w.schools[0];
  const roster = school.roster;

  const activeDepth = {};
  for (const p of roster) (activeDepth[p.position] ||= []).push(p.id);
  for (const pos of Object.keys(activeDepth)) {
    activeDepth[pos].sort((a, b) => {
      const ra = roster.find(p => p.id === a)?.compositeRating ?? 0;
      const rb = roster.find(p => p.id === b)?.compositeRating ?? 0;
      return rb - ra;
    });
  }
  const ratingById = Object.fromEntries(roster.map(p => [p.id, p.compositeRating]));
  const fid = 'Single Back';
  const layout = OFF_FIELD_LAYOUTS[fid];
  const resolved = resolveOffField(fid, {}, {}, activeDepth, ratingById);
  const bySlot = resolved?.bySlot || {};

  // QB slot must be a real QB
  const qbSlot = layout.slots.find(s => s.pos === 'QB');
  const qbPid  = bySlot[qbSlot?.id];
  const qbPlayer = roster.find(p => p.id === qbPid);
  assert(qbPlayer?.position === 'QB',
    `QB slot filled by a natural QB (got position=${qbPlayer?.position})`);

  // All WR slots must be filled by WRs — no TE/RB emergency fill
  const wrSlots = layout.slots.filter(s => s.pos === 'WR');
  let crossPos = 0;
  for (const s of wrSlots) {
    const p = roster.find(pl => pl.id === bySlot[s.id]);
    if (p && p.position !== 'WR') crossPos++;
  }
  assert(crossPos === 0, `All ${wrSlots.length} WR slots filled by natural WRs (0 cross-position fills)`);

  // OL slots must be filled by OLs
  const olSlots = layout.slots.filter(s => s.pos === 'OL');
  let olCross = 0;
  for (const s of olSlots) {
    const p = roster.find(pl => pl.id === bySlot[s.id]);
    if (p && p.position !== 'OL') olCross++;
  }
  assert(olCross === 0, `All ${olSlots.length} OL slots filled by natural OLs (0 cross-position fills)`);
}

// ── 4. Calibration guard — backfill never fires on 50 normal worlds ────────
console.log('\n── 4. CALIBRATION GUARD — BACKFILL NEVER FIRES ON NORMAL ROSTERS ──');
{
  const N = 50;
  let crossFills = 0;
  for (let i = 0; i < N; i++) {
    Math.random = mulberry32(0xC0FFEE + i * 7);
    const w = generateWorld();
    const school = w.schools[0];
    const roster = school.roster;

    const activeDepth = {};
    for (const p of roster) (activeDepth[p.position] ||= []).push(p.id);
    for (const pos of Object.keys(activeDepth)) {
      activeDepth[pos].sort((a, b) => {
        const ra = roster.find(p => p.id === a)?.compositeRating ?? 0;
        const rb = roster.find(p => p.id === b)?.compositeRating ?? 0;
        return rb - ra;
      });
    }
    const ratingById = Object.fromEntries(roster.map(p => [p.id, p.compositeRating]));
    const fid = school.gameplan.offFormations?.[0]?.id || 'Single Back';
    const layout = OFF_FIELD_LAYOUTS[fid];
    if (!layout) continue;

    const resolved = resolveOffField(fid, {}, {}, activeDepth, ratingById);
    const bySlot = resolved?.bySlot || {};
    for (const s of layout.slots) {
      const p = roster.find(pl => pl.id === bySlot[s.id]);
      if (p && p.position !== s.pos) crossFills++;
    }
  }
  assert(crossFills === 0,
    `Pass 3 never fires across ${N} normal worlds (0 cross-position emergency fills)`);
}

console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
