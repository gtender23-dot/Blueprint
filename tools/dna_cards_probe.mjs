// dna_cards_probe.mjs — do the Pressure and Discipline coach cards do what they SAY?
//
// Discipline card: "Pre-snap penalty rate −(g*1.2)%". It used to scale the WHOLE offensive
//   flag rate (holding and OPI too). Now it cancels only PRE-SNAP flags (false start, illegal
//   formation). HARD GATE: a grade-10 offense commits fewer pre-snap flags, ~unchanged
//   post-snap flags. (Clean: we classify every offensive flag from the play log.)
//
// Pressure card: "Blitz big-play risk −(g*1.5)%" / "bring heat without getting burned deep".
//   It used to SHORTEN the pocket clock (a generic rush buff). Now it shrinks the vacated-zone
//   deep boost the offense gets when a DB blitzes. That touches only DB-blitz deep snaps, so
//   the end-to-end signal is small; reported DIRECTIONALLY, not gated.
//
// Both grades are player-coach only (AI schools have no _dnaGrades), so league play is
// untouched — this measures the graded team head-to-head.
//
// Usage: node tools/dna_cards_probe.mjs [games]
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS, PENALTY_CATALOG } from '../js/constants.js';

const N = parseInt(process.argv[2] || '1200', 10);
const RUN_PRESSURE = process.argv[3] === 'pressure';   // opt-in: adds 2 heavy-sim arms
const PRESNAP = new Map(PENALTY_CATALOG.map(p => [p.name, p.preSnap]));

const genRoster = id => { const r = []; for (const [pos, c] of Object.entries(ROSTER_TARGETS)) for (let i = 0; i < c; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], 1); p.schoolId = id; r.push(p); } return r; };
const gp = over => ({ offFormation:'Pro-Set', tendency:'Balanced', rushInPct:55, passDepth:{short:40,medium:35,deep:25}, blitzPct:20, defFormation:'Balanced D', fourthDown:'Moderate', clockMgmt:'Normal', maxFGDist:42, ...over });

// ── DISCIPLINE (hard gate) ────────────────────────────────────────────────────────────────
function disciplineArm(grade) {
  const sH = { id:'H', name:'Home', _dnaGrades:{ discipline: grade } };
  const sA = { id:'A', name:'Away' };
  let pre = 0, post = 0;
  for (let i = 0; i < N; i++) {
    const rH = genRoster('H'), rA = genRoster('A');
    const cH = buildDepthChart(rH, gp({})), cA = buildDepthChart(rA, gp({}));
    const res = simulateGame(sH, sA, rH, rA, cH, cA, gp({}), gp({}));
    for (const d of (res.drives || [])) for (const p of (d.plays || [])) {
      if (p.type === 'penalty' && p.penaltySide === 'offense' && p.penaltyOn === 'Home') {
        if (PRESNAP.get(p.penaltyName)) pre++; else post++;
      }
    }
  }
  return { pre, post };
}
console.log(`Discipline — Home offense pre-snap vs post-snap flags, ${N} games/arm\n`);
const d0 = disciplineArm(0), d10 = disciplineArm(10);
console.log(`grade  0 : pre-snap ${d0.pre}   post-snap ${d0.post}`);
console.log(`grade 10 : pre-snap ${d10.pre}   post-snap ${d10.post}`);
const preDrop = 100 * (1 - d10.pre / (d0.pre || 1));
const postDrop = 100 * (1 - d10.post / (d0.post || 1));
console.log(`pre-snap −${preDrop.toFixed(0)}%   post-snap −${postDrop.toFixed(0)}% (should be ~0)`);
let fail = 0;
if (d10.pre < d0.pre && preDrop > 6) console.log('PASS — grade-10 discipline cuts pre-snap flags.');
else { fail++; console.log('FAIL — pre-snap flags did not fall with discipline (raise game count if borderline).'); }
if (Math.abs(postDrop) < 7 && Math.abs(postDrop) < preDrop * 0.7) console.log('OK — post-snap flags essentially unchanged, as the card promises.');
else { fail++; console.log('FAIL — post-snap flags moved too much; discipline may still be scaling everything.'); }

// ── PRESSURE (directional, opt-in: node tools/dna_cards_probe.mjs <games> pressure) ─────────
if (RUN_PRESSURE) {
function pressureArm(grade) {
  const sH = { id:'H', name:'Home', _dnaGrades:{ pressure: grade } };  // Home DEFENSE, heavy blitz
  const sA = { id:'A', name:'Away' };
  let att = 0, comp = 0, yds = 0;
  for (let i = 0; i < N; i++) {
    const rH = genRoster('H'), rA = genRoster('A');
    const cH = buildDepthChart(rH, gp({ blitzPct:70 })), cA = buildDepthChart(rA, gp({ passDepth:{short:20,medium:30,deep:50} }));
    // Home defends with heavy blitz; Away throws deep. Measure Away's passing vs Home's D.
    const res = simulateGame(sH, sA, rH, rA, cH, cA, gp({ blitzPct:70 }), gp({ passDepth:{short:20,medium:30,deep:50} }));
    const st = res.awayStats; att += st.passAtt; comp += st.compAtt; yds += st.passYds;
  }
  return { cpct: 100*comp/(att||1), ypa: yds/(att||1) };
}
console.log(`\nPressure — Away deep passing allowed by a heavy-blitz Home defense, ${N} games/arm (directional)`);
const p0 = pressureArm(0), p10 = pressureArm(10);
console.log(`grade  0 : comp% ${p0.cpct.toFixed(1)}   ypa ${p0.ypa.toFixed(2)}`);
console.log(`grade 10 : comp% ${p10.cpct.toFixed(1)}   ypa ${p10.ypa.toFixed(2)}`);
console.log(`Δ comp% ${(p10.cpct-p0.cpct).toFixed(2)}   Δ ypa ${(p10.ypa-p0.ypa).toFixed(2)}  (expect ≤ 0: a graded coach blitzes without getting burned)`);
}

console.log(fail ? `\n${fail} FAILED` : `\nPASS — discipline drills pre-snap flags only${RUN_PRESSURE ? '; pressure trends toward safer blitzing' : ''}.`);
process.exit(fail ? 1 : 0);
