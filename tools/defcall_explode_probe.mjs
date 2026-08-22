// defcall_explode_probe.mjs — DOES TAPPING A CARD SEND THAT CARD?
//
// 2026-08-22, owner-reported: "why can i send different heat than the play
// shows." On the live defensive headset, tapping a named call does not send it
// — it copies the call into the per-snap dial pins, and those pins are what the
// snap is built from. So the copy has to be LOSSLESS. It was not: it was a
// hand-kept list of fourteen field names, and it had forgotten `bringSeats`.
//
// Measured at the time this probe was written: 29 of the 71 calls in the six
// shipped defensive books carry extra rushers, and every one of them drew five
// or six men coming on its card and sent a base four at the snap.
//
// The explode now copies the whole call and lives in js/ui/defcallpins.js, with
// no DOM, precisely so this probe can run it. Checks, per shipped call:
//   A. every field the stored call carries survives the round trip;
//   B. the BOX is converted correctly — a card's runCommit is absolute, the
//      panel's chip is a shove relative to the standing plan, and dc-send adds
//      the standing plan back, so explode-then-send must return the original;
//   C. the rush count the CARD draws equals the rush count the PINS carry —
//      the exact disagreement the owner saw;
//   D. the edited-test agrees with itself (a fresh explode is never "edited").
//
// Run from repo root: node tools/defcall_explode_probe.mjs
import { DEFAULT_DEF_BOOKS } from '../js/engine/defaultbooks.js';
import { applyDefBookToGameplan, DEF_CALL_BRING } from '../js/engine/defbook.js';
import { _dcExplode, _dcSameSel } from '../js/ui/defcallpins.js';

let pass = 0, fail = 0;
const bad = [];
const ok = (c, m) => { if (c) pass++; else { fail++; bad.push(m); } };

// the same reading the card art uses (app.js _dcBringOf)
const bringOfCall = (c) => c.rush3 ? '3' : c.bringSeats === 2 ? '6' : c.bringSeats === 1 ? '5' : '4';
const bringOfPins = (s) => s.rush3 ? '3' : Number(s.bringSeats) === 2 ? '6' : Number(s.bringSeats) === 1 ? '5' : '4';

const STANDING_RC = [0, 5, -5, 12];        // a few plausible standing boxes
let calls = 0, withSeats = 0;

for (const bk of DEFAULT_DEF_BOOKS) {
  const gp = applyDefBookToGameplan(bk, {});
  for (const [nm, call] of Object.entries(gp.defCalls || {})) {
    calls++;
    if ((call.bringSeats || 0) >= 1) withSeats++;
    for (const rc of STANDING_RC) {
      const sel = _dcExplode(call, rc);
      const where = `${bk.name}/${nm} (standing box ${rc})`;

      // A. nothing dropped
      const lost = Object.keys(call).filter((k) => {
        const v = call[k];
        if (v == null || v === 'auto') return false;
        return sel[k] === undefined;
      });
      ok(lost.length === 0, `${where}: explode DROPPED ${lost.join(', ')}`);

      // B. the box round-trips through dc-send's re-add
      if (call.runCommit != null) {
        const sent = rc + parseInt(sel.runCommit, 10);
        ok(sent === call.runCommit, `${where}: box ${call.runCommit} -> pin ${sel.runCommit} -> sent ${sent}`);
      }

      // C. the card's rush count and the pins' rush count are the same number
      ok(bringOfCall(call) === bringOfPins(sel),
        `${where}: card draws ${DEF_CALL_BRING[bringOfCall(call)]?.label} but the pins send ${DEF_CALL_BRING[bringOfPins(sel)]?.label}`);

      // D. a fresh explode never reads as "edited"
      ok(_dcSameSel(sel, _dcExplode(call, rc)), `${where}: explode is not stable`);
    }
  }
}

console.log(`=== DEFCALL EXPLODE — ${calls} shipped calls x ${STANDING_RC.length} standing boxes ===`);
console.log(`    ${withSeats} of them bring extra rushers (the ones the old field list silently flattened)`);
console.log(`\n${pass} pass, ${fail} fail`);
if (fail) { console.log('  FAILURES:'); bad.slice(0, 20).forEach((m) => console.log('   -', m)); }
console.log(fail ? 'DEFCALL EXPLODE PROBE FAIL' : 'DEFCALL EXPLODE PROBE PASS');
process.exit(fail ? 1 : 0);
