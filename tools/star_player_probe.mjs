// star_player_probe — Team Editor phase 2 (authored star players).
// Proves coinStarPlayer builds calibrated players (Solid < Star < Superstar by
// composite), honors position/class/name, and that applyTeamStars drops a named
// star onto a real roster as the STARTER at its spot without changing the roster
// size (it swaps out the weakest body there).
import { coinStarPlayer, applyTeamStars, generateExhibitionTeam, STAR_CALIBER } from '../js/engine/world.js';

let pass = 0, fail = 0; const bad = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; bad.push(msg); } }

// ── calibers are ordered ─────────────────────────────────────────────────────
function meanOvr(caliber, n = 40) {
  let s = 0; for (let i = 0; i < n; i++) s += coinStarPlayer({ position: 'QB', classYear: 'JR', caliber }).compositeRating;
  return s / n;
}
const solid = meanOvr('solid'), star = meanOvr('star'), sup = meanOvr('superstar');
ok(solid < star && star < sup, `calibers ordered: solid ${solid.toFixed(1)} < star ${star.toFixed(1)} < superstar ${sup.toFixed(1)}`);
ok(sup >= 88, `superstar is genuinely elite (${sup.toFixed(1)})`);
ok(Object.keys(STAR_CALIBER).length === 3, 'three calibers exported');

// ── identity honored ─────────────────────────────────────────────────────────
const p = coinStarPlayer({ position: 'WR', classYear: 'SR', caliber: 'star', name: 'Flash Gordon' });
ok(p.position === 'WR' && p.classYear === 'SR' && p.name === 'Flash Gordon', 'position / class / name honored');
const bad1 = coinStarPlayer({ position: 'XYZ', name: 'Fallback' });
ok(bad1.position === 'QB', 'unknown position falls back to QB (never crashes)');

// ── applyTeamStars drops the star onto a real roster as the starter ──────────
const team = generateExhibitionTeam('D1', 5);
const before = team.roster.length;
const beforeQBs = team.roster.filter((x) => x.position === 'QB').length;
applyTeamStars(team, [
  { position: 'QB', classYear: 'JR', caliber: 'superstar', name: 'Johnny Legend' },
  { position: 'DE', classYear: 'SR', caliber: 'star', name: 'Edge Master' }
]);
ok(team.roster.length === before, `roster size unchanged (${team.roster.length})`);
ok(team.roster.filter((x) => x.position === 'QB').length === beforeQBs, 'QB count unchanged (swap, not add)');
const qbTop = team.roster.filter((x) => x.position === 'QB').sort((a, b) => b.compositeRating - a.compositeRating)[0];
ok(qbTop.name === 'Johnny Legend', 'authored QB is the top QB on the roster');
const deTop = team.roster.filter((x) => x.position === 'DE').sort((a, b) => b.compositeRating - a.compositeRating)[0];
ok(deTop.name === 'Edge Master', 'authored DE is the top DE on the roster');
ok(team.depthChart && Object.keys(team.depthChart).length > 0, 'depth chart rebuilt after applying stars');

// ── no stars / bad input is a no-op ──────────────────────────────────────────
const team2 = generateExhibitionTeam('D2', 3);
const n2 = team2.roster.length;
applyTeamStars(team2, []);
applyTeamStars(team2, null);
ok(team2.roster.length === n2, 'empty / null stars is a safe no-op');

console.log(`STAR PLAYER PROBE — ${pass} pass, ${fail} fail`);
if (fail) { console.log('  FAILURES:'); bad.slice(0, 20).forEach((m) => console.log('   -', m)); }
console.log(fail ? 'STAR PLAYER PROBE FAIL' : 'STAR PLAYER PROBE PASS');
process.exit(fail ? 1 : 0);
