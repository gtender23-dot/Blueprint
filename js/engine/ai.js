import { __spreadProps, __spreadValues } from '../_spread.js';
import { DEFAULT_PRACTICE, FORMATION_PLAYBOOK, PASS_TENDENCY } from '../constants.js';
import { FRONT_PRESSURE_SIGNATURE } from './formations.js';
import { derivedArchetype } from './player.js';
import { defaultWeeklyPlan } from './situations.js';
import { buildDepthChart } from './world.js';
import { clamp2, randInt3, randNorm } from '../utils.js';

function pickFormations(bucket, mobile, wrDeepBias) {
  const templates = FORMATION_TEMPLATES[bucket];
  let key = bucket === "pass" || bucket === "passHeavy" ? wrDeepBias > 0 ? "deep" : "short" : mobile ? "mobile" : "pocket";
  if (bucket === "runHeavy" && mobile && Math.random() < 0.4) key = "option";
  const base = templates[key];
  let weighted = base.map(([id, w]) => [id, Math.max(10, w + Math.round((Math.random() - 0.5) * 8))]);
  const total = weighted.reduce((s, [, w]) => s + w, 0);
  weighted = weighted.map(([id, w]) => [id, Math.round(w / total * 100)]);
  const drift = 100 - weighted.reduce((s, [, w]) => s + w, 0);
  weighted[0][1] += drift;
  return weighted.map(([id, weight]) => ({ id, weight }));
}
function aiConceptWeights(bucket, qbArch, wrDeepBias, teStr, wrStr, isOptionTeam) {
  const w = {};
  const set = (names, v) => {
    for (const n of names) w[n] = clamp2(v + randInt3(-8, 8), 10, 95);
  };
  if (bucket === "passHeavy" || bucket === "pass") {
    if (wrDeepBias > 0) {
      set(["Four Verts", "Post-Wheel", "Dagger", "Y-Cross", "Mills (Post-Dig)", "Sluggo Seam"], 75);
      set(["Mesh", "Shallow Cross", "Sail"], 62);
      set(["Stick", "Curl-Flat", "PA Deep Cross", "Spot"], 38);
    } else {
      set(["Mesh", "Shallow Cross", "Slant-Flat", "Stick", "Spot"], 75);
      set(["Smash", "Curl-Flat", "Flood", "Sail", "Levels"], 62);
      set(["Four Verts", "PA Deep Cross", "Post-Wheel", "Sluggo Seam"], 35);
    }
    set(["Power", "Iso", "Trap"], 35);
    set(["Inside Zone", "Outside Zone", "Toss"], 58);
  } else if (bucket === "runHeavy" || bucket === "run") {
    set(["Power", "Inside Zone", "Counter", "Iso"], 75);
    set(["Trap", "Toss", "Outside Zone", "QB Power"], 60);
    set(["PA Deep Cross", "Y-Cross", "Smash"], 68);
    set(["Curl-Flat", "Stick", "Slant-Flat"], 55);
    set(["Four Verts", "Mesh", "Shallow Cross", "Dagger", "Sluggo Seam", "Levels", "Sail", "Spot"], 32);
  } else {
    if (teStr > wrStr + 2) set(["Stick", "Y-Cross", "Flood", "Sail"], 65);
    if (qbArch === "QB-Gunslinger") set(["Four Verts", "Dagger", "Mills (Post-Dig)", "Sluggo Seam"], 62);
    if (qbArch === "QB-Game-Manager") set(["Stick", "Curl-Flat", "Slant-Flat", "Spot"], 62);
    if (qbArch === "QB-Dual" || qbArch === "QB-Scrambler") set(["QB Power"], 60);
  }
  if (isOptionTeam) {
    set(["Counter", "Toss", "Inside Zone", "QB Power"], 72);
    set(["PA Deep Cross"], 80);
    set(["Mesh", "Four Verts", "Dagger", "Shallow Cross"], 22);
  }
  return w;
}
// ── PASS 6: AI-authored formation sheets (the pass-2 "remaining half") ──────
// A staff tilts each formation it carries toward what that formation is FOR:
// the flexbone majors in the option, Air Raid formations live in the quick
// spread game, Jumbo's one shot is play-action off the heavy run look. Tilts
// only — never 0 (benching a play is a human call); per-staff variance so no
// two sheets match. The engine overlay + QB audible already honor these
// (pass-2 machinery); __noAIFormSheets ignores stamped sheets at read time.
const AI_SHEET_TILT = {
  "Wishbone": { feature: ["Triple Option", "Speed Option", "QB Power", "Iso"], damp: ["Y-Cross", "PA Deep Cross"] },
  "Flexbone": { feature: ["Triple Option", "Speed Option", "QB Power", "Toss"], damp: ["Sluggo Seam", "Mills (Post-Dig)", "Levels"] },
  "Wildcat": { feature: ["Wildcat Power", "Triple Option", "QB Power"], damp: ["Y-Cross", "PA Deep Cross"] },
  "Power-I": { feature: ["Power", "Iso", "Counter", "PA Deep Cross"], damp: ["Stick", "Slant-Flat"] },
  "Jumbo": { feature: ["Power", "Iso", "QB Sneak", "PA Deep Cross"], damp: ["Draw"] },
  "Spread": { feature: ["Four Verts", "Mesh", "Dagger", "Spot"], damp: ["Power", "Trap"] },
  "Air Raid": { feature: ["Four Verts", "Mesh", "Dagger", "Shallow Cross"], damp: ["Inside Zone"] },
  "Empty": { feature: ["Four Verts", "Mesh", "Spot", "Dagger"], damp: [] },
  "Pistol/RPO": { feature: ["Inside Zone", "Slant-Flat", "Stick", "Speed Option"], damp: [] },
  "Trips/Bunch": { feature: ["Flood", "Sail", "Mesh", "Smash"], damp: ["Power"] }
};
function aiFormationSheets(offFormations) {
  const sheets = {};
  for (const f of offFormations || []) {
    const t = AI_SHEET_TILT[f.id];
    if (!t) continue;
    const book = FORMATION_PLAYBOOK[f.id] || [];
    const sheet = {};
    for (const c of t.feature) if (book.includes(c)) sheet[c] = randInt3(65, 85);
    for (const c of t.damp) if (book.includes(c)) sheet[c] = randInt3(28, 40);
    if (Object.keys(sheet).length) sheets[f.id] = sheet;
  }
  return sheets;
}
function setAIGameplan(school) {
  var _a, _b, _c, _d;
  const roster = school.roster;
  if (roster.length === 0) return;
  const olStr = avgRating(roster, "OL");
  const rbStr = avgRating(roster, "RB");
  const fbBacks = roster.filter((p) => {
    const a = derivedArchetype(p);
    return p.position === "RB" && typeof a === "string" && a.indexOf("FB-") === 0;
  });
  const fbStr = fbBacks.length ? Math.round(fbBacks.reduce((s, p) => s + (p.compositeRating || 0), 0) / fbBacks.length) : rbStr;
  const qbStr = avgRating(roster, "QB");
  const wrStr = avgRating(roster, "WR");
  const teStr = avgRating(roster, "TE");
  const lbStr = avgRating(roster, "LB");
  const dlStr = avgRatingMulti(roster, ["DE", "DT", "OLB"]);
  const cbStr = avgRating(roster, "CB");
  const sStr = avgRating(roster, "S");
  const runScore = (olStr * 1 + rbStr * 0.8 + fbStr * 0.6) / 2.4;
  const passScore = (qbStr * 1 + wrStr * 0.8 + teStr * 0.4) / 2.2;
  const philosophyRoll = randNorm(0, 3);
  const lean = runScore - passScore + philosophyRoll;
  let tendency, bucket;
  if (lean > 8) {
    tendency = "Always Run";
    bucket = "runHeavy";
  } else if (lean > 4) {
    tendency = "Heavy Run";
    bucket = "runHeavy";
  } else if (lean > 1) {
    tendency = "Run";
    bucket = "run";
  } else if (lean > -1) {
    tendency = "Balanced";
    bucket = "balanced";
  } else if (lean > -4) {
    tendency = "Pass";
    bucket = "pass";
  } else if (lean > -8) {
    tendency = "Heavy Pass";
    bucket = "passHeavy";
  } else {
    tendency = "Always Pass";
    bucket = "passHeavy";
  }
  const isRunTeam = bucket === "runHeavy" || bucket === "run";
  const isPassTeam = bucket === "pass" || bucket === "passHeavy";
  const qbs = roster.filter((p) => p.position === "QB");
  const starterQB = qbs.length ? qbs.reduce((a, b) => b.compositeRating >= a.compositeRating ? b : a) : null;
  const qbArch = starterQB ? derivedArchetype(starterQB) : null;
  const mobile = qbArch === "QB-Dual" || qbArch === "QB-Scrambler";
  const qbSPD = qbs.reduce((s, p) => s + (p.attributes.SPD || 60), 0) / Math.max(1, qbs.length);
  const wrs = roster.filter((p) => p.position === "WR");
  const wrDeepBias = wrs.length ? wrs.reduce((s, p) => {
    const a = derivedArchetype(p);
    return s + (a === "WR-Deep" || a === "WR-Physical" ? 1 : a === "WR-Poss" || a === "WR-Slot" ? -1 : 0);
  }, 0) / wrs.length : 0;
  const offFormations = pickFormations(bucket, mobile, wrDeepBias);
  const frontLean = lbStr - dlStr + randNorm(0, 1.5);
  let defBaseFront = frontLean > -2 ? "3-4" : "4-3";
  // The odd stack (Aug 2026, owner-approved AI adoption): a staff whose
  // secondary clearly outclasses its front seven bases out of the 3-3-5,
  // like real G5 programs built on DBs. Scheme-aware roles/targets then apply
  // to these schools too — they genuinely start three safeties.
  const stackLean = (cbStr + sStr) / 2 - dlStr + randNorm(0, 2);
  if (!globalThis.__no335 && stackLean > 4) defBaseFront = "3-3-5";
  const primaryFormation = ((_a = offFormations[0]) == null ? void 0 : _a.id) || "Single Back";
  const isOptionTeam = primaryFormation === "Flexbone" || primaryFormation === "Wishbone";
  let qbRunPct = 0;
  if (isOptionTeam) qbRunPct = randInt3(5, 12);
  else if (primaryFormation === "Pistol/RPO" && qbSPD > 78) qbRunPct = randInt3(15, 25);
  else if (primaryFormation === "Spread" && qbSPD > 75) qbRunPct = randInt3(8, 18);
  else if (qbSPD > 80) qbRunPct = randInt3(5, 12);
  let optionRate = null, optionMix = null, pitchAggr = null;
  if (isOptionTeam) {
    optionRate = randInt3(60, 85);
    const wingSPD = Math.max(0, ...roster.filter((p) => p.position === "RB").map((p) => p.attributes.SPD || 0));
    optionMix = {
      dive: randInt3(30, 42) + (fbStr > rbStr ? 8 : 0),
      keep: randInt3(22, 34) + (qbSPD > 78 ? 8 : 0),
      pitch: randInt3(22, 34) + (wingSPD > 85 ? 8 : 0)
    };
    pitchAggr = randInt3(35, 65);
  }
  let shortW = 40, medW = 40, deepW = 20;
  if (qbArch === "QB-Gunslinger" || wrDeepBias > 0.15) {
    deepW += 10;
    shortW -= 6;
    medW -= 4;
  }
  if (qbArch === "QB-Game-Manager" || wrDeepBias < -0.15) {
    deepW -= 8;
    shortW += 8;
  }
  if (qbArch === "QB-Scrambler") {
    medW += 4;
    deepW -= 2;
    shortW -= 2;
  }
  if (isPassTeam) deepW += 4;
  if (isRunTeam) shortW += 4;
  shortW = Math.max(15, shortW + randInt3(-3, 3));
  medW = Math.max(15, medW + randInt3(-3, 3));
  deepW = Math.max(8, deepW + randInt3(-3, 3));
  const depthTotal = shortW + medW + deepW;
  const passDepth = {
    short: Math.round(shortW / depthTotal * 100),
    medium: Math.round(medW / depthTotal * 100)
  };
  passDepth.deep = 100 - passDepth.short - passDepth.medium;
  const tempoRoll = Math.random();
  let baseTempo;
  if (isPassTeam) baseTempo = tempoRoll < 0.18 ? "Hurry" : tempoRoll < 0.9 ? "Normal" : "Chew";
  else if (isRunTeam) baseTempo = tempoRoll < 0.3 ? "Chew" : tempoRoll < 0.92 ? "Normal" : "Hurry";
  else baseTempo = tempoRoll < 0.1 ? "Hurry" : tempoRoll < 0.25 ? "Chew" : "Normal";
  const agg = (_d = (_c = (_b = school.coach) == null ? void 0 : _b.personality) == null ? void 0 : _c.aggression) != null ? _d : 0.5;
  const fourthDown = agg > 0.8 ? "Very Aggressive" : agg > 0.55 ? "Aggressive" : agg > 0.25 ? "Moderate" : "Conservative";
  const kickers = roster.filter((p) => p.position === "K");
  const kicker = kickers.length ? kickers.reduce((a, b) => b.compositeRating >= a.compositeRating ? b : a) : null;
  const kArch = kicker ? derivedArchetype(kicker) : null;
  let maxFGDist = 42;
  if (kArch === "K-Power") maxFGDist += 4;
  if (kArch === "K-Accuracy") maxFGDist -= 2;
  maxFGDist += Math.round((agg - 0.5) * 6);
  maxFGDist = clamp2(maxFGDist, 35, 52);
  school.gameplan = __spreadProps(__spreadValues({
    offFormations,
    defBaseFront,
    tendency,
    // Rung 5: the staff's call sheet (concept weights; unset = 50).
    conceptWeights: aiConceptWeights(bucket, qbArch, wrDeepBias, teStr, wrStr, isOptionTeam),
    // PASS 6: the staff's per-formation sheets (the pass-2 remaining half).
    formationPlaybooks: aiFormationSheets(offFormations),
    _aiAuthoredSheets: true,
    rushInPct: clamp2(58 + Math.round(lean * 1.5) + randInt3(-6, 6), 35, 80),
    passDepth,
    // PASS 5: staff identity on the new offense toys. RPO volume follows the
    // formation the offense actually lives in (the dial multiplies C.RPO_FIT,
    // so under-center teams stay near zero either way); the gadget tier is an
    // aggression call — a river-boat staff runs ~2x the trick plays.
    rpoRate: primaryFormation === "Pistol/RPO" ? randInt3(45, 60) : primaryFormation === "Spread" || primaryFormation === "Trips/Bunch" ? randInt3(35, 50) : randInt3(20, 40),
    gadgetRate: agg > 0.7 ? randInt3(4, 8) : agg < 0.3 ? randInt3(0, 2) : randInt3(2, 5),
    blitzPct: 15 + Math.round(Math.random() * 20),
    // pressureSource retired (G11, Aug 2026) — normalizeDefGameplan deleted it on
    // every load anyway; pressureIdentity + fieldAssignments.blitzShares own "who comes"
    coverageScheme: Math.random() < 0.75 ? "balanced" : Math.random() < 0.6 ? "lockTop" : "bracketTop",
    greenDog: Math.random() < 0.3,
    spyQB: Math.random() < 0.25,
    targetShares: {
      WR1: isPassTeam ? 22 + Math.round(Math.random() * 4) : 18 + Math.round(Math.random() * 4),
      WR2: isPassTeam ? 19 + Math.round(Math.random() * 4) : 15 + Math.round(Math.random() * 4),
      WR3: 14 + Math.round(Math.random() * 6),
      TE1: isRunTeam ? 20 + Math.round(Math.random() * 4) : 16 + Math.round(Math.random() * 4),
      RB1: isRunTeam ? 16 + Math.round(Math.random() * 4) : 10 + Math.round(Math.random() * 4)
    },
    fourthDown,
    maxFGDist,
    qbRunPct,
    // Controls pass (Jul 2026): fake taste follows the coach's aggression;
    // edge discipline starts balanced (the weekly reaction adjusts it).
    stFakes: agg > 0.65 ? "aggressive" : agg > 0.35 ? "occasional" : "never",
    // Pass-game pass: coverage identity from personnel — corners who can
    // cover get manned up, deep-safety talent earns a two-high base; the QB's
    // leash follows his archetype (gunslingers push, managers protect).
    covShell: sStr > cbStr + 2 ? Math.random() < 0.5 ? "two" : "balanced" : isRunTeam && Math.random() < 0.35 ? "single" : "balanced",
    covStyle: cbStr > lbStr + 3 ? "man" : Math.random() < 0.35 ? "zone" : "balanced",
    // Defensive-audit dials: cushion follows corner quality + nerve, tackling
    // and the punt rush follow the coach's aggression, sub philosophy leans
    // MATCH when the DB room is deep.
    pressLevel: cbStr > 52 && agg > 0.55 ? "press" : agg < 0.3 ? "off" : "balanced",
    // P1 controls (Aug 2026): the safety's leash follows ball-hawk talent, the
    // zone teaching follows how smart the back seven actually is, and a weak
    // line buys the edge some chip help. Mild rolls — most staffs stay auto.
    robberCall: sStr > 54 && agg > 0.5 && Math.random() < 0.25 ? "rob" : agg < 0.28 && Math.random() < 0.2 ? "overtop" : "auto",
    zoneStyle: sStr > 53 && cbStr > 51 ? Math.random() < 0.35 ? "match" : "balanced" : sStr < 46 && Math.random() < 0.25 ? "spot" : "balanced",
    chipHelp: olStr < 46 && Math.random() < 0.45 ? "chip" : "auto",
    tackleStyle: agg > 0.65 ? "strip" : agg < 0.35 ? "wrap" : "balanced",
    subPhilosophy: cbStr + sStr > lbStr * 2 + 4 ? "match" : Math.random() < 0.2 ? "base" : "auto",
    puntDef: agg > 0.7 ? "block" : agg < 0.3 ? "safe" : "balanced",
    // PASS 6: return-scheme identity. A staff with a real returner room and a
    // gambler on the headset sets the wall; a conservative staff (or one with
    // nobody worth blocking for) banks the catch. Band rule: this is an AI
    // scheme gain — pass6_band_ab is the gated A/B.
    retScheme: (wrStr + rbStr) / 2 > 52 && agg > 0.6 ? "wall" : agg < 0.3 || (wrStr + rbStr) / 2 < 45 ? "safe" : "balanced",
    protEmphasis: olStr < 45 ? randInt3(58, 70) : randInt3(42, 55),
    qbAggr: qbArch === "QB-Gunslinger" ? randInt3(62, 78) : qbArch === "QB-Game-Manager" ? randInt3(28, 42) : randInt3(44, 56),
    // F2 (check-with-me, Aug 2026): the light default check table every real
    // DC carries — box math vs the extremes, edge set vs the wildcat. Small,
    // football-obvious, and symmetric with what a human coach can now author.
    formChecks: {
      empty: { runCommit: -8 },
      heavy: { runCommit: 8 },
      wildcat: { edgePlay: "contain" }
    }
  }, optionRate != null ? { optionRate, optionMix, pitchAggr } : {}), __spreadValues(globalThis.__noDefCalls ? {} : buildAISignatureCalls(defBaseFront, agg, cbStr, sStr, lbStr), {
    // Phase 2 (Jul 2026): AI coaches now carry archetype situational matrices
    // — a run team hammers its heavy package on the goal line and 3rd & short,
    // a pass team empties out on 3rd & long — per Situational spec §10.
    situations: buildAISituations(bucket, offFormations, agg),
    baseTempo
  }));
}
// PASS 2 (Aug 2026): AI coordinators author SIGNATURE CALLS — two named
// packages built from the staff's base front and temperament, weighted onto
// the pass-leverage rows of a small matchup call sheet. The heat call runs
// the front's own signature pressure (calling your signature is what earns
// the disguise bonus); the coverage call leans on whichever half of the
// secondary is actually good. Gated by __noDefCalls so a kill-switch world
// generates byte-identical gameplans — the A/B stays clean at the data
// layer, not just the sample layer.
function buildAISignatureCalls(defBaseFront, agg, cbStr, sStr, lbStr = 50) {
  const sig = FRONT_PRESSURE_SIGNATURE[defBaseFront] || "secondLevel";
  const HEAT_WORD = { fireZone: "Fire", secondLevel: "Dog", secondaryHeat: "Cat", theHouse: "Zero" };
  const heatName = `${defBaseFront} ${HEAT_WORD[sig] || "Dog"}`;
  const manSecondary = cbStr >= sStr;
  const covName = manSecondary ? "Lockdown" : "Mint";
  const defCalls = {};
  defCalls[heatName] = {
    front: defBaseFront,
    aggression: agg > 0.6 ? "house" : "attacking",
    pressureIdentity: sig,
    covShell: "single",
    covStyle: sig === "theHouse" || sig === "secondaryHeat" ? "man" : "zone"
  };
  defCalls[covName] = manSecondary ? { covShell: "single", covStyle: "man", aggression: "bend" } : { covShell: "two", covStyle: "zone", zoneStyle: "match", aggression: "bend" };
  // ── PASS 3 (Aug 2026): family flavor + the Victory call ───────────────────
  // The coverage call upgrades to a NAMED FAMILY when the roster earns it: a
  // man secondary with real safeties plays 2-Man behind its press; a zone
  // staff with a rangy backer seven runs Tampa 2 (the pole runner is the
  // scheme); a zone staff whose strength is the safeties splits the field in
  // Cover 6. And every DC in football owns a Victory call — Prevent, weighted
  // onto the up-two-scores-late row (the sitKey already resolves from the
  // defense's own margin, so no new decision logic exists here; Pass 6 owns
  // real win-probability polish). Gated by __noCovFamilies at the data layer
  // so the band A/B compares generated-world vs generated-world cleanly.
  const fams = !globalThis.__noCovFamilies;
  if (fams) {
    if (manSecondary) {
      if (cbStr >= 52 && sStr >= 48) defCalls[covName].covFamily = "Cover 2-Man";
    } else if (lbStr >= sStr && lbStr >= 52) defCalls[covName].covFamily = "Tampa 2";
    else if (sStr >= 52) defCalls[covName].covFamily = "Cover 6";
    defCalls.Victory = { covShell: "two", covStyle: "zone", covFamily: "Prevent", aggression: "bend" };
  }
  // ── PASS 4 (Aug 2026): pressure flavor on the signature heat ──────────────
  // An aggressive DC with a real interior backer room MUGS his heat call; a
  // staff whose backers can run games crosses them instead; a truly wired
  // staff owns a third-and-long "Psycho" look (amoeba — no hands down, all
  // picture). Gated __noPressFlavors at the data layer (band A/B law).
  const flav = !globalThis.__noPressFlavors;
  let psycho = false;
  if (flav) {
    // Mug is SCHEME, not roster — an aggressive DC walks his backers up
    // because that's who he is. Cross needs the backers to be the room's
    // strength (relative read — absolute thresholds never fire on weak
    // worlds, the Pass-3 lesson re-learned at gate time).
    if (agg > 0.6) defCalls[heatName].pressLook = "mug";
    else if (agg > 0.35 && lbStr >= sStr) defCalls[heatName].dogGame = "cross";
    if (agg > 0.7) {
      psycho = true;
      defCalls.Psycho = { pressLook: "amoeba", aggression: "attacking" };
    }
  }
  const heatLong = clamp2(30 + Math.round(agg * 40) + randInt3(-5, 5), 15, 75);
  const heatMed = clamp2(15 + Math.round(agg * 30) + randInt3(-5, 5), 10, 55);
  return { defCalls, callSheet: __spreadValues({
    third_long: { any: psycho ? [[heatName, heatLong], ["Psycho", 20], [covName, Math.max(10, 100 - heatLong - 20)]] : [[heatName, heatLong], [covName, 100 - heatLong]] },
    third_medium: { any: [[heatName, heatMed], [covName, 100 - heatMed]] }
  }, fams ? { four_min_lead: { any: [["Victory", 60], [covName, 40]] } } : {}) };
}
function buildAISituations(bucket, offFormations, agg) {
  const has = (id) => offFormations.some((f) => f.id === id);
  const pin = (id) => [{ id, weight: 100 }];
  const sits = {};
  if (bucket === "runHeavy" || bucket === "run") {
    const hammer = has("Wishbone") ? "Wishbone" : has("Power-I") ? "Power-I" : Math.random() < 0.15 ? "Wildcat" : offFormations[0].id;
    sits.goal_line = { offFormations: pin(hammer), tendency: "Heavy Run" };
    sits.third_short = {
      offFormations: pin(hammer),
      tendency: bucket === "runHeavy" ? "Always Run" : "Heavy Run"
    };
    sits.four_min_lead = { tendency: "Heavy Run" };
  } else if (bucket === "pass" || bucket === "passHeavy") {
    const spreadIt = has("Empty") ? "Empty" : has("Air Raid") ? "Air Raid" : has("Spread") ? "Spread" : offFormations[0].id;
    sits.third_long = { offFormations: pin(spreadIt), tendency: "Heavy Pass" };
    sits.two_min_trail = { offFormations: pin(spreadIt), tendency: "Heavy Pass" };
  } else {
    sits.third_short = { tendency: "Heavy Run" };
  }
  if (agg > 0.6) sits.third_long = __spreadProps(__spreadValues({}, sits.third_long || {}), { blitzPct: 45 });
  else if (agg < 0.3) sits.third_long = __spreadProps(__spreadValues({}, sits.third_long || {}), { blitzPct: 10 });
  return sits;
}
function ensureAISituations(school) {
  var _a, _b, _c, _d;
  const gp = school == null ? void 0 : school.gameplan;
  if (!gp) return;
  if (gp.situations && Object.keys(gp.situations).length) return;
  const lean = (_a = PASS_TENDENCY[gp.tendency || "Balanced"]) != null ? _a : 0.5;
  const bucket = lean <= 0.35 ? "runHeavy" : lean <= 0.44 ? "run" : lean >= 0.65 ? "passHeavy" : lean >= 0.56 ? "pass" : "balanced";
  const agg = (_d = (_c = (_b = school.coach) == null ? void 0 : _b.personality) == null ? void 0 : _c.aggression) != null ? _d : 0.5;
  gp.situations = buildAISituations(bucket, gp.offFormations || [{ id: "Single Back", weight: 100 }], agg);
}
function aiSetWeeklyReaction(school, opponent, iq = "varsity") {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i;
  if (!(school == null ? void 0 : school.gameplan)) return;
  ensureAISituations(school);
  const wp = defaultWeeklyPlan();
  const IQ = (_a = COACH_IQ[iq != null ? iq : "varsity"]) != null ? _a : COACH_IQ.varsity;
  if (IQ.skip && Math.random() < IQ.skip) {
    school.weeklyPlan = wp;
    return;
  }
  const lean = (_c = PASS_TENDENCY[((_b = opponent == null ? void 0 : opponent.gameplan) == null ? void 0 : _b.tendency) || "Balanced"]) != null ? _c : 0.5;
  let shift = 0;
  if (lean <= 0.2) shift = 12;
  else if (lean <= 0.35) shift = 9;
  else if (lean <= 0.44) shift = 5;
  else if (lean >= 0.8) shift = -10;
  else if (lean >= 0.65) shift = -7;
  else if (lean >= 0.56) shift = -3;
  if (shift !== 0) shift += randInt3(-2, 2);
  wp.runCommitShift = clamp2(Math.round(shift * IQ.mult), -18, 18);
  const agg = (_f = (_e = (_d = school.coach) == null ? void 0 : _d.personality) == null ? void 0 : _e.aggression) != null ? _f : 0.5;
  // P1-1 (surprise onside): a heavy underdog with a gambler on the headset
  // occasionally arms the one-per-game surprise kick. Re-rolled weekly so a
  // stale arm never lingers; everyone else stays "never" — today's game.
  {
    const _pGap = ((opponent == null ? void 0 : opponent.prestige) || 1) - ((school == null ? void 0 : school.prestige) || 1);
    school.gameplan.surpriseOnside = _pGap >= 2 && agg > 0.62 && Math.random() < 0.15 ? "arm" : "never";
  }
  // PASS 6 (trick-play brain, weekly layer): a gambler staff facing an
  // aggressive defense — heavy blitz numbers or a hot-headed DC — dials up a
  // couple extra trick looks this week. Re-rolled every week like
  // surpriseOnside so it never drifts the staff's base gadgetRate.
  {
    var _oaggA, _oaggB, _oaggC;
    const _oppAgg = (_oaggC = (_oaggB = (_oaggA = opponent == null ? void 0 : opponent.coach) == null ? void 0 : _oaggA.personality) == null ? void 0 : _oaggB.aggression) != null ? _oaggC : 0.5;
    const _oppBlitz = ((opponent == null ? void 0 : opponent.gameplan) == null ? void 0 : opponent.gameplan.blitzPct) || 20;
    school.gameplan._gadgetWk = agg > 0.6 && (_oppAgg > 0.6 || _oppBlitz >= 30) ? randInt3(2, 4) * IQ.mult : 0;
  }
  if (lean >= 0.65 && agg > 0.6) wp.blitzShift = Math.round(8 * IQ.mult);
  const oppOptShare = (((_g = opponent == null ? void 0 : opponent.gameplan) == null ? void 0 : _g.offFormations) || []).filter((f) => f.id === "Wishbone" || f.id === "Flexbone").reduce((s, f) => s + (f.weight || 0), 0);
  if (oppOptShare >= 25) {
    wp.optionKey = agg > 0.6 ? "qb" : Math.random() < 0.5 ? "pitch" : "balanced";
  }
  const MOTION_HEAVY = ["Wildcat", "Flexbone", "Trips/Bunch", "Spread"];
  const oppMotionShare = (((_h = opponent == null ? void 0 : opponent.gameplan) == null ? void 0 : _h.offFormations) || []).filter((f) => MOTION_HEAVY.includes(f.id)).reduce((s, f) => s + (f.weight || 0), 0);
  if (oppOptShare >= 25 || oppMotionShare >= 60) wp.edgePlay = "contain";
  else if (lean >= 0.65 && agg > 0.6) wp.edgePlay = "crash";
  if (lean >= 0.65) wp.covShell = "two";
  else if (lean <= 0.35) wp.covShell = "single";
  const oppQBRun = ((_i = opponent == null ? void 0 : opponent.gameplan) == null ? void 0 : _i.qbRunPct) || 0;
  if (oppMotionShare >= 60 || oppOptShare >= 25 || oppQBRun >= 15) wp.covStyle = "zone";
  if (!wp.optionKey && oppQBRun >= 15) wp.optionKey = "qb";
  else if (lean >= 0.56 && agg > 0.5 && Math.random() < 0.5) wp.covStyle = "man";
  school.weeklyPlan = wp;
}
function avgRating(roster, pos) {
  const players = roster.filter((p) => p.position === pos);
  if (players.length === 0) return 0;
  return players.reduce((s, p) => s + p.compositeRating, 0) / players.length;
}
function avgRatingMulti(roster, positions) {
  const players = roster.filter((p) => positions.includes(p.position));
  if (players.length === 0) return 0;
  return players.reduce((s, p) => s + p.compositeRating, 0) / players.length;
}
function optimizeDepthChart(school) {
  school.depthChart = buildDepthChart(school.roster, school.gameplan);
}
function setAIPracticePlan(school) {
  const weakness = findWeakestGroup(school.roster);
  const minutes = __spreadValues({}, DEFAULT_PRACTICE);
  if (weakness === "OL") {
    minutes.PWR += 6;
    minutes.STR += 6;
    minutes.SPD -= 6;
    minutes.HND -= 6;
  }
  if (weakness === "QB") {
    minutes.TEC += 6;
    minutes.AWR += 6;
    minutes.HND -= 6;
    minutes.PWR -= 6;
  }
  if (weakness === "DB") {
    minutes.HND += 6;
    minutes.SPD += 6;
    minutes.PWR -= 6;
    minutes.STR -= 6;
  }
  school.practiceMinutes = minutes;
}
function findWeakestGroup(roster) {
  let weakPos = "QB", weakRating = 999;
  for (const pos of ["QB", "OL", "DL", "DB", "WR"]) {
    const players = roster.filter((p) => p.position === pos);
    if (players.length === 0) continue;
    const avg2 = players.reduce((s, p) => s + p.compositeRating, 0) / players.length;
    if (avg2 < weakRating) {
      weakRating = avg2;
      weakPos = pos;
    }
  }
  return weakPos;
}
var FORMATION_TEMPLATES, COACH_IQ;

FORMATION_TEMPLATES = {
  runHeavy: {
    mobile: [["Pistol/RPO", 50], ["Power-I", 25], ["Single Back", 15], ["Jumbo", 10]],
    pocket: [["Power-I", 40], ["Single Back", 48], ["Jumbo", 12]],
    // Service-academy branch: a slice of run-heavy mobile-QB staffs are true
    // triple-option programs (Jul 2026, expansion five). Rolled per-school in
    // pickFormations, not a bucket of its own — option ball is a philosophy
    // you commit to, not a lean.
    option: [["Flexbone", 45], ["Wishbone", 35], ["Power-I", 20]]
  },
  run: {
    mobile: [["Pistol/RPO", 40], ["Single Back", 40], ["Power-I", 20]],
    pocket: [["Single Back", 55], ["Power-I", 30], ["Pistol/RPO", 15]]
  },
  balanced: {
    mobile: [["Spread", 35], ["Pistol/RPO", 35], ["Single Back", 30]],
    pocket: [["Single Back", 55], ["Spread", 25], ["Power-I", 20]]
  },
  pass: {
    deep: [["Air Raid", 35], ["Spread", 30], ["Trips/Bunch", 20], ["Empty", 15]],
    short: [["Trips/Bunch", 40], ["Spread", 35], ["Single Back", 25]]
  },
  passHeavy: {
    deep: [["Air Raid", 45], ["Spread", 25], ["Empty", 15], ["Trips/Bunch", 15]],
    short: [["Spread", 40], ["Trips/Bunch", 30], ["Air Raid", 15], ["Empty", 15]]
  }
};
COACH_IQ = {
  freshman: { skip: 0.45, mult: 0.6 },
  varsity: { skip: 0, mult: 1 },
  allamerican: { skip: 0, mult: 1.25 },
  legend: { skip: 0, mult: 1.5 }
};

export { aiSetWeeklyReaction, optimizeDepthChart, setAIGameplan, setAIPracticePlan };
