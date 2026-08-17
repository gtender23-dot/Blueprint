import { getCoach, updateCoach } from '../../engine/coachprofile.js';
import { exportJSON, importJSON } from '../../engine/persistence.js';
import { devAddBudget, devSimToPlayoffs, devSkipToNextGame, navigate, notify, rerender, saveNow, state } from '../../state.js';
import { escapeHtml, renderCrest } from '../../utils.js';

var settingsTab = "game";
function renderSettings() {
  var _a, _b, _c, _d, _e, _f;
  const s = state.settings || {};
  const SETTINGS_TABS = [["game", "Game"], ["program", "Program"], ["save", "Save"], ["dev", "Dev"]];
  if (!SETTINGS_TABS.some(([id]) => id === settingsTab)) settingsTab = "game";
  const tab = settingsTab;
  const pSchool = (_b = (_a = state.world) == null ? void 0 : _a.schools) == null ? void 0 : _b.find((x) => x.id === state.playerSchoolId);
  const toggle = (key, val, label) => `
  <button class="setting-toggle" data-setting="${key}" title="${label}">
    <span class="toggle-track${val ? " on" : ""}"><span class="toggle-thumb"></span></span>
    <span class="toggle-label">${val ? "ON" : "OFF"}</span>
  </button>
`;
  return `
  <div class="view-settings">
    <div class="view-header">
      <div>
        <h1 class="view-title">Settings</h1>
      </div>
    </div>

    <div class="rec-tabs" style="margin-bottom:12px">
      ${SETTINGS_TABS.map(([id, label]) => `
        <button class="rec-tab${tab === id ? " active" : ""}" data-settings-tab="${id}">${label}</button>`).join("")}
    </div>

    <div style="display:${tab === "save" ? "block" : "none"}">
    <div class="card">
      <div class="card-title">SAVE BACKUP</div>
      <p class="offseason-hint" style="margin:0 0 8px">Your dynasty lives in this browser. Export a backup file before clearing data or switching devices \u2014 import it anywhere to continue.</p>
      <div class="offseason-item">
        <span class="offseason-label">Export save</span>
        <span class="offseason-detail"><button class="btn-ghost btn-sm" id="btn-export-save">Download .json</button></span>
      </div>
      <div class="offseason-item">
        <span class="offseason-label">Import save</span>
        <span class="offseason-detail"><button class="btn-ghost btn-sm" id="btn-import-save">Choose file</button>
          <input type="file" id="import-save-file" accept="application/json,.json" style="display:none" /></span>
      </div>
    </div>
    </div>

    <div style="display:${tab === "program" ? "block" : "none"}">
    <div class="card">
      <div class="card-title">CUSTOMIZE YOUR PROGRAM</div>
      <p class="offseason-hint" style="margin:0 0 8px">The world is fictional by design \u2014 but it's your save. Rename your school, its nickname, or its stadium, and repaint your colors \u2014 the whole UI (buttons, nav, crest, and school-color mode) follows them. (Only your own program; the rest of the world keeps its generated identity.)</p>
      <div class="offseason-item">
        <span class="offseason-label">School</span>
        <span class="offseason-detail"><input class="rename-input" id="rename-school" type="text" maxlength="34" value="${escapeHtml((pSchool == null ? void 0 : pSchool.name) || "")}" /></span>
      </div>
      <div class="offseason-item">
        <span class="offseason-label">Nickname</span>
        <span class="offseason-detail"><input class="rename-input" id="rename-nick" type="text" maxlength="22" value="${escapeHtml((pSchool == null ? void 0 : pSchool.nick) || "")}" /></span>
      </div>
      <div class="offseason-item">
        <span class="offseason-label">Stadium</span>
        <span class="offseason-detail"><input class="rename-input" id="rename-stadium" type="text" maxlength="34" value="${escapeHtml(((_c = pSchool == null ? void 0 : pSchool.stadium) == null ? void 0 : _c.name) || "")}" /></span>
      </div>
      <div class="offseason-item">
        <span class="offseason-label"></span>
        <span class="offseason-detail"><button class="btn-ghost btn-sm" id="btn-rename-save">Save names</button></span>
      </div>
      <div class="offseason-item">
        <span class="offseason-label">Primary color</span>
        <span class="offseason-detail"><input class="color-input" id="color-primary" type="color" value="${((_d = pSchool == null ? void 0 : pSchool.colors) == null ? void 0 : _d[0]) || "#00d95f"}" /></span>
      </div>
      <div class="offseason-item">
        <span class="offseason-label">Secondary color</span>
        <span class="offseason-detail"><input class="color-input" id="color-secondary" type="color" value="${((_e = pSchool == null ? void 0 : pSchool.colors) == null ? void 0 : _e[1]) || "#ffd740"}" /></span>
      </div>
      <div class="offseason-item">
        <span class="offseason-label"></span>
        <span class="offseason-detail"><button class="btn-ghost btn-sm" id="btn-colors-reset" ${(pSchool == null ? void 0 : pSchool._origColors) ? "" : "disabled"}>Reset original colors</button></span>
      </div>
      <div class="offseason-item">
        <span class="offseason-label">Team logo</span>
        <span class="offseason-detail" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span class="logo-preview">${pSchool ? renderCrest(pSchool, 44) : ""}</span>
          <button class="btn-ghost btn-sm" id="btn-logo-upload">${(pSchool == null ? void 0 : pSchool.crestImg) ? "Replace logo" : "Upload logo"}</button>
          <button class="btn-ghost btn-sm" id="btn-logo-remove" ${(pSchool == null ? void 0 : pSchool.crestImg) ? "" : "disabled"}>Use letter mark</button>
          <button class="btn-ghost btn-sm" id="btn-logo-reroll" ${(pSchool == null ? void 0 : pSchool.crestImg) ? "disabled" : ""} title="Spin a new letter-mark look \u2014 same letters and colors, different frame and style">\u21BB Reroll mark</button>
          <input type="file" id="logo-file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style="display:none" />
        </span>
      </div>
      <p class="offseason-hint" style="margin:2px 0 0;font-size:11px">Drop in any image \u2014 it's fitted into your team mark and saved with your dynasty. Leave it off and every school uses its generated letter mark.</p>
    </div>
    </div>

    <div style="display:${tab === "game" ? "block" : "none"}">
    <div class="card">
      <div class="offseason-item">
        <span class="offseason-label">\u{1F4D6} The Manual</span>
        <span class="offseason-detail"><button class="btn-ghost btn-sm" id="btn-settings-guide">Open manual</button></span>
      </div>
    </div>
    <div class="card settings-card">
      <div class="card-header"><span class="card-title">GAME SETTINGS</span></div>
      <div class="settings-list">

        ${[
    [
      "difficulty",
      "On-Field Difficulty",
      "How well AI opponents EXECUTE in your games (league games between AI teams are never touched, so records and rankings stay honest). Freshman: they play below their talent. Varsity: the pure game. All-American: sharp enough to cancel a well-tuned gameplan at even talent. Legend: every opponent plays its best game of the year, every week."
    ],
    [
      "diffCoaching",
      "AI Coaching IQ",
      "How sharp opposing STAFFS are against you \u2014 weekly game-planning and halftime counters. Freshman staffs sometimes don\u2019t game-plan at all and react at half strength. All-American reads your film harder and counters off a smaller sample. Legend staffs game-plan like pros: stronger keys, faster halftime adjustments. Only applies to teams playing YOU."
    ],
    // M5 (#29): Season Mode runs no recruiting \u2014 its stray settings hide there.
    ...state.seasonMode ? [] : [[
      "diffRecruiting",
      "Recruiting Difficulty",
      "How hard rival programs push in recruiting battles. Freshman rivals spend soft. Varsity is the pure market. All-American and Legend rivals push their boards harder and spend faster \u2014 you\u2019ll need real strategy (and budget) to win contested kids. The rules never change, only the pressure."
    ]]
  ].map(([key, label, desc]) => `
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">${label}</div>
            <div class="setting-desc">${desc}</div>
          </div>
          <div class="gp-options" style="flex-wrap:wrap">
            ${[["freshman", "Freshman"], ["varsity", "Varsity"], ["allamerican", "All-American"], ["legend", "Legend"]].map(([v, l]) => `
              <button class="gp-option gp-option-sm${(s[key] || "varsity") === v ? " active" : ""}" data-diff-key="${key}" data-diff-val="${v}">${l}</button>`).join("")}
          </div>
        </div>`).join("")}

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Game Plan Detail</div>
            <div class="setting-desc">Simple: a few big, plain-language dials \u2014 you set the identity and the sim handles the scheme. Advanced: every situational knob, formation split and coverage default is yours. The simulation is identical either way; this only changes how much of it you drive.</div>
          </div>
          <div class="gp-options" style="flex-wrap:wrap">
            ${[["simple", "Simple"], ["advanced", "Advanced"]].map(([v, l]) => `
              <button class="gp-option gp-option-sm${(s.gameplanMode === "simple" ? "simple" : "advanced") === v ? " active" : ""}" data-gpmode="${v}">${l}</button>`).join("")}
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Dark Mode</div>
            <div class="setting-desc">OFF (default): school-color mode \u2014 page, card and table backgrounds repaint in your program's colors. ON: the classic dark look</div>
          </div>
          ${toggle("darkMode", s.darkMode === true, "Dark mode")}
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Game Result Popup</div>
            <div class="setting-desc">Show box score after each of your games</div>
          </div>
          ${toggle("showGameResultModal", s.showGameResultModal !== false, "Show game result popup")}
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Default Live Game Experience</div>
            <div class="setting-desc">Default for future games. ON: open each game in live Coach Mode. OFF: sim straight to the result. A one-game Coach Mode override does not change this default.</div>
          </div>
          ${toggle("liveWatch", s.liveWatch !== false, "Default to live Coach Mode for future games")}
        </div>
        <div class="offseason-item">
          <span class="offseason-label">Sound &amp; vibration</span>
          ${toggle("sound", s.sound !== false, "Sound and haptic cues")}
        </div>
        <div class="offseason-item">
          <span class="offseason-label">Injuries</span>
          ${toggle("injuries", s.injuries !== false, "Player injuries")}
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Flag Rate</div>
            <div class="setting-desc">How often the officials throw flags, in every simulated game \u2014 yours and the AI's, so league stats stay honest. 100% is the old tuned rate; the default is 90% (10% fewer flags). 0% turns penalties off entirely.</div>
          </div>
          <div class="penalty-dial">
            <input type="range" id="penalty-rate-dial" min="0" max="150" step="5"
                   value="${Number.isFinite(+s.penaltyRate) ? +s.penaltyRate : 90}"
                   aria-label="Flag rate percent">
            <span class="penalty-dial-val" id="penalty-rate-val">${Number.isFinite(+s.penaltyRate) ? +s.penaltyRate : 90}%</span>
          </div>
        </div>

        ${state.seasonMode ? "" : `
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Rival Commit Alerts</div>
            <div class="setting-desc">Inbox notification when a recruit you're chasing commits elsewhere</div>
          </div>
          ${toggle("rivalCommitNotifications", s.rivalCommitNotifications !== false, "Notify on rival commits")}
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Recruiting Assist</div>
            <div class="setting-desc">Off: you recruit. Assist: your staff handles the legwork and offers on your roster needs. Full: your staff runs the whole class hands-off. Fine-tune the strategy on the Recruiting screen's Assist tab</div>
          </div>
          <div class="gp-options" style="flex-wrap:nowrap">
            ${[["off", "Off"], ["full", "On"]].map(([v, l]) => `<button class="gp-option gp-option-sm${(s.recruitAssist || (s.autoRecruit ? "full" : "off")) === v ? " active" : ""}" data-assist-level="${v}">${l}</button>`).join("")}
          </div>
        </div>`}

      </div>
    </div>

    <div class="card settings-card">
      <div class="card-header"><span class="card-title">PRESENTATION</span></div>
      <div class="settings-list">

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Instant Replays</div>
            <div class="setting-desc">How often the broadcast cuts to a replay during a live watch. High: every big play. Low: scores and turnovers only. Off: never. (The watch bar's Replays button is this same dial.) Presentation only.</div>
          </div>
          <div class="gp-options" style="flex-wrap:nowrap">
            ${(() => {
    const rf = s.replayFreq === "off" || s.replayFreq === "low" || s.replayFreq === "high" ? s.replayFreq : s.watchReplays === false ? "off" : "high";
    return [["off", "Off"], ["low", "Low"], ["high", "High"]].map(([v, l]) => `<button class="gp-option gp-option-sm${rf === v ? " active" : ""}" data-replayfreq="${v}">${l}</button>`).join("");
  })()}
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Pre-Snap Play Art</div>
            <div class="setting-desc">ON (default): the called play's card art draws over the fielded players before the snap — routes, blocks and the run path, exactly as the card shows them. Presentation only.</div>
          </div>
          ${toggle("presnapArt", s.presnapArt !== false, "Draw the called play over the field before the snap")}
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">8-Bit Players</div>
            <div class="setting-desc">ON (default): the live chalkboard runs the play with little Tecmo-style sprite players in each team's colors. OFF: the classic dots-and-X's markers. Presentation only — the game underneath is identical.</div>
          </div>
          ${toggle("spriteWatch", s.spriteWatch !== false, "8-bit sprite players on the live chalkboard")}
        </div>

      </div>
    </div>
    </div>

    <div style="display:${tab === "dev" ? "block" : "none"}">
    <div class="card settings-card dev-tools-card">
      <div class="card-header">
        <span class="card-title">DEV TOOLS</span>
        <span class="dev-warning-badge">\u26A0 affects game balance</span>
      </div>
      <div class="settings-list">

        ${state.seasonMode ? "" : `
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Reveal All Scouting</div>
            <div class="setting-desc">Show true ratings and potential for all recruits without scouting them</div>
          </div>
          ${toggle("revealScouting", !!s.revealScouting, "Reveal scouting")}
        </div>`}

      </div>

      <div class="dev-actions">
        <button class="btn-ghost dev-action-btn" id="dev-add-10k">+ $10k Budget</button>
        <button class="btn-ghost dev-action-btn" id="dev-add-50k">+ $50k Budget</button>
        <button class="btn-ghost dev-action-btn" id="dev-next-game">Skip to Next Game</button>
        <button class="btn-ghost dev-action-btn" id="dev-sim-season">Sim to Playoffs</button>
      </div>
    </div>

    <div class="card settings-card dev-notepad-card">
      <div class="card-header">
        <span class="card-title">\u{1F4DD} NOTEPAD</span>
        <span class="card-sub" id="dev-notepad-status">${state._coachId ? "travels with your coach" : "saved with your dynasty"}</span>
      </div>
      <textarea class="dev-notepad" id="dev-notepad" rows="12" spellcheck="false" placeholder="Scratch notes \u2014 ideas, bugs, to-dos\u2026 anything. Follows your coach across every dynasty.">${escapeHtml((state._coachId ? (_f = getCoach(state._coachId)) == null ? void 0 : _f.notes : state.devNotes) || "")}</textarea>
    </div>
    </div>
  </div>
`;
}
function setupListeners15() {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p;
  document.querySelectorAll("[data-settings-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      settingsTab = btn.dataset.settingsTab;
      rerender();
    });
  });
  (_a = document.getElementById("btn-rename-save")) == null ? void 0 : _a.addEventListener("click", () => {
    var _a2, _b2, _c2, _d2, _e2, _f2, _g2, _h2, _i2, _j2;
    const school = (_b2 = (_a2 = state.world) == null ? void 0 : _a2.schools) == null ? void 0 : _b2.find((x) => x.id === state.playerSchoolId);
    if (!school) return;
    const nm = (_d2 = (_c2 = document.getElementById("rename-school")) == null ? void 0 : _c2.value) == null ? void 0 : _d2.trim();
    const nk = (_f2 = (_e2 = document.getElementById("rename-nick")) == null ? void 0 : _e2.value) == null ? void 0 : _f2.trim();
    const st = (_h2 = (_g2 = document.getElementById("rename-stadium")) == null ? void 0 : _g2.value) == null ? void 0 : _h2.trim();
    if (nm) school.name = nm.slice(0, 34);
    if (nk) school.nick = nk.slice(0, 22);
    if (st && school.stadium) school.stadium.name = st.slice(0, 34);
    for (const other of state.world.schools) {
      if (((_i2 = other.rival) == null ? void 0 : _i2.schoolId) === school.id) other.rival.name = school.name;
    }
    if (((_j2 = state.rivalry) == null ? void 0 : _j2.schoolId) === school.id) state.rivalry.schoolName = school.name;
    saveNow().then((ok) => notify(ok ? "Names saved \u2014 welcome to the new era." : "Renamed, but the save FAILED \u2014 storage full or blocked.", ok ? "success" : "error"));
    rerender();
  });
  const applyColors = () => {
    var _a2, _b2, _c2, _d2;
    const school = (_b2 = (_a2 = state.world) == null ? void 0 : _a2.schools) == null ? void 0 : _b2.find((x) => x.id === state.playerSchoolId);
    if (!school) return;
    const c1 = (_c2 = document.getElementById("color-primary")) == null ? void 0 : _c2.value;
    const c2 = (_d2 = document.getElementById("color-secondary")) == null ? void 0 : _d2.value;
    if (!c1 || !c2) return;
    if (!school._origColors) school._origColors = [...school.colors || []];
    school.colors = [c1, c2];
    saveNow().then((ok) => {
      if (!ok) notify("Colors set, but the save FAILED \u2014 storage full or blocked.", "error");
    });
    rerender();
  };
  (_b = document.getElementById("color-primary")) == null ? void 0 : _b.addEventListener("change", applyColors);
  (_c = document.getElementById("color-secondary")) == null ? void 0 : _c.addEventListener("change", applyColors);
  (_d = document.getElementById("btn-colors-reset")) == null ? void 0 : _d.addEventListener("click", () => {
    var _a2, _b2;
    const school = (_b2 = (_a2 = state.world) == null ? void 0 : _a2.schools) == null ? void 0 : _b2.find((x) => x.id === state.playerSchoolId);
    if (!(school == null ? void 0 : school._origColors)) return;
    school.colors = [...school._origColors];
    delete school._origColors;
    saveNow();
    notify("Original colors restored.", "success");
    rerender();
  });
  (_e = document.getElementById("btn-logo-upload")) == null ? void 0 : _e.addEventListener("click", () => {
    var _a2;
    (_a2 = document.getElementById("logo-file")) == null ? void 0 : _a2.click();
  });
  (_f = document.getElementById("logo-file")) == null ? void 0 : _f.addEventListener("change", (e) => {
    var _a2, _b2, _c2;
    const file = (_a2 = e.target.files) == null ? void 0 : _a2[0];
    if (!file) return;
    const school = (_c2 = (_b2 = state.world) == null ? void 0 : _b2.schools) == null ? void 0 : _c2.find((x) => x.id === state.playerSchoolId);
    if (!school) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 160, scale = Math.min(max / img.width, max / img.height, 1);
        const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;
        cv.getContext("2d").drawImage(img, 0, 0, w, h);
        try {
          school.crestImg = cv.toDataURL("image/png");
          saveNow();
          notify("Logo set \u2014 it now flies over your program.", "success");
          rerender();
        } catch (e2) {
          notify("Could not read that image \u2014 try a PNG.", "error");
        }
      };
      img.onerror = () => notify("Could not load that image.", "error");
      img.src = reader.result;
    };
    reader.onerror = () => notify("Could not read that file.", "error");
    reader.readAsDataURL(file);
  });
  (_g = document.getElementById("btn-logo-remove")) == null ? void 0 : _g.addEventListener("click", () => {
    var _a2, _b2;
    const school = (_b2 = (_a2 = state.world) == null ? void 0 : _a2.schools) == null ? void 0 : _b2.find((x) => x.id === state.playerSchoolId);
    if (!(school == null ? void 0 : school.crestImg)) return;
    delete school.crestImg;
    saveNow();
    notify("Back to your letter mark.", "success");
    rerender();
  });
  (_h = document.getElementById("btn-logo-reroll")) == null ? void 0 : _h.addEventListener("click", () => {
    var _a2, _b2;
    const school = (_b2 = (_a2 = state.world) == null ? void 0 : _a2.schools) == null ? void 0 : _b2.find((x) => x.id === state.playerSchoolId);
    if (!school || school.crestImg) return;
    school.crestSeed = (school.crestSeed || 0) + 1;
    saveNow();
    notify("New mark spun up.", "success");
    rerender();
  });
  (_i = document.getElementById("btn-export-save")) == null ? void 0 : _i.addEventListener("click", () => {
    try {
      exportJSON(state);
      notify("Save exported \u2014 check your downloads.");
    } catch (e) {
      notify("Export failed: " + e.message);
    }
  });
  (_j = document.getElementById("btn-import-save")) == null ? void 0 : _j.addEventListener("click", () => {
    var _a2;
    (_a2 = document.getElementById("import-save-file")) == null ? void 0 : _a2.click();
  });
  (_k = document.getElementById("import-save-file")) == null ? void 0 : _k.addEventListener("change", async (e) => {
    var _a2;
    const file = (_a2 = e.target.files) == null ? void 0 : _a2[0];
    if (!file) return;
    try {
      const text = await file.text();
      const saved = importJSON(text);
      if (!saved) {
        notify("That file is not a dynasty save.");
        return;
      }
      if (saved._incompatible) {
        notify("Save is from a different game version \u2014 cannot import.");
        return;
      }
      Object.keys(state).forEach((k) => {
        delete state[k];
      });
      Object.assign(state, saved);
      state.ui = state.ui || {};
      notify("Save imported. Welcome back, coach.");
      navigate("dashboard");
    } catch (err) {
      notify("Import failed: " + err.message);
    } finally {
      e.target.value = "";
    }
  });
  (_l = document.getElementById("btn-settings-guide")) == null ? void 0 : _l.addEventListener("click", () => {
    navigate("manual");
  });
  document.querySelectorAll("[data-diff-key]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!state.settings) state.settings = {};
      state.settings[btn.dataset.diffKey] = btn.dataset.diffVal;
      rerender();
    });
  });
  document.querySelectorAll("[data-gpmode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!state.settings) state.settings = {};
      state.settings.gameplanMode = btn.dataset.gpmode;
      rerender();
    });
  });
  document.querySelectorAll("[data-replayfreq]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!state.settings) state.settings = {};
      state.settings.replayFreq = btn.dataset.replayfreq;
      delete state.settings.watchReplays;
      rerender();
    });
  });
  document.querySelectorAll("[data-assist-level]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!state.settings) state.settings = {};
      state.settings.recruitAssist = btn.dataset.assistLevel;
      rerender();
    });
  });
  const penDial = document.getElementById("penalty-rate-dial");
  if (penDial) {
    penDial.addEventListener("input", () => {
      const lbl = document.getElementById("penalty-rate-val");
      if (lbl) lbl.textContent = `${penDial.value}%`;
      if (!state.settings) state.settings = {};
      state.settings.penaltyRate = +penDial.value;
    });
    penDial.addEventListener("change", () => rerender());
  }
  document.querySelectorAll("[data-setting]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!state.settings) state.settings = {};
      const key = btn.dataset.setting;
      if (key === "showGameResultModal" || key === "rivalCommitNotifications" || key === "sound" || key === "injuries" || key === "liveWatch" || key === "spriteWatch" || key === "presnapArt") {
        state.settings[key] = state.settings[key] === false ? true : false;
      } else {
        state.settings[key] = !state.settings[key];
      }
      rerender();
    });
  });
  (_m = document.getElementById("dev-add-10k")) == null ? void 0 : _m.addEventListener("click", () => {
    devAddBudget(1e4);
    notify("+ $10k added to your budget", "success");
    rerender();
  });
  (_n = document.getElementById("dev-add-50k")) == null ? void 0 : _n.addEventListener("click", () => {
    devAddBudget(5e4);
    notify("+ $50k added to your budget", "success");
    rerender();
  });
  (_o = document.getElementById("dev-next-game")) == null ? void 0 : _o.addEventListener("click", async () => {
    await devSkipToNextGame();
  });
  (_p = document.getElementById("dev-sim-season")) == null ? void 0 : _p.addEventListener("click", async () => {
    await devSimToPlayoffs();
    notify("Simulated to playoffs \u2014 check inbox for results", "info");
  });
  const _np = document.getElementById("dev-notepad");
  if (_np) {
    const _npStatus = document.getElementById("dev-notepad-status");
    let _npTimer = null;
    _np.addEventListener("input", () => {
      const val = _np.value;
      if (_npStatus) _npStatus.textContent = "saving\u2026";
      clearTimeout(_npTimer);
      _npTimer = setTimeout(() => {
        if (state._coachId) {
          const ok = !!updateCoach(state._coachId, (c) => {
            c.notes = val;
          });
          if (_npStatus) _npStatus.textContent = ok ? "saved \xB7 travels with your coach" : "save failed";
        } else {
          state.devNotes = val;
          saveNow().then((ok) => {
            if (_npStatus) _npStatus.textContent = ok ? "saved" : "save failed";
          });
        }
      }, 700);
    });
  }
}

export { renderSettings, setupListeners15 };
