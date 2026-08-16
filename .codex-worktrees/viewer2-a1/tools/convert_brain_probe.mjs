// convert_brain_probe.mjs — PASS 7 Fix C gate: the recommendation engine is
// the shared brain (owner directive). Identity-aware scoring (destination
// size window prices the body, a bridge covering the destination boosts, the
// rec carries a body direction), the Fix-D usage-buried leg opens recs for
// rotation ghosts, AI schools apply recs through the same penalty economy
// under the cap, and __noConvertBrain restores legacy scoring + inert AI.
// Run: node tools/convert_brain_probe.mjs
import { schoolConversionRecs, aiRosterConverts, previewConversion, bodyTargetForPos, posSizeFit } from '../js/engine/offseason.js';
import { createPlayer, refreshRatings } from '../js/engine/player.js';
import { C, ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};
function genRoster(s) {
  const r = [];
  for (const [pos, c] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < c; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], 1); p.schoolId = s; r.push(p); }
  }
  return r;
}
const mkState = (schools) => ({ season: 3, day: 1, playerSchoolId: 'ME', world: { schools }, preseason: {}, inbox: [] });
const mkSchool = (id, roster) => ({ id, name: id, roster, gameplan: {}, depthOrder: {}, stats: { offSnaps: 800, defSnaps: 800 } });

// band-key law: defensive positions resolve their size families (the DL/LB/DB
// keys), so the body math is never silently inert for defense
{
  check('bodyTargetForPos knows DE (DL band)', bodyTargetForPos(240, 'DE') === 270, `${bodyTargetForPos(240, 'DE')}`);
  check('posSizeFit prices an out-of-window DE', posSizeFit(240, 'DE') < 1, `${posSizeFit(240, 'DE')}`);
  check('in-window body needs no target', bodyTargetForPos(280, 'DE') === null);
}
// identity-aware rec on a planted tweener + body direction data.
// Rooms that would flood the 6-rec cap are trimmed to their two-deep first.
const trimRooms = (roster, keep) => {
  for (const [pos, n] of Object.entries(keep)) {
    const room = roster.filter((p) => p.position === pos).sort((a, b) => b.compositeRating - a.compositeRating);
    for (const p of room.slice(n)) roster.splice(roster.indexOf(p), 1);
  }
};
{
  // LB is the only shorted room: FILL recs funnel there, and every light body
  // the staff pitches into it must carry the planned bulk to the LB window.
  const roster = genRoster('ME');
  const lbs = roster.filter((p) => p.position === 'LB');
  for (let i = 0; i < 3; i++) roster.splice(roster.indexOf(lbs[i]), 1); // LB room 3 short
  const school = mkSchool('ME', roster);
  const st = mkState([school]);
  const recs = schoolConversionRecs(st, school);
  const intoLB = recs.filter((r) => r.to === 'LB');
  check('the short LB room draws FILL recs', intoLB.length > 0, `${intoLB.length} of ${recs.length} recs`);
  const light = intoLB.filter((r) => {
    const p = roster.find((x) => x.id === r.playerId);
    return p && p.weight < 225;
  });
  check('every light body pitched into LB carries the planned bulk', light.length > 0 && light.every((r) => r.bodyDelta > 0), light.map((r) => `${r.from}→LB +${r.bodyDelta}`).join(' · ') || 'none light');
  // same roster, brain killed: legacy recs carry no body data
  globalThis.__noConvertBrain = true;
  const legacy = schoolConversionRecs(st, school);
  delete globalThis.__noConvertBrain;
  check('__noConvertBrain: recs carry no body direction', legacy.every((r) => !r.bodyDelta));
}
// bridge bonus: the SAME body scores higher with a bridge covering the
// destination — toggled on one roster, so nothing else varies
{
  const roster = genRoster('ME');
  const olbs = roster.filter((p) => p.position === 'OLB').sort((a, b) => b.compositeRating - a.compositeRating);
  const subj = olbs[olbs.length - 1];
  subj.weight = 268; subj.classYear = 'SO'; subj.isWalkOn = false;
  // This subject has to clear TWO gates at once: he must be BURIED in his own
  // room, and his DE projection must stay within 3 of his current OLB rating
  // (`projected < current - 3` in schoolConversionRecs skips him otherwise).
  //
  // [2026-08-12] The old fixture scaled every attribute to 0.6 and sat right on
  // that line. Re-deriving OVR_POS_ADJ (playtest item 3) moved DE −2.2 and OLB
  // +1.3, widening the gap ~3.2 and dropping him out of the rec list entirely —
  // at which point the bridge assertion was comparing undefined to undefined and
  // still reading as a near-miss. Scaling harder made it worse, because gutting
  // everything tanks the DE projection too.
  //
  // Build the body the test is actually about instead: a heavy, slow linebacker
  // whose hands are DE hands. Speed/agility/jump in the dirt buries him at OLB;
  // strength and power keep the DE projection honest. That satisfies both gates
  // by construction rather than by sitting near a threshold.
  Object.assign(subj.attributes, { SPD: 30, AGI: 30, JMP: 30, HND: 35, STR: 78, PWR: 76, TEC: 58, AWR: 58 });
  refreshRatings(subj);
  // Two gates have to hold for the SUBJECT to be a candidate at all, and both
  // depend on the rest of the roster, which is random. Pin the competition so
  // this measures the bridge instead of the roll: bury him behind clearly better
  // linebackers, and leave the surviving ends clearly worse so a converted body
  // genuinely ranks in that room. (Without this the fixture reached the rec list
  // about two runs in three.)
  for (const lb of olbs.slice(0, -1)) {
    Object.assign(lb.attributes, { SPD: 82, AGI: 80, STR: 62, PWR: 62, TEC: 74, AWR: 74 });
    refreshRatings(lb);
  }
  const des = roster.filter((p) => p.position === 'DE');
  for (let i = 0; i < 2; i++) roster.splice(roster.indexOf(des[i]), 1);
  for (const de of roster.filter((p) => p.position === 'DE')) {
    Object.assign(de.attributes, { SPD: 40, AGI: 40, STR: 48, PWR: 48, TEC: 42, AWR: 42 });
    refreshRatings(de);
  }
  const school = mkSchool('ME', roster);
  const st = mkState([school]);
  subj.traits = { bridge: null, play: [], flaws: [], earned: false };
  const without = schoolConversionRecs(st, school).find((r) => r.playerId === subj.id && r.to === 'DE');
  subj.traits.bridge = 'edgeBender';
  const withB = schoolConversionRecs(st, school).find((r) => r.playerId === subj.id && r.to === 'DE');
  // THE LAW: a bridge that covers the destination makes the same body a better
  // move to it. That shows up two ways and both count — a higher rec score, or
  // clearing the bar to be recommended at all when the bare body would not be.
  //
  // [2026-08-12] This used to assert the score form only, which quietly assumed
  // the bare body always reached the list. It did, until re-deriving
  // OVR_POS_ADJ (playtest item 3) moved DE −2.2 / OLB +1.3 and the no-bridge arm
  // dropped out — leaving `undefined > undefined + 2` to read as an ordinary
  // near-miss. Measured at the time: the projected-haircut gate is NOT what it
  // trips (previewConversion returns current 48.0 → projected 52.0, a +4.0 gap,
  // identical with and without the bridge), so the bridge is clearing a
  // different bar — which is a STRONGER result than the +2 score it replaced.
  check('edgeBender bridge makes the same body a better DE move', !!withB && (!without || withB.score > without.score + 2),
    without ? `score ${withB ? withB.score.toFixed(1) : '—'} vs ${without.score.toFixed(1)} without`
            : `recommended WITH the bridge (${withB ? withB.score.toFixed(1) : '—'}), not recommended without it`);
  check('and the bridge never makes the move look worse', !without || (!!withB && withB.score >= without.score));
}
// Fix-D usage leg: a room-rank-clean body the rotation never used reads buried
{
  const roster = genRoster('ME');
  trimRooms(roster, { OL: 6, WR: 3, TE: 2, QB: 2, RB: 3, OLB: 3, DE: 3, DT: 3, LB: 2 });
  for (const p of roster) p.stats = { snaps: 300 };
  const ss = roster.filter((p) => p.position === 'S').sort((a, b) => b.compositeRating - a.compositeRating);
  const ghost = ss[1]; // rank 2 of 5 — NOT depth-buried by the legacy test
  ghost.stats = { snaps: 10 }; ghost.classYear = 'JR';
  const cbs = roster.filter((p) => p.position === 'CB').sort((a, b) => b.compositeRating - a.compositeRating);
  for (const p of cbs.slice(4)) roster.splice(roster.indexOf(p), 1); // CB room 3 short
  const school = mkSchool('ME', roster);
  const st = mkState([school]);
  const recs = schoolConversionRecs(st, school);
  const got = recs.find((r) => r.playerId === ghost.id);
  globalThis.__noConvertBrain = true;
  const legacy = schoolConversionRecs(st, school).find((r) => r.playerId === ghost.id);
  delete globalThis.__noConvertBrain;
  check('rotation ghost (10 of 800 snaps, clean room rank) draws a rec', !!got, got ? `${got.from}→${got.to}` : 'no rec');
  check('__noConvertBrain: the usage door closes (legacy depth test only)', !legacy);
}
// AI converts: applied through the same economy, capped, stamped
{
  const roster = genRoster('AI1');
  const olbs = roster.filter((p) => p.position === 'OLB');
  for (const p of olbs.slice(-3)) { p.weight = 268; p.classYear = 'SO'; p.isWalkOn = false; }
  const des = roster.filter((p) => p.position === 'DE');
  for (let i = 0; i < 3; i++) roster.splice(roster.indexOf(des[i]), 1);
  const me = mkSchool('ME', genRoster('ME'));
  const ai = mkSchool('AI1', roster);
  const st = mkState([me, ai]);
  const meBefore = me.roster.map((p) => p.position).join(',');
  aiRosterConverts(st);
  const converted = ai.roster.filter((p) => p.convPenalty && p.convPenalty.season === st.season);
  check('AI school converts at least one obvious body', converted.length >= 1, `${converted.length} converts`);
  check('AI converts respect the cap', converted.length <= C.PASS7.aiPosChangeCap, `cap ${C.PASS7.aiPosChangeCap}`);
  check('conversion penalty + dev tax stamped (same economy the player pays)', converted.every((p) => p.convPenalty.factor > 0 && p.convDev && p.convDev.left === C.POS_CHANGE_DEV_SEASONS));
  check('body plan stamped for stage 4b when the window asks', converted.every((p) => !bodyTargetForPos(p.weight, p.position) || (p.bodyPlan && p.bodyPlan.targetW)));
  check('player school untouched by the AI pass', me.roster.map((p) => p.position).join(',') === meBefore);
  // kill switch: fresh identical setup, zero AI converts
  const roster2 = genRoster('AI2');
  const olbs2 = roster2.filter((p) => p.position === 'OLB');
  for (const p of olbs2.slice(-3)) { p.weight = 268; p.classYear = 'SO'; p.isWalkOn = false; }
  const des2 = roster2.filter((p) => p.position === 'DE');
  for (let i = 0; i < 3; i++) roster2.splice(roster2.indexOf(des2[i]), 1);
  const ai2 = mkSchool('AI2', roster2);
  const st2 = mkState([me, ai2]);
  globalThis.__noConvertBrain = true;
  aiRosterConverts(st2);
  delete globalThis.__noConvertBrain;
  check('__noConvertBrain: AI never converts', ai2.roster.every((p) => !p.convPenalty));
}
// previewConversion school param (AI staffs price the flat penalty)
{
  const ai = mkSchool('AI1', genRoster('AI1'));
  const st = mkState([mkSchool('ME', genRoster('ME')), ai]);
  const p = ai.roster.find((x) => x.position === 'OLB');
  const prev = previewConversion(st, p.id, 'DE', ai);
  check('previewConversion works against an AI school', !!prev && prev.from === 'OLB' && typeof prev.projected === 'number');
}
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
