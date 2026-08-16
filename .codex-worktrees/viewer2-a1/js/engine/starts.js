import { C } from '../constants.js';

function randInt4(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}
function findStartProgram(world, startId, division) {
  const pool = world.schools.filter((s) => s.division === division && s.lore);
  if (!pool.length) return null;
  if (startId === "ashes") {
    const now = 2026;
    const hits = pool.map((s2) => ({ s: s2, ev: s2.lore.events.find((e) => e.kind === "scandal") })).filter((x) => x.ev && now - x.ev.year <= 10 && x.s.prestige >= 2).sort((a, b) => b.ev.year - a.ev.year || b.s.prestige - a.s.prestige);
    if (!hits.length) {
      const wide = pool.map((s3) => ({ s: s3, ev: s3.lore.events.find((e) => e.kind === "scandal") })).filter((x) => x.ev && now - x.ev.year <= 20 && x.s.prestige >= 1.5).sort((a, b) => b.ev.year - a.ev.year);
      if (!wide.length) return null;
      const { s: s2, ev: ev2 } = wide[randInt4(0, Math.min(3, wide.length - 1))];
      return { school: s2, why: `${ev2.year}: ${ev2.text}` };
    }
    const { s, ev } = hits[randInt4(0, Math.min(4, hits.length - 1))];
    return { school: s, why: `${ev.year}: ${ev.text}` };
  }
  if (startId === "fallen") return null;
  if (startId === "hotseat") {
    const now = 2026;
    const hits = pool.map((s2) => {
      const last2 = s2.lore.confTitles.length ? s2.lore.confTitles[s2.lore.confTitles.length - 1] : null;
      const hardware = s2.lore.titles.length * 3 + s2.lore.confTitles.length;
      const drought = last2 ? now - last2 : 99;
      return { s: s2, last: last2, score: hardware * Math.min(drought, 40) };
    }).filter((x) => x.last && x.score > 0 && now - x.last >= 12 && x.s.prestige >= 2).sort((a, b) => b.score - a.score);
    if (!hits.length) return null;
    const { s, last } = hits[randInt4(0, Math.min(4, hits.length - 1))];
    const t = s.lore.titles.length;
    return {
      school: s,
      why: t ? `National champions ${s.lore.titles.join(", ")}. Last conference title: ${last}. Nothing since.` : `${s.lore.confTitles.length} conference titles, the last one in ${last}. The banners are still up.`
    };
  }
  if (startId === "heir") {
    const now = 2026;
    const hits = pool.map((s2) => ({ s: s2, L: s2.lore.legend })).filter((x) => x.L && now - x.L.to <= 3 && x.s.prestige >= 3).sort((a, b) => b.L.wins - a.L.wins);
    if (!hits.length) {
      const wide = pool.map((s3) => ({ s: s3, L: s3.lore.legend })).filter((x) => x.L && now - x.L.to <= 12 && x.s.prestige >= 3).sort((a, b) => b.L.wins - a.L.wins);
      if (!wide.length) return null;
      const { s: s2, L: L2 } = wide[randInt4(0, Math.min(3, wide.length - 1))];
      return { school: s2, why: `${L2.name} went ${L2.wins}\u2013${L2.losses} here (${L2.from}\u2013${L2.to}). ${L2.note}. You follow that.` };
    }
    const { s, L } = hits[randInt4(0, Math.min(3, hits.length - 1))];
    return { school: s, why: `${L.name} just retired: ${L.wins}\u2013${L.losses} from ${L.from} to ${L.to}. ${L.note}. Good luck.` };
  }
  return null;
}
function applyStart(state2, school, startId, pick2) {
  var _a, _b, _c;
  const coach = state2.playerCoach;
  if (!coach) return;
  const L = school.lore;
  coach.start = { id: startId, why: (pick2 == null ? void 0 : pick2.why) || null, appliedSeason: state2.season };
  if (startId === "ashes") {
    coach.penalty = {
      kind: "probation",
      scholarshipCap: C.ASHES_SCHOLARSHIP_CAP,
      untilSeason: state2.season + C.ASHES_PROBATION_YEARS,
      reason: (pick2 == null ? void 0 : pick2.why) || "league sanctions"
    };
    coach.jobSecurity = C.ASHES_JOBSEC_START;
    coach.startLeash = { untilSeason: state2.season + C.ASHES_PROBATION_YEARS };
  }
  if (startId === "hotseat") {
    coach.jobSecurity = C.HOTSEAT_JOBSEC_START;
    const hardware = (((_a = L == null ? void 0 : L.titles) == null ? void 0 : _a.length) || 0) * 3 + (((_b = L == null ? void 0 : L.confTitles) == null ? void 0 : _b.length) || 0);
    coach.expectationBonus = Math.min(C.HOTSEAT_EXPECT_MAX, hardware * C.HOTSEAT_EXPECT_PER_TROPHY);
  }
  if (startId === "heir") {
    const Lg = L == null ? void 0 : L.legend;
    if (Lg) {
      const pct = Lg.wins / Math.max(1, Lg.wins + Lg.losses);
      coach.ghost = {
        name: Lg.name,
        winPct: pct,
        record: `${Lg.wins}\u2013${Lg.losses}`,
        era: `${Lg.from}\u2013${Lg.to}`
      };
    }
    for (const side of ["oc", "dc"]) {
      const c = (_c = school.staff) == null ? void 0 : _c[side];
      if (c) {
        c.salary = Math.round(c.salary * C.HEIR_STAFF_PREMIUM);
        c.locked = { untilSeason: state2.season + 1, why: `${(Lg == null ? void 0 : Lg.name) || "The legend"}'s man` };
      }
    }
    coach.jobSecurity = C.HEIR_JOBSEC_START;
  }
}
function activeScholarshipCap(coach, season) {
  const p = coach == null ? void 0 : coach.penalty;
  if (!p || p.kind !== "probation") return null;
  if (season >= p.untilSeason) return null;
  return p.scholarshipCap;
}
function onStartLeash(coach, season) {
  return !!((coach == null ? void 0 : coach.startLeash) && season < coach.startLeash.untilSeason);
}

export { activeScholarshipCap, applyStart, findStartProgram, onStartLeash };
