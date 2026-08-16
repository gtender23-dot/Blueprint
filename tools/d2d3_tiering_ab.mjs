// d2d3_tiering_ab — Season Mode Part B: D2/D3 conference tiering in the DEFAULT
// procedural world. D1 keeps its power/mid-major split; D2/D3 used to be flat
// (every conference the same tier). A per-conference prestige offset (averaging
// ~0 across each division) now makes strong and weak conferences emerge. This
// gates the two things that matter: TEXTURE (between-conference variance is
// clearly higher than the near-flat baseline) and MEAN NEUTRALITY (the division
// prestige mean — and thus talent/balance — is preserved, so the census and sim
// bands don't move, verified separately by pos_ovr_census + stat_realism).
//
// Measured on a fresh procedural world. Unseeded RNG, so a single generation is
// noisy — bounds are loose and the entry is seedFlaky (one retry). Baselines:
// pre-change variance D2 ~0.07 / D3 ~0.03; post-change ~0.38 / ~0.23.
import { SCHOOL_DATA } from '../js/engine/world.js';
import { C } from '../js/constants.js';

let pass = 0, fail = 0;
const bad = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; bad.push(msg); } }

function stats(div) {
  const sch = SCHOOL_DATA.filter((s) => s.division === div);
  const mean = sch.reduce((a, s) => a + s.prestige, 0) / sch.length;
  const confs = [...new Set(sch.map((s) => s.conf))];
  const confMeans = confs.map((c) => {
    const g = sch.filter((s) => s.conf === c);
    return g.reduce((a, s) => a + s.prestige, 0) / g.length;
  });
  const variance = confMeans.reduce((a, m) => a + (m - mean) ** 2, 0) / confMeans.length;
  return { mean, variance, confMeans, cap: (C.PRESTIGE_MAX || {})[div] };
}

const d2 = stats('D2');
const d3 = stats('D3');

// ── TEXTURE: strong and weak conferences now exist ──────────────────────────
ok(d2.variance > 0.12, `D2 has conference texture (between-conf variance ${d2.variance.toFixed(3)} > 0.12; baseline ~0.07)`);
ok(d3.variance > 0.07, `D3 has conference texture (between-conf variance ${d3.variance.toFixed(3)} > 0.07; baseline ~0.03)`);
ok(d2.confMeans.some((m) => m > d2.mean + 0.3) && d2.confMeans.some((m) => m < d2.mean - 0.3), 'D2 has both a clearly-strong and a clearly-weak conference');
ok(d3.confMeans.some((m) => m > d3.mean + 0.3) && d3.confMeans.some((m) => m < d3.mean - 0.3), 'D3 has both a clearly-strong and a clearly-weak conference');

// ── MEAN NEUTRALITY: overall talent preserved (baselines 2.13 / 1.61) ───────
ok(d2.mean >= 1.9 && d2.mean <= 2.4, `D2 mean prestige preserved (${d2.mean.toFixed(2)} ∈ [1.9,2.4]; baseline 2.13)`);
ok(d3.mean >= 1.4 && d3.mean <= 1.85, `D3 mean prestige preserved (${d3.mean.toFixed(2)} ∈ [1.4,1.85]; baseline 1.61)`);

// ── BAND: still within the division caps ────────────────────────────────────
ok(SCHOOL_DATA.filter((s) => s.division === 'D2').every((s) => s.prestige >= 1 && s.prestige <= d2.cap), 'every D2 school within the division band');
ok(SCHOOL_DATA.filter((s) => s.division === 'D3').every((s) => s.prestige >= 1 && s.prestige <= d3.cap), 'every D3 school within the division band');

console.log(`D2/D3 TIERING A/B — D2 mean ${d2.mean.toFixed(2)} var ${d2.variance.toFixed(2)} | D3 mean ${d3.mean.toFixed(2)} var ${d3.variance.toFixed(2)}`);
console.log(`  ${pass} pass, ${fail} fail`);
if (fail) { console.log('  FAILURES:'); bad.forEach((m) => console.log('   -', m)); }
console.log(fail ? 'D2/D3 TIERING A/B FAIL' : 'D2/D3 TIERING A/B PASS');
process.exit(fail ? 1 : 0);
