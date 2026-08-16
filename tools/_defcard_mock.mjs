// _defcard_mock.mjs — PROTOTYPE ONLY: what a Defensive Playbook v2 "call card"
// could look like. A defensive play = FRONT + COVERAGE + PRESSURE drawn as one
// picture: zone drops as translucent areas, man as dashed lines to ghost
// receivers, rush as red arrows. Renders a shelf of example calls and shots it.
import { chromium } from 'playwright';
import { DEF_FIELD_LAYOUTS } from '../js/constants_field.js';
import { readFileSync } from 'fs';

const W = 250, H = 190;
const f = (n) => (Math.round(n * 10) / 10).toString();

function card({ front, title, sub, coverage, rush, manFrom, dropDE, dogLB, commit }) {
  const layout = DEF_FIELD_LAYOUTS[front];
  if (!layout) return `<div>?? ${front}</div>`;
  const padX = 14, topPad = 10, ySpan = H - 52;
  const sx = (x) => padX + x * (W - 2 * padX);
  const sy = (y) => topPad + y * ySpan;
  const losY = sy(0.86);
  let svg = `<rect width="${W}" height="${H}" rx="6" fill="#12321d"/>`;
  // faint yards
  for (let i = 1; i <= 3; i++) svg += `<line x1="0" y1="${f(topPad + i * 30)}" x2="${W}" y2="${f(topPad + i * 30)}" stroke="rgba(255,255,255,.06)"/>`;
  svg += `<line x1="0" y1="${f(losY)}" x2="${W}" y2="${f(losY)}" stroke="rgba(255,255,255,.5)" stroke-dasharray="5 4"/>`;

  // ── coverage zones (behind everything) ──
  const zone = (x, y, w, h, label, hue) =>
    `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="9" fill="${hue}22" stroke="${hue}" stroke-opacity=".45" stroke-dasharray="3 3"/>` +
    (label ? `<text x="${f(x + w / 2)}" y="${f(y + 13)}" text-anchor="middle" font-size="8" fill="${hue}" opacity=".8">${label}</text>` : '');
  const CY = '#4dd2ff', GR = '#7cfc9e';
  const zoneTop = topPad + 2, zoneMid = sy(0.34), underH = sy(0.72) - zoneMid - 2;
  if (coverage === 'c3') {
    for (let i = 0; i < 3; i++) svg += zone(6 + i * ((W - 12) / 3), zoneTop, (W - 12) / 3 - 3, zoneMid - zoneTop - 4, 'DEEP ⅓', CY);
    for (let i = 0; i < 4; i++) svg += zone(8 + i * ((W - 16) / 4), zoneMid, (W - 16) / 4 - 3, underH, i === 0 || i === 3 ? 'FLAT' : 'HOOK', GR);
  } else if (coverage === 'tampa2') {
    for (let i = 0; i < 2; i++) svg += zone(6 + i * ((W - 12) / 2), zoneTop, (W - 12) / 2 - 3, zoneMid - zoneTop - 4, 'DEEP ½', CY);
    svg += zone(W / 2 - 17, zoneTop + 8, 34, sy(0.56) - zoneTop, 'RUN THE POLE', CY);
    for (let i = 0; i < 4; i++) if (i !== 1) svg += zone(8 + i * ((W - 16) / 4), zoneMid + 8, (W - 16) / 4 - 3, underH - 8, i === 0 || i === 3 ? 'FLAT' : 'CURL', GR);
  } else if (coverage === 'c1') {
    svg += zone(W / 2 - 42, zoneTop, 84, zoneMid - zoneTop - 4, 'FREE — MOF', CY);
  }
  // man lines: dashed yellow from named slots up to ghost receivers
  const ghostsY = sy(0.06);
  if (manFrom) {
    const ghostsX = [0.09, 0.3, 0.7, 0.91];
    manFrom.forEach((slotLabel, i) => {
      const s = layout.slots.find((sl) => sl.label === slotLabel);
      if (!s) return;
      const gx = sx(ghostsX[i % ghostsX.length]);
      svg += `<line x1="${f(sx(s.x))}" y1="${f(sy(s.y) - 8)}" x2="${f(gx)}" y2="${f(ghostsY + 8)}" stroke="#ffd34d" stroke-width="1.6" stroke-dasharray="4 3" opacity=".85"/>`;
      svg += `<circle cx="${f(gx)}" cy="${f(ghostsY)}" r="4" fill="none" stroke="#ffd34d" opacity=".8"/>`;
    });
  }
  // ── ghost offense for context ──
  for (let i = -2; i <= 2; i++) svg += `<rect x="${f(W / 2 + i * 15 - 3.5)}" y="${f(losY + 6)}" width="7" height="7" rx="1.5" fill="rgba(255,255,255,.25)"/>`;
  svg += `<rect x="${f(W / 2 - 3.5)}" y="${f(losY + 18)}" width="7" height="7" rx="1.5" fill="rgba(255,255,255,.35)" transform="rotate(45 ${f(W / 2)} ${f(losY + 21.5)})"/>`;

  // ── rush arrows (red) + exchanges ──
  const qbX = W / 2, qbY = losY + 21;
  const arrow = (x1, y1, color) => {
    const dx = qbX - x1, dy = qbY - y1, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const ex = x1 + ux * (L - 10), ey = y1 + uy * (L - 10);
    return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(ex)}" y2="${f(ey)}" stroke="${color}" stroke-width="2.2"/>` +
      `<polygon points="${f(ex + uy * 4 - ux * 2)},${f(ey - ux * 4 - uy * 2)} ${f(ex - uy * 4 - ux * 2)},${f(ey + ux * 4 - uy * 2)} ${f(ex + ux * 6)},${f(ey + uy * 6)}" fill="${color}"/>`;
  };
  if (rush && rush.length) for (const s of layout.slots) {
    if (rush.includes(s.label)) svg += arrow(sx(s.x), sy(s.y) + 6, '#ff7a7a');
  }
  if (dogLB) { const s = layout.slots.find((sl) => sl.label === dogLB); if (s) svg += arrow(sx(s.x), sy(s.y) + 6, '#ffd34d'); }
  if (dropDE) {
    const s = layout.slots.find((sl) => sl.label === dropDE);
    if (s) svg += `<path d="M${f(sx(s.x))} ${f(sy(s.y) - 6)} C ${f(sx(s.x) + 6)} ${f(sy(s.y) - 26)}, ${f(sx(s.x) + 20)} ${f(sy(s.y) - 30)}, ${f(sx(s.x) + 26)} ${f(sy(s.y) - 40)}" fill="none" stroke="#4dd2ff" stroke-width="2" stroke-dasharray="4 3"/><circle cx="${f(sx(s.x) + 28)}" cy="${f(sy(s.y) - 42)}" r="3" fill="#4dd2ff"/>`;
  }
  if (commit) svg += `<text x="${f(W / 2)}" y="${f(losY - 4)}" text-anchor="middle" font-size="9" fill="#ff9d5c">▼ +${commit} IN THE BOX</text>`;

  // ── the defenders (on top) ──
  const cls = { DE: '#c0392b', DT: '#c0392b', NT: '#c0392b', LE: '#c0392b', RE: '#c0392b', OLB: '#d4a017', MLB: '#d4a017', WILL: '#d4a017', MIKE: '#d4a017', SAM: '#d4a017' };
  for (const s of layout.slots) {
    const color = /E$|T$|^N/.test(s.label) ? '#e74c3c' : /LB|WILL|MIKE|SAM|JACK/i.test(s.label) ? '#e2b93b' : '#4aa3df';
    svg += `<rect x="${f(sx(s.x) - 10)}" y="${f(sy(s.y) - 7)}" width="20" height="14" rx="3" fill="${color}"/><text x="${f(sx(s.x))}" y="${f(sy(s.y) + 3.5)}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#0b1120">${s.label}</text>`;
  }
  return `<div class="dc"><svg viewBox="0 0 ${W} ${H}" width="250">${svg}</svg>
    <div class="dc-t">${title}</div><div class="dc-s">${sub}</div></div>`;
}

const cards = [
  card({ front: '4-3', title: 'Sky 3 — Fire Zone', sub: 'vs BASE · zone — safe vs deep, edge heat', coverage: 'c3', rush: ['LE', 'DT'], dropDE: 'RE', dogLB: 'SAM' }),
  card({ front: 'Dime', title: 'Tampa 2 — Rush 3', sub: 'vs 3RD & LONG · everything in front', coverage: 'tampa2', rush: ['LE', 'RE'] }),
  card({ front: '46/Bear', title: 'Cover 1 Robber — Load the Box', sub: 'vs HEAVY · stop the run first', coverage: 'c1', manFrom: ['CB', 'CB'], rush: ['DE', 'NT', 'DT'], commit: 15 }),
  card({ front: '3-4', title: 'Zero — Bring the House', sub: 'GAMBLE · no help, everyone comes', coverage: null, manFrom: ['CB', 'CB', 'FS', 'SS'], rush: ['DE', 'NT'], dogLB: 'ILB' })
];

const html = `<style>
body{background:#0b1120;font:12px monospace;color:#cbd5e1;padding:14px}
.shelf{display:flex;gap:6px;margin-bottom:10px;align-items:center}
.shelf b{color:#ffd34d;font-size:13px}
.grid{display:grid;grid-template-columns:repeat(4,260px);gap:12px}
.dc{background:#0f1b2d;border:1px solid #24334a;border-radius:8px;padding:6px}
.dc-t{font-weight:700;color:#e8ecf1;margin-top:4px}.dc-s{color:#7d8da3;font-size:10px}
</style>
<div class="shelf"><b>THE ANSWERS</b> — a defensive play is one card: front + coverage + pressure</div>
<div class="grid">${cards.join('')}</div>`;

const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
const p = await b.newPage({ viewport: { width: 1120, height: 330 } });
await p.setContent(html);
await p.waitForTimeout(200);
await p.screenshot({ path: '/tmp/shots/31-defcard-mock.png' });
await b.close();
console.log('mock rendered');
