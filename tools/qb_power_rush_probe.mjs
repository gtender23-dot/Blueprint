// qb_power_rush_probe.mjs — does a QB's PWR/STR actually do anything when he runs?
//
// The question this answers: the contest tables say trucking a tackler is
// tackleTruck { PWR 0.55, STR 0.27, TEC 0.18 } and contact yards are
// fallForward { PWR 0.85, TEC 0.15 }. A QB carrier goes through the same
// runOutcome → breaksTackle path as a running back, so on paper his power should
// matter. But no QB role in ROLE_WEIGHTS carries any PWR at all, so it's worth
// confirming empirically rather than reading the tables and assuming.
//
// Method: identical rosters and identical QBs except for a controlled edit to PWR
// and STR only — SPD, AGI, TEC, AWR and every other attribute are held fixed, so
// any difference in rushing output is attributable to power alone. Designed QB runs
// are turned ON (qbRunPct) so the sample isn't just scrambles.
//
// SAMPLE SIZE MATTERS HERE. At 50 games/cell (~1000 carries) roster variance swamps the
// effect and the result comes out non-monotonic (4.73 / 4.40 / 5.02 across 25/55/90). At
// 90 games (~1800 carries) it resolves cleanly. Don't read a run below ~90.
//
// Usage: node tools/qb_power_rush_probe.mjs [gamesPerCell]   — use 90 or more

import { createPlayer, refreshRatings } from '../js/engine/player.js';
import { buildDepthChart }              from '../js/engine/world.js';
import { simulateGame }                 from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS }  from '../js/constants.js';

const TIER = 3;                                    // D1
const GAMES = Number(process.argv[2] || 60);

// One QB prototype per run, cloned into every cell so the only difference is the
// power edit. Everything else about the roster is regenerated identically per game.
let EDITED_QB_ID = null;   // set per roster build so the harness can pin him as QB1

function roster(schoolId, qbEdit) {
  const r = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) {
      const p = createPlayer(pos, CLASS_YEARS[i % 4], TIER);
      if (pos === 'QB' && i === 0) {
        // Lift the starter so he takes the snaps, then apply the power edit.
        for (const k of Object.keys(p.attributes)) p.attributes[k] = Math.min(99, p.attributes[k] + 15);
        qbEdit(p.attributes);
        refreshRatings(p);
        EDITED_QB_ID = p.id;
      }
      p.schoolId = schoolId;
      r.push(p);
    }
  }
  return r;
}

const CELLS = {
  'PWR/STR 25': a => { a.PWR = 25; a.STR = 25; },
  'PWR/STR 55': a => { a.PWR = 55; a.STR = 55; },
  'PWR/STR 90': a => { a.PWR = 90; a.STR = 90; },
  'PWR 90 only': a => { a.PWR = 90; a.STR = 25; },
  'STR 90 only': a => { a.PWR = 25; a.STR = 90; },
};

const sH = { id: 'H', name: 'Home' }, sA = { id: 'A', name: 'Away' };
// Designed QB runs on, so the sample covers keepers and not only scrambles.
const gpRun = { offFormation: 'Pistol/RPO', offFormations: [{ id: 'Pistol/RPO', weight: 100 }],
  tendency: 'Run-Heavy', rushInPct: 70, passDepth: { short: 50, medium: 35, deep: 15 },
  blitzPct: 20, defFormation: 'Balanced D', fourthDown: 'Moderate', clockMgmt: 'Normal',
  maxFGDist: 42, qbRunPct: 45 };
const gpD = { offFormation: 'Pro-Set', tendency: 'Balanced', rushInPct: 60,
  passDepth: { short: 40, medium: 40, deep: 20 }, blitzPct: 20, defFormation: 'Balanced D',
  fourthDown: 'Moderate', clockMgmt: 'Normal', maxFGDist: 42 };

console.log(`QB rushing vs power — ${GAMES} games per cell, D1, designed QB runs on`);
console.log('SPD/AGI/TEC/AWR identical across cells; only PWR and STR change\n');
console.log('cell             att/g   yds/g   yds/att   TD/g   stuffed%   10+%');

const rows = [];
for (const [label, edit] of Object.entries(CELLS)) {
  let att = 0, yds = 0, tds = 0, stuffed = 0, chunk = 0;
  for (let g = 0; g < GAMES; g++) {
    const rH = roster('H', edit);
    const editedId = EDITED_QB_ID;
    const rA = roster('A', a => { a.PWR = 55; a.STR = 55; });
    const dH = buildDepthChart(rH, gpRun);
    // PIN the edited QB as the starter. PWR+STR are 26% of a QB's overall, so the
    // weak cells drop his rating far enough that the depth chart benches him — which
    // would silently measure an unedited backup and invert the whole comparison.
    dH.QB = [editedId, ...(dH.QB || []).filter(id => id !== editedId)];
    const qbId = editedId;
    const res = simulateGame(sH, sA, rH, rA, dH, buildDepthChart(rA, gpD), gpRun, gpD);
    for (const d of res.drives || []) for (const pl of d.plays || []) {
      const isQBCarry = pl.rusherId === qbId && (pl.type === 'run_scramble' || (pl.type || '').startsWith('run'));
      if (!isQBCarry) continue;
      att++; yds += pl.yards || 0;
      if (pl.touchdown) tds++;
      if ((pl.yards || 0) <= 0) stuffed++;
      if ((pl.yards || 0) >= 10) chunk++;
    }
  }
  rows.push({ label, att: att / GAMES, yds: yds / GAMES, ypc: att ? yds / att : 0,
              td: tds / GAMES, stuff: att ? (stuffed / att) * 100 : 0, chunk: att ? (chunk / att) * 100 : 0 });
  const r = rows[rows.length - 1];
  console.log(`${label.padEnd(15)}${r.att.toFixed(1).padStart(6)}${r.yds.toFixed(1).padStart(8)}` +
              `${r.ypc.toFixed(2).padStart(10)}${r.td.toFixed(2).padStart(7)}${r.stuff.toFixed(1).padStart(11)}%${r.chunk.toFixed(1).padStart(7)}%`);
}

const lo = rows.find(r => r.label === 'PWR/STR 25'), hi = rows.find(r => r.label === 'PWR/STR 90');
const d = hi.ypc - lo.ypc;
console.log(`\nyards/carry, weakest to strongest: ${lo.ypc.toFixed(2)} → ${hi.ypc.toFixed(2)}  (${d >= 0 ? '+' : ''}${d.toFixed(2)})`);
console.log(d > 0.25
  ? 'VERDICT: power moves QB rushing — the carrier path reads PWR/STR as designed.'
  : 'VERDICT: power barely moves QB rushing — investigate the carrier path.');
