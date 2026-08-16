import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
await pg.goto('file://' + process.argv[2], { waitUntil: 'networkidle' });
await pg.waitForTimeout(1800);
await pg.screenshot({ path: '/tmp/shot_menu.png' });
// Try to reach the new-game screen for a second angle
const btn = await pg.$('text=PLAY NOW');
if (btn) { await btn.click(); await pg.waitForTimeout(1200); await pg.screenshot({ path: '/tmp/shot_newgame.png' });
  const kick = await pg.$('#pn-start');
  if (kick) { await kick.click(); await pg.waitForTimeout(5000); await pg.screenshot({ path: '/tmp/shot_gameday.png' }); }
}
await b.close();
console.log('shots done');
