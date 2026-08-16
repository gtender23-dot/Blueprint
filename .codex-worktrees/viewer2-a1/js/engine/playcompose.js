import { PASS_CONCEPTS } from '../concepts.js';
import { FORMATION_PLAYBOOK, aliasFormation } from '../constants.js';

// ── Play Composer — Model B-i: grades DERIVED from route parts ─────────────
// The headline composer (owner-ruled 2026-08-13, Ref/PLAY_COMPOSER.md). The
// author assembles a play from ROUTE PARTS; a FIXED, non-editable parts→grade
// rulebook derives the concept's `vs` table and `exec` weights. The author never
// types a coefficient — grades come from this balancing artifact — so a composed
// play is realistic AND cannot be tuned into an exploit. Two safety properties,
// both provable in the probe:
//   1. BAND — every derived grade is clamped to the catalog's observed range
//      [BAND_LO, BAND_HI]; a play can't be stronger than the strongest shipped
//      concept, no matter how its parts stack.
//   2. AI-INVISIBLE — this module NEVER writes to PASS_CONCEPTS. The AI's
//      pickPassConcept only iterates PASS_CONCEPTS, so composed plays are
//      human-call-only by construction (the extra safety belt B-ii kept). The
//      live forced-call wiring + Composer UI are the browser-gated next step.
//
// v1 is PASSES (owner Q4); runs (vsBox) are a later add.
var PLAYCOMPOSE_SCHEMA_VERSION = 1;
var BAND_LO = -0.09, BAND_HI = 0.1;
var COVERAGES = ["Cover 0", "Cover 1", "Cover 2-Man", "Cover 2", "Cover 3", "Cover 4", "C3 Fire Zone", "Cover 6", "Tampa 2", "Prevent"];

// Each route part carries a depth (3 deep / 2 medium / 1 short / 0.5 behind LOS),
// whether it occupies a wide receiver (drives minWR), whether it's a man-rub
// crosser (drives the man-beater combo bonus), and its per-coverage tendency —
// pure football: verticals beat single-high and lose to two-deep, crossers beat
// man, curls sit in zones, quick game beats the fire-zone blitz, etc.
var ROUTE_PARTS = {
  go: { label: "Go / Streak", depth: 3, wide: true, cross: false, vs: { "Cover 0": 0.03, "Cover 1": 0.03, "Cover 2-Man": 0.015, "Cover 3": 0.02, "Cover 2": -0.02, "Cover 4": -0.025, "Cover 6": -0.02, "Tampa 2": -0.02, "Prevent": -0.03, "C3 Fire Zone": -0.02 } },
  post: { label: "Post", depth: 3, wide: true, cross: false, vs: { "Cover 0": 0.02, "Cover 1": 0.03, "Cover 3": 0.03, "Cover 2": -0.015, "Cover 4": -0.025, "Cover 6": -0.015, "Tampa 2": -0.02, "Prevent": -0.02, "C3 Fire Zone": -0.015 } },
  corner: { label: "Corner", depth: 3, wide: true, cross: false, vs: { "Cover 1": -0.005, "Cover 2": 0.03, "Cover 3": 0.02, "Tampa 2": 0.02, "Cover 6": 0.01, "Cover 4": -0.02, "Prevent": -0.01 } },
  dig: { label: "Dig (deep in)", depth: 2, wide: true, cross: false, vs: { "Cover 1": 0.015, "Cover 2": 0.02, "Cover 3": 0.025, "Cover 4": -0.01, "Tampa 2": -0.02, "C3 Fire Zone": -0.005 } },
  out: { label: "Out", depth: 2, wide: true, cross: false, vs: { "Cover 1": 0.015, "Cover 3": 0.03, "Cover 2": -0.02, "Cover 4": -0.01, "C3 Fire Zone": 0.005 } },
  curl: { label: "Curl / Hitch", depth: 2, wide: true, cross: false, vs: { "Cover 2": 0.015, "Cover 3": 0.025, "Cover 4": 0.02, "Cover 0": -0.015, "Cover 1": -0.015, "C3 Fire Zone": -0.005 } },
  slant: { label: "Slant", depth: 1, wide: true, cross: true, vs: { "Cover 0": 0.03, "Cover 1": 0.025, "Cover 3": 0.015, "Cover 2": -0.01, "C3 Fire Zone": 0.02 } },
  drag: { label: "Drag / Crosser", depth: 1, wide: true, cross: true, vs: { "Cover 0": 0.03, "Cover 1": 0.03, "Cover 2-Man": 0.03, "Cover 3": 0.01, "Cover 4": -0.005, "C3 Fire Zone": 0.015 } },
  flat: { label: "Flat / Arrow", depth: 1, wide: true, cross: false, vs: { "Cover 0": 0.03, "Cover 1": 0.01, "Cover 3": 0.02, "Cover 2": -0.015, "C3 Fire Zone": 0.015 } },
  wheel: { label: "Wheel", depth: 3, wide: true, cross: false, vs: { "Cover 0": 0.02, "Cover 1": 0.03, "Cover 3": 0.02, "Cover 2": -0.01, "Cover 4": -0.02, "C3 Fire Zone": -0.005 } },
  screen: { label: "Screen / Bubble", depth: 0.5, wide: false, cross: false, vs: { "Cover 0": 0.035, "Cover 3": 0.015, "Prevent": 0.02, "Cover 4": -0.01, "Tampa 2": -0.005, "C3 Fire Zone": 0.025 } },
  checkdown: { label: "Checkdown", depth: 0.5, wide: false, cross: false, vs: { "Cover 0": 0.02, "Cover 1": 0.005, "Prevent": 0.005, "C3 Fire Zone": 0.01 } }
};
var PART_IDS = Object.keys(ROUTE_PARTS);
var MIN_PARTS = 2, MAX_PARTS = 5;

function round2(x) {
  return Math.round(x * 100) / 100;
}
function clampBand(x) {
  return Math.max(BAND_LO, Math.min(BAND_HI, x));
}
function routePartList() {
  return PART_IDS.map((id) => ({ id, label: ROUTE_PARTS[id].label, depth: ROUTE_PARTS[id].depth }));
}
function emptyComposedPlay(name) {
  return { schemaVersion: PLAYCOMPOSE_SCHEMA_VERSION, name: String(name || "New Play").slice(0, 36), kind: "pass", parts: [], formations: [] };
}
function validateComposedPlay(cp) {
  const errors = [], warnings = [];
  if (!cp || typeof cp !== "object") return { ok: false, errors: ["composed play must be an object"], warnings };
  if (typeof cp.name !== "string" || !cp.name.trim()) warnings.push("composed play has no name");
  if (cp.kind && cp.kind !== "pass") errors.push('v1 composes passes only (kind must be "pass")');
  const parts = Array.isArray(cp.parts) ? cp.parts : null;
  if (!parts) { errors.push("parts must be an array"); return { ok: false, errors, warnings }; }
  if (parts.length < MIN_PARTS) errors.push(`a play needs at least ${MIN_PARTS} route parts`);
  if (parts.length > MAX_PARTS) errors.push(`a play can have at most ${MAX_PARTS} route parts`);
  for (const p of parts) if (!ROUTE_PARTS[p]) errors.push(`unknown route part "${p}"`);
  if (cp.formations != null) {
    if (!Array.isArray(cp.formations)) errors.push("formations must be an array");
    else for (const fid of cp.formations) if (!FORMATION_PLAYBOOK[aliasFormation(fid)]) errors.push(`unknown formation "${fid}"`);
  }
  const wide = parts ? parts.filter((p) => ROUTE_PARTS[p] && ROUTE_PARTS[p].wide).length : 0;
  if (parts && parts.length >= MIN_PARTS && wide === 0) warnings.push("no wide-receiver routes — this play never threatens downfield");
  return { ok: errors.length === 0, errors, warnings };
}
// The rulebook. authored parts → a concept-shaped object with DERIVED, clamped
// grades. The author's only input is the part list; every number below is fixed.
function compilePlay(cp) {
  const v = validateComposedPlay(cp);
  if (!v.ok) throw new Error(`compilePlay: invalid composed play — ${v.errors[0]}`);
  const parts = cp.parts;
  // 1. sum each part's per-coverage tendency
  const vs = {};
  for (const cov of COVERAGES) vs[cov] = 0;
  for (const p of parts) {
    const part = ROUTE_PARTS[p];
    for (const [cov, d] of Object.entries(part.vs)) vs[cov] += d;
  }
  // 2. combination bonuses — reward real concept design
  const hasDeep = parts.some((p) => ROUTE_PARTS[p].depth >= 3);
  const hasUnder = parts.some((p) => ROUTE_PARTS[p].depth <= 1);
  const crossers = parts.filter((p) => ROUTE_PARTS[p].cross).length;
  const depthBuckets = new Set(parts.map((p) => {
    const d = ROUTE_PARTS[p].depth;
    return d >= 3 ? "d" : d >= 2 ? "m" : d >= 1 ? "s" : "b";
  }));
  if (hasDeep && hasUnder) { // vertical stretch / high-low beats zone
    for (const [cov, b] of Object.entries({ "Cover 2": 0.02, "Cover 3": 0.02, "Cover 4": 0.015, "Cover 6": 0.015, "Tampa 2": 0.015 })) vs[cov] += b;
  }
  if (crossers >= 2) { // rub / mesh beats man
    for (const [cov, b] of Object.entries({ "Cover 0": 0.02, "Cover 1": 0.02, "Cover 2-Man": 0.02 })) vs[cov] += b;
  }
  if (parts.length >= 4 && depthBuckets.size >= 3) { // flood / full-field stretch
    vs["Cover 3"] += 0.015;
    vs["Cover 2"] += 0.01;
  }
  // 3. clamp every grade into the catalog band — the hard balance guarantee
  for (const cov of COVERAGES) vs[cov] = round2(clampBand(vs[cov]));
  // 4. structural fields derived from the part mix
  const wide = parts.filter((p) => ROUTE_PARTS[p].wide).length;
  const minWR = Math.max(1, Math.min(4, wide));
  const avgDepth = parts.reduce((a, p) => a + ROUTE_PARTS[p].depth, 0) / parts.length;
  const depth = avgDepth >= 2.3 ? "deep" : avgDepth >= 1.4 ? "medium" : "short";
  const deepShare = parts.filter((p) => ROUTE_PARTS[p].depth >= 3).length / parts.length;
  const shortShare = parts.filter((p) => ROUTE_PARTS[p].depth <= 1).length / parts.length;
  const qbTEC = round2(Math.max(0.3, Math.min(0.7, 0.35 + 0.3 * shortShare)));
  const wrSPD = round2(Math.max(0.3, Math.min(0.7, 0.3 + 0.4 * deepShare)));
  const exec = {
    QB: { AWR: round2(1 - qbTEC), TEC: qbTEC },
    WR: { SPD: wrSPD, TEC: round2(1 - wrSPD) }
  };
  return { depth, minWR, vs, exec, name: cp.name, _composedOf: parts.slice() };
}

// Load-time repair: drop route parts / formations that no longer exist. If too
// few valid parts remain to build a play, ok:false (unrepairable — the UI should
// offer to open it for re-composition rather than silently use a broken play).
function repairComposedPlay(cp) {
  const changes = [];
  const src = cp && typeof cp === "object" ? cp : {};
  const parts = (Array.isArray(src.parts) ? src.parts : []).filter((p) => {
    if (ROUTE_PARTS[p]) return true;
    changes.push(`dropped route part "${p}" (no longer exists)`);
    return false;
  });
  const formations = (Array.isArray(src.formations) ? src.formations : []).filter((fid) => {
    if (FORMATION_PLAYBOOK[aliasFormation(fid)]) return true;
    changes.push(`dropped formation "${fid}" (no longer exists)`);
    return false;
  });
  const out = { schemaVersion: PLAYCOMPOSE_SCHEMA_VERSION, name: String(src.name || "Play").slice(0, 36), kind: "pass", parts, formations };
  const ok = parts.length >= MIN_PARTS;
  if (!ok) changes.push(`only ${parts.length} valid route part(s) remain (need ${MIN_PARTS}) — play needs rebuilding`);
  return { cp: out, changes, ok };
}

export { PLAYCOMPOSE_SCHEMA_VERSION, BAND_LO, BAND_HI, COVERAGES, ROUTE_PARTS, routePartList, emptyComposedPlay, validateComposedPlay, compilePlay, repairComposedPlay };
