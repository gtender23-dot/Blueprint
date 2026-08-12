// hc_mastery_probe.mjs — DNA TREE §5b.2: HC formation mastery + the stacking
// cap. Pass 4 — the ONE outcome-touching piece, band-gated.
//
//   M1  The sheet: rolled at seed inside [BASE_MIN, BASE_MAX], spans both
//       offensive formations and defensive fronts.
//   M2  Living record: called formations grow to the ceiling; shelved ones
//       rust back to the rolled floor and stop.
//   M3  THE STACKING LAW: for EVERY coordinator IQ × mastery IQ pair — the
//       whole grid — formationIqMod ≤ ENVELOPE_MAX, and at a maxed
//       coordinator the mastery bonus reads EXACTLY ZERO. A maxed tree can
//       never out-read what a maxed coordinator reads today.
//   M4  Small: the maximum mastery bonus is a minor fraction of the
//       coordinator envelope span (fills, never dominates).
//   M5  AI NEUTRALITY, bit-exact: for a school whose coach is AI (or absent),
//       formationIqMod ≡ the raw coordinator formula on every input.
//   N1  Zero-migration: an old-save player coach (no sheet) passes through
//       the sim accessor and the grow without a throw; the sheet seeds lazily.
//
// Run: node tools/hc_mastery_probe.mjs
const _ls = new Map();
global.localStorage = {
  getItem: (k) => (_ls.has(k) ? _ls.get(k) : null),
  setItem: (k, v) => _ls.set(k, String(v)),
  removeItem: (k) => _ls.delete(k),
};

const { C, FORMATIONS, DEF_FRONTS } = await import('../js/constants.js');
const S = await import('../js/engine/staff.js');

const M = C.HC_MASTERY;
let pass = 0, fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}`); ok ? pass++ : fail++; };
const hdr = (s) => console.log(`\n${s}`);
const FORMS = Object.keys(FORMATIONS), FRONTS = Object.keys(DEF_FRONTS);

// ── M1: the sheet ──────────────────────────────────────────────────────────
hdr('M1 — the sheet seeds inside its window and spans both sides');
{
  let lo = 999, hi = -1, missing = 0;
  for (let i = 0; i < 100; i++) {
    const pc = { isAI: false };
    S.ensureHCMastery(pc);
    for (const s of [...FORMS, ...FRONTS]) {
      const v = pc.masteryIQ[s];
      if (v == null) missing++;
      else { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    }
  }
  check(missing === 0, `every formation AND front is on the sheet (missing: ${missing})`);
  check(lo >= M.BASE_MIN && hi <= M.BASE_MAX, `baselines span [${lo}, ${hi}] within [${M.BASE_MIN}, ${M.BASE_MAX}]`);
  const ai = { isAI: true };
  S.ensureHCMastery(ai);
  check(!ai.masteryIQ, 'an AI coach never grows a sheet — the player is the only one who coaches');
}

// ── M2: living record ──────────────────────────────────────────────────────
hdr('M2 — calls grow it, the shelf rusts it, the rolled floor holds');
{
  const pc = { isAI: false };
  S.ensureHCMastery(pc);
  const called = FORMS[0], shelved = FORMS[1], front = FRONTS[0];
  pc.masteryIQ[shelved] = pc.masteryBase[shelved] + 7;
  const shelfFloor = pc.masteryBase[shelved];
  const gp = { offFormations: [{ id: called, weight: 100 }], defFront: front };
  const calledBefore = pc.masteryIQ[called], frontBefore = pc.masteryIQ[front];
  for (let y = 0; y < 20; y++) S.growHCMastery(pc, gp);
  check(pc.masteryIQ[called] > calledBefore, `the called formation grew (${calledBefore} → ${pc.masteryIQ[called]})`);
  check(pc.masteryIQ[front] > frontBefore, `the called FRONT grew too (${frontBefore} → ${pc.masteryIQ[front]}) — both sides live`);
  check(pc.masteryIQ[called] <= M.CEILING, `growth respects the ceiling (${M.CEILING})`);
  check(pc.masteryIQ[shelved] === shelfFloor, `the shelved formation rusted to its rolled floor and STOPPED (${shelfFloor + 7} → ${pc.masteryIQ[shelved]})`);
}

// ── M3: THE STACKING LAW — the whole grid ──────────────────────────────────
hdr('M3 — the cap holds on every coordinator×mastery pair; maxed coord ⇒ zero bonus');
{
  const scheme = FORMS[0];
  let capViolations = 0, worst = 0;
  for (let coordIQ = 25; coordIQ <= 92; coordIQ++) {
    for (let mastery = 0; mastery <= M.CEILING; mastery += 5) {
      const school = {
        staff: { oc: { side: 'OC', schemeIQ: { [scheme]: coordIQ }, ratings: {} }, dc: null },
        coach: { isAI: false, masteryIQ: { [scheme]: mastery } },
      };
      const mod = S.formationIqMod(school, 'off', scheme);
      if (mod > M.ENVELOPE_MAX + 1e-12) capViolations++;
      worst = Math.max(worst, mod);
    }
  }
  check(capViolations === 0, `0 cap violations across the full 68×18 grid (worst mod ${worst.toFixed(4)} ≤ ${M.ENVELOPE_MAX})`);
  const maxedCoordSchool = {
    staff: { oc: { side: 'OC', schemeIQ: { [scheme]: 92 }, ratings: {} }, dc: null },
    coach: { isAI: false, masteryIQ: { [scheme]: M.CEILING } },
  };
  const noMasterySchool = {
    staff: { oc: { side: 'OC', schemeIQ: { [scheme]: 92 }, ratings: {} }, dc: null },
    coach: { isAI: true },
  };
  const withM = S.formationIqMod(maxedCoordSchool, 'off', scheme);
  const withoutM = S.formationIqMod(noMasterySchool, 'off', scheme);
  check(withM === withoutM, `maxed coordinator + maxed mastery reads EXACTLY today's maxed coordinator (${withM.toFixed(4)}) — mastery fills the envelope, never raises it`);
}

// ── M4: small ──────────────────────────────────────────────────────────────
hdr('M4 — the effect is small: a fill, not a second coordinator');
{
  const maxBonus = M.SCALE * M.CEILING;
  const envelopeSpan = C.FORMATION_IQ_SCALE * (92 - 25);
  const frac = maxBonus / envelopeSpan;
  console.log(`  max mastery bonus +${maxBonus.toFixed(4)} vs coordinator envelope span ${envelopeSpan.toFixed(4)} (${(frac * 100).toFixed(0)}%)`);
  check(frac <= 0.25, `max mastery ≤ 25% of the coordinator span (${(frac * 100).toFixed(0)}%)`);
  check(maxBonus <= 0.025, `absolute max bonus +${maxBonus.toFixed(4)} — about 2% on one factor of one play`);
}

// ── M5: AI neutrality, bit-exact ───────────────────────────────────────────
hdr('M5 — AI schools read the raw coordinator formula, bit for bit');
{
  let diffs = 0;
  for (let iq = 25; iq <= 92; iq++) {
    for (const coachShape of [{ isAI: true }, null, { isAI: true, masteryIQ: { X: 85 } }]) {
      const school = { staff: { oc: { side: 'OC', schemeIQ: { X: iq }, ratings: {} }, dc: null }, coach: coachShape };
      const stacked = S.formationIqMod(school, 'off', 'X');
      const raw = C.FORMATION_IQ_BASE + C.FORMATION_IQ_SCALE * iq;
      if (stacked !== Math.min(M.ENVELOPE_MAX, raw)) diffs++;
    }
  }
  check(diffs === 0, `AI/absent/impossible-sheet coaches: ${diffs} deviations from the raw formula across all IQs — league play untouched`);
}

// ── N1: zero-migration ─────────────────────────────────────────────────────
hdr('N1 — an old-save player coach without a sheet passes through everything');
{
  const pc = { isAI: false }; // old save: no masteryIQ, no masteryBase
  const school = { staff: { oc: { side: 'OC', schemeIQ: { [FORMS[0]]: 60 }, ratings: {} }, dc: null }, coach: pc };
  let threw = false;
  let mod = null;
  try {
    mod = S.formationIqMod(school, 'off', FORMS[0]); // sheet absent: bonus 0
    S.growHCMastery(pc, { offFormations: [{ id: FORMS[0], weight: 100 }], defFront: FRONTS[0] });
  } catch (e) { threw = true; console.log('  threw:', e.message); }
  check(!threw, 'accessor + grow on a sheet-less coach: no throw');
  check(mod === C.FORMATION_IQ_BASE + C.FORMATION_IQ_SCALE * 60, 'before the sheet exists, the mod is exactly the coordinator formula (bonus 0)');
  check(!!pc.masteryIQ && !!pc.masteryBase, 'and the first wrap-up seeds the sheet lazily — zero-migration');
}

console.log(`\n${'='.repeat(50)}\n${fail === 0 ? 'ALL GREEN' : 'FAILURES: ' + fail} (${pass} passed)`);
process.exit(fail ? 1 : 0);
