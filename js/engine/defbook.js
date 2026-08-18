import { DEF_FRONTS, C, aggrStopFromBlitzPct } from '../constants.js';

// ── customDefBook shape (Creativity Tools — the defensive playbook, Aug 2026) ─
// The defensive twin of playbook.js. Where an offensive playbook is formation +
// play sheets, a defense is a SCHEME of dials the sim already consumes — nothing
// new in the hot path:
//
//   { schemaVersion, name,
//     baseFront,                       → gameplan.defBaseFront
//     frontMix: { [front]: weight },   → gameplan.defFrontMix
//     aggression,                      → gameplan.defAggression (+ blitzPct mirror)
//     pressIdentity,                   → gameplan.pressIdentity
//     pressureSource: {edge,interior,secondary}, → gameplan.pressureSource
//     coverageScheme,                  → gameplan.coverageScheme
//     greenDog, spyQB }                → gameplan.<same>
//
// So "load a defense into a gameplan" is a field copy (applyDefBookToGameplan)
// and "save the current defense as a book" is the inverse (defBookFromGameplan).
// Legality is validated against the same catalogs the sim reads (DEF_FRONTS,
// C.AGGRESSION, C.PRESS_IDENTITY) so a saved book can never ask for a front or
// blitz the engine doesn't have.
var DEFBOOK_SCHEMA_VERSION = 2;

// ── v2: "The Answers" (Ref/DEFENSIVE_PLAYBOOK_V2.md, ratified 2026-08-15) ────
// v1 (identity dials) survives as the SPINE. v2 adds:
//   shelves: { [shelfKey]: [CARD, …] }  — the call sheet, ≤2 cards a shelf
//   answers: { [personnelClass]: cardName } — "when they show it, we check to…"
// A CARD is a named defensive play: { name, front, coverage, bring, look,
// weight, + coach-mode extras }. Every field maps 1:1 onto the engine's
// existing defCall / situation-cell / formCheck vocabulary — compiling a v2
// book writes ONLY seams the sim already consumes (no new sim paths).
var DEF_SHELVES = [
  { key: "base", label: "Base Downs", desc: "Your everyday answer — most snaps live here.", cells: ["base", "first_ten"] },
  { key: "passing", label: "Passing Downs", desc: "Get off the field on 3rd & long and late trailing downs.", cells: ["third_long", "third_medium", "second_long", "two_min_trail"] },
  { key: "short", label: "Short Yardage & Goal Line", desc: "A yard to give, nothing behind you.", cells: ["third_short", "goal_line", "backed_up"] },
  { key: "gamble", label: "The Gamble", desc: "Your pressure package — headset calls, never automatic.", cells: [] },
  { key: "protect", label: "Protect", desc: "Late with a lead — keep everything in front.", cells: ["four_min_lead"] }
];
var DEF_SHELF_CARD_CAP = 3; // raised 2→3 (owner, 2026-08-17): more than one named call per shelf. 5×3=15 > the 12-call headset library, so applyDefBookToGameplan's compile independently caps the headset at 12 distinct calls (the n>=12 guard) — a book carries at most 12 named calls no matter how full its shelves.
// The eight coverage pictures a card can call, mapped to the exact engine
// fields the call system consumes (shell/style primitives or a covFamily).
var DEF_CALL_COVERAGES = [
  { id: "c1", label: "Cover 1", desc: "Man across, one deep safety helps.", fields: { covShell: "single", covStyle: "man" }, art: { deep: "mof", man: true } },
  { id: "c3", label: "Cover 3", desc: "Three deep thirds, four underneath.", fields: { covShell: "single", covStyle: "zone" }, art: { deep: "thirds" } },
  { id: "c2", label: "Cover 2", desc: "Two deep halves, five underneath.", fields: { covShell: "two", covStyle: "zone" }, art: { deep: "halves" } },
  { id: "c2man", label: "2-Man", desc: "Man underneath, two safeties over the top.", fields: { covFamily: "Cover 2-Man" }, art: { deep: "halves", man: true } },
  { id: "tampa2", label: "Tampa 2", desc: "Cover 2 with the Mike running the deep middle.", fields: { covFamily: "Tampa 2" }, art: { deep: "halves", pole: true } },
  { id: "c6", label: "Cover 6", desc: "Quarters to the field, Cover 2 to the boundary.", fields: { covFamily: "Cover 6" }, art: { deep: "quarters" } },
  { id: "prevent", label: "Prevent", desc: "Rush three, everything stays in front.", fields: { covFamily: "Prevent", rush3: true }, art: { deep: "thirds" } },
  { id: "base", label: "Match the identity", desc: "Play the book's standing coverage identity.", fields: {}, art: { deep: null } }
];
var DEF_CALL_COVERAGE_IDS = DEF_CALL_COVERAGES.map((c) => c.id);
// "How many come" → the per-call aggression stop the engine already speaks.
var DEF_CALL_BRING = {
  "3": { label: "Rush 3", desc: "Drop eight — coverage wins this down.", fields: { rush3: true } },
  "4": { label: "Rush 4", desc: "The front wins or nobody does.", fields: { aggression: "balanced" } },
  "5": { label: "Bring 5", desc: "A second-level player comes too.", fields: { aggression: "attacking" } },
  "6": { label: "Bring the House", desc: "No help — get there or get beat.", fields: { aggression: "house" } }
};
function emptyDefCard(name) {
  return { name: String(name || "New Call").slice(0, 24), front: null, coverage: "base", bring: "4", look: null, weight: 50 };
}
// A card → the sparse defCall payload the headset/named-call system consumes.
function cardToDefCall(card) {
  const cov = DEF_CALL_COVERAGES.find((c) => c.id === card.coverage) || DEF_CALL_COVERAGES[DEF_CALL_COVERAGES.length - 1];
  const bring = DEF_CALL_BRING[card.bring] || DEF_CALL_BRING["4"];
  const out = { ...cov.fields, ...bring.fields };
  if (card.front && isFront(card.front)) out.front = card.front;
  if (card.look && pressIdentities().includes(card.look)) out.pressureIdentity = card.look;
  for (const k of ["runCommit", "edgePlay", "robberCall", "zoneStyle", "dogGame", "pressLevel"]) {
    if (card[k] != null && card[k] !== "auto" && card[k] !== "") out[k] = card[k];
  }
  return out;
}
// A card → the def-side fields a SITUATION CELL consumes (getEffectivePlan's
// vocabulary — families translate to shell/style; a cell has no covFamily).
var _FAMILY_SHELL = { "Cover 6": { covShell: "two", covStyle: "zone" }, "Tampa 2": { covShell: "two", covStyle: "zone" }, "Cover 2-Man": { covShell: "two", covStyle: "man" }, "Prevent": { covShell: "two", covStyle: "zone" } };
function cardToCell(card) {
  const call = cardToDefCall(card);
  const cell = {};
  if (call.front) cell.defFront = call.front;
  if (call.aggression) cell.defAggression = call.aggression;
  if (call.pressureIdentity) cell.pressureIdentity = call.pressureIdentity;
  const fam = call.covFamily && _FAMILY_SHELL[call.covFamily];
  if (fam) { cell.covShell = fam.covShell; cell.covStyle = fam.covStyle; }
  else {
    if (call.covShell) cell.covShell = call.covShell;
    if (call.covStyle) cell.covStyle = call.covStyle;
  }
  for (const k of ["runCommit", "edgePlay", "robberCall", "zoneStyle", "pressLevel"]) if (call[k] != null) cell[k] = call[k];
  return cell;
}
// A card → a formCheck cell ("when they show this personnel, check to…").
function cardToFormCheck(card) {
  const call = cardToDefCall(card);
  const chk = {};
  if (call.front) chk.defFront = call.front;
  if (call.aggression) chk.defAggression = call.aggression;
  if (call.pressureIdentity) chk.pressureIdentity = call.pressureIdentity;
  if (call.covShell) chk.covShell = call.covShell;
  if (call.covStyle) chk.covStyle = call.covStyle;
  if (call.edgePlay) chk.edgePlay = call.edgePlay;
  if (call.runCommit != null) chk.runCommit = call.runCommit;
  return chk;
}
var DEF_ANSWER_CLASSES = [
  { key: "empty", label: "vs Empty" }, { key: "10", label: "vs 10 pers (4 WR)" },
  { key: "11", label: "vs 11 pers (3 WR)" }, { key: "12", label: "vs 12 pers (2 TE)" },
  { key: "heavy", label: "vs Heavy" }, { key: "option", label: "vs Option looks" }
];
function bookCards(db) {
  const out = [];
  for (const sh of DEF_SHELVES) for (const c of (db && db.shelves && db.shelves[sh.key]) || []) out.push({ shelf: sh.key, card: c });
  return out;
}

// The five coverage identities the sim honors (sim.js: balanced / aggressive /
// conservative / lockTop / bracketTop), with plain labels for the picker.
var DEF_COVERAGE_SCHEMES = [
  { id: "balanced", label: "Balanced", desc: "Mix man and zone, protect the middle." },
  { id: "aggressive", label: "Aggressive", desc: "Press coverage, jump routes, trust the rush." },
  { id: "conservative", label: "Conservative", desc: "Soft zone, everything in front, no big plays." },
  { id: "lockTop", label: "Lock the No. 1", desc: "Travel your best corner onto their best receiver." },
  { id: "bracketTop", label: "Bracket the No. 1", desc: "Double their best receiver over the top." }
];
var COVERAGE_IDS = DEF_COVERAGE_SCHEMES.map((c) => c.id);

function frontIds() { return Object.keys(DEF_FRONTS); }
function isFront(id) { return !!DEF_FRONTS[id]; }
function aggressionStops() { return (C.AGGRESSION && C.AGGRESSION.order) || ["bend", "selective", "balanced", "attacking", "house"]; }
function pressIdentities() { return Object.keys(C.PRESS_IDENTITY || {}); }

function emptyDefBook(name) {
  return {
    schemaVersion: DEFBOOK_SCHEMA_VERSION,
    name: String(name || "New Defense").slice(0, 36),
    baseFront: "4-3",
    frontMix: { "4-3": 60, "Nickel": 40 },
    aggression: "balanced",
    pressIdentity: "fireZone",
    pressureSource: { edge: 50, interior: 25, secondary: 25 },
    coverageScheme: "balanced",
    greenDog: false,
    spyQB: false,
    shelves: {},
    answers: {}
  };
}

// { ok, errors[], warnings[] } — errors are hard (would mislead the sim/UI);
// warnings are advisory. applyDefBookToGameplan throws on errors.
function validateDefBook(db) {
  const errors = [], warnings = [];
  if (!db || typeof db !== "object") return { ok: false, errors: ["defense must be an object"], warnings };
  if (typeof db.name !== "string" || !db.name.trim()) warnings.push("defense has no name");
  if (!db.baseFront || !isFront(db.baseFront)) errors.push(`unknown base front "${db.baseFront}"`);
  const fm = db.frontMix && typeof db.frontMix === "object" ? db.frontMix : null;
  if (db.frontMix != null && !fm) errors.push("frontMix must be an object");
  let liveWeight = 0;
  if (fm) {
    for (const [front, w] of Object.entries(fm)) {
      if (!isFront(front)) errors.push(`front mix has unknown front "${front}"`);
      if (typeof w !== "number" || w < 0) errors.push(`front "${front}": weight must be a number ≥ 0`);
      else liveWeight += w;
    }
    if (db.baseFront && isFront(db.baseFront) && !(db.baseFront in fm)) warnings.push("the base front isn't in the front mix — it may rarely be called");
    if (Object.keys(fm).length && liveWeight <= 0) warnings.push("no front carries a positive weight");
  }
  if (!aggressionStops().includes(db.aggression)) errors.push(`unknown aggression "${db.aggression}"`);
  if (db.pressIdentity != null && !pressIdentities().includes(db.pressIdentity)) errors.push(`unknown pressure identity "${db.pressIdentity}"`);
  if (!COVERAGE_IDS.includes(db.coverageScheme)) errors.push(`unknown coverage scheme "${db.coverageScheme}"`);
  const ps = db.pressureSource;
  if (ps != null) {
    if (typeof ps !== "object") errors.push("pressureSource must be an object");
    else {
      for (const k of ["edge", "interior", "secondary"]) {
        if (ps[k] != null && (typeof ps[k] !== "number" || ps[k] < 0)) errors.push(`pressureSource.${k} must be a number ≥ 0`);
      }
      const sum = ["edge", "interior", "secondary"].reduce((a, k) => a + (typeof ps[k] === "number" ? ps[k] : 0), 0);
      if (sum <= 0) warnings.push("pressure comes from nowhere — set at least one source");
    }
  }
  if (db.greenDog != null && typeof db.greenDog !== "boolean") errors.push("greenDog must be true/false");
  if (db.spyQB != null && typeof db.spyQB !== "boolean") errors.push("spyQB must be true/false");
  // v2 shelves + answers (both optional — every v1 book stays valid)
  if (db.shelves != null) {
    if (typeof db.shelves !== "object") errors.push("shelves must be an object");
    else for (const [key, cards] of Object.entries(db.shelves)) {
      if (!DEF_SHELVES.some((s) => s.key === key)) { errors.push(`unknown shelf "${key}"`); continue; }
      if (!Array.isArray(cards)) { errors.push(`shelf "${key}" must be an array of calls`); continue; }
      if (cards.length > DEF_SHELF_CARD_CAP) errors.push(`shelf "${key}" holds at most ${DEF_SHELF_CARD_CAP} calls`);
      for (const c of cards) {
        if (!c || typeof c !== "object") { errors.push(`shelf "${key}" has a malformed call`); continue; }
        if (!c.name || !String(c.name).trim()) warnings.push(`a call on "${key}" has no name`);
        if (c.front != null && !isFront(c.front)) errors.push(`call "${c.name}": unknown front "${c.front}"`);
        if (c.coverage != null && !DEF_CALL_COVERAGE_IDS.includes(c.coverage)) errors.push(`call "${c.name}": unknown coverage "${c.coverage}"`);
        if (c.bring != null && !DEF_CALL_BRING[c.bring]) errors.push(`call "${c.name}": unknown pressure count "${c.bring}"`);
        if (c.look != null && !pressIdentities().includes(c.look)) errors.push(`call "${c.name}": unknown pressure look "${c.look}"`);
        if (c.weight != null && (typeof c.weight !== "number" || c.weight < 0)) errors.push(`call "${c.name}": weight must be ≥ 0`);
      }
    }
  }
  if (db.answers != null) {
    if (typeof db.answers !== "object") errors.push("answers must be an object");
    else {
      const names = new Set(bookCards(db).map((e) => e.card && e.card.name));
      for (const [cls, nm] of Object.entries(db.answers)) {
        if (!DEF_ANSWER_CLASSES.some((a) => a.key === cls)) errors.push(`unknown personnel answer "${cls}"`);
        if (nm && !names.has(nm)) warnings.push(`personnel answer "${cls}" names a call that isn't on a shelf ("${nm}")`);
      }
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

// Load a defense into a gameplan — returns a NEW gameplan (input untouched); the
// offense and everything the book doesn't govern carry through. Throws on a book
// with hard errors.
function applyDefBookToGameplan(db, gameplan) {
  const v = validateDefBook(db);
  if (!v.ok) throw new Error(`applyDefBookToGameplan: invalid defense — ${v.errors[0]}`);
  const gp = JSON.parse(JSON.stringify(gameplan || {}));
  gp.defBaseFront = db.baseFront;
  if (db.frontMix && typeof db.frontMix === "object") gp.defFrontMix = { ...db.frontMix };
  gp.defAggression = db.aggression;
  gp.blitzPct = (C.AGGRESSION && C.AGGRESSION.rate[db.aggression] != null) ? C.AGGRESSION.rate[db.aggression] : 20;
  // The ENGINE's field is `pressureIdentity` (sim.js/situations.js/ai.js and the
  // Game Plan UI all read that). The book's own field stays `pressIdentity`
  // (schema v1 — saved books unaffected); the old write to gp.pressIdentity was
  // a dead field the sim never read — the custom pressure look was silently
  // lost (found in the 2026-08-15 off/def separation audit).
  if (db.pressIdentity) gp.pressureIdentity = db.pressIdentity;
  delete gp.pressIdentity;
  if (db.pressureSource && typeof db.pressureSource === "object") gp.pressureSource = { ...db.pressureSource };
  gp.coverageScheme = db.coverageScheme;
  gp.greenDog = !!db.greenDog;
  gp.spyQB = !!db.spyQB;
  gp._defbookName = db.name || null;
  // ── v2 shelves + answers compile into seams the sim already consumes ──────
  if (db.shelves && typeof db.shelves === "object") {
    // Every shelf card becomes a NAMED CALL (headset chips), shelf order,
    // capped at the headset's 12-call library.
    const calls = {};
    let n = 0;
    for (const { card } of bookCards(db)) {
      if (!card || !card.name || n >= 12) continue;
      if (calls[card.name]) continue;
      calls[card.name] = cardToDefCall(card);
      n++;
    }
    if (n) gp.defCalls = calls;
    // The TOP-weighted card of each shelf becomes the standing situational
    // answer — written into that shelf's cells, DEF FIELDS ONLY (a cell's
    // offensive keys — the owner's situational controls — are preserved).
    gp.situations = gp.situations && typeof gp.situations === "object" ? gp.situations : {};
    for (const sh of DEF_SHELVES) {
      const cards = (db.shelves[sh.key] || []).filter((c) => c && c.name);
      if (!cards.length || !sh.cells.length) continue;
      const top = cards.slice().sort((a, b) => (b.weight || 0) - (a.weight || 0))[0];
      const cellPatch = cardToCell(top);
      if (!Object.keys(cellPatch).length) continue;
      for (const cellKey of sh.cells) gp.situations[cellKey] = { ...(gp.situations[cellKey] || {}), ...cellPatch };
    }
  }
  if (db.answers && typeof db.answers === "object") {
    const byName = {};
    for (const { card } of bookCards(db)) if (card && card.name) byName[card.name] = card;
    const checks = {};
    for (const [cls, nm] of Object.entries(db.answers)) {
      const card = nm && byName[nm];
      if (!card) continue;
      const chk = cardToFormCheck(card);
      if (Object.keys(chk).length) checks[cls] = chk;
    }
    if (Object.keys(checks).length) gp.formChecks = checks;
  }
  return gp;
}

// Extract a defense from a live gameplan — "save this defense as a book".
function defBookFromGameplan(gameplan, name) {
  const gp = gameplan || {};
  const db = emptyDefBook(name || gp._defbookName || "My Defense");
  if (gp.defBaseFront && isFront(gp.defBaseFront)) db.baseFront = gp.defBaseFront;
  if (gp.defFrontMix && typeof gp.defFrontMix === "object") db.frontMix = { ...gp.defFrontMix };
  else db.frontMix = { [db.baseFront]: 100 };
  db.aggression = gp.defAggression || aggrStopFromBlitzPct(gp.blitzPct);
  // Read the engine's real field; tolerate the legacy dead field on old plans.
  if (gp.pressureIdentity) db.pressIdentity = gp.pressureIdentity;
  else if (gp.pressIdentity) db.pressIdentity = gp.pressIdentity;
  if (gp.pressureSource && typeof gp.pressureSource === "object") db.pressureSource = { ...gp.pressureSource };
  if (gp.coverageScheme) db.coverageScheme = gp.coverageScheme;
  db.greenDog = !!gp.greenDog;
  db.spyQB = !!gp.spyQB;
  return db;
}

// Load-time repair: a book authored against an older build can reference a front,
// identity, or scheme that has since changed. Clean it against CURRENT data and
// return { db, changes, ok } so the UI can quietly repair instead of breaking.
function repairDefBook(db) {
  const changes = [];
  const src = db && typeof db === "object" ? db : {};
  const out = emptyDefBook(src.name || "Defense");
  if (src.baseFront && isFront(src.baseFront)) out.baseFront = src.baseFront;
  else if (src.baseFront) changes.push(`dropped base front "${src.baseFront}" (no longer exists) — using ${out.baseFront}`);
  const fm = {};
  for (const [front, w] of Object.entries(src.frontMix && typeof src.frontMix === "object" ? src.frontMix : {})) {
    if (!isFront(front)) { changes.push(`dropped front "${front}" from the mix (no longer exists)`); continue; }
    fm[front] = typeof w === "number" && w >= 0 ? w : 0;
  }
  out.frontMix = Object.keys(fm).length ? fm : { [out.baseFront]: 100 };
  if (aggressionStops().includes(src.aggression)) out.aggression = src.aggression;
  else if (src.aggression) changes.push(`dropped aggression "${src.aggression}" (no longer exists)`);
  if (pressIdentities().includes(src.pressIdentity)) out.pressIdentity = src.pressIdentity;
  else if (src.pressIdentity) changes.push(`dropped pressure identity "${src.pressIdentity}" (no longer exists)`);
  if (COVERAGE_IDS.includes(src.coverageScheme)) out.coverageScheme = src.coverageScheme;
  else if (src.coverageScheme) changes.push(`dropped coverage scheme "${src.coverageScheme}" (no longer exists)`);
  if (src.pressureSource && typeof src.pressureSource === "object") {
    const ps = {};
    for (const k of ["edge", "interior", "secondary"]) ps[k] = typeof src.pressureSource[k] === "number" && src.pressureSource[k] >= 0 ? src.pressureSource[k] : out.pressureSource[k];
    out.pressureSource = ps;
  }
  if (typeof src.greenDog === "boolean") out.greenDog = src.greenDog;
  if (typeof src.spyQB === "boolean") out.spyQB = src.spyQB;
  // v2: repair shelves + answers; a v1 book simply gets empty ones (no loss).
  out.shelves = {};
  if (src.shelves && typeof src.shelves === "object") {
    for (const sh of DEF_SHELVES) {
      const kept = [];
      for (const c of Array.isArray(src.shelves[sh.key]) ? src.shelves[sh.key] : []) {
        if (!c || typeof c !== "object" || !c.name) { changes.push(`dropped a malformed call from "${sh.label}"`); continue; }
        const fix = { ...emptyDefCard(c.name), ...c };
        if (fix.front != null && !isFront(fix.front)) { changes.push(`call "${c.name}": dropped front "${fix.front}" (no longer exists)`); fix.front = null; }
        if (!DEF_CALL_COVERAGE_IDS.includes(fix.coverage)) { changes.push(`call "${c.name}": coverage reset (no longer exists)`); fix.coverage = "base"; }
        if (!DEF_CALL_BRING[fix.bring]) fix.bring = "4";
        if (fix.look != null && !pressIdentities().includes(fix.look)) { changes.push(`call "${c.name}": dropped pressure look`); fix.look = null; }
        if (kept.length < DEF_SHELF_CARD_CAP) kept.push(fix);
      }
      if (kept.length) out.shelves[sh.key] = kept;
    }
  }
  out.answers = {};
  if (src.answers && typeof src.answers === "object") {
    const names = new Set(bookCards(out).map((e) => e.card.name));
    for (const [cls, nm] of Object.entries(src.answers)) {
      if (DEF_ANSWER_CLASSES.some((a) => a.key === cls) && nm && names.has(nm)) out.answers[cls] = nm;
      else if (nm) changes.push(`dropped personnel answer "${cls}" (its call is gone)`);
    }
  }
  return { db: out, changes, ok: validateDefBook(out).ok };
}

export {
  DEFBOOK_SCHEMA_VERSION, DEF_COVERAGE_SCHEMES, COVERAGE_IDS,
  DEF_SHELVES, DEF_SHELF_CARD_CAP, DEF_CALL_COVERAGES, DEF_CALL_BRING, DEF_ANSWER_CLASSES,
  frontIds, isFront, aggressionStops, pressIdentities,
  emptyDefBook, emptyDefCard, cardToDefCall, cardToCell, cardToFormCheck, bookCards,
  validateDefBook, applyDefBookToGameplan, defBookFromGameplan, repairDefBook
};
