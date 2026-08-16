// save_safety_probe.mjs — the net that would have caught the warChest crash.
//
// A Set or Map on saved state serializes to {} and loses its data on load — the
// "warChest.has is not a function" class of bug. auditSaveState walks a state graph and
// returns every such value by path, so a save can be checked in testing instead of
// detonating on a player's load. This proves the auditor catches the offenders, reports
// their paths, ignores clean state, and terminates on cycles.
import { auditSaveState } from '../js/engine/persistence.js';

let fail = 0;
const T = (name, cond) => { if (cond) console.log(`  PASS  ${name}`); else { fail++; console.log(`  FAIL  ${name}`); } };

console.log('1. Clean, fully-JSON-safe state:');
{
  const clean = { world: { schools: [{ id: 's1', coach: { aiRec: { warChest: ['r1', 'r2'], slots: 3 } } }] } };
  const off = auditSaveState(clean);
  T('no offenders', off.length === 0);
}

console.log('\n2. The exact bug shape — a Set on coach.aiRec.warChest:');
{
  const dirty = { world: { schools: [{ coach: { aiRec: { warChest: new Set(['r1']) } } }] } };
  const off = auditSaveState(dirty);
  T('caught exactly one offender', off.length === 1);
  T('reported as a Set', off[0]?.type === 'Set');
  T('with a locating path', /schools\[0\]\.coach\.aiRec\.warChest$/.test(off[0]?.path || ''));
  console.log(`      → ${off[0]?.type} at ${off[0]?.path}`);
}

console.log('\n3. Maps are caught too, at depth:');
{
  const dirty = { a: { b: { m: new Map([['k', 1]]) } } };
  const off = auditSaveState(dirty);
  T('caught the Map', off.length === 1 && off[0].type === 'Map' && off[0].path === 'a.b.m');
}

console.log('\n4. Multiple offenders across the graph:');
{
  const dirty = { p: { s: new Set() }, q: [ { t: new Set() } ] };
  const off = auditSaveState(dirty);
  T('found both', off.length === 2);
}

console.log('\n5. Cyclic graph terminates (no infinite walk):');
{
  const a = { name: 'a' }; a.self = a; a.child = { back: a, bad: new Set() };
  const off = auditSaveState(a);
  T('terminates and still finds the Set', off.length === 1 && off[0].type === 'Set');
}

console.log(fail ? `\n${fail} FAILED` : '\nPASS — the auditor flags Set/Map on save state by path; the warChest bug class is now catchable in testing.');
process.exit(fail ? 1 : 0);
