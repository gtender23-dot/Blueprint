// teamplan.js — Stage 1 of the Playbook-Root refactor.
// (Ref/PLAYBOOK_ROOT_ARCHITECTURE.md, "The playbook as the root of the game".)
//
// The playbook is becoming the ROOT object of the game. Today every school's
// play-calling lives in one flat bag — school.gameplan, ~40 sibling fields that
// mix offense, defense and team-level knobs — authored by five different writers
// (AI setAIGameplan, presets, the new-game wizard, pb:/dd: loads, the Game Plan
// UI). This module introduces the named object model plus a SINGLE compile seam
// without changing anything the sim reads:
//
//   school.book        — the OFFENSE snapshot: the looks, the call sheet and the
//                        offensive dials, carrying a name + a source.
//   school.defbook     — the DEFENSE snapshot: front / coverage / pressure
//                        identity and the defensive dials, name + source.
//   school.planOverlay — everything the two books don't own: the team-level
//                        knobs (4th-down, FG range, tempo) and the situational
//                        grid. This is the controller layer (formalized later).
//
// compileTeamPlan(school) reassembles those three parts into EXACTLY the flat
// gameplan the sim consumes today. Stage 1's law is that the first compile is
// byte-identical to the pre-refactor gameplan — proven in
// tools/playbook_root_probe.mjs across real generated worlds, and guaranteed
// here BY CONSTRUCTION: the partition only relocates fields (deep-cloned), never
// transforms them, so no value can change — only move between the three bags and
// back. Nothing in the sim, the UI, or the balance math changes at this stage;
// later stages let the books actually govern (AI names its book, the Game Plan
// becomes the controller, the play record and the animation learn the call).

// ── The side manifest (Ref §4b: "one canonical SIDE MANIFEST") ───────────────
// Every play field the sim / situations layer consumes, tagged with the side
// that OWNS it: 'off' → the offensive book, 'def' → the defensive book, 'team' →
// the overlay. This is the single source of truth the compiler and both books
// read, replacing the four hand-maintained field lists that don't agree
// (applyPlaybookToGameplan's, applyDefBookToGameplan's, app.js
// PLAN_OFF_FIELDS/PLAN_DEF_FIELDS, the UI tab wiring). tools/plan_side_probe.mjs
// walks it and fails if a field is double-sided or a known sim-consumed field is
// missing. Byte safety does NOT depend on this list being exhaustive: any field
// NOT listed here simply stays in the overlay, so the partition can never lose
// an unanticipated field — the manifest only decides who OWNS a field, not
// whether it survives.
const PLAN_FIELD_SIDE = {
  // 2026-08-19: WHO blitzes. A player-level map { playerId: "often"|"sometimes" },
  // absent/empty = Auto. Deliberately NOT per-front like the pie it replaces —
  // a pie keyed to the front FIELDED was silently absent on 28% of passing
  // downs (measured), because the defense auto-subs. Attached to men, it
  // follows them.
  blitzers: "def",
  // ── OFFENSE — the book owns the looks, the sheet, and the offensive dials ──
  offFormations: "off",
  formationPlaybooks: "off",
  tendency: "off",
  // 2026-08-21 (owner call): tempo is the OFFENSE's, not the team's. A coach
  // picks it with the ball in his hands; the defense never sets it. Moving it
  // to the book also means an offensive playbook CARRIES its tempo, which is
  // what a "Hurry-up spread" book ought to mean. Old saves keep the value in
  // the overlay and still compile correctly (book layers over overlay, and an
  // absent book field does not mask it); the first new write moves it home.
  baseTempo: "off",
  passDepth: "off",
  rushInPct: "off",
  conceptWeights: "off",
  rpoRate: "off",
  gadgetRate: "off",
  qbRunPct: "off",
  optionRate: "off",
  optionMix: "off",
  pitchAggr: "off",
  jetRate: "off",
  drawRate: "off",
  motionRate: "off",
  qbAggr: "off",
  protIdentity: "off",
  protEmphasis: "off",
  losFreedom: "off",
  targetShares: "off",
  // D11 (2026-08-18, OD-11 ratified): the audited manifest gaps — standing
  // fields the sim consumes that previously drifted into the overlay, so a
  // book swap didn't govern its whole side. Pure data; the compiler's
  // partition semantics do the rest.
  screenRate: "off",
  paRate: "off",
  chipHelp: "off",
  wildcatPassRate: "off",
  rpoKeepPct: "off",
  rbCarryShares: "off",
  runDirection: "off",
  // ── DEFENSE — the defbook owns front / coverage / pressure identity + dials ─
  defBaseFront: "def",
  defFrontMix: "def",
  defAggression: "def",
  blitzPct: "def",
  pressureIdentity: "def",
  pressureSource: "def",
  coverageScheme: "def",
  covShell: "def",
  covStyle: "def",
  greenDog: "def",
  spyQB: "def",
  runCommit: "def",
  edgePlay: "def",
  optionKey: "def",
  robberCall: "def",
  zoneStyle: "def",
  pressLevel: "def",
  tackleStyle: "def",
  subPhilosophy: "def",
  bracketWho: "def",
  defCalls: "def",
  formChecks: "def",
  // D11: defCalls is book-owned but the SHEET that weights them lived in the
  // overlay — the audited "book swap leaves a stale callSheet" gap (OD-11).
  callSheet: "def",
  // ── TEAM — stays in the overlay (the game plan is its controller) ──────────
  fourthDown: "team",
  maxFGDist: "team",
  situations: "team",
  // D11: the special-teams standing knobs, audited as sim-consumed but
  // unlisted. Team-side — the overlay keeps them, now by decision, not drift.
  stFakes: "team",
  puntDef: "team",
  retScheme: "team",
  patApproach: "team",
  surpriseOnside: "team"
};

const TEAMPLAN_SCHEMA_VERSION = 1;

function _sideFields(side) {
  const out = [];
  for (const k in PLAN_FIELD_SIDE) {
    if (PLAN_FIELD_SIDE[k] === side) out.push(k);
  }
  return out;
}
const OFF_FIELDS = _sideFields("off");
const DEF_FIELDS = _sideFields("def");

function _clone(v) {
  return v === void 0 ? void 0 : JSON.parse(JSON.stringify(v));
}
// Pull the own, present fields in `fields` out of a gameplan (deep-cloned). A
// field the gameplan doesn't carry is simply absent from the bag — so an absent
// field stays absent through the round-trip (byte-identical for sparse plans).
function _extract(gameplan, fields) {
  const bag = {};
  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(gameplan, f)) bag[f] = _clone(gameplan[f]);
  }
  return bag;
}

// Split a flat gameplan into { book, defbook, overlay }. Lossless: the overlay
// takes a deep copy of every field the manifest does NOT hand to a book; the
// books take deep copies of the fields they own. Union of the three = the input.
function splitTeamPlan(gameplan, opts = {}) {
  const gp = gameplan || {};
  const overlay = {};
  for (const k in gp) {
    if (!Object.prototype.hasOwnProperty.call(gp, k)) continue;
    const side = PLAN_FIELD_SIDE[k];
    if (side === "off" || side === "def") continue; // owned by a book
    overlay[k] = _clone(gp[k]);
  }
  const schoolName = opts.schoolName ? String(opts.schoolName) : null;
  const book = {
    schemaVersion: TEAMPLAN_SCHEMA_VERSION,
    name: opts.offName || gp._playbookName || (schoolName ? `${schoolName} Offense` : "Offense"),
    source: opts.source || "staff",
    plan: _extract(gp, OFF_FIELDS)
  };
  const defbook = {
    schemaVersion: TEAMPLAN_SCHEMA_VERSION,
    name: opts.defName || gp._defbookName || (schoolName ? `${schoolName} Defense` : "Defense"),
    source: opts.source || "staff",
    plan: _extract(gp, DEF_FIELDS)
  };
  // Stage 3 (update-prompt identity): a book loaded from the Workshop carries
  // its creation's id + saved stamp so the Game Plan can offer "a newer
  // version of this book exists". The stamps live on the GAMEPLAN as _fields
  // (they survive the load handlers' non-underscore wipe AND every forced
  // re-synthesis — this function rebuilds the book objects, so the gameplan
  // is the durable home) and are copied onto the books here. Absent stamps =
  // a staff/preset book = no prompt, exactly as before.
  if (gp._bookSourceId) {
    book.source = "creator:" + gp._bookSourceId;
    book.sourceId = String(gp._bookSourceId);
    book.sourceSaved = gp._bookSourceSaved || 0;
  }
  if (gp._defbookSourceId) {
    defbook.source = "creator:" + gp._defbookSourceId;
    defbook.sourceId = String(gp._defbookSourceId);
    defbook.sourceSaved = gp._defbookSourceSaved || 0;
  }
  return { book, defbook, overlay };
}

// ── Stage 3 (the controller save): "Save plan" saves OVERLAYS ───────────────
// A coach's saved plan is his CONTROLLER — dials, concept weights, target
// shares, situations, team knobs — NOT a frozen copy of whichever book he
// happened to carry. These are the STRUCTURAL fields a controller save
// excludes: the books' identity (looks/sheets; front/coverage/pressure/named
// calls) plus roster-bound slot assignments and the opponent-specific weekly
// plan, which never belonged in a portable library plan (fieldAssignments
// carries player IDs from one career).
const PLAN_BOOK_STRUCT_FIELDS = [
  "offFormation", "offFormations", "formationPlaybooks",
  "defFormation", "defBaseFront", "defFrontMix", "coverageScheme",
  "pressureIdentity", "pressureSource", "greenDog", "spyQB",
  "defCalls", "formChecks",
  "fieldAssignments", "weeklyPlan"
];
// The controller view of a plan: every non-structural, non-internal field.
function controllerOverlayOf(gameplan) {
  const gp = gameplan || {};
  const out = {};
  for (const k of Object.keys(gp)) {
    if (k.startsWith("_")) continue;
    if (PLAN_BOOK_STRUCT_FIELDS.includes(k)) continue;
    out[k] = _clone(gp[k]);
  }
  return out;
}
// Load a saved controller ONTO the current plan: the book (structural fields)
// stays exactly as carried; every controller field resets to the provided
// defaults, then the overlay's fields apply. Returns a NEW gameplan; inputs
// are never mutated. `freshDefaults` is the caller's defaultGameplan() (kept
// as a parameter so this module stays free of a world.js dependency).
function applyControllerOverlay(gameplan, overlay, freshDefaults) {
  const out = _clone(gameplan || {}) || {};
  for (const k of Object.keys(out)) {
    if (k.startsWith("_") || PLAN_BOOK_STRUCT_FIELDS.includes(k)) continue;
    delete out[k];
  }
  const base = freshDefaults || {};
  for (const k of Object.keys(base)) {
    if (k.startsWith("_") || PLAN_BOOK_STRUCT_FIELDS.includes(k)) continue;
    out[k] = _clone(base[k]);
  }
  const ov = overlay || {};
  for (const k of Object.keys(ov)) {
    if (k.startsWith("_") || PLAN_BOOK_STRUCT_FIELDS.includes(k)) continue;
    out[k] = _clone(ov[k]);
  }
  return out;
}

// Reassemble { book, defbook, overlay } → the flat gameplan the sim reads.
// Overlay first (the team + unowned fields), then the offensive book's fields,
// then the defensive book's — a book field always wins over a stale overlay copy
// of the same field, which is what makes a book the authority for its side.
function compilePlanParts(book, defbook, overlay) {
  const gp = {};
  const ov = overlay || {};
  for (const k in ov) {
    if (Object.prototype.hasOwnProperty.call(ov, k)) gp[k] = _clone(ov[k]);
  }
  const bplan = (book && book.plan) || {};
  for (const k in bplan) {
    if (Object.prototype.hasOwnProperty.call(bplan, k)) gp[k] = _clone(bplan[k]);
  }
  const dplan = (defbook && defbook.plan) || {};
  for (const k in dplan) {
    if (Object.prototype.hasOwnProperty.call(dplan, k)) gp[k] = _clone(dplan[k]);
  }
  // Stage 4 (minimal defCalls→defbook.calls seam): the target model gives the
  // defensive book a first-class `calls` home (Ref §2). Today the calls still
  // ride the manifest as plan.defCalls (so every Stage-1 byte-identity proof
  // holds unchanged); a defbook that DOES carry a top-level `calls` — the
  // Stage-3 migration, or a future authored book — compiles it into the flat
  // gameplan.defCalls the sim reads. plan.defCalls wins when both exist (it is
  // the snapshot the round-trip law covers). Byte-neutral for every book that
  // exists today.
  if (defbook && defbook.calls && !Object.prototype.hasOwnProperty.call(dplan, "defCalls")) {
    gp.defCalls = _clone(defbook.calls);
  }
  return gp;
}

// The one compile seam. A school carrying the named parts compiles from them;
// a school that has not been synthesized yet compiles to its current gameplan
// (so a caller can always ask for "the plan the sim would read").
function compileTeamPlan(school) {
  if (!school) return {};
  if (school.book || school.defbook || school.planOverlay) {
    return compilePlanParts(school.book, school.defbook, school.planOverlay);
  }
  return _clone(school.gameplan || {}) || {};
}

// Attach the named object model to a school by splitting its current gameplan.
// Stage-1 zero-risk law: the school's gameplan OBJECT is left in place (the sim
// keeps reading exactly what it read before, key order and all); the books and
// overlay are the equivalent named view, and compileTeamPlan(school) deep-equals
// school.gameplan by construction. Later stages flip the source of truth to the
// parts. Idempotent: a school that already carries a book is left untouched
// unless `force` is set (a re-sync after a writer rewrote the gameplan).
function synthesizeTeamPlan(school, opts = {}) {
  if (!school) return school;
  if (school.book && !opts.force) return school;
  const gp = school.gameplan || {};
  const parts = splitTeamPlan(gp, {
    schoolName: opts.schoolName || school.name || null,
    source: opts.source,
    offName: opts.offName,
    defName: opts.defName
  });
  school.book = parts.book;
  school.defbook = parts.defbook;
  school.planOverlay = parts.overlay;
  return school;
}

// Synthesize every school in a world (new-game finalize + synthesis-on-load).
function synthesizeLeaguePlans(world, opts = {}) {
  const schools = world && world.schools;
  if (!Array.isArray(schools)) return 0;
  let n = 0;
  for (const s of schools) {
    try {
      synthesizeTeamPlan(s, opts);
      n++;
    } catch (e) {
    }
  }
  return n;
}

// ── The two verbs the five writers collapse to (Ref §3) ──────────────────────
// assignBook / assignDefBook swap a book; setOverlay patches the controller.
// Each recompiles school.gameplan from the parts. These are the Stage-3 surface
// (the Game Plan controller); Stage 1 only proves the round-trip through them.
function assignBook(school, book) {
  if (!school) return {};
  if (!school.book && !school.planOverlay) synthesizeTeamPlan(school, { force: true });
  if (book) school.book = _clone(book);
  school.gameplan = compileTeamPlan(school);
  return school.gameplan;
}
function assignDefBook(school, defbook) {
  if (!school) return {};
  if (!school.book && !school.planOverlay) synthesizeTeamPlan(school, { force: true });
  if (defbook) school.defbook = _clone(defbook);
  school.gameplan = compileTeamPlan(school);
  return school.gameplan;
}
function setOverlay(school, patch) {
  if (!school) return {};
  if (!school.book && !school.planOverlay) synthesizeTeamPlan(school, { force: true });
  school.planOverlay = Object.assign({}, school.planOverlay || {}, _clone(patch) || {});
  school.gameplan = compileTeamPlan(school);
  return school.gameplan;
}

// ── D17 Batch A: THE ONE WAY A *LOAD* WRITES A PLAN ─────────────────────────
// Every book loader (the wizard's starter pick, the Game Plan library's pb:/
// dpb:/dd: handlers, applyStartingChoices, bookpush) produces a MERGED flat
// gameplan from `applyPlaybookToGameplan` / `applyDefBookToGameplan`. Until now
// each site then wrote that bag straight onto school.gameplan with the same
// hand-rolled idiom — delete every non-underscore key, Object.assign the merge —
// and most never re-derived school.book. That is why the books were a stale
// snapshot of whatever the bag USED to say: the wizard in particular runs after
// synthesizeLeaguePlans, so a dynasty was born with a book that never matched
// the one the coach picked.
//
// These two route a merged plan through the parts, so the BOOK becomes the
// truth and the flat gameplan is recompiled FROM it. Equivalence is exact by
// construction: `merged` is split into the same three parts the round-trip law
// already covers, so compile(parts) deep-equals `merged`.
//
// Why the overlay is written too, and not just the book: the loaders do NOT
// confine themselves to their own side. `applyDefBookToGameplan` compiles a
// book's shelves into `gameplan.situations`, and `situations` is a TEAM field
// that lives in the overlay — assign the defbook alone and a book's situational
// answers would vanish on load. (`_playbookName` and the `_bookStarter` markers
// ride the overlay for the same reason.)
//
// setOverlay MERGES its patch, which is safe here precisely because both
// loaders start from a clone of the current plan and only ever ADD or overwrite
// keys — neither removes one, so there is nothing for a merge to strand.
// ── D17 Batch C: THE DIAL SEAM — one field, routed to its OWNER ─────────────
// The Game Plan screen turns ~55 individual dials, and this is where the
// gameplan→book inversion actually flips: a dial stops being an edit to the
// flat bag and becomes an edit to whichever PART owns that field.
//
// Routing is not tidiness, it is CORRECTNESS. compilePlanParts layers
// overlay → book.plan → defbook.plan, so a book-owned field written to the
// overlay is silently SWALLOWED by the book on the next compile — the coach
// moves the dial, the screen re-renders from the compiled plan, and his change
// is simply gone. (Verified directly: setOverlay({defBaseFront:"3-4"}) on a
// synthesized school leaves the plan reading "4-3".) So:
//   'off'  → school.book.plan[key]
//   'def'  → school.defbook.plan[key]
//   team / unlisted → school.planOverlay[key]   (the controller layer)
//
// `undefined` DELETES the field from its bag rather than storing undefined —
// an absent field must stay absent through the round-trip (the sparse-plan law
// the split/compile pair is built on), and several dials clear by deleting.
function setPlanField(school, key, value) {
  return setPlanFields(school, { [key]: value });
}
// The batched form: one compile for a group of dials that move together (a
// posture preset, a Simple-mode lever). Prefer it over N setPlanField calls.
function setPlanFields(school, patch) {
  if (!school) return {};
  if (!school.book && !school.planOverlay) synthesizeTeamPlan(school, { force: true });
  if (!school.book) school.book = { schemaVersion: TEAMPLAN_SCHEMA_VERSION, name: "Offense", source: "staff", plan: {} };
  if (!school.defbook) school.defbook = { schemaVersion: TEAMPLAN_SCHEMA_VERSION, name: "Defense", source: "staff", plan: {} };
  if (!school.planOverlay) school.planOverlay = {};
  if (!school.book.plan) school.book.plan = {};
  if (!school.defbook.plan) school.defbook.plan = {};
  for (const key in patch) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
    const side = PLAN_FIELD_SIDE[key];
    const bag = side === "off" ? school.book.plan : side === "def" ? school.defbook.plan : school.planOverlay;
    if (patch[key] === undefined) delete bag[key];
    else bag[key] = _clone(patch[key]);
  }
  school.gameplan = compileTeamPlan(school);
  return school.gameplan;
}

// D17 Batch B: the WHOLE-PLAN twin of the two above. A writer that authors an
// entire plan in one go — the AI staff, a full library snapshot — sets all
// three parts from it. One split and ONE compile rather than two of each, which
// matters here: this runs for every school in a world (342 in a default league)
// and again whenever a staff re-authors.
function adoptPlan(school, plan, opts = {}) {
  if (!school) return {};
  const parts = splitTeamPlan(plan, { schoolName: school.name || null, ...opts });
  school.book = parts.book;
  school.defbook = parts.defbook;
  school.planOverlay = parts.overlay;
  school.gameplan = compilePlanParts(parts.book, parts.defbook, parts.overlay);
  return school.gameplan;
}
function adoptOffPlan(school, merged, opts = {}) {
  if (!school) return {};
  const parts = splitTeamPlan(merged, { schoolName: school.name || null, ...opts });
  setOverlay(school, parts.overlay);
  return assignBook(school, parts.book);
}
function adoptDefPlan(school, merged, opts = {}) {
  if (!school) return {};
  const parts = splitTeamPlan(merged, { schoolName: school.name || null, ...opts });
  setOverlay(school, parts.overlay);
  return assignDefBook(school, parts.defbook);
}

// Stage 4: THE one read for "the defensive book's named calls" (the live
// defensive headset's chips). Prefers the book's first-class home (calls — the
// Stage-3 migration target), then the manifest snapshot the book already owns
// (plan.defCalls), then the flat gameplan — so the headset genuinely reads the
// BOOK while every pre-book save keeps working unchanged.
function defBookCalls(school) {
  if (!school) return null;
  const db = school.defbook;
  if (db && db.calls && Object.keys(db.calls).length) return db.calls;
  if (db && db.plan && db.plan.defCalls && Object.keys(db.plan.defCalls).length) return db.plan.defCalls;
  return (school.gameplan && school.gameplan.defCalls) || null;
}

export {
  PLAN_FIELD_SIDE,
  TEAMPLAN_SCHEMA_VERSION,
  OFF_FIELDS,
  DEF_FIELDS,
  setPlanField,
  setPlanFields,
  adoptPlan,
  adoptOffPlan,
  adoptDefPlan,
  splitTeamPlan,
  compilePlanParts,
  compileTeamPlan,
  synthesizeTeamPlan,
  synthesizeLeaguePlans,
  assignBook,
  assignDefBook,
  setOverlay,
  defBookCalls,
  PLAN_BOOK_STRUCT_FIELDS,
  controllerOverlayOf,
  applyControllerOverlay
};
