import { legalConceptsForFormation, emptyPlaybook, validatePlaybook } from './playbook.js';
import { emptyDefBook, emptyDefCard, validateDefBook } from './defbook.js';

// ── The starter book library (Ref/DEFENSIVE_PLAYBOOK_V2.md §5, Aug 2026) ────
// Six COMPLETE books a side. A new player never faces an empty book: pick one,
// open it in its Builder, edit anything, "Save as my own". Every sheet entry is
// filtered through the CURRENT legality tables at module load, so a renamed or
// removed concept can never make a starter book invalid — the book just loses
// that entry. These are data, not code: balance lives in the engine's tables.

// helper: sheet from desired concepts ∩ the formation's legal list
function sheet(fid, names, w = 55) {
  const legal = new Set(legalConceptsForFormation(fid));
  const out = {};
  for (const n of names) if (legal.has(n)) out[n] = w;
  return out;
}
function offBook(name, formations, sheets, extras) {
  const pb = { ...emptyPlaybook(name), formations, sheets };
  if (extras) Object.assign(pb, extras);
  return pb;
}
var DEFAULT_OFF_BOOKS = [
  offBook("Air Raid",
    [{ id: "Air Raid", weight: 40 }, { id: "Air Raid", weight: 15, variation: "empty" }, { id: "Spread", weight: 30 }, { id: "Empty", weight: 15 }],
    {
      "Air Raid": sheet("Air Raid", ["Four Verts", "Mesh", "Shallow Cross", "Y-Cross", "Stick", "Hoss", "Bubble Screen"]),
      "Spread": sheet("Spread", ["Mesh", "Four Verts", "Slant-Flat", "Stick", "Tunnel Screen", "Inside Zone"]),
      "Empty": sheet("Empty", ["Spacing", "Stick", "Four Verts", "Double Slants", "Bubble Screen"])
    }, { tendency: "Heavy Pass", rushInPct: 45, passDepth: { short: 40, medium: 38, deep: 22 } }),
  offBook("Ground & Pound",
    [{ id: "Power-I", weight: 40 }, { id: "Power-I", weight: 15, variation: "big" }, { id: "Single Back", weight: 25 }, { id: "Jumbo", weight: 20 }],
    {
      "Power-I": sheet("Power-I", ["Power", "Iso", "Counter", "Toss", "Boot", "PA Deep Cross", "Buck Sweep"]),
      "Single Back": sheet("Single Back", ["Inside Zone", "Outside Zone", "Power", "Boot", "Y-Cross"]),
      "Jumbo": sheet("Jumbo", ["Power", "Iso", "QB Sneak", "Dive", "PA Deep Cross"])
    }, { tendency: "Heavy Run", rushInPct: 62 }),
  offBook("West Coast",
    [{ id: "Single Back", weight: 35 }, { id: "Spread", weight: 25 }, { id: "Trips/Bunch", weight: 25 }, { id: "Power-I", weight: 15, variation: "twins" }],
    {
      "Single Back": sheet("Single Back", ["Drive", "Slant-Flat", "Stick", "Y-Option", "Outside Zone", "Boot"]),
      "Spread": sheet("Spread", ["Slant-Flat", "Drive", "Levels", "Whip", "Inside Zone"]),
      "Trips/Bunch": sheet("Trips/Bunch", ["Spot", "Flood", "Whip", "Follow", "Tunnel Screen"]),
      "Power-I": sheet("Power-I", ["Boot", "PA Deep Cross", "Power", "Curl-Flat"])
    }, { tendency: "Balanced", passDepth: { short: 48, medium: 36, deep: 16 } }),
  offBook("Spread Option",
    [{ id: "Pistol/RPO", weight: 40 }, { id: "Spread", weight: 30 }, { id: "Pistol/RPO", weight: 15, variation: "trips" }, { id: "Flexbone", weight: 15 }],
    {
      "Pistol/RPO": sheet("Pistol/RPO", ["Inside Zone", "Speed Option", "QB Power", "Slant-Flat", "Bubble Screen", "Stick"]),
      "Spread": sheet("Spread", ["Inside Zone", "Draw", "Mesh", "Slant-Flat", "Jet Sweep"]),
      "Flexbone": sheet("Flexbone", ["Triple Option", "Speed Option", "Toss", "PA Deep Cross"])
    }, { tendency: "Run", rushInPct: 58 }),
  offBook("Pro Balanced",
    [{ id: "Single Back", weight: 30 }, { id: "Power-I", weight: 25 }, { id: "Spread", weight: 25 }, { id: "Trips/Bunch", weight: 20 }],
    {
      "Single Back": sheet("Single Back", ["Inside Zone", "Outside Zone", "Dagger", "Curl-Flat", "Boot"]),
      "Power-I": sheet("Power-I", ["Power", "Counter", "PA Deep Cross", "Comeback"]),
      "Spread": sheet("Spread", ["Four Verts", "Smash", "Stick", "Draw"]),
      "Trips/Bunch": sheet("Trips/Bunch", ["Flood", "Sail", "Spot", "Jet Sweep"])
    }, { tendency: "Balanced" }),
  offBook("Triple Option",
    [{ id: "Flexbone", weight: 45 }, { id: "Wishbone", weight: 30 }, { id: "Flexbone", weight: 15, variation: "trips" }, { id: "Power-I", weight: 10 }],
    {
      "Flexbone": sheet("Flexbone", ["Triple Option", "Speed Option", "Counter", "Toss", "PA Deep Cross"]),
      "Wishbone": sheet("Wishbone", ["Triple Option", "Dive", "Counter", "Power", "PA Deep Cross"]),
      "Power-I": sheet("Power-I", ["Power", "Iso", "Boot"])
    }, { tendency: "Heavy Run", rushInPct: 68 })
];

// defense — a card helper: name + the three big choices (+ coach-mode extras)
function dcard(name, front, coverage, bring, look, extra) {
  return { ...emptyDefCard(name), front, coverage, bring, look: look || null, ...(extra || {}) };
}
function defBookOf(name, identity, shelves, answers) {
  return { ...emptyDefBook(name), ...identity, shelves, answers: answers || {} };
}
var DEFAULT_DEF_BOOKS = [
  defBookOf("Balanced Pro",
    { baseFront: "4-3", frontMix: { "4-3": 55, "Nickel": 45 }, coverageScheme: "balanced", aggression: "balanced", pressIdentity: "fireZone" },
    {
      base: [dcard("Sky 3", "4-3", "c3", "4", null), dcard("Under 2", "4-3", "c2", "4", null)],
      passing: [dcard("Nickel 3", "Nickel", "c3", "4", null), dcard("Rush 3 Shell", "Dime", "tampa2", "3", null)],
      short: [dcard("Load the Box", "4-3", "c1", "5", "secondLevel", { runCommit: 12 })],
      gamble: [dcard("Fire Zone", "Nickel", "c3", "5", "fireZone")],
      protect: [dcard("Keep It Front", "Dime", "prevent", "3", null)]
    }, { heavy: "Load the Box", empty: "Nickel 3" }),
  defBookOf("Attack 3-4",
    { baseFront: "3-4", frontMix: { "3-4": 60, "Nickel": 40 }, coverageScheme: "aggressive", aggression: "attacking", pressIdentity: "fireZone" },
    {
      base: [dcard("34 Sky", "3-4", "c3", "4", "fireZone"), dcard("34 Press 1", "3-4", "c1", "5", "secondLevel")],
      passing: [dcard("Zone Dog", "Nickel", "c3", "5", "fireZone"), dcard("Trap 2", "Nickel", "c2", "4", null)],
      short: [dcard("Bear Down", "46/Bear", "c1", "5", "secondLevel", { runCommit: 15 })],
      gamble: [dcard("Zero", "3-4", "c1", "6", "theHouse"), dcard("Safety Heat", "3-4", "c3", "5", "secondaryHeat")],
      protect: [dcard("Soft Shell", "Dime", "prevent", "3", null)]
    }, { heavy: "Bear Down", option: "34 Sky" }),
  defBookOf("Bend-Don't-Break",
    { baseFront: "Nickel", frontMix: { "Nickel": 55, "4-3": 25, "Dime": 20 }, coverageScheme: "conservative", aggression: "bend", pressIdentity: "secondLevel" },
    {
      base: [dcard("Quarters Match", "Nickel", "c6", "4", null), dcard("Two Shell", "4-3", "c2", "4", null)],
      passing: [dcard("Tampa Wall", "Dime", "tampa2", "4", null), dcard("Drop 8", "Dime", "c3", "3", null)],
      short: [dcard("Base Stop", "4-3", "c1", "4", null, { runCommit: 8 })],
      gamble: [dcard("Change-Up Dog", "Nickel", "c3", "5", "fireZone")],
      protect: [dcard("Prevent", "Dime", "prevent", "3", null)]
    }, { empty: "Drop 8", "10": "Tampa Wall" }),
  defBookOf("Pressure Everything",
    { baseFront: "46/Bear", frontMix: { "46/Bear": 45, "3-4": 30, "Nickel": 25 }, coverageScheme: "aggressive", aggression: "house", pressIdentity: "theHouse", greenDog: true },
    {
      base: [dcard("Bear 1", "46/Bear", "c1", "5", "secondLevel"), dcard("34 Heat", "3-4", "c1", "5", "fireZone")],
      passing: [dcard("Nickel Zero", "Nickel", "c1", "6", "theHouse"), dcard("Sim Pressure", "Nickel", "c3", "4", "fireZone")],
      short: [dcard("All In", "46/Bear", "c1", "6", "theHouse", { runCommit: 18 })],
      gamble: [dcard("House Call", "46/Bear", "c1", "6", "theHouse"), dcard("Secondary Heat", "Big Nickel", "c1", "5", "secondaryHeat")],
      protect: [dcard("Late Shell", "Dime", "c2", "4", null)]
    }, { heavy: "All In", "11": "Bear 1" }),
  defBookOf("Coastal Cover 3",
    { baseFront: "Nickel", frontMix: { "Nickel": 60, "Big Nickel": 40 }, coverageScheme: "lockTop", aggression: "selective", pressIdentity: "fireZone" },
    {
      base: [dcard("Rip/Liz 3", "Nickel", "c3", "4", null), dcard("Big 3 Buzz", "Big Nickel", "c3", "4", null)],
      passing: [dcard("3 Cloud", "Nickel", "c3", "4", null), dcard("2-Man Lurk", "Nickel", "c2man", "4", null)],
      short: [dcard("Big Sky", "Big Nickel", "c1", "5", "secondLevel", { runCommit: 10 })],
      gamble: [dcard("Buzz Dog", "Nickel", "c3", "5", "fireZone")],
      protect: [dcard("3 Prevent", "Dime", "prevent", "3", null)]
    }, { "12": "Big 3 Buzz", heavy: "Big Sky" }),
  defBookOf("Option Killer",
    { baseFront: "4-4", frontMix: { "4-4": 45, "5-2": 30, "4-3": 25 }, coverageScheme: "balanced", aggression: "balanced", pressIdentity: "secondLevel", spyQB: true },
    {
      base: [dcard("Assignment 44", "4-4", "c3", "4", null, { edgePlay: "contain" }), dcard("52 Wall", "5-2", "c1", "4", null, { edgePlay: "contain" })],
      passing: [dcard("Base 3", "4-3", "c3", "4", null)],
      short: [dcard("Gap Sound", "5-2", "c1", "5", "secondLevel", { runCommit: 14, edgePlay: "contain" })],
      gamble: [dcard("Crash Change-Up", "4-4", "c1", "5", "secondLevel", { edgePlay: "crash" })],
      protect: [dcard("Two High", "Nickel", "c2", "4", null)]
    }, { option: "Assignment 44", heavy: "Gap Sound" })
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

export { DEFAULT_OFF_BOOKS, DEFAULT_DEF_BOOKS, defaultOffBook, defaultDefBook };
