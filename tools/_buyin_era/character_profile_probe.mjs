// character_profile_probe.mjs — W1 (Buy-In §11/§13) distribution probe.
// Verifies the createRecruit rewrite:
//   P1  Character is DIVISION-INDEPENDENT (grind means flat across tier/prestige)
//   P2  WE mirrors grind exactly (the sim keeps reading the same number)
//   P3  GPA↔grind correlated at seed (r > 0.5), GPA stays in [1.0, 4.0]
//   P4  Ceiling bands include capped/descending at their designed rates,
//       and capped/descending caps hug current attributes (no real headroom)
//   P5  Dev profile generates (curve mix ≈ DEV_CURVE_W, volatility spreads)
//   P6  Ego is a tail flag (~egoRate), facets middle-heavy with real tails
//   P7  Walk-ons keep character independent of the talent crush; GPA ≥ 2.0
//   P8  Migration: a legacy-shaped player gains a profile with neutral
//       defaults, grind === old WE, and nothing else changes
// Run: node tools/character_profile_probe.mjs
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
Math.random = mulberry32(0xB0071E5);

const { createRecruit, createWalkOn, createPlayer, ensureProfile, characterRating } = await import('../js/engine/player.js');
const { C, POSITIONS } = await import('../js/constants.js');

const N = 4000;
let fails = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fails++;
};
const mean = xs => xs.reduce((s, x) => s + x, 0) / xs.length;
const sd = xs => { const m = mean(xs); return Math.sqrt(mean(xs.map(x => (x - m) ** 2))); };
const corr = (xs, ys) => {
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) { const dx = xs[i]-mx, dy = ys[i]-my; sxy += dx*dy; sxx += dx*dx; syy += dy*dy; }
  return sxy / Math.sqrt(sxx * syy);
};
const posPool = POSITIONS.filter(p => !['K','P'].includes(p));
const gen = (tier, pb, n = N) => Array.from({ length: n }, (_, i) =>
  createRecruit(posPool[i % posPool.length], tier, 40, -82, pb));

// ── P1: division independence ────────────────────────────────────────────
const d3 = gen(1, 0), d2 = gen(2, 0), d1 = gen(3, 3), d1elite = gen(3, 6);
const gm = pool => mean(pool.map(r => r.character.grind));
const grinds = [gm(d3), gm(d2), gm(d1), gm(d1elite)];
const grindSpread = Math.max(...grinds) - Math.min(...grinds);
check('P1 grind mean flat across tiers/prestige', grindSpread < 2.0,
  `means D3/D2/D1/D1+6★ = ${grinds.map(x => x.toFixed(1)).join(' / ')} (spread ${grindSpread.toFixed(2)}, was ~tier-scaled before W1)`);
const cm = pool => mean(pool.map(r => r.character.coachability));
const cSpread = Math.abs(cm(d3) - cm(d1elite));
check('P1 coachability mean flat across divisions', cSpread < 2.0, `Δ=${cSpread.toFixed(2)}`);

// ── P2: WE mirrors grind ─────────────────────────────────────────────────
const all = [...d3, ...d2, ...d1, ...d1elite];
check('P2 attributes.WE === character.grind on every recruit',
  all.every(r => r.attributes.WE === r.character.grind));

// ── P3: GPA correlation ──────────────────────────────────────────────────
const r_gpa = corr(all.map(r => r.character.grind), all.map(r => r.gpa));
check('P3 grind↔GPA correlation', r_gpa > 0.5, `r = ${r_gpa.toFixed(3)} (was 0 before W1)`);
check('P3 GPA bounds', all.every(r => r.gpa >= 1.0 && r.gpa <= 4.0),
  `min ${Math.min(...all.map(r=>r.gpa))}, max ${Math.max(...all.map(r=>r.gpa))}`);

// ── P4: ceiling bands ────────────────────────────────────────────────────
const bandCount = {};
for (const r of all) bandCount[r.potentialBand] = (bandCount[r.potentialBand] || 0) + 1;
const rate = b => (bandCount[b] || 0) / all.length;
console.log(`      band mix: ${Object.entries(bandCount).map(([b,n]) => `${b} ${(100*n/all.length).toFixed(1)}%`).join(' · ')}`);
check('P4 capped band exists at designed rate', Math.abs(rate('capped') - (C.CEIL_EXTRA_W?.capped ?? 0.12)) < 0.03, `${(rate('capped')*100).toFixed(1)}%`);
check('P4 descending band exists (rare)', rate('descending') > 0.01 && rate('descending') < 0.06, `${(rate('descending')*100).toFixed(1)}%`);
const noHeadroom = all.filter(r => r.potentialBand === 'capped' || r.potentialBand === 'descending')
  .map(r => mean(Object.keys(r.attributes).map(a => (r.potentialCaps[a] ?? r.attributes[a]) - r.attributes[a])));
check('P4 capped/descending caps hug current attrs', mean(noHeadroom) < 6,
  `avg headroom ${mean(noHeadroom).toFixed(1)} pts (sky band ~${mean(all.filter(r=>r.potentialBand==='sky').map(r => mean(Object.keys(r.attributes).map(a => (r.potentialCaps[a] ?? r.attributes[a]) - r.attributes[a])))).toFixed(1)})`);

// ── P5: dev profile ──────────────────────────────────────────────────────
const curves = {};
for (const r of all) curves[r.devProfile.curve] = (curves[r.devProfile.curve] || 0) + 1;
const w = C.DEV_CURVE_W || { early: 0.26, steady: 0.48, late: 0.26 };
check('P5 curve mix matches DEV_CURVE_W',
  ['early','steady','late'].every(k => Math.abs((curves[k]||0)/all.length - w[k]) < 0.03),
  ['early','steady','late'].map(k => `${k} ${(100*(curves[k]||0)/all.length).toFixed(1)}%`).join(' · '));
const vols = all.map(r => r.devProfile.volatility);
check('P5 volatility spreads (sd > 12, spans tails)', sd(vols) > 12 && Math.min(...vols) < 20 && Math.max(...vols) > 80,
  `mean ${mean(vols).toFixed(1)}, sd ${sd(vols).toFixed(1)}`);

// ── P6: ego tail + facet tails ───────────────────────────────────────────
const egoRate = all.filter(r => r.character.ego).length / all.length;
check('P6 ego is a tail flag', Math.abs(egoRate - (C.CHARACTER_GEN?.egoRate ?? 0.09)) < 0.02, `${(egoRate*100).toFixed(1)}%`);
const gymRats = all.filter(r => r.character.grind >= 85).length / all.length;
const divas = all.filter(r => r.character.grind <= 24).length / all.length;
check('P6 real tails: gym rats AND low-grind kids exist at every division',
  gymRats > 0.02 && divas > 0.02 &&
  d3.some(r => r.character.grind >= 85) && d1elite.some(r => r.character.grind <= 24),
  `grind≥85: ${(gymRats*100).toFixed(1)}%, grind≤24: ${(divas*100).toFixed(1)}%`);
check('P6 character aggregate computes in range',
  all.every(r => { const v = characterRating(r); return v >= 1 && v <= 99; }));

// ── P7: walk-ons ─────────────────────────────────────────────────────────
const wos = Array.from({ length: 800 }, (_, i) => createWalkOn(posPool[i % posPool.length]));
const woGrind = mean(wos.map(p => p.character.grind));
check('P7 walk-on character survives the talent crush', Math.abs(woGrind - gm(d3)) < 3 && wos.some(p => p.character.grind >= 85),
  `walk-on grind mean ${woGrind.toFixed(1)} vs pool ${gm(d3).toFixed(1)}; gym-rat walk-ons exist: ${wos.filter(p=>p.character.grind>=85).length}`);
check('P7 walk-on WE still mirrors grind', wos.every(p => p.attributes.WE === p.character.grind));
check('P7 walk-on GPA floor 2.0', wos.every(p => p.gpa >= 2.0));

// ── P8: migration ────────────────────────────────────────────────────────
const legacy = createPlayer('WR', 'JR', 2, 0);
delete legacy.character; delete legacy.devProfile;
legacy.attributes.WE = 73;
const before = JSON.stringify(legacy.attributes);
ensureProfile(legacy);
check('P8 migration: grind === legacy WE', legacy.character?.grind === 73);
check('P8 migration: neutral defaults', legacy.devProfile?.curve === 'steady' && legacy.devProfile?.volatility === 50 && legacy.character?.ego === false);
check('P8 migration: attributes untouched', JSON.stringify(legacy.attributes) === before);
check('P8 migration: idempotent', (() => { const g = legacy.character.grind; ensureProfile(legacy); return legacy.character.grind === g; })());
const fresh = createPlayer('CB', 'SR', 3, 4);
check('P8 createPlayer keeps grind mirrored after year boost', fresh.character.grind === fresh.attributes.WE);

console.log(fails === 0 ? '\nALL CHECKS PASS' : `\n${fails} CHECK(S) FAILED`);
process.exit(fails === 0 ? 0 : 1);
