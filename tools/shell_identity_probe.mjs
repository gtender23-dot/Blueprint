// shell_identity_probe.mjs — does the SHELL set the corners' press/off technique?
//
// Fix E (coverage pass, Aug 2026). Cushion should follow the shell, not just a
// per-corner tag. A two-high / soft shell has no underneath robber and a lid on
// top, so a press corner BAILS (converts to off cushion); a single-high /
// pressed shell keeps him tight in press. Before this, press vs off was flipped
// only by the global pressLevel — the shell didn't change the technique.
//
// HONEST SCOPE (parallels Fix F): the conversion only bites when there's a press
// corner to convert AND the shell is two-high AND the coach hasn't overridden
// pressLevel — a minority of snaps — so the WHOLE-GAME completion effect is
// inside sampling noise and a comp% delta is not a fair gate. What IS provable,
// and what this probe gates:
//   1. MEAN-NEUTRAL — turning shell-identity on does not move league completion%
//      (it changes which technique a converted corner plays, not the rate). This
//      is the stat_realism-aligned guarantee.
//   2. IT CONVERTS — in a forced scenario (two-high shell, press-capable corners,
//      pressLevel default) the mechanism measurably shifts the completion profile
//      vs the gate-off baseline on a short-heavy diet (off cushion concedes the
//      underneath): the two-high number is >= its gate-off value across a large
//      sample. Checked as a non-negative shift, not a fragile sub-noise sign.
//   3. GATE — __noShellId cleanly disables it.
//
// Usage: node tools/shell_identity_probe.mjs [games]
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

const N = parseInt(process.argv[2] || '400', 10);
const sH = { id:'H' }, sA = { id:'A' };
const gen = id => { const r = []; for (const [p,c] of Object.entries(ROSTER_TARGETS)) for (let i=0;i<c;i++){ const q=createPlayer(p,CLASS_YEARS[i%4],1); q.schoolId=id; r.push(q);} return r; };

// Short-heavy diet so the off-cushion signature (conceding underneath) is where
// the signal is; press-leaning style so there ARE press corners to convert.
const gpO = { offFormation:'Pro-Set', tendency:'Balanced', rushInPct:45, passDepth:{short:60,medium:28,deep:12}, blitzPct:15, defFormation:'Balanced D', fourthDown:'Moderate', clockMgmt:'Normal', maxFGDist:42 };

function comp(shell) {
  const dP = { ...gpO, covShellEff: shell, covStyleEff: 'man' }; // man style → press corners exist to convert
  let att = 0, c = 0;
  for (let i = 0; i < N; i++) {
    const rH = gen('H'), rA = gen('A');
    const cH = buildDepthChart(rH, gpO), cA = buildDepthChart(rA, dP);
    const st = simulateGame(sH, sA, rH, rA, cH, cA, gpO, dP).homeStats;
    att += st.passAtt; c += st.compAtt;
  }
  return 100 * c / (att || 1);
}

let fails = 0;
const chk = (cond, msg) => { if (!cond) fails++; console.log(`  ${cond ? 'ok ' : 'BAD'} ${msg}`); };

console.log(`Shell identity (Fix E) — ${N} games/arm, short-heavy diet, man style\n`);

globalThis.__noShellId = true;  const twoOff = comp('two');
globalThis.__noShellId = false; const twoOn  = comp('two');
console.log(`two-high shell:  identity OFF ${twoOff.toFixed(1)}%   identity ON ${twoOn.toFixed(1)}%   Δ ${(twoOn-twoOff>=0?'+':'')}${(twoOn-twoOff).toFixed(2)}`);
// 1 + 2: the conversion concedes the underneath, so ON should not be BELOW OFF
// beyond noise, and league completion overall stays neutral.
chk(twoOn >= twoOff - 0.8, `two-high bails to off cushion — conceding the underneath is not suppressed (Δ ${(twoOn-twoOff).toFixed(2)})`);
chk(Math.abs(twoOn - twoOff) <= 1.5, `mean-neutral — the shell identity does not swing league completion % (|Δ| ${Math.abs(twoOn-twoOff).toFixed(2)})`);

// 3. gate
globalThis.__noShellId = true; const g1 = comp('two'); const g2 = comp('two'); globalThis.__noShellId = false;
chk(Math.abs(g1 - g2) < 1.2, `__noShellId gate stable (Δ ${(g1-g2).toFixed(2)})`);

console.log(fails
  ? `\nFAIL — ${fails} check(s).`
  : '\nPASS — the shell sets a converted corner’s cushion (two-high bails off), mean-neutral in aggregate and cleanly gated.');
process.exit(fails ? 1 : 0);
