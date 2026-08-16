// robber_probe.mjs — does the Quarters two-high SAFETY rob the in-breaker?
//
// Fix D (coverage pass, Aug 2026). In a two-high shell the safety reads #2; on
// a vertical #2 he plays the 2-to-1 robber and undercuts #1's in-breaker (dig /
// slant / post). Before this, a two-high shell was a flat separation nudge with
// no defender who reads a second receiver and jumps a first — so it couldn't
// deny in-breakers or pick jumped routes, and the coverage-style INT split was
// under-modeled. Two things happen on a robbed throw: the window SHRINKS (the
// undercut costs the receiver separation, handled in resolvePassPlay) and the
// robber is a materially bigger PICK threat than a trailing deep helper
// (catchResolution's robber flag lifts the helper INT factor + ceiling).
//
// The pick is a rare event, so a whole-game INT delta sits inside sampling
// noise. The HARD GATE is therefore on the mechanism itself — catchResolution
// (now exported) called head-to-head with the robber flag off vs on, same
// separation, same defender — which is noise-free:
//   1. INTERCEPTION rate must RISE with the robber flag (the undercut pick).
//   2. COMPLETION rate must not rise (a live robber never helps the offense).
//   3. DISCIPLINE — a rangier/ sharper robber (AWR/SPD) picks more than a poor
//      one, so the pick scales with the man, not a constant.
// A small end-to-end A/B (globalThis.__noRobber off vs on, defense pinned to a
// two-high zone) is printed as INFORMATIONAL, to confirm the window also shrinks
// in live play.
//
// Usage: node tools/robber_probe.mjs [games]
import { catchResolution } from '../js/engine/sim.js';
import { createPlayer } from '../js/engine/player.js';

// One fixed matchup, many trials: the only thing that changes is the robber flag.
const QB   = createPlayer('QB', 'JR', 3);
const REC  = createPlayer('WR', 'JR', 3);
const COVER= createPlayer('CB', 'JR', 3);
const ROB  = createPlayer('S',  'JR', 3);
ROB.attributes.AWR = 85; ROB.attributes.SPD = 85;
const TRIALS = 60000;
const SEP = 0.42; // a medium in-breaker, ball out on rhythm

function rates(robberFlag, robPlayer = ROB) {
  let comp = 0, int = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = catchResolution(SEP, QB, COVER, 'medium', false, REC, false, false, robPlayer, 0, robberFlag);
    if (r.complete) comp++; else if (r.int) int++;
  }
  return { comp: 100 * comp / TRIALS, int: 100 * int / TRIALS };
}

let fails = 0;
const chk = (cond, msg) => { if (!cond) fails++; console.log(`  ${cond ? 'ok ' : 'BAD'} ${msg}`); };

console.log(`Robber #2-read — mechanism A/B, ${TRIALS} trials, fixed matchup, sep ${SEP}\n`);

const off = rates(false);
const on  = rates(true);
console.log(`  helper (not robbing):  comp ${off.comp.toFixed(1)}%  int ${off.int.toFixed(2)}%`);
console.log(`  robber (eyes on #1):   comp ${on.comp.toFixed(1)}%  int ${on.int.toFixed(2)}%`);
chk(on.int > off.int + 0.2, `the robber raises interception rate (Δ +${(on.int - off.int).toFixed(2)}pp)`);
chk(on.comp <= off.comp + 0.3, `the robber never helps the offense complete`);

// discipline: a poor safety robs less than a rangy one
const poor = createPlayer('S', 'JR', 3); poor.attributes.AWR = 45; poor.attributes.SPD = 55;
const onPoor = rates(true, poor);
console.log(`  poor robber (AWR45):   comp ${onPoor.comp.toFixed(1)}%  int ${onPoor.int.toFixed(2)}%`);
chk(on.int > onPoor.int, `a rangier, sharper robber picks more than a poor one (${on.int.toFixed(2)} > ${onPoor.int.toFixed(2)})`);

// informational: end-to-end window shrink
const N = parseInt(process.argv[2] || '0', 10);
if (N > 0) {
  const { refreshRatings } = await import('../js/engine/player.js');
  const { buildDepthChart } = await import('../js/engine/world.js');
  const { simulateGame } = await import('../js/engine/sim.js');
  const { ROSTER_TARGETS, CLASS_YEARS } = await import('../js/constants.js');
  const sH = { id:'H' }, sA = { id:'A' };
  const gen = id => { const r = []; for (const [p,c] of Object.entries(ROSTER_TARGETS)) for (let i=0;i<c;i++){ const q=createPlayer(p,CLASS_YEARS[i%4],1); q.schoolId=id; r.push(q);} return r; };
  const pin = r => { for (const p of r) if (['S','FS','SS'].includes(p.position)) { p.attributes.AWR=88; p.attributes.SPD=88; refreshRatings(p);} };
  const gpO = { offFormation:'Pro-Set', tendency:'Pass', rushInPct:35, passDepth:{short:30,medium:50,deep:20}, blitzPct:10, defFormation:'Balanced D', fourthDown:'Moderate', clockMgmt:'Normal', maxFGDist:42 };
  const dP = { ...gpO, covShellEff:'two', covStyleEff:'zone' };
  const arm = () => { let a=0,c=0,ii=0; for (let i=0;i<N;i++){ const rH=gen('H'), rA=gen('A'); pin(rA); const cH=buildDepthChart(rH,gpO), cA=buildDepthChart(rA,dP); const st=simulateGame(sH,sA,rH,rA,cH,cA,gpO,dP).homeStats; a+=st.passAtt; c+=st.compAtt; ii+=st.ints;} return {comp:100*c/(a||1), int:100*ii/(a||1)}; };
  globalThis.__noRobber = true; const eOff = arm(); globalThis.__noRobber = false; const eOn = arm();
  console.log(`\nInformational — end-to-end (${N} games, two-high zone, rangy S):`);
  console.log(`  robber OFF  comp ${eOff.comp.toFixed(1)}%  int ${eOff.int.toFixed(2)}%`);
  console.log(`  robber ON   comp ${eOn.comp.toFixed(1)}%  int ${eOn.int.toFixed(2)}%   (window shrinks: Δcomp ${(eOn.comp-eOff.comp).toFixed(2)}pp)`);
}

console.log(fails
  ? `\nFAIL — ${fails} check(s).`
  : '\nPASS — the robber flag raises the pick rate, never helps the offense, and scales with the safety.');
process.exit(fails ? 1 : 0);
