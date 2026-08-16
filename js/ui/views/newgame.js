import { C } from '../../constants.js';
import { getCoach } from '../../engine/coachprofile.js';
import { generateCandidates } from '../../engine/staff.js';
import { findStartProgram } from '../../engine/starts.js';
import { CONFERENCES, SCHOOL_DATA, WORLDGEN_INFO, applyIdentityToSchool, availableStates, generatePlayerProgram, generateWorld } from '../../engine/world.js';
import { navigate, notify, rerender, startNewGame, startNewGamePrepared, state } from '../../state.js';
import { repairCreation } from '../../engine/creatorrepair.js';
import { DEFAULT_OFF_BOOKS, DEFAULT_DEF_BOOKS, defaultOffBook, defaultDefBook } from '../../engine/defaultbooks.js';
import { BLUEPRINT_MARK } from '../logo.js';
import { BUILTIN_PLANS, applyPlanToSchool, builtinPlan, gameplanIsSimple } from './gameplan.js';
import { listCreations, loadCreationData } from '../../engine/creator.js';
import { applyPlaybookToGameplan } from '../../engine/playbook.js';
import { applyDefBookToGameplan } from '../../engine/defbook.js';
import { escapeHtml, renderCrest } from '../../utils.js';

function obGetWorld() {
  if (!_obWorld) {
    try {
      _obWorld = generateWorld();
    } catch (e) {
      _obWorld = null;
    }
  }
  return _obWorld;
}
// The onboarding renumbers itself to the steps actually SHOWN. A tree run (the
// default start) locks "take the job" and skips the Situation step — without
// this the header jumped STEP 1 -> STEP 3 and the progress dots left a gap.
// obActiveSteps = every internal step shown (incl. the unnumbered Staff screen,
// obStep 4); obNumberedSteps = only the user-facing numbered ones.
function obActiveSteps() { return state._treeId ? [0, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5]; }
function obNumberedSteps() { return state._treeId ? [0, 2, 3, 5] : [0, 1, 2, 3, 5]; }
function obStepLabel(s) { const i = obNumberedSteps().indexOf(s); return i >= 0 ? `STEP ${i + 1}` : ""; }
function renderNewGame() {
  if (legacyMode) return renderLegacy();
  if (state._coachProfileName && obStep === 0 && !ob.first && !ob.last) {
    ob.first = state._coachProfileName.first;
    ob.last = state._coachProfileName.last;
  }
  if (state._treeId) {
    // Coaching tree run: lock to D3 / "take the job" and skip the situation
    // and division-choice steps so the founder lands straight on the school
    // picker. Only set if not already set so re-renders don't clobber a later
    // state (e.g. a division the player has since narrowed to).
    if (!ob.challenge || ob.challenge === "takejob") ob.challenge = "takejob";
    if (!ob.division) ob.division = "D3";
  }
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
    case 1:
      return stepSituation();
    // the start decides everything downstream
    case 2:
      return stepJob();
    // state → level → the actual program
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
  const key = ob.qbPref + "|" + ob.defFront + "|" + ob.division;
  if (obCand.key !== key) {
    const fakeSchool = { prestige: ob.challenge === "powerhouse" ? ((_a = C.PRESTIGE_MAX) == null ? void 0 : _a[ob.division]) || 4 : 2, division: ob.division };
    const ocSort = ob.qbPref === "QB-Mobile" ? "qbRunDesign" : "passGame";
    const dcSort = ob.defFront === "46/Bear" || ob.defFront === "4-3" ? "runFits" : ob.defFront === "Nickel" || ob.defFront === "Dime" ? "coverage" : "blitzDesign";
    obCand = {
      key,
      oc: generateCandidates("OC", fakeSchool, 4).sort((a, b) => (b.ratings[ocSort] || 0) - (a.ratings[ocSort] || 0)),
      dc: generateCandidates("DC", fakeSchool, 4).sort((a, b) => (b.ratings[dcSort] || 0) - (a.ratings[dcSort] || 0))
    };
    ob.oc = null;
    ob.dc = null;
  }
  const SHORT = {
    qbRunDesign: "QB Run",
    passGame: "Pass",
    runGame: "Run",
    blitzDesign: "Blitz Dsn",
    coverage: "Coverage",
    runFits: "Run Fits"
  };
  const pool = (side, list, picked) => `
  <div class="ob-kicker" style="margin-top:${side === "OC" ? "0" : "14px"}">${side === "OC" ? "OFFENSIVE COORDINATOR" : "DEFENSIVE COORDINATOR"}</div>
  ${list.map((c) => `
    <button class="ob-pick-card ob-staff-card${(picked == null ? void 0 : picked.id) === c.id ? " active" : ""}" data-ob-staff="${side}:${c.id}">
      <div class="ob-pick-head"><span class="ob-pick-title">${escapeHtml(c.name.first)} ${escapeHtml(c.name.last)}</span>
        <span class="muted" style="font-size:11px">$${c.salary.toLocaleString()}/yr</span></div>
      <div class="ob-pick-desc">${Object.entries(c.ratings).map(([k, v]) => `${SHORT[k]} <b>${v}</b>`).join(" \xB7 ")}</div>
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
      ${gpMode === "simple" ? `<div class="ob-setting-desc" style="margin-top:8px;color:var(--gold);font-weight:600">\u{1F331} One catch for THIS run: a Simple start is Division III, Take the Job only \u2014 the grassroots path. Pick Advanced now to unlock D1/D2 and the other start types.</div>` : ""}
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

    <div class="ob-setting-row">
      <div class="ob-setting-label">Starting Game Plan</div>
      <div class="ob-setting-desc">A ready-made identity to open with. You can tweak every dial on the Game Plan screen, or load a different preset any time \u2014 nothing here is locked in.</div>
      <select class="form-select" id="ob-start-plan" style="margin-top:6px;max-width:280px">
        <option value=""${!ob.startPlan ? " selected" : ""}>Team default \u2014 let the staff set it</option>
        ${(() => { const pbs = listCreations("playbooks"); return pbs.length ? `<optgroup label="Your custom playbooks">${pbs.map((pb) => `<option value="pb:${escapeHtml(pb.id)}"${ob.startPlan === "pb:" + pb.id ? " selected" : ""}>${escapeHtml(pb.data.name || "Untitled")}</option>`).join("")}</optgroup>` : ""; })()}
        <optgroup label="Starter books">${DEFAULT_OFF_BOOKS.map((b) => `<option value="dpb:${escapeHtml(b.name)}"${ob.startPlan === "dpb:" + b.name ? " selected" : ""}>${escapeHtml(b.name)}</option>`).join("")}</optgroup>
        <optgroup label="Preset schemes">${BUILTIN_PLANS.map((p) => `<option value="${escapeHtml(p.name)}"${ob.startPlan === p.name ? " selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}</optgroup>
      </select>
      ${ob.startPlan && builtinPlan(ob.startPlan) ? `<div class="ob-setting-desc" style="margin-top:6px;opacity:.85">${escapeHtml(builtinPlan(ob.startPlan).blurb)}</div>` : ob.startPlan && ob.startPlan.startsWith("pb:") ? `<div class="ob-setting-desc" style="margin-top:6px;opacity:.85">Your custom playbook \u2014 your formations and concepts open the season.</div>` : ""}
    </div>

    <div class="ob-setting-row">
      <div class="ob-setting-label">Starting Defense</div>
      <div class="ob-setting-desc">Open with a starter defensive book or one of your own from the Workshop. Leave on the default and your staff sets the front and coverage.</div>
      <select class="form-select" id="ob-start-def" style="margin-top:6px;max-width:280px">
        <option value=""${!ob.startDef ? " selected" : ""}>Team default \u2014 let the staff set it</option>
        ${(() => { const dbs = listCreations("defbooks"); return dbs.length ? `<optgroup label="Your defenses">${dbs.map((db) => `<option value="dd:${escapeHtml(db.id)}"${ob.startDef === "dd:" + db.id ? " selected" : ""}>${escapeHtml(db.data.name || "Untitled")}</option>`).join("")}</optgroup>` : ""; })()}
        <optgroup label="Starter books">${DEFAULT_DEF_BOOKS.map((b) => `<option value="ddb:${escapeHtml(b.name)}"${ob.startDef === "ddb:" + b.name ? " selected" : ""}>${escapeHtml(b.name)}</option>`).join("")}</optgroup>
      </select>
    </div>

    <button class="btn-primary ob-next" id="ob-next-0" style="margin-top:16px">LET'S GO \u2192</button>
    <div class="ob-alt"><a href="#" id="ob-legacy-link">\u2026or take over an existing program instead</a></div>
  </div>
`;
}
function stepSituation() {
  const simpleLock = gameplanIsSimple();
  const cards = simpleLock ? CHALLENGE_CARDS.filter((c) => c.id === "takejob") : CHALLENGE_CARDS;
  return `
  <div class="ob-step">
    <div class="ob-kicker">${obStepLabel(1)} \u2014 THE SITUATION</div>
    <h2 class="ob-headline">What kind of job are you taking, Coach ${escapeHtml(ob.last || "")}?</h2>
    <p class="ob-flavor">${simpleLock ? "Simple game planning locks you to the grassroots start \u2014 take a Division III job and build it up. Switch to Advanced back in Step 1 for the other start types." : "Every program in this world has a hundred years of history behind it \u2014 banners, scandals, a legend or two, and a rival it has hated since 1926. Pick the story you want to walk into."}</p>
    <div class="ob-challenge-grid">
      ${cards.map((c) => `
        <button class="ob-pick-card ob-challenge-card${ob.challenge === c.id ? " active" : ""}" data-ob-challenge="${c.id}">
          <div class="ob-pick-head"><span class="ob-pick-icon">${c.icon}</span><span class="ob-pick-title">${c.title}</span></div>
          <div class="ob-pick-desc">${c.desc}</div>
        </button>
      `).join("")}
    </div>
    <div class="ob-nav-row">
      <button class="btn-ghost" data-ob-back="0">\u2190 Back</button>
      <button class="btn-primary ob-next" id="ob-next-1" ${!ob.challenge ? "disabled" : ""}>NEXT \u2192</button>
    </div>
  </div>`;
}
function renderStartPreview() {
  if (!ob.division || !ob.challenge) return "";
  if (ob.challenge === "takejob" || ob.challenge === "outpost") return "";
  const key = `${ob.challenge}|${ob.division}`;
  if (_previewCache.key !== key) {
    try {
      const w = obGetWorld();
      _previewCache = { key, val: w ? findStartProgram(w, ob.challenge, ob.division) : null };
    } catch (e) {
      _previewCache = { key, val: null };
    }
  }
  const p = _previewCache.val;
  if (!p) return `<div class="ob-start-preview ob-start-none">No program at this level has that history in this world. Try another division.</div>`;
  return `
  <div class="ob-start-preview">
    <div class="ob-start-school">${escapeHtml(p.school.name)} <span class="ob-start-star">${p.school.prestige.toFixed(1)}\u2605</span></div>
    <div class="ob-start-why">${escapeHtml(p.why)}</div>
    <div class="ob-start-note">This is the job. It's waiting for you.</div>
  </div>`;
}
function loreStartAvailable() {
  if (ob.challenge === "takejob" || ob.challenge === "outpost") return true;
  if (!ob.division) return false;
  const key = `${ob.challenge}|${ob.division}`;
  if (_previewCache.key !== key) {
    try {
      const w = obGetWorld();
      _previewCache = { key, val: w ? findStartProgram(w, ob.challenge, ob.division) : null };
    } catch (e) {
      _previewCache = { key, val: null };
    }
  }
  return !!_previewCache.val;
}
function stepJob() {
  const isOutpost = ob.challenge === "outpost";
  const isLore = ob.challenge === "ashes" || ob.challenge === "hotseat" || ob.challenge === "heir";
  // Tree runs are locked to D3 regardless of game-plan complexity (Simple/Advanced).
  if (state._treeId) ob.division = "D3";
  const divCards = gameplanIsSimple() || state._treeId ? DIV_CARDS.filter((d) => d.id === "D3") : DIV_CARDS;
  if (isLore) {
    return `
    <div class="ob-step">
      <div class="ob-kicker">${obStepLabel(2)} \u2014 THE JOB</div>
      <h2 class="ob-headline">How big is the stage?</h2>
      <p class="ob-flavor">Pick a level. We'll find the program whose history matches your situation \u2014 the story chooses the school.</p>
      <div class="ob-card-grid">
        ${divCards.map((d) => `
          <button class="ob-pick-card${ob.division === d.id ? " active" : ""}" data-ob-div="${d.id}">
            <div class="ob-pick-head"><span class="ob-pick-icon">${d.icon}</span><span class="ob-pick-title">${d.title}</span></div>
            <div class="ob-pick-sub">${d.sub}</div>
            <div class="ob-pick-desc">${d.desc}</div>
          </button>`).join("")}
      </div>
      ${renderStartPreview()}
      <div class="ob-nav-row">
        <button class="btn-ghost" data-ob-back="${state._treeId ? "0" : "1"}">\u2190 Back</button>
        <button class="btn-primary ob-next" id="ob-next-2" ${!ob.division || ob.division && !loreStartAvailable() ? "disabled" : ""}>TAKE IT \u2192</button>
      </div>
    </div>`;
  }
  const states = isOutpost ? [{ state: "HI" }, { state: "AK" }] : availableStates().filter((s) => s.state !== "HI" && s.state !== "AK");
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
    <h2 class="ob-headline">${isOutpost ? "Which ocean?" : "Where does the story begin, Coach " + escapeHtml(ob.last || "") + "?"}</h2>
    <p class="ob-flavor">${isOutpost ? "Nobody plays football out here yet. You will found the program \u2014 and then recruit against 2,500 miles of open water for every kid on the mainland." : "Pick a state and a level, then choose the program you want to take over. Real towns, invented programs, and a hundred years of history already on the wall."}</p>

    <div class="ob-state-groups">
      ${Object.entries(byRegion).map(([region, sts]) => `
        <div class="ob-state-group">
          <div class="ob-region-label">${escapeHtml(REGION_LABELS[region] || region)}</div>
          <div class="ob-state-chips">
            ${sts.map((st) => `<button class="ob-chip${ob.state === st ? " active" : ""}" data-ob-state="${st}" title="${escapeHtml(STATE_NAMES[st] || st)}">${st}</button>`).join("")}
          </div>
        </div>`).join("")}
    </div>

    ${ob.state ? `
      <div class="ob-kicker" style="margin-top:16px">THE LEVEL${gameplanIsSimple() ? ` <span style="color:var(--gold);font-weight:600;letter-spacing:0">\u2014 D3 (Simple)</span>` : ""}</div>
      <div class="ob-card-grid">
        ${divCards.map((d) => `
          <button class="ob-pick-card${ob.division === d.id ? " active" : ""}" data-ob-div="${d.id}">
            <div class="ob-pick-head"><span class="ob-pick-icon">${d.icon}</span><span class="ob-pick-title">${d.title}</span></div>
            <div class="ob-pick-sub">${d.sub}</div>
            <div class="ob-pick-desc">${d.desc}</div>
          </button>`).join("")}
      </div>` : ""}

    ${!isOutpost && ob.state && ob.division ? renderSchoolPicker() : ""}
    ${isOutpost && ob.state && ob.division ? `<div class="ob-start-preview"><div class="ob-start-why">You will found the first program in ${escapeHtml(STATE_NAMES[ob.state] || ob.state)}. Every recruit in the country is an ocean away \u2014 but so is every rival recruiter.</div></div>` : ""}

    <div class="ob-nav-row">
      <button class="btn-ghost" data-ob-back="${state._treeId ? "0" : "1"}">\u2190 Back</button>
      <button class="btn-primary ob-next" id="ob-next-2" ${!ob.state || !ob.division || !isOutpost && !ob.schoolId ? "disabled" : ""}>
        ${isOutpost ? "FOUND IT \u2192" : ob.schoolId ? "TAKE THE JOB \u2192" : "PICK A PROGRAM"}
      </button>
    </div>
  </div>`;
}
function renderSchoolPicker() {
  const w = obGetWorld();
  const list = ((w == null ? void 0 : w.schools) || []).filter((s) => s.state === ob.state && s.division === ob.division);
  const stName = escapeHtml(STATE_NAMES[ob.state] || ob.state);
  list.sort((a, b) => b.prestige - a.prestige);
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
  return `
  <div class="ob-step">
    <div class="ob-kicker">${obStepLabel(3)} \u2014 THE BLUEPRINT</div>
    <h2 class="ob-headline">What kind of football do you believe in?</h2>
    <p class="ob-flavor">This shapes the roster we recruit for your first season \u2014 your QB room and your defensive bodies arrive built for it.</p>
    <div class="ob-section-label">QUARTERBACK TYPE</div>
    <div class="ob-card-grid ob-grid-2">
      ${QB_CARDS.map((q) => `
        <button class="ob-pick-card${ob.qbPref === q.id ? " active" : ""}" data-ob-qb="${q.id}">
          <div class="ob-pick-head"><span class="ob-pick-icon">${q.icon}</span><span class="ob-pick-title">${q.title}</span></div>
          <div class="ob-pick-sub">${q.sub}</div>
          <div class="ob-pick-desc">${q.desc}</div>
        </button>
      `).join("")}
    </div>
    <div class="ob-section-label">DEFENSIVE FRONT</div>
    <div class="ob-card-grid ob-grid-2">
      ${FRONT_CARDS.map((f) => `
        <button class="ob-pick-card${ob.defFront === f.id ? " active" : ""}" data-ob-front="${f.id}">
          <div class="ob-pick-head"><span class="ob-pick-icon">${f.icon}</span><span class="ob-pick-title">${f.title}</span></div>
          <div class="ob-pick-sub">${f.sub}</div>
          <div class="ob-pick-desc">${f.desc}</div>
        </button>
      `).join("")}
    </div>
    <div class="ob-nav-row">
      <button class="btn-ghost" data-ob-back="2">\u2190 Back</button>
      <button class="btn-primary ob-next" id="ob-next-3" ${!ob.qbPref || !ob.defFront ? "disabled" : ""}>FOUND THE PROGRAM \u2192</button>
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
          ${ob.challenge ? `<div class="ob-rv-row ob-rv-challenge"><span>Challenge</span><span>${(CHALLENGE_CARDS.find((c) => c.id === ob.challenge) || {}).icon || ""} ${(CHALLENGE_CARDS.find((c) => c.id === ob.challenge) || {}).title || ""}</span></div>` : ""}
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
function buildPending() {
  const world = obGetWorld() || generateWorld();
  const founding = ob.challenge === "outpost" || ob.challenge === "takejob" && ob.schoolId === "__found__";
  if (!founding) {
    let school = null, why = null;
    if (ob.challenge === "takejob") {
      school = world.schools.find((s) => s.id === ob.schoolId) || null;
    } else {
      const pick2 = findStartProgram(world, ob.challenge, ob.division);
      if (pick2) {
        school = pick2.school;
        why = pick2.why;
      }
    }
    if (school) {
      applyIdentityToSchool(school, ob.qbPref, ob.defFront);
      if (ob.oc && ob.dc) school.staff = { oc: ob.oc, dc: ob.dc };
      return {
        world,
        result: {
          school,
          replaced: null,
          takeover: true,
          startId: ob.challenge,
          startPick: why ? { why } : null,
          conference: { id: school.conf, name: school.conf, short: school.conf, division: school.division }
        }
      };
    }
  }
  const result = generatePlayerProgram(world, {
    state: ob.state,
    division: ob.division,
    qbPref: ob.qbPref,
    defFront: ob.defFront,
    challenge: ob.challenge,
    custom: ob.custom
  });
  result.startId = ob.challenge;
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
  ob.qbPref = rand2(QB_CARDS).id;
  ob.defFront = rand2(FRONT_CARDS).id;
  ob.oc = null;
  ob.dc = null;
  const p = buildPending();
  obStep = 0;
  startNewGamePrepared({ first: ob.first, last: ob.last }, p.world, p.result.school, p.result);
  state.settings = state.settings || {};
  state.settings.challenge = "takejob";
}
function saveNameInputs() {
  const f = document.getElementById("ob-first");
  const l = document.getElementById("ob-last");
  if (f) ob.first = f.value.trim();
  if (l) ob.last = l.value.trim();
}
function setupListeners3() {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i;
  (_a = document.getElementById("btn-back-to-menu")) == null ? void 0 : _a.addEventListener("click", () => {
    legacyMode = false;
    navigate("mainmenu");
  });
  if (legacyMode) {
    setupLegacyListeners();
    return;
  }
  (_b = document.getElementById("ob-legacy-link")) == null ? void 0 : _b.addEventListener("click", (e) => {
    e.preventDefault();
    saveNameInputs();
    legacyMode = true;
    rerender();
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
  {
    const sp = document.getElementById("ob-start-plan");
    if (sp) sp.addEventListener("change", (e) => {
      ob.startPlan = e.target.value || null;
      rerender();
    });
    const sd = document.getElementById("ob-start-def");
    if (sd) sd.addEventListener("change", (e) => {
      ob.startDef = e.target.value || null;
      rerender();
    });
  }
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
    if (state._treeId) {
      // Tree runs skip the situation step (locked to "take the job") and the
      // division-choice (locked to D3) and land on the school picker.
      ob.challenge = "takejob";
      ob.division = "D3";
      obStep = 2;
    } else {
      obStep = 1;
    }
    rerender();
  });
  document.querySelectorAll("[data-ob-state]").forEach((b) => b.addEventListener("click", () => {
    ob.state = b.dataset.obState;
    ob.schoolId = null;
    rerender();
  }));
  (_d = document.getElementById("ob-next-1")) == null ? void 0 : _d.addEventListener("click", () => {
    if (ob.challenge) {
      obStep = 2;
      rerender();
    }
  });
  document.querySelectorAll("[data-ob-school]").forEach((b) => b.addEventListener("click", () => {
    ob.schoolId = b.dataset.obSchool;
    rerender();
  }));
  document.querySelectorAll("[data-ob-challenge]").forEach((b) => b.addEventListener("click", () => {
    ob.challenge = b.dataset.obChallenge;
    ob.state = null;
    ob.division = null;
    ob.schoolId = null;
    rerender();
  }));
  document.querySelectorAll("[data-ob-div]").forEach((b) => b.addEventListener("click", () => {
    ob.division = b.dataset.obDiv;
    ob.schoolId = null;
    rerender();
  }));
  (_e = document.getElementById("ob-next-2")) == null ? void 0 : _e.addEventListener("click", () => {
    const needSchool = ob.challenge === "takejob";
    if (ob.division && (!needSchool || ob.schoolId)) {
      obStep = 3;
      rerender();
    }
  });
  document.querySelectorAll("[data-ob-qb]").forEach((b) => b.addEventListener("click", () => {
    ob.qbPref = b.dataset.obQb;
    rerender();
  }));
  document.querySelectorAll("[data-ob-front]").forEach((b) => b.addEventListener("click", () => {
    ob.defFront = b.dataset.obFront;
    rerender();
  }));
  (_f = document.getElementById("ob-next-3")) == null ? void 0 : _f.addEventListener("click", () => {
    if (!ob.qbPref || !ob.defFront) return;
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
      state.settings.challenge = ob.challenge;
      if (ob.challenge === "rebuild" && state.playerCoach) {
        state.playerCoach.jobSecurity = 90;
      }
      if (ob.challenge === "crisis" && state.playerCoach) {
        state.playerCoach.budget = Math.round((state.playerCoach.budget || 0) * 0.5);
      }
      if (ob.challenge === "custom" && state.playerCoach) {
        state.playerCoach.jobSecurity = ob.custom.jobSecurity;
        state.playerCoach.budget = Math.round((state.playerCoach.budget || 0) * (ob.custom.budgetPct / 100));
      }
      {
        const school2 = state.world.schools.find((s) => s.id === state.playerSchoolId);
        // apply* returns a NEW gameplan (never mutates), so the merged result has
        // to be written back — replace the contents, keeping engine _fields.
        const assignGp = (merged) => { for (const k of Object.keys(school2.gameplan)) { if (!k.startsWith("_")) delete school2.gameplan[k]; } Object.assign(school2.gameplan, merged); };
        const startBuiltin = ob.startPlan && !ob.startPlan.startsWith("pb:") && !ob.startPlan.startsWith("dpb:") ? builtinPlan(ob.startPlan) : null;
        if (startBuiltin && school2) applyPlanToSchool(school2, startBuiltin.gp);
        else if (school2 && ob.startPlan && ob.startPlan.startsWith("dpb:")) {
          // A starter book opens the season (always current-build-legal).
          const book = defaultOffBook(ob.startPlan.slice(4));
          if (book) { try { assignGp(applyPlaybookToGameplan(book, school2.gameplan)); } catch (e) { notify(`Couldn't apply "${book.name}" — starting with the staff's plan`, "warning"); } }
        }
        else if (school2 && ob.startPlan && ob.startPlan.startsWith("pb:")) {
          // A custom playbook opens the season: copy its formations + concepts.
          // Repair-on-load first — and never fail SILENTLY (the old bare catch
          // meant a stale book simply didn't apply and nobody was told).
          const pbRaw = loadCreationData("playbooks", ob.startPlan.slice(3));
          if (pbRaw) {
            const rep = repairCreation("playbooks", pbRaw);
            if (rep.ok) { try { assignGp(applyPlaybookToGameplan(rep.data, school2.gameplan)); if (rep.changes.length) notify(`Playbook updated for this build: ${rep.changes[0]}`, "warning"); } catch (e) { notify(`Couldn't apply "${pbRaw.name || "playbook"}" — starting with the staff's plan`, "warning"); } }
            else notify(`"${pbRaw.name || "Playbook"}" can't load in this build — starting with the staff's plan`, "warning");
          }
        }
        // A custom defense opens the season alongside the offense (swaps only the
        // defensive dials, so it composes with either preset or custom offense).
        if (school2 && ob.startDef && ob.startDef.startsWith("ddb:")) {
          const book = defaultDefBook(ob.startDef.slice(4));
          if (book) { try { assignGp(applyDefBookToGameplan(book, school2.gameplan)); } catch (e) { notify(`Couldn't apply "${book.name}" — starting with the staff's defense`, "warning"); } }
        } else if (school2 && ob.startDef && ob.startDef.startsWith("dd:")) {
          const dbRaw = loadCreationData("defbooks", ob.startDef.slice(3));
          if (dbRaw) {
            const rep = repairCreation("defbooks", dbRaw);
            if (rep.ok) { try { assignGp(applyDefBookToGameplan(rep.data, school2.gameplan)); if (rep.changes.length) notify(`Defense updated for this build: ${rep.changes[0]}`, "warning"); } catch (e) { notify(`Couldn't apply "${dbRaw.name || "defense"}" — starting with the staff's defense`, "warning"); } }
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
    saveNameInputs();
    obStep = parseInt(b.dataset.obBack);
    rerender();
  }));
}
function renderLegacy() {
  return `
  <div class="newgame">
    <div class="newgame-header">
      <div class="newgame-logo">
        <span class="logo-hex logo-hex-mark">${BLUEPRINT_MARK}</span>
        <h1>BLUEPRINT</h1>
        <p class="newgame-sub">Take Over an Existing Program</p>
      </div>
    </div>
    <div class="newgame-back">
      <button class="btn-ghost" id="btn-back-to-menu">\u2190 Main Menu</button>
      <button class="btn-ghost" id="btn-back-to-wizard">\u2190 Found a New Program Instead</button>
    </div>
    <div class="newgame-form-wrapper">
      <div class="newgame-card">
        <div class="form-section">
          <label class="form-label">COACH NAME</label>
          <div class="ob-name-row">
            <input class="form-input" id="ob-first" type="text" placeholder="First" aria-label="Coach first name" maxlength="16" autocomplete="off" value="${escapeHtml(ob.first)}" />
            <input class="form-input" id="ob-last" type="text" placeholder="Last" aria-label="Coach last name" maxlength="16" autocomplete="off" value="${escapeHtml(ob.last)}" />
          </div>
        </div>
        <div class="form-section">
          <label class="form-label">SELECT SCHOOL</label>
          <div class="division-tabs">
            ${["D1", "D2", "D3"].map((div) => `
              <button class="div-tab${activeDivision === div ? " active" : ""}" data-div="${div}">
                ${div === "D1" ? "Division I \u2014 Elite" : div === "D2" ? "Division II \u2014 Mid-Tier" : "Division III \u2014 Grassroots"}
              </button>
            `).join("")}
          </div>
          <div class="school-conf-grid" id="school-grid">
            ${renderSchoolGrid(activeDivision)}
          </div>
        </div>
        <div class="selected-school-info" id="selected-school-info" style="display:none">
          <div class="info-banner">
            <div>
              <div class="info-school-name" id="info-school-name"></div>
              <div class="info-school-detail" id="info-school-detail"></div>
            </div>
            <button class="btn-primary btn-start" id="btn-start">START DYNASTY \u2192</button>
          </div>
        </div>
      </div>
    </div>
  </div>
`;
}
function renderSchoolGrid(division) {
  var _a;
  const maxPips = ((_a = C.PRESTIGE_MAX) == null ? void 0 : _a[division]) || 5;
  const schools = SCHOOL_DATA.filter((s) => s.division === division);
  const byConf = {};
  for (const s of schools) (byConf[s.conf] = byConf[s.conf] || []).push(s);
  return Object.entries(byConf).map(([confId, confSchools]) => {
    const conf = CONFERENCES[confId];
    const classTag = (conf == null ? void 0 : conf.conferenceClass) === "power" ? '<span class="conf-class-tag conf-power">Power</span>' : (conf == null ? void 0 : conf.conferenceClass) === "midMajor" ? '<span class="conf-class-tag conf-midmajor">Mid-Major</span>' : "";
    return `
    <div class="conf-group">
      <div class="conf-group-header">
        <span class="conf-group-name">${escapeHtml((conf == null ? void 0 : conf.name) || confId)}</span>
        ${classTag}
      </div>
      <div class="conf-school-row">
        ${confSchools.map((s) => `
          <div class="school-card${selectedSchoolId === s.id ? " selected" : ""}" data-school-id="${s.id}" role="button" tabindex="0" aria-pressed="${selectedSchoolId === s.id ? "true" : "false"}" aria-label="Select ${escapeHtml(s.name)} ${escapeHtml(s.nick)}, ${escapeHtml(s.division)} program">
            <div class="school-card-header">
              <span class="school-crest">${renderCrest(s, 30)}</span>
              ${renderPrestigePips(s.prestige, maxPips)}
            </div>
            <div class="school-card-name">${escapeHtml(s.name)}</div>
            <div class="school-card-nick" style="color:${s.colors[0]}">${escapeHtml(s.nick)}</div>
            ${s.city ? `<div class="school-card-loc" style="font-size:11px;color:#6a7490;margin-top:1px;">${escapeHtml(s.city)}, ${escapeHtml(s.state)}</div>` : ""}
            ${schoolCardCoachLine(s)}
            <div class="school-card-colors">
              <span class="color-dot" style="background:${s.colors[0]}" title="${s.colors[0]}"></span>
              <span class="color-dot" style="background:${s.colors[1]}" title="${s.colors[1]}"></span>
              <span class="school-abbr-tag">${escapeHtml(s.abbr || "")}</span>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
  }).join("");
}
function renderPrestigePips(p, max = 5) {
  const filled = Math.max(0, Math.min(Math.round(p || 0), max));
  return `<span class="prestige-pips">${"\u25CF".repeat(filled)}${"\u25CB".repeat(max - filled)}</span>`;
}
function schoolCardCoachLine(s) {
  var _a, _b;
  const coach = s == null ? void 0 : s.coach;
  if (!coach) return `<div class="school-card-coach"><span>\u{1F454} Vacant</span></div>`;
  const first = ((_a = coach.name) == null ? void 0 : _a.first) || "";
  const last = ((_b = coach.name) == null ? void 0 : _b.last) || "Coach";
  const isYou = coach === state.playerCoach || s.id === state.playerSchoolId && !coach.isAI;
  const nm = escapeHtml(`${first} ${last}`.trim());
  return `<div class="school-card-coach"><span>\u{1F454} ${isYou ? `<span class="sc-coach-you">${nm} (You)</span>` : nm}</span></div>`;
}
function setupLegacyListeners() {
  var _a, _b;
  (_a = document.getElementById("btn-back-to-wizard")) == null ? void 0 : _a.addEventListener("click", () => {
    saveNameInputs();
    legacyMode = false;
    rerender();
  });
  document.querySelectorAll(".div-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      saveNameInputs();
      activeDivision = btn.dataset.div;
      rerender();
    });
  });
  document.querySelectorAll(".school-card").forEach((card) => {
    const selectCard = () => {
      document.querySelectorAll(".school-card").forEach((c) => {
        c.classList.remove("selected");
        c.setAttribute("aria-pressed", "false");
      });
      card.classList.add("selected");
      card.setAttribute("aria-pressed", "true");
      selectedSchoolId = card.dataset.schoolId;
      const school = SCHOOL_DATA.find((s) => s.id === selectedSchoolId);
      if (school) {
        const conf = CONFERENCES[school.conf];
        const maxPrestige = school.division === "D1" ? 6 : 5;
        document.getElementById("selected-school-info").style.display = "block";
        document.getElementById("info-school-name").textContent = `${school.name} ${school.nick}`;
        const loc = school.city ? `${school.city}, ${school.state} \xB7 ` : "";
        const venue = school.stadium ? ` \xB7 ${school.stadium.name} (${school.stadium.capacity.toLocaleString()})` : "";
        const enroll = school.enrollment ? ` \xB7 ${school.enrollment.toLocaleString()} students` : "";
        document.getElementById("info-school-detail").textContent = `${loc}${(conf == null ? void 0 : conf.name) || school.conf} \xB7 ${school.division} \xB7 Prestige ${school.prestige}/${maxPrestige}${venue}${enroll}`;
      }
    };
    card.addEventListener("click", selectCard);
    card.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      selectCard();
    });
  });
  (_b = document.getElementById("btn-start")) == null ? void 0 : _b.addEventListener("click", () => {
    saveNameInputs();
    if (!ob.first || !ob.last) {
      alert("Please enter your first and last name.");
      return;
    }
    if (!selectedSchoolId) {
      alert("Please select a school.");
      return;
    }
    try {
      startNewGame(`${ob.first} ${ob.last}`, selectedSchoolId);
    } catch (e) {
      console.error(e);
      alert("Error starting game: " + e.message);
    }
  });
}
var obStep, _obWorld, ob, pending, generating, legacyMode, activeDivision, selectedSchoolId, REGION_LABELS, STATE_NAMES, QB_CARDS, FRONT_CARDS, DIV_CARDS, obCand, CHALLENGE_CARDS, _previewCache;

obStep = 0;
_obWorld = null;
ob = {
  first: "",
  last: "",
  state: null,
  division: null,
  qbPref: null,
  defFront: null,
  challenge: "takejob",
  schoolId: null,
  oc: null,
  dc: null,
  custom: { prestige: 2, jobSecurity: 60, budgetPct: 100 }
};
pending = null;
generating = false;
legacyMode = false;
activeDivision = "D1";
selectedSchoolId = null;
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
QB_CARDS = [
  {
    id: "QB-Pocket",
    icon: "\u{1F3AF}",
    title: "THE SURGEON",
    sub: "Pro-Style Pocket Passer",
    desc: "Wins from the chalkboard \u2014 timing, protections, progressions. The pocket is a fortress, not a cage."
  },
  {
    id: "QB-Scrambler",
    icon: "\u26A1",
    title: "THE ESCAPE ARTIST",
    sub: "Dual-Threat Scrambler",
    desc: "When the pocket dies, the play is just getting started. Pistol/RPO looks, designed keepers, broken-play magic."
  },
  {
    id: "QB-Gunslinger",
    icon: "\u{1F52B}",
    title: "THE GUNSLINGER",
    sub: "Air Raid Big Arm",
    desc: "Big arm, bigger risks. Vertical shots, tight windows, and a fanbase with a heart condition."
  },
  {
    id: "QB-Game-Manager",
    icon: "\u265F\uFE0F",
    title: "THE CHESS PLAYER",
    sub: "Game Manager",
    desc: "Protect the ball, lean on the ground game, win field position. Boring is beautiful in November."
  }
];
FRONT_CARDS = [
  {
    id: "4-3",
    icon: "\u{1F6E1}\uFE0F",
    title: "4-3 FRONT",
    sub: "4 DL \xB7 3 LB \xB7 4 DB",
    desc: "Balanced base built on speed off the edge. Your DEs hunt quarterbacks; the MIKE cleans up everything else."
  },
  {
    id: "3-4",
    icon: "\u{1F9F1}",
    title: "3-4 FRONT",
    sub: "3 DL \xB7 4 LB \xB7 4 DB",
    desc: "Two-gapping 5-tech ends anchor the line so your stand-up OLBs can hunt. Versatile, blitz-friendly, built on mass."
  }
];
DIV_CARDS = [
  {
    id: "D1",
    icon: "\u{1F3DF}\uFE0F",
    title: "DIVISION I",
    sub: "The Big Time",
    desc: "90,000-seat cathedrals and TV money. You start in a mid-major \u2014 the powers don't know your name yet."
  },
  {
    id: "D2",
    icon: "\u{1F3C8}",
    title: "DIVISION II",
    sub: "The Proving Ground",
    desc: "Real scholarships, real bus rides. Close the gap between here and the big time."
  },
  {
    id: "D3",
    icon: "\u{1F331}",
    title: "DIVISION III",
    sub: "The Grassroots",
    desc: "Where dynasties are born in 3,000-seat stadiums. Every great story starts somewhere small."
  }
];
obCand = { oc: [], dc: [], key: null };
CHALLENGE_CARDS = [
  {
    id: "takejob",
    icon: "\u{1F3C8}",
    title: "Take the Job",
    desc: "Pick any program in the country and go to work. Some have banners and a century of hate; some have never won anything. You choose which."
  },
  {
    id: "outpost",
    icon: "\u{1F3DD}\uFE0F",
    title: "The Outpost",
    desc: "Found the first program in Hawaii or Alaska. Every recruit alive is an ocean away \u2014 your dollars land at a fraction and flying one kid in costs what the mainland pays for four. But nobody crosses that water to poach your islands either."
  },
  {
    id: "ashes",
    icon: "\u{1F9F1}",
    title: "The Ashes",
    desc: "Inherit a league penalty. Your class is capped at 14 for three years while rivals sign full \u2014 you develop your way out, or you don't. The AD knows, so the leash is long."
  },
  {
    id: "hotseat",
    icon: "\u{1F525}",
    title: "The Hot Seat",
    desc: "A fallen power. A loaded roster, a wall of banners, and an AD who measures you against the trophy case instead of last season. Every loss costs double."
  },
  {
    id: "heir",
    icon: "\u{1F451}",
    title: "The Heir",
    desc: "Follow a legend who just retired. His numbers are literally your mandate and his assistants are on your payroll at his prices. It can only get worse."
  }
];
_previewCache = { key: null, val: null };

export { devTakeJobStart, renderNewGame, setupListeners3, setupListeners3 as setupListeners };
