// portrait_probe.mjs — painted-portrait gate (Aug 2026 "realistic profile
// pictures" owner ask). The face is IDENTITY-STABLE (same player → same face,
// forever, school change redresses the jersey but never touches the face),
// variety is wide (skin/hair/facial-hair across a recruiting class), the
// frame drives the geometry (a 300-lb body carries a visibly wider jaw than
// a 185-lb one), and __noPortraits2 restores the legacy pixel faces.
// Run: node tools/portrait_probe.mjs
import { renderPlayerPortrait } from '../js/utils.js';
import { createPlayer } from '../js/engine/player.js';

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};
const attr = (html, name) => {
  const m = html.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
};
const SCHOOL_A = { colors: ['#8b0000', '#ffd700'] };
const SCHOOL_B = { colors: ['#004225', '#c0c0c0'] };

// determinism + identity stability
{
  const p = createPlayer('LB', 'JR', 1);
  const a1 = renderPlayerPortrait(p, SCHOOL_A, 'lg');
  const a2 = renderPlayerPortrait(p, SCHOOL_A, 'lg');
  check('same player renders the identical face twice', a1 === a2);
  const b = renderPlayerPortrait(p, SCHOOL_B, 'lg');
  check('transfer redresses the jersey…', b.includes('#004225') && !b.includes('#8b0000'));
  const faceKeys = ['data-pp-skin', 'data-pp-hair', 'data-pp-fh', 'data-pp-jaw'];
  check('…but never touches the face', faceKeys.every((k) => attr(a1, k) === attr(b, k)));
  check('painted renderer active (svg, not pixel spans)', a1.includes('<svg') && !a1.includes('portrait-grid'));
}
// variety across a class
{
  const skins = new Set(), hairs = new Set(), fh = new Set();
  const POS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DE', 'DT', 'OLB', 'LB', 'CB', 'S'];
  for (let i = 0; i < 300; i++) {
    const h = renderPlayerPortrait(createPlayer(POS[i % POS.length], 'FR', 1), SCHOOL_A, 'lg');
    skins.add(attr(h, 'data-pp-skin'));
    hairs.add(attr(h, 'data-pp-hair'));
    fh.add(attr(h, 'data-pp-fh'));
  }
  check('skin-tone variety across 300 players', skins.size >= 8, `${skins.size} tones`);
  check('hair-style variety', hairs.size >= 7, `${hairs.size} styles`);
  check('facial-hair variety', fh.size >= 4, `${fh.size} classes`);
}
// the frame drives the face
{
  const jawOf = (wt) => {
    const p = createPlayer('OL', 'SR', 1);
    p.weight = wt;
    return parseFloat(attr(renderPlayerPortrait(p, SCHOOL_A, 'lg'), 'data-pp-jaw'));
  };
  let heavy = 0, light = 0;
  for (let i = 0; i < 40; i++) { heavy += jawOf(315); light += jawOf(185); }
  check('a 315-lb frame carries a visibly wider jaw than a 185-lb frame', heavy / 40 > light / 40 + 2, `${(heavy / 40).toFixed(1)} vs ${(light / 40).toFixed(1)}`);
}
// kill-switch
{
  const p = createPlayer('WR', 'SO', 1);
  globalThis.__noPortraits2 = true;
  const legacy = renderPlayerPortrait(p, SCHOOL_A, 'lg');
  delete globalThis.__noPortraits2;
  check('__noPortraits2 restores the pixel faces', legacy.includes('portrait-grid') && !legacy.includes('<svg'));
}
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
