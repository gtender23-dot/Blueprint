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
  wrapTackler:   { name: "Wrap Tackler",      pos: ["LB", "OLB", "S", "CB", "DE", "DT"], hook: "breaksTackle chance",
    desc: "Breaks down and wraps up — ballcarriers don't slip this tackle for extra yards.", grow: "Piling up tackles." },
  openField:     { name: "Open-Field Tackler", pos: ["S", "CB", "LB", "OLB"], hook: "geoYAC pMake",
    desc: "Makes the one-on-one tackle in space, the hardest one there is, so catches and runs die where they're caught.", grow: "Making tackles in the open field." },
  bigHitter:     { name: "Big Hitter",        pos: ["S", "LB", "OLB"], hook: "runOutcome ffChance (hit power)",
    desc: "Arrives with bad intentions — the kind of hit that jars the ball loose and makes receivers hear footsteps.", grow: "Punishing hits that force fumbles." },
  stripArtist:   { name: "Strip Artist",      pos: ["DE", "OLB", "LB", "CB", "S"], hook: "strip-style ffChance + strip sack",
    desc: "Always going for the ball on the tackle — rips and punches it out, including the strip-sack.", grow: "Forcing fumbles." },
  motor:         { name: "Motor",             pos: ["DE", "DT", "OLB"], hook: "fatigueMultiplier onset (rush persistence)",
    desc: "Never quits on a rush. Late in the down and late in the game, he's still coming while others fade.", grow: "Chase-down sacks." },
  trigger:       { name: "Trigger",           pos: ["LB", "S"], hook: "run2geo second-level fill react",
    desc: "Reads run and fires downhill without a false step — in the gap before the back gets there.", grow: "Tackles for loss." },
  // Rush
  bend:          { name: "Bend",              pos: ["DE", "OLB"], hook: "blockRep speedPath",
    desc: "Wins the edge with speed and flexibility, dipping under the tackle's punch to flatten to the quarterback.", grow: "Sacks and pressures." },
  powerMove:     { name: "Power Move",        pos: ["DE", "DT"], hook: "blockRep powerPath",
    desc: "Bull-rushes his man into the pocket, collapsing it from the inside with pure strength.", grow: "Sacks and pressures." },
  batRadar:      { name: "Bat Radar",         pos: ["DT", "DE"], hook: "BAT_* batted-pass chance",
    desc: "Gets his hands up in the throwing lane when he can't get home — knocks passes down at the line.", grow: "Batting passes down." },
  greenDogT:     { name: "Green Dog",         pos: ["LB", "OLB"], hook: "man-gate blitz convert rate",
    desc: "When his man stays in to block, he doesn't waste the free rusher — turns coverage into an instant blitz.", grow: "Blitz sacks." },
  gapShooter:    { name: "Gap Shooter",       pos: ["LB", "OLB"], hook: "run-blitz penetrator react",
    desc: "Times the snap and knifes through his gap before the line can wall him off. A blitz weapon.", grow: "Tackles for loss shooting gaps." },
  gamesRunner:   { name: "Games Runner",      pos: ["LB", "OLB"], hook: "cross-dog pickP (Pass 4 hook rule)",
    desc: "Runs stunts and twists clean, looping behind the line to come free where the protection isn't.", grow: "Sacks off games and stunts." },
  // Coverage
  sticky:        { name: "Sticky",            pos: ["CB", "S"], hook: "sepgeo man react/keep",
    desc: "Mirrors his man out of the break and stays in his hip pocket — separation never opens up.", grow: "Breakups in coverage." },
  zoneEyes:      { name: "Zone Eyes",         pos: ["LB", "S", "CB", "OLB"], hook: "assignCoverage bust reduction",
    desc: "Sees the whole field in zone, passes off crossers cleanly, and rarely gets caught in a bust.", grow: "Tackles from zone coverage." },
  pressJam:      { name: "Press Jam",         pos: ["CB"], hook: "sepgeo jam term",
    desc: "Re-routes receivers at the line with a violent jam, wrecking the timing of the whole concept.", grow: "Breakups off the jam." },
  ballHawk:      { name: "Ball Hawk",         pos: ["S", "CB", "LB"], hook: "tipped-ball INT pick weight",
    desc: "Has a nose for the football — finds the tipped ball and the overthrow and comes down with it.", grow: "Interceptions." },
  highPoint:     { name: "High Point",        pos: ["CB", "S"], hook: "SIZE_MISMATCH contested term (def)",
    desc: "Goes up and gets it at its highest point, winning the jump ball against bigger receivers.", grow: "Winning contested balls (breakups)." },
  spyEyes:       { name: "Spy Eyes",          pos: ["LB", "OLB"], hook: "spyQB scramble containment",
    desc: "A disciplined spy — mirrors a scrambling quarterback and takes away the escape lane.", grow: "Reps spying the quarterback." },
  filmJunkie:    { name: "Film Junkie",       pos: ["S", "LB", "CB"], hook: "paBite discipline / disguise read",
    desc: "Lives in the film room. Doesn't bite on play-action or misdirection, and reads the formation's tell.", grow: "Sniffing out fakes and misdirection." },
  disguiseArtist:{ name: "Disguise Artist",   pos: ["S", "CB"], hook: "pDisguise craft (seller side)",
    desc: "Shows one coverage and plays another — holds the disguise until the snap and fools the read.", grow: "Reps selling coverage disguises." },
  patternMatcher:{ name: "Pattern Matcher",   pos: ["LB", "S", "CB"], hook: "awrSqueeze zone-void",
    desc: "Plays match coverage — carries routes like man while keeping his zone eyes, squeezing the throwing windows.", grow: "Tackles matching routes." },
  robber:        { name: "Robber",            pos: ["S"], hook: "robStrength undercut",
    desc: "Sits in the hole and robs the intermediate throw, jumping the dig or the crosser the QB never saw him on.", grow: "Interceptions jumping routes." },
  screenSniffer: { name: "Screen Sniffer",    pos: ["DT", "DE", "LB"], hook: "screen sniffChance",
    desc: "Smells the screen developing, peels off the rush, and blows it up before it starts.", grow: "Blowing up screens (tackles for loss)." },
  edgeSetter:    { name: "Edge Setter",       pos: ["DE", "OLB"], hook: "edgeTec contain vs jets/outside",
    desc: "Sets a hard edge and turns everything back inside — outside runs and jet sweeps have nowhere to go.", grow: "Stops setting the edge (tackles for loss)." },
  optionSound:   { name: "Option Sound",      pos: ["DE", "OLB", "LB"], hook: "resolveOptionPlay readWinP (def side)",
    desc: "Plays his assignment on the option — never guesses, takes his man, and makes the offense wrong.", grow: "Reps defending the option." },
  // PASS 5 (Hook Rule, named at plan-of-record — Ref/PASS5_OFFENSE_PLAN.md)
  rpoSound:      { name: "RPO Sound",         pos: ["LB", "OLB", "S"], hook: "rpoConflictRead biteP discipline + readP resistance (def side)",
    desc: "The conflict defender an RPO is built to fool — he stays square and takes away the read either way.", grow: "Defusing RPOs." },
  angles:        { name: "Angles",            pos: ["LB", "S", "CB"], hook: "geoYAC pursuit convergence",
    desc: "Takes the perfect pursuit angle, cutting off the runner instead of chasing him. Runs never spring loose.", grow: "Run-down tackles." },
  // Special teams
  gunner:        { name: "Gunner",            pos: ["S", "CB", "LB", "WR"], hook: "st_coverage coverageStrength",
    desc: "Flies down on punt coverage, beats the jammer, and gets to the returner before he can start.", grow: "Reps on the coverage unit." },
  returnVision:  { name: "Return Vision",     pos: ["WR", "RB", "CB", "S"], hook: "returner rating / breakChance",
    desc: "Sees the return develop, hits the crease, and turns a fair catch into a house call.", grow: "Reps and yards as a returner." },
  iceVeins:      { name: "Ice Veins",         pos: ["K"], hook: "attemptFG late/pressure context",
    desc: "Doesn't feel the moment — the game-winner in the cold is just another kick.", grow: "Making field goals." },
  coffinCorner:  { name: "Coffin Corner",     pos: ["P"], hook: "punt placement inside-20",
    desc: "Drops the punt inside the 10 and pins the offense against its own goal line.", grow: "Reps pinning punts deep." },
  hangTime:      { name: "Hang Time",         pos: ["P"], hook: "return coverage / fair catches",
    desc: "Boots it high enough that the coverage is there on the catch — forces the fair catch, kills the return.", grow: "Reps flipping field position." },
  handsTeam:     { name: "Hands Team",        pos: ["TE", "LB"], hook: "onsideResult recovery",
    desc: "Sure hands on the hands team — comes up with the onside kick and the scramble for a loose ball.", grow: "Reps on the recovery unit." },
  // OFFENSE — QB room (v1.5)
  blitzBeater:   { name: "Blitz Beater",      pos: ["QB"], hook: "hotChance",
    desc: "Reads the blitz pre-snap and gets the ball out hot to the vacated area before the pressure lands.", grow: "Passing yards." },
  eyeManipulator:{ name: "Eye Manipulator",   pos: ["QB"], hook: "robber lookoff term",
    desc: "Moves defenders with his eyes — looks off the safety and holds the robber to open the real throw.", grow: "Reps commanding the pocket." },
  fieldGeneral:  { name: "Field General",     pos: ["QB"], hook: "seeIt/pAud kill-call machinery",
    desc: "Runs the offense at the line — checks into the right play and kills the bad one before the snap.", grow: "Touchdown passes." },
  rhythmPasser:  { name: "Rhythm Passer",     pos: ["QB"], hook: "inRhythm first-read bonus",
    desc: "Deadly in rhythm — when the first read is there on time, the ball is out and on the money.", grow: "Passing yards." },
  slidesEarly:   { name: "Slides Early",      pos: ["QB"], hook: "qbContactResult (two-sided)",
    desc: "Protects himself — gives up the extra yard to slide or step out and live for the next snap.", grow: "Reps taking care of the ball and his body." },
  pocketPresence:{ name: "Pocket Presence",   pos: ["QB"], hook: "covSack escape / sack-avoid",
    desc: "Feels the rush without seeing it, climbs and slides in the pocket, and turns sacks into throws.", grow: "Passing yards." },
  scrambleDrill: { name: "Scramble Drill",    pos: ["QB"], hook: "off-schedule throw comp",
    desc: "Dangerous off-schedule — keeps his eyes downfield on the scramble and makes plays out of structure.", grow: "Scramble yards." },
  conflictReader:{ name: "Conflict Reader",   pos: ["QB"], hook: "rpoConflictRead readP (off side) + choice-route misP",
    desc: "Reads the conflict defender right every time on the RPO and choice route — takes exactly what's given.", grow: "Winning RPO reads." },
  // RB
  passProBack:   { name: "Pass-Pro Back",     pos: ["RB"], hook: "blitzer pickupProb",
    desc: "Trusted in protection — picks up the blitzing linebacker and keeps the quarterback clean.", grow: "Reps in pass protection." },
  chipper:       { name: "Chipper",           pos: ["RB", "TE"], hook: "chip bump machinery",
    desc: "Lands a real chip on the edge rusher on his way out, buying the tackle a beat and the QB an extra count.", grow: "Reps chipping on the way to the route." },
  patientRunner: { name: "Patient Runner",    pos: ["RB"], hook: "run2geo lane-commit entry",
    desc: "Lets the blocks develop, presses the hole, and hits it the instant it opens — no wasted movement.", grow: "Rushing yards." },
  oneCut:        { name: "One-Cut",           pos: ["RB"], hook: "runFit read/bend cut quality",
    desc: "Reads it, plants, and goes — one decisive cut downhill, no dancing behind the line.", grow: "Rushing yards." },
  homeRunThreat: { name: "Home-Run Threat",   pos: ["RB", "WR"], hook: "breakaway breakP",
    desc: "One crease and he's gone — the speed to take any touch the distance the moment he breaks the second level.", grow: "Explosive yardage." },
  secureBag:     { name: "Secure Bag",        pos: ["RB", "WR", "QB"], hook: "carry-fumble mult",
    desc: "High and tight, always — covers the ball in traffic and doesn't put it on the ground.", grow: "Carries without a fumble." },
  yacMonster:    { name: "YAC Monster",       pos: ["WR", "RB", "TE"], hook: "geoYAC wiggle/openTackle",
    desc: "The catch is where it starts — makes the first man miss and turns short throws into chunk gains.", grow: "Yards after contact." },
  // WR/TE
  routeTech:     { name: "Route Technician",  pos: ["WR", "TE"], hook: "sepgeo receiver duel",
    desc: "Runs precise routes, sinks his hips, and snaps out of breaks to create separation without a step wasted.", grow: "Catches." },
  contestedCatch:{ name: "Contested Catch",   pos: ["WR", "TE"], hook: "contested catchProb term",
    desc: "Wins the ball with a defender draped on him — strong hands and a big frame in a crowd.", grow: "Contested catches." },
  chainMover:    { name: "Chain Mover",       pos: ["WR", "TE"], hook: "catchResolution on 3rd down (situational)",
    desc: "The one you want on third down — finds the sticks, sits in the soft spot, and moves the chains.", grow: "Third-down catches." },
  releaseArtist: { name: "Release Artist",    pos: ["WR"], hook: "sepgeo release vs jam",
    desc: "Beats press at the line with quick feet and hands — can't be jammed off his release.", grow: "Catches." },
  doubleMove:    { name: "Double-Move Artist", pos: ["WR"], hook: "sepgeo dblLag sell",
    desc: "Sells the first move so well the defender bites — then it's over the top for a big play.", grow: "Catches." },
  motionWeapon:  { name: "Motion Weapon",     pos: ["WR", "RB"], hook: "motionGain",
    desc: "Dangerous on the move — jet and orbit motion turn him into a runner, a threat, and a defense's headache.", grow: "Reps as a motion man." },
  deepTracker:   { name: "Deep Tracker",      pos: ["WR"], hook: "vdeep over-the-shoulder",
    desc: "Tracks the deep ball over his shoulder in full stride and adjusts to the underthrow without breaking down.", grow: "Deep receiving yards." },
  blockingWR:    { name: "Blocking Receiver", pos: ["WR", "TE"], hook: "stalk-block blockScore",
    desc: "Blocks like he means it on the perimeter — his stalk block is what springs the screen and the outside run.", grow: "Reps blocking on the edge." },
  paSeller:      { name: "Play-Action Seller", pos: ["RB", "QB"], hook: "PA credibility",
    desc: "Sells the fake — the mesh looks exactly like the run, and the linebackers step up right into it.", grow: "Reps selling play-action." },
  leverageReader:{ name: "Leverage Reader",   pos: ["WR", "TE"], hook: "choice-route convP + misP (schemeFor)",
    desc: "Reads the defender's leverage on option routes and breaks the right way — always into the open grass.", grow: "Option-route conversions." },
  gadgetAce:     { name: "Gadget Ace",        pos: ["RB", "WR"], hook: "gadget resolver exchange/sell craft",
    desc: "The trick-play specialist — clean on the reverse, the flea-flicker exchange, and the halfback pass.", grow: "Gadget and trick-play snaps." },
  leadBlocker:   { name: "Lead Blocker",      pos: ["RB", "TE"], hook: "FB-lead run blockRep",
    desc: "A missile through the hole — finds the linebacker and clears the path for the back behind him.", grow: "Reps leading up on the run." },
  // OL
  lineGeneral:   { name: "Line General",      pos: ["OL"], hook: "centerAwr half-slide + stunt counter (center)",
    desc: "Sets the protection and makes the calls — passes off stunts and twists so nobody comes free.", grow: "Reps anchoring the protection calls." },
  anchor:        { name: "Anchor",            pos: ["OL"], hook: "blockRep powerPath resistance",
    desc: "Can't be bull-rushed — drops his weight and stones the power move, keeping the pocket square.", grow: "Reps holding up in protection." },
  mirror:        { name: "Mirror",            pos: ["OL"], hook: "blockRep speedPath ride",
    desc: "Light, quick feet — mirrors the speed rush and rides the edge man past the quarterback.", grow: "Reps in pass protection." },
  puller:        { name: "Puller",            pos: ["OL"], hook: "pull mobility bonus",
    desc: "Gets out in front in space on the pull and finds his man on the move — the engine of power and counter.", grow: "Reps pulling on run downs." },
  peopleMover:   { name: "People Mover",      pos: ["OL"], hook: "run-branch blockRep drive",
    desc: "Wins the point of attack and drives his man off the ball, opening running lanes by force.", grow: "Reps run blocking." }
};

// ── FLAWS (§4b, §4e) — independent of quality (Borderlands rule §8) ─────────
const FLAW_CATALOG = {
  grabby:      { name: "Grabby",        pos: ["CB", "S"], hook: "PENALTY_CATALOG Pass Interference weight",
    desc: "Gets handsy downfield when he's beaten — draws pass interference and holding flags in coverage." },
  jumpy:       { name: "Jumpy",         pos: ["DE", "DT", "OLB", "OL"], hook: "offside/false-start weight",
    desc: "Too eager off the ball — jumps the snap for offside and false-start flags at the worst times." },
  gambler:     { name: "Gambler",       pos: ["CB", "S"], hook: "INTs up AND burned-deep up (two-sided)",
    desc: "Rolls the dice on the ball — gets his share of picks, and gets torched deep just as often when he guesses wrong." },
  headhunter:  { name: "Headhunter",    pos: ["S", "LB"], hook: "splash hits + personal fouls",
    desc: "Hunts the big hit — delivers the splash, but takes the targeting and personal-foul flags that come with it." },
  freelancer:  { name: "Freelancer",    pos: ["LB", "S", "CB", "OLB"], hook: "busts up + splash up (two-sided)",
    desc: "Freelances off his assignment chasing plays — makes some splash, but leaves busts behind when he's wrong." },
  drops:       { name: "Drops",         pos: ["WR", "TE", "RB"], hook: "dropProb",
    desc: "Stone hands at the wrong moment — puts catchable balls on the ground, third downs included." },
  fumbler:     { name: "Fumbler",       pos: ["RB", "WR", "QB"], hook: "carry-fumble mult",
    desc: "Loose with the ball — carries it away from his body and coughs it up in traffic." },
  happyFeet:   { name: "Happy Feet",    pos: ["QB"], hook: "hurried read pool / HURRY_PENALTY",
    desc: "Bails on a clean pocket — feet start dancing at the first hint of pressure and the read falls apart." },
  slowStarter: { name: "Slow Starter",  pos: ["QB", "RB", "WR", "K"], hook: "form dip, front half of games",
    desc: "Takes a while to get going — plays below himself in the first half before settling in." },
  telegraph:   { name: "Telegraph",     pos: ["QB"], hook: "robber/forced-ball INT term",
    desc: "Stares down his target — defenders read his eyes and jump the throw for the pick." },
  heroBall:    { name: "Hero Ball",     pos: ["QB"], hook: "covSack branch weights (two-sided)",
    desc: "Tries to make the great play when the smart one is there — a few highlights, and a lot of avoidable sacks." },
  dancer:      { name: "Dancer",        pos: ["RB"], hook: "One-Cut reversed: bounces everything (two-sided)",
    desc: "Dances behind the line instead of hitting it — bounces runs outside that should've gone straight ahead." },
  bodyCatcher: { name: "Body Catcher",  pos: ["WR", "TE"], hook: "contested term reversed",
    desc: "Catches with his body, not his hands — loses the contested ball he should win." },
  bitesHard:   { name: "Bites Hard",    pos: ["LB", "S"], hook: "paBite discipline reversed + dbl victim (two-sided)",
    desc: "Bites on the fake — play-action and misdirection pull him out of position and open the throw behind him." },
  laneDrifter: { name: "Lane Drifter",  pos: ["DT", "DE"], hook: "gap-integrity / stunt-align",
    desc: "Drifts out of his gap chasing the ball — leaves a crease behind him for the cutback." },
  holdingHabit:{ name: "Holding Habit", pos: ["OL"], hook: "Offensive Holding weight",
    desc: "Grabs cloth when he's beaten — brings back big plays with holding flags." },
  shanks:      { name: "Shanks",        pos: ["K", "P"], hook: "pressure variance on the kick roll",
    desc: "Streaky under pressure — the leg is there, but the misses come in bunches at the worst times." },
  muffs:       { name: "Muffs",         pos: ["WR", "RB", "CB", "S"], hook: "muffP machinery (returns/pitches)",
    desc: "Shaky fielding the ball in space — muffs punts and bobbles pitches, giving it right back." }
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
