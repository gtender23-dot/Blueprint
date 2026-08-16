// worldgen_check.mjs — regression probe for the school generator (world.js).
// Run: node tools/worldgen_check.mjs
// Validates N=25 fresh worlds: uniqueness, geography coherence vs the real-city
// gazetteer, division-appropriate institution mix, prestige pyramid + per-conf
// anchors, nickname constraints, schema completeness, and scheduler-safe sizes.

// NOTE: SCHOOL_DATA rolls ONCE per module load — a static import would make
// all N "worlds" copies of a single roll (defects count N×, distributions are
// single-sample). Cache-busted dynamic imports give truly independent rolls.
import { WORLDGEN_INFO } from '../js/engine/world.js';
import { C } from '../js/constants.js';
import { distanceMiles } from '../js/utils.js';

const N_WORLDS = 25;
let fails = 0, warns = 0;
const ok   = (m) => console.log(`  OK  ${m}`);
const bad  = (m) => { console.log(`  ✗   ${m}`); fails++; };
const warn = (m) => { console.log(`  ⚠   ${m}`); warns++; };

// Gazetteer lookup: "City|ST" → {lat,lng}
const GAZ = {};
for (const cities of Object.values(WORLDGEN_INFO.REGION_CITIES))
  for (const c of cities) GAZ[`${c.c}|${c.s}`] = c;

const sizeRange = (division, cls) =>
  division === 'D1'
    ? (cls === 'power' ? C.D1_POWER_CONF_SIZE : C.D1_MIDMAJOR_CONF_SIZE)
    : division === 'D2' ? C.D2_CONF_SIZE : C.D3_CONF_SIZE;

const agg = {
  totalSchools: 0, dupName: 0, dupAbbr: 0, dupId: 0, numericAbbr: 0,
  badPrestige: 0, badCoord: 0, farFromCity: 0, noCity: 0,
  confNickDup: 0, nickOverCap: 0, cityNameDup: 0, uOfDup: 0,
  missingField: 0, oddConf: 0, sizeOOR: 0, noAnchor: 0, stateMismatch: 0,
  d3Flagship: 0, colorDupInConf: 0, lowStateConf: 0, statesPerConf: [],
  powerSix: [], d3PrivateShare: [], typeCounts: {}, worstCityMiles: 0,
};

const t0 = Date.now();
let lastMod = null;
for (let w = 0; w < N_WORLDS; w++) {
  lastMod = await import(`../js/engine/world.js?roll=${w}`);
  const world = lastMod.generateWorld();
  const schools = world.schools;
  agg.totalSchools += schools.length;

  // The static D1 league is authored with REAL cities (Berkeley, Coral
  // Gables, the Bronx…) that the procedural gazetteer doesn't carry. Anchor
  // them from the authored rows themselves so the geography checks validate
  // static schools against their own authored coordinates instead of
  // flagging all 24 as "unknown city" every world.
  for (const s of schools) {
    if (s.division === 'D1' && s.city && s.state && !GAZ[`${s.city}|${s.state}`]) {
      GAZ[`${s.city}|${s.state}`] = { c: s.city, s: s.state, lat: s.lat, lng: s.lng };
    }
  }

  const names = new Set(), abbrs = new Set(), ids = new Set();
  const nickGlobal = {}, uOfStates = {}, cityNames = {};
  const byConf = {};

  for (const s of schools) {
    if (names.has(s.name)) agg.dupName++; names.add(s.name);
    if (abbrs.has(s.abbr)) agg.dupAbbr++; abbrs.add(s.abbr);
    if (ids.has(s.id)) agg.dupId++; ids.add(s.id);
    if (/\d/.test(s.abbr)) agg.numericAbbr++;
    (byConf[s.conf] = byConf[s.conf] || []).push(s);
    nickGlobal[s.nick] = (nickGlobal[s.nick] || 0) + 1;
    agg.typeCounts[s.type] = (agg.typeCounts[s.type] || 0) + 1;

    // prestige within clamps, baseline set
    if (s.prestige < s.prestigeMin || s.prestige > s.prestigeMax || s.baseline !== s.prestige)
      agg.badPrestige++;

    // continental-US coordinates
    if (!(s.lat > 24 && s.lat < 49.7 && s.lng > -125 && s.lng < -66)) agg.badCoord++;

    // coordinate coherence: school sits at (or jitter-near) its listed city
    if (s.city && s.state) {
      const g = GAZ[`${s.city}|${s.state}`];
      if (!g) agg.noCity++;
      else {
        const d = distanceMiles(s.lat, s.lng, g.lat, g.lng);
        agg.worstCityMiles = Math.max(agg.worstCityMiles, d);
        if (d > 25) agg.farFromCity++;
      }
    } else agg.noCity++;

    // Flagship names never below D1
    if (s.type === 'flagship' && s.division !== 'D1') agg.d3Flagship++;

    // Name <-> campus-state coherence: "University of Georgia" must be in GA,
    // "Southern Colorado" in CO, "Wisconsin-Whitewater" in WI, etc.
    {
      const TS = WORLDGEN_INFO.TOKEN_STATES;
      let tok = null;
      if (s.name.startsWith('University of ')) tok = s.name.slice(14);
      else if (s.name.startsWith('Cal State ') || s.name.startsWith('Cal Poly')) tok = 'Cal';
      else if (s.name.includes('-')) tok = s.name.split('-')[0];
      else {
        const dm = s.name.match(/^(Northern|Southern|Eastern|Western|Central) (.+)$/);
        if (dm && TS[dm[2]]) tok = dm[2];
        else {
          const sm = s.name.match(/^(.+?) (State|Tech|A&M|Poly|University)$/);
          if (sm && TS[sm[1]]) tok = sm[1];
        }
      }
      // Static D1 names are authored, not generated — "Piedmont Tech" in
      // Blacksburg, VA is a deliberate real-world nod, and the token table
      // (Piedmont→GA) only encodes the procedural generator's vocabulary.
      // The coherence rule binds generated names only. And a name that
      // carries its own campus TOWN is coherent by construction —
      // "Cumberland University" in Cumberland, MD is named for its city,
      // even though the token table reads "Cumberland" as the TN region.
      if (tok && TS[tok] && !TS[tok].includes(s.state) && s.division !== 'D1'
          && s.city !== tok) agg.stateMismatch++;
    }
    if (s.name.startsWith('University of ')) {
      const st = s.name.slice(14);
      uOfStates[st] = (uOfStates[st] || 0) + 1;
    }

    // name-bearing city used once ("Duluth State" + "Minnesota-Duluth" forbidden)
    const m = s.name.match(/^(.+?) (University|State|College|Tech|Wesleyan|Baptist|Lutheran|Methodist|Christian)$/);
    const nameCity = m && GAZ[`${m[1]}|${s.state}`] ? m[1] + '|' + s.state
      : (s.name.includes('-') ? s.name.split('-')[1] + '|' + s.state : null);
    if (nameCity) { cityNames[nameCity] = (cityNames[nameCity] || 0) + 1; }

    // schema completeness
    if (!s.city && s.city !== '' || !s.stadium?.name || !(s.stadium?.capacity > 0) ||
        !(s.enrollment > 0) || !(s.founded >= 1780 && s.founded <= 1985) ||
        !s.type || !s.control || !s.nick || !s.logo || !s.colors?.length)
      agg.missingField++;
  }

  for (const [st, n] of Object.entries(uOfStates)) if (n > 1) agg.uOfDup++;
  for (const [ck, n] of Object.entries(cityNames)) if (n > 1) agg.cityNameDup++;
  for (const [nick, n] of Object.entries(nickGlobal))
    if (n > WORLDGEN_INFO.NICK_GLOBAL_CAP + 1) agg.nickOverCap++;

  // per-conference checks
  for (const [confId, confSchools] of Object.entries(byConf)) {
    // State diversity: the mixer guarantees >=3 states where same-division
    // partners exist within travel caps. California/Southwest-anchored
    // conferences are exempt (geography-spread rebuild, Jul 2026): they sit
    // too far from any partner to mix, and single-state leagues are REAL
    // there — the SCIAC is all-CA, the old TIAA all-TX. Border cities in
    // those pools still let them span 2-3 states most worlds.
    const confStates = new Set(confSchools.map(x => x.state).filter(Boolean)).size;
    agg.statesPerConf.push(confStates);
    const anchorRegion = WORLDGEN_INFO.CONF_REGIONS?.[confId];
    const singleStateOK = anchorRegion === 'California' || anchorRegion === 'Southwest';
    if (confStates < 3 && !singleStateOK) agg.lowStateConf++;
    const div = confSchools[0].division;
    const cls = div === 'D1'
      ? (world.conferences[confId].conferenceClass || 'midMajor') : div;
    const [lo, hi] = sizeRange(div, cls);
    if (confSchools.length % 2 !== 0) agg.oddConf++;
    if (confSchools.length < lo || confSchools.length > hi + 1) agg.sizeOOR++;

    const nicks = new Set(), colorKeys = new Set();
    for (const s of confSchools) {
      if (nicks.has(s.nick)) agg.confNickDup++; nicks.add(s.nick);
      const ckey = s.colors[0] + s.colors[1];
      if (colorKeys.has(ckey)) agg.colorDupInConf++; colorKeys.add(ckey);
    }
    const ceiling = cls === 'power' ? 6 : cls === 'midMajor' ? 3 : (C.PRESTIGE_MAX?.[div] || 5);
    if (!confSchools.some(s => s.prestige >= ceiling)) agg.noAnchor++;
  }

  // distribution shape
  const power = schools.filter(s => s.division === 'D1' &&
    world.conferences[s.conf].conferenceClass === 'power');
  agg.powerSix.push(power.filter(s => s.prestige === 6).length / power.length);
  const d3 = schools.filter(s => s.division === 'D3');
  agg.d3PrivateShare.push(d3.filter(s => s.control === 'private').length / d3.length);
}
const elapsed = Date.now() - t0;

console.log(`\n=== worldgen_check — ${N_WORLDS} worlds, ${agg.totalSchools} schools, ${elapsed}ms ===\n`);

// Hard assertions
agg.dupName        ? bad(`duplicate school names: ${agg.dupName}`)              : ok('school names unique');
agg.dupAbbr        ? bad(`duplicate abbrs: ${agg.dupAbbr}`)                     : ok('abbrs unique');
agg.dupId          ? bad(`duplicate ids: ${agg.dupId}`)                         : ok('ids unique');
agg.badPrestige    ? bad(`prestige outside clamp / baseline mismatch: ${agg.badPrestige}`) : ok('prestige within clamps, baseline === prestige');
agg.badCoord       ? bad(`coords outside continental US: ${agg.badCoord}`)      : ok('all coords in continental US');
agg.noCity         ? bad(`schools missing city/state or unknown city: ${agg.noCity}`) : ok('every school anchored to a gazetteer city');
agg.farFromCity    ? bad(`schools >25mi from their city: ${agg.farFromCity}`)   : ok(`schools sit at their real city (worst offset ${agg.worstCityMiles.toFixed(1)} mi)`);
agg.confNickDup    ? bad(`duplicate nicknames within a conference: ${agg.confNickDup}`) : ok('no nickname dupes within any conference');
agg.nickOverCap    ? bad(`nicknames over global cap+1: ${agg.nickOverCap}`)     : ok(`global nickname cap respected (≤${WORLDGEN_INFO.NICK_GLOBAL_CAP + 1})`);
agg.cityNameDup    ? bad(`same city named by 2+ schools: ${agg.cityNameDup}`)   : ok('name-bearing cities single-use');
agg.uOfDup         ? bad(`duplicate "University of X": ${agg.uOfDup}`)          : ok('flagship "University of X" unique per state');
agg.d3Flagship     ? bad(`flagship-type schools below D1: ${agg.d3Flagship}`)   : ok('no flagships below D1');
agg.stateMismatch  ? bad(`state-named schools outside their state: ${agg.stateMismatch}`) : ok('state-named schools campus in their own state');
agg.missingField   ? bad(`schools with missing identity fields: ${agg.missingField}`) : ok('city/type/control/enrollment/founded/stadium present on all');
agg.oddConf        ? bad(`odd-sized conferences: ${agg.oddConf}`)               : ok('all conference sizes even (scheduler-safe)');
agg.sizeOOR        ? bad(`conference sizes out of range: ${agg.sizeOOR}`)       : ok('conference sizes within §B.2 ranges');
agg.noAnchor       ? bad(`conferences without a ceiling-prestige anchor: ${agg.noAnchor}`) : ok('every conference has a prestige-ceiling king');
agg.lowStateConf   ? bad(`conferences spanning <3 states: ${agg.lowStateConf}`) : ok(`every conference spans >=3 states (avg ${(agg.statesPerConf.reduce((a,b)=>a+b,0)/agg.statesPerConf.length).toFixed(2)}/conf)`);
agg.colorDupInConf ? warn(`duplicate color pairs within a conference: ${agg.colorDupInConf}`) : ok('color pairs unique within conferences');
agg.numericAbbr    ? warn(`abbrs with numeric fallback: ${agg.numericAbbr}`)    : ok('no numeric-suffix abbrs needed');

const avgSix = agg.powerSix.reduce((a, b) => a + b, 0) / agg.powerSix.length;
(avgSix > 0.08 && avgSix < 0.32)
  ? ok(`power 6★ share ${(avgSix * 100).toFixed(1)}% (pyramid, target 8–32%)`)
  : bad(`power 6★ share ${(avgSix * 100).toFixed(1)}% outside 8–32%`);
const avgPriv = agg.d3PrivateShare.reduce((a, b) => a + b, 0) / agg.d3PrivateShare.length;
(avgPriv >= 0.40)
  ? ok(`D3 private-college share ${(avgPriv * 100).toFixed(1)}% (target ≥40%)`)
  : bad(`D3 private share ${(avgPriv * 100).toFixed(1)}% below 40%`);
(elapsed / N_WORLDS < 1500)
  ? ok(`${N_WORLDS} worlds in ${elapsed}ms (${Math.round(elapsed / N_WORLDS)}ms/world incl. rosters — no pool exhaustion)`)
  : warn(`generation slow: ${Math.round(elapsed / N_WORLDS)}ms/world`);

// Institution-type mix (informational)
console.log('\nInstitution mix across all worlds:');
const tc = Object.entries(agg.typeCounts).sort((a, b) => b[1] - a[1]);
for (const [t, n] of tc) console.log(`  ${t.padEnd(16)} ${String(n).padStart(5)}  (${(100 * n / agg.totalSchools).toFixed(1)}%)`);

// Sample world printout — one conf per division class
console.log('\nSample world:');
const sample = lastMod.generateWorld();
const seen = new Set();
for (const s of sample.schools) {
  const conf = sample.conferences[s.conf];
  const tag = conf.conferenceClass || s.division;
  if (seen.has(tag)) continue;
  seen.add(tag);
  console.log(`\n— ${conf.name} (${s.division}${conf.conferenceClass ? '/' + conf.conferenceClass : ''}) —`);
  for (const x of sample.schools.filter(x => x.conf === s.conf)) {
    console.log(`  ${x.prestige}★ ${(x.name + ' ' + x.nick).padEnd(44)} ${(x.city + ', ' + x.state).padEnd(20)} ${x.type.padEnd(15)} ${x.stadium.name} (${x.stadium.capacity.toLocaleString()})`);
  }
}

console.log(`\n${fails === 0 ? 'ALL CHECKS PASSED' : fails + ' FAILURES'}${warns ? ` (${warns} warnings)` : ''}\n`);
process.exit(fails === 0 ? 0 : 1);
