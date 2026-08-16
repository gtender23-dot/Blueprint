import { FORMATION_PLAYBOOK, FORMATION_PACKAGES, FORMATION_VARIATIONS, PASS_TENDENCY, aliasFormation } from '../constants.js';

// ── customPlaybook shape (Creativity Tools, Pass 1 foundation, Aug 2026) ────
// A customPlaybook is the portable, saveable bundle the Playbook Builder edits
// and the `playbooks` Creator shelf stores. It populates fields the SIM ALREADY
// CONSUMES — nothing new in the engine's hot path:
//
//   { schemaVersion, name,
//     formations: [ { id, weight, variation? } ],       → gameplan.offFormations
//     sheets:     { [formationId]: { [concept]: weight } } → gameplan.formationPlaybooks
//     tendency?, passDepth?, rushInPct? }                → gameplan.<same>
//
// So "load a playbook into a gameplan" is a field copy (applyPlaybookToGameplan),
// and "save the current plan as a playbook" is the inverse (playbookFromGameplan).
// The Builder is formation-first UI on top; concepts stay the one engine truth.
// Legality is validated against FORMATION_PLAYBOOK (the per-formation legal call
// list) so a saved book can never ask a formation to run a concept it doesn't
// carry — the same gate the sim's _pbGate enforces at call time.
var PLAYBOOK_SCHEMA_VERSION = 1;

function legalConceptsForFormation(formationId) {
  return FORMATION_PLAYBOOK[aliasFormation(formationId)] || [];
}
function isFormation(formationId) {
  return !!FORMATION_PACKAGES[aliasFormation(formationId)];
}
function emptyPlaybook(name) {
  return { schemaVersion: PLAYBOOK_SCHEMA_VERSION, name: String(name || "New Playbook").slice(0, 36), formations: [], sheets: {} };
}
// Structured validation: { ok, errors[], warnings[] }. Errors are hard (a broken
// book that would mislead the sim or the UI); warnings are advisory (an empty
// book, a sheet for a formation you don't carry). applyPlaybookToGameplan throws
// on errors; the UI can surface warnings without blocking a save.
function validatePlaybook(pb) {
  const errors = [], warnings = [];
  if (!pb || typeof pb !== "object") return { ok: false, errors: ["playbook must be an object"], warnings };
  if (typeof pb.name !== "string" || !pb.name.trim()) warnings.push("playbook has no name");
  const formations = Array.isArray(pb.formations) ? pb.formations : [];
  if (!Array.isArray(pb.formations)) errors.push("formations must be an array");
  const seen = new Set();
  let liveWeight = 0;
  for (const f of formations) {
    if (!f || !f.id) { errors.push("a formation entry is missing an id"); continue; }
    const fid = aliasFormation(f.id);
    if (!isFormation(fid)) { errors.push(`unknown formation "${f.id}"`); continue; }
    if (seen.has(fid) && !f.variation) warnings.push(`formation "${fid}" listed more than once`);
    seen.add(fid);
    if (f.weight != null && (typeof f.weight !== "number" || f.weight < 0)) errors.push(`formation "${fid}": weight must be a number ≥ 0`);
    liveWeight += typeof f.weight === "number" ? f.weight : 0;
    if (f.variation != null) {
      const vset = FORMATION_VARIATIONS[fid];
      if (!vset || !vset[f.variation]) errors.push(`formation "${fid}": unknown variation "${f.variation}"`);
    }
  }
  if (formations.length && liveWeight <= 0) warnings.push("no formation carries a positive weight — none would be called");
  if (!formations.length) warnings.push("playbook carries no formations");
  const sheets = pb.sheets && typeof pb.sheets === "object" ? pb.sheets : {};
  if (pb.sheets != null && typeof pb.sheets !== "object") errors.push("sheets must be an object");
  for (const [fid, sheet] of Object.entries(sheets)) {
    if (!isFormation(fid)) { errors.push(`sheet for unknown formation "${fid}"`); continue; }
    if (!seen.has(aliasFormation(fid))) warnings.push(`sheet for "${fid}" but the playbook doesn't carry that formation`);
    if (!sheet || typeof sheet !== "object") { errors.push(`sheet for "${fid}" must be an object`); continue; }
    const legal = new Set(legalConceptsForFormation(fid));
    for (const [concept, weight] of Object.entries(sheet)) {
      if (!legal.has(concept)) errors.push(`formation "${fid}" cannot run "${concept}" (not in its playbook)`);
      if (typeof weight !== "number" || weight < 0) errors.push(`"${fid}" → "${concept}": weight must be a number ≥ 0`);
    }
  }
  if (pb.tendency != null && !(pb.tendency in PASS_TENDENCY)) errors.push(`unknown tendency "${pb.tendency}"`);
  return { ok: errors.length === 0, errors, warnings };
}
// Load a playbook into a gameplan. Returns a NEW gameplan (the input is never
// mutated); fields the playbook doesn't govern are carried through untouched, so
// loading a book doesn't wipe a coach's defense/target-shares/situations. Throws
// on a playbook with hard errors — never silently loads a broken book.
function applyPlaybookToGameplan(pb, gameplan) {
  const v = validatePlaybook(pb);
  if (!v.ok) throw new Error(`applyPlaybookToGameplan: invalid playbook — ${v.errors[0]}`);
  const gp = JSON.parse(JSON.stringify(gameplan || {}));
  gp.offFormations = (pb.formations || []).map((f) => {
    const e = { id: aliasFormation(f.id), weight: typeof f.weight === "number" ? f.weight : 0 };
    if (f.variation) e.variation = f.variation;
    return e;
  });
  gp.formationPlaybooks = JSON.parse(JSON.stringify(pb.sheets || {}));
  if (pb.tendency != null) gp.tendency = pb.tendency;
  if (pb.passDepth && typeof pb.passDepth === "object") gp.passDepth = { ...pb.passDepth };
  if (typeof pb.rushInPct === "number") gp.rushInPct = pb.rushInPct;
  gp._playbookName = pb.name || null;
  return gp;
}
// Extract a playbook from a live gameplan — "save this plan as a playbook".
function playbookFromGameplan(gameplan, name) {
  const gp = gameplan || {};
  const pb = emptyPlaybook(name || gp._playbookName || "My Playbook");
  pb.formations = (gp.offFormations || []).map((f) => {
    const e = { id: f.id, weight: typeof f.weight === "number" ? f.weight : 0 };
    if (f.variation) e.variation = f.variation;
    return e;
  });
  pb.sheets = JSON.parse(JSON.stringify(gp.formationPlaybooks || {}));
  if (gp.tendency != null) pb.tendency = gp.tendency;
  if (gp.passDepth) pb.passDepth = { ...gp.passDepth };
  if (typeof gp.rushInPct === "number") pb.rushInPct = gp.rushInPct;
  return pb;
}

// Load-time repair: a book authored against an older build can reference a
// formation, variation, or concept that has since changed or been removed (the
// same drift that pulled "Spacing" out of the run books). repairPlaybook cleans
// a loaded book against CURRENT game data — dropping what no longer fits — and
// returns { pb, changes, ok }, so the UI can quietly repair an old book and tell
// the player what changed instead of breaking on load.
function repairPlaybook(pb) {
  const changes = [];
  const src = pb && typeof pb === "object" ? pb : {};
  const out = emptyPlaybook(src.name || "Playbook");
  for (const f of Array.isArray(src.formations) ? src.formations : []) {
    if (!f || !f.id) { changes.push("dropped a formation entry with no id"); continue; }
    const fid = aliasFormation(f.id);
    if (!isFormation(fid)) { changes.push(`dropped formation "${f.id}" (no longer exists)`); continue; }
    const e = { id: fid, weight: typeof f.weight === "number" && f.weight >= 0 ? f.weight : 0 };
    if (f.variation != null) {
      const vset = FORMATION_VARIATIONS[fid];
      if (vset && vset[f.variation]) e.variation = f.variation;
      else changes.push(`dropped variation "${f.variation}" on ${fid} (no longer exists)`);
    }
    out.formations.push(e);
  }
  const sheets = src.sheets && typeof src.sheets === "object" ? src.sheets : {};
  for (const [fid, sheet] of Object.entries(sheets)) {
    if (!isFormation(fid)) { changes.push(`dropped play sheet for "${fid}" (formation no longer exists)`); continue; }
    if (!sheet || typeof sheet !== "object") { changes.push(`dropped malformed sheet for "${fid}"`); continue; }
    const legal = new Set(legalConceptsForFormation(fid));
    const cleaned = {};
    for (const [concept, weight] of Object.entries(sheet)) {
      if (!legal.has(concept)) { changes.push(`${fid} no longer runs "${concept}" — removed`); continue; }
      cleaned[concept] = typeof weight === "number" && weight >= 0 ? weight : 0;
    }
    if (Object.keys(cleaned).length) out.sheets[aliasFormation(fid)] = cleaned;
  }
  if (src.tendency != null) {
    if (src.tendency in PASS_TENDENCY) out.tendency = src.tendency;
    else changes.push(`dropped tendency "${src.tendency}" (no longer exists)`);
  }
  if (src.passDepth && typeof src.passDepth === "object") out.passDepth = { ...src.passDepth };
  if (typeof src.rushInPct === "number") out.rushInPct = src.rushInPct;
  return { pb: out, changes, ok: validatePlaybook(out).ok };
}

export { PLAYBOOK_SCHEMA_VERSION, legalConceptsForFormation, emptyPlaybook, validatePlaybook, applyPlaybookToGameplan, playbookFromGameplan, repairPlaybook };
