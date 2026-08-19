import { C, DEF_FRONTS, FORMATIONS } from '../constants.js';

function randInt2(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function coordinatorSalary(coord, division) {
  const scale = { D1: 260, D2: 110, D3: 55 }[division] || 55;
  const avg2 = coordRatingAvg(coord);
  return Math.round(avg2 * scale / 100) * 100;
}
function coordRatingAvg(coord) {
  const keys = coord.side === "OC" ? OC_RATINGS : DC_RATINGS;
  return Math.round(keys.reduce((s, k) => s + (coord.ratings[k] || 50), 0) / keys.length);
}
// ── Unified coach-name pool (DNA TREE §8 ride-along) ───────────────────────
// ONE pool (the 75+ FIRST/LAST below) for AI head coaches AND coordinators,
// with world-scoped dedup: worldgen resets the registry, every roll registers,
// and rehydrate re-seeds it from a loaded save — so a 50-year world stops
// guaranteeing duplicate Mike Smiths. On pool pressure (40 misses) it accepts
// a duplicate rather than loop forever; with ~6,000 combos that is theoretical.
var USED_COACH_NAMES = /* @__PURE__ */ new Set();
function resetCoachNames() {
  USED_COACH_NAMES.clear();
}
function registerCoachName(name) {
  if (!name || !name.first) return;
  USED_COACH_NAMES.add(`${name.first} ${name.last || ""}`);
}
function rollCoachName() {
  for (let i = 0; i < 40; i++) {
    const nm = { first: FIRST[randInt2(0, FIRST.length - 1)], last: LAST[randInt2(0, LAST.length - 1)] };
    const key = `${nm.first} ${nm.last}`;
    if (!USED_COACH_NAMES.has(key)) {
      USED_COACH_NAMES.add(key);
      return nm;
    }
  }
  return { first: FIRST[randInt2(0, FIRST.length - 1)], last: LAST[randInt2(0, LAST.length - 1)] };
}
function generateCoordinator(side, quality = 50, division = "D3") {
  var _a, _b;
  const floor = (_b = (_a = C.STAFF_DIV_FLOOR) == null ? void 0 : _a[division]) != null ? _b : 22;
  const ratings = {};
  for (const k of side === "OC" ? OC_RATINGS : DC_RATINGS) {
    ratings[k] = clamp(Math.round(quality + randInt2(-14, 14)), floor, 95);
  }
  const schemes = side === "OC" ? Object.keys(FORMATIONS) : Object.keys(DEF_FRONTS);
  const schemeIQ = {};
  const center = clamp(34 + quality * 0.28, Math.max(30, floor * 0.62), 74);
  for (const s of schemes) schemeIQ[s] = clamp(Math.round(center + randInt2(-10, 10)), 25, 90);
  const specialty = schemes[randInt2(0, schemes.length - 1)];
  schemeIQ[specialty] = clamp(schemeIQ[specialty] + 15, 25, 92);
  const coord = {
    id: "coord_" + Math.random().toString(36).slice(2, 10),
    name: rollCoachName(),
    side,
    ratings,
    schemeIQ,
    specialty,
    seasons: 0,
    // The run clock (DNA TREE §8): rolled at generation, ticks each season in
    // growStaffSchemeIQ, travels with him on promotion.
    age: randInt2(C.COACH_AGE.COORD_MIN, C.COACH_AGE.COORD_MAX),
    // [DNA TREE §5b.1] His ROLLED sheet is the rust floor — usage grows a
    // formation above it, disuse decays back toward it, never below. The
    // sheet becomes a living record of how he's actually been used.
    baseIQ: Object.assign({}, schemeIQ),
    // [DNA TREE §5b.3] Ambition: Climber wants a head job and will leave;
    // Lifer stays if respected. Better coordinators are hungrier.
    ambition: Math.random() < clamp(C.STAFF_ID.CLIMBER_BASE + (quality - 50) * C.STAFF_ID.CLIMBER_PER_QUALITY, C.STAFF_ID.CLIMBER_MIN, C.STAFF_ID.CLIMBER_MAX) ? "Climber" : "Lifer"
  };
  coord.salary = coordinatorSalary(coord, division);
  return coord;
}
function staffFor(prestige, division) {
  var _a, _b;
  const divLift = (_b = (_a = C.STAFF_DIV_QUALITY) == null ? void 0 : _a[division]) != null ? _b : 0;
  const q = clamp(38 + (prestige || 1) * 5 + divLift + randInt2(-6, 6), 30, 90);
  return {
    oc: generateCoordinator("OC", q, division),
    dc: generateCoordinator("DC", q, division)
  };
}
function staffSalary(school) {
  var _a, _b;
  const oc = (_a = school == null ? void 0 : school.staff) == null ? void 0 : _a.oc, dc = (_b = school == null ? void 0 : school.staff) == null ? void 0 : _b.dc;
  return ((oc == null ? void 0 : oc.salary) || 0) + ((dc == null ? void 0 : dc.salary) || 0);
}
function generateCandidates(side, school, n = 5) {
  var _a, _b, _c, _d;
  const p = (school == null ? void 0 : school.prestige) || 2;
  const div = (school == null ? void 0 : school.division) || "D3";
  const divLift = (_b = (_a = C.STAFF_DIV_QUALITY) == null ? void 0 : _a[div]) != null ? _b : 0;
  const floor = (_d = (_c = C.STAFF_DIV_FLOOR) == null ? void 0 : _c[div]) != null ? _d : 22;
  const top = floor + 10 + p * 4;
  // The candidates are spread evenly from the division floor to its ceiling.
  // GUARD (2026-08-18): n === 1 made this i/(n-1) = 0/0 = NaN, which flowed
  // into generateCoordinator as the quality and produced a coach with NULL
  // ratings and NaN scheme grades. No shipped caller asks for one (the wizard
  // takes 4, the hire market 5), so nothing in the game was affected — but it
  // is a live trap for the next caller. A lone candidate sits mid-range.
  const spread = (i) => n > 1 ? i / (n - 1) : 0.5;
  return Array.from({ length: n }, (_, i) => generateCoordinator(side, clamp(floor + 4 + (top - floor - 4) * spread(i) + randInt2(-3, 3), floor + 4, 93), div));
}
function coordIqMod(school, side, schemeId) {
  var _a, _b, _c, _d;
  const coord = side === "off" ? (_a = school == null ? void 0 : school.staff) == null ? void 0 : _a.oc : (_b = school == null ? void 0 : school.staff) == null ? void 0 : _b.dc;
  const iq = (_d = (_c = coord == null ? void 0 : coord.schemeIQ) == null ? void 0 : _c[schemeId]) != null ? _d : 48;
  return C.FORMATION_IQ_BASE + C.FORMATION_IQ_SCALE * iq;
}
// ── HC formation mastery (DNA TREE §5b.2) ──────────────────────────────────
// The player coach's own per-formation sheet: rolled baseline, grows with the
// formations he actually calls, rusts on disuse — same living-record shape as
// a coordinator's. AI coaches never carry one (the player is the only one who
// coaches). Sheet spans BOTH sides: he calls offensive formations and picks
// the front.
function ensureHCMastery(coach) {
  if (!coach || coach.isAI !== false) return coach;
  if (!coach.masteryIQ) {
    const M = C.HC_MASTERY;
    const sheet = {};
    for (const s of [...Object.keys(FORMATIONS), ...Object.keys(DEF_FRONTS)]) {
      sheet[s] = randInt2(M.BASE_MIN, M.BASE_MAX);
    }
    coach.masteryIQ = sheet;
    coach.masteryBase = Object.assign({}, sheet);
  }
  if (!coach.masteryBase) coach.masteryBase = Object.assign({}, coach.masteryIQ);
  return coach;
}
function growHCMastery(coach, gameplan) {
  if (!coach || coach.isAI !== false) return;
  ensureHCMastery(coach);
  const M = C.HC_MASTERY;
  const gp = gameplan || {};
  const offUsage = gp.offFormations && gp.offFormations.length ? gp.offFormations.map((f) => ({ id: f.id, w: f.weight || 0 })) : [{ id: gp.offFormation || "Single Back", w: 100 }];
  const defUsage = [{ id: gp.defFront && gp.defFront !== "auto" ? gp.defFront : "4-3", w: 100 }];
  const applyUsage = (usage) => {
    const total = usage.reduce((s, u) => s + (u.w || 0), 0) || 1;
    const used = /* @__PURE__ */ new Set();
    for (const { id, w } of usage) {
      if (!id || !(w > 0)) continue;
      used.add(id);
      if (coach.masteryIQ[id] == null) coach.masteryIQ[id] = randInt2(M.BASE_MIN, M.BASE_MAX);
      if (coach.masteryBase[id] == null) coach.masteryBase[id] = coach.masteryIQ[id];
      const gain = Math.round(M.GROW_PER_SEASON * (w / total));
      coach.masteryIQ[id] = Math.min(M.CEILING, coach.masteryIQ[id] + Math.max(1, gain));
    }
    return used;
  };
  const usedOff = applyUsage(offUsage);
  const usedDef = applyUsage(defUsage);
  for (const id of Object.keys(coach.masteryIQ)) {
    if (usedOff.has(id) || usedDef.has(id)) continue;
    const floor = coach.masteryBase[id] != null ? coach.masteryBase[id] : coach.masteryIQ[id];
    if (coach.masteryIQ[id] > floor) {
      coach.masteryIQ[id] = Math.max(floor, coach.masteryIQ[id] - M.RUST_PER_SEASON);
    }
  }
}
function hcMasteryBonus(coach, schemeId) {
  if (!coach || coach.isAI !== false || !coach.masteryIQ) return 0;
  const iq = coach.masteryIQ[schemeId];
  return iq != null ? C.HC_MASTERY.SCALE * iq : 0;
}
// THE STACKING LAW (DNA TREE §5b.2). HC mastery combines with coordIqMod
// under a hard cap so the total formation-IQ envelope stays inside today's
// range. For an AI school (no mastery, bonus 0) this is bit-identical to
// coordIqMod — league play untouched.
function formationIqMod(school, side, schemeId) {
  const base = coordIqMod(school, side, schemeId);
  const bonus = hcMasteryBonus(school == null ? void 0 : school.coach, schemeId);
  return Math.min(C.HC_MASTERY.ENVELOPE_MAX, base + bonus);
}
function coordPackageIQ(school, gameplan) {
  var _a;
  const coord = (_a = school == null ? void 0 : school.staff) == null ? void 0 : _a.oc;
  if (!coord) return 48;
  const forms = (gameplan == null ? void 0 : gameplan.offFormations) && gameplan.offFormations.length ? gameplan.offFormations : [{ id: (gameplan == null ? void 0 : gameplan.offFormation) || "Single Back", weight: 100 }];
  const totalWeight = forms.reduce((s, f) => s + (f.weight || 0), 0) || 1;
  return forms.reduce((s, f) => {
    var _a2, _b;
    return s + ((_b = (_a2 = coord.schemeIQ) == null ? void 0 : _a2[f.id]) != null ? _b : 48) * ((f.weight || 0) / totalWeight);
  }, 0);
}
function growStaffSchemeIQ(school) {
  var _a, _b;
  const gp = (school == null ? void 0 : school.gameplan) || {};
  const grow = (coord, usage) => {
    if (!coord) return;
    // [DNA TREE §5b.1] Old-save coordinators carry no baseIQ — snapshot the
    // sheet they arrive with as their floor (a man keeps what he has; only
    // FUTURE growth can rust away). Zero-migration, byte-safe.
    if (!coord.baseIQ) coord.baseIQ = Object.assign({}, coord.schemeIQ);
    const ceiling = Math.min(90, 55 + coordRatingAvg(coord) * 0.45);
    const total = usage.reduce((s, u) => s + (u.w || 0), 0) || 1;
    const used = /* @__PURE__ */ new Set();
    for (const { id, w } of usage) {
      if (!id) continue;
      if (w > 0) used.add(id);
      // Formations added after a save was created (e.g. Jumbo, Aug 2026)
      // won't be in an old coordinator's schemeIQ — backfill at the neutral
      // default the rest of the code assumes, then let usage grow it.
      if (coord.schemeIQ[id] == null) coord.schemeIQ[id] = 48;
      if (coord.baseIQ[id] == null) coord.baseIQ[id] = coord.schemeIQ[id];
      const gain = Math.round(6 * (w / total));
      coord.schemeIQ[id] = Math.min(ceiling, coord.schemeIQ[id] + Math.max(1, gain));
    }
    // [DNA TREE §5b.1] RUST: every formation he DIDN'T call this season
    // decays toward his rolled baseline — never below it. AI usage is stable,
    // so unused-scheme decay never touches the scheme an AI actually runs
    // (coordIqMod reads only the scheme in use); expected band impact ~0.
    for (const id of Object.keys(coord.schemeIQ)) {
      if (used.has(id)) continue;
      const floor = coord.baseIQ[id] != null ? coord.baseIQ[id] : coord.schemeIQ[id];
      if (coord.schemeIQ[id] > floor) {
        coord.schemeIQ[id] = Math.max(floor, coord.schemeIQ[id] - C.STAFF_ID.RUST_PER_SEASON);
      }
    }
    coord.seasons = (coord.seasons || 0) + 1;
    // Age ticks with the same clock. Old-save coordinators (no age field) get
    // one rolled lazily, credited with the seasons they've already worked —
    // zero-migration, byte-safe, a man is never younger than his service.
    if (coord.age == null) coord.age = Math.min(C.COACH_AGE.RETIRE_FORCE - 1, randInt2(C.COACH_AGE.COORD_MIN, C.COACH_AGE.COORD_MAX) + (coord.seasons || 0));
    else coord.age = coord.age + 1;
  };
  const offUsage = gp.offFormations && gp.offFormations.length ? gp.offFormations.map((f) => ({ id: f.id, w: f.weight || 0 })) : [{ id: gp.offFormation || "Single Back", w: 100 }];
  grow((_a = school == null ? void 0 : school.staff) == null ? void 0 : _a.oc, offUsage);
  grow((_b = school == null ? void 0 : school.staff) == null ? void 0 : _b.dc, [{ id: gp.defFront && gp.defFront !== "auto" ? gp.defFront : "4-3", w: 100 }]);
}
// [DNA TREE §5b.3] THE LEDGER WRITER — the half-built scaffold goes live.
// One row per season per coordinator: { season, units: { OFF|DEF: letter } }.
// The letter is his unit's output graded against the division that year, on
// the same 13-letter scale coordStreak/coordinatorCredentials already read.
// Capped (save diet); appending is the only write, so the readers can't drift.
function writeStaffLedger(coord, season, units) {
  if (!coord || !units) return;
  if (!Array.isArray(coord.ledger)) coord.ledger = [];
  coord.ledger.push({ season, units });
  if (coord.ledger.length > C.STAFF_ID.LEDGER_CAP) coord.ledger = coord.ledger.slice(-C.STAFF_ID.LEDGER_CAP);
}
// [DNA TREE §5b.3] Ambition, lazily for old-save coordinators: rolled off his
// current quality the first time anyone asks. Zero-migration.
function ensureAmbition(coord) {
  if (!coord) return coord;
  if (!coord.ambition) {
    const q = coordRatingAvg(coord);
    coord.ambition = Math.random() < clamp(C.STAFF_ID.CLIMBER_BASE + (q - 50) * C.STAFF_ID.CLIMBER_PER_QUALITY, C.STAFF_ID.CLIMBER_MIN, C.STAFF_ID.CLIMBER_MAX) ? "Climber" : "Lifer";
  }
  return coord;
}
// [DNA TREE §5b.3] A formation sheet in star language: ★/★★/★★★/💎 bands over
// schemeIQ. Display-only — the sim keeps reading raw IQ through coordIqMod.
function schemeStarTier(iq) {
  const bands = C.STAFF_ID.STAR_IQ;
  let t = 0;
  while (t < bands.length && iq >= bands[t]) t++;
  return t;
}
function rollCoordinatorPoach(state2) {
  const school = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  if (!(school == null ? void 0 : school.staff)) return null;
  const candidates = [];
  for (const side of ["oc", "dc"]) {
    const c = school.staff[side];
    if (!c) continue;
    // [DNA TREE §5b.6 D5] A promised man is off the market — the promise IS
    // what keeps the Climber home. No poach event ever fires for him.
    if (c.promisedSuccession) continue;
    const excess = coordRatingAvg(c) - (42 + (school.prestige || 1) * 5);
    if (excess > 0) candidates.push({ side, c, excess });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.excess - a.excess);
  const pick2 = candidates[0];
  // [DNA TREE §5b.3] Ambition sets the appetite: a Climber answers the phone,
  // a Lifer mostly doesn't.
  ensureAmbition(pick2.c);
  const ambMult = pick2.c.ambition === "Climber" ? C.STAFF_ID.POACH_MULT_CLIMBER : C.STAFF_ID.POACH_MULT_LIFER;
  if (Math.random() > Math.min(0.65, Math.min(0.65, 0.15 + pick2.excess * 0.03) * ambMult)) return null;
  const bigger = state2.world.schools.filter((s) => s.id !== school.id && (s.prestige || 0) > (school.prestige || 0));
  const suitor = bigger.length ? bigger[Math.floor(Math.random() * bigger.length)] : null;
  if (!suitor) return null;
  const raise = Math.round(pick2.c.salary * (0.35 + Math.random() * 0.3) / 100) * 100;
  // [DNA TREE §5b.5 D4 + owner ruling Aug 2026] The retention answer: 10% of
  // the division's FIXED base allocation, DOUBLED for every time this man has
  // already been retained — his agent remembers. Charged to NEXT season's
  // budget via the pendingScheduleGuarantee plumbing.
  const asks = pick2.c.retentionCount || 0;
  const retentionCost = Math.round(((C.ECON.BASE[school.division] || C.ECON.BASE.D3) * C.STAFF_ID.RETENTION_PCT * Math.pow(C.STAFF_ID.RETENTION_ESCALATION, asks)) / 100) * 100;
  return {
    side: pick2.side.toUpperCase(),
    coordId: pick2.c.id,
    coordName: `${pick2.c.name.first} ${pick2.c.name.last}`,
    suitorName: suitor.name,
    raise,
    retentionCost,
    priorRetentions: asks
  };
}
var FIRST, LAST, OC_RATINGS, DC_RATINGS;

FIRST = [
  "Jim",
  "Mike",
  "Dan",
  "Bill",
  "Greg",
  "Marcus",
  "Tony",
  "Rex",
  "Vic",
  "Wade",
  "Gus",
  "Chip",
  "Mel",
  "Brent",
  "Todd",
  "Jerry",
  "Doug",
  "Ron",
  "Carl",
  "Wes",
  "Neil",
  "Trent",
  "Devin",
  "Grady",
  "Reggie",
  "Bruce",
  "Hank",
  "Dennis",
  "Roger",
  "Keith",
  "Glenn",
  "Marv",
  "Stan",
  "Lonnie",
  "Darnell",
  "Terrance",
  "Andre",
  "Jamal",
  "Curtis",
  "Ivan",
  "Roosevelt",
  "Deion",
  "Malik",
  "Xavier",
  "Damon",
  "Cedric",
  "Otis",
  "Lamar",
  "Percy",
  "Trevor",
  "Blake",
  "Colby",
  "Shane",
  "Garrett",
  "Beau",
  "Clint",
  "Dustin",
  "Brody",
  "Kai",
  "Nolan",
  "Emmett",
  "Silas",
  "Roman",
  "Angelo",
  "Dominic",
  "Enzo",
  "Rafael",
  "Hector",
  "Julius",
  "Bennett",
  "Grant",
  "Warren",
  "Hollis",
  "Ellis",
  "Ford",
  "Sterling",
  "Quincy",
  "Rashad",
  "Terrell",
  "Vince"
];
LAST = [
  "Sullivan",
  "Keller",
  "Banks",
  "Holt",
  "Merritt",
  "Prescott",
  "Ashford",
  "Whitaker",
  "Coleman",
  "Hargrove",
  "Sutton",
  "Ramsey",
  "Delgado",
  "Ferris",
  "Wagner",
  "Nolan",
  "Boone",
  "Escobar",
  "Vaughn",
  "Tanner",
  "Malone",
  "Redding",
  "Sabatini",
  "Okafor",
  "Larkin",
  "Prewett",
  "Cardwell",
  "Byrne",
  "Fowler",
  "Grimes",
  "Hollingsworth",
  "Underwood",
  "Pennington",
  "Chandler",
  "Fairbanks",
  "Draper",
  "Estrada",
  "Mccray",
  "Alvarado",
  "Lockhart",
  "Kimball",
  "Renner",
  "Sturges",
  "Dawkins",
  "Fitzgerald",
  "Cornwell",
  "Abernathy",
  "Kowalski",
  "Bergstrom",
  "Nakamura",
  "Delacroix",
  "Ibarra",
  "Muhammad",
  "Adeyemi",
  "Toussaint",
  "Whitlock",
  "Ransom",
  "Vandenberg",
  "Yates",
  "Copeland",
  "Marsh",
  "Ledbetter",
  "Hutchins",
  "Osborne",
  "Fontenot",
  "Rossi",
  "Salazar",
  "Brennan",
  "Callahan",
  "Devine",
  "Waverly",
  "Ashby",
  "Culpepper",
  "Radke",
  "Beaumont",
  "Stapleton"
];
OC_RATINGS = ["qbRunDesign", "passGame", "runGame"];
DC_RATINGS = ["blitzDesign", "coverage", "runFits"];

// ── Scheme identity (derived, never stored contradictorily) ────────────────
// The lean a coordinator would coach toward, read straight off the ratings he
// generated with — so an "Air Raid" OC really is a passing-game mind. Balanced
// / Multiple is the honest label when nothing leads by enough. Pure function of
// ratings; no character facets, no Buy-In.
function deriveSchemeIdentity(side, ratings = {}) {
  if (side === "OC") {
    const pass = ratings.passGame != null ? ratings.passGame : 50;
    const run = ratings.runGame != null ? ratings.runGame : 50;
    const opt = ratings.qbRunDesign != null ? ratings.qbRunDesign : 50;
    if (opt >= pass + 6 && opt >= run + 6) return "Option Guru";
    if (pass >= run + 8) return "Air Raid";
    if (run >= pass + 8) return "Ground and Pound";
    return "Balanced";
  }
  const blitz = ratings.blitzDesign != null ? ratings.blitzDesign : 50;
  const cov = ratings.coverage != null ? ratings.coverage : 50;
  const fits = ratings.runFits != null ? ratings.runFits : 50;
  if (blitz >= cov + 8 && blitz >= fits + 8) return "Attacking";
  if (cov >= blitz + 8 && cov >= fits + 8) return "Coverage Shell";
  if (fits >= blitz + 8 && fits >= cov + 8) return "Downhill";
  return "Multiple";
}
// Lazy profile default. This build carries only the scheme identity (derived
// from ratings) — NOT the Buy-In character facets, which do not exist here.
function ensureStaffProfile(coord) {
  if (!coord) return coord;
  if (!coord.identity) coord.identity = deriveSchemeIdentity(coord.side, coord.ratings);
  return coord;
}
// His résumé streak, computed rather than stored so it can never drift. Reads
// coord.ledger (per-season unit grades) if present; on this baseline coords
// carry no ledger yet, so it reads 0 — harmless.
function coordStreak(coord, minLetter = "B+") {
  var _a;
  const order = ["F", "D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+"];
  const bar = order.indexOf(minLetter);
  if (bar < 0 || !((_a = coord == null ? void 0 : coord.ledger) == null ? void 0 : _a.length)) return 0;
  let streak = 0;
  for (let i = coord.ledger.length - 1; i >= 0; i--) {
    const letters = Object.values(coord.ledger[i].units || {});
    if (!letters.length) break;
    const avg2 = letters.reduce((s, l) => s + Math.max(0, order.indexOf(l)), 0) / letters.length;
    if (avg2 >= bar) streak++;
    else break;
  }
  return streak;
}
// ── Credentials (§12 T3 / §16.6.7) ───────────────────────────────────────
// A promoted coordinator's service record converts to STARTING MILESTONE LEVELS.
// Two ingredients the baseline HAS: years of service (coord.seasons) and current
// rating quality (coordRatingAvg). The third — a season-by-season unit-grade
// ledger — does not exist in this build, so the record term reads 0 and a
// promoted man is credentialed by tenure and quality alone. Defined once here so
// the tree and the staff page can never disagree.
function coordinatorCredentials(coord) {
  if (!coord) return null;
  const order = ["F", "D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+"];
  const rows = coord.ledger || [];
  const all = rows.flatMap((r) => Object.values(r.units || {}));
  const avgIdx = all.length ? all.reduce((s, l) => s + Math.max(0, order.indexOf(l)), 0) / all.length : null;
  const seasons = coord.seasons || 0;
  const quality = coordRatingAvg(coord);
  const service = Math.min(6, Math.floor(seasons / 2));
  const record = avgIdx == null ? 0 : Math.max(0, Math.round((avgIdx - order.indexOf("C")) / 2));
  return {
    seasons,
    quality,
    identity: coord.identity || null,
    avgUnitGrade: avgIdx == null ? null : order[Math.round(avgIdx)],
    startingLevels: {
      [coord.side === "OC" ? "developer" : "reputation"]: service + record,
      adjustments: Math.max(0, Math.round((quality - 50) / 12))
    },
    streakBPlus: coordStreak(coord, "B+")
  };
}

// [DNA TREE §5b.6 D5] THE SUCCESSION PROMISE — money only, and it costs.
// Made to a Climber on the player's staff: he stays (off the poach market),
// mentors toward the seat, and stands at the center of the retirement
// ceremony. Priced above a retention because it is a seat, not a raise;
// charged to NEXT season's budget through the same pending plumbing.
function makeSuccessionPromise(state2, side) {
  const school = state2.world.schools.find((s) => s.id === state2.playerSchoolId);
  const coach = state2.playerCoach;
  const coord = school && school.staff ? school.staff[String(side).toLowerCase()] : null;
  if (!coord || !coach) return { ok: false, reason: "No coordinator in that seat." };
  if (coord.promisedSuccession) return { ok: false, reason: "He already holds your word." };
  ensureAmbition(coord);
  if (coord.ambition !== "Climber") return { ok: false, reason: "A Lifer doesn't need the seat — he needs respect. The promise is for Climbers." };
  const cost = Math.round(((C.ECON.BASE[school.division] || C.ECON.BASE.D3) * C.STAFF_ID.PROMISE_PCT) / 100) * 100;
  coord.promisedSuccession = { season: state2.season, coachId: coach.id || "player" };
  coach.pendingRetentionCost = (coach.pendingRetentionCost || 0) + cost;
  return { ok: true, cost, coordName: `${coord.name.first} ${coord.name.last}` };
}

export { coordIqMod, coordPackageIQ, coordRatingAvg, coordStreak, coordinatorCredentials, deriveSchemeIdentity, ensureAmbition, ensureHCMastery, ensureStaffProfile, formationIqMod, generateCandidates, generateCoordinator, growHCMastery, growStaffSchemeIQ, hcMasteryBonus, makeSuccessionPromise, registerCoachName, resetCoachNames, rollCoachName, rollCoordinatorPoach, schemeStarTier, staffFor, staffSalary, writeStaffLedger };
