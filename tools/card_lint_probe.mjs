// card_lint_probe.mjs — THE CARD LINTER (M0 sweep, 2026-08-16).
// Run: node tools/card_lint_probe.mjs
//
// The owner's trust anchor: "the coach trusts us to show him every man's job
// on these play cards." This probe walks EVERY (formation × variation ×
// concept) card render and asserts FOOTBALL LEGALITY, so an authored-layout
// regression can never ship silently again. In CORE.
//
// Pins:
//   C1  LAYOUT LAWS — every look (base + every authored variation) fields a
//       lawful 11: exactly 5 OL / 1 QB / 5 skill; nobody offsides (y ≥ 0.5)
//       or out of bounds; at least 7 on the line of scrimmage; no receiver
//       body in the backfield (a WR/SLOT never deeper than flanker depth —
//       the #20 "slot WR in the FB spot" bug class; a TE may wing to H-back
//       depth, which is legal football); a back stacked directly behind the
//       QB requires under-center or pistol depth — a GUN quarterback never
//       draws with a back stacked behind him (the #18 Spread-Ace bug class);
//       no two bodies drawn on top of each other.
//   C2  PERSONNEL MATCHES THE PKG — the look's fielded WR/TE/RB/FB counts
//       equal FORMATION_PACKAGES merged with the variation's pkg override
//       (the re-dress capability variationLayoutSlots grew for this).
//   C3  CARD RENDERS IN BOUNDS — renderConceptThumb for every concept in
//       every formation's book, at the Builder size and the call-sheet size,
//       against every look: no NaN, every drawn coordinate inside the SVG,
//       one bold route per authored part, one dot per skill body.
//   C4  VIEWER HANDEDNESS (#49) — for every camera in BOTH drive directions,
//       facing the on-screen drive vector the offense's left is to the left
//       hand (cross(D,L) < 0) — except the reverse angle, which is a
//       DELIBERATE mirror and must be consistently mirrored both ways. This
//       is the invariant whose violation had plays fielded flipped vs their
//       cards whenever the drive direction was left.
//   C5  DEF CARDS — every front's end labels are side-explicit (LE/RE, #31);
//       renderDefCallCard draws EXACTLY `bring` rush arrows for bring 3–6 on
//       every front (#33 graphic half), with one fire-zone drop squiggle per
//       lineman over the bring, and everything in bounds.
import { FORMATION_VARIATIONS, FORMATION_PACKAGES, FORMATION_PLAYBOOK, aliasFormation } from '../js/constants.js';
import { OFF_FIELD_LAYOUTS, DEF_FIELD_LAYOUTS, variationLayoutSlots } from '../js/constants_field.js';
//   C6  (D4/M2) THE BIG CARD + THE WORDS — run cards draw the LOOK (5 OL from
//       the authored layout, one designed path, in bounds); the big-card jobs
//       render (jobs:true) stays in bounds; playAssignments answers with all
//       ELEVEN jobs for every (formation × look × concept); every concept in
//       the shipped catalog has a purpose blurb, and no blurb or job line
//       ever prints a number (the help-language law, machine-checked);
//       composed cards (pass and run) render lawfully through
//       renderComposedCard for every look.
import { renderConceptThumb, renderFormationDiagram, renderFrontDiagram, renderDefCallCard, conceptKind, CONCEPT_ROUTES, renderComposedCard, playAssignments } from '../js/ui/views/routeart.js';
import { CONCEPT_BLURBS, conceptBlurb, composedBlurb } from '../js/ui/views/conceptblurbs.js';
import { PASS_CONCEPTS, RUN_CONCEPTS } from '../js/concepts.js';
import { projectWatchPoint } from '../js/ui/watchcamera.js';

let pass = 0, fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}`); ok ? pass++ : fail++; };
const hdr = (s) => console.log(`\n${s}`);

// ── the walk: every real formation × every look ────────────────────────────
const FIDS = Object.keys(FORMATION_PACKAGES).filter((f) => aliasFormation(f) === f);
const looksOf = (fid) => {
  const base = OFF_FIELD_LAYOUTS[fid];
  const out = [{ vk: null, slots: base.slots, pkg: { ...FORMATION_PACKAGES[fid] } }];
  for (const [vk, vd] of Object.entries(FORMATION_VARIATIONS[fid] || {})) {
    const slots = variationLayoutSlots(base.slots, vd.layout) || base.slots;
    out.push({ vk, slots, pkg: { ...FORMATION_PACKAGES[fid], ...(vd.pkg || {}) } });
  }
  return out;
};
const lookName = (fid, vk) => `${fid}${vk ? ' · ' + vk : ''}`;

hdr('C1 — layout laws: every look fields a lawful 11');
{
  let looks = 0; const bad = [];
  const flag = (fid, vk, why) => bad.push(`${lookName(fid, vk)}: ${why}`);
  for (const fid of FIDS) {
    for (const { vk, slots } of looksOf(fid)) {
      looks++;
      const ol = slots.filter((s) => s.pos === 'OL');
      const qb = slots.filter((s) => s.pos === 'QB');
      const skill = slots.filter((s) => s.pos !== 'OL' && s.pos !== 'QB');
      if (ol.length !== 5 || qb.length !== 1 || skill.length !== 5) flag(fid, vk, `not 5 OL/1 QB/5 skill (${ol.length}/${qb.length}/${skill.length})`);
      for (const s of slots) {
        if (s.y < 0.5) flag(fid, vk, `${s.id} OFFSIDES (y=${s.y})`);
        if (s.x < 0.01 || s.x > 0.99 || s.y > 0.95) flag(fid, vk, `${s.id} out of bounds (${s.x},${s.y})`);
      }
      const online = slots.filter((s) => s.y <= 0.505).length;
      if (online < 7) flag(fid, vk, `only ${online} on the line (needs 7)`);
      for (const s of skill) {
        if ((s.pos === 'WR' || s.pos === 'SLOT') && s.y > 0.62) flag(fid, vk, `${s.id} is a receiver drawn in the backfield (y=${s.y})`);
        if (s.pos === 'TE' && s.y > 0.78) flag(fid, vk, `${s.id} TE deeper than H-back depth (y=${s.y})`);
      }
      const q = qb[0];
      if (q && Math.abs(q.x - 0.5) <= 0.1) {
        if (q.y < 0.56 || q.y > 0.78) flag(fid, vk, `QB depth unrecognizable (y=${q.y})`);
        const stacked = skill.some((s) => Math.abs(s.x - q.x) < 0.06 && s.y > q.y);
        if (stacked && q.y > 0.69) flag(fid, vk, `GUN QB with a back stacked directly behind (the #18 bug class)`);
      }
      for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i], b = slots[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 0.028) flag(fid, vk, `${a.id} and ${b.id} draw on top of each other (${d.toFixed(3)})`);
      }
    }
  }
  bad.forEach((w) => console.log(`    FLAG: ${w}`));
  check(looks >= 33, `walked every look (${looks})`);
  check(bad.length === 0, `every look is lawful football (${bad.length} flags)`);
}

hdr('C2 — personnel: the drawn look matches its pkg');
{
  const bad = [];
  const isFB = (s) => String(s.role || '').startsWith('FB');
  const BACK_POS = ['RB', 'WING', 'ABACK', 'WILDCAT', 'JETMAN'];
  for (const fid of FIDS) {
    for (const { vk, slots, pkg } of looksOf(fid)) {
      const skill = slots.filter((s) => s.pos !== 'OL' && s.pos !== 'QB');
      const got = {
        WR: skill.filter((s) => s.pos === 'WR' || s.pos === 'SLOT').length,
        TE: skill.filter((s) => s.pos === 'TE').length,
        FB: skill.filter((s) => BACK_POS.includes(s.pos) && isFB(s)).length,
        RB: skill.filter((s) => BACK_POS.includes(s.pos) && !isFB(s)).length
      };
      for (const k of ['WR', 'TE', 'RB', 'FB']) {
        const want = pkg[k] || 0;
        if (got[k] !== want) bad.push(`${lookName(fid, vk)}: ${k} drawn ${got[k]}, pkg says ${want}`);
      }
    }
  }
  bad.forEach((w) => console.log(`    FLAG: ${w}`));
  check(bad.length === 0, `every look draws the personnel its pkg names (${bad.length} flags)`);
}

// ── SVG coordinate audit ───────────────────────────────────────────────────
function svgInBounds(svg, W, H, tol = 1.2) {
  if (/NaN/.test(svg)) return 'NaN coordinate';
  let m;
  const attrX = /\s(?:x|x1|x2|cx)="(-?[\d.]+)"/g;
  while ((m = attrX.exec(svg))) { const v = +m[1]; if (v < -tol || v > W + tol) return `x attr ${v} outside 0..${W}`; }
  const attrY = /\s(?:y|y1|y2|cy)="(-?[\d.]+)"/g;
  while ((m = attrY.exec(svg))) { const v = +m[1]; if (v < -tol || v > H + tol) return `y attr ${v} outside 0..${H}`; }
  const dRe = /\s(?:d|points)="([^"]+)"/g;
  while ((m = dRe.exec(svg))) {
    const nums = (m[1].match(/-?[\d.]+/g) || []).map(Number);
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const x = nums[i], y = nums[i + 1];
      if (x < -tol || x > W + tol) return `path x ${x} outside 0..${W}`;
      if (y < -tol || y > H + tol) return `path y ${y} outside 0..${H}`;
    }
  }
  return null;
}

hdr('C3 — every (formation × variation × concept) card renders lawfully');
{
  const SIZES = [{ w: 120, h: 72, scale: 0.72 }, { w: 260, h: 170 }];
  let renders = 0; const bad = [];
  for (const fid of FIDS) {
    const book = FORMATION_PLAYBOOK[fid] || [];
    const vks = [null, ...Object.keys(FORMATION_VARIATIONS[fid] || {})];
    for (const vk of vks) {
      // the formation diagram itself
      const fd = renderFormationDiagram(fid, { variation: vk || undefined, w: 150, h: 96 });
      const fdErr = svgInBounds(fd, 150, 96);
      if (fdErr) bad.push(`${lookName(fid, vk)} formation diagram: ${fdErr}`);
      for (const concept of book) {
        for (const size of SIZES) {
          renders++;
          const svg = renderConceptThumb(concept, { ...size, formation: fid, variation: vk || undefined });
          if (!svg || !svg.includes('<svg')) { bad.push(`${lookName(fid, vk)} · ${concept}: empty render`); continue; }
          const err = svgInBounds(svg, size.w, size.h);
          if (err) bad.push(`${lookName(fid, vk)} · ${concept} @${size.w}×${size.h}: ${err}`);
          const kind = conceptKind(concept);
          if (kind.kind === 'pass') {
            const bold = (svg.match(/class="play-card-route"/g) || []).length;
            if (bold !== kind.parts.length) bad.push(`${lookName(fid, vk)} · ${concept}: ${bold} bold routes for ${kind.parts.length} parts`);
            const dots = (svg.match(/class="play-card-rec"/g) || []).length;
            if (dots !== 5) bad.push(`${lookName(fid, vk)} · ${concept}: ${dots} skill dots (want 5)`);
          } else {
            // D4/M2: run cards draw the LOOK — the authored line (5 OL), one
            // designed path, and every skill body on the card.
            const olN = (svg.match(/class="play-card-ol"/g) || []).length;
            if (olN !== 5) bad.push(`${lookName(fid, vk)} · ${concept}: run card drew ${olN} OL (want 5)`);
            const pathN = (svg.match(/class="run-card-path"/g) || []).length;
            if (pathN !== 1) bad.push(`${lookName(fid, vk)} · ${concept}: run card drew ${pathN} carrier paths (want 1)`);
            const dots = (svg.match(/class="play-card-rec"/g) || []).length;
            if (dots !== 5) bad.push(`${lookName(fid, vk)} · ${concept}: run card drew ${dots} skill dots (want 5)`);
          }
        }
      }
    }
  }
  const shown = bad.slice(0, 25);
  shown.forEach((w) => console.log(`    FLAG: ${w}`));
  if (bad.length > shown.length) console.log(`    …and ${bad.length - shown.length} more`);
  check(renders > 2500, `walked every card (${renders} renders)`);
  check(bad.length === 0, `every card render is lawful and in bounds (${bad.length} flags)`);
  check(!!CONCEPT_ROUTES['Red-Zone Fade'] && CONCEPT_ROUTES['Red-Zone Fade'][0] === 'fade', 'Red-Zone Fade draws the back-shoulder fade (#19), not a go');
}

hdr('C4 — viewer handedness (#49): the fielded look keeps the card’s chirality');
{
  const opts = (direction) => ({ direction, fieldTop: 8, fieldHeight: 42, longitudinal: 1.35 });
  const cross = (camera, direction) => {
    const P = (wx, wy) => projectWatchPoint(camera, wx, wy, opts(direction));
    const a = P(50, 26), b = P(50, 36); // 10 world-yds downfield
    const D = [a[0] - b[0], a[1] - b[1]];
    const l0 = P(0, 31), l1 = P(100, 31); // toward the offense's LEFT
    const L = [l0[0] - l1[0], l0[1] - l1[1]];
    return D[0] * L[1] - D[1] * L[0];
  };
  for (const cam of ['broadcast', 'all22', 'coach', 'endzone']) {
    const r = cross(cam, 1), l = cross(cam, -1);
    check(r < 0 && l < 0, `${cam}: offense's left stays the left hand, both directions (${r.toFixed(0)}, ${l.toFixed(0)})`);
  }
  const rr = cross('reverse', 1), rl = cross('reverse', -1);
  check(rr > 0 && rl > 0, `reverse: a deliberate mirror, consistent both directions (${rr.toFixed(0)}, ${rl.toFixed(0)})`);
}

hdr('C5 — defensive graphics: side-explicit end labels (#31), the arrow count IS the bring (#33)');
{
  const fronts = Object.keys(DEF_FIELD_LAYOUTS);
  let labBad = 0;
  for (const f of fronts) {
    for (const s of DEF_FIELD_LAYOUTS[f].slots) {
      if (s.pos !== 'DE') continue;
      const want = s.x < 0.5 ? 'LE' : 'RE';
      if (s.label !== want) { labBad++; console.log(`    FLAG: ${f} ${s.id} labeled ${s.label}, wants ${want}`); }
    }
    const fdErr = svgInBounds(renderFrontDiagram(f, { w: 150, h: 96 }), 150, 96);
    if (fdErr) { labBad++; console.log(`    FLAG: ${f} front diagram ${fdErr}`); }
  }
  check(labBad === 0, `every front labels its ends LE/RE and draws in bounds (${labBad} flags)`);

  const ARTS = [{ deep: 'thirds' }, { deep: 'halves' }, { deep: 'mof', man: true }, { deep: 'quarters' }];
  let cards = 0; const bad = [];
  for (const f of fronts) {
    const dlCount = DEF_FIELD_LAYOUTS[f].slots.filter((s) => ['DE', 'DT', 'NT', 'DL', 'EDGE'].includes(s.pos)).length;
    for (let bring = 3; bring <= 6; bring++) {
      for (const art of ARTS) {
        for (const size of [{ w: 250, h: 170 }, { w: 220, h: 150 }]) {
          cards++;
          const svg = renderDefCallCard({ name: 'probe', front: f, bring: String(bring), coverage: 'x' }, { ...size, art });
          const arrows = (svg.match(/class="dc-rush"\/>/g) || []).length + (svg.match(/class="dc-dog"\/>/g) || []).length;
          if (arrows !== bring) bad.push(`${f} bring ${bring}: ${arrows} arrows`);
          const drops = (svg.match(/class="dc-drop"\/>/g) || []).length;
          if (drops !== Math.max(0, dlCount - bring)) bad.push(`${f} bring ${bring}: ${drops} drop squiggles for ${dlCount}-man line`);
          const err = svgInBounds(svg, size.w, size.h, 2.5);
          if (err) bad.push(`${f} bring ${bring} @${size.w}×${size.h}: ${err}`);
        }
      }
    }
  }
  bad.slice(0, 20).forEach((w) => console.log(`    FLAG: ${w}`));
  if (bad.length > 20) console.log(`    …and ${bad.length - 20} more`);
  check(cards === fronts.length * 4 * 4 * 2, `walked every (front × bring × shell) call card (${cards})`);
  check(bad.length === 0, `every call card arrows its bring and stays in bounds (${bad.length} flags)`);
}

hdr('C6 — the big card and the words (D4/M2): jobs for all eleven, blurbs with no numbers');
{
  // every shipped concept carries a purpose blurb; no blurb ever prints a digit
  const allConcepts = [...Object.keys(PASS_CONCEPTS), ...Object.keys(RUN_CONCEPTS)];
  const noBlurb = allConcepts.filter((c) => !conceptBlurb(c));
  noBlurb.forEach((c) => console.log(`    FLAG: no blurb for ${c}`));
  check(noBlurb.length === 0, `every shipped concept has a purpose blurb (${allConcepts.length} concepts, ${noBlurb.length} missing)`);
  const digitBlurbs = Object.entries(CONCEPT_BLURBS).filter(([, b]) => /\d/.test(b));
  digitBlurbs.forEach(([c]) => console.log(`    FLAG: blurb prints a number: ${c}`));
  check(digitBlurbs.length === 0, `no blurb prints a number (the help-language law)`);
  const stale = Object.keys(CONCEPT_BLURBS).filter((c) => !PASS_CONCEPTS[c] && !RUN_CONCEPTS[c]);
  stale.forEach((c) => console.log(`    FLAG: blurb for unknown concept ${c}`));
  check(stale.length === 0, `no blurb names a concept that doesn't exist (${stale.length} stale)`);

  // EVERY MAN'S JOB: eleven rows (5 OL + QB + 5 skill), no digits, for every
  // (formation × look × concept) — and the big-card render stays in bounds
  let walks = 0; const bad = [];
  for (const fid of FIDS) {
    const book = FORMATION_PLAYBOOK[fid] || [];
    const vks = [null, ...Object.keys(FORMATION_VARIATIONS[fid] || {})];
    for (const vk of vks) {
      for (const concept of book) {
        walks++;
        const a = playAssignments({ name: concept }, { formation: fid, variation: vk || undefined });
        if (a.rows.length !== 11) { bad.push(`${lookName(fid, vk)} · ${concept}: ${a.rows.length} job rows (want 11)`); continue; }
        const olRows = a.rows.filter((r) => r.pos === 'OL').length;
        if (olRows !== 5) bad.push(`${lookName(fid, vk)} · ${concept}: ${olRows} OL job rows (want 5)`);
        for (const r of a.rows) {
          if (!r.job || !r.job.trim()) { bad.push(`${lookName(fid, vk)} · ${concept}: empty job for ${r.label}`); break; }
          if (/\d/.test(r.job)) { bad.push(`${lookName(fid, vk)} · ${concept}: job prints a number ("${r.job}")`); break; }
        }
      }
      // the big-card render (jobs:true) for a sample of each look's book
      for (const concept of book.slice(0, 3)) {
        const svg = renderConceptThumb(concept, { w: 340, h: 215, formation: fid, variation: vk || undefined, jobs: true });
        const err = svgInBounds(svg, 340, 215);
        if (err) bad.push(`${lookName(fid, vk)} · ${concept} big card: ${err}`);
      }
    }
  }
  bad.slice(0, 20).forEach((w) => console.log(`    FLAG: ${w}`));
  if (bad.length > 20) console.log(`    …and ${bad.length - 20} more`);
  check(walks > 1200, `walked every (formation × look × concept) job sheet (${walks})`);
  check(bad.length === 0, `every man's job reads lawfully on every card (${bad.length} flags)`);

  // composed cards through the one dispatcher — a pass with authored blocks
  // and every run design, on a spread and a heavy look, both sizes
  const runs = [];
  for (const path of ['inside', 'offtackle', 'outside', 'toss', 'draw'])
    for (const scheme of ['zone', 'gap', 'trap', 'lead'])
      runs.push({ name: 'R', kind: 'run', run: { path, scheme, carrier: path === 'draw' ? 'QB' : 'RB' }, parts: [], assigns: [], blocks: [], formations: ['Spread'] });
  const passCp = { name: 'P', kind: 'pass', parts: ['go', 'drag', 'curl'], assigns: [], blocks: ['TE1'], formations: ['Spread'] };
  let cBad = 0;
  for (const cp of [...runs, passCp]) {
    for (const [fid2, vk2] of [['Spread', null], ['Spread', 'trips'], ['Power-I', 'big'], ['Air Raid', 'empty']]) {
      if (!FORMATION_PACKAGES[fid2] || vk2 && !(FORMATION_VARIATIONS[fid2] || {})[vk2]) continue;
      for (const size of [{ w: 120, h: 72, scale: 0.72 }, { w: 300, h: 200, jobs: true }]) {
        const svg = renderComposedCard(cp, { ...size, formation: fid2, variation: vk2 || undefined });
        if (!svg || !svg.includes('<svg')) { cBad++; console.log(`    FLAG: composed ${cp.kind} empty render on ${fid2}/${vk2}`); continue; }
        const err = svgInBounds(svg, size.w, size.h);
        if (err) { cBad++; console.log(`    FLAG: composed ${cp.kind} ${cp.run ? cp.run.path + '/' + cp.run.scheme : ''} @${fid2}/${vk2 || 'base'} ${size.w}×${size.h}: ${err}`); }
      }
    }
  }
  check(cBad === 0, `every composed card (pass + all run designs) renders lawfully through renderComposedCard (${cBad} flags)`);
  const rb = composedBlurb({ kind: 'run', run: { path: 'toss', scheme: 'gap', carrier: 'RB' } });
  check(!!rb && !/\d/.test(rb), 'composed plays get a derived blurb with no numbers');
}

hdr('C7 — man coverage points at the offense, and press is visible (2026-08-19)');
{
  // TWO defects found by the owner asking "is man coverage going the wrong way?"
  //
  // 1. IT WAS. The ghost receivers sat at sy(0.03) — the deepest point of the
  //    DEFENSIVE backfield, behind the safeties — while the ghost offense (OL,
  //    QB) is drawn below the LOS. Measured on the pre-fix tree: LOS at 114.6,
  //    ghost offense at 119.6, man ghosts at 19. So every man line ran AWAY
  //    from the offense, opposite to the rush arrows on the same card.
  // 2. PRESS WAS INVISIBLE. `pressLevel` is a standing plan dial, a situation
  //    field AND a card field, and the sim honours it — but the card never
  //    received it, so press / off / auto rendered BYTE-IDENTICAL.
  const { DEF_CALL_COVERAGES } = await import('../js/engine/defbook.js');
  const manCov = (DEF_CALL_COVERAGES || []).filter((c) => c.art && c.art.man);
  check(manCov.length > 0, `coverages that draw man exist (${manCov.length})`);
  const losOf = (svg) => Number((svg.match(/<line x1="0" y1="([\d.]+)"[^>]*class="play-card-los"/) || [])[1]);
  const manLines = (svg) => [...svg.matchAll(/<line x1="[\d.]+" y1="([\d.]+)" x2="[\d.]+" y2="([\d.]+)" class="dc-man"/g)]
    .map((m) => ({ from: Number(m[1]), to: Number(m[2]) }));

  let drawn = 0, backwards = 0, pastLos = 0;
  for (const cov of manCov) {
    for (const front of ['4-3', '3-4', 'Nickel', 'Dime']) {
      for (const press of ['auto', 'press', 'off']) {
        const svg = renderDefCallCard({ name: 'probe', front, coverage: cov.id, bring: '4', pressLevel: press }, { w: 250, h: 170, art: cov.art });
        const los = losOf(svg);
        for (const l of manLines(svg)) {
          drawn++;
          // y grows DOWNWARD and the offense is below the LOS, so a man line
          // must END further down than it STARTS.
          if (!(l.to > l.from)) backwards++;
          // and it must reach the offense's side of the ball, not stop short
          // in the defensive backfield.
          if (!(l.to >= los - 1)) pastLos++;
        }
      }
    }
  }
  check(drawn > 40, `sampled man lines across fronts and press levels (${drawn})`);
  check(backwards === 0, 'EVERY man line runs toward the offense — same direction as the rush arrows',
    `${backwards}/${drawn} backwards`);
  check(pastLos === 0, 'and every one reaches the offense\'s side of the ball', `${pastLos}/${drawn} stopped short`);

  // Press must be VISIBLE — and specifically, a pressed corner lines up nearer
  // the ball than an off corner. Byte-difference alone would pass on a colour
  // change, so this measures the alignment.
  const cov1 = manCov[0];
  const startAvg = (press) => {
    const svg = renderDefCallCard({ name: 'probe', front: '4-3', coverage: cov1.id, bring: '4', pressLevel: press }, { w: 250, h: 170, art: cov1.art });
    const ls = manLines(svg);
    return ls.reduce((t, l) => t + l.from, 0) / (ls.length || 1);
  };
  const pr = startAvg('press'), au = startAvg('auto'), of = startAvg('off');
  check(pr > au && au > of, 'PRESS lines up nearer the ball than AUTO, which is nearer than OFF',
    `press ${pr.toFixed(1)} · auto ${au.toFixed(1)} · off ${of.toFixed(1)}`);
}

hdr('C8 — NO SILENT CONTROLS: a field the engine honours must change the picture');
{
  // THE PATTERN THIS GATES (2026-08-19). Three defects in one day shared a
  // shape: a control that is real in the ENGINE and silent or lying on the
  // SURFACE — the front mix that never rolled, `bring` that promised a count
  // and delivered a rate, and `pressLevel`, which the sim honours in three
  // places while press/off/auto rendered BYTE-IDENTICAL.
  //
  // `dead_surface_probe` already covers the inverse (a UI-writable key with no
  // engine reader). This covers the direction nothing checked: the engine reads
  // it, so the card that exists to SHOW you the call had better draw it.
  //
  // A/B each field against the renderer, the same technique def_stress_probe
  // uses on the dials. Identical SVG for two different values = silent.
  const { DEF_CALL_COVERAGES } = await import('../js/engine/defbook.js');
  const art = (DEF_CALL_COVERAGES.find((c) => c.id === 'c1') || {}).art;
  const base = { name: 'probe', front: '4-3', coverage: 'c1', bring: '4' };
  const mk = (extra) => renderDefCallCard({ ...base, ...extra }, { w: 250, h: 170, art });

  // KNOWN SILENT — live in the engine, not yet drawn. Each is a real gap with
  // its reason; the list should SHRINK. A field that leaves this list and stays
  // silent, or a NEW silent field, reds this check immediately.
  const KNOWN_SILENT = {
    edgePlay:   'contain/crash changes the edge technique (24 sim readers) — wants the DE arrows to angle',
    robberCall: 'rob/overtop puts a defender in a specific job — wants a drawn robber',
    zoneStyle:  'spot/match changes how the zones are played — wants the zone shapes to differ',
    dogGame:    'green/cross is a pressure wrinkle — wants the rush paths to cross',
    // HIGHEST VALUE of the four still owed: rotation is a STRUCTURAL fact about
    // the coverage — which safety comes down and which stays over the top — so
    // it belongs on a picture more than any other item here. Left undrawn only
    // because what sky/cloud/buzz should each DEPICT is a football decision the
    // owner should make, not one to invent inside a probe fix.
    rotation:   'sky/cloud/buzz decides which safety rotates down (7 sim readers) — wants the secondary to move'
  };
  const cases = {
    pressLevel: ['press', 'off'],
    look:       ['mug', 'amoeba'],
    bring:      ['3', '6'],
    front:      ['4-3', '3-4'],
    runCommit:  [0, 20],
    edgePlay:   ['contain', 'crash'],
    robberCall: ['rob', 'overtop'],
    zoneStyle:  ['spot', 'match'],
    dogGame:    ['green', 'cross'],
    rotation:   ['sky', 'cloud']
  };
  const silent = [];
  for (const [k, [a, b]] of Object.entries(cases)) {
    if (mk({ [k]: a }) === mk({ [k]: b })) silent.push(k);
  }
  const unexpected = silent.filter((k) => !KNOWN_SILENT[k]);
  const fixed = Object.keys(KNOWN_SILENT).filter((k) => !silent.includes(k));
  unexpected.forEach((k) => console.log(`    FLAG: "${k}" is honoured by the engine but the card draws it identically either way`));
  check(unexpected.length === 0,
    `no NEW silent control on the def call card (${silent.length} known-silent, ${Object.keys(cases).length - silent.length} drawn)`,
    unexpected.join(', '));
  check(fixed.length === 0,
    'KNOWN_SILENT is honest — nothing on the list has quietly been fixed without being removed from it',
    fixed.length ? `now drawn, delete from the list: ${fixed.join(', ')}` : 'in sync');
  // and the two fixed today must STAY drawn
  check(mk({ pressLevel: 'press' }) !== mk({ pressLevel: 'off' }), 'pressLevel stays drawn');
  check(mk({ look: 'mug' }) !== mk({ look: 'amoeba' }), 'look (mug vs amoeba) stays drawn');
}

console.log(`\nCARD LINT PROBE — ${pass} pass, ${fail} fail`);
console.log(fail ? 'CARD LINT PROBE FAIL' : 'CARD LINT PROBE PASS');
process.exit(fail ? 1 : 0);
