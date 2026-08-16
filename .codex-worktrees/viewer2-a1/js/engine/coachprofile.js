import { __spreadProps, __spreadValues } from '../_spread.js';
import { C } from '../constants.js';
import { SKILL_GRADE_XP } from './coach.js';

function listCoaches() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch (e) {
    return [];
  }
}
function persist(coaches) {
  try {
    localStorage.setItem(KEY, JSON.stringify(coaches));
  } catch (e) {
  }
}
function createCoach(first, last, opts = {}) {
  const coaches = listCoaches();
  // A tree-owned profile does NOT count against the legacy MAX_COACHES cap (a
  // tree's branches are the tree's, not four more careers) and never appears in
  // the coach list — see listSoloCoaches.
  if (!opts.treeId && listSoloCoaches().length >= MAX_COACHES) return null;
  const coach = {
    id: "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    name: { first: (first || "Coach").slice(0, 16), last: (last || "").slice(0, 16) },
    created: Date.now(),
    worlds: {},
    // slot(1-4) → { school, season, record, timestamp }
    plans: { gameplans: [], practice: [] },
    teams: []
    // optional Play Now snapshots; absent on legacy profiles
  };
  if (opts.treeId) coach.treeId = opts.treeId;
  if (opts.mentorId) coach.mentorId = opts.mentorId;
  if (opts.dna) coach.dna = { axes: __spreadValues({}, opts.dna.axes || {}), badges: [], log: [] };
  coaches.push(coach);
  persist(coaches);
  return coach;
}
// [W9 §12] Profiles that belong to a TREE are reached through the tree, not the
// coach list — otherwise growing a branch would silently eat a legacy coach
// slot and the menu would show the same man twice.
function listSoloCoaches() {
  return listCoaches().filter((c) => !c.treeId);
}
function getCoach(id) {
  return listCoaches().find((c) => c.id === id) || null;
}
function updateCoach(id, fn) {
  const coaches = listCoaches();
  const c = coaches.find((x) => x.id === id);
  if (!c) return null;
  fn(c);
  persist(coaches);
  return c;
}
function deleteCoach(id) {
  persist(listCoaches().filter((c) => c.id !== id));
}
function worldSlotKey(coachId, slot) {
  return `${coachId}w${slot}`;
}
function noteWorldMeta(coachId, slot, meta) {
  updateCoach(coachId, (c) => {
    c.worlds[slot] = __spreadProps(__spreadValues({}, meta), { timestamp: Date.now() });
  });
}
function removeWorldClassicMeta(coachId, slot, classicId) {
  updateCoach(coachId, (c) => {
    var _a;
    const world = (_a = c.worlds) == null ? void 0 : _a[slot];
    if (!world) return;
    world.classics = (world.classics || []).filter((item) => item.id !== classicId);
  });
}
function clearWorldSlot(coachId, slot) {
  updateCoach(coachId, (c) => {
    delete c.worlds[slot];
  });
}

// ── W9 §12 — THE TREE STORE ─────────────────────────────────────────────────
// The inversion, at the storage layer. Pre-W9: coach → up to 4 worlds. A tree:
// tree → ONE world → up to 3 coaches (one per division, T2). A second index in
// the same localStorage meta-layer; nothing above reads or writes the other's
// key. What lives HERE is only what the main menu needs to draw a tree without
// opening its world: name, slot roster, banked DNA, division memory, ledger.
function listTrees() {
  try {
    return JSON.parse(localStorage.getItem(TREE_KEY) || "[]");
  } catch (e) {
    return [];
  }
}
function persistTrees(trees) {
  try {
    localStorage.setItem(TREE_KEY, JSON.stringify(trees));
  } catch (e) {
  }
}
function getTree(id) {
  return listTrees().find((t) => t.id === id) || null;
}
function updateTree(id, fn) {
  const trees = listTrees();
  const t = trees.find((x) => x.id === id);
  if (!t) return null;
  fn(t);
  persistTrees(trees);
  return t;
}
function createTree(name) {
  const trees = listTrees();
  if (trees.length >= MAX_TREES) return null;
  const tree = {
    id: "t" + Date.now().toString(36),
    name: (name || "The Tree").slice(0, 28),
    created: Date.now(),
    // slots are keyed by DIVISION because a slot IS a division (T2).
    slots: {},
    // 'D1'|'D2'|'D3' → { coachId, schoolName, seatedSeason }
    dna: { axes: {} },
    // the HARVEST — only retirement writes here
    memory: {},
    // division → seasons of tree service ("I know this league")
    ledger: [],
    // retired coaches, newest last
    meta: null
    // { season, day, week } — the world's clock, for the menu card
  };
  trees.push(tree);
  persistTrees(trees);
  return tree;
}
function deleteTree(id) {
  persistTrees(listTrees().filter((t) => t.id !== id));
}
// The ONE world behind a tree. Deliberately NOT `c{coachId}w{slot}` shaped — a
// tree's world belongs to the tree, and its coaches come and go above it.
function treeWorldKey(treeId) {
  return `${treeId}w`;
}
// Menu-facing snapshot, written by the same autosave path that writes
// noteWorldMeta for a legacy world.
function noteTreeMeta(treeId, meta) {
  updateTree(treeId, (t) => {
    t.meta = __spreadProps(__spreadValues({}, meta), { timestamp: Date.now() });
  });
}
function saveGameplanToLibrary(coachId, name, gameplan) {
  let saved = false;
  updateCoach(coachId, (c) => {
    const lib = c.plans.gameplans;
    const existing = lib.findIndex((p) => p.name === name);
    const entry = { name: name.slice(0, 24), gp: JSON.parse(JSON.stringify(gameplan)), saved: Date.now() };
    if (existing >= 0) {
      lib[existing] = entry;
      saved = true;
    } else if (lib.length < MAX_GAMEPLANS) {
      lib.push(entry);
      saved = true;
    }
  });
  return saved;
}
function listSavedTeams() {
  var _a, _b;
  const out = [];
  for (const coach of listCoaches()) {
    for (const team of coach.teams || []) {
      out.push(__spreadProps(__spreadValues({}, team), { coachId: coach.id, coachName: `${((_a = coach.name) == null ? void 0 : _a.first) || "Coach"} ${((_b = coach.name) == null ? void 0 : _b.last) || ""}`.trim() }));
    }
  }
  return out.sort((a, b) => (b.saved || 0) - (a.saved || 0));
}
function saveTeamToLibrary(coachId, name, school, meta = {}) {
  var _a;
  if (!coachId || !((_a = school == null ? void 0 : school.roster) == null ? void 0 : _a.length) || !school.gameplan) return false;
  let saved = false;
  updateCoach(coachId, (coach) => {
    coach.teams = coach.teams || [];
    const cleanSchool = {};
    for (const key of SAVED_TEAM_FIELDS) {
      if (school[key] !== void 0) cleanSchool[key] = cloneJson(school[key]);
    }
    const cleanName = (name || school.name || "Saved Team").trim().slice(0, 36);
    const existing = coach.teams.findIndex((t) => t.name === cleanName);
    const entry = {
      id: existing >= 0 ? coach.teams[existing].id : `team-${Date.now().toString(36)}`,
      name: cleanName,
      saved: Date.now(),
      season: meta.season || null,
      record: meta.record ? cloneJson(meta.record) : cloneJson(school.record || { wins: 0, losses: 0 }),
      school: cleanSchool
    };
    if (existing >= 0) {
      coach.teams[existing] = entry;
      saved = true;
    } else if (coach.teams.length < MAX_SAVED_TEAMS) {
      coach.teams.push(entry);
      saved = true;
    }
  });
  return saved;
}
function deleteSavedTeam(coachId, teamId) {
  updateCoach(coachId, (coach) => {
    coach.teams = coach.teams || [];
    const i = coach.teams.findIndex((t) => t.id === teamId);
    if (i >= 0) coach.teams.splice(i, 1);
  });
}
function remapSnapshotIds(value, idMap) {
  if (typeof value === "string") return idMap.get(value) || value;
  if (Array.isArray(value)) return value.map((v) => remapSnapshotIds(v, idMap));
  if (!value || typeof value !== "object") return value;
  for (const key of Object.keys(value)) value[key] = remapSnapshotIds(value[key], idMap);
  return value;
}
function instantiateSavedTeam(entry, side = "home") {
  if (!(entry == null ? void 0 : entry.school)) return null;
  const school = cloneJson(entry.school);
  const suffix = `${side}-${Date.now().toString(36)}-${(++exhibitionCloneNonce).toString(36)}`;
  const idMap = /* @__PURE__ */ new Map();
  idMap.set(school.id, `exh-school-${suffix}`);
  for (const player of school.roster || []) idMap.set(player.id, `exh-player-${suffix}-${player.id}`);
  remapSnapshotIds(school, idMap);
  school.record = { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
  return school;
}
function deleteLibraryPlan(coachId, kind, name) {
  updateCoach(coachId, (c) => {
    const lib = kind === "practice" ? c.plans.practice : c.plans.gameplans;
    const i = lib.findIndex((p) => p.name === name);
    if (i >= 0) lib.splice(i, 1);
  });
}
// ── The star ladder (DNA TREE §4, ratified) ────────────────────────────────
// The 0–10 grade ladder is recut to four chunky tiers: ★ / ★★ / ★★★ / 💎.
// Owner's mapping: ★★★ ≈ the old grade 9, 💎 = the old grade-10 (max) bonus —
// the effect CEILING is unchanged, the ladder underneath is chunky so every
// tier is an event. Thresholds (D9, probe-verified): the old curve put G9 at
// 1676 and G10 at 2005; the stars land at 1650 and 2000 with two waypoints.
//
// dnaGrade() deliberately returns the EFFECTIVE grade in the OLD 0–10 units
// ({0, 3, 6, 9, 10} for none/★/★★/★★★/💎), because the sim consumes
// `_dnaGrades` numbers raw (grade × per-coefficient) in a dozen places — the
// units are the contract, and this keeps every effect and its ceiling exact
// without touching a single sim read. Display converts tier → stars.
var DNA_STAR_XP = [200, 700, 1650, 2000];
var DNA_STAR_EFF = [0, 3, 6, 9, 10];
var DNA_STAR_GLYPH = ["", "\u2605", "\u2605\u2605", "\u2605\u2605\u2605", "\u{1F48E}"];
function dnaStarTier(xp) {
  let t = 0;
  while (t < DNA_STAR_XP.length && xp >= DNA_STAR_XP[t]) t++;
  return t;
}
function dnaStarLabel(tier) {
  return DNA_STAR_GLYPH[Math.max(0, Math.min(4, tier))] || "";
}
function dnaGrade(xp) {
  return DNA_STAR_EFF[dnaStarTier(xp)];
}
// ── DNA axis migration ─────────────────────────────────────────────────────
// Retired axes keep their earned XP by folding into an heir. Runs lazily on any
// DNA read or write, so an existing career picks it up the first time the game
// touches the profile — no coach ever loses a grade he earned. Two merges:
//   culture → (nothing) — its heir `motivator` was cut 2026-08-12 (playtest
//                          item 31). Old culture XP is simply unread now, the
//                          same treatment developer/recruiter got.
//   roadWarrior → discipline  (only lands if a save ever carries a retired
//                              roadWarrior axis; the live axis stays put here)
// The roadWarrior line is defensive for donor-shaped saves; this baseline's
// roadWarrior is a live axis and is NOT retired in this build.
var DNA_RETIRED = {};
function migrateDna(dna) {
  if (!dna) return dna;
  if (!dna.axes) dna.axes = {};
  for (const dead of Object.keys(DNA_RETIRED)) {
    const heir = DNA_RETIRED[dead];
    if (dna.axes[dead] == null) continue;
    dna.axes[heir] = (dna.axes[heir] || 0) + dna.axes[dead];
    delete dna.axes[dead];
    dna._merged = [...dna._merged || [], dead];
  }
  if (!Array.isArray(dna.badges)) dna.badges = [];
  if (!Array.isArray(dna.log)) dna.log = [];
  return dna;
}
function coachDNA(coachId) {
  const c = getCoach(coachId);
  if (!c) return null;
  if (!c.plans) c.plans = { gameplans: [], practice: [] };
  if (c.dna && c.dna.axes && Object.keys(DNA_RETIRED).some((k) => c.dna.axes[k] != null)) {
    updateCoach(coachId, (cc) => migrateDna(cc.dna));
    return migrateDna(getCoach(coachId) == null ? void 0 : getCoach(coachId).dna) || { axes: {}, badges: [], log: [] };
  }
  return c.dna || { axes: {}, badges: [] };
}
// What a retirement banks into the tree (§16.6.7 / W9 T5). Exported so the math
// has exactly one definition.
function dnaBankable(coachId) {
  const dna = coachDNA(coachId);
  if (!dna) return null;
  const axes = {};
  for (const k of Object.keys(DNA_AXES)) axes[k] = (dna.axes && dna.axes[k]) || 0;
  return { axes, badges: (dna.badges || []).length, titles: dnaTitle(dna) };
}
// ── W9 §12 T5 — THE HARVEST ────────────────────────────────────────────────
// Retiring commits the coach's DNA to the tree permanently. Idempotent per
// coach: the tree records who it has harvested, so a double-fired retirement
// can never bank the same career twice.
function bankIntoTree(tree, coachId, opts = {}) {
  const seasons = opts.seasons || 0;
  const share = opts.share != null ? opts.share : 1;
  if (!tree || !coachId) return null;
  if (!tree.dna) tree.dna = { axes: {} };
  if (!Array.isArray(tree.ledger)) tree.ledger = [];
  if (tree.ledger.some((r) => r.coachId === coachId)) return tree.dna;
  const bank = dnaBankable(coachId);
  const coach = getCoach(coachId);
  if (bank) {
    for (const [axis, xp] of Object.entries(bank.axes)) {
      if (!DNA_AXES[axis]) continue;
      tree.dna.axes[axis] = (tree.dna.axes[axis] || 0) + Math.round(xp * share);
    }
  }
  tree.ledger.push({
    coachId,
    name: coach ? `${(coach.name && coach.name.first) || "Coach"} ${(coach.name && coach.name.last) || ""}`.trim() : "Coach",
    title: (bank && bank.titles) || "Building an Identity",
    seasons,
    badges: (bank && bank.badges) || 0,
    retiredAt: Date.now()
  });
  return tree.dna;
}
// ── THE LIVE TRICKLE ───────────────────────────────────────────────────────
// Each season, deposit a SMALL share of the NEW DNA growth a working coach
// added to his own profile that year into the tree's shared pool. Strictly
// one-way and read-only against the coach: it never writes to coach.dna, so an
// active coach's sim is untouched — the pool exists only to seed future
// promoted coordinators (dnaInheritance). `prev` is the per-axis snapshot of
// what this coach had already contributed; only growth beyond it is trickled,
// so a re-fired season tick can't double-deposit. Returns the fresh snapshot to
// store back on the slot. Retirement's full-career harvest is separate and adds
// on top of whatever trickled here.
function trickleIntoTree(tree, coachId, opts = {}) {
  const share = opts.share != null ? opts.share : 0;
  const prev = opts.prev || {};
  if (!tree || !coachId || share <= 0) return { snapshot: { ...prev }, deposited: {} };
  if (!tree.dna) tree.dna = { axes: {} };
  const dna = coachDNA(coachId);
  const snapshot = {};
  const deposited = {};
  for (const k of Object.keys(DNA_AXES)) {
    const total = (dna && dna.axes && dna.axes[k]) || 0;
    snapshot[k] = total;
    const grew = total - (prev[k] || 0);
    if (grew > 0) {
      const add = Math.round(grew * share);
      if (add > 0) {
        tree.dna.axes[k] = (tree.dna.axes[k] || 0) + add;
        deposited[k] = add;
      }
    }
  }
  return { snapshot, deposited };
}
// ── THE PROTÉGÉ EFFECT ─────────────────────────────────────────────────────
// A tree coach starts with a share of what the tree has BANKED, weighted by how
// long he served under it. Two caps: SHARE (a head start, never a career) and
// GRADE (INHERIT_CAP_GRADE — no protégé opens graded above a man who earned it).
function dnaInheritance(tree, opts = {}) {
  const seasonsUnderTree = opts.seasonsUnderTree || 0;
  const t = C.TREE;
  const banked = (tree && tree.dna && tree.dna.axes) || {};
  const share = Math.min(t.INHERIT_MAX, t.INHERIT_SHARE + seasonsUnderTree * t.INHERIT_PER_SEASON);
  // [DNA TREE §4] A protégé inherits chosen axes at up to ★★, NEVER ★★★/💎 —
  // those he earns himself. The cap is the ★★ threshold exactly: he can OPEN
  // at ★★, with zero progress into the band beyond it.
  const capXp = DNA_STAR_XP[(t.INHERIT_CAP_STAR || 2) - 1];
  // [DNA TREE §7.5] The succession pick: the ceremony lets the retiring coach
  // CHOOSE which banked axes the next man inherits. No pick list = all axes
  // (the pre-ceremony promotion path, unchanged).
  const pick = Array.isArray(opts.pickAxes) && opts.pickAxes.length ? new Set(opts.pickAxes) : null;
  const axes = {};
  for (const k of Object.keys(DNA_AXES)) {
    if (pick && !pick.has(k)) continue;
    const xp = Math.round((banked[k] || 0) * share);
    if (xp > 0) axes[k] = Math.min(xp, capXp);
  }
  return { axes, share: +share.toFixed(3), capStar: t.INHERIT_CAP_STAR || 2 };
}
// T4 — DIVISION MEMORY. One point per season worked; MEMORY_FULL seasons reads
// a full 1.0. Read by career.js, which turns it into the head start a new tree
// coach actually feels (scouting fidelity + local recruiting relationships).
function noteDivisionMemory(tree, division, seasons = 1) {
  if (!tree || !division) return;
  if (!tree.memory) tree.memory = {};
  tree.memory[division] = (tree.memory[division] || 0) + seasons;
}
function divisionMemory(tree, division) {
  const seasons = (tree && tree.memory && tree.memory[division]) || 0;
  return Math.max(0, Math.min(1, seasons / C.TREE.MEMORY_FULL));
}
// ── The D3 un-fold (DNA TREE §4) ───────────────────────────────────────────
// Earned DNA XP in the two axes that returned to the skills system folds back
// into SKILL XP by a floor mapping — a man keeps what he earned. (The retired
// `culture` axis had the same law until its heir `motivator` was cut in the
// 2026-08-12 playtest pass; culture XP is now simply unread.) The mapping runs
// through the OLD 0–10 DNA
// curve (the curve the XP was earned on), then floors onto the 13-step skill
// ladder with maxes matched (old G10 ↔ skill index 12). Idempotent by
// construction (floor, never add), so it runs safely on every load and every
// career start. Writes the IN-WORLD coach's skills; reads the profile store
// read-only; null-guards everything — profile store off, no dna, old saves.
function unfoldDnaToSkills(coachId, coach) {
  if (!coachId || !coach || !coach.skills) return;
  let dna = null;
  try {
    const c = getCoach(coachId);
    dna = c && c.dna || null;
  } catch (e) {
    return;
  }
  if (!dna || !dna.axes) return;
  for (const axis of ["recruiter", "developer"]) {
    const xp = dna.axes[axis] || 0;
    if (!xp) continue;
    let og = 0;
    while (og < 10 && xp >= Math.round(40 * Math.pow(og + 1, 1.7))) og++;
    const idx = Math.min(12, Math.floor(og * 1.2));
    if (idx <= 0) continue;
    const floorXp = SKILL_GRADE_XP[idx];
    if (!coach.skills[axis]) coach.skills[axis] = { xp: 0 };
    if ((coach.skills[axis].xp || 0) < floorXp) coach.skills[axis].xp = floorXp;
  }
}
function addDnaXP(coachId, entries, badges = []) {
  const ups = [];
  updateCoach(coachId, (c) => {
    if (!c.dna) c.dna = { axes: {}, badges: [] };
    migrateDna(c.dna);
    for (const [axis, xp] of Object.entries(entries)) {
      if (!DNA_AXES[axis] || !xp) continue;
      const before = dnaGrade(c.dna.axes[axis] || 0);
      c.dna.axes[axis] = (c.dna.axes[axis] || 0) + xp;
      const after = dnaGrade(c.dna.axes[axis]);
      if (after > before) ups.push({ axis, grade: after });
    }
    for (const b of badges) {
      c.dna.badges.push(b);
      if (c.dna.badges.length > 200) c.dna.badges = c.dna.badges.slice(-200);
    }
  });
  return ups;
}
function dnaTitle(dna) {
  if (!dna) return "Building an Identity";
  // Filter to LIVE axes so a pre-migration profile (a stray retired `culture`)
  // can never produce an "undefined Coach" title.
  const graded = Object.entries(dna.axes || {}).filter(([k]) => DNA_AXES[k]).map(([k, xp]) => [k, dnaGrade(xp)]).filter(([, g]) => g >= 3).sort((a, b) => b[1] - a[1]);
  if (!graded.length) return "Building an Identity";
  const NAMES = {
    groundPound: "Ground & Pound",
    airAttack: "Air Raid",
    pressure: "Pressure-First",
    ballHawk: "Ball-Hawking",
    ballSecurity: "Mistake-Free",
    discipline: "Disciplined",
    adjustments: "Second-Half",
    riverboat: "Riverboat",
    roadWarrior: "Road-Tested",
    specialTeams: "Special-Teams-Minded"
  };
  if (graded.length === 1 || graded[0][1] - graded[1][1] >= 3) return `${NAMES[graded[0][0]]} Coach`;
  return `${NAMES[graded[1][0]]} ${NAMES[graded[0][0]]} Coach`;
}
function dnaGrades(coachId) {
  var _a;
  const dna = coachDNA(coachId);
  if (!dna) return {};
  const out = {};
  for (const k of Object.keys(DNA_AXES)) out[k] = dnaGrade(((_a = dna.axes) == null ? void 0 : _a[k]) || 0);
  return out;
}
function dnaXpForNextGrade(g) {
  // Takes an EFFECTIVE grade (0/3/6/9/10) and returns the next star threshold.
  // At 💎 it returns the top threshold so progress bars stay sane at max.
  const tier = DNA_STAR_EFF.indexOf(g);
  const t = tier < 0 ? dnaStarTier(g) : tier;
  return DNA_STAR_XP[Math.min(t, DNA_STAR_XP.length - 1)];
}
function dnaBonus(axis, grade) {
  const g = grade || 0;
  const b = DNA_BONUS[axis];
  if (!b) return { mult: 0, grade: g, label: "" };
  return { mult: b.per * g, grade: g, label: b.label(g) };
}
function noteRecord(coach, section, key, value, ctx2) {
  if (!coach || value == null) return false;
  if (!coach.records) coach.records = {};
  if (!coach.records[section]) coach.records[section] = {};
  const cur = coach.records[section][key];
  if (!cur || value > cur.v) {
    coach.records[section][key] = { v: value, ctx: ctx2 || {} };
    return true;
  }
  return false;
}
function noteCoachRecords(coachId, payload) {
  if (!coachId || !payload) return;
  updateCoach(coachId, (c) => {
    if (!c.records) c.records = {};
    if (payload.careerAdd) {
      c.records.career = c.records.career || {};
      for (const [k, v] of Object.entries(payload.careerAdd)) {
        c.records.career[k] = (c.records.career[k] || 0) + (v || 0);
      }
    }
    if (payload.game) {
      for (const [k, rec] of Object.entries(payload.game)) {
        noteRecord(c, "game", k, rec.v, rec.ctx);
      }
    }
    if (payload.season) {
      c.records.season = c.records.season || {};
      for (const [k, rec] of Object.entries(payload.season)) {
        if (k === "bestRank") {
          const cur = c.records.season.bestRank;
          if (!cur || rec.v < cur.v) c.records.season.bestRank = { v: rec.v, ctx: rec.ctx };
        } else if (k === "bestRecord") {
          const cur = c.records.season.bestRecord;
          if (!cur || (rec.pct || 0) > (cur.pct || 0)) c.records.season.bestRecord = rec;
        } else {
          noteRecord(c, "season", k, rec.v, rec.ctx);
        }
      }
    }
    if (payload.seasonIndiv) {
      c.records.seasonIndiv = c.records.seasonIndiv || {};
      for (const [k, rec] of Object.entries(payload.seasonIndiv)) {
        const cur = c.records.seasonIndiv[k];
        if (!cur || rec.v > cur.v) c.records.seasonIndiv[k] = rec;
      }
    }
    if (payload.seasonTeam) {
      c.records.seasonTeam = c.records.seasonTeam || {};
      for (const [k, rec] of Object.entries(payload.seasonTeam)) {
        const cur = c.records.seasonTeam[k];
        if (!cur || rec.v > cur.v) c.records.seasonTeam[k] = rec;
      }
    }
  });
}
function coachRecords(coachId) {
  const c = getCoach(coachId);
  return c && c.records || {};
}
var KEY, TREE_KEY, MAX_COACHES, MAX_WORLDS, MAX_GAMEPLANS, MAX_SAVED_TEAMS, MAX_TREES, SAVED_TEAM_FIELDS, cloneJson, exhibitionCloneNonce, DNA_AXES, DNA_BONUS;

KEY = "cfb-coaches-v1";
TREE_KEY = "cfb-trees-v1";
MAX_COACHES = 4;
MAX_WORLDS = 4;
MAX_GAMEPLANS = 10;
MAX_SAVED_TEAMS = 8;
MAX_TREES = 2;
SAVED_TEAM_FIELDS = [
  "id",
  "name",
  "nick",
  "abbr",
  "logo",
  "facilities",
  "staff",
  "conf",
  "division",
  "lat",
  "lng",
  "city",
  "state",
  "type",
  "control",
  "enrollment",
  "founded",
  "stadium",
  "prestige",
  "baseline",
  "prestigeMin",
  "prestigeMax",
  "colors",
  "crestImg",
  "crestSeed",
  "roster",
  "record",
  "coach",
  "gameplan",
  "weeklyPlan",
  "practiceMinutes",
  "depthChart",
  "depthOrder",
  "_dnaGrades"
];
cloneJson = (value) => JSON.parse(JSON.stringify(value));
exhibitionCloneNonce = 0;
DNA_AXES = {
  groundPound: { label: "Ground & Pound", icon: "\u{1F69C}" },
  airAttack: { label: "Air Attack", icon: "\u2708\uFE0F" },
  pressure: { label: "Pressure", icon: "\u26A1" },
  ballHawk: { label: "Ball Hawk", icon: "\u{1F985}" },
  ballSecurity: { label: "Ball Security", icon: "\u{1F512}" },
  discipline: { label: "Discipline", icon: "\u{1F4CF}" },
  riverboat: { label: "Riverboat", icon: "\u{1F3B2}" },
  roadWarrior: { label: "Road Warrior", icon: "\u{1F6E3}\uFE0F" },
  specialTeams: { label: "Special Teams", icon: "\u{1F9B5}" },
  adjustments: { label: "Adjustments", icon: "\u{1F9E0}" }
  // [PLAYTEST 2026-08-12 item 31 — owner: "just cut it"] `motivator` is GONE.
  // It was dead twice over: `per: 0` meant a 💎 motivator and a blank one paid
  // the same nothing, and NO code path anywhere ever awarded it XP, so it could
  // not be raised either. Worse than merely inert — a career migrated from the
  // retired `culture` axis could carry a grade, so dnaTitle would call a man a
  // "Motivating Coach" on the strength of an axis that did nothing and could
  // never grow. Cut the way developer/recruiter were: drop it from DNA_AXES and
  // every consumer follows, because they all key off this table.
  // [DNA TREE §4 D3] developer + recruiter LEFT the crest and returned to the
  // skills system alongside Roots and Reputation (the un-fold). Earned DNA XP
  // in those axes folds back into skill XP via unfoldDnaToSkills — a man keeps
  // what he earned. Banked tree history in those axes is left untouched,
  // simply unread (every iteration keys off DNA_AXES).
};
DNA_BONUS = {
  groundPound: { per: 0.015, label: (g) => g ? `Ball-carrier fatigue drains ${(g * 1.5).toFixed(0)}% slower late` : "Wear defenses down in the 4th quarter" },
  airAttack: { per: 0.01, label: (g) => g ? `Deep-pass accuracy +${g}%` : "Sharper shots down the field" },
  pressure: { per: 0.015, label: (g) => g ? `Blitz big-play risk \u2212${(g * 1.5).toFixed(0)}%` : "Bring heat without getting burned deep" },
  ballHawk: { per: 0.01, label: (g) => g ? `Takeaway chance on contested plays +${g}%` : "Turn contested balls into takeaways" },
  ballSecurity: { per: 0.01, label: (g) => g ? `Your offense's turnover rate \u2212${g}%` : "Protect the football" },
  discipline: { per: 0.012, label: (g) => g ? `Pre-snap penalty rate \u2212${(g * 1.2).toFixed(0)}%` : "Stay out of your own way" },
  riverboat: { per: 0.01, label: (g) => g ? `4th-down & 2-pt conversion odds +${g}%` : "Convert when you gamble" },
  roadWarrior: { per: 0.08, label: (g) => g ? `Road / crowd-noise penalty \u2212${(g * 8).toFixed(0)}%` : "Silence hostile crowds" },
  specialTeams: { per: 0.01, label: (g) => g ? `FG range & coverage +${g}%` : "Win the hidden-yardage battle" },
  adjustments: { per: 0.1, label: (g) => g ? `Halftime adjustment strength +${(g * 10).toFixed(0)}%` : "Out-scheme them after the break" }
  // motivator removed 2026-08-12 (playtest item 31) — see the note in DNA_AXES.
  // Every axis left on the crest pays a real, readable bonus.
  // developer/recruiter bonuses removed with the D3 un-fold — their effects
  // live on the skill ladder again (SKILL_DEVELOPER_STEP / SKILL_RECRUITER_STEP).
};

export { DNA_AXES, MAX_COACHES, MAX_GAMEPLANS, MAX_SAVED_TEAMS, MAX_TREES, MAX_WORLDS, addDnaXP, bankIntoTree, clearWorldSlot, coachDNA, coachRecords, createCoach, createTree, deleteCoach, deleteLibraryPlan, deleteSavedTeam, deleteTree, divisionMemory, dnaBankable, dnaBonus, dnaGrade, dnaGrades, dnaInheritance, dnaStarLabel, dnaStarTier, dnaTitle, dnaXpForNextGrade, getCoach, getTree, instantiateSavedTeam, listCoaches, listSavedTeams, listSoloCoaches, listTrees, migrateDna, noteCoachRecords, noteDivisionMemory, noteTreeMeta, noteWorldMeta, removeWorldClassicMeta, saveGameplanToLibrary, saveTeamToLibrary, treeWorldKey, trickleIntoTree, unfoldDnaToSkills, updateCoach, updateTree, worldSlotKey };
