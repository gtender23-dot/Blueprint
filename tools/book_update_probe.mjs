// book_update_probe.mjs — STAGE 3 COMPLETION of the Playbook-Root refactor
// ("Save plan" saves OVERLAYS; the snapshot-vs-library UPDATE PROMPT).
// Run: node tools/book_update_probe.mjs
//
// Pins:
//   S1  SOURCE STAMPS: a Workshop (pb:) load stamps the book's creation id +
//       saved time (via gameplan _fields → copied onto the book at synthesis);
//       a dd: load stamps the DEFBOOK and leaves the offense stamp alone; a
//       full-plan load clears both; stamps survive forced re-synthesis and a
//       save/load round-trip of the gameplan object; compile ≡ gameplan holds
//       throughout (byte-safety unchanged).
//   S2  UPDATE DETECTION + APPLY: a newer library saved-stamp is detectable
//       from the book; re-applying the source book (the one-tap update)
//       preserves the SITUATIONS overlay, team knobs, and the whole defense,
//       and refreshes the stamp so the prompt clears.
//   S3  OVERLAY SAVES: controllerOverlayOf excludes every structural book
//       field (looks/sheets/defensive identity/defCalls), roster-bound
//       fieldAssignments, the weekly plan and _internals — and keeps the
//       dials/weights/shares/situations/team knobs.
//   S4  OVERLAY LOADS: applyControllerOverlay onto a school carrying a
//       loaded book keeps the BOOK byte-identical (looks, sheets, front,
//       named calls), applies the saved controller, resets unnamed controller
//       fields to defaults, and compile ≡ gameplan after re-synthesis.
import {
  synthesizeTeamPlan, compileTeamPlan, controllerOverlayOf, applyControllerOverlay,
  PLAN_BOOK_STRUCT_FIELDS
} from '../js/engine/teamplan.js';
import { emptyPlaybook, applyPlaybookToGameplan, legalConceptsForFormation } from '../js/engine/playbook.js';
import { emptyDefBook, applyDefBookToGameplan } from '../js/engine/defbook.js';
import { defaultGameplan } from '../js/engine/world.js';

let pass = 0, fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}`); ok ? pass++ : fail++; };
const hdr = (s) => console.log(`\n${s}`);
function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
const same = (a, b) => stable(a) === stable(b);

// mirror the Game Plan's pb:/dd: load sequence exactly
function loadWorkshopBook(school, kind, data, id, savedStamp) {
  const merged = kind === 'pb' ? applyPlaybookToGameplan(data, school.gameplan) : applyDefBookToGameplan(data, school.gameplan);
  for (const k of Object.keys(school.gameplan)) { if (!k.startsWith('_')) delete school.gameplan[k]; }
  Object.assign(school.gameplan, merged);
  if (kind === 'pb') { school.gameplan._bookSourceId = id; school.gameplan._bookSourceSaved = savedStamp; }
  else { school.gameplan._defbookSourceId = id; school.gameplan._defbookSourceSaved = savedStamp; }
  synthesizeTeamPlan(school, { force: true });
}

function mkSchool() {
  const school = { name: 'Probe U', gameplan: defaultGameplan() };
  school.gameplan.situations = { openers: { tendency: 'Heavy Pass' }, red_zone: { runCommit: 5 } };
  school.gameplan.fourthDown = 'Aggressive';
  synthesizeTeamPlan(school, { force: true });
  return school;
}
const pb = emptyPlaybook('Audit Book');
pb.formations = [{ id: 'Spread', weight: 60 }, { id: 'Single Back', weight: 40 }];
const legal = legalConceptsForFormation('Spread');
pb.sheets = { Spread: { [legal[0]]: 60, [legal[1]]: 40 } };

hdr('S1 — source stamps ride the gameplan and land on the books');
{
  const school = mkSchool();
  loadWorkshopBook(school, 'pb', pb, 'playbook-abc', 1000);
  check(school.book.sourceId === 'playbook-abc' && school.book.sourceSaved === 1000, 'pb: load stamps book.sourceId/sourceSaved');
  check(school.book.source === 'creator:playbook-abc', `book.source names the creator (${school.book.source})`);
  check(same(compileTeamPlan(school), school.gameplan), 'compile ≡ gameplan after a stamped load');
  loadWorkshopBook(school, 'dd', emptyDefBook('Iron D'), 'defbook-xyz', 2000);
  check(school.defbook.sourceId === 'defbook-xyz' && school.defbook.sourceSaved === 2000, 'dd: load stamps the DEFBOOK');
  check(school.book.sourceId === 'playbook-abc', 'and leaves the offense stamp alone');
  synthesizeTeamPlan(school, { force: true });
  check(school.book.sourceId === 'playbook-abc' && school.defbook.sourceId === 'defbook-xyz', 'stamps survive a forced re-synthesis');
  const revived = { name: school.name, gameplan: JSON.parse(JSON.stringify(school.gameplan)) };
  synthesizeTeamPlan(revived, { force: true });
  check(revived.book.sourceId === 'playbook-abc', 'stamps survive a gameplan serialization round-trip (they ride the save)');
  // full-plan load clears both (mirror applyPlanToSchool's stamp clear)
  const fresh = Object.assign(defaultGameplan(), {});
  for (const k of Object.keys(school.gameplan)) { if (!k.startsWith('_')) delete school.gameplan[k]; }
  Object.assign(school.gameplan, fresh);
  delete school.gameplan._bookSourceId; delete school.gameplan._bookSourceSaved;
  delete school.gameplan._defbookSourceId; delete school.gameplan._defbookSourceSaved;
  synthesizeTeamPlan(school, { force: true });
  check(!school.book.sourceId && !school.defbook.sourceId, 'a full plan load clears both stamps');
}

hdr('S2 — update detection + the one-tap apply preserves the controller');
{
  const school = mkSchool();
  loadWorkshopBook(school, 'pb', pb, 'playbook-abc', 1000);
  const newer = { saved: 5000 };
  check((newer.saved || 0) > (school.book.sourceSaved || 0), 'a newer library stamp is detectable from the book');
  const keepSit = JSON.parse(JSON.stringify(school.gameplan.situations));
  const keepFourth = school.gameplan.fourthDown;
  const keepDefFront = school.gameplan.defBaseFront;
  // the update: re-apply the (edited) source book, refresh the stamp
  const pb2 = JSON.parse(JSON.stringify(pb));
  pb2.formations = [{ id: 'Air Raid', weight: 100 }];
  pb2.sheets = { 'Air Raid': { [legalConceptsForFormation('Air Raid')[0]]: 70 } };
  const merged = applyPlaybookToGameplan(pb2, school.gameplan);
  for (const k of Object.keys(school.gameplan)) { if (!k.startsWith('_')) delete school.gameplan[k]; }
  Object.assign(school.gameplan, merged);
  school.gameplan._bookSourceSaved = newer.saved;
  synthesizeTeamPlan(school, { force: true });
  check(school.book.plan.offFormations[0].id === 'Air Raid', 'the update re-pointed the book');
  check(same(school.gameplan.situations, keepSit), 'SITUATIONS overlay survived the update');
  check(school.gameplan.fourthDown === keepFourth && school.gameplan.defBaseFront === keepDefFront, 'team knobs + the defense survived');
  check(school.book.sourceSaved === 5000 && !((newer.saved || 0) > (school.book.sourceSaved || 0)), 'the stamp refreshed — the prompt clears');
}

hdr('S3 — controllerOverlayOf saves the controller, never the book');
{
  const school = mkSchool();
  loadWorkshopBook(school, 'pb', pb, 'playbook-abc', 1000);
  school.gameplan.defCalls = { 'Bear Storm': { front: '46/Bear' } };
  school.gameplan.fieldAssignments = { offense: { Spread: { slots: { WR_X: 'player-123' } } } };
  school.gameplan.tendency = 'Heavy Pass';
  school.gameplan.targetShares = { WR1: 30, WR2: 20, WR3: 14, TE1: 20, RB1: 16 };
  const ov = controllerOverlayOf(school.gameplan);
  const structLeaks = PLAN_BOOK_STRUCT_FIELDS.filter((f) => f in ov);
  check(structLeaks.length === 0, `no structural book field leaks into the save (${structLeaks.join(',') || 'none'})`);
  check(!('fieldAssignments' in ov), 'roster-bound fieldAssignments never enter the library');
  check(Object.keys(ov).every((k) => !k.startsWith('_')), 'no engine _internals in the save');
  check(ov.tendency === 'Heavy Pass' && ov.targetShares.WR1 === 30 && same(ov.situations, school.gameplan.situations) && ov.fourthDown === 'Aggressive', 'dials, shares, situations and team knobs are all in');
}

hdr('S4 — applyControllerOverlay loads onto ANY book, book untouched');
{
  const school = mkSchool();
  loadWorkshopBook(school, 'pb', pb, 'playbook-abc', 1000);
  school.gameplan.defCalls = { 'Bear Storm': { front: '46/Bear' } };
  synthesizeTeamPlan(school, { force: true });
  const bookBefore = stable({ f: school.gameplan.offFormations, s: school.gameplan.formationPlaybooks, d: school.gameplan.defBaseFront, c: school.gameplan.defCalls });
  const saved = { tendency: 'Heavy Run', rushInPct: 70, situations: { openers: { tendency: 'Heavy Run' } }, fourthDown: 'Conservative' };
  const merged = applyControllerOverlay(school.gameplan, saved, defaultGameplan());
  for (const k of Object.keys(school.gameplan)) { if (!k.startsWith('_')) delete school.gameplan[k]; }
  Object.assign(school.gameplan, merged);
  synthesizeTeamPlan(school, { force: true });
  const bookAfter = stable({ f: school.gameplan.offFormations, s: school.gameplan.formationPlaybooks, d: school.gameplan.defBaseFront, c: school.gameplan.defCalls });
  check(bookAfter === bookBefore, 'the BOOK is byte-identical through an overlay load (looks/sheets/front/named calls)');
  check(school.gameplan.tendency === 'Heavy Run' && school.gameplan.rushInPct === 70 && school.gameplan.fourthDown === 'Conservative', 'the saved controller applied');
  check(same(school.gameplan.situations, { openers: { tendency: 'Heavy Run' } }), 'situations came from the SAVE, not the old plan');
  const dflt = defaultGameplan();
  check(school.gameplan.passDepth && same(school.gameplan.passDepth, dflt.passDepth), 'an unnamed controller field reset to the default');
  check(school.book.sourceId === 'playbook-abc', 'the book kept its Workshop identity (stamps intact)');
  check(same(compileTeamPlan(school), school.gameplan), 'compile ≡ gameplan after the overlay load');
}

console.log(`\nBOOK UPDATE PROBE — ${pass} pass, ${fail} fail`);
console.log(fail ? 'BOOK UPDATE PROBE FAIL' : 'BOOK UPDATE PROBE PASS');
process.exit(fail ? 1 : 0);
