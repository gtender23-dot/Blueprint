import { FORMATION_PLAYBOOK, FORMATION_PACKAGES, FORMATION_VARIATIONS, PASS_TENDENCY, aliasFormation } from '../constants.js';
import { PASS_CONCEPTS, RUN_CONCEPTS } from '../concepts.js';

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
// ── Per-LOOK sheets, inherit-with-override (M2 engine half, 2026-08-17) ─────
// A sheet key is either a formation id ("Air Raid" — the BASE sheet) or a look
// key ("Air Raid|empty" — that look's OWN sheet). The law: a (formation,
// variation) look WITHOUT its own sheet inherits the formation sheet
// BYTE-IDENTICALLY (resolveLookSheet returns the very same object); editing a
// look forks it (the editors copy-then-write, never mutate the base through
// the fallback). Every existing book is base-keys-only, so it resolves exactly
// as before — the zero-migration law. "|" is already the UI's look-key
// separator and can't appear in a formation id.
function lookSheetKey(formationId, variation) {
  const fid = aliasFormation(formationId);
  return variation ? `${fid}|${variation}` : fid;
}
function splitSheetKey(key) {
  const s = String(key == null ? "" : key);
  const i = s.indexOf("|");
  if (i < 0) return { id: aliasFormation(s), variation: null };
  return { id: aliasFormation(s.slice(0, i)), variation: s.slice(i + 1) || null };
}
// THE resolver — the ONE inheritance fallback every consumer goes through:
// the sim's _fpbSheet overlay, the call sheet's pinned-look browse, the Game
// Plan editor and the Builder. Returns the look's own sheet when it has one
// (non-empty), else the formation's base sheet, else null. Returns the LIVE
// object on purpose: inheritance must be byte-identity, not a copy.
function resolveLookSheet(sheets, formationId, variation) {
  if (!sheets) return null;
  const fid = aliasFormation(formationId);
  if (variation) {
    const own = sheets[`${fid}|${variation}`];
    if (own && typeof own === "object" && Object.keys(own).length) return own;
  }
  return sheets[fid] || null;
}
// ── The ONE shared fits-function (M1, 2026-08-17) ───────────────────────────
// Stage 7's compileFormation call-list filter, extracted so every surface that
// asks "which plays FIT this look?" gives the same answer: the Formation
// Designer's auto-install, the Playbook Builder's auto-select (#23), and the
// test bench's play list all call this. Personnel rules in football terms:
// a pass concept needs its receivers on the field (minWR); back-built plays
// (screens to a back, the throwback gadgets) need a back; option football
// needs two backs; Wildcat/Jet structure only exists in the shipped looks, so
// customs never offer them. `custom` gates the customs-only exclusions —
// shipped formations keep their curated books verbatim.
function filterConceptsForPersonnel(list, pkg, { custom = false } = {}) {
  const p = pkg || {};
  const wide = p.WR || 0, backs = (p.RB || 0) + (p.FB || 0);
  return (list || []).filter((nm) => {
    const pc = PASS_CONCEPTS[nm];
    if (pc) {
      if (pc.minWR && wide < pc.minWR) return false;
      if ((nm === "Flea Flicker" || nm === "HB Pass" || nm === "Slip Screen" || nm === "RB Screen") && backs < 1) return false;
      return true;
    }
    const rc = RUN_CONCEPTS[nm];
    if (rc) {
      if (custom && (nm === "Wildcat Power" || nm === "Jet Sweep")) return false; // need slots/motion structure customs don't author
      if ((nm === "Triple Option" || nm === "Speed Option") && backs < 2) return false;
      // M3: the authored family's personnel truths — the QB runs need no
      // back (Empty QB Draw is real football), the bubble needs a second
      // wide body to throw to, the reads need a back to option off.
      if (nm === "QB Sneak" || nm === "Draw" || nm === "QB Power" || nm === "QB Draw" || nm === "QB Counter") return true;
      if (nm === "RPO Bubble" && wide < 2) return false;
      return backs >= 1;
    }
    return false;
  });
}
// "Which of this formation's legal calls fit this LOOK?" — the formation's
// book filtered by the fielded personnel (a variation's pkg override counts,
// so an Empty look never offers a two-back play). Always a subset of
// legalConceptsForFormation — legality is the gate, fit is the refinement.
function fittingConceptsForFormation(formationId, variation) {
  const fid = aliasFormation(formationId);
  const pkg = { ...(FORMATION_PACKAGES[fid] || {}) };
  const vset = FORMATION_VARIATIONS[fid];
  const vpkg = variation && vset && vset[variation] && vset[variation].pkg;
  if (vpkg) Object.assign(pkg, vpkg);
  return filterConceptsForPersonnel(FORMATION_PLAYBOOK[fid] || [], pkg);
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
    const lookKey = `${fid}|${f.variation || ""}`;
    if (seen.has(lookKey)) warnings.push(f.variation ? `formation "${fid}" carries the "${f.variation}" look more than once` : `formation "${fid}" listed more than once`);
    seen.add(fid);
    seen.add(lookKey);
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
  for (const [key, sheet] of Object.entries(sheets)) {
    // Per-look keys (M2): "fid" = the base sheet, "fid|variation" = that look's
    // own forked sheet. Legality is the FORMATION's book either way — a look
    // never runs a play its formation doesn't carry.
    const { id: fid, variation: vk } = splitSheetKey(key);
    if (!isFormation(fid)) { errors.push(`sheet for unknown formation "${fid}"`); continue; }
    if (vk) {
      const vset = FORMATION_VARIATIONS[fid];
      if (!vset || !vset[vk]) { errors.push(`sheet for unknown look "${fid}|${vk}"`); continue; }
      if (!seen.has(`${fid}|${vk}`)) warnings.push(`sheet for the "${fid}" ${vk} look but the playbook doesn't carry it`);
    } else if (!seen.has(fid)) {
      warnings.push(`sheet for "${fid}" but the playbook doesn't carry that formation`);
    }
    if (!sheet || typeof sheet !== "object") { errors.push(`sheet for "${key}" must be an object`); continue; }
    const legal = new Set(legalConceptsForFormation(fid));
    for (const [concept, weight] of Object.entries(sheet)) {
      if (!legal.has(concept)) errors.push(`formation "${fid}" cannot run "${concept}" (not in its playbook)`);
      if (typeof weight !== "number" || weight < 0) errors.push(`"${key}" → "${concept}": weight must be a number ≥ 0`);
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
  for (const [key, sheet] of Object.entries(sheets)) {
    // Per-look keys (M2): an old book is base-keys-only and maps LOSSLESSLY —
    // the base branch below is byte-equivalent to the pre-M2 repair. A look
    // sheet whose variation died folds away (the look inherits the base sheet
    // again, which is the inheritance law's own answer to a dead fork).
    const { id: fid, variation: vk } = splitSheetKey(key);
    if (!isFormation(fid)) { changes.push(`dropped play sheet for "${fid}" (formation no longer exists)`); continue; }
    if (vk) {
      const vset = FORMATION_VARIATIONS[fid];
      if (!vset || !vset[vk]) { changes.push(`dropped the "${fid}" ${vk} look's sheet (look no longer exists — it inherits the ${fid} sheet)`); continue; }
    }
    if (!sheet || typeof sheet !== "object") { changes.push(`dropped malformed sheet for "${key}"`); continue; }
    const legal = new Set(legalConceptsForFormation(fid));
    const cleaned = {};
    for (const [concept, weight] of Object.entries(sheet)) {
      if (!legal.has(concept)) { changes.push(`${fid} no longer runs "${concept}" — removed`); continue; }
      cleaned[concept] = typeof weight === "number" && weight >= 0 ? weight : 0;
    }
    if (Object.keys(cleaned).length) out.sheets[lookSheetKey(fid, vk)] = cleaned;
  }
  if (src.tendency != null) {
    if (src.tendency in PASS_TENDENCY) out.tendency = src.tendency;
    else changes.push(`dropped tendency "${src.tendency}" (no longer exists)`);
  }
  if (src.passDepth && typeof src.passDepth === "object") out.passDepth = { ...src.passDepth };
  if (typeof src.rushInPct === "number") out.rushInPct = src.rushInPct;
  return { pb: out, changes, ok: validatePlaybook(out).ok };
}

export { PLAYBOOK_SCHEMA_VERSION, legalConceptsForFormation, filterConceptsForPersonnel, fittingConceptsForFormation, lookSheetKey, splitSheetKey, resolveLookSheet, emptyPlaybook, validatePlaybook, applyPlaybookToGameplan, playbookFromGameplan, repairPlaybook };
