// _worldgen_offenders.mjs — scratch diagnostic for the polish pass: names the
// schools behind worldgen_check's aggregate failure counts (dup names/abbrs,
// no-gazetteer-city, same-city dups, state-named-outside-state) over N worlds.
import { WORLDGEN_INFO } from '../js/engine/world.js';

const N = 5;
const GAZ = {};
for (const cities of Object.values(WORLDGEN_INFO.REGION_CITIES))
  for (const c of cities) GAZ[`${c.c}|${c.s}`] = c;
const TS = WORLDGEN_INFO.TOKEN_STATES;

for (let w = 0; w < N; w++) {
  const mod = await import(`../js/engine/world.js?roll=${w}`);
  const world = mod.generateWorld();
  const schools = world.schools;
  const byName = {}, byAbbr = {}, cityNames = {};
  const noCity = [], stateMis = [];

  for (const s of schools) {
    (byName[s.name] = byName[s.name] || []).push(s);
    (byAbbr[s.abbr] = byAbbr[s.abbr] || []).push(s);
    if (s.city && s.state) {
      if (!GAZ[`${s.city}|${s.state}`]) noCity.push(`${s.name} — ${s.city}, ${s.state} [${s.division}/${s.conf}]`);
    } else noCity.push(`${s.name} — MISSING city/state [${s.division}/${s.conf}]`);
    {
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
      if (tok && TS[tok] && !TS[tok].includes(s.state)) stateMis.push(`${s.name} — campus ${s.city}, ${s.state}; token "${tok}" wants ${TS[tok]}`);
    }
    const m = s.name.match(/^(.+?) (University|State|College|Tech|Wesleyan|Baptist|Lutheran|Methodist|Christian)$/);
    const nameCity = m && GAZ[`${m[1]}|${s.state}`] ? m[1] + '|' + s.state
      : (s.name.includes('-') ? s.name.split('-')[1] + '|' + s.state : null);
    if (nameCity) (cityNames[nameCity] = cityNames[nameCity] || []).push(s.name);
  }

  console.log(`\n=== world ${w} ===`);
  for (const [n, list] of Object.entries(byName)) if (list.length > 1) console.log(`  DUP NAME  ${n} ×${list.length}: ${list.map(s => s.conf).join(', ')}`);
  for (const [a, list] of Object.entries(byAbbr)) if (list.length > 1) console.log(`  DUP ABBR  ${a}: ${list.map(s => `${s.name} [${s.division}]`).join(' | ')}`);
  for (const l of noCity) console.log(`  NO CITY   ${l}`);
  for (const [ck, names] of Object.entries(cityNames)) if (names.length > 1) console.log(`  CITY DUP  ${ck}: ${names.join(' | ')}`);
  for (const l of stateMis) console.log(`  STATE MIS ${l}`);
}
