import { PASS_CONCEPTS, RUN_CONCEPTS } from '../concepts.js';
import { FORMATION_PLAYBOOK, aliasFormation } from '../constants.js';

// ── Custom Play — Model A: variant over a base concept (Creativity Tools) ──
// The band-SAFE half of the Play Composer (see Ref/PLAY_COMPOSER.md). A custom
// play NAMES an existing base concept and may override only non-grade dimensions
// (display name, formation assignment, a note). For the sim it resolves to the
// base concept VERBATIM — same vs table, same exec weights — so it is
// band-identical by construction: it plays exactly as its base. The grade-
// authoring half (Model B) is deferred pending an owner ruling; nothing here can
// move a stat_realism band.
//
//   { schemaVersion, name, kind: "pass"|"run", base: <concept name>,
//     formations?: [formationId], note? }
//
// Stored on the `plays` Creator shelf; drops into a playbook sheet like any
// concept, under its custom name, resolving to `base` when the sim reads grades.
var CUSTOM_PLAY_SCHEMA_VERSION = 1;

function baseConceptsForKind(kind) {
  return Object.keys(kind === "run" ? RUN_CONCEPTS : PASS_CONCEPTS);
}
function conceptTable(kind) {
  return kind === "run" ? RUN_CONCEPTS : PASS_CONCEPTS;
}
function emptyCustomPlay(name) {
  return { schemaVersion: CUSTOM_PLAY_SCHEMA_VERSION, name: String(name || "New Play").slice(0, 36), kind: "pass", base: null, formations: [] };
}
// Structured validation: { ok, errors[], warnings[] }.
function validateCustomPlay(cp) {
  const errors = [], warnings = [];
  if (!cp || typeof cp !== "object") return { ok: false, errors: ["custom play must be an object"], warnings };
  if (typeof cp.name !== "string" || !cp.name.trim()) warnings.push("custom play has no name");
  const kind = cp.kind === "run" ? "run" : cp.kind === "pass" ? "pass" : null;
  if (!kind) { errors.push(`kind must be "pass" or "run"`); return { ok: false, errors, warnings }; }
  const table = conceptTable(kind);
  if (!cp.base) errors.push("custom play has no base concept");
  else if (!table[cp.base]) errors.push(`unknown ${kind} base concept "${cp.base}"`);
  if (cp.formations != null) {
    if (!Array.isArray(cp.formations)) errors.push("formations must be an array");
    else for (const fid of cp.formations) {
      const f = aliasFormation(fid);
      if (!FORMATION_PLAYBOOK[f]) errors.push(`unknown formation "${fid}"`);
      // a base concept assigned to a formation that doesn't carry it is a
      // warning, not an error — the author may want it there, but the sim's
      // _pbGate would drop it. Flag so the UI can nudge.
      else if (cp.base && !FORMATION_PLAYBOOK[f].includes(cp.base)) warnings.push(`formation "${f}" does not carry base "${cp.base}" — it won't be called there`);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}
// Resolve a custom play to a concept the sim consumes. Returns the BASE concept's
// object verbatim (grades untouched) plus the custom display name and a marker.
// Band-identical by construction — the resolved grades ARE the base's grades.
function resolveToConcept(cp) {
  const v = validateCustomPlay(cp);
  if (!v.ok) throw new Error(`resolveToConcept: invalid custom play — ${v.errors[0]}`);
  const base = conceptTable(cp.kind)[cp.base];
  return { ...base, name: cp.name, _customOf: cp.base };
}

// Load-time repair: a Model-A custom play is only as alive as its base concept.
// If the base was removed, the play can't be rebuilt (ok:false); otherwise drop
// any formations that no longer exist and keep it.
function repairCustomPlay(cp) {
  const changes = [];
  const src = cp && typeof cp === "object" ? cp : {};
  const kind = src.kind === "run" ? "run" : "pass";
  const baseOk = !!(src.base && conceptTable(kind)[src.base]);
  if (!baseOk) changes.push(`base ${kind} concept "${src.base}" no longer exists — play needs rebuilding`);
  const formations = (Array.isArray(src.formations) ? src.formations : []).filter((fid) => {
    if (FORMATION_PLAYBOOK[aliasFormation(fid)]) return true;
    changes.push(`dropped formation "${fid}" (no longer exists)`);
    return false;
  });
  const out = { schemaVersion: CUSTOM_PLAY_SCHEMA_VERSION, name: String(src.name || "Play").slice(0, 36), kind, base: src.base || null, formations };
  return { cp: out, changes, ok: baseOk };
}

export { CUSTOM_PLAY_SCHEMA_VERSION, baseConceptsForKind, emptyCustomPlay, validateCustomPlay, resolveToConcept, repairCustomPlay };
