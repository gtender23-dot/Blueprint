// defcallpins.js — the defensive headset's per-snap PINS, with no DOM in sight.
//
// Lifted out of app.js on 2026-08-22 so it can be probed. The card->pins explode
// used to be a hand-kept list of fourteen field names living inside a 400-line
// render function, and it had quietly forgotten `bringSeats` — the extra
// rushers. Measured across the six shipped books: 29 of 71 calls drew five or
// six men rushing on their card and sent a base four at the snap. Nobody could
// have caught that with a test, because there was nothing importable to test.
//
// Now the explode copies the WHOLE call and lives here, where
// defcall_explode_probe can run it against every shipped call.

var DEF_CALL_ROWS = [
  ["front", "FRONT", [["4-3", "4-3"], ["3-4", "3-4"], ["Tite", "Tite"], ["Nickel", "Nickel"], ["Big Nickel", "Big Nickel"], ["3-3-5", "3-3-5"], ["Penny", "Penny"], ["Dime", "Dime"], ["4-4", "4-4"], ["46/Bear", "46/Bear"], ["5-2", "5-2"]]],
  ["aggression", "PRESSURE", [["bend", "Bend"], ["selective", "Selective"], ["balanced", "Balanced"], ["attacking", "Attacking"], ["house", "House"]]],
  ["covShell", "SHELL", [["single", "Single-high"], ["two", "Two-high"]]],
  ["covStyle", "STYLE", [["man", "Man"], ["zone", "Zone"]]],
  ["edgePlay", "EDGE", [["contain", "Set it"], ["crash", "Crash"]]],
  ["robberCall", "ROBBER", [["rob", "Rob the middle"], ["overtop", "Stay over top"]]],
  ["zoneStyle", "ZONE RULES", [["spot", "Spot-drop"], ["match", "Match"]]],
  ["runCommit", "BOX", [["-8", "Lighten \u22128"], ["8", "Commit +8"]]],
  ["pressureIdentity", "HEAT SHAPE", [["fireZone", "Fire Zone"], ["secondLevel", "2nd Level"], ["secondaryHeat", "DB Heat"], ["theHouse", "The House"]]]
];


function _dcDialFields() {
  return new Set(DEF_CALL_ROWS.map(([f]) => f));
}
function _dcExplode(call, standingRC) {
  const sel = {};
  if (!call) return sel;
  const dials = _dcDialFields();
  for (const [f, v] of Object.entries(call)) {
    if (v == null || v === "auto") continue;
    if (f === "runCommit") { sel.runCommit = String(v - (standingRC || 0)); continue; }
    sel[f] = dials.has(f) ? String(v) : v;
  }
  return sel;
}
function _dcSameSel(a, b) {
  const ka = Object.keys(a || {}), kb = Object.keys(b || {});
  if (ka.length !== kb.length) return false;
  return ka.every((k) => String(a[k]) === String((b || {})[k]));
}

export { DEF_CALL_ROWS, _dcDialFields, _dcExplode, _dcSameSel };
