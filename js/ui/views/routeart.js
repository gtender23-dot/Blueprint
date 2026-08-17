import { OFF_FIELD_LAYOUTS, DEF_FIELD_LAYOUTS, DEF_BLITZ_ELIGIBLE, variationLayoutSlots } from '../../constants_field.js';
import { aliasFormation, FORMATION_VARIATIONS, FORMATION_PACKAGES } from '../../constants.js';

// ── Route art — the reusable play-graphics primitive ───────────────────────
// One place that knows how to DRAW a route. Every Creator screen that shows a
// play (the Play Composer picker, the play card, the Playbook Builder, the
// future full-play canvas) draws through here, so route art looks the same
// everywhere and there is exactly one shape table to maintain.
//
// A route is a short list of points in RECEIVER-LOCAL space:
//   x = OUTWARD (toward the nearest sideline) is +; toward the middle is −.
//   y = DOWNFIELD is − (up the screen); behind the LOS is +.
// A caller supplies the receiver's origin, a mirror `side` (+1 receiver on the
// right, −1 on the left, so in/out routes bend correctly), and a scale. The
// same generator serves a tiny fixed-orientation icon and a full-field play
// card — that is the whole point of keeping it parametric.

// route id → { pts:[[outward, downfield], …], color, label }
var ROUTE_ART = {
  go:        { color: "#ffd34d", pts: [[0, 0], [0, -38]] },
  post:      { color: "#4dd2ff", pts: [[0, 0], [0, -22], [-12, -38]] },
  corner:    { color: "#ff9d5c", pts: [[0, 0], [0, -22], [12, -38]] },
  dig:       { color: "#7cfc9e", pts: [[0, 0], [0, -20], [-16, -20]] },
  out:       { color: "#4dd2ff", pts: [[0, 0], [0, -20], [14, -20]] },
  curl:      { color: "#d98cff", pts: [[0, 0], [0, -24], [-5, -17]] },
  slant:     { color: "#ff7a7a", pts: [[0, 0], [-13, -15]] },
  drag:      { color: "#ff7a7a", pts: [[0, 0], [0, -7], [-22, -12]] },
  flat:      { color: "#7cfc9e", pts: [[0, 0], [0, -5], [14, -8]] },
  wheel:     { color: "#ffd34d", pts: [[0, 0], [8, -6], [12, -36]] },
  screen:    { color: "#d98cff", pts: [[0, 0], [0, 4], [13, 5]] },
  checkdown: { color: "#9fb3c8", pts: [[0, 0], [0, -8], [8, -10]] },
  // ── art-only routes (concept thumbnails, NOT composer parts) ──────────────
  // bubble/tunnel: receiver screens — a bubble swings OUTWARD behind the LOS
  // off a slot, a tunnel comes back INSIDE. Both were previously drawn with the
  // RB-screen art and auto-assigned to a back, so Bubble Screen and RB Screen
  // read as each other (owner catch, 2026-08-15).
  bubble:    { color: "#d98cff", pts: [[0, 0], [7, 4], [17, 3]] },
  tunnel:    { color: "#d98cff", pts: [[0, 0], [2, 4], [-14, 5]] },
  // comeback/deepout: the deep-stem sideline breaks — drawn shallow before
  // (a comeback is an 18-yard stop off a go stem, not a curl).
  comeback:  { color: "#4dd2ff", pts: [[0, 0], [0, -30], [7, -24]] },
  deepout:   { color: "#4dd2ff", pts: [[0, 0], [0, -30], [14, -30]] },
  // fade: the back-shoulder jump ball (#19) — an OUTSIDE release up the
  // boundary that settles short-medium, per the concept spec ("a SHORT–MEDIUM
  // back-shoulder jump ball to an OUTSIDE receiver", concepts.js). Drawn as a
  // straight go before, which read as a deep shot and nothing like a fade.
  fade:      { color: "#ff9d5c", pts: [[0, 0], [6, -7], [9, -20], [8, -25]] }
};

function _fmt(n) { return (Math.round(n * 10) / 10).toString(); }

// M0 card linter: an optional clamp box keeps every drawn point inside the
// card. A boundary receiver's outward break (corner/out/wheel from the widest
// split) used to draw off the edge of the SVG; clamped, it hugs the sideline
// the way a boundary route really does. box = { x0, x1, y0?, y1? }.
function _clampPt(x, y, box) {
  if (!box) return [x, y];
  const cx = Math.min(Math.max(x, box.x0 != null ? box.x0 : -Infinity), box.x1 != null ? box.x1 : Infinity);
  const cy = Math.min(Math.max(y, box.y0 != null ? box.y0 : -Infinity), box.y1 != null ? box.y1 : Infinity);
  return [cx, cy];
}

// The primitive: an SVG path `d` for a route drawn from (ox,oy), mirrored by
// side, at scale. worldX = ox + side*outward*scale; worldY = oy + downfield*scale.
function routePathD(id, ox, oy, side, scale, box) {
  const art = ROUTE_ART[id];
  if (!art) return "";
  const s = side < 0 ? -1 : 1;
  const k = scale || 1;
  return art.pts.map((p, i) => {
    const [x, y] = _clampPt(ox + s * p[0] * k, oy + p[1] * k, box);
    return `${i === 0 ? "M" : "L"}${_fmt(x)} ${_fmt(y)}`;
  }).join(" ");
}
function routeEnd(id, ox, oy, side, scale, box) {
  const art = ROUTE_ART[id];
  if (!art) return [ox, oy];
  const s = side < 0 ? -1 : 1, k = scale || 1;
  const last = art.pts[art.pts.length - 1];
  return _clampPt(ox + s * last[0] * k, oy + last[1] * k, box);
}
function routeColor(id) { return (ROUTE_ART[id] || {}).color || "#9fb3c8"; }

// A standalone route icon — fixed orientation, receiver dot at the base, a stub
// of the line of scrimmage. Used on the picker tiles and anywhere a route needs
// a glyph. `size` is the px box.
function routeGlyph(id, opts) {
  const o = opts || {};
  const size = o.size || 46;
  const ox = 24, oy = 40, scale = 0.92;
  const d = routePathD(id, ox, oy, 1, scale);
  const end = routeEnd(id, ox, oy, 1, scale);
  const color = routeColor(id);
  return `<svg class="route-glyph" viewBox="0 0 48 52" width="${size}" height="${(size * 52 / 48).toFixed(0)}" aria-hidden="true">
    <line x1="4" y1="40" x2="44" y2="40" class="route-glyph-los"/>
    <path d="${d}" class="route-glyph-path" style="stroke:${color}"/>
    <circle cx="${_fmt(end[0])}" cy="${_fmt(end[1])}" r="3" style="fill:${color}"/>
    <circle cx="${ox}" cy="${oy}" r="3.2" class="route-glyph-hat"/>
  </svg>`;
}

// The play card: the selected routes drawn on a field from a spread alignment —
// the EA-style "play art". `parts` is the composed play's route-id list. Draws a
// turf, the LOS + a downfield marker, one receiver per part fanned across the
// formation, and each route in its color.
// A sensible default route for a receiver who wasn't given one — by his spot:
// backs check down, tight ends work the curl, outside receivers clear vertical,
// inside receivers attack the middle. Keeps the picture honest (everyone runs
// something) without pretending it's the authored read.
function _fillRoute(slot) {
  if (slot.pos === "RB" || slot.pos === "WING" || slot.pos === "ABACK") return "checkdown";
  if (slot.pos === "TE") return "curl";
  return Math.abs(slot.x - 0.5) > 0.32 ? "go" : "dig";
}
// Faint yard lines + hash marks so a play card reads like a field, not a blank
// rectangle. Downfield (above the LOS) gets a few yard stripes; two dashed hash
// columns frame the middle.
function _fieldLines(W, H, losY) {
  const out = [];
  for (let yy = losY - H * 0.17; yy > H * 0.04; yy -= H * 0.17) out.push(`<line x1="0" y1="${_fmt(yy)}" x2="${W}" y2="${_fmt(yy)}" class="play-card-yard"/>`);
  out.push(`<line x1="${_fmt(W * 0.36)}" y1="0" x2="${_fmt(W * 0.36)}" y2="${H}" class="play-card-hash"/>`);
  out.push(`<line x1="${_fmt(W * 0.64)}" y1="0" x2="${_fmt(W * 0.64)}" y2="${H}" class="play-card-hash"/>`);
  out.push(`<line x1="0" y1="${_fmt(losY)}" x2="${W}" y2="${_fmt(losY)}" class="play-card-los"/>`);
  return out.join("");
}
function _pickSpread(arr, k) {
  if (k <= 0 || arr.length === 0) return [];
  if (k >= arr.length) return arr.slice();
  if (k === 1) return [arr[Math.floor(arr.length / 2)]];
  const out = [];
  for (let i = 0; i < k; i++) out.push(arr[Math.round((i * (arr.length - 1)) / (k - 1))]);
  return out;
}
// Stage 6: THE one receiver-resolution — which body runs which authored route.
// Extracted from renderPlayCard so the CARD and the live ANIMATION (app.js
// seeds watchphys from this) resolve identically, receiver-for-receiver:
// honor explicit picks (deduped), then auto-fill — screens/checkdowns prefer
// the backs, WR screens the inner slot, the rest outside-in. Pure; the layout
// slots are never mutated.
function resolveComposedReceivers(parts, assigns, layoutSlots) {
  const list = (parts || []).filter((p) => ROUTE_ART[p]);
  const skill = (layoutSlots || []).filter((s) => s.pos !== "OL" && s.pos !== "QB");
  const byId = {}; skill.forEach((s) => { byId[s.id] = s; });
  const backs = skill.filter((s) => s.pos === "RB").sort((a, b) => a.x - b.x);
  const wides = skill.filter((s) => s.pos !== "RB").sort((a, b) => a.x - b.x);
  const innerWide = wides.slice().sort((a, b) => Math.abs(a.x - 0.5) - Math.abs(b.x - 0.5))[0];
  const used = new Set();
  const resolved = list.map((id, i) => {
    const a = (assigns && assigns[i]) || {};
    const slot = a.slot && byId[a.slot] && !used.has(a.slot) ? byId[a.slot] : null;
    if (slot) used.add(slot.id);
    return { id, slot, flip: !!a.flip };
  });
  resolved.forEach((r) => {
    if (r.slot) return;
    const back = r.id === "screen" || r.id === "checkdown";
    const slotWide = r.id === "bubble" || r.id === "tunnel"; // WR screens live on the slot, not the back
    const openBacks = backs.filter((s) => !used.has(s.id));
    const openWides = wides.filter((s) => !used.has(s.id));
    const openInner = openWides.slice().sort((a, b) => Math.abs(a.x - 0.5) - Math.abs(b.x - 0.5));
    const pick = (back && openBacks[0]) || (slotWide && openInner[0]) || openWides[0] || openBacks[0]
      || skill.find((s) => !used.has(s.id)) || innerWide || skill[0];
    r.slot = pick; if (pick) used.add(pick.id);
  });
  return { resolved, skill, used, innerWide };
}
function renderPlayCard(parts, opts) {
  const o = opts || {};
  const W = o.w || 260, H = o.h || 170;
  const list = (parts || []).filter((p) => ROUTE_ART[p]);
  // Stage 6: a card can name a LOOK — the authored variation alignment draws.
  const layout = o.formation ? (o.variation ? _variationLayout(o.formation, o.variation) : (OFF_FIELD_LAYOUTS[aliasFormation(o.formation)] || OFF_FIELD_LAYOUTS[o.formation])) : null;

  const assigns = Array.isArray(o.assigns) ? o.assigns : null;
  let receivers, dots, line, qb, yard;
  if (layout) {
    // Draw the routes FROM the formation's real receiver alignment.
    const padX = 14;
    const sx = (x) => padX + x * (W - 2 * padX);
    const losY = H * 0.52;
    const sy = (y) => losY + (y - 0.5) * (H * 0.6);
    const scale = o.scale || Math.max(1.2, (losY - 14) / 40);
    // Sanity lock: every route gets its OWN receiver — never two routes off one
    // body (which reads as broken). Stage 6: the resolution lives in
    // resolveComposedReceivers, shared with the live animation seed.
    const { resolved, skill, used, innerWide } = resolveComposedReceivers(parts, assigns, layout.slots);
    const assigned = resolved;
    // Spread receivers that share an x (e.g. Power-I / Jumbo stack FB+HB at
    // midfield) so their routes don't draw on top of each other.
    const xGroups = {};
    skill.forEach((s) => { (xGroups[s.x] = xGroups[s.x] || []).push(s); });
    const xOff = {};
    Object.values(xGroups).forEach((g) => {
      if (g.length > 1) { g.slice().sort((a, b) => (a.id < b.id ? -1 : 1)).forEach((s, k) => { xOff[s.id] = (k - (g.length - 1) / 2) * 13; }); }
    });
    const sxSlot = (s) => sx(s.x) + (xOff[s.id] || 0);
    receivers = assigned.map((a) => {
      const slot = a.slot || skill[0];
      return { id: a.id, x: sxSlot(slot), y: sy(slot.y), side: (slot.x < 0.5 ? -1 : 1) * (a.flip ? -1 : 1), scale };
    });
    // NO invisible receivers: every skill player who wasn't given an authored
    // route still runs one — a sensible default by his spot (outside WRs clear
    // vertical, inside men work the middle, backs check down). Drawn faint so the
    // authored routes read as the primary read.
    const blockSet = new Set(Array.isArray(o.blocks) ? o.blocks : []);
    const fillRecs = o.noFill ? [] : skill.filter((s) => !used.has(s.id) && !blockSet.has(s.id)).map((s) => ({
      id: _fillRoute(s), x: sxSlot(s), y: sy(s.y), side: (s.x < 0.5 ? -1 : 1), scale, fill: true
    }));
    receivers = receivers.concat(fillRecs);
    // A receiver told to block gets the football "T" — a short stem up from his
    // dot into a crossbar. Drawn ABOVE the dot (the old 10×5 bar sat exactly
    // under the white receiver dot: white-on-white, invisible).
    const blocks = skill.filter((s) => blockSet.has(s.id)).map((s) => {
      const bx = sxSlot(s), by = sy(s.y);
      return `<line x1="${_fmt(bx)}" y1="${_fmt(by - 4)}" x2="${_fmt(bx)}" y2="${_fmt(by - 10)}" class="play-card-block-stem"/><rect x="${_fmt(bx - 7)}" y="${_fmt(by - 13)}" width="14" height="3.5" rx="1" class="play-card-block"/>`;
    }).join("");
    dots = skill.map((s) => `<circle cx="${_fmt(sxSlot(s))}" cy="${_fmt(sy(s.y))}" r="4.2" class="play-card-rec"/>`).join("") + blocks;
    line = layout.slots.filter((s) => s.pos === "OL").map((s) => `<rect x="${_fmt(sx(s.x) - 4)}" y="${_fmt(sy(s.y) - 4)}" width="8" height="8" rx="1.5" class="play-card-ol"/>`).join("");
    const q = layout.slots.find((s) => s.pos === "QB");
    qb = q ? `<rect x="${_fmt(sx(q.x) - 4)}" y="${_fmt(sy(q.y) - 4)}" width="8" height="8" rx="1.5" class="play-card-qb"/>` : "";
    yard = _fieldLines(W, H, losY);
  } else {
    // No formation: fan the receivers evenly across the front.
    const losY = H * 0.68, scale = o.scale || 1.55, n = list.length;
    receivers = list.map((id, i) => {
      const frac = n === 1 ? 0.5 : 0.13 + (0.74 * i) / (n - 1);
      const x = W * frac;
      const flip = assigns && assigns[i] && assigns[i].flip ? -1 : 1;
      return { id, x, y: losY, side: (x < W / 2 ? -1 : 1) * flip, scale };
    });
    dots = receivers.map((r) => `<circle cx="${_fmt(r.x)}" cy="${_fmt(r.y)}" r="4.2" class="play-card-rec"/>`).join("");
    const olXs = [-30, -15, 0, 15, 30];
    line = olXs.map((dx) => `<rect x="${_fmt(W / 2 + dx - 4)}" y="${_fmt(losY - 4)}" width="8" height="8" rx="1.5" class="play-card-ol"/>`).join("");
    qb = `<rect x="${_fmt(W / 2 - 4)}" y="${_fmt(losY + 12)}" width="8" height="8" rx="1.5" class="play-card-qb"/>`;
    yard = _fieldLines(W, H, losY);
  }
  // Card linter: every route point stays inside the card (boundary breaks
  // clamp to the sideline instead of drawing off the SVG).
  const box = { x0: 4, x1: W - 4, y0: 5, y1: H - 5 };
  const routes = receivers.map((r) => {
    const d = routePathD(r.id, r.x, r.y, r.side, r.scale, box);
    const end = routeEnd(r.id, r.x, r.y, r.side, r.scale, box);
    const c = routeColor(r.id);
    if (r.fill) return `<path d="${d}" class="play-card-route play-card-route-fill"/>`;
    return `<path d="${d}" class="play-card-route" style="stroke:${c}"/>
      <circle cx="${_fmt(end[0])}" cy="${_fmt(end[1])}" r="3.4" style="fill:${c}"/>`;
  }).join("");
  return `<svg class="play-card-svg" viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Play diagram">
    <rect x="0" y="0" width="${W}" height="${H}" class="play-card-turf"/>
    ${yard}
    ${qb}
    ${line}
    ${routes}
    ${dots}
  </svg>`;
}

// ── Formation diagrams ─────────────────────────────────────────────────────
// Draws a formation's pre-snap alignment on turf from the same OFF_FIELD_LAYOUTS
// the field/sim use, so the Playbook Builder shows the real personnel picture,
// not a stylization. slot.x is 0..1 across the width; slot.y is 0.5 at the LOS
// and grows into the backfield.
var _POS_CLASS = { WR: "fd-wr", SLOT: "fd-slot", TE: "fd-te", RB: "fd-rb", QB: "fd-qb", OL: "fd-ol" };
function _esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

// Draws a DEFENSIVE front's alignment on turf from DEF_FIELD_LAYOUTS — the
// mirror of renderFormationDiagram, for the Defensive Playbook. slot.y runs 0
// (deep safeties, top) to ~0.75 (D-line on the LOS, bottom).
var _DPOS_CLASS = { DE: "fd-dl", DT: "fd-dl", NT: "fd-dl", DL: "fd-dl", EDGE: "fd-dl", OLB: "fd-lb", ILB: "fd-lb", LB: "fd-lb", MLB: "fd-lb", CB: "fd-db", S: "fd-db", FS: "fd-db", SS: "fd-db", NB: "fd-db", DB: "fd-db" };
function renderFrontDiagram(front, opts) {
  const o = opts || {};
  const layout = DEF_FIELD_LAYOUTS[front];
  if (!layout) return "";
  const W = o.w || 160, H = o.h || 108;
  const padX = 12, topPad = 14, ySpan = H - 24;
  const sx = (x) => padX + x * (W - 2 * padX);
  const sy = (y) => topPad + y * ySpan;
  const losY = sy(0.82);
  const nodes = layout.slots.map((s) => {
    const x = sx(s.x), y = sy(s.y);
    const cls = _DPOS_CLASS[s.pos] || "fd-lb";
    return `<g><rect x="${_fmt(x - 9)}" y="${_fmt(y - 7)}" width="18" height="14" rx="3" class="fd-node ${cls}"/><text x="${_fmt(x)}" y="${_fmt(y + 3)}" class="fd-lbl">${_esc(s.label)}</text></g>`;
  }).join("");
  return `<svg class="formation-diagram front-diagram" viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${_esc(front)} defensive front">
    <rect x="0" y="0" width="${W}" height="${H}" class="play-card-turf"/>
    <line x1="0" y1="${_fmt(losY)}" x2="${W}" y2="${_fmt(losY)}" class="play-card-los"/>
    ${nodes}
  </svg>`;
}

// ── Defensive call cards (Defensive Playbook v2 — "The Answers") ───────────
// One picture per call: the front's real alignment (DEF_FIELD_LAYOUTS — the
// same table the sim resolves bodies from) + coverage zones (translucent,
// plain labels) + man lines (dashed to ghost receivers) + the rush (red
// arrows on a ghost QB; a dog = yellow; a fire-zone drop = a lineman bending
// back into a hook zone). art = { deep:'thirds'|'halves'|'quarters'|'mof'|null,
// man?, pole? }; bring = '3'|'4'|'5'|'6'; look = pressure identity id.
function renderDefCallCard(call, opts) {
  const o = opts || {};
  const W = o.w || 250, H = o.h || 170;
  const front = call.front || o.fallbackFront || "4-3";
  const layout = DEF_FIELD_LAYOUTS[front];
  if (!layout) return "";
  const art = o.art || { deep: null };
  const padX = 14, topPad = 8, ySpan = H - 46;
  const sx = (x) => padX + x * (W - 2 * padX);
  const sy = (y) => topPad + y * ySpan;
  const losY = sy(0.86);
  let svg = `<rect width="${W}" height="${H}" rx="0" class="play-card-turf"/>`;
  svg += `<line x1="0" y1="${_fmt(losY)}" x2="${W}" y2="${_fmt(losY)}" class="play-card-los"/>`;
  // coverage zones
  const zone = (x, y, w, h, label, cls) =>
    `<rect x="${_fmt(x)}" y="${_fmt(y)}" width="${_fmt(w)}" height="${_fmt(h)}" rx="8" class="dcz ${cls}"/>` +
    (label ? `<text x="${_fmt(x + w / 2)}" y="${_fmt(y + 11)}" text-anchor="middle" class="dcz-lbl">${_esc(label)}</text>` : "");
  const zTop = topPad + 1, zMid = sy(0.36), underH = sy(0.7) - zMid - 2;
  if (art.deep === "thirds") {
    for (let i = 0; i < 3; i++) svg += zone(5 + i * ((W - 10) / 3), zTop, (W - 10) / 3 - 3, zMid - zTop - 4, "DEEP ⅓", "dcz-deep");
    for (let i = 0; i < 4; i++) svg += zone(7 + i * ((W - 14) / 4), zMid, (W - 14) / 4 - 3, underH, i === 0 || i === 3 ? "FLAT" : "HOOK", "dcz-under");
  } else if (art.deep === "halves") {
    for (let i = 0; i < 2; i++) svg += zone(5 + i * ((W - 10) / 2), zTop, (W - 10) / 2 - 3, zMid - zTop - 4, "DEEP ½", "dcz-deep");
    if (!art.man) for (let i = 0; i < 4; i++) { if (art.pole && i === 1) continue; svg += zone(7 + i * ((W - 14) / 4), zMid + (art.pole ? 6 : 0), (W - 14) / 4 - 3, underH - (art.pole ? 6 : 0), i === 0 || i === 3 ? "FLAT" : "CURL", "dcz-under"); }
    if (art.pole) svg += zone(W / 2 - 16, zTop + 6, 32, sy(0.56) - zTop, "POLE", "dcz-deep");
  } else if (art.deep === "quarters") {
    for (let i = 0; i < 2; i++) svg += zone(5 + i * ((W - 10) / 4), zTop, (W - 10) / 4 - 3, zMid - zTop - 4, "¼", "dcz-deep");
    svg += zone(5 + 2 * ((W - 10) / 4), zTop, (W - 10) / 2 - 3, zMid - zTop - 4, "DEEP ½", "dcz-deep");
  } else if (art.deep === "mof") {
    svg += zone(W / 2 - 40, zTop, 80, zMid - zTop - 4, "FREE — MOF", "dcz-deep");
  }
  // man lines to ghost receivers
  if (art.man) {
    const ghosts = [0.08, 0.3, 0.7, 0.92];
    const dbs = layout.slots.filter((s) => /CB|NB|DB/.test(s.pos) || /CB|NB/.test(s.label)).slice(0, 4);
    dbs.forEach((s, i) => {
      const gx = sx(ghosts[i % ghosts.length]), gy = sy(0.03);
      svg += `<line x1="${_fmt(sx(s.x))}" y1="${_fmt(sy(s.y) - 7)}" x2="${_fmt(gx)}" y2="${_fmt(gy + 7)}" class="dc-man"/><circle cx="${_fmt(gx)}" cy="${_fmt(gy)}" r="3.6" class="dc-ghost"/>`;
    });
  }
  // ghost offense
  for (let i = -2; i <= 2; i++) svg += `<rect x="${_fmt(W / 2 + i * 14 - 3)}" y="${_fmt(losY + 5)}" width="6" height="6" rx="1.2" class="dc-ghost-ol"/>`;
  const qbX = W / 2, qbY = losY + 19;
  svg += `<rect x="${_fmt(qbX - 3.5)}" y="${_fmt(qbY - 3.5)}" width="7" height="7" rx="1.4" class="dc-ghost-ol" transform="rotate(45 ${_fmt(qbX)} ${_fmt(qbY)})"/>`;
  // the rush
  const arrow = (x1, y1, cls) => {
    const dx = qbX - x1, dy = qbY - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const ex = x1 + ux * (L - 9), ey = y1 + uy * (L - 9);
    return `<line x1="${_fmt(x1)}" y1="${_fmt(y1)}" x2="${_fmt(ex)}" y2="${_fmt(ey)}" class="${cls}"/><polygon points="${_fmt(ex + uy * 3.6 - ux * 2)},${_fmt(ey - ux * 3.6 - uy * 2)} ${_fmt(ex - uy * 3.6 - ux * 2)},${_fmt(ey + ux * 3.6 - uy * 2)} ${_fmt(ex + ux * 5.5)},${_fmt(ey + uy * 5.5)}" class="${cls}-head"/>`;
  };
  // #33 (graphic half): the arrow count IS the bring. Rushers resolve in
  // football order — the down linemen first, then the natural edge rushers
  // (the odd front's OLBs, the Penny's EDGEs — role Rush/Blitz), then the
  // second-level dogs — until exactly `bring` arrows are drawn. A bring BELOW
  // the line count bends the extra linemen back into coverage (the fire-zone
  // drop), one squiggle per dropped body. Before this, bring 4 on a 3-man
  // line drew 3 arrows and bring 5 drew dl+1 whatever the front — the card
  // and the call disagreed on every odd front.
  const dl = layout.slots.filter((s) => _DPOS_CLASS[s.pos] === "fd-dl");
  const lbs = layout.slots.filter((s) => _DPOS_CLASS[s.pos] === "fd-lb");
  const bring = Math.max(3, Math.min(6, parseInt(call.bring, 10) || 4));
  const edges = lbs.filter((s) => /Rush|Blitz/.test(String(s.role || "")));
  const dogs = lbs.filter((s) => edges.indexOf(s) === -1);
  // A light box can owe more arrows than it has backers (Dime bring 6): the
  // blitz-eligible DBs closest to the box fill out the pressure, same as the
  // sim's blitz-eligibility table says they do.
  const blitzIds = DEF_BLITZ_ELIGIBLE[front] || [];
  const dbs = layout.slots.filter((s) => _DPOS_CLASS[s.pos] === "fd-db" && blitzIds.indexOf(s.id) !== -1).sort((a, b) => b.y - a.y);
  const rushers = dl.slice(0, bring);
  const droppers = dl.slice(bring);
  const extra = rushers.length < bring ? edges.concat(dogs, dbs).slice(0, bring - rushers.length) : [];
  rushers.forEach((s) => { svg += arrow(sx(s.x), sy(s.y) + 6, "dc-rush"); });
  extra.forEach((s) => { svg += arrow(sx(s.x), sy(s.y) + 6, "dc-dog"); });
  droppers.forEach((dropper, di) => {
    const dSide = dropper.x >= 0.5 ? 1 : -1; // bend toward his own hook, in bounds
    svg += `<path d="M${_fmt(sx(dropper.x))} ${_fmt(sy(dropper.y) - 6)} C ${_fmt(sx(dropper.x) + dSide * 8)} ${_fmt(sy(dropper.y) - 24)}, ${_fmt(sx(dropper.x) + dSide * 20)} ${_fmt(sy(dropper.y) - 30)}, ${_fmt(sx(dropper.x) + dSide * 26)} ${_fmt(sy(dropper.y) - 38)}" class="dc-drop"/><circle cx="${_fmt(sx(dropper.x) + dSide * 28)}" cy="${_fmt(sy(dropper.y) - 40)}" r="2.8" class="dc-drop-dot"/>`;
  });
  if (call.runCommit != null && call.runCommit > 0) svg += `<text x="${_fmt(W / 2)}" y="${_fmt(losY - 4)}" text-anchor="middle" class="dc-box-lbl">▼ +${call.runCommit} IN THE BOX</text>`;
  // defenders on top
  for (const s of layout.slots) {
    const cls = _DPOS_CLASS[s.pos] || "fd-lb";
    svg += `<g><rect x="${_fmt(sx(s.x) - 9)}" y="${_fmt(sy(s.y) - 7)}" width="18" height="14" rx="3" class="fd-node ${cls}"/><text x="${_fmt(sx(s.x))}" y="${_fmt(sy(s.y) + 3)}" class="fd-lbl">${_esc(s.label)}</text></g>`;
  }
  return `<svg class="play-card-svg def-call-card" viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${_esc(call.name || "Defensive call")}">${svg}</svg>`;
}

// The catch-eligible receivers of a formation (for the composer's "who is this
// route for" picker), ordered left→right.
function formationReceivers(fid) {
  const layout = OFF_FIELD_LAYOUTS[aliasFormation(fid)] || OFF_FIELD_LAYOUTS[fid];
  if (!layout) return [];
  return layout.slots.filter((s) => s.pos !== "OL" && s.pos !== "QB")
    .sort((a, b) => a.x - b.x).map((s) => ({ id: s.id, label: s.label, pos: s.pos, x: s.x }));
}

// A formation variation has no hand-authored alignment, so derive one from its
// personnel package + its intent (trips/twins/empty/heavy/balanced): keep the
// base OL + QB, and re-lay the skill players to match the look. Gives each
// variation its OWN positioning without a 22-layout hand table.
function _buildSkillAlignment(nWR, nTE, nRB, nFB, shape) {
  const s = [];
  const wrLab = ["X", "Z", "SL", "FL", "H"], teLab = ["Y", "U", "W"];
  let wideXs;
  if (shape === "trips") wideXs = [0.06, 0.71, 0.81, 0.92, 0.2];
  else if (shape === "twins") wideXs = [0.06, 0.2, 0.84, 0.94, 0.3];
  else if (shape === "empty") wideXs = [0.05, 0.17, 0.29, 0.83, 0.95];
  else if (shape === "heavy") wideXs = [0.12, 0.88, 0.06, 0.94, 0.2];
  else wideXs = [0.06, 0.94, 0.2, 0.8, 0.5];
  for (let i = 0; i < nWR; i++) { const x = wideXs[i % wideXs.length]; const inside = x > 0.12 && x < 0.88; s.push({ id: "vWR" + i, pos: inside ? "SLOT" : "WR", label: wrLab[i] || "W", x, y: inside ? 0.56 : 0.5 }); }
  const teXs = (shape === "heavy" || shape === "empty") ? [0.22, 0.78, 0.86] : [0.78, 0.22, 0.86];
  for (let i = 0; i < nTE; i++) { const x = teXs[i % teXs.length]; s.push({ id: "vTE" + i, pos: "TE", label: teLab[i] || "T", x, y: x > 0.84 ? 0.56 : 0.5 }); }
  if (shape === "empty") {
    // EMPTY means an empty BACKFIELD, not an empty personnel grouping — the
    // back(s) split out as receivers (real 11-personnel Empty). Drawing the HB
    // next to the QB in an "Empty" look was the owner-caught geometry bug.
    let slotX = [0.41, 0.59, 0.71];
    let k = 0;
    if (nFB) s.push({ id: "vFB", pos: "SLOT", label: "FB", x: slotX[k++ % slotX.length], y: 0.56 });
    for (let i = 0; i < nRB; i++) s.push({ id: "vRB" + i, pos: "SLOT", label: nRB > 1 ? "H" : "HB", x: slotX[k++ % slotX.length], y: 0.56 });
    return s;
  }
  if (nFB) s.push({ id: "vFB", pos: "RB", label: "FB", x: 0.5, y: 0.74 });
  for (let i = 0; i < nRB; i++) s.push({ id: "vRB" + i, pos: "RB", label: nRB > 1 ? "H" : "HB", x: nRB > 1 ? (i ? 0.6 : 0.4) : 0.5, y: 0.87 });
  return s;
}
function _variationLayout(fid, varKey) {
  const base = OFF_FIELD_LAYOUTS[aliasFormation(fid)] || OFF_FIELD_LAYOUTS[fid];
  if (!base || !varKey) return base;
  const vset = FORMATION_VARIATIONS[aliasFormation(fid)];
  const vd = vset && vset[varKey];
  if (!vd) return base;
  // Stage 6: the AUTHORED alignment wins. The variation's `layout:` pointer
  // resolves through VARIATION_LAYOUTS (constants_field.js) — the same rows
  // the live watch board fields — so the diagram IS the alignment, not a
  // projection. The personnel-derived heuristic below survives only as the
  // fallback for a variation with no authored row.
  const authored = variationLayoutSlots(base.slots, vd.layout);
  if (authored) return { slots: authored };
  const pkg = { ...(FORMATION_PACKAGES[aliasFormation(fid)] || {}), ...(vd.pkg || {}) };
  const key = (varKey + " " + (vd.label || "")).toLowerCase();
  const shape = /trip|open|wide/.test(key) ? "trips" : /twin|split/.test(key) ? "twins" : /empt|trey/.test(key) ? "empty" : /big|heav|tight|closed|goal|tackle|unbal|slash/.test(key) ? "heavy" : "balanced";
  const skill = _buildSkillAlignment(pkg.WR || 0, pkg.TE || 0, pkg.RB || 0, pkg.FB || 0, shape);
  const olQb = base.slots.filter((s) => s.pos === "OL" || s.pos === "QB");
  return { slots: skill.concat(olQb) };
}

function renderFormationDiagram(fid, opts) {
  const o = opts || {};
  // Stage 7: o.slots draws an arbitrary layout row (the Formation Designer's
  // live preview of a not-yet-registered formation) — "the art comes free".
  const layout = o.slots ? { slots: o.slots } : o.variation ? _variationLayout(fid, o.variation) : (OFF_FIELD_LAYOUTS[aliasFormation(fid)] || OFF_FIELD_LAYOUTS[fid]);
  if (!layout) return "";
  const W = o.w || 180, H = o.h || 116;
  // Vertical scale adapts to the box (2026-08-15): the old fixed topPad 22 /
  // yScale 172 was tuned for 180×116, so every smaller card — the Builder's
  // 118×74 look cards, 120×76 list thumbnails, the 130×84 preview header —
  // clipped the backfield (QB/RB/FB drawn below the viewBox). Scale from the
  // layout's actual deepest man so the whole formation always fits.
  const padX = 12;
  const maxY = Math.max(0.9, ...layout.slots.map((s) => s.y != null ? s.y : 0.5));
  const topPad = Math.min(22, Math.round(H * 0.19));
  const yScale = (H - topPad - 12) / Math.max(0.3, maxY - 0.46);
  const sx = (x) => padX + x * (W - 2 * padX);
  const sy = (y) => topPad + (y - 0.46) * yScale;
  const losY = sy(0.5);
  const nodes = layout.slots.map((s) => {
    const x = sx(s.x), y = sy(s.y);
    if (s.pos === "OL") return `<rect x="${_fmt(x - 3.5)}" y="${_fmt(y - 3.5)}" width="7" height="7" rx="1.4" class="fd-ol"/>`;
    if (s.pos === "RB") return `<circle cx="${_fmt(x)}" cy="${_fmt(y)}" r="7" class="fd-node fd-rb"/><text x="${_fmt(x)}" y="${_fmt(y + 3)}" class="fd-lbl">${_esc(s.label)}</text>`;
    if (s.pos === "QB") return `<rect x="${_fmt(x - 7)}" y="${_fmt(y - 7)}" width="14" height="14" rx="3" class="fd-node fd-qb"/><text x="${_fmt(x)}" y="${_fmt(y + 3)}" class="fd-lbl">${_esc(s.label)}</text>`;
    const cls = _POS_CLASS[s.pos] || "fd-wr";
    return `<g><rect x="${_fmt(x - 9)}" y="${_fmt(y - 7)}" width="18" height="14" rx="3" class="fd-node ${cls}"/><text x="${_fmt(x)}" y="${_fmt(y + 3)}" class="fd-lbl">${_esc(s.label)}</text></g>`;
  }).join("");
  return `<svg class="formation-diagram" viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${_esc(fid)} formation">
    <rect x="0" y="0" width="${W}" height="${H}" class="play-card-turf"/>
    <line x1="0" y1="${_fmt(losY)}" x2="${W}" y2="${_fmt(losY)}" class="play-card-los"/>
    ${nodes}
  </svg>`;
}

// ── Concept art — named plays get diagrams too ─────────────────────────────
// The Playbook Builder deals in NAMED concepts (Mesh, Four Verts, Power…), not
// composed route parts. This maps the marquee passing concepts to a
// representative route combo (drawn with the same primitive) and classifies the
// rest as run/pass so every play in the book can show a thumbnail. The combos
// are illustrative, not the sim's exact assignments — enough to recognize the
// concept at a glance, in keeping with the "vague about the numbers" help rule.
var CONCEPT_ROUTES = {
  "Four Verts": ["go", "go", "go", "go"], "Mesh": ["drag", "drag", "corner", "flat"],
  "Shallow Cross": ["drag", "dig", "go"], "Smash": ["corner", "curl"],
  "Seam-Read Smash": ["corner", "curl", "go"], "Flood": ["go", "out", "flat"],
  "Sail": ["go", "corner", "flat"], "Curl-Flat": ["curl", "flat"],
  "Stick": ["out", "curl", "flat"], "Slant-Flat": ["slant", "flat"],
  "Double Slants": ["slant", "slant"], "Y-Cross": ["drag", "post", "curl"],
  "Dagger": ["go", "dig"], "Yankee": ["post", "drag"], "Mills (Post-Dig)": ["post", "dig"],
  "Post-Wheel": ["post", "wheel"], "Corner-Post": ["corner", "post"],
  "Scissors": ["post", "corner"], "Levels": ["dig", "dig", "flat"],
  "Drive": ["drag", "dig"], "Spacing": ["curl", "curl", "flat"],
  "Spot": ["corner", "curl", "flat"], "Hoss": ["go", "curl"], "Bench": ["out", "corner"],
  "Deep Out": ["deepout", "checkdown"], "Comeback": ["comeback", "checkdown"],
  "Deep Over": ["drag", "post"], "Skinny Post": ["post", "checkdown"],
  "Whip": ["slant", "flat"], "Follow": ["drag", "dig"], "Y-Option": ["curl", "flat"],
  "Stick-Nod": ["corner", "flat"], "Sluggo Seam": ["go", "go"],
  // Red-Zone Fade (#19, hand-reviewed vs concepts.js): ONE isolated
  // back-shoulder fade to the outside man — the concept is a single jump-ball
  // route, so nothing else is authored (the faint auto-fill keeps the picture
  // honest). Was ["go","slant"], which read as a deep shot + slant combo.
  "Red-Zone Fade": ["fade"], "Bubble Screen": ["bubble", "go"],
  "Tunnel Screen": ["tunnel", "go"], "Slip Screen": ["screen"],
  "RB Screen": ["screen"], "Boot": ["drag", "corner", "flat"],
  "PA Deep Cross": ["drag", "post"], "HB Pass": ["go", "post"], "Flea Flicker": ["go", "post"]
};
// A run's IDENTITY drives its diagram — the gap it hits, whether it stretches to
// the edge, pulls a lineman, leads with a back, pitches, or motions. Ordered
// most-specific first.
var RUN_SIGNATURES = [
  [/triple option/i, "triple"], [/speed option|\boption\b/i, "option"], [/jet/i, "jet"],
  [/reverse/i, "reverse"], [/toss|pitch/i, "toss"], [/sweep|pin-and-pull|buck/i, "sweep"],
  [/counter/i, "counter"], [/qb power/i, "qbpower"], [/\bpower\b|\bdart\b|wildcat/i, "power"],
  [/trap|wham/i, "trap"], [/draw/i, "draw"], [/iso|dive|sneak/i, "dive"],
  [/outside zone|split-zone|stretch/i, "outside"], [/inside zone|\bzone\b/i, "inside"]
];
function conceptKind(name) {
  if (CONCEPT_ROUTES[name]) return { kind: "pass", parts: CONCEPT_ROUTES[name] };
  for (const [re, t] of RUN_SIGNATURES) if (re.test(name)) return { kind: "run", rtype: t };
  return { kind: "pass", parts: ["curl", "flat"] };  // generic dropback
}
var _RUN_PARAM = {
  inside: { gap: 0.10 }, outside: { gap: 0.30, stretch: 0.22 },
  power: { gap: 0.22, pull: true }, counter: { gap: 0.22, pull: true, counter: true },
  trap: { gap: 0.08, pull: true }, draw: { gap: 0.10, delay: true }, dive: { gap: 0.05, lead: true },
  sweep: { gap: 0.34, stretch: 0.28, pull: true }, toss: { gap: 0.36, stretch: 0.30, pitch: true },
  jet: { gap: 0.38, stretch: 0.30, jet: true }, reverse: { gap: -0.34, stretch: 0.30, jet: true },
  option: { gap: 0.28, pitch: true, qb: true }, triple: { gap: 0.26, pitch: true, qb: true },
  qbpower: { gap: 0.18, qb: true, pull: true }
};
// A run diagram tailored to the concept: the ball-carrier's path to his gap
// (with a stretch, delay, or counter step where the concept calls for it) plus
// the signature block — a pulling lineman, a lead back, a pitch man, or jet
// motion. Distinct per run type so Power ≠ Sweep ≠ Draw ≠ Counter at a glance.
function renderRunCard(rtype, opts) {
  const o = opts || {}, W = o.w || 260, H = o.h || 170;
  const losY = H * 0.5, cx = W / 2, side = 1;
  const p = _RUN_PARAM[rtype] || _RUN_PARAM.inside;
  const gapX = cx + side * p.gap * W;
  const qbY = losY + H * 0.12;
  const runnerIsQB = !!p.qb;
  const startX = runnerIsQB ? cx : cx - side * 0.10 * W;
  const startY = runnerIsQB ? qbY : losY + H * 0.28;
  const top = H * 0.12;
  let d;
  if (p.delay) d = `M${_fmt(startX)} ${_fmt(startY)} C ${_fmt(startX)} ${_fmt(startY + 8)}, ${_fmt(gapX)} ${_fmt(losY + 14)}, ${_fmt(gapX)} ${_fmt(losY - 6)} L ${_fmt(gapX)} ${_fmt(top)}`;
  else if (p.counter) { const cxo = cx - side * 0.14 * W; d = `M${_fmt(startX)} ${_fmt(startY)} C ${_fmt(cxo)} ${_fmt(startY - 4)}, ${_fmt(cxo)} ${_fmt(losY + 10)}, ${_fmt(gapX)} ${_fmt(losY - 6)} L ${_fmt(gapX)} ${_fmt(top)}`; }
  else if (p.stretch) { const ex = cx + (rtype === "reverse" ? -side : side) * p.stretch * W; d = `M${_fmt(startX)} ${_fmt(startY)} C ${_fmt(startX)} ${_fmt(startY - 6)}, ${_fmt(ex)} ${_fmt(losY + 16)}, ${_fmt(gapX)} ${_fmt(losY - 4)} L ${_fmt(gapX)} ${_fmt(top)}`; }
  else d = `M${_fmt(startX)} ${_fmt(startY)} C ${_fmt(startX)} ${_fmt(startY - 10)}, ${_fmt((cx + gapX) / 2)} ${_fmt(losY + 6)}, ${_fmt(gapX)} ${_fmt(losY - 8)} L ${_fmt(gapX)} ${_fmt(top)}`;
  const arrow = `<polygon points="${_fmt(gapX - 5)},${_fmt(top + 6)} ${_fmt(gapX + 5)},${_fmt(top + 6)} ${_fmt(gapX)},${_fmt(top - 4)}" class="run-card-arrow"/>`;
  let extras = "";
  if (p.pull) { const g0x = cx - side * 15, g1x = gapX - side * 8; extras += `<path d="M${_fmt(g0x)} ${_fmt(losY)} C ${_fmt(g0x)} ${_fmt(losY + 11)}, ${_fmt(g1x)} ${_fmt(losY + 9)}, ${_fmt(g1x)} ${_fmt(losY - 2)}" class="run-card-pull"/>`; }
  if (p.lead) extras += `<path d="M${_fmt(cx)} ${_fmt(losY + H * 0.22)} L ${_fmt(gapX - side * 4)} ${_fmt(losY - 4)}" class="run-card-lead"/>`;
  if (p.pitch) { const pbx = cx + side * 0.22 * W, pby = losY + H * 0.30; extras += `<line x1="${_fmt(cx)}" y1="${_fmt(qbY)}" x2="${_fmt(pbx)}" y2="${_fmt(pby)}" class="run-card-pitch"/><circle cx="${_fmt(pbx)}" cy="${_fmt(pby)}" r="4" class="play-card-rec"/>`; }
  if (p.jet) { const wx = cx - (rtype === "reverse" ? -side : side) * 0.42 * W; extras += `<line x1="${_fmt(wx)}" y1="${_fmt(losY - H * 0.06)}" x2="${_fmt(cx)}" y2="${_fmt(losY + H * 0.22)}" class="run-card-motion"/>`; }
  const olXs = [-30, -15, 0, 15, 30];
  const line = olXs.map((dx) => `<rect x="${_fmt(cx + dx - 4)}" y="${_fmt(losY - 4)}" width="8" height="8" rx="1.5" class="play-card-ol"/>`).join("");
  const backMark = runnerIsQB ? "" : `<circle cx="${_fmt(startX)}" cy="${_fmt(startY)}" r="4" class="play-card-rec"/>`;
  return `<svg class="play-card-svg" viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${_esc(rtype)} run diagram">
    <rect x="0" y="0" width="${W}" height="${H}" class="play-card-turf"/>
    ${_fieldLines(W, H, losY)}
    ${line}${extras}
    <path d="${d}" class="run-card-path"/>
    ${arrow}
    <rect x="${_fmt(cx - 4)}" y="${_fmt(qbY - 4)}" width="8" height="8" rx="1.5" class="play-card-qb"/>
    ${backMark}
  </svg>`;
}
// Unified: a thumbnail for any named concept (pass card or run diagram).
function renderConceptThumb(name, opts) {
  const k = conceptKind(name);
  return k.kind === "run" ? renderRunCard(k.rtype, opts) : renderPlayCard(k.parts, opts);
}

export { ROUTE_ART, routePathD, routeEnd, routeColor, routeGlyph, renderPlayCard, renderFormationDiagram, renderFrontDiagram, renderDefCallCard, formationReceivers, CONCEPT_ROUTES, conceptKind, renderConceptThumb, resolveComposedReceivers };
