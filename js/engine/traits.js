// ─────────────────────────────────────────────────────────────────────────────
// PLAYER IDENTITY — traits, frames, size-fit (Pass 4.5, stages 1–3).
// Spec: Ref/IDENTITY_DESIGN.md (owner-ratified 2026-08-08).
//
// The triangle: BODY (frame; job size windows) · TRAITS (how he plays) ·
// ATTRIBUTES (how good he is — untouched). Trait power is FIT + SITUATIONAL
// only: zero flat stat boosts, ever. Each play trait keys exactly ONE existing
// mechanism with a tiny per-level effect (I–III); bridges touch only
// SLOT_ELIGIBILITY-style fit math + ARCHETYPE_DISTANCE for a named job family
// (and widen the size window — they bend both fit axes).
//
// Kill-switches (house style, engine-only, default OFF = system live):
//   globalThis.__noTraits   — all trait effects (fit waivers + play-trait +
//                             flaw sim terms) read as absent. Generation and
//                             UI display are NOT gated — the A/B measures
//                             on-field effect, not cosmetics.
//   globalThis.__noSizeFit  — the size-fit multiplier reads 1.0 everywhere.
//
// New generations only: players spawned before this pass simply have no
// p.traits / p.frameRolled fields. Every reader here null-guards; old saves
// load untouched (no SAVE_VERSION bump, no retro-roll — owner call §8).
// ─────────────────────────────────────────────────────────────────────────────

// ── Schema on the player object ──────────────────────────────────────────────
// p.traits = {
//   bridge: 'spaceBacker' | null,          // rare, scheme-defining
//   play:  [{ k:'sticky', lv:1, xp:0 }],   // 1–3 at generation, hard cap 4
//   flaws: [{ k:'grabby', lv:1, xp:0 }],   // independent of quality (§8)
//   earned: false                          // one earnable play trait per career
// }
// Arrays/objects only — never a Set/Map (saveDietReplacer would eat it).

// ── BRIDGE catalog (§4a) ─────────────────────────────────────────────────────
// mesh: SLOT_ELIGIBLE_POS keys this bridge waives (picker lists him, resolver
//       accepts him, fit discount reads 1.0). jobs: slot LABELS whose size
//       window he satisfies at full rate. roles: archetype-role family whose
//       ARCHETYPE_DISTANCE reads 0. buckets: position buckets where
//       applyOutOfPos charges nothing (full-rate, no fit penalty).
const BRIDGE_CATALOG = {
  spaceBacker: { name: "Space Backer", pos: ["OLB", "LB"], mesh: ["SPACE"],
    jobs: ["ROVER", "WAR", "DB", "NB"], roles: ["S-Hybrid", "S-Ball", "OLB-Cover", "LB-Cover", "LB-Sideline"],
    buckets: ["S"], desc: "Space jobs at full rate — the Parsons/tweener trait." },
  slotStar: { name: "Slot Star", pos: ["S", "CB"], mesh: ["NB"],
    jobs: ["NB", "SL"], roles: ["CB-Nickel"], buckets: ["CB"],
    desc: "The NB slot at corner rate (2010 Woodson)." },
  boxGeneral: { name: "Box General", pos: ["S"], mesh: ["STACKER"],
    jobs: ["SS", "STK", "WILL", "SAM"], roles: ["LB-Cover", "LB-Hybrid", "OLB-Cover"],
    buckets: ["LB", "OLB"], desc: "Walked-down jobs: 46 SS, 4-4 run duties (Dawkins)." },
  edgeBender: { name: "Edge Bender", pos: ["DE", "OLB"], mesh: ["OVERHANG"],
    jobs: ["JACK", "EDGE", "JOKER", "CHAR", "SPUR", "BANDIT"],
    roles: ["OLB-Rush", "OLB-Blitz", "DE-Speed"], buckets: ["OLB", "DE"],
    desc: "Stand-up rush jobs, both directions." },
  twoGapper: { name: "Two-Gapper", pos: ["DT", "DE"], mesh: [],
    jobs: ["NT", "DT"], roles: ["DT-NT", "DT-Balanced", "DE-Base"], buckets: ["DT"],
    desc: "NT / 4i jobs despite a penetrator profile." },
  poleRunner: { name: "Pole Runner", pos: ["LB"], mesh: [],
    jobs: ["MIKE", "ILB"], roles: ["LB-Cover"], buckets: [],
    desc: "The deep-middle carry job (the Tampa 2 pole)." },
  // Offense mirrors
  moveTE: { name: "Move TE", pos: ["TE"], mesh: [], jobs: ["SL"], roles: ["TE-Move", "TE-Receiving"],
    buckets: ["WR", "SLOT"], desc: "Flexes to the slot at receiver rate." },
  backfieldWeapon: { name: "Backfield Weapon", pos: ["RB"], mesh: [], jobs: [],
    roles: ["RB-Scat", "RB-Elusive"], buckets: ["WR", "SLOT"], desc: "Splits wide at receiver rate." },
  hBack: { name: "H-Back", pos: ["RB", "TE"], mesh: [], jobs: ["FB", "U"], roles: ["TE-Blocking"],
    buckets: ["FB", "TE", "RB"], desc: "The FB/TE bridge body." },
  swingTackle: { name: "Swing Tackle", pos: ["OL"], mesh: [], jobs: [], roles: [],
    buckets: ["OL"], desc: "All five spots, no drop-off." },
  wildcatEngine: { name: "Wildcat Engine", pos: ["RB"], mesh: [], jobs: ["WC"], roles: [],
    buckets: ["QB", "WILDCAT"], desc: "Takes the snap; the package is his." }
};

// ── PLAY-trait catalog v1 + v1.5 (§4b, §4e) ─────────────────────────────────
// hook: the ONE existing mechanism (documentation + probe anchor). Effect
// sizes live at the hook site via T.lv()/T.mult() — tiny, capped at level III.
// Conditioned / Big Stage / Durable: ruled OUT (owner, 2026-08-08).
const PLAY_CATALOG = {
  // DEFENSE — pursuit & tackling
  wrapTackler:   { name: "Wrap Tackler",      pos: ["LB", "OLB", "S", "CB", "DE", "DT"], hook: "breaksTackle chance" },
  openField:     { name: "Open-Field Tackler", pos: ["S", "CB", "LB", "OLB"], hook: "geoYAC pMake" },
  bigHitter:     { name: "Big Hitter",        pos: ["S", "LB", "OLB"], hook: "runOutcome ffChance (hit power)" },
  stripArtist:   { name: "Strip Artist",      pos: ["DE", "OLB", "LB", "CB", "S"], hook: "strip-style ffChance + strip sack" },
  motor:         { name: "Motor",             pos: ["DE", "DT", "OLB"], hook: "fatigueMultiplier onset (rush persistence)" },
  trigger:       { name: "Trigger",           pos: ["LB", "S"], hook: "run2geo second-level fill react" },
  // Rush
  bend:          { name: "Bend",              pos: ["DE", "OLB"], hook: "blockRep speedPath" },
  powerMove:     { name: "Power Move",        pos: ["DE", "DT"], hook: "blockRep powerPath" },
  batRadar:      { name: "Bat Radar",         pos: ["DT", "DE"], hook: "BAT_* batted-pass chance" },
  greenDogT:     { name: "Green Dog",         pos: ["LB", "OLB"], hook: "man-gate blitz convert rate" },
  gapShooter:    { name: "Gap Shooter",       pos: ["LB", "OLB"], hook: "run-blitz penetrator react" },
  gamesRunner:   { name: "Games Runner",      pos: ["LB", "OLB"], hook: "cross-dog pickP (Pass 4 hook rule)" },
  // Coverage
  sticky:        { name: "Sticky",            pos: ["CB", "S"], hook: "sepgeo man react/keep" },
  zoneEyes:      { name: "Zone Eyes",         pos: ["LB", "S", "CB", "OLB"], hook: "assignCoverage bust reduction" },
  pressJam:      { name: "Press Jam",         pos: ["CB"], hook: "sepgeo jam term" },
  ballHawk:      { name: "Ball Hawk",         pos: ["S", "CB", "LB"], hook: "tipped-ball INT pick weight" },
  highPoint:     { name: "High Point",        pos: ["CB", "S"], hook: "SIZE_MISMATCH contested term (def)" },
  spyEyes:       { name: "Spy Eyes",          pos: ["LB", "OLB"], hook: "spyQB scramble containment" },
  filmJunkie:    { name: "Film Junkie",       pos: ["S", "LB", "CB"], hook: "paBite discipline / disguise read" },
  disguiseArtist:{ name: "Disguise Artist",   pos: ["S", "CB"], hook: "pDisguise craft (seller side)" },
  patternMatcher:{ name: "Pattern Matcher",   pos: ["LB", "S", "CB"], hook: "awrSqueeze zone-void" },
  robber:        { name: "Robber",            pos: ["S"], hook: "robStrength undercut" },
  screenSniffer: { name: "Screen Sniffer",    pos: ["DT", "DE", "LB"], hook: "screen sniffChance" },
  edgeSetter:    { name: "Edge Setter",       pos: ["DE", "OLB"], hook: "edgeTec contain vs jets/outside" },
  optionSound:   { name: "Option Sound",      pos: ["DE", "OLB", "LB"], hook: "resolveOptionPlay readWinP (def side)" },
  // PASS 5 (Hook Rule, named at plan-of-record — Ref/PASS5_OFFENSE_PLAN.md)
  rpoSound:      { name: "RPO Sound",         pos: ["LB", "OLB", "S"], hook: "rpoConflictRead biteP discipline + readP resistance (def side)" },
  angles:        { name: "Angles",            pos: ["LB", "S", "CB"], hook: "geoYAC pursuit convergence" },
  // Special teams
  gunner:        { name: "Gunner",            pos: ["S", "CB", "LB", "WR"], hook: "st_coverage coverageStrength" },
  returnVision:  { name: "Return Vision",     pos: ["WR", "RB", "CB", "S"], hook: "returner rating / breakChance" },
  iceVeins:      { name: "Ice Veins",         pos: ["K"], hook: "attemptFG late/pressure context" },
  coffinCorner:  { name: "Coffin Corner",     pos: ["P"], hook: "punt placement inside-20" },
  hangTime:      { name: "Hang Time",         pos: ["P"], hook: "return coverage / fair catches" },
  handsTeam:     { name: "Hands Team",        pos: ["TE", "LB"], hook: "onsideResult recovery" },
  // OFFENSE — QB room (v1.5)
  blitzBeater:   { name: "Blitz Beater",      pos: ["QB"], hook: "hotChance" },
  eyeManipulator:{ name: "Eye Manipulator",   pos: ["QB"], hook: "robber lookoff term" },
  fieldGeneral:  { name: "Field General",     pos: ["QB"], hook: "seeIt/pAud kill-call machinery" },
  rhythmPasser:  { name: "Rhythm Passer",     pos: ["QB"], hook: "inRhythm first-read bonus" },
  slidesEarly:   { name: "Slides Early",      pos: ["QB"], hook: "qbContactResult (two-sided)" },
  pocketPresence:{ name: "Pocket Presence",   pos: ["QB"], hook: "covSack escape / sack-avoid" },
  scrambleDrill: { name: "Scramble Drill",    pos: ["QB"], hook: "off-schedule throw comp" },
  conflictReader:{ name: "Conflict Reader",   pos: ["QB"], hook: "rpoConflictRead readP (off side) + choice-route misP" },
  // RB
  passProBack:   { name: "Pass-Pro Back",     pos: ["RB"], hook: "blitzer pickupProb" },
  chipper:       { name: "Chipper",           pos: ["RB", "TE"], hook: "chip bump machinery" },
  patientRunner: { name: "Patient Runner",    pos: ["RB"], hook: "run2geo lane-commit entry" },
  oneCut:        { name: "One-Cut",           pos: ["RB"], hook: "runFit read/bend cut quality" },
  homeRunThreat: { name: "Home-Run Threat",   pos: ["RB", "WR"], hook: "breakaway breakP" },
  secureBag:     { name: "Secure Bag",        pos: ["RB", "WR", "QB"], hook: "carry-fumble mult" },
  yacMonster:    { name: "YAC Monster",       pos: ["WR", "RB", "TE"], hook: "geoYAC wiggle/openTackle" },
  // WR/TE
  routeTech:     { name: "Route Technician",  pos: ["WR", "TE"], hook: "sepgeo receiver duel" },
  contestedCatch:{ name: "Contested Catch",   pos: ["WR", "TE"], hook: "contested catchProb term" },
  chainMover:    { name: "Chain Mover",       pos: ["WR", "TE"], hook: "catchResolution on 3rd down (situational)" },
  releaseArtist: { name: "Release Artist",    pos: ["WR"], hook: "sepgeo release vs jam" },
  doubleMove:    { name: "Double-Move Artist", pos: ["WR"], hook: "sepgeo dblLag sell" },
  motionWeapon:  { name: "Motion Weapon",     pos: ["WR", "RB"], hook: "motionGain" },
  deepTracker:   { name: "Deep Tracker",      pos: ["WR"], hook: "vdeep over-the-shoulder" },
  blockingWR:    { name: "Blocking Receiver", pos: ["WR", "TE"], hook: "stalk-block blockScore" },
  paSeller:      { name: "Play-Action Seller", pos: ["RB", "QB"], hook: "PA credibility" },
  leverageReader:{ name: "Leverage Reader",   pos: ["WR", "TE"], hook: "choice-route convP + misP (schemeFor)" },
  gadgetAce:     { name: "Gadget Ace",        pos: ["RB", "WR"], hook: "gadget resolver exchange/sell craft" },
  leadBlocker:   { name: "Lead Blocker",      pos: ["RB", "TE"], hook: "FB-lead run blockRep" },
  // OL
  lineGeneral:   { name: "Line General",      pos: ["OL"], hook: "centerAwr half-slide + stunt counter (center)" },
  anchor:        { name: "Anchor",            pos: ["OL"], hook: "blockRep powerPath resistance" },
  mirror:        { name: "Mirror",            pos: ["OL"], hook: "blockRep speedPath ride" },
  puller:        { name: "Puller",            pos: ["OL"], hook: "pull mobility bonus" },
  peopleMover:   { name: "People Mover",      pos: ["OL"], hook: "run-branch blockRep drive" }
};

// ── FLAWS (§4b, §4e) — independent of quality (Borderlands rule §8) ─────────
const FLAW_CATALOG = {
  grabby:      { name: "Grabby",        pos: ["CB", "S"], hook: "PENALTY_CATALOG Pass Interference weight" },
  jumpy:       { name: "Jumpy",         pos: ["DE", "DT", "OLB", "OL"], hook: "offside/false-start weight" },
  gambler:     { name: "Gambler",       pos: ["CB", "S"], hook: "INTs up AND burned-deep up (two-sided)" },
  headhunter:  { name: "Headhunter",    pos: ["S", "LB"], hook: "splash hits + personal fouls" },
  freelancer:  { name: "Freelancer",    pos: ["LB", "S", "CB", "OLB"], hook: "busts up + splash up (two-sided)" },
  drops:       { name: "Drops",         pos: ["WR", "TE", "RB"], hook: "dropProb" },
  fumbler:     { name: "Fumbler",       pos: ["RB", "WR", "QB"], hook: "carry-fumble mult" },
  happyFeet:   { name: "Happy Feet",    pos: ["QB"], hook: "hurried read pool / HURRY_PENALTY" },
  slowStarter: { name: "Slow Starter",  pos: ["QB", "RB", "WR", "K"], hook: "form dip, front half of games" },
  telegraph:   { name: "Telegraph",     pos: ["QB"], hook: "robber/forced-ball INT term" },
  heroBall:    { name: "Hero Ball",     pos: ["QB"], hook: "covSack branch weights (two-sided)" },
  dancer:      { name: "Dancer",        pos: ["RB"], hook: "One-Cut reversed: bounces everything (two-sided)" },
  bodyCatcher: { name: "Body Catcher",  pos: ["WR", "TE"], hook: "contested term reversed" },
  bitesHard:   { name: "Bites Hard",    pos: ["LB", "S"], hook: "paBite discipline reversed + dbl victim (two-sided)" },
  laneDrifter: { name: "Lane Drifter",  pos: ["DT", "DE"], hook: "gap-integrity / stunt-align" },
  holdingHabit:{ name: "Holding Habit", pos: ["OL"], hook: "Offensive Holding weight" },
  shanks:      { name: "Shanks",        pos: ["K", "P"], hook: "pressure variance on the kick roll" },
  muffs:       { name: "Muffs",         pos: ["WR", "RB", "CB", "S"], hook: "muffP machinery (returns/pitches)" }
};

// ── Job size windows (stage 1, §5) — weight in lbs by slot LABEL ────────────
// Windows are generous; the fit multiplier is 1.0 inside, gentle falloff
// outside, hard-capped. Jobs not listed fall back to the role window (derived
// from SIZE_BANDS.byArchetype) or no window at all.
const JOB_SIZE_WINDOWS = {
  NB: [178, 208], SL: [170, 200], DB: [190, 218],
  ROVER: [215, 235], WAR: [205, 232], SPUR: [205, 232], BANDIT: [212, 242],
  JOKER: [222, 250], JACK: [238, 268], CHAR: [232, 262], EDGE: [242, 275],
  STK: [220, 250], ILB: [226, 256], MIKE: [230, 260], WILL: [218, 248], SAM: [228, 258],
  NT: [305, 350], FB: [228, 262], WC: [190, 228], A: [180, 212], W: [198, 238], U: [235, 268]
};
const SIZE_FIT_FALLOFF = 0.004;  // 0.4% per lb outside the window
const SIZE_FIT_CAP = 0.10;       // hard cap ~8–10% (spec) — floor 0.90

// Level odds at generation: I common, II uncommon, III rare (§4c).
const LV_ODDS = [0.78, 0.18, 0.04];
// Growth thresholds: trigger-events needed to reach lv II / lv III.
const XP_THRESHOLDS = [0, 14, 36];
const BRIDGE_BASE_ODDS = 0.10;       // ~10% of players (§4)
const BRIDGE_TWEENER_ODDS = 0.18;    // tweener frames raise the odds
const FLAW_ODDS = [0.55, 0.35, 0.10]; // 0 / 1 / 2 flaws — independent of stars

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function _live() { return !globalThis.__noTraits; }

// Play-trait level for a player (0 = absent or killed).
function traitLv(p, key) {
  var _a;
  if (!_live()) return 0;
  const list = (_a = p == null ? void 0 : p.traits) == null ? void 0 : _a.play;
  if (!list) return 0;
  for (const t of list) if (t.k === key) return t.lv || 1;
  return 0;
}
// Flaw level (0 = absent or killed).
function flawLv(p, key) {
  var _a;
  if (!_live()) return 0;
  const list = (_a = p == null ? void 0 : p.traits) == null ? void 0 : _a.flaws;
  if (!list) return 0;
  for (const t of list) if (t.k === key) return t.lv || 1;
  return 0;
}
// Uniform tiny-effect helper: 1 + per·lv (pass negative per for reductions).
function traitMult(p, key, per) {
  const lv = traitLv(p, key);
  return lv ? 1 + per * lv : 1;
}
function flawMult(p, key, per) {
  const lv = flawLv(p, key);
  return lv ? 1 + per * lv : 1;
}
function bridgeOf(p) {
  var _a;
  if (!_live()) return null;
  const k = (_a = p == null ? void 0 : p.traits) == null ? void 0 : _a.bridge;
  return k && BRIDGE_CATALOG[k] ? BRIDGE_CATALOG[k] : null;
}
// Does a bridge waive the mesh eligibility gate at this mesh key?
function bridgeWaivesMesh(p, meshKey) {
  const b = bridgeOf(p);
  return !!(b && meshKey && b.mesh.includes(meshKey));
}
// Does a bridge cover this slot (by label / mesh / native pos bucket)?
function bridgeCoversSlot(p, slot) {
  const b = bridgeOf(p);
  if (!b || !slot) return false;
  if (slot.mesh && b.mesh.includes(slot.mesh)) return true;
  if (slot.label && b.jobs.includes(slot.label)) return true;
  return false;
}
// Does a bridge serve this archetype role at zero distance?
function bridgeWaivesRole(p, role) {
  const b = bridgeOf(p);
  return !!(b && role && b.roles.includes(role));
}
// Does a bridge waive the out-of-position attribute-keep for this bucket?
function bridgeWaivesBucket(p, bucket) {
  const b = bridgeOf(p);
  return !!(b && bucket && b.buckets.includes(bucket));
}

// ── Size fit (stage 1) ──────────────────────────────────────────────────────
function sizeFitFromWindow(weight, win) {
  if (!win || weight == null) return 1;
  const [lo, hi] = win;
  const out = weight < lo ? lo - weight : weight > hi ? weight - hi : 0;
  if (!out) return 1;
  return 1 - Math.min(SIZE_FIT_CAP, out * SIZE_FIT_FALLOFF);
}
// Fit vs a JOB (slot object with label/mesh). Bridges that cover the slot
// stretch the window around the player's own frame → 1.0.
function sizeFitForSlot(p, slot) {
  if (globalThis.__noSizeFit || !p || !slot) return 1;
  if (bridgeCoversSlot(p, slot)) return 1;
  const win = slot.label && JOB_SIZE_WINDOWS[slot.label];
  return sizeFitFromWindow(p.weight, win);
}
// Fit vs an archetype ROLE — window derived from SIZE_BANDS.byArchetype,
// widened ±10 lb (windows generous by design). SIZE_BANDS is injected by the
// caller (formations.js) to avoid a constants import cycle here.
function sizeFitForRole(p, role, SIZE_BANDS) {
  var _a;
  if (globalThis.__noSizeFit || !p || !role) return 1;
  if (bridgeWaivesRole(p, role)) return 1;
  const band = SIZE_BANDS == null ? void 0 : (_a = SIZE_BANDS.byArchetype) == null ? void 0 : _a[role];
  if (!band) return 1;
  return sizeFitFromWindow(p.weight, [band[2] - 10, band[3] + 10]);
}

// ── Generation (stage 2) ────────────────────────────────────────────────────
// Tweener test: outside the native position band by ≥8 lb in either direction.
function isTweenerFrame(position, weight, SIZE_BANDS) {
  var _a;
  const band = (_a = SIZE_BANDS == null ? void 0 : SIZE_BANDS.byPos) == null ? void 0 : _a[posBandKey(position)];
  if (!band || weight == null) return false;
  return weight <= band[2] - 8 || weight >= band[3] + 8;
}
function posBandKey(position) {
  if (position === "DE" || position === "DT") return "DL";
  if (position === "CB" || position === "S") return "DB";
  if (position === "OLB") return "LB";
  return position;
}
function _rollLv() {
  const r = Math.random();
  return r < LV_ODDS[0] ? 1 : r < LV_ODDS[0] + LV_ODDS[1] ? 2 : 3;
}
function _pickFrom(pool, n) {
  const out = [];
  const bag = pool.slice();
  while (out.length < n && bag.length) {
    out.push(bag.splice(Math.floor(Math.random() * bag.length), 1)[0]);
  }
  return out;
}
// Roll the full trait block for a new player. Quality-independent by
// construction (Borderlands rule): nothing here reads attributes or stars.
function rollTraits(position, weight, SIZE_BANDS) {
  const tweener = isTweenerFrame(position, weight, SIZE_BANDS);
  // Bridge: rare, tweeners more likely
  let bridge = null;
  if (Math.random() < (tweener ? BRIDGE_TWEENER_ODDS : BRIDGE_BASE_ODDS)) {
    const eligible = Object.keys(BRIDGE_CATALOG).filter((k) => BRIDGE_CATALOG[k].pos.includes(position));
    if (eligible.length) bridge = eligible[Math.floor(Math.random() * eligible.length)];
  }
  // Play traits: 1–3 at generation
  const playPool = Object.keys(PLAY_CATALOG).filter((k) => PLAY_CATALOG[k].pos.includes(position));
  const nPlay = Math.min(playPool.length, 1 + (Math.random() < 0.55 ? 1 : 0) + (Math.random() < 0.2 ? 1 : 0));
  const play = _pickFrom(playPool, nPlay).map((k) => ({ k, lv: _rollLv(), xp: 0 }));
  // Flaws: independent axis, tiny effects, elites get no protection
  const flawPool = Object.keys(FLAW_CATALOG).filter((k) => FLAW_CATALOG[k].pos.includes(position));
  const fr = Math.random();
  const nFlaw = Math.min(flawPool.length, fr < FLAW_ODDS[0] ? 0 : fr < FLAW_ODDS[0] + FLAW_ODDS[1] ? 1 : 2);
  const flaws = _pickFrom(flawPool, nFlaw).map((k) => ({ k, lv: _rollLv(), xp: 0 }));
  return { bridge, play, flaws, earned: false };
}

// ── Intensity growth (stage 3, §4c) ─────────────────────────────────────────
// One counter per trait instance; credit when the trait's own trigger fires.
// Level-ups set t.pend for the weekly report to surface (then clear).
function creditTrait(p, key, n = 1) {
  var _a;
  const list = (_a = p == null ? void 0 : p.traits) == null ? void 0 : _a.play;
  if (!list) return false;
  for (const t of list) {
    if (t.k !== key || t.lv >= 3) continue;
    t.xp = (t.xp || 0) + n;
    if (t.xp >= XP_THRESHOLDS[t.lv]) {
      t.lv += 1;
      t.xp = 0;
      t.pend = true;
      return true;
    }
  }
  return false;
}
// Flaw growth (unaddressed) / shrink (coaching) — the redemption arc.
function growFlaw(p, key, n = 1) {
  var _a;
  const list = (_a = p == null ? void 0 : p.traits) == null ? void 0 : _a.flaws;
  if (!list) return false;
  for (const t of list) {
    if (t.k !== key || t.lv >= 3) continue;
    t.xp = (t.xp || 0) + n;
    if (t.xp >= XP_THRESHOLDS[t.lv]) { t.lv += 1; t.xp = 0; t.pendUp = true; return true; }
  }
  return false;
}
function shrinkFlaw(p, key) {
  var _a;
  const list = (_a = p == null ? void 0 : p.traits) == null ? void 0 : _a.flaws;
  if (!list) return null;
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    if (t.k !== key) continue;
    if (t.lv > 1) { t.lv -= 1; t.xp = 0; t.pendDown = true; return "down"; }
    list.splice(i, 1);
    return "gone";
  }
  return null;
}

// Post-game growth pass: credit trait xp from the per-player game stat line
// (events the sim already logs — low bookkeeping, works for cheap-simmed AI
// games too). Returns the list of trait keys that leveled up.
function growthFromGameStats(p, gs) {
  var _a;
  if (!((_a = p == null ? void 0 : p.traits) == null ? void 0 : _a.play) || !gs) return [];
  const ups = [];
  const credit = (key, n) => { if (n > 0 && creditTrait(p, key, n)) ups.push(key); };
  credit("stripArtist", gs.forcedFumbles || 0);
  credit("bigHitter", gs.forcedFumbles || 0);
  credit("ballHawk", gs.ints || 0);
  credit("sticky", gs.passBreakups || 0);
  credit("highPoint", gs.passBreakups || 0);
  credit("pressJam", gs.passBreakups || 0);
  credit("wrapTackler", Math.floor((gs.tackles || 0) / 6));
  credit("openField", Math.floor((gs.tackles || 0) / 6));
  credit("angles", Math.floor((gs.tackles || 0) / 6));
  credit("zoneEyes", Math.floor((gs.tackles || 0) / 8));
  credit("patternMatcher", Math.floor((gs.tackles || 0) / 8));
  credit("trigger", gs.tacklesForLoss || 0);
  credit("gapShooter", gs.tacklesForLoss || 0);
  credit("edgeSetter", gs.tacklesForLoss || 0);
  credit("screenSniffer", gs.tacklesForLoss || 0);
  credit("bend", (gs.sacks || 0) + Math.floor((gs.pressures || 0) / 4));
  credit("powerMove", (gs.sacks || 0) + Math.floor((gs.pressures || 0) / 4));
  credit("motor", gs.sacks || 0);
  credit("gamesRunner", gs.sacks || 0);
  credit("greenDogT", gs.sacks || 0);
  credit("batRadar", gs.batted || 0);
  credit("robber", gs.ints || 0);
  credit("routeTech", Math.floor((gs.recComp || 0) / 4));
  credit("releaseArtist", Math.floor((gs.recComp || 0) / 4));
  credit("doubleMove", Math.floor((gs.recComp || 0) / 5));
  credit("contestedCatch", gs.contestedRec || 0);
  credit("chainMover", Math.floor((gs.recComp || 0) / 4));
  credit("yacMonster", Math.floor((gs.yardsAfterContact || 0) / 30));
  credit("deepTracker", Math.floor((gs.recYds || 0) / 60));
  credit("homeRunThreat", Math.floor(((gs.rushYds || 0) + (gs.recYds || 0)) / 80));
  credit("oneCut", Math.floor((gs.rushYds || 0) / 60));
  credit("patientRunner", Math.floor((gs.rushYds || 0) / 60));
  credit("secureBag", Math.floor((gs.rushAtt || 0) / 15));
  credit("blitzBeater", Math.floor((gs.passYds || 0) / 150));
  credit("rhythmPasser", Math.floor((gs.passYds || 0) / 150));
  credit("fieldGeneral", gs.passTD || 0);
  credit("pocketPresence", Math.floor((gs.passYds || 0) / 150));
  credit("scrambleDrill", Math.floor((gs.rushYds || 0) / 25));
  // PASS 5 counters (accumPlayerStats → these keys)
  credit("conflictReader", gs.rpoReadWins || 0);
  credit("rpoSound", gs.rpoDefused || 0);
  credit("leverageReader", gs.choiceConversions || 0);
  credit("gadgetAce", gs.gadgetSnaps || 0);
  credit("iceVeins", gs.fgMade || 0);
  // PASS 6 counters (Hook Rule — fake punt/FG): the upback/runner banks a
  // converted fake; the coverage man who smelled it banks the stuff.
  credit("gadgetAce", (gs.stFakeConvs || 0) * 2);
  credit("filmJunkie", gs.stFakeSniffs || 0);
  return ups;
}

export {
  BRIDGE_CATALOG, PLAY_CATALOG, FLAW_CATALOG, JOB_SIZE_WINDOWS,
  traitLv, flawLv, traitMult, flawMult,
  bridgeOf, bridgeWaivesMesh, bridgeCoversSlot, bridgeWaivesRole, bridgeWaivesBucket,
  sizeFitFromWindow, sizeFitForSlot, sizeFitForRole,
  isTweenerFrame, rollTraits,
  creditTrait, growFlaw, shrinkFlaw, growthFromGameStats
};
