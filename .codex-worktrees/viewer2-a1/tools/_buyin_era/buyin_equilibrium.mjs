// buyin_equilibrium.mjs — W10 §7: WHERE DOES THE PROGRAM BUY-IN METER SETTLE?
//
// Why this exists. The full drift probe answers "is the league flat" but costs
// ~50 minutes a run, which is far too slow to TUNE against — and tuning by
// algebra failed here twice. The first cut derived lossBump 0.36 from the ramp
// (winBump·(99−v) = lossBump·(v−1) ⇒ equilibrium 55) and the league came back
// at ~43 with a −0.15/season downward drift, because the derivation ignored the
// season-settlement channel, whose underMult 1.6 is a net drain league-wide.
//
// So: isolate the meter. Every school plays a .500 season against the same
// distribution, the settlement runs on expectations it mostly meets, coaches
// turn over on the carousel — and NOTHING else in the game is present. That
// makes the meter's own fixed point measurable in milliseconds instead of an
// hour, and it makes the answer attributable: if it settles here, it is the
// meter doing it, not the sim.
//
// Run:  node tools/buyin_equilibrium.mjs [--years 40] [--sweep]

const argv = process.argv.slice(2);
const YEARS = parseInt(argv.includes('--years') ? argv[argv.indexOf('--years') + 1] : '40', 10);
const SWEEP = argv.includes('--sweep');

function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}

const { C } = await import('../js/constants.js');
const dev = await import('../js/engine/development.js');
const { onGameResultBuyIn, settleProgramBuyIn, programBuyIn, ensureProgramBuyIn } = dev;

const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
function slope(xs, ys) {
  const mx = mean(xs), my = mean(ys);
  let n = 0, d = 0;
  for (let i = 0; i < xs.length; i++) { n += (xs[i] - mx) * (ys[i] - my); d += (xs[i] - mx) ** 2; }
  return d ? n / d : 0;
}

// A league of schools with nothing but a prestige and a Buy-In meter.
function run(lossBump, badLossBump, years = YEARS, seed = 0x51F2C0DE) {
  const rand = mulberry32(seed);
  const prev = [C.BUYIN.lossBump, C.BUYIN.badLossBump];
  C.BUYIN.lossBump = lossBump; C.BUYIN.badLossBump = badLossBump;
  const N = 300, GAMES = 12;
  const schools = [];
  for (let i = 0; i < N; i++) {
    schools.push({ id: `s${i}`, name: `S${i}`, prestige: 1 + Math.floor(rand() * 5), coach: { id: `c${i}` } });
  }
  for (const s of schools) ensureProgramBuyIn(s);
  const series = [];
  for (let y = 1; y <= years; y++) {
    // A round of games. Pairings are random, so over a season every program is
    // near .500 against a spread of prestiges — the league's own average team.
    for (let g = 0; g < GAMES; g++) {
      const order = schools.slice().sort(() => rand() - 0.5);
      for (let i = 0; i + 1 < order.length; i += 2) {
        const a = order[i], b = order[i + 1];
        // Better program wins more often, but not always — that's what makes
        // upsets (and bad losses) fire at a realistic rate.
        const pA = 0.5 + (a.prestige - b.prestige) * 0.08;
        const aWins = rand() < pA;
        onGameResultBuyIn(aWins ? a : b, aWins ? b : a);
      }
    }
    // Season settlement against expectations, then the carousel: a slice of
    // seats turn over each year and a new hire resets the meter to the floor.
    // settleProgramBuyIn takes a DELTA (actual − expected wins) and already
    // advances bi.seasons itself. Expectations track prestige, so delta is
    // mean-zero noise league-wide — and that is exactly the point: underMult
    // makes the misses cost more than the beats pay, so a mean-zero delta is
    // still a net DRAIN. That drain is what the ramp algebra missed.
    for (const s of schools) {
      const expected = GAMES * (0.5 + (s.prestige - 3) * 0.07);
      const actual = expected + (rand() + rand() + rand() - 1.5) * 2.2;  // ~N(0, 1.1) games
      settleProgramBuyIn(s, actual - expected);
      if (rand() < 0.12) {                     // ~12%/yr carousel turnover
        s.coach = { id: `c${s.id}-${y}` };
        ensureProgramBuyIn(s);                 // re-keys to the new coach
      }
    }
    series.push(mean(schools.map(s => programBuyIn(s))));
  }
  C.BUYIN.lossBump = prev[0]; C.BUYIN.badLossBump = prev[1];
  const warm = Math.floor(years / 3);
  const win = series.slice(warm);
  const xs = win.map((_, i) => i + warm + 1);
  return { series, level: mean(win.slice(-5)), slope: slope(xs, win) };
}

if (!SWEEP) {
  const r = run(C.BUYIN.lossBump, C.BUYIN.badLossBump);
  console.log(`lossBump ${C.BUYIN.lossBump} → settles ${r.level.toFixed(2)}, slope ${r.slope >= 0 ? '+' : ''}${r.slope.toFixed(4)}/season`);
  console.log(r.series.map((v, i) => `  y${String(i + 1).padStart(2)} ${v.toFixed(2)}`).join('\n'));
} else {
  console.log('=== W10 lossBump sweep — the meter in isolation ===\n');
  console.log('  lossBump   badLoss    settles    slope/season');
  let best = null;
  for (const lb of [0, 0.10, 0.15, 0.20, 0.24, 0.26, 0.28, 0.30, 0.32, 0.36, 0.45]) {
    const bad = lb * 2.5;
    const r = run(lb, bad);
    const flat = Math.abs(r.slope);
    if (best === null || flat < best.flat) best = { lb, bad, flat, level: r.level, slope: r.slope };
    console.log(`  ${String(lb).padEnd(10)} ${bad.toFixed(2).padEnd(10)} ${r.level.toFixed(2).padEnd(10)} ${(r.slope >= 0 ? '+' : '')}${r.slope.toFixed(4)}`);
  }
  console.log(`\n  FLATTEST: lossBump ${best.lb} (badLossBump ${best.bad.toFixed(2)}) — settles ${best.level.toFixed(2)}, slope ${(best.slope >= 0 ? '+' : '')}${best.slope.toFixed(4)}/season`);
}
