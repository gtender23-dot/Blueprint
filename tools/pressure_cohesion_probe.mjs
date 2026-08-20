// pressure_cohesion_probe.mjs — THE TRIPWIRE for the pressure redesign
// (Ref/PRESSURE_REDESIGN_2026-08-19.md), written FIRST, before batch 1 lands.
//
// Project convention (CLAUDE.md): a probe pins CURRENT behaviour, defects
// included. When a fix lands, the pin is flipped WITH the fix — the same
// commit that changes sim.js/fieldassign.js/defbook.js/constants_field.js
// also edits the matching numbers here. So most of what this file asserts
// is deliberately a RED FLAG waiting to happen, not a guarantee of health.
// Sections are marked loudly where the pin is a defect and is EXPECTED TO
// FLIP in a named batch, versus sections that must never move.
//
// Why this exists as ONE file instead of living inside an existing probe:
// the redesign note names three separate defects (finding 8, and P1/P2) that
// today live in three different files (sim.js + fieldassign.js for the rush
// group, defbook.js for `bring`, constants_field.js for blitz eligibility),
// and no existing probe pins all three together. Batch 1 changes the first,
// batch 2 the second — if this file doesn't independently pin each one, a
// batch could silently fix (or worse, half-fix) the other and nobody would
// notice until stat bands moved for a reason nobody could name.
//
// The three questions from the design note, and what THIS probe is for:
//   "how many rush"     §1 (finding 8 — the 3-4/Penny 5-man rush)
//   "how often pressure comes" / "bring means what it says"   §2 (P1/P2)
//   structural preconditions batch 1/2 will touch   §3
//   things that must NEVER move, in this redesign or any other   §4
//
// Run: node tools/pressure_cohesion_probe.mjs
import { readFileSync } from 'fs';
import { benchSnap } from '../js/engine/bench.js';

let pass = 0, fail = 0;
const check = (ok, msg, detail = '') => {
  if (ok) pass++; else fail++;
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}${detail ? `  [${detail}]` : ''}`);
};
const hdr = (t) => console.log(`\n${t}`);
const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

// A snap-sampling helper: runs N seeds of Spread/Four Verts against a given
// defensive look and buckets outcomes. Skips seeds that don't yield a usable
// play (pre-snap penalty etc — the bench reports those honestly rather than
// rerolling, see bench.js's own comment).
function sampleSnaps(defLook, n, seedBase) {
  const out = { n: 0, skip: 0, blitzFired: 0, rushDist: {}, unfiredRushDist: {} };
  for (let s = 0; s < n; s++) {
    const r = benchSnap({ formationId: 'Spread', concept: 'Four Verts', seed: seedBase + s, defLook });
    const p = r && r.play;
    if (!p || p.rushN == null) { out.skip++; continue; }
    out.n++;
    out.rushDist[p.rushN] = (out.rushDist[p.rushN] || 0) + 1;
    if (p.blitzFired) out.blitzFired++;
    else out.unfiredRushDist[p.rushN] = (out.unfiredRushDist[p.rushN] || 0) + 1;
  }
  return out;
}
const pct = (num, den) => (den ? 100 * num / den : 0);

// ── §1 base rush count by front — finding 8 ─────────────────────────────────
hdr('P1 — base rush count by front (unfired snaps only, bring "4")');
{
  // sim.js:22 and fieldassign.js:230 fold BOTH outside linebackers into the
  // rush group for fronts '3-4' and 'Penny' (DL = DE + DT + OLB). Each OLB
  // independently rolls C.FZ_NATIVE_DROP_PCT (18%) to bail; whoever does not
  // bail rushes. Net effect on snaps where no blitz was called: the 4-3 and
  // Nickel rush a clean four, but the 3-4/Penny rush FIVE on a supermajority
  // of snaps because it takes BOTH OLBs bailing to get back to four.
  const N = 700, SEED = 81000;
  const results = {};
  for (const front of ['4-3', 'Nickel', '3-4', 'Penny']) {
    results[front] = sampleSnaps({ front, coverage: 'c3', bring: '4' }, N, SEED);
  }

  for (const front of ['4-3', 'Nickel']) {
    const r = results[front];
    check(r.n > 400, `${front}: sampled enough unfired snaps (${r.n})`);
    const only4 = r.unfiredRushDist['4'] || 0;
    const unfiredN = r.n - r.blitzFired;
    check(unfiredN > 0 && only4 === unfiredN,
      `${front}: rushN is 4 on 100% of unfired snaps — this side is healthy today`,
      `${only4}/${unfiredN}`);
  }

  for (const front of ['3-4', 'Penny']) {
    const r = results[front];
    check(r.n > 400, `${front}: sampled enough unfired snaps (${r.n})`);
    const unfiredN = r.n - r.blitzFired;
    const avg = Object.entries(r.unfiredRushDist).reduce((t, [k, v]) => t + Number(k) * v, 0) / unfiredN;
    const p5 = pct(r.unfiredRushDist['5'] || 0, unfiredN);
    const p4 = pct(r.unfiredRushDist['4'] || 0, unfiredN);
    const p3 = pct(r.unfiredRushDist['3'] || 0, unfiredN);
    // FLIPPED WITH THE FIX, batch 1 (2026-08-19). This pinned the defect: the
    // pre-fix baseline was 3→~3%, 4→~29%, 5→~69%, avg ~4.66, because BOTH
    // outside backers were in the rush group and only the 18% native bail kept
    // the count down. Now exactly one OLB is the Jack, and when he takes that
    // bail the coverage OLB comes behind him — a fire zone is an EXCHANGE, not
    // a subtraction — so every front rushes four with nothing called.
    check(p5 === 0,
      `${front}: no five-man rush without a call — the Jack is the only OLB rushing`,
      `3→${p3.toFixed(1)}% 4→${p4.toFixed(1)}% 5→${p5.toFixed(1)}% avg=${avg.toFixed(2)}`);
    check(avg > 3.97 && avg < 4.03,
      `${front}: a base rush is FOUR, same as every other front`,
      `avg=${avg.toFixed(3)} (was ~4.66 before the Jack fix)`);
    check(p4 + p5 + p3 > 95, `${front}: distribution is fully in {3,4,5} (no stray rush counts)`,
      `${(p3 + p4 + p5).toFixed(1)}%`);
  }

  // The two 3-4-family fronts must currently behave IDENTICALLY — same rush
  // group construction, same 18% native drop roll per OLB. If they diverge,
  // something already changed underneath this pin and batch 1 has moved
  // goalposts nobody flipped this file for.
  const a = results['3-4'], b = results['Penny'];
  const aAvg = Object.entries(a.unfiredRushDist).reduce((t, [k, v]) => t + Number(k) * v, 0) / (a.n - a.blitzFired);
  const bAvg = Object.entries(b.unfiredRushDist).reduce((t, [k, v]) => t + Number(k) * v, 0) / (b.n - b.blitzFired);
  check(Math.abs(aAvg - bAvg) < 0.25, '3-4 and Penny track each other (same rush-group construction)',
    `3-4 avg=${aAvg.toFixed(3)} vs Penny avg=${bAvg.toFixed(3)}`);
}

// ── §2 the `bring` ladder — P1/P2 ───────────────────────────────────────────
hdr('P2 — bring is a RATE selector today, not a seat count (front 4-3, c3)');
{
  // DEF_CALL_BRING maps bring "4"/"5"/"6" onto aggression stops
  // balanced/attacking/house; only "3" sets a real count (rush3:true). So a
  // called "Bring 5" does not mean five rushers — it means a dial that fires
  // a blitz more often, and even when it doesn't fire, rushN stays 4.
  // Tolerance ±6pp per the task brief — the aggression stops roll RNG per
  // snap and are not seeded per-call, so the realized split wobbles.
  const N = 900, SEED = 91000;
  const TOL = 6;
  const expect = {
    '3': { blitzFired: 0, dist: { 3: 100 } },
    '4': { blitzFired: 23, dist: { 4: 77, 5: 23 } },
    '5': { blitzFired: 36, dist: { 4: 64, 5: 36 } },
    '6': { blitzFired: 51, dist: { 4: 49, 6: 51 } }
  };
  for (const bring of ['3', '4', '5', '6']) {
    const r = sampleSnaps({ front: '4-3', coverage: 'c3', bring }, N, SEED);
    check(r.n > 600, `bring "${bring}": sampled enough snaps (${r.n})`);
    const fired = pct(r.blitzFired, r.n);
    const exp = expect[bring];
    if (bring === '3') {
      check(Math.abs(fired - exp.blitzFired) < 0.5,
        'bring "3": PINS the one honest case — blitz never fires (rush3:true is a real count)',
        `fired=${fired.toFixed(1)}%`);
      const only3 = r.rushDist['3'] || 0;
      check(only3 === r.n, 'bring "3": rushN is 3 on every snap', `${only3}/${r.n}`);
    } else {
      // FLIPPED WITH THE FIX, batch 2 (2026-08-19). These pinned the defect:
      // bring 4/5/6 compiled to the aggression stops balanced/attacking/house,
      // so the card asked for a RATE and the count was a dice roll. Measured
      // pre-fix: "Bring 5" sent FOUR on 64% of snaps, "Bring the House" was a
      // 49/51 coin flip, and "Rush 4" blitzed 23% of the time. A called card is
      // a play call, not a posture — the count it names is the count that comes.
      const want = Number(bring);
      const wantFired = want > 4 ? 100 : 0;
      check(Math.abs(fired - wantFired) < 0.5,
        `bring "${bring}": the call is honoured, not rolled — fires ${wantFired ? 'every' : 'no'} snap`,
        `fired=${fired.toFixed(1)}%`);
      const got = pct(r.rushDist[String(want)] || 0, r.n);
      check(got > 99.5,
        `bring "${bring}": EXACTLY ${want} rushers come, every time`,
        `rushN=${want} on ${got.toFixed(1)}% of snaps`);
    }
  }
}

// ── §3 structure — the source-level statements the batches will rewrite ─────
hdr('P3 — structural preconditions (static source, not simulated)');
{
  const defbook = src('js/engine/defbook.js');
  const constField = src('js/constants_field.js');
  const simSrc = src('js/engine/sim.js');
  const fieldassign = src('js/engine/fieldassign.js');
  const formationsSrc = src('js/engine/formations.js');

  // FLIPPED WITH THE FIX, batch 2. `bring` compiles to SEATS — extra rushers
  // beyond the four-man front — so the count is what the card says. Seats 0 is
  // a real four-man rush that cannot blitz, which the game had no way to call
  // before (only Rush 3 could say "do not blitz").
  // Scope to the TABLE, not the file — the explanatory comment above it names
  // the old stops, and matching those would be a false red.
  const _bringTbl = (defbook.match(/var DEF_CALL_BRING = \{[\s\S]*?\n\};/) || [''])[0];
  check(_bringTbl.length > 0 && !/aggression:/.test(_bringTbl),
    'DEF_CALL_BRING no longer compiles a card into an AGGRESSION STOP');
  check(/"4":\s*\{[^}]*bringSeats:\s*0/.test(_bringTbl),
    'bring "4" = 0 extra seats — a four-man rush that cannot blitz');
  check(/"5":\s*\{[^}]*bringSeats:\s*1/.test(_bringTbl), 'bring "5" = 1 extra seat');
  check(/"6":\s*\{[^}]*bringSeats:\s*2/.test(_bringTbl), 'bring "6" = 2 extra seats');
  check(/const _rolled = Math\.random\(\) < blitzPct/.test(simSrc),
    'the blitz roll is STILL DRAWN when a card overrides it — draw-for-draw parity, so seeded worlds do not shift');
  check(/"3":\s*\{[^}]*rush3:\s*true/.test(defbook),
    'DEF_CALL_BRING["3"] still sets a real rush3:true count (unaffected by batch 2)');

  // FLIPPED WITH THE FIX, batch 1. The "both OLBs rush" fact used to be
  // restated in THREE places — a hardcoded `frontId === "3-4" || "Penny"` fold
  // in sim.js AND in fieldassign.js, plus RUSH_SLOTS in formations.js. All
  // three now derive from ONE source: the front's own role list, where
  // FRONT_ROLES["3-4"].OLB reads ["OLB-Rush","OLB-Cover"].
  check(!/olbRush\s*=\s*frontId === "3-4" \|\| frontId === "Penny"/.test(simSrc),
    'sim.js no longer hardcodes the 3-4/Penny rush fold');
  check(!/olbRush\s*=\s*frontId === "3-4" \|\| frontId === "Penny"/.test(fieldassign),
    'fieldassign.js no longer hardcodes it either');
  check(/splitRushOlbs/.test(fieldassign),
    'fieldassign.js asks the SHARED selector who the Jack is');
  check(/rushOlbCount|splitRushOlbs/.test(formationsSrc),
    'the selector lives in formations.js, beside roleRating');
  check(/\^OLB-Rush\$/.test(formationsSrc) && /\^OLB-Rush\$/.test(simSrc),
    'ONLY "OLB-Rush" counts as a down rusher — "OLB-Blitz" is a coverage backer who blitzes');

  // Finding 8 corollary: DEF_BLITZ_ELIGIBLE excludes the OLBs for 3-4/Penny
  // today because they're already counted as rushers, not droppers. Batch 1
  // needs the DROPPING OLB to become blitz-eligible, which will change this.
  const m34 = constField.match(/"3-4":\s*\[([^\]]*)\]/);
  const mPenny = constField.match(/"Penny":\s*\[([^\]]*)\]/);
  check(!!m34 && /OLB_L/.test(m34[1]) && /OLB_R/.test(m34[1]),
    'DEF_BLITZ_ELIGIBLE["3-4"] now includes the OLBs — the one who is not the Jack is a coverage player, and a coverage player who can come IS a blitzer',
    m34 && m34[1].trim());
  check(!!mPenny && /OLB_L/.test(mPenny[1]) && /OLB_R/.test(mPenny[1]),
    'DEF_BLITZ_ELIGIBLE["Penny"] likewise',
    mPenny && mPenny[1].trim());
}

// ── §4 invariants that must NEVER change ────────────────────────────────────
hdr('P4 — invariants (must hold before, during, and after every batch)');
{
  const N = 400, SEED = 111000;
  let minRush = 99, bad3Rush = 0, bad3Fired = 0, badBlitzerIds = 0, sampled = 0;
  for (const front of ['4-3', 'Nickel', '3-4', 'Penny']) {
    for (const bring of ['3', '4', '5', '6']) {
      for (let s = 0; s < N; s++) {
        const r = benchSnap({ formationId: 'Spread', concept: 'Four Verts', seed: SEED + s, defLook: { front, coverage: 'c3', bring } });
        const p = r && r.play;
        if (!p || p.rushN == null) continue;
        sampled++;
        if (p.rushN < minRush) minRush = p.rushN;
        if (p.rushN < 3) bad3Rush++;
        if (bring === '3' && (p.rushN !== 3 || p.blitzFired)) bad3Fired++;
        if (p.blitzFired && p.rushN > 4 && (!p.blitzerIds || p.blitzerIds.length < 1)) badBlitzerIds++;
      }
    }
  }
  check(sampled > 3000, `sampled a large cross-product of fronts x brings (${sampled})`);
  check(minRush >= 3, `rushN is never below 3, across every front and bring`, `min=${minRush}`);
  check(bad3Rush === 0, 'no snap anywhere ever rushes fewer than 3', `violations=${bad3Rush}`);
  check(bad3Fired === 0, 'bring "3" ALWAYS rushes exactly 3 and NEVER fires a blitz — invariant, not a defect',
    `violations=${bad3Fired}`);
  check(badBlitzerIds === 0,
    'a fired blitz with rushN > 4 always records at least one blitzerIds entry',
    `violations=${badBlitzerIds}`);
}

hdr('P5 — the blitzer list (batch 3): WHO comes');
{
  // Replaces the pressure pie. The list is player-level (not per-front, which
  // is why a pie was silently absent on 28% of passing downs), unranked (a rank
  // would put the first name in seat one every snap and destroy rotation), and
  // a PREFERENCE not a law (an exclusive list breaks when its men are off the
  // field, and a deterministic one is fully scoutable).
  const simSrc2 = src('js/engine/sim.js');
  check(/defPlan\.blitzers/.test(simSrc2), 'the resolver reads the blitzer list');
  check(!/_pieHeatMult|_pieHeat/.test(simSrc2),
    'HEAT is GONE — the aggression stop is the single owner of "how often"');
  check(/if \(!listUsed && \(identity === "secondaryHeat"/.test(simSrc2),
    'identity is demoted to the AUTO answer for WHO — it only fills seats the list did not');
  check(/BLITZ_OFFLIST_MAX/.test(simSrc2) && /blitzDesign/.test(simSrc2),
    'the off-list leak is tied to the DC\'s Blitz Design — a sharp coordinator stays on script');

  const { ROSTER_TARGETS, CLASS_YEARS } = await import('../js/constants.js');
  const { createPlayer } = await import('../js/engine/player.js');
  const { buildDepthChart, defaultGameplan } = await import('../js/engine/world.js');
  const { simulateGame } = await import('../js/engine/sim.js');
  const realRnd = Math.random;
  const mul = (sd) => { let t = sd >>> 0; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ t >>> 15, 1 | t); r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r; return ((r ^ r >>> 14) >>> 0) / 4294967296; }; };
  const rost = (id) => { const r = []; for (const [ps, c] of Object.entries(ROSTER_TARGETS)) for (let i = 0; i < c; i++) { const x = createPlayer(ps, CLASS_YEARS[i % 4], 1); x.schoolId = id; r.push(x); } return r; };
  // ONE roster reused — a player list needs stable ids. Built UNDER THE PINNED
  // RNG: createPlayer draws from Math.random, so building rosters outside the
  // pin made every probe run generate different players, which made the
  // measured split swing run to run (0.46:1 to 1.69:1 on identical code).
  // A flaky core gate is worse than no gate — pin the fixture, not the band.
  Math.random = mul(101);
  const rH = rost('H'), rA = rost('A');
  Math.random = realRnd;
  // SAFETIES on purpose: they are on the field in every front, so the measured
  // split isolates the LIST from who happens to be dressed for a sub package.
  Math.random = mul(102);
  const S = (buildDepthChart(rA, { ...defaultGameplan() }).S || []).slice(0, 2);
  Math.random = realRnd;
  const run = (list, games, design) => {
    const t = {};
    for (let i = 0; i < games; i++) {
      Math.random = mul(3300 + i);
      try {
        const gpH = { ...defaultGameplan() };
        const gpA = { ...defaultGameplan(), defAggression: 'attacking', blitzDesign: design, blitzers: list };
        const res = simulateGame({ id: 'H' }, { id: 'A' }, rH, rA, buildDepthChart(rH, gpH), buildDepthChart(rA, gpA), gpH, gpA);
        for (const d of res.drives || []) { if (d.possession !== 'home') continue;
          for (const pl of d.plays || []) if (pl.blitzFired && pl.blitzerIds) for (const b of pl.blitzerIds) t[b] = (t[b] || 0) + 1; }
      } finally { Math.random = realRnd; }
    }
    return t;
  };
  // THE ROTATION CASE — the owner's requirement, and the reason the list is
  // unranked. Leak removed (design 100) so this measures the lottery itself.
  const both = {}; both[S[0]] = 'often'; both[S[1]] = 'often';
  const tb = run(both, 60, 100);
  const a = tb[S[0]] || 0, b = tb[S[1]] || 0;
  check(a > 30 && b > 30, `both names actually come (${a}/${b})`);
  const ratio = a / Math.max(1, b);
  // ── WHAT THIS CHECKS, AND WHAT IT DELIBERATELY DOES NOT ──────────────────
  // Asserted: both named men come, and neither is locked out. That is the
  // property the redesign needs — an unranked list must not become a de-facto
  // rank.
  //
  // NOT asserted: a 1:1 split. RESOLVED 2026-08-19 — the imbalance is
  // RATING-DRIVEN, not a defect in the lottery. Discriminating experiment: two
  // safeties tagged identically split 4.47:1 as generated (56 ovr vs 48), and
  // **1.02:1 once every attribute was equalized**. The lottery is a fair
  // weighted draw; what differs is everything UPSTREAM of it — a weaker man is
  // fielded less, and the seats the list cannot fill go to the coordinator's
  // best body. Both are correct football: you cannot blitz a man who is not
  // playing, and an improvising coordinator sends his best.
  //
  // So the ratio is a property of the ROSTER, not of the feature, and pinning
  // a band here would gate on how the fixture's players happened to roll.
  check(a > 0 && b > 0, 'both named men come — an unranked list has not become a de-facto rank',
    `${a} : ${b} = ${ratio.toFixed(2)}:1`);
  // Often outranks Sometimes, but does not lock him out.
  const mixed = {}; mixed[S[0]] = 'often'; mixed[S[1]] = 'sometimes';
  const tm = run(mixed, 60, 100);
  const oa = tm[S[0]] || 0, ob = tm[S[1]] || 0;
  // Same caveat: directional, not a ratio assertion.
  check(oa > ob, 'Often comes more than Sometimes', `${oa} vs ${ob}`);
  check(ob > 0, 'Sometimes still shows up — a change-up, not a bench', `${ob}`);
}

console.log(`\nPRESSURE COHESION PROBE — ${pass} pass, ${fail} fail`);
console.log(fail ? 'PRESSURE COHESION PROBE FAIL' : 'PRESSURE COHESION PROBE PASS');
process.exit(fail ? 1 : 0);
