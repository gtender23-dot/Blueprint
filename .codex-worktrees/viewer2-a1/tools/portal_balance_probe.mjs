// portal_balance_probe.mjs — transfer portal balance (Jul 2026).
// Verifies the anti-exploit levers: transfer pricing holds its bands, signings
// are capped by OPEN SCHOLARSHIPS (scaling with your program, not a flat cap),
// ROLE still dominates money, and the AI still contests bids.
// [RECAL 2026-07-30, owner-ratified] The original bands encoded the pre-rework
// economy (floor ≈ 5/3 of a scholarship, mean ≈ $5k). The shipping economy
// prices a floor transfer at ≈ 2/3 of a $3k scholarship and the average
// entrant near $3.7k; the anti-exploit structure (checks 2-11) is unchanged.
// Run: node tools/portal_balance_probe.mjs
import { generateWorld } from '../js/engine/world.js';
import { initBudget } from '../js/engine/recruiting.js';
import { C } from '../js/constants.js';
import { buildTransferPortal, aiPortalPursuits, advancePortalRound, resolvePortal,
         playerPitch, pitchCost, adjustedOffer, portalScholarshipRoom, canSchoolSign } from '../js/engine/portal.js';

let fail = 0;
const g = (n, ok, d = '') => { if (!ok) fail++; console.log(`${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`); };

// ── 1. Cost formula: floor ≈ 2/3 of a scholarship, mean ≈ $3.7k over entrants ─
const world = generateWorld();
for (const s of world.schools) if (s.coach) {
  const sen = s.roster.filter(p => p.classYear === 'SR').length;
  initBudget(s.coach, Math.max(0, C.ROSTER_SIZE - s.roster.length) + sen, 0, s, 1);
}
const minCost = pitchCost({ compositeRating: C.PORTAL_MIN_RATING });
g('a floor transfer costs ≈ 2/3 of a $3k scholarship', minCost >= 1800 && minCost <= 2200,
  `floor $${minCost} (scholarship $${C.BUDGET_PER_SCHOLARSHIP})`);

const state = { season: 1, playerSchoolId: null, playerCoach: null, world };
const portal = buildTransferPortal(state);
const costs = portal.players.map(e => pitchCost(e.player));
const meanCost = Math.round(costs.reduce((s, v) => s + v, 0) / (costs.length || 1));
const meanRating = Math.round(portal.players.reduce((s, e) => s + (e.player.compositeRating || 0), 0) / (portal.players.length || 1));
g('the AVERAGE transfer costs ≈ $3.7k', meanCost >= 3200 && meanCost <= 4300,
  `mean $${meanCost} over ${portal.players.length} entrants (mean rating ${meanRating})`);

// ── 2. Role dominates money: a start-worthy small program beats a rich burier ─
const entry = { player: { id: 'x', position: 'QB', compositeRating: 60, name: { first: 'T', last: 'X' } },
                _fromLat: 0, _fromLng: 0 };
const smallStarter = { roster: [], prestige: 1, lat: 0, lng: 0 };                 // he'd start
const richBurier = { roster: Array.from({ length: 3 }, (_, i) => ({ id: 'b' + i, position: 'QB', compositeRating: 90 })),
                     prestige: 5, lat: 0, lng: 0 };                                // he'd sit
const adjSmall = adjustedOffer(smallStarter, entry, 4000);
const adjRich  = adjustedOffer(richBurier, entry, 25000);
g('ROLE still beats money (open job > fat wallet)', adjSmall > adjRich,
  `starter@$4k=${adjSmall.toFixed(0)} vs burier@$25k=${adjRich.toFixed(0)}`);

// ── 3. Scholarship gate: signings are capped by open slots ───────────────────
function miniState(schol) {
  const me = { id: 'ME', division: 'D1', roster: [], prestige: 4, lat: 0, lng: 0, name: 'Me' };
  const mk = (i) => ({ player: { id: 'p' + i, position: 'WR', compositeRating: 58, name: { first: 'A', last: 'W' + i } },
                       fromSchoolId: 'F' + i, fromSchoolName: 'From' + i, fromDivision: 'D1', caliberTier: 2,
                       _fromLat: 0, _fromLng: 0, suitors: [], signedTo: null });
  return {
    season: 1, playerSchoolId: 'ME',
    playerCoach: { budget: 10_000_000, scholarshipsAvailable: schol },
    world: { schools: [me] },
    portal: { season: 1, round: 1, maxRounds: 3, resolved: false, players: [mk(1), mk(2), mk(3), mk(4), mk(5), mk(6)], signings: [] },
  };
}
const K = 3;
const st = miniState(K);
let okCount = 0, blockedForSlots = 0;
for (const e of st.portal.players) {
  const r = playerPitch(st, e.player.id);
  if (r.ok) okCount++;
  else if (/scholarship|slot/i.test(r.reason || '')) blockedForSlots++;
}
g('the player can enter at most (open scholarships) new races', okCount === K, `${okCount} pitched, cap ${K}`);
g('further new pitches are blocked for lack of a slot', blockedForSlots === st.portal.players.length - K,
  `${blockedForSlots} blocked`);
g('scholarship room reads 0 once every slot is committed to a race', portalScholarshipRoom(st) === 0);

// Resolve: the player leads all K (only suitor) → wins K → slots drop to 0.
resolvePortal(st, []);
const signedToMe = st.portal.players.filter(e => e.signedTo === 'ME').length;
g('the player signs exactly his open-scholarship count', signedToMe === K, `${signedToMe} signed`);
g('signing a transfer consumed a scholarship each', st.playerCoach.scholarshipsAvailable === 0,
  `${st.playerCoach.scholarshipsAvailable} left`);
g('signed transfers are on the roster, eligible now', st.world.schools[0].roster.length === K);

// A program with MORE open slots does more damage (scales, not capped).
const big = miniState(6);
for (const e of big.portal.players) playerPitch(big, e.player.id);
resolvePortal(big, []);
g('more open scholarships ⇒ a bigger haul (scales with the program)',
  big.portal.players.filter(e => e.signedTo === 'ME').length === 6);

// ── 4. AI still contests: the player can't sweep the board for free ──────────
const st2 = { season: 1, playerSchoolId: world.schools[0].id, playerCoach: world.schools[0].coach, world };
world.schools[0].coach.scholarshipsAvailable = 25;
const portal2 = buildTransferPortal(st2);
aiPortalPursuits(st2);
const reachable = portal2.players.filter(e => canSchoolSign(world.schools[0], e.player));
// player pitches on only 2 targets; the rest of the board is the AI's to fight over
let pitched = 0;
for (const e of reachable) { if (pitched >= 2) break; if (playerPitch(st2, e.player.id).ok) pitched++; }
for (let r = 0; r < 3; r++) advancePortalRound(st2, []);
resolvePortal(st2, []);
const aiSigned = portal2.players.filter(e => e.signedTo && e.signedTo !== st2.playerSchoolId).length;
g('the AI signs its own transfers (bidding war is real)', aiSigned > 0, `${aiSigned} to AI schools`);

console.log(fail ? `\n❌ ${fail} PORTAL BALANCE PROBE FAILURES` : `\n✅ PORTAL BALANCE PROBE PASS`);
process.exit(fail ? 1 : 0);
