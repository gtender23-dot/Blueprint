// handoff_probe.mjs — W9 §12 R3, the MOVE-UP HANDOFF moment itself.
//
// The owner's report (2026-08-08): "the team handoff when you accept a job in
// the next division doesn't work as intended. When you accept the job and move
// to the new division you should only be able to send a coordinator down to
// your old school right away." His rulings, asked and answered:
//   • the candidates are the staff you LEFT BEHIND at the old school,
//   • the window is THAT OFFSEASON ONLY,
//   • while it is open, the old school is the ONLY downward target.
//
// So the assertions below are those three sentences, plus the edges that would
// quietly break them:
//   H1  Accepting a move into another division ARMS the window, aimed at the
//       old school, with the old school's own OC/DC as the only candidates.
//   H2  While the window is open, the general plant-downward board is empty
//       and the promote-here path stays engine-refused — old school ONLY.
//   H3  Taking it seats the coordinator as HC of the old school (replacing the
//       interim AI hire), grows a branch, does NOT move control, and spends
//       the offseason's one coordinator placement.
//   H4  The window is that offseason only: the season tick closes it, and a
//       stale season on a reloaded save self-expires.
//   H5  Passing on it closes it for good; the interim coach keeps the program;
//       the general board comes back (declining spends nothing).
//   H6  A FIRED coach taking the shortlist arms nothing; a move INSIDE the
//       same division arms nothing; a non-tree save is untouched.
//
// Run: node tools/handoff_probe.mjs
const _ls = new Map();
global.localStorage = {
  getItem: (k) => (_ls.has(k) ? _ls.get(k) : null),
  setItem: (k, v) => _ls.set(k, String(v)),
  removeItem: (k) => _ls.delete(k),
};

const T = await import('../js/engine/tree.js');
const CP = await import('../js/engine/coachprofile.js');
const { C } = await import('../js/constants.js');
const { acceptJob } = await import('../js/engine/season.js');

let pass = 0, fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${msg}`); ok ? pass++ : fail++; };
const hdr = (s) => console.log(`\n${s}`);

// ── The same tiny world tree_probe uses, plus a second D3 school so the
// "other downward jobs" half of the exclusivity rule has something to hide. ──
let coordSeq = 0;
function mkCoord(side, quality = 60, seasons = 4, letter = 'B+') {
  coordSeq++;
  const keys = side === 'OC' ? ['qbRunDesign', 'passGame', 'runGame'] : ['blitzDesign', 'coverage', 'runFits'];
  const ratings = {};
  for (const k of keys) ratings[k] = quality;
  const units = side === 'OC' ? ['QB', 'RB', 'REC', 'OL'] : ['DL', 'LB', 'DB'];
  const ledger = [];
  for (let s = 1; s <= seasons; s++) {
    const row = { season: s, units: {} };
    for (const u of units) row.units[u] = letter;
    ledger.push(row);
  }
  return {
    id: `coord${coordSeq}`, side, ratings, schemeIQ: {}, specialty: null, seasons, ledger,
    name: { first: side === 'OC' ? 'Otis' : 'Dex', last: `Case${coordSeq}` },
    character: { grind: 50, coachability: 50, leadership: 50 },
  };
}
function mkSchool(id, name, division, prestige = 3) {
  return {
    id, name, division, prestige, conf: 'CONF', state: 'TX',
    roster: [], record: { wins: 0, losses: 0, confWins: 0, confLosses: 0 },
    recentWins: [], facilities: {}, staff: { oc: mkCoord('OC'), dc: mkCoord('DC') },
    coach: null,
  };
}
function mkPlayerCoach(id, schoolId) {
  return {
    id, name: { first: 'Trunk', last: 'Coach' }, isAI: false, schoolId,
    skills: null, status: 'employed', jobSecurity: 60, tenureSeasons: 0,
    careerWins: 0, careerLosses: 0, titles: 0, recruitBoard: [], scouted: {},
    seasonRecord: { wins: 0, losses: 0 },
  };
}
function mkState({ season = 5, day = 26 } = {}) {
  const schools = [
    mkSchool('d3', 'Bottom State', 'D3', 2),
    mkSchool('d2', 'Middle A&M', 'D2', 3),
    mkSchool('d1', 'Top University', 'D1', 5),
    mkSchool('d3b', 'Bayou Tech', 'D3', 2),
  ];
  const st = {
    season, day, world: { schools, recruits: [] }, schedule: [],
    playerSchoolId: 'd3', playerCoach: null, inbox: [], coachHistory: [],
    rivalry: null, jobOpenings: [], settings: {},
  };
  st.playerCoach = mkPlayerCoach('player-trunk', 'd3');
  schools[0].coach = st.playerCoach;
  return st;
}
function plant(st, name = 'Handoff Tree') {
  localStorage.removeItem('cfb-trees-v1');
  localStorage.removeItem('cfb-coaches-v1');
  const rec = CP.createTree(name);
  const prof = CP.createCoach('Trunk', 'Coach', { treeId: rec.id });
  st._coachId = prof.id;
  T.foundTree(st, { treeId: rec.id, coachId: prof.id });
  return { rec, prof };
}
// The move the bug report describes: the D3 trunk accepts the D2 job.
function moveUp(st) {
  st.jobOpenings = [
    { schoolId: 'd3b', schoolName: 'Bayou Tech', division: 'D3', prestige: 2, pull: 12, status: 'open' },
  ];
  return acceptJob(st, 'd2');
}

// ══ H1 — accepting the move up arms the window, aimed at the old school ═════
hdr('H1 — accept the job, and the handoff is there RIGHT AWAY, aimed home');
{
  const st = mkState();
  plant(st);
  const oldOc = st.world.schools[0].staff.oc, oldDc = st.world.schools[0].staff.dc;
  const res = moveUp(st);
  check(res.ok, `the trunk takes the ${res.schoolName} job`);
  check(st.tree.active === 'D2' && st.playerSchoolId === 'd2', 'the slot re-keyed with him (R3 as before)');
  const interim = st.world.schools[0].coach;
  check(!!interim && interim.isAI === true, 'an interim AI coach holds the old chair meanwhile — no program goes coachless');
  const h = T.pendingHandoff(st);
  check(!!h && h.schoolId === 'd3' && h.division === 'D3' && h.season === st.season,
    'the handoff window is OPEN, aimed at the school he walked out of, stamped with this season');
  const cands = T.handoffCandidates(st);
  check(cands.length === 2 && cands.every(c => c.schoolId === 'd3'),
    'the candidates come from the OLD school and nowhere else');
  check(cands.some(c => c.coord.id === oldOc.id) && cands.some(c => c.coord.id === oldDc.id),
    'and they are the exact OC and DC he left behind — his former coordinators, not the staff he just met');
}

// ══ H2 — while it is open, the old school is the ONLY downward move ═════════
hdr('H2 — the window open, every other downward door is shut');
{
  const st = mkState();
  plant(st);
  moveUp(st);
  check((st.jobOpenings || []).some(o => o.schoolId === 'd3b' && o.division === 'D3'),
    'a D3 job at another school IS sitting open on the board');
  check(T.applyDownTargets(st).length === 0,
    'yet the plant-downward board reads EMPTY — the old school is the only program a coordinator can go to right now');
  check(T.canApplyDown(st) === false, 'so the general placement path is closed while the handoff waits');
  const elsewhere = T.applyDown(st, { schoolId: 'd3b', side: 'oc' });
  check(!elsewhere.ok, `and forcing it through the engine is refused anyway: "${elsewhere.reason}"`);
}

// ══ H3 — taking it: he gets the program, you keep your new job ══════════════
hdr('H3 — send him down: the old program becomes a branch, control stays put');
{
  const st = mkState({ season: 6 });
  plant(st);
  moveUp(st);
  const interim = st.world.schools[0].coach;
  const sentOcId = st.world.schools[0].staff.oc.id;
  const res = T.executeHandoff(st, 'oc');
  check(res.ok && res.division === 'D3' && res.schoolName === 'Bottom State',
    `${res.name} takes over the program he helped run`);
  const newHC = st.world.schools[0].coach;
  check(newHC !== interim && newHC.isAI === false && newHC.promotedFrom?.side === 'OC',
    'the interim AI hire is replaced by the promoted OC — a real coach with his service record');
  check(st.tree.active === 'D2' && st.playerSchoolId === 'd2',
    'CONTROL STAYS with the job you just took — he is a branch, not a swap');
  check(T.liveSlots(st).length === 2 && st.tree.slots.D3 && !st.tree.slots.D3.retired,
    'the tree grew: D3 is his chair now');
  check(T.pendingHandoff(st) === null, 'the window closed the moment it was used');
  check(st.tree.fork.appliedDownSeason === st.season && T.canApplyDown(st) === false,
    'and it WAS the offseason\'s one coordinator placement — the general board cannot be double-dipped after it');
  check(st.world.schools[0].staff.oc.id !== sentOcId,
    'the old school backfilled his coordinator seat — the promotion still costs the staff the man');
}

// ══ H4 — that offseason only ═══════════════════════════════════════════════
hdr('H4 — the window is the offseason you moved, and not one day more');
{
  const st = mkState({ season: 7 });
  plant(st);
  moveUp(st);
  check(!!T.pendingHandoff(st), 'open the offseason he moves...');
  T.treeSeasonTick(st);
  check(T.pendingHandoff(st) === null, '...and the season tick closes it for good');
  check(T.executeHandoff(st, 'oc').ok === false, 'a late click is refused, not honored');

  const st2 = mkState({ season: 7 });
  plant(st2);
  moveUp(st2);
  st2.season = 8; // a save reloaded after the year turned, tick or no tick
  check(T.pendingHandoff(st2) === null, 'a stale window on a reloaded save self-expires on the season check');
}

// ══ H5 — passing on it ═════════════════════════════════════════════════════
hdr('H5 — pass, and the interim coach keeps the program for good');
{
  const st = mkState({ season: 8 });
  plant(st);
  moveUp(st);
  const interim = st.world.schools[0].coach;
  const res = T.declineHandoff(st);
  check(res.ok && res.schoolName === 'Bottom State', 'declining names what you let go');
  check(T.pendingHandoff(st) === null && T.executeHandoff(st, 'oc').ok === false,
    'the moment is gone — the offer does not come back');
  check(st.world.schools[0].coach === interim, 'the interim hire keeps the job');
  check(T.applyDownTargets(st).length === 1 && T.applyDownTargets(st)[0].schoolId === 'd3b',
    'the general downward board returns once the window is settled');
  check(T.canApplyDown(st) === true, 'declining spent NOTHING — the offseason placement is still yours');
}

// ══ H6 — the edges that must stay inert ════════════════════════════════════
hdr('H6 — fired men, sideways moves and non-tree saves arm nothing');
{
  // Fired: the old chair was already stripped before the shortlist.
  const st = mkState();
  plant(st);
  st.world.schools[0].coach = null;
  st.playerCoach.status = 'unemployed';
  acceptJob(st, 'd2');
  check(T.pendingHandoff(st) === null,
    'a FIRED coach taking the shortlist gets no handoff — that chair was never his to hand over');

  // Sideways: the division never opened, so there is nothing to send anyone to.
  const st2 = mkState();
  plant(st2);
  acceptJob(st2, 'd3b');
  check(st2.tree.active === 'D3' && T.pendingHandoff(st2) === null,
    'a move INSIDE the division arms nothing — the tree still holds D3, so no chair opened (T2)');

  // Non-tree: the whole feature is invisible.
  const st3 = mkState();
  const res3 = acceptJob(st3, 'd2');
  check(res3.ok && T.pendingHandoff(st3) === null && T.handoffCandidates(st3).length === 0,
    'a save with no tree accepts jobs exactly as before — W9 still costs a legacy career nothing');
}

console.log(`\n${fail ? `${fail} FAILED, ` : ''}${pass}/${pass + fail} — ${fail ? 'the handoff does not hold.' : 'the handoff holds: armed right away, aimed only home, spent or lost in one offseason.'}`);
process.exit(fail ? 1 : 0);
