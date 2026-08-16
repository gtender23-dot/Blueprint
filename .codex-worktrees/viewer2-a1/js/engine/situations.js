import { __spreadValues } from '../_spread.js';
import { C, aggrStopFromBlitzPct } from '../constants.js';
import { clamp2 } from '../utils.js';

function resolveSituation({ down, distance, fieldPos, margin, clock }) {
  if (fieldPos >= 95) return "goal_line";
  if (fieldPos <= 5) return "backed_up";
  if (clock <= 300 && margin <= -11) return "two_min_trail";
  if (clock <= 300 && margin >= 11) return "four_min_lead";
  if (fieldPos >= 80) return "red_zone";
  if (down >= 3 && distance <= 2) return "third_short";
  if (down >= 3 && distance <= 6) return "third_medium";
  if (down >= 3) return "third_long";
  if (down === 2 && distance >= 8) return "second_long";
  if (down === 1) return "first_ten";
  return "base";
}
function getEffectivePlan(gameplan, weeklyPlan, sitKey) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H, _I, _J, _K, _L, _M, _N, _O, _P, _Q, _R, _S, _T, _U, _V, _W, _X, _Y, _Z, __, _$, _aa;
  const cell = gameplan.situations && gameplan.situations[sitKey] || {};
  return {
    sitKey,
    offFormations: (_a = cell.offFormations) != null ? _a : gameplan.offFormations,
    tendency: (_b = cell.tendency) != null ? _b : null,
    passLeanShift: (_c = weeklyPlan == null ? void 0 : weeklyPlan.passLeanShift) != null ? _c : 0,
    passDepth: (_e = (_d = (weeklyPlan == null ? void 0 : weeklyPlan.passDepth) && WEEKLY_DEPTH_PRESETS[weeklyPlan.passDepth]) != null ? _d : cell.passDepth) != null ? _e : gameplan.passDepth,
    qbRunPct: (_g = (_f = cell.qbRunPct) != null ? _f : gameplan.qbRunPct) != null ? _g : 0,
    tempo: (_k = (_j = (_i = (_h = weeklyPlan == null ? void 0 : weeklyPlan.tempo) != null ? _h : cell.tempo) != null ? _i : SMART_AUTO_TEMPO[sitKey]) != null ? _j : gameplan.baseTempo) != null ? _k : "Normal",
    defFront: (_l = cell.defFront) != null ? _l : "auto",
    // W4 (§2): the aggression STOP is the dial now. A legacy cell/base plan
    // that still carries only blitzPct migrates through nearest-stop here, so
    // untouched saves and AI staffs resolve identically without a sweep. The
    // numeric blitzPct survives as the stop's base call rate (+ the weekly
    // shift) because half the engine — the draw's caught-blitz roll, penalty
    // aggression, scout memos, coach-DNA XP — reads it as ground truth.
    defAggression: cell.defAggression != null ? cell.defAggression : cell.blitzPct != null ? aggrStopFromBlitzPct(cell.blitzPct) : gameplan.defAggression != null ? gameplan.defAggression : aggrStopFromBlitzPct(gameplan.blitzPct),
    pressureIdentity: (weeklyPlan == null ? void 0 : weeklyPlan.pressureIdentity) != null ? weeklyPlan.pressureIdentity : cell.pressureIdentity != null ? cell.pressureIdentity : gameplan.pressureIdentity != null ? gameplan.pressureIdentity : null,
    blitzPct: clamp2(((_n = C.AGGRESSION.rate[cell.defAggression != null ? cell.defAggression : cell.blitzPct != null ? aggrStopFromBlitzPct(cell.blitzPct) : gameplan.defAggression != null ? gameplan.defAggression : aggrStopFromBlitzPct(gameplan.blitzPct)]) != null ? _n : 20) + ((_o = weeklyPlan == null ? void 0 : weeklyPlan.blitzShift) != null ? _o : 0), 0, 75),
    // W4 (§16.2): protection identity — the offense's aggression mirror.
    // Half-Slide is the modern default = the pre-W4 engine.
    protIdentity: cell.protIdentity != null ? cell.protIdentity : gameplan.protIdentity != null ? gameplan.protIdentity : "halfSlide",
    coverageScheme: (_r = (_q = (_p = weeklyPlan == null ? void 0 : weeklyPlan.coverageScheme) != null ? _p : cell.coverageScheme) != null ? _q : gameplan.coverageScheme) != null ? _r : "balanced",
    runCommit: clamp2(((_t = (_s = cell.runCommit) != null ? _s : gameplan.runCommit) != null ? _t : 0) + ((_u = weeklyPlan == null ? void 0 : weeklyPlan.runCommitShift) != null ? _u : 0) + ((_v = gameplan._tendencyKey) != null ? _v : 0), -25, 25),
    // Option assignment vs triple-option offenses (Jul 2026): which phase the
    // defense is scheme-committed to taking away. Weekly game-planning
    // outranks the base dial — this is a set-it-on-Tuesday call.
    optionKey: (_y = (_x = (_w = weeklyPlan == null ? void 0 : weeklyPlan.optionKey) != null ? _w : cell.optionKey) != null ? _x : gameplan.optionKey) != null ? _y : "balanced",
    // P1 controls (Aug 2026): the robber call and the zone teaching style,
    // cell-overridable like every coverage dial. Defaults = today's game.
    robberCall: cell.robberCall != null ? cell.robberCall : gameplan.robberCall != null ? gameplan.robberCall : "auto",
    zoneStyle: cell.zoneStyle != null ? cell.zoneStyle : gameplan.zoneStyle != null ? gameplan.zoneStyle : "balanced",
    // Edge discipline (controls pass): contain sets the edge vs jets/screens/
    // sweeps at the cost of a hotter pocket; crash pins its ears back.
    edgePlay: (_B = (_A = (_z = weeklyPlan == null ? void 0 : weeklyPlan.edgePlay) != null ? _z : cell.edgePlay) != null ? _A : gameplan.edgePlay) != null ? _B : "balanced",
    // Offense rate dials, situationally overridable (null = formation default
    // or base dial; the sim's ?? chain finishes the job).
    optionRate: (_D = (_C = cell.optionRate) != null ? _C : gameplan.optionRate) != null ? _D : null,
    jetRate: (_F = (_E = cell.jetRate) != null ? _E : gameplan.jetRate) != null ? _F : null,
    drawRate: (_H = (_G = cell.drawRate) != null ? _G : gameplan.drawRate) != null ? _H : null,
    // Pass-game pass (Jul 2026): the coverage identity and the offense's
    // protection/aggression answers, all weekly- and cell-overridable.
    covShell: (_K = (_J = (_I = weeklyPlan == null ? void 0 : weeklyPlan.covShell) != null ? _I : cell.covShell) != null ? _J : gameplan.covShell) != null ? _K : "balanced",
    covStyle: (_N = (_M = (_L = weeklyPlan == null ? void 0 : weeklyPlan.covStyle) != null ? _L : cell.covStyle) != null ? _M : gameplan.covStyle) != null ? _N : "balanced",
    // Defensive-audit dials (Jul 2026): cushion, tackling, sub philosophy,
    // and who the bracket keys on — all cell-overridable.
    pressLevel: (_P = (_O = cell.pressLevel) != null ? _O : gameplan.pressLevel) != null ? _P : "balanced",
    tackleStyle: (_R = (_Q = cell.tackleStyle) != null ? _Q : gameplan.tackleStyle) != null ? _R : "balanced",
    subPhilosophy: (_T = (_S = cell.subPhilosophy) != null ? _S : gameplan.subPhilosophy) != null ? _T : "auto",
    bracketWho: (_V = (_U = cell.bracketWho) != null ? _U : gameplan.bracketWho) != null ? _V : "auto",
    protEmphasis: (_X = (_W = cell.protEmphasis) != null ? _W : gameplan.protEmphasis) != null ? _X : 50,
    qbAggr: (_Z = (_Y = cell.qbAggr) != null ? _Y : gameplan.qbAggr) != null ? _Z : 50,
    // Rung 4 (pre-snap layer): how much line-of-scrimmage freedom the QB has —
    // audibles + kill calls. 'auto' is AWR-driven; 'never' runs what's called;
    // 'free' hands him the keys (more checks, and the film shows it).
    losFreedom: (_$ = (__ = cell.losFreedom) != null ? __ : gameplan.losFreedom) != null ? _$ : "auto",
    // Rung 5's deferred WIZARD GRID (Jul 2026): per-situation playbook
    // weights. A cell's weights overlay the base sheet PER CONCEPT — unset
    // concepts inherit the base weight, and an untouched cell inherits the
    // whole sheet. The old-saves law holds by construction: no cells, no
    // base weights → null → uniform → the pre-playbook game exactly.
    conceptWeights: cell.conceptWeights ? __spreadValues(__spreadValues({}, gameplan.conceptWeights || {}), cell.conceptWeights) : (_aa = gameplan.conceptWeights) != null ? _aa : null
  };
}
function defaultWeeklyPlan() {
  return {
    // defense — run commit is the box lever; fronts stay situational (auto)
    runCommitShift: 0,
    blitzShift: 0,
    coverageScheme: null,
    optionKey: null,
    edgePlay: null,
    covShell: null,
    covStyle: null,
    // offense
    passLeanShift: 0,
    passDepth: null,
    tempo: null,
    // situational
    fourthDown: null
  };
}
var SITUATION_KEYS, SITUATION_LABELS, WEEKLY_DEPTH_PRESETS, SMART_AUTO_TEMPO;

// "openers" is OFFENSE-ONLY by design (G10, Aug 2026): the defensive situation
// resolve never returns it (sim.js offSitWithOpeners injects it for the offense
// alone) and the gameplan UI hides the defense sub-tab for that cell. Defensive
// fields written into an openers cell are inert.
SITUATION_KEYS = [
  // F3 (Aug 2026): the opening script. Never returned by resolveSituation —
  // the sim maps the first two drives of the game onto this cell (emergency
  // situations still win). No cell = the key never fires.
  "openers",
  "goal_line",
  "backed_up",
  "two_min_trail",
  "four_min_lead",
  "red_zone",
  "third_short",
  "third_medium",
  "third_long",
  "second_long",
  "first_ten",
  "base"
];
SITUATION_LABELS = {
  openers: "Openers (Drives 1–2)",
  goal_line: "Goal Line",
  backed_up: "Backed Up (own 5)",
  two_min_trail: "2-Minute, Trailing",
  four_min_lead: "4-Minute, Leading",
  red_zone: "Red Zone",
  third_short: "3rd/4th & Short",
  third_medium: "3rd & Medium",
  third_long: "3rd & Long",
  second_long: "2nd & Long",
  first_ten: "1st & 10",
  base: "Base"
};
WEEKLY_DEPTH_PRESETS = {
  quick: { short: 60, medium: 30, deep: 10 },
  // beat pressure with the quick game
  deep: { short: 25, medium: 35, deep: 40 }
  // attack a soft/vulnerable secondary
};
SMART_AUTO_TEMPO = { two_min_trail: "Hurry", four_min_lead: "Chew" };

export { SITUATION_KEYS, SITUATION_LABELS, defaultWeeklyPlan, getEffectivePlan, resolveSituation };
