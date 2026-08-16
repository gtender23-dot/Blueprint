import { repairPlaybook } from './playbook.js';
import { repairComposedPlay } from './playcompose.js';
import { repairCustomPlay } from './customplay.js';
import { compileLeague } from './world.js';

// ── Load-time repair (Creativity Tools, gap #1) ────────────────────────────
// Creations are meant to outlive game updates, but a creation authored against
// an older build can reference a formation, concept, variation, or route part
// that has since changed or been removed — exactly the drift that pulled
// "Spacing" out of the run books. repairCreation validates a LOADED creation
// against CURRENT game data, drops what no longer fits, and returns
// { data, changes, ok } so the UI can quietly clean an old creation and tell the
// player what changed, instead of breaking on load. `changes` is a plain-English
// list; `ok:false` means the creation can't be auto-rebuilt (its core is gone)
// and should be opened in its editor rather than used as-is.
function repairCreation(kind, data) {
  if (kind === "playbooks") {
    const r = repairPlaybook(data);
    return { data: r.pb, changes: r.changes, ok: r.ok };
  }
  if (kind === "plays") {
    // A composed play carries `parts`; a Model-A custom play carries `base`.
    if (data && Array.isArray(data.parts)) {
      const r = repairComposedPlay(data);
      return { data: r.cp, changes: r.changes, ok: r.ok };
    }
    const r = repairCustomPlay(data);
    return { data: r.cp, changes: r.changes, ok: r.ok };
  }
  if (kind === "leagues") {
    // A league's only cross-references are internal (team→conference); compiling
    // it is the definitive check. If it compiles, it will build a world.
    try {
      compileLeague(data);
      return { data, changes: [], ok: true };
    } catch (e) {
      return { data, changes: [`league can't compile: ${String(e.message).replace(/^compileLeague: /, "")}`], ok: false };
    }
  }
  // teams: an identity payload with no cross-references to drift against in v1
  // (procedural rosters). Nothing to repair.
  return { data, changes: [], ok: true };
}

export { repairCreation };
