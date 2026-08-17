import { PASS_CONCEPTS, RUN_CONCEPTS } from '../concepts.js';
import { FORMATION_PLAYBOOK, aliasFormation } from '../constants.js';
import { OFF_FIELD_LAYOUTS } from '../constants_field.js';

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
// v1 was PASSES (owner Q4). D4/M2 (2026-08-16) grew the composer RUNS — the
// rest of #37 — under the same two laws: a composed run is a PATH (where the
// ball is aimed) + a BLOCKING-SCHEME signature (how the line gets it there) +
// a CARRIER, graded by the fixed tables below and clamped to the band observed
// across the shipped RUN_CONCEPTS catalog. Blocking assignments on PASS plays
// also bite now: a tight end or back the author keeps home is compiled into
// `keepIn`, which the sim's protection assembly honors (a kept body is a
// blocker, not a receiver — the play already paid for that in routes).
var PLAYCOMPOSE_SCHEMA_VERSION = 2;
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

// ── Run authoring (D4/M2) — the fixed path + scheme tables ────────────────
// The author picks a PATH (aim point), a SCHEME (blocking signature) and a
// CARRIER; every number below is fixed, exactly like ROUTE_PARTS. `gap` and
// `stretch` are CARD-space drawing hints (the run card's aim), not grades.
var RUN_PATHS = {
  inside:    { label: "Inside — downhill at the A-gap", type: "run_inside",  gap: 0.10,                vsBox: { loaded: -0.02, light: 0.04 } },
  offtackle: { label: "Off-tackle",                     type: "run_inside",  gap: 0.22,                vsBox: { loaded: 0,     light: 0.03 } },
  outside:   { label: "Outside stretch",                type: "run_outside", gap: 0.30, stretch: 0.22, vsBox: { loaded: -0.01, light: 0.04 } },
  toss:      { label: "Toss / pitch",                   type: "run_outside", gap: 0.36, stretch: 0.30, pitch: true, vsBox: { loaded: -0.02, light: 0.04 } },
  draw:      { label: "Delayed draw",                   type: "run_inside",  gap: 0.10, delay: true,   vsBox: { loaded: -0.02, light: 0.03 } }
};
// The blocking-scheme signature. `pulls` is the SAME flag the shipped run
// catalog carries — the sim's gap/zone fork (buildRunScheme) and the pull-rep
// machinery read it identically for a composed run.
var RUN_SCHEMES = {
  zone: { label: "Zone — reach and climb",       adj: { loaded: 0,    light: 0.01 } },
  gap:  { label: "Gap — pull and kick out",      pulls: true, adj: { loaded: 0.02, light: -0.01 } },
  trap: { label: "Trap — let him through",       pulls: true, trap: true, adj: { loaded: 0.01, light: 0 } },
  lead: { label: "Lead — a back through first",  lead: true,  adj: { loaded: 0.01, light: 0 } }
};
var RUN_PATH_IDS = Object.keys(RUN_PATHS);
var RUN_SCHEME_IDS = Object.keys(RUN_SCHEMES);
var RUN_CARRIERS = ["RB", "QB"];
// The run band is DERIVED from the shipped catalog at load, never hand-typed
// here — rebalance RUN_CONCEPTS and this follows. Same guarantee as BAND_LO/HI:
// a composed run can never outgrade the strongest shipped run.
var RUN_BAND_LO = 0, RUN_BAND_HI = 0;
for (const _rc of Object.values(RUN_CONCEPTS)) {
  if (!_rc.vsBox) continue;
  for (const _v of [_rc.vsBox.loaded || 0, _rc.vsBox.light || 0]) {
    if (_v < RUN_BAND_LO) RUN_BAND_LO = _v;
    if (_v > RUN_BAND_HI) RUN_BAND_HI = _v;
  }
}
function runPathList() {
  return RUN_PATH_IDS.map((id) => ({ id, label: RUN_PATHS[id].label }));
}
function runSchemeList() {
  return RUN_SCHEME_IDS.map((id) => ({ id, label: RUN_SCHEMES[id].label }));
}
// The run card's drawing parameters for a composed run — the same vocabulary
// routeart's _RUN_PARAM speaks (gap/stretch/pull/lead/pitch/delay/qb), derived
// from the authored path + scheme so the card IS the play.
function runCardParam(runSpec) {
  const r = runSpec || {};
  const path = RUN_PATHS[r.path] || RUN_PATHS.inside;
  const sch = RUN_SCHEMES[r.scheme] || RUN_SCHEMES.zone;
  const out = { gap: path.gap };
  if (path.stretch) out.stretch = path.stretch;
  if (path.pitch) out.pitch = true;
  if (path.delay) out.delay = true;
  if (sch.pulls) out.pull = true;
  if (sch.trap) out.trap = true;
  if (sch.lead) out.lead = true;
  if (r.carrier === "QB") out.qb = true;
  return out;
}

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
  return { schemaVersion: PLAYCOMPOSE_SCHEMA_VERSION, name: String(name || "New Play").slice(0, 36), kind: "pass", parts: [], assigns: [], blocks: [], formations: [] };
}
function validateComposedPlay(cp) {
  const errors = [], warnings = [];
  if (!cp || typeof cp !== "object") return { ok: false, errors: ["composed play must be an object"], warnings };
  if (typeof cp.name !== "string" || !cp.name.trim()) warnings.push("composed play has no name");
  if (cp.kind && cp.kind !== "pass" && cp.kind !== "run") errors.push('kind must be "pass" or "run"');
  if (cp.formations != null) {
    if (!Array.isArray(cp.formations)) errors.push("formations must be an array");
    else for (const fid of cp.formations) if (!FORMATION_PLAYBOOK[aliasFormation(fid)]) errors.push(`unknown formation "${fid}"`);
  }
  if (cp.kind === "run") {
    // A composed run is path + scheme + carrier; route parts don't apply.
    const r = cp.run && typeof cp.run === "object" ? cp.run : null;
    if (!r) errors.push("a run play needs its path and blocking scheme (cp.run)");
    else {
      if (!RUN_PATHS[r.path]) errors.push(`unknown run path "${r.path}"`);
      if (!RUN_SCHEMES[r.scheme]) errors.push(`unknown blocking scheme "${r.scheme}"`);
      if (r.carrier != null && !RUN_CARRIERS.includes(r.carrier)) errors.push(`unknown carrier "${r.carrier}"`);
    }
    if (Array.isArray(cp.parts) && cp.parts.length) errors.push("a run play carries no route parts — the path and the blocking are the play");
    return { ok: errors.length === 0, errors, warnings };
  }
  const parts = Array.isArray(cp.parts) ? cp.parts : null;
  if (!parts) { errors.push("parts must be an array"); return { ok: false, errors, warnings }; }
  if (parts.length < MIN_PARTS) errors.push(`a play needs at least ${MIN_PARTS} route parts`);
  if (parts.length > MAX_PARTS) errors.push(`a play can have at most ${MAX_PARTS} route parts`);
  for (const p of parts) if (!ROUTE_PARTS[p]) errors.push(`unknown route part "${p}"`);
  const wide = parts ? parts.filter((p) => ROUTE_PARTS[p] && ROUTE_PARTS[p].wide).length : 0;
  if (parts && parts.length >= MIN_PARTS && wide === 0) warnings.push("no wide-receiver routes — this play never threatens downfield");
  return { ok: errors.length === 0, errors, warnings };
}
// The rulebook. authored parts → a concept-shaped object with DERIVED, clamped
// grades. The author's only input is the part list; every number below is fixed.
function compilePlay(cp) {
  const v = validateComposedPlay(cp);
  if (!v.ok) throw new Error(`compilePlay: invalid composed play — ${v.errors[0]}`);
  if (cp.kind === "run") return _compileRunPlay(cp);
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
  // D4/M2: blocking assignments BITE. A tight end or back the author kept
  // home (cp.blocks) compiles into `keepIn` — the sim's protection assembly
  // keeps THOSE bodies in instead of rolling its dice. Wide receivers who
  // block simply don't run a route (the play already paid in parts); no
  // protection credit, so there is nothing here to over-tune.
  const keepIn = { TE: 0, RB: 0 };
  const _fid0 = Array.isArray(cp.formations) && cp.formations[0] ? aliasFormation(cp.formations[0]) : null;
  const _lay0 = _fid0 ? OFF_FIELD_LAYOUTS[_fid0] : null;
  if (_lay0 && Array.isArray(cp.blocks)) {
    for (const b of cp.blocks) {
      const s = _lay0.slots.find((x) => x.id === b);
      if (!s) continue;
      if (s.pos === "TE") keepIn.TE++;
      else if (s.pos === "RB" || s.pos === "WING" || s.pos === "ABACK") keepIn.RB++;
    }
  }
  const out = { depth, minWR, vs, exec, name: cp.name, _composedOf: parts.slice() };
  if (keepIn.TE || keepIn.RB) out.keepIn = keepIn;
  return out;
}
// The run half of the rulebook: path.vsBox + scheme.adj, clamped to the band
// observed across the shipped RUN_CONCEPTS. Emits the SAME concept-shaped
// fields pickRunConcept's pool carries (type/vsBox/pulls/qbCarry/exec), so the
// sim's _conceptCtx.def reads a composed run exactly like a catalog run.
function _compileRunPlay(cp) {
  const r = cp.run;
  const path = RUN_PATHS[r.path], sch = RUN_SCHEMES[r.scheme];
  const clampRun = (x) => Math.max(RUN_BAND_LO, Math.min(RUN_BAND_HI, x));
  const vsBox = {
    loaded: round2(clampRun((path.vsBox.loaded || 0) + (sch.adj.loaded || 0))),
    light: round2(clampRun((path.vsBox.light || 0) + (sch.adj.light || 0)))
  };
  const qb = r.carrier === "QB";
  const exec = {
    OL: sch.pulls ? { STR: 0.6, TEC: 0.4 } : sch.lead ? { STR: 0.5, TEC: 0.5 } : { TEC: 0.6, AGI: 0.4 },
    RB: path.type === "run_outside" ? { SPD: 0.6, AGI: 0.4 } : path.delay ? { AWR: 0.6, AGI: 0.4 } : { AWR: 0.5, AGI: 0.5 }
  };
  if (qb) exec.QB = { SPD: 0.6, STR: 0.4 };
  const out = { type: path.type, vsBox, exec, minWR: 0, name: cp.name, _composedRun: { path: r.path, scheme: r.scheme, carrier: qb ? "QB" : "RB" } };
  if (sch.pulls) out.pulls = true;
  if (qb) out.qbCarry = true;
  return out;
}

// Load-time repair: drop route parts / formations that no longer exist. If too
// few valid parts remain to build a play, ok:false (unrepairable — the UI should
// offer to open it for re-composition rather than silently use a broken play).
function repairComposedPlay(cp) {
  const changes = [];
  const src = cp && typeof cp === "object" ? cp : {};
  const rawParts = Array.isArray(src.parts) ? src.parts : [];
  const rawAssigns = Array.isArray(src.assigns) ? src.assigns : [];
  // Keep parts and their aligned diagram metadata (who the route is for + flip)
  // together, so a surviving route keeps its assignment. assigns are cosmetic —
  // they never touch the grade rulebook — so an unknown slot is left as-is (the
  // renderer falls back to auto if the formation no longer has it).
  const parts = [], assigns = [];
  rawParts.forEach((p, i) => {
    if (ROUTE_PARTS[p]) {
      parts.push(p);
      const a = rawAssigns[i] && typeof rawAssigns[i] === "object" ? rawAssigns[i] : {};
      assigns.push({ slot: a.slot || null, flip: !!a.flip });
    } else changes.push(`dropped route part "${p}" (no longer exists)`);
  });
  const formations = (Array.isArray(src.formations) ? src.formations : []).filter((fid) => {
    if (FORMATION_PLAYBOOK[aliasFormation(fid)]) return true;
    changes.push(`dropped formation "${fid}" (no longer exists)`);
    return false;
  });
  // blocks: which formation slots stay in to block (pass: diagram + keepIn;
  // run: the whole cast blocks for the carrier)
  const blocks = (Array.isArray(src.blocks) ? src.blocks : []).filter((b) => typeof b === "string");
  // D4/M2: a composed RUN repairs through its own lane — the path/scheme
  // tables are the play, so a dead table id means the play needs rebuilding.
  if (src.kind === "run") {
    const rr = src.run && typeof src.run === "object" ? src.run : {};
    const runOk = !!(RUN_PATHS[rr.path] && RUN_SCHEMES[rr.scheme]);
    if (!runOk) changes.push(`run path/scheme no longer exists ("${rr.path}"/"${rr.scheme}") — play needs rebuilding`);
    const run = runOk ? { path: rr.path, scheme: rr.scheme, carrier: RUN_CARRIERS.includes(rr.carrier) ? rr.carrier : "RB" } : null;
    const outR = { schemaVersion: PLAYCOMPOSE_SCHEMA_VERSION, name: String(src.name || "Play").slice(0, 36), kind: "run", run, parts: [], assigns: [], blocks, formations };
    return { cp: outR, changes, ok: runOk };
  }
  const out = { schemaVersion: PLAYCOMPOSE_SCHEMA_VERSION, name: String(src.name || "Play").slice(0, 36), kind: "pass", parts, assigns, blocks, formations };
  const ok = parts.length >= MIN_PARTS;
  if (!ok) changes.push(`only ${parts.length} valid route part(s) remain (need ${MIN_PARTS}) — play needs rebuilding`);
  return { cp: out, changes, ok };
}

export { PLAYCOMPOSE_SCHEMA_VERSION, BAND_LO, BAND_HI, COVERAGES, ROUTE_PARTS, routePartList, emptyComposedPlay, validateComposedPlay, compilePlay, repairComposedPlay, RUN_PATHS, RUN_SCHEMES, RUN_CARRIERS, RUN_BAND_LO, RUN_BAND_HI, runPathList, runSchemeList, runCardParam };
