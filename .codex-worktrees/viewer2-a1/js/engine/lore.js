function randInt(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function chance(p) {
  return Math.random() < p;
}
function ledgerFor(prestige, division) {
  const p = prestige || 1;
  const divCap = { D1: 6, D2: 4, D3: 3 }[division] || 3;
  const rel = p / divCap;
  return {
    // National titles: only the genuinely elite have any, and the supply is
    // FIXED BY HISTORY — one champion per year per division, ~130 years of
    // football, so a division's schools can hold ~130 titles TOTAL between
    // them. Blue bloods hoard them (a real sport has ~10 programs owning most
    // of the trophy case); everyone else has none. These odds are tuned so
    // the league-wide count lands near the historical supply.
    titles: rel > 0.88 ? randInt(2, 6) : rel > 0.78 ? randInt(1, 3) : rel > 0.68 ? chance(0.3) ? 1 : 0 : 0,
    // Conference crowns: the everyday hardware.
    confTitles: Math.max(0, Math.round(rel * randInt(4, 14) - randInt(0, 2))),
    // Bowl/playoff appearances scale similarly but wider.
    postseasons: Math.max(0, Math.round(rel * randInt(8, 26))),
    goldenEra: rel > 0.55 || chance(0.35),
    scandal: chance(0.18 + (rel > 0.7 ? 0.12 : 0)),
    // the big win big-cheat correlation
    wilderness: rel < 0.5 || chance(0.3),
    rel
  };
}
function clusterYears(n, lo, hi) {
  if (n <= 0) return [];
  const years = /* @__PURE__ */ new Set();
  let guard = 0;
  while (years.size < n && guard++ < 200) {
    const anchor = randInt(lo, hi);
    const burst = Math.min(n - years.size, randInt(1, 3));
    for (let k = 0; k < burst; k++) {
      const y = anchor + k;
      if (y >= lo && y <= hi) years.add(y);
    }
  }
  return [...years].sort((a, b) => a - b).slice(0, n);
}
function generateProgramLore(school, currentYear = 2026) {
  const founded = school.founded || 1890;
  const sportArrives = randInt(1888, 1902);
  const footballSince = Math.max(sportArrives, founded + randInt(2, 25));
  const lo = footballSince + 5;
  const hi = currentYear - 2;
  if (hi <= lo) return null;
  const L = ledgerFor(school.prestige, school.division);
  const titleYears = clusterYears(L.titles, lo + 10, hi);
  const confYears = clusterYears(L.confTitles, lo, hi);
  let legend = null;
  if (L.goldenEra) {
    const recent = chance(0.18);
    const span = randInt(6, 18);
    const start = recent ? Math.max(lo, hi - span - randInt(0, 2)) : randInt(lo, Math.max(lo, hi - 25));
    legend = {
      name: `${pick(COACH_FIRST)} ${pick(COACH_LAST)}`,
      from: start,
      to: Math.min(start + span, hi),
      note: pick(ERA_FLAVOR.golden),
      wins: Math.round(span * randInt(7, 11)),
      losses: Math.round(span * randInt(1, 4))
    };
  }
  const events = [];
  if (legend) {
    events.push({
      year: legend.from,
      kind: "era",
      text: `${legend.name} arrives. The ${legend.from}\u2013${legend.to} teams ${legend.note}.`
    });
  }
  if (L.scandal) {
    events.push({ year: randInt(lo + 15, hi), kind: "scandal", text: pick(ERA_FLAVOR.scandal) + "." });
  }
  if (L.wilderness) {
    const s = randInt(lo + 10, Math.max(lo + 11, hi - 8));
    events.push({ year: s, kind: "down", text: `The ${String(s).slice(2)}s: ${pick(ERA_FLAVOR.wilderness)}.` });
  }
  for (const y of titleYears) events.push({ year: y, kind: "title", text: "National champions." });
  const seasons = hi - footballSince;
  const winPct = 0.32 + L.rel * 0.34 + (Math.random() * 0.06 - 0.03);
  const games = seasons * randInt(9, 11);
  const allTimeWins = Math.round(games * winPct);
  const allTimeLosses = games - allTimeWins - Math.round(games * 0.015);
  const allTimeTies = Math.round(games * 0.015);
  return {
    footballSince,
    titles: titleYears,
    confTitles: confYears,
    postseasons: L.postseasons,
    legend,
    tradition: pick(TRADITIONS),
    events: events.sort((a, b) => a.year - b.year),
    allTime: { wins: allTimeWins, losses: Math.max(0, allTimeLosses), ties: allTimeTies }
  };
}
function generateRivalries(schools, distanceMiles2) {
  const byId = new Map(schools.map((s) => [s.id, s]));
  const taken = /* @__PURE__ */ new Set();
  const pairs = [];
  const candidateFor = (s) => {
    let best = null, bestScore = Infinity;
    for (const o of schools) {
      if (o.id === s.id || taken.has(o.id)) continue;
      if (o.division !== s.division) continue;
      const d = distanceMiles2(s.lat, s.lng, o.lat, o.lng);
      if (d > 400) continue;
      const score = d * (o.conf === s.conf ? 0.55 : 1);
      if (score < bestScore) {
        bestScore = score;
        best = o;
      }
    }
    return best;
  };
  const order = [...schools].sort(() => Math.random() - 0.5);
  for (const s of order) {
    if (taken.has(s.id)) continue;
    const o = candidateFor(s);
    if (!o) continue;
    taken.add(s.id);
    taken.add(o.id);
    pairs.push([s, o]);
  }
  for (const [a, b] of pairs) {
    const since = randInt(1893, 1955);
    const played = Math.min(2026 - since, randInt(60, 128));
    const aWins = randInt(Math.floor(played * 0.34), Math.ceil(played * 0.62));
    const ties = chance(0.55) ? randInt(1, 5) : 0;
    const bWins = Math.max(0, played - aWins - ties);
    let trophy = null;
    if (chance(0.72)) {
      for (let tt = 0; tt < 8; tt++) {
        const cand = `The ${pick(TROPHY_ADJ)} ${pick(TROPHY_OBJECTS)}`;
        if (!REAL_TROPHY_NAMES.has(cand)) {
          trophy = cand;
          break;
        }
      }
    }
    const holder = chance(0.5) ? a.id : b.id;
    const mk = (me, them, myWins, theirWins) => ({
      schoolId: them.id,
      name: them.name,
      trophy,
      since,
      wins: myWins,
      losses: theirWins,
      ties,
      holderId: holder,
      generated: true
    });
    a.rival = mk(a, b, aWins, bWins);
    b.rival = mk(b, a, bWins, aWins);
  }
  return pairs.length;
}
var COACH_FIRST, COACH_LAST, TROPHY_OBJECTS, TROPHY_ADJ, REAL_TROPHY_NAMES, TRADITIONS, ERA_FLAVOR;

COACH_FIRST = [
  "Bear",
  "Woody",
  "Bud",
  "Ara",
  "Duffy",
  "Dutch",
  "Red",
  "Bo",
  "Chuck",
  "Hank",
  "Wally",
  "Doc",
  "Rip",
  "Buck",
  "Ace",
  "Moose",
  "Gus",
  "Cap",
  "Whitey",
  "Curly",
  "Vern",
  "Dan",
  "Earl",
  "Frank",
  "Lou",
  "Ray",
  "Gil",
  "Marv",
  "Ned",
  "Otto",
  "Barry",
  "Lloyd",
  "Hal",
  "Wendell",
  "Dean",
  "Clint",
  "Marty",
  "Gary",
  "Bo",
  "Rollie",
  "Duffy",
  "Brent",
  "Kyle",
  "Chuck",
  "Sterling",
  "Ryan",
  "Josh",
  "Matt",
  "Cole",
  "Wade",
  "Rex",
  "Norm",
  "Bill",
  "Joe",
  "Phil",
  "Tom",
  "Dick",
  "Darrell",
  "Fisher",
  "Hayden",
  "Grant",
  "Emory",
  "Sonny",
  "Vince",
  "Homer",
  "Wilbur",
  "Cecil",
  "Roy",
  "Floyd",
  "Elmer",
  "Deacon",
  "Boots",
  "Skip",
  "Chip",
  "Tuck",
  "Hoot",
  "Cotton",
  "Pug",
  "Slick",
  "Fritz"
];
COACH_LAST = [
  "Halloran",
  "McKinnon",
  "Prewitt",
  "Vandersloot",
  "Cauley",
  "Brannigan",
  "Stovall",
  "Meecham",
  "Kowalczyk",
  "Barlow",
  "Fitch",
  "Denholm",
  "Rucker",
  "Whitlow",
  "Pearsall",
  "Gantry",
  "Dumas",
  "Ferrell",
  "Hobbs",
  "Yancey",
  "Rademacher",
  "Sizemore",
  "Tolliver",
  "Ashby",
  "Crenshaw",
  "Dupree",
  "Holloway",
  "Kingsley",
  "Marchetti",
  "Ellison",
  "Broadus",
  "Calloway",
  "Renfro",
  "Wetzel",
  "Sturdivant",
  "Beauchamp",
  "Hargrove",
  "Delgado",
  "Ozanne",
  "Kilpatrick",
  "Vroman",
  "Satterlee",
  "Amsden",
  "Threadgill",
  "Boykin",
  "Castellano",
  "Mercer",
  "Winslow",
  "Prendergast",
  "Ackerley",
  "Fontaine",
  "Redmond",
  "Galloway",
  "Huffines",
  "Lipscomb",
  "Deveraux",
  "Aldridge",
  "Cortese",
  "Warrick",
  "Blackwood",
  "Nunley",
  "Ambrose",
  "Steadman",
  "Villareal",
  "Osgood",
  "Truett",
  "Cardwell",
  "Everhart",
  "Mancuso",
  "Lundquist",
  "Pettigrew",
  "Roan",
  "Sackett",
  "Whitfield",
  "Bexley",
  "Chastain"
];
TROPHY_OBJECTS = [
  "Bell",
  "Axe",
  "Jug",
  "Boot",
  "Bucket",
  "Anvil",
  "Barrel",
  "Shovel",
  "Hammer",
  "Lantern",
  "Spike",
  "Keg",
  "Skillet",
  "Plow",
  "Saw",
  "Trophy",
  "Cannon",
  "Pail",
  "Chain",
  "Bit",
  "Cup",
  "Paddle",
  "Ladder",
  "Kettle",
  "Stein",
  "Horseshoe",
  "Lariat",
  "Tankard",
  "Gavel",
  "Wrench",
  "Cleat",
  "Helm",
  "Gauntlet",
  "Chalice",
  "Stovepipe"
];
TROPHY_ADJ = [
  "Copper",
  "Iron",
  "Golden",
  "Brass",
  "Old",
  "Silver",
  "Rusty",
  "Ancient",
  "Wooden",
  "Bronze",
  "Battered",
  "Painted",
  "Sacred",
  "Tarnished",
  "Weathered",
  "Cast-Iron",
  "Pewter",
  "Gilded",
  "Scorched",
  "Dented"
];
REAL_TROPHY_NAMES = /* @__PURE__ */ new Set([
  "The Little Brown Jug",
  "The Old Oaken Bucket",
  "The Iron Skillet",
  "The Bronze Boot",
  "The Golden Boot",
  "The Old Brass Spittoon",
  "The Copper Kettle",
  "The Wagon Wheel",
  "The Golden Hat",
  "The Old Wagon Wheel",
  "The Bell",
  "The Victory Bell",
  "The Golden Axe",
  "The Paul Bunyan Axe",
  "The Territorial Cup",
  "The Floyd of Rosedale",
  "The Sweet Sioux Tomahawk",
  "The Ancient Iron Skillet",
  "The Old Iron Skillet"
]);
TRADITIONS = [
  "the student section counts down the final minute in unison",
  "the team walks through the tailgate lots two hours before kick",
  "a cannon fires after every score",
  "the band plays the alma mater to the losing side, win or lose",
  "seniors ring the victory bell after every home win",
  "the field is stormed only for a top-10 upset \u2014 by written student rule",
  "the crowd stays silent until the first snap",
  "a live mascot circles the field before kickoff",
  "the fourth quarter starts with every fan holding up four fingers",
  "the freshmen paint the rock before the rivalry game",
  "a lone bugler plays taps for departed alumni at halftime",
  "the team touches a stone from the original campus on the way out",
  "sweet potato pie is sold at the north gate \u2014 same family since the fifties",
  "the visiting band is fed at the union the night before",
  "kickoff is delayed until the last cowbell stops"
];
ERA_FLAVOR = {
  golden: [
    "never lost at home",
    "ran the wishbone into the ground",
    "went unbeaten twice",
    "beat every rival four straight years",
    "sent nine men to the pros",
    "won on a field the whole state drove to",
    "scored 40 a game and apologized for none of it",
    "played nobody close",
    "punted eleven times all season"
  ],
  scandal: [
    "a pay-for-play scandal vacated two seasons",
    "the league office took twelve scholarships and the wins with them",
    "a booster slush fund cost the program a bowl ban",
    "a transcript scandal ended a coach and a decade",
    "an ineligible player erased a conference title",
    "the athletic director resigned in the middle of the night"
  ],
  wilderness: [
    "went a full decade without a winning season",
    "burned through five coaches in eight years",
    "nearly dropped the sport entirely",
    "lost thirty straight conference games",
    "played home games to an empty north stand",
    "had a fired coach and an interim in the same October"
  ]
};

export { generateProgramLore, generateRivalries };
