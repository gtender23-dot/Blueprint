import { __spreadProps, __spreadValues } from './_spread.js';
import { C, DEFAULT_PRACTICE } from './constants.js';
import { optimizeDepthChart, setAIGameplan, setAIPracticePlan } from './engine/ai.js';
import { ensureCareerFields } from './engine/career.js';
import { ensureSkills, freshSkills } from './engine/coach.js';
import { createCoach, unfoldDnaToSkills } from './engine/coachprofile.js';
import { ensureHCMastery } from './engine/staff.js';
import { foundTree, ensureTree, activateSlot as treeActivateSlot, syncTreeRecord } from './engine/tree.js';
import { computeAutoRedshirtCandidates } from './engine/development.js';
import { ensureFieldAssignments } from './engine/fieldassign.js';
import { synthesizeLeaguePlans } from './engine/teamplan.js';
import { archiveInstantClassic, classicMetadata } from './engine/instantclassics.js';
import { commitSeasonGoals, initPreseason } from './engine/offseason.js';
import { listSaves, loadGame, saveGame, deleteSlotData } from './engine/persistence.js';
import { initBudget } from './engine/recruiting.js';
import { activateCoachedChair, advanceDay, beginCoachedGame, coachedGamesForDay, coachedSchoolIds, getPhase, playerGameOpponentForDay, restoreCoachWeekChair, resumeFromFourthDown, resumeFromHalftime, resumeFromPlayCall, simCurrentCoachedGame, weekLabel, weekShort } from './engine/season.js';
import { finishInteractiveGame, resumeFromCall, resumeFromDecision, setAutoCounter, simulateFirstHalf, stepSecondHalf } from './engine/sim.js';
import { applyStart } from './engine/starts.js';
import { generateRecruitPool, generateSchedule, generateWorld, hashStr, repairRecruitLocations } from './engine/world.js';
import { fullName, uuid } from './utils.js';

function makeInheritedTrophy(a, b) {
  if (a.state === b.state) return `The ${a.state} Trophy`;
  const OPTS = ["The Interstate Rail", "The Border Bell", "The Commonwealth Chain", "The Frontier Anvil", "The Crossroads Cup", "The Turnpike Trophy", "The Boundary Stone", "The Republic Rivet"];
  const idx = hashStr(a.state + "|" + b.state) % OPTS.length;
  return OPTS[idx];
}
function setRenderFn(fn) {
  _renderFn = fn;
}
function rerender() {
  if (_renderFn) _renderFn();
}
function setNotifyFn(fn) {
  _notifyFn = fn;
}
function notify(text, type = "info", duration = 3500) {
  if (_notifyFn) {
    _notifyFn(text, type, duration);
    return;
  }
  state.ui.notification = { text, type, id: uuid() };
  rerender();
  setTimeout(() => {
    state.ui.notification = null;
    rerender();
  }, duration);
}
// [PLAYTEST 2026-08-12 items 25 + 26] A job change now has two visible
// consequences beyond the headline. Both career-move surfaces (the offer card and
// the Coach's Office shortlist) report them the same way.
function notifyJobMoveCosts(result) {
  const bits = [];
  if (result && result.carriedGameplan) bits.push("Your game plan came with you \u2014 formations, fronts and situational calls. Depth-chart pins stayed behind with the old roster.");
  if (result && result.forfeitedBudget > 0) bits.push(`You left $${Math.round(result.forfeitedBudget).toLocaleString()} of unspent budget behind \u2014 it was the old program's money.`);
  if (bits.length) notify(bits.join(" "), "info", 7e3);
}
function navSnapshot() {
  var _a;
  const mc = typeof document !== "undefined" ? document.querySelector(".main-content") : null;
  return {
    view: state.ui.view,
    params: state.ui.params || {},
    scoutSchoolId: (_a = state.ui.scoutSchoolId) != null ? _a : null,
    // Group pages are one view with several tabs — without the tab, Back can
    // return to the right group on the WRONG tab (program/standings → team
    // page → navigate('schedule') → Back → Back used to land on
    // program/schedule, not the standings you left).
    groupTab: state.ui.view === "team" ? teamGroupTab : state.ui.view === "program" ? programGroupTab : state.ui.view === "season" ? seasonGroupTab : state.ui.view === "statsgroup" ? statsGroupTab : null,
    scroll: {
      main: mc ? mc.scrollTop : 0,
      win: typeof window !== "undefined" ? window.scrollY || 0 : 0
    }
  };
}
function pushNav() {
  if (!state.ui.view || NO_HISTORY_VIEWS.has(state.ui.view)) return;
  const h = state.ui.navHistory = state.ui.navHistory || [];
  const snap = navSnapshot();
  const top = h[h.length - 1];
  if (top && typeof top === "object" && top.view === snap.view && top.scoutSchoolId === snap.scoutSchoolId && top.groupTab === snap.groupTab && JSON.stringify(top.params) === JSON.stringify(snap.params)) return;
  h.push(snap);
  if (h.length > 30) h.shift();
}
function setGroupTab(groupId, tabId) {
  if (groupId === "team") teamGroupTab = tabId;
  else if (groupId === "program") programGroupTab = tabId;
  else if (groupId === "season") seasonGroupTab = tabId;
  else if (groupId === "statsgroup") statsGroupTab = tabId;
}
function navigate(view, params = {}) {
  const map = LEGACY_VIEW_MAP[view];
  if (map) view = map[0];
  const sameScreen = view === state.ui.view && JSON.stringify(params || {}) === JSON.stringify(state.ui.params || {});
  if (!sameScreen) pushNav();
  if (map) setGroupTab(view, map[1]);
  if (NO_HISTORY_VIEWS.has(view)) state.ui.navHistory = [];
  if (view === "manual") state.ui.manualChapter = params.chapter || null;
  // "Opened from the main menu" flag lives only across the menu→manual hop; any
  // other navigation clears it so the IN-GAME manual (dynasty shell) still shows
  // when a game is loaded. See the manual gate in app.js.
  if (view !== "manual") state.ui.manualFromMenu = false;
  state.ui.view = view;
  state.ui.params = params;
  state.ui.sidebarOpen = false;
  rerender();
}
function openSchool(schoolId) {
  pushNav();
  state.ui.pcardId = null;
  state.ui.scoutSchoolId = schoolId;
  state.ui.view = "scout";
  state.ui.params = {};
  state.ui.sidebarOpen = false;
  rerender();
}
function navigateBack() {
  var _a;
  if (state.ui.pcardId) {
    state.ui.pcardId = null;
    rerender();
    return;
  }
  if (state.ui.showInbox) {
    state.ui.showInbox = false;
    rerender();
    return;
  }
  const prev = (_a = state.ui.navHistory) == null ? void 0 : _a.pop();
  if (!prev) return;
  const snap = typeof prev === "string" ? { view: prev, params: {}, scroll: null } : prev;
  if (NO_HISTORY_VIEWS.has(snap.view)) return;
  state.ui.view = snap.view;
  state.ui.params = snap.params || {};
  if (snap.groupTab) setGroupTab(snap.view, snap.groupTab);
  if (snap.scoutSchoolId != null) state.ui.scoutSchoolId = snap.scoutSchoolId;
  state.ui._navRestoreScroll = snap.scroll || null;
  state.ui.sidebarOpen = false;
  rerender();
}
function startNewGame(coachName, schoolId) {
  const world = generateWorld();
  const school = world.schools.find((s) => s.id === schoolId);
  if (!school) throw new Error(`School not found: ${schoolId}`);
  const [first, ...rest] = (coachName || "").trim().split(" ");
  return finishNewGame(world, school, first || "Coach", rest.join(" ") || "Player", null);
}
function startNewGamePrepared({ first, last }, world, school, custom = null) {
  if (!state._coachId) {
    try {
      const prof = createCoach(first || "Coach", last || "");
      if (prof) state._coachId = prof.id;
    } catch (e) {
    }
  }
  return finishNewGame(world, school, first || "Coach", last || "Player", custom);
}
function startSeasonRun(world, school) {
  // Season Mode reuses the full dynasty setup (a real coach shell, schedule,
  // AI gameplans) so every in-season screen and the coach-your-game flow work
  // unchanged — but it flags itself so recruiting and the offseason never
  // engage (engine guards on state.seasonMode) and the run stops at the
  // champion. No coach profile or tree is founded.
  state._treeId = null;
  state._coachId = null;
  // Flag the run BEFORE setup so any save triggered during finishNewGame lands
  // in the dedicated "season" slot, never "auto" (which would show up as a
  // dynasty Continue). finishNewGame's Object.assign doesn't touch these fields.
  state.seasonMode = true;
  state.seasonOver = false;
  state._saveSlot = "season";
  finishNewGame(world, school, "Head", "Coach", null);
  state.seasonMode = true;
  state.ui.seasonComplete = null;
  // Replace the dynasty welcome mail (scholarships / non-conference / recruiting)
  // with a Season Mode note — no recruiting, no offseason, one title to chase.
  state.inbox = [{ id: uuid(), day: 1, subject: "Season Kickoff", body: `Welcome, Coach. One season with ${school.name}. Win your games, take the conference, and chase the ${school.division || "D1"} title — no recruiting, no offseason, just ball. Good luck.`, read: false }];
  // Skip the four preseason camp weeks — Season Mode is games only. Day 4 means
  // the first CONTINUE advances into Week 1 (day 5, the first game day).
  state.day = 4;
  // Write the dedicated season save immediately so the run is resumable from the
  // very start (autosave otherwise waits for the first completed week).
  saveGame(state, "season").catch(() => {});
  navigate("dashboard");
}
function exitSeasonRun() {
  // Leave the run and wipe the backing dynasty state so a later dynasty never
  // inherits the seasonMode flag or this world. The dedicated "season" save is
  // LEFT INTACT here (that's what Resume Season loads) unless the season is over
  // — a finished run has already deleted its save (see the season-complete
  // handler), so there's nothing to resume.
  state.seasonMode = false;
  state.seasonOver = false;
  state.initialized = false;
  state._saveSlot = null;
  state.ui.seasonComplete = null;
  state.world = null;
  state.playerCoach = null;
  state.playerSchoolId = null;
  navigate("mainmenu");
}
function finishNewGame(world, school, first, last, custom) {
  var _a;
  for (const s of world.schools) {
    if (s.id === school.id) continue;
    setAIGameplan(s);
    optimizeDepthChart(s);
    setAIPracticePlan(s);
  }
  const playerCoach = {
    id: "player",
    name: { first, last },
    isAI: false,
    schoolId: school.id,
    prestige: school.prestige,
    reputation: "C",
    loyalty: "B-",
    // The run clock (DNA TREE §8): a fresh career starts young on purpose —
    // the runway IS the run. Ticks in updateJobSecurity each wrap-up.
    age: C.COACH_AGE.PLAYER_START_MIN + Math.floor(Math.random() * (C.COACH_AGE.PLAYER_START_MAX - C.COACH_AGE.PLAYER_START_MIN + 1)),
    skills: freshSkills(),
    budget: 0,
    budgetCarryover: 0,
    scholarshipsAvailable: 0,
    recruitBoard: [],
    scouted: {},
    // { recruitId: true } — fog of war the player has personally lifted
    practiceMinutes: __spreadValues({}, DEFAULT_PRACTICE),
    promises: [],
    seasonRecord: { wins: 0, losses: 0 },
    careerWins: 0,
    careerLosses: 0,
    titles: 0,
    jobSecurity: C.JOBSEC_START,
    // 0–100 hot-seat meter
    status: "employed",
    // 'employed' | 'unemployed'
    tenureSeasons: 0,
    // seasons at current school (for grace + loyalty)
    lastDelta: null,
    // prior season's (actualWins − expectedWins), for streak firing
    dominanceStreak: 0,
    // consecutive dominant seasons (Chunk 9 promotion gate)
    lastOfferSeason: null
    // season offers last appeared (for the offer cooldown)
  };
  school.coach = playerCoach;
  // [PLAYTEST 2026-08-12 item 20] Every coach starts on a prove-it deal. Without
  // one, `yearsLeft` evaluated to 0, which satisfies the `< 2` extension gate —
  // so the very first contract landed after season 1, exactly the thing the owner
  // said shouldn't happen. Two years is the AD saying "show me."
  playerCoach.contract = {
    startSeason: 1,
    endSeason: 1 + C.PROVE_IT_YEARS,
    years: C.PROVE_IT_YEARS,
    termLabel: "Prove-It"
  };
  // [DNA TREE §5b.2] His formation sheet exists from day one — rolled cold.
  try {
    ensureHCMastery(playerCoach);
  } catch (e) {
  }
  // [DNA TREE §4 D3] A career started from an existing profile that earned
  // recruiter/developer DNA gets those grades floor-mapped back onto the
  // skill ladder — a man keeps what he earned. No-op for fresh profiles.
  try {
    if (state._coachId) unfoldDnaToSkills(state._coachId, playerCoach);
  } catch (e) {
  }
  for (const s of world.schools) {
    try {
      ensureFieldAssignments(s.gameplan);
    } catch (e) {
    }
  }
  world.recruits = generateRecruitPool(world);
  if ((custom == null ? void 0 : custom.startId) && custom.startId !== "founder") {
    applyStart({ playerCoach, season: 1, world }, school, custom.startId, custom.startPick);
  }
  if (custom == null ? void 0 : custom.takeover) school.coach = playerCoach;
  const playerSeniors = school.roster.filter((p) => p.classYear === "SR").length;
  const openSlots = Math.max(0, C.ROSTER_SIZE - school.roster.length) + playerSeniors;
  initBudget(playerCoach, openSlots, 0, school, 1);
  for (const s of world.schools) {
    if (s.id !== school.id && s.coach) {
      const seniors = s.roster.filter((p) => p.classYear === "SR").length;
      const slots = Math.max(0, C.ROSTER_SIZE - s.roster.length) + seniors;
      initBudget(s.coach, slots, 0, s);
    }
  }
  // [Playbook-Root Stage 1] Every school now carries the named object model —
  // book / defbook / planOverlay — synthesized from its finalized gameplan. This
  // is byte-neutral: the gameplan object each writer produced is untouched, and
  // compileTeamPlan(school) deep-equals it by construction. Run last, after every
  // gameplan writer (AI, wizard, applyStart) has settled.
  try {
    synthesizeLeaguePlans(world);
  } catch (e) {
  }
  const schedule = generateSchedule(world, 1, []);
  state._exhibition = false;
  state._exhStash = null;
  state._instantClassicReplay = null;
  Object.assign(state, {
    initialized: true,
    season: 1,
    day: 1,
    playerSchoolId: school.id,
    playerCoach,
    world,
    schedule,
    playoffs: null,
    allPlayoffs: null,
    bowls: null,
    offseason: null,
    postseasonMode: null,
    pendingWalkOns: null,
    rivalry: null,
    preseason: null,
    jobOpenings: null,
    pendingNonConfChoices: [],
    inbox: [
      custom ? { id: uuid(), day: 1, subject: `A New Era in ${school.city}`, body: `${school.city}, ${school.state} \u2014 ${school.name} has named ${first} ${last} the first head coach in program history. The ${school.nick} join the ${((_a = custom.conference) == null ? void 0 : _a.name) || school.conf}${custom.replaced ? `, taking the place of ${custom.replaced.name} after that program folded` : ""}. You have $${(playerCoach.budget / 1e3).toFixed(1)}k to spend on ${playerCoach.scholarshipsAvailable} scholarships. Non-conference play starts Week 3. Build something.`, read: false } : { id: uuid(), day: 1, subject: "Welcome to the Program", body: `Welcome, Coach ${first} ${last}! Season 1 begins. You have $${(playerCoach.budget / 1e3).toFixed(1)}k to spend on ${playerCoach.scholarshipsAvailable} scholarships. Non-conference play starts on Week 3. Good luck!`, read: false }
    ],
    gameLog: [],
    signingsLog: [],
    instantClassics: [],
    // [W9 §12] Cleared explicitly: without this, founding a legacy dynasty
    // straight after playing a tree would inherit the previous run's overlay
    // and the new coach would wake up holding somebody else's branches.
    tree: null
  });
  // ── [W9 §12] Plant the tree ──────────────────────────────────────────────
  // Growth rule 1: a tree run starts one way — take a job, one coach slot, the
  // bottom. The wizard forces the division; this attaches the tree to the world
  // it will own forever and seats the trunk. Gated on _treeId, which only a
  // tree new-game sets — a legacy new-game leaves state.tree null and pays
  // nothing.
  if (state._treeId && state._coachId) {
    try {
      import('./engine/coachprofile.js').then((m) => m.updateCoach(state._coachId, (c) => {
        c.name = { first: (first || "Coach").slice(0, 16), last: (last || "").slice(0, 16) };
      })).catch(() => {
      });
      foundTree(state, { treeId: state._treeId, coachId: state._coachId });
    } catch (e) {
      console.warn("W9 foundTree:", e.message);
    }
  }
  if (school.rival) {
    state.rivalry = {
      schoolId: school.rival.schoolId,
      schoolName: school.rival.name,
      trophy: school.rival.trophy || makeInheritedTrophy(school, school.rival),
      sinceSeason: null,
      // older than the save — see school.rival.since
      since: school.rival.since,
      holderId: school.rival.holderId,
      wins: school.rival.wins,
      losses: school.rival.losses,
      ties: school.rival.ties || 0,
      inherited: true
    };
  }
  commitSeasonGoals(state, 1);
  initPreseason(state);
  school.pendingRedshirts = computeAutoRedshirtCandidates(school, 1);
  autosave();
  navigate("dashboard");
}
async function saveNow() {
  return autosave();
}
// ── [W9 §12] Switching which coach you are ────────────────────────────────
// The only UI-facing door into activateSlot. One save, landing AFTER the swap.
// The swap is synchronous and total — parks one overlay, installs the other in
// a single tick — so there is no half-switched state to protect against.
async function switchTreeSlot(division) {
  if (!ensureTree(state)) return { ok: false, reason: "Not a tree game." };
  const res = treeActivateSlot(state, division);
  if (res.ok) {
    await autosave();
    notify(`You're now coaching ${res.schoolName || division}.`, "info", 3200);
    rerender();
  } else {
    notify(res.reason, "warning", 4e3);
  }
  return res;
}
async function autosave() {
  var _a, _b, _c;
  if (state._exhibition) return true;
  if (state.seasonMode) {
    // Season Mode has its OWN dedicated slot, separate from every dynasty save,
    // and stops saving once the season is over (a finished run isn't resumable).
    // Skips the tree/coach meta blocks below — a season has neither.
    if (!state.seasonOver) await saveGame(state, "season");
    return true;
  }
  const slot = state._saveSlot || "auto";
  const ok = await saveGame(state, slot);
  // [W9 §12] A tree's world save is the TRUTH; the localStorage tree record is
  // the menu's snapshot of it, exactly as noteWorldMeta is for a legacy world.
  // Written here so the two can only ever be one autosave apart. Inert on every
  // non-tree save (ensureTree returns null).
  if (ok && ensureTree(state)) {
    try {
      const { noteTreeMeta } = await import('./engine/coachprofile.js');
      const school = getPlayerSchool();
      syncTreeRecord(state);
      noteTreeMeta(state.tree.id, {
        season: state.season,
        day: state.day,
        active: state.tree.active,
        school: (school == null ? void 0 : school.name) || "?",
        record: (school == null ? void 0 : school.record) ? { wins: school.record.wins, losses: school.record.losses } : null,
        coaches: Object.keys(state.tree.slots || {}).filter((d) => {
          var _a2;
          return !((_a2 = state.tree.slots[d]) == null ? void 0 : _a2.retired);
        }).length,
        // [W9 §12] The tree's world is one save; its Instant Classics ride along
        // in the menu snapshot so the Coaching Tree screen can list them without
        // opening the 40 MB world — same relationship the legacy world card has.
        classics: (state.instantClassics || []).map(classicMetadata).filter(Boolean)
      });
    } catch (e) {
    }
  }
  // A TREE world has no numbered coach slot — it belongs to the tree, and the
  // block above is its index. The !state.tree guard stops this writing
  // c.worlds[undefined] on every tree autosave.
  if (ok && state._coachId && state._saveSlot && !state.tree) {
    try {
      const { noteWorldMeta: noteWorldMeta2 } = await import('./engine/coachprofile.js');
      const school = getPlayerSchool();
      const pc = state.playerCoach;
      noteWorldMeta2(
        state._coachId,
        state._worldSlot,
        {
          school: (school == null ? void 0 : school.name) || "?",
          season: state.season,
          record: (school == null ? void 0 : school.record) ? { wins: school.record.wins, losses: school.record.losses } : null,
          division: (school == null ? void 0 : school.division) || null,
          prestige: (school == null ? void 0 : school.prestige) != null ? +school.prestige.toFixed(1) : null,
          careerWins: (_a = pc == null ? void 0 : pc.careerWins) != null ? _a : 0,
          careerLosses: (_b = pc == null ? void 0 : pc.careerLosses) != null ? _b : 0,
          titles: (_c = pc == null ? void 0 : pc.titles) != null ? _c : 0,
          jobSecurity: (pc == null ? void 0 : pc.jobSecurity) != null ? Math.round(pc.jobSecurity) : null,
          skills: (pc == null ? void 0 : pc.skills) ? Object.fromEntries(
            Object.entries(pc.skills).map(([k, v]) => {
              var _a2;
              return [k, typeof v === "number" ? Math.round(v) : (_a2 = v == null ? void 0 : v.xp) != null ? _a2 : 0];
            })
          ) : null,
          classics: (state.instantClassics || []).map(classicMetadata).filter(Boolean)
        }
      );
    } catch (e) {
    }
  }
  if (!ok) notify("Autosave FAILED \u2014 storage is full or blocked. Your progress will not survive closing the app.", "error", 6e3);
  return ok;
}
function getPlayerSchool() {
  var _a;
  return (_a = state.world) == null ? void 0 : _a.schools.find((s) => s.id === state.playerSchoolId);
}
function getScoutSchool() {
  var _a;
  return (_a = state.world) == null ? void 0 : _a.schools.find((s) => s.id === state.ui.scoutSchoolId);
}
function getSchool(id) {
  var _a;
  return (_a = state.world) == null ? void 0 : _a.schools.find((s) => s.id === id);
}
function getRecruit(id) {
  var _a;
  return (_a = state.world) == null ? void 0 : _a.recruits.find((r) => r.id === id);
}
function getBoardEntry(recruitId) {
  var _a;
  return (_a = state.playerCoach) == null ? void 0 : _a.recruitBoard.find((e) => e.recruitId === recruitId);
}
function getAllBoardEntries(recruitId) {
  var _a, _b, _c;
  const entries = [];
  if ((_a = state.playerCoach) == null ? void 0 : _a.recruitBoard) entries.push(...state.playerCoach.recruitBoard.filter((e) => e.recruitId === recruitId));
  for (const school of ((_b = state.world) == null ? void 0 : _b.schools) || []) {
    if ((_c = school.coach) == null ? void 0 : _c.recruitBoard) entries.push(...school.coach.recruitBoard.filter((e) => e.recruitId === recruitId));
  }
  return entries;
}
function getUpcomingGame() {
  const reg = state.schedule.find((g) => g.day >= state.day && !g.result && (g.homeId === state.playerSchoolId || g.awayId === state.playerSchoolId));
  if (reg) return reg;
  const bracket = state.playoffs;
  if (bracket == null ? void 0 : bracket.rounds) {
    for (const round of bracket.rounds) {
      if (round.complete) continue;
      const g = (round.games || []).find((g2) => !g2.result && (g2.homeId === state.playerSchoolId || g2.awayId === state.playerSchoolId));
      if (g) return __spreadProps(__spreadValues({}, g), { day: round.day, postseason: true });
    }
  }
  return null;
}
function getConferenceStandings() {
  const school = getPlayerSchool();
  if (!school) return [];
  return state.world.schools.filter((s) => s.conf === school.conf).sort((a, b) => b.record.confWins - a.record.confWins || b.record.wins - a.record.wins);
}
function getWeekLabel() {
  return weekLabel(state.day);
}
function getWeekShort() {
  return weekShort(state.day);
}
function getPhaseLabel() {
  return { RECRUITING: "Recruiting Open", PRESEASON: "Preseason", NONCONF: "Non-Conference", CONFERENCE: "Conference", CONFCHAMP: "Conf. Championship", PLAYOFFS: "Playoffs", JOBS: "Offseason/Jobs", OFFSEASON: "Offseason" }[getPhase(state.day)] || "Offseason";
}
async function advanceDay2() {
  var _a, _b;
  if (state.seasonMode && state.seasonOver) {
    // The season is decided — never advance past it (that would roll toward a
    // second season). Re-show the champion takeover instead.
    if (!state.ui.seasonComplete) {
      const me = getPlayerSchool();
      state.ui.seasonComplete = { division: (me == null ? void 0 : me.division) || "D1", champion: (state.playoffs == null ? void 0 : state.playoffs.champion) || null };
    }
    rerender();
    return;
  }
  if (((_a = state.playerCoach) == null ? void 0 : _a.status) === "unemployed") {
    notify("You must accept a new job before continuing.", "warning");
    navigate("coachoffice");
    return;
  }
  if (state.pendingHalftime) {
    if ((_b = state.pendingHalftime.token) == null ? void 0 : _b.pending) {
      if (state.pendingHalftime.token.pending.kind === "fourth") {
        notify("Make your 4th-down call before continuing.", "warning");
        state.ui.showFourthDown = true;
      } else {
        notify("Send in your play call before continuing.", "warning");
        state.ui.showCallSheet = true;
      }
    } else {
      notify("Finish your halftime adjustments before continuing.", "warning");
      state.ui.showHalftime = true;
    }
    rerender();
    return;
  }
  // Multi-coach week: skip the single-game kickoff prompt. Each of the player's
  // programs is handed to him one at a time by the engine's coached-week gate and
  // played through the halftime-adjust flow, so there is no one "your game" to
  // pre-set a kickoff/call mode for.
  const multiCoach = coachedSchoolIds(state).length > 1;
  if (!multiCoach && state._callModeToday == null) {
    const opponent = playerGameOpponentForDay(state, state.day + 1);
    if (opponent) {
      ensurePregamePlan(state);
      state.ui.pendingKickoff = { opponent };
      rerender();
      return;
    }
  }
  const events = advanceDay(state, dispatch);
  if (handleGamePendingEvents(events)) return;
  processEvents(events);
  await autosave();
  rerender();
}
function handleGamePendingEvents(events) {
  var _a, _b;
  const stop = events == null ? void 0 : events.find((e) => e.type === "playcall" || e.type === "fourthdown");
  if (stop) {
    processEvents(events.filter((e) => e.type !== "playcall" && e.type !== "fourthdown"));
    state.ui.showHalftime = false;
    state.ui.showCallSheet = false;
    state.ui.showFourthDown = false;
    state.ui.liveWatch = null;
    {
      const token2 = (_a = state.pendingHalftime) == null ? void 0 : _a.token;
      if (token2) {
        const all = tokenFeedItems(token2);
        state.ui.callFeed = all.slice(token2._feedSeen || 0);
        token2._feedSeen = all.length;
      }
    }
    const token = (_b = state.pendingHalftime) == null ? void 0 : _b.token;
    if ((liveWatchOn() || state.ui.autoRun) && token && unwatchedPlayCount(token) > 0) {
      state.ui.liveWatch = { stage: "call", boardDone: false };
    } else if (stop.type === "fourthdown") {
      state.ui.showFourthDown = true;
    } else {
      state.ui.showCallSheet = true;
    }
    rerender();
    return true;
  }
  const halftime = events == null ? void 0 : events.find((e) => e.type === "halftime");
  if (halftime) {
    processEvents(events.filter((e) => e.type !== "halftime"));
    state.ui.showCallSheet = false;
    state.ui.halftimeTab = "offense";
    state.ui.halftimeOpenSitKey = null;
    if (liveWatchOn()) {
      state.ui.showHalftime = false;
      state.ui.liveWatch = { stage: "halftime" };
    } else {
      state.ui.showHalftime = true;
    }
    rerender();
    return true;
  }
  return false;
}
function tokenAllPlays(token) {
  var _a, _b;
  const out = [];
  for (const d of (token == null ? void 0 : token.drives) || []) for (const p of d.plays || []) out.push(p);
  for (const p of ((_b = (_a = token == null ? void 0 : token.pending) == null ? void 0 : _a.drive) == null ? void 0 : _b.plays) || []) out.push(p);
  return out;
}
function unwatchedPlayCount(token) {
  return tokenAllPlays(token).length - ((token == null ? void 0 : token._watchedPlays) || 0);
}
function liveWatchOn() {
  var _a;
  return state._exhibition ? true : ((_a = state.settings) == null ? void 0 : _a.liveWatch) !== false;
}
function ensurePregamePlan(state2) {
  var _a, _b;
  if (state2._pregamePlan) return;
  const me = (_b = (_a = state2.world) == null ? void 0 : _a.schools) == null ? void 0 : _b.find((s) => s.id === state2.playerSchoolId);
  state2._pregamePlan = JSON.parse(JSON.stringify((me == null ? void 0 : me.gameplan) || {}));
}
function tokenFeedItems(token) {
  var _a, _b;
  const out = [];
  for (const d of (token == null ? void 0 : token.drives) || []) for (const p of d.plays || []) out.push({ p, poss: d.possession });
  for (const p of ((_b = (_a = token == null ? void 0 : token.pending) == null ? void 0 : _a.drive) == null ? void 0 : _b.plays) || []) out.push({ p, poss: token.pending.possession });
  return out;
}
async function chooseKickoffMode(mode) {
  state.settings.lastCallMode = mode;
  state._callModeToday = mode;
  const cwGameId = state.ui.pendingKickoff && state.ui.pendingKickoff.coachWeekGameId;
  state.ui.pendingKickoff = null;
  state.ui.callSheetFormation = null;
  state.ui.autoRun = false;
  if (cwGameId) {
    // Multi-coach: this pregame belongs to one of the player's programs. Start
    // THAT game (to halftime) rather than advancing the league day.
    const res = beginCoachedGame(state, cwGameId);
    if (res && res.pending && state.pendingHalftime) {
      const tok = state.pendingHalftime.token;
      const ev = (tok == null ? void 0 : tok.pending) ? { type: tok.pending.kind === "fourth" ? "fourthdown" : "playcall", game: state.pendingHalftime.game, token: tok } : { type: "halftime", game: state.pendingHalftime.game, token: tok };
      if (handleGamePendingEvents([ev])) return;
    } else if (res && res.simmed) {
      processEvents([{ type: "game", result: res.result }]);
    }
    await autosave();
    rerender();
    return;
  }
  await advanceDay2();
}
// Weekly agenda "Kickoff" — step 1: make this program's chair active and open the
// pregame (adjustments + kickoff/call-mode). The game starts on chooseKickoffMode.
async function kickoffCoachedGame(gameId) {
  const info = activateCoachedChair(state, gameId);
  if (!info) { rerender(); return; }
  state._pregamePlan = null;
  ensurePregamePlan(state);
  state._callModeToday = null;
  state.ui.pendingKickoff = { opponent: (info.opp && info.opp.name) || null, coachWeekGameId: gameId };
  await autosave();
  rerender();
}
// Agenda "Sim" — book a program's game without coaching it.
async function simCoachedGameFromAgenda(gameId) {
  const res = beginCoachedGame(state, gameId, true);
  if (res && res.result) processEvents([{ type: "game", result: res.result }]);
  await autosave();
  rerender();
}
// Box-score close in a multi-coach week: return to the weekly agenda. The games
// do NOT chain — the player chooses when to take over the next coach and play
// that game (owner: "once the coach closes the box score they can choose when to
// take over the next coach"). Advance-week stays locked until all are resolved.
async function afterCoachedGameResultClose() {
  state.ui.showGameResult = false;
  state.ui.lastGameResult = null;
  if (state.coachWeek && state.ui.view !== "dashboard") navigate("dashboard");
  await autosave();
  rerender();
}
async function answerPlayCall(call) {
  var _a, _b;
  if ((_a = state.pendingHalftime) == null ? void 0 : _a.exhibition) {
    return exhibitionResume((t) => resumeFromCall(t, call || { concept: "sheet" }));
  }
  const token = (_b = state.pendingHalftime) == null ? void 0 : _b.token;
  const events = resumeFromPlayCall(state, call);
  state.ui.callFormation = null;
  state.ui.callVariation = null;
  state.ui.callPA = false;
  state.ui.callRPO = false;
  state.ui.callQBRun = false;
  state.ui.callTimeout = false;
  state.ui.defCall = null;
  state.ui.defCallName = null;
  state.ui.callSTOpen = false;
  state.ui.callDrill = null;
  state.ui.showCallSheet = false;
  if (handleGamePendingEvents(events)) return;
  state.ui._finalWatched = liveWatchOn() && (token == null ? void 0 : token._watchedPlays) || null;
  processEvents(events);
  await autosave();
  rerender();
}
async function setCallModeMidGame(mode) {
  var _a;
  const token = (_a = state.pendingHalftime) == null ? void 0 : _a.token;
  if (!(token == null ? void 0 : token.pending)) return;
  token.callMode = mode;
  if (token.pending.kind === "fourth") await answerFourthDown("auto");
  else await answerPlayCall({ concept: "sheet" });
}
async function simToQuarterEnd() {
  var _a, _b, _c, _d, _e;
  const token = (_a = state.pendingHalftime) == null ? void 0 : _a.token;
  const p = token == null ? void 0 : token.pending;
  if (!p) return;
  const clock = p.kind === "fourth" ? p.clock : (_e = (_d = (_c = (_b = p.drive) == null ? void 0 : _b.sit) == null ? void 0 : _c.clock) != null ? _d : p.clock) != null ? _e : 0;
  if (p.half !== 3) token.skipUntil = { half: p.half, clock: clock > 900 ? 900 : 0 };
  if (p.kind === "fourth") await answerFourthDown("auto");
  else await answerPlayCall({ concept: "sheet" });
}
async function simToBreak() {
  var _a;
  const token = (_a = state.pendingHalftime) == null ? void 0 : _a.token;
  const p = token == null ? void 0 : token.pending;
  if (!p) return;
  if (p.half !== 3) token.skipUntil = { half: p.half, clock: 0 };
  if (p.kind === "fourth") await answerFourthDown("auto");
  else await answerPlayCall({ concept: "sheet" });
}
async function answerFourthDown(decision) {
  var _a, _b;
  if ((_a = state.pendingHalftime) == null ? void 0 : _a.exhibition) {
    return exhibitionResume((t) => resumeFromDecision(t, decision || "auto"));
  }
  const token = (_b = state.pendingHalftime) == null ? void 0 : _b.token;
  const events = resumeFromFourthDown(state, decision);
  state.ui.showFourthDown = false;
  if (handleGamePendingEvents(events)) return;
  state.ui._finalWatched = liveWatchOn() && (token == null ? void 0 : token._watchedPlays) || null;
  processEvents(events);
  await autosave();
  rerender();
}
function startExhibition(home, away, mode = "coach") {
  if (!state._exhStash) {
    state._exhStash = {
      world: state.world,
      playerSchoolId: state.playerSchoolId,
      pendingHalftime: state.pendingHalftime
    };
  }
  state._exhibition = true;
  state._exhibitionMode = ["coach", "away", "both", "watch"].includes(mode) ? mode : "coach";
  const primarySide = state._exhibitionMode === "away" ? "away" : "home";
  const controlledSides = state._exhibitionMode === "both" ? ["home", "away"] : state._exhibitionMode === "watch" ? [] : [primarySide];
  state._exhNonce = (state._exhNonce || 0) + 1;
  state.world = { schools: [home, away], conferences: {}, season: state.season || 1, recruits: [] };
  state.playerSchoolId = primarySide === "away" ? away.id : home.id;
  state.ui.autoRun = false;
  state.ui.callSheetFormation = null;
  state.ui.showGameResult = false;
  state.ui.lastGameResult = null;
  const token = simulateFirstHalf(
    home,
    away,
    home.roster,
    away.roster,
    home.depthChart,
    away.depthChart,
    home.gameplan,
    away.gameplan,
    state._exhibitionMode === "watch" ? null : { playerSide: primarySide, controlledSides, callMode: "all" }
  );
  state.pendingHalftime = { token, game: null, home, away, exhibition: true };
  const events = exhibitionEvents();
  if (events) {
    handleGamePendingEvents(events);
    return;
  }
  exhibitionFinal(token);
}
function endExhibition() {
  if (state._exhStash) {
    state.world = state._exhStash.world;
    state.playerSchoolId = state._exhStash.playerSchoolId;
    state.pendingHalftime = state._exhStash.pendingHalftime;
    state._exhStash = null;
  } else if (state._exhibition) {
    state.pendingHalftime = null;
  }
  state._exhibition = false;
  state._exhibitionMode = null;
  state.ui.liveWatch = null;
  state.ui.showCallSheet = false;
  state.ui.showFourthDown = false;
  state.ui.showHalftime = false;
  state.ui.showGameResult = false;
  state.ui.lastGameResult = null;
  state.ui.autoRun = false;
}
function exhibitionEvents() {
  var _a;
  const hg = state.pendingHalftime;
  const t = hg == null ? void 0 : hg.token;
  if (!t) return null;
  const k = (_a = t.pending) == null ? void 0 : _a.kind;
  if (k) return [{ type: k === "fourth" ? "fourthdown" : "playcall", game: hg.game, token: t }];
  if (t.stage !== "done") return [{ type: "halftime", game: hg.game, token: t }];
  return null;
}
async function exhibitionResume(fn) {
  const hg = state.pendingHalftime;
  const token = hg == null ? void 0 : hg.token;
  if (!token) return;
  fn(token);
  state.ui.callFormation = null;
  state.ui.callVariation = null;
  state.ui.callPA = false;
  state.ui.callRPO = false;
  state.ui.callQBRun = false;
  state.ui.callTimeout = false;
  state.ui.defCall = null;
  state.ui.defCallName = null;
  state.ui.callSTOpen = false;
  state.ui.callDrill = null;
  state.ui.showCallSheet = false;
  state.ui.showFourthDown = false;
  const events = exhibitionEvents();
  if (events) {
    handleGamePendingEvents(events);
    return;
  }
  state.ui._finalWatched = liveWatchOn() && token._watchedPlays || null;
  exhibitionFinal(token);
}
async function continueExhibitionSpectator() {
  var _a;
  if (!((_a = state.pendingHalftime) == null ? void 0 : _a.exhibition) || state._exhibitionMode !== "watch") return;
  state.ui.showHalftime = false;
  return exhibitionResume((token) => stepSecondHalf(token));
}
function exhibitionFinal(token) {
  const result = finishInteractiveGame(token);
  state.pendingHalftime = null;
  state.ui.lastGameResult = result;
  state.ui.gameResultTab = "boxscore";
  if (liveWatchOn()) {
    state.ui.liveWatch = { stage: "final" };
    state.ui.showGameResult = false;
    state.ui.autoRun = false;
  } else {
    state.ui.showGameResult = true;
  }
  rerender();
}
async function skipToOffseason() {
  let guard = 0;
  const wasDay = state.day;
  while (state.day < 24 && state.day >= 20 && guard++ < 12) {
    const events = advanceDay(state, dispatch);
    if (events == null ? void 0 : events.find((e) => e.type === "halftime")) {
      state.ui.showHalftime = true;
      state.ui.halftimeTab = "offense";
      state.ui.halftimeOpenSitKey = null;
      rerender();
      return;
    }
    processEvents(events);
    if (state.day === 24) break;
  }
  if (state.day !== wasDay) state.postseasonMode = "skipped";
  await autosave();
  rerender();
}
async function resumeHalftime(homeGPEdits = null, awayGPEdits = null) {
  var _a;
  if ((_a = state.pendingHalftime) == null ? void 0 : _a.exhibition) {
    return exhibitionResume((t) => {
      const adj = state.pendingHalftime.adjustment;
      if (adj) {
        const myGP = t.playerSide === "away" ? t.awayGP : t.homeGP;
        if (adj.kind === "offlean") myGP._h2OffLean = { eff: 0.08 };
        else if (adj.kind === "deflean") myGP._h2DefLean = { eff: 0.08 };
        else if (adj.kind === "fresh") myGP._h2Fresh = { eff: 0.28 };
        else if (adj.kind === "protect") myGP._h2Protect = { eff: 0.1 };
        else if (adj.kind === "shadow" && adj.id) myGP._h2Shadow = { id: adj.id, eff: 0.07 };
      }
      if (state._exhibitionMode !== "both") {
        const aiGP = t.playerSide === "away" ? t.homeGP : t.awayGP;
        setAutoCounter(aiGP, t.drives, t.playerSide === "away" ? "away" : "home", state.settings?.diffCoaching);
      }
      state.ui.showHalftime = false;
      stepSecondHalf(t, homeGPEdits, awayGPEdits);
    });
  }
  const events = resumeFromHalftime(state, homeGPEdits, awayGPEdits);
  if (handleGamePendingEvents(events)) return;
  state.ui.showHalftime = false;
  processEvents(events);
  await autosave();
  rerender();
}
// Multi-coach week: "let the sim handle this one" from the halftime screen —
// full-sim the paused game (its box score then shows; closing it launches the
// next program or unlocks the advance button). rest=true sims all remaining.
async function simCoached(rest = false) {
  const events = simCurrentCoachedGame(state, rest);
  state.ui.showHalftime = false;
  processEvents(events);
  await autosave();
  rerender();
}
function summarizeCommitmentNotifications(playerEvents = [], lostEvents = []) {
  const signed = playerEvents.length;
  const lost = lostEvents.length;
  const total = signed + lost;
  if (!total) return null;
  if (total === 1) {
    if (signed) return {
      text: `${fullName(playerEvents[0].recruit)} commits!`,
      type: "success",
      duration: 3500
    };
    return {
      text: `${fullName(lostEvents[0].recruit)} committed elsewhere`,
      type: "warning",
      duration: 3500
    };
  }
  if (signed && lost) return {
    text: `${signed} recruit${signed === 1 ? "" : "s"} signed \xB7 ${lost} target${lost === 1 ? "" : "s"} committed elsewhere`,
    type: "success",
    duration: 4500
  };
  if (signed) return {
    text: `${signed} recruits signed with your program`,
    type: "success",
    duration: 4500
  };
  return {
    text: `${lost} targets committed elsewhere`,
    type: "warning",
    duration: 4500
  };
}
function processEvents(events, { suppressModal = false } = {}) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const visibleCommits = events.filter((event) => {
    var _a2, _b2, _c2;
    return event.type === "commit" && (event.schoolId === state.playerSchoolId || ((_a2 = state.settings) == null ? void 0 : _a2.rivalCommitNotifications) !== false && ((_c2 = (_b2 = state.playerCoach) == null ? void 0 : _b2.recruitBoard) == null ? void 0 : _c2.some((entry) => {
      var _a3;
      return entry.recruitId === ((_a3 = event.recruit) == null ? void 0 : _a3.id);
    })));
  });
  const playerCommits = visibleCommits.filter((event) => event.schoolId === state.playerSchoolId);
  const lostCommits = visibleCommits.filter((event) => event.schoolId !== state.playerSchoolId);
  const lastVisibleCommit = visibleCommits[visibleCommits.length - 1] || null;
  const commitmentToast = summarizeCommitmentNotifications(playerCommits, lostCommits);
  for (const event of events) {
    if (event.type === "game") {
      const r = event.result;
      const school = getPlayerSchool();
      const isPlayerGame = ((_a = r.homeSchool) == null ? void 0 : _a.id) === (school == null ? void 0 : school.id) || ((_b = r.awaySchool) == null ? void 0 : _b.id) === (school == null ? void 0 : school.id);
      if (isPlayerGame) {
        const won = r.winner === school.id;
        const isHome = ((_c = r.homeSchool) == null ? void 0 : _c.id) === (school == null ? void 0 : school.id);
        const myScore = isHome ? r.homeScore : r.awayScore;
        const oppScore = isHome ? r.awayScore : r.homeScore;
        const opp = isHome ? r.awaySchool : r.homeSchool;
        const archivedClassic = archiveInstantClassic(state, r, weekLabel(state.day));
        addInboxMessage(`Season ${state.season} Game Result`, `${won ? "W" : "L"} ${myScore}-${oppScore} vs ${opp == null ? void 0 : opp.name}`);
        if (archivedClassic) {
          notify("Instant Classic " + archivedClassic.score + " \u2014 replay saved to Coach Select", "success", 5e3);
        }
        if (!suppressModal && ((_d = state.settings) == null ? void 0 : _d.showGameResultModal) !== false) {
          state.ui.lastGameResult = r;
          if (liveWatchOn()) {
            state.ui.liveWatch = { stage: "final" };
            state.ui.showGameResult = false;
            state.ui.autoRun = false;
          } else {
            state.ui.showGameResult = true;
          }
          state.ui.gameResultTab = "boxscore";
        }
      }
    } else if (event.type === "commit") {
      const { recruit, schoolId } = event;
      if (schoolId === state.playerSchoolId) {
        addInboxMessage("Commitment!", `${fullName(recruit)} (${recruit.position}) has committed to your program!`);
      } else if (((_e = state.settings) == null ? void 0 : _e.rivalCommitNotifications) !== false && ((_g = (_f = state.playerCoach) == null ? void 0 : _f.recruitBoard) == null ? void 0 : _g.find((e) => e.recruitId === recruit.id))) {
        addInboxMessage("Lost Recruit", `${fullName(recruit)} (${recruit.position}) committed to ${((_h = getSchool(schoolId)) == null ? void 0 : _h.name) || "another school"}.`);
      }
      if (event === lastVisibleCommit && commitmentToast) {
        notify(commitmentToast.text, commitmentToast.type, commitmentToast.duration);
      }
    } else if (event.type === "info") {
      addInboxMessage("News", event.text);
    } else if (event.type === "warning") {
      addInboxMessage("News", event.text);
      notify(event.text, "warning");
    } else if (event.type === "season-complete") {
      // Season Mode reached the title. Stash the result; app.js renders the
      // champion takeover from this flag. Mark the run over (gates off the season
      // autosave + blocks further advancing) and delete the dedicated save so a
      // finished season is never offered for resume.
      state.seasonOver = true;
      state.ui.seasonComplete = { division: event.division, champion: event.champion };
      deleteSlotData("season").catch(() => {});
    }
  }
}
function devAddBudget(amount) {
  if (state.playerCoach) state.playerCoach.budget = (state.playerCoach.budget || 0) + amount;
}
function devForceSign(recruitId) {
  var _a, _b, _c;
  const school = getPlayerSchool();
  const coach = state.playerCoach;
  if (!school || !coach) return;
  const recruit = (((_a = state.world) == null ? void 0 : _a.recruits) || []).find((r) => r.id === recruitId);
  if (!recruit || recruit.committed) return;
  recruit.committed = school.id;
  recruit.decisionStatus = "signed";
  recruit.funnelStage = "committed";
  if (!coach.recruitBoard) coach.recruitBoard = [];
  let entry = coach.recruitBoard.find((e) => e.recruitId === recruitId);
  if (!entry) {
    entry = { recruitId, schoolId: school.id, interest: 100, spent: 0, actions: [], offered: true, accepted: true, campusVisits: 0 };
    coach.recruitBoard.push(entry);
    coach.scholarshipsAvailable = Math.max(0, (coach.scholarshipsAvailable || 0) - 1);
  } else {
    if (!entry.offered) {
      coach.scholarshipsAvailable = Math.max(0, (coach.scholarshipsAvailable || 0) - 1);
      entry.offered = true;
    }
    entry.accepted = true;
  }
  if (!state.signingsLog) state.signingsLog = [];
  state.signingsLog.push({
    season: state.season,
    day: state.day,
    recruitId: recruit.id,
    name: `${((_b = recruit.name) == null ? void 0 : _b.first) || ""} ${((_c = recruit.name) == null ? void 0 : _c.last) || ""}`.trim(),
    pos: recruit.position,
    schoolId: school.id,
    schoolName: school.name,
    star: recruit.visionRating,
    trueRating: recruit.compositeRating,
    toPlayer: true,
    lostByPlayer: false,
    source: "dev"
  });
}
async function devSkipToNextGame() {
  const school = getPlayerSchool();
  if (!school) return;
  const nextGameDay = (state.schedule || []).filter((g) => !g.result && g.day > state.day && (g.homeId === school.id || g.awayId === school.id)).map((g) => g.day).sort((a, b) => a - b)[0];
  if (!nextGameDay) {
    notify("No upcoming games this season", "info");
    return;
  }
  while (state.day < nextGameDay - 1) {
    const events2 = advanceDay(state, dispatch);
    processEvents(events2, { suppressModal: true });
  }
  if (state._callModeToday == null) {
    const opponent = playerGameOpponentForDay(state, state.day + 1);
    if (opponent) {
      ensurePregamePlan(state);
      state.ui.pendingKickoff = { opponent };
      await autosave();
      rerender();
      return;
    }
  }
  const events = advanceDay(state, dispatch);
  if (handleGamePendingEvents(events)) return;
  processEvents(events);
  await autosave();
  rerender();
}
async function devSimToPlayoffs() {
  var _a, _b;
  while (state.day < 18) {
    const events = advanceDay(state, dispatch);
    processEvents(events, { suppressModal: true });
    while (state.pendingHalftime) {
      while ((_b = (_a = state.pendingHalftime) == null ? void 0 : _a.token) == null ? void 0 : _b.pending) {
        const kind = state.pendingHalftime.token.pending.kind;
        processEvents(kind === "fourth" ? resumeFromFourthDown(state, "auto") : resumeFromPlayCall(state, { concept: "sheet" }), { suppressModal: true });
      }
      if (!state.pendingHalftime) break;
      const htEvents = resumeFromHalftime(state, null, null);
      processEvents(htEvents, { suppressModal: true });
    }
  }
  await autosave();
  rerender();
}
function addInboxMessage(subject, body) {
  state.inbox.unshift({ id: uuid(), day: state.day, subject, body, read: false });
  if (state.inbox.length > 50) state.inbox = state.inbox.slice(0, 50);
}
function dispatch(action, payload) {
}
async function saveToSlot(slot) {
  await saveGame(state, slot);
  state.ui.saves = await listSaves();
}
async function loadFromSlot(slot) {
  var _a, _b, _c, _d, _e, _f;
  const saved = await loadGame(slot);
  if (!saved) return false;
  if (saved._incompatible) {
    notify("This save is from an older version. Please start a new career.", "warning", 5e3);
    return false;
  }
  const uiBackup = __spreadProps(__spreadValues({}, state.ui), { saves: state.ui.saves });
  Object.assign(state, saved);
  state._exhibition = false;
  state._exhStash = null;
  state._instantClassicReplay = null;
  state.ui.saves = uiBackup.saves;
  state.ui.showSaveModal = false;
  state.ui.showLoadModal = false;
  state.ui.showInbox = false;
  state.ui.showGameResult = false;
  state.pendingHalftime = null;
  state.ui.showHalftime = false;
  state.ui.pendingKickoff = null;
  state.ui.showCallSheet = false;
  state.ui.showFourthDown = false;
  state.ui.liveWatch = null;
  state.ui.autoRun = false;
  state.ui.callFormation = null;
  state.ui.callVariation = null;
  state.ui.callPA = false;
  state.ui.callRPO = false;
  state.ui.callQBRun = false;
  state.ui.callTimeout = false;
  state.ui.defCall = null;
  state.ui.defCallName = null;
  state.ui.callDrill = null;
  state.ui.callSTOpen = false;
  state._callModeToday = null;
  state._pregamePlan = null;
  state.settings = __spreadValues({
    showGameResultModal: true,
    rivalCommitNotifications: true,
    autoRecruit: false,
    revealScouting: false,
    darkMode: false,
    penaltyRate: 90,
    // flag-rate dial default: 10% fewer flags than the old tuned rate
    recruitStrategy: { priorities: [], aggression: "balanced", qualityFloor: 0 }
  }, state.settings || {});
  if (state.settings.recruitAssist == null) {
    state.settings.recruitAssist = state.settings.autoRecruit ? "full" : "off";
  }
  if (!state.pendingNonConfChoices) state.pendingNonConfChoices = [];
  if (!state.autoRecruitLog) state.autoRecruitLog = [];
  if (!state.awardsLog) state.awardsLog = [];
  if (!state.coachHistory) state.coachHistory = [];
  if (!Array.isArray(state.instantClassics)) state.instantClassics = [];
  if (state.world) repairRecruitLocations(state.world);
  // While playing, the player school's `coach` and `state.playerCoach` are ONE
  // object (startNewGamePrepared, seatSlot, activateSlot all enforce it), but
  // JSON.stringify writes them as two. Re-link on load, or season-end career
  // credit (finalizeSeasonRecords writes school.coach) diverges from everything
  // read off state.playerCoach — the on-screen career record freezes at its
  // value from the last reload. Id must match: an unemployed coach owns no chair.
  {
    const _mySchool = (_a = state.world) == null ? void 0 : _a.schools.find((s) => s.id === state.playerSchoolId);
    if ((_mySchool == null ? void 0 : _mySchool.coach) && state.playerCoach && _mySchool.coach.id === state.playerCoach.id) {
      state.playerCoach = _mySchool.coach;
    }
  }
  ensureSkills(state.playerCoach);
  ensureCareerFields(state.playerCoach);
  for (const s of (_b = (_a = state.world) == null ? void 0 : _a.schools) != null ? _b : []) {
    ensureSkills(s.coach);
    ensureCareerFields(s.coach);
  }
  for (const s of (_d = (_c = state.world) == null ? void 0 : _c.schools) != null ? _d : []) {
    const cap = (_f = (_e = C.PRESTIGE_MAX) == null ? void 0 : _e[s.division]) != null ? _f : 6;
    if (s.prestige > cap) s.prestige = cap;
    if (s.baseline > cap) s.baseline = cap;
    if (s.prestigeMax && s.prestigeMax > cap) s.prestigeMax = cap;
  }
  navigate("dashboard");
  return true;
}
function startInstantClassicReplay(entry) {
  if (!(entry == null ? void 0 : entry.result)) return false;
  state._instantClassicReplay = {
    id: entry.id,
    playerSchoolId: entry.playerSchoolId,
    score: entry.score
  };
  state.ui.lastGameResult = entry.result;
  state.ui.showGameResult = true;
  state.ui.gameResultTab = "watch";
  state.ui.view = "classicreplay";
  state.ui.params = {};
  state.ui.sidebarOpen = false;
  rerender();
  return true;
}
function closeInstantClassicReplay() {
  state._instantClassicReplay = null;
  state.ui.showGameResult = false;
  state.ui.lastGameResult = null;
  state.ui.gameResultTab = "boxscore";
  state.ui.view = "mainmenu";
  state.ui.params = {};
  rerender();
}
async function refreshSaves() {
  state.ui.saves = await listSaves();
}
var state, _renderFn, _notifyFn, NO_HISTORY_VIEWS, teamGroupTab, programGroupTab, seasonGroupTab, statsGroupTab, LEGACY_VIEW_MAP;

state = {
  initialized: false,
  // Season Mode: a one-off single-season run that reuses the entire dynasty
  // engine + screens, minus recruiting and the coach's office, and stops at the
  // playoff champion instead of rolling to an offseason. Set by startSeasonRun.
  seasonMode: false,
  // Set true once the season's title is decided — gates off the season autosave
  // (a finished season isn't resumable) and blocks any further advance.
  seasonOver: false,
  season: 1,
  day: 1,
  playerSchoolId: null,
  playerCoach: null,
  world: null,
  schedule: [],
  playoffs: null,
  allPlayoffs: null,
  bowls: null,
  offseason: null,
  // Offseason wizard cursor {stage, done, data} — created day 24, cleared day 30 (Offseason Chunk 1)
  postseasonMode: null,
  // 'skipped' when an eliminated player fast-forwards days 20–23 (Spec §C)
  pendingNonConfChoices: [],
  // [{day, homeId, awayId}] set during JOBS offseason scheduling
  inbox: [],
  gameLog: [],
  // [{season, day, events: [...]}]
  signingsLog: [],
  // [{season, day, recruitId, name, pos, schoolId, schoolName, star, true, toPlayer, fromPlayerBoard}] — newest last
  awardsLog: [],
  // [{season, day?, scope, category, schoolId, schoolName, playerId, playerName}] — weekly + season awards, all schools
  coachHistory: [],
  // [{season, type: 'milestone'|'development', ...}] — player-coach milestone/dev feed for the Coach Office
  instantClassics: [],
  // compact full-game replays; optional on legacy saves
  tree: null,
  // [W9 §12] the coaching tree overlay: {id, active, slots{D1|D2|D3}, dna, memory, ledger, fork, agenda}. null on every legacy/solo career — see engine/tree.js
  pendingHalftime: null,
  pendingWeeklyCands: null,
  // {day, cands} — weekly-award candidates stashed while the player's game sits at halftime (Chunk 2)
  pendingWalkOns: null,
  // accepted tryout walk-ons awaiting rollover delivery (Chunk 3)
  rivalry: null,
  // {schoolId, trophy, sinceSeason, holderId, wins, losses} — the annual trophy game (Chunk 6)
  preseason: null,
  // week 1–4 program state: camp/spring/cuts/redshirt context (preseason restructure)
  jobOpenings: null,
  // [{schoolId, schoolName, division, prestige, pull, status}] — offseason job board (application system)  // { token, game, home, away } — set by engine advanceDay when the player's game pauses at halftime (Chunk 12)
  ui: {
    view: "mainmenu",
    params: {},
    scoutSchoolId: null,
    recruitSearch: { position: "", maxDist: 999, minWE: 0, sort: "visionRating" },
    recruitBoard: [],
    selectedRecruitId: null,
    lastGameResult: null,
    notification: null,
    showInbox: false,
    showGameResult: false,
    showSaveModal: false,
    showLoadModal: false,
    saves: [],
    sidebarOpen: false,
    showHalftime: false,
    halftimeTab: "offense",
    // 'offense' | 'defense' | 'situations' | 'depth' | 'report' | 'boxscore' | 'pbp'
    halftimeOpenSitKey: null,
    // situations-tab open panel, SEPARATE from the Game Plan screen's own
    pendingKickoff: null,
    // Rung 6: {opponent} — the pre-game headset-mode prompt
    showCallSheet: false,
    // Rung 6: the call-sheet modal is up (token frozen on an asked snap)
    callSheetFormation: null,
    // Rung 6: the formation chip currently selected on the sheet
    showFourthDown: false
    // 4th-down integration: the GO/PUNT/FG panel is up
  },
  settings: {
    // Game settings
    showGameResultModal: true,
    rivalCommitNotifications: true,
    // Flag rate (Aug 2026): percent of the old tuned penalty rate, applied to
    // every simulated game. Default 90 = 10% fewer flags. Settings › Game dial.
    penaltyRate: 90,
    darkMode: false,
    // default OFF (Jul 2026): new dynasties open in
    // school-color mode; dark is opt-in via Settings.
    // Beginner-first defaults for a brand-new coach. Existing saves keep their choices.
    gameplanMode: "simple",
    // Recruiting assist (Jul 2026): 'off' | 'assist' | 'full'. Full = staff-run class.
    recruitAssist: "full",
    recruitStrategy: { priorities: [], aggression: "balanced", qualityFloor: 0 },
    // Dev tools
    autoRecruit: false,
    revealScouting: false
  }
};
_renderFn = null;
_notifyFn = null;
NO_HISTORY_VIEWS = /* @__PURE__ */ new Set(["mainmenu", "newgame"]);
teamGroupTab = "roster";
programGroupTab = "identity";
seasonGroupTab = "schedule";
statsGroupTab = "stats";
LEGACY_VIEW_MAP = {
  roster: ["team", "roster"],
  depthchart: ["team", "depthchart"],
  practice: ["team", "practice"],
  coachoffice: ["program", "identity"],
  schedule: ["season", "schedule"],
  standings: ["season", "standings"],
  stats: ["statsgroup", "stats"],
  awards: ["statsgroup", "awards"],
  history: ["statsgroup", "history"]
};

export { startSeasonRun, exitSeasonRun, advanceDay2, answerFourthDown, answerPlayCall, chooseKickoffMode, closeInstantClassicReplay, continueExhibitionSpectator, devAddBudget, devForceSign, devSimToPlayoffs, devSkipToNextGame, endExhibition, getAllBoardEntries, getBoardEntry, getConferenceStandings, getPhaseLabel, getPlayerSchool, getRecruit, getSchool, getScoutSchool, getUpcomingGame, getWeekLabel, getWeekShort, liveWatchOn, loadFromSlot, navigate, navigateBack, notify, notifyJobMoveCosts, openSchool, processEvents, programGroupTab, pushNav, refreshSaves, rerender, resumeHalftime, saveNow, saveToSlot, seasonGroupTab, setCallModeMidGame, setGroupTab, setNotifyFn, setRenderFn, afterCoachedGameResultClose, kickoffCoachedGame, simCoached, simCoachedGameFromAgenda, simToBreak, simToQuarterEnd, skipToOffseason, startExhibition, startInstantClassicReplay, startNewGame, startNewGamePrepared, state, statsGroupTab, summarizeCommitmentNotifications, switchTreeSlot, teamGroupTab, tokenAllPlays, unwatchedPlayCount, advanceDay2 as advanceDay };
