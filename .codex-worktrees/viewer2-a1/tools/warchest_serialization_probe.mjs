// warchest_serialization_probe.mjs — guards the "warChest.has is not a function" crash.
//
// AI recruiting stored its war-chest (the must-have targets a school will overpay for) as a
// Set on school.coach.aiRec. That object is serialized into the save. A Set JSON-stringifies
// to {} and reloads as a plain object, so the first day advanced after a load hit
// warChest.has(id) → "not a function" and the game threw on "advancing day".
//
// The fix: store warChest as a plain ARRAY (survives JSON), and rebuild a Set at the read
// site with an Array.isArray guard so legacy saves (where it is already {}) degrade to an
// empty war-chest instead of crashing. This probe reproduces the failure mode and proves the
// fix across all three shapes a loaded save can present.
const save = obj => JSON.parse(JSON.stringify(obj));           // exactly what the save layer does
const readSite = wc => new Set(Array.isArray(wc) ? wc : []);   // the fixed read-site expression

let fail = 0;
const T = (name, cond) => { if (cond) console.log(`  PASS  ${name}`); else { fail++; console.log(`  FAIL  ${name}`); } };

console.log('1. Reproduce the original bug (why it crashed):');
{
  const persisted = save({ warChest: new Set(['r1', 'r2']) });   // Set → save → load
  T('a persisted Set comes back as a plain object', typeof persisted.warChest === 'object' && !Array.isArray(persisted.warChest));
  T('...with no .has (this is the crash)', typeof persisted.warChest.has !== 'function');
}

console.log('\n2. The fix — store an array, rebuild the Set on read:');
{
  const aiRec = { warChest: ['r1', 'r2'] };          // NEW store shape (array)
  const loaded = save(aiRec);                         // save → load
  T('the array survives the round-trip', Array.isArray(loaded.warChest) && loaded.warChest.length === 2);
  const wc = readSite(loaded.warChest);
  T('rebuilt as a working Set', wc instanceof Set && typeof wc.has === 'function');
  T('war-chest membership preserved', wc.has('r1') && wc.has('r2') && !wc.has('rX'));
}

console.log('\n3. Legacy saves (warChest already {} from before the fix) must not crash:');
{
  const legacy = save({ warChest: new Set(['r1']) }); // an OLD save on disk today
  const wc = readSite(legacy.warChest);               // must not throw
  T('degrades to an empty Set, no throw', wc instanceof Set && wc.size === 0);
  T('.has works (returns false)', wc.has('r1') === false);
}

console.log('\n4. Missing / undefined warChest (school between coaches):');
{
  const wc = readSite(undefined);
  T('empty Set, no throw', wc instanceof Set && wc.size === 0);
}

console.log(fail ? `\n${fail} FAILED` : '\nPASS — war-chest survives save/load; the day-advance crash is fixed and legacy saves are safe.');
process.exit(fail ? 1 : 0);
