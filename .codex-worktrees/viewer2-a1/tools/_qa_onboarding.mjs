// _qa_onboarding.mjs — QA: every division produces a coherent team; coach onboarding works.
import * as S from '../js/state.js';
import { generateWorld, generateSchedule } from '../js/engine/world.js';
import { buildDepthChart } from '../js/engine/world.js';

S.setRenderFn(() => {});
S.setNotifyFn(() => {});
const num = (v) => typeof v === 'number' && Number.isFinite(v);

const world = generateWorld();
const byDiv = {};
for (const s of world.schools) (byDiv[s.division] = byDiv[s.division] || []).push(s);
console.log('=== ONBOARDING — every division produces a coherent team ===');
console.log('schools by division:', Object.keys(byDiv).sort().map(d => `${d}:${byDiv[d].length}`).join('  '));

let issues = 0;
for (const div of Object.keys(byDiv).sort()) {
  let badAttr = 0, noPos = 0, noName = 0, thin = 0, emptyDC = 0, badPrestige = 0, n = 0;
  for (const s of byDiv[div]) {
    n++;
    const r = s.roster || [];
    if (r.length < 55) thin++;
    if (!num(s.prestige)) badPrestige++;
    for (const p of r) {
      if (!p.position) noPos++;
      if (!p.name || !p.name.first || !p.name.last) noName++;
      if (!num(p.compositeRating)) badAttr++;
      for (const k in (p.attributes || {})) if (!num(p.attributes[k])) badAttr++;
    }
    const dc = s.depthChart || buildDepthChart(r, s.gameplan || { offFormation: 'Single Back' });
    for (const pos of ['QB', 'RB', 'WR', 'OL', 'DL', 'LB', 'CB', 'S']) if (!(dc[pos] || []).length) emptyDC++;
  }
  const bad = badAttr + noPos + noName + thin + emptyDC + badPrestige;
  issues += bad;
  console.log(`  ${div}: ${n} schools | badAttr ${badAttr} noPos ${noPos} noName ${noName} thinRoster ${thin} emptyDCslots ${emptyDC} badPrestige ${badPrestige}  -> ${bad ? 'ISSUES' : 'OK'}`);
}

// Coach onboarding path (one full start).
console.log('\n=== COACH ONBOARDING PATH (startNewGamePrepared) ===');
const w2 = generateWorld();
const school = w2.schools.slice().sort((a, b) => b.prestige - a.prestige)[0];
let err = null;
try { S.startNewGamePrepared({ first: 'QA', last: 'Coach' }, w2, school); } catch (e) { err = e; }
if (err) { console.log('  [FAIL] start threw:', err.message); issues++; }
else {
  const st = S.state, c = st.playerCoach;
  const chk = [
    ['coach exists', !!c],
    ['coach has skills', !!(c && c.skills)],
    ['jobSecurity finite', num(c && c.jobSecurity)],
    ['prestige finite', num(c && c.prestige)],
    ['playerSchoolId set', !!st.playerSchoolId],
    ['world present', !!st.world],
    ['schedule or day set', num(st.day)],
    ['season set', num(st.season)],
  ];
  for (const [label, ok] of chk) { console.log(`  [${ok ? 'OK' : 'FAIL'}] ${label}`); if (!ok) issues++; }
}
console.log(`\n${issues === 0 ? 'ONBOARDING ALL OK ✅' : '⚠ ' + issues + ' issue(s)'}`);
process.exit(issues === 0 ? 0 : 1);
