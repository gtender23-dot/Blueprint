// manual_leak_audit.mjs — did a chapter print a number it shouldn't have?
//
// The manual's one hard rule: never a coefficient, a threshold, a rate or a constant name.
// A coach who can read the weights off a reference page can solve the game from it, and a
// solved game is not worth a career. Ordinal and directional claims carry the meaning
// instead — "speed carries most of a corner's coverage, agility next" — and those are the
// claims that survive a tuning pass anyway, which is a second reason to prefer them.
//
// This is a lint, not a judge. It flags every number it finds and sorts them into what is
// almost certainly fine (rules of football: four downs, eleven men, a hundred yards) and
// what wants a human eye. It also greps for identifiers lifted straight out of the source,
// which is the other way a leak happens — "ROLE_WEIGHTS" in a sentence is a leak even
// without a digit in it.
//
// Usage: node tools/manual_leak_audit.mjs
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname }                         from 'path';
import { fileURLToPath }                         from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR  = join(ROOT, 'js/ui/manual');

if (!existsSync(DIR)) { console.log('no js/ui/manual — nothing to audit'); process.exit(0); }

// Numbers that describe the SPORT rather than the simulation. If it would appear in a
// rulebook it can appear in the manual; if it would appear in a spreadsheet it cannot.
const RULES_OF_FOOTBALL = new Set([
  '1', '2', '3', '4', '5', '6',        // downs, points, quarters, small counts
  '10', '11', '15', '16', '20', '25', '30', '40', '50', '60', '100',
  '2026',
]);

// Words that make a nearby number a description of the sport, not of a tuning value.
const SPORT_CONTEXT = /\b(down|downs|yard|yards|quarter|quarters|half|halves|men|man|player|players|point|points|team|teams|week|weeks|season|seasons|year|years|game|games|receiver|receivers|back|backs|lineman|linemen|snap|snaps|minute|minutes|second|seconds|foot|feet|inch|inches|hundred|seed|seeds|round|rounds|conference|division)\b/i;

// Identifiers straight out of the source. Any of these in prose is a leak even with no
// digits attached — it points a reader at the implementation.
const SOURCE_WORDS = /\b(POS_WEIGHTS|ROLE_WEIGHTS|OVR_POS_ADJ|ATTR_FLOORS|CONTESTS|BLENDS|MESH_AUTO_POOL|SLOT_ELIGIBLE_POS|PHASES|RECRUITING_[A-Z_]+|ROSTER_[A-Z_]+|C\.[A-Z_]{3,}|routeDuel|resolveSlots|compositeRating|roleRating|rawComposite|posAdjust|axisLean|repSigmoid|resolveFunnel|commitThreshold|sepgeo|fieldassign|sim\.js|constants\.js|\.js\b)\b/g;

// Hedged numbers are the sneakiest leak: "roughly a quarter of a corner's coverage" is the
// weight with a hat on.
const HEDGED_FRACTION = /\b(roughly|about|around|approximately|nearly|some|close to)\s+(a\s+)?(half|third|quarter|fifth|tenth|\d+\s*(percent|%))/gi;

const stripTags = s => s.replace(/<[^>]+>/g, '');

let files = 0, flagged = 0, ok = 0;
const report = [];

for (const f of readdirSync(DIR)) {
  if (!f.endsWith('.js') || f === 'index.js') continue;
  files++;
  const src = readFileSync(join(DIR, f), 'utf8');

  // Only audit the prose. Comments carry the provenance note and the chapter id/icon are
  // metadata — neither is read by a coach.
  const bodies = [...src.matchAll(/(?:body|blurb|heading|title):\s*`([\s\S]*?)`/g)].map(m => m[1])
    .concat([...src.matchAll(/(?:body|blurb|heading|title):\s*'((?:[^'\\]|\\.)*)'/g)].map(m => m[1]))
    .concat([...src.matchAll(/(?:body|blurb|heading|title):\s*"((?:[^"\\]|\\.)*)"/g)].map(m => m[1]));

  const prose = stripTags(bodies.join('\n'));
  const hits = [];

  for (const m of prose.matchAll(/\b\d+(?:\.\d+)?%?\b/g)) {
    const n = m[0].replace('%', '');
    const around = prose.slice(Math.max(0, m.index - 60), m.index + 60).replace(/\s+/g, ' ');
    const isPercent = m[0].endsWith('%');
    const benign = !isPercent && RULES_OF_FOOTBALL.has(n) && SPORT_CONTEXT.test(around);
    if (benign) { ok++; continue; }
    hits.push({ kind: isPercent ? 'PERCENT' : 'NUMBER', text: m[0], around });
  }
  for (const m of prose.matchAll(SOURCE_WORDS)) {
    hits.push({ kind: 'SOURCE-NAME', text: m[0],
      around: prose.slice(Math.max(0, m.index - 60), m.index + 60).replace(/\s+/g, ' ') });
  }
  for (const m of prose.matchAll(HEDGED_FRACTION)) {
    hits.push({ kind: 'HEDGED', text: m[0],
      around: prose.slice(Math.max(0, m.index - 60), m.index + 60).replace(/\s+/g, ' ') });
  }

  if (hits.length) { flagged += hits.length; report.push({ f, hits }); }
}

console.log(`Manual leak audit — ${files} chapter file(s)\n`);
if (!report.length) {
  console.log(`  clean (${ok} number(s) accepted as rules of the sport)`);
} else {
  for (const { f, hits } of report) {
    console.log(`── ${f}`);
    for (const h of hits) {
      console.log(`   ${h.kind.padEnd(11)} ${JSON.stringify(h.text)}`);
      console.log(`               …${h.around}…`);
    }
    console.log('');
  }
  console.log(`${flagged} to review, ${ok} accepted as rules of the sport.`);
  console.log('A flag is not a verdict — "four downs" is fine, "four times the weight" is not.');
}
process.exit(0);
