import { C } from '../../constants.js';
import { divisionMemoryText, expectedWins, mandateText, seatState } from '../../engine/career.js';
// [W9 §12] THE TREE, ON SCREEN — every fork is a button here; the engine
// refuses anything the rules don't allow, so the UI never knows the rules twice.
import { applyDown, applyDownTargets, buildRetirementCeremony, canApplyDown, canRetire, declineHandoff, ensureTree, executeHandoff, forkArmed, handoffCandidates, isTreeGame, noteOfferDeclined, openDivisions, pendingHandoff, promoteCoordinatorToHC, promotionCandidates, retireActiveCoach, treeSnapshot } from '../../engine/tree.js';
import { SKILL_KEYS, skillGrade, skillProgress } from '../../engine/coach.js';
import { DNA_AXES, coachDNA, dnaGrade, dnaStarLabel, dnaStarTier, dnaTitle, dnaXpForNextGrade } from '../../engine/coachprofile.js';
import { declineOffersWithLeverage, visibleStages } from '../../engine/offseason.js';
import { buyFacilityUpgrade, facilityLevel, facilityUpgradeCost, facilityUpkeep } from '../../engine/recruiting.js';
import { acceptJob, weekLabel } from '../../engine/season.js';
import { deriveSchemeIdentity, ensureAmbition, generateCandidates, schemeStarTier } from '../../engine/staff.js';
import { getPlayerSchool, notify, notifyJobMoveCosts, rerender, saveNow, state, switchTreeSlot } from '../../state.js';
import { tipTerm } from '../manual/tips.js';
import { escapeHtml } from '../../utils.js';

var AWARD_LABEL = {
  "weekly-off": "Offensive Player of the Week",
  "weekly-def": "Defensive Player of the Week",
  COY: "Conference Coach of the Year",
  MVP: "Division MVP",
  DivCOY: "Division Coach of the Year"
};
var RATING_LABELS = {
  qbRunDesign: "QB Run Design",
  passGame: "Pass Game",
  runGame: "Run Game",
  blitzDesign: "Blitz Design",
  coverage: "Coverage",
  runFits: "Run Fits"
};
var SKILL_META = {
  evaluator: { label: "Evaluator", blurb: "How clearly you read raw talent before scouting." },
  recruiter: { label: "Recruiter", blurb: "Your pull on the trail \u2014 the closer\u2019s edge." },
  developer: { label: "Developer", blurb: "How much your players grow under your program." },
  reputation: { label: "Reputation", blurb: "What the sport thinks of you. Backs your job security." },
  roots: { label: "Roots", blurb: "Your grip on the local market \u2014 cheap wins close to home." }
};
function renderCoachOffice(embed = false, tab = "identity") {
  var _a, _b;
  const coach = state.playerCoach;
  if (!coach) return `<div class="empty-state">No active coach.</div>`;
  const name = `${((_a = coach.name) == null ? void 0 : _a.first) || "Coach"} ${((_b = coach.name) == null ? void 0 : _b.last) || ""}`.trim();
  const wins = coach.careerWins || 0;
  const losses = coach.careerLosses || 0;
  const titles = coach.titles || 0;
  const unemployed = coach.status === "unemployed";
  // [DNA TREE §4 D3 — un-fold, display side] Developer + Recruiter returned
  // to the skills system, so they show HERE again (they left the DNA card
  // with the un-fold and briefly had no surface at all — owner-flagged).
  // Evaluator stays folded into recruiting (shown on the recruiting screen).
  const PLAYER_SKILLS = ["recruiter", "developer", "reputation", "roots"];
  const skillCards = PLAYER_SKILLS.map((key) => {
    const meta = SKILL_META[key];
    const grade = skillGrade(coach, key);
    const p = skillProgress(coach, key);
    const nextTxt = p.nextXP == null ? "MAX" : `${p.curXP} / ${p.nextXP} XP`;
    return `
    <div class="skill-row">
      <div class="skill-head">
        <span class="skill-name">${meta.label}</span>
        <span class="skill-grade grade-${grade.replace("+", "plus").replace("-", "minus")}">${grade}</span>
      </div>
      <div class="skill-bar"><div class="skill-bar-fill" style="width:${Math.round(p.pct * 100)}%"></div></div>
      <div class="skill-meta muted">${meta.blurb} <span class="skill-xp">${nextTxt}</span></div>
    </div>`;
  }).join("");
  const bd = coach.revenueBreakdown;
  const fmt = (n) => "$" + (n || 0).toLocaleString();
  const ledger = bd ? `
  <div class="card">
    <div class="card-header"><span class="card-title">ATHLETIC DEPARTMENT</span>
      <span class="muted" style="font-size:11px">this season's funding</span></div>
    <div class="ledger">
      <div class="ledger-row"><span>Base allocation</span><span>${fmt(bd.base)}</span></div>
      <div class="ledger-row"><span>Gate revenue
        <span class="muted ledger-formula">${bd.capacity.toLocaleString()} seats \xD7 ${Math.round(bd.fill * 100)}% fill \xD7 $${bd.price} \xD7 ${Math.round(bd.share * 100)}% to program</span></span>
        <span>${fmt(bd.tickets)}</span></div>
      ${bd.carryover ? `<div class="ledger-row"><span>Carryover <span class="muted ledger-formula">leftovers + title & AD-goal bonuses</span></span><span>${fmt(bd.carryover)}</span></div>` : ""}
      ${bd.retentionBonus ? `<div class="ledger-row"><span>Loyalty raises <span class="muted ledger-formula">${bd.retentionStacks} raise${bd.retentionStacks === 1 ? "" : "s"} (re-ups + declined calls) \xD7 10% of base${bd.retentionStacks >= 10 ? " (capped \u2014 double money)" : ""}</span></span><span>${fmt(bd.retentionBonus)}</span></div>` : ""}
      ${bd.salaries ? `<div class="ledger-row"><span>Staff salaries <span class="muted ledger-formula">OC + DC annual</span></span><span>\u2212${fmt(bd.salaries)}</span></div>` : ""}
      ${bd.upkeep ? `<div class="ledger-row"><span>Facility upkeep</span><span>\u2212${fmt(bd.upkeep)}</span></div>` : ""}
      <div class="ledger-row ledger-total"><span>Season pool</span><span>${fmt(bd.total)}</span></div>
      <div class="ledger-row"><span>Remaining now</span><span class="${(coach.budget || 0) < bd.total * 0.2 ? "ledger-low" : ""}">${fmt(coach.budget)}</span></div>
    </div>
    <p class="offseason-hint" style="margin:8px 0 0">Winning fills the stands \u2014 every win last season is worth +2% gate. Recruiting, and soon staff salaries and facilities, all draw from this one pool.</p>
  </div>` : "";
  const school = getPlayerSchool();
  const EFFECT_LINE = {
    stadium: (l) => `${l >= 2 ? "+" : ""}${(l - 2) * 10}% effective capacity \u2192 gate revenue`,
    training: (l) => `${l >= 2 ? "+" : ""}${(l - 2) * 6}% development from practice`,
    recruiting: (l) => `${l >= 2 ? "+" : ""}${(l - 2) * 10}% interest from visits`,
    medicine: (l) => `${l >= 2 ? "\u2212" : "+"}${Math.abs((l - 2) * 8)}% injury length`
  };
  const facilities = school ? `
  <div class="card">
    <div class="card-header"><span class="card-title">FACILITIES</span>
      <span class="muted" style="font-size:11px">upkeep ${fmt(facilityUpkeep(school))}/yr</span></div>
    ${C.FACILITIES.TRACKS.map((t) => {
    const lvl = facilityLevel(school, t);
    const cost = facilityUpgradeCost(school, t);
    const maxed = lvl >= C.FACILITIES.MAX_LEVEL;
    const canAfford = (coach.budget || 0) >= cost;
    return `
        <div class="fac-row">
          <div class="fac-info">
            <div class="fac-name">${C.FACILITIES.LABELS[t]}
              <span class="fac-pips">${"\u25AE".repeat(lvl)}${"\u25AF".repeat(C.FACILITIES.MAX_LEVEL - lvl)}</span></div>
            <div class="fac-effect muted">${EFFECT_LINE[t](lvl)}</div>
          </div>
          ${maxed ? '<span class="fac-maxed">MAX</span>' : `<button class="btn-ghost btn-sm fac-buy" data-fac-buy="${t}" ${canAfford ? "" : "disabled"}>Upgrade ${fmt(cost)}</button>`}
        </div>`;
  }).join("")}
    <p class="offseason-hint" style="margin:8px 0 0">Upgrades and upkeep come out of the same pool as recruiting. Level 2 is neutral \u2014 below it, a facility is actively hurting you.</p>
  </div>` : "";
  const dna = state._coachId ? coachDNA(state._coachId) : null;
  // [DNA TREE §5b.2] YOUR OWN SHEET — the formations you actually call, in
  // star language. Grows with real calls, rusts on the shelf; the bonus fills
  // the coordinator envelope and never exceeds it.
  const _pc = state.playerCoach;
  const masteryCard = _pc && _pc.masteryIQ ? (() => {
    const rows = Object.entries(_pc.masteryIQ).map(([s, iq]) => ({ s, iq, t: schemeStarTier(iq) })).sort((a, b) => b.iq - a.iq).slice(0, 6);
    return `
    <div class="card">
      <div class="card-header"><span class="card-title">YOUR FORMATION MASTERY</span>
        <span class="muted" style="font-size:11px">calls grow it \xB7 the shelf rusts it</span></div>
      ${rows.map((r) => `
        <div class="dna-row">
          <span class="dna-axis">${escapeHtml(r.s)}</span>
          <span class="dna-pips">${r.t >= 4 ? "\u{1F48E}" : r.t ? "\u2605\u2605\u2605".slice(0, r.t) : "\u2013"}</span>
        </div>`).join("")}
    </div>`;
  })() : "";
  const dnaCard = dna ? (() => {
    var _a2;
    const all = Object.entries(DNA_AXES).map(([k, meta]) => {
      var _a3, _b2;
      const xp = ((_a3 = dna.axes) == null ? void 0 : _a3[k]) || 0;
      return { k, meta, xp, g: dnaGrade(xp), tier: dnaStarTier(xp) };
    }).sort((a, b) => b.tier - a.tier || b.xp - a.xp);
    const active = all.filter((r) => r.xp > 0);
    const expanded = (_a2 = state.ui) == null ? void 0 : _a2.dnaExpanded;
    const compact = active.slice(0, 5);
    const badgeHistory = () => {
      const bySeason = {};
      for (const b of dna.badges || []) (bySeason[b.season] = bySeason[b.season] || []).push(b);
      return Object.keys(bySeason).sort((a, b) => b - a).map((s) => `
      <div class="dna-season-group">
        <div class="dna-season-hdr">SEASON ${s}</div>
        ${bySeason[s].map((b) => `<span class="dna-chip">\u{1F3C5} ${escapeHtml(b.label)}</span>`).join("")}
      </div>`).join("");
    };
    return `
    <div class="card">
      <div class="card-header"><span class="card-title">COACH DNA</span>
        <span class="muted" style="font-size:11px">${(dna.badges || []).length} milestone${(dna.badges || []).length === 1 ? "" : "s"}</span></div>
      <div class="dna-title">${escapeHtml(dnaTitle(dna))}</div>
      ${!expanded ? compact.length ? compact.map((r) => `
        <div class="dna-row">
          <span class="dna-axis">${r.meta.icon} ${r.meta.label}</span>
          <span class="dna-pips">${r.tier ? dnaStarLabel(r.tier) : "\u2013"}</span>
        </div>`).join("") : '<p class="offseason-hint" style="margin:6px 0 0">Your identity forms from how you coach \u2014 run it, throw it, blitz it, gamble on 4th. The game is watching.</p>' : all.map((r) => `
        <div class="dna-row dna-row-full">
          <span class="dna-axis">${r.meta.icon} ${r.meta.label}</span>
          <span class="dna-grade-num">${r.tier ? dnaStarLabel(r.tier) : "\u2013"}</span>
          <span class="dna-bar"><span class="dna-bar-fill" style="width:${r.tier >= 4 ? 100 : Math.min(100, Math.round(r.xp / dnaXpForNextGrade(r.g) * 100))}%"></span></span>
          <span class="dna-xp-num">${r.tier >= 4 ? "MAX" : `${r.xp}/${dnaXpForNextGrade(r.g)}`}</span>
        </div>`).join("")}
      ${!expanded && (dna.badges || []).length ? `
      <div class="dna-shelf">
        ${dna.badges.slice(-8).reverse().map((b) => `<span class="dna-chip" title="Season ${b.season}">\u{1F3C5} ${escapeHtml(b.label)}</span>`).join("")}
      </div>` : ""}
      ${expanded && (dna.badges || []).length ? `<div class="dna-history">${badgeHistory()}</div>` : ""}
      <button class="btn-secondary dna-expand-btn" data-dna-toggle>${expanded ? "Show less" : "Full DNA record \u2192"}</button>
    </div>`;
  })() : "";
  const officeHeader = `
    <div class="card">
      <div class="card-header"><span class="card-title">COACH OFFICE</span></div>
      <div class="coach-identity">
        <div class="coach-name">${escapeHtml(name)}</div>
        <div class="coach-career muted">Career: ${wins}\u2013${losses}${titles ? ` \xB7 ${titles} title${titles > 1 ? "s" : ""}` : ""}</div>
      </div>
    </div>`;
  if (tab === "program") {
    return `
  <div class="view-coachoffice">
    ${officeHeader}

    <div class="co-zone-label">THE PROGRAM <span class="muted">\u2014 one pool pays for everything</span></div>
    ${renderHandoffCard()}
    ${ledger}
    ${facilities}
    ${renderTreePanel()}
  </div>`;
  }
  return `
  <div class="view-coachoffice">
    ${officeHeader}

    ${unemployed ? renderForcedShortlist() : `
      <div class="card">
        <div class="card-header"><span class="card-title">CAREER</span></div>
        ${renderCareerPanel(coach)}
      </div>
      ${renderOffers()}
      ${renderHandoffCard()}
    `}

    <div class="co-zone-label">THE LEGACY <span class="muted">\u2014 what you're becoming</span></div>
    <div class="card">
      <div class="card-header"><span class="card-title">STANDING &amp; TERRITORY</span>
        <span class="muted" style="font-size:11px">your name in the sport, and your home turf</span></div>
      <div class="skill-list">${skillCards}</div>
    </div>

    ${masteryCard}
    ${dnaCard}

    <div class="card">
      <div class="card-header"><span class="card-title">THIS SEASON'S AWARDS</span></div>
      ${renderSeasonAwards(coach)}
    </div>

    <details class="gp-section">
      <summary class="gp-section-hdr">MILESTONE HISTORY <span class="gp-section-sub">the full trophy case</span></summary>
      <div style="padding: 0 14px 12px">${renderMilestoneHistory()}</div>
    </details>
  </div>`;
}
var SEAT_LABEL = { safe: "SAFE", warm: "WARM SEAT", hot: "HOT SEAT" };
function renderCareerPanel(coach) {
  var _a, _b, _c;
  const school = getPlayerSchool();
  const games = C.CONF_GAMES + C.NONCONF_GAMES;
  const wins = (_b = (_a = school == null ? void 0 : school.record) == null ? void 0 : _a.wins) != null ? _b : 0;
  const exp = expectedWins(school == null ? void 0 : school.prestige, games);
  const jobSecurity = (_c = coach.jobSecurity) != null ? _c : C.JOBSEC_START;
  const seat = seatState(jobSecurity);
  return `
  <div class="career-mandate">
    <div class="career-row"><span class="muted">School</span><span>${escapeHtml((school == null ? void 0 : school.name) || "\u2014")} (${escapeHtml((school == null ? void 0 : school.division) || "?")})</span></div>
    <div class="career-row"><span class="muted">Tenure</span><span>${coach.tenureSeasons || 0} season${(coach.tenureSeasons || 0) === 1 ? "" : "s"}</span></div>
    <div class="career-row"><span class="muted">${tipTerm("expectations", "Mandate")}</span><span>${escapeHtml(mandateText(school == null ? void 0 : school.prestige, games))}</span></div>
    ${(() => {
    var _a2, _b2;
    const p = (_a2 = school == null ? void 0 : school.prestige) != null ? _a2 : 0, b = (_b2 = school == null ? void 0 : school.baseline) != null ? _b2 : p;
    const gap = p - b;
    if (Math.abs(gap) < 0.15) return "";
    const word = gap > 0.6 ? "rising fast" : gap > 0 ? "rising" : gap < -0.6 ? "fading fast" : "fading";
    const arrow = gap > 0 ? "\u2191" : "\u2193";
    return `<div class="career-row"><span class="muted">${tipTerm("prestige", "Program pedigree")}</span><span>${b.toFixed(1)}\u2605 ${arrow} <span class="muted" style="font-size:11px">${word} \u2014 sustained ${gap > 0 ? "winning is raising" : "losing is sinking"} what this program IS</span></span></div>`;
  })()}
    <div class="career-row"><span class="muted">This season</span><span>${wins} wins (expected ${exp})</span></div>
  </div>
  <div class="jobsec-meter">
    <div class="jobsec-head">
      <span class="jobsec-label">${tipTerm("job-security", "JOB SECURITY")}</span>
      <span class="jobsec-state seat-${seat}">${SEAT_LABEL[seat]}</span>
    </div>
    <div class="jobsec-bar-track"><div class="jobsec-bar-fill seat-${seat}" style="width:${Math.round(jobSecurity)}%"></div></div>
  </div>
`;
}
function renderOffers() {
  const offers = state.pendingOffers;
  if (!offers || offers.length === 0) return "";
  // [W9 \u00a712 R2] THE OFFER FORK. Decline once (the Stay button arms it), and the
  // re-offer carries a second answer: take it yourself, or send a coordinator
  // and follow him. Inert on every non-tree save (fork stays false).
  const tree = isTreeGame(state);
  const fork = tree && forkArmed(state);
  const open = tree ? new Set(openDivisions(state)) : null;
  const cands = fork ? promotionCandidates(state, { schoolId: state.playerSchoolId }) : [];
  return `
  <div class="card">
    <div class="card-header"><span class="card-title">JOB OFFERS</span></div>
    ${fork ? `<p class="offseason-hint" style="margin:0 16px 8px">You said no once. They came back \u2014 and this time you have a second answer: take it yourself, or hand it to one of your coordinators and follow him there. The man you leave behind keeps coaching; he just becomes a branch instead of you.</p>` : ""}
    <div class="skill-list">
      ${offers.map((o) => `
        <div class="skill-row offer-row">
          <div class="skill-head">
            <span class="skill-name team-link" data-scout-team="${o.schoolId}">${escapeHtml(o.schoolName)}</span>
            <span class="muted">${escapeHtml(o.division)} \xB7 ${o.prestige}\u2605</span>
          </div>
          <button class="btn-primary btn-sm accept-offer-btn" data-school-id="${o.schoolId}">Accept</button>
          ${fork && open.has(o.division) && cands.length ? `
            <div class="tree-fork">
              <div class="tree-fork-label">\u2026or send a coordinator and follow him:</div>
              ${cands.map((c) => `
                <button class="btn-ghost btn-sm tree-fork-btn" data-tree-fork-school="${escapeHtml(o.schoolId)}" data-tree-fork-side="${escapeHtml(c.side)}">
                  ${escapeHtml(c.side.toUpperCase())} ${escapeHtml(c.coord.name.first)} ${escapeHtml(c.coord.name.last)}
                  <span class="muted">\xB7 ${c.credentials.seasons} yr${c.credentials.avgUnitGrade ? ` \xB7 units ${escapeHtml(c.credentials.avgUnitGrade)}` : ""}</span>
                </button>`).join("")}
            </div>` : ""}
        </div>
      `).join("")}
    </div>
    <button class="btn-ghost btn-sm stay-btn" style="margin:8px 16px">Stay</button>
  </div>
`;
}
// ── [W9 §12 R3] THE HANDOFF CARD ───────────────────────────────────────────
// The move-up moment, on screen wherever the player might be looking when it
// matters: the coach office (both tabs) renders it here, and the dashboard —
// which is also the contract screen during the offseason — imports it, so the
// player who just signed sees it without hunting. The engine owns every rule
// (pendingHandoff self-expires; executeHandoff refuses anything illegal);
// these are just buttons.
function renderHandoffCard() {
  var _a;
  if (!isTreeGame(state)) return "";
  const h = pendingHandoff(state);
  if (!h) return "";
  const cands = handoffCandidates(state);
  const school = (_a = state.world) == null ? void 0 : _a.schools.find((s) => s.id === h.schoolId);
  const interim = school == null ? void 0 : school.coach;
  const interimName = interim && interim.name ? `${interim.name.first || ""} ${interim.name.last || ""}`.trim() : "the interim hire";
  return `
  <div class="card tree-card career-blocking">
    <div class="card-header"><span class="card-title">THE HANDOFF — ${escapeHtml((h.schoolName || "your old program").toUpperCase())}</span>
      <span class="muted" style="font-size:11px">this offseason only</span></div>
    <p class="offseason-hint" style="margin:0 16px 8px">You walked out of ${escapeHtml(h.schoolName)} to take this job. Right now — and only right now — you can hand the program to one of the coordinators you left behind: he takes your old chair, and ${escapeHtml(h.division)} becomes a branch of your tree. Pass, and ${escapeHtml(interimName)} keeps it for good.</p>
    <div class="skill-list">
      ${cands.map((c) => `
        <div class="skill-row offer-row">
          <div class="skill-head">
            <span class="skill-name">${escapeHtml(String(c.side).toUpperCase())} ${escapeHtml(c.coord.name.first)} ${escapeHtml(c.coord.name.last)}</span>
            <span class="muted">${c.credentials.seasons} yr${c.credentials.avgUnitGrade ? ` \xB7 units ${escapeHtml(c.credentials.avgUnitGrade)}` : ""}${c.credentials.streakBPlus ? ` \xB7 ${c.credentials.streakBPlus}-yr B+ streak` : ""}</span>
          </div>
          <button class="btn-primary btn-sm" data-tree-handoff-side="${escapeHtml(c.side)}">Send him down</button>
        </div>`).join("")}
    </div>
    <div style="padding:0 16px 14px">
      <button class="btn-ghost btn-sm" data-tree-handoff-decline>Pass — ${escapeHtml(interimName)} keeps the job</button>
    </div>
  </div>`;
}
// The buttons above, wired. Called from this view's setup AND the dashboard's,
// because the card renders in both places — one implementation, one rule.
function setupHandoffListeners() {
  var _a;
  document.querySelectorAll("[data-tree-handoff-side]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const res = executeHandoff(state, btn.dataset.treeHandoffSide);
      if (!res.ok) {
        notify(res.reason, "warning", 4500);
        return;
      }
      notify(`${res.name} takes over at ${res.schoolName} — your old program is a branch of the tree now. He's yours to coach whenever you want him.`, "success", 7e3);
      await saveNow();
      rerender();
    });
  });
  (_a = document.querySelector("[data-tree-handoff-decline]")) == null ? void 0 : _a.addEventListener("click", async () => {
    if (!confirm("Pass on the handoff? The interim coach keeps your old program for good — this offer doesn't come back.")) return;
    const res = declineHandoff(state);
    if (res.ok) notify(`You let ${res.schoolName} go. The interim staff keeps the program.`, "info", 5e3);
    await saveNow();
    rerender();
  });
}
// ── [W9 §12] THE TREE PANEL ────────────────────────────────────────────────
// Four things, in the order they matter: who you can BE right now (the chairs),
// who you can PROMOTE (rule 3), where you can plant downward (rule 4), and the
// harvest (T5). Retirement is deliberately last and deliberately gated — it is
// the only irreversible button on the screen.
function renderTreePanel() {
  var _a, _b, _c, _d, _e;
  if (!isTreeGame(state)) return "";
  const snap = treeSnapshot(state);
  if (!snap) return "";
  const retire = canRetire(state);
  // [DNA TREE §7] Forced retirement (the age wall, with a successor waiting)
  // opens the ceremony on arrival.
  if (state._forcedRetirement && !state.ui.ceremony) {
    const gate0 = canRetire(state);
    if (gate0.ok) {
      state.ui.ceremony = buildRetirementCeremony(state);
      state.ui.ceremonyPicks = state.ui.ceremonyPicks || [];
    } else {
      state._forcedRetirement = false;
    }
  }
  const cer = state.ui.ceremony;
  const ceremonyModal = cer ? (() => {
    const picks = state.ui.ceremonyPicks || [];
    const r = cer.record;
    return `
    <div class="modal-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:60;overflow-y:auto;padding:18px 10px">
      <div class="card" style="max-width:560px;margin:0 auto">
        <div class="card-header"><span class="card-title">THE CEREMONY</span>
          <span class="muted" style="font-size:11px">${cer.exitKind === "retire" ? "a full career, fully kept" : cer.exitKind === "quit" ? "walking away early" : "shown the door"}</span></div>

        <div class="tree-sec-hdr">THE RECORD</div>
        <p style="margin:4px 0">${escapeHtml(r.name)}${r.age != null ? `, ${r.age}` : ""} \u2014 ${r.wins}\u2013${r.losses}${r.titles ? ` \xB7 ${r.titles} title${r.titles === 1 ? "" : "s"}` : ""} \xB7 ${r.seasons} tree season${r.seasons === 1 ? "" : "s"}${r.schoolName ? ` \xB7 ${r.tenureHere} at ${escapeHtml(r.schoolName)}` : ""}</p>
        <p class="muted" style="margin:2px 0 8px;font-style:italic">"${escapeHtml(r.epitaph)}" \u2014 how the ledger will remember him</p>

        <div class="tree-sec-hdr">THE DEEDS</div>
        ${cer.deeds.length ? cer.deeds.map((d) => `<div class="dna-row"><span class="dna-axis">${d.icon} ${escapeHtml(d.label)}</span><span class="dna-pips">${d.stars}</span></div>`).join("") : '<p class="muted" style="margin:4px 0">No starred axes \u2014 the identity never finished forming.</p>'}

        <div class="tree-sec-hdr">THE GAMES</div>
        ${cer.games.length ? cer.games.map((g) => `<div class="dna-row"><span class="dna-axis">S${g.season} \xB7 ${escapeHtml(String(g.week))}</span><span class="muted" style="font-size:11px">${g.title ? escapeHtml(g.title) : "an instant classic"}</span></div>`).join("") : '<p class="muted" style="margin:4px 0">No instant classics survived him. Some careers are quiet.</p>'}

        <div class="tree-sec-hdr">THE HARVEST</div>
        <p style="margin:4px 0">The tree keeps <b>${Math.round(cer.exitShare * 100)}%</b> of a full harvest (${cer.exitKind}). Everything he learned, at that share, becomes the family's \u2014 permanently.</p>

        <div class="tree-sec-hdr">THE SUCCESSION</div>
        ${cer.succession.mentored.length ? cer.succession.mentored.map((m) => `<p style="margin:2px 0">${m.promised ? "\u2B50 " : ""}${m.side} ${escapeHtml(m.name)}${m.age != null ? `, ${m.age}` : ""}${m.ambition ? ` \xB7 ${escapeHtml(m.ambition)}` : ""}${m.promised ? " \xB7 <b>holds your word</b>" : ""} \xB7 ${m.seasons} season${m.seasons === 1 ? "" : "s"} under you</p>`).join("") : '<p class="muted" style="margin:2px 0">No coordinators on the final staff.</p>'}
        <p class="muted" style="margin:6px 0 2px">Choose up to ${cer.succession.pickMax} banked axes for the next man to inherit (each opens at \u2605\u2605 at most, at a ${Math.round(cer.succession.inheritShare * 100)}% share):</p>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin:4px 0 8px">
        ${cer.succession.bankedAxes.map((a) => `<button class="btn-ghost btn-sm${picks.indexOf(a.axis) >= 0 ? " btn-primary" : ""}" data-ceremony-pick="${a.axis}">${a.icon} ${escapeHtml(a.label)}</button>`).join("") || '<span class="muted">The tree has banked nothing yet.</span>'}
        </div>

        <div class="tree-sec-hdr">THE WORLD RESPONDS</div>
        <p style="margin:4px 0">${cer.world.qualifiesLegend ? `${escapeHtml(cer.world.schoolName || "The program")} will write him into its lore as a legend era${cer.world.qualifiesField ? ", and the field will carry his name" : ""}.` : "The tenure was too short for the program to canonize \u2014 the lore belongs to men who stayed."}</p>

        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="btn-primary" id="ceremony-confirm" style="flex:1">WALK AWAY \u2014 no undo</button>
          ${state._forcedRetirement ? "" : '<button class="btn-ghost" id="ceremony-cancel">Not yet</button>'}
        </div>
      </div>
    </div>`;
  })() : "";
  // While the move-up handoff is open, the old school is the only program a
  // coordinator can go to — the promote-here and plant-downward buttons wait
  // (the engine already blanks applyDownTargets; this hides the buttons too).
  const handoff = pendingHandoff(state);
  const promoteHere = promotionCandidates(state, { schoolId: state.playerSchoolId });
  const openDivs = snap.openDivisions;
  const school = getPlayerSchool();
  const candBySide = {};
  for (const c of promoteHere) candBySide[String(c.side).toLowerCase()] = c;
  const marketSide = state.ui.staffMarket;
  const market = marketSide ? renderStaffMarket(marketSide, school) : "";
  const coordRow = (sideLabel) => {
    const key = sideLabel.toLowerCase();
    const cand = candBySide[key];
    const coord = cand ? cand.coord : school && school.staff ? school.staff[key] : null;
    const windowOpen = coordWindowOpen();
    if (!coord) return `<div class="staff-row"><span class="muted">No ${sideLabel} on staff</span>
      <button class="btn-ghost btn-sm" data-hire-market="${sideLabel}"${windowOpen ? "" : ' title="Hire at the offseason Coordinator Hires step"'}>${windowOpen ? "Hire" : "Hire \u2014 offseason"}</button></div>`;
    ensureAmbition(coord);
    const sheet = Object.entries(coord.schemeIQ || {}).sort((a, b) => b[1] - a[1]).map(([s, iq]) => {
      const t = schemeStarTier(iq);
      return `<span class="${s === coord.specialty ? "staff-hi" : ""}">${escapeHtml(s)} ${t >= 4 ? "\u{1F48E}" : t ? "\u2605\u2605\u2605".slice(0, t) : "\u2013"} ${iq}</span>`;
    }).join(" \xB7 ");
    const cred = cand ? cand.credentials : null;
    const canPromote = !!(openDivs.length && cand && !handoff);
    return `
    <div class="staff-row">
      <div class="staff-info">
        <div class="staff-name">${sideLabel} ${escapeHtml(coord.name.first)} ${escapeHtml(coord.name.last)}
          <span class="muted" style="font-weight:400">\xB7 ${coord.age != null ? `${coord.age} yrs` : ""} \xB7 ${escapeHtml(coord.ambition || "")} \xB7 $${(coord.salary || 0).toLocaleString()}/yr</span>
          ${coord.promisedSuccession ? '<span class="staff-hi" style="font-size:11px"> \xB7 PROMISED THE SEAT</span>' : ""}</div>
        <div class="staff-ratings muted">
          ${Object.entries(coord.ratings).map(([k, v]) => `${RATING_LABELS[k] || k} <b class="${v >= 70 ? "staff-hi" : v <= 35 ? "staff-lo" : ""}">${v}</b>`).join(" \xB7 ")}</div>
        <div class="staff-schemes muted">${sheet}</div>
        ${coord.mentorName ? `<div class="staff-schemes muted">Shaped under ${escapeHtml(coord.mentorName)}</div>` : ""}
        ${cred ? `<div class="staff-schemes muted">${cred.seasons} yr${cred.avgUnitGrade ? ` \xB7 units ${escapeHtml(cred.avgUnitGrade)}` : ""}${cred.streakBPlus ? ` \xB7 ${cred.streakBPlus}-yr B+ streak` : ""}</div>` : ""}
      </div>
      <div class="staff-actions">
        <button class="btn-ghost btn-sm" data-hire-market="${sideLabel}"${windowOpen ? "" : ' title="Coordinator changes happen at the offseason Coordinator Hires step"'}>${windowOpen ? "Replace" : "Replace \u2014 offseason"}</button>
        ${canPromote ? `<button class="btn-primary btn-sm" data-tree-promote="${escapeHtml(cand.side)}">Give him this program</button>` : ""}
      </div>
    </div>`;
  };
  const downTargets = applyDownTargets(state);
  const canDown = canApplyDown(state);
  const bankedTotal = Object.values(snap.banked).reduce((s, v) => s + (v || 0), 0);
  const chairs = snap.slots.map((s) => s.empty ? `
      <div class="tree-chair tree-chair-empty">
        <div class="tree-chair-head"><span class="tree-chair-div">${s.division}</span><span class="muted">empty chair</span></div>
        <div class="muted" style="font-size:11px">${escapeHtml(divisionMemoryText(state.tree, s.division))}</div>
      </div>` : `
      <div class="tree-chair${s.active ? " tree-chair-active" : ""}">
        <div class="tree-chair-head">
          <span class="tree-chair-div">${s.division}</span>
          <span class="tree-chair-name">${escapeHtml(s.name)}</span>
          ${s.active ? '<span class="tree-chair-you">YOU</span>' : `<button class="btn-ghost btn-sm" data-tree-switch="${s.division}">Coach him</button>`}
        </div>
        <div class="muted" style="font-size:11px">
          ${escapeHtml(s.schoolName)}${s.record ? ` \xB7 ${s.record.wins}–${s.record.losses}` : ""} \xB7 ${s.seasonsWorked} season${s.seasonsWorked === 1 ? "" : "s"} \xB7 ${escapeHtml(s.title)}
          ${s.promotedFrom ? ` \xB7 promoted from ${escapeHtml(s.promotedFrom.side)} at ${escapeHtml(s.promotedFrom.schoolName)}` : ""}
        </div>
      </div>`).join("");
  return `
    ${ceremonyModal}
    <div class="card tree-card">
      <div class="card-header"><span class="card-title">THE TREE</span>
        <span class="muted" style="font-size:11px">one world \xB7 one chair per division</span></div>
      <div class="tree-chairs">${chairs}</div>

      <div class="tree-sec-hdr">COORDINATORS</div>
      <p class="offseason-hint" style="margin:0 16px 8px">Your staff — the OC's formation knowledge drives execution and pre-snap discipline; the DC's front knowledge pushes back, and his Blitz Design decides whether heavy pressure is a weapon or a liability. Salaries hit next season's pool. Replace a man from the market, or${openDivs.length ? "" : " — with an open chair in the tree —"} hand him a program and follow him.</p>
      ${coordRow("OC")}
      ${coordRow("DC")}
      ${market}
      ${openDivs.length && promoteHere.length && !handoff ? `<p class="offseason-hint" style="margin:8px 16px 10px">Promote and he takes over ${escapeHtml((school == null ? void 0 : school.name) || "your program")} and you become him. His service record walks in with him — years put in and the grade of the work become his day-one credentials, not a flat percentage. Never forced.</p>` : ""}

      ${canDown ? `
        <div class="tree-sec-hdr">PLANT ONE DOWNWARD</div>
        <p class="offseason-hint" style="margin:0 16px 8px">Branches grow down on purpose, not just up on success. Send a coordinator to an open job below you and keep coaching here — you'll be able to play him whenever you like.</p>
        <div class="skill-list">
          ${downTargets.slice(0, 4).map((o) => `
            <div class="skill-row offer-row">
              <div class="skill-head">
                <span class="skill-name team-link" data-scout-team="${escapeHtml(o.schoolId)}">${escapeHtml(o.schoolName)}</span>
                <span class="muted">${escapeHtml(o.division)} \xB7 ${o.prestige}★</span>
              </div>
              ${promoteHere.map((c) => `<button class="btn-ghost btn-sm" data-tree-down-school="${escapeHtml(o.schoolId)}" data-tree-down-side="${escapeHtml(c.side)}">Send ${escapeHtml(c.side.toUpperCase())}</button>`).join("")}
            </div>`).join("")}
        </div>
      ` : ""}

      <div class="tree-sec-hdr">THE HARVEST</div>
      <p class="offseason-hint" style="margin:0 16px 8px">
        ${bankedTotal ? `This tree has banked ${bankedTotal.toLocaleString()} XP from ${snap.ledger.length} retired coach${snap.ledger.length === 1 ? "" : "es"}. Every new coach on it starts with a share.` : "Nothing banked yet. A coach carries his own identity while he works — retiring is what gives it to the tree, for good."}
      </p>
      <div style="padding:0 16px 14px">
        <button class="btn-ghost btn-sm" id="tree-retire" ${retire.ok ? "" : "disabled"}>\u{1F396} Retire ${escapeHtml(((_b = state.playerCoach) == null ? void 0 : (_c = _b.name) == null ? void 0 : _c.first) || "")} ${escapeHtml(((_d = state.playerCoach) == null ? void 0 : (_e = _d.name) == null ? void 0 : _e.last) || "")}</button>
        ${retire.ok ? "" : `<div class="muted" style="font-size:11px;margin-top:6px">${escapeHtml(retire.reason)}</div>`}
      </div>
    </div>`;
}
function renderForcedShortlist() {
  const opts = state.forcedShortlist;
  if (!opts || opts.length === 0) return "";
  return `
  <div class="card career-blocking">
    <div class="card-header"><span class="card-title">YOU'RE OUT OF A JOB</span></div>
    <div class="muted" style="padding:0 16px 8px">You must accept a new position to continue your career.</div>
    <div class="skill-list">
      ${opts.map((o) => `
        <div class="skill-row offer-row">
          <div class="skill-head">
            <span class="skill-name team-link" data-scout-team="${o.schoolId}">${escapeHtml(o.schoolName)}</span>
            <span class="muted">${escapeHtml(o.division)} \xB7 ${o.prestige}\u2605</span>
          </div>
          <button class="btn-primary btn-sm accept-shortlist-btn" data-school-id="${o.schoolId}">Accept</button>
        </div>
      `).join("")}
    </div>
  </div>
`;
}
function renderSeasonAwards(coach) {
  const mySchoolId = state.playerSchoolId;
  const awards = (state.awardsLog || []).filter(
    (a) => a.season === state.season && a.schoolId === mySchoolId
  );
  if (awards.length === 0) return `<div class="empty-state">No awards yet this season.</div>`;
  const divisionPos = awards.filter((a) => a.scope === "all-division");
  const confPos = awards.filter((a) => a.scope === "all-conf");
  const other = awards.filter((a) => a.scope !== "all-division" && a.scope !== "all-conf");
  const posRow = (a) => `
  <div class="skill-row">
    <div class="skill-head">
      <span class="skill-name">All-${escapeHtml(a.group)} ${escapeHtml(a.position)}</span>
    </div>
    ${a.playerName ? `<div class="skill-meta muted">${escapeHtml(a.playerName)}</div>` : ""}
  </div>`;
  const otherRow = (a) => `
  <div class="skill-row">
    <div class="skill-head">
      <span class="skill-name">${AWARD_LABEL[a.category] || a.category}</span>
      ${a.scope === "weekly" ? `<span class="muted">${escapeHtml(weekLabel(a.day))}</span>` : ""}
    </div>
    ${a.playerName ? `<div class="skill-meta muted">${escapeHtml(a.playerName)}</div>` : ""}
  </div>`;
  return `
  ${divisionPos.length ? `
    <div class="award-group-label">ALL-DIVISION</div>
    <div class="skill-list">${divisionPos.map(posRow).join("")}</div>
  ` : ""}
  ${confPos.length ? `
    <div class="award-group-label">ALL-CONFERENCE <span class="muted">(${confPos.length})</span></div>
    <div class="skill-list">${confPos.map(posRow).join("")}</div>
  ` : ""}
  ${other.length ? `<div class="skill-list">${other.map(otherRow).join("")}</div>` : ""}
`;
}
function renderMilestoneHistory() {
  const history = state.coachHistory || [];
  if (history.length === 0) return `<div class="empty-state">No milestones recorded yet.</div>`;
  const tally = /* @__PURE__ */ new Map();
  const programs = [];
  let raisers = 0, finishers = 0;
  for (const h of history) {
    if (h.type === "milestone") {
      const t = tally.get(h.label) || { count: 0, lastSeason: 0 };
      t.count++;
      t.lastSeason = Math.max(t.lastSeason, h.season || 0);
      tally.set(h.label, t);
    } else if (h.type === "program") {
      programs.push(h);
    } else {
      raisers += h.raisers || 0;
      finishers += h.finishers || 0;
    }
  }
  const rows = [...tally.entries()].sort((a, b) => b[1].count - a[1].count || b[1].lastSeason - a[1].lastSeason);
  return `
  ${programs.length ? `<div class="skill-list">${programs.slice().reverse().map((h) => `
    <div class="skill-row"><div class="skill-head">
      <span class="skill-name">\u{1F3C6} ${escapeHtml(h.label)}</span>
      <span class="muted">S${h.season}</span>
    </div></div>`).join("")}</div>` : ""}
  ${rows.length ? `<div class="award-group-label" style="margin-top:8px">PLAYER MILESTONES <span class="muted">(coached)</span></div>
  <div class="skill-list">${rows.map(([label, t]) => `
    <div class="skill-row"><div class="skill-head">
      <span class="skill-name">${escapeHtml(label)} <b>\xD7${t.count}</b></span>
      <span class="muted">last S${t.lastSeason}</span>
    </div></div>`).join("")}</div>` : ""}
  ${raisers + finishers ? `<div class="skill-list" style="margin-top:6px">
    <div class="skill-row"><div class="skill-head">
      <span class="skill-name">Development: ${raisers} breakout riser${raisers !== 1 ? "s" : ""}, ${finishers} strong finisher${finishers !== 1 ? "s" : ""} (career)</span>
    </div></div></div>` : ""}`;
}
var _candidates = { side: null, list: [] };
function renderStaffMarket(side, school) {
  if (_candidates.side !== side || !_candidates.list.length) {
    _candidates = { side, list: generateCandidates(side, school, 5) };
  }
  const SHORT = {
    qbRunDesign: "QB Run",
    passGame: "Pass",
    runGame: "Run",
    blitzDesign: "Blitz Dsn",
    coverage: "Coverage",
    runFits: "Run Fits"
  };
  return `
  <div class="staff-market">
    <div class="staff-market-head">CANDIDATES \u2014 ${side} <button class="btn-ghost btn-sm" data-hire-close="1">Close</button></div>
    ${_candidates.list.map((c, i) => {
    ensureAmbition(c);
    // [Owner request Aug 2026] The full dossier at hire: every formation
    // grade (star + raw IQ), specialty called out, all ratings labeled.
    const sheet = Object.entries(c.schemeIQ || {}).sort((a, b) => b[1] - a[1]).map(([s, iq]) => {
      const t = schemeStarTier(iq);
      return `<span class="${s === c.specialty ? "staff-hi" : ""}">${escapeHtml(s)} ${t >= 4 ? "\u{1F48E}" : t ? "\u2605\u2605\u2605".slice(0, t) : "\u2013"} ${iq}</span>`;
    }).join(" \xB7 ");
    return `
      <div class="staff-row staff-cand">
        <div class="staff-info">
          <div class="staff-name">${escapeHtml(c.name.first)} ${escapeHtml(c.name.last)}
            <span class="muted" style="font-weight:400">\xB7 ${c.age != null ? `${c.age} yrs` : ""} \xB7 ${escapeHtml(c.ambition || "")} \xB7 $${c.salary.toLocaleString()}/yr</span></div>
          <div class="staff-schemes muted">${escapeHtml(deriveSchemeIdentity(c.side, c.ratings))} \xB7 Specialty: <span class="staff-hi">${escapeHtml(c.specialty || "\u2013")}</span></div>
          <div class="staff-ratings muted">${Object.entries(c.ratings).map(([k, v]) => `${SHORT[k] || k} <b class="${v >= 70 ? "staff-hi" : v <= 35 ? "staff-lo" : ""}">${v}</b>`).join(" \xB7 ")}</div>
          <div class="staff-schemes muted">${sheet}</div>
        </div>
        <button class="btn-primary btn-sm" data-hire-pick="${i}">Hire</button>
      </div>`;
  }).join("")}
  </div>`;
}
// [PLAYTEST 2026-08-12 item 24] Coordinator changes belong to ONE window: the
// offseason Coordinator Hires stage. This button used to be live any week of any
// season, which is why the offseason step never felt like a decision.
function coordWindowOpen() {
  var _a, _b;
  // An owed hire (promotion or poach) is always actionable — you can't be told
  // to fill a chair and then be locked out of filling it.
  if (state.pendingCoordHire) return true;
  const os = state.offseason;
  if (!os || os.done) return false;
  const stages = visibleStages(state);
  return ((_b = (_a = stages[os.stage]) == null ? void 0 : _a.id) != null ? _b : null) === "staff";
}
function setupListeners18() {
  var _a, _b, _c, _d, _e, _f;
  document.querySelectorAll("[data-hire-market]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!coordWindowOpen()) {
        notify("Coordinators are hired at the offseason Coordinator Hires step \u2014 not mid-season. Your staff is set until then.", "info", 5e3);
        return;
      }
      state.ui.staffMarket = btn.dataset.hireMarket;
      _candidates = { side: null, list: [] };
      rerender();
    });
  });
  (_a = document.querySelector("[data-hire-close]")) == null ? void 0 : _a.addEventListener("click", () => {
    state.ui.staffMarket = null;
    rerender();
  });
  document.querySelectorAll("[data-hire-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const school = getPlayerSchool();
      const side = state.ui.staffMarket;
      const pick2 = _candidates.list[parseInt(btn.dataset.hirePick, 10)];
      if (!school || !pick2) return;
      if (!coordWindowOpen()) {
        state.ui.staffMarket = null;
        notify("That window has closed \u2014 coordinator changes happen at Coordinator Hires.", "info");
        rerender();
        return;
      }
      if (!school.staff) school.staff = {};
      school.staff[side.toLowerCase()] = pick2;
      if (state.pendingCoordHire && school.staff.oc && school.staff.dc) state.pendingCoordHire = null;
      state.ui.staffMarket = null;
      notify(`${pick2.name.first} ${pick2.name.last} hired as ${side} \u2014 $${pick2.salary.toLocaleString()}/yr from next season's pool`, "success");
      rerender();
    });
  });
  document.querySelectorAll("[data-fac-buy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const school = getPlayerSchool();
      const res = buyFacilityUpgrade(school, state.playerCoach, btn.dataset.facBuy);
      if (res.ok) notify(`${C.FACILITIES.LABELS[btn.dataset.facBuy]} upgraded to level ${res.level} (\u2212$${res.cost.toLocaleString()})`, "success");
      else notify(res.reason, "warning");
      rerender();
    });
  });
  document.querySelectorAll(".accept-offer-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const result = acceptJob(state, btn.dataset.schoolId);
      if (result.ok) {
        const h = pendingHandoff(state);
        notify(h ? `You've accepted the job at ${result.schoolName} — and ${h.schoolName} needs a coach. This offseason only, you can send one of your old coordinators down to take it.` : `You've accepted the job at ${result.schoolName}!`, "success", h ? 7e3 : void 0);
        notifyJobMoveCosts(result);
      } else notify(result.reason, "warning");
      rerender();
    });
  });
  document.querySelectorAll(".accept-shortlist-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const result = acceptJob(state, btn.dataset.schoolId);
      if (result.ok) {
        notify(`You're the new coach at ${result.schoolName}.`, "success");
        notifyJobMoveCosts(result);
      } else notify(result.reason, "warning");
      rerender();
    });
  });
  (_b = document.querySelector("[data-dna-toggle]")) == null ? void 0 : _b.addEventListener("click", () => {
    if (!state.ui) state.ui = {};
    state.ui.dnaExpanded = !state.ui.dnaExpanded;
    rerender();
  });
  (_c = document.querySelector(".stay-btn")) == null ? void 0 : _c.addEventListener("click", () => {
    const endBefore = state.playerCoach?.contract?.endSeason;
    const n = declineOffersWithLeverage(state);
    const extended = endBefore != null && (state.playerCoach?.contract?.endSeason || 0) > endBefore;
    // [W9 \u00a712 R2] The FIRST decline is what arms the fork \u2014 the re-offer later
    // carries the send-a-coordinator branch. Inert on a non-tree save.
    if (isTreeGame(state)) noteOfferDeclined(state);
    notify(n > 0 ? `You turned down the offers \u2014 and the AD noticed. Seat +${C.OFFER_LEVERAGE_JS}, and a loyalty raise: +10% of base on next season's recruiting pool (stack ${state.playerCoach?.retentionStacks || 1}/10${(state.playerCoach?.retentionStacks || 1) >= 10 ? " \u2014 capped, double money" : ""})${extended ? ", plus a year added to your contract" : ""}. Leave for another job and every raise is forfeit.` : "You turned down the offers and stayed put.", "info", 7e3);
  });

  // \u2500\u2500 [W9 \u00a712] THE TREE BUTTONS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  setupHandoffListeners();
  document.querySelectorAll("[data-tree-switch]").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTreeSlot(btn.dataset.treeSwitch);
    });
  });
  // Rule 2 \u2014 the fork: the coordinator takes the job you were offered, and
  // your control follows him. You stay employed where you are, as a branch.
  document.querySelectorAll("[data-tree-fork-school]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const res = promoteCoordinatorToHC(state, {
        sourceSchoolId: state.playerSchoolId,
        side: btn.dataset.treeForkSide,
        targetSchoolId: btn.dataset.treeForkSchool,
        takeControl: true
      });
      if (!res.ok) {
        notify(res.reason, "warning", 4500);
        return;
      }
      state.pendingOffers = null;
      notify(res.replacedBy ? `${res.name} takes the ${res.schoolName} job. You're coaching him now \u2014 your old staff hired ${res.replacedBy.first} ${res.replacedBy.last} to replace him.` : `${res.name} takes the ${res.schoolName} job. You're coaching him now.`, "success", 7e3);
      await saveNow();
      rerender();
    });
  });
  // Rule 3 \u2014 the annual promotion: he gets the program you built, you become
  // him, and the chair you were in becomes the branch.
  document.querySelectorAll("[data-tree-promote]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const res = promoteCoordinatorToHC(state, {
        sourceSchoolId: state.playerSchoolId,
        side: btn.dataset.treePromote,
        takeControl: true
      });
      if (!res.ok) {
        notify(res.reason, "warning", 4500);
        return;
      }
      notify(res.chairOpen ? `${res.name} is the new head coach at ${res.schoolName}. You're him now \u2014 and the ${String(btn.dataset.treePromote).toUpperCase()} chair he vacated is empty. Hire his replacement before camp.` : `${res.name} is the new head coach at ${res.schoolName}. You're him now.`, "success", 7e3);
      await saveNow();
      rerender();
    });
  });
  // Rule 4 \u2014 applying down: the seed goes in, you keep your own job.
  document.querySelectorAll("[data-tree-down-school]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const res = applyDown(state, {
        schoolId: btn.dataset.treeDownSchool,
        side: btn.dataset.treeDownSide
      });
      if (!res.ok) {
        notify(res.reason, "warning", 4500);
        return;
      }
      notify(`${res.name} takes over at ${res.schoolName}. He's yours to coach whenever you want him.`, "success", 6e3);
      await saveNow();
      rerender();
    });
  });
  // T5 \u2014 the harvest, now THE CEREMONY (DNA TREE §7): one modal sequence,
  // every beat backed by an existing system, one irreversible click at the end.
  (_d = document.getElementById("tree-retire")) == null ? void 0 : _d.addEventListener("click", () => {
    const gate = canRetire(state);
    if (!gate.ok) {
      notify(gate.reason, "warning", 4500);
      return;
    }
    state.ui.ceremony = buildRetirementCeremony(state);
    state.ui.ceremonyPicks = [];
    rerender();
  });
  document.querySelectorAll("[data-ceremony-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const axis = btn.dataset.ceremonyPick;
      const picks = state.ui.ceremonyPicks || [];
      const i = picks.indexOf(axis);
      const max = state.ui.ceremony && state.ui.ceremony.succession ? state.ui.ceremony.succession.pickMax || 4 : 4;
      if (i >= 0) picks.splice(i, 1);
      else if (picks.length < max) picks.push(axis);
      else notify(`Pick at most ${max} axes \u2014 an inheritance is a choice, not a warehouse.`, "warning");
      state.ui.ceremonyPicks = picks;
      rerender();
    });
  });
  (_e = document.getElementById("ceremony-cancel")) == null ? void 0 : _e.addEventListener("click", () => {
    if (state._forcedRetirement) {
      notify("The game has decided. The only door out of this room is the one marked WALK AWAY.", "warning", 4500);
      return;
    }
    state.ui.ceremony = null;
    state.ui.ceremonyPicks = [];
    rerender();
  });
  (_f = document.getElementById("ceremony-confirm")) == null ? void 0 : _f.addEventListener("click", async () => {
    const cer = state.ui.ceremony;
    if (!cer) return;
    const res = retireActiveCoach(state);
    if (!res.ok) {
      notify(res.reason, "warning", 4500);
      return;
    }
    // The succession pick rides with the retirement: remember the chosen axes
    // so the NEXT promotion through this tree inherits exactly those.
    const t9 = ensureTree(state);
    if (t9 && Array.isArray(state.ui.ceremonyPicks) && state.ui.ceremonyPicks.length) {
      t9.successionPicks = state.ui.ceremonyPicks.slice();
    }
    state._forcedRetirement = false;
    state.ui.ceremony = null;
    state.ui.ceremonyPicks = [];
    notify(`After ${res.seasons} season${res.seasons === 1 ? "" : "s"}, he walks away from ${res.schoolName}. The tree keeps ${Math.round(res.exitShare * 100)}% of a full harvest (${res.exitKind}).`, "success", 7e3);
    await saveNow();
    rerender();
  });
}

export { renderCoachOffice, renderHandoffCard, setupHandoffListeners, setupListeners18 };
