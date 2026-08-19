import { saveCreation, getCreation } from './creator.js';
import { validatePlaybook, applyPlaybookToGameplan } from './playbook.js';
import { validateDefBook, applyDefBookToGameplan } from './defbook.js';
import { adoptDefPlan, adoptOffPlan, setOverlay } from './teamplan.js';

// ── bookpush.js — M5 embedded editable playbooks (#39, D8 2026-08-17) ────────
// The two verbs of in-career book editing, shared by the Game Plan's embedded
// editors AND tools/book_update_probe.mjs (one seam, so the UI and the probe
// can never disagree about what a save or a push does):
//
//   applyEditedBookToSchool — "Save to my season": the edited book object
//     compiles into the school's LEAGUE-saved gameplan through the same
//     one-side applier every other book load uses (fields the book doesn't
//     govern carry through — dials, situations, the other side). The source
//     stamps (_bookSourceId/_bookSourceSaved and the def pair) are gameplan
//     _fields, so an in-career edit KEEPS its Workshop lineage — if the
//     library copy later moves ahead, the Stage-3 banner still offers the
//     update, exactly as before. Forces re-synthesis (the Stage-3 seam):
//     school.book/defbook/planOverlay track the plan just written.
//
//   pushBookToWorkshop — "Push to Workshop": applies the edit to the career
//     (so the carried book and the library copy genuinely match), copies the
//     book into the Creator library (updating the source creation in place
//     when the carried book has one; a fresh entry otherwise), then RESTAMPS
//     the source identity from the entry just written. Because the restamp
//     copies the entry's own `saved` time, `entry.saved > sourceSaved` is
//     false by construction — the update banner can never fire about your
//     own push.
function applyEditedBookToSchool(school, side, book) {
  if (!school || !school.gameplan || !book) return { ok: false, reason: "nothing to save" };
  const v = side === "def" ? validateDefBook(book) : validatePlaybook(book);
  if (!v.ok) return { ok: false, reason: v.errors[0] };
  let merged;
  try {
    merged = side === "def" ? applyDefBookToGameplan(book, school.gameplan) : applyPlaybookToGameplan(book, school.gameplan);
  } catch (e) {
    return { ok: false, reason: e.message };
  }
  // D17 BATCH A: an edited book pushed back from the Workshop IS the book —
  // route the merge through the parts instead of writing the flat bag and
  // re-deriving the book from it afterwards. Field-for-field identical to the
  // retired idiom (playbook_root_probe §10 compares both arms directly).
  if (side === "def") adoptDefPlan(school, merged, { defName: book.name || null });
  else adoptOffPlan(school, merged, { offName: book.name || null });
  return { ok: true };
}
function pushBookToWorkshop(school, side, book) {
  const applied = applyEditedBookToSchool(school, side, book);
  if (!applied.ok) return applied;
  const gp = school.gameplan;
  const shelf = side === "def" ? "defbooks" : "playbooks";
  const idKey = side === "def" ? "_defbookSourceId" : "_bookSourceId";
  const savedKey = side === "def" ? "_defbookSourceSaved" : "_bookSourceSaved";
  const r = saveCreation(shelf, book.name, book, gp[idKey] ? { id: gp[idKey] } : {});
  if (!r.ok) return { ok: false, reason: r.reason };
  const entry = getCreation(shelf, r.id);
  // D17 BATCH A: the Workshop source identity is stamped in BOTH homes it has,
  // directly, instead of being poked onto the flat gameplan and then dragged
  // into the parts by a forced re-synthesis (the trailing re-sync this batch
  // retires). The two homes are not redundant:
  //   • the OVERLAY carries the flat _bookSourceId/_bookSourceSaved keys every
  //     legacy reader still looks for (and splitTeamPlan reads them if the
  //     parts are ever rebuilt from the bag, so the two can't disagree);
  //   • the BOOK OBJECT carries its own source/sourceId/sourceSaved, which is
  //     what the update banner compares against — setOverlay recompiles the
  //     flat plan but does not re-split, so the book must be told directly.
  const saved = (entry && entry.saved) || Date.now();
  setOverlay(school, { [idKey]: r.id, [savedKey]: saved });
  const bk = side === "def" ? school.defbook : school.book;
  if (bk) { bk.source = "creator:" + r.id; bk.sourceId = String(r.id); bk.sourceSaved = saved; }
  return { ok: true, id: r.id, updated: !!r.updated };
}

export { applyEditedBookToSchool, pushBookToWorkshop };
