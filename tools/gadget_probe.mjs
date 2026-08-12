// gadget_probe.mjs — PASS 5 §B: true trick plays (Reverse, Flea Flicker, HB Pass).
//
// Claims (Throw Deep trick guides via GLOSSARY_ROADMAP §C):
//   Reverse — second exchange against the grain; punishes over-pursuit; high
//   variance (TD or big loss); dies to a contain edge that stays home.
//   Flea Flicker — cashes in vs a run-committed front; the toss-back eats the
//   clock, so the pocket exposure (sacks/hurries) is real.
//   HB Pass — the BACK is the thrower; his arm prices the risk.
//
// Checks (A/B via defensive dials over full games):
//   1. All three gadgets fire organically at gadget-rare frequency, and each
//      stamps its concept name.
//   2. Reverse ypc vs a crashing/run-committed defense beats reverse ypc vs a
//      contain defense by a clear margin (the play's whole identity).
//   3. Reverse carries exchange-fumble risk the jet doesn't (>0 fumbled
//      exchanges across the sample).
//   4. Flea Flicker completion% vs run-committed defense > vs two-shell
//      pass-first defense (the bite is the separation).
//   5. Gadget deep shots take sacks at a higher rate than vanilla deep shots
//      (the toss-back tax).
//   6. HB Pass thrower is a RB (throwerId ∉ QB set on hbpass snaps).
//   7. __noGadgets: zero gadget flags; forced gadget calls fall back to
//      vanilla plays without error.
//
// Run: node tools/gadget_probe.mjs [games]
import { simulateGame } from '../js/engine/sim.js';
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';

const GAMES = Number(process.argv[2] || 40);
let pass = true;
const check = (ok, label) => { console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}`); if (!ok) pass = false; };

function roster(sid) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) for (let i = 0; i < count; i++) {
    const p = createPlayer(pos, CLASS_YEARS[i % 4], 1); p.schoolId = sid; r.push(p);
  }
  return r;
}
const offGp = (extra = {}) => ({ offFormation: 'Spread', offFormations: [{ id: 'Spread', weight: 100 }], tendency: 'Balanced', rushInPct: 40, passDepth: { short: 25, medium: 35, deep: 40 }, blitzPct: 20, defFormation: 'Balanced D', fourthDown: 'Moderate', clockMgmt: 'Normal', maxFGDist: 42, rpoRate: 0, gadgetRate: 12, ...extra });

function run(games, offExtra, defExtra) {
  const c = { snaps: 0, rev: [], revFum: 0, ffComp: 0, ffAtt: 0, ffSack: 0, deepSack: 0, deepAtt: 0, hbThrower: [], names: {}, gadgets: 0 };
  for (let g = 0; g < games; g++) {
    const rH = roster('H'), rA = roster('A');
    const qbIds = new Set(rH.concat(rA).filter((p) => p.position === 'QB').map((p) => p.id));
    // Attribute to the H OFFENSE only — the away team's gadget snaps face
    // H's balanced defense and would wash the dial contrast.
    const hIds = new Set(rH.map((p) => p.id));
    const isH = (pl) => hIds.has(pl.rusherId) || hIds.has(pl.throwerId) || hIds.has(pl.targetId);
    const gpO = offGp(offExtra), gpD = offGp(defExtra);
    const res = simulateGame({ id: 'H', name: 'H' }, { id: 'A', name: 'A' }, rH, rA, buildDepthChart(rH, gpO), buildDepthChart(rA, gpO), gpO, gpD);
    for (const d of res.drives || []) for (const pl of d.plays || []) {
      c.snaps++;
      if (pl.gadget) { c.gadgets++; if (pl.concept) c.names[pl.concept] = (c.names[pl.concept] || 0) + 1; }
      if (pl.gadget === 'hbpass' && pl.throwerId) c.hbThrower.push(!qbIds.has(pl.throwerId));
      if (!isH(pl)) continue;
      if (pl.gadget) c.gadgetsH = (c.gadgetsH || 0) + 1;
      if (pl.gadget === 'reverse') { if (pl.revSniffed) c.revSniff = (c.revSniff || 0) + 1; c.revAll = (c.revAll || 0) + 1; if (pl.exchangeFumbled) c.revFum++; else c.rev.push(pl.yards || 0); }
      if ((pl.gadget === 'fleaflicker' || pl.gadget === 'hbpass') && pl.type.startsWith('pass')) {
        c.ffAtt++;
        if (pl.complete) c.ffComp++;
        if (pl.sack) c.ffSack++;
      }
      if (!pl.gadget && pl.type === 'pass_deep') { c.deepAtt++; if (pl.sack) c.deepSack++; }
    }
  }
  return c;
}
const avg = (a) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;

console.log(`=== GADGET TIER (Pass 5 §B), ${GAMES} games/cell ===`);

// vs a crashing, run-committed defense / vs a disciplined contain two-shell.
// PASS 6 note: these arms measure RESOLUTION pricing (Pass 5), so they run
// under __noTrickBrain — otherwise the new call brain halves the contain arm's
// gadget sample and the ypc/comp% reads go noisy (probe-craft: isolate the
// mechanism under test).
globalThis.__noTrickBrain = true;
const vsCrash = run(GAMES, {}, { runCommit: 8, edgePlay: 'crash', blitzPct: 25 });
const vsContain = run(GAMES, {}, { runCommit: 0, edgePlay: 'contain', covShell: 'two', blitzPct: 12 });
delete globalThis.__noTrickBrain;

const all = { ...vsCrash.names };
for (const [k, v] of Object.entries(vsContain.names)) all[k] = (all[k] || 0) + v;
const totalSnaps = vsCrash.snaps + vsContain.snaps;
const gadShare = 100 * (vsCrash.gadgets + vsContain.gadgets) / totalSnaps;
check(all['Reverse'] > 3 && all['Flea Flicker'] > 3 && all['HB Pass'] > 3 && gadShare < 8,
  `all three fire, gadget-rare (${gadShare.toFixed(1)}% of ${totalSnaps} snaps) ${JSON.stringify(all)}`);

const revCrash = avg(vsCrash.rev), revContain = avg(vsContain.rev);
// PASS 6 probe-craft hardening: the old ypc gate (+1.5 margin) sat on its own
// noise floor (reverse ypc SD ~9; measured gaps across reruns: 2.3/0.3/1.1/
// 1.1/1.5 — stream re-base, PROBE LESSON). The pricing LEVER is sniffP
// (contain +0.14, crash −0.10) — gate the sniff RATE (binomial, tight) and
// keep ypc as a direction read.
check(revCrash > revContain, `reverse punishes over-pursuit (direction): ${revCrash.toFixed(1)} ypc vs crash > ${revContain.toFixed(1)} ypc vs contain`);
const snCrash = 100 * (vsCrash.revSniff || 0) / (vsCrash.revAll || 1), snContain = 100 * (vsContain.revSniff || 0) / (vsContain.revAll || 1);
check((vsContain.revAll || 0) >= 20 && snContain > snCrash + 8, `contain edge sniffs the reverse: ${snContain.toFixed(0)}% vs ${snCrash.toFixed(0)}% (+8 gate; n=${vsContain.revAll}/${vsCrash.revAll})`);
check(vsCrash.revFum + vsContain.revFum > 0, `double exchange carries fumble risk (${vsCrash.revFum + vsContain.revFum} exchange fumbles)`);

const ffCompCrash = 100 * vsCrash.ffComp / (vsCrash.ffAtt || 1);
const ffCompContain = 100 * vsContain.ffComp / (vsContain.ffAtt || 1);
check(ffCompCrash > ffCompContain + 3, `gadget shot comp% vs run-committed ${ffCompCrash.toFixed(1)}% > vs two-shell ${ffCompContain.toFixed(1)}%`);

const gadSack = 100 * (vsCrash.ffSack + vsContain.ffSack) / (vsCrash.ffAtt + vsContain.ffAtt || 1);
const vanSack = 100 * (vsCrash.deepSack + vsContain.deepSack) / (vsCrash.deepAtt + vsContain.deepAtt || 1);
check(gadSack > vanSack + 1.5, `toss-back tax: gadget shot sack% ${gadSack.toFixed(1)} > vanilla deep ${vanSack.toFixed(1)}`);

const hbOK = vsCrash.hbThrower.concat(vsContain.hbThrower);
check(hbOK.length > 0 && hbOK.every(Boolean), `HB Pass thrower is the back on all ${hbOK.length} throws`);

globalThis.__noGadgets = true;
const killed = run(Math.max(6, Math.floor(GAMES / 3)), {}, {});
globalThis.__noGadgets = false;
check(killed.gadgets === 0, `__noGadgets: 0 gadget snaps across ${killed.snaps}`);

// ── PASS 6: the auto-call BRAIN — the organic roll reads defensive posture.
// Rate arms at gadgetRate 5 (under the 0.12 clamp so multipliers can move):
// a crashing run-committed defense should DRAW tricks; a disciplined two-high
// contain defense should starve them. __noTrickBrain flattens the read.
console.log('\n=== TRICK-PLAY AUTO-CALL BRAIN (Pass 6) ===');
const brainOff = { gadgetRate: 5 };
// Opponent runs zero gadgets of its own (gadgetRate 0) and only H-offense
// gadget snaps are counted (gadgetsH) — the arms differ ONLY in the defensive
// posture H's offense reads.
const invite = run(GAMES, brainOff, { gadgetRate: 0, runCommit: 15, edgePlay: 'crash', blitzPct: 30 });
const starve = run(GAMES, brainOff, { gadgetRate: 0, runCommit: -5, edgePlay: 'contain', covShell: 'two', blitzPct: 10 });
const invRate = 1000 * (invite.gadgetsH || 0) / invite.snaps, stvRate = 1000 * (starve.gadgetsH || 0) / starve.snaps;
check((invite.gadgetsH || 0) >= 8 && invRate > stvRate * 1.3,
  `posture moves the call: ${invRate.toFixed(1)} gadgets/1000 snaps vs crash-commit > 1.3× ${stvRate.toFixed(1)} vs disciplined (${invite.gadgetsH || 0} vs ${starve.gadgetsH || 0})`);
globalThis.__noTrickBrain = true;
const flatInv = run(GAMES, brainOff, { gadgetRate: 0, runCommit: 15, edgePlay: 'crash', blitzPct: 30 });
const flatStv = run(GAMES, brainOff, { gadgetRate: 0, runCommit: -5, edgePlay: 'contain', covShell: 'two', blitzPct: 10 });
delete globalThis.__noTrickBrain;
const fiRate = 1000 * (flatInv.gadgetsH || 0) / flatInv.snaps, fsRate = 1000 * (flatStv.gadgetsH || 0) / flatStv.snaps;
check(fiRate < Math.max(fsRate, 0.5) * 1.75,
  `__noTrickBrain flattens the read: ${fiRate.toFixed(1)} vs ${fsRate.toFixed(1)} gadgets/1000 (dial-only)`);

console.log(pass ? '\nALL PASS ✅ — the trick tier is real: boom vs over-pursuit, bust vs discipline' : '\n⚠ FAIL');
process.exit(pass ? 0 : 1);
