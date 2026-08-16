// stage4_probe.mjs — PASS 7 identity stage 4 gate (IDENTITY_DESIGN §4d + §5):
// earnable bridges off REAL job snaps (threshold + share, one per career,
// legacy null-traits players may EARN in, inbox card for the coach's roster)
// and offseason bulk/cut (convert body plans consumed, foreign-job window
// targeting, own-band regression, per-offseason cap, coupled attr nudges,
// K/P and __no* switches inert).
// Run: node tools/stage4_probe.mjs
import { earnBridges, offseasonBulkCut } from '../js/engine/offseason.js';
import { createPlayer } from '../js/engine/player.js';
import { C, ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};
const P7 = C.PASS7;
function genRoster(s) {
  const r = [];
  for (const [pos, c] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < c; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], 1); p.schoolId = s; r.push(p); }
  }
  return r;
}
const mkState = (roster, mine = true) => {
  const school = { id: 'S', name: 'S', roster, gameplan: {}, depthOrder: {}, stats: {} };
  return { season: 4, day: 1, playerSchoolId: mine ? 'S' : 'OTHER', world: { schools: [school] }, inbox: [] };
};

// ── earnable bridges ─────────────────────────────────────────────────────────
{
  const roster = genRoster('S');
  const lb = roster.find((p) => p.position === 'LB');
  lb.traits = { bridge: null, play: [], flaws: [], earned: false };
  lb.stats = { snaps: 500, snapsAt: { S: 250, CB: 40 } }; // 58% living in space
  const under = roster.find((p) => p.position === 'OLB');
  under.traits = { bridge: null, play: [], flaws: [], earned: false };
  under.stats = { snaps: 500, snapsAt: { S: 100 } }; // 20% — under share bar
  const already = roster.find((p) => p.position === 'DE');
  already.traits = { bridge: 'edgeBender', play: [], flaws: [], earned: false };
  already.stats = { snaps: 500, snapsAt: { OLB: 400 } };
  const legacy = roster.find((p) => p.position === 'S');
  legacy.traits = null; // pre-trait save
  legacy.stats = { snaps: 400, snapsAt: { CB: 240 } };
  const st = mkState(roster);
  earnBridges(st);
  check('a season living in space earns the LB his Space Backer', lb.traits.bridge === 'spaceBacker' && lb.traits.earned === true);
  check('under the share bar: no grant', under.traits.bridge === null);
  check('an existing bridge blocks earning', already.traits.bridge === 'edgeBender' && !already.traits.earned);
  check('legacy null-traits player EARNS in (the one legitimate retro path)', legacy.traits && legacy.traits.bridge === 'slotStar' && legacy.traits.earned === true);
  check('inbox card lands for the coach’s roster', st.inbox.some((m) => m.id.startsWith('bridge_')), `${st.inbox.length} cards`);
  // one per career: strip the bridge but keep earned — a second season earns nothing
  lb.traits.bridge = null;
  earnBridges(st);
  check('one earnable per career (earned flag blocks a second)', lb.traits.bridge === null);
}
{
  const roster = genRoster('S');
  const lb = roster.find((p) => p.position === 'LB');
  lb.traits = { bridge: null, play: [], flaws: [], earned: false };
  lb.stats = { snaps: 500, snapsAt: { S: 300 } };
  const st = mkState(roster);
  globalThis.__noEarnBridge = true;
  earnBridges(st);
  delete globalThis.__noEarnBridge;
  check('__noEarnBridge: no grants', lb.traits.bridge === null);
}
// ── bulk/cut ─────────────────────────────────────────────────────────────────
{
  const roster = genRoster('S');
  for (const p of roster) p.stats = { snaps: 0 };
  // convert body plan: an OLB headed to DE (DL window 270+) from 250
  const conv = roster.find((p) => p.position === 'OLB');
  conv.weight = 250; conv.position = 'DE'; conv.bodyPlan = { targetW: 270, from: 'OLB', to: 'DE' };
  conv.attributes.WE = 90; conv.attributes.CON = 90;
  const strBefore = conv.attributes.STR, spdBefore = conv.attributes.SPD;
  // foreign-job window: an S living at ILB (LB window 225+) from 205
  const jobber = roster.find((p) => p.position === 'S');
  jobber.weight = 205; jobber.stats = { snaps: 500, snapsAt: { ILB: 300 } };
  // own-band regression: a WR far under his window
  const skinny = roster.find((p) => p.position === 'WR');
  skinny.weight = 150;
  // in-window body: no move
  const fine = roster.find((p) => p.position === 'RB');
  fine.weight = 210;
  const fineW = fine.weight;
  // specialist: never moves
  const k = roster.find((p) => p.position === 'K');
  k.weight = 150;
  const st = mkState(roster);
  offseasonBulkCut(st);
  const moved = conv.weight - 250;
  check('convert body plan consumed (bulks toward DE)', moved > 0, `+${moved} lb`);
  check('per-offseason cap respected', moved >= P7.bulkMin - 1 && moved <= P7.bulkMax, `cap [${P7.bulkMin},${P7.bulkMax}]`);
  check('coupled attr nudges: STR up, SPD down on a bulk', conv.attributes.STR >= strBefore && conv.attributes.SPD <= spdBefore, `STR ${strBefore}→${conv.attributes.STR} SPD ${spdBefore}→${conv.attributes.SPD}`);
  check('foreign-job window targets the body (S living at ILB bulks)', jobber.weight > 205, `${205}→${jobber.weight}`);
  check('own-band regression (150-lb WR bulks toward his window)', skinny.weight > 150, `150→${skinny.weight}`);
  check('in-window body does not move', fine.weight === fineW);
  check('specialists sit out', k.weight === 150);
  check('offseason body-work digest lands in the inbox', st.inbox.some((m) => m.id.startsWith('bulkcut_')));
}
{
  const roster = genRoster('S');
  const conv = roster.find((p) => p.position === 'OLB');
  conv.weight = 250; conv.bodyPlan = { targetW: 270, to: 'DE' };
  const st = mkState(roster);
  globalThis.__noBulkCut = true;
  offseasonBulkCut(st);
  delete globalThis.__noBulkCut;
  check('__noBulkCut: nobody moves', conv.weight === 250);
}
// multi-offseason arc: the plan survives until the window is reached
{
  const roster = genRoster('S');
  for (const p of roster) p.stats = { snaps: 0 };
  const conv = roster.find((p) => p.position === 'OLB');
  conv.weight = 245; conv.position = 'DE'; conv.bodyPlan = { targetW: 270, from: 'OLB', to: 'DE' };
  conv.attributes.WE = 90; conv.attributes.CON = 90;
  const st = mkState(roster, false);
  for (let y = 0; y < 4 && conv.bodyPlan; y++) offseasonBulkCut(st);
  check('multi-offseason bulk arc reaches the DE window and retires the plan', conv.weight >= 268 && !conv.bodyPlan, `final ${conv.weight} lb`);
}
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
