import { fittingConceptsForFormation, lookSheetKey, emptyPlaybook, validatePlaybook } from './playbook.js';
import { aliasFormation } from '../constants.js';
import { emptyDefBook, emptyDefCard, validateDefBook } from './defbook.js';

// ── The starter book library (Ref/DEFENSIVE_PLAYBOOK_V2.md §5, Aug 2026) ────
// Six COMPLETE books a side. A new player never faces an empty book: pick one,
// open it in its Builder, edit anything, "Save as my own". Every sheet entry is
// filtered through the CURRENT legality tables at module load, so a renamed or
// removed concept can never make a starter book invalid — the book just loses
// that entry. These are data, not code: balance lives in the engine's tables.

// Every play that FITS a look's personnel, all selected at a flat weight — the
// same default the Playbook Builder uses (owner, 2026-08-18). A variation is its
// OWN formation: fittingConceptsForFormation is variation-aware, so an empty look
// never carries a handoff (a back-needing play doesn't fit empty personnel and
// is never added). A concept that's left the legality table simply isn't in the
// list, so a starter book can never carry an illegal — or a misfit — play.
function allFittingSheet(fid, variation, w = 50) {
  const out = {};
  for (const c of fittingConceptsForFormation(fid, variation || undefined)) out[c] = w;
  return out;
}
// Build the full sheets object for a book straight from the looks it carries:
// EVERY carried look (base + each variation) gets its OWN sheet key filled with
// the plays that fit THAT look's personnel. Each look is independent (its own
// key, no inherit-base), exactly like the builder. De-dupes repeated look keys
// (a book can list the same look twice at different weights).
function allLegalSheets(formations) {
  const sheets = {};
  for (const f of formations || []) {
    if (!f || !f.id) continue;
    const fid = aliasFormation(f.id);
    const key = lookSheetKey(fid, f.variation || null);
    if (!sheets[key]) sheets[key] = allFittingSheet(fid, f.variation || null);
  }
  return sheets;
}
// A book's sheets are now DERIVED from its carried looks (all-legal each), so
// offBook no longer takes a hand-authored sheets object — the formations list is
// the single source of truth for both which looks run and what plays they carry.
function offBook(name, formations, extras) {
  const pb = { ...emptyPlaybook(name), formations, sheets: allLegalSheets(formations) };
  if (extras) Object.assign(pb, extras);
  return pb;
}
// Each book carries the formations/looks that define its identity, plus its
// run/pass tendency and depth lean. Play SELECTION is now all-legal per look
// (owner, 2026-08-18) — a book's feel comes from WHICH looks it runs and how it
// leans, not from a curated play list; the coach trims from the full menu.
var DEFAULT_OFF_BOOKS = [
  offBook("Air Raid",
    [{ id: "Air Raid", weight: 40 }, { id: "Air Raid", weight: 15, variation: "empty" }, { id: "Spread", weight: 30 }, { id: "Empty", weight: 15 }],
    { tendency: "Heavy Pass", rushInPct: 45, passDepth: { short: 40, medium: 38, deep: 22 } }),
  offBook("Ground & Pound",
    [{ id: "Power-I", weight: 40 }, { id: "Power-I", weight: 15, variation: "big" }, { id: "Single Back", weight: 25 }, { id: "Jumbo", weight: 20 }],
    { tendency: "Heavy Run", rushInPct: 62 }),
  offBook("West Coast",
    [{ id: "Single Back", weight: 35 }, { id: "Spread", weight: 25 }, { id: "Trips/Bunch", weight: 25 }, { id: "Power-I", weight: 15, variation: "twins" }],
    { tendency: "Balanced", passDepth: { short: 48, medium: 36, deep: 16 } }),
  offBook("Spread Option",
    [{ id: "Pistol/RPO", weight: 40 }, { id: "Spread", weight: 30 }, { id: "Pistol/RPO", weight: 15, variation: "trips" }, { id: "Flexbone", weight: 15 }],
    { tendency: "Run", rushInPct: 58 }),
  offBook("Pro Balanced",
    [{ id: "Single Back", weight: 30 }, { id: "Power-I", weight: 25 }, { id: "Spread", weight: 25 }, { id: "Trips/Bunch", weight: 20 }],
    { tendency: "Balanced" }),
  offBook("Triple Option",
    [{ id: "Flexbone", weight: 45 }, { id: "Wishbone", weight: 30 }, { id: "Flexbone", weight: 15, variation: "trips" }, { id: "Power-I", weight: 10 }],
    { tendency: "Heavy Run", rushInPct: 68 })
];

// defense — a card helper: name + the three big choices (+ coach-mode extras)
function dcard(name, front, coverage, bring, look, extra) {
  return { ...emptyDefCard(name), front, coverage, bring, look: look || null, ...(extra || {}) };
}
function defBookOf(name, identity, shelves, answers) {
  return { ...emptyDefBook(name), ...identity, shelves, answers: answers || {} };
}
var DEFAULT_DEF_BOOKS = [
  defBookOf("Balanced Pro", {
  baseFront: "4-3",
  frontMix: { "4-3": 60, "Nickel": 25, "5-2": 10, "4-4": 5 },
  coverageScheme: "balanced",
  aggression: "selective",
  pressIdentity: "fireZone",
  spyQB: true
}, {
  base: [
    dcard("Base Cover 2", "4-3", "c2", "4", null, { runCommit: 1, edgePlay: "contain", weight: 60 }),
    dcard("Sky Cover 3", "4-3", "c3", "4", null, { runCommit: 1, edgePlay: "contain", weight: 50 })
  ],
  passing: [
    dcard("Nickel Cover 3", "Nickel", "c3", "4", null, { weight: 60 }),
    dcard("Nickel Cover 2", "Nickel", "c2", "4", null, { weight: 50 }),
    dcard("Dime Tampa 2", "Dime", "tampa2", "4", null, { weight: 45 })
  ],
  short: [
    dcard("Goal Line Stack", "5-2", "c1", "5", null, { runCommit: 3, edgePlay: "crash", weight: 60 }),
    dcard("Bear Run Blitz", "46/Bear", "c1", "5", "secondLevel", { runCommit: 2, edgePlay: "crash", weight: 45 })
  ],
  gamble: [
    dcard("Nickel Fire Zone", "Nickel", "c3", "5", "fireZone", { weight: 60, dogGame: "cross" }),
    dcard("Cover 1 Pressure", "Nickel", "c1", "5", "secondaryHeat", { weight: 45 })
  ],
  protect: [
    dcard("Prevent Cover 3", "Dime", "prevent", "3", null, { weight: 60 }),
    dcard("Option Scrape", "4-4", "c3", "4", null, { runCommit: 2, edgePlay: "contain", weight: 40 })
  ]
}, {
  empty: "Dime Tampa 2",
  "10": "Nickel Cover 3",
  "11": "Base Cover 2",
  "12": "Sky Cover 3",
  heavy: "Goal Line Stack",
  option: "Option Scrape"
}),
  defBookOf("Attack 3-4",
    // OD-5 (D16, 2026-08-18): coverageScheme "aggressive" was a placebo (no sim
    // branch — it resolved as "balanced"); the starter now says what it plays.
    { baseFront: "3-4", frontMix: { "3-4": 60, "Nickel": 40 }, coverageScheme: "balanced", aggression: "attacking", pressIdentity: "fireZone" },
    {
      base: [
        dcard("34 Sky", "3-4", "c3", "4", "fireZone", { weight: 60 }),
        dcard("34 Press 1", "3-4", "c1", "5", "secondLevel", { weight: 50 }),
        dcard("Okie 2", "3-4", "c2", "4", null, { weight: 45 })
      ],
      passing: [
        dcard("Zone Dog", "Nickel", "c3", "5", "fireZone", { weight: 60 }),
        dcard("Trap 2", "Nickel", "c2man", "4", null, { weight: 50 }),
        dcard("Dime Green", "Dime", "tampa2", "4", null, { weight: 45 })
      ],
      short: [
        dcard("Bear Down", "46/Bear", "c1", "5", "secondLevel", { runCommit: 15, weight: 60 }),
        dcard("Goal Line 34", "3-4", "c1", "5", "secondLevel", { runCommit: 12, weight: 48 })
      ],
      gamble: [
        dcard("Zero", "3-4", "c1", "6", "theHouse", { weight: 60 }),
        dcard("Safety Heat", "3-4", "c3", "5", "secondaryHeat", { weight: 50 })
      ],
      protect: [
        dcard("Soft Shell", "Dime", "prevent", "3", null, { weight: 60 }),
        dcard("Late Two", "Dime", "c2", "4", null, { weight: 48 })
      ]
    }, { empty: "Dime Green", "10": "Trap 2", "11": "Zone Dog", "12": "Okie 2", heavy: "Bear Down", option: "34 Sky" }),
  defBookOf("Bend-Don't-Break",
    // OD-5 (D16): "conservative" was a placebo — the bend identity lives in the
    // aggression stop + the soft shelves, which this book already carries.
    { baseFront: "Nickel", frontMix: { "Nickel": 55, "4-3": 20, "Dime": 15, "Big Nickel": 10 }, coverageScheme: "balanced", aggression: "bend", pressIdentity: "secondLevel" },
    {
      base: [
        dcard("Quarters Match", "Nickel", "c6", "4", null, { weight: 62, zoneStyle: "match" }),
        dcard("Two Shell", "4-3", "c2", "4", null, { weight: 50 }),
        dcard("Big Nickel Match", "Big Nickel", "c6", "4", null, { weight: 46, zoneStyle: "match" })
      ],
      passing: [
        dcard("Tampa Wall", "Dime", "tampa2", "4", null, { weight: 60 }),
        dcard("Dime Robber", "Dime", "c1", "4", null, { weight: 48, robberCall: true }),
        dcard("Empty Bracket", "Dime", "c2man", "4", null, { weight: 44, robberCall: true })
      ],
      short: [
        dcard("Goal Line Load", "46/Bear", "c1", "5", "secondLevel", { runCommit: 14, weight: 60 }),
        dcard("Gap Squeeze", "5-2", "c1", "4", null, { runCommit: 10, edgePlay: "contain", weight: 50 }),
        dcard("Option Contain", "4-4", "c3", "4", null, { edgePlay: "contain", weight: 46 })
      ],
      gamble: [
        dcard("Change-Up Dog", "Nickel", "c3", "5", "fireZone", { weight: 55 })
      ],
      protect: [
        dcard("Prevent", "Dime", "prevent", "3", null, { weight: 58 }),
        dcard("Two-Minute Wall", "Dime", "tampa2", "4", null, { weight: 50 })
      ]
    },
    { empty: "Empty Bracket", "10": "Tampa Wall", "11": "Quarters Match", "12": "Big Nickel Match", heavy: "Goal Line Load", option: "Option Contain" }),
  defBookOf("Pressure Everything", {
  baseFront: "46/Bear",
  frontMix: { "46/Bear": 55, "Nickel": 20, "Dime": 15, "5-2": 10 },
  // OD-5 (D16): "aggressive" was a placebo — the heat lives in the house stop.
  coverageScheme: "balanced",
  aggression: "house",
  pressIdentity: "theHouse",
  greenDog: true,
  spyQB: true
}, {
  base: [
    dcard("Bear Zero", "46/Bear", "c1", "6", "theHouse", { runCommit: 2, edgePlay: "crash", weight: 60 }),
    dcard("Bear Fire Zone", "46/Bear", "c3", "5", "fireZone", { zoneStyle: "fire", weight: 52 }),
    dcard("Double A Gap", "46/Bear", "c1", "5", "fireZone", { dogGame: "cross", weight: 48 })
  ],
  passing: [
    dcard("Nickel Blitz", "Nickel", "c1", "5", "secondaryHeat", { weight: 58 }),
    dcard("Dime Green Dog", "Dime", "c2man", "5", "secondaryHeat", { greenDog: true, weight: 56 }),
    dcard("Dime Rat Trap", "Dime", "tampa2", "4", "secondLevel", { robberCall: true, weight: 54 })
  ],
  short: [
    dcard("Goal Line Bear", "5-2", "c1", "6", "theHouse", { runCommit: 3, edgePlay: "crash", weight: 60 }),
    dcard("Short Yard Crash", "46/Bear", "c3", "5", "fireZone", { runCommit: 2, edgePlay: "crash", weight: 50 }),
    dcard("Option Contain", "4-4", "c3", "4", "secondLevel", { runCommit: 2, edgePlay: "contain", weight: 46 })
  ],
  gamble: [
    dcard("House Call", "Dime", "c1", "6", "theHouse", { dogGame: "cross", weight: 58 }),
    dcard("Cross Dog", "Nickel", "c1", "6", "theHouse", { dogGame: "cross", weight: 50 })
  ],
  protect: [
    dcard("Lead Prevent", "Dime", "tampa2", "4", null, { zoneStyle: "soft", weight: 55 }),
    dcard("Dime Rat Trap", "Dime", "tampa2", "4", "secondLevel", { robberCall: true, weight: 45 })
  ],
}, {
  empty: "Dime Rat Trap",
  "10": "Dime Green Dog",
  "11": "Nickel Blitz",
  "12": "Bear Fire Zone",
  heavy: "Bear Zero",
  option: "Option Contain"
}),
  defBookOf("Coastal Cover 3", {
  baseFront: "Nickel",
  frontMix: { "Nickel": 55, "Dime": 25, "Big Nickel": 12, "46/Bear": 8 },
  coverageScheme: "lockTop",
  aggression: "bend",
  pressIdentity: "secondLevel",
  spyQB: false
}, {
  base: [
    dcard("Coastal Cover 3", "Nickel", "c3", "4", "secondLevel", { zoneStyle: "sky", weight: 60 }),
    dcard("Sky Rotation Cover 3", "Nickel", "c3", "4", "secondLevel", { zoneStyle: "sky", robberCall: true, weight: 52 }),
    dcard("Scrape Exchange", "4-4", "c3", "4", null, { runCommit: 2, edgePlay: "contain", weight: 48 })
  ],
  passing: [
    dcard("Dime Coastal 3", "Dime", "c3", "4", "secondLevel", { zoneStyle: "cloud", weight: 58 }),
    dcard("Empty Bracket 2-Man", "Dime", "c2man", "4", null, { weight: 55 }),
    dcard("Tampa Trap", "Nickel", "tampa2", "4", null, { weight: 50 })
  ],
  short: [
    dcard("Bear Down G-Line", "46/Bear", "c1", "5", "theHouse", { runCommit: 3, edgePlay: "crash", weight: 60 }),
    dcard("Goal Line Robber", "5-2", "c3", "5", "secondLevel", { runCommit: 3, robberCall: true, weight: 50 })
  ],
  gamble: [
    dcard("Coastal Fire Zone", "Nickel", "c3", "5", "fireZone", { dogGame: "cross", weight: 55 }),
    dcard("Cover 3 Buzz Blitz", "Big Nickel", "c3", "5", "secondaryHeat", { dogGame: "cross", weight: 50 })
  ],
  protect: [
    dcard("Bend Cover 6", "Nickel", "c6", "4", null, { zoneStyle: "quarterQuarterHalf", weight: 55 }),
    dcard("Prevent Coastal", "Dime", "prevent", "3", null, { weight: 48 })
  ]
}, {
  empty: "Empty Bracket 2-Man",
  "10": "Dime Coastal 3",
  "11": "Coastal Cover 3",
  "12": "Sky Rotation Cover 3",
  heavy: "Bear Down G-Line",
  option: "Scrape Exchange"
}),
  defBookOf("Option Killer",
    { baseFront: "4-4", frontMix: { "4-4": 45, "5-2": 30, "4-3": 25 }, coverageScheme: "balanced", aggression: "balanced", pressIdentity: "secondLevel", spyQB: true },
    {
      base: [
        dcard("Assignment 44", "4-4", "c3", "4", null, { edgePlay: "contain", weight: 60 }),
        dcard("52 Wall", "5-2", "c1", "4", null, { edgePlay: "contain", weight: 50 }),
        dcard("Split 44", "4-4", "c6", "4", null, { edgePlay: "contain", weight: 45 })
      ],
      passing: [
        dcard("Nickel Match", "Nickel", "c3", "4", null, { weight: 58 }),
        dcard("Nickel 2-Trap", "Nickel", "c2", "4", null, { weight: 52 }),
        dcard("Dime Rush 3", "Dime", "tampa2", "3", null, { weight: 48 })
      ],
      short: [
        dcard("Gap Sound", "5-2", "c1", "5", "secondLevel", { runCommit: 14, edgePlay: "contain", weight: 60 }),
        dcard("Goal Bear", "46/Bear", "c1", "5", "secondLevel", { runCommit: 18, weight: 46 })
      ],
      gamble: [
        dcard("Crash Change-Up", "4-4", "c1", "5", "secondLevel", { edgePlay: "crash", weight: 55 }),
        dcard("Fire Contain", "Nickel", "c3", "5", "fireZone", { edgePlay: "contain", weight: 48 })
      ],
      protect: [
        dcard("Two High", "Nickel", "c2", "4", null, { weight: 55 }),
        dcard("Dime Prevent", "Dime", "prevent", "3", null, { weight: 45 })
      ]
    }, { empty: "Dime Rush 3", "10": "Nickel 2-Trap", "11": "Nickel Match", "12": "Split 44", heavy: "Gap Sound", option: "Assignment 44" })
];

// Validate at load in dev-ish spirit: a broken starter would otherwise brick
// the pickers. Invalid entries are dropped, loudly in the console.
DEFAULT_OFF_BOOKS = DEFAULT_OFF_BOOKS.filter((b) => {
  const v = validatePlaybook(b);
  if (!v.ok && typeof console !== "undefined") console.warn("starter off book invalid:", b.name, v.errors[0]);
  return v.ok;
});
DEFAULT_DEF_BOOKS = DEFAULT_DEF_BOOKS.filter((b) => {
  const v = validateDefBook(b);
  if (!v.ok && typeof console !== "undefined") console.warn("starter def book invalid:", b.name, v.errors[0]);
  return v.ok;
});
function defaultOffBook(name) { return DEFAULT_OFF_BOOKS.find((b) => b.name === name) || null; }
function defaultDefBook(name) { return DEFAULT_DEF_BOOKS.find((b) => b.name === name) || null; }

// ── Shipped sheet weights (M1 #23, 2026-08-17) ─────────────────────────────
// The formation's SHIPPED game-day weighting, merged across every starter
// book that carries it (highest weight wins where books disagree). Data only —
// the starter books above are the source; nothing here invents a number.
function shippedSheetWeights(formationId) {
  const out = {};
  for (const b of DEFAULT_OFF_BOOKS) {
    const s = b.sheets && b.sheets[formationId];
    if (!s) continue;
    for (const [c, w] of Object.entries(s)) out[c] = Math.max(out[c] || 0, typeof w === "number" ? w : 0);
  }
  return out;
}
// Auto-select's seed sheet: every FITTING concept for the look (the one shared
// fits-function), weighted by the shipped sheets — NOT flat. Concepts a
// starter book features carry its weight; the rest sit at a modest base so
// the shipped identity stands out instead of a diluted everything-equal book.
var AUTO_SHEET_BASE_W = 40;
function autoSheetForFormation(formationId, variation) {
  const shipped = shippedSheetWeights(formationId);
  const sheet = {};
  for (const c of fittingConceptsForFormation(formationId, variation)) {
    sheet[c] = shipped[c] != null ? shipped[c] : AUTO_SHEET_BASE_W;
  }
  return sheet;
}

export { DEFAULT_OFF_BOOKS, DEFAULT_DEF_BOOKS, defaultOffBook, defaultDefBook, shippedSheetWeights, autoSheetForFormation };
