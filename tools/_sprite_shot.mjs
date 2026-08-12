// _sprite_shot.mjs — render a REAL play's board frame to PNG, both sprite and
// dot mode, so the Tecmo look can be eyeballed. Imports the real engine +
// buildPlayScript; reproduces watchBoard's exact sprite/field markup and the
// pixel CSS so the shot matches what the game emits. NOT a probe — a visual aid.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { createPlayer } from '../js/engine/player.js';
import { buildDepthChart } from '../js/engine/world.js';
import { simulateGame } from '../js/engine/sim.js';
import { ROSTER_TARGETS, CLASS_YEARS } from '../js/constants.js';
import { OFF_FIELD_LAYOUTS, DEF_FIELD_LAYOUTS } from '../js/constants_field.js';
import { buildPlayScript, sampleTrack } from '../js/ui/watchphys.js';

const LOS = 31, YPU = 0.85;
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mk = (o = {}) => ({ offFormations: [{ id: 'Spread', weight: 30 }, { id: 'Single Back', weight: 25 },
    { id: 'Flexbone', weight: 20 }, { id: 'Wildcat', weight: 10 }, { id: 'Power-I', weight: 15 }],
  tendency: 'Balanced', rushInPct: 55, passDepth: { short: 40, medium: 40, deep: 20 },
  blitzPct: 30, fourthDown: 'Moderate', baseTempo: 'Normal', maxFGDist: 42, jetRate: 25, drawRate: 20, ...o });
const genRoster = (t, s) => { const r = []; for (const [pos, c] of Object.entries(ROSTER_TARGETS)) for (let i = 0; i < c; i++) { const p = createPlayer(pos, CLASS_YEARS[i % 4], t); p.schoolId = s; r.push(p); } return r; };

// harvest a set of plays, pick a nice completed pass with YAC and a run
const rH = genRoster(1, 'H'), rA = genRoster(1, 'A');
const res = simulateGame({ id: 'H', name: 'Home' }, { id: 'A', name: 'Away' }, rH, rA,
  buildDepthChart(rH, mk()), buildDepthChart(rA, mk()), mk(), mk());
const plays = [];
for (const d of (res.drives || [])) for (const p of (d.plays || [])) plays.push({ ...p, _poss: d.possession });
const pass = plays.find(p => String(p.type).startsWith('pass') && p.complete && (p.yards || 0) >= 12 && OFF_FIELD_LAYOUTS[p.offFormation]);
const run  = plays.find(p => String(p.type).startsWith('run') && (p.yards || 0) >= 6 && OFF_FIELD_LAYOUTS[p.offFormation]);
const td   = plays.find(p => p.td && (p.fieldPos || 0) >= 70 && OFF_FIELD_LAYOUTS[p.offFormation]);
const chosen = { pass, run, td };

// ── verbatim copies of the render helpers from app.js (kept in sync by hand) ──
function spriteMarkup(a) {
  const off = a.team === 'off';
  const c = off ? 'wsp-off' : 'wsp-def', hl = off ? 'wsp-off-hl' : 'wsp-def-hl';
  let gh = 0; for (let i = 0; i < String(a.id).length; i++) gh = (gh + String(a.id).charCodeAt(i)) % 97;
  const gait = (-((gh % 8) * 0.045)).toFixed(3);
  const legsA =
      `<rect class="wsp-leg" x="-1.05" y="-1.5" width="0.85" height="1.5"/>`
    + `<rect class="wsp-leg" x="0.2"  y="-1.5" width="0.85" height="1.5"/>`;
  const legsB =
      `<rect class="wsp-leg" x="-1.3" y="-1.5" width="0.85" height="1.05"/>`
    + `<rect class="wsp-leg" x="0.45" y="-1.5" width="0.85" height="1.5"/>`;
  const body =
      `<rect class="wsp-shadow" x="-1.9" y="-0.45" width="3.8" height="0.8"/>`
    + `<g class="wsp-fA">${legsA}</g><g class="wsp-fB">${legsB}</g>`
    + `<rect class="wsp-pants" x="-1.3" y="-1.95" width="2.6" height="0.5"/>`
    + `<rect class="wsp-jersey ${c}" x="-1.35" y="-3.1" width="2.7" height="1.2"/>`
    + `<rect class="wsp-jersey ${c}" x="-1.75" y="-3.35" width="3.5" height="0.6"/>`
    + `<rect class="wsp-band ${hl}" x="-1.35" y="-2.6" width="2.7" height="0.5"/>`
    + `<rect class="wsp-arm ${c}" x="-1.85" y="-2.95" width="0.55" height="1.15"/>`
    + `<rect class="wsp-arm ${c}" x="1.3"   y="-2.95" width="0.55" height="1.15"/>`
    + `<rect class="wsp-skin" x="-1.85" y="-1.8" width="0.55" height="0.45"/>`
    + `<rect class="wsp-skin" x="1.3"   y="-1.8" width="0.55" height="0.45"/>`
    + `<rect class="wsp-helmet ${hl}" x="-1.0" y="-4.6" width="2.0" height="1.45"/>`
    + `<rect class="wsp-shine" x="-0.75" y="-4.4" width="0.45" height="0.45"/>`
    + (off
        ? `<rect class="wsp-stripe" x="-0.25" y="-4.6" width="0.5" height="1.45"/>`
        : `<rect class="wsp-mask" x="-0.85" y="-3.75" width="1.7" height="0.5"/>`
          + `<rect class="wsp-stripe" x="-0.25" y="-4.6" width="0.5" height="0.8"/>`);
  const tag = `<text class="${off ? 'wo-lbl' : 'wd-lbl'} wsp-tag" x="0" y="${off ? '1.8' : '-5.4'}">${a.label}</text>`;
  return `<g class="wsp${a.qb ? ' wsp-qb' : ''}" style="--gait:${gait}s">${body}</g>${tag}`;
}
function ballMarkup(x, y) {
  return `<g id="wp-ball" class="wa-ballg" transform="translate(${x},${y})">`
    + `<rect class="wab-core" x="-0.7" y="-1.15" width="1.4" height="2.3"/>`
    + `<rect class="wab-end" x="-0.45" y="-1.6" width="0.9" height="0.5"/>`
    + `<rect class="wab-end" x="-0.45" y="1.1"  width="0.9" height="0.5"/>`
    + `<rect class="wab-lace" x="-0.25" y="-0.5" width="0.5" height="1.0"/>`
    + `</g>`;
}
function fieldBase(p, board) {
  const fp = p?.fieldPos;
  const EZ = 10 * YPU;
  const Y_TOP = -68, Y_BOT = 72;
  const defs = `<defs>
      <pattern id="wf-grain" width="9" height="9" patternUnits="userSpaceOnUse">
        <rect x="1.2" y="2.6" width="0.7" height="0.7" fill="rgba(0,0,0,0.11)"/>
        <rect x="5.6" y="6.8" width="0.7" height="0.7" fill="rgba(255,255,255,0.05)"/>
        <rect x="7.2" y="0.9" width="0.7" height="0.7" fill="rgba(0,0,0,0.09)"/>
        <rect x="3.1" y="7.4" width="0.7" height="0.7" fill="rgba(0,0,0,0.07)"/>
        <rect x="0.4" y="5.2" width="0.7" height="0.7" fill="rgba(255,255,255,0.035)"/>
      </pattern>
      <pattern id="wf-ezchk" width="2.4" height="2.4" patternUnits="userSpaceOnUse">
        <rect width="1.2" height="1.2" fill="rgba(0,0,0,0.2)"/>
        <rect x="1.2" y="1.2" width="1.2" height="1.2" fill="rgba(0,0,0,0.2)"/>
      </pattern>
      <pattern id="wf-crowd" width="7" height="5" patternUnits="userSpaceOnUse">
        <rect width="7" height="5" fill="#0a1220"/>
        <rect x="0.7" y="0.8" width="0.9" height="0.9" fill="#3c4a66"/>
        <rect x="2.6" y="2.9" width="0.9" height="0.9" fill="#5a6884"/>
        <rect x="4.8" y="1.1" width="0.9" height="0.9" fill="#2e3950"/>
        <rect x="5.6" y="3.6" width="0.9" height="0.9" fill="#6e7a94"/>
        <rect x="1.4" y="4.0" width="0.9" height="0.9" fill="#49536e"/>
        <rect x="3.9" y="0.2" width="0.9" height="0.9" fill="#8a8ca3"/>
      </pattern>
    </defs>`;
  let under = '', lines = '';
  if (fp != null) {
    const yOf = abs => 31 - (abs - fp) * YPU;
    const gFar = yOf(100), gNear = yOf(0);
    under += `<rect x="0" y="${Y_TOP}" width="100" height="${Y_BOT - Y_TOP}" fill="url(#wf-crowd)"/>`;
    under += `<rect x="0" y="${(gFar - EZ).toFixed(1)}" width="100" height="${(gNear - gFar + 2 * EZ).toFixed(1)}" class="wf-turf"/>`;
    for (let abs = 0; abs < 100; abs += 10) {
      const y1 = yOf(abs + 5), y0 = yOf(abs);
      under += `<rect x="0" y="${y1.toFixed(1)}" width="100" height="${(y0 - y1).toFixed(1)}" class="wf-mow"/>`;
    }
    const offHome = board?.possession !== 'away';
    const offC = offHome ? board?.homeFill : board?.awayFill;
    const defC = offHome ? board?.awayFill : board?.homeFill;
    const offN = offHome ? board?.homeName : board?.awayName;
    const defN = offHome ? board?.awayName : board?.homeName;
    const ez = (yTop, fill, name) => {
      let s = `<rect x="0" y="${yTop.toFixed(1)}" width="100" height="${EZ.toFixed(1)}" class="wf-endzone" fill="${fill}"/>`
            + `<rect x="0" y="${yTop.toFixed(1)}" width="100" height="${EZ.toFixed(1)}" fill="url(#wf-ezchk)"/>`;
      if (name) {
        const txt = escapeHtml(String(name).toUpperCase());
        s += `<text x="50" y="${(yTop + EZ / 2 + 1.7).toFixed(1)}" class="wf-ez-lbl"${txt.length > 9 ? ' textLength="82" lengthAdjust="spacingAndGlyphs"' : ''}>${txt}</text>`;
      }
      return s;
    };
    under += ez(gFar - EZ, defC || '#c23a35', defN);
    under += ez(gNear, offC || '#175b35', offN);
    under += `<rect x="0" y="${(gFar - EZ).toFixed(1)}" width="100" height="${(gNear - gFar + 2 * EZ).toFixed(1)}" fill="url(#wf-grain)"/>`;
    lines += `<line x1="0" y1="${(gFar - EZ).toFixed(1)}" x2="100" y2="${(gFar - EZ).toFixed(1)}" class="wf-endline"/>`
           + `<line x1="0" y1="${(gNear + EZ).toFixed(1)}" x2="100" y2="${(gNear + EZ).toFixed(1)}" class="wf-endline"/>`
           + `<line x1="0.5" y1="${(gFar - EZ).toFixed(1)}" x2="0.5" y2="${(gNear + EZ).toFixed(1)}" class="wf-side"/>`
           + `<line x1="99.5" y1="${(gFar - EZ).toFixed(1)}" x2="99.5" y2="${(gNear + EZ).toFixed(1)}" class="wf-side"/>`;
    for (let abs = 0; abs <= 100; abs++) {
      const y = yOf(abs);
      if (y < Y_TOP || y > Y_BOT) continue;
      if (abs % 5 === 0) {
        const isGoal = abs === 0 || abs === 100;
        lines += `<line x1="0" y1="${y.toFixed(1)}" x2="100" y2="${y.toFixed(1)}" class="${isGoal ? 'wf-goal' : 'wf-yard'}"/>`;
        if (isGoal) {
          lines += `<rect x="0.4" y="${(y - 0.5).toFixed(1)}" width="1" height="1" class="wf-pylon"/>`
                 + `<rect x="98.6" y="${(y - 0.5).toFixed(1)}" width="1" height="1" class="wf-pylon"/>`;
        } else if (abs % 10 === 0) {
          const num = abs <= 50 ? abs : 100 - abs;
          lines += `<text x="15" y="${(y - 1).toFixed(1)}" class="wf-num">${num}</text>`
                 + `<text x="85" y="${(y - 1).toFixed(1)}" class="wf-num wf-num-r">${num}</text>`;
        }
      } else {
        lines += `<line x1="31.4" y1="${y.toFixed(1)}" x2="33.4" y2="${y.toFixed(1)}" class="wf-hash"/>`
               + `<line x1="66.6" y1="${y.toFixed(1)}" x2="68.6" y2="${y.toFixed(1)}" class="wf-hash"/>`;
      }
    }
    if (p.down && p.distance != null && fp + p.distance <= 100) {
      const fy = 31 - p.distance * YPU;
      if (fy > gFar) lines += `<line x1="0" y1="${fy.toFixed(1)}" x2="100" y2="${fy.toFixed(1)}" class="wf-first"/>`;
    }
  }
  return defs + under + lines + `<line x1="0" y1="31" x2="100" y2="31" class="wf-los"/>`;
}
function boardColors(poss) {
  // Home = blue/gold, Away = red/white — stand-ins for two schools' primary/secondary.
  return { possession: poss === 'away' ? 'away' : 'home',
    homeFill: '#3d7bd6', homeHi: '#ffd34d', awayFill: '#d64b3d', awayHi: '#f4f0d8',
    homeName: 'Bluehawks', awayName: 'Redhounds' };
}
function renderFrame(p, sprites, t) {
  const offL = OFF_FIELD_LAYOUTS[p.offFormation].slots;
  const defL = (DEF_FIELD_LAYOUTS[p.defFront] || DEF_FIELD_LAYOUTS['4-3']).slots;
  const s = buildPlayScript(p, offL, defL);
  const board = boardColors(p._poss);
  const glyph = a => sprites ? spriteMarkup(a)
    : (a.team === 'def' ? `<text class="wd-x" x="0" y="0">✕</text><text class="wd-lbl" x="0" y="-2.6">${a.label}</text>`
       : `<circle r="1.9" class="wo-c${a.qb ? ' wo-qb' : ''}" cx="0" cy="0"/><text class="wo-lbl" x="0" y="4.4">${a.label}</text>`);
  const actors = s.actors.map(a => { const [x, y] = sampleTrack(a.track, s.step, t);
    return `<g class="wp-actor wp-team-${a.team}${a.qb ? ' wp-qb' : ''}" data-wpg="${a.grp || ''}" transform="translate(${x.toFixed(2)},${y.toFixed(2)})">${glyph(a)}</g>`; }).join('');
  const [bx, by] = sampleTrack(s.ball.track, s.step, t);
  // camera: center on ball
  const camH = 52, camW = camH * (100 / 62);
  const camX = Math.max(0, Math.min(100 - camW, bx - camW / 2));
  const camY = Math.max(-20, Math.min(68 - camH, by - camH * 0.55));
  return `<svg id="watch-board" class="${sprites ? 'watch-sprites watch-in-play' : 'watch-in-play'}" viewBox="${camX.toFixed(1)} ${camY.toFixed(1)} ${camW.toFixed(1)} ${camH.toFixed(1)}" preserveAspectRatio="xMidYMid meet"
      style="--wsp-off:${sprites ? (board.possession!=='away'?board.homeFill:board.awayFill) : ''};--wsp-off-hl:${board.possession!=='away'?board.homeHi:board.awayHi};--wsp-def:${board.possession!=='away'?board.awayFill:board.homeFill};--wsp-def-hl:${board.possession!=='away'?board.awayHi:board.homeHi}">
    ${fieldBase(p, board)}${actors}
    ${ballMarkup(bx.toFixed(2), by.toFixed(2))}</svg>`;
}

// pull the pixel board CSS out of style.css so the shot is styled for real
const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const cssSlice = css.slice(css.indexOf('/* ── Tecmo sprite'), css.indexOf('.watch-flash {', css.indexOf('/* ── Tecmo sprite')))
  + css.slice(css.indexOf('#watch-board { border-radius'), css.indexOf('.wa-run,.wa-pass'))  // board field + actor base
  + `.wo-c{fill:#eaeaea;stroke:#f4f0d8;stroke-width:.55}.wo-c.wo-qb{fill:#ffd34d}.wd-x{fill:#ff716d;font-size:4px;text-anchor:middle;dominant-baseline:middle}.wo-lbl,.wd-lbl{fill:#f4f0d8;font-size:2.6px;text-anchor:middle;font-weight:900}`
  + `.wab-core{fill:#a35325;stroke:rgba(6,9,14,.95);stroke-width:.22;paint-order:stroke}.wab-end,.wab-lace{fill:#f4f0d8}`
  + `.wf-ez-lbl{font-size:4.6px;text-anchor:middle;font-weight:900;letter-spacing:.3em;paint-order:stroke;stroke-width:.5px}`
  + `.wf-pylon{fill:#ff9b2f}.wf-num{font-size:4px;text-anchor:start;font-weight:900}.wf-num-r{text-anchor:end}`;

const html = (frames) => `<!doctype html><html><head><meta charset=utf8><style>
  :root{--px-paper:#f4f0d8;--px-yellow:#ffd34d;--px-cyan:#55d6e8;--px-black:#05070c;
        --px-line:#53617a;--px-shadow:#020308;--team-1:#3d7bd6;--team-2:#ffd34d}
  body{margin:0;background:#05070c;font-family:monospace;color:#f4f0d8}
  .wrap{display:flex;flex-wrap:wrap;gap:14px;padding:14px}
  .cell{width:360px}.cell h3{margin:0 0 6px;font-size:13px;letter-spacing:.1em}
  .board-frame{position:relative;padding:4px;background:#05070c;border:3px solid #53617a;box-shadow:5px 5px 0 #020308}
  .board-frame::after{content:"";position:absolute;inset:4px;pointer-events:none;
    background:repeating-linear-gradient(0deg, rgba(4,6,10,.13) 0 1px, transparent 1px 3px),
               radial-gradient(130% 95% at 50% 42%, transparent 58%, rgba(2,4,8,.30) 100%)}
  #watch-board,svg{width:100%;height:auto;display:block;image-rendering:pixelated;shape-rendering:crispEdges}
  ${cssSlice}
  .wo-lbl,.wd-lbl{paint-order:stroke fill;stroke:#07110b;stroke-width:.9px;stroke-linejoin:miter}
  #watch-board.watch-in-play .wo-lbl,#watch-board.watch-in-play .wd-lbl{opacity:.44}
  #watch-board.watch-in-play .wp-actor[data-wpg="OL"] .wo-lbl,#watch-board.watch-in-play .wp-actor[data-wpg="DL"] .wd-lbl{opacity:.06}
</style></head><body><div class="wrap">${frames}</div></body></html>`;

const cells = [];
for (const [name, p] of Object.entries(chosen)) {
  if (!p) continue;
  const s = buildPlayScript(p, OFF_FIELD_LAYOUTS[p.offFormation].slots, (DEF_FIELD_LAYOUTS[p.defFront] || DEF_FIELD_LAYOUTS['4-3']).slots);
  const t = name === 'td' ? s.dur - 0.05 : s.presnap + (s.dur - s.presnap) * 0.55;   // TD at the finish, else mid-play
  cells.push(`<div class="cell"><h3>${name.toUpperCase()} · SPRITE (${p.type}, ${p.yards}yd)</h3><div class="board-frame">${renderFrame(p, true, t)}</div></div>`);
  cells.push(`<div class="cell"><h3>${name.toUpperCase()} · DOTS</h3><div class="board-frame">${renderFrame(p, false, t)}</div></div>`);
}

const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await b.newPage({ viewport: { width: 780, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html(cells.join('')), { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.screenshot({ path: process.argv[2] || '/tmp/sprite_shot.png', fullPage: true });
await b.close();
console.log('shot written; plays:', Object.entries(chosen).filter(([,p])=>p).map(([n,p])=>`${n}=${p.type}/${p.yards}yd`).join(', '));
