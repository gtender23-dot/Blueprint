import { ARCHETYPE_DISTANCE, C, DEF_FRONT_COUNTS, DEF_FRONT_WEIGHTS, FORMATION_PACKAGES, FORMATION_ROLE_OVERRIDE, FORMATION_SITUATIONAL, FORMATION_VARIATIONS, FORMATION_WEIGHTS, FRONT_ROLES, MATCHUP_MATRIX, OFF_ROLE_BY_PLAY, SIZE_BANDS, SLOT_ELIGIBILITY, aliasFormation } from '../constants.js';
import { derivedArchetype, roleRating } from './player.js';
import { bridgeWaivesRole, sizeFitForRole } from './traits.js';

function fieldUnit(pos, count, depthChart, used) {
  const out = [];
  for (const id of depthChart[pos] || []) {
    if (out.length >= count) break;
    if (used.has(id)) continue;
    out.push(id);
    used.add(id);
  }
  if (out.length >= count) return out;
  for (const alt of SUB_CHAIN[pos] || []) {
    for (const id of depthChart[alt] || []) {
      if (out.length >= count) break;
      if (used.has(id)) continue;
      out.push(id);
      used.add(id);
    }
    if (out.length >= count) break;
  }
  return out;
}
// ── Formation Variations (Creativity Tools P1b) ───────────────────────────
// A variation is a sparse delta over the base formation's data bundle. Every
// hook below is inert when `varKey` is null/absent, so base play stays
// byte-identical (the run-scheme inert-by-default pattern). Selection rides the
// gameplan formation entry's `.variation` field; `pickedVariation` reads it back
// once the roll has chosen a formation.
function formationVariation(formationId, varKey) {
  if (!varKey) return null;
  const set = FORMATION_VARIATIONS[aliasFormation(formationId)];
  return set && set[varKey] || null;
}
function variedPackage(formationId, varKey) {
  const base = FORMATION_PACKAGES[aliasFormation(formationId)] || FORMATION_PACKAGES["Single Back"];
  const v = formationVariation(formationId, varKey);
  if (!v || !v.pkg) return base;
  return { ...base, ...v.pkg };
}
function pickedVariation(offFormations, chosenId) {
  const m = (offFormations || []).find((f) => f && f.variation && aliasFormation(f.id) === chosenId);
  return m ? m.variation : null;
}
// Additive passLean nudge the sim applies on top of FORMATIONS[id].passLean.
// (runIn/runOut deltas are descriptive data for the viewer/builder — the engine
// only reads passLean, so only it is threaded live.)
function variationPassLeanDelta(formationId, varKey) {
  const v = formationVariation(formationId, varKey);
  return v && v.lean && v.lean.passLean || 0;
}
function resolvePersonnel(formationId, depthChart, varKey = null) {
  const pkg = variedPackage(formationId, varKey);
  if (!pkg) return null;
  const used = /* @__PURE__ */ new Set();
  const personnel = {
    OL: fieldUnit("OL", 5, depthChart, used),
    QB: fieldUnit("QB", 1, depthChart, used)
  };
  const rbCount = (pkg.RB || 0) + (pkg.FB || 0);
  const rbAll = rbCount > 0 ? fieldUnit("RB", rbCount, depthChart, used) : [];
  const fbN = pkg.FB || 0;
  personnel.RB = fbN > 0 ? rbAll.slice(0, rbAll.length - fbN) : rbAll;
  personnel.FB = fbN > 0 ? rbAll.slice(rbAll.length - fbN) : [];
  for (const [pos, count] of Object.entries(pkg)) {
    if (pos === "RB" || pos === "FB") continue;
    personnel[pos] = count > 0 ? fieldUnit(pos, count, depthChart, used) : [];
  }
  return personnel;
}
function resolveDefPersonnel(frontId, depthChart, roster = null) {
  // Per-front position counts moved to constants.js (DEF_FRONT_COUNTS,
  // scheme-aware-roles pass Aug 2026) so the role/recruiting helpers read the
  // SAME table that fields the eleven — the two can never drift. The 46/Bear
  // ten-man bug (S: 1) lived in a stale local copy of this table.
  const FRONT_COUNTS = DEF_FRONT_COUNTS;
  const RUSH_SLOTS = {
    "4-3": ["DE", "DT"],
    "3-4": ["DE", "DT", "OLB"],
    "Nickel": ["DE", "DT"],
    "Dime": ["DE", "DT"],
    "46/Bear": ["DE", "DT"],
    "5-2": ["DE", "DT"],
    // 3-3-5: a three-man rush baseline — the stack backers cover; the heat
    // comes from the blitz machinery (any of six second-level hats).
    "3-3-5": ["DE", "DT"],
    // Wave 2: Tite/4-4 overhangs play space; Big Nickel is a 4-down nickel;
    // Penny's stand-up EDGEs are ON the line — they rush like 3-4 OLBs.
    "Tite": ["DE", "DT"],
    "4-4": ["DE", "DT"],
    "Big Nickel": ["DE", "DT"],
    "Penny": ["DE", "DT", "OLB"]
  };
  const counts = FRONT_COUNTS[frontId] || FRONT_COUNTS["4-3"];
  const used = /* @__PURE__ */ new Set();
  const ratingOf = roster ? (id) => {
    var _a;
    return ((_a = roster.find((p) => p.id === id)) == null ? void 0 : _a.compositeRating) || 0;
  } : null;
  const idealRoles = FRONT_ROLES[frontId] || null;
  const fill = (slotPos) => {
    var _a, _b, _c, _d, _e;
    const n = counts[slotPos] || 0;
    const out = [];
    for (let i = 0; i < n; i++) {
      let bestId = null, bestVal = -Infinity;
      const elig = SLOT_ELIGIBILITY[slotPos] || { [slotPos]: 1 };
      const idealRole = ((_a = idealRoles == null ? void 0 : idealRoles[slotPos]) == null ? void 0 : _a[i]) || null;
      for (const [pos, mult] of Object.entries(elig)) {
        for (const id of depthChart[pos] || []) {
          if (used.has(id)) continue;
          let val;
          if (ratingOf) {
            const p = roster.find((x) => x.id === id);
            if (p && idealRole) {
              const rv = roleRating(p, idealRole);
              const natural = derivedArchetype(p) || idealRole;
              const dist = (_d = (_c = (_b = ARCHETYPE_DISTANCE[p.position]) == null ? void 0 : _b[natural]) == null ? void 0 : _c[idealRole]) != null ? _d : 0;
              val = rv * (1 - dist * C.SCHEME_FIT_MOD) * mult;
            } else {
              val = ratingOf(id) * mult;
            }
          } else {
            val = (pos === slotPos ? 1e3 - out.length : 500) - depthChart[pos].indexOf(id);
          }
          if (val > bestVal) {
            bestVal = val;
            bestId = id;
          }
          if (!ratingOf && pos === slotPos) break;
        }
        if (!ratingOf && bestId && (SLOT_ELIGIBILITY[slotPos] || {})[slotPos] && ((_e = depthChart[slotPos]) == null ? void 0 : _e.includes(bestId))) break;
      }
      if (bestId) {
        used.add(bestId);
        out.push(bestId);
      }
    }
    return out;
  };
  const DE = fill("DE"), DT = fill("DT"), OLB = fill("OLB"), ILB = fill("LB"), CB = fill("CB"), S = fill("S");
  const rushSlots = RUSH_SLOTS[frontId] || RUSH_SLOTS["4-3"];
  const slotMap2 = { DE, DT, OLB, LB: ILB, CB, S };
  const DL = rushSlots.flatMap((k) => slotMap2[k]);
  return {
    // Granular positions (UI, roles, future features):
    DE,
    DT,
    OLB,
    ILB,
    CB,
    S,
    // Composed units (consumed by sim logic — DO NOT REMOVE):
    // LB keeps its historical semantic: ALL coverage backers on the field
    // (true LBs first so box-fit logic prefers thumpers; non-rushing OLBs
    // join them). In the 3-4 the OLBs rush, so LB = the two ILBs.
    LB: rushSlots.includes("OLB") ? ILB : [...ILB, ...OLB],
    DL,
    // pass-rush unit (front-dependent: 3-4 includes OLBs)
    DB: [...CB, ...S]
    // coverage unit: corners + safeties
  };
}
function assignRoles(players, roster, roleList) {
  var _a, _b, _c;
  const pool = players.map((id) => roster.find((p) => p.id === id)).filter(Boolean);
  const slots = [...roleList];
  const used = /* @__PURE__ */ new Set();
  const assigned = [];
  for (const role of slots) {
    let best = null, bestVal = -Infinity;
    for (const p of pool) {
      if (used.has(p.id)) continue;
      const rv = roleRating(p, role);
      const natural = derivedArchetype(p) || role;
      const dist = (_c = (_b = (_a = ARCHETYPE_DISTANCE[p.position]) == null ? void 0 : _a[natural]) == null ? void 0 : _b[role]) != null ? _c : 0;
      const eff = rv * (1 - dist * C.SCHEME_FIT_MOD);
      if (eff > bestVal) {
        bestVal = eff;
        best = p;
      }
    }
    if (best) {
      used.add(best.id);
      assigned.push({ player: best, role });
    }
  }
  return assigned;
}
// Roll a formation ENTRY (multi-look playbooks, Aug 2026): a gameplan can carry
// the same formation several times — Base + variations, each its own weighted
// entry — so the roll must return the WINNING ENTRY, not just an id. Returning
// only the id (the pre-multi-look shape) made pickedVariation grab the first
// variation-bearing entry for that id, which meant the Base look never played
// and only one variation ever appeared regardless of the look weights.
function rollFormationEntry(offFormations, eligible = null) {
  const liveAll = (offFormations || []).filter((f) => f && FORMATION_PACKAGES[aliasFormation(f.id)]);
  if (!liveAll.length) return null;
  const live = eligible ? liveAll.filter((f) => eligible(aliasFormation(f.id))).length ? liveAll.filter((f) => eligible(aliasFormation(f.id))) : liveAll : liveAll;
  const total = live.reduce((s, f) => s + (f.weight || 0), 0);
  if (total <= 0) return live[0];
  let r = Math.random() * total;
  for (const f of live) {
    r -= f.weight || 0;
    if (r <= 0) return f;
  }
  return live[live.length - 1];
}
function rollFormation(offFormations, eligible = null) {
  const e = rollFormationEntry(offFormations, eligible);
  return e ? aliasFormation(e.id) : "Single Back";
}
// W4 (§2): offensive personnel snapshot for the auto-sub picker.
function offPersonnelOf(formationId) {
  const p = FORMATION_PACKAGES[aliasFormation(formationId)] || {};
  return { backs: (p.RB || 0) + (p.FB || 0), te: p.TE || 0, wr: (p.WR || 0) + (p.SLOT || 0) };
}
// PASS 2 (Aug 2026): the call sheet's personnel axis. Collapses the formation
// packages into the six classes a real call sheet speaks — empty, 10, 11, 12,
// heavy (2+ backs), option (3-back bone looks). Computed from
// FORMATION_PACKAGES, so a future formation classifies itself; an unknown id
// reads as base 11 personnel. Wildcat lands in "heavy" here — the dedicated
// wildcat formCheck still fires on top for the contain audible.
var PERSONNEL_CLASSES = ["empty", "10", "11", "12", "heavy", "option"];
function offPersonnelClass(formationId) {
  const p = FORMATION_PACKAGES[aliasFormation(formationId)];
  if (!p) return "11";
  const backs = (p.RB || 0) + (p.FB || 0), te = p.TE || 0;
  if (backs === 0) return "empty";
  if (backs >= 3) return backs + te >= 5 ? "heavy" : "option";
  if (backs >= 2) return "heavy";
  if (te === 0) return "10";
  if (te === 1) return "11";
  return "12";
}
// FRONT SIGNATURE PRESSURE PACKAGES (§2): the blitz each front was born to
// run. Pressure Identity on AUTO resolves to this; calling the signature
// earns the disguise bonus, borrowing another front's heat costs a step.
var FRONT_PRESSURE_SIGNATURE, FRONT_SIG_LABEL;
FRONT_PRESSURE_SIGNATURE = {
  "4-3": "secondLevel",
  // SAM/WILL downhill — backer heat is the 4-3's language
  "3-4": "fireZone",
  // the OLB drop machinery IS the fire zone
  "Nickel": "theHouse",
  // the 4-2-5's six-man zero
  "Dime": "secondaryHeat",
  // six DBs: the heat comes from the secondary
  "46/Bear": "secondaryHeat",
  // JACK/CHARLIE — the SS walked down and coming
  "5-2": "secondLevel",
  // five down linemen, two ILBs shot through the gaps
  "3-3-5": "fireZone",
  // the stack's whole identity: show six, bring two, drop the rest
  "Tite": "fireZone",
  // overhang drops behind shown pressure — the mint front's language
  "4-4": "secondLevel",
  // SPUR/BANDIT downhill from an eight-man front
  "Big Nickel": "secondaryHeat",
  // the ROVER is the heat: a safety nobody accounts for
  "Penny": "fireZone"
  // EDGEs bail off the five-man look, backers replace
};
FRONT_SIG_LABEL = {
  "4-3": "backer heat (SAM/WILL downhill)",
  "3-4": "fire zones (OLB drops behind shown pressure)",
  "Nickel": "the six-man zero",
  "Dime": "secondary heat",
  "46/Bear": "JACK/CHARLIE — strong-safety heat off the edge",
  "5-2": "inside-backer heat behind the five-man wall",
  "3-3-5": "stack heat \u2014 any two of six, the offense guesses which",
  "Tite": "overhang fire zones behind the closed B-gaps",
  "4-4": "SPUR/BANDIT downhill from the eight-man front",
  "Big Nickel": "ROVER heat \u2014 the third safety nobody picks up",
  "Penny": "EDGE drops off the five-man light wall"
};
// FRONT MIX (Aug 2026, brain-expansion): the defensive mirror of offensive
// formation weights. On standard downs — anywhere the picker would just
// "return base" — a coach's weighted front mix rolls instead. Situational
// overrides (short-yardage walls, obvious-pass subs) and the hard Front dial
// still outrank it, exactly like the offense's situational brain overlays its
// formation weights. No mix (every AI plan) = return base, byte-identical.
// ── THE FRONT MIX SHAPE (fixed 2026-08-18) ──────────────────────────────────
// The mix rides in TWO shapes and always has: a defensive BOOK stores the map
// `{ "3-4": 60, "Nickel": 40 }` (what validateDefBook requires), while the Game
// Plan's sliders wrote an ARRAY of `{ id, weight }`. This function only ever
// understood the array — so from the moment defensive books started being
// applied, `Array.isArray` was false for every book-carrying team, `live` came
// out empty, and the roll returned the BASE FRONT every time.
//
// That silently disabled the front mix in all six shipped starter defenses:
// Attack 3-4 is written to play 40% Nickel on standard downs and played none.
// Measured before the fix: 4000/4000 standard downs in the 3-4; after, 60/40 as
// the book says. It is a large window too — the mix decides the front on ~63%
// of snaps at the default sub philosophy and ~93% on "Base".
//
// normalizeFrontMix accepts either shape and is the ONE place that knows both.
function normalizeFrontMix(mix) {
  if (Array.isArray(mix)) {
    return mix.filter((f) => f && f.id && (f.weight || 0) > 0 && DEF_FRONT_COUNTS[f.id])
      .map((f) => ({ id: f.id, weight: f.weight }));
  }
  if (mix && typeof mix === "object") {
    return Object.entries(mix)
      .filter(([id, w]) => (w || 0) > 0 && DEF_FRONT_COUNTS[id])
      .map(([id, weight]) => ({ id, weight }));
  }
  return [];
}
// The defensive twin of carriedOffLooks: which FRONTS does this team carry?
// 2026-08-19 — the Depth Chart's defense tab offered every front in the game
// (`Object.keys(DEF_FIELD_LAYOUTS)`), so you could pin a lineup into a front
// your defbook never calls. The identity front is ALWAYS included even if the
// mix somehow omits it: it is what selectDefFront falls back to, so it always
// takes the field and must always be pinnable.
function carriedDefFronts(gp) {
  const out = [];
  const push = (id) => { if (id && DEF_FRONT_COUNTS[id] && !out.includes(id)) out.push(id); };
  const identity = gp && gp.defFront && gp.defFront !== "auto" ? gp.defFront : gp && gp.defBaseFront;
  push(identity || "4-3");
  for (const f of normalizeFrontMix(gp && gp.defFrontMix)) push(f.id);
  return out;
}
function rollFrontMix(mix, base) {
  const live = normalizeFrontMix(mix);
  if (!live.length) return base;
  let r = Math.random() * live.reduce((s, f) => s + f.weight, 0);
  for (const f of live) {
    if ((r -= f.weight) <= 0) return f.id;
  }
  return live[live.length - 1].id;
}
function selectDefFront(baseFront, down, distance, clock, half, trailing, offFormationId = null, philosophy = "auto", frontMix = null) {
  const base = baseFront || "4-3";
  // The odd stack is already a five-DB answer: everywhere the picker would
  // sub a 4-2-5 Nickel onto the field, a 3-3-5-base team just stays in its
  // stack (Dime on true obvious-pass downs still applies).
  const nickelOf = (b) => b === "3-3-5" || b === "Big Nickel" ? b : "Nickel";
  const pers = offFormationId ? offPersonnelOf(offFormationId) : null;
  const spread4 = !!pers && pers.wr >= 4;
  const spread3 = !!pers && pers.wr === 3;
  const heavy = !!pers && pers.backs + pers.te >= 3 && pers.wr <= 2;
  if (down >= 3 && distance <= 2 && !spread4) return distance <= 1 ? "5-2" : "46/Bear";
  if (philosophy === "match" && pers) {
    if (spread4) return (down === 3 || down === 4) && distance >= 8 ? "Dime" : nickelOf(base);
    if (spread3) return (down === 3 || down === 4) && distance >= 10 ? "Dime" : nickelOf(base);
    if (heavy && distance <= 4) return "46/Bear";
  }
  if (philosophy === "base") {
    if ((down === 3 || down === 4) && distance >= 12) return nickelOf(base);
    if (half === 2 && clock < 120 && trailing > 10) return nickelOf(base);
    return rollFrontMix(frontMix, base);
  }
  if (spread4) return (down === 3 || down === 4) && distance >= 6 ? "Dime" : nickelOf(base);
  if (heavy && distance <= 4 && philosophy !== "base") return "46/Bear";
  if ((down === 3 || down === 4) && distance >= 10) return "Dime";
  if ((down === 3 || down === 4) && distance >= 6) return nickelOf(base);
  if (half === 2 && clock < 120 && trailing > 10) return nickelOf(base);
  return rollFrontMix(frontMix, base);
}
function resolveOffRole(formationId, playType, pos) {
  var _a, _b, _c;
  const ovr = (_b = (_a = FORMATION_ROLE_OVERRIDE[formationId]) == null ? void 0 : _a[playType]) == null ? void 0 : _b[pos];
  if (ovr) return ovr;
  return ((_c = OFF_ROLE_BY_PLAY[playType]) == null ? void 0 : _c[pos]) || null;
}
function offUnitStrengthRoles(personnel, roster, weights, formationId, playType) {
  let unit = 0;
  for (const [pos, weight] of Object.entries(weights)) {
    const ids = personnel[pos] || [];
    const players = ids.map((id) => roster.find((p) => p.id === id)).filter(Boolean);
    if (players.length === 0) {
      unit += weight * 30;
      continue;
    }
    const role = resolveOffRole(formationId, playType, pos);
    let sum = 0;
    for (const p of players) {
      sum += role ? roleRating(p, role) : p.compositeRating;
    }
    unit += weight * (sum / players.length);
  }
  return unit;
}
function defUnitStrengthSchemeFit(defPersonnel, frontId, roster, weights) {
  const frontRoles = FRONT_ROLES[frontId];
  let unit = 0;
  for (const [pos, weight] of Object.entries(weights)) {
    const ids = defPersonnel[pos] || [];
    const players = ids.map((id) => roster.find((p) => p.id === id)).filter(Boolean);
    if (players.length === 0) {
      unit += weight * 30;
      continue;
    }
    const roleList = (frontRoles == null ? void 0 : frontRoles[pos]) || [];
    if (roleList.length === 0) {
      const avg2 = players.reduce((s, p) => s + p.compositeRating, 0) / players.length;
      unit += weight * avg2;
      continue;
    }
    const assigned = assignRoles(ids, roster, roleList);
    let sum = 0;
    for (const { player, role } of assigned) sum += effectiveRoleRating(player, pos, role);
    unit += weight * (sum / assigned.length);
  }
  return unit;
}
function effectiveRoleRating(player, pos, assignedRole) {
  var _a, _b;
  if (!assignedRole) return player.compositeRating;
  const roleVal = roleRating(player, assignedRole);
  const natural = derivedArchetype(player) || assignedRole;
  const distTable = (_a = ARCHETYPE_DISTANCE[pos]) == null ? void 0 : _a[natural];
  // Identity stage 2: a bridge trait serves its named job family at ZERO
  // archetype distance — the tweener plays the role at full rate.
  const dist = bridgeWaivesRole(player, assignedRole) ? 0 : distTable ? (_b = distTable[assignedRole]) != null ? _b : 0 : 0;
  const fitMult = 1 - dist * C.SCHEME_FIT_MOD;
  // Identity stage 1: the size-fit term — 1.0 in the role's window, gentle
  // falloff outside, hard-capped (~8–10%). Kill-switch: __noSizeFit.
  return roleVal * fitMult * sizeFitForRole(player, assignedRole, SIZE_BANDS);
}
function getMatchupEdge(offFormation, defFront, varKey = null) {
  var _a, _b;
  const base = (_b = (_a = MATCHUP_MATRIX[offFormation]) == null ? void 0 : _a[defFront]) != null ? _b : 1;
  const v = formationVariation(offFormation, varKey);
  if (!v || !v.matchup || v.matchup[defFront] == null) return base;
  return Math.max(0.75, Math.min(1.25, base + v.matchup[defFront]));
}
function getSituationalMod(formationId, down, distance, clock, fieldPos, varKey = null) {
  const profile = FORMATION_SITUATIONAL[formationId];
  if (!profile) return 1;
  const distFromGoal = 100 - fieldPos;
  let bucket;
  if (distFromGoal <= 5) bucket = "redZone";
  else if (down >= 3 && distance <= 2) bucket = "shortYardage";
  else if (down >= 3 && distance >= 7) bucket = "thirdLong";
  else if (clock < 120) bucket = "twoMinute";
  else bucket = "standard";
  const base = profile[bucket];
  const v = formationVariation(formationId, varKey);
  if (!v || !v.situational || v.situational[bucket] == null) return base;
  return Math.max(0.6, Math.min(1.35, base + v.situational[bucket]));
}
function schemeAdjustedOVR(player, frontId) {
  var _a;
  if (player.position !== "DE" && player.position !== "OLB" && player.position !== "LB") return player.compositeRating;
  const pos = player.position;
  const roles = (_a = FRONT_ROLES[frontId]) == null ? void 0 : _a[pos];
  if (!roles || roles.length === 0) return player.compositeRating;
  let best = -Infinity;
  for (const role of new Set(roles)) {
    const eff = effectiveRoleRating(player, pos, role);
    if (eff > best) best = eff;
  }
  return Math.round(best);
}
function getOffWeights(formationId, playType) {
  var _a, _b;
  return (_b = (_a = FORMATION_WEIGHTS[formationId]) == null ? void 0 : _a[playType]) != null ? _b : null;
}
function getDefWeights(frontId, playType) {
  var _a, _b;
  return (_b = (_a = DEF_FRONT_WEIGHTS[frontId]) == null ? void 0 : _a[playType]) != null ? _b : null;
}
var SUB_CHAIN;

SUB_CHAIN = {
  QB: ["RB", "WR", "TE"],
  // the emergency QB nobody wants
  RB: ["WR", "TE"],
  WR: ["TE", "RB", "CB"],
  // corners have played receiver forever
  TE: ["OL", "RB", "WR"],
  // jumbo: a sixth lineman is the classic answer
  OL: ["TE", "DT"],
  // a true emergency — DTs flip to OL in a pinch
  DE: ["OLB", "DT", "LB"],
  DT: ["DE", "OL"],
  OLB: ["LB", "DE", "S"],
  LB: ["OLB", "S", "DE"],
  CB: ["S", "WR"],
  S: ["CB", "LB", "OLB"],
  K: ["P"],
  P: ["K"]
};

export { normalizeFrontMix, carriedDefFronts, FRONT_PRESSURE_SIGNATURE, FRONT_SIG_LABEL, PERSONNEL_CLASSES, defUnitStrengthSchemeFit, formationVariation, getDefWeights, getMatchupEdge, getOffWeights, getSituationalMod, offPersonnelClass, offPersonnelOf, offUnitStrengthRoles, pickedVariation, resolveDefPersonnel, resolvePersonnel, rollFormation, rollFormationEntry, schemeAdjustedOVR, selectDefFront, variationPassLeanDelta, variedPackage };
