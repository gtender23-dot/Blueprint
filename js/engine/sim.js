import { __spreadProps, __spreadValues } from '../_spread.js';
import { PASS_CONCEPTS, RUN_CONCEPTS } from '../concepts.js';
import { C, DEF_WEIGHTS, FORMATIONS, FORMATION_PACKAGES, FORMATION_PLAYBOOK, FRONT_ROLES, MEASURED_ATTRS, OFF_WEIGHTS, OUT_OF_POS, PASS_TENDENCY, PENALTY_CATALOG, STARTER_COUNTS, SUB_ADJACENT, aggrStopFromBlitzPct, aliasFormation } from '../constants.js';
import { DEF_DROP_ELIGIBLE, DEF_FIELD_LAYOUTS, OFF_FIELD_LAYOUTS } from '../constants_field.js';
import { contestGap } from './contests.js';
import { resolveDefField, resolveOffField } from './fieldassign.js';
import { FRONT_PRESSURE_SIGNATURE, defUnitStrengthSchemeFit, getDefWeights, getMatchupEdge, getOffWeights, getSituationalMod, offPersonnelClass, offUnitStrengthRoles, resolveDefPersonnel, resolvePersonnel, rollFormation, rollFormationEntry, selectDefFront, variationPassLeanDelta } from './formations.js';
import { derivedArchetype, makeInjury, roleRating } from './player.js';
import { runFit } from './run2geo.js';
import { resolvePocket } from './rushgeo.js';
import { routeDuel } from './sepgeo.js';
import { compilePlay } from './playcompose.js';
import { resolveLookSheet } from './playbook.js';
import { getEffectivePlan, resolveSituation } from './situations.js';
import { coordPackageIQ, formationIqMod } from './staff.js';
import { bridgeWaivesBucket, flawLv, flawMult, traitLv, traitMult } from './traits.js';
import { geoYAC } from './yacgeo.js';
import { clamp2, logistic, randNorm } from '../utils.js';

function composedFrontRoles(frontId) {
  const fr = FRONT_ROLES[frontId] || FRONT_ROLES["4-3"] || {};
  const olbRush = frontId === "3-4" || frontId === "Penny";
  return {
    DL: olbRush ? [...fr.DE || [], ...fr.DT || [], ...fr.OLB || []] : [...fr.DE || [], ...fr.DT || []],
    LB: olbRush ? [...fr.LB || []] : [...fr.LB || [], ...fr.OLB || []],
    DB: [...fr.CB || [], ...fr.S || []],
    DE: fr.DE || [],
    DT: fr.DT || [],
    OLB: fr.OLB || [],
    CB: fr.CB || [],
    S: fr.S || []
  };
}
function normalizeDefGameplan(gp) {
  var _a;
  if (!gp) return;
  if (!gp.coverageScheme) gp.coverageScheme = "balanced";
  if (!gp.situations) gp.situations = {};
  if (!gp.baseTempo) gp.baseTempo = "Normal";
  delete gp.clockMgmt;
  // ── W4 (§2): the numeric blitz layer → Aggression + Pressure Identity. ──
  // Lazy save migration, run on EVERY plan entering a game (old saves, AI
  // staffs, harness plans alike): blitzPct → nearest stop, the stop's rate
  // mirrored back onto blitzPct for every legacy reader, situational
  // blitzPct cells → per-cell stops. pressureSource dies here — the identity
  // + the front's signature package own "who comes" now.
  if (!gp.defAggression) gp.defAggression = aggrStopFromBlitzPct(gp.blitzPct);
  gp.blitzPct = (_a = C.AGGRESSION.rate[gp.defAggression]) != null ? _a : 20;
  if (gp.pressureIdentity === void 0) gp.pressureIdentity = null;
  if (!gp.protIdentity) gp.protIdentity = "halfSlide";
  delete gp.pressureSource;
  for (const cell of Object.values(gp.situations)) {
    if (cell && cell.blitzPct != null && cell.defAggression == null) {
      cell.defAggression = aggrStopFromBlitzPct(cell.blitzPct);
      delete cell.blitzPct;
    }
  }
}
// ── W4 (§2): THE TRANSLATION — aggression × situation × DC timing → this
// snap's pressure-call odds. The stop sets the base rate, the stop's
// PERSONALITY shapes it by leverage (Selective sits on early downs and
// unloads on passing downs; the House doesn't care), and the DC's Blitz
// Design shifts WHEN. lev: 'pass' | 'early' | 'neutral'.
function pressureCallRate({ stop = "balanced", lev = "neutral", design = 50, rate = null }) {
  var _a, _b, _c;
  const A = C.AGGRESSION;
  let r = ((_a = rate != null ? rate : A.rate[stop]) != null ? _a : 20) / 100;
  r *= lev === "pass" ? ((_b = A.passDownMult[stop]) != null ? _b : 1) : lev === "early" ? ((_c = A.earlyDownMult[stop]) != null ? _c : 1) : 1;
  const timing = ((design != null ? design : 50) - 50) / 50 * A.timingSpan;
  r *= lev === "pass" ? 1 + timing : 1 - timing * 0.6;
  return clamp2(r, 0, A.capRate);
}
// W4 (§16.2): protection identity × pressure identity → the pocket factor
// (multiplies protectMult; >1 = hotter pocket). base prices the protection
// alone; tilt prices the MATCHUP on fired-pressure snaps.
function protectionFactor({ protId = "halfSlide", identity = null, playType = "pass_medium", blitzFired = false, centerAwr = 50 }) {
  var _a, _b;
  const P = C.PROT_IDENTITY;
  let f = 1;
  if (protId === "quick") f *= playType === "pass_deep" ? P.base.quickDeep : P.base.quickShort;
  if (protId === "bob" && !blitzFired) f *= P.base.bobFourMan;
  if (protId === "halfSlide") f *= clamp2(1 - (centerAwr - 50) * P.base.slideAwr, 0.9, 1.1);
  if (blitzFired && identity) f *= (_b = (_a = P.tilt[protId]) == null ? void 0 : _a[identity]) != null ? _b : 1;
  return f;
}
function execSkill(spec, roster, personnel) {
  var _a;
  let tot = 0, n = 0;
  for (const [pos, weights] of Object.entries(spec)) {
    const id = (personnel[pos] || [])[0];
    const pl = id ? roster.find((x) => x.id === id) : null;
    if (!pl) continue;
    let v = 0;
    for (const [attr, w] of Object.entries(weights)) v += ((_a = pl.attributes[attr]) != null ? _a : 50) * w;
    tot += v;
    n++;
  }
  return n ? tot / n : 50;
}
function weightedConceptPick(pool, weights) {
  if (!weights) return pool[Math.floor(Math.random() * pool.length)];
  const ws = pool.map(([n]) => {
    var _a;
    return Math.max(0, (_a = weights[n]) != null ? _a : 50);
  });
  const tot = ws.reduce((a, b) => a + b, 0);
  if (tot <= 0) return pool[Math.floor(Math.random() * pool.length)];
  let r = Math.random() * tot;
  for (let i = 0; i < pool.length; i++) {
    r -= ws[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}
function pickPassConcept(playType, offPersonnel, offRoster, family, weights = null, forceName = null, allowed = null) {
  var _a, _b, _c;
  const depth = playType.replace("pass_", "");
  const wrN = (offPersonnel.WR || []).length;
  if (forceName && ((_a = PASS_CONCEPTS[forceName]) == null ? void 0 : _a.depth) === depth) {
    const c2 = PASS_CONCEPTS[forceName];
    const skill2 = execSkill(c2.exec || {}, offRoster, offPersonnel);
    return { name: forceName, mod: ((_b = c2.vs[family]) != null ? _b : 0) * clamp2(1 + (skill2 - 50) / 100, 0.6, 1.4) };
  }
  let pool = Object.entries(PASS_CONCEPTS).filter(([nm, c2]) => c2.depth === depth && !c2.screen && !c2.fade && !c2.resolver && (!c2.minWR || wrN >= c2.minWR) && (!allowed || allowed.includes(nm)));
  if (!pool.length) pool = Object.entries(PASS_CONCEPTS).filter(([, c2]) => c2.depth === depth && !c2.screen && !c2.fade && !c2.resolver && (!c2.minWR || wrN >= c2.minWR));
  if (!pool.length) return { name: null, mod: 0 };
  const [name, c] = weightedConceptPick(pool, weights);
  const base = (_c = c.vs[family]) != null ? _c : 0;
  const skill = execSkill(c.exec || {}, offRoster, offPersonnel);
  return { name, mod: base * clamp2(1 + (skill - 50) / 100, 0.6, 1.4) };
}
function pickRunConcept(playType, offPersonnel, offRoster, defEff, weights = null, forceName = null, allowed = null) {
  var _a, _b, _c;
  let pool = forceName && ((_a = RUN_CONCEPTS[forceName]) == null ? void 0 : _a.type) === playType ? [[forceName, RUN_CONCEPTS[forceName]]] : Object.entries(RUN_CONCEPTS).filter(([nm, c2]) => c2.type === playType && !c2.resolver && (!allowed || allowed.includes(nm)));
  if (!pool.length) pool = Object.entries(RUN_CONCEPTS).filter(([, c2]) => c2.type === playType && !c2.resolver);
  if (!pool.length) return { name: null, mod: 0 };
  const [name, c] = weightedConceptPick(pool, forceName ? null : weights);
  const boxState = (defEff.runCommit || 0) > 5 || defEff.covShell === "single" ? "loaded" : (defEff.runCommit || 0) < -5 || defEff.covShell === "two" ? "light" : null;
  let base = boxState ? (_c = (_b = c.vsBox) == null ? void 0 : _b[boxState]) != null ? _c : 0 : 0;
  if (c.punishes === "crash" && defEff.edgePlay === "crash") base += 0.03;
  const skill = execSkill(c.exec || {}, offRoster, offPersonnel);
  return { name, mod: base * clamp2(1 + (skill - 50) / 100, 0.6, 1.4) };
}
function conceptGroups() {
  const g = { quick: [], dropback: [], shots: [], inside: [], perimeter: [], gadgets: [] };
  for (const [nm, c] of Object.entries(PASS_CONCEPTS)) {
    if (c.resolver) g.gadgets.push(nm);
    else (c.depth === "short" ? g.quick : c.depth === "medium" ? g.dropback : g.shots).push(nm);
  }
  for (const [nm, c] of Object.entries(RUN_CONCEPTS)) {
    if (c.resolver) g.gadgets.push(nm);
    else (c.type === "run_inside" ? g.inside : g.perimeter).push(nm);
  }
  return g;
}
// M4 (Aug 2026) — the BIG-MOMENT spec, owner-ratified: 4th downs, red-zone
// trips, inside two minutes of either half, and every snap of a one-score 4th
// quarter (or overtime — sudden football is all big moments). 3rd downs came
// OFF the list in the redesign: the old cadence stopped the game too often to
// feel like "jumping in for the moments". Turnovers and scores are watch
// moments only — they end drives, so no pre-snap ask ever fires on them.
function isKeyDownSituation(sit) {
  if (sit.down >= 4) return true;
  if (sit.fieldPos >= 80) return true;
  if (sit.clock <= 120) return true;
  if (sit.half === 3) return true;
  if (sit.half === 2 && sit.clock <= 900 && sit.score && Math.abs((sit.score.off || 0) - (sit.score.def || 0)) <= 8) return true;
  return false;
}
// F3 (openers): the situations the script always yields to.
var OPENERS_YIELDS = /* @__PURE__ */ new Set(["goal_line", "backed_up", "two_min_trail", "four_min_lead", "red_zone"]);
function offSitWithOpeners(resolved, offPlan, gameState) {
  var _a;
  const cell = (_a = offPlan == null ? void 0 : offPlan.situations) == null ? void 0 : _a.openers;
  if (!cell || !Object.keys(cell).length) return resolved;
  if (((gameState == null ? void 0 : gameState._offDriveNum) || 99) > 2) return resolved;
  return OPENERS_YIELDS.has(resolved) ? resolved : "openers";
}
// F1 (defensive live calling): apply a coach's per-snap defensive call over the
// effective plan. Only the fields the call names change; blitzPct re-derives
// from the called stop the same way getEffectivePlan derives it.
function applyDefCall(defEff, o, defSchool) {
  var _a, _b, _c;
  if (!o) return;
  if (o.front) defEff.defFront = o.front;
  if (o.covShell) defEff.covShell = o.covShell;
  if (o.covStyle) defEff.covStyle = o.covStyle;
  if (o.edgePlay) defEff.edgePlay = o.edgePlay;
  if (o.pressureIdentity) defEff.pressureIdentity = o.pressureIdentity === "auto" ? null : o.pressureIdentity;
  if (o.robberCall) defEff.robberCall = o.robberCall;
  if (o.zoneStyle) defEff.zoneStyle = o.zoneStyle;
  if (o.aggression) {
    defEff.defAggression = o.aggression;
    defEff.blitzPct = clamp2(((_a = C.AGGRESSION.rate[o.aggression]) != null ? _a : 20) + ((_c = (_b = defSchool == null ? void 0 : defSchool.weeklyPlan) == null ? void 0 : _b.blitzShift) != null ? _c : 0), 0, 75);
  }
  if (o.runCommit != null) defEff.runCommit = clamp2(o.runCommit, -25, 25);
  // PASS 3: family / rotation / rush-3 ingredients. Guarded here so the
  // kill-switch strips them at the ONE entry point every path (sheet sample,
  // F1 live call, AI call) already flows through.
  if (!globalThis.__noCovFamilies) {
    if (o.covFamily && COV_FAMILY_IMPLIES[o.covFamily]) {
      defEff.covFamily = o.covFamily;
      defEff.covShell = COV_FAMILY_IMPLIES[o.covFamily].shell;
      defEff.covStyle = COV_FAMILY_IMPLIES[o.covFamily].style;
      // Prevent bundles rush-3 (owner call, 2026-08-08): one ingredient, the
      // whole posture — 3-man rush, 8-deep umbrella.
      if (o.covFamily === "Prevent") defEff.rush3 = true;
    }
    if (o.rotation) defEff.rotation = o.rotation;
    if (o.rush3) defEff.rush3 = true;
  }
  // PASS 4: pressure-flavor ingredients (pressLook: mug/amoeba · dogGame:
  // green/cross). Same one-entry-point law; kill-switch strips them here.
  if (!globalThis.__noPressFlavors) {
    if (o.pressLook === "mug" || o.pressLook === "amoeba") defEff.pressLook = o.pressLook;
    if (o.dogGame === "green" || o.dogGame === "cross") defEff.dogGame = o.dogGame;
  }
}
// PASS 2 (Aug 2026): the ONE sync point between defEff and the *Eff keys the
// sim reads. Any overlay applied AFTER defPlanEff is built (formChecks, a
// named call) must run through here — the old hand-copied seven lines had
// already drifted (robberCall/zoneStyle/pressLevel/bracketWho set by a check
// updated defEff but never reached defPlanEff, so the sim ignored them).
function syncDefEff(defPlanEff, defEff) {
  defPlanEff.blitzPct = defEff.blitzPct;
  defPlanEff.coverageScheme = defEff.coverageScheme;
  defPlanEff.defAggrEff = defEff.defAggression;
  defPlanEff.pressIdentityEff = defEff.pressureIdentity;
  defPlanEff.runCommitEff = defEff.runCommit;
  defPlanEff.optionKeyEff = defEff.optionKey;
  defPlanEff.edgePlayEff = defEff.edgePlay;
  defPlanEff.covShellEff = defEff.covShell;
  defPlanEff.covStyleEff = defEff.covStyle;
  defPlanEff.pressLevelEff = defEff.pressLevel;
  defPlanEff.robberCallEff = defEff.robberCall;
  defPlanEff.zoneStyleEff = defEff.zoneStyle;
  defPlanEff.bracketWhoEff = defEff.bracketWho;
  // PASS 3: the family ingredients ride the same one-sync-point law.
  defPlanEff.covFamilyEff = defEff.covFamily;
  defPlanEff.rotationEff = defEff.rotation;
  defPlanEff.rush3Eff = defEff.rush3;
  // PASS 4: the pressure-flavor ingredients too.
  defPlanEff.pressLookEff = defEff.pressLook;
  defPlanEff.dogGameEff = defEff.dogGame;
}
// PASS 2 (Aug 2026): sample a named call from the matchup call sheet.
// gp.defCalls is the library (name → an applyDefCall payload); gp.callSheet
// is situation bucket × personnel class → [[name, weight], …], with an "any"
// personnel column as the row's fallback. Entries naming a call the library
// doesn't hold, or weighted 0, are dead. Returns { name, call } or null —
// and null means the game plays exactly as it does today.
function pickDefCall(gp, sitKey, persClass) {
  if (globalThis.__noDefCalls) return null;
  const lib = gp == null ? void 0 : gp.defCalls;
  const row = gp == null ? void 0 : (gp.callSheet ? gp.callSheet[sitKey] : null);
  if (!lib || !row) return null;
  const cell = row[persClass] || row.any;
  if (!Array.isArray(cell) || !cell.length) return null;
  const live = cell.filter((e) => Array.isArray(e) && lib[e[0]] && (e[1] || 0) > 0);
  if (!live.length) return null;
  let r = Math.random() * live.reduce((s, e) => s + e[1], 0);
  let name = live[live.length - 1][0];
  for (const e of live) {
    if ((r -= e[1]) <= 0) {
      name = e[0];
      break;
    }
  }
  const c = lib[name];
  if (!c) return null;
  return { name, call: {
    front: c.front && c.front !== "auto" ? c.front : null,
    covShell: c.covShell || null,
    covStyle: c.covStyle || null,
    edgePlay: c.edgePlay || null,
    pressureIdentity: c.pressureIdentity || null,
    robberCall: c.robberCall || null,
    zoneStyle: c.zoneStyle || null,
    aggression: c.aggression || null,
    runCommit: c.runCommit != null ? c.runCommit : null,
    // PASS 3 ingredients (sparse — absent on every pre-Pass-3 call).
    covFamily: c.covFamily || null,
    rotation: c.rotation || null,
    rush3: c.rush3 ? true : null,
    // PASS 4 ingredients (sparse — absent on every pre-Pass-4 call).
    pressLook: c.pressLook || null,
    dogGame: c.dogGame || null
  } };
}
// F2 (check-with-me): the opponent-personnel class a defensive check keys on.
function formationCheckClass(fid) {
  if (fid === "Empty") return "empty";
  if (fid === "Wildcat") return "wildcat";
  if (fid === "Spread" || fid === "Air Raid" || fid === "Trips/Bunch" || fid === "Pistol/RPO") return "spread";
  if (fid === "Power-I" || fid === "Wishbone" || fid === "Flexbone" || fid === "Jumbo") return "heavy";
  return null;
}
function coverageFamily(shell, style, sAwr) {
  const sh = shell === "balanced" ? Math.random() < 0.55 ? "single" : "two" : shell;
  const st = style === "balanced" ? Math.random() < 0.5 ? "man" : "zone" : style;
  if (sh === "single") return st === "man" ? "Cover 1" : "Cover 3";
  return st === "man" ? "Cover 2-Man" : sAwr >= 55 ? "Cover 4" : "Cover 2";
}
// ── PASS 3 (Aug 2026): coverage families as CALL INGREDIENTS ────────────────
// A named call may pin the family outright (covFamily), add a single-high
// run-support rotation (rotation: sky/cloud/buzz), or rush three and drop
// eight (rush3). None of these is a standing dial — they exist only inside
// defCalls payloads. Kill-switch: globalThis.__noCovFamilies (calls fall back
// to their plain dials, byte-identical Pass-2 behavior).
// FAMILY_SHELL: every family's structural shell — feeds _conceptCtx.shell so
// the mechanics layer (Fix E bail, leverage help) agrees with the name layer.
var FAMILY_SHELL = {
  "Cover 1": "single",
  "Cover 3": "single",
  "Cover 0": "single",
  "C3 Fire Zone": "single",
  "Cover 2": "two",
  "Cover 4": "two",
  "Cover 2-Man": "two",
  "Cover 6": "two",
  "Tampa 2": "two",
  "Prevent": "two"
};
// A pinned family forces its implied dials so every shell/style-keyed mechanic
// downstream (PA bite, robber, deep help, scramble mults) agrees with the call.
var COV_FAMILY_IMPLIES = {
  "Cover 6": { shell: "two", style: "zone" },
  "Tampa 2": { shell: "two", style: "zone" },
  "Cover 2-Man": { shell: "two", style: "man" },
  "Prevent": { shell: "two", style: "zone" }
};
function resolveJetSweep(offPersonnel, defPersonnel, offRoster, defRoster, offUnit, defUnit, gameplan, defPlan, frontId, formationId, qb, jetMan, rbShares = null, rbPool = null) {
  var _a, _b, _c;
  const dfind = (id) => defRoster.find((p) => p.id === id);
  const edge2 = dfind((defPersonnel.OLB || [])[0]) || dfind((defPersonnel.S || [])[0]) || dfind((defPersonnel.LB || [])[0]) || null;
  // identity stage 3: Edge Setter — the contain/edgeTec execution vs jets
  const edgeTec = (((_a = edge2 == null ? void 0 : edge2.attributes.TEC) != null ? _a : 50) - 50) * 12e-4 + 15e-4 * traitLv(edge2, "edgeSetter");
  const edgeAdj = (defPlan == null ? void 0 : defPlan.edgePlayEff) === "contain" ? clamp2(0.07 + edgeTec + 0.03, 0.03, 0.16) : (defPlan == null ? void 0 : defPlan.edgePlayEff) === "crash" ? -0.08 : 0;
  const sniffP = clamp2(0.2 + (((_b = edge2 == null ? void 0 : edge2.attributes.AWR) != null ? _b : 50) - 50) * 4e-3 + (((defPlan == null ? void 0 : defPlan.runCommitEff) || 0) > 0 ? 0.06 : 0) + edgeAdj + Math.min(0.15, ((defPlan == null ? void 0 : defPlan._seenJets) || 0) * 0.03), 0.08, 0.6);
  const sniffed = Math.random() < sniffP;
  const meshCraft = clamp2((((_c = jetMan == null ? void 0 : jetMan.attributes.TEC) != null ? _c : 50) - 50) * 12e-4, -0.04, 0.04);
  return resolveRunPlay(
    "run_outside",
    offPersonnel,
    defPersonnel,
    offRoster,
    defRoster,
    offUnit,
    defUnit,
    gameplan,
    frontId,
    formationId,
    qb,
    rbShares,
    rbPool,
    {
      carrier: jetMan,
      laneShift: (sniffed ? -0.18 : 0.1) + meshCraft,
      forcePenetrator: sniffed ? edge2 : null,
      phase: "jet"
    }
  );
}
// ── PASS 5: Reverse — second exchange against the grain (gadget tier) ──────
// The whole defense's pursuit is the read: a crashing / run-committed front
// runs itself out of the play (big laneShift); a contain edge who stays home
// blows it up behind the line. The double exchange carries a real fumble risk
// the jet sweep doesn't. Gadget Ace is the carrier's craft (one mechanism:
// gadget exchange/sell).
function resolveReverse(offPersonnel, defPersonnel, offRoster, defRoster, offUnit, defUnit, gameplan, defPlan, frontId, formationId, qb, revMan, rbShares = null, rbPool = null) {
  var _a, _b, _c, _d, _e;
  const dfind = (id) => defRoster.find((p) => p.id === id);
  const olbs = defPersonnel.OLB || [], des = defPersonnel.DE || [];
  const edgeB = dfind(olbs[olbs.length - 1]) || dfind(des[des.length - 1]) || dfind((defPersonnel.LB || [])[0]) || null;
  const edgeTec = (((_a = edgeB == null ? void 0 : edgeB.attributes.TEC) != null ? _a : 50) - 50) * 12e-4 + 15e-4 * traitLv(edgeB, "edgeSetter");
  const contain = (defPlan == null ? void 0 : defPlan.edgePlayEff) === "contain";
  const crash = (defPlan == null ? void 0 : defPlan.edgePlayEff) === "crash";
  const overPursuit = ((defPlan == null ? void 0 : defPlan.runCommitEff) || 0) > 0 || crash;
  const sniffP = clamp2(0.24 + (((_b = edgeB == null ? void 0 : edgeB.attributes.AWR) != null ? _b : 50) - 50) * 5e-3 + (contain ? 0.14 : 0) + (crash ? -0.1 : 0) + (((defPlan == null ? void 0 : defPlan.runCommitEff) || 0) > 0 ? -0.05 : 0) + edgeTec + Math.min(0.18, ((defPlan == null ? void 0 : defPlan._seenRev) || 0) * 0.06), 0.08, 0.65);
  const sniffed = Math.random() < sniffP;
  const craft = clamp2((((_c = revMan == null ? void 0 : revMan.attributes.TEC) != null ? _c : 50) - 50) * 1e-3, -0.04, 0.04) + 0.01 * traitLv(revMan, "gadgetAce");
  const fumbleP = clamp2(0.02 - (((_d = revMan == null ? void 0 : revMan.attributes.SEC) != null ? _d : 50) - 50) * 2e-4 - 3e-3 * traitLv(revMan, "gadgetAce"), 6e-3, 0.035);
  if (Math.random() < fumbleP) {
    const result = {
      type: "run_outside", yards: -Math.abs(Math.round(randNorm(4, 2))), complete: false,
      turnover: Math.random() < 0.5, turnoverType: null, sack: false,
      throwerId: null, targetId: null, receiverId: null,
      tacklerId: (_e = edgeB == null ? void 0 : edgeB.id) != null ? _e : null, assistId: null, tflId: null,
      sackerId: null, sackerId2: null, pbuId: null, intPickerId: null,
      ffId: edgeB ? edgeB.id : null, rusherId: revMan ? revMan.id : null,
      gadget: "reverse", exchangeFumbled: true
    };
    if (result.turnover) result.turnoverType = "fumble";
    return result;
  }
  // A sniffed reverse is a disaster, not a bad run — the edge who stayed home
  // meets the second exchange in the backfield with the play still developing.
  if (sniffed && Math.random() < 0.6) {
    const result = {
      type: "run_outside", yards: -Math.max(2, Math.round(randNorm(5, 2))), complete: false,
      turnover: false, turnoverType: null, sack: false,
      throwerId: null, targetId: null, receiverId: null,
      tacklerId: edgeB ? edgeB.id : null, assistId: null, tflId: edgeB ? edgeB.id : null,
      sackerId: null, sackerId2: null, pbuId: null, intPickerId: null,
      ffId: null, rusherId: revMan ? revMan.id : null,
      gadget: "reverse", revSniffed: true, revEdge: (defPlan == null ? void 0 : defPlan.edgePlayEff) || "balanced"
    };
    return result;
  }
  const out = resolveRunPlay(
    "run_outside", offPersonnel, defPersonnel, offRoster, defRoster, offUnit, defUnit,
    gameplan, frontId, formationId, qb, rbShares, rbPool,
    { carrier: revMan, laneShift: (sniffed ? -0.32 : overPursuit ? 0.35 : 0.14) + craft, forcePenetrator: sniffed ? edgeB : null, phase: "reverse" }
  );
  out.gadget = "reverse";
  out.revSniffed = sniffed;
  out.revEdge = (defPlan == null ? void 0 : defPlan.edgePlayEff) || "balanced";
  return out;
}
function repWin(offVal, defVal, contextBoost = 0) {
  return logistic((offVal - defVal) / C.REP_SCALE + contextBoost);
}
function blockRep(blocker, rusher, speedRush, contextBoost = 0, powerPass = false, isPass = false, mobilityBonus = 0) {
  var _a, _b, _c;
  // ── Identity stage 3 (play traits, tiny per-level, one mechanism each) ──
  // Blocker side: Mirror rides the speed rush, Anchor stones the bull (pass);
  // People Mover is the OL drive block, Lead Blocker the moving back/TE (run).
  const blkTrait = isPass ? speedRush ? traitMult(blocker, "mirror", 0.01) : traitMult(blocker, "anchor", 0.01) : blocker.position === "OL" ? traitMult(blocker, "peopleMover", 0.01) : traitMult(blocker, "leadBlocker", 0.012);
  const blkVal = ((isPass ? blocker.attributes.STR * 0.3 + blocker.attributes.TEC * 0.28 + blocker.attributes.PWR * 0.22 + blocker.attributes.AWR * 0.2 + C.PASSPRO_CENTER_ADJ + (((_a = blocker.attributes.AGI) != null ? _a : C.OL_MOBILITY_PIVOT) - C.OL_MOBILITY_PIVOT) * C.OL_PASS_MIRROR_SCALE * (speedRush ? 1 : 0.4) : blocker.attributes.PWR * 0.3 + blocker.attributes.AWR * 0.28 + blocker.attributes.STR * 0.22 + blocker.attributes.TEC * 0.2 + C.RUNBLOCK_CENTER_ADJ) + (blocker._olContBonus || 0) + mobilityBonus) * blkTrait;
  // Rusher side: Bend is the speed-path corner, Power Move the power path,
  // Motor the generic shed persistence.
  const speedPath = (rusher.attributes.SPD * 0.3 + rusher.attributes.AGI * 0.3 + rusher.attributes.TEC * 0.18 + rusher.attributes.STR * 0.14 + rusher.attributes.JMP * 0.08 + C.RUSH_SPEED_CENTER_ADJ) * traitMult(rusher, "bend", 0.012);
  const powerPath = (rusher.attributes.PWR * 0.34 + rusher.attributes.STR * 0.28 + rusher.attributes.TEC * 0.2 + rusher.attributes.SPD * 0.12 + rusher.attributes.JMP * 0.06 + C.RUSH_POWER_CENTER_ADJ) * traitMult(rusher, "powerMove", 0.012);
  // (run-defense shed: Lane Drifter loses his gap — the flaw's one mechanism)
  const shedVal = (rusher.attributes.STR * 0.34 + rusher.attributes.AWR * 0.28 + rusher.attributes.PWR * 0.22 + rusher.attributes.TEC * 0.16 + C.SHED_CENTER_ADJ) * flawMult(rusher, "laneDrifter", -0.012);
  const rushVal = !isPass ? shedVal : speedRush ? Math.max(speedPath, powerPath) - C.RUSH_S2P_CENTER_ADJ : powerPath;
  const dampedRushVal = powerPass ? rushVal * C.POWER_PASS_DAMP : rushVal;
  const sizeMute = speedRush ? C.BLOCK_SIZE_EDGE_MUTE : 1;
  const sizeTerm = (((_b = blocker.weight) != null ? _b : 300) - ((_c = rusher.weight) != null ? _c : 300)) * C.BLOCK_SIZE_SCALE * sizeMute;
  const execTerm = isPass ? (blkVal - C.TRENCH_EXEC_CENTER) * C.TRENCH_EXEC_SCALE : 0;
  return Math.random() < repWin(blkVal + sizeTerm + Math.min(0, execTerm), dampedRushVal, contextBoost);
}
function resolvePassRush(rushers, blockers, blitzPct, defContextBoost, blitzDesign = 50, dnaPressureGrade = 0, protectMult = 1, paBite = 0, passKey = 0, scheme = null) {
  var _a;
  const result = { sacked: false, hurried: false, sackerIds: [], pressureIds: [] };
  if (!rushers.length) return result;
  const availBlockers = [...blockers];
  const reps = [];
  for (const { player: rusher, role, blitzer, late } of rushers) {
    const edgeAlign = /^(DE|OLB)/.test(role) || role === "LB-Edge";
    const speedRush = edgeAlign && role !== "DE-Power";
    const powerPass = role === "DE-Power";
    if (blitzer) {
      const freeBlockers = availBlockers.length;
      let pickupProb = freeBlockers > 0 ? Math.min(0.35 + (freeBlockers - 1) * 0.12, 0.68) : 0;
      // PASS 4: a fired MUG stresses the protection at its core — the A-gap
      // dogs (interior backers) are harder to pick up; a LATE green dog was
      // never in the protection's count at all.
      let mugDog = false;
      if (!globalThis.__noPressFlavors) {
        if ((scheme == null ? void 0 : scheme.mug) && /^(LB|OLB)/.test(role || "")) {
          mugDog = true;
          pickupProb = Math.max(0, pickupProb - C.PRESS_FLAVOR.mugPickupDock);
        }
        if (late) pickupProb *= C.PRESS_FLAVOR.dogLatePickup * traitMult(rusher, "greenDogT", -0.04);
      }
      // Identity stage 3: Pass-Pro Back — the would-be picker (the tail of
      // the free-blocker list, which is where the back sits) sees the extra
      // man a beat sooner. Tiny, one mechanism (pickupProb).
      const picker = availBlockers[availBlockers.length - 1];
      if (picker) pickupProb = Math.min(0.8, pickupProb * traitMult(picker, "passProBack", 0.03));
      const pickedUp = Math.random() < pickupProb;
      const blocker2 = pickedUp ? availBlockers.splice(availBlockers.length - 1, 1)[0] : null;
      reps.push({ rusher, blocker: blocker2, isEdge: edgeAlign, speedRush, powerPass, blitzer: !pickedUp, mugDog });
      continue;
    }
    const blockerIdx = edgeAlign ? availBlockers.length > 0 ? 0 : -1 : Math.floor(availBlockers.length / 2);
    const blocker = availBlockers.splice(
      clamp2(blockerIdx, 0, availBlockers.length - 1),
      1
    )[0] || null;
    reps.push({ rusher, blocker, isEdge: edgeAlign, speedRush, powerPass, blitzer: false });
  }
  // ── PASS 4 (cross-dog): the two-backer pick game aimed at the center. ─────
  // CREEPER-shaped odds (design vs the center's AWR, protection redirect —
  // BOB's man rules are what the pick attacks, Quick beats it with the ball
  // out). Success springs the better crosser FREE (his blocker is picked);
  // failure absorbs BOTH crossers in the wash (blocker-favoring rep shift).
  // Trait hook (Hook Rule): "Games Runner" (LB) claims this pick-timing term
  // at Pass 4.5; the offense counter is Line General's stunt-align read.
  if (scheme && scheme.game === "cross" && Array.isArray(scheme.crossIds) && !globalThis.__noPressFlavors) {
    const crossReps = reps.filter((rp) => rp.blitzer && scheme.crossIds.includes(rp.rusher.id));
    if (crossReps.length >= 2) {
      const pf = C.PRESS_FLAVOR;
      const protId2 = scheme.protId || "halfSlide";
      const redirect2 = protId2 === "bob" ? pf.crossBob : protId2 === "quick" ? pf.crossQuick : protId2 === "maxProtect" ? pf.crossMaxProt : 1;
      const olAwr2 = scheme.olAwr != null ? scheme.olAwr : 50;
      // Identity stage 3 (Pass 4's Hook Rule debt): "Games Runner" — the
      // better-schooled crosser times the pick; Line General's stunt-align
      // read is the offense counter (folded into scheme.olAwr upstream).
      const grTrait = crossReps.reduce((m, rp) => Math.max(m, traitLv(rp.rusher, "gamesRunner")), 0);
      const pickP = clamp2((pf.crossBase + (blitzDesign - 50) * pf.crossDesign - (olAwr2 - 50) * pf.crossAwr) * redirect2 * (1 + 0.03 * grTrait), 0, pf.crossCap);
      if (Math.random() < pickP) {
        const grade = (p) => (p.attributes.SPD + p.attributes.PWR) / 2;
        const best = crossReps.reduce((a, b) => grade(a.rusher) >= grade(b.rusher) ? a : b);
        if (best.blocker) best.blocker = null;
        result.crossFree = true;
      } else {
        for (const rp of crossReps) rp.crossDock = pf.crossAbsorb;
      }
    }
  }
  if (scheme && !reps.some((rp) => rp.blitzer) && !globalThis.__noAlign) {
    const olAwr2 = scheme.olAwr != null ? scheme.olAwr : 50;
    let alignP = C.ALIGN_BASE + (blitzDesign - 50) * C.ALIGN_DESIGN - (olAwr2 - 50) * C.ALIGN_AWR;
    alignP = clamp2(alignP, 0, C.ALIGN_CAP);
    const blockedReps = reps.filter((rp) => rp.blocker);
    if (alignP > 0 && blockedReps.length > 1 && Math.random() < alignP) {
      const rushGrade = (a) => a.STR * 0.34 + a.PWR * 0.28 + a.SPD * 0.2 + a.TEC * 0.18;
      const blockGrade = (a) => a.STR * 0.34 + a.TEC * 0.3 + a.AWR * 0.2 + a.PWR * 0.16;
      let bestRep = blockedReps[0];
      for (const rp of blockedReps) if (rushGrade(rp.rusher.attributes) > rushGrade(bestRep.rusher.attributes)) bestRep = rp;
      let weakRep = blockedReps[0];
      for (const rp of blockedReps) if (blockGrade(rp.blocker.attributes) < blockGrade(weakRep.blocker.attributes)) weakRep = rp;
      // Isolate the standout on the weak blocker and give him the two-way-go
      // edge of a schemed 1-on-1 (a rush-context boost on that one rep). The
      // blockers trade laterally (the other rep keeps a live blocker, so this is
      // not a free extra rusher); the NET pressure comes from the standout's
      // isolation edge, which is exactly what "align to win" buys.
      if (bestRep !== weakRep) {
        const tmp = bestRep.blocker;
        bestRep.blocker = weakRep.blocker;
        weakRep.blocker = tmp;
        bestRep.alignEdge = C.ALIGN_EDGE;
      }
    }
  }
  const schemeFreeIds = /* @__PURE__ */ new Set();
  if (scheme && !reps.some((rp) => rp.blitzer)) {
    const olAwr = scheme.olAwr != null ? scheme.olAwr : 50;
    const protId = scheme.protId || "halfSlide";
    const redirect = protId === "maxProtect" ? C.CREEPER_PROT_MAX : protId === "bob" ? C.CREEPER_PROT_BOB : protId === "quick" ? C.CREEPER_PROT_QUICK : 1;
    let freeP = C.CREEPER_BASE + (blitzDesign - 50) * C.CREEPER_DESIGN;
    freeP -= (olAwr - 50) * C.CREEPER_AWR;
    freeP *= redirect;
    freeP = clamp2(freeP, 0, C.CREEPER_CAP);
    if (freeP > 0 && Math.random() < freeP) {
      const blocked = reps.filter((rp) => rp.blocker);
      if (blocked.length > 0) {
        const target = blocked[Math.floor(Math.random() * blocked.length)];
        target.blocker = null;
        target.schemeFree = true;
        schemeFreeIds.add(target.rusher.id);
      }
    }
  }
  const penetrators = [];
  const freeBlitzerIds = /* @__PURE__ */ new Set();
  const speedRushIds = /* @__PURE__ */ new Set();
  let blockerHolds = 0;
  for (const rp of reps) {
    const { rusher, blocker, speedRush, powerPass, blitzer } = rp;
    if (!blocker) {
      penetrators.push(rusher);
      if (speedRush) speedRushIds.add(rusher.id);
      if (blitzer) freeBlitzerIds.add(rusher.id);
      continue;
    }
    const held = blockRep(blocker, rusher, speedRush, -defContextBoost + (rp.alignEdge || 0) + (rp.crossDock || 0), powerPass, true);
    if (held) blockerHolds++;
    else {
      penetrators.push(rusher);
      if (speedRush) speedRushIds.add(rusher.id);
    }
  }
  const chippedIds = /* @__PURE__ */ new Set();
  if (scheme && scheme.chip && penetrators.length > 0 && !globalThis.__noChip) {
    const chipper = scheme.chip;
    const edgePens = penetrators.filter((p) => speedRushIds.has(p.id));
    // P1-4: a CALLED chip hunts the best penetrator (their premier rusher),
    // not just the first edge who shows — and lands more reliably (the back
    // is looking for the work instead of bumping on his way past).
    const _pool = edgePens.length > 0 ? edgePens : penetrators;
    const target = scheme.chipCalled ? _pool.slice().sort((a2, b2) => (b2.compositeRating || 0) - (a2.compositeRating || 0))[0] : _pool[0];
    if (target) {
      // Identity stage 3: Chipper — the §16.2 bump machinery is HIS play.
      const bump = clamp2((C.CHIP_BASE + ((((_a = chipper.STR) != null ? _a : 50) + (chipper.AWR != null ? chipper.AWR : 50)) / 2 - 50) * C.CHIP_SKILL - (target.attributes.PWR - 50) * C.CHIP_VS_PWR) * (scheme.chipCalled ? 1.35 : 1) * (1 + 0.03 * (scheme.chipTraitLv || 0)), 0, C.CHIP_CAP);
      if (Math.random() < bump) {
        const idx = penetrators.indexOf(target);
        if (idx >= 0) penetrators.splice(idx, 1);
        chippedIds.add(target.id);
        freeBlitzerIds.delete(target.id);
        schemeFreeIds.delete(target.id);
      }
    }
  }
  const pocketQ = reps.length > 0 ? blockerHolds / reps.length : 1;
  const numPenetrators = penetrators.length;
  if (numPenetrators > 0) {
    const collapseFrac = numPenetrators / reps.length;
    let pocket;
    if (globalThis.__rushFrozen) {
      const _bb = freeBlitzerIds.size > 0 ? 1 + 0.15 * (0.5 + blitzDesign / 100) : 1;
      const _dp = 1 + (dnaPressureGrade || 0) * 6e-3;
      const _sc = clamp2(collapseFrac * collapseFrac * C.PASS_RUSH_PRESSURE * _bb * _dp * protectMult * (1 + paBite * 0.12), 0, 0.95);
      const _hc = clamp2((collapseFrac * 1.4 + (freeBlitzerIds.size > 0 ? 0.2 : 0)) * (1 - paBite * 0.28) * (1 + passKey * 0.012), 0, 0.85);
      const sk = Math.random() < _sc;
      pocket = { sacked: sk, hurried: !sk && Math.random() < _hc };
    } else {
      pocket = resolvePocket({
        reps: reps.map((rp) => ({
          pen: penetrators.includes(rp.rusher),
          blitzer: rp.blitzer || rp.schemeFree === true,
          speed: rp.speedRush,
          power: rp.powerPass,
          pos: rp.rusher.position,
          r: rp.rusher.attributes,
          b: rp.blocker ? rp.blocker.attributes : null,
          // identity stage 3: Motor — pressure persistence; his shed keeps
          // coming (rushgeo trims the shed clock by this level)
          motor: traitLv(rp.rusher, "motor"),
          // PASS 4: a free MUG dog started the snap standing IN the A-gap —
          // no distance to make up, the snap count timed (shed discount in
          // the pocket geometry; SHED_FREE's hot-throw logic still applies).
          mug: rp.mugDog === true
        })),
        protectMult,
        blitzDesign,
        dnaPressure: dnaPressureGrade,
        paBite,
        passKey
      });
    }
    if (globalThis.__rushAB) {
      const _bb = freeBlitzerIds.size > 0 ? 1 + 0.15 * (0.5 + blitzDesign / 100) : 1;
      const _dp = 1 + (dnaPressureGrade || 0) * 6e-3;
      const _sc = clamp2(collapseFrac * collapseFrac * 0.45 * _bb * _dp * protectMult * (1 + paBite * 0.12), 0, 0.95);
      const _hc = clamp2((collapseFrac * 1.4 + (freeBlitzerIds.size > 0 ? 0.2 : 0)) * (1 - paBite * 0.28) * (1 + passKey * 0.012), 0, 0.85);
      globalThis.__rushAB.push({
        gs: pocket.sacked ? 1 : 0,
        gh: pocket.hurried ? 1 : 0,
        rs: _sc,
        rh: (1 - _sc) * _hc,
        pen: numPenetrators,
        free: freeBlitzerIds.size
      });
    }
    if (pocket.sacked) {
      result.sacked = true;
      const freeBlitzers = penetrators.filter((p) => freeBlitzerIds.has(p.id) || schemeFreeIds.has(p.id));
      const others = penetrators.filter((p) => !freeBlitzerIds.has(p.id) && !schemeFreeIds.has(p.id)).sort((a, b) => b.attributes.SPD + b.attributes.AGI + (speedRushIds.has(b.id) ? 18 : 0) - (a.attributes.SPD + a.attributes.AGI + (speedRushIds.has(a.id) ? 18 : 0)));
      let ranked;
      if (freeBlitzers.length > 0 && Math.random() < 0.75) {
        ranked = [...freeBlitzers, ...others];
      } else {
        ranked = [...others, ...freeBlitzers];
      }
      if (ranked[0]) {
        result.sackerIds = [ranked[0].id];
        if (ranked[1] && collapseFrac > 0.5) result.sackerIds.push(ranked[1].id);
      }
    } else if (pocket.hurried) {
      result.hurried = true;
      result.pressureIds = penetrators.map((r) => r.id);
    }
  }
  if (globalThis.__rushCap) {
    const AA = (p) => p ? {
      SPD: p.attributes.SPD,
      AGI: p.attributes.AGI,
      STR: p.attributes.STR,
      PWR: p.attributes.PWR,
      TEC: p.attributes.TEC,
      AWR: p.attributes.AWR
    } : null;
    globalThis.__rushCap.push({
      reps: reps.length,
      pen: penetrators.length,
      holds: blockerHolds,
      freeBlitz: freeBlitzerIds.size,
      speed: speedRushIds.size,
      blitzDesign,
      dnaPressureGrade,
      protectMult,
      paBite,
      passKey,
      sacked: result.sacked,
      hurried: result.hurried,
      sackPos: result.sacked && result.sackerIds[0] ? ((_a = reps.find((rp) => rp.rusher.id === result.sackerIds[0])) == null ? void 0 : _a.rusher.position) || null : null,
      r: reps.map((rep) => ({
        pos: rep.rusher.position,
        pen: penetrators.includes(rep.rusher),
        blitzer: rep.blitzer,
        speed: rep.speedRush,
        power: rep.powerPass,
        a: AA(rep.rusher),
        b: AA(rep.blocker)
      }))
    });
  }
  return result;
}
function routeVsCoverage(receiver, defender, passDepth, coverageType, scheme = null) {
  const _tr = globalThis.__sepAB ? {} : null;
  const sep = routeDuel(
    receiver,
    defender,
    passDepth,
    coverageType,
    _passCtx.pressLevel === "press",
    _tr,
    scheme
  );
  if (globalThis.__sepAB) {
    globalThis.__sepAB.push({
      d: passDepth,
      t: coverageType,
      g: sep,
      dist: _tr == null ? void 0 : _tr.dist,
      r: _refSepAB(receiver, defender, passDepth, coverageType),
      ra: __spreadProps(__spreadValues({}, receiver.attributes), { comp: receiver.compositeRating, pos: receiver.position }),
      da: defender ? __spreadProps(__spreadValues({}, defender.attributes), { comp: defender.compositeRating, pos: defender.position }) : null
    });
  }
  return sep;
}
function _refSepAB(receiver, defender, passDepth, coverageType) {
  if (!defender) return coverageType === "zone" ? 0.84 : 1;
  const r = receiver.attributes, d = defender.attributes;
  let recVal;
  if (passDepth === "short") recVal = r.SPD * 0.25 + r.AGI * 0.3 + r.HND * 0.15 + r.TEC * 0.2 + r.AWR * 0.1 + 2.9;
  else if (passDepth === "medium") recVal = r.SPD * 0.4 + r.AGI * 0.25 + r.TEC * 0.2 + r.AWR * 0.15 + 3.7;
  else recVal = r.SPD * 0.6 + r.AGI * 0.2 + r.TEC * 0.1 + r.JMP * 0.1 + 3.8;
  recVal = recVal * 0.85 + receiver.compositeRating * 0.15;
  let defVal;
  if (coverageType === "zone") defVal = d.AWR * 0.4 + d.TEC * 0.26 + d.SPD * 0.2 + d.AGI * 0.14 + 1.3;
  else defVal = d.SPD * 0.4 + d.AGI * 0.31 + d.AWR * 0.14 + d.TEC * 0.15 + 2.6;
  defVal = defVal * 0.85 + defender.compositeRating * 0.15;
  if (coverageType === "offman") defVal += passDepth === "short" ? -6 : passDepth === "deep" ? 4 : 0;
  if (coverageType === "press") {
    const hot = _passCtx.pressLevel === "press" ? 1.08 : 1;
    const jam = d.STR * 0.4 + d.TEC * 0.35 + d.AGI * 0.25 + 1;
    const release = r.AGI * 0.4 + r.TEC * 0.35 + r.STR * 0.25;
    const jamGap = jam - release;
    if (passDepth === "short") defVal += (4 + jamGap * 0.22) * hot;
    else if (passDepth === "medium") defVal += jamGap * 0.16 * hot;
    else defVal += -3 + jamGap * 0.12;
  }
  if (coverageType === "zone" && passDepth === "deep") defVal += 4;
  const w = passDepth === "short" ? 1 : passDepth === "medium" ? 0.7 : 0.35;
  return clamp2(0.5 + (recVal - defVal) / 80 + (r.TEC - d.TEC) * w * 2e-3, 0, 1);
}
function motionMisreadProb(dbAWR, qbAWR) {
  return clamp2(0.14 + (dbAWR - 50) * 4e-3 - (qbAWR - 50) * 3e-3, 0.03, 0.45);
}
function qbRead(targets, pressureLevel, qb, motionReadEdge = 0) {
  if (!targets.length) return null;
  const eff = (t) => t.separation - (t.bracketed ? 0.04 : 0);
  const sorted = [...targets].sort((a, b) => eff(b) - eff(a));
  const gi = qb.attributes.AWR;
  const spreadFactor = clamp2(0.5 - (gi - 60) / 60, 0.15, 0.5);
  const minSep = 0.28;
  const pool = pressureLevel === 1 ? sorted.slice(0, 2) : sorted;
  const eligible = pool.filter((t) => t.separation > minSep);
  const readCollapsed = eligible.length === 0;
  if (readCollapsed) eligible.push(sorted[0]);
  const giBail = clamp2((qb.attributes.AWR - 55) / 50 + motionReadEdge, 0.1, 0.92);
  const shareValsN = eligible.map((t) => {
    var _a;
    return (_a = t.shareWeight) != null ? _a : 15;
  });
  const shareAvgN = shareValsN.reduce((s, v) => s + v, 0) / shareValsN.length || 1;
  const weights = eligible.map((t, i) => {
    var _a;
    const rankW = Math.exp(-i * spreadFactor);
    let shareMult = ((_a = t.shareWeight) != null ? _a : 15) / shareAvgN;
    const featured = shareMult > 1.25;
    const covered = t.bracketed || t.separation < 0.4;
    if (featured && covered) {
      shareMult = 1 + (shareMult - 1) * (1 - giBail);
    }
    let openMult = 1;
    if (!globalThis.__noReadConflict) {
      const openEdge = clamp2((t.separation - 0.4) * 1.5, -0.3, 0.6);
      const heady = clamp2((gi - 55) / 60, 0, 0.8);
      openMult = 1 + openEdge * heady;
    }
    return rankW * shareMult * openMult;
  });
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  let pick2 = eligible[eligible.length - 1];
  for (let i = 0; i < eligible.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      pick2 = eligible[i];
      break;
    }
  }
  pick2._firstRead = pick2 === sorted[0];
  pick2._readCollapsed = readCollapsed;
  pick2._bestSep = sorted[0].separation;
  return pick2;
}
function catchResolution(sep, qb, defender, passDepth, hurried, receiver, bracketed = false, forced = false, helper = null, passKey = 0, robber = false) {
  var _a, _b, _c, _d;
  let sizeMismatch = 0;
  let contested = false;
  if (receiver && defender && passDepth !== "short") {
    const heightGap = ((_a = receiver.heightInches) != null ? _a : 72) - ((_b = defender.heightInches) != null ? _b : 72);
    const contestWeight = clamp2(1 - sep, 0, 1);
    const jumpGap = (receiver.attributes.JMP - defender.attributes.JMP) * 0.5 + (((_c = receiver.attributes.HND) != null ? _c : 50) - ((_d = defender.attributes.AWR) != null ? _d : 50)) * 0.15 + (receiver.attributes.TEC - defender.attributes.TEC) * 0.1;
    sizeMismatch = (heightGap * C.SIZE_MISMATCH_SCALE + jumpGap * C.JUMP_BALL_SCALE) * contestWeight;
    // Identity stage 3, the contested-ball triangle: Contested Catch (WR)
    // wins the tight ones, High Point (DB) takes the ball down, Body Catcher
    // (WR flaw) is fine in space but loses exactly these.
    sizeMismatch += (0.03 * traitLv(receiver, "contestedCatch") - 0.03 * traitLv(defender, "highPoint") - 0.03 * flawLv(receiver, "bodyCatcher")) * contestWeight;
    contested = contestWeight > 0.65;
  }
  const qbExec = Math.min(
    (qb.attributes.TEC * 0.5 + qb.attributes.AWR * 0.5 - C.COMP_QB_EXEC_CENTER) * C.COMP_QB_EXEC_SCALE + C.COMP_RECENTER,
    C.COMP_RECENTER + C.COMP_QB_EXEC_CAP
  );
  // identity stage 3: Chain Mover — the money-down catch focus (situational
  // by construction: reads the stamped down, does nothing on 1st/2nd)
  const chainEdge = _situDown >= 3 ? 0.02 * traitLv(receiver, "chainMover") : 0;
  const armAttr = passDepth === "short" ? qb.attributes.PWR : passDepth === "deep" ? qb.attributes.STR : (qb.attributes.STR + qb.attributes.PWR) / 2;
  const armFactor = ((armAttr != null ? armAttr : 50) - 50) * C.COMP_ARM_SCALE;
  const dnaAirBoost = passDepth === "deep" ? (_passCtx.dnaAir || 0) * 0.01 : 0;
  const catchProb = clamp2(
    logistic((sep - 0.42) * 5 + qbExec + armFactor + sizeMismatch + chainEdge - (hurried ? C.HURRY_PENALTY * flawMult(qb, "happyFeet", 0.15) : 0) - (bracketed ? 0.12 : 0) - (forced ? 0.45 : 0)) * (1 + dnaAirBoost),
    // forcing into coverage: harder completion; airAttack DNA lifts deep-ball accuracy
    0.04,
    0.97
  );
  if (Math.random() < catchProb) {
    return { complete: true, dropped: false, pbu: false, int: false, pbuId: null, intPickerId: null, contested };
  }
  if (!defender) {
    return { complete: false, dropped: false, pbu: false, int: false, pbuId: null, intPickerId: null, contested };
  }
  const defReadAbility = defender.attributes.AWR * 0.4 + defender.attributes.SPD * 0.22 + defender.attributes.JMP * 0.13 + defender.attributes.HND * 0.13 + defender.attributes.TEC * 0.12 + 2.9;
  const depthMult = passDepth === "deep" ? 1.5 : 1;
  const qbSkill = qb.attributes.AWR * 0.6 + qb.attributes.TEC * 0.4;
  const qbIntMult = clamp2(1 - (qbSkill - 75) * C.INT_QB_SUPPRESS, 0.45, 1.5);
  const forcedIntMult = forced ? 1.6 : 1;
  const passKeyIntMult = 1 + passKey * 0.02;
  const styleIntMult = _passCtx.covStyle === "zone" ? 1.18 : _passCtx.covStyle === "man" ? 0.85 : 1;
  const aggrIntMult = clamp2(1 + (_passCtx.qbAggr - 50) / 100 * 0.5, 0.75, 1.3);
  const dnaBallSecMult = 1 - (_passCtx.dnaBallSec || 0) * 0.01;
  const dnaBallHawkMult = contested ? 1 + (_passCtx.dnaBallHawk || 0) * 0.01 : 1;
  const armIntMult = passDepth === "deep" ? clamp2(1 + (50 - ((qb == null ? void 0 : qb.attributes.STR) != null ? qb.attributes.STR : 50)) * C.INT_ARM_SCALE, 0.9, 1.45) : 1;
  const intProb = clamp2(
    // identity stage 3: Gambler (flaw, two-sided) — the INT half; the
    // burned-deep half lives in the sepgeo route duel
    C.INT_READ_SCALE * (1 - sep) * defReadAbility / 55 * depthMult * qbIntMult * forcedIntMult * passKeyIntMult * styleIntMult * aggrIntMult * dnaBallSecMult * dnaBallHawkMult * armIntMult * flawMult(defender, "gambler", 0.12) * flawMult(qb, "telegraph", 0.08),
    3e-3,
    0.19
  );
  if (Math.random() < intProb) {
    return { complete: false, dropped: false, pbu: false, int: true, pbuId: null, intPickerId: defender.id, contested };
  }
  if (helper) {
    const helperRead = helper.attributes.AWR * 0.4 + helper.attributes.SPD * 0.22 + helper.attributes.JMP * 0.13 + helper.attributes.HND * 0.13 + helper.attributes.TEC * 0.12 + 2.9;
    // Fix D: a ROBBER is a defender who broke on the throw with his eyes, not a
    // trailing bracket — his pick chance is materially higher than a generic
    // deep helper's (bigger factor, higher ceiling).
    const helperFactor = robber ? 1.5 : 0.9;
    const helperCap = robber ? 0.16 : 0.1;
    const helperProb = clamp2(
      C.INT_READ_SCALE * (1 - sep) * helperFactor * helperRead / 55 * depthMult * qbIntMult * forcedIntMult,
      2e-3,
      helperCap
    );
    if (Math.random() < helperProb) {
      return { complete: false, dropped: false, pbu: false, int: true, pbuId: null, intPickerId: helper.id, contested };
    }
  }
  return { complete: false, dropped: false, pbu: true, int: false, pbuId: defender.id, intPickerId: null, contested };
}
function pickTackler(pool, lbBias = 1) {
  const cands = (pool || []).filter(Boolean);
  if (cands.length === 0) return null;
  if (cands.length === 1) return cands[0];
  const weights = cands.map((d) => {
    const a = d.attributes;
    const pursuit = a.SPD * 0.42 + a.AWR * 0.3 + a.AGI * 0.18 + a.TEC * 0.1;
    const n = pursuit / 100;
    let wgt = Math.max(0.08, Math.pow(n, 1.4));
    const pos = d.position || "";
    if (lbBias !== 1 && (pos === "LB" || pos.includes("LB"))) wgt *= lbBias;
    return wgt;
  });
  const sum = weights.reduce((s, w) => s + w, 0);
  let roll = Math.random() * sum;
  for (let i = 0; i < cands.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return cands[i];
  }
  return cands[cands.length - 1];
}
function breaksTackle(carrier, defender, styleOut = null) {
  var _a, _b;
  if (!carrier || !defender) return false;
  const evade = contestGap("tackleEvade", carrier, defender);
  const truck = contestGap("tackleTruck", carrier, defender);
  const gap = Math.max(evade, truck) - C.BROKEN_TKL_CENTER_ADJ;
  const weightOver = Math.max(0, ((_a = carrier.weight) != null ? _a : 210) - 210);
  const chance2 = clamp2(
    C.BROKEN_TKL_BASE + gap * C.BROKEN_TKL_SCALE + weightOver * C.BROKEN_TKL_WEIGHT_SCALE * 0.5 + (((_b = carrier.attributes.AWR) != null ? _b : 50) - 41) * C.BROKEN_TKL_AWR_SCALE,
    0,
    C.BROKEN_TKL_CAP
  // Identity stage 3: Wrap Tackler — broken-tackle resistance, this one roll.
  ) * traitMult(defender, "wrapTackler", -0.03);
  const broke = Math.random() < chance2;
  if (broke && styleOut) styleOut.style = truck > evade ? "truck" : "evade";
  return broke;
}
function buildRunScheme(carrier, isQBCarrier) {
  var _a;
  const def = _conceptCtx == null ? void 0 : _conceptCtx.def;
  const isZone = !!def && !def.pulls && (def.type === "run_inside" || def.type === "run_outside");
  const isGap = !!def && !!def.pulls;
  const isOutside = (def == null ? void 0 : def.type) === "run_outside";
  const edgePlay = (_conceptCtx == null ? void 0 : _conceptCtx.edgePlay) || "balanced";
  const awr = (_a = carrier.attributes.AWR) != null ? _a : C.READ_VISION_PIVOT;
  const scheme = { spillTflShare: C.SPILL_TFL_SHARE };
  // Fix A — the read (zone dive/bounce/cutback). Centered at the carrier-AWR mean,
  // so an average back is unchanged; a high-vision back sharpens the cut, a poor
  // one dulls it. Zone concepts (read plays) only — a gap back follows the puller.
  if (!globalThis.__noRead && (isZone || isQBCarrier)) {
    scheme.read = clamp2((awr - C.READ_VISION_PIVOT) * C.READ_CUT_GAIN * 0.01, -C.READ_CUT_CAP, C.READ_CUT_CAP);
  }
  // Fix B — scheme identity. Zone sends the combo blocker climbing to the 2nd
  // level (near LB harder to reach clean); gap tightens the POA (cleaner first
  // read, fewer fillers shoot the point). Mean-neutral: moves WHERE the yards come.
  if (!globalThis.__noScheme) {
    if (isZone) scheme.climb = C.SCHEME_CLIMB_GAIN;
    else if (isGap) scheme.poaClean = C.SCHEME_GAP_POA;
  }
  // Fix C — force/spill. A crashing edge spills outside runs into pursuit (TFL when
  // sound, breakaway when the fit is wrong); contain boxes inside. Two-sided.
  if (!globalThis.__noSpill && (isOutside || isGap)) {
    scheme.spillEdge = edgePlay === "crash" ? C.SPILL_EDGE : edgePlay === "contain" ? -C.SPILL_EDGE : 0;
  }
  return scheme;
}
function runOutcome(carrier, laneQuality, bestPenetrator, secondLevel, deepLevel, contextBoost, dlPursuit = []) {
  var _a, _b, _c;
  const isQBCarrier = carrier.position === "QB";
  const vision = contextBoost * 1.5 + (isQBCarrier ? C.QB_CARRIER_BONUS : 0);
  const finish = (carP, defP) => {
    const styleOut = { style: null };
    let broke = breaksTackle(carP, defP, styleOut);
    if (!broke && _tkStyle === "strip" && Math.random() < clamp2(0.09 - ((defP.attributes.STR + defP.attributes.PWR) / 2 - 50) * 1e-3, 0.03, 0.12)) broke = true;
    if (broke && _tkStyle === "wrap" && Math.random() < clamp2(0.1 + ((defP.attributes.STR + defP.attributes.PWR) / 2 - 50) * 2e-3, 0.05, 0.22)) broke = false;
    return { broke, style: styleOut.style };
  };
  const scheme = buildRunScheme(carrier, isQBCarrier);
  const fit = runFit(carrier, {
    lane: laneQuality,
    penetrator: bestPenetrator,
    secondLevel,
    deepLevel,
    dlPursuit,
    vision,
    finish,
    scheme
  });
  let finalYards = fit.yards;
  let tacklerId = fit.tacklerId;
  const assistId = fit.assistId;
  let ffId = null;
  if (!tacklerId) {
    const stopper = pickTackler([...secondLevel, ...deepLevel]);
    tacklerId = (_a = stopper == null ? void 0 : stopper.id) != null ? _a : null;
  }
  const allDefs = [bestPenetrator, ...secondLevel, ...deepLevel, ...dlPursuit || []].filter(Boolean);
  const tackler = tacklerId ? (_b = allDefs.find((d) => d.id === tacklerId)) != null ? _b : null : null;
  if (tackler && !fit.tflId && finalYards >= 0 && finalYards <= 4) {
    let ffChance = clamp2(
      tackler.attributes.STR * 3e-3 + tackler.attributes.PWR * 2e-3 - carrier.attributes.CON * 3e-3,
      5e-3,
      0.06
    );
    const hndMult = clamp2(1 - (carrier.attributes.SEC * 0.85 + carrier.attributes.TEC * 0.15 - 50) * C.FUMBLE_HND_SCALE, 0.45, 1.3);
    const weightMult = clamp2(1 - (((_c = carrier.weight) != null ? _c : 210) - 210) * C.WEIGHT_FF_SCALE, 0.7, 1.3);
    ffChance *= hndMult * weightMult * (_tkStyle === "strip" ? clamp2(1.25 + (tackler.attributes.TEC - 50) * 8e-3, 1.1, 1.8) : _tkStyle === "wrap" ? 0.6 : 1);
    // Identity stage 3: Big Hitter (hit-power flavor on the FF path), Strip
    // Artist (the strip attempt itself), Secure Bag / Fumbler (carrier side —
    // the two-sided ball-security axis on this same roll).
    ffChance *= traitMult(tackler, "bigHitter", 0.04) * traitMult(tackler, "stripArtist", 0.05);
    ffChance *= traitMult(carrier, "secureBag", -0.04) * flawMult(carrier, "fumbler", 0.06);
    if (Math.random() < ffChance) ffId = tackler.id;
  }
  if (tackler && !fit.breakaway) {
    const ff = Math.round(contestGap("fallForward", carrier, tackler) * 0.02 + (Math.random() * 2 - 1) * 0.6);
    finalYards += clamp2(ff, -1, 2);
  }
  return {
    yards: finalYards,
    tacklerId,
    assistId,
    tflId: fit.tflId,
    ffId,
    breakaway: fit.breakaway,
    brokenById: fit.brokenById,
    btStyle: fit.btStyle
  };
}
function zoneLandmark(fam, depth) {
  if (depth === "short") return "flat";
  if (depth === "medium") return fam === "Cover 3" || fam === "C3 Fire Zone" ? "hook/curl" : "seam/hook";
  // PASS 3 families: Cover 6 speaks quarters (its field half is the read side);
  // Tampa 2's deep middle is the Mike's pole; Prevent is the umbrella.
  if (fam === "Cover 6") return "deep quarter";
  if (fam === "Tampa 2") return "deep half";
  if (fam === "Prevent") return "deep umbrella";
  return fam === "Cover 4" ? "deep quarter" : fam === "Cover 2" || fam === "Cover 2-Man" ? "deep half" : "deep third";
}
function assignCoverage(receivers, defPersonnel, defRoster, frontId, isZoneHeavy, coverageScheme = "balanced", wr1Id = null, blitzerDbId = null, pressLevel = "balanced") {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const frontRoles = composedFrontRoles(frontId);
  const dbRoles = frontRoles.DB || [];
  const lbRoles = frontRoles.LB || [];
  const coverDefenders = [];
  const dbIds = (defPersonnel.DB || []).filter((id) => id !== blitzerDbId);
  for (let i = 0; i < dbIds.length; i++) {
    const p = defRoster.find((pl) => pl.id === dbIds[i]);
    if (!p) continue;
    const origIdx = (defPersonnel.DB || []).indexOf(dbIds[i]);
    const role = dbRoles[origIdx] || "S-Free";
    const isPress = role === "CB-Press" || role === "CB-Slot";
    coverDefenders.push({ player: p, coverageType: isPress ? "press" : "zone" });
  }
  const lbIds = defPersonnel.LB || [];
  const lbsSorted = lbIds.map((id, i) => ({ player: defRoster.find((p) => p.id === id), role: lbRoles[i] || "LB-Thumper" })).filter((x) => x.player).sort((a, b) => {
    var _a2, _b2;
    const order = { "LB-Cover": 0, "LB-Hybrid": 1, "LB-Thumper": 2 };
    return ((_a2 = order[a.role]) != null ? _a2 : 3) - ((_b2 = order[b.role]) != null ? _b2 : 3);
  });
  for (const { player } of lbsSorted) {
    coverDefenders.push({ player, coverageType: "zone" });
  }
  let lockedPair = null;
  if (coverageScheme === "lockTop" && wr1Id) {
    const wr1Idx = receivers.findIndex((r) => r.receiverId === wr1Id);
    let cb1Idx = -1, bestPress = -Infinity;
    for (let k = 0; k < coverDefenders.length; k++) {
      const cd = coverDefenders[k];
      if (cd.coverageType !== "press") continue;
      const rv = roleRating(cd.player, "CB-Press");
      if (rv > bestPress) {
        bestPress = rv;
        cb1Idx = k;
      }
    }
    if (wr1Idx !== -1 && cb1Idx !== -1) {
      lockedPair = { receiverIdx: wr1Idx, coverEntry: coverDefenders[cb1Idx] };
      coverDefenders.splice(cb1Idx, 1);
    }
  }
  {
    const stress = (_c = (_b = (_a = _conceptCtx == null ? void 0 : _conceptCtx.def) == null ? void 0 : _a.vs) == null ? void 0 : _b[_conceptCtx == null ? void 0 : _conceptCtx.fam]) != null ? _c : 0;
    if (stress > 0) {
      let weakIdx = -1, weakAwr = Infinity;
      for (let k = 0; k < coverDefenders.length; k++) {
        if (coverDefenders[k].coverageType !== "zone") continue;
        const awr = coverDefenders[k].player.attributes.AWR;
        if (awr < weakAwr) {
          weakAwr = awr;
          weakIdx = k;
        }
      }
      let prim = receivers.findIndex((r) => r.passDepth === _conceptCtx.def.depth);
      if (prim < 0) prim = 0;
      if (weakIdx >= 0 && prim < coverDefenders.length && weakIdx !== prim && ((_d = coverDefenders[prim]) == null ? void 0 : _d.coverageType) === "zone") {
        const t = coverDefenders[prim];
        coverDefenders[prim] = coverDefenders[weakIdx];
        coverDefenders[weakIdx] = t;
      }
    }
  }
  const rawExcess = Math.max(0, coverDefenders.length - receivers.length + (lockedPair ? 1 : 0));
  const bracketUsed = coverageScheme === "bracketTop" && wr1Id ? 1 : 0;
  const excess = Math.max(0, rawExcess - bracketUsed);
  const helpBoost = Math.min(excess, 2) * 0.04;
  // ── Fix A (leverage geometry) ────────────────────────────────────────────
  // "Play opposite your help." A defender with a safety over the top plays
  // OUTSIDE leverage (+1) and funnels the route inside toward help; without
  // help (man / single-high) he plays INSIDE leverage (-1) to wall off the
  // quicker in-breakers, conceding the sideline. This threads a leverage into
  // the duel geometry; `attack` (which way the called route breaks vs that
  // leverage) is left 0 in live play, so leverage is MEAN-NEUTRAL in aggregate
  // (variance-by-direction only) — stat_realism sees no comp% shift, while the
  // route_shape/leverage probe drives attack explicitly to prove direction.
  const hasHelp = excess > 0 || (_conceptCtx == null ? void 0 : _conceptCtx.shell) === "two";
  // ── Fix B (route individuation) wired into live play ──────────────────────
  // Each receiver runs an individuated route SHAPE, not the old generic break.
  // The mix is balanced by depth so it's realistic per play yet MEAN-NEUTRAL in
  // aggregate: sharp cuts win at the break but bleed downfield speed, speed cuts
  // keep velocity — they offset. Double moves (which DO net separation) are kept
  // rare and reserved for a featured, high-TEC receiver so they don't inflate
  // league comp%. When __noRoute, no route is supplied and the duel is baseline.
  const shapeFor = (i, passDepth, rec) => {
    if (globalThis.__noRoute) return void 0;
    const tec = rec && rec.attributes && rec.attributes.TEC != null ? rec.attributes.TEC : 50;
    // Playbook tags (Aug 2026): a concept may declare its own route shapes
    // (`routes: ["sharp","speed",...]` by receiver index) and/or feature a
    // called double move (`dbl: true`). Absent tags = the depth-parity mix, so
    // untagged concepts are behavior-identical to baseline.
    const cdef = _conceptCtx == null ? void 0 : _conceptCtx.def;
    const hint = cdef && Array.isArray(cdef.routes) ? cdef.routes[i] : null;
    const shape = hint === "sharp" || hint === "speed" ? hint : passDepth === "short" ? (i % 2 === 0 ? "speed" : "sharp") : passDepth === "medium" ? (i % 2 === 0 ? "sharp" : "speed") : "speed";
    // Double moves net separation, so they're rare and reserved for a featured,
    // high-TEC receiver — enough to exist as a real weapon, not enough to move
    // league comp%. Rate/threshold tuned so aggregate stays conversion-neutral.
    // A CALLED double move (Sluggo Seam) is the play's identity: the featured
    // man runs it every snap — a receiver doesn't refuse the sluggo, he just
    // sells it worse. The duel prices the craft (sepgeo's dblLag scales with
    // his TEC vs the defender's AWR and floors at zero), so no talent gate
    // here — the physics ARE the gate. (A TEC≥70 gate shipped first and was
    // dead code: tier-1 rosters top out in the high 60s.)
    const dbl = cdef && cdef.dbl ? i === 0 : i === 0 && tec >= 84 && passDepth === "medium" && Math.random() < 0.05;
    return { shape, dbl };
  };
  const schemeFor = (ct, i, passDepth, rec, cdefender) => {
    const lev = globalThis.__noLeverage ? null : { leverage: ct === "zone" ? 0 : hasHelp ? 1 : -1, attack: 0 };
    const route = shapeFor(i, passDepth, rec);
    if (!lev && !route) return null;
    // Playbook tags (Aug 2026): a concept that declares which way its routes
    // break (`breaks: "in" | "out"`) plays the leverage game for real —
    // in-breakers catch an outside-leverage (help-funnel) defender leaning
    // wrong (+attack), and run straight into an inside-leverage wall (-attack).
    // Leverage only exists in man duels, so zone looks are unaffected, and the
    // sign flips with the defender's help — aggregate stays close to neutral
    // while the CALL finally matters. Untagged concepts keep attack 0.
    const levVal = lev ? lev.leverage : 0;
    const brks = cdefBreaks();
    let attack = brks !== 0 && levVal !== 0 ? brks * levVal : 0;
    // ── PASS 5: choice/option route (Ref/PASS5_OFFENSE_PLAN.md §C) ─────────
    // A choice-tagged concept lets the FEATURED man (index 0 — the dbl
    // convention) read the defender's leverage post-snap and break away from
    // it (attack +1). The read is a skill: a low-AWR receiver breaks into the
    // wall half the time he misses (attack −1) — a choice route run badly is
    // worse than a called break. Man-only (leverage stays 0 in zone by the
    // standing contract); a zone choice settles instead (tiny short-depth
    // credit applied post-assign). Mean-neutrality is bought with the QB
    // miscommunication roll in resolvePassPlay (the wrong-place ball).
    let choice = null;
    const cdefC = _conceptCtx == null ? void 0 : _conceptCtx.def;
    if (cdefC && cdefC.choice && i === 0 && !globalThis.__noChoiceRoutes && rec && rec.attributes) {
      // The read exists vs MAN leverage; vs a zone FAMILY the choice route
      // settles instead (the featured man's own duel is press/offman-typed
      // even under zone shells, so the family — the truth of the snap — is
      // the man/zone gate here).
      const famC = (_conceptCtx == null ? void 0 : _conceptCtx.fam) || "";
      const zoneFam = famC === "Cover 2" || famC === "Cover 3" || famC === "Cover 4" || famC === "C3 Fire Zone" || famC === "Tampa 2" || famC === "Cover 6" || famC === "Prevent";
      if (!zoneFam && levVal !== 0) {
        const dAWR = cdefender && cdefender.attributes && cdefender.attributes.AWR != null ? cdefender.attributes.AWR : 50;
        const recRead = (rec.attributes.AWR != null ? rec.attributes.AWR : 50) * 0.6 + (rec.attributes.TEC != null ? rec.attributes.TEC : 50) * 0.4;
        // Identity: Leverage Reader — the receiver's one choice mechanism.
        const convP = clamp2(0.35 + (recRead - dAWR) * 5e-3 + 0.04 * traitLv(rec, "leverageReader"), 0.15, 0.8);
        if (Math.random() < convP) {
          attack = 1;
          choice = "converted";
        } else if (Math.random() < 0.5) {
          attack = -1;
          choice = "wall";
        } else choice = "held";
      } else if (zoneFam && passDepth === "short") {
        choice = "settle";
      }
    }
    return { leverage: levVal, attack, route, choice };
  };
  const cdefBreaks = () => {
    const b = (_conceptCtx == null ? void 0 : _conceptCtx.def) == null ? void 0 : _conceptCtx.def.breaks;
    return b === "in" ? 1 : b === "out" ? -1 : 0;
  };
  const assigned = [];
  let poolIdx = 0;
  for (let i = 0; i < receivers.length; i++) {
    const { receiverId, receiver } = receivers[i];
    if (lockedPair && i === lockedPair.receiverIdx) {
      const coverEntry2 = lockedPair.coverEntry;
      const lockType = pressLevel === "off" ? "offman" : "press";
      let sep2 = routeVsCoverage(receiver, coverEntry2.player, receivers[i].passDepth, lockType, schemeFor(lockType, i, receivers[i].passDepth, receiver, coverEntry2.player));
      sep2 = clamp2(sep2 - 0.06, 0, 1);
      assigned.push({ receiverId, receiver, defender: coverEntry2.player, coverageType: lockType, separation: sep2, locked: true, passDepth: receivers[i].passDepth });
      continue;
    }
    const coverEntry = coverDefenders[poolIdx++] || null;
    const baseType = (_e = coverEntry == null ? void 0 : coverEntry.coverageType) != null ? _e : isZoneHeavy ? "zone" : "press";
    // ── Fix E (shell-wide press/off identity) ───────────────────────────────
    // Cushion follows the SHELL, not just a per-corner tag. In a two-high/soft
    // shell there's no robber underneath and a lid over the top, so a corner
    // BAILS — he gives cushion and plays off (harder to jam, but he keeps
    // everything in front). In a single-high/pressed shell the help is in the
    // middle, so the corner sits tight in PRESS and trusts the safety over the
    // top. The coach's explicit pressLevel still wins when set; otherwise the
    // shell decides. Gate: globalThis.__noShellId falls back to the old
    // pressLevel-only rule, so it toggles cleanly and is off-neutral.
    const shellId = _conceptCtx == null ? void 0 : _conceptCtx.shell;
    let effType;
    if (pressLevel === "off" && baseType === "press") effType = "offman";
    else if (!globalThis.__noShellId && baseType === "press" && pressLevel !== "press" && shellId === "two") effType = "offman";
    else effType = baseType;
    const rvScheme = schemeFor(effType, i, receivers[i].passDepth, receiver, (_f = coverEntry == null ? void 0 : coverEntry.player) != null ? _f : null);
    let sep = routeVsCoverage(
      receiver,
      (_f = coverEntry == null ? void 0 : coverEntry.player) != null ? _f : null,
      receivers[i].passDepth,
      effType,
      rvScheme
    );
    let bracketed = false;
    if (coverageScheme === "bracketTop" && receiverId === wr1Id) {
      sep = clamp2(sep - 0.07, 0, 1);
      bracketed = true;
    } else if (i < 2 && helpBoost > 0) {
      sep = clamp2(sep - helpBoost, 0, 1);
    }
    // P1-3 (zone teaching style): the triangle. SPOT-DROP defenders sit in the
    // short throwing lanes — a touch stingier underneath, and they never bust.
    // MATCH travels with routes — but a defender without the head for it
    // (AWR-led, technique helping) loses his man mid-pattern: a BUST, and the
    // receiver is running free. Balanced = neither = the pre-dial game.
    let busted = false;
    if (effType === "zone" && (coverEntry == null ? void 0 : coverEntry.player)) {
      const _zs = (_passCtx == null ? void 0 : _passCtx.zoneStyle) || "balanced";
      if (_zs === "spot" && receivers[i].passDepth === "short") {
        sep = clamp2(sep - 0.02, 0, 1);
      } else if (_zs === "match") {
        const _dIQ = (coverEntry.player.attributes.AWR != null ? coverEntry.player.attributes.AWR : 50) * 0.7 + (coverEntry.player.attributes.TEC != null ? coverEntry.player.attributes.TEC : 50) * 0.3;
        // Identity stage 3: Zone Eyes shrinks the match-bust chance;
        // Freelancer (flaw, two-sided) raises it — but see below, he also
        // jumps routes for splash on the snaps he doesn't bust.
        const _bustMult = traitMult(coverEntry.player, "zoneEyes", -0.1) * flawMult(coverEntry.player, "freelancer", 0.15);
        if (_dIQ < 50 && Math.random() < (50 - _dIQ) * 8e-3 * _bustMult) {
          sep = clamp2(sep + 0.22, 0, 1);
          busted = true;
        }
      }
      if (!busted) {
        const _flLv = flawLv(coverEntry.player, "freelancer");
        if (_flLv) sep = clamp2(sep - 4e-3 * _flLv, 0, 1);
      }
    }
    assigned.push({
      receiverId,
      receiver,
      defender: (_g = coverEntry == null ? void 0 : coverEntry.player) != null ? _g : null,
      coverageType: effType,
      separation: sep,
      busted,
      bracketed,
      passDepth: receivers[i].passDepth,
      // Fix B/D: the individuated route's shape rides along. A medium "sharp"
      // cut is the classic in-breaker (dig/comeback) a two-high robber jumps.
      routeShape: rvScheme && rvScheme.route ? rvScheme.route.shape : null,
      // Capstone P1 (Aug 2026): the double-move rides along too — pure
      // recording, so the trace (and the viewer) can show the sluggo that won.
      routeDbl: !!(rvScheme && rvScheme.route && rvScheme.route.dbl),
      choice: rvScheme && rvScheme.choice || null,
      breakIn: !!(rvScheme && rvScheme.route && rvScheme.route.shape === "sharp" && receivers[i].passDepth === "medium"),
      // Rung 3: a zone defender is charged with a LANDMARK, a man defender
      // with a MAN — the drive log's credit/blame speaks this vocabulary.
      landmark: effType === "zone" ? zoneLandmark((_h = _conceptCtx == null ? void 0 : _conceptCtx.fam) != null ? _h : "Cover 3", receivers[i].passDepth) : null
    });
  }
  // ── Fix C (zone void — the high-low / flood stress) ───────────────────────
  // A zone defender owns an AREA, not a man. Put two receivers in his area (a
  // high-low, a flood) and he can only carry one — the other comes open in the
  // VOID. The old model gave every receiver his own defender by index, so a
  // flood was covered as cleanly as a spread-out set and zone couldn't be
  // stressed. Here: group the zone-covered receivers by landmark; where two or
  // more share one, the defender is outnumbered and each receiver in that void
  // gets a separation boost that scales with the overload and is shrunk by the
  // defender's AWR (a heady zone player passes off / squeezes the window). A
  // landmark with one receiver is untouched, so the pass is zero-neutral on a
  // normal route distribution. Gate: globalThis.__noVoid.
  if (!globalThis.__noVoid) {
    const byLandmark = {};
    for (const a of assigned) {
      if (a.coverageType !== "zone" || !a.landmark || !a.defender) continue;
      (byLandmark[a.landmark] = byLandmark[a.landmark] || []).push(a);
    }
    for (const key in byLandmark) {
      const grp = byLandmark[key];
      // Require a genuine overload: three-plus routes converging on one landmark
      // is an unambiguous flood/high-low that outnumbers the zone. Two same-depth
      // receivers are ambiguous (often opposite sides of the field, each cleanly
      // covered), so they don't trip the void — this is what keeps the mechanism
      // biting on real floods (the probe) while staying league-neutral on normal
      // spacing, without needing per-receiver field-side alignment threaded here.
      if (grp.length < 3) continue;
      // A true VOID needs the area genuinely outnumbered. Two same-depth
      // receivers on a spread set aren't a flood — the coverage soaks it. The
      // gain is deliberately modest per extra body and squeezed hard by the
      // defender's AWR, so it bites on a real high-low/flood (which the probe
      // drives) while staying near-neutral league-wide on normal route spacing.
      const overload = grp.length - 1;
      // P1-3: the teaching style dials how a flooded zone soaks the overload.
      // MATCH defenders pass routes off and squeeze the void; SPOT-DROP sits
      // on grass and gives the flood its full geometry. Balanced = 1 = today.
      const _zsV = (_passCtx == null ? void 0 : _passCtx.zoneStyle) === "match" ? 0.55 : (_passCtx == null ? void 0 : _passCtx.zoneStyle) === "spot" ? 1.45 : 1;
      for (const a of grp) {
        const dAwr = a.defender.attributes.AWR != null ? a.defender.attributes.AWR : 50;
        // identity stage 3: Pattern Matcher — passes off the flood, shuts the void
        const awrSqueeze = Math.max(0.25, 1 - Math.max(0, dAwr - 50) * 13e-3) * traitMult(a.defender, "patternMatcher", -0.08);
        const voidGain = Math.min(0.14, overload * 0.05) * awrSqueeze * _zsV;
        a.separation = clamp2(a.separation + voidGain, 0, 1);
        a.voided = true;
      }
    }
  }
  return assigned;
}
function resolvePassPlay(playType, offPersonnel, defPersonnel, offRoster, defRoster, qb, offUnit, defUnit, offPlan, defPlan, frontId, shareByPlayerId = null, blitzShareByPlayerId = null, offFormationId = "Single Back", roleBySlotPlayer = null, dropShareById = null, fieldPos = 50) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H, _I, _J, _K, _L, _M, _N, _O, _P, _Q, _R, _S, _T, _U, _V, _W, _X, _Y, _Z, __, _$, _aa;
  const result = {
    type: playType,
    yards: 0,
    complete: false,
    turnover: false,
    turnoverType: null,
    sack: false,
    blitzFired: false,
    throwerId: (_a = qb == null ? void 0 : qb.id) != null ? _a : null,
    targetId: null,
    receiverId: null,
    tacklerId: null,
    assistId: null,
    tflId: null,
    sackerId: null,
    sackerId2: null,
    pbuId: null,
    intPickerId: null,
    ffId: null
  };
  const contextBoost = (offUnit - defUnit) / C.K_CONTEXT;
  const defContextBoost = -contextBoost;
  let paBite = 0;
  // PASS 5: trick-play context (fleaflicker | hbpass). The gadget IS the run
  // fake, so the vanilla PA roll stands down; the bite has its own pricing
  // and the toss-back's pocket cost rides paBite NEGATIVE into the rush.
  const _gadget = offPlan && offPlan._gadget && !globalThis.__noGadgets ? offPlan._gadget : null;
  let gadgetBite = 0;
  result.playAction = false;
  _passCtx = {
    covStyle: (_c = (_b = defPlan == null ? void 0 : defPlan.covStyleEff) != null ? _b : defPlan == null ? void 0 : defPlan.covStyle) != null ? _c : "balanced",
    pressLevel: (_e = (_d = defPlan == null ? void 0 : defPlan.pressLevelEff) != null ? _d : defPlan == null ? void 0 : defPlan.pressLevel) != null ? _e : "balanced",
    qbAggr: (_f = offPlan == null ? void 0 : offPlan.qbAggr) != null ? _f : 50,
    // P1-3 (zone teaching style): spot-drop / balanced / match — threads into
    // the coverage duel's void + bust mechanics. Balanced = today exactly.
    zoneStyle: (defPlan == null ? void 0 : defPlan.zoneStyleEff) || (defPlan == null ? void 0 : defPlan.zoneStyle) || "balanced",
    dnaAir: (offPlan == null ? void 0 : offPlan._dnaAir) || 0,
    dnaBallSec: (offPlan == null ? void 0 : offPlan._dnaBallSec) || 0,
    dnaBallHawk: (defPlan == null ? void 0 : defPlan._dnaBallHawk) || 0
  };
  if (_gadget) {
    result.gadget = _gadget;
    result.playAction = true;
    const lbs2 = (defPersonnel.LB || []).map((id) => defRoster.find((p) => p.id === id)).filter(Boolean);
    const lbAWR2 = lbs2.length ? lbs2.reduce((s, p) => s + p.attributes.AWR, 0) / lbs2.length : 50;
    const fj2 = lbs2.length ? lbs2.reduce((s, p) => s + 1.5 * traitLv(p, "filmJunkie") - 2 * flawLv(p, "bitesHard"), 0) / lbs2.length : 0;
    const disc2 = clamp2((lbAWR2 + fj2 - 45) / 90, 0, 0.6);
    const rc2 = Math.max(0, (defPlan == null ? void 0 : defPlan.runCommitEff) || 0);
    const shellMult2 = (defPlan == null ? void 0 : defPlan.covShellEff) === "single" ? 1.15 : (defPlan == null ? void 0 : defPlan.covShellEff) === "two" ? 0.7 : 1;
    const seller = _gadget === "hbpass" ? qb : (offPersonnel.RB || []).map((id) => offRoster.find((p) => p.id === id)).filter(Boolean)[0] || qb;
    // Identity: Gadget Ace — the seller's craft is the one gadget mechanism.
    gadgetBite = clamp2((0.35 + rc2 * 0.04 + (rc2 > 0 ? 0.15 : 0)) * shellMult2 * (1 - disc2) * (1 + 0.04 * traitLv(seller, "gadgetAce")), 0, 1);
  }
  if (playType !== "pass_short" && !_gadget) {
    const PA_RATE = {
      "Power-I": 0.34,
      "Trips/Bunch": 0.21,
      "Spread": 0.17,
      "Pistol/RPO": 0.3,
      "Air Raid": 0.12,
      // Expansion five: option teams throw almost exclusively
      // off the run fake; Empty has no run to fake. Wildcat's
      // rare pass IS the play-action — the whole formation is
      // the fake. (Keep in sync with gameplan.js identity card.)
      "Single Back": 0.3,
      "Empty": 0.05,
      "Wishbone": 0.38,
      "Flexbone": 0.36,
      "Wildcat": 0.5,
      "Jumbo": 0.4
    };
    const paEff = clamp2(((_g = PA_RATE[offFormationId]) != null ? _g : 0.22) * (((_h = offPlan.paRate) != null ? _h : 100) / 100), 0, 0.65);
    const calledPA = !!(offPlan == null ? void 0 : offPlan._forcePA) || !!(offPlan == null ? void 0 : offPlan._forcePANative);
    if (calledPA || Math.random() < paEff) {
      result.playAction = true;
      const rbId = (offPersonnel.RB || [])[0];
      const rb = rbId ? offRoster.find((p) => p.id === rbId) : null;
      const runLean = 1 - ((_i = PASS_TENDENCY[offPlan.tendency || "Balanced"]) != null ? _i : 0.5);
      const rbCred = rb ? (rb.compositeRating - 45) / 60 : 0;
      // Identity stage 3: Play-Action Seller — the fake's credibility is a
      // craft (back or QB); Film Junkie / Bites Hard are the defender side
      // of the same bite term (discipline up / sold-out-downhill down).
      const paSell = 0.03 * Math.max(traitLv(rb, "paSeller"), traitLv(qb, "paSeller"));
      const credibility = clamp2(0.25 + (runLean - 0.5) * 2 + rbCred * 0.5 + (((_j = qb == null ? void 0 : qb.attributes.TEC) != null ? _j : 50) - 55) * 4e-3 + paSell, 0.03, 1.2);
      const lbs = (defPersonnel.LB || []).map((id) => defRoster.find((p) => p.id === id)).filter(Boolean);
      const lbAWR = lbs.length ? lbs.reduce((s, p) => s + p.attributes.AWR, 0) / lbs.length : 50;
      const _fjAdj = lbs.length ? lbs.reduce((s, p) => s + 1.5 * traitLv(p, "filmJunkie") - 2 * flawLv(p, "bitesHard"), 0) / lbs.length : 0;
      const discipline = clamp2((lbAWR + _fjAdj - 45) / 90, 0, 0.6);
      const commitAmp = 1 + Math.max(0, defPlan.runCommitEff || 0) * 0.02;
      const shellBiteMult = (defPlan == null ? void 0 : defPlan.covShellEff) === "single" ? 1.15 : (defPlan == null ? void 0 : defPlan.covShellEff) === "two" ? 0.8 : 1;
      paBite = clamp2(credibility * commitAmp * (1 - discipline) * shellBiteMult, 0, 1.2);
    }
  }
  const passRushers = [];
  const frontRoles = composedFrontRoles(frontId);
  const dlRoles = frontRoles.DL || [];
  const lbRoles = frontRoles.LB || [];
  const dlIds = defPersonnel.DL || [];
  const olbSet = new Set(defPersonnel.OLB || []);
  const droppedIds = [];
  // [PLAYTEST 2026-08-12 item 4B] Was `frontId === "3-4" || frontId === "Penny"`,
  // a literal duplicate of DEF_DROP_ELIGIBLE that also appears in fieldassign.js
  // and the depth-chart UI. Add a drop slot to any other front and the dial would
  // render, resolveDefField would populate dropShareByPlayerId — and this line
  // would silently ignore all of it. Read the table.
  const _dropFront = (DEF_DROP_ELIGIBLE[frontId] || []).length > 0;
  for (let i = 0; i < dlIds.length; i++) {
    const id = dlIds[i];
    if (_dropFront && olbSet.has(id)) {
      const dropP = ((_k = dropShareById == null ? void 0 : dropShareById[id]) != null ? _k : C.FZ_NATIVE_DROP_PCT) / 100;
      if (Math.random() < dropP) {
        droppedIds.push(id);
        continue;
      }
    }
    const p = defRoster.find((pl) => pl.id === id);
    if (p) passRushers.push({ player: p, role: dlRoles[i] || "DT-3tech" });
  }
  let lbIds = [...defPersonnel.LB || [], ...droppedIds];
  const dbIds = defPersonnel.DB || [];
  let blitzerDbId = null;
  const onField = /* @__PURE__ */ new Set([
    ...defPersonnel.DL || [],
    ...lbIds,
    ...dbIds
  ]);
  // ── W4 (§2): AGGRESSION DEFENSE — the sim owns the translation. ─────────
  // Stop × identity × situation × the front's signature package decide the
  // call rate, who comes, and the coverage behind it. The old models die
  // here: pressureSource lanes and per-slot blitz shares no longer pick the
  // pressure — the coach's dialed ⚡ shares survive only as a PREFERENCE for
  // which body carries the identity's blitz (the depth chart still names
  // your hitman; the identity names the package).
  const aggrStop = defPlan.defAggrEff || defPlan.defAggression || aggrStopFromBlitzPct(defPlan.blitzPct);
  const identity = defPlan.pressIdentityEff || defPlan.pressureIdentity || FRONT_PRESSURE_SIGNATURE[frontId] || "secondLevel";
  const sigMatch = FRONT_PRESSURE_SIGNATURE[frontId] === identity;
  // W4 (§2): BLITZ THE FORMATION (Blitzology). A defense reads the offense's
  // look and checks to more pressure against the sets that BEG for it — an
  // empty backfield (nobody home to pick up the extra man) most of all, a
  // spread passing set next. The check is sharper when the front is running
  // its OWN signature blitz (it has the call drilled for this look) and when
  // the coordinator's Blitz Design is high (he actually sees the tell in time).
  const _offPkg = FORMATION_PACKAGES[offFormationId] || {};
  const _offWR = (_offPkg.WR || 0) + (_offPkg.SLOT || 0);
  const _offBacks = (_offPkg.RB || 0) + (_offPkg.FB || 0);
  let formTell = 1;
  if (_offBacks === 0 && _offWR >= 3) formTell = 1.35;
  else if (_offWR >= 4) formTell = 1.22;
  else if (_offWR >= 3 && _offBacks <= 1) formTell = 1.1;
  if (formTell > 1) {
    const _dcRead = clamp2(0.4 + (((defPlan == null ? void 0 : defPlan.blitzDesign) != null ? defPlan.blitzDesign : 50) - 50) / 100, 0.25, 1);
    const _sig = sigMatch ? 1 : 0.6;
    formTell = 1 + (formTell - 1) * _dcRead * _sig;
  }
  // blitzPct (defPlanEff) already carries the stop's rate + the weekly shift;
  // pressureCallRate layers the situation shaping and the DC's timing on top,
  // then the formation-tell check; the cap keeps even the house honest.
  // ── PASS 3: rush-3 / drop-8 ───────────────────────────────────────────────
  // The call trades the rush for the umbrella: no blitz roll (you don't drop
  // eight AND send six), the front is cut to its best three after assembly,
  // and the dropped bodies join the coverage pool so assignCoverage's
  // excess/helpBoost math actually SEES eight in coverage.
  const rush3Call = !globalThis.__noCovFamilies && defPlan.rush3Eff === true;
  // ── PASS 4: pressure flavors (call ingredients; __noPressFlavors kills) ───
  const _pf = !globalThis.__noPressFlavors;
  const _pfC = C.PRESS_FLAVOR;
  const mugCall = _pf && defPlan.pressLookEff === "mug" && !rush3Call;
  const amoebaCall = _pf && defPlan.pressLookEff === "amoeba" && !rush3Call;
  const crossCall = _pf && defPlan.dogGameEff === "cross" && !rush3Call;
  // BLITZ PIE: the front's HEAT dial owns "how often" — a plain multiplier on
  // the computed call rate (0 → ×0.5, 50 → ×1.0, 100 → ×1.5), still inside
  // the aggression cap. Neutral (null) for every AI plan and untouched save.
  const _pieHeatMult = !globalThis.__noBlitzPie && defPlan._pieHeat != null ? 0.5 + defPlan._pieHeat / 100 : 1;
  const blitzPct = rush3Call ? 0 : clamp2(pressureCallRate({ stop: aggrStop, lev: defPlan._defLev || "neutral", design: defPlan.blitzDesign, rate: defPlan.blitzPct }) * formTell * _pieHeatMult, 0, C.AGGRESSION.capRate);
  if (Math.random() < blitzPct) {
    result.blitzFired = true;
    result.pressCall = identity;
    const spec = C.PRESS_IDENTITY[identity] || C.PRESS_IDENTITY.secondLevel;
    let extra = spec.extra + (aggrStop === "house" ? C.AGGRESSION.extraHouse : 0);
    // Never strip the coverage bare: cap extras so enough LB+DB bodies stay
    // behind the call to match up (Cover 0 is risky, not impossible).
    const coverBodies = lbIds.length + dbIds.length;
    extra = Math.max(1, Math.min(extra, coverBodies - C.AGGRESSION.minCoverBodies));
    // Preference weighting: a dialed ⚡ share raises a man's claim on the
    // identity's blitz; otherwise the best body for the job goes.
    const pref = blitzShareByPlayerId || {};
    const claimed = /* @__PURE__ */ new Set(passRushers.map((r) => r.player.id));
    const pick = (ids, gradeFn) => {
      let best = null, bestVal = -Infinity;
      for (const id of ids) {
        if (claimed.has(id)) continue;
        const p = defRoster.find((pl) => pl.id === id);
        if (!p) continue;
        const v = gradeFn(p) + (pref[id] || 0) * 0.6;
        if (v > bestVal) {
          bestVal = v;
          best = p;
        }
      }
      return best;
    };
    const lbGrade = (p) => (p.attributes.SPD + p.attributes.PWR) / 2;
    const dbGrade = (p) => (p.position === "S" ? 8 : 0) + (p.attributes.SPD + p.attributes.AWR) / 2;
    const send = (p) => {
      if (!p) return;
      const role = p.position === "S" ? "S-Strong" : p.position === "CB" ? "CB-Press" : p.position === "OLB" ? "OLB-Blitz" : p.position === "LB" ? "LB-Thumper" : p.position === "DE" ? "DE-Base" : "DT-3tech";
      passRushers.push({ player: p, role, blitzer: true });
      claimed.add(p.id);
      if ((p.position === "S" || p.position === "CB") && !blitzerDbId) blitzerDbId = p.id;
    };
    // BLITZ PIE (Ref/BLITZ_PIE_PLAN.md): a dialed plan's 100% allocation owns
    // the FIRST rush seat by weighted lottery. An ⚡ slice = that man comes;
    // a 🛡 slice = that lineman DROPS and the best backer comes behind him —
    // a shield slice IS a fire-zone look (same droppedIds/fzBonus machinery).
    // Undialed plans (all AI + untouched saves) never build slices — legacy
    // path byte-identical. Sampled man unavailable → legacy seat-1 fallback.
    let pieUsed = false;
    if (!globalThis.__noBlitzPie && extra > 0) {
      const _slices = [];
      for (const [id, w] of Object.entries(pref)) if (w > 0 && onField.has(id) && !claimed.has(id)) _slices.push({ id, w, fz: false });
      for (const [id, w] of Object.entries(dropShareById || {})) if (w > 0 && onField.has(id)) _slices.push({ id, w, fz: true });
      const _tot = _slices.reduce((s, x) => s + x.w, 0);
      if (_tot > 0) {
        let _r = Math.random() * _tot;
        let _sl = _slices[0];
        for (const x of _slices) {
          _r -= x.w;
          if (_r <= 0) { _sl = x; break; }
        }
        if (_sl.fz) {
          // the shield slice: pull him out of the shown rush if he hasn't
          // already bailed naturally this snap, then send the backer behind
          const _di = passRushers.findIndex((x) => x.player.id === _sl.id && !x.blitzer);
          if (_di >= 0 && passRushers.length > 3) {
            const [_dp] = passRushers.splice(_di, 1);
            droppedIds.push(_dp.player.id);
            lbIds.push(_dp.player.id);
          }
          const _backer = pick(lbIds.filter((id) => id !== _sl.id), lbGrade);
          if (_backer) {
            send(_backer);
            pieUsed = true;
            extra--;
          }
        } else {
          const _pp = defRoster.find((pl) => pl.id === _sl.id);
          if (_pp) {
            send(_pp);
            pieUsed = true;
            extra--;
          }
        }
      }
    }
    // Who comes, by identity: fire zone = a backer behind a dropping lineman;
    // second level = LB heat; secondary heat = the SS (or slot corner) down;
    // the House = numbers — a backer AND a DB, more when the stop says so.
    // (A dialed pie owns seat 1; the identity keeps the remaining seats.)
    if (!pieUsed && (identity === "secondaryHeat" || identity === "theHouse")) {
      send(pick(dbIds, dbGrade));
      extra--;
    }
    while (extra > 0) {
      send(pick(lbIds, lbGrade));
      extra--;
    }
    // The fire zone's drop: the 3-4 does it natively (dropShareById above);
    // any other front running it bails a shown rusher behind the call — same
    // droppedIds pathway, same disguise math downstream (fzBonus).
    if (spec.drop && droppedIds.length === 0 && Math.random() < C.FZ_DROP_RATE) {
      let worst = null, worstVal = Infinity;
      for (let i = 0; i < passRushers.length; i++) {
        const r = passRushers[i];
        if (r.blitzer) continue;
        const v = (r.player.attributes.SPD || 50) + (r.player.attributes.STR || 50);
        if (v < worstVal) {
          worstVal = v;
          worst = i;
        }
      }
      if (worst != null && passRushers.length > 3) {
        const [dropped] = passRushers.splice(worst, 1);
        droppedIds.push(dropped.player.id);
        lbIds.push(dropped.player.id);
      }
    }
    // Zero behind it (§2 risk tiers: fire zone < safety/CB heat < zero).
    if (spec.zero) result.zeroBehind = true;
    // PASS 4 (cross-dog): the game needs two dogs. If the identity sent only
    // one backer, the call sends the second — a cross-dog IS a two-backer
    // pick game — under the same never-strip-the-coverage guard.
    if (crossCall) {
      const _dogF = (r) => r.blitzer && /^(LB|OLB)/.test(r.role || "");
      let lbDogs = passRushers.filter(_dogF);
      if (lbDogs.length === 1) {
        const blitzN = passRushers.filter((r) => r.blitzer).length;
        if (coverBodies - blitzN > C.AGGRESSION.minCoverBodies) {
          send(pick(lbIds, lbGrade));
          lbDogs = passRushers.filter(_dogF);
        }
      }
      if (lbDogs.length >= 2) {
        result.crossDog = true;
        result._crossIds = [lbDogs[0].player.id, lbDogs[1].player.id];
      }
    }
  }
  // Rung 3 (phantom-blitz fix): a "blitz" that added no rusher and dropped
  // nobody didn't happen — bookkeeping must not poison downstream math
  // (fzBonus, Cover 0 refinement, screen counters all key on blitzFired).
  if (result.blitzFired && !passRushers.some((r) => r.blitzer) && droppedIds.length === 0) {
    result.blitzFired = false;
    delete result.pressCall;
    delete result.zeroBehind;
    delete result.crossDog;
    delete result._crossIds;
  }
  // BLITZ PIE observability: who actually came (probe + future film UI).
  if (result.blitzFired) {
    const _bl = passRushers.filter((r) => r.blitzer).map((r) => r.player.id);
    if (_bl.length) result.blitzerIds = _bl;
  }
  // PASS 4: the look's post-snap truth — a mug that fires is interior heat, a
  // mug that doesn't is the bail; amoeba is presentation on every snap of the
  // call. (Flags feed the mechanics below + per-play accounting/probes.)
  if (mugCall) result.mug = result.blitzFired ? "fired" : "bail";
  if (amoebaCall) result.amoeba = true;
  result.rushN = passRushers.length;
  if (result.blitzFired) result.sigPress = sigMatch;
  if (result.blitzFired && blitzerDbId) result.dbHeat = true;
  const olIds = offPersonnel.OL || [];
  const blockers = olIds.map((id) => offRoster.find((p) => p.id === id)).filter(Boolean);
  const tePlayers = (offPersonnel.TE || []).map((id) => offRoster.find((p) => p.id === id)).filter(Boolean);
  const rbPlayers = (offPersonnel.RB || []).map((id) => offRoster.find((p) => p.id === id)).filter(Boolean);
  // W4 (§16.2): PROTECTION IDENTITY — Quick empties the backfield into
  // routes, Max Protect keeps everyone home; the two middle families leave
  // the protEmphasis machinery exactly as it was (halfSlide = the old engine).
  const protId = (offPlan == null ? void 0 : offPlan.protIdentityEff) || (offPlan == null ? void 0 : offPlan.protIdentity) || "halfSlide";
  const _protC = C.PROT_IDENTITY;
  // D4/M2: a composed play's AUTHORED blocking assignments. The author kept
  // specific tight ends / backs home (compilePlay's keepIn) — those bodies
  // block, no dice. Absent (every non-composed play), nothing here changes.
  const _cKeep = (_conceptCtx == null ? void 0 : _conceptCtx.def) == null ? void 0 : _conceptCtx.def.keepIn;
  const blockingTEIds = new Set(
    tePlayers.filter((te) => {
      var _a2;
      return protId === "maxProtect" ? true : te._gameArch === "TE-Blocking" || te._gameArch === "TE-Hybrid" && Math.random() < (protId === "quick" ? _protC.quickTE : clamp2(0.35 + (((_a2 = offPlan == null ? void 0 : offPlan.protEmphasis) != null ? _a2 : 50) - 50) / 200, 0.1, 0.85));
    }).map((te) => te.id)
  );
  if (_cKeep && _cKeep.TE > 0) {
    for (const te of tePlayers) {
      if (blockingTEIds.size >= _cKeep.TE) break;
      blockingTEIds.add(te.id);
    }
  }
  for (const te of tePlayers) {
    if (blockingTEIds.has(te.id)) blockers.push(te);
  }
  const _rbPE = (_m = offPlan == null ? void 0 : offPlan.protEmphasis) != null ? _m : 50;
  const rbReleased = _cKeep && _cKeep.RB > 0 ? false : rbPlayers.length > 0 && (protId === "maxProtect" ? false : protId === "quick" ? Math.random() < _protC.quickRelease : protId === "bob" ? Math.random() < _protC.bobRelease : _rbPE < 50 && Math.random() < (50 - _rbPE) / 50);
  if (rbPlayers.length > 0 && !rbReleased) blockers.push(rbPlayers[0]);
  result.rbKeptIn = rbPlayers.length > 0 && !rbReleased;
  // ── PASS 4 (green dog REFIT — owner call 2026-08-08, one model everywhere):
  // the real rule. Man coverage + your man stays in to block ⇒ you go. Both
  // the standing gp.greenDog toggle and the dogGame:"green" call ingredient
  // run it (the old code keyed on the back's ARCHETYPE and could dog with the
  // back out in a route — a sanctioned behavior change, covered by the gated
  // A/B). The dog is the back's own defender: he comes LATE, but the
  // protection never counted him (late flag → pickup dock in resolvePassRush).
  // Trait hook (IDENTITY §4b): Green Dog — this convert IS its mechanism.
  const greenDogOn = _pf && (defPlan.dogGameEff === "green" || defPlan.greenDog === true);
  if (greenDogOn && rbPlayers.length > 0 && !rbReleased) {
    const _fam = _conceptCtx == null ? void 0 : _conceptCtx.fam;
    const manCov = _fam ? _fam === "Cover 1" || _fam === "Cover 0" || _fam === "Cover 2-Man" : defPlan.covStyleEff === "man";
    if (manCov) {
      const lbRusher = passRushers.find((r) => !r.blitzer && (r.role === "LB-Thumper" || r.role === "LB-Cover" || r.role === "LB-Hybrid"));
      if (lbRusher) {
        lbRusher.blitzer = true;
        lbRusher.late = true;
        result.greenDog = true;
      } else {
        const lbId = (defPersonnel.LB || [])[0];
        const p = lbId ? defRoster.find((pl) => pl.id === lbId) : null;
        if (p && !passRushers.some((r) => r.player.id === p.id)) {
          passRushers.push({ player: p, role: "LB-Thumper", blitzer: true, late: true });
          result.greenDog = true;
        }
      }
    }
  } else if (!_pf && defPlan.greenDog && rbPlayers.length > 0) {
    // __noPressFlavors: the PRE-PASS-4 green dog, byte for byte — the switch
    // restores the shipped behavior (archetype-keyed, no man gate, no late
    // flag) so the band A/B measures the whole pass including this refit.
    const rbBlocking = rbPlayers.filter((rb) => rb._gameArch === "RB-Power" || rb._gameArch === "RB-Workhorse" || Math.random() < 0.4).length;
    if (rbBlocking > 0) {
      const lbRusher = passRushers.find((r) => !r.blitzer && (r.role === "LB-Thumper" || r.role === "LB-Cover" || r.role === "LB-Hybrid"));
      if (lbRusher) lbRusher.blitzer = true;
      else {
        const lbId = (defPersonnel.LB || [])[0];
        const p = lbId ? defRoster.find((pl) => pl.id === lbId) : null;
        if (p && !passRushers.some((r) => r.player.id === p.id)) {
          passRushers.push({ player: p, role: "LB-Thumper", blitzer: true });
        }
      }
    }
  }
  if (defPlan.spyQB && passRushers.length > 3) {
    passRushers.pop();
  }
  // PASS 3 (rush-3): cut the front to its best three rushers; everyone cut
  // drops into the umbrella. Same body-conservation law as the fire-zone drop
  // (a man leaves the rush ledger only by entering the coverage ledger) — the
  // dropped ids are grafted onto the coverage personnel below so
  // assignCoverage's excess/helpBoost math counts all eight.
  const rush3DroppedIds = [];
  if (rush3Call) {
    const rushGrade = (p) => p.attributes.PWR * 0.3 + p.attributes.STR * 0.25 + p.attributes.SPD * 0.25 + p.attributes.TEC * 0.2;
    while (passRushers.length > 3) {
      let worst = 0, worstVal = Infinity;
      for (let i = 0; i < passRushers.length; i++) {
        const v = rushGrade(passRushers[i].player);
        if (v < worstVal) {
          worstVal = v;
          worst = i;
        }
      }
      const [cut] = passRushers.splice(worst, 1);
      rush3DroppedIds.push(cut.player.id);
    }
    result.rushN = passRushers.length;
    result.rush3 = true;
    // M5 bring-3 audit (2026-08-17): record WHO dropped — the card draws a
    // lineman bending back into coverage on bring 3, and this is the sim-side
    // proof the same exchange genuinely ran (the ids below are grafted into
    // the coverage personnel at _covExtra). Recording-only, mirrors
    // blitzerIds; zero RNG; sparse (absent on every non-rush3 snap).
    if (rush3DroppedIds.length) result.rush3DroppedIds = [...rush3DroppedIds];
  }
  // [PLAYTEST 2026-08-12 item 4A — INVESTIGATED, DELIBERATELY NOT "FIXED"]
  // The comment above claims the fire-zone drop obeys the same body-conservation
  // law. It does not: fire-zone `droppedIds` go into `lbIds` (used only to pick
  // more blitzers) and never reach defPersonnelCov.
  //
  // Grafting them here is the obvious fix and it is WRONG. Measured with
  // tools/firezone_ab.mjs (3 arms, matched RNG): the graft alone made the defence
  // WORSE — comp% +0.23, INT% -0.21, sacks -0.20. Two reasons, both structural:
  //
  //   1. `defPersonnel.LB` is NEVER pruned of blitzing linebackers. Only a single
  //      blitzing DB is filtered (`blitzerDbId`, and only the first one). So a
  //      backer who rushes is STILL counted in the coverage ledger — which means
  //      the ledger already balances by accident, and grafting the dropped
  //      lineman on top inflates it to eight cover men behind a four-man rush.
  //   2. The concept-stress swap at the top of assignCoverage finds the
  //      weakest-AWR cover defender and moves him onto the primary receiver. Add a
  //      290-pound end to that pool and you have handed the offence a much better
  //      man to attack.
  //
  // The real fix is to prune blitzing LBs from the coverage ledger FIRST and then
  // graft — which makes every blitz in the game cost real coverage, moves stat
  // bands hard, and deserves its own pass. Filed rather than bodged.
  const _covExtra = [...rush3DroppedIds];
  const defPersonnelCov = _covExtra.length ? __spreadProps(__spreadValues({}, defPersonnel), { LB: [...defPersonnel.LB || [], ..._covExtra] }) : defPersonnel;
  const forcedScreen = (offPlan == null ? void 0 : offPlan._forceScreen) || null;
  const isScreen = !!forcedScreen || playType === "pass_short" && !result.playAction && Math.random() < ((_n = offPlan.screenRate) != null ? _n : 14) / 100;
  const edgeRushMult = ((defPlan == null ? void 0 : defPlan.edgePlayEff) === "crash" ? 1.08 : (defPlan == null ? void 0 : defPlan.edgePlayEff) === "contain" ? 0.94 : 1) * clamp2(1 + (((_o = offPlan == null ? void 0 : offPlan.protEmphasis) != null ? _o : 50) - 50) / -250, 0.8, 1.2);
  const fireZone = droppedIds.length > 0 && result.blitzFired === true;
  if (fireZone) result.fireZone = true;
  let fzBonus = 0;
  if (fireZone) {
    // The curve is unchanged (see the note above — the coverage body was NOT
    // grafted, so this must keep paying what it always paid). What IS fixed: it
    // used to read `droppedIds[0]` and nothing else, so on a snap that dropped two
    // men the second was invisible. Average every dropped man's craft. Identical
    // by construction when one man drops, which is the overwhelming majority.
    const _dropped = droppedIds.map((id) => defRoster.find((pl) => pl.id === id)).filter(Boolean);
    const craft = _dropped.length
      ? _dropped.reduce((sum, d) => sum + (d.attributes.AWR + d.attributes.TEC) / 2, 0) / _dropped.length
      : 50;
    fzBonus = clamp2(8 + (craft - 50) * 0.3, 5, 22);
  }
  // W4 (§16.2): the pocket factor from protection identity and (on fired
  // calls) the pressure×protection matchup table. The center's AWR sets the
  // half-slide.
  const _cAwr = (() => {
    var _a2;
    const cid = (offPersonnel.OL || [])[2];
    const cpl = cid ? offRoster.find((p) => p.id === cid) : null;
    const base = (_a2 = cpl == null ? void 0 : cpl.attributes.AWR) != null ? _a2 : 50;
    // Identity stage 3: Line General (center only) — the protection brain.
    // A small lift on the centerAwr term that sets the half-slide AND
    // counters stunt/cross timing (both read this one number downstream).
    return base + 2 * traitLv(cpl, "lineGeneral");
  })();
  // PASS 4 (mug, fired): the center's half-slide points are SPENT on the mug —
  // his AWR term is pulled toward 50 for this snap's protection math.
  const _cAwrEff = mugCall && result.blitzFired ? 50 + (_cAwr - 50) * _pfC.mugCawrMute : _cAwr;
  const protFactor = protectionFactor({ protId, identity: result.blitzFired ? result.pressCall || null : null, playType, blitzFired: result.blitzFired === true, centerAwr: _cAwrEff });
  // §16.2 (chip): on the middle protections a RELEASED back can bump the edge on
  // his way out — the third option (help, then release) between "block the whole
  // play" and "run a route." Half-Slide / BOB only; Quick's back is gone before
  // he could chip, Max Protect keeps him in as a full blocker.
  const chipAttrs = rbReleased && (protId === "halfSlide" || protId === "bob") && rbPlayers.length > 0 ? rbPlayers[0].attributes : null;
  // identity stage 3: the chipper's trait rides beside his attribute bag
  const chipTraitLv = chipAttrs ? traitLv(rbPlayers[0], "chipper") : 0;
  // P1-4 (chip help, Aug 2026): "Chip the edge" is the coach designing the
  // bump — the released back chips more reliably and hunts their BEST rusher
  // instead of whoever shows first. The cost lives at the checkdown rung.
  const chipCalled = (offPlan == null ? void 0 : offPlan.chipHelp) === "chip" && !!chipAttrs;
  // Signature package (§2): the front running ITS OWN blitz executes with the
  // angles it drills — a disguise bonus; borrowed heat costs a step.
  const sigAdj = result.blitzFired ? result.sigPress ? C.PRESS_SIG_BONUS : -C.PRESS_SIG_DOCK : 0;
  // PASS 4: amoeba's price on the rush — no hands down is a slower fire-off
  // when the swarm DOESN'T come (unfired snaps only; a fired amoeba is heat
  // like any other). Mug/cross ride the scheme arg into resolvePassRush.
  const _amoebaPocket = amoebaCall && !result.blitzFired ? _pfC.amoebaUnfiredPocket : 1;
  const rushResult = resolvePassRush(passRushers, blockers, blitzPct, defContextBoost, clamp2(((_p = defPlan.blitzDesign) != null ? _p : 50) + fzBonus + sigAdj, 0, 100), defPlan._dnaPressure || 0, ((offPlan == null ? void 0 : offPlan._h2Protect) ? 1 - offPlan._h2Protect.eff : 1) * edgeRushMult * protFactor * _amoebaPocket, paBite + (_gadget === "fleaflicker" ? 0.55 : _gadget === "hbpass" ? 0.35 : 0), Math.max(0, -(defPlan.runCommitEff || 0)), { olAwr: _cAwrEff, protId, chip: chipAttrs, chipTraitLv, chipCalled, mug: result.mug === "fired", game: result.crossDog ? "cross" : null, crossIds: result._crossIds || null });
  if (rushResult.crossFree) result.crossFree = true;
  if (!isScreen && !rushResult.sacked) {
    const depthMult = playType === "pass_short" ? C.BAT_SHORT_MULT : playType === "pass_deep" ? C.BAT_DEEP_MULT : 1;
    let batter = null;
    const atLine = passRushers.filter((r) => r.player && /^(DE|DT)/.test(r.role || "") && !rushResult.pressureIds.includes(r.player.id) && !rushResult.sackerIds.includes(r.player.id));
    for (const r of atLine) {
      const p = r.player;
      const ht = (_q = p.heightInches) != null ? _q : 74;
      const chance2 = clamp2(
        (C.BAT_BASE + Math.max(0, p.attributes.JMP - 50) * C.BAT_JMP_SCALE + Math.max(0, p.attributes.AWR - 50) * C.BAT_AWR_SCALE + Math.max(0, ht - 74) * C.BAT_HEIGHT_SCALE) * depthMult,
        0,
        C.BAT_CAP
      // identity stage 3: Bat Radar — the BAT_* machinery, this one roll
      ) * traitMult(p, "batRadar", 0.05);
      if (Math.random() < chance2) {
        batter = p;
        break;
      }
    }
    if (batter) {
      result.batted = true;
      result.battedById = batter.id;
      result.battedByName = `${(_t = (_s = (_r = batter.name) == null ? void 0 : _r.first) == null ? void 0 : _s[0]) != null ? _t : ""}. ${(_v = (_u = batter.name) == null ? void 0 : _u.last) != null ? _v : ""}`.trim();
      result.complete = false;
      result.yards = 0;
      if (Math.random() < C.BAT_TIP_INT) {
        const pool = passRushers.map((r) => r.player).filter(Boolean);
        // identity stage 3: Ball Hawk — the tipped ball finds the hawk's
        // hands (trait-weighted pick from the same pool, not a bigger pool)
        const wts0 = pool.map((pp) => 1 + 0.35 * traitLv(pp, "ballHawk"));
        let r0 = Math.random() * wts0.reduce((s, w) => s + w, 0);
        let pickIdx = 0;
        for (let wi = 0; wi < wts0.length; wi++) { r0 -= wts0[wi]; if (r0 <= 0) { pickIdx = wi; break; } }
        const picker2 = pool[pickIdx];
        if (picker2) {
          result.turnover = true;
          result.turnoverType = "interception";
          result.intPickerId = picker2.id;
        }
      }
      return result;
    }
  }
  if (isScreen) {
    result.isScreen = true;
    const jackpot = rushResult.sacked || rushResult.hurried && result.blitzFired;
    rushResult.sacked = false;
    const dl = passRushers.map((r) => r.player).filter(Boolean);
    const dlAWR = dl.length ? dl.reduce((s, p) => s + p.attributes.AWR, 0) / dl.length : 50;
    const scrEdgeAdj = ((defPlan == null ? void 0 : defPlan.edgePlayEff) === "contain" ? 0.05 : (defPlan == null ? void 0 : defPlan.edgePlayEff) === "crash" ? -0.04 : 0) + ((defPlan == null ? void 0 : defPlan.covStyleEff) === "zone" ? 0.03 : (defPlan == null ? void 0 : defPlan.covStyleEff) === "man" ? -0.02 : 0) + (!globalThis.__noCovFamilies && (defPlan == null ? void 0 : defPlan.rotationEff) === "cloud" ? 0.04 : 0);
    // identity stage 3: Screen Sniffer — the best nose for it on the line
    // beats the averaged-AWR anonymity of the old term
    const _snLv = dl.reduce((m, p) => Math.max(m, traitLv(p, "screenSniffer")), 0);
    const sniffChance = clamp2((jackpot ? 0.03 : 0.09) + (dlAWR - 50) * 22e-4 + scrEdgeAdj + 0.012 * _snLv, 0.02, 0.27);
    const rbId = (offPersonnel.RB || [])[0];
    const wrId = (offPersonnel.WR || [])[0];
    const scrTarget = forcedScreen === "rb" ? offRoster.find((p) => p.id === rbId) || offRoster.find((p) => p.id === wrId) : forcedScreen === "bubble" || forcedScreen === "tunnel" || forcedScreen === "slip" ? offRoster.find((p) => p.id === wrId) || offRoster.find((p) => p.id === rbId) : rbId && Math.random() < 0.72 ? offRoster.find((p) => p.id === rbId) : offRoster.find((p) => p.id === wrId);
    if (!scrTarget) {
      result.complete = false;
      return result;
    }
    result.targetId = scrTarget.id;
    if (Math.random() < sniffChance) {
      result.complete = Math.random() < 0.5;
      result.yards = result.complete ? Math.round(randNorm(-1, 2)) : 0;
      if (result.complete) {
        result.airYds = 0;
        result.yacYds = result.yards;
        result.receiverId = scrTarget.id;
        const stopper = pickTackler(dl.concat((defPersonnel.LB || []).map((id) => defRoster.find((p) => p.id === id)).filter(Boolean)));
        result.tacklerId = (_w = stopper == null ? void 0 : stopper.id) != null ? _w : null;
      }
      result.passDepth = "short";
      return result;
    }
    if (Math.random() < clamp2(0.9 + (scrTarget.attributes.HND - 50) * 1e-3, 0.8, 0.96)) {
      const pursuers = (defPersonnel.LB || []).concat(defPersonnel.DB || []).map((id) => defRoster.find((p) => p.id === id)).filter(Boolean);
      const base = jackpot ? randNorm(9.5, 6.5) : randNorm(4.5, 4);
      let yds = Math.max(-2, Math.round(base + (scrTarget.attributes.AGI - 55) * 0.06));
      // ── Fix D: downfield / stalk blocking springs the screen ──────────────
      // Source #50 (Shakin The Southland): a good stalk/crack block by the WRs
      // out front eliminates the playside tackler and springs the runner — it's
      // the offensive YAC lever the analytics sources omit, and the old screen
      // draw ignored it entirely. Grade the blocking receivers (the WRs NOT
      // carrying the ball) on STR/TEC/AWR vs the force defenders' shed; good
      // blocking adds perimeter yards, poor blocking gets the runner strung out.
      const blockers = (offPersonnel.WR || []).concat(offPersonnel.TE || [])
        .map((id) => offRoster.find((p) => p.id === id)).filter((p) => p && p.id !== scrTarget.id);
      const blockScore = blockers.length
        // identity stage 3: Blocking Receiver — the stalk-block machinery
        // that springs the screen is his craft
        ? blockers.reduce((s, p) => s + (p.attributes.STR * 0.4 + p.attributes.TEC * 0.35 + p.attributes.AWR * 0.25) * traitMult(p, "blockingWR", 0.015), 0) / blockers.length
        : 50;
      const forceDef = pursuers.length ? pursuers.reduce((s, p) => s + (p.attributes.STR * 0.5 + p.attributes.AWR * 0.5), 0) / pursuers.length : 50;
      const blockEdge = (blockScore - forceDef) * 0.075; // +/- a few yards on the block
      yds += Math.round(blockEdge);
      const firstMan = pickTackler(pursuers, jackpot ? 0.8 : 1.4);
      const styleOut = { style: null };
      if (firstMan && breaksTackle(scrTarget, firstMan, styleOut)) {
        result.brokenById = firstMan.id;
        result.brokenByCarrier = scrTarget.id;
        result.btStyle = styleOut.style;
        yds += Math.round(6 + Math.random() * (jackpot ? 22 : 10));
      }
      // Red-zone dropoff (PFF): inside the 20 the field is compressed — no grass
      // for a screen to spring, defenders sit on the sticks. Screen YAC collapses.
      if (fieldPos >= 80) yds = Math.round(yds * clamp2(0.55 + (100 - fieldPos) * 0.02, 0.4, 0.9));
      result.complete = true;
      result.yards = clamp2(yds, -3, 65);
      result.airYds = 0;
      result.yacYds = result.yards;
      result.receiverId = scrTarget.id;
      result.passDepth = "short";
      const stopper = pickTackler(pursuers);
      result.tacklerId = result.brokenById ? (_z = (_y = (_x = pickTackler(pursuers.filter((p) => p.id !== result.brokenById))) == null ? void 0 : _x.id) != null ? _y : stopper == null ? void 0 : stopper.id) != null ? _z : null : (_A = stopper == null ? void 0 : stopper.id) != null ? _A : null;
      return result;
    }
    result.complete = false;
    result.passDepth = "short";
    return result;
  }
  if ((offPlan == null ? void 0 : offPlan._forceFade) && !rushResult.sacked) {
    const recPool = [...offPersonnel.WR || [], ...offPersonnel.TE || []].map((id) => offRoster.find((p) => p.id === id)).filter(Boolean);
    const fadeFit = (p) => (p.attributes.JMP || 50) * 0.4 + (p.attributes.HND || 50) * 0.4 + (p.attributes.STR || 50) * 0.2;
    const ov = offPlan._fadeOverride || [];
    let target = null;
    for (const id of ov) {
      const p = recPool.find((x) => x.id === id);
      if (p) {
        target = p;
        break;
      }
    }
    if (!target) target = recPool.slice().sort((a, b) => fadeFit(b) - fadeFit(a))[0] || null;
    if (!target) {
      result.complete = false;
      result.passDepth = "deep";
      return result;
    }
    result.targetId = target.id;
    const cover = [...defPersonnel.CB || [], ...defPersonnel.S || []].map((id) => defRoster.find((p) => p.id === id)).filter(Boolean).sort((a, b) => (b.attributes.AWR || 50) - (a.attributes.AWR || 50))[0] || null;
    const covStyle = (defPlan == null ? void 0 : defPlan.covStyleEff) || (defPlan == null ? void 0 : defPlan.covStyle) || "balanced";
    const cbScore = cover ? (cover.attributes.AWR || 50) * 0.5 + (cover.attributes.JMP || 50) * 0.3 + (cover.attributes.SPD || 50) * 0.2 : 50;
    const htEdge = ((target.heightInches || 74) - (cover ? cover.heightInches || 71 : 71)) * 0.012;
    const covAdj = covStyle === "man" ? 0.1 : covStyle === "zone" ? -0.09 : 0.01;
    const qbAdj = (((qb == null ? void 0 : qb.attributes.TEC) != null ? qb.attributes.TEC : 50) - 50) * 4e-3;
    const catchP = clamp2(0.4 + (fadeFit(target) - cbScore) * 6e-3 + htEdge + covAdj + qbAdj + (rushResult.hurried ? -0.12 : 0), 0.1, 0.82);
    if (Math.random() < catchP) {
      result.complete = true;
      result.receiverId = target.id;
      result.yards = clamp2(Math.round(randNorm(11, 4)), 2, 32);
      result.airYds = result.yards;
      result.yacYds = 0;
      result.passDepth = "deep";
      result.tacklerId = cover ? cover.id : null;
    } else {
      result.complete = false;
      result.passDepth = "deep";
      if (cover && cbScore > fadeFit(target) + 12 && Math.random() < 0.06) {
        result.turnover = true;
        result.turnoverType = "interception";
        result.intPickerId = cover.id;
      } else if (cover) {
        result.pbuId = cover.id;
      }
    }
    return result;
  }
  if (!globalThis.__noTTT && qb && !rushResult.sacked) {
    const _tttDepth = playType === "pass_short" ? -1 : playType === "pass_deep" ? 1 : 0;
    if (_tttDepth !== 0) {
      const _tttMob = ((qb.attributes.SPD || 50) + (qb.attributes.AGI || 50)) / 2;
      const _tttBuy = clamp2(((qb.attributes.AWR || 50) - 50) / 100 + (_tttMob - 50) / 100, -0.3, 0.4);
      const _tttQuick = protId === "quick" ? 0.35 : 0;
      const _tttR = Math.random();
      if (_tttDepth === 1) {
        const _tttTax = clamp2(C.TTT_DEEP * (1 - _tttBuy) - _tttQuick, 0, 0.6);
        if (!rushResult.hurried && _tttR < _tttTax) {
          rushResult.hurried = true;
          if (!rushResult.pressureIds || !rushResult.pressureIds.length) {
            const _dl = (defPersonnel.DL || [])[0] || (defPersonnel.DE || [])[0] || null;
            rushResult.pressureIds = _dl ? [_dl] : [];
          }
        }
      } else {
        const _tttRelief = clamp2(C.TTT_SHORT + _tttQuick * 0.5, 0, 0.6);
        if (rushResult.hurried && _tttR < _tttRelief) rushResult.hurried = false;
      }
    }
  }
  if (rushResult.sacked) {
    const spyActive = defPlan.spyQB === true;
    // identity stage 3: Spy Eyes — the spy containment factor, sharpened by
    // the best-schooled backer on the field (same surface as the covSack leg)
    const _spyLv2 = spyActive ? (defPersonnel.LB || []).reduce((m, id) => {
      const p = defRoster.find((pl) => pl.id === id);
      return Math.max(m, traitLv(p, "spyEyes"));
    }, 0) : 0;
    const styleScrMult = ((defPlan == null ? void 0 : defPlan.covStyleEff) === "zone" ? 0.85 : (defPlan == null ? void 0 : defPlan.covStyleEff) === "man" ? 1.1 : 1) * ((defPlan == null ? void 0 : defPlan.optionKeyEff) === "qb" ? 0.85 : 1) * (!globalThis.__noCovFamilies && (defPlan == null ? void 0 : defPlan.covFamilyEff) === "Cover 2-Man" ? 1.15 : 1);
    const scrambleChance = (spyActive ? qbScrambleChance(qb) * 0.55 * (1 - 0.05 * _spyLv2) : qbScrambleChance(qb)) * styleScrMult;
    if (qb && Math.random() < scrambleChance) {
      if (!globalThis.__noScrThrow && (offPersonnel.WR || []).length) {
        const _scrAggr = _passCtx.qbAggr != null ? _passCtx.qbAggr : 50;
        // identity stage 3: Scramble Drill — the off-schedule throw is his play
        const _scrThrowP = clamp2(0.18 + ((qb.attributes.AWR || 50) - 50) / 100 * 0.3 + (_scrAggr - 50) / 100 * 0.3 + 0.03 * traitLv(qb, "scrambleDrill"), 0.05, 0.5);
        if (Math.random() < _scrThrowP) {
          const _scrWr = (offPersonnel.WR || []).map((id) => offRoster.find((p) => p.id === id)).filter(Boolean).sort((a, b) => (b.compositeRating || 0) - (a.compositeRating || 0))[0];
          const _scrDb = (defPersonnel.DB || []).map((id) => defRoster.find((p) => p.id === id)).filter(Boolean).sort((a, b) => (b.attributes.SPD || 0) - (a.attributes.SPD || 0))[0];
          if (_scrWr) {
            const _scrQb = (qb.attributes.TEC || 50) * 0.5 + (qb.attributes.AWR || 50) * 0.5;
            const _scrCov = _scrDb ? (_scrDb.attributes.AWR || 50) * 0.5 + (_scrDb.attributes.SPD || 50) * 0.5 : 50;
            const _scrCompP = clamp2(0.4 + (_scrQb - _scrCov) * 6e-3 + (_scrAggr - 50) / 100 * 0.05 + 0.02 * traitLv(qb, "scrambleDrill"), 0.15, 0.68);
            result.targetId = _scrWr.id;
            result.passDepth = "deep";
            result.isScrambleThrow = true;
            if (Math.random() < _scrCompP) {
              result.complete = true;
              result.receiverId = _scrWr.id;
              result.yards = clamp2(Math.round(randNorm(16, 7)), 4, 55);
              result.airYds = result.yards;
              result.yacYds = 0;
              result.tacklerId = _scrDb ? _scrDb.id : null;
            } else {
              result.complete = false;
              if (_scrDb && Math.random() < clamp2(0.05 + (_scrAggr - 50) / 100 * 0.05, 0.02, 0.12)) {
                result.turnover = true;
                result.turnoverType = "interception";
                result.intPickerId = _scrDb.id;
              }
            }
            return result;
          }
        }
      }
      const laneBase = spyActive ? 0.18 : 0.3;
      const scrambleLane = laneBase + Math.random() * 0.2;
      const sacker = ((_B = rushResult.sackerIds) == null ? void 0 : _B[0]) ? defRoster.find((p) => p.id === rushResult.sackerIds[0]) : null;
      const lbIdsInBox = (defPersonnel.LB || []).slice(0, Math.ceil((defPersonnel.LB || []).length / 2));
      const secondLevel = lbIdsInBox.map((id) => defRoster.find((p) => p.id === id)).filter(Boolean);
      const deepLevel = (defPersonnel.DB || []).slice(0, 3).map((id) => defRoster.find((p) => p.id === id)).filter(Boolean);
      const scrDL = (defPersonnel.DL || []).map((id) => defRoster.find((p) => p.id === id)).filter(Boolean);
      const scrOutcome = runOutcome(qb, scrambleLane, sacker, secondLevel, deepLevel, contextBoost, scrDL);
      const contact = qbContactResult(qb, scrOutcome);
      result.type = "run_scramble";
      result.yards = contact.yards;
      result.rusherId = qb.id;
      result.tacklerId = scrOutcome.tacklerId;
      result.assistId = scrOutcome.assistId;
      result.tflId = scrOutcome.tflId;
      result.brokenById = scrOutcome.brokenById;
      result.brokenByCarrier = scrOutcome.brokenById ? qb.id : null;
      result.breakaway = scrOutcome.breakaway || false;
      result.isScramble = true;
      result.qbSlid = contact.slid === true;
      result.qbInjured = contact.qbInjured;
      result.qbInjuryGames = contact.injuryGamesOut;
      return result;
    }
    result.sack = true;
    result.yards = -Math.max(2, Math.round(randNorm(6, 2)));
    result.sackerId = (_C = rushResult.sackerIds[0]) != null ? _C : null;
    result.sackerId2 = (_D = rushResult.sackerIds[1]) != null ? _D : null;
    result.pressureIds = rushResult.sackerIds.slice(0, 2);
    const qbHndMult = clamp2(1 - (qb.attributes.SEC * 0.85 + qb.attributes.TEC * 0.15 - 50) * C.FUMBLE_HND_SCALE, 0.45, 1.3) * traitMult(qb, "secureBag", -0.04) * flawMult(qb, "fumbler", 0.06);
    if (Math.random() < C.STRIP_SACK_RATE * qbHndMult) {
      result.turnover = Math.random() < 0.4;
      result.turnoverType = result.turnover ? "fumble" : null;
      if (result.turnover) result.ffId = result.sackerId;
    }
    return result;
  }
  if (!rushResult.sacked && rushResult.hurried && qb) {
    const spyActive = defPlan.spyQB === true;
    const styleScrMult2 = ((defPlan == null ? void 0 : defPlan.covStyleEff) === "zone" ? 0.85 : (defPlan == null ? void 0 : defPlan.covStyleEff) === "man" ? 1.1 : 1) * ((defPlan == null ? void 0 : defPlan.optionKeyEff) === "qb" ? 0.85 : 1) * (!globalThis.__noCovFamilies && (defPlan == null ? void 0 : defPlan.covFamilyEff) === "Cover 2-Man" ? 1.15 : 1);
    const baseScr = qbScrambleChance(qb) * 0.8 * styleScrMult2;
    const scrChance = spyActive ? baseScr * 0.5 : baseScr;
    if (Math.random() < scrChance) {
      const laneBase = spyActive ? 0.2 : 0.32;
      const scrambleLane = laneBase + Math.random() * 0.2;
      const lbIdsInBox = (defPersonnel.LB || []).slice(0, Math.ceil((defPersonnel.LB || []).length / 2));
      const secondLevel = lbIdsInBox.map((id) => defRoster.find((p) => p.id === id)).filter(Boolean);
      const deepLevel = (defPersonnel.DB || []).slice(0, 3).map((id) => defRoster.find((p) => p.id === id)).filter(Boolean);
      const scrDL2 = (defPersonnel.DL || []).map((id) => defRoster.find((p) => p.id === id)).filter(Boolean);
      const scrOutcome = runOutcome(qb, scrambleLane, null, secondLevel, deepLevel, contextBoost, scrDL2);
      const contact = qbContactResult(qb, scrOutcome);
      result.type = "run_scramble";
      result.yards = contact.yards;
      result.rusherId = qb.id;
      result.tacklerId = scrOutcome.tacklerId;
      result.assistId = scrOutcome.assistId;
      result.tflId = scrOutcome.tflId;
      result.brokenById = scrOutcome.brokenById;
      result.brokenByCarrier = scrOutcome.brokenById ? qb.id : null;
      result.breakaway = scrOutcome.breakaway || false;
      result.isScramble = true;
      result.qbSlid = contact.slid === true;
      result.qbInjured = contact.qbInjured;
      result.qbInjuryGames = contact.injuryGamesOut;
      return result;
    }
  }
  const pressureLevel = rushResult.hurried ? 1 : 0;
  let hurried = rushResult.hurried;
  if (rushResult.hurried && ((_E = rushResult.pressureIds) == null ? void 0 : _E.length)) result.pressureIds = rushResult.pressureIds.slice(0, 2);
  result.hurried = hurried;
  let passDepthKey = playType === "pass_short" ? "short" : playType === "pass_medium" ? "medium" : "deep";
  const covStyleLive = (_G = (_F = defPlan == null ? void 0 : defPlan.covStyleEff) != null ? _F : defPlan == null ? void 0 : defPlan.covStyle) != null ? _G : "balanced";
  const isZoneHeavy = covStyleLive === "zone" ? true : covStyleLive === "man" ? false : ["Nickel", "Dime", "3-4", "3-3-5", "Tite", "Big Nickel", "Penny"].includes(frontId);
  const DEPTHS = ["short", "medium", "deep"];
  const tiltFor = (pid) => {
    var _a2;
    const role = roleBySlotPlayer == null ? void 0 : roleBySlotPlayer[pid];
    const t = role ? (_a2 = C.ROUTE_TILT[role]) != null ? _a2 : 0 : 0;
    if (!t || Math.random() >= C.ROUTE_TILT_CHANCE) return passDepthKey;
    const i = DEPTHS.indexOf(passDepthKey);
    return DEPTHS[Math.max(0, Math.min(DEPTHS.length - 1, i + t))];
  };
  const receiversOnField = [];
  for (const id of offPersonnel.WR || []) {
    const p = offRoster.find((pl) => pl.id === id);
    if (p) receiversOnField.push({ receiverId: id, receiver: p, passDepth: tiltFor(id) });
  }
  for (const te of tePlayers) {
    if (!blockingTEIds.has(te.id)) {
      receiversOnField.push({ receiverId: te.id, receiver: te, passDepth: tiltFor(te.id) });
    }
  }
  if (rbPlayers.length > 0) {
    if (rbReleased) {
      // P1-4 cost (chip help): the CALLED chip is thrown by this released
      // back on his way out — while he's bumping the edge he isn't in the
      // pattern, so a real share of these snaps he never becomes a target.
      // The dial's bargain: a cooler rush, a thinner outlet.
      const _chipBusy = (offPlan == null ? void 0 : offPlan.chipHelp) === "chip" && (protId === "halfSlide" || protId === "bob") && Math.random() < 0.45;
      if (!_chipBusy) receiversOnField.push({
        receiverId: rbPlayers[0].id,
        receiver: rbPlayers[0],
        passDepth: passDepthKey === "deep" ? "medium" : passDepthKey
      });
    } else if (passDepthKey === "short") {
      receiversOnField.push({ receiverId: rbPlayers[0].id, receiver: rbPlayers[0], passDepth: "short" });
    } else {
      // P1-5 (checkdown emphasis, Aug 2026): NOT a new dial — the existing QB
      // leash shades the kept-in back's late leak into the flat. A
      // conservative setting (low qbAggr) keeps the outlet alive in the
      // progression; an aggressive one pushes the eyes downfield past it.
      // Neutral at 50 = the pre-pass game exactly.
      const _cdAggr = 1 + (50 - ((_passCtx == null ? void 0 : _passCtx.qbAggr) != null ? _passCtx.qbAggr : 50)) / 50 * 0.35;
      const cdKeep = globalThis.__noCheckdown ? (passDepthKey === "medium" ? 0.35 : 0) : clamp2(((passDepthKey === "medium" ? 0.32 : 0.16) + (((qb == null ? void 0 : qb.attributes.AWR) != null ? qb.attributes.AWR : 50) - 50) / 100 * 0.4) * _cdAggr, 0, 0.6);
      if (Math.random() < cdKeep) receiversOnField.push({ receiverId: rbPlayers[0].id, receiver: rbPlayers[0], passDepth: "short" });
    }
  }
  if (!receiversOnField.length) {
    result.complete = false;
    return result;
  }
  let keyId = null, bestThreat = -Infinity;
  for (const r of receiversOnField) {
    const p = offRoster.find((x) => x.id === r.receiverId);
    if (!p) continue;
    const share = (_H = shareByPlayerId == null ? void 0 : shareByPlayerId[r.receiverId]) != null ? _H : 0;
    const threat = ((_I = p.compositeRating) != null ? _I : 0) * (1 + share / 200);
    if (threat > bestThreat) {
      bestThreat = threat;
      keyId = r.receiverId;
    }
  }
  keyId = (_K = keyId != null ? keyId : (_J = offPersonnel.WR) == null ? void 0 : _J[0]) != null ? _K : null;
  {
    const who = (_M = (_L = defPlan.bracketWhoEff) != null ? _L : defPlan.bracketWho) != null ? _M : "auto";
    if (who === "te1") keyId = (_O = (_N = offPersonnel.TE) == null ? void 0 : _N[0]) != null ? _O : keyId;
    else if (who === "slot") keyId = (_S = (_R = (_P = offPersonnel.WR) == null ? void 0 : _P[2]) != null ? _R : (_Q = offPersonnel.WR) == null ? void 0 : _Q[1]) != null ? _S : keyId;
    else if (who === "hot" && defPlan._hotTargetId) keyId = defPlan._hotTargetId;
  }
  const coverageAssigned = assignCoverage(
    receiversOnField,
    defPersonnelCov,
    defRoster,
    frontId,
    isZoneHeavy,
    defPlan.coverageScheme || "balanced",
    keyId,
    blitzerDbId,
    _passCtx.pressLevel
  );
  result.covAssign = coverageAssigned.map((c) => ({ r: c.receiverId, d: c.defender ? c.defender.id : null, t: c.coverageType })).filter((c) => c.r && c.d);
  // ── PASS 5: choice-route post-assign (Ref/PASS5_OFFENSE_PLAN.md §C) ───────
  // The QB must AGREE with the conversion — a miscommunication is the ball
  // where the receiver isn't: separation collapses and the throw is priced as
  // forced (the INT-shaped downside that keeps the conversion mean-neutral).
  // A zone choice settles into the window for a tiny short-depth credit.
  if (!globalThis.__noChoiceRoutes) {
    for (const a of coverageAssigned) {
      if (!a.choice) continue;
      if (a.choice === "converted") {
        const misP = clamp2(0.1 - ((qb == null ? void 0 : qb.attributes.AWR) != null ? qb.attributes.AWR : 50) * 6e-4 - 0.02 * traitLv(a.receiver, "leverageReader") - 0.02 * traitLv(qb, "conflictReader"), 0.02, 0.15);
        if (Math.random() < misP) {
          a.separation = clamp2(a.separation - 0.25, 0, 1);
          a.choiceMis = true;
          a.choice = "mis";
        }
      } else if (a.choice === "settle") {
        a.separation = clamp2(a.separation + 0.02, 0, 1);
      }
      result.choiceRoute = a.choice;
      result.choiceReceiverId = a.receiverId;
      if (a.choice === "converted") result.choiceConvertedId = a.receiverId;
    }
  }
  let motionReadEdge = 0;
  {
    const MOTION_RATE = {
      "Trips/Bunch": 0.35,
      "Spread": 0.28,
      "Air Raid": 0.25,
      "Pistol/RPO": 0.22,
      "Power-I": 0.12,
      // Expansion five: Flexbone A-back motion is constant
      // (it's the formation's heartbeat); Wildcat lives on
      // the jet man. (Keep in sync with gameplan.js.)
      "Single Back": 0.22,
      "Empty": 0.3,
      "Wishbone": 0.1,
      "Flexbone": 0.45,
      "Wildcat": 0.4,
      "Jumbo": 0.06
    };
    const motionEff = clamp2(((_T = MOTION_RATE[offFormationId]) != null ? _T : 0.2) * (((_U = offPlan.motionRate) != null ? _U : 100) / 100), 0, 0.6);
    const calledMotion = !!(offPlan == null ? void 0 : offPlan._forceMotion);
    if ((calledMotion || Math.random() < motionEff) && coverageAssigned.length > 1) {
      const mover = coverageAssigned[1] || coverageAssigned[0];
      const styleMotionMult = (defPlan == null ? void 0 : defPlan.covStyleEff) === "man" ? 1.35 : (defPlan == null ? void 0 : defPlan.covStyleEff) === "zone" ? 0.65 : 1;
      // identity stage 3: Motion Weapon — separation from movement is his gift
      const motionGain = (0.035 + (calledMotion ? 0.02 : 0) + (mover.coverageType === "press" ? 0.035 : 0)) * styleMotionMult * (mover.receiver ? traitMult(mover.receiver, "motionWeapon", 0.06) : 1);
      mover.separation = clamp2(mover.separation + motionGain, 0, 1);
      const dbs = coverageAssigned.map((c) => c.defender).filter(Boolean);
      const dbAWR = dbs.length ? dbs.reduce((s, p) => s + p.attributes.AWR, 0) / dbs.length : 50;
      result.motion = true;
      result.motionManId = mover.receiverId;
      const motionMisreadP = motionMisreadProb(dbAWR, qb.attributes.AWR);
      const misread = Math.random() < motionMisreadP;
      motionReadEdge = misread ? -0.12 : 0.15;
      result._motionMisread = misread;
      const rawStyle = (defPlan == null ? void 0 : defPlan.covStyleEff) === "man" ? "man" : (defPlan == null ? void 0 : defPlan.covStyleEff) === "zone" ? "zone" : mover.coverageType === "man" || mover.coverageType === "press" ? "man" : "zone";
      result.motionReveal = misread ? rawStyle === "man" ? "zone" : "man" : rawStyle;
      // ── Fix F (motion reveal into the FULL read) ──────────────────────────
      // A correct motion read isn't just a scalar edge on the same progression —
      // it tells the QB the STRUCTURE, so he attacks the right thing. Reveal =
      // man → he hunts the best isolated one-on-one (the mismatch the motion
      // uncovered). Reveal = zone → he works the soft spot (a voided receiver,
      // else the most-open zone). A misread points him wrong. The nudge is
      // small and scales with the QB's AWR (a sharp processor turns the read
      // into an actual advantage). Gate: globalThis.__noMotionRead.
      if (!globalThis.__noMotionRead && !misread) {
        const readSharp = clamp2((qb.attributes.AWR - 55) / 60, 0, 0.5);
        const revealMan = result.motionReveal === "man";
        let target = null, bestVal = -Infinity;
        for (const a of coverageAssigned) {
          if (a === mover) continue;
          const isMan = a.coverageType === "man" || a.coverageType === "press" || a.coverageType === "offman";
          const val = revealMan
            ? (isMan && !a.bracketed ? a.separation : -1)
            : (a.coverageType === "zone" ? a.separation + (a.voided ? 0.2 : 0) : -1);
          if (val > bestVal) { bestVal = val; target = a; }
        }
        if (target && bestVal >= 0) {
          target.separation = clamp2(target.separation + readSharp * 0.05, 0, 1);
          // A realism LAYER, not a band mover. The pre-existing motionReadEdge
          // already banks most of the "correct read pays off" value; Fix F adds
          // the STRUCTURE — it steers the QB toward the specific man the motion
          // uncovered (iso vs void) instead of his default read. Kept small and
          // mean-neutral: it redistributes WHICH target is thrown, not the league
          // completion rate (stat_realism confirms no band moves). Its probe
          // proves the steer FIRES and the gate is clean, not a comp% delta —
          // honest about a mechanism whose aggregate effect is sub-probe.
          result._motionReadTargetId = target.receiverId;
          result._motionReadShare = 15 + readSharp * 40;
          result._motionStructRead = revealMan ? "iso" : "void";
        }
      }
    }
  }
  if (offPlan._rpoFlip) {
    const flipWin = _rpoCtx && Number.isFinite(_rpoCtx.pullEdge) ? _rpoCtx.pullEdge : (defPlan == null ? void 0 : defPlan.optionKeyEff) === "qb" ? 0.04 : 0.07;
    for (const a of coverageAssigned) a.separation = clamp2(a.separation + flipWin, 0, 1);
  }
  {
    const shell = (_V = defPlan == null ? void 0 : defPlan.covShellEff) != null ? _V : "balanced";
    const style = (_W = defPlan == null ? void 0 : defPlan.covStyleEff) != null ? _W : "balanced";
    const prot = (_X = offPlan == null ? void 0 : offPlan.protEmphasis) != null ? _X : 50;
    const aggr = (_Y = offPlan == null ? void 0 : offPlan.qbAggr) != null ? _Y : 50;
    let adj = 0;
    const sPlayers = (defPersonnel.S || []).map((id) => defRoster.find((pl) => pl.id === id)).filter(Boolean);
    const sAwr = sPlayers.length ? sPlayers.reduce((t, pl) => t + pl.attributes.AWR, 0) / sPlayers.length : 50;
    const shellExec = clamp2(0.6 + (sAwr - 40) / 50, 0.6, 1.4);
    if (shell === "two") adj += playType === "pass_deep" ? -0.05 * shellExec : playType === "pass_short" ? 0.02 : 0;
    if (shell === "single") adj += playType === "pass_deep" ? 0.04 / shellExec : playType === "pass_short" ? -0.02 : 0;
    adj += -(prot - 50) / 1400;
    adj += -(aggr - 50) / 2500;
    if (adj !== 0) for (const a of coverageAssigned) a.separation = clamp2(a.separation + adj, 0, 1);
  }
  if (paBite > 0) {
    // ── Fix E: play-action bites hardest vs a loaded box ──────────────────
    // PFF: play-action raises the YAC ceiling, ESPECIALLY against a 7-8 man box.
    // A defense that has committed to the run (runCommitEff > 0) has its second
    // level flowing downhill on the fake, so the same fake buys more separation —
    // and that separation is the pre-catch input that (via geoYAC) becomes YAC.
    // A two-high, pass-first look barely bites. Scales the boost by run commitment.
    const boxBite = 1 + Math.max(0, defPlan.runCommitEff || 0) * 0.03;
    // PASS 3 (buzz): the buzz safety's eyes are inside on the run fake's
    // landmark — he's the one man a good fake moves LESS (he was coming
    // downhill anyway, under control, reading his key).
    const rotPA = !globalThis.__noCovFamilies && defPlan.rotationEff === "buzz" && ((_conceptCtx == null ? void 0 : _conceptCtx.fam) === "Cover 3" || (_conceptCtx == null ? void 0 : _conceptCtx.fam) === "C3 Fire Zone") ? 0.85 : 1;
    for (const a of coverageAssigned) {
      a.separation = clamp2(a.separation + paBite * 0.075 * boxBite * rotPA, 0, 1);
    }
  }
  // PASS 5: the trick play's fake buys its separation deep — a run-committed
  // look chases the action; a disciplined two-high barely moves.
  if (gadgetBite > 0) {
    for (const a of coverageAssigned) {
      if (a.passDepth === "deep") a.separation = clamp2(a.separation + gadgetBite * 0.1, 0, 1);
    }
  }
  const rcCov = defPlan.runCommitEff || 0;
  if (rcCov) {
    for (const a of coverageAssigned) {
      a.separation = clamp2(a.separation + rcCov * C.RUNCOMMIT_COV_SCALE, 0, 1);
    }
  }
  // ── PASS 3: coverage-family & rotation mechanics ──────────────────────────
  // Each block is a small perturbation that exists ONLY when a named call put
  // the ingredient on the field (covFamilyEff / rotationEff) — absent, every
  // snap prices exactly as Pass 2. Kill-switch __noCovFamilies zeroes all of it.
  if (!globalThis.__noCovFamilies && (defPlan.covFamilyEff || defPlan.rotationEff)) {
    const famLive = defPlan.covFamilyEff || null;
    const rotLive = defPlan.rotationEff || null;
    const famResolved = (_conceptCtx == null ? void 0 : _conceptCtx.fam) || null;
    const _wr1 = (offPersonnel.WR || [])[0] || null;
    const _wr2 = (offPersonnel.WR || [])[1] || null;
    if (famLive === "Cover 6") {
      // Split field: cloud over the boundary (WR1) — hard corner in the flat,
      // half over the top; quarters to the field — deep denied, the flat
      // conceded (nobody buzzes it), and the quarters safety robs in-breakers
      // by assignment (the _qtrRob flag arms Fix D without its #2 trigger).
      for (const a of coverageAssigned) {
        if (a.receiverId === _wr1) {
          if (a.passDepth === "short") a.separation = clamp2(a.separation - C.C6_CLOUD_WR1_SHORT, 0, 1);
          else if (a.passDepth === "deep") a.separation = clamp2(a.separation - 0.03, 0, 1);
        } else {
          if (a.passDepth === "deep") a.separation = clamp2(a.separation - 0.03, 0, 1);
          else if (a.passDepth === "short") a.separation = clamp2(a.separation + 0.02, 0, 1);
          else {
            // The quarters safety drives on the in-breaker BY ASSIGNMENT —
            // no #2-vertical read to wait on. The shave is the undercut; the
            // _qtrRob flag additionally arms the Fix-D robber (its INT
            // machinery) on the throws the stock trigger would let sit.
            a._qtrRob = true;
            if (a.breakIn) a.separation = clamp2(a.separation - 0.035, 0, 1);
          }
        }
      }
    } else if (famLive === "Tampa 2") {
      // The pole runner: the rangiest backer carries the deep middle — the
      // classic Tampa hole between the halves closes as far as HIS legs can
      // close it (a slow Mike leaves it open; that's the scheme's whole tax
      // on personnel). The hook he vacated is the offense's consolation.
      let mike = null, mv = -Infinity;
      for (const id of defPersonnel.LB || []) {
        const p = defRoster.find((pl) => pl.id === id);
        if (!p) continue;
        const v = p.attributes.SPD * 0.55 + p.attributes.AWR * 0.45;
        if (v > mv) {
          mv = v;
          mike = p;
        }
      }
      const poleQ = mike ? clamp2((mv - 50) / 50, -0.3, 0.5) : -0.3;
      for (const a of coverageAssigned) {
        const inside = a.receiverId !== _wr1 && a.receiverId !== _wr2;
        if (a.passDepth === "deep" && inside) a.separation = clamp2(a.separation - 0.05 * (1 + poleQ), 0, 1);
        else if (a.passDepth === "medium" && a.landmark === "seam/hook") a.separation = clamp2(a.separation + 0.03, 0, 1);
      }
      if (mike) result._pole = mike.id;
    } else if (famLive === "Cover 2-Man") {
      // Trail technique under the halves: everything short/medium is
      // contested at the catch point. The tax (backs to the QB) is priced at
      // the scramble rungs via _famScrMult.
      for (const a of coverageAssigned) {
        if (a.passDepth !== "deep") a.separation = clamp2(a.separation - 0.03, 0, 1);
      }
    } else if (famLive === "Prevent") {
      // The umbrella: nothing behind it, everything in front of it.
      for (const a of coverageAssigned) {
        if (a.passDepth === "deep") a.separation = clamp2(a.separation - 0.1, 0, 1);
        else if (a.passDepth === "medium") a.separation = clamp2(a.separation + 0.02, 0, 1);
        else a.separation = clamp2(a.separation + 0.05, 0, 1);
      }
    }
    // Rotations (owner call): single-high zone only — the Sky/Cloud/Buzz
    // force rules have no meaning outside Cover 3's structure; inert elsewhere.
    if (rotLive && (famResolved === "Cover 3" || famResolved === "C3 Fire Zone")) {
      for (const a of coverageAssigned) {
        const boundary = a.receiverId === _wr1;
        if (rotLive === "sky") {
          if (a.passDepth === "short" && !boundary) a.separation = clamp2(a.separation - 0.02, 0, 1);
          else if (a.passDepth === "deep") a.separation = clamp2(a.separation + 0.015, 0, 1);
        } else if (rotLive === "cloud") {
          if (a.passDepth === "short" && boundary) a.separation = clamp2(a.separation - C.ROT_CLOUD_SHORT, 0, 1);
        } else if (rotLive === "buzz") {
          if (a.passDepth === "medium" && a.breakIn) a.separation = clamp2(a.separation - 0.03, 0, 1);
          else if (a.passDepth === "deep") a.separation = clamp2(a.separation + 0.01, 0, 1);
        }
      }
      result.rotation = rotLive;
    }
  }
  const wrOrder = offPersonnel.WR || [];
  const teOrder = offPersonnel.TE || [];
  const rbOrder = offPersonnel.RB || [];
  function shareSlot(receiverId) {
    const wrIdx = wrOrder.indexOf(receiverId);
    if (wrIdx === 0) return "WR1";
    if (wrIdx === 1) return "WR2";
    if (wrIdx >= 2) return "WR3";
    if (teOrder.indexOf(receiverId) >= 0) return "TE1";
    if (rbOrder.indexOf(receiverId) >= 0) return "RB1";
    return "WR3";
  }
  const shares = offPlan.targetShares || {};
  const targets = coverageAssigned.map((c) => {
    var _a2, _b2;
    return {
      receiverId: c.receiverId,
      receiver: c.receiver,
      defender: c.defender,
      coverageType: c.coverageType,
      separation: c.separation,
      bracketed: c.bracketed || c.locked || false,
      passDepth: c.passDepth,
      breakIn: c.breakIn || false,
      routeShape: c.routeShape || null,
      routeDbl: c.routeDbl || false,
      voided: c.voided || false,
      busted: c.busted || false,
      _qtrRob: c._qtrRob || false,
      landmark: (_a2 = c.landmark) != null ? _a2 : null,
      // Per-slot share (field assignments) takes priority; else legacy bucket.
      // Fix F: a correct motion read steers the QB to the uncovered man — lift
      // that receiver's read priority so the progression actually finds him.
      shareWeight: result._motionReadTargetId === c.receiverId ? Math.max(result._motionReadShare || 15, shareByPlayerId && shareByPlayerId[c.receiverId] != null ? shareByPlayerId[c.receiverId] : (_b2 = shares[shareSlot(c.receiverId)]) != null ? _b2 : 15) : (shareByPlayerId && shareByPlayerId[c.receiverId] != null ? shareByPlayerId[c.receiverId] : (_b2 = shares[shareSlot(c.receiverId)]) != null ? _b2 : 15)
    };
  });
  // ── W4 (§2): THE COVERAGE COST OF PRESSURE ────────────────────────────────
  // The bargain both the sources and the sim are built on: the more you send,
  // the fewer you have to cover. When a blitz fires, coverage thins — and HOW
  // MUCH depends on the identity's risk tier (deepRisk: fire zone keeps the
  // structure sound, secondary heat leaves a hole where the DB was, the House
  // is a zero blitz with nobody deep). A good coordinator disguises it (his
  // Blitz Design shrinks the window); pressure-DNA staffs give up less.
  if (result.blitzFired && targets.length > 0) {
    const spec2 = C.PRESS_IDENTITY[result.pressCall] || C.PRESS_IDENTITY.secondLevel;
    const deepRisk = spec2.deepRisk != null ? spec2.deepRisk : 1;
    const disguise = 1 - (((_Z = defPlan == null ? void 0 : defPlan.blitzDesign) != null ? _Z : 50) - 50) / 150;
    const dnaPressureCov = 1 - ((defPlan == null ? void 0 : defPlan._dnaPressure) || 0) * 0.015;
    // Extra rushers beyond the base four thin the coverage further.
    const extraRush = Math.max(0, (result.rushN != null ? result.rushN : 4) - 4);
    const byDepth = (rank) => targets.filter((t) => (t.passDepth === "deep" ? 3 : t.passDepth === "medium" ? 2 : 1) === rank);
    const deeps = byDepth(3), meds = byDepth(2);
    const openMost = (pool) => pool.reduce((a, b) => a && a.separation >= b.separation ? a : b, null);
    // The primary hole: a DB in the rush (secondary heat/house) vacates deep;
    // a pure backer blitz (second level/fire zone) opens the middle underneath.
    const primaryPool = spec2.db ? (deeps.length ? deeps : meds) : (meds.length ? meds : deeps);
    const primary = openMost(primaryPool);
    const base = 0.11 + 0.05 * extraRush;
    if (primary) primary.separation = clamp2(primary.separation + base * deepRisk * disguise * dnaPressureCov, 0, 1);
    // The zero blitz (The House): no deep safety — a SECOND man comes open over
    // the top. This is the call's whole risk: when it doesn't get home, it's six.
    if (result.zeroBehind) {
      const second = openMost(deeps.filter((t) => t !== primary).concat(meds.filter((t) => t !== primary)));
      if (second) second.separation = clamp2(second.separation + 0.12 * disguise * dnaPressureCov, 0, 1);
    }
  }
  // ── PASS 4: the flavors' post-snap coverage truth ─────────────────────────
  // A mug that BAILS sinks both bluff bodies into the low hole — the easy
  // short/medium throw is exactly what they land on. A fired CROSS has both
  // backers in the wash — no underneath rally, the checkdown lives.
  if (result.mug === "bail" && targets.length > 0) {
    const low = targets.filter((t) => t.passDepth === "short" || t.passDepth === "medium").sort((a, b) => b.separation - a.separation);
    if (low[0]) low[0].separation = clamp2(low[0].separation - _pfC.mugBailSqueeze, 0, 1);
    if (low[1]) low[1].separation = clamp2(low[1].separation - _pfC.mugBailSqueeze / 2, 0, 1);
  }
  if (result.crossDog && targets.length > 0) {
    const shorts = targets.filter((t) => t.passDepth === "short").sort((a, b) => b.separation - a.separation);
    if (shorts[0]) shorts[0].separation = clamp2(shorts[0].separation + _pfC.crossCheckdown, 0, 1);
  }
  if ((defPlan == null ? void 0 : defPlan._h2Shadow) && targets.length > 0) {
    for (const t of targets) {
      if (((__ = t.receiver) == null ? void 0 : __.id) === defPlan._h2Shadow.id) t.separation = clamp2(t.separation - defPlan._h2Shadow.eff, 0, 1);
    }
  }
  // ── W4 (§2): THE QB'S HOT ANSWER TO THE BLITZ ─────────────────────────────
  // The sources' #1 counter to pressure: a heads-up quarterback reads the blitz
  // pre-snap, finds the man it left uncovered, and gets the ball out before the
  // free rusher arrives. A sharp QB (AWR/TEC) beats an unsound blitz; a raw one
  // eats it. Quick-game protection makes the hot throw easier still. This only
  // helps on a FIRED blitz — it's the answer to pressure, not free offense.
  let hotThrow = false;
  if (result.blitzFired && targets.length > 0 && qb) {
    const _qbHot = ((qb.attributes.AWR || 50) * 0.6 + (qb.attributes.TEC || 50) * 0.4 - 50) / 50;
    const _quick = protId === "quick" ? 0.18 : protId === "bob" ? 0.06 : 0;
    // Disguise fights the read: a well-designed blitz (Blitz Design) is seen late.
    // PASS 4: a MUG hides which of six is real; an AMOEBA hides where the heat
    // even lives — both make the hot ID harder on fired snaps.
    const _disg = (((defPlan == null ? void 0 : defPlan.blitzDesign) != null ? defPlan.blitzDesign : 50) - 50) / 200 + (mugCall ? _pfC.mugHotDisg : amoebaCall ? _pfC.amoebaHot : 0);
    // identity stage 3: Blitz Beater — the hot-throw machinery is HIS answer
    const hotChance = clamp2(0.3 + _qbHot * 0.42 + _quick - _disg + 0.03 * traitLv(qb, "blitzBeater"), 0.05, 0.85);
    if (Math.random() < hotChance) {
      hotThrow = true;
      // He finds the opened man: the most-separated target becomes the read...
      let hotMan = null, hotSep = -1;
      for (const t of targets) if (t.separation > hotSep) {
        hotSep = t.separation;
        hotMan = t;
      }
      if (hotMan) hotMan.shareWeight = Math.max(hotMan.shareWeight != null ? hotMan.shareWeight : 15, 60);
      // ...and the ball is out on rhythm, so the free rusher's hurry doesn't bite.
      if (hurried) {
        hurried = false;
        result.hurried = false;
      }
    }
  }
  let chosen = qbRead(targets, hotThrow ? 0 : pressureLevel, qb, motionReadEdge);
  if (!chosen) {
    return result;
  }
  // ── Fix B (prototype, Aug 2026): AWR-gated coverage sack / throwaway ─────────
  // When the read collapses under pressure (nobody above minSep AND the QB is
  // hurried — the would-be hold/sack), branch on awareness. A heads-up QB throws
  // it away (clean incompletion: no sack, no INT — self-preservation). A raw QB
  // does NOT default to eating the sack: he's weighted toward FORCING a throw,
  // mostly a checkdown/short completion (protects comp%, stays out of the sack
  // column), with a small residual coverage sack and an occasional forced ball
  // into coverage that can be intercepted (feeds INT%). Gate: __noCovSack.
  let covSackForce = false;
  const _covCovered = chosen._bestSep != null ? chosen._bestSep < C.COVSACK_COVERED_SEP : chosen._readCollapsed;
  // ── M3 (D6, 2026-08-17, ratified §7.5): the CLEAN-POCKET take-off ────────
  // When nobody gets open but the pocket is CLEAN, a mobile QB looks for the
  // grass the extra coverage left behind — the more bodies the defense
  // dropped, the fewer rushed, the bigger the escape lane. Coverage-
  // conditioned (family grass factor), mobility-scaled via qbScrambleChance
  // (a statue almost never takes off), spy/optionKey=qb tighten it, and the
  // CLEAN_SCRAMBLE_MULT is tuned so ~75% of all scrambles stay pressure-
  // coupled (PFF's charting). __noCleanScramble kills the rung.
  const _cpTight = chosen._bestSep != null ? clamp2((C.CLEAN_COVERED_SEP - chosen._bestSep) / 0.28, 0, 1) : chosen._readCollapsed ? 1 : 0;
  if (!globalThis.__noCleanScramble && qb && !hurried && _cpTight > 0 && !hotThrow) {
    const _cpFam = (_conceptCtx == null ? void 0 : _conceptCtx.fam) || null;
    const _cpGrass = _cpFam === "Prevent" ? 1.6 : _cpFam === "Cover 4" || _cpFam === "Cover 6" || _cpFam === "Tampa 2" || _cpFam === "Cover 2" ? 1.25 : _cpFam === "Cover 2-Man" ? 1.05 : _cpFam === "Cover 0" || _cpFam === "C3 Fire Zone" ? 0.5 : 1;
    const _cpSpy = defPlan.spyQB === true;
    const _cpSpyLv = _cpSpy ? (defPersonnel.LB || []).reduce((m, id) => {
      const p = defRoster.find((pl) => pl.id === id);
      return Math.max(m, traitLv(p, "spyEyes"));
    }, 0) : 0;
    const _cpStyle = ((defPlan == null ? void 0 : defPlan.covStyleEff) === "zone" ? 0.85 : (defPlan == null ? void 0 : defPlan.covStyleEff) === "man" ? 1.1 : 1) * ((defPlan == null ? void 0 : defPlan.optionKeyEff) === "qb" ? 0.85 : 1);
    const _cpChance = qbScrambleChance(qb) * C.CLEAN_SCRAMBLE_MULT * _cpTight * _cpGrass * _cpStyle * (_cpSpy ? 0.45 * (1 - 0.05 * _cpSpyLv) : 1) * traitMult(qb, "pocketPresence", 0.03);
    if (Math.random() < _cpChance) {
      const _cpLane = (_cpSpy ? 0.22 : 0.36) + Math.random() * 0.2;
      const _cpLbBox = (defPersonnel.LB || []).slice(0, Math.ceil((defPersonnel.LB || []).length / 2));
      const _cpSecond = _cpLbBox.map((id) => defRoster.find((p) => p.id === id)).filter(Boolean);
      const _cpDeep = (defPersonnel.DB || []).slice(0, 3).map((id) => defRoster.find((p) => p.id === id)).filter(Boolean);
      const _cpDL = (defPersonnel.DL || []).map((id) => defRoster.find((p) => p.id === id)).filter(Boolean);
      const _cpOut = runOutcome(qb, _cpLane, null, _cpSecond, _cpDeep, contextBoost, _cpDL);
      const _cpContact = qbContactResult(qb, _cpOut);
      result.type = "run_scramble";
      result.yards = _cpContact.yards;
      result.rusherId = qb.id;
      result.tacklerId = _cpOut.tacklerId;
      result.assistId = _cpOut.assistId;
      result.tflId = _cpOut.tflId;
      result.brokenById = _cpOut.brokenById;
      result.brokenByCarrier = _cpOut.brokenById ? qb.id : null;
      result.breakaway = _cpOut.breakaway || false;
      result.isScramble = true;
      result.cleanScramble = true;
      result.qbSlid = _cpContact.slid === true;
      result.qbInjured = _cpContact.qbInjured;
      result.qbInjuryGames = _cpContact.injuryGamesOut;
      return result;
    }
  }
  if (!globalThis.__noCovSack && qb && hurried && _covCovered && !hotThrow) {
    // Dual-threat escape (first, before the AWR split): a mobile QB flushed onto a
    // covered field takes off rather than eating the coverage sack — a second,
    // covered-conditioned scramble look, mobility-scaled via qbScrambleChance. A
    // statue almost never escapes here; a scrambler often does. Reuses the run-
    // scramble outcome path. Zero it with C.COVSACK_SCRAMBLE_MULT = 0.
    const _escSpy = defPlan.spyQB === true;
    // identity stage 3: Spy Eyes — when a spy is on, the best-schooled backer
    // tightens the containment (this factor is the spy mechanism's surface)
    const _spyLv = _escSpy ? (defPersonnel.LB || []).reduce((m, id) => {
      const p = defRoster.find((pl) => pl.id === id);
      return Math.max(m, traitLv(p, "spyEyes"));
    }, 0) : 0;
    const _escStyle = ((defPlan == null ? void 0 : defPlan.covStyleEff) === "zone" ? 0.85 : (defPlan == null ? void 0 : defPlan.covStyleEff) === "man" ? 1.1 : 1) * ((defPlan == null ? void 0 : defPlan.optionKeyEff) === "qb" ? 0.85 : 1) * (!globalThis.__noCovFamilies && (defPlan == null ? void 0 : defPlan.covFamilyEff) === "Cover 2-Man" ? 1.15 : 1);
    // identity stage 3: Pocket Presence buys escapes; Hero Ball (flaw) chases
    // them — the splash half of a two-sided coin whose disaster half is below.
    const _escChance = qbScrambleChance(qb) * C.COVSACK_SCRAMBLE_MULT * _escStyle * (_escSpy ? 0.5 * (1 - 0.05 * _spyLv) : 1) * traitMult(qb, "pocketPresence", 0.05) * flawMult(qb, "heroBall", 0.05);
    if (Math.random() < _escChance) {
      const _escLane = (_escSpy ? 0.2 : 0.32) + Math.random() * 0.2;
      const _escLbBox = (defPersonnel.LB || []).slice(0, Math.ceil((defPersonnel.LB || []).length / 2));
      const _escSecond = _escLbBox.map((id) => defRoster.find((p) => p.id === id)).filter(Boolean);
      const _escDeep = (defPersonnel.DB || []).slice(0, 3).map((id) => defRoster.find((p) => p.id === id)).filter(Boolean);
      const _escDL = (defPersonnel.DL || []).map((id) => defRoster.find((p) => p.id === id)).filter(Boolean);
      const _escOut = runOutcome(qb, _escLane, null, _escSecond, _escDeep, contextBoost, _escDL);
      const _escContact = qbContactResult(qb, _escOut);
      result.type = "run_scramble";
      result.yards = _escContact.yards;
      result.rusherId = qb.id;
      result.tacklerId = _escOut.tacklerId;
      result.assistId = _escOut.assistId;
      result.tflId = _escOut.tflId;
      result.brokenById = _escOut.brokenById;
      result.brokenByCarrier = _escOut.brokenById ? qb.id : null;
      result.breakaway = _escOut.breakaway || false;
      result.isScramble = true;
      result.covScramble = true;
      result.qbSlid = _escContact.slid === true;
      result.qbInjured = _escContact.qbInjured;
      result.qbInjuryGames = _escContact.injuryGamesOut;
      return result;
    }
    const _awr = (qb.attributes.AWR != null ? qb.attributes.AWR : 50);
    // identity stage 3: Pocket Presence throws it away in time; Hero Ball
    // won't — the disaster half (more forced balls, more coverage sacks).
    const _throwAwayP = clamp2(0.5 + (_awr - C.COVSACK_AWR_PIVOT) * C.COVSACK_AWR_SCALE + 0.03 * traitLv(qb, "pocketPresence") - 0.06 * flawLv(qb, "heroBall"), 0.05, 0.95);
    if (Math.random() < _throwAwayP) {
      result.complete = false;
      result.passDepth = passDepthKey;
      result.throwAway = true;
      result.targetId = chosen.receiverId;
      result.throwerId = (_aa = qb == null ? void 0 : qb.id) != null ? _aa : null;
      return result;
    }
    const _fr = Math.random();
    if (_fr < C.COVSACK_FORCE_SACK) {
      result.sack = true;
      result.coverageSack = true;
      result.yards = -Math.max(2, Math.round(randNorm(6, 2)));
      const _csk = (rushResult.pressureIds && rushResult.pressureIds[0]) || (defPersonnel.DL || [])[0] || (defPersonnel.DE || [])[0] || null;
      result.sackerId = _csk;
      result.pressureIds = _csk ? [_csk] : [];
      result.throwerId = (_aa = qb == null ? void 0 : qb.id) != null ? _aa : null;
      return result;
    } else if (_fr < C.COVSACK_FORCE_SACK + C.COVSACK_FORCE_SHORT) {
      // Forced checkdown: re-aim at the shortest outlet (RB first, else min-depth
      // route) as a high-completion short ball. Re-scored as a short throw.
      const _rank = (t) => DEPTHS.indexOf(t.passDepth || passDepthKey);
      const _cd = targets.filter((t) => { var _r; return ((_r = t.receiver) == null ? void 0 : _r.position) === "RB"; }).sort((a, b) => b.separation - a.separation)[0] || targets.slice().sort((a, b) => (_rank(a) - _rank(b)) || (b.separation - a.separation))[0];
      if (_cd) {
        chosen = _cd;
        passDepthKey = "short";
        result.forcedCheckdown = true;
      } else {
        covSackForce = true;
      }
    } else {
      // Residual: force it into coverage on the collapsed read (chosen stays put);
      // covSackForce elevates it to a forced throw so the INT ledger sees it.
      covSackForce = true;
    }
  }
  if (result.blitzFired) result.hotThrow = hotThrow;
  result.targetId = chosen.receiverId;
  if (result._motionMisread === true) chosen.separation = clamp2(chosen.separation - 0.07, 0, 1);
  else if (result._motionMisread === false) chosen.separation = clamp2(chosen.separation + 0.02, 0, 1);
  const receiverObj = chosen.receiver;
  const coveringDef = chosen.defender;
  const sep = chosen.separation;
  const avgShare = 15;
  const chosenShare = (_$ = chosen.shareWeight) != null ? _$ : avgShare;
  const forced = (covSackForce && !result.forcedCheckdown) || (chosenShare > avgShare * 1.6 && (chosen.bracketed || chosen.separation < 0.4)) || !!chosen.choiceMis;
  // identity stage 3: Drops (flaw) — the drop machinery, this one number
  const dropProb = clamp2(C.DROP_BASE - receiverObj.attributes.HND * C.DROP_HND_SCALE, 0.015, 0.08) * flawMult(receiverObj, "drops", 0.15);
  let helper = null;
  if (passDepthKey !== "short" && defPersonnel) {
    let best = 0;
    for (const id of defPersonnel.DB || []) {
      if (!id || id === (coveringDef == null ? void 0 : coveringDef.id)) continue;
      const d = defRoster.find((p) => p.id === id);
      if (!d || d.position !== "S") continue;
      const range = d.attributes.SPD * 0.5 + d.attributes.AWR * 0.5;
      if (range > best) {
        best = range;
        helper = d;
      }
    }
  }
  const inRhythm = !hurried && chosen._firstRead && !offPlan._fooled;
  // identity stage 3: Rhythm Passer — the first-read timing bonus is his game
  let rhythmSep = inRhythm ? clamp2(sep + (qb.attributes.TEC - 50) * 12e-4 + 4e-3 * traitLv(qb, "rhythmPasser"), 0, 1) : sep;
  // ── Fix D (Quarters / robber #2-read) ─────────────────────────────────────
  // In a two-high shell the safety reads #2. If #2 releases VERTICAL, he plays
  // the "2-to-1" robber: he snaps off #2 and undercuts #1's in-breaker (dig /
  // slant / post). The result on THAT throw is a shrunk window and a live
  // interception threat — the mechanism that makes two-high deny in-breakers
  // and pick jumped routes. Fires only when: two-high, a vertical #2 to hold
  // his read, the chosen ball is a medium in-breaker, and there's a safety to
  // rob with. His discipline/range (AWR/SPD) sets how much he robs; the QB's
  // AWR (looking him off) fights it. Gate: globalThis.__noRobber.
  // P1-2 (robber call, Aug 2026): the coach's thumb on the two-high safety.
  // "Rob the middle" turns the read-and-rob loose (stronger undercut) — and
  // pays the honest price: a helper cheating downhill is a helper who isn't
  // capping the deep shot. "Stay over top" glues the lid on: no robber, ever,
  // and deep balls into two-high find a little less grass. Auto = today.
  const robCall = (defPlan == null ? void 0 : defPlan.robberCallEff) || "auto";
  let robber = null;
  if (!globalThis.__noRobber && robCall !== "overtop" && (defPlan == null ? void 0 : defPlan.covShellEff) === "two" && chosen.breakIn && helper) {
    // Auto: the safety reads #2 — a vertical must hold his eyes before he
    // robs. CALLED rob: he's hunting the in-breaker by assignment, vertical
    // or not — that's the point of the call, and why the deep tax below is
    // unconditional while it's on.
    const twoVert = robCall === "rob" || !globalThis.__noCovFamilies && (defPlan == null ? void 0 : defPlan.covFamilyEff) === "Cover 6" && chosen._qtrRob === true || targets.some((t) => t !== chosen && (t.passDepth === "deep" || (t.passDepth === "medium" && t.routeShape === "speed")));
    if (twoVert) {
      // Identity stage 3: Robber (S) strengthens the undercut itself; Eye
      // Manipulator (QB) fattens the lookoff term that moves him; Telegraph
      // (QB flaw) gives the break away — his eyes feed the robber.
      const rob = (helper.attributes.AWR * 0.6 + helper.attributes.SPD * 0.4) * traitMult(helper, "robber", 0.02);
      const lookoff = (qb.attributes.AWR - 50) * 0.5 + 2.5 * traitLv(qb, "eyeManipulator") - 3 * flawLv(qb, "telegraph");
      const robStrength = clamp2((rob - 55 - lookoff) / 100 * (robCall === "rob" ? 1.6 : 1), 0, 0.5);
      if (robStrength > 0.02) {
        robber = helper;
        rhythmSep = clamp2(rhythmSep - robStrength * 0.18, 0, 1);
        result._robber = true;
      }
    }
  }
  if ((defPlan == null ? void 0 : defPlan.covShellEff) === "two" && chosen.passDepth === "deep") {
    if (robCall === "rob") rhythmSep = clamp2(rhythmSep + 0.06, 0, 1);
    else if (robCall === "overtop") rhythmSep = clamp2(rhythmSep - 0.03, 0, 1);
  }
  const passKey = Math.max(0, -(defPlan.runCommitEff || 0));
  // ── Capstone P1 (Aug 2026): the play TRACE ────────────────────────────────
  // What the sim actually computed for the CHOSEN throw, recorded compactly so
  // the viewer can render the real play instead of synthesizing one. Stamped
  // before the catch resolves so incompletions and picks carry it too — an
  // incompletion is still a real throw to a real man at a real moment. Pure
  // recording: nothing here feeds back into any outcome.
  result.trace = {
    sep: Math.round(rhythmSep * 100) / 100,
    dep: chosen.passDepth || null,
    shape: chosen.routeShape || null,
    dbl: chosen.routeDbl ? 1 : 0,
    vd: chosen.voided ? 1 : 0,
    bust: chosen.busted ? 1 : 0,
    ct: chosen.coverageType || null,
    rob: robber ? robber.id : null
  };
  const catchResult = catchResolution(rhythmSep, qb, coveringDef, passDepthKey, hurried, receiverObj, chosen.bracketed, forced, robber || helper, passKey, !!robber);
  if (catchResult.contested != null) result.contested = catchResult.contested;
  if (!catchResult.complete) {
    if (Math.random() < dropProb) {
      result.complete = false;
      result.passDepth = passDepthKey;
      return result;
    }
    if (catchResult.int) {
      result.turnover = true;
      result.turnoverType = "interception";
      result.passDepth = passDepthKey;
      result.intPickerId = catchResult.intPickerId;
    } else if (catchResult.pbu) {
      result.pbuId = catchResult.pbuId;
      // ── Tip-drill chain (M25) ───────────────────────────────────────────
      // The swatted ball caroms; the deep helper / robber — a second man who
      // was genuinely on the play — can pick it out of the air. PBU stays
      // with the tipper, the INT books to the catcher (ballSlots stamps
      // both, so the viewer can render tip THEN pick). Gate: __noTipDrill.
      const tipMan = robber || helper;
      if (!globalThis.__noTipDrill && tipMan && tipMan.id !== catchResult.pbuId) {
        const hawkMult = 1 + 0.35 * traitLv(tipMan, "ballHawk");
        if (Math.random() < C.TIP_DRILL_INT * hawkMult) {
          result.turnover = true;
          result.turnoverType = "interception";
          result.passDepth = passDepthKey;
          result.intPickerId = tipMan.id;
          result.tipDrill = true;
        }
      }
    }
    result.throwerId = (_aa = qb == null ? void 0 : qb.id) != null ? _aa : null;
    return result;
  }
  // identity stage 3: Deep Tracker widens who owns the over-the-shoulder ball
  // (the trait, not just the WR-Deep archetype, opens the vdeep band) —
  const useVdeep = passDepthKey === "deep" && sep > C.VDEEP_SEP_THRESHOLD && (receiverObj._gameArch === "WR-Deep" || traitLv(receiverObj, "deepTracker") > 0) && Math.random() < C.VDEEP_PROB * (receiverObj._gameArch === "WR-Deep" ? 1 : 0.4 * traitLv(receiverObj, "deepTracker")) && !(!globalThis.__noCovFamilies && (defPlan == null ? void 0 : defPlan.covFamilyEff) === "Prevent");
  const depthBand = useVdeep ? "vdeep" : passDepthKey === "short" ? "short" : passDepthKey === "medium" ? "medium" : "deep";
  const routeYds = Math.max(0, Math.round(randNorm(
    C.PASS_YARDS[depthBand].mean,
    C.PASS_YARDS[depthBand].sd
  )));
  const pursuitDefs = (defPersonnel.LB || []).concat(defPersonnel.DB || []).map((id) => defRoster.find((p) => p.id === id)).filter(Boolean);
  const { yacYds, tacklerId, assistId } = geoYAC(receiverObj, coveringDef, pursuitDefs, sep, null, passDepthKey);
  result.complete = true;
  result.yards = routeYds + yacYds;
  result.airYds = routeYds;
  result.yacYds = yacYds;
  result.passDepth = passDepthKey;
  result.receiverId = chosen.receiverId;
  if (coveringDef) {
    result.beatenDefId = coveringDef.id;
    result.covJob = chosen.landmark || null;
  }
  result.tacklerId = tacklerId;
  result.assistId = assistId;
  return result;
}
function qbScrambleChance(qb) {
  const a = qb.attributes;
  const mob = (a.SPD + a.AGI) / 2;
  const pocket = (a.STR + a.TEC + a.AWR) / 3;
  const lean = mob - pocket;
  const absMob = (mob - 50) / 40;
  // Legacy curve kept for the M3 A/B (audit gap #2 measured against it).
  if (globalThis.__qbDiceLegacy) return clamp2((absMob * 0.5 + lean / 40 * 0.6) * C.QB_SCRAMBLE_SCALE + 0.04, 0.02, 0.45);
  // M3 (D6, 2026-08-17): re-anchored on the LEAN — the archetype's own axis,
  // tier-relative by construction (owner law §7.3: a 63 SPD is fast in D3 and
  // slow in D1; the lean means the same thing in both). The lean rides a soft
  // knee (everything below a statue's lean reads the same) so the curve
  // separates scrambler ≫ dual ≫ pocket the way the audit's bands do;
  // absolute mobility keeps a small residue (a burner breaks longer).
  const effLean = clamp2(lean, -12, 20);
  return clamp2(
    C.QB_SCRAMBLE_BASE + (effLean + 12) / 24 * C.QB_SCRAMBLE_LEAN + absMob * C.QB_SCRAMBLE_ABS,
    C.QB_SCRAMBLE_FLOOR,
    C.QB_SCRAMBLE_CAP
  );
}
function qbInjuryDuration() {
  const r = Math.random();
  if (r < 0.6) return 1;
  if (r < 0.85) return Math.ceil(Math.random() * 2) + 1;
  if (r < 0.95) return Math.ceil(Math.random() * 3) + 3;
  return Math.ceil(Math.random() * 5) + 6;
}
function qbContactResult(qb, outcome) {
  if (!outcome.tacklerId) return { yards: outcome.yards, qbInjured: false, injuryGamesOut: 0, slid: false };
  // Identity stage 3: Slides Early (two-sided) — injury risk down, yards
  // left on the field: the trait fattens avoidance, which drives BOTH the
  // slide penalty and the injury suppression in this one function.
  const avoidance = clamp2(
    (qb.attributes.AWR - 70) / 100 + (qb.attributes.TEC - 70) / 100 + 0.06 * traitLv(qb, "slidesEarly"),
    -0.4,
    0.46
  );
  const slidePenalty = avoidance > 0 ? Math.max(0, Math.round(randNorm(avoidance * 2.5, 0.8))) : 0;
  const adjYards = Math.max(outcome.yards - slidePenalty, 0);
  const slid = slidePenalty > 0;
  const durScale = 1 - (qb.attributes.CON - 70) / 200;
  const injProb = clamp2(C.QB_INJURY_PER_CARRY * (1 - avoidance) * durScale, C.INJURY_MIN, C.INJURY_MAX);
  const qbInjured = Math.random() < injProb;
  return {
    yards: adjYards,
    qbInjured,
    injuryGamesOut: qbInjured ? qbInjuryDuration() : 0,
    slid
  };
}
// ── PASS 5: RPO conflict read (Ref/PASS5_OFFENSE_PLAN.md §A) ────────────────
// One NAMED second-level defender is put in post-snap conflict: does he
// trigger on the run action (bite) or hold the throwing window? The QB either
// sees it or he doesn't. Pure so the probe can drive it directly.
//   bite  → correct answer is PULL (throw the vacated window)
//   stay  → correct answer is GIVE (he's out of the run fit)
// Outcomes: pull | give (read right) · wrongGive (missed the crash, ran into
// it) · giveLate (missed a clean give — half credit, he rallies late) ·
// wrongPull (pulled on a defender who never left — throw into a sitting man).
function rpoConflictRead(qb, conflictDef, opts = {}) {
  var _a, _b, _c, _d;
  const runCommit = opts.runCommit || 0;
  const runLean = (_a = opts.runLean) != null ? _a : 0.5;
  const seenRPO = opts.seenRPO || 0;
  const defAWR = (_c = (_b = conflictDef == null ? void 0 : conflictDef.attributes) == null ? void 0 : _b.AWR) != null ? _c : 50;
  // Identity: RPO Sound is the conflict defender's discipline (one mechanism:
  // this read); Bites Hard keeps its one discipline mechanism, new call site.
  const biteP = clamp2(
    0.34 + Math.max(0, runCommit) * 0.02 + (runLean - 0.5) * 0.25 - (defAWR - 50) * 5e-3 - 0.02 * traitLv(conflictDef, "rpoSound") + 0.03 * flawLv(conflictDef, "bitesHard") - Math.min(0.12, seenRPO * 0.02),
    0.1,
    0.85
  );
  const qbSee = ((_d = qb == null ? void 0 : qb.attributes) != null ? _d : {});
  const qbReadVal = (qbSee.AWR != null ? qbSee.AWR : 50) * 0.65 + (qbSee.TEC != null ? qbSee.TEC : 50) * 0.35;
  // Identity: Conflict Reader is the QB's one RPO mechanism (this readP).
  const readP = clamp2(
    0.55 + (qbReadVal - defAWR - 2 * traitLv(conflictDef, "rpoSound")) * 6e-3 + 0.02 * traitLv(qb, "conflictReader"),
    0.25,
    0.88
  );
  const bite = Math.random() < biteP;
  const read = Math.random() < readP;
  let outcome;
  if (read) outcome = bite ? "pull" : "give";
  else if (bite) outcome = "wrongGive";
  else outcome = Math.random() < 0.3 ? "wrongPull" : "giveLate";
  return { bite, read, outcome, biteP, readP };
}
function resolveOptionPlay(playType, offPersonnel, defPersonnel, offRoster, defRoster, offUnit, defUnit, gameplan, defPlan, frontId, formationId, qb, rbShares = null, rbPool = null, style = "triple") {
  var _a, _b, _c, _d, _e, _f, _g;
  const speed = style === "speed";
  const find = (id) => offRoster.find((p) => p.id === id);
  const dfind = (id) => defRoster.find((p) => p.id === id);
  const fbIds = offPersonnel.FB || [], rbIds = offPersonnel.RB || [];
  const diveBack = find(fbIds[0]) || find(rbIds[0]) || null;
  let pitchBack = gameplan._pitchManId ? find(gameplan._pitchManId) : null;
  if (!pitchBack || pitchBack.id === (diveBack == null ? void 0 : diveBack.id)) {
    const pool = [...rbIds, ...fbIds].map(find).filter((p) => p && p.id !== (diveBack == null ? void 0 : diveBack.id));
    pitchBack = pool.sort((a, b) => (b.attributes.SPD || 0) - (a.attributes.SPD || 0))[0] || diveBack;
  }
  if (!qb || !diveBack && !pitchBack) {
    return resolveRunPlay(
      playType,
      offPersonnel,
      defPersonnel,
      offRoster,
      defRoster,
      offUnit,
      defUnit,
      gameplan,
      frontId,
      formationId,
      qb,
      rbShares,
      rbPool
    );
  }
  const diveKey = dfind((defPersonnel.DE || [])[0]) || dfind((defPersonnel.DL || [])[0]) || null;
  const forceDef = dfind((defPersonnel.OLB || [])[0]) || dfind((defPersonnel.S || [])[0]) || dfind((defPersonnel.LB || [])[0]) || null;
  const mix = gameplan.optionMix || { dive: 40, keep: 30, pitch: 30 };
  const mixTot = (mix.dive || 0) + (mix.keep || 0) + (mix.pitch || 0) || 100;
  const pitchAggr = clamp2(((_a = gameplan.pitchAggr) != null ? _a : 50) / 100, 0, 1);
  const optionKey = (_c = (_b = defPlan == null ? void 0 : defPlan.optionKeyEff) != null ? _b : defPlan == null ? void 0 : defPlan.optionKey) != null ? _c : "balanced";
  const qbRead2 = (qb.attributes.AWR || 50) * 0.65 + (qb.attributes.TEC || 50) * 0.35;
  const readWinP = (keyDef) => {
    var _a2;
    // identity stage 3: Option Sound — the key defender never takes the
    // wrong man (the QB's read-win chance drops against him)
    return clamp2(
      0.55 + (qbRead2 - (((_a2 = keyDef == null ? void 0 : keyDef.attributes.AWR) != null ? _a2 : 50) + 2 * traitLv(keyDef, "optionSound"))) * 6e-3,
      0.25,
      0.85
    );
  };
  if (Math.random() < 0.35) {
    const cMixTot = speed ? (mix.keep || 0) + (mix.pitch || 0) || 100 : mixTot;
    let roll = Math.random() * cMixTot, called;
    if (speed) called = roll - (mix.keep || 0) < 0 ? "keep" : "pitch";
    else {
      called = "dive";
      if ((roll -= mix.dive || 0) >= 0) called = roll - (mix.keep || 0) < 0 ? "keep" : "pitch";
    }
    const cCarrier = called === "dive" ? diveBack || pitchBack : called === "keep" ? qb : pitchBack || diveBack;
    const cType = called === "dive" ? "run_inside" : "run_outside";
    if (called === "pitch" && cCarrier && cCarrier !== qb) {
      const secure = (cCarrier.attributes.HND || 50) * 0.5 + (cCarrier.attributes.SEC || 50) * 0.5;
      const muffP = clamp2((0.03 - (qb.attributes.TEC - 55) * 35e-5 - (secure - 55) * 3e-4 + pitchAggr * 0.014) * 0.5, 3e-3, 0.04) * flawMult(cCarrier, "muffs", 0.2);
      if (Math.random() < muffP) {
        const result = {
          type: cType,
          yards: -Math.abs(Math.round(randNorm(3, 2))),
          complete: false,
          turnover: Math.random() < 0.5,
          turnoverType: null,
          sack: false,
          throwerId: null,
          targetId: null,
          receiverId: null,
          tacklerId: (_d = forceDef == null ? void 0 : forceDef.id) != null ? _d : null,
          assistId: null,
          tflId: null,
          sackerId: null,
          sackerId2: null,
          pbuId: null,
          intPickerId: null,
          ffId: (_e = forceDef == null ? void 0 : forceDef.id) != null ? _e : null,
          rusherId: cCarrier.id,
          optionPhase: "pitch",
          pitchMuffed: true
        };
        if (result.turnover) result.turnoverType = "fumble";
        return result;
      }
    }
    return resolveRunPlay(
      cType,
      offPersonnel,
      defPersonnel,
      offRoster,
      defRoster,
      offUnit,
      defUnit,
      gameplan,
      frontId,
      formationId,
      qb,
      rbShares,
      rbPool,
      { carrier: cCarrier, laneShift: 0, forcePenetrator: null, phase: called }
    );
  }
  const crashBase = optionKey === "qb" ? 0.35 : optionKey === "pitch" ? 0.6 : 0.48;
  const diveLean = (mix.dive || 0) / mixTot;
  const keyCrashes = Math.random() < crashBase;
  const read1Won = Math.random() < readWinP(diveKey);
  let phase, carrier, effType, laneShift = 0, forcePenetrator = null;
  const decideGive = !speed && (read1Won ? !keyCrashes : Math.random() < clamp2(diveLean * 1.3, 0.2, 0.75));
  if (decideGive && diveBack) {
    phase = "dive";
    carrier = diveBack;
    effType = "run_inside";
    if (read1Won && !keyCrashes) laneShift = 0.1;
    else if (!read1Won && keyCrashes) {
      laneShift = -0.15;
      forcePenetrator = diveKey;
    }
  } else {
    const read2Won = Math.random() < readWinP(forceDef);
    const forceTakesQB = optionKey === "qb" ? Math.random() < 0.7 : optionKey === "pitch" ? Math.random() < 0.3 : Math.random() < 0.42 + pitchAggr * 0.16;
    const pitchLean = (mix.pitch || 0) / ((mix.keep || 0) + (mix.pitch || 0) || 1);
    const decidePitch = read2Won ? forceTakesQB : Math.random() < clamp2(pitchLean * (0.8 + pitchAggr * 0.5), 0.15, 0.85);
    if (decidePitch && pitchBack) {
      phase = "pitch";
      carrier = pitchBack;
      effType = "run_outside";
      if (read2Won && forceTakesQB) laneShift = 0.12;
      else if (!read2Won && !forceTakesQB) {
        laneShift = -0.15;
        forcePenetrator = forceDef;
      }
      const secure = (pitchBack.attributes.HND || 50) * 0.5 + (pitchBack.attributes.SEC || 50) * 0.5;
      const muffP = clamp2(0.03 - (qb.attributes.TEC - 55) * 35e-5 - (secure - 55) * 3e-4 + pitchAggr * 0.014, 6e-3, 0.075) * flawMult(pitchBack, "muffs", 0.2);
      if (Math.random() < muffP) {
        const result = {
          type: effType,
          yards: -Math.abs(Math.round(randNorm(3, 2))),
          complete: false,
          turnover: Math.random() < 0.5,
          // ball on the ground behind the LOS: a coin flip
          turnoverType: null,
          sack: false,
          throwerId: null,
          targetId: null,
          receiverId: null,
          tacklerId: (_f = forceDef == null ? void 0 : forceDef.id) != null ? _f : null,
          assistId: null,
          tflId: null,
          sackerId: null,
          sackerId2: null,
          pbuId: null,
          intPickerId: null,
          ffId: (_g = forceDef == null ? void 0 : forceDef.id) != null ? _g : null,
          rusherId: pitchBack.id,
          optionPhase: "pitch",
          pitchMuffed: true
        };
        if (result.turnover) result.turnoverType = "fumble";
        return result;
      }
    } else {
      phase = "keep";
      carrier = qb;
      effType = "run_outside";
      if (read2Won && !forceTakesQB) laneShift = 0.1;
      else if (!read2Won && forceTakesQB) {
        laneShift = -0.15;
        forcePenetrator = forceDef;
      }
    }
  }
  return resolveRunPlay(
    effType,
    offPersonnel,
    defPersonnel,
    offRoster,
    defRoster,
    offUnit,
    defUnit,
    gameplan,
    frontId,
    formationId,
    qb,
    rbShares,
    rbPool,
    { carrier, laneShift, forcePenetrator, phase }
  );
}
function resolveRunPlay(playType, offPersonnel, defPersonnel, offRoster, defRoster, offUnit, defUnit, gameplan, frontId, formationId, qb, rbShares = null, rbPool = null, optionOverride = null) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s;
  const result = {
    type: playType,
    yards: 0,
    complete: false,
    turnover: false,
    turnoverType: null,
    sack: false,
    throwerId: null,
    targetId: null,
    receiverId: null,
    tacklerId: null,
    assistId: null,
    tflId: null,
    sackerId: null,
    sackerId2: null,
    pbuId: null,
    intPickerId: null,
    ffId: null
  };
  const contextBoost = (offUnit - defUnit) / C.K_CONTEXT;
  const defContextBoost = -contextBoost;
  const isOutside = playType === "run_outside";
  const frontRoles = composedFrontRoles(frontId);
  const dlRoles = frontRoles.DL || [];
  const lbRoles = frontRoles.LB || [];
  // M3 (D6, 2026-08-17, ratified §7.1): THE DICE ARE DEAD. A handoff concept
  // becomes a QB keep only at the broken-play floor (bad mesh, bumped
  // exchange) — designed QB runs now live in the authored family (Zone Read /
  // QB Draw / QB Counter / QB Power / QB Sneak) and the qbRunPct dial prices
  // THOSE calls, not these dice. Empty keeps its 1.0 exception (no back to
  // hand to — the no-backfield guard below enforces it anyway). The legacy
  // table + dial ride under __qbDiceLegacy for the A/B.
  const qbRunChance = globalThis.__qbDiceLegacy ? clamp2(
    (QB_RUN_BASE[formationId] || 0.08) + (gameplan.qbRunPct || 0) / 100,
    0,
    0.65
  ) : formationId === "Empty" ? 1 : C.QB_RUN_FLOOR;
  const fbIds = offPersonnel.FB || [];
  const rbIds = offPersonnel.RB || [];
  const noBackfield = rbIds.length === 0 && fbIds.length === 0;
  const useQBCarrier = (optionOverride == null ? void 0 : optionOverride.carrier) ? optionOverride.carrier === qb || optionOverride.carrier.position === "QB" : !!qb && (noBackfield || (gameplan == null ? void 0 : gameplan._forceQBRun) || !!(_conceptCtx && _conceptCtx.def && _conceptCtx.def.qbCarry) || Math.random() < qbRunChance);
  let carrier;
  if (optionOverride == null ? void 0 : optionOverride.carrier) {
    carrier = optionOverride.carrier;
  } else if (useQBCarrier) {
    carrier = qb;
  } else {
    let carrierId = null;
    const committee = (rbPool && rbPool.length ? rbPool : rbIds).filter((id) => {
      var _a2;
      return ((_a2 = rbShares == null ? void 0 : rbShares[id]) != null ? _a2 : null) != null && (rbShares[id] || 0) > 0;
    });
    const dialedTotal = committee.reduce((s, id) => s + (rbShares[id] || 0), 0);
    if (committee.length && dialedTotal > 0) {
      let roll = Math.random() * Math.max(100, dialedTotal);
      for (const id of committee) {
        roll -= rbShares[id] || 0;
        if (roll <= 0) {
          carrierId = id;
          break;
        }
      }
      if (!carrierId) {
        carrierId = isOutside ? (_b = (_a = rbIds[0]) != null ? _a : fbIds[0]) != null ? _b : null : (_d = (_c = fbIds[0]) != null ? _c : rbIds[0]) != null ? _d : null;
      }
    } else {
      carrierId = isOutside ? (_f = (_e = rbIds[0]) != null ? _e : fbIds[0]) != null ? _f : null : (_h = (_g = fbIds[0]) != null ? _g : rbIds[0]) != null ? _h : null;
    }
    carrier = carrierId ? offRoster.find((p) => p.id === carrierId) : null;
  }
  if (!carrier) {
    result.yards = Math.round(randNorm(2, 3));
    return result;
  }
  result.rusherId = carrier.id;
  const olIds = offPersonnel.OL || [];
  const olPlayers = olIds.map((id) => offRoster.find((p) => p.id === id)).filter(Boolean);
  const dlIds = defPersonnel.DL || [];
  const dlPlayers = dlIds.map((id, i) => ({
    player: defRoster.find((p) => p.id === id),
    role: dlRoles[i] || "DT-3tech"
  })).filter((x) => x.player);
  const tePlayers = (offPersonnel.TE || []).map((id) => offRoster.find((p) => p.id === id)).filter(Boolean);
  const teBlockers = tePlayers.filter((te) => te._gameArch === "TE-Blocking" || te._gameArch === "TE-Hybrid" && Math.random() < 0.35);
  const allBlockers = [...olPlayers, ...teBlockers];
  const penetrators = [];
  const dirW = gameplan.runDirection || { left: 33, middle: 34, right: 33 };
  const dirTot = (dirW.left || 0) + (dirW.middle || 0) + (dirW.right || 0) || 1;
  let dirRoll = Math.random() * dirTot;
  const runDir = (dirRoll -= dirW.left || 0) < 0 ? "left" : (dirRoll -= dirW.middle || 0) < 0 ? "middle" : "right";
  const poaBlk = runDir === "left" ? [0, 1] : runDir === "right" ? [3, 4] : [1, 2, 3];
  const isOutsideRun = /outside/.test(playType || "");
  const pulls = !!((_i = _conceptCtx == null ? void 0 : _conceptCtx.def) == null ? void 0 : _i.pulls) && !optionOverride && runDir !== "middle";
  const pullIdx = pulls ? runDir === "left" ? 3 : 1 : -1;
  let repWinsWeighted = 0, repTotWeighted = 0;
  for (let i = 0; i < dlPlayers.length; i++) {
    const { player: def, role } = dlPlayers[i];
    const speedRush = /^(DE|OLB)/.test(role) && role !== "DE-Power";
    const bIdx = runDir === "right" ? Math.max(0, allBlockers.length - 1 - i) : i;
    const blocker = (_k = (_j = allBlockers[bIdx]) != null ? _j : allBlockers[allBlockers.length - 1]) != null ? _k : null;
    const poaWeight = poaBlk.includes(bIdx) ? 3 : 1;
    if (pulls && bIdx === pullIdx) {
      if (Math.random() < 0.4) penetrators.push(def);
      else repWinsWeighted += poaWeight * 0.5;
      repTotWeighted += poaWeight;
      continue;
    }
    if (!blocker) {
      penetrators.push(def);
      repTotWeighted += poaWeight;
      continue;
    }
    const reachMob = isOutsideRun && poaBlk.includes(bIdx) ? ((((_l = blocker.attributes.AGI) != null ? _l : C.OL_MOBILITY_PIVOT) - C.OL_MOBILITY_PIVOT) * 0.6 + (((_m = blocker.attributes.SPD) != null ? _m : C.OL_MOBILITY_PIVOT) - C.OL_MOBILITY_PIVOT) * 0.4) * C.OL_MOBILITY_SCALE : 0;
    const blockHolds = blockRep(blocker, def, speedRush, contextBoost, false, false, reachMob);
    if (!blockHolds) penetrators.push(def);
    else repWinsWeighted += poaWeight;
    repTotWeighted += poaWeight;
  }
  if (pulls) {
    const bTarget = poaBlk[0];
    const di = runDir === "right" ? clamp2(allBlockers.length - 1 - bTarget, 0, Math.max(0, dlPlayers.length - 1)) : Math.min(bTarget, Math.max(0, dlPlayers.length - 1));
    const poaDef = (_n = dlPlayers[di]) == null ? void 0 : _n.player;
    const puller = allBlockers[pullIdx];
    if (poaDef && puller) {
      // identity stage 3: Puller — space blocking on the move is his craft
      const pMob = ((((_o = puller.attributes.AGI) != null ? _o : C.OL_MOBILITY_PIVOT) - C.OL_MOBILITY_PIVOT) * 0.6 + (((_p = puller.attributes.SPD) != null ? _p : C.OL_MOBILITY_PIVOT) - C.OL_MOBILITY_PIVOT) * 0.4) * C.OL_MOBILITY_SCALE + 0.6 * traitLv(puller, "puller");
      if (blockRep(puller, poaDef, false, contextBoost, false, false, pMob)) repWinsWeighted += 3;
      repTotWeighted += 3;
    }
  }
  const lbIds = defPersonnel.LB || [];
  const containAdj = !optionOverride && _optKey === "qb" ? useQBCarrier ? -0.06 : isOutside ? 0.03 : 0 : 0;
  // Fix D — box-count integrity, SYMMETRIC about the even box (blockers + the
  // plus-one fitter). Each defender the offense is OUT-numbered by in the box is an
  // unblocked hat in a gap → the inside run is stuffed; each defender it OUT-numbers
  // (a light box) is a clean gap → the inside run breaks. Centered on the even-box
  // case so it is mean-neutral across the league's box distribution (it redistributes
  // yards toward light-box looks and away from stacked ones), while making the
  // stacked box actually bite. Inside runs only — the vacated edge is a pass matter.
  let boxAdj = 0;
  if (!globalThis.__noBoxCount && !isOutside && !optionOverride && !useQBCarrier) {
    const boxDefenders = dlPlayers.length + lbIds.length;
    const excessInBox = boxDefenders - allBlockers.length - 1;
    boxAdj = clamp2(-excessInBox * C.BOXCOUNT_PEN_GAIN, -C.BOXCOUNT_CAP, C.BOXCOUNT_CAP);
  }
  const laneQuality = clamp2(
    (repTotWeighted > 0 ? repWinsWeighted / repTotWeighted : 0.5) + ((optionOverride == null ? void 0 : optionOverride.laneShift) || 0) + containAdj + boxAdj + (!optionOverride && _rpoCtx && Number.isFinite(_rpoCtx.giveEdge) ? _rpoCtx.giveEdge : 0),
    0,
    1
  );
  result.runDir = runDir;
  result.runGap = isOutside ? runDir === "middle" ? "edge" : `${runDir} edge` : runDir === "middle" ? "A-gap" : `${runDir} B-gap`;
  if (pulls) result.pulled = true;
  const containPen = !optionOverride && _optKey === "qb" && useQBCarrier && Math.random() < 0.35 ? defRoster.find((pl) => pl.id === (defPersonnel.OLB || [])[0]) || defRoster.find((pl) => pl.id === (defPersonnel.DE || [])[0]) || null : null;
  const bestPenetrator = ((_q = optionOverride == null ? void 0 : optionOverride.forcePenetrator) != null ? _q : containPen) ? (_r = optionOverride == null ? void 0 : optionOverride.forcePenetrator) != null ? _r : containPen : penetrators.length > 0 ? penetrators.reduce((best, d) => d.attributes.STR + d.attributes.SPD > best.attributes.STR + best.attributes.SPD ? d : best) : null;
  const dbIds = defPersonnel.DB || [];
  const secondLevel = lbIds.map((id) => defRoster.find((p) => p.id === id)).filter(Boolean);
  const deepLevel = dbIds.map((id) => defRoster.find((p) => p.id === id)).filter(Boolean);
  const dlPursuit = dlPlayers.map((x) => x.player).filter(Boolean);
  const outcome = runOutcome(carrier, laneQuality, bestPenetrator, secondLevel, deepLevel, contextBoost, dlPursuit);
  let finalYards = outcome.yards;
  let qbInjured = false;
  let qbInjuryGames = 0;
  if (useQBCarrier) {
    const contact = qbContactResult(carrier, outcome);
    finalYards = contact.yards;
    qbInjured = contact.qbInjured;
    qbInjuryGames = contact.injuryGamesOut;
  }
  if (useQBCarrier) {
    const design = (_s = gameplan == null ? void 0 : gameplan._ocQbRunDesign) != null ? _s : 50;
    finalYards = Math.round(finalYards * (0.9 + design / 500));
  }
  if (gameplan && gameplan._sneak) {
    const stuffP = clamp2(0.12 - (((carrier == null ? void 0 : carrier.attributes.STR) || 50) - 50) * 3e-3, 0.04, 0.22);
    if (Math.random() >= stuffP) finalYards = Math.max(finalYards, 1 + (Math.random() < 0.45 ? 1 : 0));
    else finalYards = Math.min(finalYards, 0);
  }
  result.yards = finalYards;
  result.tacklerId = outcome.tacklerId;
  result.assistId = outcome.assistId;
  result.tflId = outcome.tflId;
  result.ffId = outcome.ffId;
  result.brokenById = outcome.brokenById;
  result.brokenByCarrier = outcome.brokenById ? carrier.id : null;
  result.breakaway = outcome.breakaway || false;
  result.btStyle = outcome.btStyle || null;
  result.isQBDesignedRun = useQBCarrier;
  if (optionOverride == null ? void 0 : optionOverride.phase) result.optionPhase = optionOverride.phase;
  result.qbInjured = qbInjured;
  result.qbInjuryGames = qbInjuryGames;
  if (outcome.ffId) {
    result.turnover = Math.random() < 0.4;
    result.turnoverType = result.turnover ? "fumble" : null;
  }
  const dnaBallSecFumbleMult = 1 - ((gameplan == null ? void 0 : gameplan._dnaBallSec) || 0) * 0.01;
  // identity stage 3: Secure Bag / Fumbler ride the carry-fumble mult
  const carryHndMult = clamp2(1 - (carrier.attributes.SEC * 0.85 + carrier.attributes.TEC * 0.15 - 50) * C.FUMBLE_HND_SCALE, 0.45, 1.3) * dnaBallSecFumbleMult * traitMult(carrier, "secureBag", -0.04) * flawMult(carrier, "fumbler", 0.06);
  if (!useQBCarrier && !result.turnover && Math.random() < C.CARRY_FUMBLE_BASE * carryHndMult) {
    result.turnover = Math.random() < 0.4;
    result.turnoverType = result.turnover ? "fumble" : null;
    if (result.turnover) result.ffId = carrier.id;
  }
  return result;
}
function fatigueMultiplier(fatigue) {
  if (fatigue <= C.FATIGUE_DEGRADE_ONSET) return 1;
  const progress = (fatigue - C.FATIGUE_DEGRADE_ONSET) / (100 - C.FATIGUE_DEGRADE_ONSET);
  return clamp2(1 - progress * (1 - C.FATIGUE_DEGRADE_FLOOR), C.FATIGUE_DEGRADE_FLOOR, 1);
}
function applyFatigueMult(player, mult) {
  const attrs = __spreadValues({}, player.attributes);
  for (const k of FATIGUE_PHYSICAL) {
    if (attrs[k] != null) attrs[k] = attrs[k] * mult;
  }
  if (attrs.HND != null) attrs.HND = attrs.HND * (1 + (mult - 1) * 0.5);
  return __spreadProps(__spreadValues({}, player), { attributes: attrs });
}
function applyFormPts(player, pts) {
  const attrs = __spreadValues({}, player.attributes);
  for (const k of FATIGUE_PHYSICAL) {
    if (attrs[k] != null) attrs[k] = attrs[k] + pts;
  }
  if (attrs.TEC != null) attrs.TEC += pts * 0.5;
  if (attrs.AWR != null) attrs.AWR += pts * 0.5;
  if (attrs.HND != null) attrs.HND += pts * 0.75;
  return __spreadProps(__spreadValues({}, player), { attributes: attrs });
}
function starterSnapCap(pos, slot) {
  const sc2 = STARTER_COUNTS[pos] || 1;
  if (slot < sc2) {
    if (pos === "QB" || pos === "K" || pos === "P") return 100;
    if (pos === "RB") return 68;
    return 90;
  }
  const d = slot - sc2;
  if (pos === "RB") return d === 0 ? 50 : 25;
  return d === 0 ? 65 : d === 1 ? 40 : 25;
}
function filterActiveDepth(depthChart, ctx2, side) {
  const totalSnaps = side === "off" ? ctx2.offSnaps || 0 : ctx2.defSnaps || 0;
  const result = {};
  for (const [pos, ids] of Object.entries(depthChart)) {
    if (!ids || ids.length === 0) {
      result[pos] = [];
      continue;
    }
    const active = [];
    for (let slot = 0; slot < ids.length; slot++) {
      const id = ids[slot];
      const capFrac = starterSnapCap(pos, slot) / 100;
      const played = ctx2.snapCountMap[id] || 0;
      const isCapped = totalSnaps > 0 && played / totalSnaps > capFrac;
      const isBenched = !!ctx2.benchedMap[id];
      if (!isBenched && !isCapped) active.push(id);
    }
    result[pos] = active.length > 0 ? active : [...ids].sort((a, b) => (ctx2.fatigueMap[a] || 0) - (ctx2.fatigueMap[b] || 0));
  }
  return result;
}
function applyOutOfPos(p, slotPos) {
  if (!p || p.position === slotPos) return p;
  // Identity stage 2: a bridge trait that names this bucket plays it at FULL
  // RATE — no attribute-keep charge (the Space Backer at S, the Move TE at
  // WR). Kill-switched with the rest of the trait system (__noTraits).
  if (bridgeWaivesBucket(p, slotPos)) return p;
  const adjacent = (SUB_ADJACENT[slotPos] || []).includes(p.position);
  const coachedKeep = Math.min(1, OUT_OF_POS.COACHED_KEEP + (adjacent ? OUT_OF_POS.ADJACENT_BONUS : 0));
  const attrs = {};
  for (const [k, v] of Object.entries(p.attributes || {})) {
    if (k === "WE" || k === "CON") {
      attrs[k] = v;
      continue;
    }
    attrs[k] = Math.round(v * (MEASURED_ATTRS.includes(k) ? OUT_OF_POS.MEASURED_KEEP : coachedKeep));
  }
  return __spreadProps(__spreadValues({}, p), { attributes: attrs, _outOfPos: slotPos });
}
function makeEffectiveRoster(onFieldIds, roster, fatigueMap, slotOf = null, formPts = 0, earlyGame = false) {
  var _a;
  const overrides = /* @__PURE__ */ new Map();
  for (const id of onFieldIds) {
    const p = roster.find((pl) => pl.id === id);
    if (!p) continue;
    let eff = p;
    const slot = (_a = slotOf == null ? void 0 : slotOf.get) == null ? void 0 : _a.call(slotOf, id);
    if (slot && slot !== p.position) eff = applyOutOfPos(eff, slot);
    const fat = fatigueMap[id] || 0;
    if (fat > C.FATIGUE_DEGRADE_ONSET) eff = applyFatigueMult(eff, fatigueMultiplier(fat));
    if (formPts) eff = applyFormPts(eff, formPts);
    // identity stage 3: Slow Starter (flaw) — a small first-half form dip on
    // HIS sheet only, riding the existing applyFormPts machinery
    if (earlyGame) {
      const _ssLv = flawLv(p, "slowStarter");
      if (_ssLv) eff = applyFormPts(eff, -0.4 * _ssLv);
    }
    if (eff !== p) overrides.set(id, eff);
  }
  if (overrides.size === 0) return roster;
  return roster.map((p) => {
    var _a2;
    return (_a2 = overrides.get(p.id)) != null ? _a2 : p;
  });
}
function slotMap(personnel) {
  const m = /* @__PURE__ */ new Map();
  for (const [pos, ids] of Object.entries(personnel || {})) {
    if (!REAL_SLOTS.has(pos)) continue;
    for (const id of ids || []) if (!m.has(id)) m.set(id, pos);
  }
  return m;
}
function updateFatigue(offRoster, offPersonnel, offCtx, defRoster, defPersonnel, defCtx, offGainMult = 1, defGainMult = 1) {
  const offOnField = new Set(Object.values(offPersonnel).flat());
  const defOnField = new Set(Object.values(defPersonnel).flat());
  for (const p of offRoster) {
    const sta = p.attributes.CON || C.FATIGUE_STA_PIVOT;
    const fat = offCtx.fatigueMap[p.id] || 0;
    let newFat;
    if (offOnField.has(p.id)) {
      newFat = Math.min(100, fat + C.FATIGUE_PER_SNAP * offGainMult * (C.FATIGUE_STA_PIVOT / sta));
      offCtx.snapCountMap[p.id] = (offCtx.snapCountMap[p.id] || 0) + 1;
    } else {
      newFat = Math.max(0, fat - C.FATIGUE_RECOVERY_RATE * (sta / C.FATIGUE_STA_PIVOT));
    }
    offCtx.fatigueMap[p.id] = newFat;
    const noRotate = p.position === "QB" || p.position === "K" || p.position === "P";
    if (!noRotate) {
      if (newFat >= C.FATIGUE_BENCH_THRESHOLD) offCtx.benchedMap[p.id] = true;
      else if (newFat <= C.FATIGUE_RETURN_THRESHOLD) delete offCtx.benchedMap[p.id];
    }
  }
  offCtx.offSnaps++;
  for (const p of defRoster) {
    const sta = p.attributes.CON || C.FATIGUE_STA_PIVOT;
    const fat = defCtx.fatigueMap[p.id] || 0;
    let newFat;
    if (defOnField.has(p.id)) {
      newFat = Math.min(100, fat + C.FATIGUE_PER_SNAP * defGainMult * (C.FATIGUE_STA_PIVOT / sta));
      defCtx.snapCountMap[p.id] = (defCtx.snapCountMap[p.id] || 0) + 1;
    } else {
      newFat = Math.max(0, fat - C.FATIGUE_RECOVERY_RATE * (sta / C.FATIGUE_STA_PIVOT));
    }
    defCtx.fatigueMap[p.id] = newFat;
    const noRotateD = p.position === "QB" || p.position === "K" || p.position === "P";
    if (!noRotateD) {
      if (newFat >= C.FATIGUE_BENCH_THRESHOLD) defCtx.benchedMap[p.id] = true;
      else if (newFat <= C.FATIGUE_RETURN_THRESHOLD) delete defCtx.benchedMap[p.id];
    }
  }
  defCtx.defSnaps++;
}
function shortYardagePower(playType, distance, offPersonnel, offRoster) {
  if (playType !== "run_inside" || distance > 2) return 1;
  const rbId = ((offPersonnel == null ? void 0 : offPersonnel.RB) || [])[0];
  if (!rbId) return 1;
  const rb = offRoster.find((p) => p.id === rbId);
  if (!rb) return 1;
  const power = roleRating(rb, "RB-Power");
  const scat = roleRating(rb, "RB-Scat");
  const lean = (power - scat) / 100;
  return clamp2(1 + lean * 1.2, 0.97, 1.07);
}
function rosterById(roster) {
  let m = _rosterByIdCache.get(roster);
  if (!m) {
    m = new Map((roster || []).map((p) => [p.id, p]));
    _rosterByIdCache.set(roster, m);
  }
  return m;
}
function slotSpeedMap(bySlot, roster) {
  var _a, _b, _c, _d;
  if (!bySlot || !roster) return null;
  const byId = rosterById(roster);
  const out = {};
  for (const sid in bySlot) {
    const pl = byId.get(bySlot[sid]);
    if (pl) out[sid] = {
      s: (_b = (_a = pl.attributes) == null ? void 0 : _a.SPD) != null ? _b : 55,
      a: (_d = (_c = pl.attributes) == null ? void 0 : _c.AGI) != null ? _d : 55,
      // Viewer Act 2 / A5: compact roster identity, recording only. These
      // values share the speed map already stored on every play so body
      // expression does not add a second 22-player payload.
      h: Number.isFinite(pl.heightInches) ? pl.heightInches : null,
      w: Number.isFinite(pl.weight) ? pl.weight : null
    };
  }
  return out;
}
function defViewerSlotMap(frontId, defPersonnel) {
  const layout = DEF_FIELD_LAYOUTS[frontId];
  if (!layout || !defPersonnel) return null;
  const pools = {
    DE: defPersonnel.DE || [], DT: defPersonnel.DT || [], OLB: defPersonnel.OLB || [],
    LB: defPersonnel.ILB || defPersonnel.LB || [], CB: defPersonnel.CB || [], S: defPersonnel.S || []
  };
  const used = /* @__PURE__ */ new Set(), cursor = {}, out = {};
  const all = [...new Set(Object.values(pools).flat())];
  for (const slot of layout.slots) {
    const pool = pools[slot.pos] || [];
    let i = cursor[slot.pos] || 0, id = null;
    while (i < pool.length && used.has(pool[i])) i++;
    if (i < pool.length) { id = pool[i]; cursor[slot.pos] = i + 1; }
    if (!id) id = all.find((pid) => !used.has(pid)) || null;
    if (id) { out[slot.id] = id; used.add(id); }
  }
  return Object.keys(out).length ? out : null;
}
function slotBodyFallbackMap(bySlot, roster) {
  const out = slotSpeedMap(bySlot, roster);
  // A scheme-fit sub-front historically carried no slot speed map. Keep its
  // exact legacy track factors (55 = 1.0) while still recording the real
  // bodies assigned to that front for A5.
  if (out) for (const v of Object.values(out)) { v.s = 55; v.a = 55; }
  return out;
}
function armSwitchStamp(playResult, carrierSlotId, targetSlotId, offSlots, fieldRemaining = 100) {
  // Viewer Act 2 / A4: the play is already over when this runs. The stamp
  // records the ball-security decision for film; no outcome path reads it and
  // no random number is consumed. The kill switch makes that bit-exact law
  // measurable in the matched A/B.
  if (globalThis.__noArmSwitch || !playResult || playResult.turnover || playResult.pitchMuffed) return null;
  const runCarrier = !!playResult.rusherId;
  const catchCarrier = !!playResult.complete && !!playResult.receiverId;
  const rawOpenYards = runCarrier ? Math.max(0, playResult.yards || 0) : catchCarrier ? Math.max(0, playResult.yacYds || 0) : 0;
  const visibleRunway = catchCarrier
    ? Math.max(0, fieldRemaining - Math.max(0, playResult.airYds || 0))
    : Math.max(0, fieldRemaining);
  const openYards = Math.min(rawOpenYards, visibleRunway);
  if (openYards < 6) return null;
  let side = playResult.runDir === "left" || playResult.runDir === "right" ? playResult.runDir : null;
  const slotId = runCarrier ? carrierSlotId : targetSlotId;
  if (!side && slotId && offSlots) {
    const slot = offSlots.find((s) => s.id === slotId) || null;
    if (slot && Number.isFinite(slot.x)) {
      if (slot.x <= 0.43) side = "left";
      else if (slot.x >= 0.57) side = "right";
    }
  }
  if (!side || !slotId) return null;
  const to = side;
  return {
    slot: slotId,
    from: to === "left" ? "right" : "left",
    to,
    // Fraction of the post-possession run. Longer runs give the exchange a
    // beat later; the viewer translates this normalized stamp to its clock.
    f: Math.round(clamp2(0.38 + (openYards - 6) * 8e-3, 0.38, 0.58) * 100) / 100
  };
}
function pickPlayType(formationId, gameplan, sitTendency, down, distance, fieldPos, score, clock, varKey = null) {
  var _a, _b, _c, _d, _e, _f;
  const formInfo = FORMATIONS[aliasFormation(formationId)] || Object.values(FORMATIONS)[0];
  const formLean = (formInfo.passLean + variationPassLeanDelta(formationId, varKey)) * 0.5;
  let passRate;
  if (sitTendency != null) {
    passRate = ((_a = PASS_TENDENCY[sitTendency]) != null ? _a : 0.5) + formLean;
  } else {
    passRate = ((_b = PASS_TENDENCY[gameplan.tendency || "Balanced"]) != null ? _b : 0.5) + formLean;
    if (down >= 3 && distance >= 7) passRate = clamp2(passRate + 0.3, 0, 1);
    if (down >= 3 && distance <= 2) passRate = clamp2(passRate - 0.25, 0, 1);
    const trailing = score.off - score.def;
    const lateInHalf = clock < 300;
    if (trailing < -10 && lateInHalf) passRate = clamp2(passRate + 0.2, 0, 1);
    if (trailing > 10 && lateInHalf) passRate = clamp2(passRate - 0.25, 0, 1);
  }
  if (gameplan.passLeanShift) {
    passRate = clamp2(passRate + gameplan.passLeanShift / 100, 0, 1);
  }
  if (formationId === "Wildcat") {
    passRate = clamp2(((_c = gameplan.wildcatPassRate) != null ? _c : 10) / 100, 0, 0.35);
  }
  if (Math.random() >= passRate) {
    const base = (_d = gameplan.rushInPct) != null ? _d : 60;
    const mid = (_e = gameplan.runDirection) == null ? void 0 : _e.middle;
    const rushInPct = clamp2(base + (mid != null ? mid - 34 : 0), 20, 80);
    return Math.random() < rushInPct / 100 ? "run_inside" : "run_outside";
  }
  let dep = gameplan.passDepth || { short: 40, medium: 40, deep: 20 };
  const aggrShift = (((_f = gameplan.qbAggr) != null ? _f : 50) - 50) / 5;
  if (aggrShift) {
    dep = {
      short: Math.max(5, dep.short - aggrShift),
      medium: dep.medium,
      deep: Math.max(5, dep.deep + aggrShift)
    };
  }
  const dS = dep.short || 0, dM = dep.medium || 0, dTot = dS + dM + (dep.deep || 0);
  if (dTot <= 0) {
    const r0 = Math.random() * 100;
    return r0 < 40 ? "pass_short" : r0 < 80 ? "pass_medium" : "pass_deep";
  }
  const r = Math.random() * dTot;
  if (r < dS) return "pass_short";
  if (r < dS + dM) return "pass_medium";
  return "pass_deep";
}
function fgLateStretch(scoreMargin, secsLeft) {
  const needy = scoreMargin < 0 && scoreMargin >= -3;
  return needy && secsLeft <= 150 ? C.FG_LATE_STRETCH : needy && secsLeft <= 300 ? Math.round(C.FG_LATE_STRETCH / 2) : 0;
}
function fgMakeProb(kRoster, depth, kickDistance, dnaSpecialGrade = 0, pressureKick = false) {
  // PASS 6 (G9): the deterministic make probability, extracted so the 4th-down
  // brain can PRICE the actual kicker's leg instead of the binary range gate.
  // attemptFG is now a roll against this — byte-equivalent behavior.
  const kId = (depth["K"] || [])[0];
  const k = kId ? kRoster.find((p) => p.id === kId) : null;
  const leg = k ? 0.5 * (k.attributes.STR || 0) + 0.5 * (k.attributes.PWR || 0) : 40;
  const acc2 = k ? 0.5 * (k.attributes.TEC || 0) + 0.5 * (k.attributes.AWR || 0) : 40;
  const rangeCenter = 48.5 + (leg - 50) * 0.22 + (dnaSpecialGrade || 0) * 0.4;
  // Identity stage 3 (situational by construction — pressure kicks only, so
  // the baseline game is untouched): Ice Veins is unmoved when it counts;
  // Shanks is the pressure variance on the same roll.
  const clutchAdj = pressureKick ? 0.05 * traitLv(k, "iceVeins") - 0.07 * flawLv(k, "shanks") : 0;
  const accBonus = (acc2 - 50) * C.FG_TECH_SCALE + (dnaSpecialGrade || 0) * 0.01 + clutchAdj;
  // Subsystem 6 PASS 2 (Aug 2026): the long-tail lift. Pass 1 set center 46->48, denom 8.5->10.5
  // and deliberately stopped; the 2024 FBS data (50+ made at 62.2% league-wide) is a materially
  // higher anchor than pass 1 used, and the sim's 50+ sat at ~43%. This mean-preserving nudge
  // (center 48->48.5, denom 10.5->11.5) flattens the falloff a touch more: 50+ rises toward the
  // ~48-50 pass-1 target while short kicks ease slightly and overall FG% holds in the 72-77 band.
  // It intentionally does NOT chase 62% — real 50+ attempts are self-selected to big legs, while
  // the sim's 50+ population (desperation FG-late-stretch kicks by whoever is on the roster) is
  // average, so a lower make rate at that distance is CORRECT here. stat_realism guards points.
  return clamp2(logistic((rangeCenter - kickDistance) / 11.5 + accBonus), 0.01, 0.985);
}
function attemptFG(kRoster, depth, kickDistance, dnaSpecialGrade = 0, pressureKick = false) {
  return Math.random() < fgMakeProb(kRoster, depth, kickDistance, dnaSpecialGrade, pressureKick);
}
function xpMakeProb(kRoster, depth) {
  const kId = (depth["K"] || [])[0];
  const k = kId ? kRoster.find((p) => p.id === kId) : null;
  const acc2 = k ? 0.5 * (k.attributes.TEC || 0) + 0.5 * (k.attributes.AWR || 0) : C.PAT_PIVOT;
  const base = Math.log(C.PAT_RATE / (1 - C.PAT_RATE));
  return clamp2(logistic(base + (acc2 - C.PAT_PIVOT) * C.PAT_ACC_SCALE), 0.8, 0.997);
}
function puntDistance(pRoster, depth) {
  const pId = (depth["P"] || [])[0];
  const p = pId ? pRoster.find((pl) => pl.id === pId) : null;
  const leg = p ? 0.5 * (p.attributes.STR || 0) + 0.5 * (p.attributes.PWR || 0) : 40;
  const acc2 = p ? 0.5 * (p.attributes.TEC || 0) + 0.5 * (p.attributes.AWR || 0) : 40;
  const meanDist = 39 + leg * 0.12 + (acc2 - 50) * C.PUNT_TECH_SCALE;
  const sigma = clamp2(7 - (acc2 - 50) * 0.05, 3, 8);
  return Math.max(25, Math.round(randNorm(meanDist, sigma)));
}
function fourthDownDecision(fieldPos, distance, distFromGoal, maxFG, canFG, fourthApproach, scoreMargin, secsLeft, ctx = null) {
  const aggMult = fourthApproach === "Very Aggressive" ? 1.6 : fourthApproach === "Aggressive" ? 1.3 : fourthApproach === "Conservative" ? 0.6 : 1;
  const late = secsLeft <= 360;
  const veryLate = secsLeft <= 120;
  const trailing = scoreMargin < 0;
  const twoScore = scoreMargin <= -9;
  // ── PASS 6 (G9): WP-flavored context — the actual kicker's make prob at
  // THIS distance (fgProb) and the opponent-offense edge (oppEdge, "your
  // defense can't stop them anyway"). Absent ctx (external callers) or under
  // __noWP4th the legacy band table runs verbatim (zero-migration law).
  const wp = ctx && !globalThis.__noWP4th ? ctx : null;
  const fgProb = wp && wp.fgProb != null ? wp.fgProb : null;
  // "The kick changes the game": trailing by ≤3 (or tied) with a genuinely
  // makeable FG on the table — a make ties or takes the lead. This is the G9
  // fix for "trailing late teams almost never kick": the desperation forced-go
  // floor must not bulldoze a kick that WINS the state back.
  const kickWins = wp && scoreMargin >= -3 && scoreMargin <= 0 && canFG && (fgProb == null || fgProb >= 0.45);
  let base;
  // Subsystem 5 (situational, Aug 2026): base go-rates raised toward the modern
  // analytics break-even. Real 4th-and-3 converts ~45% and already beats a punt from
  // midfield by expected points; the old curve (0.55/0.40/0.22) sat well below that
  // and under-went on short yardage. These are the neutral-situation rates; the coach
  // approach dial and the game-state multipliers below still swing them either way.
  if (distance <= 1) base = 0.68;
  else if (distance <= 2) base = 0.52;
  else if (distance <= 4) base = 0.34;
  else if (distance <= 6) base = 0.14;
  else base = 0.06;
  if (fieldPos >= 55 && fieldPos <= 70) base *= 1.5;
  // The own-territory discount was ×0.4 for everything inside the 40 — which
  // double-discounted a correct midfield short (a 4th-and-1 from your own 45 is a
  // modern go). Soften it, and reserve the harshest cut for deep in your own end.
  if (fieldPos < 30) base *= 0.4;
  else if (fieldPos < 40) base *= 0.6;
  if (fieldPos >= 90) base *= 1.4;
  base *= aggMult;
  if (trailing && late) base *= twoScore ? 3 : 2;
  // G9: the desperation floor stands only when the kick DOESN'T win the state
  // back (down 4-8 needs a TD; two-score needs everything). Down 1-3 with a
  // makeable kick, the floor yields — take the points, live to overtime.
  if (trailing && veryLate && !kickWins) base = Math.max(base, distance <= 6 ? 0.85 : 0.55);
  // G9: tied-or-down-≤3 late with a makeable kick also damps the gamble on
  // anything longer than inches — the FG is the win-probability play, and the
  // deeper into the clock, the more it is (0:35 down 2: you kick).
  if (kickWins && distance >= 2) base *= veryLate ? 0.25 : late ? 0.6 : 1;
  if (scoreMargin > 0 && late) base *= 0.35;
  if (scoreMargin > 8 && late) base *= 0.15;
  if (wp) {
    // G9: a marginal kicker leg makes going relatively better — a 40% kick is
    // no safety net. Scales the go-prob up as the make prob falls under 55%.
    if (canFG && fgProb != null && fgProb < 0.55) base *= 1 + (0.55 - fgProb);
    // G9: opponent-offense WP nudge — positive edge only (a good own defense
    // doesn't make punting better than the bands already say).
    if (wp.oppEdge > 0) base *= 1 + wp.oppEdge;
  }
  const goProb = clamp2(base, 0, 0.97);
  // G9: never trot out a prayer — a sub-28% kick isn't a real option.
  const wantFG = canFG && !(twoScore && veryLate) && !(wp && fgProb != null && fgProb < 0.28);
  if (Math.random() < goProb) return "go";
  if (wantFG) return "fg";
  if (distFromGoal <= 38 && !canFG) return "go";
  return "punt";
}
// ─────────────────────────────────────────────────────────────────────────────
// PASS 6: REAL fake punt / fake FG paths. Until this pass a "fake" was the
// stFakes dial flipping the decision to a generic offensive snap (fakeSurprise
// ×1.1). These are dedicated compact resolvers (precedent: the reverse's
// dedicated branch): the upback takes a direct snap or the punter/holder
// throws, priced against the coverage unit's film study. __noSTFakes restores
// the legacy flip-to-go branch verbatim at the call site.
// ─────────────────────────────────────────────────────────────────────────────
function _stSniffRead(defRoster) {
  // The box-level "somebody smelled it" read: LB/S/OLB awareness plus the best
  // Film Junkie's level (Hook Rule — same eyes-on-film discipline family as
  // its paBite hook). Returns a convert-prob debit and the credited sniffer.
  const box = defRoster.filter((p) => ["LB", "OLB", "S"].includes(p.position)).slice(0, 12);
  const awr = box.length ? box.reduce((s, p) => s + (p.attributes.AWR || 50), 0) / box.length : 50;
  let film = 0, sniffer = null;
  for (const p of box) {
    const lv = traitLv(p, "filmJunkie");
    if (lv > film) { film = lv; sniffer = p; }
  }
  if (!sniffer && box.length) sniffer = box.slice().sort((a, b) => (b.attributes.AWR || 0) - (a.attributes.AWR || 0))[0];
  return { sniff: clamp2((awr - 50) * 4e-3, -0.08, 0.08) + 0.03 * film, snifferId: sniffer ? sniffer.id : null };
}
function resolveFakePunt(offRoster, offDepth, defRoster, defPlan, distance, seen) {
  const pId = (offDepth["P"] || [])[0];
  const punter = pId ? offRoster.find((p) => p.id === pId) : null;
  const pAcc = punter ? 0.5 * (punter.attributes.TEC || 0) + 0.5 * (punter.attributes.AWR || 0) : 40;
  const rbs = (offDepth["RB"] || []).map((id) => offRoster.find((p) => p.id === id)).filter(Boolean);
  const runner = rbs.slice().sort((a, b) => b.attributes.SPD * 0.55 + b.attributes.AWR * 0.45 - (a.attributes.SPD * 0.55 + a.attributes.AWR * 0.45))[0] || null;
  // Style: the upback direct-snap run is the default; the pass-fake shows up
  // ~40% of the time behind a punter whose hands/eyes clear the bar, ~15%
  // otherwise (attrs are universal — the HB-Pass precedent; the pricing below
  // reads his accuracy either way).
  const style = !runner || punter && Math.random() < (pAcc >= 52 ? 0.4 : 0.15) ? "pass" : "run";
  const { sniff, snifferId } = _stSniffRead(defRoster);
  // Posture: a block-mode rush vacates lanes and sets no return (fake-friendly);
  // safe-mode keeps a spy on the sticks.
  const posture = (defPlan == null ? void 0 : defPlan.puntDef) === "block" ? 0.08 : (defPlan == null ? void 0 : defPlan.puntDef) === "safe" ? -0.1 : 0;
  const surprise = seen === 0 ? 0.08 : -0.04 * Math.min(2, seen);
  const skill = style === "run" && runner ? (runner.attributes.SPD * 0.55 + runner.attributes.AWR * 0.45 - 55) * 4e-3 + 0.04 * traitLv(runner, "gadgetAce") : (pAcc - 52) * 5e-3;
  const convP = clamp2(0.62 - distance * 0.045 + skill + posture + surprise - sniff, 0.15, 0.9);
  // Disasters first: the pass-fake pick, the exchange fumble.
  if (style === "pass" && Math.random() < 0.06) return { style, converted: false, yards: 6, int: true, throwerId: pId || null, snifferId };
  if (style === "run" && Math.random() < 0.02) return { style, converted: false, yards: -2, fumble: true, runnerId: runner ? runner.id : null, snifferId };
  if (Math.random() < convP) {
    let yards = distance + Math.max(0, Math.round(randNorm(3.5, 3)));
    if (Math.random() < 0.05) yards += 15 + Math.round(Math.random() * 30);
    return { style, converted: true, yards, runnerId: style === "run" && runner ? runner.id : null, throwerId: style === "pass" ? pId || null : null, snifferId };
  }
  const yards = Math.max(-3, Math.min(distance - 1, Math.round(randNorm(distance * 0.45, 2))));
  return { style, converted: false, yards, runnerId: style === "run" && runner ? runner.id : null, throwerId: style === "pass" ? pId || null : null, snifferId };
}
function resolveFakeFG(offRoster, offDepth, defRoster, distance, distFromGoal, seen) {
  // The holder (the punter, per the standard operation) throws to a leaking TE
  // or keeps it himself — tighter yardage than the punt fake, goal-line only.
  const pId = (offDepth["P"] || [])[0];
  const holder = pId ? offRoster.find((p) => p.id === pId) : null;
  const hAcc = holder ? 0.5 * (holder.attributes.TEC || 0) + 0.5 * (holder.attributes.AWR || 0) : 40;
  const tes = (offDepth["TE"] || []).map((id) => offRoster.find((p) => p.id === id)).filter(Boolean);
  const target = tes[0] || null;
  const style = target && Math.random() < 0.65 ? "pass" : "keep";
  const { sniff, snifferId } = _stSniffRead(defRoster);
  const surprise = seen === 0 ? 0.08 : -0.04 * Math.min(2, seen);
  const skill = style === "pass" ? (hAcc - 52) * 5e-3 + (target ? (target.attributes.HND - 50) * 2e-3 : 0) : (holder ? (holder.attributes.SPD - 55) * 3e-3 : -0.05);
  const convP = clamp2(0.55 - distance * 0.05 + skill + surprise - sniff, 0.12, 0.85);
  if (style === "pass" && Math.random() < 0.07) return { style, converted: false, yards: 4, int: true, throwerId: pId || null, snifferId };
  if (Math.random() < convP) {
    const yards = Math.min(distFromGoal, distance + Math.max(0, Math.round(randNorm(2.5, 2))));
    return { style, converted: true, yards, throwerId: style === "pass" ? pId || null : null, runnerId: style === "keep" ? pId || null : null, targetId: style === "pass" && target ? target.id : null, snifferId };
  }
  const yards = Math.max(-2, Math.min(distance - 1, Math.round(randNorm(distance * 0.4, 1.5))));
  return { style, converted: false, yards, throwerId: style === "pass" ? pId || null : null, runnerId: style === "keep" ? pId || null : null, targetId: style === "pass" && target ? target.id : null, snifferId };
}
function puntResult(fieldPos, puntYds, punter = null) {
  const ballAt = fieldPos + puntYds;
  if (ballAt >= 100) {
    // Identity stage 3: Coffin Corner — the would-be touchback is angled out
    // or dropped and downed inside the 10 instead. Trait-only branch: a
    // punter without it gets the old touchback every time.
    const pinLv = traitLv(punter, "coffinCorner");
    if (pinLv && Math.random() < 0.1 * pinLv) return 4 + Math.floor(Math.random() * 6);
    return 20;
  }
  const defStart = clamp2(100 - ballAt, 20, 99);
  return clamp2(defStart, 6, 99);
}
function pickReturner(roster, returnerOverride) {
  if (returnerOverride) {
    const chosen = roster.find((p) => p.id === returnerOverride && ["RB", "WR", "CB", "S"].includes(p.position));
    if (chosen) {
      // identity stage 3: Return Vision — the return-path rating is his gift
      const rv = roleRating(chosen, "Returner") * traitMult(chosen, "returnVision", 0.02);
      return { player: chosen, rating: rv > 0 ? rv : 55 };
    }
  }
  let best = null, bestVal = -1;
  for (const p of roster) {
    if (!["RB", "WR", "CB", "S"].includes(p.position)) continue;
    const rv = roleRating(p, "Returner") * traitMult(p, "returnVision", 0.02);
    if (rv > bestVal) {
      bestVal = rv;
      best = p;
    }
  }
  return { player: best, rating: bestVal > 0 ? bestVal : 55 };
}
function returnMuff(returner, muffBase) {
  // Subsystem 6 PASS 2: does the returner bobble the catch? Ball-security is the
  // returner's hands (0.5*HND+0.5*SEC); a sure-handed man rarely muffs, a poor one
  // is a live turnover risk. When muffed, the kicking/coverage team falls on it
  // MUFF_RECOVER_KICK of the time (a turnover); otherwise the return team recovers
  // its own bobble (dead ball, no return).
  var sec = returner ? 0.5 * (returner.attributes.HND || 50) + 0.5 * (returner.attributes.SEC || 50) : 50;
  var muffP = clamp2((muffBase || 0) - (sec - C.MUFF_HND_PIVOT) * C.MUFF_HND_SCALE, 3e-3, 0.09);
  if (Math.random() >= muffP) return { muffed: false, lostToKicking: false };
  return { muffed: true, lostToKicking: Math.random() < C.MUFF_RECOVER_KICK };
}
function coverageStrength(roster, stGrade = 0) {
  const cov = roster.filter((p) => ["LB", "S", "CB"].includes(p.position)).slice(0, 8);
  // identity stage 3: Gunner — a schooled coverage man lifts the lane math
  const base = cov.length ? cov.reduce((s, p) => s + (p.attributes.SPD + p.attributes.STR) / 2 + 1.2 * traitLv(p, "gunner"), 0) / cov.length : 55;
  return base * (1 + (stGrade || 0) * 0.01);
}
function returnOutcome(retRating, cov, startLine, base, scheme, retLv = 0) {
  // ── PASS 6: return-scheme identity. One dial for the whole return game
  // (gp.retScheme): "safe" banks the catch (shorter, near-zero disaster, half
  // the house calls), "wall" sells out for the sideline wall (longer, ×1.6
  // break chance, an ~8% wall-collapse clawback, and the returner's gift —
  // returnVision — matters more). Absent/balanced (and under __noRetScheme)
  // is byte-for-byte the old math.
  const sch = globalThis.__noRetScheme ? "balanced" : scheme || "balanced";
  let effBase = base, breakMult = 1, edgeDiv = C.RETURN_EDGE_DIV, effRating = retRating;
  if (sch === "safe") {
    effBase = base - 2;
    breakMult = 0.5;
  } else if (sch === "wall") {
    effBase = base + 2;
    breakMult = 1.6;
    edgeDiv *= 0.85;
    effRating += 1.5 * (retLv || 0);
  }
  const edgeYds = (effRating - cov) / edgeDiv;
  let yds = Math.round(effBase + edgeYds + (Math.random() - 0.5) * C.RETURN_SPREAD);
  yds = Math.max(0, yds);
  if (sch === "wall" && Math.random() < 0.08) yds = Math.round(yds / 2);
  const roomToScore = 100 - startLine;
  let td = false;
  const breakChance = clamp2((effRating - cov + 5) / C.RETURN_TD_DIV * breakMult, 2e-3, C.RETURN_TD_MAX * breakMult);
  if (Math.random() < breakChance) {
    const house = startLine + yds + Math.round(20 + Math.random() * 70);
    if (house >= 100) {
      td = true;
      yds = roomToScore;
    } else yds += Math.round(25 + Math.random() * 40);
  }
  yds = Math.min(roomToScore, yds);
  return { yards: yds, td, startLine: clamp2(startLine + yds, 1, 100) };
}
function kickoffOutcome(kickingRoster, receivingRoster, returnerOverride, stGrade = 0, retScheme = null) {
  const k = kickingRoster.find((p) => p.position === "K");
  const leg = k ? (k.attributes.TEC + k.attributes.STR) / 2 : 55;
  // PASS 6: a safe-scheme return unit lets the deep-but-returnable ball go
  // (takes the touchback); a wall unit brings out a few more.
  const sch = globalThis.__noRetScheme ? "balanced" : retScheme || "balanced";
  const tbAdj = sch === "safe" ? 0.05 : sch === "wall" ? -0.04 : 0;
  const tbChance = clamp2(C.KICKOFF_TOUCHBACK_BASE + (leg - 55) / 220 + tbAdj, 0.35, 0.9);
  if (Math.random() < tbChance) {
    return { touchback: true, td: false, fieldPos: C.KICKOFF_START, returner: null };
  }
  const { player, rating } = pickReturner(receivingRoster, returnerOverride);
  const cov = coverageStrength(kickingRoster, stGrade);
  // PASS 2: fumbled kickoff return. When the coverage team falls on it (muffLost),
  // the receiving team loses possession near where it fielded the kick (~own 20);
  // the caller flips the ball to the kicking team. A recovered-own bobble just
  // plays as a normal return.
  const _kMuff = returnMuff(player, C.KO_MUFF_BASE);
  if (_kMuff.muffed && _kMuff.lostToKicking) {
    return { touchback: false, td: false, fieldPos: clamp2(Math.round(randNorm(20, 4)), 12, 30), returner: player, retYds: 0, muffLost: true };
  }
  const r = returnOutcome(rating, cov, 3, C.KICKOFF_RETURN_BASE, sch, traitLv(player, "returnVision"));
  return { touchback: false, td: r.td, fieldPos: r.startLine, returner: player, retYds: r.yards, muffLost: false };
}
function onsideResult(surprise = false, stGrade = 0, handsLv = 0) {
  // Subsystem 6 (Aug 2026): the flat 0.15 became a modeled rate. An EXPECTED onside (the only
  // path the sim triggers today — trailing, late, hands team out) recovers ~11%; a SURPRISE
  // onside (plumbed for a future AI trigger) ~60% (Harvard Sports Analysis). A well-coached
  // kicking unit (ST grade, player-coach only) recovers a touch more.
  // identity stage 3: Hands Team (receiving side) — the sure-handed front
  // line falls on it (kicking team recovers less often against them)
  const rate = ((surprise ? C.ONSIDE_SURPRISE : C.ONSIDE_EXPECTED) + (stGrade || 0) * 0.003) * (1 - 0.05 * (handsLv || 0));
  const recovered = Math.random() < clamp2(rate, 0.02, 0.85);
  return { recovered, fieldPos: recovered ? 50 : clamp2(Math.round(randNorm(48, 4)), 40, 60) };
}
function setPenaltyScale(v) {
  const n = Number(v);
  _penaltyScale = clamp2(Number.isFinite(n) ? n : 0.9, 0, 1.5);
}
function rollPenalty(side, offRoster, defRoster) {
  const pool = PENALTY_CATALOG.filter((p) => p.side === side);
  const total = pool.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  let penalty = pool[pool.length - 1];
  for (const p of pool) {
    if ((r -= p.weight) <= 0) {
      penalty = p;
      break;
    }
  }
  const roster = side === "offense" ? offRoster : defRoster;
  const candidates = roster.filter((p) => penalty.posGroup.includes(p.position));
  let player = null;
  if (candidates.length) {
    // Identity stage 3 (FLAWS, the PENALTY_CATALOG hooks): a flagged habit
    // makes the flag find HIM — attribution weight only, never the league
    // penalty rate (the per-play roll upstream is untouched).
    const flawWeight = (p) => {
      const n = penalty.name;
      if (n === "Pass Interference" || n === "Defensive Holding") return flawMult(p, "grabby", 0.35);
      if (n === "Offside" || n === "Encroachment" || n === "False Start") return flawMult(p, "jumpy", 0.35);
      if (n === "Offensive Holding") return flawMult(p, "holdingHabit", 0.35);
      if (n === "Facemask" || n === "Roughing the Passer") return flawMult(p, "headhunter", 0.35);
      return 1;
    };
    const wts = candidates.map((p) => {
      var _a;
      return clamp2(
        (C.PENALTY_DISC_PIVOT - ((_a = p.attributes[penalty.attr]) != null ? _a : 60)) / C.PENALTY_DISC_DIV,
        0.1,
        2
      ) * flawWeight(p);
    });
    const wsum = wts.reduce((s, w) => s + w, 0);
    let rr = Math.random() * wsum;
    for (let i = 0; i < candidates.length; i++) {
      if ((rr -= wts[i]) <= 0) {
        player = candidates[i];
        break;
      }
    }
    if (!player) player = candidates[0];
  }
  return { penalty, player };
}
function simulateDrive(offense, defense, gameState, log, opts = {}) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H, _I, _J, _K, _L, _M, _N, _O, _P, _Q, _R, _S, _T, _U, _V, _W, _X, _Y, _Z, __, _$, _aa, _ba, _ca, _da, _ea, _fa, _ga, _ha, _ia, _ja, _ka, _la, _ma, _na, _oa, _pa, _qa, _ra, _sa, _ta, _ua, _va, _wa, _xa, _ya, _za, _Aa, _Ba, _Ca;
  const { roster: offRoster, depth: offDepth, gameplan: offPlan, school: offSchool, ctx: offCtx } = offense;
  const { roster: defRoster, depth: defDepth, gameplan: defPlan, school: defSchool, ctx: defCtx } = defense;
  const R = opts.resume || null;
  let fieldPos = R ? R.fieldPos : gameState.fieldPos;
  let down = R ? R.down : 1, distance = R ? R.distance : 10;
  const plays = R ? R.plays : [];
  let forcedFourth = R ? R.decision || null : null;
  let forcedCall = R ? R.call || null : null;
  let forcedDefCall = R ? R.defCall || null : null;
  let fourthDecided = R ? !!R.fourthDecided : false;
  let fakeSurprise = false;
  let _spikedThisDrive = false;
  let audiblesUsed = R ? R.audiblesUsed || 0 : 0;
  const teamPenaltyMult = (roster) => {
    if (!roster.length) return 1;
    const disc = roster.reduce((s, p) => s + (p.attributes.AWR + p.attributes.TEC) / 2, 0) / roster.length;
    return clamp2(1 + (C.PENALTY_TEAM_PIVOT - disc) / C.PENALTY_TEAM_DIV, C.PENALTY_TEAM_MIN, C.PENALTY_TEAM_MAX);
  };
  const offPenMult = teamPenaltyMult(offRoster);
  const defPenMult = teamPenaltyMult(defRoster);
  const offFormIQ = coordPackageIQ(offSchool, offPlan);
  const pen = R ? R.pen : { offCount: 0, offYds: 0, defCount: 0, defYds: 0 };
  while (gameState.clock > 0 || down === 4 && !fourthDecided && gameState.half >= 2) {
    // Owner build 2026-08-17 (defensive timeout door + the latent burn bug):
    // capture the coach's timeout intent at the TOP of the snap, while the
    // forced call still exists — every downstream branch (special teams,
    // audibles, the coachCall stamp) nulls forcedCall/forcedDefCall before
    // the clock-runoff block, so the old burn check down there read null and
    // a player-called timeout NEVER actually burned (proved by probe §10's
    // pre-fix run). The flag names the side that spends the timeout: the
    // offensive sheet's chip burns the offense's, the defensive panel's
    // burns the defense's.
    const _toFlagSide = forcedCall && forcedCall.timeout ? gameState.offSide : forcedDefCall && forcedDefCall.timeout ? gameState.defSide : null;
    {
      const _lead = gameState.score.off - gameState.score.def;
      // Subsystem 5 (situational, Aug 2026): timeout-aware victory formation. A kneel
      // burns the full ~40s play clock ONLY when the trailing defense can't stop it;
      // if they still hold timeouts, they call one after each kneel and it burns just
      // ~2s of live time. The old code burned a flat 42/kneel and gated on 42×(4−down),
      // so a leading team entered victory formation far too early against a defense
      // holding three timeouts (it would "run out" a clock the defense could still stop).
      // Now the gate and the per-kneel burn both respect the defense's remaining TOs.
      const _defTOs = (gameState.timeouts && gameState.timeouts[gameState.defSide]) || 0;
      // downs left to kneel on (can kneel 1st/2nd/3rd, then 4th ends it): burnable time
      // = for each remaining kneel, 40s if the defense is out of TOs by then, else ~2s.
      const _downsLeft = Math.max(0, 3 - (down - 1));
      let _burnable = 0, _toLeft = _defTOs;
      for (let _k = 0; _k < _downsLeft; _k++) { _burnable += _toLeft > 0 ? 2 : 40; if (_toLeft > 0) _toLeft--; }
      if (gameState.half >= 2 && _lead > 0 && down <= 3 && gameState.clock <= _burnable) {
        // this kneel's burn: full play clock unless the defense spends a timeout on it
        var _kneelBurn;
        if (_defTOs > 0 && gameState.timeouts) {
          gameState.timeouts[gameState.defSide] = Math.max(0, _defTOs - 1);
          _kneelBurn = 2;
          log.push(`⏱️ Timeout — ${defSchool.name} (${gameState.timeouts[gameState.defSide]} left)`);
        } else {
          _kneelBurn = 40;
        }
        const burn = Math.min(gameState.clock, _kneelBurn);
        gameState.clock -= burn;
        if (gameState.clock <= 0) fourthDecided = true;
        log.push(`${offSchool.name} takes a knee`);
        plays.push({
          type: "kneel",
          yards: -1,
          down,
          distance,
          fieldPos,
          clock: gameState.clock,
          half: gameState.half,
          scoreOff: gameState.score.off,
          scoreDef: gameState.score.def
        });
        fieldPos = clamp2(fieldPos - 1, 1, 99);
        distance += 1;
        down++;
        forcedCall = null;
        continue;
      }
      if (gameState.half >= 2 && _lead < 0 && _lead >= -8 && down <= 2 && !_spikedThisDrive && gameState.clock <= 25 && gameState.clock > 4 && fieldPos >= 45) {
        _spikedThisDrive = true;
        gameState.clock -= 3;
        log.push(`${offSchool.name} spikes it \u2014 clock stopped`);
        plays.push({
          type: "spike",
          yards: 0,
          down,
          distance,
          fieldPos,
          clock: gameState.clock,
          half: gameState.half,
          scoreOff: gameState.score.off,
          scoreDef: gameState.score.def
        });
        down++;
        continue;
      }
    }
    const forcedST = forcedCall && (forcedCall.specialTeams === "fg" || forcedCall.specialTeams === "punt") ? forcedCall.specialTeams : null;
    if (down === 4 && !fourthDecided || forcedST) {
      const distFromGoal = 100 - fieldPos;
      const fgKickDist = distFromGoal + 17;
      const fourthApproach = ((_a = offSchool == null ? void 0 : offSchool.weeklyPlan) == null ? void 0 : _a.fourthDown) || offPlan.fourthDown || "Moderate";
      const secsLeft = gameState.half >= 2 ? gameState.clock : 9999;
      const scoreMargin = gameState.score.off - gameState.score.def;
      // Subsystem 5 fix E (Aug 2026): situational FG-range stretch. A team down by a
      // field goal or less in the final minutes will try a kick beyond its comfortable
      // range — the 52-yarder it would never attempt in the 1st quarter — because the
      // alternative is losing. attemptFG already prices in the lower make-probability at
      // distance; this just PERMITS the attempt. Neutral game / early = the base range.
      const _fgStretch = fgLateStretch(scoreMargin, secsLeft);
      const maxFG = (offPlan.maxFGDist || 42) + _fgStretch + 17;
      const canFG = fgKickDist <= maxFG && fieldPos >= 55;
      // ── PASS 6 (G9): WP context for the auto brain — the actual kicker's
      // make prob at this spot and the opponent-offense edge, computed from
      // numbers already on both rosters. Null under __noWP4th (legacy table).
      const _wpCtx = globalThis.__noWP4th ? null : {
        fgProb: fgMakeProb(offRoster, offDepth, fgKickDist, ((offSchool == null ? void 0 : offSchool._dnaGrades) == null ? void 0 : offSchool._dnaGrades.specialTeams) || 0, false),
        oppEdge: (() => {
          const oppO = defRoster.filter((p) => ["QB", "RB", "WR", "TE", "OL"].includes(p.position));
          const ownD = offRoster.filter((p) => ["DE", "DT", "LB", "OLB", "CB", "S"].includes(p.position));
          const oAvg = oppO.length ? oppO.reduce((s, p) => s + (p.compositeRating || 50), 0) / oppO.length : 50;
          const dAvg = ownD.length ? ownD.reduce((s, p) => s + (p.compositeRating || 50), 0) / ownD.length : 50;
          return clamp2((oAvg - dAvg) / 100, -0.15, 0.35);
        })()
      };
      let decision;
      if (forcedST) {
        decision = forcedST;
        forcedCall = null;
      } else if (forcedFourth) {
        decision = forcedFourth === "auto" ? fourthDownDecision(
          fieldPos,
          distance,
          distFromGoal,
          maxFG,
          canFG,
          fourthApproach,
          scoreMargin,
          secsLeft,
          _wpCtx
        ) : forcedFourth;
        forcedFourth = null;
      } else {
        const asked = opts.ask ? opts.ask({
          fieldPos,
          down,
          distance,
          distFromGoal,
          maxFG,
          canFG,
          scoreMargin,
          secsLeft,
          clock: gameState.clock,
          half: gameState.half
        }) : null;
        if (asked === "ASK") {
          return { pending: {
            fieldPos,
            down,
            distance,
            plays,
            pen,
            audiblesUsed,
            fourthDecided,
            clock: gameState.clock,
            sit: { distFromGoal, fgKickDist, maxFG, canFG, scoreMargin, secsLeft }
          } };
        }
        decision = asked || fourthDownDecision(
          fieldPos,
          distance,
          distFromGoal,
          maxFG,
          canFG,
          fourthApproach,
          scoreMargin,
          secsLeft,
          _wpCtx
        );
      }
      if (globalThis.__noSTFakes) {
        // Legacy branch verbatim (pre-Pass-6): the dial flips the decision to a
        // generic offensive snap with the fakeSurprise \u00d71.1 edge.
        const fakes = offPlan.stFakes || "never";
        if (fakes !== "never" && !forcedFourth) {
          const aggr = fakes === "aggressive";
          let fakeP = 0;
          if (decision === "punt" && distance <= 4 && fieldPos >= 35) fakeP = aggr ? 0.1 : 0.04;
          if (decision === "fg" && distance <= 3) fakeP = aggr ? 0.06 : 0.02;
          if (fakeP > 0 && Math.random() < fakeP) {
            log.push(`${offSchool.name} lines up to ${decision === "fg" ? "kick" : "punt"}\u2026 FAKE! They're going for it on 4th & ${distance}!`);
            fakeSurprise = true;
            decision = "go";
          }
        }
      } else {
        // \u2500\u2500 PASS 6: the REAL fake \u2014 a dedicated ST play, not a flipped snap.
        // Gate: dial (never/occasional/aggressive), eligibility windows, the
        // per-opponent seen-dock (oppMem.stFakes \u2014 each fake shown halves the
        // next roll, the oppMem.rpo pattern), the defense's punt posture, and
        // a desperation boost when trailing late.
        const fakes = offPlan.stFakes || "never";
        if (fakes !== "never" && !forcedFourth) {
          const aggr = fakes === "aggressive";
          const _fkMem = seenMemory(defCtx);
          const _fkSeen = _fkMem.stFakes || 0;
          let fakeP = 0;
          if (decision === "punt" && distance <= 5 && fieldPos >= 30 && fieldPos <= 65) fakeP = aggr ? 0.11 : 0.045;
          if (decision === "fg" && distance <= 3 && distFromGoal <= 12) fakeP = aggr ? 0.07 : 0.025;
          if (fakeP > 0) {
            const _fkMargin = gameState.score.off - gameState.score.def;
            if (_fkMargin < 0 && secsLeft <= 480) fakeP *= 1.5;
            fakeP *= Math.pow(0.5, Math.min(3, _fkSeen));
            if (decision === "punt" && (defPlan.puntDef || "balanced") === "safe") fakeP *= 0.7;
          }
          if (fakeP > 0 && Math.random() < fakeP) {
            _fkMem.stFakes = _fkSeen + 1;
            const fr = decision === "fg" ? resolveFakeFG(offRoster, offDepth, defRoster, distance, distFromGoal, _fkSeen) : resolveFakePunt(offRoster, offDepth, defRoster, defPlan, distance, _fkSeen);
            const rec = { type: decision === "fg" ? "fakeFG" : "fakePunt", style: fr.style, converted: !!fr.converted, yards: fr.yards || 0, runnerId: fr.runnerId || null, throwerId: fr.throwerId || null, targetId: fr.targetId || null, snifferId: fr.snifferId || null, int: !!fr.int, fumble: !!fr.fumble, down, distance, fieldPos, clock: gameState.clock, half: gameState.half, scoreOff: gameState.score.off, scoreDef: gameState.score.def };
            plays.push(rec);
            gameState.clock = Math.max(0, gameState.clock - (6 + Math.round(Math.random() * 4)));
            const _fkActor = fr.style === "pass" ? decision === "fg" ? "The holder throws" : "The punter throws" : fr.style === "keep" ? "The holder keeps it" : "Direct snap \u2014 the upback runs";
            log.push(`${offSchool.name} lines up to ${decision === "fg" ? "kick" : "punt"}\u2026 FAKE ${decision === "fg" ? "FIELD GOAL" : "PUNT"}! ${_fkActor} on 4th & ${distance}!`);
            if (fr.int) {
              log.push(`\u2026 and it's INTERCEPTED! ${defSchool.name} takes over.`);
              return { plays, result: "turnover", points: 0, finalFieldPos: 100 - clamp2(fieldPos + (fr.yards || 0), 1, 99), pen };
            }
            if (fr.fumble) {
              log.push(`\u2026 the exchange is FUMBLED! ${defSchool.name} falls on it.`);
              return { plays, result: "turnover", points: 0, finalFieldPos: 100 - clamp2(fieldPos + (fr.yards || 0), 1, 99), pen };
            }
            if (fr.converted) {
              const _fkPos = fieldPos + fr.yards;
              if (_fkPos >= 100) {
                rec.td = true;
                log.push(`\u2026 he takes it ALL THE WAY \u2014 TOUCHDOWN ${offSchool.name}!`);
                return { plays, result: "touchdown", points: 6, finalFieldPos: "kickoff", pen };
              }
              fieldPos = clamp2(_fkPos, 1, 99);
              down = 1;
              distance = Math.min(10, 100 - fieldPos);
              fourthDecided = false;
              log.push(`\u2026 they CONVERT! ${offSchool.name} moves the chains, 1st & ${distance} at ${fieldPos}.`);
              continue;
            }
            log.push(`\u2026 stuffed short of the sticks. Turnover on downs \u2014 ${defSchool.name} takes over.`);
            return { plays, result: "turnover_on_downs", points: 0, finalFieldPos: 100 - clamp2(fieldPos + Math.max(-3, fr.yards || 0), 1, 99), pen };
          }
        }
      }
      if (decision === "fg") {
        // G8 (Aug 2026): icing the kicker. On a clutch kick — second half,
        // under two minutes, the make ties it or takes the lead — a defense
        // holding a timeout burns one to make him stand there and think about
        // it. The real-world effect is small, and so is ours: C.ICE_KICKER_EFF
        // of would-be makes get shaken loose. Both AI and player defenses ice.
        let _iced = false;
        const _fgMargin = gameState.score.off - gameState.score.def;
        const _fgClutch = _fgMargin >= -3 && _fgMargin <= 0 && (gameState.half === 3 || gameState.half >= 2 && gameState.clock <= 180);
        if (_fgClutch && gameState.timeouts && (gameState.timeouts[gameState.defSide] || 0) > 0 && Math.random() < 0.55) {
          gameState.timeouts[gameState.defSide] = Math.max(0, (gameState.timeouts[gameState.defSide] || 0) - 1);
          _iced = true;
          log.push(`\u23F1\uFE0F Timeout \u2014 ${defSchool.name} ices the kicker (${gameState.timeouts[gameState.defSide]} left)`);
        }
        const _fgBlocked = Math.random() < C.FG_BLOCK_RATE;
        const made = !_fgBlocked && attemptFG(offRoster, offDepth, fgKickDist, ((offSchool == null ? void 0 : offSchool._dnaGrades) == null ? void 0 : offSchool._dnaGrades.specialTeams) || 0, _fgClutch || _iced) && !(_iced && Math.random() < C.ICE_KICKER_EFF);
        plays.push({
          type: "fg",
          made,
          iced: _iced,
          blocked: _fgBlocked,
          fgDist: fgKickDist,
          kickerId: (_b = (offDepth["K"] || [])[0]) != null ? _b : null,
          down,
          distance,
          fieldPos,
          clock: gameState.clock,
          half: gameState.half,
          scoreOff: gameState.score.off,
          scoreDef: gameState.score.def
        });
        if (made) {
          log.push(`FIELD GOAL \u2014 ${offSchool.name} hits from ${fgKickDist} yards!`);
          return { plays, result: "field_goal", points: 3, finalFieldPos: "kickoff", pen };
        } else {
          log.push(_fgBlocked ? `FIELD GOAL BLOCKED \u2014 ${defSchool.name} takes over!` : `Field goal MISSED \u2014 ${defSchool.name} takes over`);
          const defStart = clamp2(100 - (fieldPos - (_fgBlocked ? 5 : 7)), 1, 99);
          return { plays, result: "missed_fg", points: 0, finalFieldPos: defStart, pen };
        }
      }
      if (decision === "go") {
        log.push(`${offSchool.name} goes for it on 4th & ${distance}!`);
        fourthDecided = true;
      }
      if (decision !== "go") {
        if (fieldPos <= 8 && Math.random() < C.PUNT_SAFETY_DEEP) {
          log.push(`SAFETY \u2014 the snap sails out of the end zone! ${defSchool.name} scores 2.`);
          plays.push({ type: "punt", puntYds: 0, safety: true, touchback: false, punterId: (offDepth["P"] || [])[0] != null ? (offDepth["P"] || [])[0] : null, down, distance, fieldPos, clock: gameState.clock, half: gameState.half, scoreOff: gameState.score.off, scoreDef: gameState.score.def });
          return { plays, result: "safety", points: 2, finalFieldPos: "safety_kick", pen };
        }
        const puntYds = puntDistance(offRoster, offDepth);
        const _punter = (() => { const id = (offDepth["P"] || [])[0]; return id ? offRoster.find((pl) => pl.id === id) : null; })();
        const touchback = fieldPos + puntYds >= 100;
        let puntStart = puntResult(fieldPos, puntYds, _punter);
        if (touchback && puntStart !== 20) log.push("Coffin corner \u2014 downed inside the 10!");
        let returner = null, retYds = 0, puntRetTD = false;
        const puntDef = defPlan.puntDef || "balanced";
        const rushers = [...defRoster.filter((pl) => pl.position === "DE" || pl.position === "OLB")];
        const bestRush = rushers.length ? Math.max(...rushers.map((pl) => pl.attributes.SPD * 0.6 + pl.attributes.JMP * 0.4)) : 55;
        const athFactor = clamp2(0.5 + (bestRush - 55) / 50, 0.4, 1.6);
        const blockP = (puntDef === "block" ? 0.015 : puntDef === "balanced" ? 4e-3 : 1e-3) * athFactor;
        if (Math.random() < blockP) {
          log.push(`PUNT BLOCKED \u2014 ${defSchool.name} gets a hand on it!`);
          plays.push({
            type: "punt",
            puntYds: 0,
            blocked: true,
            touchback: false,
            punterId: (_c = (offDepth["P"] || [])[0]) != null ? _c : null,
            down,
            distance,
            fieldPos,
            clock: gameState.clock,
            half: gameState.half,
            scoreOff: gameState.score.off,
            scoreDef: gameState.score.def
          });
          return {
            plays,
            result: "turnover",
            points: 0,
            finalFieldPos: clamp2(100 - (fieldPos - 8), 5, 99),
            pen
          };
        }
        if (!touchback) {
          // identity stage 3: Hang Time — coverage under the ball forces the
          // fair catch (the returner never gets it in space)
          // PASS 6: return-scheme identity — a safe unit waves for it more, a
          // wall unit fields everything it can.
          const _retSch = globalThis.__noRetScheme ? "balanced" : defPlan.retScheme || "balanced";
          const _schFairAdj = _retSch === "safe" ? 0.12 : _retSch === "wall" ? -0.08 : 0;
          const _fairP = clamp2(C.PUNT_FAIR_CATCH * (1 + 0.08 * traitLv(_punter, "hangTime")) + _schFairAdj, 0, 0.95);
          if (Math.random() >= _fairP) {
            const { player, rating } = pickReturner(defRoster, (((_d = defSchool == null ? void 0 : defSchool.depthOrder) == null ? void 0 : _d.RET) || [])[0]);
            const cov = coverageStrength(offRoster, ((_e = offSchool == null ? void 0 : offSchool._dnaGrades) == null ? void 0 : _e.specialTeams) || 0);
            // PASS 2: muffed punt — the returner bobbles the catch under the coverage.
            const _pMuff = returnMuff(player, C.PUNT_MUFF_BASE);
            if (_pMuff.muffed) {
              plays.push({
                type: "punt",
                puntYds,
                touchback: false,
                muffed: true,
                muffLost: _pMuff.lostToKicking,
                returnerId: player ? player.id : null,
                punterId: (offDepth["P"] || [])[0] || null,
                returnYds: 0,
                returnTD: false,
                down,
                distance,
                fieldPos,
                clock: gameState.clock,
                half: gameState.half,
                scoreOff: gameState.score.off,
                scoreDef: gameState.score.def
              });
              if (_pMuff.lostToKicking) {
                log.push(`MUFFED PUNT — ${offSchool.name} recovers the bobble at the ${puntStart <= 50 ? puntStart : 100 - puntStart}!`);
                return { plays, result: "punt", points: 0, finalFieldPos: "muff_retain", muffFieldPos: clamp2(100 - puntStart, 1, 99), pen };
              }
              log.push(`Muffed punt — ${defSchool.name} falls on its own bobble, no return.`);
              return { plays, result: "punt", points: 0, finalFieldPos: puntStart, pen };
            }
            const r = returnOutcome(rating, cov, puntStart, C.PUNT_RETURN_BASE, _retSch, traitLv(player, "returnVision"));
            returner = player;
            retYds = Math.round(r.yards * (puntDef === "block" ? 0.5 : puntDef === "safe" ? 1.15 : 1));
            if (r.td) {
              puntRetTD = true;
              const retName = returner ? `${returner.name.first[0]}. ${returner.name.last}` : "The returner";
              log.push(`PUNT RETURN TOUCHDOWN \u2014 ${retName} goes the distance!`);
              plays.push({
                type: "punt",
                puntYds,
                touchback: false,
                returnerId: (_f = returner == null ? void 0 : returner.id) != null ? _f : null,
                punterId: (_g = (offDepth["P"] || [])[0]) != null ? _g : null,
                returnYds: retYds,
                returnTD: true,
                down,
                distance,
                fieldPos,
                clock: gameState.clock,
                half: gameState.half,
                scoreOff: gameState.score.off,
                scoreDef: gameState.score.def
              });
              return { plays, result: "punt_return_td", points: 6, finalFieldPos: "kickoff", pen };
            }
            puntStart = r.startLine;
          }
        }
        log.push(`Punt \u2014 ${offSchool.name} kicks ${puntYds} yards${!touchback && returner ? `, returned ${retYds} by ${returner.name.first[0]}. ${returner.name.last}` : ""}`);
        plays.push({
          type: "punt",
          puntYds,
          touchback,
          returnerId: (_h = returner == null ? void 0 : returner.id) != null ? _h : null,
          punterId: (_i = (offDepth["P"] || [])[0]) != null ? _i : null,
          returnYds: retYds,
          returnTD: false,
          down,
          distance,
          fieldPos,
          clock: gameState.clock,
          half: gameState.half,
          scoreOff: gameState.score.off,
          scoreDef: gameState.score.def
        });
        return { plays, result: "punt", points: 0, finalFieldPos: puntStart, pen };
      }
    }
    if (gameState.clock <= 0) break;
    if (opts.askCall && !forcedCall) {
      const sit = {
        down,
        distance,
        fieldPos,
        clock: gameState.clock,
        half: gameState.half,
        score: __spreadValues({}, gameState.score)
      };
      if (opts.askCall(sit) === "ASK") {
        const askSit = offSitWithOpeners(resolveSituation({
          down,
          distance,
          fieldPos,
          margin: gameState.score.off - gameState.score.def,
          clock: gameState.clock
        }), offPlan, gameState);
        const askEff = getEffectivePlan(offPlan, offSchool == null ? void 0 : offSchool.weeklyPlan, askSit);
        const formations = (askEff.offFormations || []).filter((f) => {
          var _a2;
          return f && FORMATION_PACKAGES[f.id] && ((_a2 = f.weight) != null ? _a2 : 0) > 0;
        }).map((f) => f.id);
        return { pending: {
          kind: "playcall",
          fieldPos,
          down,
          distance,
          plays,
          pen,
          audiblesUsed,
          fourthDecided,
          clock: gameState.clock,
          sit: __spreadProps(__spreadValues({}, sit), {
            formations: formations.length ? formations : [aliasFormation(offPlan.offFormation || "Single Back")],
            conceptsByGroup: conceptGroups(),
            // the sheet's ≈% follow the SITUATION (wizard grid)
            conceptWeights: (_j = askEff.conceptWeights) != null ? _j : null,
            // Madden pass 2: per-formation sheets ride along so the call sheet
            // can browse a pinned formation's own playbook
            formationPlaybooks: offPlan.formationPlaybooks || null
          })
        } };
      }
    }
    // F1 (defensive live calling, Aug 2026): the symmetric per-snap voice when
    // the coach's team is on DEFENSE. Same cadence gates as the offensive ask
    // (all snaps / key downs), same pending-token machinery — which means the
    // same save law for free: a live pause is never serialized
    // (gamePauseIsLive gates every save path on state.pendingHalftime).
    if (opts.askDefCall && !forcedDefCall && !forcedCall) {
      const sit = {
        down,
        distance,
        fieldPos,
        clock: gameState.clock,
        half: gameState.half,
        score: __spreadValues({}, gameState.score)
      };
      if (opts.askDefCall(sit) === "ASK") {
        const askSit = resolveSituation({
          down,
          distance,
          fieldPos,
          margin: gameState.score.def - gameState.score.off,
          clock: gameState.clock
        });
        const askEff = getEffectivePlan(defPlan, defSchool == null ? void 0 : defSchool.weeklyPlan, askSit);
        return { pending: {
          kind: "defcall",
          fieldPos,
          down,
          distance,
          plays,
          pen,
          audiblesUsed,
          fourthDecided,
          clock: gameState.clock,
          sit: __spreadProps(__spreadValues({}, sit), {
            // the standing call, so the panel shows what "ride the plan" means
            standing: {
              defFront: askEff.defFront,
              baseFront: defPlan.defBaseFront || "4-3",
              defAggression: askEff.defAggression,
              covShell: askEff.covShell,
              covStyle: askEff.covStyle,
              pressureIdentity: askEff.pressureIdentity,
              edgePlay: askEff.edgePlay,
              robberCall: askEff.robberCall,
              zoneStyle: askEff.zoneStyle,
              runCommit: askEff.runCommit
            }
          })
        } };
      }
    }
    {
      const flagOnOffense = Math.random() < C.PENALTY_OFF_SHARE;
      let iqPenMult = 1;
      if (flagOnOffense) {
        iqPenMult = 1 + Math.max(0, (C.PENALTY_IQ_PIVOT - offFormIQ) / C.PENALTY_IQ_DIV);
        iqPenMult = clamp2(iqPenMult, 1, C.PENALTY_IQ_MAX);
      }
      const _penDefSit = resolveSituation({ down, distance, fieldPos, margin: gameState.score.def - gameState.score.off, clock: gameState.clock });
      const _penDefEff = getEffectivePlan(defPlan, defSchool == null ? void 0 : defSchool.weeklyPlan, _penDefSit);
      const _penPress = (_penDefEff == null ? void 0 : _penDefEff.pressLevel) != null ? _penDefEff.pressLevel : defPlan.pressLevel;
      const _penBlitz = (_penDefEff == null ? void 0 : _penDefEff.blitzPct) != null ? _penDefEff.blitzPct : (_k = defPlan.blitzPct) != null ? _k : 20;
      const defAggrPen = 1 + (_penPress === "press" ? 0.12 : 0) + (_penBlitz >= 40 ? 0.08 : 0);
      const sideMult = flagOnOffense ? offPenMult * iqPenMult : defPenMult * defAggrPen;
      if (Math.random() < C.PENALTY_PER_PLAY * sideMult * _penaltyScale) {
        const onOffense = flagOnOffense;
        const { penalty, player } = rollPenalty(onOffense ? "offense" : "defense", offRoster, defRoster);
        const _forms = offPlan.offFormations || [];
        let _fw = _forms.reduce((s2, f) => s2 + (f.weight || 1), 0) * Math.random();
        let _penForm = ((_l = _forms[0]) == null ? void 0 : _l.id) || "Spread";
        for (const f of _forms) {
          if ((_fw -= f.weight || 1) <= 0) {
            _penForm = f.id;
            break;
          }
        }
        const _penFront = defPlan.defFront && defPlan.defFront !== "auto" ? defPlan.defFront : "4-3";
        const drilledAway = onOffense && penalty.preSnap && Math.random() < (((_m = offSchool == null ? void 0 : offSchool._dnaGrades) == null ? void 0 : _m.discipline) || 0) * 0.012;
        const yds = penalty.yards;
        const who = player ? `${player.name.first[0]}. ${player.name.last}` : null;
        const teamName = onOffense ? offSchool.name : defSchool.name;
        if (onOffense && !drilledAway) {
          fieldPos = clamp2(fieldPos - yds, 1, 99);
          distance += yds;
          pen.offCount++;
          pen.offYds += yds;
          log.push(`${penalty.name} on ${teamName}${who ? ` (${who})` : ""} \u2014 ${yds} yards`);
          plays.push({
            type: "penalty",
            penaltyName: penalty.name,
            penaltyOn: teamName,
            penaltySide: "offense",
            penaltyPlayerId: (_n = player == null ? void 0 : player.id) != null ? _n : null,
            penaltyPos: (_o = player == null ? void 0 : player.position) != null ? _o : null,
            offFormation: _penForm,
            defFront: _penFront,
            preSnap: !!penalty.preSnap,
            yards: -yds,
            autoFirst: false,
            down,
            distance,
            fieldPos,
            clock: gameState.clock,
            half: gameState.half,
            scoreOff: gameState.score.off,
            scoreDef: gameState.score.def
          });
          forcedCall = null;
          // Owner build 2026-08-17 (found by probe §7's next-snap audit): the
          // defensive forced call must clear on a penalty no-play exactly like
          // the offensive one — the stale call otherwise rides the replayed
          // down and the next snap resolves WITHOUT the every-snap ask that
          // callMode 'all' promises (a real snap slipping past the headset).
          forcedDefCall = null;
          continue;
        } else if (!onOffense) {
          const rawPos = fieldPos + yds;
          pen.defCount++;
          pen.defYds += yds;
          if (rawPos >= 100) {
            fieldPos = clamp2(Math.round((fieldPos + 100) / 2), 1, 99);
          } else {
            fieldPos = clamp2(rawPos, 1, 99);
          }
          const autoFirst = !!penalty.autoFirst;
          if (autoFirst) {
            down = 1;
            distance = 10;
            fourthDecided = false;
            log.push(`${penalty.name} on ${teamName}${who ? ` (${who})` : ""} \u2014 ${yds} yards, automatic first down`);
          } else {
            distance = Math.max(1, distance - yds);
            log.push(`${penalty.name} on ${teamName}${who ? ` (${who})` : ""} \u2014 ${yds} yards`);
          }
          plays.push({
            type: "penalty",
            penaltyName: penalty.name,
            penaltyOn: teamName,
            penaltySide: "defense",
            penaltyPlayerId: (_p = player == null ? void 0 : player.id) != null ? _p : null,
            penaltyPos: (_q = player == null ? void 0 : player.position) != null ? _q : null,
            offFormation: _penForm,
            defFront: _penFront,
            preSnap: !!penalty.preSnap,
            yards: yds,
            autoFirst,
            down,
            distance,
            fieldPos,
            clock: gameState.clock,
            half: gameState.half,
            scoreOff: gameState.score.off,
            scoreDef: gameState.score.def
          });
          forcedCall = null;
          forcedDefCall = null; // symmetric clear — see the offense branch above
          continue;
        }
      }
    }
    const _offSitRaw = resolveSituation({
      down,
      distance,
      fieldPos,
      margin: gameState.score.off - gameState.score.def,
      clock: gameState.clock
    });
    // F3 (openers, Aug 2026): a coach with an "Openers" cell scripts the first
    // two drives of the game — the script owns every ordinary snap, but the
    // emergency cells (goal line, backed up, the clock situations, red zone)
    // still take the wheel: nobody stays on the script at the goal line. No
    // cell = the resolved situation exactly, so untouched saves and every AI
    // plan are byte-identical to before.
    const offSit = offSitWithOpeners(_offSitRaw, offPlan, gameState);
    const defSit = resolveSituation({
      // The field zone is a property of where the BALL is, shared by both sides:
      // 'goal_line' = ball at the goal the offense attacks AND the defense protects.
      // Only the score margin flips frames (a trailing defense is desperate too).
      down,
      distance,
      fieldPos,
      margin: gameState.score.def - gameState.score.off,
      clock: gameState.clock
    });
    const offEff = getEffectivePlan(offPlan, offSchool == null ? void 0 : offSchool.weeklyPlan, offSit);
    const defEff = getEffectivePlan(defPlan, defSchool == null ? void 0 : defSchool.weeklyPlan, defSit);
    // F1: the coach's live defensive call beats the sheet for exactly this
    // snap. Applied before defPlanEff is built so every *Eff copy carries it.
    // A "ride the plan" resume carries the {_ride} sentinel — it changes
    // nothing but marks the snap answered, so the ask doesn't re-fire.
    if (forcedDefCall && !forcedDefCall._ride) applyDefCall(defEff, forcedDefCall, defSchool);
    // W4 (decision #6): the timeout's NEXT-PLAY layer. A timeout call armed
    // one-snap overrides on the live plan copy (gp._nextPlay, written by the
    // timeout adjustment screen); they beat the situation cell for exactly one
    // real snap and are cleared after it resolves.
    for (const [plan, eff] of [[offPlan, offEff], [defPlan, defEff]]) {
      const np = plan._nextPlay;
      if (!np) continue;
      Object.assign(eff, np);
      if (np.defAggression) {
        var _npA;
        eff.blitzPct = (_npA = C.AGGRESSION.rate[np.defAggression]) != null ? _npA : eff.blitzPct;
      }
    }
    const offPlanEff = __spreadProps(__spreadValues({}, offPlan), {
      qbRunPct: offEff.qbRunPct,
      passDepth: offEff.passDepth,
      passLeanShift: offEff.passLeanShift,
      optionRate: offEff.optionRate,
      jetRate: offEff.jetRate,
      drawRate: offEff.drawRate,
      // Rung 5 wizard grid: the SITUATION-effective sheet
      // (cell overlay merged in getEffectivePlan).
      conceptWeights: offEff.conceptWeights,
      protEmphasis: offEff.protEmphasis,
      qbAggr: offEff.qbAggr,
      // W4 (§16.2): the protection family, cell-overridable.
      protIdentityEff: offEff.protIdentity,
      _ocQbRunDesign: (_u = (_t = (_s = (_r = offSchool == null ? void 0 : offSchool.staff) == null ? void 0 : _r.oc) == null ? void 0 : _s.ratings) == null ? void 0 : _t.qbRunDesign) != null ? _u : 50,
      _injuriesOff: (offSchool == null ? void 0 : offSchool._injuriesOff) === true,
      _dnaAir: ((offSchool == null ? void 0 : offSchool._dnaGrades) == null ? void 0 : offSchool._dnaGrades.airAttack) || 0,
      _dnaGround: ((offSchool == null ? void 0 : offSchool._dnaGrades) == null ? void 0 : offSchool._dnaGrades.groundPound) || 0,
      _dnaBallSec: ((offSchool == null ? void 0 : offSchool._dnaGrades) == null ? void 0 : offSchool._dnaGrades.ballSecurity) || 0,
      _dnaRiver: ((offSchool == null ? void 0 : offSchool._dnaGrades) == null ? void 0 : offSchool._dnaGrades.riverboat) || 0,
      // Motion is GAMEPLAN-DRIVEN now (not a button): set below once the concept is
      // known — fires when the called concept wants motion AND motionRate is turned up.
      _forceMotion: false,
      // Play-action / RPO called deliberately (player choice): validated below.
      _forcePA: !!(forcedCall && forcedCall.playAction),
      _forceRPO: !!(forcedCall && forcedCall.rpo)
    });
    // W4 (§2): situation leverage class for the pressure translation — the
    // sim's own read of the down, not the coach's cell (that's the stop).
    const _defLev = defSit === "third_long" || defSit === "third_medium" || defSit === "two_min_trail" || defSit === "second_long" ? "pass" : defSit === "first_ten" || defSit === "base" ? "early" : "neutral";
    const defPlanEff = __spreadProps(__spreadValues({}, defPlan), {
      blitzPct: defEff.blitzPct,
      coverageScheme: defEff.coverageScheme,
      // W4 (§2): the aggression stop + pressure identity, cell-overridable.
      defAggrEff: defEff.defAggression,
      pressIdentityEff: defEff.pressureIdentity,
      _defLev,
      runCommitEff: defEff.runCommit,
      optionKeyEff: defEff.optionKey,
      // option assignment (weekly/situational overlay)
      edgePlayEff: defEff.edgePlay,
      // edge discipline (contain/balanced/crash)
      covShellEff: defEff.covShell,
      // safety shell (single/balanced/two)
      covStyleEff: defEff.covStyle,
      // man/balanced/zone
      pressLevelEff: defEff.pressLevel,
      // press/balanced/off cushion
      robberCallEff: defEff.robberCall,
      // P1-2: auto / rob / overtop
      zoneStyleEff: defEff.zoneStyle,
      // P1-3: spot / balanced / match
      bracketWhoEff: defEff.bracketWho,
      // auto/te1/slot/hot
      // DC Blitz Design (Phase 3): disguise quality. 50 is
      // neutral — the pre-coordinator game exactly.
      blitzDesign: (_y = (_x = (_w = (_v = defSchool == null ? void 0 : defSchool.staff) == null ? void 0 : _v.dc) == null ? void 0 : _w.ratings) == null ? void 0 : _x.blitzDesign) != null ? _y : 50,
      _dnaPressure: ((_z = defSchool == null ? void 0 : defSchool._dnaGrades) == null ? void 0 : _z.pressure) || 0,
      _dnaBallHawk: ((defSchool == null ? void 0 : defSchool._dnaGrades) == null ? void 0 : defSchool._dnaGrades.ballHawk) || 0
    });
    // PASS 4 (latent Pass-3 gap, fixed en route): the F1 live call applies via
    // applyDefCall BEFORE this build (3646), but nothing synced its call-only
    // ingredients onto the *Eff keys — an F1-loaded Prevent never actually cut
    // the rush to three, an F1 family pinned the name layer but its mechanics
    // (covFamilyEff/rotationEff/rush3Eff at the dial layer) stayed dead. One
    // unconditional sync here is idempotent for every later path (the sheet
    // sample and formChecks re-sync after their own applyDefCall).
    syncDefEff(defPlanEff, defEff);
    // W4 (§16.2): Quick Game caps depth — the ball is out before the deep
    // routes finish. Half the deep bucket becomes rhythm throws.
    if (offPlanEff.protIdentityEff === "quick" && offPlanEff.passDepth) {
      const d0 = offPlanEff.passDepth;
      const shift = Math.round((d0.deep || 0) * C.PROT_IDENTITY.quickDeepShift);
      offPlanEff.passDepth = { short: (d0.short || 0) + shift, medium: d0.medium || 0, deep: (d0.deep || 0) - shift };
    }
    const _namedPlay = forcedCall && forcedCall.concept && forcedCall.concept !== "sheet" && FORMATION_PLAYBOOK && Object.values(FORMATION_PLAYBOOK).some((l) => l.includes(forcedCall.concept)) ? forcedCall.concept : null;
    const _formEligible = _namedPlay ? ((id) => (FORMATION_PLAYBOOK[id] || []).includes(_namedPlay)) : null;
    const _forcedFormation = (forcedCall == null ? void 0 : forcedCall.formationId) && FORMATION_PACKAGES[forcedCall.formationId] ? forcedCall.formationId : null;
    // Multi-look fix (2026-08-15): roll the ENTRY, not just the id. A playbook
    // can carry the same formation as several weighted looks (Base + Trips + …);
    // rolling only the id and then asking pickedVariation() meant the FIRST
    // variation entry always won — the Base look never played and the look
    // weights were ignored. The winning entry now carries its own variation.
    const _rolledEntry = _forcedFormation ? null : rollFormationEntry(offEff.offFormations, _formEligible);
    const offFormationId = _forcedFormation ? _forcedFormation : aliasFormation((_rolledEntry && _rolledEntry.id) || offPlan.offFormation || "Single Back");
    // P1b: the selected formation may carry a VARIATION (a sparse delta over the
    // base look). A live human call can name it (forcedCall.variation); otherwise
    // the gameplan formation entry that won the roll carries it. Null = base look.
    // A forced call that names a formation but not a look rolls among that
    // formation's own entries by weight (multi-look aware).
    const offVar = (forcedCall == null ? void 0 : forcedCall.variation) || (_rolledEntry ? _rolledEntry.variation || null : (() => {
      const e = rollFormationEntry(offEff.offFormations, (fid) => fid === offFormationId);
      return e && aliasFormation(e.id) === offFormationId ? e.variation || null : null;
    })());
    // F2 (check-with-me, Aug 2026): the call sheet can key on the offense's
    // PERSONNEL, not just down-and-distance — "vs Empty, bring the house."
    // The check overlays the effective plan once the formation shows itself;
    // the coach's live call (F1) outranks any standing check. No formChecks on
    // the plan = today's game exactly. The punish side is already modeled:
    // motion and jet mechanics make an offense that shifts after the check
    // read exactly the answer real offenses are.
    // PASS 2 (Aug 2026): the named-call layer. Once the offense's personnel
    // shows itself, the matchup call sheet may sample a named call from the
    // coach's library — a saved package of the dials applyDefCall already
    // speaks. Priority (owner-ratified): the sampled call outranks the
    // standing plan AND the weekly reaction (you called it, you own it);
    // formChecks stay layered on top as formation-triggered audibles; the
    // live human call (F1) still beats everything. No sheet, an empty cell,
    // or __noDefCalls = today's game exactly.
    if (!forcedDefCall || forcedDefCall._ride) {
      const _dc = pickDefCall(defPlan, defSit, offPersonnelClass(offFormationId));
      if (_dc) {
        applyDefCall(defEff, _dc.call, defSchool);
        syncDefEff(defPlanEff, defEff);
        defPlanEff._defCallName = _dc.name;
      }
    }
    if ((!forcedDefCall || forcedDefCall._ride) && defPlan.formChecks) {
      const _chk = defPlan.formChecks[formationCheckClass(offFormationId)];
      if (_chk) {
        applyDefCall(defEff, {
          front: _chk.defFront && _chk.defFront !== "auto" ? _chk.defFront : null,
          covShell: _chk.covShell || null,
          covStyle: _chk.covStyle || null,
          edgePlay: _chk.edgePlay || null,
          pressureIdentity: _chk.pressureIdentity || null,
          aggression: _chk.defAggression || null,
          runCommit: _chk.runCommit != null ? clamp2(defEff.runCommit + _chk.runCommit, -25, 25) : null
        }, defSchool);
        syncDefEff(defPlanEff, defEff);
      }
    }
    const defFrontId = defEff.defFront !== "auto" ? defEff.defFront : selectDefFront(
      defPlan.defBaseFront || "4-3",
      down,
      distance,
      gameState.clock,
      gameState.half,
      gameState.score.def - gameState.score.off,
      offFormationId,
      (_B = (_A = defEff.subPhilosophy) != null ? _A : defPlan.subPhilosophy) != null ? _B : "auto",
      defPlan.defFrontMix || null
    );
    let playType = pickPlayType(
      offFormationId,
      offPlanEff,
      offEff.tendency,
      down,
      distance,
      fieldPos,
      gameState.score,
      gameState.clock,
      offVar
    );
    let forcedConceptName = null, forcedGadget = null;
    // Stage 4 (Playbook-Root): a COMPOSED play called from the headset.
    // forcedCall.customPlay names the book play; customPlayData carries its
    // composed source. compilePlay() is the proven fixed rulebook — every
    // derived grade is clamped to the catalog band, so a composed call can
    // never outgrade the strongest shipped concept. An invalid payload falls
    // through to the normal sheet call (never bricks a snap). Human-call-only
    // stays BY CONSTRUCTION: composed plays are never written into
    // PASS_CONCEPTS, the only pool the AI's pickPassConcept iterates, and only
    // the human call sheet authors forcedCall.customPlay.
    let composedCall = null, composedCallId = null;
    if (forcedCall && forcedCall.customPlay && forcedCall.customPlayData) {
      try {
        composedCall = compilePlay(forcedCall.customPlayData);
        composedCallId = String(forcedCall.customPlay);
      } catch (e) {
        composedCall = null;
        composedCallId = null;
      }
    }
    // D4/M2: a composed RUN carries its own play type (run_inside/run_outside
    // from the authored path); composed passes keep the depth-derived type.
    if (composedCall) playType = composedCall.type && composedCall.type.startsWith("run") ? composedCall.type : "pass_" + composedCall.depth;
    if (forcedCall && forcedCall.concept && forcedCall.concept !== "sheet") {
      const nm = forcedCall.concept;
      if (nm === "Draw") {
        playType = "run_inside";
        forcedGadget = "draw";
      } else if (nm === "Jet Sweep") {
        playType = "run_outside";
        forcedGadget = "jet";
      } else if (nm === "Triple Option") {
        playType = "run_inside";
        forcedGadget = "triple";
      } else if (nm === "Speed Option") {
        playType = "run_outside";
        forcedGadget = "speed";
      } else if (nm === "Wildcat Power") {
        playType = "run_inside";
        if (offFormationId === "Wildcat") forcedGadget = "wildcat";
      } else if (nm === "Reverse") {
        playType = "run_outside";
        forcedGadget = "reverse";
      } else if (nm === "Flea Flicker") {
        playType = "pass_deep";
        forcedGadget = "fleaflicker";
      } else if (nm === "HB Pass") {
        playType = "pass_deep";
        forcedGadget = "hbpass";
      } else if (PASS_CONCEPTS[nm]) {
        playType = "pass_" + PASS_CONCEPTS[nm].depth;
        forcedConceptName = nm;
      } else if ((_C = RUN_CONCEPTS[nm]) == null ? void 0 : _C.type) {
        playType = RUN_CONCEPTS[nm].type;
        forcedConceptName = nm;
      }
    }
    const categoryCalled = !forcedConceptName && !forcedGadget && !composedCall && !!(forcedCall == null ? void 0 : forcedCall.category) && CALL_CATEGORIES.has(forcedCall.category);
    if (categoryCalled) playType = forcedCall.category;
    const _fcPass = forcedConceptName ? PASS_CONCEPTS[forcedConceptName] : null;
    const _fcRun = forcedConceptName ? RUN_CONCEPTS[forcedConceptName] : null;
    const calledScreen = _fcPass && _fcPass.screen ? _fcPass.screen : null;
    const calledFade = !!(_fcPass && _fcPass.fade);
    const calledSneak = !!(_fcRun && _fcRun.qbSneak);
    const paValid = !!(forcedCall == null ? void 0 : forcedCall.playAction) && !forcedGadget && !calledScreen && !calledFade && playType.startsWith("pass");
    const rpoValid = !!(forcedCall == null ? void 0 : forcedCall.rpo) && !forcedGadget && !composedCall && !calledScreen && !calledFade;
    const qbRunValid = !!(forcedCall == null ? void 0 : forcedCall.qbRun) && !forcedGadget && !composedCall && playType.startsWith("run");
    if (paValid && playType === "pass_short" && !calledScreen) playType = "pass_medium";
    if (rpoValid && !playType.startsWith("run")) playType = "run_inside";
    offPlanEff._forcePA = paValid;
    offPlanEff._forceRPO = rpoValid;
    offPlanEff._forceQBRun = qbRunValid || calledSneak;
    offPlanEff._forceScreen = calledScreen;
    offPlanEff._forceFade = calledFade;
    offPlanEff._fadeOverride = calledFade ? ((offSchool == null ? void 0 : offSchool.depthOrder) || {}).FADE || null : null;
    offPlanEff._sneak = calledSneak;
    {
      const cn = forcedConceptName || null;
      const cPass = cn ? PASS_CONCEPTS[cn] : null;
      const cRun = cn ? RUN_CONCEPTS[cn] : null;
      const conceptWantsMotion = !!(cPass && cPass.motion || cRun && cRun.motion || forcedGadget === "jet");
      const motionAllowed = (offPlan.motionRate != null ? offPlan.motionRate : 100) > 0;
      offPlanEff._forceMotion = conceptWantsMotion && motionAllowed;
    }
    const coachCalled = !!(forcedConceptName || forcedGadget || composedCall);
    const familyPinned = coachCalled || categoryCalled;
    const activeOffDepth = filterActiveDepth(offDepth, offCtx, "off");
    const activeDefDepth = filterActiveDepth(defDepth, defCtx, "def");
    const offFA = (_E = (_D = offPlan.fieldAssignments) == null ? void 0 : _D.offense) == null ? void 0 : _E[offFormationId];
    const baseFront = defPlan.defBaseFront || "4-3";
    // Job-slot depth chart (Aug 2026): assignments are per-front — resolve the
    // front actually being fielded THIS snap, so a pinned NB/ROVER/EDGE rides
    // his package onto the field. Sub fronts with no pins keep the pure
    // scheme-fit picker (resolveDefPersonnel) — AI plans never pin, so AI
    // personnel selection is byte-identical.
    const defFA = (_G = (_F = defPlan.fieldAssignments) == null ? void 0 : _F.defense) == null ? void 0 : _G[defFrontId];
    const offPosOf = (id) => {
      var _a2;
      return ((_a2 = offRoster.find((p) => p.id === id)) == null ? void 0 : _a2.position) || null;
    };
    const defPosOf = (id) => {
      var _a2;
      return ((_a2 = defRoster.find((p) => p.id === id)) == null ? void 0 : _a2.position) || null;
    };
    // identity stage 2: full-object lookups so the resolver honours bridge
    // traits + size windows exactly as the depth-chart picker shows them
    const offById = (id) => offRoster.find((p) => p.id === id) || null;
    const defById = (id) => defRoster.find((p) => p.id === id) || null;
    // The three-places law (CLAUDE.md): the picker offers, the resolver
    // accepts, the sim receives. FADE was in the first two and missing here,
    // so a named fade man only ever played on a hand-called fade.
    const MESH_DEPTH_KEYS = ["SLOT", "FB", "WING", "ABACK", "WILDCAT", "JETMAN", "FADE"];
    let offDepthWithSlot = activeOffDepth;
    for (const key of MESH_DEPTH_KEYS) {
      const named = (_H = offSchool == null ? void 0 : offSchool.depthOrder) == null ? void 0 : _H[key];
      if (!(named == null ? void 0 : named.length)) continue;
      const live = named.filter((id) => offRoster.some((p) => p.id === id && p.injuryGamesOut === 0));
      if (live.length) offDepthWithSlot = __spreadProps(__spreadValues({}, offDepthWithSlot), { [key]: live });
    }
    // M2 personnel truth (owner decisions a+b, 2026-08-17): the VARIATION rides
    // into the field resolver, so the fielded eleven IS the look's pkg — the
    // authored VARIATION_LAYOUTS row re-dresses the moved bodies (Power-I Big
    // fields 3 TE, the Diamond fields a real FB, Air Raid Empty fields no
    // back). Base looks (offVar null) and every AI plan (AI never sets a
    // variation) resolve byte-identically to the pre-M2 read. Kill-switch
    // __noVarPkg restores base-personnel fielding for the A/B.
    const offField = resolveOffField(offFormationId, offFA == null ? void 0 : offFA.slots, offFA == null ? void 0 : offFA.shares, offDepthWithSlot, null, offPosOf, offById, offVar);
    const defHasPins = !!defFA && (Object.keys(defFA.slots || {}).length > 0 || Object.values(defFA.blitzShares || {}).some((v) => v > 0) || defFA.heat != null);
    const defBaseField = defFrontId === baseFront || defHasPins ? resolveDefField(defFrontId, defFA == null ? void 0 : defFA.slots, defFA == null ? void 0 : defFA.blitzShares, activeDefDepth, null, defPosOf, defById) : null;
    // BLITZ PIE (Ref/BLITZ_PIE_PLAN.md): the front's HEAT dial rides to the
    // rush resolver on the effective plan. null = neutral (every AI plan and
    // every untouched save). `__noBlitzPie`.
    defPlanEff._pieHeat = !globalThis.__noBlitzPie && defFA && defFA.heat != null ? defFA.heat : null;
    const offPersonnel = offField ? offField.personnel : resolvePersonnel(offFormationId, activeOffDepth, offVar);
    const defPersonnel = defBaseField ? defBaseField.personnel : resolveDefPersonnel(defFrontId, activeDefDepth, defRoster);
    const qb0 = (() => {
      const id = ((offPersonnel == null ? void 0 : offPersonnel.QB) || [])[0];
      return id ? offRoster.find((p) => p.id === id) : null;
    })();
    const losFree = (_I = offEff.losFreedom) != null ? _I : "auto";
    const sPl0 = (defPersonnel.S || []).map((id) => defRoster.find((pl) => pl.id === id)).filter(Boolean);
    const sAwr0 = sPl0.length ? sPl0.reduce((t, pl) => t + pl.attributes.AWR, 0) / sPl0.length : 50;
    // PASS 3: a called family IS the coverage — no coin flips. The implied
    // shell/style dials were already forced in applyDefCall, so both layers
    // agree. Absent (every pre-Pass-3 call and all plain dials) = the old roll.
    const covFam = !globalThis.__noCovFamilies && defEff.covFamily && FAMILY_SHELL[defEff.covFamily] ? defEff.covFamily : coverageFamily((_J = defEff.covShell) != null ? _J : "balanced", (_K = defEff.covStyle) != null ? _K : "balanced", sAwr0);
    const DISGUISE_SHOW = {
      "Cover 1": "Cover 2",
      "Cover 3": "Cover 2",
      "Cover 0": "Cover 1",
      "Cover 2": "Cover 3",
      "Cover 2-Man": "Cover 1",
      "Cover 4": "Cover 3",
      // PASS 3: Cover 6 sells the full two-high (quarters look); Tampa 2's
      // classic disguise is rolling from a single-high show; 2-Man shows
      // press-Cover 1 (already mapped). Prevent disguises nothing — everyone
      // in the stadium knows what it is, so it has no entry.
      "Cover 6": "Cover 2",
      "Tampa 2": "Cover 3"
    };
    const oppMemPre = seenMemory(defCtx);
    let shownFam = covFam, fooled = false;
    // PASS 4: the look sells the lie — a mug is a shown blitz everywhere, an
    // amoeba is no picture at all (its lift is big and its cap is higher; the
    // seller-side craft is Disguise Artist's surface come Pass 4.5).
    const _pfLook = !globalThis.__noPressFlavors && defEff.pressLook ? defEff.pressLook : null;
    if ((playType.startsWith("pass") || playType.startsWith("run")) && qb0) {
      // Identity stage 3: Disguise Artist — the seller side of the picture
      // duel (his pDisguise craft term; mug/amoeba gave it two more sellers).
      const _daLv = sPl0.reduce((m, pl) => Math.max(m, traitLv(pl, "disguiseArtist")), 0);
      const pDisguise = clamp2(0.1 + (((_L = defPlanEff.blitzDesign) != null ? _L : 50) - 50) * 4e-3 + (sAwr0 - 50) * 2e-3 + 0.012 * _daLv + Math.min(0.1, (oppMemPre.audibles || 0) * 0.012) + (_pfLook === "mug" ? C.PRESS_FLAVOR.mugDisguise : _pfLook === "amoeba" ? C.PRESS_FLAVOR.amoebaDisguise : 0), 0.04, _pfLook === "amoeba" ? C.PRESS_FLAVOR.amoebaDisguiseCap : 0.45);
      if (Math.random() < pDisguise) {
        shownFam = (_M = DISGUISE_SHOW[covFam]) != null ? _M : covFam;
        const craft = ((_N = defPlanEff.blitzDesign) != null ? _N : 50) * 0.5 + sAwr0 * 0.5 + 1.5 * _daLv;
        const read = ((_O = qb0.attributes.AWR) != null ? _O : 50) * 0.7 + ((_P = qb0.attributes.TEC) != null ? _P : 50) * 0.3;
        fooled = Math.random() < clamp2(0.5 + (craft - read) * 0.01, 0.15, 0.85);
      }
    }
    const believedFam = fooled ? shownFam : covFam;
    let killCall = null;
    if (qb0 && losFree !== "never" && !familyPinned) {
      const shellSeen = fooled && defEff.covShell !== "balanced" && defEff.covShell != null ? ["Cover 2", "Cover 4", "Cover 2-Man", "Cover 6", "Tampa 2", "Prevent"].includes(shownFam) ? -1 : 1 : defEff.covShell === "single" ? 1 : defEff.covShell === "two" ? -1 : 0;
      const boxScore = shellSeen + (defEff.runCommit || 0) / 12;
      // identity stage 3: Field General — the LOS kill-call brain (seeIt/pAud)
      const seeIt = clamp2((((_Q = qb0.attributes.AWR) != null ? _Q : 50) - 55) * 8e-3 * (losFree === "free" ? 1.5 : 1) + 6e-3 * traitLv(qb0, "fieldGeneral"), 0, 0.25) * (_pfLook === "amoeba" ? C.PRESS_FLAVOR.amoebaSeeIt : 1);
      if ((playType === "run_inside" || playType === "run_outside") && boxScore >= 1 && Math.random() < seeIt) {
        playType = "pass_short";
        killCall = "toPass";
      } else if (playType.startsWith("pass") && boxScore <= -1 && Math.random() < seeIt) {
        playType = "run_inside";
        killCall = "toRun";
      }
    }
    let shotCall = false;
    const covMem = offCtx._covSeen || (offCtx._covSeen = { fams: {}, blitz: 0, dropbacks: 0 });
    if (covMem.dropbacks >= 8 && !familyPinned) {
      const singles = (covMem.fams["Cover 1"] || 0) + (covMem.fams["Cover 3"] || 0) + (covMem.fams["Cover 0"] || 0) + (covMem.fams["C3 Fire Zone"] || 0);
      if (playType === "pass_medium" && singles / covMem.dropbacks >= 0.6 && Math.random() < 0.12) {
        playType = "pass_deep";
        shotCall = true;
      }
      if (playType === "pass_short" && covMem.blitz / covMem.dropbacks >= 0.35) {
        offPlanEff.screenRate = ((_R = offPlanEff.screenRate) != null ? _R : 14) + 6;
      }
    }
    const offWeights = getOffWeights(offFormationId, playType) || OFF_WEIGHTS[playType];
    const defWeights = getDefWeights(defFrontId, playType) || DEF_WEIGHTS[playType];
    const baseOffUnit = offPersonnel ? offUnitStrengthRoles(offPersonnel, offRoster, offWeights, offFormationId, playType) : 50;
    const baseDefUnit = defUnitStrengthSchemeFit(defPersonnel, defFrontId, defRoster, defWeights);
    const h2Counter = defPlan._h2Counter && defPlan._h2Counter.formationId === offFormationId ? 1 - defPlan._h2Counter.eff : 1;
    let concept = { name: null, mod: 0 };
    // Madden pass 2 (Aug 2026): formation-specific playbooks.
    // (a) The carry gate is ALWAYS on — every snap, coach-called or AI, picks
    //     from the plays the rolled formation actually runs (FORMATION_PLAYBOOK).
    //     Both pick functions fall back to the ungated pool if a formation/depth
    //     combo would empty out, so the gate can never brick a snap.
    // (b) An authored per-formation sheet (gp.formationPlaybooks[formationId])
    //     overlays the situation-effective weights concept-by-concept. Absent —
    //     which is every plan authored before this pass — the weights are exactly
    //     the old merged sheet (zero-migration law).
    const _pbGate = FORMATION_PLAYBOOK[offFormationId] || null;
    // PASS 6: AI staffs now author their own per-formation sheets (stamped
    // _aiAuthoredSheets by setAIGameplan). __noAIFormSheets ignores exactly
    // those — player-authored sheets are untouched — for a clean in-game A/B.
    // M2 (per-look sheets, 2026-08-17): the lookup goes through THE resolver —
    // this look's own forked sheet if it has one, else the formation's base
    // sheet byte-identically (inherit-with-override). Every pre-M2 plan is
    // base-keys-only, so this line resolves exactly as the old
    // formationPlaybooks[offFormationId] read did.
    const _fpbSheet = offPlan.formationPlaybooks && !(globalThis.__noAIFormSheets && offPlan._aiAuthoredSheets) ? resolveLookSheet(offPlan.formationPlaybooks, offFormationId, offVar) : null;
    let _cwEff = _fpbSheet && Object.keys(_fpbSheet).length ? { ...offPlanEff.conceptWeights || {}, ..._fpbSheet } : offPlanEff.conceptWeights || null;
    // ── M3 (D6, 2026-08-17): the qbRunPct dial prices the AUTHORED QB-run
    // family now that the organic dice are dead (§7.1). Only entries the
    // sheet does NOT set are defaulted from the dial — an explicit weight
    // (AI archetype weights, a human's own sheet) always wins. Dial 0 ⇒ the
    // family nearly never comes off an unset sheet (a pocket QB's coach
    // doesn't dial up QB Counter); dial 25 ⇒ it's a featured call.
    if (!globalThis.__qbDiceLegacy && (playType === "run_inside" || playType === "run_outside")) {
      const _qrp = clamp2(offPlanEff.qbRunPct || 0, 0, 30);
      for (const _qrNm of ["Zone Read", "QB Draw", "QB Counter", "QB Power"]) {
        if (_pbGate && !_pbGate.includes(_qrNm)) continue;
        if (!_cwEff) _cwEff = {};
        else if (_cwEff === offPlanEff.conceptWeights) _cwEff = { ...offPlanEff.conceptWeights };
        // Unset entries default from the dial; every entry then SCALES with
        // it — the dial is the family's volume knob (a scrambler's staff
        // doesn't just carry these plays, it builds the run game on them),
        // and one knob serves the AI's archetype dial and the human's Game
        // Plan dial identically. Weight-space, so the sheet's own relative
        // preferences inside the family survive.
        const _qrBase = _cwEff[_qrNm] != null ? _cwEff[_qrNm] : clamp2(8 + _qrp * 3, 5, 95);
        _cwEff[_qrNm] = clamp2(_qrBase * (1 + _qrp / 13), 0, 320);
      }
    }
    if (composedCall) {
      // The composed call IS the play — same shape the forced-name branch of
      // pickPassConcept produces, but the grades come from the band-clamped
      // compile above. The carry gate is bypassed exactly as it is for a
      // forced named concept (owner mandate: the call is the play).
      const skillC = execSkill(composedCall.exec || {}, offRoster, offPersonnel);
      // D4/M2: a composed run grades exactly the way pickRunConcept grades a
      // catalog run — the same boxState fork, reading the compiled (band-
      // clamped) vsBox. Composed passes read vs[covFam] as before.
      let vsC;
      if (composedCall.type && composedCall.type.startsWith("run")) {
        const boxStateC = (defEff.runCommit || 0) > 5 || defEff.covShell === "single" ? "loaded" : (defEff.runCommit || 0) < -5 || defEff.covShell === "two" ? "light" : null;
        vsC = boxStateC ? (composedCall.vsBox || {})[boxStateC] : 0;
      } else vsC = (composedCall.vs || {})[covFam];
      concept = { name: composedCall.name, mod: (vsC != null ? vsC : 0) * clamp2(1 + (skillC - 50) / 100, 0.6, 1.4) };
    } else if (playType.startsWith("pass")) concept = pickPassConcept(playType, offPersonnel, offRoster, covFam, _cwEff, forcedConceptName, _pbGate);
    else if (playType === "run_inside" || playType === "run_outside") concept = pickRunConcept(playType, offPersonnel, offRoster, defEff, _cwEff, forcedConceptName, _pbGate);
    let audible = false;
    // [OWNER MANDATE Aug 2026 — the call is the play] The QB's LOS freedom
    // governs SHEET plays only. When the coach called a concept by name (or
    // a gadget), it fires — no check-out, whatever the look. This was the
    // ~2% silent-substitution the play_fidelity_probe caught: smart QBs were
    // audibling out of explicit headset calls.
    if (concept.name && !forcedConceptName && !forcedGadget && !composedCall && playType.startsWith("pass") && qb0 && losFree !== "never" && audiblesUsed < (losFree === "free" ? 2 : 1)) {
      const calledVs = (_U = (_T = (_S = PASS_CONCEPTS[concept.name]) == null ? void 0 : _S.vs) == null ? void 0 : _T[believedFam]) != null ? _U : 0;
      const pAud = clamp2((((_V = qb0.attributes.AWR) != null ? _V : 50) - 55) * 0.012 + 8e-3 * traitLv(qb0, "fieldGeneral"), 0, 0.35) * (losFree === "free" ? 1.4 : 1);
      if (calledVs <= -0.02 && Math.random() < pAud) {
        const depth = playType.replace("pass_", "");
        const wrN = ((offPersonnel == null ? void 0 : offPersonnel.WR) || []).length;
        let bestName = null, bestVs = calledVs;
        for (const [nm, c] of Object.entries(PASS_CONCEPTS)) {
          if (c.depth !== depth || c.minWR && wrN < c.minWR) continue;
          if (_pbGate && !_pbGate.includes(nm)) continue;
          if (_cwEff && ((_W = _cwEff[nm]) != null ? _W : 50) <= 0) continue;
          const v = (_Y = (_X = c.vs) == null ? void 0 : _X[believedFam]) != null ? _Y : 0;
          if (v > bestVs) {
            bestVs = v;
            bestName = nm;
          }
        }
        if (bestName && bestName !== concept.name) {
          audible = true;
          audiblesUsed++;
          oppMemPre.audibles = (oppMemPre.audibles || 0) + 1;
          const c = PASS_CONCEPTS[bestName];
          const skill = execSkill(c.exec || {}, offRoster, offPersonnel);
          concept = {
            name: bestName,
            mod: ((__ = (_Z = c.vs) == null ? void 0 : _Z[covFam]) != null ? __ : 0) * clamp2(1 + (skill - 50) / 100, 0.6, 1.4)
          };
        }
      }
    }
    if (fooled) offPlanEff._fooled = true;
    _conceptCtx = {
      name: concept.name,
      // Stage 4: a composed call's compiled (band-clamped) concept object is the
      // snap's def context — same fields the resolution reads (depth/vs/exec),
      // absent flags (screen/fade/pulls/…) read falsy exactly like a catalog
      // concept that doesn't carry them.
      def: concept.name ? (_aa = (_$ = PASS_CONCEPTS[concept.name]) != null ? _$ : RUN_CONCEPTS[concept.name]) != null ? _aa : composedCall && composedCall.name === concept.name ? composedCall : null : null,
      fam: covFam,
      // PASS 3 (Aug 2026): the RESOLVED family's shell, stamped for assignCoverage.
      // Fix E (shell-wide press/off) and the leverage help-rule both read
      // _conceptCtx.shell — and nothing ever set it, so the live "corner bails vs
      // two-high" conversion was dead code since the coverage pass (the probe's
      // mean-neutrality checks passed either way). The family is the truth of the
      // snap (a "balanced" dial coin-flips inside coverageFamily), so the shell
      // comes from covFam, not the raw dial.
      shell: FAMILY_SHELL[covFam] || "single",
      edgePlay: defEff.edgePlay || "balanced"
    };
    offPlanEff._forcePANative = !!(concept.name && PASS_CONCEPTS[concept.name] && PASS_CONCEPTS[concept.name].paNative);
    const offUnit = baseOffUnit * (1 + concept.mod) * (fakeSurprise ? 1.1 : 1) * h2Counter * formationIqMod(offSchool, "off", offFormationId) * (2 - formationIqMod(defSchool, "def", defFrontId)) * getMatchupEdge(offFormationId, defFrontId, offVar) * getSituationalMod(offFormationId, down, distance, gameState.clock, fieldPos, offVar) * shortYardagePower(playType, distance, offPersonnel, offRoster) * (1 + (((_ba = offSchool == null ? void 0 : offSchool._dnaGrades) == null ? void 0 : _ba.groundPound) || 0) * 8e-3) * (down === 4 ? 1 + (((offSchool == null ? void 0 : offSchool._dnaGrades) == null ? void 0 : offSchool._dnaGrades.riverboat) || 0) * 0.01 : 1) * (offense.isHome ? C.HOME_EDGE : 1 - (1 - (2 - C.HOME_EDGE)) * (1 - (((offSchool == null ? void 0 : offSchool._dnaGrades) == null ? void 0 : offSchool._dnaGrades.roadWarrior) || 0) * 0.08)) * ((_ca = offense.form) != null ? _ca : 1) * (2 - ((_da = defense.form) != null ? _da : 1)) * ((_ea = offense.execMult) != null ? _ea : 1) * (2 - ((_fa = defense.execMult) != null ? _fa : 1)) + ((offPlan == null ? void 0 : offPlan._h2OffLean) ? offPlan._h2OffLean.eff * C.K_CONTEXT : 0);
    const rcDef = defEff.runCommit || 0;
    // PASS 3 (rotations, run side): the force rules are RUN-SUPPORT rules —
    // sky drops a safety onto the edge (the classic 8th-man force), cloud
    // makes the corner the force player, buzz sends the safety to the
    // interior hook where he's an extra downhill fitter. Single-high zone
    // only (the rotation is inert anywhere else), small, and folded into the
    // same defUnit multiplier lane the shell already uses.
    const rotRunMult = !globalThis.__noCovFamilies && defEff.rotation && (covFam === "Cover 3" || covFam === "C3 Fire Zone") ? defEff.rotation === "sky" ? playType === "run_outside" ? 1.04 : 1 : defEff.rotation === "cloud" ? playType === "run_outside" ? 1.02 : 1 : defEff.rotation === "buzz" ? playType === "run_inside" ? 1.02 : 1 : 1 : 1;
    // PASS 4 (looks, run side): a mug puts both backers IN the A-gaps — the
    // inside run meets them, the outside run outflanks bodies pinned inside;
    // an amoeba has nobody in a stance — the whole front fires off late.
    const flavRunMult = _pfLook && (playType === "run_inside" || playType === "run_outside") ? _pfLook === "mug" ? playType === "run_inside" ? C.PRESS_FLAVOR.mugRunIn : C.PRESS_FLAVOR.mugRunOut : C.PRESS_FLAVOR.amoebaRunSoft : 1;
    const shellRunMult = (playType === "run_inside" || playType === "run_outside" ? defEff.covShell === "single" ? 1.04 : defEff.covShell === "two" ? 0.95 : 1 : 1) * rotRunMult * flavRunMult;
    const edgeRunMult = defEff.edgePlay === "contain" ? playType === "run_outside" ? 1.04 : playType === "run_inside" ? 0.98 : 1 : defEff.edgePlay === "crash" ? playType === "run_outside" ? 0.96 : playType === "run_inside" ? 1.02 : 1 : 1;
    const oppMem = seenMemory(defCtx);
    _tkStyle = (_ha = (_ga = defEff.tackleStyle) != null ? _ga : defPlan.tackleStyle) != null ? _ha : "balanced";
    _optKey = (_ja = (_ia = defEff.optionKey) != null ? _ia : defPlan.optionKey) != null ? _ja : "balanced";
    const defAwrFactor = (() => {
      const readers = [...defPersonnel.LB || [], ...defPersonnel.S || []].map((id) => defRoster.find((p) => p.id === id)).filter(Boolean);
      const awr = readers.length ? readers.reduce((s2, p) => s2 + p.attributes.AWR, 0) / readers.length : 50;
      return clamp2(0.5 + (awr - 40) / 60, 0.5, 1.3);
    })();
    const famMult = familiarityMult(oppMem, playType, offFormationId, defAwrFactor);
    {
      const hot = Object.entries(oppMem.targets).sort((a, b) => b[1] - a[1])[0];
      defPlanEff._hotTargetId = hot && hot[1] >= 3 ? hot[0] : null;
    }
    const defUnit = (rcDef && (playType === "run_inside" || playType === "run_outside") ? baseDefUnit * (1 + rcDef * C.RUNCOMMIT_RUN_SCALE) : baseDefUnit) * edgeRunMult * shellRunMult * famMult * (1 + conceptSpamPen(oppMem, playType, concept.name, defAwrFactor)) + ((defPlan == null ? void 0 : defPlan._h2DefLean) ? defPlan._h2DefLean.eff * C.K_CONTEXT : 0);
    const onFieldOff = Object.values(offPersonnel).flat();
    const onFieldDef = Object.values(defPersonnel).flat();
    const effOffRoster = makeEffectiveRoster(
      onFieldOff,
      offRoster,
      offCtx.fatigueMap,
      slotMap(offPersonnel),
      (((_ka = offense.form) != null ? _ka : 1) * ((_la = offense.execMult) != null ? _la : 1) - 1) * C.FORM_ATTR_SCALE,
      gameState.half === 1
    );
    const effDefRoster = makeEffectiveRoster(
      onFieldDef,
      defRoster,
      defCtx.fatigueMap,
      slotMap(defPersonnel),
      (((_ma = defense.form) != null ? _ma : 1) * ((_na = defense.execMult) != null ? _na : 1) - 1) * C.FORM_ATTR_SCALE,
      gameState.half === 1
    );
    const qbId = ((offPersonnel == null ? void 0 : offPersonnel.QB) || activeOffDepth["QB"] || [])[0];
    let qb = qbId ? effOffRoster.find((p) => p.id === qbId) : null;
    if (!qb || qb.position !== "QB") {
      const byAwrTec = (a, b) => {
        var _a2, _b2, _c2, _d2;
        return (((_a2 = b.attributes) == null ? void 0 : _a2.AWR) || 0) + (((_b2 = b.attributes) == null ? void 0 : _b2.TEC) || 0) - ((((_c2 = a.attributes) == null ? void 0 : _c2.AWR) || 0) + (((_d2 = a.attributes) == null ? void 0 : _d2.TEC) || 0));
      };
      const healthyQBs = effOffRoster.filter((p) => p.position === "QB" && (p.injuryGamesOut || 0) === 0);
      if (healthyQBs.length) {
        qb = healthyQBs.slice().sort(byAwrTec)[0];
      } else if (!qb) {
        const skill = effOffRoster.filter((p) => ["RB", "WR", "TE"].includes(p.position));
        const pool = skill.length ? skill : effOffRoster;
        qb = pool.slice().sort(byAwrTec)[0] || null;
      }
    }
    let effPlayType = playType;
    let rpoFlip = false, rpoKept = false;
    // ── M3 (D6, 2026-08-17): the authored family's context. A called read
    // play (Zone Read, an always-RPO) or QB Draw must never be hijacked by
    // the organic option/jet/draw/gadget dice — the call IS the play. Old
    // concepts (QB Power/Sneak included) keep their pre-M3 hijack behavior
    // byte-for-byte.
    const _m3def = (_conceptCtx == null ? void 0 : _conceptCtx.def) || null;
    const _m3Authored = !!(_m3def && (_m3def.zoneRead || _m3def.rpo && _m3def.rpo.always || _m3def.qbCarry || _m3def.qbSneak));
    let rpoKeepOv = null;
    let optionSnap = false, optionStyle = "triple";
    if (forcedGadget === "triple" && qb) {
      optionSnap = true;
    } else if (forcedGadget === "speed" && qb) {
      optionSnap = true;
      optionStyle = "speed";
    } else if (playType.startsWith("run") && qb && !coachCalled && !_m3Authored) {
      if (OPTION_CAPABLE[offFormationId] != null) {
        const optShare = offPlanEff.optionRate != null ? clamp2(offPlanEff.optionRate / 100, 0, 1) : OPTION_CAPABLE[offFormationId];
        optionSnap = Math.random() < optShare;
      } else if (SPEED_OPTION[offFormationId] != null) {
        const optShare = SPEED_OPTION[offFormationId] * clamp2(((_oa = offPlanEff.optionRate) != null ? _oa : 70) / 70, 0, 1.5);
        if (Math.random() < optShare) {
          optionSnap = true;
          optionStyle = "speed";
        }
      }
    }
    // ── M3 (D6, 2026-08-17): ZONE READ — the authored RPO+QB-run type (#46,
    // ratified §7). The backside edge is the key: an end who crashes on the
    // back opens the KEEP (the QB runs out the grass he vacated); an end who
    // sits home means GIVE. edgePlay contain starves the keep, crash feeds
    // it, optionKey=qb puts the key's eyes on the QB — the counters the
    // audit demands (§5D) bite here by construction.
    let zrSnap = null;
    if (!optionSnap && !forcedGadget && qb && (_m3def == null ? void 0 : _m3def.zoneRead) && ((offPersonnel.RB || []).length + (offPersonnel.FB || []).length) > 0) {
      const _zDl = defPersonnel.DL || [];
      const _zkid = (defPersonnel.DE || [])[0] != null ? (defPersonnel.DE || [])[0] : _zDl.length ? _zDl[_zDl.length - 1] : (defPersonnel.OLB || [])[0] != null ? (defPersonnel.OLB || [])[0] : null;
      const _zkey = _zkid != null ? defRoster.find((p) => p.id === _zkid) || null : null;
      const _zEdge = defEff.edgePlay || "balanced";
      const _zCrashP = (_zEdge === "crash" ? 0.62 : _zEdge === "contain" ? 0.22 : 0.44) * (defEff.optionKey === "qb" ? 0.55 : 1);
      const _zCrash = Math.random() < _zCrashP;
      const _zqbRead = ((qb.attributes.AWR || 50) * 0.65 + (qb.attributes.TEC || 50) * 0.35);
      const _zReadP = clamp2(0.55 + (_zqbRead - ((((_zkey == null ? void 0 : _zkey.attributes) == null ? void 0 : _zkey.attributes.AWR) != null ? _zkey.attributes.AWR : 50) + 2 * traitLv(_zkey, "optionSound"))) * 6e-3 + 0.02 * traitLv(qb, "conflictReader"), 0.25, 0.85);
      const _zRead = Math.random() < _zReadP;
      const _zKeep = _zRead ? _zCrash : Math.random() < 0.25;
      if (_zKeep) {
        zrSnap = { phase: "keep", type: "run_outside", override: { carrier: qb, laneShift: _zRead ? 0.1 : -0.15, forcePenetrator: _zRead ? null : _zkey, phase: null } };
      } else {
        zrSnap = { phase: "give", type: "run_inside", override: { carrier: null, laneShift: _zRead && !_zCrash ? 0.08 : _zCrash ? -0.12 : 0.02, forcePenetrator: !_zRead && _zCrash ? _zkey : null, phase: null } };
      }
      effPlayType = zrSnap.type;
    }
    const rpoFit = (_pa = C.RPO_FIT[offFormationId]) != null ? _pa : 0.5;
    const rpoKeyMult = defEff.optionKey === "qb" ? 0.7 : 1;
    const calledRPO = !!(offPlanEff && offPlanEff._forceRPO);
    // M3: an authored RPO (RPO Glance / RPO Bubble) IS an RPO every snap —
    // the call is the play, no volume dice. The defense's answers live in
    // the read itself (pullEdge × rpoKeyMult, the keep share below), never
    // in un-calling the play.
    const rpoAlways = !!(_m3def && _m3def.rpo && _m3def.rpo.always);
    _rpoCtx = null;
    if (!optionSnap && !forcedGadget && !zrSnap && qb && (calledRPO || rpoAlways || rpoFit > 0 && playType.startsWith("run") && Math.random() < ((_qa = offPlanEff.rpoRate) != null ? _qa : 40) / 100 * rpoFit * rpoKeyMult)) {
      if (globalThis.__noRPOConflict) {
        // Legacy (pre-Pass-5) branch, byte-equivalent in behavior: team-dial
        // committed + flat LB-average read; the A/B isolates the new machinery.
        const lbs = ((defPersonnel == null ? void 0 : defPersonnel.LB) || []).map((id) => {
          var _a2;
          return (_a2 = defRoster == null ? void 0 : defRoster.find) == null ? void 0 : _a2.call(defRoster, (p) => p.id === id);
        }).filter(Boolean);
        const lbAWR = lbs.length ? lbs.reduce((s, p) => s + p.attributes.AWR, 0) / lbs.length : 50;
        const committed = (defEff.runCommit || 0) > 0 || Math.random() < 0.3;
        const readWin = Math.random() < clamp2(
          0.35 + (qb.attributes.AWR * 0.7 + qb.attributes.TEC * 0.3 - lbAWR) * 8e-3,
          0.1,
          0.75
        );
        if (committed && readWin) {
          effPlayType = "pass_short";
          rpoFlip = true;
        } else if (calledRPO) rpoKept = true;
      } else {
        // ── PASS 5: the conflict read. A NAMED defender (mesh role from the
        // run concept's rpo tag) is optioned post-snap; rpoConflictRead prices
        // his bite and the QB's eyes; the four cells carry signed edges into
        // the resolvers via _rpoCtx (run: laneQuality giveEdge · pass:
        // separation pullEdge replacing the old flat +0.07).
        const cdefRpo = (_conceptCtx == null ? void 0 : _conceptCtx.def) == null ? void 0 : _conceptCtx.def.rpo;
        const meshKey = (cdefRpo == null ? void 0 : cdefRpo.conflict) || (playType === "run_inside" ? "STACKER" : "OVERHANG");
        const rpoTag = (cdefRpo == null ? void 0 : cdefRpo.tag) || (playType === "run_inside" ? "glance" : "bubble");
        const pickBucket = (ids) => (ids || []).map((id) => {
          var _a2;
          return (_a2 = defRoster == null ? void 0 : defRoster.find) == null ? void 0 : _a2.call(defRoster, (p) => p.id === id);
        }).filter(Boolean);
        let pool = meshKey === "OVERHANG" ? pickBucket(defPersonnel == null ? void 0 : defPersonnel.OLB) : pickBucket(defPersonnel == null ? void 0 : defPersonnel.LB);
        if (!pool.length) pool = meshKey === "OVERHANG" ? pickBucket(defPersonnel == null ? void 0 : defPersonnel.S) : pickBucket(defPersonnel == null ? void 0 : defPersonnel.OLB);
        if (!pool.length) pool = pickBucket(defPersonnel == null ? void 0 : defPersonnel.LB).concat(pickBucket(defPersonnel == null ? void 0 : defPersonnel.S));
        const conflictDef = pool.sort((a, b) => ((b.attributes || {}).AWR || 0) - ((a.attributes || {}).AWR || 0))[0] || null;
        const rr = rpoConflictRead(qb, conflictDef, { runCommit: defEff.runCommit || 0, seenRPO: oppMem.rpo || 0 });
        const biteMargin = clamp2((rr.biteP - 0.3) * 0.5, 0, 0.25);
        if (rr.outcome === "pull" || rr.outcome === "wrongPull") {
          effPlayType = "pass_short";
          rpoFlip = true;
          _rpoCtx = {
            outcome: rr.outcome,
            tag: rpoTag,
            conflictId: (conflictDef == null ? void 0 : conflictDef.id) || null,
            qbId: qb.id,
            pullEdge: rr.outcome === "pull" ? clamp2(0.05 + biteMargin * 0.2, 0.04, 0.1) * rpoKeyMult : -0.08
          };
          // The pull IS a quick-game snap — restamp the concept context so
          // coverage prices a short RPO tag, not the run concept's box math
          // (fixes the latent stale-_conceptCtx bug the old flip carried).
          _conceptCtx = {
            name: "RPO " + (rpoTag === "glance" ? "Glance" : rpoTag === "slant" ? "Slant" : "Bubble"),
            def: { depth: "short" },
            fam: (_conceptCtx == null ? void 0 : _conceptCtx.fam) || null,
            shell: (_conceptCtx == null ? void 0 : _conceptCtx.shell) || "single",
            edgePlay: (_conceptCtx == null ? void 0 : _conceptCtx.edgePlay) || "balanced"
          };
        } else {
          // ── M3 (D6, 2026-08-17, ratified §7.6): the KEEP phase — the third
          // way of the read (#46). On a clean give read, a mobile QB can pull
          // it PAST the mesh and run: share dialed by gameplan.rpoKeepPct
          // (archetype-keyed by the AI), mobility-scaled so a statue almost
          // never keeps, and answered by the defense — optionKey=qb and a
          // contained edge starve it, a crashing edge feeds it. The keep
          // rides the option-keep run math (QB carrier through the run
          // resolver). Misreads (wrongGive) never convert — a QB who missed
          // the picture doesn't improvise a keep off it. __noRPOKeep kills.
          let _kOutcome = rr.outcome;
          if (!globalThis.__noRPOKeep && (rr.outcome === "give" || rr.outcome === "giveLate")) {
            const _kDial = clamp2((offPlanEff.rpoKeepPct != null ? offPlanEff.rpoKeepPct : 0) / 100, 0, 0.35);
            if (_kDial > 0) {
              const _kMob = ((qb.attributes.SPD || 50) + (qb.attributes.AGI || 50)) / 2;
              const _kMobScale = clamp2((_kMob - 38) / 22, 0.1, 1.5);
              const _kDefMult = (defEff.optionKey === "qb" ? 0.55 : 1) * (defEff.edgePlay === "contain" ? 0.7 : defEff.edgePlay === "crash" ? 1.25 : 1);
              if (Math.random() < clamp2(_kDial * 1.6 * _kMobScale * _kDefMult, 0, 0.5)) {
                _kOutcome = "keep";
                rpoKeepOv = { carrier: qb, laneShift: rr.outcome === "give" ? 0.08 : 0.02, forcePenetrator: null, phase: null };
              }
            }
          }
          _rpoCtx = {
            outcome: _kOutcome,
            tag: rpoTag,
            conflictId: (conflictDef == null ? void 0 : conflictDef.id) || null,
            qbId: qb.id,
            giveEdge: _kOutcome === "keep" ? 0 : rr.outcome === "give" ? 0.05 : rr.outcome === "giveLate" ? 0.025 : -0.07
          };
          if (calledRPO || rpoAlways) rpoKept = true;
        }
      }
    }
    _situDown = down;
    let jetMan = null;
    if (forcedGadget === "jet" && (offField == null ? void 0 : offField.bySlot)) {
      jetMan = (JET_SLOTS[offFormationId] || []).map((sid) => offField.bySlot[sid]).map((id) => id && effOffRoster.find((p) => p.id === id)).filter(Boolean).sort((a, b) => (b.attributes.SPD || 0) - (a.attributes.SPD || 0))[0] || null;
      if (!jetMan) {
        const onField = Object.values(offField.bySlot).map((id) => id && effOffRoster.find((p) => p.id === id)).filter(Boolean);
        const bySpeed = (arr) => arr.slice().sort((a, b) => (b.attributes.SPD || 0) - (a.attributes.SPD || 0))[0] || null;
        jetMan = bySpeed(onField.filter((p) => p.position === "WR")) || bySpeed(onField.filter((p) => p.position === "TE")) || bySpeed(onField.filter((p) => p.position === "RB")) || null;
      }
    } else if (!optionSnap && !coachCalled && !_rpoCtx && !zrSnap && !_m3Authored && effPlayType === "run_outside" && JET_CAPABLE[offFormationId] != null) {
      const jetShare = offPlanEff.jetRate != null ? clamp2(offPlanEff.jetRate / 100, 0, 1) : JET_CAPABLE[offFormationId];
      if (Math.random() < jetShare && (offField == null ? void 0 : offField.bySlot)) {
        jetMan = (JET_SLOTS[offFormationId] || []).map((sid) => offField.bySlot[sid]).map((id) => id && effOffRoster.find((p) => p.id === id)).filter(Boolean).sort((a, b) => (b.attributes.SPD || 0) - (a.attributes.SPD || 0))[0] || null;
      }
    }
    let wildcatTaker = null;
    if (offFormationId === "Wildcat" && !jetMan && (!coachCalled || forcedGadget === "wildcat") && (effPlayType === "run_inside" || effPlayType === "run_outside") && ((_ra = offField == null ? void 0 : offField.bySlot) == null ? void 0 : _ra.RB_H)) {
      wildcatTaker = effOffRoster.find((p) => p.id === offField.bySlot.RB_H) || null;
    }
    let drawSnap = false;
    // M3: an authored QB Draw takes the draw MACHINERY (caught-blitz vs
    // sniffed, below) with the QB as the carrier — it is not the organic
    // roll's business, and it never renames to "Draw".
    const qbDrawSnap = !!((_m3def == null ? void 0 : _m3def.qbDraw) && effPlayType === "run_inside" && !optionSnap && !forcedGadget && !zrSnap && !_rpoCtx && qb);
    if (forcedGadget === "draw" && effPlayType === "run_inside") {
      drawSnap = true;
    } else if (!optionSnap && !jetMan && !wildcatTaker && !coachCalled && !_rpoCtx && !zrSnap && !_m3Authored && effPlayType === "run_inside" && Math.random() < clamp2(((_sa = offPlanEff.drawRate) != null ? _sa : DRAW_DEFAULT) / 100, 0, 0.35)) {
      drawSnap = true;
    }
    // ── PASS 5: trick-play snaps (gadget tier). A coach-called gadget always
    // fires; the organic roll is gadget-rare (gp.gadgetRate, default 4%).
    // __noGadgets: the calls fall back to their vanilla cousins (plain
    // outside run / plain deep dropback) — the switch isolates the machinery.
    let gadgetSnap = forcedGadget === "reverse" || forcedGadget === "fleaflicker" || forcedGadget === "hbpass" ? forcedGadget : null;
    if (!gadgetSnap && !forcedGadget && !coachCalled && !optionSnap && !_rpoCtx && !zrSnap && !_m3Authored && !jetMan && !wildcatTaker && !drawSnap && qb && !globalThis.__noGadgets) {
      // PASS 6: + the weekly trick bump (_gadgetWk, re-rolled by
      // aiSetWeeklyReaction — a gambler leaning into an aggressive opponent).
      const _gWk = globalThis.__noTrickBrain ? 0 : offPlanEff._gadgetWk || 0;
      const gr = clamp2(((offPlanEff.gadgetRate != null ? offPlanEff.gadgetRate : GADGET_DEFAULT) + _gWk) / 100, 0, 0.12);
      // The organic roll respects the formation's book — a team only breaks
      // a trick it actually carries there (playbook-gate parity with the
      // sheet; Jumbo has no Flea Flicker to break).
      const _pbook = FORMATION_PLAYBOOK[offFormationId] || null;
      const inBook = (nm) => !_pbook || _pbook.includes(nm);
      // ── PASS 6: the trick-play auto-call brain (deferred from Pass 5, which
      // shipped tendency-priced RESOLUTION via gadgetBite). The CALL now reads
      // the same signals: a run-committed box invites the shot off the fake, a
      // crashing edge feeds the reverse, discipline starves both. Multipliers
      // stay inside the 0.12 clamp; __noTrickBrain reads flat (dial-only).
      let _shotMult = 1, _revMult = 1;
      if (!globalThis.__noTrickBrain) {
        const _rcRead = Math.max(0, Math.min(25, defPlanEff.runCommitEff || 0));
        _shotMult = (1 + _rcRead * 0.03) * (defPlanEff.covShellEff === "two" ? 0.75 : 1);
        _revMult = defPlanEff.edgePlayEff === "crash" ? 1.8 : defPlanEff.edgePlayEff === "contain" ? 0.5 : 1;
      }
      if (effPlayType === "run_outside" && inBook("Reverse") && Math.random() < clamp2(gr * _revMult, 0, 0.12)) gadgetSnap = "reverse";
      else if (effPlayType === "pass_deep" && (inBook("Flea Flicker") || inBook("HB Pass")) && Math.random() < clamp2(gr * _shotMult, 0, 0.12)) {
        const wantFF = Math.random() < 0.6;
        gadgetSnap = wantFF && inBook("Flea Flicker") ? "fleaflicker" : inBook("HB Pass") ? "hbpass" : "fleaflicker";
      }
    }
    if (globalThis.__noGadgets) gadgetSnap = null;
    let hbThrower = null;
    if (gadgetSnap === "hbpass") {
      hbThrower = (offPersonnel.RB || []).map((id) => effOffRoster.find((p) => p.id === id)).filter(Boolean).sort((a, b) => (b.attributes.TEC || 0) * 0.6 + (b.attributes.AWR || 0) * 0.4 - ((a.attributes.TEC || 0) * 0.6 + (a.attributes.AWR || 0) * 0.4))[0] || null;
      if (!hbThrower) gadgetSnap = "fleaflicker";
    }
    if (gadgetSnap === "fleaflicker" || gadgetSnap === "hbpass") {
      effPlayType = "pass_deep";
      offPlanEff._gadget = gadgetSnap;
    }
    let playResult;
    let revMan = null;
    if (gadgetSnap === "reverse" && (offField == null ? void 0 : offField.bySlot)) {
      const onField = Object.values(offField.bySlot).map((id) => id && effOffRoster.find((p) => p.id === id)).filter(Boolean);
      const bySpeed = (arr) => arr.slice().sort((a, b) => (b.attributes.SPD || 0) - (a.attributes.SPD || 0))[0] || null;
      revMan = bySpeed(onField.filter((p) => p.position === "WR")) || bySpeed(onField.filter((p) => p.position === "RB")) || null;
    }
    if (revMan) {
      playResult = resolveReverse(
        offPersonnel,
        defPersonnel,
        effOffRoster,
        effDefRoster,
        offUnit,
        defUnit,
        offPlanEff,
        __spreadProps(__spreadValues({}, defPlanEff), { _seenRev: oppMem.rev || 0 }),
        defFrontId,
        offFormationId,
        qb,
        revMan,
        (offPlan == null ? void 0 : offPlan.rbCarryShares) || null,
        offDepth["RB"] || null
      );
    } else if (jetMan && (effPlayType === "run_inside" || effPlayType === "run_outside")) {
      playResult = resolveJetSweep(
        offPersonnel,
        defPersonnel,
        effOffRoster,
        effDefRoster,
        offUnit,
        defUnit,
        offPlanEff,
        __spreadProps(__spreadValues({}, defPlanEff), { _seenJets: oppMem.jet }),
        defFrontId,
        offFormationId,
        qb,
        jetMan,
        (offPlan == null ? void 0 : offPlan.rbCarryShares) || null,
        offDepth["RB"] || null
      );
      playResult.jetSweep = true;
    } else if (optionSnap && (effPlayType === "run_inside" || effPlayType === "run_outside")) {
      let pitchManId = null;
      if (offField == null ? void 0 : offField.bySlot) {
        const wings = ["RB_H", "RB_2"].map((sid) => offField.bySlot[sid]).map((id) => id && effOffRoster.find((p) => p.id === id)).filter(Boolean);
        pitchManId = (_ua = (_ta = wings.sort((a, b) => (b.attributes.SPD || 0) - (a.attributes.SPD || 0))[0]) == null ? void 0 : _ta.id) != null ? _ua : null;
      }
      playResult = resolveOptionPlay(
        effPlayType,
        offPersonnel,
        defPersonnel,
        effOffRoster,
        effDefRoster,
        offUnit,
        defUnit,
        __spreadProps(__spreadValues({}, offPlanEff), { _pitchManId: pitchManId }),
        defPlanEff,
        defFrontId,
        offFormationId,
        qb,
        (offPlan == null ? void 0 : offPlan.rbCarryShares) || null,
        offDepth["RB"] || null,
        optionStyle
      );
    } else if (effPlayType === "run_inside" || effPlayType === "run_outside") {
      let drawOverride = null;
      if (drawSnap || qbDrawSnap) {
        // M3: qbDrawSnap rides the same caught-blitz/sniff fork with the QB
        // carrying (the concept's qbCarry does that); phase stays null so the
        // record keeps the authored name.
        const caughtBlitz = Math.random() < clamp2(((_va = defPlanEff.blitzPct) != null ? _va : 20) / 100 + (defPlanEff.edgePlayEff === "crash" ? 0.12 : defPlanEff.edgePlayEff === "contain" ? -0.06 : 0), 0.05, 0.75);
        const _drPhase = qbDrawSnap ? null : "draw";
        if (caughtBlitz) {
          drawOverride = { laneShift: 0.14, forcePenetrator: null, phase: _drPhase };
        } else {
          const mike = (defPersonnel.LB || []).map((id) => effDefRoster.find((p) => p.id === id)).filter(Boolean)[0] || null;
          const sniffP = clamp2(0.28 + (((_wa = mike == null ? void 0 : mike.attributes.AWR) != null ? _wa : 50) - 50) * 5e-3 - (((_xa = qb == null ? void 0 : qb.attributes.TEC) != null ? _xa : 50) - 50) * 18e-4 + Math.min(0.15, (oppMem.draw || 0) * 0.03), 0.1, 0.65);
          drawOverride = Math.random() < sniffP ? { laneShift: -0.12, forcePenetrator: mike, phase: _drPhase } : { laneShift: 0.04, forcePenetrator: null, phase: _drPhase };
        }
        if (qbDrawSnap) drawOverride.carrier = qb;
      }
      playResult = resolveRunPlay(
        effPlayType,
        offPersonnel,
        defPersonnel,
        effOffRoster,
        effDefRoster,
        offUnit,
        defUnit,
        offPlanEff,
        defFrontId,
        offFormationId,
        qb,
        (offPlan == null ? void 0 : offPlan.rbCarryShares) || null,
        offDepth["RB"] || null,
        wildcatTaker ? { carrier: wildcatTaker, laneShift: 0, forcePenetrator: null, phase: "wildcat" } : zrSnap ? zrSnap.override : rpoKeepOv != null ? rpoKeepOv : drawOverride
      );
      // M3 stamps: the record carries the family's own truth.
      if (zrSnap && playResult) {
        playResult.zoneRead = true;
        playResult.zrPhase = zrSnap.phase;
      }
      if (qbDrawSnap && playResult) playResult.qbDraw = true;
    } else {
      if (rpoFlip) offPlanEff._rpoFlip = true;
      playResult = resolvePassPlay(
        effPlayType,
        offPersonnel,
        defPersonnel,
        effOffRoster,
        effDefRoster,
        gadgetSnap === "hbpass" && hbThrower ? hbThrower : qb,
        offUnit,
        defUnit,
        offPlanEff,
        defPlanEff,
        defFrontId,
        (offField == null ? void 0 : offField.shareByPlayerId) || null,
        // Rung 3 (phantom-blitz fix): only a coach who has actually dialed
        // blitz shares uses the per-player model. AI teams and old saves fall
        // to the legacy pressureSource branch — which SENDS a real rusher.
        // (The {} map used to pass as truthy here: blitz downs "fired" with
        // zero extra rushers, league-wide, for every AI defense.)
        (defFA == null ? void 0 : defFA.blitzShares) && defBaseField ? defBaseField.blitzShareByPlayerId : null,
        offFormationId,
        (offField == null ? void 0 : offField.roleBySlotPlayer) || null,
        (defBaseField == null ? void 0 : defBaseField.dropShareByPlayerId) || null,
        fieldPos
      );
      if (rpoFlip) playResult.rpo = true;
    }
    if (rpoKept && playResult) playResult.rpoKept = true;
    if (_rpoCtx && playResult) {
      playResult.rpoRead = _rpoCtx.outcome;
      playResult.rpoTag = _rpoCtx.tag;
      playResult.rpoConflictId = _rpoCtx.conflictId;
      playResult.rpoQbId = _rpoCtx.qbId;
      if (!playResult.rpo && !playResult.rpoKept) playResult.rpoKept = true;
      _rpoCtx = null;
    }
    {
      let fam = covFam;
      // PASS 3: a PINNED family keeps its name on the ledger — the call is the
      // identity (a Tampa call that also fired heat is still the Tampa call).
      const _famPinned = !globalThis.__noCovFamilies && !!defEff.covFamily;
      if (playResult.fireZone && !_famPinned) fam = "C3 Fire Zone";
      else if (playResult.blitzFired && fam === "Cover 1" && ((_ya = defEff.blitzPct) != null ? _ya : 20) >= 40) fam = "Cover 0";
      playResult.coverage = fam;
      if (shownFam !== covFam) {
        playResult.shownCoverage = shownFam;
        if (fooled) playResult.fooled = true;
      }
      if (audible) playResult.audible = true;
      if (shotCall) playResult.shotCall = true;
      if (killCall) playResult.killCall = killCall;
      if (playType.startsWith("pass")) {
        covMem.dropbacks++;
        covMem.fams[fam] = (covMem.fams[fam] || 0) + 1;
        if (playResult.blitzFired) covMem.blitz++;
      }
      playResult.concept = playResult.gadget === "reverse" ? "Reverse" : playResult.gadget === "fleaflicker" ? "Flea Flicker" : playResult.gadget === "hbpass" ? "HB Pass" : playResult.optionPhase === "jet" ? "Jet Sweep" : playResult.optionPhase === "draw" ? "Draw" : playResult.optionPhase === "wildcat" ? "Wildcat Power" : ["dive", "keep", "pitch"].includes(playResult.optionPhase) ? optionStyle === "speed" ? "Speed Option" : "Triple Option" : concept.name;
    }
    if (fakeSurprise) playResult.stFake = true;
    fakeSurprise = false;
    oppMem.snaps++;
    oppMem.types[playType] = (oppMem.types[playType] || 0) + 1;
    oppMem.forms[offFormationId] = (oppMem.forms[offFormationId] || 0) + 1;
    if (playResult.concept) (oppMem.concepts || (oppMem.concepts = {}))[playResult.concept] = ((oppMem.concepts || {})[playResult.concept] || 0) + 1;
    if (playResult.jetSweep) oppMem.jet++;
    if (playResult.gadget === "reverse") oppMem.rev = (oppMem.rev || 0) + 1;
    if (playResult.rpo || playResult.rpoKept) oppMem.rpo++;
    if (playResult.optionPhase === "draw" || playResult.qbDraw) oppMem.draw++;
    if (playResult.targetId) oppMem.targets[playResult.targetId] = (oppMem.targets[playResult.targetId] || 0) + 1;
    if (forcedCall) {
      playResult.coachCall = true;
      forcedCall = null;
    }
    if (forcedDefCall) {
      if (!forcedDefCall._ride) playResult.defCoachCall = true;
      forcedDefCall = null;
    }
    const _carrierSlotId = playResult.rusherId && (offField == null ? void 0 : offField.bySlot) ? Object.keys(offField.bySlot).find((sid) => offField.bySlot[sid] === playResult.rusherId) || null : null;
    // Capstone P1: the target's exact field slot + the covering man's position,
    // so the viewer puts the ball in the RIGHT man's hands and the RIGHT body
    // in his hip pocket. Position (not slot) for the defender — the play's
    // front is auto-subbed per down and the viewer resolves the body by
    // pos + proximity, which degrades gracefully across fronts.
    const _targetSlotId = playResult.targetId && (offField == null ? void 0 : offField.bySlot) ? Object.keys(offField.bySlot).find((sid) => offField.bySlot[sid] === playResult.targetId) || null : null;
    const _armSwitch = armSwitchStamp(playResult, _carrierSlotId, _targetSlotId, OFF_FIELD_LAYOUTS[offFormationId]?.slots, 100 - fieldPos);
    const _defViewerSlots = (defBaseField == null ? void 0 : defBaseField.bySlot) || defViewerSlotMap(defFrontId, defPersonnel);
    if (playResult.trace) {
      const _covId = playResult.targetId && playResult.covAssign ? ((playResult.covAssign.find((c) => c.r === playResult.targetId) || {}).d || null) : null;
      const _covP = _covId ? defRoster.find((pp) => pp.id === _covId) : null;
      playResult.trace.covPos = _covP ? _covP.position : null;
    }
    plays.push(__spreadProps(__spreadValues({}, playResult), {
      down,
      distance,
      fieldPos,
      offFormation: offFormationId,
      defFront: defFrontId,
      // Stage 5 (Playbook-Root): the record knows the CALL — which BOOK the
      // snap came from, which LOOK (variation) was fielded, and, for a
      // composed play, which book play produced it. Recording only: consumes
      // no RNG and feeds no outcome; the broadcast/replay draw the card from
      // these stamps. (offFormation + concept were already recorded above.)
      bookName: offSchool && offSchool.book && offSchool.book.name || offPlan._playbookName || null,
      variation: offVar || null,
      customPlayId: composedCall ? composedCallId : null,
      carrierSlotId: _carrierSlotId,
      targetSlotId: _targetSlotId,
      armSwitch: _armSwitch,
      // Arm talent stamp (recording only): the viewer reads this for
      // ball-flight zip/arc. Never feeds back into any outcome.
      qbArm: (() => {
        var _a2;
        const qid = (_a2 = offField == null ? void 0 : offField.bySlot) == null ? void 0 : _a2.QB;
        const q = qid ? offRoster.find((pp) => pp.id === qid) : null;
        return q ? q.attributes.STR : null;
      })(),
      // Slot-level truth stamps (recording only): the beaten cover
      // man and the coverage matchups, translated player→slot so the
      // viewer animates the SIM'S assignments, not proximity guesses.
      beatenDefSlot: (() => {
        const bs = defBaseField == null ? void 0 : defBaseField.bySlot;
        if (!bs || !playResult.beatenDefId) return null;
        return Object.keys(bs).find((sid) => bs[sid] === playResult.beatenDefId) || null;
      })(),
      covSlots: (() => {
        const ob2 = offField == null ? void 0 : offField.bySlot, db = defBaseField == null ? void 0 : defBaseField.bySlot;
        if (!ob2 || !db || !playResult.covAssign) return null;
        const inv = (m) => {
          const o = {};
          for (const k of Object.keys(m)) o[m[k]] = k;
          return o;
        };
        const oi = inv(ob2), di = inv(db);
        const out = playResult.covAssign.map((c) => ({ r: oi[c.r], d: di[c.d], t: c.t })).filter((c) => c.r && c.d);
        return out.length ? out : null;
      })(),
      // M20 contact truth stamps (recording only): tackle credit translated
      // player→slot so the viewer stages the SIM'S tackler, assist, strip and
      // broken tackle instead of a proximity guess. No outcome path reads
      // these — same contract as beatenDefSlot/covSlots above.
      contactSlots: (() => {
        const db = defBaseField == null ? void 0 : defBaseField.bySlot;
        if (!db) return null;
        const inv = {};
        for (const k of Object.keys(db)) inv[db[k]] = k;
        const out = {
          tackler: playResult.tacklerId && inv[playResult.tacklerId] || null,
          assist: playResult.assistId && inv[playResult.assistId] || null,
          ff: playResult.ffId && inv[playResult.ffId] || null,
          brokenBy: playResult.brokenById && inv[playResult.brokenById] || null
        };
        return out.tackler || out.assist || out.ff || out.brokenBy ? out : null;
      })(),
      // M21 ball truth stamps (recording only): the credited pass-breakup
      // man and interceptor translated player→slot so the viewer deflects
      // and picks with the SIM'S man instead of a proximity guess. No
      // outcome path reads these — same contract as contactSlots above.
      ballSlots: (() => {
        const db = defBaseField == null ? void 0 : defBaseField.bySlot;
        if (!db) return null;
        const inv = {};
        for (const k of Object.keys(db)) inv[db[k]] = k;
        const out = {
          pbu: playResult.pbuId && inv[playResult.pbuId] || null,
          pick: playResult.intPickerId && inv[playResult.intPickerId] || null
        };
        return out.pbu || out.pick ? out : null;
      })(),
      offSpd: slotSpeedMap(offField == null ? void 0 : offField.bySlot, offRoster),
      defSpd: (defBaseField == null ? void 0 : defBaseField.bySlot) ? slotSpeedMap(defBaseField.bySlot, defRoster) : slotBodyFallbackMap(_defViewerSlots, defRoster),
      offSit,
      // _liveTempo dead reads deleted (D16/OD ratified, 2026-08-18): the key
      // was read in three places and written by NOTHING in js/ or tools/ —
      // behavior-neutral by construction. If a live-tempo control is ever
      // built, it goes through the plan/overlay, not a hidden runtime key.
      tempo: offEff.tempo,
      blitzFired: (_za = playResult.blitzFired) != null ? _za : false,
      // BLITZ PIE: who came (ids), when a blitz fired — probe/film surface
      blitzerIds: playResult.blitzerIds || null,
      fireZone: playResult.fireZone || false,
      clock: gameState.clock,
      half: gameState.half,
      scoreOff: gameState.score.off,
      scoreDef: gameState.score.def
    }));
    // W4 (decision #6): the timeout's next-play layer is spent — a real snap
    // just resolved on it. (Pre-snap replays never reach here, so a replayed
    // down keeps the layer armed.)
    if (offPlan._nextPlay) delete offPlan._nextPlay;
    if (defPlan._nextPlay) delete defPlan._nextPlay;
    const isHurry = offEff.tempo === "Hurry";
    const _gpGrade = ((offSchool == null ? void 0 : offSchool._dnaGrades) == null ? void 0 : offSchool._dnaGrades.groundPound) || 0;
    const _late = (gameState.half || 1) >= 2;
    const _gpFatigueMult = _late ? 1 - _gpGrade * 0.015 : 1;
    const _offFresh = (offPlan == null ? void 0 : offPlan._h2Fresh) ? 1 - offPlan._h2Fresh.eff : 1;
    const _defFresh = (defPlan == null ? void 0 : defPlan._h2Fresh) ? 1 - defPlan._h2Fresh.eff : 1;
    updateFatigue(
      offRoster,
      offPersonnel,
      offCtx,
      defRoster,
      defPersonnel,
      defCtx,
      (isHurry ? C.TEMPO_FATIGUE_OFF : 1) * _gpFatigueMult * _offFresh,
      (isHurry ? C.TEMPO_FATIGUE_DEF : 1) * _defFresh
    );
    // PASS 7 (Fix D): job-snap tracking — which BUCKET each body was actually
    // fielded in this snap. Defense reads the primitive personnel buckets
    // (covers both the pinned resolveDefField path and the scheme-fit picker);
    // offense reads the layout's out-of-native map (mesh buckets redistribute
    // to native downstream, so the layout is the only place that still knows).
    // Pure bookkeeping — nothing in the sim reads these. `__noSnapTrack`.
    if (!globalThis.__noSnapTrack) {
      const jm = (ctx2, id, key) => {
        const m = ctx2.jobSnapMap || (ctx2.jobSnapMap = {});
        const e = m[id] || (m[id] = {});
        e[key] = (e[key] || 0) + 1;
      };
      for (const bucket of ["DE", "DT", "OLB", "ILB", "CB", "S"]) {
        for (const id of defPersonnel[bucket] || []) {
          const nat = defPosOf(id);
          if (!nat) continue;
          const natBucket = nat === "LB" ? "ILB" : nat;
          if (bucket !== natBucket) jm(defCtx, id, bucket);
        }
      }
      const _oop = offField == null ? void 0 : offField.oopByPlayer;
      if (_oop) for (const [id, key] of Object.entries(_oop)) jm(offCtx, id, key);
    }
    if (!offPlanEff._injuriesOff && playResult.qbInjured && playResult.qbInjuryGames > 0 && playResult.rusherId) {
      const injQb = offRoster.find((p) => p.id === playResult.rusherId);
      if (injQb) {
        const medMult = 1 - (((_Ba = (_Aa = offSchool == null ? void 0 : offSchool.facilities) == null ? void 0 : _Aa.medicine) != null ? _Ba : 2) - 2) * 0.08;
        injQb.injuryGamesOut = Math.max(1, Math.round(Math.max(injQb.injuryGamesOut || 0, playResult.qbInjuryGames) * medMult));
        injQb.injury = makeInjury(injQb.injuryGamesOut, gameState.week || 0);
        offCtx.benchedMap[injQb.id] = true;
      }
    }
    const tempoMult = (_Ca = C.TEMPO_MULT[offEff.tempo]) != null ? _Ca : 1;
    let elapsed = Math.max(4, Math.round(randNorm(
      (playType.startsWith("run") ? C.CLOCK_RUN.mean : C.CLOCK_PASS.mean) * tempoMult,
      playType.startsWith("run") ? C.CLOCK_RUN.sd : C.CLOCK_PASS.sd
    )));
    const _toState = gameState.timeouts;
    let _playerBurned = false;
    if (_toState && _toFlagSide && (_toState[_toFlagSide] || 0) > 0 && !playResult.scored) {
      _toState[_toFlagSide] = Math.max(0, (_toState[_toFlagSide] || 0) - 1);
      elapsed = Math.max(4, elapsed - C.TIMEOUT_RUNOFF_SAVED);
      const _toSchool = _toFlagSide === gameState.offSide ? offSchool : defSchool;
      log.push(`\u23F1\uFE0F Timeout \u2014 ${(_toSchool == null ? void 0 : _toSchool.name) || "You"} (${_toState[_toFlagSide]} left)`);
      _playerBurned = true;
    }
    if (!_playerBurned && _toState && gameState.half >= 2 && gameState.clock <= 120 && !playResult.turnover && !playResult.scored && playType.startsWith("run")) {
      const margin = gameState.score.off - gameState.score.def;
      const defTrailing = margin > 0;
      const offTrailing = margin < 0;
      let stopper = null;
      if (defTrailing && (_toState[gameState.defSide] || 0) > 0) stopper = gameState.defSide;
      else if (offTrailing && (_toState[gameState.offSide] || 0) > 0) stopper = gameState.offSide;
      if (stopper) {
        _toState[stopper] = Math.max(0, (_toState[stopper] || 0) - 1);
        elapsed = Math.max(4, elapsed - C.TIMEOUT_RUNOFF_SAVED);
        const _toSchool = stopper === gameState.offSide ? offSchool : defSchool;
        log.push(`\u23F1\uFE0F Timeout \u2014 ${(_toSchool == null ? void 0 : _toSchool.name) || stopper} (${_toState[stopper]} left)`);
      }
    }
    // Subsystem 5 (situational, Aug 2026): clock-STOPPING events. A pass that falls
    // incomplete stops the clock at the whistle; a ball-carrier who goes out of
    // bounds (modeled by play family, since there is no per-play sideline geometry)
    // does the same. Either way the between-play runoff is saved (CLOCK_STOP_SAVED,
    // the same mechanic as a timeout). CLOCK_PASS.mean was raised to the true
    // clock-RUNNING value to compensate, so the league mean and plays/game hold while
    // the split becomes real \u2014 a completion keeps the clock moving, an incompletion
    // stops it, which is what a two-minute drill needs. A scored/turnover play already
    // ends the drive; a timeout this snap already saved the runoff (don't double-save).
    if (!playResult.scored && !playResult.turnover && !playResult.sack && !_playerBurned) {
      var _oobRate, _clockStopped;
      _clockStopped = false;
      if (playType.startsWith("pass") && !playResult.complete) {
        _clockStopped = true;
      } else if ((_oobRate = C.OOB_RATE[playType]) != null) {
        // Subsystem 5 fix D (Aug 2026): a TRAILING two-minute offense deliberately
        // works the sideline — out-breaking routes and get-out-of-bounds runs — to
        // stop the clock. So its ball-carriers reach the boundary more often. This
        // rides on fix A's OOB model (no new clock path); the multiplier only fires in
        // the two_min_trail situation, and a leading four-minute offense stays inbounds.
        if (offSit === "two_min_trail") _oobRate = Math.min(0.55, _oobRate * C.OOB_TWO_MIN_MULT);
        if (Math.random() < _oobRate) {
          _clockStopped = true;
          // The play object was already pushed (a copy of playResult); stamp the OOB
          // flag onto that recorded object so the viewer / probes can see it.
          if (plays.length) plays[plays.length - 1].oob = true;
        }
      }
      if (_clockStopped) elapsed = Math.max(4, elapsed - C.CLOCK_STOP_SAVED);
    }
    gameState.clock = Math.max(0, gameState.clock - elapsed);
    if (gameState.clock <= 0 && gameState.half === 1) {
      log.push(`Half ends \u2014 ${offSchool.name} drive ends`);
      return { plays, result: "end_half", points: 0, finalFieldPos: fieldPos, pen };
    }
    if (playResult.turnover) {
      const typeStr = playResult.turnoverType === "interception" ? "INTERCEPTION" : "FUMBLE";
      let takeover = 100 - fieldPos;
      // playtest item 9b \u2014 an interception in the end zone is a touchback:
      // the defense takes over at its own 20, not a mirror of the LOS. The
      // takeover spot is the flat 100 - fieldPos everywhere else, which for a
      // pick deep in the opponent's red zone handed the defense the ball on
      // its own 1-5. Approximate the defender's catch line from the throw's
      // depth band (he undercuts the target, so these run short on purpose)
      // and only convert when the ball reached the end zone \u2014 which, with
      // these depths, is exactly the range where the mirror is worse than a
      // touchback, so this can only improve the defense's field position,
      // never regress it.
      if (playResult.turnoverType === "interception" && !globalThis.__noIntTouchback) {
        const intAirByBand = { short: 4, medium: 11, deep: 20 };
        const airDepth = intAirByBand[playResult.passDepth] != null ? intAirByBand[playResult.passDepth] : 8;
        if (fieldPos + airDepth >= 100) {
          takeover = 20;
          if (plays.length) plays[plays.length - 1].intTouchback = true;
        }
      }
      log.push(`${typeStr} \u2014 ${defSchool.name} takes over`);
      return { plays, result: "turnover", points: 0, finalFieldPos: takeover, pen };
    }
    if (playResult.sack) {
      const rawPos = fieldPos - Math.abs(playResult.yards);
      if (rawPos <= 0) {
        log.push(`SAFETY \u2014 ${defSchool.name} scores 2!`);
        return { plays, result: "safety", points: 2, finalFieldPos: "safety_kick", pen };
      }
      fieldPos = clamp2(rawPos, 1, 99);
      distance += Math.abs(playResult.yards);
    } else {
      const rawPos = fieldPos + playResult.yards;
      distance -= playResult.yards;
      if (rawPos <= 0) {
        log.push(`SAFETY \u2014 ${defSchool.name} scores 2!`);
        return { plays, result: "safety", points: 2, finalFieldPos: "safety_kick", pen };
      }
      if (rawPos >= 100) {
        if (plays.length) {
          plays[plays.length - 1].yards = 100 - fieldPos;
          plays[plays.length - 1].td = true;
        }
        log.push(`TOUCHDOWN \u2014 ${offSchool.name}!`);
        return { plays, result: "touchdown", points: 6, finalFieldPos: "kickoff", pen };
      }
      fieldPos = clamp2(rawPos, 1, 99);
      if (distance <= 0) {
        down = 1;
        distance = 10;
        fourthDecided = false;
        log.push(`First down! ${offSchool.name} at ${fieldPos}`);
        continue;
      }
    }
    down++;
    if (down > 4) {
      log.push(`Turnover on downs \u2014 ${defSchool.name} takes over`);
      return { plays, result: "turnover_on_downs", points: 0, finalFieldPos: 100 - fieldPos, pen };
    }
  }
  log.push(`Clock expires during ${offSchool.name} drive`);
  return { plays, result: "end_half", points: 0, finalFieldPos: fieldPos, pen };
}
function collectPlayerNames(drives, homeRoster, awayRoster) {
  const playerNames = {};
  const addName = (id, roster) => {
    if (!id || playerNames[id]) return;
    const p = roster.find((pl) => pl.id === id);
    if (p) playerNames[id] = { name: `${p.name.first[0]}. ${p.name.last}`, pos: p.position };
  };
  for (const d of drives) {
    const offRst = d.possession === "home" ? homeRoster : awayRoster;
    const defRst = d.possession === "home" ? awayRoster : homeRoster;
    for (const pl of d.plays || []) {
      addName(pl.throwerId, offRst);
      addName(pl.rusherId, offRst);
      addName(pl.targetId, offRst);
      addName(pl.receiverId, offRst);
      if (pl.penaltyPlayerId) addName(pl.penaltyPlayerId, pl.penaltySide === "offense" ? offRst : defRst);
      if (pl.returnerId) addName(pl.returnerId, defRst);
      if (pl.kickerId) addName(pl.kickerId, offRst);
      addName(pl.sackerId, defRst);
      addName(pl.sackerId2, defRst);
      addName(pl.tacklerId, defRst);
      addName(pl.assistId, defRst);
      addName(pl.tflId, defRst);
      addName(pl.intPickerId, defRst);
      addName(pl.pbuId, defRst);
      addName(pl.ffId, defRst);
    }
  }
  return playerNames;
}
function midGameReport(token) {
  const homePlayerStats = {};
  const awayPlayerStats = {};
  for (const d of token.drives) {
    const offPS = d.possession === "home" ? homePlayerStats : awayPlayerStats;
    const defPS = d.possession === "home" ? awayPlayerStats : homePlayerStats;
    accumPlayerStats(d, offPS, defPS);
  }
  for (const kr of token.koReturns || []) {
    const ps = kr.side === "home" ? homePlayerStats : awayPlayerStats;
    const s = getPS(ps, kr.returnerId);
    s.retNo++;
    s.retYds += kr.yards;
    if (kr.td) s.retTD++;
  }
  const playerNames = collectPlayerNames(token.drives, token.homeRoster, token.awayRoster);
  return { homePlayerStats, awayPlayerStats, playerNames };
}
function buildGameToken(homeSchool, awaySchool, homeRoster, awayRoster, homeDepth, awayDepth, homeGameplan, awayGameplan) {
  var _a, _b, _c;
  normalizeDefGameplan(homeGameplan);
  normalizeDefGameplan(awayGameplan);
  const homeGP = structuredClone(homeGameplan);
  const awayGP = structuredClone(awayGameplan);
  const homeStats = emptyGameStats();
  const awayStats = emptyGameStats();
  const homeCtx = { fatigueMap: {}, snapCountMap: {}, benchedMap: {}, offSnaps: 0, defSnaps: 0, jobSnapMap: {} };
  const awayCtx = { fatigueMap: {}, snapCountMap: {}, benchedMap: {}, offSnaps: 0, defSnaps: 0, jobSnapMap: {} };
  const homeForm = clamp2(1 + randNorm(0, C.FORM_SIGMA), 1 - C.FORM_CLAMP, 1 + C.FORM_CLAMP);
  const awayForm = clamp2(1 + randNorm(0, C.FORM_SIGMA), 1 - C.FORM_CLAMP, 1 + C.FORM_CLAMP);
  const homeTeam = { roster: homeRoster, depth: homeDepth, gameplan: homeGP, school: homeSchool, isHome: true, ctx: homeCtx, form: homeForm };
  const awayTeam = { roster: awayRoster, depth: awayDepth, gameplan: awayGP, school: awaySchool, isHome: false, ctx: awayCtx, form: awayForm };
  for (const [gp, oppGP] of [[homeGP, awayGP], [awayGP, homeGP]]) {
    if (gp._aiScheme === false) continue;
    const shares = (_a = oppGP == null ? void 0 : oppGP.fieldAssignments) == null ? void 0 : _a.offense;
    let maxShare = 0;
    if (shares) for (const f of Object.values(shares)) {
      for (const v of Object.values((f == null ? void 0 : f.shares) || {})) if (v > maxShare) maxShare = v;
    }
    if (maxShare >= 28 && gp.coverageScheme === "balanced" && Math.random() < 0.75) {
      gp.coverageScheme = Math.random() < 0.55 ? "bracketTop" : "lockTop";
    }
  }
  for (const [gp, oppGP] of [[homeGP, awayGP], [awayGP, homeGP]]) {
    if (gp._aiScheme === false) continue;
    const lean = (_b = PASS_TENDENCY[(oppGP == null ? void 0 : oppGP.tendency) || "Balanced"]) != null ? _b : 0.5;
    const extreme = Math.abs(lean - 0.5);
    if (extreme >= 0.28 && Math.random() < 0.85) gp._tendencyKey = lean > 0.5 ? -10 : 6;
    else if (extreme >= 0.15 && Math.random() < 0.6) gp._tendencyKey = lean > 0.5 ? -6 : 3;
  }
  for (const [school, roster] of [[homeSchool, homeRoster], [awaySchool, awayRoster]]) {
    const cont = clamp2((_c = school == null ? void 0 : school._olCont) != null ? _c : 6, 0, 10);
    const mult = (cont - 6) * 0.5;
    for (const p of roster) if (p.position === "OL") p._olContBonus = mult;
  }
  for (const p of homeRoster) p._gameArch = derivedArchetype(p);
  for (const p of awayRoster) p._gameArch = derivedArchetype(p);
  return {
    homeSchool,
    awaySchool,
    homeRoster,
    awayRoster,
    homeGP,
    awayGP,
    homeTeam,
    awayTeam,
    homeCtx,
    awayCtx,
    log: [],
    drives: [],
    homeScore: 0,
    awayScore: 0,
    homeStats,
    awayStats,
    timeouts: { home: C.TIMEOUTS_PER_HALF, away: C.TIMEOUTS_PER_HALF },
    openingReceiver: Math.random() < 0.5 ? "home" : "away"
  };
}
function seenMemory(ctx2) {
  return ctx2._oppSeen || (ctx2._oppSeen = { types: {}, forms: {}, targets: {}, concepts: {}, jet: 0, draw: 0, rpo: 0, snaps: 0 });
}
function conceptSpamPen(mem, playType, conceptName, defAwrFactor) {
  var _a;
  if (!conceptName || !mem || (((_a = mem.types) == null ? void 0 : _a[playType]) || 0) < 8) return 0;
  const share = (mem.concepts && mem.concepts[conceptName] || 0) / mem.types[playType];
  return Math.min(0.03, Math.max(0, share - 0.3) * 0.1) * defAwrFactor;
}
function familiarityMult(mem, playType, formationId, defAwrFactor) {
  var _a;
  if (!mem || mem.snaps < 14) return 1;
  const typeShare = (mem.types[playType] || 0) / mem.snaps;
  const typeOver = Math.max(0, typeShare - ((_a = TYPE_BASELINE[playType]) != null ? _a : 0.2));
  const formShare = (mem.forms[formationId] || 0) / mem.snaps;
  const formOver = Math.max(0, formShare - 0.5);
  const pen = Math.min(0.04, typeOver * 0.12) + Math.min(0.03, formOver * 0.08);
  return 1 + pen * defAwrFactor;
}
function setAutoCounter(defGP, offDrives, offSide, iq = "varsity") {
  var _a;
  const IQC = (_a = {
    freshman: { eff: 0.02, thr: 0.55 },
    varsity: { eff: 0.04, thr: 0.45 },
    allamerican: { eff: 0.055, thr: 0.42 },
    legend: { eff: 0.07, thr: 0.38 }
  }[iq != null ? iq : "varsity"]) != null ? _a : { eff: 0.04, thr: 0.45 };
  if (!defGP || defGP._h2Counter) return;
  const counts = {};
  let snaps = 0;
  for (const d of offDrives) {
    if (d.possession !== offSide) continue;
    for (const pl of d.plays || []) {
      if (!pl.offFormation) continue;
      counts[pl.offFormation] = (counts[pl.offFormation] || 0) + 1;
      snaps++;
    }
  }
  if (snaps < 10) return;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] / snaps < IQC.thr) return;
  defGP._h2Counter = { formationId: top[0], eff: IQC.eff, auto: true };
}
function tokenControlsSide(token, side) {
  return Array.isArray(token.controlledSides) ? token.controlledSides.includes(side) : side === token.playerSide;
}
function activateControlledSide(token, side) {
  var _a;
  if (tokenControlsSide(token, side) && ((_a = token.controlledSides) == null ? void 0 : _a.length) > 1) token.playerSide = side;
}
function playHalf(token, half, resume = null) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p;
  const {
    homeTeam,
    awayTeam,
    homeSchool,
    awaySchool,
    homeRoster,
    awayRoster,
    log,
    drives,
    homeStats,
    awayStats
  } = token;
  let clock = C.HALF_SECONDS;
  let possession = half === 2 ? token.openingReceiver === "home" ? "away" : "home" : token.openingReceiver;
  let fieldPos = 25;
  let driveCount = 0;
  let pendingKickoff = null;
  let resumeDrive = null;
  if (!resume) {
    token.timeouts = { home: C.TIMEOUTS_PER_HALF, away: C.TIMEOUTS_PER_HALF };
  }
  if (resume) {
    clock = resume.clock;
    possession = resume.possession;
    fieldPos = resume.fieldPos;
    driveCount = resume.driveCount;
    resumeDrive = __spreadProps(__spreadValues({}, resume.drive), { decision: resume.decision, call: resume.call, defCall: resume.defCall });
  }
  // F3 (openers): per-side drive numbers for the game, carried on the token so
  // they survive every pending/resume round-trip. Old tokens resumed mid-game
  // without the counter read 99 — the script never mis-fires on a stale save.
  if (!resume && half === 1) token._dnums = { home: 0, away: 0 };
  if (!token._dnums) token._dnums = { home: 99, away: 99 };
  // M4: a possession-skip never leaks across a break — the 2nd half (and OT)
  // opens with the headset live again.
  if (!resume) token.skipPoss = null;
  while ((clock > 0 || resumeDrive) && driveCount < 20) {
    activateControlledSide(token, possession);
    const controlled = tokenControlsSide(token, possession);
    if (!resumeDrive) token._dnums[possession] = (token._dnums[possession] || 0) + 1;
    const offense = possession === "home" ? homeTeam : awayTeam;
    const defense = possession === "home" ? awayTeam : homeTeam;
    const gameState = {
      clock,
      fieldPos,
      half,
      score: {
        off: possession === "home" ? token.homeScore : token.awayScore,
        def: possession === "home" ? token.awayScore : token.homeScore
      },
      possession,
      timeouts: token.timeouts,
      offSide: possession,
      defSide: possession === "home" ? "away" : "home",
      playerSide: token.playerSide,
      _offDriveNum: token._dnums[possession] || 99
    };
    const skipHolds = (sit) => {
      var _a2;
      // M4 (#54): sim-the-possession — asks stay silent while THIS possession
      // keeps the ball; the flag clears itself the moment possession flips
      // (checked per drive, so the next series asks again). Cleared at every
      // fresh half start below and in overtime, like skipUntil.
      if (token.skipPoss) {
        if (possession === token.skipPoss) return true;
        token.skipPoss = null;
      }
      const sk = token.skipUntil;
      if (!sk) return false;
      if (half > sk.half) {
        token.skipUntil = null;
        return false;
      }
      if (half === sk.half && ((_a2 = sit == null ? void 0 : sit.clock) != null ? _a2 : clock) <= sk.clock) {
        // Owner live-test fix (2026-08-17): a clock-0 target means THROUGH the
        // break. The old clear-and-ask here re-opened the headset on the
        // boundary snap itself (a 0:00 fourth-down edge fires its ask before
        // the drive loop's clock-break) — the stray "call a play" prompt at the
        // end of a skipped half. The fresh half (above) or the final gun
        // (runToken) clears the flag; only a real mid-half target (clock > 0)
        // clears and asks right here.
        if (sk.clock > 0) {
          token.skipUntil = null;
          return false;
        }
        return true;
      }
      return true;
    };
    const ask = token.askFourth && controlled ? (sit) => skipHolds(sit) ? null : token.askFourth(sit) : null;
    const askCall = token.callMode && token.callMode !== "off" && controlled ? (sit) => skipHolds(sit) ? null : token.callMode === "all" ? "ASK" : token.callMode === "keydowns" && isKeyDownSituation(sit) ? "ASK" : null : null;
    // F1: when the coach's team is the DEFENSE, the headset asks on the
    // opponent's KEY DOWNS — 3rd/4th, the red zone, the last two minutes.
    // Madden pass (Aug 2026): in "all" (Every Snap) mode the defensive headset
    // now matches the offensive one and asks EVERY snap — full coordinator
    // mode is both sides of the ball. "keydowns" keeps the original cadence;
    // key downs are where the robber/house/pin calls live. If a coach controls
    // both sides (saved-multiplayer), the offensive ask keeps the headset.
    const controlledDef = tokenControlsSide(token, possession === "home" ? "away" : "home");
    const askDefCall = token.callMode && token.callMode !== "off" && controlledDef && !controlled ? (sit) => skipHolds(sit) ? null : token.callMode === "all" ? "ASK" : isKeyDownSituation(sit) ? "ASK" : null : null;
    const driveResult = simulateDrive(
      offense,
      defense,
      gameState,
      log,
      { ask, askCall, askDefCall, resume: resumeDrive }
    );
    resumeDrive = null;
    if (driveResult.pending) {
      // M18: a live every-snap game pauses before the receiving team's first
      // snap.  `pendingKickoff` used to live only in this function invocation,
      // so that pause discarded the kick and later made the watch feed rebuild
      // it under the wrong series.  Put the kick on the receiving drive before
      // yielding; it now survives every call-sheet round trip in true order.
      if (pendingKickoff && driveResult.pending.plays) {
        const koScore = {
          scoreOff: possession === "home" ? token.homeScore : token.awayScore,
          scoreDef: possession === "home" ? token.awayScore : token.homeScore
        };
        const koClock = driveResult.pending.sit && driveResult.pending.sit.clock != null ? driveResult.pending.sit.clock : driveResult.pending.clock;
        for (const ko of pendingKickoff.reverse()) {
          driveResult.pending.plays.unshift(__spreadProps(__spreadValues(__spreadValues({}, ko), koScore), {
            clock: koClock,
            half,
            down: 0,
            distance: 0
          }));
        }
        pendingKickoff = null;
      }
      token.pending = {
        kind: driveResult.pending.kind || "fourth",
        half,
        clock: driveResult.pending.clock,
        possession,
        fieldPos,
        driveCount,
        drive: driveResult.pending,
        score: { off: gameState.score.off, def: gameState.score.def }
      };
      return "PENDING";
    }
    clock = gameState.clock;
    drives.push(__spreadValues({ possession }, driveResult));
    if (pendingKickoff && driveResult.plays) {
      const _koScore = {
        scoreOff: possession === "home" ? token.homeScore : token.awayScore,
        scoreDef: possession === "home" ? token.awayScore : token.homeScore
      };
      // The kickoff precedes this drive's first snap, so it must show that snap's
      // time — not `clock` (gameState.clock here is the END of the drive we just
      // simulated, which would date the kickoff minutes later / the wrong quarter).
      const _koFirst = driveResult.plays.find((pl) => pl.clock != null);
      const _koClock = _koFirst ? _koFirst.clock : clock;
      const _koHalf = _koFirst && _koFirst.half != null ? _koFirst.half : half;
      for (const _ko of pendingKickoff.reverse())
        driveResult.plays.unshift(__spreadProps(__spreadValues(__spreadValues({}, _ko), _koScore), { clock: _koClock, half: _koHalf, down: 0, distance: 0 }));
      pendingKickoff = null;
    }
    if (driveResult.pen) {
      const offStats = possession === "home" ? homeStats : awayStats;
      const defStats = possession === "home" ? awayStats : homeStats;
      offStats.penalties += driveResult.pen.offCount;
      offStats.penaltyYds += driveResult.pen.offYds;
      defStats.penalties += driveResult.pen.defCount;
      defStats.penaltyYds += driveResult.pen.defYds;
    }
    if (driveResult.result === "touchdown") {
      const scorerScore = possession === "home" ? token.homeScore : token.awayScore;
      const oppScore = possession === "home" ? token.awayScore : token.homeScore;
      const marginBefore = scorerScore - oppScore;
      const secsLeft = half >= 2 ? clock : 9999;
      const _sGP = possession === "home" ? token.homeGP : token.awayGP;
      const _pat = (_sGP == null ? void 0 : _sGP.patApproach) || "chart";
      const chaseTwo = _pat === "kick" ? secsLeft <= 300 && marginBefore === -2 : _pat === "aggressive" ? secsLeft <= 900 && [1, -2, -5, -9, -10, -12, -13, -16].includes(marginBefore) : secsLeft <= 480 && (marginBefore === -2 || marginBefore === -5 || marginBefore === -10 || marginBefore === -12 || marginBefore === -13);
      let addPts = 6;
      const dStats = possession === "home" ? homeStats : awayStats;
      const _tryDD = drives[drives.length - 1];
      const _tryBase = {
        down: 0,
        distance: 0,
        fieldPos: 97,
        clock,
        half,
        scoreOff: scorerScore + 6,
        scoreDef: oppScore
      };
      if (chaseTwo) {
        dStats.twoPtAtt++;
        const _rbSchool = possession === "home" ? homeSchool : awaySchool;
        const _rbGrade = ((_rbSchool == null ? void 0 : _rbSchool._dnaGrades) == null ? void 0 : _rbSchool._dnaGrades.riverboat) || 0;
        const twoGood = Math.random() < C.PAT2_RATE * (1 + _rbGrade * 0.01);
        if (twoGood) {
          addPts += 2;
          dStats.twoPtMade++;
        }
        if (_tryDD == null ? void 0 : _tryDD.plays) {
          const _forms = (_sGP == null ? void 0 : _sGP.offFormations) || [];
          let _tw = _forms.reduce((s2, f2) => s2 + (f2.weight || 1), 0) * Math.random();
          let _tform = ((_a = _forms[0]) == null ? void 0 : _a.id) || "Spread";
          for (const f2 of _forms) {
            if ((_tw -= f2.weight || 1) <= 0) {
              _tform = f2.id;
              break;
            }
          }
          _tryDD.plays.push(__spreadValues({ type: "pat2", made: twoGood, offFormation: _tform }, _tryBase));
        }
      } else {
        const xpGood = Math.random() < xpMakeProb(offense.roster, offense.depth || {});
        if (xpGood) addPts += 1;
        const dd = drives[drives.length - 1];
        if (dd) {
          dd.xpAtt = 1;
          dd.xpMade = xpGood ? 1 : 0;
          dd.xpKickerId = (_c = (((_b = offense.depth) == null ? void 0 : _b["K"]) || [])[0]) != null ? _c : null;
        }
        if (_tryDD == null ? void 0 : _tryDD.plays) _tryDD.plays.push(__spreadValues({
          type: "pat",
          made: xpGood,
          kickerId: (_e = (((_d = offense.depth) == null ? void 0 : _d["K"]) || [])[0]) != null ? _e : null
        }, _tryBase));
      }
      if (possession === "home") token.homeScore += addPts;
      else token.awayScore += addPts;
    } else if (driveResult.result === "field_goal") {
      if (possession === "home") token.homeScore += driveResult.points;
      else token.awayScore += driveResult.points;
    } else if (driveResult.result === "safety") {
      if (possession === "home") {
        token.awayScore += 2;
        awayStats.safeties++;
      } else {
        token.homeScore += 2;
        homeStats.safeties++;
      }
    } else if (driveResult.result === "punt_return_td") {
      const pat = Math.random() < C.PAT_RATE ? 1 : 0;
      if (possession === "home") token.awayScore += 6 + pat;
      else token.homeScore += 6 + pat;
    }
    accumDriveStats(
      driveResult.plays,
      possession === "home" ? homeStats : awayStats
    );
    if (driveResult.result !== "end_half") {
      const scoringTeam = driveResult.result === "punt_return_td" ? possession === "home" ? "away" : "home" : possession;
      if (driveResult.finalFieldPos === "safety_kick") {
        possession = possession === "home" ? "away" : "home";
        fieldPos = clamp2(Math.round(randNorm(45, 5)), 30, 60);
      } else if (driveResult.finalFieldPos === "kickoff") {
        const kScore = scoringTeam === "home" ? token.homeScore : token.awayScore;
        const oScore = scoringTeam === "home" ? token.awayScore : token.homeScore;
        const margin = kScore - oScore;
        const secsLeft = half >= 2 ? clock : 9999;
        const wantOnside = margin < 0 && secsLeft <= 180;
        // P1-1 (surprise onside, Aug 2026): an ARMED team springs ONE surprise
        // onside per game on a kickoff nobody expects — outside the trailing-
        // late desperation window the hands team is out for. onsideResult's
        // surprise rate (~60%) was plumbed for exactly this and never called.
        // Default "never" = today's game byte-for-byte.
        const _koGP = scoringTeam === "home" ? token.homeGP : token.awayGP;
        if (!token._surpriseUsed) token._surpriseUsed = { home: false, away: false };
        const wantSurprise = !wantOnside && (_koGP == null ? void 0 : _koGP.surpriseOnside) === "arm" && !token._surpriseUsed[scoringTeam];
        if (wantOnside || wantSurprise) {
          if (wantSurprise) token._surpriseUsed[scoringTeam] = true;
          const _koSchool = scoringTeam === "home" ? homeSchool : awaySchool;
          const _recvRoster = scoringTeam === "home" ? awayRoster : homeRoster;
          const _handsLv = (_recvRoster || []).reduce((m, pl) => pl.position === "TE" || pl.position === "LB" ? Math.max(m, traitLv(pl, "handsTeam")) : m, 0);
          const onside = onsideResult(wantSurprise, ((_koSchool == null ? void 0 : _koSchool._dnaGrades) == null ? void 0 : _koSchool._dnaGrades.specialTeams) || 0, _handsLv);
          pendingKickoff = [{
            type: "kickoff",
            kickingSide: scoringTeam,
            receivingSide: scoringTeam === "home" ? "away" : "home",
            onside: true,
            recovered: onside.recovered,
            touchback: false,
            retYds: 0,
            returnerId: null,
            returnTD: false,
            fieldPos: 50
          }];
          if (onside.recovered) {
            possession = scoringTeam;
            fieldPos = onside.fieldPos;
            log.push(`${wantSurprise ? "SURPRISE ONSIDE KICK RECOVERED" : "ONSIDE KICK RECOVERED"} \u2014 ${(scoringTeam === "home" ? homeSchool : awaySchool).name} keeps it!`);
          } else {
            possession = scoringTeam === "home" ? "away" : "home";
            fieldPos = onside.fieldPos;
            log.push(`${wantSurprise ? "Surprise onside kick fails" : "Onside kick failed"} \u2014 ${(possession === "home" ? homeSchool : awaySchool).name} recovers`);
          }
        } else {
          const receivingTeam = scoringTeam === "home" ? "away" : "home";
          const kickRoster = scoringTeam === "home" ? homeRoster : awayRoster;
          const recvRoster = receivingTeam === "home" ? homeRoster : awayRoster;
          const recvSchool = receivingTeam === "home" ? homeSchool : awaySchool;
          const kickSchool = scoringTeam === "home" ? homeSchool : awaySchool;
          // G8 (Aug 2026): the squib. Leading with the half about to expire,
          // nobody kicks deep to a live returner — bounce it low, concede the
          // short field, erase the return-TD lottery ticket. Auto for every
          // team; the trade is real (receivers start around their 35-45).
          if (margin > 0 && clock <= 12) {
            possession = receivingTeam;
            fieldPos = clamp2(Math.round(randNorm(38, 4)), 28, 48);
            pendingKickoff = [{
              type: "kickoff",
              kickingSide: scoringTeam,
              receivingSide: receivingTeam,
              onside: false,
              squib: true,
              touchback: false,
              returnerId: null,
              retYds: 0,
              returnTD: false,
              fieldPos: 50
            }];
            log.push(`Squib kick \u2014 ${kickSchool.name} bounces it short, ${recvSchool.name} takes over at the ${fieldPos <= 50 ? fieldPos : 100 - fieldPos}`);
          } else {
          const ko = kickoffOutcome(kickRoster, recvRoster, (((_f = recvSchool == null ? void 0 : recvSchool.depthOrder) == null ? void 0 : _f.RET) || [])[0], ((_g = kickSchool == null ? void 0 : kickSchool._dnaGrades) == null ? void 0 : _g.specialTeams) || 0, ((recvSchool == null ? void 0 : recvSchool.gameplan) == null ? void 0 : recvSchool.gameplan.retScheme) || null);
          const retName = ko.returner ? `${ko.returner.name.first[0]}. ${ko.returner.name.last}` : null;
          if (!token.koReturns) token.koReturns = [];
          if (!ko.touchback && ko.returner) {
            token.koReturns.push({
              side: receivingTeam,
              returnerId: ko.returner.id,
              yards: ko.retYds || 0,
              td: !!ko.td
            });
          }
          if (ko.muffLost) {
            const _koRt = receivingTeam === "home" ? homeStats : awayStats;
            _koRt.fumbles++;
            possession = scoringTeam;
            fieldPos = clamp2(100 - ko.fieldPos, 55, 90);
            pendingKickoff = [{ type: "kickoff", kickingSide: scoringTeam, receivingSide: receivingTeam, onside: false, muffLost: true, touchback: false, returnerId: (ko.returner == null ? void 0 : ko.returner.id) != null ? ko.returner.id : null, retYds: 0, returnTD: false, fieldPos: 50 }];
            log.push(`FUMBLED KICKOFF — ${kickSchool.name} recovers at the ${fieldPos <= 50 ? fieldPos : 100 - fieldPos}!`);
          } else {
          pendingKickoff = ko.td ? [] : [{
            type: "kickoff",
            kickingSide: scoringTeam,
            receivingSide: receivingTeam,
            onside: false,
            touchback: !!ko.touchback,
            returnerId: (_i = (_h = ko.returner) == null ? void 0 : _h.id) != null ? _i : null,
            retYds: ko.retYds || 0,
            returnTD: false,
            fieldPos: 50
          }];
          if (ko.td) {
            log.push(`KICKOFF RETURN TOUCHDOWN \u2014 ${retName || "The returner"} takes it all the way for ${recvSchool.name}!`);
            const pat = Math.random() < C.PAT_RATE ? 1 : 0;
            if (receivingTeam === "home") token.homeScore += 6 + pat;
            else token.awayScore += 6 + pat;
            const ko2 = kickoffOutcome(recvRoster, kickRoster, (((_k = (_j = scoringTeam === "home" ? homeSchool : awaySchool) == null ? void 0 : _j.depthOrder) == null ? void 0 : _k.RET) || [])[0], ((_l = recvSchool == null ? void 0 : recvSchool._dnaGrades) == null ? void 0 : _l.specialTeams) || 0, ((kickSchool == null ? void 0 : kickSchool.gameplan) == null ? void 0 : kickSchool.gameplan.retScheme) || null);
            if (!ko2.touchback && ko2.returner) {
              token.koReturns.push({
                side: scoringTeam,
                returnerId: ko2.returner.id,
                yards: ko2.retYds || 0,
                td: false
              });
            }
            pendingKickoff = [
              {
                type: "kickoff",
                kickingSide: scoringTeam,
                receivingSide: receivingTeam,
                onside: false,
                touchback: false,
                returnerId: (_n = (_m = ko.returner) == null ? void 0 : _m.id) != null ? _n : null,
                retYds: ko.retYds || 0,
                returnTD: true,
                koTeam: (recvSchool == null ? void 0 : recvSchool.name) || "",
                fieldPos: 50
              },
              {
                type: "kickoff",
                kickingSide: receivingTeam,
                receivingSide: scoringTeam,
                onside: false,
                touchback: !!ko2.touchback,
                returnerId: (_p = (_o = ko2.returner) == null ? void 0 : _o.id) != null ? _p : null,
                retYds: ko2.retYds || 0,
                returnTD: false,
                fieldPos: 50
              }
            ];
            possession = scoringTeam;
            fieldPos = ko2.fieldPos;
          } else {
            if (!ko.touchback && retName && ko.retYds != null) {
              log.push(`${retName} returns the kickoff ${ko.retYds} yards`);
            }
            possession = receivingTeam;
            fieldPos = ko.fieldPos;
          }
          }
          }
        }
      } else if (driveResult.finalFieldPos === "muff_retain") {
        // PASS 2: muffed punt recovered by the kicking (punting) team — it keeps
        // possession (no flip) at the recovery spot. The return team is charged a
        // lost fumble (a real ST turnover); the punting team's box takeaway is the
        // possession itself.
        const _rtStats = possession === "home" ? awayStats : homeStats;
        _rtStats.fumbles++;
        fieldPos = driveResult.muffFieldPos || 75;
      } else {
        possession = possession === "home" ? "away" : "home";
        fieldPos = driveResult.finalFieldPos || 25;
      }
    } else {
      break;
    }
    driveCount++;
  }
}
function finishGame(token) {
  var _a, _b, _c, _d;
  const {
    homeTeam,
    awayTeam,
    homeRoster,
    awayRoster,
    homeSchool,
    awaySchool,
    log,
    drives,
    homeStats,
    awayStats,
    homeCtx,
    awayCtx
  } = token;
  if (token.homeScore === token.awayScore) {
    const otIsHome = Math.random() < 0.5;
    const otOffense = otIsHome ? homeTeam : awayTeam;
    const otDefense = otIsHome ? awayTeam : homeTeam;
    const otState = { clock: 300, fieldPos: 75, half: 3, score: { off: token.homeScore, def: token.awayScore }, timeouts: { home: C.TIMEOUTS_OT, away: C.TIMEOUTS_OT }, offSide: otIsHome ? "home" : "away", defSide: otIsHome ? "away" : "home" };
    const otDrive = simulateDrive(otOffense, otDefense, otState, log);
    drives.push(__spreadValues({ possession: otIsHome ? "home" : "away" }, otDrive));
    accumDriveStats(otDrive.plays, otIsHome ? homeStats : awayStats);
    if (otDrive.pen) {
      const offStats = otIsHome ? homeStats : awayStats;
      const defStats = otIsHome ? awayStats : homeStats;
      offStats.penalties += otDrive.pen.offCount;
      offStats.penaltyYds += otDrive.pen.offYds;
      defStats.penalties += otDrive.pen.defCount;
      defStats.penaltyYds += otDrive.pen.defYds;
    }
    if (otDrive.result === "touchdown" || otDrive.result === "field_goal") {
      const otPts = otDrive.result === "touchdown" ? 6 + (Math.random() < C.PAT_RATE ? 1 : 0) : otDrive.points;
      if (otIsHome) token.homeScore += otPts;
      else token.awayScore += otPts;
    } else {
      const homeComp = homeRoster.reduce((s, p) => s + p.compositeRating, 0);
      const awayComp = awayRoster.reduce((s, p) => s + p.compositeRating, 0);
      if (homeComp > awayComp) token.homeScore++;
      else token.awayScore++;
    }
  }
  const homePlayerStats = {};
  const awayPlayerStats = {};
  for (const d of drives) {
    const offPS = d.possession === "home" ? homePlayerStats : awayPlayerStats;
    const defPS = d.possession === "home" ? awayPlayerStats : homePlayerStats;
    accumPlayerStats(d, offPS, defPS);
  }
  const playerNames = collectPlayerNames(drives, homeRoster, awayRoster);
  const qbInjuries = [];
  const seenQBInjury = /* @__PURE__ */ new Set();
  for (const d of drives) {
    const offRst = d.possession === "home" ? homeRoster : awayRoster;
    for (const play of d.plays || []) {
      if (play.qbInjured && play.qbInjuryGames > 0 && play.rusherId && !seenQBInjury.has(play.rusherId)) {
        seenQBInjury.add(play.rusherId);
        qbInjuries.push({
          playerId: play.rusherId,
          name: (_b = (_a = playerNames[play.rusherId]) == null ? void 0 : _a.name) != null ? _b : "?",
          gamesOut: play.qbInjuryGames,
          team: d.possession
        });
      }
    }
  }
  return {
    homeScore: token.homeScore,
    awayScore: token.awayScore,
    winner: token.homeScore > token.awayScore ? homeSchool.id : awaySchool.id,
    homeStats,
    awayStats,
    homePlayerStats,
    awayPlayerStats,
    homeSnapCounts: homeCtx.snapCountMap,
    awaySnapCounts: awayCtx.snapCountMap,
    // PASS 7 (Fix D): job-bucket snaps + team side totals, for persistence
    homeJobSnaps: homeCtx.jobSnapMap,
    awayJobSnaps: awayCtx.jobSnapMap,
    homeTeamSnaps: { off: homeCtx.offSnaps, def: homeCtx.defSnaps },
    awayTeamSnaps: { off: awayCtx.offSnaps, def: awayCtx.defSnaps },
    // Game-day form rolls (upset mechanic) — surfaced for postgame narrative
    // ("they came out flat") and debugging; nothing persists them.
    homeForm: (_c = homeTeam.form) != null ? _c : 1,
    awayForm: (_d = awayTeam.form) != null ? _d : 1,
    drives,
    log,
    homeSchool,
    awaySchool,
    playerNames,
    qbInjuries
  };
}
function simulateGame(homeSchool, awaySchool, homeRoster, awayRoster, homeDepth, awayDepth, homeGameplan, awayGameplan) {
  if (!(homeRoster == null ? void 0 : homeRoster.length) || !(awayRoster == null ? void 0 : awayRoster.length)) {
    const hs = (homeRoster == null ? void 0 : homeRoster.length) ? 21 : 0, as = (awayRoster == null ? void 0 : awayRoster.length) ? 21 : 0;
    return {
      homeScore: hs,
      awayScore: as,
      winner: hs > as ? "home" : as > hs ? "away" : null,
      homeStats: emptyGameStats(),
      awayStats: emptyGameStats(),
      homePlayerStats: {},
      awayPlayerStats: {},
      homeSnapCounts: {},
      awaySnapCounts: {},
      homeJobSnaps: {},
      awayJobSnaps: {},
      homeTeamSnaps: { off: 0, def: 0 },
      awayTeamSnaps: { off: 0, def: 0 },
      drives: [],
      log: ["Game not played \u2014 a team could not field a roster (forfeit)."],
      homeSchool,
      awaySchool,
      playerNames: {},
      qbInjuries: [],
      forfeit: true
    };
  }
  const token = buildGameToken(
    homeSchool,
    awaySchool,
    homeRoster,
    awayRoster,
    homeDepth,
    awayDepth,
    homeGameplan,
    awayGameplan
  );
  playHalf(token, 1);
  setAutoCounter(token.homeGP, token.drives, "away");
  setAutoCounter(token.awayGP, token.drives, "home");
  playHalf(token, 2);
  return finishGame(token);
}
function fourthDownIsMoment(sit) {
  const { distance, fieldPos, distFromGoal, canFG, scoreMargin, secsLeft, half } = sit;
  const shortYardage = distance <= 2;
  const late = half >= 2 && secsLeft <= 480;
  const oneScore = Math.abs(scoreMargin) <= 8;
  const trailingLate = half >= 2 && secsLeft <= 360 && scoreMargin < 0;
  const gimmeFG = canFG && distFromGoal <= 22;
  if (shortYardage && fieldPos >= 40 && !gimmeFG) return true;
  if (distance <= 5 && fieldPos >= 50 && !gimmeFG) return true;
  if (late && oneScore && distance <= 6 && fieldPos >= 35) return true;
  if (trailingLate && distance <= 10) return true;
  if (distance <= 6 && fieldPos >= 55 && !canFG) return true;
  return false;
}
function fourthDownIsCoachCall(sit) {
  const { distance, fieldPos, canFG } = sit;
  if (canFG) return true;
  if (distance <= 6 && fieldPos >= 40) return true;
  return fourthDownIsMoment(sit);
}
function runToken(token) {
  while (!token.pending) {
    if (token.stage === 1) {
      const r = playHalf(token, 1, token._resume || null);
      token._resume = null;
      if (r === "PENDING") return token;
      token.stage = 2;
      if (token.stopAfterHalf === 1) {
        if (token.primaryPlayerSide) token.playerSide = token.primaryPlayerSide;
        return token;
      }
    } else if (token.stage === 2) {
      const r = playHalf(token, 2, token._resume || null);
      token._resume = null;
      if (r === "PENDING") return token;
      if (token.callMode && token.homeScore === token.awayScore) {
        token.stage = "ot";
        continue;
      }
      token.stage = "done";
      // M4: skip state is engine-transient — nothing skip-related survives
      // the final gun (and so nothing skip-related can ever serialize).
      token.skipUntil = null;
      token.skipPoss = null;
      return token;
    } else if (token.stage === "ot") {
      const r = playOvertime(token, token._resume || null);
      token._resume = null;
      if (r === "PENDING") return token;
      token.stage = "done";
      token.skipUntil = null;
      token.skipPoss = null;
      return token;
    } else return token;
  }
  return token;
}
function playOvertime(token, resume = null) {
  const { homeTeam, awayTeam, homeRoster, awayRoster, log, drives, homeStats, awayStats } = token;
  token.skipUntil = null;
  token.skipPoss = null;
  if (!token.otState) {
    token.otIsHome = Math.random() < 0.5;
    token.otState = { clock: 300, fieldPos: 75, half: 3, score: { off: 0, def: 0 }, timeouts: { home: C.TIMEOUTS_OT, away: C.TIMEOUTS_OT }, playerSide: token.playerSide };
  }
  if (token.otState) {
    token.otState.offSide = token.otIsHome ? "home" : "away";
    token.otState.defSide = token.otIsHome ? "away" : "home";
  }
  const otIsHome = token.otIsHome;
  const otOffense = otIsHome ? homeTeam : awayTeam;
  const otDefense = otIsHome ? awayTeam : homeTeam;
  const gameState = token.otState;
  gameState.score = {
    off: otIsHome ? token.homeScore : token.awayScore,
    def: otIsHome ? token.awayScore : token.homeScore
  };
  let resumeDrive = null;
  if (resume) {
    gameState.clock = resume.clock;
    resumeDrive = __spreadProps(__spreadValues({}, resume.drive), { decision: resume.decision, call: resume.call, defCall: resume.defCall });
  }
  const otSide = otIsHome ? "home" : "away";
  activateControlledSide(token, otSide);
  gameState.playerSide = token.playerSide;
  const mine = tokenControlsSide(token, otSide);
  const mineDef = tokenControlsSide(token, otSide === "home" ? "away" : "home");
  const ask = token.askFourth && mine ? token.askFourth : null;
  const askCall = token.callMode && token.callMode !== "off" && mine ? (sit) => token.callMode === "all" ? "ASK" : token.callMode === "keydowns" && isKeyDownSituation(sit) ? "ASK" : null : null;
  const askDefCall = token.callMode && token.callMode !== "off" && mineDef && !mine ? (sit) => token.callMode === "all" ? "ASK" : isKeyDownSituation(sit) ? "ASK" : null : null;
  const otDrive = simulateDrive(otOffense, otDefense, gameState, log, { ask, askCall, askDefCall, resume: resumeDrive });
  if (otDrive.pending) {
    token.pending = {
      kind: otDrive.pending.kind || "fourth",
      half: 3,
      clock: otDrive.pending.clock,
      possession: otIsHome ? "home" : "away",
      fieldPos: otDrive.pending.fieldPos,
      driveCount: (drives || []).length,
      drive: otDrive.pending,
      score: { off: gameState.score.off, def: gameState.score.def }
    };
    return "PENDING";
  }
  drives.push(__spreadValues({ possession: otIsHome ? "home" : "away" }, otDrive));
  accumDriveStats(otDrive.plays, otIsHome ? homeStats : awayStats);
  if (otDrive.pen) {
    const offStats = otIsHome ? homeStats : awayStats;
    const defStats = otIsHome ? awayStats : homeStats;
    offStats.penalties += otDrive.pen.offCount;
    offStats.penaltyYds += otDrive.pen.offYds;
    defStats.penalties += otDrive.pen.defCount;
    defStats.penaltyYds += otDrive.pen.defYds;
  }
  if (otDrive.result === "touchdown" || otDrive.result === "field_goal") {
    const otPts = otDrive.result === "touchdown" ? 6 + (Math.random() < C.PAT_RATE ? 1 : 0) : otDrive.points;
    if (otIsHome) token.homeScore += otPts;
    else token.awayScore += otPts;
  } else {
    const homeComp = homeRoster.reduce((s, p) => s + p.compositeRating, 0);
    const awayComp = awayRoster.reduce((s, p) => s + p.compositeRating, 0);
    if (homeComp > awayComp) token.homeScore++;
    else token.awayScore++;
  }
  return "DONE";
}
function finishInteractiveGame(token) {
  return finishGame(token);
}
// M4 (#54/#55): one summary row per drive touched by a skipped stretch — the
// play-by-play feed shows these instead of silence. Pure read: walks the
// token's drives (plus the pending drive) counting flat play indexes, and
// summarizes every drive with at least one play at index >= fromPlays.
function driveSummariesFrom(token, fromPlays) {
  const out = [];
  let seen = 0;
  const drv = [...token.drives || []];
  if (token.pending && token.pending.drive && Array.isArray(token.pending.drive.plays)) {
    drv.push({ possession: token.pending.possession, plays: token.pending.drive.plays, result: null, points: 0, _live: true });
  }
  for (const d of drv) {
    const ps = d.plays || [];
    const skippedHere = Math.max(0, seen + ps.length - Math.max(seen, fromPlays));
    if (skippedHere > 0) {
      out.push({
        poss: d.possession,
        plays: ps.length,
        yards: ps.reduce((n, pl) => n + (pl.yards || 0), 0),
        result: d._live ? "live" : d.result || null,
        points: d.points || 0
      });
    }
    seen += ps.length;
  }
  return out;
}
function resumeFromDecision(token, decision) {
  if (!(token == null ? void 0 : token.pending)) return token;
  const p = token.pending;
  token.pending = null;
  token._resume = __spreadProps(__spreadValues({}, p), { decision });
  token.stage = p.half === 3 ? "ot" : p.half;
  return runToken(token);
}
function resumeFromCall(token, call) {
  if (!(token == null ? void 0 : token.pending) || token.pending.kind !== "playcall" && token.pending.kind !== "defcall") return token;
  const p = token.pending;
  token.pending = null;
  // F1: a defcall resumes with a defensive override (null = ride the plan —
  // any non-defensive call object, e.g. the generic {concept:"sheet"} that the
  // skip/mode paths send, means exactly that). Owner build 2026-08-17: a
  // ride-the-plan answer keeps the coach's TIMEOUT flag — the defensive ⏱️
  // with no dial pins is "stop the clock, ride the plan", and the old bare
  // {_ride:true} wrapper silently dropped it.
  token._resume = p.kind === "defcall" ? __spreadProps(__spreadValues({}, p), { defCall: call && call._def ? call : call && call.timeout ? { _ride: true, timeout: true } : { _ride: true } }) : __spreadProps(__spreadValues({}, p), { call: call || { concept: "sheet" } });
  token.stage = p.half === 3 ? "ot" : p.half;
  return runToken(token);
}
function callContext(token) {
  var _a, _b;
  const p = token == null ? void 0 : token.pending;
  if (!p || p.kind !== "playcall") return null;
  const s = p.drive.sit;
  return {
    half: p.half,
    clock: s.clock,
    quarter: p.half === 3 ? "OT" : s.clock > C.HALF_SECONDS / 2 ? p.half === 1 ? 1 : 3 : p.half === 1 ? 2 : 4,
    down: s.down,
    distance: s.distance,
    fieldPos: s.fieldPos,
    scoreOff: s.score.off,
    scoreDef: s.score.def,
    formations: s.formations || [],
    conceptsByGroup: s.conceptsByGroup || conceptGroups(),
    formationPlaybooks: s.formationPlaybooks || null,
    conceptWeights: (_a = s.conceptWeights) != null ? _a : null,
    // situation-effective sheet (wizard grid)
    playsSoFar: (token.drives || []).reduce((n, d) => {
      var _a2;
      return n + (((_a2 = d.plays) == null ? void 0 : _a2.length) || 0);
    }, 0) + (((_b = p.drive.plays) == null ? void 0 : _b.length) || 0)
  };
}
function decisionContext(token) {
  const p = token == null ? void 0 : token.pending;
  if (!p) return null;
  const s = p.drive.sit;
  const mine = p.possession === token.playerSide;
  return {
    half: p.half,
    clock: p.clock,
    quarter: p.half === 3 ? "OT" : p.clock > C.HALF_SECONDS / 2 ? p.half === 1 ? 1 : 3 : p.half === 1 ? 2 : 4,
    down: p.drive.down,
    distance: p.drive.distance,
    fieldPos: p.drive.fieldPos,
    distFromGoal: s.distFromGoal,
    canFG: s.canFG,
    maxFG: s.maxFG,
    fgDist: s.fgKickDist != null ? s.fgKickDist : s.distFromGoal + 17,
    // true attempt = snap + hold (~17 yds) behind the LOS
    scoreOff: mine ? p.score.off : p.score.def,
    scoreDef: mine ? p.score.def : p.score.off,
    secsLeft: s.secsLeft
  };
}
function applyDifficulty(token, playerSide, difficulty) {
  var _a;
  const e = (_a = DIFFICULTY_EDGE[difficulty != null ? difficulty : "varsity"]) != null ? _a : 0;
  if (!e || !playerSide) return;
  const aiTeam = playerSide === "home" ? token.awayTeam : token.homeTeam;
  if (aiTeam) aiTeam.execMult = 1 + e;
}
function simulateFirstHalf(homeSchool, awaySchool, homeRoster, awayRoster, homeDepth, awayDepth, homeGameplan, awayGameplan, opts = null) {
  const token = buildGameToken(
    homeSchool,
    awaySchool,
    homeRoster,
    awayRoster,
    homeDepth,
    awayDepth,
    homeGameplan,
    awayGameplan
  );
  if (opts) applyDifficulty(token, opts.playerSide, opts.difficulty);
  const controlledSides = ((opts == null ? void 0 : opts.controlledSides) || ((opts == null ? void 0 : opts.playerSide) ? [opts.playerSide] : [])).filter((side) => side === "home" || side === "away");
  if ((opts == null ? void 0 : opts.callMode) && opts.callMode !== "off" && controlledSides.length) {
    token.playerSide = opts.playerSide || controlledSides[0];
    token.primaryPlayerSide = token.playerSide;
    token.controlledSides = [...new Set(controlledSides)];
    token.callMode = opts.callMode;
    token.askFourth = (sit) => {
      if (!token.callMode || token.callMode === "off") return null;
      const gate = token.callMode === "all" ? fourthDownIsCoachCall : fourthDownIsMoment;
      return gate(sit) ? "ASK" : null;
    };
    token.stopAfterHalf = 1;
    token.pending = null;
    token.stage = 1;
    runToken(token);
    return token;
  }
  playHalf(token, 1);
  return token;
}
// A coach's named starter reaches the field by being promoted to the front of
// his position's depth list — season.js's gameDressed() does that through this
// helper before kickoff. It lives here (not in season.js) because
// beginSecondHalf needs it too and season.js imports sim.js, not the reverse.
function pinnedFirst(depth, gameplan) {
  const fa = gameplan == null ? void 0 : gameplan.fieldAssignments;
  if (!fa) return depth;
  const pinSet = /* @__PURE__ */ new Set();
  for (const side of ["offense", "defense"]) {
    for (const entry of Object.values(fa[side] || {})) {
      for (const pid of Object.values(entry.slots || {})) pinSet.add(pid);
    }
  }
  if (pinSet.size === 0) return depth;
  const out = {};
  for (const [pos, ids] of Object.entries(depth || {})) {
    const front = (ids || []).filter((id) => pinSet.has(id));
    const rest = (ids || []).filter((id) => !pinSet.has(id));
    out[pos] = [...front, ...rest];
  }
  return out;
}
function beginSecondHalf(token, homeGPEdits = null, awayGPEdits = null) {
  var _a;
  if (homeGPEdits) Object.assign(token.homeGP, homeGPEdits);
  if (awayGPEdits) Object.assign(token.awayGP, awayGPEdits);
  for (const side of ["home", "away"]) {
    const school = token[`${side}School`];
    // Refresh the chart at the break so a halftime depth edit takes, but keep
    // the H1 ordering rules: raw school.depthChart is compositeRating order and
    // would silently un-start every pinned man in the third quarter.
    if (school == null ? void 0 : school.depthChart) {
      const dressed = token[`${side}Team`].depth;
      let base = school.depthChart;
      if (dressed) {
        // Preserve the pre-game dress (redshirt filtering) — only ids that were
        // eligible to play in the first half stay eligible in the second.
        const allowed = new Set(Object.values(dressed).flat());
        const filtered = {};
        let dropped = false;
        for (const [pos, ids] of Object.entries(base || {})) {
          const keep = (ids || []).filter((id) => allowed.has(id));
          if (keep.length !== (ids || []).length) dropped = true;
          filtered[pos] = keep;
        }
        if (dropped) base = filtered;
      }
      token[`${side}Team`].depth = pinnedFirst(base, school.gameplan);
    }
    if ((_a = school == null ? void 0 : school.gameplan) == null ? void 0 : _a.fieldAssignments) token[`${side}GP`].fieldAssignments = school.gameplan.fieldAssignments;
  }
}
function simulateSecondHalf(token, homeGPEdits = null, awayGPEdits = null) {
  beginSecondHalf(token, homeGPEdits, awayGPEdits);
  playHalf(token, 2);
  return finishGame(token);
}
function stepSecondHalf(token, homeGPEdits = null, awayGPEdits = null) {
  beginSecondHalf(token, homeGPEdits, awayGPEdits);
  token.stopAfterHalf = null;
  token.stage = 2;
  return runToken(token);
}
function emptyPlayerGameStats() {
  return {
    passAtt: 0,
    passComp: 0,
    passYds: 0,
    passTD: 0,
    passInt: 0,
    rushAtt: 0,
    rushYds: 0,
    rushTD: 0,
    targets: 0,
    recComp: 0,
    recYds: 0,
    recTD: 0,
    tackles: 0,
    solo: 0,
    assists: 0,
    tacklesForLoss: 0,
    sacks: 0,
    ints: 0,
    passBreakups: 0,
    forcedFumbles: 0,
    batted: 0,
    brokenTackles: 0,
    missedTackles: 0,
    pressures: 0,
    contestedTgt: 0,
    contestedRec: 0,
    penalties: 0,
    penaltyYds: 0,
    fgMade: 0,
    fgAtt: 0,
    fgLong: 0,
    xpMade: 0,
    xpAtt: 0,
    puntNo: 0,
    puntYds: 0,
    retNo: 0,
    retYds: 0,
    retTD: 0,
    // PASS 5: trait-growth counters (Hook Rule)
    rpoReadWins: 0,
    rpoDefused: 0,
    choiceConversions: 0,
    gadgetSnaps: 0,
    // PASS 6: fake punt/FG growth counters (Hook Rule)
    stFakeConvs: 0,
    stFakeSniffs: 0
  };
}
function getPS(map, id) {
  if (!map[id]) map[id] = emptyPlayerGameStats();
  return map[id];
}
function accumPlayerStats(drive, offPS, defPS) {
  const plays = drive.plays || [];
  const isTD = drive.result === "touchdown";
  if (drive.xpKickerId && drive.xpAtt) {
    const s = getPS(offPS, drive.xpKickerId);
    s.xpAtt += drive.xpAtt;
    s.xpMade += drive.xpMade || 0;
  }
  for (let i = 0; i < plays.length; i++) {
    const play = plays[i];
    const last = i === plays.length - 1;
    // PASS 5: RPO conflict-read growth counters — the QB banks a correct
    // pull/give; the named conflict defender banks a defused (wrong*) snap.
    if (play.rpoRead) {
      if (play.rpoQbId && (play.rpoRead === "pull" || play.rpoRead === "give")) getPS(offPS, play.rpoQbId).rpoReadWins++;
      if (play.rpoConflictId && (play.rpoRead === "wrongPull" || play.rpoRead === "wrongGive")) getPS(defPS, play.rpoConflictId).rpoDefused++;
    }
    if (play.choiceConvertedId && play.complete && play.receiverId === play.choiceConvertedId) getPS(offPS, play.choiceConvertedId).choiceConversions++;
    if (play.gadget) {
      if (play.rusherId) getPS(offPS, play.rusherId).gadgetSnaps++;
      if (play.throwerId && play.gadget !== "reverse") getPS(offPS, play.throwerId).gadgetSnaps++;
    }
    if (play.type === "fakePunt" || play.type === "fakeFG") {
      // PASS 6: fake punt/FG accounting — real yardage to the man who made it,
      // plus the Hook Rule growth counters (gadgetAce ← stFakeConvs on the
      // offense; filmJunkie ← stFakeSniffs for the coverage man on a stuff).
      if (play.runnerId) {
        const s = getPS(offPS, play.runnerId);
        s.rushAtt++;
        s.rushYds += play.yards || 0;
        if (play.td) s.rushTD++;
        if (play.converted) s.stFakeConvs++;
      }
      if (play.throwerId) {
        const s = getPS(offPS, play.throwerId);
        s.passAtt++;
        if (play.int) s.passInt++;
        else if (play.yards > 0 || play.converted) {
          s.passComp++;
          s.passYds += play.yards || 0;
          if (play.td) s.passTD++;
        }
        if (play.converted) s.stFakeConvs++;
      }
      if (play.targetId && play.throwerId && !play.int && (play.yards > 0 || play.converted)) {
        const t = getPS(offPS, play.targetId);
        t.targets++;
        t.recComp++;
        t.recYds += play.yards || 0;
        if (play.td) t.recTD++;
      }
      if (!play.converted && play.snifferId && !play.int && !play.fumble) getPS(defPS, play.snifferId).stFakeSniffs++;
      continue;
    }
    if (play.type === "fg") {
      if (play.kickerId) {
        const s = getPS(offPS, play.kickerId);
        s.fgAtt++;
        if (play.made) {
          s.fgMade++;
          if ((play.fgDist || 0) > s.fgLong) s.fgLong = play.fgDist;
        }
      }
      continue;
    }
    if (play.type === "punt") {
      if (play.punterId) {
        const s = getPS(offPS, play.punterId);
        s.puntNo++;
        s.puntYds += play.puntYds || 0;
      }
      if (play.returnerId && (play.returnYds || play.returnTD)) {
        const rs = getPS(defPS, play.returnerId);
        rs.retNo++;
        rs.retYds += play.returnYds || 0;
        if (play.returnTD) rs.retTD++;
      }
      continue;
    }
    if (play.type === "penalty") {
      if (play.penaltyPlayerId) {
        const s = getPS(play.penaltySide === "offense" ? offPS : defPS, play.penaltyPlayerId);
        s.penalties++;
        s.penaltyYds += Math.abs(play.yards || 0);
      }
      continue;
    }
    if (play.pressureIds) for (const pid of play.pressureIds) getPS(defPS, pid).pressures++;
    if (play.battedById) getPS(defPS, play.battedById).batted++;
    if (play.type === "run_inside" || play.type === "run_outside" || play.type === "run_scramble") {
      if (play.rusherId) {
        const s = getPS(offPS, play.rusherId);
        s.rushAtt++;
        s.rushYds += play.yards;
        if (isTD && play.td) s.rushTD++;
      }
      if (play.tacklerId) {
        const d = getPS(defPS, play.tacklerId);
        d.tackles++;
        if (play.assistId) d.assists++;
        else d.solo++;
        if (play.tflId === play.tacklerId) d.tacklesForLoss++;
      }
      if (play.assistId) {
        const a = getPS(defPS, play.assistId);
        a.tackles++;
        a.assists++;
      }
      if (play.tflId && play.tflId !== play.tacklerId) {
        getPS(defPS, play.tflId).tacklesForLoss++;
      }
      if (play.ffId) getPS(defPS, play.ffId).forcedFumbles++;
      if (play.brokenById) getPS(defPS, play.brokenById).missedTackles++;
      if (play.brokenByCarrier) getPS(offPS, play.brokenByCarrier).brokenTackles++;
    } else if (play.sack) {
      if (play.sackerId) {
        const split = !!play.sackerId2;
        const d = getPS(defPS, play.sackerId);
        d.sacks += split ? 0.5 : 1;
        d.tackles++;
        d.tacklesForLoss++;
        if (split) d.assists++;
        else d.solo++;
      }
      if (play.sackerId2) {
        const d2 = getPS(defPS, play.sackerId2);
        d2.sacks += 0.5;
        d2.tackles++;
        d2.tacklesForLoss++;
        d2.assists++;
      }
      if (play.throwerId) {
        const qbS = getPS(offPS, play.throwerId);
        qbS.rushAtt = (qbS.rushAtt || 0) + 1;
        qbS.rushYds = (qbS.rushYds || 0) + play.yards;
      }
    } else {
      if (play.throwerId) {
        const s = getPS(offPS, play.throwerId);
        s.passAtt++;
        if (play.complete) {
          s.passComp++;
          s.passYds += play.yards;
          if (isTD && play.td) s.passTD++;
        } else if (play.turnover && play.turnoverType === "interception") {
          s.passInt++;
        }
      }
      if (play.targetId) {
        const t = getPS(offPS, play.targetId);
        t.targets++;
        if (play.contested != null && play.passDepth !== "short") t.contestedTgt++;
      }
      if (play.complete && play.receiverId) {
        const s = getPS(offPS, play.receiverId);
        s.recComp++;
        s.recYds += play.yards;
        if (play.contested) s.contestedRec++;
        if (isTD && play.td) s.recTD++;
      }
      if (play.intPickerId) {
        const d = getPS(defPS, play.intPickerId);
        d.ints++;
        d.tackles++;
        d.solo++;
      }
      if (play.pbuId) getPS(defPS, play.pbuId).passBreakups++;
      if (play.tacklerId && play.complete) {
        const d = getPS(defPS, play.tacklerId);
        d.tackles++;
        if (play.assistId) d.assists++;
        else d.solo++;
      }
      if (play.assistId && play.complete) {
        const a = getPS(defPS, play.assistId);
        a.tackles++;
        a.assists++;
      }
    }
  }
}
function accumDriveStats(plays, stats) {
  for (const play of plays) {
    if (play.type === "penalty" || play.type === "punt" || play.type === "kickoff" || play.type === "special" || play.type === "fg") {
      continue;
    }
    if (play.type === "run_inside" || play.type === "run_outside" || play.type === "run_scramble") {
      stats.rushAtt++;
      stats.rushYds += play.yards;
      if (play.turnover) stats.fumbles++;
    } else {
      if (play.sack) {
        stats.sacksAllowed = (stats.sacksAllowed || 0) + 1;
        stats.rushAtt++;
        stats.rushYds += play.yards;
        if (play.turnover) stats.fumbles++;
      } else if (play.complete) {
        stats.compAtt++;
        stats.passAtt++;
        stats.passYds += play.yards;
      } else {
        stats.passAtt++;
        if (play.turnover) stats.ints++;
      }
    }
  }
  stats.totalYds = (stats.rushYds || 0) + (stats.passYds || 0);
}
function emptyGameStats() {
  return {
    rushAtt: 0,
    rushYds: 0,
    passAtt: 0,
    compAtt: 0,
    passYds: 0,
    totalYds: 0,
    ints: 0,
    fumbles: 0,
    penalties: 0,
    penaltyYds: 0,
    safeties: 0,
    twoPtAtt: 0,
    twoPtMade: 0
  };
}
var QB_RUN_BASE, OPTION_CAPABLE, CALL_CATEGORIES, SPEED_OPTION, JET_CAPABLE, DRAW_DEFAULT, GADGET_DEFAULT, JET_SLOTS, _passCtx, _rpoCtx, _tkStyle, _optKey, _conceptCtx, _situDown, FATIGUE_PHYSICAL, REAL_SLOTS, _rosterByIdCache, _penaltyScale, TYPE_BASELINE, DIFFICULTY_EDGE;

QB_RUN_BASE = {
  "Power-I": 0.04,
  "Air Raid": 0.08,
  "Trips/Bunch": 0.12,
  "Spread": 0.18,
  "Pistol/RPO": 0.3,
  // Expansion five (Jul 2026). Empty is 1.0 by definition — there is no back
  // on the field, so every run is a QB draw/keeper (the no-backfield guard in
  // resolveRunPlay enforces this even if the rate table drifts). The 'bone
  // and flexbone live on the QB keep; Wildcat's "QB" is split wide holding a
  // clipboard, so his designed-run rate is effectively zero.
  "Single Back": 0.08,
  "Empty": 1,
  // [Option chain, Jul 2026] Wishbone/Flexbone QB keeps now come from the
  // triple-option read chain (resolveOptionPlay), not this table — these rates
  // cover only their NON-option snaps (sneaks, boots). Was .35/.40 when the
  // keep was statistical; leaving that would double-count QB carries.
  "Wishbone": 0.1,
  "Flexbone": 0.1,
  "Wildcat": 0.02,
  // Jumbo: sneaks and the odd QB Power push — the QB is a hammer, not a threat.
  "Jumbo": 0.06
};
OPTION_CAPABLE = { "Power-I": 0.55, "Wishbone": 0.7, "Flexbone": 0.75 };
CALL_CATEGORIES = /* @__PURE__ */ new Set(["run_inside", "run_outside", "pass_short", "pass_medium", "pass_deep"]);
SPEED_OPTION = { "Spread": 0.1, "Pistol/RPO": 0.15, "Trips/Bunch": 0.06 };
JET_CAPABLE = {
  "Wildcat": 0.35,
  "Flexbone": 0.2,
  "Pistol/RPO": 0.12,
  "Spread": 0.12,
  "Trips/Bunch": 0.12,
  "Air Raid": 0.1,
  "Empty": 0.1,
  "Single Back": 0.08,
  "Power-I": 0.04
};
DRAW_DEFAULT = 8;
GADGET_DEFAULT = 4;
JET_SLOTS = {
  "Wildcat": ["RB_2"],
  "Flexbone": ["RB_H", "RB_2"],
  "Spread": ["WR_S"],
  "Trips/Bunch": ["WR_S"],
  "Air Raid": ["WR_S", "WR_F"],
  "Empty": ["WR_S", "WR_F"],
  "Pistol/RPO": ["WR_S"],
  "Single Back": ["WR_Z", "TE_U"],
  "Power-I": ["WR_X"]
};
_passCtx = { covStyle: "balanced", qbAggr: 50 };
// identity stage 3: situational context for the Chain Mover trait — the down
// at the moment of the throw (stamped by simulateDrive before each dispatch)
_situDown = 1;
_tkStyle = "balanced";
_optKey = "balanced";
_conceptCtx = null;
_rpoCtx = null;
FATIGUE_PHYSICAL = ["SPD", "STR", "AGI", "PWR", "JMP"];
REAL_SLOTS = /* @__PURE__ */ new Set(["QB", "RB", "WR", "TE", "OL", "DE", "DT", "OLB", "LB", "CB", "S", "K", "P"]);
_rosterByIdCache = /* @__PURE__ */ new WeakMap();
_penaltyScale = 0.9;
TYPE_BASELINE = {
  run_inside: 0.28,
  run_outside: 0.18,
  pass_short: 0.22,
  pass_medium: 0.18,
  pass_deep: 0.14
};
DIFFICULTY_EDGE = {
  freshman: -0.05,
  varsity: 0,
  allamerican: 0.03,
  legend: 0.06
};

export { callContext, decisionContext, finishInteractiveGame, midGameReport, pinnedFirst, resumeFromCall, resumeFromDecision, setAutoCounter, setPenaltyScale, simulateFirstHalf, simulateGame, simulateSecondHalf, stepSecondHalf };

// additional exports consumed by tools/ probes
export { attemptFG, catchResolution, coverageStrength, simulateDrive, driveSummariesFrom, rpoConflictRead, fgLateStretch, fgMakeProb, fourthDownDecision, fourthDownIsCoachCall, fourthDownIsMoment, isKeyDownSituation, motionMisreadProb, pickPassConcept, pickRunConcept, puntDistance, qbRead, qbScrambleChance, resolveFakeFG, resolveFakePunt, resolvePassRush, returnMuff, returnOutcome, xpMakeProb };
