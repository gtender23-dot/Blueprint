import { FORMATIONS, FORMATION_PACKAGES, FORMATION_PLAYBOOK, aliasFormation } from '../constants.js';
import { OFF_FIELD_LAYOUTS, OL_SLOTS } from '../constants_field.js';
import { filterConceptsForPersonnel } from './playbook.js';

// ── Formation Composer — Stage 7 of the Playbook-Root refactor ──────────────
// (Ref/PLAYBOOK_ROOT_ARCHITECTURE.md Stage 7; Ref/CREATOR_FIDELITY.md item 5:
// "one registry object, an alignment-legality validator, derived balance via a
// fixed rulebook — and the art comes free".)
//
// A customFormation is AUTHORED as five skill placements over a fixed core
// (the standard OL five plus a QB depth). The author never touches a number
// the sim consumes: every balance-bearing derivation comes from the FIXED
// rulebook below —
//   * the package is counted from the placed positions;
//   * the identity/lean row is inherited VERBATIM from the nearest built-in
//     ARCHETYPE (same personnel family), so a custom formation's leans always
//     live inside the shipped envelope;
//   * the legal call list is the archetype's book FILTERED DOWN (minWR,
//     backfield structure) — always a SUBSET of a shipped formation's book,
//     never a superset;
//   * matchup edges and situational mods are NONE (neutral 1.0 everywhere —
//     the tables simply carry no row, and every reader defaults to 1). A
//     custom formation cannot be tuned into an exploit BY CONSTRUCTION.
// AI stays blind the same way the composer's plays do: nothing here writes a
// custom formation into any AI author's choices — setAIGameplan picks from
// its own built-in lists; a custom formation reaches a game only inside a
// HUMAN-loaded book/plan.
//
// The REGISTRY seam: the sim, the UI and the viewer already read one set of
// tables by formation id (FORMATIONS / FORMATION_PACKAGES / FORMATION_PLAYBOOK
// / OFF_FIELD_LAYOUTS — plus per-id extras that all default safely).
// syncCustomFormations() installs a compiled formation's four rows into those
// live tables (and removes rows for deleted creations), so every existing
// surface — Playbook Builder cards, the Game Plan, the call sheet's pins, the
// depth-chart field assignments, resolveOffField, the watch board — picks a
// custom formation up with ZERO further wiring. Registration is data-only,
// idempotent, and never touches a built-in id.
//
//   { schemaVersion, name, qb: "under"|"pistol"|"gun",
//     slots: [ { pos: WR|SLOT|TE|RB|FB, anchor: <ANCHORS id> } × 5 ] }
var FORMCOMPOSE_SCHEMA_VERSION = 1;
var FORM_NAME_MAX = 20;

// The fixed placement vocabulary. y 0.5 IS the line of scrimmage (on-line);
// 0.56 the flanker/wing depth; deeper is backfield — OFF_FIELD_LAYOUTS's own
// conventions. Receivers/TEs use field anchors, backs use backfield anchors.
var FORM_ANCHORS = {
  wideL: { label: "Wide Left (on the line)", x: 0.05, y: 0.5, online: true, back: false },
  flankL: { label: "Flanker Left", x: 0.08, y: 0.56, online: false, back: false },
  slotL: { label: "Slot Left", x: 0.2, y: 0.56, online: false, back: false },
  slotInL: { label: "Inside Slot Left", x: 0.3, y: 0.56, online: false, back: false },
  tightL: { label: "Tight Left (on the line)", x: 0.24, y: 0.5, online: true, back: false },
  wingL: { label: "Wing Left", x: 0.27, y: 0.56, online: false, back: false },
  wideR: { label: "Wide Right (on the line)", x: 0.95, y: 0.5, online: true, back: false },
  flankR: { label: "Flanker Right", x: 0.92, y: 0.56, online: false, back: false },
  slotR: { label: "Slot Right", x: 0.8, y: 0.56, online: false, back: false },
  slotInR: { label: "Inside Slot Right", x: 0.7, y: 0.56, online: false, back: false },
  tightR: { label: "Tight Right (on the line)", x: 0.76, y: 0.5, online: true, back: false },
  wingR: { label: "Wing Right", x: 0.73, y: 0.56, online: false, back: false },
  bfDeep: { label: "Deep Back", x: 0.5, y: 0.87, online: false, back: true },
  bfSet: { label: "Set Back", x: 0.5, y: 0.77, online: false, back: true },
  bfOffL: { label: "Offset Back Left", x: 0.38, y: 0.74, online: false, back: true },
  bfOffR: { label: "Offset Back Right", x: 0.62, y: 0.74, online: false, back: true }
};
var QB_DEPTH = { under: 0.62, pistol: 0.68, gun: 0.7 };
var FORM_POS = ["WR", "SLOT", "TE", "RB", "FB"];

function emptyCustomFormation(name) {
  return {
    schemaVersion: FORMCOMPOSE_SCHEMA_VERSION,
    name: String(name || "New Formation").slice(0, FORM_NAME_MAX),
    qb: "gun",
    slots: [
      { pos: "WR", anchor: "wideL" },
      { pos: "SLOT", anchor: "slotL" },
      { pos: "TE", anchor: "tightR" },
      { pos: "WR", anchor: "wideR" },
      { pos: "RB", anchor: "bfOffR" }
    ]
  };
}
function _builtinNames() {
  const out = new Set();
  for (const k of Object.keys(FORMATIONS)) out.add(k.toLowerCase());
  out.add(aliasFormation("Pro Set").toLowerCase());
  out.add("pro set");
  return out;
}
// Structured validation — { ok, errors[], warnings[] }. Errors are legality
// (the alignment could not line up); warnings are football judgment (a
// covered end is legal but ineligible).
function validateCustomFormation(cf) {
  const errors = [], warnings = [];
  if (!cf || typeof cf !== "object") return { ok: false, errors: ["formation must be an object"], warnings };
  const name = typeof cf.name === "string" ? cf.name.trim() : "";
  if (!name) errors.push("the formation needs a name");
  else if (_builtinNames().has(name.toLowerCase())) errors.push(`"${name}" is a built-in formation — pick another name`);
  if (cf.qb != null && !(cf.qb in QB_DEPTH)) errors.push(`unknown QB depth "${cf.qb}"`);
  const slots = Array.isArray(cf.slots) ? cf.slots : null;
  if (!slots) return { ok: false, errors: [...errors, "slots must be an array"], warnings };
  if (slots.length !== 5) errors.push(`a formation fields exactly 5 skill players (got ${slots.length})`);
  const seen = new Set();
  let online = 0;
  for (const s of slots) {
    if (!s || !FORM_POS.includes(s.pos)) { errors.push(`bad position "${s && s.pos}"`); continue; }
    const a = FORM_ANCHORS[s.anchor];
    if (!a) { errors.push(`unknown spot "${s && s.anchor}"`); continue; }
    if (seen.has(s.anchor)) errors.push(`two players on the same spot (${a.label})`);
    seen.add(s.anchor);
    const isBack = s.pos === "RB" || s.pos === "FB";
    if (isBack && !a.back) errors.push(`${s.pos} must line up in the backfield (not ${a.label})`);
    if (!isBack && a.back) errors.push(`${s.pos} can't line up in the backfield (${a.label})`);
    if (a.online) online++;
  }
  // Room in the huddle. The engine names skill slots the way a real call sheet
  // does — receivers X/SL/F/V/Z, tight ends Y/U/W, backs H and 2 — and every
  // downstream surface (depth chart, target shares, route art, the viewer's
  // jerseys) keys off those names. Ask for a fourth tight end and there is no
  // name to give him: _skillSlots ran off the end of its id table and threw,
  // which the Designer reported as "fix the errors above" with NO errors listed
  // (found 2026-08-17 from an owner screenshot: five TEs, a blank error block
  // and a dead preview). These are the caps stated as football, checked here
  // where every other legality lives.
  const pkgN = { RB: 0, FB: 0, TE: 0, WR: 0 };
  for (const s of slots) {
    if (!s || !FORM_POS.includes(s.pos)) continue;
    if (s.pos === "RB") pkgN.RB++;
    else if (s.pos === "FB") pkgN.FB++;
    else if (s.pos === "TE") pkgN.TE++;
    else pkgN.WR++;
  }
  if (pkgN.TE > 3) errors.push(`a formation carries at most three tight ends \u2014 Y, U and W (got ${pkgN.TE})`);
  if (pkgN.FB > 1) errors.push(`only one fullback fits the backfield (got ${pkgN.FB})`);
  // 2026-08-18: this was `RB + FB > 2` — one notch too tight, and it locked the
  // OPTION FAMILY out of the designer. The cap exists to stop two men sharing a
  // slot id, and the backfield id table is FB + RB_H + RB_2 (_skillSlots), so
  // THREE backs compile cleanly as long as at most two are halfbacks. The game
  // itself ships three-back sets — Wishbone and Flexbone are both RB 2 + FB 1 —
  // so the old cap made it impossible to author the very formations the engine
  // already runs (formation_compose_probe's "Triple Threat" case, red since the
  // cap landed). One fullback, two halfbacks: three backs, three distinct ids.
  if (pkgN.RB > 2) errors.push(`at most two halfbacks behind the quarterback (got ${pkgN.RB}) — a fullback may join them`);
  // 7 on the line: the 5 OL are always on it, so 2+ skill players must join.
  if (online < 2) errors.push(`only ${5 + online} men on the line — the rules want 7 (put ${2 - online} more on the line)`);
  // Covered ends: an on-line man with a teammate on the line OUTSIDE him is
  // covered (legal, but he's ineligible — the defense won't respect him).
  const onlineSlots = slots.filter((s) => s && FORM_ANCHORS[s.anchor] && FORM_ANCHORS[s.anchor].online);
  for (const s of onlineSlots) {
    const a = FORM_ANCHORS[s.anchor];
    const covered = onlineSlots.some((o) => {
      if (o === s) return false;
      const b = FORM_ANCHORS[o.anchor];
      return a.x < 0.5 ? b.x < a.x : b.x > a.x;
    });
    if (covered) warnings.push(`the ${s.pos} at ${a.label} is COVERED — on the line with a teammate outside him, so he's ineligible`);
  }
  return { ok: errors.length === 0, errors, warnings };
}

// ── The fixed rulebook ──────────────────────────────────────────────────────
function _pkgOf(cf) {
  const n = { RB: 0, FB: 0, TE: 0, WR: 0 };
  for (const s of cf.slots) {
    if (s.pos === "RB") n.RB++;
    else if (s.pos === "FB") n.FB++;
    else if (s.pos === "TE") n.TE++;
    else n.WR++; // WR + SLOT fold into the WR count, exactly like the shipped packages
  }
  return n;
}
// Nearest built-in ARCHETYPE by personnel family: backs weigh most (they set
// the run structure), tight ends next, receivers least. Deterministic
// tie-break on the fixed shipped order.
function formationArchetype(pkg) {
  const backs = (pkg.RB || 0) + (pkg.FB || 0), te = pkg.TE || 0, wide = pkg.WR || 0;
  let best = null, bestD = Infinity;
  for (const fid of Object.keys(FORMATIONS)) {
    if (fid === "Wildcat") continue; // its book is built on slots customs don't have
    const p = FORMATION_PACKAGES[fid];
    if (!p) continue;
    const d = Math.abs(((p.RB || 0) + (p.FB || 0)) - backs) * 4 + Math.abs((p.TE || 0) - te) * 2 + Math.abs((p.WR || 0) - wide);
    if (d < bestD) { bestD = d; best = fid; }
  }
  return best || "Single Back";
}
// The legal call list: the archetype's book FILTERED (never widened). The
// filter itself is the ONE shared fits-function (playbook.js, M1) — the
// Designer's auto-install, the Builder's auto-select and the test bench's
// play list all speak it, so the surfaces can't disagree.
function _playbookOf(pkg, archetype) {
  return filterConceptsForPersonnel(FORMATION_PLAYBOOK[archetype] || [], pkg, { custom: true });
}
// Deterministic slot records: canonical ids/labels by position, receivers
// keyed outside-in (X left, Z right), so every downstream surface — target
// shares, the depth-chart pickers, the viewer's jerseys, route-art fills —
// treats a custom formation exactly like a shipped one.
function _skillSlots(cf) {
  const rows = cf.slots.map((s) => ({ pos: s.pos, ...FORM_ANCHORS[s.anchor] }));
  const recv = rows.filter((r) => r.pos === "WR" || r.pos === "SLOT").sort((a, b) => a.x - b.x);
  const tes = rows.filter((r) => r.pos === "TE").sort((a, b) => a.x - b.x);
  const backs = rows.filter((r) => r.pos === "RB" || r.pos === "FB").sort((a, b) => a.x - b.x);
  const out = [];
  const recvIds = [];
  if (recv.length) recvIds.push(["WR_X", "X"]);
  if (recv.length >= 2) recvIds.push(...[["WR_S", "SL"], ["WR_F", "F"], ["WR_V", "V"]].slice(0, recv.length - 2), ["WR_Z", "Z"]);
  recv.forEach((r, i) => {
    const [id, label] = recvIds[i];
    const wide = Math.abs(r.x - 0.5) >= 0.3;
    out.push({ id, pos: r.pos, label, x: r.x, y: r.y, role: r.pos === "SLOT" ? "WR-Slot" : wide ? "WR-Deep" : "WR-Poss", catch: true });
  });
  const teIds = [["TE_Y", "Y"], ["TE_U", "U"], ["TE_W", "W"]];
  tes.forEach((r, i) => {
    const [id, label] = teIds[i];
    out.push({ id, pos: "TE", label, x: r.x, y: r.y, role: "TE-Receiving", catch: true });
  });
  let rbUsed = 0;
  backs.forEach((r) => {
    if (r.pos === "FB") out.push({ id: "FB", pos: "RB", label: "FB", x: r.x, y: r.y, role: "FB-Lead", catch: true });
    else out.push({ id: rbUsed++ === 0 ? "RB_H" : "RB_2", pos: "RB", label: "HB", x: r.x, y: r.y, role: "RB-Power", catch: true });
  });
  return out;
}
// customFormation → the four registry rows. Throws on an invalid formation —
// registration never installs a broken one.
function compileFormation(cf) {
  const v = validateCustomFormation(cf);
  if (!v.ok) throw new Error(`compileFormation: invalid formation — ${v.errors[0]}`);
  const name = cf.name.trim();
  const pkg = _pkgOf(cf);
  const archetype = formationArchetype(pkg);
  const arch = FORMATIONS[archetype];
  const skill = _skillSlots(cf);
  const qbY = QB_DEPTH[cf.qb || "gun"];
  // slot order mirrors the shipped rows: left receivers, the line, right
  // receivers/TEs, QB, backs — cosmetic, but keeps diagrams reading naturally.
  const leftOf = skill.filter((s) => s.y <= 0.56 && s.x < 0.5).sort((a, b) => a.x - b.x);
  const rightOf = skill.filter((s) => s.y <= 0.56 && s.x >= 0.5).sort((a, b) => a.x - b.x);
  const backRows = skill.filter((s) => s.y > 0.56).sort((a, b) => a.y - b.y);
  const layoutSlots = [...leftOf, ...OL_SLOTS, ...rightOf, { id: "QB", pos: "QB", label: "QB", x: 0.5, y: qbY }, ...backRows];
  return {
    id: name,
    archetype,
    pkg,
    playbook: _playbookOf(pkg, archetype),
    formationsRow: {
      passLean: arch.passLean,
      runIn: arch.runIn,
      runOut: arch.runOut,
      identity: arch.identity,
      label: name,
      desc: `Custom — plays from the ${archetype} family`
    },
    layout: { slots: layoutSlots }
  };
}

// ── The registry seam ───────────────────────────────────────────────────────
var _registered = new Set();
function registeredCustomFormations() {
  return [..._registered];
}
function isCustomFormation(id) {
  return _registered.has(id);
}
function _unregister(id) {
  delete FORMATIONS[id];
  delete FORMATION_PACKAGES[id];
  delete FORMATION_PLAYBOOK[id];
  delete OFF_FIELD_LAYOUTS[id];
}
// Install every valid library formation into the live tables and remove rows
// for creations that no longer exist. Idempotent; skips anything invalid or
// colliding with a built-in; never throws (a broken creation is skipped, not
// fatal). Entries: [{ name, data }] — the caller owns the storage read, so
// this module stays storage-blind (probe- and node-safe).
function syncCustomFormations(entries) {
  const keep = new Set();
  for (const e of Array.isArray(entries) ? entries : []) {
    try {
      const cf = e && e.data ? e.data : null;
      if (!cf) continue;
      const c = compileFormation(cf);
      if (!_registered.has(c.id) && FORMATIONS[c.id]) continue; // never shadow a built-in
      FORMATIONS[c.id] = c.formationsRow;
      FORMATION_PACKAGES[c.id] = c.pkg;
      FORMATION_PLAYBOOK[c.id] = c.playbook;
      OFF_FIELD_LAYOUTS[c.id] = c.layout;
      _registered.add(c.id);
      keep.add(c.id);
    } catch (err) {
    }
  }
  for (const id of [..._registered]) {
    if (!keep.has(id)) {
      _unregister(id);
      _registered.delete(id);
    }
  }
  return _registered.size;
}

export {
  FORMCOMPOSE_SCHEMA_VERSION,
  FORM_ANCHORS,
  QB_DEPTH,
  FORM_POS,
  emptyCustomFormation,
  validateCustomFormation,
  formationArchetype,
  compileFormation,
  syncCustomFormations,
  registeredCustomFormations,
  isCustomFormation
};
