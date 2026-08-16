// help_rule_probe.mjs — PLAYTEST 2026-08-12 item 33: THE HELP SCREEN DOES NOT
// HAND OUT THE SIM'S ARITHMETIC.
//
// CLAUDE.md help rule 3: "Vague about the numbers, on purpose. Never print a
// coefficient, a weight table, or a threshold." That rule had been written down
// for months and breached in nineteen places on one screen, because nothing
// checked it. Written prose is exactly the kind of thing that rots quietly —
// somebody documents a tuning change in the tooltip, it reads helpfully, and the
// game is one tooltip closer to being solvable from the help screen.
//
// WHAT THIS DOES AND DOES NOT FLAG
// The distinction is not "contains a number". It is WHOSE number it is:
//
//   ALLOWED — the coach's own controls and what he set them to. A slider that
//   reads 60 may say 60. A run/pass split he dialled to 55/45 may say 55/45. A
//   readout derived from his dials ("~14% of short throws") is describing his
//   own call sheet back to him, which is the whole point of a scouting card.
//
//   FORBIDDEN — what the sim does with those numbers. "+50% forced fumbles",
//   "~0.6 fewer yds/carry", "Spread is nearly as good (85%)", "calling one
//   concept on 30%+ of its snaps gets it jumped". Those are coefficients,
//   weight tables and thresholds: the model's insides, printed.
//
// So the scan reads only STATIC help copy — the literal text of tip bodies and
// the manual's TIPS table — and blanks every `${…}` expression first, because an
// interpolated value is by definition a live readout rather than a documented
// constant.
//
// Run: node tools/help_rule_probe.mjs        (add --list to see every hit)
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};
const LIST = process.argv.includes('--list');

// ── collect the files that carry player-facing help copy ─────────────────────
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.js')) out.push(p);
  }
  return out;
}
const FILES = walk('js/ui');

// ── pull out the static help copy ────────────────────────────────────────────
// Two surfaces: inline tip bodies rendered into markup, and the manual's TIPS /
// SIT_TIPS / *_DESCS tables. Everything inside `${…}` is blanked — a live value
// is the coach's own setting being read back, not a documented constant.
// Decode the unicode escapes the bundler leaves behind FIRST. It writes em
// dashes and minus signs as \uXXXX, so a genuine minus-25-percent breach carries
// no minus SIGN for the scan to find, while an innocent em-dash reads as four
// digits followed by a word. Unescaping fixes both directions of that mistake.
const unesc = (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
const blank = (s) => unesc(s).replace(/\$\{[^}]*\}/g, ' ');
const TIP_MARKUP = /class="[^"]*\b(?:gp-tip|tip-info|tip-body|dc-tip-body|context-help)\b[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
const TIP_TABLE = /^\s*[A-Za-z_][\w]*:\s*"((?:[^"\\]|\\.)*)"/gm;

function copyFrom(file) {
  const src = readFileSync(file, 'utf8');
  const out = [];
  for (const m of src.matchAll(TIP_MARKUP)) out.push([file, blank(m[1])]);
  // Tables only in the modules whose whole job is help prose.
  if (/manual\/|tips\.js$/.test(file) || /SIT_TIPS|DEF_FRONT_DESCS/.test(src)) {
    for (const m of src.matchAll(TIP_TABLE)) out.push([file, blank(m[1])]);
  }
  return out;
}
const COPY = FILES.flatMap(copyFrom);
check('found help copy to scan', COPY.length > 60, `${COPY.length} passages across ${FILES.length} files`);

// ── the three things rule 3 names ────────────────────────────────────────────
const RULES = [
  {
    id: 'coefficient',
    what: 'a printed effect size',
    // "+25%", "−12% penalties", "~0.6 fewer yds/carry", "up to +50%"
    re: /(?:[+\u2212-]\s?\d+(?:\.\d+)?\s?%)|(?:~\s?\d+(?:\.\d+)?\s+(?:fewer|more|less|extra)\b)|(?:\b\d+(?:\.\d+)?\s?%\s+(?:fewer|more|less|better|worse|here)\b)|(?:\bby\s+\d+(?:\.\d+)?\s?%)/i,
  },
  {
    id: 'weight-table',
    what: 'a printed weight table',
    // three or more parenthesised percentages in one passage — the RPO tooltip
    // that listed every formation's dial multiplier is the archetype.
    re: /(?:\(\s*\d+\s?%\s*\)[\s\S]{0,160}){3,}/,
  },
  {
    id: 'threshold',
    what: 'a printed threshold',
    // "30%+ of its snaps", "above 70%", "at least 25% of"
    re: /(?:\b\d+\s?%\s?\+)|(?:\b(?:above|below|over|under|at least|more than)\s+\d+\s?%)/i,
  },
];

const hits = [];
for (const [file, text] of COPY) {
  for (const rule of RULES) {
    const m = text.match(rule.re);
    if (m) hits.push({ file, rule, snippet: text.slice(Math.max(0, m.index - 40), m.index + 70).replace(/\s+/g, ' ').trim() });
  }
}

for (const rule of RULES) {
  const mine = hits.filter((h) => h.rule.id === rule.id);
  check(`no help text prints ${rule.what}`, mine.length === 0,
    mine.length ? `${mine.length} hit${mine.length !== 1 ? 's' : ''}` : 'clean');
  if (mine.length && !LIST) {
    for (const h of mine.slice(0, 6)) console.log(`        ${h.file}: …${h.snippet}…`);
    if (mine.length > 6) console.log(`        (+${mine.length - 6} more — rerun with --list)`);
  }
}
if (LIST) for (const h of hits) console.log(`  [${h.rule.id}] ${h.file}\n      …${h.snippet}…`);

// ── the scan has to be able to SEE a breach ──────────────────────────────────
// A regex suite that matches nothing is indistinguishable from a clean codebase,
// and this one guards prose that nobody re-reads. So feed it the exact strings
// that were live in the game this morning and require every one to trip.
{
  const WERE_LIVE = [
    ['coefficient', 'MAX PROTECT keeps the TE (and backs) in — ~20% fewer sacks, but the same coverage blankets fewer routes'],
    ['coefficient', 'more yards per completion, more interceptions (up to +25%).'],
    ['coefficient', 'STRIP HUNT punches at the ball on every contact — +50% forced fumbles'],
    ['coefficient', "living that close to the edge draws flags (+12% defensive penalties)"],
    ['coefficient', 'Hurry here burns legs (+35%/+20% fatigue)'],
    ['coefficient', '+20 stuffs the run (~0.6 fewer yds/carry) but leaves every receiver more open'],
    ['coefficient', 'SAFE RETURN puts every body in the wall: +15% return yardage'],
    ['coefficient', 'AUTO leans run by 25% here (also covers 4th-and-short goes)'],
    ['weight-table', "Pistol is what the concept was built for (100% of the dial); Spread is nearly as good (85%); Trips telegraphs it (70%); Air Raid is a drop-back system (45%)."],
    ['threshold', 'Calling one concept on 30%+ of its snaps gets it jumped'],
  ];
  const missed = WERE_LIVE.filter(([id, s]) => !RULES.find((r) => r.id === id).re.test(s));
  check('the scan catches every breach that shipped this morning', missed.length === 0,
    missed.length ? missed.map(([id]) => id).join(', ') : `${WERE_LIVE.length}/${WERE_LIVE.length} caught`);

  // …and does NOT catch the coach reading his own dials back.
  const MUST_PASS = [
    'Screens ~14% of short throws — jackpot vs the blitz',
    'RUN 55% · PASS 45%',
    'Designed QB runs on top of your formation’s natural rate.',
    '50 is a balanced call sheet; crank what your roster executes, bench what it can’t (0 = never called)',
    'a real shot at a blocked punt (~1 or 2 a season)',
    'This cell owns every ordinary snap of your first TWO drives',
  ];
  const falsePos = MUST_PASS.filter((s) => RULES.some((r) => r.re.test(s)));
  check('and leaves the coach’s own numbers alone', falsePos.length === 0,
    falsePos.length ? falsePos.map((s) => s.slice(0, 40)).join(' | ') : `${MUST_PASS.length} readouts pass clean`);
}

console.log(`\n${fail === 0 ? 'ALL PASS ✅' : `${fail} FAILURES ❌`}  (${pass} pass, ${fail} fail)`);
process.exit(fail === 0 ? 0 : 1);
