import { __spreadValues } from './_spread.js';

function randNorm(mean, sd) {
  const u1 = Math.random(), u2 = Math.random();
  return mean + Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * sd;
}
function clamp2(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function logistic(x) {
  return 1 / (1 + Math.exp(-x));
}
function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : r & 3 | 8).toString(16);
  });
}
function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt3(lo, hi) {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt3(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function recruitDistance(recruit, school) {
  const h = recruit == null ? void 0 : recruit.hometown;
  if (!h || h.lat == null || (school == null ? void 0 : school.lat) == null) return 9999;
  return Math.round(distanceMiles(school.lat, school.lng, h.lat, h.lng));
}
function distanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function randomName() {
  return { first: rand(FIRST_NAMES), last: rand(LAST_NAMES) };
}
function fullName(p) {
  return `${p.name.first} ${p.name.last}`;
}
function randomLocation() {
  let roll = Math.random() * LOCATIONS_TOTAL_W;
  for (const l of LOCATIONS) {
    roll -= l.w || 1;
    if (roll <= 0) return __spreadValues({}, l);
  }
  return __spreadValues({}, LOCATIONS[LOCATIONS.length - 1]);
}
function fmtMoney(v) {
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}k`;
  return `$${v}`;
}
function fmtRecord(w, l) {
  return `${w}-${l}`;
}
function ratingColor(r) {
  if (r >= 80) return "rating-elite";
  if (r >= 65) return "rating-good";
  if (r >= 50) return "rating-avg";
  if (r >= 35) return "rating-poor";
  return "rating-bad";
}
function archetypeLabel(arch) {
  return {
    // Legacy labels (pre-§6.5 position model; kept harmless, unreachable now)
    "LB-Inside": "ILB",
    "LB-Edge": "RUSH",
    "DL-3tech": "3T",
    "DL-NT": "NT",
    "DL-Edge": "DE",
    "DB-Press": "PRS",
    "DB-Zone": "ZONE",
    // QB
    "QB-Pocket": "POCKET",
    "QB-Dual": "DUAL",
    "QB-Gunslinger": "GUN",
    "QB-Game-Manager": "MGR",
    "QB-Scrambler": "SCRM",
    // RB
    "RB-Power": "POWER",
    "RB-Scat": "SCAT",
    "RB-Elusive": "AGI",
    "RB-Workhorse": "WORK",
    "RB-Speed": "SPD",
    // WR
    "WR-Deep": "DEEP",
    "WR-Poss": "POSS",
    "WR-Slot": "SLOT",
    "WR-Physical": "PHYS",
    // TE
    "TE-Receiving": "RECV",
    "TE-Blocking": "BLOCK",
    "TE-Hybrid": "HYB",
    "TE-Move": "MOVE",
    // OL
    "OL-Mauler": "MAUL",
    "OL-PassPro": "PASS",
    "OL-Balanced": "BAL",
    "OL-Athletic": "ATH",
    // OL position-fit grades (T / IOL / C)
    "OL-T": "TACKLE",
    "OL-IOL": "INTERIOR",
    "OL-C": "CENTER",
    // FB
    "FB-Lead": "LEAD",
    "FB-HBack": "HBACK",
    "FB-Hybrid": "HYB",
    // K / P
    "K-Accuracy": "ACC",
    "K-Power": "POWER",
    "K-Balanced": "BAL",
    "P-Directional": "DIR",
    "P-Distance": "DIST",
    "P-Balanced": "BAL",
    // DE / OLB
    "DE-Speed": "SPD",
    "DE-Power": "POWER",
    "DE-Base": "BASE",
    "OLB-Rush": "RUSH",
    "OLB-Cover": "COVER",
    "OLB-Blitz": "BLITZ",
    // DT
    "DT-3tech": "3T",
    "DT-NT": "NT",
    "DT-Balanced": "BAL",
    "DT-Quick": "QUICK",
    // LB
    "LB-Thumper": "THMP",
    "LB-Cover": "COV",
    "LB-Hybrid": "HYB",
    "LB-Blitzer": "BLTZ",
    "LB-Sideline": "RANGE",
    // CB
    "CB-Press": "PRESS",
    "CB-Slot": "SLOT",
    "CB-Zone": "ZONE",
    "CB-Ball": "BALL",
    "CB-Nickel": "NICKEL",
    // S
    "S-Free": "FREE",
    "S-Strong": "STRONG",
    "S-Ball": "BALL",
    "S-Hybrid": "HYB",
    "S-Nickel": "NKL"
  }[arch] || "";
}
function crestHash(school) {
  let h = 2166136261;
  const seedPart = (school == null ? void 0 : school.crestSeed) ? `|${school.crestSeed}` : "";
  const key = String(`${(school == null ? void 0 : school.name) || "School"}|${(school == null ? void 0 : school.abbr) || ""}${seedPart}`);
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function crestXmlSafe(value) {
  return String(value || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function crestColor(value, fallback) {
  const color = String(value || "");
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}
function crestLuma(hex) {
  const value = crestColor(hex, "#303030").slice(1);
  const r = parseInt(value.slice(0, 2), 16), g = parseInt(value.slice(2, 4), 16), b = parseInt(value.slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
function crestLetters(school) {
  const abbreviation = String((school == null ? void 0 : school.abbr) || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
  if (abbreviation) return abbreviation;
  const words = String((school == null ? void 0 : school.name) || "School").toUpperCase().match(/[A-Z0-9]+/g) || ["S"];
  const meaningful = words.filter((word) => !["OF", "THE", "UNIVERSITY", "COLLEGE"].includes(word));
  return (meaningful.length ? meaningful : words).map((word) => word[0]).join("").slice(0, 3) || "S";
}
function letterFrame(frame, primary, secondary, edge2) {
  if (frame === 1) return {
    outer: `<circle cx="32" cy="32" r="31" fill="${edge2}"/>`,
    middle: `<circle cx="32" cy="32" r="29" fill="${secondary}"/>`,
    inner: `<circle cx="32" cy="32" r="25.5" fill="${primary}"/>`,
    clip: `<circle cx="32" cy="32" r="25.5"/>`
  };
  if (frame === 2) return {
    outer: `<path d="M32 1 62 18v27L32 63 2 45V18Z" fill="${edge2}"/>`,
    middle: `<path d="M32 3.5 59.5 19v24.5L32 60.5 4.5 43.5V19Z" fill="${secondary}"/>`,
    inner: `<path d="M32 7 56 21v20L32 57 8 41V21Z" fill="${primary}"/>`,
    clip: `<path d="M32 7 56 21v20L32 57 8 41V21Z"/>`
  };
  if (frame === 3) return {
    outer: `<path d="M4 3h56v29c0 16-11 25-28 31C15 57 4 48 4 32Z" fill="${edge2}"/>`,
    middle: `<path d="M6.5 5.5h51v26c0 14-9.5 22-25.5 28C16 53.5 6.5 45.5 6.5 31.5Z" fill="${secondary}"/>`,
    inner: `<path d="M10 9h44v22c0 11.5-8 18.5-22 24C18 49.5 10 42.5 10 31Z" fill="${primary}"/>`,
    clip: `<path d="M10 9h44v22c0 11.5-8 18.5-22 24C18 49.5 10 42.5 10 31Z"/>`
  };
  if (frame === 4) return {
    outer: `<path d="M32 1 63 32 32 63 1 32Z" fill="${edge2}"/>`,
    middle: `<path d="M32 4.5 59.5 32 32 59.5 4.5 32Z" fill="${secondary}"/>`,
    inner: `<path d="M32 9 55 32 32 55 9 32Z" fill="${primary}"/>`,
    clip: `<path d="M32 9 55 32 32 55 9 32Z"/>`
  };
  return {
    outer: `<rect x="1" y="1" width="62" height="62" rx="5" fill="${edge2}"/>`,
    middle: `<rect x="3.5" y="3.5" width="57" height="57" rx="3.5" fill="${secondary}"/>`,
    inner: `<rect x="7" y="7" width="50" height="50" rx="1.5" fill="${primary}"/>`,
    clip: `<rect x="7" y="7" width="50" height="50" rx="1.5"/>`
  };
}
function letterFieldPattern(pattern, secondary) {
  if (pattern === 1) return `<rect x="27" y="3" width="10" height="58" fill="${secondary}" opacity=".22"/>`;
  if (pattern === 2) return `<rect x="3" y="25" width="58" height="14" fill="${secondary}" opacity=".22"/>`;
  if (pattern === 3) return `<path d="M-8 49 49-8h17L9 66H-8Z" fill="${secondary}" opacity=".2"/>`;
  if (pattern === 4) return `<path d="M3 3h19v8H11v11H3zm58 0v19h-8V11H42V3zM3 61V42h8v11h11v8zm58 0H42v-8h11V42h8z" fill="${secondary}" opacity=".28"/>`;
  return "";
}
function pixelLetterMark(letters, fill, shadow) {
  const count = letters.length;
  const units = count * 3 + Math.max(0, count - 1);
  const cell = count === 1 ? 8 : count === 2 ? 6 : 4.4;
  const width = units * cell;
  const x0 = (64 - width) / 2;
  const y0 = (64 - 5 * cell) / 2;
  let shadows = "", pixels = "";
  for (let i = 0; i < count; i++) {
    const glyph = LETTER_PIXEL_FONT[letters[i]] || LETTER_PIXEL_FONT.X;
    for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (glyph[y][x] === "1") {
      const px = x0 + (i * 4 + x) * cell, py = y0 + y * cell;
      shadows += `<rect x="${(px + 1.4).toFixed(1)}" y="${(py + 1.4).toFixed(1)}" width="${cell.toFixed(1)}" height="${cell.toFixed(1)}" fill="${shadow}"/>`;
      pixels += `<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${cell.toFixed(1)}" height="${cell.toFixed(1)}" fill="${fill}"/>`;
    }
  }
  return `<g class="crest-letter-pixel">${shadows}${pixels}</g>`;
}
function typeText(letters, fontIndex, fill, outline, extra = "") {
  const size = letters.length === 1 ? 40 : letters.length === 2 ? 32 : 24;
  return `<text x="32" y="41" text-anchor="middle" font-family="${LETTER_FONTS[fontIndex]}" font-size="${size}" font-weight="900" letter-spacing="${letters.length === 3 ? "1" : "0"}" fill="${fill}" stroke="${outline}" stroke-width="2.4" paint-order="stroke fill" ${extra}>${crestXmlSafe(letters)}</text>`;
}
function letterTypography(letters, style, fill, outline, primary) {
  if (style === 5) return pixelLetterMark(letters, fill, outline);
  if (style === 4 && letters.length > 1) {
    const top = letters.length === 3 ? letters.slice(0, 2) : letters[0];
    const bottom = letters.length === 3 ? letters[2] : letters[1];
    return `<g class="crest-letter-stack">
    <text x="32" y="31" text-anchor="middle" font-family="${LETTER_FONTS[1]}" font-size="${top.length === 2 ? 25 : 28}" font-weight="900" fill="${fill}" stroke="${outline}" stroke-width="2" paint-order="stroke fill">${crestXmlSafe(top)}</text>
    <text x="32" y="53" text-anchor="middle" font-family="${LETTER_FONTS[2]}" font-size="23" font-weight="900" fill="${fill}" stroke="${outline}" stroke-width="2" paint-order="stroke fill">${crestXmlSafe(bottom)}</text>
  </g>`;
  }
  if (style === 6) {
    const size = letters.length === 1 ? 40 : letters.length === 2 ? 32 : 24;
    return `<text x="32" y="41" text-anchor="middle" font-family="${LETTER_FONTS[0]}" font-size="${size}" font-style="italic" font-weight="900" letter-spacing="1" fill="${primary}" stroke="${fill}" stroke-width="5" paint-order="stroke fill">${crestXmlSafe(letters)}</text>
    <text x="32" y="41" text-anchor="middle" font-family="${LETTER_FONTS[0]}" font-size="${size}" font-style="italic" font-weight="900" letter-spacing="1" fill="${primary}" stroke="${outline}" stroke-width="1.2" paint-order="stroke fill">${crestXmlSafe(letters)}</text>`;
  }
  if (style === 7) {
    const first = letters[0], fullSize = letters.length === 3 ? 13 : 15;
    return `<text x="32" y="39" text-anchor="middle" font-family="${LETTER_FONTS[3]}" font-size="40" font-weight="900" fill="${fill}" stroke="${outline}" stroke-width="2.3" paint-order="stroke fill">${crestXmlSafe(first)}</text>
    <rect x="12" y="43" width="40" height="12" fill="${outline}" opacity=".94"/>
    <text x="32" y="52" text-anchor="middle" font-family="${LETTER_FONTS[1]}" font-size="${fullSize}" font-weight="900" letter-spacing="1.4" fill="${fill}">${crestXmlSafe(letters)}</text>`;
  }
  if (style === 3) return typeText(letters, 3, fill, outline, 'font-style="italic"');
  if (style === 2) return `<g transform="skewX(-8)">${typeText(letters, 0, fill, outline).replace('x="32"', 'x="36"')}</g>`;
  return typeText(letters, style === 1 ? 2 : 1, fill, outline);
}
function renderCrest(school, size = 40) {
  var _a, _b;
  const primary = crestColor((_a = school == null ? void 0 : school.colors) == null ? void 0 : _a[0], "#315cc7");
  const secondary = crestColor((_b = school == null ? void 0 : school.colors) == null ? void 0 : _b[1], "#f4f0d8");
  const h = crestHash(school);
  const frame = h % 5;
  const style = (h >>> 4) % 8;
  const pattern = (h >>> 8) % 5;
  const letters = crestLetters(school);
  const contrastFallback = crestLuma(primary) > 0.52 ? "#05070c" : "#f4f0d8";
  const letterFill = Math.abs(crestLuma(primary) - crestLuma(secondary)) > 0.27 ? secondary : contrastFallback;
  const letterOutline = crestLuma(letterFill) > 0.55 ? "#05070c" : "#f4f0d8";
  const edge2 = "#05070c";
  const parts = letterFrame(frame, primary, secondary, edge2);
  const clipId = `crest-clip-${h.toString(36)}-${frame}`;
  const label = crestXmlSafe(`${(school == null ? void 0 : school.name) || "School"} ${letters} letter logo`);
  const shell = (inner) => `<svg class="crest crest-letter crest-frame-${frame} crest-type-${style}" data-letter-mark="${crestXmlSafe(letters)}" data-crest-frame="${frame}" data-crest-style="${style}" width="${size}" height="${size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">${inner}</svg>`;
  const base = `<defs><clipPath id="${clipId}">${parts.clip}</clipPath></defs>${parts.outer}${parts.middle}${parts.inner}`;
  if (school == null ? void 0 : school.crestImg) {
    return shell(base + `<image href="${school.crestImg}" x="6" y="6" width="52" height="52" preserveAspectRatio="xMidYMid meet" clip-path="url(#${clipId})" style="image-rendering:auto"/>`);
  }
  return shell(base + `<g clip-path="url(#${clipId})">${letterFieldPattern(pattern, secondary)}</g>` + letterTypography(letters, style, letterFill, letterOutline, primary));
}
function portraitHash(player) {
  var _a, _b;
  const key = String((player == null ? void 0 : player.id) || `${((_a = player == null ? void 0 : player.name) == null ? void 0 : _a.first) || ""}-${((_b = player == null ? void 0 : player.name) == null ? void 0 : _b.last) || ""}-${(player == null ? void 0 : player.position) || ""}`);
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function portraitColor(value, fallback) {
  const color = String(value || "");
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}
// ── PAINTED PORTRAITS (Aug 2026, owner ask: "realistic profile pictures") ────
// Replaces the 8-bit pixel faces with a painted-style layered-SVG portrait —
// FM/2K-regen fidelity, zero assets, deterministic per player (the face never
// changes), driven by REAL identity data: weight+height shape the jaw/neck/
// shoulders, class year matures the face and grows the facial-hair odds,
// school colors dress the jersey. `__noPortraits2` restores the pixel faces.
// True photo-realism is architecturally impossible here (procedurally
// generated players, offline single-file bundle) — this is the honest ceiling.
const PP2_SKINS = [
  // [base, shadow, light] — a wide, realistic tone range
  ["#8d5524", "#6b3d16", "#a96a35"], ["#a5683a", "#7d4b26", "#bd8050"],
  ["#6f4423", "#523016", "#8a5a31"], ["#c68642", "#9c6430", "#dda05c"],
  ["#5d3a1f", "#432a15", "#754c2a"], ["#b97b4e", "#8f5a36", "#d29465"],
  ["#e0ac69", "#b98850", "#f0c688"], ["#f1c27d", "#cfa05e", "#fbd99e"],
  ["#ffdbac", "#dcb488", "#ffe9c7"], ["#4a2f19", "#341f0f", "#5f3f24"]
];
const PP2_HAIRC = [
  ["#17110d", "#2a201a"], ["#241812", "#3a281e"], ["#33221a", "#4a3527"],
  ["#4a2f1d", "#63432c"], ["#6b4a26", "#87643a"], ["#8a6b3a", "#a98a52"],
  ["#7a3b1e", "#94512e"]
];
function _pp2Rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s ^ s >>> 15, 2246822519) + 374761393 >>> 0;
    return ((s ^ s >>> 13) >>> 0) / 4294967296;
  };
}
function renderPlayerPortrait(player, school = null, size = "lg") {
  var _pa, _pb;
  if (globalThis.__noPortraits2) return renderPlayerPortraitLegacy(player, school, size);
  const seed = portraitHash(player);
  const R = _pp2Rng(seed);
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const between = (a, b) => a + R() * (b - a);
  const pos = String((player == null ? void 0 : player.position) || "ATH").toUpperCase();
  const jerseyFallback = PORTRAIT_POSITION_COLORS[pos] || "#315cc7";
  const jersey = portraitColor((_pa = school == null ? void 0 : school.colors) == null ? void 0 : _pa[0], jerseyFallback);
  const accent = portraitColor((_pb = school == null ? void 0 : school.colors) == null ? void 0 : _pb[1], "#f4f0d8");
  // identity → geometry
  const skinIx = Math.floor(R() * PP2_SKINS.length);
  const [skin, skinSh, skinHi] = PP2_SKINS[skinIx];
  const hairIx = skinIx >= 6 ? Math.floor(R() * PP2_HAIRC.length) : Math.floor(R() * 4);
  const [hairC, hairHi] = PP2_HAIRC[hairIx];
  const wt = (player == null ? void 0 : player.weight) || 210;
  const bulk = Math.max(0, Math.min(1, (wt - 175) / 145));
  const ageIx = { FR: 0, SO: 1, JR: 2, SR: 3 }[player == null ? void 0 : player.classYear] || 0;
  const faceW = 18.5 + bulk * 5.5 + between(-0.9, 0.9);
  const jawW = faceW * (0.72 + bulk * 0.16 + ageIx * 0.015);
  const chinY = 64 + between(-1.5, 1.5) + bulk * 1.2;
  const neckW = 13.5 + bulk * 8;
  const shW = 39 + bulk * 10;
  const eyeDx = faceW * between(0.42, 0.5);
  const eyeY = 44 + between(-1, 1);
  const eyeW = between(4.8, 6), eyeH = between(1.9, 2.6);
  const browTilt = between(-1.6, 0.6);
  const browDrop = between(2.6, 4.2);
  const noseW = between(4, 6) + bulk * 0.7;
  const noseY = 53.5 + between(-0.8, 0.8);
  const mouthW = between(6.5, 9);
  const mouthY = chinY - between(7, 8.5);
  const smile = R() < 0.3 ? 1.2 : R() < 0.55 ? 0 : -0.8;
  const hairStyle = pick([0, 1, 2, 3, 4, 5, 6, 7, 1, 2, 3]);
  const fhRoll = R() + ageIx * 0.12;
  const facial = fhRoll < 0.45 ? 0 : fhRoll < 0.7 ? 1 : fhRoll < 0.85 ? 2 : fhRoll < 0.95 ? 3 : 4;
  const irisC = skinIx >= 6 && R() < 0.4 ? "#5c4a2f" : "#2b1d12";
  const u = `pp${seed.toString(36)}`;
  const cx = 48, headTop = chinY - 43;
  // hair paths by style (0 crop · 1 fade · 2 curls · 3 buzz · 4 afro · 5 twists · 6 flow · 7 bald)
  const hairTopY = headTop + 2.5;
  const hairPaths = (() => {
    const L = cx - faceW, Rt = cx + faceW;
    switch (hairStyle) {
      case 0: return `<path d="M${L - 0.5} ${eyeY - 6} Q${L} ${hairTopY - 4} ${cx} ${hairTopY - 5} Q${Rt} ${hairTopY - 4} ${Rt + 0.5} ${eyeY - 6} L${Rt - 1.5} ${eyeY - 5} Q${cx} ${hairTopY + 1.5} ${L + 1.5} ${eyeY - 5} Z" fill="${hairC}"/>`;
      case 1: return `<path d="M${L + 0.6} ${eyeY - 7} Q${L + 1} ${hairTopY - 3} ${cx} ${hairTopY - 4.5} Q${Rt - 1} ${hairTopY - 3} ${Rt - 0.6} ${eyeY - 7} L${Rt - 2} ${eyeY - 5.5} Q${cx} ${hairTopY + 2} ${L + 2} ${eyeY - 5.5} Z" fill="${hairC}"/><path d="M${L + 0.6} ${eyeY - 7} Q${cx} ${hairTopY - 1} ${Rt - 0.6} ${eyeY - 7}" stroke="${hairHi}" stroke-width="0.7" fill="none" opacity="0.5"/>`;
      case 2: return `<path d="M${L - 1.2} ${eyeY - 5} Q${L - 2} ${hairTopY - 5} ${cx - faceW * 0.4} ${hairTopY - 6.5} Q${cx} ${hairTopY - 8} ${cx + faceW * 0.4} ${hairTopY - 6.5} Q${Rt + 2} ${hairTopY - 5} ${Rt + 1.2} ${eyeY - 5} L${Rt - 1} ${eyeY - 4.5} Q${cx} ${hairTopY + 1} ${L + 1} ${eyeY - 4.5} Z" fill="${hairC}"/><circle cx="${cx - faceW * 0.55}" cy="${hairTopY - 3.5}" r="2.6" fill="${hairC}"/><circle cx="${cx + faceW * 0.55}" cy="${hairTopY - 3.5}" r="2.6" fill="${hairC}"/><circle cx="${cx}" cy="${hairTopY - 6}" r="3" fill="${hairC}"/><circle cx="${cx - faceW * 0.28}" cy="${hairTopY - 5.4}" r="2.7" fill="${hairC}"/><circle cx="${cx + faceW * 0.28}" cy="${hairTopY - 5.4}" r="2.7" fill="${hairC}"/>`;
      case 3: return `<path d="M${L + 0.4} ${eyeY - 6} Q${L + 1} ${hairTopY - 2.5} ${cx} ${hairTopY - 3.5} Q${Rt - 1} ${hairTopY - 2.5} ${Rt - 0.4} ${eyeY - 6} L${Rt - 1.6} ${eyeY - 5} Q${cx} ${hairTopY + 2} ${L + 1.6} ${eyeY - 5} Z" fill="${hairC}" opacity="0.55"/>`;
      case 4: return `<ellipse cx="${cx}" cy="${hairTopY - 4.5}" rx="${faceW + 4.5}" ry="10.5" fill="${hairC}"/><ellipse cx="${cx}" cy="${hairTopY - 6}" rx="${faceW + 1}" ry="8" fill="${hairHi}" opacity="0.18"/>`;
      case 5: {
        let t = "";
        for (let i = 0; i < 7; i++) {
          const tx = cx - faceW * 0.85 + i * faceW * 0.283;
          t += `<path d="M${tx} ${hairTopY - 5.5} q1.1 4 0.3 8.5" stroke="${hairC}" stroke-width="2.5" stroke-linecap="round" fill="none"/>`;
        }
        return `<path d="M${L - 0.8} ${eyeY - 4} Q${L} ${hairTopY - 4} ${cx} ${hairTopY - 5.5} Q${Rt} ${hairTopY - 4} ${Rt + 0.8} ${eyeY - 4} L${Rt - 1} ${eyeY - 4} Q${cx} ${hairTopY} ${L + 1} ${eyeY - 4} Z" fill="${hairC}"/>` + t;
      }
      case 6: return `<path d="M${L - 2} ${eyeY + 2} Q${L - 2.5} ${hairTopY - 4} ${cx} ${hairTopY - 5.5} Q${Rt + 2.5} ${hairTopY - 4} ${Rt + 2} ${eyeY + 2} L${Rt - 0.5} ${eyeY} Q${Rt - 1} ${eyeY - 6} ${cx} ${hairTopY} Q${L + 1} ${eyeY - 6} ${L + 0.5} ${eyeY} Z" fill="${hairC}"/><path d="M${L - 2} ${eyeY + 2} Q${L - 1} ${eyeY - 5} ${cx - 4} ${hairTopY - 2}" stroke="${hairHi}" stroke-width="0.8" fill="none" opacity="0.4"/>`;
      default: return `<ellipse cx="${cx - faceW * 0.35}" cy="${hairTopY + 1}" rx="5" ry="2" fill="${skinHi}" opacity="0.35"/>`;
    }
  })();
  const facialHair = (() => {
    const jawL = cx - jawW, jawR = cx + jawW;
    switch (facial) {
      case 1: return `<path d="M${jawL + 1} ${mouthY - 2} Q${cx} ${chinY + 4.5} ${jawR - 1} ${mouthY - 2} L${jawR - 2.2} ${mouthY - 3.5} Q${cx} ${chinY + 2.5} ${jawL + 2.2} ${mouthY - 3.5} Z" fill="${hairC}" opacity="0.28"/>`;
      case 2: return `<path d="M${cx - mouthW * 0.75} ${mouthY - 1.2} Q${cx} ${mouthY - 3} ${cx + mouthW * 0.75} ${mouthY - 1.2} L${cx + mouthW * 0.6} ${mouthY + 0.2} Q${cx} ${mouthY - 1.2} ${cx - mouthW * 0.6} ${mouthY + 0.2} Z" fill="${hairC}" opacity="0.85"/><path d="M${cx - 3.4} ${mouthY + 1.5} Q${cx} ${chinY + 2.8} ${cx + 3.4} ${mouthY + 1.5} L${cx + 2.4} ${mouthY + 1} Q${cx} ${chinY + 1} ${cx - 2.4} ${mouthY + 1} Z" fill="${hairC}" opacity="0.9"/>`;
      case 3: return `<path d="M${jawL - 0.5} ${eyeY + 7} Q${jawL + 1} ${chinY + 5.5} ${cx} ${chinY + 6} Q${jawR - 1} ${chinY + 5.5} ${jawR + 0.5} ${eyeY + 7} L${jawR - 2.5} ${eyeY + 7} Q${cx} ${chinY + 1.5} ${jawL + 2.5} ${eyeY + 7} Z" fill="${hairC}" opacity="0.92"/><path d="M${cx - mouthW * 0.8} ${mouthY - 1} Q${cx} ${mouthY - 2.8} ${cx + mouthW * 0.8} ${mouthY - 1}" stroke="${hairC}" stroke-width="1.6" fill="none" opacity="0.9"/>`;
      case 4: return `<path d="M${cx - mouthW * 0.85} ${mouthY - 0.8} Q${cx} ${mouthY - 3.2} ${cx + mouthW * 0.85} ${mouthY - 0.8} L${cx + mouthW * 0.62} ${mouthY + 0.4} Q${cx} ${mouthY - 1.4} ${cx - mouthW * 0.62} ${mouthY + 0.4} Z" fill="${hairC}" opacity="0.88"/>`;
      default: return "";
    }
  })();
  const label = crestXmlSafe(`Portrait of ${fullName(player)}`);
  return `<div class="player-portrait player-portrait-${size} pp2" role="img" aria-label="${label}" data-pp-skin="${skinIx}" data-pp-hair="${hairStyle}" data-pp-fh="${facial}" data-pp-jaw="${jawW.toFixed(1)}" style="--portrait-jersey:${jersey};--portrait-accent:${accent}">
  <svg viewBox="0 0 96 96" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="${u}bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2b3d5c"/><stop offset="1" stop-color="#141d2e"/>
      </linearGradient>
      <linearGradient id="${u}jr" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${jersey}"/><stop offset="1" stop-color="#0b0f16" stop-opacity="0.55"/>
      </linearGradient>
      <radialGradient id="${u}fc" cx="0.42" cy="0.36" r="0.85">
        <stop offset="0" stop-color="${skinHi}"/><stop offset="0.55" stop-color="${skin}"/><stop offset="1" stop-color="${skinSh}"/>
      </radialGradient>
    </defs>
    <rect x="0" y="0" width="96" height="96" fill="url(#${u}bg)"/>
    <ellipse cx="${cx}" cy="30" rx="34" ry="26" fill="${accent}" opacity="0.05"/>
    <path d="M${cx - shW} 96 Q${cx - shW} ${76 - bulk * 4} ${cx - neckW - 4} ${73 - bulk * 3} L${cx + neckW + 4} ${73 - bulk * 3} Q${cx + shW} ${76 - bulk * 4} ${cx + shW} 96 Z" fill="url(#${u}jr)"/>
    <path d="M${cx - neckW - 4} ${73 - bulk * 3} Q${cx} ${79 - bulk * 2} ${cx + neckW + 4} ${73 - bulk * 3} L${cx + neckW + 2.5} ${76 - bulk * 2} Q${cx} ${81.5 - bulk * 2} ${cx - neckW - 2.5} ${76 - bulk * 2} Z" fill="${accent}" opacity="0.85"/>
    <path d="M${cx - neckW / 2} ${chinY - 4} L${cx - neckW / 2 - 1.2} ${75 - bulk * 3} Q${cx} ${78 - bulk * 3} ${cx + neckW / 2 + 1.2} ${75 - bulk * 3} L${cx + neckW / 2} ${chinY - 4} Z" fill="${skin}"/>
    <path d="M${cx - neckW / 2} ${chinY - 4} Q${cx} ${chinY + 3} ${cx + neckW / 2} ${chinY - 4} L${cx + neckW / 2} ${chinY + 1} Q${cx} ${chinY + 6} ${cx - neckW / 2} ${chinY + 1} Z" fill="${skinSh}" opacity="0.55"/>
    <ellipse cx="${cx - faceW - 1}" cy="${eyeY + 3.5}" rx="2.4" ry="3.6" fill="${skin}"/>
    <ellipse cx="${cx + faceW + 1}" cy="${eyeY + 3.5}" rx="2.4" ry="3.6" fill="${skin}"/>
    <path d="M${cx - faceW} ${eyeY - 3} Q${cx - faceW - 1.5} ${headTop} ${cx} ${headTop - 1} Q${cx + faceW + 1.5} ${headTop} ${cx + faceW} ${eyeY - 3} Q${cx + faceW - 0.5} ${eyeY + 9} ${cx + jawW} ${chinY - 7} Q${cx + jawW * 0.55} ${chinY + 1.5} ${cx} ${chinY + 2} Q${cx - jawW * 0.55} ${chinY + 1.5} ${cx - jawW} ${chinY - 7} Q${cx - faceW + 0.5} ${eyeY + 9} ${cx - faceW} ${eyeY - 3} Z" fill="url(#${u}fc)"/>
    <path d="M${cx + faceW * 0.25} ${headTop + 2} Q${cx + faceW} ${eyeY} ${cx + jawW * 0.8} ${chinY - 3} Q${cx + faceW + 0.2} ${eyeY + 6} ${cx + faceW - 0.2} ${eyeY - 3} Q${cx + faceW * 0.8} ${headTop + 3} ${cx + faceW * 0.25} ${headTop + 2} Z" fill="${skinSh}" opacity="0.32"/>
    <ellipse cx="${cx - faceW * 0.3}" cy="${headTop + 9}" rx="${faceW * 0.5}" ry="4.5" fill="${skinHi}" opacity="0.28"/>
    <path d="M${cx - eyeDx - eyeW * 0.7} ${eyeY - browDrop + browTilt} Q${cx - eyeDx} ${eyeY - browDrop - 1.6} ${cx - eyeDx + eyeW * 0.75} ${eyeY - browDrop - browTilt * 0.4}" stroke="${hairC}" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    <path d="M${cx + eyeDx - eyeW * 0.75} ${eyeY - browDrop - browTilt * 0.4} Q${cx + eyeDx} ${eyeY - browDrop - 1.6} ${cx + eyeDx + eyeW * 0.7} ${eyeY - browDrop + browTilt}" stroke="${hairC}" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    <ellipse cx="${cx - eyeDx}" cy="${eyeY}" rx="${eyeW / 2}" ry="${eyeH}" fill="#f6f1e8"/>
    <ellipse cx="${cx + eyeDx}" cy="${eyeY}" rx="${eyeW / 2}" ry="${eyeH}" fill="#f6f1e8"/>
    <circle cx="${cx - eyeDx + 0.3}" cy="${eyeY}" r="${eyeH * 0.78}" fill="${irisC}"/>
    <circle cx="${cx + eyeDx - 0.3}" cy="${eyeY}" r="${eyeH * 0.78}" fill="${irisC}"/>
    <circle cx="${cx - eyeDx + 0.3}" cy="${eyeY - 0.1}" r="${eyeH * 0.34}" fill="#0c0805"/>
    <circle cx="${cx + eyeDx - 0.3}" cy="${eyeY - 0.1}" r="${eyeH * 0.34}" fill="#0c0805"/>
    <circle cx="${cx - eyeDx + 0.9}" cy="${eyeY - 0.7}" r="0.45" fill="#fff" opacity="0.9"/>
    <circle cx="${cx + eyeDx + 0.3}" cy="${eyeY - 0.7}" r="0.45" fill="#fff" opacity="0.9"/>
    <path d="M${cx - eyeDx - eyeW / 2} ${eyeY - eyeH * 0.6} Q${cx - eyeDx} ${eyeY - eyeH * 1.7} ${cx - eyeDx + eyeW / 2} ${eyeY - eyeH * 0.6}" stroke="${skinSh}" stroke-width="0.8" fill="none" opacity="0.8"/>
    <path d="M${cx + eyeDx - eyeW / 2} ${eyeY - eyeH * 0.6} Q${cx + eyeDx} ${eyeY - eyeH * 1.7} ${cx + eyeDx + eyeW / 2} ${eyeY - eyeH * 0.6}" stroke="${skinSh}" stroke-width="0.8" fill="none" opacity="0.8"/>
    <path d="M${cx - 1} ${eyeY + 1} Q${cx - noseW / 2 - 0.8} ${noseY} ${cx - noseW / 2} ${noseY + 1.2} Q${cx} ${noseY + 3} ${cx + noseW / 2} ${noseY + 1.2}" stroke="${skinSh}" stroke-width="1.1" stroke-linecap="round" fill="none" opacity="0.85"/>
    <ellipse cx="${cx - noseW * 0.32}" cy="${noseY + 1.4}" rx="0.8" ry="0.55" fill="${skinSh}" opacity="0.7"/>
    <ellipse cx="${cx + noseW * 0.32}" cy="${noseY + 1.4}" rx="0.8" ry="0.55" fill="${skinSh}" opacity="0.7"/>
    <path d="M${cx - mouthW / 2} ${mouthY} Q${cx} ${mouthY + smile} ${cx + mouthW / 2} ${mouthY}" stroke="#3d2018" stroke-width="1.4" stroke-linecap="round" fill="none"/>
    <path d="M${cx - mouthW / 2.6} ${mouthY + 1.6} Q${cx} ${mouthY + 2.6 + smile * 0.4} ${cx + mouthW / 2.6} ${mouthY + 1.6}" stroke="${skinSh}" stroke-width="0.9" stroke-linecap="round" fill="none" opacity="0.6"/>
    <ellipse cx="${cx - faceW * 0.62}" cy="${eyeY + 6.5}" rx="3.4" ry="2.2" fill="${skinSh}" opacity="0.18"/>
    <ellipse cx="${cx + faceW * 0.62}" cy="${eyeY + 6.5}" rx="3.4" ry="2.2" fill="${skinSh}" opacity="0.24"/>
    <ellipse cx="${cx}" cy="${chinY - 1.5}" rx="${jawW * 0.42}" ry="1.8" fill="${skinSh}" opacity="0.2"/>
    ${facialHair}
    ${hairPaths}
    <path d="M${cx - jawW * 0.92} ${chinY - 8} Q${cx - jawW * 0.5} ${chinY - 2} ${cx - 2.5} ${chinY - 1}" stroke="${skinSh}" stroke-width="0.7" fill="none" opacity="${0.25 + ageIx * 0.08}"/>
    <rect x="0" y="0" width="96" height="96" fill="none" stroke="#05070c" stroke-width="1.5" opacity="0.6"/>
  </svg>
  <span class="portrait-position">${escapeHtml(pos)}</span>
</div>`;
}
function renderPlayerPortraitLegacy(player, school = null, size = "lg") {
  var _a, _b;
  const seed = portraitHash(player);
  const [skin, skinShadow] = PORTRAIT_SKINS[seed % PORTRAIT_SKINS.length];
  const hair = PORTRAIT_HAIR[(seed >>> 4) % PORTRAIT_HAIR.length];
  const pos = String((player == null ? void 0 : player.position) || "ATH").toUpperCase();
  const jerseyFallback = PORTRAIT_POSITION_COLORS[pos] || "#315cc7";
  const jersey = portraitColor((_a = school == null ? void 0 : school.colors) == null ? void 0 : _a[0], jerseyFallback);
  const accent = portraitColor((_b = school == null ? void 0 : school.colors) == null ? void 0 : _b[1], "#f4f0d8");
  const hairStyle = (seed >>> 8) % 4;
  const faceStyle = (seed >>> 11) % 3;
  const beard = (seed >>> 14) % 5 >= 3 ? " portrait-beard" : "";
  const scar = (seed >>> 17) % 11 === 0 ? " portrait-scarred" : "";
  const label = crestXmlSafe(`8-bit portrait of ${fullName(player)}`);
  return `<div class="player-portrait player-portrait-${size} portrait-hair-${hairStyle} portrait-face-${faceStyle}${beard}${scar}" role="img" aria-label="${label}" style="--portrait-skin:${skin};--portrait-skin-shadow:${skinShadow};--portrait-hair:${hair};--portrait-jersey:${jersey};--portrait-accent:${accent}">
  <span class="portrait-grid"></span>
  <span class="portrait-shoulders"></span>
  <span class="portrait-jersey-panel"></span>
  <span class="portrait-neck"></span>
  <span class="portrait-ear portrait-ear-left"></span>
  <span class="portrait-ear portrait-ear-right"></span>
  <span class="portrait-head"></span>
  <span class="portrait-hair"></span>
  <span class="portrait-hair-side portrait-hair-side-left"></span>
  <span class="portrait-hair-side portrait-hair-side-right"></span>
  <span class="portrait-brow portrait-brow-left"></span>
  <span class="portrait-brow portrait-brow-right"></span>
  <span class="portrait-eye portrait-eye-left"></span>
  <span class="portrait-eye portrait-eye-right"></span>
  <span class="portrait-nose"></span>
  <span class="portrait-mouth"></span>
  <span class="portrait-beard-pixels"></span>
  <span class="portrait-scar"></span>
  <span class="portrait-position">${escapeHtml(pos)}</span>
</div>`;
}
var FIRST_NAMES, LAST_NAMES, LOCATIONS, LOCATIONS_TOTAL_W, LETTER_PIXEL_FONT, LETTER_FONTS, PORTRAIT_SKINS, PORTRAIT_HAIR, PORTRAIT_POSITION_COLORS;

FIRST_NAMES = [
  "James",
  "John",
  "Marcus",
  "Darius",
  "Tyler",
  "Jordan",
  "DeAndre",
  "Malik",
  "Justin",
  "Chris",
  "Brandon",
  "Devon",
  "Tre",
  "Kobe",
  "Jaylen",
  "Elijah",
  "Anthony",
  "Zach",
  "Logan",
  "Cameron",
  "Trevon",
  "Isaiah",
  "Hunter",
  "Connor",
  "Dalton",
  "Cade",
  "Blake",
  "Bryce",
  "Noah",
  "Nathan",
  "Devin",
  "Quentin",
  "Marquise",
  "Andre",
  "LaShawn",
  "Tyrell",
  "Keith",
  "Aaron",
  "Drew",
  "Cole",
  "Mason",
  "Colton",
  "Garrett",
  "Derek",
  "Rakim",
  "Jamal",
  "Corey",
  "Sterling",
  "Derrick",
  "Miles",
  "Grant",
  "Evan",
  "Austin",
  "Nate",
  "Seth",
  "Lance",
  "Perry",
  "Jaden",
  "Obi",
  "Kwame",
  "Thad",
  "Reuben",
  "Walt",
  "Cruz",
  "Leo",
  "Sam",
  "Alex",
  "Patrick",
  "Caleb",
  "Ryan"
];
LAST_NAMES = [
  "Williams",
  "Johnson",
  "Smith",
  "Brown",
  "Davis",
  "Miller",
  "Wilson",
  "Moore",
  "Taylor",
  "Anderson",
  "Thomas",
  "Jackson",
  "White",
  "Harris",
  "Martin",
  "Thompson",
  "Garcia",
  "Martinez",
  "Robinson",
  "Clark",
  "Rodriguez",
  "Lewis",
  "Lee",
  "Walker",
  "Hall",
  "Allen",
  "Young",
  "Hernandez",
  "King",
  "Wright",
  "Lopez",
  "Hill",
  "Scott",
  "Green",
  "Adams",
  "Baker",
  "Gonzalez",
  "Nelson",
  "Carter",
  "Mitchell",
  "Perez",
  "Roberts",
  "Turner",
  "Phillips",
  "Campbell",
  "Parker",
  "Evans",
  "Edwards",
  "Collins",
  "Stewart",
  "Morris",
  "Rogers",
  "Reed",
  "Cook",
  "Morgan",
  "Bell",
  "Murphy",
  "Bailey",
  "Rivera",
  "Cooper",
  "Richardson",
  "Cox",
  "Howard",
  "Ward",
  "Torres",
  "Peterson",
  "Gray",
  "Ramirez",
  "James",
  "Watson",
  "Brooks",
  "Kelly",
  "Sanders",
  "Price",
  "Bennett",
  "Wood",
  "Barnes",
  "Ross",
  "Henderson",
  "Coleman"
];
LOCATIONS = [
  // Texas — the pipeline
  { city: "Houston", state: "TX", lat: 29.76, lng: -95.37, w: 14 },
  { city: "Dallas", state: "TX", lat: 32.78, lng: -96.8, w: 14 },
  { city: "San Antonio", state: "TX", lat: 29.42, lng: -98.49, w: 8 },
  { city: "Austin", state: "TX", lat: 30.27, lng: -97.74, w: 6 },
  { city: "El Paso", state: "TX", lat: 31.76, lng: -106.49, w: 3 },
  { city: "Lubbock", state: "TX", lat: 33.58, lng: -101.86, w: 2 },
  // California
  { city: "Los Angeles", state: "CA", lat: 34.05, lng: -118.24, w: 16 },
  { city: "San Diego", state: "CA", lat: 32.72, lng: -117.16, w: 6 },
  { city: "Fresno", state: "CA", lat: 36.75, lng: -119.77, w: 4 },
  { city: "Sacramento", state: "CA", lat: 38.58, lng: -121.49, w: 4 },
  { city: "Oakland", state: "CA", lat: 37.8, lng: -122.27, w: 5 },
  { city: "Bakersfield", state: "CA", lat: 35.37, lng: -119.02, w: 2 },
  // Florida
  { city: "Miami", state: "FL", lat: 25.76, lng: -80.19, w: 10 },
  { city: "Tampa", state: "FL", lat: 27.95, lng: -82.46, w: 7 },
  { city: "Orlando", state: "FL", lat: 28.54, lng: -81.38, w: 6 },
  { city: "Jacksonville", state: "FL", lat: 30.33, lng: -81.66, w: 5 },
  { city: "Tallahassee", state: "FL", lat: 30.44, lng: -84.28, w: 2 },
  // Southeast
  { city: "Atlanta", state: "GA", lat: 33.75, lng: -84.39, w: 12 },
  { city: "Savannah", state: "GA", lat: 32.08, lng: -81.09, w: 2 },
  { city: "Macon", state: "GA", lat: 32.84, lng: -83.63, w: 2 },
  { city: "Charlotte", state: "NC", lat: 35.23, lng: -80.84, w: 6 },
  { city: "Raleigh", state: "NC", lat: 35.78, lng: -78.64, w: 4 },
  { city: "Columbia", state: "SC", lat: 34, lng: -81.03, w: 3 },
  { city: "Charleston", state: "SC", lat: 32.78, lng: -79.93, w: 2 },
  { city: "Birmingham", state: "AL", lat: 33.52, lng: -86.8, w: 5 },
  { city: "Mobile", state: "AL", lat: 30.69, lng: -88.04, w: 3 },
  { city: "Jackson", state: "MS", lat: 32.3, lng: -90.18, w: 3 },
  { city: "Hattiesburg", state: "MS", lat: 31.33, lng: -89.29, w: 1.5 },
  { city: "New Orleans", state: "LA", lat: 29.95, lng: -90.07, w: 5 },
  { city: "Baton Rouge", state: "LA", lat: 30.45, lng: -91.19, w: 3 },
  { city: "Shreveport", state: "LA", lat: 32.53, lng: -93.75, w: 2 },
  { city: "Nashville", state: "TN", lat: 36.16, lng: -86.78, w: 5 },
  { city: "Memphis", state: "TN", lat: 35.15, lng: -90.05, w: 4 },
  { city: "Knoxville", state: "TN", lat: 35.96, lng: -83.92, w: 2 },
  { city: "Louisville", state: "KY", lat: 38.25, lng: -85.76, w: 3 },
  { city: "Lexington", state: "KY", lat: 38.04, lng: -84.5, w: 2 },
  { city: "Richmond", state: "VA", lat: 37.54, lng: -77.44, w: 4 },
  { city: "Virginia Beach", state: "VA", lat: 36.85, lng: -75.98, w: 4 },
  { city: "Charleston", state: "WV", lat: 38.35, lng: -81.63, w: 1.5 },
  { city: "Little Rock", state: "AR", lat: 34.75, lng: -92.29, w: 3 },
  // Midwest / Great Lakes
  { city: "Columbus", state: "OH", lat: 39.96, lng: -82.99, w: 5 },
  { city: "Cleveland", state: "OH", lat: 41.5, lng: -81.69, w: 5 },
  { city: "Cincinnati", state: "OH", lat: 39.1, lng: -84.51, w: 4 },
  { city: "Toledo", state: "OH", lat: 41.66, lng: -83.56, w: 2 },
  { city: "Chicago", state: "IL", lat: 41.88, lng: -87.63, w: 11 },
  { city: "Springfield", state: "IL", lat: 39.78, lng: -89.65, w: 2 },
  { city: "Detroit", state: "MI", lat: 42.33, lng: -83.05, w: 6 },
  { city: "Grand Rapids", state: "MI", lat: 42.96, lng: -85.66, w: 3 },
  { city: "Indianapolis", state: "IN", lat: 39.77, lng: -86.16, w: 4 },
  { city: "Fort Wayne", state: "IN", lat: 41.08, lng: -85.14, w: 2 },
  { city: "St. Louis", state: "MO", lat: 38.63, lng: -90.2, w: 4 },
  { city: "Kansas City", state: "MO", lat: 39.1, lng: -94.58, w: 4 },
  { city: "Milwaukee", state: "WI", lat: 43.04, lng: -87.91, w: 4 },
  { city: "Madison", state: "WI", lat: 43.07, lng: -89.4, w: 2 },
  { city: "Minneapolis", state: "MN", lat: 44.98, lng: -93.27, w: 5 },
  { city: "Des Moines", state: "IA", lat: 41.59, lng: -93.62, w: 3 },
  { city: "Wichita", state: "KS", lat: 37.69, lng: -97.34, w: 2.5 },
  { city: "Omaha", state: "NE", lat: 41.26, lng: -95.94, w: 2.5 },
  { city: "Sioux Falls", state: "SD", lat: 43.55, lng: -96.73, w: 1.2 },
  { city: "Fargo", state: "ND", lat: 46.88, lng: -96.79, w: 1 },
  // Northeast / Mid-Atlantic
  { city: "Philadelphia", state: "PA", lat: 39.95, lng: -75.17, w: 8 },
  { city: "Pittsburgh", state: "PA", lat: 40.44, lng: -79.99, w: 4 },
  { city: "New York", state: "NY", lat: 40.71, lng: -74.01, w: 12 },
  { city: "Buffalo", state: "NY", lat: 42.89, lng: -78.88, w: 3 },
  { city: "Newark", state: "NJ", lat: 40.74, lng: -74.17, w: 6 },
  { city: "Baltimore", state: "MD", lat: 39.29, lng: -76.61, w: 5 },
  { city: "Boston", state: "MA", lat: 42.36, lng: -71.06, w: 6 },
  { city: "Springfield", state: "MA", lat: 42.1, lng: -72.59, w: 1.5 },
  { city: "Hartford", state: "CT", lat: 41.77, lng: -72.67, w: 3 },
  { city: "Providence", state: "RI", lat: 41.82, lng: -71.41, w: 1.5 },
  { city: "Manchester", state: "NH", lat: 42.99, lng: -71.46, w: 1 },
  { city: "Burlington", state: "VT", lat: 44.48, lng: -73.21, w: 0.7 },
  { city: "Portland", state: "ME", lat: 43.66, lng: -70.26, w: 1 },
  { city: "Wilmington", state: "DE", lat: 39.75, lng: -75.55, w: 1 },
  // Southwest / Mountain
  { city: "Phoenix", state: "AZ", lat: 33.45, lng: -112.07, w: 7 },
  { city: "Tucson", state: "AZ", lat: 32.22, lng: -110.97, w: 2.5 },
  { city: "Oklahoma City", state: "OK", lat: 35.47, lng: -97.52, w: 4 },
  { city: "Tulsa", state: "OK", lat: 36.15, lng: -95.99, w: 2.5 },
  { city: "Albuquerque", state: "NM", lat: 35.08, lng: -106.65, w: 2.5 },
  { city: "Denver", state: "CO", lat: 39.74, lng: -104.99, w: 5 },
  { city: "Colorado Springs", state: "CO", lat: 38.83, lng: -104.82, w: 2 },
  { city: "Salt Lake City", state: "UT", lat: 40.76, lng: -111.89, w: 3 },
  { city: "Las Vegas", state: "NV", lat: 36.17, lng: -115.14, w: 4 },
  { city: "Reno", state: "NV", lat: 39.53, lng: -119.81, w: 1.2 },
  { city: "Boise", state: "ID", lat: 43.62, lng: -116.2, w: 1.5 },
  { city: "Billings", state: "MT", lat: 45.78, lng: -108.5, w: 0.8 },
  { city: "Cheyenne", state: "WY", lat: 41.14, lng: -104.82, w: 0.5 },
  // Pacific Northwest
  { city: "Seattle", state: "WA", lat: 47.61, lng: -122.33, w: 6 },
  { city: "Spokane", state: "WA", lat: 47.66, lng: -117.43, w: 1.5 },
  { city: "Portland", state: "OR", lat: 45.52, lng: -122.68, w: 4 },
  { city: "Eugene", state: "OR", lat: 44.05, lng: -123.09, w: 1.2 },
  // Far-flung
  { city: "Honolulu", state: "HI", lat: 21.31, lng: -157.86, w: 1.2 },
  { city: "Anchorage", state: "AK", lat: 61.22, lng: -149.9, w: 0.5 }
];
LOCATIONS_TOTAL_W = LOCATIONS.reduce((s, l) => s + (l.w || 1), 0);
LETTER_PIXEL_FONT = {
  A: ["010", "101", "111", "101", "101"],
  B: ["110", "101", "110", "101", "110"],
  C: ["011", "100", "100", "100", "011"],
  D: ["110", "101", "101", "101", "110"],
  E: ["111", "100", "110", "100", "111"],
  F: ["111", "100", "110", "100", "100"],
  G: ["011", "100", "101", "101", "011"],
  H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"],
  J: ["001", "001", "001", "101", "010"],
  K: ["101", "101", "110", "101", "101"],
  L: ["100", "100", "100", "100", "111"],
  M: ["101", "111", "111", "101", "101"],
  N: ["101", "111", "111", "111", "101"],
  O: ["010", "101", "101", "101", "010"],
  P: ["110", "101", "110", "100", "100"],
  Q: ["010", "101", "101", "111", "011"],
  R: ["110", "101", "110", "101", "101"],
  S: ["011", "100", "010", "001", "110"],
  T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "111"],
  V: ["101", "101", "101", "101", "010"],
  W: ["101", "101", "111", "111", "101"],
  X: ["101", "101", "010", "101", "101"],
  Y: ["101", "101", "010", "010", "010"],
  Z: ["111", "001", "010", "100", "111"],
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["110", "001", "010", "100", "111"],
  "3": ["110", "001", "010", "001", "110"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "110", "001", "110"],
  "6": ["011", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "110"]
};
LETTER_FONTS = [
  `Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif`,
  `'Arial Black', 'Franklin Gothic Heavy', Arial, sans-serif`,
  `Rockwell, 'Roboto Slab', Georgia, serif`,
  `Georgia, 'Times New Roman', serif`,
  `'Trebuchet MS', Arial, sans-serif`
];
PORTRAIT_SKINS = [
  ["#f4c7a1", "#c98d69"],
  ["#e8ae82", "#b87552"],
  ["#d99468", "#9f5f43"],
  ["#bd744d", "#7d452f"],
  ["#965739", "#5f3024"],
  ["#75422f", "#45251e"],
  ["#543127", "#2f1c19"],
  ["#3b241f", "#211515"]
];
PORTRAIT_HAIR = ["#151318", "#241a18", "#38251c", "#4b2d20", "#6b452b"];
PORTRAIT_POSITION_COLORS = {
  QB: "#315cc7",
  RB: "#a93645",
  FB: "#a93645",
  WR: "#137b61",
  TE: "#137b61",
  OT: "#a46d24",
  OG: "#a46d24",
  C: "#a46d24",
  OL: "#a46d24",
  DE: "#6b3f9a",
  DT: "#6b3f9a",
  DL: "#6b3f9a",
  OLB: "#8b3c79",
  LB: "#8b3c79",
  CB: "#176f9c",
  S: "#176f9c",
  DB: "#176f9c",
  K: "#52606f",
  P: "#52606f"
};

export { archetypeLabel, clamp2, distanceMiles, escapeHtml, fmtMoney, fmtRecord, fullName, logistic, rand, randInt3, randNorm, randomLocation, randomName, ratingColor, recruitDistance, renderCrest, renderPlayerPortrait, shuffle, uuid };

// additional exports consumed by tools/ probes
export { clamp2 as clamp };
