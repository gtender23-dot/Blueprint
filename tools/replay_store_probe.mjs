// replay_store_probe — the dedicated replay-clip store (js/engine/replays.js).
// The home Codex's viewer saves clips to. Proves CRUD, cap, deep-clone
// portability, backup-ring corruption recovery, and that it's ISOLATED from the
// config library (writing clips never touches cfb-creator). localStorage
// polyfilled.
globalThis.localStorage = (() => {
  let m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k), clear: () => void (m = new Map()) };
})();

const { REPLAY_CAP, listReplays, getReplay, loadReplayData, saveReplay, renameReplay, deleteReplay } = await import('../js/engine/replays.js');

let pass = 0, fail = 0;
const bad = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; bad.push(msg); } }

// ── empty + save + read ─────────────────────────────────────────────────────
ok(listReplays().length === 0, 'empty film room');
const r1 = saveReplay('Hail Mary', { frames: [1, 2, 3], play: 'Four Verts' }, { info: { matchup: 'A @ B', score: '21-20' } });
ok(r1.ok && r1.id, 'saved a clip');
ok(listReplays().length === 1, 'one clip listed');
const got = getReplay(r1.id);
ok(got && got.name === 'Hail Mary' && got.info.score === '21-20' && got.saved, 'clip carries name + display info + timestamp');

// ── portability: loaded data is a deep clone ────────────────────────────────
const d = loadReplayData(r1.id);
d.frames.push(99);
ok(getReplay(r1.id).data.frames.length === 3, 'loaded clip data is a clone — playback cannot mutate the stored copy');

// ── update in place + rename + delete ───────────────────────────────────────
const r2 = saveReplay('Hail Mary v2', { frames: [1, 2, 3, 4] }, { id: r1.id });
ok(r2.ok && r2.id === r1.id && listReplays().length === 1, 'update-in-place by id, no duplicate');
ok(renameReplay(r1.id, 'The Miracle') && getReplay(r1.id).name === 'The Miracle', 'rename');
const r3 = saveReplay('Second Clip', { frames: [] });
ok(listReplays().length === 2 && listReplays().some((r) => r.id === r3.id), 'second clip saved alongside the first');
ok(deleteReplay(r1.id) && listReplays().length === 1, 'delete removes it');
ok(!deleteReplay('nope'), 'delete of missing id → false');

// ── cap ──────────────────────────────────────────────────────────────────────
localStorage.clear();
let allSaved = true;
for (let i = 0; i < REPLAY_CAP; i++) if (!saveReplay(`c${i}`, { i }).ok) allSaved = false;
ok(allSaved && listReplays().length === REPLAY_CAP, `filled to the cap (${REPLAY_CAP})`);
const over = saveReplay('overflow', { x: 1 });
ok(!over.ok && over.reason === 'full', 'cap blocks a new clip past the limit');

// ── bad data + corruption recovery ──────────────────────────────────────────
ok(!saveReplay('x', null).ok, 'null clip data rejected');
localStorage.clear();
saveReplay('keep', { frames: [7] });
saveReplay('keep2', { frames: [8] });
ok(localStorage.getItem('cfb-replays.bak1') != null, 'backup ring populated');
localStorage.setItem('cfb-replays', '{ corrupt not json');
ok(listReplays().length >= 1, 'corrupt primary recovers from the backup ring, not wiped');

// ── isolation from the config library ───────────────────────────────────────
localStorage.clear();
saveReplay('iso', { frames: [1] });
ok(localStorage.getItem('cfb-creator') == null, 'saving a clip never touches the config library (cfb-creator)');

console.log(`REPLAY STORE PROBE — ${pass} pass, ${fail} fail`);
if (fail) { console.log('  FAILURES:'); bad.forEach((m) => console.log('   -', m)); }
console.log(fail ? 'REPLAY STORE PROBE FAIL' : 'REPLAY STORE PROBE PASS');
process.exit(fail ? 1 : 0);
