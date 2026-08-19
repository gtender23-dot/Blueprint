import { C } from '../../constants.js';
import { getCoach } from '../../engine/coachprofile.js';
import { generateCandidates } from '../../engine/staff.js';
import { coachDossierHtml } from './coachoffice.js';
import { adoptOffPlan, adoptDefPlan } from '../../engine/teamplan.js';
import { WORLDGEN_INFO, applyIdentityToSchool, assembleWorldSources, availableStates, generatePlayerProgram, generateWorld, rosterHintsFromBooks } from '../../engine/world.js';
import { navigate, notify, rerender, startNewGamePrepared, state } from '../../state.js';
import { repairCreation } from '../../engine/creatorrepair.js';
import { DEFAULT_OFF_BOOKS, DEFAULT_DEF_BOOKS, defaultOffBook, defaultDefBook } from '../../engine/defaultbooks.js';
import { BLUEPRINT_MARK } from '../logo.js';
import { listCreations, loadCreationData } from '../../engine/creator.js';
import { applyPlaybookToGameplan } from '../../engine/playbook.js';
import { applyDefBookToGameplan } from '../../engine/defbook.js';
import { escapeHtml, renderCrest } from '../../utils.js';

// The world the wizard shops in. Rebuilt only when the world SOURCE changes,
// which is one thing today: whether the start division comes from worldgen or
// from one of your saved leagues (owner call 2026-08-17 — Creator entrance #1,
// `Ref/CREATOR_ENTRANCES.md`). Season Mode and Play Now already read those
// shelves; the dynasty door was the last one that couldn't.
//
// IDENTITY ONLY, on purpose: a saved league carries names, colors, conferences
// and prestige, and `generateWorld` builds every roster in it fresh. Nothing
// authored in the Creator rides into a dynasty as players (owner, 2026-08-17).
function obGetWorld() {
  const key = ob.leagueId || "";
  if (_obWorld && _obWorldKey === key) return _obWorld;
  _obWorldKey = key;
  _obWorld = null;
  try {
    if (ob.leagueId) {
      const bp = loadCreationData("leagues", ob.leagueId);
      const rep = bp ? repairCreation("leagues", bp) : null;
      if (rep && rep.ok) {
        const div = bp.division || START_DIV;
        const src = assembleWorldSources({ [div]: { conferences: bp.conferences, teams: bp.teams } });
        _obWorld = generateWorld({ schools: src.schools, conferences: src.conferences });
      } else {
        // Never fail silently — the old bare catch is what let a stale creation
        // vanish without a word (AUDIT_2026-08-15).
        notify(rep ? `"${(bp && bp.name) || "That league"}" can't load in this build — using the standard world` : "That league is gone — using the standard world", "warning");
        ob.leagueId = null;
        _obWorldKey = "";
      }
    }
  } catch (e) {
    notify("That league wouldn't build — using the standard world", "warning");
    ob.leagueId = null;
    _obWorldKey = "";
    _obWorld = null;
  }
  if (!_obWorld) {
    try {
      _obWorld = generateWorld();
    } catch (e) {
      _obWorld = null;
    }
  }
  return _obWorld;
}
// The onboarding renumbers itself to the steps actually SHOWN. Every run is a
// tree run now — the founding job is take-the-job at the start division, which
// is the ONLY way into a dynasty (the main menu's PLANT A TREE door), so the
// Situation step (obStep 1) that used to pick a start type is gone entirely and
// the level is never asked for. Retired 2026-08-17, owner: "we only use the
// forced D3 start so you shouldn't even need to click on it." The engine's
// start machinery (`engine/starts.js`) is deliberately LEFT IN PLACE — the
// Ashes scholarship cap and Hot Seat leash are wired into recruiting.js and
// season.js, so this is a door closed, not a system torn out.
// obActiveSteps = every internal step shown (incl. the unnumbered Staff screen,
// obStep 4); obNumberedSteps = only the user-facing numbered ones.
function obActiveSteps() { return [0, 2, 3, 4, 5]; }
function obNumberedSteps() { return [0, 2, 3, 5]; }
function obStepLabel(s) { const i = obNumberedSteps().indexOf(s); return i >= 0 ? `STEP ${i + 1}` : ""; }
function renderNewGame() {
  // The coach's name is taken at the MAIN MENU (the PLANT A TREE door's one
  // form, #mm-nt-first/#mm-nt-last) and carried in on state._coachProfileName.
  // The wizard never asks for it again — do not add a name step here.
  if (state._coachProfileName && obStep === 0 && !ob.first && !ob.last) {
    ob.first = state._coachProfileName.first;
    ob.last = state._coachProfileName.last;
  }
  // Every run founds a career the same way: take the job, at the start
  // division. Neither is a question any more, so neither is a screen.
  ob.challenge = "takejob";
  ob.division = START_DIV;
  return `
  <div class="newgame ob">
    <div class="newgame-header">
      <div class="newgame-logo">
        <span class="logo-hex logo-hex-mark">${BLUEPRINT_MARK}</span>
        <h1>BLUEPRINT</h1>
        <p class="newgame-sub">Found Your Program</p>
      </div>
    </div>
    <div class="newgame-back">
      <button class="btn-ghost" id="btn-back-to-menu">\u2190 Main Menu</button>
    </div>
    <div class="ob-progress">
      ${obActiveSteps().map((i) => { const seq = obActiveSteps(); return `<span class="ob-dot${i === obStep ? " active" : seq.indexOf(i) < seq.indexOf(obStep) ? " done" : ""}"></span>`; }).join("")}
    </div>
    <div class="newgame-form-wrapper">
      <div class="newgame-card ob-card">
        ${renderStep()}
      </div>
    </div>
  </div>
`;
}
function renderStep() {
  switch (obStep) {
    case 0:
      return stepSignature();
    case 2:
      return stepJob();
    // world → state → the actual program
    case 3:
      return stepIdentity();
    case 4:
      return stepStaff();
    case 5:
      return stepReveal();
    default:
      return stepSignature();
  }
}
function stepStaff() {
  var _a;
  const hints = obHints();
  const key = hints.qbPref + "|" + hints.defFront + "|" + ob.division;
  if (obCand.key !== key) {
    const fakeSchool = { prestige: ob.challenge === "powerhouse" ? ((_a = C.PRESTIGE_MAX) == null ? void 0 : _a[ob.division]) || 4 : 2, division: ob.division };
    // Sort the OC list toward the book's leaning passer, the DC list toward what
    // its front asks of its coordinator — a QB-run designer for a mobile book,
    // run-fits for a 4-3, coverage/blitz otherwise.
    const ocSort = hints.qbPref === "QB-Scrambler" ? "qbRunDesign" : "passGame";
    const dcSort = hints.defFront === "4-3" ? "runFits" : "coverage";
    obCand = {
      key,
      oc: generateCandidates("OC", fakeSchool, 4).sort((a, b) => (b.ratings[ocSort] || 0) - (a.ratings[ocSort] || 0)),
      dc: generateCandidates("DC", fakeSchool, 4).sort((a, b) => (b.ratings[dcSort] || 0) - (a.ratings[dcSort] || 0))
    };
    ob.oc = null;
    ob.dc = null;
  }
  // [Owner report 2026-08-18] This step used to print a stub — name, salary and
  // six bare numbers — while the SAME hire made mid-career (Coach's Office →
  // hire market) showed the full dossier the owner asked for in Aug 2026: age,
  // ambition, scheme identity, specialty, colour-coded ratings and every
  // formation grade with its star tier. The first coordinator decision of a
  // dynasty is the one you make with the least information about the game, so
  // it needed the dossier most. Both doors now render coachDossierHtml.
  const pool = (side, list, picked) => `
  <div class="ob-kicker" style="margin-top:${side === "OC" ? "0" : "14px"}">${side === "OC" ? "OFFENSIVE COORDINATOR" : "DEFENSIVE COORDINATOR"}</div>
  ${list.map((c) => `
    <button class="ob-pick-card ob-staff-card staff-info${(picked == null ? void 0 : picked.id) === c.id ? " active" : ""}" data-ob-staff="${side}:${c.id}">
      ${coachDossierHtml(c)}
    </button>`).join("")}`;
  return `
  <div class="ob-step">
    <h2 class="ob-headline">Build your staff, Coach ${escapeHtml(ob.last || "")}</h2>
    <p class="ob-sub">Your coordinators carry the playbook \u2014 their scheme knowledge drives execution and discipline, and their salaries come from your program pool.</p>
    ${pool("OC", obCand.oc, ob.oc)}
    ${pool("DC", obCand.dc, ob.dc)}
    <div class="ob-nav-row">
      <button class="btn-ghost" data-ob-back="3">\u2190 Back</button>
      <button class="btn-primary ob-next" id="ob-next-4" ${!ob.oc || !ob.dc ? "disabled" : ""}>FOUND THE PROGRAM \u2192</button>
    </div>
  </div>`;
}
function stepSignature() {
  const s = state.settings || (state.settings = {});
  if (s.gameplanMode == null) s.gameplanMode = "simple";
  if (s.recruitAssist == null) s.recruitAssist = "full";
  const diffRow = (key, label, desc) => `
    <div class="ob-setting-row">
      <div class="ob-setting-label">${label}</div>
      <div class="ob-setting-desc">${desc}</div>
      <div class="gp-options" style="flex-wrap:wrap;margin-top:6px">
        ${[["freshman", "Freshman"], ["varsity", "Varsity"], ["allamerican", "All-American"], ["legend", "Legend"]].map(([v, l]) => `
          <button class="gp-option gp-option-sm${(s[key] || "varsity") === v ? " active" : ""}" data-ob-diff-key="${key}" data-ob-diff-val="${v}">${l}</button>`).join("")}
      </div>
    </div>`;
  const gpMode = s.gameplanMode === "advanced" ? "advanced" : "simple";
  return `
  <div class="ob-step">
    <div class="ob-kicker">${obStepLabel(0)} \u2014 THE GROUND RULES</div>
    <h2 class="ob-headline">Set the terms, Coach ${escapeHtml(ob.last || "")}.</h2>
    <p class="ob-flavor">How hard the world pushes back, and how much of the chalkboard you want to run yourself. You can change all of this later in Settings.</p>

    ${diffRow("difficulty", "On-Field Difficulty", "How well AI opponents EXECUTE in your games. Varsity is the pure game; Legend means every opponent plays its best game of the year, every week.")}
    ${diffRow("diffCoaching", "AI Coaching IQ", "How sharp opposing STAFFS are against you \u2014 weekly game-planning and halftime counters. Higher = they read your film harder and adjust faster.")}
    ${diffRow("diffRecruiting", "Recruiting Difficulty", "How hard rival programs push in recruiting battles. Higher = rivals spend faster and fight harder for contested kids.")}

    <div class="ob-setting-row">
      <div class="ob-setting-label">Game Planning</div>
      <div class="ob-setting-desc">Simple: a few big, plain-language dials \u2014 you set the identity and the sim handles the scheme. Advanced: every situational knob, formation split and coverage default is yours. The simulation is identical either way; this only changes how much of it you drive.</div>
      <div class="gp-mode-toggle" style="margin-top:6px">
        <button class="gp-mode-btn${gpMode === "simple" ? " active" : ""}" data-ob-gpmode="simple">Simple</button>
        <button class="gp-mode-btn${gpMode === "advanced" ? " active" : ""}" data-ob-gpmode="advanced">Advanced</button>
      </div>
      <div class="ob-setting-desc" style="margin-top:6px;opacity:.8">You can switch between Simple and Advanced any time from Settings \u203a Game \u203a Game Plan Detail \u2014 your plan carries over either way.</div>
    </div>

    ${(() => {
    const ra = s.recruitAssist === "assist" || s.recruitAssist === "full" ? "full" : "off";
    const RA = [
      ["off", "Off", "You run recruiting yourself \u2014 full control of the board."],
      ["full", "On", "Your staff builds and closes the whole class, hands-off."]
    ];
    return `
    <div class="ob-setting-row">
      <div class="ob-setting-label">Recruiting Assist</div>
      <div class="ob-setting-desc">How much of recruiting your staff handles for you. Love recruiting? Leave it off. Change it anytime in the Assist tab.</div>
      <div class="gp-options" style="flex-wrap:wrap;margin-top:6px">
        ${RA.map(([v, l, d]) => `<button class="gp-option gp-option-sm${ra === v ? " active" : ""}" data-ob-assist="${v}" title="${d}">${l}</button>`).join("")}
      </div>
    </div>`;
  })()}

    <button class="btn-primary ob-next" id="ob-next-0" style="margin-top:16px">LET'S GO \u2192</button>
  </div>
`;
}
// The two starting-book pickers used to live up here on the ground-rules screen,
// two screens away from the QB room and the front they dress. They moved to the
// Blueprint step (owner, 2026-08-17) so every scheme choice is made in one
// place; the element ids are unchanged so the appliers and the smokes that
// drive them did not move with them.
// \u2500\u2500 The books ARE the identity (2026-08-17, owner) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// The old Blueprint step asked a QB type and a defensive front as separate
// questions, then shaped the roster off the answer. That's retired: the coach
// picks his OFFENSIVE BOOK and his DEFENSIVE BOOK here \u2014 the same starters,
// presets removed (owner: "delete them completely") \u2014 and the roster leans off
// the books (rosterHintsFromBooks in world.js). One identity choice, not three.
//
// Each option resolves to the ACTUAL book object so a card can describe what it
// runs and what it does to the roster. "Team default" is null \u2014 the staff sets
// the book and the roster arrives as generated. Custom Workshop books sit beside
// the starters and are read exactly the same way (off their formations / front).

// One-line "what this does to your first roster," derived, never a coefficient.
function offRosterLean(book) {
  const h = rosterHintsFromBooks(book, null).qbPref;
  return h === "QB-Gunslinger" ? "leans your roster toward a big-armed passer and a deep receiver room"
    : h === "QB-Scrambler" ? "leans your roster toward a dual-threat quarterback who can run it"
    : h === "QB-Game-Manager" ? "leans your roster toward a ball-control quarterback and a heavy backfield"
    : h === "QB-Pocket" ? "leans your roster toward a pocket passer and balanced skill players"
    : "your staff sets the offense and the roster arrives balanced";
}
function defRosterLean(book) {
  const f = rosterHintsFromBooks(null, book).defFront;
  return f === "3-4" ? "leans your front toward two-gap ends and stand-up rush linebackers"
    : f === "4-3" ? "leans your front toward speed off the edge"
    : "your staff sets the front and the bodies arrive balanced";
}
// No "team default" (owner, 2026-08-17): a book is a required pick, so the
// roster always leans off a real book. Only actual books appear — the starters
// and the coach's own Workshop creations.
function offOptions() {
  const out = [];
  for (const b of DEFAULT_OFF_BOOKS) out.push({ id: "dpb:" + b.name, label: b.name, sub: b.tendency ? String(b.tendency) : "Starter book", book: b, kind: "starter" });
  for (const pb of listCreations("playbooks")) {
    const data = loadCreationData("playbooks", pb.id);
    out.push({ id: "pb:" + pb.id, label: pb.data.name || "Untitled", sub: "Your custom playbook", book: data, kind: "custom" });
  }
  return out;
}
function defOptions() {
  const out = [];
  for (const b of DEFAULT_DEF_BOOKS) out.push({ id: "ddb:" + b.name, label: b.name, sub: (b.baseFront || "") + " base", book: b, kind: "starter" });
  for (const db of listCreations("defbooks")) {
    const data = loadCreationData("defbooks", db.id);
    out.push({ id: "dd:" + db.id, label: db.data.name || "Untitled", sub: "Your custom defense", book: data, kind: "custom" });
  }
  return out;
}
// Resolve a picked id back to its book object. "" / null → null (team default);
// a starter is looked up by name, a custom by its creation id. Repair-on-load a
// custom so a stale one still reads its front/formations for the hint (and never
// fails silently — the book application later re-checks and warns if it can't
// actually apply).
function bookById(kind, id) {
  if (!id) return null;
  if (kind === "off") {
    if (id.startsWith("dpb:")) return DEFAULT_OFF_BOOKS.find((b) => b.name === id.slice(4)) || null;
    if (id.startsWith("pb:")) { const raw = loadCreationData("playbooks", id.slice(3)); const r = raw ? repairCreation("playbooks", raw) : null; return r ? r.data : null; }
    return null;
  }
  if (id.startsWith("ddb:")) return DEFAULT_DEF_BOOKS.find((b) => b.name === id.slice(4)) || null;
  if (id.startsWith("dd:")) { const raw = loadCreationData("defbooks", id.slice(3)); const r = raw ? repairCreation("defbooks", raw) : null; return r ? r.data : null; }
  return null;
}
// The two roster hints the engine consumes, resolved from the CURRENT book
// picks. Either may be null — that side of the roster is left as generated.
function obHints() {
  return rosterHintsFromBooks(bookById("off", ob.startPlan), bookById("def", ob.startDef));
}
function bookCard(o, active, lean, ariaGroup) {
  return `
    <button class="ob-pick-card ob-book-card${active ? " active" : ""}" data-ob-book="${ariaGroup}" data-ob-book-id="${escapeHtml(o.id)}">
      <div class="ob-pick-head"><span class="ob-pick-title">${escapeHtml(o.label)}</span>${o.kind === "custom" ? '<span class="ob-book-tag">yours</span>' : ""}</div>
      <div class="ob-pick-sub">${escapeHtml(o.sub)}</div>
      <div class="ob-pick-desc">${escapeHtml(lean(o.book))}</div>
    </button>`;
}
// Creator entrance #1 \u2014 the world you'll coach in. Collapsed by default and
// skipped entirely by the fast path: the standard world is already selected, so
// a coach who doesn't build leagues never opens this. Only leagues saved at the
// START DIVISION are offered, because that's the only chair a founding coach
// can sit in \u2014 a D1 league has no job in it for him.
function renderWorldPicker() {
  const leagues = listCreations("leagues").filter((l) => (l.data.division || "D1") === START_DIV);
  const open = ob.worldOpen || !!ob.leagueId;
  const cur = ob.leagueId ? leagues.find((l) => l.id === ob.leagueId) : null;
  return `
  <div class="ob-expander${open ? " open" : ""}">
    <button class="ob-expander-head" data-ob-expand="world">
      <span class="ob-expander-title">THE WORLD \u2014 ${cur ? escapeHtml(cur.name) : "the standard world"}</span>
      <span class="ob-expander-caret">${open ? "\u25be" : "\u25b8"}</span>
    </button>
    ${open ? `
    <div class="ob-expander-body">
      <p class="ob-flavor" style="margin-top:0">Play the dynasty inside a league you built in the Workshop. Your conferences, your programs, your names on the wall \u2014 the rosters are generated fresh either way.</p>
      <div class="ob-league-list">
        <button class="ob-league-row${!ob.leagueId ? " active" : ""}" data-ob-league="">
          <span class="ob-league-name">The standard world</span>
          <span class="ob-league-sub">A fresh procedural country, every program invented on the spot</span>
        </button>
        ${leagues.map((l) => `
          <button class="ob-league-row${ob.leagueId === l.id ? " active" : ""}" data-ob-league="${escapeHtml(l.id)}">
            <span class="ob-league-name">${escapeHtml(l.name)}</span>
            <span class="ob-league-sub">${(l.data.teams || []).length} programs \u00b7 ${(l.data.conferences || []).length} conference${(l.data.conferences || []).length === 1 ? "" : "s"} \u00b7 ${escapeHtml(l.data.division || START_DIV)}</span>
          </button>`).join("")}
      </div>
      ${leagues.length ? "" : `<div class="ob-start-preview ob-start-none">No ${START_DIV} leagues saved yet. Build one in the Workshop \u2014 Main Menu \u203a Creator \u203a Leagues \u2014 and it will show up here.</div>`}
    </div>` : ""}
  </div>`;
}
// Creator entrance #2 \u2014 coach a team you made. It founds a NEW program wearing
// your team's identity rather than repainting somebody else's, which is both
// the honest reading of "my team" and the only one that leaves the rest of the
// world's history intact. Identity only: name, mascot, colors, crest. Authored
// rosters are ignored on purpose (owner, 2026-08-17) \u2014 a dynasty recruits its
// own players or it isn't a dynasty.
function renderTeamPicker() {
  const teams = listCreations("teams");
  const open = ob.teamOpen || !!ob.teamId;
  const cur = ob.teamId ? teams.find((t) => t.id === ob.teamId) : null;
  return `
  <div class="ob-expander${open ? " open" : ""}">
    <button class="ob-expander-head" data-ob-expand="team">
      <span class="ob-expander-title">COACH MY OWN TEAM \u2014 ${cur ? escapeHtml(cur.name) : "off"}</span>
      <span class="ob-expander-caret">${open ? "\u25be" : "\u25b8"}</span>
    </button>
    ${open ? `
    <div class="ob-expander-body">
      <p class="ob-flavor" style="margin-top:0">Found the program yourself and put one of your created teams on the field. It takes the open conference seat in the state you pick; the players are recruited, not imported.</p>
      <div class="ob-league-list">
        <button class="ob-league-row${!ob.teamId ? " active" : ""}" data-ob-team="">
          <span class="ob-league-name">Off</span>
          <span class="ob-league-sub">Take one of the jobs already on the board</span>
        </button>
        ${teams.map((t) => `
          <button class="ob-league-row${ob.teamId === t.id ? " active" : ""}" data-ob-team="${escapeHtml(t.id)}">
            <span class="ob-league-name">${escapeHtml(t.data.name || t.name)}${t.data.nick ? ` <span class="muted">${escapeHtml(t.data.nick)}</span>` : ""}</span>
            <span class="ob-league-sub">built as ${escapeHtml(t.data.division || "D1")} \u00b7 joins as ${START_DIV}</span>
          </button>`).join("")}
      </div>
      ${teams.length ? "" : `<div class="ob-start-preview ob-start-none">No teams saved yet. Build one in the Workshop \u2014 Main Menu \u203a Creator \u203a Teams \u2014 and it will show up here.</div>`}
    </div>` : ""}
  </div>`;
}
function stepJob() {
  const states = availableStates().filter((s) => s.state !== "HI" && s.state !== "AK");
  const byRegion = {};
  for (const { state: st } of states) {
    let region = "Midwest", bestN = 0;
    for (const [r, cities] of Object.entries(WORLDGEN_INFO.REGION_CITIES)) {
      const n = cities.filter((c) => c.s === st).length;
      if (n > bestN) {
        bestN = n;
        region = r;
      }
    }
    (byRegion[region] = byRegion[region] || []).push(st);
  }
  return `
  <div class="ob-step">
    <div class="ob-kicker">${obStepLabel(2)} \u2014 THE JOB</div>
    <h2 class="ob-headline">Where does the story begin, Coach ${escapeHtml(ob.last || "")}?</h2>
    <p class="ob-flavor">${ob.teamId ? "Pick the state your program calls home. It takes an open seat in that state's conference \u2014 a brand-new program, wearing your colors." : "Pick a state, then choose the program you want to take over. Real towns, invented programs, and a hundred years of history already on the wall."}</p>

    ${renderWorldPicker()}
    ${renderTeamPicker()}

    <div class="ob-state-groups">
      ${Object.entries(byRegion).map(([region, sts]) => `
        <div class="ob-state-group">
          <div class="ob-region-label">${escapeHtml(REGION_LABELS[region] || region)}</div>
          <div class="ob-state-chips">
            ${sts.map((st) => `<button class="ob-chip${ob.state === st ? " active" : ""}" data-ob-state="${st}" title="${escapeHtml(STATE_NAMES[st] || st)}">${st}</button>`).join("")}
          </div>
        </div>`).join("")}
    </div>

    ${ob.state ? renderSchoolPicker() : ""}

    <div class="ob-nav-row">
      <button class="btn-ghost" data-ob-back="0">\u2190 Back</button>
      <button class="btn-primary ob-next" id="ob-next-2" ${!ob.state || !ob.schoolId ? "disabled" : ""}>
        ${ob.schoolId === "__found__" ? "FOUND IT \u2192" : ob.schoolId ? "TAKE THE JOB \u2192" : "PICK A PROGRAM"}
      </button>
    </div>
  </div>`;
}
function renderSchoolPicker() {
  const w = obGetWorld();
  const list = ((w == null ? void 0 : w.schools) || []).filter((s) => s.state === ob.state && s.division === ob.division);
  const stName = escapeHtml(STATE_NAMES[ob.state] || ob.state);
  list.sort((a, b) => b.prestige - a.prestige);
  const myTeam = ob.teamId ? loadCreationData("teams", ob.teamId) : null;
  // Coaching your own team IS founding one — there is no other job on the board
  // for it, so the board isn't shown.
  if (myTeam) {
    return `
    <div class="ob-kicker" style="margin-top:16px">THE PROGRAM</div>
    <div class="ob-school-list">
      <button class="ob-school-row ob-school-found active" data-ob-school="__found__">
        <div class="ob-school-top">
          <span class="ob-school-name">\u{1F331} ${escapeHtml(myTeam.name || "Your program")}${myTeam.nick ? ` ${escapeHtml(myTeam.nick)}` : ""}</span>
          <span class="ob-school-star">${ob.division}</span>
        </div>
        <div class="ob-school-sub">Your team, founded in ${stName} — a real town, a conference seat waiting</div>
        <div class="ob-school-hw ob-school-bare">your name, your colors, your crest — and a roster you have to go recruit</div>
      </button>
    </div>`;
  }
  const foundRow = `
  <button class="ob-school-row ob-school-found${ob.schoolId === "__found__" ? " active" : ""}" data-ob-school="__found__">
    <div class="ob-school-top">
      <span class="ob-school-name">\u{1F331} Found a new program</span>
      <span class="ob-school-star">${ob.division}</span>
    </div>
    <div class="ob-school-sub">A brand-new ${ob.division} program in ${stName} \u2014 a real town, a conference seat waiting</div>
    <div class="ob-school-hw ob-school-bare">no banners, no ghosts, no excuses \u2014 the traditions start with you</div>
    <div class="ob-school-at">you'll inherit the vacated seat's rival, and nothing else</div>
  </button>`;
  if (!list.length) {
    return `
    <div class="ob-kicker" style="margin-top:16px">THE PROGRAM</div>
    <div class="ob-start-preview ob-start-none" style="margin-bottom:7px">Nobody plays ${ob.division} football in ${stName} \u2014 yet.</div>
    <div class="ob-school-list">${foundRow}</div>`;
  }
  return `
  <div class="ob-kicker" style="margin-top:16px">THE PROGRAM <span class="muted" style="font-weight:400;letter-spacing:0">\u2014 ${list.length} hiring</span></div>
  <div class="ob-school-list">
    ${list.map((s) => {
    const L = s.lore;
    const hw = L ? [
      L.titles.length ? `\u{1F3C6} ${L.titles.length} national` : "",
      L.confTitles.length ? `\u{1F947} ${L.confTitles.length} conf` : "",
      L.legend ? `\u{1F464} ${escapeHtml(L.legend.name)} era` : ""
    ].filter(Boolean).join(" \xB7 ") : "";
    const at = L == null ? void 0 : L.allTime;
    return `
      <button class="ob-school-row${ob.schoolId === s.id ? " active" : ""}" data-ob-school="${s.id}">
        <div class="ob-school-top">
          <span class="ob-school-name"><span class="ob-school-mark">${renderCrest(s, 24)}</span><span>${escapeHtml(s.name)}</span></span>
          <span class="ob-school-star">${s.prestige.toFixed(1)}\u2605</span>
        </div>
        <div class="ob-school-sub">${escapeHtml(s.city)}, ${s.state} \xB7 ${escapeHtml(s.nick)} \xB7 ${escapeHtml(s.conf)}</div>
        ${hw ? `<div class="ob-school-hw">${hw}</div>` : '<div class="ob-school-hw ob-school-bare">no banners \u2014 nobody has ever won here</div>'}
        ${at ? `<div class="ob-school-at">all-time ${at.wins}\u2013${at.losses}${at.ties ? `\u2013${at.ties}` : ""}${s.rival ? ` \xB7 rival: ${escapeHtml(s.rival.name)} (${s.rival.wins}\u2013${s.rival.losses})` : ""}</div>` : ""}
      </button>`;
  }).join("")}
    ${foundRow}
  </div>`;
}
function stepIdentity() {
  const offs = offOptions();
  const defs = defOptions();
  return `
  <div class="ob-step">
    <div class="ob-kicker">${obStepLabel(3)} \u2014 THE BLUEPRINT</div>
    <h2 class="ob-headline">Pick your books, Coach ${escapeHtml(ob.last || "")}.</h2>
    <p class="ob-flavor">Your offensive and defensive books ARE your identity \u2014 and your first roster is built loosely to fit them. Nothing's locked: every dial is yours on the Game Plan screen, and you can load a different book any week.</p>
    <div class="ob-section-label">OFFENSIVE BOOK</div>
    <div class="ob-card-grid ob-grid-2">
      ${offs.map((o) => bookCard(o, ob.startPlan === o.id, offRosterLean, "off")).join("")}
    </div>
    <div class="ob-section-label">DEFENSIVE BOOK</div>
    <div class="ob-card-grid ob-grid-2">
      ${defs.map((o) => bookCard(o, ob.startDef === o.id, defRosterLean, "def")).join("")}
    </div>
    <div class="ob-nav-row">
      <button class="btn-ghost" data-ob-back="2">\u2190 Back</button>
      <button class="btn-primary ob-next" id="ob-next-3" ${!ob.startPlan || !ob.startDef ? "disabled" : ""}>FOUND THE PROGRAM \u2192</button>
    </div>
  </div>
`;
}
function renderHeritageBlurb(s) {
  const L = s.lore;
  if (!L) return "";
  if (L.founded) {
    return `<p class="ob-heritage ob-heritage-new">No banners. No ghosts. No excuses. ${escapeHtml(L.tradition)}${s.rival ? ` \u2014 and ${escapeHtml(s.rival.name)} already leads the series ${s.rival.losses}\u2013${s.rival.wins}.` : "."}</p>`;
  }
  const at = L.allTime;
  const bits = [];
  if (L.titles.length) bits.push(`<b>${L.titles.length} national title${L.titles.length > 1 ? "s" : ""}</b> (${L.titles.join(", ")})`);
  if (L.confTitles.length) bits.push(`${L.confTitles.length} conference championship${L.confTitles.length > 1 ? "s" : ""}`);
  if (L.legend) bits.push(`the <b>${escapeHtml(L.legend.name)}</b> era (${L.legend.from}\u2013${L.legend.to}, ${L.legend.wins}\u2013${L.legend.losses})`);
  const scandal = L.events.find((e) => e.kind === "scandal");
  return `
  <div class="ob-heritage">
    <div class="ob-heritage-line"><b>Football here since ${L.footballSince}</b> \xB7 all-time ${at.wins}\u2013${at.losses}${at.ties ? `\u2013${at.ties}` : ""}</div>
    ${bits.length ? `<div class="ob-heritage-line">${bits.join(" \xB7 ")}</div>` : `<div class="ob-heritage-line ob-heritage-bare">Nobody has ever won anything here. That's the job.</div>`}
    ${s.rival ? `<div class="ob-heritage-line">\u2694\uFE0F <b>${escapeHtml(s.rival.name)}</b> \u2014 ${s.rival.wins}\u2013${s.rival.losses}${s.rival.ties ? `\u2013${s.rival.ties}` : ""} since ${s.rival.since}${s.rival.trophy ? ` \xB7 ${escapeHtml(s.rival.trophy)}` : ""}</div>` : ""}
    ${scandal ? `<div class="ob-heritage-line ob-heritage-scar">${scandal.year}: ${escapeHtml(scandal.text)}</div>` : ""}
    <div class="ob-heritage-line ob-heritage-trad">\u{1F3BA} ${escapeHtml(L.tradition)}</div>
  </div>`;
}
function ordinalCoach(s) {
  var _a;
  const since = ((_a = s.lore) == null ? void 0 : _a.footballSince) || 1900;
  const n = Math.max(2, Math.round((2026 - since) / 7));
  const sfx = n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th";
  return `${n}${sfx}`;
}
function stepReveal() {
  var _a, _b, _c;
  if (generating || !pending) {
    return `
    <div class="ob-step ob-generating">
      <div class="ob-kicker">FOUNDING\u2026</div>
      <div class="ob-spinner">\u2B21</div>
      <p class="ob-flavor">Pouring the concrete. Painting the end zones. Hiring a guy named Dale to run the chain gang.</p>
    </div>
  `;
  }
  const { school: s, replaced, conference } = pending.result;
  const maxPips = ((_a = C.PRESTIGE_MAX) == null ? void 0 : _a[s.division]) || 5;
  const stName = STATE_NAMES[s.state] || s.state;
  return `
  <div class="ob-step">
    <div class="ob-kicker">${obStepLabel(5)} \u2014 THE PRESS CONFERENCE</div>
    <div class="ob-reveal" style="--rv1:${s.colors[0]};--rv2:${s.colors[1]}">
      <div class="ob-reveal-banner">
        <span class="ob-reveal-logo">${renderCrest(s, 64)}</span>
        <div class="ob-reveal-title">
          <div class="ob-reveal-name">${escapeHtml(s.name)}</div>
          <div class="ob-reveal-nick">${escapeHtml(s.nick)}</div>
        </div>
      </div>
      <div class="ob-reveal-body">
        <p class="ob-headline-news">${escapeHtml(s.city.toUpperCase())}, ${escapeHtml(s.state)} \u2014 ${escapeHtml(s.name)} has named <strong>${escapeHtml(ob.first)} ${escapeHtml(ob.last)}</strong> ${pending.result.takeover ? `its ${ordinalCoach(s)} head coach.` : "the first head coach in program history."}</p>
        <div class="ob-reveal-rows">
          <div class="ob-rv-row"><span>Home</span><span>${escapeHtml(s.city)}, ${escapeHtml(stName)} \xB7 est. ${s.founded || "\u2014"}</span></div>
          <div class="ob-rv-row"><span>Stadium</span><span>${escapeHtml(((_b = s.stadium) == null ? void 0 : _b.name) || "\u2014")} (${(((_c = s.stadium) == null ? void 0 : _c.capacity) || 0).toLocaleString()})</span></div>
          <div class="ob-rv-row"><span>Enrollment</span><span>${(s.enrollment || 0).toLocaleString()} students</span></div>
          <div class="ob-rv-row"><span>Conference</span><span>${escapeHtml(conference.name)} \xB7 ${s.division}</span></div>
          <div class="ob-rv-row"><span>Prestige</span>${renderPrestigePips(s.prestige, maxPips)}</div>
        </div>
        ${replaced ? `<p class="ob-replaced">The ${escapeHtml(s.nick)} take the place of ${escapeHtml(replaced.name)}, whose program folded this spring.</p>` : ""}
        ${renderHeritageBlurb(s)}
      </div>
    </div>
    <div class="ob-nav-row">
      ${!pending.result.takeover ? `<button class="btn-ghost" id="ob-reroll">\u21BB SPIN A NEW PROGRAM</button>` : ""}
      <button class="btn-primary ob-next" id="ob-start">TAKE THE JOB \u2192</button>
    </div>
    <div class="ob-alt"><a href="#" data-ob-back="3">\u2190 change the blueprint</a></div>
  </div>
`;
}
// Your created team's IDENTITY, stamped over the program that was just founded.
// The same shape Play Now uses (makeCreatorTeam), minus the authored stars:
// a dynasty's roster is recruited, never imported (owner, 2026-08-17). Prestige
// is NOT taken from the creation either — the founding program's prestige is
// what the division and the world decided, and a created team can't buy its way
// past that on the way in.
function stampCreatorTeam(school) {
  if (!ob.teamId || !school) return;
  const c = loadCreationData("teams", ob.teamId);
  if (!c) { notify("That team is gone — founding with a generated identity", "warning"); return; }
  if (c.name) school.name = c.name;
  if (c.nick) school.nick = c.nick;
  if (Array.isArray(c.colors) && c.colors.length === 2) school.colors = c.colors;
  if (c.crestText) school.crestText = c.crestText;
  if (c.crestSeed) school.crestSeed = c.crestSeed;
  if (c.logo) school.logo = c.logo;
  school._creatorTeam = true;
}
function buildPending() {
  const world = obGetWorld() || generateWorld();
  // The books lean the roster now (owner, 2026-08-17): resolve the picks to the
  // same {qbPref, defFront} the shaper always took. Either can be null — that
  // side arrives as generated.
  const hints = obHints();
  // Two jobs exist: take one that's on the board, or found one. Coaching a
  // created team is always the second.
  const founding = ob.teamId != null || ob.schoolId === "__found__";
  if (!founding) {
    const school = world.schools.find((s) => s.id === ob.schoolId) || null;
    if (school) {
      applyIdentityToSchool(school, hints.qbPref, hints.defFront);
      if (ob.oc && ob.dc) school.staff = { oc: ob.oc, dc: ob.dc };
      return {
        world,
        result: {
          school,
          replaced: null,
          takeover: true,
          startId: "takejob",
          startPick: null,
          conference: { id: school.conf, name: school.conf, short: school.conf, division: school.division }
        }
      };
    }
  }
  const result = generatePlayerProgram(world, {
    state: ob.state,
    division: ob.division,
    qbPref: hints.qbPref,
    defFront: hints.defFront,
    challenge: "takejob"
  });
  result.startId = "takejob";
  stampCreatorTeam(result.school);
  if (ob.oc && ob.dc) result.school.staff = { oc: ob.oc, dc: ob.dc };
  return { world, result };
}
function devTakeJobStart() {
  const rand2 = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const world = obGetWorld() || generateWorld();
  _obWorld = world;
  const d1 = world.schools.filter((s) => s.division === "D1");
  const school = rand2(d1.length ? d1 : world.schools);
  ob.challenge = "takejob";
  ob.first = ob.first || "Dev";
  ob.last = ob.last || "Coach";
  ob.schoolId = school.id;
  ob.state = school.state;
  ob.division = school.division;
  // Dev quick-start: open with the first starter book each side.
  ob.startPlan = DEFAULT_OFF_BOOKS.length ? "dpb:" + DEFAULT_OFF_BOOKS[0].name : "";
  ob.startDef = DEFAULT_DEF_BOOKS.length ? "ddb:" + DEFAULT_DEF_BOOKS[0].name : "";
  ob.oc = null;
  ob.dc = null;
  const p = buildPending();
  obStep = 0;
  startNewGamePrepared({ first: ob.first, last: ob.last }, p.world, p.result.school, p.result);
  state.settings = state.settings || {};
  state.settings.challenge = "takejob";
}
function setupListeners3() {
  var _a, _c, _d, _e, _f, _g, _h, _i;
  (_a = document.getElementById("btn-back-to-menu")) == null ? void 0 : _a.addEventListener("click", () => {
    navigate("mainmenu");
  });
  document.querySelectorAll("[data-ob-diff-key]").forEach((btn) => btn.addEventListener("click", () => {
    if (!state.settings) state.settings = {};
    state.settings[btn.dataset.obDiffKey] = btn.dataset.obDiffVal;
    rerender();
  }));
  document.querySelectorAll("[data-ob-gpmode]").forEach((btn) => btn.addEventListener("click", () => {
    if (!state.settings) state.settings = {};
    state.settings.gameplanMode = btn.dataset.obGpmode;
    rerender();
  }));
  document.querySelectorAll("[data-ob-assist]").forEach((btn) => btn.addEventListener("click", () => {
    if (!state.settings) state.settings = {};
    state.settings.recruitAssist = btn.dataset.obAssist;
    rerender();
  }));
  // The book cards ARE the Blueprint step now — one grid per side, "" means
  // team default. Re-render so the picked card lights and its lean line shows.
  document.querySelectorAll("[data-ob-book]").forEach((b) => b.addEventListener("click", () => {
    const id = b.dataset.obBookId || "";
    if (b.dataset.obBook === "off") ob.startPlan = id;
    else ob.startDef = id;
    rerender();
  }));
  (_c = document.getElementById("ob-next-0")) == null ? void 0 : _c.addEventListener("click", () => {
    if (!ob.first && !ob.last) {
      if (state._coachProfileName) {
        ob.first = state._coachProfileName.first;
        ob.last = state._coachProfileName.last;
      } else {
        ob.first = "Coach";
        ob.last = "Player";
      }
    }
    obStep = 2;
    rerender();
  });
  document.querySelectorAll("[data-ob-state]").forEach((b) => b.addEventListener("click", () => {
    ob.state = b.dataset.obState;
    // Founding your own team is the job no matter which state it's in, so the
    // pick survives the move; every other pick is a specific school and can't.
    ob.schoolId = ob.teamId ? "__found__" : null;
    rerender();
  }));
  document.querySelectorAll("[data-ob-school]").forEach((b) => b.addEventListener("click", () => {
    ob.schoolId = b.dataset.obSchool;
    rerender();
  }));
  document.querySelectorAll("[data-ob-expand]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.obExpand;
    if (k === "world") ob.worldOpen = !ob.worldOpen;
    if (k === "team") ob.teamOpen = !ob.teamOpen;
    rerender();
  }));
  document.querySelectorAll("[data-ob-league]").forEach((b) => b.addEventListener("click", () => {
    const id = b.dataset.obLeague || null;
    if (id === ob.leagueId) return;
    ob.leagueId = id;
    // A different world is a different set of jobs — the state survives, the
    // school it pointed at does not.
    ob.schoolId = ob.teamId ? "__found__" : null;
    obGetWorld();
    rerender();
  }));
  document.querySelectorAll("[data-ob-team]").forEach((b) => b.addEventListener("click", () => {
    const id = b.dataset.obTeam || null;
    if (id === ob.teamId) return;
    ob.teamId = id;
    ob.schoolId = id ? ob.state ? "__found__" : null : null;
    rerender();
  }));
  (_e = document.getElementById("ob-next-2")) == null ? void 0 : _e.addEventListener("click", () => {
    if (ob.state && ob.schoolId) {
      obStep = 3;
      rerender();
    }
  });
  (_f = document.getElementById("ob-next-3")) == null ? void 0 : _f.addEventListener("click", () => {
    // A book each side is required — no team default (owner, 2026-08-17).
    if (!ob.startPlan || !ob.startDef) return;
    obStep = 4;
    rerender();
  });
  document.querySelectorAll("[data-ob-staff]").forEach((b) => b.addEventListener("click", () => {
    const [side, id] = b.dataset.obStaff.split(":");
    const pick2 = (side === "OC" ? obCand.oc : obCand.dc).find((c) => c.id === id);
    if (side === "OC") ob.oc = pick2;
    else ob.dc = pick2;
    rerender();
  }));
  (_g = document.getElementById("ob-next-4")) == null ? void 0 : _g.addEventListener("click", () => {
    if (!ob.oc || !ob.dc) return;
    obStep = 5;
    pending = null;
    generating = true;
    rerender();
    setTimeout(() => {
      try {
        pending = buildPending();
      } catch (e) {
        console.error(e);
        alert("Founding failed: " + e.message);
        obStep = 4;
      }
      generating = false;
      rerender();
    }, 30);
  });
  (_h = document.getElementById("ob-reroll")) == null ? void 0 : _h.addEventListener("click", () => {
    pending = null;
    generating = true;
    rerender();
    setTimeout(() => {
      try {
        pending = buildPending();
      } catch (e) {
        console.error(e);
        alert("Founding failed: " + e.message);
        obStep = 4;
      }
      generating = false;
      rerender();
    }, 30);
  });
  (_i = document.getElementById("ob-start")) == null ? void 0 : _i.addEventListener("click", async () => {
    var _a2, _b2, _c2, _d2;
    if (!pending) return;
    try {
      const { world, result } = pending;
      pending = null;
      obStep = 0;
      await startNewGamePrepared({ first: ob.first, last: ob.last }, world, result.school, result);
      state.settings = state.settings || {};
      state.settings.challenge = "takejob";
      {
        const school2 = state.world.schools.find((s) => s.id === state.playerSchoolId);
        // ── D17 BATCH A: the books become the truth here ────────────────────
        // This site is THE stale-book bug. It runs AFTER startNewGamePrepared
        // has already synthesized every school's plan, and the old idiom
        // (delete every non-underscore key, Object.assign the merge) rewrote
        // only the flat bag — so a dynasty was born with school.book still
        // describing the STAFF's plan, not the book the coach just chose, and
        // nothing the chosen book said could bind afterwards.
        // adoptOffPlan / adoptDefPlan route the merge through the parts
        // (setOverlay + assignBook/assignDefBook), so the book IS what was
        // picked and the flat gameplan is recompiled from it. Field-for-field
        // identical to the old idiom — proven in playbook_root_probe §10.
        //
        // The _bookStarter / _defbookStarter markers are stamped onto the MERGE
        // rather than onto the live gameplan afterwards: underscore keys ride
        // the overlay, so stamping pre-adopt is what makes them survive the
        // next recompile. (Stamping after would work until the first dial
        // moved, then vanish — which is exactly how "Edit defense" lost the
        // full book the first time.)
        // The whole-game PRESETS were removed from the wizard (owner, 2026-08-17):
        // startPlan is now only "" (team default), a starter book (dpb:), or a
        // custom playbook (pb:). Defense is applied separately below, so the two
        // sides never fight over the same dials the way a preset used to.
        if (school2 && ob.startPlan && ob.startPlan.startsWith("dpb:")) {
          // A starter book opens the season (always current-build-legal).
          const book = defaultOffBook(ob.startPlan.slice(4));
          // Remember WHICH starter it was, so "Edit playbook" can re-open the
          // full book. applyPlaybookToGameplan JSON-clones the gameplan, so the
          // marker is stamped AFTER, on the live gameplan (owner, 2026-08-18).
          if (book) { try { const merged = applyPlaybookToGameplan(book, school2.gameplan); merged._bookStarter = book.name; adoptOffPlan(school2, merged, { offName: book.name, source: "starter" }); } catch (e) { notify(`Couldn't apply "${book.name}" — starting with the staff's plan`, "warning"); } }
        }
        else if (school2 && ob.startPlan && ob.startPlan.startsWith("pb:")) {
          // A custom playbook opens the season: copy its formations + concepts.
          // Repair-on-load first — and never fail SILENTLY (the old bare catch
          // meant a stale book simply didn't apply and nobody was told).
          const pbRaw = loadCreationData("playbooks", ob.startPlan.slice(3));
          if (pbRaw) {
            const rep = repairCreation("playbooks", pbRaw);
            if (rep.ok) { try { adoptOffPlan(school2, applyPlaybookToGameplan(rep.data, school2.gameplan), { offName: rep.data.name || null }); if (rep.changes.length) notify(`Playbook updated for this build: ${rep.changes[0]}`, "warning"); } catch (e) { notify(`Couldn't apply "${pbRaw.name || "playbook"}" — starting with the staff's plan`, "warning"); } }
            else notify(`"${pbRaw.name || "Playbook"}" can't load in this build — starting with the staff's plan`, "warning");
          }
        }
        // A custom defense opens the season alongside the offense (swaps only the
        // defensive dials, so it composes with either preset or custom offense).
        if (school2 && ob.startDef && ob.startDef.startsWith("ddb:")) {
          const book = defaultDefBook(ob.startDef.slice(4));
          // Remember WHICH starter defense it was, so "Edit defense" re-opens the
          // full book — its shelves (named calls) and answers, not a lossy
          // identity-only extract that came up with an empty call sheet (owner,
          // 2026-08-18: "the defensive playbook should be absorbing the defense
          // default selections").
          if (book) { try { const merged = applyDefBookToGameplan(book, school2.gameplan); merged._defbookStarter = book.name; adoptDefPlan(school2, merged, { defName: book.name, source: "starter" }); } catch (e) { notify(`Couldn't apply "${book.name}" — starting with the staff's defense`, "warning"); } }
        } else if (school2 && ob.startDef && ob.startDef.startsWith("dd:")) {
          const dbRaw = loadCreationData("defbooks", ob.startDef.slice(3));
          if (dbRaw) {
            const rep = repairCreation("defbooks", dbRaw);
            if (rep.ok) { try { adoptDefPlan(school2, applyDefBookToGameplan(rep.data, school2.gameplan), { defName: rep.data.name || null }); if (rep.changes.length) notify(`Defense updated for this build: ${rep.changes[0]}`, "warning"); } catch (e) { notify(`Couldn't apply "${dbRaw.name || "defense"}" — starting with the staff's defense`, "warning"); } }
            else notify(`"${dbRaw.name || "Defense"}" can't load in this build — starting with the staff's defense`, "warning");
          }
        }
      }
      if (state._coachId) {
        const prof = getCoach(state._coachId);
        const school2 = state.world.schools.find((s) => s.id === state.playerSchoolId);
        if (((_d2 = (_c2 = prof == null ? void 0 : prof.plans) == null ? void 0 : _c2.practice) == null ? void 0 : _d2[0]) && school2) {
          const pp = JSON.parse(JSON.stringify(prof.plans.practice[0].pp));
          if (pp.positionPlans) school2.positionPlans = pp.positionPlans;
          if (pp.practiceMinutes) school2.practiceMinutes = pp.practiceMinutes;
        }
      }
      rerender();
    } catch (e) {
      console.error(e);
      alert("Error starting game: " + e.message);
    }
  });
  document.querySelectorAll("[data-ob-back]").forEach((b) => b.addEventListener("click", (e) => {
    e.preventDefault();
    obStep = parseInt(b.dataset.obBack);
    rerender();
  }));
}
function renderPrestigePips(p, max = 5) {
  const filled = Math.max(0, Math.min(Math.round(p || 0), max));
  return `<span class="prestige-pips">${"\u25CF".repeat(filled)}${"\u25CB".repeat(max - filled)}</span>`;
}
var obStep, _obWorld, _obWorldKey, START_DIV, ob, pending, generating, REGION_LABELS, STATE_NAMES, obCand;

obStep = 0;
_obWorld = null;
_obWorldKey = "";
// Where every career starts. Read from the tree's own constant rather than
// spelled "D3" in eight places — if the tree ever seats its first coach
// somewhere else, the wizard follows it without an edit.
START_DIV = (C.TREE && C.TREE.START_DIVISION) || "D3";
ob = {
  first: "",
  last: "",
  state: null,
  division: null,
  challenge: "takejob",
  schoolId: null,
  oc: null,
  dc: null,
  // The starting books — the identity choice. A book is REQUIRED (owner: no team
  // default), so these default to the first starter of each side and the coach
  // changes them; the FOUND button won't fire until both are a real pick.
  startPlan: DEFAULT_OFF_BOOKS.length ? "dpb:" + DEFAULT_OFF_BOOKS[0].name : "",
  startDef: DEFAULT_DEF_BOOKS.length ? "ddb:" + DEFAULT_DEF_BOOKS[0].name : "",
  // Creator entrances — both default to off, both collapsed.
  leagueId: null,
  teamId: null,
  worldOpen: false,
  teamOpen: false
};
pending = null;
generating = false;
REGION_LABELS = {
  Northeast: "Northeast",
  MidAtlantic: "Mid-Atlantic",
  Southeast: "Southeast",
  DeepSouth: "Deep South",
  MidSouth: "Mid-South",
  GreatLakes: "Great Lakes",
  Midwest: "Midwest",
  UpperMidwest: "Upper Midwest",
  Plains: "Plains",
  Southwest: "Southwest",
  MountainWest: "Mountain West",
  PacificNW: "Pacific Northwest",
  // The 'California' region spans CA, NV and AZ — labelling it "California"
  // filed Nevada under a state it isn't in. The internal key stays California
  // (worldgen, nicknames, name patterns all reference it); only the label moves.
  California: "West Coast",
  Hawaii: "Hawaii",
  Alaska: "Alaska"
};
STATE_NAMES = {
  AL: "Alabama",
  AR: "Arkansas",
  AZ: "Arizona",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  IA: "Iowa",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  MA: "Massachusetts",
  MD: "Maryland",
  ME: "Maine",
  MI: "Michigan",
  MN: "Minnesota",
  MO: "Missouri",
  MS: "Mississippi",
  MT: "Montana",
  NC: "North Carolina",
  ND: "North Dakota",
  NE: "Nebraska",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NV: "Nevada",
  NY: "New York",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VA: "Virginia",
  VT: "Vermont",
  WA: "Washington",
  WI: "Wisconsin",
  WV: "West Virginia",
  WY: "Wyoming"
};
obCand = { oc: [], dc: [], key: null };

export { devTakeJobStart, renderNewGame, setupListeners3, setupListeners3 as setupListeners };
