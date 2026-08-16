import { __spreadProps, __spreadValues } from '../_spread.js';
import { ATTRIBUTES, ATTR_FLOORS, C, OVR_POS_ADJ, POS_WEIGHTS, RECRUIT_CORE, ROLE_WEIGHTS, SIZE_BANDS } from '../constants.js';
import { COMBINE_DIST } from '../data_combine.js';
import { rollTraits } from './traits.js';
import { clamp2, distanceMiles, randInt3, randNorm, randomLocation, randomName, uuid } from '../utils.js';

function injurySeverity(games) {
  if (games >= 7) return "major";
  if (games >= 4) return "severe";
  if (games >= 2) return "moderate";
  return "minor";
}
function makeInjury(games, week = 0) {
  const sev = injurySeverity(games);
  const cat = INJURY_CATALOG[sev];
  return {
    type: cat.types[randInt3(0, cat.types.length - 1)],
    severity: sev,
    severityLabel: cat.label,
    gamesOut: games,
    totalGames: games,
    weekInjured: week
  };
}
function avg(vals) {
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}
function axisLean(player, groupA, groupB) {
  const a = avg(groupA.map((x) => player.attributes[x] || 0));
  const b = avg(groupB.map((x) => player.attributes[x] || 0));
  return a - b;
}
function rawComposite(attributes, position) {
  const w = POS_WEIGHTS[position] || POS_WEIGHTS.QB;
  const total = Object.values(w).reduce((s, v) => s + v, 0);
  let sum = 0;
  for (const attr of ATTRIBUTES) sum += (attributes[attr] || 0) * (w[attr] || 0);
  return sum / total;
}
function posAdjust(raw, position) {
  return clamp2(raw + (OVR_POS_ADJ[position] || 0), 1, 99);
}
function compositeRating(player) {
  return posAdjust(rawComposite(player.attributes, player.position), player.position);
}
function roleRating(player, role) {
  const w = ROLE_WEIGHTS[role] || POS_WEIGHTS[player.position] || POS_WEIGHTS.QB;
  const total = Object.values(w).reduce((s, v) => s + v, 0);
  let sum = 0;
  for (const attr of ATTRIBUTES) {
    sum += (player.attributes[attr] || 0) * (w[attr] || 0);
  }
  return sum / total;
}
function derivedArchetype(player) {
  const fn = ARCHETYPE_DERIVE[player.position];
  if (!fn) return null;
  return fn(player);
}
function refreshRatings(player) {
  var _a;
  let comp = compositeRating(player);
  if ((_a = player.convPenalty) == null ? void 0 : _a.factor) comp *= 1 - player.convPenalty.factor;
  player.compositeRating = Math.round(comp);
  player.roleRatings = {};
  const pos = player.position;
  const roles = ROLES_BY_POS[pos];
  if (roles) {
    for (const role of roles) {
      player.roleRatings[role] = Math.round(roleRating(player, role));
    }
    player.roleRatings[pos] = player.compositeRating;
  } else {
    player.roleRatings[pos] = player.compositeRating;
  }
}
function archCapTilt(archetype) {
  var _a;
  const capped = C.CAPPED_ATTRS || ATTRIBUTES;
  const out = {};
  for (const a of capped) out[a] = 0;
  const w = ROLE_WEIGHTS[archetype];
  if (!w) return out;
  const vals = capped.map((a) => w[a] || 0);
  const sum = vals.reduce((s, x) => s + x, 0);
  if (sum <= 0) return out;
  const mean = sum / capped.length;
  const spread = (_a = C.PHYS_CAP_ARCH_SPREAD) != null ? _a : 6;
  capped.forEach((a, i) => {
    const dev = (vals[i] - mean) / Math.max(mean, 6);
    out[a] = Math.max(0, Math.round(spread * Math.min(dev, 1)));
  });
  return out;
}
function generatePotential(attrs, prestigeBonus = 0, tier = 3, physCapOverride = null, capTilt = null) {
  const bands = ["average", "good", "great", "sky"];
  const w = C.PRESTIGE_BAND_W * prestigeBonus;
  const sky = clamp2(0.1 + w, 0.03, 0.2);
  const great = clamp2(0.2 + w, 0.08, 0.3);
  const good = 0.35;
  const avg2 = Math.max(0.05, 1 - good - great - sky);
  const sum = avg2 + good + great + sky;
  const weights = [avg2 / sum, good / sum, great / sum, sky / sum];
  let r = Math.random();
  let band = "average";
  for (let i = 0; i < bands.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      band = bands[i];
      break;
    }
  }
  const spread = C.POTENTIAL_BAND[band];
  const physCap = physCapOverride != null ? physCapOverride : C.PHYS_CAP_BY_TIER && C.PHYS_CAP_BY_TIER[tier] || 99;
  const CAPPED = C.CAPPED_ATTRS || ["SPD", "AGI", "PWR", "STR", "JMP"];
  const caps = {};
  for (const attr of ATTRIBUTES) {
    let ceil = 99;
    if (physCap < 99 && CAPPED.includes(attr)) ceil = clamp2(physCap + ((capTilt == null ? void 0 : capTilt[attr]) || 0), 1, 99);
    const lo = Math.min(attrs[attr], ceil);
    caps[attr] = clamp2(attrs[attr] + Math.round(randNorm(spread, 6)), lo, ceil);
  }
  return { band, caps };
}
function divisionBase(tier) {
  var _a;
  return (_a = C.DIV_BASE_BY_TIER[tier]) != null ? _a : 26;
}
// Identity stage 1 (Pass 4.5): THE SIZE FLIP. The frame rolls FIRST, with fat
// tails — real tweeners must exist (the 6'2" 226 safety, the 240 OLB who
// runs). Attributes then take soft priors FROM the frame (heavy → STR bias),
// inverting the old attribute→size skew that rollSize used to apply.
// rollSize (the attribute→size direction) is retired; rollFrame replaces it
// at the one generation site (createRecruit).
function rollFrame(position, archetype) {
  const band = archetype && SIZE_BANDS.byArchetype[archetype] || SIZE_BANDS.byPos[position] || SIZE_BANDS.byPos.WR;
  const [hMin, hMax, wMin, wMax] = band;
  // height: wider spread than before, small spill past the band edges
  const hFrac = clamp2(randNorm(0.5, 0.26), -0.25, 1.25);
  const inches = Math.round(hMin + hFrac * (hMax - hMin));
  // weight tracks height only loosely, with its own scatter PLUS a rare
  // true-tweener kicker. Two regimes on purpose: the everyday scatter stays
  // tight (weight feeds convex on-field hinges — broken-tackle weightOver,
  // jump balls, block size — so a wide everyday σ would lift league rushing
  // by itself, measured at +11 yds/gm in trait_band_ab), while ~7% of frames
  // draw the outlier kicker that makes the 6'2" 226 safety actually exist.
  let wFrac = clamp2(hFrac * 0.5 + randNorm(0.25, 0.24), -0.3, 1.3);
  if (Math.random() < 0.09) wFrac = clamp2(wFrac + (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.55), -0.65, 1.9);
  const weight = Math.round(wMin + wFrac * (wMax - wMin));
  const ft = Math.floor(inches / 12);
  const inch = ((inches % 12) + 12) % 12;
  const height = `${ft}'${inch}"`;
  // bulk index: where this body sits in (and beyond) the band, for the soft
  // attribute priors. 0 = band centre, ±0.5 = band edges.
  const bulk = (weight - (wMin + wMax) / 2) / (wMax - wMin);
  return { height, weight, heightInches: inches, _bulk: bulk, _hFrac: hFrac };
}
// Soft attribute priors FROM the frame — small, zero-sum in spirit. A heavy
// frame biases STR/PWR up and SPD/AGI down; a lean frame the reverse. Height
// nudges JMP a touch. Fit, not power: a few points at the tails, near-zero
// for an in-band body.
function applyFramePriors(attrs, frame) {
  const b = frame._bulk || 0;
  const h = (frame._hFrac || 0.5) - 0.5;
  attrs.STR = clamp2(Math.round(attrs.STR + b * 7), 1, 99);
  attrs.PWR = clamp2(Math.round(attrs.PWR + b * 5), 1, 99);
  attrs.SPD = clamp2(Math.round(attrs.SPD - b * 6), 1, 99);
  attrs.AGI = clamp2(Math.round(attrs.AGI - b * 5), 1, 99);
  if (attrs.JMP != null) attrs.JMP = clamp2(Math.round(attrs.JMP + h * 4), 1, 99);
}
function createRecruit(position, tier = 1, schoolLat = 40, schoolLng = -82, prestigeBonus = 0) {
  var _a, _b;
  const base = divisionBase(tier) + prestigeBonus;
  const coreInfo = RECRUIT_CORE[position] || RECRUIT_CORE.QB;
  const starBase = (_a = C.STAR_RATE_BY_TIER[tier]) != null ? _a : 0.18;
  const isStar = Math.random() < clamp2(starBase + prestigeBonus * C.PRESTIGE_STAR_W, 0.02, 0.45);
  const threshold = isStar ? coreInfo.star : coreInfo.solid;
  const coreCap = (_b = C.CORE_CAP_BY_TIER[tier]) != null ? _b : 88;
  // Identity stage 1: the frame rolls FIRST (archetype only shapes which band
  // the body draws from). Attributes below then take soft priors from it.
  const archetype = rollArchetype(position);
  const frame = rollFrame(position, archetype);
  const attrs = {};
  for (const attr of ATTRIBUTES) {
    const coreIdx = coreInfo.core.indexOf(attr);
    let mean, sd;
    if (coreIdx >= 0) {
      mean = clamp2(base + threshold[coreIdx] * 0.6 + randNorm(0, 5), 10, coreCap);
      sd = 8;
    } else if (["WE", "CON"].includes(attr)) {
      mean = base + 15;
      sd = 15;
    } else {
      mean = base;
      sd = 10;
    }
    attrs[attr] = clamp2(Math.round(randNorm(mean, sd)), 1, 99);
  }
  applyFramePriors(attrs, frame);
  if (archetype && ROLE_WEIGHTS[archetype]) {
    const ranked = Object.entries(ROLE_WEIGHTS[archetype]).sort((a, b) => b[1] - a[1]);
    for (const [a] of ranked.slice(0, 3)) {
      if (attrs[a] != null) attrs[a] = clamp2(attrs[a] + randInt3(4, 10), 1, 99);
    }
    const siblings = (ROLES_BY_POS[position] || []).filter((r) => r !== archetype);
    for (const sib of siblings) {
      const sibRanked = Object.entries(ROLE_WEIGHTS[sib] || {}).sort((a, b) => b[1] - a[1]).slice(0, 2);
      for (const [a] of sibRanked) {
        if (attrs[a] != null && !ranked.slice(0, 3).some(([x]) => x === a)) {
          attrs[a] = clamp2(attrs[a] - randInt3(2, 6), 1, 99);
        }
      }
    }
  }
  if (position === "QB") {
    if (archetype === "QB-Dual" || archetype === "QB-Scrambler") {
      const pocket = (attrs.STR + attrs.TEC + attrs.AWR) / 3;
      const leanMult = archetype === "QB-Scrambler" ? 1.4 : 1;
      const mobTarget = Math.min(99, pocket + randNorm(C.QB_RUSH_LEAN * leanMult, C.QB_RUSH_LEAN_SD));
      for (const a of ["SPD", "AGI"]) {
        attrs[a] = clamp2(Math.round(Math.max(attrs[a], randNorm(mobTarget, 6))), 1, 99);
      }
    } else {
      for (const a of ["SPD", "AGI"]) attrs[a] = clamp2(attrs[a] - randInt3(6, 13), 1, 99);
    }
  }
  if (position === "RB" && archetype && archetype.startsWith("FB")) {
    for (const a of ["SPD", "AGI"]) attrs[a] = clamp2(Math.min(attrs[a], randInt3(34, 48)), 1, 99);
    attrs.STR = clamp2(attrs.STR + randInt3(6, 12), 1, 99);
    attrs.PWR = clamp2(attrs.PWR + randInt3(5, 10), 1, 99);
  }
  const loc = randomLocation();
  const distance = distanceMiles(schoolLat, schoolLng, loc.lat, loc.lng);
  {
    const roll = Math.random();
    const M = ["SPD", "AGI", "PWR", "STR", "JMP"], K = ["HND", "SEC", "TEC", "AWR"];
    if (roll < 0.06) {
      for (const a of M) attrs[a] = clamp2(attrs[a] + randInt3(12, 24), 1, 99);
      for (const a of K) attrs[a] = clamp2(attrs[a] - randInt3(6, 16), 1, 99);
    } else if (roll < 0.12) {
      for (const a of K) attrs[a] = clamp2(attrs[a] + randInt3(10, 20), 1, 99);
      for (const a of M) attrs[a] = clamp2(attrs[a] - randInt3(6, 14), 1, 99);
    }
  }
  {
    const _athl = (attrs.SPD + attrs.AGI) / 2;
    attrs.STR = clamp2(Math.round(Math.max(attrs.STR, base * 0.35 + _athl * 0.35 + randNorm(0, 6))), 1, 99);
    attrs.PWR = clamp2(Math.round(0.45 * attrs.PWR + 0.55 * attrs.STR + randNorm(0, 5)), 1, 99);
  }
  const CAPPED_ATTRS = C.CAPPED_ATTRS || ["SPD", "AGI", "PWR", "STR", "JMP"];
  const physCap = C.PHYS_CAP_BY_TIER && C.PHYS_CAP_BY_TIER[tier] || 99;
  const headroomBase = C.PHYS_SPAWN_HEADROOM_BY_TIER && C.PHYS_SPAWN_HEADROOM_BY_TIER[tier] != null ? C.PHYS_SPAWN_HEADROOM_BY_TIER[tier] : 0;
  const spawnCap = Math.max(1, physCap - headroomBase);
  const capTilt = archCapTilt(archetype);
  const spawnCapOf = (a) => Math.max(1, Math.min(99, spawnCap + (capTilt[a] || 0)));
  if (physCap < 99) {
    for (const a of CAPPED_ATTRS) {
      const c = spawnCapOf(a);
      if (attrs[a] > c) attrs[a] = c;
    }
  }
  {
    const floors = ATTR_FLOORS[position];
    if (floors) {
      const tierScale = tier === 3 ? 1 : tier === 2 ? 0.86 : 0.72;
      for (const [attr, floor] of Object.entries(floors)) {
        const f = Math.round(floor * tierScale);
        if (attrs[attr] < f) attrs[attr] = clamp2(Math.round(randNorm(f + 4, 4)), f, 99);
      }
    }
  }
  if (physCap < 99) {
    for (const a of CAPPED_ATTRS) {
      const c = spawnCapOf(a);
      if (attrs[a] > c) attrs[a] = c;
    }
  }
  if (position === "RB" && archetype && archetype.startsWith("FB")) {
    for (const a of ["SPD", "AGI"]) attrs[a] = clamp2(Math.min(attrs[a], randInt3(28, 40)), 1, 99);
    const blockFloor = Math.min(spawnCapOf("STR"), 60);
    attrs.STR = clamp2(Math.max(attrs.STR, blockFloor), 1, 99);
    attrs.PWR = clamp2(Math.max(attrs.PWR, Math.min(spawnCapOf("PWR"), 58)), 1, 99);
  }
  const weCfg = C.CAP_WE_OVERAGE || { pivot: 55, step: 0.22, max: 7 };
  const weBonus = physCap < 99 ? clamp2(Math.round(((attrs.WE || 0) - weCfg.pivot) * weCfg.step), 0, weCfg.max) : 0;
  const softCap = physCap < 99 ? Math.min(99, physCap + weBonus) : 99;
  const potential = generatePotential(attrs, prestigeBonus, tier, softCap, capTilt);
  const trueComp = posAdjust(rawComposite(attrs, position), position);
  const visionRating = posAdjust(
    ATTRIBUTES.reduce((s, a) => s + (attrs[a] || 0), 0) / ATTRIBUTES.length + C.VIS_CENTRE,
    position
  );
  const name = randomName();
  const { height, weight, heightInches } = frame;
  // Identity stage 2: the trait block rolls at generation — quality-blind by
  // construction (Borderlands rule). New generations only: nothing retro-rolls.
  const traits = rollTraits(position, weight, SIZE_BANDS);
  const gpa = Math.round((1.5 + Math.random() * 2.5) * 10) / 10;
  return __spreadProps(__spreadValues({
    id: uuid(),
    name,
    position,
    recruitTier: tier,
    height,
    weight,
    heightInches,
    traits,
    gpa,
    // PASS 7 (Fix D): usage morale — persistent, off-field only. Legacy saves
    // lazy-init to the same baseline on their first tick.
    morale: C.PASS7 ? C.PASS7.moraleInit : 70,
    hometown: loc,
    distanceFromSchool: Math.round(distance),
    attributes: attrs,
    potentialCaps: potential.caps
  }, generateMeasurables(attrs, position)), {
    potentialBand: potential.band,
    potentialRevealed: false,
    visionRating: Math.round(visionRating),
    compositeRating: Math.round(trueComp),
    // Chunk 15: no stored archetype — the local `archetype` var above only
    // shapes attribute skew + size band at creation. Read derivedArchetype(p)
    // for the live, stat-derived descriptor from here on.
    roleRatings: {},
    // Recruiting state
    interest: {},
    // { schoolId: 0-100 }
    committed: null,
    // schoolId
    offers: [],
    // [schoolId]
    considering: [],
    // [schoolId] — schools spending on them
    decisionStatus: "undecided",
    campusVisits: 0
  });
}
function createWalkOn(position, schoolLat = 40, schoolLng = -82) {
  const r = createRecruit(position, 1, schoolLat, schoolLng);
  for (const attr of ATTRIBUTES) {
    r.attributes[attr] = clamp2(Math.round(r.attributes[attr] * 0.55 + randNorm(0, 4)), 1, 48);
  }
  const trueComp = posAdjust(rawComposite(r.attributes, position), position);
  r.compositeRating = Math.round(trueComp);
  r.visionRating = Math.round(clamp2(trueComp + randNorm(0, 6), 1, 99));
  r.potentialBand = "average";
  r.potentialRevealed = true;
  r.isWalkOn = true;
  r.gpa = Math.round((2 + Math.random() * 1.5) * 10) / 10;
  return r;
}
function createPlayer(position, classYear = "FR", tier = 1, prestigeBonus = 0) {
  const r = createRecruit(position, tier, 40, -82, prestigeBonus);
  const p = {
    id: uuid(),
    name: r.name,
    position,
    classYear,
    redshirted: false,
    redshirtYear: null,
    attributes: r.attributes,
    potentialCaps: r.potentialCaps,
    measurables: r.measurables,
    ras: r.ras,
    potentialBand: r.potentialBand,
    potentialRevealed: true,
    compositeRating: 0,
    roleRatings: {},
    // Chunk 15: no stored archetype — see derivedArchetype(p).
    height: r.height,
    weight: r.weight,
    heightInches: r.heightInches,
    // identity: the trait block survives the whitelist copy (world-gen rosters
    // must match signed recruits — see IDENTITY_DESIGN §7)
    traits: r.traits,
    // PASS 7: morale survives the whitelist copy too (same parity law)
    morale: r.morale,
    gpa: r.gpa,
    hometown: r.hometown,
    promises: { frStart: false, soStart: false, pctPlays: null },
    fatigue: 0,
    injuryGamesOut: 0,
    stats: emptyStats(),
    careerStats: emptyStats()
  };
  if (classYear !== "FR") {
    const yearBoost = { SO: 1, JR: 2, SR: 3 }[classYear] || 0;
    for (const attr of ATTRIBUTES) {
      const headroom = p.potentialCaps[attr] - p.attributes[attr];
      p.attributes[attr] = clamp2(p.attributes[attr] + Math.round(headroom * yearBoost * 0.2), 1, 99);
    }
  }
  refreshRatings(p);
  return p;
}
function rollArchetype(position) {
  const roles = ROLES_BY_POS[position];
  if (!roles) return null;
  const w = GEN_ARCH_WEIGHTS[position];
  if (w) {
    let total = 0;
    for (const r of roles) total += w[r] || 0;
    if (total > 0) {
      let x = Math.random() * total;
      for (const r of roles) {
        x -= w[r] || 0;
        if (x <= 0) return r;
      }
    }
  }
  return roles[Math.floor(Math.random() * roles.length)];
}
function emptyStats() {
  return {
    games: 0,
    rushAtt: 0,
    rushYds: 0,
    rushTD: 0,
    recAtt: 0,
    recComp: 0,
    recYds: 0,
    recTD: 0,
    targets: 0,
    passAtt: 0,
    passComp: 0,
    passYds: 0,
    passTD: 0,
    passInt: 0,
    tackles: 0,
    tacklesForLoss: 0,
    sacks: 0,
    ints: 0,
    brokenTackles: 0,
    missedTackles: 0,
    yardsAfterContact: 0,
    pressures: 0,
    contestedTgt: 0,
    contestedRec: 0,
    passBreakups: 0,
    forcedFumbles: 0,
    batted: 0,
    fgAtt: 0,
    fgMade: 0,
    puntYds: 0,
    puntCount: 0
  };
}
function advanceClassYear(player, currentSeason) {
  const order = ["FR", "SO", "JR", "SR"];
  const idx = order.indexOf(player.classYear);
  if (idx === -1) return false;
  if (player.redshirted && player.redshirtYear != null && player.redshirtYear === currentSeason) {
    return true;
  }
  if (idx === 3) return false;
  player.classYear = order[idx + 1];
  return true;
}
function drillAt(table, pct) {
  if (!table) return null;
  const pts = [[0.1, table.p10], [0.25, table.p25], [0.5, table.p50], [0.75, table.p75], [0.9, table.p90]];
  const p = 0.1 + Math.min(2.2, Math.max(-0.25, pct)) * 0.8;
  if (p > 0.9) {
    const slope = (table.p90 - table.p75) / 0.15 * (table._slowTail || 1);
    return table.p90 + (p - 0.9) * slope;
  }
  if (p < 0.1) {
    const slope = (table.p25 - table.p10) / 0.15 * 1.3;
    return table.p10 + (p - 0.1) * slope;
  }
  for (let i = 0; i < pts.length - 1; i++) {
    if (p <= pts[i + 1][0]) {
      const t = (p - pts[i][0]) / (pts[i + 1][0] - pts[i][0]);
      return pts[i][1] + t * (pts[i + 1][1] - pts[i][1]);
    }
  }
  return table.p90;
}
function attrToNflPct(attr) {
  return -0.6 + Math.pow(attr / 100, 1.05) * 1.7;
}
function generateMeasurables(attrs, position) {
  const T = COMBINE_DIST[POS_TABLE[position] || "WR"] || COMBINE_DIST.WR;
  const spd2 = attrToNflPct(attrs.SPD), agi = attrToNflPct(attrs.AGI), str = attrToNflPct(attrs.STR), jmp = attrToNflPct(attrs.JMP), pwr = attrToNflPct(attrs.PWR);
  const timed = (t) => t ? __spreadProps(__spreadValues({}, t), { _slowTail: 3 }) : t;
  const forty = jit(drillAt(timed(T.Forty), 1 - spd2), 0.02);
  const shuttle = jit(drillAt(timed(T.Shuttle), 1 - agi), 0.03);
  const cone = jit(drillAt(timed(T.Cone), 1 - agi), 0.04);
  const vert = jit(drillAt(T.Vertical, jmp), 0.6);
  const broad = jit(drillAt(T.BroadJump, (jmp + pwr) / 2), 1.2);
  const bench = Math.max(2, Math.round(jit(drillAt(T.BenchReps, str * 0.7 + pwr * 0.3), 1.2)));
  const m = {
    forty: Math.round(forty * 100) / 100,
    split10: Math.round((forty * 0.36 + jit(0, 0.015)) * 100) / 100,
    shuttle: Math.round(shuttle * 100) / 100,
    cone: Math.round(cone * 100) / 100,
    vert: Math.round(vert * 10) / 10,
    broad: Math.round(broad),
    bench
  };
  const pcts = [];
  const pctOf = (table, val, invert) => {
    if (!table) return null;
    const lo = table.p10, hi = table.p90;
    let p = (val - lo) / (hi - lo || 1);
    if (invert) p = 1 - p;
    return Math.min(1, Math.max(0, 0.1 + p * 0.8));
  };
  const push = (v) => {
    if (v != null) pcts.push(v);
  };
  push(pctOf(T.Forty, m.forty, true));
  push(pctOf(T.Shuttle, m.shuttle, true));
  push(pctOf(T.Cone, m.cone, true));
  push(pctOf(T.Vertical, m.vert, false));
  push(pctOf(T.BroadJump, m.broad, false));
  push(pctOf(T.BenchReps, m.bench, false));
  const ras = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length * 100) / 10 : 5;
  return { measurables: m, ras };
}
var INJURY_CATALOG, ROLES_BY_POS, ARCHETYPE_DERIVE, GEN_ARCH_WEIGHTS, POS_TABLE, jit;

INJURY_CATALOG = {
  minor: { label: "Minor", types: ["Bruised Ribs", "Ankle Tweak", "Hip Pointer", "Jammed Finger", "Stinger", "Cramps"] },
  moderate: { label: "Moderate", types: ["Sprained Ankle", "Hamstring Strain", "Sprained MCL", "Shoulder Sprain", "High Ankle Sprain", "Groin Strain"] },
  severe: { label: "Severe", types: ["Hamstring Tear", "Broken Hand", "High-Grade MCL", "Fractured Rib", "Turf Toe (severe)", "Concussion"] },
  major: { label: "Major", types: ["Torn ACL", "Broken Leg", "Torn Labrum", "Lisfranc Injury", "Achilles Rupture"] }
};
ROLES_BY_POS = {
  // Offense (lighter model — no mis-fit penalty, role shifts rating only)
  QB: ["QB-Pocket", "QB-Dual", "QB-Gunslinger", "QB-Game-Manager", "QB-Scrambler"],
  RB: ["RB-Power", "RB-Scat", "RB-Elusive", "RB-Workhorse", "RB-Speed", "FB-Lead", "FB-HBack", "FB-Hybrid"],
  WR: ["WR-Poss", "WR-Deep", "WR-Slot", "WR-Physical"],
  TE: ["TE-Receiving", "TE-Blocking", "TE-Hybrid", "TE-Move"],
  OL: ["OL-Balanced", "OL-Mauler", "OL-PassPro", "OL-Athletic"],
  K: ["K-Accuracy", "K-Power", "K-Balanced"],
  P: ["P-Directional", "P-Distance", "P-Balanced"],
  // Defense (DE/OLB/LB carry the scheme mis-fit penalty; others are stat-definers)
  DE: ["DE-Speed", "DE-Power", "DE-Base"],
  OLB: ["OLB-Rush", "OLB-Cover", "OLB-Blitz"],
  DT: ["DT-3tech", "DT-NT", "DT-Balanced", "DT-Quick"],
  LB: ["LB-Thumper", "LB-Cover", "LB-Hybrid", "LB-Blitzer", "LB-Sideline"],
  CB: ["CB-Press", "CB-Slot", "CB-Zone", "CB-Ball", "CB-Nickel"],
  S: ["S-Free", "S-Strong", "S-Ball", "S-Hybrid", "S-Nickel"]
};
ARCHETYPE_DERIVE = {
  QB(p) {
    const legLean = axisLean(p, ["SPD", "AGI"], ["STR", "TEC"]);
    const giLean = axisLean(p, ["AWR"], ["STR"]);
    const armLean = axisLean(p, ["STR"], ["TEC"]);
    if (legLean > -3) return "QB-Scrambler";
    if (legLean > -9) return "QB-Dual";
    if (giLean > 5) return "QB-Game-Manager";
    if (armLean > 5) return "QB-Gunslinger";
    return "QB-Pocket";
  },
  RB(p) {
    const workLean = axisLean(p, ["CON"], ["SPD", "AGI"]);
    const speedLean = axisLean(p, ["SPD"], ["STR", "AGI"]);
    const eluLean = axisLean(p, ["AGI"], ["STR", "SPD"]);
    const powerLean = axisLean(p, ["STR"], ["SPD", "AGI"]);
    const blockLean = axisLean(p, ["PWR", "STR"], ["SPD", "AGI"]);
    const a = p.attributes || {};
    if (blockLean > 26 && (a.SPD || 50) < 62) {
      const recvLean = axisLean(p, ["HND", "JMP"], ["STR", "PWR"]);
      if (recvLean > -19) return "FB-HBack";
      if (recvLean < -31) return "FB-Lead";
      return "FB-Hybrid";
    }
    if (workLean > 10) return "RB-Workhorse";
    if (speedLean > 8) return "RB-Speed";
    if (eluLean > 6) return "RB-Elusive";
    if (powerLean > 4) return "RB-Power";
    return "RB-Scat";
  },
  // WR — spec's own worked example (speed/physicality quadrant).
  WR(p) {
    const speedLean = axisLean(p, ["SPD", "AGI"], ["HND", "AWR"]);
    const physical = axisLean(p, ["STR", "PWR"], ["AGI", "SPD"]);
    if (speedLean > 4 && physical <= -10) return "WR-Deep";
    if (speedLean > 4 && physical > -10) return "WR-Physical";
    if (speedLean <= 4 && physical > -15) return "WR-Slot";
    return "WR-Poss";
  },
  TE(p) {
    const blockLean = axisLean(p, ["STR", "PWR"], ["HND", "SPD"]);
    const athLean = axisLean(p, ["AGI", "SPD"], ["STR", "PWR"]);
    if (blockLean < 16) return "TE-Receiving";
    if (athLean > -13) return "TE-Move";
    if (blockLean > 35) return "TE-Blocking";
    return "TE-Hybrid";
  },
  OL(p) {
    const athLean = axisLean(p, ["AGI"], ["STR"]);
    const techLean = axisLean(p, ["TEC"], ["STR"]);
    if (athLean > -17) return "OL-Athletic";
    if (athLean < -37) return "OL-Mauler";
    if (techLean > -22) return "OL-PassPro";
    return "OL-Balanced";
  },
  K(p) {
    const powerLean = axisLean(p, ["STR"], ["TEC"]);
    if (powerLean > 6) return "K-Power";
    if (powerLean < -6) return "K-Accuracy";
    return "K-Balanced";
  },
  P(p) {
    const powerLean = axisLean(p, ["STR"], ["TEC"]);
    if (powerLean > 6) return "P-Distance";
    if (powerLean < -6) return "P-Directional";
    return "P-Balanced";
  },
  DE(p) {
    const speedLean = axisLean(p, ["SPD"], ["STR"]);
    if (speedLean > 1) return "DE-Speed";
    if (speedLean < -12) return "DE-Power";
    return "DE-Base";
  },
  OLB(p) {
    const coverLean = axisLean(p, ["AWR", "SPD"], ["STR", "PWR"]);
    const rushLean = axisLean(p, ["SPD", "AGI"], ["AWR"]);
    if (coverLean > 13) return "OLB-Cover";
    if (rushLean > 5) return "OLB-Rush";
    return "OLB-Blitz";
  },
  DT(p) {
    const athLean = axisLean(p, ["AGI", "SPD"], ["STR"]);
    if (athLean > -18.5) return "DT-Quick";
    if (athLean > -29.5) return "DT-3tech";
    if (athLean > -39.5) return "DT-Balanced";
    return "DT-NT";
  },
  LB(p) {
    const coverLean = axisLean(p, ["SPD", "AGI"], ["STR", "PWR"]);
    if (coverLean < -33) return "LB-Thumper";
    if (coverLean < -21) return "LB-Hybrid";
    if (coverLean < -12) return "LB-Cover";
    const blitzLean = axisLean(p, ["SPD", "AGI"], ["PWR", "STR"]);
    return blitzLean >= 2 ? "LB-Blitzer" : "LB-Sideline";
  },
  CB(p) {
    // [RECALIBRATION Aug 2026] The July PWR/STR generation rework silently
    // drifted every CB lean: zoneLean's old bar (-23) had slid to the
    // population's p10 (80%+ of all corners derived Zone) and physLean's (+2)
    // beyond p90 (press corners effectively stopped existing — 0.2% — while
    // every front's ideal CB is Press). Thresholds re-anchored to the measured
    // percentiles, and the new nickel class carved from the quick/tackle mass.
    const zoneLean = axisLean(p, ["AWR", "TEC"], ["SPD"]);
    const ballLean = axisLean(p, ["HND"], ["STR"]);
    const physLean = axisLean(p, ["STR"], ["AGI"]);
    if (zoneLean > -2) return "CB-Zone";
    if (ballLean > 24) return "CB-Ball";
    // The nickelback (Aug 2026, realistic-fronts wave): quicker than fast
    // (AGI leans on SPD) AND a willing run-fitter (STR/PWR lean on the ball
    // skills) — the 4-2-5's fifth DB who covers the slot and holds the edge.
    const quickLean = axisLean(p, ["AGI"], ["SPD"]);
    const runWill = axisLean(p, ["STR", "PWR"], ["JMP", "HND"]);
    if (quickLean > 0 && runWill > -14) return "CB-Nickel";
    if (physLean > -23) return "CB-Press";
    return "CB-Slot";
  },
  S(p) {
    const ballLean = axisLean(p, ["HND"], ["STR"]);
    const nickelLean = axisLean(p, ["AGI"], ["STR"]);
    const freeLean = axisLean(p, ["SPD", "AGI"], ["STR", "PWR"]);
    const boxLean = axisLean(p, ["STR", "PWR"], ["SPD", "AGI"]);
    if (ballLean > 8) return "S-Ball";
    if (nickelLean > 6) return "S-Nickel";
    if (freeLean > 6) return "S-Free";
    if (boxLean > 6) return "S-Strong";
    return "S-Hybrid";
  }
};
GEN_ARCH_WEIGHTS = {
  QB: { "QB-Pocket": 46, "QB-Game-Manager": 16, "QB-Gunslinger": 20, "QB-Dual": 12, "QB-Scrambler": 6 },
  RB: {
    "RB-Speed": 19,
    "RB-Workhorse": 18,
    "RB-Power": 17,
    "RB-Elusive": 16,
    "RB-Scat": 15,
    "FB-Lead": 8,
    "FB-Hybrid": 4,
    "FB-HBack": 3
  }
};
POS_TABLE = {
  QB: "QB",
  RB: "RB",
  FB: "RB",
  WR: "WR",
  TE: "TE",
  OL: "OL",
  DE: "DE",
  DT: "DT",
  OLB: "OLB",
  LB: "LB",
  CB: "CB",
  S: "S",
  K: "K",
  P: "P"
};
jit = (x, mag) => x + (Math.random() * 2 - 1) * mag;

export { ROLES_BY_POS, advanceClassYear, createPlayer, createRecruit, createWalkOn, derivedArchetype, emptyStats, makeInjury, posAdjust, refreshRatings, roleRating };

// additional exports consumed by tools/ probes
export { compositeRating };
