// trait_growth_probe.mjs — Identity stage 3 growth loop (§4c): traits grow by
// DOING (stat-line credit, threshold level-ups, pend flags for the weekly
// report), flaws grow when unaddressed and shrink/vanish under coaching, hard
// caps hold (III max), and __noTraits does NOT stop bookkeeping (growth is
// data, the switch kills effects — the A/B stays clean either way).
// Run: node tools/trait_growth_probe.mjs
import { creditTrait, growFlaw, shrinkFlaw, growthFromGameStats, traitLv } from '../js/engine/traits.js';

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};

const mk = () => ({
  position: 'DE',
  traits: {
    bridge: null,
    play: [{ k: 'stripArtist', lv: 1, xp: 0 }, { k: 'bend', lv: 2, xp: 0 }],
    flaws: [{ k: 'jumpy', lv: 1, xp: 0 }],
    earned: false
  }
});

// level-up at threshold, pend flag set, xp resets
{
  const p = mk();
  let upped = false;
  for (let i = 0; i < 14; i++) upped = creditTrait(p, 'stripArtist') || upped;
  const t = p.traits.play[0];
  check('14 trigger events → level II', upped && t.lv === 2, `lv ${t.lv}, xp ${t.xp}`);
  check('level-up sets the pend flag for the weekly report', t.pend === true);
  for (let i = 0; i < 36; i++) creditTrait(p, 'stripArtist');
  check('36 more → level III and stops', t.lv === 3);
  for (let i = 0; i < 60; i++) creditTrait(p, 'stripArtist');
  check('hard cap: level III never exceeded', t.lv === 3);
}
// stat-line growth pass
{
  const p = mk();
  const ups = [];
  for (let g = 0; g < 15; g++) ups.push(...growthFromGameStats(p, { sacks: 2, forcedFumbles: 1, tackles: 6 }));
  check('a monster season levels a trait from the box score', ups.length >= 1, `ups: ${[...new Set(ups)].join(', ')}`);
  check('growth only touches traits he owns', p.traits.play.every((t) => ['stripArtist', 'bend'].includes(t.k)));
}
// flaw arc
{
  const p = mk();
  for (let i = 0; i < 7; i++) growFlaw(p, 'jumpy', 2);
  check('unaddressed flaw festers to level II', p.traits.flaws[0].lv === 2 && p.traits.flaws[0].pendUp === true);
  check('coaching shrinks it back', shrinkFlaw(p, 'jumpy') === 'down' && p.traits.flaws[0].lv === 1);
  check('one more session erases it (the redemption arc)', shrinkFlaw(p, 'jumpy') === 'gone' && p.traits.flaws.length === 0);
}
// null-guards: old-save players (no traits) are inert everywhere
{
  const old = { position: 'DE' };
  check('old-save player: creditTrait no-ops', creditTrait(old, 'bend') === false);
  check('old-save player: growthFromGameStats no-ops', growthFromGameStats(old, { sacks: 3 }).length === 0);
  check('old-save player: traitLv reads 0', traitLv(old, 'bend') === 0);
}
// kill-switch semantics: effects die, bookkeeping lives
{
  const p = mk();
  globalThis.__noTraits = true;
  check('__noTraits: effect read is 0', traitLv(p, 'bend') === 0);
  const before = p.traits.play[1].xp;
  creditTrait(p, 'bend');
  check('__noTraits: growth bookkeeping still ticks', p.traits.play[1].xp === before + 1);
  delete globalThis.__noTraits;
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
