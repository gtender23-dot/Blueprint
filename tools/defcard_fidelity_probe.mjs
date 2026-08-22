// defcard_fidelity_probe.mjs — DOES THE CARD TELL THE TRUTH?
// Run: node tools/defcard_fidelity_probe.mjs [gamesPerCard]
//
// The defensive call card is the one screen whose entire job is to show the
// coach what he just called. Nothing has ever checked the drawing against the
// snap. This does: it renders a card, forces that exact call through the real
// sim, and asserts the picture and the game agree.
//
// The COUNT half was already covered — `rushN` is recorded per snap and both
// defsheet_probe and pressure_cohesion_probe gate on it. What was missing is
// IDENTITY, so sim.js now records `rushSlots` / `dropSlots` alongside the
// `covSlots` that coverage already had (recording only; nothing reads them).
//
// Pins:
//   A. COUNT      — the card draws N rush arrows; the sim's modal rushN is N.
//   B. RUSHERS    — every man drawn rushing actually rushes, most snaps.
//   C. COVERAGE   — a card drawn with man lines plays man; zones play zone.
//   D. THE DROP   — a card that bends a lineman into coverage drops one; a
//                   card that doesn't, doesn't.
import { DEF_CALL_COVERAGES, cardToDefCall, callFitsFront } from '../js/engine/defbook.js';
import { COV_FAMILY } from '../js/constants.js';
import { renderDefCallCard } from '../js/ui/views/routeart.js';
import { DEF_FIELD_LAYOUTS, DEF_BLITZ_ELIGIBLE } from '../js/constants_field.js';
import { benchSnap } from '../js/engine/bench.js';

const WANT = parseInt(process.argv[2] || '60', 10);
// Which shipped coverages are MAN coverages, stated as football rather than
// read back out of the table under test.
const MAN_COVERAGES = new Set(['Cover 1', 'Cover 0', 'Cover 2-Man', 'Cover 5']);
// What the sim should NAME the coverage a card called. A fire zone is still
// the same shell, so a C3 call that fires reads as a Cover 3 family member.
const NAME_OF = { c1: 'Cover 1', c3: 'Cover 3', c2: 'Cover 2', c2man: 'Cover 2-Man',
  tampa2: 'Tampa 2', c6: 'Cover 6', prevent: 'Prevent' };
const realRandom = Math.random;
const mulberry32 = (a) => () => {
  a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
let pass = 0, fail = 0;
const check = (label, ok, detail) => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
};

// ── what the CARD draws ──────────────────────────────────────────────────
// Arrows and man lines are emitted at the drawn body's own coordinates, so
// the drawing is joined back to slots by position. This deliberately reads
// the rendered SVG rather than the renderer's internals: the picture on the
// screen is the thing under test.
const W = 250, H = 170;
// Two slots in a front can share a LABEL (a 4-3 has two "DT", every front has
// two "CB"), so the drawn sets are keyed by the node's own position and then
// resolved to the layout's slot id. Keying by label collapsed the pair and a
// four-man front read as three arrows.
function readCard(card, art) {
  const svg = renderDefCallCard(card, { w: W, h: H, art, fallbackFront: card.front });
  const nodes = [...svg.matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="(\d+)" height="(\d+)"[^>]*class="fd-node[^"]*"\/><text[^>]*>([^<]*)<\/text>/g)]
    .map((m) => ({ x: +m[1] + +m[3] / 2, y: +m[2] + +m[4] / 2, lbl: m[5] }));
  // the renderer's own mapping, recomputed: slot -> drawn centre
  const padX = 14, topPad = 8, ySpan = H - Math.round(H * 0.27);
  const slots = DEF_FIELD_LAYOUTS[card.front].slots.map((sl) => ({
    id: sl.id, lbl: sl.label,
    x: padX + sl.x * (W - 2 * padX), y: topPad + sl.y * ySpan
  }));
  const nearestSlot = (x, y, dy) => {
    let best = null, bd = 1e9;
    for (const n of nodes) { const d = Math.hypot(n.x - x, n.y - (y - dy)); if (d < bd) { bd = d; best = n; } }
    if (!best || bd > 14) return null;
    let sBest = null, sd = 1e9;
    for (const sl of slots) { const d = Math.hypot(sl.x - best.x, sl.y - best.y); if (d < sd) { sd = d; sBest = sl; } }
    return sBest ? sBest.id : null;                 // a MOVED man still resolves to his nearest slot
  };
  const rush = new Set(), man = new Set();
  for (const m of svg.matchAll(/<line x1="([-\d.]+)" y1="([-\d.]+)"[^>]*class="dc-(rush|dog)"/g)) { const w = nearestSlot(+m[1], +m[2], 6); if (w) rush.add(w); }
  for (const m of svg.matchAll(/<line x1="([-\d.]+)" y1="([-\d.]+)"[^>]*class="dc-man"\/><circle/g)) { const w = nearestSlot(+m[1], +m[2], 7); if (w) man.add(w); }
  // arrows are counted from the MARKUP, not the resolved set, so two rushers
  // that resolve to one slot can never hide as a single arrow
  const arrows = [...svg.matchAll(/class="dc-(rush|dog)"/g)].length;
  return { rushers: rush, man, drawsMan: man.size > 0,
    drawsZone: /class="dcz /.test(svg), drawsDrop: /class="dc-drop"/.test(svg), arrows };
}

// ── what the SIM does ────────────────────────────────────────────────────
// One snap at a time through the M1 bench, which builds its defensive call
// with benchDefCall -> cardToDefCall — the SAME function the card art reads.
// So a disagreement here is a disagreement between the drawing and the game,
// never between two different ideas of what the call was.
//
// LIMITATION, stated rather than hidden: benchDefCall consumes front,
// coverage and bring only. A card's look, rotation and extras (press, robber,
// zone rules, dog game) cannot be exercised through this door, so this probe
// does not cover them. Widening benchDefCall to the full CARD_VOCAB would
// extend this probe for free and is the obvious next step.
const OFF_LOOKS = [
  { formationId: 'Spread', concept: 'Mesh' },
  { formationId: 'Spread', concept: 'Four Verts' },
  { formationId: 'Single Back', concept: 'Y Cross' },
  { formationId: 'Trips/Bunch', concept: 'Smash' }
];
function runCall(defLook, want = 60, maxSeeds = 400) {
  const snaps = [];
  for (let i = 0; i < maxSeeds && snaps.length < want; i++) {
    const off = OFF_LOOKS[i % OFF_LOOKS.length];
    const r = benchSnap({ ...off, defLook, seed: (0xC0FFEE + i * 7919) >>> 0 });
    const p = r.play;
    if (!p || p.rushN == null || !p.rushSlots) continue;  // pre-snap flag / run — honest, skipped
    snaps.push(p);
  }
  return snaps;
}

const SUBJECTS = [
  { front: '4-3',        cov: 'c3',     bring: '4' },
  { front: '4-3',        cov: 'c1',     bring: '5' },
  { front: 'Nickel',     cov: 'tampa2', bring: '4' },
  { front: 'Nickel',     cov: 'c2man',  bring: '5' },
  { front: 'Dime',       cov: 'prevent',bring: '3' },
  // 2026-08-22 (owner-reported: "this didn't blitz anyone"). A Prevent call
  // authored with bring '4' — which is what a book actually stores when the
  // author never touched the rush. sim.js's applyDefCall forces rush3 off the
  // covFamily, so the SNAP sends three; the card read "Base Rush" and drew four
  // until the coverage table's own fields.rush3 was wired into the drawing.
  // Every prevent subject before this one declared bring '3' explicitly, so the
  // gap between "authored 4" and "played 3" was never exercised.
  { front: '4-3',        cov: 'prevent',bring: '4' },
  { front: '3-4',        cov: 'c3',     bring: '5' },
  { front: '46/Bear',    cov: 'c1',     bring: '6' },
  { front: 'Tite',       cov: 'c6',     bring: '4' }
];

console.log(`=== DEF CARD FIDELITY (${WANT} snaps per card) ===\n`);
const rows = [];
for (const s of SUBJECTS) {
  const covDef = DEF_CALL_COVERAGES.find((c) => c.id === s.cov);
  const LBL = Object.fromEntries(DEF_FIELD_LAYOUTS[s.front].slots.map((x) => [x.id, x.label]));
  const card = { name: 'CARD', front: s.front, coverage: s.cov, bring: s.bring, look: null, weight: 50 };
  const drawn = readCard(card, covDef.art);
  const snaps = runCall({ front: s.front, coverage: s.cov, bring: s.bring }, WANT);
  if (snaps.length < Math.min(20, WANT)) {
    fail++;
    console.log(`  FAIL  ${s.front}/${s.cov}/bring${s.bring}: only ${snaps.length} measurable snaps — the probe could not SEE this card, which is a failure, not a skip\n`);
    continue;
  }

  const dist = {}; for (const p of snaps) dist[p.rushN] = (dist[p.rushN] || 0) + 1;
  const modal = +Object.entries(dist).sort((a, b) => b[1] - a[1])[0][0];
  const freqBySlot = {};
  for (const p of snaps) for (const sl of p.rushSlots) freqBySlot[sl] = (freqBySlot[sl] || 0) + 1;
  // NOT covSlots' `t`: "press" there is a technique a ZONE corner also
  // carries, so it does not separate man from zone. The snap records the
  // coverage the sim actually played — read that.
  let manT = 0, zoneT = 0; const covNames = {};
  for (const p of snaps) {
    const nm = String(p.coverage || '');
    if (!nm) continue;
    covNames[nm] = (covNames[nm] || 0) + 1;
    MAN_COVERAGES.has(nm) ? manT++ : zoneT++;
  }
  const dropped = snaps.filter((p) => p.dropSlots && p.dropSlots.length).length;

  rows.push({ s, drawn, snaps: snaps.length, dist, modal, freqBySlot, manT, zoneT, dropped, covNames });
  const pctMan = manT + zoneT ? (100 * manT / (manT + zoneT)) : 0;
  console.log(`${s.front} · ${covDef.label} · bring ${s.bring}   (${snaps.length} snaps)`);
  console.log(`   card draws  : ${drawn.arrows} rushing [${[...drawn.rushers].map((i) => LBL[i] || i).join(' ')}]${drawn.drawsMan ? `, man on [${[...drawn.man].map((i) => LBL[i] || i).join(' ')}]` : ''}${drawn.drawsZone ? ', zones' : ''}${drawn.drawsDrop ? ', a drop' : ''}`);
  console.log(`   sim rushes  : modal ${modal}  dist ${JSON.stringify(dist)}`);
  console.log(`   sim coverage: ${pctMan.toFixed(0)}% man / ${(100 - pctMan).toFixed(0)}% zone  ${JSON.stringify(covNames)}`);
  console.log(`   sim drops   : ${(100 * dropped / snaps.length).toFixed(0)}% of snaps\n`);
}

console.log('=== CHECKS ===');
for (const r of rows) {
  const tag = `${r.s.front}/${r.s.cov}/bring${r.s.bring}`;
  check(`A ${tag}: card draws ${r.drawn.arrows}, sim's modal rush is ${r.modal}`, r.drawn.arrows === r.modal);
  const L = Object.fromEntries(DEF_FIELD_LAYOUTS[r.s.front].slots.map((x) => [x.id, x.label]));
  // B1 — the DOWN LINEMEN the card draws rushing must actually rush. These
  // are not a guess: they come every snap unless the call drops them.
  const dlDrawn = [...r.drawn.rushers].filter((id) => /^(DE|DT|NT)_/.test(id) || /DE|DT|NT/.test(L[id] || ''));
  const coldDl = dlDrawn.filter((w) => (r.freqBySlot[w] || 0) / r.snaps < 0.6);
  check(`B1 ${tag}: every LINEMAN drawn rushing rushes on 60%+ of snaps`, coldDl.length === 0,
    coldDl.length ? `cold: ${coldDl.map((w) => `${L[w] || w} ${(100 * (r.freqBySlot[w] || 0) / r.snaps).toFixed(0)}%`).join(', ')}` : '');
  // B2 — the EXTRA rusher cannot be predicted exactly without a roster: the
  // sim picks among the eligible by pass-rush grade. What the card must never
  // do is draw an arrow on a man the front cannot blitz at all.
  const elig = new Set(DEF_BLITZ_ELIGIBLE[r.s.front] || []);
  const extras = [...r.drawn.rushers].filter((id) => !dlDrawn.includes(id));
  const bogus = extras.filter((id) => !elig.has(id));
  check(`B2 ${tag}: every EXTRA rusher drawn is blitz-eligible from this front`, bogus.length === 0,
    bogus.length ? `not eligible: ${bogus.map((w) => L[w] || w).join(', ')}` : (extras.length ? `[${extras.map((w) => L[w] || w).join(' ')}]` : 'none needed'));
  // E — THE PICTURE'S SHELL IS THE ENGINE'S SHELL.
  // A coverage's shell decides how many men are deep, and the card draws that
  // as deep zones. C2 only tested man-versus-zone, so a shell disagreement
  // could pass it: Prevent is COV_FAMILY shell "two" and the card draws it as
  // three deep thirds. One of the two is lying to the coach.
  const covDefE = DEF_CALL_COVERAGES.find((c) => c.id === r.s.cov);
  const shellE = covDefE.fields.covShell
    || (covDefE.fields.covFamily && COV_FAMILY[covDefE.fields.covFamily] && COV_FAMILY[covDefE.fields.covFamily].shell)
    || null;
  const deepDrawn = { thirds: 3, halves: 2, quarters: 4, mof: 1 }[covDefE.art && covDefE.art.deep] || null;
  if (shellE && deepDrawn) {
    const wantDeep = shellE === "two" ? [2, 4] : [1, 3];
    check(`E ${tag}: card draws ${deepDrawn} deep, engine shell is "${shellE}"`, wantDeep.includes(deepDrawn),
      `a "${shellE}" shell should draw ${wantDeep.join(" or ")} deep`);
  }
  const wantName = NAME_OF[r.s.cov];
  const onName = Object.entries(r.covNames).filter(([n]) => n === wantName || n.includes(wantName.replace('Cover ', 'C')))
    .reduce((a, [, v]) => a + v, 0);
  check(`C ${tag}: sim plays the coverage the card names ("${wantName}")`, onName / r.snaps >= 0.9,
    `${(100 * onName / r.snaps).toFixed(0)}%  ${JSON.stringify(r.covNames)}`);
  const pctMan = r.manT + r.zoneT ? (100 * r.manT / (r.manT + r.zoneT)) : 0;
  const wantMan = MAN_COVERAGES.has(wantName);
  check(`C2 ${tag}: card draws ${r.drawn.drawsMan ? 'man' : 'zone'}, and "${wantName}" is a ${wantMan ? 'man' : 'zone'} coverage`,
    r.drawn.drawsMan === wantMan, `sim man share ${pctMan.toFixed(0)}%`);
  const dropPct = 100 * r.dropped / r.snaps;
  if (r.drawn.drawsDrop) check(`D ${tag}: card draws a drop, sim drops sometimes`, dropPct >= 5, `${dropPct.toFixed(0)}%`);
  else check(`D ${tag}: card draws no drop, sim rarely drops`, dropPct <= 20, `${dropPct.toFixed(0)}%`);
}
if (pass + fail === 0) { console.log('  *** NO CHECKS RAN — treat as FAILURE, not a pass ***'); process.exit(1); }
console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'}  (${pass} pass, ${fail} fail)`);
process.exit(fail ? 1 : 0);
