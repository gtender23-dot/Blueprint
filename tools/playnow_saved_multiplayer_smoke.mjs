// Saved-team + local multiplayer Play Now smoke (Aug 2026).
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const body = await readFile(join(ROOT, rel));
    res.writeHead(200, { 'content-type':MIME[extname(rel)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(resolve => server.listen(0, resolve));

const browser = await chromium.launch({ executablePath:process.env.PW_CHROMIUM || undefined, headless:true });
const page = await browser.newPage({ viewport:{ width:390, height:844 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let fails = 0;
const check = (ok, label, detail = '') => {
  if (!ok) fails++;
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
};

try {
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForTimeout(500);
  const seeded = await page.evaluate(async () => {
    const cp = await import('./js/engine/coachprofile.js');
    const world = await import('./js/engine/world.js');
    const ai = await import('./js/engine/ai.js');
    const coach = cp.createCoach('Saved', 'Team Test');
    const school = world.generateExhibitionTeam('D1', 5);
    ai.setAIGameplan(school);
    school.gameplan.tendency = 'Pass Heavy';
    const name = `${school.name} 2032`;
    const ok = cp.saveTeamToLibrary(coach.id, name, school, { season:7, record:{ wins:11, losses:2 } });
    return { ok, name, coachId:coach.id, count:cp.listSavedTeams().length };
  });
  check(seeded.ok && seeded.count === 1, 'dynasty team snapshot saves to the coach library');

  await page.locator('#btn-mm-playnow').click();
  await page.waitForTimeout(250);
  check(await page.locator('.pn-source option').count() === 4, 'saved team is offered for either Play Now side');
  await page.locator('[data-pn-source="home"]').selectOption({ index:1 });
  await page.waitForTimeout(150);
  await page.locator('[data-pn-source="away"]').selectOption({ index:1 });
  await page.waitForTimeout(150);
  const names = await page.locator('.pn-name').allTextContents();
  check(names.length === 2 && names[0] === names[1], 'the same saved team can be selected on both sides', names.join(' vs '));
  check(await page.locator('[data-pn-mode="coach"]').count() === 1
    && await page.locator('[data-pn-mode="away"]').count() === 1
    && await page.locator('[data-pn-mode="both"]').count() === 1
    && await page.locator('[data-pn-mode="watch"]').count() === 1,
    'all four game-control modes are available');
  await page.locator('[data-pn-mode="both"]').click();
  await page.waitForTimeout(100);
  check(await page.locator('[data-pn-mode="both"].active[aria-pressed="true"]').count() === 1, 'Both Teams mode can be selected');
  const phoneOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check(!phoneOverflow, 'saved-team multiplayer setup fits a 390px phone');
  await page.screenshot({ path:join(ROOT, 'qa-shots', 'playnow_saved_multiplayer_phone.png'), fullPage:true });
  await page.setViewportSize({ width:1280, height:900 });
  await page.waitForTimeout(100);
  const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check(!desktopOverflow, 'saved-team multiplayer setup fits desktop');
  await page.screenshot({ path:join(ROOT, 'qa-shots', 'playnow_saved_multiplayer_desktop.png'), fullPage:true });

  await page.locator('#pn-start').click();
  await page.waitForTimeout(300);
  const kickoff = await page.evaluate(async () => {
    const { state } = await import('./js/state.js');
    const t = state.pendingHalftime?.token;
    const homeIds = new Set((t?.homeRoster || []).map(p => p.id));
    const collision = (t?.awayRoster || []).some(p => homeIds.has(p.id));
    return {
      mode:state._exhibitionMode,
      controlled:t?.controlledSides || [],
      schoolIds:[t?.homeSchool?.id, t?.awaySchool?.id],
      collision,
      tendencies:[t?.homeGP?.tendency, t?.awayGP?.tendency],
    };
  });
  check(kickoff.mode === 'both' && kickoff.controlled.join('|') === 'home|away', 'kickoff controls both offenses');
  check(kickoff.schoolIds[0] && kickoff.schoolIds[0] !== kickoff.schoolIds[1] && !kickoff.collision,
    'same-team matchup has distinct school and player IDs');
  check(kickoff.tendencies.join('|') === 'Pass Heavy|Pass Heavy', 'saved gameplan loads intact on both sidelines');

  const possessions = await page.evaluate(async () => {
    const api = await import('./js/state.js');
    const seen = new Set();
    for (let i = 0; i < 180; i++) {
      const t = api.state.pendingHalftime?.token;
      if (!t || t.stage === 'done') break;
      if (!t.pending) {
        if (api.state.ui.showHalftime) await api.resumeHalftime();
        else break;
        continue;
      }
      seen.add(t.pending.possession);
      if (t.playerSide !== t.pending.possession) return { seen:[...seen], mismatch:true };
      if (seen.size === 2) return { seen:[...seen], mismatch:false };
      if (t.pending.kind === 'fourth') await api.answerFourthDown('auto');
      else await api.answerPlayCall({ concept:'sheet' });
    }
    return { seen:[...seen], mismatch:false };
  });
  check(!possessions.mismatch && possessions.seen.includes('home') && possessions.seen.includes('away'),
    'headset follows possession and prompts Team 1 and Team 2', possessions.seen.join(' → '));
  const activeCall = await page.evaluate(async () => {
    const api = await import('./js/state.js');
    api.state.ui.liveWatch = { stage:'call', boardDone:true };
    api.rerender();
    const token=api.state.pendingHalftime?.token;
    const side=token?.pending?.possession || token?.playerSide || 'home';
    return {
      strip:document.querySelector('.cs-sit')?.textContent || '',
      score:document.querySelector('.cs-score')?.textContent || '',
      school:(side==='home'?token?.homeSchool:token?.awaySchool)?.name || '',
      label:side==='home'?'TEAM 1 CALL':'TEAM 2 CALL',
    };
  });
  check(activeCall.strip.includes(activeCall.label) && activeCall.score.startsWith(activeCall.school),
    'visible call sheet names the team currently in possession', activeCall.strip);
  check(errors.length === 0, 'zero page errors', errors.slice(0, 2).join(' | '));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log(fails ? `\nFAIL — ${fails} saved-team multiplayer check(s)` : '\nSAVED-TEAM MULTIPLAYER SMOKE PASS');
process.exit(fails ? 1 : 0);