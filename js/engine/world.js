import { __spreadProps, __spreadValues } from '../_spread.js';
import { C, CLASS_YEARS, DEFAULT_PRACTICE, ROSTER_TARGETS, POSITIONS } from '../constants.js';
import { freshSkills } from './coach.js';
import { generateProgramLore, generateRivalries } from './lore.js';
import { createPlayer, createRecruit, derivedArchetype } from './player.js';
import { buildAIRecruiting, seedFunnelData } from './recruiting.js';
import { defaultWeeklyPlan } from './situations.js';
import { setPlanFields } from './teamplan.js';
import { registerCoachName, resetCoachNames, rollCoachName, staffFor } from './staff.js';
import { distanceMiles, randInt3, randomLocation, shuffle, uuid } from '../utils.js';

function weightedPick(pairs) {
  let total = 0;
  for (const [, w] of pairs) total += w;
  let r = Math.random() * total;
  for (const [key, w] of pairs) {
    r -= w;
    if (r <= 0) return key;
  }
  return pairs[pairs.length - 1][0];
}
function pickCity(region, used, sizePref, { nameBearing = true, dir = null, states = null } = {}) {
  const all = REGION_CITIES[region] || REGION_CITIES.Midwest;
  const inScope0 = states ? all.filter((c) => states.includes(c.s)) : all;
  const inScope = inScope0.length ? inScope0 : all;
  let avail = inScope.filter((c) => !used.cities.has(cityKey(c)));
  if (!avail.length) {
    if (nameBearing) return null;
    avail = inScope;
  }
  if (dir) {
    const lat = inScope.reduce((s, c) => s + c.lat, 0) / inScope.length;
    const lng = inScope.reduce((s, c) => s + c.lng, 0) / inScope.length;
    const score = (c) => {
      const dLat = c.lat - lat, dLng = (c.lng - lng) * 0.79;
      if (dir === "Central") return -(Math.abs(dLat) + Math.abs(dLng));
      const named = dir === "Northern" ? dLat : dir === "Southern" ? -dLat : dir === "Eastern" ? dLng : -dLng;
      const ortho = dir === "Northern" || dir === "Southern" ? Math.abs(dLng) : Math.abs(dLat);
      return named - 0.75 * ortho;
    };
    avail = [...avail].sort((a, b) => score(b) - score(a));
    if (!avail.length || dir !== "Central" && score(avail[0]) <= 0) return null;
    return avail[randInt3(0, Math.min(1, avail.length - 1))];
  }
  // [PLAYTEST 2026-08-12 item 32] This used to walk `sizePref` in order and
  // return from the FIRST non-empty pool — a hard lexicographic preference, not
  // a preference at all. Since D2 and D3 both preferred small towns, and D2+D3
  // are the bulk of the world, every one of them exhausted all 385 `z:1` towns
  // before a single program ever landed in a mid-size or major city. The map
  // read as wall-to-wall small towns because it literally was.
  //
  // `sizePref` is now a WEIGHT MAP ({ 1: 3, 2: 2, 3: 1 }) rather than an
  // ordered list: small towns stay for flavour and stop monopolising. An array
  // is still accepted and still means "strict order", so any caller that has
  // not been converted behaves exactly as before.
  if (sizePref && !Array.isArray(sizePref)) {
    const buckets = [];
    let total = 0;
    for (const z of [1, 2, 3]) {
      const w = sizePref[z] || 0;
      if (w <= 0) continue;
      const pool = avail.filter((c) => c.z === z);
      if (!pool.length) continue;
      total += w;
      buckets.push({ pool, upTo: total });
    }
    if (buckets.length) {
      const roll = randInt3(1, total);
      const hit = buckets.find((b) => roll <= b.upTo) || buckets[buckets.length - 1];
      return hit.pool[randInt3(0, hit.pool.length - 1)];
    }
  } else if (sizePref) {
    for (const z of sizePref) {
      const pool = avail.filter((c) => c.z === z);
      if (pool.length) return pool[randInt3(0, pool.length - 1)];
    }
  }
  return avail[randInt3(0, avail.length - 1)];
}
function pickToken(region, used, patternKey) {
  const tokens = STATE_TOKENS[region] || [];
  const avail = tokens.filter((tk) => tk[patternKey] && !used.tokenPat.has(`${tk.t}|${patternKey}`));
  if (!avail.length) return null;
  return avail[randInt3(0, avail.length - 1)];
}
function tryPattern(patternKey, region, cls, used) {
  const campusPref = CAMPUS_SIZE_PREF[cls];
  const cityPref = CITY_SIZE_PREF[cls];
  if (patternKey === "cd" || patternKey === "cg") {
    // Real cities NEVER take a university suffix ("<City> State/University/Tech"
    // is exactly where real programs live). They take a denomination ("Selma
    // Baptist") or a fictional geographic word ("Selma Ridge") instead — the
    // university suffixes are reserved for the fictional landmark tokens below.
    const city2 = pickCity(region, used, cityPref, { nameBearing: true });
    if (!city2) return null;
    let name2;
    if (patternKey === "cg") {
      const geo = ["Ridge", "Basin", "Vale", "Heights", "Bluff", "Hollow", "Summit", "Prairie", "Grove", "Crossing", "Landing", "Point", "Highlands", "Cliffs", "Bend", "Reach", "Shoals", "Meadows"];
      name2 = `${city2.c} ${geo[randInt3(0, geo.length - 1)]}`;
    } else {
      const denoms = DENOMS_BY_REGION[region] || DENOMS_DEFAULT;
      name2 = `${city2.c} ${denoms[randInt3(0, denoms.length - 1)]}`;
    }
    return { name: name2, city: city2, type: PATTERN_TYPE[patternKey], nameBearing: true };
  }
  if (patternKey === "pc" || patternKey === "sn") {
    const pool = patternKey === "pc" ? PERSON_NAMES : SAINT_NAMES;
    const usedSet = patternKey === "pc" ? used.persons : used.saints;
    const avail = pool.filter((p) => !usedSet.has(p));
    if (!avail.length) return null;
    const pick2 = avail[randInt3(0, avail.length - 1)];
    usedSet.add(pick2);
    let name2;
    if (patternKey === "pc") name2 = cls === "D2" && Math.random() < 0.3 ? `${pick2} University` : `${pick2} College`;
    else name2 = Math.random() < 0.5 ? `${pick2} College` : pick2;
    const city2 = pickCity(region, used, [1, 2, 3], { nameBearing: false });
    return { name: name2, city: city2, type: PATTERN_TYPE[patternKey], nameBearing: false };
  }
  const tk = pickToken(region, used, patternKey);
  if (!tk) return null;
  if (patternKey === "dir") {
    const dirsAvail = DIRS.filter((d2) => !used.tokenPat.has(`${tk.t}|dir|${d2}`));
    if (!dirsAvail.length) return null;
    const d = dirsAvail[randInt3(0, dirsAvail.length - 1)];
    const city2 = pickCity(region, used, campusPref, { nameBearing: false, dir: d, states: tk.states });
    if (!city2) return null;
    used.tokenPat.add(`${tk.t}|dir|${d}`);
    return { name: `${d} ${tk.t}`, city: city2, type: "directional", nameBearing: false };
  }
  if (patternKey === "sat") {
    const city2 = pickCity(region, used, [1, 2, 3], { nameBearing: true, states: tk.states });
    if (!city2) return null;
    used.tokenPat.add(`${tk.t}|sat|${city2.c}`);
    return { name: `${tk.t}-${city2.c}`, city: city2, type: "satellite", nameBearing: true };
  }
  used.tokenPat.add(`${tk.t}|${patternKey}`);
  const flagshipPref = patternKey === "uOf" || patternKey === "st" ? [2, 3, 1] : campusPref;
  const city = pickCity(region, used, flagshipPref, { nameBearing: false, states: tk.states });
  let name;
  if (patternKey === "uOf") name = `University of ${tk.t}`;
  else if (patternKey === "st") name = `${tk.t} State`;
  else if (patternKey === "su") name = `${tk.t} University`;
  else if (patternKey === "tech") name = `${tk.t} Tech`;
  else if (patternKey === "am") name = `${tk.t} A&M`;
  else name = `${tk.t} Poly`;
  return { name, city, type: PATTERN_TYPE[patternKey], nameBearing: false };
}
function isRealSchoolName(name) {
  if (!name) return false;
  for (const stem of REAL_SCHOOL_STEMS) {
    if (name === stem || name.startsWith(stem + " ") || name.includes("of " + stem) || name.includes("-" + stem) || name.endsWith("-" + stem)) return true;
  }
  return false;
}
function makeIdentity(region, cls, used, opts = {}) {
  const patterns = opts.patterns || NAME_PATTERNS[cls];
  for (let attempt = 0; attempt < 30; attempt++) {
    const key = weightedPick(patterns);
    const res = tryPattern(key, region, cls, used);
    if (res && !used.names.has(res.name) && !isRealSchoolName(res.name)) {
      used.names.add(res.name);
      if (res.city) used.cities.add(cityKey(res.city));
      return res;
    }
  }
  for (const key of opts.fallback || ["pc", "sn", "cd", "cg"]) {
    const res = tryPattern(key, region, cls, used);
    if (res && !used.names.has(res.name) && !isRealSchoolName(res.name)) {
      used.names.add(res.name);
      if (res.city) used.cities.add(cityKey(res.city));
      return res;
    }
  }
  const cities = REGION_CITIES[region] || REGION_CITIES.Midwest;
  const fresh = cities.filter((c) => !used.cities.has(cityKey(c)));
  const pool = fresh.length ? fresh : cities;
  const denoms = shuffle([...DENOMS_BY_REGION[region] || DENOMS_DEFAULT]);
  for (const city2 of shuffle([...pool])) {
    for (const d of [...denoms, "Union", "Central", "Presbyterian"]) {
      const name2 = `${city2.c} ${d}${d === "Union" ? " College" : ""}`;
      if (!used.names.has(name2) && !isRealSchoolName(name2)) {
        used.names.add(name2);
        used.cities.add(cityKey(city2));
        return { name: name2, city: city2, type: "denominational", nameBearing: true };
      }
    }
  }
  const person = PERSON_NAMES[randInt3(0, PERSON_NAMES.length - 1)];
  const city = pool[0] || cities[0];
  let name = `${person} Memorial College`, n = 2;
  while (used.names.has(name)) name = `${person} Memorial College ${n++}`;
  used.names.add(name);
  return { name, city, type: "privateCollege", nameBearing: false };
}
function pickNickname({ cls, type, region }, confNicks, used) {
  const cands = [];
  const push = (pool, w) => {
    for (let i = 0; i < w; i++) cands.push(...pool);
  };
  push(NICKS_CLASSIC, 2);
  push(NICKS_REGIONAL[region] || [], 3);
  if (type === "tech") push(NICKS_TECH, 4);
  if (type === "religious" || type === "denominational") push(NICKS_RELIGIOUS, 5);
  if (type === "landGrant") push([NICK_AGGIES], 3);
  if (cls === "D3") push(NICKS_QUIRKY, 2);
  else if (cls === "D2") push(NICKS_QUIRKY, 1);
  const tryCaps = [NICK_GLOBAL_CAP, NICK_GLOBAL_CAP + 1, 99];
  for (const cap of tryCaps) {
    const pool = cands.filter((nk) => !confNicks.has(nk.n) && (used.nickGlobal[nk.n] || 0) < cap);
    if (pool.length) {
      const nk = pool[randInt3(0, pool.length - 1)];
      confNicks.add(nk.n);
      used.nickGlobal[nk.n] = (used.nickGlobal[nk.n] || 0) + 1;
      return nk;
    }
  }
  const allNicks = [NICKS_CLASSIC, NICKS_REGIONAL[region] || [], NICKS_TECH, NICKS_RELIGIOUS, NICKS_QUIRKY, [NICK_AGGIES]].flat();
  const fresh = allNicks.filter((nk) => !confNicks.has(nk.n));
  const fromPool = (fresh.length ? fresh : allNicks).slice().sort((a, b) => (used.nickGlobal[a.n] || 0) - (used.nickGlobal[b.n] || 0));
  const pick2 = fromPool[0] || NICKS_CLASSIC[0];
  confNicks.add(pick2.n);
  used.nickGlobal[pick2.n] = (used.nickGlobal[pick2.n] || 0) + 1;
  return pick2;
}
function makeAbbr(name, usedAbbrs) {
  const SKIP = /* @__PURE__ */ new Set(["College", "State", "University", "Tech", "Institute", "Polytechnic", "Poly", "A&M", "A&T", "Arts", "of", "and", "&", "the", "St.", "St"]);
  const words = name.split(/[\s.\-]+/).filter((w) => w.length > 1 && !SKIP.has(w));
  const cands = [];
  const W = words.map((w) => w.toUpperCase());
  if (name.startsWith("University of ") && W.length) {
    cands.push("U" + W[0][0] + W[0][W[0].length - 1]);
    cands.push("U" + W[0].slice(0, 2));
  }
  if (W.length >= 2) {
    cands.push(W.slice(0, 3).map((w) => w[0]).join(""));
    cands.push(W[0][0] + W[1].slice(0, 2));
  }
  if (W.length >= 1) {
    cands.push(W[0].slice(0, 3));
    cands.push(W[0][0] + W[0][1] + W[0][W[0].length - 1]);
    const cons = W[0].replace(/[AEIOU]/g, "");
    if (cons.length >= 3) cands.push(cons.slice(0, 3));
    if (W.length >= 2) cands.push(W[0].slice(0, 2) + W[1][0]);
  }
  if (W.length >= 1) {
    for (let k = 2; k < Math.min(W[0].length, 7); k++) cands.push(W[0][0] + W[0][1] + W[0][k]);
    if (W.length >= 2) for (let k = 1; k < Math.min(W[1].length, 5); k++) cands.push(W[0][0] + W[1][0] + W[1][k]);
  }
  if (!cands.length) cands.push(name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase());
  for (const c of cands) {
    if (c.length >= 2 && !usedAbbrs.has(c)) {
      usedAbbrs.add(c);
      return c;
    }
  }
  let base = cands[0] || "SCH", n = 2, abbr = base;
  while (usedAbbrs.has(abbr)) abbr = base.slice(0, 2) + n++;
  usedAbbrs.add(abbr);
  return abbr;
}
function stadiumCapacity(cls, prestige) {
  let capacity;
  if (cls === "power") capacity = Math.min(11e4, 45e3 + prestige * 1e4 + randInt3(0, 9e3));
  else if (cls === "midMajor") capacity = 17e3 + prestige * 6e3 + randInt3(0, 6e3);
  else if (cls === "D2") capacity = 3e3 + prestige * 2e3 + randInt3(0, 2500);
  else capacity = 1200 + prestige * 1200 + randInt3(0, 1500);
  return Math.round(capacity / 500) * 500;
}
function makeFlavor(cls, type, prestige, nick) {
  const priv = PRIVATE_TYPES.has(type);
  let enrollment;
  if (priv) enrollment = cls === "D2" ? randInt3(1500, 5e3) : randInt3(900, 3200);
  else if (cls === "power") enrollment = randInt3(24e3, 58e3);
  else if (cls === "midMajor") enrollment = randInt3(9e3, 28e3);
  else if (cls === "D2") enrollment = randInt3(3500, 14e3);
  else enrollment = randInt3(2e3, 9e3);
  enrollment = Math.round(enrollment / 100) * 100;
  const FOUNDED = {
    flagship: [1785, 1870],
    landGrant: [1855, 1890],
    stateUniversity: [1800, 1880],
    tech: [1880, 1930],
    directional: [1866, 1912],
    regionalState: [1866, 1912],
    satellite: [1930, 1972],
    cityUniversity: [1870, 1925],
    privateCollege: [1820, 1890],
    denominational: [1830, 1900],
    liberalArts: [1820, 1885],
    religious: [1840, 1912]
  };
  const [fLo, fHi] = FOUNDED[type] || [1850, 1920];
  const founded = randInt3(fLo, fHi);
  const capacity = stadiumCapacity(cls, prestige);
  const person = PERSON_NAMES[randInt3(0, PERSON_NAMES.length - 1)];
  const person2 = PERSON_NAMES[randInt3(0, PERSON_NAMES.length - 1)];
  const smallVenue = cls === "D2" || cls === "D3";
  const stadiumNames = smallVenue ? [
    `${person} Field`,
    `${person} Memorial Field`,
    `${nick} Field`,
    `${person2} Stadium`,
    `${person}-${person2} Field`,
    "Alumni Field",
    "Memorial Stadium",
    "Founders Field",
    "Heritage Field",
    "Pioneer Field",
    "Veterans Memorial Field",
    `${person} Athletic Field`,
    "Homecoming Field",
    "The Bowl",
    `Old ${person} Field`
  ] : [
    `${person} Stadium`,
    `${person} Field`,
    `${nick} Stadium`,
    `${person} Memorial Stadium`,
    `${person2} Field`,
    "Memorial Stadium",
    "Veterans Memorial Stadium",
    `${person}-${person2} Stadium`,
    "Legacy Stadium",
    "Centennial Stadium",
    `${person} Athletic Complex`,
    "The Coliseum",
    `${person2} Memorial Stadium`,
    "Founders Stadium",
    `${person} Bowl`
  ];
  const stadium = { name: stadiumNames[randInt3(0, stadiumNames.length - 1)], capacity };
  return { enrollment, founded, stadium, control: priv ? "private" : "public" };
}
function pickPrestige(cls) {
  return weightedPick(PRESTIGE_WEIGHTS[cls].map(([p, w]) => [p, w]));
}
function facilitiesFor(prestige) {
  const lvl = Math.max(1, Math.min(4, 1 + Math.round((prestige || 1) / 2)));
  return { stadium: lvl, training: lvl, recruiting: lvl, medicine: lvl };
}
function prestigeClamp(cls, division) {
  var _a;
  if (cls === "power") return __spreadValues({}, D1_POWER_CLAMP);
  if (cls === "midMajor") return __spreadValues({}, D1_MIDMAJOR_CLAMP);
  const cap = ((_a = C.PRESTIGE_MAX) == null ? void 0 : _a[division]) || 5;
  return { min: 1, max: cap };
}
function confSizeRange(conf) {
  if (conf.division === "D1") {
    return conf.conferenceClass === "power" ? C.D1_POWER_CONF_SIZE : C.D1_MIDMAJOR_CONF_SIZE;
  }
  return conf.division === "D2" ? C.D2_CONF_SIZE : C.D3_CONF_SIZE;
}
function uniqueSchoolId(name, usedIds) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16);
  let id;
  do {
    id = slug + "_" + randInt3(100, 999);
  } while (usedIds.has(id));
  usedIds.add(id);
  return id;
}
function pickSchoolRegion(homeRegion, division, tally) {
  const nbrs = REGION_NEIGHBORS[homeRegion] || [];
  if (!nbrs.length || Math.random() >= REGION_SPREAD) return homeRegion;
  let best = nbrs[0], bestN = Infinity;
  for (const n of nbrs) {
    const n0 = tally[`${n}|${division}`] || 0;
    const score = n0 + Math.random() * 0.5;
    if (score < bestN) {
      bestN = score;
      best = n;
    }
  }
  return best;
}
function buildStaticD1(used) {
  const out = [];
  const confOrder = D1_CONFS.map((c) => c.id);
  let ci = 0, per = 0;
  for (let i = 0; i < STATIC_D1_SCHOOLS.length; i++) {
    const [name, nick, abbr, city, state2, lat, lng, colors, prestige, type] = STATIC_D1_SCHOOLS[i];
    const confId = confOrder[ci];
    const conf = D1_CONFS.find((c) => c.id === confId);
    const cls = conf.conferenceClass;
    const clamp7 = prestigeClamp(cls, "D1");
    const priv = PRIVATE_TYPES.has(type);
    const enrollment = priv ? 3200 + prestige * 1800 : 18e3 + prestige * 6500;
    const foundedBase = { flagship: 1820, landGrant: 1865, stateUniversity: 1850, tech: 1895, cityUniversity: 1900, regionalState: 1890, privateCollege: 1850, religious: 1870 }[type] || 1875;
    const founded = foundedBase + i * 7 % 40;
    const capBase = cls === "power" ? 45e3 + prestige * 1e4 : 17e3 + prestige * 6e3;
    const capacity = Math.min(11e4, Math.round((capBase + i % 5 * 1500) / 500) * 500);
    const stadiumNm = ["Memorial Stadium", `${nick} Stadium`, "Veterans Memorial Stadium", `${city} Stadium`][i % 4];
    let id = name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16);
    let uid = id, n = 2;
    while (used.ids.has(uid)) uid = id + n++;
    used.ids.add(uid);
    used.names.add(name);
    used.abbrs.add(abbr);
    out.push({
      id: uid,
      name,
      nick,
      abbr,
      logo: "\u{1F3C8}",
      facilities: facilitiesFor(prestige),
      staff: staffFor(prestige, "D1"),
      conf: confId,
      division: "D1",
      lat,
      lng,
      city,
      state: state2,
      type,
      control: priv ? "private" : "public",
      enrollment,
      founded,
      stadium: { name: stadiumNm, capacity },
      prestige,
      baseline: prestige,
      prestigeMin: clamp7.min,
      prestigeMax: clamp7.max,
      colors: [colors[0], colors[1]]
    });
    per++;
    if (per >= 12) {
      per = 0;
      ci++;
    }
  }
  return out;
}
function generateSchools() {
  var _a, _b;
  const schools = [];
  const used = {
    names: /* @__PURE__ */ new Set(),
    abbrs: /* @__PURE__ */ new Set(),
    cities: /* @__PURE__ */ new Set(),
    ids: /* @__PURE__ */ new Set(),
    tokenPat: /* @__PURE__ */ new Set(),
    persons: /* @__PURE__ */ new Set(),
    saints: /* @__PURE__ */ new Set(),
    nickGlobal: {}
  };
  const ALL_CONFS = [...D1_CONFS, ...D2_CONFS, ...D3_CONFS];
  const staticD1 = buildStaticD1(used);
  for (const s of staticD1) used.cities.add(cityKey({ c: s.city, s: s.state }));
  schools.push(...staticD1);
  const PROC_CONFS = ALL_CONFS.filter((c) => c.division !== "D1");
  const regionTally = {};
  // [Season Mode Part B, 2026-08-13] D2/D3 conference TIERING. D1 keeps its
  // power/mid-major split; D2/D3 were flat (every conference the same tier). Give
  // each a small prestige offset so a strong conference and a weak one emerge —
  // the hierarchy those divisions lacked. The offsets AVERAGE TO ~0 across the
  // division (weighted more negative to offset the low-skew floor clamp), so the
  // division MEAN — and thus the league's talent/balance — is preserved; only the
  // between-conference SPREAD grows. Mean-neutral, verified by d2d3_tiering_ab.
  const CONF_TIER_OFFSET = { D2: [1, 1, 1, 0, 0, 0, -1, -1, -1, -1], D3: [1, 1, 0, 0, -1, -1, -1, -1, -1] };
  const _divConfSeq = { D2: 0, D3: 0 };
  for (const conf of PROC_CONFS) {
    const cls = conf.division === "D1" ? conf.conferenceClass : conf.division;
    const ceiling = cls === "power" ? 6 : cls === "midMajor" ? 3 : ((_a = C.PRESTIGE_MAX) == null ? void 0 : _a[conf.division]) || 5;
    const _offArr = CONF_TIER_OFFSET[conf.division] || null;
    const confOffset = _offArr ? _offArr[_divConfSeq[conf.division]++ % _offArr.length] : 0;
    const [lo, hi] = confSizeRange(conf);
    let PER_CONF = randInt3(lo, hi);
    if (PER_CONF % 2 !== 0) PER_CONF++;
    const confNicks = /* @__PURE__ */ new Set();
    const confColorKeys = /* @__PURE__ */ new Set();
    const confSchools = [];
    for (let i = 0; i < PER_CONF; i++) {
      const schoolRegion = pickSchoolRegion(conf.region, conf.division, regionTally);
      regionTally[`${schoolRegion}|${conf.division}`] = (regionTally[`${schoolRegion}|${conf.division}`] || 0) + 1;
      const ident = makeIdentity(schoolRegion, cls, used);
      const nickPick = pickNickname({ cls, type: ident.type, region: schoolRegion }, confNicks, used);
      const abbr = makeAbbr(ident.name, used.abbrs);
      let c1, c2;
      for (let t = 0; t < 16; t++) {
        [c1, c2] = COLOR_PAIRS[randInt3(0, COLOR_PAIRS.length - 1)];
        const globallyFresh = !(used.colorKeys && used.colorKeys.has(c1 + c2));
        if (!confColorKeys.has(c1 + c2) && (globallyFresh || t >= 8)) break;
      }
      confColorKeys.add(c1 + c2);
      (used.colorKeys = used.colorKeys || /* @__PURE__ */ new Set()).add(c1 + c2);
      const cityObj = ident.city || { c: "", s: "", lat: conf.lat, lng: conf.lng };
      const lat = +(cityObj.lat + (Math.random() * 2 - 1) * LOC_JITTER_DEG).toFixed(2);
      const lng = +(cityObj.lng + (Math.random() * 2 - 1) * LOC_JITTER_DEG).toFixed(2);
      let prestige = pickPrestige(cls);
      if (confOffset) prestige = Math.max(1, Math.min(ceiling, prestige + confOffset));
      const clamp7 = prestigeClamp(cls, conf.division);
      const flavor = makeFlavor(cls, ident.type, prestige, nickPick.n);
      confSchools.push({
        id: uniqueSchoolId(ident.name, used.ids),
        name: ident.name,
        nick: nickPick.n,
        abbr,
        logo: nickPick.e || "\u{1F3C8}",
        facilities: facilitiesFor(prestige),
        staff: staffFor(prestige, conf.division),
        conf: conf.id,
        division: conf.division,
        lat,
        lng,
        city: cityObj.c,
        state: cityObj.s,
        type: ident.type,
        control: flavor.control,
        enrollment: flavor.enrollment,
        founded: flavor.founded,
        stadium: flavor.stadium,
        prestige,
        baseline: prestige,
        prestigeMin: clamp7.min,
        prestigeMax: clamp7.max,
        colors: [c1, c2]
      });
    }
    if (!confSchools.some((s) => s.prestige >= ceiling)) {
      const anchor = [...confSchools].sort(
        (a, b) => {
          var _a2, _b2;
          return ((_a2 = ANCHOR_RANK[a.type]) != null ? _a2 : 9) - ((_b2 = ANCHOR_RANK[b.type]) != null ? _b2 : 9) || b.prestige - a.prestige;
        }
      )[0];
      anchor.prestige = ceiling;
      anchor.baseline = ceiling;
      anchor.stadium.capacity = Math.max(anchor.stadium.capacity, stadiumCapacity(cls, ceiling));
    } else {
      const maxRank = cls === "power" ? 1 : 6;
      const top = confSchools.reduce((a, b) => b.prestige > a.prestige ? b : a);
      if (((_b = ANCHOR_RANK[top.type]) != null ? _b : 9) > maxRank) {
        const flag = [...confSchools].filter((s) => {
          var _a2;
          return ((_a2 = ANCHOR_RANK[s.type]) != null ? _a2 : 9) <= maxRank;
        }).sort((a, b) => b.prestige - a.prestige)[0];
        if (flag && flag.prestige < top.prestige) {
          const tmp = { p: flag.prestige, b: flag.baseline };
          flag.prestige = top.prestige;
          flag.baseline = top.baseline;
          top.prestige = tmp.p;
          top.baseline = tmp.b;
        }
      }
    }
    schools.push(...confSchools);
  }
  const procSchools = schools.filter((s) => s.division !== "D1");
  const staticD1Reserved = schools.filter((s) => s.division === "D1");
  guaranteeStateCoverage(procSchools, PROC_CONFS, staticD1Reserved);
  resolveCityCollisions(procSchools, staticD1Reserved);
  mixConferenceStates(procSchools, PROC_CONFS);
  return schools;
}
function statesToRegions() {
  const m = {};
  for (const [r, cities] of Object.entries(REGION_CITIES)) {
    if (r === "Hawaii" || r === "Alaska") continue;
    for (const c of cities) (m[c.s] = m[c.s] || []).push(r);
  }
  for (const k of Object.keys(m)) m[k] = [...new Set(m[k])];
  return m;
}
function relocateSchoolTo(school, state2, region, cls, used) {
  const cities = (REGION_CITIES[region] || []).filter((c) => c.s === state2);
  if (!cities.length) return false;
  const VKEY = "__guarantee";
  REGION_CITIES[VKEY] = cities;
  STATE_TOKENS[VKEY] = (STATE_TOKENS[region] || []).filter((tk) => (tk.states || []).includes(state2));
  DENOMS_BY_REGION[VKEY] = DENOMS_BY_REGION[region] || DENOMS_DEFAULT;
  let ident = null;
  try {
    ident = makeIdentity(VKEY, cls, used);
  } catch (e) {
    ident = null;
  } finally {
    delete REGION_CITIES[VKEY];
    delete STATE_TOKENS[VKEY];
    delete DENOMS_BY_REGION[VKEY];
  }
  if (!ident) return false;
  const city = ident.city || cities[randInt3(0, cities.length - 1)];
  school.name = ident.name;
  school.abbr = makeAbbr(ident.name, used.abbrs);
  school.id = uniqueSchoolId(ident.name, used.ids);
  school.city = city.c;
  school.state = city.s;
  school.lat = +(city.lat + (Math.random() * 2 - 1) * LOC_JITTER_DEG).toFixed(2);
  school.lng = +(city.lng + (Math.random() * 2 - 1) * LOC_JITTER_DEG).toFixed(2);
  if (ident.type) school.type = ident.type;
  return true;
}
function stateCentroid(state2) {
  let n = 0, lat = 0, lng = 0;
  for (const cities of Object.values(REGION_CITIES))
    for (const c of cities) if (c.s === state2) {
      lat += c.lat;
      lng += c.lng;
      n++;
    }
  return n ? { lat: lat / n, lng: lng / n } : null;
}
// A real city from the built-in gazetteer (REGION_CITIES) — constrained to a
// state when given. Returns { c, s, lat, lng } or null.
function cityInState(state2) {
  const all = Object.values(REGION_CITIES).flat();
  const inState = state2 ? all.filter((c) => c.s === state2) : [];
  const pool = inState.length ? inState : all;
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}
// Coin a full PROCEDURAL team identity sited in a real gazetteer city — a unique
// (non-duplicate) fictional program with real coordinates for recruiting. Used
// by the Creator's reroll and city assignment. Optionally pinned to a state.
function coinTeamIdentity({ state: st = null } = {}) {
  const city = cityInState(st) || { c: "Springfield", s: st || "IL", lat: 39.8, lng: -89.6 };
  // NAME must be FICTIONAL — never "<real city> State" (that coins real programs
  // like "Boise State", a trademark problem). Reuse the world generator's own
  // identity maker, which builds names from fictional tokens AND rejects any that
  // collide with a real school (isRealSchoolName). We keep only its name; the
  // LOCATION is pinned to the chosen real city so recruiting distance still works.
  const region = regionOfState(city.s) || Object.keys(REGION_CITIES)[0];
  const used = {
    names: /* @__PURE__ */ new Set(), abbrs: /* @__PURE__ */ new Set(), cities: /* @__PURE__ */ new Set(),
    tokenPat: /* @__PURE__ */ new Set(), persons: /* @__PURE__ */ new Set(), saints: /* @__PURE__ */ new Set(), nickGlobal: {}
  };
  // makeIdentity names teams from the fictional landmark tokens ("Sawtooth
  // State", "Bitterroot University") and rejects anything that collides with a
  // real school (isRealSchoolName, now backstopped by the famous-program list),
  // so we can use it directly — the whole point of the token cleanup. A geographic
  // fallback covers the rare case it can't find a fresh name.
  const GEO_SUFFIX = ["Ridge", "Basin", "Vale", "Heights", "Bluff", "Hollow", "Summit", "Prairie", "Grove", "Crossing", "Landing", "Point", "Highlands", "Cliffs"];
  let ident = null;
  for (let i = 0; i < 8 && !ident; i++) {
    const cand = makeIdentity(region, "midMajor", used);
    if (cand && cand.name && !isRealSchoolName(cand.name)) ident = cand;
  }
  const geoName = `${city.c} ${GEO_SUFFIX[Math.floor(Math.random() * GEO_SUFFIX.length)]}`;
  const name = ident ? ident.name : (isRealSchoolName(geoName) ? `${city.c} Ridge` : geoName);
  const nickPick = pickNickname({ cls: "midMajor", type: (ident && ident.type) || "stateUniversity", region }, /* @__PURE__ */ new Set(), used);
  const nick = (nickPick && nickPick.n) ? nickPick.n : ((NICKS_CLASSIC[0] && NICKS_CLASSIC[0].n) || "Statesmen");
  const cp = (COLOR_PAIRS && COLOR_PAIRS.length) ? COLOR_PAIRS[Math.floor(Math.random() * COLOR_PAIRS.length)] : ["#1e3a8a", "#e2e8f0"];
  const j = () => (Math.random() * 2 - 1) * LOC_JITTER_DEG;
  return {
    name, nick, colors: [cp[0], cp[1]], state: city.s, city: city.c,
    lat: +(city.lat + j()).toFixed(2), lng: +(city.lng + j()).toFixed(2)
  };
}
function guaranteeStateCoverage(schools, allConfs, reserved = []) {
  const s2r = statesToRegions();
  const clsOf = {}, confAnchor = {};
  for (const c of allConfs) {
    clsOf[c.id] = c.division === "D1" ? c.conferenceClass : c.division;
    confAnchor[c.id] = { lat: c.lat, lng: c.lng };
  }
  const guardPool = [...schools, ...reserved];
  const used = {
    names: new Set(guardPool.map((s) => s.name)),
    abbrs: new Set(guardPool.map((s) => s.abbr)),
    cities: new Set(guardPool.map((s) => `${s.city}|${s.state}`)),
    ids: new Set(guardPool.map((s) => s.id)),
    tokenPat: /* @__PURE__ */ new Set(),
    persons: /* @__PURE__ */ new Set(),
    saints: /* @__PURE__ */ new Set(),
    nickGlobal: {}
  };
  let moved = 0;
  for (const div of ["D1", "D2", "D3"]) {
    const count = {};
    for (const s of schools) if (s.division === div) count[s.state] = (count[s.state] || 0) + 1;
    for (const st of CONTINENTAL_STATES) {
      if (count[st]) continue;
      const regions = s2r[st] || [];
      if (!regions.length) continue;
      const target = stateCentroid(st);
      const donors = schools.filter((s) => s.division === div && (count[s.state] || 0) >= 2);
      if (!donors.length || !target) continue;
      let best = null, bestScore = -Infinity;
      for (const d of donors) {
        const a = confAnchor[d.conf];
        if (!a) continue;
        const dLat = a.lat - target.lat, dLng = (a.lng - target.lng) * 0.79;
        const away = Math.sqrt(dLat * dLat + dLng * dLng);
        const score = (count[d.state] || 0) * 2.2 - away + Math.random() * 0.8;
        if (score > bestScore) {
          bestScore = score;
          best = d;
        }
      }
      if (!best) continue;
      const donor = best;
      const from = donor.state;
      const region = regions[randInt3(0, regions.length - 1)];
      if (relocateSchoolTo(donor, st, region, clsOf[donor.conf] || div, used)) {
        count[from] = (count[from] || 1) - 1;
        count[st] = 1;
        moved++;
      }
    }
  }
  return moved;
}
function resolveCityCollisions(schools, reserved = []) {
  const key = (s) => `${s.city}|${s.state}`;
  const taken = new Set([...schools, ...reserved].map(key));
  const used = { names: new Set([...schools, ...reserved].map((s) => s.name)) };
  const groups = {};
  for (const s of schools) (groups[key(s)] = groups[key(s)] || []).push(s);
  const byState = {};
  for (const cities of Object.values(REGION_CITIES))
    for (const c of cities) (byState[c.s] = byState[c.s] || []).push(c);
  let fixed = 0, stuck = 0;
  for (const [k, group] of Object.entries(groups)) {
    if (group.length < 2) continue;
    const cityName = k.split("|")[0];
    const anchor = group.find((s) => s.name.includes(cityName)) || group[0];
    for (const s of group) {
      if (s === anchor) continue;
      const pool = (byState[s.state] || []).filter((c2) => !taken.has(`${c2.c}|${c2.s}`));
      if (!pool.length) {
        stuck++;
        continue;
      }
      const c = pool[Math.floor(Math.random() * pool.length)];
      if (s.name.includes(cityName)) {
        const renamed = s.name.split(cityName).join(c.c);
        if (used.names.has(renamed)) {
          stuck++;
          continue;
        }
        used.names.delete(s.name);
        s.name = renamed;
        used.names.add(renamed);
      }
      s.city = c.c;
      s.state = c.s;
      s.lat = +(c.lat + (Math.random() * 2 - 1) * LOC_JITTER_DEG).toFixed(2);
      s.lng = +(c.lng + (Math.random() * 2 - 1) * LOC_JITTER_DEG).toFixed(2);
      taken.add(key(s));
      fixed++;
    }
  }
  return { fixed, stuck };
}
function mixConferenceStates(schools, allConfs) {
  var _a;
  const anchor = {};
  for (const c of allConfs) {
    const cls = c.division === "D1" ? c.conferenceClass : c.division;
    const ceiling = cls === "power" ? 6 : cls === "midMajor" ? 3 : ((_a = C.PRESTIGE_MAX) == null ? void 0 : _a[c.division]) || 5;
    anchor[c.id] = { lat: c.lat, lng: c.lng, division: c.division, region: c.region, ceiling };
  }
  const dist = (s, confId) => {
    const a = anchor[confId];
    const dLat = s.lat - a.lat, dLng = (s.lng - a.lng) * 0.79;
    return Math.sqrt(dLat * dLat + dLng * dLng);
  };
  const CAP = { D1: 9, D2: 6.5, D3: 5 };
  const CAP_OPP = { D1: 7, D2: 5.5, D3: 4.25 };
  const byConf = () => {
    const m = {};
    for (const s of schools) (m[s.conf] = m[s.conf] || []).push(s);
    return m;
  };
  const stateSet = (arr) => new Set(arr.map((s) => s.state).filter(Boolean));
  const trySwapInto = (confId, members, targetStates, cap) => {
    const div = anchor[confId].division;
    const myStates = stateSet(members);
    if (myStates.size >= targetStates) return false;
    const stateCount = {};
    for (const s of members) stateCount[s.state] = (stateCount[s.state] || 0) + 1;
    const partners = Object.keys(anchor).filter((id) => id !== confId && anchor[id].division === div).sort((x, y) => {
      const dx = Math.hypot(anchor[x].lat - anchor[confId].lat, (anchor[x].lng - anchor[confId].lng) * 0.79);
      const dy = Math.hypot(anchor[y].lat - anchor[confId].lat, (anchor[y].lng - anchor[confId].lng) * 0.79);
      return dx - dy;
    });
    const all = byConf();
    const myNicks = new Set(members.map((s) => s.nick));
    const myColors = new Set(members.map((s) => (s.colors || []).join("")));
    const myKings = members.filter((s) => s.prestige >= anchor[confId].ceiling).length;
    for (const pid of partners) {
      const pMembers = all[pid] || [];
      const pStates = stateSet(pMembers);
      const pCount = {};
      for (const s of pMembers) pCount[s.state] = (pCount[s.state] || 0) + 1;
      const pNicks = new Set(pMembers.map((s) => s.nick));
      const pColors = new Set(pMembers.map((s) => (s.colors || []).join("")));
      const pKings = pMembers.filter((s) => s.prestige >= anchor[pid].ceiling).length;
      let best = null;
      for (const out of members) {
        if ((stateCount[out.state] || 0) < 2) continue;
        if (dist(out, pid) > cap) continue;
        if (myKings === 1 && out.prestige >= anchor[confId].ceiling) continue;
        if (pNicks.has(out.nick)) continue;
        for (const inn of pMembers) {
          if (myStates.has(inn.state) || !inn.state) continue;
          const pAfter = pStates.size - ((pCount[inn.state] || 0) === 1 ? 1 : 0) + (pStates.has(out.state) ? 0 : 1);
          if (pAfter < 3) continue;
          if (dist(inn, confId) > cap) continue;
          if (pKings === 1 && inn.prestige >= anchor[pid].ceiling) continue;
          if (myNicks.has(inn.nick)) continue;
          let cost = dist(inn, confId) + dist(out, pid);
          if (myColors.has((inn.colors || []).join(""))) cost += 2;
          if (pColors.has((out.colors || []).join(""))) cost += 2;
          if (!best || cost < best.cost) best = { out, inn, cost };
        }
      }
      if (best) {
        const t = best.out.conf;
        best.out.conf = best.inn.conf;
        best.inn.conf = t;
        return true;
      }
    }
    return false;
  };
  for (let round = 0; round < 40; round++) {
    const all = byConf();
    const deficient = Object.entries(all).filter(([, arr]) => stateSet(arr).size < 3).sort((a, b) => stateSet(a[1]).size - stateSet(b[1]).size);
    if (!deficient.length) break;
    let moved = false;
    for (const [cid, arr] of deficient) {
      if (trySwapInto(cid, arr, 3, CAP[anchor[cid].division])) {
        moved = true;
        break;
      }
    }
    if (!moved) break;
  }
  for (let round = 0; round < 12; round++) {
    const all = byConf();
    const deficient = Object.entries(all).filter(([, arr]) => stateSet(arr).size < 3);
    if (!deficient.length) break;
    let moved = false;
    for (const [cid, arr] of deficient) {
      if (trySwapInto(cid, arr, 3, CAP[anchor[cid].division] * 1.35)) {
        moved = true;
        break;
      }
    }
    if (!moved) break;
  }
  const geoTokens = Object.keys(TOKEN_STATES);
  const cityTaken = new Set(schools.map((s) => `${s.city}|${s.state}`));
  {
    for (const cid of Object.keys(byConf())) {
      const arr = byConf()[cid];
      const myStates = stateSet(arr);
      if (myStates.size >= 3) continue;
      const region = anchor[cid].region;
      const findPool = (cap, allowShared) => (REGION_CITIES[region] || []).filter(
        (c) => c.s && !myStates.has(c.s) && (allowShared || !cityTaken.has(`${c.c}|${c.s}`)) && dist({ lat: c.lat, lng: c.lng }, cid) <= cap
      );
      let pool = findPool(CAP[anchor[cid].division], false);
      if (!pool.length) pool = findPool(CAP[anchor[cid].division] * 1.35, true);
      if (!pool.length) continue;
      const stateCount = {};
      for (const s of arr) stateCount[s.state] = (stateCount[s.state] || 0) + 1;
      const movable = arr.filter(
        (s) => (stateCount[s.state] || 0) >= 2 && !(s.city && s.name.includes(s.city)) && !geoTokens.some((t) => s.name.includes(t))
      );
      if (!movable.length) continue;
      const mover = movable[Math.floor(Math.random() * movable.length)];
      const dest = pool[Math.floor(Math.random() * pool.length)];
      cityTaken.delete(`${mover.city}|${mover.state}`);
      mover.city = dest.c;
      mover.state = dest.s;
      mover.lat = +(dest.lat + (Math.random() * 2 - 1) * LOC_JITTER_DEG).toFixed(2);
      mover.lng = +(dest.lng + (Math.random() * 2 - 1) * LOC_JITTER_DEG).toFixed(2);
      cityTaken.add(`${dest.c}|${dest.s}`);
    }
  }
  for (let round = 0; round < 8; round++) {
    const rem = byConf();
    const deficient = Object.entries(rem).filter(([, arr]) => stateSet(arr).size < 3);
    if (!deficient.length) break;
    let moved = false;
    for (const [cid, arr] of deficient) {
      if (trySwapInto(cid, arr, 3, CAP[anchor[cid].division] * 1.7)) {
        moved = true;
        break;
      }
    }
    if (!moved) break;
  }
  for (const cid of Object.keys(byConf())) {
    const arr = byConf()[cid];
    if (stateSet(arr).size === 3) trySwapInto(cid, arr, 4, CAP_OPP[anchor[cid].division]);
  }
}
// [playtest item 18, 2026-08-12] The prestige→talent coupling. It is two terms:
//   1. (prestige − 3) × 2   — the ABSOLUTE term, unchanged, which carries the
//      division gap (D1 schools sit at higher prestige, so they get more here).
//   2. (prestige − divMean) × 2.5 — the DIVISION-RELATIVE term, centered on the
//      division's ACTUAL mean prestige so it averages to zero across the real
//      school population (which skews low — most programs sit near the bottom of
//      their division's star range, means ~D1 3.6 / D2 2.1 / D3 1.6). Centering on
//      the range midpoint instead dragged the world OVR mean ~2 low and broke the
//      pos_ovr_census calibration. This widens the within-division spread (a top
//      program is clearly loaded vs a bottom one) WITHOUT moving the world's mean
//      talent — so the tiers hold and the aggregate stat bands stay put. A
//      program's whole star range was worth ~3.5 OVR of roster; it is now ~7–10.
var PRESTIGE_DIV_MID = { D1: 3.6, D2: 2.1, D3: 1.6 };
function prestigeTalentBonus(prestige, division) {
  var _a;
  const mid = (_a = PRESTIGE_DIV_MID[division]) != null ? _a : 3;
  return (prestige - 3) * 2 + (prestige - mid) * 2.5;
}
function applyIdentityToSchool(school, qbPref, defFront, tier = null, pBonus = null) {
  const DIV_TIER = { D3: 1, D2: 2, D1: 3 };
  const t = tier != null ? tier : DIV_TIER[school.division] || 1;
  const pb = pBonus != null ? pBonus : Math.round(prestigeTalentBonus(school.prestige, school.division));
  const shapePos = (pos, wantArch, n) => {
    const ps = school.roster.filter((p) => p.position === pos);
    for (let i = 0; i < Math.min(n, ps.length); i++) {
      const old = ps[i];
      const nu = rollTowardArchetype(pos, old.classYear, t, pb, wantArch);
      nu.schoolId = school.id;
      school.roster[school.roster.indexOf(old)] = nu;
    }
  };
  if (defFront === "3-4") {
    shapePos("DE", "DE-Power", 3);
    shapePos("OLB", "OLB-Rush", 3);
  } else if (defFront === "4-3") {
    shapePos("DE", "DE-Speed", 2);
  }
  // D17 BATCH D: the identity shaper writes through the seam — defBaseFront is
  // the DEFBOOK's field and offFormations/tendency are the BOOK's, so poking
  // them onto the flat plan left the books describing the pre-identity team.
  const _identityPatch = { defBaseFront: defFront || "4-3" };
  const OFF_BY_QB = {
    "QB-Scrambler": { formations: [{ id: "Pistol/RPO", weight: 55 }, { id: "Spread", weight: 30 }, { id: "Power-I", weight: 15 }], tendency: "Balanced" },
    "QB-Gunslinger": { formations: [{ id: "Air Raid", weight: 45 }, { id: "Spread", weight: 40 }, { id: "Single Back", weight: 15 }], tendency: "Heavy Pass" },
    "QB-Pocket": { formations: [{ id: "Single Back", weight: 45 }, { id: "Spread", weight: 30 }, { id: "Power-I", weight: 25 }], tendency: "Balanced" },
    "QB-Game-Manager": { formations: [{ id: "Single Back", weight: 40 }, { id: "Power-I", weight: 35 }, { id: "Spread", weight: 25 }], tendency: "Heavy Run" }
  };
  const off = OFF_BY_QB[qbPref];
  if (off) {
    _identityPatch.offFormations = off.formations;
    _identityPatch.tendency = off.tendency;
  }
  setPlanFields(school, _identityPatch);
  school.depthOrder = buildRoleSortedDepthOrder(school.roster);
  school.depthChart = buildDepthChart(school.roster, school.gameplan, school.depthOrder);
}
// ── Books → roster leaning (new-game wizard, 2026-08-17, owner) ──────────────
// The wizard's Blueprint step used to ask "what kind of football do you believe
// in?" — a QB type and a defensive front — and shape the first roster off the
// answer. That question retired: the STARTING BOOKS are the identity now, so the
// roster leans off the books the coach actually picked instead of a parallel
// pair of questions. This reads any book — a starter, a preset, or a Workshop
// custom — down to the same two hints applyIdentityToSchool already consumes, so
// nothing downstream changes: the front seven and QB room still nudge toward the
// scheme, "loosely" (only the top few bodies at each spot), exactly as before.
//
// Deliberately soft. A book names formations and a base front; it does NOT name
// a QB archetype. So the offense hint is inferred from the book's dominant
// formation family and run/pass lean — the same signal a scout would read off a
// call sheet — and a book that leans on nothing in particular returns no hint,
// which leaves that side of the roster as generated.
function offHintFromBook(book) {
  if (!book) return null;
  const forms = book.offFormations || book.formations || [];
  if (!forms.length && !book.tendency) return null;
  const total = forms.reduce((s, f) => s + (typeof f.weight === "number" ? f.weight : 1), 0) || 1;
  const wOf = (ids) => forms.filter((f) => ids.includes(f.id)).reduce((s, f) => s + (typeof f.weight === "number" ? f.weight : 1), 0);
  const air = wOf(["Air Raid", "Empty"]) / total;
  const option = wOf(["Pistol/RPO", "Flexbone", "Wishbone"]) / total;
  const ground = wOf(["Power-I", "Jumbo"]) / total;
  const tend = book.tendency || "";
  // A hint fires only when a family actually LEADS the book — a change-up
  // Power-I inside a balanced West Coast book is not a ground identity. The
  // threshold is deliberately loose (a book usually leads with 35–45% of one
  // family), and a book that leads with nothing falls through to the pocket
  // default, which is what "balanced" means for the QB room.
  const lead = 0.34;
  if (air >= lead && air >= option && air >= ground) return "QB-Gunslinger";
  if (option >= lead && option >= ground) return "QB-Scrambler";
  if (ground >= lead || /Heavy Run/i.test(tend)) return "QB-Game-Manager";
  if (/Heavy Pass/i.test(tend)) return "QB-Gunslinger";
  return "QB-Pocket";
}
function defHintFromBook(book) {
  const front = book && (book.defBaseFront || book.baseFront);
  if (!front) return null;
  // Two roster shapes exist: the 3-4 family wants big two-gap ends and stand-up
  // rush linebackers, the 4-3 family wants speed off the edge. Every base front
  // a book can carry maps to one of them — the heavy odd/eight-in-the-box fronts
  // (46 Bear, 4-4) lean like a 3-4, the four-down and sub packages lean 4-3 —
  // so a defensive book never shapes NOTHING the way it did when only the two
  // literal strings counted.
  if (front === "3-4" || front === "46/Bear" || front === "4-4") return "3-4";
  return "4-3";
}
// The wizard hands us whatever it resolved for each side: a starter/custom
// playbook object, a preset's gameplan, or null (team default). Returns the
// { qbPref, defFront } pair applyIdentityToSchool takes — either may be null,
// meaning "leave that side of the roster as generated."
function rosterHintsFromBooks(offBook, defBook) {
  return { qbPref: offHintFromBook(offBook), defFront: defHintFromBook(defBook) };
}
function availableStates() {
  const counts = {};
  for (const cities of Object.values(REGION_CITIES))
    for (const c of cities) if (c.s) counts[c.s] = (counts[c.s] || 0) + 1;
  return Object.entries(counts).filter(([, n]) => n >= 3).map(([s, n]) => ({ state: s, cities: n })).sort((a, b) => a.state.localeCompare(b.state));
}
function regionOfState(state2) {
  let best = null, bestN = 0;
  for (const [region, cities] of Object.entries(REGION_CITIES)) {
    const n = cities.filter((c) => c.s === state2).length;
    if (n > bestN) {
      bestN = n;
      best = region;
    }
  }
  return best || "Midwest";
}
function rollTowardArchetype(pos, classYear, tier, prestigeBonus, wantArch, tries = 300) {
  let p = createPlayer(pos, classYear, tier, prestigeBonus);
  for (let t = 0; t < tries && derivedArchetype(p) !== wantArch; t++) {
    p = createPlayer(pos, classYear, tier, prestigeBonus);
  }
  return p;
}
function generatePlayerProgram(world, { state: state2, division, qbPref, defFront, challenge = "standard", custom = null }) {
  var _a, _b, _c;
  const stateCities = Object.values(REGION_CITIES).flat().filter((c) => c.s === state2);
  if (!stateCities.length) throw new Error(`No gazetteer cities in ${state2}`);
  const homeRegion = regionOfState(state2);
  const allConfs = [...D1_CONFS, ...D2_CONFS, ...D3_CONFS].filter((c) => c.division === division && (division !== "D1" || c.conferenceClass !== "power"));
  const cLat = stateCities.reduce((s, c) => s + c.lat, 0) / stateCities.length;
  const cLng = stateCities.reduce((s, c) => s + c.lng, 0) / stateCities.length;
  const confDist = (c) => Math.hypot(c.lat - cLat, (c.lng - cLng) * 0.79);
  const inState = (cid) => world.schools.some((s) => s.conf === cid && s.state === state2);
  const conf = [...allConfs].sort(
    (a, b) => (inState(b.id) ? 1 : 0) - (inState(a.id) ? 1 : 0) || confDist(a) - confDist(b)
  )[0];
  if (!conf) throw new Error(`No ${division} conference available`);
  const cls = conf.division === "D1" ? conf.conferenceClass : conf.division;
  const used = {
    names: new Set(world.schools.map((s) => s.name)),
    abbrs: new Set(world.schools.map((s) => s.abbr)),
    // Cities intentionally NOT seeded from the world: the player's school may
    // share a town with an existing program (cities host multiple colleges
    // all the time). In dense states every gazetteer city is already taken,
    // and seeding this set forced the generator away from "Warrensburg
    // College"-style names into location-blind person/saint fallbacks.
    // Name/abbr collision guards above still prevent literal duplicates.
    cities: /* @__PURE__ */ new Set(),
    tokenPat: /* @__PURE__ */ new Set(),
    persons: /* @__PURE__ */ new Set(),
    saints: /* @__PURE__ */ new Set(),
    nickGlobal: {}
  };
  for (const s of world.schools) used.nickGlobal[s.nick] = (used.nickGlobal[s.nick] || 0) + 1;
  const VKEY = "__playerState";
  REGION_CITIES[VKEY] = stateCities;
  STATE_TOKENS[VKEY] = (STATE_TOKENS[homeRegion] || []).filter((tk) => (tk.states || []).includes(state2));
  DENOMS_BY_REGION[VKEY] = DENOMS_BY_REGION[homeRegion] || DENOMS_DEFAULT;
  const basePatterns = NAME_PATTERNS[cls];
  const cut = basePatterns.filter(([k]) => k === "pc" || k === "sn").reduce((s, [, w]) => s + w, 0);
  const playerPatterns = basePatterns.filter(([k]) => k !== "pc" && k !== "sn").map(([k, w]) => [k, k === "cg" || k === "cd" ? w + Math.ceil(cut / 4) : w]);
  let ident;
  try {
    ident = makeIdentity(VKEY, cls, used, { patterns: playerPatterns, fallback: ["cd", "cg", "pc", "sn"] });
  } finally {
    delete REGION_CITIES[VKEY];
    delete STATE_TOKENS[VKEY];
    delete DENOMS_BY_REGION[VKEY];
  }
  const confMembers = world.schools.filter((s) => s.conf === conf.id);
  const confNicks = new Set(confMembers.map((s) => s.nick));
  const nickPick = pickNickname({ cls, type: ident.type, region: homeRegion }, confNicks, used);
  const abbr = makeAbbr(ident.name, used.abbrs);
  const confColorKeys = new Set(confMembers.map((s) => (s.colors || []).join("")));
  let c1, c2;
  for (let t = 0; t < 12; t++) {
    [c1, c2] = COLOR_PAIRS[randInt3(0, COLOR_PAIRS.length - 1)];
    if (!confColorKeys.has(c1 + c2)) break;
  }
  const clampP = prestigeClamp(cls, division);
  const divCap = ((_a = C.PRESTIGE_MAX) == null ? void 0 : _a[division]) || clampP.max;
  const prestige = challenge === "rebuild" ? clampP.min : challenge === "powerhouse" ? divCap : challenge === "custom" ? Math.max(1, Math.min(divCap, (_b = custom == null ? void 0 : custom.prestige) != null ? _b : 2)) : Math.max(clampP.min, Math.min(2, clampP.max));
  const flavor = makeFlavor(cls, ident.type, prestige, nickPick.n);
  const cityObj = ident.city || stateCities[randInt3(0, stateCities.length - 1)];
  const school = {
    id: uniqueSchoolId(ident.name, new Set(world.schools.map((s) => s.id))),
    name: ident.name,
    nick: nickPick.n,
    abbr,
    logo: nickPick.e || "\u{1F3C8}",
    facilities: facilitiesFor(prestige),
    staff: staffFor(prestige, division),
    conf: conf.id,
    division,
    lat: +(cityObj.lat + (Math.random() * 2 - 1) * LOC_JITTER_DEG).toFixed(2),
    lng: +(cityObj.lng + (Math.random() * 2 - 1) * LOC_JITTER_DEG).toFixed(2),
    city: cityObj.c,
    state: cityObj.s,
    type: ident.type,
    control: flavor.control,
    enrollment: flavor.enrollment,
    founded: flavor.founded,
    stadium: flavor.stadium,
    prestige,
    baseline: prestige,
    prestigeMin: clampP.min,
    prestigeMax: clampP.max,
    colors: [c1, c2],
    // World enrichment (mirror generateWorld exactly):
    roster: [],
    record: { wins: 0, losses: 0, confWins: 0, confLosses: 0 },
    recentWins: [0, 0, 0],
    coach: null,
    gameplan: defaultGameplan(),
    weeklyPlan: defaultWeeklyPlan(),
    practiceMinutes: __spreadValues({}, DEFAULT_PRACTICE),
    depthChart: {},
    depthOrder: {},
    stats: emptyTeamStats()
  };
  school.roster = generateRoster(school);
  const tier = { D3: 1, D2: 2, D1: 3 }[division] || 1;
  const pBonus = prestigeTalentBonus(prestige, division);
  if (qbPref) {
    const qbs = school.roster.filter((p) => p.position === "QB");
    for (let i = 0; i < Math.min(3, qbs.length); i++) {
      const old = qbs[i];
      const nu = rollTowardArchetype("QB", old.classYear, tier, pBonus, qbPref);
      nu.schoolId = school.id;
      school.roster[school.roster.indexOf(old)] = nu;
    }
  }
  applyIdentityToSchool(school, qbPref, defFront, tier, pBonus);
  const ceiling = cls === "power" ? 6 : cls === "midMajor" ? 3 : ((_c = C.PRESTIGE_MAX) == null ? void 0 : _c[division]) || 5;
  const kings = confMembers.filter((s) => s.prestige >= ceiling);
  const replaceable = confMembers.filter((s) => !(kings.length === 1 && kings[0].id === s.id));
  const replaced = [...replaceable].sort((a, b) => {
    var _a2, _b2;
    return a.prestige - b.prestige || (((_a2 = a.recentWins) == null ? void 0 : _a2[0]) || 0) - (((_b2 = b.recentWins) == null ? void 0 : _b2[0]) || 0);
  })[0];
  const idx = world.schools.indexOf(replaced);
  world.schools.splice(idx, 1, school);
  school.lore = {
    footballSince: (/* @__PURE__ */ new Date()).getFullYear(),
    titles: [],
    confTitles: [],
    postseasons: 0,
    legend: null,
    tradition: "the traditions start with you \u2014 nobody has told these students what to chant yet",
    events: [{ year: (/* @__PURE__ */ new Date()).getFullYear(), kind: "era", text: `${school.name} plays its first season.` }],
    allTime: { wins: 0, losses: 0, ties: 0 },
    founded: true
  };
  if (replaced == null ? void 0 : replaced.rival) {
    const enemy = world.schools.find((s) => s.id === replaced.rival.schoolId);
    school.rival = __spreadProps(__spreadValues({}, replaced.rival), { inheritedSeat: replaced.name });
    if (enemy == null ? void 0 : enemy.rival) {
      enemy.rival.schoolId = school.id;
      enemy.rival.name = school.name;
      if (enemy.rival.holderId === replaced.id) enemy.rival.holderId = school.id;
    }
    if (school.rival.holderId === replaced.id) school.rival.holderId = school.id;
  }
  return { school, replaced, conference: { id: conf.id, name: conf.name, short: conf.short, division: conf.division } };
}
// ── Authored star players (Team Editor phase 2, Aug 2026) ──────────────────
// Full 85-man authoring is impractical; the emotional core is a handful of NAMED
// stars — your franchise QB, a stud edge. A star is { position, name, classYear,
// caliber, archetype? }. coinStarPlayer builds a calibrated player (calibers are
// tuned so Solid<Star<Superstar by compositeRating, verified in star_player_probe),
// and applyTeamStars drops each onto a generated roster as the starter at its
// spot (swapping out the weakest body there to keep position counts intact).
var STAR_CALIBER = {
  superstar: { tier: 3, bonus: 13, tries: 24, label: "Superstar" },
  star: { tier: 3, bonus: 7, tries: 8, label: "Star" },
  solid: { tier: 2, bonus: 2, tries: 3, label: "Solid" }
};
function coinStarPlayer({ position = "QB", classYear = "JR", caliber = "star", archetype = null, name = null } = {}) {
  const pos = POSITIONS.includes(position) ? position : "QB";
  const cy = CLASS_YEARS.includes(classYear) ? classYear : "JR";
  const c = STAR_CALIBER[caliber] || STAR_CALIBER.star;
  let best = null, bestArch = null;
  for (let i = 0; i < c.tries; i++) {
    const p = createPlayer(pos, cy, c.tier, c.bonus);
    if (!best || p.compositeRating > best.compositeRating) best = p;
    if (archetype && derivedArchetype(p) === archetype && (!bestArch || p.compositeRating > bestArch.compositeRating)) bestArch = p;
  }
  const chosen = (archetype && bestArch) ? bestArch : best;
  if (name && String(name).trim()) chosen.name = String(name).trim().slice(0, 32);
  return chosen;
}
function applyTeamStars(school, stars) {
  if (!school || !Array.isArray(stars) || !stars.length) return school;
  for (const st of stars) {
    if (!st || !POSITIONS.includes(st.position)) continue;
    const p = coinStarPlayer(st);
    p.schoolId = school.id;
    const atPos = school.roster.filter((x) => x.position === st.position).sort((a, b) => b.compositeRating - a.compositeRating);
    if (atPos.length) { const weakest = atPos[atPos.length - 1]; school.roster = school.roster.filter((x) => x.id !== weakest.id); }
    // The promise is STARTER, not "usually starter" (owner-ratified 2026-08-15):
    // a loaded roster can out-roll a Solid/Star caliber, so if the best surviving
    // body at the spot still outrates the authored star, nudge the star just
    // above him — your named guy is genuinely the top player at his position.
    const rival = school.roster.filter((x) => x.position === st.position).reduce((best, x) => !best || x.compositeRating > best.compositeRating ? x : best, null);
    if (rival && rival.compositeRating >= p.compositeRating) p.compositeRating = Math.min(99, rival.compositeRating + 1);
    // Depth sorting for the front-seven/secondary runs on roleRatings, so the
    // star has to top those views too, against EVERY surviving teammate.
    if (p.roleRatings) {
      const peers = school.roster.filter((x) => x.position === st.position);
      for (const role of Object.keys(p.roleRatings)) {
        const top = peers.reduce((m, x) => Math.max(m, x.roleRatings && x.roleRatings[role] != null ? x.roleRatings[role] : 0), 0);
        if (top >= p.roleRatings[role]) p.roleRatings[role] = Math.min(99, top + 1);
      }
    }
    school.roster.push(p);
  }
  school.depthOrder = buildRoleSortedDepthOrder(school.roster);
  school.depthChart = buildDepthChart(school.roster, school.gameplan, school.depthOrder);
  return school;
}
function generateExhibitionTeam(division, prestige) {
  var _a;
  const divCap = ((_a = C.PRESTIGE_MAX) == null ? void 0 : _a[division]) || 5;
  const p = Math.max(1, Math.min(divCap, Math.round(prestige || 1)));
  const cls = division === "D1" ? p >= 4 ? "power" : "midMajor" : division;
  const used = {
    names: /* @__PURE__ */ new Set(),
    abbrs: /* @__PURE__ */ new Set(),
    cities: /* @__PURE__ */ new Set(),
    tokenPat: /* @__PURE__ */ new Set(),
    persons: /* @__PURE__ */ new Set(),
    saints: /* @__PURE__ */ new Set(),
    nickGlobal: {}
  };
  const regions = Object.keys(REGION_CITIES);
  const region = regions[randInt3(0, regions.length - 1)];
  const ident = makeIdentity(region, cls, used);
  const nickPick = pickNickname({ cls, type: ident.type, region }, /* @__PURE__ */ new Set(), used);
  const abbr = makeAbbr(ident.name, used.abbrs);
  const [c1, c2] = COLOR_PAIRS[randInt3(0, COLOR_PAIRS.length - 1)];
  const flavor = makeFlavor(cls, ident.type, p, nickPick.n);
  const cities = REGION_CITIES[region];
  const cityObj = ident.city || cities[randInt3(0, cities.length - 1)];
  const school = {
    id: `EXH-${abbr}-${randInt3(1e3, 9999)}`,
    name: ident.name,
    nick: nickPick.n,
    abbr,
    logo: nickPick.e || "\u{1F3C8}",
    facilities: facilitiesFor(p),
    staff: staffFor(p, division),
    conf: null,
    division,
    lat: cityObj.lat,
    lng: cityObj.lng,
    city: cityObj.c,
    state: cityObj.s,
    type: ident.type,
    control: flavor.control,
    enrollment: flavor.enrollment,
    founded: flavor.founded,
    stadium: flavor.stadium,
    prestige: p,
    baseline: p,
    prestigeMin: 1,
    prestigeMax: divCap,
    colors: [c1, c2],
    roster: [],
    record: { wins: 0, losses: 0, confWins: 0, confLosses: 0 },
    recentWins: [0, 0, 0],
    coach: null,
    gameplan: defaultGameplan(),
    weeklyPlan: defaultWeeklyPlan(),
    practiceMinutes: __spreadValues({}, DEFAULT_PRACTICE),
    depthChart: {},
    depthOrder: {},
    stats: emptyTeamStats()
  };
  school.roster = generateRoster(school);
  school.coach = generateAICoach(school);
  school.depthOrder = buildRoleSortedDepthOrder(school.roster);
  school.depthChart = buildDepthChart(school.roster, school.gameplan, school.depthOrder);
  return school;
}
// ── compileLeague (Creativity Tools, Aug 2026) ─────────────────────────────
// Turns an author-friendly league blueprint (a `leagues` creation's .data, or a
// one-team `seed` from the `teams` shelf) into the two source tables the
// generateWorld(opts) seam accepts: { schools, conferences }. Pure — no globals
// mutated, no RNG state assumed (it uses Math.random only for cosmetic jitter,
// same as makeIdentity). Fails LOUD: a broken blueprint throws a readable Error
// rather than compiling a broken world. See Ref/LEAGUE_BLUEPRINT.md for the
// full shape + the adopted working defaults.
var LEAGUE_DIVS = { D1: 1, D2: 1, D3: 1 };
// conferenceClass in live data is "power" / "midMajor" / null; author blueprints
// may say "power"/"midmajor"/"lowmajor". Normalize → the internal `cls` the
// world-gen helpers (stadiumCapacity, makeFlavor) speak.
function clsForConf(division, conferenceClass) {
  if (division === "D1") return String(conferenceClass || "").toLowerCase() === "power" ? "power" : "midMajor";
  return division;
}
function normConfClass(division, conferenceClass) {
  if (division === "D1") return String(conferenceClass || "").toLowerCase() === "power" ? "power" : "midMajor";
  return null;
}
function nationalCentroid() {
  const vals = Object.values(REGION_CENTROIDS);
  if (!vals.length) return { lat: 39.5, lng: -98.35 };
  let lat = 0, lng = 0;
  for (const v of vals) {
    lat += v.lat;
    lng += v.lng;
  }
  return { lat: lat / vals.length, lng: lng / vals.length };
}
function jitterGeo(pt) {
  return {
    lat: +(pt.lat + (Math.random() * 2 - 1) * LOC_JITTER_DEG).toFixed(2),
    lng: +(pt.lng + (Math.random() * 2 - 1) * LOC_JITTER_DEG).toFixed(2)
  };
}
// Distribute a school's prestige around its conference's tier, within the
// division band. A roughly symmetric spread centered on the tier (mostly the
// tier or ±1, occasionally ±2) so a blue-blood conference fills with strong
// programs and a weak one with strugglers — the D2/D3 hierarchy the game lacks
// today. Null tier centers on the band midpoint.
function distributePrestige(tier, division) {
  var _a;
  const max = ((_a = C.PRESTIGE_MAX) == null ? void 0 : _a[division]) || 6;
  const center = tier != null ? tier : Math.round((1 + max) / 2);
  const t = Math.max(1, Math.min(max, center));
  const r = Math.random();
  const off = r < 0.34 ? 0 : r < 0.59 ? 1 : r < 0.84 ? -1 : r < 0.92 ? 2 : -2;
  return Math.max(1, Math.min(max, t + off));
}
function compileLeague(blueprint) {
  var _a;
  const fail = (msg) => {
    throw new Error(`compileLeague: ${msg}`);
  };
  if (!blueprint || typeof blueprint !== "object") fail("blueprint must be an object");
  const mode = blueprint.mode === "replace" ? "replace" : "seed";
  const bpConfs = Array.isArray(blueprint.conferences) ? blueprint.conferences : [];
  const bpTeams = Array.isArray(blueprint.teams) ? blueprint.teams : [];
  if (!bpTeams.length) fail("blueprint has no teams");
  const warnings = [];

  // Base tables. replace = empty; seed = deep clones of the procedural world so
  // nothing module-level is mutated.
  const outConfs = mode === "replace" ? {} : JSON.parse(JSON.stringify(CONFERENCES));
  const baseSchools = mode === "replace" ? [] : JSON.parse(JSON.stringify(SCHOOL_DATA));

  // ── validate + normalize conferences ────────────────────────────────────
  for (const c of bpConfs) {
    if (!c || !c.id) fail("a conference is missing an id");
    if (!LEAGUE_DIVS[c.division]) fail(`conference ${c.id}: bad division ${JSON.stringify(c.division)}`);
    if (mode === "replace" && outConfs[c.id]) fail(`duplicate conference id ${c.id}`);
    // Optional conference PRESTIGE TIER (Season Mode / Division Editor): the
    // center of the band its member schools' prestige distributes around at gen.
    // This is the blue-blood/mid-major control, generalized to every division —
    // it's what gives D2/D3 their own conference hierarchy. Validated to the
    // division band if present; absent means schools carry their own prestige.
    const cpMax = ((_a = C.PRESTIGE_MAX) == null ? void 0 : _a[c.division]) || 6;
    if (c.prestige != null && !(c.prestige >= 1 && c.prestige <= cpMax)) fail(`conference ${c.id}: prestige tier ${c.prestige} out of band 1..${cpMax} for ${c.division}`);
    outConfs[c.id] = {
      name: String(c.name || c.id).slice(0, 48),
      short: String(c.short || c.id).slice(0, 6),
      division: c.division,
      conferenceClass: normConfClass(c.division, c.conferenceClass),
      prestige: c.prestige != null ? c.prestige : null
    };
  }

  // ── validate teams ──────────────────────────────────────────────────────
  const usedIds = new Set(baseSchools.map((s) => s.id));
  const teamIds = new Set();
  for (const t of bpTeams) {
    if (!t || !t.id) fail("a team is missing an id");
    if (teamIds.has(t.id)) fail(`duplicate team id ${t.id}`);
    teamIds.add(t.id);
    if (!t.name) fail(`team ${t.id}: missing name`);
    if (!LEAGUE_DIVS[t.division]) fail(`team ${t.id}: bad division ${JSON.stringify(t.division)}`);
    const conf = outConfs[t.conf];
    if (!conf) fail(`team ${t.id}: conf ${JSON.stringify(t.conf)} not found (${mode === "seed" ? "no procedural or blueprint conference by that id" : "not in blueprint"})`);
    if (conf.division !== t.division) fail(`team ${t.id}: division ${t.division} != conference ${t.conf} division ${conf.division}`);
    // Prestige is now OPTIONAL — if absent it's distributed from the conference
    // tier at build (below). Validated only when the author set it explicitly.
    const pMax = ((_a = C.PRESTIGE_MAX) == null ? void 0 : _a[t.division]) || 6;
    if (t.prestige != null && !(t.prestige >= 1 && t.prestige <= pMax)) fail(`team ${t.id}: prestige ${t.prestige} out of band 1..${pMax} for ${t.division}`);
  }

  // ── fill defaults + build engine-shaped schools ─────────────────────────
  // abbr dedup runs against EVERY abbr in the final world, author-set or not.
  const usedAbbrs = new Set(baseSchools.map((s) => s.abbr));
  const built = [];
  const needGeo = [];
  for (const t of bpTeams) {
    const conf = outConfs[t.conf];
    const cls = clsForConf(t.division, conf.conferenceClass);
    // Explicit team prestige wins; otherwise DISTRIBUTE around the conference
    // tier (blue-blood conf -> its schools skew high, weak conf -> low), within
    // the division band. No tier + no explicit -> centered on the band midpoint.
    const prestige = typeof t.prestige === "number" ? t.prestige : distributePrestige(conf.prestige, t.division);
    const type = t.type || "stateUniversity";
    const flavor = makeFlavor(cls, type, prestige, t.nick || "Statesmen");
    const clamp7 = prestigeClamp(cls, t.division);
    // abbr: honor the author's, but ALWAYS dedup — on collision, auto-suffix + warn.
    let abbr;
    if (t.abbr && typeof t.abbr === "string") {
      abbr = t.abbr.toUpperCase().slice(0, 4);
      if (usedAbbrs.has(abbr)) {
        const orig = abbr;
        let n = 2;
        while (usedAbbrs.has(abbr)) abbr = orig.slice(0, 3) + n++;
        warnings.push(`team ${t.id}: abbr ${orig} collided → ${abbr}`);
      }
      usedAbbrs.add(abbr);
    } else {
      abbr = makeAbbr(t.name, usedAbbrs);
    }
    const school = {
      id: t.id,
      name: String(t.name).slice(0, 48),
      nick: t.nick || "Statesmen",
      abbr,
      logo: t.logo || "\u{1F3C8}",
      facilities: t.facilities || facilitiesFor(prestige),
      staff: t.staff || staffFor(prestige, t.division),
      conf: t.conf,
      division: t.division,
      lat: typeof t.lat === "number" ? t.lat : null,
      lng: typeof t.lng === "number" ? t.lng : null,
      city: t.city || "",
      state: t.state || "",
      type,
      control: t.control || flavor.control,
      enrollment: t.enrollment || flavor.enrollment,
      founded: t.founded || flavor.founded,
      stadium: t.stadium || flavor.stadium,
      prestige,
      baseline: t.baseline != null ? t.baseline : prestige,
      prestigeMin: t.prestigeMin != null ? t.prestigeMin : clamp7.min,
      prestigeMax: t.prestigeMax != null ? t.prestigeMax : clamp7.max,
      colors: Array.isArray(t.colors) && t.colors.length === 2 ? t.colors : COLOR_PAIRS[Math.floor(Math.random() * COLOR_PAIRS.length)]
    };
    // Carry editor crest overrides (custom letters / rerolled shield) so a
    // compiled custom league keeps the identity you drew.
    if (t.crestText) school.crestText = t.crestText;
    if (t.crestSeed) school.crestSeed = t.crestSeed;
    // geo pass 1: explicit lat/lng > state centroid. Anything left goes to pass 2.
    if (school.lat != null && school.lng != null) {
      // author pin — keep as given
    } else if (school.state && stateCentroid(school.state)) {
      const g = jitterGeo(stateCentroid(school.state));
      school.lat = g.lat;
      school.lng = g.lng;
    } else {
      needGeo.push(school);
    }
    built.push(school);
  }
  // geo pass 2: unplaced schools land in their conference's footprint (mean of
  // placed conf-mates), else the national centroid — so every school gets rivals.
  for (const s of needGeo) {
    const mates = built.filter((x) => x.conf === s.conf && x.lat != null && x.lng != null);
    let pt;
    if (mates.length) {
      pt = { lat: mates.reduce((a, m) => a + m.lat, 0) / mates.length, lng: mates.reduce((a, m) => a + m.lng, 0) / mates.length };
    } else {
      pt = nationalCentroid();
    }
    const g = jitterGeo(pt);
    s.lat = g.lat;
    s.lng = g.lng;
  }

  // ── merge / assemble ────────────────────────────────────────────────────
  let outSchools;
  if (mode === "replace") {
    outSchools = built;
  } else {
    // seed: blueprint teams REPLACE a procedural team of the same id (override),
    // else are ADDED and one procedural team of the same division is trimmed from
    // the largest procedural conference so division counts hold.
    const base = baseSchools.slice();
    const byId = new Map(base.map((s, i) => [s.id, i]));
    for (const s of built) {
      if (byId.has(s.id)) {
        base[byId.get(s.id)] = s;
      } else {
        // trim one procedural team of the same division from the biggest conf
        // that isn't a blueprint conf and can spare it (>2 members).
        const confSize = {};
        for (const b of base) if (b.division === s.division) confSize[b.conf] = (confSize[b.conf] || 0) + 1;
        const bpConfIds = new Set(bpConfs.map((c) => c.id));
        let victimConf = null, best = 2;
        for (const [cid, n] of Object.entries(confSize)) {
          if (!bpConfIds.has(cid) && n > best) {
            best = n;
            victimConf = cid;
          }
        }
        if (victimConf) {
          const vi = base.findIndex((b) => b.conf === victimConf && !teamIds.has(b.id));
          if (vi >= 0) base.splice(vi, 1);
        }
        base.push(s);
      }
    }
    outSchools = base;
  }

  // ── post-assembly validation (schedule sanity) ──────────────────────────
  const confPop = {};
  for (const s of outSchools) confPop[s.conf] = (confPop[s.conf] || 0) + 1;
  for (const [cid, n] of Object.entries(confPop)) {
    if (n < 2) fail(`conference ${cid} has ${n} team(s) — a conference needs at least 2 to play`);
    if (n < 8) warnings.push(`conference ${cid} has only ${n} teams (light schedule)`);
  }
  return { schools: outSchools, conferences: outConfs, warnings };
}
// ── The division assembler (Season Mode / division-scoped leagues, Aug 2026) ─
// A world is three division slots (D1/D2/D3). Each slot's source is either
// 'static' (the real division from the module tables) or a custom division
// blueprint ({conferences, teams} all of that division). assembleWorldSources
// composes the chosen slots into the { schools, conferences } the generateWorld
// seam accepts — so Season Mode passes ONE slot (a single-division world) and a
// dynasty passes all three, mixing custom and procedural per division. See
// Ref/SEASON_MODE.md. Static slots clone the real tables (never mutate them);
// custom slots run through compileLeague (replace), which validates + fills
// defaults + geo + dedups within the division. A final pass dedups abbreviations
// ACROSS divisions, since compileLeague only guarantees uniqueness within one.
function assembleWorldSources(sources) {
  const fail = (msg) => {
    throw new Error(`assembleWorldSources: ${msg}`);
  };
  if (!sources || typeof sources !== "object") fail("sources must be an object");
  const divs = Object.keys(sources).filter((d) => LEAGUE_DIVS[d]);
  if (!divs.length) fail("no valid division sources (expected D1/D2/D3)");
  const outSchools = [];
  const outConfs = {};
  const warnings = [];
  for (const div of divs) {
    const source = sources[div];
    if (!source || source === "static") {
      for (const s of SCHOOL_DATA) if (s.division === div) outSchools.push(JSON.parse(JSON.stringify(s)));
      for (const [id, c] of Object.entries(CONFERENCES)) if (c.division === div) outConfs[id] = __spreadValues({}, c);
    } else {
      const confs = (source.conferences || []).map((c) => __spreadProps(__spreadValues({}, c), { division: c.division || div }));
      const teams = (source.teams || []).map((t) => __spreadProps(__spreadValues({}, t), { division: t.division || div }));
      const compiled = compileLeague({ mode: "replace", conferences: confs, teams });
      for (const s of compiled.schools) outSchools.push(s);
      Object.assign(outConfs, compiled.conferences);
      if (compiled.warnings) for (const w of compiled.warnings) warnings.push(`${div}: ${w}`);
    }
  }
  const usedAbbrs = /* @__PURE__ */ new Set();
  for (const s of outSchools) {
    let a = s.abbr || "SCH";
    if (usedAbbrs.has(a)) {
      const orig = a;
      let n = 2;
      while (usedAbbrs.has(a)) a = orig.slice(0, 3) + n++;
      warnings.push(`abbr ${orig} collided across divisions → ${a}`);
      s.abbr = a;
    }
    usedAbbrs.add(a);
  }
  return { schools: outSchools, conferences: outConfs, warnings };
}
function generateWorld(opts = {}) {
  // ── The world-source seam (Creativity Tools, Aug 2026) ──────────────────
  // generateWorld now takes an options bag whose ONLY job today is to name the
  // source tables the world is built from. Both default to the module globals,
  // so `generateWorld()` and `generateWorld({})` are byte-identical to the
  // pre-seam function — proven by creator_world_probe (seeded-RNG snapshot diff).
  // This is the single door custom content walks through later: a custom LEAGUE
  // is a replacement {schools, conferences} pair, and custom-TEAM injection is a
  // modified `schools` array. Neither is wired yet — the league-blueprint shape
  // is being spec'd first (see Ref/LEAGUE_BLUEPRINT.md). Inert by default,
  // exactly like the formation-variation and creator-store seams.
  const sourceSchools = (opts == null ? void 0 : opts.schools) || SCHOOL_DATA;
  const sourceConferences = (opts == null ? void 0 : opts.conferences) || CONFERENCES;
  // World-scoped name dedup: SCHOOL_DATA staff were named at module load, so a
  // bare reset would let fresh HC rolls collide with the coordinators already
  // seated. Reset, then re-register the staff this world is actually keeping.
  resetCoachNames();
  for (const s of sourceSchools) {
    if (s.staff && s.staff.oc && s.staff.oc.name) registerCoachName(s.staff.oc.name);
    if (s.staff && s.staff.dc && s.staff.dc.name) registerCoachName(s.staff.dc.name);
  }
  const schools = sourceSchools.map((s) => __spreadProps(__spreadValues({}, s), {
    roster: [],
    record: { wins: 0, losses: 0, confWins: 0, confLosses: 0 },
    recentWins: [0, 0, 0],
    // last 3 seasons
    prestige: s.prestige,
    prestigeMin: s.prestigeMin,
    prestigeMax: s.prestigeMax,
    division: s.division,
    coach: null,
    // assigned after world gen
    gameplan: defaultGameplan(),
    weeklyPlan: defaultWeeklyPlan(),
    // per-opponent layer (Chunk 6 UI)
    practiceMinutes: __spreadValues({}, DEFAULT_PRACTICE),
    depthChart: {},
    depthOrder: {},
    stats: emptyTeamStats()
  }));
  for (const school of schools) {
    school.roster = generateRoster(school);
    school.depthOrder = buildRoleSortedDepthOrder(school.roster);
    school.depthChart = buildDepthChart(school.roster, school.gameplan, school.depthOrder);
  }
  for (const school of schools) {
    school.coach = generateAICoach(school);
  }
  for (const school of schools) {
    school.lore = generateProgramLore(school);
  }
  generateRivalries(schools, distanceMiles);
  return {
    schools,
    conferences: sourceConferences,
    season: 1,
    recruits: []
    // filled at season start
  };
}
function generateRoster(school) {
  const DIV_TIER = { D3: 1, D2: 2, D1: 3 };
  const tier = DIV_TIER[school.division] || 1;
  const prestigeBonus = prestigeTalentBonus(school.prestige, school.division);
  const total = Object.values(ROSTER_TARGETS).reduce((s, v) => s + v, 0);
  const cyPool = [];
  for (let k = 0; k < total; k++) cyPool.push(CLASS_YEARS[k % 4]);
  shuffle(cyPool);
  let idx = 0;
  const roster = [];
  for (const [pos, count] of Object.entries(ROSTER_TARGETS)) {
    for (let i = 0; i < count; i++) {
      const p = createPlayer(pos, cyPool[idx++], tier, prestigeBonus);
      p.schoolId = school.id;
      roster.push(p);
    }
  }
  return roster;
}
function orderedIds(roster, pos, override = []) {
  const active = new Set(
    roster.filter((p) => p.position === pos && p.injuryGamesOut === 0).map((p) => p.id)
  );
  const kept = override.filter((id) => active.has(id));
  const keptSet = new Set(kept);
  const remaining = [...active].filter((id) => !keptSet.has(id)).sort((a, b) => {
    var _a, _b, _c, _d;
    const ra = (_b = (_a = roster.find((p) => p.id === a)) == null ? void 0 : _a.compositeRating) != null ? _b : 0;
    const rb = (_d = (_c = roster.find((p) => p.id === b)) == null ? void 0 : _c.compositeRating) != null ? _d : 0;
    return rb - ra;
  });
  return [...kept, ...remaining];
}
function buildDepthChart(roster, gameplan, depthOrder = {}) {
  const chart = {};
  for (const pos of ["QB", "RB", "WR", "TE", "OL", "DE", "DT", "OLB", "LB", "CB", "S", "K", "P"]) {
    chart[pos] = orderedIds(roster, pos, depthOrder[pos]);
  }
  return chart;
}
function buildRoleSortedDepthOrder(roster) {
  const posRole = {
    DE: "DE-Base",
    OLB: "OLB-Blitz",
    DT: "DT-3tech",
    LB: "LB-Thumper",
    CB: "CB-Press",
    S: "S-Free"
  };
  const order = {};
  for (const [pos, role] of Object.entries(posRole)) {
    order[pos] = [...roster].filter((p) => p.position === pos).sort((a, b) => {
      var _a, _b, _c, _d;
      return ((_b = (_a = b.roleRatings) == null ? void 0 : _a[role]) != null ? _b : b.compositeRating) - ((_d = (_c = a.roleRatings) == null ? void 0 : _c[role]) != null ? _d : a.compositeRating);
    }).map((p) => p.id);
  }
  return order;
}
function generateAICoach(school) {
  const personality = {
    aggression: Math.random(),
    // 0-1
    talentEval: 0.3 + Math.random() * 0.7,
    // higher = better evaluator
    loyaltyToLocal: Math.random()
  };
  return {
    id: uuid(),
    name: rollCoachName(),
    isAI: true,
    schoolId: school.id,
    prestige: school.prestige,
    reputation: "C",
    skills: freshSkills(),
    // The run clock (DNA TREE §8): rolled at hire, ticks in updateAICarousel,
    // NEVER resets on a poach — age-based retirement replaces tenure-based.
    age: randInt3(C.COACH_AGE.HC_MIN, C.COACH_AGE.HC_MAX),
    wins: school.recentWins.reduce((s, v) => s + v, 0),
    budget: 0,
    scholarshipsAvailable: 0,
    recruitBoard: [],
    personality,
    seasonRecord: { wins: 0, losses: 0 },
    careerWins: 0,
    careerLosses: 0,
    titles: 0,
    jobSecurity: C.JOBSEC_START,
    status: "employed",
    tenureSeasons: 0,
    lastDelta: null,
    // Real contract term so firings/renewals mirror life: a deal runs a few
    // seasons, and the carousel (updateAICarousel) decides at expiry whether
    // to renew, let it lapse, or move on. Prestige buys a slightly longer leash.
    contract: { endSeason: 1 + randInt3(2, 4) + (school.prestige >= 5 ? 1 : 0) },
    dominanceStreak: 0
  };
}
function defaultGameplan() {
  return {
    offFormations: [
      { id: "Single Back", weight: 40 },
      { id: "Spread", weight: 35 },
      { id: "Power-I", weight: 25 }
    ],
    defBaseFront: "4-3",
    tendency: "Balanced",
    rushInPct: 60,
    passDepth: { short: 40, medium: 40, deep: 20 },
    // OD-8 (D16, 2026-08-18): the stop is the dial; blitzPct is its derived
    // mirror (balanced → 20) for legacy readers. OD-9 (D16): pressureSource no
    // longer ships — the sim deleted it at every kickoff; old saves still load.
    defAggression: "balanced",
    blitzPct: 20,
    coverageScheme: "balanced",
    greenDog: false,
    spyQB: false,
    targetShares: { WR1: 22, WR2: 20, WR3: 16, TE1: 20, RB1: 14 },
    // item 16 — the coach's editable DEFAULT target shares, keyed by RECEIVER
    // (WR1/WR2/WR3/TE1/RB1) so the default follows the man wherever he lines up.
    // A formation slot maps to its receiver via defaultShareFor; per-formation
    // overrides (keyed by position/slot) live on the Depth Chart field view.
    fourthDown: "Moderate",
    maxFGDist: 42,
    situations: {},
    // situational overrides — empty = all-AUTO (legacy behavior)
    baseTempo: "Normal"
    // tempo mechanics land in Chunk 4
  };
}
function emptyTeamStats() {
  return {
    games: 0,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    rushYds: 0,
    passYds: 0,
    totalYds: 0,
    turnovers: 0,
    sacks: 0,
    sacksAllowed: 0
  };
}
function repairRecruitLocations(world) {
  var _a;
  if (!(world == null ? void 0 : world.recruits) || !((_a = world == null ? void 0 : world.schools) == null ? void 0 : _a.length)) return 0;
  let fixed = 0;
  for (const r of world.recruits) {
    let touched = false;
    if (!r.hometown || r.hometown.lat == null || r.hometown.lng == null || !r.hometown.city) {
      r.hometown = randomLocation();
      touched = true;
    }
    if (r.schoolDistances) {
      delete r.schoolDistances;
      touched = true;
    }
    if (r.distanceFromSchool == null || !Number.isFinite(r.distanceFromSchool)) {
      r.distanceFromSchool = Math.round(distanceMiles(world.schools[0].lat, world.schools[0].lng, r.hometown.lat, r.hometown.lng));
      touched = true;
    }
    if (touched) fixed++;
  }
  return fixed;
}
function generateRecruitPool(world) {
  const recruits = [];
  const schools = world.schools;
  const gradSlots = world.schools.reduce(
    (sum, s) => sum + s.roster.filter((p) => p.classYear === "SR").length,
    0
  );
  const walkOnSlots = world.schools.reduce(
    (sum, s) => sum + s.roster.filter((p) => p.isWalkOn).length,
    0
  );
  const vacancies = world.schools.reduce(
    (sum, s) => sum + Math.max(0, C.ROSTER_SIZE - s.roster.length),
    0
  );
  const demand = gradSlots + walkOnSlots + vacancies;
  const poolSize = Math.round((demand || world.schools.length * 14) * 1.3);
  const posDist = { QB: 8, RB: 13, WR: 14, TE: 8, OL: 18, DE: 9, DT: 8, OLB: 8, LB: 7, CB: 12, S: 8, K: 4, P: 3 };
  const posPool = [];
  const total = Object.values(posDist).reduce((s, v) => s + v, 0);
  for (const [pos, count] of Object.entries(posDist)) {
    const n = Math.round(count / total * poolSize);
    for (let i = 0; i < n; i++) posPool.push(pos);
  }
  shuffle(posPool);
  const avgLat = schools.reduce((s, sc2) => s + sc2.lat, 0) / schools.length;
  const avgLng = schools.reduce((s, sc2) => s + sc2.lng, 0) / schools.length;
  const n1 = schools.filter((s) => s.division === "D1").length;
  const n2 = schools.filter((s) => s.division === "D2").length;
  const n3 = schools.filter((s) => s.division === "D3").length;
  const nTot = n1 + n2 + n3 || 1;
  const wD3 = n3 / nTot, wD2 = wD3 + n2 / nTot;
  function poolTier() {
    const r = Math.random();
    return r < wD3 ? 1 : r < wD2 ? 2 : 3;
  }
  for (const pos of posPool) {
    const r = createRecruit(pos, poolTier(), avgLat, avgLng);
    r.distanceFromSchool = Math.round(distanceMiles(schools[0].lat, schools[0].lng, r.hometown.lat, r.hometown.lng));
    seedFunnelData(r, schools);
    recruits.push(r);
  }
  for (const t of [1, 2, 3]) {
    const g = recruits.filter((r) => r.recruitTier === t).sort((a, b) => b.compositeRating - a.compositeRating);
    const len = g.length || 1;
    g.forEach((r, i) => {
      r.tierPct = i / len;
    });
  }
  buildAIRecruiting(schools, recruits);
  const byPos = {};
  for (const r of recruits) {
    if (!byPos[r.position]) byPos[r.position] = [];
    byPos[r.position].push(r);
  }
  for (const pos of Object.keys(byPos)) {
    byPos[pos].sort((a, b) => b.visionRating - a.visionRating);
    byPos[pos].forEach((r, i) => {
      r.positionRank = i + 1;
    });
  }
  return recruits;
}
function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = (seed ^ 3735928559) >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = Math.imul(s, 1664525) + 1013904223 >>> 0;
    const j = s % (i + 1);
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h, 31) + s.charCodeAt(i) >>> 0;
  return h;
}
function stripeByConf(teams, seed) {
  const byConf = {};
  for (const s of teams) (byConf[s.conf] = byConf[s.conf] || []).push(s);
  const confs = seededShuffle(Object.keys(byConf), seed);
  const buckets = {};
  for (const c of confs) buckets[c] = seededShuffle(byConf[c], (seed ^ hashStr(c)) >>> 0);
  const result = [];
  let any = true;
  while (any) {
    any = false;
    for (const c of confs) {
      if (buckets[c].length > 0) {
        result.push(buckets[c].shift());
        any = true;
      }
    }
  }
  return result;
}
function scheduleConference(teamIds, confGames, confDaySlots, add, seasonSeed, season = 1) {
  const n = teamIds.length;
  if (n < 2 || confGames <= 0) return;
  const confStableHash = (seasonSeed ^ Math.imul(season, 1000003) >>> 0) >>> 0;
  const ids = seededShuffle([...teamIds], (confStableHash ^ 12648430) >>> 0);
  const circle = ids.length % 2 === 1 ? [...ids, null] : [...ids];
  const m = circle.length;
  const half = m / 2;
  const totalRounds = m - 1;
  const fixed = circle[0];
  let rotating = circle.slice(1);
  const allRounds = [];
  for (let r = 0; r < totalRounds; r++) {
    const lineup = [fixed, ...rotating];
    const pairs = [];
    for (let i = 0; i < half; i++) {
      const a = lineup[i];
      const b = lineup[m - 1 - i];
      if (a !== null && b !== null) pairs.push([a, b]);
    }
    allRounds.push(pairs);
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }
  const slack = Math.max(0, totalRounds - confGames);
  const confPhase = slack > 0 ? confStableHash % (slack + 1) : 0;
  const startOffset = slack > 0 ? (season - 1 + confPhase) % (slack + 1) : 0;
  const roundsToPlay = Math.min(confGames, totalRounds, confDaySlots.length);
  var daySlots = confDaySlots;
  const spare = confDaySlots.length - roundsToPlay;
  if (spare > 0) {
    const byePick = (confStableHash ^ Math.imul(season, 2654435761) >>> 0) >>> 0;
    const byeIdx = byePick % confDaySlots.length;
    daySlots = confDaySlots.filter((_, i) => i !== byeIdx);
  }
  const homeCount = {};
  for (const id of ids) homeCount[id] = 0;
  for (let r = 0; r < roundsToPlay; r++) {
    const roundIdx = (startOffset + r) % totalRounds;
    const day = daySlots[r];
    for (const [a, b] of allRounds[roundIdx]) {
      let home = a, away = b;
      if (homeCount[a] > homeCount[b] || homeCount[a] === homeCount[b] && r % 2 === 1) {
        home = b;
        away = a;
      }
      homeCount[home] = (homeCount[home] || 0) + 1;
      add(day, home, away);
    }
  }
}
function generateSchedule(world, season = 1, preCommitted = []) {
  const divOf = {};
  for (const s of world.schools) divOf[s.id] = s.division;
  preCommitted = (preCommitted || []).filter(
    (g) => divOf[g.homeId] && divOf[g.homeId] === divOf[g.awayId]
  );
  const schedule = [];
  const add = (day, homeId, awayId) => schedule.push({ id: uuid(), day, homeId, awayId, result: null });
  const ncCount = {};
  const busyPerDay = {};
  for (const g of preCommitted) {
    schedule.push({ id: uuid(), day: g.day, homeId: g.homeId, awayId: g.awayId, result: null, rivalry: g.rivalry ? true : void 0 });
    ncCount[g.homeId] = (ncCount[g.homeId] || 0) + 1;
    ncCount[g.awayId] = (ncCount[g.awayId] || 0) + 1;
    if (!busyPerDay[g.day]) busyPerDay[g.day] = /* @__PURE__ */ new Set();
    busyPerDay[g.day].add(g.homeId);
    busyPerDay[g.day].add(g.awayId);
  }
  const MAX_NC = C.NONCONF_GAMES;
  const ncPairs = /* @__PURE__ */ new Set();
  for (const g of preCommitted) {
    const a = g.homeId, b = g.awayId;
    ncPairs.add(a < b ? `${a}|${b}` : `${b}|${a}`);
  }
  for (let di = 0; di < NONCONF_GAME_DAYS.length; di++) {
    const day = NONCONF_GAME_DAYS[di];
    const busy = busyPerDay[day] ? new Set(busyPerDay[day]) : /* @__PURE__ */ new Set();
    for (const div of ["D1", "D2", "D3"]) {
      const eligible = world.schools.filter(
        (s) => s.division === div && (ncCount[s.id] || 0) < MAX_NC && !busy.has(s.id)
      );
      const pool = stripeByConf(eligible, season * 1e5 + di * 7919 + hashStr(div));
      for (let i = 0; i < pool.length; i++) {
        if (busy.has(pool[i].id) || (ncCount[pool[i].id] || 0) >= MAX_NC) continue;
        for (let j = i + 1; j < pool.length; j++) {
          if (busy.has(pool[j].id) || (ncCount[pool[j].id] || 0) >= MAX_NC) continue;
          if (pool[i].conf === pool[j].conf) continue;
          const pairKey = pool[i].id < pool[j].id ? `${pool[i].id}|${pool[j].id}` : `${pool[j].id}|${pool[i].id}`;
          if (ncPairs.has(pairKey)) continue;
          ncPairs.add(pairKey);
          busy.add(pool[i].id);
          busy.add(pool[j].id);
          ncCount[pool[i].id] = (ncCount[pool[i].id] || 0) + 1;
          ncCount[pool[j].id] = (ncCount[pool[j].id] || 0) + 1;
          if (di % 2 === 0) add(day, pool[i].id, pool[j].id);
          else add(day, pool[j].id, pool[i].id);
          break;
        }
      }
    }
  }
  const preCommittedKeys = new Set(
    preCommitted.map((g) => `${g.day}|${g.homeId}|${g.awayId}`)
  );
  const repairBusy = {};
  for (const g of schedule) {
    if (!NONCONF_GAME_DAYS.includes(g.day)) continue;
    (repairBusy[g.day] = repairBusy[g.day] || /* @__PURE__ */ new Set()).add(g.homeId);
    repairBusy[g.day].add(g.awayId);
  }
  for (const teamA of world.schools) {
    if ((ncCount[teamA.id] || 0) >= MAX_NC) continue;
    for (const day of NONCONF_GAME_DAYS) {
      if ((ncCount[teamA.id] || 0) >= MAX_NC) break;
      if (!repairBusy[day]) repairBusy[day] = /* @__PURE__ */ new Set();
      const dayBusy = repairBusy[day];
      if (dayBusy.has(teamA.id)) continue;
      let matched = false;
      for (const teamB of world.schools) {
        if (teamB.id === teamA.id || teamB.division !== teamA.division || teamB.conf === teamA.conf) continue;
        if ((ncCount[teamB.id] || 0) >= MAX_NC || dayBusy.has(teamB.id)) continue;
        const pk = teamA.id < teamB.id ? `${teamA.id}|${teamB.id}` : `${teamB.id}|${teamA.id}`;
        if (ncPairs.has(pk)) continue;
        ncPairs.add(pk);
        dayBusy.add(teamA.id);
        dayBusy.add(teamB.id);
        ncCount[teamA.id]++;
        ncCount[teamB.id]++;
        add(day, teamA.id, teamB.id);
        matched = true;
        break;
      }
      if (matched) continue;
      const dayGames = schedule.filter((g) => g.day === day);
      let augmented = false;
      outer: for (const g of dayGames) {
        if (preCommittedKeys.has(`${g.day}|${g.homeId}|${g.awayId}`)) continue;
        const gH = world.schools.find((s) => s.id === g.homeId);
        const gA = world.schools.find((s) => s.id === g.awayId);
        if (!gH || !gA) continue;
        for (const [borrowed, displaced] of [[gH, gA], [gA, gH]]) {
          if (borrowed.division !== teamA.division || borrowed.conf === teamA.conf) continue;
          const pkAB = teamA.id < borrowed.id ? `${teamA.id}|${borrowed.id}` : `${borrowed.id}|${teamA.id}`;
          if (ncPairs.has(pkAB)) continue;
          dayBusy.delete(borrowed.id);
          dayBusy.delete(displaced.id);
          let newPartner = null;
          for (const s of world.schools) {
            if (s.id === displaced.id || s.id === borrowed.id || s.id === teamA.id) continue;
            if (s.division !== displaced.division || s.conf === displaced.conf) continue;
            if ((ncCount[s.id] || 0) >= MAX_NC || dayBusy.has(s.id)) continue;
            const pkDS = displaced.id < s.id ? `${displaced.id}|${s.id}` : `${s.id}|${displaced.id}`;
            if (ncPairs.has(pkDS)) continue;
            newPartner = s;
            break;
          }
          if (!newPartner) {
            dayBusy.add(borrowed.id);
            dayBusy.add(displaced.id);
            continue;
          }
          const pkBD = gH.id < gA.id ? `${gH.id}|${gA.id}` : `${gA.id}|${gH.id}`;
          const pkDN = displaced.id < newPartner.id ? `${displaced.id}|${newPartner.id}` : `${newPartner.id}|${displaced.id}`;
          schedule.splice(schedule.indexOf(g), 1);
          ncCount[borrowed.id]--;
          ncCount[displaced.id]--;
          ncPairs.delete(pkBD);
          ncPairs.add(pkAB);
          dayBusy.add(teamA.id);
          dayBusy.add(borrowed.id);
          ncCount[teamA.id]++;
          ncCount[borrowed.id]++;
          add(day, teamA.id, borrowed.id);
          ncPairs.add(pkDN);
          dayBusy.add(displaced.id);
          dayBusy.add(newPartner.id);
          ncCount[displaced.id]++;
          ncCount[newPartner.id]++;
          add(day, displaced.id, newPartner.id);
          augmented = true;
          break outer;
        }
      }
    }
  }
  const conferences = {};
  for (const school of world.schools) {
    (conferences[school.conf] = conferences[school.conf] || []).push(school.id);
  }
  for (const [confId, ids] of Object.entries(conferences)) {
    const seed = (season * 1000003 ^ hashStr(confId)) >>> 0;
    scheduleConference(ids, C.CONF_GAMES, CONF_GAME_DAYS, add, seed, season);
  }
  return schedule;
}
var D1_CONFS, STATIC_D1_SCHOOLS, D2_CONFS, D3_CONFS, PRESTIGE_WEIGHTS, D1_POWER_CLAMP, D1_MIDMAJOR_CLAMP, NICK_GLOBAL_CAP, LOC_JITTER_DEG, REGION_CITIES, STATE_TOKENS, DIRS, DENOMS_DEFAULT, DENOMS_BY_REGION, GAZ_CITY_NAMES, PERSON_NAMES, SAINT_NAMES, NICKS_CLASSIC, NICKS_REGIONAL, NICKS_TECH, NICKS_RELIGIOUS, NICKS_QUIRKY, NICK_AGGIES, COLOR_PAIRS, NAME_PATTERNS, CITY_SIZE_PREF, CAMPUS_SIZE_PREF, PATTERN_TYPE, PRIVATE_TYPES, REGION_CENTROIDS, cityKey, REAL_SCHOOL_STEMS, ANCHOR_RANK, REGION_NEIGHBORS, REGION_SPREAD, CONTINENTAL_STATES, TOKEN_STATES, WORLDGEN_INFO, SCHOOL_DATA, ALL_CONF_LIST, CONFERENCES, NONCONF_GAME_DAYS, CONF_GAME_DAYS;

D1_CONFS = [
  // STATIC D1 — fixed & identical every world. 2000-10 conference-landscape
  // analogue: 6 power (12 each) + 4 mid-major (12 each) = 120 fictional schools.
  // Power clamp [3,6], mid-major clamp [1,4]. School roster in STATIC_D1_SCHOOLS.
  { id: "DELTA", region: "DeepSouth", name: "Delta Athletic Conference", short: "DAC", division: "D1", conferenceClass: "power", lat: 33, lng: -87, r: 3 },
  { id: "GLAKES", region: "GreatLakes", name: "Great Lakes Alliance", short: "GLA", division: "D1", conferenceClass: "power", lat: 41.5, lng: -85, r: 3 },
  { id: "PLAINS", region: "Plains", name: "Great Plains Conference", short: "GPC", division: "D1", conferenceClass: "power", lat: 37.5, lng: -97.5, r: 3 },
  { id: "PACIF", region: "California", name: "Pacific Coast Conference", short: "PCC", division: "D1", conferenceClass: "power", lat: 37, lng: -120, r: 3 },
  { id: "SEABRD", region: "Southeast", name: "Atlantic Seaboard Conference", short: "ASC", division: "D1", conferenceClass: "power", lat: 35.5, lng: -79, r: 3 },
  { id: "NEAST", region: "MidAtlantic", name: "Northeastern Football League", short: "NEF", division: "D1", conferenceClass: "power", lat: 40, lng: -77.5, r: 3 },
  { id: "MIDLND", region: "GreatLakes", name: "Midland Conference", short: "MID", division: "D1", conferenceClass: "midMajor", lat: 40.5, lng: -83.5, r: 2.5 },
  { id: "SUMMIT", region: "MountainWest", name: "Summit Conference", short: "SUM", division: "D1", conferenceClass: "midMajor", lat: 39.5, lng: -111.5, r: 2.5 },
  { id: "GULFC", region: "DeepSouth", name: "Gulf Coast Conference", short: "GCC", division: "D1", conferenceClass: "midMajor", lat: 30.5, lng: -88.5, r: 2.5 },
  { id: "FRONT", region: "Southwest", name: "Frontier Conference", short: "FRO", division: "D1", conferenceClass: "midMajor", lat: 32, lng: -97, r: 2.5 }
];
STATIC_D1_SCHOOLS = [
  // [name, nick, abbr, city, state, lat, lng, [c1,c2], prestige, type]  — 12 per conf, in D1_CONFS order
  // DELTA ATHLETIC (SEC analogue)
  ["Calhoun State", "Warcats", "CAL", "Birmingham", "AL", 33.52, -86.81, ["#710021", "#B2A15F"], 6, "landGrant"],
  ["Ravenwood", "Direwolves", "RAV", "Baton Rouge", "LA", 30.45, -91.19, ["#41166D", "#E89D0B"], 6, "flagship"],
  ["Fairhope", "Sand Vipers", "FAI", "Gainesville", "FL", 29.65, -82.33, ["#003894", "#FD6C00"], 5, "flagship"],
  ["Southaven", "Ironwolves", "SVN", "Oxford", "MS", 34.37, -89.52, ["#201546", "#C10F33"], 4, "flagship"],
  ["Tennessee Highlands", "Night Herons", "THL", "Knoxville", "TN", 35.96, -83.92, ["#FF8D00", "#635D5F"], 5, "stateUniversity"],
  ["Oconee A&M", "Ironboars", "OCA", "Athens", "GA", 33.96, -83.38, ["#B20728", "#000000"], 6, "landGrant"],
  ["Beaumont", "Ridgebacks", "BMT", "Nashville", "TN", 36.16, -86.78, ["#856246", "#000000"], 4, "privateCollege"],
  ["Auburndale", "Stonecats", "AUB", "Auburn", "AL", 32.61, -85.48, ["#03194A", "#F26600"], 5, "landGrant"],
  ["Delacroix", "Ashcats", "DLX", "Lafayette", "LA", 30.22, -92.02, ["#5C228D", "#BD996B"], 4, "regionalState"],
  ["Camden State", "Sabertooths", "CMD", "Lexington", "KY", 38.05, -84.5, ["#073199", "#FFFFFF"], 4, "stateUniversity"],
  ["Ashville", "War Herons", "ASH", "Columbia", "SC", 34, -81.03, ["#7F0A15", "#000000"], 5, "flagship"],
  ["Fort Pierce", "Ironbears", "FTP", "Tallahassee", "FL", 30.44, -84.28, ["#773946", "#CFC092"], 5, "stateUniversity"],
  // GREAT LAKES ALLIANCE (Big Ten analogue)
  ["Winslow", "Frost Lynx", "WIN", "Ann Arbor", "MI", 42.28, -83.74, ["#022456", "#FFC009"], 6, "flagship"],
  ["Sandborough", "Cave Bears", "SAN", "Columbus", "OH", 39.96, -83, ["#B00C00", "#5E6365"], 6, "stateUniversity"],
  ["Red Cedar State", "Stormbucks", "RCS", "East Lansing", "MI", 42.73, -84.48, ["#1C5135", "#FFFFFF"], 5, "landGrant"],
  ["Northgate", "Thornbucks", "NGT", "South Bend", "IN", 41.7, -86.24, ["#011746", "#D18D02"], 5, "privateCollege"],
  ["Prairie Grove", "Bramble Boars", "PRG", "Madison", "WI", 43.07, -89.4, ["#BF050A", "#FFFFFF"], 5, "landGrant"],
  ["Ellsworth", "Gray Stags", "ELL", "Iowa City", "IA", 41.66, -91.53, ["#F3DA17", "#000000"], 4, "flagship"],
  ["Bellwether", "Iron Stags", "BEL", "State College", "PA", 40.79, -77.86, ["#051336", "#FFFFFF"], 6, "landGrant"],
  ["Tippecanoe Tech", "Timber Elk", "TPT", "West Lafayette", "IN", 40.43, -86.91, ["#A77E08", "#000000"], 4, "tech"],
  ["Glenmoor", "Ledge Rams", "GLN", "Minneapolis", "MN", 44.97, -93.24, ["#860417", "#F4C235"], 4, "landGrant"],
  ["Harrowgate", "Steel Hawks", "HRW", "Evanston", "IL", 42.05, -87.69, ["#543685", "#FFFFFF"], 4, "privateCollege"],
  ["Danforth", "Cinder Hawks", "DAN", "Champaign", "IL", 40.11, -88.24, ["#152155", "#EC5430"], 4, "landGrant"],
  ["Sault Ridge", "Dawn Hawks", "SLT", "Bloomington", "IN", 39.17, -86.52, ["#940008", "#E9EADF"], 4, "stateUniversity"],
  // GREAT PLAINS (Big 12 analogue)
  ["Vandergriff", "Cragrams", "VDG", "Austin", "TX", 30.28, -97.74, ["#B74B07", "#FFFFFF"], 6, "flagship"],
  ["Navasota A&M", "Pale Herons", "NVA", "College Station", "TX", 30.63, -96.33, ["#560000", "#FFFFFF"], 5, "landGrant"],
  ["Red River", "Dust Wolves", "RRV", "Norman", "OK", 35.22, -97.44, ["#7F1B1E", "#FFF3DB"], 6, "flagship"],
  ["Cedar Bluff", "Salt Terns", "CDB", "Ames", "IA", 42.03, -93.62, ["#BC143A", "#EBBA3D"], 3, "landGrant"],
  ["Fort Sumner", "Reef Rays", "FSM", "Lawrence", "KS", 38.97, -95.24, ["#0248AE", "#E4000B"], 3, "flagship"],
  ["Chisholm State", "Dune Adders", "CHM", "Wichita", "KS", 37.69, -97.34, ["#000000", "#FFC100"], 3, "stateUniversity"],
  ["Stillmark", "Coil Serpents", "STM", "Stillwater", "OK", 36.12, -97.06, ["#F86405", "#000000"], 4, "landGrant"],
  ["Cornerstone", "Storm Elk", "CST", "Lincoln", "NE", 40.81, -96.7, ["#D9103B", "#FFFFFF"], 5, "landGrant"],
  ["Brazos Springs", "Basilisks", "BRS", "Waco", "TX", 31.55, -97.11, ["#214B36", "#FFBC20"], 4, "privateCollege"],
  ["Lubbock Plains", "Rocs", "LBP", "Lubbock", "TX", 33.58, -101.86, ["#D10000", "#000000"], 4, "tech"],
  ["Mesa Verde", "Cockatrice", "MVD", "Boulder", "CO", 40.01, -105.27, ["#000000", "#DBB274"], 4, "flagship"],
  ["Poudre State", "Manticores", "PDR", "Fort Collins", "CO", 40.57, -105.08, ["#264832", "#CEC26A"], 3, "landGrant"],
  // PACIFIC COAST (Pac-10 analogue)
  ["Westmoreland", "Chimeras", "WML", "Los Angeles", "CA", 34.02, -118.29, ["#99000A", "#F8C102"], 5, "privateCollege"],
  ["Baycrest", "Kelpies", "BAY", "Berkeley", "CA", 37.87, -122.26, ["#082E6B", "#FFB014"], 4, "flagship"],
  ["San Marco", "Wendigos", "SMC", "Palo Alto", "CA", 37.43, -122.17, ["#860F0B", "#FFFFFF"], 5, "privateCollege"],
  ["Pasqual", "Firebrands", "PSQ", "Los Angeles", "CA", 34.07, -118.44, ["#2961CF", "#F0B10B"], 5, "flagship"],
  ["Cascadia", "Marsh Stags", "CSC", "Eugene", "OR", 44.04, -123.07, ["#103E34", "#F9EC27"], 6, "flagship"],
  ["Puget", "Cinders", "PUG", "Seattle", "WA", 47.65, -122.31, ["#462D89", "#B5A386"], 5, "flagship"],
  ["Palo Robles", "Emberjacks", "PLR", "Tempe", "AZ", 33.42, -111.93, ["#841746", "#FFC52F"], 4, "landGrant"],
  ["Tucson Mesa", "Foundrymen", "TCM", "Tucson", "AZ", 32.23, -110.95, ["#002762", "#C30C3E"], 4, "flagship"],
  ["Alsea State", "Kilnmen", "ALS", "Corvallis", "OR", 44.56, -123.28, ["#D34406", "#000000"], 3, "landGrant"],
  ["Spokane Falls", "Sentries", "SPF", "Pullman", "WA", 46.73, -117.18, ["#9C2828", "#646A67"], 3, "landGrant"],
  ["Golden Vale", "Teamsters", "GVL", "San Diego", "CA", 32.78, -117.07, ["#A20F22", "#000000"], 3, "stateUniversity"],
  ["Sacramento Delta", "Railmen", "SAC", "Sacramento", "CA", 38.56, -121.42, ["#003030", "#C0A98D"], 3, "stateUniversity"],
  // ATLANTIC SEABOARD (ACC analogue)
  ["Chapelfield", "Ember Hawks", "CHA", "Chapel Hill", "NC", 35.9, -79.05, ["#87B9D0", "#FFFFFF"], 6, "flagship"],
  ["Wolf Creek State", "Trackmen", "WCS", "Raleigh", "NC", 35.78, -78.68, ["#D30C00", "#FFFFFF"], 4, "landGrant"],
  ["Blue Ridge", "Switchmen", "BLR", "Charlottesville", "VA", 38.03, -78.51, ["#18254E", "#F94F16"], 4, "flagship"],
  ["New River Tech", "Colliers", "NRT", "Blacksburg", "VA", 37.23, -80.42, ["#6A013A", "#D5411F"], 5, "tech"],
  ["Clearwater", "Quarrymen", "CLW", "Coral Gables", "FL", 25.72, -80.28, ["#F77A18", "#0B5236"], 5, "privateCollege"],
  ["Seminole Bluff", "Ferrymen", "SBF", "Tallahassee", "FL", 30.42, -84.3, ["#0049A7", "#FCD002"], 4, "stateUniversity"],
  ["Duncastle", "Bargemen", "DUN", "Durham", "NC", 36, -78.94, ["#0055A2", "#FFFFFF"], 4, "privateCollege"],
  ["Wake Hollow", "Dockmen", "WKH", "Winston-Salem", "NC", 36.13, -80.28, ["#A88235", "#000000"], 3, "privateCollege"],
  ["Tidewater", "Wharf Rats", "TDW", "Atlanta", "GA", 33.77, -84.4, ["#B99A67", "#092B5B"], 5, "tech"],
  ["Chestnut Hill", "Longshoremen", "CHH", "Chestnut Hill", "MA", 42.34, -71.17, ["#970032", "#B4A269"], 3, "privateCollege"],
  ["Cavendish", "Riggers", "CVD", "Louisville", "KY", 38.21, -85.76, ["#B30000", "#000000"], 4, "cityUniversity"],
  ["Orange Park", "Smelters", "ORP", "Syracuse", "NY", 43.04, -76.14, ["#F97000", "#121030"], 3, "privateCollege"],
  // NORTHEASTERN FOOTBALL LEAGUE (Big East analogue)
  ["Westover", "Anvil Rams", "WSO", "Morgantown", "WV", 39.63, -79.95, ["#002960", "#F6A800"], 6, "landGrant"],
  ["Highbridge", "Forgemen", "HBR", "Pittsburgh", "PA", 40.44, -79.96, ["#002F96", "#FDB426"], 5, "cityUniversity"],
  ["Rutherford", "Blacksmiths", "RUT", "New Brunswick", "NJ", 40.5, -74.45, ["#D5002F", "#000000"], 4, "landGrant"],
  ["New Haven Bay", "Tanners", "NHB", "New Haven", "CT", 41.31, -72.92, ["#002B73", "#FFFFFF"], 3, "privateCollege"],
  ["Providence Point", "Coopers", "PRP", "Providence", "RI", 41.82, -71.41, ["#000000", "#038B00"], 3, "religious"],
  ["Storrs Valley", "Wheelwrights", "STV", "Storrs", "CT", 41.81, -72.25, ["#000438", "#F00023"], 4, "landGrant"],
  ["Cambridge Row", "Cartwrights", "CBR", "Cambridge", "MA", 42.37, -71.12, ["#9E133B", "#000000"], 3, "privateCollege"],
  ["Fenwick Heights", "Millwrights", "FNH", "Bronx", "NY", 40.86, -73.89, ["#89001D", "#FFFFFF"], 3, "religious"],
  ["Newport Shore", "Sowers", "NPS", "Norfolk", "VA", 36.85, -76.29, ["#08265E", "#FFFFFF"], 4, "cityUniversity"],
  ["Keystone Falls", "Sojourners", "KEY", "Philadelphia", "PA", 39.98, -75.16, ["#9B2233", "#FFFFFF"], 3, "cityUniversity"],
  ["Cincinnati Ridge", "Claimjumpers", "CNR", "Cincinnati", "OH", 39.13, -84.52, ["#E50024", "#000000"], 4, "cityUniversity"],
  ["Louisville Falls", "Sluicers", "LVF", "Louisville", "KY", 38.25, -85.76, ["#A10005", "#000000"], 3, "cityUniversity"],
  // MIDLAND (MAC analogue)
  ["Toledo Bend", "Panhandlers", "TLB", "Toledo", "OH", 41.66, -83.61, ["#0A3F76", "#FFBE0A"], 4, "cityUniversity"],
  ["Gull Lake State", "Cloudbursts", "GLS", "Kalamazoo", "MI", 42.28, -85.61, ["#576F6E", "#9C7200"], 3, "regionalState"],
  ["Rockingham", "Downbursts", "RKG", "Mount Pleasant", "MI", 43.59, -84.77, ["#72002D", "#FFCF31"], 3, "regionalState"],
  ["Dayton Ridge", "Squalls", "DYR", "Dayton", "OH", 39.76, -84.19, ["#D3094A", "#073F8F"], 2, "religious"],
  ["Muncie Central", "Gales", "MNC", "Muncie", "IN", 40.19, -85.39, ["#B91033", "#FFFFFF"], 3, "regionalState"],
  ["Bowling Ridge", "Tempests", "BWR", "Bowling Green", "OH", 41.37, -83.65, ["#F94408", "#4D2E21"], 3, "regionalState"],
  ["Akron Summit", "Maelstroms", "AKS", "Akron", "OH", 41.08, -81.52, ["#0A2861", "#797948"], 2, "cityUniversity"],
  ["DeKalb", "Vortex", "DKB", "DeKalb", "IL", 41.93, -88.75, ["#D31134", "#000000"], 2, "regionalState"],
  ["Ypsilanti", "Riptides", "YPS", "Ypsilanti", "MI", 42.24, -83.61, ["#047139", "#FFFFFF"], 2, "regionalState"],
  ["Mackinaw State", "Undertows", "MKW", "Peoria", "IL", 40.69, -89.59, ["#D1001E", "#01235A"], 2, "regionalState"],
  ["Oxford Falls", "Breakers", "OXF", "Oxford", "OH", 39.51, -84.75, ["#BD1A25", "#FFFFFF"], 3, "regionalState"],
  ["Sandusky Bay", "Whitecaps", "SDB", "Sandusky", "OH", 41.45, -82.71, ["#0051A5", "#7B8885"], 1, "regionalState"],
  // SUMMIT (Mountain West analogue)
  ["Salt Basin", "Surge", "SLB", "Salt Lake City", "UT", 40.76, -111.89, ["#CA0000", "#FFFFFF"], 4, "flagship"],
  ["Provo Heights", "Deluge", "PVH", "Provo", "UT", 40.23, -111.66, ["#0C2E67", "#FFFFFF"], 3, "religious"],
  ["High Sierra", "Monsoon", "HSR", "Las Vegas", "NV", 36.11, -115.14, ["#B80000", "#646473"], 2, "cityUniversity"],
  ["Reno Basin", "Sirocco", "RNB", "Reno", "NV", 39.54, -119.82, ["#053C5E", "#818387"], 2, "flagship"],
  ["Rio Grande", "Chinooks", "RGD", "Albuquerque", "NM", 35.08, -106.62, ["#B8053B", "#636463"], 2, "flagship"],
  ["Organ Peak State", "Nor'easters", "ORG", "Las Cruces", "NM", 32.28, -106.75, ["#8F0637", "#FFFFFF"], 2, "landGrant"],
  ["Fort Laramie", "Whiteouts", "FTL", "Colorado Springs", "CO", 38.83, -104.82, ["#00307C", "#A5AEB3"], 3, "stateUniversity"],
  ["Fresno Basin", "Frostbite", "FRB", "Fresno", "CA", 36.81, -119.75, ["#D5002C", "#002E9B"], 3, "stateUniversity"],
  ["Boise Ridge", "Landslides", "BSR", "Boise", "ID", 43.6, -116.2, ["#002FA9", "#D84B10"], 4, "regionalState"],
  ["Laramie Peak", "Rockslides", "LRP", "Laramie", "WY", 41.31, -105.59, ["#522C1C", "#FFC02C"], 2, "flagship"],
  ["Flagstaff Pines", "Tremors", "FGP", "Flagstaff", "AZ", 35.2, -111.65, ["#003770", "#F7C82B"], 2, "regionalState"],
  ["Grand Junction", "Faults", "GRJ", "Grand Junction", "CO", 39.06, -108.55, ["#850C1A", "#AAA669"], 1, "regionalState"],
  // GULF COAST (Sun Belt analogue)
  ["Mobile Bay", "Magma", "MOB", "Mobile", "AL", 30.7, -88.18, ["#001F64", "#E2B507"], 3, "cityUniversity"],
  ["Troy Junction", "Cinderfall", "TRJ", "Troy", "AL", 31.8, -85.97, ["#8C2B3B", "#8D8A97"], 3, "regionalState"],
  ["Bayou Parish", "Eclipse", "BPA", "Lafayette", "LA", 30.21, -92.02, ["#D40C19", "#000000"], 2, "regionalState"],
  ["Monroe Delta", "Quasars", "MND", "Monroe", "LA", 32.53, -92.06, ["#8D002C", "#DDB400"], 2, "regionalState"],
  ["Boca Sands", "Pulsars", "BCS", "Boca Raton", "FL", 26.37, -80.1, ["#003563", "#CB0000"], 2, "cityUniversity"],
  ["Orlando Central", "Nebulas", "ORC", "Orlando", "FL", 28.6, -81.2, ["#000000", "#AF9B37"], 3, "cityUniversity"],
  ["Ogeechee State", "Solstice", "OST", "Statesboro", "GA", 32.42, -81.78, ["#00153C", "#7A9FB0"], 3, "regionalState"],
  ["Pine Belt State", "Equinox", "PBE", "Hattiesburg", "MS", 31.33, -89.33, ["#000000", "#FFBE21"], 3, "regionalState"],
  ["Arkansas Delta", "Aurora", "ARD", "Jonesboro", "AR", 35.84, -90.68, ["#CD0D39", "#000000"], 2, "regionalState"],
  ["Denton Plains", "Halos", "DNP", "Denton", "TX", 33.21, -97.13, ["#008B3E", "#FFFFFF"], 2, "cityUniversity"],
  ["San Marcos Hill", "Zeniths", "SMH", "San Marcos", "TX", 29.88, -97.94, ["#4E131D", "#5A6A6A"], 2, "regionalState"],
  ["Kisatchie Tech", "Apogee", "KST", "Ruston", "LA", 32.53, -92.64, ["#002A8A", "#E51D25"], 3, "tech"],
  // FRONTIER (Conference USA analogue)
  ["El Camino", "Perigee", "ELC", "El Paso", "TX", 31.77, -106.5, ["#001F43", "#F68200"], 2, "regionalState"],
  ["Bayou City", "Vertex", "BYC", "Houston", "TX", 29.72, -95.34, ["#D20E2D", "#FFFFFF"], 3, "cityUniversity"],
  ["Trinity Fork", "Apex", "TFO", "Fort Worth", "TX", 32.71, -97.36, ["#4F1C76", "#ACB4A3"], 4, "religious"],
  ["Highland Chapel", "Iron Guard", "HCH", "Dallas", "TX", 32.84, -96.78, ["#C70C22", "#02349C"], 3, "religious"],
  ["Tulsa Basin", "Steel Guard", "TLS", "Tulsa", "OK", 36.15, -95.94, ["#003668", "#BCBA8E"], 2, "religious"],
  ["Memphis Bluff", "Ironclads", "MPB", "Memphis", "TN", 35.12, -89.94, ["#002F8B", "#859997"], 3, "cityUniversity"],
  ["Birmingham South", "Bulwark", "BHS", "Birmingham", "AL", 33.5, -86.8, ["#19625C", "#BBA155"], 2, "cityUniversity"],
  ["Charlotte Queen", "Rampart", "CHQ", "Charlotte", "NC", 35.31, -80.73, ["#007039", "#FFFFFF"], 2, "cityUniversity"],
  ["Rice Hollow", "Bastion", "RCH", "Houston", "TX", 29.72, -95.4, ["#0B2062", "#B9C9CB"], 2, "privateCollege"],
  ["Guyandotte", "Citadels", "GUY", "Huntington", "WV", 38.42, -82.43, ["#00AC38", "#000000"], 2, "regionalState"],
  ["Coastal Pine", "Keeps", "CPI", "Gulfport", "MS", 30.37, -89.09, ["#F6AC00", "#000000"], 2, "regionalState"],
  ["Pamlico Bay", "Redoubts", "PBA", "Greenville", "NC", 35.61, -77.37, ["#42216B", "#FAD32C"], 3, "regionalState"]
];
D2_CONFS = [
  // 10 D2 conferences (was 9 — added GPI for §B.2 ~100/div target)
  { id: "RMA", region: "MountainWest", name: "High Country Athletic", short: "RMA", division: "D2", lat: 40.5, lng: -108, r: 3 },
  { id: "CCA", region: "Midwest", name: "Central Collegiate Athletic", short: "CCA", division: "D2", lat: 41, lng: -90, r: 2.5 },
  { id: "MIA", region: "GreatLakes", name: "Midwest Intercollegiate Athletic", short: "MIA", division: "D2", lat: 42, lng: -88, r: 2 },
  { id: "GNW", region: "PacificNW", name: "Evergreen Athletic League", short: "GNW", division: "D2", lat: 46, lng: -122, r: 3 },
  { id: "SSC", region: "MidSouth", name: "Magnolia Athletic Conference", short: "SSC", division: "D2", lat: 34.5, lng: -88, r: 2.5 },
  { id: "CCC", region: "California", name: "Coastal Valley Conference", short: "CCC", division: "D2", lat: 36.3, lng: -119.6, r: 2.5 },
  { id: "NEC", region: "Northeast", name: "New England Collegiate", short: "NEC", division: "D2", lat: 43, lng: -71.5, r: 2 },
  { id: "UML", region: "UpperMidwest", name: "Upper Midwest League", short: "UML", division: "D2", lat: 46.5, lng: -96, r: 3 },
  { id: "LSC", region: "Southwest", name: "Frontier Athletic Conference", short: "LSC", division: "D2", lat: 30.5, lng: -98, r: 2.8 },
  { id: "GPI", region: "Plains", name: "Great Plains Intercollegiate", short: "GPI", division: "D2", lat: 39.5, lng: -97.5, r: 2.5 }
];
D3_CONFS = [
  // 9 D3 conferences. Geography-spread rebuild: FRE (MidAtlantic dup) →
  // Texas, PRC (UpperMidwest dup) → California, and the Cascade conference
  // re-adds PacificNW coverage — D3 previously had NOTHING west of the
  // Plains, so a CA D3 program's "local" rival was 1,300 miles away.
  { id: "AMC", region: "MidAtlantic", name: "Allegheny Mountain Collegiate", short: "AMC", division: "D3", lat: 41, lng: -78, r: 2 },
  { id: "HCA", region: "Plains", name: "Prairie Athletic League", short: "HCA", division: "D3", lat: 40.5, lng: -97, r: 2.5 },
  { id: "E8C", region: "Northeast", name: "Empire Collegiate Athletic", short: "E8C", division: "D3", lat: 42.5, lng: -76.5, r: 2 },
  { id: "SCA", region: "Southeast", name: "Piedmont Athletic Conference", short: "SCA", division: "D3", lat: 35, lng: -82, r: 2.5 },
  { id: "NCA", region: "GreatLakes", name: "Lakeshore Collegiate League", short: "NCA", division: "D3", lat: 41.5, lng: -82, r: 1.8 },
  { id: "TXI", region: "Southwest", name: "Texas Intercollegiate", short: "TXI", division: "D3", lat: 31.4, lng: -97.5, r: 2.5 },
  { id: "IIA", region: "UpperMidwest", name: "Cornbelt Collegiate", short: "IIA", division: "D3", lat: 42, lng: -93, r: 2 },
  { id: "GSA", region: "California", name: "Sierra Collegiate Athletic", short: "GSA", division: "D3", lat: 36.6, lng: -119.9, r: 2.5 },
  { id: "CAS", region: "PacificNW", name: "Timberline Collegiate", short: "CAS", division: "D3", lat: 45.2, lng: -120.5, r: 3 }
];
PRESTIGE_WEIGHTS = {
  power: [[6, 15], [5, 35], [4, 50]],
  // [TUNE] few blue bloods, broad 4★ base
  midMajor: [[3, 20], [2, 40], [1, 40]],
  D2: [[4, 8], [3, 22], [2, 35], [1, 35]],
  D3: [[3, 12], [2, 33], [1, 55]]
};
D1_POWER_CLAMP = { min: 3, max: 6 };
D1_MIDMAJOR_CLAMP = { min: 1, max: 4 };
NICK_GLOBAL_CAP = 2;
LOC_JITTER_DEG = 0.04;
REGION_CITIES = {
  Southeast: [
    { c: "Savannah", s: "GA", lat: 32.08, lng: -81.1, z: 2 },
    { c: "Charleston", s: "SC", lat: 32.78, lng: -79.93, z: 2 },
    { c: "Augusta", s: "GA", lat: 33.47, lng: -82.01, z: 2 },
    { c: "Macon", s: "GA", lat: 32.84, lng: -83.63, z: 2 },
    { c: "Asheville", s: "NC", lat: 35.6, lng: -82.55, z: 2 },
    { c: "Greenville", s: "SC", lat: 34.85, lng: -82.4, z: 2 },
    { c: "Columbia", s: "SC", lat: 34, lng: -81.03, z: 3 },
    { c: "Charlotte", s: "NC", lat: 35.23, lng: -80.84, z: 3 },
    { c: "Raleigh", s: "NC", lat: 35.78, lng: -78.64, z: 3 },
    { c: "Wilmington", s: "NC", lat: 34.23, lng: -77.94, z: 2 },
    { c: "Roanoke", s: "VA", lat: 37.27, lng: -79.94, z: 2 },
    { c: "Lynchburg", s: "VA", lat: 37.41, lng: -79.14, z: 2 },
    { c: "Richmond", s: "VA", lat: 37.54, lng: -77.44, z: 3 },
    { c: "Norfolk", s: "VA", lat: 36.85, lng: -76.29, z: 3 },
    { c: "Statesboro", s: "GA", lat: 32.45, lng: -81.78, z: 1 },
    { c: "Valdosta", s: "GA", lat: 30.83, lng: -83.28, z: 1 },
    { c: "Marietta", s: "GA", lat: 33.95, lng: -84.55, z: 2 },
    { c: "Athens", s: "GA", lat: 33.96, lng: -83.38, z: 2 },
    { c: "Spartanburg", s: "SC", lat: 34.95, lng: -81.93, z: 1 },
    { c: "Florence", s: "SC", lat: 34.2, lng: -79.77, z: 1 },
    { c: "Aiken", s: "SC", lat: 33.56, lng: -81.72, z: 1 },
    { c: "Sumter", s: "SC", lat: 33.92, lng: -80.34, z: 1 },
    { c: "Danville", s: "VA", lat: 36.59, lng: -79.4, z: 1 },
    { c: "Kennesaw", s: "GA", lat: 34.02, lng: -84.62, z: 2 },
    { c: "Elon", s: "NC", lat: 36.1, lng: -79.51, z: 1 },
    { c: "Carrollton", s: "GA", lat: 33.58, lng: -85.08, z: 1 },
    { c: "Milledgeville", s: "GA", lat: 33.08, lng: -83.23, z: 1 },
    { c: "Americus", s: "GA", lat: 32.07, lng: -84.23, z: 1 },
    { c: "Chapel Hill", s: "NC", lat: 35.91, lng: -79.06, z: 2 },
    { c: "Durham", s: "NC", lat: 35.99, lng: -78.9, z: 3 },
    { c: "Boone", s: "NC", lat: 36.22, lng: -81.67, z: 1 },
    { c: "Cullowhee", s: "NC", lat: 35.31, lng: -83.18, z: 1 },
    { c: "Davidson", s: "NC", lat: 35.5, lng: -80.85, z: 1 },
    { c: "Clemson", s: "SC", lat: 34.68, lng: -82.84, z: 1 },
    { c: "Rock Hill", s: "SC", lat: 34.92, lng: -81.03, z: 1 },
    { c: "Orangeburg", s: "SC", lat: 33.49, lng: -80.86, z: 1 },
    { c: "Blacksburg", s: "VA", lat: 37.23, lng: -80.41, z: 1 },
    { c: "Harrisonburg", s: "VA", lat: 38.45, lng: -78.87, z: 1 },
    { c: "Charlottesville", s: "VA", lat: 38.03, lng: -78.48, z: 2 },
    { c: "Lexington", s: "VA", lat: 37.78, lng: -79.44, z: 1 },
    { c: "Farmville", s: "VA", lat: 37.3, lng: -78.39, z: 1 },
    { c: "Radford", s: "VA", lat: 37.13, lng: -80.58, z: 1 }
  ],
  DeepSouth: [
    { c: "Tuscaloosa", s: "AL", lat: 33.21, lng: -87.57, z: 2 },
    { c: "Auburn", s: "AL", lat: 32.61, lng: -85.48, z: 2 },
    { c: "Montgomery", s: "AL", lat: 32.37, lng: -86.3, z: 3 },
    { c: "Mobile", s: "AL", lat: 30.69, lng: -88.04, z: 3 },
    { c: "Hattiesburg", s: "MS", lat: 31.33, lng: -89.29, z: 1 },
    { c: "Biloxi", s: "MS", lat: 30.4, lng: -88.89, z: 1 },
    { c: "Meridian", s: "MS", lat: 32.36, lng: -88.7, z: 1 },
    { c: "Tupelo", s: "MS", lat: 34.26, lng: -88.7, z: 1 },
    { c: "Oxford", s: "MS", lat: 34.37, lng: -89.52, z: 1 },
    { c: "Starkville", s: "MS", lat: 33.45, lng: -88.82, z: 1 },
    { c: "Baton Rouge", s: "LA", lat: 30.45, lng: -91.15, z: 3 },
    { c: "Lafayette", s: "LA", lat: 30.22, lng: -92.02, z: 2 },
    { c: "Monroe", s: "LA", lat: 32.51, lng: -92.12, z: 1 },
    { c: "Ruston", s: "LA", lat: 32.52, lng: -92.64, z: 1 },
    { c: "Shreveport", s: "LA", lat: 32.53, lng: -93.75, z: 3 },
    { c: "Dothan", s: "AL", lat: 31.22, lng: -85.39, z: 1 },
    { c: "Selma", s: "AL", lat: 32.41, lng: -87.02, z: 1 },
    { c: "Gadsden", s: "AL", lat: 34.01, lng: -86.01, z: 1 },
    { c: "Vicksburg", s: "MS", lat: 32.35, lng: -90.88, z: 1 },
    { c: "Natchez", s: "MS", lat: 31.56, lng: -91.4, z: 1 },
    { c: "Pensacola", s: "FL", lat: 30.42, lng: -87.22, z: 2 },
    { c: "Tallahassee", s: "FL", lat: 30.44, lng: -84.28, z: 3 },
    { c: "Gainesville", s: "FL", lat: 29.65, lng: -82.32, z: 2 },
    { c: "Troy", s: "AL", lat: 31.81, lng: -85.97, z: 1 },
    { c: "Jacksonville", s: "AL", lat: 33.81, lng: -85.76, z: 1 },
    { c: "Orlando", s: "FL", lat: 28.54, lng: -81.38, z: 3 },
    { c: "Tampa", s: "FL", lat: 27.95, lng: -82.46, z: 3 },
    { c: "Jacksonville", s: "FL", lat: 30.33, lng: -81.66, z: 3 },
    { c: "Boca Raton", s: "FL", lat: 26.37, lng: -80.1, z: 2 },
    { c: "DeLand", s: "FL", lat: 29.03, lng: -81.3, z: 1 },
    { c: "Lakeland", s: "FL", lat: 28.04, lng: -81.95, z: 2 },
    { c: "Florence", s: "AL", lat: 34.8, lng: -87.68, z: 1 },
    { c: "Livingston", s: "AL", lat: 32.58, lng: -88.19, z: 1 },
    { c: "Hammond", s: "LA", lat: 30.5, lng: -90.46, z: 1 },
    { c: "Thibodaux", s: "LA", lat: 29.8, lng: -90.82, z: 1 },
    { c: "Natchitoches", s: "LA", lat: 31.76, lng: -93.09, z: 1 },
    { c: "Cleveland", s: "MS", lat: 33.74, lng: -90.72, z: 1 },
    { c: "Clinton", s: "MS", lat: 32.34, lng: -90.32, z: 1 },
    { c: "Grambling", s: "LA", lat: 32.53, lng: -92.71, z: 1 },
    { c: "Lake Charles", s: "LA", lat: 30.23, lng: -93.22, z: 2 },
    { c: "Pineville", s: "LA", lat: 31.32, lng: -92.43, z: 1 },
    { c: "Daytona Beach", s: "FL", lat: 29.21, lng: -81.02, z: 2 },
    { c: "Fort Myers", s: "FL", lat: 26.64, lng: -81.87, z: 2 },
    { c: "Melbourne", s: "FL", lat: 28.08, lng: -80.61, z: 1 },
    { c: "Ocala", s: "FL", lat: 29.19, lng: -82.14, z: 1 },
    { c: "St. Petersburg", s: "FL", lat: 27.77, lng: -82.64, z: 2 },
    { c: "Itta Bena", s: "MS", lat: 33.49, lng: -90.32, z: 1 },
    { c: "Lorman", s: "MS", lat: 31.81, lng: -91.06, z: 1 },
    { c: "Montevallo", s: "AL", lat: 33.1, lng: -86.86, z: 1 }
  ],
  MidSouth: [
    { c: "Memphis", s: "TN", lat: 35.15, lng: -90.05, z: 3 },
    { c: "Nashville", s: "TN", lat: 36.17, lng: -86.78, z: 3 },
    { c: "Knoxville", s: "TN", lat: 35.96, lng: -83.92, z: 3 },
    { c: "Chattanooga", s: "TN", lat: 35.05, lng: -85.31, z: 2 },
    { c: "Murfreesboro", s: "TN", lat: 35.85, lng: -86.39, z: 2 },
    { c: "Cookeville", s: "TN", lat: 36.16, lng: -85.5, z: 1 },
    { c: "Johnson City", s: "TN", lat: 36.31, lng: -82.35, z: 1 },
    { c: "Clarksville", s: "TN", lat: 36.53, lng: -87.36, z: 2 },
    { c: "Jonesboro", s: "AR", lat: 35.84, lng: -90.7, z: 1 },
    { c: "Fayetteville", s: "AR", lat: 36.06, lng: -94.16, z: 2 },
    { c: "Conway", s: "AR", lat: 35.09, lng: -92.44, z: 1 },
    { c: "Paducah", s: "KY", lat: 37.08, lng: -88.6, z: 1 },
    { c: "Bowling Green", s: "KY", lat: 36.99, lng: -86.44, z: 2 },
    { c: "Owensboro", s: "KY", lat: 37.77, lng: -87.11, z: 1 },
    { c: "Huntsville", s: "AL", lat: 34.73, lng: -86.59, z: 3 },
    { c: "Decatur", s: "AL", lat: 34.61, lng: -86.98, z: 1 },
    { c: "Cape Girardeau", s: "MO", lat: 37.31, lng: -89.52, z: 1 },
    { c: "Martin", s: "TN", lat: 36.34, lng: -88.85, z: 1 },
    { c: "Morehead", s: "KY", lat: 38.18, lng: -83.43, z: 1 },
    { c: "Richmond", s: "KY", lat: 37.75, lng: -84.29, z: 1 },
    { c: "Little Rock", s: "AR", lat: 34.75, lng: -92.29, z: 3 },
    { c: "Arkadelphia", s: "AR", lat: 34.12, lng: -93.05, z: 1 },
    { c: "Russellville", s: "AR", lat: 35.28, lng: -93.13, z: 1 },
    { c: "Sewanee", s: "TN", lat: 35.2, lng: -85.92, z: 1 },
    { c: "Lexington", s: "KY", lat: 38.04, lng: -84.5, z: 3 },
    { c: "Murray", s: "KY", lat: 36.61, lng: -88.31, z: 1 },
    { c: "Danville", s: "KY", lat: 37.65, lng: -84.77, z: 1 },
    { c: "Columbia", s: "MO", lat: 38.95, lng: -92.33, z: 2 },
    { c: "Kirksville", s: "MO", lat: 40.19, lng: -92.58, z: 1 },
    { c: "Fulton", s: "MO", lat: 38.85, lng: -91.95, z: 1 },
    { c: "Magnolia", s: "AR", lat: 33.27, lng: -93.24, z: 1 },
    { c: "Searcy", s: "AR", lat: 35.25, lng: -91.74, z: 1 }
  ],
  MidAtlantic: [
    { c: "Allentown", s: "PA", lat: 40.6, lng: -75.47, z: 2 },
    { c: "Scranton", s: "PA", lat: 41.41, lng: -75.66, z: 2 },
    { c: "Harrisburg", s: "PA", lat: 40.27, lng: -76.88, z: 2 },
    { c: "Altoona", s: "PA", lat: 40.52, lng: -78.39, z: 1 },
    { c: "Johnstown", s: "PA", lat: 40.33, lng: -78.92, z: 1 },
    { c: "Wilkes-Barre", s: "PA", lat: 41.25, lng: -75.88, z: 1 },
    { c: "Lancaster", s: "PA", lat: 40.04, lng: -76.31, z: 2 },
    { c: "Reading", s: "PA", lat: 40.34, lng: -75.93, z: 2 },
    { c: "Bethlehem", s: "PA", lat: 40.63, lng: -75.37, z: 2 },
    { c: "Frostburg", s: "MD", lat: 39.66, lng: -78.93, z: 1 },
    { c: "Cumberland", s: "MD", lat: 39.65, lng: -78.76, z: 1 },
    { c: "Morgantown", s: "WV", lat: 39.63, lng: -79.96, z: 2 },
    { c: "Wheeling", s: "WV", lat: 40.06, lng: -80.72, z: 1 },
    { c: "Clarksburg", s: "WV", lat: 39.28, lng: -80.34, z: 1 },
    { c: "Hagerstown", s: "MD", lat: 39.64, lng: -77.72, z: 1 },
    { c: "Chambersburg", s: "PA", lat: 39.94, lng: -77.66, z: 1 },
    { c: "Williamsport", s: "PA", lat: 41.24, lng: -77, z: 1 },
    { c: "Bloomsburg", s: "PA", lat: 41, lng: -76.45, z: 1 },
    { c: "Shippensburg", s: "PA", lat: 40.05, lng: -77.52, z: 1 },
    { c: "Kutztown", s: "PA", lat: 40.52, lng: -75.78, z: 1 },
    // Jul 2026: DE and NJ had NO cities at all — three continental states were
    // literally ungenerable. Added so every state can host a program.
    { c: "Wilmington", s: "DE", lat: 39.75, lng: -75.55, z: 2 },
    { c: "Newark", s: "DE", lat: 39.68, lng: -75.75, z: 1 },
    { c: "Dover", s: "DE", lat: 39.16, lng: -75.52, z: 1 },
    { c: "Princeton", s: "NJ", lat: 40.35, lng: -74.66, z: 1 },
    { c: "New Brunswick", s: "NJ", lat: 40.49, lng: -74.45, z: 2 },
    { c: "Trenton", s: "NJ", lat: 40.22, lng: -74.74, z: 2 },
    { c: "Camden", s: "NJ", lat: 39.93, lng: -75.12, z: 2 },
    { c: "Montclair", s: "NJ", lat: 40.82, lng: -74.21, z: 1 },
    { c: "Hoboken", s: "NJ", lat: 40.74, lng: -74.03, z: 1 },
    { c: "Georgetown", s: "DE", lat: 38.69, lng: -75.39, z: 1 },
    { c: "Middletown", s: "DE", lat: 39.45, lng: -75.72, z: 1 },
    { c: "Baltimore", s: "MD", lat: 39.29, lng: -76.61, z: 3 },
    { c: "Annapolis", s: "MD", lat: 38.98, lng: -76.49, z: 1 },
    { c: "Salisbury", s: "MD", lat: 38.36, lng: -75.6, z: 1 },
    { c: "Towson", s: "MD", lat: 39.4, lng: -76.6, z: 2 },
    { c: "Huntington", s: "WV", lat: 38.42, lng: -82.45, z: 2 },
    { c: "Charleston", s: "WV", lat: 38.35, lng: -81.63, z: 2 },
    { c: "Shepherdstown", s: "WV", lat: 39.43, lng: -77.8, z: 1 },
    { c: "State College", s: "PA", lat: 40.79, lng: -77.86, z: 2 },
    { c: "Lewisburg", s: "PA", lat: 40.96, lng: -76.88, z: 1 },
    { c: "Villanova", s: "PA", lat: 40.04, lng: -75.34, z: 1 },
    { c: "Slippery Rock", s: "PA", lat: 41.06, lng: -80.06, z: 1 },
    { c: "Carlisle", s: "PA", lat: 40.2, lng: -77.19, z: 1 },
    { c: "Easton", s: "PA", lat: 40.69, lng: -75.22, z: 1 },
    { c: "Princess Anne", s: "MD", lat: 38.2, lng: -75.69, z: 1 },
    { c: "Emmitsburg", s: "MD", lat: 39.7, lng: -77.33, z: 1 },
    { c: "Buckhannon", s: "WV", lat: 38.99, lng: -80.23, z: 1 },
    { c: "Institute", s: "WV", lat: 38.38, lng: -81.76, z: 1 },
    { c: "Glenville", s: "WV", lat: 38.93, lng: -80.84, z: 1 },
    { c: "Glassboro", s: "NJ", lat: 39.7, lng: -75.11, z: 1 },
    { c: "Piscataway", s: "NJ", lat: 40.55, lng: -74.46, z: 1 },
    { c: "Madison", s: "NJ", lat: 40.76, lng: -74.42, z: 1 },
    { c: "Lewes", s: "DE", lat: 38.77, lng: -75.14, z: 1 },
    { c: "Milford", s: "DE", lat: 38.91, lng: -75.43, z: 1 },
    { c: "Smyrna", s: "DE", lat: 39.3, lng: -75.6, z: 1 },
    { c: "Millersville", s: "PA", lat: 40, lng: -76.35, z: 1 },
    { c: "Selinsgrove", s: "PA", lat: 40.8, lng: -76.86, z: 1 },
    { c: "Meadville", s: "PA", lat: 41.64, lng: -80.15, z: 1 },
    { c: "Westminster", s: "MD", lat: 39.58, lng: -76.99, z: 1 },
    { c: "Elkins", s: "WV", lat: 38.93, lng: -79.85, z: 1 },
    { c: "Athens", s: "WV", lat: 37.42, lng: -81, z: 1 },
    { c: "Union", s: "NJ", lat: 40.7, lng: -74.26, z: 1 },
    { c: "Ewing", s: "NJ", lat: 40.27, lng: -74.8, z: 1 },
    { c: "South Orange", s: "NJ", lat: 40.75, lng: -74.26, z: 1 }
  ],
  Northeast: [
    { c: "Worcester", s: "MA", lat: 42.26, lng: -71.8, z: 3 },
    { c: "Springfield", s: "MA", lat: 42.1, lng: -72.59, z: 2 },
    { c: "Amherst", s: "MA", lat: 42.37, lng: -72.52, z: 1 },
    { c: "Providence", s: "RI", lat: 41.82, lng: -71.41, z: 3 },
    { c: "Hartford", s: "CT", lat: 41.77, lng: -72.67, z: 3 },
    { c: "New Haven", s: "CT", lat: 41.31, lng: -72.92, z: 2 },
    { c: "Burlington", s: "VT", lat: 44.48, lng: -73.21, z: 2 },
    { c: "Manchester", s: "NH", lat: 42.99, lng: -71.46, z: 2 },
    { c: "Bangor", s: "ME", lat: 44.8, lng: -68.77, z: 1 },
    { c: "Albany", s: "NY", lat: 42.65, lng: -73.75, z: 3 },
    { c: "Utica", s: "NY", lat: 43.1, lng: -75.23, z: 1 },
    { c: "Binghamton", s: "NY", lat: 42.1, lng: -75.91, z: 1 },
    { c: "Syracuse", s: "NY", lat: 43.05, lng: -76.15, z: 3 },
    { c: "Rochester", s: "NY", lat: 43.16, lng: -77.61, z: 3 },
    { c: "Ithaca", s: "NY", lat: 42.44, lng: -76.5, z: 1 },
    { c: "Plymouth", s: "NH", lat: 43.76, lng: -71.69, z: 1 },
    { c: "Fitchburg", s: "MA", lat: 42.58, lng: -71.8, z: 1 },
    { c: "Keene", s: "NH", lat: 42.93, lng: -72.28, z: 1 },
    { c: "Nashua", s: "NH", lat: 42.77, lng: -71.47, z: 2 },
    { c: "Geneseo", s: "NY", lat: 42.8, lng: -77.82, z: 1 },
    { c: "Oswego", s: "NY", lat: 43.46, lng: -76.51, z: 1 },
    { c: "Cortland", s: "NY", lat: 42.6, lng: -76.18, z: 1 },
    { c: "Storrs", s: "CT", lat: 41.81, lng: -72.25, z: 1 },
    { c: "Bridgeport", s: "CT", lat: 41.19, lng: -73.2, z: 2 },
    { c: "New London", s: "CT", lat: 41.36, lng: -72.1, z: 1 },
    { c: "Danbury", s: "CT", lat: 41.39, lng: -73.45, z: 1 },
    { c: "Boston", s: "MA", lat: 42.36, lng: -71.06, z: 3 },
    { c: "Lowell", s: "MA", lat: 42.63, lng: -71.32, z: 2 },
    { c: "Medford", s: "MA", lat: 42.42, lng: -71.11, z: 1 },
    { c: "Waltham", s: "MA", lat: 42.38, lng: -71.24, z: 1 },
    { c: "Durham", s: "NH", lat: 43.13, lng: -70.93, z: 1 },
    { c: "Hanover", s: "NH", lat: 43.7, lng: -72.29, z: 1 },
    { c: "Concord", s: "NH", lat: 43.21, lng: -71.54, z: 1 },
    { c: "Orono", s: "ME", lat: 44.88, lng: -68.67, z: 1 },
    { c: "Portland", s: "ME", lat: 43.66, lng: -70.26, z: 2 },
    { c: "Lewiston", s: "ME", lat: 44.1, lng: -70.21, z: 1 },
    { c: "Brunswick", s: "ME", lat: 43.91, lng: -69.96, z: 1 },
    { c: "Waterville", s: "ME", lat: 44.55, lng: -69.63, z: 1 },
    { c: "Kingston", s: "RI", lat: 41.48, lng: -71.53, z: 1 },
    { c: "Bristol", s: "RI", lat: 41.68, lng: -71.27, z: 1 },
    { c: "Newport", s: "RI", lat: 41.49, lng: -71.31, z: 1 },
    { c: "Smithfield", s: "RI", lat: 41.92, lng: -71.55, z: 1 },
    { c: "Middlebury", s: "VT", lat: 44.02, lng: -73.17, z: 1 },
    { c: "Castleton", s: "VT", lat: 43.61, lng: -73.18, z: 1 },
    { c: "Montpelier", s: "VT", lat: 44.26, lng: -72.58, z: 1 },
    { c: "Northfield", s: "VT", lat: 44.15, lng: -72.66, z: 1 },
    { c: "Buffalo", s: "NY", lat: 42.89, lng: -78.88, z: 3 },
    { c: "Poughkeepsie", s: "NY", lat: 41.7, lng: -73.92, z: 1 },
    { c: "Hamilton", s: "NY", lat: 42.83, lng: -75.54, z: 1 },
    { c: "Troy", s: "NY", lat: 42.73, lng: -73.69, z: 1 },
    { c: "Geneva", s: "NY", lat: 42.87, lng: -76.98, z: 1 },
    { c: "Chestnut Hill", s: "MA", lat: 42.33, lng: -71.16, z: 1 },
    { c: "Williamstown", s: "MA", lat: 42.71, lng: -73.2, z: 1 },
    { c: "Cambridge", s: "MA", lat: 42.37, lng: -71.11, z: 2 },
    { c: "Poultney", s: "VT", lat: 43.52, lng: -73.24, z: 1 },
    { c: "Bennington", s: "VT", lat: 42.88, lng: -73.2, z: 1 },
    { c: "Johnson", s: "VT", lat: 44.64, lng: -72.68, z: 1 },
    { c: "Rutland", s: "VT", lat: 43.61, lng: -72.97, z: 1 },
    { c: "Lyndonville", s: "VT", lat: 44.53, lng: -72, z: 1 },
    { c: "Warwick", s: "RI", lat: 41.7, lng: -71.42, z: 2 },
    { c: "Pawtucket", s: "RI", lat: 41.88, lng: -71.38, z: 1 },
    { c: "Cranston", s: "RI", lat: 41.78, lng: -71.44, z: 1 },
    { c: "Middletown", s: "CT", lat: 41.56, lng: -72.65, z: 1 },
    { c: "Fairfield", s: "CT", lat: 41.14, lng: -73.26, z: 1 },
    { c: "Willimantic", s: "CT", lat: 41.71, lng: -72.21, z: 1 },
    { c: "New Britain", s: "CT", lat: 41.66, lng: -72.78, z: 1 },
    { c: "Gorham", s: "ME", lat: 43.68, lng: -70.44, z: 1 },
    { c: "Farmington", s: "ME", lat: 44.67, lng: -70.15, z: 1 },
    { c: "Presque Isle", s: "ME", lat: 46.68, lng: -68.02, z: 1 },
    { c: "Machias", s: "ME", lat: 44.72, lng: -67.46, z: 1 },
    { c: "Wellesley", s: "MA", lat: 42.3, lng: -71.29, z: 1 }
  ],
  GreatLakes: [
    { c: "Toledo", s: "OH", lat: 41.66, lng: -83.56, z: 3 },
    { c: "Akron", s: "OH", lat: 41.08, lng: -81.52, z: 3 },
    { c: "Dayton", s: "OH", lat: 39.76, lng: -84.19, z: 3 },
    { c: "Youngstown", s: "OH", lat: 41.1, lng: -80.65, z: 2 },
    { c: "Canton", s: "OH", lat: 40.8, lng: -81.38, z: 2 },
    { c: "Sandusky", s: "OH", lat: 41.45, lng: -82.71, z: 1 },
    { c: "Findlay", s: "OH", lat: 41.04, lng: -83.65, z: 1 },
    { c: "Kalamazoo", s: "MI", lat: 42.29, lng: -85.59, z: 2 },
    { c: "Flint", s: "MI", lat: 43.01, lng: -83.69, z: 2 },
    { c: "Saginaw", s: "MI", lat: 43.42, lng: -83.95, z: 1 },
    { c: "Lansing", s: "MI", lat: 42.73, lng: -84.55, z: 2 },
    { c: "Muncie", s: "IN", lat: 40.19, lng: -85.39, z: 1 },
    { c: "Fort Wayne", s: "IN", lat: 41.08, lng: -85.14, z: 3 },
    { c: "Terre Haute", s: "IN", lat: 39.47, lng: -87.41, z: 1 },
    { c: "Kokomo", s: "IN", lat: 40.49, lng: -86.13, z: 1 },
    { c: "Erie", s: "PA", lat: 42.13, lng: -80.09, z: 2 },
    { c: "Ashtabula", s: "OH", lat: 41.87, lng: -80.79, z: 1 },
    { c: "Defiance", s: "OH", lat: 41.28, lng: -84.36, z: 1 },
    { c: "Marion", s: "OH", lat: 40.59, lng: -83.13, z: 1 },
    { c: "Ypsilanti", s: "MI", lat: 42.24, lng: -83.61, z: 1 },
    { c: "Valparaiso", s: "IN", lat: 41.47, lng: -87.06, z: 1 },
    { c: "Ada", s: "OH", lat: 40.77, lng: -83.82, z: 1 },
    { c: "Bloomington", s: "IN", lat: 39.17, lng: -86.53, z: 2 },
    { c: "West Lafayette", s: "IN", lat: 40.43, lng: -86.91, z: 2 },
    { c: "South Bend", s: "IN", lat: 41.68, lng: -86.25, z: 2 },
    { c: "Evansville", s: "IN", lat: 37.97, lng: -87.56, z: 2 },
    { c: "Greencastle", s: "IN", lat: 39.64, lng: -86.86, z: 1 },
    { c: "Crawfordsville", s: "IN", lat: 40.04, lng: -86.9, z: 1 },
    { c: "Ann Arbor", s: "MI", lat: 42.28, lng: -83.74, z: 3 },
    { c: "East Lansing", s: "MI", lat: 42.74, lng: -84.48, z: 2 },
    { c: "Mount Pleasant", s: "MI", lat: 43.6, lng: -84.77, z: 1 },
    { c: "Big Rapids", s: "MI", lat: 43.7, lng: -85.48, z: 1 },
    { c: "Houghton", s: "MI", lat: 47.12, lng: -88.57, z: 1 },
    { c: "Adrian", s: "MI", lat: 41.9, lng: -84.04, z: 1 },
    { c: "Columbus", s: "OH", lat: 39.96, lng: -82.99, z: 3 },
    { c: "Oxford", s: "OH", lat: 39.51, lng: -84.75, z: 1 },
    { c: "Athens", s: "OH", lat: 39.33, lng: -82.1, z: 1 },
    { c: "Kent", s: "OH", lat: 41.15, lng: -81.36, z: 2 },
    { c: "Granville", s: "OH", lat: 40.07, lng: -82.52, z: 1 },
    { c: "Wooster", s: "OH", lat: 40.81, lng: -81.94, z: 1 },
    { c: "Hanover", s: "IN", lat: 38.71, lng: -85.46, z: 1 },
    { c: "Franklin", s: "IN", lat: 39.48, lng: -86.05, z: 1 },
    { c: "Upland", s: "IN", lat: 40.46, lng: -85.49, z: 1 },
    { c: "North Manchester", s: "IN", lat: 41, lng: -85.77, z: 1 },
    { c: "Anderson", s: "IN", lat: 40.11, lng: -85.68, z: 1 },
    { c: "Marquette", s: "MI", lat: 46.54, lng: -87.4, z: 1 },
    { c: "Hillsdale", s: "MI", lat: 41.92, lng: -84.63, z: 1 },
    { c: "Allendale", s: "MI", lat: 42.97, lng: -85.95, z: 1 },
    { c: "Alma", s: "MI", lat: 43.38, lng: -84.66, z: 1 },
    { c: "Tiffin", s: "OH", lat: 41.11, lng: -83.18, z: 1 },
    { c: "Berea", s: "OH", lat: 41.37, lng: -81.85, z: 1 },
    { c: "Westerville", s: "OH", lat: 40.13, lng: -82.93, z: 1 }
  ],
  Midwest: [
    { c: "Springfield", s: "IL", lat: 39.8, lng: -89.64, z: 2 },
    { c: "Peoria", s: "IL", lat: 40.69, lng: -89.59, z: 2 },
    { c: "Bloomington", s: "IL", lat: 40.48, lng: -88.99, z: 1 },
    { c: "Champaign", s: "IL", lat: 40.12, lng: -88.24, z: 2 },
    { c: "Carbondale", s: "IL", lat: 37.73, lng: -89.22, z: 1 },
    { c: "Quincy", s: "IL", lat: 39.94, lng: -91.41, z: 1 },
    { c: "Rockford", s: "IL", lat: 42.27, lng: -89.09, z: 2 },
    { c: "Rolla", s: "MO", lat: 37.95, lng: -91.77, z: 1 },
    { c: "Joplin", s: "MO", lat: 37.08, lng: -94.51, z: 1 },
    { c: "Warrensburg", s: "MO", lat: 38.76, lng: -93.74, z: 1 },
    { c: "Emporia", s: "KS", lat: 38.4, lng: -96.18, z: 1 },
    { c: "Hays", s: "KS", lat: 38.88, lng: -99.33, z: 1 },
    { c: "Salina", s: "KS", lat: 38.84, lng: -97.61, z: 1 },
    { c: "Manhattan", s: "KS", lat: 39.18, lng: -96.57, z: 1 },
    { c: "Pittsburg", s: "KS", lat: 37.41, lng: -94.7, z: 1 },
    { c: "Topeka", s: "KS", lat: 39.05, lng: -95.68, z: 2 },
    { c: "Lawrence", s: "KS", lat: 38.97, lng: -95.24, z: 2 },
    { c: "Macomb", s: "IL", lat: 40.46, lng: -90.67, z: 1 },
    { c: "Charleston", s: "IL", lat: 39.5, lng: -88.18, z: 1 },
    { c: "Des Moines", s: "IA", lat: 41.59, lng: -93.62, z: 3 },
    { c: "Iowa City", s: "IA", lat: 41.66, lng: -91.53, z: 2 },
    { c: "Ames", s: "IA", lat: 42.03, lng: -93.62, z: 2 },
    { c: "Cedar Falls", s: "IA", lat: 42.53, lng: -92.45, z: 1 },
    { c: "Dubuque", s: "IA", lat: 42.5, lng: -90.66, z: 1 },
    { c: "Davenport", s: "IA", lat: 41.52, lng: -90.58, z: 2 },
    { c: "Evanston", s: "IL", lat: 42.05, lng: -87.69, z: 2 },
    { c: "DeKalb", s: "IL", lat: 41.93, lng: -88.75, z: 1 },
    { c: "Normal", s: "IL", lat: 40.51, lng: -88.99, z: 2 },
    { c: "Galesburg", s: "IL", lat: 40.95, lng: -90.37, z: 1 },
    { c: "Naperville", s: "IL", lat: 41.79, lng: -88.15, z: 2 },
    { c: "Cedar Rapids", s: "IA", lat: 41.98, lng: -91.67, z: 2 },
    { c: "Waverly", s: "IA", lat: 42.73, lng: -92.48, z: 1 },
    { c: "Pella", s: "IA", lat: 41.41, lng: -92.92, z: 1 },
    { c: "Decorah", s: "IA", lat: 43.3, lng: -91.79, z: 1 },
    { c: "Grinnell", s: "IA", lat: 41.74, lng: -92.72, z: 1 },
    { c: "Indianola", s: "IA", lat: 41.36, lng: -93.56, z: 1 },
    { c: "Springfield", s: "MO", lat: 37.21, lng: -93.29, z: 2 },
    { c: "Maryville", s: "MO", lat: 40.35, lng: -94.87, z: 1 },
    { c: "Liberty", s: "MO", lat: 39.25, lng: -94.42, z: 1 }
  ],
  UpperMidwest: [
    { c: "Duluth", s: "MN", lat: 46.79, lng: -92.1, z: 2 },
    { c: "Mankato", s: "MN", lat: 44.16, lng: -94, z: 1 },
    { c: "Moorhead", s: "MN", lat: 46.87, lng: -96.77, z: 1 },
    { c: "Bemidji", s: "MN", lat: 47.47, lng: -94.88, z: 1 },
    { c: "St. Cloud", s: "MN", lat: 45.56, lng: -94.16, z: 2 },
    { c: "Winona", s: "MN", lat: 44.05, lng: -91.64, z: 1 },
    { c: "Eau Claire", s: "WI", lat: 44.81, lng: -91.5, z: 1 },
    { c: "La Crosse", s: "WI", lat: 43.8, lng: -91.24, z: 1 },
    { c: "Oshkosh", s: "WI", lat: 44.02, lng: -88.54, z: 1 },
    { c: "Stevens Point", s: "WI", lat: 44.52, lng: -89.57, z: 1 },
    { c: "Superior", s: "WI", lat: 46.72, lng: -92.1, z: 1 },
    { c: "Fargo", s: "ND", lat: 46.88, lng: -96.79, z: 2 },
    { c: "Grand Forks", s: "ND", lat: 47.93, lng: -97.03, z: 1 },
    { c: "Bismarck", s: "ND", lat: 46.81, lng: -100.78, z: 2 },
    { c: "Aberdeen", s: "SD", lat: 45.46, lng: -98.49, z: 1 },
    { c: "Brookings", s: "SD", lat: 44.31, lng: -96.8, z: 1 },
    { c: "Vermillion", s: "SD", lat: 42.78, lng: -96.93, z: 1 },
    { c: "Marshall", s: "MN", lat: 44.45, lng: -95.79, z: 1 },
    { c: "Crookston", s: "MN", lat: 47.77, lng: -96.61, z: 1 },
    { c: "River Falls", s: "WI", lat: 44.86, lng: -92.62, z: 1 },
    { c: "Green Bay", s: "WI", lat: 44.51, lng: -88.02, z: 2 },
    { c: "Whitewater", s: "WI", lat: 42.83, lng: -88.73, z: 1 },
    { c: "Madison", s: "WI", lat: 43.07, lng: -89.4, z: 3 },
    { c: "Platteville", s: "WI", lat: 42.73, lng: -90.48, z: 1 },
    { c: "Minot", s: "ND", lat: 48.23, lng: -101.3, z: 1 },
    { c: "Dickinson", s: "ND", lat: 46.88, lng: -102.79, z: 1 },
    { c: "Valley City", s: "ND", lat: 46.92, lng: -98, z: 1 },
    { c: "Minneapolis", s: "MN", lat: 44.98, lng: -93.27, z: 3 },
    { c: "Northfield", s: "MN", lat: 44.46, lng: -93.16, z: 1 },
    { c: "Collegeville", s: "MN", lat: 45.59, lng: -94.36, z: 1 },
    { c: "Appleton", s: "WI", lat: 44.26, lng: -88.42, z: 2 },
    { c: "Sioux Falls", s: "SD", lat: 43.55, lng: -96.73, z: 2 },
    { c: "Jamestown", s: "ND", lat: 46.91, lng: -98.71, z: 1 },
    { c: "Mayville", s: "ND", lat: 47.5, lng: -97.32, z: 1 }
  ],
  Plains: [
    { c: "Lincoln", s: "NE", lat: 40.81, lng: -96.68, z: 3 },
    { c: "Omaha", s: "NE", lat: 41.26, lng: -95.94, z: 3 },
    { c: "Kearney", s: "NE", lat: 40.7, lng: -99.08, z: 1 },
    { c: "Grand Island", s: "NE", lat: 40.93, lng: -98.34, z: 1 },
    { c: "Hastings", s: "NE", lat: 40.59, lng: -98.39, z: 1 },
    { c: "Wichita", s: "KS", lat: 37.69, lng: -97.34, z: 3 },
    { c: "Dodge City", s: "KS", lat: 37.75, lng: -100.02, z: 1 },
    { c: "Garden City", s: "KS", lat: 37.97, lng: -100.87, z: 1 },
    { c: "Rapid City", s: "SD", lat: 44.08, lng: -103.23, z: 2 },
    { c: "Cheyenne", s: "WY", lat: 41.14, lng: -104.82, z: 2 },
    { c: "Laramie", s: "WY", lat: 41.31, lng: -105.59, z: 1 },
    { c: "Casper", s: "WY", lat: 42.85, lng: -106.32, z: 1 },
    { c: "Scottsbluff", s: "NE", lat: 41.87, lng: -103.66, z: 1 },
    { c: "Chadron", s: "NE", lat: 42.83, lng: -103, z: 1 },
    { c: "Pierre", s: "SD", lat: 44.37, lng: -100.35, z: 1 },
    { c: "Mitchell", s: "SD", lat: 43.71, lng: -98.03, z: 1 },
    { c: "Yankton", s: "SD", lat: 42.87, lng: -97.4, z: 1 },
    { c: "Wayne", s: "NE", lat: 42.23, lng: -97.02, z: 1 },
    { c: "Peru", s: "NE", lat: 40.48, lng: -95.73, z: 1 },
    { c: "Powell", s: "WY", lat: 44.75, lng: -108.76, z: 1 },
    { c: "Gillette", s: "WY", lat: 44.29, lng: -105.5, z: 1 },
    { c: "Sheridan", s: "WY", lat: 44.8, lng: -106.96, z: 1 },
    { c: "Seward", s: "NE", lat: 40.91, lng: -97.1, z: 1 },
    { c: "Winfield", s: "KS", lat: 37.24, lng: -96.99, z: 1 },
    { c: "Madison", s: "SD", lat: 44.01, lng: -97.11, z: 1 }
  ],
  MountainWest: [
    { c: "Provo", s: "UT", lat: 40.23, lng: -111.66, z: 2 },
    { c: "Ogden", s: "UT", lat: 41.22, lng: -111.97, z: 2 },
    { c: "Logan", s: "UT", lat: 41.74, lng: -111.83, z: 1 },
    { c: "Boulder", s: "CO", lat: 40.01, lng: -105.27, z: 2 },
    { c: "Greeley", s: "CO", lat: 40.42, lng: -104.71, z: 1 },
    { c: "Pueblo", s: "CO", lat: 38.25, lng: -104.61, z: 2 },
    { c: "Grand Junction", s: "CO", lat: 39.06, lng: -108.55, z: 1 },
    { c: "Durango", s: "CO", lat: 37.28, lng: -107.88, z: 1 },
    { c: "Gunnison", s: "CO", lat: 38.55, lng: -106.93, z: 1 },
    { c: "Boise", s: "ID", lat: 43.62, lng: -116.2, z: 3 },
    { c: "Pocatello", s: "ID", lat: 42.87, lng: -112.45, z: 1 },
    { c: "Missoula", s: "MT", lat: 46.87, lng: -113.99, z: 2 },
    { c: "Bozeman", s: "MT", lat: 45.68, lng: -111.04, z: 1 },
    { c: "Billings", s: "MT", lat: 45.78, lng: -108.5, z: 2 },
    { c: "Helena", s: "MT", lat: 46.59, lng: -112.04, z: 1 },
    { c: "Flagstaff", s: "AZ", lat: 35.2, lng: -111.65, z: 1 },
    { c: "Cedar City", s: "UT", lat: 37.68, lng: -113.06, z: 1 },
    { c: "Twin Falls", s: "ID", lat: 42.56, lng: -114.46, z: 1 },
    { c: "Cortez", s: "CO", lat: 37.35, lng: -108.59, z: 1 },
    { c: "Alamosa", s: "CO", lat: 37.47, lng: -105.87, z: 1 },
    { c: "Butte", s: "MT", lat: 46, lng: -112.53, z: 1 },
    { c: "Great Falls", s: "MT", lat: 47.51, lng: -111.3, z: 1 },
    { c: "Havre", s: "MT", lat: 48.55, lng: -109.68, z: 1 },
    { c: "Salt Lake City", s: "UT", lat: 40.76, lng: -111.89, z: 3 },
    { c: "Orem", s: "UT", lat: 40.3, lng: -111.69, z: 2 },
    { c: "Ephraim", s: "UT", lat: 39.36, lng: -111.59, z: 1 },
    { c: "Rexburg", s: "ID", lat: 43.83, lng: -111.79, z: 1 },
    { c: "Nampa", s: "ID", lat: 43.54, lng: -116.56, z: 2 },
    { c: "Tempe", s: "AZ", lat: 33.43, lng: -111.94, z: 3 },
    { c: "Tucson", s: "AZ", lat: 32.22, lng: -110.97, z: 3 },
    { c: "Prescott", s: "AZ", lat: 34.54, lng: -112.47, z: 1 },
    { c: "Thatcher", s: "AZ", lat: 32.83, lng: -109.76, z: 1 },
    { c: "Fort Collins", s: "CO", lat: 40.59, lng: -105.08, z: 2 },
    { c: "Golden", s: "CO", lat: 39.76, lng: -105.22, z: 1 },
    { c: "Dillon", s: "MT", lat: 45.22, lng: -112.64, z: 1 },
    { c: "St. George", s: "UT", lat: 37.1, lng: -113.58, z: 1 },
    { c: "Price", s: "UT", lat: 39.6, lng: -110.81, z: 1 },
    { c: "Kaysville", s: "UT", lat: 41.04, lng: -111.94, z: 1 },
    { c: "Mesa", s: "AZ", lat: 33.42, lng: -111.83, z: 3 },
    { c: "Glendale", s: "AZ", lat: 33.54, lng: -112.19, z: 2 },
    { c: "Idaho Falls", s: "ID", lat: 43.49, lng: -112.03, z: 2 },
    { c: "Caldwell", s: "ID", lat: 43.66, lng: -116.69, z: 1 },
    { c: "Miles City", s: "MT", lat: 46.41, lng: -105.84, z: 1 },
    { c: "Sterling", s: "CO", lat: 40.63, lng: -103.21, z: 1 },
    { c: "Lakewood", s: "CO", lat: 39.7, lng: -105.08, z: 2 }
  ],
  Southwest: [
    { c: "Lubbock", s: "TX", lat: 33.58, lng: -101.85, z: 3 },
    { c: "Amarillo", s: "TX", lat: 35.21, lng: -101.83, z: 2 },
    { c: "Abilene", s: "TX", lat: 32.45, lng: -99.73, z: 2 },
    { c: "Waco", s: "TX", lat: 31.55, lng: -97.15, z: 2 },
    { c: "Denton", s: "TX", lat: 33.21, lng: -97.13, z: 2 },
    { c: "Tyler", s: "TX", lat: 32.35, lng: -95.3, z: 2 },
    { c: "San Angelo", s: "TX", lat: 31.46, lng: -100.44, z: 1 },
    { c: "Midland", s: "TX", lat: 31.99, lng: -102.08, z: 2 },
    { c: "El Paso", s: "TX", lat: 31.76, lng: -106.49, z: 3 },
    { c: "Las Cruces", s: "NM", lat: 32.31, lng: -106.78, z: 2 },
    { c: "Roswell", s: "NM", lat: 33.39, lng: -104.52, z: 1 },
    { c: "Nacogdoches", s: "TX", lat: 31.6, lng: -94.65, z: 1 },
    { c: "Huntsville", s: "TX", lat: 30.72, lng: -95.55, z: 1 },
    { c: "Wichita Falls", s: "TX", lat: 33.91, lng: -98.49, z: 1 },
    { c: "Odessa", s: "TX", lat: 31.85, lng: -102.37, z: 2 },
    { c: "Killeen", s: "TX", lat: 31.12, lng: -97.73, z: 2 },
    { c: "Temple", s: "TX", lat: 31.1, lng: -97.34, z: 1 },
    { c: "Stephenville", s: "TX", lat: 32.22, lng: -98.2, z: 1 },
    { c: "Commerce", s: "TX", lat: 33.25, lng: -95.9, z: 1 },
    { c: "Alpine", s: "TX", lat: 30.36, lng: -103.66, z: 1 },
    // Border reach: Texas conferences take the occasional Oklahoma school.
    { c: "Lawton", s: "OK", lat: 34.61, lng: -98.39, z: 1 },
    { c: "Durant", s: "OK", lat: 33.99, lng: -96.37, z: 1 },
    { c: "Albuquerque", s: "NM", lat: 35.08, lng: -106.65, z: 3 },
    { c: "Santa Fe", s: "NM", lat: 35.69, lng: -105.94, z: 2 },
    { c: "Portales", s: "NM", lat: 34.19, lng: -103.33, z: 1 },
    { c: "Silver City", s: "NM", lat: 32.77, lng: -108.28, z: 1 },
    { c: "Norman", s: "OK", lat: 35.22, lng: -97.44, z: 2 },
    { c: "Stillwater", s: "OK", lat: 36.12, lng: -97.06, z: 2 },
    { c: "Tulsa", s: "OK", lat: 36.15, lng: -95.99, z: 3 },
    { c: "Edmond", s: "OK", lat: 35.65, lng: -97.48, z: 2 },
    { c: "Weatherford", s: "OK", lat: 35.53, lng: -98.71, z: 1 },
    { c: "Austin", s: "TX", lat: 30.27, lng: -97.74, z: 3 },
    { c: "College Station", s: "TX", lat: 30.63, lng: -96.33, z: 2 },
    { c: "San Marcos", s: "TX", lat: 29.88, lng: -97.94, z: 1 },
    { c: "Canyon", s: "TX", lat: 34.98, lng: -101.92, z: 1 },
    { c: "Georgetown", s: "TX", lat: 30.63, lng: -97.68, z: 1 },
    { c: "Kingsville", s: "TX", lat: 27.52, lng: -97.86, z: 1 },
    { c: "Ada", s: "OK", lat: 34.77, lng: -96.68, z: 1 },
    { c: "Tahlequah", s: "OK", lat: 35.92, lng: -94.97, z: 1 },
    { c: "Shawnee", s: "OK", lat: 35.33, lng: -96.93, z: 1 },
    { c: "Alva", s: "OK", lat: 36.8, lng: -98.67, z: 1 },
    { c: "Hobbs", s: "NM", lat: 32.7, lng: -103.14, z: 1 },
    { c: "Farmington", s: "NM", lat: 36.73, lng: -108.22, z: 1 },
    { c: "Bartlesville", s: "OK", lat: 36.75, lng: -95.98, z: 1 },
    { c: "Goodwell", s: "OK", lat: 36.6, lng: -101.63, z: 1 },
    { c: "Claremore", s: "OK", lat: 36.31, lng: -95.62, z: 1 },
    { c: "Socorro", s: "NM", lat: 34.06, lng: -106.89, z: 1 },
    { c: "Alamogordo", s: "NM", lat: 32.9, lng: -105.96, z: 1 },
    { c: "Gallup", s: "NM", lat: 35.53, lng: -108.74, z: 1 },
    { c: "Beaumont", s: "TX", lat: 30.08, lng: -94.13, z: 2 }
  ],
  // The Outposts (Jul 2026): Hawaii and Alaska exist ONLY as founding ground.
  // No school is generated here at worldgen — these are for The Outpost start,
  // where the real, unfixable constraint is geography: every recruit in the
  // pool is 2,500+ miles away, so DISTANCE_MOD taxes every dollar you spend
  // and your effective spend is a fraction of a mainland program's. That's not
  // a difficulty slider — it's the map.
  Hawaii: [
    { c: "Honolulu", s: "HI", lat: 21.31, lng: -157.86, z: 3 },
    { c: "Hilo", s: "HI", lat: 19.71, lng: -155.09, z: 2 },
    { c: "Kailua", s: "HI", lat: 21.4, lng: -157.74, z: 2 },
    { c: "Kaneohe", s: "HI", lat: 21.42, lng: -157.8, z: 1 },
    { c: "Laie", s: "HI", lat: 21.65, lng: -157.92, z: 1 },
    { c: "Wailuku", s: "HI", lat: 20.89, lng: -156.5, z: 1 }
  ],
  Alaska: [
    { c: "Anchorage", s: "AK", lat: 61.22, lng: -149.9, z: 3 },
    { c: "Fairbanks", s: "AK", lat: 64.84, lng: -147.72, z: 2 },
    { c: "Juneau", s: "AK", lat: 58.3, lng: -134.42, z: 1 },
    { c: "Sitka", s: "AK", lat: 57.05, lng: -135.33, z: 1 },
    { c: "Palmer", s: "AK", lat: 61.6, lng: -149.11, z: 1 },
    { c: "Kenai", s: "AK", lat: 60.55, lng: -151.26, z: 1 }
  ],
  PacificNW: [
    { c: "Eugene", s: "OR", lat: 44.05, lng: -123.09, z: 2 },
    { c: "Salem", s: "OR", lat: 44.94, lng: -123.04, z: 2 },
    { c: "Corvallis", s: "OR", lat: 44.56, lng: -123.26, z: 1 },
    { c: "Bend", s: "OR", lat: 44.06, lng: -121.31, z: 2 },
    { c: "Medford", s: "OR", lat: 42.33, lng: -122.87, z: 1 },
    { c: "Tacoma", s: "WA", lat: 47.25, lng: -122.44, z: 3 },
    { c: "Spokane", s: "WA", lat: 47.66, lng: -117.43, z: 3 },
    { c: "Yakima", s: "WA", lat: 46.6, lng: -120.51, z: 1 },
    { c: "Bellingham", s: "WA", lat: 48.75, lng: -122.48, z: 1 },
    { c: "Olympia", s: "WA", lat: 47.04, lng: -122.9, z: 1 },
    { c: "Ellensburg", s: "WA", lat: 46.99, lng: -120.55, z: 1 },
    { c: "Cheney", s: "WA", lat: 47.49, lng: -117.58, z: 1 },
    { c: "Ashland", s: "OR", lat: 42.19, lng: -122.71, z: 1 },
    { c: "Monmouth", s: "OR", lat: 44.85, lng: -123.23, z: 1 },
    { c: "Klamath Falls", s: "OR", lat: 42.22, lng: -121.78, z: 1 },
    { c: "Pullman", s: "WA", lat: 46.73, lng: -117.18, z: 1 },
    { c: "Moscow", s: "ID", lat: 46.73, lng: -117, z: 1 },
    { c: "Walla Walla", s: "WA", lat: 46.06, lng: -118.34, z: 1 },
    { c: "Newberg", s: "OR", lat: 45.3, lng: -122.97, z: 1 },
    { c: "La Grande", s: "OR", lat: 45.32, lng: -118.09, z: 1 },
    { c: "Lewiston", s: "ID", lat: 46.42, lng: -117.02, z: 1 },
    { c: "Coeur d'Alene", s: "ID", lat: 47.68, lng: -116.78, z: 1 },
    { c: "Seattle", s: "WA", lat: 47.61, lng: -122.33, z: 3 },
    { c: "Portland", s: "OR", lat: 45.52, lng: -122.68, z: 3 },
    { c: "Forest Grove", s: "OR", lat: 45.52, lng: -123.11, z: 1 },
    { c: "McMinnville", s: "OR", lat: 45.21, lng: -123.2, z: 1 },
    { c: "Everett", s: "WA", lat: 47.98, lng: -122.2, z: 2 },
    { c: "Lacey", s: "WA", lat: 47.03, lng: -122.82, z: 1 },
    { c: "Sandpoint", s: "ID", lat: 48.28, lng: -116.55, z: 1 }
  ],
  California: [
    { c: "Fresno", s: "CA", lat: 36.75, lng: -119.77, z: 3 },
    { c: "Bakersfield", s: "CA", lat: 35.37, lng: -119.02, z: 3 },
    { c: "Stockton", s: "CA", lat: 37.96, lng: -121.29, z: 2 },
    { c: "Modesto", s: "CA", lat: 37.64, lng: -120.99, z: 2 },
    { c: "Chico", s: "CA", lat: 39.73, lng: -121.84, z: 1 },
    { c: "Riverside", s: "CA", lat: 33.95, lng: -117.4, z: 3 },
    { c: "Fullerton", s: "CA", lat: 33.87, lng: -117.93, z: 2 },
    { c: "Northridge", s: "CA", lat: 34.24, lng: -118.53, z: 2 },
    { c: "Pomona", s: "CA", lat: 34.06, lng: -117.75, z: 2 },
    { c: "San Luis Obispo", s: "CA", lat: 35.28, lng: -120.66, z: 1 },
    { c: "Turlock", s: "CA", lat: 37.49, lng: -120.85, z: 1 },
    { c: "Arcata", s: "CA", lat: 40.87, lng: -124.08, z: 1 },
    { c: "Hayward", s: "CA", lat: 37.67, lng: -122.08, z: 2 },
    { c: "Carson", s: "CA", lat: 33.83, lng: -118.28, z: 2 },
    { c: "Long Beach", s: "CA", lat: 33.77, lng: -118.19, z: 3 },
    { c: "Sacramento", s: "CA", lat: 38.58, lng: -121.49, z: 3 },
    { c: "Merced", s: "CA", lat: 37.3, lng: -120.48, z: 1 },
    { c: "Visalia", s: "CA", lat: 36.33, lng: -119.29, z: 1 },
    { c: "Redding", s: "CA", lat: 40.59, lng: -122.39, z: 1 },
    { c: "San Marcos", s: "CA", lat: 33.14, lng: -117.17, z: 1 },
    // Border reach (PAC-style): CA conferences take the occasional NV/AZ school.
    { c: "Reno", s: "NV", lat: 39.53, lng: -119.81, z: 2 },
    { c: "Henderson", s: "NV", lat: 36.04, lng: -114.98, z: 1 },
    { c: "Yuma", s: "AZ", lat: 32.69, lng: -114.63, z: 1 },
    { c: "Las Vegas", s: "NV", lat: 36.17, lng: -115.14, z: 3 },
    { c: "Carson City", s: "NV", lat: 39.16, lng: -119.77, z: 1 },
    { c: "Elko", s: "NV", lat: 40.83, lng: -115.76, z: 1 },
    { c: "Redlands", s: "CA", lat: 34.06, lng: -117.18, z: 1 },
    { c: "Claremont", s: "CA", lat: 34.1, lng: -117.72, z: 1 },
    { c: "Thousand Oaks", s: "CA", lat: 34.17, lng: -118.84, z: 1 },
    { c: "Malibu", s: "CA", lat: 34.04, lng: -118.69, z: 1 },
    { c: "Sparks", s: "NV", lat: 39.53, lng: -119.75, z: 1 },
    { c: "Winnemucca", s: "NV", lat: 40.97, lng: -117.74, z: 1 },
    { c: "Boulder City", s: "NV", lat: 35.98, lng: -114.83, z: 1 },
    { c: "Irvine", s: "CA", lat: 33.68, lng: -117.83, z: 2 },
    { c: "Santa Barbara", s: "CA", lat: 34.42, lng: -119.7, z: 2 },
    { c: "La Verne", s: "CA", lat: 34.1, lng: -117.77, z: 1 },
    { c: "Orange", s: "CA", lat: 33.79, lng: -117.85, z: 2 },
    { c: "Moraga", s: "CA", lat: 37.83, lng: -122.13, z: 1 },
    { c: "Rohnert Park", s: "CA", lat: 38.34, lng: -122.7, z: 1 },
    { c: "Seaside", s: "CA", lat: 36.61, lng: -121.85, z: 1 }
  ]
};
STATE_TOKENS = {
  // D2/D3 procedural tokens. These are INVENTED regional words (not real
  // state names) so "University of ___" / "___ State" / "___ Tech" patterns
  // can never reproduce a real university. D1 is static and never uses these.
  Southeast: [
    { t: "Tidewater", states: ["VA"], uOf: 1, st: 1, tech: 1, dir: 1 },
    { t: "Okefenokee", states: ["GA"], uOf: 1, st: 1, dir: 1, sat: 1 },
    { t: "Altamaha", states: ["GA"], st: 1, dir: 1 },
    { t: "Uwharrie", states: ["NC"], uOf: 1, st: 1, dir: 1 },
    { t: "Pamlico", states: ["NC"], st: 1, dir: 1 },
    { t: "Santee", states: ["SC"], uOf: 1, st: 1, dir: 1 },
    { t: "Rappahannock", states: ["VA"], uOf: 1, st: 1, dir: 1 }
  ],
  DeepSouth: [
    { t: "Yazoo", states: ["MS"], uOf: 1, st: 1, dir: 1 },
    { t: "Acadiana", states: ["LA"], uOf: 1, st: 1, tech: 1, dir: 1, sat: 1 },
    { t: "Tombigbee", states: ["AL", "MS"], uOf: 1, st: 1, am: 1, dir: 1 },
    { t: "Atchafalaya", states: ["LA"], st: 1, dir: 1 },
    { t: "Cahaba", states: ["AL"], uOf: 1, st: 1, dir: 1 },
    { t: "Tallapoosa", states: ["AL"], st: 1, am: 1, dir: 1 },
    { t: "Sipsey", states: ["AL"], st: 1, dir: 1 }
  ],
  MidSouth: [
    { t: "Bluegrass", states: ["KY"], uOf: 1, st: 1, dir: 1 },
    { t: "Pennyrile", states: ["KY"], uOf: 1, st: 1, dir: 1 },
    { t: "Sequatchie", states: ["TN"], uOf: 1, st: 1, dir: 1 },
    { t: "Nolichucky", states: ["TN"], st: 1, dir: 1 },
    { t: "Petit Jean", states: ["AR"], st: 1, dir: 1 },
    { t: "Buffalo River", states: ["AR"], uOf: 1, st: 1, dir: 1 }
  ],
  MidAtlantic: [
    { t: "Monongahela", states: ["WV"], uOf: 1, st: 1, tech: 1, dir: 1 },
    { t: "Brandywine", states: ["DE", "PA"], uOf: 1, st: 1, dir: 1 },
    { t: "Raritan", states: ["NJ"], uOf: 1, st: 1, tech: 1, dir: 1 },
    { t: "Laurel Highlands", states: ["PA"], st: 1, dir: 1 },
    { t: "Pocono", states: ["PA"], uOf: 1, st: 1, dir: 1 },
    { t: "Delmarva", states: ["MD", "DE"], st: 1, dir: 1 },
    { t: "Canaan", states: ["WV"], st: 1, dir: 1 },
    { t: "Patapsco", states: ["MD"], uOf: 1, st: 1, dir: 1 }
  ],
  Northeast: [
    { t: "Green Mountain", states: ["VT"], uOf: 1, st: 1, tech: 1, dir: 1 },
    { t: "Nutmeg", states: ["CT"], uOf: 1, st: 1, dir: 1 },
    { t: "Yankee", states: ["MA", "NH", "VT", "CT", "RI", "ME"], uOf: 1 },
    { t: "Penobscot", states: ["ME"], uOf: 1, st: 1, dir: 1 },
    { t: "Katahdin", states: ["ME"], st: 1, dir: 1 },
    { t: "Winnipesaukee", states: ["NH"], st: 1, dir: 1 },
    { t: "Monadnock", states: ["NH"], uOf: 1, st: 1, dir: 1 },
    { t: "Narragansett", states: ["RI"], uOf: 1, st: 1, dir: 1 }
  ],
  GreatLakes: [
    { t: "Maumee", states: ["OH"], su: 1, st: 1, dir: 1 },
    { t: "Sandusky", states: ["OH"], st: 1, dir: 1 },
    { t: "Huron", states: ["MI"], uOf: 1, st: 1, tech: 1, dir: 1 },
    { t: "Manistee", states: ["MI"], st: 1, dir: 1 },
    { t: "Tippecanoe", states: ["IN"], su: 1, st: 1, tech: 1, dir: 1 },
    { t: "Pokagon", states: ["IN", "MI"], uOf: 1, st: 1, dir: 1 }
  ],
  Midwest: [
    { t: "Rock River", states: ["IL"], uOf: 1, st: 1, dir: 1, sat: 1 },
    { t: "Vermilion", states: ["IL"], st: 1, dir: 1 },
    { t: "Ozarka", states: ["MO"], uOf: 1, st: 1, dir: 1 },
    { t: "Gasconade", states: ["MO"], st: 1, dir: 1 },
    { t: "Flint Hills", states: ["KS"], uOf: 1, st: 1 },
    { t: "Konza", states: ["KS"], uOf: 1, st: 1, dir: 1 },
    { t: "Cedar", states: ["IA"], uOf: 1, st: 1, dir: 1 },
    { t: "Loess Hills", states: ["IA"], st: 1, dir: 1 }
  ],
  UpperMidwest: [
    { t: "Boundary Waters", states: ["MN"], uOf: 1, st: 1, dir: 1, sat: 1 },
    { t: "Pipestone", states: ["MN"], st: 1, dir: 1 },
    { t: "Kettle", states: ["WI"], uOf: 1, st: 1, sat: 1 },
    { t: "Namekagon", states: ["WI"], st: 1, dir: 1 },
    { t: "Coteau", states: ["ND", "SD"], st: 1 },
    { t: "Sheyenne", states: ["ND"], uOf: 1, st: 1, dir: 1 },
    { t: "Driftless", states: ["WI", "MN"], uOf: 1, st: 1, dir: 1 }
  ],
  Plains: [
    { t: "Platte", states: ["NE"], uOf: 1, st: 1, sat: 1 },
    { t: "Niobrara", states: ["NE"], st: 1, dir: 1 },
    { t: "Wind River", states: ["WY"], uOf: 1, st: 1 },
    { t: "Medicine Bow", states: ["WY"], st: 1, dir: 1 },
    { t: "Powder River", states: ["WY"], st: 1, dir: 1 },
    { t: "Smoky Hill", states: ["KS"], uOf: 1, st: 1 },
    { t: "Solomon", states: ["KS"], uOf: 1, st: 1 }
  ],
  MountainWest: [
    { t: "Front Range", states: ["CO"], uOf: 1, st: 1, dir: 1, sat: 1 },
    { t: "Sangre de Cristo", states: ["CO"], st: 1, dir: 1 },
    { t: "Yampa", states: ["CO"], st: 1, dir: 1 },
    { t: "Wasatch", states: ["UT"], uOf: 1, st: 1, tech: 1, dir: 1 },
    { t: "Uinta", states: ["UT"], st: 1, dir: 1 },
    { t: "Bitterroot", states: ["MT"], uOf: 1, st: 1, tech: 1, dir: 1 },
    { t: "Beartooth", states: ["MT"], st: 1, dir: 1 },
    { t: "Yellowstone", states: ["MT"], uOf: 1, st: 1, dir: 1 }
  ],
  Southwest: [
    { t: "Brazos", states: ["TX"], uOf: 1, st: 1, am: 1, tech: 1, dir: 1, sat: 1 },
    { t: "Llano", states: ["TX"], st: 1, am: 1, dir: 1 },
    { t: "Caprock", states: ["TX"], st: 1, tech: 1, dir: 1 },
    { t: "Chisos", states: ["TX"], st: 1, dir: 1 },
    { t: "Sandia", states: ["NM"], uOf: 1, st: 1, tech: 1, dir: 1 },
    { t: "Gila", states: ["NM"], uOf: 1, st: 1, dir: 1 },
    { t: "Mesilla", states: ["NM"], st: 1, dir: 1 },
    { t: "Pecos", states: ["TX", "NM"], uOf: 1, st: 1, dir: 1 }
  ],
  Hawaii: [
    { t: "Kona", states: ["HI"], uOf: 1, st: 1, tech: 1, dir: 1 },
    { t: "Kohala", states: ["HI"], st: 1, dir: 1 },
    { t: "Haleakala", states: ["HI"], uOf: 1, st: 1, dir: 1 }
  ],
  Alaska: [
    { t: "Denali", states: ["AK"], uOf: 1, st: 1, tech: 1, dir: 1 },
    { t: "Chugach", states: ["AK"], st: 1, dir: 1 },
    { t: "Susitna", states: ["AK"], uOf: 1, st: 1, dir: 1 },
    { t: "Brooks Range", states: ["AK"], st: 1, dir: 1 }
  ],
  PacificNW: [
    { t: "Cascade", states: ["WA"], uOf: 1, st: 1, dir: 1 },
    { t: "Palouse", states: ["WA", "ID"], st: 1, dir: 1 },
    { t: "Sawtooth", states: ["ID"], uOf: 1, st: 1, dir: 1 },
    { t: "Payette", states: ["ID"], st: 1, dir: 1 },
    { t: "Snake River", states: ["ID"], uOf: 1, st: 1, dir: 1 },
    { t: "Deschutes", states: ["OR"], uOf: 1, st: 1, tech: 1, dir: 1 },
    { t: "Wallowa", states: ["OR"], st: 1, dir: 1 }
  ],
  California: [
    { t: "Mojave", states: ["CA"], st: 1, tech: 1, dir: 1 },
    { t: "Big Sur", states: ["CA"], uOf: 1, st: 1, dir: 1 },
    { t: "Panamint", states: ["CA"], st: 1, dir: 1 },
    { t: "Owens Valley", states: ["CA"], uOf: 1, st: 1, dir: 1 },
    { t: "Tehachapi", states: ["CA"], st: 1, dir: 1 },
    { t: "Carrizo", states: ["CA"], st: 1, dir: 1 }
  ]
};
DIRS = ["Northern", "Southern", "Eastern", "Western", "Central"];
DENOMS_DEFAULT = ["Wesleyan", "Baptist", "Lutheran", "Methodist", "Christian"];
DENOMS_BY_REGION = {
  DeepSouth: ["Baptist", "Baptist", "Methodist", "Christian", "Wesleyan"],
  Southeast: ["Baptist", "Methodist", "Wesleyan", "Christian"],
  MidSouth: ["Baptist", "Methodist", "Christian", "Wesleyan"],
  Southwest: ["Baptist", "Christian", "Methodist", "Lutheran", "Wesleyan"],
  UpperMidwest: ["Lutheran", "Lutheran", "Lutheran", "Wesleyan", "Methodist"],
  Plains: ["Lutheran", "Lutheran", "Wesleyan", "Methodist", "Baptist"],
  Northeast: ["Wesleyan", "Methodist", "Christian"],
  MidAtlantic: ["Wesleyan", "Lutheran", "Methodist", "Christian"],
  GreatLakes: ["Wesleyan", "Lutheran", "Methodist", "Christian"]
};
GAZ_CITY_NAMES = new Set(
  Object.values(REGION_CITIES).flatMap((cs) => cs.map((c) => c.c))
);
PERSON_NAMES = [
  // No gazetteer-city or state-token names here (Madison/Lincoln/Wayne/Washington
  // removed) — a person
  // college must never look like a city or state school to the coherence checks.
  "Adams",
  "Aldrich",
  "Ames",
  "Barton",
  "Benton",
  "Bradford",
  "Carson",
  "Clay",
  "Clinton",
  "Crawford",
  "Dawson",
  "Douglas",
  "Drew",
  "Edison",
  "Ellery",
  "Farwell",
  "Fenwick",
  "Grant",
  "Halstead",
  "Hardin",
  "Harrison",
  "Hayes",
  "Jackson",
  "Jefferson",
  "Knox",
  "Langdon",
  "Logan",
  "Larkspur",
  "Merton",
  "Morton",
  "Pierce",
  "Porter",
  "Putnam",
  "Rogers",
  "Sheridan",
  "Sherman",
  "Tilden",
  "Tyler",
  "Warren",
  "Wexford",
  "Wilson",
  "Abbott",
  "Ainsworth",
  "Bramwell",
  "Bancroft",
  "Beckett",
  "Calloway",
  "Chandler",
  "Colfax",
  "Cushing",
  "Dennison",
  "Everett",
  "Fairbanks",
  "Gallatin",
  "Hawthorne",
  "Holbrook",
  "Kendrick",
  "Lattimore",
  "Merritt",
  "Osgood",
  "Pemberton",
  "Quimby",
  "Rutledge",
  "Sinclair",
  "Thorndike",
  "Vance",
  "Whitfield",
  "Winslow",
  "Yardley"
].filter((p) => !GAZ_CITY_NAMES.has(p));
SAINT_NAMES = [
  // Obscure/invented saint names — deliberately NOT the well-known ones that
  // map to real US colleges (no St. Bonaventure/Olaf/Norbert/Anselm/Ambrose/
  // Francis/Lawrence/Vincent/Benedict/Scholastica/Catherine/Thomas/Mary's).
  "St. Aldous",
  "St. Clement",
  "St. Cuthbert",
  "St. Edmund",
  "St. Ethelred",
  "St. Gerasimus",
  "St. Helena",
  "St. Hilary",
  "St. Jerome",
  "St. Kieran",
  "St. Kentigern",
  "St. Botolph",
  "St. Werburgh",
  "St. Aidan",
  "St. Raphael",
  "St. Sebastian",
  "St. Thaddeus",
  "St. Alphege",
  "St. Cadoc",
  "St. Chad",
  "St. Columba",
  "St. Hildegard",
  "St. Petroc",
  "St. Cyprian",
  "St. Dunstan",
  "St. Basil",
  "St. Crispin",
  "St. Fabian",
  "St. Leander",
  "St. Maurus",
  "St. Ninian",
  "St. Regis",
  "St. Swithin",
  "St. Ursula",
  "St. Willibrord",
  "St. Egwin"
];
NICKS_CLASSIC = [
  { n: "Bulldogs", e: "\u{1F43E}" },
  { n: "Eagles", e: "\u{1F985}" },
  { n: "Wildcats", e: "\u{1F43E}" },
  { n: "Panthers", e: "\u{1F406}" },
  { n: "Tigers", e: "\u{1F42F}" },
  { n: "Falcons", e: "\u{1F985}" },
  { n: "Bears", e: "\u{1F43B}" },
  { n: "Wolves", e: "\u{1F43A}" },
  { n: "Lions", e: "\u{1F981}" },
  { n: "Rams", e: "\u{1F40F}" },
  { n: "Cardinals", e: "\u{1F534}" },
  { n: "Stallions", e: "\u{1F434}" },
  { n: "Mustangs", e: "\u{1F434}" },
  { n: "Chargers", e: "\u26A1" },
  { n: "Raiders", e: "\u2694\uFE0F" },
  { n: "Warriors", e: "\u2694\uFE0F" },
  { n: "Golden Eagles", e: "\u{1F985}" },
  { n: "Firebirds", e: "\u{1F525}" },
  { n: "Cyclones", e: "\u{1F300}" },
  { n: "Hornets", e: "\u{1F41D}" },
  { n: "Owls", e: "\u{1F989}" },
  { n: "Bearcats", e: "\u{1F43E}" },
  { n: "Cougars", e: "\u{1F43E}" },
  { n: "Bobcats", e: "\u{1F406}" },
  { n: "Broncos", e: "\u{1F434}" },
  { n: "Jaguars", e: "\u{1F406}" },
  { n: "Hawks", e: "\u{1F985}" },
  { n: "Terriers", e: "\u{1F43E}" },
  { n: "Spartans", e: "\u{1F6E1}\uFE0F" },
  { n: "Titans", e: "\u{1F6E1}\uFE0F" },
  { n: "Knights", e: "\u2694\uFE0F" },
  { n: "Crimson", e: "\u{1F534}" },
  { n: "Blue Devils", e: "\u{1F608}" },
  { n: "Red Hawks", e: "\u{1F985}" },
  { n: "Bluejays", e: "\u{1F426}" },
  { n: "Grizzlies", e: "\u{1F43B}" },
  { n: "Timberwolves", e: "\u{1F43A}" },
  { n: "Skyhawks", e: "\u{1F985}" },
  { n: "Storm", e: "\u{1F329}\uFE0F" },
  { n: "Marauders", e: "\u2694\uFE0F" },
  { n: "Lancers", e: "\u{1F3F9}" },
  { n: "Dukes", e: "\u{1F451}" },
  { n: "Scarlets", e: "\u{1F534}" },
  { n: "Sabers", e: "\u2694\uFE0F" },
  { n: "Sentinels", e: "\u{1F6E1}\uFE0F" },
  { n: "Explorers", e: "\u{1F9ED}" },
  { n: "Foxes", e: "\u{1F98A}" },
  { n: "Mavericks", e: "\u{1F920}" },
  { n: "Buccaneers", e: "\u2693" },
  { n: "Pioneers", e: "\u{1F9ED}" },
  { n: "Ironbacks", e: "\u{1F43E}" },
  { n: "Vikings", e: "\u{1F6E1}\uFE0F" },
  { n: "Ravens", e: "\u{1F426}\u200D\u2B1B" },
  { n: "Coyotes", e: "\u{1F43A}" },
  { n: "Thunderbirds", e: "\u{1F985}" },
  { n: "Rangers", e: "\u{1F920}" },
  { n: "Colonels", e: "\u{1F396}\uFE0F" },
  { n: "Wildhawks", e: "\u{1F985}" },
  { n: "Ironhawks", e: "\u{1F985}" },
  { n: "Silverbacks", e: "\u{1F98D}" },
  { n: "Rhinos", e: "\u{1F98F}" },
  { n: "Elk", e: "\u{1FACE}" },
  { n: "Diamondbacks", e: "\u{1F40D}" },
  { n: "Wranglers", e: "\u{1F920}" },
  { n: "Highlanders", e: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}" },
  { n: "Comets", e: "\u2604\uFE0F" },
  { n: "Vipers", e: "\u{1F40D}" },
  { n: "Aviators", e: "\u2708\uFE0F" },
  { n: "Ridgebacks", e: "\u{1F415}" }
];
NICKS_REGIONAL = {
  Southeast: [
    { n: "Hurricanes", e: "\u{1F300}" },
    { n: "Seahawks", e: "\u{1F985}" },
    { n: "Pirates", e: "\u{1F3F4}\u200D\u2620\uFE0F" },
    { n: "Paladins", e: "\u{1F6E1}\uFE0F" },
    { n: "Phoenix", e: "\u{1F525}" },
    { n: "Moccasins", e: "\u{1F40D}" },
    { n: "Snapjaws", e: "\u{1F422}" },
    { n: "Frostpack", e: "\u{1F43A}" },
    { n: "Highlanders", e: "\u26F0\uFE0F" },
    { n: "Flames", e: "\u{1F525}" }
  ],
  DeepSouth: [
    { n: "Warhawks", e: "\u2708\uFE0F" },
    { n: "Trojans", e: "\u{1F6E1}\uFE0F" },
    { n: "Swamp Kings", e: "\u{1F40A}" },
    { n: "Pelicans", e: "\u{1F426}" },
    { n: "Southerners", e: "\u{1F3BA}" },
    { n: "Tornadoes", e: "\u{1F32A}\uFE0F" },
    { n: "Cottonmouths", e: "\u{1F40D}" },
    { n: "Delta Kings", e: "\u{1F451}" },
    { n: "Marsh Hawks", e: "\u{1F985}" },
    { n: "Cypress Cats", e: "\u{1F408}" }
  ],
  MidSouth: [
    { n: "Colonels", e: "\u{1F396}\uFE0F" },
    { n: "Bluegrass", e: "\u{1F3C7}" },
    { n: "Ridgerunners", e: "\u26F0\uFE0F" },
    { n: "Statesmen", e: "\u{1F3DB}\uFE0F" },
    { n: "Blazers", e: "\u{1F525}" },
    { n: "Red Wolves", e: "\u{1F43A}" },
    { n: "Thoroughbreds", e: "\u{1F40E}" }
  ],
  MidAtlantic: [
    { n: "Mountaineers", e: "\u26F0\uFE0F" },
    { n: "Colonials", e: "\u{1F3DB}\uFE0F" },
    { n: "Quakers", e: "\u262E\uFE0F" },
    { n: "Huskies", e: "\u{1F43A}" },
    { n: "Mounties", e: "\u{1F434}" },
    { n: "Bald Eagles", e: "\u{1F985}" },
    { n: "Dutchmen", e: "\u{1F337}" },
    { n: "Diplomats", e: "\u{1F91D}" },
    { n: "Presidents", e: "\u{1F3DB}\uFE0F" }
  ],
  Northeast: [
    { n: "Minutemen", e: "\u{1F3AF}" },
    { n: "Patriots", e: "\u{1F396}\uFE0F" },
    { n: "Catamounts", e: "\u{1F406}" },
    { n: "Black Bears", e: "\u{1F43B}" },
    { n: "Great Danes", e: "\u{1F415}" },
    { n: "Red Dragons", e: "\u{1F409}" },
    { n: "Lakers", e: "\u{1F30A}" },
    { n: "Continentals", e: "\u{1F396}\uFE0F" },
    { n: "Bombers", e: "\u{1F4A3}" },
    { n: "Statesmen", e: "\u{1F3DB}\uFE0F" },
    { n: "Mariners", e: "\u2693" }
  ],
  GreatLakes: [
    { n: "Rockets", e: "\u{1F680}" },
    { n: "Flashes", e: "\u26A1" },
    { n: "Steelhawks", e: "\u{1F985}" },
    { n: "Polar Bears", e: "\u2744\uFE0F" },
    { n: "Muskies", e: "\u{1F41F}" },
    { n: "Ironclads", e: "\u{1F6E1}\uFE0F" },
    { n: "Vulcans", e: "\u{1F528}" },
    { n: "Comets", e: "\u2604\uFE0F" },
    { n: "Freighters", e: "\u{1F6A2}" }
  ],
  Midwest: [
    { n: "Redbirds", e: "\u{1F426}" },
    { n: "Leathernecks", e: "\u{1F396}\uFE0F" },
    { n: "Mules", e: "\u{1F434}" },
    { n: "Prairie Fire", e: "\u{1F525}" },
    { n: "Fighting Scots", e: "\u2694\uFE0F" },
    { n: "Cornhawks", e: "\u{1F985}" },
    { n: "Plowmen", e: "\u{1F33E}" },
    { n: "Rivermen", e: "\u{1F6F6}" },
    { n: "Grangers", e: "\u{1F33E}" },
    { n: "Cyclers", e: "\u{1F32A}\uFE0F" }
  ],
  UpperMidwest: [
    { n: "Bison", e: "\u{1F9AC}" },
    { n: "Jackrabbits", e: "\u{1F407}" },
    { n: "Coyotes", e: "\u{1F43A}" },
    { n: "Fighting Hawks", e: "\u{1F985}" },
    { n: "Dragons", e: "\u{1F409}" },
    { n: "Beavers", e: "\u{1F9AB}" },
    { n: "Pointers", e: "\u{1F415}" },
    { n: "Blue & Gold", e: "\u{1F49B}" },
    { n: "Yellowjackets", e: "\u{1F41D}" },
    { n: "Norse", e: "\u2694\uFE0F" },
    { n: "Vikings", e: "\u2694\uFE0F" },
    { n: "Loons", e: "\u{1F426}" }
  ],
  Plains: [
    { n: "Plainsmen", e: "\u{1F33E}" },
    { n: "Threshers", e: "\u{1F33E}" },
    { n: "Antelopes", e: "\u{1F98C}" },
    { n: "Prairie Wolves", e: "\u{1F43A}" },
    { n: "Sodbusters", e: "\u{1F33E}" },
    { n: "Broncbusters", e: "\u{1F920}" },
    { n: "Twisters", e: "\u{1F32A}\uFE0F" },
    { n: "Windmills", e: "\u{1F3D4}\uFE0F" },
    { n: "Homesteaders", e: "\u{1F3E1}" },
    { n: "Dust Devils", e: "\u{1F32A}\uFE0F" }
  ],
  MountainWest: [
    { n: "Miners", e: "\u26CF\uFE0F" },
    { n: "Prospectors", e: "\u26CF\uFE0F" },
    { n: "Cowboys", e: "\u{1F920}" },
    { n: "Thunderbirds", e: "\u26C8\uFE0F" },
    { n: "Mountain Lions", e: "\u{1F981}" },
    { n: "Orediggers", e: "\u26CF\uFE0F" },
    { n: "Trappers", e: "\u{1FAA4}" },
    { n: "Rustlers", e: "\u{1F920}" }
  ],
  Southwest: [
    { n: "Roughnecks", e: "\u26CF\uFE0F" },
    { n: "Wranglers", e: "\u{1F920}" },
    { n: "Rattlers", e: "\u{1F40D}" },
    { n: "Roadrunners", e: "\u{1F426}" },
    { n: "Buffaloes", e: "\u{1F9AC}" },
    { n: "Javelinas", e: "\u{1F417}" },
    { n: "Lumberjacks", e: "\u{1FA93}" },
    { n: "Vaqueros", e: "\u{1F920}" },
    { n: "Oilers", e: "\u26FD" },
    { n: "Drovers", e: "\u{1F920}" }
  ],
  Hawaii: [
    { n: "Islanders", e: "\u{1F30A}" },
    { n: "Volcanoes", e: "\u{1F30B}" },
    { n: "Rainbows", e: "\u{1F308}" },
    { n: "Surfriders", e: "\u{1F3C4}" },
    { n: "Paniolos", e: "\u{1F920}" },
    { n: "Tradewinds", e: "\u{1F4A8}" },
    { n: "Voyagers", e: "\u{1F9ED}" },
    { n: "Reef Sharks", e: "\u{1F988}" }
  ],
  Alaska: [
    { n: "Frostbears", e: "\u{1F43B}\u200D\u2744\uFE0F" },
    { n: "Seawolves", e: "\u{1F43A}" },
    { n: "Malamutes", e: "\u{1F415}" },
    { n: "Sourdoughs", e: "\u26CF\uFE0F" },
    { n: "Glaciers", e: "\u{1F9CA}" },
    { n: "Icebreakers", e: "\u{1F6A2}" },
    { n: "Timberwolves", e: "\u{1F43A}" },
    { n: "Prospectors", e: "\u26CF\uFE0F" }
  ],
  PacificNW: [
    { n: "Loggers", e: "\u{1FA93}" },
    { n: "Pilots", e: "\u2708\uFE0F" },
    { n: "Boxers", e: "\u{1F415}" },
    { n: "Tidewater", e: "\u{1F30A}" },
    { n: "Evergreens", e: "\u{1F332}" },
    { n: "Orcas", e: "\u{1F433}" },
    { n: "Rainmakers", e: "\u{1F327}\uFE0F" },
    { n: "Cascades", e: "\u26F0\uFE0F" },
    { n: "Lumberjacks", e: "\u{1FA93}" },
    { n: "Vikings", e: "\u2694\uFE0F" }
  ],
  California: [
    { n: "Matadors", e: "\u{1F402}" },
    { n: "Gauchos", e: "\u{1F920}" },
    { n: "Sea Lions", e: "\u{1F9AD}" },
    { n: "Otters", e: "\u{1F9A6}" },
    { n: "Dons", e: "\u{1F3A9}" },
    { n: "Redwoods", e: "\u{1F332}" },
    { n: "Toreros", e: "\u{1F402}" },
    { n: "Leopards", e: "\u{1F406}" },
    { n: "Waves", e: "\u{1F30A}" },
    { n: "Tritons", e: "\u{1F531}" },
    { n: "Condors", e: "\u{1F985}" },
    { n: "Surf", e: "\u{1F3C4}" }
  ]
};
NICKS_TECH = [
  { n: "Engineers", e: "\u2699\uFE0F" },
  { n: "Techsters", e: "\u{1F527}" },
  { n: "Dynamos", e: "\u26A1" },
  { n: "Ironmen", e: "\u{1F529}" },
  { n: "Rockets", e: "\u{1F680}" },
  { n: "Miners", e: "\u26CF\uFE0F" },
  { n: "Beavers", e: "\u{1F9AB}" },
  { n: "Steamfitters", e: "\u{1F528}" },
  { n: "Voltage", e: "\u26A1" },
  { n: "Foundrymen", e: "\u{1F525}" },
  { n: "Machinists", e: "\u{1F6E0}\uFE0F" },
  { n: "Circuits", e: "\u{1F50C}" },
  { n: "Prospectors", e: "\u26CF\uFE0F" },
  { n: "Blastmen", e: "\u{1F4A5}" },
  { n: "Reactors", e: "\u2622\uFE0F" }
];
NICKS_RELIGIOUS = [
  { n: "Saints", e: "\u{1F607}" },
  { n: "Fighting Saints", e: "\u{1F607}" },
  { n: "Crusaders", e: "\u271D\uFE0F" },
  { n: "Friars", e: "\u271D\uFE0F" },
  { n: "Monks", e: "\u271D\uFE0F" },
  { n: "Bishops", e: "\u271D\uFE0F" },
  { n: "Deacons", e: "\u271D\uFE0F" },
  { n: "Royals", e: "\u{1F451}" },
  { n: "Green Knights", e: "\u{1F6E1}\uFE0F" },
  { n: "Purple Knights", e: "\u{1F6E1}\uFE0F" },
  { n: "Cardinals", e: "\u{1F534}" },
  { n: "Pilgrims", e: "\u{1F6B6}" },
  { n: "Shepherds", e: "\u{1F411}" },
  { n: "Gospels", e: "\u{1F4D6}" },
  { n: "Templars", e: "\u2694\uFE0F" },
  { n: "Chargers of Faith", e: "\u271D\uFE0F" },
  { n: "Wardens", e: "\u{1F5DD}\uFE0F" },
  { n: "Abbots", e: "\u271D\uFE0F" }
];
NICKS_QUIRKY = [
  { n: "Thunderducks", e: "\u{1F986}" },
  { n: "Fighting Marmots", e: "\u{1F9A1}" },
  { n: "Nightjars", e: "\u{1F426}" },
  { n: "Ironhogs", e: "\u{1F417}" },
  { n: "Screaming Weasels", e: "\u{1F43E}" },
  { n: "Turnips", e: "\u{1FADB}" },
  { n: "Fighting Bees", e: "\u{1F41D}" },
  { n: "Bog Hens", e: "\u{1F414}" },
  { n: "Gravediggers", e: "\u26CF\uFE0F" },
  { n: "Prospectors", e: "\u26CF\uFE0F" },
  { n: "Cartographers", e: "\u{1F5FA}\uFE0F" },
  { n: "Fighting Squirrels", e: "\u{1F43F}\uFE0F" },
  { n: "Kangaroos", e: "\u{1F998}" },
  { n: "Whirlwinds", e: "\u{1F32A}\uFE0F" },
  { n: "Battling Beavers", e: "\u{1F9AB}" },
  { n: "Marmots", e: "\u{1F439}" },
  { n: "Lamplighters", e: "\u{1F3EE}" },
  { n: "Fighting Okra", e: "\u{1F33F}" },
  { n: "Steamrollers", e: "\u{1F6A7}" },
  { n: "Purple Herons", e: "\u{1FABF}" },
  { n: "Woolly Rams", e: "\u{1F411}" },
  { n: "Thundering Moose", e: "\u{1FACE}" },
  { n: "Fightin' Pelicans", e: "\u{1F9A9}" },
  { n: "Corn Stalkers", e: "\u{1F33D}" }
];
NICK_AGGIES = { n: "Aggies", e: "\u{1F33E}" };
COLOR_PAIRS = [
  ["#8B0000", "#C8A84B"],
  ["#003087", "#C8A84B"],
  ["#003087", "#A8C1E0"],
  ["#006400", "#C8A84B"],
  ["#006400", "#FFFFFF"],
  ["#4B0082", "#C8A84B"],
  ["#5C068C", "#E0D0FF"],
  ["#990000", "#000000"],
  ["#990000", "#FFFFFF"],
  ["#8B4513", "#C8A84B"],
  ["#004225", "#C8A84B"],
  ["#0047AB", "#FF8C00"],
  ["#003087", "#FF4500"],
  ["#800020", "#C8A84B"],
  ["#800020", "#FFFFFF"],
  ["#1C39BB", "#FFFFFF"],
  ["#FF6600", "#000000"],
  ["#FF6600", "#003087"],
  ["#191970", "#C8A84B"],
  ["#000000", "#C8A84B"],
  ["#000000", "#CC0000"],
  ["#9B2335", "#808080"],
  ["#9B2335", "#FFFFFF"],
  ["#C41E3A", "#000000"],
  ["#2E8B57", "#FFFFFF"],
  ["#556B2F", "#C8A84B"],
  ["#4682B4", "#FFFFFF"],
  ["#DC143C", "#003087"],
  ["#008080", "#C8A84B"],
  ["#6B3A2A", "#F0C020"],
  ["#1B4F72", "#F39C12"],
  ["#145A32", "#F1C40F"],
  ["#6C0BA9", "#F1C40F"],
  ["#0D3349", "#E8A020"],
  ["#A0001C", "#1C39BB"],
  ["#2C3E50", "#E8A020"],
  ["#5D0E1F", "#D9C089"],
  ["#0B2545", "#8DA9C4"],
  ["#3D2B56", "#EFD9A0"],
  ["#7A1F2B", "#C0C0C0"],
  ["#12403C", "#EAD196"],
  ["#22336C", "#F2B705"],
  ["#4A0E0E", "#E8C547"],
  ["#0F5257", "#F2E9DC"],
  ["#5B2333", "#EAD7A0"],
  ["#1E2A4A", "#C99B3F"],
  ["#3B0A45", "#D4AF37"],
  ["#0A3D2A", "#F4A100"],
  ["#6E1423", "#0B1F3A"],
  ["#274060", "#E6B800"],
  ["#402218", "#D8B15C"],
  ["#5A175D", "#F0E68C"],
  ["#0C2340", "#E03A3E"],
  ["#7B3F00", "#FFD27F"],
  ["#123456", "#F5A623"],
  ["#611C35", "#BFA06A"]
];
// Real-city names take only the safe suffixes (cg = geographic, cd =
// denomination, sat = token-city, pc/sn = person/saint). The university forms
// (uOf/st/su/am/tech/poly) ride the fictional landmark tokens only, so a real
// "<City> State/University/Tech" can't be coined.
NAME_PATTERNS = {
  power: [["uOf", 24], ["st", 22], ["su", 8], ["am", 10], ["tech", 10], ["cg", 10], ["sat", 8], ["poly", 4], ["dir", 4]],
  midMajor: [["dir", 18], ["cg", 20], ["sat", 16], ["st", 12], ["su", 8], ["tech", 8], ["uOf", 6], ["am", 6], ["poly", 6]],
  D2: [["cg", 22], ["sat", 20], ["dir", 12], ["cd", 10], ["pc", 8], ["sn", 8], ["st", 8], ["su", 6], ["tech", 6]],
  D3: [["pc", 22], ["sn", 18], ["cg", 18], ["cd", 12], ["sat", 14], ["dir", 8], ["poly", 4], ["su", 4]]
};
// Weights, not an ordered list — see pickCity. Power programs still land in the
// biggest places available; D2/D3 still skew small-town, but a weighted draw
// means the mid-size and major cities in a region actually get used instead of
// sitting untouched behind 385 small towns. Owner 2026-08-12: "less ST schools
// still keep some for flavor prioritize more fun cities or named regions."
CITY_SIZE_PREF = {
  power: { 3: 6, 2: 3, 1: 1 },
  midMajor: { 2: 5, 3: 4, 1: 2 },
  D2: { 1: 2, 2: 3, 3: 2 },
  D3: { 1: 3, 2: 2, 3: 1 }
};
CAMPUS_SIZE_PREF = { power: [2, 1, 3], midMajor: [2, 1, 3], D2: [1, 2, 3], D3: [1, 2, 3] };
PATTERN_TYPE = {
  uOf: "flagship",
  st: "landGrant",
  su: "stateUniversity",
  tech: "tech",
  am: "landGrant",
  poly: "tech",
  dir: "directional",
  sat: "satellite",
  cu: "cityUniversity",
  cs: "regionalState",
  cc: "privateCollege",
  ct: "tech",
  cd: "denominational",
  cg: "regionalState",
  pc: "liberalArts",
  sn: "religious"
};
PRIVATE_TYPES = /* @__PURE__ */ new Set(["privateCollege", "denominational", "liberalArts", "religious"]);
REGION_CENTROIDS = {};
for (const [region, cities] of Object.entries(REGION_CITIES)) {
  const lat = cities.reduce((s, c) => s + c.lat, 0) / cities.length;
  const lng = cities.reduce((s, c) => s + c.lng, 0) / cities.length;
  REGION_CENTROIDS[region] = { lat, lng };
}
cityKey = (city) => `${city.c}|${city.s}`;
REAL_SCHOOL_STEMS = /* @__PURE__ */ new Set([
  "Shippensburg",
  "Slippery Rock",
  "Bloomsburg",
  "Kutztown",
  "Millersville",
  "Clarion",
  "Edinboro",
  "Lock Haven",
  "Mansfield",
  "Cullowhee",
  "Elon",
  "Glenville",
  "Statesboro",
  "Valdosta",
  "Nacogdoches",
  "Stephenville",
  "Kingsville",
  "Commerce",
  "Weatherford",
  "Tahlequah",
  "Durant",
  "Alva",
  "Ada",
  "Chadron",
  "Kearney",
  "Peru",
  "Wayne",
  "Emporia",
  "Hays",
  "Pittsburg",
  "Warrensburg",
  "Maryville",
  "Kirksville",
  "Cape Girardeau",
  "Canyon",
  "Cheney",
  "Ellensburg",
  "Monmouth",
  "Ashland",
  "Findlay",
  "Tiffin",
  "Bluffton",
  "Hillsdale",
  "Alma",
  "Adrian",
  "Hiram",
  "Wooster",
  "Grinnell",
  "Wartburg",
  "Luther",
  "Carleton",
  "Gustavus",
  "Ripon",
  "Beloit",
  "Lawrence",
  "Kenyon",
  "Oberlin",
  "Denison",
  "Wabash",
  "DePauw",
  "Earlham",
  "Hanover",
  "Marshall",
  "Rollins",
  "Stetson",
  "Mercer",
  "Furman",
  "Wofford",
  "Samford",
  "Radford",
  "Longwood",
  "Gardner",
  "Newberry",
  "Guilford",
  "Wingate",
  "Pfeiffer",
  "Berry",
  // ── Famous-program backstop (added 2026-08-15) ─────────────────────────────
  // The token pool is now all fictional landmarks, but the CITY-bearing patterns
  // ("<City> State/University/Tech") still draw from real gazetteer cities, so a
  // real program could still be coined ("Boise State"). Reject the recognizable
  // ones by stem: every state name (covers "<State> State/University/A&M/Tech")
  // plus the best-known college cities/programs.
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
  "New Hampshire", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
  "Wisconsin", "Wyoming",
  "Boise", "Fresno", "Sacramento", "San Diego", "San Jose", "San Marcos", "Fullerton",
  "Northridge", "Long Beach", "Auburn", "Clemson", "Boston", "Miami", "Syracuse",
  "Villanova", "Georgetown", "Gonzaga", "Marquette", "Creighton", "Butler", "Xavier",
  "Dayton", "Toledo", "Akron", "Kent", "Buffalo", "Temple", "Rutgers", "Purdue",
  "Wichita", "Tulsa", "Tulane", "Memphis", "Houston", "Baylor", "Notre Dame", "Duke",
  "Vanderbilt", "Stanford", "Princeton", "Harvard", "Yale", "Columbia", "Cornell",
  "Fordham", "Providence", "Bradley", "Drake", "Valparaiso", "Belmont", "Liberty",
  "Wake Forest", "Citadel", "Richmond", "Bucknell", "Lehigh", "Lafayette", "Colgate",
  "Canisius", "Niagara", "Iona", "Manhattan", "Quinnipiac", "Marist", "Siena", "Hofstra",
  "Wagner", "Rider", "Duquesne", "Drexel", "Towson", "Hampton", "Norfolk", "Old Dominion",
  "Coastal Carolina", "Campbell", "Davidson", "Charleston", "Gonzaga", "Pepperdine",
  "Santa Clara", "Loyola", "Bethune", "Tuskegee", "Grambling", "Jackson", "Hampton"
]);
ANCHOR_RANK = {
  flagship: 0,
  landGrant: 1,
  stateUniversity: 2,
  cityUniversity: 3,
  tech: 4,
  directional: 5,
  regionalState: 6,
  satellite: 7,
  liberalArts: 8,
  religious: 8,
  privateCollege: 8,
  denominational: 8
};
REGION_NEIGHBORS = {
  Southeast: ["DeepSouth", "MidSouth", "MidAtlantic"],
  DeepSouth: ["Southeast", "MidSouth", "Southwest"],
  MidSouth: ["Southeast", "DeepSouth", "MidAtlantic", "GreatLakes", "Midwest"],
  MidAtlantic: ["Northeast", "Southeast", "MidSouth", "GreatLakes"],
  Northeast: ["MidAtlantic", "GreatLakes"],
  GreatLakes: ["Northeast", "MidAtlantic", "MidSouth", "Midwest", "UpperMidwest"],
  Midwest: ["GreatLakes", "MidSouth", "UpperMidwest", "Plains", "Southwest"],
  UpperMidwest: ["GreatLakes", "Midwest", "Plains"],
  Plains: ["Midwest", "UpperMidwest", "MountainWest", "Southwest"],
  MountainWest: ["Plains", "Southwest", "PacificNW", "California"],
  Southwest: ["DeepSouth", "Midwest", "Plains", "MountainWest", "California"],
  PacificNW: ["MountainWest", "California"],
  California: ["PacificNW", "MountainWest", "Southwest"],
  // The outposts never span — that ocean is the whole point.
  Hawaii: [],
  Alaska: []
};
REGION_SPREAD = 0.34;
CONTINENTAL_STATES = "AL AZ AR CA CO CT DE FL GA ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
TOKEN_STATES = {};
for (const toks of Object.values(STATE_TOKENS))
  for (const tk of toks) TOKEN_STATES[tk.t] = tk.states;
WORLDGEN_INFO = {
  REGION_CITIES,
  NICK_GLOBAL_CAP,
  LOC_JITTER_DEG,
  TOKEN_STATES,
  CONF_REGIONS: Object.fromEntries([...D1_CONFS, ...D2_CONFS, ...D3_CONFS].map((c) => [c.id, c.region]))
};
SCHOOL_DATA = generateSchools();
ALL_CONF_LIST = [...D1_CONFS, ...D2_CONFS, ...D3_CONFS];
CONFERENCES = Object.fromEntries(
  ALL_CONF_LIST.map((c) => [c.id, { name: c.name, short: c.short, division: c.division, conferenceClass: c.conferenceClass || null }])
);
NONCONF_GAME_DAYS = [5, 6, 7, 8];
CONF_GAME_DAYS = [9, 10, 11, 13, 14, 15, 16, 17, 18];

export { CONFERENCES, SCHOOL_DATA, WORLDGEN_INFO, STAR_CALIBER, applyIdentityToSchool, applyTeamStars, availableStates, buildDepthChart, buildRoleSortedDepthOrder, assembleWorldSources, cityInState, coinStarPlayer, coinTeamIdentity, compileLeague, defaultGameplan, generateAICoach, generateExhibitionTeam, generatePlayerProgram, generateRecruitPool, generateSchedule, generateWorld, hashStr, repairRecruitLocations, rosterHintsFromBooks };
